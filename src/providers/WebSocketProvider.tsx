import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { apiDb } from '../services/apiDatabaseClient';
import { getCurrentUser, refreshCurrentUserFromServer } from '../utils/authHelper';
import { fetchCentralPersonnelList } from '../utils/personnelHelper';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (room: string) => void;
  unsubscribe: (room: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
  subscribe: () => {},
  unsubscribe: () => {},
});

export const useWebSocket = () => useContext(WebSocketContext);

interface ProviderProps {
  children: ReactNode;
}

/**
 * Universal client-side mutation dispatcher.
 * Invalidates cache and dispatches module-specific custom events instantly across the entire application.
 */
let lastMutationSig = '';
let lastMutationTime = 0;

export function dispatchGlobalDataMutation(payload: any) {
  const settingKey = String(payload?.key || payload?.data?.key || '').trim();
  const rawType = String(settingKey || payload?.entityType || payload?.entity || '').toLowerCase();
  const now = Date.now();
  const sig = `${rawType}:${payload?.action || ''}`;
  if (sig && sig === lastMutationSig && now - lastMutationTime < 500) {
    return;
  }
  lastMutationSig = sig;
  lastMutationTime = now;

  if (settingKey) {
    apiDb.invalidateCache(`settings:${settingKey}`, 'settings:all', settingKey, 'sync:full');
  } else if (rawType && rawType !== 'settings') {
    apiDb.invalidateCache(rawType, `${rawType}s`, `${rawType}:list`, 'sync:full');
  } else if (rawType === 'settings') {
    apiDb.invalidateCache('settings:all', 'sync:full');
  } else {
    apiDb.invalidateCache();
  }

  if (typeof window === 'undefined') return;

  const enrichedPayload = settingKey ? { ...payload, key: settingKey, entityType: settingKey } : payload;

  // Real-time User-to-Personnel Assignment & Lifecycle Propagation across all open browsers/sessions
  if (rawType.includes('user_assignment') || rawType.includes('user') || rawType.includes('personnel')) {
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

  // Universal mutation events
  window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: enrichedPayload }));
  window.dispatchEvent(new CustomEvent('hse_data_mutated', { detail: enrichedPayload }));

  // Module-specific instant dispatches
  if (rawType.includes('personnel')) {
    window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: payload }));
  }
  if (rawType.includes('user')) {
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
  if (rawType.includes('department') || rawType.includes('org') || rawType.includes('node') || rawType.includes('unit')) {
    window.dispatchEvent(new CustomEvent('hse_org_nodes_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_org_jobs_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_departments_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_unit_structure_updated', { detail: payload }));
  }
  if (rawType.includes('setting') || rawType.includes('brand')) {
    window.dispatchEvent(new CustomEvent('hse_system_branding_updated', { detail: payload }));
    window.dispatchEvent(new CustomEvent('hse_ui_config_updated', { detail: payload }));
  }
  if (rawType.includes('notif')) {
    window.dispatchEvent(new CustomEvent('hse_notifications_updated', { detail: payload }));
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
  if (rawType.includes('dashboard')) {
    window.dispatchEvent(new CustomEvent('hse_dashboard_updated', { detail: payload }));
  }
  if (rawType.includes('heat')) {
    window.dispatchEvent(new CustomEvent('hse_heat_log_updated', { detail: payload }));
  }
}

export const WebSocketProvider: React.FC<ProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to the same origin with fallback to polling for reverse proxies / VPS
    const socketInstance = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 4000,
      reconnectionDelayMax: 12000,
      timeout: 20000,
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('connect_error', (_err) => {
      // Gracefully handle connect error; socket.io will auto-retry via polling
      setIsConnected(false);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('system_notification', (data) => {
      if (data.message) {
        toast(data.message);
      }
    });

    // Handle incoming broadcast events for automatic cache invalidation
    // When any user changes data on another machine, immediately invalidate cache and refresh UI
    socketInstance.on('data_mutated', (payload) => {
      dispatchGlobalDataMutation(payload);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const subscribe = (room: string) => {
    if (socket && isConnected) {
      socket.emit('subscribe', room);
    }
  };

  const unsubscribe = (room: string) => {
    if (socket && isConnected) {
      socket.emit('unsubscribe', room);
    }
  };

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};
