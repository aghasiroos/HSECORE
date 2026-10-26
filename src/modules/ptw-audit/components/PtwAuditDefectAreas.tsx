import React from 'react';
import { 
  AlertTriangle, 
  HardHat, 
  ShieldAlert, 
  CheckCircle2, 
  LayoutGrid, 
  BarChart3,
  AlignLeft
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
import { DefectCategoryItem } from '../services/ptwAuditAnalytics';
import { 
  ChartSettings, 
  THEME_PALETTES, 
  DefectAreasChartType 
} from './ChartCustomizationModal';

export interface PtwAuditDefectAreasProps {
  hazardDefects: DefectCategoryItem[];
  ppeDefects: DefectCategoryItem[];
  precautionsDefects: DefectCategoryItem[];
  chartSettings: ChartSettings;
  onUpdateChartSettings?: (newSettings: ChartSettings) => void;
  onOpenDrillDown: (title: string, description: string, filter: (a: any) => boolean) => void;
}

interface DefectCardItemProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  defects: DefectCategoryItem[];
  barColor: string;
  emptyMessage: string;
  chartSettings: ChartSettings;
  onSetGlobalView?: (type: DefectAreasChartType) => void;
  onOpenDrillDown: (title: string, description: string, filter: (a: any) => boolean) => void;
}

