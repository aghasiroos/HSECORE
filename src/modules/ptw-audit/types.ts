export type AuditStatusType = 'P' | 'O' | '-' | 'PASS' | 'DEFECT' | 'NA' | ''; // مطلوب (انطباق), نامطلوب (عدم انطباق), نامرتبط (عدم شمول)

export type PrimaryPermitType = 'HOT' | 'COLD';
export type PermitType = 'HOT' | 'COLD' | 'CONFINED_SPACE'; // backward compatibility

// انواع پروانه‌های کار الحاقی و تکمیلی مطابق ماژول پروانه کار مجتمع
export type AttachedPermitType = 
  | 'NONE'
  | 'ConfinedSpace'       // الحاقی ورود به فضای بسته
  | 'Excavation'          // الحاقی حفاری و خاکبرداری
  | 'ProcessMechanical'   // الحاقی جداسازی فرآیندی / مکانیکی / ایزوله دقیق
  | 'ElectricalIsolation' // الحاقی جداسازی الکتریکی و قفل LOTO
  | 'Radiation'           // الحاقی منابع پرتوزا و پرتونگاری صنعتی
  | 'VehicleCrane'        // الحاقی ورود جرثقیل و خودروهای سنگین
  | 'WorkingAtHeight'     // الحاقی کار در ارتفاع و داربست‌بندی
  | 'Other';              // سایر پروانه‌های الحاقی

export interface AttachedPermitOption {
  id: AttachedPermitType;
  titleFa: string;
  titleEn: string;
  codePrefix: string;
  descriptionFa: string;
  iconName?: string;
}

export type AuditLifecycleStatus = 'DRAFT' | 'FINALIZED' | 'CRITICAL_NC';

export interface PtwAuditItem {
  id: number;
  questionNumber: number;
  questionFa: string;
  status: AuditStatusType;
  remarks: string;
  category?: string;
  critical?: boolean;
}

export interface EnvironmentalHazardItem {
  id: string;
  labelFa: string;
  selected: boolean; // انتخاب‌شده در پروانه کار
  missed?: boolean;   // مورد نیاز برای شرایط کار ولی در پروانه کار انتخاب‌نشده (عدم انطباق)
  isCustom?: boolean;
}

export interface RequiredPpeItem {
  id: string;
  groupFa: string;
  labelFa: string;
  selected: boolean; // انتخاب‌شده در پروانه کار
  missed?: boolean;   // مورد نیاز برای شرایط کار ولی در پروانه کار انتخاب‌نشده (عدم انطباق)
  isCustom?: boolean;
}

export interface PrecautionItem {
  id: string;
  labelFa: string;
  selected: boolean; // انتخاب‌شده در پروانه کار
  missed?: boolean;   // مورد نیاز برای شرایط کار ولی در پروانه کار انتخاب‌نشده (عدم انطباق)
  isCustom?: boolean;
}

export interface PtwSigners {
  areaResponsibleName: string; // امضاء کننده مسئول محوطه
  seniorShiftSupervisorName: string; // امضاء کننده کشیک ارشد
  workPerformerName: string; // امضاء کننده مجری کار
  safetyUnitSignerName?: string; // امضاء کننده واحد ایمنی / HSE
}

export interface HseAuditorSignature {
  auditorName: string; // نام نماینده واحد HSE
  auditorId?: string;
  signedAt?: string;
  isSigned: boolean;
  signatureImage?: string;
}

export interface PtwAuditAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  mimeType: string;
  size: number; // size in bytes
  dataUrl: string; // Base64 data URL or URL
  uploadedAt: string;
  description?: string;
}

export interface PtwAuditRecord {
  id: string;
  documentCode: string; // کد سند (e.g. REG-HSE-FO-024)
  revisionNumber: string; // شماره بازنگری (e.g. 00 or 01)
  auditDate: string; // تاریخ (e.g. 1405/06/07)
  auditTime: string; // ساعت (e.g. 10:30)
  shift: string; // شیفت (روزکار DAY / شبکار NIGHT / ...)
  unitName: string; // واحد (e.g. تولید، تعمیرات، مخازن...)
  subUnitName?: string; // زیرمجموعه واحد
  
