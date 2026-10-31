import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';
import { notificationRepository } from './notification.repository.ts';
import {
  NotificationRecord,
  NotificationCategory,
  NotificationPriority,
  NotificationType,
  UserNotificationPreferences,
  WebPushSubscriptionRecord,
  VapidKeySet,
} from './notification.types.ts';
import { logger } from '../../core/logger.ts';
import { socketService, broadcastDataMutation } from '../../core/socket.ts';

// Server-Sent Events active client listeners (authenticated)
interface SSEClient {
  id: string;
  res: Response;
  userId?: string;
  role?: string;
}

const sseClients = new Map<string, SSEClient>();
// Public SSE clients (Login Screen / unauthenticated emergency listeners)
const publicSseClients = new Map<string, Response>();

let vapidInitialized = false;
let activeVapidKeys: VapidKeySet | null = null;

export class NotificationService {
  async ensureVapidKeys(): Promise<VapidKeySet> {
    if (vapidInitialized && activeVapidKeys) {
      return activeVapidKeys;
    }

    let stored = await notificationRepository.getVapidKeys();
    if (!stored || !stored.publicKey || !stored.privateKey) {
      const generated = webpush.generateVAPIDKeys();
      stored = await notificationRepository.saveVapidKeys({
        publicKey: process.env.VAPID_PUBLIC_KEY || generated.publicKey,
        privateKey: process.env.VAPID_PRIVATE_KEY || generated.privateKey,
        subject: process.env.VAPID_SUBJECT || 'mailto:hse-emergency@hsecore.enterprise.local',
        createdAt: new Date().toISOString(),
      });
    }

    try {
      webpush.setVapidDetails(
        stored.subject || 'mailto:hse-emergency@hsecore.enterprise.local',
        stored.publicKey,
        stored.privateKey
      );
      vapidInitialized = true;
      activeVapidKeys = stored;
    } catch (err) {
      logger.warn('Failed to initialize VAPID details:', err);
    }

    return stored;
  }

  async getVapidPublicKey(): Promise<{ publicKey: string; pushEnabled: boolean; activeSubscriptions: number }> {
    const keys = await this.ensureVapidKeys();
    const subs = await notificationRepository.getAllPushSubscriptions();
    return {
      publicKey: keys.publicKey,
      pushEnabled: Boolean(keys.publicKey),
      activeSubscriptions: subs.length,
    };
  }

