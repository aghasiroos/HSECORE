import { Router } from 'express';
import { db, withDbRetry } from '../../src/db/index.ts';
import { withTransaction } from '../core/db.ts';
import { systemSettings } from '../../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../core/logger.ts';
import { requireAuth, optionalAuth, isGlobalAdminUser } from '../core/middleware/auth.ts';
import {
  assertVersionMatch,
  extractExpectedUpdatedAt,
  extractExpectedVersion,
  sendConflictIfApplicable,
} from '../core/occ.ts';
import { auditService } from '../modules/audit/audit.service.ts';
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
  maskIntegrationConfigForClient,
  saveIntegrationConfigToDb,
  syncIntegrationConfigCache,
} from '../services/webhookDispatcher.ts';
import { invalidateDashboardCache } from './dashboard.router.ts';
import { personnelAccessService } from '../core/personnelAccess.service.ts';

export const settingsRouter = Router();

// Warmup/webhook mirror (read endpoints always query PostgreSQL as single source of truth)
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

export async function preloadSettingsCache(): Promise<void> {
  try {
    const records = await withDbRetry(() => db.select().from(systemSettings));
    for (const r of records) {
      memorySettingsCache[r.key] = r.value;
      if (r.key === INTEGRATION_CONFIG_KEY) {
        syncIntegrationConfigCache(r.value);
      }
    }
    logger.info(`[Settings] Preloaded ${records.length} system settings and warmed database pool`);
  } catch (err: any) {
    logger.warn('[Settings] Settings cache warmup note', { error: err?.message });
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
  'hse_unit_structure_v1',
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
  'security_policy',
  'hse_backup_schedule_config',
];

export const PUBLIC_UNAUTHENTICATED_SETTING_KEYS = [
  'system_branding',
  'hse_ui_config_v2',
  'hse_global_sound_preferences_v1',
];

export const PERSONNEL_SCOPED_SETTING_KEYS = [
  'hse_clinic_visits_v1',
  'hse_nutrition_records_v1',
  'hse_ppe_issuances_v1',
  'hse_training_records_v1',
  'OCC_HEALTH_EXAMS_DATA_V2',
  'hse_medical_exams_v4',
  'hse_medical_records_v4',
  'hse_periodic_dossier_attachments_v1',
];

export function checkIsAdminRequest(req: any): boolean {
  const user = req?.user;
  const role = String(user?.role || '').toUpperCase();
  return isGlobalAdminUser(user) || ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN'].includes(role);
}

// Get all settings directly from PostgreSQL (Single Source of Truth)
// Unauthenticated requests only receive public branding/UI keys; authenticated users receive RBAC & personnel-scoped data.
settingsRouter.get('/', optionalAuth, async (req, res) => {
  const isAuthenticated = Boolean(req.user && req.user.uid);
  const isAdmin = checkIsAdminRequest(req);
  try {
    const records = await withDbRetry(() => db.select().from(systemSettings));
    const accessCtx = isAuthenticated
      ? await personnelAccessService.resolveAccessContext(req.user)
      : null;

    const settingsMap: Record<string, any> = {};
    const versions: Record<string, number> = {};
    for (const r of records) {
      if (!isAuthenticated) {
        if (!PUBLIC_UNAUTHENTICATED_SETTING_KEYS.includes(r.key)) continue;
      } else if (!isAdmin && SENSITIVE_ADMIN_READ_KEYS.includes(r.key)) {
        continue;
      }

      let val =
        r.key === INTEGRATION_CONFIG_KEY ? maskIntegrationConfigForClient(r.value) : r.value;

      if (
        isAuthenticated &&
        accessCtx &&
        !accessCtx.canAccessAll &&
        PERSONNEL_SCOPED_SETTING_KEYS.includes(r.key) &&
        Array.isArray(val)
      ) {
        val = personnelAccessService.filterModuleRecords(accessCtx, val);
      }

      settingsMap[r.key] = val;
      versions[r.key] = Number((r as any).version ?? 1);
      syncSettingsMemoryCache(r.key, r.value);
    }
    if (isAuthenticated && settingsMap[REFERRAL_STORAGE_KEY] !== undefined) {
      const rawRefs = Array.isArray(settingsMap[REFERRAL_STORAGE_KEY])
        ? settingsMap[REFERRAL_STORAGE_KEY]
        : [];
      settingsMap[REFERRAL_STORAGE_KEY] = filterReferralsForUser(req.user, rawRefs);
    }
    res.json({ success: true, data: settingsMap, versions });
  } catch (err: any) {
    logger.error('Failed to query PostgreSQL for all settings', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_READ_FAILED',
      message: 'خطا در بازیابی تنظیمات از پایگاه داده PostgreSQL.',
    });
  }
});

