import { Router, Request } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole } from '../core/middleware/auth.ts';
import {
  getBackupSystemOverview,
  createFullBackup,
  generateSqlDumpString,
  verifyBackup,
  testRestoreBackup,
  executeRealRestore,
  deleteServerBackup,
  saveBackupScheduleConfig,
  loadBackupArchive,
  getBackupDirectory,
  BackupTag,
} from '../services/backup.service.ts';
import { logger } from '../core/logger.ts';

export const backupRouter = Router();

// Strictly protect all Backup & Restore routes with authentication and Admin/HSE Manager RBAC
backupRouter.use(requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'SUPER_ADMIN', 'HSE_MANAGER'));

function extractOperator(req: Request) {
  return {
    username: req.user?.username || 'admin',
    fullName: req.user?.name || req.user?.username || 'مدیر سیستم',
    role: req.user?.role || 'ADMIN',
  };
}

function resolveUploadedBufferOrObject(body: any): Buffer | Record<string, any> {
  if (body?.fileBase64 && typeof body.fileBase64 === 'string') {
    const cleanBase64 = body.fileBase64.includes(',')
      ? body.fileBase64.split(',')[1]
      : body.fileBase64;
    return Buffer.from(cleanBase64, 'base64');
  }
  if (body?.rawText && typeof body.rawText === 'string') {
    return Buffer.from(body.rawText, 'utf8');
  }
  if (body?.jsonObject && typeof body.jsonObject === 'object') {
    return body.jsonObject;
  }
  throw new Error('محتوای فایل پشتیبان ارسال نشده یا نامعتبر است.');
}

/**
 * GET /api/v1/backup/overview
 * Live database table counts (all 50 tables), physical files in uploads/, storage space,
 * server backups list, last verification report, and last isolated test restore report.
 */
backupRouter.get('/overview', async (_req, res) => {
  try {
    const overview = await getBackupSystemOverview();
    res.json({ success: true, data: overview });
  } catch (err: any) {
    logger.error('[BackupRouter] Overview error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در دریافت وضعیت سامانه پشتیبان‌گیری',
    });
  }
});

/**
 * POST /api/v1/backup/create
 * Creates a full (or selective) server backup archive (.hsebackup.json.gz) + immediate SHA-256 verification
 */
backupRouter.post('/create', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const {
      tag = 'manual',
      isSelective = false,
      selectedModules,
      encrypt = false,
    } = req.body || {};

    const allowedTags: BackupTag[] = ['manual', 'scheduled', 'pre_restore_safety', 'pre_update'];
    const safeTag: BackupTag = allowedTags.includes(tag) ? tag : 'manual';

    const result = await createFullBackup({
      tag: safeTag,
      operator,
      isSelective: Boolean(isSelective),
      selectedModules,
      encrypt: Boolean(encrypt),
    });

    res.json({
      success: true,
      data: {
        manifest: result.manifest,
        verification: result.verification,
      },
    });
  } catch (err: any) {
    logger.error('[BackupRouter] Create backup error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در تهیه نسخه پشتیبان کامل سامانه',
    });
  }
});

/**
 * POST /api/v1/backup/export-sql
 * Generates a PostgreSQL-16 SQL dump with SHA-256 digest and sequence resets
 */
backupRouter.post('/export-sql', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const { isSelective = false, selectedModules } = req.body || {};
    const dump = await generateSqlDumpString({
      operator,
      isSelective: Boolean(isSelective),
      selectedModules,
    });
    res.json({
      success: true,
      data: dump,
    });
  } catch (err: any) {
    logger.error('[BackupRouter] Export SQL error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در تولید خروجی SQL پایگاه داده',
    });
  }
});

/**
 * GET /api/v1/backup/:backupId/download
 * Downloads a verified backup archive from server storage (.hsebackup.json.gz or decompressed .json)
 */
backupRouter.get('/:backupId/download', async (req, res) => {
  try {
    const rawId = String(req.params.backupId || '');
    const format = String(req.query.format || 'gz').toLowerCase();
    const cleanId = path
      .basename(rawId.trim())
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .replace(/\.(hsebackup\.json\.gz|meta\.json|sha256|json|sql)$/i, '');

    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'شناسه نسخه پشتیبان نامعتبر است.' });
    }

    if (format === 'json') {
      const loaded = loadBackupArchive(cleanId);
      if (!loaded.archiveExists || !loaded.archiveObj) {
        return res.status(404).json({ success: false, error: 'فایل پشتیبان یافت نشد.' });
      }
      const jsonStr = JSON.stringify(loaded.archiveObj, null, 2);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanId}.hsebackup.json"`);
      return res.send(jsonStr);
    }

    const archivePath = path.join(getBackupDirectory(), `${cleanId}.hsebackup.json.gz`);
    if (!fs.existsSync(archivePath)) {
      return res.status(404).json({ success: false, error: 'فایل آرشیو پشتیبان در سرور یافت نشد.' });
    }

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanId}.hsebackup.json.gz"`);
    const stream = fs.createReadStream(archivePath);
    stream.pipe(res);
  } catch (err: any) {
    logger.error('[BackupRouter] Download backup error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در دانلود فایل نسخه پشتیبان',
    });
  }
});

