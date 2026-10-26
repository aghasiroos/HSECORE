import { Router } from 'express';
import { ptwController } from './ptw.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  ptwController.getAllPermits(req, res).catch(next);
});

router.get('/:permitNumber', requireAuth, (req, res, next) => {
  ptwController.getPermitByNumber(req, res).catch(next);
});

router.post('/', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  ptwController.createPermit(req, res).catch(next);
});

router.post('/check-clashes', requireAuth, (req, res, next) => {
  ptwController.checkClashes(req, res).catch(next);
});

router.get('/:permitNumber/a4-print', requireAuth, (req, res, next) => {
  ptwController.getA4PrintablePermit(req, res).catch(next);
});

router.delete('/:permitNumber', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  ptwController.deletePermit(req, res).catch(next);
});

export default router;
