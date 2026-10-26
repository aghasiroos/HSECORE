import { Router } from 'express';
import { hseController } from './hse.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

// 5S
router.get('/5s', requireAuth, (req, res, next) => {
  hseController.getFiveS(req, res).catch(next);
});

router.post('/5s', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  hseController.createFiveS(req, res).catch(next);
});

// Fire Equipment
router.get('/fire-equipment', requireAuth, (req, res, next) => {
  hseController.getFireEquipment(req, res).catch(next);
});

router.post('/fire-equipment', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  hseController.upsertFireEquipment(req, res).catch(next);
});

// Safety Warnings
router.get('/warnings', requireAuth, (req, res, next) => {
  hseController.getWarnings(req, res).catch(next);
});

router.post('/warnings', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  hseController.createWarning(req, res).catch(next);
});

router.post('/warnings/deduplicate', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  hseController.deduplicateWarnings(req, res).catch(next);
});

router.delete('/warnings', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  hseController.clearAllWarnings(req, res).catch(next);
});

// TRIR & KPI
router.get('/trir', requireAuth, (req, res, next) => {
  hseController.getTrirRecords(req, res).catch(next);
});

router.post('/trir', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'SUPERVISOR'), (req, res, next) => {
  hseController.upsertTrir(req, res).catch(next);
});

router.delete('/trir/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'SUPERVISOR'), (req, res, next) => {
  hseController.deleteTrir(req, res).catch(next);
});

router.delete('/trir', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  hseController.clearAllTrir(req, res).catch(next);
});

// Settings
router.get('/settings', requireAuth, (req, res, next) => {
  hseController.getSettings(req, res).catch(next);
});

router.post('/settings', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  hseController.updateSetting(req, res).catch(next);
});

// Full Sync
router.get('/full-sync', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  hseController.getFullSync(req, res).catch(next);
});

export default router;
