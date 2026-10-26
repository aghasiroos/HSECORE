import { Router } from 'express';
import { auditController } from './audit.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  auditController.getLogs(req, res).catch(next);
});

router.post('/', requireAuth, (req, res, next) => {
  auditController.createLog(req, res).catch(next);
});

export default router;
