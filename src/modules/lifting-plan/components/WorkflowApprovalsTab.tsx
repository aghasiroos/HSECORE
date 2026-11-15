import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileCheck2,
  Link2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import { liftingApi } from '../services/liftingApi';
import type {
  LiftingIntegrationContext,
  LiftingPlanRecord,
  LiftingStageGateRow,
  LiftingWorkflowStageRow,
} from '../types';

interface Props {
  plan: LiftingPlanRecord | null;
  integration: LiftingIntegrationContext | null;
  stageGates?: LiftingStageGateRow[];
  engineVersion?: string;
  canWrite: boolean;
  canApprove: boolean;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const ENGINEERING_CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'weight_cog', label: 'صحت وزن ناخالص بار، قلاب/اسپردر و موقعیت واقعی مرکز ثقل (CoG)' },
  { key: 'load_chart', label: 'انطباق کامل با جدول بار واقعی جرثقیل (Load Chart) در شعاع و بوم بحرانی' },
  { key: 'sling_shackle', label: 'کنترل کشش شاخه‌های اسلینگ، حداقل زاویه و ضریب کاهش ظرفیت شگل (B30.9 / B30.26)' },
  { key: 'outrigger_ground', label: 'محاسبه فشار ماکزیمم زیر جک‌ها، ابعاد پدها و ظرفیت مجاز باربری خاک' },
  { key: 'crane_boom_clearance', label: 'بررسی فواصل ایمن بوم، قلاب و مسیر چرخش از سازه‌ها و پایپ‌رک‌ها' },
  { key: 'special_load_cases', label: 'تحلیل حالات بارگذاری نامتقارن، سرعت باد طراحی و ضریب دینامیکی (DAF)' },
];

const HSE_CHECKLIST_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'jsa_linked', label: 'تدوین، بازبینی و اتصال JSA مصوب در ماژول ارزیابی ریسک' },
  { key: 'ptw_prerequisites', label: 'احراز پیش‌نیازهای صدور پروانه کار ایمن (PTW) و ایزولاسیون انرژی/فرآیند' },
  { key: 'blind_lift_comms', label: 'تعیین پرچمدار، کانال بی‌سیم اختصاصی و پروتکل عملیات کور (Blind Lift)' },
  { key: 'drop_zone_exclusion', label: 'ایجاد محدوده ممنوعه سقوط بار (Drop Zone)، فنس‌کشی و تابلوگذاری' },
  { key: 'overhead_utilities', label: 'کنترل حریم خطوط برق فشارقوی، لوله‌های فرآیندی فعال و منابع اشتعال' },
  { key: 'personnel_certs', label: 'احراز گواهینامه معتبر اپراتور جرثقیل، ریگرها و سرپرست عملیات' },
  { key: 'equipment_inspected', label: 'کنترل تگ بازرسی فنی، گواهینامه سالانه معتبر و قفل ایمنی قلاب تجهیزات' },
  { key: 'weather_wind_limits', label: 'احراز محدودیت سرعت باد، دید کافی و شرایط جوی مجاز عملیات' },
];

