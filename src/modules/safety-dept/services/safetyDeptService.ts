import { OperationalSafetyInspection, SafetyChecklistTypeTemplate, SafetyChecklistItem } from '../types';
import { addAuditLog } from '../../../utils/authHelper';
import { 
  calculateNextInspectionDate, 
  normalizeInspectionType, 
  InspectionAuditHistoryRecord,
  getTodayJalaliDate
} from '../../../utils/inspectionScheduleHelper';
import { apiDb } from '../../../services/apiDatabaseClient';

export const SAFETY_CHECKLIST_TEMPLATES: SafetyChecklistTypeTemplate[] = [
  {
    id: 'scaffolding',
    titleFa: 'چک‌لیست ایمنی داربست‌بندی و کار در ارتفاع',
    titleEn: 'Scaffolding & Working at Height Inspection',
    categoryFa: 'کار در ارتفاع',
    iconName: 'Building2',
    descriptionFa: 'بازرسی جامع قطعات، بست‌ها، زیرپایی‌ها، دستک‌ها، مهاربندی و الصاق تگ سبز داربست',
    standardRef: 'OSHA 1926.451 / BS EN 12811',
    defaultFrequency: 'هفتگی و قبل از عملیات',
    isActive: true,
    defaultItems: [
      {
        id: 'scaff_01',
        title: 'وضعیت زمین، تراز بودن و بیس‌پلیت (Base Plate / Sole Board)',
        category: 'فونداسیون و پایه‌ها',
        requirement: 'پایه‌های داربست بر روی زمین محکم و تراز قرار داشته و زیرپایه‌های چوبی و صفحات فلزی مناسب تعبیه شده باشد.',
        standardRef: 'OSHA 1926.451(c)(2)',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'scaff_02',
        title: 'استحکام لوله‌های عمودی (Standards) و افقی (Ledgers)',
        category: 'سازه و اسکلت',
        requirement: 'لوله‌ها بدون خمیدگی، زنگ‌زدگی شدید یا ترک بوده و با بست‌های استاندارد محکم شده باشند.',
        standardRef: 'OSHA 1926.451(b)',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'scaff_03',
        title: 'نصب مهاربندهای ضربدری و طولی (Bracing)',
        category: 'مهاربندی و پایداری',
        requirement: 'مهاربندهای زیگزاگ و ضربدری جهت جلوگیری از چرخش و نوسان جانبی در فواصل مقرر نصب باشند.',
        standardRef: 'OSHA 1926.451(c)(3)',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'scaff_04',
        title: 'تخته‌گذاری کامل سکوی کار (Working Platform)',
        category: 'سکوی کار',
        requirement: 'عرض سکو حداقل ۶۰ سانتی‌متر بوده، تخته‌ها بدون شکستگی و پوسیدگی محکم به هم بسته شده و فاصله خالی نداشته باشند.',
        standardRef: 'OSHA 1926.451(b)(1)',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'scaff_05',
        title: 'حفاظ‌های بالایی، میانی و قرنیز (Guardrails & Toeboard)',
        category: 'حفاظ‌های سقوط',
        requirement: 'حفاظ بالا در ارتفاع بین ۹۰ تا ۱۱۰ سانتی‌متر، حفاظ میانی در حدود ۵۰ سانتی‌متر و قرنیز پایی حداقل ۱۵ سانتی‌متر نصب باشد.',
        standardRef: 'OSHA 1926.451(g)(4)',
        isRequired: true,
        orderIndex: 5
      },
      {
        id: 'scaff_06',
        title: 'نردبان دسترسی استاندارد و ایمن به سکو',
        category: 'دسترسی',
        requirement: 'نردبان در زاویه مناسب (۱ به ۴) مهار شده و حداقل ۱ متر بالاتر از سکوی فرود امتداد یافته باشد.',
        standardRef: 'OSHA 1926.1053',
        isRequired: true,
        orderIndex: 6
      },
      {
        id: 'scaff_07',
        title: 'الصاق تگ بازرسی داربست (Scafftag)',
        category: 'وضعیت بازرسی و تگ',
        requirement: 'کارت سبز داربست با امضای بازرس مجاز داربست و تاریخ بازرسی دوره هفتگی در محل ورود الصاق شده باشد.',
        standardRef: 'HSE-MS Procedure',
        isRequired: true,
        orderIndex: 7
      }
    ]
  },
  {
    id: 'mobile-crane-inspection',
    titleFa: 'چک‌لیست بازدید دوره‌ای ایمنی جرثقیل متحرک',
    titleEn: 'Mobile Crane Periodic Safety Inspection',
    categoryFa: 'ماشین‌آلات و باربرداری',
    iconName: 'Truck',
    descriptionFa: 'بازرسی فنی و ایمنی جرثقیل‌های متحرک، بوم تلسکوپی، جک‌های تعادل، سیم‌بکسل، نشانگر بار (LMI) و گواهی سلامت',
    standardRef: 'ASME B30.5 / OSHA 1926.1412',
    defaultFrequency: 'ماهانه و قبل از عملیات',
    isActive: true,
    defaultItems: [
      {
        id: 'crane_01',
        title: 'اعتبار گواهینامه سلامت فنی جرثقیل و گواهینامه ویژه اپراتور',
        category: 'مستندات و مجوزها',
        requirement: 'گواهی بازرسی فنی معتبر (Third-Party) و گواهینامه ویژه اپراتوری جرثقیل با تناژ مربوطه در کابین موجود باشد.',
        standardRef: 'ASME B30.5-2.1',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'crane_02',
        title: 'سلامت جک‌های تعادل (Outriggers)، پلیت‌های زیرجکی و ترازسنج',
        category: 'پایداری و تعادل',
        requirement: 'کلیه جک‌های تعادل بدون نشتی روغن، دارای پلیت زیرجکی استاندارد بوده و به طور کامل باز شوند.',
        standardRef: 'ASME B30.5-3.2',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'crane_03',
        title: 'عملکرد سیستم محدودکننده گشتاور بار (LMI) و قطع‌کن ضد برخورد قلاب (Anti-Two-Block)',
        category: 'تجهیزات ایمنی هوشمند',
        requirement: 'نشانگر وزن بار، زاویه بوم و میکروسوئیچ قطع‌کن بالای بوم کاملاً سالم و کالیبره باشند.',
        standardRef: 'OSHA 1926.1416',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'crane_04',
        title: 'وضعیت سیم‌بکسل، قلاب اصلی و شیطانک ایمنی قلاب (Safety Latch)',
        category: 'تجهیزات باربرداری',
        requirement: 'سیم‌بکسل فاقد زدگی، رشته بریده یا تغییر شکل بوده و قلاب دارای ضامن ایمنی فنردار سالم باشد.',
        standardRef: 'ASME B30.5-2.4',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'crane_05',
        title: 'وضعیت بوم تلسکوپی، سیستم هیدرولیک، ترمزها و آلارم دنده عقب',
        category: 'سازه و مکانیک',
        requirement: 'بوم فاقد ترک یا تغییر شکل، شیلنگ‌های هیدرولیک بدون نشتی، و بوق دنده عقب و چراغ گردان فعال باشند.',
        standardRef: 'ASME B30.5-2.3',
        isRequired: true,
        orderIndex: 5
      },
      {
        id: 'crane_06',
        title: 'وجود جدول باربرداری (Load Chart) خوانا و کپسول آتش‌نشانی در کابین',
        category: 'کابین و ایمنی عمومی',
        requirement: 'جدول ظرفیت باربرداری متناسب با طول و زاویه بوم در دید اپراتور نصب بوده و کپسول شارژشده موجود باشد.',
        standardRef: 'OSHA 1926.1417',
        isRequired: true,
        orderIndex: 6
      }
    ]
  },
  {
    id: 'lifting',
    titleFa: 'چک‌لیست ایمنی عملیات باربرداری، جرثقیل و لیفتینگ',
    titleEn: 'Lifting & Rigging Operations Safety Checklist',
    categoryFa: 'باربرداری و ریگری',
    iconName: 'Scale',
    descriptionFa: 'کنترل ایمنی تجهیزات ریگری، اسلینگ‌ها، شگل‌ها، برنامه باربرداری (Lifting Plan)، ریگر مجاز و محصورسازی محدوده',
    standardRef: 'ASME B30.9 / OSHA 1926.251',
    defaultFrequency: 'قبل از عملیات و ماهانه',
    isActive: true,
    defaultItems: [
      {
        id: 'lift_01',
        title: 'تدوین و تأیید برنامه باربرداری (Lifting Plan) و محاسبه وزن بار نسبت به SWL',
        category: 'مهندسی و برنامه‌ریزی',
        requirement: 'وزن دقیق بار مشخص بوده و ضریب ایمنی ظرفیت مجاز باربرداری (SWL) رعایت شده باشد.',
        standardRef: 'ASME B30.5',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'lift_02',
        title: 'سلامت تسمه‌های باربرداری (Web Slings)، سیم‌بکسل‌ها و زنجیرها و پلاک مشخصات',
        category: 'تجهیزات ریگری',
        requirement: 'اسلینگ‌ها دارای تگ ظرفیت مجاز (SWL) خوانا و فاقد پارگی، سوختگی یا آسیب بافتی باشند.',
        standardRef: 'ASME B30.9',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'lift_03',
        title: 'سلامت شگل‌ها (Shackles)، پین‌های قفل‌دار و پیچ‌های چشمی استاندارد',
        category: 'اتصالات باربرداری',
        requirement: 'شگل‌ها دارای حک ظرفیت مجاز و پین اصلی استاندارد (غیردست‌ساز) بدون ساییدگی بیش از ۱۰٪ باشند.',
        standardRef: 'ASME B30.26',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'lift_04',
        title: 'حضور ریگر (Rigger / علامت‌دهنده) ذی‌صلاح و استفاده از طناب هدایت بار (Tag Line)',
        category: 'کنترل عملیات',
        requirement: 'ریگر آموزش‌دیده با جلیقه شبرنگ حضور داشته و حداقل دو طناب هدایت بار (Tag Line) به بار متصل باشد.',
        standardRef: 'OSHA 1926.1428',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'lift_05',
        title: 'محصورسازی شعاع چرخش بار، بررسی سرعت باد و فاصله ایمن از خطوط برق',
        category: 'ایمنی محیطی',
        requirement: 'محدوده زیر بار با نوار خطر مسدود شده، سرعت باد زیر حد مجاز بوده و تردد افراد از زیر بار ممنوع باشد.',
        standardRef: 'OSHA 1926.1425',
        isRequired: true,
        orderIndex: 5
      }
    ]
  },
  {
    id: 'forklift-inspection',
    titleFa: 'چک‌لیست بازرسی ایمنی لیفتراک و ماشین‌آلات صنعتی',
    titleEn: 'Industrial Forklift Safety Inspection',
    categoryFa: 'ماشین‌آلات صنعتی',
    iconName: 'Truck',
    descriptionFa: 'بازرسی شاخک‌ها، دکل، زنجیر بالابر، سیستم ترمز، کمربند ایمنی، چراغ گردان، بوق دنده عقب و پلاک ظرفیت لیفتراک',
    standardRef: 'OSHA 1910.178 / ANSI B56.1',
    defaultFrequency: 'روزانه و ماهانه',
    isActive: true,
    defaultItems: [
      {
        id: 'fork_01',
        title: 'سلامت شاخک‌ها (Forks)، پین‌های قفل شاخک و دکل بالابر (Mast)',
        category: 'سازه و سیستم بالابر',
        requirement: 'شاخک‌ها فاقد ترک، خمیدگی یا اختلاف ارتفاع بوده و پین‌های قفل‌کننده شاخک در جای خود سالم باشند.',
        standardRef: 'OSHA 1910.178(q)',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'fork_02',
        title: 'وضعیت زنجیرهای دکل، جک‌های هیدرولیک و عدم نشتی روغن یا سوخت',
        category: 'هیدرولیک و مکانیک',
        requirement: 'زنجیرها دارای کشش یکنواخت و روغن‌کاری مناسب بوده و جک‌ها و شیلنگ‌ها فاقد هرگونه نشتی باشند.',
        standardRef: 'ANSI B56.1',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'fork_03',
        title: 'عملکرد ترمز پایی، ترمز دستی، فرمان و وضعیت لاستیک‌ها',
        category: 'سیستم حرکتی و ترمز',
        requirement: 'ترمز سرویس و ترمز پارک در شیب عملکرد کامل داشته و لاستیک‌ها فاقد کندگی یا فرسودگی شدید باشند.',
        standardRef: 'OSHA 1910.178(p)',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'fork_04',
        title: 'سقف محافظ اپراتور (Overhead Guard)، کمربند ایمنی، آینه‌ها و صندلی',
        category: 'حفاظت اپراتور',
        requirement: 'سازه محافظ سقف سالم و کمربند ایمنی صندلی راننده کاملاً فعال و مورد استفاده باشد.',
        standardRef: 'OSHA 1910.178(e)',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'fork_05',
        title: 'چراغ گردان هشدار، بوق، آلارم دنده عقب، کپسول آتش‌نشانی و پلاک تناژ (SWL)',
        category: 'تجهیزات هشدار و ایمنی',
        requirement: 'پلاک ظرفیت مجاز باربرداری خوانا، آژیر دنده عقب و چراغ گردان فعال و کپسول آتش‌نشانی شارژشده نصب باشد.',
        standardRef: 'OSHA 1910.178(a)(3)',
        isRequired: true,
        orderIndex: 5
      }
    ]
  },
  {
    id: 'pressure-cylinders',
    titleFa: 'چک‌لیست بازدید دوره‌ای ایمنی سیلندرهای تحت فشار',
    titleEn: 'Pressure Cylinders Periodic Safety Inspection',
    categoryFa: 'تجهیزات تحت فشار و گازها',
    iconName: 'Flame',
    descriptionFa: 'بازرسی ایمنی نگهداری، حمل، مهاربندی، رگولاتورها، کلاهک محافظ، شعله‌برگردان (Flashback Arrestor) و تست هیدرواستاتیک سیلندرها',
    standardRef: 'OSHA 1910.101 / CGA P-1',
    defaultFrequency: 'ماهانه',
    isActive: true,
    defaultItems: [
      {
        id: 'cyl_01',
        title: 'مهاربندی عمودی سیلندرها با زنجیر یا بست فلزی و نصب کلاهک محافظ شیر (Valve Cap)',
        category: 'نگهداری و مهاربندی',
        requirement: 'کلیه سیلندرها به صورت عمودی با زنجیر به دیوار یا گاری مخصوص مهار شده و در حالت عدم مصرف دارای کلاهک محافظ باشند.',
        standardRef: 'OSHA 1910.253(b)(2)',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'cyl_02',
        title: 'نصب شعله‌برگردان (Flashback Arrestor) و شیر یک‌طرفه بر روی سیلندرهای اکسیژن و سوخت',
        category: 'تجهیزات ایمنی گاز',
        requirement: 'شعله‌برگردان استاندارد در خروجی رگولاتور و ورودی مشعل بر روی هر دو مسیر اکسیژن و استیلن/پروپان نصب باشد.',
        standardRef: 'NFPA 51B / OSHA 1926.350',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'cyl_03',
        title: 'سلامت مانومترها، رگولاتورها، شیلنگ‌های دوقلو و بست‌های استاندارد (عدم استفاده از سیم مفتول)',
        category: 'رگولاتور و اتصالات',
        requirement: 'گیج‌های فشار سالم و بدون شکستگی شیشه، شیلنگ‌ها بدون ترک‌خوردگی و دارای بست استاندارد و تست نشتی با کف صابون باشند.',
        standardRef: 'OSHA 1926.350(f)',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'cyl_04',
        title: 'جداسازی سیلندرهای اکسیژن از گازهای قابل اشتعال و مواد روغنی/گریس',
        category: 'چیدمان و جداسازی',
        requirement: 'فاصله حداقل ۶ متر یا دیوار ضدحریق بین انبارش سیلندرهای اکسیژن و گازهای سوختنی رعایت شده و شیرها عاری از هرگونه چربی باشند.',
        standardRef: 'OSHA 1910.253(b)(4)',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'cyl_05',
        title: 'اعتبار تاریخ تست هیدرواستاتیک، کد رنگ استاندارد، سایبان و تابلوهای هشداردهنده',
        category: 'استاندارد بدنه و محیط',
        requirement: 'بدنه سیلندر فاقد خوردگی یا فرورفتگی بوده، تاریخ تست هیدرواستاتیک معتبر و محل نگهداری دارای سایبان و تهویه باشد.',
        standardRef: 'OSHA 1910.101(a)',
        isRequired: true,
        orderIndex: 5
      }
    ]
  },
  {
    id: 'hot-work-safety',
    titleFa: 'چک‌لیست ایمنی کار گرم، جوشکاری و برشکاری',
    titleEn: 'Hot Work & Welding Safety Inspection',
    categoryFa: 'شعله، حرارت و جوشکاری',
    iconName: 'Flame',
    descriptionFa: 'کنترل الزامات پروانه کار گرم، گازسنجی LEL، پاکسازی مواد قابل اشتعال، پتوهای نسوز، اتصال زمین دستگاه جوش و نگهبان آتش',
    standardRef: 'OSHA 1910.252 / NFPA 51B',
    defaultFrequency: 'قبل از عملیات و دوره‌ای',
    isActive: true,
    defaultItems: [
      {
        id: 'hot_01',
        title: 'اخذ پروانه کار گرم معتبر و انجام گازسنجی مستمر محیط (LEL = 0%)',
        category: 'مجوز و گازسنجی',
        requirement: 'پروانه کار گرم امضاشده در محل موجود بوده و گازسنجی مواد قابل اشتعال در شعاع ۱۱ متری انجام و ثبت شده باشد.',
        standardRef: 'NFPA 51B Sec. 5',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'hot_02',
        title: 'پاکسازی مواد قابل اشتعال تا شعاع ۱۱ متری و پوشاندن درین‌ها و منهول‌ها با پتوی نسوز',
        category: 'ایزولاسیون محیطی',
        requirement: 'کلیه حوضچه‌ها، درین‌های صنعتی و شکاف‌ها با پتوی نسوز مرطوب پوشانده شده و مواد آتش‌گیر از محیط خارج شده باشند.',
        standardRef: 'OSHA 1910.252(a)(2)',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'hot_03',
        title: 'سلامت کابل‌ها، انبر جوشکاری، اتصال زمین (Earth) مستقیم به قطعه کار و کلید محافظ جان',
        category: 'ایمنی دستگاه جوش',
        requirement: 'کابل‌های جوش فاقد زدگی عایق یا وصله غیراستاندارد بوده و اتصال زمین در نزدیک‌ترین نقطه به محل جوشکاری برقرار باشد.',
        standardRef: 'OSHA 1910.254',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'hot_04',
        title: 'حفاظ صفحه سنگ‌فرز (Guard)، تطابق دور مجاز صفحه (RPM) و استفاده از شیلد و عینک',
        category: 'برشکاری و سنگ‌فرز',
        requirement: 'قاب محافظ سنگ‌فرز نصب بوده، دور مجاز صفحه بالاتر از دور دستگاه باشد و اپراتور از شیلد صورت و پیش‌بند چرمی استفاده نماید.',
        standardRef: 'OSHA 1910.215',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'hot_05',
        title: 'حضور نگهبان آتش (Fire Watch) آموزش‌دیده به همراه کپسول آتش‌نشانی آماده به کار',
        category: 'آمادگی اطفای حریق',
        requirement: 'نگهبان آتش با کپسول آتش‌نشانی متناسب در تمام طول عملیات و حداقل ۳۰ دقیقه پس از اتمام کار گرم در محل مستقر باشد.',
        standardRef: 'NFPA 51B Sec. 5.4',
        isRequired: true,
        orderIndex: 5
      }
    ]
  },
  {
    id: 'confined-space-safety',
    titleFa: 'چک‌لیست ایمنی ورود به فضاهای بسته و محدود',
    titleEn: 'Confined Space Entry Safety Inspection',
    categoryFa: 'فضاهای بسته (CSE)',
    iconName: 'Box',
    descriptionFa: 'بازرسی ایزولاسیون فرآیندی (Spading/Blinding)، تهویه مکانیکی، پایش گازها (O2, LEL, H2S, CO)، نفر نگهبان (Standby Man) و تجهیزات نجات',
    standardRef: 'OSHA 1910.146 / NFPA 350',
    defaultFrequency: 'قبل از ورود و حین عملیات',
    isActive: true,
    defaultItems: [
      {
        id: 'cse_01',
        title: 'ایزولاسیون کامل مکانیکی (Spading / Blinding) و قفل و تگ‌گذاری (LOTO) خطوط ورودی و خروجی',
        category: 'ایزولاسیون انرژی و سیال',
        requirement: 'کلیه خطوط متصل به مخزن یا فضای بسته با فلنج کور (Blind) مسدود شده و شیرها و همزن‌ها قفل و تگ‌گذاری شده باشند.',
        standardRef: 'OSHA 1910.146(d)(3)',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'cse_02',
        title: 'پایش و ثبت غلظت اکسیژن (۱۹.۵٪ تا ۲۳.۵٪)، گازهای قابل انفجار (LEL=0%) و گازهای سمی (H2S, CO)',
        category: 'گازسنجی اتمسفر',
        requirement: 'گازسنجی در طبقات مختلف فضای بسته با دستگاه کالیبره انجام شده و مقادیر در محدوده مجاز ایمن ثبت گردیده باشد.',
        standardRef: 'OSHA 1910.146(c)(5)',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'cse_03',
        title: 'برقراری تهویه مکانیکی دمنده/مکنده مستمر و استفاده از روشنایی ضدجرقه ولتاژ پایین (24V)',
        category: 'تهویه و روشنایی',
        requirement: 'فن تهویه هوای تازه بدون وقفه فعال بوده و چراغ‌های روشنایی داخل مخزن دارای ولتاژ ایمن (حداکثر ۲۴ ولت) و ضدانفجار باشند.',
        standardRef: 'NFPA 350',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'cse_04',
        title: 'استقرار نفر نگهبان (Hole Watch / Attendant) در ورودی و ثبت لیست ورود و خروج افراد',
        category: 'کنترل تردد و نظارت',
        requirement: 'نگهبان آموزش‌دیده در دهانه منهول مستقر بوده، ارتباط مستمر با افراد داخل داشته و برگه ثبت تردد (Entry Log) تکمیل شود.',
        standardRef: 'OSHA 1910.146(i)',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'cse_05',
        title: 'تجهیز نفرات به هارنس، طناب نجات (Lifeline)، سه‌پایه نجات (Tripod) و دستگاه تنفسی اضطراری (SCBA)',
        category: 'تجهیزات نجات اضطراری',
        requirement: 'وینچ و سه‌پایه نجات و دستگاه تنفسی SCBA آماده در ورودی فضای بسته مستقر بوده و نفرات دارای هارنس متصل به طناب نجات باشند.',
        standardRef: 'OSHA 1910.146(k)',
        isRequired: true,
        orderIndex: 5
      }
    ]
  },
  {
    id: 'electrical-safety',
    titleFa: 'چک‌لیست ایمنی برق، تابلوهای صنعتی و ایزولاسیون (LOTO)',
    titleEn: 'Electrical Panels & LOTO Safety Inspection',
    categoryFa: 'برق و ایزولاسیون انرژی',
    iconName: 'Zap',
    descriptionFa: 'بازرسی تابلوهای برق کارگاهی، کلید محافظ جان (RCD/GFCI)، سیستم ارتینگ، کابل‌کشی، قفل و تگ‌گذاری (LOTO) و فرش عایق',
    standardRef: 'NFPA 70E / OSHA 1910.147',
    defaultFrequency: 'ماهانه و قبل از تعمیرات',
    isActive: true,
    defaultItems: [
      {
        id: 'elec_01',
        title: 'نصب و عملکرد صحیح کلید محافظ جان (RCD / GFCI 30mA) در کلیه تابلوهای برق کارگاهی',
        category: 'حفاظت الکتریکی',
        requirement: 'کلید محافظ جان (RCD) در تابلو نصب بوده و با زدن دکمه تست (Test Button) بلافاصله مدار را قطع نماید.',
        standardRef: 'NFPA 70E / مبحث ۱۳ مقررات ملی',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'elec_02',
        title: 'اتصال بدنه تابلوها و تجهیزات به شبکه ارتینگ مجتمع و پیوستگی شمش ارت',
        category: 'سیستم اتصال زمین (Earthing)',
        requirement: 'سیم ارت استاندارد با رنگ زرد-سبز به بدنه فلزی تابلو و درب آن متصل بوده و مقاومت ارت در محدوده مجاز باشد.',
        standardRef: 'OSHA 1926.404(f)',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'elec_03',
        title: 'اجرای کامل فرآیند قفل و تگ‌گذاری (Lockout / Tagout - LOTO) و تست بی‌برقی پیش از تعمیرات',
        category: 'ایزولاسیون انرژی (LOTO)',
        requirement: 'کلید اصلی تجهیز در وضعیت قطع قفل شده، تگ اخطار با مشخصات تکنسین الصاق و تست عدم وجود ولتاژ انجام شده باشد.',
        standardRef: 'OSHA 1910.147',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'elec_04',
        title: 'سلامت عایق کابل‌ها، استفاده از سوکت و دوشاخه صنعتی (IP44/IP65) و عدم عبور کابل از مسیر تردد',
        category: 'کابل‌کشی و اتصالات',
        requirement: 'کابل‌ها فاقد زخمی‌شدگی بوده، اتصال مستقیم سیم لخت به پریز وجود نداشته و کابل‌ها در ارتفاع یا درون محافظ مکانیکی قرار گیرند.',
        standardRef: 'OSHA 1926.405',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'elec_05',
        title: 'وجود پوشش شینه‌های برق‌دار (Dead Front)، قفل درب تابلو، تابلو هشدار خطر برق و فرش عایق',
        category: 'ایمنی تابلو و محیط',
        requirement: 'اجزای برق‌دار داخل تابلو دارای محافظ پلکسی‌گلاس بوده، جلوی تابلوهای اصلی فرش عایق فشار قوی پهن و بدون مانع باشد.',
        standardRef: 'NFPA 70E Art. 130',
        isRequired: true,
        orderIndex: 5
      }
    ]
  },
  {
    id: 'excavation-safety',
    titleFa: 'چک‌لیست ایمنی عملیات حفاری و گودبرداری',
    titleEn: 'Excavation & Trenching Safety Inspection',
    categoryFa: 'حفاری و سازه‌های موقت',
    iconName: 'Shovel',
    descriptionFa: 'بازرسی شناسایی تأسیسات زیرزمینی (کابل، لوله)، پایداری و مهاربندی دیواره گود (Shoring)، فاصله دپوی خاک، راه دسترسی و محصورسازی',
    standardRef: 'OSHA 1926.651 / مبحث ۱۲ مقررات ملی',
    defaultFrequency: 'روزانه و قبل از شروع شیفت',
    isActive: true,
    defaultItems: [
      {
        id: 'exc_01',
        title: 'استعلام و شناسایی تأسیسات زیرزمینی (کابل‌های برق، خطوط لوله گاز، آب و فرآیند) پیش از حفاری',
        category: 'شناسایی خطوط زیرزمینی',
        requirement: 'مجوز حفاری با تایید واحدهای برق، ابزاردقیق و بهره‌برداری صادر شده و مسیر کابل‌ها و لوله‌ها با کابل‌یاب و گمانه‌زنی دستی مشخص باشد.',
        standardRef: 'OSHA 1926.651(b)',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'exc_02',
        title: 'مهاربندی دیواره‌های گود (Shoring / Sloping) و عدم وجود ترک یا ریزش در لبه‌های ترانشه',
        category: 'پایداری دیواره گود',
        requirement: 'در گودهای با عمق بیش از ۱.۲ متر، شیب‌بندی پله‌ای یا سازه نگهبان (سپرکوبی/مهاربندی) اجرا شده و لبه‌ها فاقد ترک باشند.',
        standardRef: 'OSHA 1926.652',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'exc_03',
        title: 'رعایت فاصله ایمن دپوی خاک حفاری‌شده و ماشین‌آلات سنگین از لبه گود (حداقل ۱ متر)',
        category: 'کنترل بارهای لبه گود',
        requirement: 'خاک ناشی از حفاری، مصالح و ماشین‌آلات حداقل ۱ متر (یا متناسب با عمق گود) از لبه ترانشه فاصله داشته باشند.',
        standardRef: 'OSHA 1926.651(j)(2)',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'exc_04',
        title: 'تعبیه نردبان و راه دسترسی ایمن خروج اضطراری در فواصل حداکثر ۷.۵ متری داخل ترانشه',
        category: 'دسترسی و خروج اضطراری',
        requirement: 'در گودهای با عمق بیش از ۱.۲ متر، نردبان مهارشده در حداکثر فاصله ۷.۵ متری کارگران تعبیه شده باشد.',
        standardRef: 'OSHA 1926.651(c)(2)',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'exc_05',
        title: 'محصورسازی پیرامون گود با حفاظ سخت، علائم هشداردهنده، چراغ چشمک‌زن شبانه و پل عابر استاندارد',
        category: 'حفاظت پیرامونی',
        requirement: 'اطراف گود با نیوجرسی یا حفاظ لوله‌ای محکم محصور شده، چراغ هشدار شبانه نصب و پل گذرگاه دارای هندریل استاندارد باشد.',
        standardRef: 'OSHA 1926.651(l)',
        isRequired: true,
        orderIndex: 5
      }
    ]
  },
  {
    id: 'general-patrol',
    titleFa: 'چک‌لیست گشت ایمنی عمومی و بازرسی دوره‌ای کارگاه',
    titleEn: 'General Site Safety Patrol Checklist',
    categoryFa: 'ایمنی عمومی و نظم کارگاهی',
    iconName: 'ShieldAlert',
    descriptionFa: 'بازرسی نظم و آراستگی کارگاه (Housekeeping)، مسیرهای خروج اضطراری، استفاده از PPE، ایمنی ابزارآلات، علائم هشدار و دوش و چشم‌شوی اضطراری',
    standardRef: 'ISO 45001 / آیین‌نامه حفاظت فنی',
    defaultFrequency: 'هفتگی و ماهانه',
    isActive: true,
    defaultItems: [
      {
        id: 'pat_01',
        title: 'استفاده کامل پرسنل و پیمانکاران از تجهیزات حفاظت فردی (PPE) متناسب با مخاطرات واحد',
        category: 'تجهیزات حفاظت فردی',
        requirement: 'کلیه نفرات دارای کلاه ایمنی، کفش ایمنی، لباس کار، عینک، دستکش و گوشی حفاظتی سالم و استاندارد باشند.',
        standardRef: 'OSHA 1910.132',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'pat_02',
        title: 'نظم و آراستگی محیط کار (Housekeeping)، باز بودن راهروها و عدم ریخت‌وپاش روغن یا ضایعات',
        category: 'نظم کارگاهی (5S)',
        requirement: 'مسیرهای تردد و پله‌ها عاری از مانع، لغزندگی و ضایعات بوده و قطعات و ابزارآلات در قفسه‌های مجاز چیدمان شوند.',
        standardRef: 'OSHA 1910.22',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'pat_03',
        title: 'وجود حفاظ ایمنی بر روی قطعات دوار، تسمه‌ها، کوپلینگ‌ها و شفت‌های انتقال نیرو (Machine Guarding)',
        category: 'حفاظ‌گذاری ماشین‌آلات',
        requirement: 'کلیه پمپ‌ها، کمپرسورها و قطعات چرخنده دارای گارد محافظ فلزی محکم و ایمن باشند.',
        standardRef: 'OSHA 1910.212',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'pat_04',
        title: 'دسترسی آزاد به کپسول‌های آتش‌نشانی، جعبه کمک‌های اولیه، دوش و چشم‌شوی اضطراری',
        category: 'تجهیزات واکنش در شرایط اضطراری',
        requirement: 'مقابل تجهیزات اطفا و دوش و چشم‌شوی اضطراری مسدود نبوده، فشار آب چشم‌شوی مناسب و مسیر خروج اضطراری مشخص باشد.',
        standardRef: 'OSHA 1910.151(c)',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'pat_05',
        title: 'نگهداری ایمن مواد شیمیایی، نصب برگه اطلاعات ایمنی (MSDS/SDS) و سینی حبس نشتی (Secondary Containment)',
        category: 'مواد شیمیایی و محیط کار',
        requirement: 'ظروف مواد شیمیایی دارای برچسب شناسایی (GHS) و سینی ضدنشت بوده و MSDS فارسی در دسترس پرسنل باشد.',
        standardRef: 'OSHA 1910.1200',
        isRequired: true,
        orderIndex: 5
      }
    ]
  }
];

