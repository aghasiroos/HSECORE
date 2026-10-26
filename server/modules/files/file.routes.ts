import { Router } from 'express';
import multer from 'multer';
import { fileController } from './file.controller.ts';
import { requireAuth, requireRole, requirePermission } from '../../core/middleware/auth.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB strict upload limit
});

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
  upload.single('file'),
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
  upload.single('file'),
  (req, res, next) => {
    fileController.replaceDocumentFile(req, res).catch(next);
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
router.post('/upload', requireAuth, upload.single('file'), (req, res, next) => {
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
