import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  CentralNotificationService,
  AppNotification,
  NotificationPreferences,
  DEFAULT_PREFERENCES,
} from '../services/notificationService';
import { useWebSocket } from '../providers/WebSocketProvider';
import { stopSirenLoop } from '../utils/notificationAudio';
import { UserProfile } from '../types';

interface NotificationContextType {
  currentUser: UserProfile | null;
  notifications: AppNotification[];
  unreadCount: number;
  criticalAlerts: AppNotification[];
  activePopupAlert: AppNotification | null;
  popupQueue: AppNotification[];
  preferences: NotificationPreferences;
  isMuted: boolean;
  isSettingsOpen: boolean;
  isBroadcastOpen: boolean;
  isLoading: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  openBroadcast: () => void;
  closeBroadcast: () => void;
  toggleMute: () => void;
  setVolume: (vol: number) => void;
  closePopup: () => void;
  dismissPopup: (notifId: string) => void;
  markAsRead: (id: string | number) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  acknowledgeAlert: (id: string | number, note?: string) => Promise<boolean>;
  deleteNotification: (id: string | number) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  refreshNotifications: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  triggerTestAlert: (category?: string, priority?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{
  children: React.ReactNode;
  currentUser?: UserProfile | null;
}> = ({ children, currentUser: propsUser }) => {
  const { socket } = useWebSocket();

  const [internalUser, setInternalUser] = useState<UserProfile | null>(() => {
    if (propsUser !== undefined) return propsUser;
    try {
      const raw =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('hse_current_user') ||
            localStorage.getItem('hse_current_user') ||
            sessionStorage.getItem('hse_user_session') ||
            localStorage.getItem('hse_user_session')
          : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const currentUser = propsUser !== undefined ? propsUser : internalUser;

  // Listen to session storage updates for user login/logout
  useEffect(() => {
    if (propsUser !== undefined) return;
    const checkUser = () => {
      try {
        const raw =
          sessionStorage.getItem('hse_current_user') ||
          localStorage.getItem('hse_current_user') ||
          sessionStorage.getItem('hse_user_session') ||
          localStorage.getItem('hse_user_session');
        setInternalUser(raw ? JSON.parse(raw) : null);
      } catch {
        setInternalUser(null);
      }
    };
    window.addEventListener('storage', checkUser);
    window.addEventListener('hse_auth_state_changed', checkUser);
    return () => {
      window.removeEventListener('storage', checkUser);
      window.removeEventListener('hse_auth_state_changed', checkUser);
    };
  }, [propsUser]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    CentralNotificationService.getPreferences()
  );
  const [activePopupAlert, setActivePopupAlert] = useState<AppNotification | null>(null);
  const [popupQueue, setPopupQueue] = useState<AppNotification[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Set of dismissed popup notification IDs in current browser session
  const [dismissedPopupIds, setDismissedPopupIds] = useState<Set<string>>(new Set());
  const dismissedPopupIdsRef = React.useRef<Set<string>>(dismissedPopupIds);
  dismissedPopupIdsRef.current = dismissedPopupIds;

  // Load preferences on mount, user change, and preference update events
  useEffect(() => {
    CentralNotificationService.loadPreferences().then((p) => {
      setPreferences(p);
    });

    const handlePrefsEvent = (e: any) => {
      if (e.detail) {
        setPreferences({ ...e.detail });
      }
    };
    window.addEventListener('hse_notif_preferences_updated', handlePrefsEvent);
    return () => {
      window.removeEventListener('hse_notif_preferences_updated', handlePrefsEvent);
    };
  }, [currentUser?.id]);

  // Fetch notifications from database
  const refreshNotifications = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const data = await CentralNotificationService.getNotifications();
      setNotifications(data);

      // Check for unacknowledged critical alerts, referrals, signatures, and popup notifications
      const isCriticalAlert = (n: AppNotification) => n.category === 'critical_hse' || n.priority === 'critical';
      const isWorkflowOrReferral = (n: AppNotification) =>
        n.priority === 'high' ||
        n.category === 'warning' ||
        n.sourceModule === 'workflow' ||
        n.sourceModule === 'referral' ||
        n.sourceModule === 'signature' ||
        n.sourceModule === 'ptw' ||
        n.sourceModule === 'inspection' ||
        n.sourceModule === 'warnings' ||
        n.sourceModule === 'incidents';

      const popupPref = preferences.showCenterPopup || 'important_and_critical';
      
      const unackPopups = data.filter((n) => {
        if (n.read) return false;
        if (dismissedPopupIdsRef.current.has(n.notifId)) return false;

        // If explicitly acknowledged already by this user
        if (n.requiresAck && n.acknowledgedBy && n.acknowledgedBy.some(a => a.userId === currentUser.id || a.userName === currentUser.username)) {
          return false;
        }

        if (popupPref === 'none') return false;

        // Direct popup type or requires explicit ack
        if (n.type === 'popup' || n.requiresAck) return true;

        // Preferences evaluation
        if (popupPref === 'all') return true;
        if (popupPref === 'important_and_critical' && (isCriticalAlert(n) || isWorkflowOrReferral(n))) return true;
        if (popupPref === 'critical_only' && isCriticalAlert(n)) return true;

        return false;
      });

      // Automatically queue alerts for popup display
      if (unackPopups.length > 0) {
        setPopupQueue((prev) => {
          const existingIds = new Set(prev.map((p) => p.notifId));
          const newItems = unackPopups.filter((u) => !existingIds.has(u.notifId));
          return newItems.length > 0 ? [...prev, ...newItems] : prev;
        });
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [currentUser?.id, currentUser?.username, preferences.showCenterPopup]);

  // Initial load
  useEffect(() => {
    if (currentUser?.id) {
      setIsLoading(true);
      refreshNotifications().finally(() => setIsLoading(false));
    } else {
      setNotifications([]);
      setActivePopupAlert(null);
      setPopupQueue([]);
    }
  }, [currentUser?.id, refreshNotifications]);

  // Helper to determine if current user is part of target audience
  const isTargetUser = useCallback(
    (notif: AppNotification) => {
      if (!currentUser) return true;
      const targetType = notif.targetType || 'all';
      if (targetType === 'all') return true;
      const values = notif.targetValues || [];
      if (values.length === 0) return true;

      if (targetType === 'roles') {
        const uRole = (currentUser.role || '').toLowerCase();
        return values.some((v) => v.toLowerCase() === uRole);
      }
      if (targetType === 'departments') {
        const uDeptIds = currentUser.departmentIds || [];
        const singleDept = (currentUser as any).departmentId || (currentUser as any).department || '';
        return values.some(
          (v) =>
            uDeptIds.some((d) => String(d).toLowerCase() === String(v).toLowerCase()) ||
            (singleDept && String(singleDept).toLowerCase() === String(v).toLowerCase())
        );
      }
      if (targetType === 'single' || targetType === 'user' || targetType === 'users') {
        const uid = String(currentUser.id || '');
        const uname = (currentUser.username || '').toLowerCase();
        return values.some(
          (v) => String(v).toLowerCase() === uid.toLowerCase() || String(v).toLowerCase() === uname
        );
      }
      return true;
    },
    [currentUser]
  );

  // Listen for real-time WebSocket events and browser custom events
  useEffect(() => {
    if (!socket) return;

    const handleSocketAlert = (newNotif: AppNotification) => {
      // Check if current user is within the target audience of this alert
      if (!isTargetUser(newNotif)) {
        return;
      }

      const siren = newNotif.sirenType || newNotif.metadata?.sirenType;

      // 1. Play sound based on user preferences and selected siren
      CentralNotificationService.playAlertSound(newNotif.category, newNotif.priority, siren);

      // 2. Add to notification list
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.notifId !== newNotif.notifId)]);

      // 3. Determine if popup should appear
      const isCritical = newNotif.category === 'critical_hse' || newNotif.priority === 'critical';
      const isImportantOrWorkflow =
        newNotif.priority === 'high' ||
        newNotif.category === 'warning' ||
        newNotif.sourceModule === 'workflow' ||
        newNotif.sourceModule === 'referral' ||
        newNotif.sourceModule === 'signature' ||
        newNotif.sourceModule === 'ptw' ||
        newNotif.sourceModule === 'inspection' ||
        newNotif.sourceModule === 'warnings' ||
        newNotif.sourceModule === 'incidents';
      const popupPref = preferences.showCenterPopup || 'important_and_critical';

      const shouldShowPopup =
        newNotif.type === 'popup' ||
        newNotif.requiresAck ||
        (popupPref === 'all') ||
        (popupPref === 'important_and_critical' && (isCritical || isImportantOrWorkflow)) ||
        (popupPref === 'critical_only' && isCritical);

      if (shouldShowPopup && popupPref !== 'none') {
        setPopupQueue((prev) => {
          if (prev.some((p) => p.notifId === newNotif.notifId)) return prev;
          return [...prev, newNotif];
        });
      }
    };

    socket.on('notification_alert', handleSocketAlert);

    return () => {
      socket.off('notification_alert', handleSocketAlert);
    };
  }, [socket, preferences, isTargetUser]);

  // Listen for local system events
  useEffect(() => {
    const handleUpdated = () => {
      refreshNotifications();
    };

    const handlePopupRequest = (e: any) => {
      const alert = e.detail as AppNotification;
      if (alert) {
        setPopupQueue((prev) => {
          if (prev.some((p) => p.notifId === alert.notifId)) return prev;
          return [...prev, alert];
        });
      }
    };

    const handlePreferencesUpdated = (e: any) => {
      if (e.detail) {
        setPreferences(e.detail);
      }
    };

    window.addEventListener('hse_notifications_updated', handleUpdated);
    window.addEventListener('hse_popup_alert_requested', handlePopupRequest);
    window.addEventListener('hse_notif_preferences_updated', handlePreferencesUpdated);

    return () => {
      window.removeEventListener('hse_notifications_updated', handleUpdated);
      window.removeEventListener('hse_popup_alert_requested', handlePopupRequest);
      window.removeEventListener('hse_notif_preferences_updated', handlePreferencesUpdated);
    };
  }, [refreshNotifications]);

  // Synchronize activePopupAlert from queue
  useEffect(() => {
    if (!activePopupAlert && popupQueue.length > 0) {
      setActivePopupAlert(popupQueue[0]);
    }
  }, [activePopupAlert, popupQueue]);

  const closePopup = useCallback(() => {
    stopSirenLoop();
    if (activePopupAlert) {
      // Mark as dismissed for session
      setDismissedPopupIds((prev) => new Set(prev).add(activePopupAlert.notifId));
    }
    setActivePopupAlert(null);
    setPopupQueue((prev) => prev.slice(1));
  }, [activePopupAlert]);

  const dismissPopup = useCallback((notifId: string) => {
    stopSirenLoop();
    setDismissedPopupIds((prev) => new Set(prev).add(notifId));
    setPopupQueue((prev) => prev.filter((p) => p.notifId !== notifId));
    if (activePopupAlert?.notifId === notifId) {
      setActivePopupAlert(null);
    }
  }, [activePopupAlert]);

  const markAsRead = useCallback(async (id: string | number) => {
    const success = await CentralNotificationService.markAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.notifId === String(id) || n.id === Number(id) ? { ...n, read: true } : n))
      );
    }
    return success;
  }, []);

  const markAllAsRead = useCallback(async () => {
    const success = await CentralNotificationService.markAllAsRead();
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    return success;
  }, []);

  const acknowledgeAlert = useCallback(
    async (id: string | number, note?: string) => {
      const success = await CentralNotificationService.acknowledge(id, note);
      if (success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.notifId === String(id) || n.id === Number(id)
              ? {
                  ...n,
                  read: true,
                  acknowledgedBy: [
                    ...(n.acknowledgedBy || []),
                    {
                      userId: currentUser?.id || currentUser?.username || 'user',
                      userName: currentUser?.fullName || currentUser?.username || 'کاربر',
                      timestamp: new Date().toISOString(),
                      note,
                    },
                  ],
                }
              : n
          )
        );
        closePopup();
      }
      return success;
    },
    [currentUser, closePopup]
  );

  const deleteNotification = useCallback(async (id: string | number) => {
    const success = await CentralNotificationService.delete(id);
    if (success) {
      setNotifications((prev) => prev.filter((n) => n.notifId !== String(id) && n.id !== Number(id)));
    }
    return success;
  }, []);

  const clearAll = useCallback(async () => {
    const success = await CentralNotificationService.clearAll();
    if (success) {
      setNotifications([]);
      setActivePopupAlert(null);
      setPopupQueue([]);
    }
    return success;
  }, []);

  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    const updated = await CentralNotificationService.updatePreferences(newPrefs);
    setPreferences(updated);
  }, []);

  const toggleMute = useCallback(() => {
    const nextVal = !preferences.soundEnabled;
    updatePreferences({ soundEnabled: nextVal });
  }, [preferences.soundEnabled, updatePreferences]);

  const setVolume = useCallback(
    (vol: number) => {
      updatePreferences({ soundVolume: vol });
    },
    [updatePreferences]
  );

  const triggerTestAlert = useCallback(async (category = 'critical_hse', priority = 'critical') => {
    try {
      const { apiDb } = await import('../services/apiDatabaseClient');
      await apiDb.triggerTestAlert({ category, priority });
      await refreshNotifications();
    } catch (e) {
      console.error(e);
    }
  }, [refreshNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const criticalAlerts = useMemo(() => {
    return notifications.filter(
      (n) => n.category === 'critical_hse' || n.priority === 'critical' || n.requiresAck
    );
  }, [notifications]);

  const isMuted = !preferences.soundEnabled;

  const value = {
    currentUser,
    notifications,
    unreadCount,
    criticalAlerts,
    activePopupAlert,
    popupQueue,
    preferences,
    isMuted,
    isSettingsOpen,
    isBroadcastOpen,
    isLoading,
    openSettings: () => setIsSettingsOpen(true),
    closeSettings: () => setIsSettingsOpen(false),
    openBroadcast: () => setIsBroadcastOpen(true),
    closeBroadcast: () => setIsBroadcastOpen(false),
    toggleMute,
    setVolume,
    closePopup,
    dismissPopup,
    markAsRead,
    markAllAsRead,
    acknowledgeAlert,
    deleteNotification,
    clearAll,
    refreshNotifications,
    updatePreferences,
    triggerTestAlert,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
