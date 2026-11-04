import { db } from '../../src/db';
import * as schema from '../../src/db/schema';
import { eq, or, sql, isNull, and } from 'drizzle-orm';
import moment from 'moment-jalaali';
import { normalizeDigits } from '../../src/utils/textNormalization';

export const PTW_UNAUTHORIZED_MESSAGE =
  'کاربر غیرمجاز است؛ دوره آموزشی صدور پروانه کار را با موفقیت نگذرانده یا صلاحیت گواهینامه، نوع پروانه یا مسئولیت امضای وی معتبر نیست.';

export interface PtwVerificationResult {
  valid: boolean;
  message?: string;
  details?: {
    courseStatus?: string;
    courseResult?: string;
    issueDate?: string;
    expiryDate?: string;
    status?: string;
    reason?: string;
    roleKey?: string;
    permitCategory?: string;
    error?: string;
    [key: string]: any;
  };
}


/**
 * Calculate Jalali expiration date based on issue date and duration
 */
export function calculatePtwExpiry(issueDate: string, duration?: string): string {
  if (!issueDate || !duration) return '';
  try {
    const cleanDate = normalizeDigits(String(issueDate).trim()).replace(/-/g, '/');
    const m = moment(cleanDate, 'jYYYY/jMM/jDD');
    if (!m.isValid()) return '';

    if (duration === '6m') m.add(6, 'jMonth');
    else if (duration === '1y') m.add(1, 'jYear');
    else if (duration === '3y') m.add(3, 'jYear');
    else if (duration === '5y') m.add(5, 'jYear');

    return m.format('jYYYY/jMM/jDD');
  } catch {
    return '';
  }
}

/**
 * Evaluates raw qualification data and returns status
 */
export function checkPtwQualificationRecord(
  q: any,
  roleKey?: string,
  permitCategory?: string
): PtwVerificationResult {
  if (!q || typeof q !== 'object') {
    return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { reason: 'NO_QUALIFICATION_DATA' } };
  }

  // 1. Course status check
  if (q.courseStatus !== 'passed') {
    return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { courseStatus: q.courseStatus, reason: 'COURSE_NOT_PASSED' } };
  }

  // 2. Course result check
  if (q.courseResult !== 'success') {
    return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { courseResult: q.courseResult, reason: 'COURSE_FAILED' } };
  }

  // 3. Issue date and validity check
  if (!q.issueDate || !q.validityDuration) {
    return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { reason: 'INCOMPLETE_DATES' } };
  }

  const expiry = q.expiryDate || calculatePtwExpiry(q.issueDate, q.validityDuration);
  if (!expiry) {
    return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { reason: 'INVALID_EXPIRY' } };
  }

  // Real-time expiration boundary check against today's Jalali date
  try {
    const cleanExpiry = normalizeDigits(String(expiry).trim()).replace(/-/g, '/');
    const expM = moment(cleanExpiry, 'jYYYY/jMM/jDD');
    if (!expM.isValid()) {
      return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { reason: 'INVALID_EXPIRY_FORMAT' } };
    }

    const todayStr = moment().format('jYYYY/jMM/jDD');
    const todayM = moment(todayStr, 'jYYYY/jMM/jDD');
    if (expM.isBefore(todayM, 'day')) {
      return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { expiryDate: expiry, reason: 'CERTIFICATE_EXPIRED' } };
    }
  } catch {
    return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { reason: 'DATE_COMPARISON_ERROR' } };
  }

  // 4. Responsibility / Role check
  if (roleKey) {
    const normalizedRole = String(roleKey).trim();
    const responsibilities = q.responsibilities || {};
    let isRolePermitted = false;

    if (normalizedRole === 'issuer' || normalizedRole.includes('صادر')) {
      isRolePermitted = Boolean(responsibilities.issuer);
    } else if (normalizedRole === 'executor' || normalizedRole.includes('مجری')) {
      isRolePermitted = Boolean(responsibilities.executor);
    } else if (normalizedRole === 'areaSupervisor' || normalizedRole.includes('محوطه')) {
      isRolePermitted = Boolean(responsibilities.areaSupervisor);
    } else if (normalizedRole === 'safetyUnit' || normalizedRole.includes('ایمنی') || normalizedRole.includes('hse')) {
      isRolePermitted = Boolean(responsibilities.safetyUnit);
    } else {
      isRolePermitted = true;
    }

    if (!isRolePermitted) {
      return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { roleKey, reason: 'ROLE_NOT_AUTHORIZED' } };
    }
  }

  // 5. Permit category check
  if (permitCategory) {
    const cat = String(permitCategory).trim().toLowerCase();
    const main = q.mainPermits || {};
    const supp = q.supplementaryPermits || {};

    if (cat === 'hot' || cat.includes('گرم')) {
      if (!main.hot) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'HOT_WORK_NOT_AUTHORIZED' } };
      }
    } else if (cat === 'cold' || cat.includes('سرد')) {
      if (!main.cold) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'COLD_WORK_NOT_AUTHORIZED' } };
      }
    } else if (cat.includes('excavation') || cat.includes('حفاری')) {
      if (!supp.excavation) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'EXCAVATION_NOT_AUTHORIZED' } };
      }
    } else if (cat.includes('confined') || cat.includes('بسته')) {
      if (!supp.confinedSpace) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'CONFINED_SPACE_NOT_AUTHORIZED' } };
      }
    } else if (cat.includes('vehicle') || cat.includes('crane') || cat.includes('جرثقیل') || cat.includes('خودرو')) {
      if (!supp.vehicleCrane) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'VEHICLE_CRANE_NOT_AUTHORIZED' } };
      }
    } else if (cat.includes('process') || cat.includes('mechanical') || cat.includes('فرایندی') || cat.includes('مکانیکی')) {
      if (!supp.processIsolation) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'PROCESS_ISOLATION_NOT_AUTHORIZED' } };
      }
    } else if (cat.includes('electrical') || cat.includes('برق') || cat.includes('الکتریک')) {
      if (!supp.electricalIsolation) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'ELECTRICAL_ISOLATION_NOT_AUTHORIZED' } };
      }
    } else if (cat.includes('radiation') || cat.includes('پرتو')) {
      if (!supp.radiation) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'RADIATION_NOT_AUTHORIZED' } };
      }
    } else {
      // General check: must at least have hot or cold
      if (!main.hot && !main.cold) {
        return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { permitCategory, reason: 'NO_PERMIT_CATEGORY_AUTHORIZED' } };
      }
    }
  }

  return { valid: true };
}