/**
 * POST /api/v1/backup/:backupId/verify
 * Performs full SHA-256 archive & payload verification + schema/file integrity check
 */
backupRouter.post('/:backupId/verify', async (req, res) => {
  try {
    const report = await verifyBackup(String(req.params.backupId || ''));
    res.json({ success: true, data: report });
  } catch (err: any) {
    logger.error('[BackupRouter] Verify backup error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در اعتبارسنجی نسخه پشتیبان',
    });
  }
});

/**
 * POST /api/v1/backup/:backupId/test-restore
 * Executes a real isolated PostgreSQL Temporary Sandbox Test Restore (with ROLLBACK)
 */
backupRouter.post('/:backupId/test-restore', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const report = await testRestoreBackup(String(req.params.backupId || ''), operator.username);
    res.json({ success: true, data: report });
  } catch (err: any) {
    logger.error('[BackupRouter] Test restore error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در اجرای بازیابی آزمایشی ایزوله',
    });
  }
});

/**
 * POST /api/v1/backup/:backupId/restore
 * Executes real atomic database & file restore (after pre-flight sandbox test & automatic safety backup)
 */
backupRouter.post('/:backupId/restore', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const mode = req.body?.mode === 'clean' ? 'clean' : 'merge';
    const confirmCode = String(req.body?.confirmCode || '').trim().toUpperCase();

    if (confirmCode !== 'RESTORE') {
      return res.status(400).json({
        success: false,
        error: 'کد تأیید امنیتی بازیابی (RESTORE) وارد نشده یا نامعتبر است.',
      });
    }

    const report = await executeRealRestore(String(req.params.backupId || ''), {
      mode,
      operator,
    });

    res.json({ success: true, data: report });
  } catch (err: any) {
    logger.error('[BackupRouter] Real restore error:', err);
    res.status(400).json({
      success: false,
      error: err?.message || 'خطا در اجرای بازیابی اطلاعات سامانه',
    });
  }
});

/**
 * POST /api/v1/backup/upload-inspect
 * Inspects, verifies SHA-256, and runs an isolated PostgreSQL Sandbox Test Restore on an uploaded file
 */
backupRouter.post('/upload-inspect', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const input = resolveUploadedBufferOrObject(req.body);
    const testReport = await testRestoreBackup(input, operator.username);

    res.json({
      success: true,
      data: {
        verification: testReport.verificationReport,
        testRestoreReport: testReport,
      },
    });
  } catch (err: any) {
    logger.error('[BackupRouter] Upload inspect error:', err);
    res.status(400).json({
      success: false,
      error: err?.message || 'فایل پشتیبان بارگذاری‌شده نامعتبر یا آسیب‌دیده است.',
    });
  }
});

/**
 * POST /api/v1/backup/upload-restore
 * Restores live database and files from an uploaded backup archive after sandbox verification & safety backup
 */
backupRouter.post('/upload-restore', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const mode = req.body?.mode === 'clean' ? 'clean' : 'merge';
    const confirmCode = String(req.body?.confirmCode || '').trim().toUpperCase();

    if (confirmCode !== 'RESTORE') {
      return res.status(400).json({
        success: false,
        error: 'کد تأیید امنیتی بازیابی (RESTORE) وارد نشده یا نامعتبر است.',
      });
    }

    const input = resolveUploadedBufferOrObject(req.body);
    const report = await executeRealRestore(input, {
      mode,
      operator,
    });

    res.json({ success: true, data: report });
  } catch (err: any) {
    logger.error('[BackupRouter] Upload restore error:', err);
    res.status(400).json({
      success: false,
      error: err?.message || 'خطا در بازیابی اطلاعات از فایل بارگذاری‌شده',
    });
  }
});

/**
 * DELETE /api/v1/backup/:backupId
 * Controlled deletion of a server backup archive
 */
backupRouter.delete('/:backupId', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const result = await deleteServerBackup(String(req.params.backupId || ''), operator.username);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[BackupRouter] Delete backup error:', err);
    res.status(400).json({
      success: false,
      error: err?.message || 'خطا در حذف نسخه پشتیبان',
    });
  }
});

/**
 * POST /api/v1/backup/schedule
 * Saves backup schedule & retention policy and enforces retention pruning
 */
backupRouter.post('/schedule', async (req: Request, res) => {
  try {
    const operator = extractOperator(req);
    const saved = await saveBackupScheduleConfig(req.body || {}, operator.username);
    res.json({ success: true, data: saved });
  } catch (err: any) {
    logger.error('[BackupRouter] Save schedule error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در ذخیره تنظیمات زمان‌بندی پشتیبان‌گیری',
    });
  }
});
