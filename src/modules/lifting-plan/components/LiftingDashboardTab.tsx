import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpLeft,
  CheckCircle2,
  Compass,
  Edit3,
  FileText,
  Layers,
  Plus,
  ShieldAlert,
  Trash2,
  Truck,
  Wrench,
} from 'lucide-react';
import { LIFT_CATEGORY_LABELS, WORKFLOW_STAGE_LABELS, isPlanDeletable } from '../constants';
import StatusBadge from './StatusBadge';
import type {
  LiftingCrane,
  LiftingIntegrationContext,
  LiftingPlanRecord,
  LiftingSubTab,
  RiggingEquipmentItem,
} from '../types';

interface Props {
  plans: LiftingPlanRecord[];
  cranes: LiftingCrane[];
  rigging: RiggingEquipmentItem[];
  integration: LiftingIntegrationContext | null;
  selectedPlanId: number | null;
  canWrite: boolean;
  canDelete: boolean;
  onSelectPlan: (id: number) => void;
  onNavigateTab: (tab: LiftingSubTab) => void;
  onCreateNewPlan: () => void;
  onEditPlan: (plan: LiftingPlanRecord) => void;
  onDeletePlan: (plan: LiftingPlanRecord) => void;
}

export default function LiftingDashboardTab({
  plans,
  cranes,
  rigging,
  integration,
  selectedPlanId,
  canWrite,
  canDelete,
  onSelectPlan,
  onNavigateTab,
  onCreateNewPlan,
  onEditPlan,
  onDeletePlan,
}: Props) {
  const totalPlans = plans.length;
  const approvedPlans = plans.filter((p) => ['APPROVED', 'ACTIVE_EXECUTION'].includes(p.status)).length;
  const reapprovalPlans = plans.filter((p) => p.requiresReapproval || p.status === 'REAPPROVAL_REQUIRED').length;
  const criticalPlans = plans.filter((p) =>
    ['CRITICAL', 'HEAVY', 'TANDEM', 'BLIND', 'LIFT_AND_TURN'].includes(p.liftCategory)
  ).length;
  const failedCalcs = plans.filter((p) => p.engineeringStatus === 'FAIL').length;

  const expiredCranes = cranes.filter((c) => c.certExpiryState === 'EXPIRED' || c.status !== 'ACTIVE');
  const expiredRigging = rigging.filter(
    (r) => r.certExpiryState === 'EXPIRED' || r.conditionStatus !== 'SERVICEABLE' || !r.safetyLatchOk
  );
  const pendingApprovalPlans = plans.filter((p) =>
    ['UNDER_REVIEW', 'REAPPROVAL_REQUIRED', 'DRAFT'].includes(p.status)
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || null;

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('plans')}
          className="text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>کل طرح‌های باربرداری</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">{totalPlans}</div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {criticalPlans} عملیات حساس / ویژه
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('workflow')}
          className="text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>تأییدشده و فعال</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
            {approvedPlans}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {reapprovalPlans > 0 ? `${reapprovalPlans} نیازمند بازتأیید` : 'بدون بازنگری معوق'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('engineering')}
          className="text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>خطای محاسباتی (FAIL)</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-red-700 dark:text-red-400 tabular-nums">
            {failedCalcs}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            انسداد خودکار دروازه تأییدیه
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('cranes')}
          className="text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>ناوگان جرثقیل‌ها</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {cranes.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {expiredCranes.length} مورد نیازمند تمدید گواهی
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('rigging')}
          className="text-right bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl p-4 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>بانک تجهیزات Rigging</span>
            <Wrench className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {rigging.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {expiredRigging.length} مورد معیوب / منقضی
          </div>
        </button>
      </div>

      {/* Main Split: Live Plans Table + Operational Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left 2 cols: Recent & Active Plans Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  پایش زنده طرح‌های باربرداری و وضعیت انطباق مهندسی
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  انتخاب هر طرح، محیط محاسبات سه‌بعدی، گردش کار و گزارش مهندسی را همگام می‌کند.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab('plans')}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>همه طرح‌ها</span>
                  <ArrowUpLeft className="w-3.5 h-3.5" />
                </button>
                {canWrite && (
                  <button
                    type="button"
                    onClick={onCreateNewPlan}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ثبت طرح جدید</span>
                  </button>
                )}
              </div>
            </div>

            {plans.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Compass className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  هنوز هیچ طرح باربرداری در پایگاه داده ثبت نشده است
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  ابتدا از بخش «بانک جرثقیل‌ها و Load Chart» ناوگان و جدول بار را ثبت کنید، سپس اولین طرح باربرداری را ایجاد نمایید.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('cranes')}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    تعریف جرثقیل و Load Chart
                  </button>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={onCreateNewPlan}
                      className="px-3.5 py-2 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 cursor-pointer"
                    >
                      ایجاد اولین طرح باربرداری
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-2 font-bold">کد / نسخه</th>
                      <th className="py-2.5 px-2 font-bold">عنوان عملیات و بار</th>
                      <th className="py-2.5 px-2 font-bold">نوع</th>
                      <th className="py-2.5 px-2 font-bold">وزن خالص</th>
                      <th className="py-2.5 px-2 font-bold">وضعیت مهندسی</th>
                      <th className="py-2.5 px-2 font-bold">مرحله گردش کار</th>
                      <th className="py-2.5 px-2 font-bold text-left">اقدامات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {plans.slice(0, 8).map((p) => {
                      const isSel = selectedPlan?.id === p.id;
                      const catMeta = LIFT_CATEGORY_LABELS[p.liftCategory];
                      const stageFa = WORKFLOW_STAGE_LABELS[p.workflowStage] || p.workflowStage;
                      const deletable = canDelete && isPlanDeletable(p.status);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => onSelectPlan(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-sky-50/80 dark:bg-sky-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                          }`}
                        >
                          <td className="py-2.5 px-2 font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {p.planCode} <span className="text-slate-400">R{p.revisionNumber}</span>
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="font-bold text-slate-900 dark:text-white">{p.title}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {p.unitName} · {p.loadName}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {catMeta?.labelFa || p.liftCategory}
                          </td>
                          <td className="py-2.5 px-2 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {p.netLoadWeightTon} t
                          </td>
                          <td className="py-2.5 px-2">
                            <StatusBadge status={p.engineeringStatus} size="sm" />
                          </td>
                          <td className="py-2.5 px-2 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {stageFa}
                            {p.requiresReapproval && (
                              <span className="block text-amber-600 dark:text-amber-400 font-bold">
                                نیازمند بازتأیید
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectPlan(p.id);
                                  onNavigateTab('engineering');
                                }}
                                className="text-sky-600 hover:underline font-bold whitespace-nowrap cursor-pointer px-1.5 py-1"
                              >
                                محاسبه و 3D
                              </button>
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() => onEditPlan(p)}
                                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                                  title="ویرایش طرح"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {deletable && (
                                <button
                                  type="button"
                                  onClick={() => onDeletePlan(p)}
                                  className="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                                  title="حذف طرح باربرداری"
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
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Expiries, Blockers & Integration Health */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <div className="pb-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">هشدارهای گواهینامه و آمادگی</h3>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                <span>گواهینامه جرثقیل‌ها و ادوات Rigging</span>
                <span className="font-mono tabular-nums text-red-600 dark:text-red-400">
                  {expiredCranes.length + expiredRigging.length} هشدار
                </span>
              </div>
              {expiredCranes.length + expiredRigging.length === 0 ? (
                <p className="text-[11px] text-slate-500">همه تجهیزات ثبت‌شده دارای وضعیت عملیاتی معتبر هستند.</p>
              ) : (
                <ul className="space-y-1 text-[11px] text-red-700 dark:text-red-400">
                  {expiredCranes.slice(0, 3).map((c) => (
                    <li key={`cr-${c.id}`}>• جرثقیل {c.name} ({c.craneCode}): {c.certExpiryState}</li>
                  ))}
                  {expiredRigging.slice(0, 3).map((r) => (
                    <li key={`rg-${r.id}`}>• تجهیز {r.name} ({r.assetCode}): {r.conditionStatus} / {r.certExpiryState}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex justify-between">
                <span>طرح‌های در انتظار تأیید / اقدام</span>
                <span className="font-mono tabular-nums text-sky-600">{pendingApprovalPlans.length} مورد</span>
              </div>
              {pendingApprovalPlans.length === 0 ? (
                <p className="text-[11px] text-slate-500">صف بررسی و تأیید خالی است.</p>
              ) : (
                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  {pendingApprovalPlans.slice(0, 4).map((p) => (
                    <li key={`pa-${p.id}`} className="flex justify-between gap-2">
                      <span className="truncate">{p.planCode} - {p.title}</span>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPlan(p.id);
                          onNavigateTab('workflow');
                        }}
                        className="text-sky-600 hover:underline font-bold shrink-0 cursor-pointer"
                      >
                        بررسی
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-800 dark:text-slate-200">اتصال زنده به بانک اطلاعات HSECORE</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums pt-1">
                <div>پرسنل کل: {integration?.personnel.length ?? '—'}</div>
                <div>پیمانکاران: {integration?.contractors.length ?? '—'}</div>
                <div>ارزیابی‌های JSA: {integration?.riskAssessments.length ?? '—'}</div>
                <div>پروانه‌های PTW: {integration?.workPermits.length ?? '—'}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigateTab('engineering')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-sky-600" />
                <span>محاسبات مهندسی و 3D</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('reports')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>گزارش مهندسی PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
