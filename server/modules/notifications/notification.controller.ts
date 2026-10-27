import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { notificationService } from './notification.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { broadcastDataMutation } from '../../core/socket.ts';

export class NotificationController {
  async getNotifications(req: Request, res: Response) {
    const userId = req.user?.uid;
    const { notifications, unreadCount } = await notificationService.getAllNotifications(userId);

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
    const { title, body, priority, category, sourceModule, actionUrl, recordId, targetType, targetValues, requiresAck, sirenType, metadata } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'عنوان و متن اعلان الزامی است.' });
    }

    const user = req.user as any;
    const senderName = user?.fullName || user?.username || 'سامانه جامع HSECORE';

    const finalSiren = sirenType || metadata?.sirenType;

    const created = await notificationService.send({
      title,
      body,
      priority,
      category,
      sourceModule: sourceModule || 'system',
      actionUrl,
      recordId,
      targetType: targetType || 'all',
      targetValues: targetValues || [],
      sender: senderName,
      requiresAck,
      sirenType: finalSiren,
      metadata: {
        ...(metadata || {}),
        sirenType: finalSiren,
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
    await notificationService.markRead(id, userId);
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

    await notificationService.acknowledge(id, userId, userName, note);
    return res.json({ success: true, message: 'اعلان با موفقیت توسط شما تأیید گردید.' });
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
    const { type, category, priority } = req.body;
    const testCategory = category || 'critical_hse';
    const testPriority = priority || 'critical';
    const user = req.user as any;

    const testAlert = await notificationService.send({
      title: 'آزمایش سیستم اعلان و هشدار مرکزی HSE',
      body: 'این یک اعلان آزمایشی جهت بررسی صوت هشدار، افکت‌های بصری و پنجره Popup مرکزی سامانه HSECORE است.',
      category: testCategory,
      priority: testPriority,
      sourceModule: 'system',
      actionUrl: '#dashboard',
      sender: user?.fullName || 'مدیر سیستم',
      requiresAck: testCategory === 'critical_hse',
    });

    return res.json({ success: true, data: testAlert, message: 'اعلان آزمایشی ارسال شد.' });
  }

  streamEvents(req: Request, res: Response) {
    const clientId = `client-${Date.now()}-${uuidv4().slice(0, 6)}`;
    notificationService.registerSSEClient(clientId, res, req.user?.uid, req.user?.role);
  }

  async streamCustomSiren(req: Request, res: Response) {
    const filePath = path.resolve(process.cwd(), 'public/assets/custom-siren.mp3');
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
}

export const notificationController = new NotificationController();
