import React, { useMemo, useState } from 'react';
import { Calculator, Edit3, History, Layers, Plus, Search, Trash2 } from 'lucide-react';
import {
  LIFT_CATEGORY_LABELS,
  PLAN_STATUS_META,
  WORKFLOW_STAGE_LABELS,
  isPlanDeletable,
} from '../constants';
import StatusBadge from './StatusBadge';
import { liftingApi } from '../services/liftingApi';
import type { LiftingPlanRecord } from '../types';

interface Props {
  plans: LiftingPlanRecord[];
  selectedPlanId: number | null;
  canWrite: boolean;
  canDelete: boolean;
  onSelectPlan: (id: number) => void;
  onNavigateEngineering: (id: number) => void;
  onCreateNewPlan: () => void;
  onEditPlan: (plan: LiftingPlanRecord) => void;
  onDeletePlan: (plan: LiftingPlanRecord) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function LiftingPlansManagerTab({
  plans,
  selectedPlanId,
  canWrite,
  canDelete,
  onSelectPlan,
  onNavigateEngineering,
  onCreateNewPlan,
  onEditPlan,
  onDeletePlan,
  onToast,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [revisionsOpenFor, setRevisionsOpenFor] = useState<number | null>(null);
  const [revisionsData, setRevisionsData] = useState<{ revisions: any[]; calculations: any[] } | null>(null);

  const openRevisions = async (planId: number) => {
    setRevisionsOpenFor(planId);
    setRevisionsData(null);
    try {
      const data = await liftingApi.getPlanRevisionsAndCalcs(planId);
      setRevisionsData(data);
    } catch (err: any) {
      onToast(err?.message || 'خطا در بارگذاری تاریخچه نسخه‌ها', 'error');
    }
  };

  const summaryStats = useMemo(() => {
    return {
      total: plans.length,
      approved: plans.filter((p) => ['APPROVED', 'ACTIVE_EXECUTION'].includes(p.status)).length,
      passCount: plans.filter((p) => p.engineeringStatus === 'PASS').length,
      failCount: plans.filter((p) => p.engineeringStatus === 'FAIL').length,
    };
  }, [plans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      const matchQ =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.planCode.toLowerCase().includes(q) ||
        p.loadName.toLowerCase().includes(q) ||
        (p.contractorName || '').toLowerCase().includes(q) ||
        (p.areaLocation || '').toLowerCase().includes(q);
      const matchS =
        statusFilter === 'ALL' || p.status === statusFilter || p.engineeringStatus === statusFilter;
      const matchC = categoryFilter === 'ALL' || p.liftCategory === categoryFilter;
      return matchQ && matchS && matchC;
    });
  }, [plans, search, statusFilter, categoryFilter]);

