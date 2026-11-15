import { Router } from 'express';
import { auditController } from './audit.controller.ts';
import { requireAuth, requirePermission } from '../../core/middleware/auth.ts';

const router = Router();

// Strictly append-only: only GET (read) and POST (append) are permitted. No PUT/PATCH/DELETE endpoints exist.
router.get('/', requireAuth, requirePermission('audit:read'), (req, res, next) => {
  auditController.getLogs(req, res).catch(next);
});

router.post('/', requireAuth, (req, res, next) => {
  auditController.createLog(req, res).catch(next);
});

export default router;
