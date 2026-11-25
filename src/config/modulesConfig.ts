import { toast } from 'react-hot-toast';
import { apiDb, getAuthToken } from '../services/apiDatabaseClient';
import {
  SYSTEM_MODULE_GROUPS,
  ALL_SYSTEM_MODULES,
  ALL_PSM_SUBITEMS,
  ALL_DOCUMENTS_SUBITEMS,
  ALL_HEALTH_ENV_SUBITEMS,
  ALL_FIRE_DEPT_SUBITEMS,
  ALL_SAFETY_DEPT_SUBITEMS,
  DEFAULT_DASHBOARD_CARDS_LAYOUT,
  type SystemModuleGroup,
  type SystemModuleConfig,
  type HealthEnvSubItemConfig,
  type FireDeptSubItemConfig,
  type SafetyDeptSubItemConfig,
  type CardLayoutItem,
  type DashboardLayoutConfig,
} from '../../shared/modulesCatalog';

export {
  SYSTEM_MODULE_GROUPS,
  ALL_SYSTEM_MODULES,
  ALL_PSM_SUBITEMS,
  ALL_DOCUMENTS_SUBITEMS,
  ALL_HEALTH_ENV_SUBITEMS,
  ALL_FIRE_DEPT_SUBITEMS,
  ALL_SAFETY_DEPT_SUBITEMS,
  DEFAULT_DASHBOARD_CARDS_LAYOUT,
  type SystemModuleGroup,
  type SystemModuleConfig,
  type HealthEnvSubItemConfig,
  type FireDeptSubItemConfig,
  type SafetyDeptSubItemConfig,
  type CardLayoutItem,
  type DashboardLayoutConfig,
};

async function fetchSettingFromServer(key: string): Promise<any> {
  if (typeof window === 'undefined' || !getAuthToken()) return null;
  try {
    return await apiDb.getSetting(key);
  } catch {
    return null;
  }
}

async function saveSettingToServer(key: string, value: any, description?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    await apiDb.saveSetting(key, value, description);
    return true;
  } catch (err: any) {
    toast.error(err?.message || 'خطا در ذخیره پیکربندی ماژول‌ها در پایگاه داده');
    return false;
  }
}

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
  if (typeof window === 'undefined' || !getAuthToken()) return;
  try {
    const [uiCfg, healthCfg, fireCfg, safetyCfg] = await Promise.all([
      fetchSettingFromServer(STORAGE_KEY),
      fetchSettingFromServer(STORAGE_KEY_HEALTH_ENV),
      fetchSettingFromServer(STORAGE_KEY_FIRE_DEPT),
      fetchSettingFromServer(STORAGE_KEY_SAFETY_DEPT),
    ]);

    if (Array.isArray(uiCfg) && uiCfg.length > 0) {
      memoryUiConfig = uiCfg;
      window.dispatchEvent(new Event('hse_ui_config_updated'));
    }

    if (Array.isArray(healthCfg) && healthCfg.length > 0) {
      memoryHealthEnvConfig = healthCfg;
      window.dispatchEvent(new Event('health_env_config_updated'));
    }

    if (Array.isArray(fireCfg) && fireCfg.length > 0) {
      memoryFireDeptConfig = fireCfg;
      window.dispatchEvent(new Event('fire_dept_config_updated'));
    }

    if (Array.isArray(safetyCfg) && safetyCfg.length > 0) {
      memorySafetyDeptConfig = safetyCfg;
      window.dispatchEvent(new Event('safety_dept_config_updated'));
    }
  } catch (err) {
    console.warn('Failed to hydrate module configs from database:', err);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (getAuthToken()) {
      syncModuleConfigsFromDb();
    }
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
      apiDb.invalidateCache('settings');
      syncModuleConfigsFromDb();
    }
  };
  window.addEventListener('app_data_mutated', handleRemoteConfigMutation);
  window.addEventListener('hse_data_mutated', handleRemoteConfigMutation);
  window.addEventListener('hse_auth_state_changed', () => {
    if (getAuthToken()) syncModuleConfigsFromDb();
  });
}

/**
 * Merges saved user UI layout with all available system modules automatically.
 * Defaults strictly to the authoritative navigation menu grouping.
 */
