import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  CentralNotificationService,
  AppNotification,
  NotificationPreferences,
  getPublicAcknowledgedAlertIds,
  markPublicAlertAcknowledgedLocally,
  isNotificationAcknowledgedOrDismissed,
  HSE_NOTIF_ACKED_IDS_KEY,
  HSE_NOTIF_LOCKSCREEN_CONFIRMED_KEY,
} from '../services/notificationService';
import { useWebSocket } from '../providers/WebSocketProvider';
import { startSirenLoop, stopSirenLoop } from '../utils/notificationAudio';
import { UserProfile } from '../types';
import { apiDb } from '../services/apiDatabaseClient';
import { getCurrentUser } from '../utils/authHelper';
import { toast } from 'react-hot-toast';

interface NotificationContextType {
  currentUser: UserProfile | null;
  notifications: AppNotification[];
  unreadCount: number;
  criticalAlerts: AppNotification[];
  activePopupAlert: AppNotification | null;
  selectedAlertDetails: AppNotification | null;
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
  openAlertDetails: (notifOrId: AppNotification | string) => Promise<void>;
  closeAlertDetails: () => void;
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
    return getCurrentUser();
  });

  const currentUser = propsUser !== undefined ? propsUser : internalUser;

  // Listen to auth state updates for user login/logout
  useEffect(() => {
    if (propsUser !== undefined) return;
    const checkUser = () => {
      setInternalUser(getCurrentUser());
    };
    window.addEventListener('hse_auth_state_changed', checkUser);
    window.addEventListener('hse_current_user_updated', checkUser);
    return () => {
      window.removeEventListener('hse_auth_state_changed', checkUser);
      window.removeEventListener('hse_current_user_updated', checkUser);
    };
  }, [propsUser]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(() =>
    CentralNotificationService.getPreferences()
  );
  const [activePopupAlert, setActivePopupAlert] = useState<AppNotification | null>(null);
  const [selectedAlertDetails, setSelectedAlertDetails] = useState<AppNotification | null>(null);
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
      CentralNotificationService.subscribeToWebPush(currentUser as any).catch(() => {});
    }
  }, [currentUser?.id, currentUser?.username]);

  // Load preferences on mount, user change, and preference update events
  useEffect(() => {
    let active = true;
    setPrefsLoaded(false);
    CentralNotificationService.loadPreferences(
      currentUser?.id || (currentUser as any)?.uid || currentUser?.username,
      currentUser?.username
    ).then((p) => {
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

      const uCode = String(
        currentUser.personnelNumber || (currentUser as any).personnelCode || ''
      )
        .trim()
        .toLowerCase();
      const uid = String(currentUser.id || (currentUser as any).uid || '').trim().toLowerCase();
      const uname = (currentUser.username || '').trim().toLowerCase();
      const fullName = (currentUser.fullName || '').trim().toLowerCase();
      const matchesUserValue = (v: any) => {
        const val = String(v || '').trim().toLowerCase();
        if (!val) return false;
        return (
          (uid && val === uid) ||
          (uname && val === uname) ||
          (uCode && val === uCode) ||
          (fullName && val === fullName)
        );
      };

      if (targetType === 'unit_managers') {
        const role = (currentUser.role || '').toLowerCase();
        const jt = (currentUser.jobTitle || '').toLowerCase();
        const isMgr =
          role.includes('manager') ||
          role.includes('supervisor') ||
          role.includes('executive') ||
          role.includes('admin') ||
          jt.includes('مدیر') ||
          jt.includes('رئیس') ||
          jt.includes('سرپرست') ||
          jt.includes('مسئول واحد') ||
          jt.includes('فرمانده') ||
          Boolean((currentUser as any).ptwQualification?.responsibilities?.areaSupervisor) ||
          Boolean((currentUser as any).ptwQualification?.responsibilities?.issuer);
        if (values.length > 0) {
          return isMgr || values.some(matchesUserValue);
        }
        return isMgr;
      }

      if (targetType === 'hse_experts') {
        const role = (currentUser.role || '').toLowerCase();
        const jt = (currentUser.jobTitle || '').toLowerCase();
        const deptIds = (currentUser.departmentIds || []).map((d) => String(d).toLowerCase());
        const isHse =
          role.includes('hse') ||
          role.includes('safety') ||
          role.includes('inspector') ||
          role.includes('medical') ||
          role.includes('auditor') ||
          role.includes('admin') ||
          jt.includes('hse') ||
          jt.includes('ایمنی') ||
          jt.includes('بهداشت') ||
          jt.includes('محیط زیست') ||
          jt.includes('آتش‌نشان') ||
          jt.includes('بازرس') ||
          deptIds.some((d) => d.includes('hse') || d.includes('safety') || d.includes('ایمنی')) ||
          Boolean((currentUser as any).ptwQualification?.responsibilities?.safetyUnit);
        if (values.length > 0) {
          return isHse || values.some(matchesUserValue);
        }
        return isHse;
      }

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
        return values.some(matchesUserValue);
      }
      return true;
    },
    [currentUser]
  );

  // Fetch notifications from database (supports authenticated user and login page guest mode)
  const refreshNotifications = useCallback(async () => {
    try {
      if (currentUser?.id) {
        const data = await CentralNotificationService.getNotifications();
        setNotifications(data);
        setSelectedAlertDetails((curr) => {
          if (!curr) return null;
          const updated = data.find((d) => d.notifId === curr.notifId);
          return updated ? { ...curr, ...updated } : curr;
        });

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
          if (isNotificationAcknowledgedOrDismissed(n, currentUser as any)) return false;
          if (dismissedPopupIdsRef.current.has(n.notifId)) return false;
          if (!isTargetUser(n)) return false;

          if (popupPref === 'none') return false;
          if (n.type === 'popup' || n.type === 'popup_and_push' || n.requiresAck) return true;
          if (popupPref === 'all') return true;
          if (popupPref === 'important_and_critical' && (isCriticalAlert(n) || isWorkflowOrReferral(n))) return true;
          if (popupPref === 'critical_only' && isCriticalAlert(n)) return true;

          return false;
        });

        // Prune any queued/active popups that have since been acknowledged/read
        const ackedByServerOrLocal = (p: AppNotification) => {
          const fresh = data.find((d) => d.notifId === p.notifId);
          return (
            isNotificationAcknowledgedOrDismissed(fresh || p, currentUser as any) ||
            dismissedPopupIdsRef.current.has(p.notifId)
          );
        };

        setActivePopupAlert((curr) => {
          if (curr && ackedByServerOrLocal(curr)) {
            stopSirenLoop();
            return null;
          }
          return curr;
        });

        setPopupQueue((prev) => {
          const kept = prev.filter((p) => !ackedByServerOrLocal(p));
          const existingIds = new Set(kept.map((p) => p.notifId));
          const newItems = unackPopups.filter((u) => !existingIds.has(u.notifId));
          return newItems.length > 0 || kept.length !== prev.length ? [...kept, ...newItems] : prev;
        });
      } else {
        // Unauthenticated guest user on Login Screen: fetch only public active emergency alerts
        const activePublicAlerts = await CentralNotificationService.getPublicActiveEmergencyAlerts();

        const pendingEmergencies = activePublicAlerts.filter((n) => {
          if (isNotificationAcknowledgedOrDismissed(n, null)) return false;
          if (dismissedPopupIdsRef.current.has(n.notifId)) return false;
          return true;
        });

        setNotifications(pendingEmergencies);

        setActivePopupAlert((curr) => {
          if (curr && (isNotificationAcknowledgedOrDismissed(curr, null) || dismissedPopupIdsRef.current.has(curr.notifId))) {
            stopSirenLoop();
            return null;
          }
          return curr;
        });

        setPopupQueue((prev) => {
          const kept = prev.filter(
            (p) => !isNotificationAcknowledgedOrDismissed(p, null) && !dismissedPopupIdsRef.current.has(p.notifId)
          );
          const existingIds = new Set(kept.map((p) => p.notifId));
          const newItems = pendingEmergencies.filter((u) => !existingIds.has(u.notifId));
          return newItems.length > 0 || kept.length !== prev.length ? [...kept, ...newItems] : prev;
        });
      }
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isTransientProxyOrAuth =
        err?.status === 401 ||
        err?.status === 502 ||
        err?.status === 503 ||
        err?.status === 504 ||
        err?.status === 0 ||
        (err?.status === 200 && msg.includes('پاسخ نامعتبر')) ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError');
      if (isTransientProxyOrAuth) {
        console.warn('[Notifications] Transient polling delay; will retry on next cycle:', msg);
      } else {
        console.warn('[Notifications] Unable to refresh notifications:', err);
      }
    }
  }, [currentUser, isTargetUser, preferences.showCenterPopup]);

  // Initial load and network online reconnect listener
  useEffect(() => {
    setIsLoading(true);
    refreshNotifications().finally(() => setIsLoading(false));

    const handleOnline = () => {
      refreshNotifications();
    };

    // Cross-tab synchronization: acknowledging or confirming readiness in one tab immediately updates all tabs
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === HSE_NOTIF_ACKED_IDS_KEY) {
        const ackedSet = getPublicAcknowledgedAlertIds();
        setActivePopupAlert((curr) => {
          if (curr && (ackedSet.has(curr.notifId) || (curr.id !== undefined && ackedSet.has(String(curr.id))))) {
            stopSirenLoop();
            return null;
          }
          return curr;
        });
        setPopupQueue((prev) =>
          prev.filter(
            (p) => !ackedSet.has(p.notifId) && !(p.id !== undefined && ackedSet.has(String(p.id)))
          )
        );
      } else if (e.key === HSE_NOTIF_LOCKSCREEN_CONFIRMED_KEY) {
        if (
          CentralNotificationService.isLockScreenSirenConfirmed(
            currentUser?.id || (currentUser as any)?.uid,
            currentUser?.username
          )
        ) {
          setPreferences((prev) => ({ ...prev, lockScreenSirenConfirmed: true }));
        }
      }
    };

    // Automatic safety polling: 8 seconds on Login Screen (for near-instant public emergency popups), 30s when logged in
    const pollInterval = setInterval(() => {
      refreshNotifications();
    }, currentUser ? 30000 : 8000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('storage', handleStorageSync);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, [currentUser?.id, currentUser?.username, refreshNotifications]);

  // Open Alert Details Modal & record view confirmation
  const openAlertDetails = useCallback(
    async (notifOrId: AppNotification | string) => {
      if (typeof notifOrId === 'object' && notifOrId !== null) {
        setSelectedAlertDetails(notifOrId);
        CentralNotificationService.confirmAlertViewed(
          notifOrId.notifId,
          'alert_details_view',
          currentUser?.id || currentUser?.username,
          currentUser?.fullName || currentUser?.username
        ).catch(() => {});
        const fresh = await apiDb.getNotificationById(notifOrId.notifId);
        if (fresh) {
          setSelectedAlertDetails((prev) =>
            prev && prev.notifId === notifOrId.notifId ? { ...prev, ...fresh } : prev
          );
        }
        return;
      }

      const idStr = String(notifOrId || '').trim();
      if (!idStr) return;

      const existing = notifications.find((n) => n.notifId === idStr || String(n.id) === idStr);
      if (existing) {
        setSelectedAlertDetails(existing);
      }

      CentralNotificationService.confirmAlertViewed(
        idStr,
        'alert_details_view',
        currentUser?.id || currentUser?.username,
        currentUser?.fullName || currentUser?.username
      ).catch(() => {});

      const fresh = await apiDb.getNotificationById(idStr);
      if (fresh) {
        setSelectedAlertDetails({
          ...fresh,
          notifId: fresh.notifId || fresh.id || idStr,
          createdAt: fresh.createdAt || new Date().toISOString(),
        });
      }
    },
    [notifications, currentUser]
  );

  const closeAlertDetails = useCallback(() => {
    setSelectedAlertDetails(null);
    // Clean alertId query param from URL hash if present
    if (typeof window !== 'undefined' && window.location.hash.includes('alertId=')) {
      const baseHash = window.location.hash.split('?')[0] || '#dashboard';
      window.history.replaceState(null, '', baseHash);
    }
  }, []);

  // Deep-Link Listener: When user clicks a Browser Push notification, URL opens with #notifications?alertId=<notifId>
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDeepLinkAlert = async () => {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      let alertId = '';

      if (hash.includes('alertId=')) {
        const qPart = hash.split('?')[1] || '';
        const params = new URLSearchParams(qPart);
        alertId = params.get('alertId') || '';
      } else if (search.includes('alertId=')) {
        const params = new URLSearchParams(search);
        alertId = params.get('alertId') || '';
      }

      if (alertId) {
        await CentralNotificationService.confirmAlertViewed(
          alertId,
          'browser_push_click',
          currentUser?.id || currentUser?.username,
          currentUser?.fullName || currentUser?.username
        );
        await openAlertDetails(alertId);
      }
    };

    checkDeepLinkAlert();
    window.addEventListener('hashchange', checkDeepLinkAlert);
    return () => {
      window.removeEventListener('hashchange', checkDeepLinkAlert);
    };
  }, [currentUser?.id, currentUser?.username, openAlertDetails]);

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
        // If deliveryReport arrived on a subsequent update, merge it into state
        if (normalizedNotif.deliveryReport) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.notifId === notifId ? { ...n, deliveryReport: normalizedNotif.deliveryReport } : n
            )
          );
        }
        return;
      }

      if (
        isNotificationAcknowledgedOrDismissed(normalizedNotif, currentUser as any) ||
        dismissedPopupIdsRef.current.has(notifId)
      ) {
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

      // 3. Queue center popup modal (Simultaneous Popup + Browser Push)
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
        normalizedNotif.type === 'popup_and_push' ||
        normalizedNotif.requiresAck ||
        isCritical ||
        (!currentUser &&
          (isCritical ||
            normalizedNotif.requiresAck ||
            normalizedNotif.type === 'popup' ||
            normalizedNotif.type === 'popup_and_push' ||
            normalizedNotif.priority === 'high')) ||
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

      // 5. Simultaneous Native System / Browser Notification via Service Worker
      if (
        sourceChannel !== 'sw_push' &&
        (normalizedNotif.type === 'popup_and_push' ||
          normalizedNotif.type === 'push' ||
          isCritical ||
          document.hidden ||
          !currentUser)
      ) {
        CentralNotificationService.dispatchSystemOsNotification(normalizedNotif).catch(() => {});
      }
    },
    [currentUser, isTargetUser, preferences]
  );

  // Listen for real-time Socket.IO events (including delivery report & view confirmation updates)
  useEffect(() => {
    if (!socket) return;

    const onSocketAlert = (notif: AppNotification) => processIncomingAlert(notif, 'socket');
    const onDeliveryReport = (payload: { notifId: string; deliveryReport: any }) => {
      if (!payload?.notifId) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.notifId === payload.notifId ? { ...n, deliveryReport: payload.deliveryReport } : n
        )
      );
      setSelectedAlertDetails((curr) =>
        curr && curr.notifId === payload.notifId
          ? { ...curr, deliveryReport: payload.deliveryReport }
          : curr
      );
    };
    const onViewed = (payload: { notifId: string; viewedBy: any }) => {
      if (!payload?.notifId || !payload?.viewedBy) return;
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.notifId !== payload.notifId) return n;
          const list = Array.isArray(n.viewedBy) ? n.viewedBy : [];
          if (list.some((v) => v.userId === payload.viewedBy.userId)) return n;
          return { ...n, viewedBy: [...list, payload.viewedBy] };
        })
      );
      setSelectedAlertDetails((curr) => {
        if (!curr || curr.notifId !== payload.notifId) return curr;
        const list = Array.isArray(curr.viewedBy) ? curr.viewedBy : [];
        if (list.some((v) => v.userId === payload.viewedBy.userId)) return curr;
        return { ...curr, viewedBy: [...list, payload.viewedBy] };
      });
    };

    socket.on('notification_alert', onSocketAlert);
    socket.on('public_emergency_alert', onSocketAlert);
    socket.on('notification_delivery_report', onDeliveryReport);
    socket.on('notification_viewed', onViewed);

    const handleSocketReconnect = () => {
      refreshNotifications();
    };
    socket.on('connect', handleSocketReconnect);

    return () => {
      socket.off('notification_alert', onSocketAlert);
      socket.off('public_emergency_alert', onSocketAlert);
      socket.off('notification_delivery_report', onDeliveryReport);
      socket.off('notification_viewed', onViewed);
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
          CentralNotificationService.confirmAlertViewed(
            alert.notifId,
            'browser_push_click',
            currentUser?.id || currentUser?.username,
            currentUser?.fullName || currentUser?.username
          ).catch(() => {});
          openAlertDetails(alert);
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
  }, [processIncomingAlert, currentUser, openAlertDetails]);

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
      if (
        alert &&
        alert.notifId &&
        !isNotificationAcknowledgedOrDismissed(alert, currentUser as any) &&
        !dismissedPopupIdsRef.current.has(alert.notifId)
      ) {
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

  // Synchronize activePopupAlert from queue & record in_app_popup view confirmation
  useEffect(() => {
    if (!activePopupAlert && popupQueue.length > 0) {
      const nextAlert = popupQueue[0];
      setActivePopupAlert(nextAlert);
      if (nextAlert?.notifId) {
        CentralNotificationService.confirmAlertViewed(
          nextAlert.notifId,
          'in_app_popup',
          currentUser?.id || currentUser?.username,
          currentUser?.fullName || currentUser?.username
        ).catch(() => {});
      }
    }
  }, [activePopupAlert, popupQueue, currentUser]);

  const closePopup = useCallback(() => {
    stopSirenLoop();
    const closingAlert = activePopupAlert;
    if (closingAlert) {
      markPublicAlertAcknowledgedLocally(closingAlert.notifId, closingAlert.id);
      setDismissedPopupIds((prev) => new Set(prev).add(closingAlert.notifId));
      CentralNotificationService.closeSystemOsNotification(closingAlert.notifId).catch(() => {});
      setPopupQueue((prev) => prev.filter((p) => p.notifId !== closingAlert.notifId));
    } else {
      setPopupQueue((prev) => prev.slice(1));
    }
    setActivePopupAlert(null);
  }, [activePopupAlert]);

  const dismissPopup = useCallback(
    (notifId: string) => {
      stopSirenLoop();
      markPublicAlertAcknowledgedLocally(notifId);
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
    const idStr = String(id);
    markPublicAlertAcknowledgedLocally(idStr);
    setDismissedPopupIds((prev) => new Set(prev).add(idStr));
    setPopupQueue((prev) => prev.filter((p) => p.notifId !== idStr && String(p.id) !== idStr));
    setActivePopupAlert((curr) =>
      curr && (curr.notifId === idStr || String(curr.id) === idStr) ? null : curr
    );
    try {
      const success = await CentralNotificationService.markAsRead(id);
      if (success) {
        setNotifications((prev) =>
          prev.map((n) => (n.notifId === idStr || n.id === Number(id) ? { ...n, read: true } : n))
        );
      }
      return success;
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت وضعیت مطالعه اعلان');
      return false;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const success = await CentralNotificationService.markAllAsRead();
      if (success) {
        setNotifications((prev) => {
          prev.forEach((n) => markPublicAlertAcknowledgedLocally(n.notifId, n.id));
          return prev.map((n) => ({ ...n, read: true }));
        });
        stopSirenLoop();
        setPopupQueue([]);
        setActivePopupAlert(null);
      }
      return success;
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت وضعیت مطالعه اعلان‌ها');
      return false;
    }
  }, []);

  const acknowledgeAlert = useCallback(
    async (id: string | number, note?: string, acknowledgmentSource?: string) => {
      const idStr = String(id);
      const matched =
        (activePopupAlert && (activePopupAlert.notifId === idStr || String(activePopupAlert.id) === idStr)
          ? activePopupAlert
          : null) ||
        popupQueue.find((n) => n.notifId === idStr || String(n.id) === idStr) ||
        notifications.find((n) => n.notifId === idStr || String(n.id) === idStr);

      stopSirenLoop();
      // Persist immediately on client so even an instant refresh or tab switch never re-opens this popup
      markPublicAlertAcknowledgedLocally(matched?.notifId || idStr, matched?.id);
      setDismissedPopupIds((prev) => {
        const next = new Set(prev);
        next.add(idStr);
        if (matched?.notifId) next.add(matched.notifId);
        return next;
      });

      const removeFromQueues = () => {
        setPopupQueue((prev) =>
          prev.filter((p) => p.notifId !== idStr && String(p.id) !== idStr && p.notifId !== matched?.notifId)
        );
        setActivePopupAlert((curr) =>
          curr && (curr.notifId === idStr || String(curr.id) === idStr || curr.notifId === matched?.notifId)
            ? null
            : curr
        );
      };

      try {
        const success = currentUser?.id
          ? await CentralNotificationService.acknowledge(
              id,
              note,
              acknowledgmentSource || 'in_app_modal'
            )
          : await CentralNotificationService.acknowledgePublic(
              id,
              note,
              acknowledgmentSource || 'login_screen'
            );

        if (success) {
          const ackObj = {
            userId: currentUser?.id || currentUser?.username || 'guest_user',
            userName: currentUser?.fullName || currentUser?.username || 'کاربر (صفحه ورود)',
            timestamp: new Date().toISOString(),
            note,
            acknowledgmentSource: acknowledgmentSource || (currentUser?.id ? 'in_app_modal' : 'login_screen'),
            status: 'acknowledged',
          };
          setNotifications((prev) =>
            prev.map((n) =>
              n.notifId === idStr || n.id === Number(id)
                ? {
                    ...n,
                    read: true,
                    acknowledgedBy: [...(n.acknowledgedBy || []), ackObj],
                  }
                : n
            )
          );
          setSelectedAlertDetails((curr) =>
            curr && (curr.notifId === idStr || curr.id === Number(id))
              ? {
                  ...curr,
                  read: true,
                  acknowledgedBy: [...(curr.acknowledgedBy || []), ackObj],
                }
              : curr
          );
          removeFromQueues();
        }
        return success;
      } catch (err: any) {
        removeFromQueues();
        toast.error(err?.message || 'خطا در ثبت تاییدیه هشدار در پایگاه داده');
        return false;
      }
    },
    [currentUser, activePopupAlert, popupQueue, notifications]
  );

  const deleteNotification = useCallback(async (id: string | number) => {
    try {
      const success = await CentralNotificationService.delete(id);
      if (success) {
        setNotifications((prev) => prev.filter((n) => n.notifId !== String(id) && n.id !== Number(id)));
        setSelectedAlertDetails((curr) =>
          curr && (curr.notifId === String(id) || curr.id === Number(id)) ? null : curr
        );
      }
      return success;
    } catch (err: any) {
      toast.error(err?.message || 'خطا در حذف اعلان از پایگاه داده');
      return false;
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      const success = await CentralNotificationService.clearAll();
      if (success) {
        setNotifications([]);
        setActivePopupAlert(null);
        setSelectedAlertDetails(null);
        setPopupQueue([]);
      }
      return success;
    } catch (err: any) {
      toast.error(err?.message || 'خطا در پاک‌سازی اعلان‌ها در پایگاه داده');
      return false;
    }
  }, []);

  const updatePreferences = useCallback(async (newPrefs: Partial<NotificationPreferences>) => {
    try {
      const updated = await CentralNotificationService.updatePreferences(newPrefs);
      setPreferences(updated);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ذخیره تنظیمات اعلان در پایگاه داده');
    }
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
      } catch (e: any) {
        toast.error(e?.message || 'خطا در ارسال هشدار آزمایشی');
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
    selectedAlertDetails,
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
    openAlertDetails,
    closeAlertDetails,
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
