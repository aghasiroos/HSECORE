import { Router } from 'express';
import { incidentController } from './incident.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/next-number', requireAuth, (req, res, next) => {
  incidentController.getNextNumber(req, res).catch(next);
});

router.get('/', requireAuth, (req, res, next) => {
  incidentController.getAllIncidents(req, res).catch(next);
});

router.get('/:incidentNumber', requireAuth, (req, res, next) => {
  incidentController.getIncidentByNumber(req, res).catch(next);
});

router.post('/', requireAuth, (req, res, next) => {
  incidentController.createIncident(req, res).catch(next);
});

router.put('/:idOrNumber', requireAuth, (req, res, next) => {
  incidentController.updateIncident(req, res).catch(next);
});

router.post(
  '/:idOrNumber/workflow/triage',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'EXECUTIVE_MANAGER'),
  (req, res, next) => {
    incidentController.hseHeadTriage(req, res).catch(next);
  }
);

router.post(
  '/:idOrNumber/workflow/investigate',
  requireAuth,
  (req, res, next) => {
    incidentController.hseExpertInvestigate(req, res).catch(next);
  }
);

router.post(
  '/:idOrNumber/workflow/final-approve',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'EXECUTIVE_MANAGER'),
  (req, res, next) => {
    incidentController.hseHeadFinalApprove(req, res).catch(next);
  }
);

router.put('/:idOrNumber/rhs-f34', requireAuth, (req, res, next) => {
  incidentController.saveRhsF34(req, res).catch(next);
});

router.post(
  '/:idOrNumber/rhs-f34/review',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'EXECUTIVE_MANAGER'),
  (req, res, next) => {
    incidentController.reviewRhsF34(req, res).catch(next);
  }
);

router.put(
  '/:idOrNumber/rhs-f34/non-conformance',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'EXECUTIVE_MANAGER', 'SAFETY_OFFICER', 'SAFETY_INSPECTOR'),
  (req, res, next) => {
    incidentController.updateRhsF34NonConformance(req, res).catch(next);
  }
);

router.post(
  '/:incidentNumber/capa',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'SAFETY_INSPECTOR'),
  (req, res, next) => {
    incidentController.addCAPA(req, res).catch(next);
  }
);

router.get('/:incidentNumber/a4-print', requireAuth, (req, res, next) => {
  incidentController.getA4PrintableReport(req, res).catch(next);
});

router.delete('/:id', requireAuth, (req, res, next) => {
  incidentController.deleteIncident(req, res).catch(next);
});

export default router;
