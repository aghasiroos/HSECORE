import {
  SafetyIncidentRecord,
  IncidentSupplementaryForm,
  IncidentFormAuditLog,
  SupplementaryFormStatus,
  UserProfile,
} from '../types';
import { apiDb } from '../services/apiDatabaseClient';

export const SUPPLEMENTARY_FORMS_STORAGE_KEY = 'hse_incident_supplementary_forms';
export const RHS_F34_DEADLINE_DAYS = 10;
export const RHS_F34_NEAR_DEADLINE_DAYS = 3;

let memorySupplementaryForms: Record<string, IncidentSupplementaryForm> = {};

export function setMemorySupplementaryForms(forms: Record<string, IncidentSupplementaryForm>) {
  if (forms && typeof forms === 'object') {
    memorySupplementaryForms = { ...forms };
  }
}

function normalizeDigits(str: string): string {
  return String(str || '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
}

/**
 * Parses a Jalali date string like 1405/05/18, 1405.05.18, or 1405-05-18.
 */
export function parseJalaliDateString(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const clean = normalizeDigits(dateStr).trim().replace(/[.\-]/g, '/');
  const match = clean.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }
  return null;
}

function isJalaliLeapYear(year: number): boolean {
  const mod = (((year - 474) % 2820) + 2820) % 2820;
  return (((mod + 474 + 38) * 682) % 2816) < 682;
}

function jalaliMonthLength(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isJalaliLeapYear(year) ? 30 : 29;
}

/**
 * Accurate Jalali day counter from 1300/01/01 (matches server-side rhsF34.helper.ts).
 */
function jalaliToDayNumber(year: number, month: number, day: number): number {
  let days = 0;
  if (year >= 1300) {
    for (let y = 1300; y < year; y++) {
      days += isJalaliLeapYear(y) ? 366 : 365;
    }
  } else {
    for (let y = year; y < 1300; y++) {
      days -= isJalaliLeapYear(y) ? 366 : 365;
    }
  }
  for (let m = 1; m < month; m++) {
    days += jalaliMonthLength(year, m);
  }
  days += day - 1;
  return days;
}

/**
 * Adds days to a Jalali date string and returns formatted string (YYYY/MM/DD).
 */
export function addDaysToJalali(dateStr: string, daysToAdd: number): string {
  const parsed = parseJalaliDateString(dateStr);
  if (!parsed) return dateStr;

  let { year, month, day } = parsed;
  day += Math.round(daysToAdd);

  while (day > jalaliMonthLength(year, month)) {
    day -= jalaliMonthLength(year, month);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  while (day < 1) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    day += jalaliMonthLength(year, month);
  }

  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

/**
 * Gets current Jalali date formatted as YYYY/MM/DD.
 */
export function getCurrentJalaliDate(): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    return normalizeDigits(parts).replace(/[.\-]/g, '/');
  } catch {
    return '1405/05/28';
  }
}

/**
 * Calculates days passed, days remaining, near-deadline warning, and expiration
 * from the RHS-F28 final approval date with a strict 10-calendar-day legal deadline.
 */
