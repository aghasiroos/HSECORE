import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { apiDb, getAuthToken } from '../services/apiDatabaseClient';
import { getCurrentUser, refreshCurrentUserFromServer } from '../utils/authHelper';
import { fetchCentralPersonnelList } from '../utils/personnelHelper';
import { centralSync } from '../services/centralSyncService';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  lastEventSeq: number;
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  lastEventSeq: 0,
  subscribe: () => {},
  unsubscribe: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

interface ProviderProps {
  children: ReactNode;
}

// Bounded event deduplication across Socket.IO + SSE + reconnect catchup
const SEEN_EVENT_IDS_CAP = 500;
const seenEventIds: string[] = [];
const seenEventIdSet = new Set<string>();
let globalLastEventSeq = 0;

function trackIncomingEvent(payload: any): boolean {
  if (payload && typeof payload === 'object') {
    const eid = typeof payload.eventId === 'string' ? payload.eventId : '';
    if (eid) {
      if (seenEventIdSet.has(eid)) {
        return false;
      }
      seenEventIdSet.add(eid);
      seenEventIds.push(eid);
      if (seenEventIds.length > SEEN_EVENT_IDS_CAP) {
        const evicted = seenEventIds.shift();
        if (evicted) seenEventIdSet.delete(evicted);
      }
    }
    if (typeof payload.seq === 'number' && payload.seq > globalLastEventSeq) {
      globalLastEventSeq = payload.seq;
    }
  }
  return true;
}

let lastMutationSig = '';
let lastMutationTime = 0;

