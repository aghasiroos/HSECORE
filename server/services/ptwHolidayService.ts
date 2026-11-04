/**
 * PTW Holiday & Senior Duty Officer Validation Service
 * Enforces strict control on issuing Hot Work Permits on holidays in Iran (Asia/Tehran timezone).
 */

import { db } from '../../src/db/index.ts';
import * as schema from '../../src/db/schema.ts';
import { eq, or, isNull, and, sql } from 'drizzle-orm';
import { checkIsIranHoliday, IranHolidayResult } from './iranCalendarService.ts';
import { UserContext } from '../core/middleware/auth.ts';

export interface VerifiedIssuerInfo {
  personnelId?: number;
  personnelCode: string;
  fullName: string;
  jobTitle: string;
  isSeniorDuty: boolean;
  source: 'personnel' | 'users' | 'fallback';
}

export interface HotWorkHolidayValidationResult {
  allowed: boolean;
  isHoliday: boolean;
  isHotWork: boolean;
  isSeniorDuty?: boolean;
  requiresConfirmation?: boolean;
  errorCode?: string;
  errorMessage?: string;
  warningMessage?: string;
  holidayCheck: IranHolidayResult;
  verifiedIssuer?: VerifiedIssuerInfo;
  holidayAuditTrail?: {
    isHoliday: boolean;
    holidayTitle?: string;
    dateShamsi: string;
    timeTehran: string;
    issuerName: string;
    issuerPersonnelCode: string;
    issuerVerifiedJobTitle: string;
    warningConfirmedAt: string;
    warningConfirmedBy: string;
  };
}

/**
 * Checks if a given job title / position title matches "کشیک ارشد" (Senior Duty Officer)
 */
