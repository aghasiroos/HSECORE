import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuthToken } from '../services/apiDatabaseClient';

export interface DashboardMetricsData {
  incidents: {
    total: number;
    rolling12m: number;
    prev12m: number;
    percentChange: number;
    trendDirection: 'up' | 'down' | 'flat';
    openCases: number;
    ltiCount: number;
    nearMissCount: number;
    lostWorkdays: number;
  };
  trir: {
    currentRolling: number;
    target: number;
    totalSafeManHours: number;
    attendanceHours: number;
    contractorHours: number;
    series: Array<{
      id: string;
      year: number;
      month: string;
      monthIndex: number;
      attendance: number;
      mission: number;
      contractor: number;
      attendanceHours: number;
      missionHours: number;
      contractorHours: number;
      totalHours: number;
      incidents: number;
      monthlyTrir: number;
      monthlyTRIR: number;
      rollingTrir: number;
      rollingTRIR: number;
      notes?: string;
      label: string;
    }>;
  };
  permits: {
    total: number;
    active: number;
    pending: number;
    closed: number;
    byType: {
      hot: number;
      cold: number;
      height: number;
      confined: number;
      electrical: number;
      excavation: number;
      other: number;
    };
    auditComplianceRate: number;
    auditedCount: number;
    compliantAuditedCount: number;
  };
  health: {
    totalExams: number;
    fit: number;
    conditional: number;
    unfit: number;
    fitnessPercentage: number;
    hearingLossCount?: number;
    lungAbnormalCount?: number;
    audiometryTotal?: number;
    spirometryTotal?: number;
  };
  risks: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  warnings: {
    total: number;
    active: number;
    penalized: number;
    list: any[];
  };
  anomalies?: {
    total: number;
    open: number;
    resolved: number;
    byCategory: {
      unsafeActs: number;
      ppeViolations: number;
      equipmentAnomalies: number;
      environmentalAnomalies: number;
      nearMisses: number;
    };
  };
  fireSafety: {
    total: number;
    operational: number;
    needsInspection: number;
    readinessRate: number;
    byType?: {
      co2: number;
      powder: number;
      foam: number;
      hoses: number;
      hydrants: number;
      detectors: number;
    };
  };
  fiveS: {
    total: number;
    averageScore: number;
  };
  training?: {
    totalCourses: number;
    totalAttendances: number;
    trainedPersonnel: number;
    totalHours: number;
    passRate: number;
    byCategory: {
      generalSafety: number;
      fireFighting: number;
      firstAid: number;
      ptwTraining: number;
      ergonomics: number;
    };
  };
  safetyInspections?: {
    total: number;
    compliant: number;
    defective: number;
    passRate: number;
    byType: {
      equipment: number;
      scaffolding: number;
      crane: number;
      electrical: number;
      excavation: number;
      siteRoutine: number;
    };
  };
  personnel: {
    total: number;
    departmentsCount: number;
  };
  climate: {
    tempC: number;
    hum: number;
    hi: number;
    hiDisplay?: string;
    offChart?: boolean;
    wbgt?: number;
    wbgtShade?: number;
    globeTemp?: number;
    dewPoint?: number;
    wetBulb?: number;
    cat: string;
    subLevel?: string | null;
    loc: string;
    source: string;
    aqi?: number;
    observedAt?: string;
    fetchedAt?: string;
    isStale?: boolean;
  } | null;
  notifications: any[];
}

import {
  CardLayoutItem,
  DashboardLayoutConfig,
  DEFAULT_DASHBOARD_CARDS_LAYOUT,
} from '../config/modulesConfig';
export type { CardLayoutItem, DashboardLayoutConfig };
export { DEFAULT_DASHBOARD_CARDS_LAYOUT };

let globalMetricsInFlight: Promise<any> | null = null;
let lastMetricsFetchTime = 0;

