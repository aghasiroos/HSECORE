import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Layers,
  Save,
  Trash2,
  Droplets,
  Flame,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  BoxSelect,
  AlertTriangle,
  Database,
  Network,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import type {
  CeilingType,
  FireClass,
  FireDesignBuilding,
  FireDesignFloor,
  FloorObstacle,
  FloorSpaceZone,
  HazardGroup,
  Nfpa10Edition,
  Nfpa13Edition,
  OccupancyType,
  StructureType,
  WaterSourceType,
} from './types';
import { OCCUPANCY_LABELS_FA } from './nfpaEngine';
import {
  WATER_SOURCE_OPTIONS,
  getConflictingWaterFieldWarnings,
  resolveHasFirePump,
  resolveHasNetworkConnection,
  resolveWaterSourceType,
  sanitizeWaterSupply,
  toNullablePositiveNumber,
} from './waterSupplyUtils';

interface Props {
  isFa: boolean;
  canWrite: boolean;
  canApprove: boolean;
  buildings: FireDesignBuilding[];
  floors: FireDesignFloor[];
  companies: { id: number; name: string; code: string }[];
  units: { id: number; name: string; code: string }[];
  selectedBuildingId: number | null;
  selectedFloorId: number | null;
  onSelectBuilding: (id: number) => void;
  onSelectFloor: (id: number) => void;
  onSaveBuilding: (data: Partial<FireDesignBuilding>, id?: number) => Promise<void>;
  onRequestDeleteBuilding: (building: FireDesignBuilding) => void;
  onSaveFloor: (data: Partial<FireDesignFloor>, id?: number) => Promise<void>;
  onDeleteFloor: (id: number) => Promise<void>;
  onProceedToCalculations: () => void;
  openNewBuildingSeq?: number;
}

const STRUCTURE_OPTIONS: { value: StructureType; label: string }[] = [
  { value: 'CONCRETE', label: 'بتن مسلح (Reinforced Concrete)' },
  { value: 'STEEL_PROTECTED', label: 'اسکلت فلزی با پوشش مقاوم حریق' },
  { value: 'STEEL_UNPROTECTED', label: 'اسکلت فلزی بدون پوشش (Unprotected Steel)' },
  { value: 'MASONRY', label: 'سازه بنایی / سوله صنعتی' },
  { value: 'COMPOSITE', label: 'سازه مرکب (Composite)' },
];

const CEILING_OPTIONS: { value: CeilingType; label: string }[] = [
  { value: 'FLAT_UNOBSTRUCTED', label: 'سقف تخت بدون مانع (Unobstructed)' },
  { value: 'EXPOSED_BEAMS', label: 'سقف با تیرآهن/تیرچه نمایان (Beamed)' },
  { value: 'SUSPENDED_CEILING', label: 'دارای سقف کاذب (Suspended Ceiling)' },
  { value: 'OPEN_TRUSS', label: 'سقف خرپایی سوله (Open Truss)' },
  { value: 'SLOPED', label: 'سقف شیبدار (Sloped > 2:12)' },
];

const FIRE_CLASS_OPTIONS: { value: FireClass; label: string; desc: string }[] = [
  { value: 'A', label: 'کلاس A (جامدات)', desc: 'کاغذ، چوب، کارتن، پلاستیک' },
  { value: 'B', label: 'کلاس B (مایعات/گاز)', desc: 'هیدروکربن، حلال، سوخت، رنگ' },
  { value: 'C', label: 'کلاس C (برقی)', desc: 'تابلو برق، سرور، پست، کنترل‌روم' },
  { value: 'D', label: 'کلاس D (فلزات)', desc: 'منیزیم، سدیم، پودر آلومینیوم' },
  { value: 'K', label: 'کلاس K (چربی)', desc: 'روغن‌ها و تجهیزات آشپزخانه صنعتی' },
];

