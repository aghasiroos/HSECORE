import * as XLSX from 'xlsx';
import { TrirRecord, TrirSeriesPoint } from '../../types';
import {
  normalizePersianArabicText,
  normalizeForMatching,
  cleanPersianValue,
  normalizeDigits
} from '../../utils/textNormalization';

export const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 
  'تیر', 'مرداد', 'شهریور', 
  'مهر', 'آبان', 'آذر', 
  'دی', 'بهمن', 'اسفند'
];

export interface ParsedTrirRow {
  id?: string;
  year: number;
  month: string;
  attendance: number;
  mission: number;
  contractor: number;
  incidents: number;
  notes?: string;
  totalHours: number;
  monthlyTRIR: number;
  isValid: boolean;
  validationError?: string;
  isDuplicateWithExisting?: boolean;
  rowNumber: number;
}

/**
 * Downloads a well-formatted template Excel file with clear Persian headers and sample data
 */
export function downloadTrirExcelTemplate() {
  const wb = XLSX.utils.book_new();

  const headers = [
    'سال (شمسی)',
    'ماه',
    'حضور پرسنل (ساعت)',
    'ماموریت شهری (ساعت)',
    'کارکرد پیمانکاران (ساعت)',
    'تعداد حوادث LTI',
    'توضیحات کارگاه (اختیاری)'
  ];

  const sampleRows = [
    [1404, 'فروردین', 62500, 850, 2400, 0, 'عملیات عادی بدون حادثه'],
    [1404, 'اردیبهشت', 64200, 920, 3100, 0, 'پروژه اورهال فاز یک'],
    [1404, 'خرداد', 61800, 780, 2900, 1, 'حادثه جزئی شکستگی دست در کارگاه فلزی'],
    [1404, 'تیر', 65100, 1100, 3400, 0, 'کنترل شرایط استرس گرمایی'],
    [1404, 'مرداد', 66000, 1050, 3800, 0, 'عملیات با ایمنی کامل'],
    [1404, 'شهریور', 63400, 980, 2750, 0, 'ثبت رکورد ۱ میلیون نفرساعت بدون حادثه'],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths for easy reading
  ws['!cols'] = [
    { wch: 14 }, // سال
    { wch: 14 }, // ماه
    { wch: 22 }, // حضور پرسنل
    { wch: 22 }, // ماموریت
    { wch: 24 }, // کارکرد پیمانکاران
    { wch: 18 }, // تعداد حوادث
    { wch: 38 }  // توضیحات
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'الگوی آمار کارکرد TRIR');

  // Also add an instruction guide sheet
  const guideHeaders = ['راهنمای تکمیل فایل اکسل آمار کارکرد و حوادث ماهانه'];
  const guideData = [
    guideHeaders,
    ['۱. سال: عدد ۴ رقمی شمسی مانند 1404 یا 1405 وارد کنید.'],
    ['۲. ماه: نام ماه شمسی به فارسی (فروردین، اردیبهشت، ...، اسفند) یا عدد ۱ تا ۱۲.'],
    ['۳. ساعت حضور پرسنل: مجموع ساعت حضور کارکنان مستقیم کارگاه در طول ماه بدون مأموریت.'],
    ['۴. ماموریت شهری/اداری: مجموع ساعات مأموریت درون‌شهری یا برون‌شهری پرسنل کارگاه.'],
    ['۵. کارکرد پیمانکاران: مجموع ساعات کارکرد نیروهای پیمانکاری زیرمجموعه در سایت.'],
    ['۶. تعداد حوادث LTI: تعداد وقایع و حوادث قابل ثبت منجر به تلفات زمان یا آسیب‌های پزشکی قانونی.'],
    ['۷. فرمول محاسبه TRIR ماهانه: (تعداد حوادث × ۱,۰۰۰,۰۰۰) ÷ مجموع کل ساعات کارکرد'],
    ['۸. لطفاً از تغییر دادن عناوین ستون‌ها در سطر اول خودداری فرمایید.']
  ];
  const guideWs = XLSX.utils.aoa_to_sheet(guideData);
  guideWs['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, guideWs, 'راهنما');

  XLSX.writeFile(wb, 'الگوی_اکسل_امار_کارکرد_و_حوادث_TRIR.xlsx');
}

/**
 * Normalizes month input (string name or number 1-12) to standard Persian month
 */
function normalizeMonth(input: any): string | null {
  if (input === null || input === undefined) return null;
  const digitsClean = normalizeDigits(input, true);
  
  // If it's a numeric month like 1 or "1" or "۰۱"
  if (digitsClean) {
    const num = parseInt(digitsClean, 10);
    if (!isNaN(num) && num >= 1 && num <= 12) {
      return PERSIAN_MONTHS[num - 1];
    }
  }

  const normInput = normalizeForMatching(input);

  // Check against persian months using normalized comparison
  for (const m of PERSIAN_MONTHS) {
    const normM = normalizeForMatching(m);
    if (normInput.includes(normM) || normM.includes(normInput)) {
      return m;
    }
  }

  return null;
}

/**
 * Parses user-uploaded Excel file for TRIR monthly records
 */
export async function parseTrirExcelFile(
  file: File, 
  existingRecords: TrirRecord[]
): Promise<{ rows: ParsedTrirRow[]; totalValid: number; totalInvalid: number; duplicateCount: number }> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  if (!workbook.SheetNames.length) {
    throw new Error('فایل اکسل ارائه‌شده هیچ برگه اطلاعاتی (Sheet) ندارد.');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('فایل اکسل خالی است یا سطر داده‌ای پس از هدر ندارد.');
  }

  // Find header row (usually first row, or search for 'سال' / 'ماه')
  let headerIndex = 0;
  let yearCol = -1;
  let monthCol = -1;
  let attCol = -1;
  let misCol = -1;
  let conCol = -1;
  let incCol = -1;
  let notesCol = -1;

  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = normalizeForMatching(row[c] || '');
      if (cell.includes('سال') || cell === 'year') yearCol = c;
      if (cell.includes('ماه') || cell === 'month') monthCol = c;
      if (cell.includes('حضور') || cell.includes('attendance') || cell.includes('کارکنان')) attCol = c;
      if (cell.includes('ماموریت') || cell.includes('ماموریت') || cell.includes('mission')) misCol = c;
      if (cell.includes('پیمانکار') || cell.includes('contractor')) conCol = c;
      if (cell.includes('حادثه') || cell.includes('حوادث') || cell.includes('lti') || cell.includes('incident')) incCol = c;
      if (cell.includes('توضیح') || cell.includes('یادداشت') || cell.includes('note') || cell.includes('کارگاه')) notesCol = c;
    }

    if (yearCol !== -1 && monthCol !== -1 && (attCol !== -1 || conCol !== -1)) {
      headerIndex = r;
      break;
    }
  }

  if (yearCol === -1 || monthCol === -1) {
    // Default fallback to columns 0 to 6
    yearCol = 0;
    monthCol = 1;
    attCol = 2;
    misCol = 3;
    conCol = 4;
    incCol = 5;
    notesCol = 6;
  }

  const parsedRows: ParsedTrirRow[] = [];
  let totalValid = 0;
  let totalInvalid = 0;
  let duplicateCount = 0;

  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.every(cell => cell === undefined || cell === null || String(cell).trim() === '')) {
      continue; // skip empty rows
    }

    const rawYear = row[yearCol];
    const rawMonth = row[monthCol];
    const rawAtt = attCol !== -1 ? row[attCol] : 0;
    const rawMis = misCol !== -1 ? row[misCol] : 0;
    const rawCon = conCol !== -1 ? row[conCol] : 0;
    const rawInc = incCol !== -1 ? row[incCol] : 0;
    const rawNotes = notesCol !== -1 ? row[notesCol] : '';

    const yearNum = parseInt(normalizeDigits(rawYear, true) || '0', 10);
    const normalizedM = normalizeMonth(rawMonth);
    const attNum = Math.max(0, parseFloat(normalizeDigits(rawAtt).replace(/,/g, '')) || 0);
    const misNum = Math.max(0, parseFloat(normalizeDigits(rawMis).replace(/,/g, '')) || 0);
    const conNum = Math.max(0, parseFloat(normalizeDigits(rawCon).replace(/,/g, '')) || 0);
    const incNum = Math.max(0, parseInt(normalizeDigits(rawInc, true) || '0', 10) || 0);
    const notesStr = rawNotes !== null && rawNotes !== undefined ? (typeof rawNotes === 'string' ? rawNotes : String(rawNotes)) : '';

    const totalHours = attNum + misNum + conNum;
    const monthlyTRIR = totalHours > 0 ? (incNum * 1000000) / totalHours : 0;

    let isValid = true;
    let validationError: string | undefined;

    if (!yearNum || yearNum < 1300 || yearNum > 1500) {
      isValid = false;
      validationError = 'سال نامعتبر است (باید بین ۱۳۰۰ تا ۱۵۰۰ باشد).';
    } else if (!normalizedM) {
      isValid = false;
      validationError = `ماه نامعتبر است: "${rawMonth || 'خالی'}".`;
    } else if (totalHours <= 0 && incNum > 0) {
      isValid = false;
      validationError = 'ساعات کارکرد کل صفر است در حالی که حادثه ثبت شده است.';
    }

    // Check duplicate with existing records using normalized matching
    const isDup = Boolean(normalizedM && existingRecords.some(er => er.year === yearNum && (normalizeMonth(er.month) === normalizedM || er.month === String(rawMonth))));
    if (isDup) {
      duplicateCount++;
    }

    if (isValid) {
      totalValid++;
    } else {
      totalInvalid++;
    }

    const exactMonthName = (rawMonth !== undefined && rawMonth !== null && String(rawMonth).trim() !== '') 
      ? (typeof rawMonth === 'string' ? rawMonth : String(rawMonth)) 
      : (normalizedM || 'نامشخص');

    parsedRows.push({
      year: yearNum || 1404,
      month: exactMonthName,
      attendance: attNum,
      mission: misNum,
      contractor: conNum,
      incidents: incNum,
      notes: notesStr || undefined,
      totalHours,
      monthlyTRIR,
      isValid,
      validationError,
      isDuplicateWithExisting: isDup,
      rowNumber: r + 1
    });
  }

  return {
    rows: parsedRows,
    totalValid,
    totalInvalid,
    duplicateCount
  };
}

