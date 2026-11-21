import {
  UserPermissions,
  UserProfile,
  Department,
  AuditLogEntry,
  NotificationEntry,
  PermissionGroup,
  PermissionActions,
  HierarchicalActionKey,
  HierarchicalPermissionNode,
  HierarchicalPermissionActions,
  ActorType,
  ActionType,
  AuditLogChange,
  AuditCategory,
  AuditSeverity
} from '../types';
import { apiDb } from '../services/apiDatabaseClient';
import { getComplexPersonnelList } from './personnelHelper';
import {
  classifyAuditEvent,
  getActiveSessionId,
  resolveCurrentModuleInfo,
  formatBrowserSummary,
  initGlobalAuditObserver,
} from './auditEngine';
import moment from 'moment-jalaali';

export interface PermissionModuleMeta {
  id: PermissionGroup;
  titleFa: string;
  titleEn: string;
  category: 'dashboards' | 'departments' | 'safety' | 'processes' | 'system';
  categoryTitleFa: string;
  categoryTitleEn: string;
  iconName: string;
  descriptionFa: string;
}

export const PERMISSION_MODULES_REGISTRY: PermissionModuleMeta[] = [
  // 1. Dashboards & Analytics
  {
    id: 'Dashboard',
    titleFa: 'داشبورد جامع مدیریتی',
    titleEn: 'Unified Executive Dashboard',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و شاخص‌های کلیدی',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'LayoutDashboard',
    descriptionFa: 'دسترسی به داشبورد اصلی، وضعیت عمومی HSE، تحلیل‌ها و شاخص‌های کلان'
  },
  {
    id: 'Heat Stress',
    titleFa: 'پایش استرس گرمایی (WBGT)',
    titleEn: 'Thermal Heat Stress Monitor',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و شاخص‌های کلیدی',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'SunMedium',
    descriptionFa: 'پایش آنلاین شاخص‌های اقلیمی، هشدار گرمازدگی، جدول استراحت/کار و توصیه‌های ایمنی'
  },
  {
    id: 'TRIR Incident Rate',
    titleFa: 'پایش نرخ رویدادها (TRIR / HSECORE)',
    titleEn: 'TRIR & Incident Rate Analytics',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و شاخص‌های کلیدی',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'Activity',
    descriptionFa: 'تحلیل شاخص استاندارد OSHA TRIR، نرخ شدت و تکرار رویدادها و نفرساعت کارکرد'
  },
  {
    id: 'Statistics',
    titleFa: 'آمار، تحلیل‌ها و شاخص‌های تحلیلی',
    titleEn: 'Statistical BI & KPI Analytics',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و شاخص‌های کلیدی',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'BarChart3',
    descriptionFa: 'نمودارهای آماری، تحلیل روندهای ایمنی و شاخص‌های پیشرو و پسرو HSE'
  },
  {
    id: 'HSECORE AI',
    titleFa: 'دستیار هوشمند HSECORE AI',
    titleEn: 'HSECORE AI Assistant',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و شاخص‌های کلیدی',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'Bot',
    descriptionFa: 'دسترسی به دستیار مستقل هوش مصنوعی محلی با ۱۰ مشاور تخصصی و پایگاه دانش RAG'
  },

  // 2. Specialized HSE Departments
  {
    id: 'Safety Unit',
    titleFa: 'واحد ایمنی صنعتی و چک‌لیست‌ها',
    titleEn: 'Industrial Safety Department',
    category: 'departments',
    categoryTitleFa: 'واحدهای تخصصی و عملیاتی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'ShieldAlert',
    descriptionFa: 'نظارت بر ایمنی عملیاتی، چک‌لیست‌های تخصصی (داربست، جرثقیل، گودبرداری، برق و...) و گشت‌ها'
  },
  {
    id: 'Fire Department',
    titleFa: 'واحد آتش‌نشانی و تجهیزات اطفاء',
    titleEn: 'Fire Department & Fleet',
    category: 'departments',
    categoryTitleFa: 'واحدهای تخصصی و عملیاتی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Flame',
    descriptionFa: 'مدیریت ناوگان خودروهای آتش‌نشانی، کپسول‌ها، هایدرانت‌ها، سیستم‌های FM200 و گزارش ایستگاه'
  },
  {
    id: 'Health & Environment',
    titleFa: 'واحد بهداشت و محیط زیست',
    titleEn: 'Health & Environmental Unit',
    category: 'departments',
    categoryTitleFa: 'واحدهای تخصصی و عملیاتی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Leaf',
    descriptionFa: 'پایش آنلاین آلاینده‌های هوا، پساب صنعتی، مدیریت پسماند EMP، نظام 5S و عدم‌انطباق‌ها'
  },
  {
    id: 'Periodic Medical Exams',
    titleFa: 'سامانه معاینات ادواری طب کار',
    titleEn: 'Periodic Medical Exams (Occ. Health)',
    category: 'departments',
    categoryTitleFa: 'واحدهای تخصصی و عملیاتی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Stethoscope',
    descriptionFa: 'پرونده سلامت پرسنل، آزمایشات بیوشیمی و ادرار، اسپیرومتری، اودیوگرام و ماژول ارزیابی BMI'
  },

  // 3. Safety Operations, Permits & Risk
  {
    id: 'PSM',
    titleFa: 'مدیریت استقرار ایمنی فرایند (PSM)',
    titleEn: 'Process Safety Management (PSM)',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'Layers',
    descriptionFa: 'مدیریت جامع پروژه استقرار و بلوغ ایمنی فرایند (۲۰ عنصر CCPS RBPS و ۱۴ الزام OSHA 1910.119) ویژه پتروشیمی رجال'
  },
  {
    id: 'Permit To Work',
    titleFa: 'پروانه کار ایمن (PTW)',
    titleEn: 'Permit To Work (PTW System)',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'FileCheck',
    descriptionFa: 'گردش کار دیجیتال صدور، تمدید و ابطال مجوزهای کار گرم، سرد، فضای بسته و تشعشع'
  },
  {
    id: 'PTW Audit',
    titleFa: 'ممیزی پروانه کار (PTW Audit)',
    titleEn: 'PTW Compliance Audit (30 Items)',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'CheckCheck',
    descriptionFa: 'ممیزی جامع و چک‌لیست ۳۰ گانه انطباق پروانه‌های کار و نظارت بر شرایط ایمن اجرای کار'
  },
  {
    id: 'Incidents',
    titleFa: 'ثبت حوادث و ناهنجاری‌ها',
    titleEn: 'Incidents & Anomalies System',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'AlertTriangle',
    descriptionFa: 'ثبت شبه‌حوادث، ناهنجاری‌های ایمنی، حوادث شغلی OSHA و تعیین اقدامات اصلاحی CAPA'
  },
  {
    id: 'Non-Conformances',
    titleFa: 'مدیریت عدم انطباق‌ها (CAPA)',
    titleEn: 'Non-Conformities & CAPA Management',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'ShieldAlert',
    descriptionFa: 'سامانه جامع ثبت، ارجاع، علل ریشه‌ای، اقدامات اصلاحی و پیشگیرانه و ردیابی اثربخشی CAPA'
  },
  {
    id: 'PPE',
    titleFa: 'تجهیزات حفاظت فردی (PPE)',
    titleEn: 'PPE Management (OSHA)',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'HardHat',
    descriptionFa: 'ماتریس استحقاق تحویل تجهیزات، کارتکس فردی، انقضا و استانداردهای کیفی PPE'
  },
  {
    id: 'Risk Assessment',
    titleFa: 'ارزیابی ریسک هوشمند (JSA / FMEA)',
    titleEn: 'AI Risk Assessment (JSA/FMEA)',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'Zap',
    descriptionFa: 'شناسایی خطرات، ارزیابی کمی ریسک ماتریسی، دستورالعمل‌های کنترلی با هوش مصنوعی'
  },
  {
    id: 'Lifting Plan',
    titleFa: 'مدیریت و مهندسی عملیات باربرداری (Lifting Plan)',
    titleEn: 'Lifting Plan Management & Engineering',
    category: 'safety',
    categoryTitleFa: 'عملیات ایمنی، پروانه‌های کار و ریسک',
    categoryTitleEn: 'Safety Operations & Risk',
    iconName: 'Anchor',
    descriptionFa: 'طراحی مهندسی و محاسبات ASME/WRC، مدل‌سازی سه‌بعدی، Load Chart، ریگینگ و گردش کار عملیات باربرداری'
  },

  // 4. Personnel History, Training & Records
  {
    id: 'Personnel 360',
    titleFa: 'سوابق و شناسنامه جامع پرسنل ۳۶۰°',
    titleEn: 'Personnel 360° Comprehensive Records',
    category: 'processes',
    categoryTitleFa: 'سوابق پرسنلی، آموزش و فرآیندها',
    categoryTitleEn: 'Records, Training & Processes',
    iconName: 'UserCheck',
    descriptionFa: 'مشاهده پرونده کامل پرسنل شامل گواهی‌ها، سجل آموزشی، اخطارها، PPE و معاینات طب کار'
  },
  {
    id: 'Training',
    titleFa: 'مدیریت آموزش و گواهینامه‌ها',
    titleEn: 'HSE Training & Certification',
    category: 'processes',
    categoryTitleFa: 'سوابق پرسنلی، آموزش و فرآیندها',
    categoryTitleEn: 'Records, Training & Processes',
    iconName: 'GraduationCap',
    descriptionFa: 'برنامه‌ریزی دوره‌های آموزشی HSE، ثبت نمرات، صدور گواهینامه‌ها و آمار سرانه آموزش'
  },
  {
    id: 'Safety Warnings',
    titleFa: 'ثبت و مدیریت اخطارهای کتبی',
    titleEn: 'Safety Written Warnings & Non-Compliance',
    category: 'processes',
    categoryTitleFa: 'سوابق پرسنلی، آموزش و فرآیندها',
    categoryTitleEn: 'Records, Training & Processes',
    iconName: 'FileWarning',
    descriptionFa: 'صدور اخطار کتبی عدم رعایت مقررات ایمنی، پیگیری سوابق تخلفات و اقدامات انضباطی'
  },
  {
    id: 'Reports',
    titleFa: 'گزارش‌گیری جامع و خروجی‌ها',
    titleEn: 'Statistical Reports & Records',
    category: 'processes',
    categoryTitleFa: 'سوابق پرسنلی، آموزش و فرآیندها',
    categoryTitleEn: 'Records, Training & Processes',
    iconName: 'FileText',
    descriptionFa: 'صدور گزارش‌های دوره‌ای، گزارشات مقایسه‌ای ماهانه و فصلی HSE مجتمع'
  },
  {
    id: 'Documents',
    titleFa: 'دستورالعمل‌ها و مستندات',
    titleEn: 'Instructions & Documents',
    category: 'processes',
    categoryTitleFa: 'سوابق پرسنلی، آموزش و فرآیندها',
    categoryTitleEn: 'Records, Training & Processes',
    iconName: 'FolderOpen',
    descriptionFa: 'مشاهده، بارگذاری، ویرایش، جایگزینی نسخه، آرشیو و حذف دستورالعمل‌ها، گواهینامه‌های تجهیزات و مستندات HSE'
  },

  // 5. System Administration, Data & Security
  {
    id: 'User Management',
    titleFa: 'مدیریت کاربران و سطوح دسترسی (RBAC)',
    titleEn: 'User & Access Matrix (RBAC)',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Users',
    descriptionFa: 'تعریف کاربران، انتساب نقش‌ها، مدیریت ماتریس مجوزها و سیاست‌های رمز عبور'
  },
  {
    id: 'Org Structure',
    titleFa: 'ساختار و چارت سازمانی مجتمع',
    titleEn: 'Organizational Structure & Hierarchy',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Network',
    descriptionFa: 'پیکربندی چارت سازمانی درختی، دپارتمان‌ها، واحدها و پست‌های تخصصی'
  },
  {
    id: 'UI Config & Branding',
    titleFa: 'شخصی‌سازی رابط و لوگوی رسمی',
    titleEn: 'UI Customization & Branding',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Palette',
    descriptionFa: 'مدیریت لوگو و آرم رسمی سامانه، تنظیمات نمایش منوها و شخصی‌سازی ظاهر'
  },
  {
    id: 'Process Management',
    titleFa: 'مدیریت فرآیندها (BPMN / Camunda)',
    titleEn: 'Process Management (BPMN Camunda)',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Workflow',
    descriptionFa: 'طراحی، مدل‌سازی بصری و نظارت بر اجرای گردش‌کارهای فرآیندی و تسک‌های سازمانی'
  },
  {
    id: 'Database Backup',
    titleFa: 'پشتیبان‌گیری و بازیابی پایگاه داده',
    titleEn: 'Database Backup & Restore',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Database',
    descriptionFa: 'تهیه نسخه پشتیبان ابری/محلی، بازگردانی اطلاعات و مدیریت سلامت دیتابیس'
  },
  {
    id: 'Audit Logs',
    titleFa: 'لاگ امنیتی و ممیزی رویدادها',
    titleEn: 'Security Audit Trails & Logs',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'ShieldCheck',
    descriptionFa: 'ثبت جامع ردپای فعالیت کاربران، تغییرات داده‌ها، لاگ‌های ورود و ممیزی امنیتی'
  },
  {
    id: 'Notifications',
    titleFa: 'مرکز مخابره اعلانات و هشدارها',
    titleEn: 'Broadcast & Emergency Notifications',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Bell',
    descriptionFa: 'ارسال پیام‌ها و هشدارهای اضطراری عمومی یا اختصاصی به پرسنل و واحدها'
  },
  {
    id: 'API & Webhooks',
    titleFa: 'مدیریت سرویس‌ها و وب‌هوک‌ها',
    titleEn: 'API Services & Webhooks',
    category: 'system',
    categoryTitleFa: 'مدیریت سامانه، داده‌ها و امنیت',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Globe',
    descriptionFa: 'تنظیم وب‌هوک‌های لحظه‌ای برای رویدادهای ایمنی، پروانه‌ها و استرس گرمایی'
  }
];

