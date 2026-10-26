/**
 * Inspection Schedule & Timing Helper
 * Unified logic for Periodic (1-Month Default), Pre-Operation, Post-Operation, and Ad-Hoc Inspections.
 */
import { apiDb } from '../services/apiDatabaseClient';
import { toEnglishDigits } from './jalaliDate';

export type UnifiedInspectionTimingType = 'PERIODIC' | 'PRE_OP' | 'POST_OP' | 'ADHOC';

export type PeriodicIntervalType = 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export interface PeriodicIntervalOption {
  value: PeriodicIntervalType;
  labelFa: string;
  labelEn: string;
  months?: number;
  days?: number;
}

export const PERIODIC_INTERVAL_OPTIONS: PeriodicIntervalOption[] = [
  { value: 'DAILY', labelFa: 'روزانه', labelEn: 'Daily', days: 1 },
  { value: 'MONTHLY', labelFa: 'ماهانه', labelEn: 'Monthly', months: 1 },
  { value: 'QUARTERLY', labelFa: '۳ / سه ماه', labelEn: '3 Months (Quarterly)', months: 3 },
  { value: 'SEMI_ANNUAL', labelFa: '۶ / شش ماه', labelEn: '6 Months (Semi-Annual)', months: 6 },
  { value: 'ANNUAL', labelFa: '۱ / یک ساله', labelEn: '1 Year (Annual)', months: 12 }
];

export function normalizePeriodicInterval(interval?: string): PeriodicIntervalType {
  if (!interval) return 'MONTHLY';
  const norm = interval.toUpperCase().trim();
  if (norm === 'DAILY' || norm === 'روزانه') return 'DAILY';
  if (norm === 'MONTHLY' || norm === 'ماهانه' || norm === '1 ماه' || norm === 'یک ماه') return 'MONTHLY';
  if (norm === 'QUARTERLY' || norm === '3 ماه' || norm === 'سه ماه' || norm.includes('3') || norm.includes('سه')) return 'QUARTERLY';
  if (norm === 'SEMI_ANNUAL' || norm === '6 ماه' || norm === 'شش ماه' || norm.includes('6') || norm.includes('شش')) return 'SEMI_ANNUAL';
  if (norm === 'ANNUAL' || norm === 'سالانه' || norm === 'یک ساله' || norm.includes('سال')) return 'ANNUAL';
  return 'MONTHLY';
}

export function getPeriodicIntervalLabel(interval?: string, isFa: boolean = true): string {
  const norm = normalizePeriodicInterval(interval);
  const found = PERIODIC_INTERVAL_OPTIONS.find(o => o.value === norm);
  if (found) {
    return isFa ? found.labelFa : found.labelEn;
  }
  return isFa ? 'ماهانه' : 'Monthly';
}

export interface InspectionTimingConfig {
  value: UnifiedInspectionTimingType;
  labelFa: string;
  labelEn: string;
  badgeClass: string;
  descriptionFa: string;
  hasAutomaticInterval: boolean;
}

export const INSPECTION_TIMING_CONFIGS: Record<UnifiedInspectionTimingType, InspectionTimingConfig> = {
  PERIODIC: {
    value: 'PERIODIC',
    labelFa: 'دوره‌ای',
    labelEn: 'Periodic',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    descriptionFa: 'تکرار شونده بر اساس بازه انتخابی (روزانه، ماهانه، ۳ ماه، ۶ ماه، ۱ سال) از تاریخ آخرین انجام بازرسی واقعی',
    hasAutomaticInterval: true
  },
  PRE_OP: {
    value: 'PRE_OP',
    labelFa: 'قبل از عملیات',
    labelEn: 'Pre-Operation',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    descriptionFa: 'متصل به شروع رویداد یا عملیات مربوطه (بدون زمانبندی سالانه یا ثابت)',
    hasAutomaticInterval: false
  },
  POST_OP: {
    value: 'POST_OP',
    labelFa: 'بعد از عملیات',
    labelEn: 'Post-Operation',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    descriptionFa: 'متصل به اتمام رویداد یا عملیات مربوطه (بدون زمانبندی سالانه یا ثابت)',
    hasAutomaticInterval: false
  },
  ADHOC: {
    value: 'ADHOC',
    labelFa: 'موردی / ویژه',
    labelEn: 'Ad-Hoc / Special',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    descriptionFa: 'بازرسی موردی بدون دوره ثابت، تعیین دستی در صورت لزوم',
    hasAutomaticInterval: false
  }
};

