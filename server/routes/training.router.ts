import { Router } from 'express';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db, withDbRetry } from '../../src/db/index.ts';
import { withTransaction } from '../core/db.ts';
import { systemSettings } from '../../src/db/schema.ts';
import { requireAuth, isGlobalAdminUser, UserContext } from '../core/middleware/auth.ts';
import { personnelRepository } from '../modules/personnel/personnel.repository.ts';
import { auditService } from '../modules/audit/audit.service.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { syncSettingsMemoryCache } from './settings.router.ts';
import { invalidateDashboardCache } from './dashboard.router.ts';
import { getShamsiToday } from '../../src/utils/jalaliDate.ts';
import { cleanPersonnelCode, normalizeForMatching, normalizeDigits } from '../../src/utils/textNormalization.ts';
import {
  buildSyncedLegacyContractors,
  cleanContractorDisplayName,
  normalizeContractorCompanyKey,
  parseTrainingHours,
  toComparableJalaliNumber,
} from '../../src/utils/contractorTrainingAnalytics.ts';
import { logger } from '../core/logger.ts';
import type {
  TrainingCourseDef,
  TrainingCourseRecord,
  TrainingCalendarEvent,
  TrainingBulkAssignItemResult,
  TrainingBulkAssignmentBatch,
  ContractorCompany,
  ContractorTrainingRecord,
  ContractorTrainingAuditEntry,
  LegacyContractorSummary,
} from '../../src/types/training.ts';

export const trainingRouter = Router();

const KEY_COURSES = 'hse_training_courses_v2';
const KEY_COURSE_DEFS = 'hse_training_course_defs';
const KEY_CALENDAR_EVENTS = 'hse_training_calendar_events';
const KEY_BULK_HISTORY = 'hse_training_bulk_assignments';
const KEY_CONTRACTOR_RECORDS = 'hse_training_contractor_records';
const KEY_CONTRACTOR_COMPANIES = 'hse_training_contractor_companies';
const KEY_CONTRACTOR_AUDIT = 'hse_training_contractor_audit';
const KEY_LEGACY_CONTRACTORS = 'hse_training_contractors';

const ALLOWED_BULK_ROLES = new Set([
  'ADMIN',
  'ADMINISTRATOR',
  'SUPER_ADMIN',
  'HSE_MANAGER',
  'SAFETY_OFFICER',
  'EXECUTIVE_MANAGER',
  'EXECUTIVEMANAGER',
  'PROCESS_MANAGER',
  'SUPERVISOR',
  'SHIFT_SUPERVISOR',
  'TRAINING_OFFICER',
]);

const OVERRIDE_AUTHORIZED_ROLES = new Set([
  'ADMIN',
  'ADMINISTRATOR',
  'SUPER_ADMIN',
  'HSE_MANAGER',
  'SAFETY_OFFICER',
  'EXECUTIVE_MANAGER',
  'EXECUTIVEMANAGER',
  'TRAINING_OFFICER',
]);

function normalizeRole(role?: string): string {
  return String(role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function canBulkAssignTraining(user?: UserContext): boolean {
  if (!user) return false;
  if (isGlobalAdminUser(user)) return true;
  const role = normalizeRole(user.role);
  if (ALLOWED_BULK_ROLES.has(role)) return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return perms.some((p) => {
    const norm = String(p || '').toLowerCase();
    return (
      norm === '*' ||
      norm === 'training:*' ||
      norm === 'training:create' ||
      norm === 'training:update' ||
      norm === 'hse:*'
    );
  });
}

function canOverrideDuplicateTraining(user?: UserContext): boolean {
  if (!user) return false;
  if (isGlobalAdminUser(user)) return true;
  const role = normalizeRole(user.role);
  if (OVERRIDE_AUTHORIZED_ROLES.has(role)) return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return perms.some((p) => {
    const norm = String(p || '').toLowerCase();
    return (
      norm === '*' ||
      norm === 'training:*' ||
      norm === 'training:override' ||
      norm === 'training:update'
    );
  });
}

function normalizeCodeKey(code?: string): string {
  return cleanPersonnelCode(normalizeDigits(String(code || ''))).toLowerCase();
}

function normalizeCourseCode(code?: string): string {
  return normalizeDigits(String(code || '')).trim().toUpperCase();
}

function extractPersonnelStatus(p: any): 'active' | 'inactive' {
  const raw = String(p?.status || p?.extraData?.status || 'active').trim().toLowerCase();
  if (raw === 'inactive' || raw === 'disabled' || raw === 'غیرفعال' || raw === 'terminated') {
    return 'inactive';
  }
  return 'active';
}

function extractPersonnelUnit(p: any): string {
  return String(
    p?.unit ||
      p?.unitName ||
      p?.department ||
      p?.departmentName ||
      p?.extraData?.unit ||
      p?.extraData?.department ||
      ''
  ).trim();
}

function extractPersonnelJobTitle(p: any): string {
  return String(
    p?.jobTitle ||
      p?.position ||
      p?.positionTitle ||
      p?.extraData?.jobTitle ||
      p?.extraData?.position ||
      ''
  ).trim();
}

function extractPersonnelFullName(p: any): { firstName: string; lastName: string; fullName: string } {
  const firstName = String(p?.firstName || '').trim();
  const lastName = String(p?.lastName || '').trim();
  const combined = `${firstName} ${lastName}`.trim();
  const fullName = String(p?.fullName || combined || p?.personnelCode || '').trim();
  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/);
    return {
      firstName: parts[0] || fullName,
      lastName: parts.slice(1).join(' '),
      fullName,
    };
  }
  return { firstName: firstName || fullName, lastName, fullName };
}

async function readSettingTx(tx: any, key: string): Promise<any> {
  const rows = await tx
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return rows[0]?.value;
}

async function upsertSettingTx(tx: any, key: string, value: any, description: string, updatedBy: string): Promise<void> {
  await tx
    .insert(systemSettings)
    .values({
      key,
      value,
      description,
      updatedBy,
      version: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value,
        description,
        updatedBy,
        version: sql`${systemSettings.version} + 1`,
        updatedAt: new Date(),
      },
    });
}

