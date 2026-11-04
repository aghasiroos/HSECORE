/**
 * Iran Calendar & Holiday Engine
 * Calculates Jalali dates and holiday status strictly in Asia/Tehran timezone.
 */

import { db } from '../../src/db/index.ts';
import * as schema from '../../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { gregorianToJalali, getJalaliDayOfWeek, formatJalaliString } from '../../src/utils/jalaliDate.ts';

export interface IranHolidayResult {
  isHoliday: boolean;
  isFriday: boolean;
  isOfficialHoliday: boolean;
  isCustomHoliday: boolean;
  holidayTitle?: string;
  dateShamsi: string;
  timeTehran: string;
  timezone: 'Asia/Tehran';
}

/**
 * Known Solar/Shamsi Official Holidays in Iran Calendar (Month/Day in Jalali)
 */
const SOLAR_HOLIDAYS: Record<string, string> = {
  '01/01': 'عید نوروز (آغاز سال نو)',
  '01/02': 'عید نوروز (روز دوم)',
  '01/03': 'عید نوروز (روز سوم)',
  '01/04': 'عید نوروز (روز چهارم)',
  '01/12': 'روز جمهوری اسلامی ایران',
  '01/13': 'روز طبیعت (سیزده بدر)',
  '03/14': 'رحلت حضرت امام خمینی (ره)',
  '03/15': 'قیام خونین ۱۵ خرداد',
  '11/22': 'پیروزی انقلاب اسلامی ایران',
  '12/29': 'روز ملی شدن صنعت نفت ایران',
  '12/30': 'روز پایانی سال (کبیسه)',
};

/**
 * Lunar/Religious Official Holidays mapped to Jalali dates for common recent & upcoming years.
 * Format: YYYY/MM/DD -> Holiday Title
 */