export const INSPECTION_TIMING_OPTIONS = [
  { value: 'PERIODIC' as const, labelFa: 'دوره‌ای', labelEn: 'Periodic' },
  { value: 'PRE_OP' as const, labelFa: 'قبل از عملیات (متصل به رویداد)', labelEn: 'Pre-Operation (Event Linked)' },
  { value: 'POST_OP' as const, labelFa: 'بعد از عملیات (متصل به رویداد)', labelEn: 'Post-Operation (Event Linked)' },
  { value: 'ADHOC' as const, labelFa: 'موردی / ویژه', labelEn: 'Ad-Hoc / Special' }
];

export const UNIFIED_INSPECTION_TIMING_TYPES = INSPECTION_TIMING_OPTIONS;

export function getInspectionTypeBadgeClass(type?: string): string {
  const norm = normalizeInspectionType(type);
  return INSPECTION_TIMING_CONFIGS[norm]?.badgeClass || INSPECTION_TIMING_CONFIGS.PERIODIC.badgeClass;
}

export interface InspectionAuditHistoryRecord {
  id: string;
  timestamp: string; // ISO 8601
  changedBy: string;
  action: 'CREATED' | 'UPDATED' | 'SCHEDULE_RECALCULATED' | 'LINKED_EVENT_EXECUTED' | 'RE_INSPECTED' | 'RE_INSPECTION_CREATED';
  inspectionDate: string;
  previousNextDueDate?: string;
  newNextDueDate?: string;
  inspectionType: UnifiedInspectionTimingType;
  relatedOperationId?: string;
  relatedOperationTitle?: string;
  previousInspectionId?: string;
  notes?: string;
}

/**
 * Normalizes input string to English digits and standard YYYY/MM/DD
 */
export function normalizeJalaliDigits(str: string): string {
  if (!str) return '';
  return toEnglishDigits(str).trim();
}

/**
 * Calculates next inspection date based on Jalali Date arithmetic:
 * - If PERIODIC: Date = Actual Inspection Date + Interval (DAILY, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL)
 * - If PRE_OP / POST_OP: returns empty string (never generates automatic fixed dates)
 * - If ADHOC: returns empty string unless manually provided
 */
export function calculateNextInspectionDate(
  actualInspectionDate: string,
  type: UnifiedInspectionTimingType | string,
  intervalOrMonths: PeriodicIntervalType | number | string = 'MONTHLY'
): string {
  // Normalize type
  const normalizedType = normalizeInspectionType(type);

  if (normalizedType !== 'PERIODIC') {
    // PRE_OP, POST_OP, ADHOC strictly do NOT produce automatic periodic dates
    return '';
  }

  const cleanDate = normalizeJalaliDigits(actualInspectionDate);
  const parts = cleanDate.split('/');
  if (parts.length !== 3) return '';

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d) || y < 1300 || m < 1 || m > 12 || d < 1 || d > 31) {
    return '';
  }

  // Handle DAILY
  if (intervalOrMonths === 'DAILY' || (typeof intervalOrMonths === 'string' && intervalOrMonths.includes('روز'))) {
    let ny = y;
    let nm = m;
    let nd = d + 1;
    const maxDaysInCurrentMonth = (nm <= 6) ? 31 : (nm <= 11 ? 30 : 29);
    if (nd > maxDaysInCurrentMonth) {
      nd = 1;
      nm += 1;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
    }
    const py = String(ny).padStart(4, '0');
    const pm = String(nm).padStart(2, '0');
    const pd = String(nd).padStart(2, '0');
    return `${py}/${pm}/${pd}`;
  }

  // Determine months to add based on interval
  let monthsToAdd = 1;
  if (typeof intervalOrMonths === 'number') {
    monthsToAdd = intervalOrMonths;
  } else {
    const normInt = normalizePeriodicInterval(intervalOrMonths);
    if (normInt === 'MONTHLY') monthsToAdd = 1;
    else if (normInt === 'QUARTERLY') monthsToAdd = 3;
    else if (normInt === 'SEMI_ANNUAL') monthsToAdd = 6;
    else if (normInt === 'ANNUAL') monthsToAdd = 12;
  }

  let ny = y;
  let nm = m + monthsToAdd;
  let nd = d;

  while (nm > 12) {
    nm -= 12;
    ny += 1;
  }

  // Adjust max days in target Jalali month
  // Months 1-6: 31 days, Months 7-11: 30 days, Month 12: 29 days (30 in leap year)
  const maxDaysInNewMonth = (nm <= 6) ? 31 : (nm <= 11 ? 30 : 29);
  if (nd > maxDaysInNewMonth) {
    nd = maxDaysInNewMonth;
  }

  const py = String(ny).padStart(4, '0');
  const pm = String(nm).padStart(2, '0');
  const pd = String(nd).padStart(2, '0');
  return `${py}/${pm}/${pd}`;
}

