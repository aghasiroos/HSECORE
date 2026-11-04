/**
 * Frontend Iran Calendar & PTW Holiday Utility
 * Provides client-side Jalali holiday checking and Senior Duty Officer job title verification.
 */

import { gregorianToJalali, getJalaliDayOfWeek, formatJalaliString } from './jalaliDate';

export interface FrontendHolidayResult {
  isHoliday: boolean;
  isFriday: boolean;
  isOfficialHoliday: boolean;
  holidayTitle?: string;
  dateShamsi: string;
}

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

const LUNAR_HOLIDAYS_BY_JALALI_YEAR: Record<string, string> = {
  '1403/01/12': 'شهادت حضرت علی (ع)',
  '1403/01/22': 'عید سعید فطر',
  '1403/01/23': 'تعطیل به مناسبت عید فطر',
  '1403/02/15': 'شهادت حضرت امام جعفر صادق (ع)',
  '1403/03/28': 'عید سعید قربان',
  '1403/04/05': 'عید سعید غدیر خم',
  '1403/04/25': 'تاسوعای حسینی',
  '1403/04/26': 'عاشورای حسینی',
  '1403/06/04': 'اربعین حسینی',
  '1403/06/12': 'رحلت حضرت رسول اکرم (ص)',
  '1403/06/14': 'شهادت حضرت امام رضا (ع)',
  '1403/06/22': 'شهادت حضرت امام حسن عسکری (ع)',
  '1403/06/31': 'میلاد حضرت رسول اکرم (ص)',
  '1403/09/15': 'شهادت حضرت فاطمه زهرا (س)',
  '1403/10/25': 'میلاد حضرت امیرالمؤمنین علی (ع)',
  '1403/11/09': 'مبعث حضرت رسول اکرم (ص)',
  '1403/11/26': 'میلاد حضرت قائم (عج)',

  '1404/01/01': 'عید نوروز / شهادت حضرت علی (ع)',
  '1404/01/11': 'عید سعید فطر',
  '1404/01/12': 'تعطیل به مناسبت عید فطر',
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
  '1405/06/10': 'میلاد حضرت رسول اکرم (ص)',
  '1405/08/23': 'شهادت حضرت فاطمه زهرا (س)',
  '1405/10/03': 'میلاد حضرت امیرالمؤمنین علی (ع)',
  '1405/10/17': 'مبعث حضرت رسول اکرم (ص)',
  '1405/11/04': 'میلاد حضرت قائم (عج)',
  '1405/11/22': 'پیروزی انقلاب اسلامی ایران',
  '1405/12/20': 'شهادت حضرت علی (ع)',
  '1405/12/29': 'روز ملی شدن صنعت نفت ایران',
};

/**
 * Checks if a given date or today is a holiday in Iran (Asia/Tehran timezone)
 */
export function checkIsIranHolidayClient(dateInput?: string | Date): FrontendHolidayResult {
  let d: Date;
  if (!dateInput) {
    d = new Date();
  } else if (typeof dateInput === 'string') {
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

      const isHoliday = isFriday || isOfficialHoliday;
      let holidayTitle: string | undefined;
      if (officialTitle) holidayTitle = officialTitle;
      else if (isFriday) holidayTitle = 'جمعه (تعطیلات پایان هفته)';

      return {
        isHoliday,
        isFriday,
        isOfficialHoliday,
        holidayTitle,
        dateShamsi,
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
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    });

    const parts = formatter.formatToParts(d);
    let gy = 0, gm = 0, gd = 0, weekdayStr = '';

    for (const p of parts) {
      if (p.type === 'year') gy = parseInt(p.value, 10);
      if (p.type === 'month') gm = parseInt(p.value, 10);
      if (p.type === 'day') gd = parseInt(p.value, 10);
      if (p.type === 'weekday') weekdayStr = p.value;
    }

    const jalali = gregorianToJalali(gy, gm, gd);
    const dateShamsi = formatJalaliString(jalali.jy, jalali.jm, jalali.jd);
    const monthDayKey = `${String(jalali.jm).padStart(2, '0')}/${String(jalali.jd).padStart(2, '0')}`;
    const isFriday = weekdayStr === 'Fri' || getJalaliDayOfWeek(jalali.jy, jalali.jm, jalali.jd) === 6;

    const solarTitle = SOLAR_HOLIDAYS[monthDayKey];
    const lunarTitle = LUNAR_HOLIDAYS_BY_JALALI_YEAR[dateShamsi];
    const officialTitle = solarTitle || lunarTitle;
    const isOfficialHoliday = Boolean(officialTitle);

    const isHoliday = isFriday || isOfficialHoliday;
    let holidayTitle: string | undefined;
    if (officialTitle) holidayTitle = officialTitle;
    else if (isFriday) holidayTitle = 'جمعه (تعطیلات پایان هفته)';

    return {
      isHoliday,
      isFriday,
      isOfficialHoliday,
      holidayTitle,
      dateShamsi,
    };
  } catch {
    return {
      isHoliday: false,
      isFriday: false,
      isOfficialHoliday: false,
      dateShamsi: '',
    };
  }
}

/**
 * Checks if a job title or user role corresponds to "کشیک ارشد" (Senior Duty Officer)
 */
export function checkIsSeniorDutyOfficer(jobTitle?: string | null, positionTitle?: string | null, role?: string | null): boolean {
  const combined = `${jobTitle || ''} ${positionTitle || ''} ${role || ''}`
    .replace(/\s+/g, ' ')
    .trim();

  if (!combined) return false;

  const seniorDutyKeywords = [
    'کشیک ارشد',
    'کشیک‌ارشد',
    'کشیک ارشد تولید',
    'کشیک ارشد نوبت کاری',
    'کشیک ارشد نوبت‌کاری',
    'کشیک ارشد مجتمع',
    'senior duty',
    'senior duty officer',
    'senior shift supervisor',
  ];

  return seniorDutyKeywords.some(keyword =>
    combined.toLowerCase().includes(keyword.toLowerCase())
  );
}