  permitType: PermitType; // نوع پروانه کار اصلی: گرم، سرد
  permitNumber: string; // شماره پروانه کار اصلی (e.g. HW-1405-0842)
  
  // پروانه کار الحاقی و تکمیلی (جایگزین دکمه فضای بسته به صورت لیست کشویی و ثبت شماره)
  hasAttachedPermit: boolean; // آیا پروانه کار الحاقی دارد؟
  attachedPermitType?: AttachedPermitType; // نوع پروانه کار الحاقی انتخابی
  attachedPermitNumber?: string; // شماره پروانه کار الحاقی ثبت شده
  attachedPermitTitleCustom?: string; // عنوان سفارشی در صورت انتخاب سایر
  
  signers: PtwSigners;
  workDescription: string; // شرح کار

  // 30 audit inspection questions
  inspectionItems: PtwAuditItem[];

  // Side sections
  environmentalHazards: EnvironmentalHazardItem[];
  requiredPpe: RequiredPpeItem[];
  precautionsTaken: PrecautionItem[];

  // Custom additions notes
  customOtherHazardsText?: string;
  customOtherPpeText?: string;
  customOtherPrecautionsText?: string;

  // Findings and conclusion report
  auditSummaryReport: string; // گزارش ممیزی اجرای سیستم پروانه کار
  defectsAndNonConformances?: string; // ثبت اختصاصی عدم انطباق‌ها و نواقص

  // Attachments (عکس‌ها و مستندات PDF پیوست شده به ممیزی)
  attachments?: PtwAuditAttachment[];

  // Auditor sign-off
  hseAuditor: HseAuditorSignature;

  // Status & metadata
  status: AuditLifecycleStatus; // پیش‌نویس | نهایی | عدم انطباق بحرانی
  complianceScore?: number; // 0 - 100 percentage
  passedCount?: number;
  defectsCount?: number;
  naCount?: number;
  
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface PtwAuditStats {
  totalAudits: number;
  finalizedCount: number;
  draftCount: number;
  criticalNcCount: number;
  avgComplianceScore: number;
  totalDefectsIdentified: number;
  hotPermitCount: number;
  coldPermitCount: number;
  attachedPermitCount: number;
  confinedSpacePermitCount?: number;
}

// ساختار داده ورود دستی آمار سنوات گذشته برای مقایسه و پایش روند سالانه
export interface PtwHistoricalYearStat {
  id: string; // شناسه یکتا، مثلاً 'hist-1402'
  year: string; // سال شمسی، مثلاً '1402'
  totalAudits: number; // تعداد کل ممیزی‌ها
  defectiveAudits: number; // تعداد پروانه‌کارهای دارای خطا
  defectRate: number; // درصد پروانه‌کارهای دارای خطا (محاسبه خودکار از defective / total * 100)
  totalDefectsSum: number; // مجموع کل خطاها
  avgComplianceScore: number; // میانگین امتیاز انطباق (درصد)
  
  // فیلدهای تکمیلی تفکیک نوع پروانه (اختیاری)
  hotPermitCount?: number; // تعداد پروانه کار گرم
  coldPermitCount?: number; // تعداد پروانه کار سرد
  confinedSpaceCount?: number; // تعداد ورود به فضای بسته
  attachedPermitCount?: number; // تعداد پروانه‌های الحاقی و تکمیلی
  
