import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { withTransaction } from '../core/db.ts';
import { requireAuth } from '../core/middleware/auth.ts';
import { NotFoundError, ValidationError } from '../core/errors.ts';
import {
  assertVersionMatch,
  extractExpectedUpdatedAt,
  extractExpectedVersion,
  sendConflictIfApplicable,
} from '../core/occ.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { auditService } from '../modules/audit/audit.service.ts';
import {
  ADMIN_ONLY_SETTING_KEYS,
  SENSITIVE_ADMIN_READ_KEYS,
  checkIsAdminRequest,
  syncSettingsMemoryCache,
} from './settings.router.ts';
import { invalidateDashboardCache } from './dashboard.router.ts';
import { personnelAccessService } from '../core/personnelAccess.service.ts';
import { logger } from '../core/logger.ts';

export const collectionRouter = Router();

collectionRouter.use(requireAuth);

const PERSONNEL_SCOPED_COLLECTIONS = new Set([
  'hse_clinic_visits_v1',
  'hse_nutrition_records_v1',
  'hse_ppe_issuances_v1',
  'hse_training_records_v1',
  'OCC_HEALTH_EXAMS_DATA_V2',
  'hse_medical_exams_v4',
  'hse_medical_records_v4',
]);

function getItemIdentifier(item: any): string {
  if (!item || typeof item !== 'object') return '';
  return String(
    item.id ??
      item.uid ??
      item.trackingCode ??
      item.code ??
      item.recordId ??
      item.inspectionId ??
      ''
  ).trim();
}

function normalizeCollectionArray(rawValue: any): any[] {
  if (Array.isArray(rawValue)) return rawValue;
  return [];
}

function ensureItemDefaults(item: any, existing?: any, actor?: string): any {
  const nowIso = new Date().toISOString();
  const id = getItemIdentifier(item) || getItemIdentifier(existing) || `item-${crypto.randomUUID()}`;
  const prevVersion = existing ? Number(existing._version ?? existing.version ?? 1) : 0;
  const nextVersion = existing ? prevVersion + 1 : Number(item._version ?? item.version ?? 1);
  return {
    ...(existing && typeof existing === 'object' ? existing : {}),
    ...item,
    id,
    _version: nextVersion,
    version: nextVersion,
    updatedAt: nowIso,
    updatedBy: actor || existing?.updatedBy || item?.updatedBy || 'system',
    createdAt: existing?.createdAt || item?.createdAt || nowIso,
  };
}

// GET /api/v1/collection/:collectionKey
collectionRouter.get('/:collectionKey', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.collectionKey || '').trim();
    if (!key) return res.status(400).json({ success: false, error: 'کلید مجموعه الزامی است.' });
    if (SENSITIVE_ADMIN_READ_KEYS.includes(key) && !checkIsAdminRequest(req)) {
      return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز برای مشاهده این مجموعه.' });
    }

    const rowResult = await withTransaction(async (tx) => {
      const r = await tx.execute(
        sql`SELECT key, value, version, updated_at, updated_by FROM system_settings WHERE key = ${key} LIMIT 1`
      );
      return (r as any)?.rows?.[0] || null;
    });

    let items = normalizeCollectionArray(rowResult?.value);
    if (PERSONNEL_SCOPED_COLLECTIONS.has(key)) {
      const ctx = await personnelAccessService.resolveAccessContext(req.user);
      if (!ctx.canAccessAll) {
        items = personnelAccessService.filterModuleRecords(ctx, items);
      }
    }

    res.json({
      success: true,
      collectionKey: key,
      version: Number(rowResult?.version ?? 0),
      updatedAt: rowResult?.updated_at ?? null,
      items,
      count: items.length,
    });
  } catch (err: any) {
    logger.error('Collection GET failed', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_READ_FAILED',
      error: 'خطا در خواندن اطلاعات مجموعه از پایگاه داده.',
    });
  }
});

