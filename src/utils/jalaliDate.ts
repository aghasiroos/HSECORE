/**
 * High Precision Jalali (Shamsi) & Gregorian Dual-Calendar Engine
 * Accurately handles conversions, leap years, formatting, parsing, and day-of-week.
 */

export interface JalaliDateObj {
  jy: number;
  jm: number; // 1 - 12
  jd: number; // 1 - 31
}

export interface GregorianDateObj {
  gy: number;
  gm: number; // 1 - 12
  gd: number; // 1 - 31
}

export const JALALI_MONTH_NAMES_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export const JALALI_MONTH_NAMES_EN = [
  'Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'
];

export const PERSIAN_WEEK_DAYS_FA = [
  { key: 'sat', short: 'ش', full: 'شنبه' },
  { key: 'sun', short: 'ی', full: 'یکشنبه' },
  { key: 'mon', short: 'د', full: 'دوشنبه' },
  { key: 'tue', short: 'س', full: 'سه‌شنبه' },
  { key: 'wed', short: 'چ', full: 'چهارشنبه' },
  { key: 'thu', short: 'پ', full: 'پنج‌شنبه' },
  { key: 'fri', short: 'ج', full: 'جمعه' }
];

export const GREGORIAN_MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const GREGORIAN_MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Digits converter
export const toPersianDigits = (n: number | string): string => {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (w) => farsiDigits[+w]);
};

export const toEnglishDigits = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
};

const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

/** Check if Gregorian year is leap year */
export function isGregorianLeapYear(gy: number): boolean {
  return (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
}

/** Check if Jalali year is leap year (33-year cycle algorithm) */
export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
  ];
  const bl = breaks.length;
  let jp = breaks[0];
  let jm: number;
  let jump: number;
  let leap: number;
  let n: number;
  let i: number;

  if (jy < jp || jy >= breaks[bl - 1]) {
    // Standard approximation fallback
    const r = jy % 33;
    return [1, 5, 9, 13, 17, 22, 26, 30].includes(r);
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) {
      break;
    }
    jp = jm;
  }
  n = jy - jp;

  if (jump! - n < 6) {
    n = n - jump! + (Math.floor(jump! / 33) * 33);
  }
  leap = ((n + 1) % 33) - 1;
  if (leap === -1) {
    leap = 4;
  }
  return (leap % 4 === 0 && leap !== 0);
}

/** Number of days in a given Jalali month */
export function getJalaliMonthDaysCount(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29;
  return 30;
}

/** Convert Gregorian to Jalali */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDateObj {
  let g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

/** Convert Jalali to Gregorian */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDateObj {
  let gy: number;
  let days: number;
  let gd: number;
  let gm: number;
  let sal_a: number[];

  jy += 1595;
  days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? ((jm - 1) * 31) : (((jm - 7) * 30) + 186));
  gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  gd = days + 1;
  sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (gm = 0; gm < 13; gm++) {
    let v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return { gy, gm, gd };
}

/** Get day of week index for a Jalali date: 0=Saturday (شنبه) to 6=Friday (جمعه) */
export function getJalaliDayOfWeek(jy: number, jm: number, jd: number): number {
  const g = jalaliToGregorian(jy, jm, jd);
  const date = new Date(g.gy, g.gm - 1, g.gd);
  // JS getDay(): 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
  const jsDay = date.getDay();
  // Map to Saturday=0, Sunday=1, ..., Friday=6
  return (jsDay + 1) % 7;
}

/** Parse any date string into normalized Jalali object and optional time */
export function parseDateString(val: string | null | undefined): {
  jalali: JalaliDateObj | null;
  gregorian: GregorianDateObj | null;
  time: string; // "HH:mm"
  originalStr: string;
} {
  if (!val) {
    return { jalali: null, gregorian: null, time: '', originalStr: '' };
  }

  const clean = toEnglishDigits(String(val).trim());
  let timeStr = '';

  // Extract time if exists (e.g., "1405/06/04 14:30" or "2026-08-26T14:30:00")
  const timeMatch = clean.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (timeMatch) {
    timeStr = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
  }

  // Remove time and extra chars to extract date parts
  const datePartOnly = clean.replace(/T.*$/, '').replace(/\s+\d{1,2}:\d{2}.*$/, '').trim();
  const parts = datePartOnly.split(/[/.-]/).map(p => parseInt(p, 10)).filter(p => !isNaN(p));

  if (parts.length >= 3) {
    let y = parts[0];
    let m = parts[1];
    let d = parts[2];

    // Detect if Jalali year (e.g. 1300 - 1500)
    if (y >= 1300 && y <= 1500) {
      const jm = Math.min(12, Math.max(1, m));
      const maxD = getJalaliMonthDaysCount(y, jm);
      const jd = Math.min(maxD, Math.max(1, d));
      const jObj = { jy: y, jm, jd };
      const gObj = jalaliToGregorian(y, jm, jd);
      return { jalali: jObj, gregorian: gObj, time: timeStr, originalStr: val };
    }

    // Detect if Gregorian year (e.g. 1900 - 2100)
    if (y >= 1900 && y <= 2100) {
      const gm = Math.min(12, Math.max(1, m));
      const gd = Math.min(31, Math.max(1, d));
      const gObj = { gy: y, gm, gd };
      const jObj = gregorianToJalali(y, gm, gd);
      return { jalali: jObj, gregorian: gObj, time: timeStr, originalStr: val };
    }
  }

  // Fallback: try JS Date
  const jsDate = new Date(val);
  if (!isNaN(jsDate.getTime())) {
    const gy = jsDate.getFullYear();
    const gm = jsDate.getMonth() + 1;
    const gd = jsDate.getDate();
    const gObj = { gy, gm, gd };
    const jObj = gregorianToJalali(gy, gm, gd);
    if (!timeStr) {
      timeStr = `${String(jsDate.getHours()).padStart(2, '0')}:${String(jsDate.getMinutes()).padStart(2, '0')}`;
    }
    return { jalali: jObj, gregorian: gObj, time: timeStr, originalStr: val };
  }

  return { jalali: null, gregorian: null, time: timeStr, originalStr: val };
}

/** Get Current Jalali Date object */
export function getTodayJalaliObj(): JalaliDateObj {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Get Current Shamsi Year as number (e.g. 1405) */
export function getCurrentShamsiYear(): number {
  return getTodayJalaliObj().jy;
}

/** Get Current Shamsi Date as YYYY/MM/DD */
export function getShamsiToday(): string {
  return getCurrentJalaliDate(false);
}

/** Get Current Shamsi Date & Time formatted with Persian locale or standard Jalali fallback */
export function getCurrentShamsiTimestamp(): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return formatter.format(now).replace(/\//g, '/');
  } catch {
    return getCurrentJalaliDate(true);
  }
}

/** Get Current Jalali Date as YYYY/MM/DD */
export function getCurrentJalaliDate(includeTime = false): string {
  const today = getTodayJalaliObj();
  const dateStr = formatJalaliString(today.jy, today.jm, today.jd);
  if (includeTime) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return `${dateStr} ${h}:${m}`;
  }
  return dateStr;
}

