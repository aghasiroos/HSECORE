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

export interface ScaffoldChecklistTemplateItem {
  code: string;
  orderIndex: number;
  categoryFa: string;
  titleFa: string;
  requirementFa: string;
  standardRef: string;
  isCritical: boolean;
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
 * 15 standard HSE scaffolding inspection checklist items (OSHA 1926 Subpart L / BS EN 12811 / TG20).
 * Items marked `isCritical: true` automatically block final approval & GREEN tag issuance if failed & unresolved.
 */
export const STANDARD_SCAFFOLD_CHECKLIST_ITEMS: ScaffoldChecklistTemplateItem[] = [
  {
    code: 'SCF-01',
    orderIndex: 1,
    categoryFa: 'بستر و استقرار',
    titleFa: 'وضعیت زمین و محل استقرار',
    requirementFa: 'زمین محل استقرار داربست مستحکم، هموار، تراز و عاری از نشست، گودبرداری، آب‌گرفتگی و نشت مواد شیمیایی باشد.',
    standardRef: 'OSHA 1926.451(c)(2)',
    isCritical: true,
  },
  {
    code: 'SCF-02',
    orderIndex: 2,
    categoryFa: 'بستر و استقرار',
    titleFa: 'کفشک‌ها و صفحات زیرپایه',
    requirementFa: 'کلیه پایه‌های عمودی دارای صفحه زیرپایه فلزی (Base Plate) استاندارد و الوار زیرکفشک (Sole Board) سالم و تراز باشند.',
    standardRef: 'OSHA 1926.451(c)(2)(i)',
    isCritical: true,
  },
  {
    code: 'SCF-03',
    orderIndex: 3,
    categoryFa: 'سازه و قطعات',
    titleFa: 'سلامت لوله‌ها و اتصالات',
    requirementFa: 'لوله‌های داربست و بست‌ها فاقد خوردگی شدید، خمیدگی، ترک‌خوردگی، فرورفتگی یا جوشکاری غیراستاندارد باشند.',
    standardRef: 'BS EN 39 / EN 74',
    isCritical: true,
  },
  {
    code: 'SCF-04',
    orderIndex: 4,
    categoryFa: 'سازه و قطعات',
    titleFa: 'مهاربندی افقی و مورب',
    requirementFa: 'مهارهای طولی (Ledger)، عرضی (Transom)، مهارهای ضربدری/مورب (Bracing) و مهار به سازه ثابت (Tie-in) کامل و استاندارد باشند.',
    standardRef: 'BS EN 12811 / TG20',
    isCritical: true,
  },
  {
    code: 'SCF-05',
    orderIndex: 5,
    categoryFa: 'سازه و قطعات',
    titleFa: 'اتصالات و استحکام سازه',
    requirementFa: 'تمامی بست‌های ثابت و گردان با گشتاور مناسب محکم شده، پایه‌ها شاقول بوده و سازه بدون لرزش و لق‌زدگی باشد.',
    standardRef: 'OSHA 1926.451(a)',
    isCritical: true,
  },
  {
    code: 'SCF-06',
    orderIndex: 6,
    categoryFa: 'سکوی کار',
    titleFa: 'سکوی کار و تخته‌های داربست',
    requirementFa: 'سکوی کار به‌طور کامل با تخته‌های استاندارد (بدون ترک، پوسیدگی و شکستگی) پوشیده شده، فاصله مجاز رعایت و تخته‌ها مهار شده باشند.',
    standardRef: 'OSHA 1926.451(b)',
    isCritical: true,
  },
  {
    code: 'SCF-07',
    orderIndex: 7,
    categoryFa: 'حفاظت در برابر سقوط',
    titleFa: 'گاردریل بالایی و میانی',
    requirementFa: 'نرده محافظ بالایی (ارتفاع ۹۵ تا ۱۱۰ سانتی‌متر) و میانی در کلیه لبه‌های باز سکوی کار به‌صورت مستحکم نصب شده باشد.',
    standardRef: 'OSHA 1926.451(g)(4)',
    isCritical: true,
  },
  {
    code: 'SCF-08',
    orderIndex: 8,
    categoryFa: 'حفاظت در برابر سقوط',
    titleFa: 'پاخور (Toe Board)',
    requirementFa: 'پاخور استاندارد با ارتفاع حداقل ۱۵ سانتی‌متر در تمام لبه‌های سکوی کار جهت جلوگیری از سقوط ابزار و مصالح نصب شده باشد.',
    standardRef: 'OSHA 1926.451(h)(4)',
    isCritical: false,
  },
  {
    code: 'SCF-09',
    orderIndex: 9,
    categoryFa: 'دسترسی ایمن',
    titleFa: 'مسیر دسترسی و نردبان',
    requirementFa: 'نردبان دسترسی استاندارد با شیب مناسب (۱ به ۴)، مهار ایمن در بالا و پایین و امتداد حداقل ۱ متر بالاتر از سکوی کار نصب باشد.',
    standardRef: 'OSHA 1926.451(e)',
    isCritical: true,
  },
  {
    code: 'SCF-10',
    orderIndex: 10,
    categoryFa: 'ایمنی الکتریکی',
    titleFa: 'فاصله ایمن از خطوط برق',
    requirementFa: 'حریم ایمن قانونی از خطوط انتقال برق هوایی و تجهیزات برقدار رعایت شده و در صورت لزوم عایق‌بندی یا قطع برق انجام شده باشد.',
    standardRef: 'OSHA 1926.451(f)(6)',
    isCritical: true,
  },
  {
    code: 'SCF-11',
    orderIndex: 11,
    categoryFa: 'ظرفیت و بارگذاری',
    titleFa: 'ظرفیت بارگذاری',
    requirementFa: 'حداکثر بار مجاز سکوی کار مشخص بوده، مصالح اضافی روی سکو دپو نشده و از بارگذاری بیش از ظرفیت طراحی جلوگیری شده باشد.',
    standardRef: 'BS EN 12811-1 Load Class',
    isCritical: true,
  },
  {
    code: 'SCF-12',
    orderIndex: 12,
    categoryFa: 'پایداری و مهندسی',
    titleFa: 'ارتفاع و پایداری داربست',
    requirementFa: 'نسبت ارتفاع به عرض پایه استاندارد رعایت شده و برای داربست‌های مرتفع (بالای ۴ برابر عرض پایه یا خاص) محاسبات/مهار جانبی انجام شده باشد.',
    standardRef: 'OSHA 1926.451(c)(1)',
    isCritical: true,
  },
  {
    code: 'SCF-13',
    orderIndex: 13,
    categoryFa: 'شرایط محیطی',
    titleFa: 'شرایط محیطی',
    requirementFa: 'شرایط جوی (سرعت باد مجاز، نبود یخ‌زدگی و لغزندگی سکو)، روشنایی محیط و ایمنی تردد ماشین‌آلات پیرامون داربست مناسب باشد.',
    standardRef: 'OSHA 1926.451(f)(8)',
    isCritical: false,
  },
  {
    code: 'SCF-14',
    orderIndex: 14,
    categoryFa: 'علائم و حصارکشی',
    titleFa: 'علائم هشداردهنده',
    requirementFa: 'نوار خطر/حصارکشی محوطه زیر داربست، تابلوی هشدار «کار در ارتفاع / احتمال سقوط اشیاء» و هولدر تگ رنگی در محل ورود نصب باشد.',
    standardRef: 'HSE Scaffolding Standard',
    isCritical: false,
  },
  {
    code: 'SCF-15',
    orderIndex: 15,
    categoryFa: 'الزامات فنی و ایمنی',
    titleFa: 'انطباق با الزامات فنی و ایمنی',
    requirementFa: 'انطباق کامل نصب با دستورالعمل HSE، اعتبار پروانه کار (PTW) مرتبط، صلاحیت داربست‌بندان و رعایت الزامات حفاظتی مجتمع.',
    standardRef: 'HSECORE-STD-SCF',
    isCritical: true,
  },
];

export function evaluateScaffoldChecklist(items: ScaffoldChecklistResponseItem[]) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalItems = safeItems.length;
  const passedCount = safeItems.filter(i => i.verdict === 'PASS').length;
  const failedItems = safeItems.filter(i => i.verdict === 'FAIL');
  const failedCount = failedItems.length;
  const openFailedItems = failedItems.filter(i => !i.resolved);
  const openDefectsCount = openFailedItems.length;
  const criticalFailedItems = openFailedItems.filter(i => i.isCritical);
  const criticalDefectCount = criticalFailedItems.length;
  const naCount = safeItems.filter(i => i.verdict === 'NA').length;
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
