import { SafetyIncidentRecord, IncidentSupplementaryForm, IncidentFormAuditLog, SupplementaryFormStatus, UserProfile } from '../types';
import { apiDb } from '../services/apiDatabaseClient';

export const SUPPLEMENTARY_FORMS_STORAGE_KEY = 'hse_incident_supplementary_forms';

let memorySupplementaryForms: Record<string, IncidentSupplementaryForm> = {};

export function setMemorySupplementaryForms(forms: Record<string, IncidentSupplementaryForm>) {
  if (forms && typeof forms === 'object') {
    memorySupplementaryForms = { ...forms };
  }
}

/**
 * Calculates Persian / Solar Hijri date addition or days difference.
 */
export function parseJalaliDateString(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  // Handle formats like 1405/05/18 or 1405.05.18 or 1405-05-18
  const clean = dateStr.replace(/[\.\-]/g, '/');
  const parts = clean.split('/');
  if (parts.length >= 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return { year, month, day };
    }
  }
  return null;
}

/**
 * Converts a Jalali approximate date to day index for comparison.
 */
function jalaliToDayNumber(year: number, month: number, day: number): number {
  let days = year * 365 + Math.floor(year / 4); // Approximate leap years
  if (month <= 6) {
    days += (month - 1) * 31;
  } else {
    days += 6 * 31 + (month - 7) * 30;
  }
  days += day;
  return days;
}

/**
 * Adds days to a Jalali date string and returns formatted string (YYYY/MM/DD).
 */
