import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, ShieldAlert, CheckCircle2, History, LayoutDashboard, 
  Menu, X, ChevronRight, Layers, Bell, ShieldCheck, LifeBuoy, Truck, ArrowUpRight, FileText
} from 'lucide-react';
import { useFireDeptData } from './hooks/useFireDeptData';
import FireDashboard from './components/FireDashboard';
import CategoryManager from './components/CategoryManager';
import VehicleManager from './vehicles/VehicleManager';
import FireDailyReportView from './daily-report/FireDailyReportView';
import { CategoryIcon, getCategoryMeta } from './config/categoryIcons';
import { getMergedFireDeptConfig, FireDeptSubItemConfig } from '../../config/modulesConfig';

interface Props {
  language: 'fa' | 'en';
}

export default function FireDeptModule({ language }: Props) {
  const isFa = language === 'fa';
  const { equipment, addEquipment, updateEquipment, deleteEquipment } = useFireDeptData();
  const [activeSection, setActiveSectionState] = useState<string>(() => {
    try {
      return sessionStorage.getItem('hse_fire_dept_active_section') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const setActiveSection = (section: string) => {
    setActiveSectionState(section);
    try {
      sessionStorage.setItem('hse_fire_dept_active_section', section);
      localStorage.setItem('hse_fire_dept_active_section', section);
    } catch {}
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dynamic Fire Dept configuration
  const [subConfigs, setSubConfigs] = useState<FireDeptSubItemConfig[]>(() => getMergedFireDeptConfig());

  useEffect(() => {
    const handleUpdate = () => {
      setSubConfigs(getMergedFireDeptConfig());
    };
    const handleDirectNavigate = (e: any) => {
      if (e.detail?.section) {
        setActiveSection(e.detail.section);
      }
    };

    window.addEventListener('fire_dept_config_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('hse-fire-dept-navigate', handleDirectNavigate);

    return () => {
      window.removeEventListener('fire_dept_config_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('hse-fire-dept-navigate', handleDirectNavigate);
    };
  }, []);

  const generalItems = subConfigs.filter(item => item.type === 'general' && item.enabled !== false);
  const categoryItems = subConfigs.filter(item => item.type === 'category' && item.enabled !== false);

  const handleSelectSection = (section: string) => {
    setActiveSection(section);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const activeSectionTitle = (() => {
    const gen = generalItems.find(i => i.key === activeSection);
    if (gen) return isFa ? gen.titleFa : (gen.titleEn || gen.titleFa);
    const cat = categoryItems.find(i => i.key === activeSection);
    if (cat) {
      const meta = getCategoryMeta(cat.key);
      return isFa ? (cat.titleFa || meta.titleFa) : (cat.titleEn || cat.key);
    }
    return isFa ? 'واحد آتش‌نشانی' : 'Fire Department';
  })();

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100dvh-7.5rem)] lg:h-[calc(100dvh-7.5rem)] bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden relative border border-slate-200/80 dark:border-slate-800/80" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Mobile Sub-Header Bar */}
      <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-red-600 text-white rounded-lg shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block leading-none">
              {isFa ? 'واحد آتش‌نشانی' : 'Fire Department'}
            </span>
            <h2 className="font-black text-slate-800 dark:text-white text-xs truncate mt-0.5">
              {activeSectionTitle}
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
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside 
        className={`fixed lg:static inset-y-0 ${isFa ? 'right-0' : 'left-0'} z-40 lg:z-20 ${
          sidebarOpen
            ? 'translate-x-0 w-72 max-w-[85vw] lg:w-72 shadow-2xl lg:shadow-none'
            : `${isFa ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0'} w-72 lg:w-16`
        } bg-white dark:bg-slate-800 border-l border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 shrink-0`}
      >
        {/* Module Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className={`flex items-center gap-3 overflow-hidden ${!sidebarOpen && 'lg:hidden'}`}>
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h2 className="font-black text-slate-800 dark:text-white text-sm truncate">
                {isFa ? 'واحد آتش‌نشانی' : 'Fire Department'}
              </h2>
              <span className="text-[11px] text-slate-400 block truncate">
                {isFa ? 'سامانه بازرسی و پایش تجهیزات و ناوگان' : 'Safety Equipment & Fleet Inspection'}
              </span>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors mx-auto cursor-pointer"
            title={sidebarOpen ? (isFa ? 'بستن منو' : 'Collapse') : (isFa ? 'باز کردن منو' : 'Expand')}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* General Navigation Items (e.g. Dashboard, Vehicles) */}
          {generalItems.map((item) => {
            const isActive = activeSection === item.key;
            const title = isFa ? item.titleFa : (item.titleEn || item.titleFa);
            const isDashboard = item.key === 'dashboard';
            const isDailyReport = item.key === 'daily-report';
            const isVehicles = item.key === 'vehicles';

            return (
              <button
                key={item.key}
                onClick={() => handleSelectSection(item.key)}
                className={`w-full flex items-center ${
                  sidebarOpen ? 'gap-3 px-3 py-2.5 justify-between' : 'justify-center py-2 px-0'
                } rounded-xl font-bold text-xs transition-all duration-200 ease-in-out cursor-pointer group relative ${
                  isActive
                    ? 'bg-blue-50/95 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-black border border-blue-200/80 dark:border-blue-800/60 shadow-xs shadow-blue-500/5'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-blue-600 dark:hover:text-blue-400 border border-transparent'
                }`}
                title={title}
              >
                {/* Right-side Indicator for active */}
                {isActive && (
                  <span 
                    className={`absolute ${isFa ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'} top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-500 shadow-sm shadow-blue-500/50 transition-all duration-200`} 
                    aria-hidden="true"
                  />
                )}

                <div className={`flex items-center gap-3 truncate ${!sidebarOpen ? 'justify-center w-full' : ''}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 shadow-2xs' 
                      : 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40'
                  }`}>
                    {isDashboard && <LayoutDashboard className="w-4 h-4" />}
                    {isDailyReport && <FileText className="w-4 h-4" />}
                    {isVehicles && <Truck className="w-4 h-4" />}
                    {!isDashboard && !isDailyReport && !isVehicles && <Layers className="w-4 h-4" />}
                  </div>
                  {sidebarOpen && <span className="truncate">{title}</span>}
                </div>
              </button>
            );
          })}

          {sidebarOpen && categoryItems.length > 0 && (
            <div className="pt-3 pb-1 px-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {isFa ? `زیرمجموعه‌های بازرسی (${categoryItems.length} فرم)` : `${categoryItems.length} Inspection Sub-modules`}
            </div>
          )}

          {categoryItems.map((catItem) => {
            const cat = catItem.key;
            const count = equipment.filter(e => e.category === cat).length;
            const openDefects = equipment
              .filter(e => e.category === cat)
              .reduce((acc, it) => acc + it.defects.filter(d => d.status === 'باز').length, 0);

            const isActive = activeSection === cat;
            const meta = getCategoryMeta(cat);
            const title = isFa ? (catItem.titleFa || meta.titleFa) : (catItem.titleEn || cat);

            return (
              <button
                key={cat}
                onClick={() => handleSelectSection(cat)}
                className={`w-full flex items-center justify-between ${
                  sidebarOpen ? 'px-2.5 py-2' : 'px-0 py-2 justify-center'
                } rounded-xl text-xs font-bold transition-all duration-200 ease-in-out cursor-pointer group relative ${
                  isActive
                    ? 'bg-blue-50/95 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-black border border-blue-200/80 dark:border-blue-800/60 shadow-xs shadow-blue-500/5'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-blue-600 dark:hover:text-blue-400 border border-transparent'
                }`}
                title={title}
              >
                {/* Right-side Indicator for active */}
                {isActive && (
                  <span 
                    className={`absolute ${isFa ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'} top-1.5 bottom-1.5 w-1 bg-blue-600 dark:bg-blue-500 shadow-sm shadow-blue-500/50 transition-all duration-200`} 
                    aria-hidden="true"
                  />
                )}

                <div className={`flex items-center gap-2.5 overflow-hidden ${!sidebarOpen ? 'justify-center w-full relative' : ''}`}>
                  <div className="relative">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isActive 
                        ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 shadow-2xs' 
                        : 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40'
                    }`}>
                      <CategoryIcon category={cat} className="w-4 h-4" />
                    </span>
                    {!sidebarOpen && openDefects > 0 && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-800" />
                    )}
                  </div>
                  {sidebarOpen && (
                    <span className="truncate text-right text-[11px] leading-tight">{title}</span>
                  )}
                </div>

                {sidebarOpen && (
                  <div className="flex items-center gap-1 shrink-0 mr-1">
                    {openDefects > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white shadow-xs">
                        {openDefects}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer info in sidebar */}
        {sidebarOpen && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{isFa ? 'مجموع تجهیزات ثابت:' : 'Total Fixed Items:'}</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{equipment.length}</span>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {activeSection === 'dashboard' ? (
          <FireDashboard 
            language={language} 
            equipment={equipment} 
            onSelectCategory={(cat) => setActiveSection(cat)} 
            onSelectVehicles={() => setActiveSection('vehicles')}
            onSelectDailyReport={() => setActiveSection('daily-report')}
          />
        ) : activeSection === 'daily-report' ? (
          <div className="overflow-y-auto h-full w-full bg-slate-50 dark:bg-slate-900">
            <FireDailyReportView language={language} />
          </div>
        ) : activeSection === 'vehicles' ? (
          <div className="p-4 md:p-6 overflow-y-auto h-full bg-slate-50 dark:bg-slate-900">
            <VehicleManager language={language} />
          </div>
        ) : (
          <CategoryManager 
            language={language}
            category={activeSection}
            data={equipment.filter(e => e.category === activeSection)}
            allEquipment={equipment}
            onAdd={addEquipment}
            onUpdate={updateEquipment}
            onDelete={deleteEquipment}
            onNavigateCategory={(targetCat) => setActiveSection(targetCat)}
          />
        )}
      </main>
    </div>
  );
}
