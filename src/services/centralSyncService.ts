/**
 * Central Database Synchronization Service
 * Ensures all state, forms, users, settings, and reports are persisted to the central DB
 * and synchronized across all browsers and devices.
 */

import { apiDb, getAuthToken } from './apiDatabaseClient';
import { UserProfile, NotificationEntry, AuditLogEntry } from '../types';
import { setSystemUsers } from '../utils/authHelper';
import { dispatchGlobalDataMutation } from '../providers/WebSocketProvider';

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  serverTimestamp: string | null;
  pendingChanges: number;
  errorMessage?: string;
}

type SyncListener = (state: SyncState) => void;
type DataUpdateListener = (entityType: string, data: any) => void;

class CentralSyncService {
  private state: SyncState = {
    status: 'syncing',
    lastSyncedAt: null,
    serverTimestamp: null,
    pendingChanges: 0,
  };

  private listeners: Set<SyncListener> = new Set();
  private dataListeners: Set<DataUpdateListener> = new Set();
  private pollTimer: any = null;
  private eventSource: EventSource | null = null;
  private isSyncing = false;
  private lastSyncTimestamp = 0;
  private boundFocusHandler: (() => void) | null = null;
  private boundOnlineHandler: (() => void) | null = null;
  private boundOfflineHandler: (() => void) | null = null;