export function calculateDeadlineInfo(
  startDateStr: string,
  formStatus?: SupplementaryFormStatus
): {
  deadlineDate: string;
  daysPassed: number;
  daysRemaining: number;
  isNearDeadline: boolean;
  isExpired: boolean;
  status: SupplementaryFormStatus;
} {
  const defaultCurrent = getCurrentJalaliDate();
  const startParsed =
    parseJalaliDateString(startDateStr) ||
    parseJalaliDateString(defaultCurrent) || { year: 1405, month: 5, day: 18 };
  const currentParsed = parseJalaliDateString(defaultCurrent) || { year: 1405, month: 5, day: 28 };

  const startDayNum = jalaliToDayNumber(startParsed.year, startParsed.month, startParsed.day);
  const currentDayNum = jalaliToDayNumber(currentParsed.year, currentParsed.month, currentParsed.day);

  const daysPassed = Math.max(0, currentDayNum - startDayNum);
  const daysRemaining = RHS_F34_DEADLINE_DAYS - daysPassed;
  const isCompleted = formStatus === 'completed';
  const isExpired = !isCompleted && daysRemaining < 0;
  const isNearDeadline = !isCompleted && !isExpired && daysRemaining <= RHS_F34_NEAR_DEADLINE_DAYS;

  const cleanStart = `${startParsed.year}/${String(startParsed.month).padStart(2, '0')}/${String(startParsed.day).padStart(2, '0')}`;
  const deadlineDate = addDaysToJalali(cleanStart, RHS_F34_DEADLINE_DAYS);

  let finalStatus: SupplementaryFormStatus = formStatus || 'not_started';
  if (!isCompleted && isExpired) {
    finalStatus = 'expired';
  }

  return {
    deadlineDate,
    daysPassed,
    daysRemaining,
    isNearDeadline,
    isExpired,
    status: finalStatus,
  };
}

/**
 * Generates an RHS-F34 form pre-populated with shared RHS-F28 / Incident fields
 * and anchored on the RHS-F28 final approval date (+10 calendar days).
 */