// ============================================================================
// GET /api/v1/training/bulk-assignments
// Returns audit history of bulk training assignments by job title
// ============================================================================
trainingRouter.get('/bulk-assignments', requireAuth, async (_req, res) => {
  try {
    const rows = await withDbRetry(() =>
      db.select().from(systemSettings).where(eq(systemSettings.key, KEY_BULK_HISTORY)).limit(1)
    );
    const list = Array.isArray(rows[0]?.value) ? rows[0].value : [];
    return res.json({ success: true, data: list });
  } catch (err: any) {
    logger.error('[Training] Failed to load bulk assignment history', { error: err?.message });
    return res.status(500).json({ success: false, error: 'خطا در دریافت سوابق تخصیص گروهی آموزش' });
  }
});

// ============================================================================
// POST /api/v1/training/bulk-assign
// Bulk assigns one or more defined training courses to eligible personnel
// selected by job title from the central personnel master data.
// ============================================================================
trainingRouter.post('/bulk-assign', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canBulkAssignTraining(user)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز تخصیص گروهی دوره‌های آموزشی را ندارید.',
      });
    }

    const body = req.body || {};
    const jobTitle = String(body.jobTitle || '').trim();
    const unitFilter = String(body.unitFilter || '').trim();
    const employmentStatusFilter =
      body.employmentStatusFilter === 'active' || body.employmentStatusFilter === 'inactive'
        ? body.employmentStatusFilter
        : 'all';
    const rawPersonnelCodes = Array.isArray(body.personnelCodes) ? body.personnelCodes : [];
    const rawCourseCodes = Array.isArray(body.courseCodes) ? body.courseCodes : [];
    const dueDate = String(body.dueDate || '').trim();
    const linkToCalendar = Boolean(body.linkToCalendar);
    const calendarDate = String(body.calendarDate || '').trim();
    const calendarTime = String(body.calendarTime || '').trim();
    const allowRenewalOverride = Boolean(body.allowRenewalOverride);
    const overrideReason = String(body.overrideReason || '').trim();

    if (!jobTitle) {
      return res.status(400).json({
        success: false,
        error: 'انتخاب رده شغلی یا سمت سازمانی الزامی است.',
      });
    }

    const uniquePersonnelCodes: string[] = Array.from(
      new Set<string>(
        rawPersonnelCodes
          .map((c: any) => cleanPersonnelCode(normalizeDigits(String(c || ''))))
          .filter((c: string): c is string => Boolean(c))
      )
    );
    if (uniquePersonnelCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'حداقل یک نفر از کارکنان واجد شرایط باید انتخاب شود.',
      });
    }

    const uniqueCourseCodes: string[] = Array.from(
      new Set<string>(
        rawCourseCodes
          .map((c: any) => normalizeCourseCode(c))
          .filter((c: string): c is string => Boolean(c))
      )
    );
    if (uniqueCourseCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'حداقل یک دوره آموزشی باید انتخاب شود.',
      });
    }

    if (linkToCalendar && !calendarDate) {
      return res.status(400).json({
        success: false,
        error: 'برای اتصال دوره به تقویم آموزشی، تعیین تاریخ برگزاری الزامی است.',
      });
    }

    if (allowRenewalOverride) {
      if (!canOverrideDuplicateTraining(user)) {
        return res.status(403).json({
          success: false,
          error: 'شما مجوز ثبت تخصیص مجدد (تمدید/آموزش مجدد) برای دوره‌های تکراری را ندارید.',
        });
      }
      if (overrideReason.length < 5) {
        return res.status(400).json({
          success: false,
          error: 'در صورت فعال‌سازی مجوز تمدید یا آموزش مجدد، ثبت دلیل (حداقل ۵ کاراکتر) الزامی است.',
        });
      }
    }

    // Load authoritative personnel list directly from PostgreSQL master personnel repository
    const masterPersonnel: any[] = (await personnelRepository.findAll()) as any[];
    const personnelByKey = new Map<string, any>();
    for (const p of masterPersonnel) {
      const pCode = normalizeCodeKey(p.personnelCode || p.effectiveCode);
      const nCode = normalizeCodeKey(p.nationalCode || p.nationalId);
      if (pCode) personnelByKey.set(pCode, p);
      if (nCode && !personnelByKey.has(nCode)) personnelByKey.set(nCode, p);
    }

    const assignedBy = String(user?.name || user?.username || user?.email || 'کاربر سیستم').trim();
    const assignedByCode = String(user?.personnelCode || '').trim() || undefined;
    const assignedDate = getShamsiToday();
    const assignedAt = new Date().toISOString();
    const batchId = `TRB-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const txResult = await withTransaction(async (tx) => {
      const rawDefs = await readSettingTx(tx, KEY_COURSE_DEFS);
      const courseDefs: TrainingCourseDef[] = Array.isArray(rawDefs) ? rawDefs : [];
      const courseDefMap = new Map<string, TrainingCourseDef>();
      for (const def of courseDefs) {
        const key = normalizeCourseCode(def?.code);
        if (key) courseDefMap.set(key, def);
      }

      const rawCourses = await readSettingTx(tx, KEY_COURSES);
      const existingCourses: TrainingCourseRecord[] = Array.isArray(rawCourses) ? [...rawCourses] : [];

      const rawCalendar = await readSettingTx(tx, KEY_CALENDAR_EVENTS);
      const existingCalendar: TrainingCalendarEvent[] = Array.isArray(rawCalendar) ? [...rawCalendar] : [];

      const rawHistory = await readSettingTx(tx, KEY_BULK_HISTORY);
      const existingHistory: TrainingBulkAssignmentBatch[] = Array.isArray(rawHistory) ? [...rawHistory] : [];

      // Index existing records by personnelCode::courseCode for O(1) authoritative duplicate detection
      const existingIndex = new Map<string, TrainingCourseRecord[]>();
      for (const rec of existingCourses) {
        const pk = normalizeCodeKey(rec.personnelCode);
        const ck = normalizeCourseCode(rec.courseCode);
        if (!pk || !ck) continue;
        const composite = `${pk}::${ck}`;
        const list = existingIndex.get(composite);
        if (list) list.push(rec);
        else existingIndex.set(composite, [rec]);
      }

      const succeededItems: TrainingBulkAssignItemResult[] = [];
      const duplicateItems: TrainingBulkAssignItemResult[] = [];
      const failedItems: TrainingBulkAssignItemResult[] = [];
      const newlyCreatedRecords: TrainingCourseRecord[] = [];
      const courseSuccessCount = new Map<string, number>();
      const personnelAssignedMap = new Map<
        string,
        { personnelCode: string; fullName: string; unit: string; courseCodes: string[] }
      >();

      for (const rawCode of uniquePersonnelCodes) {
        const key = normalizeCodeKey(rawCode);
        const person = personnelByKey.get(key);

        if (!person) {
          for (const courseCode of uniqueCourseCodes) {
            const def = courseDefMap.get(courseCode);
            failedItems.push({
              personnelCode: rawCode,
              fullName: rawCode,
              unit: '-',
              jobTitle,
              courseCode,
              courseTitle: def?.title || courseCode,
              outcome: 'failed',
              reasonCode: 'PERSONNEL_NOT_FOUND',
              message: 'پرسنل با این کد در بانک اطلاعات مرکزی پرسنل یافت نشد.',
            });
          }
          continue;
        }

        const pStatus = extractPersonnelStatus(person);
        const { firstName, lastName, fullName } = extractPersonnelFullName(person);
        const pUnit = extractPersonnelUnit(person);
        const pJobTitle = extractPersonnelJobTitle(person) || jobTitle;
        const canonicalCode = cleanPersonnelCode(
          normalizeDigits(String(person.personnelCode || person.effectiveCode || rawCode))
        );

        if (employmentStatusFilter !== 'all' && pStatus !== employmentStatusFilter) {
          for (const courseCode of uniqueCourseCodes) {
            const def = courseDefMap.get(courseCode);
            failedItems.push({
              personnelCode: canonicalCode,
              fullName,
              unit: pUnit,
              jobTitle: pJobTitle,
              courseCode,
              courseTitle: def?.title || courseCode,
              outcome: 'failed',
              reasonCode: 'INACTIVE_FILTERED',
              message:
                employmentStatusFilter === 'active'
                  ? 'وضعیت اشتغال این فرد در پرونده پرسنلی فعال نیست.'
                  : 'وضعیت اشتغال این فرد با فیلتر انتخاب‌شده مطابقت ندارد.',
            });
          }
          continue;
        }

        for (const courseCode of uniqueCourseCodes) {
          const def = courseDefMap.get(courseCode);
          if (!def) {
            failedItems.push({
              personnelCode: canonicalCode,
              fullName,
              unit: pUnit,
              jobTitle: pJobTitle,
              courseCode,
              courseTitle: courseCode,
              outcome: 'failed',
              reasonCode: 'COURSE_NOT_FOUND',
              message: 'دوره انتخاب‌شده در فهرست دوره‌های تعریف‌شده سامانه یافت نشد.',
            });
            continue;
          }

          const composite = `${normalizeCodeKey(canonicalCode)}::${courseCode}`;
          const prevRecords = existingIndex.get(composite) || [];

          // Active assignment check (assigned / in_progress)
          const activeRec = prevRecords.find(
            (r) => r.status === 'assigned' || r.status === 'in_progress'
          );
          // Valid completed record check (completed or legacy records without status)
          const completedRec = prevRecords.find(
            (r) => !r.status || r.status === 'completed'
          );

          if ((activeRec || completedRec) && !allowRenewalOverride) {
            const matched = activeRec || completedRec;
            const isActive = Boolean(activeRec);
            duplicateItems.push({
              personnelCode: canonicalCode,
              fullName,
              unit: pUnit,
              jobTitle: pJobTitle,
              courseCode,
              courseTitle: def.title,
              outcome: 'duplicate',
              reasonCode: isActive ? 'ACTIVE_ASSIGNMENT' : 'ALREADY_COMPLETED',
              message: isActive
                ? `تخصیص فعال این دوره قبلاً ثبت شده است${matched?.dueDate ? ` (مهلت: ${matched.dueDate})` : ''}.`
                : `سابقه معتبر گذراندن این دوره قبلاً ثبت شده است${matched?.date ? ` (تاریخ: ${matched.date})` : ''}.`,
              existingDate: matched?.date || matched?.assignedDate,
              existingDueDate: matched?.dueDate,
            });
            continue;
          }

          const recordId = `TR-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
          const newRecord: TrainingCourseRecord = {
            id: recordId,
            firstName,
            lastName,
            personnelCode: canonicalCode,
            unit: pUnit,
            jobTitle: pJobTitle,
            courseCode: def.code,
            courseTitle: def.title,
            hours: Number(def.duration) || 0,
            date: '', // Not yet completed; will be set when completed
            status: 'assigned',
            dueDate: dueDate || undefined,
            assignedDate,
            assignedAt,
            assignedBy,
            assignedByCode,
            assignmentBatchId: batchId,
            assignmentSource: 'bulk_job_title',
            isRenewalOverride: Boolean((activeRec || completedRec) && allowRenewalOverride),
            overrideReason:
              (activeRec || completedRec) && allowRenewalOverride ? overrideReason : undefined,
          };

          newlyCreatedRecords.push(newRecord);
          // Keep existingIndex updated so intra-batch duplicates are impossible
          const list = existingIndex.get(composite);
          if (list) list.push(newRecord);
          else existingIndex.set(composite, [newRecord]);

          courseSuccessCount.set(courseCode, (courseSuccessCount.get(courseCode) || 0) + 1);

          const pEntry = personnelAssignedMap.get(canonicalCode);
          if (pEntry) {
            pEntry.courseCodes.push(def.code);
          } else {
            personnelAssignedMap.set(canonicalCode, {
              personnelCode: canonicalCode,
              fullName,
              unit: pUnit,
              courseCodes: [def.code],
            });
          }

          succeededItems.push({
            personnelCode: canonicalCode,
            fullName,
            unit: pUnit,
            jobTitle: pJobTitle,
            courseCode: def.code,
            courseTitle: def.title,
            outcome: 'succeeded',
            reasonCode:
              (activeRec || completedRec) && allowRenewalOverride ? 'RENEWAL_OVERRIDE' : undefined,
            message:
              (activeRec || completedRec) && allowRenewalOverride
                ? `با مجوز تمدید/آموزش مجدد تخصیص یافت (${overrideReason}).`
                : 'دوره با موفقیت به پرونده آموزشی فرد تخصیص یافت.',
            recordId,
          });
        }
      }

      // Optional Training Calendar integration (deduplicated per courseCode + calendarDate)
      const linkedEventIdsByCourse = new Map<string, string>();
      const createdCalendarEventIds: string[] = [];

      if (linkToCalendar && calendarDate && newlyCreatedRecords.length > 0) {
        for (const [courseCode, count] of courseSuccessCount.entries()) {
          if (count <= 0) continue;
          const def = courseDefMap.get(courseCode);
          if (!def) continue;

          const existingEvent = existingCalendar.find(
            (ev) =>
              normalizeCourseCode(ev.courseCode) === courseCode &&
              normalizeForMatching(ev.date) === normalizeForMatching(calendarDate)
          );

          if (existingEvent) {
            existingEvent.assignedCount = (Number(existingEvent.assignedCount) || 0) + count;
            if (!existingEvent.targetJobTitle) existingEvent.targetJobTitle = jobTitle;
            linkedEventIdsByCourse.set(courseCode, existingEvent.id);
            createdCalendarEventIds.push(existingEvent.id);
          } else {
            const eventId = `TCE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
            const newEvent: TrainingCalendarEvent = {
              id: eventId,
              courseCode: def.code,
              title: def.title,
              duration: Number(def.duration) || 0,
              date: calendarDate,
              time: calendarTime || undefined,
              assignmentBatchId: batchId,
              targetJobTitle: jobTitle,
              targetUnit: unitFilter || undefined,
              assignedCount: count,
            };
            existingCalendar.push(newEvent);
            linkedEventIdsByCourse.set(courseCode, eventId);
            createdCalendarEventIds.push(eventId);
          }
        }

        // Attach calendarEventId to newly created records & response items
        for (const rec of newlyCreatedRecords) {
          const evId = linkedEventIdsByCourse.get(normalizeCourseCode(rec.courseCode));
          if (evId) rec.calendarEventId = evId;
        }
        for (const item of succeededItems) {
          const evId = linkedEventIdsByCourse.get(normalizeCourseCode(item.courseCode));
          if (evId) item.calendarEventId = evId;
        }
      }

      const updatedCourses = [...newlyCreatedRecords, ...existingCourses];

      const selectedCourseTitles = uniqueCourseCodes.map(
        (code) => courseDefMap.get(code)?.title || code
      );

      const batchRecord: TrainingBulkAssignmentBatch = {
        batchId,
        assignedDate,
        assignedAt,
        assignedBy,
        assignedByCode,
        jobTitle,
        unitFilter: unitFilter || undefined,
        employmentStatusFilter,
        courseCodes: uniqueCourseCodes,
        courseTitles: selectedCourseTitles,
        dueDate: dueDate || undefined,
        linkedToCalendar: Boolean(linkToCalendar && createdCalendarEventIds.length > 0),
        calendarDate: linkToCalendar && calendarDate ? calendarDate : undefined,
        calendarTime: linkToCalendar && calendarTime ? calendarTime : undefined,
        calendarEventIds: createdCalendarEventIds.length > 0 ? createdCalendarEventIds : undefined,
        allowRenewalOverride,
        overrideReason: allowRenewalOverride ? overrideReason : undefined,
        targetPersonnelCount: uniquePersonnelCodes.length,
        totalRequested: uniquePersonnelCodes.length * uniqueCourseCodes.length,
        succeededCount: succeededItems.length,
        duplicateCount: duplicateItems.length,
        failedCount: failedItems.length,
        assignedPersonnel: Array.from(personnelAssignedMap.values()),
      };

      // Persist changes atomically inside transaction
      if (newlyCreatedRecords.length > 0) {
        await upsertSettingTx(
          tx,
          KEY_COURSES,
          updatedCourses,
          'HSE Personnel Training Courses & Assignments',
          assignedBy
        );
      }

      if (linkToCalendar && createdCalendarEventIds.length > 0) {
        await upsertSettingTx(
          tx,
          KEY_CALENDAR_EVENTS,
          existingCalendar,
          'HSE Training Calendar Events',
          assignedBy
        );
      }

      // Always record the batch attempt in bulk assignment history for auditability
      const updatedHistory = [batchRecord, ...existingHistory].slice(0, 200);
      await upsertSettingTx(
        tx,
        KEY_BULK_HISTORY,
        updatedHistory,
        'HSE Bulk Training Assignments Audit History',
        assignedBy
      );

      return {
        updatedCourses,
        updatedCalendarEvents: existingCalendar,
        updatedHistory,
        batchRecord,
        succeededItems,
        duplicateItems,
        failedItems,
        calendarEventsLinked: createdCalendarEventIds.length,
      };
    });

    // Sync in-memory caches & broadcast real-time mutation
    syncSettingsMemoryCache(KEY_COURSES, txResult.updatedCourses);
    syncSettingsMemoryCache(KEY_CALENDAR_EVENTS, txResult.updatedCalendarEvents);
    syncSettingsMemoryCache(KEY_BULK_HISTORY, txResult.updatedHistory);
    invalidateDashboardCache();

    await auditService
      .log({
        action: 'BULK_ASSIGN_TRAINING',
        module: 'TRAINING',
        entityType: 'training',
        entityId: batchId,
        personnelCode: assignedByCode,
        details: {
          actor: assignedBy,
          jobTitle,
          unitFilter: unitFilter || null,
          employmentStatusFilter,
          courseCodes: uniqueCourseCodes,
          dueDate: dueDate || null,
          linkedToCalendar: txResult.batchRecord.linkedToCalendar,
          allowRenewalOverride,
          overrideReason: allowRenewalOverride ? overrideReason : null,
          succeeded: txResult.succeededItems.length,
          duplicates: txResult.duplicateItems.length,
          failed: txResult.failedItems.length,
        },
      })
      .catch(() => {});

    broadcastDataMutation('training', 'bulk_assign', {
      batchId,
      jobTitle,
      succeededCount: txResult.succeededItems.length,
    });

    return res.json({
      success: true,
      data: {
        batchId,
        assignedDate,
        assignedAt,
        assignedBy,
        summary: {
          targetPersonnelCount: uniquePersonnelCodes.length,
          coursesCount: uniqueCourseCodes.length,
          totalRequested: uniquePersonnelCodes.length * uniqueCourseCodes.length,
          succeeded: txResult.succeededItems.length,
          skippedDuplicates: txResult.duplicateItems.length,
          failed: txResult.failedItems.length,
          calendarEventsLinked: txResult.calendarEventsLinked,
        },
        succeededItems: txResult.succeededItems,
        duplicateItems: txResult.duplicateItems,
        failedItems: txResult.failedItems,
        batchRecord: txResult.batchRecord,
        updatedCourses: txResult.updatedCourses,
        updatedCalendarEvents: txResult.updatedCalendarEvents,
      },
    });
  } catch (err: any) {
    logger.error('[Training] Bulk assignment failed', { error: err?.message });
    return res.status(500).json({
      success: false,
      error: err?.message || 'خطا در اجرای تخصیص گروهی دوره‌های آموزشی',
    });
  }
});

// ============================================================================
// PATCH /api/v1/training/records/:recordId/complete
// Marks an assigned training record as completed with completion date
// ============================================================================
trainingRouter.patch('/records/:recordId/complete', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canBulkAssignTraining(user)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز ثبت اتمام دوره آموزشی را ندارید.',
      });
    }

    const recordId = String(req.params.recordId || '').trim();
    const completionDate = String(req.body?.date || getShamsiToday()).trim();
    const actor = String(user?.name || user?.username || 'کاربر سیستم').trim();

    if (!recordId) {
      return res.status(400).json({ success: false, error: 'شناسه رکورد آموزشی نامعتبر است.' });
    }

    const txResult = await withTransaction(async (tx) => {
      const rawCourses = await readSettingTx(tx, KEY_COURSES);
      const courses: TrainingCourseRecord[] = Array.isArray(rawCourses) ? [...rawCourses] : [];
      const idx = courses.findIndex((c) => String(c.id) === recordId);
      if (idx === -1) return null;

      const updated: TrainingCourseRecord = {
        ...courses[idx],
        status: 'completed',
        date: completionDate,
        completedBy: actor,
        completedAt: new Date().toISOString(),
      };
      courses[idx] = updated;

      await upsertSettingTx(
        tx,
        KEY_COURSES,
        courses,
        'HSE Personnel Training Courses & Assignments',
        actor
      );
      return { updatedRecord: updated, updatedCourses: courses };
    });

    if (!txResult) {
      return res.status(404).json({ success: false, error: 'رکورد آموزشی موردنظر یافت نشد.' });
    }

    syncSettingsMemoryCache(KEY_COURSES, txResult.updatedCourses);
    invalidateDashboardCache();

    await auditService
      .log({
        action: 'COMPLETE_TRAINING_ASSIGNMENT',
        module: 'TRAINING',
        entityType: 'training',
        entityId: recordId,
        personnelCode: txResult.updatedRecord.personnelCode,
        details: {
          actor,
          courseCode: txResult.updatedRecord.courseCode,
          completionDate,
        },
      })
      .catch(() => {});

    broadcastDataMutation('training', 'complete', { recordId });

    return res.json({
      success: true,
      data: txResult,
    });
  } catch (err: any) {
    logger.error('[Training] Failed to complete training assignment', { error: err?.message });
    return res.status(500).json({ success: false, error: 'خطا در ثبت اتمام دوره آموزشی' });
  }
});

// ============================================================================
// CONTRACTOR INDIVIDUAL TRAINING RECORDS, SMART COMPANY REGISTRY & AUDIT TRAIL
// ============================================================================

function mergeContractorCompanyList(
  existingCompanies: ContractorCompany[],
  records: ContractorTrainingRecord[],
  legacyContractors: LegacyContractorSummary[]
): ContractorCompany[] {
  const map = new Map<string, ContractorCompany>();

  (Array.isArray(existingCompanies) ? existingCompanies : []).forEach((c) => {
    const cleanName = cleanContractorDisplayName(c?.name);
    const key = normalizeContractorCompanyKey(cleanName);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        id: String(c.id || `cmp-${key}`),
        name: cleanName,
        normalizedKey: key,
        createdAt: c.createdAt || new Date().toISOString(),
        createdBy: c.createdBy,
      });
    }
  });

  (Array.isArray(records) ? records : []).forEach((r) => {
    const cleanName = cleanContractorDisplayName(r?.companyName);
    const key = normalizeContractorCompanyKey(cleanName);
    if (!key || map.has(key)) return;
    map.set(key, {
      id: String(r.companyId || `cmp-${key}`),
      name: cleanName,
      normalizedKey: key,
      createdAt: r.createdAt || new Date().toISOString(),
      createdBy: r.createdBy,
    });
  });

  (Array.isArray(legacyContractors) ? legacyContractors : []).forEach((leg) => {
    const cleanName = cleanContractorDisplayName(leg?.name);
    const key = normalizeContractorCompanyKey(cleanName);
    if (!key || map.has(key)) return;
    map.set(key, {
      id: String(leg.id || `cmp-${key}`),
      name: cleanName,
      normalizedKey: key,
      createdAt: new Date().toISOString(),
    });
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

function validateContractorRecordBody(body: any): {
  valid: boolean;
  error?: string;
  companyName: string;
  companyKey: string;
  personnelFullName: string;
  jobTitle: string;
  trainingHours: number;
  trainingDate: string;
  courseTitle: string;
  notes: string;
} {
  const companyName = cleanContractorDisplayName(body?.companyName).slice(0, 200);
  const companyKey = normalizeContractorCompanyKey(companyName);
  const personnelFullName = cleanContractorDisplayName(body?.personnelFullName).slice(0, 160);
  const jobTitle = cleanContractorDisplayName(body?.jobTitle).slice(0, 160);
  const trainingHours = parseTrainingHours(body?.trainingHours);
  const trainingDate = normalizeDigits(String(body?.trainingDate || '')).trim().slice(0, 32);
  const courseTitle = cleanContractorDisplayName(body?.courseTitle).slice(0, 200);
  const notes = cleanContractorDisplayName(body?.notes).slice(0, 500);

  if (!companyName || !companyKey) {
    return {
      valid: false,
      error: 'وارد کردن نام شرکت یا پیمانکار الزامی است.',
      companyName,
      companyKey,
      personnelFullName,
      jobTitle,
      trainingHours,
      trainingDate,
      courseTitle,
      notes,
    };
  }
  if (!personnelFullName) {
    return {
      valid: false,
      error: 'وارد کردن نام و نام خانوادگی پرسنل آموزش‌دیده الزامی است.',
      companyName,
      companyKey,
      personnelFullName,
      jobTitle,
      trainingHours,
      trainingDate,
      courseTitle,
      notes,
    };
  }
  if (!jobTitle) {
    return {
      valid: false,
      error: 'وارد کردن سمت شغلی الزامی است.',
      companyName,
      companyKey,
      personnelFullName,
      jobTitle,
      trainingHours,
      trainingDate,
      courseTitle,
      notes,
    };
  }
  if (!trainingHours || trainingHours <= 0 || trainingHours > 500) {
    return {
      valid: false,
      error: 'ساعت سرانه آموزشی باید عددی معتبر و بزرگ‌تر از صفر (حداکثر ۵۰۰ ساعت) باشد.',
      companyName,
      companyKey,
      personnelFullName,
      jobTitle,
      trainingHours,
      trainingDate,
      courseTitle,
      notes,
    };
  }
  if (!trainingDate || toComparableJalaliNumber(trainingDate) === null) {
    return {
      valid: false,
      error: 'وارد کردن تاریخ آموزش معتبر (مثال: ۱۴۰۵/۰۲/۱۵) الزامی است.',
      companyName,
      companyKey,
      personnelFullName,
      jobTitle,
      trainingHours,
      trainingDate,
      courseTitle,
      notes,
    };
  }

  return {
    valid: true,
    companyName,
    companyKey,
    personnelFullName,
    jobTitle,
    trainingHours,
    trainingDate,
    courseTitle,
    notes,
  };
}

// ============================================================================
// GET /api/v1/training/contractor-records
// Returns individual records, deduplicated contractor company registry,
// audit history, and synced legacy summary array.
// ============================================================================
trainingRouter.get('/contractor-records', requireAuth, async (_req, res) => {
  try {
    const [recordsRows, companiesRows, auditRows, legacyRows] = await withDbRetry(() =>
      Promise.all([
        db.select().from(systemSettings).where(eq(systemSettings.key, KEY_CONTRACTOR_RECORDS)).limit(1),
        db.select().from(systemSettings).where(eq(systemSettings.key, KEY_CONTRACTOR_COMPANIES)).limit(1),
        db.select().from(systemSettings).where(eq(systemSettings.key, KEY_CONTRACTOR_AUDIT)).limit(1),
        db.select().from(systemSettings).where(eq(systemSettings.key, KEY_LEGACY_CONTRACTORS)).limit(1),
      ])
    );

    const records: ContractorTrainingRecord[] = Array.isArray(recordsRows[0]?.value)
      ? recordsRows[0].value
      : [];
    const savedCompanies: ContractorCompany[] = Array.isArray(companiesRows[0]?.value)
      ? companiesRows[0].value
      : [];
    const auditHistory: ContractorTrainingAuditEntry[] = Array.isArray(auditRows[0]?.value)
      ? auditRows[0].value
      : [];
    const legacyContractors: LegacyContractorSummary[] = Array.isArray(legacyRows[0]?.value)
      ? legacyRows[0].value
      : [];

    const companies = mergeContractorCompanyList(savedCompanies, records, legacyContractors);
    const syncedContractors = buildSyncedLegacyContractors(records, companies, legacyContractors);

    return res.json({
      success: true,
      data: {
        records,
        companies,
        auditHistory,
        syncedContractors,
      },
    });
  } catch (err: any) {
    logger.error('[Training] Failed to load contractor training records', { error: err?.message });
    return res.status(500).json({
      success: false,
      error: 'خطا در دریافت اطلاعات آموزش شرکت‌ها و پیمانکاران',
    });
  }
});

// ============================================================================
// POST /api/v1/training/contractor-records
// Creates a new individual contractor personnel training record, auto-registers
// or deduplicates the contractor company, syncs legacy summaries, and logs audit.
// ============================================================================
trainingRouter.post('/contractor-records', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canBulkAssignTraining(user)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز ثبت سوابق آموزشی شرکت‌ها و پیمانکاران را ندارید.',
      });
    }

    const parsed = validateContractorRecordBody(req.body);
    if (!parsed.valid) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const actorName = String(user?.name || user?.username || 'کاربر سیستم').trim();
    const actorRole = String(user?.role || '').trim();
    const nowIso = new Date().toISOString();
    const todayFa = getShamsiToday();

    const txResult = await withTransaction(async (tx) => {
      const rawRecords = await readSettingTx(tx, KEY_CONTRACTOR_RECORDS);
      const rawCompanies = await readSettingTx(tx, KEY_CONTRACTOR_COMPANIES);
      const rawAudit = await readSettingTx(tx, KEY_CONTRACTOR_AUDIT);
      const rawLegacy = await readSettingTx(tx, KEY_LEGACY_CONTRACTORS);

      const records: ContractorTrainingRecord[] = Array.isArray(rawRecords) ? [...rawRecords] : [];
      const legacyList: LegacyContractorSummary[] = Array.isArray(rawLegacy) ? [...rawLegacy] : [];
      const companies = mergeContractorCompanyList(
        Array.isArray(rawCompanies) ? rawCompanies : [],
        records,
        legacyList
      );
      const auditHistory: ContractorTrainingAuditEntry[] = Array.isArray(rawAudit) ? [...rawAudit] : [];

      // Deduplicate contractor company using canonical normalized key
      let company = companies.find((c) => c.normalizedKey === parsed.companyKey);
      let matchedExistingCompany = Boolean(company);
      if (!company) {
        company = {
          id: `cmp-${crypto.randomUUID().slice(0, 12)}`,
          name: parsed.companyName,
          normalizedKey: parsed.companyKey,
          createdAt: nowIso,
          createdBy: actorName,
        };
        companies.push(company);
        companies.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
      }

      const newRecord: ContractorTrainingRecord = {
        id: `ctr-${crypto.randomUUID().slice(0, 12)}`,
        companyId: company.id,
        companyName: company.name,
        personnelFullName: parsed.personnelFullName,
        jobTitle: parsed.jobTitle,
        trainingHours: parsed.trainingHours,
        trainingDate: parsed.trainingDate,
        courseTitle: parsed.courseTitle || undefined,
        notes: parsed.notes || undefined,
        createdAt: nowIso,
        createdBy: actorName,
      };

      const nextRecords = [newRecord, ...records];
      const nextSyncedContractors = buildSyncedLegacyContractors(nextRecords, companies, legacyList);

      const auditEntry: ContractorTrainingAuditEntry = {
        id: `caud-${crypto.randomUUID().slice(0, 12)}`,
        action: 'CREATE',
        recordId: newRecord.id,
        companyName: company.name,
        personnelFullName: newRecord.personnelFullName,
        actorName,
        actorRole,
        timestamp: nowIso,
        dateFa: todayFa,
        summary: `ثبت سابقه آموزشی ${newRecord.personnelFullName} (${newRecord.jobTitle}) برای ${company.name} به مدت ${newRecord.trainingHours} ساعت در تاریخ ${newRecord.trainingDate}`,
        after: newRecord,
      };
      const nextAudit = [auditEntry, ...auditHistory].slice(0, 500);

      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_RECORDS,
        nextRecords,
        'HSE Individual Contractor Personnel Training Records',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_COMPANIES,
        companies,
        'HSE Deduplicated Contractor Companies Directory',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_AUDIT,
        nextAudit,
        'HSE Contractor Training Change Audit Log',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_LEGACY_CONTRACTORS,
        nextSyncedContractors,
        'HSE Training Contractors Aggregated Summary (Auto-Synced)',
        actorName
      );

      return {
        record: newRecord,
        matchedExistingCompany,
        records: nextRecords,
        companies,
        auditHistory: nextAudit,
        syncedContractors: nextSyncedContractors,
      };
    });

    syncSettingsMemoryCache(KEY_CONTRACTOR_RECORDS, txResult.records);
    syncSettingsMemoryCache(KEY_CONTRACTOR_COMPANIES, txResult.companies);
    syncSettingsMemoryCache(KEY_CONTRACTOR_AUDIT, txResult.auditHistory);
    syncSettingsMemoryCache(KEY_LEGACY_CONTRACTORS, txResult.syncedContractors);
    invalidateDashboardCache();

    await auditService
      .log({
        action: 'CREATE_CONTRACTOR_TRAINING_RECORD',
        module: 'TRAINING',
        entityType: 'training',
        entityId: txResult.record.id,
        details: {
          actorName,
          companyName: txResult.record.companyName,
          personnelFullName: txResult.record.personnelFullName,
          trainingHours: txResult.record.trainingHours,
          trainingDate: txResult.record.trainingDate,
        },
      })
      .catch(() => {});

    broadcastDataMutation('training', 'contractor_create', { recordId: txResult.record.id });

    return res.status(201).json({
      success: true,
      data: txResult,
    });
  } catch (err: any) {
    logger.error('[Training] Failed to create contractor training record', { error: err?.message });
    return res.status(500).json({
      success: false,
      error: 'خطا در ثبت سابقه آموزشی پرسنل پیمانکار',
    });
  }
});

// ============================================================================
// PUT /api/v1/training/contractor-records/:recordId
// Updates an existing individual contractor personnel training record with
// company deduplication, legacy summary re-sync, and before/after audit trail.
// ============================================================================
trainingRouter.put('/contractor-records/:recordId', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canBulkAssignTraining(user)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز ویرایش سوابق آموزشی شرکت‌ها و پیمانکاران را ندارید.',
      });
    }

    const recordId = String(req.params.recordId || '').trim();
    if (!recordId) {
      return res.status(400).json({ success: false, error: 'شناسه رکورد نامعتبر است.' });
    }

    const parsed = validateContractorRecordBody(req.body);
    if (!parsed.valid) {
      return res.status(400).json({ success: false, error: parsed.error });
    }

    const actorName = String(user?.name || user?.username || 'کاربر سیستم').trim();
    const actorRole = String(user?.role || '').trim();
    const nowIso = new Date().toISOString();
    const todayFa = getShamsiToday();

    const txResult = await withTransaction(async (tx) => {
      const rawRecords = await readSettingTx(tx, KEY_CONTRACTOR_RECORDS);
      const rawCompanies = await readSettingTx(tx, KEY_CONTRACTOR_COMPANIES);
      const rawAudit = await readSettingTx(tx, KEY_CONTRACTOR_AUDIT);
      const rawLegacy = await readSettingTx(tx, KEY_LEGACY_CONTRACTORS);

      const records: ContractorTrainingRecord[] = Array.isArray(rawRecords) ? [...rawRecords] : [];
      const idx = records.findIndex((r) => String(r.id) === recordId);
      if (idx === -1) return null;

      const beforeRecord = { ...records[idx] };
      const legacyList: LegacyContractorSummary[] = Array.isArray(rawLegacy) ? [...rawLegacy] : [];
      const companies = mergeContractorCompanyList(
        Array.isArray(rawCompanies) ? rawCompanies : [],
        records,
        legacyList
      );
      const auditHistory: ContractorTrainingAuditEntry[] = Array.isArray(rawAudit) ? [...rawAudit] : [];

      let company = companies.find((c) => c.normalizedKey === parsed.companyKey);
      if (!company) {
        company = {
          id: `cmp-${crypto.randomUUID().slice(0, 12)}`,
          name: parsed.companyName,
          normalizedKey: parsed.companyKey,
          createdAt: nowIso,
          createdBy: actorName,
        };
        companies.push(company);
        companies.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
      }

      const updatedRecord: ContractorTrainingRecord = {
        ...beforeRecord,
        companyId: company.id,
        companyName: company.name,
        personnelFullName: parsed.personnelFullName,
        jobTitle: parsed.jobTitle,
        trainingHours: parsed.trainingHours,
        trainingDate: parsed.trainingDate,
        courseTitle: parsed.courseTitle || undefined,
        notes: parsed.notes || undefined,
        updatedAt: nowIso,
        updatedBy: actorName,
      };

      records[idx] = updatedRecord;
      const nextSyncedContractors = buildSyncedLegacyContractors(records, companies, legacyList);

      const auditEntry: ContractorTrainingAuditEntry = {
        id: `caud-${crypto.randomUUID().slice(0, 12)}`,
        action: 'UPDATE',
        recordId: updatedRecord.id,
        companyName: company.name,
        personnelFullName: updatedRecord.personnelFullName,
        actorName,
        actorRole,
        timestamp: nowIso,
        dateFa: todayFa,
        summary: `ویرایش سابقه آموزشی ${updatedRecord.personnelFullName} (${company.name}) — ساعت: ${beforeRecord.trainingHours} ← ${updatedRecord.trainingHours}، تاریخ: ${beforeRecord.trainingDate} ← ${updatedRecord.trainingDate}`,
        before: beforeRecord,
        after: updatedRecord,
      };
      const nextAudit = [auditEntry, ...auditHistory].slice(0, 500);

      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_RECORDS,
        records,
        'HSE Individual Contractor Personnel Training Records',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_COMPANIES,
        companies,
        'HSE Deduplicated Contractor Companies Directory',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_AUDIT,
        nextAudit,
        'HSE Contractor Training Change Audit Log',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_LEGACY_CONTRACTORS,
        nextSyncedContractors,
        'HSE Training Contractors Aggregated Summary (Auto-Synced)',
        actorName
      );

      return {
        record: updatedRecord,
        records,
        companies,
        auditHistory: nextAudit,
        syncedContractors: nextSyncedContractors,
      };
    });

    if (!txResult) {
      return res.status(404).json({ success: false, error: 'رکورد آموزشی موردنظر یافت نشد.' });
    }

    syncSettingsMemoryCache(KEY_CONTRACTOR_RECORDS, txResult.records);
    syncSettingsMemoryCache(KEY_CONTRACTOR_COMPANIES, txResult.companies);
    syncSettingsMemoryCache(KEY_CONTRACTOR_AUDIT, txResult.auditHistory);
    syncSettingsMemoryCache(KEY_LEGACY_CONTRACTORS, txResult.syncedContractors);
    invalidateDashboardCache();

    await auditService
      .log({
        action: 'UPDATE_CONTRACTOR_TRAINING_RECORD',
        module: 'TRAINING',
        entityType: 'training',
        entityId: recordId,
        details: {
          actorName,
          companyName: txResult.record.companyName,
          personnelFullName: txResult.record.personnelFullName,
          trainingHours: txResult.record.trainingHours,
        },
      })
      .catch(() => {});

    broadcastDataMutation('training', 'contractor_update', { recordId });

    return res.json({
      success: true,
      data: txResult,
    });
  } catch (err: any) {
    logger.error('[Training] Failed to update contractor training record', { error: err?.message });
    return res.status(500).json({
      success: false,
      error: 'خطا در ویرایش سابقه آموزشی پرسنل پیمانکار',
    });
  }
});

// ============================================================================
// DELETE /api/v1/training/contractor-records/:recordId
// Deletes an individual contractor personnel training record, re-computes
// legacy summary sync, and records full deleted snapshot in audit history.
// ============================================================================
trainingRouter.delete('/contractor-records/:recordId', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (!canBulkAssignTraining(user)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز حذف سوابق آموزشی شرکت‌ها و پیمانکاران را ندارید.',
      });
    }

    const recordId = String(req.params.recordId || '').trim();
    if (!recordId) {
      return res.status(400).json({ success: false, error: 'شناسه رکورد نامعتبر است.' });
    }

    const actorName = String(user?.name || user?.username || 'کاربر سیستم').trim();
    const actorRole = String(user?.role || '').trim();
    const nowIso = new Date().toISOString();
    const todayFa = getShamsiToday();

    const txResult = await withTransaction(async (tx) => {
      const rawRecords = await readSettingTx(tx, KEY_CONTRACTOR_RECORDS);
      const rawCompanies = await readSettingTx(tx, KEY_CONTRACTOR_COMPANIES);
      const rawAudit = await readSettingTx(tx, KEY_CONTRACTOR_AUDIT);
      const rawLegacy = await readSettingTx(tx, KEY_LEGACY_CONTRACTORS);

      const records: ContractorTrainingRecord[] = Array.isArray(rawRecords) ? [...rawRecords] : [];
      const idx = records.findIndex((r) => String(r.id) === recordId);
      if (idx === -1) return null;

      const deletedRecord = records[idx];
      const nextRecords = records.filter((r) => String(r.id) !== recordId);
      const legacyList: LegacyContractorSummary[] = Array.isArray(rawLegacy) ? [...rawLegacy] : [];
      const companies = mergeContractorCompanyList(
        Array.isArray(rawCompanies) ? rawCompanies : [],
        nextRecords,
        legacyList
      );
      const auditHistory: ContractorTrainingAuditEntry[] = Array.isArray(rawAudit) ? [...rawAudit] : [];
      const nextSyncedContractors = buildSyncedLegacyContractors(nextRecords, companies, legacyList);

      const auditEntry: ContractorTrainingAuditEntry = {
        id: `caud-${crypto.randomUUID().slice(0, 12)}`,
        action: 'DELETE',
        recordId: deletedRecord.id,
        companyName: deletedRecord.companyName,
        personnelFullName: deletedRecord.personnelFullName,
        actorName,
        actorRole,
        timestamp: nowIso,
        dateFa: todayFa,
        summary: `حذف سابقه آموزشی ${deletedRecord.personnelFullName} (${deletedRecord.jobTitle}) از ${deletedRecord.companyName} (${deletedRecord.trainingHours} ساعت - تاریخ ${deletedRecord.trainingDate})`,
        before: deletedRecord,
      };
      const nextAudit = [auditEntry, ...auditHistory].slice(0, 500);

      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_RECORDS,
        nextRecords,
        'HSE Individual Contractor Personnel Training Records',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_CONTRACTOR_AUDIT,
        nextAudit,
        'HSE Contractor Training Change Audit Log',
        actorName
      );
      await upsertSettingTx(
        tx,
        KEY_LEGACY_CONTRACTORS,
        nextSyncedContractors,
        'HSE Training Contractors Aggregated Summary (Auto-Synced)',
        actorName
      );

      return {
        deletedRecord,
        records: nextRecords,
        companies,
        auditHistory: nextAudit,
        syncedContractors: nextSyncedContractors,
      };
    });

    if (!txResult) {
      return res.status(404).json({ success: false, error: 'رکورد آموزشی موردنظر یافت نشد.' });
    }

    syncSettingsMemoryCache(KEY_CONTRACTOR_RECORDS, txResult.records);
    syncSettingsMemoryCache(KEY_CONTRACTOR_AUDIT, txResult.auditHistory);
    syncSettingsMemoryCache(KEY_LEGACY_CONTRACTORS, txResult.syncedContractors);
    invalidateDashboardCache();

    await auditService
      .log({
        action: 'DELETE_CONTRACTOR_TRAINING_RECORD',
        module: 'TRAINING',
        entityType: 'training',
        entityId: recordId,
        details: {
          actorName,
          companyName: txResult.deletedRecord.companyName,
          personnelFullName: txResult.deletedRecord.personnelFullName,
          trainingHours: txResult.deletedRecord.trainingHours,
        },
      })
      .catch(() => {});

    broadcastDataMutation('training', 'contractor_delete', { recordId });

    return res.json({
      success: true,
      data: txResult,
    });
  } catch (err: any) {
    logger.error('[Training] Failed to delete contractor training record', { error: err?.message });
    return res.status(500).json({
      success: false,
      error: 'خطا در حذف سابقه آموزشی پرسنل پیمانکار',
    });
  }
});

