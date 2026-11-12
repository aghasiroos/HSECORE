/**
 * Authoritative Regulatory & Engineering Reference Catalog for Process Safety Management (PSM)
 * Tailored for Rejal Petrochemical Complex (مجتمع پتروشیمی رجال)
 *
 * Standards Covered:
 * 1. CCPS Risk Based Process Safety (RBPS) — 4 Pillars & 20 Elements
 * 2. OSHA 29 CFR 1910.119 — 14 Mandatory Clauses
 * 3. N:M Traceability Matrix between CCPS RBPS & OSHA 1910.119 (Direct vs. Indirect Links)
 * 4. Iranian National Regulations & NPC / Rejal Petrochemical Internal Standards
 * 5. 14 Specialized PSM Technical Subsystems
 * 6. 5-Level Internal PSM Maturity Model (Independent from Project Progress & Document Completion)
 * 7. 8-Stage Independent CAPA Workflow & Project Final Handover Acceptance Gateways
 */

export interface CcpsPillarMeta {
  id: 'COMMIT' | 'UNDERSTAND' | 'MANAGE' | 'LEARN';
  number: number;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
}

export interface CcpsElementMeta {
  code: string; // CCPS-01 .. CCPS-20
  number: number;
  pillarId: 'COMMIT' | 'UNDERSTAND' | 'MANAGE' | 'LEARN';
  pillarTitleFa: string;
  titleFa: string;
  titleEn: string;
  defaultCriteriaFa: string;
  requiredDocTemplates: string[];
  nationalAndRejalRef: string;
  defaultRiskWeight: number;
}

export interface OshaClauseMeta {
  code: string; // OSHA-01 .. OSHA-14
  cfrParagraph: string; // 1910.119(c) .. 1910.119(p)
  titleFa: string;
  titleEn: string;
  defaultCriteriaFa: string;
  requiredDeliverables: string[];
}

export interface CcpsOshaMappingEntry {
  ccpsCode: string;
  oshaCode: string;
  relationType: 'DIRECT' | 'INDIRECT';
  rationaleFa: string;
}

export interface PsmSubsystemMeta {
  key:
    | 'PSI'
    | 'PHA'
    | 'HAZOP'
    | 'HAZID'
    | 'LOPA'
    | 'BOW_TIE'
    | 'OPERATING_PROCEDURES'
    | 'MI'
    | 'MOC'
    | 'PSSR'
    | 'CONTRACTORS'
    | 'TRAINING'
    | 'INCIDENT_INVESTIGATION'
    | 'EMERGENCY_PLANNING';
  titleFa: string;
  titleEn: string;
  ccpsElements: string[];
  oshaClauses: string[];
  descriptionFa: string;
  defaultTrackingPath: string;
}

export interface MaturityLevelMeta {
  level: 1 | 2 | 3 | 4 | 5;
  key: 'INITIAL' | 'DEVELOPING' | 'DEFINED' | 'MANAGED' | 'OPTIMIZING';
  titleFa: string;
  titleEn: string;
  summaryFa: string;
  verificationCriteriaFa: string[];
}

export const CCPS_PILLARS: CcpsPillarMeta[] = [
  {
    id: 'COMMIT',
    number: 1,
    titleFa: 'رکن ۱: تعهد به ایمنی فرایند',
    titleEn: 'Pillar 1: Commit to Process Safety',
    descriptionFa: 'رهبری سازمانی، فرهنگ ایمنی فرایند، رعایت استانداردها، شایستگی، و مشارکت ذینفعان و نیروی کار',
  },
  {
    id: 'UNDERSTAND',
    number: 2,
    titleFa: 'رکن ۲: شناخت مخاطرات و ارزیابی ریسک',
    titleEn: 'Pillar 2: Understand Hazards and Risk',
    descriptionFa: 'مدیریت دانش ایمنی فرایند (PSI) و شناسایی و تحلیل سیستماتیک مخاطرات و سناریوهای ریسک فرایندی',
  },
  {
    id: 'MANAGE',
    number: 3,
    titleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleEn: 'Pillar 3: Manage Risk',
    descriptionFa: 'دستورالعمل‌های عملیاتی، کار ایمن، یکپارچگی مکانیکی، مدیریت پیمانکاران، آموزش، MOC، PSSR، بهره‌برداری و مدیریت شرایط اضطراری',
  },
  {
    id: 'LEARN',
    number: 4,
    titleFa: 'رکن ۴: یادگیری از تجربیات و بهبود مستمر',
    titleEn: 'Pillar 4: Learn from Experience',
    descriptionFa: 'تحقیق و ریشه‌یابی حوادث، پایش شاخص‌های پیشرو و پسرو، ممیزی ادواری و بازنگری مدیریتی',
  },
];

