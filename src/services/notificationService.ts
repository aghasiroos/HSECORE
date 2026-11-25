import { apiDb } from './apiDatabaseClient';
import { playNotificationSound, SoundType, HseSirenType } from '../utils/notificationAudio';

export type NotificationCategory = 'info' | 'success' | 'warning' | 'error' | 'critical_hse';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type TargetAudienceType =
  | 'all'
  | 'departments'
  | 'unit_managers'
  | 'hse_experts'
  | 'users'
  | 'roles'
  | 'user'
  | 'single';

export type DevicePlatformType = 'desktop' | 'laptop' | 'mobile' | 'tablet';

export interface PushDeliveryDeviceLog {
  subscriptionId: string;
  userId?: string;
  userName?: string;
  deviceType?: DevicePlatformType;
  deviceName?: string;
  endpointDomain?: string;
  status: 'delivered' | 'failed' | 'expired';
  statusCode?: number;
  errorMessage?: string;
  timestamp: string;
}

export interface NotificationViewConfirmation {
  userId: string;
  userName?: string;
  timestamp: string;
  source: 'browser_push_click' | 'in_app_popup' | 'alert_details_view' | 'os_notification';
  deviceType?: string;
}

export interface NotificationDeliveryReport {
  dispatchedAt: string;
  inAppPopupDelivered: boolean;
  webPushAttempted: boolean;
  totalTargetedDevices: number;
  pushSentCount: number;
  pushFailedCount: number;
  pushExpiredRemovedCount: number;
  deviceLogs: PushDeliveryDeviceLog[];
}

export interface RegisteredPushDevice {
  id: string;
  endpoint: string;
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
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  lastStatusCode?: number;
}