export const HIERARCHICAL_ACTION_LABELS: Record<HierarchicalActionKey, { titleFa: string; titleEn: string; descFa: string; descEn: string }> = {
  view: { titleFa: 'مشاهده', titleEn: 'View', descFa: 'دسترسی به صفحه و مشاهده فهرست رکوردهای ماژول', descEn: 'Access screen and view record listing' },
  details: { titleFa: 'جزئیات', titleEn: 'Details', descFa: 'مشاهده پرونده تفصیلی، شواهد و اطلاعات جامع', descEn: 'View full dossier, records and evidence' },
  create: { titleFa: 'ایجاد', titleEn: 'Create', descFa: 'ثبت، صدور و ایجاد فرم یا سند جدید', descEn: 'Register, issue and create new records' },
  edit: { titleFa: 'ویرایش', titleEn: 'Edit', descFa: 'ویرایش و اصلاح اطلاعات، فرم‌ها و رکوردهای موجود', descEn: 'Edit existing records and details' },
  delete: { titleFa: 'حذف', titleEn: 'Delete', descFa: 'حذف فیزیکی، بایگانی یا ابطال رکوردها', descEn: 'Delete, void or remove records' },
  approve: { titleFa: 'تأیید', titleEn: 'Approve', descFa: 'تأیید نهایی، پاراف مدیریتی و صحه‌گذاری', descEn: 'Final approval, sign-off and verification' },
  reject: { titleFa: 'رد', titleEn: 'Reject', descFa: 'رد درخواست و بازگشت به مرحله قبلی با ذکر دلیل', descEn: 'Reject request with mandatory audit remarks' },
  sign: { titleFa: 'امضا', titleEn: 'Sign', descFa: 'امضای رسمی دیجیتال پروانه‌ها، چک‌لیست‌ها و اسناد', descEn: 'Official digital signature stamping' },
  refer: { titleFa: 'ارجاع', titleEn: 'Refer', descFa: 'ارجاع در کارتابل و تغییر مسئول اقدام سند', descEn: 'Forward / transfer task in document cartable' },
  export: { titleFa: 'خروجی', titleEn: 'Export', descFa: 'دریافت خروجی گزارش به فرمت اکسل و PDF', descEn: 'Download Excel and PDF exports' },
  print: { titleFa: 'چاپ', titleEn: 'Print', descFa: 'صدور فرم چاپی استاندارد و پرینت مستقیم', descEn: 'Print formal document forms' },
  import: { titleFa: 'ورودی', titleEn: 'Import', descFa: 'ورود گروهی فایل و اکسل به پایگاه داده', descEn: 'Batch excel / file import' },
  emergency: { titleFa: 'آژیر/هشدار', titleEn: 'Emergency', descFa: 'مخابره آژیر اضطراری و هشدار فوری HSE با صدا', descEn: 'Broadcast emergency siren with sound and popup' },
  configure: { titleFa: 'پیکربندی', titleEn: 'Config', descFa: 'تنظیمات تخصصی، قالب‌ها، فیلدهای پویا و پارامترها', descEn: 'Configure custom templates, dynamic fields & setup' }
};

