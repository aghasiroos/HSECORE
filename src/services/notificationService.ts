import { apiDb } from './apiDatabaseClient';
import { playNotificationSound, SoundType, HseSirenType } from '../utils/notificationAudio';

export type NotificationCategory = 'info' | 'success' | 'warning' | 'error' | 'critical_hse';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AppNotification {
  id?: number;
  notifId: string;
  title: string;
  body: string;
  type?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  riskLevelFa?: string;
  sourceModule: string;
  actionUrl?: string;
  recordId?: string;
  targetType?: 'all' | 'roles' | 'departments' | 'user' | 'users' | 'single';
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
  type?: 'in-app' | 'popup' | 'push';
  category?: NotificationCategory;
  priority?: NotificationPriority;
  sourceModule?: string;
  actionUrl?: string;
  recordId?: string;
  requiresAck?: boolean;
  targetType?: 'all' | 'roles' | 'departments' | 'user' | 'users' | 'single';
  targetValues?: string[];
  sender?: string;
  sirenType?: HseSirenType | string;
  actionGuidelines?: string;
  metadata?: Record<string, any>;
  playSound?: boolean;
  triggerPopup?: boolean;
}

const PREFS_STORAGE_KEY = 'hse_notification_preferences_v1';
const LOCKSCREEN_CONFIRMED_KEY = 'hse_lockscreen_siren_confirmed_v1';

function loadCachedPrefsFromStorage(): NotificationPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const confirmedFlag = localStorage.getItem(LOCKSCREEN_CONFIRMED_KEY) === 'true';
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.criticalHseCustomAudioUrl?.startsWith('data:')) {
          parsed.criticalHseCustomAudioUrl = '/api/v1/notifications/custom-siren';
        }
        const isConfirmed = Boolean(confirmedFlag || parsed.lockScreenSirenConfirmed);
        if (isConfirmed) {
          localStorage.setItem(LOCKSCREEN_CONFIRMED_KEY, 'true');
        }
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          lockScreenSirenConfirmed: isConfirmed,
          enabledCategories: {
            ...DEFAULT_PREFERENCES.enabledCategories,
            ...(parsed.enabledCategories || {}),
          },
        };
      }
    }
    if (confirmedFlag) {
      return { ...DEFAULT_PREFERENCES, lockScreenSirenConfirmed: true };
    }
  } catch {}
  return { ...DEFAULT_PREFERENCES };
}

