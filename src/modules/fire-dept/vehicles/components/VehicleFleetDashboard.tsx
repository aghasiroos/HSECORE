import React, { useState, useMemo } from 'react';
import { 
  Truck, ShieldCheck, AlertTriangle, Wrench, XCircle, 
  Activity, CheckCircle2, Clock, Calendar, FileText, 
  ChevronRight, ArrowUpRight, Flame, BarChart3, AlertOctagon,
  FileCheck, ShieldAlert, Sparkles, Filter, RefreshCw,
  LayoutGrid, List, ArrowUpDown
} from 'lucide-react';
import { FireVehicle, VehicleStatus } from '../types/vehicleTypes';

interface Props {
  language: 'fa' | 'en';
  vehicles: FireVehicle[];
  onSelectVehicle: (vehicle: FireVehicle) => void;
  onStartInspection: (vehicle?: FireVehicle) => void;
  onNavigateTab: (tab: string) => void;
}

export default function VehicleFleetDashboard({
  language,
  vehicles,
  onSelectVehicle,
  onStartInspection,
  onNavigateTab
}: Props) {
  const isFa = language === 'fa';

  // Filters
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      if (stationFilter !== 'all' && v.fireStation !== stationFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (vehicleFilter !== 'all' && v.id !== vehicleFilter) return false;
      return true;
    });
  }, [vehicles, stationFilter, statusFilter, vehicleFilter]);

  // Unique Stations
  const stations = useMemo(() => {
    return Array.from(new Set(vehicles.map(v => v.fireStation))).filter(Boolean);
  }, [vehicles]);

  // Aggregated Stats
  const stats = useMemo(() => {
    const total = filteredVehicles.length;
    const ready = filteredVehicles.filter(v => v.status === 'آماده به کار').length;
    const limited = filteredVehicles.filter(v => v.status === 'آماده به کار با محدودیت').length;
    const inRepair = filteredVehicles.filter(v => v.status === 'در تعمیرات').length;
    const outOfService = filteredVehicles.filter(v => v.status === 'خارج از سرویس').length;

    const totalInspections = filteredVehicles.reduce((acc, v) => acc + v.inspectionHistory.length, 0);
    
    // Open & Critical Defects
    let openDefects = 0;
    let criticalDefects = 0;
    let overdueCapa = 0;
    
    filteredVehicles.forEach(v => {
      v.defects.forEach(d => {
        if (d.status === 'باز' || d.status === 'در حال اقدام') {
          openDefects++;
          if (d.severity === 'بحرانی') criticalDefects++;
          if (d.correctiveAction?.dueDate && d.correctiveAction.dueDate < '1404/05/15') {
            overdueCapa++;
          }
        }
      });
    });

    // Certificates
    let expiredCerts = 0;
    filteredVehicles.forEach(v => {
      v.certificates.forEach(c => {
        if (c.expiryDate && c.expiryDate < '1404/05/20') {
          expiredCerts++;
        }
      });
    });

    // Fleet Average Compliance
    const avgScore = total > 0 
      ? Math.round(filteredVehicles.reduce((acc, v) => acc + (v.complianceScore || 0), 0) / total)
      : 100;

    return {
      total,
      ready,
      limited,
      inRepair,
      outOfService,
      totalInspections,
      openDefects,
      criticalDefects,
      overdueCapa,
      expiredCerts,
      avgScore
    };
  }, [filteredVehicles]);

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'آماده به کار':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="w-3.5 h-3.5" />{status}</span>;
      case 'آماده به کار با محدودیت':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><AlertTriangle className="w-3.5 h-3.5" />{status}</span>;
      case 'در تعمیرات':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800"><Wrench className="w-3.5 h-3.5" />{status}</span>;
      case 'خارج از سرویس':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><XCircle className="w-3.5 h-3.5" />{status}</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
    if (score >= 75) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
    if (score >= 50) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-600 text-white rounded-xl shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {isFa ? 'داشبورد مدیریت و پایش ناوگان خودروهای آتش‌نشانی' : 'Fire Vehicles Fleet Management Dashboard'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isFa ? 'ارزیابی آنلاین آمادگی عملیاتی، بازرسی‌های ادواری، عیب‌یابی و انطباق استانداردها' : 'Real-time operational readiness, maintenance tracking & compliance'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onStartInspection()}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isFa ? 'ثبت بازرسی جدید' : 'New Inspection'}</span>
          </button>
          <button
            onClick={() => onNavigateTab('vehicles')}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>{isFa ? 'فهرست کامل خودروها' : 'All Vehicles'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
          <Filter className="w-4 h-4 text-red-500" />
          <span>{isFa ? 'فیلترهای مدیریتی:' : 'Filters:'}</span>
        </div>

        {/* Station */}
        <select
          value={stationFilter}
          onChange={e => setStationFilter(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
        >
          <option value="all">{isFa ? 'همه ایستگاه‌ها' : 'All Stations'}</option>
          {stations.map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
        >
          <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
          <option value="آماده به کار">{isFa ? 'آماده به کار' : 'Ready'}</option>
          <option value="آماده به کار با محدودیت">{isFa ? 'آماده به کار با محدودیت' : 'Ready with Limit'}</option>
          <option value="در تعمیرات">{isFa ? 'در تعمیرات' : 'In Repair'}</option>
          <option value="خارج از سرویس">{isFa ? 'خارج از سرویس' : 'Out of Service'}</option>
        </select>

        {/* Vehicle */}
        <select
          value={vehicleFilter}
          onChange={e => setVehicleFilter(e.target.value)}
          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold outline-none"
        >
          <option value="all">{isFa ? 'همه خودروها' : 'All Vehicles'}</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.code} - {v.vehicleType} ({v.brandModel})</option>
          ))}
        </select>

        {(stationFilter !== 'all' || statusFilter !== 'all' || vehicleFilter !== 'all') && (
          <button
            onClick={() => {
              setStationFilter('all');
              setStatusFilter('all');
              setVehicleFilter('all');
            }}
            className="text-xs text-red-600 hover:text-red-700 font-bold px-2 py-1 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            {isFa ? 'پاکسازی فیلترها' : 'Reset'}
          </button>
        )}
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">{isFa ? 'کل ناوگان' : 'Total Fleet'}</span>
            <Truck className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">{isFa ? 'خودرو تخصصی' : 'Specialized Vehicles'}</div>
        </div>

        {/* Ready */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold">{isFa ? 'آماده به کار' : 'Fully Ready'}</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{stats.ready}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">{isFa ? '۱۰۰٪ عملیاتی' : 'Operational'}</div>
        </div>

        {/* Limited */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold">{isFa ? 'با محدودیت' : 'With Limit'}</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{stats.limited}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">{isFa ? 'دارای نقص غیربحرانی' : 'Minor defect'}</div>
        </div>

        {/* In Repair */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-sky-200 dark:border-sky-900/60 shadow-xs">
          <div className="flex items-center justify-between text-sky-600 mb-2">
            <span className="text-xs font-bold">{isFa ? 'در تعمیرات' : 'In Repair'}</span>
            <Wrench className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 font-mono">{stats.inRepair}</div>
          <div className="text-[11px] text-sky-600/80 mt-1">{isFa ? 'در کارگاه ترابری' : 'Workshop'}</div>
        </div>

        {/* Out of Service */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-bold">{isFa ? 'خارج از سرویس' : 'Out of Service'}</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">{stats.outOfService}</div>
          <div className="text-[11px] text-rose-600/80 mt-1">{isFa ? 'نقص بحرانی' : 'Critical halt'}</div>
        </div>

        {/* Average Fleet Readiness */}
        <div className="bg-gradient-to-br from-red-600 to-rose-700 p-4 rounded-2xl text-white shadow-xs">
          <div className="flex items-center justify-between text-red-100 mb-2">
            <span className="text-xs font-bold">{isFa ? 'میانگین آمادگی' : 'Fleet Score'}</span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono">{stats.avgScore}%</div>
          <div className="text-[11px] text-red-100/90 mt-1">{isFa ? 'انطباق الزامات' : 'Compliance Avg'}</div>
        </div>
      </div>

      {/* Secondary Alerts & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          onClick={() => onNavigateTab('defects')}
          className="text-right bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-red-300 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div>
            <div className="text-xs text-slate-500 font-bold">{isFa ? 'نواقص و مغایرت‌های باز' : 'Open Defects'}</div>
            <div className="text-xl font-black text-slate-800 dark:text-white font-mono mt-1">{stats.openDefects}</div>
            <div className="text-[11px] text-red-600 font-bold mt-0.5">
              {stats.criticalDefects} {isFa ? 'مورد بحرانی' : 'Critical'}
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/50 text-red-600 rounded-xl group-hover:scale-110 transition-transform">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('defects')}
          className="text-right bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div>
            <div className="text-xs text-slate-500 font-bold">{isFa ? 'اقدامات اصلاحی سررسید گذشته' : 'Overdue CAPA'}</div>
            <div className="text-xl font-black text-amber-600 font-mono mt-1">{stats.overdueCapa}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{isFa ? 'نیازمند تسریع اقدام' : 'Action Required'}</div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
            <Clock className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('certificates')}
          className="text-right bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div>
            <div className="text-xs text-slate-500 font-bold">{isFa ? 'گواهی‌های منقضی / نیازمند آزمون' : 'Expired/Due Certs'}</div>
            <div className="text-xl font-black text-purple-600 font-mono mt-1">{stats.expiredCerts}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{isFa ? 'آزمون‌های هیدرواستاتیک و دبی' : 'Testing Due'}</div>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-xl group-hover:scale-110 transition-transform">
            <FileCheck className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => onNavigateTab('maintenance')}
          className="text-right bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-sky-300 transition-all flex items-center justify-between group cursor-pointer"
        >
          <div>
            <div className="text-xs text-slate-500 font-bold">{isFa ? 'سوابق بازرسی و سرویس' : 'Inspection Records'}</div>
            <div className="text-xl font-black text-sky-600 font-mono mt-1">{stats.totalInspections}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{isFa ? 'ثبت شده در سامانه' : 'Logged Checks'}</div>
          </div>
          <div className="p-3 bg-sky-50 dark:bg-sky-950/50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Fleet Vehicles Status Cards & Readiness Breakdown */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-750 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa ? 'وضعیت آمادگی و انطباق تک‌تک خودروهای ناوگان (Compliance Score)' : 'Individual Vehicle Compliance Scores'}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isFa ? 'نمایش کارتی و سطری میزان آمادگی عملیاتی و امتیاز انطباق' : 'Grid & list layout of fleet operational readiness'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="text-xs text-slate-400 font-mono hidden md:inline-block">
              {filteredVehicles.length} {isFa ? 'خودرو ثبت شده' : 'Vehicles'}
            </span>

            {/* View Mode Toggle Switcher matching image */}
            <div className="bg-slate-100 dark:bg-slate-700/80 p-1 rounded-2xl flex items-center gap-1 border border-slate-200/60 dark:border-slate-600/50 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-red-600 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title={isFa ? 'چیدمان کارتی (شبکه‌ای)' : 'Grid View'}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-800 text-red-600 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
                title={isFa ? 'چیدمان سطری (لیستی)' : 'List View'}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* View Mode Content */}
        {viewMode === 'grid' ? (
          /* Grid View Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map(vehicle => {
              const openDefs = vehicle.defects.filter(d => d.status === 'باز' || d.status === 'در حال اقدام');
              const hasCrit = openDefs.some(d => d.severity === 'بحرانی');

              return (
                <div
                  key={vehicle.id}
                  onClick={() => onSelectVehicle(vehicle)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-600 bg-slate-50/60 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer group space-y-3 shadow-2xs"
                >
                  {/* Top Row: Code, Plate & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-red-600 text-white font-black text-xs font-mono rounded-xl shadow-xs tracking-wider whitespace-nowrap min-w-[65px]">
                          {vehicle.code}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {vehicle.brandModel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        {vehicle.plateNumber}
                      </div>
                    </div>
                    {getStatusBadge(vehicle.status)}
                  </div>

                  {/* Specs quick pill */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                    <div>
                      <span className="text-slate-400 block">{isFa ? 'نوع خودرو:' : 'Type:'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate block">{vehicle.vehicleType}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isFa ? 'ایستگاه / محل:' : 'Station:'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200 truncate block">{vehicle.fireStation}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isFa ? 'مخزن آب / فوم:' : 'Water/Foam:'}</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{vehicle.waterTankCapacity}L / {vehicle.foamTankCapacity}L</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isFa ? 'کارکرد:' : 'Mileage:'}</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{vehicle.mileage.toLocaleString()} km</span>
                    </div>
                  </div>

                  {/* Score bar & readiness */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold">{isFa ? 'امتیاز انطباق بازرسی:' : 'Compliance Score:'}</span>
                      <span className={`px-2 py-0.5 rounded-md font-mono font-black border text-xs ${getScoreColor(vehicle.complianceScore)}`}>
                        {vehicle.complianceScore}% ({vehicle.overallReadiness})
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          vehicle.complianceScore >= 90 ? 'bg-emerald-500' :
                          vehicle.complianceScore >= 75 ? 'bg-amber-500' :
                          vehicle.complianceScore >= 50 ? 'bg-blue-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${vehicle.complianceScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer notes & defect count */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {openDefs.length > 0 ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          hasCrit ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {openDefs.length} {isFa ? 'نقص باز' : 'Defects'}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {isFa ? 'فاقد نقص باز' : 'No Defects'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-red-600 font-bold transition-colors">
                      <span>{isFa ? 'مشاهده پرونده' : 'View Details'}</span>
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View Layout */
          <div className="space-y-2.5">
            {filteredVehicles.map(vehicle => {
              const openDefs = vehicle.defects.filter(d => d.status === 'باز' || d.status === 'در حال اقدام');
              const hasCrit = openDefs.some(d => d.severity === 'بحرانی');

              return (
                <div
                  key={vehicle.id}
                  onClick={() => onSelectVehicle(vehicle)}
                  className="p-3.5 bg-slate-50/70 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-600 rounded-2xl transition-all cursor-pointer shadow-2xs group flex flex-col xl:flex-row xl:items-center justify-between gap-3.5"
                >
                  {/* Left info: Code, Model, Plate, Station & Type */}
                  <div className="flex items-center gap-3.5 min-[0px] w-full md:min-w-[280px]">
                    <span className="inline-flex items-center justify-center px-3 py-1.5 bg-red-600 text-white font-black text-xs font-mono rounded-xl shadow-xs tracking-wider whitespace-nowrap min-w-[65px]">
                      {vehicle.code}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-red-600 transition-colors">
                          {vehicle.brandModel}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({vehicle.plateNumber})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{vehicle.vehicleType}</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>{vehicle.fireStation}</span>
                      </div>
                    </div>
                  </div>

                  {/* Specs: Tanks & Mileage */}
                  <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <div>
                      <span className="text-slate-400 block text-[10px]">{isFa ? 'مخازن:' : 'Tanks:'}</span>
                      <span className="font-mono font-bold">{vehicle.waterTankCapacity}L آب / {vehicle.foamTankCapacity}L فوم</span>
                    </div>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">{isFa ? 'کارکرد:' : 'Mileage:'}</span>
                      <span className="font-mono font-bold">{vehicle.mileage.toLocaleString()} km</span>
                    </div>
                  </div>

                  {/* Compliance Score & Progress bar */}
                  <div className="min-[0px] w-full md:min-w-[200px] space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold text-[11px]">{isFa ? 'انطباق و آمادگی:' : 'Compliance:'}</span>
                      <span className={`px-2 py-0.5 rounded-md font-mono font-black border text-xs ${getScoreColor(vehicle.complianceScore)}`}>
                        {vehicle.complianceScore}% ({vehicle.overallReadiness})
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          vehicle.complianceScore >= 90 ? 'bg-emerald-500' :
                          vehicle.complianceScore >= 75 ? 'bg-amber-500' :
                          vehicle.complianceScore >= 50 ? 'bg-blue-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${vehicle.complianceScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Status & Defects */}
                  <div className="flex items-center gap-2">
                    {getStatusBadge(vehicle.status)}
                    {openDefs.length > 0 ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-bold text-[11px] ${
                        hasCrit ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {openDefs.length} {isFa ? 'نقص' : 'Defects'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isFa ? 'مطلوب' : 'Clean'}
                      </span>
                    )}
                  </div>

                  {/* Action link */}
                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-red-600 font-bold text-xs transition-colors shrink-0">
                    <span>{isFa ? 'مشاهده پرونده' : 'View'}</span>
                    <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
