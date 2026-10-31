import { apiDb } from '../services/apiDatabaseClient';

export interface SystemModuleGroup {
  id: string;
  titleFa: string;
  titleEn: string;
  color: string;
  bgLight: string;
  borderLight: string;
  iconName?: string;
  badgeCount?: number;
}

export const SYSTEM_MODULE_GROUPS: SystemModuleGroup[] = [
  {
    id: 'dashboards',
    titleFa: 'داشبوردها و تحلیل‌های آماری',
    titleEn: 'Executive Dashboards & Analytics',
    color: 'text-sky-600 dark:text-sky-400',
    bgLight: 'bg-sky-50 dark:bg-sky-950/30',
    borderLight: 'border-sky-200 dark:border-sky-800/40',
    iconName: 'BarChart3'
  },
  {
    id: 'departments',
    titleFa: 'دپارتمان‌های تخصصی HSE',
    titleEn: 'Specialized HSE Units',
    color: 'text-rose-600 dark:text-rose-400',
    bgLight: 'bg-rose-50 dark:bg-rose-950/30',
    borderLight: 'border-rose-200 dark:border-rose-800/40',
    iconName: 'Building2'
  },
  {
    id: 'safety_permits',
    titleFa: 'مجوزهای کار و کنترل ریسک',
    titleEn: 'Permits & Risk Control',
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    borderLight: 'border-amber-200 dark:border-amber-800/40',
    iconName: 'FileCheck2'
  },
  {
    id: 'incidents_compliance',
    titleFa: 'رویدادها و انضباط ایمنی',
    titleEn: 'Incidents & Compliance',
    color: 'text-red-600 dark:text-red-400',
    bgLight: 'bg-red-50 dark:bg-red-950/30',
    borderLight: 'border-red-200 dark:border-red-800/40',
    iconName: 'AlertOctagon'
  },
  {
    id: 'human_capital',
    titleFa: 'سرمایه انسانی و آموزش',
    titleEn: 'Human Capital & Training',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderLight: 'border-emerald-200 dark:border-emerald-800/40',
    iconName: 'GraduationCap'
  },
  {
    id: 'workflows',
    titleFa: 'کارتابل و فرآیندهای سازمانی',
    titleEn: 'Workflows & Digital Workplace',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderLight: 'border-indigo-200 dark:border-indigo-800/40',
    iconName: 'Workflow'
  },
  {
    id: 'system',
    titleFa: 'مدیریت و پیکربندی سامانه',
    titleEn: 'Governance & Administration',
    color: 'text-slate-600 dark:text-slate-400',
    bgLight: 'bg-slate-100 dark:bg-slate-800/50',
    borderLight: 'border-slate-200 dark:border-slate-700',
    iconName: 'SlidersHorizontal'
  }
];

export interface SystemModuleConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  enabled?: boolean; // default true
  groupId?: string; // One of: 'dashboards' | 'departments' | 'safety_permits' | 'incidents_compliance' | 'human_capital' | 'workflows' | 'system'
  category?: string;
  descriptionFa?: string;
}

export interface HealthEnvSubItemConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  group: 'health' | 'env';
  enabled?: boolean; // default true
  descriptionFa?: string;
}

export interface FireDeptSubItemConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  type: 'general' | 'category';
  enabled?: boolean; // default true
  descriptionFa?: string;
}

export interface SafetyDeptSubItemConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  group: 'checklists' | 'operations';
  enabled?: boolean; // default true
  descriptionFa?: string;
}

