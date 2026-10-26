import { Router } from 'express';
import { incidentController } from './incident.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  incidentController.getAllIncidents(req, res).catch(next);
});

router.get('/:incidentNumber', requireAuth, (req, res, next) => {
  incidentController.getIncidentByNumber(req, res).catch(next);
});

router.post('/', requireAuth, (req, res, next) => {
  incidentController.createIncident(req, res).catch(next);
});

router.post('/:incidentNumber/capa', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), (req, res, next) => {
  incidentController.addCAPA(req, res).catch(next);
});

router.get('/:incidentNumber/a4-print', requireAuth, (req, res, next) => {
  incidentController.getA4PrintableReport(req, res).catch(next);
});

router.delete('/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'EXECUTIVE_MANAGER'), (req, res, next) => {
  incidentController.deleteIncident(req, res).catch(next);
});

export default router;
