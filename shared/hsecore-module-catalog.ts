/**
 * Canonical HSECORE navigation catalog shared by the frontend and AI backend.
 * Keep module and submodule identities here so slash analysis always follows the
 * same configured module tree that the application presents to users.
 */
export const HSECORE_SYSTEM_MODULES = [
  { key: 'dashboard', titleFa: 'داشبورد جامع مدیریتی', titleEn: 'Unified Executive Dashboard', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'داشبورد اصلی آمار، شاخص‌های کلیدی عملکرد HSE و تحلیل‌های کلی' },
  { key: 'heat', titleFa: 'پایش استرس گرمایی', titleEn: 'Thermal Heat Stress Monitor', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'پایش آنلاین شاخص WBGT، استرس گرمایی محیط و توصیه‌های ایمنی' },
  { key: 'hse-ms', titleFa: 'پایش نرخ رویدادها (TRIR)', titleEn: 'TRIR Incident Rate', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'محاسبه استاندارد نرخ رویدادهای قابل ثبت TRIR و ساعات کارکرد' },
  { key: 'reports', titleFa: 'گزارشات و تحلیل‌های آماری', titleEn: 'Statistical Reports & BI', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'گزارش‌های مدیریتی، نمودارهای تحلیلی و خروجی‌های جامع سیستم' },
  { key: 'ai-assistant', titleFa: 'هوش مصنوعی HSECORE', titleEn: 'HSECORE AI Assistant', groupId: 'dashboards', category: 'داشبوردها و تحلیل‌های آماری', enabled: true, descriptionFa: 'دستیار مستقل هوش مصنوعی محلی با ۱۰ مشاور تخصصی و استخراج داده‌های زنده سازمان' },
  { key: 'safety-unit', titleFa: 'واحد ایمنی و بازرسی‌ها', titleEn: 'Safety Operations Department', groupId: 'departments', category: 'دپارتمان‌های تخصصی HSE', enabled: true, descriptionFa: 'مدیریت نظارت بر ایمنی عملیاتی، چک‌لیست‌های تخصصی، ممیزی‌ها و گشت‌های ایمنی' },
  { key: 'fire-dept', titleFa: 'واحد آتش‌نشانی و امداد', titleEn: 'Fire Department & Emergency', groupId: 'departments', category: 'دپارتمان‌های تخصصی HSE', enabled: true, descriptionFa: 'مدیریت ناوگان آتش‌نشانی، تجهیزات اطفاء حریق و مانورهای عملیاتی' },
  { key: 'health-env', titleFa: 'واحد بهداشت و محیط زیست', titleEn: 'Health & Environment Department', groupId: 'departments', category: 'دپارتمان‌های تخصصی HSE', enabled: true, descriptionFa: 'پایش آلاینده‌های محیط زیست، معاینات طب کار و بهداشت حرفه‌ای' },
  { key: 'permit', titleFa: 'پروانه کار ایمن (PTW)', titleEn: 'Permit to Work (PTW)', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'صدور و گردش کار دیجیتال پروانه‌های کار گرم، سرد، حفاری و فضاهای بسته' },
  { key: 'ptw-audit', titleFa: 'ممیزی پروانه‌های کار (PTW Audit)', titleEn: 'Permit to Work Audit System', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'ممیزی جامع و چک‌لیست ۳۰ گانه انطباق سیستم صدور پروانه کار ایمن' },
  { key: 'risk', titleFa: 'ارزیابی ریسک هوشمند (AI JSA)', titleEn: 'AI Risk Assessment (JSA/FMEA)', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'شناسایی خطرات و ارزیابی ریسک با هوش مصنوعی بر اساس JSA / FMEA' },
  { key: 'ppe', titleFa: 'تجهیزات حفاظت فردی (PPE)', titleEn: 'PPE Matrix Management (OSHA)', groupId: 'safety_permits', category: 'مجوزهای کار و کنترل ریسک', enabled: true, descriptionFa: 'مدیریت تحویل، انقضا و استاندارد تجهیزات حفاظت فردی' },
  { key: 'incidents', titleFa: 'گزارشات ناهنجاری و حوادث', titleEn: 'Safety Incidents & Anomalies', groupId: 'incidents_compliance', category: 'رویدادها و انضباط ایمنی', enabled: true, descriptionFa: 'ثبت و تحلیل شبه‌حوادث، ناهنجاری‌های ایمنی و حوادث شغلی OSHA' },
  { key: 'warnings', titleFa: 'ثبت و پیگیری اخطارها', titleEn: 'Personnel Written Warnings', groupId: 'incidents_compliance', category: 'رویدادها و انضباط ایمنی', enabled: true, descriptionFa: 'ثبت و پیگیری اخطارهای کتبی ایمنی و عدم انطباق‌های پرسنلی' },
  { key: 'personnel-history', titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل', titleEn: 'Personnel 360° History Dossier', groupId: 'human_capital', category: 'سرمایه انسانی و آموزش', enabled: true, descriptionFa: 'جستجو و مشاهده پرونده ۳۶۰ درجه پرسنل شامل آموزش‌ها، اخطارها و PPE' },
  { key: 'training', titleFa: 'مدیریت و تقویم آموزش', titleEn: 'Training Management & Calendar', groupId: 'human_capital', category: 'سرمایه انسانی و آموزش', enabled: true, descriptionFa: 'سجلات دوره‌های آموزشی HSE، گواهینامه‌ها و آمار ساعات آموزش' },
  { key: 'documents', titleFa: 'دستورالعمل‌ها و مستندات', titleEn: 'Instructions & Documents', groupId: 'workflows', category: 'کارتابل و فرآیندهای سازمانی', enabled: true, descriptionFa: 'مدیریت جامع دستورالعمل‌ها، روش‌های اجرایی، گواهینامه‌ها و سرتیفیکیت تجهیزات، فرم‌ها و مستندات HSE' },
  { key: 'pending-documents', titleFa: 'کارتابل و اسناد در انتظار اقدام', titleEn: 'Documents Awaiting Action & Sign', groupId: 'workflows', category: 'کارتابل و فرآیندهای سازمانی', enabled: true, descriptionFa: 'کارتابل هوشمند مشاهده، بررسی، تأیید، رد، امضای دیجیتال و ارجاع اسناد و پروانه‌ها' },
  { key: 'non-conformances', titleFa: 'مدیریت عدم انطباق‌ها (CAPA)', titleEn: 'Non-Conformities & CAPA', groupId: 'workflows', category: 'کارتابل و فرآیندهای سازمانی', enabled: true, descriptionFa: 'سامانه جامع ثبت، ارجاع، علل ریشه‌ای و اقدامات اصلاحی و پیشگیرانه کلیه واحدها' },
  { key: 'process-management', titleFa: 'مدیریت فرآیندها (BPMN)', titleEn: 'Process Management (Camunda 8)', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'طراحی، مدل‌سازی و اجرای فرآیندهای سازمانی و گردش‌کارهای Camunda' },
  { key: 'notifications', titleFa: 'مدیریت هشدار و اعلان‌ها', titleEn: 'Alerts & Notifications Management', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'ارسال هشدار فوری HSE، مشاهده تاریخچه اعلان‌ها و دسترسی به آرشیو و بایگانی اعلان‌های سامانه' },
  { key: 'user-mgmt', titleFa: 'مدیریت کاربران و دسترسی‌ها', titleEn: 'User Management & RBAC Roles', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'مدیریت حساب‌های کاربری، نقش‌ها و ماتریس دسترسی به ماژول‌های سامانه' },
  { key: 'system', titleFa: 'تنظیمات و ساختار سازمانی', titleEn: 'System Settings & Architecture', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'پیکربندی سامانه، مدیریت ساختار سازمانی، لوگو و بازیابی پایگاه داده' },
  { key: 'profile', titleFa: 'شناسنامه و تنظیمات کاربری', titleEn: 'My Personal Profile & Security', groupId: 'system', category: 'مدیریت و پیکربندی سامانه', enabled: true, descriptionFa: 'مشخصات حساب کاربری جاری، تغییر رمز عبور و تنظیمات شخصی' },
] as const;

export const HSECORE_HEALTH_ENV_OVERVIEW = {
  key: 'comprehensive-dashboard',
  titleFa: 'داشبورد جامع مدیریتی',
  titleEn: 'Unified Executive Dashboard',
} as const;

export const HSECORE_DOCUMENTS_SUBITEMS = [
  { key: 'ORG_PROCEDURES', titleFa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی', titleEn: 'Organizational Procedures' },
  { key: 'EQUIPMENT_CERTIFICATES', titleFa: 'گواهینامه‌ها و سرتیفیکیت ماشین‌آلات و تجهیزات', titleEn: 'Machinery & Equipment Certificates' },
  { key: 'ORG_FORMS_CHECKLISTS', titleFa: 'فرم‌ها و چک‌لیست‌های سازمانی', titleEn: 'Organizational Forms & Checklists' },
  { key: 'OTHER_HSE_DOCS', titleFa: 'سایر مستندات مرتبط با HSE', titleEn: 'Other HSE Related Documents' },
] as const;

export const HSECORE_HEALTH_ENV_SUBITEMS = [
  { key: 'clinic', titleFa: 'بهداری و مراجعات سرپایی', titleEn: 'Dispensary & Clinic', group: 'health', enabled: true, descriptionFa: 'ثبت و مدیریت مراجعات بهداری، تریاژ، علائم حیاتی، اقدامات درمانی، داروها، استراحت پزشکی و اعزام آمبولانس' },
  { key: 'periodic-exams', titleFa: 'سامانه معاینات ادواری طب کار', titleEn: 'Periodic Medical Exams (Occupational Health)', group: 'health', enabled: true, descriptionFa: 'سامانه جامع معاینات ادواری، پرونده سلامت پرسنل، آزمایشگاه، ماژول BMI، مقایسه سالانه و ورود اکسل' },
  { key: 'non-periodic-exams', titleFa: 'معاینات غیر دوره‌ای', titleEn: 'Non-Periodic Exams', group: 'health', enabled: true, descriptionFa: 'معاینات بدو استخدام، بازگشت به کار و معاینات اختصاصی موردی' },
  { key: 'nutrition', titleFa: 'کارشناس تغذیه و رژیم‌درمانی', titleEn: 'Nutrition Specialist', group: 'health', enabled: true, descriptionFa: 'پایش وضعیت تغذیه، شاخص‌های آنتروپومتریک، عادات غذایی، برنامه‌ها و مشاوره‌های تخصصی پرسنل' },
  { key: 'health-env-checklists', titleFa: 'چک‌لیست‌های عملیاتی بهداشت و محیط زیست', titleEn: 'Operational Health & Environment Checklists', group: 'health', enabled: true, descriptionFa: 'چک‌لیست‌های ۵ گانه: بازدید اماکن و ساختمان‌ها، تسهیلات و آبدارخانه، رستوران، تجهیزات آمبولانس و توالت و دستشویی کارگاه' },
  { key: 'env-dashboard', titleFa: 'داشبورد محیط‌زیست', titleEn: 'Env Dashboard', group: 'env', enabled: true, descriptionFa: 'شاخص‌های کلی عملکرد محیط‌زیستی، آلاینده‌ها و پایش‌های خوداظهاری' },
  { key: 'env-monitoring', titleFa: 'پایش‌های محیط‌زیستی', titleEn: 'Environmental Monitoring', group: 'env', enabled: true, descriptionFa: 'سنجش و مانیتورینگ آنلاین آلاینده‌های هوا، صوت و عوامل محیطی' },
  { key: 'waste-management', titleFa: 'مدیریت پسماند (EMP)', titleEn: 'Waste Management (EMP)', group: 'env', enabled: true, descriptionFa: 'انبارش، انتقال، تفکیک و دفع اصولی پسماندهای صنعتی و خطرناک' },
  { key: 'wastewater', titleFa: 'مدیریت پساب (ETP)', titleEn: 'Wastewater (ETP)', group: 'env', enabled: true, descriptionFa: 'پایش پارامترهای کیفی پساب خروجی تصفیه‌خانه صنعتی و بهداشتی' },
  { key: 'air-water-soil', titleFa: 'پایش دودکش، آب و خاک', titleEn: 'Stacks, Water & Soil', group: 'env', enabled: true, descriptionFa: 'نمونه‌برداری دوره‌ای گازهای دودکش، آب شرب و چاه‌ها و خاک صنعتی' },
  { key: 'five-s', titleFa: 'ساماندهی 5S', titleEn: '5S System', group: 'env', enabled: true, descriptionFa: 'ممیزی نظام آراستگی محیط کار، ۵ اصل پاکیزگی و چک‌لیست‌های دوره‌ای' },
  { key: 'env-reports', titleFa: 'گزارش‌های محیط‌زیست', titleEn: 'Environment Reports', group: 'env', enabled: true, descriptionFa: 'گزارش‌های رسمی سازمان حفاظت محیط‌زیست و خروجی‌های آماری' },
] as const;

export const HSECORE_FIRE_DEPT_SUBITEMS = [
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
  { key: 'دوش و چشم شوی اضطراری', titleFa: 'دوش و چشم‌شوی‌های اضطراری ایمنی', titleEn: 'Emergency Eyewash & Safety Showers', type: 'category', enabled: true, descriptionFa: 'تست جریان آب، فشار، اهرم‌های فعال‌سازی و شستشوی اضطراری' },
] as const;

export const HSECORE_SAFETY_DEPT_SUBITEMS = [
  { key: 'dashboard', titleFa: 'داشبورد واحد ایمنی', titleEn: 'Overview Dashboard', group: 'operations', enabled: true, descriptionFa: 'داشبورد جامع نظارت، شاخص‌های انطباق بازرسی‌ها و نواقص باز ایمنی' },
  { key: 'checklists', titleFa: 'سوابق و اجرای بازرسی', titleEn: 'Execution & History', group: 'checklists', enabled: true, descriptionFa: 'ثبت، مدیریت، سوابق و ممیزی‌های میدانی بازرسی‌ها و چک‌لیست‌های تخصصی' },
] as const;