  constructor() {
    // Start background sync on creation
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (typeof window === 'undefined') return;

    // Periodic heartbeat / sync check every 3 minutes
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      this.checkAndSync();
    }, 180000);

    if (this.boundFocusHandler) window.removeEventListener('focus', this.boundFocusHandler);
    if (this.boundOnlineHandler) window.removeEventListener('online', this.boundOnlineHandler);
    if (this.boundOfflineHandler) window.removeEventListener('offline', this.boundOfflineHandler);

    this.boundFocusHandler = () => {
      if (Date.now() - this.lastSyncTimestamp > 180000) {
        this.syncFull(false);
      }
    };
    this.boundOnlineHandler = () => {
      this.syncFull(true);
    };
    this.boundOfflineHandler = () => {
      this.updateState({ status: 'offline' });
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    };

    window.addEventListener('focus', this.boundFocusHandler);
    window.addEventListener('online', this.boundOnlineHandler);
    window.addEventListener('offline', this.boundOfflineHandler);
  }

  public startAuthenticatedSync() {
    if (Date.now() - this.lastSyncTimestamp < 60000 || this.isSyncing) {
      return;
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        this.syncFull(false);
      });
    } else {
      setTimeout(() => {
        this.syncFull(false);
      }, 500);
    }
  }

  public stopSync() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.updateState({ status: 'offline' });
  }

  private initRealtimeSSE() {
    // Real-time push events are handled by WebSocketProvider (/socket.io).
  }

  public destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.boundFocusHandler) window.removeEventListener('focus', this.boundFocusHandler);
    if (this.boundOnlineHandler) window.removeEventListener('online', this.boundOnlineHandler);
    if (this.boundOfflineHandler) window.removeEventListener('offline', this.boundOfflineHandler);
    this.listeners.clear();
    this.dataListeners.clear();
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public onDataUpdate(listener: DataUpdateListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  private notifyDataUpdate(entityType: string, data: any) {
    this.dataListeners.forEach((l) => {
      try {
        l(entityType, data);
      } catch (e) {
        console.error('Error in data update listener:', e);
      }
    });
  }

  private updateState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => {
      try {
        l(this.state);
      } catch (e) {
        console.error('Error in sync listener:', e);
      }
    });
  }

  public getState(): SyncState {
    return { ...this.state };
  }

  public async checkAndSync(): Promise<void> {
    const isHealthy = await apiDb.checkSyncHealth();
    if (!isHealthy) {
      this.updateState({ status: 'offline' });
      return;
    }
    if (this.state.status === 'offline') {
      await this.syncFull(false);
    }
  }

  /**
   * Performs a complete snapshot synchronization with the central database.
   */
  public async syncFull(showSyncingIndicator = true): Promise<boolean> {
    if (this.isSyncing) return false;
    if (!showSyncingIndicator && Date.now() - this.lastSyncTimestamp < 10000) {
      return true;
    }
    const token = getAuthToken();
    if (!token) {
      this.updateState({ status: 'offline' });
      return false;
    }
    this.isSyncing = true;
    if (showSyncingIndicator) {
      this.updateState({ status: 'syncing' });
    }

    try {
      const snapshot = await apiDb.getFullSyncSnapshot();
      if (snapshot && snapshot.data) {
        const d = snapshot.data;

        // Broadcast updates for all core entities
        if (d.users) {
          if (Array.isArray(d.users)) {
            setSystemUsers(d.users);
          }
          this.notifyDataUpdate('users', d.users);
        }
        if (d.personnel) {
          this.notifyDataUpdate('personnel', d.personnel);
          if (typeof window !== 'undefined' && Array.isArray(d.personnel)) {
            import('../utils/personnelHelper').then(({ setInMemoryPersonnelList, purgeLegacyBrowserCache }) => {
              purgeLegacyBrowserCache();
              setInMemoryPersonnelList(d.personnel);
            }).catch(() => {});
          }
        }
        if (d.medicalExams) this.notifyDataUpdate('medicalExams', d.medicalExams);
        if (d.permits) this.notifyDataUpdate('permits', d.permits);
        if (d.risks) this.notifyDataUpdate('risks', d.risks);
        if (d.incidents) this.notifyDataUpdate('incidents', d.incidents);
        if (d.trirRecords) this.notifyDataUpdate('trirRecords', d.trirRecords);
        if (d.warnings) this.notifyDataUpdate('warnings', d.warnings);
        if (d.fireEquipment) this.notifyDataUpdate('fireEquipment', d.fireEquipment);
        if (d.fiveSAudits) this.notifyDataUpdate('fiveSAudits', d.fiveSAudits);
        if (d.notifications) this.notifyDataUpdate('notifications', d.notifications);
        if (d.settings) {
          this.notifyDataUpdate('settings', d.settings);
          if (typeof window !== 'undefined') {
            import('../utils/orgHelper').then(({ hydrateOrgConfigFromSettingsObject }) => {
              const settingsObj = Array.isArray(d.settings)
                ? Object.fromEntries(d.settings.map((s: any) => [s.key, s.value]))
                : d.settings;
              hydrateOrgConfigFromSettingsObject(settingsObj || {});
            }).catch(() => {});
          }
        }

        this.lastSyncTimestamp = Date.now();
        this.updateState({
          status: 'connected',
          lastSyncedAt: new Date(),
          serverTimestamp: snapshot.timestamp,
          errorMessage: undefined,
        });

        // Trigger custom window events for modules listening to updates
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hse_central_data_synced', { detail: d }));
        }

        return true;
      } else {
        this.updateState({
          status: 'offline',
          errorMessage: 'Server unavailable',
        });
        return false;
      }
    } catch (err: any) {
      console.error('Full sync error:', err);
      this.updateState({
        status: 'error',
        errorMessage: err.message || 'Sync failed',
      });
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  // --------------------------------------------------------------------------
  // Instant Persistence Helpers
  // --------------------------------------------------------------------------
  public async persistUser(user: UserProfile): Promise<boolean> {
    try {
      const res = await apiDb.saveUser(user);
      if (res) {
        this.notifyDataUpdate('user_saved', res);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to persist user to central DB:', e);
      return false;
    }
  }

  public async persistNotification(notif: NotificationEntry): Promise<boolean> {
    try {
      const res = await apiDb.saveNotification(notif);
      if (res) {
        this.notifyDataUpdate('notification_saved', res);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to persist notification:', e);
      return false;
    }
  }

  public async persistSetting(key: string, value: any, description?: string): Promise<boolean> {
    try {
      const res = await apiDb.saveSetting(key, value, description);
      if (res) {
        this.notifyDataUpdate('setting_saved', { key, value });
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to persist setting:', e);
      return false;
    }
  }

  public async persistAuditLog(entry: any): Promise<boolean> {
    try {
      return await apiDb.logAudit(entry);
    } catch (e) {
      return false;
    }
  }

  public async persistTrirRecord(record: any): Promise<boolean> {
    try {
      const res = await apiDb.saveTrirRecord(record);
      if (res) {
        this.notifyDataUpdate('trir_saved', res);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to persist TRIR record:', e);
      return false;
    }
  }

  public async persistTrirRecords(records: any[]): Promise<boolean> {
    try {
      const res = await apiDb.saveTrirBatch(records);
      if (res) {
        this.notifyDataUpdate('trir_batch_saved', res);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to persist TRIR records batch:', e);
      return false;
    }
  }
}

export const centralSync = new CentralSyncService();
