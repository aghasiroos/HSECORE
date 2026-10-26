import React from 'react';
import {
  Building2,
  CheckCircle2,
  Scale,
  Heart,
  AlertTriangle,
  ShieldCheck,
  FlaskConical,
  Activity,
  Calendar,
  Eye,
  Volume2,
  Wind,
  Users,
  Flame,
  UserCheck,
  HelpCircle
} from 'lucide-react';
import { BMI_CATS, LAB_DEFS } from './seedData';
import { ChartDataItem } from './CustomizableChart';

export interface MetricDefinition {
  key: string;
  label: string;
  category: 'عمومی و سازمانی' | 'ارزیابی‌های پایه و بالینی' | 'آزمایشگاه' | 'تست‌های پاراکلینیک' | 'عوامل زیان‌آور و بیماری‌ها';
  description: string;
  defaultTitle: string;
  defaultSubtitle: string;
  defaultType: 'bar' | 'hbar' | 'line' | 'donut' | 'area';
  defaultPalette: 'teal' | 'indigo' | 'amber' | 'multi' | 'rose' | 'slate';
  icon: string;
  unit: string;
  calculate: (records: any[], totalCount?: number) => ChartDataItem[];
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function splitMulti(v: any): string[] {
  if (!v) return [];
  return String(v).split('|').map(s => s.trim().replace(/'\s*$/, '')).filter(Boolean);
}

function bpCategory(sys: number | null, dia: number | null): string | null {
  if (sys === null && dia === null) return null;
  sys = sys || 0;
  dia = dia || 0;
  if (sys >= 140 || dia >= 90) return 'فشار خون بالا (مرحله ۲)';
  if (sys >= 130 || dia >= 80) return 'فشار خون بالا (مرحله ۱)';
  if (sys >= 120) return 'در آستانه';
  return 'طبیعی';
}

function bmiCat(v: number | null) {
  if (v === null || v === undefined) return null;
  return BMI_CATS.find(c => c.test(v)) || null;
}

export const AVAILABLE_METRICS: Record<string, MetricDefinition> = {
  company: {
    key: 'company',
    label: 'توزیع پرسنل بر اساس محل خدمت / واحد',
    category: 'عمومی و سازمانی',
    description: 'فراوانی کارکنان و معاینات در بخش‌ها و شرکت‌های تابعه',
    defaultTitle: 'توزیع پرسنل بر اساس محل خدمت',
    defaultSubtitle: 'تعداد پرسنل تحت پوشش معاینات در واحدهای عملیاتی و ستادی',
    defaultType: 'hbar',
    defaultPalette: 'teal',
    icon: 'Building2',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const c = (r.company || 'نامشخص').trim();
        counts[c] = (counts[c] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({
          label,
          value,
          subLabel: `${((value / total) * 100).toFixed(0)}٪ کل پرسنل`
        }));
    }
  },

  opinion: {
    key: 'opinion',
    label: 'نظریه نهایی و صلاحیت طب کار',
    category: 'ارزیابی‌های پایه و بالینی',
    description: 'تفکیک وضعیت صلاحیت اشتغال شامل بلامانع، مشروط، عدم صلاحیت و ارجاع',
    defaultTitle: 'نتیجه نظریه نهایی معاینات طب کار',
    defaultSubtitle: 'تفکیک وضعیت صلاحیت پرسنل (بلامانع، مشروط، عدم صلاحیت و ارجاع)',
    defaultType: 'donut',
    defaultPalette: 'multi',
    icon: 'CheckCircle2',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const op = (r.final_opinion || 'بدون نظریه').trim();
        counts[op] = (counts[op] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => {
          let color = '#0d9488';
          if (label === 'بلامانع') color = '#10b981';
          else if (label === 'مشروط') color = '#f59e0b';
          else if (label === 'عدم صلاحیت') color = '#ef4444';
          else if (label.includes('ارجاع')) color = '#6366f1';
          return {
            label,
            value,
            color,
            subLabel: `${((value / total) * 100).toFixed(0)}٪`
          };
        });
    }
  },

  bmi: {
    key: 'bmi',
    label: 'توزیع شاخص توده بدنی (BMI)',
    category: 'ارزیابی‌های پایه و بالینی',
    description: 'تفکیک وضعیت لاغری، وزن طبیعی، اضافه وزن و چاقی پرسنل',
    defaultTitle: 'توزیع شاخص توده بدنی (BMI) پرسنل',
    defaultSubtitle: 'فراوانی وضعیت وزن و چاقی در میان کارکنان سازمان',
    defaultType: 'bar',
    defaultPalette: 'multi',
    icon: 'Scale',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      return BMI_CATS.map(cat => {
        const count = records.filter(r => bmiCat(toNum(r.bmi))?.key === cat.key).length;
        return {
          label: cat.label_fa,
          value: count,
          color: cat.color,
          subLabel: `${cat.range} (${((count / total) * 100).toFixed(0)}٪)`
        };
      });
    }
  },