export const HIERARCHICAL_PERMISSION_NODES: HierarchicalPermissionNode[] = [
  // 1. Dashboards & Analytics
  {
    id: 'dashboards.executive',
    legacyId: 'Dashboard',
    titleFa: 'داشبورد جامع مدیریتی',
    titleEn: 'Unified Executive Dashboard',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و تحلیل‌های آماری',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'LayoutDashboard',
    descriptionFa: 'دسترسی به داشبورد اصلی، وضعیت عمومی HSE، شاخص‌های عملکردی و نمودارها',
    level: 1,
    applicableActions: ['view', 'details', 'export', 'print']
  },
  {
    id: 'dashboards.heat_stress',
    legacyId: 'Heat Stress',
    titleFa: 'پایش استرس گرمایی (WBGT)',
    titleEn: 'Thermal Heat Stress Monitor',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و تحلیل‌های آماری',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'SunMedium',
    descriptionFa: 'پایش آنلاین شاخص‌های اقلیمی، جدول استراحت/کار، ارسال اخطار و تحلیل WBGT',
    level: 1,
    applicableActions: ['view', 'details', 'export', 'print', 'emergency', 'configure']
  },
  {
    id: 'dashboards.trir',
    legacyId: 'TRIR Incident Rate',
    titleFa: 'پایش نرخ رویدادها (TRIR / OSHA)',
    titleEn: 'TRIR & Incident Rate Analytics',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و تحلیل‌های آماری',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'Activity',
    descriptionFa: 'تحلیل شاخص استاندارد OSHA TRIR، نرخ شدت و تکرار رویدادها و نفرساعت کارکرد',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'export', 'print']
  },
  {
    id: 'dashboards.statistics',
    legacyId: 'Statistics',
    titleFa: 'آمار، تحلیل‌ها و شاخص‌های تحلیلی',
    titleEn: 'Statistical BI & KPI Analytics',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و تحلیل‌های آماری',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'BarChart3',
    descriptionFa: 'نمودارهای آماری، تحلیل روندهای ایمنی و شاخص‌های پیشرو و پسرو',
    level: 1,
    applicableActions: ['view', 'details', 'export', 'print']
  },
  {
    id: 'dashboards.ai_assistant',
    legacyId: 'HSECORE AI',
    titleFa: 'دستیار هوشمند HSECORE AI',
    titleEn: 'HSECORE AI Assistant',
    category: 'dashboards',
    categoryTitleFa: 'داشبوردها و تحلیل‌های آماری',
    categoryTitleEn: 'Dashboards & KPI Analytics',
    iconName: 'Bot',
    descriptionFa: 'تعامل با ۱۰ مشاور تخصصی هوش مصنوعی HSE، تحلیل اسناد و جستجوی پایگاه دانش سازمانی',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'export', 'print', 'configure']
  },

  // 2. Specialized HSE Departments
  // 2.1 Safety Department
  {
    id: 'safety_dept.dashboard',
    legacyId: 'Safety Unit',
    parentId: 'safety_dept',
    titleFa: 'واحد ایمنی: داشبورد نظارت و شاخص‌ها',
    titleEn: 'Safety Dept: Overview & Analytics',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'ShieldAlert',
    descriptionFa: 'داشبورد جامع نظارت بر وضعیت بازرسی‌ها، نواقص باز و شاخص‌های انطباق',
    level: 2,
    applicableActions: ['view', 'details', 'export', 'print']
  },
  {
    id: 'safety_dept.checklists',
    legacyId: 'Safety Unit',
    parentId: 'safety_dept',
    titleFa: 'واحد ایمنی: سوابق و اجرای بازرسی و چک‌لیست‌ها',
    titleEn: 'Safety Dept: Inspection Checklists Execution',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'ClipboardCheck',
    descriptionFa: 'ثبت، بازرسی میدانی، ممیزی، الصاق تصاویر و امضای چک‌لیست‌های تخصصی ایمنی',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'sign', 'export', 'print']
  },
  {
    id: 'safety_dept.templates',
    legacyId: 'Safety Unit',
    parentId: 'safety_dept',
    titleFa: 'واحد ایمنی: مدیریت قالب‌ها و سوالات چک‌لیست',
    titleEn: 'Safety Dept: Templates & Question Manager',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Sliders',
    descriptionFa: 'تعریف و ویرایش قالب‌های چک‌لیست ایمنی و اوزان سوالات و انحرافات',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'configure']
  },

  // 2.2 Fire Department
  {
    id: 'fire_dept.shift_report',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: ایستگاه و گزارشات شیفت روزانه',
    titleEn: 'Fire Dept: Station Daily Shift Reports',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Flame',
    descriptionFa: 'ثبت گزارش وقایع شیفت، حاضرین ایستگاه، تست تجهیزات و آماده‌بکوشی ناوگان',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'sign', 'export', 'print']
  },
  {
    id: 'fire_dept.fleet',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: مدیریت ناوگان و خودروها',
    titleEn: 'Fire Dept: Emergency Fleet & Vehicles',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Truck',
    descriptionFa: 'ثبت، چک‌لیست فنی، آبگیری و وضعیت عملیاتی خودروهای آتش‌نشانی و پیشرو',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },
  {
    id: 'fire_dept.extinguishers',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: خاموش‌کننده‌ها و کپسول‌های اطفاء',
    titleEn: 'Fire Dept: Fire Extinguishers Matrix',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Flame',
    descriptionFa: 'شناسنامه کپسول‌ها، تاریخ شارژ، آزمون هیدرواستاتیک و بارکدینگ اختصاصی',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },
  {
    id: 'fire_dept.hydrants',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: هایدرانت‌ها، مانیتورها و فایرباکس‌ها',
    titleEn: 'Fire Dept: Hydrants, Monitors & Hose Reels',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Droplets',
    descriptionFa: 'تست فشار استاتیک و دینامیک، روانکاری شیرها و ممیزی جعبه‌های حریق',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },
  {
    id: 'fire_dept.fm200',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: سیستم‌های اطفا اتوماتیک FM200',
    titleEn: 'Fire Dept: Automated FM200 & Gas Suppression',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Activity',
    descriptionFa: 'پایش وزن سیلندرها، پنل کنترل مرکزی و فعال‌سازی اطفا اتاق‌های سرور و کنترل',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },
  {
    id: 'fire_dept.deluge',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: دلویج ولو، اسپرینکلر و شیرهای On/Off',
    titleEn: 'Fire Dept: Deluge Valves, Sprinklers & On/Off',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Droplets',
    descriptionFa: 'شیرهای سیلابی دلویج، شبکه‌های اسپرینکلر اتوماتیک و تست دوره‌ای اکچویتورها',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },
  {
    id: 'fire_dept.gas_detectors',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: گازیاب‌ها و دتکتورهای ثابت و پرتابل',
    titleEn: 'Fire Dept: Fixed & Portable Gas Detectors',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Gauge',
    descriptionFa: 'کالیبراسیون و بررسی عملکرد سنسورهای گازهای اشتعال‌پذیر و سمی (LEL، H2S، CO، O2)',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },
  {
    id: 'fire_dept.safety_shower',
    legacyId: 'Fire Department',
    parentId: 'fire_dept',
    titleFa: 'آتش‌نشانی: دوش و چشم‌شوی‌های اضطراری',
    titleEn: 'Fire Dept: Emergency Eyewash & Safety Showers',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Droplets',
    descriptionFa: 'تست جریان آب، فشار، اهرم‌های فعال‌سازی و شستشوی اضطراری شیمیایی',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },

  // 2.3 Health & Environment Unit
  {
    id: 'health_env.clinic',
    legacyId: 'Health & Environment',
    parentId: 'health_env',
    titleFa: 'بهداشت و محیط: بهداری و مراجعات سرپایی',
    titleEn: 'Health Unit: Dispensary & Outpatient Clinic',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'HeartPulse',
    descriptionFa: 'تریاژ، علائم حیاتی، اقدامات درمانی، تجویز دارو، استراحت پزشکی و اعزام آمبولانس',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'sign', 'export', 'print']
  },
  {
    id: 'health_env.periodic_exams',
    legacyId: 'Periodic Medical Exams',
    parentId: 'health_env',
    titleFa: 'بهداشت و محیط: معاینات ادواری طب کار',
    titleEn: 'Health Unit: Periodic Medical Examinations',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Stethoscope',
    descriptionFa: 'پرونده سلامت، آزمایشات خون و ادرار، اسپیرومتری، اودیوگرام و صلاحیت پزشکی کار',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'import', 'export', 'print']
  },
  {
    id: 'health_env.non_conformances',
    legacyId: 'Health & Environment',
    parentId: 'health_env',
    titleFa: 'بهداشت و محیط: عدم‌انطباق‌های بهداشتی و رستوران',
    titleEn: 'Health Unit: Hygiene Non-Conformities & Food Safety',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'ShieldAlert',
    descriptionFa: 'بازرسی بهداشت محیط رستوران، آب شرب، بهداشت فردی و پیگیری اصلاح نواقص',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'approve', 'export', 'print']
  },
  {
    id: 'health_env.monitoring',
    legacyId: 'Health & Environment',
    parentId: 'health_env',
    titleFa: 'بهداشت و محیط: پایش آنلاین آلاینده‌های زیست‌محیطی',
    titleEn: 'Environmental: Emissions & Pollution Monitoring',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Leaf',
    descriptionFa: 'پایش و ثبت دوره‌ای آلاینده‌های هوا، پساب صنعتی، آنالیز خاک و صوت محیطی',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'export', 'print']
  },
  {
    id: 'health_env.waste_mgmt',
    legacyId: 'Health & Environment',
    parentId: 'health_env',
    titleFa: 'بهداشت و محیط: مدیریت پسماند و ضایعات EMP',
    titleEn: 'Environmental: Hazardous Waste Management EMP',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'Recycle',
    descriptionFa: 'تفکیک، توزین، نگهداری در انبار پسماند ویژه و ارسال به مراکز مجاز امحاء',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'export', 'print']
  },
  {
    id: 'health_env.five_s',
    legacyId: 'Health & Environment',
    parentId: 'health_env',
    titleFa: 'بهداشت و محیط: نظام آراستگی محیط کار (5S)',
    titleEn: 'Environmental: 5S Housekeeping & Workplace Audits',
    category: 'departments',
    categoryTitleFa: 'دپارتمان‌های تخصصی HSE',
    categoryTitleEn: 'Specialized HSE Departments',
    iconName: 'CheckSquare',
    descriptionFa: 'ممیزی نظام آراستگی کارگاه‌ها، ثبت مشاهدات و رتبه‌بندی ۵S واحدها',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'approve', 'export', 'print']
  },

  // 3. Safety Operations, Permits & Risk Control
  {
    id: 'ptw.issuance',
    legacyId: 'Permit To Work',
    parentId: 'ptw',
    titleFa: 'پروانه کار ایمن: صدور، تمدید و ابطال (PTW)',
    titleEn: 'PTW System: Workflow, Issuance & Extension',
    category: 'safety',
    categoryTitleFa: 'مجوزهای کار و کنترل ریسک',
    categoryTitleEn: 'Safety Operations & Risk Control',
    iconName: 'FileCheck',
    descriptionFa: 'گردش کار دیجیتال، صدور و تمدید پروانه‌های کار گرم، سرد، فضای بسته، حفاری و رادیوگرافی',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'approve', 'reject', 'sign', 'export', 'print']
  },
  {
    id: 'ptw.audit',
    legacyId: 'PTW Audit',
    parentId: 'ptw',
    titleFa: 'ممیزی جامع پروانه‌های کار (۳۰ آیتمی)',
    titleEn: 'PTW Compliance Audit (30-Item Check)',
    category: 'safety',
    categoryTitleFa: 'مجوزهای کار و کنترل ریسک',
    categoryTitleEn: 'Safety Operations & Risk Control',
    iconName: 'CheckCheck',
    descriptionFa: 'ممیزی تطبیق پروانه‌های در حال اجرا با استانداردهای ۳۰ گانه ایمنی و ثبت مغایرت‌ها',
    level: 2,
    applicableActions: ['view', 'details', 'create', 'edit', 'approve', 'export', 'print']
  },
  {
    id: 'ptw.custom_fields',
    legacyId: 'Permit To Work',
    parentId: 'ptw',
    titleFa: 'پروانه کار: پیکربندی فیلدهای پویا و فرم‌ها',
    titleEn: 'PTW System: Dynamic Fields & Form Designer',
    category: 'safety',
    categoryTitleFa: 'مجوزهای کار و کنترل ریسک',
    categoryTitleEn: 'Safety Operations & Risk Control',
    iconName: 'Sliders',
    descriptionFa: 'تعریف و تغییر فیلدهای سفارشی و ضوابط اختصاصی انواع پروانه‌های کار',
    level: 2,
    applicableActions: ['view', 'details', 'edit', 'configure']
  },
  {
    id: 'risk_assessment.jsa',
    legacyId: 'Risk Assessment',
    titleFa: 'ارزیابی ریسک هوشمند (AI JSA / FMEA)',
    titleEn: 'AI Risk Assessment (JSA/FMEA)',
    category: 'safety',
    categoryTitleFa: 'مجوزهای کار و کنترل ریسک',
    categoryTitleEn: 'Safety Operations & Risk Control',
    iconName: 'Zap',
    descriptionFa: 'شناسایی خطرات، ارزیابی ماتریس ریسک و تولید تدابیر کنترلی با هوش مصنوعی',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'approve', 'export', 'print']
  },
  {
    id: 'ppe.management',
    legacyId: 'PPE',
    titleFa: 'مدیریت تجهیزات حفاظت فردی (PPE)',
    titleEn: 'PPE Matrix & Compliance (OSHA)',
    category: 'safety',
    categoryTitleFa: 'مجوزهای کار و کنترل ریسک',
    categoryTitleEn: 'Safety Operations & Risk Control',
    iconName: 'HardHat',
    descriptionFa: 'ماتریس استحقاق تحویل، کارتکس فردی، انقضا و ارزیابی استانداردهای کیفی PPE',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'approve', 'export', 'print']
  },

  // 4. Incidents & Compliance
  {
    id: 'incidents.reporting',
    legacyId: 'Incidents',
    titleFa: 'گزارشات ناهنجاری و حوادث شغلی OSHA',
    titleEn: 'Safety Incidents & Anomalies System',
    category: 'incidents_compliance' as any,
    categoryTitleFa: 'رویدادها و انضباط ایمنی',
    categoryTitleEn: 'Incidents & Compliance',
    iconName: 'AlertTriangle',
    descriptionFa: 'ثبت شبه‌حوادث، ناهنجاری‌ها، حوادث شغلی، کمیته تحقیق و تعیین اقدامات CAPA',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'approve', 'refer', 'export', 'print']
  },
  {
    id: 'warnings.written',
    legacyId: 'Safety Warnings',
    titleFa: 'ثبت و پیگیری اخطارهای کتبی ایمنی',
    titleEn: 'Safety Written Warnings & Non-Compliance',
    category: 'incidents_compliance' as any,
    categoryTitleFa: 'رویدادها و انضباط ایمنی',
    categoryTitleEn: 'Incidents & Compliance',
    iconName: 'FileWarning',
    descriptionFa: 'صدور اخطار کتبی عدم رعایت مقررات، پیگیری سوابق تخلفات و اقدامات انضباطی',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'sign', 'export', 'print']
  },

  // 5. Human Capital & Training
  {
    id: 'personnel.dossier_360',
    legacyId: 'Personnel 360',
    titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل',
    titleEn: 'Personnel 360° Comprehensive Records',
    category: 'human_capital' as any,
    categoryTitleFa: 'سرمایه انسانی و آموزش',
    categoryTitleEn: 'Human Capital & Training',
    iconName: 'UserCheck',
    descriptionFa: 'مشاهده پرونده کامل، سوابق آموزشی، اخطارها، PPE، معاینات و صلاحیت PTW',
    level: 1,
    applicableActions: ['view', 'details', 'edit', 'export', 'print']
  },
  {
    id: 'training.management',
    legacyId: 'Training',
    titleFa: 'مدیریت و تقویم آموزش و گواهینامه‌ها',
    titleEn: 'HSE Training & Certification Calendar',
    category: 'human_capital' as any,
    categoryTitleFa: 'سرمایه انسانی و آموزش',
    categoryTitleEn: 'Human Capital & Training',
    iconName: 'GraduationCap',
    descriptionFa: 'تقویم دوره‌های آموزشی، سجلات، گواهینامه‌ها و آمار سرانه ساعات آموزش',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'import', 'export', 'print']
  },

  // 6. Workflows & Digital Workplace
  {
    id: 'workflows.pending_documents',
    legacyId: 'Pending Documents' as any,
    titleFa: 'کارتابل و اسناد در انتظار اقدام و امضا',
    titleEn: 'Pending Documents Cartable & Sign',
    category: 'workflows' as any,
    categoryTitleFa: 'کارتابل و فرآیندهای سازمانی',
    categoryTitleEn: 'Workflows & Digital Workplace',
    iconName: 'Inbox',
    descriptionFa: 'مشاهده اسناد در انتظار، تأیید، رد، ارجاع، افزودن هامش و امضای دیجیتال اسناد',
    level: 1,
    applicableActions: ['view', 'details', 'approve', 'reject', 'sign', 'refer', 'export', 'print']
  },
  {
    id: 'workflows.non_conformances',
    legacyId: 'Non-Conformances',
    titleFa: 'مدیریت عدم انطباق‌ها و اقدامات اصلاحی (CAPA)',
    titleEn: 'Non-Conformities & CAPA Management',
    category: 'workflows' as any,
    categoryTitleFa: 'کارتابل و فرآیندهای سازمانی',
    categoryTitleEn: 'Workflows & Digital Workplace',
    iconName: 'ShieldAlert',
    descriptionFa: 'ثبت، ارجاع بین واحدی، ریشه‌یابی، اقدامات اصلاحی و ممیزی اثربخشی CAPA',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'approve', 'refer', 'export', 'print']
  },
  {
    id: 'workflows.documents',
    legacyId: 'Documents',
    titleFa: 'دستورالعمل‌ها و مستندات سازمانی',
    titleEn: 'Instructions & Document Management (DMS)',
    category: 'workflows' as any,
    categoryTitleFa: 'کارتابل و فرآیندهای سازمانی',
    categoryTitleEn: 'Workflows & Digital Workplace',
    iconName: 'FolderOpen',
    descriptionFa: 'مشاهده، بارگذاری، ویرایش، ثبت نسخه جدید و بایگانی دستورالعمل‌ها و سرتیفیکیت‌ها',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'import', 'export', 'print']
  },

  // 7. Governance & Administration (مدیریت و پیکربندی سامانه)
  {
    id: 'system.process_management',
    legacyId: 'Process Management',
    titleFa: 'مدیریت فرآیندها (BPMN / Camunda 8)',
    titleEn: 'Process Management (BPMN Camunda)',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Workflow',
    descriptionFa: 'طراحی، مدل‌سازی، استقرار دیاگرام‌ها و مانیتورینگ تسک‌های فرآیندی',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'configure', 'export']
  },
  {
    id: 'system.notifications',
    legacyId: 'Notifications',
    titleFa: 'مدیریت هشدارها و اعلان‌ها',
    titleEn: 'Alerts & Emergency Notifications',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Bell',
    descriptionFa: 'ارسال هشدار فوری HSE، مخابره آژیر اضطراری، مشاهده تاریخچه و آرشیو',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'emergency']
  },
  {
    id: 'system.user_management',
    legacyId: 'User Management',
    titleFa: 'مدیریت کاربران و سطوح دسترسی (RBAC)',
    titleEn: 'User Management & Access Matrix (RBAC)',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Users',
    descriptionFa: 'تعریف کاربران، انتساب نقش‌ها، ماتریس مجوزهای درختی و دامنه پرسنلی',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'configure']
  },
  {
    id: 'system.org_structure',
    legacyId: 'Org Structure',
    titleFa: 'ساختار و چارت سازمانی مجتمع',
    titleEn: 'Organizational Structure & Hierarchy',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Network',
    descriptionFa: 'پیکربندی چارت درختی، دپارتمان‌ها، واحدها و پست‌های سازمانی مجتمع',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'configure']
  },
  {
    id: 'system.branding_ui',
    legacyId: 'UI Config & Branding',
    titleFa: 'شخصی‌سازی رابط و لوگوی رسمی',
    titleEn: 'UI Customization & Branding',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Palette',
    descriptionFa: 'مدیریت لوگو و آرم رسمی سامانه، چیدمان منوها و عناوین ناوبری',
    level: 1,
    applicableActions: ['view', 'details', 'edit', 'configure']
  },
  {
    id: 'system.db_backup',
    legacyId: 'Database Backup',
    titleFa: 'پشتیبان‌گیری و بازیابی پایگاه داده',
    titleEn: 'Database Backup & Restore',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Database',
    descriptionFa: 'تهیه نسخه پشتیبان، بازیابی اطلاعات و مدیریت سلامت پایگاه داده',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'configure']
  },
  {
    id: 'system.audit_logs',
    legacyId: 'Audit Logs',
    titleFa: 'لاگ امنیتی و ممیزی رویدادها',
    titleEn: 'Security Audit Trails & Logs',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'ShieldCheck',
    descriptionFa: 'ثبت جامع ردپای فعالیت کاربران، لاگ‌های ورود و تغییرات امنیتی',
    level: 1,
    applicableActions: ['view', 'details', 'export', 'print']
  },
  {
    id: 'system.api_webhooks',
    legacyId: 'API & Webhooks',
    titleFa: 'مدیریت سرویس‌ها و وب‌هوک‌ها',
    titleEn: 'API Services & Webhooks',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'Globe',
    descriptionFa: 'تنظیم وب‌هوک‌های لحظه‌ای برای رویدادهای ایمنی، پروانه‌ها و شرایط اضطراری',
    level: 1,
    applicableActions: ['view', 'details', 'create', 'edit', 'delete', 'configure']
  },
  {
    id: 'system.profile',
    titleFa: 'شناسنامه و تنظیمات کاربری شخصی',
    titleEn: 'Personal Profile & Security Settings',
    category: 'system',
    categoryTitleFa: 'مدیریت و پیکربندی سامانه',
    categoryTitleEn: 'System Administration & Security',
    iconName: 'User',
    descriptionFa: 'مشخصات حساب کاربری جاری، تغییر رمز عبور و نمونه امضای دیجیتال شخصی',
    level: 1,
    applicableActions: ['view', 'details', 'edit', 'sign']
  }
];

