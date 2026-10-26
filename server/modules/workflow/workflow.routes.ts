import { Router } from 'express';
import { workflowController } from './workflow.controller.ts';
import { requireAuth } from '../../core/middleware/auth.ts';

const router = Router();

router.post('/instances', requireAuth, (req, res, next) => {
  workflowController.createInstance(req, res).catch(next);
});

router.get('/instances', requireAuth, (req, res, next) => {
  workflowController.getAllInstances(req, res).catch(next);
});

router.get('/instances/:id', requireAuth, (req, res, next) => {
  workflowController.getInstanceById(req, res).catch(next);
});

router.get('/by-entity/:entityType/:entityId', requireAuth, (req, res, next) => {
  workflowController.getByEntity(req, res).catch(next);
});

router.post('/instances/:id/action', requireAuth, (req, res, next) => {
  workflowController.executeAction(req, res).catch(next);
});

router.get('/instances/:id/signatures', requireAuth, (req, res, next) => {
  workflowController.getSignatures(req, res).catch(next);
});

router.get('/instances/:id/history', requireAuth, (req, res, next) => {
  workflowController.getHistory(req, res).catch(next);
});

router.get('/instances/:id/a4-verification', requireAuth, (req, res, next) => {
  workflowController.getA4Verification(req, res).catch(next);
});

export default router;
