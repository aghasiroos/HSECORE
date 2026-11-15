import type {
  GhsPictogramCode,
  SdsAttachmentRole,
  SdsPhysicalState,
  SdsSignalWord,
  SdsStatus,
} from './types';

export interface Section16Meta {
  num: number;
  key: `section${number}`;
  titleFa: string;
  titleEn: string;
}

export const SDS_16_SECTIONS: Section16Meta[] = [
  { num: 1, key: 'section1', titleFa: '۱. شناسایی ماده / فرآورده و اطلاعات شرکت', titleEn: '1. Identification of the Substance/Mixture & Company' },
  { num: 2, key: 'section2', titleFa: '۲. شناسایی خطرات (GHS)', titleEn: '2. Hazard(s) Identification' },
  { num: 3, key: 'section3', titleFa: '۳. ترکیب / اطلاعات اجزاء سازنده', titleEn: '3. Composition / Information on Ingredients' },
  { num: 4, key: 'section4', titleFa: '۴. اقدامات کمک‌های اولیه', titleEn: '4. First-Aid Measures' },
  { num: 5, key: 'section5', titleFa: '۵. اقدامات اطفای حریق', titleEn: '5. Fire-Fighting Measures' },
  { num: 6, key: 'section6', titleFa: '۶. اقدامات در زمان رهاسازی اتفاقی / نشت', titleEn: '6. Accidental Release Measures' },
  { num: 7, key: 'section7', titleFa: '۷. حمل‌ونقل، جابجایی و انبارش ایمن', titleEn: '7. Handling and Storage' },
  { num: 8, key: 'section8', titleFa: '۸. کنترل‌های مواجهه و حفاظت فردی (PPE)', titleEn: '8. Exposure Controls / Personal Protection' },
  { num: 9, key: 'section9', titleFa: '۹. خواص فیزیکی و شیمیایی', titleEn: '9. Physical and Chemical Properties' },
  { num: 10, key: 'section10', titleFa: '۱۰. پایداری و واکنش‌پذیری', titleEn: '10. Stability and Reactivity' },
  { num: 11, key: 'section11', titleFa: '۱۱. اطلاعات سم‌شناسی', titleEn: '11. Toxicological Information' },
  { num: 12, key: 'section12', titleFa: '۱۲. اطلاعات زیست‌محیطی', titleEn: '12. Ecological Information' },
  { num: 13, key: 'section13', titleFa: '۱۳. ملاحظات دفع پسماند و ضایعات', titleEn: '13. Disposal Considerations' },
  { num: 14, key: 'section14', titleFa: '۱۴. اطلاعات حمل‌ونقل (UN / ADR / IMDG / IATA)', titleEn: '14. Transport Information' },
  { num: 15, key: 'section15', titleFa: '۱۵. اطلاعات قانونی و مقرراتی', titleEn: '15. Regulatory Information' },
  { num: 16, key: 'section16', titleFa: '۱۶. سایر اطلاعات و ملاحظات تدوین', titleEn: '16. Other Information' },
];

export const GHS_PICTOGRAM_CATALOG: {
  code: GhsPictogramCode;
  titleFa: string;
  titleEn: string;
  descFa: string;
}[] = [
  { code: 'GHS01', titleFa: 'مواد منفجره', titleEn: 'Exploding Bomb', descFa: 'مواد منفجره، خودواکنش‌پذیر و پراکسیدهای آلی ناپایدار' },
  { code: 'GHS02', titleFa: 'اشتعال‌پذیر', titleEn: 'Flame (Flammable)', descFa: 'گازها، مایعات و جامدات اشتعال‌پذیر، پیروفوریک و خودگرم‌شونده' },
  { code: 'GHS03', titleFa: 'اکسیدکننده', titleEn: 'Flame Over Circle (Oxidizer)', descFa: 'گازها، مایعات و جامدات اکسیدکننده و تشدیدکننده حریق' },
  { code: 'GHS04', titleFa: 'گاز تحت فشار', titleEn: 'Gas Cylinder', descFa: 'گازهای فشرده، مایع‌شده، منحل‌شده یا برودتی تحت فشار' },
  { code: 'GHS05', titleFa: 'خورنده', titleEn: 'Corrosion', descFa: 'خورندگی شدید پوست، آسیب چشمی جدی و خورنده فلزات' },
  { code: 'GHS06', titleFa: 'سمیت حاد (کشنده)', titleEn: 'Skull & Crossbones', descFa: 'مواد با سمیت حاد کشنده یا سمی در مقادیر اندک' },
  { code: 'GHS07', titleFa: 'علامت تعجب (محرک / زیان‌آور)', titleEn: 'Exclamation Mark', descFa: 'تحریک‌پذیری پوست و چشم، حساسیت‌زا و مسمومیت حاد خفیف' },
  { code: 'GHS08', titleFa: 'خطر سلامتی بلندمدت', titleEn: 'Health Hazard', descFa: 'سرطان‌زا، جهش‌زا، سمیت تولیدمثلی، STOT و خطر تنفسی/آسپیراسیون' },
  { code: 'GHS09', titleFa: 'خطر برای محیط زیست آبزی', titleEn: 'Environment', descFa: 'سمیت حاد یا مزمن برای محیط زیست آبی و اکوسیستم' },
];