export const PERMISSION_GROUPS: PermissionGroup[] = PERMISSION_MODULES_REGISTRY.map(m => m.id);

export const DEFAULT_PERMISSION_ACTIONS = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  print: false,
  export: false,
  import: false
};

export const FULL_PERMISSION_ACTIONS = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  approve: true,
  print: true,
  export: true,
  import: true
};

export const READONLY_PERMISSION_ACTIONS = {
  view: true,
  create: false,
  edit: false,
  delete: false,
  approve: false,
  print: true,
  export: true,
  import: false
};

// Generate permissions set where everything is either enabled or disabled
export function createPermissionsSet(hasAccess: boolean): UserPermissions {
  const perms = {} as UserPermissions;
  // 1. Legacy groups
  PERMISSION_MODULES_REGISTRY.forEach(m => {
    perms[m.id] = { ...(hasAccess ? FULL_PERMISSION_ACTIONS : DEFAULT_PERMISSION_ACTIONS) };
  });
  // 2. Hierarchical nodes
  HIERARCHICAL_PERMISSION_NODES.forEach(n => {
    const nodePerm: Record<string, boolean> = {};
    n.applicableActions.forEach(a => {
      nodePerm[a] = hasAccess;
    });
    // Fill standard actions as false if not applicable to keep compatibility
    ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export', 'import'].forEach(k => {
      if (nodePerm[k] === undefined) nodePerm[k] = hasAccess && n.applicableActions.includes(k as any);
    });
    perms[n.id] = nodePerm as any;
  });
  return perms;
}

export interface RolePresetInfo {
  id: 'complex_director' | 'hse_manager' | 'unit_supervisor' | 'safety_officer' | 'fire_officer' | 'health_officer' | 'auditor' | 'complex_staff';
  titleFa: string;
  titleEn: string;
  badgeFa: string;
  badgeEn: string;
  descriptionFa: string;
  descriptionEn: string;
  iconName: string;
  colorScheme: {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
  };
}

