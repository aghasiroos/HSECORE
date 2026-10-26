import * as XLSX from 'xlsx';
import { WarningRecord } from '../../types';
import { normalizeForMatching, normalizeDigits } from '../../utils/textNormalization';
import { findPersonnelByCode, getComplexPersonnelList } from '../../utils/personnelHelper';
import { getUnits } from '../../utils/orgHelper';

export { normalizeDigits };

export interface ParsedWarningRow {
  record: WarningRecord;
  isValid: boolean;
  validationErrors: string[];
  isDuplicate: boolean;
  rowNumber: number;
}

export interface ParseWarningsResult {
  rows: ParsedWarningRow[];
  totalCount: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}

/**
 * Standard Persian months list for normalization
 */
export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

/**
 * Normalizes month names or numbers (1-12) to standard Persian month string
 */
export function normalizeMonth(input: any): string {
  if (!input) return 'فروردین';
  const clean = normalizeDigits(input, true).trim();
  
  // If it's a number 1-12
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return PERSIAN_MONTHS[num - 1];
  }

  // Text match
  const normalized = normalizeForMatching(clean);
  for (const m of PERSIAN_MONTHS) {
    if (normalizeForMatching(m) === normalized || normalized.includes(normalizeForMatching(m))) {
      return m;
    }
  }

  return 'فروردین';
}

/**
 * Generates and downloads a standardized Persian Excel Template for Safety Warnings
 */
export function downloadWarningsExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // Column Headers in Persian
  const headers = [
    'شماره ابلاغیه',
    'سال (شمسی)',
    'ماه',
    'روز',
    'سایت / کارگاه',
    'نوع اخطار (فردی / واحدی)',
    'نام و نام خانوادگی / نام واحد',
    'کد پرسنلی',
    'کد ملی',
    'سمت / شغل',
    'واحد سازمانی',
    'دپارتمان',
    'سرپرست مستقیم',
    'علت اخطار / شرح تخلف ایمنی',
    'تکرار اخطار'
  ];

  // Dynamic Rows from Central Personnel & Organizational Structure
  const personnelList = getComplexPersonnelList();
  const unitsList = getUnits();
  const sampleRows = personnelList.slice(0, 3).map((p, idx) => [
    `HSE/W/1404/00${idx + 1}`,
    1404,
    'فروردین',
    10 + idx,
    p.workplace || '',
    'فردی',
    p.fullName || '',
    p.personnelCode || '',
    p.nationalCode || '',
    p.jobTitle || '',
    p.subUnit || p.unit || unitsList[0] || '',
    p.unit || p.department || unitsList[0] || '',
    p.supervisor || '',
    'شرح تخلف یا عدم رعایت الزامات ایمنی',
    'اولین'
  ]);

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column Widths
  ws['!cols'] = [
    { wch: 18 }, // شماره ابلاغیه
    { wch: 12 }, // سال
    { wch: 14 }, // ماه
    { wch: 8 },  // روز
    { wch: 15 }, // سایت
    { wch: 22 }, // نوع اخطار
    { wch: 25 }, // نام
    { wch: 14 }, // کد پرسنلی
    { wch: 16 }, // کد ملی
    { wch: 20 }, // سمت
    { wch: 20 }, // واحد سازمانی
    { wch: 18 }, // دپارتمان
    { wch: 18 }, // سرپرست مستقیم
    { wch: 60 }, // علت اخطار
    { wch: 14 }  // تکرار اخطار
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'الگوی اخطارهای ایمنی');

  // Sheet 2: Guide Instructions
  const guideData = [
    ['راهنمای تکمیل فایل اکسل ورود اطلاعات اخطارهای ایمنی و عدم انطباق'],
    [''],
    ['۱. شماره ابلاغیه: شماره یا کد اخطار (مانند HSE/W/1404/001). در صورت خالی گذاشتن، سامانه به‌صورت خودکار شماره متوالی استاندارد تولید می‌کند.'],
    ['۲. سال شمسی: عدد ۴ رقمی مانند 1404 یا 1405.'],
    ['۳. ماه: نام ماه شمسی به فارسی (فروردین، اردیبهشت، ...، اسفند) یا عدد ۱ تا ۱۲.'],
    ['۴. روز: عدد بین ۱ تا ۳۱.'],
    ['۵. سایت / کارگاه: نام سایت یا کارگاه پروژه (پیش‌فرض: رجال).'],
    ['۶. نوع اخطار: حتماً یکی از دو مقدار «فردی» یا «واحدی» درج شود.'],
    ['۷. نام و نام خانوادگی: برای اخطارهای فردی نام شخص متخلف، و برای اخطارهای واحدی نام واحد یا ایستگاه کاری (الزامی).'],
    ['۸. کد پرسنلی: عدد کد پرسنلی شخص. در صورت وارد کردن، سامانه اطلاعات تکمیلی پرسنل را از کارتابل مرکزی واکشی می‌کند.'],
    ['۹. علت اخطار / شرح تخلف: شرح دقیق عدم انطباق ایمنی، استاندارد نقض‌شده یا رفتار ناایمن مشاهده‌شده (الزامی).'],
    ['۱۰. تکرار اخطار: مراتب اخطار مانند «اولین»، «دومین»، «سومین» یا موارد مشابه.'],
    ['۱۱. توجه مهم: لطفاً سطر اول (عناوین ستون‌ها) را تغییر ندهید یا حذف نکنید.']
  ];

  const guideWs = XLSX.utils.aoa_to_sheet(guideData);
  guideWs['!cols'] = [{ wch: 90 }];
  XLSX.utils.book_append_sheet(wb, guideWs, 'راهنمای تکمیل');

  XLSX.writeFile(wb, 'الگوی_اکسل_ثبت_اخطارهای_ایمنی_HSE.xlsx');
}