const DefectCardItem: React.FC<DefectCardItemProps> = ({
  title,
  subtitle,
  icon,
  iconBg,
  defects,
  barColor,
  emptyMessage,
  chartSettings,
  onSetGlobalView,
  onOpenDrillDown
}) => {
  const viewMode = chartSettings.defectAreasChart || 'cards';

  const chartData = (defects || []).map(d => ({
    name: d.titleFa.length > 18 ? d.titleFa.slice(0, 18) + '...' : d.titleFa,
    fullName: d.titleFa,
    count: d.defectCount,
    percentage: d.percentage
  }));

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-2xl ${iconBg} flex items-center justify-center font-bold`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="text-[11px] text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onSetGlobalView && onSetGlobalView('cards')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title="نمای کارت‌ها"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSetGlobalView && onSetGlobalView('barHorizontal')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'barHorizontal'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title="نمای میله‌ای افقی"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSetGlobalView && onSetGlobalView('bar')}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'bar'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title="نمای ستونی عمودی"
          >
            <BarChart3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Body */}
      {(!defects || defects.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 rounded-2xl text-center space-y-2.5">
          <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-300">
              ۱۰۰٪ انطباق استاندارد
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 leading-relaxed">
              {emptyMessage}
            </p>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="space-y-2.5 flex-1">
          {defects.slice(0, 5).map((defect, idx) => (
            <div 
              key={defect.id}
              onClick={() => onOpenDrillDown(
                `پروانه‌های دارای نقص: ${defect.titleFa}`,
                `مشاهده تمام پروانه‌های کاری که در آن‌ها نقص «${defect.titleFa}» گزارش شده است`,
                (a) => defect.permitIds && defect.permitIds.length > 0
                  ? defect.permitIds.includes(a.id)
                  : (a.inspectionItems?.some((i: any) => i.status === 'O' || i.status === 'DEFECT') ?? false)
              )}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-600 transition-colors">
                  {idx + 1}. {defect.titleFa}
                </span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {defect.defectCount} مورد ({defect.percentage}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${Math.min(100, defect.percentage * 2)}%`,
                    backgroundColor: barColor 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'barHorizontal' ? (
        <div className="h-56 w-full flex-1 pt-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={50}>
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip 
                formatter={(val: any) => [`${val} مورد نقص`, 'تکرار']}
                labelFormatter={(lbl, p) => p && p[0] ? (p[0].payload as any).fullName : lbl}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
              />
              <Bar 
                dataKey="count" 
                fill={barColor} 
                radius={[0, 6, 6, 0]}
                isAnimationActive={chartSettings.enableAnimation}
              >
                {chartSettings.showDataLabels && (
                  <LabelList dataKey="count" position="right" fill={barColor} fontSize={11} fontWeight="bold" />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-56 w-full flex-1 pt-1 min-h-[220px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={50}>
            <BarChart 
              data={chartData} 
              margin={{ top: 15, right: 10, left: 0, bottom: 20 }}
            >
              {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.3} />}
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip 
                formatter={(val: any) => [`${val} مورد نقص`, 'تکرار']}
                labelFormatter={(lbl, p) => p && p[0] ? (p[0].payload as any).fullName : lbl}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px', direction: 'rtl' }}
              />
              <Bar 
                dataKey="count" 
                fill={barColor} 
                radius={[6, 6, 0, 0]}
                maxBarSize={30}
                isAnimationActive={chartSettings.enableAnimation}
              >
                {chartSettings.showDataLabels && (
                  <LabelList dataKey="count" position="top" fill={barColor} fontSize={10} fontWeight="bold" />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Footer info */}
      {defects && defects.length > 0 && (
        <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
          <span>مجموع موارد نقص: {defects.reduce((acc, d) => acc + d.defectCount, 0)} مورد</span>
          <span className="text-amber-600 font-bold">برای مشاهده پروانه‌ها روی ردیف کلیک کنید</span>
        </div>
      )}
    </div>
  );
};

export default function PtwAuditDefectAreas({
  hazardDefects,
  ppeDefects,
  precautionsDefects,
  chartSettings,
  onUpdateChartSettings,
  onOpenDrillDown
}: PtwAuditDefectAreasProps) {
  const palette = THEME_PALETTES[chartSettings?.colorTheme] || THEME_PALETTES.safety;

  const handleSetGlobalView = (type: DefectAreasChartType) => {
    if (onUpdateChartSettings) {
      onUpdateChartSettings({ ...chartSettings, defectAreasChart: type });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* 1. Environmental Hazards Defects */}
      <DefectCardItem
        title="خطا در شرایط خطرناک محیطی"
        subtitle="عدم ارزیابی یا کنترل ریسک‌های محیطی، گازسنجی و نشتی"
        icon={<AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-50 dark:bg-amber-950/40"
        defects={hazardDefects}
        barColor={palette.warning}
        emptyMessage="هیچ عدم انطباقی در شرایط محیطی و گازسنجی در این بازه ثبت نشده است."
        chartSettings={chartSettings}
        onSetGlobalView={handleSetGlobalView}
        onOpenDrillDown={onOpenDrillDown}
      />

      {/* 2. PPE Defects */}
      <DefectCardItem
        title="خطا در تجهیزات حفاظت فردی (PPE)"
        subtitle="تجهیزات الزامی مشخص‌نشده یا استفاده‌نشده در پروانه"
        icon={<HardHat className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        iconBg="bg-blue-50 dark:bg-blue-950/40"
        defects={ppeDefects}
        barColor={palette.primary}
        emptyMessage="تمامی الزامات تجهیزات حفاظت فردی در پروانه‌ها رعایت گردیده‌اند."
        chartSettings={chartSettings}
        onSetGlobalView={handleSetGlobalView}
        onOpenDrillDown={onOpenDrillDown}
      />

      {/* 3. Safety Precautions Defects */}
      <DefectCardItem
        title="پیش‌بینی‌های در نظر گرفته نشده"
        subtitle="تمهیدات ایمنی و ایزولاسیون‌های فراموش‌شده"
        icon={<ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
        iconBg="bg-rose-50 dark:bg-rose-950/40"
        defects={precautionsDefects}
        barColor={palette.secondary}
        emptyMessage="تمامی اقدامات کنترلی و پیش‌بینی‌های ایمنی لحاظ شده‌اند."
        chartSettings={chartSettings}
        onSetGlobalView={handleSetGlobalView}
        onOpenDrillDown={onOpenDrillDown}
      />
    </div>
  );
}