  notes?: string; // توضیحات و یادداشت‌های آماری سال
  isManualEntry: boolean; // آیا به صورت دستی وارد شده است
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_DOCUMENT_CODE = 'REG-HSE-FO-024';
export const DEFAULT_REVISION_NUMBER = '01';

export const ATTACHED_PERMIT_OPTIONS: AttachedPermitOption[] = [
  {
    id: 'NONE',
    titleFa: 'فاقد پروانه الحاقی (تکمیلی ندارد)',
    titleEn: 'None',
    codePrefix: '',
    descriptionFa: 'بدون نیاز به ضمیمه پروانه تکمیلی'
  },
  {
    id: 'ConfinedSpace',
    titleFa: 'پروانه الحاقی ورود به فضای بسته (مخازن / حوضچه‌ها)',
    titleEn: 'Confined Space Entry',
    codePrefix: 'CS-',
    descriptionFa: 'ورود به فضاهای بسته، مخازن، بویلرها، کانال‌ها و حوضچه‌ها'
  },
  {
    id: 'Excavation',
    titleFa: 'پروانه الحاقی حفاری و خاکبرداری',
    titleEn: 'Excavation & Trenching',
    codePrefix: 'EX-',
    descriptionFa: 'حفاری، کانال‌کنی و گودبرداری در محوطه و حریم خطوط'
  },
  {
    id: 'ProcessMechanical',
    titleFa: 'پروانه الحاقی جداسازی فرآیندی / مکانیکی / دیسکانکت',
    titleEn: 'Process & Mechanical Isolation',
    codePrefix: 'PI-',
    descriptionFa: 'انسداد مکانیکی، نصب فلنج کور، تخلیه، شستشو و برش خطوط فرآیندی'
  },
  {
    id: 'ElectricalIsolation',
    titleFa: 'پروانه الحاقی جداسازی الکتریکی و قفل LOTO',
    titleEn: 'Electrical Isolation & Lockout',
    codePrefix: 'EI-',
    descriptionFa: 'ایزولاسیون برقی، دیسکانکت کلیدهای قدرت و اعمال قفل و برچسب هشدار'
  },
  {
    id: 'Radiation',
    titleFa: 'پروانه الحاقی منابع پرتوزا و پرتونگاری صنعتی (NDT)',
    titleEn: 'Industrial Radiography',
    codePrefix: 'RAD-',
    descriptionFa: 'پرتونگاری با اشعه گاما و ایکس در خطوط لوله و سازه‌ها'
  },
  {
    id: 'VehicleCrane',
    titleFa: 'پروانه الحاقی تردد جرثقیل و خودروهای سنگین در سایت',
    titleEn: 'Crane & Heavy Equipment Entry',
    codePrefix: 'CR-',
    descriptionFa: 'تردد و استقرار جرثقیل‌های بوم متحرک، کفی، بالابر و ماشین‌آلات ویژه'
  },
  {
    id: 'WorkingAtHeight',
    titleFa: 'پروانه الحاقی کار در ارتفاع و داربست‌بندی',
    titleEn: 'Working At Height & Scaffolding',
    codePrefix: 'WAH-',
    descriptionFa: 'کار در ارتفاع بالای ۱.۸ متر، نصب و برچیدن داربست و بسکت'
  },
  {
    id: 'Other',
    titleFa: 'سایر مجوزهای الحاقی و تکمیلی اختصاصی',
    titleEn: 'Other Supplementary Permit',
    codePrefix: 'ATT-',
    descriptionFa: 'سایر ضمائم و دستورالعمل‌های خاص سایت'
  }
];

export const INITIAL_30_INSPECTION_ITEMS: PtwAuditItem[] = [
  {
    id: 1,
    questionNumber: 1,
    questionFa: 'آیا نوع پروانه کار (گرم / سرد) متناسب با ماهیت دقیق و خطرات فعالیت جاری انتخاب شده است؟',
    status: '',
    remarks: '',
    category: 'مشخصات و الزامات عمومی پروانه',
    critical: true
  },
  {
    id: 2,
    questionNumber: 2,
    questionFa: 'آیا شماره سریال، تاریخ صدور، ساعت شروع و خاتمه اعتبار پروانه به درستی درج شده است؟',
    status: '',
    remarks: '',
    category: 'مشخصات و الزامات عمومی پروانه',
    critical: false
  },
  {
    id: 3,
    questionNumber: 3,
    questionFa: 'آیا موقعیت مکانی دقیق اجرای کار (Unit / Area / Equipment) به وضوح مشخص و قید شده است؟',
    status: '',
    remarks: '',
    category: 'موقعیت و محدوده کار',
    critical: false
  },
  {
    id: 4,
    questionNumber: 4,
    questionFa: 'آیا شرح کامل عملیات اجرایی، ابزارها و تجهیزات مورد استفاده به شفافیت ثبت شده است؟',
    status: '',
    remarks: '',
    category: 'شرح فعالیت و ابزارها',
    critical: false
  },
  {
    id: 5,
    questionNumber: 5,
    questionFa: 'آیا مشخصات کامل مجری کار (نام، کد پرسنلی، واحد / شرکت پیمانکار) مشخص و معتبر است؟',
    status: '',
    remarks: '',
    category: 'عوامل اجرایی',
    critical: false
  },
  {
    id: 6,
    questionNumber: 6,
    questionFa: 'آیا مسئول محوطه / بهره‌بردار صادرکننده فرم را به درستی بررسی و امضا نموده است؟',
    status: '',
    remarks: '',
    category: 'صلاحیت و امضاهای مجاز',
    critical: true
  },
  {
    id: 7,
    questionNumber: 7,
    questionFa: 'آیا تاییدیه و امضای سرپرست شیفت ارشد بهره‌برداری / نوبتکاری اخذ شده است؟',
    status: '',
    remarks: '',
    category: 'صلاحیت و امضاهای مجاز',
    critical: true
  },
  {
    id: 8,
    questionNumber: 8,
    questionFa: 'آیا نماینده ایمنی، بهداشت و آتش‌نشانی (HSE) پروانه را بررسی و پیش از شروع امضا کرده است؟',
    status: '',
    remarks: '',
    category: 'صلاحیت و امضاهای مجاز',
    critical: true
  },
  {
    id: 9,
    questionNumber: 9,
    questionFa: 'آیا خطرات محیطی و فرآیندی مرتبط با کار شناسایی و در پروانه کار علامت‌گذاری شده است؟',
    status: '',
    remarks: '',
    category: 'شناسایی خطرات و ارزیابی ریسک',
    critical: true
  },
  {
    id: 10,
    questionNumber: 10,
    questionFa: 'آیا تجهیزات حفاظت فردی (PPE) متناسب با خطرات کار تعیین و توسط پرسنل استفاده می‌شود؟',
    status: '',
    remarks: '',
    category: 'تجهیزات حفاظت فردی',
    critical: true
  },
  {
    id: 11,
    questionNumber: 11,
    questionFa: 'آیا تمهیدات احتیاطی و کنترلی پیشگیرانه به صورت کامل توسط عوامل رعایت شده است؟',
    status: '',
    remarks: '',
    category: 'تمهیدات کنترلی و پیشگیرانه',
    critical: true
  },
  {
    id: 12,
    questionNumber: 12,
    questionFa: 'آیا تست گاز (سنجش LEL / O2 / H2S / CO) انجام و نتایج به همراه امضای مجاز ثبت گردیده است؟',
    status: '',
    remarks: '',
    category: 'تست گاز و پایش اتمسفر',
    critical: true
  },
  {
    id: 13,
    questionNumber: 13,
    questionFa: 'آیا تجهیزات اطفاء حریق (کپسول، پتوی ضدآتش، هوزریل) در محل مستقر و آماده به‌کار هستند؟',
    status: '',
    remarks: '',
    category: 'آمادگی در برابر حریق',
    critical: true
  },
  {
    id: 14,
    questionNumber: 14,
    questionFa: 'آیا سیستم‌های ایزولاسیون مکانیکی/فرآیندی و تخلیه خطوط (Depressurize & Bleed) انجام شده است؟',
    status: '',
    remarks: '',
    category: 'ایزولاسیون و مهار انرژی',
    critical: true
  },
  {
    id: 15,
    questionNumber: 15,
    questionFa: 'آیا ایزولاسیون الکتریکی، قفل‌گذاری و تگ‌گذاری هشدار (LOTO) با پروانه الحاقی اجرا شده است؟',
    status: '',
    remarks: '',
    category: 'ایزولاسیون برقی و LOTO',
    critical: true
  },
  {
    id: 16,
    questionNumber: 16,
    questionFa: 'آیا در صورت ورود به مخازن و کانال‌ها، پروانه الحاقی ورود به فضای بسته صادر و پیوست است؟',
    status: '',
    remarks: '',
    category: 'فضای بسته',
    critical: true
  },
  {
    id: 17,
    questionNumber: 17,
    questionFa: 'آیا تهویه مداوم (دمنده/مکش مکانیکی) و پایش پیوسته هوای فضای بسته برقرار است؟',
    status: '',
    remarks: '',
    category: 'فضای بسته',
    critical: true
  },
  {
    id: 18,
    questionNumber: 18,
    questionFa: 'آیا برای داربست و کار در ارتفاع، تگ سبز بازرسی معتبر و پروانه تکمیلی موجود است؟',
    status: '',
    remarks: '',
    category: 'کار در ارتفاع و داربست',
    critical: true
  },
  {
    id: 19,
    questionNumber: 19,
    questionFa: 'آیا پرسنل کار در ارتفاع به هارنس فول بادی، شوک‌گیر و لنیارد با نقطه تکیه‌گاه استاندارد مجهزند؟',
    status: '',
    remarks: '',
    category: 'کار در ارتفاع و داربست',
    critical: true
  },
  {
    id: 20,
    questionNumber: 20,
    questionFa: 'آیا در عملیات خاکبرداری و حفاری، استعلام تاسیسات زیرزمینی و مجوز مربوطه صادر شده است؟',
    status: '',
    remarks: '',
    category: 'حفاری و گودبرداری',
    critical: true
  },
  {
    id: 21,
    questionNumber: 21,
    questionFa: 'آیا حریم گودبرداری دارای شیب ایمن، مهاربندی، نوار خطر و علائم هشداردهنده کافی است؟',
    status: '',
    remarks: '',
    category: 'حفاری و گودبرداری',
    critical: false
  },
  {
    id: 22,
    questionNumber: 22,
    questionFa: 'آیا در پرتونگاری صنعتی (NDT)، حریم تشعشع محاسبه، نوارکشی زرد/ماژنتا و دزیمتری انجام شده است؟',
    status: '',
    remarks: '',
    category: 'پرتونگاری صنعتی',
    critical: true
  },
  {
    id: 23,
    questionNumber: 23,
    questionFa: 'آیا گواهینامه معتبر بازرسی فنی جرثقیل/لیفتراک، گواهینامه اپراتور و پروانه تردد موجود است؟',
    status: '',
    remarks: '',
    category: 'ماشین‌آلات و باربرداری',
    critical: true
  },
  {
    id: 24,
    questionNumber: 24,
    questionFa: 'آیا دیده‌بان ایمنی / آتش (Fire Watch / HSE Standby) در محل مستقر و به وظایف خود مسلط است؟',
    status: '',
    remarks: '',
    category: 'نیروی پشتیبان و آماده‌باش',
    critical: true
  },
  {
    id: 25,
    questionNumber: 25,
    questionFa: 'آیا جعبه کمک‌های اولیه، دوش/چشم‌شوی اضطراری و راهکار تخلیه مصدوم در دسترس است؟',
    status: '',
    remarks: '',
    category: 'آمادگی شرایط اضطراری',
    critical: false
  },
  {
    id: 26,
    questionNumber: 26,
    questionFa: 'آیا راه‌های دسترسی و فرار اضطراری (Emergency Exits) کاملاً باز، ایمن و بدون مانع است؟',
    status: '',
    remarks: '',
    category: 'مسیرهای خروج و اضطراری',
    critical: true
  },
  {
    id: 27,
    questionNumber: 27,
    questionFa: 'آیا وضعیت نظم و انضباط کارگاهی (Housekeeping) و اصول ساماندهی 5S در محل کار رعایت شده است؟',
    status: '',
    remarks: '',
    category: 'ساماندهی محیط کار (5S)',
    critical: false
  },
  {
    id: 28,
    questionNumber: 28,
    questionFa: 'آیا جلسه توجیهی ایمنی پیش از شروع کار (TBT) برای کلیه نفرات اجرایی برگزار گردیده است؟',
    status: '',
    remarks: '',
    category: 'آموزش و آگاهی‌بخشی',
    critical: false
  },
  {
    id: 29,
    questionNumber: 29,
    questionFa: 'آیا نسخه اصلی یا کپی معتبر پروانه کار در محل کارگاه نصب شده و در معرض دید قرار دارد؟',
    status: '',
    remarks: '',
    category: 'استقرار و نصب پروانه در محل',
    critical: true
  },
  {
    id: 30,
    questionNumber: 30,
    questionFa: 'آیا فرآیند تمدید اعتبار، تعلیق موقت، یا بستن نهایی پروانه مطابق دستورالعمل اجرایی است؟',
    status: '',
    remarks: '',
    category: 'تمدید و اختتام پروانه',
    critical: true
  }
];

export const INITIAL_ENVIRONMENTAL_HAZARDS: EnvironmentalHazardItem[] = [
  { id: 'flammable_gas', labelFa: 'گازهای قابل اشتعال و بخارات هیدروکربوری (LEL)', selected: false },
  { id: 'toxic_gas', labelFa: 'گازهای سمی و خفه‌کننده (H2S, CO, SO2)', selected: false },
  { id: 'oxygen_deficiency', labelFa: 'کمبود اکسیژن (کمتر از ۱۹.۵٪)', selected: false },
  { id: 'fall_height', labelFa: 'سقوط از ارتفاع و سقوط اشیاء و ابزار', selected: false },
  { id: 'electrical_shock', labelFa: 'برق‌گرفتگی و ولتاژهای فشار قوی / متوسط', selected: false },
  { id: 'high_pressure', labelFa: 'خطوط و تجهیزات تحت فشار بالا', selected: false },
  { id: 'high_temp', labelFa: 'سطوح داغ، سیالات با دمای بالا یا فوق‌سرد (Cryogenic)', selected: false },
  { id: 'chemical_splash', labelFa: 'پاشش مواد شیمیایی، اسیدها و سود کاستیک', selected: false },
  { id: 'mechanical_entangle', labelFa: 'قطعات متحرک مکانیکی، تسمه و چرخدنده‌ها', selected: false },
  { id: 'trench_collapse', labelFa: 'ریزش دیواره گود و مدفون شدن زیر آوار', selected: false },
  { id: 'radiation_exposure', labelFa: 'پرتوهای یونیزان و تشعشعات گاما / ایکس', selected: false },
  { id: 'excessive_noise', labelFa: 'سر و صدای بیش از حد مجاز صنعتی (> 85 dBA)', selected: false }
];

export const INITIAL_REQUIRED_PPE: RequiredPpeItem[] = [
  { id: 'ppe_helmet', groupFa: 'حفاظت سر', labelFa: 'کلاه ایمنی استاندارد با چانه‌بند', selected: false },
  { id: 'ppe_safety_glasses', groupFa: 'حفاظت چشم و چهره', labelFa: 'عینک ایمنی ضدضربه و ضدبخار', selected: false },
  { id: 'ppe_face_shield', groupFa: 'حفاظت چشم و چهره', labelFa: 'شیلد محافظ صورت (برشکاری / سنگ‌زنی)', selected: false },
  { id: 'ppe_welding_mask', groupFa: 'حفاظت چشم و چهره', labelFa: 'ماسک و فیلتر جوشکاری استاندارد', selected: false },
  { id: 'ppe_earplugs', groupFa: 'حفاظت شنوایی', labelFa: 'ایرپلاگ یا ایرماف گوشی استاندارد', selected: false },
  { id: 'ppe_dust_mask', groupFa: 'حفاظت تنفسی', labelFa: 'ماسک تنفسی ضد گرد و غبار (N95 / FFP2)', selected: false },
  { id: 'ppe_chemical_cartridge', groupFa: 'حفاظت تنفسی', labelFa: 'ماسک نیم‌صورت / تمام‌صورت با کارتریج شیمیایی', selected: false },
  { id: 'ppe_scba', groupFa: 'حفاظت تنفسی', labelFa: 'دستگاه تنفسی هوارسان مستقل (SCBA / Airline)', selected: false },
  { id: 'ppe_leather_gloves', groupFa: 'حفاظت دست', labelFa: 'دستکش چرمی صنعتی / جوشکاری', selected: false },
  { id: 'ppe_chemical_gloves', groupFa: 'حفاظت دست', labelFa: 'دستکش ضد مواد شیمیایی (نیتریل / نئوپرن)', selected: false },
  { id: 'ppe_dielectric_gloves', groupFa: 'حفاظت دست', labelFa: 'دستکش عایق برق فشار قوی', selected: false },
  { id: 'ppe_safety_boots', groupFa: 'حفاظت پا', labelFa: 'کفش ایمنی با سرپنجه کامپوزیت / فولادی', selected: false },
  { id: 'ppe_acid_boots', groupFa: 'حفاظت پا', labelFa: 'چکمه ضد اسید و مواد شیمیایی', selected: false },
  { id: 'ppe_coverall', groupFa: 'حفاظت تنه', labelFa: 'لباس کار ۱۰۰٪ کتان نسوز (FR)', selected: false },
  { id: 'ppe_chemical_suit', groupFa: 'حفاظت تنه', labelFa: 'لباس سراسری ضد اسید و مواد شیمیایی', selected: false },
  { id: 'ppe_safety_harness', groupFa: 'کار در ارتفاع', labelFa: 'کمربند ایمنی فول بادی (هارنس) با شوک‌گیر', selected: false }
];

export const INITIAL_PRECAUTIONS: PrecautionItem[] = [
  { id: 'prec_gas_test', labelFa: 'انجام تست گاز پیش از شروع کار و پایش مداوم هوای محیط', selected: false },
  { id: 'prec_fire_extinguisher', labelFa: 'استقرار کپسول‌های پودری و CO2 آماده به کار در محل مجاور کار', selected: false },
  { id: 'prec_fire_blanket', labelFa: 'استفاده از پتوی ضدآتش برای پوشاندن لوله‌ها، تجهیزات و حوضچه‌ها', selected: false },
  { id: 'prec_fire_watch', labelFa: 'حضور مستمر و فعال دیده‌بان آتش / مراقب ایمنی در حین عملیات', selected: false },
  { id: 'prec_loto_applied', labelFa: 'اعمال سیستم قفل و برچسب هشدار (LOTO) و آزمایش عدم وجود ولتاژ', selected: false },
  { id: 'prec_blind_installed', labelFa: 'نصب فلنج کور (Spade / Blind) و جداکردن خطوط فرآیندی مربوطه', selected: false },
  { id: 'prec_depressurized', labelFa: 'تخلیه کامل فشار، بخار، گاز و شستشوی سیستم با آب / ازت', selected: false },
  { id: 'prec_mechanical_ventilation', labelFa: 'تامین تهویه مکانیکی مداوم با دمنده ضدجرقه (Air Mover)', selected: false },
  { id: 'prec_scaffold_greentag', labelFa: 'نصب تگ سبز بازرسی داربست و بازرسی چشمی بست‌ها و پایه‌ها', selected: false },
  { id: 'prec_barricade_tape', labelFa: 'محصور نمودن حریم عملیات با نوار خطر زرد و تابلوهای هشدار', selected: false },
  { id: 'prec_tbt_briefing', labelFa: 'برگزاری جلسه آموزش ایمنی پیش از شروع کار (TBT) برای کلیه نفرات', selected: false },
  { id: 'prec_clear_exit_routes', labelFa: 'باز نگه داشتن کامل مسیرهای خروج اضطراری و دسترسی امداد', selected: false }
];