/** Format YYYY/MM/DD */
export function formatJalaliString(jy: number, jm: number, jd: number): string {
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

/** Format Gregorian YYYY-MM-DD */
export function formatGregorianString(gy: number, gm: number, gd: number): string {
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

/** Format Persian full text: «۴ شهریور ۱۴۰۵» */
export function formatJalaliFullText(jy: number, jm: number, jd: number, isFa = true): string {
  const monthName = isFa ? JALALI_MONTH_NAMES_FA[jm - 1] : JALALI_MONTH_NAMES_EN[jm - 1];
  const dayStr = isFa ? toPersianDigits(jd) : jd;
  const yearStr = isFa ? toPersianDigits(jy) : jy;
  return `${dayStr} ${monthName} ${yearStr}`;
}

/** Format Gregorian full text: «26 Aug 2026» */
export function formatGregorianFullText(gy: number, gm: number, gd: number): string {
  const monthName = GREGORIAN_MONTH_NAMES_SHORT[gm - 1];
  return `${gd} ${monthName} ${gy}`;
}

/** Dual Date formatting for tooltips & badges */
export function getDualDateDisplay(val: string | null | undefined): {
  shamsi: string;
  miladi: string;
  fullShamsi: string;
  fullMiladi: string;
  dayOfWeek: string;
  time: string;
} {
  const parsed = parseDateString(val);
  if (!parsed.jalali || !parsed.gregorian) {
    return {
      shamsi: val || '—',
      miladi: '—',
      fullShamsi: '—',
      fullMiladi: '—',
      dayOfWeek: '—',
      time: parsed.time || ''
    };
  }

  const { jy, jm, jd } = parsed.jalali;
  const { gy, gm, gd } = parsed.gregorian;
  const dowIdx = getJalaliDayOfWeek(jy, jm, jd);

  return {
    shamsi: formatJalaliString(jy, jm, jd),
    miladi: formatGregorianString(gy, gm, gd),
    fullShamsi: `${PERSIAN_WEEK_DAYS_FA[dowIdx].full}، ${formatJalaliFullText(jy, jm, jd, true)}`,
    fullMiladi: `${formatGregorianFullText(gy, gm, gd)}`,
    dayOfWeek: PERSIAN_WEEK_DAYS_FA[dowIdx].full,
    time: parsed.time
  };
}

/** Converts any Jalali date string to Gregorian YYYY-MM-DD */
export function jalaliToGregorianStr(val: string): string {
  const parsed = parseDateString(val);
  if (!parsed.gregorian) return '';
  return formatGregorianString(parsed.gregorian.gy, parsed.gregorian.gm, parsed.gregorian.gd);
}

/** Converts any Gregorian date string to Jalali YYYY/MM/DD */
export function gregorianToJalaliStr(val: string): string {
  const parsed = parseDateString(val);
  if (!parsed.jalali) return '';
  return formatJalaliString(parsed.jalali.jy, parsed.jalali.jm, parsed.jalali.jd);
}

/**
 * Calculates accurate age based on birth date string (Shamsi or Gregorian)
 * Takes into account the exact current date (year, month, day).
 */
export function calculateExactAge(birthDateStr: string | null | undefined): number {
  if (!birthDateStr) return 0;
  const parsed = parseDateString(birthDateStr);
  if (!parsed.jalali) return 0;

  const today = getTodayJalaliObj();
  const { jy: bYear, jm: bMonth, jd: bDay } = parsed.jalali;

  let age = today.jy - bYear;
  // If current month is before birth month, or same month and current day is before birth day, subtract 1
  if (today.jm < bMonth || (today.jm === bMonth && today.jd < bDay)) {
    age--;
  }

  return Math.max(0, age);
}