export const STANDARD_ROLE_PRESETS: RolePresetInfo[] = [
  {
    id: 'complex_director',
    titleFa: 'مدیر مجتمع',
    titleEn: 'Complex Director',
    badgeFa: 'مدیریت عالی مجتمع',
    badgeEn: 'Executive Director',
    descriptionFa: 'اشراف مدیریتی کلان بر کلیه داشبوردها، تایید عالیه پروانه‌های کار و گزارشات جامع',
    descriptionEn: 'High-level executive overview across dashboards, PTW final approval, and corporate HSE reports',
    iconName: 'Building2',
    colorScheme: {
      bg: 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40',
      text: 'text-indigo-700 dark:text-indigo-300',
      border: 'border-indigo-200 dark:border-indigo-800',
      badgeBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200'
    }
  },
  {
    id: 'hse_manager',
    titleFa: 'مدیر کل HSE',
    titleEn: 'HSE General Manager',
    badgeFa: 'مدیر کل ایمنی و بهداشت',
    badgeEn: 'HSE Director',
    descriptionFa: 'اختیارات حاکمیتی کامل در کلیه زیرسیستم‌های HSE، تایید و صدور اسناد و ممیزی‌ها',
    descriptionEn: 'Complete administrative authority across all HSE modules, approvals, and audits',
    iconName: 'ShieldCheck',
    colorScheme: {
      bg: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
    }
  },
  {
    id: 'unit_supervisor',
    titleFa: 'مدیری/مسئول/سرپرست واحد',
    titleEn: 'Unit Manager / Supervisor',
    badgeFa: 'سرپرست ناحیه عملیاتی',
    badgeEn: 'Unit Supervisor',
    descriptionFa: 'صدور و تایید پروانه کار واحد، گزارش ناهنجاری‌ها، ثبت JSA و PPE پرسنل واحد',
    descriptionEn: 'Unit permit requests and approvals, anomaly reporting, JSA risks, and unit staff PPE',
    iconName: 'UserCheck',
    colorScheme: {
      bg: 'hover:bg-blue-50 dark:hover:bg-blue-950/40',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
    }
  },
  {
    id: 'safety_officer',
    titleFa: 'افسر ایمنی',
    titleEn: 'Safety Officer',
    badgeFa: 'کارشناس ایمنی میدان',
    badgeEn: 'Safety Specialist',
    descriptionFa: 'چک‌لیست‌های ایمنی، تایید پروانه‌های کار، ممیزی ۳۰ گانه، ثبت حوادث، ارزیابی ریسک و اخطارها',
    descriptionEn: 'Field safety checklists, PTW approvals, 30-item audits, incident investigations, and warnings',
    iconName: 'HardHat',
    colorScheme: {
      bg: 'hover:bg-amber-50 dark:hover:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
    }
  },
  {
    id: 'fire_officer',
    titleFa: 'افسر آتش‌نشان',
    titleEn: 'Fire Officer',
    badgeFa: 'ایستگاه و ناوگان حریق',
    badgeEn: 'Firefighter',
    descriptionFa: 'مدیریت ناوگان اطفاء، سیستم‌های حریق، تایید پروانه‌های کار گرم و واکنش در شرایط اضطراری',
    descriptionEn: 'Fire fleet management, firefighting systems, hot work permits, and emergency response',
    iconName: 'Flame',
    colorScheme: {
      bg: 'hover:bg-rose-50 dark:hover:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
      badgeBg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
    }
  },
  {
    id: 'health_officer',
    titleFa: 'پزشک و بهداشت کار',
    titleEn: 'Health & Medical Officer',
    badgeFa: 'طب کار و بهداشت محیط',
    badgeEn: 'Occ. Health & Doctor',
    descriptionFa: 'پرونده معاینات طب کار، پایش استرس گرمایی، بهداشت محیط زیست و بررسی پزشکی آسیب‌ها',
    descriptionEn: 'Periodic medical records, WBGT thermal monitor, environment hygiene, and medical reports',
    iconName: 'Stethoscope',
    colorScheme: {
      bg: 'hover:bg-teal-50 dark:hover:bg-teal-950/40',
      text: 'text-teal-700 dark:text-teal-300',
      border: 'border-teal-200 dark:border-teal-800',
      badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200'
    }
  },
  {
    id: 'auditor',
    titleFa: 'ناظر و ممیز',
    titleEn: 'Auditor & Inspector',
    badgeFa: 'ممیزی و بازرسی نظارتی',
    badgeEn: 'Auditor (Read-Only)',
    descriptionFa: 'دسترسی مشاهده و گزارش‌گیری (فقط‌خواندنی) به کلیه ماژول‌های سامانه بدون امکان تغییر داده',
    descriptionEn: 'Read-only audit inspection rights across all modules with export and printing capabilities',
    iconName: 'CheckCheck',
    colorScheme: {
      bg: 'hover:bg-violet-50 dark:hover:bg-violet-950/40',
      text: 'text-violet-700 dark:text-violet-300',
      border: 'border-violet-200 dark:border-violet-800',
      badgeBg: 'bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200'
    }
  },
  {
    id: 'complex_staff',
    titleFa: 'پرسنل مجتمع',
    titleEn: 'Complex Staff',
    badgeFa: 'کاربر و شاغل مجتمع',
    badgeEn: 'Plant Personnel',
    descriptionFa: 'مشاهده پرونده فردی، گزارش شبه‌حوادث و ناهنجاری‌ها، درخواست پروانه و تقویم آموزش',
    descriptionEn: 'Self-service portal: incident/near-miss reporting, permit requests, training calendar, personal file',
    iconName: 'Users',
    colorScheme: {
      bg: 'hover:bg-slate-100 dark:hover:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
    }
  }
];

// Generate Role Preset Permissions
export function createRolePresetPermissions(presetType: 'admin' | 'complex_director' | 'hse_manager' | 'unit_supervisor' | 'safety_officer' | 'fire_officer' | 'health_officer' | 'auditor' | 'complex_staff' | 'process_manager' | 'standard_user' | 'custom_role'): UserPermissions {
  const perms = {} as UserPermissions;
  
  PERMISSION_MODULES_REGISTRY.forEach(m => {
    switch (presetType) {
      case 'admin':
        perms[m.id] = { ...FULL_PERMISSION_ACTIONS };
        break;

      case 'complex_director':
        // High-level Plant / Complex Director: Strategic oversight, approvals, reports, emergency broadcast
        const isExcludedSystem = m.id === 'User Management' || m.id === 'Database Backup' || m.id === 'API & Webhooks';
        perms[m.id] = {
          view: !isExcludedSystem,
          create: m.id === 'Notifications',
          edit: m.id === 'Notifications',
          delete: false,
          approve: m.id === 'Permit To Work' || m.id === 'PTW Audit' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'Risk Assessment' || m.id === 'Safety Warnings' || m.id === 'Process Management',
          print: !isExcludedSystem,
          export: !isExcludedSystem,
          import: false
        };
        break;

      case 'hse_manager':
        // HSE General Director / Manager: Full authority over all HSE subsystems
        const isItAdminOnly = m.id === 'User Management' || m.id === 'Database Backup' || m.id === 'API & Webhooks' || m.id === 'UI Config & Branding';
        perms[m.id] = {
          view: true,
          create: !isItAdminOnly,
          edit: !isItAdminOnly,
          delete: (!isItAdminOnly && m.category !== 'system') || m.id === 'Notifications',
          approve: true,
          print: true,
          export: true,
          import: m.id === 'Periodic Medical Exams' || m.id === 'Personnel 360' || m.id === 'Training' || m.id === 'Safety Unit' || m.id === 'Fire Department'
        };
        break;

      case 'unit_supervisor':
        // Plant Unit Manager / Area Head / Operational Supervisor
        const isUnitRelevant = m.category === 'dashboards' || m.id === 'Permit To Work' || m.id === 'PTW Audit' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'PPE' || m.id === 'Risk Assessment' || m.id === 'Process Management' || m.id === 'Personnel 360' || m.id === 'Training' || m.id === 'Safety Warnings' || m.id === 'Reports' || m.id === 'Documents' || m.id === 'Notifications';
        perms[m.id] = {
          view: isUnitRelevant,
          create: m.id === 'Permit To Work' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'PPE' || m.id === 'Risk Assessment' || m.id === 'Documents' || m.id === 'Notifications',
          edit: m.id === 'Permit To Work' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'PPE' || m.id === 'Risk Assessment' || m.id === 'Documents',
          delete: false,
          approve: m.id === 'Permit To Work' || m.id === 'PPE' || m.id === 'Non-Conformances',
          print: isUnitRelevant,
          export: m.id === 'Permit To Work' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'Reports' || m.id === 'Documents',
          import: false
        };
        break;

      case 'safety_officer':
        // Safety Officer / Inspector
        const isSafetyCore = m.id === 'Safety Unit' || m.id === 'Permit To Work' || m.id === 'PTW Audit' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'PPE' || m.id === 'Risk Assessment' || m.id === 'Lifting Plan' || m.id === 'Safety Warnings' || m.id === 'Documents' || m.id === 'Notifications';
        const isSafetyViewable = isSafetyCore || m.category === 'dashboards' || m.id === 'Fire Department' || m.id === 'Health & Environment' || m.id === 'Personnel 360' || m.id === 'Training' || m.id === 'Reports';
        perms[m.id] = {
          view: isSafetyViewable,
          create: isSafetyCore,
          edit: isSafetyCore,
          delete: false,
          approve: m.id === 'Safety Unit' || m.id === 'Permit To Work' || m.id === 'PTW Audit' || m.id === 'Lifting Plan' || m.id === 'Safety Warnings' || m.id === 'Non-Conformances' || m.id === 'Documents',
          print: isSafetyViewable,
          export: isSafetyViewable,
          import: m.id === 'Safety Unit' || m.id === 'Documents'
        };
        break;

      case 'fire_officer':
        // Fire Officer / Firefighter
        const isFireCore = m.id === 'Fire Department' || m.id === 'Notifications';
        const isFirePermitOrIncident = m.id === 'Permit To Work' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'Risk Assessment' || m.id === 'Documents';
        const isFireViewable = isFireCore || isFirePermitOrIncident || m.category === 'dashboards' || m.id === 'PTW Audit' || m.id === 'PPE' || m.id === 'Reports';
        perms[m.id] = {
          view: isFireViewable,
          create: isFireCore || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'Documents',
          edit: isFireCore || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'Documents',
          delete: false,
          approve: m.id === 'Fire Department' || m.id === 'Permit To Work',
          print: isFireViewable,
          export: isFireCore || isFirePermitOrIncident,
          import: false
        };
        break;

      case 'health_officer':
        // Health & Medical / Occupational Health Officer
        const isHealthCore = m.id === 'Health & Environment' || m.id === 'Periodic Medical Exams' || m.id === 'Heat Stress';
        const isHealthViewable = isHealthCore || m.category === 'dashboards' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'PPE' || m.id === 'Personnel 360' || m.id === 'Training' || m.id === 'Reports' || m.id === 'Documents';
        perms[m.id] = {
          view: isHealthViewable,
          create: isHealthCore || m.id === 'Non-Conformances' || m.id === 'Documents',
          edit: isHealthCore || m.id === 'Non-Conformances' || m.id === 'Documents',
          delete: m.id === 'Periodic Medical Exams',
          approve: isHealthCore,
          print: isHealthViewable,
          export: isHealthCore || m.id === 'Reports' || m.id === 'Documents',
          import: m.id === 'Periodic Medical Exams'
        };
        break;

      case 'auditor':
        // Auditor & Inspector (Read-Only across all modules)
        perms[m.id] = {
          view: true,
          create: false,
          edit: false,
          delete: false,
          approve: false,
          print: true,
          export: true,
          import: false
        };
        break;

      case 'process_manager':
        // BPMN & Process focus
        const isProc = m.id === 'Process Management' || m.id === 'Training' || m.id === 'Reports' || m.id === 'Documents';
        perms[m.id] = {
          view: true,
          create: isProc,
          edit: isProc,
          delete: isProc,
          approve: isProc,
          print: true,
          export: true,
          import: isProc
        };
        break;

      case 'custom_role':
        // Custom dedicated roles: full operational access across HSE modules, excluding sensitive system/org structure settings unless explicitly assigned
        const isSystemAdminOnly = m.category === 'system' && (m.id === 'User Management' || m.id === 'Org Structure' || m.id === 'Database Backup' || m.id === 'API & Webhooks' || m.id === 'UI Config & Branding');
        perms[m.id] = {
          view: !isSystemAdminOnly,
          create: !isSystemAdminOnly,
          edit: !isSystemAdminOnly,
          delete: false,
          approve: m.id === 'Permit To Work' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'PTW Audit',
          print: true,
          export: true,
          import: false
        };
        break;

      case 'complex_staff':
      case 'standard_user':
      default:
        // Complex Plant Personnel / Staff
        const isStaffViewable = m.id === 'Dashboard' || m.id === 'Heat Stress' || m.id === 'Permit To Work' || m.id === 'Incidents' || m.id === 'Non-Conformances' || m.id === 'PPE' || m.id === 'Personnel 360' || m.id === 'Training' || m.id === 'Documents';
        perms[m.id] = {
          view: isStaffViewable,
          create: m.id === 'Incidents' || m.id === 'Permit To Work' || m.id === 'Non-Conformances',
          edit: false,
          delete: false,
          approve: false,
          print: m.id === 'Permit To Work' || m.id === 'Training' || m.id === 'Documents',
          export: m.id === 'Documents',
          import: false
        };
        break;
    }
  });

  // Populate hierarchical nodes for this role preset
  HIERARCHICAL_PERMISSION_NODES.forEach(n => {
    const parentLegacyPerms = (n.legacyId && perms[n.legacyId]) ? perms[n.legacyId] : null;
    const nodePerm: Record<string, boolean> = {};

    n.applicableActions.forEach(action => {
      if (presetType === 'admin') {
        nodePerm[action] = true;
        return;
      }

      if (action === 'details') {
        nodePerm[action] = Boolean(parentLegacyPerms?.view);
      } else if (action === 'sign' || action === 'reject') {
        nodePerm[action] = Boolean(parentLegacyPerms?.approve);
      } else if (action === 'refer') {
        nodePerm[action] = Boolean(parentLegacyPerms?.approve || parentLegacyPerms?.create);
      } else if (action === 'emergency') {
        nodePerm[action] = (presetType === 'complex_director' || presetType === 'hse_manager' || presetType === 'fire_officer') &&
          (n.id === 'system.notifications' || n.id === 'dashboards.heat_stress');
      } else if (action === 'configure') {
        nodePerm[action] = presetType === 'hse_manager' && (n.id.includes('template') || n.id.includes('custom_fields'));
      } else if (parentLegacyPerms && typeof parentLegacyPerms[action] === 'boolean') {
        nodePerm[action] = parentLegacyPerms[action];
      } else {
        nodePerm[action] = false;
      }
    });

    // Keep compatibility for any legacy readers
    ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export', 'import'].forEach(k => {
      if (nodePerm[k] === undefined) {
        nodePerm[k] = parentLegacyPerms && typeof parentLegacyPerms[k] === 'boolean' ? parentLegacyPerms[k] : false;
      }
    });

    perms[n.id] = nodePerm as any;
  });

  return perms;
}