const FIELD_CONDITION_DEFS: Array<{ key: string; label: string; defaultPlanned: (plan: LiftingPlanRecord) => string }> = [
  {
    key: 'wind_actual',
    label: '۱. سرعت و جهت باد واقعی محل (m/s)',
    defaultPlanned: (p) => `حداکثر ${p.craneSetup?.windSpeedMs ?? 8} m/s`,
  },
  {
    key: 'soil_stability',
    label: '۲. وضعیت استحکام خاک، نبود نشست یا آب‌گرفتگی بستر',
    defaultPlanned: (p) => `ظرفیت مجاز خاک ≥ ${p.craneSetup?.groundBearingMaxKpa ?? 250} kPa`,
  },
  {
    key: 'outrigger_mats',
    label: '۳. تراز بودن جک‌ها، ابعاد و سلامت تشک/تخته زیر جک (Outrigger Mats)',
    defaultPlanned: (p) => `گستردگی جک ${p.craneSetup?.outriggerSpreadM ?? 7.5} m (${p.craneSetup?.outriggerConfig || '100%'})`,
  },
  {
    key: 'powerlines_clearance',
    label: '۴. رعایت حریم ایمن خطوط برق فشارقوی و کابل‌های هوایی',
    defaultPlanned: () => 'رعایت حداقل حریم استاندارد ASME B30.5',
  },
  {
    key: 'load_path_clear',
    label: '۵. پاک‌سازی کامل مسیر حمل بار و تخلیه پرسنل غیرمرتبط (Drop Zone)',
    defaultPlanned: () => 'ایزولاسیون کامل محدوده و استقرار مراقب',
  },
  {
    key: 'piping_interference',
    label: '۶. بررسی عدم تداخل با پایپ‌رک‌ها، فلنج‌ها، ولوها و سازه‌های مجاور',
    defaultPlanned: () => 'فاصله ایمن بدون تداخل فیزیکی',
  },
  {
    key: 'visibility_lighting',
    label: '۷. وضعیت دید اپراتور/سیگنال‌دهنده و روشنایی محیط کار',
    defaultPlanned: (p) => (p.blindConfig?.enabled ? 'استقرار سیگنال‌دهنده در نقطه دید' : 'دید مستقیم کامل و نور کافی'),
  },
  {
    key: 'radio_comms',
    label: '۸. تست سلامت بی‌سیم اختصاصی، باتری و کانال پشتیبان',
    defaultPlanned: (p) => p.blindConfig?.primaryRadioChannel || 'تست ارتباط دوطرفه پیش از بلندکردن',
  },
  {
    key: 'oem_weather_limits',
    label: '۹. انطباق با محدودیت‌های آب‌وهوایی و عملیاتی سازنده جرثقیل (OEM)',
    defaultPlanned: () => 'عدم وجود رعدوبرق، مه شدید یا باد لحظه‌ای خطرناک',
  },
  {
    key: 'crew_gear_ready',
    label: '۱۰. آمادگی تیم اجرایی، PPE و بازرسی ظاهری ابزار ریگینگ پیش از لیفت',
    defaultPlanned: () => 'برگزاری Pre-Lift Toolbox Talk و کنترل قفل قلاب',
  },
];

const STAGE_ORDER: Array<{ key: string; titleFa: string; roleHint: string; checklist: string[] }> = [
  {
    key: 'REQUEST',
    titleFa: '۱. ثبت درخواست عملیات باربرداری',
    roleHint: 'متقاضی / سرپرست واحد بهره‌برداری',
    checklist: ['تعیین دقیق محل عملیات و محدوده خطرات مجاور', 'تعیین زمان‌بندی پیشنهادی و وزن بار'],
  },
  {
    key: 'PLAN_DRAFT',
    titleFa: '۲. تدوین طرح و جانمایی مهندسی',
    roleHint: 'طراح و مهندس باربرداری (Lift Planner)',
    checklist: ['انتخاب جرثقیل و اسلینگ/شگل از بانک تجهیزات', 'تعیین نقاط آویز و موقعیت جک‌ها'],
  },
  {
    key: 'ENG_REVIEW',
    titleFa: '۳. بررسی و صحه‌گذاری محاسبات مهندسی (ASME)',
    roleHint: 'مهندس ناظر مکانیک / بازرس فنی (نیازمند ۶ بند مهندسی)',
    checklist: ['انطباق Load Chart واقعی جرثقیل', 'صحت‌سنجی زاویه اسلینگ و فاکتور ایمنی ASME B30.9/B30.26'],
  },
  {
    key: 'HSE_EVAL',
    titleFa: '۴. ارزیابی ایمنی، ریسک (JSA) و عملیات ویژه',
    roleHint: 'کارشناس / سرپرست ایمنی HSE (نیازمند ۸ بند ایمنی)',
    checklist: ['اتصال JSA مصوب در ماژول ارزیابی ریسک', 'احراز الزامات Blind / Tandem / Turning'],
  },
  {
    key: 'EQUIP_INSPECT',
    titleFa: '۵. کنترل گواهینامه و بازرسی فنی تجهیزات و پرسنل',
    roleHint: 'بازرس فنی تجهیزات / واحد ایمنی',
    checklist: ['اعتبار گواهینامه جرثقیل و ادوات Rigging', 'سلامت قفل ایمنی قلاب و نبود عدم انطباق باز (NC)'],
  },
  {
    key: 'AUTHORIZED_APPROVAL',
    titleFa: '۶. تأییدیه مقامات مجاز (HSE / بهره‌برداری / مدیر مجاز)',
    roleHint: 'مقام تأییدکننده مجاز (Approver)',
    checklist: ['تکمیل کلیه مراحل مهندسی، ایمنی و بازرسی تجهیزات', 'تأیید نهایی طرح قبل از صدور مجوز کار'],
  },
  {
    key: 'PERMIT_ISSUANCE',
    titleFa: '۷. صدور و اتصال پروانه کار ایمن (PTW)',
    roleHint: 'صادرکننده مجوز کار (منوط به دروازه G6 و تطبیق ۱۰گانه محل)',
    checklist: ['اتصال پروانه کار معتبر در ماژول PTW سامانه', 'امضای تحویل محدوده ایمن'],
  },
  {
    key: 'EXECUTION',
    titleFa: '۸. نظارت میدانی و پایش اجرای عملیات',
    roleHint: 'ناظر عملیات / سرپرست ریگرها',
    checklist: ['برگزاری جلسه پیش از کار (Toolbox Talk)', 'کنترل سرعت باد لحظه‌ای و حریم خطوط برق'],
  },
  {
    key: 'CLOSEOUT',
    titleFa: '۹. اختتام عملیات و آرشیو مهندسی',
    roleHint: 'سرپرست ایمنی / متقاضی',
    checklist: ['جمع‌آوری ایمن تجهیزات و بازگشایی محدوده', 'ثبت درس‌آموخته و تکمیل آرشیو'],
  },
];

