import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { notificationService } from './notification.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { broadcastDataMutation } from '../../core/socket.ts';

export class NotificationController {
  async getNotifications(req: Request, res: Response) {
    const user = req.user as any;
    const clientSessionId =
      typeof req.query.clientSessionId === 'string' && req.query.clientSessionId.trim()
        ? req.query.clientSessionId.trim()
        : undefined;
    const userIdentifiers = [
      user?.uid,
      user?.username,
      user?.fullName,
      clientSessionId ? `guest_${clientSessionId.slice(0, 24)}` : undefined,
    ].filter(Boolean) as string[];
    const { notifications, unreadCount } = await notificationService.getAllNotifications(
      userIdentifiers.length > 0 ? userIdentifiers : undefined
    );

    // Apply optional query filters
    let filtered = notifications;

    const { category, priority, sourceModule, unreadOnly, limit } = req.query;

    if (category && typeof category === 'string') {
      filtered = filtered.filter((n) => n.category === category);
    }
    if (priority && typeof priority === 'string') {
      filtered = filtered.filter((n) => n.priority === priority);
    }
    if (sourceModule && typeof sourceModule === 'string') {
      filtered = filtered.filter((n) => n.sourceModule === sourceModule);
    }
    if (unreadOnly === 'true') {
      filtered = filtered.filter((n) => !n.read);
    }
    if (limit && !isNaN(Number(limit))) {
      filtered = filtered.slice(0, Number(limit));
    }

    return res.json({
      success: true,
      data: filtered,
      unreadCount,
      count: filtered.length,
      totalCount: notifications.length,
    });
  }

