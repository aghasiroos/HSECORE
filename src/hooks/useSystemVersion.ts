import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface SystemVersionData {
  version: string;
  buildId: string;
  releaseId: string;
  updatedAt: string;
}

export function useSystemVersion(checkIntervalMs = 60000) {
  const [currentVersion, setCurrentVersion] = useState<SystemVersionData | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let initialVersion: string | null = null;

    const checkVersion = async () => {
      try {
        // Prevent browser caching the version request
        const res = await fetch(`/api/system/version?t=${new Date().getTime()}`);
        if (!res.ok) return;
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) return;

        const data: SystemVersionData = await res.json();
        if (!isMounted) return;

        setCurrentVersion(data);

        if (!initialVersion) {
          initialVersion = data.buildId;
        } else if (initialVersion !== data.buildId) {
          // A new build has been deployed!
          setUpdateAvailable(true);
        }
      } catch (err) {
        console.warn('Failed to check system version:', err);
      }
    };

    // Check immediately on mount
    checkVersion();

    // Setup interval for subsequent checks
    const interval = setInterval(checkVersion, checkIntervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [checkIntervalMs]);

  const applyUpdate = () => {
    // We do NOT clear localStorage/business data here, 
    // only the service worker cache or just force a clean reload 
    // so the browser grabs the new index.html (which is no-cache).
    
    // Unregister service workers to ensure we don't serve a stale index.html
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }

    // Force a hard reload from the server
    window.location.reload();
  };

  return {
    currentVersion,
    updateAvailable,
    applyUpdate,
  };
}
