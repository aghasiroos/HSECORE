import { 
  HealthEnvInspection, 
  HealthEnvChecklistTypeTemplate, 
  HealthEnvChecklistItem,
  HealthEnvChecklistType
} from '../types/checklistTypes';
import { apiDb, getAuthToken } from '../../../services/apiDatabaseClient';
import { getTodayJalaliDate, calculateNextInspectionDate } from '../../../utils/inspectionScheduleHelper';

const DELETED_TEMPLATES_STORAGE_KEY = 'hse_health_env_deleted_templates_v1';

export const HEALTH_ENV_CHECKLIST_TEMPLATES: HealthEnvChecklistTypeTemplate[] = [
  {
    id: 'premises-buildings',
    titleFa: 'چک‌لیست بازدید اماکن و ساختمان‌ها',
    titleEn: 'Premises & Buildings Hygiene Inspection',
    categoryFa: 'بهداشت محیط و اماکن',
    iconName: 'Building2',
    descriptionFa: 'ارزیابی بهداشت محیط کار، روشنایی، تهویه، نظافت ساختمانی، آب آشامیدنی، پسماند و کنترل ناقلین در ساختمان‌ها و اماکن مجتمع',
    standardRef: 'آیین‌نامه بهداشت محیط کار (وزارت بهداشت) / ISO 45001',
    defaultFrequency: 'ماهانه',
    defaultScheduleType: 'PERIODIC',
    defaultPeriodicInterval: 'MONTHLY',
    isActive: true,
    defaultItems: [
      {
        id: 'pb-1',
        title: 'بررسی روشنایی عمومی و موضعی، تابش نور مناسب و عدم خیرگی در دفاتر و فضاهای کاری',
        category: 'روشنایی و ارگونومی',
        requirement: 'تأمین شدت روشنایی استاندارد بدون سوسو زدن و خیرگی در کلیه ایستگاه‌های کاری و راهروها',
        standardRef: 'استاندارد روشنایی بهداشت حرفه‌ای',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'pb-2',
        title: 'وضعیت سیستم تهویه مطبوع، سرمایش، گرمایش و تعویض هوای سالم در محیط کار',
        category: 'تهویه و کیفیت هوا',
        requirement: 'عملکرد صحیح سیستم تهویه، تمیز بودن فیلترها و حفظ دما و رطوبت در محدوده آسایش حرارتی',
        standardRef: 'ASHRAE / آیین‌نامه تهویه',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'pb-3',
        title: 'نظافت کف، دیوارها، سقف، راهروها و عدم وجود رطوبت، کپک یا شکستگی کاشی و مصالح',
        category: 'بهداشت ساختمانی',
        requirement: 'سالم، قابل شستشو و پاکیزه بودن کلیه سطوح ساختمانی بدون نم‌زدگی و ترک‌خوردگی',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'pb-4',
        title: 'جمع‌آوری، تفکیک و تخلیه به‌موقع پسماندهای عادی و اداری و وجود سطل‌های دربدار استاندارد',
        category: 'مدیریت پسماند',
        requirement: 'استقرار سطل‌های زباله دربدار دارای کیسه و تفکیک پسماند خشک و تر با تخلیه روزانه',
        standardRef: 'قانون مدیریت پسماند / ISO 14001',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'pb-5',
        title: 'سلامت و بهداشت آب آشامیدنی، آبسردکن‌ها، فیلترهای تصفیه و در دسترس بودن لیوان یک‌بارمصرف',
        category: 'آب آشامیدنی',
        requirement: 'پاکیزگی آبسردکن‌ها، تعویض دوره‌ای فیلترها و تأمین آب آشامیدنی سالم و گوارا',
        standardRef: 'استاندارد ملی ۱۰۵۳ آب آشامیدنی',
        isRequired: true,
        orderIndex: 5
      },
      {
        id: 'pb-6',
        title: 'نصب توری سالم روی پنجره‌ها و دریچه‌ها و عدم مشاهده حشرات موذی یا جوندگان',
        category: 'کنترل ناقلین',
        requirement: 'انسداد کامل منافذ ورود آفات و اجرای منظم برنامه کنترل حشرات و جوندگان',
        standardRef: 'دستورالعمل کنترل ناقلین HSE',
        isRequired: true,
        orderIndex: 6
      },
      {
        id: 'pb-7',
        title: 'وضعیت نظافت و بهداشت نمازخانه، رختکن‌ها، کمدهای پرسنلی و فضاهای استراحت',
        category: 'فضاهای عمومی',
        requirement: 'نظافت مستمر، تهویه مناسب و نبود اقلام فاسدشدنی یا آلوده در کمدها و استراحتگاه‌ها',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 7
      },
      {
        id: 'pb-8',
        title: 'چیدمان ارگونومیک میز و صندلی، نظم محیطی (5S) و عدم انسداد مسیرهای تردد و خروج اضطراری',
        category: 'ارگونومی و 5S',
        requirement: 'رعایت اصول نظم و آراستگی، چیدمان استاندارد ایستگاه کار و باز بودن مسیرهای تردد',
        standardRef: 'دستورالعمل ارگونومی و 5S',
        isRequired: true,
        orderIndex: 8
      },
      {
        id: 'pb-9',
        title: 'وضعیت بهداشتی جعبه کمک‌های اولیه، تکمیل اقلام و کنترل تاریخ انقضای داروها و پانسمان‌ها',
        category: 'کمک‌های اولیه',
        requirement: 'نصب در محل قابل دسترس، تمیزی جعبه و معتبر بودن تاریخ مصرف کلیه اقلام مصوب',
        standardRef: 'آیین‌نامه کمک‌های اولیه کارگاهی',
        isRequired: true,
        orderIndex: 9
      },
      {
        id: 'pb-10',
        title: 'رعایت بهداشت فردی کارکنان خدمات، استفاده از لباس کار مناسب و ثبت سوابق شستشو و گندزدایی',
        category: 'بهداشت خدمات',
        requirement: 'استفاده از تجهیزات حفاظت فردی هنگام نظافت و تکمیل منظم برگه کنترل نظافت روزانه',
        standardRef: 'دستورالعمل بهداشت خدمات',
        isRequired: true,
        orderIndex: 10
      }
    ]
  },
  {
    id: 'pantries-kitchenettes',
    titleFa: 'چک‌لیست بازدید آبدارخانه‌ها',
    titleEn: 'Pantries & Kitchenettes Hygiene Inspection',
    categoryFa: 'بهداشت مواد غذایی و پذیرایی',
    iconName: 'Coffee',
    descriptionFa: 'بازرسی بهداشتی آبدارخانه‌های اداری و عملیاتی، کنترل کارت سلامت، یخچال، ظروف پذیرایی، مواد مصرفی و نظافت تجهیزات',
    standardRef: 'آیین‌نامه ماده ۱۳ قانون مواد خوردنی و آشامیدنی',
    defaultFrequency: 'ماهانه',
    defaultScheduleType: 'PERIODIC',
    defaultPeriodicInterval: 'MONTHLY',
    isActive: true,
    defaultItems: [
      {
        id: 'pk-1',
        title: 'دارا بودن کارت معاینه پزشکی معتبر و رعایت بهداشت فردی و لباس کار تمیز توسط متصدی آبدارخانه',
        category: 'بهداشت فردی',
        requirement: 'داشتن کارت بهداشت معتبر، ناخن‌های کوتاه و تمیز و استفاده از روپوش و دستکش مناسب',
        standardRef: 'آیین‌نامه ماده ۱۳ بهداشت',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'pk-2',
        title: 'نظافت سینک ظرفشویی، شیرآلات، وجود آب گرم و سرد و مایع ظرفشویی استاندارد',
        category: 'شستشو و نظافت',
        requirement: 'تأمین آب گرم و سرد، سالم بودن سینک و شیرآلات و استفاده از اسکاچ و دستمال تمیز',
        standardRef: 'آیین‌نامه ماده ۱۳ بهداشت',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'pk-3',
        title: 'وضعیت بهداشتی سماور، کتری، چای‌ساز و رسوب‌زدایی دوره‌ای تجهیزات دم‌آوری',
        category: 'تجهیزات پذیرایی',
        requirement: 'تمیزی بدنه و مخزن، عاری بودن از رسوب آهکی و ایمنی اتصالات برقی سماور و چای‌ساز',
        standardRef: 'دستورالعمل بهداشت آبدارخانه',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'pk-4',
        title: 'کنترل دمای یخچال (۱ تا ۴ درجه سانتی‌گراد)، نظافت قفسه‌ها و نگهداری مجزای مواد غذایی در ظروف دربدار',
        category: 'نگهداری مواد غذایی',
        requirement: 'سالم بودن لاستیک دور درب، تمیزی طبقات، عدم وجود برفک زیاد و تفکیک کامل مواد غذایی',
        standardRef: 'آیین‌نامه ماده ۱۳ بهداشت',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'pk-5',
        title: 'سلامت و تمیزی کابینت‌ها، سطوح کار (کانتر) و ظروف پذیرایی بدون لب‌پریدگی و ترک',
        category: 'ظروف و سطوح',
        requirement: 'خشک و تمیز بودن کابینت‌ها، عدم استفاده از لیوان یا ظرف لب‌پریده و نگهداری در جای محفوظ',
        standardRef: 'آیین‌نامه ماده ۱۳ بهداشت',
        isRequired: true,
        orderIndex: 5
      },
      {
        id: 'pk-6',
        title: 'کنترل تاریخ تولید و انقضای چای، قند، شکر، بیسکویت و سایر اقلام مصرفی',
        category: 'کنترل اقلام مصرفی',
        requirement: 'دارا بودن پروانه ساخت و تاریخ معتبر و نگهداری اقلام خشک در ظروف دربدار بهداشتی',
        standardRef: 'ضوابط ایمنی مواد غذایی',
        isRequired: true,
        orderIndex: 6
      },
      {
        id: 'pk-7',
        title: 'عملکرد صحیح هود و هواکش، عدم وجود چربی و بوی نامطبوع در فضای آبدارخانه',
        category: 'تهویه و هواکش',
        requirement: 'کارکرد مناسب هواکش، تمیز بودن فیلترها و تهویه مداوم بخار و رطوبت',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 7
      },
      {
        id: 'pk-8',
        title: 'وجود سطل زباله پدالی دربدار با کیسه زباله سالم و تخلیه منظم روزانه',
        category: 'مدیریت پسماند',
        requirement: 'سطل زباله قابل شستشو با درب پدالی سالم، کیسه زباله مناسب و شستشوی دوره‌ای سطل',
        standardRef: 'آیین‌نامه ماده ۱۳ بهداشت',
        isRequired: true,
        orderIndex: 8
      },
      {
        id: 'pk-9',
        title: 'وضعیت کف، دیوارها، کف‌شوی دارای توری و عدم وجود نشتی آب یا حشرات موذی',
        category: 'بهداشت ساختمانی',
        requirement: 'سالم و قابل شستشو بودن کاشی کف و دیوار، وجود کف‌شوی توری‌دار و نبود حشرات موذی',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 9
      },
      {
        id: 'pk-10',
        title: 'تفکیک مواد شوینده و ضدعفونی‌کننده از مواد غذایی و نگهداری آن‌ها در محل دارای برچسب',
        category: 'ایمنی مواد شیمیایی',
        requirement: 'نگهداری شوینده‌ها در کابینت جداگانه و قفل‌دار با برچسب مشخص و دور از مواد خوراکی',
        standardRef: 'دستورالعمل ایمنی شیمیایی HSE',
        isRequired: true,
        orderIndex: 10
      }
    ]
  },
  {
    id: 'restaurant-dining',
    titleFa: 'چک‌لیست پایش وضعیت رستوران',
    titleEn: 'Restaurant & Dining Hall Monitoring Checklist',
    categoryFa: 'بهداشت مواد غذایی و تغذیه',
    iconName: 'UtensilsCrossed',
    descriptionFa: 'پایش کامل بهداشت آشپزخانه، سردخانه‌ها، فرآیند طبخ و توزیع غذا، نمونه شاهد، ظروف و سالن غذاخوری مجتمع',
    standardRef: 'آیین‌نامه اجرایی ماده ۱۳ / HACCP / ISO 22000',
    defaultFrequency: 'روزانه',
    defaultScheduleType: 'PERIODIC',
    defaultPeriodicInterval: 'DAILY',
    isActive: true,
    defaultItems: [
      {
        id: 'rd-1',
        title: 'کارت سلامت معتبر پرسنل آشپزخانه و توزیع، استفاده کامل از روپوش، کلاه، ماسک و دستکش بهداشتی',
        category: 'بهداشت فردی کارکنان',
        requirement: 'داشتن کارت معاینه پزشکی معتبر برای کلیه پرسنل و رعایت کامل پوشش بهداشتی حین کار',
        standardRef: 'آیین‌نامه ماده ۱۳ / ISO 22000',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'rd-2',
        title: 'کنترل کیفیت، تاریخ انقضا، مجوزهای بهداشتی و شرایط حمل و تحویل مواد اولیه خام',
        category: 'مواد اولیه و انبار',
        requirement: 'انطباق کامل مواد اولیه با استانداردهای بهداشتی، سلامت بسته‌بندی و چیدمان روی پالت',
        standardRef: 'HACCP / ISO 22000',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'rd-3',
        title: 'کنترل و ثبت دمای سردخانه‌های زیر صفر و بالای صفر و رعایت اصل FIFO و جداسازی مواد خام و پخته',
        category: 'زنجیره سرما و سردخانه',
        requirement: 'دمای سردخانه بالای صفر بین ۱ تا ۴ و زیر صفر پایین‌تر از ۱۸- درجه با ثبت روزانه در لاگ‌شیت',
        standardRef: 'HACCP / ISO 22000',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'rd-4',
        title: 'بهداشت فرآیند آماده‌سازی، شستشو و گندزدایی سبزیجات و سالاد طبق دستورالعمل کلرزنی',
        category: 'آماده‌سازی مواد غذایی',
        requirement: 'انجام صحیح مراحل چهارگانه شستشو، انگل‌زدایی، گندزدایی و آبکشی با آب آشامیدنی سالم',
        standardRef: 'دستورالعمل وزارت بهداشت',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'rd-5',
        title: 'کنترل دمای پخت، نگهداری گرم غذا در بن‌ماری (بالای ۶۳ درجه سانتی‌گراد) و نگهداری نمونه شاهد ۴۸ ساعته',
        category: 'طبخ و نگهداری غذا',
        requirement: 'ثبت دمای مرکز غذا و برداشت روزانه نمونه شاهد حداقل ۱۰۰ گرم در ظرف استریل با برچسب تاریخ',
        standardRef: 'HACCP / دستورالعمل تغذیه',
        isRequired: true,
        orderIndex: 5
      },
      {
        id: 'rd-6',
        title: 'نظافت تجهیزات پخت، خط سلف‌سرویس، تمیز بودن سینی‌ها، قاشق و چنگال و ظروف سرو غذا',
        category: 'خط سرو و تجهیزات',
        requirement: 'پاکیزگی کامل دیگ‌ها، اجاق‌ها، هودها، کانتر سرو غذا و ضدعفونی مستمر سطوح تماس با غذا',
        standardRef: 'آیین‌نامه ماده ۱۳ بهداشت',
        isRequired: true,
        orderIndex: 6
      },
      {
        id: 'rd-7',
        title: 'عملکرد سیستم شستشوی ظروف (ماشین ظرفشویی صنعتی)، دمای آب شستشو و آبکشی بهداشتی',
        category: 'شستشوی ظروف',
        requirement: 'تأمین دمای استاندارد شستشو و آبکشی نهایی و عدم باقی ماندن چربی یا مواد شوینده روی ظروف',
        standardRef: 'ISO 22000',
        isRequired: true,
        orderIndex: 7
      },
      {
        id: 'rd-8',
        title: 'وضعیت بهداشتی سالن غذاخوری، میز و صندلی‌ها، سیستم تهویه و روشنایی مناسب',
        category: 'سالن غذاخوری',
        requirement: 'نظافت میز و صندلی‌ها پیش و پس از سرو، تهویه مطلوب و بهداشت کامل فضای غذاخوری',
        standardRef: 'آیین‌نامه ماده ۱۳ بهداشت',
        isRequired: true,
        orderIndex: 8
      },
      {
        id: 'rd-9',
        title: 'کنترل کف‌شوی‌ها، چربی‌گیر فاضلاب آشپزخانه، توری درها و پنجره‌ها و برنامه منظم کنترل آفات',
        category: 'زیرساخت و کنترل آفات',
        requirement: 'تخلیه دوره‌ای چربی‌گیر، سلامت توری‌ها و پرده هوا و عدم مشاهده هرگونه آفت یا جونده',
        standardRef: 'دستورالعمل کنترل آفات HSE',
        isRequired: true,
        orderIndex: 9
      },
      {
        id: 'rd-10',
        title: 'جمع‌آوری بهداشتی پسماندهای تر و خشک، شستشوی سطل‌های زباله و نظافت سرویس بهداشتی پرسنل آشپزخانه',
        category: 'پسماند و تسهیلات',
        requirement: 'تخلیه سریع پسماندهای غذایی در اتاق زباله خنک و مجزا و بهداشت کامل رختکن و سرویس پرسنل',
        standardRef: 'قانون مدیریت پسماند / ماده ۱۳',
        isRequired: true,
        orderIndex: 10
      }
    ]
  },
  {
    id: 'ambulance-equipment',
    titleFa: 'چک‌لیست بازدید و کنترل تجهیزات آمبولانس',
    titleEn: 'Ambulance & Emergency Medical Equipment Inspection',
    categoryFa: 'امداد، فوریت‌های پزشکی و آمبولانس',
    iconName: 'Ambulance',
    descriptionFa: 'کنترل روزانه آماده‌به‌کاری خودروی آمبولانس، سیستم اکسیژن‌رسانی، دستگاه‌های احیا، داروهای اورژانسی و بهداشت کابین بیمار',
    standardRef: 'استاندارد اورژانس ۱۱۵ / دستورالعمل امداد و انتقال مصدوم HSE',
    defaultFrequency: 'روزانه',
    defaultScheduleType: 'PERIODIC',
    defaultPeriodicInterval: 'DAILY',
    isActive: true,
    defaultItems: [
      {
        id: 'ae-1',
        title: 'سلامت فنی خودرو، سیستم برق، چراغ گردان، آژیر اضطراری، بی‌سیم و آماده به کار بودن سوخت',
        category: 'آماده‌به‌کاری خودرو',
        requirement: 'عدم نقص فنی، سطح سوخت بالای سه‌چهارم باک و عملکرد صحیح چراغ گردان، آژیر و ارتباط رادیویی',
        standardRef: 'استاندارد اورژانس ۱۱۵',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'ae-2',
        title: 'وضعیت نظافت، شستشو و گندزدایی کابین بیمار، برانکارد اصلی، اسکوپ و لانگ بک‌بورد پس از هر ماموریت',
        category: 'بهداشت کابین و برانکارد',
        requirement: 'گندزدایی کامل سطوح، ملحفه تمیز و یک‌بارمصرف و سلامت قفل و کمربندهای ایمنی برانکارد',
        standardRef: 'دستورالعمل کنترل عفونت',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'ae-3',
        title: 'کنترل فشار و شارژ کپسول اکسیژن مرکزی و پرتابل، مانومتر، فلومتر و ماسک‌های اکسیژن‌تراپی',
        category: 'سیستم اکسیژن‌رسانی',
        requirement: 'فشار کافی کپسول‌ها، عدم نشتی اتصالات و موجودی کامل ماسک ساده، مخزن‌دار و نازال کانولا',
        standardRef: 'استاندارد تجهیزات آمبولانس',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'ae-4',
        title: 'تست عملکرد دستگاه الکتروشوک (AED / Defibrillator)، سلامت باتری، پدها و ژل مربوطه',
        category: 'تجهیزات احیای قلبی',
        requirement: 'شارژ کامل باتری دستگاه، معتبر بودن تاریخ پدها و انجام تست روزانه (Self-Test) موفق',
        standardRef: 'استاندارد تجهیزات احیا',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'ae-5',
        title: 'کنترل عملکرد دستگاه ساکشن پرتابل و ثابت، پالس‌اکسیمتر، فشارسنج و گلوکومتر',
        category: 'تجهیزات پایش و ساکشن',
        requirement: 'مکش استاندارد ساکشن، تمیزی مخزن و سلامت باتری و کالیبراسیون ابزارهای پایش علائم حیاتی',
        standardRef: 'استاندارد اورژانس ۱۱۵',
        isRequired: true,
        orderIndex: 5
      },
      {
        id: 'ae-6',
        title: 'تکمیل کیف احیا (تراما و لوله‌گذاری)، آمبوبگ بزرگسال و کودک، لارنگوسکوپ و ایروی‌ها',
        category: 'مدیریت راه هوایی',
        requirement: 'تکمیل بودن سایزهای لوله تراشه، سلامت چراغ و باتری لارنگوسکوپ و پلمپ معتبر کیف احیا',
        standardRef: 'پروتکل احیای پیشرفته ACLS',
        isRequired: true,
        orderIndex: 6
      },
      {
        id: 'ae-7',
        title: 'کنترل موجودی، چیدمان و تاریخ انقضای سرم‌ها، داروهای اورژانسی و آنژیوکت‌ها در جعبه دارویی',
        category: 'داروها و سرم‌های اورژانس',
        requirement: 'عدم وجود داروی تاریخ‌گذشته، انطباق موجودی با لیست مصوب و حفظ دمای استاندارد نگهداری دارو',
        standardRef: 'دستورالعمل دارویی بهداری',
        isRequired: true,
        orderIndex: 7
      },
      {
        id: 'ae-8',
        title: 'موجودی کامل ست پانسمان استریل، باند سوختگی، تورنیکت، کلار گردنی و آتل‌های بادی/اسپلینت',
        category: 'تجهیزات تروما و پانسمان',
        requirement: 'دسترس‌پذیری فوری، استریل بودن پانسمان‌ها و سلامت کامل تجهیزات بی‌حرکت‌سازی مصدوم',
        standardRef: 'پروتکل تروما ATLS / 115',
        isRequired: true,
        orderIndex: 8
      },
      {
        id: 'ae-9',
        title: 'وجود و آماده به کار بودن کپسول اطفای حریق، تجهیزات حفاظت فردی امدادگران (دستکش، ماسک، گان) و سیفتی‌باکس',
        category: 'ایمنی و حفاظت فردی',
        requirement: 'شارژ معتبر خاموش‌کننده، موجودی کامل PPE و تخلیه به‌موقع ظرف ایمن پسماندهای تیز و برنده',
        standardRef: 'دستورالعمل ایمنی آمبولانس HSE',
        isRequired: true,
        orderIndex: 9
      },
      {
        id: 'ae-10',
        title: 'تکمیل دفترچه ثبت ماموریت‌ها، گواهی معاینه فنی، بیمه خودرو و سیستم تهویه و روشنایی کابین عقب',
        category: 'مستندات و تهویه کابین',
        requirement: 'به‌روز بودن مدارک خودرو، ثبت تحویل شیفت و عملکرد بی‌نقص سیستم سرمایش، گرمایش و نور کابین',
        standardRef: 'آیین‌نامه مدیریت ناوگان امداد',
        isRequired: true,
        orderIndex: 10
      }
    ]
  },
  {
    id: 'workshop-restrooms',
    titleFa: 'چک‌لیست بازرسی از تسهیلات بهداشتی کارگاه ـ توالت و دستشویی',
    titleEn: 'Workshop Sanitary Facilities (Restrooms & Washrooms) Inspection',
    categoryFa: 'بهداشت تسهیلات و سرویس‌های بهداشتی',
    iconName: 'Bath',
    descriptionFa: 'بازرسی بهداشتی سرویس‌های بهداشتی، دستشویی‌ها و دوش‌های کارگاهی، کنترل نظافت، تهویه، شیرآلات، مواد شوینده و پسماند',
    standardRef: 'آیین‌نامه بهداشت محیط کار (فصل تسهیلات بهداشتی)',
    defaultFrequency: 'ماهانه',
    defaultScheduleType: 'PERIODIC',
    defaultPeriodicInterval: 'MONTHLY',
    isActive: true,
    defaultItems: [
      {
        id: 'wr-1',
        title: 'نظافت، شستشو و گندزدایی منظم کف، دیوارها، کاسه توالت (ایرانی و فرنگی) و روشویی‌ها',
        category: 'نظافت و گندزدایی',
        requirement: 'تمیز، عاری از لکه و جرم و گندزدایی‌شده بودن کلیه سطوح و تجهیزات سرویس‌های بهداشتی',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 1
      },
      {
        id: 'wr-2',
        title: 'سلامت شیرآلات، شلنگ‌های بهداشتی، فلاش‌تانک‌ها و عدم وجود نشتی یا چکه آب',
        category: 'تاسیسات و شیرآلات',
        requirement: 'عملکرد صحیح کلیه شیرهای آب، فلاش‌تانک‌ها و شلنگ‌ها بدون نشتی و هدررفت آب',
        standardRef: 'دستورالعمل تاسیسات بهداشتی',
        isRequired: true,
        orderIndex: 2
      },
      {
        id: 'wr-3',
        title: 'وجود و شارژ کامل مخزن مایع دستشویی و در دسترس بودن دستمال کاغذی یا خشک‌کن برقی سالم',
        category: 'ملزومات بهداشت فردی',
        requirement: 'تأمین دائمی مایع دستشویی استاندارد و وسیله خشک‌کردن بهداشتی دست‌ها در تمامی روشویی‌ها',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 3
      },
      {
        id: 'wr-4',
        title: 'عملکرد مناسب سیستم تهویه و هواکش و عدم انتشار بوی نامطبوع در فضای سرویس و کارگاه',
        category: 'تهویه و هواکش',
        requirement: 'روشن و سالم بودن هواکش مکانیکی با مکش مؤثر و نبود بوی نامطبوع فاضلاب',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 4
      },
      {
        id: 'wr-5',
        title: 'تأمین آب گرم و سرد کافی، فشار مناسب آب و سالم بودن سیفون و کف‌شوی‌های فاضلاب',
        category: 'آب و فاضلاب',
        requirement: 'جریان مناسب آب گرم و سرد، تخلیه سریع فاضلاب و نبود گرفتگی یا پس‌زدگی در کف‌شوی‌ها',
        standardRef: 'ضوابط بهداشت محیط کارگاه',
        isRequired: true,
        orderIndex: 5
      },
      {
        id: 'wr-6',
        title: 'سلامت کاشی‌ها، سرامیک‌ها، آینه‌ها، قفل و لولای درب کابین‌ها و روشنایی کافی فضای داخلی',
        category: 'ایمنی و ساختمان سرویس',
        requirement: 'سالم بودن کاشی کف و دیوار بدون لغزندگی، کارکرد صحیح قفل درب‌ها و روشنایی کافی',
        standardRef: 'آیین‌نامه بهداشت محیط کار',
        isRequired: true,
        orderIndex: 6
      },
      {
        id: 'wr-7',
        title: 'وجود سطل زباله دربدار پدالی دارای کیسه در کلیه کابین‌ها و تخلیه بهداشتی روزانه',
        category: 'مدیریت پسماند',
        requirement: 'قرارگیری سطل دربدار پدالی تمیز با کیسه در هر کابین و تخلیه منظم پیش از پر شدن',
        standardRef: 'قانون مدیریت پسماند',
        isRequired: true,
        orderIndex: 7
      },
      {
        id: 'wr-8',
        title: 'نصب توری سالم روی پنجره‌ها و دریچه‌ها و عدم وجود حشرات موذی و جوندگان',
        category: 'کنترل ناقلین',
        requirement: 'پنجره‌های دارای توری سالم و انسداد کامل مسیرهای ورود حشرات و جوندگان',
        standardRef: 'دستورالعمل کنترل ناقلین HSE',
        isRequired: true,
        orderIndex: 8
      },
      {
        id: 'wr-9',
        title: 'نصب و تکمیل جدول برنامه شستشو و گندزدایی روزانه با امضای مسئول خدمات و ناظر',
        category: 'پایش و مستندسازی',
        requirement: 'نصب چک‌لیست کنترل نظافت در ورودی سرویس و ثبت نوبت‌های نظافت با تاریخ و ساعت',
        standardRef: 'سیستم مدیریت HSE',
        isRequired: true,
        orderIndex: 9
      },
      {
        id: 'wr-10',
        title: 'تناسب تعداد چشمه‌های سرویس بهداشتی و دوش‌ها با تعداد پرسنل کارگاه و تفکیک مناسب فضاها',
        category: 'ظرفیت و استاندارد کارگاه',
        requirement: 'کفایت تعداد توالت، روشویی و حمام کارگاهی متناسب با نفرات شاغل و تابلوگذاری مناسب',
        standardRef: 'آیین‌نامه بهداشت محیط کار (وزارت کار)',
        isRequired: true,
        orderIndex: 10
      }
    ]
  }
];

