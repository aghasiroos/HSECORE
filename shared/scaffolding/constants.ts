export type ScaffoldTagStatus = 'GREEN' | 'YELLOW' | 'RED';

export type ScaffoldWorkflowStatus =
  | 'INSTALLATION_REQUESTED'
  | 'INSTALLATION_COMPLETED'
  | 'INSPECTION_RECORDED'
  | 'CHECKLIST_COMPLETED'
  | 'DEFECTS_REVIEW'
  | 'APPROVED_BY_INSPECTOR'
  | 'TAG_ISSUED'
  | 'AUTHORIZED_FOR_USE';

export type ScaffoldInspectionReason =
  | 'INITIAL_POST_INSTALL'
  | 'PERIODIC_WEEKLY'
  | 'STRUCTURAL_MODIFICATION'
  | 'ADVERSE_WEATHER'
  | 'INCIDENT_OCCURRENCE'
  | 'DEFECT_REPORT'
  | 'RE_INSPECTION';

export type ScaffoldChecklistVerdict = 'PASS' | 'FAIL' | 'NA';
export type ScaffoldChecklistAnswer = 'YES' | 'NO' | 'NA';

export interface ScaffoldChecklistSettings {
  allowNaOption: boolean;
}

export interface ScaffoldSignaturesMeta {
  inspectorName?: string;
  inspectorPersonnelCode?: string;
  inspectorSignedAt?: string;
  unitSupervisorName?: string;
  unitSupervisorPersonnelCode?: string;
  unitSupervisorSignedAt?: string;
}

export interface ScaffoldChecklistTemplateItem {
  code: string;
  orderIndex: number;
  categoryFa: string;
  titleFa: string;
  requirementFa: string;
  standardRef: string;
  isCritical: boolean;
  /** The answer ('YES' | 'NO') that represents a SAFE / COMPLIANT condition */
  safeAnswer: 'YES' | 'NO';
}

export interface ScaffoldChecklistResponseItem {
  code: string;
  orderIndex: number;
  categoryFa: string;
  titleFa: string;
  requirementFa?: string;
  standardRef?: string;
  isCritical: boolean;
  isCustom?: boolean;
  safeAnswer?: 'YES' | 'NO';
  answer?: ScaffoldChecklistAnswer | null;
  verdict: ScaffoldChecklistVerdict | null;
  comment?: string;
  defectPhoto?: string;
  correctiveAction?: string;
  responsiblePerson?: string;
  dueDate?: string;
  resolved?: boolean;
}

export interface ScaffoldPhotoItem {
  id: string;
  url: string;
  fileName: string;
  caption?: string;
  stage: 'BEFORE' | 'AFTER' | 'DEFECT';
  uploadedAt: string;
  uploadedBy?: string;
}

export const SCAFFOLD_TYPES = [
  { value: 'TUBE_AND_COUPLER', labelFa: 'داربست لوله‌ای و بست (Tube & Coupler)' },
  { value: 'MODULAR_RINGLOCK', labelFa: 'داربست مدولار / رینگ‌لاک (Modular / System)' },
  { value: 'MOBILE_TOWER', labelFa: 'داربست متحرک چرخدار (Mobile Tower)' },
  { value: 'CANTILEVER', labelFa: 'داربست کنسولی / معلق پیش‌آمده (Cantilever)' },
  { value: 'SUSPENDED', labelFa: 'داربست آویزان / معلق (Suspended)' },
  { value: 'INDEPENDENT_TIED', labelFa: 'داربست مستقل مهارشده به سازه (Independent Tied)' },
  { value: 'BIRDCAGE', labelFa: 'داربست قفسی / فضایی (Birdcage)' },
  { value: 'STAIR_TOWER', labelFa: 'برجک راه‌پله دسترسی (Stair Access Tower)' },
] as const;