export interface AppNotification {
  id?: number;
  notifId: string;
  title: string;
  body: string;
  type?: 'in-app' | 'popup' | 'push' | 'popup_and_push' | string;
  category: NotificationCategory;
  priority: NotificationPriority;
  riskLevelFa?: string;
  sourceModule: string;
  actionUrl?: string;
  recordId?: string;
  targetType?: TargetAudienceType;
  targetValues?: string[];
  sender?: string;
  read?: boolean;
  readBy?: string[];
  requiresAck?: boolean;
  acknowledgedBy?: Array<{
    userId: string;
    userName?: string;
    timestamp: string;
    note?: string;
    acknowledgmentSource?: string;
    status?: string;
  }>;
  viewedBy?: NotificationViewConfirmation[];
  deliveryReport?: NotificationDeliveryReport;
  sirenType?: HseSirenType | string;
  actionGuidelines?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPreferences {
  soundEnabled: boolean;
  soundVolume: number; // 0.0 to 1.0
  criticalSoundAlwaysOn: boolean;
  showCenterPopup: 'all' | 'important_and_critical' | 'critical_only' | 'none';
  enabledCategories: {
    info: boolean;
    success: boolean;
    warning: boolean;
    error: boolean;
    critical_hse: boolean;
  };
  // Customization specifically & only for HSE critical alarm:
  criticalHseAudioMode?: 'default_synth' | 'custom_mp3';
  criticalHseCustomAudioUrl?: string; // Base64 data:audio/mp3;base64,... or audio URL
  criticalHseCustomAudioName?: string;
  criticalHseCustomAudioSize?: number;
  lockScreenSirenConfirmed?: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  soundVolume: 0.8,
  criticalSoundAlwaysOn: true,
  showCenterPopup: 'important_and_critical',
  enabledCategories: {
    info: true,
    success: true,
    warning: true,
    error: true,
    critical_hse: true,
  },
  criticalHseAudioMode: 'default_synth',
  lockScreenSirenConfirmed: false,
};

export interface SendNotificationOptions {
  title: string;
  body: string;
  type?: 'in-app' | 'popup' | 'push' | 'popup_and_push';
  category?: NotificationCategory;
  priority?: NotificationPriority;
  sourceModule?: string;
  actionUrl?: string;
  recordId?: string;
  requiresAck?: boolean;
  targetType?: TargetAudienceType;
  targetValues?: string[];
  sender?: string;
  sirenType?: HseSirenType | string;
  actionGuidelines?: string;
  metadata?: Record<string, any>;
  playSound?: boolean;
  triggerPopup?: boolean;
}

export function detectClientDeviceInfo(): {
  deviceType: DevicePlatformType;
  browserName: string;
  osName: string;
  defaultDeviceName: string;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'desktop',
      browserName: 'Browser',
      osName: 'OS',
      defaultDeviceName: 'کامپیوتر رومیزی',
    };
  }
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPod|IEMobile|Opera Mini|Mobile/i.test(ua);
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua);

  let osName = 'Windows';
  if (/Android/i.test(ua)) osName = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) osName = 'iOS';
  else if (isMac) osName = 'macOS';
  else if (/Linux/i.test(ua)) osName = 'Linux';

  let browserName = 'Chrome';
  if (/Edg\//i.test(ua)) browserName = 'Edge';
  else if (/Firefox\//i.test(ua)) browserName = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browserName = 'Safari';

  // Detect laptop vs desktop heuristic (battery API or screen dimensions/MacBook)
  let deviceType: DevicePlatformType = 'desktop';
  if (isTablet) {
    deviceType = 'tablet';
  } else if (isMobile) {
    deviceType = 'mobile';
  } else if (isMac || (window.screen && window.screen.width <= 1600 && window.screen.height <= 1050)) {
    deviceType = 'laptop';
  }

  const labelFa =
    deviceType === 'mobile'
      ? 'تلفن همراه (موبایل)'
      : deviceType === 'tablet'
      ? 'تبلت'
      : deviceType === 'laptop'
      ? 'لپ‌تاپ'
      : 'کامپیوتر رومیزی';

  return {
    deviceType,
    browserName,
    osName,
    defaultDeviceName: `${labelFa} (${browserName} - ${osName})`,
  };
}

export const HSE_NOTIF_CLIENT_SESSION_KEY = 'hse_notif_client_session_v1';
export const HSE_NOTIF_ACKED_IDS_KEY = 'hse_notif_acked_ids_v1';
export const HSE_NOTIF_LOCKSCREEN_CONFIRMED_KEY = 'hse_notif_lockscreen_confirmed_v1';

const MAX_STORED_ACKED_IDS = 500;

let inMemoryGuestSessionId: string | null = null;
const inMemoryPublicAcknowledgedIds = new Set<string>();
const inMemoryConfirmedLockScreenUsers = new Set<string>();

function safeReadStorageArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeWriteStorageArray(key: string, values: Set<string>, maxItems = MAX_STORED_ACKED_IDS): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(values);
    const trimmed = arr.length > maxItems ? arr.slice(arr.length - maxItems) : arr;
    window.localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

export function getOrInitGuestSessionId(): string {
  if (!inMemoryGuestSessionId && typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(HSE_NOTIF_CLIENT_SESSION_KEY);
      if (stored && stored.trim()) {
        inMemoryGuestSessionId = stored.trim();
      }
    } catch {
      // Ignore storage access restrictions
    }
  }
  if (!inMemoryGuestSessionId) {
    inMemoryGuestSessionId = 'sid_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(HSE_NOTIF_CLIENT_SESSION_KEY, inMemoryGuestSessionId);
      } catch {
        // Ignore
      }
    }
  }
  return inMemoryGuestSessionId;
}

export function getPublicAcknowledgedAlertIds(): Set<string> {
  const persisted = safeReadStorageArray(HSE_NOTIF_ACKED_IDS_KEY);
  for (const id of persisted) {
    inMemoryPublicAcknowledgedIds.add(id);
  }
  return new Set(inMemoryPublicAcknowledgedIds);
}

export function markPublicAlertAcknowledgedLocally(
  notifId: string | number,
  extraId?: string | number
): void {
  const persisted = safeReadStorageArray(HSE_NOTIF_ACKED_IDS_KEY);
  for (const existing of persisted) {
    inMemoryPublicAcknowledgedIds.add(existing);
  }
  const primary = String(notifId || '').trim();
  if (primary) inMemoryPublicAcknowledgedIds.add(primary);
  const secondary = extraId !== undefined && extraId !== null ? String(extraId).trim() : '';
  if (secondary) inMemoryPublicAcknowledgedIds.add(secondary);
  safeWriteStorageArray(HSE_NOTIF_ACKED_IDS_KEY, inMemoryPublicAcknowledgedIds);
}

