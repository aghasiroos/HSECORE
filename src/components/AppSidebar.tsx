import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Thermometer,
  Gauge,
  BarChart3,
  Building2,
  ShieldCheck,
  ShieldAlert,
  Flame,
  Leaf,
  FileText,
  FileCheck2,
  ClipboardCheck,
  HardHat,
  BrainCircuit,
  AlertOctagon,
  AlertTriangle,
  UserCheck,
  GraduationCap,
  Inbox,
  Workflow,
  SlidersHorizontal,
  Settings2,
  UserCog,
  User,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Languages,
  Sun,
  Moon,
  LogOut,
  Layers,
  Sparkles,
  Pin,
  PinOff,
  Star,
  BookOpen,
  ChevronsUpDown,
  Bell,
  Bot
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  getMergedUiConfig,
  SYSTEM_MODULE_GROUPS,
  SystemModuleConfig
} from '../config/modulesConfig';
import { useSync } from '../context/SyncContext';
import { useSystemBranding, getSidebarNavBranding } from '../utils/systemBrandingHelper';
import { HseCoreBrandText } from './common/HseCoreBrandText';
import { prefetchModule } from '../utils/modulePrefetcher';

export type MainTabKey =
  | 'dashboard'
  | 'heat'
  | 'hse-ms'
  | 'warnings'
  | 'user-mgmt'
  | 'profile'
  | 'permit'
  | 'ptw-audit'
  | 'system'
  | 'training'
  | 'risk'
  | 'reports'
  | 'ppe'
  | 'incidents'
  | 'personnel-history'
  | 'pending-documents'
  | 'process-management'
  | 'safety-unit'
  | 'fire-dept'
  | 'health-env'
  | 'non-conformances'
  | 'documents'
  | 'notifications'
  | 'ai-assistant';

export interface TabItemConfig {
  key: MainTabKey;
  icon: any;
  titleFa: string;
  titleEn: string;
  category?: string;
  badge?: string | number;
  badgeColor?: string;
  accentColor?: string;
  iconBg?: string;
  descriptionFa?: string;
}

interface AppSidebarProps {
  activeTab: MainTabKey;
  setActiveTab: (tab: MainTabKey) => void;
  language: 'fa' | 'en';
  setLanguage?: (lang: 'fa' | 'en') => void;
  themeMode?: 'light' | 'dark';
  setThemeMode?: (theme: 'light' | 'dark') => void;
  currentUser: UserProfile;
  allowedTabs: TabItemConfig[];
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout?: () => void | Promise<void>;
}

type ToneKey =
  | 'sky'
  | 'orange'
  | 'blue'
  | 'teal'
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'purple'
  | 'red'
  | 'indigo'
  | 'violet'
  | 'slate';

interface ToneStyle {
  iconText: string;
  iconBg: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
  activeIconBg: string;
  activeBar: string;
  activeDot: string;
}

