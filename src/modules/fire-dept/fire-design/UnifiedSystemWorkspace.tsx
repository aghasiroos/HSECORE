import React, { useEffect, useMemo, useState } from 'react';
import {
  Sliders,
  Map as MapIcon,
  Calculator,
  ShieldCheck,
  FileCheck2,
  Save,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Layers,
  Printer,
  Edit3,
  UserCheck,
  Award,
  Trash2,
} from 'lucide-react';
import type {
  ExtinguisherConfigInput,
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignGapAction,
  FireDesignLayout,
  FireDesignSystemRecord,
  FireSystemType,
  FloorCalculationResult,
  FloorSpaceZone,
  PlacedSuppressionItem,
  SprinklerConfigInput,
} from './types';
import {
  ALL_EIGHT_FIRE_SYSTEMS,
  getSystemDescriptor,
  getSystemPlugin,
} from './systemsRegistry';
import { ENGINEERING_DISCLAIMER_FA, OCCUPANCY_LABELS_FA } from './nfpaEngine';
import {
  BuildingDesignStatusSummary,
  renderFireSystemIcon,
} from './systemMetricsHelper';
import { printHtmlSafely } from './fireDesignApi';
import FireFloorCanvas2D from './FireFloorCanvas2D';
import FireDesignCalculationsView from './FireDesignCalculationsView';
import FireGapAnalysisPanel from './FireGapAnalysisPanel';
import FireDesignReportsPanel from './FireDesignReportsPanel';

type ZoneId = 'ZONE_1' | 'ZONE_2' | 'ZONE_3' | 'ZONE_4' | 'ZONE_5' | 'ALL_ZONES';

interface Props {
  isFa: boolean;
  canWrite: boolean;
  canApprove: boolean;
  building: FireDesignBuilding;
  floors: FireDesignFloor[];
  activeFloor: FireDesignFloor;
  selectedSpace: FloorSpaceZone | null;
  onSelectFloor: (floorId: number) => void;
  onSelectSpaceId: (spaceId: string | null) => void;
  activeSystemType: FireSystemType;
  onSelectSystemType: (sysType: FireSystemType) => void;
  summary: BuildingDesignStatusSummary;
  calc: FloorCalculationResult;
  sprinklerConfig: SprinklerConfigInput;
  extinguisherConfig: ExtinguisherConfigInput;
  onChangeSprinklerConfig: (cfg: SprinklerConfigInput) => void;
  onChangeExtinguisherConfig: (cfg: ExtinguisherConfigInput) => void;
  placedItems: PlacedSuppressionItem[];
  onChangePlacedItems: (items: PlacedSuppressionItem[]) => void;
  floorRevisions: FireDesignLayout[];
  latestFloorLayout: FireDesignLayout | null;
  onLoadRevision: (rev: FireDesignLayout) => void;
  onFloorPlanUploaded: (patch: Partial<FireDesignFloor>) => Promise<void>;
  onSaveLayoutRevision: (notes?: string) => Promise<void>;
  onApproveLayout: (id: number, status: 'REVIEWED' | 'APPROVED', notes?: string) => Promise<void>;
  savedSystems: FireDesignSystemRecord[];
  onSaveSystem: (payload: {
    buildingId: number;
    floorId?: number | null;
    systemType: FireSystemType;
    standardEdition: string;
    localCodeNotes?: string;
    designInputs: Record<string, any>;
  }) => Promise<void>;
  onApproveSystem: (id: number, status?: 'REVIEWED' | 'APPROVED', notes?: string) => Promise<void>;
  onDeleteSystem: (id: number) => Promise<void>;
  onInjectSuggestedItemsToCanvas: (systemType: FireSystemType, items: PlacedSuppressionItem[]) => void;
  gapActions: FireDesignGapAction[];
  onCreateGapAction: (payload: Partial<FireDesignGapAction>) => Promise<void>;
  onUpdateGapAction: (id: number, payload: Partial<FireDesignGapAction>) => Promise<void>;
  onDeleteGapAction: (id: number) => Promise<void>;
  onEditBuildingOrFloor: () => void;
}

const ZONE_TABS: { id: Exclude<ZoneId, 'ALL_ZONES'>; num: string; titleFa: string; icon: React.ReactNode }[] = [
  { id: 'ZONE_1', num: 'ناحیه ۱', titleFa: 'مشخصات و ورودی‌های طراحی', icon: <Sliders className="w-4 h-4" /> },
  { id: 'ZONE_2', num: 'ناحیه ۲', titleFa: 'نقشه و جانمایی ۲بعدی', icon: <MapIcon className="w-4 h-4" /> },
  { id: 'ZONE_3', num: 'ناحیه ۳', titleFa: 'محاسبات مهندسی', icon: <Calculator className="w-4 h-4" /> },
  { id: 'ZONE_4', num: 'ناحیه ۴', titleFa: 'ارزیابی، کنترل و CAPA', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'ZONE_5', num: 'ناحیه ۵', titleFa: 'گزارش و تأیید نهایی', icon: <FileCheck2 className="w-4 h-4" /> },
];

