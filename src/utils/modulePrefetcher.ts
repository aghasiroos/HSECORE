/**
 * Module Prefetcher & Dynamic Loader Cache
 * Provides instantaneous, zero-delay navigation across HSECORE modules
 * by pre-warming JavaScript chunks in browser idle time and on hover.
 */

type DynamicModuleFactory = () => Promise<any>;

const MODULE_LOADERS: Record<string, DynamicModuleFactory> = {
  dashboard: () => import('../components/Dashboard'),
  heat: () => import('../components/HeatStressMonitor'),
  'hse-ms': () => import('../components/HseMsManager'),
  warnings: () => import('../components/WarningsManager'),
  profile: () => import('../components/UserProfilePage'),
  permit: () => import('../components/WorkPermit'),
  'ptw-audit': () => import('../modules/ptw-audit/PtwAuditModule'),
  risk: () => import('../components/RiskAssessment'),
  training: () => import('../components/TrainingMgmt'),
  ppe: () => import('../components/PpeManagement'),
  incidents: () => import('../components/IncidentReporting'),
  reports: () => import('../components/ReportsModule'),
  'personnel-history': () => import('../components/PersonnelHistoryModule'),
  'pending-documents': () => import('../components/referral/PendingDocuments').then(m => ({ default: m.PendingDocuments })),
  'process-management': () => import('../modules/process-management/ProcessManagementModule'),
  'safety-unit': () => import('../modules/safety-dept/SafetyUnitModule'),
  'fire-dept': () => import('../modules/fire-dept/FireDeptModule'),
  'health-env': () => import('../modules/health-env/HealthEnvModule'),
  system: () => import('../components/SystemSettings'),
  'user-mgmt': () => import('../components/UserManagement'),
  'non-conformances': () => import('../components/non-conformance/ComprehensiveNonConformanceModule'),
  documents: () => import('../components/InstructionsDocumentsModule'),
  notifications: () => import('../components/system-settings/SystemNotificationsTab'),
  'ai-assistant': () => import('../modules/ai/AiAssistantApp'),
  psm: () => import('../modules/psm/PsmManagementModule'),
};

const prefetchedModules = new Set<string>();

/**
 * Proactively prefetches a module chunk into the browser cache
 */
export function prefetchModule(key: string): void {
  if (prefetchedModules.has(key)) return;
  const loader = MODULE_LOADERS[key];
  if (!loader) return;

  prefetchedModules.add(key);
  try {
    loader().catch((err) => {
      prefetchedModules.delete(key);
      console.warn(`[Prefetch] Note on prefetching module '${key}':`, err);
    });
  } catch (_) {
    prefetchedModules.delete(key);
  }
}

/**
 * Pre-warms the top primary modules during browser idle time after login
 */
export function prewarmCoreModules(): void {
  if (typeof window === 'undefined') return;

  const coreKeys = ['dashboard', 'heat', 'health-env', 'safety-unit', 'fire-dept', 'permit', 'ptw-audit', 'user-mgmt'];

  const runWarm = () => {
    coreKeys.forEach((k, idx) => {
      setTimeout(() => {
        prefetchModule(k);
      }, idx * 150);
    });
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => runWarm());
  } else {
    setTimeout(runWarm, 600);
  }
}