export const PHYSICAL_STATE_LABELS: Record<SdsPhysicalState, { fa: string; en: string }> = {
  GAS: { fa: 'گاز', en: 'Gas' },
  LIQUID: { fa: 'مایع', en: 'Liquid' },
  SOLID: { fa: 'جامد', en: 'Solid' },
  POWDER: { fa: 'پودر / گرانول', en: 'Powder / Granule' },
  MIXTURE: { fa: 'مخلوط / محلول', en: 'Mixture / Solution' },
  OTHER: { fa: 'سایر', en: 'Other' },
};

export const SIGNAL_WORD_META: Record<SdsSignalWord, { fa: string; en: string; badgeClass: string }> = {
  DANGER: {
    fa: 'خطر (Danger)',
    en: 'DANGER',
    badgeClass: 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  },
  WARNING: {
    fa: 'هشدار (Warning)',
    en: 'WARNING',
    badgeClass: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  },
  NONE: {
    fa: 'بدون واژه اخطار',
    en: 'None',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

export const SDS_STATUS_META: Record<
  SdsStatus,
  { fa: string; en: string; badgeClass: string; dotClass: string }
> = {
  DRAFT: {
    fa: 'پیش‌نویس',
    en: 'Draft',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-500',
  },
  UNDER_REVIEW: {
    fa: 'در انتظار بررسی / تأیید',
    en: 'Under Review',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
  APPROVED: {
    fa: 'تأییدشده',
    en: 'Approved',
    badgeClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800',
    dotClass: 'bg-sky-500',
  },
  PUBLISHED: {
    fa: 'منتشرشده (معتبر عملیاتی)',
    en: 'Published',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  OBSOLETE: {
    fa: 'منسوخ‌شده (آرشیو)',
    en: 'Obsolete',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-500',
  },
};

export const ATTACHMENT_ROLE_LABELS: Record<SdsAttachmentRole, { fa: string; en: string }> = {
  PRIMARY_SDS_PDF: { fa: 'فایل اصلی SDS (PDF سازنده/استاندارد)', en: 'Primary SDS PDF' },
  TECHNICAL_SPEC: { fa: 'مستندات فنی / کاتالوگ (TDS)', en: 'Technical Data Sheet' },
  COA: { fa: 'گواهی آنالیز (COA)', en: 'Certificate of Analysis' },
  STORAGE_INSTRUCTION: { fa: 'دستورالعمل انبارش و نگهداری ایمن', en: 'Safe Storage Instruction' },
  TRANSPORT_DOC: { fa: 'مستندات حمل‌ونقل مواد خطرناک', en: 'Transport Document' },
  OTHER: { fa: 'سایر پیوست‌های مرتبط', en: 'Other Related Attachment' },
};

export const COMMON_EXPOSURE_ROUTES: { id: string; fa: string; en: string }[] = [
  { id: 'INHALATION', fa: 'استنشاقی (Inhalation)', en: 'Inhalation' },
  { id: 'SKIN_CONTACT', fa: 'تماس پوستی (Skin Contact)', en: 'Skin Contact' },
  { id: 'EYE_CONTACT', fa: 'تماس چشمی (Eye Contact)', en: 'Eye Contact' },
  { id: 'INGESTION', fa: 'بلع / گوارشی (Ingestion)', en: 'Ingestion' },
];

export const COMMON_HAZARD_CLASSES: string[] = [
  'مایعات اشتعال‌پذیر (Flammable Liquids)',
  'گازهای اشتعال‌پذیر (Flammable Gases)',
  'مواد خورنده پوست و فلزات (Corrosive)',
  'سمیت حاد تنفسی / پوستی / خوراکی (Acute Toxicity)',
  'سرطان‌زا / جهش‌زا / سمیت تولیدمثلی (CMR)',
  'تحریک‌کننده چشم و پوست (Irritant)',
  'سمی برای محیط زیست آبزی (Aquatic Toxicity)',
  'اکسیدکننده (Oxidizing)',
  'گاز تحت فشار (Compressed Gas)',
  'خطر آسپیراسیون (Aspiration Hazard)',
];

export const COMMON_H_STATEMENTS: string[] = [
  'H220: گاز به‌شدت اشتعال‌پذیر',
  'H224: مایع و بخار به‌شدت اشتعال‌پذیر',
  'H225: مایع و بخار بسیار اشتعال‌پذیر',
  'H226: مایع و بخار اشتعال‌پذیر',
  'H280: حاوی گاز تحت فشار؛ در صورت گرم شدن ممکن است منفجر شود',
  'H290: ممکن است برای فلزات خورنده باشد',
  'H301: سمی در صورت بلعیده شدن',
  'H302: زیان‌آور در صورت بلعیده شدن',
  'H304: در صورت بلع و ورود به مجاری تنفسی می‌تواند کشنده باشد',
  'H311: سمی در تماس با پوست',
  'H314: باعث سوختگی شدید پوست و آسیب چشمی می‌شود',
  'H315: باعث تحریک پوست می‌شود',
  'H318: باعث آسیب جدی به چشم می‌شود',
  'H319: باعث تحریک شدید چشم می‌شود',
  'H330: در صورت استنشاق کشنده است',
  'H331: سمی در صورت استنشاق',
  'H335: ممکن است باعث تحریک مجاری تنفسی شود',
  'H336: ممکن است باعث خواب‌آلودگی یا سرگیجه شود',
  'H340: ممکن است باعث نقایص ژنتیکی شود',
  'H350: ممکن است باعث سرطان شود',
  'H360: ممکن است به باروری یا جنین آسیب برساند',
  'H372: باعث آسیب به اندام‌ها در مواجهه طولانی‌مدت یا مکرر می‌شود',
  'H400: بسیار سمی برای آبزیان',
  'H410: بسیار سمی برای آبزیان با اثرات طولانی‌مدت',
  'H411: سمی برای آبزیان با اثرات طولانی‌مدت',
];

export const COMMON_P_STATEMENTS: string[] = [
  'P210: دور از حرارت، سطوح داغ، جرقه، شعله باز و منابع احتراق نگهداری شود. سیگار کشیدن ممنوع.',
  'P233: ظرف را کاملاً دربسته نگه دارید.',
  'P240: اتصال زمین (Earth/Bonding) ظرف و تجهیزات دریافت‌کننده برقرار شود.',
  'P260: از استنشاق غبار/دود/گاز/مه/بخارات/اسپری خودداری کنید.',
  'P273: از رهاسازی در محیط زیست خودداری کنید.',
  'P280: از دستکش حفاظتی، لباس حفاظتی، محافظ چشم و محافظ صورت استفاده کنید.',
  'P301+P310: در صورت بلع: فوراً با مرکز فوریت‌های مسمومیت یا پزشک تماس بگیرید.',
  'P303+P361+P353: در صورت تماس با پوست یا مو: لباس‌های آلوده را فوراً درآورید و پوست را با آب بشویید.',
  'P304+P340: در صورت استنشاق: مصدوم را به هوای تازه منتقل کرده و در وضعیت راحت تنفسی نگه دارید.',
  'P305+P351+P338: در صورت تماس با چشم: با احتیاط چندین دقیقه با آب بشویید و لنزها را خارج کنید.',
  'P370+P378: در صورت حریق: از فوم مقاوم در برابر الکل، دی‌اکسیدکربن یا پودر خشک برای اطفا استفاده کنید.',
  'P403+P235: در محل دارای تهویه مناسب و خنک نگهداری شود.',
  'P501: محتویات/ظرف را مطابق مقررات پسماندهای ویژه و ضایعات شیمیایی دفع کنید.',
];
