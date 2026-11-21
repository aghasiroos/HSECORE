import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartPulse, Wind, Recycle, Leaf, 
  LayoutDashboard, Menu, X,
  Stethoscope, BarChart3, Droplets, Globe, 
  ShieldAlert, CheckSquare, FileSpreadsheet,
  ClipboardCheck, Apple
} from 'lucide-react';
import { getMergedHealthEnvConfig, HealthEnvSubItemConfig } from '../../config/modulesConfig';
import { apiDb } from '../../services/apiDatabaseClient';

// Components
import ComprehensiveExecutiveDashboard from './components/ComprehensiveExecutiveDashboard';
import ClinicSubmoduleView from './components/clinic/ClinicSubmoduleView';
import PeriodicMedicalExamsApp from './components/periodic-exams/PeriodicMedicalExamsApp';
import NonPeriodicExams from './components/NonPeriodicExams';
import NutritionSubmoduleView from './components/nutrition/NutritionSubmoduleView';

import EnvironmentDashboard from './components/EnvironmentDashboard';
import EnvironmentalMonitoringView from './components/EnvironmentalMonitoringView';
import WasteManagementView from './components/WasteManagementView';
import WastewaterManagementView from './components/WastewaterManagementView';
import AirWaterSoilMonitoringView from './components/AirWaterSoilMonitoringView';

import EnvironmentReports from './components/EnvironmentReports';
import FiveSModuleView from './components/FiveS/FiveSModuleView';
import HealthEnvChecklistsView from './components/checklists/HealthEnvChecklistsView';
import { SubViewTransition } from '../../motion';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

interface SubmoduleItemMeta {
  key: string;
  titleFa: string;
  titleEn: string;
  subtitleFa: string;
  group: 'root' | 'health' | 'env';
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}

// Authoritative Metadata for Health & Environment Submodules
const SUBMODULE_CATALOG: SubmoduleItemMeta[] = [
  // Dashboard
  {
    key: 'comprehensive-dashboard',
    titleFa: 'داشبورد جامع مدیریتی',
    titleEn: 'Unified Executive Dashboard',
    subtitleFa: 'تحلیل یکپارچه شاخص‌های بهداشت و محیط‌زیست',
    group: 'root',
    icon: LayoutDashboard,
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60'
  },

  // 1. Occupational Health Group
  {
    key: 'clinic',
    titleFa: 'بهداری و مراجعات سرپایی',
    titleEn: 'Dispensary & Clinic Visits',
    subtitleFa: 'مراجعات، تریاژ، علائم حیاتی و داروها',
    group: 'health',
    icon: HeartPulse,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/60'
  },
  {
    key: 'periodic-exams',
    titleFa: 'معاینات ادواری طب کار',
    titleEn: 'Periodic Medical Exams',
    subtitleFa: 'پرونده سلامت، آزمایشات، BMI و پایش دوره‌ای',
    group: 'health',
    icon: Stethoscope,
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60'
  },
  {
    key: 'non-periodic-exams',
    titleFa: 'معاینات غیر دوره‌ای',
    titleEn: 'Non-Periodic Medical Exams',
    subtitleFa: 'بدو استخدام، بازگشت به کار و اختصاصی',
    group: 'health',
    icon: ClipboardCheck,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60'
  },
  {
    key: 'nutrition',
    titleFa: 'کارشناس تغذیه',
    titleEn: 'Nutrition Specialist',
    subtitleFa: 'ارزیابی وضعیت تغذیه، عادات غذایی و برنامه‌های رژیم',
    group: 'health',
    icon: Apple,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
  },
  {
    key: 'health-env-checklists',
    titleFa: 'چک‌لیست‌های عملیاتی بهداشت و محیط زیست',
    titleEn: 'Operational Health & Environment Checklists',
    subtitleFa: 'بازدید اماکن، آبدارخانه، رستوران، آمبولانس و تسهیلات بهداشتی',
    group: 'health',
    icon: CheckSquare,
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60'
  },

  // 2. Environment Group
  {
    key: 'env-dashboard',
    titleFa: 'داشبورد پایش محیط‌زیست',
    titleEn: 'Environment Dashboard',
    subtitleFa: 'شاخص‌های کلان عملکردی و خوداظهاری',
    group: 'env',
    icon: BarChart3,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
  },
  {
    key: 'env-monitoring',
    titleFa: 'پایش‌های محیط‌زیستی',
    titleEn: 'Environmental Monitoring',
    subtitleFa: 'سنجش آنلاین آلاینده‌های هوا و صوت',
    group: 'env',
    icon: Wind,
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/60'
  },
  {
    key: 'waste-management',
    titleFa: 'مدیریت پسماند (EMP)',
    titleEn: 'Industrial Waste Management',
    subtitleFa: 'تفکیک، انبارش و دفع پسماندهای ویژه',
    group: 'env',
    icon: Recycle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60'
  },
  {
    key: 'wastewater',
    titleFa: 'مدیریت پساب (ETP)',
    titleEn: 'Wastewater Treatment (ETP)',
    subtitleFa: 'تصفیه‌خانه پساب و شاخص‌های کیفی COD/BOD',
    group: 'env',
    icon: Droplets,
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-50 dark:bg-sky-950/60'
  },
  {
    key: 'air-water-soil',
    titleFa: 'پایش دودکش، آب و خاک',
    titleEn: 'Stacks, Water & Soil',
    subtitleFa: 'سامانه CEMS دودکش‌ها، منابع آب و خاک',
    group: 'env',
    icon: Globe,
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60'
  },
  {
    key: 'five-s',
    titleFa: 'ساماندهی 5S محیط کار',
    titleEn: '5S Work Environment',
    subtitleFa: 'ممیزی نظام آراستگی و پاکیزگی محیط کار',
    group: 'env',
    icon: CheckSquare,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60'
  },
  {
    key: 'env-reports',
    titleFa: 'گزارش‌های محیط‌زیست',
    titleEn: 'Environment Reports',
    subtitleFa: 'گزارش‌های رسمی و آمارهای سازمان حفاظت',
    group: 'env',
    icon: FileSpreadsheet,
    iconColor: 'text-slate-600 dark:text-slate-400',
    iconBg: 'bg-slate-100 dark:bg-slate-800'
  }
];