/**
 * Exports existing warning records to a formatted Excel (.xlsx) file
 */
export function exportWarningsToExcel(warnings: WarningRecord[]) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'ردیف',
    'شماره ابلاغیه',
    'تاریخ صدور',
    'سال',
    'ماه',
    'روز',
    'سایت',
    'نوع اخطار',
    'نام و نام خانوادگی / واحد',
    'کد پرسنلی',
    'کد ملی',
    'سمت / شغل',
    'واحد سازمانی',
    'دپارتمان',
    'سرپرست مستقیم',
    'علت اخطار',
    'تکرار اخطار'
  ];

  const rows = warnings.map((w, idx) => [
    idx + 1,
    w.number || '',
    `${w.year || 1404}/${w.month || 'فروردین'}/${w.day || 1}`,
    w.year || 1404,
    w.month || 'فروردین',
    w.day || 1,
    w.site || '',
    w.type || 'فردی',
    w.name || '',
    w.personnelCode || '',
    w.nationalCode || '',
    w.jobTitle || '',
    w.unit || '',
    w.department || '',
    w.supervisor || '',
    w.reason || '',
    w.repetitionText || 'اولین'
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 25 },
    { wch: 14 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 55 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'فهرست اخطارهای ایمنی');
  XLSX.writeFile(wb, `گزارش_جامع_اخطارهای_ایمنی_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xlsx`);
}

/**
 * Flexible column header detector based on Persian/English variations
 */
function detectWarningColumns(headerRow: any[]): Record<string, number> {
  const colMap: Record<string, number> = {
    number: -1,
    year: -1,
    month: -1,
    day: -1,
    site: -1,
    type: -1,
    name: -1,
    personnelCode: -1,
    nationalCode: -1,
    jobTitle: -1,
    unit: -1,
    department: -1,
    supervisor: -1,
    reason: -1,
    repetitionText: -1
  };

  headerRow.forEach((cell, idx) => {
    const str = normalizeForMatching(cell || '');

    // Number / Notice
    if (str.includes('ابلاغ') || str.includes('شماره اخطار') || str.includes('کد اخطار') || str.includes('notice') || str === 'number') {
      if (colMap.number === -1) colMap.number = idx;
    }
    // Year
    else if (str.includes('سال') || str === 'year') {
      if (colMap.year === -1) colMap.year = idx;
    }
    // Month
    else if (str.includes('ماه') || str === 'month') {
      if (colMap.month === -1) colMap.month = idx;
    }
    // Day
    else if (str.includes('روز') || str === 'day') {
      if (colMap.day === -1) colMap.day = idx;
    }
    // Site
    else if (str.includes('سایت') || str.includes('کارگاه') || str.includes('site') || str.includes('location')) {
      if (colMap.site === -1) colMap.site = idx;
    }
    // Type (فردی / واحدی)
    else if (str.includes('نوع') || str === 'type') {
      if (colMap.type === -1) colMap.type = idx;
    }
    // Name
    else if (str.includes('نام') || str.includes('پرسنل') || str.includes('name') || str.includes('کارمند')) {
      if (colMap.name === -1 && !str.includes('کد') && !str.includes('واحد')) colMap.name = idx;
    }
    // Personnel Code
    else if (str.includes('پرسنلی') || str.includes('کد پرسنل') || str.includes('personnelcode')) {
      if (colMap.personnelCode === -1) colMap.personnelCode = idx;
    }
    // National Code
    else if (str.includes('ملی') || str.includes('national')) {
      if (colMap.nationalCode === -1) colMap.nationalCode = idx;
    }
    // Job Title / Position
    else if (str.includes('سمت') || str.includes('شغل') || str.includes('عنوان') || str.includes('job') || str.includes('position')) {
      if (colMap.jobTitle === -1) colMap.jobTitle = idx;
    }
    // Unit
    else if (str.includes('واحد') || str.includes('unit')) {
      if (colMap.unit === -1 && !str.includes('نوع')) colMap.unit = idx;
    }
    // Department
    else if (str.includes('دپارتمان') || str.includes('بخش') || str.includes('department')) {
      if (colMap.department === -1) colMap.department = idx;
    }
    // Supervisor
    else if (str.includes('سرپرست') || str.includes('supervisor')) {
      if (colMap.supervisor === -1) colMap.supervisor = idx;
    }
    // Reason / Violation
    else if (str.includes('علت') || str.includes('تخلف') || str.includes('عدم انطباق') || str.includes('شرح') || str.includes('reason') || str.includes('violation')) {
      if (colMap.reason === -1) colMap.reason = idx;
    }
    // Repetition
    else if (str.includes('تکرار') || str.includes('مرتبه') || str.includes('نوبت') || str.includes('repetition')) {
      if (colMap.repetitionText === -1) colMap.repetitionText = idx;
    }
  });

  return colMap;
}