  async getNotificationById(req: Request, res: Response) {
    const id = req.params.id;
    const notif = await notificationService.getById(id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'اعلان مورد نظر یافت نشد.' });
    }
    return res.json({ success: true, data: notif });
  }

  async createNotification(req: Request, res: Response) {
    const {
      title,
      body,
      type,
      priority,
      category,
      sourceModule,
      actionUrl,
      recordId,
      targetType,
      targetValues,
      requiresAck,
      sirenType,
      actionGuidelines,
      metadata,
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'عنوان و متن اعلان الزامی است.' });
    }

    const user = req.user as any;
    const senderName = user?.fullName || user?.username || 'سامانه جامع HSECORE';

    const finalSiren = sirenType || metadata?.sirenType;

    const created = await notificationService.send({
      title,
      body,
      type: type || 'popup_and_push',
      priority,
      category,
      sourceModule: sourceModule || 'system',
      actionUrl,
      recordId,
      targetType: targetType || 'all',
      targetValues: Array.isArray(targetValues) ? targetValues : [],
      sender: senderName,
      requiresAck,
      sirenType: finalSiren,
      actionGuidelines: actionGuidelines || metadata?.actionGuidelines,
      metadata: {
        ...(metadata || {}),
        sirenType: finalSiren,
        actionGuidelines: actionGuidelines || metadata?.actionGuidelines,
      },
    });

    return ApiResponse.success(res, created, { message: 'اعلان با موفقیت ایجاد و ارسال شد.' }, 201);
  }

  async markSingleRead(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'شناسه اعلان الزامی است.' });
    }
    const userId = req.user?.uid || 'user';
    const clientSessionId = typeof req.body?.clientSessionId === 'string' ? req.body.clientSessionId : undefined;
    await notificationService.markRead(id, userId, clientSessionId);
    return res.json({ success: true, message: 'اعلان به عنوان خوانده‌شده علامت‌گذاری شد.' });
  }

  async markAllRead(req: Request, res: Response) {
    const userId = req.user?.uid || 'user';
    await notificationService.markAllRead(userId);
    return res.json({ success: true, message: 'تمام اعلان‌ها خوانده شدند.' });
  }

  async acknowledgeNotification(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'شناسه اعلان الزامی است.' });
    }
    const user = req.user as any;
    const userId = user?.uid || user?.username || 'user';
    const userName = user?.fullName || user?.username || 'کاربر سیستم';
    const note = req.body?.note;
    const acknowledgmentSource = req.body?.acknowledgmentSource || 'in_app_modal';
    const clientSessionId = typeof req.body?.clientSessionId === 'string' ? req.body.clientSessionId : undefined;
    const ip = req.ip || (req.socket as any)?.remoteAddress || 'unknown';

    await notificationService.acknowledge(id, userId, userName, note, {
      acknowledgmentSource,
      clientIp: ip,
      clientSessionId,
    });
    return res.json({ success: true, message: 'اعلان با موفقیت توسط شما تأیید گردید و آژیر متوقف شد.' });
  }

  async confirmView(req: Request, res: Response) {
    const id = req.params.id || req.body?.notifId;
    if (!id) {
      return res.status(400).json({ success: false, error: 'شناسه هشدار الزامی است.' });
    }
    const user = req.user as any;
    const userId = user?.uid || user?.username || req.body?.userId || 'user';
    const userName = user?.fullName || user?.username || req.body?.userName || 'کاربر سیستم';
    const source = req.body?.source || 'alert_details_view';
    const deviceType = req.body?.deviceType;

    const ok = await notificationService.confirmAlertViewed(String(id), {
      userId: String(userId),
      userName: String(userName),
      source,
      deviceType,
    });
    return res.json({ success: ok });
  }

  async confirmPublicView(req: Request, res: Response) {
    const { notifId, userId, userName, clientSessionId, source, deviceType } = req.body || {};
    if (!notifId) {
      return res.status(400).json({ success: false, error: 'شناسه هشدار الزامی است.' });
    }
    const ok = await notificationService.confirmAlertViewed(String(notifId), {
      userId: userId ? String(userId) : undefined,
      userName: userName ? String(userName) : undefined,
      clientSessionId: clientSessionId ? String(clientSessionId) : undefined,
      source: source || 'browser_push_click',
      deviceType,
    });
    return res.json({ success: ok });
  }

  async getDeliveryReport(req: Request, res: Response) {
    const id = req.params.id;
    const notif = await notificationService.getById(id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'اعلان مورد نظر یافت نشد.' });
    }
    return res.json({
      success: true,
      data: {
        notifId: notif.notifId,
        title: notif.title,
        targetType: notif.targetType,
        targetValues: notif.targetValues,
        deliveryReport: notif.deliveryReport || notif.metadata?.deliveryReport || null,
        viewedBy: notif.viewedBy || notif.metadata?.viewedBy || [],
        acknowledgedBy: notif.acknowledgedBy || [],
        readBy: notif.readBy || [],
      },
    });
  }

  async deleteNotification(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'شناسه اعلان الزامی است.' });
    }
    await notificationService.deleteNotification(id);
    return res.json({ success: true, message: 'اعلان با موفقیت حذف شد.' });
  }

  async clearAllNotifications(req: Request, res: Response) {
    await notificationService.clearAllNotifications();
    return res.json({ success: true, message: 'تمام اعلان‌ها پاکسازی شدند.' });
  }

  async getUserPreferences(req: Request, res: Response) {
    const userId = req.user?.uid || 'anonymous';
    const preferences = await notificationService.getUserPreferences(userId);
    return res.json({ success: true, data: preferences });
  }

  async updateUserPreferences(req: Request, res: Response) {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'احراز هویت الزامی است.' });
    }
    const updated = await notificationService.saveUserPreferences(userId, req.body);
    return res.json({ success: true, data: updated, message: 'تنظیمات اعلان‌ها با موفقیت ذخیره شد.' });
  }

  async triggerTestAlert(req: Request, res: Response) {
    const { type, category, priority, sirenType, title, body, actionGuidelines, targetType, targetValues } = req.body;
    const testCategory = category || 'critical_hse';
    const testPriority = priority || 'critical';
    const chosenSiren = sirenType || 'siren_evacuation';
    const user = req.user as any;

    const testAlert = await notificationService.send({
      title: title || 'آزمایش هشدار فوری HSE (پنجره هشدار داخلی + اعلان سیستمی مرورگر)',
      body:
        body ||
        'این یک هشدار فوری آزمایشی جهت بررسی ارسال همزمان پنجره هشدار داخلی (Popup) و اعلان بومی سیستم‌عامل (Browser Push) حتی در زمان بسته بودن صفحه HSECORE است.',
      type: type || 'popup_and_push',
      category: testCategory,
      priority: testPriority,
      sourceModule: 'safety-unit',
      actionUrl: undefined,
      targetType: targetType || 'all',
      targetValues: Array.isArray(targetValues) ? targetValues : [],
      sender: user?.fullName || user?.username || 'مرکز فرماندهی HSE',
      requiresAck: testCategory === 'critical_hse' || testPriority === 'critical',
      sirenType: chosenSiren,
      metadata: {
        sirenType: chosenSiren,
        actionGuidelines:
          actionGuidelines ||
          'دستورالعمل اقدام فوری: خونسردی خود را حفظ کرده، به مسیرهای خروج اضطراری هدایت شوید و دریافت هشدار را جهت توقف آژیر تأیید نمایید.',
      },
    });

    return res.json({ success: true, data: testAlert, message: 'اعلان آزمایشی با موفقیت ارسال شد.' });
  }

  streamEvents(req: Request, res: Response) {
    const clientId = `client-${Date.now()}-${uuidv4().slice(0, 6)}`;
    notificationService.registerSSEClient(clientId, res, req.user?.uid, req.user?.role);
  }

  streamPublicEvents(req: Request, res: Response) {
    const clientId = `pub-${Date.now()}-${uuidv4().slice(0, 6)}`;
    notificationService.registerPublicSSEClient(clientId, res);
  }

  async getVapidPublicKey(req: Request, res: Response) {
    const info = await notificationService.getVapidPublicKey();
    return res.json({
      success: true,
      publicKey: info.publicKey,
      pushEnabled: info.pushEnabled,
      activeSubscriptions: info.activeSubscriptions,
      data: {
        publicKey: info.publicKey,
        pushEnabled: info.pushEnabled,
        activeSubscriptions: info.activeSubscriptions,
      },
    });
  }

  async subscribeWebPush(req: Request, res: Response) {
    const {
      subscription,
      userId,
      userName,
      username,
      role,
      jobTitle,
      departmentIds,
      departmentName,
      guestSessionId,
      clientSessionId,
      platform,
      deviceType,
      deviceName,
      browserName,
      osName,
    } = req.body || {};
    const endpoint = subscription?.endpoint || req.body?.endpoint;
    const keys = subscription?.keys || req.body?.keys;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({
        success: false,
        error: 'اطلاعات اشتراک Web Push (endpoint و کلیدهای رمزنگاری p256dh/auth) الزامی است.',
      });
    }

    const saved = await notificationService.registerPushSubscription({
      endpoint: String(endpoint),
      keys: {
        p256dh: String(keys.p256dh),
        auth: String(keys.auth),
      },
      userId: req.user?.uid || (userId ? String(userId) : undefined),
      userName:
        (req.user as any)?.fullName ||
        req.user?.username ||
        (userName ? String(userName) : username ? String(username) : undefined),
      role: req.user?.role || (role ? String(role) : undefined),
      jobTitle: jobTitle ? String(jobTitle) : undefined,
      departmentIds: Array.isArray(departmentIds) ? departmentIds.map(String) : undefined,
      departmentName: departmentName ? String(departmentName) : undefined,
      deviceType: deviceType || undefined,
      deviceName: deviceName ? String(deviceName).slice(0, 100) : undefined,
      browserName: browserName ? String(browserName).slice(0, 60) : undefined,
      osName: osName ? String(osName).slice(0, 60) : undefined,
      guestSessionId: guestSessionId
        ? String(guestSessionId)
        : clientSessionId
        ? String(clientSessionId)
        : undefined,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      platform: platform ? String(platform).slice(0, 80) : undefined,
    });

    return res.json({
      success: true,
      data: saved,
      message: 'اشتراک اعلان سیستمی مرورگر (Web Push) برای این دستگاه با موفقیت ثبت گردید.',
    });
  }

  async unsubscribeWebPush(req: Request, res: Response) {
    const endpoint = req.body?.endpoint || req.body?.subscription?.endpoint || req.body?.id;
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'آدرس endpoint یا شناسه اشتراک الزامی است.' });
    }
    const user = req.user as any;
    const isAdmin = ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'].includes(
      String(user?.role || '').toUpperCase()
    );
    await notificationService.unregisterPushSubscription(String(endpoint), user?.uid, isAdmin);
    return res.json({ success: true, message: 'اشتراک Web Push دستگاه لغو شد.' });
  }

  async getPushSubscriptions(req: Request, res: Response) {
    const user = req.user as any;
    const userId = user?.uid || user?.username;
    const isAdmin =
      req.query.all === 'true' &&
      ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'EXECUTIVE_MANAGER'].includes(
        String(user?.role || '').toUpperCase()
      );
    const list = await notificationService.getPushSubscriptions(userId, isAdmin);
    return res.json({
      success: true,
      data: list,
      count: list.length,
    });
  }

  async deletePushSubscription(req: Request, res: Response) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ success: false, error: 'شناسه دستگاه الزامی است.' });
    }
    const user = req.user as any;
    const isAdmin = ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'].includes(
      String(user?.role || '').toUpperCase()
    );
    await notificationService.unregisterPushSubscription(id, user?.uid, isAdmin);
    return res.json({ success: true, message: 'دستگاه ثبت‌شده با موفقیت حذف گردید.' });
  }

  async streamCustomSiren(req: Request, res: Response) {
    const publicSiren = path.resolve(process.cwd(), 'public/assets/custom-siren.mp3');
    const distSiren = path.resolve(process.cwd(), 'dist/assets/custom-siren.mp3');
    const filePath = fs.existsSync(publicSiren) ? publicSiren : distSiren;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Custom siren not found' });
    }
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(filePath).pipe(res);
  }

  async uploadCustomSiren(req: Request, res: Response) {
    const { audioData, fileName, fileSize } = req.body;
    if (!audioData) {
      return res.status(400).json({ success: false, error: 'Audio data is required' });
    }
    const base64Data = typeof audioData === 'string' && audioData.includes(',')
      ? audioData.split(',')[1]
      : audioData;
    const buffer = Buffer.from(base64Data, 'base64');
    const targetDir = path.resolve(process.cwd(), 'public/assets');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetFile = path.join(targetDir, 'custom-siren.mp3');
    fs.writeFileSync(targetFile, buffer);

    const userId = req.user?.uid;
    if (userId) {
      await notificationService.saveUserPreferences(userId, {
        criticalHseAudioMode: 'custom_mp3',
        criticalHseCustomAudioUrl: '/api/v1/notifications/custom-siren',
        criticalHseCustomAudioName: fileName || 'custom_siren.mp3',
        criticalHseCustomAudioSize: fileSize || buffer.length,
      });
    }

    return res.json({
      success: true,
      audioUrl: '/api/v1/notifications/custom-siren',
      fileName: fileName || 'custom_siren.mp3',
      fileSize: fileSize || buffer.length,
    });
  }

  async deleteCustomSiren(req: Request, res: Response) {
    const filePath = path.resolve(process.cwd(), 'public/assets/custom-siren.mp3');
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
    const userId = req.user?.uid;
    if (userId) {
      await notificationService.saveUserPreferences(userId, {
        criticalHseAudioMode: 'default_synth',
        criticalHseCustomAudioUrl: undefined,
        criticalHseCustomAudioName: undefined,
        criticalHseCustomAudioSize: undefined,
      });
    }
    return res.json({ success: true, message: 'Custom siren reset to default.' });
  }

  async getPublicActiveEmergencies(req: Request, res: Response) {
    const since = typeof req.query.since === 'string' ? req.query.since : undefined;
    const clientSessionId =
      typeof req.query.clientSessionId === 'string' ? req.query.clientSessionId : undefined;
    const list = await notificationService.getPublicActiveEmergencies(since, clientSessionId);
    return res.json({
      success: true,
      data: list,
      count: list.length,
      serverTime: new Date().toISOString(),
    });
  }

  async acknowledgePublic(req: Request, res: Response) {
    const { notifId, clientSessionId, note, userId, userName, acknowledgmentSource } = req.body || {};
    if (!notifId) {
      return res.status(400).json({ success: false, error: 'شناسه هشدار الزامی است.' });
    }
    const ip = req.ip || (req.socket as any)?.remoteAddress || 'unknown';

    // If userId was provided (e.g. from Service Worker action or stored session), record under that userId
    if (userId && String(userId).trim()) {
      const success = await notificationService.acknowledge(
        String(notifId),
        String(userId).trim(),
        userName ? String(userName).trim() : String(userId).trim(),
        note ? String(note).slice(0, 300) : undefined,
        {
          acknowledgmentSource: acknowledgmentSource || 'os_notification_action',
          clientIp: ip,
        }
      );
      return res.json({
        success,
        message: 'تأییدیه دریافت هشدار فوری HSE و توقف آژیر با موفقیت در پایگاه داده ثبت گردید.',
      });
    }

    const success = await notificationService.acknowledgePublic(
      String(notifId),
      clientSessionId,
      note,
      ip,
      acknowledgmentSource
    );
    return res.json({
      success,
      message: 'تأییدیه دریافت هشدار فوری HSE با موفقیت در پایگاه داده ثبت گردید.',
    });
  }
}

export const notificationController = new NotificationController();