export const CCPS_20_ELEMENTS: CcpsElementMeta[] = [
  // Pillar 1: Commit to Process Safety (5 Elements)
  {
    code: 'CCPS-01',
    number: 1,
    pillarId: 'COMMIT',
    pillarTitleFa: 'رکن ۱: تعهد به ایمنی فرایند',
    titleFa: 'فرهنگ ایمنی فرایند',
    titleEn: 'Process Safety Culture',
    defaultCriteriaFa: 'تثبیت ارزش‌های ایمنی فرایند در تصمیم‌گیری‌های عملیاتی، گزارش‌دهی بدون ترس از تنبیه، و اولویت ایمنی بر تولید در واحدهای پلیمری و یوتیلیتی پتروشیمی رجال.',
    requiredDocTemplates: ['خط‌مشی و منشور فرهنگ ایمنی فرایند', 'گزارش پیمایش دوره‌ای فرهنگ ایمنی فرایند', 'برنامه ارتقای رهبری ایمنی فرایند'],
    nationalAndRejalRef: 'آیین‌نامه ایمنی در صنایع شیمیایی وزارت کار / دستورالعمل راهبری HSE پتروشیمی رجال RJL-PSM-01',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-02',
    number: 2,
    pillarId: 'COMMIT',
    pillarTitleFa: 'رکن ۱: تعهد به ایمنی فرایند',
    titleFa: 'انطباق با استانداردها، قوانین و مقررات',
    titleEn: 'Compliance with Standards',
    defaultCriteriaFa: 'شناسایی، ثبت، پایش و ممیزی انطباق با استانداردهای API, ASME, NFPA, IEC 61511، مقررات ملی ایران و الزامات شرکت ملی صنایع پتروشیمی (NPC).',
    requiredDocTemplates: ['ماتریس جامع قوانین و استانداردهای ایمنی فرایند (RAGAGEP)', 'فرم ارزیابی انطباق با استانداردهای مهندسی و ملی'],
    nationalAndRejalRef: 'مقررات ملی ایمنی، استانداردهای NPC و استاندارد مهندسی پتروشیمی رجال RJL-PSM-02',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-03',
    number: 3,
    pillarId: 'COMMIT',
    pillarTitleFa: 'رکن ۱: تعهد به ایمنی فرایند',
    titleFa: 'شایستگی در ایمنی فرایند',
    titleEn: 'Process Safety Competency',
    defaultCriteriaFa: 'حفظ، ارتقا و مستندسازی دانش و مهارت تخصصی مهندسی و عملیاتی ایمنی فرایند در سطوح مدیریتی، مهندسی فرایند، تعمیرات و بهره‌برداری.',
    requiredDocTemplates: ['ماتریس شایستگی تخصصی ایمنی فرایند به تفکیک سمت', 'برنامه توسعه دانش فنی و نگهداشت تجربه سازمانی'],
    nationalAndRejalRef: 'استاندارد صلاحیت حرفه‌ای صنایع پتروشیمی / دستورالعمل RJL-PSM-03',
    defaultRiskWeight: 4,
  },
  {
    code: 'CCPS-04',
    number: 4,
    pillarId: 'COMMIT',
    pillarTitleFa: 'رکن ۱: تعهد به ایمنی فرایند',
    titleFa: 'مشارکت نیروی کار',
    titleEn: 'Workforce Involvement',
    defaultCriteriaFa: 'مشارکت فعال و مستند اپراتورها، تکنسین‌ها و کارشناسان در مطالعات PHA/HAZOP، تدوین SOPها، مدیریت تغییر (MOC) و کمیته‌های ایمنی فرایند.',
    requiredDocTemplates: ['روش اجرایی مشارکت کارکنان در ایمنی فرایند', 'صورتجلسات مشارکت عملیاتی در HAZOP و بازنگری SOP'],
    nationalAndRejalRef: 'آیین‌نامه کمیته‌های حفاظت فنی و بهداشت کار ایران / دستورالعمل RJL-PSM-04',
    defaultRiskWeight: 4,
  },
  {
    code: 'CCPS-05',
    number: 5,
    pillarId: 'COMMIT',
    pillarTitleFa: 'رکن ۱: تعهد به ایمنی فرایند',
    titleFa: 'ارتباط با ذینفعان بیرونی',
    titleEn: 'Stakeholder Outreach',
    defaultCriteriaFa: 'تعامل ساختاریافته با صنایع مجاور در منطقه ویژه اقتصادی پتروشیمی، سازمان‌های امدادی، محیط زیست و نهادهای نظارتی در زمینه ریسک‌های فرایندی.',
    requiredDocTemplates: ['برنامه ارتباط با ذینفعان و صنایع همجوار (Mutual Aid)', 'پروتکل تبادل اطلاعات اضطراری منطقه ویژه'],
    nationalAndRejalRef: 'الزامات پدافند غیرعامل و مدیریت بحران منطقه ویژه اقتصادی پتروشیمی / RJL-PSM-05',
    defaultRiskWeight: 3,
  },

  // Pillar 2: Understand Hazards and Risk (2 Elements)
  {
    code: 'CCPS-06',
    number: 6,
    pillarId: 'UNDERSTAND',
    pillarTitleFa: 'رکن ۲: شناخت مخاطرات و ارزیابی ریسک',
    titleFa: 'مدیریت دانش ایمنی فرایند (PSI)',
    titleEn: 'Process Knowledge Management (PSI)',
    defaultCriteriaFa: 'تکمیل، صحت‌سنجی و به‌روزرسانی مدارک خطرات مواد شیمیایی (SDS/MSDS)، فناوری فرایند (PFD، موازنه جرم و انرژی، حدود ایمن عملیاتی) و تجهیزات (P&ID، محاسبات PSV، طبقه‌بندی نواحی خطرزا، SIS).',
    requiredDocTemplates: ['پرونده جامع اطلاعات ایمنی فرایند (PSI Dossier)', 'فهرست P&IDهای As-Built و حدود ایمن طراحی و عملیات (SOL)', 'ماتریس سازگاری مواد شیمیایی'],
    nationalAndRejalRef: 'استاندارد مهندسی مدارک فرایندی پتروشیمی رجال RJL-PSM-06',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-07',
    number: 7,
    pillarId: 'UNDERSTAND',
    pillarTitleFa: 'رکن ۲: شناخت مخاطرات و ارزیابی ریسک',
    titleFa: 'شناسایی مخاطرات و تحلیل ریسک (HIRA / PHA)',
    titleEn: 'Hazard Identification and Risk Analysis (PHA)',
    defaultCriteriaFa: 'اجرای سیستماتیک مطالعات HAZID, HAZOP, LOPA, SIL Assessment, QRA و Bow-Tie برای تمام واحدهای فرایندی و بازنگری حداقل هر ۵ سال یک‌بار همراه با پیگیری کامل توصیه‌ها.',
    requiredDocTemplates: ['روش اجرایی مطالعات PHA / HAZOP / LOPA', 'گزارش نهایی HAZOP و LOPA واحدها', 'جدول ردیابی و بستن توصیه‌های مطالعات ریسک'],
    nationalAndRejalRef: 'دستورالعمل ارزیابی ریسک فرایندی NPC و پتروشیمی رجال RJL-PSM-07',
    defaultRiskWeight: 5,
  },

  // Pillar 3: Manage Risk (9 Elements)
  {
    code: 'CCPS-08',
    number: 8,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'دستورالعمل‌های عملیاتی (Operating Procedures)',
    titleEn: 'Operating Procedures',
    defaultCriteriaFa: 'تدوین، بازنگری سالانه و صحه‌گذاری دستورالعمل‌های راه‌اندازی اولیه، عملیات نرمال، عملیات موقت، توقف اضطراری (ESD)، توقف نرمال، راه‌اندازی پس از اورهال و حدود ایمن عملیاتی.',
    requiredDocTemplates: ['دستورالعمل‌های استاندارد بهره‌برداری (SOP / EOP)', 'گواهی بازنگری و تصدیق سالانه دستورالعمل‌های عملیاتی', 'جدول پیامدهای انحراف از حدود ایمن (SOL)'],
    nationalAndRejalRef: 'استاندارد بهره‌برداری واحدهای پلیمری پتروشیمی رجال RJL-PSM-08',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-09',
    number: 9,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'رویه اجرای کار ایمن (Safe Work Practices)',
    titleEn: 'Safe Work Practices',
    defaultCriteriaFa: 'استقرار و کنترل سخت‌گیرانه پروانه‌های کار (PTW) شامل کار گرم، سرد، ورود به فضای بسته، ایزولاسیون انرژی (LOTO)، حفاری، کار در ارتفاع و باز کردن خطوط فرایندی (Line Breaking).',
    requiredDocTemplates: ['روش اجرایی صدور پروانه کار ایمن (PTW)', 'دستورالعمل ایزولاسیون مکانیکی و الکتریکی (LOTO)', 'چک‌لیست کنترل ورود به فضاهای بسته و کار گرم'],
    nationalAndRejalRef: 'آیین‌نامه ایمنی پروانه‌های کار وزارت کار و دستورالعمل PTW رجال RJL-PSM-09',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-10',
    number: 10,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'یکپارچگی دارایی‌ها و قابلیت اطمینان (MI)',
    titleEn: 'Asset Integrity and Reliability (Mechanical Integrity)',
    defaultCriteriaFa: 'برنامه جامع بازرسی فنی مبتنی بر ریسک (RBI)، تست و نگهداری پیشگیرانه مخازن تحت فشار، خطوط لوله، ماشین‌آلات دوار، شیرهای اطمینان (PSV)، سیستم‌های ابزار دقیق ایمنی (SIS) و اعلام و اطفاء حریق.',
    requiredDocTemplates: ['فهرست تجهیزات بحران ایمنی (SCE Register)', 'برنامه بازرسی فنی و تست دوره‌ای (RBI / PM / Proof Test)', 'روش مدیریت نواقص تجهیزات بحرانی (IOW / Deficiencies)'],
    nationalAndRejalRef: 'آیین‌نامه مخازن تحت فشار ایران، API 510/570/653 و استاندارد MI رجال RJL-PSM-10',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-11',
    number: 11,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'مدیریت پیمانکاران',
    titleEn: 'Contractor Management',
    defaultCriteriaFa: 'ارزیابی صلاحیت ایمنی پیمانکاران پیش از انتخاب، آموزش خطرات اختصاصی فرایند، نظارت حین کار در تعمیرات اساسی (Overhaul) و عملیات روزمره و ارزیابی دوره‌ای عملکرد.',
    requiredDocTemplates: ['روش اجرایی ارزیابی صلاحیت و مدیریت HSE پیمانکاران', 'پرونده آموزش و توجیه ایمنی فرایند پیمانکاران', 'فرم ممیزی عملکرد پیمانکاران در واحدهای فرایندی'],
    nationalAndRejalRef: 'آیین‌نامه ایمنی امور پیمانکاری وزارت کار و دستورالعمل پیمانکاران رجال RJL-PSM-11',
    defaultRiskWeight: 4,
  },
  {
    code: 'CCPS-12',
    number: 12,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'آموزش و تضمین عملکرد',
    titleEn: 'Training and Performance Assurance',
    defaultCriteriaFa: 'اجرای آموزش‌های بدو استخدام، تخصصی و بازآموزی (حداقل هر ۳ سال) برای بهره‌برداران و نفرات تعمیرات به همراه آزمون سنجش مهارت و تأیید صلاحیت عملیاتی در سایت.',
    requiredDocTemplates: ['برنامه جامع آموزشی و بازآموزی ایمنی فرایند', 'سوابق آزمون و تاییدیه صلاحیت عملیاتی اپراتورها'],
    nationalAndRejalRef: 'آیین‌نامه آموزش ایمنی کارگران و کارفرمایان / دستورالعمل RJL-PSM-12',
    defaultRiskWeight: 4,
  },
  {
    code: 'CCPS-13',
    number: 13,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'مدیریت تغییر (MOC)',
    titleEn: 'Management of Change (MOC)',
    defaultCriteriaFa: 'فرآیند رسمی بررسی، ارزیابی ریسک، تأیید فنی و به‌روزرسانی مدارک PSI و SOP برای هرگونه تغییر موقت یا دائم در مواد شیمیایی، فناوری، تجهیزات، نرم‌افزار کنترل (DCS/ESD) و ساختار سازمانی.',
    requiredDocTemplates: ['روش اجرایی مدیریت تغییرات فنی و سازمانی (MOC)', 'فرم درخواست، ارزیابی ریسک و تایید تغییر (MOC Dossier)', 'ثبت تغییرات موقت و کنترل مهلت بازگشت به حالت عادی'],
    nationalAndRejalRef: 'استاندارد مدیریت تغییر NPC و دستورالعمل MOC پتروشیمی رجال RJL-PSM-13',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-14',
    number: 14,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'آمادگی عملیاتی و بازنگری ایمنی پیش از راه‌اندازی (PSSR)',
    titleEn: 'Operational Readiness (PSSR)',
    defaultCriteriaFa: 'انجام ممیزی و بازنگری ایمنی پیش از راه‌اندازی (PSSR) برای واحدهای جدید، تعمیرات اساسی یا تغییرات MOC، و حصول اطمینان از انطباق ساخت، تکمیل مدارک، آموزش و رفع توصیه‌های PHA پیش از تزریق مواد هیدروکربنی.',
    requiredDocTemplates: ['روش اجرایی بازنگری ایمنی پیش از راه‌اندازی (PSSR)', 'چک‌لیست و گواهی مجوز راه‌اندازی ایمن (PSSR Sign-off Certificate)'],
    nationalAndRejalRef: 'دستورالعمل راه‌اندازی ایمن واحدهای فرایندی پتروشیمی رجال RJL-PSM-14',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-15',
    number: 15,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'انضباط و هدایت عملیات (Conduct of Operations)',
    titleEn: 'Conduct of Operations',
    defaultCriteriaFa: 'اجرای دقیق و باانضباط وظایف عملیاتی شامل تحویل و تحول استاندارد شیفت، لاگ‌بوک اتاق کنترل، مدیریت آلارم‌ها، کنترل بای‌پس‌های سیستم ایمنی (Safety Bypass Log) و نظارت مستمر بر پارامترهای فرایندی.',
    requiredDocTemplates: ['دستورالعمل تحویل و تحول شیفت و ثبت گزارش اتاق کنترل', 'روش اجرایی کنترل و مجوز بای‌پس/Override سیستم‌های ایمنی و اینترلاک‌ها'],
    nationalAndRejalRef: 'استاندارد انضباط عملیاتی مجتمع پتروشیمی رجال RJL-PSM-15',
    defaultRiskWeight: 4,
  },
  {
    code: 'CCPS-16',
    number: 16,
    pillarId: 'MANAGE',
    pillarTitleFa: 'رکن ۳: مدیریت ریسک‌های فرایندی',
    titleFa: 'مدیریت شرایط اضطراری (ERP)',
    titleEn: 'Emergency Management',
    defaultCriteriaFa: 'تدوین طرح‌های واکنش در شرایط اضطراری مبتنی بر سناریوهای فرایندی (نشت پروپیلن/هیدروکربن، آتش‌سوزی مخازن، انفجار راکتور)، تجهیز سامانه فرماندهی حادثه (ICS) و اجرای مانورهای عملیاتی مستند.',
    requiredDocTemplates: ['طرح جامع واکنش در شرایط اضطراری فرایندی (ERP)', 'سناریوهای عملیاتی Pre-Incident Plans (PIP)', 'گزارش ارزیابی مانورهای اضطراری و درس‌آموخته‌ها'],
    nationalAndRejalRef: 'الزامات سازمان مدیریت بحران کشور و طرح اضطراری پتروشیمی رجال RJL-PSM-16',
    defaultRiskWeight: 5,
  },

  // Pillar 4: Learn from Experience (4 Elements)
  {
    code: 'CCPS-17',
    number: 17,
    pillarId: 'LEARN',
    pillarTitleFa: 'رکن ۴: یادگیری از تجربیات و بهبود مستمر',
    titleFa: 'تحقیق و ریشه‌یابی حوادث فرایندی',
    titleEn: 'Incident Investigation',
    defaultCriteriaFa: 'آغاز تحقیق حوادث و شبه‌حوادث فرایندی (PSE Tier 1, 2, 3) حداکثر ظرف ۴۸ ساعت با متدولوژی‌های ریشه‌یابی (RCA / Tripod Beta / Fault Tree)، تدوین توصیه‌های اصلاحی و انتشار درس‌آموخته‌ها.',
    requiredDocTemplates: ['روش اجرایی گزارش‌دهی و ریشه‌یابی حوادث ایمنی فرایند (PSE)', 'گزارش کمیته تحقیق حادثه و تحلیل علل ریشه‌ای (RCA)', 'بولتن درس‌آموخته‌های حوادث فرایندی'],
    nationalAndRejalRef: 'آیین‌نامه بررسی حوادث ناشی از کار ایران، API RP 754 و دستورالعمل RJL-PSM-17',
    defaultRiskWeight: 5,
  },
  {
    code: 'CCPS-18',
    number: 18,
    pillarId: 'LEARN',
    pillarTitleFa: 'رکن ۴: یادگیری از تجربیات و بهبود مستمر',
    titleFa: 'سنجش و شاخص‌های عملکرد ایمنی فرایند (Metrics)',
    titleEn: 'Measurement and Metrics',
    defaultCriteriaFa: 'تعریف، پایش و گزارش‌دهی ماهانه شاخص‌های پیشرو (Leading) و پسرو (Lagging) ایمنی فرایند بر اساس استاندارد API RP 754 (هرم ۴ سطحی رویدادهای ایمنی فرایند Tier 1 تا Tier 4).',
    requiredDocTemplates: ['دستورالعمل شاخص‌های کلیدی عملکرد ایمنی فرایند (API RP 754)', 'داشبورد و گزارش ماهانه شاخص‌های پیشرو و پسرو PSM'],
    nationalAndRejalRef: 'استاندارد پایش عملکرد ایمنی فرایند NPC / پتروشیمی رجال RJL-PSM-18',
    defaultRiskWeight: 4,
  },
  {
    code: 'CCPS-19',
    number: 19,
    pillarId: 'LEARN',
    pillarTitleFa: 'رکن ۴: یادگیری از تجربیات و بهبود مستمر',
    titleFa: 'ممیزی ایمنی فرایند (Auditing)',
    titleEn: 'Auditing',
    defaultCriteriaFa: 'برنامه‌ریزی و اجرای ممیزی‌های جامع و مستقل انطباق و استقرار PSM حداقل هر ۳ سال یک‌بار توسط تیم ذی‌صلاح، ثبت یافته‌ها و پیگیری کامل اقدامات اصلاحی تا حصول اثربخشی.',
    requiredDocTemplates: ['روش اجرایی و پروتکل ممیزی سیستم مدیریت ایمنی فرایند', 'گزارش رسمی ممیزی دوره‌ای PSM و جدول پیگیری یافته‌ها'],
    nationalAndRejalRef: 'الزامات ممیزی HSE شرکت ملی صنایع پتروشیمی و دستورالعمل RJL-PSM-19',
    defaultRiskWeight: 4,
  },
  {
    code: 'CCPS-20',
    number: 20,
    pillarId: 'LEARN',
    pillarTitleFa: 'رکن ۴: یادگیری از تجربیات و بهبود مستمر',
    titleFa: 'بازنگری مدیریتی و بهبود مستمر',
    titleEn: 'Management Review and Continuous Improvement',
    defaultCriteriaFa: 'برگزاری جلسات رسمی بازنگری مدیریت ارشد مجتمع برای بررسی وضعیت شاخص‌های PSM، پیشرفت CAPAها، شکاف‌های باقیمانده، تخصیص بودجه و منابع و تصویب برنامه‌های بهبود مستمر.',
    requiredDocTemplates: ['روش اجرایی بازنگری مدیریت سیستم ایمنی فرایند', 'صورتجلسات و مصوبات کمیته راهبری PSM مجتمع پتروشیمی رجال'],
    nationalAndRejalRef: 'نظام‌نامه حاکمیت شرکتی و مدیریت HSE پتروشیمی رجال RJL-PSM-20',
    defaultRiskWeight: 4,
  },
];