function saveCachedPrefsToStorage(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    const toSave = { ...prefs };
    if (toSave.criticalHseCustomAudioUrl?.startsWith('data:')) {
      toSave.criticalHseCustomAudioUrl = '/api/v1/notifications/custom-siren';
    }
    if (toSave.lockScreenSirenConfirmed) {
      localStorage.setItem(LOCKSCREEN_CONFIRMED_KEY, 'true');
    }
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

const GUEST_ACK_KEY = 'hse_public_acknowledged_alerts';
const GUEST_SESSION_KEY = 'hse_guest_session_id';

export function getOrInitGuestSessionId(): string {
  if (typeof window === 'undefined') return 'guest_session';
  try {
    let sid = sessionStorage.getItem(GUEST_SESSION_KEY) || localStorage.getItem(GUEST_SESSION_KEY);
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      sessionStorage.setItem(GUEST_SESSION_KEY, sid);
      localStorage.setItem(GUEST_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'guest_session';
  }
}

export function getPublicAcknowledgedAlertIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(GUEST_ACK_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function markPublicAlertAcknowledgedLocally(notifId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getPublicAcknowledgedAlertIds();
    set.add(String(notifId));
    localStorage.setItem(GUEST_ACK_KEY, JSON.stringify(Array.from(set)));
  } catch {}
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

// Cached preferences in-memory with localStorage + database persistence
let cachedPreferences: NotificationPreferences = loadCachedPrefsFromStorage();

export const CentralNotificationService = {
  /**
   * Check whether the user has already confirmed lock-screen & siren readiness on this device/account
   */
  isLockScreenSirenConfirmed(userId?: string | null): boolean {
    if (typeof window === 'undefined') return true;
    try {
      if (localStorage.getItem(LOCKSCREEN_CONFIRMED_KEY) === 'true') return true;
      if (userId && localStorage.getItem(`${LOCKSCREEN_CONFIRMED_KEY}_${userId}`) === 'true') return true;
    } catch {}
    return Boolean(cachedPreferences.lockScreenSirenConfirmed);
  },

  /**
   * Mark lock-screen & siren readiness as permanently confirmed so it is never requested again on page refresh
   */
  async confirmLockScreenSiren(
    userOrId?: { id?: string; username?: string } | string | null,
    usernameArg?: string
  ): Promise<void> {
    const uid = typeof userOrId === 'string' ? userOrId : userOrId?.id || userOrId?.username;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCKSCREEN_CONFIRMED_KEY, 'true');
        if (uid) {
          localStorage.setItem(`${LOCKSCREEN_CONFIRMED_KEY}_${uid}`, 'true');
        }
      } catch {}
    }
    cachedPreferences = {
      ...cachedPreferences,
      lockScreenSirenConfirmed: true,
    };
    saveCachedPrefsToStorage(cachedPreferences);
    try {
      await this.subscribeToWebPush(userOrId, usernameArg);
    } catch {}
    try {
      await apiDb.saveNotificationPreferences(cachedPreferences);
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_notif_preferences_updated', { detail: cachedPreferences }));
    }
  },

  /**
   * Initialize and synchronize preferences from database
   */
  async loadPreferences(userId?: string | null): Promise<NotificationPreferences> {
    const localStored = loadCachedPrefsFromStorage();
    cachedPreferences = localStored;
    try {
      const data = await apiDb.getNotificationPreferences();
      if (data && typeof data === 'object') {
        const rawCustomUrl = data.criticalHseCustomAudioUrl || localStored.criticalHseCustomAudioUrl;
        const sanitizedCustomUrl = rawCustomUrl?.startsWith('data:')
          ? '/api/v1/notifications/custom-siren'
          : rawCustomUrl;

        const hasServerCustom = Boolean(data.criticalHseCustomAudioUrl);
        const hasLocalCustom = Boolean(localStored.criticalHseCustomAudioUrl);
        const userLocalFlag =
          typeof window !== 'undefined' && userId
            ? localStorage.getItem(`${LOCKSCREEN_CONFIRMED_KEY}_${userId}`) === 'true'
            : false;
        const isConfirmed = Boolean(
          localStored.lockScreenSirenConfirmed || data.lockScreenSirenConfirmed || userLocalFlag
        );
        if (isConfirmed && typeof window !== 'undefined') {
          try {
            localStorage.setItem(LOCKSCREEN_CONFIRMED_KEY, 'true');
            if (userId) localStorage.setItem(`${LOCKSCREEN_CONFIRMED_KEY}_${userId}`, 'true');
          } catch {}
        }
        cachedPreferences = {
          ...DEFAULT_PREFERENCES,
          ...localStored,
          ...data,
          lockScreenSirenConfirmed: isConfirmed,
          criticalHseAudioMode: hasServerCustom
            ? data.criticalHseAudioMode
            : hasLocalCustom
            ? localStored.criticalHseAudioMode
            : data.criticalHseAudioMode || 'default_synth',
          criticalHseCustomAudioUrl: sanitizedCustomUrl,
          criticalHseCustomAudioName: data.criticalHseCustomAudioName || localStored.criticalHseCustomAudioName,
          criticalHseCustomAudioSize: data.criticalHseCustomAudioSize || localStored.criticalHseCustomAudioSize,
          enabledCategories: {
            ...DEFAULT_PREFERENCES.enabledCategories,
            ...(localStored.enabledCategories || {}),
            ...(data.enabledCategories || {}),
          },
        };
        saveCachedPrefsToStorage(cachedPreferences);
      }
    } catch {
      // Keep local/cached preferences
    }
    return cachedPreferences;
  },

  getPreferences(): NotificationPreferences {
    return cachedPreferences;
  },

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    cachedPreferences = {
      ...cachedPreferences,
      ...prefs,
      enabledCategories: {
        ...cachedPreferences.enabledCategories,
        ...(prefs.enabledCategories || {}),
      },
    };
    saveCachedPrefsToStorage(cachedPreferences);
    try {
      await apiDb.saveNotificationPreferences(cachedPreferences);
    } catch (e) {
      console.error('Failed to save preferences to server:', e);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_notif_preferences_updated', { detail: cachedPreferences }));
    }
    return cachedPreferences;
  },

  /**
   * Subscribe the current browser/device to RFC 8030 Web Push for Lock Screen & Background Native Alerts
   */
  async subscribeToWebPush(
    userOrId?: { id?: string; username?: string } | string | null,
    usernameArg?: string
  ): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
    error?: string;
    reason?: string;
  }> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      const msg = 'مرورگر از اعلان سیستمی پشتیبانی نمی‌کند';
      return { supported: false, permission: 'denied', subscribed: false, error: msg, reason: msg };
    }

    const resolvedUserId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
    const resolvedUsername = typeof userOrId === 'string' ? usernameArg : userOrId?.username;

    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        const msg = 'مجوز نمایش اعلان سیستمی توسط کاربر رد شده است';
        return { supported: true, permission, subscribed: false, error: msg, reason: msg };
      }

      const reg = await navigator.serviceWorker.ready;
      if (!('pushManager' in reg)) {
        const msg = 'PushManager در این مرورگر فعال نیست';
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
      const ok = await apiDb.subscribeWebPush({
        subscription: subscription.toJSON(),
        userId: resolvedUserId,
        username: resolvedUsername,
        clientSessionId,
      });

      return { supported: true, permission, subscribed: ok };
    } catch (err: any) {
      const msg = err?.message || 'خطا در ثبت اشتراک Web Push';
      return {
        supported: true,
        permission: Notification.permission,
        subscribed: false,
        error: msg,
        reason: msg,
      };
    }
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
              actionUrl: notif.actionUrl || '/',
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

      new Notification(isCritical && !notif.title.includes('🚨') ? `🚨 ${notif.title}` : notif.title, {
        body: `⚠️ سطح خطر: ${riskLevelFa}${formattedTime ? ` | 🕒 ${formattedTime}` : ''}\n📋 ${notif.body}\n🛡️ اقدام ضروری: ${actionGuidelines}`,
        icon: '/assets/hsecore-icon-192.png',
        tag: notif.notifId,
        requireInteraction: true,
      });
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
    const list = await apiDb.getNotifications(params);
    return (list || []).map((item) => ({
      id: item.id,
      notifId: item.notifId || item.id || `notif-${Date.now()}`,
      title: item.title,
      body: item.body,
      type: item.type || 'in-app',
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
      sirenType: item.sirenType || item.metadata?.sirenType,
      actionGuidelines: item.actionGuidelines || item.metadata?.actionGuidelines,
      metadata: item.metadata,
      createdAt: item.createdAt || new Date().toISOString(),
    }));
  },

  /**
   * Main send notification method callable from any module
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
      requiresAck ||
      isCritical ||
      popupPref === 'all' ||
      (popupPref === 'important_and_critical' && (isCritical || isImportantOrWorkflow)) ||
      (popupPref === 'critical_only' && isCritical);

    const notifType = options.type || (shouldPopup ? 'popup' : 'in-app');
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
      targetValues: options.targetValues,
      sender: options.sender,
      sirenType,
      actionGuidelines,
      metadata: {
        ...(options.metadata || {}),
        sirenType,
        actionGuidelines,
      },
    };

    try {
      const saved = await apiDb.saveNotification(payload);
      const finalNotif: AppNotification = {
        ...(saved || payload),
        notifId: String((saved as any)?.notifId || (saved as any)?.id || `notif-${Date.now()}`),
        createdAt: (saved as any)?.createdAt || new Date().toISOString(),
        metadata: {
          ...((saved as any)?.metadata || payload.metadata || {}),
          playSound: options.playSound ?? true,
        },
      };

      // Route through the unified deduplicated processor in NotificationContext
      window.dispatchEvent(new CustomEvent('hse_local_notification_dispatched', { detail: finalNotif }));
      window.dispatchEvent(new CustomEvent('hse_notifications_updated'));

      return finalNotif;
    } catch (e) {
      console.error('Failed to dispatch notification:', e);
      return null;
    }
  },

  /**
   * Trigger a real Lock Screen / Native OS & Siren test notification
   */
  async triggerTestNotification(
    category: NotificationCategory = 'critical_hse',
    sirenType: HseSirenType | string = 'siren_evacuation'
  ): Promise<AppNotification | null> {
    const isCritical = category === 'critical_hse';
    const title = isCritical
      ? 'آزمایش هشدار بحرانی HSE (صفحه قفل و آژیر خودکار)'
      : 'آزمایش اعلان سیستمی HSECORE';
    const body = isCritical
      ? 'این یک هشدار آزمایشی جهت بررسی نمایش اعلان روی صفحه قفل (Lock Screen) و پخش خودکار آژیر اضطراری بدون نیاز به کلیک است.'
      : 'این یک اعلان آزمایشی سیستمی در سامانه HSECORE است.';
    const actionGuidelines = 'لطفاً روی دکمه «تأیید دریافت و قطع آژیر» کلیک نمایید.';

    return this.sendNotification({
      title,
      body,
      type: 'popup',
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
    const success = await apiDb.markNotificationRead(String(id));
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
    const success = await apiDb.acknowledgeNotification(idStr, note, acknowledgmentSource);
    markPublicAlertAcknowledgedLocally(idStr);
    await this.closeSystemOsNotification(idStr);
    window.dispatchEvent(new CustomEvent('hse_notifications_updated'));
    return success;
  },

  async getPublicActiveEmergencyAlerts(sinceIso?: string): Promise<AppNotification[]> {
    const list = await apiDb.getPublicActiveEmergencyAlerts(sinceIso);
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
    const sessionId = getOrInitGuestSessionId();
    const success = await apiDb.acknowledgePublicEmergency(
      notifIdStr,
      sessionId,
      note,
      acknowledgmentSource || 'login_screen'
    );
    markPublicAlertAcknowledgedLocally(notifIdStr);
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
