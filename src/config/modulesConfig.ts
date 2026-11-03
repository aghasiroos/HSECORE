import { apiDb } from '../services/apiDatabaseClient';
import {
  HSECORE_SYSTEM_MODULES,
  HSECORE_DOCUMENTS_SUBITEMS,
  HSECORE_HEALTH_ENV_SUBITEMS,
  HSECORE_FIRE_DEPT_SUBITEMS,
  HSECORE_SAFETY_DEPT_SUBITEMS,
} from '../../shared/hsecore-module-catalog.ts';

export interface SystemModuleGroup {
  id: string;
  titleFa: string;
  titleEn: string;
  color: string;
  bgLight: string;
  borderLight: string;
  iconName?: string;
  badgeCount?: number;
}

export const SYSTEM_MODULE_GROUPS: SystemModuleGroup[] = [
  {
    id: 'dashboards',
    titleFa: 'داشبوردها و تحلیل‌های آماری',
    titleEn: 'Executive Dashboards & Analytics',
    color: 'text-sky-600 dark:text-sky-400',
    bgLight: 'bg-sky-50 dark:bg-sky-950/30',
    borderLight: 'border-sky-200 dark:border-sky-800/40',
    iconName: 'BarChart3'
  },
  {
    id: 'departments',
    titleFa: 'دپارتمان‌های تخصصی HSE',
    titleEn: 'Specialized HSE Units',
    color: 'text-rose-600 dark:text-rose-400',
    bgLight: 'bg-rose-50 dark:bg-rose-950/30',
    borderLight: 'border-rose-200 dark:border-rose-800/40',
    iconName: 'Building2'
  },
  {
    id: 'safety_permits',
    titleFa: 'مجوزهای کار و کنترل ریسک',
    titleEn: 'Permits & Risk Control',
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30',
    borderLight: 'border-amber-200 dark:border-amber-800/40',
    iconName: 'FileCheck2'
  },
  {
    id: 'incidents_compliance',
    titleFa: 'رویدادها و انضباط ایمنی',
    titleEn: 'Incidents & Compliance',
    color: 'text-red-600 dark:text-red-400',
    bgLight: 'bg-red-50 dark:bg-red-950/30',
    borderLight: 'border-red-200 dark:border-red-800/40',
    iconName: 'AlertOctagon'
  },
  {
    id: 'human_capital',
    titleFa: 'سرمایه انسانی و آموزش',
    titleEn: 'Human Capital & Training',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderLight: 'border-emerald-200 dark:border-emerald-800/40',
    iconName: 'GraduationCap'
  },
  {
    id: 'workflows',
    titleFa: 'کارتابل و فرآیندهای سازمانی',
    titleEn: 'Workflows & Digital Workplace',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderLight: 'border-indigo-200 dark:border-indigo-800/40',
    iconName: 'Workflow'
  },
  {
    id: 'system',
    titleFa: 'مدیریت و پیکربندی سامانه',
    titleEn: 'Governance & Administration',
    color: 'text-slate-600 dark:text-slate-400',
    bgLight: 'bg-slate-100 dark:bg-slate-800/50',
    borderLight: 'border-slate-200 dark:border-slate-700',
    iconName: 'SlidersHorizontal'
  }
];

export interface SystemModuleConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  enabled?: boolean; // default true
  groupId?: string; // One of: 'dashboards' | 'departments' | 'safety_permits' | 'incidents_compliance' | 'human_capital' | 'workflows' | 'system'
  category?: string;
  descriptionFa?: string;
}

export interface HealthEnvSubItemConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  group: 'health' | 'env';
  enabled?: boolean; // default true
  descriptionFa?: string;
}

export interface FireDeptSubItemConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  type: 'general' | 'category';
  enabled?: boolean; // default true
  descriptionFa?: string;
}

export interface SafetyDeptSubItemConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  group: 'checklists' | 'operations';
  enabled?: boolean; // default true
  descriptionFa?: string;
}

export const ALL_SYSTEM_MODULES: SystemModuleConfig[] =
  HSECORE_SYSTEM_MODULES.map(module => ({ ...module })) as unknown as SystemModuleConfig[];

export const ALL_DOCUMENTS_SUBITEMS = HSECORE_DOCUMENTS_SUBITEMS.map(item => ({ ...item }));

export const ALL_HEALTH_ENV_SUBITEMS: HealthEnvSubItemConfig[] =
  HSECORE_HEALTH_ENV_SUBITEMS.map(item => ({ ...item })) as unknown as HealthEnvSubItemConfig[];