export const OSHA_14_CLAUSES: OshaClauseMeta[] = [
  {
    code: 'OSHA-01',
    cfrParagraph: '29 CFR 1910.119(c)',
    titleFa: 'مشارکت کارکنان (Employee Participation)',
    titleEn: 'Employee Participation',
    defaultCriteriaFa: 'طرح مکتوب مشارکت کارکنان در تحلیل خطرات فرایند (PHA) و سایر عناصر PSM و دسترسی آزاد کارکنان به کلیه اطلاعات و مطالعات PSM.',
    requiredDeliverables: ['برنامه مکتوب مشارکت کارکنان در PSM', 'مستندات حضور پرسنل عملیاتی در تیم‌های PHA/SOP'],
  },
  {
    code: 'OSHA-02',
    cfrParagraph: '29 CFR 1910.119(d)',
    titleFa: 'اطلاعات ایمنی فرایند (Process Safety Information - PSI)',
    titleEn: 'Process Safety Information (PSI)',
    defaultCriteriaFa: 'تکمیل اطلاعات مکتوب مواد شیمیایی خطرناک، فناوری فرایند و تجهیزات فرایندی پیش از انجام مطالعات PHA.',
    requiredDeliverables: ['بانک اطلاعات خطرات مواد شیمیایی', 'مستندات طراحی و حدود ایمن عملیاتی', 'نقشه‌های P&ID به‌روز و مدارک RAGAGEP تجهیزات'],
  },
  {
    code: 'OSHA-03',
    cfrParagraph: '29 CFR 1910.119(e)',
    titleFa: 'تحلیل مخاطرات فرایند (Process Hazard Analysis - PHA)',
    titleEn: 'Process Hazard Analysis (PHA)',
    defaultCriteriaFa: 'اجرای PHA با روش‌های استاندارد (HAZOP, What-If, FMEA, Fault Tree) توسط تیم چندتخصصی، رسیدگی به موقع به یافته‌ها و بازنگری حداقل هر ۵ سال یک‌بار.',
    requiredDeliverables: ['گزارش‌های مصوب مطالعات PHA/HAZOP', 'سیستم پیگیری و بستن توصیه‌های PHA با جدول زمان‌بندی'],
  },
  {
    code: 'OSHA-04',
    cfrParagraph: '29 CFR 1910.119(f)',
    titleFa: 'دستورالعمل‌های عملیاتی (Operating Procedures)',
    titleEn: 'Operating Procedures',
    defaultCriteriaFa: 'تدوین دستورالعمل‌های شفاف برای کلیه فازهای عملیاتی، حدود عملیاتی، ملاحظات ایمنی و بهداشتی، و تصدیق سالانه صحت و به‌روز بودن آن‌ها.',
    requiredDeliverables: ['مجموعه SOP/EOP واحدهای فرایندی', 'گواهی تصدیق سالانه دستورالعمل‌های عملیاتی'],
  },
  {
    code: 'OSHA-05',
    cfrParagraph: '29 CFR 1910.119(g)',
    titleFa: 'آموزش (Training)',
    titleEn: 'Training',
    defaultCriteriaFa: 'آموزش اولیه و بازآموزی حداقل سه ساله برای کلیه کارکنان درگیر در عملیات فرایند به همراه مستندسازی ارزیابی درک و مهارت.',
    requiredDeliverables: ['سجلات آموزش اولیه و بازآموزی ۳ ساله اپراتورها', 'مستندات سنجش اثربخشی و صلاحیت عملیاتی'],
  },
  {
    code: 'OSHA-06',
    cfrParagraph: '29 CFR 1910.119(h)',
    titleFa: 'پیمانکاران (Contractors)',
    titleEn: 'Contractors',
    defaultCriteriaFa: 'ارزیابی سوابق ایمنی پیمانکاران، اطلاع‌رسانی خطرات آتش‌سوزی/انفجار/سمی، آموزش طرح اضطراری و ممیزی مستمر عملکرد پیمانکاران.',
    requiredDeliverables: ['پرونده ارزیابی صلاحیت HSE پیمانکاران', 'فرم‌های ابلاغ مخاطرات فرایندی و ثبت حوادث پیمانکاران'],
  },
  {
    code: 'OSHA-07',
    cfrParagraph: '29 CFR 1910.119(i)',
    titleFa: 'بازنگری ایمنی پیش از راه‌اندازی (Pre-Startup Safety Review - PSSR)',
    titleEn: 'Pre-Startup Safety Review (PSSR)',
    defaultCriteriaFa: 'انجام PSSR برای تأسیسات جدید و تغییرات نیازمند اصلاح PSI پیش از ورود مواد شیمیایی خطرناک به فرایند.',
    requiredDeliverables: ['فرم‌ها و چک‌لیست‌های تکمیل‌شده PSSR', 'مجوز نهایی راه‌اندازی با امضای مسئولان ذی‌صلاح'],
  },
  {
    code: 'OSHA-08',
    cfrParagraph: '29 CFR 1910.119(j)',
    titleFa: 'یکپارچگی مکانیکی (Mechanical Integrity - MI)',
    titleEn: 'Mechanical Integrity (MI)',
    defaultCriteriaFa: 'استقرار روش‌های مکتوب، آموزش پرسنل تعمیرات، بازرسی و تست مطابق RAGAGEP، اصلاح نواقص تجهیزات پیش از بهره‌برداری ناایمن و تضمین کیفیت قطعات یدکی.',
    requiredDeliverables: ['برنامه و سوابق بازرسی و تست تجهیزات مشمول MI', 'گزارش‌های رفع نواقص بحرانی تجهیزات و کنترل کیفیت (QA)'],
  },
  {
    code: 'OSHA-09',
    cfrParagraph: '29 CFR 1910.119(k)',
    titleFa: 'پروانه کار گرم (Hot Work Permit)',
    titleEn: 'Hot Work Permit',
    defaultCriteriaFa: 'صدور پروانه کار گرم برای عملیات روی یا مجاور فرایندهای مشمول با تایید اجرای الزامات پیشگیری و حفاظت حریق (29 CFR 1910.252).',
    requiredDeliverables: ['روش اجرایی و فرم‌های صدور پروانه کار گرم', 'سوابق گازسنجی و پایش حریق حین کار گرم'],
  },
  {
    code: 'OSHA-10',
    cfrParagraph: '29 CFR 1910.119(l)',
    titleFa: 'مدیریت تغییر (Management of Change - MOC)',
    titleEn: 'Management of Change (MOC)',
    defaultCriteriaFa: 'روش‌های مکتوب برای مدیریت تغییرات (غیر از جایگزینی عین‌به‌عین) شامل مبنای فنی، اثر بر ایمنی، اصلاح دستورالعمل‌ها، آموزش و به‌روزرسانی PSI.',
    requiredDeliverables: ['روش اجرایی MOC', 'پرونده‌های تغییرات مصوب و شواهد به‌روزرسانی مدارک PSI و SOP'],
  },
  {
    code: 'OSHA-11',
    cfrParagraph: '29 CFR 1910.119(m)',
    titleFa: 'تحقیق حوادث (Incident Investigation)',
    titleEn: 'Incident Investigation',
    defaultCriteriaFa: 'بررسی کلیه حوادث منجر به یا دارای پتانسیل پیامد فاجعه‌بار حداکثر ظرف ۴۸ ساعت، تهیه گزارش رسمی، پیگیری توصیه‌ها و نگهداری گزارش‌ها به مدت حداقل ۵ سال.',
    requiredDeliverables: ['گزارش‌های تحقیق حوادث و شبه‌حوادث فرایندی', 'سیستم ردیابی مصوبات و اقدامات اصلاحی حوادث'],
  },
  {
    code: 'OSHA-12',
    cfrParagraph: '29 CFR 1910.119(n)',
    titleFa: 'برنامه‌ریزی و واکنش در شرایط اضطراری (Emergency Planning and Response)',
    titleEn: 'Emergency Planning and Response',
    defaultCriteriaFa: 'تدوین و پیاده‌سازی طرح عمل اضطراری برای کل مجتمع شامل مدیریت رهایش‌های کوچک و بزرگ مواد شیمیایی خطرناک.',
    requiredDeliverables: ['طرح واکنش در شرایط اضطراری (ERP)', 'سوابق آموزش و مانورهای واکنش اضطراری'],
  },
  {
    code: 'OSHA-13',
    cfrParagraph: '29 CFR 1910.119(o)',
    titleFa: 'ممیزی انطباق (Compliance Audits)',
    titleEn: 'Compliance Audits',
    defaultCriteriaFa: 'تصدیق ممیزی انطباق حداقل هر ۳ سال یک‌بار، تهیه گزارش یافته‌ها، تعیین و مستندسازی پاسخ مناسب به هر یافته و نگهداری دو گزارش آخر ممیزی.',
    requiredDeliverables: ['گزارش‌های ممیزی انطباق ۳ ساله PSM', 'مستندات رفع عدم‌انطباق‌های ممیزی'],
  },
  {
    code: 'OSHA-14',
    cfrParagraph: '29 CFR 1910.119(p)',
    titleFa: 'اسرار تجاری (Trade Secrets)',
    titleEn: 'Trade Secrets',
    defaultCriteriaFa: 'فراهم ساختن کلیه اطلاعات ضروری ایمنی فرایند برای افراد مسئول تدوین PSI, PHA, SOP, MOC، تحقیق حوادث و طرح اضطراری بدون محدودیت اسرار تجاری (با حفظ توافقنامه محرمانگی).',
    requiredDeliverables: ['پروتکل دسترسی فنی به دانش فنی لیسانسورها و اطلاعات محرمانه فرایندی'],
  },
];