// Default Seed Departments
export const SEED_DEPARTMENTS: any[] = [];

// Generate Seed Users
export const SEED_USERS: UserProfile[] = [
  {
    id: 'user-admin',
    username: 'admin',
    fullName: 'مدیر سیستم',
    personnelNumber: '1000',
    nationalId: '0000000000',
    departmentIds: [],
    jobTitle: 'مدیر سیستم',
    phoneNumber: '00000000000',
    email: 'admin@system.local',
    employmentStatus: 'رسمی',
    workShift: 'اداری',
    supervisor: '-',
    emergencyContact: '-',
    role: 'Administrator',
    accountStatus: 'Active',
    lastLogin: new Date().toISOString(),
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    profilePhoto: '',
    passwordHash: '',
    failedAttempts: 0,
    forcePasswordChange: false,
    mfaEnabled: false,
    passwordExpiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
    permissions: {} as any
  }
];

export const SEED_AUDIT_LOGS: any[] = [];

export const SEED_NOTIFICATIONS: any[] = [];

export interface OrgNode {
  id: string;
  name: string;
  nameEn?: string;
  type: 'Company' | 'Site' | 'Plant' | 'Area' | 'Department' | 'Section' | 'Team' | 'Unit';
  parentId: string | null;
  manager?: string;
  managerPersonnelId?: number | null;
  managerPersonnelCode?: string | null;
  managerJobTitle?: string | null;
  managerNationalCode?: string | null;
  managerStatus?: string;
  code?: string;
  description?: string;
  location?: string;
  headcount?: number;
  costCenter?: string;
  status?: 'active' | 'inactive' | 'commissioning';
  createdAt?: string;
}

export const SEED_ORG_NODES: any[] = [];

export const ADMIN_USER: UserProfile = {
  id: 'user-admin',
  username: 'admin',
  fullName: 'مدیر سامانه',
  personnelNumber: '1001',
  nationalId: '0000000000',
  departmentIds: [],
  jobTitle: 'مدیر ارشد HSE',
  phoneNumber: '09000000000',
  email: 'admin@hsecore.local',
  employmentStatus: 'رسمی (Full-Time)',
  workShift: 'اداری ثابت (Morning)',
  supervisor: 'مدیریت مجتمع',
  emergencyContact: '-',
  role: 'Administrator',
  accountStatus: 'Active',
  lastLogin: new Date().toISOString(),
  createdDate: '1405/01/01',
  updatedDate: '1405/01/01',
  profilePhoto: '',
  passwordHash: '',
  failedAttempts: 0,
  passwordExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  forcePasswordChange: false,
  mfaEnabled: false,
  permissions: createPermissionsSet(true)
};

export const SIR_USER: UserProfile = ADMIN_USER;

// In-memory application user state (Database is Single Source of Truth; zero Browser Storage)
let memorySystemUsers: UserProfile[] = [SIR_USER];
let memoryCurrentUser: UserProfile | null = null;
let memoryAuditLogs: AuditLogEntry[] = [];

export function setSystemUsers(users: UserProfile[]): void {
  if (Array.isArray(users) && users.length > 0) {
    memorySystemUsers = users;
  }
}

export function getRawMemorySystemUsers(): UserProfile[] {
  return memorySystemUsers;
}

let isRefreshingCurrentUserAssignments = false;

export function setCurrentUser(user: UserProfile | null): void {
  memoryCurrentUser = user;
  try {
    if (typeof window !== 'undefined') {
      if (user) {
        const {
          assignedPersonnel,
          assignedPersonnelIds,
          assignedPersonnelCodes,
          personnelAccessScope,
          canAccessAllPersonnel,
          ...basicSessionIdentity
        } = user as any;
        sessionStorage.setItem('hse_current_user', JSON.stringify(basicSessionIdentity));
        initGlobalAuditObserver(getCurrentUser, addAuditLog);
      } else {
        sessionStorage.removeItem('hse_current_user');
      }
    }
  } catch {}
}

export async function refreshCurrentUserFromServer(): Promise<UserProfile | null> {
  if (isRefreshingCurrentUserAssignments) return memoryCurrentUser;
  isRefreshingCurrentUserAssignments = true;
  try {
    const serverUser = await apiDb.getCurrentUserFromServer();
    if (serverUser && (serverUser.uid || serverUser.id)) {
      const merged: UserProfile = {
        ...(memoryCurrentUser || ({} as UserProfile)),
        ...serverUser,
        id: serverUser.uid || serverUser.id,
        uid: serverUser.uid || serverUser.id,
        personnelAccessScope: serverUser.personnelAccessScope,
        canAccessAllPersonnel: serverUser.canAccessAllPersonnel,
        assignedPersonnelIds: Array.isArray(serverUser.assignedPersonnelIds) ? serverUser.assignedPersonnelIds : [],
        assignedPersonnelCodes: Array.isArray(serverUser.assignedPersonnelCodes) ? serverUser.assignedPersonnelCodes : [],
        assignedPersonnel: Array.isArray(serverUser.assignedPersonnel) ? serverUser.assignedPersonnel : [],
      };
      memoryCurrentUser = merged;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_user_assignments_updated', { detail: merged }));
        window.dispatchEvent(new CustomEvent('hse_current_user_updated', { detail: merged }));
      }
      return merged;
    }
  } catch {
    // ignore network error
  } finally {
    isRefreshingCurrentUserAssignments = false;
  }
  return memoryCurrentUser;
}

export function getCurrentUser(): UserProfile | null {
  if (!memoryCurrentUser && typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem('hse_current_user');
      if (raw) {
        memoryCurrentUser = JSON.parse(raw);
        // Fetch authoritative assignments from PostgreSQL immediately
        refreshCurrentUserFromServer().catch(() => {});
      }
    } catch {}
  } else if (
    memoryCurrentUser &&
    memoryCurrentUser.personnelAccessScope === undefined &&
    !isRefreshingCurrentUserAssignments &&
    typeof window !== 'undefined'
  ) {
    refreshCurrentUserFromServer().catch(() => {});
  }
  return memoryCurrentUser;
}

export function getSystemUsers(): UserProfile[] {
  const users = [...memorySystemUsers];
  const userCodes = new Set<string>();
  const userFullNames = new Set<string>();

  users.forEach(u => {
    if (u.personnelNumber) userCodes.add(u.personnelNumber.trim().toLowerCase());
    if (u.fullName) userFullNames.add(u.fullName.trim().toLowerCase());
  });

  try {
    const personnelList = getComplexPersonnelList({ bypassAccessFilter: true });
    if (Array.isArray(personnelList)) {
      personnelList.forEach(p => {
        if (p.status === 'inactive') return;
        const pCode = (p.personnelCode || p.effectiveCode || '').trim();
        const pName = (p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).trim();
        const normCode = pCode.toLowerCase();
        const normName = pName.toLowerCase();

        const existsByCode = normCode && userCodes.has(normCode);
        const existsByName = normName && userFullNames.has(normName);

        if (!existsByCode && !existsByName && pName) {
          const syntheticUser: UserProfile = {
            id: p.id || `user-p-${pCode || Math.random().toString(36).substr(2, 6)}`,
            username: pCode || p.id || `user_${Math.random().toString(36).substr(2, 6)}`,
            fullName: pName,
            personnelNumber: pCode,
            nationalId: p.nationalCode || '',
            departmentIds: [p.unit || p.department || 'واحد عملیاتی'],
            jobTitle: p.jobTitle || p.position || 'پرسنل مجتمع',
            phoneNumber: p.phone || '',
            email: '',
            employmentStatus: 'Full-Time',
            workShift: 'Morning',
            supervisor: p.supervisor || '',
            emergencyContact: '',
            role: 'standard_user',
            accountStatus: 'Active',
            createdDate: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
            passwordHash: '',
            failedAttempts: 0,
            passwordExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
            forcePasswordChange: false,
            mfaEnabled: false,
            profilePhoto: p.profilePhoto,
            signatureImage: p.signatureImage,
            permissions: createRolePresetPermissions('standard_user')
          };
          users.push(syntheticUser);
          if (normCode) userCodes.add(normCode);
          if (normName) userFullNames.add(normName);
        }
      });
    }
  } catch {
    // Ignore during initial module evaluation
  }

  return users;
}

export function ensureUserAndPersonnelInSync(item: {
  id?: string;
  fullName: string;
  personnelNumber?: string;
  personnelCode?: string;
  nationalCode?: string;
  nationalId?: string;
  jobTitle?: string;
  department?: string;
  role?: string;
}): UserProfile {
  const pCode = (item.personnelNumber || item.personnelCode || '').trim();
  const name = item.fullName.trim();
  
  // Find existing user
  let existingUser = memorySystemUsers.find(u => 
    (pCode && u.personnelNumber && u.personnelNumber.trim() === pCode) ||
    (name && u.fullName && u.fullName.trim() === name)
  );

  if (!existingUser) {
    existingUser = {
      id: item.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      username: pCode || `user_${Date.now()}`,
      fullName: name,
      personnelNumber: pCode,
      nationalId: item.nationalCode || item.nationalId || '',
      departmentIds: [item.department || 'واحد عمومی'],
      jobTitle: item.jobTitle || 'کاربر سامانه',
      phoneNumber: '',
      email: '',
      employmentStatus: 'Full-Time',
      workShift: 'Morning',
      supervisor: '',
      emergencyContact: '',
      role: (item.role as any) || 'standard_user',
      accountStatus: 'Active',
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      passwordHash: '',
      failedAttempts: 0,
      passwordExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      forcePasswordChange: false,
      mfaEnabled: false,
      signatureImage: (item as any).signatureImage,
      permissions: createRolePresetPermissions('standard_user')
    };
    memorySystemUsers.push(existingUser);
    apiDb.saveUser(existingUser).catch((err) => {
      console.error('Failed to sync personnel user account to database:', err);
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_users_updated', { detail: memorySystemUsers }));
      window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'users' } }));
    }
  }

  return existingUser;
}

