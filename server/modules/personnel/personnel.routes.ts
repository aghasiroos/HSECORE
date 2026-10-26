import { Router } from 'express';
import { personnelController } from './personnel.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/organizations', requireAuth, (req, res, next) => {
  personnelController.getHierarchy(req, res).catch(next);
});

router.post('/organizations/seed', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  personnelController.seedHierarchy(req, res).catch(next);
});

router.get('/', requireAuth, (req, res, next) => {
  personnelController.getAllPersonnel(req, res).catch(next);
});

router.get('/:identifier', requireAuth, (req, res, next) => {
  personnelController.getByIdentifier(req, res).catch(next);
});

router.post('/', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  personnelController.upsertPersonnel(req, res).catch(next);
});

router.post('/batch', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  personnelController.batchUpsert(req, res).catch(next);
});

router.delete('/:identifier', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  personnelController.deletePersonnel(req, res).catch(next);
});

export default router;