export const ALL_SYSTEM_MODULES: SystemModuleConfig[] = [
  // 1. Dashboards & KPI Analytics
  { key: 'dashboard', titleFa: 'داشبورد جامع مدیریتی', titleEn: 'Unified Executive Dashboard', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'داشبورد اصلی آمار، شاخص‌های کلیدی عملکرد HSE و تحلیل‌های کلی' },
  { key: 'heat', titleFa: 'پایش استرس گرمایی', titleEn: 'Thermal Heat Stress Monitor', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'پایش آنلاین شاخص WBGT، استرس گرمایی محیط و توصیه‌های ایمنی' },
  { key: 'hse-ms', titleFa: 'پایش نرخ رویدادها (TRIR)', titleEn: 'TRIR Incident Rate', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'محاسبه استاندارد نرخ رویدادهای قابل ثبت TRIR و ساعات کارکرد' },
  { key: 'reports', titleFa: 'گزارشات و تحلیل‌های آماری', titleEn: 'Statistical Reports & BI', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'گزارش‌های مدیریتی، نمودارهای تحلیلی و خروجی‌های جامع سیستم' },
  { key: 'ai-assistant', titleFa: 'هوش مصنوعی HSECORE', titleEn: 'HSECORE AI Assistant', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'دستیار مستقل هوش مصنوعی محلی با ۱۰ مشاور تخصصی و استخراج داده‌های زنده سازمان' },

  // 2. Specialized HSE Departments
  { key: 'safety-unit', titleFa: 'واحد ایمنی و بازرسی‌ها', titleEn: 'Safety Operations Department', groupId: 'departments', category: 'دپارتمان‌های تخصصی HSE', enabled: true, descriptionFa: 'مدیریت نظارت بر ایمنی عملیاتی، چک‌لیست‌های تخصصی، ممیزی‌ها و گشت‌های ایمنی' },
  { key: 'fire-dept', titleFa: 'واحد آتش‌نشانی و امداد', titleEn: 'Fire Department & Emergency', groupId: 'departments', category: 'دپارتمان‌های تخصصی HSE', enabled: true, descriptionFa: 'مدیریت ناوگان آتش‌نشانی، تجهیزات اطفاء حریق و مانورهای عملیاتی' },
  { key: 'health-env', titleFa: 'واحد بهداشت و محیط زیست', titleEn: 'Health & Environment Department', groupId: 'departments', category: 'دپارتمان‌های تخصصی HSE', enabled: true, descriptionFa: 'پایش آلاینده‌های محیط زیست، معاینات طب کار و بهداشت حرفه‌ای' },

  // 3. Permits & Risk Control
  { key: 'permit', titleFa: 'پروانه کار ایمن (PTW)', titleEn: 'Permit to Work (PTW)', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'صدور و گردش کار دیجیتال پروانه‌های کار گرم، سرد، حفاری و فضاهای بسته' },
  { key: 'ptw-audit', titleFa: 'ممیزی پروانه‌های کار (PTW Audit)', titleEn: 'Permit to Work Audit System', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'ممیزی جامع و چک‌لیست ۳۰ گانه انطباق سیستم صدور پروانه کار ایمن' },
  { key: 'risk', titleFa: 'ارزیابی ریسک هوشمند (AI JSA)', titleEn: 'AI Risk Assessment (JSA/FMEA)', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'شناسایی خطرات و ارزیابی ریسک با هوش مصنوعی بر اساس JSA / FMEA' },
  { key: 'ppe', titleFa: 'تجهیزات حفاظت فردی (PPE)', titleEn: 'PPE Matrix Management (OSHA)', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'مدیریت تحویل، انقضا و استاندارد تجهیزات حفاظت فردی' },

  // 4. Incidents & Compliance
  { key: 'incidents', titleFa: 'گزارشات ناهنجاری و حوادث', titleEn: 'Safety Incidents & Anomalies', groupId: 'incidents_compliance', category: 'رویدادها و انضباط ایمنی', enabled: true, descriptionFa: 'ثبت و تحلیل شبه‌حوادث، ناهنجاری‌های ایمنی و حوادث شغلی OSHA' },
  { key: 'warnings', titleFa: 'ثبت و پیگیری اخطارها', titleEn: 'Personnel Written Warnings', groupId: 'incidents_compliance', category: 'رویدادها و انضباط ایمنی', enabled: true, descriptionFa: 'ثبت و پیگیری اخطارهای کتبی ایمنی و عدم انطباق‌های پرسنلی' },

  // 5. Human Capital & Training
  { key: 'personnel-history', titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل', titleEn: 'Personnel 360° History Dossier', groupId: 'human_capital', category: 'سرمایه انسانی و آموزش', enabled: true, descriptionFa: 'جستجو و مشاهده پرونده ۳۶۰ درجه پرسنل شامل آموزش‌ها، اخطارها و PPE' },
  { key: 'training', titleFa: 'مدیریت و تقویم آموزش', titleEn: 'Training Management & Calendar', groupId: 'human_capital', category: 'سرمایه انسانی و آموزش', enabled: true, descriptionFa: 'سجلات دوره‌های آموزشی HSE، گواهینامه‌ها و آمار ساعات آموزش' },

  // 6. Workflows & Digital Workplace
  { key: 'documents', titleFa: 'دستورالعمل‌ها و مستندات', titleEn: 'Instructions & Documents', groupId: 'workflows', category: 'کارتابل و فرآیندهای سازمانی', enabled: true, descriptionFa: 'مدیریت جامع دستورالعمل‌ها، روش‌های اجرایی، گواهینامه‌ها و سرتیفیکیت تجهیزات، فرم‌ها و مستندات HSE' },
  { key: 'pending-documents', titleFa: 'کارتابل و اسناد در انتظار اقدام', titleEn: 'Documents Awaiting Action & Sign', groupId: 'workflows', category: 'کارتابل و فرآیندهای سازمانی', enabled: true, descriptionFa: 'کارتابل هوشمند مشاهده، بررسی، تأیید، رد، امضای دیجیتال و ارجاع اسناد و پروانه‌ها' },
  { key: 'non-conformances', titleFa: 'مدیریت عدم انطباق‌ها (CAPA)', titleEn: 'Non-Conformities & CAPA', groupId: 'workflows', category: 'کارتابل و فرآیندهای سازمانی', enabled: true, descriptionFa: 'سامانه جامع ثبت، ارجاع، علل ریشه‌ای و اقدامات اصلاحی و پیشگیرانه کلیه واحدها' },

  // 7. Governance & Administration (مدیریت و پیکربندی سامانه)
  { key: 'process-management', titleFa: 'مدیریت فرآیندها (BPMN)', titleEn: 'Process Management (Camunda 8)', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'طراحی، مدل‌سازی و اجرای فرآیندهای سازمانی و گردش‌کارهای Camunda' },
  { key: 'notifications', titleFa: 'مدیریت هشدار و اعلان‌ها', titleEn: 'Alerts & Notifications Management', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'ارسال هشدار فوری HSE، مشاهده تاریخچه اعلان‌ها و دسترسی به آرشیو و بایگانی اعلان‌های سامانه' },
  { key: 'user-mgmt', titleFa: 'مدیریت کاربران و دسترسی‌ها', titleEn: 'User Management & RBAC Roles', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'مدیریت حساب‌های کاربری، نقش‌ها و ماتریس دسترسی به ماژول‌های سامانه' },
  { key: 'system', titleFa: 'تنظیمات و ساختار سازمانی', titleEn: 'System Settings & Architecture', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'پیکربندی سامانه، مدیریت ساختار سازمانی، لوگو و بازیابی پایگاه داده' },
  { key: 'profile', titleFa: 'شناسنامه و تنظیمات کاربری', titleEn: 'My Personal Profile & Security', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'مشخصات حساب کاربری جاری، تغییر رمز عبور و تنظیمات شخصی' }
];

export const ALL_DOCUMENTS_SUBITEMS = [
  { key: 'ORG_PROCEDURES', titleFa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی', titleEn: 'Organizational Procedures' },
  { key: 'EQUIPMENT_CERTIFICATES', titleFa: 'گواهینامه‌ها و سرتیفیکیت ماشین‌آلات و تجهیزات', titleEn: 'Machinery & Equipment Certificates' },
  { key: 'ORG_FORMS_CHECKLISTS', titleFa: 'فرم‌ها و چک‌لیست‌های سازمانی', titleEn: 'Organizational Forms & Checklists' },
  { key: 'OTHER_HSE_DOCS', titleFa: 'سایر مستندات مرتبط با HSE', titleEn: 'Other HSE Related Documents' },
];

export const ALL_HEALTH_ENV_SUBITEMS: HealthEnvSubItemConfig[] = [
  // Group: Health (بهداشت حرفه‌ای و سلامت)
  { key: 'clinic', titleFa: 'بهداری و مراجعات سرپایی', titleEn: 'Dispensary & Clinic', group: 'health', enabled: true, descriptionFa: 'ثبت و مدیریت مراجعات بهداری، تریاژ، علائم حیاتی، اقدامات درمانی، داروها، استراحت پزشکی و اعزام آمبولانس' },
  { key: 'periodic-exams', titleFa: 'سامانه معاینات ادواری طب کار', titleEn: 'Periodic Medical Exams (Occupational Health)', group: 'health', enabled: true, descriptionFa: 'سامانه جامع معاینات ادواری، پرونده سلامت پرسنل، آزمایشگاه، ماژول BMI، مقایسه سالانه و ورود اکسل' },
  { key: 'non-periodic-exams', titleFa: 'معاینات غیر دوره‌ای', titleEn: 'Non-Periodic Exams', group: 'health', enabled: true, descriptionFa: 'معاینات بدو استخدام، بازگشت به کار و معاینات اختصاصی موردی' },
  { key: 'nutrition', titleFa: 'کارشناس تغذیه و رژیم‌درمانی', titleEn: 'Nutrition Specialist', group: 'health', enabled: true, descriptionFa: 'پایش وضعیت تغذیه، شاخص‌های آنتروپومتریک، عادات غذایی، برنامه‌ها و مشاوره‌های تخصصی پرسنل' },
  { key: 'health-env-checklists', titleFa: 'چک‌لیست‌های عملیاتی بهداشت و محیط زیست', titleEn: 'Operational Health & Environment Checklists', group: 'health', enabled: true, descriptionFa: 'چک‌لیست‌های ۵ گانه: بازدید اماکن و ساختمان‌ها، تسهیلات و آبدارخانه، رستوران، تجهیزات آمبولانس و توالت و دستشویی کارگاه' },
  
  // Group: Environment (محیط‌زیست)
  { key: 'env-dashboard', titleFa: 'داشبورد محیط‌زیست', titleEn: 'Env Dashboard', group: 'env', enabled: true, descriptionFa: 'شاخص‌های کلی عملکرد محیط‌زیستی، آلاینده‌ها و پایش‌های خوداظهاری' },
  { key: 'env-monitoring', titleFa: 'پایش‌های محیط‌زیستی', titleEn: 'Environmental Monitoring', group: 'env', enabled: true, descriptionFa: 'سنجش و مانیتورینگ آنلاین آلاینده‌های هوا، صوت و عوامل محیطی' },
  { key: 'waste-management', titleFa: 'مدیریت پسماند (EMP)', titleEn: 'Waste Management (EMP)', group: 'env', enabled: true, descriptionFa: 'انبارش، انتقال، تفکیک و دفع اصولی پسماندهای صنعتی و خطرناک' },
  { key: 'wastewater', titleFa: 'مدیریت پساب (ETP)', titleEn: 'Wastewater (ETP)', group: 'env', enabled: true, descriptionFa: 'پایش پارامترهای کیفی پساب خروجی تصفیه‌خانه صنعتی و بهداشتی' },
  { key: 'air-water-soil', titleFa: 'پایش دودکش، آب و خاک', titleEn: 'Stacks, Water & Soil', group: 'env', enabled: true, descriptionFa: 'نمونه‌برداری دوره‌ای گازهای دودکش، آب شرب و چاه‌ها و خاک صنعتی' },
  { key: 'five-s', titleFa: 'ساماندهی 5S', titleEn: '5S System', group: 'env', enabled: true, descriptionFa: 'ممیزی نظام آراستگی محیط کار، ۵ اصل پاکیزگی و چک‌لیست‌های دوره‌ای' },
  { key: 'env-reports', titleFa: 'گزارش‌های محیط‌زیست', titleEn: 'Environment Reports', group: 'env', enabled: true, descriptionFa: 'گزارش‌های رسمی سازمان حفاظت محیط‌زیست و خروجی‌های آماری' }
];

export const ALL_FIRE_DEPT_SUBITEMS: FireDeptSubItemConfig[] = [
  { key: 'dashboard', titleFa: 'داشبورد و وضعیت کل', titleEn: 'Overview Dashboard', type: 'general', enabled: true, descriptionFa: 'داشبورد مدیریتی، وضعیت کلی تجهیزات آتش‌نشانی، نقص‌های باز و آمادگی عملیاتی' },
  { key: 'daily-report', titleFa: 'گزارش روزانه آتش‌نشانی', titleEn: 'Daily Station Report', type: 'general', enabled: true, descriptionFa: 'ثبت و پایش گزارش روزانه ایستگاه آتش‌نشانی معین، تجهیزات، سیستم‌های اعلام و اطفاء حریق، گازسنج‌ها و رویدادها' },
  { key: 'vehicles', titleFa: 'مدیریت و بازرسی خودروها', titleEn: 'Fire Vehicles Fleet', type: 'general', enabled: true, descriptionFa: 'ناوگان خودروهای آتش‌نشانی، چک‌لیست‌های روزانه، پمپ، تجهیزات و وضعیت فنی' },
  { key: 'Fire Extinguisher Capsol', titleFa: 'کپسول‌های اطفاء حریق (Fire Extinguisher)', titleEn: 'Fire Extinguisher Capsol', type: 'category', enabled: true, descriptionFa: 'بازرسی کپسول‌های پودر و گاز، CO2، فوم و آب با انقضا و فشارسنج' },
  { key: 'Hydrants & Monitors', titleFa: 'هایدرانت‌ها و مانیتورهای آب/فوم', titleEn: 'Hydrants & Monitors', type: 'category', enabled: true, descriptionFa: 'پایش فشار، روغن‌کاری، تست هیدرواستاتیک و کارایی هایدرانت‌ها و مانیتورها' },
  { key: 'Fire Boxs', titleFa: 'جعبه‌های هوزریل و هوزباکس آتش‌نشانی', titleEn: 'Fire Boxes & Hose Reels', type: 'category', enabled: true, descriptionFa: 'بررسی شیلنگ‌های برزنتی، نازل‌ها، هوزریل و شیرآلات جعبه‌های اطفاء حریق' },
  { key: 'Foam Pakages', titleFa: 'پکیج‌ها و مخازن فوم اطفاء حریق', titleEn: 'Foam Packages & Proportioners', type: 'category', enabled: true, descriptionFa: 'کنترل سطح کنسانتره فوم، اینداکتورها، تناسب‌سازها و سیستم‌های فومینگ' },
  { key: 'FM 200', titleFa: 'سیستم‌های اطفاء گازی پاک FM 200', titleEn: 'FM 200 Clean Agent Systems', type: 'category', enabled: true, descriptionFa: 'سیستم‌های اطفاء حریق اتاق‌های سرور، کنترل‌روم و سیلندرهای گازی FM200' },
  { key: 'دليج ولواسپرينكلرon,off ولو', titleFa: 'دلویج ولو، اسپرینکلر و شیرهای On/Off', titleEn: 'Deluge, Sprinklers & On/Off Valves', type: 'category', enabled: true, descriptionFa: 'شیرهای سیلابی دلویج، شبکه‌های اسپرینکلر اتوماتیک و تست اکچویتورها' },
  { key: 'گازيابها', titleFa: 'گازیاب‌ها و دتکتورهای ثابت و پرتابل', titleEn: 'Fixed & Portable Gas Detectors', type: 'category', enabled: true, descriptionFa: 'کالیبراسیون و بررسی عملکرد سنسورهای LEL، H2S، O2 و CO' },
  { key: 'دوش و چشم شوی اضطراری', titleFa: 'دوش و چشم‌شوی‌های اضطراری ایمنی', titleEn: 'Emergency Eyewash & Safety Showers', type: 'category', enabled: true, descriptionFa: 'تست جریان آب، فشار، اهرم‌های فعال‌سازی و شستشوی اضطراری' }
];

export const ALL_SAFETY_DEPT_SUBITEMS: SafetyDeptSubItemConfig[] = [
  { key: 'dashboard', titleFa: 'داشبورد واحد ایمنی', titleEn: 'Overview Dashboard', group: 'operations', enabled: true, descriptionFa: 'داشبورد جامع نظارت، شاخص‌های انطباق بازرسی‌ها و نواقص باز ایمنی' },
  { key: 'checklists', titleFa: 'سوابق و اجرای بازرسی', titleEn: 'Execution & History', group: 'checklists', enabled: true, descriptionFa: 'ثبت، مدیریت، سوابق و ممیزی‌های میدانی بازرسی‌ها و چک‌لیست‌های تخصصی' },
];

export const STORAGE_KEY = 'hse_ui_config_v3';
export const PREV_STORAGE_KEY = 'hse_ui_config_v2';
export const LEGACY_STORAGE_KEY = 'hse_ui_config';
export const STORAGE_KEY_HEALTH_ENV = 'hse_health_env_ui_config';
export const STORAGE_KEY_FIRE_DEPT = 'hse_fire_dept_ui_config';
export const STORAGE_KEY_SAFETY_DEPT = 'hse_safety_dept_ui_config';

let memoryUiConfig: SystemModuleConfig[] | null = null;
let memoryHealthEnvConfig: HealthEnvSubItemConfig[] | null = null;
let memoryFireDeptConfig: FireDeptSubItemConfig[] | null = null;
let memorySafetyDeptConfig: SafetyDeptSubItemConfig[] | null = null;

export async function syncModuleConfigsFromDb(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const [uiCfg, healthCfg, fireCfg, safetyCfg] = await Promise.all([
      apiDb.getSetting(STORAGE_KEY).catch(() => null),
      apiDb.getSetting(STORAGE_KEY_HEALTH_ENV).catch(() => null),
      apiDb.getSetting(STORAGE_KEY_FIRE_DEPT).catch(() => null),
      apiDb.getSetting(STORAGE_KEY_SAFETY_DEPT).catch(() => null),
    ]);

    if (Array.isArray(uiCfg) && uiCfg.length > 0) {
      memoryUiConfig = uiCfg;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(uiCfg)); } catch {}
      window.dispatchEvent(new Event('hse_ui_config_updated'));
    } else if (uiCfg === null) {
      const localUi = localStorage.getItem(STORAGE_KEY);
      if (localUi) {
        try {
          const parsed = JSON.parse(localUi);
          if (Array.isArray(parsed) && parsed.length > 0) {
            apiDb.saveSetting(STORAGE_KEY, parsed, 'System Navigation Modules Config').catch(() => {});
          }
        } catch {}
      }
    }

    if (Array.isArray(healthCfg) && healthCfg.length > 0) {
      memoryHealthEnvConfig = healthCfg;
      try { localStorage.setItem(STORAGE_KEY_HEALTH_ENV, JSON.stringify(healthCfg)); } catch {}
      window.dispatchEvent(new Event('health_env_config_updated'));
    }

    if (Array.isArray(fireCfg) && fireCfg.length > 0) {
      memoryFireDeptConfig = fireCfg;
      try { localStorage.setItem(STORAGE_KEY_FIRE_DEPT, JSON.stringify(fireCfg)); } catch {}
      window.dispatchEvent(new Event('fire_dept_config_updated'));
    }

    if (Array.isArray(safetyCfg) && safetyCfg.length > 0) {
      memorySafetyDeptConfig = safetyCfg;
      try { localStorage.setItem(STORAGE_KEY_SAFETY_DEPT, JSON.stringify(safetyCfg)); } catch {}
      window.dispatchEvent(new Event('safety_dept_config_updated'));
    }
  } catch (err) {
    console.warn('Failed to hydrate module configs from database:', err);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncModuleConfigsFromDb();
  }, 150);

  const handleRemoteConfigMutation = (e: any) => {
    const key = String(e?.detail?.key || e?.detail?.entityType || '');
    if (
      key === STORAGE_KEY ||
      key === STORAGE_KEY_HEALTH_ENV ||
      key === STORAGE_KEY_FIRE_DEPT ||
      key === STORAGE_KEY_SAFETY_DEPT ||
      key === 'settings'
    ) {
      syncModuleConfigsFromDb();
    }
  };
  window.addEventListener('app_data_mutated', handleRemoteConfigMutation);
  window.addEventListener('hse_data_mutated', handleRemoteConfigMutation);
}

