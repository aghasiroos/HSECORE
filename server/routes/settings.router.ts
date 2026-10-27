import { Router } from 'express';
import { db, withDbRetry } from '../../src/db/index.ts';
import { systemSettings } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../core/logger.ts';
import { requireAuth, requireRole, optionalAuth, isGlobalAdminUser } from '../core/middleware/auth.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import {
  REFERRAL_STORAGE_KEY,
  filterReferralsForUser,
  loadReferrals,
  mergeAndDeduplicateReferrals,
  persistReferrals,
} from './referral.router.ts';

import {
  INTEGRATION_CONFIG_KEY,
  WEBHOOK_DELIVERY_LOGS_KEY,
  maskIntegrationConfigForClient,
  saveIntegrationConfigToDb,
  syncIntegrationConfigCache,
} from '../services/webhookDispatcher.ts';

export const settingsRouter = Router();

// In-memory persistent cache fallback ensuring settings are always available
const memorySettingsCache: Record<string, any> = {};

export function syncSettingsMemoryCache(key: string, value: any) {
  if (value === undefined || value === null) {
    delete memorySettingsCache[key];
  } else {
    memorySettingsCache[key] = value;
  }
  if (key === INTEGRATION_CONFIG_KEY) {
    syncIntegrationConfigCache(value);
  }
}

export const ADMIN_ONLY_SETTING_KEYS = [
  'system_branding',
  'security_policy',
  'smtp_config',
  'ldap_config',
  'license_info',
  'hse_integration_config',
  'hse_webhook_delivery_logs',
  'hse_system_api_tokens',
  'hse_backup_schedule_config',
  'hse_ui_config_v2',
  'hse_health_env_ui_config',
  'hse_fire_dept_ui_config',
  'hse_safety_dept_ui_config',
  'hse_inspection_alert_settings_v1',
  'org_nodes',
  'hse_org_units',
  'hse_org_jobs',
  'hse_incident_types',
  'hse_ppe_categories',
  'hse_global_sound_preferences_v1',
];

export const SENSITIVE_ADMIN_READ_KEYS = [
  'hse_integration_config',
  'hse_webhook_delivery_logs',
  'hse_system_api_tokens',
  'smtp_config',
  'ldap_config',
];

export function checkIsAdminRequest(req: any): boolean {
  const user = req?.user;
  const role = String(user?.role || '').toUpperCase();
  return isGlobalAdminUser(user) || ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN'].includes(role);
}

// Get all settings
settingsRouter.get('/', optionalAuth, async (req, res) => {
  const isAdmin = checkIsAdminRequest(req);
  try {
    const records = await withDbRetry(() => db.select().from(systemSettings));
    const settingsMap: Record<string, any> = {};
    for (const r of records) {
      if (!isAdmin && SENSITIVE_ADMIN_READ_KEYS.includes(r.key)) continue;
      settingsMap[r.key] =
        r.key === INTEGRATION_CONFIG_KEY ? maskIntegrationConfigForClient(r.value) : r.value;
    }
    for (const [k, v] of Object.entries(memorySettingsCache)) {
      if (!isAdmin && SENSITIVE_ADMIN_READ_KEYS.includes(k)) continue;
      if (settingsMap[k] === undefined) {
        settingsMap[k] = k === INTEGRATION_CONFIG_KEY ? maskIntegrationConfigForClient(v) : v;
      }
    }
    if (settingsMap[REFERRAL_STORAGE_KEY] !== undefined) {
      const rawRefs = Array.isArray(settingsMap[REFERRAL_STORAGE_KEY])
        ? settingsMap[REFERRAL_STORAGE_KEY]
        : [];
      settingsMap[REFERRAL_STORAGE_KEY] = filterReferralsForUser(req.user, rawRefs);
    }
    res.json({ success: true, data: settingsMap });
  } catch (err: any) {
    logger.warn('Failed to query db for all settings, checking memory cache fallback', { error: err?.message });
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(memorySettingsCache)) {
      if (!isAdmin && SENSITIVE_ADMIN_READ_KEYS.includes(k)) continue;
      copy[k] = k === INTEGRATION_CONFIG_KEY ? maskIntegrationConfigForClient(v) : v;
    }
    if (copy[REFERRAL_STORAGE_KEY] !== undefined) {
      copy[REFERRAL_STORAGE_KEY] = filterReferralsForUser(
        req.user,
        Array.isArray(copy[REFERRAL_STORAGE_KEY]) ? copy[REFERRAL_STORAGE_KEY] : []
      );
    }
    res.json({ success: true, data: copy });
  }
});