const TONE_PALETTE: Record<ToneKey, ToneStyle> = {
  sky: {
    iconText: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-500/10 dark:bg-sky-500/20',
    activeBg: 'bg-gradient-to-r from-sky-500/12 via-sky-500/6 to-transparent dark:from-sky-500/20 dark:via-sky-500/8 dark:to-transparent',
    activeBorder: 'border-sky-500/30 dark:border-sky-400/30',
    activeText: 'text-sky-900 dark:text-sky-100',
    activeIconBg: 'bg-sky-500 text-white shadow-xs shadow-sky-500/40',
    activeBar: 'bg-sky-500 dark:bg-sky-400 shadow-xs shadow-sky-500/50',
    activeDot: 'bg-sky-500'
  },
  orange: {
    iconText: 'text-orange-600 dark:text-orange-400',
    iconBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    activeBg: 'bg-gradient-to-r from-orange-500/12 via-orange-500/6 to-transparent dark:from-orange-500/20 dark:via-orange-500/8 dark:to-transparent',
    activeBorder: 'border-orange-500/30 dark:border-orange-400/30',
    activeText: 'text-orange-900 dark:text-orange-100',
    activeIconBg: 'bg-orange-500 text-white shadow-xs shadow-orange-500/40',
    activeBar: 'bg-orange-500 dark:bg-orange-400 shadow-xs shadow-orange-500/50',
    activeDot: 'bg-orange-500'
  },
  blue: {
    iconText: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    activeBg: 'bg-gradient-to-r from-blue-500/12 via-blue-500/6 to-transparent dark:from-blue-500/20 dark:via-blue-500/8 dark:to-transparent',
    activeBorder: 'border-blue-500/30 dark:border-blue-400/30',
    activeText: 'text-blue-900 dark:text-blue-100',
    activeIconBg: 'bg-blue-600 text-white shadow-xs shadow-blue-500/40',
    activeBar: 'bg-blue-600 dark:bg-blue-400 shadow-xs shadow-blue-500/50',
    activeDot: 'bg-blue-500'
  },
  teal: {
    iconText: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-500/10 dark:bg-teal-500/20',
    activeBg: 'bg-gradient-to-r from-teal-500/12 via-teal-500/6 to-transparent dark:from-teal-500/20 dark:via-teal-500/8 dark:to-transparent',
    activeBorder: 'border-teal-500/30 dark:border-teal-400/30',
    activeText: 'text-teal-900 dark:text-teal-100',
    activeIconBg: 'bg-teal-600 text-white shadow-xs shadow-teal-500/40',
    activeBar: 'bg-teal-600 dark:bg-teal-400 shadow-xs shadow-teal-500/50',
    activeDot: 'bg-teal-500'
  },
  rose: {
    iconText: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
    activeBg: 'bg-gradient-to-r from-rose-500/12 via-rose-500/6 to-transparent dark:from-rose-500/20 dark:via-rose-500/8 dark:to-transparent',
    activeBorder: 'border-rose-500/30 dark:border-rose-400/30',
    activeText: 'text-rose-900 dark:text-rose-100',
    activeIconBg: 'bg-rose-500 text-white shadow-xs shadow-rose-500/40',
    activeBar: 'bg-rose-500 dark:bg-rose-400 shadow-xs shadow-rose-500/50',
    activeDot: 'bg-rose-500'
  },
  emerald: {
    iconText: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    activeBg: 'bg-gradient-to-r from-emerald-500/12 via-emerald-500/6 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/8 dark:to-transparent',
    activeBorder: 'border-emerald-500/30 dark:border-emerald-400/30',
    activeText: 'text-emerald-900 dark:text-emerald-100',
    activeIconBg: 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/40',
    activeBar: 'bg-emerald-600 dark:bg-emerald-400 shadow-xs shadow-emerald-500/50',
    activeDot: 'bg-emerald-500'
  },
  amber: {
    iconText: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    activeBg: 'bg-gradient-to-r from-amber-500/12 via-amber-500/6 to-transparent dark:from-amber-500/20 dark:via-amber-500/8 dark:to-transparent',
    activeBorder: 'border-amber-500/30 dark:border-amber-400/30',
    activeText: 'text-amber-900 dark:text-amber-100',
    activeIconBg: 'bg-amber-500 text-white shadow-xs shadow-amber-500/40',
    activeBar: 'bg-amber-500 dark:bg-amber-400 shadow-xs shadow-amber-500/50',
    activeDot: 'bg-amber-500'
  },
  purple: {
    iconText: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    activeBg: 'bg-gradient-to-r from-purple-500/12 via-purple-500/6 to-transparent dark:from-purple-500/20 dark:via-purple-500/8 dark:to-transparent',
    activeBorder: 'border-purple-500/30 dark:border-purple-400/30',
    activeText: 'text-purple-900 dark:text-purple-100',
    activeIconBg: 'bg-purple-600 text-white shadow-xs shadow-purple-500/40',
    activeBar: 'bg-purple-600 dark:bg-purple-400 shadow-xs shadow-purple-500/50',
    activeDot: 'bg-purple-500'
  },
  red: {
    iconText: 'text-red-600 dark:text-red-400',
    iconBg: 'bg-red-500/10 dark:bg-red-500/20',
    activeBg: 'bg-gradient-to-r from-red-500/12 via-red-500/6 to-transparent dark:from-red-500/20 dark:via-red-500/8 dark:to-transparent',
    activeBorder: 'border-red-500/30 dark:border-red-400/30',
    activeText: 'text-red-900 dark:text-red-100',
    activeIconBg: 'bg-red-600 text-white shadow-xs shadow-red-500/40',
    activeBar: 'bg-red-600 dark:bg-red-400 shadow-xs shadow-red-500/50',
    activeDot: 'bg-red-500'
  },
  indigo: {
    iconText: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    activeBg: 'bg-gradient-to-r from-indigo-500/12 via-indigo-500/6 to-transparent dark:from-indigo-500/20 dark:via-indigo-500/8 dark:to-transparent',
    activeBorder: 'border-indigo-500/30 dark:border-indigo-400/30',
    activeText: 'text-indigo-900 dark:text-indigo-100',
    activeIconBg: 'bg-indigo-600 text-white shadow-xs shadow-indigo-500/40',
    activeBar: 'bg-indigo-600 dark:bg-indigo-400 shadow-xs shadow-indigo-500/50',
    activeDot: 'bg-indigo-500'
  },
  violet: {
    iconText: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/20',
    activeBg: 'bg-gradient-to-r from-violet-500/12 via-violet-500/6 to-transparent dark:from-violet-500/20 dark:via-violet-500/8 dark:to-transparent',
    activeBorder: 'border-violet-500/30 dark:border-violet-400/30',
    activeText: 'text-violet-900 dark:text-violet-100',
    activeIconBg: 'bg-violet-600 text-white shadow-xs shadow-violet-500/40',
    activeBar: 'bg-violet-600 dark:bg-violet-400 shadow-xs shadow-violet-500/50',
    activeDot: 'bg-violet-500'
  },
  slate: {
    iconText: 'text-slate-600 dark:text-slate-300',
    iconBg: 'bg-slate-500/10 dark:bg-slate-500/20',
    activeBg: 'bg-slate-100 dark:bg-slate-800/80',
    activeBorder: 'border-slate-300 dark:border-slate-700',
    activeText: 'text-slate-900 dark:text-white',
    activeIconBg: 'bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 shadow-xs',
    activeBar: 'bg-slate-700 dark:bg-slate-300',
    activeDot: 'bg-slate-400'
  }
};

