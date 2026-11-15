import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calculator,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  ShieldCheck,
  TableProperties,
  Plus,
  Trash2,
  Sliders,
  Activity,
  BarChart3,
  Scale,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import Lifting3DViewport, { type Lifting3DViewportHandle } from './Lifting3DViewport';
import { evaluateFullLiftingPlan, LIFTING_ENGINE_VERSION } from '../../../../shared/lifting-engine/index';
import { liftingApi } from '../services/liftingApi';
import type {
  AttachmentPointInput,
  BenchmarkSuiteReport,
  FullPlanEvaluationResult,
  LiftingCrane,
  LiftingPlanRecord,
  LiftingStageGateRow,
  RiggingEquipmentItem,
} from '../types';

interface Props {
  plan: LiftingPlanRecord | null;
  cranes: LiftingCrane[];
  rigging: RiggingEquipmentItem[];
  stageGates?: LiftingStageGateRow[];
  canWrite: boolean;
  onSaveAndRefresh: () => Promise<void>;
  onCaptureSnapshot?: (dataUrl: string) => void;
  onCreateNewPlan?: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function EngineeringCalcTab({
  plan,
  cranes,
  rigging,
  stageGates = [],
  canWrite,
  onSaveAndRefresh,
  onCaptureSnapshot,
  onCreateNewPlan,
  onToast,
}: Props) {
  const viewportRef = useRef<Lifting3DViewportHandle | null>(null);
  const [localPlan, setLocalPlan] = useState<LiftingPlanRecord | null>(plan);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [benchReport, setBenchReport] = useState<BenchmarkSuiteReport | null>(null);
  const [benchLoading, setBenchLoading] = useState(false);
  const [showStiffnessEditor, setShowStiffnessEditor] = useState(true);
  const [showCompositeCog, setShowCompositeCog] = useState(false);

  useEffect(() => {
    setLocalPlan(plan ? JSON.parse(JSON.stringify(plan)) : null);
    setIsDirty(false);
  }, [plan]);

  const mutateLocal = (updater: (prev: LiftingPlanRecord) => LiftingPlanRecord) => {
    setLocalPlan((prev) => {
      if (!prev) return prev;
      setIsDirty(true);
      return updater(prev);
    });
  };

  const primaryCrane = useMemo(
    () => cranes.find((c) => c.id === Number(localPlan?.craneSetup?.primaryCraneId)) || null,
    [cranes, localPlan?.craneSetup?.primaryCraneId]
  );

  const verifiedGates = useMemo(
    () => stageGates.filter((g) => g.status === 'VERIFIED').map((g) => g.gateCode),
    [stageGates]
  );

  // Real-time client preview matching server solver 1:1 (authoritative verification happens on server save)
  const liveEval: FullPlanEvaluationResult | null = useMemo(() => {
    if (!localPlan) return null;
    const len = Math.max(1, Number(localPlan.loadDimensions?.lengthM || 6));
    const wid = Math.max(0.8, Number(localPlan.loadDimensions?.widthM || localPlan.loadDimensions?.diameterM || 2.2));
    const hgt = Math.max(0.8, Number(localPlan.loadDimensions?.heightM || localPlan.loadDimensions?.diameterM || 2.2));
    const arr = localPlan.riggingSetup?.arrangementType;
    const legCount =
      arr === 'SINGLE_LEG'
        ? 1
        : arr === 'TWO_LEG'
          ? 2
          : arr === 'THREE_LEG'
            ? 3
            : Number(localPlan.riggingSetup?.legCount || 4);
    const halfL = len * 0.35;
    const halfW = wid * 0.35;
    const topY = hgt * 0.5;

    const attachmentPoints =
      Array.isArray(localPlan.riggingSetup?.attachmentPoints) && localPlan.riggingSetup.attachmentPoints.length > 0
        ? localPlan.riggingSetup.attachmentPoints
        : legCount === 1
          ? [{ id: 'P1', label: 'تک‌نقطه‌ای', position: { x: 0, y: topY, z: 0 } }]
          : legCount === 2
            ? [
                { id: 'P1', label: 'گوشواره ۱ (-X)', position: { x: -halfL, y: topY, z: 0 } },
                { id: 'P2', label: 'گوشواره ۲ (+X)', position: { x: halfL, y: topY, z: 0 } },
              ]
            : legCount === 3
              ? [
                  { id: 'P1', label: 'P1 (+X)', position: { x: halfL, y: topY, z: 0 } },
                  { id: 'P2', label: 'P2 (-X,+Z)', position: { x: -halfL * 0.7, y: topY, z: halfW } },
                  { id: 'P3', label: 'P3 (-X,-Z)', position: { x: -halfL * 0.7, y: topY, z: -halfW } },
                ]
              : [
                  { id: 'P1', label: 'P1 (+X,+Z)', position: { x: halfL, y: topY, z: halfW } },
                  { id: 'P2', label: 'P2 (-X,+Z)', position: { x: -halfL, y: topY, z: halfW } },
                  { id: 'P3', label: 'P3 (-X,-Z)', position: { x: -halfL, y: topY, z: -halfW } },
                  { id: 'P4', label: 'P4 (+X,-Z)', position: { x: halfL, y: topY, z: -halfW } },
                ];

    const selectedSling = rigging.find((r) => localPlan.riggingSetup?.slingIds?.includes(r.id));
    const selectedShackle = rigging.find((r) => localPlan.riggingSetup?.shackleIds?.includes(r.id));

    return evaluateFullLiftingPlan({
      liftCategory: localPlan.liftCategory,
      unitPreferences: localPlan.unitPreferences,
      verifiedGates: verifiedGates.length > 0 ? verifiedGates : ['G1', 'G2'],
      crane: primaryCrane
        ? {
            craneId: primaryCrane.id,
            craneName: primaryCrane.name,
            boomLengthM: Number(localPlan.craneSetup?.boomLengthM || 0),
            radiusM: Number(localPlan.craneSetup?.radiusM || 0),
            outriggerConfig: String(localPlan.craneSetup?.outriggerConfig || '100_OUTRIGGERS'),
            counterweightTon: localPlan.craneSetup?.counterweightTon ?? primaryCrane.counterweightTon,
            outriggerSpreadM: Number(localPlan.craneSetup?.outriggerSpreadM || primaryCrane.outriggerSpreadM || 7.5),
            craneDeadWeightTon: localPlan.craneSetup?.craneDeadWeightTon ?? primaryCrane.deadWeightTon ?? undefined,
            outriggerPadAreaM2: localPlan.craneSetup?.outriggerPadAreaM2 ?? primaryCrane.defaultOutriggerPadAreaM2 ?? undefined,
            chartPoints: primaryCrane.loadChartRows.map((r) => ({
              outriggerConfig: r.outriggerConfig,
              counterweightTon: r.counterweightTon,
              boomLengthM: r.boomLengthM,
              radiusM: r.radiusM,
              ratedCapacityTon: r.ratedCapacityTon,
            })),
            maxAllowableUtilizationPct: Number(localPlan.craneSetup?.maxUtilizationPct || 85),
          }
        : {
            craneId: null,
            boomLengthM: Number(localPlan.craneSetup?.boomLengthM || 0),
            radiusM: Number(localPlan.craneSetup?.radiusM || 0),
            outriggerConfig: String(localPlan.craneSetup?.outriggerConfig || '100_OUTRIGGERS'),
            chartPoints: [],
          },
      rigging: {
        arrangementType: localPlan.riggingSetup?.arrangementType,
        netLoadWeightTon: Number(localPlan.netLoadWeightTon || 0),
        riggingAccessoryWeightTon: Number(localPlan.riggingAccessoryWeightTon || 0),
        hookBlockWeightTon: Number(localPlan.hookBlockWeightTon || 0.6),
        spreaderBeamWeightTon: localPlan.riggingSetup?.spreaderBeamWeightTon,
        weightComponents: localPlan.riggingSetup?.weightComponents,
        dynamicFactor: Number(localPlan.dynamicFactor || 1.1),
        cogOffset: localPlan.cogOffset || { x: 0, y: 0, z: 0 },
        hookPosition: {
          x: Number(localPlan.riggingSetup?.hookX || 0),
          y: Number(localPlan.riggingSetup?.hookHeightM || topY + 2.8),
          z: Number(localPlan.riggingSetup?.hookZ || 0),
        },
        attachmentPoints,
        hitchType: (localPlan.riggingSetup?.hitchType || 'VERTICAL') as 'VERTICAL' | 'CHOKER' | 'BASKET',
        hasEqualizer: Boolean(localPlan.riggingSetup?.hasEqualizer),
        equalizerPairs: localPlan.riggingSetup?.equalizerPairs,
        enforceThreeLegEffectiveForFourLeg: Boolean(localPlan.riggingSetup?.enforceThreeLegEffectiveForFourLeg),
        slingWllTon: Number(localPlan.riggingSetup?.slingWllTon || selectedSling?.wllTon || 0) || undefined,
        shackleWllTon: Number(localPlan.riggingSetup?.shackleWllTon || selectedShackle?.wllTon || 0) || undefined,
        shackleLateralAngleDeg: localPlan.riggingSetup?.shackleLateralAngleDeg,
        shacklePinDiameterMm: localPlan.riggingSetup?.shacklePinDiameterMm,
        lugHoleDiameterMm: localPlan.riggingSetup?.lugHoleDiameterMm,
        sensitivityUncertainties: localPlan.riggingSetup?.sensitivityUncertainties,
      },
      windSpeedMs: localPlan.craneSetup?.windSpeedMs,
      groundBearingMaxKpa: localPlan.craneSetup?.groundBearingMaxKpa,
      equipmentCertsValid: primaryCrane ? primaryCrane.certExpiryState !== 'EXPIRED' && primaryCrane.status === 'ACTIVE' : true,
      personnelQualified: Boolean(localPlan.personnelAssignment?.operatorName && localPlan.personnelAssignment?.riggerName),
    });
  }, [localPlan, primaryCrane, rigging, verifiedGates]);

  if (!localPlan) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center space-y-3">
        <Calculator className="w-10 h-10 text-slate-400 mx-auto" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
          هیچ طرح باربرداری فعالی انتخاب نشده است
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          از منوی بالای صفحه یک طرح باربرداری را انتخاب کنید یا طرح جدیدی ثبت نمایید.
        </p>
        {canWrite && onCreateNewPlan && (
          <button
            type="button"
            onClick={onCreateNewPlan}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت طرح باربرداری جدید</span>
          </button>
        )}
      </div>
    );
  }

  const handleSaveToServer = async () => {
    setSaving(true);
    try {
      const { plan: updatedPlan, revisionBumped } = await liftingApi.updatePlan(localPlan.id, {
        netLoadWeightTon: localPlan.netLoadWeightTon,
        riggingAccessoryWeightTon: localPlan.riggingAccessoryWeightTon,
        hookBlockWeightTon: localPlan.hookBlockWeightTon,
        dynamicFactor: localPlan.dynamicFactor,
        loadDimensions: localPlan.loadDimensions,
        cogOffset: localPlan.cogOffset,
        craneSetup: localPlan.craneSetup,
        riggingSetup: localPlan.riggingSetup,
        unitPreferences: localPlan.unitPreferences,
        changeReason: 'به‌روزرسانی محاسبات مهندسی و آرایش باربرداری',
      });
      const snap = viewportRef.current?.captureSnapshot();
      if (snap && onCaptureSnapshot) onCaptureSnapshot(snap);
      setIsDirty(false);
      onToast(
        revisionBumped
          ? `محاسبات روی سرور صحه‌گذاری و نسخه طرح به R${updatedPlan.revisionNumber} ارتقا یافت (بازبینی تأییدیه‌ها الزامی شد).`
          : 'محاسبات روی سرور صحه‌گذاری و در پایگاه داده ذخیره شد.',
        'success'
      );
      await onSaveAndRefresh();
    } catch (err: any) {
      onToast(err?.message || 'خطا در ثبت محاسبات مهندسی', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRunBenchmark = async () => {
    setBenchLoading(true);
    try {
      const report = await liftingApi.runBenchmarkSuite();
      setBenchReport(report);
      onToast(
        report.allPassed
          ? `تمامی ${report.totalCases} سناریوی بنچمارک موتور با دقت مهندسی پاس شدند.`
          : `${report.failedCases} مورد از تست‌های بنچمارک ناموفق بود.`,
        report.allPassed ? 'success' : 'error'
      );
    } catch (err: any) {
      onToast(err?.message || 'خطا در اجرای بنچمارک موتور', 'error');
    } finally {
      setBenchLoading(false);
    }
  };

  const currentMassUnit = localPlan.unitPreferences?.massUnit || 'ton';
  const currentLengthUnit = localPlan.unitPreferences?.lengthUnit || 'm';

  return (
    <div className="space-y-6">
      {/* Top Action & Authoritative Status Strip */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-bold text-slate-900 dark:text-white">{localPlan.planCode}</span>
              <span>·</span>
              <span>{localPlan.title}</span>
              <span>·</span>
              <StatusBadge status={isDirty ? 'NOT_VERIFIED' : liveEval?.overallStatus} size="md" />
              <span className="px-2 py-0.5 rounded border text-[10px] font-mono font-bold bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                Engine v{liveEval?.engineVersion || LIFTING_ENGINE_VERSION}
              </span>
              {liveEval?.validationTier === 'VERIFIED_CORE' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 text-[10px] font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>موتور پایه راستی‌آزمایی‌شده</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700 text-[10px] font-bold">
                  <FlaskConical className="w-3 h-3" />
                  <span>ماژول آزمایشی / نیازمند تایید دروازه</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              محاسبات با دقت کامل ممیز شناور در سیستم SI انجام شده و در انتها برای نمایش گرد می‌شوند. هرگونه تغییر ورودی نتایج قبلی سرور را تا زمان ذخیره مجدد باطل می‌کند.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunBenchmark}
              disabled={benchLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
            >
              <FlaskConical className={`w-4 h-4 text-sky-600 ${benchLoading ? 'animate-pulse' : ''}`} />
              <span>{benchLoading ? 'در حال آزمون...' : 'اجرای بنچمارک ۱۵گانه موتور'}</span>
            </button>

            {canWrite && (
              <button
                type="button"
                onClick={handleSaveToServer}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>ثبت و صحه‌گذاری رسمی در سرور</span>
              </button>
            )}
          </div>
        </div>

        {isDirty && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              ورودی‌ها تغییر کرده‌اند و محاسبات قبلی ثبت‌شده در پایگاه داده منقضی محسوب می‌شوند (NOT VERIFIED). برای ثبت قطعی روی سرور ذخیره کنید.
            </span>
          </div>
        )}
      </div>

      {/* Collapsible Live Benchmark Report */}
      {benchReport && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-sky-600" />
              <span>
                گزارش اعتبارسنجی مستقل موتور (v{benchReport.engineVersion}) — {benchReport.passedCases} از {benchReport.totalCases} موفق
              </span>
            </div>
            <button
              type="button"
              onClick={() => setBenchReport(null)}
              className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              بستن گزارش
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-right">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-1.5 px-2">کد</th>
                  <th className="py-1.5 px-2">گروه سناریو</th>
                  <th className="py-1.5 px-2">روش مرجع</th>
                  <th className="py-1.5 px-2">انتظار</th>
                  <th className="py-1.5 px-2">محاسبه موتور</th>
                  <th className="py-1.5 px-2">اختلاف (%)</th>
                  <th className="py-1.5 px-2">تلورانس</th>
                  <th className="py-1.5 px-2">نتیجه</th>
                  <th className="py-1.5 px-2">استاندارد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 tabular-nums">
                {benchReport.cases.map((tc) => (
                  <tr key={tc.testId}>
                    <td className="py-1.5 px-2 font-mono font-bold">{tc.testId}</td>
                    <td className="py-1.5 px-2 font-bold">{tc.scenarioGroup}</td>
                    <td className="py-1.5 px-2 text-slate-500 font-mono text-[10px]">{tc.method}</td>
                    <td className="py-1.5 px-2 font-mono">{tc.expectedValue} {tc.unit}</td>
                    <td className="py-1.5 px-2 font-mono font-bold">{tc.actualValue} {tc.unit}</td>
                    <td className="py-1.5 px-2 font-mono">{tc.relDiffPct ?? 0}%</td>
                    <td className="py-1.5 px-2 font-mono">{tc.tolerancePct ?? 0}%</td>
                    <td className="py-1.5 px-2">
                      <StatusBadge status={tc.passed ? 'PASS' : 'FAIL'} />
                    </td>
                    <td className="py-1.5 px-2 text-[10px] font-mono text-slate-500">{tc.standardRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Split: Parametric Inputs + Interactive 3D Viewport */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 5 cols: Parameters */}
        <div className="xl:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-sky-600" />
              <h3 className="font-black text-slate-900 dark:text-white text-sm">پارامترهای بار، CoG، اسلینگ و جرثقیل</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <select
                value={currentMassUnit}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    unitPreferences: {
                      massUnit: e.target.value as any,
                      lengthUnit: p.unitPreferences?.lengthUnit || 'm',
                      pressureUnit: p.unitPreferences?.pressureUnit || 'kPa',
                      windUnit: p.unitPreferences?.windUnit || 'm/s',
                    },
                  }))
                }
                className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono"
                title="واحد جرم ورودی"
              >
                <option value="ton">ton</option>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
              <select
                value={currentLengthUnit}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    unitPreferences: {
                      massUnit: p.unitPreferences?.massUnit || 'ton',
                      lengthUnit: e.target.value as any,
                      pressureUnit: p.unitPreferences?.pressureUnit || 'kPa',
                      windUnit: p.unitPreferences?.windUnit || 'm/s',
                    },
                  }))
                }
                className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 font-mono"
                title="واحد طول ورودی"
              >
                <option value="m">m</option>
                <option value="mm">mm</option>
                <option value="ft">ft</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold mb-1">وزن خالص بار ({currentMassUnit})</label>
              <input
                type="number"
                step="0.1"
                value={localPlan.netLoadWeightTon}
                onChange={(e) => mutateLocal((p) => ({ ...p, netLoadWeightTon: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">ضریب دینامیکی (DAF ≥ 1.0)</label>
              <input
                type="number"
                step="0.05"
                min="1"
                value={localPlan.dynamicFactor}
                onChange={(e) => mutateLocal((p) => ({ ...p, dynamicFactor: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">وزن ادوات Rigging ({currentMassUnit})</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={localPlan.riggingAccessoryWeightTon}
                onChange={(e) => mutateLocal((p) => ({ ...p, riggingAccessoryWeightTon: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">وزن هوک‌بلاک ({currentMassUnit})</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={localPlan.hookBlockWeightTon}
                onChange={(e) => mutateLocal((p) => ({ ...p, hookBlockWeightTon: Number(e.target.value) }))}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-bold mb-1">وزن Spreader Beam / شاهین ({currentMassUnit})</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={localPlan.riggingSetup?.spreaderBeamWeightTon ?? 0}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    riggingSetup: { ...(p.riggingSetup || {}), spreaderBeamWeightTon: Number(e.target.value) },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold mb-1">آفست CoG X ({currentLengthUnit})</label>
              <input
                type="number"
                step="0.1"
                value={localPlan.cogOffset?.x ?? 0}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    cogOffset: { ...(p.cogOffset || { x: 0, y: 0, z: 0 }), x: Number(e.target.value) },
                  }))
                }
                className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">آفست CoG Z ({currentLengthUnit})</label>
              <input
                type="number"
                step="0.1"
                value={localPlan.cogOffset?.z ?? 0}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    cogOffset: { ...(p.cogOffset || { x: 0, y: 0, z: 0 }), z: Number(e.target.value) },
                  }))
                }
                className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">ارتفاع قلاب ({currentLengthUnit})</label>
              <input
                type="number"
                step="0.2"
                min="0.5"
                value={localPlan.riggingSetup?.hookHeightM ?? 4.5}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    riggingSetup: { ...(p.riggingSetup || {}), hookHeightM: Number(e.target.value) },
                  }))
                }
                className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block font-bold mb-1">جرثقیل انتخاب‌شده</label>
              <select
                value={localPlan.craneSetup?.primaryCraneId || ''}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    craneSetup: { ...(p.craneSetup || {}), primaryCraneId: Number(e.target.value) || undefined },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              >
                <option value="">-- انتخاب جرثقیل --</option>
                {cranes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.model} · {c.loadChartRows.length} ردیف چارت)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">طول بوم ({currentLengthUnit})</label>
              <input
                type="number"
                step="0.5"
                value={localPlan.craneSetup?.boomLengthM ?? 24}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    craneSetup: { ...(p.craneSetup || {}), boomLengthM: Number(e.target.value) },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">شعاع کار ({currentLengthUnit})</label>
              <input
                type="number"
                step="0.5"
                value={localPlan.craneSetup?.radiusM ?? 12}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    craneSetup: { ...(p.craneSetup || {}), radiusM: Number(e.target.value) },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">وزن واقعی جرثقیل ({currentMassUnit})</label>
              <input
                type="number"
                step="0.5"
                value={localPlan.craneSetup?.craneDeadWeightTon ?? ''}
                placeholder="از کاتالوگ"
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    craneSetup: { ...(p.craneSetup || {}), craneDeadWeightTon: e.target.value ? Number(e.target.value) : undefined },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">مساحت زیرجکی (m²)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={localPlan.craneSetup?.outriggerPadAreaM2 ?? ''}
                placeholder="پیش‌فرض 1.0"
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    craneSetup: { ...(p.craneSetup || {}), outriggerPadAreaM2: e.target.value ? Number(e.target.value) : undefined },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">سرعت باد (m/s)</label>
              <input
                type="number"
                step="0.5"
                value={localPlan.craneSetup?.windSpeedMs ?? 7}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    craneSetup: { ...(p.craneSetup || {}), windSpeedMs: Number(e.target.value) },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">تحمل مجاز خاک (kPa)</label>
              <input
                type="number"
                step="10"
                value={localPlan.craneSetup?.groundBearingMaxKpa ?? 250}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    craneSetup: { ...(p.craneSetup || {}), groundBearingMaxKpa: Number(e.target.value) },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">ظرفیت مجاز اسلینگ WLL ({currentMassUnit})</label>
              <input
                type="number"
                step="0.5"
                value={localPlan.riggingSetup?.slingWllTon ?? ''}
                placeholder="خودکار یا دستی"
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    riggingSetup: { ...(p.riggingSetup || {}), slingWllTon: Number(e.target.value) || undefined },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">ظرفیت مجاز شگل WLL ({currentMassUnit})</label>
              <input
                type="number"
                step="0.5"
                value={localPlan.riggingSetup?.shackleWllTon ?? ''}
                placeholder="خودکار یا دستی"
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    riggingSetup: { ...(p.riggingSetup || {}), shackleWllTon: Number(e.target.value) || undefined },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">زاویه جانبی شگل (deg)</label>
              <input
                type="number"
                step="1"
                min="0"
                max="90"
                value={localPlan.riggingSetup?.shackleLateralAngleDeg ?? 0}
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    riggingSetup: { ...(p.riggingSetup || {}), shackleLateralAngleDeg: Number(e.target.value) },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">قطر پین شگل (mm)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={localPlan.riggingSetup?.shacklePinDiameterMm ?? ''}
                placeholder="اختیاری"
                onChange={(e) =>
                  mutateLocal((p) => ({
                    ...p,
                    riggingSetup: { ...(p.riggingSetup || {}), shacklePinDiameterMm: e.target.value ? Number(e.target.value) : undefined },
                  }))
                }
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Static Determinacy Arrangement, Equalizer & Hitch */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-sky-600" />
              <span>آرایش سیستم Rigging و معینی استاتیکی</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold mb-1">آرایش اسلینگ‌ها</label>
                <select
                  value={localPlan.riggingSetup?.arrangementType || 'FOUR_LEG'}
                  onChange={(e) => {
                    const arr = e.target.value as any;
                    const len = Math.max(1, Number(localPlan.loadDimensions?.lengthM || 6));
                    const wid = Math.max(0.8, Number(localPlan.loadDimensions?.widthM || localPlan.loadDimensions?.diameterM || 2.2));
                    const hgt = Math.max(0.8, Number(localPlan.loadDimensions?.heightM || localPlan.loadDimensions?.diameterM || 2.2));
                    const halfL = Number((len * 0.35).toFixed(2));
                    const halfW = Number((wid * 0.35).toFixed(2));
                    const topY = Number((hgt * 0.5).toFixed(2));
                    const preset =
                      arr === 'SINGLE_LEG'
                        ? [{ id: 'P1', label: 'تک‌نقطه‌ای', position: { x: 0, y: topY, z: 0 } }]
                        : arr === 'TWO_LEG'
                          ? [
                              { id: 'P1', label: 'P1 (-X)', position: { x: -halfL, y: topY, z: 0 } },
                              { id: 'P2', label: 'P2 (+X)', position: { x: halfL, y: topY, z: 0 } },
                            ]
                          : arr === 'THREE_LEG'
                            ? [
                                { id: 'P1', label: 'P1 (+X)', position: { x: halfL, y: topY, z: 0 } },
                                { id: 'P2', label: 'P2 (-X,+Z)', position: { x: -Number((halfL * 0.7).toFixed(2)), y: topY, z: halfW } },
                                { id: 'P3', label: 'P3 (-X,-Z)', position: { x: -Number((halfL * 0.7).toFixed(2)), y: topY, z: -halfW } },
                              ]
                            : [
                                { id: 'P1', label: 'P1 (+X,+Z)', position: { x: halfL, y: topY, z: halfW } },
                                { id: 'P2', label: 'P2 (-X,+Z)', position: { x: -halfL, y: topY, z: halfW } },
                                { id: 'P3', label: 'P3 (-X,-Z)', position: { x: -halfL, y: topY, z: -halfW } },
                                { id: 'P4', label: 'P4 (+X,-Z)', position: { x: halfL, y: topY, z: -halfW } },
                              ];
                    mutateLocal((p) => ({
                      ...p,
                      riggingSetup: {
                        ...(p.riggingSetup || {}),
                        arrangementType: arr,
                        legCount: preset.length,
                        attachmentPoints: preset,
                      },
                    }));
                  }}
                  className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="SINGLE_LEG">تک‌شاخه (۱ نقطه - معین)</option>
                  <option value="TWO_LEG">دو شاخه (۲ نقطه - معین)</option>
                  <option value="THREE_LEG">سه شاخه (۳ نقطه - معین)</option>
                  <option value="FOUR_LEG">چهار شاخه (نامعین در نبود Equalizer)</option>
                  <option value="MULTI_LEG">چند شاخه سفارشی</option>
                  <option value="BRIDLE">Bridle چندنقطه‌ای</option>
                  <option value="SPREADER_BEAM">Spreader Beam (تیر توزیع)</option>
                  <option value="LIFTING_BEAM">Lifting Beam (تیر باربرداری)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">نوع بست (Hitch)</label>
                <select
                  value={localPlan.riggingSetup?.hitchType || 'VERTICAL'}
                  onChange={(e) =>
                    mutateLocal((p) => ({
                      ...p,
                      riggingSetup: { ...(p.riggingSetup || {}), hitchType: e.target.value },
                    }))
                  }
                  className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="VERTICAL">Vertical (×1.00)</option>
                  <option value="CHOKER">Choker (×0.75)</option>
                  <option value="BASKET">Basket (×1.80)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(localPlan.riggingSetup?.hasEqualizer)}
                  onChange={(e) =>
                    mutateLocal((p) => ({
                      ...p,
                      riggingSetup: { ...(p.riggingSetup || {}), hasEqualizer: e.target.checked },
                    }))
                  }
                  className="accent-sky-600"
                />
                <span>استفاده از مکانیزم متعادل‌کننده (Equalizer / Pulley Sheave)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(localPlan.riggingSetup?.enforceThreeLegEffectiveForFourLeg)}
                  onChange={(e) =>
                    mutateLocal((p) => ({
                      ...p,
                      riggingSetup: { ...(p.riggingSetup || {}), enforceThreeLegEffectiveForFourLeg: e.target.checked },
                    }))
                  }
                  className="accent-amber-600"
                />
                <span>محاسبه پوش ۳ شاخه مؤثر ASME B30.9 در نبود داده سختی EA (وضعیت NOT_VERIFIED)</span>
              </label>
            </div>

            {/* Toggleable Composite Weight & CoG Components */}
            <div className="pt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowStiffnessEditor((v) => !v)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold whitespace-nowrap cursor-pointer"
              >
                {showStiffnessEditor ? 'بستن جدول مختصات و سختی شاخه‌ها' : 'مختصات 3D و سختی شاخه‌ها'}
              </button>
              <button
                type="button"
                onClick={() => setShowCompositeCog((v) => !v)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold whitespace-nowrap cursor-pointer"
              >
                {showCompositeCog ? 'بستن اجزای جرم و CoG مرکب' : 'محاسبه CoG مرکب و عدم‌قطعیت'}
              </button>
            </div>

            {showCompositeCog && (
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">اجزای وزنی و مرکز ثقل مرکب (Weight Components)</span>
                  <button
                    type="button"
                    onClick={() =>
                      mutateLocal((p) => ({
                        ...p,
                        riggingSetup: {
                          ...(p.riggingSetup || {}),
                          weightComponents: [
                            ...(p.riggingSetup?.weightComponents || []),
                            {
                              id: `C${(p.riggingSetup?.weightComponents?.length || 0) + 1}`,
                              label: 'جزء جدید',
                              category: 'LOAD',
                              weightTon: 1,
                              cogPosition: { x: 0, y: 0, z: 0 },
                            },
                          ],
                        },
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-600 text-white font-bold cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>افزودن جزء</span>
                  </button>
                </div>
                {(localPlan.riggingSetup?.weightComponents || []).map((wc, wIdx) => (
                  <div key={wc.id || wIdx} className="grid grid-cols-12 gap-1 items-center text-[10px]">
                    <input
                      value={wc.label}
                      onChange={(e) =>
                        mutateLocal((p) => {
                          const list = [...(p.riggingSetup?.weightComponents || [])];
                          list[wIdx] = { ...list[wIdx], label: e.target.value };
                          return { ...p, riggingSetup: { ...(p.riggingSetup || {}), weightComponents: list } };
                        })
                      }
                      className="col-span-4 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                    />
                    <select
                      value={wc.category}
                      onChange={(e) =>
                        mutateLocal((p) => {
                          const list = [...(p.riggingSetup?.weightComponents || [])];
                          list[wIdx] = { ...list[wIdx], category: e.target.value as any };
                          return { ...p, riggingSetup: { ...(p.riggingSetup || {}), weightComponents: list } };
                        })
                      }
                      className="col-span-2 px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                    >
                      <option value="LOAD">LOAD</option>
                      <option value="AUX">AUX</option>
                      <option value="SPREADER">SPREADER</option>
                      <option value="RIGGING">RIGGING</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      value={wc.weightTon}
                      onChange={(e) =>
                        mutateLocal((p) => {
                          const list = [...(p.riggingSetup?.weightComponents || [])];
                          list[wIdx] = { ...list[wIdx], weightTon: Number(e.target.value) };
                          return { ...p, riggingSetup: { ...(p.riggingSetup || {}), weightComponents: list } };
                        })
                      }
                      className="col-span-2 px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                      title="وزن (ton)"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={wc.cogPosition?.x ?? 0}
                      onChange={(e) =>
                        mutateLocal((p) => {
                          const list = [...(p.riggingSetup?.weightComponents || [])];
                          list[wIdx] = { ...list[wIdx], cogPosition: { ...(list[wIdx].cogPosition || { x: 0, y: 0, z: 0 }), x: Number(e.target.value) } };
                          return { ...p, riggingSetup: { ...(p.riggingSetup || {}), weightComponents: list } };
                        })
                      }
                      className="col-span-2 px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                      title="CoG X"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={wc.cogPosition?.z ?? 0}
                      onChange={(e) =>
                        mutateLocal((p) => {
                          const list = [...(p.riggingSetup?.weightComponents || [])];
                          list[wIdx] = { ...list[wIdx], cogPosition: { ...(list[wIdx].cogPosition || { x: 0, y: 0, z: 0 }), z: Number(e.target.value) } };
                          return { ...p, riggingSetup: { ...(p.riggingSetup || {}), weightComponents: list } };
                        })
                      }
                      className="col-span-1 px-1 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                      title="CoG Z"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        mutateLocal((p) => ({
                          ...p,
                          riggingSetup: {
                            ...(p.riggingSetup || {}),
                            weightComponents: (p.riggingSetup?.weightComponents || []).filter((_, i) => i !== wIdx),
                          },
                        }))
                      }
                      className="col-span-1 text-red-500 hover:text-red-700 flex justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-1.5 text-[10px]">
                  <div>
                    <label className="block text-slate-500">خطای وزن ±%</label>
                    <input
                      type="number"
                      step="1"
                      value={localPlan.riggingSetup?.sensitivityUncertainties?.weightPct ?? 5}
                      onChange={(e) =>
                        mutateLocal((p) => ({
                          ...p,
                          riggingSetup: {
                            ...(p.riggingSetup || {}),
                            sensitivityUncertainties: { ...(p.riggingSetup?.sensitivityUncertainties || {}), weightPct: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500">تلورانس CoG ±m</label>
                    <input
                      type="number"
                      step="0.05"
                      value={localPlan.riggingSetup?.sensitivityUncertainties?.cogShiftM ?? 0.25}
                      onChange={(e) =>
                        mutateLocal((p) => ({
                          ...p,
                          riggingSetup: {
                            ...(p.riggingSetup || {}),
                            sensitivityUncertainties: { ...(p.riggingSetup?.sensitivityUncertainties || {}), cogShiftM: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500">تلورانس طول +mm</label>
                    <input
                      type="number"
                      step="1"
                      value={localPlan.riggingSetup?.sensitivityUncertainties?.slingToleranceMm ?? 10}
                      onChange={(e) =>
                        mutateLocal((p) => ({
                          ...p,
                          riggingSetup: {
                            ...(p.riggingSetup || {}),
                            sensitivityUncertainties: { ...(p.riggingSetup?.sensitivityUncertainties || {}), slingToleranceMm: Number(e.target.value) },
                          },
                        }))
                      }
                      className="w-full px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 7 cols: Interactive 3D Viewport */}
        <div className="xl:col-span-7 space-y-4">
          <Lifting3DViewport
            ref={viewportRef}
            plan={localPlan}
            crane={primaryCrane}
            evaluation={liveEval}
            onSnapshot={(url) => {
              onCaptureSnapshot?.(url);
              onToast('تصویر 3D با موفقیت برای گزارش مهندسی ثبت شد.', 'success');
            }}
          />

          {/* Blockers & Warnings Banner */}
          {liveEval && (liveEval.blockers.length > 0 || liveEval.warnings.length > 0) && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-xs">
              {liveEval.blockers.map((b, i) => (
                <div key={`bl-${i}`} className="flex items-start gap-2 text-red-700 dark:text-red-400 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </div>
              ))}
              {liveEval.warnings.map((w, i) => (
                <div key={`wn-${i}`} className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Static Determinacy & 6-DOF Residuals + Per-Leg Geometry/Stiffness Matrix Editor */}
      {showStiffnessEditor && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h4 className="font-black text-slate-900 dark:text-white">
                مشخصات هندسی سه‌بعدی، سختی محوری (EA) و تلورانس طول هر شاخه اسلینگ
              </h4>
              <p className="text-[11px] text-slate-500">
                برای سیستم‌های نامعین (۴ شاخه به بالا بدون Equalizer)، ورود سختی محوری EA (kN) یا مدول الاستیسیته + سطح مقطع جهت حل ماتریس سازگاری تغییرشکل الزامی است.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  mutateLocal((p) => {
                    const pts: AttachmentPointInput[] =
                      p.riggingSetup?.attachmentPoints && p.riggingSetup.attachmentPoints.length > 0
                        ? p.riggingSetup.attachmentPoints
                        : (liveEval?.riggingResult?.legs || []).map((l) => ({
                            id: l.id,
                            label: l.label,
                            position: l.attachmentPos,
                          }));
                    return {
                      ...p,
                      riggingSetup: {
                        ...(p.riggingSetup || {}),
                        attachmentPoints: pts.map((pt) => ({
                          ...pt,
                          materialType: pt.materialType || 'WIRE_ROPE',
                          elasticModulusGpa: pt.elasticModulusGpa || 110,
                          metallicAreaMm2: pt.metallicAreaMm2 || 380,
                          axialStiffnessKn: pt.axialStiffnessKn || 41800,
                        })),
                      },
                    };
                  })
                }
                className="px-2.5 py-1 rounded border border-sky-300 text-sky-700 dark:text-sky-300 dark:border-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/30 font-bold whitespace-nowrap cursor-pointer"
              >
                ثبت سختی سیم‌بکسل IWRC (41,800 kN)
              </button>
              <button
                type="button"
                onClick={() =>
                  mutateLocal((p) => {
                    const base = p.riggingSetup?.attachmentPoints || [];
                    const idx = base.length + 1;
                    return {
                      ...p,
                      riggingSetup: {
                        ...(p.riggingSetup || {}),
                        attachmentPoints: [
                          ...base,
                          {
                            id: `P${idx}`,
                            label: `نقطه ${idx}`,
                            position: { x: 0, y: 1, z: 0 },
                          },
                        ],
                      },
                    };
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن نقطه آویز</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-right">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-1.5 px-1.5">شناسه / برچسب</th>
                  <th className="py-1.5 px-1.5">X ({currentLengthUnit})</th>
                  <th className="py-1.5 px-1.5">Y ({currentLengthUnit})</th>
                  <th className="py-1.5 px-1.5">Z ({currentLengthUnit})</th>
                  <th className="py-1.5 px-1.5">جنس شاخه</th>
                  <th className="py-1.5 px-1.5">سختی EA (kN)</th>
                  <th className="py-1.5 px-1.5">تلورانس ΔL (mm)</th>
                  <th className="py-1.5 px-1.5">WLL خاص (t)</th>
                  <th className="py-1.5 px-1.5">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 tabular-nums">
                {(localPlan.riggingSetup?.attachmentPoints ||
                  (liveEval?.riggingResult?.legs || []).map((l) => ({
                    id: l.id,
                    label: l.label,
                    position: l.attachmentPos,
                  }))
                ).map((pt: any, idx: number, arr: any[]) => {
                  const updatePt = (patch: Record<string, any>) =>
                    mutateLocal((p) => {
                      const curr =
                        p.riggingSetup?.attachmentPoints && p.riggingSetup.attachmentPoints.length > 0
                          ? [...p.riggingSetup.attachmentPoints]
                          : arr.map((x) => ({ ...x }));
                      curr[idx] = { ...curr[idx], ...patch };
                      return {
                        ...p,
                        riggingSetup: { ...(p.riggingSetup || {}), attachmentPoints: curr },
                      };
                    });

                  return (
                    <tr key={pt.id || idx}>
                      <td className="py-1.5 px-1">
                        <input
                          value={pt.label}
                          onChange={(e) => updatePt({ label: e.target.value })}
                          className="w-28 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <input
                          type="number"
                          step="0.1"
                          value={pt.position?.x ?? 0}
                          onChange={(e) => updatePt({ position: { ...pt.position, x: Number(e.target.value) } })}
                          className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <input
                          type="number"
                          step="0.1"
                          value={pt.position?.y ?? 0}
                          onChange={(e) => updatePt({ position: { ...pt.position, y: Number(e.target.value) } })}
                          className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <input
                          type="number"
                          step="0.1"
                          value={pt.position?.z ?? 0}
                          onChange={(e) => updatePt({ position: { ...pt.position, z: Number(e.target.value) } })}
                          className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <select
                          value={pt.materialType || 'WIRE_ROPE'}
                          onChange={(e) => updatePt({ materialType: e.target.value })}
                          className="px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                        >
                          <option value="WIRE_ROPE">سیم‌بکسل (IWRC)</option>
                          <option value="ALLOY_CHAIN">زنجیر آلیاژی</option>
                          <option value="SYNTHETIC_WEB">تسمه بافته</option>
                          <option value="SYNTHETIC_ROUND">اسلینگ راند</option>
                        </select>
                      </td>
                      <td className="py-1.5 px-1">
                        <input
                          type="number"
                          step="500"
                          placeholder="ناوارد (Not Verified)"
                          value={pt.axialStiffnessKn ?? ''}
                          onChange={(e) =>
                            updatePt({ axialStiffnessKn: e.target.value ? Number(e.target.value) : undefined })
                          }
                          className="w-28 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <input
                          type="number"
                          step="1"
                          value={pt.lengthToleranceMm ?? 0}
                          onChange={(e) => updatePt({ lengthToleranceMm: Number(e.target.value) })}
                          className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-1">
                        <input
                          type="number"
                          step="0.5"
                          placeholder="پیش‌فرض"
                          value={pt.customWllTon ?? ''}
                          onChange={(e) =>
                            updatePt({ customWllTon: e.target.value ? Number(e.target.value) : undefined })
                          }
                          className="w-16 px-1.5 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-1 text-center">
                        {arr.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              mutateLocal((p) => ({
                                ...p,
                                riggingSetup: {
                                  ...(p.riggingSetup || {}),
                                  attachmentPoints: arr.filter((_, i) => i !== idx),
                                },
                              }))
                            }
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                            title="حذف نقطه"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results Grids: Crane Chart Lookup + Load Cases & Static Determinacy 6-DOF Residuals */}
      {liveEval && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Crane Load Chart Result + Multi Load Cases */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white">خلاصه بار کل، ظرفیت جدول بار و ظرفیت باقی‌مانده</h4>
                <StatusBadge status={liveEval.craneResult?.status || 'NOT_VERIFIED'} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 tabular-nums">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-slate-500">استاتیکی</div>
                  <div className="font-mono font-black text-sm mt-0.5">{liveEval.riggingResult.grossStaticLoadTon} t</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-slate-500">بار طراحی (DAF)</div>
                  <div className="font-mono font-black text-sm mt-0.5">{liveEval.riggingResult.designTotalLoadTon} t</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-slate-500">ظرفیت جدول بار</div>
                  <div className="font-mono font-black text-sm mt-0.5">
                    {liveEval.craneResult?.ratedCapacityTon !== null && liveEval.craneResult?.ratedCapacityTon !== undefined
                      ? `${liveEval.craneResult.ratedCapacityTon} t`
                      : 'نامشخص'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-slate-500">ظرفیت باقی‌مانده</div>
                  <div className="font-mono font-black text-sm mt-0.5">
                    {liveEval.remainingCraneCapacityTon !== null && liveEval.remainingCraneCapacityTon !== undefined
                      ? `${liveEval.remainingCraneCapacityTon} t`
                      : '—'}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-slate-500">بهره‌برداری</div>
                  <div className="font-mono font-black text-sm mt-0.5">
                    {liveEval.craneResult?.utilizationPct !== null && liveEval.craneResult?.utilizationPct !== undefined
                      ? `${liveEval.craneResult.utilizationPct}%`
                      : '—'}
                  </div>
                </div>
              </div>
              {liveEval.craneResult && (
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg space-y-1">
                  <div>{liveEval.craneResult.formulaText}</div>
                  {liveEval.craneResult.groundBearingPressureKpa && (
                    <div>
                      واکنش حداکثری جک: {liveEval.craneResult.outriggerReactionMaxTon} t · فشار خاک:{' '}
                      {liveEval.craneResult.groundBearingPressureKpa} kPa (
                      {liveEval.craneResult.groundBearingVerified ? 'داده واقعی پد/جرثقیل' : 'تخمین مرجع ۱m²'})
                    </div>
                  )}
                </div>
              )}

              <h5 className="font-bold text-slate-800 dark:text-slate-200 pt-2">تحلیل حالت‌های بارگذاری (Load Cases)</h5>
              <table className="w-full text-[11px] text-right">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-1.5">حالت بارگذاری</th>
                    <th className="py-1.5">بار کل طراحی</th>
                    <th className="py-1.5">تنش بحرانی شاخه</th>
                    <th className="py-1.5">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 tabular-nums">
                  {liveEval.riggingResult.loadCases.map((lc) => (
                    <tr key={lc.caseId}>
                      <td className="py-1.5 font-bold">{lc.caseNameFa}</td>
                      <td className="py-1.5 font-mono">{lc.designFactoredLoadTon} t</td>
                      <td className="py-1.5 font-mono">{lc.maxLegTensionTon} t</td>
                      <td className="py-1.5">
                        <StatusBadge status={lc.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Static Determinacy & 6-DOF Residuals Report */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-sky-600" />
                  <span>تشخیص معینی استاتیکی و باقیمانده تعادل ۶ درجه آزادی</span>
                </h4>
                <StatusBadge status={liveEval.riggingResult.status} />
              </div>

              {liveEval.riggingResult.staticEquilibrium && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 tabular-nums">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-500">طبقه‌بندی استاتیکی</div>
                      <div className="font-mono font-black mt-0.5 text-sky-700 dark:text-sky-400">
                        {liveEval.riggingResult.staticEquilibrium.determinacyClassification}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-500">مجهول / معادله / DSI</div>
                      <div className="font-mono font-black mt-0.5">
                        {liveEval.riggingResult.staticEquilibrium.unknownCount} / {liveEval.riggingResult.staticEquilibrium.independentEquationsCount} (DSI={liveEval.riggingResult.staticEquilibrium.degreeOfIndeterminacy})
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-500">شاخه‌های فعال / شل</div>
                      <div className="font-mono font-black mt-0.5">
                        {liveEval.riggingResult.staticEquilibrium.activeLegCount} فعال / {liveEval.riggingResult.staticEquilibrium.slackLegIds.length} Slack
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-[10px] text-slate-500">سختی و کشش خالص</div>
                      <div className="font-mono font-black mt-0.5">
                        {liveEval.riggingResult.staticEquilibrium.stiffnessDataComplete ? 'EA کامل' : 'ناقص'} · {liveEval.riggingResult.staticEquilibrium.noCompressionVerified ? 'T≥0 OK' : 'Comp!'}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                    <div>
                      <span className="font-bold">روش حل: </span>
                      <span className="font-mono text-sky-700 dark:text-sky-400">
                        {liveEval.riggingResult.staticEquilibrium.solutionMethod}
                      </span>
                    </div>
                    <div className="mt-1">{liveEval.riggingResult.staticEquilibrium.diagnosisFa}</div>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono tabular-nums text-[10px]">
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-slate-500">ΣFx</div>
                      <div className="font-bold">{liveEval.riggingResult.staticEquilibrium.residuals.sumFxTon} t</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-slate-500">ΣFy</div>
                      <div className="font-bold">{liveEval.riggingResult.staticEquilibrium.residuals.sumFyTon} t</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-slate-500">ΣFz</div>
                      <div className="font-bold">{liveEval.riggingResult.staticEquilibrium.residuals.sumFzTon} t</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-slate-500">ΣMx</div>
                      <div className="font-bold">{liveEval.riggingResult.staticEquilibrium.residuals.sumMxTonM}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-slate-500">ΣMy</div>
                      <div className="font-bold">{liveEval.riggingResult.staticEquilibrium.residuals.sumMyTonM}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50">
                      <div className="text-slate-500">ΣMz</div>
                      <div className="font-bold">{liveEval.riggingResult.staticEquilibrium.residuals.sumMzTonM}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                    <span>
                      CoG مرکب: ({liveEval.riggingResult.compositeCogM.x}, {liveEval.riggingResult.compositeCogM.y},{' '}
                      {liveEval.riggingResult.compositeCogM.z}) m | M_ovt: {liveEval.riggingResult.overturningMomentTonM} t·m
                    </span>
                    <span
                      className={
                        liveEval.riggingResult.staticEquilibrium.residuals.converged
                          ? 'text-emerald-600 font-bold'
                          : 'text-amber-600 font-bold'
                      }
                    >
                      {liveEval.riggingResult.staticEquilibrium.residuals.converged ? 'همگرایی تعادل OK' : 'باقیمانده خارج از تلورانس'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 13-Column Per-Leg Results Table (§11) */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
              <h4 className="font-black text-slate-900 dark:text-white">
                جدول نتایج دقیق شاخه‌ها، مؤلفه‌های سه‌محوری و وضعیت مشارکت (۱۳ خروجی مهندسی)
              </h4>
              <span className="text-[11px] font-mono text-slate-500">
                θ_min={liveEval.riggingResult.minHorizontalAngleDeg}° | T_gov={liveEval.riggingResult.governingLegTensionTon} t
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-right">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-1.5 px-1.5">شناسه/برچسب</th>
                    <th className="py-1.5 px-1.5">طول مؤثر (m)</th>
                    <th className="py-1.5 px-1.5">زاویه افقی</th>
                    <th className="py-1.5 px-1.5">زاویه عمودی</th>
                    <th className="py-1.5 px-1.5">Fx / Fy / Fz (t)</th>
                    <th className="py-1.5 px-1.5">کشش کل (t)</th>
                    <th className="py-1.5 px-1.5">WLL مجاز (t)</th>
                    <th className="py-1.5 px-1.5">بهره‌برداری</th>
                    <th className="py-1.5 px-1.5">کشیدگی (mm)</th>
                    <th className="py-1.5 px-1.5">ΔL (mm)</th>
                    <th className="py-1.5 px-1.5">سختی EA (kN)</th>
                    <th className="py-1.5 px-1.5">مشارکت</th>
                    <th className="py-1.5 px-1.5">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 font-mono tabular-nums">
                  {liveEval.riggingResult.legs.map((leg) => (
                    <tr key={leg.id}>
                      <td className="py-2 px-1.5 font-sans font-bold text-slate-900 dark:text-white">
                        {leg.label} <span className="font-mono text-[10px] text-slate-400">({leg.id})</span>
                      </td>
                      <td className="py-2 px-1.5">{leg.effectiveLengthM ?? leg.lengthM}</td>
                      <td className="py-2 px-1.5">{leg.horizontalAngleDeg}°</td>
                      <td className="py-2 px-1.5">{leg.verticalAngleDeg}°</td>
                      <td className="py-2 px-1.5 text-slate-500">
                        {leg.forceVectorTon.x} / {leg.forceVectorTon.y} / {leg.forceVectorTon.z}
                      </td>
                      <td className="py-2 px-1.5 font-bold text-slate-900 dark:text-white">{leg.axialTensionTon}</td>
                      <td className="py-2 px-1.5">{leg.allowableWllTon ?? liveEval.riggingResult.effectiveSlingWllTon ?? '—'}</td>
                      <td className="py-2 px-1.5">{leg.slingUtilizationPct !== null ? `${leg.slingUtilizationPct}%` : '—'}</td>
                      <td className="py-2 px-1.5">{leg.axialElongationMm !== null && leg.axialElongationMm !== undefined ? leg.axialElongationMm : '—'}</td>
                      <td className="py-2 px-1.5">{leg.lengthToleranceMm ?? 0}</td>
                      <td className="py-2 px-1.5">{leg.axialStiffnessKn ?? '—'}</td>
                      <td className="py-2 px-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            leg.participationStatus === 'SLACK'
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                              : leg.participationStatus === 'UNVERIFIED'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300'
                                : leg.participationStatus === 'DROPPED_RIGID_ENVELOPE'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {leg.participationStatus}
                        </span>
                      </td>
                      <td className="py-2 px-1.5">
                        <StatusBadge status={leg.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Force Distribution Bar Chart + Parametric Sensitivity Panel + Engineering Assumptions (§8 & §11) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tension Distribution Across Slings */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-sky-600" />
                  <span>نمودار توزیع واقعی نیرو بین نقاط اتصال (بدون فرض مساوی)</span>
                </h4>
                <span className="font-mono text-[11px] text-slate-500">
                  Max={liveEval.riggingResult.governingLegTensionTon} t
                </span>
              </div>
              <div className="space-y-2.5 pt-1">
                {(() => {
                  const maxScale = Math.max(
                    1,
                    liveEval.riggingResult.effectiveSlingWllTon || 0,
                    ...liveEval.riggingResult.legs.map((l) => l.axialTensionTon || 0)
                  );
                  return liveEval.riggingResult.legs.map((leg) => {
                    const pct = Math.min(100, (leg.axialTensionTon / maxScale) * 100);
                    const isSlack = leg.participationStatus === 'SLACK';
                    const barColor =
                      leg.status === 'FAIL'
                        ? 'bg-red-500'
                        : isSlack
                          ? 'bg-slate-400'
                          : leg.status === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-sky-600';
                    return (
                      <div key={leg.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] tabular-nums">
                          <span className="font-bold">
                            {leg.label} ({leg.participationStatus})
                          </span>
                          <span className="font-mono font-bold">
                            {leg.axialTensionTon} t ({leg.slingUtilizationPct ?? '—'}%)
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-900 rounded overflow-hidden">
                          <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Parametric Sensitivity Analysis */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-600" />
                  <span>تحلیل حساسیت و اثر عدم‌قطعیت‌ها (پارامتر حاکم)</span>
                </h4>
                <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400">
                  T_worst = {liveEval.riggingResult.sensitivityAnalysis?.worstCaseLegTensionTon ?? 0} t
                </span>
              </div>
              {liveEval.riggingResult.sensitivityAnalysis && (
                <>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                    <span className="font-bold">پارامتر حاکم: </span>
                    {liveEval.riggingResult.sensitivityAnalysis.governingParameterFa} (تغییر{' '}
                    <span className="font-mono font-bold">+{liveEval.riggingResult.sensitivityAnalysis.maxImpactPct}%</span>)
                    — {liveEval.riggingResult.sensitivityAnalysis.noteFa}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] text-right">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                          <th className="py-1">پارامتر</th>
                          <th className="py-1">تغییر ورودی</th>
                          <th className="py-1">کشش جدید (t)</th>
                          <th className="py-1">اثر نسبی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 tabular-nums">
                        {liveEval.riggingResult.sensitivityAnalysis.impacts.map((imp) => (
                          <tr key={imp.parameterKey}>
                            <td className="py-1.5 font-bold">{imp.parameterNameFa}</td>
                            <td className="py-1.5 font-mono text-slate-500">{imp.perturbationLabel}</td>
                            <td className="py-1.5 font-mono font-bold">{imp.perturbedMaxTensionTon} t</td>
                            <td className="py-1.5 font-mono">+{imp.relativeImpactPct}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Explicit Engineering Assumptions Registry (§12) */}
          {liveEval.riggingResult.engineeringAssumptions && liveEval.riggingResult.engineeringAssumptions.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-2.5 text-xs">
              <h4 className="font-black text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-700">
                ثبت صریح فرضیات و مبنای حل مهندسی (Engineering Assumptions Registry)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {liveEval.riggingResult.engineeringAssumptions.map((asm) => (
                  <div key={asm.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span className="font-bold text-sky-700 dark:text-sky-400">{asm.category}</span>
                      <span className={asm.requiresEngineerSignoff ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                        {asm.requiresEngineerSignoff ? 'نیازمند تأیید مهندس' : `اثر: ${asm.impactLevel}`}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{asm.statementFa}</div>
                    <div className="text-[10px] font-mono text-slate-500">{asm.technicalBasis}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Full 10-Field Transparent Parameter Traceability Table (Section 8) */}
      {liveEval && liveEval.parameterTrace && liveEval.parameterTrace.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
            <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TableProperties className="w-4 h-4 text-sky-600" />
              <span>ماتریس شفافیت و ردیابی کامل محاسبات مهندسی (۱۰ شاخصه برای هر پارامتر)</span>
            </h4>
            <span className="text-[11px] font-mono text-slate-500">
              {liveEval.parameterTrace.length} پارامتر ردیابی‌شده
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-right">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                  <th className="py-2 px-2">نام پارامتر</th>
                  <th className="py-2 px-2">مقدار ورودی</th>
                  <th className="py-2 px-2">نتیجه محاسبه</th>
                  <th className="py-2 px-2">واحد</th>
                  <th className="py-2 px-2">فرمول محاسباتی</th>
                  <th className="py-2 px-2">استاندارد مرجع</th>
                  <th className="py-2 px-2">ضرایب اعمال‌شده</th>
                  <th className="py-2 px-2">فرضیات</th>
                  <th className="py-2 px-2">اعتبارسنجی</th>
                  <th className="py-2 px-2">وضعیت نهایی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 tabular-nums">
                {liveEval.parameterTrace.map((pt) => (
                  <tr key={pt.key}>
                    <td className="py-2 px-2 font-bold text-slate-900 dark:text-white">{pt.nameFa}</td>
                    <td className="py-2 px-2 font-mono text-slate-600 dark:text-slate-300">{pt.inputValue ?? '—'}</td>
                    <td className="py-2 px-2 font-mono font-bold text-slate-900 dark:text-white">{pt.computedValue ?? '—'}</td>
                    <td className="py-2 px-2 font-mono">{pt.unit}</td>
                    <td className="py-2 px-2 font-mono text-[10px] text-slate-600 dark:text-slate-300 max-w-[220px]">{pt.formula}</td>
                    <td className="py-2 px-2 font-mono text-[10px]">{pt.standardRef}</td>
                    <td className="py-2 px-2 text-[10px]">{pt.factors}</td>
                    <td className="py-2 px-2 text-[10px] text-slate-500 max-w-[200px]">{pt.assumptions.filter(Boolean).join('؛ ') || '—'}</td>
                    <td className="py-2 px-2">
                      <StatusBadge status={pt.validationStatus} />
                    </td>
                    <td className="py-2 px-2">
                      <StatusBadge status={pt.finalStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
