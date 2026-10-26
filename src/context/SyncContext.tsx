import React, { createContext, useContext, useEffect, useState } from 'react';
import { centralSync, SyncState, SyncStatus } from '../services/centralSyncService';

interface SyncContextType {
  syncState: SyncState;
  syncNow: () => Promise<boolean>;
  status: SyncStatus;
  lastSyncedAt: Date | null;
}

const SyncContext = createContext<SyncContextType>({
  syncState: centralSync.getState(),
  syncNow: () => centralSync.syncFull(true),
  status: 'syncing',
  lastSyncedAt: null,
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [syncState, setSyncState] = useState<SyncState>(centralSync.getState());

  useEffect(() => {
    const unsubscribe = centralSync.subscribe((newState) => {
      setSyncState(newState);
    });
    return () => unsubscribe();
  }, []);

  const syncNow = async () => {
    return await centralSync.syncFull(true);
  };

  return (
    <SyncContext.Provider
      value={{
        syncState,
        syncNow,
        status: syncState.status,
        lastSyncedAt: syncState.lastSyncedAt,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