export const ALL_FIRE_DEPT_SUBITEMS: FireDeptSubItemConfig[] =
  HSECORE_FIRE_DEPT_SUBITEMS.map(item => ({ ...item })) as unknown as FireDeptSubItemConfig[];

export const ALL_SAFETY_DEPT_SUBITEMS: SafetyDeptSubItemConfig[] =
  HSECORE_SAFETY_DEPT_SUBITEMS.map(item => ({ ...item })) as unknown as SafetyDeptSubItemConfig[];

export const STORAGE_KEY = 'hse_ui_config_v3';
export const PREV_STORAGE_KEY = 'hse_ui_config_v2';
export const LEGACY_STORAGE_KEY = 'hse_ui_config';
export const STORAGE_KEY_HEALTH_ENV = 'hse_health_env_ui_config';
export const STORAGE_KEY_FIRE_DEPT = 'hse_fire_dept_ui_config';
export const STORAGE_KEY_SAFETY_DEPT = 'hse_safety_dept_ui_config';

let memoryUiConfig: SystemModuleConfig[] | null = null;
let memoryHealthEnvConfig: HealthEnvSubItemConfig[] | null = null;
let memoryFireDeptConfig: FireDeptSubItemConfig[] | null = null;
let memorySafetyDeptConfig: SafetyDeptSubItemConfig[] | null = null;

export async function syncModuleConfigsFromDb(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const [uiCfg, healthCfg, fireCfg, safetyCfg] = await Promise.all([
      apiDb.getSetting(STORAGE_KEY).catch(() => null),
      apiDb.getSetting(STORAGE_KEY_HEALTH_ENV).catch(() => null),
      apiDb.getSetting(STORAGE_KEY_FIRE_DEPT).catch(() => null),
      apiDb.getSetting(STORAGE_KEY_SAFETY_DEPT).catch(() => null),
    ]);

    if (Array.isArray(uiCfg) && uiCfg.length > 0) {
      memoryUiConfig = uiCfg;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(uiCfg)); } catch {}
      window.dispatchEvent(new Event('hse_ui_config_updated'));
    } else if (uiCfg === null) {
      const localUi = localStorage.getItem(STORAGE_KEY);
      if (localUi) {
        try {
          const parsed = JSON.parse(localUi);
          if (Array.isArray(parsed) && parsed.length > 0) {
            apiDb.saveSetting(STORAGE_KEY, parsed, 'System Navigation Modules Config').catch(() => {});
          }
        } catch {}
      }
    }

    if (Array.isArray(healthCfg) && healthCfg.length > 0) {
      memoryHealthEnvConfig = healthCfg;
      try { localStorage.setItem(STORAGE_KEY_HEALTH_ENV, JSON.stringify(healthCfg)); } catch {}
      window.dispatchEvent(new Event('health_env_config_updated'));
    }

    if (Array.isArray(fireCfg) && fireCfg.length > 0) {
      memoryFireDeptConfig = fireCfg;
      try { localStorage.setItem(STORAGE_KEY_FIRE_DEPT, JSON.stringify(fireCfg)); } catch {}
      window.dispatchEvent(new Event('fire_dept_config_updated'));
    }

    if (Array.isArray(safetyCfg) && safetyCfg.length > 0) {
      memorySafetyDeptConfig = safetyCfg;
      try { localStorage.setItem(STORAGE_KEY_SAFETY_DEPT, JSON.stringify(safetyCfg)); } catch {}
      window.dispatchEvent(new Event('safety_dept_config_updated'));
    }
  } catch (err) {
    console.warn('Failed to hydrate module configs from database:', err);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncModuleConfigsFromDb();
  }, 150);

  const handleRemoteConfigMutation = (e: any) => {
    const key = String(e?.detail?.key || e?.detail?.entityType || '');
    if (
      key === STORAGE_KEY ||
      key === STORAGE_KEY_HEALTH_ENV ||
      key === STORAGE_KEY_FIRE_DEPT ||
      key === STORAGE_KEY_SAFETY_DEPT ||
      key === 'settings'
    ) {
      syncModuleConfigsFromDb();
    }
  };
  window.addEventListener('app_data_mutated', handleRemoteConfigMutation);
  window.addEventListener('hse_data_mutated', handleRemoteConfigMutation);
}

/**
 * Merges saved user UI layout with all available system modules automatically.
 * Defaults strictly to the authoritative navigation menu grouping.
 */
