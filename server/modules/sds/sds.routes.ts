import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { sdsController } from './sds.controller.ts';
import { requireAuth, requirePermission } from '../../core/middleware/auth.ts';
import { ValidationError } from '../../core/errors.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function parseAttachmentUpload(req: Request, res: Response, next: NextFunction) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return next();
  }
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new ValidationError('حجم فایل پیوست بیش از حد مجاز (۲۵ مگابایت) است.'));
      }
      if (req.body && req.body.fileData) {
        return next();
      }
      return next(new ValidationError(`خطا در دریافت فایل پیوست: ${err.message || 'فرمت نامعتبر'}`));
    }
    return next();
  });
}

router.get('/', requireAuth, requirePermission('documents:read'), (req, res, next) => {
  sdsController.list(req, res).catch(next);
});

router.get('/check-duplicate', requireAuth, requirePermission('documents:read'), (req, res, next) => {
  sdsController.checkDuplicate(req, res).catch(next);
});

router.get('/:id', requireAuth, requirePermission('documents:read'), (req, res, next) => {
  sdsController.getById(req, res).catch(next);
});

router.post('/', requireAuth, requirePermission('documents:create'), (req, res, next) => {
  sdsController.create(req, res).catch(next);
});

router.put('/:id', requireAuth, requirePermission('documents:update'), (req, res, next) => {
  sdsController.update(req, res).catch(next);
});

router.post('/:id/revisions', requireAuth, requirePermission('documents:update'), (req, res, next) => {
  sdsController.createRevision(req, res).catch(next);
});

router.post('/:id/status', requireAuth, requirePermission('documents:update'), (req, res, next) => {
  sdsController.changeStatus(req, res).catch(next);
});

router.post(
  '/:id/attachments',
  requireAuth,
  requirePermission('documents:create'),
  parseAttachmentUpload,
  (req, res, next) => {
    sdsController.uploadAttachment(req, res).catch(next);
  }
);

router.patch(
  '/:id/attachments/:attachmentId/primary',
  requireAuth,
  requirePermission('documents:update'),
  (req, res, next) => {
    sdsController.setPrimaryAttachment(req, res).catch(next);
  }
);

router.delete(
  '/:id/attachments/:attachmentId',
  requireAuth,
  requirePermission('documents:delete'),
  (req, res, next) => {
    sdsController.deleteAttachment(req, res).catch(next);
  }
);

router.delete('/:id', requireAuth, requirePermission('documents:delete'), (req, res, next) => {
  sdsController.remove(req, res).catch(next);
});

export default router;