settingsRouter.get('/:key', optionalAuth, async (req, res) => {
  const { key } = req.params;
  if (SENSITIVE_ADMIN_READ_KEYS.includes(key) && !checkIsAdminRequest(req)) {
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای مشاهده تنظیمات امنیتی سامانه' });
  }
  if (key === REFERRAL_STORAGE_KEY) {
    try {
      const all = await loadReferrals();
      const visible = filterReferralsForUser(req.user, all);
      return res.json({ success: true, data: visible, value: visible });
    } catch {
      return res.json({ success: true, data: [], value: [] });
    }
  }
  try {
    const records = await withDbRetry(() => db.select().from(systemSettings).where(eq(systemSettings.key, key)));
    if (records.length > 0) {
      memorySettingsCache[key] = records[0].value;
      const outVal =
        key === INTEGRATION_CONFIG_KEY ? maskIntegrationConfigForClient(records[0].value) : records[0].value;
      return res.json({ success: true, data: outVal });
    }
    if (memorySettingsCache[key] !== undefined) {
      const outVal =
        key === INTEGRATION_CONFIG_KEY
          ? maskIntegrationConfigForClient(memorySettingsCache[key])
          : memorySettingsCache[key];
      return res.json({ success: true, data: outVal });
    }
    res.json({ success: true, data: null });
  } catch (err) {
    logger.warn('Failed to query db for setting, checking memory cache fallback', { key, error: (err as any)?.message });
    if (memorySettingsCache[key] !== undefined) {
      const outVal =
        key === INTEGRATION_CONFIG_KEY
          ? maskIntegrationConfigForClient(memorySettingsCache[key])
          : memorySettingsCache[key];
      return res.json({ success: true, data: outVal });
    }
    res.json({ success: true, data: null });
  }
});

// Save setting with role-aware security: sensitive system settings require ADMIN, while operational records (referrals, workflows, inspections) allowed for all authenticated users
settingsRouter.post('/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  const rawBody = req.body;
  const value = (rawBody && typeof rawBody === 'object' && 'value' in rawBody) ? rawBody.value : rawBody;
  const isAdmin = checkIsAdminRequest(req);

  if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !isAdmin) {
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای تغییر تنظیمات سیستمی' });
  }

  if (key === INTEGRATION_CONFIG_KEY) {
    try {
      const { config } = await saveIntegrationConfigToDb(value || {});
      memorySettingsCache[key] = config;
      const masked = maskIntegrationConfigForClient(config);
      return res.json({ success: true, message: 'Setting saved successfully', key, value: masked });
    } catch (err: any) {
      return res.status(err?.statusCode || 400).json({
        success: false,
        code: err?.code || 'INVALID_WEBHOOK_CONFIG',
        message: err?.message || 'خطا در اعتبارسنجی تنظیمات وب‌هوک',
      });
    }
  }

  if (key === REFERRAL_STORAGE_KEY) {
    try {
      const existing = await loadReferrals();
      const merged = mergeAndDeduplicateReferrals(existing, value, req.user);
      await persistReferrals(merged);
      memorySettingsCache[key] = merged;
      const visible = filterReferralsForUser(req.user, merged);
      return res.json({ success: true, message: 'Setting saved successfully', key, value: visible });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Error saving referrals' });
    }
  }

  try {
    await withDbRetry(() => db.insert(systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date() }
      }));
    memorySettingsCache[key] = value;
    broadcastDataMutation('settings', 'update', { key, value });
    if (key !== 'settings') {
      broadcastDataMutation(key, 'update', value);
    }
    res.json({ success: true, message: 'Setting saved successfully', key, value });
  } catch (err) {
    logger.error('Database write failed for setting; refusing silent RAM-only mutation', { key, error: (err as any)?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_WRITE_FAILED',
      message: 'خطا در ذخیره‌سازی اطلاعات در پایگاه داده اصلی PostgreSQL. لطفاً اتصال دیتابیس را بررسی کنید.',
      key,
    });
  }
});

settingsRouter.delete('/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  const isAdmin = checkIsAdminRequest(req);

  if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !isAdmin) {
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای حذف تنظیمات سیستمی' });
  }

  try {
    await withDbRetry(() => db.delete(systemSettings).where(eq(systemSettings.key, key)));
    delete memorySettingsCache[key];
    broadcastDataMutation('settings', 'delete', { key });
    broadcastDataMutation(key, 'delete', null);
    res.json({ success: true, message: 'Setting deleted successfully' });
  } catch (err: any) {
    logger.error('Failed to delete setting from PostgreSQL', { key, error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_DELETE_FAILED',
      message: 'خطا در حذف رکورد از پایگاه داده اصلی PostgreSQL.',
    });
  }
});