export default function UnifiedSystemWorkspace({
  isFa,
  canWrite,
  canApprove,
  building,
  floors,
  activeFloor,
  selectedSpace,
  onSelectFloor,
  onSelectSpaceId,
  activeSystemType,
  onSelectSystemType,
  summary,
  calc,
  sprinklerConfig,
  extinguisherConfig,
  onChangeSprinklerConfig,
  onChangeExtinguisherConfig,
  placedItems,
  onChangePlacedItems,
  floorRevisions,
  latestFloorLayout,
  onLoadRevision,
  onFloorPlanUploaded,
  onSaveLayoutRevision,
  onApproveLayout,
  savedSystems,
  onSaveSystem,
  onApproveSystem,
  onDeleteSystem,
  onInjectSuggestedItemsToCanvas,
  gapActions,
  onCreateGapAction,
  onUpdateGapAction,
  onDeleteGapAction,
  onEditBuildingOrFloor,
}: Props) {
  const [activeZone, setActiveZone] = useState<ZoneId>('ZONE_1');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const descriptor = useMemo(
    () => getSystemDescriptor(activeSystemType) || ALL_EIGHT_FIRE_SYSTEMS[0],
    [activeSystemType]
  );
  const isCoreFloorSystem = descriptor.engineKind === 'CORE_FLOOR';
  const plugin = useMemo(() => (isCoreFloorSystem ? undefined : getSystemPlugin(activeSystemType)), [
    isCoreFloorSystem,
    activeSystemType,
  ]);

  const activeSystemSummary = useMemo(
    () => summary.perSystem.find((p) => p.descriptor.type === descriptor.type),
    [summary.perSystem, descriptor.type]
  );

  // Plugin state (only used when descriptor.engineKind === 'PLUGIN')
  const [edition, setEdition] = useState<string>(descriptor.defaultEdition);
  const [localCodeNotes, setLocalCodeNotes] = useState<string>('');
  const [pluginInputs, setPluginInputs] = useState<Record<string, any>>({});

  // Latest saved record for plugin systems
  const activeSavedPluginRecord = useMemo(() => {
    if (isCoreFloorSystem || !plugin) return null;
    return (
      savedSystems.find(
        (s) =>
          s.buildingId === building.id &&
          s.isActive &&
          s.systemType === plugin.type &&
          (plugin.scope === 'BUILDING' || s.floorId === activeFloor.id || !s.floorId)
      ) || null
    );
  }, [isCoreFloorSystem, plugin, savedSystems, building.id, activeFloor.id]);

  // History list for current plugin system
  const systemVersionHistory = useMemo(() => {
    if (isCoreFloorSystem || !plugin) return [];
    return savedSystems.filter((s) => s.buildingId === building.id && s.systemType === plugin.type);
  }, [isCoreFloorSystem, plugin, savedSystems, building.id]);

  // Sync inputs when system / building / floor / space / saved record changes
  useEffect(() => {
    setFeedback(null);
    if (isCoreFloorSystem) {
      setReviewNotes(latestFloorLayout?.reviewNotes || latestFloorLayout?.notes || '');
      return;
    }
    if (!plugin) return;

    if (activeSavedPluginRecord) {
      setEdition(activeSavedPluginRecord.standardEdition);
      setLocalCodeNotes(activeSavedPluginRecord.localCodeNotes || '');
      setPluginInputs(activeSavedPluginRecord.designInputs || {});
      setReviewNotes(activeSavedPluginRecord.reviewNotes || '');
    } else {
      setEdition(plugin.defaultEdition);
      setLocalCodeNotes('');
      setReviewNotes('');
      const defaults: Record<string, any> = {};
      plugin.fields.forEach((f) => {
        defaults[f.key] = f.defaultValue;
      });
      const scopeArea = selectedSpace ? selectedSpace.areaSqm : activeFloor.areaSqm;
      if (plugin.type === 'FOAM_NFPA11' && scopeArea) defaults.hazardAreaSqm = scopeArea;
      if (plugin.type === 'CLEAN_AGENT_NFPA2001' && scopeArea) {
        defaults.roomAreaSqm = scopeArea;
        defaults.roomHeightM = activeFloor.ceilingHeightM;
      }
      if (plugin.type === 'PUMP_NFPA20' || plugin.type === 'TANK_NFPA22') {
        if (calc.sprinkler.hydraulics.totalWaterDemandGpm > 0) {
          defaults.totalDemandGpm = calc.sprinkler.hydraulics.totalWaterDemandGpm;
        }
        if (plugin.type === 'PUMP_NFPA20' && calc.sprinkler.hydraulics.totalRequiredPressureBar > 0) {
          defaults.requiredHeadBar = calc.sprinkler.hydraulics.totalRequiredPressureBar;
        }
        if (plugin.type === 'TANK_NFPA22' && calc.sprinkler.hydraulics.supplyDurationMin > 0) {
          defaults.durationMin = calc.sprinkler.hydraulics.supplyDurationMin;
        }
      }
      setPluginInputs(defaults);
    }
  }, [
    isCoreFloorSystem,
    plugin,
    building.id,
    activeFloor.id,
    activeFloor.areaSqm,
    activeFloor.ceilingHeightM,
    selectedSpace?.id,
    activeSavedPluginRecord?.id,
    latestFloorLayout?.id,
  ]);

  // Scoped virtual floor when user picks an internal space inside the floor
  const scopedFloorForPlugin: FireDesignFloor = useMemo(() => {
    if (!selectedSpace) return activeFloor;
    return {
      ...activeFloor,
      lengthM: selectedSpace.widthM || activeFloor.lengthM,
      widthM: selectedSpace.heightM || activeFloor.widthM,
      areaSqm: selectedSpace.areaSqm || Number((selectedSpace.widthM * selectedSpace.heightM).toFixed(2)),
    };
  }, [activeFloor, selectedSpace]);

  const pluginEval = useMemo(() => {
    if (!plugin) return null;
    return plugin.evaluate({
      building,
      floor: scopedFloorForPlugin,
      edition,
      inputs: pluginInputs,
      placedItems,
    });
  }, [plugin, building, scopedFloorForPlugin, edition, pluginInputs, placedItems]);

  const isZoneVisible = (zone: Exclude<ZoneId, 'ALL_ZONES'>) =>
    activeZone === 'ALL_ZONES' || activeZone === zone;

  const isDesignApproved = isCoreFloorSystem
    ? latestFloorLayout?.status === 'APPROVED'
    : activeSavedPluginRecord?.designStage === 'APPROVED_ENGINEERING';

  const isDesignReviewed = isCoreFloorSystem
    ? latestFloorLayout?.status === 'REVIEWED' || latestFloorLayout?.status === 'APPROVED'
    : activeSavedPluginRecord?.designStage === 'REVIEWED' ||
      activeSavedPluginRecord?.designStage === 'APPROVED_ENGINEERING';

  const handleSaveCurrentSystem = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      if (isCoreFloorSystem) {
        await onSaveLayoutRevision(reviewNotes || undefined);
        setFeedback({
          type: 'ok',
          text: `نسخه جدید طراحی ${descriptor.shortTitleFa} و جانمایی طبقه در پایگاه داده ذخیره شد.`,
        });
      } else if (plugin) {
        await onSaveSystem({
          buildingId: building.id,
          floorId: plugin.scope === 'FLOOR' ? activeFloor.id : null,
          systemType: plugin.type,
          standardEdition: edition,
          localCodeNotes,
          designInputs: pluginInputs,
        });
        setFeedback({
          type: 'ok',
          text: `محاسبات و مشخصات ${plugin.titleFa} (${plugin.standardCode} - ${edition}) با موفقیت ذخیره شد.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'خطا در ذخیره اطلاعات طراحی' });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOff = async (nextStatus: 'REVIEWED' | 'APPROVED') => {
    setSaving(true);
    setFeedback(null);
    try {
      if (isCoreFloorSystem) {
        let targetId = latestFloorLayout?.id;
        if (!targetId) {
          await onSaveLayoutRevision(reviewNotes || undefined);
          setFeedback({
            type: 'ok',
            text: 'پیش‌نویس ذخیره شد؛ برای تأیید نهایی مجدداً دکمه تأیید را بزنید.',
          });
          return;
        }
        await onApproveLayout(targetId, nextStatus, reviewNotes || undefined);
      } else if (activeSavedPluginRecord) {
        await onApproveSystem(activeSavedPluginRecord.id, nextStatus, reviewNotes || undefined);
      } else {
        setFeedback({
          type: 'err',
          text: 'ابتدا طراحی سیستم را ذخیره کنید تا امکان بازبینی یا تأیید نهایی فراهم شود.',
        });
        return;
      }
      setFeedback({
        type: 'ok',
        text:
          nextStatus === 'REVIEWED'
            ? 'بازبینی فنی طراحی با نام و مهر زمانی شما ثبت شد.'
            : 'تأیید نهایی مهندسی طراحی با موفقیت ثبت گردید.',
      });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'خطا در ثبت وضعیت تأیید' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintFocusedSystemReport = () => {
    const metricsRows = isCoreFloorSystem
      ? [
          { labelFa: 'رده خطر طراحی', value: calc.hazardGroupLabelFa },
          {
            labelFa:
              descriptor.type === 'SPRINKLER_NFPA13'
                ? 'تعداد اسپرینکلر محاسبه‌شده / پوشش'
                : 'تعداد خاموش‌کننده مورد نیاز / پوشش',
            value:
              descriptor.type === 'SPRINKLER_NFPA13'
                ? `${calc.sprinkler.calculatedHeadCount} نازل (${calc.sprinkler.coveragePercent}٪)`
                : `${calc.extinguisher.requiredTotalCount} دستگاه (${calc.extinguisher.coveragePercent}٪)`,
          },
          {
            labelFa: 'نیاز آبی کل / فشار رایزر',
            value: `${calc.sprinkler.hydraulics.totalWaterDemandGpm} GPM @ ${calc.sprinkler.hydraulics.totalRequiredPressureBar} Bar`,
          },
        ]
      : pluginEval?.summaryMetrics || [];

    printHtmlSafely(`<!doctype html>
<html dir="rtl" lang="fa">
<head>
<meta charset="utf-8" />
<title>گزارش فنی ${descriptor.titleFa} - ${building.name}</title>
<style>
  body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #0f172a; font-size: 11px; line-height: 1.7; }
  h1 { font-size: 15px; margin: 0 0 6px 0; }
  h2 { font-size: 12px; margin: 16px 0 6px 0; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; }
  th { background: #f8fafc; }
  .badge { padding: 4px 8px; border: 1px solid #94a3b8; display: inline-block; font-weight: bold; }
  .disc { margin-top: 16px; padding: 10px; border: 1px solid #d97706; background: #fffbeb; font-weight: bold; }
</style>
</head>
<body>
  <h1>گزارش تخصصی ${descriptor.titleFa} (${descriptor.standardCode})</h1>
  <div>ساختمان: <strong>${building.name} (${building.code})</strong> | طبقه: ${activeFloor.floorLabel} ${selectedSpace ? `| فضا: ${selectedSpace.name} (${selectedSpace.areaSqm} m²)` : `| مساحت: ${activeFloor.areaSqm} m²`}</div>
  <div style="margin-top:6px;"><span class="badge">وضعیت سند: ${isDesignApproved ? 'تأیید نهایی مهندسی' : isDesignReviewed ? 'بازبینی‌شده' : 'طراحی اولیه / پیش‌نویس'}</span></div>
  <h2>خلاصه محاسبات مهندسی</h2>
  <table>
    <tbody>
      ${metricsRows.map((m) => `<tr><th>${m.labelFa}</th><td>${m.value}</td></tr>`).join('')}
    </tbody>
  </table>
  <h2>زنجیره تأیید مهندسی</h2>
  <table>
    <tr><th>طراح</th><td>${(isCoreFloorSystem ? latestFloorLayout?.calculatedBy : activeSavedPluginRecord?.updatedBy) || '-'}</td>
    <th>بازبین فنی</th><td>${(isCoreFloorSystem ? latestFloorLayout?.reviewedBy : activeSavedPluginRecord?.reviewedBy) || 'انجام نشده'}</td>
    <th>تأییدکننده نهایی</th><td>${(isCoreFloorSystem ? latestFloorLayout?.approvedBy : activeSavedPluginRecord?.approvedBy) || 'تأیید نشده'}</td></tr>
  </table>
  <div class="disc">${ENGINEERING_DISCLAIMER_FA}</div>
</body>
</html>`);
  };

  return (
    <div className="space-y-4" dir={isFa ? 'rtl' : 'ltr'}>
      {/* 1. Unified 8-System Quick Switcher + Active Context Controls */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
            <Layers className="w-4 h-4 text-red-600" />
            <span>سوئیچ سریع بین ۸ سیستم حفاظت حریق (درون محیط طراحی مشترک):</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={activeFloor.id}
              onChange={(e) => onSelectFloor(Number(e.target.value))}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  طبقه: {f.floorLabel} ({f.areaSqm} m²)
                </option>
              ))}
            </select>
            {activeFloor.spaces && activeFloor.spaces.length > 0 && (
              <select
                value={selectedSpace?.id || ''}
                onChange={(e) => onSelectSpaceId(e.target.value || null)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
              >
                <option value="">محدوده: کل طبقه ({activeFloor.areaSqm} m²)</option>
                {activeFloor.spaces.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    فضا: {sp.name} ({sp.areaSqm} m²)
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
          {ALL_EIGHT_FIRE_SYSTEMS.map((sys) => {
            const isActive = sys.type === descriptor.type;
            const st = summary.perSystem.find((p) => p.descriptor.type === sys.type);
            const dotClass =
              st?.designState === 'DESIGNED'
                ? 'bg-emerald-500'
                : st?.designState === 'IN_PROGRESS'
                  ? 'bg-blue-500'
                  : 'bg-slate-300 dark:bg-slate-600';
            return (
              <button
                key={sys.type}
                type="button"
                onClick={() => onSelectSystemType(sys.type)}
                className={`p-2 rounded-xl border text-right transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                  isActive
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-400'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={isActive ? 'text-white' : 'text-red-600 dark:text-red-400'}>
                    {renderFireSystemIcon(sys.iconKey, 'w-4 h-4')}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white' : dotClass}`} />
                </div>
                <div className="text-[11px] font-bold truncate">{sys.shortTitleFa}</div>
                <div className={`text-[9px] font-mono ${isActive ? 'text-red-100' : 'text-slate-400'}`}>
                  {sys.standardCode}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. 5-Zone Unified Bar + Full-View Toggle */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {ZONE_TABS.map((z) => {
            const isSel = activeZone === z.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => setActiveZone(z.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                  isSel
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                }`}
              >
                {z.icon}
                <span>
                  {z.num}: {z.titleFa}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setActiveZone((prev) => (prev === 'ALL_ZONES' ? 'ZONE_1' : 'ALL_ZONES'))}
          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
            activeZone === 'ALL_ZONES'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
          }`}
        >
          {activeZone === 'ALL_ZONES' ? 'نمایش تک‌ناحیه‌ای' : 'نمایش هر ۵ ناحیه یکجا'}
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZONE 1: Design Specifications & System Inputs                         */}
      {/* ===================================================================== */}
      {isZoneVisible('ZONE_1') && (
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                {renderFireSystemIcon(descriptor.iconKey, 'w-5 h-5')}
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  ناحیه ۱: مشخصات و ورودی‌های طراحی — {descriptor.titleFa} ({descriptor.standardCode})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{descriptor.descriptionFa}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                <Lock className="w-3 h-3" />
                <span>{activeSystemSummary?.editionLabel || descriptor.standardCode}</span>
              </span>
              <button
                type="button"
                onClick={onEditBuildingOrFloor}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>ویرایش مشخصات ساختمان/طبقه</span>
              </button>
            </div>
          </div>

          {/* Pinned Building & Floor Context (Zero Re-Entry) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <ContextTile label="ساختمان" value={`${building.name} (${building.code})`} />
            <ContextTile
              label="کاربری"
              value={OCCUPANCY_LABELS_FA[building.occupancyType] || building.occupancyType}
            />
            <ContextTile
              label="محدوده طراحی فعال"
              value={selectedSpace ? `فضا: ${selectedSpace.name}` : `کل طبقه ${activeFloor.floorLabel}`}
            />
            <ContextTile
              label="مساحت و ابعاد (m)"
              value={
                selectedSpace
                  ? `${selectedSpace.areaSqm} m² (${selectedSpace.widthM}×${selectedSpace.heightM})`
                  : `${activeFloor.areaSqm} m² (${activeFloor.lengthM}×${activeFloor.widthM})`
              }
              mono
            />
            <ContextTile label="ارتفاع سقف / تیر" value={`${activeFloor.ceilingHeightM}m / ${activeFloor.beamDepthM}m`} mono />
            <ContextTile label="رده خطر / کلاس حریق" value={`${calc.hazardGroup} · ${calc.detectedFireClasses.join(', ')}`} mono />
          </div>

          {/* System-specific Parameter Form */}
          {isCoreFloorSystem ? (
            descriptor.type === 'SPRINKLER_NFPA13' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع اسپرینکلر (Sprinkler Head Type)
                  </label>
                  <select
                    disabled={!canWrite}
                    value={sprinklerConfig.headType || ''}
                    onChange={(e) =>
                      onChangeSprinklerConfig({
                        ...sprinklerConfig,
                        headType: (e.target.value || undefined) as any,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">انتخاب هوشمند موتور استاندارد</option>
                    <option value="PENDENT">پایین‌زن استاندارد (Pendent)</option>
                    <option value="UPRIGHT">بالازن سوله (Upright)</option>
                    <option value="CONCEALED">مخفی اداری (Concealed)</option>
                    <option value="HIGH_TEMP_UPRIGHT">دمای بالا صنعتی (High-Temp Upright)</option>
                    <option value="ESFR">واکنش سریع و سرکوب زودهنگام (ESFR)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ضریب K-Factor نازل</label>
                  <select
                    disabled={!canWrite}
                    value={sprinklerConfig.kFactor ?? ''}
                    onChange={(e) =>
                      onChangeSprinklerConfig({
                        ...sprinklerConfig,
                        kFactor: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  >
                    <option value="">پیشنهاد پیش‌فرض رده خطر</option>
                    <option value="5.6">K=5.6 (80 metric)</option>
                    <option value="8.0">K=8.0 (115 metric)</option>
                    <option value="11.2">K=11.2 (ELO / Extra Hazard)</option>
                    <option value="16.8">K=16.8 (Industrial Storage)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    چگالی طراحی سفارشی (gpm/ft²)
                  </label>
                  <input
                    type="number"
                    step="0.02"
                    disabled={!canWrite}
                    placeholder={String(calc.sprinkler.hydraulics.designDensityGpmSqft)}
                    value={sprinklerConfig.designDensityOverride ?? ''}
                    onChange={(e) =>
                      onChangeSprinklerConfig({
                        ...sprinklerConfig,
                        designDensityOverride: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    مساحت بحرانی هیدرولیک (ft²)
                  </label>
                  <input
                    type="number"
                    step="100"
                    disabled={!canWrite}
                    placeholder={String(calc.sprinkler.hydraulics.remoteAreaSqft)}
                    value={sprinklerConfig.remoteAreaSqftOverride ?? ''}
                    onChange={(e) =>
                      onChangeSprinklerConfig({
                        ...sprinklerConfig,
                        remoteAreaSqftOverride: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اولویت عامل خاموش‌کننده فضاهای الکترونیکی
                  </label>
                  <select
                    disabled={!canWrite}
                    value={extinguisherConfig.preferredCleanAgent || 'CO2'}
                    onChange={(e) =>
                      onChangeExtinguisherConfig({
                        ...extinguisherConfig,
                        preferredCleanAgent: e.target.value as 'CO2' | 'CLEAN_AGENT',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="CO2">دی‌اکسید کربن (CO2 — 5/6 kg)</option>
                    <option value="CLEAN_AGENT">گاز پاک پرتابل (Halotron / HFC-236fa)</option>
                  </select>
                </div>
                <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer">
                  <span className="font-bold text-slate-700 dark:text-slate-300">ترجیح کپسول‌های با ظرفیت بالاتر (۱۲kg)</span>
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={Boolean(extinguisherConfig.preferHigherCapacity)}
                    onChange={(e) =>
                      onChangeExtinguisherConfig({
                        ...extinguisherConfig,
                        preferHigherCapacity: e.target.checked,
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer">
                  <span className="font-bold text-slate-700 dark:text-slate-300">لحاظ‌کردن کپسول‌های موجود در پوشش</span>
                  <input
                    type="checkbox"
                    disabled={!canWrite}
                    checked={extinguisherConfig.includeExistingInCoverage !== false}
                    onChange={(e) =>
                      onChangeExtinguisherConfig({
                        ...extinguisherConfig,
                        includeExistingInCoverage: e.target.checked,
                      })
                    }
                  />
                </label>
              </div>
            )
          ) : (
            plugin && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ویرایش استاندارد ({plugin.standardCode})
                    </label>
                    <select
                      disabled={!canWrite}
                      value={edition}
                      onChange={(e) => setEdition(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    >
                      {plugin.supportedEditions.map((ed) => (
                        <option key={ed} value={ed}>
                          {plugin.standardCode} — Edition {ed}
                        </option>
                      ))}
                    </select>
                  </div>

                  {plugin.fields.map((field) => (
                    <div key={field.key}>
                      {field.type === 'boolean' ? (
                        <label className="h-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{field.labelFa}</span>
                          <input
                            type="checkbox"
                            disabled={!canWrite}
                            checked={Boolean(pluginInputs[field.key])}
                            onChange={(e) =>
                              setPluginInputs((prev) => ({ ...prev, [field.key]: e.target.checked }))
                            }
                          />
                        </label>
                      ) : field.type === 'select' ? (
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {field.labelFa}
                          </label>
                          <select
                            disabled={!canWrite}
                            value={pluginInputs[field.key] ?? field.defaultValue}
                            onChange={(e) =>
                              setPluginInputs((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          >
                            {(field.options || []).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {field.labelFa}
                          </label>
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            disabled={!canWrite}
                            value={pluginInputs[field.key] ?? ''}
                            onChange={(e) =>
                              setPluginInputs((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الزامات بومی / مباحث مقررات ملی ساختمان یا استاندارد شرکتی IGS (اختیاری)
                  </label>
                  <input
                    disabled={!canWrite}
                    value={localCodeNotes}
                    onChange={(e) => setLocalCodeNotes(e.target.value)}
                    placeholder="مثال: رعایت هم‌زمان مبحث سوم مقررات ملی و استاندارد IGS-E-SF..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            )
          )}

          {/* Zone 1 Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              {canWrite && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveCurrentSystem()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'در حال ذخیره...' : 'ذخیره اطلاعات طراحی سیستم'}</span>
                </button>
              )}
              {pluginEval && pluginEval.suggestedItems.length > 0 && canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    onInjectSuggestedItemsToCanvas(descriptor.type, pluginEval.suggestedItems);
                    setFeedback({
                      type: 'ok',
                      text: `تعداد ${pluginEval.suggestedItems.length} تجهیز پیشنهادی (${descriptor.standardCode}) به نقشه ۲بعدی اضافه شد.`,
                    });
                    setActiveZone('ZONE_2');
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>محاسبه و جانمایی خودکار در نقشه ({pluginEval.suggestedItems.length})</span>
                </button>
              )}
            </div>
            {activeZone !== 'ALL_ZONES' && (
              <button
                type="button"
                onClick={() => setActiveZone('ZONE_2')}
                className="px-3.5 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ادامه به ناحیه ۲: نقشه و جانمایی ۲بعدی ←
              </button>
            )}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* ZONE 2: Shared 2D Map & Placement                                     */}
      {/* ===================================================================== */}
      {isZoneVisible('ZONE_2') && (
        <section className="space-y-3">
          {pluginEval && pluginEval.suggestedItems.length > 0 && canWrite && (
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold text-indigo-900 dark:text-indigo-200">
                سیستم فعال: {descriptor.titleFa} ({descriptor.standardCode}) — امکان افزودن خودکار{' '}
                <span className="font-mono">{pluginEval.suggestedItems.length}</span> تجهیز به نقشه مشترک طبقه وجود دارد.
              </div>
              <button
                type="button"
                onClick={() => {
                  onInjectSuggestedItemsToCanvas(descriptor.type, pluginEval.suggestedItems);
                  setFeedback({
                    type: 'ok',
                    text: `${pluginEval.suggestedItems.length} تجهیز پیشنهادی ${descriptor.standardCode} روی نقشه قرار گرفت.`,
                  });
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>همگام‌سازی تجهیزات پیشنهادی روی نقشه</span>
              </button>
            </div>
          )}

          {(descriptor.type === 'PUMP_NFPA20' || descriptor.type === 'TANK_NFPA22') && (
            <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300">
              <strong>تأمین آب متمرکز ساختمان:</strong> پمپ و مخزن آب در سطح کل ساختمان تعریف می‌شوند و تغذیه‌کننده رایزرها و جعبه‌های آتش‌نشانی روی نقشه ۲بعدی زیر هستند.
            </div>
          )}

          <FireFloorCanvas2D
            isFa={isFa}
            canWrite={canWrite}
            canApprove={canApprove}
            building={building}
            floor={activeFloor}
            calc={calc}
            placedItems={placedItems}
            activeRevisionStatus={latestFloorLayout?.status}
            floorRevisions={floorRevisions}
            onLoadRevision={onLoadRevision}
            onChangePlacedItems={onChangePlacedItems}
            onFloorPlanUploaded={onFloorPlanUploaded}
            onSaveRevision={() => onSaveLayoutRevision(reviewNotes || undefined)}
            onApproveRevision={
              latestFloorLayout ? () => onApproveLayout(latestFloorLayout.id, 'APPROVED', reviewNotes || undefined) : undefined
            }
          />
        </section>
      )}

      {/* ===================================================================== */}
      {/* ZONE 3: Engineering Calculations                                      */}
      {/* ===================================================================== */}
      {isZoneVisible('ZONE_3') && (
        <section className="space-y-4">
          {isCoreFloorSystem ? (
            <FireDesignCalculationsView
              isFa={isFa}
              building={building}
              floor={activeFloor}
              calc={calc}
              sprinklerConfig={sprinklerConfig}
              extinguisherConfig={extinguisherConfig}
              onChangeSprinklerConfig={onChangeSprinklerConfig}
              onChangeExtinguisherConfig={onChangeExtinguisherConfig}
              onOpenCanvas={() => setActiveZone('ZONE_2')}
              onOpenReports={() => setActiveZone('ZONE_5')}
            />
          ) : (
            plugin &&
            pluginEval && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      ناحیه ۳: محاسبات مهندسی — {plugin.titleFa} ({plugin.standardCode} / {edition})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      خروجی مستندسازی‌شده بر مبنای پارامترهای ناحیه ۱ و اطلاعات هندسی ساختمان
                    </p>
                  </div>
                  <div className="text-xs font-bold">
                    {pluginEval.complianceStatus === 'COMPLIANT' ? (
                      <span className="text-emerald-600 dark:text-emerald-400">نتیجه: منطبق با استاندارد</span>
                    ) : pluginEval.complianceStatus === 'NON_COMPLIANT' ? (
                      <span className="text-rose-600 dark:text-rose-400">نتیجه: عدم انطباق / نیاز به اصلاح</span>
                    ) : pluginEval.complianceStatus === 'NEEDS_REVIEW' ? (
                      <span className="text-amber-600 dark:text-amber-400">نتیجه: نیازمند بازبینی یا تکمیل داده</span>
                    ) : (
                      <span className="text-slate-500">نتیجه: داده‌های ورودی ناقص</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pluginEval.summaryMetrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{m.labelFa}</div>
                      <div
                        className={`mt-1 text-sm font-black font-mono tabular-nums ${
                          m.highlight === 'bad'
                            ? 'text-rose-600'
                            : m.highlight === 'ok'
                              ? 'text-emerald-600'
                              : m.highlight === 'warn'
                                ? 'text-amber-600'
                                : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-white">مراجع بندهای استاندارد NFPA:</div>
                    <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {pluginEval.clauseCitations.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <div className="font-bold text-slate-900 dark:text-white">تحلیل مهندسی و توصیه‌های اجرایی:</div>
                    {pluginEval.recommendationsFa.map((rec, idx) => (
                      <p key={idx} className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        • {rec}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Version History for Plugin System */}
                {systemVersionHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      نسخه‌های ذخیره‌شده {descriptor.shortTitleFa} در این ساختمان:
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-700 text-slate-500">
                          <tr>
                            <th className="py-2 px-3 text-right">نسخه</th>
                            <th className="py-2 px-3 text-right">ویرایش قفل‌شده</th>
                            <th className="py-2 px-3 text-center">انطباق</th>
                            <th className="py-2 px-3 text-center">مرحله</th>
                            <th className="py-2 px-3 text-right">طراح / تایید</th>
                            <th className="py-2 px-3 text-center">عملیات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {systemVersionHistory.map((rec) => (
                            <tr key={rec.id}>
                              <td className="py-2 px-3 font-mono font-bold">v{rec.version}</td>
                              <td className="py-2 px-3 font-mono">{rec.standardCode} ({rec.standardEdition})</td>
                              <td className="py-2 px-3 text-center font-bold">{rec.complianceStatus}</td>
                              <td className="py-2 px-3 text-center font-bold">
                                {rec.designStage === 'APPROVED_ENGINEERING'
                                  ? 'تأیید نهایی'
                                  : rec.designStage === 'REVIEWED'
                                    ? 'بازبینی‌شده'
                                    : 'طراحی اولیه'}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {rec.updatedBy || '-'}
                                {rec.approvedBy ? ` · تأیید: ${rec.approvedBy}` : ''}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEdition(rec.standardEdition);
                                      setLocalCodeNotes(rec.localCodeNotes || '');
                                      setPluginInputs(rec.designInputs || {});
                                    }}
                                    className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded font-bold cursor-pointer"
                                  >
                                    بارگذاری
                                  </button>
                                  {canWrite && (
                                    <button
                                      type="button"
                                      onClick={() => void onDeleteSystem(rec.id)}
                                      className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                      title="حذف نسخه"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* ZONE 4: Design Control, Verification & CAPA                           */}
      {/* ===================================================================== */}
      {isZoneVisible('ZONE_4') && (
        <section className="space-y-4">
          {/* Mandatory Draft / Preliminary vs Approved Warning Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3 text-xs ${
              isDesignApproved
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-black">
                {isDesignApproved
                  ? 'وضعیت سند: تأیید نهایی مهندسی (Approved Engineering Output)'
                  : isDesignReviewed
                    ? 'وضعیت سند: بازبینی فنی انجام شده — در انتظار تأیید نهایی مهندسی (Reviewed)'
                    : 'وضعیت سند: طراحی مقدماتی / پیش‌نویس مهندسی (Preliminary / Draft Design)'}
              </div>
              <p className="leading-relaxed">{ENGINEERING_DISCLAIMER_FA}</p>
            </div>
          </div>

          {/* Standard Control Gate for Plugin Systems */}
          {!isCoreFloorSystem && pluginEval && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 text-xs">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                کنترل کیفیت و ارزیابی استاندارد ({descriptor.standardCode})
              </h3>
              {pluginEval.missingFields.length > 0 ? (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-bold">
                  ورودی‌های ناقص مانع تأیید نهایی: {pluginEval.missingFields.join('، ')}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold">
                  تمام پارامترهای ورودی ضروری {descriptor.shortTitleFa} تکمیل شده‌اند.
                </div>
              )}
            </div>
          )}

          {/* Shared CAPA & Blind-Spot Panel */}
          <FireGapAnalysisPanel
            isFa={isFa}
            canWrite={canWrite}
            canApprove={canApprove}
            building={building}
            floor={activeFloor}
            calc={calc}
            gapActions={gapActions}
            onCreateGapAction={onCreateGapAction}
            onUpdateGapAction={onUpdateGapAction}
            onDeleteGapAction={onDeleteGapAction}
          />
        </section>
      )}

      {/* ===================================================================== */}
      {/* ZONE 5: Final Sign-Off Workflow & Comprehensive Reporting             */}
      {/* ===================================================================== */}
      {isZoneVisible('ZONE_5') && (
        <section className="space-y-4">
          {/* 3-Stage Sign-Off Box: Designer -> Reviewer -> Approver */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  چرخه بازبینی و تأیید نهایی مهندسی — {descriptor.titleFa}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تفکیک کامل خروجی طراحی اولیه (Draft) از نقشه و محاسبات تأییدشده (Approved) با ثبت مشخصات کامل کاربری
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrintFocusedSystemReport}
                className="px-3.5 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ خلاصه تخصصی {descriptor.shortTitleFa}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[11px] font-bold text-slate-500">۱. طراح مهندسی (Designer)</div>
                <div className="font-black text-slate-900 dark:text-white">
                  {(isCoreFloorSystem ? latestFloorLayout?.calculatedBy : activeSavedPluginRecord?.updatedBy) || 'ثبت‌نشده (ذخیره نشده)'}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {isCoreFloorSystem
                    ? latestFloorLayout
                      ? `Rev.${latestFloorLayout.revision}`
                      : 'نسخه موقت'
                    : activeSavedPluginRecord
                      ? `v${activeSavedPluginRecord.version}`
                      : 'ذخیره‌نشده'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>۲. بازبین فنی (Reviewer)</span>
                </div>
                <div className="font-black text-slate-900 dark:text-white">
                  {(isCoreFloorSystem ? latestFloorLayout?.reviewedBy : activeSavedPluginRecord?.reviewedBy) || 'در انتظار بازبینی فنی'}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {(isCoreFloorSystem ? latestFloorLayout?.reviewedAt : activeSavedPluginRecord?.reviewedAt)
                    ? new Date(
                        (isCoreFloorSystem ? latestFloorLayout?.reviewedAt : activeSavedPluginRecord?.reviewedAt) as string
                      ).toLocaleString('fa-IR')
                    : '—'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  <span>۳. تأییدکننده نهایی (Technical Approver)</span>
                </div>
                <div className="font-black text-slate-900 dark:text-white">
                  {(isCoreFloorSystem ? latestFloorLayout?.approvedBy : activeSavedPluginRecord?.approvedBy) || 'تأیید نهایی نشده'}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {(isCoreFloorSystem ? latestFloorLayout?.approvedAt : activeSavedPluginRecord?.approvedAt)
                    ? new Date(
                        (isCoreFloorSystem ? latestFloorLayout?.approvedAt : activeSavedPluginRecord?.approvedAt) as string
                      ).toLocaleString('fa-IR')
                    : '—'}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end pt-1">
              <div className="flex-1 text-xs">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  توضیحات بازبینی / یادداشت تغییرات نسخه (Review & Change Notes)
                </label>
                <input
                  disabled={!canWrite && !canApprove}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="توضیحات کنترل فنی، اصلاحات انجام‌شده یا شروط تأیید..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {canApprove && (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSignOff('REVIEWED')}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>ثبت بازبینی فنی</span>
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSignOff('APPROVED')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تأیید نهایی مهندسی</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Shared Multi-Report & Excel/PDF Center */}
          <FireDesignReportsPanel
            isFa={isFa}
            building={building}
            floors={floors}
            selectedFloor={activeFloor}
            calc={calc}
            placedItems={placedItems}
            systems={savedSystems.filter((s) => s.buildingId === building.id)}
            gapActions={gapActions.filter((g) => g.buildingId === building.id)}
          />
        </section>
      )}
    </div>
  );
}

function ContextTile({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
      <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`font-bold text-slate-900 dark:text-white mt-0.5 truncate ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </div>
    </div>
  );
}
