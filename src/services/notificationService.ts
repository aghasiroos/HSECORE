import { apiDb } from './apiDatabaseClient';
import { playNotificationSound, SoundType } from '../utils/notificationAudio';

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
  }>;
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
  metadata?: Record<string, any>;
  playSound?: boolean;
  triggerPopup?: boolean;
}

const PREFS_STORAGE_KEY = 'hse_notification_preferences_v1';

function loadCachedPrefsFromStorage(): NotificationPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.criticalHseCustomAudioUrl?.startsWith('data:')) {
          parsed.criticalHseCustomAudioUrl = '/api/v1/notifications/custom-siren';
        }
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          enabledCategories: {
            ...DEFAULT_PREFERENCES.enabledCategories,
            ...(parsed.enabledCategories || {}),
          },
        };
      }
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
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(toSave));
  } catch {}
}

// Cached preferences in-memory with localStorage + database persistence
let cachedPreferences: NotificationPreferences = loadCachedPrefsFromStorage();

export const CentralNotificationService = {
  /**
   * Initialize and synchronize preferences from database
   */
  async loadPreferences(): Promise<NotificationPreferences> {
    const localStored = loadCachedPrefsFromStorage();
    cachedPreferences = localStored;
    try {
      const data = await apiDb.getNotificationPreferences();
      if (data && typeof data === 'object') {
        const rawCustomUrl = data.criticalHseCustomAudioUrl || localStored.criticalHseCustomAudioUrl;
        const sanitizedCustomUrl = rawCustomUrl?.startsWith('data:')
          ? '/api/v1/notifications/custom-siren'
          : rawCustomUrl;

        // Merge server data while preserving custom MP3 if stored locally or on server
        const hasServerCustom = Boolean(data.criticalHseCustomAudioUrl);
        const hasLocalCustom = Boolean(localStored.criticalHseCustomAudioUrl);
        cachedPreferences = {
          ...DEFAULT_PREFERENCES,
          ...localStored,
          ...data,
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

    // Intelligent popup detection for modules, referrals, signatures, and critical items
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
      metadata: options.metadata,
    };

    try {
      const saved = await apiDb.saveNotification(payload);
      
      // Play local sound immediately
      const shouldPlaySound = options.playSound ?? true;
      if (shouldPlaySound) {
        this.playAlertSound(category, priority);
      }

      // Trigger instant UI events
      window.dispatchEvent(new CustomEvent('hse_notifications_updated'));

      if (shouldPopup && popupPref !== 'none') {
        window.dispatchEvent(new CustomEvent('hse_popup_alert_requested', { detail: saved || payload }));
      }

      return saved;
    } catch (e) {
      console.error('Failed to dispatch notification:', e);
      return null;
    }
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

  async acknowledge(id: string | number, note?: string): Promise<boolean> {
    const success = await apiDb.acknowledgeNotification(String(id), note);
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

  playAlertSound(category: NotificationCategory, priority: NotificationPriority) {
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
    });
  },
};