/**
 * Merges saved user UI layout with all available system modules automatically.
 * Defaults strictly to the authoritative navigation menu grouping.
 */
export function getMergedUiConfig(): SystemModuleConfig[] {
  try {
    let parsed: SystemModuleConfig[] | null = memoryUiConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_SYSTEM_MODULES.map(m => ({ ...m }));
    }

    const mergedList: SystemModuleConfig[] = [];
    const validGroupIds = new Set(SYSTEM_MODULE_GROUPS.map(g => g.id));

    // 1. Preserve saved modules in their stored order and customized properties
    parsed.forEach(savedItem => {
      const sysModule = ALL_SYSTEM_MODULES.find(m => m.key === savedItem.key);
      if (sysModule) {
        let resolvedGroupId = savedItem.groupId;
        if (!resolvedGroupId || !validGroupIds.has(resolvedGroupId) || resolvedGroupId === 'safety') {
          resolvedGroupId = sysModule.groupId || 'dashboards';
        }

        mergedList.push({
          key: sysModule.key,
          titleFa: savedItem.titleFa || sysModule.titleFa,
          titleEn: savedItem.titleEn || sysModule.titleEn,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          groupId: sysModule.groupId || resolvedGroupId,
          category: sysModule.category,
          descriptionFa: sysModule.descriptionFa
        });
      }
    });

    // 2. Automatically discover and append ANY new system module missing from saved config
    ALL_SYSTEM_MODULES.forEach(sysModule => {
      if (!mergedList.some(item => item.key === sysModule.key)) {
        mergedList.push({
          key: sysModule.key,
          titleFa: sysModule.titleFa,
          titleEn: sysModule.titleEn,
          enabled: true,
          groupId: sysModule.groupId || 'dashboards',
          category: sysModule.category,
          descriptionFa: sysModule.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading merged UI config:', err);
    return ALL_SYSTEM_MODULES.map(m => ({ ...m }));
  }
}

/**
 * Saves updated module list to central database and local cache
 */
export function saveUiConfig(modules: SystemModuleConfig[]): boolean {
  try {
    memoryUiConfig = modules;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
    apiDb.saveSetting(STORAGE_KEY, modules, 'System Navigation Modules Config').catch(() => {});
    window.dispatchEvent(new Event('hse_ui_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save UI config:', err);
    return false;
  }
}

/**
 * Resets UI layout configuration to default in both local cache and central database
 */
export function resetUiConfig(): void {
  try {
    memoryUiConfig = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREV_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    apiDb.saveSetting(STORAGE_KEY, [], 'Reset System Navigation Modules Config').catch(() => {});
    window.dispatchEvent(new Event('hse_ui_config_updated'));
  } catch (e) {
    console.error('Failed to reset UI config', e);
  }
}

/**
 * Merges saved Health & Environment sub-item layout with defaults
 */
export function getMergedHealthEnvConfig(): HealthEnvSubItemConfig[] {
  try {
    let parsed: HealthEnvSubItemConfig[] | null = memoryHealthEnvConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY_HEALTH_ENV);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_HEALTH_ENV_SUBITEMS.map(m => ({ ...m }));
    }

    const mergedList: HealthEnvSubItemConfig[] = [];

    parsed.forEach(savedItem => {
      const defaultItem = ALL_HEALTH_ENV_SUBITEMS.find(m => m.key === savedItem.key);
      if (defaultItem) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: savedItem.titleFa || defaultItem.titleFa,
          titleEn: savedItem.titleEn || defaultItem.titleEn,
          group: defaultItem.group,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    ALL_HEALTH_ENV_SUBITEMS.forEach(defaultItem => {
      if (!mergedList.some(item => item.key === defaultItem.key)) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: defaultItem.titleFa,
          titleEn: defaultItem.titleEn,
          group: defaultItem.group,
          enabled: true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading Health & Env config:', err);
    return ALL_HEALTH_ENV_SUBITEMS.map(m => ({ ...m }));
  }
}

export function saveHealthEnvConfig(items: HealthEnvSubItemConfig[]): boolean {
  try {
    memoryHealthEnvConfig = items;
    localStorage.setItem(STORAGE_KEY_HEALTH_ENV, JSON.stringify(items));
    apiDb.saveSetting(STORAGE_KEY_HEALTH_ENV, items, 'Health & Env Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('health_env_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save Health & Env config:', err);
    return false;
  }
}

export function resetHealthEnvConfig(): void {
  try {
    memoryHealthEnvConfig = null;
    localStorage.removeItem(STORAGE_KEY_HEALTH_ENV);
    apiDb.saveSetting(STORAGE_KEY_HEALTH_ENV, [], 'Reset Health & Env Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('health_env_config_updated'));
  } catch (err) {
    console.error('Failed to reset Health & Env config:', err);
  }
}

/**
 * Merges saved Fire Department sub-item layout with defaults
 */
export function getMergedFireDeptConfig(): FireDeptSubItemConfig[] {
  try {
    let parsed: FireDeptSubItemConfig[] | null = memoryFireDeptConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY_FIRE_DEPT);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_FIRE_DEPT_SUBITEMS.map(m => ({ ...m }));
    }

    const mergedList: FireDeptSubItemConfig[] = [];

    parsed.forEach(savedItem => {
      const defaultItem = ALL_FIRE_DEPT_SUBITEMS.find(m => m.key === savedItem.key);
      if (defaultItem) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: savedItem.titleFa || defaultItem.titleFa,
          titleEn: savedItem.titleEn || defaultItem.titleEn,
          type: defaultItem.type,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    ALL_FIRE_DEPT_SUBITEMS.forEach(defaultItem => {
      if (!mergedList.some(item => item.key === defaultItem.key)) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: defaultItem.titleFa,
          titleEn: defaultItem.titleEn,
          type: defaultItem.type,
          enabled: true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading Fire Dept config:', err);
    return ALL_FIRE_DEPT_SUBITEMS.map(m => ({ ...m }));
  }
}

export function saveFireDeptConfig(items: FireDeptSubItemConfig[]): boolean {
  try {
    memoryFireDeptConfig = items;
    localStorage.setItem(STORAGE_KEY_FIRE_DEPT, JSON.stringify(items));
    apiDb.saveSetting(STORAGE_KEY_FIRE_DEPT, items, 'Fire Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('fire_dept_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save Fire Dept config:', err);
    return false;
  }
}

export function resetFireDeptConfig(): void {
  try {
    memoryFireDeptConfig = null;
    localStorage.removeItem(STORAGE_KEY_FIRE_DEPT);
    apiDb.saveSetting(STORAGE_KEY_FIRE_DEPT, [], 'Reset Fire Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('fire_dept_config_updated'));
  } catch (err) {
    console.error('Failed to reset Fire Dept config:', err);
  }
}

/**
 * Merges saved Safety Department sub-item layout with defaults
 */
export function getMergedSafetyDeptConfig(): SafetyDeptSubItemConfig[] {
  try {
    let parsed: SafetyDeptSubItemConfig[] | null = memorySafetyDeptConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY_SAFETY_DEPT);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_SAFETY_DEPT_SUBITEMS.map(m => ({ ...m }));
    }

    const mergedList: SafetyDeptSubItemConfig[] = [];

    parsed.forEach(savedItem => {
      const defaultItem = ALL_SAFETY_DEPT_SUBITEMS.find(m => m.key === savedItem.key);
      if (defaultItem) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: savedItem.titleFa || defaultItem.titleFa,
          titleEn: savedItem.titleEn || defaultItem.titleEn,
          group: defaultItem.group,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    ALL_SAFETY_DEPT_SUBITEMS.forEach(defaultItem => {
      if (!mergedList.some(item => item.key === defaultItem.key)) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: defaultItem.titleFa,
          titleEn: defaultItem.titleEn,
          group: defaultItem.group,
          enabled: true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading Safety Dept config:', err);
    return ALL_SAFETY_DEPT_SUBITEMS.map(m => ({ ...m }));
  }
}

export function saveSafetyDeptConfig(items: SafetyDeptSubItemConfig[]): boolean {
  try {
    memorySafetyDeptConfig = items;
    localStorage.setItem(STORAGE_KEY_SAFETY_DEPT, JSON.stringify(items));
    apiDb.saveSetting(STORAGE_KEY_SAFETY_DEPT, items, 'Safety Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('safety_dept_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save Safety Dept config:', err);
    return false;
  }
}

export function resetSafetyDeptConfig(): void {
  try {
    memorySafetyDeptConfig = null;
    localStorage.removeItem(STORAGE_KEY_SAFETY_DEPT);
    apiDb.saveSetting(STORAGE_KEY_SAFETY_DEPT, [], 'Reset Safety Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('safety_dept_config_updated'));
  } catch (err) {
    console.error('Failed to reset Safety Dept config:', err);
  }
}


