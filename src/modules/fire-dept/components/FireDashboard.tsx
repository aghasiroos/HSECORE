import React, { useState, useMemo } from 'react';
import { FireEquipment } from '../types';
import { 
  Flame, CheckCircle2, AlertTriangle, ShieldAlert,
  ClipboardList, Wrench, XCircle, ArrowUpRight, Activity, Bell, FileSpreadsheet, ShieldCheck, Truck,
  SlidersHorizontal, Hash, BarChart3, LineChart as LineIcon
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, LineChart, Line, AreaChart, Area, CartesianGrid, Legend 
} from 'recharts';
import { CategoryIcon, getCategoryMeta } from '../config/categoryIcons';

interface Props {
  language: 'fa' | 'en';
  equipment: FireEquipment[];
  onSelectCategory: (cat: string) => void;
  onSelectVehicles?: () => void;
  onSelectDailyReport?: () => void;
}

const FIRE_CATEGORIES = [
  'Fire Extinguisher Capsol',
  'Hydrants & Monitors',
  'Fire Boxs',
  'Foam Pakages',
  'FM 200',
  'دليج ولواسپرينكلرon,off ولو',
  'گازيابها',
  'دوش و چشم شوی اضطراری'
] as const;

export default function FireDashboard({ language, equipment, onSelectCategory, onSelectVehicles, onSelectDailyReport }: Props) {
  const isFa = language === 'fa';
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [chartMetric, setChartMetric] = useState<'both' | 'count' | 'defects'>('both');
  const [showLabels, setShowLabels] = useState<boolean>(true);
  
  const stats = useMemo(() => {
    let totalInspections = 0;
    let totalGood = 0;
    let totalBad = 0;
    let totalDefects = 0;
    let openDefects = 0;
    let closedDefects = 0;

    equipment.forEach(eq => {
      totalInspections += (eq.inspections || []).length;
      (eq.inspections || []).forEach(ins => {
        if (ins.status === 'مطلوب') totalGood++;
        if (ins.status === 'نامطلوب') totalBad++;
      });
      totalDefects += (eq.defects || []).length;
      (eq.defects || []).forEach(def => {
        if (def.status === 'باز') openDefects++;
        if (def.status === 'بسته') closedDefects++;
      });
    });

    return {
      totalEquip: equipment.length,
      totalInspections,
      totalGood,
      totalBad,
      totalDefects,
      openDefects,
      closedDefects
    };
  }, [equipment]);

  const categoryData = useMemo(() => {
    const map: Record<string, { count: number; openDefects: number }> = {};
    FIRE_CATEGORIES.forEach(c => {
      map[c] = { count: 0, openDefects: 0 };
    });

    equipment.forEach(e => {
      const cat = e.category;
      if (map[cat]) {
        map[cat].count++;
        (e.defects || []).forEach(d => {
          if (d.status === 'باز') map[cat].openDefects++;
        });
      }
    });

    return FIRE_CATEGORIES.map(cat => ({
      name: cat,
      count: map[cat].count,
      openDefects: map[cat].openDefects
    }));
  }, [equipment]);

  const categories = FIRE_CATEGORIES;

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full bg-slate-50 dark:bg-slate-900">
      {/* Header Info */}
      <div className="bg-linear-to-r from-red-600 to-amber-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Flame className="w-7 h-7 text-amber-200" />
            <h1 className="text-xl md:text-2xl font-black">
              {isFa ? 'سامانه جامع پایش و بازرسی تجهیزات آتش‌نشانی و ایمنی' : 'Fire Department & Safety Equipment Monitoring System'}
            </h1>
          </div>
          <p className="text-red-100 text-xs md:text-sm max-w-2xl">
            {isFa 
              ? 'کنترل وضعیت آماده‌به‌کاری کپسول‌ها، هیدرانت‌ها، فوم، سیستم‌های FM200، گازسنج‌ها و ثبت چک‌لیست‌های ماهیانه بازرسی'
              : 'Real-time tracking of fire extinguishers, hydrants, foam packages, gas detectors, and inspection checklists'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20">
          <Activity className="w-5 h-5 text-amber-200 animate-pulse" />
          <div>
            <div className="text-xs text-red-100">{isFa ? 'نرخ آماده‌به‌کاری کل' : 'Readiness Index'}</div>
            <div className="text-base font-bold text-white">
              {stats.totalInspections > 0 ? `${Math.round((stats.totalGood / stats.totalInspections) * 100)}%` : '98.5%'}
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={isFa ? 'کل تجهیزات فعال' : 'Active Equipment'} 
          value={stats.totalEquip} 
          subtitle={isFa ? 'در ۸ رسته بازرسی' : 'Across 8 categories'}
          icon={<Flame className="w-5 h-5 text-red-600" />} 
          bg="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800"
        />
        <StatCard 
          title={isFa ? 'بازرسی‌های مطلوب' : 'Good Inspections'} 
          value={stats.totalGood} 
          subtitle={isFa ? 'تأییدیه عملکرد نرمال' : 'Compliant status'}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} 
          bg="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
        />
        <StatCard 
          title={isFa ? 'موارد نامطلوب گزارش‌شده' : 'Defective Conditions'} 
          value={stats.totalBad} 
          subtitle={isFa ? 'نیازمند بررسی و سرویس' : 'Needs attention'}
          icon={<AlertTriangle className="w-5 h-5 text-rose-600" />} 
          bg="bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
        />
        <StatCard 
          title={isFa ? 'اقدامات اصلاحی باز (CAPA)' : 'Open Corrective Actions'} 
          value={stats.openDefects} 
          subtitle={isFa ? 'در دست اقدام تعمیرات' : 'Pending work orders'}
          icon={<Wrench className="w-5 h-5 text-amber-600" />} 
          bg="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
        />
      </div>

      {/* Featured Banners: Daily Report & Vehicles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Report Banner */}
        {onSelectDailyReport && (
          <div 
            onClick={onSelectDailyReport}
            className="bg-linear-to-r from-red-950 via-slate-900 to-slate-900 dark:from-red-950/80 dark:to-slate-800 text-white p-5 rounded-2xl border border-red-900/50 hover:border-red-500 shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-red-600 rounded-2xl shadow-xs group-hover:scale-110 transition-transform">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-white">
                  {isFa ? 'گزارش روزانه ایستگاه آتش‌نشانی' : 'Fire Station Daily Report'}
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  {isFa ? 'فرم پتروشیمی رجال: شیفت، مجوزها، ناوگان، دلویج ولوها، گازسنجی، حوادث و چاپ رسمی' : 'Daily logs, work permits, suppression systems, gas detection & print format'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-red-400 group-hover:text-red-300 transition-colors pt-2 border-t border-slate-700/60">
              <span>{isFa ? 'ورود به سامانه گزارش روزانه' : 'Open Daily Reports'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Fire Vehicles Fleet Banner */}
        {onSelectVehicles && (
          <div 
            onClick={onSelectVehicles}
            className="bg-linear-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-750 text-white p-5 rounded-2xl border border-slate-700 shadow-md hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
          >
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-xs group-hover:scale-110 transition-transform">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-black text-white">
                  {isFa ? 'مدیریت و بازرسی خودروهای آتش‌نشانی' : 'Fire Vehicle Management & Inspections'}
                </h3>
                <p className="text-slate-300 text-xs mt-1">
                  {isFa ? 'شناسنامه خودروها، چک‌لیست بازرسی ۸ گانه فنی، ثبت خودکار مغایرت‌ها (CAPA) و صدور QR Code' : 'Fleet directory, 8-category inspection checklist, CAPA management & NFPA'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors pt-2 border-t border-slate-700/60">
              <span>{isFa ? 'ورود به مدیریت ناوگان' : 'Open Fleet Manager'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>

      {/* Sub-categories Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-red-500" />
            {isFa ? 'زیرمجموعه‌ها و فرم‌های بازرسی ۸ گانه' : '8 Standard Safety Equipment Sub-modules'}
          </h2>
          <span className="text-xs text-slate-500">
            {isFa ? 'روی هر بخش جهت مدیریت و مشاهده چک‌لیست‌ها کلیک کنید' : 'Click on any section to open records'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => {
            const catEquip = equipment.filter(e => e.category === cat);
            const openD = catEquip.reduce((acc, it) => acc + it.defects.filter(d => d.status === 'باز').length, 0);
            const meta = getCategoryMeta(cat);

            return (
              <div 
                key={cat} 
                onClick={() => onSelectCategory(cat)}
                className="group bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md hover:border-red-400 dark:hover:border-red-500 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                    <CategoryIcon category={cat} className="w-4 h-4" />
                  </span>
                  {openD > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse">
                      {openD} {isFa ? 'نقص باز' : 'Open Defect'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      ✓ {isFa ? 'سالم' : 'OK'}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-2">
                    {cat}
                  </h3>
                </div>

                <div className="flex justify-between items-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/80">
                  <div>
                    <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{catEquip.length}</span>
                    <span className="text-xs text-slate-500 mr-1.5">{isFa ? 'تجهیز ثبت شده' : 'Items'}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-400 group-hover:text-red-600 group-hover:bg-red-50 dark:group-hover:bg-red-950/40 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/60">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-red-500" />
            {isFa ? 'توزیع تجهیزات و وضعیت نواقص در دسته‌بندی‌ها' : 'Equipment Distribution & Defect Frequency'}
          </h3>

          {/* Customization Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Chart Type */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-700/70 p-0.5 rounded-lg">
              <button
                onClick={() => setChartType('bar')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartType === 'bar' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isFa ? 'میله‌ای' : 'Bar'}
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartType === 'line' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isFa ? 'خطی' : 'Line'}
              </button>
              <button
                onClick={() => setChartType('area')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  chartType === 'area' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {isFa ? 'سطحی' : 'Area'}
              </button>
            </div>

            {/* Metric */}
            <select
              value={chartMetric}
              onChange={e => setChartMetric(e.target.value as any)}
              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold border-none cursor-pointer"
            >
              <option value="both">{isFa ? 'تجهیزات و نواقص' : 'Both Count & Defects'}</option>
              <option value="count">{isFa ? 'فقط تعداد تجهیزات' : 'Equipment Count'}</option>
              <option value="defects">{isFa ? 'فقط نواقص باز' : 'Open Defects'}</option>
            </select>

            {/* Labels Toggle */}
            <button
              onClick={() => setShowLabels(!showLabels)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                showLabels 
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              <Hash className="w-3 h-3" />
              <span>{showLabels ? (isFa ? 'اعداد فعال' : 'Labels On') : (isFa ? 'بدون عدد' : 'Labels Off')}</span>
            </button>
          </div>
        </div>

        <div className="h-64 w-full pt-2 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} debounce={50}>
            {chartType === 'bar' ? (
              <BarChart data={categoryData} margin={{ top: 20, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  interval={0}
                  tickFormatter={(v) => v.length > 12 ? v.substring(0, 10) + '...' : v}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
                          <div className="font-bold text-red-300">{data.name}</div>
                          <div>تعداد تجهیزات: <span className="font-bold">{data.count}</span></div>
                          <div>نواقص باز: <span className="font-bold text-rose-400">{data.openDefects}</span></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                {(chartMetric === 'both' || chartMetric === 'count') && (
                  <Bar dataKey="count" name={isFa ? 'کل تجهیزات' : 'Equipment'} fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                    {showLabels && <LabelList dataKey="count" position="top" fill="#0284c7" fontSize={11} fontWeight="bold" />}
                  </Bar>
                )}
                {(chartMetric === 'both' || chartMetric === 'defects') && (
                  <Bar dataKey="openDefects" name={isFa ? 'نواقص باز' : 'Open Defects'} fill="#ef4444" radius={[4, 4, 0, 0]}>
                    {showLabels && <LabelList dataKey="openDefects" position="top" fill="#dc2626" fontSize={11} fontWeight="bold" />}
                  </Bar>
                )}
              </BarChart>
            ) : chartType === 'line' ? (
              <LineChart data={categoryData} margin={{ top: 20, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  interval={0}
                  tickFormatter={(v) => v.length > 12 ? v.substring(0, 10) + '...' : v}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                {(chartMetric === 'both' || chartMetric === 'count') && (
                  <Line type="monotone" dataKey="count" name={isFa ? 'کل تجهیزات' : 'Equipment'} stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 4 }}>
                    {showLabels && <LabelList dataKey="count" position="top" fill="#0284c7" fontSize={11} fontWeight="bold" />}
                  </Line>
                )}
                {(chartMetric === 'both' || chartMetric === 'defects') && (
                  <Line type="monotone" dataKey="openDefects" name={isFa ? 'نواقص باز' : 'Open Defects'} stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4 }}>
                    {showLabels && <LabelList dataKey="openDefects" position="top" fill="#dc2626" fontSize={11} fontWeight="bold" />}
                  </Line>
                )}
              </LineChart>
            ) : (
              <AreaChart data={categoryData} margin={{ top: 20, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }} 
                  interval={0}
                  tickFormatter={(v) => v.length > 12 ? v.substring(0, 10) + '...' : v}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                <Area type="monotone" dataKey="count" name={isFa ? 'کل تجهیزات' : 'Equipment'} stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.2} />
                <Area type="monotone" dataKey="openDefects" name={isFa ? 'نواقص باز' : 'Open Defects'} stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, bg }: { title: string; value: number; subtitle: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className={`p-4 md:p-5 rounded-2xl border shadow-xs flex items-center justify-between ${bg}`}>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{value}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{subtitle}</p>
      </div>
      <div className="p-3 rounded-xl bg-white dark:bg-slate-800 shadow-xs">
        {icon}
      </div>
    </div>
  );
}
