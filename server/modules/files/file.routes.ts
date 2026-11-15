import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { fileController } from './file.controller.ts';
import {
  requireAuth,
  requireRole,
  requirePermission,
  checkUserHasPermission,
} from '../../core/middleware/auth.ts';
import { ValidationError, ForbiddenError, UnauthorizedError } from '../../core/errors.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB strict upload limit
});

function parseSingleFileUpload(req: Request, res: Response, next: NextFunction) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return next();
  }
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('حجم فایل ارسالی بیش از حد مجاز (۲۵ مگابایت) است.'));
      }
      if (req.body && req.body.fileData) {
        return next();
      }
      return next(new ValidationError(`خطا در دریافت فایل ارسالی: ${err.message || 'فرمت ارسال نامعتبر است.'}`));
    }
    return next();
  });
}

// ============================================================================
// 1. HSE Instructions & Documents Routes (/api/v1/files/documents/*)
// ============================================================================
router.get('/documents', requireAuth, requirePermission('documents:read'), (req, res, next) => {
  fileController.listDocuments(req, res).catch(next);
});

router.post(
  '/documents',
  requireAuth,
  requirePermission('documents:create'),
  parseSingleFileUpload,
  (req, res, next) => {
    fileController.createDocument(req, res).catch(next);
  }
);

router.put(
  '/documents/:documentId',
  requireAuth,
  requirePermission('documents:update'),
  (req, res, next) => {
    fileController.updateDocumentMetadata(req, res).catch(next);
  }
);

router.post(
  '/documents/:documentId/replace',
  requireAuth,
  requirePermission('documents:update'),
  parseSingleFileUpload,
  (req, res, next) => {
    fileController.replaceDocumentFile(req, res).catch(next);
  }
);

function requireDocumentAttachmentWrite(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new UnauthorizedError('احراز هویت الزامی است.'));
  }
  const allowed =
    checkUserHasPermission(req.user, 'documents:create') ||
    checkUserHasPermission(req.user, 'documents:update') ||
    checkUserHasPermission(req.user, 'documents:*') ||
    checkUserHasPermission(req.user, '*');
  if (!allowed) {
    return next(new ForbiddenError('شما مجوز بارگذاری پیوست برای مستندات را ندارید.'));
  }
  return next();
}

router.post(
  '/documents/:documentId/attachments',
  requireAuth,
  requireDocumentAttachmentWrite,
  parseSingleFileUpload,
  (req, res, next) => {
    fileController.addDocumentAttachment(req, res).catch(next);
  }
);

router.delete(
  '/documents/:documentId/attachments/:fileId',
  requireAuth,
  requirePermission('documents:delete'),
  (req, res, next) => {
    fileController.deleteDocumentAttachment(req, res).catch(next);
  }
);

router.delete(
  '/documents/:documentId',
  requireAuth,
  requirePermission('documents:delete'),
  (req, res, next) => {
    fileController.deleteDocument(req, res).catch(next);
  }
);

// ============================================================================
// 2. General System File Operations
// ============================================================================
router.post('/upload', requireAuth, parseSingleFileUpload, (req, res, next) => {
  fileController.uploadFile(req, res).catch(next);
});

router.get('/:id/download', requireAuth, (req, res, next) => {
  fileController.downloadFile(req, res).catch(next);
});

router.get('/:id/preview', requireAuth, (req, res, next) => {
  fileController.previewFile(req, res).catch(next);
});

router.get('/:id/render-page', requireAuth, (req, res, next) => {
  fileController.renderPdfPage(req, res).catch(next);
});

router.get('/entity/:entityType/:entityId', requireAuth, (req, res, next) => {
  fileController.getFilesForEntity(req, res).catch(next);
});

router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'),
  (req, res, next) => {
    fileController.deleteFile(req, res).catch(next);
  }
);

export default router;
