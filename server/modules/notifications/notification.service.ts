import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { notificationRepository } from './notification.repository.ts';
import {
  NotificationRecord,
  NotificationCategory,
  NotificationPriority,
  NotificationType,
  UserNotificationPreferences,
} from './notification.types.ts';
import { logger } from '../../core/logger.ts';
import { socketService, broadcastDataMutation } from '../../core/socket.ts';

// Server-Sent Events active client listeners
interface SSEClient {
  id: string;
  res: Response;
  userId?: string;
  role?: string;
}

const sseClients = new Map<string, SSEClient>();

export class NotificationService {
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

    const record: NotificationRecord = {
      notifId: `notif-${Date.now()}-${uuidv4().slice(0, 4)}`,
      title: data.title,
      body: data.body,
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
    const isPublicEmergency =
      (saved.category === 'critical_hse' || saved.priority === 'critical') &&
      (saved.targetType === 'all' || !saved.targetType);

    if (isPublicEmergency) {
      const publicPayload = {
        notifId: saved.notifId,
        id: saved.id,
        title: saved.title,
        body: saved.body,
        priority: saved.priority,
        category: saved.category,
        sourceModule: saved.sourceModule,
        sirenType: saved.sirenType,
        actionGuidelines: (saved.metadata as any)?.actionGuidelines || saved.body,
        requiresAck: true,
        type: 'popup',
        createdAt: saved.createdAt,
      };
      try {
        socketService.broadcast('public_emergency_alert', publicPayload);
      } catch (err: any) {
        logger.warn('Socket public emergency broadcast warning:', { error: err?.message });
      }
    }

    // 2. Global Universal Data Mutation event (ensures all tabs and components refresh)
    broadcastDataMutation('notifications', 'create', saved);

    // 3. SSE broadcast
    this.broadcastSSE('notification', saved);

    return saved;
  }

  async getPublicActiveEmergencies() {
    return notificationRepository.getPublicActiveEmergencies();
  }

  async acknowledgePublic(notifId: string, clientSessionId?: string, note?: string, ip?: string): Promise<boolean> {
    const guestId = clientSessionId ? `guest_${clientSessionId.slice(0, 12)}` : `guest_${Date.now().toString(36)}`;
    const guestName = 'کاربر مهمان (صفحه ورود)';
    const guestNote = note ? String(note).slice(0, 300) : 'تأیید دریافت هشدار در صفحه ورود سیستم';

    const success = await notificationRepository.acknowledge(
      notifId,
      guestId,
      `${guestName} [IP: ${ip || 'N/A'}]`,
      guestNote
    );

    broadcastDataMutation('notifications', 'public_acknowledge', { notifId, guestId });
    this.broadcastSSE('public_emergency_acknowledged', { notifId, guestId });
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
    note?: string
  ): Promise<boolean> {
    const success = await notificationRepository.acknowledge(idOrNotifId, userId, userName, note);
    broadcastDataMutation('notifications', 'acknowledge', { id: idOrNotifId, userId, userName, note });
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
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId: id })}\n\n`);

    res.on('close', () => {
      sseClients.delete(id);
      logger.debug(`SSE Client disconnected: ${id}. Remaining: ${sseClients.size}`);
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
}

export const notificationService = new NotificationService();
