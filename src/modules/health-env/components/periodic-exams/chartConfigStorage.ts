import { UserChartItemConfig } from './EditChartModal';
import { apiDb } from '../../../../services/apiDatabaseClient';

const STORAGE_KEY_PREFIX = 'OCC_HEALTH_DASHBOARD_CHARTS_CONFIG_V2';

// Pure in-memory session cache synchronized with PostgreSQL user_preferences
const memoryCache: Record<string, UserChartItemConfig[]> = {};

export const DEFAULT_DASHBOARD_CHARTS: UserChartItemConfig[] = [
  {
    id: 'chart_company_default',
    metricKey: 'company',
    title: 'توزیع پرسنل بر اساس محل خدمت',
    subtitle: 'تعداد پرسنل تحت پوشش معاینات در واحدهای عملیاتی و ستادی',
    chartType: 'hbar',
    palette: 'teal',
    width: 'half',
    height: 260
  },
  {
    id: 'chart_opinion_default',
    metricKey: 'opinion',
    title: 'نتیجه نظریه نهایی معاینات طب کار',
    subtitle: 'تفکیک وضعیت صلاحیت پرسنل (بلامانع، مشروط، عدم صلاحیت و ارجاع)',
    chartType: 'donut',
    palette: 'multi',
    width: 'half',
    height: 260
  },
  {
    id: 'chart_bmi_default',
    metricKey: 'bmi',
    title: 'توزیع شاخص توده بدنی (BMI) پرسنل',
    subtitle: 'فراوانی وضعیت وزن و چاقی در میان کارکنان سازمان',
    chartType: 'bar',
    palette: 'multi',
    width: 'half',
    height: 260
  },
  {
    id: 'chart_bp_default',
    metricKey: 'bp',
    title: 'وضعیت فشار خون پرسنل',
    subtitle: 'ارزیابی فشار خون سیستولیک و دیاستولیک طبق استاندارد طب کار',
    chartType: 'bar',
    palette: 'rose',
    width: 'half',
    height: 260
  },
  {
    id: 'chart_dx_default',
    metricKey: 'top_diseases',
    title: '۱۰ تشخیص و بیماری شایع شناسایی‌شده',
    subtitle: 'بیماری‌های شغلی و غیرشغلی اولویت‌دار جهت اقدامات اصلاحی و بهداشتی',
    chartType: 'hbar',
    palette: 'amber',
    width: 'half',
    height: 280
  },
  {
    id: 'chart_hazards_default',
    metricKey: 'top_hazards',
    title: 'شایع‌ترین عوامل زیان‌آور محیط کار',
    subtitle: 'مواجهه شغلی کارکنان با خطرات فیزیکی، ارگونومی، شیمیایی و بیولوژیک',
    chartType: 'hbar',
    palette: 'indigo',
    width: 'half',
    height: 280
  }
];

function sanitizeConfigs(configs: UserChartItemConfig[]): UserChartItemConfig[] {
  if (!Array.isArray(configs)) return DEFAULT_DASHBOARD_CHARTS;
  return configs.map(c => ({
    id: String(c.id || `chart_${Date.now()}`),
    metricKey: String(c.metricKey || 'opinion'),
    title: String(c.title || ''),
    subtitle: String(c.subtitle || ''),
    chartType: c.chartType || 'bar',
    palette: c.palette || 'teal',
    width: c.width === 'full' ? 'full' : 'half',
    height: typeof c.height === 'number' ? c.height : 260
  }));
}

export function loadUserChartConfigs(userId?: string): UserChartItemConfig[] {
  const key = `${STORAGE_KEY_PREFIX}_${userId || 'default'}`;

  if (memoryCache[key] && Array.isArray(memoryCache[key]) && memoryCache[key].length > 0) {
    return memoryCache[key];
  }

  void Promise.all([
    apiDb.userPreferences.get(key).catch(() => null),
    apiDb.getSetting(key).catch(() => null),
  ]).then(([prefRes, settingVal]) => {
    const prefVal = prefRes?.value;
    const remote = Array.isArray(prefVal) && prefVal.length > 0 ? prefVal : settingVal;
    if (Array.isArray(remote) && remote.length > 0) {
      memoryCache[key] = sanitizeConfigs(remote);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_user_preferences_updated', { detail: { key, value: memoryCache[key] } }));
      }
    }
  });

  if (!memoryCache[key]) {
    memoryCache[key] = DEFAULT_DASHBOARD_CHARTS;
  }
  return memoryCache[key];
}

export function saveUserChartConfigs(configs: UserChartItemConfig[], userId?: string): void {
  const key = `${STORAGE_KEY_PREFIX}_${userId || 'default'}`;
  const sanitized = sanitizeConfigs(configs);
  memoryCache[key] = sanitized;

  void apiDb.userPreferences.set(key, sanitized).catch((err) => {
    console.warn('Failed to persist user chart configs:', err);
  });
}

export function resetUserChartConfigs(userId?: string): UserChartItemConfig[] {
  const key = `${STORAGE_KEY_PREFIX}_${userId || 'default'}`;
  memoryCache[key] = DEFAULT_DASHBOARD_CHARTS;

  void apiDb.userPreferences.set(key, DEFAULT_DASHBOARD_CHARTS).catch((err) => {
    console.warn('Failed to reset user chart configs:', err);
  });
  return DEFAULT_DASHBOARD_CHARTS;
}
