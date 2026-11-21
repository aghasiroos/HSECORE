import { Router, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db, withDbRetry } from '../../src/db/index.ts';
import { userPreferences } from '../../src/db/schema.ts';
import { requireAuth } from '../core/middleware/auth.ts';
import {
  assertVersionMatch,
  extractExpectedUpdatedAt,
  extractExpectedVersion,
  sendConflictIfApplicable,
} from '../core/occ.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { logger } from '../core/logger.ts';

export const userPreferencesRouter = Router();

userPreferencesRouter.use(requireAuth);

// GET /api/v1/user-preferences - Fetch all preferences for the signed-in user
userPreferencesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userUid = String(req.user!.uid);
    const rows = await withDbRetry(() =>
      db.select().from(userPreferences).where(eq(userPreferences.userUid, userUid))
    );
    const map: Record<string, any> = {};
    const versions: Record<string, number> = {};
    for (const row of rows) {
      map[row.prefKey] = row.value;
      versions[row.prefKey] = row.version ?? 1;
    }
    res.json({ success: true, data: map, versions, items: rows });
  } catch (err: any) {
    logger.error('Failed to load user preferences', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_READ_FAILED',
      error: 'خطا در بازیابی تنظیمات کاربری از پایگاه داده.',
    });
  }
});

// GET /api/v1/user-preferences/:prefKey
userPreferencesRouter.get('/:prefKey', async (req: Request, res: Response) => {
  try {
    const userUid = String(req.user!.uid);
    const prefKey = String(req.params.prefKey || '').trim();
    if (!prefKey) {
      return res.status(400).json({ success: false, error: 'کلید تنظیمات نامعتبر است.' });
    }
    const rows = await withDbRetry(() =>
      db
        .select()
        .from(userPreferences)
        .where(and(eq(userPreferences.userUid, userUid), eq(userPreferences.prefKey, prefKey)))
        .limit(1)
    );
    if (rows.length === 0) {
      return res.json({ success: true, prefKey, value: null, version: 0, updatedAt: null });
    }
    res.json({
      success: true,
      prefKey,
      value: rows[0].value,
      version: rows[0].version ?? 1,
      updatedAt: rows[0].updatedAt,
    });
  } catch (err: any) {
    logger.error('Failed to load user preference', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_READ_FAILED',
      error: 'خطا در بازیابی تنظیمات کاربر از پایگاه داده.',
    });
  }
});

// PUT /api/v1/user-preferences/:prefKey
userPreferencesRouter.put('/:prefKey', async (req: Request, res: Response) => {
  try {
    const userUid = String(req.user!.uid);
    const prefKey = String(req.params.prefKey || '').trim();
    if (!prefKey) {
      return res.status(400).json({ success: false, error: 'کلید تنظیمات نامعتبر است.' });
    }

    const body = req.body;
    const value = body && typeof body === 'object' && 'value' in body ? body.value : body;
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'مقدار تنظیمات الزامی است.' });
    }

    const expectedVersion = extractExpectedVersion(body);
    const expectedUpdatedAt = extractExpectedUpdatedAt(body);

    const existingRows = await withDbRetry(() =>
      db
        .select()
        .from(userPreferences)
        .where(and(eq(userPreferences.userUid, userUid), eq(userPreferences.prefKey, prefKey)))
        .limit(1)
    );
    const existing = existingRows[0];

    let saved: any;
    if (existing) {
      assertVersionMatch(existing, expectedVersion, expectedUpdatedAt);
      const nextVersion = (existing.version ?? 1) + 1;
      const [updated] = await withDbRetry(() =>
        db
          .update(userPreferences)
          .set({
            value,
            version: nextVersion,
            updatedAt: new Date(),
          })
          .where(and(eq(userPreferences.id, existing.id), eq(userPreferences.version, existing.version)))
          .returning()
      );
      if (!updated) {
        const latestRows = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.id, existing.id))
          .limit(1);
        assertVersionMatch(latestRows[0], existing.version);
      }
      saved = updated;
    } else {
      const [inserted] = await withDbRetry(() =>
        db
          .insert(userPreferences)
          .values({
            userUid,
            prefKey,
            value,
            version: 1,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [userPreferences.userUid, userPreferences.prefKey],
            set: {
              value,
              version: 1,
              updatedAt: new Date(),
            },
          })
          .returning()
      );
      saved = inserted;
    }

    broadcastDataMutation(
      'user_preferences',
      'update',
      { userUid, prefKey, value: saved.value, version: saved.version },
      { module: 'USER_PREFERENCES', recordId: prefKey, actorId: userUid, version: saved.version, targetUserUid: userUid }
    );

    res.json({
      success: true,
      prefKey,
      value: saved.value,
      version: saved.version,
      updatedAt: saved.updatedAt,
    });
  } catch (err: any) {
    if (sendConflictIfApplicable(res, err)) return;
    logger.error('Failed to save user preference', { error: err?.message });
    res.status(503).json({
      success: false,
      code: 'DATABASE_WRITE_FAILED',
      error: 'خطا در ذخیره‌سازی تنظیمات کاربر در پایگاه داده.',
    });
  }
});

// DELETE /api/v1/user-preferences/:prefKey
userPreferencesRouter.delete('/:prefKey', async (req: Request, res: Response) => {
  try {
    const userUid = String(req.user!.uid);
    const prefKey = String(req.params.prefKey || '').trim();
    await withDbRetry(() =>
      db
        .delete(userPreferences)
        .where(and(eq(userPreferences.userUid, userUid), eq(userPreferences.prefKey, prefKey)))
    );
    broadcastDataMutation(
      'user_preferences',
      'delete',
      { userUid, prefKey },
      { module: 'USER_PREFERENCES', recordId: prefKey, actorId: userUid, targetUserUid: userUid }
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(503).json({
      success: false,
      code: 'DATABASE_DELETE_FAILED',
      error: 'خطا در حذف تنظیمات کاربر از پایگاه داده.',
    });
  }
});
