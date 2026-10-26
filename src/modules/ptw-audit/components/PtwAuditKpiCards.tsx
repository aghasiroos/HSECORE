import React from 'react';
import { 
  FileText, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Flame, 
  AlertOctagon, 
  ArrowUpRight, 
  BarChart3, 
  LayoutGrid 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LabelList 
} from 'recharts';
import { PtwAuditRecord } from '../types';
import { ChartSettings, THEME_PALETTES } from './ChartCustomizationModal';

interface PtwAuditKpiCardsProps {
  totalAuditsCount: number;
  defectiveAuditsCount: number;
  totalDefectsCount: number;
  overallDefectRate: number;
  overallComplianceRate: number;
  hotPermitsCount: number;
  criticalNcCount: number;
  chartSettings: ChartSettings;
  onOpenDrillDown: (title: string, description: string, filter: (a: PtwAuditRecord) => boolean) => void;
}

export default function PtwAuditKpiCards({
  totalAuditsCount,
  defectiveAuditsCount,
  totalDefectsCount,
  overallDefectRate,
  overallComplianceRate,
  hotPermitsCount,
  criticalNcCount,
  chartSettings,
  onOpenDrillDown
}: PtwAuditKpiCardsProps) {
  const [viewMode, setViewMode] = React.useState<'cards' | 'chart'>('cards');
  const palette = THEME_PALETTES[chartSettings.colorTheme] || THEME_PALETTES.safety;

  const kpiChartData = [
    { name: 'کل ممیزی‌ها', value: totalAuditsCount, fill: palette.primary },
    { name: 'دارای خطا', value: defectiveAuditsCount, fill: palette.secondary },
    { name: 'مجموع نقص‌ها', value: totalDefectsCount, fill: palette.warning },
    { name: 'پروانه گرم', value: hotPermitsCount, fill: '#2563eb' },
    { name: 'توقف بحرانی', value: criticalNcCount, fill: palette.purple }
  ];

  return (
    <div className="space-y-3">
      {/* Header View Switcher */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-black text-slate-700 dark:text-slate-300">
          شاخص‌های کلیدی عملکرد و ارزیابی انطباق (Executive KPIs)
        </span>
        
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>کارت‌ها</span>
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'chart'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>نمودار شاخص‌ها</span>
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          
          {/* Total Audits */}
          <div 
            onClick={() => onOpenDrillDown('کل ممیزی‌های تحلیل‌شده', 'فهرست تمام ممیزی‌های موجود در بازه و فیلترهای انتخابی', () => true)}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">کل ممیزی‌ها</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-1 group-hover:text-blue-600 transition-colors">
              {totalAuditsCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>کل پروانه‌های بررسی‌شده</span>
              <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
            </div>
          </div>

          {/* Audits with Defects */}
          <div 
            onClick={() => onOpenDrillDown('پروانه‌های کار دارای خطا', 'فهرست ممیزی‌هایی که حداقل یک عدم انطباق یا مشاهده نامطلوب در آن‌ها ثبت شده است', (a) => (a.defectsCount || 0) > 0 || (a.inspectionItems?.some(i => i.status === 'O' || i.status === 'DEFECT') ?? false))}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-rose-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">پروانه‌های دارای خطا</span>
              <div className="w-7 h-7 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
              {defectiveAuditsCount}
            </div>
            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
              نرخ خطا: {overallDefectRate}%
            </div>
          </div>

          {/* Total Defects Sum */}
          <div 
            onClick={() => onOpenDrillDown('مجموع خطاهای ثبتی (O)', 'فهرست تمام ممیزی‌های دارای عدم انطباق به تفکیک بندهای چک‌لیست', (a) => (a.defectsCount || 0) > 0)}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">مجموع کل خطاها</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
              {totalDefectsCount}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              عدم انطباق‌های شناسایی‌شده
            </div>
          </div>

          {/* Average Compliance Score */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">میانگین انطباق</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {overallComplianceRate}%
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1 font-bold">
              شاخص سلامت صدور پرمیت
            </div>
          </div>

          {/* Hot Permits Share */}
          <div 
            onClick={() => onOpenDrillDown('ممیزی‌های پروانه کار گرم', 'فهرست ممیزی‌های پروانه‌های گرم (Hot Work)', (a) => a.permitType === 'HOT')}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-red-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">پروانه گرم (Hot)</span>
              <div className="w-7 h-7 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                <Flame className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-red-600 dark:text-red-400 mt-1">
              {hotPermitsCount}
            </div>
            <div className="text-[10px] text-red-600 dark:text-red-400 mt-1 font-bold">
              بالاترین ریسک حریق
            </div>
          </div>

          {/* Critical NCs */}
          <div 
            onClick={() => onOpenDrillDown('پروانه‌های دارای توقف / عدم انطباق بحرانی', 'فهرست ممیزی‌های وضعیت بحرانی (Critical Non-Conformance)', (a) => a.status === 'CRITICAL_NC')}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-purple-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">عدم انطباق بحرانی</span>
              <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <AlertOctagon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
              {criticalNcCount}
            </div>
            <div className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 font-bold">
              دستور توقف / اقدام فوری
            </div>
          </div>

        </div>
      ) : (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220} debounce={50}>
              <BarChart data={kpiChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.4} />}
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(val: any) => [`${val} مورد`, 'تعداد']}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
                />
                <Bar 
                  dataKey="value" 
                  radius={[8, 8, 0, 0]} 
                  maxBarSize={55}
                  isAnimationActive={chartSettings.enableAnimation}
                >
                  {chartSettings.showDataLabels && (
                    <LabelList dataKey="value" position="top" fill="#64748b" fontSize={11} fontWeight="bold" />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
