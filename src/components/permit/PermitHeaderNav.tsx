import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Flame, 
  Snowflake, 
  Shovel, 
  GitCommit, 
  Box, 
  Zap, 
  Radiation, 
  Truck, 
  ChevronDown, 
  Check, 
  FileText,
  Sliders
} from 'lucide-react';
import { PermitCategory, WorkPermit } from '../../types';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

interface PermitHeaderNavProps {
  activeTab: PermitCategory | 'dashboard';
  onSelectTab: (tab: PermitCategory | 'dashboard') => void;
  isFa: boolean;
  activePermitsCount: number;
  permits?: WorkPermit[];
  onOpenFieldManager?: () => void;
}

export const PermitHeaderNav: React.FC<PermitHeaderNavProps> = ({
  activeTab,
  onSelectTab,
  isFa,
  activePermitsCount,
  permits = [],
  onOpenFieldManager
}) => {
  // Custom dropdown open states
  const [isMainDropdownOpen, setIsMainDropdownOpen] = useState(false);
  const [isSuppDropdownOpen, setIsSuppDropdownOpen] = useState(false);

  const mainDropdownRef = useRef<HTMLDivElement>(null);
  const suppDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useOnClickOutside(mainDropdownRef, () => setIsMainDropdownOpen(false), isMainDropdownOpen);
  useOnClickOutside(suppDropdownRef, () => setIsSuppDropdownOpen(false), isSuppDropdownOpen);

  // Helper to count active permits by category
  const getCategoryActiveCount = (catId: PermitCategory) => {
    return permits.filter(p => {
      const isActive = p.status === 'Active' || p.status === 'Issued';
      if (!isActive) return false;
      if (p.permitCategory === catId) return true;
      if (catId === 'Hot' && p.permitType === 'Hot') return true;
      if (catId === 'Cold' && p.permitType === 'Cold') return true;
      if (p.attachedPermits) {
        if (catId === 'ConfinedSpace' && p.attachedPermits.confinedSpace) return true;
        if (catId === 'Excavation' && p.attachedPermits.excavation) return true;
        if (catId === 'ElectricalIsolation' && p.attachedPermits.electrical) return true;
        if (catId === 'ProcessMechanical' && p.attachedPermits.processIsolation) return true;
        if (catId === 'Radiation' && p.attachedPermits.radiation) return true;
        if (catId === 'VehicleCrane' && p.attachedPermits.vehicleCrane) return true;
      }
      return false;
    }).length;
  };

  // Main permits (Hot, Cold)
  const mainPermits = [
    {
      id: 'Hot' as PermitCategory,
      code: 'HWP',
      titleFa: 'پروانه کار گرم (Hot Work)',
      titleEn: 'Hot Work Permit',
      tagFa: 'کارهای جرقه‌زا، جوشکاری، برشکاری و شعله‌دار',
      tagEn: 'Spark & Open Flame',
      descriptionFa: 'عملیات جوشکاری، برشکاری، سنگ‌زنی و کلیه کارهای حرارت‌زا در مجاورت خطوط و تجهیزات کارگاهی',
      icon: Flame,
      gradient: 'from-amber-500 to-rose-600'
    },
    {
      id: 'Cold' as PermitCategory,
      code: 'CWP',
      titleFa: 'پروانه کار سرد (Cold Work)',
      titleEn: 'Cold Work Permit',
      tagFa: 'تعمیرات مکانیکی، لوله‌کشی، نقاشی و عمومی',
      tagEn: 'Non-Sparking Maintenance',
      descriptionFa: 'عملیات مکانیکی بدون شعله، پایپینگ، نقاشی، داربست‌بندی، نصب سازه و تعمیرات عمومی',
      icon: Snowflake,
      gradient: 'from-sky-500 to-blue-600'
    }
  ];

  // Supplementary permits (6 items)
  const supplementaryPermits = [
    {
      id: 'ConfinedSpace' as PermitCategory,
      code: 'CSE',
      titleFa: 'ورود به فضای بسته (Confined Space)',
      titleEn: 'Confined Space Entry',
      tagFa: 'مخازن، برج‌ها، کانال‌ها و تست مستمر گاز',
      tagEn: 'Tanks, Confined Vessels & Gas Testing',
      descriptionFa: 'ورود به مخازن، برج‌ها، کانال‌ها، منهول‌ها و فضاهای محبوس با تهویه محدود',
      icon: Box,
      gradient: 'from-teal-500 to-emerald-600'
    },
    {
      id: 'ProcessMechanical' as PermitCategory,
      code: 'LOTO',
      titleFa: 'جداسازی فرآیندی / مکانیکی (LOTO Isolation)',
      titleEn: 'Process & Mechanical Isolation',
      tagFa: 'مسدودسازی، نصب بلانک و اسپید، قفل‌گذاری مکانیکی',
      tagEn: 'Line Blinding, Spading & Mechanical Lockout',
      descriptionFa: 'نصب انسداد (بلانک/اسپید)، بی‌فشارسازی، تخلیه با نیتروژن و LOTO مکانیکی خطوط',
      icon: GitCommit,
      gradient: 'from-purple-500 to-indigo-600'
    },
    {
      id: 'Excavation' as PermitCategory,
      code: 'EXC',
      titleFa: 'حفاری و گودبرداری (Excavation)',
      titleEn: 'Excavation & Trenching',
      tagFa: 'کابل‌یابی، استعلام تاسیسات زیرزمینی و شیب ترانشه',
      tagEn: 'Underground Cables, Trenching & Digging',
      descriptionFa: 'حفاری، کانال‌کنی و خاکبرداری زمین با بررسی تاسیسات زیرزمینی و کابل‌یابی ایمن',
      icon: Shovel,
      gradient: 'from-blue-600 to-indigo-800'
    },
    {
      id: 'ElectricalIsolation' as PermitCategory,
      code: 'ELEC',
      titleFa: 'جداسازی و قطع الکتریکی (Electrical Isolation)',
      titleEn: 'Electrical Isolation Certificate',
      tagFa: 'تست ولتاژ صفر، قطع کلید، فیوزکشی و ارت موقت',
      tagEn: 'Zero Voltage Test, Fuse Removal & Earthing',
      descriptionFa: 'ایزولاسیون برق پست‌ها، قطع کلیدها، کشیدن فیوز، تست ولتاژ صفر و اتصال زمین',
      icon: Zap,
      gradient: 'from-yellow-500 to-amber-600'
    },
    {
      id: 'Radiation' as PermitCategory,
      code: 'NDT',
      titleFa: 'منابع پرتوزا و رادیوگرافی (Radiation / NDT)',
      titleEn: 'Radiation Source Certificate',
      tagFa: 'پرتونگاری صنعتی، اشعه گاما/ایکس و حریم ایمن',
      tagEn: 'Industrial NDT, Gamma/X-Ray Radiation',
      descriptionFa: 'پرتونگاری صنعتی، بازرسی با اشعه گاما/ایکس و حریم‌بندی حفاظت در برابر اشعه',
      icon: Radiation,
      gradient: 'from-rose-500 to-pink-600'
    },
    {
      id: 'VehicleCrane' as PermitCategory,
      code: 'CRN',
      titleFa: 'ورود جرثقیل و خودرو (Crane & Vehicle)',
      titleEn: 'Crane & Vehicle Entry Certificate',
      tagFa: 'جرثقیل، لیفتراک، جک‌های اتکا و اگزوز خفه‌کن',
      tagEn: 'Cranes, Heavy Vehicles & Spark Arrestor',
      descriptionFa: 'ورود جرثقیل‌های سنگین، لیفتراک، خودروهای کارگاهی و بررسی اگزوز و جک‌های اتکا',
      icon: Truck,
      gradient: 'from-cyan-500 to-blue-600'
    }
  ];

  // Current active permit info if editing/issuing
  const currentActivePermit = [...mainPermits, ...supplementaryPermits].find(p => p.id === activeTab);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl p-5 md:p-6 shadow-2xl border border-slate-800/90 space-y-5">
      
      {/* 1. Header Banner & Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/90 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                {isFa ? 'سامانه جامع مدیریت و صدور پروانه کار (PTW)' : 'Permit To Work (PTW) System'}
              </h2>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Safety First
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
              {isFa 
                ? 'مدیریت یکپارچه پروانه‌های کار اصلی (گرم و سرد)، مجوزهای الحاقی اختصاصی و بازرسی‌های ایمنی سایت' 
                : 'Integrated framework for primary permits, supplementary certificates & on-site safety compliance'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Active permits counter badge */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{isFa ? `${activePermitsCount} پروانه کار فعال در کارگاه` : `${activePermitsCount} Active Permits On Site`}</span>
          </div>

          {/* Quick switch back to dashboard if on a form */}
          {activeTab !== 'dashboard' && (
            <button
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{isFa ? 'بازگشت به داشبورد پروانه‌ها' : 'Back to Dashboard'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top-level Segmented Control: Dashboard vs Quick Shortcuts */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950/60 p-2 rounded-2xl border border-slate-800">
        
        {/* Left/Right Main Tab Switches */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          
          {/* Dashboard Button */}
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/20 scale-[1.01]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{isFa ? 'داشبورد و وضعیت پروانه‌های فعال' : 'Active Permit Dashboard'}</span>
            {activePermitsCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'dashboard' ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
              }`}>
                {activePermitsCount}
              </span>
            )}
          </button>

          {/* Section Divider */}
          <div className="hidden md:flex items-center gap-2 px-2 text-slate-600 text-xs">
            <span>|</span>
            <span className="font-semibold text-[11px] text-slate-400">
              {isFa ? 'صدور سریع:' : 'Quick Issue:'}
            </span>
          </div>

          {/* Quick Hot Work shortcut */}
          <button
            onClick={() => onSelectTab('Hot')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'Hot'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/40'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{isFa ? 'پروانه گرم' : 'Hot Work'}</span>
          </button>

          {/* Quick Cold Work shortcut */}
          <button
            onClick={() => onSelectTab('Cold')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'Cold'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-sky-400 hover:bg-slate-800/40'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5 text-sky-400" />
            <span>{isFa ? 'پروانه سرد' : 'Cold Work'}</span>
          </button>

          {/* Field Configuration Manager button */}
          {onOpenFieldManager && (
            <button
              onClick={onOpenFieldManager}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shadow-sm mr-auto"
              title="مدیریت و شخصی‌سازی فیلدهای پروانه کار (گرم و سرد)"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>{isFa ? 'پیکربندی فیلدها' : 'Form Fields'}</span>
            </button>
          )}

        </div>

      </div>

      {/* 3. Active Permit Banner (Displayed if currently issuing a specific permit) */}
      {currentActivePermit && (
        <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 p-4 rounded-2xl border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${currentActivePermit.gradient} text-white shadow-md`}>
              <currentActivePermit.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-300 font-medium">{isFa ? 'فرم فعال صدور:' : 'Active Permit Form:'}</span>
                <span className="text-sm font-black text-white">{isFa ? currentActivePermit.titleFa : currentActivePermit.titleEn}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                  {currentActivePermit.code}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{isFa ? currentActivePermit.descriptionFa : ''}</p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('dashboard')}
            className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors shrink-0 cursor-pointer"
          >
            {isFa ? 'انصراف و بازگشت به داشبورد' : 'Cancel & Return to Dashboard'}
          </button>
        </div>
      )}

      {/* 4. Beautiful Modern Dropdown Selectors for Primary & Supplementary Permits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80">
        
        {/* Main Permits Dropdown */}
        <div className="space-y-2 relative" ref={mainDropdownRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>{isFa ? '۱. پروانه‌های کار اصلی (گرم و سرد)' : '1. Primary Work Permits'}</span>
            </label>
            <span className="text-[11px] text-slate-400 font-medium">{isFa ? '۲ نوع مجوز پایه' : '2 core permits'}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsMainDropdownOpen(!isMainDropdownOpen);
              setIsSuppDropdownOpen(false);
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 text-slate-100 rounded-xl p-3.5 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            <div className="flex items-center gap-3">
              {mainPermits.find(p => p.id === activeTab) ? (
                <>
                  <div className={`p-2 rounded-lg bg-gradient-to-tr ${mainPermits.find(p => p.id === activeTab)?.gradient} text-white shadow-xs`}>
                    {React.createElement(mainPermits.find(p => p.id === activeTab)!.icon, { className: 'w-4 h-4' })}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block">
                      {isFa ? mainPermits.find(p => p.id === activeTab)?.titleFa : mainPermits.find(p => p.id === activeTab)?.titleEn}
                    </span>
                    <span className="text-[11px] text-amber-300 font-medium">
                      {isFa ? mainPermits.find(p => p.id === activeTab)?.tagFa : ''}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-slate-300 text-sm font-medium">
                  {isFa ? '-- انتخاب پروانه کار اصلی جهت صدور --' : '-- Select Primary Permit --'}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isMainDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Custom Dropdown Menu: Main Permits */}
          {isMainDropdownOpen && (
            <div className="absolute top-full right-0 left-0 mt-2 bg-slate-900 border-2 border-slate-700/90 rounded-2xl shadow-2xl shadow-black/90 p-2 z-50 space-y-2">
              {mainPermits.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                const activeCount = getCategoryActiveCount(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onSelectTab(tab.id);
                      setIsMainDropdownOpen(false);
                    }}
                    className={`w-full p-3.5 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-amber-950/50 border-2 border-amber-500/70 text-white shadow-md' 
                        : 'bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/40 text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${tab.gradient} text-white shadow-md shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-white leading-tight">
                          {isFa ? tab.titleFa : tab.titleEn}
                        </div>
                        <div className="text-xs text-slate-300 font-normal mt-1 leading-relaxed">
                          {isFa ? tab.tagFa : tab.tagEn}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {activeCount > 0 && (
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-xs">
                          {activeCount} {isFa ? 'فعال' : 'active'}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Supplementary Permits Dropdown */}
        <div className="space-y-2 relative" ref={suppDropdownRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-sky-400 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <span>{isFa ? '۲. صدور پروانه کار الحاقی / گواهی‌های اختصاصی' : '2. Supplementary Permits'}</span>
            </label>
            <span className="text-[11px] text-slate-400 font-medium">{isFa ? '۶ مجوز تخصصی' : '6 certificates'}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsSuppDropdownOpen(!isSuppDropdownOpen);
              setIsMainDropdownOpen(false);
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-sky-500/50 text-slate-100 rounded-xl p-3.5 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          >
            <div className="flex items-center gap-3">
              {supplementaryPermits.find(p => p.id === activeTab) ? (
                <>
                  <div className={`p-2 rounded-lg bg-gradient-to-tr ${supplementaryPermits.find(p => p.id === activeTab)?.gradient} text-white shadow-xs`}>
                    {React.createElement(supplementaryPermits.find(p => p.id === activeTab)!.icon, { className: 'w-4 h-4' })}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block">
                      {isFa ? supplementaryPermits.find(p => p.id === activeTab)?.titleFa : supplementaryPermits.find(p => p.id === activeTab)?.titleEn}
                    </span>
                    <span className="text-[11px] text-sky-300 font-medium">
                      {isFa ? supplementaryPermits.find(p => p.id === activeTab)?.tagFa : ''}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-slate-300 text-sm font-medium">
                  {isFa ? '-- انتخاب پروانه کار الحاقی جهت صدور --' : '-- Select Supplementary Permit --'}
                </span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${isSuppDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Custom Dropdown Menu: Supplementary Permits */}
          {isSuppDropdownOpen && (
            <div className="absolute top-full right-0 left-0 mt-2 bg-slate-900 border-2 border-slate-700/90 rounded-2xl shadow-2xl shadow-black/90 p-2 z-50 space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {supplementaryPermits.map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                const activeCount = getCategoryActiveCount(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onSelectTab(tab.id);
                      setIsSuppDropdownOpen(false);
                    }}
                    className={`w-full p-3 rounded-xl flex items-center justify-between text-right transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-sky-950/50 border-2 border-sky-500/70 text-white shadow-md' 
                        : 'bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/40 text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${tab.gradient} text-white shadow-md shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-white leading-tight">
                          {isFa ? tab.titleFa : tab.titleEn}
                        </div>
                        <div className="text-xs text-slate-300 font-normal mt-1 leading-relaxed">
                          {isFa ? tab.tagFa : (tab.tagEn || '')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {activeCount > 0 && (
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-xs">
                          {activeCount} {isFa ? 'فعال' : 'active'}
                        </span>
                      )}
                      {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