export const SCAFFOLD_INSPECTION_REASONS: Array<{
  value: ScaffoldInspectionReason;
  labelFa: string;
  shortFa: string;
}> = [
  { value: 'INITIAL_POST_INSTALL', labelFa: 'بازرسی اولیه پس از تکمیل نصب', shortFa: 'پس از نصب' },
  { value: 'PERIODIC_WEEKLY', labelFa: 'بازرسی دوره‌ای منظم (هفتگی)', shortFa: 'دوره‌ای' },
  { value: 'STRUCTURAL_MODIFICATION', labelFa: 'بازرسی پس از تغییرات یا اصلاحات سازه', shortFa: 'تغییرات سازه' },
  { value: 'ADVERSE_WEATHER', labelFa: 'بازرسی پس از شرایط جوی نامساعد (باد شدید / بارندگی)', shortFa: 'شرایط جوی نامساعد' },
  { value: 'INCIDENT_OCCURRENCE', labelFa: 'بازرسی پس از وقوع حادثه یا شبه‌حادثه', shortFa: 'پس از حادثه' },
  { value: 'DEFECT_REPORT', labelFa: 'بازرسی پیرو گزارش نقص یا عدم انطباق', shortFa: 'گزارش نقص' },
  { value: 'RE_INSPECTION', labelFa: 'بازرسی مجدد جهت رفع نقص و تمدید اعتبار تگ', shortFa: 'بازرسی مجدد' },
];

export const SCAFFOLD_WORKFLOW_STEPS: Array<{
  order: number;
  key: ScaffoldWorkflowStatus;
  labelFa: string;
  shortFa: string;
}> = [
  { order: 1, key: 'INSTALLATION_REQUESTED', labelFa: 'ثبت درخواست نصب', shortFa: 'درخواست نصب' },
  { order: 2, key: 'INSTALLATION_COMPLETED', labelFa: 'تکمیل نصب داربست', shortFa: 'تکمیل نصب' },
  { order: 3, key: 'INSPECTION_RECORDED', labelFa: 'ثبت اطلاعات بازرسی', shortFa: 'ثبت بازرسی' },
  { order: 4, key: 'CHECKLIST_COMPLETED', labelFa: 'تکمیل چک‌لیست استاندارد', shortFa: 'تکمیل چک‌لیست' },
  { order: 5, key: 'DEFECTS_REVIEW', labelFa: 'بررسی نواقص و اقدامات اصلاحی', shortFa: 'بررسی نواقص' },
  { order: 6, key: 'APPROVED_BY_INSPECTOR', labelFa: 'تأیید بازرس مجاز HSE', shortFa: 'تأیید بازرس' },
  { order: 7, key: 'TAG_ISSUED', labelFa: 'صدور وضعیت تگ رنگی', shortFa: 'صدور تگ' },
  { order: 8, key: 'AUTHORIZED_FOR_USE', labelFa: 'مجاز شدن استفاده عملیاتی', shortFa: 'مجاز به استفاده' },
];

export const SCAFFOLD_TAG_META: Record<
  ScaffoldTagStatus,
  {
    labelFa: string;
    shortFa: string;
    descriptionFa: string;
    usageAllowed: boolean;
  }
> = {
  GREEN: {
    labelFa: 'تگ سبز — تأیید شده و مجاز به استفاده',
    shortFa: 'تگ سبز (مجاز)',
    descriptionFa: 'داربست توسط بازرس مجاز HSE بررسی و تأیید شده و استفاده از آن طبق ظرفیت مجاز بلامانع است.',
    usageAllowed: true,
  },
  YELLOW: {
    labelFa: 'تگ زرد — عدم تأیید نهایی و ممنوعیت استفاده تا تکمیل اصلاحات',
    shortFa: 'تگ زرد (ممنوع تا اصلاح)',
    descriptionFa: 'داربست در انتظار تکمیل اصلاحات و بازرسی مجدد است؛ استفاده از آن تا تأیید نهایی و صدور تگ سبز ممنوع است.',
    usageAllowed: false,
  },
  RED: {
    labelFa: 'تگ قرمز — غیرمجاز به استفاده (نقص یا شرایط ناایمن)',
    shortFa: 'تگ قرمز (غیرمجاز)',
    descriptionFa: 'داربست در حال نصب، برچیدن یا دارای نقص بحرانی/شرایط ناایمن است. ورود و استفاده اکیداً ممنوع است.',
    usageAllowed: false,
  },
};

