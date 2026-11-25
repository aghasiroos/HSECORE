import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wind, Droplets, Trash2, ShieldAlert, Activity, 
  CheckCircle2, AlertTriangle, TrendingUp, Gauge, 
  BarChart3, RefreshCw, Layers, ChevronLeft, MapPin, CheckSquare, Sparkles, FileText
} from 'lucide-react';
import { healthEnvService } from '../services/healthEnvService';
import { fiveSService } from '../services/fiveSService';

interface Props {
  language: 'fa' | 'en';
  onNavigate?: (sectionId: string) => void;
}

export default function EnvironmentDashboard({ language, onNavigate }: Props) {
  const isFa = language === 'fa';
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setDataVersion(v => v + 1);
    };
    window.addEventListener('hse_health_env_updated', handleUpdate);
    window.addEventListener('five_s_data_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('hse_health_env_updated', handleUpdate);
      window.removeEventListener('five_s_data_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);
  
  const availableYears = useMemo(() => {
    return healthEnvService.getAvailableMonitoringYears();
  }, [dataVersion]);

  const latestYear = useMemo(() => {
    return healthEnvService.getLatestMonitoringYear();
  }, [dataVersion]);

  const [selectedYear, setSelectedYear] = useState<number>(latestYear);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [availableYears, latestYear]);

  const kpis = useMemo(() => {
    return healthEnvService.getUnifiedKpis(undefined, selectedYear);
  }, [selectedYear, dataVersion]);

  const fiveSKpis = useMemo(() => {
    return fiveSService.getKPIs();
  }, [dataVersion]);

  const airQuality = useMemo(() => {
    return healthEnvService.getAllAirQuality();
  }, [dataVersion]);

  const envMonitoring = useMemo(() => {
    return healthEnvService.getAllEnvMonitoring();
  }, [dataVersion]);

  const wastewater = useMemo(() => {
    return healthEnvService.getAllWastewater();
  }, [dataVersion]);

  const wasteRecords = useMemo(() => {
    return healthEnvService.getAllWasteRecords();
  }, [dataVersion]);

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm shrink-0">
            <Wind className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-snug">
              {isFa ? 'داشبورد تخصصی مدیریت و پایش محیط‌زیست' : 'Environmental Management & Monitoring Dashboard'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              {isFa ? 'پایش آنلاین انتشار آلاینده‌ها، سامانه جامع پسماند (EMP)، پساب و انطباق با استانداردهای ملی' : 'Emissions telemetry, hazardous waste manifests, wastewater and regulatory compliance.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 max-w-full">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">{isFa ? 'سال پایش:' : 'Monitoring Year:'}</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:border-emerald-500 outline-none cursor-pointer text-xs"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {isFa ? `سال ${year}` : `Year ${year}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span>{isFa ? 'سامانه پایش برخط (CEMS): متصل' : 'Online Telemetry: Connected'}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3.5">
        <div 
          onClick={() => onNavigate?.('env-monitoring')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-bold text-slate-400 block mb-1">{isFa ? 'کل پایش‌های محیطی' : 'Total Monitoring'}</span>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">{kpis.totalMonitoringCount}</div>
          <span className="text-[10px] text-slate-500 mt-1 block">{isFa ? 'ایستگاه‌های پایش' : 'Monitoring points'}</span>
        </div>

        <div 
          onClick={() => onNavigate?.('env-monitoring')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-bold text-slate-400 block mb-1">{isFa ? 'نرخ انطباق استاندارد' : 'Compliance Rate'}</span>
          <div className="text-2xl font-black font-mono text-emerald-600">{kpis.envComplianceRate}٪</div>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">{kpis.compliantMonitoringCount} {isFa ? 'پایش کاملاً منطبق' : 'Compliant'}</span>
        </div>

        <div 
          onClick={() => onNavigate?.('air-water-soil')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-teal-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-bold text-slate-400 block mb-1">{isFa ? 'شاخص کیفیت هوا (AQI)' : 'Air Quality (AQI)'}</span>
          <div className="text-2xl font-black font-mono text-teal-600">{airQuality.length > 0 ? airQuality[0].aqi : '—'}</div>
          <span className="text-[10px] text-slate-500 font-bold mt-1 block">
            {airQuality.length > 0 ? `${airQuality[0].aqiCategory}` : (isFa ? 'پایش دوره‌ای هوا' : 'Periodic sampling')}
          </span>
        </div>

        <div 
          onClick={() => onNavigate?.('waste-management')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-bold text-slate-400 block mb-1">{isFa ? 'کل پسماند صنعتی' : 'Industrial Waste'}</span>
          <div className="text-2xl font-black font-mono text-amber-600">{kpis.totalWasteQty} <span className="text-xs text-slate-400">{isFa ? 'تن' : 'Ton'}</span></div>
          <span className="text-[10px] text-amber-600 font-bold mt-1 block">{isFa ? `نرخ بازیافت ${kpis.wasteRecoveryRate}٪` : `Recovery ${kpis.wasteRecoveryRate}%`}</span>
        </div>

        <div 
          onClick={() => onNavigate?.('waste-management')}
          className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-rose-400 transition-all cursor-pointer"
        >
          <span className="text-[11px] font-bold text-slate-400 block mb-1">{isFa ? 'پسماند ویژه و خطرناک' : 'Hazardous Waste'}</span>
          <div className="text-2xl font-black font-mono text-rose-600">{kpis.hazardousWasteQty} <span className="text-xs text-slate-400">{isFa ? 'تن' : 'Ton'}</span></div>
          <span className="text-[10px] text-slate-500 mt-1 block">{isFa ? 'دارای مانیفست EMP' : 'EMP Manifests'}</span>
        </div>
      </div>

      {/* Multi-Section Live Monitoring Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Air Quality Stations */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
              <Wind className="w-4 h-4 text-emerald-600" />
              {isFa ? 'ایستگاه‌های پایش کیفیت هوای محیطی و فلرینگ' : 'Ambient Air & Flare Monitoring'}
            </h3>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('air-water-soil')}
                className="text-xs text-emerald-600 font-bold hover:underline cursor-pointer"
              >
                {isFa ? 'مشاهده تفصیلی' : 'View Detailed'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {airQuality.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Wind className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-600" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{isFa ? 'هیچ داده‌ای برای پایش هوا و فلرینگ ثبت نشده است' : 'No air quality records'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{isFa ? 'جهت ثبت اولین پایش از بخش پایش‌های محیطی اقدام کنید' : 'Use environmental monitoring to add data'}</p>
              </div>
            ) : (
              airQuality.map((air) => (
                <div key={air.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-xs space-y-2">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-800 dark:text-slate-200">{air.stationName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      air.aqiCategory === 'پاک' || air.aqiCategory === 'سالم' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {air.aqiCategory} (AQI: {air.aqi})
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    <div>PM2.5: <strong className="text-slate-900 dark:text-white">{air.pm25}</strong></div>
                    <div>SO2: <strong className="text-slate-900 dark:text-white">{air.so2}</strong></div>
                    <div>NO2: <strong className="text-slate-900 dark:text-white">{air.no2}</strong></div>
                    <div>VOC: <strong className="text-slate-900 dark:text-white">{air.voc}</strong></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Wastewater Quality (ETP) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-600" />
              {isFa ? 'کیفیت پساب صنعتی تصفیه‌خانه (ETP)' : 'ETP Wastewater Quality & Outfall'}
            </h3>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('wastewater')}
                className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                {isFa ? 'مشاهده تفصیلی' : 'View Detailed'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {wastewater.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                <Droplets className="w-8 h-8 mx-auto mb-2 opacity-40 text-blue-600" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{isFa ? 'هیچ داده‌ای برای پساب و خروجی تصفیه‌خانه ثبت نشده است' : 'No wastewater records'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{isFa ? 'جهت ثبت نتایج آزمایشگاهی از بخش مدیریت پساب اقدام کنید' : 'Use wastewater section to add test results'}</p>
              </div>
            ) : (
              wastewater.slice(0, 3).map((ww) => (
                <div key={ww.id} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{ww.parameter}</div>
                    <div className="text-[10px] text-slate-400">{ww.samplingPoint} | {isFa ? 'مقصد:' : 'Dest:'} {ww.dischargeDestination}</div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {ww.measuredValue} <span className="text-[10px] text-slate-400 font-sans">{ww.unit}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${
                      ww.complianceStatus === 'compliant' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {ww.complianceStatus === 'compliant' ? `${isFa ? '✓ مجاز (حد: ' : '✓ Compliant (Limit: '}${ww.standardLimit})` : (isFa ? '⚠️ غیرمجاز' : '⚠️ Non-compliant')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5S Status Quick Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-xs text-slate-900 dark:text-white">
                {isFa ? 'ساماندهی محیط کار و ممیزی 5S' : '5S Workplace Housekeeping & Audits'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                {isFa ? `میانگین امتیاز: ${fiveSKpis.averageScore}٪` : `Avg Score: ${fiveSKpis.averageScore}%`}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa 
                ? `${fiveSKpis.completedInspections} بازرسی انجام‌شده | ${fiveSKpis.openNonConformances} عدم انطباق باز | ${fiveSKpis.openCorrectiveActions} اقدام اصلاحی فعال`
                : `${fiveSKpis.completedInspections} Audits Done | ${fiveSKpis.openNonConformances} Open NCs | ${fiveSKpis.openCorrectiveActions} Active Actions`}
            </p>
          </div>
        </div>

        {onNavigate && (
          <button
            onClick={() => onNavigate('five-s')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>{isFa ? 'ورود به سامانه 5S' : 'Go to 5S Module'}</span>
            <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>
        )}
      </div>

      {/* Direct Module Navigation Cards - Strictly Active Environment Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div 
          onClick={() => onNavigate?.('env-monitoring')}
          className="p-4 bg-gradient-to-l from-emerald-50 to-white dark:from-slate-800 dark:to-slate-850 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs hover:border-emerald-400 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'پایش‌های محیط زیستی' : 'Env Monitoring'}</h4>
            <p className="text-[10px] text-slate-500">{isFa ? 'اندازه‌گیری‌ها و تطبیق استاندارد' : 'Telemetry & Limits'}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-emerald-600 rtl:rotate-0 ltr:rotate-180" />
        </div>

        <div 
          onClick={() => onNavigate?.('waste-management')}
          className="p-4 bg-gradient-to-l from-amber-50 to-white dark:from-slate-800 dark:to-slate-850 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-xs hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'مدیریت پسماند و EMP' : 'Waste & EMP'}</h4>
            <p className="text-[10px] text-slate-500">{isFa ? 'رهگیری پسماندهای ویژه' : 'Hazardous & Manifests'}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-amber-600 rtl:rotate-0 ltr:rotate-180" />
        </div>

        <div 
          onClick={() => onNavigate?.('wastewater')}
          className="p-4 bg-gradient-to-l from-blue-50 to-white dark:from-slate-800 dark:to-slate-850 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-xs hover:border-blue-400 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'مدیریت پساب و ETP' : 'Wastewater ETP'}</h4>
            <p className="text-[10px] text-slate-500">{isFa ? 'COD, BOD, TSS و خروجی' : 'Effluent Quality'}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-blue-600 rtl:rotate-0 ltr:rotate-180" />
        </div>

        <div 
          onClick={() => onNavigate?.('air-water-soil')}
          className="p-4 bg-gradient-to-l from-teal-50 to-white dark:from-slate-800 dark:to-slate-850 rounded-2xl border border-teal-200 dark:border-teal-900/50 shadow-xs hover:border-teal-400 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'پایش دودکش، آب و خاک' : 'Stacks, Water & Soil'}</h4>
            <p className="text-[10px] text-slate-500">{isFa ? 'هوای محیطی و چاه‌ها' : 'Emissions & Soil'}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-teal-600 rtl:rotate-0 ltr:rotate-180" />
        </div>

        <div 
          onClick={() => onNavigate?.('five-s')}
          className="p-4 bg-gradient-to-l from-emerald-50 to-white dark:from-slate-800 dark:to-slate-850 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs hover:border-emerald-400 transition-all cursor-pointer flex items-center justify-between"
        >
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 dark:text-white text-xs">{isFa ? 'ساماندهی 5S' : '5S System'}</h4>
            <p className="text-[10px] text-slate-500">{isFa ? 'ممیزی، امتیازدهی و رتبه‌بندی' : 'Housekeeping Audits'}</p>
          </div>
          <ChevronLeft className="w-4 h-4 text-emerald-600 rtl:rotate-0 ltr:rotate-180" />
        </div>
      </div>
    </div>
  );
}