export function addDaysToJalali(dateStr: string, daysToAdd: number): string {
  const parsed = parseJalaliDateString(dateStr);
  if (!parsed) return dateStr;
  
  let { year, month, day } = parsed;
  day += daysToAdd;

  while (true) {
    const maxDaysInMonth = month <= 6 ? 31 : (month <= 11 ? 30 : 29); // 29 for Esfand
    if (day <= maxDaysInMonth) {
      break;
    }
    day -= maxDaysInMonth;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

/**
 * Gets current Jalali date formatted as YYYY/MM/DD.
 */
export function getCurrentJalaliDate(): string {
  try {
    const now = new Date();
    // Use Intl DateTimeFormat for fa-IR
    const parts = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    
    // Convert Persian digits to English digits
    const englishDigits = parts.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    const clean = englishDigits.replace(/[\.\-]/g, '/');
    return clean;
  } catch {
    return '1405/05/28';
  }
}

/**
 * Calculates days passed and days remaining from incident date with a 10-day deadline.
 */
export function calculateDeadlineInfo(startDateStr: string, formStatus?: SupplementaryFormStatus): {
  deadlineDate: string;
  daysPassed: number;
  daysRemaining: number;
  isExpired: boolean;
  status: SupplementaryFormStatus;
} {
  const defaultCurrent = getCurrentJalaliDate();
  const startParsed = parseJalaliDateString(startDateStr) || parseJalaliDateString(defaultCurrent) || { year: 1405, month: 5, day: 18 };
  const currentParsed = parseJalaliDateString(defaultCurrent) || { year: 1405, month: 5, day: 28 };

  const startDayNum = jalaliToDayNumber(startParsed.year, startParsed.month, startParsed.day);
  const currentDayNum = jalaliToDayNumber(currentParsed.year, currentParsed.month, currentParsed.day);

  const daysPassed = Math.max(0, currentDayNum - startDayNum);
  const daysRemaining = 10 - daysPassed;
  const isExpired = daysRemaining < 0;

  const deadlineDate = addDaysToJalali(startDateStr, 10);

  let finalStatus: SupplementaryFormStatus = formStatus || 'not_started';
  if (finalStatus !== 'completed') {
    if (isExpired) {
      finalStatus = 'expired';
    } else if (finalStatus === 'not_started' && daysPassed > 0) {
      // Keep not_started or in_progress depending on edits
    }
  }

  return {
    deadlineDate,
    daysPassed,
    daysRemaining,
    isExpired,
    status: finalStatus,
  };
}

/**
 * Generates an initial clean Supplementary Form (RHS-F34) where all fields start blank for user completion.
 */
export function createDefaultSupplementaryForm(
  incident: SafetyIncidentRecord,
  currentUser?: UserProfile
): IncidentSupplementaryForm {
  const defaultForm: IncidentSupplementaryForm = {
    id: `supp-${incident.id}`,
    incidentId: incident.id,
    incidentReportNumber: incident.reportNumber || '',
    
    // Header
    formCode: 'RHS – F34',
    revision: '00',
    formNumber: '',
    formDate: '',
    distributionList: 'توزیع نسخ: ۱- مدیریت امور مجتمع  ۲- واحد HSE  ۳- امور اداری',

    // ۱- رویداد و گزارش (Date & Time separated, blank by default)
    eventDateTime: '',
    eventDate: '',
    eventTime: '',
    exactLocation: '',
    reportDateTime: '',
    reportDate: '',
    reportTime: '',
    locationOccurrence: '',
    reporterNameAndRole: '',
    victimOrgUnit: '',
    activityDuringIncident: '',
    victimCount: '',

    // برآورد خسارات
    estimatedLoss: '',

    // ۲- شرح مختصر رویداد
    briefDescription: '',

    // ۳- داده های ماتریس شدت
    riskSeverityMatrix: '',

    // ۴- علل مستقیم
    directCauses: '',

    // ۵- علل غیرمستقیم
    indirectCauses: '',

    // ۶- علل ریشه ای
    rootCauses: '',

    // ۷- اطلاعات مصدوم (قربانی)
    victimName: '',
    victimPersonnelCode: '',
    victimDepartment: '',
    victimWorkExperience: '',
    injuryType: '',
    injuredBodyPart: '',
    medicalTreatment: '',
    lostWorkDays: '',

    // ۸- اقدام اصلاحی و پیشگیرانه مورد نیاز
    capaFormNumber: '',
    capaRequiredActions: '',

    // تاریخ‌ها و کارشناس HSE
    startDate: '',
    endDate: '',
    hseExpertName: '',
    hseExpertApproved: false,

    // وضعیت
    status: 'not_started',
    deadlineDate: '',
    daysRemaining: 10,
    isExpired: false,

    // Audit logs
    auditLogs: [
      {
        id: `audit-${Date.now()}`,
        user: currentUser?.fullName || 'کاربر سیستم',
        userCode: currentUser?.personnelNumber,
        role: currentUser?.role || 'کارشناس HSE',
        action: 'create',
        actionFa: 'ایجاد فرم تکمیلی تجزیه و تحلیل رویداد',
        timestamp: `${getCurrentJalaliDate()} - ${new Date().toLocaleTimeString('fa-IR')}`,
        details: 'ایجاد فرم خام جهت تکمیل توسط کاربر'
      }
    ],
    createdAt: `${getCurrentJalaliDate()} ${new Date().toLocaleTimeString('fa-IR')}`,
    updatedAt: `${getCurrentJalaliDate()} ${new Date().toLocaleTimeString('fa-IR')}`
  };

  return defaultForm;
}

/**
 * Loads all saved supplementary forms from in-memory / backend state.
 */
export function getAllSupplementaryForms(): Record<string, IncidentSupplementaryForm> {
  return memorySupplementaryForms;
}

/**
 * Gets a specific supplementary form by incidentId.
 */
export function getSupplementaryFormByIncidentId(
  incidentId: string,
  incident?: SafetyIncidentRecord,
  currentUser?: UserProfile
): IncidentSupplementaryForm {
  const allForms = getAllSupplementaryForms();
  let form = allForms[incidentId];

  if (!form && incident) {
    form = createDefaultSupplementaryForm(incident, currentUser);
  }

  if (form) {
    // Migration helper: if eventDate or reportDate are missing, populate from eventDateTime/reportDateTime if present
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

    // Re-evaluate deadline dynamically if startDate exists
    if (form.startDate) {
      const deadlineInfo = calculateDeadlineInfo(form.startDate.replace(/\./g, '/'), form.status);
      form.daysRemaining = deadlineInfo.daysRemaining;
      form.isExpired = deadlineInfo.isExpired;
      if (form.status !== 'completed' && deadlineInfo.isExpired) {
        form.status = 'expired';
      }
    }
  }

  return form;
}

/**
 * Saves or updates a supplementary form in state and persists to backend database.
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
    draft_save: 'ذخیره موقت پیش‌نویس فرم تکمیلی',
    finalize: 'تکمیل و ثبت نهایی فرم تکمیلی حادثه',
    update: 'ویرایش اطلاعات فرم تکمیلی',
    unlock_edit: 'ویرایش ویژه پس از انقضای مهلت (دسترسی مجاز)'
  };

  const newAuditEntry: IncidentFormAuditLog = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    user: currentUser?.fullName || 'کاربر سیستم',
    userCode: currentUser?.personnelNumber,
    role: currentUser?.role || 'کارشناس HSE',
    action: actionType,
    actionFa: actionFaMap[actionType] || 'بروزرسانی فرم',
    timestamp: nowJalali,
    details: actionDetails || (actionType === 'finalize' ? 'تأیید نهایی فرم و الصاق به پرونده رویداد' : 'ذخیره تغییرات')
  };

  const updatedForm: IncidentSupplementaryForm = {
    ...form,
    auditLogs: [...(form.auditLogs || []), newAuditEntry],
    updatedAt: nowJalali,
    completedAt: actionType === 'finalize' ? nowJalali : form.completedAt,
    completedBy: actionType === 'finalize' ? currentUser?.fullName : form.completedBy
  };

  // Update in-memory reactive state
  memorySupplementaryForms = {
    ...allForms,
    [form.incidentId]: updatedForm
  };

  // Persist directly to central database via apiDb
  apiDb.saveSetting('hse_incident_supplementary_forms', memorySupplementaryForms).catch((err) => {
    console.warn('[IncidentHelper] Non-fatal error persisting supplementary forms to database:', err);
  });

  return updatedForm;
}

/**
 * Checks if user is authorized to edit the supplementary form even after expiration.
 */
export function isUserAuthorizedToEditSupplementaryForm(user?: UserProfile, form?: IncidentSupplementaryForm): boolean {
  if (!user) return false;
  
  const role = (user.role || '').toLowerCase();
  const job = (user.jobTitle || '').toLowerCase();

  // Admin, Safety Inspector, HSE Head/Manager, or explicit permissions
  const isSuperUser = 
    role === 'administrator' || 
    role === 'safetyinspector' || 
    role === 'executivemanager' || 
    job.includes('hse') || 
    job.includes('ایمنی') || 
    job.includes('رئیس') || 
    job.includes('مدیر') || 
    job.includes('سرپرست') ||
    Boolean(user.permissions?.Incidents?.edit || user.permissions?.Incidents?.approve);

  return isSuperUser;
}
