import { Router } from 'express';
import { bpmnController } from './bpmn.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/processes', requireAuth, (req, res, next) => {
  bpmnController.getAllProcesses(req, res).catch(next);
});

router.get('/process/versions/:id', requireAuth, (req, res, next) => {
  bpmnController.getVersions(req, res).catch(next);
});

router.post('/process/deploy', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  bpmnController.deployProcess(req, res).catch(next);
});

router.post('/process/simulate', requireAuth, (req, res, next) => {
  bpmnController.simulateProcess(req, res).catch(next);
});

router.get('/process/active-instances', requireAuth, (req, res, next) => {
  bpmnController.getActiveInstances(req, res).catch(next);
});

router.post('/process/intervention', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  bpmnController.intervene(req, res).catch(next);
});

router.get('/process/statistics', requireAuth, (req, res, next) => {
  bpmnController.getStatistics(req, res).catch(next);
});

// BPMN Modeler specific CRUD
router.post('/bpmn/upload', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  bpmnController.uploadBpmn(req, res).catch(next);
});

router.get('/bpmn/list', requireAuth, (req, res, next) => {
  bpmnController.getBpmnList(req, res).catch(next);
});

router.get('/bpmn/:id', requireAuth, (req, res, next) => {
  bpmnController.getBpmnById(req, res).catch(next);
});

router.get('/bpmn/:id/xml', requireAuth, (req, res, next) => {
  bpmnController.getBpmnXml(req, res).catch(next);
});

router.delete('/bpmn/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  bpmnController.deleteBpmn(req, res).catch(next);
});

export default router;