const MODULE_META: Record<MainTabKey, { icon: any; tone: ToneKey }> = {
  dashboard: { icon: LayoutDashboard, tone: 'sky' },
  heat: { icon: Thermometer, tone: 'orange' },
  'hse-ms': { icon: Gauge, tone: 'blue' },
  reports: { icon: BarChart3, tone: 'teal' },
  'safety-unit': { icon: ShieldCheck, tone: 'blue' },
  'fire-dept': { icon: Flame, tone: 'rose' },
  'health-env': { icon: Leaf, tone: 'emerald' },
  permit: { icon: FileText, tone: 'amber' },
  'ptw-audit': { icon: ClipboardCheck, tone: 'orange' },
  risk: { icon: BrainCircuit, tone: 'purple' },
  ppe: { icon: HardHat, tone: 'sky' },
  incidents: { icon: AlertOctagon, tone: 'rose' },
  warnings: { icon: AlertTriangle, tone: 'red' },
  'non-conformances': { icon: ShieldAlert, tone: 'amber' },
  'personnel-history': { icon: UserCheck, tone: 'emerald' },
  training: { icon: GraduationCap, tone: 'teal' },
  documents: { icon: BookOpen, tone: 'indigo' },
  'pending-documents': { icon: Inbox, tone: 'indigo' },
  'process-management': { icon: Workflow, tone: 'violet' },
  notifications: { icon: Bell, tone: 'amber' },
  'ai-assistant': { icon: Bot, tone: 'indigo' },
  system: { icon: Settings2, tone: 'slate' },
  'user-mgmt': { icon: UserCog, tone: 'slate' },
  profile: { icon: User, tone: 'slate' }
};

const GROUP_META: Record<string, { icon: any; tone: ToneKey }> = {
  dashboards: { icon: BarChart3, tone: 'sky' },
  departments: { icon: Building2, tone: 'rose' },
  safety_permits: { icon: FileCheck2, tone: 'amber' },
  incidents_compliance: { icon: AlertOctagon, tone: 'red' },
  human_capital: { icon: GraduationCap, tone: 'emerald' },
  workflows: { icon: Workflow, tone: 'indigo' },
  system: { icon: SlidersHorizontal, tone: 'slate' }
};

const PINNED_STORAGE_KEY = 'hsecore_sidebar_pinned_tabs_v3';
const OPEN_GROUPS_STORAGE_KEY = 'hsecore_sidebar_open_groups_v2';