/**
 * Official 23-item Scaffolding Installation Safety Checklist (چک‌لیست ایمنی نصب داربست).
 * All 23 items are implemented verbatim per RHS-W14 Rev 00 & HSECORE standards.
 * Note: Items SCF-14 and SCF-16 have inverted polarity (`safeAnswer: 'NO'`).
 */
export const STANDARD_SCAFFOLD_CHECKLIST_ITEMS: ScaffoldChecklistTemplateItem[] = [
  {
    code: 'SCF-01',
    orderIndex: 1,
    categoryFa: 'مجوز و صلاحیت',
    titleFa: 'آیا برای نصب داربست مجوز صادر شده است؟',
    requirementFa: 'صدور و اعتبار پروانه کار / مجوز رسمی نصب داربست پیش از شروع عملیات.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-02',
    orderIndex: 2,
    categoryFa: 'مجوز و صلاحیت',
    titleFa: 'آیا داربست توسط افراد ماهر و با تجربه برپا شده است؟',
    requirementFa: 'برپایی داربست صرفاً توسط داربست‌بندان آموزش‌دیده و دارای صلاحیت فنی.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-03',
    orderIndex: 3,
    categoryFa: 'حفاظت فردی',
    titleFa: 'آیا داربست‌بندها از وسایل حفاظت فردی مناسب استفاده می‌کنند؟',
    requirementFa: 'استفاده از کمربند ایمنی (هارنس تمام‌بدن)، کلاه ایمنی چانه‌دار، کفش ایمنی و دستکش مناسب.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-04',
    orderIndex: 4,
    categoryFa: 'اجزا و اتیکت',
    titleFa: 'آیا اجزای تشکیل‌دهنده داربست در شرایط ایمن و مطمئنی جهت استفاده قرار دارند؟',
    requirementFa: 'سلامت کامل لوله‌ها، بست‌ها، اتصالات و تجهیزات جانبی داربست.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-05',
    orderIndex: 5,
    categoryFa: 'اجزا و اتیکت',
    titleFa: 'آیا سیستم نصب اتیکت (Scafftag) اجرا شده است؟',
    requirementFa: 'نصب هولدر و اتیکت وضعیت داربست (Scafftag) در نقطه دسترسی اصلی.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-06',
    orderIndex: 6,
    categoryFa: 'بستر و تراز',
    titleFa: 'آیا برای تراز شدن عمودی و افقی داربست، به‌جای اشیای نامطمئن و ناپایدار مانند بلوک‌ها و آجرهای لق، از جک استفاده شده است؟',
    requirementFa: 'استفاده از جک تراز استاندارد و منع کامل استفاده از آجر، بلوک یا قطعات ناپایدار.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-07',
    orderIndex: 7,
    categoryFa: 'بستر و تراز',
    titleFa: 'آیا صفحات پایه (Base Plate) و جک‌های پیچی اتصال محکمی با لوله‌های استاندارد و فریم‌ها دارند؟',
    requirementFa: 'استقرار و اتصال کامل صفحات زیرپایه و جک‌های پیچی به پایه‌های عمودی.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-08',
    orderIndex: 8,
    categoryFa: 'مهار و استحکام',
    titleFa: 'آیا همه پایه‌های داربست به‌خوبی مهار و محکم شده‌اند؟',
    requirementFa: 'مهاربندی مناسب تمامی پایه‌های عمودی و جلوگیری از لغزش یا جابه‌جایی.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-09',
    orderIndex: 9,
    categoryFa: 'دسترسی و نردبان',
    titleFa: 'آیا برای دسترسی، ورود و خروج، نردبان ایمن تهیه شده است؟',
    requirementFa: 'تعبیه نردبان دسترسی ایمن و مهارشده برای ورود و خروج پرسنل.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-10',
    orderIndex: 10,
    categoryFa: 'دسترسی و نردبان',
    titleFa: 'آیا نردبان‌ها سالم بوده و دارای زاویه ۷۵ درجه نسبت به سطح افق و فاصله پله‌های ۰/۳ متر هستند؟',
    requirementFa: 'سلامت فیزیکی نردبان، رعایت زاویه استقرار ۷۵ درجه (نسبت ۱ به ۴) و گام پله ۳۰ سانتی‌متر.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-11',
    orderIndex: 11,
    categoryFa: 'دسترسی و نردبان',
    titleFa: 'آیا نردبان حداقل یک متر بالاتر از نقطه دسترسی امتداد دارد؟',
    requirementFa: 'امتداد نردبان به میزان حداقل ۱ متر بالاتر از تراز سکوی ورود/خروج.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-12',
    orderIndex: 12,
    categoryFa: 'حفاظت سکو',
    titleFa: 'آیا لبه‌های پاخور حفاظتی قسمت پایین سکو (Toe Boards) به ارتفاع ۰/۱۵ متر نصب شده است؟',
    requirementFa: 'نصب پاخور حفاظتی با حداقل ارتفاع ۱۵ سانتی‌متر در لبه‌های باز سکو.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: false,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-13',
    orderIndex: 13,
    categoryFa: 'ایمنی الکتریکی',
    titleFa: 'آیا فاصله مجاز با خطوط برق رعایت شده است؟ (دستورالعمل RHS-W14 Rev 00 بندهای 4-2-36 و 4-2-37)',
    requirementFa: 'رعایت حریم ایمن الکتریکی از خطوط برق هوایی و تجهیزات برقدار مطابق بندهای 4-2-36 و 4-2-37.',
    standardRef: 'RHS-W14 Rev 00 (4-2-36, 4-2-37)',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-14',
    orderIndex: 14,
    categoryFa: 'تردد و محیط',
    titleFa: 'آیا داربست برای تردد آسان و ایمن وسایل نقلیه مزاحمت ایجاد کرده است؟',
    requirementFa: 'عدم ایجاد مزاحمت یا خطر برخورد برای تردد ایمن خودروها و ماشین‌آلات (پاسخ ایمن: خیر).',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: false,
    safeAnswer: 'NO',
  },
  {
    code: 'SCF-15',
    orderIndex: 15,
    categoryFa: 'حفاظت سکو',
    titleFa: 'آیا نرده‌های حفاظتی (Guard Rails) در ارتفاع‌های میانی ۰/۵ و ۱ متر بالاتر از سکوی کار نصب شده‌اند؟',
    requirementFa: 'نصب کامل گاردریل میانی (۰/۵ متر) و بالایی (۱ متر) در تمام لبه‌های باز سکوی کار.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-16',
    orderIndex: 16,
    categoryFa: 'سلامت متریال',
    titleFa: 'آیا در داربست از متریال آسیب‌دیده و صدمه‌دیده استفاده شده است؟',
    requirementFa: 'ممنوعیت اکید استفاده از لوله، تخته، بست یا متریال آسیب‌دیده/خورده‌شده (پاسخ ایمن: خیر).',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'NO',
  },
  {
    code: 'SCF-17',
    orderIndex: 17,
    categoryFa: 'بستر و بارگذاری',
    titleFa: 'آیا زمین مقاومت و تحمل کافی برای تحمل وزن داربست را داشته است؟',
    requirementFa: 'بررسی استحکام و ظرفیت باربری بستر زیرین جهت تحمل وزن سازه و بار عملیاتی.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-18',
    orderIndex: 18,
    categoryFa: 'سکوی کار',
    titleFa: 'آیا سطح کار با الوار یا ورق‌های مشبک مناسب پوشانده و مهار شده و میل‌مهارهای عرضی حمایت‌کننده مطابق بند 04-02-30 دستورالعمل RHS-W14 Rev 00 هستند؟',
    requirementFa: 'پوشش کامل و مهار الوار/ورق‌های مشبک سکوی کار و انطباق میل‌مهارهای عرضی با بند 04-02-30.',
    standardRef: 'RHS-W14 Rev 00 (04-02-30)',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-19',
    orderIndex: 19,
    categoryFa: 'بستر و بارگذاری',
    titleFa: 'آیا داربست برای مقدار بار موردنظر طراحی شده است؟',
    requirementFa: 'انطباق طراحی و ظرفیت باربری داربست با بار پرسنل، ابزار و مصالح پیش‌بینی‌شده.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-20',
    orderIndex: 20,
    categoryFa: 'پایداری و تجهیزات خاص',
    titleFa: 'آیا داربست متحرک مجهز به ترمز چرخ است؟',
    requirementFa: 'وجود و سلامت قفل/ترمز چرخ‌ها در داربست‌های متحرک پیش از بهره‌برداری.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-21',
    orderIndex: 21,
    categoryFa: 'پایداری و تجهیزات خاص',
    titleFa: 'آیا داربست‌های ۹ متر طول و ۸ متر ارتفاع به سازه چفت و بست شده‌اند؟',
    requirementFa: 'مهار و اتصال مطمئن داربست‌های دارای طول ۹ متر و ارتفاع ۸ متر به سازه ثابت.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-22',
    orderIndex: 22,
    categoryFa: 'حفاظت پیرامونی',
    titleFa: 'آیا حفاظ توری در صورت نیاز در بالای جایگاه و زیر آن نصب شده است؟',
    requirementFa: 'نصب توری ایمنی جهت جلوگیری از سقوط اشیاء و حفاظت افراد پایین‌دست در صورت نیاز.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: false,
    safeAnswer: 'YES',
  },
  {
    code: 'SCF-23',
    orderIndex: 23,
    categoryFa: 'بازرسی و انطباق',
    titleFa: 'آیا داربست طبق برنامه زمان‌بندی و مطابق دستورالعمل تهیه‌شده بازرسی و نصب شده است؟',
    requirementFa: 'انطباق کامل فرآیند نصب و بازرسی با برنامه زمان‌بندی و دستورالعمل اجرایی.',
    standardRef: 'RHS-W14 Rev 00',
    isCritical: true,
    safeAnswer: 'YES',
  },
];

