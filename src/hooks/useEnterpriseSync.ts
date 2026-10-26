import { useState, useEffect } from 'react';
import { centralSync, SyncState } from '../services/centralSyncService';
import { TrirRecord, HeatRecord, WarningRecord } from '../types';

interface UseEnterpriseSyncParams {
  trirRecords?: TrirRecord[];
  heatLog?: HeatRecord[];
  warnings?: WarningRecord[];
  onRemotePull?: (data: { trirRecords: TrirRecord[]; heatLog: HeatRecord[]; warnings: WarningRecord[] }) => void;
}

export type EnterpriseSyncStatus = 'CONNECTED' | 'SYNCING' | 'LOCAL_ONLY' | 'ERROR';

export function useEnterpriseSync(_params?: UseEnterpriseSyncParams) {
  const [syncStatus, setSyncStatus] = useState<EnterpriseSyncStatus>('CONNECTED');

  useEffect(() => {
    const mapStatus = (state: SyncState): EnterpriseSyncStatus => {
      switch (state.status) {
        case 'connected':
          return 'CONNECTED';
        case 'syncing':
          return 'SYNCING';
        case 'offline':
          return 'LOCAL_ONLY';
        case 'error':
          return 'ERROR';
        default:
          return 'CONNECTED';
      }
    };

    // Initial status check
    const current = centralSync.getState();
    setSyncStatus(mapStatus(current));

    // Reactive subscription to central DB sync events
    const unsubscribe = centralSync.subscribe((state) => {
      setSyncStatus(mapStatus(state));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return syncStatus;
}
