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
  'lifting-plan': () => import('../modules/lifting-plan/LiftingPlanModule'),
};

const prefetchedModules = new Set<string>();
const inFlightPrefetches = new Map<string, Promise<void>>();

/**
 * Proactively prefetches a module chunk into the browser cache (best-effort)
 */
export function prefetchModule(key: string): Promise<void> {
  if (prefetchedModules.has(key)) return Promise.resolve();
  const existing = inFlightPrefetches.get(key);
  if (existing) return existing;

  const loader = MODULE_LOADERS[key];
  if (!loader) return Promise.resolve();

  const task = loader()
    .then(() => {
      prefetchedModules.add(key);
    })
    .catch(() => {
      prefetchedModules.delete(key);
    })
    .finally(() => {
      inFlightPrefetches.delete(key);
    });

  inFlightPrefetches.set(key, task);
  return task;
}

/**
 * Pre-warms the top primary modules sequentially during browser idle time after login
 * so concurrent unbundled dev fetches never saturate the proxy or trigger transient network errors.
 */
export function prewarmCoreModules(): void {
  if (typeof window === 'undefined') return;

  // Pre-warm only the primary entry views; heavy specialized modules load on sidebar hover or navigation
  const coreKeys = ['dashboard', 'permit'];

  const runWarm = async () => {
    for (const k of coreKeys) {
      await prefetchModule(k);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      void runWarm();
    });
  } else {
    setTimeout(() => {
      void runWarm();
    }, 1200);
  }
}
