import { Router } from 'express';
import { notificationController } from './notification.controller.ts';
import { requireAuth, requireRole } from '../../core/middleware/auth.ts';

const router = Router();

// 0. Public Active Emergency Alerts, Web Push Subscriptions & SSE Stream (Login Screen / Guest / Lock Screen Access)
router.get('/public/active', (req, res, next) => {
  notificationController.getPublicActiveEmergencies(req, res).catch(next);
});

router.post('/public/acknowledge', (req, res, next) => {
  notificationController.acknowledgePublic(req, res).catch(next);
});

router.post('/public/view', (req, res, next) => {
  notificationController.confirmPublicView(req, res).catch(next);
});

router.get('/public/vapid-public-key', (req, res, next) => {
  notificationController.getVapidPublicKey(req, res).catch(next);
});

router.post('/public/push-subscribe', (req, res, next) => {
  notificationController.subscribeWebPush(req, res).catch(next);
});

router.post('/public/push-unsubscribe', (req, res, next) => {
  notificationController.unsubscribeWebPush(req, res).catch(next);
});

router.get('/public/stream', (req, res) => {
  notificationController.streamPublicEvents(req, res);
});

// 1. Get notifications with query parameters
router.get('/', requireAuth, (req, res, next) => {
  notificationController.getNotifications(req, res).catch(next);
});

// 2. User Preferences & Registered Push Devices
router.get('/preferences', requireAuth, (req, res, next) => {
  notificationController.getUserPreferences(req, res).catch(next);
});

router.put('/preferences', requireAuth, (req, res, next) => {
  notificationController.updateUserPreferences(req, res).catch(next);
});

router.get('/push-subscriptions', requireAuth, (req, res, next) => {
  notificationController.getPushSubscriptions(req, res).catch(next);
});

router.delete('/push-subscriptions/:id', requireAuth, (req, res, next) => {
  notificationController.deletePushSubscription(req, res).catch(next);
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

// 6. Acknowledge notification & Confirm View & Delivery Report
router.post('/:id/acknowledge', requireAuth, (req, res, next) => {
  notificationController.acknowledgeNotification(req, res).catch(next);
});

router.post('/:id/view', requireAuth, (req, res, next) => {
  notificationController.confirmView(req, res).catch(next);
});

router.get('/:id/delivery-report', requireAuth, (req, res, next) => {
  notificationController.getDeliveryReport(req, res).catch(next);
});

// 7. SSE stream (placed before /:id so it is never shadowed)
router.get('/stream', requireAuth, (req, res) => {
  notificationController.streamEvents(req, res);
});

// 8. Get notification by ID
router.get('/:id', requireAuth, (req, res, next) => {
  notificationController.getNotificationById(req, res).catch(next);
});

// 9. Create new notification (Restricted by role)
router.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'EXECUTIVE_MANAGER', 'PROJECT_MANAGER', 'SUPERVISOR'),
  (req, res, next) => {
    notificationController.createNotification(req, res).catch(next);
  }
);

// 10. Clear all notifications (Admin/HSE Manager only)
router.post(
  '/clear',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'),
  (req, res, next) => {
    notificationController.clearAllNotifications(req, res).catch(next);
  }
);

// 11. Delete notification
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'),
  (req, res, next) => {
    notificationController.deleteNotification(req, res).catch(next);
  }
);

export default router;