export function dispatchGlobalDataMutation(payload: any) {
  if (!trackIncomingEvent(payload)) {
    return;
  }

  const settingKey = String(payload?.key || payload?.data?.key || '').trim();
  const rawType = String(settingKey || payload?.entityType || payload?.entity || payload?.module || '').toLowerCase();
  const now = Date.now();
  const sig = `${rawType}:${payload?.action || payload?.operation || ''}:${payload?.recordId || ''}`;
  if (!payload?.eventId && sig && sig === lastMutationSig && now - lastMutationTime < 300) {
    return;
  }
  lastMutationSig = sig;
  lastMutationTime = now;

  if (settingKey) {
    apiDb.invalidateCache(
      `settings:${settingKey}`,
      `settings-meta:${settingKey}`,
      `collection:${settingKey}`,
      'settings:all',
      'sync:full',
      'dashboard'
    );
  } else if (rawType && rawType !== 'settings') {
    apiDb.invalidateCache(rawType, `${rawType}s`, `${rawType}:list`, `collection:${rawType}`, 'sync:full', 'dashboard');
  } else if (rawType === 'settings') {
    apiDb.invalidateCache('settings:all', 'sync:full', 'dashboard');
  } else {
    apiDb.invalidateCache();
  }

  if (typeof window === 'undefined') return;

  const enrichedPayload = settingKey ? { ...payload, key: settingKey, entityType: settingKey } : payload;

  // Real-time User-to-Personnel Assignment & Lifecycle Propagation across all open browsers/sessions
  if (rawType.includes('user_assignment') || rawType.includes('user') || rawType.includes('personnel')) {
    if (!rawType.includes('user_preference')) {
      apiDb.invalidateCache();
      const curUser = getCurrentUser();
      const targetUid = payload?.data?.uid || payload?.uid;
      const affectedUids: string[] = Array.isArray(payload?.data?.affectedUserUids)
        ? payload.data.affectedUserUids
        : [];
      const isTargetingCurrentUser =
        !targetUid ||
        (curUser &&
          (String(curUser.id) === String(targetUid) ||
            String((curUser as any).uid) === String(targetUid) ||
            curUser.username === payload?.data?.username ||
            affectedUids.includes(String(curUser.id)) ||
            affectedUids.includes(String((curUser as any).uid))));

      refreshCurrentUserFromServer()
        .then((freshUser) => {
          return fetchCentralPersonnelList(true).then((freshPersonnel) => {
            window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: freshPersonnel }));
            window.dispatchEvent(new CustomEvent('hse_user_assignments_updated', { detail: freshUser }));
            window.dispatchEvent(new CustomEvent('hse_permits_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('hse_incidents_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('hse_medical_data_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('hse_warnings_updated', { detail: payload }));
            if (rawType.includes('user_assignment') && isTargetingCurrentUser) {
              toast.success('دسترسی اشخاص مرتبط حساب کاربری شما به‌صورت آنی بروزرسانی شد.', {
                id: 'user-assignments-live-sync',
              });
            }
          });
        })
        .catch(() => {});
    }
  }

  // Universal mutation events
  window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: enrichedPayload }));
  window.dispatchEvent(new CustomEvent('hse_data_mutated', { detail: enrichedPayload }));

  // Module-specific instant dispatches
  if (rawType.includes('user_preference')) {
    apiDb.invalidateCache('user-prefs');
    window.dispatchEvent(new CustomEvent('hse_user_preferences_updated', { detail: payload }));
  }
  if (rawType.includes('personnel')) {
    window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: payload }));
  }
  if (rawType.includes('user') && !rawType.includes('user_preference')) {
    window.dispatchEvent(new CustomEvent('hse_users_updated', { detail: payload }));
  }
  if (rawType.includes('permit') || rawType.includes('ptw')) {
    window.dispatchEvent(new CustomEvent('hse_permits_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_ptw_audits_updated', { detail: payload }));
  }
  if (rawType.includes('incident')) {
    window.dispatchEvent(new CustomEvent('hse_incidents_updated', { detail: payload }));
  }
  if (rawType.includes('health') || rawType.includes('medical') || rawType.includes('exam')) {
    window.dispatchEvent(new CustomEvent('hse_medical_data_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_occ_health_data_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_health_env_updated', { detail: payload }));
  }
  if (rawType.includes('clinic')) {
    window.dispatchEvent(new CustomEvent('hse_clinic_visits_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_health_env_updated', { detail: payload }));
  }
  if (rawType.includes('nutrition')) {
    window.dispatchEvent(new CustomEvent('hse_nutrition_records_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_health_env_updated', { detail: payload }));
  }
  if (rawType.includes('department') || rawType.includes('org') || rawType.includes('node') || rawType.includes('unit')) {
    window.dispatchEvent(new CustomEvent('hse_org_nodes_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_org_jobs_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_departments_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_unit_structure_updated', { detail: payload }));
  }
  if (rawType.includes('setting') || rawType.includes('brand') || rawType.includes('ui_config')) {
    window.dispatchEvent(new CustomEvent('hse_system_branding_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_ui_config_updated', { detail: payload }));
  }
  if (rawType.includes('notif')) {
    window.dispatchEvent(new CustomEvent('hse_notifications_updated', { detail: payload }));
  }
  if (rawType.includes('fire_design')) {
    window.dispatchEvent(new CustomEvent('hse_fire_design_updated', { detail: payload }));
  }
  if (rawType.includes('fire')) {
    window.dispatchEvent(new CustomEvent('hse_fire_daily_reports_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('fire_dept_config_updated', { detail: payload }));
  }
  if (rawType.includes('fives') || rawType.includes('5s')) {
    window.dispatchEvent(new CustomEvent('five_s_data_updated', { detail: payload }));
  }
  if (rawType.includes('risk') || rawType.includes('jsa') || rawType.includes('fmea') || rawType.includes('fta') || rawType.includes('hha')) {
    window.dispatchEvent(new CustomEvent('hse_risks_updated', { detail: payload }));
  }
  if (rawType.includes('lifting')) {
    window.dispatchEvent(new CustomEvent('hse_lifting_updated', { detail: payload }));
  }
  if (rawType.includes('sds')) {
    window.dispatchEvent(new CustomEvent('hse_sds_updated', { detail: payload }));
  }
  if (rawType.includes('psm')) {
    window.dispatchEvent(new CustomEvent('hse_psm_updated', { detail: payload }));
  }
  if (rawType.includes('non_conform') || rawType.includes('nonconform') || rawType.includes('capa')) {
    window.dispatchEvent(new CustomEvent('hse_non_conformances_updated', { detail: payload }));
  }
  if (rawType.includes('warn')) {
    window.dispatchEvent(new CustomEvent('hse_warnings_updated', { detail: payload }));
  }
  if (rawType.includes('trir')) {
    window.dispatchEvent(new CustomEvent('hse_trir_updated', { detail: payload }));
    if (payload?.key === 'trir_target' || payload?.target) {
      window.dispatchEvent(new CustomEvent('hse_trir_target_changed', { detail: payload }));
    }
  }
  if (rawType.includes('train') || rawType.includes('course') || rawType.includes('contractor')) {
    window.dispatchEvent(new CustomEvent('hse_training_updated', { detail: payload }));
  }
  if (rawType.includes('ppe')) {
    window.dispatchEvent(new CustomEvent('hse_ppe_updated', { detail: payload }));
  }
  if (rawType.includes('safety') || rawType.includes('inspection') || rawType.includes('template')) {
    window.dispatchEvent(new CustomEvent('hse_safety_inspections_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_safety_templates_updated', { detail: payload }));
  }
  if (rawType.includes('workflow') || rawType.includes('bpmn') || rawType.includes('process') || rawType.includes('task')) {
    window.dispatchEvent(new CustomEvent('hse_process_management_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_workflows_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_tasks_updated', { detail: payload }));
  }
  if (rawType.includes('referral') || rawType.includes('cartable') || rawType.includes('document')) {
    window.dispatchEvent(new CustomEvent('hse_document_referrals_updated', { detail: payload }));
  }
  if (rawType.includes('environment')) {
    window.dispatchEvent(new CustomEvent('hse_environmental_logs_updated', { detail: payload }));
  }
  if (rawType.includes('dashboard') || rawType.includes('trir') || rawType.includes('incident') || rawType.includes('permit') || rawType.includes('risk') || rawType.includes('non_conform')) {
    window.dispatchEvent(new CustomEvent('hse_dashboard_updated', { detail: payload }));
  }
  if (rawType.includes('heat')) {
    window.dispatchEvent(new CustomEvent('hse_heat_log_updated', { detail: payload }));
  }
}

export const WebSocketProvider: React.FC<ProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventSeq, setLastEventSeq] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const createAuthenticatedSocket = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const token = getAuthToken();
      const socketInstance = io(window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: token ? { token } : undefined,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2500,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        autoConnect: true,
      });

      socketInstance.on('connect', () => {
        setIsConnected(true);
      });

      socketInstance.on('sync:hello', (hello: { authenticated?: boolean; latestSeq?: number }) => {
        if (!hello?.authenticated || typeof hello.latestSeq !== 'number') return;

        if (globalLastEventSeq > 0 && hello.latestSeq > globalLastEventSeq) {
          socketInstance.emit('sync:catchup', { sinceSeq: globalLastEventSeq }, async (res: any) => {
            if (res?.success && Array.isArray(res.events) && !res.resyncRequired) {
              for (const ev of res.events) {
                dispatchGlobalDataMutation(ev);
              }
              setLastEventSeq(globalLastEventSeq);
            } else {
              try {
                const httpCatchup = await apiDb.getMissedSyncEvents(globalLastEventSeq);
                if (httpCatchup.resyncRequired) {
                  await centralSync.syncFull(false);
                } else {
                  httpCatchup.events.forEach((ev) => dispatchGlobalDataMutation(ev));
                }
                if (httpCatchup.latestSeq > globalLastEventSeq) {
                  globalLastEventSeq = httpCatchup.latestSeq;
                }
                setLastEventSeq(globalLastEventSeq);
              } catch {
                await centralSync.syncFull(false);
              }
            }
          });
        } else if (hello.latestSeq > globalLastEventSeq) {
          globalLastEventSeq = hello.latestSeq;
          setLastEventSeq(globalLastEventSeq);
        }
      });

      socketInstance.on('connect_error', () => {
        setIsConnected(false);
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
      });

      socketInstance.on('system_notification', (data) => {
        if (data?.message) {
          toast(data.message);
        }
      });

      socketInstance.on('data_mutated', (payload) => {
        dispatchGlobalDataMutation(payload);
        if (typeof payload?.seq === 'number') {
          setLastEventSeq(globalLastEventSeq);
        }
      });

      socketRef.current = socketInstance;
      setSocket(socketInstance);
    };

    createAuthenticatedSocket();

    const handleAuthChanged = () => {
      createAuthenticatedSocket();
    };
    window.addEventListener('hse_auth_state_changed', handleAuthChanged);

    return () => {
      window.removeEventListener('hse_auth_state_changed', handleAuthChanged);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const subscribe = (room: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('subscribe', room);
    }
  };

  const unsubscribe = (room: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('unsubscribe', room);
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, lastEventSeq, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};