export const DEFAULT_SCAFFOLD_CHECKLIST_SETTINGS: ScaffoldChecklistSettings = {
  allowNaOption: false,
};

/**
 * Convert an explicit YES/NO/NA answer to a PASS/FAIL/NA verdict respecting item polarity (`safeAnswer`).
 */
export function resolveChecklistVerdict(
  answer: ScaffoldChecklistAnswer | null | undefined,
  safeAnswer: 'YES' | 'NO' = 'YES'
): ScaffoldChecklistVerdict | null {
  if (!answer) return null;
  if (answer === 'NA') return 'NA';
  return answer === safeAnswer ? 'PASS' : 'FAIL';
}

/**
 * Derive YES/NO/NA answer from a response item (supports legacy items that only stored `verdict`).
 */
export function resolveChecklistAnswer(item: {
  answer?: ScaffoldChecklistAnswer | null;
  verdict?: ScaffoldChecklistVerdict | null;
  safeAnswer?: 'YES' | 'NO';
}): ScaffoldChecklistAnswer | null {
  if (item.answer === 'YES' || item.answer === 'NO' || item.answer === 'NA') {
    return item.answer;
  }
  const safe = item.safeAnswer || 'YES';
  if (item.verdict === 'NA') return 'NA';
  if (item.verdict === 'PASS') return safe;
  if (item.verdict === 'FAIL') return safe === 'YES' ? 'NO' : 'YES';
  return null;
}

