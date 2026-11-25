import type {
  RhsF68Data,
  RhsF68EventFactors,
  RhsF68RiskLevel,
  RhsF68WorkflowStage,
  SafetyIncidentRecord,
} from '../types';
import { getCurrentJalaliDate, parseJalaliDateString } from './incidentSupplementaryHelper';
import { getTodayJalaliObj, parseDateString, toEnglishDigits } from './jalaliDate';

export type RhsF68ReportType = 'Unsafe Act' | 'Unsafe Condition' | 'Near Miss';

export interface RhsF68ReportTypeMeta {
  value: RhsF68ReportType;
  labelFa: string;
  labelEn: string;
  subtitleFa: string;
  guidanceFa: string;
  subjectPlaceholderFa: string;
  descriptionPlaceholderFa: string;
  involvedTitleFa: string;
  involvedHintFa: string;
  recommendedFactors: (keyof RhsF68EventFactors)[];
  badgeClass: string;
}

export const RHS_F68_REPORT_TYPES: RhsF68ReportTypeMeta[] = [
  {
    value: 'Unsafe Act',
    labelFa: 'رفتار ناایمن (Unsafe Act)',
    labelEn: 'Unsafe Act',
    subtitleFa: 'انجام کار یا رفتاری مغایر با دستورالعمل‌های ایمنی که احتمال بروز حادثه را افزایش می‌دهد',
    guidanceFa: 'در گزارش رفتار ناایمن، مشخصات فرد یا افراد مرتبط/خاطی، نوع تخلف ایمنی یا عدم استفاده از PPE و اقدام تذکری/پیشگیرانه فوری را دقیق درج نمایید.',
    subjectPlaceholderFa: 'مثال: عدم استفاده از هارنس ایمنی حین کار در ارتفاع بالای ۲ متر',
    descriptionPlaceholderFa: 'شرح رفتار مشاهده‌شده، وضعیت تجهیزات حفاظت فردی، نحوه اجرای کار و ریسک احتمالی...',
    involvedTitleFa: 'فرد / افراد مرتبط یا خاطی',
    involvedHintFa: 'برای رفتار ناایمن ثبت مشخصات فرد یا افراد مشاهده‌شده الزامی/توصیه‌شده است.',
    recommendedFactors: ['hazardousActions', 'hseRulesViolation', 'workersPosition', 'recklessDriving'],
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  {
    value: 'Unsafe Condition',
    labelFa: 'شرایط ناایمن (Unsafe Condition)',
    labelEn: 'Unsafe Condition',
    subtitleFa: 'وضعیت فیزیکی، تجهیزاتی یا محیطی نامناسب در محل کار که پتانسیل آسیب یا خسارت دارد',
    guidanceFa: 'در گزارش شرایط ناایمن، موقعیت مکانی دقیق، کد تجهیز یا محوطه، نوع نقص فنی/محیطی و محدودسازی یا ایمن‌سازی اولیه را ثبت کنید.',
    subjectPlaceholderFa: 'مثال: نبود حفاظ ایمنی روی کوپلینگ پمپ و نشت روغن در کف محوطه',
    descriptionPlaceholderFa: 'شرح نقص تجهیزاتی، شرایط جوی/محیطی، خطرات فیزیکی یا شیمیایی مشاهده‌شده در محل...',
    involvedTitleFa: 'افراد مرتبط / مسئول محوطه (در صورت وجود)',
    involvedHintFa: 'در صورت حضور سرپرست محوطه، اپراتور یا پیمانکار مرتبط اطلاعات وی را ثبت کنید.',
    recommendedFactors: ['hazardousPosition', 'standardConditions', 'basicCauses'],
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  },
  {
    value: 'Near Miss',
    labelFa: 'شبه‌حادثه (Near Miss)',
    labelEn: 'Near Miss',
    subtitleFa: 'رخداد برنامه‌ریزی‌نشده‌ای که منجر به جراحت یا خسارت نشد اما پتانسیل ایجاد حادثه جدی را داشت',
    guidanceFa: 'در گزارش شبه‌حادثه، توالی اتفاقات، فاصله با بروز آسیب جدی، افراد در معرض خطر و پیشنهادات پیشگیری از تکرار را به‌طور کامل شرح دهید.',
    subjectPlaceholderFa: 'مثال: سقوط آچار از روی داربست در مجاورت محل تردد کارگران بدون برخورد',
    descriptionPlaceholderFa: 'شرح زنجیره رویداد، شرایط لحظه وقوع، علل ظاهری و پتانسیل آسیب یا خسارت...',
    involvedTitleFa: 'افراد درگیر یا شاهد شبه‌حادثه',
    involvedHintFa: 'ثبت مشخصات افراد در معرض ریسک یا شاهدان جهت بررسی کارشناسی HSE کمک‌کننده است.',
    recommendedFactors: ['hazardousPosition', 'hazardousActions', 'workersPosition', 'basicCauses'],
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  },
];

export interface FactorCategoryMeta {
  key: keyof RhsF68EventFactors;
  titleFa: string;
  titleEn: string;
  items: string[];
}

export const RHS_F68_FACTOR_CATEGORIES: FactorCategoryMeta[] = [
  {
    key: 'hazardousPosition',
    titleFa: '۱. موقعیت خطرناک',
    titleEn: 'Hazardous Position',
    items: [
      'عدم وجود یا نقص حفاظ ماشین‌آلات',
      'چیدمان و انبارش غیرایمن مواد و تجهیزات',
      'معابر مسدود، ناهموار یا لغزنده',
      'نورپردازی یا تهویه نامناسب محیط کار',
      'ساختار، داربست یا سکوهای غیراستاندارد',
      'مجاورت با مواد قابل اشتعال، سمی یا تحت فشار',
    ],
  },
  {
    key: 'hazardousActions',
    titleFa: '۲. اقدامات خطرناک',
    titleEn: 'Hazardous Actions',
    items: [
      'کار بدون مجوز کار معتبر (PTW)',
      'استفاده نادرست یا استفاده از ابزار و تجهیزات معیوب',
      'از کار انداختن یا دور زدن حفاظ‌ها و اینترلاک‌های ایمنی',
      'حذف یا دستکاری علائم و برچسب‌های ایمنی (LOTO)',
      'تعمیر، سرویس یا تمیزکاری ماشین‌آلات در حال کار',
      'شوخی، بی‌احتیاطی یا حواس‌پرتی حین انجام کار',
    ],
  },
  {
    key: 'hseRulesViolation',
    titleFa: '۳. نقض قوانین HSE',
    titleEn: 'HSE Rules Violation',
    items: [
      'عدم استفاده یا استفاده ناصحیح از تجهیزات حفاظت فردی (PPE)',
      'عدم رعایت دستورالعمل‌های ایمنی کار در ارتفاع',
      'عدم رعایت الزامات ورود به فضای بسته (Confined Space)',
      'عدم انجام گازسنجی پیش از شروع یا حین کار گرم',
      'تخلف از مقررات ایمنی برق و ایزولاسیون انرژی',
      'استفاده از تلفن همراه یا استعمال دخانیات در مناطق ممنوعه',
    ],
  },
  {
    key: 'recklessDriving',
    titleFa: '۴. رانندگی بی‌پروا',
    titleEn: 'Reckless Driving',
    items: [
      'سرعت غیرمجاز در محوطه کارخانه یا جاده دسترسی',
      'عدم بستن کمربند ایمنی یا نداشتن مجوز تردد / گواهینامه معتبر',
      'حمل بار غیرایمن، بیش از ظرفیت یا بدون مهاربندی',
      'پارک در نقاط کور، حریم شیرآلات و مسیر خودروهای امدادی',
      'استفاده از تجهیزات متحرک (لیفتراک / جرثقیل) بدون راهنما',
    ],
  },
  {
    key: 'workersPosition',
    titleFa: '۵. موقعیت کارگران',
    titleEn: 'Workers Position',
    items: [
      'قرارگیری در مسیر بار معلق (Line of Fire)',
      'استقرار زیر تجهیزات سنگین یا لبه‌های بدون حفاظ',
      'پوسچر ارگونومیک نامناسب و حمل دستی بار سنگین',
      'قرارگیری در مسیر خروج گاز، بخار یا سیال داغ',
      'کار همزمان دو گروه در یک تراز عمودی (SIMOPS)',
    ],
  },
  {
    key: 'standardActions',
    titleFa: '۶. اقدامات استاندارد',
    titleEn: 'Standard Actions',
    items: [
      'رعایت کامل روش‌های اجرایی و دستورالعمل‌های کاری (SOP)',
      'استفاده صحیح از ابزارآلات استاندارد و کالیبره',
      'توقف کار ناایمن (Stop Work Authority) و اطلاع‌رسانی به‌موقع',
      'همکاری کامل در ایمن‌سازی موقت محل پیش از مداخله',
    ],
  },
  {
    key: 'standardConditions',
    titleFa: '۷. شرایط استاندارد',
    titleEn: 'Standard Conditions',
    items: [
      'وضعیت مناسب روشنایی، تهویه و نظم و انضباط کارگاهی (5S)',
      'نصب کامل گاردریل، حفاظ و علائم هشداردهنده',
      'ایزولاسیون و ایمن‌سازی کامل انرژی‌های خطرناک',
      'آماده‌به‌کار بودن تجهیزات اطفاء حریق و دوش/چشم‌شوی اضطراری',
    ],
  },
  {
    key: 'basicCauses',
    titleFa: '۸. علل اساسی',
    titleEn: 'Basic / Root Causes',
    items: [
      'ضعف آموزش، مهارت یا آگاهی ایمنی نیروی انسانی',
      'ضعف نظارت سرپرستی و بازرسی‌های دوره‌ای',
      'نقص در برنامه‌ریزی و نگهداری و تعمیرات پیشگیرانه (PM)',
      'عدم تدوین یا ابهام در روش‌های اجرایی و ارزیابی ریسک (JSA)',
      'فشار کاری، خستگی یا کمبود نیروی متخصص',
      'عدم تأمین به‌موقع تجهیزات ایمنی و PPE استاندارد',
    ],
  },
];

export interface RhsF68RpnResult {
  probability: number;
  severity: number;
  detection: number;
  rpn: number;
  riskLevel: RhsF68RiskLevel;
  riskLevelFa: string;
  shortCodeLabelFa: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  badgeClass: string;
  actionPriorityFa: string;
}

/**
 * Computes Risk Priority Number (RPN) strictly according to Form RHS-F68 Rev.01:
 * RPN = Probability (1-5) × Severity (1-5) × Detection (1-5) -> Range 1..125
 * Levels:
 * - 1..10: پایین (L)
 * - 11..24: متوسط (M)
 * - 25..49: بالا (H)
 * - 50..125: شدید یا بارز (E)
 */
export function computeRhsF68Rpn(
  probabilityInput: number,
  severityInput: number,
  detectionInput: number
): RhsF68RpnResult {
  const clamp = (val: number) => {
    const n = Math.round(Number(val) || 1);
    return Math.max(1, Math.min(5, n));
  };

  const probability = clamp(probabilityInput);
  const severity = clamp(severityInput);
  const detection = clamp(detectionInput);
  const rpn = probability * severity * detection;

  if (rpn >= 50) {
    return {
      probability,
      severity,
      detection,
      rpn,
      riskLevel: 'E',
      riskLevelFa: 'شدید / بارز (E)',
      shortCodeLabelFa: 'E - شدید',
      color: 'red',
      badgeClass: 'bg-rose-600 text-white border-rose-700',
      actionPriorityFa: 'توقف فوری فعالیت ناایمن و اجرای اقدام اصلاحی اضطراری در کوتاه‌ترین زمان',
    };
  }
  if (rpn >= 25) {
    return {
      probability,
      severity,
      detection,
      rpn,
      riskLevel: 'H',
      riskLevelFa: 'بالا (H)',
      shortCodeLabelFa: 'H - بالا',
      color: 'orange',
      badgeClass: 'bg-orange-500 text-white border-orange-600',
      actionPriorityFa: 'نیازمند اقدام اصلاحی اولویت‌دار و پایش مستقیم واحد HSE',
    };
  }
  if (rpn >= 11) {
    return {
      probability,
      severity,
      detection,
      rpn,
      riskLevel: 'M',
      riskLevelFa: 'متوسط (M)',
      shortCodeLabelFa: 'M - متوسط',
      color: 'yellow',
      badgeClass: 'bg-amber-400 text-amber-950 border-amber-500',
      actionPriorityFa: 'برنامه‌ریزی اقدام اصلاحی/پیشگیرانه با سررسید مشخص و پیگیری دوره‌ای',
    };
  }
  return {
    probability,
    severity,
    detection,
    rpn,
    riskLevel: 'L',
    riskLevelFa: 'پایین (L)',
    shortCodeLabelFa: 'L - پایین',
    color: 'green',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700',
    actionPriorityFa: 'کنترل‌های روتین، تذکر ایمنی و ثبت در پرونده جهت پایش روند',
  };
}

export const PROBABILITY_SCALE_OPTIONS = [
  { value: 1, label: '۱ - به ندرت (خیلی کم)' },
  { value: 2, label: '۲ - غیرمحتمل (کم)' },
  { value: 3, label: '۳ - محتمل (متوسط)' },
  { value: 4, label: '۴ - با احتمال بالا (زیاد)' },
  { value: 5, label: '۵ - تقریباً حتمی (خیلی زیاد)' },
];

export const SEVERITY_SCALE_OPTIONS = [
  { value: 1, label: '۱ - ناچیز (بدون آسیب / خسارت جزئی)' },
  { value: 2, label: '۲ - خفیف (کمک‌های اولیه / خسارت کم)' },
  { value: 3, label: '۳ - متوسط (درمان پزشکی / توقف محدود)' },
  { value: 4, label: '۴ - شدید (آسیب ناتوان‌کننده / خسارت سنگین)' },
  { value: 5, label: '۵ - فاجعه‌بار (فوت / خسارت بسیار شدید)' },
];

export const DETECTION_SCALE_OPTIONS = [
  { value: 1, label: '۱ - بسیار بالا (تشخیص فوری و قطعی)' },
  { value: 2, label: '۲ - بالا (تشخیص آسان پیش از وقوع)' },
  { value: 3, label: '۳ - متوسط (تشخیص با بازرسی معمولی)' },
  { value: 4, label: '۴ - پایین (تشخیص دشوار و تخصصی)' },
  { value: 5, label: '۵ - غیرقابل تشخیص / بسیار پنهان' },
];

export const WORKFLOW_STAGE_META: Record<
  RhsF68WorkflowStage,
  {
    labelFa: string;
    labelEn: string;
    stepOrder: number;
    badgeClass: string;
  }
> = {
  DRAFT: {
    labelFa: 'پیش‌نویس (گزارش‌دهنده)',
    labelEn: 'Draft',
    stepOrder: 1,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  HSE_HEAD_TRIAGE: {
    labelFa: 'ارجاع‌شده به رئیس HSE (بررسی اولیه)',
    labelEn: 'HSE Head Review',
    stepOrder: 2,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  HSE_EXPERT_REVIEW: {
    labelFa: 'ارجاع‌شده به کارشناس واحد HSE (عوامل، RPN و اقدام)',
    labelEn: 'HSE Expert Investigation',
    stepOrder: 3,
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  },
  ACTION_IN_PROGRESS: {
    labelFa: 'اجرا و ثبت نتایج اقدام (کارشناس / افسر HSE)',
    labelEn: 'Action Results (HSE Officer)',
    stepOrder: 4,
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  },
  HSE_FINAL_APPROVAL: {
    labelFa: 'در انتظار جمع‌بندی و تایید نهایی رئیس HSE',
    labelEn: 'Final HSE Approval',
    stepOrder: 5,
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  },
  CLOSED: {
    labelFa: 'تایید نهایی و مختومه',
    labelEn: 'Closed',
    stepOrder: 6,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  RETURNED: {
    labelFa: 'عودت‌شده جهت اصلاح',
    labelEn: 'Returned for Revision',
    stepOrder: 1,
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  },
};

export function createEmptyEventFactors(): RhsF68EventFactors {
  return {
    hazardousPosition: { selectedItems: [], customNote: '' },
    hazardousActions: { selectedItems: [], customNote: '' },
    hseRulesViolation: { selectedItems: [], customNote: '' },
    recklessDriving: { selectedItems: [], customNote: '' },
    workersPosition: { selectedItems: [], customNote: '' },
    standardActions: { selectedItems: [], customNote: '' },
    standardConditions: { selectedItems: [], customNote: '' },
    basicCauses: { selectedItems: [], customNote: '' },
  };
}

export function createDefaultRhsF68Data(reportDate?: string): RhsF68Data {
  return {
    formCode: 'RHS-F68 Rev.01',
    reportDate: reportDate || getCurrentJalaliDate(),
    companyName: '',
    reporterJobTitle: '',
    exactLocation: '',
    involvedPersonnel: [],
    suggestions: '',
    reporterSignature: '',
    reporterSignedDate: '',
    attachments: [],
    hseUnitReview: {
      inspectionStatus: 'PENDING',
      inspectionResult: '',
      actionRequired: false,
      assignedExpertCode: '',
      assignedExpertName: '',
      assignedExpertJobTitle: '',
      hseHeadNotes: '',
    },
    eventFactors: createEmptyEventFactors(),
    correctiveFollowUp: {
      correctiveActionNumber: '',
      workOrderNumber: '',
      letterNumber: '',
      actionsTakenDescription: '',
      actionDate: '',
      dueDate: '',
      responsibleUnit: '',
      responsiblePerson: '',
      responsiblePersonnelCode: '',
      actionResults: '',
      followUpStatus: 'OPEN',
    },
    finalConclusion: {
      decision: '',
      conclusionNotes: '',
    },
    auditHistory: [],
  };
}

function jalaliDayIndex(dateStr?: string): number | null {
  const parsed = parseJalaliDateString(dateStr);
  if (!parsed) return null;
  let days = parsed.year * 365 + Math.floor(parsed.year / 4);
  if (parsed.month <= 6) {
    days += (parsed.month - 1) * 31;
  } else {
    days += 6 * 31 + (parsed.month - 7) * 30;
  }
  return days + parsed.day;
}

export function getCorrectiveOverdueInfo(record: SafetyIncidentRecord): {
  isOverdue: boolean;
  daysOverdue: number;
  dueDate?: string;
} {
  if (record.isDraft || record.workflowStage === 'CLOSED' || record.status === 'Resolved & Closed') {
    return { isOverdue: false, daysOverdue: 0 };
  }

  const dueDate =
    record.rhsF68?.correctiveFollowUp?.dueDate ||
    record.capaList?.find((c) => c.status !== 'Closed' && c.targetDate)?.targetDate;

  if (!dueDate) {
    return { isOverdue: false, daysOverdue: 0 };
  }

  const followStatus = record.rhsF68?.correctiveFollowUp?.followUpStatus;
  if (followStatus === 'COMPLETED' || followStatus === 'VERIFIED') {
    return { isOverdue: false, daysOverdue: 0, dueDate };
  }

  const todayIdx = jalaliDayIndex(getCurrentJalaliDate());
  const dueIdx = jalaliDayIndex(dueDate);
  if (todayIdx !== null && dueIdx !== null && todayIdx > dueIdx) {
    return {
      isOverdue: true,
      daysOverdue: todayIdx - dueIdx,
      dueDate,
    };
  }
  return { isOverdue: false, daysOverdue: 0, dueDate };
}

export function getIncidentWorkflowStage(record: SafetyIncidentRecord): RhsF68WorkflowStage {
  if (record.workflowStage && WORKFLOW_STAGE_META[record.workflowStage]) {
    return record.workflowStage;
  }
  if (record.isDraft) return 'DRAFT';
  if (record.status === 'Resolved & Closed') return 'CLOSED';
  if (record.status === 'CAPA In Progress') return 'ACTION_IN_PROGRESS';
  if (record.status === 'Under Investigation') return 'HSE_EXPERT_REVIEW';
  return 'HSE_HEAD_TRIAGE';
}

/**
 * Dynamically extracts the 4-digit Shamsi (Jalali) year strictly from an incident's
 * recorded dates (eventDate, reportDate, createdDate). Returns null if no valid date exists.
 * Never falls back to any hardcoded default year.
 */
export function extractIncidentShamsiYear(record: SafetyIncidentRecord): string | null {
  const candidates = [record.eventDate, record.reportDate, record.createdDate];
  for (const raw of candidates) {
    if (!raw || !String(raw).trim()) continue;
    const parsed = parseDateString(raw);
    if (parsed.jalali && parsed.jalali.jy >= 1300 && parsed.jalali.jy <= 1500) {
      return String(parsed.jalali.jy);
    }
    const normalized = toEnglishDigits(String(raw));
    const jalaliMatch = normalized.match(/\b(13\d{2}|14\d{2})\b/);
    if (jalaliMatch) {
      return jalaliMatch[1];
    }
  }
  return null;
}

/**
 * Returns sorted unique Shamsi years (descending) that actually exist in the provided
 * incident ledger. Returns an empty array when no dated records exist.
 */
export function getAvailableIncidentYears(records: SafetyIncidentRecord[]): string[] {
  const yearSet = new Set<string>();
  records.forEach((rec) => {
    const y = extractIncidentShamsiYear(rec);
    if (y) yearSet.add(y);
  });
  return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
}

/**
 * Checks whether an incident's recorded date matches today's Shamsi calendar date.
 */
export function isIncidentFromToday(record: SafetyIncidentRecord): boolean {
  const today = getTodayJalaliObj();
  const candidates = [record.eventDate, record.reportDate, record.createdDate];
  for (const raw of candidates) {
    if (!raw || !String(raw).trim()) continue;
    if (String(raw).includes('امروز')) return true;
    const parsed = parseDateString(raw);
    if (
      parsed.jalali &&
      parsed.jalali.jy === today.jy &&
      parsed.jalali.jm === today.jm &&
      parsed.jalali.jd === today.jd
    ) {
      return true;
    }
  }
  return false;
}

