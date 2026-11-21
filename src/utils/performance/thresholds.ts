/**
 * HSECORE Performance Optimization Standard - Centralized Smart Thresholds
 * 
 * Defines centralized, configurable thresholds for:
 * 1. Web Worker offloading (Excel parsing, heavy aggregations, multi-year KPI calculations)
 * 2. Virtualization (react-virtuoso for tables & lists)
 * 3. Search and filter debouncing
 * 
 * Rules:
 * - Small data (< threshold) => direct main-thread execution (zero async overhead)
 * - Medium data => lightweight optimization (memoization, micro-debouncing)
 * - Large data (> threshold) => Web Worker processing & Viewport Virtualization
 */

export interface PerformanceThresholdConfig {
  /** Minimum number of rows/items before table virtualization activates */
  virtualizationRowThreshold: number;
  /** Minimum number of Excel/CSV rows before parsing in Web Worker */
  excelWorkerRowThreshold: number;
  /** Minimum dataset size before offloading statistics/KPIs to Web Worker */
  computationWorkerThreshold: number;
  /** Minimum dataset size before offloading complex multi-field filtering to Web Worker */
  filterWorkerThreshold: number;
  /** Debounce delay for search inputs in milliseconds */
  searchDebounceMs: number;
  /** Batch chunk size for incremental rendering */
  batchChunkSize: number;
  /** Maximum cached items in memory before LRU eviction */
  maxMemoryCacheEntries: number;
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholdConfig = {
  virtualizationRowThreshold: 40,
  excelWorkerRowThreshold: 50,
  computationWorkerThreshold: 120,
  filterWorkerThreshold: 150,
  searchDebounceMs: 150,
  batchChunkSize: 200,
  maxMemoryCacheEntries: 1000
};

import { apiDb } from '../../services/apiDatabaseClient';

const PERF_PREF_KEY = 'performance_thresholds';

class PerformanceConfigManager {
  private config: PerformanceThresholdConfig = { ...DEFAULT_PERFORMANCE_THRESHOLDS };
  private listeners: Set<(cfg: PerformanceThresholdConfig) => void> = new Set();

  constructor() {
    this.hydrateFromDatabase();
    if (typeof window !== 'undefined') {
      window.addEventListener('hse_auth_state_changed', () => {
        this.hydrateFromDatabase();
      });
      window.addEventListener('hse_user_preferences_updated', (e: any) => {
        const key = e?.detail?.key;
        if (!key || key === PERF_PREF_KEY) {
          if (e?.detail?.value && typeof e.detail.value === 'object') {
            this.config = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...e.detail.value };
            this.notify();
          }
        }
      });
    }
  }

  private async hydrateFromDatabase() {
    try {
      const saved = await apiDb.userPreferences.get(PERF_PREF_KEY);
      if (saved?.value && typeof saved.value === 'object') {
        this.config = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...saved.value };
        this.notify();
      }
    } catch {
      // keep defaults until authenticated
    }
  }

  public getConfig(): PerformanceThresholdConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<PerformanceThresholdConfig>) {
    this.config = { ...this.config, ...newConfig };
    apiDb.userPreferences.set(PERF_PREF_KEY, this.config).catch((err) => {
      console.error('Failed to persist performance thresholds preference:', err);
    });
    this.notify();
  }

  public resetToDefaults() {
    this.config = { ...DEFAULT_PERFORMANCE_THRESHOLDS };
    apiDb.userPreferences.set(PERF_PREF_KEY, this.config).catch((err) => {
      console.error('Failed to reset performance thresholds preference:', err);
    });
    this.notify();
  }

  public subscribe(listener: (cfg: PerformanceThresholdConfig) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => {
      try { fn(this.config); } catch (_) {}
    });
  }

  // Quick evaluation helpers
  public shouldVirtualize(itemCount: number): boolean {
    return itemCount > this.config.virtualizationRowThreshold;
  }

  public shouldUseWorkerForExcel(rowCount: number): boolean {
    return rowCount > this.config.excelWorkerRowThreshold;
  }

  public shouldUseWorkerForComputation(itemCount: number): boolean {
    return itemCount > this.config.computationWorkerThreshold;
  }

  public shouldUseWorkerForFilter(itemCount: number): boolean {
    return itemCount > this.config.filterWorkerThreshold;
  }
}

export const performanceConfig = new PerformanceConfigManager();
