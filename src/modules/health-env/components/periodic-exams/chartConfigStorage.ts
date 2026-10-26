import { UserChartItemConfig } from './EditChartModal';

const STORAGE_KEY_PREFIX = 'OCC_HEALTH_DASHBOARD_CHARTS_CONFIG_V2';

// In-memory fallback cache in case browser localStorage is full or disabled
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

// Helper to sanitize and compress chart configs to minimal footprint
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

// Attempt to free up storage from obsolete or legacy keys
function cleanupLegacyStorageKeys() {
  try {
    const legacyKeysToPurge = [
      'hse_medical_exams_v1',
      'hse_medical_exams_v2',
      'OCC_HEALTH_DASHBOARD_CHARTS_CONFIG_V1',
      'periodic_exams_cache_temp',
      'hse_temp_import_dump'
    ];
    for (const key of legacyKeysToPurge) {
      localStorage.removeItem(key);
    }
  } catch (_) {
    // Ignore storage errors during cleanup
  }
}

export function loadUserChartConfigs(userId?: string): UserChartItemConfig[] {
  const key = `${STORAGE_KEY_PREFIX}_${userId || 'default'}`;

  // 1. Check in-memory cache first
  if (memoryCache[key] && Array.isArray(memoryCache[key]) && memoryCache[key].length > 0) {
    return memoryCache[key];
  }

  // 2. Try loading from localStorage
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = sanitizeConfigs(parsed);
        memoryCache[key] = sanitized;
        return sanitized;
      }
    }
  } catch (_) {
    // Local storage reading failed or quota restricted
  }

  // 3. Try sessionStorage fallback
  try {
    const sessionRaw = sessionStorage.getItem(key);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = sanitizeConfigs(parsed);
        memoryCache[key] = sanitized;
        return sanitized;
      }
    }
  } catch (_) {
    // Session storage fallback failed
  }

  memoryCache[key] = DEFAULT_DASHBOARD_CHARTS;
  return DEFAULT_DASHBOARD_CHARTS;
}

export function saveUserChartConfigs(configs: UserChartItemConfig[], userId?: string): void {
  const key = `${STORAGE_KEY_PREFIX}_${userId || 'default'}`;
  const sanitized = sanitizeConfigs(configs);

  // Always update in-memory cache so current session retains all changes flawlessly
  memoryCache[key] = sanitized;

  const payload = JSON.stringify(sanitized);

  // Try saving to localStorage
  try {
    localStorage.setItem(key, payload);
    return;
  } catch (err: any) {
    // If quota exceeded, clean up legacy items and retry once
    cleanupLegacyStorageKeys();
    try {
      localStorage.setItem(key, payload);
      return;
    } catch (_) {
      // If still exceeding quota, fallback gracefully to sessionStorage
      try {
        sessionStorage.setItem(key, payload);
      } catch (sessionErr) {
        // In-memory cache is already updated, no further action needed
      }
    }
  }
}

export function resetUserChartConfigs(userId?: string): UserChartItemConfig[] {
  const key = `${STORAGE_KEY_PREFIX}_${userId || 'default'}`;
  memoryCache[key] = DEFAULT_DASHBOARD_CHARTS;

  try {
    localStorage.removeItem(key);
  } catch (_) {}

  try {
    sessionStorage.removeItem(key);
  } catch (_) {}

  return DEFAULT_DASHBOARD_CHARTS;
}
