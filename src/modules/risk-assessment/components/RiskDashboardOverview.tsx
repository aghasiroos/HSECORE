import React from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Flame, 
  BrainCircuit,
  TrendingUp, 
  FileCheck,
  Activity,
  Plus,
  ArrowLeft,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  Printer,
  Eye,
  Edit3,
  Trash2
} from 'lucide-react';
import { AnyRiskAssessment, RiskMethod, RiskLevel } from '../types';
import { 
  getRiskLevelColor, 
  getMethodMeta, 
  getDistinctMethods 
} from '../services/riskAssessmentService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface RiskDashboardOverviewProps {
  assessments: AnyRiskAssessment[];
  isFa: boolean;
  onSelectMethod: (method: RiskMethod) => void;
  onNewAssessment: (method?: RiskMethod) => void;
  onViewAssessment: (assessment: AnyRiskAssessment) => void;
  onPrintAssessment?: (assessment: AnyRiskAssessment) => void;
  onEditAssessment?: (assessment: AnyRiskAssessment) => void;
  onDeleteAssessment?: (assessment: AnyRiskAssessment) => void;
}

export default function RiskDashboardOverview({
  assessments,
  isFa,
  onSelectMethod,
  onNewAssessment,
  onViewAssessment,
  onPrintAssessment,
  onEditAssessment,
  onDeleteAssessment
}: RiskDashboardOverviewProps) {
  // 1. Calculate Key Metrics
  const totalCount = assessments.length;
  const criticalCount = assessments.filter(a => a.overallRiskLevel === 'CRITICAL').length;
  const highCount = assessments.filter(a => a.overallRiskLevel === 'HIGH').length;
  const mediumCount = assessments.filter(a => a.overallRiskLevel === 'MEDIUM').length;
  const lowCount = assessments.filter(a => a.overallRiskLevel === 'LOW').length;

  const approvedCount = assessments.filter(a => a.status === 'APPROVED').length;
  const underReviewCount = assessments.filter(a => a.status === 'UNDER_REVIEW').length;
  const draftCount = assessments.filter(a => a.status === 'DRAFT').length;

  // Chart: Risk Levels Distribution
  const riskPieData = [
    { name: isFa ? 'بحرانی (Critical)' : 'Critical', value: criticalCount, color: '#ef4444' },
    { name: isFa ? 'بالا (High)' : 'High', value: highCount, color: '#f59e0b' },
    { name: isFa ? 'متوسط (Medium)' : 'Medium', value: mediumCount, color: '#eab308' },
    { name: isFa ? 'پایین (Low)' : 'Low', value: lowCount, color: '#10b981' }
  ].filter(d => d.value > 0);

  // 2. Dynamic Methods Aggregation
  // Automatically extract all distinct methods present in the system or records
  const allDistinctMethods = getDistinctMethods(assessments);

  // Aggregate stats per method dynamically
  const methodStatsMap: Record<string, {
    method: string;
    total: number;
    critical: number;
    high: number;
    approved: number;
    lastDate?: string;
    meta: ReturnType<typeof getMethodMeta>;
  }> = {};

  allDistinctMethods.forEach(methodKey => {
    methodStatsMap[methodKey] = {
      method: methodKey,
      total: 0,
      critical: 0,
      high: 0,
      approved: 0,
      lastDate: undefined,
      meta: getMethodMeta(methodKey)
    };
  });

  // Populate from real assessment items
  assessments.forEach(a => {
    const key = (a.method || 'JSA').toUpperCase();
    if (!methodStatsMap[key]) {
      methodStatsMap[key] = {
        method: key,
        total: 0,
        critical: 0,
        high: 0,
        approved: 0,
        lastDate: undefined,
        meta: getMethodMeta(key)
      };
    }
    methodStatsMap[key].total += 1;
    if (a.overallRiskLevel === 'CRITICAL') methodStatsMap[key].critical += 1;
    if (a.overallRiskLevel === 'HIGH') methodStatsMap[key].high += 1;
    if (a.status === 'APPROVED') methodStatsMap[key].approved += 1;
    if (!methodStatsMap[key].lastDate || (a.assessmentDate && a.assessmentDate > (methodStatsMap[key].lastDate || ''))) {
      methodStatsMap[key].lastDate = a.assessmentDate;
    }
  });

  // Dynamic Bar Chart Data
  const dynamicMethodBarData = Object.values(methodStatsMap)
    .filter(item => item.total > 0 || ['JSA', 'FMEA', 'FTA', 'HHA'].includes(item.method))
    .map(item => ({
      name: item.method,
      total: item.total,
      critical: item.critical,
      high: item.high,
      titleFa: item.meta.titleFa,
      color: item.meta.chartColor
    }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'کل ارزیابی‌های ثبت‌شده' : 'Total Assessments'}
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {totalCount}
            </h3>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {approvedCount} {isFa ? 'مورد مصوب و نهایی' : 'Approved'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-red-200 dark:border-red-900/40 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
              {isFa ? 'ریسک‌های سطح بحرانی' : 'Critical Risks'}
            </p>
            <h3 className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
              {criticalCount}
            </h3>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 inline-block">
              {isFa ? 'نیازمند اقدام فوری مهندسی' : 'Immediate action required'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center font-black animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
              {isFa ? 'ریسک‌های بالا و نامطلوب' : 'High Risks'}
            </p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {highCount}
            </h3>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 inline-block">
              {isFa ? 'پایش کنترلی و تدابیر اداری' : 'Administrative & PPE controls'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'در انتظار بررسی و پیش‌نویس' : 'Under Review / Draft'}
            </p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">
              {underReviewCount + draftCount}
            </h3>
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {underReviewCount} {isFa ? 'در کارتابل تصویب' : 'Pending approval'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
            <FileCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Dynamic Charts Section (Automatically adapts to any added method) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk Level Distribution Pie */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {isFa ? 'پراکندگی سطوح کلی ریسک در سازمان' : 'Risk Level Distribution'}
            </h4>
            <div className="h-52 w-full min-w-0 flex items-center justify-center">
              {riskPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={205} minWidth={0} minHeight={200} debounce={50}>
                  <PieChart>
                    <Pie
                      data={riskPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {riskPieData.map((entry, index) => (
                        <Cell key={`pie-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs font-bold text-slate-400">{isFa ? 'اطلاعاتی ثبت نشده است' : 'No data recorded'}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {riskPieData.map(item => (
              <div key={item.name} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate">{item.name}:</span>
                <span className="font-black text-slate-800 dark:text-slate-100">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Methodology Distribution Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {isFa ? 'توزیع پویا و جامع بر اساس متدولوژی‌های ارزیابی ریسک' : 'Dynamic Risk Assessments by Methodology'}
              </h4>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                {dynamicMethodBarData.length} {isFa ? 'روش فعال' : 'Active Methods'}
              </span>
            </div>
            <div className="h-52 w-full min-w-0">
              <ResponsiveContainer width="100%" height={205} minWidth={0} minHeight={200} debounce={50}>
                <BarChart data={dynamicMethodBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                    formatter={(val: any, name: any) => [
                      val, 
                      name === 'critical' ? (isFa ? 'ریسک بحرانی' : 'Critical') : (isFa ? 'تعداد پرونده' : 'Records')
                    ]}
                    labelFormatter={(label) => {
                      const meta = getMethodMeta(String(label));
                      return isFa ? `${label} - ${meta.titleFa}` : `${label} - ${meta.titleEn}`;
                    }}
                  />
                  <Bar dataKey="total" name="total" fill="#6366f1" radius={[6, 6, 0, 0]}>
                    {dynamicMethodBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-500">
            {dynamicMethodBarData.map(item => (
              <span key={item.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.name}:</span>
                <span className="font-black text-slate-700 dark:text-slate-200">{item.total}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dynamic Methodologies Summary Table (Auto-Expands on new methods) ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {isFa ? 'جدول تجمیعی وضعیت روش‌های ارزیابی ریسک در سامانه' : 'Methodologies Status & Execution Summary'}
          </h4>
          <span className="text-[11px] font-bold text-slate-400">
            {isFa ? 'به‌روزرسانی و تطبیق خودکار با تمام روش‌های ثبت‌شده' : 'Auto-synced with all registered methods'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 font-bold whitespace-nowrap">{isFa ? 'روش / متدولوژی' : 'Methodology'}</th>
                <th className="p-3 font-bold">{isFa ? 'عنوان و شرح کاربرد' : 'Application Scope'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'تعداد پرونده' : 'Total Records'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'ریسک بحرانی' : 'Critical'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'مصوب' : 'Approved'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'آخرین ارزیابی' : 'Last Date'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'دسترسی سریع' : 'Quick Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {Object.values(methodStatsMap).map(item => {
                return (
                  <tr 
                    key={item.method}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-3 whitespace-nowrap">
                      <span 
                        onClick={() => onSelectMethod(item.method as RiskMethod)}
                        className="font-mono font-black text-xs px-2.5 py-1 rounded-lg text-white cursor-pointer hover:opacity-90 inline-block shadow-xs"
                        style={{ backgroundColor: item.meta.chartColor }}
                      >
                        {item.method}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      <div>{isFa ? item.meta.titleFa : item.meta.titleEn}</div>
                      <div className="text-[10px] font-normal text-slate-400 truncate max-w-sm mt-0.5">
                        {isFa ? item.meta.descFa : item.meta.titleEn}
                      </div>
                    </td>
                    <td className="p-3 text-center font-black text-slate-800 dark:text-slate-100">
                      {item.total}
                    </td>
                    <td className="p-3 text-center">
                      {item.critical > 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                          {item.critical} {isFa ? 'مورد' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                      {item.approved}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-500 text-center whitespace-nowrap" dir="ltr">
                      {item.lastDate || (isFa ? 'هنوز ثبت نشده' : 'No records')}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => onSelectMethod(item.method as RiskMethod)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg transition text-[11px]"
                        >
                          {isFa ? 'مشاهده کارتابل' : 'View Records'}
                        </button>
                        <button
                          onClick={() => onNewAssessment(item.method as RiskMethod)}
                          className="p-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition"
                          title={isFa ? 'ثبت ارزیابی جدید' : 'New Assessment'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </div>

      {/* ── Latest Assessments List ── */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-blue-600" />
            {isFa ? 'آخرین ارزیابی‌های ریسک ثبت‌شده در سامانه' : 'Latest Risk Assessments'}
          </h4>
          <button
            onClick={() => onNewAssessment()}
            className="text-xs font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            {isFa ? '+ ثبت ارزیابی جدید' : '+ New Assessment'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="p-3 font-bold whitespace-nowrap">{isFa ? 'کد سند' : 'Doc Code'}</th>
                <th className="p-3 font-bold min-w-[200px]">{isFa ? 'عنوان ارزیابی' : 'Title'}</th>
                <th className="p-3 font-bold whitespace-nowrap text-center">{isFa ? 'متدولوژی' : 'Method'}</th>
                <th className="p-3 font-bold min-w-[170px]">{isFa ? 'واحد / موقعیت' : 'Unit / Location'}</th>
                <th className="p-3 font-bold whitespace-nowrap text-center">{isFa ? 'تاریخ' : 'Date'}</th>
                <th className="p-3 font-bold min-w-[130px]">{isFa ? 'ارزیاب' : 'Assessor'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'سطح ریسک' : 'Risk Level'}</th>
                <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'عملیات' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {assessments.slice(0, 8).map(item => {
                const colors = getRiskLevelColor(item.overallRiskLevel);
                const methodMeta = getMethodMeta(item.method);
                return (
                  <tr 
                    key={item.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => onViewAssessment(item)}
                  >
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 inline-block px-2 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-[11px]" dir="ltr">
                        {item.code}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200 max-w-xs">
                      {item.title}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span 
                        className="px-2 py-0.5 rounded-md text-[10px] font-black text-white"
                        style={{ backgroundColor: methodMeta.chartColor }}
                      >
                        {item.method}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {item.unit} - {item.areaLocation}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px] text-center whitespace-nowrap" dir="ltr">
                      {item.assessmentDate}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                      {item.assessorName}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-black whitespace-nowrap ${colors.badge}`}>
                        {isFa ? colors.labelFa : colors.labelEn}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onPrintAssessment) {
                              onPrintAssessment(item);
                            } else {
                              onViewAssessment(item);
                            }
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 text-[11px] cursor-pointer"
                          title={isFa ? 'مشاهده و چاپ استاندارد' : 'View & Print'}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isFa ? 'مشاهده و چاپ' : 'Print'}</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onEditAssessment) {
                              onEditAssessment(item);
                            } else {
                              onViewAssessment(item);
                            }
                          }}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg transition cursor-pointer"
                          title={isFa ? 'ویرایش سند' : 'Edit'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {onDeleteAssessment && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteAssessment(item);
                            }}
                            className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-500 hover:text-red-700 dark:text-red-400 rounded-lg transition cursor-pointer"
                            title={isFa ? 'حذف سند' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </div>
    </div>
  );
}
