import { Router } from 'express';
import { processController } from './controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

// Camunda & Instance Execution
router.post('/deploy', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), processController.deploy);
router.post('/start-instance', requireAuth, processController.startInstance);

// Smart Tasklist & Approvals
router.get('/tasks', requireAuth, processController.getTasks);
router.post('/tasks/:id/complete', requireAuth, processController.completeTask);
router.post('/tasks/:id/action', requireAuth, processController.completeTask);
router.post('/tasks/:id/substitute', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), processController.substituteApprover);

// Process Instances Tracking
router.get('/instances', requireAuth, processController.getInstances);
router.get('/instances/:id', requireAuth, processController.getInstanceById);

// Workflows Catalog & Definition
router.get('/workflows', requireAuth, processController.getWorkflows);
router.get('/workflows/:id', requireAuth, processController.getWorkflow);
router.delete('/workflows/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), processController.deleteWorkflow);
router.post('/custom-save', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), processController.saveWorkflow);
router.post('/workflows/reset', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), processController.resetWorkflows);

// Stats & Analytics
router.get('/stats', requireAuth, processController.getStats);

export default router;