// Get single setting directly from PostgreSQL with version metadata
settingsRouter.get('/:key', optionalAuth, async (req, res) => {
  const { key } = req.params;
  const isAuthenticated = Boolean(req.user && req.user.uid);

  if (!isAuthenticated && !PUBLIC_UNAUTHENTICATED_SETTING_KEYS.includes(key)) {
    return res.status(401).json({
      success: false,
      message: 'برای مشاهده این اطلاعات لطفاً ابتدا وارد سامانه شوید.',
    });
  }
  if (SENSITIVE_ADMIN_READ_KEYS.includes(key) && !checkIsAdminRequest(req)) {
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای مشاهده تنظیمات امنیتی سامانه' });
  }
  if (key === REFERRAL_STORAGE_KEY) {
    try {
      const all = await loadReferrals();
      const visible = filterReferralsForUser(req.user, all);
      return res.json({ success: true, data: visible, value: visible });
    } catch (err: any) {
      logger.error('Failed to load referrals setting from PostgreSQL', { error: err?.message });
      return res.status(503).json({ success: false, code: 'DATABASE_READ_FAILED', message: 'خطا در بازیابی ارجاعات از پایگاه داده.' });
    }
  }

  try {
    const records = await withDbRetry(() => db.select().from(systemSettings).where(eq(systemSettings.key, key)));
    if (records.length > 0) {
      const rec = records[0] as any;
      syncSettingsMemoryCache(key, rec.value);
      let outVal =
        key === INTEGRATION_CONFIG_KEY ? maskIntegrationConfigForClient(rec.value) : rec.value;

      if (
        isAuthenticated &&
        PERSONNEL_SCOPED_SETTING_KEYS.includes(key) &&
        Array.isArray(outVal)
      ) {
        const accessCtx = await personnelAccessService.resolveAccessContext(req.user);
        if (!accessCtx.canAccessAll) {
          outVal = personnelAccessService.filterModuleRecords(accessCtx, outVal);
        }
      }

      return res.json({
        success: true,
        data: outVal,
        value: outVal,
        version: Number(rec.version ?? 1),
        updatedAt: rec.updatedAt ?? null,
        updatedBy: rec.updatedBy ?? null,
      });
    }
    res.json({ success: true, data: null, value: null, version: 0, updatedAt: null });
  } catch (err: any) {
    logger.error('Failed to query PostgreSQL for setting', { key, error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_READ_FAILED',
      message: 'خطا در ارتباط با پایگاه داده PostgreSQL هنگام دریافت تنظیمات.',
      key,
    });
  }
});

