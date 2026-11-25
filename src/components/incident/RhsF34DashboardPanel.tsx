import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Filter,
  ShieldAlert,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { SafetyIncidentRecord, UserProfile } from '../../types';
import {
  calculateDeadlineInfo,
  getSupplementaryFormByIncidentId,
  parseJalaliDateString,
} from '../../utils/incidentSupplementaryHelper';
import { toPersianDigits } from '../../utils/jalaliDate';
import PersianDatePicker from '../common/PersianDatePicker';

interface RhsF34DashboardPanelProps {
  incidents: SafetyIncidentRecord[];
  currentUser: UserProfile;
  onOpenSupplementary: (incident: SafetyIncidentRecord) => void;
  onSelectIncident: (incident: SafetyIncidentRecord) => void;
  isFa?: boolean;
}

type ComplianceFilter = 'ALL' | 'COMPLETED' | 'PENDING' | 'NEAR_DEADLINE' | 'OVERDUE';

function toComparableDateNum(dateStr?: string): number | null {
  const p = parseJalaliDateString(dateStr);
  if (!p) return null;
  return p.year * 10000 + p.month * 100 + p.day;
}

export const RhsF34DashboardPanel: React.FC<RhsF34DashboardPanelProps> = ({
  incidents,
  currentUser,
  onOpenSupplementary,
  onSelectIncident,
  isFa = true,
}) => {
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<ComplianceFilter>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const analysisRows = useMemo(() => {
    return incidents
      .filter(
        (inc) =>
          Boolean(inc.supplementaryForm) ||
          inc.formVariant === 'RHS-F28' ||
          inc.category === 'Incident'
      )
      .filter((inc) => Boolean(inc.supplementaryForm) || inc.workflowStage === 'CLOSED')
      .map((inc) => {
        const form = getSupplementaryFormByIncidentId(inc.id, inc, currentUser);
        const anchor =
          form.f28FinalApprovedDate ||
          form.startDate ||
          inc.rhsF28?.hseCenterHeadSignedDate ||
          inc.reportDate ||
          inc.eventDate;
        const dl = calculateDeadlineInfo(anchor, form.status);
        const isCompleted = form.status === 'completed' || form.workflowStage === 'COMPLETED';
        const isOverdue = !isCompleted && (form.isExpired || dl.isExpired);
        const isNearDeadline = !isCompleted && !isOverdue && (form.isNearDeadline || dl.isNearDeadline);
        const isPending = !isCompleted;

        return {
          incident: inc,
          form,
          anchorDate: anchor,
          deadlineDate: form.deadlineDate || dl.deadlineDate,
          daysRemaining: dl.daysRemaining,
          daysPassed: dl.daysPassed,
          isCompleted,
          isOverdue,
          isNearDeadline,
          isPending,
          unit: inc.department || form.victimOrgUnit || inc.locationSite || 'نامشخص',
          owner:
            form.assignedExpertName ||
            form.hseExpertName ||
            form.nonConformanceAssignedToName ||
            'تعیین‌نشده',
          incidentTypeLabel:
            inc.categoryFa || (inc.formVariant === 'RHS-F28' ? 'حادثه / رویداد (RHS-F28)' : inc.category || 'حادثه'),
          severityLabel: form.riskSeverityMatrix || inc.severity || 'تعیین‌نشده',
        };
      });
  }, [incidents, currentUser]);

  const filterOptions = useMemo(() => {
    const units = Array.from(new Set(analysisRows.map((r) => r.unit).filter(Boolean)));
    const types = Array.from(new Set(analysisRows.map((r) => r.incidentTypeLabel).filter(Boolean)));
    const owners = Array.from(new Set(analysisRows.map((r) => r.owner).filter(Boolean)));
    return { units, types, owners };
  }, [analysisRows]);

  const filteredRows = useMemo(() => {
    const fromNum = toComparableDateNum(fromDate);
    const toNum = toComparableDateNum(toDate);

    return analysisRows.filter((row) => {
      if (unitFilter !== 'ALL' && row.unit !== unitFilter) return false;
      if (incidentTypeFilter !== 'ALL' && row.incidentTypeLabel !== incidentTypeFilter) return false;
      if (ownerFilter !== 'ALL' && row.owner !== ownerFilter) return false;
      if (statusFilter === 'COMPLETED' && !row.isCompleted) return false;
      if (statusFilter === 'PENDING' && !row.isPending) return false;
      if (statusFilter === 'NEAR_DEADLINE' && !row.isNearDeadline) return false;
      if (statusFilter === 'OVERDUE' && !row.isOverdue) return false;

      if (fromNum || toNum) {
        const rowNum = toComparableDateNum(row.anchorDate || row.incident.eventDate);
        if (!rowNum) return false;
        if (fromNum && rowNum < fromNum) return false;
        if (toNum && rowNum > toNum) return false;
      }
      return true;
    });
  }, [analysisRows, unitFilter, incidentTypeFilter, ownerFilter, statusFilter, fromDate, toDate]);

  const metrics = useMemo(() => {
    const completed = filteredRows.filter((r) => r.isCompleted).length;
    const pending = filteredRows.filter((r) => r.isPending).length;
    const nearDeadline = filteredRows.filter((r) => r.isNearDeadline).length;
    const overdue = filteredRows.filter((r) => r.isOverdue).length;
    const autoNcCount = filteredRows.filter((r) => Boolean(r.form.nonConformanceId)).length;
    return {
      total: filteredRows.length,
      completed,
      pending,
      nearDeadline,
      overdue,
      autoNcCount,
    };
  }, [filteredRows]);

  const resetFilters = () => {
    setUnitFilter('ALL');
    setIncidentTypeFilter('ALL');
    setOwnerFilter('ALL');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters =
    unitFilter !== 'ALL' ||
    incidentTypeFilter !== 'ALL' ||
    ownerFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const fmt = (val?: string | number | null) => {
    if (val === undefined || val === null || val === '') return '—';
    return isFa ? toPersianDigits(String(val)) : String(val);
  };

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>
              {isFa
                ? 'داشبورد کنترلی تجزیه و تحلیل حوادث (RHS-F34) و عدم انطباق‌های تأخیر'
                : 'RHS-F34 Incident Analysis Compliance & Delay Dashboard'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isFa
              ? 'پایش مهلت قانونی ۱۰ روز تقویمی از تاریخ تأیید نهایی گزارش حادثه (RHS-F28) و ثبت خودکار عدم انطباق در صورت عبور از سررسید'
              : '10-calendar-day legal SLA anchored on RHS-F28 final approval date with automatic Non-Conformity escalation'}
          </p>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isFa ? 'بازنشانی فیلترها' : 'Reset Filters'}</span>
          </button>
        )}
      </div>

      {/* KPI Strip — Flat Hairline Cards with Tabular Numerals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
          className={`text-right p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === 'COMPLETED'
              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>تحلیل‌های تکمیل‌شده</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
            {fmt(metrics.completed)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">تأیید نهایی شده توسط رئیس HSE</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`text-right p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>در انتظار تکمیل / تأیید</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-700 dark:text-indigo-400 font-mono tabular-nums">
            {fmt(metrics.pending)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">پرونده‌های فعال RHS-F34</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'NEAR_DEADLINE' ? 'ALL' : 'NEAR_DEADLINE')}
          className={`text-right p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === 'NEAR_DEADLINE'
              ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>نزدیک به سررسید (≤۳ روز)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums">
            {fmt(metrics.nearDeadline)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">نیازمند پیگیری فوری پیش از ثبت NC</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          className={`text-right p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === 'OVERDUE'
              ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>دارای تأخیر / عدم انطباق</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono tabular-nums">
              {fmt(metrics.overdue)}
            </span>
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-300">
              ({fmt(metrics.autoNcCount)} عدم انطباق)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">عبور از مهلت ۱۰ روزه قانونی</div>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            واحد سازمانی
          </label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">همه واحدهای سازمانی</option>
            {filterOptions.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            نوع حادثه / رویداد
          </label>
          <select
            value={incidentTypeFilter}
            onChange={(e) => setIncidentTypeFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">همه انواع حادثه</option>
            {filterOptions.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            مسئول پیگیری / کارشناس HSE
          </label>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">همه مسئولین پیگیری</option>
            {filterOptions.owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            از تاریخ (تأیید RHS-F28)
          </label>
          <PersianDatePicker
            value={fromDate}
            onChange={setFromDate}
            placeholder="1405/01/01"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            تا تاریخ (تأیید RHS-F28)
          </label>
          <PersianDatePicker
            value={toDate}
            onChange={setToDate}
            placeholder="1405/12/29"
            className="w-full"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
        <table className="w-full text-right border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black text-slate-600 dark:text-slate-300">
              <th className="p-3">شماره حادثه / فرم تحلیل</th>
              <th className="p-3">واحد سازمانی</th>
              <th className="p-3">تاریخ تأیید RHS-F28</th>
              <th className="p-3">مهلت قانونی (۱۰ روز)</th>
              <th className="p-3">وضعیت مهلت و گردش کار</th>
              <th className="p-3">مسئول پیگیری</th>
              <th className="p-3">عدم انطباق تأخیر (NC)</th>
              <th className="p-3 text-center">اقدامات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-300" />
                    <span>
                      {analysisRows.length === 0
                        ? 'هنوز هیچ گزارش حادثه RHS-F28 تأیید نهایی نشده است. به محض تأیید نهایی RHS-F28، پرونده RHS-F34 به‌صورت خودکار در اینجا ایجاد و پایش می‌شود.'
                        : 'پرونده تحلیلی مطابق با فیلترهای انتخاب‌شده یافت نشد.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const statusLabel = row.isCompleted
                  ? 'تکمیل و تأیید نهایی'
                  : row.form.workflowStage === 'PENDING_APPROVAL'
                  ? 'در انتظار تأیید رئیس HSE'
                  : row.form.workflowStage === 'RETURNED'
                  ? 'عودت جهت اصلاح'
                  : row.isOverdue
                  ? `دارای ${fmt(Math.abs(row.daysRemaining))} روز تأخیر`
                  : row.isNearDeadline
                  ? `نزدیک به سررسید (${fmt(row.daysRemaining)} روز)`
                  : `در انتظار تکمیل (${fmt(row.daysRemaining)} روز)`;

                const statusTextClass = row.isCompleted
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : row.isOverdue
                  ? 'text-rose-700 dark:text-rose-400'
                  : row.isNearDeadline
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-indigo-700 dark:text-indigo-300';

                return (
                  <tr
                    key={row.incident.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition"
                  >
                    <td className="p-3">
                      <div className="font-mono font-black text-slate-900 dark:text-white tabular-nums">
                        {row.incident.reportNumber}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[220px]">
                        {row.form.formNumber || 'RHS-F34'} · {row.incident.title}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-slate-700 dark:text-slate-200">{row.unit}</td>
                    <td className="p-3 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {fmt(row.anchorDate)}
                    </td>
                    <td className="p-3 font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {fmt(row.deadlineDate)}
                    </td>
                    <td className="p-3">
                      <span className={`font-black ${statusTextClass}`}>{statusLabel}</span>
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-200 font-bold">{row.owner}</td>
                    <td className="p-3">
                      {row.form.nonConformanceTrackingCode ? (
                        <div className="space-y-0.5">
                          <div className="font-mono font-black text-rose-700 dark:text-rose-400 tabular-nums">
                            {row.form.nonConformanceTrackingCode}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {row.form.nonConformanceAssignedToName
                              ? `مسئول: ${row.form.nonConformanceAssignedToName}`
                              : 'در انتظار تعیین مسئول پیگیری'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenSupplementary(row.incident)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[11px] font-black whitespace-nowrap shrink-0 cursor-pointer transition"
                        >
                          {row.isCompleted ? 'مشاهده / چاپ' : 'تکمیل / بررسی'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectIncident(row.incident)}
                          title="مشاهده گزارش اصلی حادثه"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
