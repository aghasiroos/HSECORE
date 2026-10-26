import { Router } from 'express';
import { authController } from './auth.controller.ts';
import { optionalAuth, requireAuth, requireRole } from '../../core/middleware/auth.ts';
import { authRateLimiter } from '../../core/middleware/rateLimiter.ts';

const router = Router();

// Public Authentication Endpoints
router.post('/login', authRateLimiter, (req, res, next) => {
  authController.login(req, res).catch(next);
});

// Authenticated Session Endpoints
router.get('/me', optionalAuth, (req, res, next) => {
  authController.getMe(req, res).catch(next);
});

router.post('/change-password', requireAuth, (req, res, next) => {
  authController.changePassword(req, res).catch(next);
});

router.post('/logout', optionalAuth, (req, res, next) => {
  authController.logout(req, res).catch(next);
});

router.get('/profile', requireAuth, (req, res, next) => {
  authController.getProfile(req, res).catch(next);
});

// Role-Gated User Management Endpoints
router.get('/users', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res, next) => {
  authController.getAllUsers(req, res).catch(next);
});

router.post('/users', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), (req, res, next) => {
  authController.upsertUser(req, res).catch(next);
});

router.get('/my-personnel-assignments', requireAuth, (req, res, next) => {
  authController.getUserPersonnelAssignments(req, res).catch(next);
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

export default router;