export function createDefaultSupplementaryForm(
  incident: SafetyIncidentRecord,
  currentUser?: UserProfile
): IncidentSupplementaryForm {
  const f28 = incident.rhsF28;
  const anchorDate =
    (f28?.hseCenterHeadSignedDate && parseJalaliDateString(f28.hseCenterHeadSignedDate)
      ? f28.hseCenterHeadSignedDate
      : '') ||
    incident.reportDate ||
    getCurrentJalaliDate();
  const deadlineInfo = calculateDeadlineInfo(anchorDate, 'not_started');

  const parsedYear = parseJalaliDateString(anchorDate)?.year || parseInt(getCurrentJalaliDate().slice(0, 4), 10) || 1405;
  const seqMatch = String(incident.reportNumber || '').match(/(\d+)\s*$/);
  const seq = seqMatch ? String(parseInt(seqMatch[1], 10)) : String(incident.id || '1');

  const reporterName = f28?.reporterName || incident.reporterName || '';
  const reporterCode = f28?.reporterPersonnelCode || incident.reporterPersonnelCode || '';
  const dept = f28?.department || incident.department || '';
  const reporterNameAndRole = [reporterName, reporterCode ? `(${reporterCode})` : '', dept ? `- ${dept}` : '']
    .filter(Boolean)
    .join(' ');
  const injuredName = f28?.injuredPersonName || incident.injuredPersonName || '';

  return {
    id: `rhs-f34-${incident.id}`,
    incidentId: incident.id,
    incidentReportNumber: incident.reportNumber || '',

    formCode: 'RHS – F34',
    revision: '00',
    formNumber: `RGC-HSE/${parsedYear}-${seq}`,
    formDate: deadlineInfo.deadlineDate.replace(/\//g, '.'),
    distributionList: 'توزیع نسخ: ۱- مدیریت امور مجتمع  ۲- واحد HSE  ۳- امور اداری',

    eventDate: f28?.observationDate || incident.eventDate || '',
    eventTime: f28?.observationTime || incident.eventTime || '',
    exactLocation: f28?.exactLocation || incident.exactLocation || f28?.locationSite || incident.locationSite || '',
    reportDate: f28?.reportDate || incident.reportDate || '',
    reportTime: f28?.observationTime || incident.eventTime || '',
    locationOccurrence: f28?.locationSite || incident.locationSite || '',
    reporterNameAndRole,
    victimOrgUnit: dept,
    activityDuringIncident: f28?.injuredPersonJobTitle || '',
    victimCount: injuredName ? 1 : 0,

    estimatedLoss: f28?.damagesOrInjuries || '',
    briefDescription: f28?.description || incident.description || '',
    riskSeverityMatrix: '',
    directCauses: '',
    indirectCauses: '',
    rootCauses: '',

    victimName: injuredName,
    victimPersonnelCode: f28?.injuredPersonCode || incident.injuredPersonCode || '',
    victimDepartment: dept,
    victimWorkExperience: '',
    injuryType: '',
    injuredBodyPart: f28?.injuredBodyPart || '',
    medicalTreatment: incident.medicalTreatmentType && incident.medicalTreatmentType !== 'N/A' ? incident.medicalTreatmentType : '',
    lostWorkDays: incident.lostDays || '',

    capaFormNumber: '',
    capaRequiredActions: f28?.recommendations || '',

    startDate: anchorDate.replace(/\./g, '/'),
    endDate: deadlineInfo.deadlineDate,
    f28FinalApprovedDate: anchorDate.replace(/\./g, '/'),
    hseExpertName: '',
    hseExpertApproved: false,
    workflowStage: 'PENDING_ANALYSIS',
    attachments: [],

    status: deadlineInfo.status,
    deadlineDate: deadlineInfo.deadlineDate,
    daysPassed: deadlineInfo.daysPassed,
    daysRemaining: deadlineInfo.daysRemaining,
    isNearDeadline: deadlineInfo.isNearDeadline,
    isExpired: deadlineInfo.isExpired,

    auditLogs: [
      {
        id: `audit-${Date.now()}`,
        user: currentUser?.fullName || 'سامانه HSECORE',
        userCode: currentUser?.personnelNumber,
        role: currentUser?.role || 'کارشناس HSE',
        action: 'create',
        actionFa: 'ایجاد پرونده تجزیه و تحلیل حادثه (RHS-F34)',
        timestamp: `${getCurrentJalaliDate()} - ${new Date().toLocaleTimeString('fa-IR')}`,
        details: `مبدأ مهلت ۱۰ روزه: ${anchorDate} | پایان مهلت: ${deadlineInfo.deadlineDate}`,
      },
    ],
    createdAt: `${getCurrentJalaliDate()} ${new Date().toLocaleTimeString('fa-IR')}`,
    updatedAt: `${getCurrentJalaliDate()} ${new Date().toLocaleTimeString('fa-IR')}`,
  };
}

export function getAllSupplementaryForms(): Record<string, IncidentSupplementaryForm> {
  return memorySupplementaryForms;
}

/**
 * Resolves the authoritative RHS-F34 form for an incident (backend-persisted incident.supplementaryForm first).
 */
export function getSupplementaryFormByIncidentId(
  incidentId: string,
  incident?: SafetyIncidentRecord,
  currentUser?: UserProfile
): IncidentSupplementaryForm {
  const allForms = getAllSupplementaryForms();
  let form: IncidentSupplementaryForm | undefined =
    incident?.supplementaryForm
      ? { ...incident.supplementaryForm }
      : allForms[incidentId]
      ? { ...allForms[incidentId] }
      : undefined;

  if (!form && incident) {
    form = createDefaultSupplementaryForm(incident, currentUser);
  }

  if (form) {
    if (!form.eventDate && form.eventDateTime) {
      const parts = form.eventDateTime.trim().split(/\s+/);
      form.eventDate = parts[0] || '';
      form.eventTime = form.eventTime || parts.slice(1).join(' ') || '';
    }
    if (!form.reportDate && form.reportDateTime) {
      const parts = form.reportDateTime.trim().split(/\s+/);
      form.reportDate = parts[0] || '';
      form.reportTime = form.reportTime || parts.slice(1).join(' ') || '';
    }

    const anchor = form.f28FinalApprovedDate || form.startDate;
    if (anchor) {
      const deadlineInfo = calculateDeadlineInfo(anchor.replace(/\./g, '/'), form.status);
      form.deadlineDate = form.deadlineDate || deadlineInfo.deadlineDate;
      form.daysPassed = deadlineInfo.daysPassed;
      form.daysRemaining = deadlineInfo.daysRemaining;
      form.isNearDeadline = deadlineInfo.isNearDeadline;
      form.isExpired = deadlineInfo.isExpired;
      if (form.status !== 'completed' && deadlineInfo.isExpired) {
        form.status = 'expired';
      }
    }
  }

  return form!;
}

/**
 * Legacy helper kept for backward compatibility; mirrors state into memory cache.
 */
export function saveSupplementaryForm(
  form: IncidentSupplementaryForm,
  currentUser?: UserProfile,
  actionType: 'draft_save' | 'finalize' | 'update' | 'unlock_edit' = 'update',
  actionDetails?: string
): IncidentSupplementaryForm {
  const allForms = getAllSupplementaryForms();
  const nowJalali = `${getCurrentJalaliDate()} - ${new Date().toLocaleTimeString('fa-IR')}`;

  const actionFaMap: Record<string, string> = {
    draft_save: 'ذخیره موقت پیش‌نویس فرم تجزیه و تحلیل حادثه',
    finalize: 'تکمیل و ثبت نهایی فرم تجزیه و تحلیل حادثه',
    update: 'ویرایش اطلاعات فرم تجزیه و تحلیل حادثه',
    unlock_edit: 'ویرایش ویژه پس از انقضای مهلت (دسترسی مجاز)',
  };

  const newAuditEntry: IncidentFormAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user: currentUser?.fullName || 'کاربر سیستم',
    userCode: currentUser?.personnelNumber,
    role: currentUser?.role || 'کارشناس HSE',
    action: actionType,
    actionFa: actionFaMap[actionType] || 'بروزرسانی فرم',
    timestamp: nowJalali,
    details: actionDetails || (actionType === 'finalize' ? 'تأیید نهایی فرم و الصاق به پرونده رویداد' : 'ذخیره تغییرات'),
  };

  const updatedForm: IncidentSupplementaryForm = {
    ...form,
    auditLogs: [...(form.auditLogs || []), newAuditEntry],
    updatedAt: nowJalali,
    completedAt: actionType === 'finalize' ? nowJalali : form.completedAt,
    completedBy: actionType === 'finalize' ? currentUser?.fullName : form.completedBy,
  };

  memorySupplementaryForms = {
    ...allForms,
    [form.incidentId]: updatedForm,
  };

  apiDb.saveSetting('hse_incident_supplementary_forms', memorySupplementaryForms).catch(() => {});
  return updatedForm;
}