// POST /api/v1/collection/:collectionKey/item - Atomic locked insert or upsert of one item
collectionRouter.post('/:collectionKey/item', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.collectionKey || '').trim();
    if (!key) throw new ValidationError('کلید مجموعه الزامی است.');
    if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !checkIsAdminRequest(req)) {
      return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز برای تغییر تنظیمات سیستمی.' });
    }

    const rawItem = req.body && typeof req.body === 'object' && 'item' in req.body ? req.body.item : req.body;
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new ValidationError('ساختار رکورد ارسالی معتبر نیست.');
    }

    if (PERSONNEL_SCOPED_COLLECTIONS.has(key)) {
      const ctx = await personnelAccessService.resolveAccessContext(req.user);
      if (!ctx.canAccessAll && !personnelAccessService.doesModuleRecordMatchContext(ctx, rawItem)) {
        return res.status(403).json({
          success: false,
          error: 'شما مجوز ثبت رکورد برای این پرسنل را ندارید.',
        });
      }
    }

    const actor = req.user?.name || req.user?.username || req.user?.uid || 'system';
    const expectedItemVersion = extractExpectedVersion(req.body) ?? extractExpectedVersion(rawItem);
    const expectedItemUpdatedAt = extractExpectedUpdatedAt(req.body) ?? extractExpectedUpdatedAt(rawItem);

    const txRes = await withTransaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setting:' + key}))`);
      const locked = await tx.execute(
        sql`SELECT key, value, version, updated_at, updated_by FROM system_settings WHERE key = ${key} FOR UPDATE`
      );
      const row = (locked as any)?.rows?.[0] || null;
      const currentItems = normalizeCollectionArray(row?.value);
      const incomingId = getItemIdentifier(rawItem);
      const existingIdx = incomingId
        ? currentItems.findIndex((it) => getItemIdentifier(it) === incomingId)
        : -1;

      let savedItem: any;
      let nextItems: any[];
      let op: 'create' | 'update' = 'create';

      if (existingIdx >= 0) {
        const existingItem = currentItems[existingIdx];
        assertVersionMatch(existingItem, expectedItemVersion, expectedItemUpdatedAt);
        savedItem = ensureItemDefaults(rawItem, existingItem, actor);
        nextItems = [...currentItems];
        nextItems[existingIdx] = savedItem;
        op = 'update';
      } else {
        savedItem = ensureItemDefaults(rawItem, undefined, actor);
        // Prepend if array ordering prefers newest first or keep consistent? Append at start unless append flag set
        nextItems = req.body?.position === 'end' ? [...currentItems, savedItem] : [savedItem, ...currentItems];
        op = 'create';
      }

      const nextCollectionVersion = row ? Number(row.version ?? 1) + 1 : 1;
      await tx.execute(sql`
        INSERT INTO system_settings (key, value, version, updated_by, updated_at)
        VALUES (${key}, ${JSON.stringify(nextItems)}::jsonb, ${nextCollectionVersion}, ${actor}, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = ${JSON.stringify(nextItems)}::jsonb,
          version = ${nextCollectionVersion},
          updated_by = ${actor},
          updated_at = NOW()
      `);

      return { savedItem, nextItems, nextCollectionVersion, op };
    });

    syncSettingsMemoryCache(key, txRes.nextItems);
    invalidateDashboardCache();
    broadcastDataMutation(key, txRes.op, txRes.savedItem, {
      module: key,
      recordId: txRes.savedItem.id,
      actorId: req.user?.uid,
      version: txRes.savedItem._version,
    });
    broadcastDataMutation('settings', 'update', {
      key,
      value: txRes.nextItems,
      version: txRes.nextCollectionVersion,
    });

    void auditService.logFromRequest(req, {
      action: txRes.op === 'create' ? 'CREATE' : 'UPDATE',
      module: 'COLLECTION',
      entityType: key,
      entityId: String(txRes.savedItem.id),
      newValue: txRes.savedItem,
      details: { actionTitle: `ثبت/بروزرسانی اتمی آیتم در مجموعه (${key})` },
    });

    res.json({
      success: true,
      collectionKey: key,
      item: txRes.savedItem,
      version: txRes.nextCollectionVersion,
    });
  } catch (err: any) {
    if (sendConflictIfApplicable(res, err)) return;
    if (err?.statusCode === 400 || err?.statusCode === 403 || err?.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    logger.error('Collection POST item failed', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_WRITE_FAILED',
      error: 'خطا در ثبت رکورد در پایگاه داده.',
    });
  }
});