const INITIAL_OPERATIONAL_INSPECTIONS: OperationalSafetyInspection[] = [];

const STORAGE_KEYS = {
  INSPECTIONS: 'hse_safety_dept_inspections_v1',
  TEMPLATES: 'hse_safety_dept_templates_v1',
  DELETED_TEMPLATES: 'safety_deleted_template_ids',
};

class SafetyDeptService {
  private inspections: OperationalSafetyInspection[] = [];
  private templates: SafetyChecklistTypeTemplate[] = [...SAFETY_CHECKLIST_TEMPLATES];
  private deletedTemplateIds: string[] = [];
  private isReloading = false;
  private hasInitialSynced = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadData();

      const handleRemoteMutation = (e: any) => {
        const entity = String(e?.detail?.key || e?.detail?.data?.key || e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
        if (entity.includes('safety')) {
          this.reloadFromServer();
        }
      };

      window.addEventListener('app_data_mutated', handleRemoteMutation);
    }
  }

  public async reloadFromServer() {
    await this.loadData();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_safety_inspections_updated'));
      window.dispatchEvent(new Event('hse_safety_templates_updated'));
    }
  }

  private async loadData() {
    if (this.isReloading) return;
    this.isReloading = true;
    try {
      const [dbInspections, deletedSetting, dbTemplates] = await Promise.all([
        apiDb.getSafetyInspections(),
        apiDb.getSetting(STORAGE_KEYS.DELETED_TEMPLATES),
        apiDb.getSafetyTemplates(),
      ]);

      if (dbInspections && dbInspections.length > 0) {
        this.inspections = dbInspections.map((insp: any) => {
          const normType = normalizeInspectionType(insp.inspectionType);
          let nextDate = insp.nextInspectionDate;
          if (normType === 'PERIODIC' && !nextDate && insp.inspectionDate) {
            nextDate = calculateNextInspectionDate(insp.inspectionDate, 'PERIODIC', 1);
          } else if (normType === 'PRE_OP' || normType === 'POST_OP') {
            nextDate = undefined; 
          }
          return {
            ...insp,
            inspectionType: normType,
            nextInspectionDate: nextDate,
            inspectionHistory: insp.inspectionHistory || []
          };
        });
      } else if (!this.hasInitialSynced) {
        this.inspections = [...INITIAL_OPERATIONAL_INSPECTIONS];
      }

      this.deletedTemplateIds = Array.isArray(deletedSetting) ? deletedSetting : [];
      
      let mergedTemplates: SafetyChecklistTypeTemplate[] = [];
      let needsSync = false;

      if (dbTemplates && Array.isArray(dbTemplates) && dbTemplates.length > 0) {
        mergedTemplates = [...dbTemplates];
        for (const defTmpl of SAFETY_CHECKLIST_TEMPLATES) {
          const exists = mergedTemplates.some(t => t.id === defTmpl.id);
          if (!exists && !this.deletedTemplateIds.includes(defTmpl.id)) {
            mergedTemplates.push({ ...defTmpl, isActive: true });
            needsSync = true;
          }
        }
      } else {
        mergedTemplates = SAFETY_CHECKLIST_TEMPLATES
          .filter(t => !this.deletedTemplateIds.includes(t.id))
          .map(t => ({ ...t, isActive: true }));
        if (!this.hasInitialSynced && dbTemplates !== null) {
          needsSync = true;
        }
      }

      for (const insp of this.inspections) {
        if (insp.checklistTypeId && !mergedTemplates.some(t => t.id === insp.checklistTypeId)) {
          mergedTemplates.push({
            id: insp.checklistTypeId,
            titleFa: insp.checklistTypeNameFa || insp.title || `چک‌لیست ${insp.checklistTypeId}`,
            titleEn: insp.checklistTypeId,
            categoryFa: 'چک‌لیست عملیاتی ثبت‌شده در ماژول',
            iconName: 'ShieldCheck',
            descriptionFa: `الگوی استخراج‌شده از چک‌لیست موجود در سوابق بازرسی (${insp.checklistTypeNameFa || insp.title})`,
            standardRef: 'HSE-MS Standard',
            defaultFrequency: 'دوره‌ای',
            isActive: true,
            defaultItems: (insp.items || []).map((it, idx) => ({
              id: it.itemId || `item-${insp.checklistTypeId}-${idx + 1}`,
              title: it.title,
              category: it.category || 'الزامات عمومی',
              requirement: it.requirement || '',
              standardRef: it.standardRef,
              isRequired: true,
              orderIndex: idx + 1
            }))
          });
          if (!this.hasInitialSynced) {
            needsSync = true;
          }
        }
      }

      this.templates = mergedTemplates;
      if (needsSync && !this.hasInitialSynced) {
        this.hasInitialSynced = true;
        await apiDb.saveAllSafetyTemplates(this.templates);
      } else {
        this.hasInitialSynced = true;
      }
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hse_safety_inspections_updated'));
        window.dispatchEvent(new Event('hse_safety_templates_updated'));
      }
    } catch (e) {
      console.error('Failed to load safety department data from DB:', e);
      if (this.inspections.length === 0) {
        this.inspections = [...INITIAL_OPERATIONAL_INSPECTIONS];
      }
      if (this.templates.length === 0) {
        this.templates = [...SAFETY_CHECKLIST_TEMPLATES];
      }
    } finally {
      this.isReloading = false;
    }
  }

  private saveInspections() {
    // Left empty intentionally, data is saved directly in saveInspection
  }

  private saveTemplates() {
    // Left empty intentionally
  }

  // --- INSPECTION METHODS ---
  public getAllInspections(): OperationalSafetyInspection[] {
    return [...this.inspections];
  }
  public getInspectionById(id: string): OperationalSafetyInspection | undefined {
    return this.inspections.find(i => i.id === id);
  }
  
  public saveInspection(inspection: Partial<OperationalSafetyInspection>, user: string = 'کاربر سیستم'): OperationalSafetyInspection {
    const isNew = !inspection.id;
    const now = new Date().toISOString();
    const items = inspection.items || [];
    const totalItems = items.length;
    const passedCount = items.filter(i => i.verdict === 'pass').length;
    const failedCount = items.filter(i => i.verdict === 'fail').length;
    const warningCount = items.filter(i => i.verdict === 'warning').length;
    const naCount = items.filter(i => i.verdict === 'na').length;
    const effectiveTotal = totalItems - naCount;
    const scorePercent = effectiveTotal > 0 ? Math.round((passedCount / effectiveTotal) * 100) : 100;
    
    let finalStatus: OperationalSafetyInspection['status'] = inspection.status || 'COMPLETED';
    if (failedCount > 0) {
      finalStatus = 'ACTION_REQUIRED';
    }

    const normType = normalizeInspectionType(inspection.inspectionType);
    const actualDate = inspection.inspectionDate || getTodayJalaliDate();

    // Auto-calculate or format next inspection date according to strict rules:
    // 1. PERIODIC: auto 1 month from ACTUAL inspection date unless explicitly overridden
    // 2. PRE_OP / POST_OP: NEVER generate annual/periodic dates (empty/undefined)
    // 3. ADHOC: only if manually set
    let computedNextDate: string | undefined = undefined;
    if (normType === 'PERIODIC') {
      if (inspection.nextInspectionDate && inspection.nextInspectionDate.trim() !== '') {
        computedNextDate = inspection.nextInspectionDate.trim();
      } else {
        computedNextDate = calculateNextInspectionDate(actualDate, 'PERIODIC', 1);
      }
    } else if (normType === 'ADHOC') {
      if (inspection.nextInspectionDate && inspection.nextInspectionDate.trim() !== '') {
        computedNextDate = inspection.nextInspectionDate.trim();
      }
    } else {
      // PRE_OP or POST_OP: ensure no periodic/annual date is stored
      computedNextDate = undefined;
    }
    
    let savedRecord: OperationalSafetyInspection;

    if (isNew) {
      const yearPrefix = '1404';
      const seq = String(this.inspections.length + 1).padStart(3, '0');
      const newId = `INSP-${yearPrefix}-${seq}`;

      const isReinspection = Boolean(inspection.isReinspection || inspection.previousInspectionId);
      const prevInspId = inspection.previousInspectionId;
      const rootInspId = inspection.rootInspectionId || prevInspId || newId;
      const reinspectionCycle = inspection.reinspectionCycle || (prevInspId ? 2 : 1);

      const initialHistory: InspectionAuditHistoryRecord[] = [
        {
          id: `hist-${Date.now()}`,
          timestamp: now,
          changedBy: user,
          action: isReinspection ? 'RE_INSPECTION_CREATED' : 'CREATED',
          inspectionDate: actualDate,
          newNextDueDate: computedNextDate,
          inspectionType: normType,
          relatedOperationId: inspection.relatedOperationId,
          relatedOperationTitle: inspection.relatedOperationTitle,
          previousInspectionId: prevInspId,
          notes: isReinspection
            ? `ثبت نوبت جدید (بازرسی دوره‌ای جدید نوبت ${reinspectionCycle}) - متصل به سابقه ${prevInspId}`
            : `ثبت اولیه بازرسی (${normType === 'PERIODIC' ? 'دوره‌ای' : normType === 'PRE_OP' ? 'قبل از عملیات' : normType === 'POST_OP' ? 'بعد از عملیات' : 'موردی'})`
        }
      ];

      const newRecord: OperationalSafetyInspection = {
        id: newId,
        checklistTypeId: inspection.checklistTypeId || 'general-patrol',
        checklistTypeNameFa: inspection.checklistTypeNameFa || 'چک‌لیست ایمنی',
        title: inspection.title || `بازرسی ایمنی ${newId}`,
        inspectionType: normType,
        periodicInterval: normType === 'PERIODIC' ? (inspection.periodicInterval || 'MONTHLY') : undefined,
        inspectionDate: actualDate,
        inspectionTime: inspection.inspectionTime || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        nextInspectionDate: computedNextDate,
        relatedOperationId: inspection.relatedOperationId,
        relatedOperationTitle: inspection.relatedOperationTitle,
        site: inspection.site || 'مجتمع',
        unit: inspection.unit || 'عملیات',
        areaLocation: inspection.areaLocation || 'محوطه سایت',
        inspectorName: inspection.inspectorName || user,
        inspectorCode: inspection.inspectorCode,
        supervisorName: inspection.supervisorName,
        hseManagerName: inspection.hseManagerName,
        contractorName: inspection.contractorName,
        permitNumber: inspection.permitNumber,
        machineryType: inspection.machineryType,
        machinerySpecs: inspection.machinerySpecs,
        machineryTonnage: inspection.machineryTonnage,
        machineryTagNumber: inspection.machineryTagNumber,
        status: finalStatus,
        scorePercent,
        totalItems,
        passedCount,
        failedCount,
        warningCount,
        naCount,
        items,
        findingsSummary: inspection.findingsSummary,
        immediateActionsTaken: inspection.immediateActionsTaken,
        recommendedCapa: inspection.recommendedCapa,
        photos: inspection.photos || [],
        parentScheduleId: inspection.parentScheduleId,
        isReinspection,
        previousInspectionId: prevInspId,
        rootInspectionId: rootInspId,
        reinspectionCycle,
        reinspectionNotes: inspection.reinspectionNotes,
        createdByUser: user,
        createdAt: now,
        updatedAt: now,
        inspectionHistory: initialHistory
      };

      // If this is a re-inspection, mark the preceding inspection as completed / fulfilled historical cycle
      // and log an audit note to link the lineage (without altering its original historical check items or verdicts)
      if (prevInspId) {
        const prevIdx = this.inspections.findIndex(i => i.id === prevInspId);
        if (prevIdx !== -1) {
          const prevRecord = this.inspections[prevIdx];
          const updatedPrevHistory = [
            {
              id: `hist-${Date.now()}-reinspect`,
              timestamp: now,
              changedBy: user,
              action: 'RE_INSPECTED' as const,
              inspectionDate: prevRecord.inspectionDate,
              inspectionType: prevRecord.inspectionType,
              notes: `انجام بازرسی دوره‌ای جدید در تاریخ ${actualDate} و ثبت نوبت جدید با شناسه ${newId} - این چک‌لیست با موفقیت انجام، تمدید و به بخش سوابق انجام‌شده منتقل گردید.`
            },
            ...(prevRecord.inspectionHistory || [])
          ];
          this.inspections[prevIdx] = {
            ...prevRecord,
            status: 'COMPLETED',
            isArchivedCycle: true,
            supersededByInspectionId: newId,
            completedCycleDate: actualDate,
            updatedAt: now,
            inspectionHistory: updatedPrevHistory
          };
          apiDb.saveSafetyInspection(this.inspections[prevIdx]).catch(e => console.error(e));
        }
      }

      this.inspections.unshift(newRecord);
      this.saveInspections();
      addAuditLog(user, isReinspection ? `ثبت بازرسی دوره‌ای جدید: ${newRecord.title} (${newRecord.id}) متصل به ${prevInspId}` : `ثبت چک‌لیست ایمنی عملیاتی جدید: ${newRecord.title} (${newRecord.id})`, 'واحد ایمنی');
      savedRecord = newRecord;
    } else {
      const idx = this.inspections.findIndex(i => i.id === inspection.id);
      if (idx === -1) {
        throw new Error('بازرسی مورد نظر یافت نشد');
      }
      const existing = this.inspections[idx];
      const prevNextDate = existing.nextInspectionDate;
      const prevDate = existing.inspectionDate;
      const prevType = existing.inspectionType;

      const history = [...(existing.inspectionHistory || [])];
      // Track history entry if key timing parameters changed
      if (prevDate !== actualDate || prevNextDate !== computedNextDate || prevType !== normType || existing.status !== finalStatus) {
        history.unshift({
          id: `hist-${Date.now()}`,
          timestamp: now,
          changedBy: user,
          action: prevDate !== actualDate ? 'SCHEDULE_RECALCULATED' : 'UPDATED',
          inspectionDate: actualDate,
          previousNextDueDate: prevNextDate,
          newNextDueDate: computedNextDate,
          inspectionType: normType,
          relatedOperationId: inspection.relatedOperationId || existing.relatedOperationId,
          relatedOperationTitle: inspection.relatedOperationTitle || existing.relatedOperationTitle,
          notes: prevDate !== actualDate ? `به‌روزرسانی تاریخ انجام بازرسی و محاسبه مجدد موعد بعدی` : `ویرایش مشخصات بازرسی و موعدها`
        });
      }

      const updatedRecord: OperationalSafetyInspection = {
        ...existing,
        ...inspection,
        inspectionType: normType,
        inspectionDate: actualDate,
        nextInspectionDate: computedNextDate,
        scorePercent,
        totalItems,
        passedCount,
        failedCount,
        warningCount,
        naCount,
        status: finalStatus,
        updatedAt: now,
        inspectionHistory: history
      };
      this.inspections[idx] = updatedRecord;
      this.saveInspections();
      addAuditLog(user, `به‌روزرسانی چک‌لیست ایمنی: ${updatedRecord.title} (${updatedRecord.id})`, 'واحد ایمنی');
      savedRecord = updatedRecord;
    }
    
    // Background sync to پایگاه داده DB via API
    apiDb.saveSafetyInspection(savedRecord).catch(e => console.error('Failed to sync inspection to DB:', e));

    return savedRecord;
  }

  public async deleteInspection(id: string, user: string = 'کاربر سیستم'): Promise<boolean> {
    const initialLen = this.inspections.length;
    this.inspections = this.inspections.filter(i => i.id !== id);
    if (this.inspections.length < initialLen) {
      this.saveInspections();
      await apiDb.deleteSafetyInspection(id).catch(e => console.error('Failed to delete inspection from DB:', e));
      addAuditLog(user, `حذف چک‌لیست ایمنی شناسه ${id}`, 'واحد ایمنی');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hse_safety_inspections_updated'));
      }
      return true;
    }
    return false;
  }

  // --- TEMPLATES METHODS ---
  public getAllTemplates(): SafetyChecklistTypeTemplate[] {
    return [...this.templates];
  }

  public getActiveTemplates(): SafetyChecklistTypeTemplate[] {
    return this.templates.filter(t => t.isActive !== false);
  }

  public getTemplateById(id: string): SafetyChecklistTypeTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  public async saveTemplate(template: SafetyChecklistTypeTemplate, user: string = 'کاربر سیستم'): Promise<boolean> {
    const idx = this.templates.findIndex(t => t.id === template.id);
    const now = new Date().toISOString();
    const updatedRecord: SafetyChecklistTypeTemplate = {
      ...template,
      isActive: template.isActive !== undefined ? template.isActive : true,
      defaultItems: template.defaultItems || [],
      updatedAt: now,
      createdAt: template.createdAt || now
    };

    if (idx !== -1) {
      this.templates[idx] = updatedRecord;
    } else {
      this.templates.push(updatedRecord);
    }

    if (this.deletedTemplateIds.includes(template.id)) {
      this.deletedTemplateIds = this.deletedTemplateIds.filter(id => id !== template.id);
      await apiDb.saveSetting(STORAGE_KEYS.DELETED_TEMPLATES, this.deletedTemplateIds);
    }

    await apiDb.saveAllSafetyTemplates(this.templates);
    addAuditLog(user, `ذخیره الگوی چک‌لیست ایمنی: ${template.titleFa} (${template.id})`, 'واحد ایمنی');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_safety_templates_updated'));
    }
    return true;
  }

  public async deleteTemplate(templateId: string, user: string = 'کاربر سیستم'): Promise<boolean> {
    const target = this.templates.find(t => t.id === templateId);
    if (!target) return false;

    this.templates = this.templates.filter(t => t.id !== templateId);
    if (!this.deletedTemplateIds.includes(templateId)) {
      this.deletedTemplateIds.push(templateId);
      await apiDb.saveSetting(STORAGE_KEYS.DELETED_TEMPLATES, this.deletedTemplateIds);
    }
    await apiDb.saveAllSafetyTemplates(this.templates);
    addAuditLog(user, `حذف الگوی چک‌لیست ایمنی: ${target.titleFa} (${templateId})`, 'واحد ایمنی');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_safety_templates_updated'));
    }
    return true;
  }

  public async restoreAllDefaultTemplates(user: string = 'کاربر سیستم'): Promise<boolean> {
    this.deletedTemplateIds = [];
    await apiDb.saveSetting(STORAGE_KEYS.DELETED_TEMPLATES, []);

    for (const defTmpl of SAFETY_CHECKLIST_TEMPLATES) {
      if (!this.templates.some(t => t.id === defTmpl.id)) {
        this.templates.push(JSON.parse(JSON.stringify({ ...defTmpl, isActive: true })));
      }
    }

    await apiDb.saveAllSafetyTemplates(this.templates);
    addAuditLog(user, 'بازیابی کامل الگوهای استاندارد چک‌لیست واحد ایمنی', 'واحد ایمنی');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_safety_templates_updated'));
    }
    return true;
  }

  public async addChecklistItem(
    templateId: string, 
    item: Omit<SafetyChecklistItem, 'id'>, 
    user: string = 'کاربر سیستم'
  ): Promise<SafetyChecklistItem> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('الگوی چک‌لیست مورد نظر یافت نشد.');

    const newItem: SafetyChecklistItem = {
      ...item,
      id: `item-${templateId}-${Date.now()}`,
      isRequired: item.isRequired !== undefined ? item.isRequired : true,
      responseType: item.responseType || 'verdict',
      orderIndex: (template.defaultItems?.length || 0) + 1,
      isCustom: true
    };

    if (!template.defaultItems) template.defaultItems = [];
    template.defaultItems.push(newItem);
    await this.saveTemplate(template, user);
    return newItem;
  }

  public async updateChecklistItem(
    templateId: string, 
    item: SafetyChecklistItem, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('الگوی چک‌لیست مورد نظر یافت نشد.');

    const idx = (template.defaultItems || []).findIndex(i => i.id === item.id);
    if (idx !== -1) {
      template.defaultItems[idx] = { ...item };
      await this.saveTemplate(template, user);
      return true;
    }
    return false;
  }

  public async deleteChecklistItem(
    templateId: string, 
    itemId: string, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('الگوی چک‌لیست مورد نظر یافت نشد.');

    const deletedItem = (template.defaultItems || []).find(i => i.id === itemId);
    template.defaultItems = (template.defaultItems || []).filter(i => i.id !== itemId);
    await this.saveTemplate(template, user);
    addAuditLog(user, `حذف بند کنترلی «${deletedItem?.title || itemId}» از الگوی ${template.titleFa}`, 'واحد ایمنی');
    return true;
  }

  public async reorderChecklistItems(
    templateId: string,
    items: SafetyChecklistItem[],
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('الگوی چک‌لیست مورد نظر یافت نشد.');

    template.defaultItems = items.map((it, idx) => ({ ...it, orderIndex: idx + 1 }));
    await this.saveTemplate(template, user);
    return true;
  }

  public async resetTemplateToDefault(
    templateId: string, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const defaultTemplate = SAFETY_CHECKLIST_TEMPLATES.find(t => t.id === templateId);
    if (!defaultTemplate) throw new Error('الگوی پیش‌فرض استاندارد یافت نشد.');

    const cloned: SafetyChecklistTypeTemplate = JSON.parse(JSON.stringify(defaultTemplate));
    cloned.isActive = true;
    await this.saveTemplate(cloned, user);
    addAuditLog(user, `بازنشانی الگوی ${defaultTemplate.titleFa} به استاندارد اولیه`, 'واحد ایمنی');
    return true;
  }

  // --- STATS & KPIs ---
  public getSafetyKpis() {
    const total = this.inspections.length;
    const completed = this.inspections.filter(i => i.status === 'COMPLETED').length;
    const actionRequired = this.inspections.filter(i => i.status === 'ACTION_REQUIRED').length;
    const avgScore = total > 0 ? Math.round(this.inspections.reduce((acc, curr) => acc + curr.scorePercent, 0) / total) : 100;
        
    let totalFailedItems = 0;
    let totalWarningItems = 0;
    this.inspections.forEach(i => {
      totalFailedItems += i.failedCount || 0;
      totalWarningItems += i.warningCount || 0;
    });
    return {
      total,
      completed,
      actionRequired,
      avgScore,
      totalFailedItems,
      totalWarningItems
    };
  }

  /**
   * Retrieves the full audit lineage / chain of re-inspections for a specific inspection.
   * Traverses backward through previousInspectionId and forward through child inspections.
   */
  public getInspectionLineage(inspectionId: string): OperationalSafetyInspection[] {
    const current = this.getInspectionById(inspectionId);
    if (!current) return [];

    const rootId = current.rootInspectionId || current.previousInspectionId || current.id;
    
    // Find all audits that share the same root, or point to each other in chain
    const lineage = this.inspections.filter(i => 
      i.id === rootId || 
      i.rootInspectionId === rootId || 
      i.previousInspectionId === rootId || 
      i.previousInspectionId === current.id ||
      i.id === current.previousInspectionId
    );

    // Sort lineage chronologically
    return lineage.sort((a, b) => {
      const cycleA = a.reinspectionCycle || 1;
      const cycleB = b.reinspectionCycle || 1;
      return cycleA - cycleB;
    });
  }

  /**
   * Prepares a clean new inspection payload for a Re-Inspection, preserving original history
   * and auto-calculating dates from real system date and interval.
   */
  public prepareReinspectionData(prev: OperationalSafetyInspection): Partial<OperationalSafetyInspection> {
    const today = getTodayJalaliDate();
    const interval = prev.periodicInterval || 'MONTHLY';
    const nextDate = calculateNextInspectionDate(today, 'PERIODIC', interval);
    const nextCycle = (prev.reinspectionCycle || 1) + 1;

    // Items: create clean items, carrying over notes from previous deficiencies for reference
    const items = (prev.items || []).map(item => ({
      itemId: item.itemId,
      title: item.title,
      category: item.category,
      standardRef: item.standardRef,
      verdict: 'pass' as const, // Reset to standard pass for fresh re-inspection
      comment: '',
      correctiveActionRequired: false,
      previousVerdict: item.verdict, // Preserved reference to what failed previously
      previousComment: item.comment
    }));

    return {
      checklistTypeId: prev.checklistTypeId,
      checklistTypeNameFa: prev.checklistTypeNameFa,
      title: `بازرسی دوره‌ای جدید - ${prev.checklistTypeNameFa} (نوبت ${nextCycle})`,
      inspectionType: 'PERIODIC',
      periodicInterval: interval,
      inspectionDate: today,
      inspectionTime: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      nextInspectionDate: nextDate,
      site: prev.site,
      unit: prev.unit,
      areaLocation: prev.areaLocation,
      supervisorName: prev.supervisorName,
      contractorName: prev.contractorName,
      permitNumber: prev.permitNumber,
      machineryType: prev.machineryType,
      machinerySpecs: prev.machinerySpecs,
      machineryTonnage: prev.machineryTonnage,
      machineryTagNumber: prev.machineryTagNumber,
      items,
      isReinspection: true,
      previousInspectionId: prev.id,
      rootInspectionId: prev.rootInspectionId || prev.id,
      reinspectionCycle: nextCycle,
      reinspectionNotes: `بازرسی دوره‌ای جدید نوبت ${nextCycle} پیرو سابقه ${prev.id} (مورخ ${prev.inspectionDate})`
    };
  }
}
export const safetyDeptService = new SafetyDeptService();
