import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';
import {
  notificationRepository,
  detectUnitManagerFromProfile,
  detectHseExpertFromProfile,
} from './notification.repository.ts';
import {
  NotificationRecord,
  NotificationCategory,
  NotificationPriority,
  NotificationType,
  TargetAudienceType,
  DevicePlatformType,
  PushDeliveryDeviceLog,
  NotificationDeliveryReport,
  NotificationViewConfirmation,
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

function parseUserAgentMetadata(uaRaw?: string, platformRaw?: string): {
  deviceType: DevicePlatformType;
  browserName: string;
  osName: string;
  defaultDeviceName: string;
} {
  const ua = String(uaRaw || '');
  const plat = String(platformRaw || '');

  let osName = 'سیستم‌عامل';
  if (/windows/i.test(ua)) osName = 'Windows';
  else if (/android/i.test(ua)) osName = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) osName = 'iOS';
  else if (/macintosh|mac os x/i.test(ua)) osName = 'macOS';
  else if (/linux/i.test(ua)) osName = 'Linux';

  let browserName = 'مرورگر';
  if (/edg\//i.test(ua)) browserName = 'Microsoft Edge';
  else if (/opr\/|opera/i.test(ua)) browserName = 'Opera';
  else if (/chrome|crios/i.test(ua)) browserName = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browserName = 'Mozilla Firefox';
  else if (/safari/i.test(ua)) browserName = 'Apple Safari';

  let deviceType: DevicePlatformType = 'desktop';
  if (/ipad|tablet/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|android|iphone|ipod/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/macintosh/i.test(ua) || /laptop/i.test(plat)) {
    deviceType = 'laptop';
  }

  const typeLabelFa =
    deviceType === 'mobile'
      ? 'تلفن همراه'
      : deviceType === 'tablet'
      ? 'تبلت'
      : deviceType === 'laptop'
      ? 'لپ‌تاپ'
      : 'کامپیوتر';

  return {
    deviceType,
    browserName,
    osName,
    defaultDeviceName: `${typeLabelFa} (${osName} - ${browserName})`,
  };
}

function getEndpointDomain(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return 'push-service';
  }
}

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
    jobTitle?: string;
    departmentIds?: string[];
    departmentName?: string;
    isUnitManager?: boolean;
    isHseExpert?: boolean;
    deviceType?: DevicePlatformType;
    deviceName?: string;
    browserName?: string;
    osName?: string;
    guestSessionId?: string;
    userAgent?: string;
    platform?: string;
  }): Promise<WebPushSubscriptionRecord> {
    await this.ensureVapidKeys();
    const uaMeta = parseUserAgentMetadata(payload.userAgent, payload.platform);
    const finalDeviceType = payload.deviceType || uaMeta.deviceType;
    const finalBrowserName = payload.browserName || uaMeta.browserName;
    const finalOsName = payload.osName || uaMeta.osName;
    const finalDeviceName =
      payload.deviceName && payload.deviceName.trim()
        ? payload.deviceName.trim()
        : uaMeta.defaultDeviceName;

    return notificationRepository.upsertPushSubscription({
      ...payload,
      deviceType: finalDeviceType,
      deviceName: finalDeviceName,
      browserName: finalBrowserName,
      osName: finalOsName,
    });
  }

  async getPushSubscriptions(userId?: string, isAdmin = false): Promise<Array<Omit<WebPushSubscriptionRecord, 'keys'> & { endpointDomain: string }>> {
    const allSubs = await notificationRepository.getAllPushSubscriptions();
    const filtered = isAdmin
      ? allSubs
      : userId
      ? allSubs.filter((s) => s.userId && s.userId.toLowerCase() === userId.toLowerCase())
      : [];

    return filtered.map((s) => {
      const { keys: _keys, ...rest } = s;
      return {
        ...rest,
        endpointDomain: getEndpointDomain(s.endpoint),
      };
    });
  }

  async unregisterPushSubscription(idOrEndpoint: string, requestingUserId?: string, isAdmin = true): Promise<boolean> {
    return notificationRepository.removePushSubscription(idOrEndpoint, requestingUserId, isAdmin);
  }

  async getAllNotifications(userIdOrIds?: string | string[]): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
    const list = await notificationRepository.getAll(userIdOrIds);
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
    targetType?: TargetAudienceType;
    targetValues?: string[];
    sender?: string;
    entityType?: string;
    entityId?: string;
    link?: string;
    requiresAck?: boolean;
    sirenType?: string;
    actionGuidelines?: string;
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

    const generatedNotifId = `notif-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const defaultDeepLink = `#notifications?alertId=${encodeURIComponent(generatedNotifId)}`;
    const resolvedActionUrl =
      data.actionUrl ||
      data.link ||
      (data.entityType === 'WORK_PERMIT'
        ? `#permit?id=${data.entityId || ''}&alertId=${encodeURIComponent(generatedNotifId)}`
        : defaultDeepLink);

    const isSimultaneousPopupAndPush =
      data.type === 'popup_and_push' ||
      data.type === 'popup' ||
      data.type === 'push' ||
      data.metadata?.sendBrowserPush !== false;

    const record: NotificationRecord = {
      notifId: generatedNotifId,
      title: String(data.title || '').trim(),
      body: String(data.body || '').trim(),
      type: data.type || (category === 'critical_hse' || priority === 'critical' ? 'popup_and_push' : 'popup'),
      category,
      priority,
      sourceModule: data.sourceModule || (data.entityType ? String(data.entityType).toLowerCase() : 'system'),
      actionUrl: resolvedActionUrl,
      recordId: data.recordId || data.entityId || generatedNotifId,
      targetType: data.targetType || 'all',
      targetValues: data.targetValues || [],
      sender: data.sender || 'سامانه جامع HSECORE',
      entityType: data.entityType,
      entityId: data.entityId,
      link: resolvedActionUrl,
      requiresAck: data.requiresAck !== undefined ? data.requiresAck : (priority === 'critical' || category === 'critical_hse'),
      acknowledgedBy: [],
      viewedBy: [],
      sirenType: siren,
      metadata: {
        ...(data.metadata || {}),
        sirenType: siren,
        simultaneousPopupAndPush: isSimultaneousPopupAndPush,
        ...(actionGuidelines ? { actionGuidelines } : {}),
      },
      read: false,
      readBy: [],
      createdAt: new Date().toISOString(),
    };

    const saved = await notificationRepository.create(record);

    // 1. Dedicated WebSocket Notification Alert event (Simultaneous In-App Popup)
    try {
      socketService.broadcast('notification_alert', saved);
    } catch (err: any) {
      logger.warn('Socket notification broadcast warning:', { error: err?.message });
    }

    // 1.1 Dedicated Public Emergency Alert Broadcast (for login screen and unauthenticated clients)
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
      actionUrl: saved.actionUrl || `/#notifications?alertId=${encodeURIComponent(saved.notifId)}`,
      requiresAck: Boolean(saved.requiresAck),
      type: saved.type || 'popup_and_push',
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

    // 4. Simultaneous Native OS Browser Web Push Dispatch (Service Worker / Lock Screen / Background / Closed Browser)
    if (
      isSimultaneousPopupAndPush ||
      isPublicEmergency ||
      saved.priority === 'critical' ||
      saved.priority === 'high'
    ) {
      const deliveryReport = await this.dispatchWebPushToSubscribers(
        saved,
        sanitizedPublicPayload,
        isPublicEmergency
      );
      saved.deliveryReport = deliveryReport;
      saved.metadata = {
        ...(saved.metadata || {}),
        deliveryReport,
      };
    }

    return saved;
  }

  /**
   * Dispatches encrypted RFC 8030 Web Push messages to subscribed browsers & PWAs.
   * Records a full Delivery Report (status, Push Service HTTP response, errors) per device.
   */
  private async dispatchWebPushToSubscribers(
    fullRecord: NotificationRecord,
    sanitizedPublicPayload: Record<string, any>,
    isPublicEmergency: boolean
  ): Promise<NotificationDeliveryReport> {
    const report: NotificationDeliveryReport = {
      dispatchedAt: new Date().toISOString(),
      simultaneousPopupAndPush: true,
      inAppBroadcasted: true,
      totalTargetedDevices: 0,
      pushDeliveredCount: 0,
      pushFailedCount: 0,
      expiredRemovedCount: 0,
      deviceLogs: [],
    };

    try {
      await this.ensureVapidKeys();
      const subs = await notificationRepository.getAllPushSubscriptions();
      if (!subs || subs.length === 0) {
        await notificationRepository.updateDeliveryReport(fullRecord.notifId, report);
        return report;
      }

      const usersMap = await notificationRepository.getUsersDirectorySnapshot();
      const targetType: TargetAudienceType = fullRecord.targetType || 'all';
      const targetValues = (fullRecord.targetValues || []).map((v) => String(v).trim().toLowerCase());

      // Deep-link URL so clicking the OS notification opens the exact target route/report or Alert Details page
      const deepLinkUrl =
        fullRecord.actionUrl &&
        (fullRecord.actionUrl.includes('alertId=') || fullRecord.actionUrl.includes('report=') || fullRecord.actionUrl.startsWith('#'))
          ? fullRecord.actionUrl
          : `/#notifications?alertId=${encodeURIComponent(fullRecord.notifId)}`;

      const pushPayloadString = JSON.stringify({
        notifId: sanitizedPublicPayload.notifId,
        title: sanitizedPublicPayload.title,
        body: sanitizedPublicPayload.body,
        priority: sanitizedPublicPayload.priority,
        riskLevelFa: sanitizedPublicPayload.riskLevelFa,
        category: sanitizedPublicPayload.category,
        sourceModule: fullRecord.sourceModule || 'system',
        sirenType: sanitizedPublicPayload.sirenType,
        actionGuidelines: sanitizedPublicPayload.actionGuidelines,
        requiresAck: Boolean(fullRecord.requiresAck),
        createdAt: sanitizedPublicPayload.createdAt,
        actionUrl: deepLinkUrl,
      });

      const isCritical = fullRecord.category === 'critical_hse' || fullRecord.priority === 'critical';

      // Filter subscriptions matching targeted audience
      const targetedSubs = subs.filter((sub) => {
        if (isPublicEmergency || targetType === 'all') return true;
        if (!sub.userId) return false;

        const uidLower = sub.userId.toLowerCase();
        const unameLower = (sub.userName || '').toLowerCase();
        const userEntry = usersMap.get(uidLower) || usersMap.get(unameLower);

        const effectiveRole = (userEntry?.role || sub.role || '').toLowerCase();
        const effectiveJobTitle = userEntry?.jobTitle || sub.jobTitle || '';
        const effectiveDeptIds = (
          userEntry?.departmentIds && userEntry.departmentIds.length > 0
            ? userEntry.departmentIds
            : sub.departmentIds || []
        ).map((d) => String(d).toLowerCase());
        const effectiveDeptName = (userEntry?.departmentName || sub.departmentName || '').toLowerCase();

        if (targetType === 'departments') {
          if (targetValues.length === 0) return true;
          return targetValues.some(
            (tv) =>
              effectiveDeptIds.includes(tv) ||
              (effectiveDeptName && effectiveDeptName.includes(tv))
          );
        }

        if (targetType === 'unit_managers') {
          return Boolean(
            userEntry?.isUnitManager ||
              sub.isUnitManager ||
              detectUnitManagerFromProfile(effectiveRole, effectiveJobTitle)
          );
        }

        if (targetType === 'hse_experts') {
          return Boolean(
            userEntry?.isHseExpert ||
              sub.isHseExpert ||
              detectHseExpertFromProfile(effectiveRole, effectiveJobTitle, effectiveDeptName)
          );
        }

        if (targetType === 'roles') {
          if (targetValues.length === 0) return true;
          return targetValues.includes(effectiveRole);
        }

        if (targetType === 'users' || targetType === 'single' || targetType === 'user') {
          if (targetValues.length === 0) return true;
          return (
            targetValues.includes(uidLower) ||
            (unameLower && targetValues.includes(unameLower)) ||
            (userEntry?.username && targetValues.includes(userEntry.username.toLowerCase())) ||
            (userEntry?.personnelCode && targetValues.includes(userEntry.personnelCode.toLowerCase())) ||
            (userEntry?.fullName && targetValues.includes(userEntry.fullName.trim().toLowerCase()))
          );
        }

        return true;
      });

      report.totalTargetedDevices = targetedSubs.length;

      await Promise.allSettled(
        targetedSubs.map(async (sub) => {
          const nowIso = new Date().toISOString();
          const domain = getEndpointDomain(sub.endpoint);
          const uidLower = (sub.userId || '').toLowerCase();
          const userEntry = uidLower ? usersMap.get(uidLower) : undefined;

          try {
            const sendResult = await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys,
              },
              pushPayloadString,
              {
                TTL: isCritical ? 86400 : 14400,
                urgency: isCritical ? 'high' : 'normal',
                topic: String(fullRecord.notifId).slice(0, 32),
                timeout: 6000,
              }
            );

            const statusCode = sendResult?.statusCode || 201;
            report.pushDeliveredCount += 1;

            const logItem: PushDeliveryDeviceLog = {
              subscriptionId: sub.id,
              userId: sub.userId || 'guest',
              userName: userEntry?.fullName || sub.userName || 'کاربر دستگاه',
              role: userEntry?.role || sub.role,
              department: userEntry?.departmentName || sub.departmentName,
              deviceType: sub.deviceType || 'desktop',
              deviceName: sub.deviceName || `${sub.platform || 'دستگاه'} (${domain})`,
              endpointDomain: domain,
              status: 'delivered',
              statusCode,
              pushServiceResponse: `${statusCode} Created — تحویل موفق به سرویس Push مرورگر (${domain})`,
              timestamp: nowIso,
            };
            report.deviceLogs.push(logItem);

            await notificationRepository.updatePushSubscriptionStatus(sub.endpoint, {
              lastSuccessAt: nowIso,
              lastStatusCode: statusCode,
              lastError: undefined,
            });
          } catch (pushErr: any) {
            const statusCode = pushErr?.statusCode || 500;
            const errBody = String(pushErr?.body || pushErr?.message || 'خطا در ارسال به سرویس Push').slice(0, 220);

            if (statusCode === 404 || statusCode === 410) {
              report.expiredRemovedCount += 1;
              report.pushFailedCount += 1;
              report.deviceLogs.push({
                subscriptionId: sub.id,
                userId: sub.userId || 'guest',
                userName: userEntry?.fullName || sub.userName || 'کاربر دستگاه',
                role: userEntry?.role || sub.role,
                department: userEntry?.departmentName || sub.departmentName,
                deviceType: sub.deviceType || 'desktop',
                deviceName: sub.deviceName || domain,
                endpointDomain: domain,
                status: 'expired_removed',
                statusCode,
                pushServiceResponse: `${statusCode} Gone — اشتراک منقضی یا لغوشده در مرورگر`,
                errorMessage: errBody,
                timestamp: nowIso,
              });
              await notificationRepository.removePushSubscription(sub.endpoint);
            } else {
              report.pushFailedCount += 1;
              report.deviceLogs.push({
                subscriptionId: sub.id,
                userId: sub.userId || 'guest',
                userName: userEntry?.fullName || sub.userName || 'کاربر دستگاه',
                role: userEntry?.role || sub.role,
                department: userEntry?.departmentName || sub.departmentName,
                deviceType: sub.deviceType || 'desktop',
                deviceName: sub.deviceName || domain,
                endpointDomain: domain,
                status: 'failed',
                statusCode,
                pushServiceResponse: `خطای سرویس Push (کد ${statusCode})`,
                errorMessage: errBody,
                timestamp: nowIso,
              });
              await notificationRepository.updatePushSubscriptionStatus(sub.endpoint, {
                lastFailureAt: nowIso,
                lastStatusCode: statusCode,
                lastError: errBody,
              });
            }
          }
        })
      );

      await notificationRepository.updateDeliveryReport(fullRecord.notifId, report);
      broadcastDataMutation('notifications', 'delivery_report_updated', {
        notifId: fullRecord.notifId,
        deliveryReport: report,
      });
      this.broadcastSSE('notification_delivery_report', {
        notifId: fullRecord.notifId,
        deliveryReport: report,
      });
    } catch (err) {
      logger.debug('Web Push dispatch error:', err);
    }

    return report;
  }

  async confirmAlertViewed(
    idOrNotifId: string | number,
    payload: {
      userId?: string;
      userName?: string;
      clientSessionId?: string;
      source?: 'browser_push_click' | 'in_app_popup' | 'alert_details_view' | string;
      deviceType?: DevicePlatformType;
      deviceInfo?: string;
      clientIp?: string;
    }
  ): Promise<boolean> {
    const viewEntry: NotificationViewConfirmation = {
      userId: payload.userId || payload.clientSessionId || 'guest',
      userName: payload.userName || payload.userId || 'کاربر سیستم',
      clientSessionId: payload.clientSessionId,
      source: (payload.source as any) || 'in_app_popup',
      deviceType: payload.deviceType,
      deviceInfo: payload.deviceInfo,
      clientIp: payload.clientIp,
      timestamp: new Date().toISOString(),
    };

    const ok = await notificationRepository.recordViewConfirmation(idOrNotifId, viewEntry);
    broadcastDataMutation('notifications', 'view_confirmed', {
      id: idOrNotifId,
      viewEntry,
    });
    this.broadcastSSE('notification_viewed', {
      id: idOrNotifId,
      viewEntry,
    });
    return ok;
  }

  async getPublicActiveEmergencies(sinceIso?: string, clientSessionId?: string) {
    return notificationRepository.getPublicActiveEmergencies(sinceIso, clientSessionId);
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

  async markRead(idOrNotifId: string | number, userId?: string, clientSessionId?: string): Promise<boolean> {
    const success = await notificationRepository.markRead(idOrNotifId, userId, clientSessionId);
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
      clientSessionId?: string;
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