// Unified Nav Item Component (Prevents Duplication)
interface NavItemProps {
  item: SubmoduleItemMeta;
  isActive: boolean;
  isCollapsed: boolean;
  isFa: boolean;
  onSelect: (key: string) => void;
}

const NavItem: React.FC<NavItemProps> = ({
  item,
  isActive,
  isCollapsed,
  isFa,
  onSelect
}) => {
  const IconComponent = item.icon;
  const title = isFa ? item.titleFa : item.titleEn;

  if (isCollapsed) {
    return (
      <div className="flex justify-center py-1">
        <button
          type="button"
          onClick={() => onSelect(item.key)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isActive
              ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500/40 shadow-xs'
              : `${item.iconBg} ${item.iconColor} hover:scale-105 hover:bg-slate-200 dark:hover:bg-slate-700`
          }`}
          title={`${title} - ${item.subtitleFa}`}
          aria-label={title}
        >
          <IconComponent className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Expanded View
  return (
    <button
      type="button"
      onClick={() => onSelect(item.key)}
      className={`hse-motion-tab w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs cursor-pointer group ${
        isActive
          ? 'bg-blue-50/95 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-black border border-blue-200/80 dark:border-blue-800/60 shadow-xs shadow-blue-500/5'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-blue-600 dark:hover:text-blue-400 border border-transparent'
      }`}
      title={`${title} - ${item.subtitleFa}`}
    >
      <div className="flex items-center gap-3 truncate">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105 ${
          isActive 
            ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 shadow-2xs' 
            : `${item.iconBg} ${item.iconColor} group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40`
        }`}>
          <IconComponent className="w-4 h-4" />
        </div>
        <div className="text-right truncate">
          <span className="truncate block leading-tight text-xs font-bold">{title}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block leading-tight font-normal mt-0.5">
            {item.subtitleFa}
          </span>
        </div>
      </div>
    </button>
  );
};

