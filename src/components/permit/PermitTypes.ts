import { WorkPermit, PermitCategory } from '../../types';

export interface PermitTabConfig {
  id: PermitCategory | 'dashboard' | 'archive';
  titleFa: string;
  titleEn: string;
  group: 'main' | 'supplementary' | 'management';
  iconName: string;
  descriptionFa: string;
  color: string;
}

export const PERMIT_SECTIONS: PermitTabConfig[] = [
  // پروانه‌های اصلی
  {
    id: 'Hot',
    titleFa: 'پروانه کار گرم (Hot Work)',
    titleEn: 'Hot Work Permit',
    group: 'main',
    iconName: 'Flame',
    descriptionFa: 'عملیات جوشکاری، برشکاری، فرزکاری و کارهای جرقه‌زا یا همراه با شعله باز',
    color: 'from-amber-500 to-red-600'
  },
  {
    id: 'Cold',
    titleFa: 'پروانه کار سرد (Cold Work)',
    titleEn: 'Cold Work Permit',
    group: 'main',
    iconName: 'Snowflake',
    descriptionFa: 'عملیات مکانیکی بدون جرقه، رنگ‌آمیزی، داربست‌بندی و تعمیرات عمومی',
    color: 'from-sky-500 to-blue-600'
  },

  // پروانه‌های الحاقی
  {
    id: 'Excavation',
    titleFa: 'الحاقی حفاری (Excavation)',
    titleEn: 'Excavation Certificate',
    group: 'supplementary',
    iconName: 'Shovel',
    descriptionFa: 'حفاری، کانال‌کنی و خاکبرداری زمین با بررسی تاسیسات زیرزمینی و کابل‌یابی',
    color: 'from-yellow-600 to-amber-700'
  },
  {
    id: 'ProcessMechanical',
    titleFa: 'الحاقی جداسازی فرآیندی / مکانیکی / ایزوله دقیق',
    titleEn: 'Process & Mechanical Isolation',
    group: 'supplementary',
    iconName: 'GitCommit',
    descriptionFa: 'نصب انسداد (کورکن/اسپید)، بی‌فشارسازی، تخلیه با نیتروژن و قفل‌گذاری خطوط (LOTO)',
    color: 'from-purple-600 to-indigo-700'
  },
  {
    id: 'ConfinedSpace',
    titleFa: 'الحاقی ورود به فضای بسته (Confined Space)',
    titleEn: 'Confined Space Entry',
    group: 'supplementary',
    iconName: 'Box',
    descriptionFa: 'ورود به مخازن، برج‌ها، کانال‌ها و فضاهای با تهویه محدود و تست مستمر گاز',
    color: 'from-teal-600 to-emerald-700'
  },
  {
    id: 'ElectricalIsolation',
    titleFa: 'الحاقی جداسازی الکتریکی (Electrical Isolation)',
    titleEn: 'Electrical Isolation',
    group: 'supplementary',
    iconName: 'Zap',
    descriptionFa: 'ایزولاسیون برق پست‌ها، قطع کلیدها، کشیدن فیوز، تست ولتاژ صفر و اتصال زمین',
    color: 'from-blue-600 to-indigo-700'
  },
  {
    id: 'Radiation',
    titleFa: 'الحاقی منابع پرتوزا (Radiography / Radiation)',
    titleEn: 'Radiation Source Certificate',
    group: 'supplementary',
    iconName: 'Radioactive',
    descriptionFa: 'پرتونگاری صنعتی (NDT)، بازرسی با اشعه گاما/ایکس و حریم‌بندی حفاظت در برابر اشعه',
    color: 'from-rose-600 to-pink-700'
  },
  {
    id: 'VehicleCrane',
    titleFa: 'الحاقی ورود جرثقیل / خودرو (Crane & Heavy Vehicle)',
    titleEn: 'Crane & Vehicle Entry',
    group: 'supplementary',
    iconName: 'Truck',
    descriptionFa: 'ورود جرثقیل‌های سنگین، لیفتراک، خودروهای کارگاهی و بررسی اگزوز و جک‌های اتکا',
    color: 'from-cyan-600 to-blue-700'
  },

  // مدیریت و بایگانی
  {
    id: 'dashboard',
    titleFa: 'داشبورد و وضعیت پروانه‌های فعال',
    titleEn: 'Permit Dashboard & Live Status',
    group: 'management',
    iconName: 'LayoutDashboard',
    descriptionFa: 'آمار زنده پروانه‌های در حال اجرا، اعتبارسنجی QR و هشدارهای ایمنی',
    color: 'from-emerald-600 to-teal-700'
  },
];

