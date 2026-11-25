import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.ts';
import personnelRoutes from '../modules/personnel/personnel.routes.ts';
import workflowRoutes from '../modules/workflow/workflow.routes.ts';
import ptwRoutes from '../modules/ptw/ptw.routes.ts';
import incidentRoutes from '../modules/incidents/incident.routes.ts';
import healthRoutes from '../modules/health/health.routes.ts';
import hseRoutes from '../modules/hse/hse.routes.ts';
import fileRoutes from '../modules/files/file.routes.ts';
import auditRoutes from '../modules/audit/audit.routes.ts';
import notificationRoutes from '../modules/notifications/notification.routes.ts';
import bpmnRoutes from '../modules/bpmn/bpmn.routes.ts';
import processManagementRoutes from '../modules/process-management/routes.ts';
import aiRoutes from '../modules/ai/ai.routes.ts';
import monitoringRoutes from '../modules/monitoring/monitoring.routes.ts';
import psmRoutes from '../modules/psm/psm.routes.ts';
import fireDesignRoutes from '../modules/fire-design/fireDesign.routes.ts';
import sdsRoutes from '../modules/sds/sds.routes.ts';
import liftingRoutes from '../modules/lifting/lifting.routes.ts';
import scaffoldingRoutes from '../modules/scaffolding/scaffolding.routes.ts';
import databaseRoutes from './database-routes.ts';
import { settingsRouter } from './settings.router.ts';
import { organizationRouter } from './organization.router.ts';
import { dashboardRouter } from './dashboard.router.ts';
import { referralRouter } from './referral.router.ts';
import { webhooksRouter } from './webhooks.router.ts';
import { automationRouter } from './automation.router.ts';
import { backupRouter } from './backup.router.ts';
import { userPreferencesRouter } from './userPreferences.router.ts';
import { collectionRouter } from './collection.router.ts';
import { trainingRouter } from './training.router.ts';
import { initBackupScheduler } from '../services/backup.service.ts';
import { requireAuth, requireRole } from '../core/middleware/auth.ts';
import { authController } from '../modules/auth/auth.controller.ts';

export function createApiRouter(): Router {
  const router = Router();

  // Initialize background backup retention & schedule monitor
  initBackupScheduler();

  // ==========================================
  // Modular Monolith v1 Enterprise API Routes
  // ==========================================
  const v1 = Router();
  v1.use('/dashboard', dashboardRouter);
  v1.use('/settings', settingsRouter);
  v1.use('/user-preferences', userPreferencesRouter);
  v1.use('/collection', collectionRouter);
  v1.use('/backup', backupRouter);
  v1.use('/webhooks', webhooksRouter);
  v1.use('/organization', organizationRouter);
  v1.use('/auth', authRoutes);
  v1.use('/personnel', personnelRoutes);
  v1.use('/workflows', workflowRoutes);
  v1.use('/ptw', ptwRoutes);
  v1.use('/incidents', incidentRoutes);
  v1.use('/health-exams', healthRoutes);
  v1.use('/hse', hseRoutes);
  v1.use('/files', fileRoutes);
  v1.use('/audit', auditRoutes);
  v1.use('/notifications', notificationRoutes);
  v1.use('/bpmn', bpmnRoutes);
  v1.use('/process-management', processManagementRoutes);
  v1.use('/ai', aiRoutes);
  v1.use('/monitoring', monitoringRoutes);
  v1.use('/psm', psmRoutes);
  v1.use('/fire-design', fireDesignRoutes);
  v1.use('/sds', sdsRoutes);
  v1.use('/lifting', liftingRoutes);
  v1.use('/scaffolding', scaffoldingRoutes);
  v1.use('/referrals', referralRouter);
  v1.use('/automation', automationRouter);
  v1.use('/training', trainingRouter);

  // Database core routes mounted on v1 root and v1 /database alias (both strictly secured)
  v1.use('/database', databaseRoutes);
  v1.use('/', databaseRoutes);

  // Mount /api/v1
  router.use('/v1', v1);
  router.use('/backup', backupRouter);
  router.use('/webhooks', webhooksRouter);
  router.use('/automation', automationRouter);

  // Support /api/dashboard alias
  router.use('/dashboard', dashboardRouter);

  // Support /api/database/* alias mapped strictly to secured databaseRoutes
  router.use('/database', databaseRoutes);

  // ========================================================
  // Legacy / Direct Frontend Backward-Compatibility Mappings
  // Secured with appropriate RBAC - NO optionalAuth leaks!
  // ========================================================
  router.use('/auth', authRoutes);
  router.use('/audit-logs', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), auditRoutes);
  router.use('/notifications', requireAuth, notificationRoutes);
  router.use('/files', requireAuth, fileRoutes);
  router.get('/users', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
    authController.getAllUsers(req, res).catch(next);
  });
  router.post('/users', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
    authController.upsertUser(req, res).catch(next);
  });
  router.get('/users/:uid/personnel-assignments', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
    authController.getUserPersonnelAssignments(req, res).catch(next);
  });
  router.put('/users/:uid/personnel-assignments', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
    authController.updateUserPersonnelAssignments(req, res).catch(next);
  });
  router.delete('/users/:uid', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
    authController.softDeleteUser(req, res).catch(next);
  });
  router.use('/personnel', requireAuth, personnelRoutes);
  router.use('/permits', requireAuth, ptwRoutes);
  router.use('/incidents', requireAuth, incidentRoutes);
  router.use('/referrals', requireAuth, referralRouter);

  // BPMN & Process routes
  router.use('/bpmn', requireAuth, bpmnRoutes);
  router.use('/process-management', processManagementRoutes);
  router.use('/workflows', requireAuth, workflowRoutes);
  router.use('/ai', requireAuth, aiRoutes);
  router.use('/psm', requireAuth, psmRoutes);
  router.use('/fire-design', requireAuth, fireDesignRoutes);
  router.use('/sds', requireAuth, sdsRoutes);
  router.use('/lifting', requireAuth, liftingRoutes);
  router.use('/scaffolding', requireAuth, scaffoldingRoutes);

  // Health and medical legacy routes
  router.use('/medical-exams', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL', 'NUTRITIONIST', 'MEDICAL_STAFF', 'کارشناس تغذیه'), healthRoutes);

  // HSE submodules legacy routes
  router.use('/hse', requireAuth, hseRoutes);

  return router;
}