/**
 * Authoritative Many-to-Many (N:M) Traceability Matrix between CCPS RBPS (20 Elements) and OSHA 29 CFR 1910.119 (14 Clauses)
 * Distinguishes DIRECT regulatory equivalence from INDIRECT supporting relationships.
 */
export const CCPS_OSHA_TRACEABILITY_MATRIX: CcpsOshaMappingEntry[] = [
  // CCPS-01: Process Safety Culture
  { ccpsCode: 'CCPS-01', oshaCode: 'OSHA-01', relationType: 'INDIRECT', rationaleFa: 'فرهنگ ایمنی فرایند زیربنای مشارکت مؤثر و گزارش‌دهی شفاف کارکنان است.' },
  { ccpsCode: 'CCPS-01', oshaCode: 'OSHA-13', relationType: 'INDIRECT', rationaleFa: 'تعهد فرهنگی مدیریت در کیفیت اجرای ممیزی‌های انطباق و بستن یافته‌ها بازتاب می‌یابد.' },

  // CCPS-02: Compliance with Standards
  { ccpsCode: 'CCPS-02', oshaCode: 'OSHA-02', relationType: 'DIRECT', rationaleFa: 'الزام مستقیم بند 1910.119(d)(3)(ii) مبنی بر انطباق تجهیزات با RAGAGEP و استانداردهای مهندسی.' },
  { ccpsCode: 'CCPS-02', oshaCode: 'OSHA-08', relationType: 'DIRECT', rationaleFa: 'الزام مستقیم بازرسی و تست تجهیزات مطابق استانداردهای مهندسی شناخته‌شده (RAGAGEP).' },
  { ccpsCode: 'CCPS-02', oshaCode: 'OSHA-13', relationType: 'INDIRECT', rationaleFa: 'ممیزی انطباق نیازمند مرجع استانداردها و مقررات قابل اعمال است.' },

  // CCPS-03: Process Safety Competency
  { ccpsCode: 'CCPS-03', oshaCode: 'OSHA-05', relationType: 'INDIRECT', rationaleFa: 'شایستگی مهندسی و سازمانی مکمل آموزش‌های رسمی اپراتورها است.' },
  { ccpsCode: 'CCPS-03', oshaCode: 'OSHA-03', relationType: 'INDIRECT', rationaleFa: 'اجرای PHA نیازمند حضور اعضای دارای دانش و تجربه تخصصی در متدولوژی و مهندسی فرایند است.' },
  { ccpsCode: 'CCPS-03', oshaCode: 'OSHA-14', relationType: 'DIRECT', rationaleFa: 'دسترسی کارشناسان ذی‌صلاح به دانش فنی و اسرار تجاری لیسانسور برای تحلیل ایمنی فرایند.' },

  // CCPS-04: Workforce Involvement
  { ccpsCode: 'CCPS-04', oshaCode: 'OSHA-01', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم یک‌به‌یک با الزام 1910.119(c) مشارکت کارکنان در تمام ارکان PSM.' },
  { ccpsCode: 'CCPS-04', oshaCode: 'OSHA-03', relationType: 'INDIRECT', rationaleFa: 'حضور اپراتور و نفرات باتجربه واحد در جلسات PHA/HAZOP الزامی است.' },
  { ccpsCode: 'CCPS-04', oshaCode: 'OSHA-04', relationType: 'INDIRECT', rationaleFa: 'مشارکت بهره‌برداران در تدوین و تصدیق سالانه دستورالعمل‌های عملیاتی.' },

  // CCPS-05: Stakeholder Outreach
  { ccpsCode: 'CCPS-05', oshaCode: 'OSHA-12', relationType: 'INDIRECT', rationaleFa: 'هماهنگی با صنایع همجوار و سازمان‌های امدادی بیرونی در طرح واکنش اضطراری.' },

  // CCPS-06: Process Knowledge Management (PSI)
  { ccpsCode: 'CCPS-06', oshaCode: 'OSHA-02', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(d) اطلاعات ایمنی فرایند (مواد، فناوری و تجهیزات).' },
  { ccpsCode: 'CCPS-06', oshaCode: 'OSHA-14', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم در مدیریت اسرار تجاری و دانش فنی کاتالیست‌ها و لایسنس‌های فرایندی.' },
  { ccpsCode: 'CCPS-06', oshaCode: 'OSHA-03', relationType: 'INDIRECT', rationaleFa: 'مدارک PSI پیش‌نیاز الزامی برای آغاز مطالعات PHA/HAZOP هستند.' },
  { ccpsCode: 'CCPS-06', oshaCode: 'OSHA-10', relationType: 'INDIRECT', rationaleFa: 'هرگونه تغییر در MOC نیازمند به‌روزرسانی پرونده PSI است.' },

  // CCPS-07: Hazard Identification and Risk Analysis (PHA)
  { ccpsCode: 'CCPS-07', oshaCode: 'OSHA-03', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(e) تحلیل خطرات فرایند (PHA/HAZOP/LOPA).' },
  { ccpsCode: 'CCPS-07', oshaCode: 'OSHA-10', relationType: 'INDIRECT', rationaleFa: 'ارزیابی ریسک تغییرات پیش از تصویب MOC.' },
  { ccpsCode: 'CCPS-07', oshaCode: 'OSHA-07', relationType: 'INDIRECT', rationaleFa: 'اجرای توصیه‌های PHA پیش از صدور مجوز راه‌اندازی PSSR.' },

  // CCPS-08: Operating Procedures
  { ccpsCode: 'CCPS-08', oshaCode: 'OSHA-04', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(f) دستورالعمل‌های عملیاتی و تصدیق سالانه.' },
  { ccpsCode: 'CCPS-08', oshaCode: 'OSHA-05', relationType: 'INDIRECT', rationaleFa: 'دستورالعمل‌های عملیاتی مبنای اصلی آموزش اپراتورها هستند.' },
  { ccpsCode: 'CCPS-08', oshaCode: 'OSHA-10', relationType: 'INDIRECT', rationaleFa: 'اصلاح دستورالعمل‌های عملیاتی متأثر از تغییرات MOC پیش از بهره‌برداری.' },

  // CCPS-09: Safe Work Practices
  { ccpsCode: 'CCPS-09', oshaCode: 'OSHA-09', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(k) صدور پروانه کار گرم.' },
  { ccpsCode: 'CCPS-09', oshaCode: 'OSHA-04', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(f)(4) رویه‌های کار ایمن (LOTO، ورود به فضای بسته، باز کردن خطوط).' },
  { ccpsCode: 'CCPS-09', oshaCode: 'OSHA-06', relationType: 'INDIRECT', rationaleFa: 'رعایت رویه‌های کار ایمن و پروانه کار توسط پیمانکاران اجرایی و تعمیراتی.' },

  // CCPS-10: Asset Integrity and Reliability (MI)
  { ccpsCode: 'CCPS-10', oshaCode: 'OSHA-08', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(j) یکپارچگی مکانیکی تجهیزات فرایندی.' },
  { ccpsCode: 'CCPS-10', oshaCode: 'OSHA-02', relationType: 'INDIRECT', rationaleFa: 'استفاده از مشخصات طراحی تجهیزات و RAGAGEP مندرج در PSI برای بازرسی فنی.' },
  { ccpsCode: 'CCPS-10', oshaCode: 'OSHA-07', relationType: 'INDIRECT', rationaleFa: 'تأیید انطباق ساخت و تست تجهیزات در PSSR.' },

  // CCPS-11: Contractor Management
  { ccpsCode: 'CCPS-11', oshaCode: 'OSHA-06', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(h) مدیریت ایمنی پیمانکاران.' },
  { ccpsCode: 'CCPS-11', oshaCode: 'OSHA-09', relationType: 'INDIRECT', rationaleFa: 'نظارت بر اجرای کار گرم و پروانه‌های کار توسط پیمانکاران.' },

  // CCPS-12: Training and Performance Assurance
  { ccpsCode: 'CCPS-12', oshaCode: 'OSHA-05', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(g) آموزش اولیه و بازآموزی کارکنان بهره‌برداری.' },
  { ccpsCode: 'CCPS-12', oshaCode: 'OSHA-08', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(j)(3) آموزش تخصصی پرسنل تعمیرات و نگهداری.' },
  { ccpsCode: 'CCPS-12', oshaCode: 'OSHA-06', relationType: 'INDIRECT', rationaleFa: 'تضمین آموزش نفرات پیمانکار پیش از ورود به واحدهای فرایندی.' },

  // CCPS-13: Management of Change (MOC)
  { ccpsCode: 'CCPS-13', oshaCode: 'OSHA-10', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(l) مدیریت تغییر.' },
  { ccpsCode: 'CCPS-13', oshaCode: 'OSHA-02', relationType: 'INDIRECT', rationaleFa: 'الزام به‌روزرسانی مدارک PSI در پی تغییرات مصوب MOC.' },
  { ccpsCode: 'CCPS-13', oshaCode: 'OSHA-04', relationType: 'INDIRECT', rationaleFa: 'الزام به‌روزرسانی SOPها در پی تغییرات مصوب MOC.' },
  { ccpsCode: 'CCPS-13', oshaCode: 'OSHA-07', relationType: 'INDIRECT', rationaleFa: 'الزام اجرای PSSR برای تغییراتی که موجب تغییر در PSI می‌شوند.' },

  // CCPS-14: Operational Readiness (PSSR)
  { ccpsCode: 'CCPS-14', oshaCode: 'OSHA-07', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(i) بازنگری ایمنی پیش از راه‌اندازی (PSSR).' },
  { ccpsCode: 'CCPS-14', oshaCode: 'OSHA-10', relationType: 'INDIRECT', rationaleFa: 'تکمیل PSSR به عنوان گلوگاه نهایی پیش از بهره‌برداری از تغییرات MOC.' },

  // CCPS-15: Conduct of Operations
  { ccpsCode: 'CCPS-15', oshaCode: 'OSHA-04', relationType: 'INDIRECT', rationaleFa: 'انضباط عملیاتی تضمین‌کننده اجرای مستمر دستورالعمل‌های عملیاتی و رعایت حدود ایمن است.' },
  { ccpsCode: 'CCPS-15', oshaCode: 'OSHA-08', relationType: 'INDIRECT', rationaleFa: 'پایش بای‌پس‌ها و تحویل ایمن تجهیزات بین بهره‌برداری و تعمیرات.' },

  // CCPS-16: Emergency Management
  { ccpsCode: 'CCPS-16', oshaCode: 'OSHA-12', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(n) برنامه‌ریزی و واکنش در شرایط اضطراری.' },
  { ccpsCode: 'CCPS-16', oshaCode: 'OSHA-04', relationType: 'INDIRECT', rationaleFa: 'هماهنگی با دستورالعمل‌های توقف اضطراری (Emergency Shutdown) در SOP.' },

  // CCPS-17: Incident Investigation
  { ccpsCode: 'CCPS-17', oshaCode: 'OSHA-11', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(m) تحقیق حوادث و شبه‌حوادث فرایندی.' },
  { ccpsCode: 'CCPS-17', oshaCode: 'OSHA-03', relationType: 'INDIRECT', rationaleFa: 'بررسی سوابق حوادث قبلی واحد در جریان مطالعات و بازنگری‌های PHA.' },

  // CCPS-18: Measurement and Metrics
  { ccpsCode: 'CCPS-18', oshaCode: 'OSHA-11', relationType: 'INDIRECT', rationaleFa: 'ثبت و طبقه‌بندی شاخص‌های حوادث ایمنی فرایند (PSE Tier 1 & Tier 2).' },
  { ccpsCode: 'CCPS-18', oshaCode: 'OSHA-13', relationType: 'INDIRECT', rationaleFa: 'استفاده از شاخص‌های پیشرو و پسرو برای سنجش کارایی عناصر PSM در ممیزی‌ها.' },

  // CCPS-19: Auditing
  { ccpsCode: 'CCPS-19', oshaCode: 'OSHA-13', relationType: 'DIRECT', rationaleFa: 'تطابق مستقیم با الزام 1910.119(o) ممیزی انطباق سه ساله PSM.' },

  // CCPS-20: Management Review and Continuous Improvement
  { ccpsCode: 'CCPS-20', oshaCode: 'OSHA-13', relationType: 'INDIRECT', rationaleFa: 'بررسی مدیریتی یافته‌های ممیزی، تأمین منابع و پایش مستمر بستن عدم‌انطباق‌ها.' },
];

export const PSM_SPECIALIZED_SUBSYSTEMS: PsmSubsystemMeta[] = [
  {
    key: 'PSI',
    titleFa: 'اطلاعات ایمنی فرایند (PSI)',
    titleEn: 'Process Safety Information',
    ccpsElements: ['CCPS-06', 'CCPS-02'],
    oshaClauses: ['OSHA-02', 'OSHA-14'],
    descriptionFa: 'مدیریت پرونده خطرات مواد شیمیایی، فناوری فرایند، P&ID، محاسبات شیرهای اطمینان، طبقه‌بندی نواحی خطرزا و استانداردهای RAGAGEP',
    defaultTrackingPath: 'تهیه پیش‌نویس مهندسی ← صحه‌گذاری با وضعیت موجود واحد (As-Built) ← تصویب فنی ← ثبت در بانک PSI',
  },
  {
    key: 'PHA',
    titleFa: 'تحلیل مخاطرات فرایند (PHA)',
    titleEn: 'Process Hazard Analysis',
    ccpsElements: ['CCPS-07'],
    oshaClauses: ['OSHA-03'],
    descriptionFa: 'برنامه‌ریزی، تشکیل تیم چندتخصصی، بازنگری ۵ ساله و راهبری کلان مطالعات شناسایی و ارزیابی ریسک فرایندی',
    defaultTrackingPath: 'تعریف منشور مطالعه ← جلسات تیم چندتخصصی ← استخراج توصیه‌ها ← تخصیص مسئول در CAPA ← تصدیق اجرا',
  },
  {
    key: 'HAZOP',
    titleFa: 'مطالعه عملیات و خطر (HAZOP)',
    titleEn: 'Hazard and Operability Study',
    ccpsElements: ['CCPS-07', 'CCPS-04'],
    oshaClauses: ['OSHA-03', 'OSHA-01'],
    descriptionFa: 'بررسی گره‌به‌گره (Node-by-Node) انحرافات پارامترهای فرایندی (دما، فشار، دبی، سطح)، علل، پیامدها، حفاظ‌های موجود و توصیه‌های اصلاحی',
    defaultTrackingPath: 'تفکیک گره‌های P&ID ← تحلیل انحرافات ← رتبه‌بندی ریسک ← صدور برگ اقدام HAZOP ← تایید بستن توصیه',
  },
  {
    key: 'HAZID',
    titleFa: 'شناسایی مخاطرات (HAZID)',
    titleEn: 'Hazard Identification Study',
    ccpsElements: ['CCPS-07'],
    oshaClauses: ['OSHA-03'],
    descriptionFa: 'شناسایی سیستماتیک خطرات محیطی، چیدمان سایت (Layout)، تداخل واحدها و سناریوهای کلان آتش‌سوزی، انفجار و رهایش مواد سمی',
    defaultTrackingPath: 'بررسی نواحی عملیاتی ← ثبت برگه کار HAZID ← تعیین کنترل‌های مهندسی/عملیاتی ← پیگیری در CAPA',
  },
  {
    key: 'LOPA',
    titleFa: 'تحلیل لایه‌های حفاظتی (LOPA)',
    titleEn: 'Layer of Protection Analysis',
    ccpsElements: ['CCPS-07', 'CCPS-10'],
    oshaClauses: ['OSHA-03', 'OSHA-08'],
    descriptionFa: 'ارزیابی نیمه‌کمی سناریوهای پرریسک HAZOP، تعیین لایه‌های حفاظتی مستقل (IPL)، محاسبه PFD و تعیین سطح تمامیت ایمنی (SIL)',
    defaultTrackingPath: 'انتخاب سناریوهای بحرانی HAZOP ← اعتبارسنجی IPLها ← محاسبه شکاف ریسک و SIL ← تعریف نیازمندی SIF/SIS',
  },
  {
    key: 'BOW_TIE',
    titleFa: 'مدل‌سازی موانع ایمنی (Bow-Tie)',
    titleEn: 'Bow-Tie Barrier Management',
    ccpsElements: ['CCPS-07', 'CCPS-10', 'CCPS-16'],
    oshaClauses: ['OSHA-03', 'OSHA-08', 'OSHA-12'],
    descriptionFa: 'مدل‌سازی تصویری و کنترلی رویدادهای بحرانی (Top Events)، موانع پیشگیرانه (Prevention Barriers)، موانع کاهنده پیامد (Mitigation) و عوامل تضعیف‌کننده',
    defaultTrackingPath: 'تعریف رویداد بحرانی (MAH) ← تعیین موانع پیشگیری و کاهش پیامد ← اتصال هر مانع به تجهیز SCE و مسئول پایش',
  },
  {
    key: 'OPERATING_PROCEDURES',
    titleFa: 'دستورالعمل‌های عملیاتی (SOP / EOP)',
    titleEn: 'Operating Procedures',
    ccpsElements: ['CCPS-08', 'CCPS-15'],
    oshaClauses: ['OSHA-04'],
    descriptionFa: 'مدیریت دستورالعمل‌های راه‌اندازی، بهره‌برداری نرمال، عملیات موقت، توقف اضطراری، حدود ایمن عملیاتی (SOL) و تصدیق سالانه',
    defaultTrackingPath: 'تدوین/بازنگری با مشارکت اپراتور ← بررسی تطابق با حدود SOL ← تصدیق سالانه مدیر واحد ← آموزش به شیفت‌ها',
  },
  {
    key: 'MI',
    titleFa: 'یکپارچگی مکانیکی (MI)',
    titleEn: 'Mechanical Integrity',
    ccpsElements: ['CCPS-10', 'CCPS-02'],
    oshaClauses: ['OSHA-08'],
    descriptionFa: 'مدیریت تجهیزات بحران ایمنی (SCE)، برنامه بازرسی RBI، تست PSV/SIS، کنترل کیفیت قطعات و مدیریت نواقص فنی تجهیزات',
    defaultTrackingPath: 'ثبت تجهیز بحرانی ← اجرای بازرسی/Proof Test ← ثبت نقص فنی در صورت انحراف ← ارزیابی ریسک کارکرد موقت یا تعمیر فوری',
  },
  {
    key: 'MOC',
    titleFa: 'مدیریت تغییر (MOC)',
    titleEn: 'Management of Change',
    ccpsElements: ['CCPS-13'],
    oshaClauses: ['OSHA-10'],
    descriptionFa: 'کنترل تغییرات موقت، دائم و اضطراری در تجهیزات، مواد، پارامترهای فرایندی، منطق کنترلی و سازمان به همراه ارزیابی ریسک چندرشته‌ای',
    defaultTrackingPath: 'ثبت درخواست تغییر ← غربالگری ← ارزیابی ریسک فنی و HSE ← تایید اجرا ← اجرای PSSR ← به‌روزرسانی PSI/SOP و بستن MOC',
  },
  {
    key: 'PSSR',
    titleFa: 'بازنگری ایمنی پیش از راه‌اندازی (PSSR)',
    titleEn: 'Pre-Startup Safety Review',
    ccpsElements: ['CCPS-14'],
    oshaClauses: ['OSHA-07'],
    descriptionFa: 'چک‌لیست و ممیزی چندتخصصی پیش از تزریق مواد هیدروکربنی و شیمیایی جهت حصول اطمینان از آمادگی ایمن تجهیزات، مستندات و نفرات',
    defaultTrackingPath: 'تشکیل تیم PSSR ← ممیزی میدانی ← تفکیک نواقص قبل از راه‌اندازی (Pre-Startup) و بعد از راه‌اندازی ← امضای مجوز راه‌اندازی',
  },
  {
    key: 'CONTRACTORS',
    titleFa: 'مدیریت ایمنی پیمانکاران (Contractors)',
    titleEn: 'Contractor Safety Management',
    ccpsElements: ['CCPS-11', 'CCPS-09'],
    oshaClauses: ['OSHA-06', 'OSHA-09'],
    descriptionFa: 'ارزیابی صلاحیت ایمنی پیش از مناقصه، توجیه خطرات فرایندی واحدها، نظارت بر پروانه‌های کار و ارزیابی عملکرد HSE پیمانکاران',
    defaultTrackingPath: 'ممیزی صلاحیت اولیه ← آموزش اختصاصی خطرات فرایند ← پایش روزانه حین کار/اورهال ← ارزیابی دوره و ثبت سوابق',
  },
  {
    key: 'TRAINING',
    titleFa: 'آموزش و صلاحیت ایمنی فرایند (Training)',
    titleEn: 'PSM Training & Competency',
    ccpsElements: ['CCPS-12', 'CCPS-03'],
    oshaClauses: ['OSHA-05'],
    descriptionFa: 'برنامه‌ریزی و پایش آموزش‌های اولیه، تخصصی SOP/PHA/MI و بازآموزی اجباری ۳ ساله پرسنل عملیاتی و فنی به همراه سنجش مهارت',
    defaultTrackingPath: 'نیازسنجی سمت فرایندی ← اجرای دوره تئوری و عملی ← آزمون صلاحیت ← صدور گواهی و ثبت تاریخ بازآموزی ۳ ساله',
  },
  {
    key: 'INCIDENT_INVESTIGATION',
    titleFa: 'تحقیق و ریشه‌یابی حوادث فرایندی (PSE)',
    titleEn: 'Process Safety Incident Investigation',
    ccpsElements: ['CCPS-17', 'CCPS-18'],
    oshaClauses: ['OSHA-11'],
    descriptionFa: 'ثبت و طبقه‌بندی حوادث و شبه‌حوادث فرایندی (API RP 754 Tier 1-4)، تشکیل تیم تحقیق ظرف ۴۸ ساعت، تحلیل علل ریشه‌ای (RCA) و پیگیری توصیه‌ها',
    defaultTrackingPath: 'گزارش اولیه رویداد ← تشکیل تیم تحقیق (<۴۸ ساعت) ← تحلیل علل ریشه‌ای RCA ← تعریف اقدامات اصلاحی در CAPA ← انتشار درس‌آموخته',
  },
  {
    key: 'EMERGENCY_PLANNING',
    titleFa: 'برنامه‌ریزی و واکنش در شرایط اضطراری (ERP)',
    titleEn: 'Emergency Planning & Response',
    ccpsElements: ['CCPS-16', 'CCPS-05'],
    oshaClauses: ['OSHA-12'],
    descriptionFa: 'تدوین سناریوهای واکنش اضطراری فرایندی (رهایش مواد، حریق، انفجار)، طرح‌های PIP، آمادگی تجهیزات اضطراری و اجرای مانورهای دوره‌ای',
    defaultTrackingPath: 'تدوین سناریوی اضطراری واحد ← تامین تجهیزات و آموزش تیم واکنش ← اجرای مانور عملیاتی ← نقد و بررسی و اصلاح ERP',
  },
];

export const PSM_MATURITY_LEVELS: MaturityLevelMeta[] = [
  {
    level: 1,
    key: 'INITIAL',
    titleFa: 'سطح ۱: اولیه (واکنشی / غیرساختاریافته)',
    titleEn: 'Level 1: Initial (Ad-hoc / Reactive)',
    summaryFa: 'رویکرد واکنشی به ایمنی فرایند؛ وابسته به تلاش‌های فردی؛ مستندات ناقص یا پراکنده؛ عدم پیگیری سیستماتیک مخاطرات فرایندی.',
    verificationCriteriaFa: [
      'اقدامات ایمنی فرایند عمدتاً پس از بروز حادثه یا الزام فوری بازرسان انجام می‌شود.',
      'فرآیندهای استاندارد مدونی برای تمام ۲۰ عنصر CCPS وجود ندارد یا اجرا نمی‌شود.',
      'شواهد اجرایی و سوابق پیگیری توصیه‌های ریسک ناقص است.',
    ],
  },
  {
    level: 2,
    key: 'DEVELOPING',
    titleFa: 'سطح ۲: در حال شکل‌گیری (آغاز استقرار)',
    titleEn: 'Level 2: Developing (Repeatable / Emerging)',
    summaryFa: 'آغاز تدوین مستندات و دستورالعمل‌های پایه؛ اجرای اولیه برخی عناصر کلیدی (مانند PTW و MOC پایه)؛ ناهماهنگی در اجرای یکنواخت بین واحدها.',
    verificationCriteriaFa: [
      'روش‌های اجرایی اصلی تدوین شده‌اند اما هنوز در تمام واحدهای فرایندی به‌صورت یکدست اجرا نمی‌شوند.',
      'ارزیابی اولیه و تحلیل شکاف انجام شده و برنامه رفع نواقص در جریان است.',
      'انضباط عملیاتی نیازمند نظارت مستمر واحد HSE است.',
    ],
  },
  {
    level: 3,
    key: 'DEFINED',
    titleFa: 'سطح ۳: تعریف‌شده (مستند و استانداردشده)',
    titleEn: 'Level 3: Defined (Standardized & Implemented)',
    summaryFa: 'کلیه ۲۰ عنصر CCPS و ۱۴ الزام OSHA به‌صورت کامل مستندسازی، ابلاغ و در سطح واحدهای مشمول مجتمع پتروشیمی رجال مستقر شده‌اند.',
    verificationCriteriaFa: [
      'مستندات، فرم‌ها و گردش‌کارهای تمامی عناصر مشمول تصویب و در عملیات جاری شده‌اند.',
      'مسئولیت‌ها، صلاحیت‌ها و آموزش‌های ایمنی فرایند در ساختار سازمانی تثبیت شده است.',
      'مطالعات PHA/HAZOP، برنامه MI، کنترل MOC و PSSR طبق رویه استاندارد اجرا می‌شوند.',
    ],
  },
  {
    level: 4,
    key: 'MANAGED',
    titleFa: 'سطح ۴: مدیریت‌شده (پایش کمّی و کنترلی)',
    titleEn: 'Level 4: Managed (Measured & Quantitatively Controlled)',
    summaryFa: 'پایش مستمر با شاخص‌های پیشرو و پسرو (API RP 754)؛ ممیزی‌های منظم؛ تأیید مستقل اثربخشی اقدامات اصلاحی و کنترل آماری انحرافات.',
    verificationCriteriaFa: [
      'شاخص‌های پیشرو و پسرو (Tier 1 تا Tier 4) ماهانه اندازه‌گیری و مبنای تصمیم‌گیری مدیریت ارشد هستند.',
      'نواقص بحرانی و توصیه‌های PHA/MOC بدون تأخیر و با تأیید مستقل اثربخشی بسته می‌شوند.',
      'سیستم از انطباق صوری فراتر رفته و کارایی واقعی موانع ایمنی (Bow-Tie / IPL) به‌صورت کمّی پایش می‌شود.',
    ],
  },
  {
    level: 5,
    key: 'OPTIMIZING',
    titleFa: 'سطح ۵: بهینه‌شده (فرهنگ پایدار و بهبود مستمر)',
    titleEn: 'Level 5: Optimizing (Resilient Culture & Continuous Improvement)',
    summaryFa: 'نهادینه شدن فرهنگ ایمنی فرایند در تمام سطوح سازمان؛ یادگیری پیشگیرانه از سیگنال‌های ضعیف؛ نوآوری در کاهش ذاتی ریسک (Inherently Safer Design).',
    verificationCriteriaFa: [
      'فرهنگ ایمنی فرایند خودنگهدار، پیشگیرانه و مستقل از تغییرات مدیریتی در کل مجتمع جاری است.',
      'بهینه‌سازی مستمر بر اساس درس‌آموخته‌های داخلی و جهانی و اصول طراحی ذاتاً ایمن‌تر (ISD) انجام می‌شود.',
      'پایش سلامت موانع ایمنی به‌صورت بلادرنگ و یکپارچه در تصمیمات استراتژیک مجتمع نقش دارد.',
    ],
  },
];

export interface CapaStageMeta {
  key:
    | 'REGISTERED'
    | 'RISK_ASSESSED'
    | 'ASSIGNED'
    | 'ACTION_IN_PROGRESS'
    | 'EVIDENCE_SUBMITTED'
    | 'UNDER_REVIEW'
    | 'EFFECTIVENESS_VERIFIED'
    | 'CLOSED';
  order: number;
  titleFa: string;
  titleEn: string;
  gateRuleFa: string;
}

export const PSM_CAPA_STAGES: CapaStageMeta[] = [
  {
    key: 'REGISTERED',
    order: 1,
    titleFa: '۱. ثبت نقص',
    titleEn: '1. Registered',
    gateRuleFa: 'ثبت شرح دقیق نقص، منبع کشف، واحد و عنصر استاندارد مرتبط',
  },
  {
    key: 'RISK_ASSESSED',
    order: 2,
    titleFa: '۲. ارزیابی ریسک',
    titleEn: '2. Risk Assessed',
    gateRuleFa: 'تعیین شدت، احتمال، سطح ریسک و تحلیل علت ریشه‌ای (Root Cause)',
  },
  {
    key: 'ASSIGNED',
    order: 3,
    titleFa: '۳. تخصیص مسئول',
    titleEn: '3. Assigned',
    gateRuleFa: 'تعیین مسئول اقدام، شرح اقدام اصلاحی/پیشگیرانه و مهلت انجام',
  },
  {
    key: 'ACTION_IN_PROGRESS',
    order: 4,
    titleFa: '۴. اقدام اصلاحی',
    titleEn: '4. Action in Progress',
    gateRuleFa: 'اجرای عملیاتی اقدام اصلاحی و پیشگیرانه در واحد مربوطه',
  },
  {
    key: 'EVIDENCE_SUBMITTED',
    order: 5,
    titleFa: '۵. ثبت شواهد',
    titleEn: '5. Evidence Submitted',
    gateRuleFa: 'بارگذاری و ثبت شواهد عینی و مستندات اجرای اقدام اصلاحی',
  },
  {
    key: 'UNDER_REVIEW',
    order: 6,
    titleFa: '۶. بررسی فنی',
    titleEn: '6. Under Review',
    gateRuleFa: 'بررسی کفایت فنی اقدام و شواهد ثبت‌شده توسط بازبین فنی',
  },
  {
    key: 'EFFECTIVENESS_VERIFIED',
    order: 7,
    titleFa: '۷. تأیید اثربخشی مستقل',
    titleEn: '7. Effectiveness Verified',
    gateRuleFa: 'ممیزی و تأیید مستقل اثربخشی اقدام توسط فردی متمایز از مجری و ثبت‌کننده',
  },
  {
    key: 'CLOSED',
    order: 8,
    titleFa: '۸. بستن نقص',
    titleEn: '8. Closed',
    gateRuleFa: 'بستن نهایی نقص صرفاً پس از تأیید مستقل اثربخشی و تکمیل مستندات',
  },
];

export interface StageGateDefinition {
  gateKey: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';
  gateNumber: number;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  entryCriteriaFa: string[];
  exitCriteriaFa: string[];
  mandatoryChecklist: Array<{
    id: string;
    labelFa: string;
    requirementKey: string;
    isMandatory: boolean;
  }>;
  requiredEvidenceList: Array<{
    id: string;
    titleFa: string;
    descriptionFa: string;
    acceptanceCriteriaFa: string;
    responsibleRoleFa: string;
  }>;
  defaultPreparerRoleFa: string;
  defaultApproverRoleFa: string;
}

export const PSM_STAGE_GATES: StageGateDefinition[] = [
  {
    gateKey: 'G1',
    gateNumber: 1,
    titleFa: 'G1: تأیید ارزیابی اولیه و تعیین دامنه',
    titleEn: 'G1: Scope & Baseline Assessment Approval',
    descriptionFa: 'تصویب منشور پروژه، تعیین مرزهای فنی/سازمانی واحدهای مشمول و تکمیل ارزیابی ۲۰ عنصر CCPS و ۱۴ الزام OSHA.',
    entryCriteriaFa: [
      'صدور حکم انتصاب مدیر و تیم پروژه استقرار PSM',
      'تعریف کد و منشور اولیه پروژه در سامانه',
      'شناسایی واحدهای فرایندی و تجهیزات بحرانی اولیه',
    ],
    exitCriteriaFa: [
      'تکمیل ۱۰۰٪ ارزیابی اولیه عناصر مشمول CCPS و OSHA',
      'ثبت توجیه فنی مستند برای تمام موارد خارج از دامنه (Out-of-Scope)',
      'تأیید رسمی منشور و دامنه توسط حامی پروژه (Sponsor) و مدیر HSE',
    ],
    mandatoryChecklist: [
      { id: 'g1_scope_defined', labelFa: 'دامنه شمول پروژه و مرزهای فیزیکی و فرایندی رسماً تعیین شده است', requirementKey: 'SCOPE_DEFINED', isMandatory: true },
      { id: 'g1_assessments_completed', labelFa: 'ارزیابی وضعیت موجود برای ۲۰ عنصر CCPS و ۱۴ الزام OSHA تکمیل شده است', requirementKey: 'ASSESSMENTS_COMPLETED', isMandatory: true },
      { id: 'g1_out_of_scope_justified', labelFa: 'تمام موارد خارج از دامنه دارای توجیه فنی مستند و مصوب هستند', requirementKey: 'OUT_OF_SCOPE_JUSTIFIED', isMandatory: true },
      { id: 'g1_team_charter_signed', labelFa: 'تیم راهبری و کارگروه‌های تخصصی تشکیل و احکام صادر شده است', requirementKey: 'TEAM_CHARTER_SIGNED', isMandatory: true },
    ],
    requiredEvidenceList: [
      {
        id: 'ev_project_charter',
        titleFa: 'سند منشور و دامنه شمول پروژه استقرار PSM',
        descriptionFa: 'سند رسمی امضاشده توسط مدیرعامل یا حامی پروژه و مدیر HSE',
        acceptanceCriteriaFa: 'مشخص بودن مرزهای واحدهای مشمول و اهداف کمی و کیفی',
        responsibleRoleFa: 'مدیر پروژه PSM',
      },
      {
        id: 'ev_baseline_report',
        titleFa: 'گزارش ارزیابی اولیه انطباق (Baseline Assessment)',
        descriptionFa: 'گزارش کامل وضعیت موجود بر مبنای ۲۰ عنصر CCPS و ۱۴ الزام OSHA',
        acceptanceCriteriaFa: 'دارای امتیاز انطباق، نقاط قوت و ضعف برای هر عنصر',
        responsibleRoleFa: 'سرارزیاب PSM',
      },
    ],
    defaultPreparerRoleFa: 'مدیر پروژه PSM',
    defaultApproverRoleFa: 'حامی پروژه (مدیر مجتمع / مدیرعامل)',
  },
  {
    gateKey: 'G2',
    gateNumber: 2,
    titleFa: 'G2: تأیید تحلیل شکاف و فهرست نواقص',
    titleEn: 'G2: Gap Analysis & Deficiencies Approval',
    descriptionFa: 'استخراج کامل شکاف‌ها، سطح‌بندی ریسک بر اساس ماتریس ریسک پتروشیمی رجال، تخصیص مسئول و مهلت اولیه.',
    entryCriteriaFa: [
      'عبور موفق و تصویب مرحله G1',
      'استخراج شکاف‌ها از ارزیابی اولیه',
    ],
    exitCriteriaFa: [
      'ثبت و شناسه‌گذاری ۱۰۰٪ شکاف‌های حاصل از ارزیابی اولیه بدون جاافتادگی',
      'تعیین سطح ریسک، مسئول مستقیم، واحد و مهلت برای تک‌تک شکاف‌ها',
      'تأیید رسمی ماتریس تحلیل شکاف توسط کمیته تخصصی PSM',
    ],
    mandatoryChecklist: [
      { id: 'g2_all_gaps_logged', labelFa: 'کلیه شکاف‌های عناصر دارای عدم انطباق با شناسه یکتا ثبت شده‌اند', requirementKey: 'ALL_GAPS_LOGGED', isMandatory: true },
      { id: 'g2_risk_levels_assigned', labelFa: 'سطح ریسک تمامی شکاف‌ها (بحرانی، بالا، متوسط، پایین) تعیین شده است', requirementKey: 'RISK_LEVELS_ASSIGNED', isMandatory: true },
      { id: 'g2_owners_and_dues_set', labelFa: 'مسئول مستقیم، واحد سازمانی و مهلت پیشنهادی برای تمام شکاف‌ها مشخص است', requirementKey: 'OWNERS_AND_DUES_SET', isMandatory: true },
      { id: 'g2_critical_gaps_reviewed', labelFa: 'شکاف‌های بحرانی توسط کمیته راهبری بررسی و اولویت‌گذاری فوری شده‌اند', requirementKey: 'CRITICAL_GAPS_REVIEWED', isMandatory: true },
    ],
    requiredEvidenceList: [
      {
        id: 'ev_gap_register',
        titleFa: 'فهرست رسمی شکاف‌های انطباق (PSM Gap Register)',
        descriptionFa: 'ماتریس کامل شکاف‌ها با شناسه یکتا، مرجع CCPS/OSHA و سطح ریسک',
        acceptanceCriteriaFa: 'عدم وجود شکاف بدون مسئول، مهلت یا سطح ریسک',
        responsibleRoleFa: 'مسئول تحلیل شکاف و ارزیابی PSM',
      },
      {
        id: 'ev_gap_committee_minutes',
        titleFa: 'صورتجلسه تصویب فهرست شکاف‌ها و اولویت‌های رفع نواقص',
        descriptionFa: 'صورتجلسه کمیته راهبری با حضور روسای واحدهای عملیاتی',
        acceptanceCriteriaFa: 'تأیید اولویت‌بندی شکاف‌های بحرانی و مهلت‌ها',
        responsibleRoleFa: 'دبیر کمیته استقرار PSM',
      },
    ],
    defaultPreparerRoleFa: 'مسئول مهندسی ایمنی فرایند',
    defaultApproverRoleFa: 'مدیر HSE و رئیس مجتمع',
  },
  {
    gateKey: 'G3',
    gateNumber: 3,
    titleFa: 'G3: تصویب برنامه اجرایی، WBS و منابع',
    titleEn: 'G3: WBS, Implementation Plan & Resources Approval',
    descriptionFa: 'تبدیل شکاف‌ها به ساختار شکست کار (WBS)، زمان‌بندی گانت، تعیین پیش‌نیازها، مسیر بحرانی، بودجه و منابع.',
    entryCriteriaFa: [
      'تصویب کامل دروازه G2',
      'فهرست قطعی شکاف‌ها و اولویت‌های رفع نواقص',
    ],
    exitCriteriaFa: [
      'تدوین ساختار WBS متناظر با تمام شکاف‌های باز',
      'تعیین مجری، تاریخ شروع و پایان، وزن و پیش‌نیازهای فعالیت‌ها',
      'تخصیص بودجه و منابع لازم و تصویب گانت‌چارت پروژه',
    ],
    mandatoryChecklist: [
      { id: 'g3_wbs_fully_mapped', labelFa: 'تمامی شکاف‌ها به بسته‌های کاری WBS متصل شده‌اند', requirementKey: 'WBS_FULLY_MAPPED', isMandatory: true },
      { id: 'g3_critical_path_identified', labelFa: 'مسیر بحرانی و نقاط عطف اصلی (Milestones) زمان‌بندی شناسایی شده است', requirementKey: 'CRITICAL_PATH_IDENTIFIED', isMandatory: true },
      { id: 'g3_budget_allocated', labelFa: 'بودجه، ابزارها و منابع انسانی موردنیاز تخصیص و تایید مالی شده است', requirementKey: 'BUDGET_ALLOCATED', isMandatory: true },
      { id: 'g3_gantt_approved', labelFa: 'برنامه زمان‌بندی گانت به تصویب مشترک مدیر پروژه و مدیران واحدها رسیده است', requirementKey: 'GANTT_APPROVED', isMandatory: true },
    ],
    requiredEvidenceList: [
      {
        id: 'ev_wbs_dictionary',
        titleFa: 'شناسنامه و ساختار شکست کار (WBS Dictionary & Schedule)',
        descriptionFa: 'فهرست تفصیلی بسته‌های کاری با وزن، بودجه و روابط پیش‌نیازی',
        acceptanceCriteriaFa: 'پوشش ۱۰۰٪ شکاف‌های باز در فعالیت‌های اجرایی',
        responsibleRoleFa: 'کارشناس برنامه‌ریزی و کنترل پروژه PSM',
      },
      {
        id: 'ev_budget_approval',
        titleFa: 'تأییدیه بودجه و تخصیص منابع پروژه استقرار PSM',
        descriptionFa: 'سند رسمی تایید منابع مالی و لجستیک توسط مدیریت مالی و مدیرعامل',
        acceptanceCriteriaFa: 'تطابق با برآورد ریالی هزینه‌های مطالعات و اقدامات',
        responsibleRoleFa: 'مدیر پروژه PSM',
      },
    ],
    defaultPreparerRoleFa: 'کارشناس برنامه‌ریزی و کنترل پروژه',
    defaultApproverRoleFa: 'مدیر پروژه و مدیر مجتمع',
  },
  {
    gateKey: 'G4',
    gateNumber: 4,
    titleFa: 'G4: تأیید خروجی‌های اجرایی و تکمیل مدارک',
    titleEn: 'G4: Execution Deliverables & Documents Approval',
    descriptionFa: 'اجرای بسته‌های کاری WBS، تدوین و بازنگری اسناد و دستورالعمل‌ها، تکمیل مطالعات ۱۴ زیرماژول و صحه‌گذاری شواهد فنی.',
    entryCriteriaFa: [
      'تصویب دروازه G3 و آغاز اجرای فاز عملیاتی',
    ],
    exitCriteriaFa: [
      'تکمیل فعالیت‌های WBS طبق زمان‌بندی یا ثبت انحراف موجه',
      'تأیید فنی و تصویب تمام مدارک الزامی بانک اسناد PSM با شواهد کافی',
      'تکمیل مطالعات تخصصی لازم (HAZOP/LOPA/SOP/MI/PSSR) در واحدهای مشمول',
    ],
    mandatoryChecklist: [
      { id: 'g4_wbs_deliverables_completed', labelFa: 'فعالیت‌های WBS با خروجی‌های ملموس و مستند تکمیل شده‌اند', requirementKey: 'WBS_DELIVERABLES_COMPLETED', isMandatory: true },
      { id: 'g4_documents_approved_with_evidence', labelFa: 'مدارک بانک اسناد PSM با شواهد فنی کامل بررسی و تأیید نهایی شده‌اند', requirementKey: 'DOCUMENTS_APPROVED_WITH_EVIDENCE', isMandatory: true },
      { id: 'g4_specialized_studies_finalized', labelFa: 'مطالعات تخصصی ۱۴ زیرماژول (مانند HAZOP، ممیزی، دستورالعمل‌ها) نهایی شده‌اند', requirementKey: 'SPECIALIZED_STUDIES_FINALIZED', isMandatory: true },
      { id: 'g4_no_unapproved_revisions', labelFa: 'هیچ مدرک در انتظار تأیید یا با شواهد ناکافی در این مرحله رها نشده است', requirementKey: 'NO_UNAPPROVED_REVISIONS', isMandatory: true },
    ],
    requiredEvidenceList: [
      {
        id: 'ev_document_bank_approved',
        titleFa: 'بانک مدارک مصوب PSM با شواهد پیوست',
        descriptionFa: 'فهرست کامل اسناد، SOPها، رویه‌ها و نقشه‌ها در وضعیت APPROVED',
        acceptanceCriteriaFa: 'تکمیل شواهد فنی و امضای تأییدکنندگان سه‌گانه',
        responsibleRoleFa: 'مسئول مدیریت مدارک و مستندات PSM',
      },
      {
        id: 'ev_subsystem_study_reports',
        titleFa: 'گزارش‌های نهایی مطالعات تخصصی و بازنگری مهندسی',
        descriptionFa: 'گزارش‌های مطالعات PHA، HAZOP، ارزیابی ایمنی پیش از راه‌اندازی و بازرسی فنی',
        acceptanceCriteriaFa: 'تکمیل پیگیری توصیه‌ها و ثبت شماره ثبت رسمی',
        responsibleRoleFa: 'رؤسای کارگروه‌های تخصصی PSM',
      },
    ],
    defaultPreparerRoleFa: 'دبیر کارگروه تدوین و استقرار مستندات',
    defaultApproverRoleFa: 'کمیته فنی PSM و مدیران عملیات و HSE',
  },
  {
    gateKey: 'G5',
    gateNumber: 5,
    titleFa: 'G5: تأیید اثربخشی اقدامات و کنترل‌ها',
    titleEn: 'G5: Corrective Actions & Controls Effectiveness Approval',
    descriptionFa: 'بستن پرونده‌های CAPA در گردش کار ۸ مرحله‌ای، صحه‌گذاری شواهد اجرا و تأیید اثربخشی توسط ارزیاب مستقل.',
    entryCriteriaFa: [
      'تصویب دروازه G4',
      'ارائه شواهد اجرایی برای کلیه اقدامات اصلاحی و پیشگیرانه',
    ],
    exitCriteriaFa: [
      'بسته شدن ۱۰۰٪ پرونده‌های CAPA با سطح ریسک بحرانی (CRITICAL)',
      'انجام ممیزی و تأیید مستقل اثربخشی (توسط فردی غیر از مجری اقدام)',
      'تعیین تکلیف نواقص غیربحرانی باقیمانده با برنامه پیگیری و تأیید مدیریت',
    ],
    mandatoryChecklist: [
      { id: 'g5_critical_capas_closed', labelFa: 'کلیه اقدامات اصلاحی بحرانی (Critical CAPA) با تأیید اثربخشی بسته شده‌اند', requirementKey: 'CRITICAL_CAPAS_CLOSED', isMandatory: true },
      { id: 'g5_independent_verification_done', labelFa: 'تأیید اثربخشی توسط ارزیاب/ممیز مستقل از مجری اقدام انجام شده است', requirementKey: 'INDEPENDENT_VERIFICATION_DONE', isMandatory: true },
      { id: 'g5_residual_actions_managed', labelFa: 'اقدامات غیربحرانی باز دارای برنامه پیگیری مصوب مدیریت هستند', requirementKey: 'RESIDUAL_ACTIONS_MANAGED', isMandatory: true },
      { id: 'g5_controls_validated_in_field', labelFa: 'کنترل‌های مهندسی و رویه‌ای در میدان عملیاتی بازرسی و صحه‌گذاری شده‌اند', requirementKey: 'CONTROLS_VALIDATED_IN_FIELD', isMandatory: true },
    ],
    requiredEvidenceList: [
      {
        id: 'ev_capa_effectiveness_dossier',
        titleFa: 'پرونده جامع صحه‌گذاری اثربخشی اقدامات اصلاحی (CAPA)',
        descriptionFa: 'مستندات ارزیابی اثربخشی شامل آزمون‌های عملکردی و شواهد رفع نقص',
        acceptanceCriteriaFa: 'تأیید و امضای ممیز مستقل و عدم وجود نقص بحرانی باز',
        responsibleRoleFa: 'ممیز مستقل اثربخشی CAPA',
      },
      {
        id: 'ev_audit_verification_report',
        titleFa: 'گزارش ممیزی میدانی صحت‌سنجی کارکرد کنترل‌ها و موانع ایمنی',
        descriptionFa: 'گزارش ممیزی انطباق موانع ایمنی فرایند (Safety Barriers) در سایت',
        acceptanceCriteriaFa: 'تأیید پایداری کنترل‌ها در شرایط بهره‌برداری نرمال',
        responsibleRoleFa: 'سرپرست ممیزی و بازرسی ایمنی',
      },
    ],
    defaultPreparerRoleFa: 'ممیز مستقل سیستم‌های مدیریت',
    defaultApproverRoleFa: 'مدیر HSE و مدیر فنی/عملیات',
  },
  {
    gateKey: 'G6',
    gateNumber: 6,
    titleFa: 'G6: تصویب نهایی و تحویل پروژه استقرار PSM',
    titleEn: 'G6: Final Project Acceptance & Operational Handover',
    descriptionFa: 'تصویب ممیزی نهایی، ارزیابی مدل بلوغ، تحقق معیارهای پذیرش و تحویل رسمی سیستم مستقر به بهره‌برداری و نگهداشت.',
    entryCriteriaFa: [
      'تصویب موفق دروازه G5 بدون هیچ مانع بحرانی',
      'تکمیل کامل دوره‌های آموزشی و صلاحیت پرسنل',
    ],
    exitCriteriaFa: [
      'احراز کامل ۷ شرط الزامی تحویل نهایی در سمت سرور',
      'کسب حداقل سطح بلوغ ۳ (Defined) در ارزیابی مدل بلوغ',
      'امضای صورتجلسه رسمی تحویل پروژه توسط مدیرعامل و کمیته راهبری',
      'تغییر وضعیت پروژه به ACTIVE_SYSTEM و آغاز دوره پایش و نگهداشت',
    ],
    mandatoryChecklist: [
      { id: 'g6_all_gates_preceding_approved', labelFa: 'تمامی دروازه‌های قبلی (G1 تا G5) رسماً تصویب شده‌اند', requirementKey: 'ALL_GATES_PRECEDING_APPROVED', isMandatory: true },
      { id: 'g6_maturity_level_achieved', labelFa: 'حداقل سطح بلوغ استاندارد (سطح ۳ به بالا) احراز شده است', requirementKey: 'MATURITY_LEVEL_ACHIEVED', isMandatory: true },
      { id: 'g6_zero_critical_open', labelFa: 'هیچ نقص بحرانی، شکاف باز یا مدرک ناقص در پروژه وجود ندارد', requirementKey: 'ZERO_CRITICAL_OPEN', isMandatory: true },
      { id: 'g6_final_handover_signed', labelFa: 'صورتجلسه رسمی تحویل و پذیرش سیستم PSM توسط ارکان ذیصلاح امضا شده است', requirementKey: 'FINAL_HANDOVER_SIGNED', isMandatory: true },
    ],
    requiredEvidenceList: [
      {
        id: 'ev_final_handover_minutes',
        titleFa: 'صورتجلسه رسمی پذیرش نهایی و تحویل پروژه استقرار PSM',
        descriptionFa: 'سند نهایی پذیرش به امضای مدیرعامل، مدیر مجتمع، مدیر HSE و روسای واحدها',
        acceptanceCriteriaFa: 'احراز بی قید و شرط تمام معیارهای ۷ گانه تحویل',
        responsibleRoleFa: 'مدیر پروژه PSM و دبیر کمیته راهبری',
      },
      {
        id: 'ev_sustainment_plan',
        titleFa: 'برنامه پایش، ممیزی دوره‌ای و نگهداشت سیستم PSM',
        descriptionFa: 'برنامه ۵ ساله ممیزی‌های دوره‌ای، بازنگری مطالعات PHA و پایش شاخص‌های API 754',
        acceptanceCriteriaFa: 'تثبیت مسئولیت‌های دائمی پایش ایمنی فرایند در ساختار سازمانی',
        responsibleRoleFa: 'مدیر HSE مجتمع پتروشیمی رجال',
      },
    ],
    defaultPreparerRoleFa: 'مدیر پروژه PSM',
    defaultApproverRoleFa: 'مدیرعامل مجتمع پتروشیمی رجال (CEO)',
  },
];