export const PERMIT_CATEGORIES_CONFIG: Record<string, { titleFa: string; titleEn: string; badgeColor: string }> = {
  Hot: {
    titleFa: 'کار گرم (Hot Work)',
    titleEn: 'Hot Work',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900/60'
  },
  Cold: {
    titleFa: 'کار سرد (Cold Work)',
    titleEn: 'Cold Work',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900/60'
  },
  Excavation: {
    titleFa: 'الحاقی حفاری (Excavation)',
    titleEn: 'Excavation Certificate',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60'
  },
  ProcessMechanical: {
    titleFa: 'الحاقی ایزوله فرآیندی/مکانیکی',
    titleEn: 'Process & Mechanical Isolation',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900/60'
  },
  ConfinedSpace: {
    titleFa: 'الحاقی فضای بسته (Confined Space)',
    titleEn: 'Confined Space Entry',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-900/60'
  },
  ElectricalIsolation: {
    titleFa: 'الحاقی جداسازی الکتریکی',
    titleEn: 'Electrical Isolation',
    badgeColor: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-900/60'
  },
  Radiation: {
    titleFa: 'الحاقی منابع پرتوزا (Radiography)',
    titleEn: 'Radiation Source Certificate',
    badgeColor: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-900/60'
  },
  VehicleCrane: {
    titleFa: 'الحاقی ورود جرثقیل / ماشین‌آلات',
    titleEn: 'Crane & Heavy Vehicle',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900/60'
  }
};

export const INITIAL_DEMO_PERMITS: WorkPermit[] = [];

export const COLD_INSPECTION_TEXTS = [
  '۱- آیا مطابق بازدید از محل مطمئن هستید که کلیه تجهیزات کاملاً پاک، شسته و بخار داده شده و تهویه گردیده است؟',
  '۲- آیا مقررات مربوط به جدا نمودن و مسدود کردن ورودی ها، خروجی ها (با استفاده از صفحات کور کننده) و جداسازی مکانیکی انجام شده است؟',
  '۳- آیا ظروف، مخازن و خطوط لوله',
  '۴- آیا تا شعاع 25 متری محل انجام کار از مواد قابل احتراق یا اشتعال، پاکسازی شده است؟',
  '۵- آیا روشنایی محل فعالیت به همراه تجهیزات مربوطه مناسب و ایمن است و اتصال به زمین رعایت شده است؟',
  '۶- آیا جریان برق قطع گردیده و به دستگاه های کنترل، علامت خطر نصب شده است؟',
  '۷- آیا لازم است دستگاه ها و خطوط لوله پر نگهداشته شوند؟',
  '۸- آیا نیاز به پیوست',
  '۹- آیا جهت کار در ارتفاع مسیرهای دسترسی، راه پله ها، سکوی کار و ... در حالت ایمن و در دسترس هستند؟ و داربست دارای تاییدیه ایمنی است؟',
  '۱۰- آیا اقدامات احتیاطی لازم در خصوص خطرات مواد رادیو اکتیو به عمل آمده است؟',
  '۱۱- آیا توصیه های SDS رعایت شده و برگه اطلاعات ایمنی بر روی مواد خطرناک در محیط کار نصب شده است؟',
  '۱۲- آیا حضور آماده باش نفر',
  '۱۳- آیا به مواردی که ممکن است اجرای این کار را به خطر اندازد، توجه شده است؟'
];

export const HOT_INSPECTION_TEXTS = [
  '۱- آیا مطابق بازدید از محل مطمئن هستید که کلیه تجهیزات کاملاً پاک، شسته و بخار داده شده و تهویه گردیده است؟',
  '۲- آیا مقررات مربوط به جدا نمودن و مسدود کردن ورودی ها، خروجی ها (با استفاده از صفحات کور کننده) و جداسازی مکانیکی انجام شده است؟',
  '۳- آیا ظروف، مخازن و خطوط لوله',
  '۴- موادقابل احتراق تا شعاع 25متری پاکسازی وتمامی شکاف‌ها،چاله‌های فاضلاب ومحل‌های خطرناک پوشیده شده است؟',
  '۵- آیا روشنایی محل فعالیت به همراه تجهیزات مربوطه مناسب و ایمن است و با چراغ ضدانفجار و برق 24 ولت بوده و کابل های سیار برق سالم و از مسیر مناسب عبور کرده اند؟',
  '۶- آیا جریان برق قطع گردیده و به دستگاه های کنترل، علامت خطر نصب شده است؟',
  '۷- آیا موتور جوشکاری و کابل های آن در محوطه ایمن قرار گرفته و گیره اتصال منفی و اتصال به زمین آن در نزدیک ترین و مناسب ترین نقطه به محل جوشکاری نصب شده است ، کپسول هوا برش فلش بک ارستر دارد؟',
  '۸- آیا لازم است دستگاه ها و خطوط لوله پر نگهداشته شوند؟',
  '۹- آیا نیاز به پیوست',
  '۱۰- جهت کار در ارتفاع مسیرهای دسترسی، راه پله ها، سکوی کار و ... در حالت ایمن و در دسترس هستند؟ و داربست دارای تاییدیه ایمنی است؟',
  '۱۱- آیا اقدامات احتیاطی لازم در خصوص خطرات مواد رادیو اکتیو به عمل آمده است؟',
  '۱۲- آیا توصیه های SDS رعایت شده و برگه اطلاعات ایمنی بر روی مواد خطرناک در محیط کار نصب شده است؟',
  '۱۳- آیا حضور آماده باش نفر',
  '۱۴- آیا به مواردی که ممکن است اجرای این کار را به خطر اندازد، توجه کرده اید؟'
];

export const ESD_ROWS_NAMES = [
  'Fire & Gas Detectors Inhibited',
  'Extinguishing System Inhibited',
  'Extinguishing System Isolated',
  'Deluge System Inhibited',
  'Deluge System Isolated',
  'Any Part Of ESD Overriden'
];