  async registerPushSubscription(payload: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userId?: string;
    userName?: string;
    role?: string;
    departmentIds?: string[];
    guestSessionId?: string;
    userAgent?: string;
    platform?: string;
  }): Promise<WebPushSubscriptionRecord> {
    await this.ensureVapidKeys();
    return notificationRepository.upsertPushSubscription(payload);
  }

  async unregisterPushSubscription(endpoint: string): Promise<boolean> {
    return notificationRepository.removePushSubscription(endpoint);
  }

  async getAllNotifications(userId?: string): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    const list = await notificationRepository.getAll(userId);
    const unreadCount = list.filter((n) => !n.read).length;
    return { notifications: list, unreadCount };
  }

  async getById(id: string | number): Promise<NotificationRecord | null> {
    return notificationRepository.getById(id);
  }

  async send(data: {
    title: string;
    body: string;
    type?: NotificationType | string;
    category?: NotificationCategory;
    priority?: NotificationPriority;
    sourceModule?: string;
    actionUrl?: string;
    recordId?: string;
    targetType?: 'all' | 'roles' | 'departments' | 'user' | 'single';
    targetValues?: string[];
    sender?: string;
    entityType?: string;
    entityId?: string;
    link?: string;
    requiresAck?: boolean;
    sirenType?: string;
    metadata?: Record<string, any>;
  }): Promise<NotificationRecord> {
    // Determine priority and category intelligently if omitted
    const category: NotificationCategory = data.category || (
      data.type === 'SYSTEM_ALERT' ? 'warning' :
      data.priority === 'critical' ? 'critical_hse' :
      data.type === 'APPROVAL' || data.type === 'WORKFLOW_COMPLETED' ? 'success' :
      data.type === 'REJECTION' ? 'error' : 'info'
    );

    const priority: NotificationPriority = data.priority || (
      category === 'critical_hse' ? 'critical' :
      data.type === 'REFERRAL' ? 'high' :
      category === 'warning' ? 'high' :
      category === 'error' ? 'high' : 'medium'
    );

    const siren = data.sirenType || data.metadata?.sirenType || (priority === 'critical' || category === 'critical_hse' ? 'siren_evacuation' : undefined);
    const actionGuidelines =
      data.metadata?.actionGuidelines ||
      (category === 'critical_hse' || priority === 'critical'
        ? data.body
        : undefined);

    const record: NotificationRecord = {
      notifId: `notif-${Date.now()}-${uuidv4().slice(0, 6)}`,
      title: String(data.title || '').trim(),
      body: String(data.body || '').trim(),
      type: data.type || (category === 'critical_hse' || priority === 'critical' ? 'popup' : 'in-app'),
      category,
      priority,
      sourceModule: data.sourceModule || (data.entityType ? String(data.entityType).toLowerCase() : 'system'),
      actionUrl: data.actionUrl || data.link || (data.entityType === 'WORK_PERMIT' ? `#permit?id=${data.entityId || ''}` : undefined),
      recordId: data.recordId || data.entityId,
      targetType: data.targetType || 'all',
      targetValues: data.targetValues || [],
      sender: data.sender || 'سامانه جامع HSECORE',
      entityType: data.entityType,
      entityId: data.entityId,
      link: data.link || data.actionUrl,
      requiresAck: data.requiresAck !== undefined ? data.requiresAck : (priority === 'critical' || category === 'critical_hse'),
      acknowledgedBy: [],
      sirenType: siren,
      metadata: {
        ...(data.metadata || {}),
        sirenType: siren,
        ...(actionGuidelines ? { actionGuidelines } : {}),
      },
      read: false,
      readBy: [],
      createdAt: new Date().toISOString(),
    };

    const saved = await notificationRepository.create(record);

    // 1. Dedicated WebSocket Notification Alert event
    try {
      socketService.broadcast('notification_alert', saved);
    } catch (err: any) {
      logger.warn('Socket notification broadcast warning:', { error: err?.message });
    }

    // 1.1 Dedicated Public Emergency Alert Broadcast (for login screen and unauthenticated clients)
    // Strictly sanitized: NO confidential user records, NO internal IDs or private notes
    const isPublicEmergency =
      (saved.category === 'critical_hse' || saved.priority === 'critical') &&
      (saved.targetType === 'all' || !saved.targetType);

    const sanitizedPublicPayload = {
      notifId: saved.notifId,
      id: saved.id,
      title: saved.title,
      body: saved.body,
      priority: saved.priority,
      riskLevelFa:
        saved.priority === 'critical' || saved.category === 'critical_hse'
          ? 'بحرانی (سطح ۱ اضطراری)'
          : 'فوری (سطح ۲)',
      category: saved.category,
      sourceModule: saved.sourceModule || 'emergency',
      sirenType: saved.sirenType || 'siren_evacuation',
      actionGuidelines: (saved.metadata as any)?.actionGuidelines || saved.body,
      requiresAck: true,
      type: 'popup',
      createdAt: saved.createdAt,
    };

    if (isPublicEmergency) {
      try {
        socketService.broadcast('public_emergency_alert', sanitizedPublicPayload);
      } catch (err: any) {
        logger.warn('Socket public emergency broadcast warning:', { error: err?.message });
      }
      this.broadcastPublicSSE('public_emergency_alert', sanitizedPublicPayload);
    }

    // 2. Global Universal Data Mutation event (ensures all tabs and components refresh)
    broadcastDataMutation('notifications', 'create', saved);

    // 3. Authenticated SSE broadcast
    this.broadcastSSE('notification', saved);

    // 4. Native OS Web Push Dispatch (Service Worker / Lock Screen / Background / Closed Browser)
    if (isPublicEmergency || saved.type === 'push' || saved.type === 'popup' || saved.priority === 'critical' || saved.priority === 'high') {
      void this.dispatchWebPushToSubscribers(saved, sanitizedPublicPayload, isPublicEmergency);
    }

    return saved;
  }

  /**
   * Dispatches encrypted RFC 8030 Web Push messages to subscribed browsers & PWAs.
   * Ensures lock-screen privacy by stripping confidential fields.
   */
  private async dispatchWebPushToSubscribers(
    fullRecord: NotificationRecord,
    sanitizedPublicPayload: Record<string, any>,
    isPublicEmergency: boolean
  ): Promise<void> {
    try {
      await this.ensureVapidKeys();
      const subs = await notificationRepository.getAllPushSubscriptions();
      if (!subs || subs.length === 0) return;

      const targetType = fullRecord.targetType || 'all';
      const targetValues = (fullRecord.targetValues || []).map((v) => String(v).toLowerCase());

      // Lock-screen safe payload (no confidential personnel or internal administrative fields)
      const pushPayloadString = JSON.stringify({
        notifId: sanitizedPublicPayload.notifId,
        title: sanitizedPublicPayload.title,
        body: sanitizedPublicPayload.body,
        priority: sanitizedPublicPayload.priority,
        riskLevelFa: sanitizedPublicPayload.riskLevelFa,
        category: sanitizedPublicPayload.category,
        sirenType: sanitizedPublicPayload.sirenType,
        actionGuidelines: sanitizedPublicPayload.actionGuidelines,
        requiresAck: Boolean(fullRecord.requiresAck),
        createdAt: sanitizedPublicPayload.createdAt,
        actionUrl: '/',
      });

      const isCritical = fullRecord.category === 'critical_hse' || fullRecord.priority === 'critical';

      await Promise.allSettled(
        subs.map(async (sub) => {
          // Filter audience if not a public/global alert
          if (!isPublicEmergency && targetType !== 'all') {
            if (!sub.userId) return; // Unauthenticated device cannot receive non-public targeted notifications
            if (targetType === 'roles' && sub.role && !targetValues.includes(sub.role.toLowerCase())) {
              return;
            }
            if ((targetType === 'single' || targetType === 'user') && !targetValues.includes(sub.userId.toLowerCase())) {
              return;
            }
          }

          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys,
              },
              pushPayloadString,
              {
                TTL: isCritical ? 86400 : 14400,
                urgency: isCritical ? 'high' : 'normal',
                topic: String(fullRecord.notifId).slice(0, 32),
              }
            );
          } catch (pushErr: any) {
            const statusCode = pushErr?.statusCode;
            if (statusCode === 404 || statusCode === 410) {
              // Subscription expired or revoked by user/OS -> prune from DB
              await notificationRepository.removePushSubscription(sub.endpoint);
            } else {
              logger.debug('Web Push delivery warning:', { statusCode, message: pushErr?.message });
            }
          }
        })
      );
    } catch (err) {
      logger.debug('Web Push dispatch error:', err);
    }
  }

  async getPublicActiveEmergencies(sinceIso?: string) {
    return notificationRepository.getPublicActiveEmergencies(sinceIso);
  }

  async acknowledgePublic(
    notifId: string,
    clientSessionId?: string,
    note?: string,
    ip?: string,
    acknowledgmentSource?: string
  ): Promise<boolean> {
    const guestId = clientSessionId ? `guest_${clientSessionId.slice(0, 24)}` : `guest_${Date.now().toString(36)}`;
    const sourceLabel =
      acknowledgmentSource === 'os_notification_action'
        ? 'اعلان سیستمی / صفحه قفل'
        : 'صفحه ورود (بدون ورود به حساب)';
    const guestName = `کاربر (${sourceLabel})`;
    const guestNote = note
      ? String(note).slice(0, 300)
      : `تأیید دریافت هشدار فوری HSE و توقف آژیر از طریق ${sourceLabel}`;

    const success = await notificationRepository.acknowledge(
      notifId,
      guestId,
      `${guestName} [IP: ${ip || 'N/A'}]`,
      guestNote,
      {
        acknowledgmentSource: acknowledgmentSource || 'login_screen',
        clientIp: ip,
      }
    );

    broadcastDataMutation('notifications', 'public_acknowledge', { notifId, guestId, acknowledgmentSource });
    this.broadcastSSE('public_emergency_acknowledged', { notifId, guestId, acknowledgmentSource });
    this.broadcastPublicSSE('public_emergency_acknowledged', { notifId, guestId, acknowledgmentSource });
    return success;
  }

  async markRead(idOrNotifId: string | number, userId?: string): Promise<boolean> {
    const success = await notificationRepository.markRead(idOrNotifId, userId);
    broadcastDataMutation('notifications', 'mark_single_read', { id: idOrNotifId, userId });
    this.broadcastSSE('mark_read', { id: idOrNotifId, userId });
    return success;
  }

  async acknowledge(
    idOrNotifId: string | number,
    userId: string,
    userName?: string,
    note?: string,
    extra?: {
      acknowledgmentSource?: string;
      clientIp?: string;
    }
  ): Promise<boolean> {
    const success = await notificationRepository.acknowledge(idOrNotifId, userId, userName, note, extra);
    broadcastDataMutation('notifications', 'acknowledge', {
      id: idOrNotifId,
      userId,
      userName,
      note,
      acknowledgmentSource: extra?.acknowledgmentSource,
    });
    this.broadcastSSE('notification_acknowledged', { id: idOrNotifId, userId, userName });
    return success;
  }

  async deleteNotification(idOrNotifId: string | number): Promise<boolean> {
    const success = await notificationRepository.delete(idOrNotifId);
    broadcastDataMutation('notifications', 'delete', { id: idOrNotifId });
    this.broadcastSSE('delete_notification', { id: idOrNotifId });
    return success;
  }

  async clearAllNotifications(): Promise<boolean> {
    const success = await notificationRepository.clearAll();
    broadcastDataMutation('notifications', 'clear_all', {});
    this.broadcastSSE('clear_all_notifications', {});
    return success;
  }

  async markAllRead(userId?: string): Promise<void> {
    await notificationRepository.markAllRead(userId);
    broadcastDataMutation('notifications', 'mark_read', { uid: userId });
    this.broadcastSSE('mark_all_read', { userId });
  }

  async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    return notificationRepository.getUserPreferences(userId);
  }

  async saveUserPreferences(
    userId: string,
    prefs: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    return notificationRepository.saveUserPreferences(userId, prefs);
  }

  registerSSEClient(id: string, res: Response, userId?: string, role?: string): void {
    sseClients.set(id, { id, res, userId, role });
    logger.debug(`SSE Client registered: ${id}. Total active: ${sseClients.size}`);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId: id })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);

    res.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(id);
      logger.debug(`SSE Client disconnected: ${id}. Remaining: ${sseClients.size}`);
    });
  }

  registerPublicSSEClient(id: string, res: Response): void {
    publicSseClients.set(id, res);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId: id, mode: 'public_emergency' })}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 25000);

    res.on('close', () => {
      clearInterval(keepAlive);
      publicSseClients.delete(id);
    });
  }

  broadcastSSE(event: string, payload: any): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const [id, client] of sseClients.entries()) {
      try {
        client.res.write(message);
      } catch (err) {
        sseClients.delete(id);
      }
    }
  }

  broadcastPublicSSE(event: string, payload: any): void {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const [id, res] of publicSseClients.entries()) {
      try {
        res.write(message);
      } catch {
        publicSseClients.delete(id);
      }
    }
  }
}

export const notificationService = new NotificationService();

