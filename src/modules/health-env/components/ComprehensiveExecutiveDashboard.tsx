import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, Users, FileText, CheckCircle2, Clock, AlertTriangle, 
  XCircle, Wind, Droplets, Trash2, ShieldAlert, 
  TrendingUp, BarChart3, Filter, Calendar, Building2, Layers,
  ChevronLeft, ChevronRight, Eye, ShieldCheck, HeartPulse, ArrowUpRight, CheckSquare, Sparkles, MapPin
} from 'lucide-react';
import { healthEnvService } from '../services/healthEnvService';
import { fiveSService } from '../services/fiveSService';
import { getComplexPersonnelList } from '../../../utils/personnelHelper';

interface Props {
  language: 'fa' | 'en';
  onNavigate?: (sectionId: string) => void;
}

export default function ComprehensiveExecutiveDashboard({ language, onNavigate }: Props) {
  const isFa = language === 'fa';
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setDataVersion(v => v + 1);
    };
    window.addEventListener('hse_medical_data_updated', handleUpdate);
    window.addEventListener('hse_occ_health_data_updated', handleUpdate);
    window.addEventListener('hse_health_env_updated', handleUpdate);
    window.addEventListener('five_s_data_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('hse_medical_data_updated', handleUpdate);
      window.removeEventListener('hse_occ_health_data_updated', handleUpdate);
      window.removeEventListener('hse_health_env_updated', handleUpdate);
      window.removeEventListener('five_s_data_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);
  
  // Available Years dynamically detected from actual recorded data & personnel dossiers
  const availableYears = useMemo(() => {
    return healthEnvService.getAvailableExamYears();
  }, [dataVersion]);

  const latestYear = useMemo(() => {
    return healthEnvService.getLatestExamYear();
  }, [dataVersion]);

  // Filters State - auto initialized with latest registered data year
  const [selectedYear, setSelectedYear] = useState<number>(latestYear);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedSite, setSelectedSite] = useState<string>('all');

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [availableYears, latestYear]);

  // Memoized complex personnel list to prevent duplicate calls and freezing
  const complexPersonnel = useMemo(() => {
    return getComplexPersonnelList();
  }, [dataVersion]);

  // Dynamic Units and Workplaces from actual personnel and registered records
  const dynamicDepartments = useMemo(() => {
    const depts = new Set<string>();
    complexPersonnel.forEach(p => {
      const d = p.unit || p.department;
      if (d && d.trim()) depts.add(d.trim());
    });
    return Array.from(depts).sort();
  }, [complexPersonnel]);

  const envMonitoring = useMemo(() => {
    return healthEnvService.getAllEnvMonitoring();
  }, [dataVersion]);

  const dynamicSites = useMemo(() => {
    const sites = new Set<string>();
    complexPersonnel.forEach(p => {
      if (p.workplace && p.workplace.trim()) sites.add(p.workplace.trim());
    });
    // Also include sites from environmental monitoring
    envMonitoring.forEach(m => {
      if (m.site && m.site.trim()) sites.add(m.site.trim());
    });
    return Array.from(sites).sort();
  }, [complexPersonnel, envMonitoring]);

  const kpis = useMemo(() => {
    return healthEnvService.getUnifiedKpis(selectedYear);
  }, [selectedYear, dataVersion]);


  const airQuality = useMemo(() => {
    return healthEnvService.getAllAirQuality();
  }, [dataVersion]);

  const wastewater = useMemo(() => {
    return healthEnvService.getAllWastewater();
  }, [dataVersion]);

  const wasteRecords = useMemo(() => {
    return healthEnvService.getAllWasteRecords();
  }, [dataVersion]);

  const fiveSKpis = useMemo(() => {
    return fiveSService.getKPIs();
  }, [dataVersion]);

  // Latest wastewater parameter for the KPI card
  const latestWastewater = useMemo(() => {
    if (wastewater.length === 0) return null;
    const codRecord = wastewater.find(w => w.parameter.toLowerCase().includes('cod'));
    return codRecord || wastewater[0];
  }, [wastewater]);

  // Latest Air AQI
  const latestAir = useMemo(() => {
    if (airQuality.length === 0) return null;
    return airQuality[0];
  }, [airQuality]);

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-l from-slate-900 via-slate-800 to-emerald-950 p-6 rounded-3xl text-white shadow-md border border-slate-700">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <Activity className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">
                {isFa ? 'داشبورد جامع بهداشت و محیط‌زیست (HSE Executive)' : 'Executive Health & Environment Dashboard'}
              </h1>
              <p className="text-xs md:text-sm text-slate-300">
                {isFa 
                  ? 'مرکز پایش یکپارچه شاخص‌های کلیدی سلامت شغلی، معاینات پرسنل، کیفیت هوا، پساب و مدیریت پسماند'
                  : 'Integrated telemetry for occupational health, medical surveillance, emissions, wastewater & waste compliance.'}
              </p>
            </div>
          </div>
        </div>

        {/* Global Year & Fast Filter Bar */}
        <div className="flex items-center gap-2 bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/10 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>{isFa ? 'سال پایش و معاینات:' : 'Surveillance Year:'}</span>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-900/90 text-white font-mono font-bold px-3 py-1.5 rounded-xl border border-emerald-500/40 focus:border-emerald-400 outline-none cursor-pointer text-xs"
          >
            {availableYears.map((year) => (
              <option key={year} value={year} className="bg-slate-800 text-white">
                {isFa ? `سال ${year}` : `Year ${year}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 shrink-0">
          <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{isFa ? 'فیلترهای مدیریتی جامع:' : 'Global Filters:'}</span>
        </div>

        {/* Department / Unit Filter */}
        <div className="flex-1 min-w-[180px]">
          <select 
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">{isFa ? 'همه واحدهای سازمانی' : 'All Departments & Units'}</option>
            {dynamicDepartments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Site / Workplace Filter */}
        <div className="flex-1 min-w-[180px]">
          <select 
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-200 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="all">{isFa ? 'همه محل‌های خدمت (سایت‌ها)' : 'All Workplaces / Sites'}</option>
            {dynamicSites.map((site) => (
              <option key={site} value={site}>{site}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] font-bold">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{isFa ? 'وضعیت داده‌ها: برخط و متصل به پرونده‌ها' : 'Data Sync: Online & Live'}</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: OCCUPATIONAL HEALTH KPI CARDS */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm md:text-base font-black text-slate-800 dark:text-white">
              {isFa ? '۱. شاخص‌های بهداشت حرفه‌ای و معاینات طب کار' : '1. Occupational Health & Medical Surveillance'}
            </h2>
          </div>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('non-periodic-exams')}
              className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{isFa ? 'ورود به بخش معاینات غیر دوره‌ای' : 'Non-Periodic Exams Module'}</span>
              <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Total Personnel */}
          <div 
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-teal-400 transition-all cursor-default group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'کل پرسنل شاغل' : 'Total Personnel'}</span>
              <Users className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {kpis.totalPersonnelCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'پایگاه پرسنلی فعال' : 'Active Personnel Pool'}</div>
          </div>

          {/* Card 2: Health Records */}
          <div 
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-teal-400 transition-all cursor-default group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'پرونده‌های سلامت' : 'Health Records'}</span>
              <FileText className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
              {kpis.totalHealthRecordsCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {kpis.incompleteRecordsCount > 0 ? `${kpis.incompleteRecordsCount} ${isFa ? 'پرونده ناقص' : 'Incomplete'}` : (isFa ? '۱۰۰٪ تکمیل شده' : '100% Completed')}
            </div>
          </div>

          {/* Card 3: Completed Periodic Exams */}
          <div 
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all cursor-default group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? `معاینات سال ${selectedYear}` : `Exams (${selectedYear})`}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {kpis.completedExamsCount}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">
              {isFa ? `پوشش ${kpis.coveragePercentage}٪` : `${kpis.coveragePercentage}% Coverage`}
            </div>
          </div>

          {/* Card 4: Under Review / Specialist */}
          <div 
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-all cursor-default group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'نیاز به پیگیری و تخصص' : 'Follow-up / Specialist'}</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {kpis.underReviewCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'ارجاع به کمیسیون پزشکی' : 'Specialist Consults'}</div>
          </div>

          {/* Card 5: Overdue Periodic Exams */}
          <div 
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-rose-400 transition-all cursor-default group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'معاینات باقیمانده' : 'Pending Exams'}</span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {kpis.overdueExamsCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'نوبت‌دهی در جریان' : 'Scheduled Queue'}</div>
          </div>

          {/* Card 6: Non-Periodic Exams */}
          <div 
            onClick={() => onNavigate?.('non-periodic-exams')}
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-indigo-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'معاینات غیر دوره‌ای' : 'Non-Periodic Exams'}</span>
              <Activity className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
              {kpis.nonPeriodicExamsCount}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'بدو استخدام و بازگشت' : 'Pre-employment & RTW'}</div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: ENVIRONMENT & POLLUTANTS KPI CARDS */}
      {/* ======================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm md:text-base font-black text-slate-800 dark:text-white">
              {isFa ? '۲. شاخص‌های محیط‌زیست، پایش آلاینده‌ها و پسماند' : '2. Environmental Compliance, Waste & Emissions'}
            </h2>
          </div>
          {onNavigate && (
            <button 
              onClick={() => onNavigate('env-dashboard')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{isFa ? 'ورود به داشبورد محیط‌زیست' : 'Environment Dashboard'}</span>
              <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Monitoring Points */}
          <div 
            onClick={() => onNavigate?.('env-monitoring')}
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'پایش‌های محیطی' : 'Env Monitoring'}</span>
              <Activity className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {kpis.totalMonitoringCount}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">
              {isFa ? `نرخ انطباق: ${kpis.envComplianceRate}٪` : `Compliance: ${kpis.envComplianceRate}%`}
            </div>
          </div>

          {/* Card 2: Air Quality (AQI) */}
          <div 
            onClick={() => onNavigate?.('air-water-soil')}
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-teal-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'کیفیت هوای محیطی' : 'Air Quality (AQI)'}</span>
              <Wind className="w-4 h-4 text-teal-500" />
            </div>
            <div className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
              {latestAir ? latestAir.aqi : (isFa ? '—' : 'N/A')} <span className="text-xs font-sans text-slate-400">AQI</span>
            </div>
            <div className="text-[10px] text-teal-700 dark:text-teal-300 font-bold mt-1">
              {latestAir ? `${latestAir.aqiCategory}` : (isFa ? 'پایش دوره‌ای هوا' : 'Periodic Sampling')}
            </div>
          </div>

          {/* Card 3: Wastewater Compliance */}
          <div 
            onClick={() => onNavigate?.('wastewater')}
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'تصفیه پساب ETP' : 'Wastewater ETP'}</span>
              <Droplets className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
              {latestWastewater ? latestWastewater.measuredValue : (isFa ? '—' : 'N/A')} <span className="text-xs font-sans text-slate-400">{latestWastewater?.unit || 'mg/L'}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {latestWastewater ? `${latestWastewater.parameter} (حد: ${latestWastewater.standardLimit})` : (isFa ? 'کیفیت پساب خروجی' : 'Effluent Status')}
            </div>
          </div>

          {/* Card 4: Industrial Waste Total */}
          <div 
            onClick={() => onNavigate?.('waste-management')}
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'کل پسماند صنعتی' : 'Total Industrial Waste'}</span>
              <Trash2 className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {kpis.totalWasteQty} <span className="text-xs font-sans text-slate-400">{isFa ? 'تن' : 'Tons'}</span>
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">
              {isFa ? `بازیافت: ${kpis.wasteRecoveryRate}٪` : `Recovery: ${kpis.wasteRecoveryRate}%`}
            </div>
          </div>

          {/* Card 5: Hazardous Waste */}
          <div 
            onClick={() => onNavigate?.('waste-management')}
            className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-rose-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold">{isFa ? 'پسماند ویژه/خطرناک' : 'Hazardous Waste'}</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {kpis.hazardousWasteQty} <span className="text-xs font-sans text-slate-400">{isFa ? 'تن' : 'Tons'}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{isFa ? 'دارای مانیفست EMP' : 'EMP Manifests'}</div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5S Workplace Organization Quick Executive Highlight */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-l from-emerald-900/10 via-slate-800/10 to-teal-900/10 dark:from-emerald-950/40 dark:via-slate-800/60 dark:to-teal-950/40 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-xs text-slate-900 dark:text-white">
                {isFa ? 'ساماندهی محیط کار و ممیزی‌های نظام ۵S' : '5S Workplace Organization & Audits'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                {isFa ? `میانگین امتیاز: ${fiveSKpis.averageScore}٪` : `Avg Score: ${fiveSKpis.averageScore}%`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa 
                ? `${fiveSKpis.completedInspections} بازرسی نهایی‌شده | ${fiveSKpis.openNonConformances} عدم انطباق باز | ${fiveSKpis.scheduledInspections} ممیزی در نوبت برنامه`
                : `${fiveSKpis.completedInspections} Audits Done | ${fiveSKpis.openNonConformances} Open Deviations | ${fiveSKpis.scheduledInspections} Scheduled`}
            </p>
          </div>
        </div>

        {onNavigate && (
          <button
            onClick={() => onNavigate('five-s')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>{isFa ? 'ورود به بخش ساماندهی ۵S' : 'Go to 5S Module'}</span>
            <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: VISUAL COMPARISON & ACTIVE MONITORING PANELS */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Health Examination Fitness Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  {isFa ? `توزیع صلاحیت شغلی معاینات (سال ${selectedYear})` : `Occupational Fitness (${selectedYear})`}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-lg">
                {kpis.periodicExamsTotal} {isFa ? 'پرونده' : 'Records'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1 font-bold">
                  <span className="text-emerald-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {isFa ? 'مناسب کار بدون محدودیت (Fit)' : 'Fit without limitations'}
                  </span>
                  <span className="font-mono">{kpis.fitness.fit} {isFa ? 'نفر' : 'Persons'}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all" 
                    style={{ width: `${kpis.periodicExamsTotal ? (kpis.fitness.fit / kpis.periodicExamsTotal) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1 font-bold">
                  <span className="text-amber-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    {isFa ? 'مناسب با محدودیت پزشکی' : 'Fit with limitations'}
                  </span>
                  <span className="font-mono">{kpis.fitness.fitWithLimitations} {isFa ? 'نفر' : 'Persons'}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all" 
                    style={{ width: `${kpis.periodicExamsTotal ? (kpis.fitness.fitWithLimitations / kpis.periodicExamsTotal) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1 font-bold">
                  <span className="text-indigo-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    {isFa ? 'نیازمند ارزیابی تخصصی' : 'Specialist evaluation needed'}
                  </span>
                  <span className="font-mono">{kpis.fitness.needsSpecialist} {isFa ? 'نفر' : 'Persons'}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all" 
                    style={{ width: `${kpis.periodicExamsTotal ? (kpis.fitness.needsSpecialist / kpis.periodicExamsTotal) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1 font-bold">
                  <span className="text-rose-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    {isFa ? 'عدم صلاحیت شغلی (Unfit)' : 'Unfit for job'}
                  </span>
                  <span className="font-mono">{kpis.fitness.unfit} {isFa ? 'نفر' : 'Persons'}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-rose-500 h-full rounded-full transition-all" 
                    style={{ width: `${kpis.periodicExamsTotal ? (kpis.fitness.unfit / kpis.periodicExamsTotal) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-500">{isFa ? 'درصد سلامت و تناسب کامل:' : 'Full Fitness Rate:'}</span>
            <span className="font-bold text-emerald-600 font-mono">
              {kpis.periodicExamsTotal ? Math.round((kpis.fitness.fit / kpis.periodicExamsTotal) * 100) : 0}٪
            </span>
          </div>
        </div>

        {/* Center Column: Online Environmental Telemetry Feed */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  {isFa ? 'آخرین نتایج پایش‌های محیط‌زیستی' : 'Recent Environmental Telemetry'}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                {isFa ? 'پایش آنلاین' : 'Active Telemetry'}
              </span>
            </div>

            <div className="space-y-2.5">
              {envMonitoring.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Wind className="w-7 h-7 mx-auto mb-1.5 opacity-40 text-emerald-600" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{isFa ? 'هنوز رکوردی ثبت نشده است' : 'No records yet'}</p>
                </div>
              ) : (
                envMonitoring.slice(0, 4).map((rec, idx) => (
                  <div 
                    key={`${rec.id || 'rec'}-${idx}`}
                    className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="truncate w-full max-w-[180px]">
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{rec.parameter}</div>
                      <div className="text-[10px] text-slate-400 truncate">{rec.stationOrLocation} {rec.site ? `(${rec.site})` : ''}</div>
                    </div>
                    <div className="text-left shrink-0 font-mono">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {rec.measuredValue} <span className="text-[10px] text-slate-400 font-sans">{rec.unit}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${
                        rec.complianceStatus === 'compliant' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {rec.complianceStatus === 'compliant' ? (isFa ? '✓ مجاز' : '✓ Compliant') : (isFa ? '⚠️ فراتر از حد' : '⚠️ Exceeded')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
            <span className="text-slate-500">{isFa ? 'سامانه جامع پایش محیط‌زیست:' : 'Env Monitoring System:'}</span>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('env-monitoring')}
                className="font-bold text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{isFa ? 'مشاهده همه پایش‌ها' : 'View All'}</span>
                <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Industrial Waste & EMP */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                  {isFa ? 'آخرین سوابق پسماند و مانیفست EMP' : 'Recent Waste Records & EMP'}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg">
                {wasteRecords.length} {isFa ? 'رکورد' : 'Records'}
              </span>
            </div>

            <div className="space-y-2.5">
              {wasteRecords.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Trash2 className="w-7 h-7 mx-auto mb-1.5 opacity-40 text-amber-600" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{isFa ? 'هیچ رکوردی برای پسماند ثبت نشده است' : 'No waste records yet'}</p>
                </div>
              ) : (
                wasteRecords.slice(0, 3).map((w, idx) => (
                  <div 
                    key={`${w.id || 'w'}-${idx}`}
                    className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{w.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.category.includes('خطرناک') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {w.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 font-mono">
                      <span>{w.originLocation || w.department || 'واحد عملیاتی'}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {w.quantity} {w.unit}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
            {onNavigate && (
              <button 
                onClick={() => onNavigate('waste-management')}
                className="w-full text-center py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-all cursor-pointer"
              >
                {isFa ? 'مدیریت و پایش کامل پسماند (EMP)' : 'Manage Industrial Waste (EMP)'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 4: ALL MODULE ACTIVE SECTIONS QUICK ACCESS HUB */}
      {/* ======================================================== */}
      <div className="space-y-3 pt-2">
        <h3 className="font-black text-slate-800 dark:text-white text-xs md:text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          {isFa ? 'دسترسی مستقیم و سریع به زیربخش‌های فعال ماژول بهداشت و محیط‌زیست' : 'Direct Navigation to Health & Environment Sub-Modules'}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* 1. Non-Periodic Exams */}
          <div 
            onClick={() => onNavigate?.('non-periodic-exams')}
            className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-indigo-400 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'معاینات غیر دوره‌ای' : 'Non-Periodic Exams'}</h4>
                <p className="text-[10px] text-slate-400">{isFa ? 'بدو استخدام و بازگشت به کار' : 'Pre-employment & RTW'}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 rtl:rotate-0 ltr:rotate-180 transition-colors" />
          </div>

          {/* 3. Environmental Monitoring */}
          <div 
            onClick={() => onNavigate?.('env-monitoring')}
            className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'پایش‌های محیط‌زیستی' : 'Environmental Monitoring'}</h4>
                <p className="text-[10px] text-slate-400">{isFa ? 'سنجش‌های دوره‌ای و حد استاندارد' : 'Field measurements & limits'}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 rtl:rotate-0 ltr:rotate-180 transition-colors" />
          </div>

          {/* 4. Waste Management */}
          <div 
            onClick={() => onNavigate?.('waste-management')}
            className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl group-hover:scale-105 transition-transform">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'مدیریت پسماند و EMP' : 'Waste Management & EMP'}</h4>
                <p className="text-[10px] text-slate-400">{isFa ? 'تفکیک، مانیفست و امحاء ویژه' : 'Classification & Disposal'}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-600 rtl:rotate-0 ltr:rotate-180 transition-colors" />
          </div>

          {/* 5. Wastewater & ETP */}
          <div 
            onClick={() => onNavigate?.('wastewater')}
            className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'مدیریت پساب و ETP' : 'Wastewater Treatment'}</h4>
                <p className="text-[10px] text-slate-400">{isFa ? 'COD, BOD, TSS و پساب خروجی' : 'Effluent Quality & Standards'}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-blue-600 rtl:rotate-0 ltr:rotate-180 transition-colors" />
          </div>

          {/* 6. Air, Water, Soil & Stacks */}
          <div 
            onClick={() => onNavigate?.('air-water-soil')}
            className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-teal-400 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 dark:bg-teal-950/60 text-teal-600 rounded-xl group-hover:scale-105 transition-transform">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'پایش دودکش، آب و خاک' : 'Stacks, Water & Soil'}</h4>
                <p className="text-[10px] text-slate-400">{isFa ? 'کیفیت هوای محیط و خاک صنعتی' : 'Emissions, wells and soil'}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-teal-600 rtl:rotate-0 ltr:rotate-180 transition-colors" />
          </div>

          {/* 7. 5S Workplace */}
          <div 
            onClick={() => onNavigate?.('five-s')}
            className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
                <CheckSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'ساماندهی ۵S' : '5S System'}</h4>
                <p className="text-[10px] text-slate-400">{isFa ? 'ممیزی نظام آراستگی و رتبه‌بندی' : 'Workplace housekeeping audits'}</p>
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 rtl:rotate-0 ltr:rotate-180 transition-colors" />
          </div>

        </div>
      </div>
    </div>
  );
}