export default function BuildingFloorRegistryPanel({
  isFa,
  canWrite,
  canApprove,
  buildings,
  floors,
  companies,
  units,
  selectedBuildingId,
  selectedFloorId,
  onSelectBuilding,
  onSelectFloor,
  onSaveBuilding,
  onRequestDeleteBuilding,
  onSaveFloor,
  onDeleteFloor,
  onProceedToCalculations,
  openNewBuildingSeq = 0,
}: Props) {
  const activeBuilding = buildings.find((b) => b.id === selectedBuildingId) || null;
  const buildingFloors = floors.filter((f) => f.buildingId === selectedBuildingId);
  const activeFloor = buildingFloors.find((f) => f.id === selectedFloorId) || null;

  const [isNewBuildingMode, setIsNewBuildingMode] = useState(buildings.length === 0);
  const [isNewFloorMode, setIsNewFloorMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [bldForm, setBldForm] = useState<Partial<FireDesignBuilding>>({
    code: '',
    name: '',
    companyName: companies[0]?.name || 'مجتمع پتروشیمی رجال',
    unitName: units[0]?.name || '',
    occupancyType: 'INDUSTRIAL_PROCESS',
    nfpa13Edition: '2022',
    nfpa10Edition: '2022',
    floorsAboveGround: 1,
    basementFloors: 0,
    structureType: 'CONCRETE',
    ceilingType: 'FLAT_UNOBSTRUCTED',
    storedMaterials: '',
    hazardNature: ['A', 'B'],
    riskLevelOverride: 'AUTO',
    occupantLoad: 25,
    activityType: '',
    currentSuppressionNotes: '',
    waterSourceType: 'FIRE_NETWORK',
    waterSupply: {
      sourceType: 'FIRE_NETWORK',
      hasFirePump: false,
      hasNetworkConnection: true,
      tankCapacityLiters: null,
      pumpRatedFlowGpm: null,
      pumpRatedPressureBar: null,
      staticPressureBar: null,
      residualPressureBar: null,
      riserDiameterMm: 100,
      pipeMaterial: 'BLACK_STEEL_WET',
      cFactor: 120,
      hoseStreamAllowanceGpm: null,
      supplyDurationMin: null,
    },
  });

  const [flrForm, setFlrForm] = useState<Partial<FireDesignFloor>>({
    floorCode: 'GF',
    floorLabel: 'طبقه همکف',
    floorOrder: 0,
    isBasement: false,
    lengthM: 30,
    widthM: 20,
    ceilingHeightM: 4.5,
    areaSqm: 600,
    falseCeilingHeightM: 0,
    beamDepthM: 0,
    beamSpacingM: 0,
    spaces: [],
    obstacles: [],
    notes: '',
  });

  // Quick add zone / obstacle states
  const [newSpace, setNewSpace] = useState<Partial<FloorSpaceZone>>({
    name: '',
    occupancyType: 'OTHER',
    widthM: 6,
    heightM: 5,
    xM: 0,
    yM: 0,
    hazardClasses: ['A'],
    hasCriticalElectronics: false,
    hasFalseCeiling: false,
  });

  const [newObstacle, setNewObstacle] = useState<Partial<FloorObstacle>>({
    type: 'WALL',
    label: 'دیوار جداکننده',
    xM: 10,
    yM: 0,
    widthM: 0.4,
    heightM: 10,
    blocksSprinkler: true,
    blocksTravel: true,
  });

  useEffect(() => {
    if (activeBuilding && !isNewBuildingMode) {
      const ws = activeBuilding.waterSupply || {};
      const resolvedSource = resolveWaterSourceType(activeBuilding, 'FIRE_NETWORK');
      const resolvedPump = resolveHasFirePump(ws) ?? false;
      const resolvedNet = resolveHasNetworkConnection(ws, resolvedSource);

      setBldForm({
        ...activeBuilding,
        hazardNature: Array.isArray(activeBuilding.hazardNature) ? activeBuilding.hazardNature : ['A'],
        waterSourceType: resolvedSource,
        waterSupply: {
          riserDiameterMm: 100,
          pipeMaterial: 'BLACK_STEEL_WET',
          cFactor: 120,
          ...ws,
          sourceType: resolvedSource,
          hasFirePump: resolvedPump,
          hasNetworkConnection: resolvedNet,
        },
      });
    }
  }, [activeBuilding, isNewBuildingMode]);

  useEffect(() => {
    if (activeFloor && !isNewFloorMode) {
      setFlrForm({
        ...activeFloor,
        spaces: Array.isArray(activeFloor.spaces) ? activeFloor.spaces : [],
        obstacles: Array.isArray(activeFloor.obstacles) ? activeFloor.obstacles : [],
      });
    }
  }, [activeFloor, isNewFloorMode]);

  const startNewBuilding = () => {
    setIsNewBuildingMode(true);
    setFeedback(null);
    setBldForm({
      code: `BLD-${Math.floor(100 + Math.random() * 900)}`,
      name: '',
      companyName: companies[0]?.name || 'مجتمع پتروشیمی رجال',
      unitName: units[0]?.name || '',
      occupancyType: 'INDUSTRIAL_PROCESS',
      nfpa13Edition: '2022',
      nfpa10Edition: '2022',
      floorsAboveGround: 1,
      basementFloors: 0,
      structureType: 'CONCRETE',
      ceilingType: 'FLAT_UNOBSTRUCTED',
      storedMaterials: '',
      hazardNature: ['A'],
      riskLevelOverride: 'AUTO',
      occupantLoad: 20,
      activityType: '',
      currentSuppressionNotes: '',
      waterSourceType: 'FIRE_NETWORK',
      waterSupply: {
        sourceType: 'FIRE_NETWORK',
        hasFirePump: false,
        hasNetworkConnection: true,
        tankCapacityLiters: null,
        pumpRatedFlowGpm: null,
        pumpRatedPressureBar: null,
        staticPressureBar: null,
        residualPressureBar: null,
        riserDiameterMm: 100,
        pipeMaterial: 'BLACK_STEEL_WET',
        cFactor: 120,
        hoseStreamAllowanceGpm: null,
        supplyDurationMin: null,
      },
    });
  };

  useEffect(() => {
    if (openNewBuildingSeq > 0) {
      startNewBuilding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewBuildingSeq]);

  const startNewFloor = () => {
    setIsNewFloorMode(true);
    const nextOrder = buildingFloors.length;
    setFlrForm({
      floorCode: nextOrder === 0 ? 'GF' : `F${nextOrder}`,
      floorLabel: nextOrder === 0 ? 'طبقه همکف' : `طبقه ${nextOrder}`,
      floorOrder: nextOrder,
      isBasement: false,
      lengthM: 25,
      widthM: 18,
      ceilingHeightM: 4,
      areaSqm: 450,
      falseCeilingHeightM: 0,
      beamDepthM: 0,
      beamSpacingM: 0,
      spaces: [],
      obstacles: [],
      notes: '',
    });
  };

  const toggleHazardClass = (fc: FireClass) => {
    const current = new Set(bldForm.hazardNature || []);
    if (current.has(fc)) current.delete(fc);
    else current.add(fc);
    setBldForm({ ...bldForm, hazardNature: Array.from(current) });
  };

  const activeWaterSource: WaterSourceType =
    bldForm.waterSupply?.sourceType || bldForm.waterSourceType || 'FIRE_NETWORK';
  const activeHasFirePump = Boolean(bldForm.waterSupply?.hasFirePump);
  const activeHasNetworkConnection =
    activeWaterSource === 'FIRE_NETWORK' ? true : Boolean(bldForm.waterSupply?.hasNetworkConnection);

  const conflictingWaterFields = getConflictingWaterFieldWarnings(
    bldForm.waterSupply,
    activeWaterSource,
    activeHasFirePump,
    activeHasNetworkConnection
  );

  const handleWaterSourceSelect = (nextSource: WaterSourceType) => {
    const prevWs = bldForm.waterSupply || {};
    const nextHasNetworkConn =
      nextSource === 'FIRE_NETWORK'
        ? true
        : typeof prevWs.hasNetworkConnection === 'boolean' && prevWs.sourceType === 'STORAGE_TANK'
          ? prevWs.hasNetworkConnection
          : toNullablePositiveNumber(prevWs.staticPressureBar) !== null &&
              prevWs.sourceType === 'STORAGE_TANK';

    setBldForm({
      ...bldForm,
      waterSourceType: nextSource,
      waterSupply: {
        ...prevWs,
        sourceType: nextSource,
        hasNetworkConnection: nextSource === 'FIRE_NETWORK' ? true : nextHasNetworkConn,
      },
    });
  };

  const handleClearConflictingWaterFields = () => {
    const sanitized = sanitizeWaterSupply(bldForm.waterSupply, activeWaterSource);
    setBldForm({
      ...bldForm,
      waterSourceType: sanitized.waterSourceType,
      waterSupply: sanitized.waterSupply,
    });
  };

  const handleRestoreSavedWaterSource = () => {
    if (!activeBuilding) return;
    const savedSource = resolveWaterSourceType(activeBuilding, 'FIRE_NETWORK');
    const savedWs = activeBuilding.waterSupply || {};
    setBldForm({
      ...bldForm,
      waterSourceType: savedSource,
      waterSupply: {
        ...(bldForm.waterSupply || {}),
        sourceType: savedSource,
        hasFirePump: resolveHasFirePump(savedWs) ?? activeHasFirePump,
        hasNetworkConnection: resolveHasNetworkConnection(savedWs, savedSource),
      },
    });
  };

  const handleBuildingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const ws = bldForm.waterSupply || {};
    const missingActiveWater: string[] = [];

    if (activeWaterSource === 'FIRE_NETWORK') {
      if (toNullablePositiveNumber(ws.staticPressureBar) === null) {
        missingActiveWater.push('فشار استاتیک شبکه (Bar)');
      }
    } else {
      if (toNullablePositiveNumber(ws.tankCapacityLiters) === null) {
        missingActiveWater.push('حجم مخزن ذخیره آب (لیتر)');
      }
      if (activeHasNetworkConnection && toNullablePositiveNumber(ws.staticPressureBar) === null) {
        missingActiveWater.push('فشار استاتیک شبکه متصل (Bar)');
      }
    }

    if (activeHasFirePump) {
      if (toNullablePositiveNumber(ws.pumpRatedFlowGpm) === null) {
        missingActiveWater.push('دبی نامی پمپ (GPM)');
      }
      if (toNullablePositiveNumber(ws.pumpRatedPressureBar) === null) {
        missingActiveWater.push('فشار نامی پمپ (Bar)');
      }
    }

    if (toNullablePositiveNumber(ws.riserDiameterMm) === null || Number(ws.riserDiameterMm) < 25) {
      missingActiveWater.push('قطر لوله رایزر (حداقل ۲۵ میلی‌متر)');
    }

    if (missingActiveWater.length > 0) {
      setFeedback({
        type: 'err',
        text: `لطفاً فیلدهای اجباری بخش تأمین آب را تکمیل کنید: ${missingActiveWater.join('، ')}`,
      });
      return;
    }

    const sanitized = sanitizeWaterSupply(ws, activeWaterSource);
    const payload: Partial<FireDesignBuilding> = {
      ...bldForm,
      waterSourceType: sanitized.waterSourceType,
      waterSupply: sanitized.waterSupply,
    };

    setSaving(true);
    try {
      await onSaveBuilding(payload, isNewBuildingMode ? undefined : activeBuilding?.id);
      setIsNewBuildingMode(false);
      setFeedback({ type: 'ok', text: 'مشخصات ساختمان و پیکربندی منبع آب با موفقیت در پایگاه داده ذخیره شد.' });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'خطا در ذخیره ساختمان' });
    } finally {
      setSaving(false);
    }
  };

  const handleFloorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId) {
      setFeedback({ type: 'err', text: 'ابتدا ساختمان را ثبت یا انتخاب کنید.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await onSaveFloor(
        {
          ...flrForm,
          buildingId: selectedBuildingId,
        },
        isNewFloorMode ? undefined : activeFloor?.id
      );
      setIsNewFloorMode(false);
      setFeedback({ type: 'ok', text: 'اطلاعات هندسی و معماری طبقه ذخیره گردید.' });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'خطا در ذخیره طبقه' });
    } finally {
      setSaving(false);
    }
  };

  const addSpaceZone = () => {
    if (!newSpace.name?.trim()) return;
    const areaSqm = Number(((newSpace.widthM || 4) * (newSpace.heightM || 4)).toFixed(1));
    const item: FloorSpaceZone = {
      id: `sp-${Date.now()}`,
      name: newSpace.name.trim(),
      occupancyType: (newSpace.occupancyType as OccupancyType) || 'OTHER',
      areaSqm,
      xM: Number(newSpace.xM || 0),
      yM: Number(newSpace.yM || 0),
      widthM: Number(newSpace.widthM || 4),
      heightM: Number(newSpace.heightM || 4),
      hazardClasses: newSpace.hazardClasses?.length ? newSpace.hazardClasses : ['A'],
      hasFalseCeiling: Boolean(newSpace.hasFalseCeiling),
      hasCriticalElectronics: Boolean(newSpace.hasCriticalElectronics),
      sprinklerProtected: !newSpace.hasCriticalElectronics,
    };
    setFlrForm({ ...flrForm, spaces: [...(flrForm.spaces || []), item] });
    setNewSpace({ ...newSpace, name: '' });
  };

  const addObstacle = () => {
    if (!newObstacle.label?.trim()) return;
    const item: FloorObstacle = {
      id: `obs-${Date.now()}`,
      type: (newObstacle.type as FloorObstacle['type']) || 'WALL',
      label: newObstacle.label.trim(),
      xM: Number(newObstacle.xM || 0),
      yM: Number(newObstacle.yM || 0),
      widthM: Number(newObstacle.widthM || 0.3),
      heightM: Number(newObstacle.heightM || 5),
      blocksSprinkler: newObstacle.blocksSprinkler !== false,
      blocksTravel: newObstacle.blocksTravel !== false,
    };
    setFlrForm({ ...flrForm, obstacles: [...(flrForm.obstacles || []), item] });
  };

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {feedback && (
        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Top Grid: Building Selector + Building Engineering Form */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left List: Registered Buildings */}
        <div className="xl:col-span-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              <h3 className="font-black text-sm text-slate-800 dark:text-slate-100">فهرست ساختمان‌ها</h3>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={startNewBuilding}
                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ساختمان جدید</span>
              </button>
            )}
          </div>

          {buildings.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <Building2 className="w-8 h-8 mx-auto opacity-40" />
              <p>هنوز ساختمانی ثبت نشده است. اولین ساختمان را در فرم مقابل تعریف کنید.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
              {buildings.map((b) => {
                const isSelected = !isNewBuildingMode && b.id === selectedBuildingId;
                const floorCount = floors.filter((f) => f.buildingId === b.id).length;
                return (
                  <div
                    key={b.id}
                    className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-red-50/70 dark:bg-red-950/40 border-red-400 dark:border-red-600'
                        : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewBuildingMode(false);
                        onSelectBuilding(b.id);
                      }}
                      className="flex-1 min-w-0 text-right cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-red-600 dark:text-red-400">
                          {b.code}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {b.status === 'APPROVED' ? 'تاییدشده' : b.status === 'DESIGNED' ? 'طراحی‌شده' : 'پیش‌نویس'}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate mt-0.5">{b.name}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {b.unitName} · {OCCUPANCY_LABELS_FA[b.occupancyType] || b.occupancyType}
                      </p>
                    </button>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {floorCount} طبقه
                      </span>
                      {canApprove && (
                        <button
                          type="button"
                          onClick={() => onRequestDeleteBuilding(b)}
                          title="حذف ساختمان"
                          aria-label={`حذف ساختمان ${b.name}`}
                          className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floor List under Selected Building */}
          {selectedBuildingId && !isNewBuildingMode && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>طبقات ساختمان</span>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={startNewFloor}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>افزودن طبقه</span>
                  </button>
                )}
              </div>

              {buildingFloors.length === 0 ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg">
                  برای اجرای محاسبات، حداقل یک طبقه با ابعاد دقیق ثبت کنید.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {buildingFloors.map((f) => {
                    const isFlrActive = !isNewFloorMode && f.id === selectedFloorId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setIsNewFloorMode(false);
                          onSelectFloor(f.id);
                        }}
                        className={`w-full text-right px-3 py-2 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isFlrActive
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200 font-bold'
                            : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span>
                          {f.floorLabel} ({f.floorCode})
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {f.areaSqm} m² · H:{f.ceilingHeightM}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Building & Water Supply Specification Form */}
        <div className="xl:col-span-8 space-y-5">
          <form
            onSubmit={handleBuildingSubmit}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-600" />
                  <span>{isNewBuildingMode ? 'تعریف ساختمان جدید' : `مشخصات فنی ساختمان: ${activeBuilding?.name || ''}`}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  تمام فیلدهای کاربری، مصالح، مواد موجود و ماهیت خطر برای محاسبات NFPA الزامی هستند.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isNewBuildingMode && activeBuilding && canApprove && (
                  <button
                    type="button"
                    onClick={() => onRequestDeleteBuilding(activeBuilding)}
                    className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                )}
                {canWrite && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'در حال ذخیره...' : isNewBuildingMode ? 'ثبت ساختمان' : 'بروزرسانی ساختمان'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">کد ساختمان *</label>
                <input
                  required
                  value={bldForm.code || ''}
                  onChange={(e) => setBldForm({ ...bldForm, code: e.target.value })}
                  placeholder="مثال: BLD-PP-01"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">نام ساختمان *</label>
                <input
                  required
                  value={bldForm.name || ''}
                  onChange={(e) => setBldForm({ ...bldForm, name: e.target.value })}
                  placeholder="مثال: ساختمان کنترل مرکزی پلی‌اتیلن"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">شرکت / مجتمع</label>
                <input
                  value={bldForm.companyName || ''}
                  onChange={(e) => setBldForm({ ...bldForm, companyName: e.target.value })}
                  list="fd-companies-list"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <datalist id="fd-companies-list">
                  {companies.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">واحد بهره‌بردار *</label>
                <input
                  required
                  value={bldForm.unitName || ''}
                  onChange={(e) => setBldForm({ ...bldForm, unitName: e.target.value })}
                  list="fd-units-list"
                  placeholder="نام واحد سازمانی یا فرآیندی"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
                <datalist id="fd-units-list">
                  {units.map((u) => (
                    <option key={u.id} value={u.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">نوع کاربری ساختمان *</label>
                <select
                  value={bldForm.occupancyType || 'INDUSTRIAL_PROCESS'}
                  onChange={(e) => setBldForm({ ...bldForm, occupancyType: e.target.value as OccupancyType })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  {Object.entries(OCCUPANCY_LABELS_FA).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">طبقات روی زمین</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={bldForm.floorsAboveGround ?? 1}
                    onChange={(e) => setBldForm({ ...bldForm, floorsAboveGround: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">زیرزمین</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={bldForm.basementFloors ?? 0}
                    onChange={(e) => setBldForm({ ...bldForm, basementFloors: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">نوع سازه *</label>
                <select
                  value={bldForm.structureType || 'CONCRETE'}
                  onChange={(e) => setBldForm({ ...bldForm, structureType: e.target.value as StructureType })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  {STRUCTURE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">نوع سقف *</label>
                <select
                  value={bldForm.ceilingType || 'FLAT_UNOBSTRUCTED'}
                  onChange={(e) => setBldForm({ ...bldForm, ceilingType: e.target.value as CeilingType })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  {CEILING_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">تعداد نفرات حاضر</label>
                <input
                  type="number"
                  min={0}
                  value={bldForm.occupantLoad ?? 0}
                  onChange={(e) => setBldForm({ ...bldForm, occupantLoad: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">ویرایش NFPA 13</label>
                <select
                  value={bldForm.nfpa13Edition || '2022'}
                  onChange={(e) => setBldForm({ ...bldForm, nfpa13Edition: e.target.value as Nfpa13Edition })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                >
                  <option value="2022">NFPA 13 — 2022 Edition</option>
                  <option value="2019">NFPA 13 — 2019 Edition</option>
                  <option value="2016">NFPA 13 — 2016 Edition</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">ویرایش NFPA 10</label>
                <select
                  value={bldForm.nfpa10Edition || '2022'}
                  onChange={(e) => setBldForm({ ...bldForm, nfpa10Edition: e.target.value as Nfpa10Edition })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                >
                  <option value="2022">NFPA 10 — 2022 Edition</option>
                  <option value="2018">NFPA 10 — 2018 Edition</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">طبقه‌بندی خطر (NFPA 13)</label>
                <select
                  value={bldForm.riskLevelOverride || 'AUTO'}
                  onChange={(e) => setBldForm({ ...bldForm, riskLevelOverride: e.target.value as 'AUTO' | HazardGroup })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  <option value="AUTO">تشخیص هوشمند بر اساس کاربری و مواد</option>
                  <option value="LIGHT">خطر سبک (Light Hazard)</option>
                  <option value="OH1">خطر عادی گروه ۱ (OH1)</option>
                  <option value="OH2">خطر عادی گروه ۲ (OH2)</option>
                  <option value="EH1">خطر فوق‌العاده گروه ۱ (EH1)</option>
                  <option value="EH2">خطر فوق‌العاده گروه ۲ (EH2)</option>
                  <option value="SPECIAL_STORAGE">انبارش مرتفع / ویژه (High-Piled)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نوع مواد و محصولات موجود *
                </label>
                <input
                  value={bldForm.storedMaterials || ''}
                  onChange={(e) => setBldForm({ ...bldForm, storedMaterials: e.target.value })}
                  placeholder="مثال: گرانول پلی‌پروپیلن، حلال‌های هیدروکربنی، رک‌های سرور و UPS"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نوع فعالیت و فرآیند *
                </label>
                <input
                  value={bldForm.activityType || ''}
                  onChange={(e) => setBldForm({ ...bldForm, activityType: e.target.value })}
                  placeholder="مثال: بسته‌بندی، نگهداری مواد شیمیایی یا مانیتورینگ DCS"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Fire Classes Checkboxes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                ماهیت خطر و کلاس‌های حریق محتمل *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {FIRE_CLASS_OPTIONS.map((fc) => {
                  const active = (bldForm.hazardNature || []).includes(fc.value);
                  return (
                    <button
                      key={fc.value}
                      type="button"
                      onClick={() => toggleHazardClass(fc.value)}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        active
                          ? 'bg-red-50 dark:bg-red-950/50 border-red-500 text-red-900 dark:text-red-200'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-black text-xs">{fc.label}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{fc.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Water Source, Tank & Fire Pump Inputs (Conditional & Smart) */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-600" />
                  <span>مشخصات منبع آب، مخزن و پمپ آتش‌نشانی (جهت بررسی کفایت هیدرولیکی)</span>
                </h4>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  فیلدهای ستاره‌دار (*) برای محاسبه هیدرولیکی الزامی هستند
                </span>
              </div>

              {/* Two-Option Water Source Selector */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-black text-slate-700 dark:text-slate-200">
                  منبع تأمین آب آتش‌نشانی: <span className="text-rose-500">*</span>
                </label>
                <div
                  role="radiogroup"
                  aria-label="منبع تأمین آب آتش‌نشانی"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  {WATER_SOURCE_OPTIONS.map((opt) => {
                    const isSelected = activeWaterSource === opt.value;
                    const IconComp = opt.value === 'FIRE_NETWORK' ? Network : Database;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleWaterSourceSelect(opt.value)}
                        className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 dark:border-sky-400 ring-2 ring-sky-500/20 text-sky-950 dark:text-sky-100'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black">{opt.titleFa}</span>
                            {isSelected && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-sky-600 text-white">
                                فعال
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] opacity-80 mt-0.5 leading-relaxed">{opt.subtitleFa}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Warning Banner when switching away from previously entered/saved source fields */}
              {conflictingWaterFields.length > 0 && (
                <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-700/80 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-[11px] flex flex-wrap items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2 flex-1 min-w-[240px]">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-black">
                        هشدار تغییر منبع / پیکربندی: داده‌های قبلی غیرمرتبط در ویرایش موقتاً حفظ شده‌اند
                      </div>
                      <p className="leading-relaxed opacity-90">
                        مقادیر ثبت‌شده برای{' '}
                        <span className="font-bold underline decoration-amber-400">
                          {conflictingWaterFields.join('، ')}
                        </span>{' '}
                        در حالت فعلی کاربردی ندارند و در صورت ذخیره با پیکربندی جدید، به‌صورت{' '}
                        <span className="font-mono font-bold">NULL</span> در پایگاه داده ذخیره خواهند شد.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeBuilding && !isNewBuildingMode && (
                      <button
                        type="button"
                        onClick={handleRestoreSavedWaterSource}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>بازگشت به منبع قبلی</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleClearConflictingWaterFields}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700"
                    >
                      پاک‌سازی مقادیر غیرمرتبط
                    </button>
                  </div>
                </div>
              )}

              {/* Pump Existence Selector (Applies to both FIRE_NETWORK and STORAGE_TANK) */}
              <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
                    <Gauge className="w-4 h-4 text-sky-600" />
                    <span>وضعیت وجود پمپ آتش‌نشانی (بوسترپمپ):</span>
                  </div>
                  <div className="inline-flex rounded-xl p-1 bg-slate-200/80 dark:bg-slate-800 border border-slate-300/60 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() =>
                        setBldForm({
                          ...bldForm,
                          waterSupply: { ...(bldForm.waterSupply || {}), hasFirePump: false },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        !activeHasFirePump
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      پمپ ندارد
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBldForm({
                          ...bldForm,
                          waterSupply: { ...(bldForm.waterSupply || {}), hasFirePump: true },
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        activeHasFirePump
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      پمپ آتش‌نشانی دارد
                    </button>
                  </div>
                </div>

                {/* Network Connection Toggle ONLY in STORAGE_TANK mode */}
                {activeWaterSource === 'STORAGE_TANK' && (
                  <label className="flex items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeHasNetworkConnection}
                      onChange={(e) =>
                        setBldForm({
                          ...bldForm,
                          waterSupply: {
                            ...(bldForm.waterSupply || {}),
                            hasNetworkConnection: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500"
                    />
                    <span>اتصال به شبکه شهری یا شبکه مستقل آب آتش‌نشانی موجود است</span>
                  </label>
                )}
              </div>

              {/* Conditional Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Tank Capacity: COMPLETELY HIDDEN on FIRE_NETWORK, REQUIRED on STORAGE_TANK */}
                {activeWaterSource === 'STORAGE_TANK' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                      حجم مخزن (لیتر) <span className="text-rose-500">* اجباری</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="مثال: 150000"
                      value={bldForm.waterSupply?.tankCapacityLiters ?? ''}
                      onChange={(e) =>
                        setBldForm({
                          ...bldForm,
                          waterSupply: {
                            ...(bldForm.waterSupply || {}),
                            tankCapacityLiters: e.target.value ? Number(e.target.value) : null,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                {/* Pump Flow & Pressure: ONLY shown when hasFirePump is true */}
                {activeHasFirePump && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        دبی نامی پمپ (GPM) <span className="text-rose-500">* اجباری</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="مثال: 750"
                        value={bldForm.waterSupply?.pumpRatedFlowGpm ?? ''}
                        onChange={(e) =>
                          setBldForm({
                            ...bldForm,
                            waterSupply: {
                              ...(bldForm.waterSupply || {}),
                              pumpRatedFlowGpm: e.target.value ? Number(e.target.value) : null,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        فشار نامی پمپ (Bar) <span className="text-rose-500">* اجباری</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        placeholder="مثال: 8.5"
                        value={bldForm.waterSupply?.pumpRatedPressureBar ?? ''}
                        onChange={(e) =>
                          setBldForm({
                            ...bldForm,
                            waterSupply: {
                              ...(bldForm.waterSupply || {}),
                              pumpRatedPressureBar: e.target.value ? Number(e.target.value) : null,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                {/* Network Static & Residual Pressure: Shown on FIRE_NETWORK, or on STORAGE_TANK ONLY when hasNetworkConnection is true */}
                {(activeWaterSource === 'FIRE_NETWORK' || activeHasNetworkConnection) && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                        فشار استاتیک شبکه (Bar) <span className="text-rose-500">* اجباری</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        placeholder="مثال: 6.2"
                        value={bldForm.waterSupply?.staticPressureBar ?? ''}
                        onChange={(e) =>
                          setBldForm({
                            ...bldForm,
                            waterSupply: {
                              ...(bldForm.waterSupply || {}),
                              staticPressureBar: e.target.value ? Number(e.target.value) : null,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        فشار باقیمانده شبکه (Bar){' '}
                        <span className="text-[10px] font-normal text-slate-400">(اختیاری)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0.1}
                        placeholder="مثال: 4.8"
                        value={bldForm.waterSupply?.residualPressureBar ?? ''}
                        onChange={(e) =>
                          setBldForm({
                            ...bldForm,
                            waterSupply: {
                              ...(bldForm.waterSupply || {}),
                              residualPressureBar: e.target.value ? Number(e.target.value) : null,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                      />
                    </div>
                  </>
                )}

                {/* Common Piping & Network Specification Fields (Always Visible in Both Modes) */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    قطر لوله رایزر (mm) <span className="text-rose-500">* اجباری</span>
                  </label>
                  <input
                    type="number"
                    min={25}
                    value={bldForm.waterSupply?.riserDiameterMm ?? 100}
                    onChange={(e) =>
                      setBldForm({
                        ...bldForm,
                        waterSupply: {
                          ...(bldForm.waterSupply || {}),
                          riserDiameterMm: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {activeWaterSource === 'FIRE_NETWORK'
                      ? 'جنس لوله و مشخصات شبکه (ضریب C)'
                      : 'جنس لوله و مشخصات شبکه داخلی (ضریب C)'}
                  </label>
                  <select
                    value={bldForm.waterSupply?.pipeMaterial || 'BLACK_STEEL_WET'}
                    onChange={(e) =>
                      setBldForm({
                        ...bldForm,
                        waterSupply: {
                          ...(bldForm.waterSupply || {}),
                          pipeMaterial: e.target.value as any,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  >
                    <option value="BLACK_STEEL_WET">فولادی سیاه سیستم تر (C=120)</option>
                    <option value="BLACK_STEEL_DRY">فولادی سیستم خشک/Deluge (C=100)</option>
                    <option value="GALVANIZED">گالوانیزه (C=120)</option>
                    <option value="CPVC_COPPER">CPVC / مسی (C=150)</option>
                  </select>
                </div>

                {/* Optional Hydraulic Parameters */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    مدت تداوم تأمین آب (دقیقه){' '}
                    <span className="text-[10px] font-normal text-slate-400">(اختیاری)</span>
                  </label>
                  <input
                    type="number"
                    min={15}
                    placeholder="پیش‌فرض NFPA (۳۰ تا ۱۲۰)"
                    value={bldForm.waterSupply?.supplyDurationMin ?? ''}
                    onChange={(e) =>
                      setBldForm({
                        ...bldForm,
                        waterSupply: {
                          ...(bldForm.waterSupply || {}),
                          supplyDurationMin: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    دبی هم‌زمان هوز/سایر سیستم‌ها (GPM){' '}
                    <span className="text-[10px] font-normal text-slate-400">(اختیاری)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="پیش‌فرض NFPA (۱۰۰ تا ۵۰۰)"
                    value={bldForm.waterSupply?.hoseStreamAllowanceGpm ?? ''}
                    onChange={(e) =>
                      setBldForm({
                        ...bldForm,
                        waterSupply: {
                          ...(bldForm.waterSupply || {}),
                          hoseStreamAllowanceGpm: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    وضعیت تجهیزات اطفای موجود و توضیحات تکمیلی شبکه{' '}
                    <span className="text-[10px] font-normal text-slate-400">(اختیاری)</span>
                  </label>
                  <input
                    value={bldForm.currentSuppressionNotes || ''}
                    onChange={(e) => setBldForm({ ...bldForm, currentSuppressionNotes: e.target.value })}
                    placeholder="مثال: دارای ۴ جعبه هوزریل متصل به رینگ شمالی، فاقد سیستم اسپرینکلر سقفی..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </form>

          {/* Floor Geometry, Spaces & Obstacles Form */}
          {selectedBuildingId && !isNewBuildingMode && (
            <form
              onSubmit={handleFloorSubmit}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <BoxSelect className="w-4 h-4 text-blue-600" />
                    <span>
                      {isNewFloorMode
                        ? 'ثبت طبقه جدید و هندسه فضا'
                        : `مشخصات معماری و هندسی طبقه: ${activeFloor?.floorLabel || ''}`}
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!isNewFloorMode && activeFloor && canApprove && (
                    <button
                      type="button"
                      onClick={() => onDeleteFloor(activeFloor.id)}
                      className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف طبقه</span>
                    </button>
                  )}
                  {canWrite && (
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isNewFloorMode ? 'ثبت طبقه' : 'ذخیره تغییرات طبقه'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">کد طبقه *</label>
                  <input
                    required
                    value={flrForm.floorCode || ''}
                    onChange={(e) => setFlrForm({ ...flrForm, floorCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان طبقه *</label>
                  <input
                    required
                    value={flrForm.floorLabel || ''}
                    onChange={(e) => setFlrForm({ ...flrForm, floorLabel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">طول طبقه (متر) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    required
                    value={flrForm.lengthM ?? 0}
                    onChange={(e) => {
                      const len = Number(e.target.value);
                      const wid = Number(flrForm.widthM || 0);
                      setFlrForm({ ...flrForm, lengthM: len, areaSqm: Number((len * wid).toFixed(2)) });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عرض طبقه (متر) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    required
                    value={flrForm.widthM ?? 0}
                    onChange={(e) => {
                      const wid = Number(e.target.value);
                      const len = Number(flrForm.lengthM || 0);
                      setFlrForm({ ...flrForm, widthM: wid, areaSqm: Number((len * wid).toFixed(2)) });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">مساحت (m²) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    required
                    value={flrForm.areaSqm ?? 0}
                    onChange={(e) => setFlrForm({ ...flrForm, areaSqm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">ارتفاع سقف (m) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min={1.8}
                    required
                    value={flrForm.ceilingHeightM ?? 0}
                    onChange={(e) => setFlrForm({ ...flrForm, ceilingHeightM: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">ارتفاع سقف کاذب (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={flrForm.falseCeilingHeightM ?? 0}
                    onChange={(e) => setFlrForm({ ...flrForm, falseCeilingHeightM: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">عمق تیرهای سقف (m)</label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={flrForm.beamDepthM ?? 0}
                    onChange={(e) => setFlrForm({ ...flrForm, beamDepthM: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              {/* Separated Internal Spaces & Structural Obstacles */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                {/* Spaces */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="font-black text-xs text-slate-800 dark:text-slate-200">فضاهای جداشده داخلی (اتاق سرور، انبار، زون‌ها)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      placeholder="نام فضا (مثلاً اتاق سرور)"
                      value={newSpace.name || ''}
                      onChange={(e) => setNewSpace({ ...newSpace, name: e.target.value })}
                      className="col-span-2 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={addSpaceZone}
                      className="px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      + افزودن
                    </button>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="X (m)"
                      value={newSpace.xM ?? 0}
                      onChange={(e) => setNewSpace({ ...newSpace, xM: Number(e.target.value) })}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Y (m)"
                      value={newSpace.yM ?? 0}
                      onChange={(e) => setNewSpace({ ...newSpace, yM: Number(e.target.value) })}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="طول×عرض"
                      value={newSpace.widthM ?? 6}
                      onChange={(e) => setNewSpace({ ...newSpace, widthM: Number(e.target.value) })}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(newSpace.hasCriticalElectronics)}
                      onChange={(e) => setNewSpace({ ...newSpace, hasCriticalElectronics: e.target.checked })}
                    />
                    <span>شامل تجهیزات الکترونیکی حساس (اولویت گاز پاک / CO2)</span>
                  </label>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {(flrForm.spaces || []).map((sp) => (
                      <div
                        key={sp.id}
                        className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]"
                      >
                        <span className="font-bold">
                          {sp.name} ({sp.widthM}×{sp.heightM}m)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFlrForm({
                              ...flrForm,
                              spaces: (flrForm.spaces || []).filter((s) => s.id !== sp.id),
                            })
                          }
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Obstacles */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="font-black text-xs text-slate-800 dark:text-slate-200">موانع سازه‌ای (دیوار، پارتیشن، شفت، تیر)</div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={newObstacle.type || 'WALL'}
                      onChange={(e) => setNewObstacle({ ...newObstacle, type: e.target.value as any })}
                      className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    >
                      <option value="WALL">دیوار کامل</option>
                      <option value="PARTITION">پارتیشن</option>
                      <option value="SHAFT">شفت / داکت</option>
                      <option value="BEAM">تیر عمیق</option>
                      <option value="COLUMN">ستون</option>
                    </select>
                    <input
                      placeholder="برچسب مانع"
                      value={newObstacle.label || ''}
                      onChange={(e) => setNewObstacle({ ...newObstacle, label: e.target.value })}
                      className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={addObstacle}
                      className="px-2.5 py-1.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      + افزودن
                    </button>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="X (m)"
                      value={newObstacle.xM ?? 0}
                      onChange={(e) => setNewObstacle({ ...newObstacle, xM: Number(e.target.value) })}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Y (m)"
                      value={newObstacle.yM ?? 0}
                      onChange={(e) => setNewObstacle({ ...newObstacle, yM: Number(e.target.value) })}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                    />
                    <div className="flex gap-1">
                      <input
                        type="number"
                        step="0.2"
                        placeholder="عرض"
                        value={newObstacle.widthM ?? 0.4}
                        onChange={(e) => setNewObstacle({ ...newObstacle, widthM: Number(e.target.value) })}
                        className="w-1/2 px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                      />
                      <input
                        type="number"
                        step="0.5"
                        placeholder="طول"
                        value={newObstacle.heightM ?? 8}
                        onChange={(e) => setNewObstacle({ ...newObstacle, heightM: Number(e.target.value) })}
                        className="w-1/2 px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {(flrForm.obstacles || []).map((ob) => (
                      <div
                        key={ob.id}
                        className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]"
                      >
                        <span className="font-bold">
                          {ob.label} ({ob.type}) @ [{ob.xM}, {ob.yM}]
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFlrForm({
                              ...flrForm,
                              obstacles: (flrForm.obstacles || []).filter((o) => o.id !== ob.id),
                            })
                          }
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {activeFloor && !isNewFloorMode && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={onProceedToCalculations}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <span>ادامه و انتخاب سیستم حفاظت در برابر حریق</span>
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