  bp: {
    key: 'bp',
    label: 'وضعیت فشار خون پرسنل',
    category: 'ارزیابی‌های پایه و بالینی',
    description: 'ارزیابی فشار خون سیستولیک و دیاستولیک طبق استاندارد پزشکی',
    defaultTitle: 'وضعیت فشار خون پرسنل',
    defaultSubtitle: 'ارزیابی فشار خون سیستولیک و دیاستولیک طبق استاندارد طب کار',
    defaultType: 'bar',
    defaultPalette: 'rose',
    icon: 'Heart',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      const counts: Record<string, number> = {
        'طبیعی': 0,
        'در آستانه': 0,
        'فشار خون بالا (مرحله ۱)': 0,
        'فشار خون بالا (مرحله ۲)': 0
      };
      records.forEach(r => {
        const bp = bpCategory(toNum(r.bp_sys), toNum(r.bp_dia));
        if (bp && counts[bp] !== undefined) {
          counts[bp]++;
        }
      });
      return [
        { label: 'طبیعی', value: counts['طبیعی'], color: '#10b981', subLabel: `< 120/80 (${((counts['طبیعی'] / total) * 100).toFixed(0)}٪)` },
        { label: 'در آستانه', value: counts['در آستانه'], color: '#f59e0b', subLabel: `120-129 (${((counts['در آستانه'] / total) * 100).toFixed(0)}٪)` },
        { label: 'مرحله ۱ پرفشاری', value: counts['فشار خون بالا (مرحله ۱)'], color: '#2563eb', subLabel: `130-139 / 80-89 (${((counts['فشار خون بالا (مرحله ۱)'] / total) * 100).toFixed(0)}٪)` },
        { label: 'مرحله ۲ پرفشاری', value: counts['فشار خون بالا (مرحله ۲)'], color: '#ef4444', subLabel: `≥ 140 / 90 (${((counts['فشار خون بالا (مرحله ۲)'] / total) * 100).toFixed(0)}٪)` }
      ];
    }
  },

  top_diseases: {
    key: 'top_diseases',
    label: 'شایع‌ترین تشخیص‌ها و بیماری‌ها',
    category: 'عوامل زیان‌آور و بیماری‌ها',
    description: '۱۰ بیماری شغلی و غیرشغلی اولویت‌دار شناسایی‌شده در سازمان',
    defaultTitle: '۱۰ تشخیص و بیماری شایع شناسایی‌شده',
    defaultSubtitle: 'بیماری‌های شغلی و غیرشغلی اولویت‌دار جهت اقدامات اصلاحی و بهداشتی',
    defaultType: 'hbar',
    defaultPalette: 'amber',
    icon: 'AlertTriangle',
    unit: 'مورد',
    calculate: (records) => {
      const dxCounts: Record<string, number> = {};
      records.forEach(r => {
        ['dis_nonocc_new', 'dis_nonocc_known', 'dis_occ_new', 'dis_occ_known'].forEach(f => {
          splitMulti(r[f]).forEach(d => {
            if (d) dxCounts[d] = (dxCounts[d] || 0) + 1;
          });
        });
      });
      return Object.entries(dxCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => ({ label, value }));
    }
  },

  top_hazards: {
    key: 'top_hazards',
    label: 'شایع‌ترین عوامل زیان‌آور محیط کار',
    category: 'عوامل زیان‌آور و بیماری‌ها',
    description: 'مواجهه شغلی با خطرات فیزیکی، ارگونومی، شیمیایی، بیولوژیکی و روانی',
    defaultTitle: 'شایع‌ترین عوامل زیان‌آور محیط کار',
    defaultSubtitle: 'مواجهه شغلی کارکنان با خطرات فیزیکی، ارگونومی، شیمیایی و بیولوژیک',
    defaultType: 'hbar',
    defaultPalette: 'indigo',
    icon: 'ShieldCheck',
    unit: 'مورد',
    calculate: (records) => {
      const hazCounts: Record<string, number> = {};
      records.forEach(r => {
        ['haz_phys', 'haz_chem', 'haz_bio', 'haz_ergo', 'haz_psych', 'haz_other'].forEach(f => {
          splitMulti(r[f]).forEach(h => {
            if (h) hazCounts[h] = (hazCounts[h] || 0) + 1;
          });
        });
      });
      return Object.entries(hazCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => ({ label, value }));
    }
  },

  fbs_levels: {
    key: 'fbs_levels',
    label: 'سطح قند خون ناشتا (FBS)',
    category: 'آزمایشگاه',
    description: 'تفکیک پرسنل در وضعیت‌های طبیعی، پیش‌دیابت و دیابتیک',
    defaultTitle: 'پایش قند خون ناشتا (FBS)',
    defaultSubtitle: 'دسته‌بندی پرسنل به نرمال (<100)، پیش‌دیابت (100-125) و دیابت (≥126)',
    defaultType: 'donut',
    defaultPalette: 'multi',
    icon: 'FlaskConical',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      let normal = 0;
      let prediabetes = 0;
      let diabetes = 0;
      let unrecorded = 0;

      records.forEach(r => {
        const val = toNum(r.fbs);
        if (val === null) unrecorded++;
        else if (val < 100) normal++;
        else if (val <= 125) prediabetes++;
        else diabetes++;
      });

      const list: ChartDataItem[] = [
        { label: 'طبیعی (< 100)', value: normal, color: '#10b981', subLabel: `${((normal / total) * 100).toFixed(0)}٪` },
        { label: 'پیش‌دیابت (100-125)', value: prediabetes, color: '#f59e0b', subLabel: `${((prediabetes / total) * 100).toFixed(0)}٪` },
        { label: 'دیابت (≥ 126)', value: diabetes, color: '#ef4444', subLabel: `${((diabetes / total) * 100).toFixed(0)}٪` }
      ];
      if (unrecorded > 0 && records.length > unrecorded) {
        list.push({ label: 'ثبت‌نشده', value: unrecorded, color: '#94a3b8', subLabel: `${((unrecorded / total) * 100).toFixed(0)}٪` });
      }
      return list;
    }
  },

  chol_levels: {
    key: 'chol_levels',
    label: 'وضعیت کلسترول تام خون (Cholesterol)',
    category: 'آزمایشگاه',
    description: 'پایش چربی خون و هیپرکلسترولمی در میان کارکنان',
    defaultTitle: 'توزیع کلسترول تام خون',
    defaultSubtitle: 'دسته‌بندی کلسترول: مطلوب (<200)، مرزی (200-239) و بالا (≥240)',
    defaultType: 'bar',
    defaultPalette: 'amber',
    icon: 'FlaskConical',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      let normal = 0;
      let borderline = 0;
      let high = 0;

      records.forEach(r => {
        const val = toNum(r.chol);
        if (val !== null) {
          if (val < 200) normal++;
          else if (val < 240) borderline++;
          else high++;
        }
      });

      return [
        { label: 'مطلوب (< 200)', value: normal, color: '#10b981', subLabel: `${((normal / total) * 100).toFixed(0)}٪` },
        { label: 'مرزی (200-239)', value: borderline, color: '#f59e0b', subLabel: `${((borderline / total) * 100).toFixed(0)}٪` },
        { label: 'بالا و خطرساز (≥ 240)', value: high, color: '#ef4444', subLabel: `${((high / total) * 100).toFixed(0)}٪` }
      ];
    }
  },

  tg_levels: {
    key: 'tg_levels',
    label: 'وضعیت تری‌گلیسرید خون (Triglycerides)',
    category: 'آزمایشگاه',
    description: 'ارزیابی تری‌گلیسرید و ریسک سندروم متابولیک',
    defaultTitle: 'توزیع تری‌گلیسرید خون (TG)',
    defaultSubtitle: 'دسته‌بندی TG: مطلوب (<150)، مرزی (150-199) و بالا (≥200)',
    defaultType: 'bar',
    defaultPalette: 'rose',
    icon: 'FlaskConical',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      let normal = 0;
      let borderline = 0;
      let high = 0;

      records.forEach(r => {
        const val = toNum(r.tg);
        if (val !== null) {
          if (val < 150) normal++;
          else if (val < 200) borderline++;
          else high++;
        }
      });

      return [
        { label: 'نرمال (< 150)', value: normal, color: '#10b981', subLabel: `${((normal / total) * 100).toFixed(0)}٪` },
        { label: 'مرزی (150-199)', value: borderline, color: '#f59e0b', subLabel: `${((borderline / total) * 100).toFixed(0)}٪` },
        { label: 'بالا (≥ 200)', value: high, color: '#ef4444', subLabel: `${((high / total) * 100).toFixed(0)}٪` }
      ];
    }
  },

  hearing_status: {
    key: 'hearing_status',
    label: 'نتیجه شنوایی‌سنجی (Audiometry)',
    category: 'تست‌های پاراکلینیک',
    description: 'وضعیت سلامت سیستم شنوایی و افت شنوایی ناشی از صدا (NIHL)',
    defaultTitle: 'توزیع نتایج اودیومتری و شنوایی‌سنجی',
    defaultSubtitle: 'ارزیابی افت شنوایی حسی-عصبی و هدایتی در پرسنل',
    defaultType: 'donut',
    defaultPalette: 'teal',
    icon: 'Volume2',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const res = (r.audio_r || r.audio_l || 'Normal').trim();
        counts[res] = (counts[res] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({
          label,
          value,
          subLabel: `${((value / total) * 100).toFixed(0)}٪`
        }));
    }
  },

  spiro_status: {
    key: 'spiro_status',
    label: 'نتیجه اسپیرومتری و سلامت ریه',
    category: 'تست‌های پاراکلینیک',
    description: 'ارزیابی ظرفیت‌های تنفسی، الگوی انسدادی و تحدیدی ریه',
    defaultTitle: 'توزیع نتایج تست اسپیرومتری ریه',
    defaultSubtitle: 'بررسی سلامت سیستم تنفسی کارکنان در مواجهه با آلاینده‌ها',
    defaultType: 'donut',
    defaultPalette: 'indigo',
    icon: 'Wind',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const res = (r.spiro_result || 'Normal').trim();
        counts[res] = (counts[res] || 0) + 1;
      });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({
          label,
          value,
          subLabel: `${((value / total) * 100).toFixed(0)}٪`
        }));
    }
  },

  annual_trend: {
    key: 'annual_trend',
    label: 'روند سنواتی تعداد معاینات ادواری',
    category: 'عمومی و سازمانی',
    description: 'نمودار روند حجم معاینات انجام‌شده در طول سال‌های مختلف',
    defaultTitle: 'روند سنواتی معاینات طب کار',
    defaultSubtitle: 'تعداد کل معاینات ثبت‌شده به تفکیک دوره‌ها و سال‌های معاینه',
    defaultType: 'area',
    defaultPalette: 'teal',
    icon: 'Calendar',
    unit: 'معاینه',
    calculate: (records) => {
      const yearCounts: Record<string, number> = {};
      records.forEach(r => {
        const y = r.exam_year || '1402';
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      });
      return Object.entries(yearCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, value]) => ({
          label: `سال ${label}`,
          value
        }));
    }
  },

  age_groups: {
    key: 'age_groups',
    label: 'هرم و توزیع رده‌های سنی پرسنل',
    category: 'عمومی و سازمانی',
    description: 'دسته‌بندی سن کارکنان در بازه‌های جوان، میانسال و باسابقه',
    defaultTitle: 'توزیع گروه‌های سنی کارکنان',
    defaultSubtitle: 'فراوانی رده‌های سنی پرسنل سازمان',
    defaultType: 'bar',
    defaultPalette: 'indigo',
    icon: 'Users',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      let under30 = 0;
      let age30to39 = 0;
      let age40to49 = 0;
      let age50plus = 0;
      let unknown = 0;

      records.forEach(r => {
        const age = toNum(r.age);
        if (age === null) unknown++;
        else if (age < 30) under30++;
        else if (age < 40) age30to39++;
        else if (age < 50) age40to49++;
        else age50plus++;
      });

      const list: ChartDataItem[] = [
        { label: 'کمتر از ۳۰ سال', value: under30, color: '#38bdf8', subLabel: `${((under30 / total) * 100).toFixed(0)}٪` },
        { label: '۳۰ تا ۳۹ سال', value: age30to39, color: '#0d9488', subLabel: `${((age30to39 / total) * 100).toFixed(0)}٪` },
        { label: '۴۰ تا ۴۹ سال', value: age40to49, color: '#6366f1', subLabel: `${((age40to49 / total) * 100).toFixed(0)}٪` },
        { label: '۵۰ سال به بالا', value: age50plus, color: '#f59e0b', subLabel: `${((age50plus / total) * 100).toFixed(0)}٪` }
      ];
      if (unknown > 0 && records.length > unknown) {
        list.push({ label: 'سن نامشخص', value: unknown, color: '#94a3b8', subLabel: `${((unknown / total) * 100).toFixed(0)}٪` });
      }
      return list;
    }
  },

  gender_dist: {
    key: 'gender_dist',
    label: 'ترکیب جنسیتی پرسنل',
    category: 'عمومی و سازمانی',
    description: 'توزیع فراوانی کارکنان زن و مرد تحت پوشش معاینات',
    defaultTitle: 'ترکیب جنسیتی کارکنان',
    defaultSubtitle: 'نسبت پرسنل آقا و خانم سازمان',
    defaultType: 'donut',
    defaultPalette: 'multi',
    icon: 'Users',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const g = (r.gender || 'مرد').trim();
        counts[g] = (counts[g] || 0) + 1;
      });
      return Object.entries(counts).map(([label, value]) => ({
        label,
        value,
        color: label === 'زن' || label.toLowerCase().includes('fe') ? '#ec4899' : '#0284c7',
        subLabel: `${((value / total) * 100).toFixed(0)}٪`
      }));
    }
  },

  followup_status: {
    key: 'followup_status',
    label: 'وضعیت نیاز به پیگیری درمانی / ارجاع',
    category: 'ارزیابی‌های پایه و بالینی',
    description: 'نسبت پرسنل نیازمند ویزیت مجدد یا پیگیری تشخیصی',
    defaultTitle: 'وضعیت نیاز به پیگیری تخصصی',
    defaultSubtitle: 'کارکنانی که نیاز به ویزیت تکمیلی یا ارجاع دارند',
    defaultType: 'donut',
    defaultPalette: 'amber',
    icon: 'Activity',
    unit: 'نفر',
    calculate: (records, totalCount) => {
      const total = totalCount || records.length || 1;
      let needed = 0;
      let notNeeded = 0;

      records.forEach(r => {
        if (r.final_followup_needed === 'بله') needed++;
        else notNeeded++;
      });

      return [
        { label: 'بدون نیاز به پیگیری', value: notNeeded, color: '#10b981', subLabel: `${((notNeeded / total) * 100).toFixed(0)}٪` },
        { label: 'نیازمند پیگیری درمانی', value: needed, color: '#ef4444', subLabel: `${((needed / total) * 100).toFixed(0)}٪` }
      ];
    }
  }
};

