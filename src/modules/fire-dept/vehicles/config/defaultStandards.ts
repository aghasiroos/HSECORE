import { VehicleStandard } from '../types/vehicleTypes';

export const INITIAL_VEHICLE_STANDARDS: VehicleStandard[] = [
  {
    id: 'std-1',
    title: 'استاندارد مشخصات و طراحی خودروهای آتش‌نشانی',
    code: 'NFPA 1901 / EN 1846-1',
    reference: 'National Fire Protection Association & CEN',
    version: '2023 Edition',
    requirement: 'الزامات پایداری، شاسی، ابعاد، مخازن و بارگذاری استاندارد تجهیزات اطفاء',
    allowedLimit: 'توزیع بار مجاز محورها و زاویه واژگونی حداقل ۳۰ درجه',
    testMethod: 'آزمون شیب جانبی (Tilt Table) و توزین محوری',
    inspectionInterval: 'سالانه و پس از هرگونه تغییرات سازه',
    requiredDocs: 'گواهی سازنده، نقشه توزین و برگه تاییدیه استاندارد'
  },
  {
    id: 'std-2',
    title: 'استاندارد بازرسی، مراقبت و آزمون عملکردی پمپ و تجهیزات خودروهای آتش‌نشانی در حین خدمت',
    code: 'NFPA 1911',
    reference: 'NFPA Standards Council',
    version: '2022 Edition',
    requirement: 'آزمون سالانه آب‌بندی تحت خلاء، دبی و فشار نامی پمپ در ۱۰۰٪، ۷۰٪ و ۵۰٪ ظرفیت',
    allowedLimit: 'فشار خلاء حداقل ۰.۷۵- بار به مدت ۱۰ دقیقه بدون افت بیش از ۰.۱ بار',
    testMethod: 'Hydrostatic Pressure & Pump Flow Capacity Test with Calibrated Pitot Tube',
    inspectionInterval: 'سالانه / دوره‌ای شش‌ماهه',
    requiredDocs: 'گراف جریان-فشار، گواهی کالیبراسیون گیج‌های فشار'
  },
  {
    id: 'std-3',
    title: 'استاندارد شیلنگ‌ها، اتصالات و کوپلینگ‌های آتش‌نشانی',
    code: 'NFPA 1961 / NFPA 1962 / BS 6391',
    reference: 'NFPA / British Standards',
    version: '2021 Edition',
    requirement: 'تست هیدرواستاتیک شیلنگ‌های اطفاء و سلامت کوپلینگ‌ها و واشرها',
    allowedLimit: 'فشار کاری تا ۱۶ بار و تست هیدرواستاتیک ۲۴ بار بدون نشتی و ترکیدگی',
    testMethod: 'Hydrostatic Service Pressure Test (3 minutes holding)',
    inspectionInterval: 'سالانه و بعد از هر عملیات سنگین',
    requiredDocs: 'شناسنامه شیلنگ‌ها و برچسب تاریخ تست هیدرواستاتیک'
  },
  {
    id: 'std-4',
    title: 'استاندارد دستگاه‌های تنفسی هوای فشرده مدار باز (SCBA)',
    code: 'NFPA 1981 / EN 137',
    reference: 'NFPA / European Standard',
    version: '2024 Edition',
    requirement: 'تست هوابندی ماسک، عملکرد رگلاتور دیماند، فشار مانومتر و هشداردهنده صوتی فشار کم',
    allowedLimit: 'فشار کاری ۳۰۰ بار، افت فشار ماسک کمتر از ۵ میلی‌بار در دقیقه',
    testMethod: 'Pneu-Test / تست داینامیک تنفسی با دستگاه تست خودکار',
    inspectionInterval: 'روزانه (چک عملیاتی) و سالانه (سرویس اورهال)',
    requiredDocs: 'گواهی تست هیدرواستاتیک سیلندر (۵ ساله) و برگه سرویس رگلاتور'
  },
  {
    id: 'std-5',
    title: 'استاندارد تجهیزات هیدرولیک نجات و برشکاری',
    code: 'NFPA 1936 / EN 13204',
    reference: 'NFPA Technical Committee on Rescue Equipment',
    version: '2020 Edition',
    requirement: 'فشار کاری یونیت هیدرولیک، توان برش قیچی، باز شدن فک اسپریدر و سلامت شیلنگ‌های فشار قوی',
    allowedLimit: 'فشار هیدرولیک تا ۷۲۰ بار بدون نشتی کوپلینگ‌های Coaxial/Core',
    testMethod: 'آزمون فشار بیشینه و برش مقاطع فولادی استاندارد',
    inspectionInterval: 'شش‌ماهه / سالانه',
    requiredDocs: 'کارت سرویس شرکت نمایندگی مجاز و گواهی تعویض روغن هیدرولیک'
  }
];
