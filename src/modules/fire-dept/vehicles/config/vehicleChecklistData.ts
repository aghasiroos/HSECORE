export interface ChecklistTemplateItem {
  id: string;
  category: string;
  titleFa: string;
  titleEn: string;
  defaultAllowedLimit?: string;
  standardRefId?: string;
  critical?: boolean;
}

export interface ChecklistCategoryGroup {
  id: string;
  nameFa: string;
  nameEn: string;
  iconName: string;
  items: ChecklistTemplateItem[];
}

export const VEHICLE_CHECKLIST_CATEGORIES: ChecklistCategoryGroup[] = [
  {
    id: 'general_condition',
    nameFa: 'وضعیت عمومی',
    nameEn: 'General Condition',
    iconName: 'Shield',
    items: [
      { id: 'gc-1', category: 'وضعیت عمومی', titleFa: 'بدنه (Body & Panels)', titleEn: 'Body & Panels', defaultAllowedLimit: 'فاقد فرورفتگی، زنگ‌زدگی و آسیب ساختاری', standardRefId: 'std-1' },
      { id: 'gc-2', category: 'وضعیت عمومی', titleFa: 'شیشه‌ها (Windshield & Windows)', titleEn: 'Windshield & Windows', defaultAllowedLimit: 'فاقد ترک‌خوردگی، شکستگی و تاری دید', standardRefId: 'std-1' },
      { id: 'gc-3', category: 'وضعیت عمومی', titleFa: 'درب‌ها و کرکره‌ها (Doors & Rollers)', titleEn: 'Doors & Shutters', defaultAllowedLimit: 'عملکرد روان ریل‌ها و قفل‌ها و آب‌بندی لاستیک‌ها' },
      { id: 'gc-4', category: 'وضعیت عمومی', titleFa: 'آینه‌ها (Mirrors)', titleEn: 'Rearview Mirrors', defaultAllowedLimit: 'تنظیم دید کامل، سلامت پایه‌ها و شیشه آینه' },
      { id: 'gc-5', category: 'وضعیت عمومی', titleFa: 'چراغ‌ها (Headlights & Taillights)', titleEn: 'Headlights & Taillights', defaultAllowedLimit: 'روشنایی کامل نور بالا، پایین، راهنما و مه‌شکن' },
      { id: 'gc-6', category: 'وضعیت عمومی', titleFa: 'چراغ گردان (Lightbar & Beacons)', titleEn: 'Warning Lightbar', defaultAllowedLimit: 'عملکرد ۱۰۰٪ ماژول‌های LED قرمز/آبی گردان', critical: true },
      { id: 'gc-7', category: 'وضعیت عمومی', titleFa: 'آژیر و بوق اضطراری (Siren & PA System)', titleEn: 'Electronic Siren & Horn', defaultAllowedLimit: 'حداقل شدت صوت ۱۱۰ دسی‌بل در ۳ متر', critical: true },
      { id: 'gc-8', category: 'وضعیت عمومی', titleFa: 'علائم و شبرنگ‌های خودرو (Reflective Markings)', titleEn: 'Vehicle Decals & Markings', defaultAllowedLimit: 'شبرنگ‌های استاندارد روز و شب با بازتابش کامل' }
    ]
  },
  {
    id: 'engine_mechanics',
    nameFa: 'موتور و مکانیک',
    nameEn: 'Engine & Mechanics',
    iconName: 'Wrench',
    items: [
      { id: 'em-1', category: 'موتور و مکانیک', titleFa: 'روغن موتور (Engine Oil Level & Quality)', titleEn: 'Engine Oil', defaultAllowedLimit: 'بین خط Min و Max گیج، فاقد تغییر ویسکوزیته و ذرات فلزی', critical: true },
      { id: 'em-2', category: 'موتور و مکانیک', titleFa: 'آب رادیاتور و ضدیخ (Coolant Level)', titleEn: 'Radiator Coolant', defaultAllowedLimit: 'سطح نرمال مخزن انبساط، غلظت ضدیخ حداقل ۵۰٪', critical: true },
      { id: 'em-3', category: 'موتور و مکانیک', titleFa: 'باتری و ولتاژ شارژ (Battery & Voltage)', titleEn: 'Battery & Alternator', defaultAllowedLimit: 'ولتاژ حالت خاموش > 12.6V (یا 24V)، شارژ دینام 13.8-14.4V', critical: true },
      { id: 'em-4', category: 'موتور و مکانیک', titleFa: 'تسمه‌ها (Fan & Alternator Belts)', titleEn: 'Drive Belts', defaultAllowedLimit: 'انعطاف مناسب، فاقد ترک، سایش و لقی' },
      { id: 'em-5', category: 'موتور و مکانیک', titleFa: 'نشتی‌ها (Fluid Leaks Check)', titleEn: 'Fluid Leaks', defaultAllowedLimit: 'صفر مطلق نشتی سوخت، روغن، مایع هیدرولیک و آب', critical: true },
      { id: 'em-6', category: 'موتور و مکانیک', titleFa: 'فیلترها (Air & Fuel Filters)', titleEn: 'Filters', defaultAllowedLimit: 'نشانگر افت فشار فیلتر هوا سبز، فیلتر گازوئیل آب‌گیری شده' },
      { id: 'em-7', category: 'موتور و مکانیک', titleFa: 'سیستم خنک‌کننده (Cooling System)', titleEn: 'Cooling Fans & Hoses', defaultAllowedLimit: 'فن‌های برقی/ویسکوز فعال، شیلنگ‌ها بدون بادکردگی' },
      { id: 'em-8', category: 'موتور و مکانیک', titleFa: 'سیستم اگزوز (Exhaust System & DPF)', titleEn: 'Exhaust System', defaultAllowedLimit: 'فاقد نشتی دود در محفظه موتور و کابین، دمای نرمال' }
    ]
  },
  {
    id: 'mobility_drivetrain',
    nameFa: 'سیستم حرکتی',
    nameEn: 'Mobility & Drivetrain',
    iconName: 'Gauge',
    items: [
      { id: 'md-1', category: 'سیستم حرکتی', titleFa: 'لاستیک‌ها (Tires Condition)', titleEn: 'Tires Condition', defaultAllowedLimit: 'فاقد بریدگی، بادکردگی جانبی و پارگی سیم' },
      { id: 'md-2', category: 'سیستم حرکتی', titleFa: 'فشار باد لاستیک‌ها (Tire Pressure)', titleEn: 'Tire Pressure', defaultAllowedLimit: 'فشار مطابق مشخصات کارخانه (معمولا ۱۱۰-۱۲۰ PSI)', critical: true },
      { id: 'md-3', category: 'سیستم حرکتی', titleFa: 'آج لاستیک (Tire Tread Depth)', titleEn: 'Tire Tread Depth', defaultAllowedLimit: 'حداقل عمق آج ۴ میلی‌متر در کلیه شیارها' },
      { id: 'md-4', category: 'سیستم حرکتی', titleFa: 'سیستم ترمز اصلی (Service Brakes & ABS)', titleEn: 'Service Brakes', defaultAllowedLimit: 'فشار باد مخازن ترمز > 8 Bar، توقف خطی بدون کشش فرمان', critical: true },
      { id: 'md-5', category: 'سیستم حرکتی', titleFa: 'ترمز دستی (Parking / Maxi Brake)', titleEn: 'Parking Brake', defaultAllowedLimit: 'تثبیت کامل خودرو در شیب ۲۰٪ با بارگذاری کامل', critical: true },
      { id: 'md-6', category: 'سیستم حرکتی', titleFa: 'سیستم فرمان و هیدرولیک (Steering)', titleEn: 'Steering Mechanism', defaultAllowedLimit: 'بدون لقی، روانی گردش چرخ‌ها، سطح روغن هیدرولیک نرمال' },
      { id: 'md-7', category: 'سیستم حرکتی', titleFa: 'سیستم تعلیق و فنربندی (Suspension)', titleEn: 'Suspension & Springs', defaultAllowedLimit: 'سلامت فنرهای شمش/کمک‌های بادی و عدم کجی شاسی' },
      { id: 'md-8', category: 'سیستم حرکتی', titleFa: 'گیربکس و انتقال قدرت (Transmission & Diffs)', titleEn: 'Transmission', defaultAllowedLimit: 'تعویض روان دنده‌ها، درگیری کامل دنده کمک و قفل دیفرانسیل' }
    ]
  },
  {
    id: 'fire_suppression',
    nameFa: 'سیستم اطفاء',
    nameEn: 'Fire Suppression System',
    iconName: 'Flame',
    items: [
      { id: 'fs-1', category: 'سیستم اطفاء', titleFa: 'پمپ آتش‌نشانی (Main Fire Pump)', titleEn: 'Fire Pump', defaultAllowedLimit: 'عملکرد بی‌صدا، رسیدن به دبی نامی در فشار ۱۰ بار', standardRefId: 'std-2', critical: true },
      { id: 'fs-2', category: 'سیستم اطفاء', titleFa: 'PTO و کلاچ درگیری پمپ (Power Take-Off)', titleEn: 'PTO Engagement', defaultAllowedLimit: 'درگیری سریع و بدون تقه در دور موتور آرام', standardRefId: 'std-2', critical: true },
      { id: 'fs-3', category: 'سیستم اطفاء', titleFa: 'فشار پمپ و مانومترها (Pressure Gauges)', titleEn: 'Pump Pressure & Gauges', defaultAllowedLimit: 'کالیبره بودن گیج فشار کم (تا ۲۵ بار) و گیج فشار بالا (تا ۵۰ بار)', standardRefId: 'std-2' },
      { id: 'fs-4', category: 'سیستم اطفاء', titleFa: 'مکش آب و پمپ خلاء (Primer & Suction)', titleEn: 'Priming System', defaultAllowedLimit: 'ایجاد مکش در کمتر از ۲۵ ثانیه از عمق ۳ متری', standardRefId: 'std-2', critical: true },
      { id: 'fs-5', category: 'سیستم اطفاء', titleFa: 'شیرهای ورودی و خروجی (Inlet & Discharge Valves)', titleEn: 'Valves & Drains', defaultAllowedLimit: 'حرکت روان دسته‌ها، عدم نشتی تحت فشار ۱۶ بار', standardRefId: 'std-2' },
      { id: 'fs-6', category: 'سیستم اطفاء', titleFa: 'مانیتور سقف و سپر (Roof / Bumper Monitor)', titleEn: 'Roof / Deck Monitor', defaultAllowedLimit: 'چرخش ۳۶۰ درجه افقی و ۹۰/-۱۵ عمودی، برد پرتاب > ۵۵ متر', critical: true },
      { id: 'fs-7', category: 'سیستم اطفاء', titleFa: 'نازل‌های خودرویی (Nozzles & Fog Guns)', titleEn: 'Mounted Nozzles', defaultAllowedLimit: 'تغییر حالت جت/فاگ روان و تنظیم دبی بدون گرفتگی' },
      { id: 'fs-8', category: 'سیستم اطفاء', titleFa: 'سیستم فوم و اینداکتور (Foam Proportioning System)', titleEn: 'Foam Proportioner', defaultAllowedLimit: 'دقت تزریق ۱٪، ۳٪ و ۶٪ مطابق تنظیمات اینداکتور', standardRefId: 'std-2', critical: true },
      { id: 'fs-9', category: 'سیستم اطفاء', titleFa: 'مخزن آب و نشانگر سطح (Water Tank & Level Indicator)', titleEn: 'Water Tank', defaultAllowedLimit: 'مخزن پر ۱۰۰٪، عملکرد سنسورهای نوری سطح آب' },
      { id: 'fs-10', category: 'سیستم اطفاء', titleFa: 'مخزن فوم و نشانگر (Foam Tank & Level)', titleEn: 'Foam Tank', defaultAllowedLimit: 'عدم رسوب و ژله‌ای شدن فوم، سطح مایع تکمیل' },
      { id: 'fs-11', category: 'سیستم اطفاء', titleFa: 'سیستم هوای فشرده فوم (CAFS System)', titleEn: 'Compressed Air Foam System (CAFS)', defaultAllowedLimit: 'تولید فوم خشک/مرطوب با کیفیت یکنواخت و فشار پایدار' }
    ]
  },
  {
    id: 'hoses_fittings',
    nameFa: 'شیلنگ و اتصالات',
    nameEn: 'Hoses & Fittings',
    iconName: 'Layers',
    items: [
      { id: 'hf-1', category: 'شیلنگ و اتصالات', titleFa: 'شیلنگ‌های آتش‌نشانی (Delivery Hoses 1.5 & 2.5 Inch)', titleEn: 'Fire Hoses', defaultAllowedLimit: 'حداقل ۸ بند شیلنگ تمیز، رول‌شده و آماده به کار', standardRefId: 'std-3' },
      { id: 'hf-2', category: 'شیلنگ و اتصالات', titleFa: 'شیلنگ مکش سخت و صافی (Hard Suction Hose & Strainer)', titleEn: 'Suction Hoses & Strainer', defaultAllowedLimit: 'فاقد تاخوردگی و فرورفتگی، صافی تمیز با طناب شناور', standardRefId: 'std-3' },
      { id: 'hf-3', category: 'شیلنگ و اتصالات', titleFa: 'کوپلینگ‌ها و قفل‌های استورز (Storz Couplings)', titleEn: 'Couplings', defaultAllowedLimit: 'چرخش روان، عدم آسیب زبانه‌ها و فرورفتگی رزوه‌ها', standardRefId: 'std-3' },
      { id: 'hf-4', category: 'شیلنگ و اتصالات', titleFa: 'واشرهای آب‌بندی (Sealing Gaskets)', titleEn: 'Rubber Gaskets', defaultAllowedLimit: 'انعطاف لاستیک، فاقد پوسیدگی، چاک و خشکی', standardRefId: 'std-3' },
      { id: 'hf-5', category: 'شیلنگ و اتصالات', titleFa: 'سرلوله‌ها و نازل‌های دستی (Handline Nozzles)', titleEn: 'Handline Branchpipes', defaultAllowedLimit: 'نازل‌های توربوجت با اهرم قطع و وصل سریع' },
      { id: 'hf-6', category: 'شیلنگ و اتصالات', titleFa: 'شیرآلات و تقسیم‌کننده‌ها (Dividing Breechings & Collectors)', titleEn: 'Breechings & Collectors', defaultAllowedLimit: 'عملکرد شیرهای توپی ۲ به ۱ و ۱ به ۲ بدون نشتی' },
      { id: 'hf-7', category: 'شیلنگ و اتصالات', titleFa: 'رابط‌ها و تبدیل‌های سایز (Adapters & Reducers)', titleEn: 'Adapters & Connectors', defaultAllowedLimit: 'تبدیل‌های ۲.۵ به ۱.۵ اینچ، هوزریل به استورز و آچار کوپلینگ' }
    ]
  },
  {
    id: 'ppe_equipment',
    nameFa: 'تجهیزات حفاظت فردی',
    nameEn: 'Personal Protective Equipment',
    iconName: 'ShieldAlert',
    items: [
      { id: 'ppe-1', category: 'تجهیزات حفاظت فردی', titleFa: 'لباس‌های عملیاتی آتش‌نشانی (Turnout Gear / Bunker Suits)', titleEn: 'Firefighter Bunker Suits', defaultAllowedLimit: 'حداقل ۳ دست لباس کامل تمیز، بدون پارگی و سوختگی' },
      { id: 'ppe-2', category: 'تجهیزات حفاظت فردی', titleFa: 'کلاه‌های ایمنی عملیاتی (Fire Helmets & Visors)', titleEn: 'Firefighting Helmets', defaultAllowedLimit: 'چراغ روی کلاه فعال، شیلد محافظ صورت شفاف و بدون خط و خش' },
      { id: 'ppe-3', category: 'تجهیزات حفاظت فردی', titleFa: 'دستکش‌های نسوز عملیاتی (Fire Gloves)', titleEn: 'Structural Fire Gloves', defaultAllowedLimit: 'بدون پارگی، لایه نسوز و ضد برش سالم' },
      { id: 'ppe-4', category: 'تجهیزات حفاظت فردی', titleFa: 'چکمه‌های ایمنی آتش‌نشانی (Fire Boots)', titleEn: 'Firefighting Boots', defaultAllowedLimit: 'سرپنجه و کفی ضد نفوذ، عایق برق و حرارت' },
      { id: 'ppe-5', category: 'تجهیزات حفاظت فردی', titleFa: 'دستگاه‌های تنفسی هوای فشرده (SCBA Sets)', titleEn: 'SCBA Breathing Sets', defaultAllowedLimit: 'حداقل ۲ ست کامل با فشار مانومتر > ۲۸۰ بار', standardRefId: 'std-4', critical: true },
      { id: 'ppe-6', category: 'تجهیزات حفاظت فردی', titleFa: 'ماسک‌های تنفسی تمام‌صورت (Full Face Masks)', titleEn: 'Full Face Respiratory Masks', defaultAllowedLimit: 'طلق کاملاً شفاف، لنز بدون خش، تست تست‌باکس مثبت', standardRefId: 'std-4', critical: true }
    ]
  },
  {
    id: 'rescue_equipment',
    nameFa: 'تجهیزات نجات',
    nameEn: 'Rescue Equipment',
    iconName: 'Activity',
    items: [
      { id: 're-1', category: 'تجهیزات نجات', titleFa: 'پاورپک و تجهیزات هیدرولیک نجات (Hydraulic Power Unit)', titleEn: 'Hydraulic Rescue Power Unit', defaultAllowedLimit: 'استارت سریع موتور بنزینی/شارژی، فشار ۷۲۰ بار', standardRefId: 'std-5', critical: true },
      { id: 're-2', category: 'تجهیزات نجات', titleFa: 'قیچی هیدرولیک امداد (Hydraulic Cutter)', titleEn: 'Hydraulic Cutter', defaultAllowedLimit: 'تیغه‌ها بدون پلیسه، هم‌راستایی فک‌ها و قفل ایمنی', standardRefId: 'std-5' },
      { id: 're-3', category: 'تجهیزات نجات', titleFa: 'اسپریدر و فک بازکننده (Hydraulic Spreader)', titleEn: 'Hydraulic Spreader', defaultAllowedLimit: 'نوک‌های الماسه سالم، قدرت بازشدگی نامی', standardRefId: 'std-5' },
      { id: 're-4', category: 'تجهیزات نجات', titleFa: 'جک‌های پنوماتیک و استوانه‌ای (Ram Jacks & Air Bags)', titleEn: 'Rescue Rams & Air Lifting Bags', defaultAllowedLimit: 'باد نشدن بدون نشتی، شیلنگ‌های باد ۸ بار' },
      { id: 're-5', category: 'تجهیزات نجات', titleFa: 'ابزارهای دستی تخریب (Hooligan Bar, Axe, Halligan)', titleEn: 'Forcible Entry Hand Tools', defaultAllowedLimit: 'تبر آتشنشانی، دیلم هالیگان، پتک و اهرم در جایگاه خود' },
      { id: 're-6', category: 'تجهیزات نجات', titleFa: 'اره موتوری و کاتاف (Chainsaw & Rotary Saw)', titleEn: 'Chainsaw & Rescue Saws', defaultAllowedLimit: 'تیغه زنجیری تیز، سوخت مخلوط پر، تست استارت فوری' },
      { id: 're-7', category: 'تجهیزات نجات', titleFa: 'نردبان‌های تاشو و کشویی (Extension & Folding Ladders)', titleEn: 'Rescue Ladders', defaultAllowedLimit: 'ریل‌ها و پایه‌های لاستیکی بدون لقی، تست بارگذاری سالانه' },
      { id: 're-8', category: 'تجهیزات نجات', titleFa: 'طناب‌ها، کارابین و تجهیزات هارنس (Ropes & Harnesses)', titleEn: 'Rescue Ropes & Hardware', defaultAllowedLimit: 'طناب نجات استاتیک ۵۰ متری، کارابین‌های پیچ‌دار تایید شده' }
    ]
  },
  {
    id: 'comm_emergency',
    nameFa: 'تجهیزات ارتباطی و اضطراری',
    nameEn: 'Communication & Emergency Tools',
    iconName: 'Bell',
    items: [
      { id: 'ce-1', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'بیسیم خودرویی و دستی (Mobile & Portable VHF/UHF Radios)', titleEn: 'Radio Transceivers', defaultAllowedLimit: 'ارتباط شفاف با مرکز کنترل در کلیه کانال‌های اضطراری', critical: true },
      { id: 'ce-2', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'آنتن و کابل‌های مخابراتی (Antennas)', titleEn: 'Radio Antennas', defaultAllowedLimit: 'نصب محکم روی سقف، بدون قطعی کابل کواکسیال' },
      { id: 'ce-3', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'سیستم ناوبری و ردیاب (GPS & Fleet Tracker)', titleEn: 'GPS & Telematics', defaultAllowedLimit: 'موقعیت‌یابی فعال روی نقشه آنلاین مرکز فرماندهی' },
      { id: 'ce-4', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'شارژرهای بیسیم و تجهیزات (In-Vehicle Chargers)', titleEn: 'Battery Chargers', defaultAllowedLimit: 'عملکرد پایه‌های شارژ بیسیم‌ها و باتری‌های یدک' },
      { id: 'ce-5', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'چراغ‌قوه‌های ضد انفجار (ATEX Explosion-proof Torches)', titleEn: 'ATEX Flashlights', defaultAllowedLimit: 'باتری فول شارژ، استاندارد ضدانفجار Zone 1/21' },
      { id: 'ce-6', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'کیف و جعبه کمک‌های اولیه (Trauma First Aid Kit)', titleEn: 'First Aid Kit', defaultAllowedLimit: 'پانسمان سوختگی، آتل، سرم، فویل ایزوترمیک و تاریخ مصرف معتبر', critical: true },
      { id: 'ce-7', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'کپسول‌های خاموش كننده پرتابل خودرو (Vehicle Extinguishers)', titleEn: 'Portable Extinguishers', defaultAllowedLimit: 'حداقل ۱ کپسول پودر ۶kg و ۱ کپسول CO2 در کابین و پشت' },
      { id: 'ce-8', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'موتور برق و ژنراتور پرتابل (Portable Power Generator)', titleEn: 'Power Generator & Floodlights', defaultAllowedLimit: 'خروجی ۲۲۰ ولت پایدار، پروژکتورهای دکل روشنایی فعال' },
      { id: 'ce-9', category: 'تجهیزات ارتباطی و اضطراری', titleFa: 'تجهیزات علامت‌گذاری و مخروط ایمنی (Traffic Cones & Tape)', titleEn: 'Traffic Cones & Warning Tape', defaultAllowedLimit: 'حداقل ۵ کله‌قندی شبرنگ‌دار و نوار خطر ۱۰۰ متری' }
    ]
  }
];