// PUT /api/v1/collection/:collectionKey/item/:itemId - Atomic locked update of one item with OCC
collectionRouter.put('/:collectionKey/item/:itemId', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.collectionKey || '').trim();
    const itemId = String(req.params.itemId || '').trim();
    if (!key || !itemId) throw new ValidationError('شناسه مجموعه و رکورد الزامی است.');
    if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !checkIsAdminRequest(req)) {
      return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز برای تغییر تنظیمات سیستمی.' });
    }

    const rawItem = req.body && typeof req.body === 'object' && 'item' in req.body ? req.body.item : req.body;
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new ValidationError('ساختار بروزرسانی رکورد معتبر نیست.');
    }

    const actor = req.user?.name || req.user?.username || req.user?.uid || 'system';
    const expectedVersion = extractExpectedVersion(req.body) ?? extractExpectedVersion(rawItem);
    const expectedUpdatedAt = extractExpectedUpdatedAt(req.body) ?? extractExpectedUpdatedAt(rawItem);

    const txRes = await withTransaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setting:' + key}))`);
      const locked = await tx.execute(
        sql`SELECT key, value, version FROM system_settings WHERE key = ${key} FOR UPDATE`
      );
      const row = (locked as any)?.rows?.[0] || null;
      const currentItems = normalizeCollectionArray(row?.value);
      const idx = currentItems.findIndex((it) => getItemIdentifier(it) === itemId);
      if (idx < 0) {
        throw new NotFoundError('رکورد مورد نظر در مجموعه');
      }

      const existingItem = currentItems[idx];
      if (PERSONNEL_SCOPED_COLLECTIONS.has(key)) {
        const ctx = await personnelAccessService.resolveAccessContext(req.user);
        if (!ctx.canAccessAll && !personnelAccessService.doesModuleRecordMatchContext(ctx, existingItem)) {
          const err: any = new Error('شما مجوز ویرایش این رکورد را ندارید.');
          err.statusCode = 403;
          throw err;
        }
      }

      assertVersionMatch(existingItem, expectedVersion, expectedUpdatedAt);
      const savedItem = ensureItemDefaults({ ...rawItem, id: itemId }, existingItem, actor);
      const nextItems = [...currentItems];
      nextItems[idx] = savedItem;
      const nextCollectionVersion = Number(row?.version ?? 1) + 1;

      await tx.execute(sql`
        UPDATE system_settings
        SET value = ${JSON.stringify(nextItems)}::jsonb,
            version = ${nextCollectionVersion},
            updated_by = ${actor},
            updated_at = NOW()
        WHERE key = ${key}
      `);

      return { existingItem, savedItem, nextItems, nextCollectionVersion };
    });

    syncSettingsMemoryCache(key, txRes.nextItems);
    invalidateDashboardCache();
    broadcastDataMutation(key, 'update', txRes.savedItem, {
      module: key,
      recordId: itemId,
      actorId: req.user?.uid,
      version: txRes.savedItem._version,
    });
    broadcastDataMutation('settings', 'update', {
      key,
      value: txRes.nextItems,
      version: txRes.nextCollectionVersion,
    });

    void auditService.logFromRequest(req, {
      action: 'UPDATE',
      module: 'COLLECTION',
      entityType: key,
      entityId: itemId,
      oldValue: txRes.existingItem,
      newValue: txRes.savedItem,
      details: { actionTitle: `ویرایش اتمی آیتم در مجموعه (${key})` },
    });

    res.json({
      success: true,
      collectionKey: key,
      item: txRes.savedItem,
      version: txRes.nextCollectionVersion,
    });
  } catch (err: any) {
    if (sendConflictIfApplicable(res, err)) return;
    if (err?.statusCode === 400 || err?.statusCode === 403 || err?.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    logger.error('Collection PUT item failed', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_WRITE_FAILED',
      error: 'خطا در بروزرسانی رکورد در پایگاه داده.',
    });
  }
});

// DELETE /api/v1/collection/:collectionKey/item/:itemId
collectionRouter.delete('/:collectionKey/item/:itemId', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.collectionKey || '').trim();
    const itemId = String(req.params.itemId || '').trim();
    if (!key || !itemId) throw new ValidationError('شناسه مجموعه و رکورد الزامی است.');
    if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !checkIsAdminRequest(req)) {
      return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز برای حذف از تنظیمات سیستمی.' });
    }

    const actor = req.user?.name || req.user?.username || req.user?.uid || 'system';
    const expectedVersion = req.query.expectedVersion ? Number(req.query.expectedVersion) : undefined;

    const txRes = await withTransaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setting:' + key}))`);
      const locked = await tx.execute(
        sql`SELECT key, value, version FROM system_settings WHERE key = ${key} FOR UPDATE`
      );
      const row = (locked as any)?.rows?.[0] || null;
      const currentItems = normalizeCollectionArray(row?.value);
      const idx = currentItems.findIndex((it) => getItemIdentifier(it) === itemId);
      if (idx < 0) {
        throw new NotFoundError('رکورد مورد نظر در مجموعه');
      }
      const existingItem = currentItems[idx];
      if (expectedVersion !== undefined) {
        assertVersionMatch(existingItem, expectedVersion);
      }

      const nextItems = currentItems.filter((_, i) => i !== idx);
      const nextCollectionVersion = Number(row?.version ?? 1) + 1;

      await tx.execute(sql`
        UPDATE system_settings
        SET value = ${JSON.stringify(nextItems)}::jsonb,
            version = ${nextCollectionVersion},
            updated_by = ${actor},
            updated_at = NOW()
        WHERE key = ${key}
      `);

      return { existingItem, nextItems, nextCollectionVersion };
    });

    syncSettingsMemoryCache(key, txRes.nextItems);
    invalidateDashboardCache();
    broadcastDataMutation(key, 'delete', { id: itemId }, {
      module: key,
      recordId: itemId,
      actorId: req.user?.uid,
      version: txRes.nextCollectionVersion,
    });
    broadcastDataMutation('settings', 'update', {
      key,
      value: txRes.nextItems,
      version: txRes.nextCollectionVersion,
    });

    void auditService.logFromRequest(req, {
      action: 'DELETE',
      module: 'COLLECTION',
      entityType: key,
      entityId: itemId,
      oldValue: txRes.existingItem,
      details: { actionTitle: `حذف اتمی آیتم از مجموعه (${key})` },
    });

    res.json({
      success: true,
      collectionKey: key,
      deletedId: itemId,
      version: txRes.nextCollectionVersion,
    });
  } catch (err: any) {
    if (sendConflictIfApplicable(res, err)) return;
    if (err?.statusCode === 400 || err?.statusCode === 403 || err?.statusCode === 404) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    logger.error('Collection DELETE item failed', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_DELETE_FAILED',
      error: 'خطا در حذف رکورد از پایگاه داده.',
    });
  }
});