/**
 * Export complete analytical TRIR data with all computed series to Excel
 */
export function exportTrirFullExcel(series: TrirSeriesPoint[], targetTRIR: number) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'ردیف',
    'سال',
    'ماه',
    'حضور پرسنل (ساعت)',
    'ماموریت شهری (ساعت)',
    'مجموع پرسنلی E (ساعت)',
    'کارکرد پیمانکاران (ساعت)',
    'مجموع کل کارکرد کارگاه (ساعت)',
    'تعداد حوادث LTI',
    'نرخ TRIR ماهانه',
    'نرخ TRIR رولینگ ۱۲ ماهه',
    'هدف کارگاه',
    'وضعیت ایمنی',
    'توضیحات'
  ];

  const rows = series.map((r, idx) => {
    const monTrir = (!isNaN(r.monthlyTRIR) ? r.monthlyTRIR : 0);
    const rolTrir = (!isNaN(r.rollingTRIR) ? r.rollingTRIR : 0);
    
    let status = 'ایمن';
    if (rolTrir > targetTRIR * 1.15) {
      status = 'پرخطر (فراتر از هدف)';
    } else if (rolTrir > targetTRIR * 0.8) {
      status = 'نزدیک به آستانه هدف';
    }

    return [
      idx + 1,
      r.year,
      r.month,
      r.attendance,
      r.mission,
      r.E,
      r.contractor,
      r.totalHours,
      r.incidents,
      Number(monTrir.toFixed(3)),
      Number(rolTrir.toFixed(3)),
      targetTRIR,
      status,
      r.notes || ''
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 8 },  // ردیف
    { wch: 10 }, // سال
    { wch: 12 }, // ماه
    { wch: 18 }, // حضور
    { wch: 18 }, // ماموریت
    { wch: 20 }, // E
    { wch: 20 }, // پیمانکار
    { wch: 24 }, // کل کارکرد
    { wch: 14 }, // حوادث
    { wch: 16 }, // TRIR ماهانه
    { wch: 20 }, // TRIR رولینگ
    { wch: 12 }, // هدف
    { wch: 22 }, // وضعیت
    { wch: 30 }  // توضیحات
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'گزارش تحلیلی TRIR');
  XLSX.writeFile(wb, `گزارش_جامع_پایش_TRIR_${Date.now()}.xlsx`);
}