export function useDashboardMetrics(userId?: string) {
  const [metrics, setMetrics] = useState<DashboardMetricsData | null>(null);
  const [layout, setLayout] = useState<DashboardLayoutConfig>({ cards: DEFAULT_DASHBOARD_CARDS_LAYOUT });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);
  const mutationDebounceTimer = useRef<any>(null);

  const metricsRef = useRef<DashboardMetricsData | null>(null);
  metricsRef.current = metrics;

  // Fetch Metrics from Backend with deduplication & graceful rate-limiting handling
  const fetchMetrics = useCallback(async (force = false) => {
    const now = Date.now();
    // Cache for 3 seconds unless forced
    if (!force && now - lastMetricsFetchTime < 3000 && globalMetricsInFlight) {
      return globalMetricsInFlight;
    }

    if (globalMetricsInFlight) {
      return globalMetricsInFlight;
    }

    globalMetricsInFlight = (async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const url = force ? '/api/v1/dashboard/metrics?refresh=true' : '/api/v1/dashboard/metrics';
        const res = await fetch(url, { headers });
        if (res.status === 429) {
          // Status 429: Too Many Requests - retain existing state without throwing
          return;
        }
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();

        if (json.success && json.summary && isMounted.current) {
          setMetrics(json.summary);
          setError(null);
          lastMetricsFetchTime = Date.now();
        }
      } catch (err: any) {
        if (isMounted.current && !metricsRef.current) {
          setError(err.message);
        }
      } finally {
        globalMetricsInFlight = null;
      }
    })();

    return globalMetricsInFlight;
  }, []);

  // Fetch Layout from database (supports per-user or system default)
  const fetchLayout = useCallback(async (targetUserId?: string) => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uid = targetUserId || userId;
      const query = uid ? `?userId=${encodeURIComponent(uid)}` : '';
      const res = await fetch(`/api/v1/dashboard/layout${query}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && Array.isArray(json.data.cards) && isMounted.current) {
          const existingMap = new Map<string, CardLayoutItem>();
          json.data.cards.forEach((c: CardLayoutItem) => existingMap.set(c.id, c));

          const mergedCards = DEFAULT_DASHBOARD_CARDS_LAYOUT.map(def => {
            const found = existingMap.get(def.id);
            return found ? { ...def, ...found } : def;
          });

          mergedCards.sort((a, b) => a.order - b.order);
          setLayout({ 
            cards: mergedCards, 
            updatedAt: json.data.updatedAt, 
            updatedBy: json.data.updatedBy,
            isUserCustom: json.isUserCustom 
          });
        }
      }
    } catch (_) {
      // Graceful ignore
    }
  }, [userId]);

  // Initial Load & Event Listeners
  useEffect(() => {
    isMounted.current = true;
    setLoading(true);

    Promise.all([fetchMetrics(true), fetchLayout(userId)]).finally(() => {
      if (isMounted.current) {
        setLoading(false);
      }
    });

    // Auto-refresh interval (90 seconds, only active when browser tab is visible)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      fetchMetrics(false);
    }, 90000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted.current) {
        // Refresh when user returns to the tab if stale (>30s)
        fetchMetrics(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleMutation = (e: any) => {
      if (mutationDebounceTimer.current) {
        clearTimeout(mutationDebounceTimer.current);
      }
      mutationDebounceTimer.current = setTimeout(() => {
        if (!isMounted.current) return;
        if (e?.detail?.entityType === 'dashboard_layout') {
          fetchLayout(userId);
        } else {
          fetchMetrics(true);
        }
      }, 600);
    };

    const MODULE_MUTATION_EVENTS = [
      'hse_data_mutated',
      'app_data_mutated',
      'hse_central_data_synced',
      'hse_incidents_updated',
      'hse_permits_updated',
      'hse_ptw_audits_updated',
      'hse_medical_data_updated',
      'hse_occ_health_data_updated',
      'hse_health_env_updated',
      'five_s_data_updated',
      'hse_fire_vehicles_updated',
      'hse_fire_daily_reports_updated',
      'hse_training_updated',
      'hse_safety_templates_updated',
      'hse_warnings_updated',
      'hse_risk_updated',
      'hse_nutrition_records_updated',
      'hse_personnel_updated',
    ];

    MODULE_MUTATION_EVENTS.forEach(evt => window.addEventListener(evt, handleMutation));
    window.addEventListener('hse_dashboard_updated', () => fetchLayout(userId));

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (mutationDebounceTimer.current) {
        clearTimeout(mutationDebounceTimer.current);
      }
      MODULE_MUTATION_EVENTS.forEach(evt => window.removeEventListener(evt, handleMutation));
      window.removeEventListener('hse_dashboard_updated', () => fetchLayout(userId));
    };
  }, [fetchMetrics, fetchLayout, userId]);

  // Save Layout to database (Per-user or global)
  const saveLayout = useCallback(async (
    newCards: CardLayoutItem[], 
    username?: string,
    targetUserId?: string,
    saveAsGlobal?: boolean
  ) => {
    setIsSaving(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uid = targetUserId || userId;
      const payload = {
        cards: newCards,
        userId: uid,
        saveAsGlobal: Boolean(saveAsGlobal),
        updatedAt: new Date().toISOString(),
        updatedBy: username || 'User',
      };

      const res = await fetch('/api/v1/dashboard/layout', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status}`);
      }

      const json = await res.json();
      setLayout({ 
        cards: newCards, 
        updatedAt: payload.updatedAt, 
        updatedBy: payload.updatedBy,
        isUserCustom: json.isUserCustom
      });
      return { success: true, message: json.message };
    } catch (err: any) {
      console.error('Failed to save dashboard layout:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [userId]);

  // Reset Layout to Default (removes user customized layout from database)
  const resetLayout = useCallback(async (targetUserId?: string) => {
    setIsSaving(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const uid = targetUserId || userId;
      const res = await fetch('/api/v1/dashboard/layout/reset', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: uid }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status}`);
      }

      setLayout({ 
        cards: DEFAULT_DASHBOARD_CARDS_LAYOUT,
        isUserCustom: false
      });
      return { success: true };
    } catch (err: any) {
      console.error('Failed to reset dashboard layout:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [userId]);

  return {
    metrics,
    layout,
    loading,
    error,
    refetch: fetchMetrics,
    saveLayout,
    resetLayout,
    isSaving,
    setLayout,
  };
}