const LUNAR_HOLIDAYS_BY_JALALI_YEAR: Record<string, string> = {
  // 1403 (2024 - 2025)
  '1403/01/12': 'شهادت حضرت علی (ع)',
  '1403/01/22': 'عید سعید فطر',
  '1403/01/23': 'تعطیل به مناسبت عید فطر',
  '1403/02/15': 'شهادت حضرت امام جعفر صادق (ع)',
  '1403/03/28': 'عید سعید قربان',
  '1403/04/05': 'عید سعید غدیر خم',
  '1403/04/25': 'تاسوعای حسینی',
  '1403/04/26': 'عاشورای حسینی',
  '1403/06/04': 'اربعین حسینی',
  '1403/06/12': 'رحلت حضرت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)',
  '1403/06/14': 'شهادت حضرت امام رضا (ع)',
  '1403/06/22': 'شهادت حضرت امام حسن عسکری (ع)',
  '1403/06/31': 'میلاد حضرت رسول اکرم (ص) و امام جعفر صادق (ع)',
  '1403/09/15': 'شهادت حضرت فاطمه زهرا (س)',
  '1403/10/25': 'میلاد حضرت امیرالمؤمنین علی (ع)',
  '1403/11/09': 'مبعث حضرت رسول اکرم (ص)',
  '1403/11/26': 'میلاد حضرت قائم (عج) - نیمه شعبان',

  // 1404 (2025 - 2026)
  '1404/01/01': 'عید نوروز / شهادت حضرت علی (ع)',
  '1404/01/11': 'عید سعید فطر',
  '1404/01/12': 'تعطیل به مناسبت عید فطر / روز جمهوری اسلامی',
  '1404/02/04': 'شهادت حضرت امام جعفر صادق (ع)',
  '1404/03/17': 'عید سعید قربان',
  '1404/03/25': 'عید سعید غدیر خم',
  '1404/04/14': 'تاسوعای حسینی',
  '1404/04/15': 'عاشورای حسینی',
  '1404/05/24': 'اربعین حسینی',
  '1404/06/02': 'رحلت حضرت رسول اکرم (ص)',
  '1404/06/04': 'شهادت حضرت امام رضا (ع)',
  '1404/06/11': 'شهادت حضرت امام حسن عسکری (ع)',
  '1404/06/20': 'میلاد حضرت رسول اکرم (ص)',
  '1404/09/04': 'شهادت حضرت فاطمه زهرا (س)',
  '1404/10/14': 'میلاد حضرت امیرالمؤمنین علی (ع)',
  '1404/10/28': 'مبعث حضرت رسول اکرم (ص)',
  '1404/11/15': 'میلاد حضرت قائم (عج)',

  // 1405 (2026 - 2027)
  '1405/01/01': 'عید نوروز (آغاز سال نو)',
  '1405/01/02': 'عید نوروز (روز دوم)',
  '1405/01/03': 'عید نوروز (روز سوم)',
  '1405/01/04': 'عید نوروز (روز چهارم)',
  '1405/01/12': 'روز جمهوری اسلامی ایران',
  '1405/01/13': 'روز طبیعت (سیزده بدر)',
  '1405/01/21': 'عید سعید فطر',
  '1405/01/22': 'تعطیل به مناسبت عید فطر',
  '1405/02/13': 'شهادت حضرت امام جعفر صادق (ع)',
  '1405/03/06': 'عید سعید قربان',
  '1405/03/14': 'عید سعید غدیر خم / رحلت امام خمینی',
  '1405/03/15': 'قیام ۱۵ خرداد',
  '1405/04/03': 'تاسوعای حسینی',
  '1405/04/04': 'عاشورای حسینی',
  '1405/05/13': 'اربعین حسینی',
  '1405/05/22': 'رحلت حضرت رسول اکرم (ص)',
  '1405/05/24': 'شهادت حضرت امام رضا (ع)',
  '1405/06/01': 'شهادت حضرت امام حسن عسکری (ع)',
  '1405/06/10': 'میلاد حضرت رسول اکرم (ص) و امام جعفر صادق (ع)',
  '1405/08/23': 'شهادت حضرت فاطمه زهرا (س)',
  '1405/10/03': 'میلاد حضرت امیرالمؤمنین علی (ع)',
  '1405/10/17': 'مبعث حضرت رسول اکرم (ص)',
  '1405/11/04': 'میلاد حضرت قائم (عج) - نیمه شعبان',
  '1405/11/22': 'پیروزی انقلاب اسلامی ایران',
  '1405/12/20': 'شهادت حضرت علی (ع)',
  '1405/12/29': 'روز ملی شدن صنعت نفت ایران',

  // 1406 (2027 - 2028)
  '1406/01/10': 'عید سعید فطر',
  '1406/02/26': 'عید سعید قربان',
  '1406/03/03': 'عید سعید غدیر خم',
  '1406/03/23': 'تاسوعای حسینی',
  '1406/03/24': 'عاشورای حسینی',
  '1406/05/02': 'اربعین حسینی',
  '1406/05/11': 'رحلت حضرت رسول اکرم (ص)',
  '1406/05/13': 'شهادت حضرت امام رضا (ع)',
  '1406/05/20': 'شهادت حضرت امام حسن عسکری (ع)',
  '1406/05/29': 'میلاد حضرت رسول اکرم (ص)',
  '1406/08/13': 'شهادت حضرت فاطمه زهرا (س)',
  '1406/09/23': 'میلاد حضرت امیرالمؤمنین علی (ع)',
  '1406/10/07': 'مبعث حضرت رسول اکرم (ص)',
  '1406/10/24': 'میلاد حضرت قائم (عج)',
  '1406/12/09': 'شهادت حضرت علی (ع)',
  '1406/12/29': 'عید سعید فطر / روز ملی شدن صنعت نفت',
};

/**
 * Checks if a given date or current date is a holiday in Iran (Asia/Tehran timezone).
 */