export function getAuditLogs(): AuditLogEntry[] {
  return memoryAuditLogs;
}

export function setAuditLogs(logs: AuditLogEntry[]): void {
  if (Array.isArray(logs)) {
    memoryAuditLogs = logs;
  }
}

// All system state is database-authoritative; no browser storage seeds used
export function initializeRbacSeeds() {
  // No-op: PostgreSQL database is the single source of truth
}

// Check if user has Administrator role (bilingual Persian/English case-insensitive check)
export function isUserAdmin(user: UserProfile | null | undefined): boolean {
  if (!user || !user.role) return false;
  const norm = (user.role || '').toLowerCase().replace(/\s+|_/g, '');
  return norm === 'administrator' || norm === 'admin' || norm === 'مدیرسیستم' || norm.includes('مدیرارشد') || norm.includes('مدیرسیستم');
}

// Automatically derive best-matching permissions preset for any standard or custom role
export function getDefaultPermissionsForRole(userRole?: string): UserPermissions {
  const raw = (userRole || '').trim();
  const norm = raw.toLowerCase().replace(/\s+|_/g, '');
  
  if (norm === 'admin' || norm === 'administrator' || norm.includes('مدیرارشد') || norm.includes('مدیرسیستم')) {
    return createRolePresetPermissions('admin');
  }
  // 1. مدیر مجتمع
  if (norm.includes('مدیرمجتمع') || norm.includes('مدیرعامل') || norm.includes('complexdirector') || norm.includes('plantmanager') || norm.includes('executivemanager')) {
    return createRolePresetPermissions('complex_director');
  }
  // 2. مدیر کل HSE
  if (norm.includes('مدیرکلhse') || norm.includes('hse_manager') || norm.includes('hsemanager') || norm.includes('مدیرhse') || norm.includes('مدیرایمنی')) {
    return createRolePresetPermissions('hse_manager');
  }
  // 3. مدیری/مسئول/سرپرست واحد
  if (norm.includes('سرپرستواحد') || norm.includes('مسئولواحد') || norm.includes('مدیرواحد') || norm.includes('unitsupervisor') || norm.includes('supervisor')) {
    return createRolePresetPermissions('unit_supervisor');
  }
  // 4. افسر ایمنی
  if (norm.includes('افسرایمنی') || norm.includes('کارشناسایمنی') || norm.includes('بازرسایمنی') || norm.includes('safetyofficer') || norm.includes('safetyinspector')) {
    return createRolePresetPermissions('safety_officer');
  }
  // 5. افسر آتش‌نشان
  if (norm.includes('افسراتشنشان') || norm.includes('افسرآتشنشان') || norm.includes('آتشنشان') || norm.includes('اتشنشان') || norm.includes('fireofficer') || norm.includes('fire')) {
    return createRolePresetPermissions('fire_officer');
  }
  // 6. پزشک و بهداشت کار
  if (norm.includes('پزشک') || norm.includes('بهداشتکار') || norm.includes('طبکار') || norm.includes('healthofficer') || norm.includes('medicalstaff')) {
    return createRolePresetPermissions('health_officer');
  }
  // 7. ناظر و ممیز
  if (norm.includes('ناظر') || norm.includes('ممیز') || norm.includes('auditor') || norm.includes('inspector')) {
    return createRolePresetPermissions('auditor');
  }
  // 8. پرسنل مجتمع
  if (norm.includes('پرسنل') || norm.includes('پرسنلمجتمع') || norm.includes('complexstaff') || norm.includes('standard_user') || norm === 'user' || norm === 'کاربر') {
    return createRolePresetPermissions('complex_staff');
  }
  if (norm.includes('process') || norm.includes('bpmn') || norm.includes('فرآیند') || norm.includes('فرایند')) {
    return createRolePresetPermissions('process_manager');
  }
  // Dedicated / Custom role (نقش اختصاصی)
  if (norm.includes('اختصاصی') || norm.includes('custom') || (raw && raw !== 'User' && raw !== 'کاربر' && raw !== 'کاربرمعمولی')) {
    return createRolePresetPermissions('custom_role');
  }
  return createRolePresetPermissions('complex_staff');
}

// Check if current user has permission for a given action (supports both legacy IDs and hierarchical dot notation)
export function hasPermission(
  user: UserProfile | null,
  groupOrNodeId: string,
  action: HierarchicalActionKey | keyof PermissionActions | string
): boolean {
  if (!user) return false;
  if (isUserAdmin(user)) return true; // Admins override everything
  
  // Under Suspended or Inactive or Locked accounts, block all actions
  if (user.accountStatus && user.accountStatus !== 'Active') return false;

  const targetAct = String(action) as HierarchicalActionKey;

  // 1. If explicit permissions object exists on user profile
  if (user.permissions && typeof user.permissions === 'object' && !Array.isArray(user.permissions)) {
    const rawPerms = user.permissions as Record<string, any>;

    // 1.1 Direct match on requested key (e.g. 'ptw.issuance' or 'Permit To Work')
    if (rawPerms[groupOrNodeId] && typeof rawPerms[groupOrNodeId] === 'object') {
      const val = rawPerms[groupOrNodeId][targetAct];
      if (typeof val === 'boolean') {
        return val;
      }
      // Action mapping fallback (e.g. sign -> approve, details -> view)
      if (targetAct === 'details' && typeof rawPerms[groupOrNodeId].view === 'boolean') {
        return rawPerms[groupOrNodeId].view;
      }
      if (targetAct === 'sign' && typeof rawPerms[groupOrNodeId].approve === 'boolean') {
        return rawPerms[groupOrNodeId].approve;
      }
      if (targetAct === 'reject' && typeof rawPerms[groupOrNodeId].approve === 'boolean') {
        return rawPerms[groupOrNodeId].approve;
      }
    }

    // 1.2 Cross-check between Hierarchical ID and Legacy Name
    const matchedNode = HIERARCHICAL_PERMISSION_NODES.find(n => n.id === groupOrNodeId || n.legacyId === groupOrNodeId);
    if (matchedNode) {
      // Check legacyId if queried by hierarchical ID
      if (matchedNode.legacyId && rawPerms[matchedNode.legacyId]) {
        const val = rawPerms[matchedNode.legacyId][targetAct];
        if (typeof val === 'boolean') return val;
        if (targetAct === 'details' && typeof rawPerms[matchedNode.legacyId].view === 'boolean') return rawPerms[matchedNode.legacyId].view;
        if (targetAct === 'sign' && typeof rawPerms[matchedNode.legacyId].approve === 'boolean') return rawPerms[matchedNode.legacyId].approve;
        if (targetAct === 'reject' && typeof rawPerms[matchedNode.legacyId].approve === 'boolean') return rawPerms[matchedNode.legacyId].approve;
      }
      // Check hierarchical ID if queried by legacyId
      if (rawPerms[matchedNode.id]) {
        const val = rawPerms[matchedNode.id][targetAct];
        if (typeof val === 'boolean') return val;
      }
    }

    // 1.3 Check if querying a parent module or group: if any sub-node is granted, view is granted
    const matchingChildNodes = HIERARCHICAL_PERMISSION_NODES.filter(
      n => n.legacyId === groupOrNodeId || (n.parentId && n.parentId === groupOrNodeId) || n.id.startsWith(groupOrNodeId + '.')
    );
    if (matchingChildNodes.length > 0) {
      for (const child of matchingChildNodes) {
        if (rawPerms[child.id] && rawPerms[child.id][targetAct] === true) {
          return true;
        }
      }
    }
  }

  // 2. If permissions is an array of strings (e.g. ['*'] or ['ptw:*', 'ptw.issuance:sign'])
  if (Array.isArray(user.permissions)) {
    if (user.permissions.includes('*')) return true;
    const groupKey = groupOrNodeId.toLowerCase().replace(/\s+|_/g, '');
    const permKey = `${groupKey}:${targetAct}`;
    if (user.permissions.includes(permKey) || user.permissions.includes(`${groupKey}:*`)) {
      return true;
    }
    
    // Cross-check module aliases
    const aliases: Record<string, string[]> = {
      heatstress: ['heat', 'heatstress', 'dashboards.heat_stress'],
      permittowork: ['ptw', 'permittowork', 'permit', 'ptw.issuance'],
      reports: ['reports', 'trir', 'statistics', 'dashboards.statistics'],
      tririncidentrate: ['trir', 'tririncidentrate', 'dashboards.trir'],
      personnel360: ['personnel', 'personnel360', 'personnel.dossier_360'],
      safetywarnings: ['warnings', 'safetywarnings', 'warnings.written'],
      riskassessment: ['risk', 'riskassessment', 'risk_assessment.jsa'],
      safetyunit: ['safety', 'safetyunit', 'safety_dept.dashboard'],
      firedepartment: ['fire', 'firedepartment', 'firedept', 'fire_dept.fleet'],
      'health&environment': ['health', 'healthenv', 'health_env.clinic'],
      periodicmedicalexams: ['health', 'medical', 'health_env.periodic_exams'],
      processmanagement: ['process', 'processmanagement', 'system.process_management'],
      usermanagement: ['user', 'usermgmt', 'system.user_management'],
      nonconformances: ['nonconformances', 'capa', 'workflows.non_conformances'],
      documents: ['documents', 'document', 'workflows.documents'],
      notifications: ['notifications', 'system.notifications', 'emergency'],
      orgstructure: ['orgstructure', 'system.org_structure'],
    };
    const checkKeys = aliases[groupKey] || [groupKey];
    for (const k of checkKeys) {
      if (user.permissions.includes(`${k}:${targetAct}`) || user.permissions.includes(`${k}:*`)) {
        return true;
      }
    }
  }

  // 3. Fallback to default preset permissions for this user role
  const preset = getDefaultPermissionsForRole(user.role);
  if (preset) {
    if (preset[groupOrNodeId] && typeof (preset[groupOrNodeId] as any)[targetAct] === 'boolean') {
      return (preset[groupOrNodeId] as any)[targetAct];
    }
    const matchedNode = HIERARCHICAL_PERMISSION_NODES.find(n => n.id === groupOrNodeId || n.legacyId === groupOrNodeId);
    if (matchedNode) {
      if (matchedNode.legacyId && preset[matchedNode.legacyId]) {
        const val = (preset[matchedNode.legacyId] as any)[targetAct];
        if (typeof val === 'boolean') return val;
      }
      if (preset[matchedNode.id]) {
        const val = (preset[matchedNode.id] as any)[targetAct];
        if (typeof val === 'boolean') return val;
      }
    }
  }

  // 4. Default: Standard view allowed for basic operational modules
  if (targetAct === 'view' || targetAct === 'details') {
    const standardViewGroups = [
      'Dashboard',
      'Permit To Work',
      'Incidents',
      'Heat Stress',
      'TRIR Incident Rate',
      'Non-Conformances',
      'Documents',
      'dashboards.executive',
      'dashboards.heat_stress',
      'ptw.issuance',
      'incidents.reporting',
      'workflows.documents'
    ];
    if (standardViewGroups.includes(groupOrNodeId)) return true;
  }

  return false;
}

