import { Router } from 'express';
import { monitoringController } from './monitoring.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

router.get('/health', (req, res) => {
  monitoringController.getHealth(req, res);
});

router.get('/health/db', (req, res) => {
  monitoringController.getDbHealth(req, res);
});

router.get('/health/services', (req, res) => {
  monitoringController.getServicesHealth(req, res);
});

router.get('/openapi.json', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res) => {
  monitoringController.getOpenApiSpec(req, res);
});

router.get('/architecture/status', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res) => {
  monitoringController.getArchitectureStatus(req, res);
});

export default router;
