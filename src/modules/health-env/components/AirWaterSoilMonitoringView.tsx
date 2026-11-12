import React, { useState, useEffect, useMemo } from 'react';
import { 
  Droplets, Globe, Activity, Flame, RefreshCw
} from 'lucide-react';
import { EnvMonitoringRecord } from '../types';
import { healthEnvService } from '../services/healthEnvService';

interface Props {
  language: 'fa' | 'en';
}

export default function AirWaterSoilMonitoringView({ language }: Props) {
  const isFa = language === 'fa';
  const [envRecords, setEnvRecords] = useState<EnvMonitoringRecord[]>(() => healthEnvService.getAllEnvMonitoring());

  useEffect(() => {
    const handler = () => {
      // Using window event to trigger re-renders dynamically
      const ev = new Event('force_update');
      window.dispatchEvent(ev);
    };
    window.addEventListener('hse_health_env_updated', handler);
    return () => window.removeEventListener('hse_health_env_updated', handler);
  }, []);

  useEffect(() => {
    const handleForce = () => {
      if (typeof reloadData === 'function') reloadData();
      else window.location.reload();
    };
    window.addEventListener('force_update', handleForce);
    return () => window.removeEventListener('force_update', handleForce);
  }, []);

  const [activeSubTab, setActiveSubTab] = useState<'stacks' | 'soil' | 'water'>('stacks');

  const reloadData = () => {
    setEnvRecords(healthEnvService.getAllEnvMonitoring());
  };

  const soilRecords = useMemo(() => {
    return envRecords.filter(r => r.monitoringType === 'soil');
  }, [envRecords]);

  const stackRecords = useMemo(() => {
    return envRecords.filter(r => r.monitoringType === 'stacks');
  }, [envRecords]);

  const waterRecords = useMemo(() => {
    return envRecords.filter(r => r.monitoringType === 'water');
  }, [envRecords]);

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-600 text-white rounded-2xl shadow-sm">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {isFa ? 'پایش جامع محیطی (دودکش‌ها، آب و خاک)' : 'Stacks, Water & Soil Surveillance'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa ? 'سامانه یکپارچه مانیتورینگ دودکش‌های صنعتی CEMS، منابع آب و آنالیز خاک' : 'Continuous emission monitoring systems (CEMS), water sources and soil analysis.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={reloadData}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>به‌روزرسانی داده‌ها</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveSubTab('stacks')}
          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'stacks' 
              ? 'bg-teal-600 text-white shadow-xs font-black' 
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>دودکش‌ها و فلرینگ CEMS ({stackRecords.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('soil')}
          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'soil' 
              ? 'bg-teal-600 text-white shadow-xs font-black' 
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>پایش آلودگی خاک و آب‌های زیرزمینی ({soilRecords.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('water')}
          className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSubTab === 'water' 
              ? 'bg-teal-600 text-white shadow-xs font-black' 
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-slate-700/50'
          }`}
        >
          <Droplets className="w-4 h-4" />
          <span>منابع آب شرب و صنعتی ({waterRecords.length})</span>
        </button>
      </div>

      {/* TAB 1: Stacks & CEMS */}
      {activeSubTab === 'stacks' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stackRecords.map((st) => (
              <div key={st.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{st.stationOrLocation}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    st.complianceStatus === 'compliant' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {st.complianceStatus === 'compliant' ? 'منطبق با استاندارد' : 'فراتر از حد'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{st.parameter}</span>
                  <span className="font-mono font-bold text-base text-slate-800 dark:text-white">
                    {st.measuredValue} <span className="text-[10px] text-slate-400">{st.unit}</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>حد مجاز: {st.standardLimit} {st.unit}</span>
                  <span className="font-mono">{st.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Soil Monitoring */}
      {activeSubTab === 'soil' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {soilRecords.map((sl) => (
              <div key={sl.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{sl.stationOrLocation}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    sl.complianceStatus === 'compliant' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {sl.complianceStatus === 'compliant' ? 'پاک و منطبق' : 'آلودگی خاک'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{sl.parameter}</span>
                  <span className="font-mono font-bold text-base text-slate-800 dark:text-white">
                    {sl.measuredValue} <span className="text-[10px] text-slate-400">{sl.unit}</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>حد استاندارد ملی خاک: {sl.standardLimit} {sl.unit}</span>
                  <span className="font-mono">{sl.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Water Monitoring */}
      {activeSubTab === 'water' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waterRecords.map((w) => (
              <div key={w.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="font-bold text-slate-800 dark:text-white text-xs">{w.stationOrLocation}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    w.complianceStatus === 'compliant' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {w.complianceStatus === 'compliant' ? 'منطبق با استاندارد شرب' : 'غیرمنطبق'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{w.parameter}</span>
                  <span className="font-mono font-bold text-base text-slate-800 dark:text-white">
                    {w.measuredValue} <span className="text-[10px] text-slate-400">{w.unit}</span>
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>حد مجاز: {w.standardLimit} {w.unit}</span>
                  <span className="font-mono">{w.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
