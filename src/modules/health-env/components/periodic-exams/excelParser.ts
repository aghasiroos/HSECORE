import * as XLSX from 'xlsx';
import { BASE_COLS, HEADER_MAP, BMI_CATS } from './seedData';
import {
  normalizePersianArabicText,
  normalizeForMatching,
  cleanPersianValue,
  cleanExcelCellValue,
  normalizeDigits
} from '../../../../utils/textNormalization';

// Normalizes Persian and Arabic text for comparison
export function normalizeHeader(str: any): string {
  if (str === null || str === undefined) return '';
  const norm = normalizeForMatching(str);
  return norm.replace(/[ـ\-_:()\/\[\]\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Canonical property map with exhaustive Persian, Arabic, and English aliases
export const COLUMN_ALIASES: Record<string, string[]> = {
  fname: [
    'نام', 'نام کوچک', 'اسم', 'نام پرسنل', 'fname', 'first_name', 'firstname', 'first name'
  ],
  lname: [
    'نام خانوادگی', 'نام خانوادگي', 'فامیلی', 'فامیل', 'شهرت', 'نام فامیل', 'lname', 'last_name', 'lastname', 'family'
  ],
  full_name: [
    'نام و نام خانوادگی', 'نام و نام خانوادگي', 'نام و نام خانوادگی پرسنل', 'نام کامل', 'نام و شهرت', 'نام و نشان', 'fullname', 'full_name', 'name'
  ],
  nid: [
    'کد ملی', 'کدملی', 'شماره ملی', 'شناسه ملی', 'کدملي', 'شماره ملي', 'کد ملی پرسنل', 'شماره شناسنامه', 'nid', 'national_id', 'nationalcode', 'melli_code', 'mellicode', 'ssn'
  ],
  pcode: [
    'کد پرسنلی', 'کدپرسنلی', 'شماره پرسنلی', 'شماره استخدامی', 'کد کارمندی', 'شماره کارمندی', 'شماره پرسنل', 'کدپرسنلي', 'pcode', 'personnel_id', 'personnel_code', 'emp_id', 'employee_id', 'personnel_no'
  ],
  company: [
    'محل خدمت', 'شرکت', 'واحد', 'بخش', 'قسمت', 'کارگاه', 'سازمان', 'نام شرکت', 'واحد سازمانی', 'دپارتمان', 'محل کار', 'company', 'department', 'unit', 'org', 'workplace'
  ],
  age: [
    'سن', 'age'
  ],
  gender: [
    'جنسیت', 'جنسيت', 'جنس', 'gender', 'sex'
  ],
  marital: [
    'وضعیت تاهل', 'وضعیت تأهل', 'تاهل', 'تأهل', 'marital', 'marital_status'
  ],
  exam_date: [
    'معاینات تاریخ انجام', 'تاریخ انجام معاینه', 'تاریخ معاینه', 'تاریخ نوبت', 'تاریخ انجام', 'تاریخ', 'exam_date', 'date', 'examination_date'
  ],
  exam_notes: [
    'معاینات علائم و توضیحات ثبت شده', 'توضیحات معاینات', 'علائم و توضیحات', 'شرح حال', 'علائم', 'توضیحات معاینه', 'exam_notes', 'notes'
  ],
  weight: [
    'وزن', 'وزن کیلوگرم', 'وزن kg', 'weight', 'wt'
  ],
  height: [
    'قد', 'قد سانتیمتر', 'قد سانتی متر', 'قد cm', 'height', 'ht'
  ],
  bmi: [
    'bmi', 'شاخص توده بدنی', 'بی ام آی', 'بی ام ای', 'توده بدنی', 'شاخص bmi'
  ],
  bp_sys: [
    'فشارخون سیستولیک', 'فشار خون سیستولیک', 'سیستول', 'فشار سیستول', 'فشار ماکزیمم', 'سیستولیک', 'bp_sys', 'systolic', 'sys'
  ],
  bp_dia: [
    'فشارخون دیاستولیک', 'فشار خون دیاستولیک', 'دیاستول', 'فشار دیاستول', 'فشار مینیمم', 'دیاستولیک', 'bp_dia', 'diastolic', 'dia'
  ],
  bp_combined: [
    'فشار خون', 'فشارخون', 'فشار', 'bp', 'blood_pressure', 'blood pressure'
  ],
  chol: [
    'chol', 'کلسترول', 'کلسترول توتال', 'کلسترول تام', 'cholesterol'
  ],
  tg: [
    'tg', 'تری گلیسیرید', 'تری گلیسرید', 'تری‌گلیسرید', 'triglyceride', 'triglycerides'
  ],
  hdl: [
    'hdl', 'کلسترول خوب', 'اچ دی ال'
  ],
  ldl: [
    'ldl', 'کلسترول بد', 'ال دی ال'
  ],
  fbs: [
    'fbs', 'قند خون', 'قند ناشتا', 'قند خون ناشتا', 'قند', 'blood_sugar', 'fasting_blood_sugar'
  ],
  hba1c: [
    'hba1c', 'هموگلوبین a1c', 'قند سه ماهه', 'هموگلوبین ای وان سی', 'hb a1c'
  ],
  bun: [
    'bun', 'اوره', 'بی یو ان', 'نیتروژن اوره'
  ],
  creat: [
    'creat', 'creatinine', 'کراتینین', 'کراتین'
  ],
  ast: [
    'ast', 'sgot', 'آنزیم ast'
  ],
  alt: [
    'alt', 'sgpt', 'آنزیم alt'
  ],
  alp: [
    'alp', 'آلکالین فسفاتاز', 'آلکالن فسفاتاز'
  ],
  rbc: [
    'cbc rbc', 'rbc', 'گلبول قرمز'
  ],
  wbc: [
    'cbc wbc', 'wbc', 'گلبول سفید'
  ],
  hb: [
    'نتایج آزمایش cbc hb', 'cbc hb', 'hb', 'hemoglobin', 'هموگلوبین'
  ],
  hct: [
    'نتایج آزمایش cbc hct', 'cbc hct', 'hct', 'hematocrit', 'هماتوکریت'
  ],
  plt: [
    'نتایج آزمایش cbc plt', 'cbc plt', 'plt', 'platelet', 'پلاکت'
  ],
  u_prt: [
    'نتایج آزمایش urinalysis urine protein prt', 'urine protein', 'u protein', 'u prt', 'پروتئین ادرار'
  ],
  u_glu: [
    'نتایج آزمایش urinalysis urine glucose glu', 'urine glucose', 'u glucose', 'u glu', 'قند ادرار'
  ],
  u_wbc: [
    'نتایج آزمایش urinalysis urine wbc', 'urine wbc', 'u wbc'
  ],
  u_rbc: [
    'نتایج آزمایش urinalysis urine rbc', 'urine rbc', 'u rbc'
  ],
  u_hb: [
    'نتایج آزمایش urinalysis urine hb', 'u hb'
  ],
  u_blood: [
    'نتایج آزمایش urinalysis urine blood', 'urine blood', 'u blood', 'خون در ادرار'
  ],
  psa: [
    'نتایج آزمایش cancer screening psa', 'psa', 'آنتی ژن پروستات'
  ],
  stool_ob: [
    'نتایج آزمایش stool analysis stool occult blood ob', 'stool ob', 'ob', 'خون مخفی مدفوع'
  ],
  lab_abnormal_cats: [
    'نتایج آزمایش دسته های غیرنرمال', 'دسته های غیرنرمال', 'آزمایش های غیرطبیعی', 'lab abnormal'
  ],
  haz_phys: [
    'عوامل زیان آور فیزیکی', 'زیان آور فیزیکی', 'فیزیکی', 'haz phys'
  ],
  haz_chem: [
    'عوامل زیان آور شیمیایی', 'زیان آور شیمیایی', 'شیمیایی', 'haz chem'
  ],
  haz_bio: [
    'عوامل زیان آور بیولوژیکی', 'زیان آور بیولوژیکی', 'بیولوژیکی', 'haz bio'
  ],
  haz_ergo: [
    'عوامل زیان آور ارگونومی', 'زیان آور ارگونومی', 'ارگونومی', 'haz ergo'
  ],
  haz_psych: [
    'عوامل زیان آور روانی', 'زیان آور روانی', 'روانی', 'haz psych'
  ],
  haz_other: [
    'عوامل زیان آور شرایط ویژه سایر موارد', 'شرایط ویژه', 'سایر عوامل', 'haz other'
  ],
  occ_health_opinion: [
    'نظریه کارشناس بهداشت حرفه ای', 'نظریه بهداشت حرفه ای', 'بهداشت حرفه ای'
  ],
  vis_r_unc: [
    'اپتومتری حدت بینایی دید دور r بدون اصلاح', 'دید راست بدون اصلاح', 'vis r unc'
  ],
  vis_l_unc: [
    'اپتومتری حدت بینایی دید دور l بدون اصلاح', 'دید چپ بدون اصلاح', 'vis l unc'
  ],
  vis_both_unc: [
    'اپتومتری حدت بینایی دید دور دوچشمی بدون اصلاح', 'دید دوچشم بدون اصلاح', 'vis both unc'
  ],
  vis_r_cor: [
    'اپتومتری حدت بینایی دید دور r با اصلاح', 'دید راست با اصلاح', 'vis r cor'
  ],
  vis_l_cor: [
    'اپتومتری حدت بینایی دید دور l با اصلاح', 'دید چپ با اصلاح', 'vis l cor'
  ],
  vis_both_cor: [
    'اپتومتری حدت بینایی دید دور دوچشمی با اصلاح', 'دید دوچشم با اصلاح', 'vis both cor'
  ],
  depth_perc: [
    'اپتومتری عمق دید ثانیه آرک', 'عمق دید', 'depth perception'
  ],
  audio_r: [
    'اودیومتری right result', 'شنوایی راست', 'اودیومتری راست', 'audio r'
  ],
  audio_l: [
    'اودیومتری left result', 'شنوایی چپ', 'اودیومتری چپ', 'audio l'
  ],
  spiro_date: [
    'اسپیرومتری تاریخ انجام', 'تاریخ اسپیرو', 'spiro date'
  ],
  spiro_result: [
    'اسپیرومتری result', 'نتیجه اسپیرومتری', 'اسپیرومتری', 'spiro result'
  ],
  spiro_notes: [
    'اسپیرومتری توضیحات', 'توضیحات اسپیرو', 'spiro notes'
  ],
  ecg: [
    'ecg diagnoses', 'ecg', 'نوار قلب', 'الکتروکاردیوگرام'
  ],
  mmpi: [
    'تست شخصیت mmpi تفسیر', 'mmpi', 'تست روانشناسی'
  ],
  cv_risk: [
    'خطرسنجی سکته های قلبی و مغزی خطر رویداد قلبی و عروقی در 10 سال آینده', 'خطرسنجی قلبی', 'ریسک قلبی', 'cv risk'
  ],
  nutr_date: [
    'ارزیابی تغذیه ای تاریخ انجام', 'تاریخ تغذیه', 'nutr date'
  ],
  nutr_advice: [
    'ارزیابی تغذیه ای توصیه های مشاور تغذیه', 'توصیه های تغذیه', 'توصیه تغذیه', 'nutr advice'
  ],
  dis_nonocc_new: [
    'بیماری ها بیماری های غیر شغلی جدید', 'غیر شغلی جدید', 'dis nonocc new'
  ],
  dis_nonocc_known: [
    'بیماری ها بیماری های غیر شغلی شناخته شده', 'غیر شغلی شناخته شده', 'dis nonocc known'
  ],
  dis_occ_new: [
    'بیماری ها بیماری های شغلی جدید', 'شغلی جدید', 'dis occ new'
  ],
  dis_occ_known: [
    'بیماری ها بیماری های شغلی شناخته شده', 'شغلی شناخته شده', 'dis occ known'
  ],
  ref1_type: ['ارجاع ها نوع تخصص ارجاع 1', 'نوع تخصص ارجاع 1', 'ارجاع 1'],
  ref1_status: ['ارجاع ها وضعیت ارجاع 1', 'وضعیت ارجاع 1'],
  ref2_type: ['ارجاع ها نوع تخصص ارجاع 2', 'نوع تخصص ارجاع 2', 'ارجاع 2'],
  ref2_status: ['ارجاع ها وضعیت ارجاع 2', 'وضعیت ارجاع 2'],
  ref3_type: ['ارجاع ها نوع تخصص ارجاع 3', 'نوع تخصص ارجاع 3', 'ارجاع 3'],
  ref3_status: ['ارجاع ها وضعیت ارجاع 3', 'وضعیت ارجاع 3'],
  ref4_type: ['ارجاع ها نوع تخصص ارجاع 4', 'نوع تخصص ارجاع 4', 'ارجاع 4'],
  ref4_status: ['ارجاع ها وضعیت ارجاع 4', 'وضعیت ارجاع 4'],
  final_opinion: [
    'نظریه نهایی نظریه', 'نظریه نهایی', 'نظریه طب کار', 'نظریه پزشک', 'نظریه', 'نتیجه معاینات', 'نتیجه نهایی', 'final opinion', 'opinion', 'result'
  ],
  final_valid_date: [
    'نظریه نهایی تاریخ اعتبار', 'تاریخ اعتبار', 'final valid date'
  ],
  final_doctor: [
    'نظریه نهایی نام پزشک', 'نام پزشک', 'پزشک معاین', 'پزشک', 'doctor', 'final doctor'
  ],
  final_advice: [
    'نظریه نهایی توصیه های پزشکی', 'توصیه های پزشکی', 'توصیه های پزشک', 'توصیه ها', 'final advice', 'medical advice'
  ],
  final_conditions: [
    'نظریه نهایی شروط', 'شروط', 'شروط اشتغال', 'محدودیت شغلی', 'final conditions', 'conditions'
  ],
  final_risks: [
    'نظریه نهایی ریسک ها', 'ریسک ها', 'final risks'
  ],
  final_reject_reasons: [
    'نظریه نهایی دلایل رد صلاحیت', 'دلایل عدم صلاحیت', 'دلایل رد صلاحیت', 'final reject reasons'
  ],
  final_followup_reason: [
    'نظریه نهایی علت پیگیری', 'علت پیگیری', 'final followup reason'
  ],
  final_followup_date: [
    'نظریه نهایی تاریخ پیگیری', 'تاریخ پیگیری', 'final followup date'
  ],
  final_followup_needed: [
    'نظریه نهایی نیاز به پیگیری', 'نیاز به پیگیری', 'پیگیری', 'followup needed', 'followup'
  ]
};

// Map normalized alias strings to canonical property names
const LOOKUP_MAP: Map<string, string> = new Map();
Object.entries(COLUMN_ALIASES).forEach(([prop, aliases]) => {
  aliases.forEach(a => {
    LOOKUP_MAP.set(normalizeHeader(a), prop);
  });
});
// Also add raw HEADER_MAP entries
Object.entries(HEADER_MAP).forEach(([fa, en]) => {
  LOOKUP_MAP.set(normalizeHeader(fa), en);
});

// Best effort match of a header string to a canonical property
export function matchColumnName(rawHeader: any): string | null {
  if (rawHeader === null || rawHeader === undefined) return null;
  const norm = normalizeHeader(rawHeader);
  if (!norm) return null;

  // 1. Direct exact lookup
  if (LOOKUP_MAP.has(norm)) {
    return LOOKUP_MAP.get(norm)!;
  }

  // 2. Direct match with BASE_COLS
  const exactCol = BASE_COLS.find(c => c.toLowerCase() === norm);
  if (exactCol) return exactCol;

  // 3. Partial substring match in lookup aliases
  for (const [prop, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const a of aliases) {
      const normA = normalizeHeader(a);
      if (normA && (norm.includes(normA) || normA.includes(norm))) {
        return prop;
      }
    }
  }

  return null;
}

// Extract and preserve cell values exactly as in Excel
export function cleanCellValue(val: any): any {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val;
    return val;
  }
  return val;
}

// Format ID/Code strings while preserving string contents
export function formatCodeString(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    return Math.floor(val).toString();
  }
  if (typeof val === 'string') {
    if (val.endsWith('.0')) {
      return val.slice(0, -2);
    }
    return val;
  }
  return String(val);
}

// Parse Date string or Excel serial number
export function parseDateString(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    // If it's a 4-digit year like 1402
    if (val >= 1350 && val <= 1500) return `${val}/01/01`;
    // If it's an Excel serial date (e.g. 44895)
    try {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        // Return ISO or year
        return date.toISOString().split('T')[0];
      }
    } catch (_) {}
  }
  const s = String(val).trim();
  return s;
}