/**
 * Standardizes any Persian or legacy inspection type to UnifiedInspectionTimingType
 */
export function normalizeInspectionType(type?: string): UnifiedInspectionTimingType {
  if (!type) return 'PERIODIC';
  const t = type.toLowerCase().trim();
  if (t === 'periodic' || t === 'دوره‌ای' || t === 'دوره ای' || t === 'ماهانه' || t === 'هفتگی' || t === 'روزانه' || t === 'ممیزی جامع') {
    return 'PERIODIC';
  }
  if (t === 'pre_op' || t === 'pre-op' || t === 'preop' || t.includes('قبل از عملیات')) {
    return 'PRE_OP';
  }
  if (t === 'post_op' || t === 'post-op' || t === 'postop' || t.includes('بعد از عملیات')) {
    return 'POST_OP';
  }
  if (t === 'adhoc' || t === 'ad-hoc' || t.includes('موردی') || t.includes('ویژه') || t.includes('مدیریتی')) {
    return 'ADHOC';
  }
  return 'PERIODIC';
}

/**
 * Returns user-facing label and styling badge for inspection type
 */
export function getInspectionTypeDisplay(type?: string, isFa: boolean = true) {
  const norm = normalizeInspectionType(type);
  const cfg = INSPECTION_TIMING_CONFIGS[norm] || INSPECTION_TIMING_CONFIGS.PERIODIC;
  return {
    key: norm,
    label: isFa ? cfg.labelFa : cfg.labelEn,
    badgeClass: cfg.badgeClass,
    description: cfg.descriptionFa,
    hasAutomaticInterval: cfg.hasAutomaticInterval
  };
}

/**
 * Helper to get current Jalali Date
 */
export function getTodayJalaliDate(): string {
  try {
    return new Date().toLocaleDateString('fa-IR', { numberingSystem: 'latn' });
  } catch {
    return '1404/06/04';
  }
}

/**
 * Checks if a checklist type is related to Mobile Cranes, Forklifts, or Heavy Machinery / Lifting Equipment
 */
export function isMachineryChecklist(typeId?: string, titleFa?: string): boolean {
  if (!typeId && !titleFa) return false;
  const tid = (typeId || '').toLowerCase().trim();
  const ttitle = (titleFa || '').toLowerCase().trim();
  return (
    tid === 'mobile-crane-inspection' ||
    tid === 'forklift-inspection' ||
    tid === 'crane-operator-behavior' ||
    tid === 'lifting' ||
    tid.includes('crane') ||
    tid.includes('forklift') ||
    ttitle.includes('جرثقیل') ||
    ttitle.includes('لیفتراک') ||
    ttitle.includes('باربرداری') ||
    ttitle.includes('متحرک')
  );
}

