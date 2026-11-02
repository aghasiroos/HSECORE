import { sortRecordsByYearAndMonth, normalizeForMatching } from './utils/textNormalization';
import { toast } from 'react-hot-toast';
import { NotificationCarousel } from './components/NotificationCarousel';
import { SyncProvider } from './context/SyncContext';
import { NotificationProvider } from './context/NotificationContext';
import {
  NotificationBellDropdown,
  NotificationPopupModal,
} from './components/notifications';
import { SystemStatusBadge } from './components/SystemStatusBadge';
import { PrintNotificationModal } from './components/common/PrintNotificationModal';
import { centralSync } from './services/centralSyncService';
import { apiDb, getAuthToken } from './services/apiDatabaseClient';
import { deduplicateWarningRecords } from './utils/safeStorage';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AppSidebar, { MainTabKey, TabItemConfig } from './components/AppSidebar';
import { useEnterpriseSync } from './hooks/useEnterpriseSync';
import { HeatRecord, TrirRecord, WarningRecord, TrirSeriesPoint, UserProfile, DocumentReferral } from './types';
import { initializeRbacSeeds, hasPermission, isUserAdmin, addAuditLog, getCurrentUser, setCurrentUser as setCurrentUserInAuth, startGlobalAuditTracking } from './utils/authHelper';
import { getMergedUiConfig } from './config/modulesConfig';
import { getPendingReferralsForUser, fetchDocumentReferralsFromServer } from './utils/referralHelper';
import {
  LayoutDashboard, 
  Thermometer, 
  ShieldAlert, 
  ShieldCheck,
  Menu, 
  AlertCircle,
  AlertOctagon,
  User,
  Bell,
  FileText,
  Database,
  ClipboardCheck,
  GraduationCap, 
  BarChart3, 
  HardHat, 
  UserSearch, 
  Flame, 
  Leaf,
  Inbox,
  BookOpen,
  Workflow,
  Bot
} from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import { HseLogo } from './components/HseLogo';
import { useSystemBranding } from './utils/systemBrandingHelper';
import { prewarmCoreModules } from './utils/modulePrefetcher';

// In-memory component cache for instantaneous, zero-delay tab navigation
const moduleComponentCache = new Map<string, React.ComponentType<any>>();

// Resilient dynamic loader helper that retries on chunk fetch failures and handles Vite chunk reloads
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  moduleKey?: string
) {
  return React.lazy(async () => {
    const key = moduleKey || 'general';
    if (moduleComponentCache.has(key)) {
      return { default: moduleComponentCache.get(key) as T };
    }

    // Try up to 3 attempts with exponential backoff before concluding failure
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const component = await factory();
        moduleComponentCache.set(key, component.default);
        try {
          window.sessionStorage.removeItem(`chunk_reload_${key}`);
        } catch (_) {}
        return component;
      } catch (err: any) {
        lastError = err;
        console.warn(`Dynamic module load attempt ${attempt}/3 for ${key} failed:`, err?.message || err);
        if (attempt < 3) {
          await new Promise((res) => setTimeout(res, attempt * 300));
        }
      }
    }

    // If chunk fetch permanently failed due to Vite server rebuild / hash changes / network drops
    const isChunkLoadError = 
      lastError?.message?.includes('Failed to fetch dynamically imported module') ||
      lastError?.message?.includes('Importing a module script failed') ||
      lastError?.message?.includes('Loading chunk') ||
      lastError?.message?.includes('dynamically imported');

    const lastReloadKey = `chunk_reload_${key}`;
    const now = Date.now();
    const lastReload = Number(window.sessionStorage.getItem(lastReloadKey) || '0');

    // Debounced auto-reload once per 10 seconds to recover cleanly from server restarts
    if (isChunkLoadError && (now - lastReload > 10000)) {
      window.sessionStorage.setItem(lastReloadKey, String(now));
      console.warn(`Recovering from chunk error on ${key} by synchronizing browser state...`);
      window.location.reload();
      return new Promise(() => {});
    }

    throw lastError;
  });
}

interface ModuleErrorBoundaryProps {
  children: React.ReactNode;
  isFa: boolean;
  key?: React.Key;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Module-level error boundary to prevent full-page crashes on dynamic chunk issues
class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Module Error caught:', error, errorInfo);
    
    // Auto-recover from React instance mismatch or chunk out-of-sync caused by server/HMR restarts
    const isReactMismatch = 
      error?.message?.includes('reading \'useState\'') ||
      error?.message?.includes('Invalid hook call') ||
      error?.message?.includes('reading \'useEffect\'') ||
      error?.message?.includes('reading \'useMemo\'');

    const isChunkLoadError = 
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('Importing a module script failed') ||
      error?.message?.includes('Loading chunk');
    