// Save setting transactionally with OCC (Optimistic Concurrency Control)
settingsRouter.post('/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  const rawBody = req.body;
  const value = (rawBody && typeof rawBody === 'object' && 'value' in rawBody) ? rawBody.value : rawBody;
  const description = (rawBody && typeof rawBody === 'object' && typeof rawBody.description === 'string') ? rawBody.description : undefined;
  const expectedVersion = extractExpectedVersion(rawBody);
  const expectedUpdatedAt = extractExpectedUpdatedAt(rawBody);
  const isAdmin = checkIsAdminRequest(req);
  const actor = (req.user as any)?.fullName || req.user?.name || req.user?.username || req.user?.uid || 'system';

  if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !isAdmin) {
    void auditService.logAccessDenied(req, `تلاش غیرمجاز برای تغییر تنظیمات سیستمی (${key})`, 'settings:admin');
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای تغییر تنظیمات سیستمی' });
  }

  const prevValue = memorySettingsCache[key];

  if (key === INTEGRATION_CONFIG_KEY) {
    try {
      const { config } = await saveIntegrationConfigToDb(value || {});
      syncSettingsMemoryCache(key, config);
      const masked = maskIntegrationConfigForClient(config);
      void auditService.logFromRequest(req, {
        action: 'SETTINGS_CHANGE',
        module: 'SETTINGS',
        entityType: 'SYSTEM_SETTING',
        entityId: key,
        oldValue: prevValue ? maskIntegrationConfigForClient(prevValue) : null,
        newValue: masked,
        details: {
          actionType: 'SETTINGS_CHANGE',
          actionTitle: `تغییر پیکربندی یکپارچه‌سازی و وب‌هوک‌ها (${key})`,
        },
      });
      broadcastDataMutation('settings', 'update', { key, value: masked }, { module: key, actorId: req.user?.uid });
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
      syncSettingsMemoryCache(key, merged);
      const visible = filterReferralsForUser(req.user, merged);
      void auditService.logFromRequest(req, {
        action: 'UPDATE',
        module: 'REFERRALS',
        entityType: 'REFERRAL',
        entityId: key,
        details: {
          actionType: 'UPDATE',
          actionTitle: 'بروزرسانی کارتابل ارجاعات و مکاتبات',
          count: Array.isArray(merged) ? merged.length : 0,
        },
      });
      // Broadcast minimal metadata signal only — never push other users' private referrals over shared channels
      broadcastDataMutation(
        'settings',
        'update',
        { key, scopedRefresh: true, count: Array.isArray(merged) ? merged.length : 0 },
        { module: REFERRAL_STORAGE_KEY, recordId: key, actorId: req.user?.uid }
      );
      return res.json({ success: true, message: 'Setting saved successfully', key, value: visible });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Error saving referrals' });
    }
  }

  try {
    const txRes = await withTransaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setting:' + key}))`);
      const locked = await tx.execute(
        sql`SELECT key, value, version, updated_at, updated_by, description FROM system_settings WHERE key = ${key} FOR UPDATE`
      );
      const existing = (locked as any)?.rows?.[0] || null;
      if (existing) {
        assertVersionMatch(
          {
            ...existing,
            version: Number(existing.version ?? 1),
            updatedAt: existing.updated_at,
          },
          expectedVersion,
          expectedUpdatedAt
        );
      }

      const nextVersion = existing ? Number(existing.version ?? 1) + 1 : 1;
      const savedRes = await tx.execute(sql`
        INSERT INTO system_settings (key, value, description, version, updated_by, updated_at)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${description ?? existing?.description ?? null}, ${nextVersion}, ${actor}, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = ${JSON.stringify(value)}::jsonb,
          description = COALESCE(${description ?? null}, system_settings.description),
          version = ${nextVersion},
          updated_by = ${actor},
          updated_at = NOW()
        RETURNING key, value, version, updated_at, updated_by
      `);
      const savedRow = (savedRes as any)?.rows?.[0];
      return {
        existing,
        savedRow,
        nextVersion,
      };
    });

    syncSettingsMemoryCache(key, value);

    const isUnchanged =
      txRes.existing !== null &&
      JSON.stringify(txRes.existing.value) === JSON.stringify(value);

    if (!isUnchanged) {
      invalidateDashboardCache();
      const isScopedCollection = PERSONNEL_SCOPED_SETTING_KEYS.includes(key);
      const broadcastSettingsPayload = isScopedCollection
        ? {
            key,
            scopedRefresh: true,
            count: Array.isArray(value) ? value.length : undefined,
            version: txRes.nextVersion,
            updatedAt: txRes.savedRow?.updated_at,
          }
        : { key, value, version: txRes.nextVersion, updatedAt: txRes.savedRow?.updated_at };

      broadcastDataMutation('settings', 'update', broadcastSettingsPayload, {
        module: 'SETTINGS',
        recordId: key,
        actorId: req.user?.uid,
        version: txRes.nextVersion,
      });
      if (key !== 'settings') {
        broadcastDataMutation(
          key,
          'update',
          isScopedCollection ? { scopedRefresh: true, version: txRes.nextVersion } : value,
          {
            module: key,
            recordId: key,
            actorId: req.user?.uid,
            version: txRes.nextVersion,
          }
        );
      }

      if (key !== 'hse_heat_log') {
        const isSysConfig = ADMIN_ONLY_SETTING_KEYS.includes(key) || key === 'settings';
        void auditService.logFromRequest(req, {
          action: isSysConfig ? 'SETTINGS_CHANGE' : 'UPDATE',
          module: 'SETTINGS',
          entityType: 'SYSTEM_SETTING',
          entityId: key,
          oldValue: txRes.existing?.value ?? prevValue ?? null,
          newValue: value,
          details: {
            actionType: isSysConfig ? 'SETTINGS_CHANGE' : 'UPDATE',
            actionTitle: isSysConfig ? `تغییر تنظیمات سیستمی (${key})` : `بروزرسانی داده‌های کلید (${key})`,
            version: txRes.nextVersion,
          },
        });
      }
    }

    res.json({
      success: true,
      message: 'Setting saved successfully',
      key,
      value,
      version: txRes.nextVersion,
      updatedAt: txRes.savedRow?.updated_at || new Date().toISOString(),
    });
  } catch (err: any) {
    if (sendConflictIfApplicable(res, err)) return;
    logger.error('Database write failed for setting; refusing silent RAM-only mutation', { key, error: err?.message });
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
    void auditService.logAccessDenied(req, `تلاش غیرمجاز برای حذف تنظیمات سیستمی (${key})`, 'settings:admin');
    return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای حذف تنظیمات سیستمی' });
  }

  try {
    const prevValue = memorySettingsCache[key];
    await withDbRetry(() => db.delete(systemSettings).where(eq(systemSettings.key, key)));
    syncSettingsMemoryCache(key, null);
    invalidateDashboardCache();
    broadcastDataMutation('settings', 'delete', { key }, { module: 'SETTINGS', recordId: key, actorId: req.user?.uid });
    broadcastDataMutation(key, 'delete', null, { module: key, recordId: key, actorId: req.user?.uid });
    void auditService.logFromRequest(req, {
      action: 'DELETE',
      module: 'SETTINGS',
      entityType: 'SYSTEM_SETTING',
      entityId: key,
      oldValue: prevValue ?? null,
      newValue: null,
      details: {
        actionType: 'DELETE',
        actionTitle: `حذف تنظیمات کلید (${key})`,
      },
    });
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