// Main smart Excel parser function
export function parseOccupationalHealthExcel(wb: XLSX.WorkBook): {
  records: any[];
  headersFound: string[];
  detectedColumnsCount: number;
} {
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    return { records: [], headersFound: [], detectedColumnsCount: 0 };
  }

  // Read all rows as 2D array
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length === 0) {
    return { records: [], headersFound: [], detectedColumnsCount: 0 };
  }

  // Step 1: Detect Header Row
  // Find which row (0..15) has the most recognizable column headers
  let bestHeaderRowIndex = 0;
  let maxMatchedCols = -1;
  let bestMatchedColsMap: Record<number, string> = {};

  const scanLimit = Math.min(rawRows.length, 15);
  for (let r = 0; r < scanLimit; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let matched = 0;
    const currentColsMap: Record<number, string> = {};

    row.forEach((cellVal, colIdx) => {
      const mapped = matchColumnName(cellVal);
      if (mapped) {
        matched++;
        currentColsMap[colIdx] = mapped;
      }
    });

    if (matched > maxMatchedCols) {
      maxMatchedCols = matched;
      bestHeaderRowIndex = r;
      bestMatchedColsMap = currentColsMap;
    }
  }

  // If no columns matched well, but row 0 has exactly 87 columns matching BASE_COLS in position
  if (maxMatchedCols < 3 && rawRows[0] && rawRows[0].length >= 20) {
    // Check if row 0 itself is data (first cell is number 1, second is string name)
    const firstCell = rawRows[0][0];
    const secondCell = rawRows[0][1];
    if (typeof firstCell === 'number' || (!isNaN(parseInt(firstCell)) && isNaN(parseInt(secondCell)))) {
      // Treat as headless data matching BASE_COLS directly
      bestHeaderRowIndex = -1; // Data starts from row 0
      BASE_COLS.forEach((c, idx) => {
        bestMatchedColsMap[idx] = c;
      });
      maxMatchedCols = BASE_COLS.length;
    }
  }

  const dataStartRow = bestHeaderRowIndex === -1 ? 0 : bestHeaderRowIndex + 1;
  const headersFound: string[] = [];
  if (bestHeaderRowIndex >= 0 && rawRows[bestHeaderRowIndex]) {
    rawRows[bestHeaderRowIndex].forEach((h: any) => {
      if (h) headersFound.push(String(h).trim());
    });
  }

  const resultRecords: any[] = [];

  for (let r = dataStartRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    // Check if entire row is empty
    const hasAnyContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    if (!hasAnyContent) continue;

    const record: Record<string, any> = {};

    // Map each cell according to bestMatchedColsMap
    row.forEach((cellVal, colIdx) => {
      const canonicalKey = bestMatchedColsMap[colIdx];
      const cleaned = cleanCellValue(cellVal);

      if (canonicalKey) {
        record[canonicalKey] = cleaned;
      } else if (bestHeaderRowIndex >= 0 && rawRows[bestHeaderRowIndex][colIdx]) {
        // Keep unmapped raw columns with their header name
        const rawColName = String(rawRows[bestHeaderRowIndex][colIdx]).trim();
        if (rawColName) {
          record[rawColName] = cleaned;
        }
      }
    });

    // Post-processing & Intelligent Normalization:

    // 1. Full name split into fname and lname if needed
    if (record.full_name && (!record.fname || !record.lname)) {
      const fullNameStr = String(record.full_name).trim();
      const parts = fullNameStr.split(/\s+/);
      if (parts.length > 1) {
        if (!record.fname) record.fname = parts[0];
        if (!record.lname) record.lname = parts.slice(1).join(' ');
      } else if (parts.length === 1 && !record.fname) {
        record.fname = parts[0];
      }
    }

    // 2. If fname has 2 words and lname is empty, split fname
    if (record.fname && !record.lname) {
      const nameParts = String(record.fname).trim().split(/\s+/);
      if (nameParts.length >= 2) {
        record.fname = nameParts[0];
        record.lname = nameParts.slice(1).join(' ');
      }
    }

    // 3. Clean codes
    record.nid = formatCodeString(record.nid);
    record.pcode = formatCodeString(record.pcode);

    // 4. Clean Date
    if (record.exam_date) {
      record.exam_date = parseDateString(record.exam_date);
    }

    // 5. Blood Pressure Combined parsing (e.g. "120/80" or "12/8" or "130-80")
    if (record.bp_combined && (!record.bp_sys || !record.bp_dia)) {
      const bpStr = String(record.bp_combined).trim();
      const m = bpStr.match(/(\d{1,3})\s*[\/\-_:]\s*(\d{1,3})/);
      if (m) {
        let sys = parseInt(m[1]);
        let dia = parseInt(m[2]);
        if (sys <= 25) sys = sys * 10;
        if (dia <= 20) dia = dia * 10;
        record.bp_sys = sys;
        record.bp_dia = dia;
      }
    }

    // 6. Clean numeric systolic / diastolic if stored as 12 / 8
    if (record.bp_sys && typeof record.bp_sys === 'number' && record.bp_sys <= 25) {
      record.bp_sys = record.bp_sys * 10;
    }
    if (record.bp_dia && typeof record.bp_dia === 'number' && record.bp_dia <= 20) {
      record.bp_dia = record.bp_dia * 10;
    }

    // Auto calculate BMI if height and weight exist but BMI is missing
    const numWeight = typeof record.weight === 'number' ? record.weight : parseFloat(record.weight);
    let numHeight = typeof record.height === 'number' ? record.height : parseFloat(record.height);

    if (!isNaN(numWeight) && !isNaN(numHeight) && numWeight > 20 && numHeight > 0) {
      // If height is in meters (e.g. 1.75), convert to cm
      if (numHeight < 3) numHeight = numHeight * 100;

      const calcBmi = Math.round((numWeight / ((numHeight / 100) * (numHeight / 100))) * 10) / 10;

      if (!record.bmi || isNaN(parseFloat(record.bmi))) {
        record.bmi = calcBmi;
      }
    }

    // Ensure at least a fallback name exists if row has any identification
    if (!record.fname && !record.lname) {
      if (record.nid) {
        record.fname = `پرسنل`;
        record.lname = `کد ملی ${record.nid}`;
      } else if (record.pcode) {
        record.fname = `پرسنل`;
        record.lname = `کد ${record.pcode}`;
      } else if (record.company) {
        record.fname = `پرسنل`;
        record.lname = `ردیف ${r + 1}`;
      }
    }

    // Only add if record has some minimum data (name or nid or pcode or exam_date)
    if (record.fname || record.lname || record.nid || record.pcode || record.company || record.exam_date) {
      resultRecords.push(record);
    }
  }

  return {
    records: resultRecords,
    headersFound,
    detectedColumnsCount: Object.keys(bestMatchedColsMap).length
  };
}