export function getMetricIcon(iconName: string): React.ReactNode {
  switch (iconName) {
    case 'Building2': return React.createElement(Building2, { className: 'w-4 h-4' });
    case 'CheckCircle2': return React.createElement(CheckCircle2, { className: 'w-4 h-4' });
    case 'Scale': return React.createElement(Scale, { className: 'w-4 h-4' });
    case 'Heart': return React.createElement(Heart, { className: 'w-4 h-4' });
    case 'AlertTriangle': return React.createElement(AlertTriangle, { className: 'w-4 h-4' });
    case 'ShieldCheck': return React.createElement(ShieldCheck, { className: 'w-4 h-4' });
    case 'FlaskConical': return React.createElement(FlaskConical, { className: 'w-4 h-4' });
    case 'Activity': return React.createElement(Activity, { className: 'w-4 h-4' });
    case 'Calendar': return React.createElement(Calendar, { className: 'w-4 h-4' });
    case 'Eye': return React.createElement(Eye, { className: 'w-4 h-4' });
    case 'Volume2': return React.createElement(Volume2, { className: 'w-4 h-4' });
    case 'Wind': return React.createElement(Wind, { className: 'w-4 h-4' });
    case 'Users': return React.createElement(Users, { className: 'w-4 h-4' });
    default: return React.createElement(Activity, { className: 'w-4 h-4' });
  }
}