/**
 * Categorizes machinery into crane, forklift, or general lifting
 */
export function getMachineryCategory(typeId?: string, titleFa?: string): 'crane' | 'forklift' | 'general_lifting' | 'none' {
  if (!isMachineryChecklist(typeId, titleFa)) return 'none';
  const tid = (typeId || '').toLowerCase().trim();
  const ttitle = (titleFa || '').toLowerCase().trim();
  if (tid.includes('crane') || ttitle.includes('جرثقیل')) return 'crane';
  if (tid.includes('forklift') || ttitle.includes('لیفتراک')) return 'forklift';
  return 'general_lifting';
}

// ==========================================
// 4-Tier Schedule Alert Status & Timing Settings
// ==========================================

export type InspectionScheduleAlertStatus = 'VALID' | 'WARNING' | 'OVERDUE' | 'NOT_SCHEDULED';

export interface InspectionAlertSettings {
  warningThresholdDays: number; // default: 7 days before due date
  urgentThresholdDays: number; // default: 2 days before due date
  highlightRowColor: boolean; // whether to tint table rows / cards
  bannerAlertEnabled: boolean; // whether to show top alert banner
  customThresholdsByType?: Record<string, number>; // per checklist template threshold override
}

export const DEFAULT_ALERT_SETTINGS: InspectionAlertSettings = {
  warningThresholdDays: 7,
  urgentThresholdDays: 2,
  highlightRowColor: true,
  bannerAlertEnabled: true,
  customThresholdsByType: {
    'mobile-crane-inspection': 7,
    'forklift-inspection': 5,
    'scaffolding-inspection': 7,
    'hot-work-safety': 3,
    'confined-space-safety': 3,
  }
};

const ALERT_SETTINGS_STORAGE_KEY = 'hse_inspection_alert_settings_v1';

let memoryAlertSettings: InspectionAlertSettings | null = null;

async function syncInspectionAlertSettingsFromDb(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const remote = await apiDb.getSetting(ALERT_SETTINGS_STORAGE_KEY);
    if (remote && typeof remote === 'object') {
      memoryAlertSettings = { ...DEFAULT_ALERT_SETTINGS, ...remote };
      try {
        localStorage.setItem(ALERT_SETTINGS_STORAGE_KEY, JSON.stringify(memoryAlertSettings));
      } catch {}
      window.dispatchEvent(new CustomEvent('hse_inspection_alert_settings_updated', { detail: memoryAlertSettings }));
    } else {
      const localRaw = localStorage.getItem(ALERT_SETTINGS_STORAGE_KEY);
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          memoryAlertSettings = { ...DEFAULT_ALERT_SETTINGS, ...parsed };
          apiDb.saveSetting(ALERT_SETTINGS_STORAGE_KEY, memoryAlertSettings, 'Inspection Alert Settings').catch(() => {});
        } catch {}
      }
    }
  } catch {}
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncInspectionAlertSettingsFromDb();
  }, 250);

  const handleRemoteMutation = (e: any) => {
    const key = String(e?.detail?.key || e?.detail?.entityType || '');
    if (key === ALERT_SETTINGS_STORAGE_KEY || key === 'settings') {
      syncInspectionAlertSettingsFromDb();
    }
  };
  window.addEventListener('app_data_mutated', handleRemoteMutation);
  window.addEventListener('hse_data_mutated', handleRemoteMutation);
}

export function getInspectionAlertSettings(): InspectionAlertSettings {
  if (memoryAlertSettings) {
    return memoryAlertSettings;
  }
  try {
    const saved = localStorage.getItem(ALERT_SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      memoryAlertSettings = { ...DEFAULT_ALERT_SETTINGS, ...parsed };
      return memoryAlertSettings;
    }
  } catch {
    // fallback
  }
  return DEFAULT_ALERT_SETTINGS;
}