export function createInitialScaffoldChecklist(
  previousChecklist?: ScaffoldChecklistResponseItem[] | null,
  allowNaOption = false
): ScaffoldChecklistResponseItem[] {
  const prevByCode = new Map(
    (Array.isArray(previousChecklist) ? previousChecklist : []).map(i => [i.code, i])
  );

  const items: ScaffoldChecklistResponseItem[] = STANDARD_SCAFFOLD_CHECKLIST_ITEMS.map(tpl => {
    const prev = prevByCode.get(tpl.code);
    const keepUnresolvedFail = prev?.verdict === 'FAIL' && !prev.resolved;
    const prevAnswer = prev ? resolveChecklistAnswer({ ...prev, safeAnswer: tpl.safeAnswer }) : null;

    let answer: ScaffoldChecklistAnswer = tpl.safeAnswer;
    if (keepUnresolvedFail) {
      answer = tpl.safeAnswer === 'YES' ? 'NO' : 'YES';
    } else if (prevAnswer === 'NA' && allowNaOption) {
      answer = 'NA';
    }

    const verdict = resolveChecklistVerdict(answer, tpl.safeAnswer);
    return {
      code: tpl.code,
      orderIndex: tpl.orderIndex,
      categoryFa: tpl.categoryFa,
      titleFa: tpl.titleFa,
      requirementFa: tpl.requirementFa,
      standardRef: tpl.standardRef,
      isCritical: tpl.isCritical,
      isCustom: false,
      safeAnswer: tpl.safeAnswer,
      answer,
      verdict,
      comment: keepUnresolvedFail ? prev?.comment || '' : '',
      defectPhoto: keepUnresolvedFail ? prev?.defectPhoto : undefined,
      correctiveAction: keepUnresolvedFail ? prev?.correctiveAction || '' : '',
      responsiblePerson: keepUnresolvedFail ? prev?.responsiblePerson || '' : '',
      dueDate: keepUnresolvedFail ? prev?.dueDate || '' : '',
      resolved: false,
    };
  });

  if (Array.isArray(previousChecklist)) {
    previousChecklist
      .filter(i => i.isCustom)
      .forEach((c, idx) => {
        const safe = c.safeAnswer || 'YES';
        const ans = resolveChecklistAnswer({ ...c, safeAnswer: safe }) || safe;
        const normalizedAns: ScaffoldChecklistAnswer = ans === 'NA' && !allowNaOption ? safe : ans;
        items.push({
          ...c,
          orderIndex: items.length + idx + 1,
          safeAnswer: safe,
          answer: normalizedAns,
          verdict: resolveChecklistVerdict(normalizedAns, safe),
        });
      });
  }

  return items;
}

