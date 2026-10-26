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

class PerformanceConfigManager {
  private config: PerformanceThresholdConfig = { ...DEFAULT_PERFORMANCE_THRESHOLDS };
  private listeners: Set<(cfg: PerformanceThresholdConfig) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem('hse_performance_thresholds');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.config = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...parsed };
        }
      }
    } catch (_) {}
  }

  public getConfig(): PerformanceThresholdConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<PerformanceThresholdConfig>) {
    this.config = { ...this.config, ...newConfig };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('hse_performance_thresholds', JSON.stringify(this.config));
      }
    } catch (_) {}
    this.notify();
  }

  public resetToDefaults() {
    this.config = { ...DEFAULT_PERFORMANCE_THRESHOLDS };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('hse_performance_thresholds');
      }
    } catch (_) {}
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
