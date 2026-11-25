import { createNonConformance, updateNonConformance } from '../../db-services.ts';
import { notificationService } from '../notifications/notification.service.ts';
import { UserContext } from '../../core/middleware/auth.ts';

export const RHS_F34_DEADLINE_DAYS = 10;
export const RHS_F34_NEAR_DEADLINE_DAYS = 3;
export const RHS_F34_NC_SOURCE_MODULE = 'incident_rhs_f34';
export const RHS_F34_NC_DEFAULT_TITLE = 'عدم تکمیل تجزیه و تحلیل حادثه در مهلت مقرر';

function normalizeDigits(input: string): string {
  return String(input || '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

export function getCurrentJalaliDateServer(): string {
  try {
    const parts = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return normalizeDigits(parts).replace(/[.\-]/g, '/');
  } catch {
    return '1405/01/01';
  }
}

export function getCurrentJalaliDateTimeServer(): string {
  try {
    const d = getCurrentJalaliDateServer();
    const t = normalizeDigits(
      new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date())
    );
    return `${d} - ${t}`;
  } catch {
    return `${getCurrentJalaliDateServer()} - 00:00`;
  }
}

export function parseJalaliDateServer(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = normalizeDigits(dateStr).trim().replace(/[.\-]/g, '/');
  const match = clean.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

function isJalaliLeapYear(year: number): boolean {
  // Standard 33-year Persian leap cycle
  const mod = ((year - 474) % 2820 + 2820) % 2820;
  return (((mod + 474 + 38) * 682) % 2816) < 682;
}

function jalaliMonthLength(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

export function jalaliToAbsoluteDay(year: number, month: number, day: number): number {
  // Count days from Jalali epoch 1300/01/01 accurately
  let total = 0;
  if (year >= 1300) {
    for (let y = 1300; y < year; y++) {
      total += isJalaliLeapYear(y) ? 366 : 365;
    }
  } else {
    for (let y = year; y < 1300; y++) {
      total -= isJalaliLeapYear(y) ? 366 : 365;
    }
  }
  for (let m = 1; m < month; m++) {
    total += jalaliMonthLength(year, m);
  }
  total += day - 1;
  return total;
}

export function addDaysToJalaliServer(dateStr: string, daysToAdd: number): string {
  const parsed = parseJalaliDateServer(dateStr);
  if (!parsed) return dateStr;
  let { year, month, day } = parsed;
  day += Math.round(daysToAdd);

  while (day > jalaliMonthLength(year, month)) {
    day -= jalaliMonthLength(year, month);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  while (day < 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    day += jalaliMonthLength(year, month);
  }
  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

export interface RhsF34DeadlineResult {
  startDate: string;
  deadlineDate: string;
  daysPassed: number;
  daysRemaining: number;
  isNearDeadline: boolean;
  isExpired: boolean;
  computedStatus: 'not_started' | 'in_progress' | 'pending_approval' | 'returned' | 'completed' | 'expired';
}

export function computeRhsF34Deadline(
  anchorJalaliDate?: string,
  currentStatus?: string,
  workflowStage?: string,
  anchorIso?: string
): RhsF34DeadlineResult {
  const todayJalali = getCurrentJalaliDateServer();
  const normalizedStart = parseJalaliDateServer(anchorJalaliDate)
    ? (() => {
        const p = parseJalaliDateServer(anchorJalaliDate)!;
        return `${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`;
      })()
    : todayJalali;

  const startParsed = parseJalaliDateServer(normalizedStart)!;
  const todayParsed = parseJalaliDateServer(todayJalali)!;

  let daysPassed = jalaliToAbsoluteDay(todayParsed.year, todayParsed.month, todayParsed.day) -
    jalaliToAbsoluteDay(startParsed.year, startParsed.month, startParsed.day);

  // If ISO anchor is provided and matches the same Jalali calendar day, verify consistency without overriding backdated Jalali dates
  if (anchorIso && !Number.isNaN(Date.parse(anchorIso)) && daysPassed === 0) {
    const diffMs = Date.now() - Date.parse(anchorIso);
    const isoDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (isoDays > 0) {
      daysPassed = isoDays;
    }
  }

  daysPassed = Math.max(0, daysPassed);
  const daysRemaining = RHS_F34_DEADLINE_DAYS - daysPassed;
  const deadlineDate = addDaysToJalaliServer(normalizedStart, RHS_F34_DEADLINE_DAYS);

  const isCompleted = currentStatus === 'completed' || workflowStage === 'COMPLETED';
  const isExpired = !isCompleted && daysRemaining < 0;
  const isNearDeadline = !isCompleted && !isExpired && daysRemaining <= RHS_F34_NEAR_DEADLINE_DAYS;

  let computedStatus: RhsF34DeadlineResult['computedStatus'] =
    (currentStatus as any) || 'not_started';

  if (isCompleted) {
    computedStatus = 'completed';
  } else if (isExpired) {
    computedStatus = 'expired';
  } else if (workflowStage === 'PENDING_APPROVAL') {
    computedStatus = 'pending_approval';
  } else if (workflowStage === 'RETURNED') {
    computedStatus = 'returned';
  } else if (workflowStage === 'IN_PROGRESS') {
    computedStatus = 'in_progress';
  } else if (
    computedStatus !== 'in_progress' &&
    computedStatus !== 'pending_approval' &&
    computedStatus !== 'returned'
  ) {
    computedStatus = 'not_started';
  }

  return {
    startDate: normalizedStart,
    deadlineDate,
    daysPassed,
    daysRemaining,
    isNearDeadline,
    isExpired,
    computedStatus,
  };
}

function buildF34FormNumber(incident: any, anchorDate: string): string {
  const parsed = parseJalaliDateServer(anchorDate);
  const year = parsed ? String(parsed.year) : getCurrentJalaliDateServer().slice(0, 4);
  const reportNum = String(incident?.reportNumber || incident?.incidentNumber || '');
  const seqMatch = reportNum.match(/(\d+)\s*$/);
  const seq = seqMatch ? String(parseInt(seqMatch[1], 10)) : String(incident?.id || Math.floor(1 + Math.random() * 99));
  return `RGC-HSE/${year}-${seq}`;
}

/**
 * Automatically creates an RHS-F34 incident analysis record linked to an approved RHS-F28 incident.
 * All shared data from RHS-F28 is pre-populated to prevent duplicate data entry.
 * Deadline is strictly anchored on RHS-F28 final approval date + 10 calendar days.
 */
export function buildAutoRhsF34FromF28(params: {
  incident: any;
  f28: any;
  approverUser?: UserContext;
  approvedDateJalali?: string;
  approvedAtIso?: string;
  assignedExpertCode?: string;
  assignedExpertName?: string;
}): any {
  const { incident, f28, approverUser } = params;
  const approvedDate =
    parseJalaliDateServer(params.approvedDateJalali || f28?.hseCenterHeadSignedDate)
      ? (() => {
          const p = parseJalaliDateServer(params.approvedDateJalali || f28?.hseCenterHeadSignedDate)!;
          return `${p.year}/${String(p.month).padStart(2, '0')}/${String(p.day).padStart(2, '0')}`;
        })()
      : getCurrentJalaliDateServer();
  const approvedAtIso = params.approvedAtIso || new Date().toISOString();
  const deadline = computeRhsF34Deadline(approvedDate, 'not_started', 'PENDING_ANALYSIS', approvedAtIso);
  const nowStr = getCurrentJalaliDateTimeServer();

  const reportNumber = String(incident?.reportNumber || incident?.incidentNumber || `INC-${incident?.id || ''}`);
  const reporterName = String(f28?.reporterName || incident?.reporterName || '').trim();
  const reporterCode = String(f28?.reporterPersonnelCode || incident?.reporterPersonnelCode || '').trim();
  const reporterRolePart = f28?.department || incident?.department || '';
  const reporterNameAndRole = [reporterName, reporterCode ? `(${reporterCode})` : '', reporterRolePart ? `- ${reporterRolePart}` : '']
    .filter(Boolean)
    .join(' ');

  const injuredName = String(f28?.injuredPersonName || incident?.injuredPersonName || '').trim();
  const injuredCode = String(f28?.injuredPersonCode || incident?.injuredPersonCode || '').trim();
  const injuredBodyPart = String(f28?.injuredBodyPart || '').trim();
  const department = String(f28?.department || incident?.department || '').trim();
  const locationSite = String(f28?.locationSite || incident?.locationSite || incident?.location || '').trim();
  const exactLocation = String(f28?.exactLocation || incident?.exactLocation || locationSite).trim();

  const expertName = String(params.assignedExpertName || '').trim();
  const expertCode = String(params.assignedExpertCode || '').trim();

  return {
    id: `rhs-f34-${incident?.id || reportNumber}`,
    incidentId: String(incident?.id || reportNumber),
    incidentReportNumber: reportNumber,

    formCode: 'RHS – F34',
    revision: '00',
    formNumber: buildF34FormNumber(incident, approvedDate),
    formDate: deadline.deadlineDate.replace(/\//g, '.'),
    distributionList: 'توزیع نسخ: ۱- مدیریت امور مجتمع  ۲- واحد HSE  ۳- امور اداری',

    // Auto-populated shared fields from RHS-F28
    eventDate: String(f28?.observationDate || incident?.eventDate || incident?.incidentDate || '').trim(),
    eventTime: String(f28?.observationTime || incident?.eventTime || incident?.incidentTime || '').trim(),
    exactLocation,
    reportDate: String(f28?.reportDate || incident?.reportDate || '').trim(),
    reportTime: String(f28?.observationTime || incident?.eventTime || '').trim(),
    locationOccurrence: locationSite,
    reporterNameAndRole,
    victimOrgUnit: department,
    activityDuringIncident: String(f28?.injuredPersonJobTitle || '').trim(),
    victimCount: injuredName ? 1 : 0,

    estimatedLoss: String(f28?.damagesOrInjuries || '').trim(),
    briefDescription: String(f28?.description || incident?.description || '').trim(),
    riskSeverityMatrix: '',
    directCauses: '',
    indirectCauses: '',
    rootCauses: '',

    victimName: injuredName,
    victimPersonnelCode: injuredCode,
    victimDepartment: department,
    victimWorkExperience: '',
    injuryType: '',
    injuredBodyPart,
    medicalTreatment: String(incident?.medicalTreatmentType && incident.medicalTreatmentType !== 'N/A' ? incident.medicalTreatmentType : '').trim(),
    lostWorkDays: Number(incident?.lostDays ?? incident?.lostWorkDays ?? 0) || '',

    capaFormNumber: '',
    capaRequiredActions: String(f28?.recommendations || '').trim(),

    // Legal 10-day timeline anchored on RHS-F28 final approval date
    startDate: deadline.startDate,
    endDate: deadline.deadlineDate,
    f28FinalApprovedDate: deadline.startDate,
    f28ApprovedAtIso: approvedAtIso,
    hseExpertName: expertName,
    hseExpertPersonnelCode: expertCode,
    hseExpertSignature: '',
    hseExpertApproved: false,

    workflowStage: 'PENDING_ANALYSIS',
    assignedExpertCode: expertCode,
    assignedExpertName: expertName,
    hseHeadReviewerName: '',
    hseHeadReviewerCode: '',
    hseHeadSignature: '',
    hseHeadReviewNotes: '',
    hseHeadApprovedAt: '',
    attachments: [],

    status: deadline.computedStatus,
    deadlineDate: deadline.deadlineDate,
    daysRemaining: deadline.daysRemaining,
    daysPassed: deadline.daysPassed,
    isNearDeadline: deadline.isNearDeadline,
    isExpired: deadline.isExpired,

    auditLogs: [
      {
        id: `f34-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user: approverUser?.name || approverUser?.username || 'سامانه HSECORE',
        userCode: approverUser?.personnelCode || '',
        role: approverUser?.role || 'HSE_MANAGER',
        action: 'create',
        actionFa: 'ایجاد خودکار پرونده تجزیه و تحلیل رویداد (RHS-F34) پس از تأیید نهایی RHS-F28',
        timestamp: nowStr,
        outcome: expertName
          ? `ارجاع به کارشناس HSE: ${expertName} | مهلت قانونی تا ${deadline.deadlineDate}`
          : `در انتظار تکمیل توسط کارشناس HSE | مهلت قانونی ۱۰ روزه تا ${deadline.deadlineDate}`,
        details: `مبدأ محاسبه مهلت: تاریخ تأیید نهایی RHS-F28 (${deadline.startDate}) — پایان مهلت: ${deadline.deadlineDate}`,
      },
    ],
    createdAt: nowStr,
    updatedAt: nowStr,
  };
}

/**
 * Evaluates an existing RHS-F34 form's 10-day deadline and automatically creates
 * a linked Non-Conformity ("عدم تکمیل تجزیه و تحلیل حادثه در مهلت مقرر") if overdue.
 * Idempotent: will never create duplicate NC records for the same incident.
 */
export async function syncRhsF34DeadlineAndAutoNc(
  incident: any,
  persistFn: (updatedSupplementaryForm: any) => Promise<void>
): Promise<any> {
  const existingForm = incident?.supplementaryForm || incident?.incidentData?.supplementaryForm;
  if (!existingForm) return null;

  const anchorDate =
    existingForm.f28FinalApprovedDate ||
    existingForm.startDate ||
    incident?.rhsF28?.hseCenterHeadSignedDate ||
    incident?.reportDate;

  const deadline = computeRhsF34Deadline(
    anchorDate,
    existingForm.status,
    existingForm.workflowStage,
    existingForm.f28ApprovedAtIso
  );

  let formChanged =
    existingForm.daysRemaining !== deadline.daysRemaining ||
    existingForm.daysPassed !== deadline.daysPassed ||
    existingForm.isExpired !== deadline.isExpired ||
    existingForm.isNearDeadline !== deadline.isNearDeadline ||
    existingForm.deadlineDate !== deadline.deadlineDate ||
    existingForm.status !== deadline.computedStatus;

  const nextForm: any = {
    ...existingForm,
    startDate: existingForm.startDate || deadline.startDate,
    f28FinalApprovedDate: existingForm.f28FinalApprovedDate || deadline.startDate,
    deadlineDate: deadline.deadlineDate,
    daysPassed: deadline.daysPassed,
    daysRemaining: deadline.daysRemaining,
    isNearDeadline: deadline.isNearDeadline,
    isExpired: deadline.isExpired,
    status: deadline.computedStatus,
  };

  // Automatic Non-Conformity when 10-day legal window expires without final completion
  if (deadline.isExpired && !nextForm.nonConformanceId) {
    try {
      const reportNumber = String(incident?.reportNumber || incident?.incidentNumber || incident?.id);
      const todayJalali = getCurrentJalaliDateServer();
      const ncDueDate = addDaysToJalaliServer(todayJalali, 7);
      const overdueDays = Math.abs(deadline.daysRemaining);

      const createdNc = await createNonConformance(
        {
          title: RHS_F34_NC_DEFAULT_TITLE,
          sourceModule: RHS_F34_NC_SOURCE_MODULE,
          sourceRecordId: reportNumber,
          sourceTitle: `تحلیل حادثه RHS-F34 مرتبط با ${reportNumber} — ${incident?.title || ''}`,
          unitName: incident?.department || nextForm.victimOrgUnit || incident?.locationSite || 'واحد HSE',
          riskLevel: 'HIGH',
          category: 'تأخیر در تجزیه و تحلیل حادثه (RHS-F34)',
          description: `مهلت قانونی ۱۰ روز تقویمی تکمیل و تأیید نهایی فرم تجزیه و تحلیل حادثه (${nextForm.formNumber || 'RHS-F34'}) مرتبط با گزارش حادثه ${reportNumber} (مبدأ تأیید نهایی RHS-F28: ${deadline.startDate}، سررسید: ${deadline.deadlineDate}) به پایان رسیده است (${overdueDays} روز تأخیر).`,
          assignedTo: nextForm.assignedExpertCode || nextForm.hseExpertPersonnelCode || null,
          assignedToName: nextForm.assignedExpertName || nextForm.hseExpertName || null,
          dueDate: ncDueDate,
          status: 'REGISTERED',
        },
        'system'
      );

      if (createdNc) {
        const nowStr = getCurrentJalaliDateTimeServer();
        nextForm.nonConformanceId = createdNc.id;
        nextForm.nonConformanceTrackingCode = createdNc.trackingCode;
        nextForm.nonConformanceTitle = createdNc.title || RHS_F34_NC_DEFAULT_TITLE;
        nextForm.nonConformanceStatus = createdNc.status || 'REGISTERED';
        nextForm.nonConformanceAssignedTo = createdNc.assignedTo || nextForm.assignedExpertCode || '';
        nextForm.nonConformanceAssignedToName = createdNc.assignedToName || nextForm.assignedExpertName || '';
        nextForm.nonConformanceDueDate = createdNc.dueDate || ncDueDate;
        nextForm.nonConformanceCorrectiveAction = createdNc.correctiveAction || '';
        nextForm.nonConformanceCreatedAt = nowStr;
        nextForm.auditLogs = [
          ...(Array.isArray(nextForm.auditLogs) ? nextForm.auditLogs : []),
          {
            id: `f34-nc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            user: 'سامانه پایش مهلت HSE',
            role: 'SYSTEM',
            action: 'auto_nc',
            actionFa: 'ثبت خودکار عدم انطباق به علت عبور از مهلت ۱۰ روزه',
            timestamp: nowStr,
            outcome: `کد عدم انطباق: ${createdNc.trackingCode}`,
            details: `عنوان: ${RHS_F34_NC_DEFAULT_TITLE} | میزان تأخیر: ${overdueDays} روز`,
          },
        ];
        formChanged = true;

        try {
          await notificationService.send({
            title: `عدم انطباق خودکار تأخیر RHS-F34: ${reportNumber}`,
            body: `مهلت ۱۰ روزه تکمیل تجزیه و تحلیل حادثه (${reportNumber}) به پایان رسید و عدم انطباق «${RHS_F34_NC_DEFAULT_TITLE}» با کد ${createdNc.trackingCode} به‌صورت خودکار ثبت شد.`,
            type: 'popup',
            category: 'error',
            priority: 'high',
            sourceModule: 'incidents',
            entityType: 'INCIDENT',
            entityId: reportNumber,
            recordId: reportNumber,
            actionUrl: `#incidents?report=${encodeURIComponent(reportNumber)}&openF34=1`,
            targetType: 'roles',
            targetValues: ['HSE_MANAGER', 'EXECUTIVE_MANAGER', 'ADMIN', 'ADMINISTRATOR', 'SAFETY_OFFICER'],
            sender: 'سامانه HSECORE',
            metadata: {
              reportNumber,
              nonConformanceTrackingCode: createdNc.trackingCode,
              overdueDays,
            },
          });
        } catch {
          // Non-fatal
        }
      }
    } catch (err) {
      console.warn('[RHS-F34] Automatic Non-Conformity creation warning:', err);
    }
  }

  if (formChanged) {
    try {
      await persistFn(nextForm);
    } catch (err) {
      console.warn('[RHS-F34] Persist synced deadline warning:', err);
    }
  }

  return nextForm;
}

export async function updateLinkedRhsF34NonConformance(params: {
  ncId: number | string;
  patch: {
    assignedTo?: string;
    assignedToName?: string;
    dueDate?: string;
    correctiveAction?: string;
    preventiveAction?: string;
    status?: string;
    notes?: string;
  };
  username: string;
}) {
  return updateNonConformance(
    params.ncId,
    {
      assignedTo: params.patch.assignedTo,
      assignedToName: params.patch.assignedToName,
      dueDate: params.patch.dueDate,
      correctiveAction: params.patch.correctiveAction,
      preventiveAction: params.patch.preventiveAction,
      status: params.patch.status,
      historyAction: 'UPDATE_FROM_RHS_F34',
      historyNote: params.patch.notes || 'بروزرسانی مسئول پیگیری، مهلت اصلاح و اقدامات اصلاحی از پرونده تحلیل حادثه RHS-F34',
    },
    params.username
  );
}