/**
 * Validates a signer from PostgreSQL by identifier (code, username, full name, or ID)
 */
export async function verifyPersonPtwAuthorization(
  identifier: string | number,
  roleKey?: string,
  permitCategory?: string
): Promise<PtwVerificationResult> {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) {
    return { valid: false, message: PTW_UNAUTHORIZED_MESSAGE, details: { reason: 'EMPTY_IDENTIFIER' } };
  }

  try {
    // 1. Look up in users table
    const userQuery = await db
      .select({
        id: schema.users.id,
        uid: schema.users.uid,
        username: schema.users.username,
        fullName: schema.users.fullName,
        personnelNumber: schema.users.personnelNumber,
        profileData: schema.users.profileData,
      })
      .from(schema.users)
      .where(
        and(
          isNull(schema.users.deletedAt),
          or(
            eq(schema.users.uid, cleanId),
            eq(schema.users.username, cleanId),
            eq(schema.users.personnelNumber, cleanId),
            eq(schema.users.fullName, cleanId)
          )
        )
      )
      .limit(1);

    if (userQuery.length > 0) {
      const u = userQuery[0];
      const pData = (u.profileData as Record<string, any>) || {};
      if (pData.ptwQualification) {
        return checkPtwQualificationRecord(pData.ptwQualification, roleKey, permitCategory);
      }
    }

    // 2. Look up in personnel table
    const personnelQuery = await db
      .select({
        id: schema.personnel.id,
        personnelCode: schema.personnel.personnelCode,
        firstName: schema.personnel.firstName,
        lastName: schema.personnel.lastName,
        extraData: schema.personnel.extraData,
      })
      .from(schema.personnel)
      .where(
        or(
          eq(schema.personnel.personnelCode, cleanId),
          sql`TRIM(CONCAT(${schema.personnel.firstName}, ' ', ${schema.personnel.lastName})) = ${cleanId}`
        )
      )
      .limit(1);

    if (personnelQuery.length > 0) {
      const p = personnelQuery[0];
      const extra = (p.extraData as Record<string, any>) || {};
      if (extra.ptwQualification) {
        return checkPtwQualificationRecord(extra.ptwQualification, roleKey, permitCategory);
      }
    }

    // If no qualification record exists in PostgreSQL, user is unqualified
    return {
      valid: false,
      message: PTW_UNAUTHORIZED_MESSAGE,
      details: { reason: 'NO_RECORD_FOUND' },
    };
  } catch (error: any) {
    console.error('PTW qualification DB verification error:', error);
    return {
      valid: false,
      message: PTW_UNAUTHORIZED_MESSAGE,
      details: { reason: 'SERVER_ERROR', error: error?.message },
    };
  }
}

/**
 * Validates all newly signed tiers in a work permit payload before upserting or approving
 */
export async function validatePermitSignaturesPayload(
  permitPayload: any,
  permitCategory?: string
): Promise<{ allowed: boolean; errorMessage?: string }> {
  const category = permitCategory || permitPayload?.permitCategory || permitPayload?.permitType || 'Hot';
  const sigs = permitPayload?.formData?.signatures4Tier || permitPayload?.signatures4Tier;

  if (sigs && typeof sigs === 'object') {
    const roles: Array<'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit'> = [
      'issuer',
      'executor',
      'areaSupervisor',
      'safetyUnit',
    ];

    for (const r of roles) {
      const tier = sigs[r];
      if (tier && (tier.status === 'Approved' || tier.signatureImage)) {
        const signerIdentifier = tier.personnelCode || tier.signedByUser || tier.name;
        if (signerIdentifier) {
          const check = await verifyPersonPtwAuthorization(signerIdentifier, r, category);
          if (!check.valid) {
            return {
              allowed: false,
              errorMessage: PTW_UNAUTHORIZED_MESSAGE,
            };
          }
        }
      }
    }
  }

  // Also validate closure signatures if closure details are provided
  const closure = permitPayload?.formData?.closureDetails || permitPayload?.closureDetails;
  if (closure && closure.signatures) {
    const closureRoles: Array<'executor' | 'areaSupervisor' | 'issuer'> = ['executor', 'areaSupervisor', 'issuer'];
    for (const cr of closureRoles) {
      const cTier = closure.signatures[cr];
      if (cTier && (cTier.status === 'Approved' || cTier.signatureImage)) {
        const signerIdentifier = cTier.personnelCode || cTier.signedByUser || cTier.name;
        if (signerIdentifier) {
          const check = await verifyPersonPtwAuthorization(signerIdentifier, cr, category);
          if (!check.valid) {
            return {
              allowed: false,
              errorMessage: PTW_UNAUTHORIZED_MESSAGE,
            };
          }
        }
      }
    }
  }

  return { allowed: true };
}