export async function checkIsIranHoliday(dateInput?: string | Date): Promise<IranHolidayResult> {
  const tz = 'Asia/Tehran';

  // Resolve target date in Asia/Tehran timezone
  let d: Date;
  if (!dateInput) {
    d = new Date();
  } else if (typeof dateInput === 'string') {
    // If YYYY/MM/DD Shamsi string supplied, parse or convert
    if (/^\d{4}\/\d{2}\/\d{2}/.test(dateInput)) {
      const parts = dateInput.split(' ')[0].split('/').map(Number);
      const jy = parts[0];
      const jm = parts[1];
      const jd = parts[2];
      
      const isFriday = getJalaliDayOfWeek(jy, jm, jd) === 6;
      const dateShamsi = formatJalaliString(jy, jm, jd);
      const monthDayKey = `${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
      
      const solarTitle = SOLAR_HOLIDAYS[monthDayKey];
      const lunarTitle = LUNAR_HOLIDAYS_BY_JALALI_YEAR[dateShamsi];
      const officialTitle = solarTitle || lunarTitle;
      const isOfficialHoliday = Boolean(officialTitle);

      let customHolidayTitle: string | undefined;
      let isCustomHoliday = false;
      try {
        const sysSettings = await db
          .select()
          .from(schema.systemSettings)
          .where(eq(schema.systemSettings.key, 'ptw_custom_holidays'))
          .limit(1);
        if (sysSettings.length > 0) {
          const list = (sysSettings[0].value as Array<{ date: string; title: string }>) || [];
          const matched = list.find(item => item.date === dateShamsi);
          if (matched) {
            isCustomHoliday = true;
            customHolidayTitle = matched.title || 'تعطیل سفارشی تعریف‌شده در تنظیمات';
          }
        }
      } catch {
        // ignore DB read error
      }

      const isHoliday = isFriday || isOfficialHoliday || isCustomHoliday;
      let holidayTitle: string | undefined;
      if (officialTitle) holidayTitle = officialTitle;
      else if (customHolidayTitle) holidayTitle = customHolidayTitle;
      else if (isFriday) holidayTitle = 'جمعه (تعطیلات پایان هفته)';

      const now = new Date();
      const timeTehran = new Intl.DateTimeFormat('fa-IR', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);

      return {
        isHoliday,
        isFriday,
        isOfficialHoliday,
        isCustomHoliday,
        holidayTitle,
        dateShamsi,
        timeTehran,
        timezone: tz,
      };
    } else {
      d = new Date(dateInput);
    }
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  // Format date in Asia/Tehran timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  let gy = 0, gm = 0, gd = 0, weekdayStr = '';
  let hour = '00', minute = '00', second = '00';

  for (const p of parts) {
    if (p.type === 'year') gy = parseInt(p.value, 10);
    if (p.type === 'month') gm = parseInt(p.value, 10);
    if (p.type === 'day') gd = parseInt(p.value, 10);
    if (p.type === 'weekday') weekdayStr = p.value;
    if (p.type === 'hour') hour = p.value.padStart(2, '0');
    if (p.type === 'minute') minute = p.value.padStart(2, '0');
    if (p.type === 'second') second = p.value.padStart(2, '0');
  }

  const jalali = gregorianToJalali(gy, gm, gd);
  const dateShamsi = formatJalaliString(jalali.jy, jalali.jm, jalali.jd);
  const monthDayKey = `${String(jalali.jm).padStart(2, '0')}/${String(jalali.jd).padStart(2, '0')}`;
  
  // Friday check in Tehran timezone
  const isFriday = weekdayStr === 'Fri' || getJalaliDayOfWeek(jalali.jy, jalali.jm, jalali.jd) === 6;

  const solarTitle = SOLAR_HOLIDAYS[monthDayKey];
  const lunarTitle = LUNAR_HOLIDAYS_BY_JALALI_YEAR[dateShamsi];
  const officialTitle = solarTitle || lunarTitle;
  const isOfficialHoliday = Boolean(officialTitle);

  let customHolidayTitle: string | undefined;
  let isCustomHoliday = false;
  try {
    const sysSettings = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, 'ptw_custom_holidays'))
      .limit(1);
    if (sysSettings.length > 0) {
      const list = (sysSettings[0].value as Array<{ date: string; title: string }>) || [];
      const matched = list.find(item => item.date === dateShamsi);
      if (matched) {
        isCustomHoliday = true;
        customHolidayTitle = matched.title || 'تعطیل سفارشی تعریف‌شده در تنظیمات';
      }
    }
  } catch {
    // ignore
  }

  const isHoliday = isFriday || isOfficialHoliday || isCustomHoliday;
  let holidayTitle: string | undefined;
  if (officialTitle) holidayTitle = officialTitle;
  else if (customHolidayTitle) holidayTitle = customHolidayTitle;
  else if (isFriday) holidayTitle = 'جمعه (تعطیلات پایان هفته)';

  return {
    isHoliday,
    isFriday,
    isOfficialHoliday,
    isCustomHoliday,
    holidayTitle,
    dateShamsi,
    timeTehran: `${hour}:${minute}:${second}`,
    timezone: tz,
  };
}