export function evaluateScaffoldChecklist(items: ScaffoldChecklistResponseItem[]) {
  const safeItems = Array.isArray(items) ? items : [];
  const normalized = safeItems.map(it => {
    const safe = it.safeAnswer || 'YES';
    const verdict =
      it.verdict ||
      (it.answer ? resolveChecklistVerdict(it.answer, safe) : null);
    return { ...it, verdict };
  });

  const totalItems = normalized.length;
  const passedCount = normalized.filter(i => i.verdict === 'PASS').length;
  const failedItems = normalized.filter(i => i.verdict === 'FAIL');
  const failedCount = failedItems.length;
  const openFailedItems = failedItems.filter(i => !i.resolved);
  const openDefectsCount = openFailedItems.length;
  const criticalFailedItems = openFailedItems.filter(i => i.isCritical);
  const criticalDefectCount = criticalFailedItems.length;
  const naCount = normalized.filter(i => i.verdict === 'NA').length;
  const evaluatedCount = totalItems - naCount;
  const complianceScore =
    evaluatedCount > 0 ? Math.round((passedCount / evaluatedCount) * 100) : 100;

  let overallResult: 'APPROVED_SAFE' | 'CONDITIONAL_YELLOW' | 'REJECTED_UNSAFE' = 'APPROVED_SAFE';
  let recommendedTag: ScaffoldTagStatus = 'GREEN';

  if (criticalDefectCount > 0) {
    overallResult = 'REJECTED_UNSAFE';
    recommendedTag = 'RED';
  } else if (openDefectsCount > 0) {
    overallResult = 'CONDITIONAL_YELLOW';
    recommendedTag = 'YELLOW';
  }

  return {
    totalItems,
    passedCount,
    failedCount,
    naCount,
    openDefectsCount,
    criticalDefectCount,
    complianceScore,
    overallResult,
    recommendedTag,
  };
}

export function getWorkflowStepIndex(status?: string | null): number {
  const found = SCAFFOLD_WORKFLOW_STEPS.find(s => s.key === status);
  return found ? found.order : 1;
}

export function getScaffoldTypeLabelFa(typeValue?: string | null): string {
  const found = SCAFFOLD_TYPES.find(t => t.value === typeValue);
  return found ? found.labelFa : (typeValue || '-');
}

export function getInspectionReasonLabelFa(reason?: string | null): string {
  const found = SCAFFOLD_INSPECTION_REASONS.find(r => r.value === reason);
  return found ? found.labelFa : (reason || '-');
}
