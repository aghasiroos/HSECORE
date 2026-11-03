import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  CentralNotificationService,
  AppNotification,
  NotificationPreferences,
  getPublicAcknowledgedAlertIds,
  markPublicAlertAcknowledgedLocally,
} from '../services/notificationService';
import { useWebSocket } from '../providers/WebSocketProvider';
import { startSirenLoop, stopSirenLoop } from '../utils/notificationAudio';
import { UserProfile } from '../types';
import { apiDb } from '../services/apiDatabaseClient';

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
  prefsLoaded: boolean;
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
  acknowledgeAlert: (id: string | number, note?: string, acknowledgmentSource?: string) => Promise<boolean>;
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
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Set of dismissed popup notification IDs in current browser session
  const [dismissedPopupIds, setDismissedPopupIds] = useState<Set<string>>(new Set());
  const dismissedPopupIdsRef = React.useRef<Set<string>>(dismissedPopupIds);
  dismissedPopupIdsRef.current = dismissedPopupIds;

  // Deduplication set for real-time incoming alerts across WebSocket + SSE + ServiceWorker Push
  const recentlyProcessedAlertIdsRef = React.useRef<Map<string, number>>(new Map());

  // Automatically register Web Push subscription if notification permission is already granted
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      CentralNotificationService.subscribeToWebPush(currentUser).catch(() => {});
    }
  }, [currentUser?.id, currentUser?.username]);

  // Load preferences on mount, user change, and preference update events
  useEffect(() => {
    let active = true;
    setPrefsLoaded(false);
    CentralNotificationService.loadPreferences(currentUser?.id || currentUser?.username).then((p) => {
      if (active) {
        setPreferences(p);
        setPrefsLoaded(true);
      }
    });

    const handlePrefsEvent = (e: any) => {
      if (e.detail) {
        setPreferences({ ...e.detail });
      }
    };
    window.addEventListener('hse_notif_preferences_updated', handlePrefsEvent);
    return () => {
      active = false;
      window.removeEventListener('hse_notif_preferences_updated', handlePrefsEvent);
    };
  }, [currentUser?.id, currentUser?.username]);

  // Fetch notifications from database (supports authenticated user and login page guest mode)
  const refreshNotifications = useCallback(async () => {
    try {
      if (currentUser?.id) {
        const data = await CentralNotificationService.getNotifications();
        setNotifications(data);

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
        const ackedSet = getPublicAcknowledgedAlertIds();

        const unackPopups = data.filter((n) => {
          if (n.read) return false;
          if (ackedSet.has(n.notifId)) return false;
          if (dismissedPopupIdsRef.current.has(n.notifId)) return false;

          if (
            n.requiresAck &&
            n.acknowledgedBy &&
            n.acknowledgedBy.some((a) => a.userId === currentUser.id || a.userName === currentUser.username)
          ) {
            return false;
          }

          if (popupPref === 'none') return false;
          if (n.type === 'popup' || n.requiresAck) return true;
          if (popupPref === 'all') return true;
          if (popupPref === 'important_and_critical' && (isCriticalAlert(n) || isWorkflowOrReferral(n))) return true;
          if (popupPref === 'critical_only' && isCriticalAlert(n)) return true;

          return false;
        });

        if (unackPopups.length > 0) {
          setPopupQueue((prev) => {
            const existingIds = new Set(prev.map((p) => p.notifId));
            const newItems = unackPopups.filter((u) => !existingIds.has(u.notifId));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      } else {
        // Unauthenticated guest user on Login Screen: fetch only public active emergency alerts
        const activePublicAlerts = await CentralNotificationService.getPublicActiveEmergencyAlerts();
        const ackedSet = getPublicAcknowledgedAlertIds();

        const pendingEmergencies = activePublicAlerts.filter((n) => {
          if (ackedSet.has(n.notifId)) return false;
          if (dismissedPopupIdsRef.current.has(n.notifId)) return false;
          return true;
        });

        setNotifications(pendingEmergencies);

        if (pendingEmergencies.length > 0) {
          setPopupQueue((prev) => {
            const existingIds = new Set(prev.map((p) => p.notifId));
            const newItems = pendingEmergencies.filter((u) => !existingIds.has(u.notifId));
            return newItems.length > 0 ? [...prev, ...newItems] : prev;
          });
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [currentUser?.id, currentUser?.username, preferences.showCenterPopup]);

  // Initial load and network online reconnect listener
  useEffect(() => {
    setIsLoading(true);
    refreshNotifications().finally(() => setIsLoading(false));

    const handleOnline = () => {
      refreshNotifications();
    };

    // Automatic safety polling: 8 seconds on Login Screen (for near-instant public emergency popups), 30s when logged in
    const pollInterval = setInterval(() => {
      refreshNotifications();
    }, currentUser ? 30000 : 8000);

    window.addEventListener('online', handleOnline);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser?.id, refreshNotifications]);

  // Helper to determine if current user is part of target audience
  const isTargetUser = useCallback(
    (notif: AppNotification) => {
      if (!currentUser) {
        return (
          notif.category === 'critical_hse' ||
          notif.priority === 'critical' ||
          notif.priority === 'high' ||
          notif.requiresAck === true ||
          notif.targetType === 'all' ||
          !notif.targetType
        );
      }
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

  // Unified Incoming Alert Processor (Deduplicates across Local Dispatch, Socket.IO, SSE, and Service Worker Push)
  const processIncomingAlert = useCallback(
    (newNotif: AppNotification, sourceChannel: 'local' | 'socket' | 'sse' | 'sw_push' = 'socket') => {
      if (!newNotif) return;

      const notifId = String(newNotif.notifId || newNotif.id || '');
      if (!notifId) return;

      const normalizedNotif: AppNotification = {
        ...newNotif,
        notifId,
      };

      const now = Date.now();
      const contentSig = `${normalizedNotif.category || ''}:${normalizedNotif.title || ''}:${normalizedNotif.sirenType || ''}`;
      const lastProcessedById = recentlyProcessedAlertIdsRef.current.get(notifId);
      const lastProcessedBySig = recentlyProcessedAlertIdsRef.current.get(contentSig);
      if (
        (lastProcessedById && now - lastProcessedById < 12000) ||
        (lastProcessedBySig && now - lastProcessedBySig < 4000)
      ) {
        // Already processed via another real-time channel (local / socket / sse / sw_push)
        return;
      }

      const ackedSet = getPublicAcknowledgedAlertIds();
      if (ackedSet.has(notifId) || dismissedPopupIdsRef.current.has(notifId)) {
        return;
      }

      if (!isTargetUser(normalizedNotif)) {
        return;
      }

      recentlyProcessedAlertIdsRef.current.set(notifId, now);
      recentlyProcessedAlertIdsRef.current.set(contentSig, now);

      const isCritical = normalizedNotif.category === 'critical_hse' || normalizedNotif.priority === 'critical';
      const siren =
        normalizedNotif.sirenType ||
        normalizedNotif.metadata?.sirenType ||
        (isCritical ? 'siren_evacuation' : undefined);
      const playSoundAllowed = normalizedNotif.metadata?.playSound !== false;

      // 1. Add to notification list
      setNotifications((prev) => [normalizedNotif, ...prev.filter((n) => n.notifId !== notifId)]);

      // 2. Dispatch event for real-time bell ringing animation
      window.dispatchEvent(new CustomEvent('hse_new_notification_received', { detail: normalizedNotif }));

      // 3. Queue center popup modal
      const isImportantOrWorkflow =
        normalizedNotif.priority === 'high' ||
        normalizedNotif.category === 'warning' ||
        normalizedNotif.sourceModule === 'workflow' ||
        normalizedNotif.sourceModule === 'referral' ||
        normalizedNotif.sourceModule === 'signature' ||
        normalizedNotif.sourceModule === 'ptw' ||
        normalizedNotif.sourceModule === 'inspection' ||
        normalizedNotif.sourceModule === 'warnings' ||
        normalizedNotif.sourceModule === 'incidents';
      const popupPref = preferences.showCenterPopup || 'important_and_critical';

      const shouldShowPopup =
        normalizedNotif.type === 'popup' ||
        normalizedNotif.requiresAck ||
        isCritical ||
        (!currentUser && (isCritical || normalizedNotif.requiresAck || normalizedNotif.type === 'popup' || normalizedNotif.priority === 'high')) ||
        popupPref === 'all' ||
        (popupPref === 'important_and_critical' && (isCritical || isImportantOrWorkflow)) ||
        (popupPref === 'critical_only' && isCritical);

      const willOpenPopup = shouldShowPopup && popupPref !== 'none';

      if (willOpenPopup) {
        setPopupQueue((prev) => {
          if (prev.some((p) => p.notifId === notifId)) return prev;
          return [...prev, normalizedNotif];
        });
      }

      // 4. Play alert sound / start continuous siren (idempotent single-stream engine prevents any overlap with popup modal)
      if (playSoundAllowed && preferences.soundEnabled) {
        if (isCritical || normalizedNotif.requiresAck) {
          const customUrl =
            preferences.criticalHseAudioMode === 'custom_mp3' && preferences.criticalHseCustomAudioUrl
              ? preferences.criticalHseCustomAudioUrl
              : undefined;
          startSirenLoop(
            siren || 'siren_evacuation',
            preferences.soundVolume || 0.85,
            customUrl,
            normalizedNotif.title
          );
        } else {
          CentralNotificationService.playAlertSound(normalizedNotif.category, normalizedNotif.priority, siren);
        }
      }

      // 5. Native System / Lock Screen Notification via Service Worker
      if (sourceChannel !== 'sw_push' && (isCritical || document.hidden || !currentUser)) {
        CentralNotificationService.dispatchSystemOsNotification(normalizedNotif).catch(() => {});
      }
    },
    [currentUser, isTargetUser, preferences]
  );

  // Listen for real-time Socket.IO events
  useEffect(() => {
    if (!socket) return;

    const onSocketAlert = (notif: AppNotification) => processIncomingAlert(notif, 'socket');
    socket.on('notification_alert', onSocketAlert);
    socket.on('public_emergency_alert', onSocketAlert);

    const handleSocketReconnect = () => {
      refreshNotifications();
    };
    socket.on('connect', handleSocketReconnect);

    return () => {
      socket.off('notification_alert', onSocketAlert);
      socket.off('public_emergency_alert', onSocketAlert);
      socket.off('connect', handleSocketReconnect);
    };
  }, [socket, processIncomingAlert, refreshNotifications]);

  // Redundant Public SSE Stream (Works without login on Login Screen & auto-reconnects if WebSocket is blocked by proxy)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/v1/notifications/public/stream');
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && (parsed.event === 'public_emergency_alert' || parsed.event === 'notification_alert') && parsed.data) {
            processIncomingAlert(parsed.data as AppNotification, 'sse');
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [processIncomingAlert]);

  // Listen to Service Worker messages (Web Push received in background / Lock Screen action button clicked)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'HSE_SW_EMERGENCY_PUSH' && msg.payload) {
        processIncomingAlert(msg.payload as AppNotification, 'sw_push');
      } else if (msg.type === 'HSE_SW_EMERGENCY_ACKNOWLEDGED' && msg.notifId) {
        const ackId = String(msg.notifId);
        // Immediately stop the siren loop on this client
        stopSirenLoop();
        markPublicAlertAcknowledgedLocally(ackId);
        setDismissedPopupIds((prev) => new Set(prev).add(ackId));
        setPopupQueue((prev) => prev.filter((p) => p.notifId !== ackId));
        setActivePopupAlert((curr) => (curr?.notifId === ackId ? null : curr));
        setNotifications((prev) =>
          prev.map((n) => (n.notifId === ackId ? { ...n, read: true } : n))
        );
      } else if (msg.type === 'HSE_SW_EMERGENCY_OPENED' && msg.payload) {
        const alert = msg.payload as AppNotification;
        if (alert && alert.notifId) {
          setPopupQueue((prev) => {
            if (prev.some((p) => p.notifId === alert.notifId)) return prev;
            return [alert, ...prev];
          });
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [processIncomingAlert]);

  // Listen for local system events
  useEffect(() => {
    const handleUpdated = () => {
      refreshNotifications();
    };

    const handleLocalDispatched = (e: any) => {
      const alert = e.detail as AppNotification;
      if (alert) {
        processIncomingAlert(alert, 'local');
      }
    };

    const handlePopupRequest = (e: any) => {
      const alert = e.detail as AppNotification;
      if (alert && alert.notifId) {
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
    window.addEventListener('hse_local_notification_dispatched', handleLocalDispatched);
    window.addEventListener('hse_popup_alert_requested', handlePopupRequest);
    window.addEventListener('hse_notif_preferences_updated', handlePreferencesUpdated);

    return () => {
      window.removeEventListener('hse_notifications_updated', handleUpdated);
      window.removeEventListener('hse_local_notification_dispatched', handleLocalDispatched);
      window.removeEventListener('hse_popup_alert_requested', handlePopupRequest);
      window.removeEventListener('hse_notif_preferences_updated', handlePreferencesUpdated);
    };
  }, [refreshNotifications, processIncomingAlert]);

  // Synchronize activePopupAlert from queue
  useEffect(() => {
    if (!activePopupAlert && popupQueue.length > 0) {
      setActivePopupAlert(popupQueue[0]);
    }
  }, [activePopupAlert, popupQueue]);

  const closePopup = useCallback(() => {
    stopSirenLoop();
    if (activePopupAlert) {
      setDismissedPopupIds((prev) => new Set(prev).add(activePopupAlert.notifId));
      CentralNotificationService.closeSystemOsNotification(activePopupAlert.notifId).catch(() => {});
    }
    setActivePopupAlert(null);
    setPopupQueue((prev) => prev.slice(1));
  }, [activePopupAlert]);

  const dismissPopup = useCallback(
    (notifId: string) => {
      stopSirenLoop();
      setDismissedPopupIds((prev) => new Set(prev).add(notifId));
      CentralNotificationService.closeSystemOsNotification(notifId).catch(() => {});
      setPopupQueue((prev) => prev.filter((p) => p.notifId !== notifId));
      if (activePopupAlert?.notifId === notifId) {
        setActivePopupAlert(null);
      }
    },
    [activePopupAlert]
  );

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
    async (id: string | number, note?: string, acknowledgmentSource?: string) => {
      const idStr = String(id);
      // Immediately stop the siren on this device before network round-trip
      stopSirenLoop();
      let success = false;

      if (currentUser?.id) {
        success = await CentralNotificationService.acknowledge(
          id,
          note,
          acknowledgmentSource || 'in_app_modal'
        );
      } else {
        success = await CentralNotificationService.acknowledgePublic(
          id,
          note,
          acknowledgmentSource || 'login_screen'
        );
      }

      if (success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.notifId === idStr || n.id === Number(id)
              ? {
                  ...n,
                  read: true,
                  acknowledgedBy: [
                    ...(n.acknowledgedBy || []),
                    {
                      userId: currentUser?.id || currentUser?.username || 'guest_user',
                      userName: currentUser?.fullName || currentUser?.username || 'کاربر (صفحه ورود)',
                      timestamp: new Date().toISOString(),
                      note,
                      acknowledgmentSource: acknowledgmentSource || (currentUser?.id ? 'in_app_modal' : 'login_screen'),
                      status: 'acknowledged',
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

  const triggerTestAlert = useCallback(
    async (category = 'critical_hse', priority = 'critical') => {
      try {
        await apiDb.triggerTestAlert({ category, priority });
        await refreshNotifications();
        window.dispatchEvent(
          new CustomEvent('hse_new_notification_received', {
            detail: { notifId: `test-${Date.now()}`, category, priority, read: false },
          })
        );
      } catch (e) {
        console.error(e);
      }
    },
    [refreshNotifications]
  );

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
    prefsLoaded,
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