/**
 * Resolves effective permissions, distinguishing role-preset defaults from custom user overrides.
 */
export function getEffectiveUserPermissions(user: UserProfile | null): {
  effectivePermissions: UserPermissions;
  rolePresetPermissions: UserPermissions;
  customOverrides: Record<string, Record<string, boolean>>;
  hasOverrides: boolean;
  totalActiveCount: number;
} {
  const rolePresetPermissions = getDefaultPermissionsForRole(user?.role);
  const effectivePermissions: UserPermissions = {};
  const customOverrides: Record<string, Record<string, boolean>> = {};
  let hasOverrides = false;
  let totalActiveCount = 0;

  const rawUserPerms = (user?.permissions && typeof user.permissions === 'object' && !Array.isArray(user.permissions))
    ? (user.permissions as Record<string, any>)
    : {};

  HIERARCHICAL_PERMISSION_NODES.forEach(node => {
    const presetNodePerms = (rolePresetPermissions[node.id] || (node.legacyId ? rolePresetPermissions[node.legacyId] : null) || {}) as Record<string, boolean>;
    const userNodePerms = (rawUserPerms[node.id] || (node.legacyId ? rawUserPerms[node.legacyId] : null) || {}) as Record<string, boolean>;

    const nodeEffective: Record<string, boolean> = {};
    const nodeOverrides: Record<string, boolean> = {};

    node.applicableActions.forEach(action => {
      const presetVal = isUserAdmin(user) ? true : !!presetNodePerms[action];
      let finalVal = presetVal;

      if (!isUserAdmin(user) && typeof userNodePerms[action] === 'boolean') {
        finalVal = userNodePerms[action];
        if (finalVal !== presetVal) {
          nodeOverrides[action] = finalVal;
          hasOverrides = true;
        }
      }

      nodeEffective[action] = finalVal;
      if (finalVal) totalActiveCount++;
    });

    effectivePermissions[node.id] = nodeEffective as any;
    if (Object.keys(nodeOverrides).length > 0) {
      customOverrides[node.id] = nodeOverrides;
    }
  });

  return {
    effectivePermissions,
    rolePresetPermissions,
    customOverrides,
    hasOverrides,
    totalActiveCount
  };
}

/**
 * Validates dependencies and conflicting permissions (e.g. action enabled without view access).
 */
export function validatePermissionDependencies(permissions: UserPermissions | Record<string, any>): Array<{
  nodeId: string;
  nodeTitleFa: string;
  action: HierarchicalActionKey;
  messageFa: string;
  suggestedAction: HierarchicalActionKey;
}> {
  const warnings: Array<{
    nodeId: string;
    nodeTitleFa: string;
    action: HierarchicalActionKey;
    messageFa: string;
    suggestedAction: HierarchicalActionKey;
  }> = [];

  HIERARCHICAL_PERMISSION_NODES.forEach(node => {
    const nodePerm = (permissions[node.id] || (node.legacyId ? permissions[node.legacyId] : null) || {}) as Record<string, boolean>;
    const hasView = !!nodePerm.view;

    (['create', 'edit', 'delete', 'approve', 'reject', 'sign', 'refer', 'export', 'print'] as HierarchicalActionKey[]).forEach(act => {
      if (nodePerm[act] && !hasView) {
        warnings.push({
          nodeId: node.id,
          nodeTitleFa: node.titleFa,
          action: act,
          messageFa: `مجوز «${HIERARCHICAL_ACTION_LABELS[act]?.titleFa || act}» بدون دسترسی «مشاهده» فعال است.`,
          suggestedAction: 'view'
        });
      }
    });
  });

  return warnings;
}

export interface AuditLogOptions {
  actorType?: ActorType;
  userId?: string;
  fullName?: string;
  userCode?: string;
  userRole?: string;
  department?: string;
  actionType?: ActionType;
  category?: AuditCategory;
  severity?: AuditSeverity;
  module?: string;
  page?: string;
  subSection?: string;
  elementTarget?: string;
  recordType?: string;
  recordId?: string;
  httpMethod?: string;
  endpoint?: string;
  statusCode?: number;
  durationMs?: number;
  dwellTimeMs?: number;
  fromPath?: string;
  toPath?: string;
  changes?: AuditLogChange[];
  description?: string;
  success?: boolean;
  errorMessage?: string;
  transactionId?: string;
  hash?: string;
  sessionId?: string;
  ip?: string;
  skipRemotePersist?: boolean;
}

// Generate a simple hash for integrity (basic implementation for client-side)
const generateLogHash = (logStr: string) => {
  let hash = 0;
  for (let i = 0; i < logStr.length; i++) {
    const char = logStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
};

export function startGlobalAuditTracking(): void {
  initGlobalAuditObserver(getCurrentUser, addAuditLog);
}

const PERSISTED_AUDIT_ACTION_TYPES = new Set<ActionType>([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'PRINT',
  'EXPORT',
  'IMPORT',
  'APPROVE',
  'REJECT',
  'PERMISSIONS_CHANGE',
  'SETTINGS_CHANGE',
]);

let lastAuditSignature = '';
let lastAuditTimestamp = 0;

// Log an action to in-memory audit log and persist significant actions to database
export function addAuditLog(
  username: string, 
  action: string, 
  result: string, 
  options: AuditLogOptions = {}
) {
  initGlobalAuditObserver(getCurrentUser, addAuditLog);

  const nowMs = Date.now();
  const dedupSig = `${username}|${options.actionType || ''}|${action}|${options.endpoint || ''}|${result}`;
  if (dedupSig === lastAuditSignature && nowMs - lastAuditTimestamp < 1500) {
    return;
  }
  lastAuditSignature = dedupSig;
  lastAuditTimestamp = nowMs;

  const browserInfo = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser';
  const now = new Date(nowMs);
  const activeUser = memoryCurrentUser;
  const modInfo = resolveCurrentModuleInfo();
  
  const success = options.success !== undefined ? options.success : 
                 (result.includes('موفق') || result.includes('Successful') || !result.includes('ناموفق'));
                 
  const actionType: ActionType = options.actionType || 
      (action.includes('حذف') ? 'DELETE' : 
       action.includes('ویرایش') || action.includes('بروزرسانی') || action.includes('تغییر') ? 'UPDATE' : 
       action.includes('ایجاد') || action.includes('ثبت') || action.includes('صدور') ? 'CREATE' : 
       action.includes('ورود') ? 'LOGIN' : 
       action.includes('خروج') ? 'LOGOUT' : 
       action.includes('چاپ') || action.includes('پرینت') ? 'PRINT' :
       action.includes('خروجی') || action.includes('دانلود') ? 'EXPORT' : 'OTHER');
       
  const id = 'log-' + nowMs + '-' + Math.floor(Math.random() * 10000);
  const ts = now.toISOString();
  const changes = options.changes || [];
  const { category, severity } = classifyAuditEvent(actionType, action, success, changes.length);
  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '';

  const baseLog = {
    id,
    ts,
    tsFa: moment(now).format('jYYYY/jMM/jDD HH:mm:ss'),
    actorType: options.actorType || 'USER',
    userId: options.userId || activeUser?.uid || activeUser?.id,
    username: username || activeUser?.username || 'کاربر سامانه',
    fullName: options.fullName || activeUser?.fullName || '',
    userCode: options.userCode || activeUser?.personnelNumber || '',
    userRole: options.userRole || activeUser?.role || 'کاربر سامانه',
    department: options.department || (Array.isArray(activeUser?.departmentIds) ? activeUser?.departmentIds[0] : ''),
    ip: options.ip || 'Client/Session',
    device: typeof window !== 'undefined' && window.innerWidth < 768 ? 'Mobile Terminal' : 'Control Room Desktop',
    browser: formatBrowserSummary(browserInfo),
    viewport,
    sessionId: options.sessionId || getActiveSessionId(),
    actionType,
    category: options.category || category,
    severity: options.severity || severity,
    action,
    module: options.module || modInfo.moduleFa || 'سیستم عمومی',
    page: options.page || modInfo.hashPath || 'نامشخص',
    subSection: options.subSection,
    elementTarget: options.elementTarget,
    recordType: options.recordType,
    recordId: options.recordId,
    httpMethod: options.httpMethod,
    endpoint: options.endpoint,
    statusCode: options.statusCode,
    durationMs: options.durationMs,
    dwellTimeMs: options.dwellTimeMs,
    fromPath: options.fromPath,
    toPath: options.toPath,
    changes,
    description: options.description,
    success,
    result,
    errorMessage: options.errorMessage,
    transactionId: options.transactionId || `TX-${nowMs.toString(36).toUpperCase()}`,
  };
  
  const hash = generateLogHash(JSON.stringify(baseLog));
  
  const newLog: AuditLogEntry = {
    ...baseLog,
    hash
  };
  
  memoryAuditLogs.unshift(newLog);
  if (memoryAuditLogs.length > 1000) {
    memoryAuditLogs = memoryAuditLogs.slice(0, 1000);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hse_audit_log_added', { detail: newLog }));
  }

  // Only persist actual mutations, security events, or failed actions to PostgreSQL to prevent HTTP flood on passive UI clicks,
  // and skip remote POST if the backend route already persisted an authoritative audit record.
  if (options.skipRemotePersist || (!PERSISTED_AUDIT_ACTION_TYPES.has(actionType) && success)) {
    return;
  }

  apiDb.logAudit({
    userUid: newLog.userId || newLog.username,
    personnelCode: newLog.userCode,
    action: newLog.action,
    module: newLog.module || 'SYSTEM',
    entityType: newLog.recordType || newLog.module || 'System',
    entityId: newLog.recordId,
    result: newLog.success ? 'SUCCESS' : 'FAILED',
    details: {
      username: newLog.username,
      fullName: newLog.fullName,
      userRole: newLog.userRole,
      userCode: newLog.userCode,
      department: newLog.department,
      actorType: newLog.actorType,
      actionType: newLog.actionType,
      actionTitle: newLog.action,
      category: newLog.category,
      severity: newLog.severity,
      module: newLog.module,
      page: newLog.page,
      subSection: newLog.subSection,
      elementTarget: newLog.elementTarget,
      result: newLog.result,
      success: newLog.success,
      device: newLog.device,
      browser: newLog.browser,
      viewport: newLog.viewport,
      sessionId: newLog.sessionId,
      ip: newLog.ip,
      httpMethod: newLog.httpMethod,
      endpoint: newLog.endpoint,
      statusCode: newLog.statusCode,
      durationMs: newLog.durationMs,
      dwellTimeMs: newLog.dwellTimeMs,
      fromPath: newLog.fromPath,
      toPath: newLog.toPath,
      changes: newLog.changes,
      description: newLog.description,
      transactionId: newLog.transactionId,
      hash: newLog.hash,
      ts: newLog.ts,
      tsFa: newLog.tsFa,
    },
    ipAddress: newLog.ip,
  }).catch((err) => {
    console.warn('Audit log persistence skipped or failed:', err);
  });
}