/**
 * Single source of truth: checks whether a notification has already been acknowledged or dismissed
 * by this user or on this browser (survives page refresh, login, logout, and cross-tab actions).
 */
export function isNotificationAcknowledgedOrDismissed(
  notif: AppNotification | null | undefined,
  currentUser?: { id?: string; uid?: string; username?: string; fullName?: string; personnelNumber?: string } | null
): boolean {
  if (!notif) return false;
  const ackedSet = getPublicAcknowledgedAlertIds();
  const notifIdStr = String(notif.notifId || '').trim();
  const numericIdStr = notif.id !== undefined && notif.id !== null ? String(notif.id).trim() : '';

  if ((notifIdStr && ackedSet.has(notifIdStr)) || (numericIdStr && ackedSet.has(numericIdStr))) {
    return true;
  }

  if (notif.read) {
    return true;
  }

  const sessionId = getOrInitGuestSessionId();
  const guestToken = `guest_${sessionId.slice(0, 24)}`.toLowerCase();
  const userTokens = new Set<string>([sessionId.toLowerCase(), guestToken]);

  if (currentUser) {
    for (const raw of [
      currentUser.id,
      currentUser.uid,
      currentUser.username,
      currentUser.fullName,
      currentUser.personnelNumber,
    ]) {
      const normalized = String(raw || '').trim().toLowerCase();
      if (normalized) userTokens.add(normalized);
    }
  }

  if (Array.isArray(notif.readBy) && notif.readBy.some((r) => userTokens.has(String(r || '').trim().toLowerCase()))) {
    return true;
  }

  if (
    Array.isArray(notif.acknowledgedBy) &&
    notif.acknowledgedBy.some((a) => {
      if (!a) return false;
      const uid = String(a.userId || '').trim().toLowerCase();
      const uname = String(a.userName || '').trim().toLowerCase();
      return (uid && userTokens.has(uid)) || (uname && userTokens.has(uname));
    })
  ) {
    return true;
  }

  return false;
}

function getPersistedConfirmedLockScreenUsers(): Set<string> {
  const persisted = safeReadStorageArray(HSE_NOTIF_LOCKSCREEN_CONFIRMED_KEY);
  for (const u of persisted) {
    inMemoryConfirmedLockScreenUsers.add(u);
  }
  return inMemoryConfirmedLockScreenUsers;
}