export function saveInspectionAlertSettings(settings: InspectionAlertSettings): void {
  try {
    memoryAlertSettings = { ...DEFAULT_ALERT_SETTINGS, ...settings };
    localStorage.setItem(ALERT_SETTINGS_STORAGE_KEY, JSON.stringify(memoryAlertSettings));
    apiDb.saveSetting(ALERT_SETTINGS_STORAGE_KEY, memoryAlertSettings, 'Inspection Alert Settings').catch(() => {});
    window.dispatchEvent(new CustomEvent('hse_inspection_alert_settings_updated', { detail: memoryAlertSettings }));
  } catch (err) {
    console.error('Failed to save alert settings', err);
  }
}

/**
 * Converts a Jalali date string (YYYY/MM/DD) to absolute number of days
 * Uses the 33-year Khayyami cycle for mathematically exact day differences.
 */
export function jalaliToAbsoluteDays(jalaliStr: string): number {
  const clean = normalizeJalaliDigits(jalaliStr);
  const parts = clean.split('/');
  if (parts.length !== 3) return 0;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return 0;

  // Leap years in Persian calendar: roughly (y * 8 + 21) / 33
  const leapDays = Math.floor((y * 8 + 21) / 33);
  let totalDays = y * 365 + leapDays;

  // Add days in current year before month m
  if (m <= 6) {
    totalDays += (m - 1) * 31;
  } else {
    totalDays += 6 * 31 + (m - 7) * 30;
  }

  totalDays += d;
  return totalDays;
}

/**
 * Calculates exact difference in days between two Jalali dates (targetDate - baseDate)
 * Returns positive if targetDate is in the future, negative if in the past, 0 if same day.
 */
export function getJalaliDaysDifference(targetDate: string, baseDate?: string): number {
  const base = baseDate ? normalizeJalaliDigits(baseDate) : normalizeJalaliDigits(getTodayJalaliDate());
  const target = normalizeJalaliDigits(targetDate);
  if (!target) return 0;

  const daysTarget = jalaliToAbsoluteDays(target);
  const daysBase = jalaliToAbsoluteDays(base);

  if (daysTarget === 0 || daysBase === 0) return 0;
  return daysTarget - daysBase;
}

export interface ScheduleStatusEvaluation {
  status: InspectionScheduleAlertStatus;
  color: 'green' | 'yellow' | 'red' | 'gray';
  daysRemaining: number | null;
  thresholdUsed: number;
  labelFa: string;
  labelEn: string;
  badgeClass: string;
  rowBorderClass: string;
  rowBgClass: string;
  dotColorClass: string;
  messageFa: string;
  messageEn: string;
}

/**
 * Evaluates the 4-tier schedule status for a checklist:
 * 1. GREEN (سبز): انجام شده / معتبر (VALID)
 * 2. YELLOW (زرد): نزدیک شدن به موعد بازرسی (WARNING)
 * 3. RED (قرمز): سررسید گذشته (OVERDUE)
 * 4. GRAY (خاکستری): هنوز برنامه‌ریزی نشده (NOT_SCHEDULED)
 */
