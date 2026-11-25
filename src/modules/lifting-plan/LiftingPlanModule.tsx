import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Anchor,
  BookOpen,
  Bot,
  Calculator,
  Check,
  ChevronDown,
  ClipboardCheck,
  EyeOff,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal';
import { LIFTING_DROPDOWN_GROUPS } from './constants';
import { liftingApi } from './services/liftingApi';
import StatusBadge from './components/StatusBadge';
import LiftingDashboardTab from './components/LiftingDashboardTab';
import LiftingPlansManagerTab from './components/LiftingPlansManagerTab';
import LiftingPlanFormModal from './components/LiftingPlanFormModal';
import EngineeringCalcTab from './components/EngineeringCalcTab';
import CranesLoadChartsTab from './components/CranesLoadChartsTab';
import RiggingBankTab from './components/RiggingBankTab';
import SpecialOpsTab from './components/SpecialOpsTab';
import LiftingRiskJsaTab from './components/LiftingRiskJsaTab';
import WorkflowApprovalsTab from './components/WorkflowApprovalsTab';
import ReportsArchiveTab from './components/ReportsArchiveTab';
import IntegratedAssetsCertsTab from './components/IntegratedAssetsCertsTab';
import StandardsSettingsTab from './components/StandardsSettingsTab';
import type {
  LiftingCrane,
  LiftingIntegrationContext,
  LiftingPlanRecord,
  LiftingStageGateRow,
  LiftingStandardConfig,
  LiftingSubTab,
  RiggingEquipmentItem,
} from './types';

interface Props {
  isFa?: boolean;
  currentUser?: any;
}

const SUBTAB_ICONS: Record<LiftingSubTab, React.ComponentType<any>> = {
  dashboard: Activity,
  plans: Layers,
  engineering: Calculator,
  cranes: Truck,
  rigging: Anchor,
  'special-ops': EyeOff,
  'risk-jsa': ShieldAlert,
  workflow: ClipboardCheck,
  reports: FileText,
  'assets-certs': ShieldCheck,
  standards: BookOpen,
};