    const reloadKey = 'hse_module_mismatch_reload';
    const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
    if ((isReactMismatch || isChunkLoadError) && (Date.now() - lastReload > 8000)) {
      sessionStorage.setItem(reloadKey, String(Date.now()));
      console.warn('Module load / dispatcher mismatch detected. Synchronizing application bundle...');
      window.location.reload();
    }
  }

  handleRetry = () => {
    try {
      moduleComponentCache.clear();
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('chunk_') || key.startsWith('hse_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (_) {}
    window.location.reload();
  };

  handleReload = () => {
    try {
      moduleComponentCache.clear();
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('chunk_') || key.startsWith('hse_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isFa = this.props.isFa;
      return (
        <div className="flex flex-col items-center justify-center min-h-[350px] p-8 text-center" dir={isFa ? 'rtl' : 'ltr'}>
          <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 font-black text-xl">
              !
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'خطا در بارگذاری ماژول' : 'Module Loading Error'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFa 
                  ? 'ماژول مورد نظر در حال آماده‌سازی یا همگام‌سازی است. می‌توانید تلاش مجدد کنید.'
                  : 'The requested module is synchronizing. You can retry loading it.'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold rounded-xl transition text-xs shadow-md shadow-teal-600/20 cursor-pointer"
              >
                {isFa ? 'تلاش مجدد' : 'Retry'}
              </button>
              <button
                onClick={this.handleReload}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition text-xs cursor-pointer"
              >
                {isFa ? 'تازه‌سازی صفحه' : 'Reload Page'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded modules with in-memory caching for optimal startup performance and code splitting
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'), 'dashboard');
const HeatStressMonitor = lazyWithRetry(() => import('./components/HeatStressMonitor'), 'heat');
const PtwAuditModule = lazyWithRetry(() => import('./modules/ptw-audit/PtwAuditModule'), 'ptw-audit');
const HseMsManager = lazyWithRetry(() => import('./components/HseMsManager'), 'hse-ms');
const WarningsManager = lazyWithRetry(() => import('./components/WarningsManager'), 'warnings');
const UserProfilePage = lazyWithRetry(() => import('./components/UserProfilePage'), 'profile');
const WorkPermitModule = lazyWithRetry(() => import('./components/WorkPermit'), 'ptw');
const RiskAssessment = lazyWithRetry(() => import('./components/RiskAssessment'), 'risk-assessment');
const TrainingMgmt = lazyWithRetry(() => import('./components/TrainingMgmt'), 'training');
const PpeManagement = lazyWithRetry(() => import('./components/PpeManagement'), 'ppe');
const IncidentReporting = lazyWithRetry(() => import('./components/IncidentReporting'), 'incidents');
const ReportsModule = lazyWithRetry(() => import('./components/ReportsModule'), 'reports');
const PersonnelHistoryModule = lazyWithRetry(() => import('./components/PersonnelHistoryModule'), 'personnel-history');
const PendingDocuments = lazyWithRetry(() => import('./components/referral/PendingDocuments').then(m => ({ default: m.PendingDocuments })), 'pending-documents');
const ProcessManagementModule = lazyWithRetry(() => import('./modules/process-management/ProcessManagementModule'), 'process-mgmt');
const SafetyUnitModule = lazyWithRetry(() => import('./modules/safety-dept/SafetyUnitModule'), 'safety-dept');
const FireDeptModule = lazyWithRetry(() => import('./modules/fire-dept/FireDeptModule'), 'fire-dept');
const HealthEnvModule = lazyWithRetry(() => import('./modules/health-env/HealthEnvModule'), 'health-env');
const UserManagement = lazyWithRetry(() => import('./components/UserManagement'), 'user-mgmt');
const SystemSettings = lazyWithRetry(() => import('./components/SystemSettings'), 'system-settings');
const ComprehensiveNonConformanceModule = lazyWithRetry(() => import('./components/non-conformance/ComprehensiveNonConformanceModule').then(m => ({ default: m.ComprehensiveNonConformanceModule })), 'non-conformances');
const InstructionsDocumentsModule = lazyWithRetry(() => import('./components/InstructionsDocumentsModule'), 'documents');
const SystemNotificationsTab = lazyWithRetry(() => import('./components/system-settings/SystemNotificationsTab'), 'notifications');
const AiAssistantApp = lazyWithRetry(() => import('./modules/ai/AiAssistantApp'), 'ai-assistant');

function ModuleLoadingFallback({ isFa }: { isFa: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-4 animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
        <div className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div className="text-center space-y-1">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {isFa ? "در حال بارگذاری ماژول..." : "Loading module..."}
        </div>
        <div className="text-xs text-slate-400">
          {isFa ? "لطفاً چند لحظه شکیبا باشید" : "Please wait a moment"}
        </div>
      </div>
    </div>
  );
}

// Seed data definitions for first-time mount
const JALALI_MONTH_NAMES = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];


// Jalali Clock Converter utils
function div(a: number, b: number) { return Math.floor(a / b); }
function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * div(days, 12053));
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let jm: number, jd: number;
  if (days < 186) {
    jm = 1 + div(days, 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + div(days - 186, 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

const FA_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const EN_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HeaderClock = React.memo(function HeaderClock({ language }: { language: "fa" | "en" }) {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour12: false }));
      const gy = now.getFullYear();
      const gm = now.getMonth() + 1;
      const gd = now.getDate();
      const [jy, jm, jd] = toJalali(gy, gm, gd);
      const wdIdx = now.getDay();

      if (language === "fa") {
        setDate(`${FA_WEEKDAYS[wdIdx]} ${jd} ${JALALI_MONTH_NAMES[jm - 1]} ${jy}`);
      } else {
        setDate(`${EN_WEEKDAYS[wdIdx]}, ${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")} (${jy}/${jm}/${jd} SH)`);
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [language]);

  return (
    <div className="hidden sm:block text-right">
      <div className="text-sm font-mono font-black text-slate-800 dark:text-slate-100 tracking-wider">{time}</div>
      <div className="text-[10px] text-slate-500 font-bold mt-0.5">{date}</div>
    </div>
  );
});

export default function App() {
 const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
   if (!getAuthToken()) {
     return null;
   }
   return getCurrentUser();
 });

 useEffect(() => {
   // Authenticate and verify session with Backend database via HttpOnly cookie & in-memory token
   apiDb.getCurrentUser().then(user => {
     if (user) {
       setCurrentUser(prev => (JSON.stringify(prev) === JSON.stringify(user) ? prev : user));
       setCurrentUserInAuth(user);
     } else {
       // Destroy in-memory session if unauthorized
       setCurrentUser(null);
       setCurrentUserInAuth(null);
     }
   }).catch(() => {
     // Keep in-memory state if temporarily disconnected
   });
 }, []);

  // Initial Active Tab resolution: 1. URL Hash -> 2. SessionStorage -> 3. LocalStorage -> 4. Default 'dashboard'
  const getInitialActiveTab = (): MainTabKey => {
    try {
      const hash = window.location.hash.replace(/^#\/?/, '').trim() as MainTabKey;
      const adminTabs = ['user-mgmt', 'system'];
      const user = getCurrentUser();
      const isAdmin = isUserAdmin(user);

      if (hash && typeof hash === 'string') {
        if (!adminTabs.includes(hash) || isAdmin) {
          return hash;
        }
      }
      const sessionSaved = sessionStorage.getItem('hse_active_tab') as MainTabKey;
      if (sessionSaved && (!adminTabs.includes(sessionSaved) || isAdmin)) return sessionSaved;
      const localSaved = localStorage.getItem('hse_active_tab') as MainTabKey;
      if (localSaved && (!adminTabs.includes(localSaved) || isAdmin)) return localSaved;
    } catch {
      // Fallback on error
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTabState] = useState<MainTabKey>(getInitialActiveTab);

  // Synchronized activeTab setter that persists across browser refreshes & updates URL hash
  const setActiveTab = useCallback((tab: MainTabKey) => {
    React.startTransition(() => {
      setActiveTabState(tab);
    });
    try {
      sessionStorage.setItem('hse_active_tab', tab);
      localStorage.setItem('hse_active_tab', tab);
      if (window.location.hash !== `#${tab}`) {
        window.history.replaceState(null, '', `#${tab}`);
      }
    } catch (e) {
      console.error('Error persisting active tab:', e);
    }
  }, []);

  // Listen to browser Back/Forward & URL Hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '').trim() as MainTabKey;
      if (hash) {
        React.startTransition(() => {
          setActiveTabState(hash);
        });
        try {
          sessionStorage.setItem('hse_active_tab', hash);
          localStorage.setItem('hse_active_tab', hash);
        } catch {}
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

 const [isSidebarOpen, setIsSidebarOpen] = useState(false);
 const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
   try {
     const saved = localStorage.getItem('hse_sidebar_collapsed');
     return saved !== null ? saved === 'true' : true;
   } catch {
     return true;
   }
 });

 const handleToggleSidebarCollapse = () => {
   setIsSidebarCollapsed(prev => {
     const next = !prev;
     try {
       localStorage.setItem('hse_sidebar_collapsed', String(next));
     } catch (e) {
       console.error(e);
     }
     return next;
   });
 };
  
 const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [allNotifs, setAllNotifs] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser || !getAuthToken()) {
      setAllNotifs([]);
      return;
    }
    const fetchNotifs = () => {
      apiDb.getNotifications().then(notifs => {
        if (Array.isArray(notifs)) {
          setAllNotifs(notifs);
        }
      }).catch(() => {});
    };
    fetchNotifs();

    const handleDataMutated = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (entity.includes('notif')) {
        fetchNotifs();
      }
    };
    window.addEventListener('hse_notifications_updated', fetchNotifs);
    window.addEventListener('hse_data_mutated', handleDataMutated);
    return () => {
      window.removeEventListener('hse_notifications_updated', fetchNotifs);
      window.removeEventListener('hse_data_mutated', handleDataMutated);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [language, setLanguage] = useState<'en' | 'fa'>('fa');
  const { branding } = useSystemBranding();

  // Centralized System Branding: Keep browser document title dynamically synchronized
  useEffect(() => {
    const brandName = branding.sidebarNav?.titleText || 'HSECORE';
    const sub = language === 'fa' 
      ? (branding.subTitleFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست')
      : (branding.subTitleEn || 'The Core of HSE Management');
    document.title = `${brandName} | ${sub}`;
  }, [branding, language]);

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('hse_theme_mode');
      if (saved === 'dark') return 'dark';
      return 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark', 'navy');
    if (themeMode === 'dark') { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.add('light'); }
    try {
      localStorage.setItem('hse_theme_mode', themeMode);
    } catch (e) {
      console.error(e);
    }
  }, [themeMode]);

  const [isFullscreenFormOpen, setIsFullscreenFormOpen] = useState(false);

  useEffect(() => {
    const handleToggle = (e: any) => {
      setIsFullscreenFormOpen(!!e.detail?.isOpen);
    };
    window.addEventListener('fullscreenFormToggle', handleToggle);
    return () => window.removeEventListener('fullscreenFormToggle', handleToggle);
  }, []);

  // --- Unified State across Modules (Pure database source of truth) ---
  const [heatLog, setHeatLog] = useState<HeatRecord[]>([]);
  const [activeHeatRecord, setActiveRecord] = useState<HeatRecord | null>(null);
  
  const [trirRecords, setTrirRecords] = useState<TrirRecord[]>([]);
  const [trirTarget, setTrirTarget] = useState<number>(1.5);
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);

  // Initialize RBAC seed databases & global micro-activity audit tracker
  useEffect(() => {
    initializeRbacSeeds();
    startGlobalAuditTracking();
  }, []);

  // Listen for real-time user permissions and profile updates
  useEffect(() => {
    const handleUsersUpdated = (e: any) => {
      const updatedUsers: UserProfile[] = e?.detail?.users || (Array.isArray(e?.detail) ? e.detail : null);
      if (updatedUsers && currentUser) {
        const match = updatedUsers.find(u => u.id === currentUser.id);
        if (match) {
          setCurrentUser(prev => (JSON.stringify(prev) === JSON.stringify(match) ? prev : { ...match }));
          setCurrentUserInAuth(match);
        }
      }
    };
    window.addEventListener('hse_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('hse_users_updated', handleUsersUpdated);
  }, [currentUser?.id]);

  // Hook for automatic background sync of local state with database & REST APIs
  const enterpriseSyncState = useEnterpriseSync({
    trirRecords,
    heatLog,
    warnings,
    onRemotePull: ({ trirRecords: rTrir, heatLog: rHeat, warnings: rWarn }) => {
      if (rTrir && Array.isArray(rTrir)) setTrirRecords(rTrir);
      if (rHeat && Array.isArray(rHeat) && rHeat.length > 0) {
        setHeatLog(rHeat);
      }
      if (rWarn && Array.isArray(rWarn)) setWarnings(rWarn);
    }
  });

  // Automatic Session Timeout & Inactivity Logout (Configurable per user profile / default 5 min)
  useEffect(() => {
    if (!currentUser) return;

    let lastActivity = Date.now();
    let lastThrottledCheck = 0;

    const resetActivity = () => {
      const now = Date.now();
      if (now - lastThrottledCheck > 2000) {
        lastActivity = now;
        lastThrottledCheck = now;
      }
    };

    window.addEventListener('mousemove', resetActivity, { passive: true });
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);
    window.addEventListener('scroll', resetActivity, { passive: true });

    const interval = setInterval(() => {
      const timeoutMinutes = (typeof currentUser.sessionTimeoutMinutes === 'number' && currentUser.sessionTimeoutMinutes > 0)
        ? currentUser.sessionTimeoutMinutes
        : (parseInt(localStorage.getItem('hse_session_timeout') || '5') || 5);

      const maxSeconds = timeoutMinutes * 60;
      const secondsInactive = (Date.now() - lastActivity) / 1000;

      if (secondsInactive >= maxSeconds) {
        addAuditLog(currentUser.username, 'خروج خودکار به دلیل عدم فعالیت (Session Timeout)', 'خروج سیستم');
        if (typeof centralSync?.stopSync === 'function') {
          centralSync.stopSync();
        }
        apiDb.logout();
        setCurrentUser(null);
        setCurrentUserInAuth(null);
        toast.error(language === 'fa' 
          ? `شما به دلیل عدم فعالیت به مدت ${timeoutMinutes} دقیقه به صورت خودکار از سامانه خارج شدید.` 
          : `You have been automatically logged out due to ${timeoutMinutes} minutes of inactivity.`, { duration: 6000 });
      }
    }, 5000);

    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
      window.removeEventListener('scroll', resetActivity);
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.sessionTimeoutMinutes, language]);

  // Track dynamic tab permissions (memoized for high render performance)
  const allowedTabs: TabItemConfig[] = useMemo(() => {
    if (!currentUser) return [];
    
    const tabs: TabItemConfig[] = [];
    const isAdmin = isUserAdmin(currentUser);

    // 1. Dashboards & Analytics
    if (isAdmin || hasPermission(currentUser, 'Dashboard', 'view')) {
      tabs.push({ key: 'dashboard', icon: LayoutDashboard, titleFa: 'داشبورد جامع مدیریتی', titleEn: 'Unified Executive Dashboard' });
    }
    if (isAdmin || hasPermission(currentUser, 'Heat Stress', 'view')) {
      tabs.push({ key: 'heat', icon: Thermometer, titleFa: 'پایش استرس گرمایی', titleEn: 'Thermal Heat Stress Monitor' });
    }
    if (isAdmin || hasPermission(currentUser, 'TRIR Incident Rate', 'view') || hasPermission(currentUser, 'Statistics', 'view') || hasPermission(currentUser, 'Reports', 'view')) {
      tabs.push({ key: 'hse-ms', icon: ShieldAlert, titleFa: 'پایش نرخ رویدادها (TRIR)', titleEn: 'TRIR Incident Rate' });
    }
    if (isAdmin || hasPermission(currentUser, 'HSECORE AI', 'view') || hasPermission(currentUser, 'Dashboard', 'view')) {
      tabs.push({ key: 'ai-assistant', icon: Bot, titleFa: 'هوش مصنوعی HSECORE', titleEn: 'HSECORE AI Assistant' });
    }

    // 2. Specialized HSE Departments
    if (isAdmin || hasPermission(currentUser, 'Safety Unit', 'view')) {
      tabs.push({ key: 'safety-unit', icon: ShieldCheck, titleFa: 'واحد ایمنی', titleEn: 'Safety Department' });
    }
    if (isAdmin || hasPermission(currentUser, 'Fire Department', 'view')) {
      tabs.push({ key: 'fire-dept', icon: Flame, titleFa: 'واحد آتش‌نشانی', titleEn: 'Fire Department & Safety' });
    }
    if (isAdmin || hasPermission(currentUser, 'Health & Environment', 'view') || hasPermission(currentUser, 'Periodic Medical Exams', 'view')) {
      tabs.push({ key: 'health-env', icon: Leaf, titleFa: 'واحد بهداشت و محیط زیست', titleEn: 'Health & Environment' });
    }

    // 3. Safety Operations & Risk
    if (isAdmin || hasPermission(currentUser, 'Permit To Work', 'view')) {
      tabs.push({ key: 'permit', icon: FileText, titleFa: 'پروانه کار ایمن (PTW)', titleEn: 'Permit to Work (PTW)' });
    }
    if (isAdmin || hasPermission(currentUser, 'PTW Audit', 'view')) {
      tabs.push({ key: 'ptw-audit', icon: ClipboardCheck, titleFa: 'ممیزی پروانه کار (Audit permit)', titleEn: 'Audit permit' });
    }
    if (isAdmin || hasPermission(currentUser, 'Incidents', 'view')) {
      tabs.push({ key: 'incidents', icon: AlertCircle, titleFa: 'گزارشات ناهنجاری و حوادث', titleEn: 'Safety Incidents & Anomalies' });
    }
    if (isAdmin || hasPermission(currentUser, 'PPE', 'view')) {
      tabs.push({ key: 'ppe', icon: HardHat, titleFa: 'تجهیزات حفاظت فردی (PPE)', titleEn: 'PPE Management (OSHA)' });
    }
    if (isAdmin || hasPermission(currentUser, 'Risk Assessment', 'view')) {
      tabs.push({ key: 'risk', icon: ShieldAlert, titleFa: 'ارزیابی ریسک', titleEn: 'AI Risk Assessment' });
    }

    // 4. Personnel History, Training & BPMN
    if (isAdmin || hasPermission(currentUser, 'Personnel 360', 'view')) {
      tabs.push({ key: 'personnel-history', icon: UserSearch, titleFa: 'سوابق و پرونده جامع پرسنل', titleEn: 'Personnel 360° History & Records' });
    }
    if (isAdmin || hasPermission(currentUser, 'Training', 'view')) {
      tabs.push({ key: 'training', icon: GraduationCap, titleFa: 'مدیریت و آمار آموزش', titleEn: 'Training Management & Stats' });
    }
    if (isAdmin || hasPermission(currentUser, 'Safety Warnings', 'view')) {
      tabs.push({ key: 'warnings', icon: AlertOctagon, titleFa: 'ثبت و مدیریت اخطارها', titleEn: 'Personnel Written Warnings' });
    }
    if (isAdmin || hasPermission(currentUser, 'Non-Conformances', 'view') || hasPermission(currentUser, 'Incidents', 'view') || hasPermission(currentUser, 'Safety Unit', 'view')) {
      tabs.push({ key: 'non-conformances', icon: ShieldAlert, titleFa: 'مدیریت عدم انطباق‌ها (CAPA)', titleEn: 'Non-Conformities & CAPA' });
    }
    if (isAdmin || hasPermission(currentUser, 'Reports', 'view') || hasPermission(currentUser, 'Statistics', 'view')) {
      tabs.push({ key: 'reports', icon: BarChart3, titleFa: 'گزارشات و آمار', titleEn: 'Statistical Reports' });
    }
    if (isAdmin || hasPermission(currentUser, 'Documents', 'view')) {
      tabs.push({ key: 'documents', icon: BookOpen, titleFa: 'دستورالعمل‌ها و مستندات', titleEn: 'Instructions & Documents' });
    }
    if (isAdmin || hasPermission(currentUser, 'Permit To Work', 'approve') || hasPermission(currentUser, 'Process Management', 'view') || hasPermission(currentUser, 'Safety Unit', 'approve') || hasPermission(currentUser, 'Incidents', 'approve')) {
      tabs.push({ key: 'pending-documents', icon: Inbox, titleFa: 'اسناد در انتظار اقدام و امضا', titleEn: 'Documents Awaiting Action & Sign' });
    }

    // 5. System Administration & RBAC (مدیریت و پیکربندی سامانه)
    if (isAdmin || hasPermission(currentUser, 'Process Management', 'view')) {
      tabs.push({ key: 'process-management', icon: Workflow, titleFa: 'مدیریت فرآیندها (BPMN)', titleEn: 'Process Management (Camunda 8)' });
    }
    if (isAdmin || hasPermission(currentUser, 'Notifications', 'view') || hasPermission(currentUser, 'Notifications', 'create')) {
      tabs.push({ key: 'notifications', icon: Bell, titleFa: 'مدیریت هشدار و اعلان‌ها', titleEn: 'Alerts & Notifications Management' });
    }
    if (isAdmin || hasPermission(currentUser, 'User Management', 'view')) {
      tabs.push({ key: 'user-mgmt', icon: ShieldCheck, titleFa: 'مدیریت کاربران و دسترسی‌ها', titleEn: 'User Management & RBAC Roles' });
    }
    if (isAdmin || hasPermission(currentUser, 'Org Structure', 'view') || hasPermission(currentUser, 'UI Config & Branding', 'view') || hasPermission(currentUser, 'Database Backup', 'view') || hasPermission(currentUser, 'Audit Logs', 'view') || hasPermission(currentUser, 'API & Webhooks', 'view')) {
      tabs.push({ key: 'system', icon: Database, titleFa: 'تنظیمات و ساختار سازمانی', titleEn: 'Settings' });
    }
    
    // Profile is always allowed
    tabs.push({ key: 'profile', icon: User, titleFa: 'شناسنامه و تنظیمات کاربری', titleEn: 'My Personal Profile' });

    // Apply custom UI Configuration dynamically merged with system modules
    try {
      const customConfig = getMergedUiConfig();
      const orderedTabs: TabItemConfig[] = [];
      
      customConfig.forEach(ct => {
        if (ct.enabled === false) return; // Skip modules toggled off by admin
        const matchedTab = tabs.find(at => at.key === ct.key);
        if (matchedTab) {
          matchedTab.titleFa = ct.titleFa || matchedTab.titleFa;
          matchedTab.titleEn = ct.titleEn || matchedTab.titleEn;
          matchedTab.category = ct.category || matchedTab.category;
          matchedTab.descriptionFa = ct.descriptionFa || matchedTab.descriptionFa;
          orderedTabs.push(matchedTab);
        }
      });
      
      // Fallback safeguard to append any permitted tab not covered
      tabs.forEach(at => {
        if (!orderedTabs.find(ot => ot.key === at.key)) {
          orderedTabs.push(at);
        }
      });
      
      return orderedTabs;
    } catch(e) {
      console.error('Failed to load UI config', e);
      return tabs;
    }
  }, [currentUser]);

  // Prevent unauthorized tab state access
  useEffect(() => {
    if (currentUser && allowedTabs.length > 0) {
      const isAllowed = allowedTabs.some(t => t.key === activeTab);
      if (!isAllowed) {
        setActiveTab(allowedTabs[0].key);
      }
    }
  }, [currentUser, activeTab, allowedTabs]);

 // Toggle RTL/LTR and active class on language change
 useEffect(() => {
 document.documentElement.lang = language;
 document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
 document.body.dir = language === 'fa' ? 'rtl' : 'ltr';
 }, [language]);

  // Initial Data Load & Central DB Synchronizer
  useEffect(() => {
    if (!currentUser || !getAuthToken()) return;

    // Pre-warm high-priority modules during browser idle time for zero-latency tab switches
    prewarmCoreModules();

    // Start authenticated central sync in background
    if (typeof centralSync?.startAuthenticatedSync === 'function') {
      centralSync.startAuthenticatedSync();
    }

    // Initial TRIR Records load directly from database (zero localStorage / seed fallback)
    apiDb.getTrirRecords().then((records) => {
      setTrirRecords(Array.isArray(records) ? records : []);
    }).catch((err) => {
      console.error('Failed to load TRIR records from database:', err);
      setTrirRecords([]);
    });

    // Load Warnings directly from database (zero localStorage / seed fallback)
    apiDb.getSafetyWarnings().then((warns) => {
      if (warns && Array.isArray(warns)) {
        const { clean } = deduplicateWarningRecords(warns);
        setWarnings(clean);
      } else {
        setWarnings([]);
      }
    }).catch(() => {
      setWarnings([]);
    });

    // Load system settings (TRIR Target & Heat Log) from database
    apiDb.getSettings().then((settings) => {
      if (settings) {
        if (settings.trir_target !== undefined && settings.trir_target !== null) {
          const parsed = parseFloat(settings.trir_target);
          if (!isNaN(parsed) && parsed > 0) {
            setTrirTarget(parsed);
          }
        }
        if (Array.isArray(settings.hse_heat_log)) {
          setHeatLog(settings.hse_heat_log);
          if (settings.hse_heat_log.length > 0) {
            setActiveRecord(settings.hse_heat_log[0]);
          }
        }
      }
    }).catch(() => {});

    // Listen to real-time central database synchronization events
    const handleCentralSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (detail.trirRecords && Array.isArray(detail.trirRecords)) {
        setTrirRecords(detail.trirRecords);
      }
      if (detail.warnings && Array.isArray(detail.warnings)) {
        const { clean } = deduplicateWarningRecords(detail.warnings);
        setWarnings(clean);
      }
      if (detail.notifications && Array.isArray(detail.notifications)) {
        setAllNotifs(detail.notifications);
      }
      if (detail.settings && detail.settings.trir_target !== undefined && detail.settings.trir_target !== null) {
        const parsed = parseFloat(detail.settings.trir_target);
        if (!isNaN(parsed) && parsed > 0) {
          setTrirTarget(parsed);
          try {
            localStorage.setItem('hse_trir_target', parsed.toString());
          } catch (_) {}
        }
      }
      if (detail.settings && Array.isArray(detail.settings.hse_heat_log)) {
        setHeatLog(detail.settings.hse_heat_log);
        if (detail.settings.hse_heat_log.length > 0) {
          setActiveRecord(detail.settings.hse_heat_log[0]);
        }
      }
    };

    const handleHeatLogRemoteUpdate = (e: any) => {
      const payload = e?.detail;
      const incoming = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.value)
        ? payload.value
        : null;
      if (incoming) {
        setHeatLog(incoming);
        if (incoming.length > 0) {
          setActiveRecord(incoming[0]);
        }
      } else {
        apiDb.invalidateCache('settings');
        apiDb.getSetting('hse_heat_log').then((remoteLog) => {
          if (Array.isArray(remoteLog)) {
            setHeatLog(remoteLog);
            if (remoteLog.length > 0) {
              setActiveRecord(remoteLog[0]);
            }
          }
        }).catch(() => {});
      }
    };

    let mutationDebounceTimer: any = null;
    const handleDataMutated = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || e?.detail?.key || '').toLowerCase();
      if (!entity) return;
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = setTimeout(() => {
        if (entity.includes('trir')) {
          apiDb.getTrirRecords().then(r => r && setTrirRecords(r)).catch(() => {});
        }
        if (entity.includes('warn')) {
          apiDb.getSafetyWarnings().then(w => w && setWarnings(deduplicateWarningRecords(w).clean)).catch(() => {});
        }
        if (entity.includes('setting') || entity.includes('heat') || entity.includes('target')) {
          apiDb.invalidateCache('settings');
          apiDb.getSettings().then(s => {
            if (s?.trir_target !== undefined && s?.trir_target !== null) {
              const parsed = parseFloat(s.trir_target);
              if (!isNaN(parsed) && parsed > 0) {
                setTrirTarget(parsed);
                try {
                  localStorage.setItem('hse_trir_target', parsed.toString());
                } catch (_) {}
              }
            }
            if (Array.isArray(s?.hse_heat_log)) {
              setHeatLog(s.hse_heat_log);
              if (s.hse_heat_log.length > 0) {
                setActiveRecord(s.hse_heat_log[0]);
              }
            }
          }).catch(() => {});
        }
      }, 150);
    };

    const handleTargetChanged = (e: any) => {
      const target = e.detail?.target;
      if (typeof target === 'number' && !isNaN(target) && target > 0) {
        setTrirTarget(target);
        try {
          localStorage.setItem('hse_trir_target', target.toString());
        } catch (_) {}
      }
    };

    const handleWarningsRefresh = () => {
      apiDb.getSafetyWarnings().then(w => w && setWarnings(deduplicateWarningRecords(w).clean)).catch(() => {});
    };

    const handleTrirRefresh = () => {
      apiDb.getTrirRecords().then(r => r && setTrirRecords(r)).catch(() => {});
    };

    window.addEventListener('hse_central_data_synced', handleCentralSync);
    window.addEventListener('hse_data_mutated', handleDataMutated);
    window.addEventListener('hse_heat_log_updated', handleHeatLogRemoteUpdate);
    window.addEventListener('hse_warnings_updated', handleWarningsRefresh);
    window.addEventListener('hse_trir_updated', handleTrirRefresh);
    window.addEventListener('hse_trir_target_changed', handleTargetChanged);
    return () => {
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      window.removeEventListener('hse_central_data_synced', handleCentralSync);
      window.removeEventListener('hse_data_mutated', handleDataMutated);
      window.removeEventListener('hse_heat_log_updated', handleHeatLogRemoteUpdate);
      window.removeEventListener('hse_warnings_updated', handleWarningsRefresh);
      window.removeEventListener('hse_trir_updated', handleTrirRefresh);
      window.removeEventListener('hse_trir_target_changed', handleTargetChanged);
    };
  }, [currentUser?.id]);

  // Update central state when lists change (deduplicated & sorted)
  const handleTrirRecordsUpdated = React.useCallback((recs: TrirRecord[]) => {
    const deduplicated: TrirRecord[] = [];
    recs.forEach(r => {
      const normM = normalizeForMatching(r.month);
      const idx = deduplicated.findIndex(d => d.year === r.year && (normalizeForMatching(d.month) === normM || d.month === r.month));
      if (idx >= 0) {
        deduplicated[idx] = { ...deduplicated[idx], ...r };
      } else {
        deduplicated.push(r);
      }
    });
    const sorted = sortRecordsByYearAndMonth(deduplicated, true);
    setTrirRecords(sorted);
  }, []);

  const handleWarningsUpdated = React.useCallback((warns: WarningRecord[]) => {
    const { clean } = deduplicateWarningRecords(warns);
    setWarnings(clean);
  }, []);

  const handleTrirTargetUpdated = React.useCallback((target: number) => {
    if (typeof target !== 'number' || isNaN(target) || target <= 0) return;
    setTrirTarget(target);
    try {
      localStorage.setItem('hse_trir_target', target.toString());
    } catch (_) {}
    centralSync.persistSetting('trir_target', target, 'Target TRIR Rate');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_trir_target_changed', { detail: { target } }));
      window.dispatchEvent(new CustomEvent('hse_data_mutated', { detail: { entityType: 'settings', key: 'trir_target', value: target } }));
    }
  }, []);

  const handleHeatLogUpdated = React.useCallback((newLog: HeatRecord[]) => {
    setHeatLog(newLog);
    if (newLog.length > 0) {
      setActiveRecord(newLog[0]);
    }
    centralSync.persistSetting('hse_heat_log', newLog, 'Live Heat Stress Log');
  }, []);

  const dashboardSeries: TrirSeriesPoint[] = React.useMemo(() => {
    const sorted = sortRecordsByYearAndMonth(trirRecords, true);

    const series: TrirSeriesPoint[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const rec = sorted[i];
      const att = Number(rec.attendance ?? (rec as any).attendanceHours ?? 0) || 0;
      const mis = Number(rec.mission ?? (rec as any).missionHours ?? 0) || 0;
      const con = Number(rec.contractor ?? (rec as any).contractorHours ?? 0) || 0;
      const inc = Number(rec.incidents ?? (rec as any).recordableIncidents ?? 0) || 0;

      const E = att + mis;
      const totalHours = E + con;
      const rawMonthly = totalHours > 0 ? (inc * 1000000) / totalHours : 0;
      const safeMonthlyTRIR = Number((isNaN(rawMonthly) ? 0 : rawMonthly).toFixed(2));
      
      const startIdx = Math.max(0, i - 11);
      let gSum = 0;
      let hSum = 0;
      for (let j = startIdx; j <= i; j++) {
        const r2 = sorted[j];
        const r2Att = Number(r2.attendance ?? (r2 as any).attendanceHours ?? 0) || 0;
        const r2Mis = Number(r2.mission ?? (r2 as any).missionHours ?? 0) || 0;
        const r2Con = Number(r2.contractor ?? (r2 as any).contractorHours ?? 0) || 0;
        gSum += Number(r2.incidents ?? (r2 as any).recordableIncidents ?? 0) || 0;
        hSum += (r2Att + r2Mis + r2Con);
      }
      const rawRolling = hSum > 0 ? (gSum * 1000000) / hSum : 0;
      const safeRollingTRIR = Number((isNaN(rawRolling) ? 0 : rawRolling).toFixed(2));
      const monthsInWindow = i - startIdx + 1;

      series.push({
        ...rec,
        attendance: att,
        mission: mis,
        contractor: con,
        incidents: inc,
        E,
        totalHours,
        monthlyTRIR: safeMonthlyTRIR,
        rollingTRIR: safeRollingTRIR,
        monthsInWindow,
        label: `${rec.month} ${String(rec.year).slice(-2)}`
      });
    }
    return series;
  }, [trirRecords]);

  const userBulletins = useMemo(() => {
    if (!currentUser) return [];
    return allNotifs.filter((n: any) => {
      if (n.targetType === 'all') return true;
      if (n.targetType === 'roles' && n.targetValues?.includes(currentUser.role)) return true;
      if (currentUser.departmentIds?.some((id: string) => n.targetValues?.includes(id))) return true;
      if (n.targetType === 'single' && n.targetValues?.includes(currentUser.id)) return true;
      return false;
    });
  }, [allNotifs, currentUser]);

  const [pendingDocs, setPendingDocs] = useState<DocumentReferral[]>(() => {
    if (!currentUser) return [];
    try {
      return getPendingReferralsForUser(currentUser, currentUser.fullName || currentUser.username);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!currentUser) {
      setPendingDocs([]);
      return;
    }
    const updateDocs = () => {
      try {
        const list = getPendingReferralsForUser(currentUser, currentUser.fullName || currentUser.username);
        setPendingDocs(prev => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list));
      } catch {
        setPendingDocs([]);
      }
    };
    fetchDocumentReferralsFromServer().then(() => updateDocs()).catch(() => updateDocs());
    window.addEventListener('hse_document_referrals_updated', updateDocs);
    return () => {
      window.removeEventListener('hse_document_referrals_updated', updateDocs);
    };
  }, [currentUser?.id, currentUser?.personnelNumber, currentUser?.fullName, currentUser?.username, currentUser?.role]);

  const hasActiveAlert = userBulletins.length > 0 || pendingDocs.length > 0;
  const totalAlertCount = userBulletins.length + pendingDocs.length;

  // Top Navbar is persistently displayed across all modules when not in fullscreen mode
  const showTopNavbar = !isFullscreenFormOpen;

  const isFa = language === 'fa';

  if (!currentUser) {
    return (
      <SyncProvider>
        <NotificationProvider currentUser={null}>
          <LoginScreen 
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setCurrentUserInAuth(user);
              setActiveTab('dashboard');
            }}
            language={language}
            setLanguage={setLanguage}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
          />
          <NotificationPopupModal />
        </NotificationProvider>
      </SyncProvider>
    );
  }

 const currentTabMeta = allowedTabs.find(t => t.key === activeTab) || allowedTabs[0];
 const CurrentIcon = currentTabMeta?.icon || LayoutDashboard;

 const handleLogout = async () => {
   if (currentUser) {
     addAuditLog(currentUser.username, 'خروج اختیاری کاربر از سامانه', 'خروج سیستم');
   }
   if (typeof centralSync?.stopSync === 'function') {
     centralSync.stopSync();
   }
   try {
     localStorage.removeItem('hse_active_tab');
     sessionStorage.removeItem('hse_active_tab');
     window.location.hash = '#dashboard';
   } catch {}
   await apiDb.logout();
   setCurrentUser(null);
   setCurrentUserInAuth(null);
 };

 return (
 <SyncProvider>
 <NotificationProvider currentUser={currentUser}>
 <div className="h-screen h-[100dvh] max-h-screen max-h-[100dvh] relative overflow-hidden bg-slate-50 dark:bg-[#0b0f19] flex flex-row font-sans select-none text-slate-800 dark:text-slate-100 transition-colors duration-500" id="app-layout" dir={isFa ? 'rtl' : 'ltr'}>
 
 {/* ── Background Geometric & Ambient Glow Layers (Inspired by Login Screen) ── */}
 <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
   {/* Subtle dot matrix pattern */}
   <div 
     className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]" 
     style={{
       backgroundImage: `radial-gradient(circle at 1px 1px, ${themeMode === 'light' ? '#0284c7' : '#38bdf8'} 1px, transparent 0)`,
       backgroundSize: '36px 36px'
     }}
   />

   {/* Ambient Glows themed around HSE Brand Colors: Sky Blue, Emerald Green, Flame Orange */}
   <div className="absolute -top-32 -left-32 w-[38rem] h-[38rem] rounded-full bg-sky-500/10 dark:bg-sky-500/15 blur-[130px]" />
   <div className="absolute top-1/3 -right-32 w-[36rem] h-[36rem] rounded-full bg-emerald-500/10 dark:bg-emerald-500/12 blur-[140px]" />
   <div className="absolute -bottom-28 left-1/3 w-[40rem] h-[40rem] rounded-full bg-blue-500/10 dark:bg-blue-500/8 blur-[150px]" />
 </div>

 {/* Unified AppSidebar - Spans full-height from top margin to bottom margin */}
 <AppSidebar 
   activeTab={activeTab}
   setActiveTab={setActiveTab}
   language={language}
   setLanguage={setLanguage}
   themeMode={themeMode}
   setThemeMode={setThemeMode}
   currentUser={currentUser}
   allowedTabs={allowedTabs}
   isOpen={isSidebarOpen}
   onClose={() => setIsSidebarOpen(false)}
   isCollapsed={isSidebarCollapsed}
   onToggleCollapse={handleToggleSidebarCollapse}
   onLogout={handleLogout}
 />

 {/* Main Content Area (Header + Main Stage + Corporate Footer) */}
 <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative" id="app-main-area">

  {/* Top Professional Header Bar - Floating Card (Exclusively rendered on main Dashboard) */}
  {showTopNavbar && (
  <div className="shrink-0 relative z-20 px-3 pt-3 sm:px-4 sm:pt-3.5 lg:px-6 lg:pt-4">
    <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-2xl py-2.5 px-3 sm:px-5 flex flex-wrap items-center justify-between gap-2 sm:gap-4 shadow-xs transition-all relative z-20" id="app-header">
  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
    <button onClick={() => setIsSidebarOpen(true)} className="p-2 -mx-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl lg:hidden transition-colors cursor-pointer text-slate-600 dark:text-slate-400 shrink-0" aria-label={isFa ? 'باز کردن منو' : 'Open menu'}>
      <Menu className="w-5 h-5" />
    </button>
    <div className="hidden sm:flex items-center justify-center p-1 bg-white/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700/70 shrink-0 overflow-hidden shadow-xs">
      <HseLogo size="sm" target="nav" showShadow={false} />
    </div>
  <div className="min-w-0 flex-1">
  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 truncate">
    <span className="hidden md:inline truncate">{isFa ? 'سیستم مدیریت بهداشت، ایمنی و محیط زیست (HSE)' : 'Health, Safety & Environment Management System (HSE)'}</span>
    <span className="hidden md:inline">•</span>
    <span className="text-blue-600 dark:text-blue-400 font-bold truncate">
      {currentTabMeta?.category || (isFa ? 'ماژول فعال' : 'Active Module')}
    </span>
  </div>
    <h1 className="text-xs sm:text-base font-black text-slate-800 dark:text-slate-100 leading-tight flex items-center gap-1.5 min-w-0">
      <CurrentIcon className="w-4 h-4 text-blue-500 inline-block shrink-0" />
      <span className="truncate">{isFa ? currentTabMeta?.titleFa : currentTabMeta?.titleEn}</span>
    </h1>
  </div>
  </div>

  {/* Global togglers & Clock */}
  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
  
  <SystemStatusBadge />

  {/* Clock block */}
  <HeaderClock language={language} />

  {/* Central HSE Notification & Alert Center */}
  <NotificationBellDropdown language={language} />

  </div>
  </header>
  </div>
  )}

  {/* Floating Mobile Navigation Button (Exclusively displayed on non-dashboard modules when Top Navbar is hidden) */}
  {!showTopNavbar && (
    <button 
      type="button"
      onClick={() => setIsSidebarOpen(true)} 
      className="lg:hidden fixed top-3.5 start-3.5 z-20 p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
      title={isFa ? 'باز کردن منو' : 'Open Menu'}
      aria-label="Open Navigation Menu"
    >
      <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
    </button>
  )}

  {/* Core Sub-Module View Render */}
  <main className={`flex-1 min-w-0 overflow-y-auto px-3 sm:px-4 lg:px-6 custom-scrollbar ${showTopNavbar ? 'py-2.5 sm:py-3 lg:py-3.5' : 'py-3.5 sm:py-4 lg:py-5'}`} id="app-main-stage">
      <div className="w-full max-w-[1920px] mx-auto space-y-6">
       <ModuleErrorBoundary isFa={isFa} key={activeTab}>
         <React.Suspense fallback={<ModuleLoadingFallback isFa={isFa} />}>
           <div>
         {activeTab === 'dashboard' && (
 <Dashboard 
 heatRecord={activeHeatRecord}
 trirSeries={dashboardSeries}
 trirTarget={trirTarget}
 warnings={warnings}
 onNavigate={setActiveTab}
 language={language}
 currentUser={currentUser}
 />
 )}

 {activeTab === 'heat' && (
 <HeatStressMonitor 
 log={heatLog}
 onLogUpdated={handleHeatLogUpdated}
 activeRecord={activeHeatRecord}
 setActiveRecord={setActiveRecord}
 language={language}
 setLanguage={setLanguage}
 currentUser={currentUser}
 />
 )}

 {activeTab === 'hse-ms' && (
 <HseMsManager 
 trirRecords={trirRecords}
 onTrirRecordsUpdated={handleTrirRecordsUpdated}
 trirTarget={trirTarget}
 onTrirTargetUpdated={handleTrirTargetUpdated}
 language={language}
 currentUser={currentUser}
 />
 )}

 {activeTab === 'warnings' && (
 <WarningsManager 
 warnings={warnings}
 onWarningsUpdated={handleWarningsUpdated}
 language={language}
 currentUser={currentUser}
 />
 )}

 {activeTab === 'non-conformances' && (
 <ComprehensiveNonConformanceModule
 language={language}
 currentUser={currentUser}
 onNavigateToModule={(mod) => setActiveTab(mod as any)}
 />
 )}


 {activeTab === 'profile' && (
 <UserProfilePage 
 currentUser={currentUser}
 language={language}
 onProfileUpdated={(updatedUser) => {
 setCurrentUser(updatedUser);
 try { sessionStorage.setItem('hse_current_user', JSON.stringify(updatedUser)); } catch(e) { console.error(e); }
 }}
 />
 )}

 {activeTab === 'permit' && (
 <WorkPermitModule 
 language={language}
 currentUser={currentUser}
 />
 )}

 {activeTab === 'ptw-audit' && (
 <PtwAuditModule 
 language={language}
 currentUser={currentUser}
 />
 )}

 
                        {activeTab === 'risk' && (
              <RiskAssessment currentUser={currentUser} isFa={isFa} />
            )}

            {activeTab === 'training' && (
              <TrainingMgmt isFa={isFa} currentUser={currentUser} />
            )}


            {activeTab === 'ppe' && (
              <PpeManagement isFa={isFa} currentUser={currentUser} />
            )}

            {activeTab === 'incidents' && (
              <IncidentReporting isFa={isFa} currentUser={currentUser} />
            )}

            {activeTab === 'reports' && (
              <ReportsModule 
                isFa={isFa} 
                currentUser={currentUser} 
                trirRecords={trirRecords}
                warnings={warnings}
                trirTarget={trirTarget}
              />
            )}

            {activeTab === 'personnel-history' && (
              <PersonnelHistoryModule 
                isFa={isFa} 
                currentUser={currentUser} 
                warnings={warnings}
              />
            )}

            {activeTab === 'pending-documents' && (
              <PendingDocuments 
                currentUser={currentUser} 
                isFa={isFa} 
                onNavigateToDocument={(docType, docId) => {
                  if (docType === 'PERMIT') {
                    setActiveTab('permit');
                  } else if (docType === 'INCIDENT') {
                    setActiveTab('incidents');
                  }
                }}
              />
            )}
            
            {activeTab === 'documents' && (
              <InstructionsDocumentsModule 
                language={language}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'process-management' && (
              <ProcessManagementModule language={language} />
            )}

            {activeTab === 'safety-unit' && (
              <SafetyUnitModule 
                isFa={isFa} 
                currentUser={currentUser}
              />
            )}

            {activeTab === 'fire-dept' && (
              <FireDeptModule language={language} />
            )}

            {activeTab === 'health-env' && (
              <HealthEnvModule 
                language={language} 
                currentUser={currentUser}
              />
            )}

            {activeTab === 'notifications' && (
              <SystemNotificationsTab
                isFa={isFa}
                language={language}
                currentUser={currentUser}
                shortcutMode={true}
              />
            )}

            {activeTab === 'system' && (
              <SystemSettings 
                language={language}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'user-mgmt' && (
              <UserManagement 
                currentUser={currentUser}
                language={language}
                onUserUpdateTrigger={() => {}}
              />
            )}

            {activeTab === 'ai-assistant' && (
              <AiAssistantApp 
                currentUser={currentUser}
                language={language}
              />
            )}
 </div>
       </React.Suspense>
       </ModuleErrorBoundary>
 </div>
 </main>

  {/* Corporate footer info - Floating Card */}
  <div className="shrink-0 z-10 px-3 pb-3 sm:px-4 sm:pb-3.5 lg:px-6 lg:pb-4">
    <footer className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md py-2.5 px-4 text-center border border-slate-200/80 dark:border-slate-800/80 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 font-bold shadow-xs transition-all" id="app-footer">
      {isFa 
        ? 'کلیه حقوق مادی و معنوی سامانه متعلق به آقا مصطفی سیروس، کارشناس ارشد بهداشت، ایمنی و محیط زیست (HSE) میباشد.' 
        : 'All rights reserved © Agha Mostafa Sirous, Senior Occupational Health, Safety & Environment (HSE) Expert.'}
    </footer>
  </div>
 </div>

 <PrintNotificationModal />
 <NotificationPopupModal />
 </div>
 </NotificationProvider>
 </SyncProvider>
 );
}