const INITIAL_HEALTH_ENV_INSPECTIONS: HealthEnvInspection[] = [];

class HealthEnvChecklistService {
  private inspections: HealthEnvInspection[] = [];
  private templates: HealthEnvChecklistTypeTemplate[] = HEALTH_ENV_CHECKLIST_TEMPLATES.map(t => ({
    ...t,
    defaultItems: t.defaultItems.map(item => ({ ...item }))
  }));
  private deletedTemplateIds: string[] = [];
  private isLoaded = false;
  private isReloading = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadData();

      const handleRemoteMutation = (e: any) => {
        const entity = String(e?.detail?.key || e?.detail?.data?.key || e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
        if (entity.includes('health_env')) {
          this.reloadFromServer();
        }
      };
      window.addEventListener('app_data_mutated', handleRemoteMutation);
      window.addEventListener('hse_auth_state_changed', () => {
        if (getAuthToken()) {
          void this.reloadFromServer();
        }
      });
    }
  }

  public async reloadFromServer() {
    if (!getAuthToken()) return;
    await this.loadData();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_inspections_updated'));
      window.dispatchEvent(new Event('hse_health_env_templates_updated'));
    }
  }

  private async loadData() {
    if (this.isReloading || !getAuthToken()) return;
    this.isReloading = true;
    try {
      const [dbInspections, dbTemplates, deletedSetting] = await Promise.all([
        apiDb.getHealthEnvInspections(),
        apiDb.getHealthEnvTemplates(),
        apiDb.getSetting(DELETED_TEMPLATES_STORAGE_KEY),
      ]);

      if (dbInspections && Array.isArray(dbInspections) && dbInspections.length > 0) {
        this.inspections = dbInspections;
      } else if (!this.isLoaded) {
        this.inspections = [...INITIAL_HEALTH_ENV_INSPECTIONS];
      }

      this.deletedTemplateIds = Array.isArray(deletedSetting) ? deletedSetting : [];

      let mergedTemplates: HealthEnvChecklistTypeTemplate[] = [];
      let needsSync = false;

      if (dbTemplates && Array.isArray(dbTemplates) && dbTemplates.length > 0) {
        mergedTemplates = [...dbTemplates];
        for (const defTmpl of HEALTH_ENV_CHECKLIST_TEMPLATES) {
          const exists = mergedTemplates.some(t => t.id === defTmpl.id);
          if (!exists && !this.deletedTemplateIds.includes(defTmpl.id)) {
            mergedTemplates.push({
              ...defTmpl,
              isActive: true,
              defaultItems: defTmpl.defaultItems.map(i => ({ ...i }))
            });
            needsSync = true;
          }
        }
      } else {
        mergedTemplates = HEALTH_ENV_CHECKLIST_TEMPLATES
          .filter(t => !this.deletedTemplateIds.includes(t.id))
          .map(t => ({
            ...t,
            isActive: true,
            defaultItems: t.defaultItems.map(i => ({ ...i }))
          }));
        if (mergedTemplates.length > 0) {
          needsSync = true;
        }
      }

      // Recover any custom templates referenced in historical inspections that are missing from templates
      for (const insp of this.inspections) {
        if (insp.checklistTypeId && !mergedTemplates.some(t => t.id === insp.checklistTypeId)) {
          mergedTemplates.push({
            id: insp.checklistTypeId,
            titleFa: insp.checklistTypeNameFa || insp.title || `چک‌لیست ${insp.checklistTypeId}`,
            titleEn: String(insp.checklistTypeId),
            categoryFa: 'چک‌لیست عملیاتی ثبت‌شده در ماژول',
            iconName: 'ShieldCheck',
            descriptionFa: `الگوی بازیابی‌شده از سوابق بازرسی (${insp.checklistTypeNameFa || insp.title})`,
            standardRef: 'HSE-MS Standard',
            defaultFrequency: 'ماهانه',
            defaultScheduleType: insp.scheduleType || 'PERIODIC',
            defaultPeriodicInterval: insp.periodicInterval || 'MONTHLY',
            isActive: true,
            defaultItems: (insp.items || []).map((it, idx) => ({
              id: it.itemId || `item-${insp.checklistTypeId}-${idx + 1}`,
              title: it.title,
              category: it.category || 'بهداشت عمومی',
              requirement: it.requirement || '',
              standardRef: it.standardRef,
              isRequired: true,
              orderIndex: idx + 1
            }))
          });
          needsSync = true;
        }
      }

      this.templates = mergedTemplates;
      if (needsSync) {
        await apiDb.saveAllHealthEnvTemplates(this.templates).catch(() => {});
      }

      this.isLoaded = true;
    } catch (err) {
      console.error('Error loading Health & Env Checklists from پایگاه داده:', err);
      if (this.inspections.length === 0) {
        this.inspections = [...INITIAL_HEALTH_ENV_INSPECTIONS];
      }
      if (this.templates.length === 0) {
        this.templates = HEALTH_ENV_CHECKLIST_TEMPLATES.map(t => ({
          ...t,
          defaultItems: t.defaultItems.map(i => ({ ...i }))
        }));
      }
    } finally {
      this.isReloading = false;
    }
  }

  // --- TEMPLATES METHODS ---
  public getTemplates(): HealthEnvChecklistTypeTemplate[] {
    if (this.templates.length > 0) {
      return [...this.templates];
    }
    return HEALTH_ENV_CHECKLIST_TEMPLATES
      .filter(t => !this.deletedTemplateIds.includes(t.id))
      .map(t => ({ ...t, defaultItems: t.defaultItems.map(i => ({ ...i })) }));
  }

  public getTemplateById(id: HealthEnvChecklistType): HealthEnvChecklistTypeTemplate | undefined {
    return this.getTemplates().find(t => t.id === id);
  }

  public async saveTemplate(template: HealthEnvChecklistTypeTemplate, user: string = 'کاربر سیستم'): Promise<boolean> {
    const idx = this.templates.findIndex(t => t.id === template.id);
    const now = new Date().toISOString();
    const updatedRecord: HealthEnvChecklistTypeTemplate = {
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
      await apiDb.saveSetting(DELETED_TEMPLATES_STORAGE_KEY, this.deletedTemplateIds);
    }

    await apiDb.saveAllHealthEnvTemplates(this.templates);
    await apiDb.logAudit({
      action: idx !== -1 ? 'UPDATE' : 'CREATE',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_TEMPLATE',
      entityId: template.id,
      newValue: { id: template.id, title: template.titleFa, itemCount: updatedRecord.defaultItems.length },
      details: { updatedBy: user, timestamp: now }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_templates_updated'));
    }
    return true;
  }

  public async deleteTemplate(templateId: string, user: string = 'کاربر سیستم'): Promise<boolean> {
    const target = this.templates.find(t => t.id === templateId);
    if (!target) return false;

    this.templates = this.templates.filter(t => t.id !== templateId);
    if (!this.deletedTemplateIds.includes(templateId)) {
      this.deletedTemplateIds.push(templateId);
      await apiDb.saveSetting(DELETED_TEMPLATES_STORAGE_KEY, this.deletedTemplateIds);
    }
    await apiDb.saveAllHealthEnvTemplates(this.templates);
    await apiDb.logAudit({
      action: 'DELETE',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_TEMPLATE',
      entityId: templateId,
      oldValue: { id: templateId, title: target.titleFa },
      details: { deletedBy: user, timestamp: new Date().toISOString() }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_templates_updated'));
    }
    return true;
  }

  public async reorderChecklistItems(
    templateId: HealthEnvChecklistType, 
    items: HealthEnvChecklistItem[], 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    template.defaultItems = items.map((item, idx) => ({
      ...item,
      orderIndex: idx + 1
    }));
    await this.saveTemplate(template, user);
    return true;
  }

  public async addChecklistItem(
    templateId: HealthEnvChecklistType, 
    item: Omit<HealthEnvChecklistItem, 'id'>, 
    user: string = 'کاربر سیستم'
  ): Promise<HealthEnvChecklistItem> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    const newItem: HealthEnvChecklistItem = {
      ...item,
      id: `custom-${templateId}-${Date.now()}`,
      isCustom: true
    };
    template.defaultItems.push(newItem);
    await this.saveTemplate(template, user);
    return newItem;
  }

  public async updateChecklistItem(
    templateId: HealthEnvChecklistType, 
    item: HealthEnvChecklistItem, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    const idx = template.defaultItems.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      template.defaultItems[idx] = { ...item };
      await this.saveTemplate(template, user);
      return true;
    }
    return false;
  }

  public async deleteChecklistItem(
    templateId: HealthEnvChecklistType, 
    itemId: string, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const template = this.getTemplateById(templateId);
    if (!template) throw new Error('چک‌لیست مورد نظر یافت نشد.');

    const deletedItem = template.defaultItems.find(i => i.id === itemId);
    template.defaultItems = template.defaultItems.filter(i => i.id !== itemId);
    await this.saveTemplate(template, user);

    await apiDb.logAudit({
      action: 'DELETE',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_ITEM',
      entityId: itemId,
      previousValue: deletedItem,
      details: {
        templateId,
        templateTitle: template.titleFa,
        itemTitle: deletedItem?.title,
        deletedBy: user,
        timestamp: new Date().toISOString()
      }
    });

    return true;
  }

  public async resetTemplateToDefault(
    templateId: HealthEnvChecklistType, 
    user: string = 'کاربر سیستم'
  ): Promise<boolean> {
    const defaultTemplate = HEALTH_ENV_CHECKLIST_TEMPLATES.find(t => t.id === templateId);
    if (!defaultTemplate) throw new Error('الگوی استاندارد یافت نشد.');

    const cloned = JSON.parse(JSON.stringify(defaultTemplate));
    await this.saveTemplate(cloned, user);

    await apiDb.logAudit({
      action: 'RESET',
      module: 'HEALTH_ENV',
      entityType: 'CHECKLIST_TEMPLATE',
      entityId: templateId,
      details: {
        templateTitle: defaultTemplate.titleFa,
        resetBy: user,
        timestamp: new Date().toISOString()
      }
    });

    return true;
  }

  // --- INSPECTION METHODS ---
  public getAllInspections(): HealthEnvInspection[] {
    return [...this.inspections];
  }

  public getInspectionById(id: string): HealthEnvInspection | undefined {
    return this.inspections.find(i => i.id === id);
  }

  public async saveInspection(
    inspection: Partial<HealthEnvInspection>, 
    user: string = 'کاربر سیستم'
  ): Promise<HealthEnvInspection> {
    const isNew = !inspection.id;
    const now = new Date().toISOString();
    const items = inspection.items || [];
    const totalItems = items.length;
    const passedCount = items.filter(i => i.verdict === 'pass').length;
    const failedCount = items.filter(i => i.verdict === 'fail').length;
    const naCount = items.filter(i => i.verdict === 'na').length;
    const effectiveTotal = totalItems - naCount;
    const scorePercent = effectiveTotal > 0 ? Math.round((passedCount / effectiveTotal) * 100) : 100;

    let finalStatus: HealthEnvInspection['status'] = inspection.status || 'COMPLETED';
    if (failedCount > 0) {
      finalStatus = 'ACTION_REQUIRED';
    }

    const actualDate = inspection.inspectionDate || getTodayJalaliDate();
    const scheduleType = inspection.scheduleType || 'PERIODIC';
    const periodicInterval = inspection.periodicInterval || 'MONTHLY';
    
    // Calculate nextInspectionDate if periodic and not explicitly provided
    let nextInspectionDate = inspection.nextInspectionDate;
    if (scheduleType === 'PERIODIC' && !nextInspectionDate) {
      nextInspectionDate = calculateNextInspectionDate(actualDate, 'PERIODIC', periodicInterval);
    } else if (scheduleType === 'ADHOC') {
      nextInspectionDate = undefined;
    }

    let savedRecord: HealthEnvInspection;

    if (isNew) {
      const yearPrefix = actualDate.split('/')[0] || '1404';
      const count = this.inspections.length + 1;
      const seq = String(count).padStart(3, '0');
      const newId = `HE-INSP-${yearPrefix}-${seq}`;

      const newRecord: HealthEnvInspection = {
        id: newId,
        checklistTypeId: inspection.checklistTypeId || 'premises-buildings',
        checklistTypeNameFa: inspection.checklistTypeNameFa || 'چک‌لیست بازدید اماکن و ساختمان‌ها',
        title: inspection.title || `بازرسی بهداشت و محیط زیست ${newId}`,
        inspectionDate: actualDate,
        inspectionTime: inspection.inspectionTime || new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        site: inspection.site || 'مجتمع مرکزی',
        unit: inspection.unit || 'واحد HSE',
        areaLocation: inspection.areaLocation || '',
        equipmentOrFacilityCode: inspection.equipmentOrFacilityCode || '',
        inspectorName: inspection.inspectorName || user,
        inspectorCode: inspection.inspectorCode || '',
        supervisorName: inspection.supervisorName || '',
        hseManagerName: inspection.hseManagerName || '',
        status: finalStatus,
        approvalStatus: inspection.approvalStatus || 'PENDING_APPROVAL',
        approvalNotes: inspection.approvalNotes || '',
        scorePercent,
        totalItems,
        passedCount,
        failedCount,
        naCount,
        items,
        findingsSummary: inspection.findingsSummary || '',
        immediateActionsTaken: inspection.immediateActionsTaken || '',
        recommendedCapa: inspection.recommendedCapa || '',
        photos: inspection.photos || [],
        scheduleType,
        periodicInterval: scheduleType === 'PERIODIC' ? periodicInterval : undefined,
        nextInspectionDate,
        attachments: inspection.attachments || [],
        referralId: inspection.referralId,
        inspectorSignature: inspection.inspectorSignature || '',
        supervisorSignature: inspection.supervisorSignature || '',
        createdAt: now,
        updatedAt: now,
        createdByUser: user,
        approvalLogs: [
          {
            id: `log-${Date.now()}`,
            step: 'SUBMITTED',
            actionBy: user,
            role: 'بازرس بهداشت و محیط زیست',
            timestamp: actualDate,
            comment: 'ثبت اولیه چک‌لیست بازرسی'
          }
        ]
      };

      this.inspections.unshift(newRecord);
      savedRecord = newRecord;

      await apiDb.saveHealthEnvInspection(newRecord);
      await apiDb.logAudit({
        action: 'CREATE',
        module: 'HEALTH_ENV',
        entityType: 'INSPECTION_CHECKLIST',
        entityId: newId,
        newValue: { id: newId, title: newRecord.title, checklistType: newRecord.checklistTypeId, score: scorePercent },
        details: { createdBy: user, timestamp: now }
      });

    } else {
      const idx = this.inspections.findIndex(i => i.id === inspection.id);
      const prev = idx !== -1 ? this.inspections[idx] : null;

      const updatedRecord: HealthEnvInspection = {
        ...prev,
        ...inspection,
        id: inspection.id!,
        checklistTypeId: inspection.checklistTypeId || prev?.checklistTypeId || 'premises-buildings',
        checklistTypeNameFa: inspection.checklistTypeNameFa || prev?.checklistTypeNameFa || 'چک‌لیست بهداشت',
        title: inspection.title || prev?.title || 'بازرسی بهداشت و محیط زیست',
        inspectionDate: actualDate,
        inspectionTime: inspection.inspectionTime || prev?.inspectionTime || '',
        site: inspection.site || prev?.site || '',
        unit: inspection.unit || prev?.unit || '',
        areaLocation: inspection.areaLocation || prev?.areaLocation || '',
        equipmentOrFacilityCode: inspection.equipmentOrFacilityCode || prev?.equipmentOrFacilityCode || '',
        inspectorName: inspection.inspectorName || prev?.inspectorName || user,
        supervisorName: inspection.supervisorName || prev?.supervisorName,
        hseManagerName: inspection.hseManagerName || prev?.hseManagerName,
        status: finalStatus,
        approvalStatus: inspection.approvalStatus || prev?.approvalStatus || 'PENDING_APPROVAL',
        scorePercent,
        totalItems,
        passedCount,
        failedCount,
        naCount,
        items,
        findingsSummary: inspection.findingsSummary ?? prev?.findingsSummary,
        immediateActionsTaken: inspection.immediateActionsTaken ?? prev?.immediateActionsTaken,
        recommendedCapa: inspection.recommendedCapa ?? prev?.recommendedCapa,
        photos: inspection.photos || prev?.photos || [],
        scheduleType: scheduleType || prev?.scheduleType || 'PERIODIC',
        periodicInterval: scheduleType === 'PERIODIC' ? (periodicInterval || prev?.periodicInterval || 'MONTHLY') : undefined,
        nextInspectionDate: scheduleType === 'PERIODIC' ? (nextInspectionDate || prev?.nextInspectionDate) : undefined,
        attachments: inspection.attachments || prev?.attachments || [],
        referralId: inspection.referralId || prev?.referralId,
        inspectorSignature: inspection.inspectorSignature || prev?.inspectorSignature,
        supervisorSignature: inspection.supervisorSignature || prev?.supervisorSignature,
        createdAt: prev?.createdAt || now,
        updatedAt: now,
        createdByUser: prev?.createdByUser || user,
        approvalLogs: prev?.approvalLogs || []
      };

      if (idx !== -1) {
        this.inspections[idx] = updatedRecord;
      } else {
        this.inspections.unshift(updatedRecord);
      }
      savedRecord = updatedRecord;

      await apiDb.saveHealthEnvInspection(updatedRecord);
      await apiDb.logAudit({
        action: 'UPDATE',
        module: 'HEALTH_ENV',
        entityType: 'INSPECTION_CHECKLIST',
        entityId: updatedRecord.id,
        newValue: { id: updatedRecord.id, title: updatedRecord.title, score: scorePercent },
        details: { updatedBy: user, timestamp: now }
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_inspections_updated'));
    }
    return savedRecord;
  }

  public async deleteInspection(id: string, user: string = 'کاربر سیستم'): Promise<boolean> {
    const existing = this.getInspectionById(id);
    if (!existing) return false;

    this.inspections = this.inspections.filter(i => i.id !== id);
    await apiDb.deleteHealthEnvInspection(id);

    await apiDb.logAudit({
      action: 'DELETE',
      module: 'HEALTH_ENV',
      entityType: 'INSPECTION_CHECKLIST',
      entityId: id,
      oldValue: { id, title: existing.title },
      details: { deletedBy: user, timestamp: new Date().toISOString() }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('hse_health_env_inspections_updated'));
    }
    return true;
  }

  // --- APPROVAL WORKFLOW METHODS ---
  public async approveInspection(
    id: string, 
    user: string = 'مدیر سیستم', 
    role: string = 'سرپرست HSE',
    comment?: string
  ): Promise<HealthEnvInspection> {
    const inspection = this.getInspectionById(id);
    if (!inspection) throw new Error('بازرسی مورد نظر یافت نشد.');

    const now = new Date().toISOString();
    const todayJalali = getTodayJalaliDate();

    const newLog = {
      id: `log-${Date.now()}`,
      step: 'MANAGER_APPROVAL' as const,
      actionBy: user,
      role: role || 'سرپرست بهداشت و محیط زیست',
      timestamp: todayJalali,
      comment: comment || 'تأیید نهایی گزارش بازرسی و اقدامات اصلاحی'
    };

    const updated: HealthEnvInspection = {
      ...inspection,
      approvalStatus: 'APPROVED',
      approvedBy: user,
      approvedAt: todayJalali,
      approvalNotes: comment || inspection.approvalNotes,
      status: inspection.failedCount > 0 ? 'ACTION_REQUIRED' : 'CLOSED',
      updatedAt: now,
      approvalLogs: [...(inspection.approvalLogs || []), newLog]
    };

    return this.saveInspection(updated, user);
  }

  public async rejectInspection(
    id: string, 
    user: string = 'مدیر سیستم', 
    role: string = 'سرپرست HSE',
    comment: string
  ): Promise<HealthEnvInspection> {
    const inspection = this.getInspectionById(id);
    if (!inspection) throw new Error('بازرسی مورد نظر یافت نشد.');

    const now = new Date().toISOString();
    const todayJalali = getTodayJalaliDate();

    const newLog = {
      id: `log-${Date.now()}`,
      step: 'REJECTED' as const,
      actionBy: user,
      role: role || 'سرپرست بهداشت و محیط زیست',
      timestamp: todayJalali,
      comment: comment || 'رد گزارش بازرسی جهت بازبینی و اصلاح نواقص'
    };

    const updated: HealthEnvInspection = {
      ...inspection,
      approvalStatus: 'REJECTED',
      approvalNotes: comment,
      status: 'ACTION_REQUIRED',
      updatedAt: now,
      approvalLogs: [...(inspection.approvalLogs || []), newLog]
    };

    return this.saveInspection(updated, user);
  }
}

export const healthEnvChecklistService = new HealthEnvChecklistService();