export default function LiftingPlanModule({ currentUser: _currentUser }: Props) {
  const [activeTab, setActiveTab] = useState<LiftingSubTab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<LiftingPlanRecord[]>([]);
  const [cranes, setCranes] = useState<LiftingCrane[]>([]);
  const [rigging, setRigging] = useState<RiggingEquipmentItem[]>([]);
  const [standards, setStandards] = useState<LiftingStandardConfig[]>([]);
  const [stageGates, setStageGates] = useState<LiftingStageGateRow[]>([]);
  const [engineVersion, setEngineVersion] = useState<string>('2.1.0-core');
  const [permissions, setPermissions] = useState({ canRead: true, canWrite: false, canApprove: false });
  const [integration, setIntegration] = useState<LiftingIntegrationContext | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Separate New/Edit Lifting Plan Form Modal state
  const [formModalState, setFormModalState] = useState<{
    open: boolean;
    editingPlan: LiftingPlanRecord | null;
  }>({ open: false, editingPlan: null });

  // Unified Delete Confirmation Modal state
  const [planToDelete, setPlanToDelete] = useState<LiftingPlanRecord | null>(null);

  // Advisory AI Drawer state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, any> | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Close dropdown on click-outside or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [boot, integ] = await Promise.all([
        liftingApi.getBootstrap(),
        liftingApi.getIntegrationContext(),
      ]);
      setStandards(boot.standards || []);
      setCranes(boot.cranes || []);
      setRigging(boot.riggingEquipment || []);
      setPlans(boot.plans || []);
      setStageGates(boot.stageGates || []);
      if (boot.engineVersion) setEngineVersion(boot.engineVersion);
      setPermissions(boot.permissions || { canRead: true, canWrite: false, canApprove: false });
      setIntegration(integ);

      setSelectedPlanId((prev) => {
        if (prev && (boot.plans || []).some((p) => p.id === prev)) return prev;
        return boot.plans?.[0]?.id ?? null;
      });
    } catch (err: any) {
      showToast(err?.message || 'خطا در بارگذاری اطلاعات ماژول باربرداری', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAll();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleRemoteUpdate = (e?: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('lifting') || entity.includes('crane') || entity.includes('rigging')) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void loadAll();
        }, 250);
      }
    };

    window.addEventListener('hse_lifting_updated', handleRemoteUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteUpdate);
    window.addEventListener('app_data_mutated', handleRemoteUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('hse_lifting_updated', handleRemoteUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteUpdate);
      window.removeEventListener('app_data_mutated', handleRemoteUpdate);
    };
  }, [loadAll]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const activeDropdownItem = useMemo(() => {
    for (const grp of LIFTING_DROPDOWN_GROUPS) {
      const match = grp.items.find((i) => i.key === activeTab);
      if (match) return match;
    }
    return null;
  }, [activeTab]);

  // Sync AI result from saved snapshot when switching plans
  useEffect(() => {
    if (selectedPlan?.aiAnalysisSnapshot && Object.keys(selectedPlan.aiAnalysisSnapshot).length > 0) {
      setAiResult(selectedPlan.aiAnalysisSnapshot);
    } else {
      setAiResult(null);
    }
    setSnapshotDataUrl(null);
  }, [selectedPlan?.id]);

  const handleOpenNewPlan = useCallback(() => {
    setFormModalState({ open: true, editingPlan: null });
  }, []);

  const handleOpenEditPlan = useCallback((plan: LiftingPlanRecord) => {
    setSelectedPlanId(plan.id);
    setFormModalState({ open: true, editingPlan: plan });
  }, []);

  const handlePlanSaved = useCallback(
    async (savedPlan: LiftingPlanRecord, isEdit: boolean, revisionBumped?: boolean) => {
      setSelectedPlanId(savedPlan.id);
      if (isEdit) {
        showToast(
          revisionBumped
            ? `ویرایش ذخیره شد و نسخه طرح به R${savedPlan.revisionNumber} ارتقا یافت (نیازمند بازتأیید).`
            : `تغییرات طرح ${savedPlan.planCode} ذخیره و بازمحاسبه شد.`,
          revisionBumped ? 'info' : 'success'
        );
      } else {
        showToast(`طرح باربرداری ${savedPlan.planCode} ثبت و محاسبه اولیه اجرا شد.`, 'success');
      }
      await loadAll();
    },
    [loadAll, showToast]
  );

  const handleConfirmDeletePlan = useCallback(async () => {
    if (!planToDelete) return;
    const deleted = planToDelete;
    try {
      await liftingApi.deletePlan(deleted.id);
      showToast(`طرح باربرداری ${deleted.planCode} با موفقیت حذف و بایگانی شد.`, 'success');
      if (selectedPlanId === deleted.id) {
        const next = plans.find((p) => p.id !== deleted.id);
        setSelectedPlanId(next?.id ?? null);
      }
      await loadAll();
    } catch (err: any) {
      showToast(err?.message || 'امکان حذف این طرح وجود ندارد.', 'error');
    } finally {
      setPlanToDelete(null);
    }
  }, [planToDelete, selectedPlanId, plans, loadAll, showToast]);

  const handleRunAiAdvisory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPlan) return;
    setAiLoading(true);
    try {
      const res = await liftingApi.analyzeWithAi(selectedPlan.id, aiQuestion.trim() || undefined);
      setAiResult(res);
      showToast('تحلیل مشورتی هوش مصنوعی داخلی HSECORE به‌روزرسانی شد.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'خطا در دریافت تحلیل هوش مصنوعی', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const canDeletePlans = permissions.canWrite || permissions.canApprove;
  const ActiveDropIcon = activeDropdownItem ? SUBTAB_ICONS[activeDropdownItem.key] : Layers;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Engineering Module Header & Navigation */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-600/10 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/70 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
                مدیریت و مهندسی عملیات باربرداری (Lifting Plan Engineering)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                موتور محاسباتی تعادل استاتیکی مطابق ASME B30.5 / P30.1 / B30.9 / B30.26 — یکپارچه با JSA، PTW و پرسنل
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Active Plan Switcher */}
            <select
              value={selectedPlanId ?? ''}
              onChange={(e) => setSelectedPlanId(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-bold max-w-[250px]"
              title="انتخاب طرح باربرداری فعال"
            >
              <option value="">-- بدون طرح فعال ({plans.length} طرح) --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.planCode} (R{p.revisionNumber}) — {p.title}
                </option>
              ))}
            </select>

            {selectedPlan && <StatusBadge status={selectedPlan.engineeringStatus} size="sm" />}

            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              disabled={!selectedPlan}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/30 disabled:opacity-40 font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>مشاوره HSECORE AI</span>
            </button>

            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer shrink-0"
              title="به‌روزرسانی داده‌ها"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Navigation Strip: Direct Dashboard Button + Grouped Dropdown Selector + Primary CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/70">
          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Tab 1: Dashboard */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('dashboard');
                setMenuOpen(false);
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>۱. داشبورد باربرداری</span>
            </button>

            {/* Dropdown Menu for All Other Sub-Modules */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`inline-flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer min-w-[230px] sm:min-w-[270px] ${
                  activeDropdownItem
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 text-sky-800 dark:text-sky-200'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <ActiveDropIcon className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span className="truncate">
                    {activeDropdownItem ? activeDropdownItem.titleFa : 'بخش‌های تخصصی و مهندسی باربرداری'}
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-150 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1.5 w-[min(370px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-40 py-2 max-h-[70vh] overflow-y-auto custom-scrollbar"
                >
                  {LIFTING_DROPDOWN_GROUPS.map((group, gIdx) => (
                    <div
                      key={group.groupTitleFa}
                      className={gIdx > 0 ? 'mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800' : ''}
                    >
                      <div className="px-3.5 py-1 text-[10px] font-black text-slate-400 dark:text-slate-500">
                        {group.groupTitleFa}
                      </div>
                      <div className="space-y-0.5 px-1.5">
                        {group.items.map((item) => {
                          const Icon = SUBTAB_ICONS[item.key];
                          const isSelected = activeTab === item.key;
                          return (
                            <button
                              key={item.key}
                              role="menuitem"
                              type="button"
                              onClick={() => {
                                setActiveTab(item.key);
                                setMenuOpen(false);
                              }}
                              className={`w-full text-right px-2.5 py-2 rounded-lg flex items-start justify-between gap-2.5 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-600 text-white'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <Icon
                                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                                    isSelected ? 'text-white' : 'text-sky-600 dark:text-sky-400'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold leading-snug">{item.titleFa}</div>
                                  <div
                                    className={`text-[10px] leading-snug mt-0.5 ${
                                      isSelected ? 'text-sky-100' : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {item.subtitleFa}
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Global Separate Form CTA */}
          {permissions.canWrite && (
            <button
              type="button"
              onClick={handleOpenNewPlan}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت طرح باربرداری جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Non-blocking Toast Alert */}
      {toast && (
        <div
          className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
            toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
              : toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300'
          }`}
        >
          <span>{toast.msg}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Advisory-Only HSECORE AI Panel */}
      {aiOpen && selectedPlan && (
        <div className="bg-white dark:bg-slate-800 border border-sky-400 dark:border-sky-700 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>دستیار تحلیلی هوشمند HSECORE (صرفاً مشورتی — بدون اختیار تأیید یا صدور مجوز)</span>
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-bold mt-0.5">
                {aiResult?.advisoryOnlyNotice ||
                  'خروجی هوش مصنوعی داخلی صرفاً جنبه کمکی دارد و جایگزین محاسبات قطعی ASME یا امضای مقام مجاز نیست.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiOpen(false)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleRunAiAdvisory} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="سوال مهندسی یا ایمنی درباره این طرح باربرداری بپرسید (مثال: ریسک بحرانی فشار خاک یا زاویه اسلینگ چیست؟)..."
              className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>{aiLoading ? 'در حال تحلیل...' : 'تحلیل طرح با هوش مصنوعی داخلی'}</span>
            </button>
          </form>

          {aiResult && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 whitespace-pre-line leading-relaxed text-slate-800 dark:text-slate-200">
                {aiResult.narrative || 'تحلیلی ثبت نشده است.'}
              </div>
              <div className="lg:col-span-5 space-y-3">
                {Array.isArray(aiResult.missingItems) && aiResult.missingItems.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="font-bold text-amber-800 dark:text-amber-300 mb-1">نواقص مستندات و نفرات:</div>
                    <ul className="list-disc pr-4 space-y-0.5 text-amber-800 dark:text-amber-200">
                      {aiResult.missingItems.map((m: string, idx: number) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {Array.isArray(aiResult.suggestedHazards) && aiResult.suggestedHazards.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">خطرات پیشنهادی برای JSA:</div>
                    <ul className="list-disc pr-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                      {aiResult.suggestedHazards.map((h: string, idx: number) => (
                        <li key={idx}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Sub-View */}
      {loading && plans.length === 0 && cranes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center text-xs text-slate-500">
          در حال بارگذاری زیرسامانه مهندسی باربرداری از PostgreSQL...
        </div>
      ) : (
        <div>
          {activeTab === 'dashboard' && (
            <LiftingDashboardTab
              plans={plans}
              cranes={cranes}
              rigging={rigging}
              integration={integration}
              selectedPlanId={selectedPlanId}
              canWrite={permissions.canWrite}
              canDelete={canDeletePlans}
              onSelectPlan={(id) => {
                setSelectedPlanId(id);
                setActiveTab('engineering');
              }}
              onNavigateTab={(t) => setActiveTab(t)}
              onCreateNewPlan={handleOpenNewPlan}
              onEditPlan={handleOpenEditPlan}
              onDeletePlan={(p) => setPlanToDelete(p)}
            />
          )}

          {activeTab === 'plans' && (
            <LiftingPlansManagerTab
              plans={plans}
              selectedPlanId={selectedPlanId}
              canWrite={permissions.canWrite}
              canDelete={canDeletePlans}
              onSelectPlan={(id) => setSelectedPlanId(id)}
              onNavigateEngineering={(id) => {
                setSelectedPlanId(id);
                setActiveTab('engineering');
              }}
              onCreateNewPlan={handleOpenNewPlan}
              onEditPlan={handleOpenEditPlan}
              onDeletePlan={(p) => setPlanToDelete(p)}
              onToast={showToast}
            />
          )}

          {activeTab === 'engineering' && (
            <EngineeringCalcTab
              plan={selectedPlan}
              cranes={cranes}
              rigging={rigging}
              stageGates={stageGates}
              canWrite={permissions.canWrite}
              onSaveAndRefresh={loadAll}
              onCaptureSnapshot={(url) => setSnapshotDataUrl(url)}
              onCreateNewPlan={handleOpenNewPlan}
              onToast={showToast}
            />
          )}

          {activeTab === 'cranes' && (
            <CranesLoadChartsTab
              cranes={cranes}
              integration={integration}
              canWrite={permissions.canWrite}
              canApprove={permissions.canApprove}
              onRefresh={loadAll}
              onToast={showToast}
            />
          )}

          {activeTab === 'rigging' && (
            <RiggingBankTab
              rigging={rigging}
              integration={integration}
              canWrite={permissions.canWrite}
              canApprove={permissions.canApprove}
              onRefresh={loadAll}
              onToast={showToast}
            />
          )}

          {activeTab === 'special-ops' && (
            <SpecialOpsTab
              plan={selectedPlan}
              cranes={cranes}
              canWrite={permissions.canWrite}
              onRefresh={loadAll}
              onToast={showToast}
            />
          )}

          {activeTab === 'risk-jsa' && (
            <LiftingRiskJsaTab
              plan={selectedPlan}
              integration={integration}
              canWrite={permissions.canWrite}
              onRefresh={loadAll}
              onToast={showToast}
            />
          )}

          {activeTab === 'workflow' && (
            <WorkflowApprovalsTab
              plan={selectedPlan}
              integration={integration}
              stageGates={stageGates}
              engineVersion={engineVersion}
              canWrite={permissions.canWrite}
              canApprove={permissions.canApprove}
              onRefresh={loadAll}
              onToast={showToast}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsArchiveTab
              plan={selectedPlan}
              cranes={cranes}
              integration={integration}
              snapshotDataUrl={snapshotDataUrl}
              onCaptureSnapshot={(url) => setSnapshotDataUrl(url)}
              onToast={showToast}
            />
          )}

          {activeTab === 'assets-certs' && (
            <IntegratedAssetsCertsTab cranes={cranes} rigging={rigging} integration={integration} />
          )}

          {activeTab === 'standards' && (
            <StandardsSettingsTab
              standards={standards}
              canApprove={permissions.canApprove}
              onRefresh={loadAll}
              onToast={showToast}
            />
          )}
        </div>
      )}

      {/* Separate Dedicated New / Edit Lifting Plan Form Modal */}
      <LiftingPlanFormModal
        isOpen={formModalState.open}
        editingPlan={formModalState.editingPlan}
        cranes={cranes}
        rigging={rigging}
        integration={integration}
        onClose={() => setFormModalState({ open: false, editingPlan: null })}
        onSaved={handlePlanSaved}
        onToast={showToast}
      />

      {/* Standard HSECORE Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(planToDelete)}
        isFa
        title="تأیید حذف طرح باربرداری"
        itemType="طرح باربرداری"
        itemName={planToDelete ? `${planToDelete.planCode} — ${planToDelete.title}` : ''}
        onConfirm={handleConfirmDeletePlan}
        onClose={() => setPlanToDelete(null)}
      />
    </div>
  );
}