function persistConfirmedLockScreenUser(userIds: Array<string | null | undefined>): void {
  const set = getPersistedConfirmedLockScreenUsers();
  for (const raw of userIds) {
    const val = String(raw || '').trim().toLowerCase();
    if (val) set.add(val);
  }
  safeWriteStorageArray(HSE_NOTIF_LOCKSCREEN_CONFIRMED_KEY, set, 100);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Cached preferences synced strictly from PostgreSQL /api/v1/notifications/preferences
let cachedPreferences: NotificationPreferences = { ...DEFAULT_PREFERENCES };

export const CentralNotificationService = {
  /**
   * Check whether the user has already confirmed lock-screen & siren readiness on this account/device
   */
  isLockScreenSirenConfirmed(userId?: string | null, username?: string | null): boolean {
    const set = getPersistedConfirmedLockScreenUsers();
    const uidKey = String(userId || '').trim().toLowerCase();
    const unameKey = String(username || '').trim().toLowerCase();
    if ((uidKey && set.has(uidKey)) || (unameKey && set.has(unameKey))) {
      return true;
    }
    return Boolean(cachedPreferences.lockScreenSirenConfirmed);
  },

  /**
   * Mark lock-screen & siren readiness as confirmed and persist in both localStorage and PostgreSQL
   */
  async confirmLockScreenSiren(
    userOrId?: {
      id?: string;
      uid?: string;
      username?: string;
      fullName?: string;
      role?: string;
      jobTitle?: string;
      departmentId?: string;
      departmentName?: string;
    } | string | null,
    usernameArg?: string,
    deviceMeta?: {
      deviceType?: DevicePlatformType;
      deviceName?: string;
    }
  ): Promise<void> {
    const uid =
      typeof userOrId === 'string'
        ? userOrId
        : userOrId?.id || userOrId?.uid || userOrId?.username;
    const uname =
      typeof userOrId === 'object' && userOrId !== null
        ? userOrId.username || usernameArg
        : usernameArg;

    // Persist immediately so refreshing the browser will never show this confirmation popup again
    persistConfirmedLockScreenUser([uid, uname]);

    const nextPrefs: NotificationPreferences = {
      ...cachedPreferences,
      lockScreenSirenConfirmed: true,
    };
    cachedPreferences = nextPrefs;

    try {
      await this.subscribeToWebPush(userOrId, usernameArg, deviceMeta);
    } catch {
      // Non-fatal: browser may deny or not support Web Push
    }

    try {
      await apiDb.saveNotificationPreferences(nextPrefs);
    } catch {
      // Non-fatal: localStorage persistence still guarantees popup never repeats
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_notif_preferences_updated', { detail: cachedPreferences }));
    }
  },

  /**
   * Initialize and synchronize preferences from PostgreSQL database
   */
  async loadPreferences(userId?: string | null, username?: string | null): Promise<NotificationPreferences> {
    const alreadyConfirmedLocally = this.isLockScreenSirenConfirmed(userId, username);
    try {
      const data = await apiDb.getNotificationPreferences();
      if (data && typeof data === 'object') {
        const rawCustomUrl = data.criticalHseCustomAudioUrl;
        const sanitizedCustomUrl = rawCustomUrl?.startsWith('data:')
          ? '/api/v1/notifications/custom-siren'
          : rawCustomUrl;

        const isConfirmed = Boolean(data.lockScreenSirenConfirmed || alreadyConfirmedLocally);
        if (isConfirmed) {
          persistConfirmedLockScreenUser([userId, username]);
        }
        cachedPreferences = {
          ...DEFAULT_PREFERENCES,
          ...data,
          lockScreenSirenConfirmed: isConfirmed,
          criticalHseAudioMode: data.criticalHseCustomAudioUrl
            ? (data.criticalHseAudioMode || 'custom_mp3')
            : (data.criticalHseAudioMode || 'default_synth'),
          criticalHseCustomAudioUrl: sanitizedCustomUrl,
          enabledCategories: {
            ...DEFAULT_PREFERENCES.enabledCategories,
            ...(data.enabledCategories || {}),
          },
        };
      } else if (alreadyConfirmedLocally) {
        cachedPreferences = { ...cachedPreferences, lockScreenSirenConfirmed: true };
      }
    } catch {
      if (alreadyConfirmedLocally) {
        cachedPreferences = { ...cachedPreferences, lockScreenSirenConfirmed: true };
      }
    }
    return cachedPreferences;
  },

  getPreferences(): NotificationPreferences {
    return cachedPreferences;
  },

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const nextPrefs: NotificationPreferences = {
      ...cachedPreferences,
      ...prefs,
      enabledCategories: {
        ...cachedPreferences.enabledCategories,
        ...(prefs.enabledCategories || {}),
      },
    };
    await apiDb.saveNotificationPreferences(nextPrefs);
    cachedPreferences = nextPrefs;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_notif_preferences_updated', { detail: cachedPreferences }));
    }
    return cachedPreferences;
  },

  /**
   * Subscribe the current browser/device (Desktop, Laptop, Mobile) to RFC 8030 Web Push for Background & Lock Screen Native Alerts
   */
  async subscribeToWebPush(
    userOrId?: {
      id?: string;
      username?: string;
      fullName?: string;
      role?: string;
      jobTitle?: string;
      departmentId?: string;
      departmentName?: string;
    } | string | null,
    usernameArg?: string,
    deviceMeta?: {
      deviceType?: DevicePlatformType;
      deviceName?: string;
      role?: string;
      jobTitle?: string;
      departmentIds?: string[];
      departmentName?: string;
    }
  ): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
    device?: RegisteredPushDevice;
    error?: string;
    reason?: string;
  }> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      const msg = 'مرورگر از اعلان سیستمی (Web Push) پشتیبانی نمی‌کند';
      return { supported: false, permission: 'denied', subscribed: false, error: msg, reason: msg };
    }

    const userObj = typeof userOrId === 'object' && userOrId !== null ? userOrId : undefined;
    const resolvedUserId = typeof userOrId === 'string' ? userOrId : userObj?.id || userObj?.username;
    const resolvedUsername =
      typeof userOrId === 'string'
        ? usernameArg
        : userObj?.fullName || userObj?.username || usernameArg;

    const detected = detectClientDeviceInfo();
    const chosenDeviceType = deviceMeta?.deviceType || detected.deviceType;
    const chosenDeviceName = deviceMeta?.deviceName?.trim() || detected.defaultDeviceName;

    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        const msg = 'مجوز نمایش اعلان سیستمی (Notification Permission) توسط کاربر رد شده است';
        return { supported: true, permission, subscribed: false, error: msg, reason: msg };
      }

      const reg = await navigator.serviceWorker.ready;
      if (!('pushManager' in reg)) {
        const msg = 'Push API در این مرورگر فعال نیست';
        return { supported: true, permission, subscribed: false, error: msg, reason: msg };
      }

      const vapidPublicKey = await apiDb.getVapidPublicKey();
      if (!vapidPublicKey) {
        const msg = 'کلید عمومی VAPID از سرور دریافت نشد';
        return { supported: true, permission, subscribed: false, error: msg, reason: msg };
      }

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const clientSessionId = getOrInitGuestSessionId();
      const deptIds =
        deviceMeta?.departmentIds ||
        (userObj?.departmentId ? [String(userObj.departmentId)] : undefined);

      const saved = await apiDb.subscribeWebPush({
        subscription: subscription.toJSON(),
        userId: resolvedUserId,
        username: resolvedUsername,
        userName: resolvedUsername,
        role: deviceMeta?.role || userObj?.role,
        jobTitle: deviceMeta?.jobTitle || userObj?.jobTitle,
        departmentIds: deptIds,
        departmentName: deviceMeta?.departmentName || userObj?.departmentName,
        deviceType: chosenDeviceType,
        deviceName: chosenDeviceName,
        browserName: detected.browserName,
        osName: detected.osName,
        clientSessionId,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_push_devices_updated'));
      }

      return {
        supported: true,
        permission,
        subscribed: Boolean(saved),
        device: typeof saved === 'object' ? saved : undefined,
      };
    } catch (err: any) {
      const msg = err?.message || 'خطا در ثبت اشتراک Web Push دستگاه';
      return {
        supported: true,
        permission: Notification.permission,
        subscribed: false,
        error: msg,
        reason: msg,
      };
    }
  },

  async getRegisteredDevices(all?: boolean): Promise<RegisteredPushDevice[]> {
    return apiDb.getPushSubscriptions(all);
  },

  async removeRegisteredDevice(idOrEndpoint: string): Promise<boolean> {
    const ok = await apiDb.deletePushSubscription(idOrEndpoint);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_push_devices_updated'));
    }
    return ok;
  },

  async confirmAlertViewed(
    notifId: string,
    source: 'browser_push_click' | 'in_app_popup' | 'alert_details_view',
    userId?: string,
    userName?: string
  ): Promise<boolean> {
    const detected = detectClientDeviceInfo();
    return apiDb.confirmNotificationViewed(notifId, source, userId, userName, detected.deviceType);
  },

  /**
   * Dispatch native OS / Lock Screen notification via Service Worker with interactive action buttons
   */
  async dispatchSystemOsNotification(notif: AppNotification): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    const isCritical = notif.category === 'critical_hse' || notif.priority === 'critical';
    const riskLevelFa =
      notif.riskLevelFa ||
      (isCritical
        ? 'بحرانی و اضطراری (سطح ۱)'
        : notif.priority === 'high'
        ? 'فوری و پرخطر (سطح ۲)'
        : 'هشدار ایمنی (سطح ۳)');

    const actionGuidelines = notif.actionGuidelines || notif.metadata?.actionGuidelines || notif.body;
    const deepLinkUrl =
      notif.actionUrl && notif.actionUrl.includes('alertId=')
        ? notif.actionUrl
        : `/#notifications?alertId=${encodeURIComponent(notif.notifId)}`;

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg.active) {
          reg.active.postMessage({
            type: 'SHOW_HSE_SYSTEM_NOTIFICATION',
            payload: {
              notifId: notif.notifId,
              title: notif.title,
              body: notif.body,
              category: notif.category,
              priority: notif.priority,
              riskLevelFa,
              sirenType: notif.sirenType || notif.metadata?.sirenType || 'siren_evacuation',
              actionGuidelines,
              actionUrl: deepLinkUrl,
              requiresAck: notif.requiresAck !== false,
              createdAt: notif.createdAt || new Date().toISOString(),
            },
          });
          return true;
        }
      }

      // Fallback to standard Notification API if Service Worker is not yet active
      let formattedTime = '';
      try {
        formattedTime = new Date(notif.createdAt || Date.now()).toLocaleTimeString('fa-IR', {
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {}

      const osNotif = new Notification(
        isCritical && !notif.title.includes('🚨') ? `🚨 ${notif.title}` : notif.title,
        {
          body: `⚠️ سطح خطر: ${riskLevelFa}${formattedTime ? ` | 🕒 ${formattedTime}` : ''}\n📋 ${notif.body}\n🛡️ اقدام ضروری: ${actionGuidelines}`,
          icon: '/assets/hsecore-icon-192.png',
          tag: notif.notifId,
          requireInteraction: true,
        }
      );
      osNotif.onclick = () => {
        window.focus();
        window.location.hash = `#notifications?alertId=${encodeURIComponent(notif.notifId)}`;
        this.confirmAlertViewed(notif.notifId, 'browser_push_click');
      };
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Close native OS notification on this device when user acknowledges in-app
   */
  async closeSystemOsNotification(notifId: string): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
          type: 'CLOSE_HSE_SYSTEM_NOTIFICATION',
          notifId: String(notifId),
        });
      }
      const notifs = await reg.getNotifications({ tag: String(notifId) });
      for (const n of notifs) {
        n.close();
      }
    } catch {}
  },

  /**
   * Fetch all notifications from database
   */
  async getNotifications(params?: { category?: string; priority?: string; sourceModule?: string; unreadOnly?: boolean }): Promise<AppNotification[]> {
    const list = await apiDb.getNotifications({
      ...params,
      clientSessionId: getOrInitGuestSessionId(),
    });
    return (list || []).map((item) => ({
      id: item.id,
      notifId: item.notifId || item.id || `notif-${Date.now()}`,
      title: item.title,
      body: item.body,
      type: item.type || 'popup_and_push',
      category: item.category || 'info',
      priority: item.priority || 'medium',
      riskLevelFa: item.riskLevelFa || item.metadata?.riskLevelFa,
      sourceModule: item.sourceModule || 'system',
      actionUrl: item.actionUrl,
      recordId: item.recordId,
      targetType: item.targetType || 'all',
      targetValues: item.targetValues || [],
      sender: item.sender,
      read: !!item.read,
      readBy: item.readBy || [],
      requiresAck: !!item.requiresAck,
      acknowledgedBy: item.acknowledgedBy || [],
      viewedBy: item.viewedBy || item.metadata?.viewedBy || [],
      deliveryReport: item.deliveryReport || item.metadata?.deliveryReport || undefined,
      sirenType: item.sirenType || item.metadata?.sirenType,
      actionGuidelines: item.actionGuidelines || item.metadata?.actionGuidelines,
      metadata: item.metadata,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
  },

  /**
   * Main send notification method callable from any module (Simultaneous Popup + Browser Push by default)
   */
  async sendNotification(options: SendNotificationOptions): Promise<AppNotification | null> {
    const category = options.category || 'info';
    const priority = options.priority || (category === 'critical_hse' ? 'critical' : 'medium');
    const requiresAck = options.requiresAck !== undefined
      ? options.requiresAck
      : (category === 'critical_hse' || priority === 'critical');

    const isCritical = category === 'critical_hse' || priority === 'critical';
    const isImportantOrWorkflow =
      priority === 'high' ||
      category === 'warning' ||
      options.sourceModule === 'workflow' ||
      options.sourceModule === 'referral' ||
      options.sourceModule === 'signature' ||
      options.sourceModule === 'ptw' ||
      options.sourceModule === 'inspection' ||
      options.sourceModule === 'incidents' ||
      options.sourceModule === 'warnings';

    const popupPref = cachedPreferences.showCenterPopup || 'important_and_critical';
    const shouldPopup =
      options.triggerPopup ||
      options.type === 'popup' ||
      options.type === 'popup_and_push' ||
      requiresAck ||
      isCritical ||
      popupPref === 'all' ||
      (popupPref === 'important_and_critical' && (isCritical || isImportantOrWorkflow)) ||
      (popupPref === 'critical_only' && isCritical);

    const notifType = options.type || (shouldPopup ? 'popup_and_push' : 'in-app');
    const sirenType = options.sirenType || (isCritical ? 'siren_evacuation' : undefined);
    const actionGuidelines = options.actionGuidelines || options.metadata?.actionGuidelines || options.body;

    const payload = {
      title: options.title,
      body: options.body,
      type: notifType,
      category,
      priority,
      sourceModule: options.sourceModule || 'system',
      actionUrl: options.actionUrl,
      recordId: options.recordId,
      requiresAck,
      targetType: options.targetType || 'all',
      targetValues: options.targetValues || [],
      sender: options.sender,
      sirenType,
      actionGuidelines,
      metadata: {
        ...(options.metadata || {}),
        sirenType,
        actionGuidelines,
      },
    };

    const saved = await apiDb.saveNotification(payload);
    const finalNotif: AppNotification = {
      ...(saved || payload),
      notifId: String((saved as any)?.notifId || (saved as any)?.id || `notif-${Date.now()}`),
      createdAt: (saved as any)?.createdAt || new Date().toISOString(),
      viewedBy: (saved as any)?.viewedBy || (saved as any)?.metadata?.viewedBy || [],
      deliveryReport: (saved as any)?.deliveryReport || (saved as any)?.metadata?.deliveryReport,
      metadata: {
        ...((saved as any)?.metadata || payload.metadata || {}),
        playSound: options.playSound ?? true,
      },
    };

    window.dispatchEvent(new CustomEvent('hse_local_notification_dispatched', { detail: finalNotif }));
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));

    return finalNotif;
  },

  /**
   * Trigger a real Simultaneous Popup + Browser Push (Lock Screen & Siren) test notification
   */
  async triggerTestNotification(
    category: NotificationCategory = 'critical_hse',
    sirenType: HseSirenType | string = 'siren_evacuation'
  ): Promise<AppNotification | null> {
    const isCritical = category === 'critical_hse';
    const title = isCritical
      ? 'آزمایش هشدار فوری HSE (ارسال همزمان پنجره داخلی + اعلان مرورگر)'
      : 'آزمایش اعلان سیستمی HSECORE (Popup + Browser Push)';
    const body = isCritical
      ? 'این یک هشدار آزمایشی جهت بررسی نمایش همزمان پنجره هشدار داخلی (Popup) و اعلان سیستمی مرورگر (Browser Push) حتی در زمان بسته بودن صفحه HSECORE است.'
      : 'این یک اعلان آزمایشی سیستمی در سامانه HSECORE است.';
    const actionGuidelines = 'لطفاً روی اعلان سیستمی مرورگر یا دکمه «تأیید دریافت و قطع آژیر» کلیک نمایید.';

    return this.sendNotification({
      title,
      body,
      type: 'popup_and_push',
      category,
      priority: isCritical ? 'critical' : 'high',
      sourceModule: 'safety',
      requiresAck: isCritical,
      targetType: 'all',
      sirenType,
      actionGuidelines,
      playSound: true,
      triggerPopup: true,
      metadata: {
        isTest: true,
        sirenType,
        actionGuidelines,
      },
    });
  },

  // Helper shortcuts for modules
  info(title: string, body: string, options?: Partial<SendNotificationOptions>) {
    return this.sendNotification({ ...options, title, body, category: 'info', priority: options?.priority || 'low' });
  },

  success(title: string, body: string, options?: Partial<SendNotificationOptions>) {
    return this.sendNotification({ ...options, title, body, category: 'success', priority: options?.priority || 'medium' });
  },

  warning(title: string, body: string, options?: Partial<SendNotificationOptions>) {
    return this.sendNotification({ ...options, title, body, category: 'warning', priority: options?.priority || 'high', triggerPopup: true });
  },

  error(title: string, body: string, options?: Partial<SendNotificationOptions>) {
    return this.sendNotification({ ...options, title, body, category: 'error', priority: options?.priority || 'high', triggerPopup: true });
  },

  criticalHse(title: string, body: string, options?: Partial<SendNotificationOptions>) {
    return this.sendNotification({
      ...options,
      title,
      body,
      category: 'critical_hse',
      priority: 'critical',
      requiresAck: true,
      triggerPopup: true,
      playSound: true,
    });
  },

  async markAsRead(id: string | number): Promise<boolean> {
    const idStr = String(id);
    markPublicAlertAcknowledgedLocally(idStr);
    const success = await apiDb.markNotificationRead(idStr, getOrInitGuestSessionId());
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));
    return success;
  },

  async markAllAsRead(): Promise<boolean> {
    const success = await apiDb.markAllNotificationsRead();
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));
    return success;
  },

  async acknowledge(id: string | number, note?: string, acknowledgmentSource?: string): Promise<boolean> {
    const idStr = String(id);
    markPublicAlertAcknowledgedLocally(idStr);
    const success = await apiDb.acknowledgeNotification(
      idStr,
      note,
      acknowledgmentSource,
      getOrInitGuestSessionId()
    );
    await this.closeSystemOsNotification(idStr);
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));
    return success;
  },

  async getPublicActiveEmergencyAlerts(sinceIso?: string): Promise<AppNotification[]> {
    const list = await apiDb.getPublicActiveEmergencyAlerts(sinceIso, getOrInitGuestSessionId());
    return (list || []).map((item: any) => ({
      id: item.id,
      notifId: item.notifId || item.id || `notif-${Date.now()}`,
      title: item.title,
      body: item.body,
      type: 'popup',
      category: item.category || 'critical_hse',
      priority: item.priority || 'critical',
      riskLevelFa: item.riskLevelFa || 'بحرانی و اضطراری (سطح ۱)',
      sourceModule: item.sourceModule || 'emergency',
      requiresAck: true,
      acknowledgedBy: [],
      sirenType: item.sirenType || 'siren_evacuation',
      actionGuidelines: item.actionGuidelines || item.body,
      metadata: {
        actionGuidelines: item.actionGuidelines || item.body,
        sirenType: item.sirenType || 'siren_evacuation',
      },
      createdAt: item.createdAt || new Date().toISOString(),
    }));
  },

  async acknowledgePublic(id: string | number, note?: string, acknowledgmentSource?: string): Promise<boolean> {
    const notifIdStr = String(id);
    markPublicAlertAcknowledgedLocally(notifIdStr);
    const sessionId = getOrInitGuestSessionId();
    const success = await apiDb.acknowledgePublicEmergency(
      notifIdStr,
      sessionId,
      note,
      acknowledgmentSource || 'login_screen'
    );
    await this.closeSystemOsNotification(notifIdStr);
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));
    return success;
  },

  async delete(id: string | number): Promise<boolean> {
    const success = await apiDb.deleteNotification(String(id));
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));
    return success;
  },

  async clearAll(): Promise<boolean> {
    const success = await apiDb.clearAllNotifications();
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));
    return success;
  },

  playAlertSound(
    category: NotificationCategory,
    priority: NotificationPriority,
    sirenType?: HseSirenType | string
  ) {
    const prefs = cachedPreferences;
    const isCategoryEnabled = prefs.enabledCategories?.[category] ?? true;
    if (!isCategoryEnabled) return;

    const isCritical = category === 'critical_hse' || priority === 'critical';
    const forcePlay = isCritical && prefs.criticalSoundAlwaysOn;

    const customAudioUrl = (isCritical && prefs.criticalHseAudioMode === 'custom_mp3' && prefs.criticalHseCustomAudioUrl)
      ? prefs.criticalHseCustomAudioUrl
      : undefined;

    playNotificationSound(category as SoundType, {
      volume: prefs.soundVolume,
      muted: !prefs.soundEnabled,
      forcePlay,
      customAudioUrl,
      sirenType,
    });
  },
};