export function evaluateChecklistScheduleStatus(
  nextInspectionDate: string | undefined,
  inspectionType?: string,
  actualInspectionDate?: string,
  checklistTypeId?: string,
  customSettings?: InspectionAlertSettings,
  isArchivedCycle?: boolean,
  supersededByInspectionId?: string
): ScheduleStatusEvaluation {
  // If this cycle was already fulfilled and superseded by a newer re-inspection, it is 100% completed and valid
  if (isArchivedCycle) {
    return {
      status: 'VALID',
      color: 'green',
      daysRemaining: null,
      thresholdUsed: 0,
      labelFa: 'انجام شده (دوره قبل)',
      labelEn: 'Completed (Prior Cycle)',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 font-bold',
      rowBorderClass: 'border-l-4 border-l-emerald-600 dark:border-l-emerald-500 opacity-80',
      rowBgClass: 'bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40',
      dotColorClass: 'bg-emerald-600',
      messageFa: supersededByInspectionId
        ? `این چک‌لیست با موفقیت انجام شده و با ثبت بازرسی دوره‌ای جدید (${supersededByInspectionId}) تکمیل و بایگانی گردیده است.`
        : 'این چک‌لیست مربوط به دوره قبل بوده و با موفقیت تکمیل و بایگانی شده است.',
      messageEn: supersededByInspectionId
        ? `Fulfilled and superseded by new inspection cycle ${supersededByInspectionId}.`
        : 'Completed historical cycle.'
    };
  }

  const normType = normalizeInspectionType(inspectionType);
  const settings = customSettings || getInspectionAlertSettings();

  // If inspection is PRE_OP or POST_OP without specific next due date, it's event-based (NOT_SCHEDULED)
  if (!nextInspectionDate || (normType !== 'PERIODIC' && !nextInspectionDate)) {
    return {
      status: 'NOT_SCHEDULED',
      color: 'gray',
      daysRemaining: null,
      thresholdUsed: 0,
      labelFa: 'هنوز برنامه‌ریزی نشده',
      labelEn: 'Unscheduled',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      rowBorderClass: 'border-l-4 border-l-slate-400 dark:border-l-slate-600',
      rowBgClass: 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50',
      dotColorClass: 'bg-slate-400',
      messageFa: 'این چک‌لیست فاقد موعد سررسید بعدی است یا به صورت موردی/قبل‌عملیات اجرا شده است.',
      messageEn: 'No future due date assigned or ad-hoc.'
    };
  }

  const daysRemaining = getJalaliDaysDifference(nextInspectionDate);

  // Get threshold for this specific checklist type or fallback to default
  const threshold = (checklistTypeId && settings.customThresholdsByType && settings.customThresholdsByType[checklistTypeId])
    ? settings.customThresholdsByType[checklistTypeId]
    : settings.warningThresholdDays;

  // OVERDUE (قرمز: سررسید گذشته)
  if (daysRemaining < 0) {
    const absOverdue = Math.abs(daysRemaining);
    return {
      status: 'OVERDUE',
      color: 'red',
      daysRemaining,
      thresholdUsed: threshold,
      labelFa: 'سررسید گذشته',
      labelEn: 'Overdue',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800 font-black',
      rowBorderClass: 'border-l-4 border-l-rose-600 dark:border-l-rose-500',
      rowBgClass: 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-100/50 dark:hover:bg-rose-900/30',
      dotColorClass: 'bg-rose-500 animate-ping',
      messageFa: `${absOverdue} روز از موعد سررسید بازرسی گذشته است! اقدام فوری لازم است.`,
      messageEn: `Overdue by ${absOverdue} days! Immediate action required.`
    };
  }

  // WARNING (زرد: نزدیک شدن به موعد بازرسی)
  if (daysRemaining <= threshold) {
    return {
      status: 'WARNING',
      color: 'yellow',
      daysRemaining,
      thresholdUsed: threshold,
      labelFa: 'نزدیک شدن به موعد بازرسی',
      labelEn: 'Approaching Due Date',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 font-black animate-pulse',
      rowBorderClass: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
      rowBgClass: 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-900/30',
      dotColorClass: 'bg-amber-500',
      messageFa: daysRemaining === 0 
        ? 'امروز موعد سررسید این بازرسی است!' 
        : `تنها ${daysRemaining} روز تا موعد سررسید بازرسی بعدی باقی مانده است (هشدار زمانی فعال شده: ${threshold} روز قبل).`,
      messageEn: daysRemaining === 0
        ? 'Inspection due today!'
        : `${daysRemaining} days remaining until due date.`
    };
  }

  // VALID (سبز: انجام شده / معتبر)
  return {
    status: 'VALID',
    color: 'green',
    daysRemaining,
    thresholdUsed: threshold,
    labelFa: 'انجام شده / معتبر',
    labelEn: 'Valid / On-Schedule',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700 font-bold',
    rowBorderClass: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400',
    rowBgClass: 'hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10',
    dotColorClass: 'bg-emerald-500',
    messageFa: `دارای اعتبار کامل (${daysRemaining} روز تا سررسید بعدی باقی مانده است).`,
    messageEn: `Valid (${daysRemaining} days remaining).`
  };
}

