import { Request, Response } from 'express';
import { authService } from './auth.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { getClientIp } from '../../core/ip.ts';
import { UnauthorizedError, ValidationError } from '../../core/errors.ts';
import { auditService } from '../audit/audit.service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'نام کاربری و کلمه عبور الزامی است.' }
        });
      }
      const ip = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = await authService.login({ username, password }, { ip, userAgent });

      // Adaptive HttpOnly Cookie: handles HTTP and HTTPS deployments smoothly without browser cookie rejection
      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      res.cookie('hse_auth_token', result.token, {
        httpOnly: true,
        secure: Boolean(isHttps),
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return ApiResponse.success(res, result);
    } catch (err: any) {
      const statusCode = err?.statusCode || err?.status || (err?.name === 'UnauthorizedError' ? 401 : err?.name === 'ForbiddenError' ? 403 : err?.name === 'ValidationError' ? 422 : 500);
      return res.status(statusCode).json({
        success: false,
        error: {
          code: err?.code || 'AUTH_FAILED',
          message: err?.message || 'نام کاربری یا کلمه عبور وارد شده نادرست است.',
        },
      });
    }
  }

  async getMe(req: Request, res: Response) {
    if (!req.user || !req.user.uid) {
      return ApiResponse.success(res, null);
    }
    const user = await authService.getCurrentUser(req.user.uid);
    return ApiResponse.success(res, user);
  }

  async updateMySessionTimeout(req: Request, res: Response) {
    if (!req.user || !req.user.uid) {
      throw new UnauthorizedError('احراز هویت الزامی است.');
    }
    const ip = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const { sessionAlwaysActive, sessionTimeoutMinutes } = req.body || {};
    const result = await authService.updateMySessionTimeout(
      req.user.uid,
      { sessionAlwaysActive, sessionTimeoutMinutes },
      { ip, userAgent }
    );

    // Sync strictly to the exact same signed-in user across their own open tabs/devices
    broadcastDataMutation(
      'user_preferences',
      'update',
      {
        userUid: req.user.uid,
        prefKey: 'session_timeout',
        value: {
          sessionTimeoutMinutes: result.sessionTimeoutMinutes,
          sessionAlwaysActive: result.sessionAlwaysActive,
          sessionPolicy: result.sessionPolicy,
        },
      },
      {
        module: 'AUTH',
        recordId: req.user.uid,
        actorId: req.user.uid,
        targetUserUid: req.user.uid,
      }
    );

    return ApiResponse.success(res, result);
  }

  async changePassword(req: Request, res: Response) {
    if (!req.user || !req.user.uid) {
      throw new UnauthorizedError('احراز هویت الزامی است.');
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new ValidationError('رمز عبور فعلی و رمز عبور جدید الزامی هستند.');
    }
    const ip = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const result = await authService.changePassword(
      req.user.uid,
      currentPassword,
      newPassword,
      { ip, userAgent }
    );
    return ApiResponse.success(res, result);
  }

  async logout(req: Request, res: Response) {
    if (req.user) {
      const ip = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      await auditService.log({
        userId: req.user.id,
        userUid: req.user.uid,
        action: 'LOGOUT',
        module: 'AUTH',
        entityType: 'USER',
        entityId: req.user.uid,
        result: 'SUCCESS',
        ipAddress: ip,
        userAgent,
        details: { username: req.user.username || req.user.name },
      });
    }

    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie('hse_auth_token', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });

    return ApiResponse.success(res, { message: 'خروج با موفقیت انجام شد.' });
  }

  async getAllUsers(req: Request, res: Response) {
    const users = await authService.getAllUsers();
    return res.json({ success: true, data: users, count: users.length });
  }

  async upsertUser(req: Request, res: Response) {
    const user = await authService.upsertUser(req.body, req.user);
    broadcastDataMutation('users', 'upsert', user);
    return ApiResponse.success(res, user);
  }

  async getUserPersonnelAssignments(req: Request, res: Response) {
    const targetUid = req.params.uid || req.user?.uid;
    if (!targetUid) {
      throw new ValidationError('شناسه کاربر الزامی است.');
    }
    const ctx = await personnelAccessService.resolveAccessContext(targetUid);
    return ApiResponse.success(res, {
      userId: ctx.userId,
      uid: ctx.userUid,
      username: ctx.username,
      fullName: ctx.fullName,
      scope: ctx.scope,
      canAccessAll: ctx.canAccessAll,
      assignedPersonnelIds: ctx.assignedPersonnel.map((p) => p.id),
      assignedPersonnelCodes: ctx.assignedPersonnel.map((p) => p.personnelCode),
      assignedPersonnel: ctx.assignedPersonnel,
    });
  }

  async updateUserPersonnelAssignments(req: Request, res: Response) {
    const targetUid = req.params.uid || req.body?.uid || req.body?.userId;
    if (!targetUid) {
      throw new ValidationError('شناسه کاربر هدف الزامی است.');
    }
    const ip = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const scope = req.body?.scope || req.body?.personnelAccessScope || 'ASSIGNED';
    const personnelIds = Array.isArray(req.body?.personnelIds)
      ? req.body.personnelIds
      : Array.isArray(req.body?.assignedPersonnelIds)
      ? req.body.assignedPersonnelIds
      : [];

    const result = await personnelAccessService.updateUserPersonnelAssignments({
      targetUserIdentifier: targetUid,
      scope,
      personnelIds,
      actor: req.user
        ? {
            id: req.user.id,
            uid: req.user.uid,
            username: req.user.username,
            fullName: req.user.name,
            role: req.user.role,
            personnelNumber: req.user.personnelCode,
          }
        : undefined,
      ipAddress: ip,
      userAgent,
    });

    return ApiResponse.success(res, result, { message: 'اشخاص مرتبط کاربر با موفقیت ذخیره و در تمامی نشست‌ها اعمال شد.' });
  }

  async softDeleteUser(req: Request, res: Response) {
    if (req.user?.uid === req.params.uid || String(req.user?.id) === String(req.params.uid) || req.user?.username === req.params.uid) {
      throw new ValidationError('امکان حذف حساب کاربری جاری خودتان وجود ندارد.');
    }
    await authService.softDeleteUser(req.params.uid, req.user);
    broadcastDataMutation('users', 'delete', { uid: req.params.uid });
    return ApiResponse.success(res, { message: 'کاربر با موفقیت غیرفعال و نشانه‌گذاری شد.' });
  }

  async getProfile(req: Request, res: Response) {
    if (req.user?.uid) {
      try {
        const user = await authService.getCurrentUser(req.user.uid);
        return ApiResponse.success(res, user);
      } catch {
        return ApiResponse.success(res, req.user);
      }
    }
    return ApiResponse.success(res, req.user || { role: 'USER', name: 'کاربر سیستم' });
  }
}

export const authController = new AuthController();