export default function HealthEnvModule({ language, currentUser }: Props) {
  const isFa = language === 'fa';
  const [activeSection, setActiveSectionState] = useState<string>('comprehensive-dashboard');

  const setActiveSection = (section: string) => {
    setActiveSectionState(section);
    void apiDb.userPreferences.set('health_env_active_section', section).catch(() => {});
  };

  // Sidebar Open State (Persisted in PostgreSQL user_preferences, default open on desktop only)
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      apiDb.userPreferences.get<string>('health_env_active_section').catch(() => null),
      apiDb.userPreferences.get<boolean>('health_env_sidebar_open').catch(() => null),
    ]).then(([sectionRes, sidebarRes]) => {
      if (!active) return;
      const savedSection = sectionRes?.value;
      const savedSidebar = sidebarRes?.value;
      if (typeof savedSection === 'string' && savedSection) {
        setActiveSectionState(savedSection);
      }
      if (typeof savedSidebar === 'boolean' && typeof window !== 'undefined' && window.innerWidth >= 1024) {
        setSidebarOpen(savedSidebar);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        void apiDb.userPreferences.set('health_env_sidebar_open', next).catch(() => {});
      }
      return next;
    });
  };

  // Submenu dynamic configurations
  const [subConfigs, setSubConfigs] = useState<HealthEnvSubItemConfig[]>(() => getMergedHealthEnvConfig());

  useEffect(() => {
    const handleUpdate = () => {
      setSubConfigs(getMergedHealthEnvConfig());
    };
    const handleDirectNavigate = (e: any) => {
      if (e.detail?.section) {
        setActiveSection(e.detail.section);
      }
    };

    window.addEventListener('health_env_config_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('hse-health-env-navigate', handleDirectNavigate);

    return () => {
      window.removeEventListener('health_env_config_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('hse-health-env-navigate', handleDirectNavigate);
    };
  }, []);

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Filter enabled submodules based on subConfigs
  const enabledKeys = useMemo(() => {
    const set = new Set<string>();
    subConfigs.forEach(item => {
      if (item.enabled !== false) set.add(item.key);
    });
    set.add('comprehensive-dashboard');
    return set;
  }, [subConfigs]);

  const activeCatalog = useMemo(() => {
    return SUBMODULE_CATALOG.filter(item => enabledKeys.has(item.key));
  }, [enabledKeys]);

  const rootItem = useMemo(() => activeCatalog.find(i => i.group === 'root'), [activeCatalog]);
  const healthItems = useMemo(() => activeCatalog.filter(i => i.group === 'health'), [activeCatalog]);
  const envItems = useMemo(() => activeCatalog.filter(i => i.group === 'env'), [activeCatalog]);

  const activeItemMeta = useMemo(
    () => activeCatalog.find(i => i.key === activeSection),
    [activeCatalog, activeSection]
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-7.5rem)] bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-200/80 dark:border-slate-800/80" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Mobile Sub-Header Bar */}
      <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-emerald-600 text-white rounded-lg shrink-0">
            <Leaf className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block leading-none">
              {isFa ? 'بهداشت و محیط‌زیست' : 'Health & Environment'}
            </span>
            <h2 className="font-black text-slate-800 dark:text-white text-xs truncate mt-0.5">
              {activeItemMeta ? (isFa ? activeItemMeta.titleFa : activeItemMeta.titleEn) : (isFa ? 'داشبورد جامع' : 'Dashboard')}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4" />
          <span>{isFa ? 'زیرماژول‌ها' : 'Sections'}</span>
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 animate-fade-in lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed lg:static inset-y-0 ${isFa ? 'right-0' : 'left-0'} z-40 lg:z-20 ${
          sidebarOpen
            ? 'translate-x-0 w-72 max-w-[85vw] lg:w-72 shadow-2xl lg:shadow-xs'
            : `${isFa ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'} w-72 lg:w-16 shadow-xs`
        } bg-white dark:bg-slate-800 border-l border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 shrink-0`}
      >
        {/* Module Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className={`flex items-center gap-3 overflow-hidden ${!sidebarOpen && 'lg:hidden'}`}>
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h2 className="font-black text-slate-800 dark:text-white text-sm truncate">
                {isFa ? 'بهداشت و محیط‌زیست' : 'Health & Environment'}
              </h2>
              <span className="text-[11px] text-slate-400 block truncate">
                {isFa ? 'سامانه پایش سلامت، طب کار و محیط‌زیست' : 'HSE Comprehensive Monitoring'}
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={toggleSidebar}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors mx-auto cursor-pointer"
            title={sidebarOpen ? (isFa ? 'بستن منو' : 'Collapse') : (isFa ? 'باز کردن منو' : 'Expand')}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {/* 1. General/Root Executive Dashboard */}
          {rootItem && (
            <NavItem
              item={rootItem}
              isActive={activeSection === rootItem.key}
              isCollapsed={!sidebarOpen}
              isFa={isFa}
              onSelect={handleNavigate}
            />
          )}

          {/* 2. Occupational Health Submodules */}
          {healthItems.length > 0 && (
            <>
              {sidebarOpen ? (
                <div className="pt-3 pb-1 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isFa ? `زیرمجموعه‌های بهداشت حرفه‌ای و طب کار (${healthItems.length} بخش)` : `${healthItems.length} Occupational Health Modules`}
                </div>
              ) : (
                <div className="my-1.5 flex justify-center">
                  <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
              )}
              {healthItems.map(item => (
                <NavItem
                  key={item.key}
                  item={item}
                  isActive={activeSection === item.key}
                  isCollapsed={!sidebarOpen}
                  isFa={isFa}
                  onSelect={handleNavigate}
                />
              ))}
            </>
          )}

          {/* 3. Environment Submodules */}
          {envItems.length > 0 && (
            <>
              {sidebarOpen ? (
                <div className="pt-3 pb-1 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {isFa ? `زیرمجموعه‌های مدیریت محیط‌زیست (${envItems.length} بخش)` : `${envItems.length} Environmental Modules`}
                </div>
              ) : (
                <div className="my-1.5 flex justify-center">
                  <div className="w-8 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
              )}
              {envItems.map(item => (
                <NavItem
                  key={item.key}
                  item={item}
                  isActive={activeSection === item.key}
                  isCollapsed={!sidebarOpen}
                  isFa={isFa}
                  onSelect={handleNavigate}
                />
              ))}
            </>
          )}
        </div>

        {/* Sidebar Footer */}
        {sidebarOpen ? (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{isFa ? 'مجموع زیرماژول‌های فعال:' : 'Total Submodules:'}</span>
            <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">
              {activeCatalog.length} {isFa ? 'بخش' : 'items'}
            </span>
          </div>
        ) : (
          <div className="p-2 border-t border-slate-200 dark:border-slate-700 flex justify-center text-[10px] text-slate-400 font-mono font-bold">
            {activeCatalog.length}
          </div>
        )}
      </aside>

      {/* Main Viewport Content */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-slate-50 dark:bg-slate-900 flex flex-col">
        <SubViewTransition viewKey={activeSection} isFa={isFa} className="flex-1 flex flex-col">
          {activeSection === 'comprehensive-dashboard' && (
            <ComprehensiveExecutiveDashboard language={language} onNavigate={handleNavigate} />
          )}

          {/* HEALTH SUB-MODULES */}
          {activeSection === 'clinic' && (
            <ClinicSubmoduleView language={language} currentUser={currentUser} />
          )}
          {activeSection === 'periodic-exams' && (
            <PeriodicMedicalExamsApp language={language} currentUser={currentUser} />
          )}
          {activeSection === 'non-periodic-exams' && (
            <NonPeriodicExams language={language} currentUser={currentUser} />
          )}
          {activeSection === 'nutrition' && (
            <NutritionSubmoduleView language={language} currentUser={currentUser} />
          )}
          {activeSection === 'health-env-checklists' && (
            <HealthEnvChecklistsView language={language} currentUser={currentUser} />
          )}

          {/* ENVIRONMENT SUB-MODULES */}
          {activeSection === 'env-dashboard' && (
            <EnvironmentDashboard language={language} onNavigate={handleNavigate} />
          )}
          {activeSection === 'env-monitoring' && (
            <EnvironmentalMonitoringView language={language} currentUser={currentUser} />
          )}
          {activeSection === 'waste-management' && (
            <WasteManagementView language={language} currentUser={currentUser} />
          )}
          {activeSection === 'wastewater' && (
            <WastewaterManagementView language={language} currentUser={currentUser} />
          )}
          {activeSection === 'air-water-soil' && (
            <AirWaterSoilMonitoringView language={language} />
          )}
          {activeSection === 'five-s' && (
            <FiveSModuleView language={language} currentUser={currentUser} />
          )}
          {activeSection === 'env-reports' && (
            <EnvironmentReports language={language} />
          )}
        </SubViewTransition>
      </main>
    </div>
  );
}
