import { Router } from 'express';
import { notificationController } from './notification.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

// 0. Public Active Emergency Alerts & Acknowledgment (Login Screen / Guest Access)
router.get('/public/active', (req, res, next) => {
  notificationController.getPublicActiveEmergencies(req, res).catch(next);
});

router.post('/public/acknowledge', (req, res, next) => {
  notificationController.acknowledgePublic(req, res).catch(next);
});

// 1. Get notifications with query parameters
router.get('/', requireAuth, (req, res, next) => {
  notificationController.getNotifications(req, res).catch(next);
});

// 2. User Preferences
router.get('/preferences', requireAuth, (req, res, next) => {
  notificationController.getUserPreferences(req, res).catch(next);
});

router.put('/preferences', requireAuth, (req, res, next) => {
  notificationController.updateUserPreferences(req, res).catch(next);
});

// Custom HSE Siren Stream & Upload (high-performance binary audio handling)
router.get('/custom-siren', (req, res, next) => {
  notificationController.streamCustomSiren(req, res).catch(next);
});

router.post('/custom-siren', requireAuth, (req, res, next) => {
  notificationController.uploadCustomSiren(req, res).catch(next);
});

router.delete('/custom-siren', requireAuth, (req, res, next) => {
  notificationController.deleteCustomSiren(req, res).catch(next);
});

// 3. Test Alert Endpoint
router.post('/test-alert', requireAuth, (req, res, next) => {
  notificationController.triggerTestAlert(req, res).catch(next);
});

// 4. Mark all as read
router.post('/read', requireAuth, (req, res, next) => {
  notificationController.markAllRead(req, res).catch(next);
});

// 5. Mark single notification as read
router.patch('/:id/read', requireAuth, (req, res, next) => {
  notificationController.markSingleRead(req, res).catch(next);
});

// 6. Acknowledge notification (especially critical HSE alerts)
router.post('/:id/acknowledge', requireAuth, (req, res, next) => {
  notificationController.acknowledgeNotification(req, res).catch(next);
});

// 7. Get notification by ID
router.get('/:id', requireAuth, (req, res, next) => {
  notificationController.getNotificationById(req, res).catch(next);
});

// 8. Create new notification (Restricted by role)
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'EXECUTIVE_MANAGER', 'PROJECT_MANAGER', 'SUPERVISOR'),
  (req, res, next) => {
    notificationController.createNotification(req, res).catch(next);
  }
);

// 9. Clear all notifications (Admin/HSE Manager only)
router.post(
  '/clear',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'),
  (req, res, next) => {
    notificationController.clearAllNotifications(req, res).catch(next);
  }
);

// 10. Delete notification
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'),
  (req, res, next) => {
    notificationController.deleteNotification(req, res).catch(next);
  }
);

// 11. SSE stream
router.get('/stream', requireAuth, (req, res) => {
  notificationController.streamEvents(req, res);
});

export default router;