export function isUserAuthorizedToEditSupplementaryForm(user?: UserProfile, form?: IncidentSupplementaryForm): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase().replace(/[\s_]+/g, '');
  const job = (user.jobTitle || '').toLowerCase();

  const matchesAssigned =
    (Boolean(form?.assignedExpertCode) && Boolean(user.personnelNumber) && form?.assignedExpertCode === user.personnelNumber) ||
    (Boolean(form?.assignedExpertName) &&
      (form?.assignedExpertName === user.fullName || form?.assignedExpertName === user.username));

  return (
    matchesAssigned ||
    role === 'administrator' ||
    role === 'admin' ||
    role === 'hsemanager' ||
    role === 'safetyofficer' ||
    role === 'safetyinspector' ||
    role === 'executivemanager' ||
    job.includes('hse') ||
    job.includes('ایمنی') ||
    job.includes('رئیس') ||
    job.includes('مدیر') ||
    job.includes('سرپرست') ||
    Boolean(user.permissions?.Incidents?.edit || user.permissions?.Incidents?.approve)
  );
}

export function isUserHseHeadForRhsF34(user?: UserProfile): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase().replace(/[\s_]+/g, '');
  return (
    ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'EXECUTIVEMANAGER'].includes(role) ||
    role.includes('ADMIN') ||
    Boolean(user.permissions?.Incidents?.approve)
  );
}