// POST /api/v1/collection/:collectionKey/batch - Atomic locked batch merge/upsert
collectionRouter.post('/:collectionKey/batch', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.collectionKey || '').trim();
    if (!key) throw new ValidationError('کلید مجموعه الزامی است.');
    if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !checkIsAdminRequest(req)) {
      return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز برای تغییر تنظیمات سیستمی.' });
    }

    const incomingItems = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(incomingItems)) {
      throw new ValidationError('آرایه items الزامی است.');
    }

    const mode: 'merge' | 'replace' = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const expectedCollectionVersion = extractExpectedVersion(req.body);
    const actor = req.user?.name || req.user?.username || req.user?.uid || 'system';

    const txRes = await withTransaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'setting:' + key}))`);
      const locked = await tx.execute(
        sql`SELECT key, value, version, updated_at, updated_by FROM system_settings WHERE key = ${key} FOR UPDATE`
      );
      const row = (locked as any)?.rows?.[0] || null;
      if (row && expectedCollectionVersion !== undefined) {
        assertVersionMatch(row, expectedCollectionVersion);
      }

      const currentItems = normalizeCollectionArray(row?.value);
      let nextItems: any[];

      if (mode === 'replace') {
        nextItems = incomingItems.map((it) => ensureItemDefaults(it, undefined, actor));
      } else {
        const byId = new Map<string, any>();
        for (const existing of currentItems) {
          const eid = getItemIdentifier(existing);
          if (eid) byId.set(eid, existing);
        }
        for (const item of incomingItems) {
          const iid = getItemIdentifier(item);
          const prev = iid ? byId.get(iid) : undefined;
          const merged = ensureItemDefaults(item, prev, actor);
          byId.set(merged.id, merged);
        }
        nextItems = Array.from(byId.values());
      }

      const nextCollectionVersion = row ? Number(row.version ?? 1) + 1 : 1;
      await tx.execute(sql`
        INSERT INTO system_settings (key, value, version, updated_by, updated_at)
        VALUES (${key}, ${JSON.stringify(nextItems)}::jsonb, ${nextCollectionVersion}, ${actor}, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = ${JSON.stringify(nextItems)}::jsonb,
          version = ${nextCollectionVersion},
          updated_by = ${actor},
          updated_at = NOW()
      `);

      return { nextItems, nextCollectionVersion };
    });

    syncSettingsMemoryCache(key, txRes.nextItems);
    invalidateDashboardCache();
    broadcastDataMutation(key, 'batch', { count: txRes.nextItems.length }, {
      module: key,
      actorId: req.user?.uid,
      version: txRes.nextCollectionVersion,
    });
    broadcastDataMutation('settings', 'update', {
      key,
      value: txRes.nextItems,
      version: txRes.nextCollectionVersion,
    });

    res.json({
      success: true,
      collectionKey: key,
      count: txRes.nextItems.length,
      version: txRes.nextCollectionVersion,
      items: txRes.nextItems,
    });
  } catch (err: any) {
    if (sendConflictIfApplicable(res, err)) return;
    if (err?.statusCode === 400 || err?.statusCode === 403) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    logger.error('Collection batch POST failed', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_WRITE_FAILED',
      error: 'خطا در ذخیره‌سازی گروهی مجموعه در پایگاه داده.',
    });
  }
});
