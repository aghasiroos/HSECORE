import React from 'react';
import { 
  Award, 
  Eye, 
  Table as TableIcon, 
  BarChart3, 
  AlignLeft, 
  LineChart as LineIcon, 
  PieChart as PieIcon 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { DefectPersonStat } from '../services/ptwAuditAnalytics';
import { RoleType } from '../services/ptwAuditAnalytics';
import { 
  ChartSettings, 
  THEME_PALETTES, 
  PersonnelChartType 
} from './ChartCustomizationModal';

interface PtwAuditPersonnelRankingProps {
  activeTopPersonnel: DefectPersonStat[];
  activeRoleTab: RoleType;
  setActiveRoleTab: (role: RoleType) => void;
  topAreaResponsibleCount: number;
  topSupervisorsCount: number;
  topPerformersCount: number;
  topSafetyUnitCount: number;
  chartSettings: ChartSettings;
  onUpdateChartSettings?: (newSettings: ChartSettings) => void;
  onOpenDrillDown: (title: string, description: string, recordIds: string[]) => void;
}

export default function PtwAuditPersonnelRanking({
  activeTopPersonnel,
  activeRoleTab,
  setActiveRoleTab,
  topAreaResponsibleCount,
  topSupervisorsCount,
  topPerformersCount,
  topSafetyUnitCount,
  chartSettings,
  onUpdateChartSettings,
  onOpenDrillDown
}: PtwAuditPersonnelRankingProps) {
  const personnelView = chartSettings.personnelRankingChart || 'table';
  const palette = THEME_PALETTES[chartSettings.colorTheme] || THEME_PALETTES.safety;

  // Chart data for Top Personnel
  const chartData = activeTopPersonnel.map((p, idx) => ({
    name: p.personName.length > 16 ? p.personName.slice(0, 16) + '...' : p.personName,
    fullName: p.personName,
    totalDefectsSum: p.totalDefectsSum,
    defectiveAuditsCount: p.defectiveAuditsCount,
    totalAuditsCount: p.totalAuditsCount,
    defectPercentage: p.defectPercentage,
    auditIds: p.auditIds,
    color: palette.pieColors[idx % palette.pieColors.length]
  })).slice(0, 10);

  const handleSetPersonnelView = (type: PersonnelChartType) => {
    if (onUpdateChartSettings) {
      onUpdateChartSettings({ ...chartSettings, personnelRankingChart: type });
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              رتبه‌بندی ۱۰ نفر دارای بیشترین خطا به تفکیک مسئولیت
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            محاسبه هوشمند بر اساس مجموع خطاهای ثبتی، پروانه‌های دارای نقص و درصد خطای فردی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Chart Type Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => handleSetPersonnelView('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                personnelView === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمای جدول رتبه‌بندی"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPersonnelView('barHorizontal')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                personnelView === 'barHorizontal'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار میله‌ای افقی"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPersonnelView('bar')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                personnelView === 'bar'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار ستونی عمودی"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPersonnelView('line')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                personnelView === 'line'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار خطی"
            >
              <LineIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleSetPersonnelView('pie')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                personnelView === 'pie'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
              title="نمودار دایره‌ای سهم خطا"
            >
              <PieIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Role Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl">
            <button
              onClick={() => setActiveRoleTab('areaResponsible')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeRoleTab === 'areaResponsible'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              مسئول محوطه ({topAreaResponsibleCount})
            </button>
            <button
              onClick={() => setActiveRoleTab('seniorShiftSupervisor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeRoleTab === 'seniorShiftSupervisor'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              کشیک ارشد ({topSupervisorsCount})
            </button>
            <button
              onClick={() => setActiveRoleTab('workPerformer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeRoleTab === 'workPerformer'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              مجری کار ({topPerformersCount})
            </button>
            <button
              onClick={() => setActiveRoleTab('safetyUnitSigner')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeRoleTab === 'safetyUnitSigner'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              واحد ایمنی ({topSafetyUnitCount})
            </button>
          </div>
        </div>
      </div>

      {activeTopPersonnel.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs">
          هیچ رکوردی برای این نقش در فیلترهای انتخابی یافت نشد.
        </div>
      ) : personnelView === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                <th className="py-3 px-3 w-12 text-center">رتبه</th>
                <th className="py-3 px-3">نام و عنوان فرد</th>
                <th className="py-3 px-3 text-center">تعداد کل ممیزی‌ها</th>
                <th className="py-3 px-3 text-center">پروانه‌های دارای خطا</th>
                <th className="py-3 px-3 text-center">مجموع خطاها</th>
                <th className="py-3 px-3 text-center">درصد خطای فردی</th>
                <th className="py-3 px-3">شاخص انطباق</th>
                <th className="py-3 px-3 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {activeTopPersonnel.map((person) => {
                const rankColor = 
                  person.rank === 1 ? 'bg-amber-500 text-slate-950 font-black' :
                  person.rank === 2 ? 'bg-slate-300 dark:bg-slate-600 text-slate-900 dark:text-white font-black' :
                  person.rank === 3 ? 'bg-amber-700 text-white font-black' :
                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

                return (
                  <tr 
                    key={person.personName}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono ${rankColor}`}>
                        {person.rank}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                          {person.personName}
                        </div>
                        {person.criticalCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-[10px] font-bold">
                            {person.criticalCount} توقف
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {person.roleTitleFa}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                      {person.totalAuditsCount}
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                      {person.defectiveAuditsCount}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-mono font-black border border-rose-200 dark:border-rose-800">
                        {person.totalDefectsSum} نقص
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                      {person.defectPercentage}%
                    </td>

                    <td className="py-3.5 px-3 min-w-[130px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-emerald-600 font-bold">{person.complianceRate}% انطباق</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              person.complianceRate >= 95 ? 'bg-emerald-500' :
                              person.complianceRate >= 85 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${person.complianceRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => onOpenDrillDown(
                          `ممیزی‌های پروانه کار: ${person.personName}`,
                          `فهرست تمام ${person.totalAuditsCount} ممیزی ثبت‌شده به نام این فرد در سمت ${person.roleTitleFa}`,
                          person.auditIds
                        )}
                        className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-amber-500 dark:hover:text-slate-950 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>مشاهده رکوردها</span>
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : personnelView === 'barHorizontal' ? (
        <div className="h-80 w-full min-w-0 pt-2">
          <ResponsiveContainer width="100%" height={310} minWidth={0} minHeight={280} debounce={50}>
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
            >
              {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.4} />}
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                width={120}
              />
              <Tooltip 
                formatter={(val: any, name: any) => [
                  name === 'totalDefectsSum' ? `${val} نقص ثبت‌شده` : `${val} پروانه دارای نقص`,
                  name === 'totalDefectsSum' ? 'مجموع کل خطاها' : 'تعداد پروانه‌های دارای خطا'
                ]}
                labelFormatter={(label, payload) => {
                  const item = payload && payload[0] ? (payload[0].payload as any) : null;
                  return item ? item.fullName : label;
                }}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
              />
              <Bar 
                dataKey="totalDefectsSum" 
                name="totalDefectsSum" 
                fill={palette.secondary} 
                radius={[0, 6, 6, 0]} 
                isAnimationActive={chartSettings.enableAnimation}
              >
                {chartSettings.showDataLabels && (
                  <LabelList dataKey="totalDefectsSum" position="right" fill="#e11d48" fontSize={11} fontWeight="bold" />
                )}
              </Bar>
              <Bar 
                dataKey="defectiveAuditsCount" 
                name="defectiveAuditsCount" 
                fill={palette.warning} 
                radius={[0, 6, 6, 0]} 
                isAnimationActive={chartSettings.enableAnimation}
              >
                {chartSettings.showDataLabels && (
                  <LabelList dataKey="defectiveAuditsCount" position="right" fill="#d97706" fontSize={11} fontWeight="bold" />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : personnelView === 'bar' ? (
        <div className="h-80 w-full min-w-0 pt-2">
          <ResponsiveContainer width="100%" height={310} minWidth={0} minHeight={280} debounce={50}>
            <BarChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 25 }}>
              {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.4} />}
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                formatter={(val: any, name: any) => [
                  name === 'totalDefectsSum' ? `${val} نقص ثبت‌شده` : `${val} پروانه دارای نقص`,
                  name === 'totalDefectsSum' ? 'مجموع کل خطاها' : 'تعداد پروانه‌های دارای خطا'
                ]}
                labelFormatter={(label, payload) => {
                  const item = payload && payload[0] ? (payload[0].payload as any) : null;
                  return item ? item.fullName : label;
                }}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
              />
              <Bar 
                dataKey="totalDefectsSum" 
                name="totalDefectsSum" 
                fill={palette.secondary} 
                radius={[6, 6, 0, 0]} 
                maxBarSize={38}
                isAnimationActive={chartSettings.enableAnimation}
              >
                {chartSettings.showDataLabels && (
                  <LabelList dataKey="totalDefectsSum" position="top" fill="#e11d48" fontSize={11} fontWeight="bold" />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : personnelView === 'line' ? (
        <div className="h-80 w-full min-w-0 pt-2">
          <ResponsiveContainer width="100%" height={310} minWidth={0} minHeight={280} debounce={50}>
            <LineChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
              {chartSettings.showGrid && <CartesianGrid strokeDasharray="3 3" opacity={0.4} />}
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                formatter={(val: any, name: any) => [
                  name === 'totalDefectsSum' ? `${val} نقص ثبت‌شده` : `${val} پروانه دارای نقص`,
                  name === 'totalDefectsSum' ? 'مجموع کل خطاها' : 'تعداد پروانه‌های دارای خطا'
                ]}
                labelFormatter={(label, payload) => {
                  const item = payload && payload[0] ? (payload[0].payload as any) : null;
                  return item ? item.fullName : label;
                }}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
              />
              <Line 
                type="monotone" 
                dataKey="totalDefectsSum" 
                stroke={palette.secondary} 
                strokeWidth={3} 
                dot={{ r: 5 }} 
                isAnimationActive={chartSettings.enableAnimation}
              >
                {chartSettings.showDataLabels && (
                  <LabelList dataKey="totalDefectsSum" position="top" fill={palette.secondary} fontSize={11} fontWeight="bold" />
                )}
              </Line>
              <Line 
                type="monotone" 
                dataKey="defectiveAuditsCount" 
                stroke={palette.warning} 
                strokeWidth={2.5} 
                dot={{ r: 4 }} 
                isAnimationActive={chartSettings.enableAnimation}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-80 w-full min-w-0 pt-2">
          <ResponsiveContainer width="100%" height={310} minWidth={0} minHeight={280} debounce={50}>
            <PieChart>
              <Tooltip 
                formatter={(val: any, name: any) => [`${val} نقص ثبت‌شده`, name]}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px', direction: 'rtl' }}
              />
              <Pie
                data={chartData.filter(d => d.totalDefectsSum > 0)}
                dataKey="totalDefectsSum"
                nameKey="fullName"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                isAnimationActive={chartSettings.enableAnimation}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-person-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