/**
 * Parses and validates an uploaded Excel file for Safety Warnings
 */
export async function parseWarningsExcelFile(
  file: File,
  existingRecords: WarningRecord[]
): Promise<ParseWarningsResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  if (!workbook.SheetNames.length) {
    throw new Error('فایل اکسل ارائه‌شده هیچ برگه اطلاعاتی (Sheet) ندارد.');
  }

  // Find the first sheet that contains warning records or default to first
  let targetSheetName = workbook.SheetNames[0];
  for (const sName of workbook.SheetNames) {
    if (sName.includes('اخطار') || sName.includes('warning') || sName.includes('ایمنی')) {
      targetSheetName = sName;
      break;
    }
  }

  const worksheet = workbook.Sheets[targetSheetName];
  const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('فایل اکسل خالی است یا سطری از داده‌ها در آن یافت نشد.');
  }

  // Find header row (search in first 5 rows)
  let headerIndex = 0;
  let colMap = detectWarningColumns(rawRows[0] || []);

  for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
    const candidateMap = detectWarningColumns(rawRows[r] || []);
    const matchCount = Object.values(candidateMap).filter(val => val !== -1).length;
    if (matchCount >= 3) {
      headerIndex = r;
      colMap = candidateMap;
      break;
    }
  }

  // Fallback if name or reason was not detected
  if (colMap.name === -1 && colMap.reason === -1) {
    // Basic positional fallback
    colMap = {
      number: 0,
      year: 1,
      month: 2,
      day: 3,
      site: 4,
      type: 5,
      name: 6,
      personnelCode: 7,
      nationalCode: 8,
      jobTitle: 9,
      unit: 10,
      department: 11,
      supervisor: 12,
      reason: 13,
      repetitionText: 14
    };
  }

  const existingNumbers = new Set(
    existingRecords
      .map(w => (w.number || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const parsedRows: ParsedWarningRow[] = [];
  const inMemoryFileNumbers = new Set<string>();

  // Determine starting notice counter if new numbers need to be auto-generated
  let maxNoticeNum = 1;
  existingRecords.forEach(w => {
    const match = (w.number || '').match(/(\d+)/g);
    if (match && match.length > 0) {
      const lastDigits = parseInt(match[match.length - 1], 10);
      if (!isNaN(lastDigits) && lastDigits >= maxNoticeNum) {
        maxNoticeNum = lastDigits + 1;
      }
    }
  });

  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.every(cell => cell === undefined || cell === null || String(cell).trim() === '')) {
      continue; // skip completely empty rows
    }

    const getVal = (colIdx: number): string => {
      if (colIdx === -1 || colIdx >= row.length) return '';
      const cell = row[colIdx];
      if (cell === null || cell === undefined) return '';
      return String(cell).trim();
    };

    let rawNumber = getVal(colMap.number);
    let rawYear = getVal(colMap.year);
    let rawMonth = getVal(colMap.month);
    let rawDay = getVal(colMap.day);
    let rawSite = getVal(colMap.site);
    let rawType = getVal(colMap.type);
    let rawName = getVal(colMap.name);
    let rawPersonnelCode = getVal(colMap.personnelCode);
    let rawNationalCode = getVal(colMap.nationalCode);
    let rawJobTitle = getVal(colMap.jobTitle);
    let rawUnit = getVal(colMap.unit);
    let rawDepartment = getVal(colMap.department);
    let rawSupervisor = getVal(colMap.supervisor);
    let rawReason = getVal(colMap.reason);
    let rawRepetition = getVal(colMap.repetitionText);

    const validationErrors: string[] = [];

    // Parse Year (Default to 1404 if empty or invalid)
    let yearNum = parseInt(normalizeDigits(rawYear, true), 10);
    if (isNaN(yearNum) || yearNum < 1380 || yearNum > 1460) {
      yearNum = 1404;
    }

    // Parse Month
    const normalizedMonth = normalizeMonth(rawMonth);

    // Parse Day (1-31)
    let dayNum = parseInt(normalizeDigits(rawDay, true), 10);
    if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      dayNum = 1;
    }

    // Name Validation (Mandatory)
    const cleanName = rawName.trim();
    if (!cleanName) {
      validationErrors.push('نام و نام خانوادگی پرسنل یا نام واحد سازمانی درج نشده است');
    }

    // Reason / Violation (Mandatory)
    const cleanReason = rawReason.trim();
    if (!cleanReason) {
      validationErrors.push('علت اخطار و شرح تخلف ایمنی درج نشده است');
    }

    // Warning Type (فردی یا واحدی)
    let warningType: 'فردی' | 'واحدی' = 'فردی';
    const normType = normalizeForMatching(rawType);
    if (normType.includes('واحد') || normType.includes('unit')) {
      warningType = 'واحدی';
    } else {
      warningType = 'فردی';
    }

    // Auto-enrich personnel details if personnel code is present
    const cleanPersonnelCode = normalizeDigits(rawPersonnelCode, true);
    let cleanNationalCode = normalizeDigits(rawNationalCode, true);
    let cleanJobTitle = rawJobTitle;
    let cleanUnit = rawUnit;
    let cleanDepartment = rawDepartment;
    let cleanSupervisor = rawSupervisor;

    if (cleanPersonnelCode) {
      try {
        const pRecord = findPersonnelByCode(cleanPersonnelCode);
        if (pRecord) {
          if (!cleanNationalCode && pRecord.nationalCode) cleanNationalCode = pRecord.nationalCode;
          if (!cleanJobTitle && pRecord.jobTitle) cleanJobTitle = pRecord.jobTitle;
          if (!cleanUnit && pRecord.unit) cleanUnit = pRecord.unit;
          if (!cleanDepartment && pRecord.department) cleanDepartment = pRecord.department;
          if (!cleanSupervisor && pRecord.supervisor) cleanSupervisor = pRecord.supervisor;
        }
      } catch (_) {}
    }

    // Notice Number Generation or Check
    let noticeNumber = normalizeDigits(rawNumber, true).trim();
    if (!noticeNumber) {
      noticeNumber = `HSE/W/${yearNum}/${String(maxNoticeNum++).padStart(3, '0')}`;
    }

    // Check duplicate notice numbers
    const numKey = noticeNumber.toLowerCase();
    const isDuplicate = existingNumbers.has(numKey) || inMemoryFileNumbers.has(numKey);
    inMemoryFileNumbers.add(numKey);

    const repetitionText = rawRepetition || 'اولین';
    const site = rawSite || 'رجال';

    const record: WarningRecord = {
      id: `w-imp-${Date.now()}-${r}-${Math.random().toString(36).substr(2, 4)}`,
      day: dayNum,
      month: normalizedMonth,
      year: yearNum,
      number: noticeNumber,
      site,
      name: cleanName || 'نامشخص',
      unit: cleanUnit || '',
      type: warningType,
      reason: cleanReason || 'نقض موازین ایمنی',
      personnelCode: cleanPersonnelCode || undefined,
      nationalCode: cleanNationalCode || undefined,
      jobTitle: cleanJobTitle || undefined,
      department: cleanDepartment || undefined,
      supervisor: cleanSupervisor || undefined,
      repetitionText
    };

    parsedRows.push({
      record,
      isValid: validationErrors.length === 0,
      validationErrors,
      isDuplicate,
      rowNumber: r + 1
    });
  }

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;
  const duplicateCount = parsedRows.filter(r => r.isDuplicate).length;

  return {
    rows: parsedRows,
    totalCount: parsedRows.length,
    validCount,
    invalidCount,
    duplicateCount
  };
}