export function getMergedUiConfig(): SystemModuleConfig[] {
  try {
    let parsed: SystemModuleConfig[] | null = memoryUiConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_SYSTEM_MODULES.map(m => ({ ...m }));
    }

    const mergedList: SystemModuleConfig[] = [];
    const validGroupIds = new Set(SYSTEM_MODULE_GROUPS.map(g => g.id));

    // 1. Preserve saved modules in their stored order and customized properties
    parsed.forEach(savedItem => {
      const sysModule = ALL_SYSTEM_MODULES.find(m => m.key === savedItem.key);
      if (sysModule) {
        let resolvedGroupId = savedItem.groupId;
        if (!resolvedGroupId || !validGroupIds.has(resolvedGroupId) || resolvedGroupId === 'safety') {
          resolvedGroupId = sysModule.groupId || 'dashboards';
        }

        mergedList.push({
          key: sysModule.key,
          titleFa: savedItem.titleFa || sysModule.titleFa,
          titleEn: savedItem.titleEn || sysModule.titleEn,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          groupId: sysModule.groupId || resolvedGroupId,
          category: sysModule.category,
          descriptionFa: sysModule.descriptionFa
        });
      }
    });

    // 2. Automatically discover and append ANY new system module missing from saved config
    ALL_SYSTEM_MODULES.forEach(sysModule => {
      if (!mergedList.some(item => item.key === sysModule.key)) {
        mergedList.push({
          key: sysModule.key,
          titleFa: sysModule.titleFa,
          titleEn: sysModule.titleEn,
          enabled: true,
          groupId: sysModule.groupId || 'dashboards',
          category: sysModule.category,
          descriptionFa: sysModule.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading merged UI config:', err);
    return ALL_SYSTEM_MODULES.map(m => ({ ...m }));
  }
}

/**
 * Saves updated module list to central database and local cache
 */
export function saveUiConfig(modules: SystemModuleConfig[]): boolean {
  try {
    memoryUiConfig = modules;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
    apiDb.saveSetting(STORAGE_KEY, modules, 'System Navigation Modules Config').catch(() => {});
    window.dispatchEvent(new Event('hse_ui_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save UI config:', err);
    return false;
  }
}

/**
 * Resets UI layout configuration to default in both local cache and central database
 */
export function resetUiConfig(): void {
  try {
    memoryUiConfig = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREV_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    apiDb.saveSetting(STORAGE_KEY, [], 'Reset System Navigation Modules Config').catch(() => {});
    window.dispatchEvent(new Event('hse_ui_config_updated'));
  } catch (e) {
    console.error('Failed to reset UI config', e);
  }
}

/**
 * Merges saved Health & Environment sub-item layout with defaults
 */
export function getMergedHealthEnvConfig(): HealthEnvSubItemConfig[] {
  try {
    let parsed: HealthEnvSubItemConfig[] | null = memoryHealthEnvConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY_HEALTH_ENV);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_HEALTH_ENV_SUBITEMS.map(m => ({ ...m }));
    }

    const mergedList: HealthEnvSubItemConfig[] = [];

    parsed.forEach(savedItem => {
      const defaultItem = ALL_HEALTH_ENV_SUBITEMS.find(m => m.key === savedItem.key);
      if (defaultItem) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: savedItem.titleFa || defaultItem.titleFa,
          titleEn: savedItem.titleEn || defaultItem.titleEn,
          group: defaultItem.group,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    ALL_HEALTH_ENV_SUBITEMS.forEach(defaultItem => {
      if (!mergedList.some(item => item.key === defaultItem.key)) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: defaultItem.titleFa,
          titleEn: defaultItem.titleEn,
          group: defaultItem.group,
          enabled: true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading Health & Env config:', err);
    return ALL_HEALTH_ENV_SUBITEMS.map(m => ({ ...m }));
  }
}

export function saveHealthEnvConfig(items: HealthEnvSubItemConfig[]): boolean {
  try {
    memoryHealthEnvConfig = items;
    localStorage.setItem(STORAGE_KEY_HEALTH_ENV, JSON.stringify(items));
    apiDb.saveSetting(STORAGE_KEY_HEALTH_ENV, items, 'Health & Env Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('health_env_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save Health & Env config:', err);
    return false;
  }
}

export function resetHealthEnvConfig(): void {
  try {
    memoryHealthEnvConfig = null;
    localStorage.removeItem(STORAGE_KEY_HEALTH_ENV);
    apiDb.saveSetting(STORAGE_KEY_HEALTH_ENV, [], 'Reset Health & Env Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('health_env_config_updated'));
  } catch (err) {
    console.error('Failed to reset Health & Env config:', err);
  }
}

/**
 * Merges saved Fire Department sub-item layout with defaults
 */
export function getMergedFireDeptConfig(): FireDeptSubItemConfig[] {
  try {
    let parsed: FireDeptSubItemConfig[] | null = memoryFireDeptConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY_FIRE_DEPT);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_FIRE_DEPT_SUBITEMS.map(m => ({ ...m }));
    }

    const mergedList: FireDeptSubItemConfig[] = [];

    parsed.forEach(savedItem => {
      const defaultItem = ALL_FIRE_DEPT_SUBITEMS.find(m => m.key === savedItem.key);
      if (defaultItem) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: savedItem.titleFa || defaultItem.titleFa,
          titleEn: savedItem.titleEn || defaultItem.titleEn,
          type: defaultItem.type,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    ALL_FIRE_DEPT_SUBITEMS.forEach(defaultItem => {
      if (!mergedList.some(item => item.key === defaultItem.key)) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: defaultItem.titleFa,
          titleEn: defaultItem.titleEn,
          type: defaultItem.type,
          enabled: true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading Fire Dept config:', err);
    return ALL_FIRE_DEPT_SUBITEMS.map(m => ({ ...m }));
  }
}

export function saveFireDeptConfig(items: FireDeptSubItemConfig[]): boolean {
  try {
    memoryFireDeptConfig = items;
    localStorage.setItem(STORAGE_KEY_FIRE_DEPT, JSON.stringify(items));
    apiDb.saveSetting(STORAGE_KEY_FIRE_DEPT, items, 'Fire Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('fire_dept_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save Fire Dept config:', err);
    return false;
  }
}

export function resetFireDeptConfig(): void {
  try {
    memoryFireDeptConfig = null;
    localStorage.removeItem(STORAGE_KEY_FIRE_DEPT);
    apiDb.saveSetting(STORAGE_KEY_FIRE_DEPT, [], 'Reset Fire Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('fire_dept_config_updated'));
  } catch (err) {
    console.error('Failed to reset Fire Dept config:', err);
  }
}

/**
 * Merges saved Safety Department sub-item layout with defaults
 */
export function getMergedSafetyDeptConfig(): SafetyDeptSubItemConfig[] {
  try {
    let parsed: SafetyDeptSubItemConfig[] | null = memorySafetyDeptConfig;
    if (!parsed) {
      const saved = localStorage.getItem(STORAGE_KEY_SAFETY_DEPT);
      if (saved) {
        parsed = JSON.parse(saved);
      }
    }
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_SAFETY_DEPT_SUBITEMS.map(m => ({ ...m }));
    }

    const mergedList: SafetyDeptSubItemConfig[] = [];

    parsed.forEach(savedItem => {
      const defaultItem = ALL_SAFETY_DEPT_SUBITEMS.find(m => m.key === savedItem.key);
      if (defaultItem) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: savedItem.titleFa || defaultItem.titleFa,
          titleEn: savedItem.titleEn || defaultItem.titleEn,
          group: defaultItem.group,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    ALL_SAFETY_DEPT_SUBITEMS.forEach(defaultItem => {
      if (!mergedList.some(item => item.key === defaultItem.key)) {
        mergedList.push({
          key: defaultItem.key,
          titleFa: defaultItem.titleFa,
          titleEn: defaultItem.titleEn,
          group: defaultItem.group,
          enabled: true,
          descriptionFa: defaultItem.descriptionFa
        });
      }
    });

    return mergedList;
  } catch (err) {
    console.error('Error loading Safety Dept config:', err);
    return ALL_SAFETY_DEPT_SUBITEMS.map(m => ({ ...m }));
  }
}

export function saveSafetyDeptConfig(items: SafetyDeptSubItemConfig[]): boolean {
  try {
    memorySafetyDeptConfig = items;
    localStorage.setItem(STORAGE_KEY_SAFETY_DEPT, JSON.stringify(items));
    apiDb.saveSetting(STORAGE_KEY_SAFETY_DEPT, items, 'Safety Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('safety_dept_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save Safety Dept config:', err);
    return false;
  }
}

export function resetSafetyDeptConfig(): void {
  try {
    memorySafetyDeptConfig = null;
    localStorage.removeItem(STORAGE_KEY_SAFETY_DEPT);
    apiDb.saveSetting(STORAGE_KEY_SAFETY_DEPT, [], 'Reset Safety Dept Subitems Config').catch(() => {});
    window.dispatchEvent(new Event('safety_dept_config_updated'));
  } catch (err) {
    console.error('Failed to reset Safety Dept config:', err);
  }
}


