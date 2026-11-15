import type { LiftingSubTab } from './types';

export const LIFT_CATEGORY_LABELS: Record<string, { labelFa: string; badgeCls: string; defaultDaf: number }> = {
  STANDARD: {
    labelFa: 'معمولی (Standard)',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    defaultDaf: 1.1,
  },
  CRITICAL: {
    labelFa: 'حساس (Critical >75%)',
    badgeCls: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
    defaultDaf: 1.15,
  },
  HEAVY: {
    labelFa: 'سنگین (Heavy Lift)',
    badgeCls: 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-700',
    defaultDaf: 1.15,
  },
  TANDEM: {
    labelFa: 'دو جرثقیل (Tandem)',
    badgeCls: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-700',
    defaultDaf: 1.2,
  },
  BLIND: {
    labelFa: 'عملیات کور (Blind)',
    badgeCls: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700',
    defaultDaf: 1.15,
  },
  LIFT_AND_TURN: {
    labelFa: 'برپاسازی (Lift & Turn)',
    badgeCls: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700',
    defaultDaf: 1.2,
  },
};

export const PLAN_STATUS_META: Record<string, { labelFa: string; cls: string }> = {
  DRAFT: {
    labelFa: 'پیش‌نویس',
    cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  },
  UNDER_REVIEW: {
    labelFa: 'در حال بررسی',
    cls: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-700',
  },
  REAPPROVAL_REQUIRED: {
    labelFa: 'نیازمند بازتأیید',
    cls: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
  },
  APPROVED: {
    labelFa: 'تأیید نهایی',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
  },
  ACTIVE_EXECUTION: {
    labelFa: 'در حال اجرا',
    cls: 'bg-emerald-100 text-emerald-900 border-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-600',
  },
  REJECTED: {
    labelFa: 'رد شده',
    cls: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700',
  },
  RETURNED: {
    labelFa: 'بازگشت برای اصلاح',
    cls: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
  },
  CLOSED: {
    labelFa: 'خاتمه‌یافته',
    cls: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

export const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  REQUEST: '۱. ثبت درخواست',
  PLAN_DRAFT: '۲. تدوین طرح و جانمایی',
  ENG_REVIEW: '۳. بررسی محاسبات مهندسی',
  HSE_EVAL: '۴. ارزیابی ایمنی و JSA',
  EQUIP_INSPECT: '۵. کنترل فنی تجهیزات و پرسنل',
  AUTHORIZED_APPROVAL: '۶. تأییدیه مقامات مجاز',
  PERMIT_ISSUANCE: '۷. صدور پروانه کار (PTW)',
  EXECUTION: '۸. نظارت میدانی و اجرا',
  CLOSURE: '۹. اختتام و مستندسازی',
};

export const NON_DELETABLE_PLAN_STATUSES = ['APPROVED', 'ACTIVE_EXECUTION'];

export function isPlanDeletable(status?: string | null): boolean {
  return !NON_DELETABLE_PLAN_STATUSES.includes(String(status || '').toUpperCase());
}

export interface LiftingNavGroup {
  groupTitleFa: string;
  items: Array<{
    key: Exclude<LiftingSubTab, 'dashboard'>;
    titleFa: string;
    subtitleFa: string;
  }>;
}

export const LIFTING_DROPDOWN_GROUPS: LiftingNavGroup[] = [
  {
    groupTitleFa: 'طراحی، مدیریت و محاسبات مهندسی',
    items: [
      {
        key: 'plans',
        titleFa: 'مدیریت طرح‌های باربرداری',
        subtitleFa: 'فهرست جامع، ویرایش، تاریخچه نسخه‌ها و حذف',
      },
      {
        key: 'engineering',
        titleFa: 'محاسبات مهندسی و نمای ۳ بعدی',
        subtitleFa: 'تحلیل تعادل استاتیکی MecaLug، Load Chart و مدل 3D',
      },
      {
        key: 'special-ops',
        titleFa: 'عملیات ویژه (Tandem / Blind / Turning)',
        subtitleFa: 'تحلیل باربرداری دو جرثقیله، کور و برپاسازی مخازن',
      },
    ],
  },
  {
    groupTitleFa: 'ناوگان، ادوات و صلاحیت‌ها',
    items: [
      {
        key: 'cranes',
        titleFa: 'بانک جرثقیل‌ها و Load Chart',
        subtitleFa: 'ثبت ناوگان و جداول ظرفیت واقعی کاتالوگ سازنده',
      },
      {
        key: 'rigging',
        titleFa: 'بانک تجهیزات Rigging',
        subtitleFa: 'اسلینگ‌ها، شگل‌ها، قلاب‌ها و اسپردر بیم مطابق ASME',
      },
      {
        key: 'assets-certs',
        titleFa: 'گواهینامه‌ها، تجهیزات و پرسنل مجاز',
        subtitleFa: 'پایش انقضای سرتیفیکیت‌ها و صلاحیت تیم اجرایی',
      },
    ],
  },
  {
    groupTitleFa: 'ایمنی، گردش کار، گزارش و استانداردها',
    items: [
      {
        key: 'risk-jsa',
        titleFa: 'ارزیابی ریسک، JSA و عدم انطباق (CAPA)',
        subtitleFa: 'اتصال مستقیم به ماژول ریسک و پیگیری مغایرت‌ها',
      },
      {
        key: 'workflow',
        titleFa: 'گردش کار ۹ مرحله‌ای و صدور PTW',
        subtitleFa: 'چک‌لیست مهندسی، HSE، شرایط میدانی و تأییدیه‌ها',
      },
      {
        key: 'reports',
        titleFa: 'گزارش‌های مهندسی و آرشیو پرونده (Dossier)',
        subtitleFa: 'خروجی رسمی چاپی و مستندات پیوست سه‌بعدی',
      },
      {
        key: 'standards',
        titleFa: 'استانداردها و ضرایب ASME',
        subtitleFa: 'تنظیمات ضرایب ایمنی و بندهای مرجع محاسباتی',
      },
    ],
  },
];