const DECISION_LABELS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'تأییدشده', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800' },
  REJECTED: { label: 'ردشده', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800' },
  RETURNED: { label: 'برگشت برای اصلاح', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800' },
  RESET_ON_REVISION: { label: 'بازنشانی در ویرایش جدید', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800' },
  PENDING: { label: 'در انتظار اقدام', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
};

const GATE_BADGE_MAP: Record<string, { label: string; cls: string }> = {
  VERIFIED: { label: 'تاییدشده (VERIFIED)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800' },
  PENDING: { label: 'در انتظار تایید (PENDING)', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800' },
  FAILED: { label: 'ناموفق / مسدود (FAILED)', cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800' },
};

export default function WorkflowApprovalsTab({
  plan,
  integration,
  stageGates = [],
  engineVersion,
  canWrite,
  canApprove,
  onRefresh,
  onToast,
}: Props) {
  const [comments, setComments] = useState('');
  const [signerCode, setSignerCode] = useState('');
  const [checklistMap, setChecklistMap] = useState<Record<string, Record<string, boolean>>>({});
  const [blockers, setBlockers] = useState<string[]>([]);
  const [submittingStage, setSubmittingStage] = useState<string | null>(null);

  const [selectedPtwId, setSelectedPtwId] = useState('');
  const [newPtwType, setNewPtwType] = useState<'COLD' | 'HOT'>('COLD');
  const [ptwBusy, setPtwBusy] = useState(false);

  // Governance Checklists (Engineering 7 + HSE 8 + Field Conditions 10)
  const [engChecklist, setEngChecklist] = useState<Record<string, { checked: boolean; note?: string }>>({});
  const [hseChecklist, setHseChecklist] = useState<Record<string, { checked: boolean; note?: string }>>({});
  const [fieldConditions, setFieldConditions] = useState<
    Record<string, { planned?: string; actual?: string; verified: boolean; note?: string }>
  >({});
  const [savingGov, setSavingGov] = useState<string | null>(null);
  const [gateBusy, setGateBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    setEngChecklist(plan.engineeringChecklist || {});
    setHseChecklist(plan.hseChecklist || {});

    const existingFc = plan.fieldConditionsVerification || {};
    const initializedFc: Record<string, { planned?: string; actual?: string; verified: boolean; note?: string }> = {};
    for (const def of FIELD_CONDITION_DEFS) {
      initializedFc[def.key] = {
        planned: existingFc[def.key]?.planned ?? def.defaultPlanned(plan),
        actual: existingFc[def.key]?.actual ?? '',
        verified: Boolean(existingFc[def.key]?.verified),
        note: existingFc[def.key]?.note ?? '',
      };
    }
    setFieldConditions(initializedFc);
  }, [plan?.id, plan?.revisionNumber, plan?.updatedAt]);

  if (!plan) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center text-sm text-slate-500">
        ابتدا یک طرح باربرداری را انتخاب کنید.
      </div>
    );
  }

  const approvalsByStage = new Map<string, LiftingWorkflowStageRow>();
  for (const row of plan.workflowApprovals || []) {
    approvalsByStage.set(row.stageKey, row);
  }

  const linkedPtw = integration?.workPermits.find((p) => p.id === plan.linkedPermitId) || null;
  const linkedRisk = integration?.riskAssessments.find((r) => r.id === plan.linkedRiskAssessmentId) || null;

  const engCompletedCount = ENGINEERING_CHECKLIST_ITEMS.filter((it) => Boolean(engChecklist[it.key]?.checked)).length;
  const hseCompletedCount = HSE_CHECKLIST_ITEMS.filter((it) => Boolean(hseChecklist[it.key]?.checked)).length;
  const fieldVerifiedCount = FIELD_CONDITION_DEFS.filter((it) => Boolean(fieldConditions[it.key]?.verified)).length;

  const gateG6 = stageGates.find((g) => g.gateCode === 'G6');
  const g6Verified = gateG6?.status === 'VERIFIED';

  const handleVerifyGate = async (gateCode: string, decision: 'VERIFIED' | 'PENDING' | 'FAILED') => {
    setGateBusy(gateCode);
    try {
      await liftingApi.verifyStageGate(gateCode, { decision });
      onToast(`وضعیت دروازه کنترل ${gateCode} به «${decision}» تغییر یافت.`, 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || `خطا در به‌روزرسانی دروازه ${gateCode}`, 'error');
    } finally {
      setGateBusy(null);
    }
  };

  const handleSaveGovernance = async (section: 'ENG' | 'HSE' | 'FIELD') => {
    setSavingGov(section);
    try {
      if (section === 'ENG') {
        await liftingApi.updateGovernanceChecklists(plan.id, { engineeringChecklist: engChecklist });
        onToast('چک‌لیست مستقل ۷ بندی مهندسی ذخیره شد.', 'success');
      } else if (section === 'HSE') {
        await liftingApi.updateGovernanceChecklists(plan.id, { hseChecklist });
        onToast('چک‌لیست مستقل ۸ بندی HSE ذخیره شد.', 'success');
      } else {
        await liftingApi.updateGovernanceChecklists(plan.id, { fieldConditionsVerification: fieldConditions });
        onToast('تطبیق ۱۰گانه شرایط واقعی محل (Planned vs Actual) ذخیره شد.', 'success');
      }
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ذخیره‌سازی چک‌لیست حاکمیتی', 'error');
    } finally {
      setSavingGov(null);
    }
  };

  const handleStageDecision = async (stageKey: string, decision: 'APPROVED' | 'REJECTED' | 'RETURNED') => {
    setSubmittingStage(stageKey);
    setBlockers([]);
    try {
      const stageCheckState =
        stageKey === 'ENG_REVIEW'
          ? Object.fromEntries(ENGINEERING_CHECKLIST_ITEMS.map((i) => [i.key, Boolean(engChecklist[i.key]?.checked)]))
          : stageKey === 'HSE_EVAL'
            ? Object.fromEntries(HSE_CHECKLIST_ITEMS.map((i) => [i.key, Boolean(hseChecklist[i.key]?.checked)]))
            : checklistMap[stageKey] || {};

      await liftingApi.advanceWorkflow(plan.id, {
        stageKey,
        decision,
        comments: comments.trim() || undefined,
        checklistState: stageCheckState,
        signerPersonnelCode: signerCode || undefined,
      });
      setComments('');
      onToast(
        decision === 'APPROVED'
          ? 'مرحله گردش کار با موفقیت تأیید و ثبت شد.'
          : decision === 'RETURNED'
            ? 'طرح برای بازبینی مهندسی به مرحله تدوین بازگشت.'
            : 'طرح در این مرحله رد شد.',
        decision === 'APPROVED' ? 'success' : 'info'
      );
      await onRefresh();
    } catch (err: any) {
      if (Array.isArray(err?.blockers) && err.blockers.length > 0) {
        setBlockers(err.blockers);
      }
      onToast(err?.message || 'شرایط دروازه گردش کار احراز نشد.', 'error');
    } finally {
      setSubmittingStage(null);
    }
  };

  const handleLinkExistingPtw = async () => {
    if (!selectedPtwId) return;
    setPtwBusy(true);
    try {
      await liftingApi.linkOrCreatePtw(plan.id, { existingPermitId: Number(selectedPtwId) });
      onToast('پروانه کار ایمن (PTW) با موفقیت به طرح باربرداری متصل شد.', 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در اتصال PTW', 'error');
    } finally {
      setPtwBusy(false);
    }
  };

  const handleCreateNewPtw = async () => {
    setPtwBusy(true);
    try {
      await liftingApi.linkOrCreatePtw(plan.id, {
        permitType: newPtwType,
        title: `مجوز باربرداری ${plan.planCode} - ${plan.title}`,
        validFrom: plan.plannedDate,
        validTo: plan.plannedDate,
      });
      onToast('پروانه کار ایمن جدید در ماژول مرکزی PTW ثبت و متصل شد.', 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ایجاد PTW جدید', 'error');
    } finally {
      setPtwBusy(false);
    }
  };

  const toggleCheckItem = (stageKey: string, idx: number) => {
    const key = `item_${idx}`;
    setChecklistMap((prev) => ({
      ...prev,
      [stageKey]: {
        ...(prev[stageKey] || {}),
        [key]: !(prev[stageKey]?.[key]),
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Stage Gates G1..G6 Operational Governance Panel */}
      {stageGates.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>دروازه‌های کنترل مهندسی و بهره‌برداری (Stage Gates G1–G6)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                نسخه موتور محاسبات: <strong className="font-mono">{engineVersion || plan.engineVersion || '2.1.0-core'}</strong> | صدور مجوز اجرای واقعی (مرحله ۷ PTW) تا تأیید صریح دروازه <strong>G6</strong> مسدود است.
              </p>
            </div>
            {!g6Verified && (
              <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>دروازه G6 در انتظار تأیید نهایی (مجوز اجرای واقعی محدود)</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stageGates.map((g) => {
              const badge = GATE_BADGE_MAP[g.status] || GATE_BADGE_MAP.PENDING;
              const isG2 = g.gateCode === 'G2';
              const ev = g.evidenceSummary || {};
              return (
                <div
                  key={g.gateCode}
                  className={`p-3.5 rounded-lg border flex flex-col justify-between gap-2.5 ${
                    g.status === 'VERIFIED'
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10'
                      : g.status === 'FAILED'
                        ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10'
                        : 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-slate-900 dark:text-white">{g.gateCode}</span>
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{g.titleFa}</div>
                    <div className="text-[11px] text-slate-500 leading-relaxed">{g.criteriaFa}</div>
                    {isG2 && ev.totalCases != null && (
                      <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-bold">
                        Benchmark Evidence: {ev.passedCases}/{ev.totalCases} PASSED ({ev.engineVersion})
                      </div>
                    )}
                    {g.verifiedBy && (
                      <div className="text-[10px] text-slate-500">
                        تایید: {g.verifiedBy}
                        {g.verifiedAt && ` • ${new Date(g.verifiedAt).toLocaleDateString('fa-IR')}`}
                      </div>
                    )}
                  </div>

                  {canApprove && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                      {g.status !== 'VERIFIED' ? (
                        <button
                          type="button"
                          disabled={gateBusy === g.gateCode}
                          onClick={() => handleVerifyGate(g.gateCode, 'VERIFIED')}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{gateBusy === g.gateCode ? 'در حال ثبت...' : `تأیید رسمی ${g.gateCode}`}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={gateBusy === g.gateCode}
                          onClick={() => handleVerifyGate(g.gateCode, 'PENDING')}
                          className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-bold cursor-pointer"
                        >
                          بازنشانی به Pending
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dual Independent Checklists: Engineering (7 items) vs HSE (8 items) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        {/* Engineering Independent Review (7 checks) */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-600" />
                <span>تأییدیه مستقل مهندسی (Engineering Review — ۶ بند)</span>
              </h4>
              <p className="text-[11px] text-slate-500">پیش‌نیاز اجباری تأیید مرحله ۳ گردش کار</p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg border font-mono font-bold tabular-nums ${
                engCompletedCount === 6
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {engCompletedCount} / 6
            </span>
          </div>

          <div className="space-y-2.5">
            {ENGINEERING_CHECKLIST_ITEMS.map((item) => {
              const entry = engChecklist[item.key] || { checked: false, note: '' };
              return (
                <div
                  key={item.key}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5"
                >
                  <label className="flex items-start gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      disabled={!canWrite}
                      checked={Boolean(entry.checked)}
                      onChange={(e) =>
                        setEngChecklist((prev) => ({
                          ...prev,
                          [item.key]: { ...prev[item.key], checked: e.target.checked },
                        }))
                      }
                      className="mt-0.5"
                    />
                    <span>{item.label}</span>
                  </label>
                  <input
                    type="text"
                    disabled={!canWrite}
                    value={entry.note || ''}
                    onChange={(e) =>
                      setEngChecklist((prev) => ({
                        ...prev,
                        [item.key]: { checked: Boolean(prev[item.key]?.checked), note: e.target.value },
                      }))
                    }
                    placeholder="توضیح یا مستند مرجع مهندسی..."
                    className="w-full px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                  />
                </div>
              );
            })}
          </div>

          {canWrite && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={savingGov !== null}
                onClick={() => handleSaveGovernance('ENG')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingGov === 'ENG' ? 'در حال ذخیره...' : 'ذخیره چک‌لیست ۶ بندی مهندسی'}</span>
              </button>
            </div>
          )}
        </div>

        {/* HSE Independent Review (8 checks) */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                <span>تأییدیه مستقل ایمنی و ریسک (HSE Evaluation — ۸ بند)</span>
              </h4>
              <p className="text-[11px] text-slate-500">پیش‌نیاز اجباری تأیید مرحله ۴ گردش کار (مستقل از مهندسی)</p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg border font-mono font-bold tabular-nums ${
                hseCompletedCount === 8
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {hseCompletedCount} / 8
            </span>
          </div>

          <div className="space-y-2">
            {HSE_CHECKLIST_ITEMS.map((item) => {
              const entry = hseChecklist[item.key] || { checked: false, note: '' };
              return (
                <div
                  key={item.key}
                  className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 space-y-1"
                >
                  <label className="flex items-start gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      disabled={!canWrite}
                      checked={Boolean(entry.checked)}
                      onChange={(e) =>
                        setHseChecklist((prev) => ({
                          ...prev,
                          [item.key]: { ...prev[item.key], checked: e.target.checked },
                        }))
                      }
                      className="mt-0.5"
                    />
                    <span>{item.label}</span>
                  </label>
                  <input
                    type="text"
                    disabled={!canWrite}
                    value={entry.note || ''}
                    onChange={(e) =>
                      setHseChecklist((prev) => ({
                        ...prev,
                        [item.key]: { checked: Boolean(prev[item.key]?.checked), note: e.target.value },
                      }))
                    }
                    placeholder="اقدام کنترلی یا شماره گواهی/مجوز..."
                    className="w-full px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                  />
                </div>
              );
            })}
          </div>

          {canWrite && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={savingGov !== null}
                onClick={() => handleSaveGovernance('HSE')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingGov === 'HSE' ? 'در حال ذخیره...' : 'ذخیره چک‌لیست ۸ بندی HSE'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 10-Point Operational Field Conditions Verification (Planned vs Actual) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-sky-600" />
              <span>تطبیق ۱۰گانه شرایط عملیاتی واقعی محل پیش از صدور PTW و اجرا (Planned vs Actual)</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              پیش از تأیید مرحله ۷ (صدور مجوز PTW) و مرحله ۸ (اجرا)، هر ۱۰ بند زیر باید بر اساس بازدید واقعی صحنه تکمیل و تیک بخورد.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg border font-mono font-bold tabular-nums ${
                fieldVerifiedCount === 10
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {fieldVerifiedCount} / 10 احراز شده
            </span>
            {canWrite && (
              <button
                type="button"
                disabled={savingGov !== null}
                onClick={() => handleSaveGovernance('FIELD')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingGov === 'FIELD' ? 'در حال ذخیره...' : 'ذخیره تطبیق میدانی ۱۰گانه'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                <th className="p-2">شاخص کنترل میدانی</th>
                <th className="p-2">مقدار / شرط طراحی‌شده (Planned)</th>
                <th className="p-2">مقدار / وضعیت واقعی محل (Actual)</th>
                <th className="p-2">توضیحات ناظر محل</th>
                <th className="p-2 text-center">تطبیق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {FIELD_CONDITION_DEFS.map((def) => {
                const row = fieldConditions[def.key] || {
                  planned: def.defaultPlanned(plan),
                  actual: '',
                  verified: false,
                  note: '',
                };
                return (
                  <tr key={def.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                    <td className="p-2 font-bold text-slate-800 dark:text-slate-200 min-w-[230px]">{def.label}</td>
                    <td className="p-2">
                      <input
                        type="text"
                        disabled={!canWrite}
                        value={row.planned ?? ''}
                        onChange={(e) =>
                          setFieldConditions((prev) => ({
                            ...prev,
                            [def.key]: { ...prev[def.key], planned: e.target.value },
                          }))
                        }
                        className="w-full min-w-[160px] px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        disabled={!canWrite}
                        value={row.actual ?? ''}
                        onChange={(e) =>
                          setFieldConditions((prev) => ({
                            ...prev,
                            [def.key]: { ...prev[def.key], actual: e.target.value },
                          }))
                        }
                        placeholder="مقدار قرائت‌شده در محل..."
                        className="w-full min-w-[160px] px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        disabled={!canWrite}
                        value={row.note ?? ''}
                        onChange={(e) =>
                          setFieldConditions((prev) => ({
                            ...prev,
                            [def.key]: { ...prev[def.key], note: e.target.value },
                          }))
                        }
                        placeholder="یادداشت..."
                        className="w-full min-w-[130px] px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        disabled={!canWrite}
                        checked={Boolean(row.verified)}
                        onChange={(e) =>
                          setFieldConditions((prev) => ({
                            ...prev,
                            [def.key]: { ...prev[def.key], verified: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan Workflow Overview + Reapproval Warning */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-sky-600" />
              <span>گردش کار ۹ مرحله‌ای و دروازه‌های کنترل مهندسی و ایمنی ({plan.planCode})</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              نسخه فعال: <strong className="font-mono">R{plan.revisionNumber}</strong> | وضعیت طرح:{' '}
              <strong className="font-mono">{plan.status}</strong> | مرحله جاری:{' '}
              <strong className="font-mono">{plan.workflowStage}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">محاسبات مهندسی:</span>
            <StatusBadge status={plan.engineeringStatus} />
          </div>
        </div>

        {(plan.requiresReapproval || plan.status === 'REAPPROVAL_REQUIRED') && (
          <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              این طرح پس از تأیید اولیه ویرایش شده (نسخه R{plan.revisionNumber}) و تمام تأییدیه‌های مهندسی و HSE بازنشانی شده‌اند. عبور مجدد از مراحل مهندسی، ایمنی و مقام مجاز الزامی است.
            </span>
          </div>
        )}

        {blockers.length > 0 && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 space-y-1.5">
            <div className="font-black text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>انسداد دروازه گردش کار (پیش‌نیازهای تکمیل‌نشده):</span>
            </div>
            <ul className="list-disc pr-5 text-red-700 dark:text-red-300 space-y-0.5">
              {blockers.map((b, idx) => (
                <li key={idx}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick prerequisite readiness bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="text-[11px] text-slate-500">محاسبات مهندسی</div>
            <div className="mt-1 font-bold text-slate-900 dark:text-white">
              {plan.engineeringStatus === 'PASS' || plan.engineeringStatus === 'WARNING'
                ? 'آماده تأیید مهندسی'
                : 'مسدود (FAIL / ناقص)'}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="text-[11px] text-slate-500">چک‌لیست مستقل ۶ / ۸</div>
            <div className="mt-1 font-bold font-mono text-slate-900 dark:text-white">
              ENG: {engCompletedCount}/6 · HSE: {hseCompletedCount}/8
            </div>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="text-[11px] text-slate-500">ارزیابی ریسک / JSA</div>
            <div className="mt-1 font-bold text-slate-900 dark:text-white">
              {linkedRisk ? `متصل (${linkedRisk.assessmentCode || `#${linkedRisk.id}`})` : 'متصل نشده'}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="text-[11px] text-slate-500">تطبیق محل + دروازه G6</div>
            <div className="mt-1 font-bold font-mono text-slate-900 dark:text-white">
              {fieldVerifiedCount}/10 · G6: {g6Verified ? 'VERIFIED' : 'PENDING'}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="text-[11px] text-slate-500">مجوز کار ایمن PTW</div>
            <div className="mt-1 font-bold text-slate-900 dark:text-white">
              {linkedPtw ? `${linkedPtw.permitNumber} (${linkedPtw.status})` : 'صادر / متصل نشده'}
            </div>
          </div>
        </div>
      </div>

      {/* Signer identification & comments */}
      {canWrite && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <CentralPersonnelSelector
              isFa={true}
              label="کد پرسنلی / امضاکننده مرحله (اختیاری - ثبت در لاگ ممیزی)"
              selectedPersonnelCode={signerCode}
              onSelectPersonnel={(person) => setSignerCode(person?.personnelCode || '')}
              placeholder="انتخاب پرسنل امضاکننده..."
              showOrgBadges={true}
              compact={true}
            />
          </div>
          <div>
            <label className="block font-bold mb-1 text-slate-700 dark:text-slate-200">
              شرح نظر / شرط ایمنی / دلیل برگشت یا تأیید
            </label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="مثال: ضخامت تخته زیر جک‌ها ۱۰۰ میلی‌متر رعایت شود..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      )}

      {/* 9-Stage Stepper Cards */}
      <div className="space-y-3">
        {STAGE_ORDER.map((meta) => {
          const row = approvalsByStage.get(meta.key);
          const decision = row?.decision || 'PENDING';
          const decStyle = DECISION_LABELS[decision] || DECISION_LABELS.PENDING;
          const isCurrent = plan.workflowStage === meta.key;
          const needsApproverRole = meta.key === 'AUTHORIZED_APPROVAL';
          const userAllowedForStage = needsApproverRole ? canApprove : canWrite;

          return (
            <div
              key={meta.key}
              className={`bg-white dark:bg-slate-800 border rounded-xl p-4 text-xs transition-colors ${
                isCurrent
                  ? 'border-sky-500 ring-1 ring-sky-500/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900 dark:text-white">{meta.titleFa}</span>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-sky-600 text-white text-[10px] font-bold">
                        مرحله فعال فعلی
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${decStyle.cls}`}>
                      {decStyle.label}
                    </span>
                    {meta.key === 'ENG_REVIEW' && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[10px]">
                        چک‌لیست مهندسی: {engCompletedCount}/6
                      </span>
                    )}
                    {meta.key === 'HSE_EVAL' && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[10px]">
                        چک‌لیست HSE: {hseCompletedCount}/8
                      </span>
                    )}
                    {(meta.key === 'PERMIT_ISSUANCE' || meta.key === 'EXECUTION') && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-[10px]">
                        شرایط محل: {fieldVerifiedCount}/10 | G6: {g6Verified ? 'OK' : 'LOCKED'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    مسئول اقدام: <strong className="text-slate-700 dark:text-slate-300">{meta.roleHint}</strong>
                    {row?.signerName && (
                      <>
                        {' '}| امضاکننده: <strong className="text-slate-700 dark:text-slate-300">{row.signerName}</strong>
                        {row.signerPersonnelCode && <span className="font-mono"> ({row.signerPersonnelCode})</span>}
                        {row.decidedAt && (
                          <span className="font-mono text-slate-400">
                            {' '}• {new Date(row.decidedAt).toLocaleString('fa-IR')}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {userAllowedForStage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={submittingStage !== null}
                      onClick={() => handleStageDecision(meta.key, 'APPROVED')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تأیید مرحله</span>
                    </button>
                    <button
                      type="button"
                      disabled={submittingStage !== null}
                      onClick={() => handleStageDecision(meta.key, 'RETURNED')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-bold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>برگشت</span>
                    </button>
                    <button
                      type="button"
                      disabled={submittingStage !== null}
                      onClick={() => handleStageDecision(meta.key, 'REJECTED')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 font-bold cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>رد</span>
                    </button>
                  </div>
                )}
                {!userAllowedForStage && needsApproverRole && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>نیازمند دسترسی مدیر ایمنی / Approver</span>
                  </span>
                )}
              </div>

              {/* Checklist + recorded comments */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  {meta.checklist.map((item, idx) => {
                    const checked = Boolean(checklistMap[meta.key]?.[`item_${idx}`] ?? row?.checklistState?.[`item_${idx}`]);
                    return (
                      <label key={idx} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheckItem(meta.key, idx)}
                        />
                        <span>{item}</span>
                      </label>
                    );
                  })}
                </div>
                {row?.comments && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700">
                    <strong>یادداشت ثبت‌شده:</strong> {row.comments}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* PTW Integration Box (Stage 7 Enabler) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <span>مدیریت پروانه کار ایمن (PTW) مرتبط با باربرداری</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              متصل به جدول مرکزی work_permits سامانه HSECORE — برای تأیید مرحله ۷ گردش کار و پس از احراز G6 + تطبیق ۱۰گانه محل الزامی است.
            </p>
          </div>
          {linkedPtw && (
            <span className="px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold font-mono">
              متصل: {linkedPtw.permitNumber} ({linkedPtw.status})
            </span>
          )}
        </div>

        {canWrite && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2.5">
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-sky-600" />
                <span>اتصال به پروانه کار (PTW) موجود</span>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedPtwId}
                  onChange={(e) => setSelectedPtwId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="">-- انتخاب PTW از بانک مجوزها ({integration?.workPermits.length || 0}) --</option>
                  {(integration?.workPermits || []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.permitNumber} — {w.title} ({w.status})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedPtwId || ptwBusy}
                  onClick={handleLinkExistingPtw}
                  className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold cursor-pointer whitespace-nowrap"
                >
                  اتصال PTW
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>صدور مستقیم PTW باربرداری (VEHICLE_CRANE) و اتصال</span>
              </div>
              <div className="flex gap-2">
                <select
                  value={newPtwType}
                  onChange={(e) => setNewPtwType(e.target.value as 'COLD' | 'HOT')}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="COLD">مجوز کار سرد (COLD)</option>
                  <option value="HOT">مجوز کار گرم (HOT)</option>
                </select>
                <button
                  type="button"
                  disabled={ptwBusy}
                  onClick={handleCreateNewPtw}
                  className="flex-1 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  ایجاد و اتصال خودکار PTW برای این طرح
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