export function getMergedUiConfig(): SystemModuleConfig[] {
  try {
    const parsed: SystemModuleConfig[] | null = memoryUiConfig;
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return ALL_SYSTEM_MODULES.map(m => ({ ...m }));
    }

    const mergedList: SystemModuleConfig[] = [];
    const validGroupIds = new Set(SYSTEM_MODULE_GROUPS.map(g => g.id));
    const legacyTitlesToMigrate = new Set([
      'گزارشات و تحلیل‌های آماری',
      'گزارشات و آمار',
      'پرونده جامع ۳۶۰ درجه پرسنل',
      'سوابق و پرونده جامع پرسنل',
    ]);

    parsed.forEach(savedItem => {
      const sysModule = ALL_SYSTEM_MODULES.find(m => m.key === savedItem.key);
      if (sysModule) {
        let resolvedGroupId = savedItem.groupId;
        if (!resolvedGroupId || !validGroupIds.has(resolvedGroupId) || resolvedGroupId === 'safety') {
          resolvedGroupId = sysModule.groupId || 'dashboards';
        }
        const resolvedTitleFa =
          !savedItem.titleFa || legacyTitlesToMigrate.has(savedItem.titleFa)
            ? sysModule.titleFa
            : savedItem.titleFa;

        mergedList.push({
          key: sysModule.key,
          titleFa: resolvedTitleFa,
          titleEn: sysModule.titleEn || savedItem.titleEn,
          enabled: savedItem.enabled !== undefined ? savedItem.enabled : true,
          groupId: sysModule.groupId || resolvedGroupId,
          category: sysModule.category,
          descriptionFa: sysModule.descriptionFa
        });
      }
    });

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

    const canonicalAnalyticsOrder: Record<string, number> = {
      reports: 1,
      'personnel-history': 2,
      'ai-assistant': 3,
    };
    const analyticsItems = mergedList
      .filter(m => m.groupId === 'intelligent_analytics')
      .sort((a, b) => (canonicalAnalyticsOrder[a.key] || 99) - (canonicalAnalyticsOrder[b.key] || 99));

    if (analyticsItems.length > 1) {
      let ptr = 0;
      for (let i = 0; i < mergedList.length; i++) {
        if (mergedList[i].groupId === 'intelligent_analytics') {
          mergedList[i] = analyticsItems[ptr++];
        }
      }
    }

    return mergedList;
  } catch (err) {
    console.error('Error loading merged UI config:', err);
    return ALL_SYSTEM_MODULES.map(m => ({ ...m }));
  }
}

/**
 * Saves updated module list strictly to PostgreSQL central database
 */
export function saveUiConfig(modules: SystemModuleConfig[]): boolean {
  try {
    memoryUiConfig = modules;
    void saveSettingToServer(STORAGE_KEY, modules, 'System Navigation Modules Config');
    window.dispatchEvent(new Event('hse_ui_config_updated'));
    return true;
  } catch (err) {
    console.error('Failed to save UI config:', err);
    return false;
  }
}

/**
 * Resets UI layout configuration to default in central database
 */
export function resetUiConfig(): void {
  try {
    memoryUiConfig = null;
    void saveSettingToServer(STORAGE_KEY, [], 'Reset System Navigation Modules Config');
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
    const parsed: HealthEnvSubItemConfig[] | null = memoryHealthEnvConfig;
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
    void saveSettingToServer(STORAGE_KEY_HEALTH_ENV, items, 'Health & Env Subitems Config');
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
    void saveSettingToServer(STORAGE_KEY_HEALTH_ENV, [], 'Reset Health & Env Subitems Config');
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
    const parsed: FireDeptSubItemConfig[] | null = memoryFireDeptConfig;
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
    void saveSettingToServer(STORAGE_KEY_FIRE_DEPT, items, 'Fire Dept Subitems Config');
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
    void saveSettingToServer(STORAGE_KEY_FIRE_DEPT, [], 'Reset Fire Dept Subitems Config');
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
    const parsed: SafetyDeptSubItemConfig[] | null = memorySafetyDeptConfig;
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
    void saveSettingToServer(STORAGE_KEY_SAFETY_DEPT, items, 'Safety Dept Subitems Config');
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
    void saveSettingToServer(STORAGE_KEY_SAFETY_DEPT, [], 'Reset Safety Dept Subitems Config');
    window.dispatchEvent(new Event('safety_dept_config_updated'));
  } catch (err) {
    console.error('Failed to reset Safety Dept config:', err);
  }
}