export default function AppSidebar({
  activeTab,
  setActiveTab,
  language,
  setLanguage,
  themeMode = 'light',
  setThemeMode,
  currentUser,
  allowedTabs,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  onLogout
}: AppSidebarProps) {
  const isFa = language === 'fa';
  const { status, syncNow } = useSync();
  const [searchQuery, setSearchQuery] = useState('');

  // Pinned favorite tabs: No modules pinned by default. Pinned items are strictly user-selected.
  const [pinnedKeys, setPinnedKeys] = useState<MainTabKey[]>(() => {
    try {
      // Clear legacy hardcoded defaults
      localStorage.removeItem('hsecore_sidebar_pinned_tabs_v2');
      localStorage.removeItem('hsecore_sidebar_pinned_tabs');

      const saved = localStorage.getItem(PINNED_STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as MainTabKey[];
      }
    } catch {}
    return [] as MainTabKey[];
  });

  const togglePinTab = (e: React.MouseEvent, key: MainTabKey) => {
    e.stopPropagation();
    setPinnedKeys(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      try {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const syncDotClass =
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'syncing'
      ? 'bg-blue-500 animate-ping'
      : status === 'offline'
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const syncTitle =
    status === 'connected'
      ? isFa
        ? 'دیتابیس متصل و همگام (کلیک برای همگام‌سازی دستی)'
        : 'Central DB Synced (Click to sync)'
      : status === 'syncing'
      ? isFa
        ? 'در حال همگام‌سازی با پایگاه داده...'
        : 'Syncing with DB...'
      : isFa
      ? 'کلیک برای همگام‌سازی مجدد'
      : 'Click to force sync';

  // Responsive mobile detector (< 1024px)
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1024 : false));
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile && isOpen) {
        onClose();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMobile, onClose]);

  // Hover-to-expand state on desktop
  const [isHovered, setIsHovered] = useState(false);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (isMobile) return;
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    leaveTimeoutRef.current = setTimeout(() => setIsHovered(false), 220);
  };

  useEffect(() => {
    return () => {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  const isVisuallyExpanded = isMobile ? isOpen : !isCollapsed || isHovered;
  const effectiveCollapsed = !isMobile && !isVisuallyExpanded;

  // Dynamic UI configuration & branding
  const [uiConfig, setUiConfig] = useState<SystemModuleConfig[]>(() => getMergedUiConfig());
  const { branding } = useSystemBranding();
  const sidebarBranding = getSidebarNavBranding(branding);

  useEffect(() => {
    const handleConfigUpdate = () => setUiConfig(getMergedUiConfig());
    window.addEventListener('hse_ui_config_updated', handleConfigUpdate);
    return () => window.removeEventListener('hse_ui_config_updated', handleConfigUpdate);
  }, []);

  // Structured groups with permitted modules
  const structuredGroups = useMemo(() => {
    return SYSTEM_MODULE_GROUPS.map(g => {
      const meta = GROUP_META[g.id] || GROUP_META.dashboards;
      const assignedKeys = uiConfig
        .filter(m => (m.groupId || 'dashboards') === g.id)
        .map(m => m.key as MainTabKey);

      const tabs = assignedKeys
        .map(key => allowedTabs.find(t => t.key === key))
        .filter((t): t is TabItemConfig => t !== undefined);

      return {
        id: g.id,
        titleFa: g.titleFa,
        titleEn: g.titleEn,
        icon: meta.icon,
        tone: meta.tone,
        style: TONE_PALETTE[meta.tone],
        tabs
      };
    }).filter(g => g.tabs.length > 0);
  }, [uiConfig, allowedTabs]);

  // Collapsible groups persistence (In expanded mode: keep it clean, active group auto-opened)
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch {}
    return {
      dashboards: true,
      departments: true,
      safety_permits: true,
      incidents_compliance: true,
      human_capital: true,
      workflows: true,
      system: true
    };
  });

  // Auto-expand active group when activeTab changes
  useEffect(() => {
    const activeGroup = structuredGroups.find(g => g.tabs.some(t => t.key === activeTab));
    if (activeGroup && !openGroupIds[activeGroup.id]) {
      setOpenGroupIds(prev => ({ ...prev, [activeGroup.id]: true }));
    }
  }, [activeTab, structuredGroups]);

  useEffect(() => {
    try {
      sessionStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(openGroupIds));
    } catch {}
  }, [openGroupIds]);

  const toggleGroup = (groupId: string) => {
    setOpenGroupIds(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const areAllGroupsOpen = useMemo(() => {
    return structuredGroups.every(g => openGroupIds[g.id]);
  }, [structuredGroups, openGroupIds]);

  const toggleAllGroups = () => {
    const targetState = !areAllGroupsOpen;
    const next: Record<string, boolean> = {};
    structuredGroups.forEach(g => {
      next[g.id] = targetState;
    });
    setOpenGroupIds(next);
  };

  // Filtered groups based on search query
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    return structuredGroups
      .map(g => {
        if (!normalizedQuery) return g;
        const groupMatches =
          g.titleFa.toLowerCase().includes(normalizedQuery) ||
          g.titleEn.toLowerCase().includes(normalizedQuery);
        if (groupMatches) return g;

        const matchingTabs = g.tabs.filter(
          tab =>
            tab.titleFa.toLowerCase().includes(normalizedQuery) ||
            tab.titleEn.toLowerCase().includes(normalizedQuery)
        );
        return { ...g, tabs: matchingTabs };
      })
      .filter(g => g.tabs.length > 0);
  }, [structuredGroups, normalizedQuery]);

  // Pinned tab items that are currently permitted
  const pinnedTabs = useMemo(() => {
    return pinnedKeys
      .map(key => allowedTabs.find(t => t.key === key))
      .filter((t): t is TabItemConfig => t !== undefined);
  }, [pinnedKeys, allowedTabs]);

  const handleSelectTab = (key: MainTabKey) => {
    setActiveTab(key);

    if (isCollapsed) {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
        leaveTimeoutRef.current = null;
      }
      setIsHovered(false);
    }

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9990] transition-opacity duration-300 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Desktop Spacer Anchor */}
      <div
        className={`hidden lg:block shrink-0 transition-all duration-300 h-full ${
          !isCollapsed ? 'w-72 sm:w-80' : 'w-20'
        }`}
        aria-hidden="true"
      />

      {/* Main Sidebar Shell */}
      <aside
        id="app-main-sidebar"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          fixed top-0 bottom-0 z-[9995] h-[100dvh] max-h-[100dvh]
          ${isFa ? 'right-0 border-l' : 'left-0 border-r'}
          border-slate-200/90 dark:border-slate-800/80
          bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md
          flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 overflow-hidden
          ${!effectiveCollapsed ? 'shadow-2xl shadow-slate-900/15 dark:shadow-black/70 ring-1 ring-slate-900/5 dark:ring-white/5' : 'shadow-md lg:shadow-none'}
          ${isOpen ? 'translate-x-0' : isFa ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${effectiveCollapsed ? 'w-20' : 'w-[88vw] max-w-[340px] lg:w-72 xl:w-80'}
        `}
        dir={isFa ? 'rtl' : 'ltr'}
      >
        {/* ===================== 1. MINIMAL HEADER ===================== */}
        <div
          className={`p-3 border-b border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between ${
            effectiveCollapsed ? 'px-2 py-3' : 'gap-2'
          } shrink-0 bg-white dark:bg-[#0c121e]`}
        >
          {effectiveCollapsed ? (
            <div className="flex flex-col items-center justify-center w-full gap-2.5">
              <div className="flex items-center justify-center select-none leading-none" dir="ltr">
                <HseCoreBrandText
                  size="sm"
                  titleOverride={sidebarBranding.titleText}
                  themeAdapt={true}
                  showHseOnly={true}
                />
              </div>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={isFa ? 'سنجاق کردن منو (باز ماندن دائمی)' : 'Pin Menu (Keep Open)'}
                id="sidebar-collapse-toggle-btn-collapsed"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 shrink-0 min-w-0">
                {sidebarBranding.showTitle && (
                  <h2 className="select-none flex items-center leading-none py-0.5 truncate" dir="ltr">
                    <HseCoreBrandText
                      size="sidebar"
                      titleOverride={sidebarBranding.titleText}
                      themeAdapt={true}
                      showHseOnly={false}
                    />
                  </h2>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setLanguage && setLanguage(language === 'fa' ? 'en' : 'fa')}
                  className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title={isFa ? 'Switch to English' : 'تغییر به فارسی'}
                  id="sidebar-language-toggle-btn"
                >
                  <Languages className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setThemeMode && setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                  className="p-1.5 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title={themeMode === 'dark' ? (isFa ? 'حالت روشن' : 'Light Mode') : (isFa ? 'حالت تاریک' : 'Dark Mode')}
                  id="sidebar-theme-toggle-btn"
                >
                  {themeMode === 'dark' ? <Moon className="w-4 h-4 text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                </button>

                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className={`hidden lg:flex p-1.5 ${
                    !isCollapsed
                      ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50'
                      : 'text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  } rounded-lg transition-colors cursor-pointer`}
                  title={!isCollapsed ? (isFa ? 'حالت خودکار هاور' : 'Auto-hover') : (isFa ? 'سنجاق کردن منو' : 'Pin Menu')}
                  id="sidebar-pin-toggle-btn"
                >
                  {!isCollapsed ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
                    setIsHovered(false);
                    if (!isCollapsed) onToggleCollapse();
                  }}
                  className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title={isFa ? 'جمع کردن منو' : 'Collapse Menu'}
                  id="sidebar-collapse-toggle-btn"
                >
                  {isFa ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="lg:hidden p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title={isFa ? 'بستن منو' : 'Close Menu'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ===================== 2. SLEEK SEARCH & CATEGORY BAR ===================== */}
        {!effectiveCollapsed && (
          <div className="p-2.5 pb-2 border-b border-slate-200/60 dark:border-slate-800/60 space-y-2 shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
            {/* Search Input with Clear & Collapse-All Toggle */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isFa ? 'جستجوی ماژول...' : 'Search modules...'}
                  className="w-full pl-7 pr-8 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/60 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all font-medium"
                />
                <Search className={`w-3.5 h-3.5 text-slate-400 absolute top-2.5 ${isFa ? 'right-2.5' : 'left-2.5'}`} />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className={`absolute top-2.5 ${isFa ? 'left-2.5' : 'right-2.5'} text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer`}
                    title={isFa ? 'پاک کردن' : 'Clear'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={toggleAllGroups}
                className="p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900/90 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title={areAllGroupsOpen ? (isFa ? 'بستن همه گروه‌ها' : 'Collapse all') : (isFa ? 'باز کردن همه گروه‌ها' : 'Expand all')}
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ===================== 3. GROUPS & MODULES NAVIGATION ===================== */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-2 select-none overscroll-contain"
          id="sidebar-nav-modules-container"
        >
          {!effectiveCollapsed ? (
            /* ===================== EXPANDED SIDEBAR VIEW ===================== */
            <div className="space-y-3">
              {/* Pinned / Quick Access Bar */}
              {!normalizedQuery && pinnedTabs.length > 0 && (
                <div className="space-y-1.5 pb-2 mb-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex items-center justify-between px-2 text-[10.5px] font-bold text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>{isFa ? 'دسترسی سریع (سنجاق‌شده)' : 'Quick Access (Pinned)'}</span>
                    </span>
                    <span className="text-[9.5px] font-mono tabular-nums">{pinnedTabs.length}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {pinnedTabs.map(tab => {
                      const isActive = activeTab === tab.key;
                      const meta = MODULE_META[tab.key] || { icon: tab.icon || Layers, tone: 'sky' as ToneKey };
                      const TabIcon = meta.icon || tab.icon;
                      const toneStyle = TONE_PALETTE[meta.tone];
                      const title = isFa ? tab.titleFa : tab.titleEn || tab.titleFa;

                      return (
                        <button
                          key={`pinned-${tab.key}`}
                          type="button"
                          onClick={() => handleSelectTab(tab.key)}
                          onMouseEnter={() => prefetchModule(tab.key)}
                          onTouchStart={() => prefetchModule(tab.key)}
                          className={`p-2 rounded-xl text-start transition-all cursor-pointer group relative border flex items-center gap-2 ${
                            isActive
                              ? `${toneStyle.activeBg} ${toneStyle.activeBorder} ${toneStyle.activeText} font-black shadow-2xs`
                              : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800/70 font-semibold'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                              isActive ? toneStyle.activeIconBg : `${toneStyle.iconBg} ${toneStyle.iconText}`
                            }`}
                          >
                            <TabIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate text-[11px] leading-tight flex-1">{title}</span>
                          <span
                            onClick={e => togglePinTab(e, tab.key)}
                            className="opacity-0 group-hover:opacity-100 hover:text-amber-500 text-slate-400 p-0.5 rounded cursor-pointer transition-opacity"
                            title={isFa ? 'حذف از دسترسی سریع' : 'Unpin'}
                          >
                            <X className="w-3 h-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grouped Modules */}
              {visibleGroups.length === 0 ? (
                <div className="text-center py-10 px-3 space-y-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {isFa ? 'ماژولی با این عنوان یافت نشد' : 'No matching module found'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                    }}
                    className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer"
                  >
                    {isFa ? 'نمایش همه ماژول‌ها' : 'Show all modules'}
                  </button>
                </div>
              ) : (
                visibleGroups.map(group => {
                  const isGroupOpen = normalizedQuery ? true : !!openGroupIds[group.id];
                  const isGroupActive = group.tabs.some(t => t.key === activeTab);
                  const GroupIcon = group.icon;

                  return (
                    <div key={group.id} className="space-y-1">
                      {/* Minimal Group Header */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-sm transition-colors cursor-pointer select-none group/hdr ${
                          isGroupActive
                            ? 'text-slate-900 dark:text-white font-extrabold'
                            : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40 font-bold'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-transform group-hover/hdr:scale-105 ${group.style.iconBg} ${group.style.iconText}`}
                          >
                            <GroupIcon className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate tracking-tight font-bold">{isFa ? group.titleFa : group.titleEn}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono font-bold tabular-nums">
                            {group.tabs.length}
                          </span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                              isGroupOpen ? 'rotate-0' : isFa ? 'rotate-90' : '-rotate-90'
                            }`}
                          />
                        </div>
                      </button>

                      {/* Smooth Collapsible Module Item List */}
                      {isGroupOpen && (
                        <div
                          className={`space-y-0.5 ${
                            isFa ? 'mr-2 pr-1.5 border-r' : 'ml-2 pl-1.5 border-l'
                          } border-slate-200/80 dark:border-slate-800/80`}
                        >
                          {group.tabs.map(tab => {
                            const isActive = activeTab === tab.key;
                            const isPinned = pinnedKeys.includes(tab.key);
                            const meta = MODULE_META[tab.key] || { icon: tab.icon || Layers, tone: 'sky' as ToneKey };
                            const toneStyle = TONE_PALETTE[meta.tone];
                            const TabIcon = meta.icon || tab.icon;
                            const title = isFa ? tab.titleFa : tab.titleEn || tab.titleFa;

                            return (
                              <button
                                key={tab.key}
                                type="button"
                                id={`sidebar-nav-${tab.key}`}
                                onClick={() => handleSelectTab(tab.key)}
                                onMouseEnter={() => prefetchModule(tab.key)}
                                onTouchStart={() => prefetchModule(tab.key)}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-all duration-150 cursor-pointer group relative border ${
                                  isActive
                                    ? `${toneStyle.activeBg} ${toneStyle.activeBorder} ${toneStyle.activeText} font-black shadow-2xs`
                                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50 font-semibold'
                                }`}
                              >
                                {isActive && (
                                  <span
                                    className={`absolute ${
                                      isFa ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                                    } top-2 bottom-2 w-1 ${toneStyle.activeBar}`}
                                    aria-hidden="true"
                                  />
                                )}

                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                                      isActive ? toneStyle.activeIconBg : `${toneStyle.iconBg} ${toneStyle.iconText}`
                                    }`}
                                  >
                                    <TabIcon className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="truncate text-[11.5px] leading-tight">{title}</span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {tab.badge !== undefined && Number(tab.badge) > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black bg-rose-500 text-white tabular-nums shadow-2xs">
                                      {tab.badge}
                                    </span>
                                  )}

                                  <span
                                    onClick={e => togglePinTab(e, tab.key)}
                                    className={`p-1 rounded-md transition-opacity cursor-pointer ${
                                      isPinned
                                        ? 'text-amber-500 opacity-90 hover:opacity-100'
                                        : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'
                                    }`}
                                    title={isPinned ? (isFa ? 'برداشتن سنجاق' : 'Unpin') : (isFa ? 'سنجاق به دسترسی سریع' : 'Pin to top')}
                                  >
                                    <Pin className={`w-3 h-3 ${isPinned ? 'fill-amber-500/20' : ''}`} />
                                  </span>

                                  {isActive && (
                                    <span className={`w-1.5 h-1.5 rounded-full ${toneStyle.activeDot} shrink-0`} />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ===================== DECLUTTERED RAIL NAVIGATION (USER REQUIREMENT) =====================
               Only show GROUP icons + the single ACTIVE executed module.
               Never show all 22 module icons stacked in a column!
            ============================================================================================= */
            <div className="space-y-3 py-2 flex flex-col items-center w-full">
              {structuredGroups.map(group => {
                const isGroupActive = group.tabs.some(t => t.key === activeTab);
                const activeModuleInGroup = group.tabs.find(t => t.key === activeTab);
                const GroupIcon = group.icon;

                return (
                  <div
                    key={`rail-group-${group.id}`}
                    className="flex flex-col items-center w-full"
                  >
                    {/* 1. Group Icon Button - Click to switch to active or first module in group */}
                    <button
                      type="button"
                      onClick={() => {
                        if (activeModuleInGroup) {
                          handleSelectTab(activeModuleInGroup.key);
                        } else if (group.tabs.length > 0) {
                          handleSelectTab(group.tabs[0].key);
                        }
                      }}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative group ${
                        isGroupActive
                          ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                      title={isFa ? group.titleFa : group.titleEn}
                    >
                      <GroupIcon className={`w-5 h-5 ${isGroupActive ? group.style.iconText : ''}`} />

                      {/* Subtle active indicator for group */}
                      {isGroupActive && (
                        <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${group.style.activeDot}`} />
                      )}
                    </button>

                    {/* 2. ONLY IF this group contains the executed module: Show the active module right under it! */}
                    {isGroupActive && activeModuleInGroup && (
                      <div className="mt-1.5 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                        {/* Connecting branch tick */}
                        <div className="w-0.5 h-2 bg-slate-200 dark:bg-slate-700/80 rounded-full" />

                        {/* Active Module Card (Matching user screenshot style) */}
                        {(() => {
                          const meta = MODULE_META[activeModuleInGroup.key] || {
                            icon: activeModuleInGroup.icon || Layers,
                            tone: group.tone
                          };
                          const TabIcon = meta.icon || activeModuleInGroup.icon;
                          const toneStyle = TONE_PALETTE[meta.tone];
                          const title = isFa ? activeModuleInGroup.titleFa : activeModuleInGroup.titleEn || activeModuleInGroup.titleFa;

                          return (
                            <button
                              type="button"
                              onClick={() => handleSelectTab(activeModuleInGroup.key)}
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer relative shadow-sm ${toneStyle.activeBg} border ${toneStyle.activeBorder}`}
                              title={`${title} (${isFa ? 'ماژول فعال' : 'Active Module'})`}
                            >
                              <TabIcon className={`w-5 h-5 ${toneStyle.iconText}`} />

                              {/* Prominent curved pill indicator on the edge as requested */}
                              <span
                                className={`absolute ${
                                  isFa ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
                                } top-2 bottom-2 w-1.5 ${toneStyle.activeBar}`}
                              />

                              {activeModuleInGroup.badge !== undefined && Number(activeModuleInGroup.badge) > 0 && (
                                <span className="absolute -top-1 -left-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center justify-center">
                                  {activeModuleInGroup.badge}
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===================== 4. MINIMAL USER PROFILE & FOOTER ===================== */}
        <div
          className="p-2.5 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 shrink-0 space-y-2 select-none z-10"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)' }}
        >
          {!effectiveCollapsed ? (
            <>
              <div className="flex items-center justify-between gap-2 px-1">
                <div
                  onClick={() => handleSelectTab('profile')}
                  className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity flex-1 min-w-0"
                  title={isFa ? 'پروفایل کاربری' : 'User Profile'}
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-xs overflow-hidden">
                      {currentUser.profilePhoto ? (
                        <img src={currentUser.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                      ) : currentUser.fullName ? (
                        currentUser.fullName.charAt(0)
                      ) : (
                        'U'
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${syncDotClass}`}
                      title={syncTitle}
                      onClick={e => {
                        e.stopPropagation();
                        syncNow();
                      }}
                    />
                  </div>

                  <div className="truncate">
                    <div className="font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">
                      {currentUser.fullName || currentUser.username}
                    </div>
                    <div className="text-[10.5px] text-slate-400 truncate font-medium">
                      {currentUser.role}
                    </div>
                  </div>
                </div>

                <span className="text-[9px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-center shrink-0 tabular-nums">
                  v3.0
                </span>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  id="sidebar-logout-btn"
                  className="w-full py-1.5 px-3 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all duration-150 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>{isFa ? 'خروج امن' : 'Log Out'}</span>
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                onClick={() => handleSelectTab('profile')}
                className="w-9 h-9 mx-auto rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs cursor-pointer hover:scale-105 transition-transform overflow-hidden relative"
                title={currentUser.fullName || currentUser.username}
              >
                {currentUser.profilePhoto ? (
                  <img src={currentUser.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                ) : currentUser.fullName ? (
                  currentUser.fullName.charAt(0)
                ) : (
                  'U'
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 ${syncDotClass}`}
                />
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  id="sidebar-logout-btn-collapsed"
                  className="w-8 h-8 mx-auto rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-all cursor-pointer"
                  title={isFa ? 'خروج از سامانه' : 'Log Out'}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
