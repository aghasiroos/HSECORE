export type NotificationCategory =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'critical_hse';

export type NotificationPriority =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type NotificationType =
  | 'REFERRAL'
  | 'APPROVAL'
  | 'REJECTION'
  | 'DEADLINE_APPROACHING'
  | 'OVERDUE'
  | 'WORKFLOW_COMPLETED'
  | 'SYSTEM_ALERT'
  | 'in-app'
  | 'popup';

export interface NotificationRecord {
  id?: number;
  notifId: string;
  title: string;
  body: string;
  type: NotificationType | string;
  category: NotificationCategory;
  priority: NotificationPriority;
  sourceModule: string;
  actionUrl?: string;
  recordId?: string;
  targetType?: 'all' | 'roles' | 'departments' | 'user' | 'single';
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
    acknowledgmentSource?: 'in_app_modal' | 'os_notification_action' | 'login_screen' | string;
    clientIp?: string;
    status?: 'acknowledged';
  }>;
  entityType?: string;
  entityId?: string;
  link?: string;
  sirenType?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface WebPushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userName?: string;
  role?: string;
  departmentIds?: string[];
  guestSessionId?: string;
  userAgent?: string;
  platform?: string;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string;
}

export interface VapidKeySet {
  publicKey: string;
  privateKey: string;
  subject: string;
  createdAt: string;
}

export interface UserNotificationPreferences {
  soundEnabled: boolean;
  soundVolume: number; // 0 to 1
  criticalSoundAlwaysOn: boolean;
  showCenterPopup: 'all' | 'important_and_critical' | 'critical_only' | 'none';
  enabledCategories: {
    info: boolean;
    success: boolean;
    warning: boolean;
    error: boolean;
    critical_hse: boolean;
  };
  criticalHseAudioMode?: 'default_synth' | 'custom_mp3';
  criticalHseCustomAudioUrl?: string;
  criticalHseCustomAudioName?: string;
  criticalHseCustomAudioSize?: number;
  lockScreenSirenConfirmed?: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
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

