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
  role?: string;
  department?: string;
  deviceType?: DevicePlatformType;
  deviceName?: string;
  endpointDomain: string;
  status: 'delivered' | 'failed' | 'expired_removed';
  statusCode?: number;
  pushServiceResponse?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface NotificationViewConfirmation {
  userId: string;
  userName?: string;
  clientSessionId?: string;
  source: 'browser_push_click' | 'in_app_popup' | 'alert_details_view' | string;
  deviceType?: DevicePlatformType;
  deviceInfo?: string;
  clientIp?: string;
  timestamp: string;
}

export interface NotificationDeliveryReport {
  dispatchedAt: string;
  simultaneousPopupAndPush: boolean;
  inAppBroadcasted: boolean;
  totalTargetedDevices: number;
  pushDeliveredCount: number;
  pushFailedCount: number;
  expiredRemovedCount: number;
  deviceLogs: PushDeliveryDeviceLog[];
}

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
  targetType?: TargetAudienceType;
  targetValues?: string[];
  sender?: string;
  read?: boolean;
  readBy?: string[];
  viewedBy?: NotificationViewConfirmation[];
  deliveryReport?: NotificationDeliveryReport;
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
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  lastStatusCode?: number;
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