export function isSeniorDutyOfficer(
  jobTitle?: string | null,
  positionTitle?: string | null,
  role?: string | null
): boolean {
  const combined = `${jobTitle || ''} ${positionTitle || ''} ${role || ''}`
    .replace(/\s+/g, ' ')
    .trim();

  if (!combined) return false;

  // Normalized Persian/English terms for Senior Duty Officer
  const seniorDutyKeywords = [
    'کشیک ارشد',
    'کشیک‌ارشد',
    'کشیک ارشد تولید',
    'کشیک ارشد نوبت کاری',
    'کشیک ارشد نوبت‌کاری',
    'کشیک ارشد مجتمع',
    'senior duty',
    'senior duty officer',
    'senior shift supervisor',
  ];

  return seniorDutyKeywords.some(keyword =>
    combined.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Resolves verified issuer identity and job role from PostgreSQL database
 */
export async function verifyIssuerJobRoleFromDb(
  user?: UserContext,
  providedCodeOrName?: string
): Promise<VerifiedIssuerInfo> {
  const codeToLookup = (
    providedCodeOrName ||
    user?.personnelCode ||
    user?.username ||
    ''
  ).trim();

  if (codeToLookup) {
    // 1. Query personnel table by personnelCode or full name
    try {
      const pQuery = await db
        .select({
          id: schema.personnel.id,
          personnelCode: schema.personnel.personnelCode,
          firstName: schema.personnel.firstName,
          lastName: schema.personnel.lastName,
          jobTitle: schema.personnel.jobTitle,
          positionId: schema.personnel.positionId,
        })
        .from(schema.personnel)
        .where(
          or(
            eq(schema.personnel.personnelCode, codeToLookup),
            sql`TRIM(CONCAT(${schema.personnel.firstName}, ' ', ${schema.personnel.lastName})) = ${codeToLookup}`
          )
        )
        .limit(1);

      if (pQuery.length > 0) {
        const p = pQuery[0];
        let positionTitle = '';
        if (p.positionId) {
          const posQuery = await db
            .select({ title: schema.orgPositions.title })
            .from(schema.orgPositions)
            .where(eq(schema.orgPositions.id, p.positionId))
            .limit(1);
          if (posQuery.length > 0) {
            positionTitle = posQuery[0].title || '';
          }
        }

        const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || codeToLookup;
        const jobTitle = (p.jobTitle || positionTitle || 'کارشناس صادرکننده').trim();
        const isSenior = isSeniorDutyOfficer(jobTitle, positionTitle, user?.role);

        return {
          personnelId: p.id,
          personnelCode: p.personnelCode,
          fullName,
          jobTitle,
          isSeniorDuty: isSenior,
          source: 'personnel',
        };
      }
    } catch (e) {
      console.error('Error querying personnel table for issuer verification:', e);
    }

    // 2. Query users table
    try {
      const uQuery = await db
        .select({
          id: schema.users.id,
          personnelNumber: schema.users.personnelNumber,
          fullName: schema.users.fullName,
          username: schema.users.username,
          jobTitle: schema.users.jobTitle,
          role: schema.users.role,
        })
        .from(schema.users)
        .where(
          and(
            isNull(schema.users.deletedAt),
            or(
              eq(schema.users.personnelNumber, codeToLookup),
              eq(schema.users.username, codeToLookup),
              eq(schema.users.fullName, codeToLookup)
            )
          )
        )
        .limit(1);

      if (uQuery.length > 0) {
        const u = uQuery[0];
        const fullName = u.fullName || u.username || codeToLookup;
        const jobTitle = (u.jobTitle || u.role || 'کارشناس صادرکننده').trim();
        const isSenior = isSeniorDutyOfficer(jobTitle, null, u.role);

        return {
          personnelCode: u.personnelNumber || u.username || codeToLookup,
          fullName,
          jobTitle,
          isSeniorDuty: isSenior,
          source: 'users',
        };
      }
    } catch (e) {
      console.error('Error querying users table for issuer verification:', e);
    }
  }

  // Fallback for user context if user has explicit Senior Duty job title or role
  const userJobTitle = user?.role || 'صادرکننده پروانه کار';
  const isSenior = isSeniorDutyOfficer(userJobTitle, null, user?.role);

  return {
    personnelCode: user?.personnelCode || user?.username || 'GUEST',
    fullName: user?.name || user?.username || 'صادرکننده پروانه کار',
    jobTitle: userJobTitle,
    isSeniorDuty: isSenior,
    source: 'fallback',
  };
}

/**
 * Validates PTW Hot Work Permit issuance on holidays
 */
export async function validateHotWorkHolidayIssuance(
  permitPayload: any,
  user?: UserContext
): Promise<HotWorkHolidayValidationResult> {
  // Determine permit type
  const rawType = (
    permitPayload?.permitType ||
    permitPayload?.permitCategory ||
    permitPayload?.formData?.permitCategory ||
    'HOT_WORK'
  ).toString().toUpperCase();

  const isHotWork =
    rawType === 'HOT_WORK' ||
    rawType === 'HOT' ||
    rawType === 'پروانه کار گرم' ||
    permitPayload?.isHotWork === true;

  // Resolve target date (startDate, validFrom, or current date)
  const targetDateStr =
    permitPayload?.startDate ||
    permitPayload?.validFrom ||
    permitPayload?.createdDate ||
    new Date();

  // Perform Iran holiday check
  const holidayCheck = await checkIsIranHoliday(targetDateStr);

  // Normal work days do not trigger hot work holiday controls
  if (!holidayCheck.isHoliday) {
    return {
      allowed: true,
      isHoliday: false,
      isHotWork,
      holidayCheck,
    };
  }

  // Non-Hot Work permits (Cold Work, Electrical, etc.) on holidays follow standard workflow
  if (!isHotWork) {
    return {
      allowed: true,
      isHoliday: true,
      isHotWork: false,
      holidayCheck,
    };
  }

  // Extract issuer code or name
  const issuerIdentifier =
    permitPayload?.formData?.signatures4Tier?.issuer?.personnelCode ||
    permitPayload?.formData?.signatures4Tier?.issuer?.name ||
    permitPayload?.applicantPersonnelCode ||
    permitPayload?.applicantName ||
    user?.personnelCode ||
    user?.username;

  // Query verified database personnel record
  const verifiedIssuer = await verifyIssuerJobRoleFromDb(user, issuerIdentifier);

  // If issuer is NOT a Senior Duty Officer ("کشیک ارشد"), block Hot Work permit completely on holidays
  if (!verifiedIssuer.isSeniorDuty) {
    return {
      allowed: false,
      isHoliday: true,
      isHotWork: true,
      isSeniorDuty: false,
      errorCode: 'HOT_WORK_HOLIDAY_BLOCKED',
      errorMessage:
        'شما مجاز به صدور پروانه کار گرم در روزهای تعطیل نیستید. این مجوز صرفاً برای پرسنل دارای سمت شغلی کشیک ارشد فعال است.',
      holidayCheck,
      verifiedIssuer,
    };
  }

  // If issuer IS a Senior Duty Officer, require explicit warning confirmation
  const isConfirmed =
    permitPayload?.holidayWarningConfirmed === true ||
    permitPayload?.formData?.holidayWarningConfirmed === true;

  if (!isConfirmed) {
    return {
      allowed: false,
      isHoliday: true,
      isHotWork: true,
      isSeniorDuty: true,
      requiresConfirmation: true,
      errorCode: 'HOT_WORK_HOLIDAY_WARNING_REQUIRED',
      warningMessage:
        'توجه! صدور پروانه کار گرم در روزهای تعطیل مشمول الزامات و محدودیتهای ویژه مطابق با استاندارد و دستورالعمل صدور پروانه کار در روزهای تعطیل میباشد. آیا از ضرورت و مجاز بودن صدور این پروانه اطمینان دارید؟',
      holidayCheck,
      verifiedIssuer,
    };
  }

  // Explicit confirmation acknowledged: construct audit trail record
  const holidayAuditTrail = {
    isHoliday: true,
    holidayTitle: holidayCheck.holidayTitle || 'روز تعطیل',
    dateShamsi: holidayCheck.dateShamsi,
    timeTehran: holidayCheck.timeTehran,
    issuerName: verifiedIssuer.fullName,
    issuerPersonnelCode: verifiedIssuer.personnelCode,
    issuerVerifiedJobTitle: verifiedIssuer.jobTitle,
    warningConfirmedAt: new Date().toISOString(),
    warningConfirmedBy: user?.username || verifiedIssuer.fullName,
  };

  return {
    allowed: true,
    isHoliday: true,
    isHotWork: true,
    isSeniorDuty: true,
    holidayCheck,
    verifiedIssuer,
    holidayAuditTrail,
  };
}