  return (
    <div className="space-y-5">
      {/* Compact Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">کل طرح‌های ثبت‌شده</div>
            <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {summaryStats.total}
            </div>
          </div>
          <Layers className="w-5 h-5 text-sky-600" />
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">تأیید نهایی / فعال</div>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
              {summaryStats.approved}
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">آماده اجرا</span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">انطباق مهندسی (PASS)</div>
            <div className="text-xl font-black text-sky-700 dark:text-sky-400 tabular-nums mt-0.5">
              {summaryStats.passCount}
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-500">ASME</span>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">طرح‌های مردود (FAIL)</div>
            <div className="text-xl font-black text-red-700 dark:text-red-400 tabular-nums mt-0.5">
              {summaryStats.failCount}
            </div>
          </div>
          <span className="text-[11px] font-bold text-red-600 dark:text-red-400">نیازمند اصلاح</span>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی کد، عنوان، بار، محل یا پیمانکار..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          >
            <option value="ALL">همه انواع عملیات</option>
            {Object.entries(LIFT_CATEGORY_LABELS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.labelFa}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          >
            <option value="ALL">همه وضعیت‌ها</option>
            <option value="DRAFT">پیش‌نویس</option>
            <option value="UNDER_REVIEW">در حال بررسی</option>
            <option value="REAPPROVAL_REQUIRED">نیازمند بازتأیید</option>
            <option value="APPROVED">تأیید نهایی</option>
            <option value="PASS">محاسبات PASS</option>
            <option value="FAIL">محاسبات FAIL</option>
          </select>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={onCreateNewPlan}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت طرح باربرداری جدید</span>
          </button>
        )}
      </div>

      {/* Plans Master Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        {plans.length === 0 ? (
          <div className="py-14 px-4 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-400 mx-auto" />
            <div className="text-sm font-black text-slate-800 dark:text-slate-100">
              هنوز هیچ طرح باربرداری ثبت نشده است
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              برای شروع، روی دکمه زیر کلیک کنید تا فرم مجزای ثبت طرح باربرداری باز شود.
            </p>
            {canWrite && (
              <button
                type="button"
                onClick={onCreateNewPlan}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ثبت اولین طرح باربرداری</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-3 font-bold">کد / نسخه</th>
                  <th className="py-3 px-3 font-bold">عنوان و موقعیت عملیات</th>
                  <th className="py-3 px-3 font-bold">نوع و پیمانکار</th>
                  <th className="py-3 px-3 font-bold">بار / وزن خالص</th>
                  <th className="py-3 px-3 font-bold">انطباق مهندسی</th>
                  <th className="py-3 px-3 font-bold">مرحله گردش کار</th>
                  <th className="py-3 px-3 font-bold text-left">اقدامات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      طرح باربرداری مطابق جستجو یا فیلتر انتخاب‌شده یافت نشد.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const catMeta = LIFT_CATEGORY_LABELS[p.liftCategory];
                    const statusMeta = PLAN_STATUS_META[p.status] || {
                      labelFa: p.status,
                      cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
                    };
                    const stageFa = WORKFLOW_STAGE_LABELS[p.workflowStage] || p.workflowStage;
                    const deletable = canDelete && isPlanDeletable(p.status);

                    return (
                      <tr
                        key={p.id}
                        onClick={() => onSelectPlan(p.id)}
                        className={`cursor-pointer transition-colors ${
                          selectedPlanId === p.id
                            ? 'bg-sky-50/80 dark:bg-sky-950/25'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                        }`}
                      >
                        <td className="py-3 px-3 font-mono tabular-nums font-bold whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white">{p.planCode}</div>
                          <div className="text-[10px] text-slate-500">نسخه R{p.revisionNumber}</div>
                        </td>
                        <td className="py-3 px-3 min-w-[200px]">
                          <div className="font-bold text-slate-900 dark:text-white">{p.title}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.unitName} · {p.areaLocation}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                              catMeta?.badgeCls || 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {catMeta?.labelFa || p.liftCategory}
                          </span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {p.contractorName || 'اجرای سازمانی'}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums whitespace-nowrap">
                          <div className="font-black text-slate-900 dark:text-white">{p.netLoadWeightTon} t</div>
                          <div className="text-[11px] font-sans text-slate-500">{p.loadName}</div>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={p.engineeringStatus} size="sm" />
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusMeta.cls}`}>
                            {statusMeta.labelFa}
                          </span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{stageFa}</div>
                        </td>
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onNavigateEngineering(p.id)}
                              className="p-1.5 rounded-lg hover:bg-sky-50 dark:hover:bg-sky-950/40 text-sky-700 dark:text-sky-400 cursor-pointer"
                              title="محاسبات مهندسی و نمای 3D"
                            >
                              <Calculator className="w-4 h-4" />
                            </button>
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => onEditPlan(p)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-sky-600 cursor-pointer"
                                title="ویرایش در فرم مجزا"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openRevisions(p.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 cursor-pointer"
                              title="تاریخچه نسخه‌ها و محاسبات"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            {deletable && (
                              <button
                                type="button"
                                onClick={() => onDeletePlan(p)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                                title="حذف طرح باربرداری"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revisions & Server Calc Audit Modal */}
      {revisionsOpenFor && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRevisionsOpenFor(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                تاریخچه بازنگری نسخه‌ها و محاسبات مهندسی
              </h4>
              <button
                type="button"
                onClick={() => setRevisionsOpenFor(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                بستن
              </button>
            </div>
            {!revisionsData ? (
              <p className="text-xs text-slate-500">در حال بارگذاری...</p>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                    نسخه‌های آرشیوشده ({revisionsData.revisions.length})
                  </h5>
                  {revisionsData.revisions.length === 0 ? (
                    <p className="text-slate-500">هنوز بازنگری پس از تصویب ثبت نشده است (نسخه فعلی R1).</p>
                  ) : (
                    <div className="space-y-2">
                      {revisionsData.revisions.map((r) => (
                        <div
                          key={r.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50"
                        >
                          <div className="flex justify-between font-bold">
                            <span>
                              نسخه R{r.revisionNumber} — {r.changeReason}
                            </span>
                            <span className="font-mono text-slate-500">
                              {new Date(r.createdAt).toLocaleString('fa-IR')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            توسط: {r.changedBy} · وضعیت در آن نسخه: {r.statusAtSnapshot} / {r.engineeringStatusAtSnapshot}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                    لاگ اجرای محاسبات سرور ({revisionsData.calculations.length})
                  </h5>
                  <div className="space-y-1.5">
                    {revisionsData.calculations.slice(0, 8).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded border border-slate-200 dark:border-slate-700"
                      >
                        <div>
                          <span className="font-mono font-bold">R{c.revisionNumber}</span> · {c.calculatedBy} ·{' '}
                          <span className="text-slate-500">{new Date(c.createdAt).toLocaleString('fa-IR')}</span>
                        </div>
                        <StatusBadge status={c.overallStatus} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
