import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Building2,
  Layers,
  Shield,
  Sliders,
  RefreshCw,
  AlertCircle,
  Search,
  Plus,
  Edit3,
  CheckCircle2,
  ArrowLeft,
  MapPin,
  FileImage,
  BoxSelect,
  Trash2,
  ChevronLeft,
  Home,
  X,
} from 'lucide-react';
import type { FireEquipment } from '../types';
import type {
  ExtinguisherConfigInput,
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignGapAction,
  FireDesignLayout,
  FireDesignSystemRecord,
  FireSystemType,
  PlacedSuppressionItem,
  SprinklerConfigInput,
} from './types';
import { fireDesignApi } from './fireDesignApi';
import {
  ExistingEquipmentSummaryItem,
  OCCUPANCY_LABELS_FA,
  runNfpaFloorCalculation,
} from './nfpaEngine';
import { computeBuildingDesignSummary, renderFireSystemIcon } from './systemMetricsHelper';
import { getSystemPlugin } from './systemsRegistry';
import { SubViewTransition } from '../../../motion';
import FireProtectionDashboard from './FireProtectionDashboard';
import BuildingFloorRegistryPanel from './BuildingFloorRegistryPanel';
import BuildingDesignDashboard from './BuildingDesignDashboard';
import UnifiedSystemWorkspace from './UnifiedSystemWorkspace';
import DeleteBuildingConfirmModal from './DeleteBuildingConfirmModal';

interface Props {
  language: 'fa' | 'en';
  existingEquipment: FireEquipment[];
}

type DesignStep = 'STEP_1' | 'STEP_2' | 'STEP_3' | 'STEP_4';

export default function FireSuppressionDesignModule({ language, existingEquipment }: Props) {
  const isFa = language === 'fa';
  const [viewMode, setViewMode] = useState<'DASHBOARD' | 'DESIGN_WORKSPACE'>('DASHBOARD');
  const [activeStep, setActiveStep] = useState<DesignStep>('STEP_1');
  const [showRegistryDrawer, setShowRegistryDrawer] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [buildingToDelete, setBuildingToDelete] = useState<FireDesignBuilding | null>(null);
  const [newBuildingSeq, setNewBuildingSeq] = useState(0);

  const [buildings, setBuildings] = useState<FireDesignBuilding[]>([]);
  const [floors, setFloors] = useState<FireDesignFloor[]>([]);
  const [layouts, setLayouts] = useState<FireDesignLayout[]>([]);
  const [systems, setSystems] = useState<FireDesignSystemRecord[]>([]);
  const [gapActions, setGapActions] = useState<FireDesignGapAction[]>([]);
  const [companies, setCompanies] = useState<{ id: number; name: string; code: string }[]>([]);
  const [units, setUnits] = useState<{ id: number; name: string; code: string }[]>([]);
  const [serverExistingEq, setServerExistingEq] = useState<ExistingEquipmentSummaryItem[]>([]);
  const [permissions, setPermissions] = useState({ canRead: true, canWrite: true, canApprove: false });

  // Active Project Scope: Building -> Floor -> Optional Space -> Active Fire System
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [activeSystemType, setActiveSystemType] = useState<FireSystemType>('SPRINKLER_NFPA13');

  // Building Directory Filters
  const [buildingSearch, setBuildingSearch] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<string>('ALL');

  // Active Floor Design State
  const [sprinklerConfig, setSprinklerConfig] = useState<SprinklerConfigInput>({});
  const [extinguisherConfig, setExtinguisherConfig] = useState<ExtinguisherConfigInput>({
    preferredCleanAgent: 'CO2',
  });
  const [placedItems, setPlacedItems] = useState<PlacedSuppressionItem[]>([]);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fireDesignApi.bootstrap();
      setBuildings(data.buildings || []);
      setFloors(data.floors || []);
      setLayouts(data.layouts || []);
      setSystems(data.systems || []);
      setGapActions(data.gapActions || []);
      setCompanies(data.companies || []);
      setUnits(data.units || []);
      setServerExistingEq(data.existingEquipment || []);
      setPermissions(data.permissions || { canRead: true, canWrite: true, canApprove: false });

      if (data.buildings?.length) {
        setSelectedBuildingId((prev) =>
          prev && data.buildings.some((b) => b.id === prev) ? prev : data.buildings[0].id
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در دریافت اطلاعات مرکز طراحی حفاظت حریق');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  const buildingFloors = useMemo(
    () => floors.filter((f) => f.buildingId === selectedBuildingId),
    [floors, selectedBuildingId]
  );

  // Sync floor & reset space when building changes
  useEffect(() => {
    setSelectedSpaceId(null);
    if (buildingFloors.length > 0) {
      if (!selectedFloorId || !buildingFloors.some((f) => f.id === selectedFloorId)) {
        setSelectedFloorId(buildingFloors[0].id);
      }
    } else {
      setSelectedFloorId(null);
    }
  }, [buildingFloors, selectedFloorId]);

  const activeBuilding = buildings.find((b) => b.id === selectedBuildingId) || null;
  const activeFloor = buildingFloors.find((f) => f.id === selectedFloorId) || null;
  const selectedSpace = useMemo(
    () => (activeFloor?.spaces || []).find((sp) => sp.id === selectedSpaceId) || null,
    [activeFloor, selectedSpaceId]
  );

  const latestFloorLayout = useMemo(
    () => layouts.find((l) => l.floorId === selectedFloorId) || null,
    [layouts, selectedFloorId]
  );

  useEffect(() => {
    setSelectedSpaceId(null);
  }, [selectedFloorId]);

  // Load saved layout items & configs when floor changes
  useEffect(() => {
    if (latestFloorLayout) {
      setSprinklerConfig(latestFloorLayout.sprinklerConfig || {});
      setExtinguisherConfig(latestFloorLayout.extinguisherConfig || { preferredCleanAgent: 'CO2' });
      setPlacedItems(Array.isArray(latestFloorLayout.placedItems) ? latestFloorLayout.placedItems : []);
    } else {
      setSprinklerConfig({});
      setExtinguisherConfig({ preferredCleanAgent: 'CO2' });
      setPlacedItems([]);
    }
  }, [selectedFloorId, latestFloorLayout]);

  const floorRevisions = useMemo(
    () => layouts.filter((l) => l.floorId === selectedFloorId),
    [layouts, selectedFloorId]
  );

  const combinedExistingEquipment: ExistingEquipmentSummaryItem[] = useMemo(() => {
    if (existingEquipment && existingEquipment.length > 0) {
      return existingEquipment.map((eq: any) => ({
        id: String(eq.id),
        code: eq.code || eq.assetCode || eq.tag || String(eq.id),
        category: eq.category || '',
        location: eq.location || '',
        unit: eq.unit || eq.locationDetails?.unit || '',
        complex: eq.complex || eq.locationDetails?.complex || '',
        floor: eq.floor || eq.locationDetails?.floor || '',
        type: eq.type || eq.category || '',
        weight: eq.weight,
        operationalStatus: eq.operationalStatus || 'فعال',
        nextInspectionDue: eq.nextInspectionDue || null,
        hydrostaticTestDue: eq.hydrostaticTestDue || null,
      }));
    }
    return serverExistingEq;
  }, [existingEquipment, serverExistingEq]);

  // Real-time NFPA 13 / NFPA 10 calculation for active floor
  const calculationResult = useMemo(() => {
    if (!activeBuilding || !activeFloor) return null;
    return runNfpaFloorCalculation({
      building: activeBuilding,
      floor: activeFloor,
      sprinklerConfig,
      extinguisherConfig,
      placedItems,
      existingEquipment: combinedExistingEquipment,
    });
  }, [activeBuilding, activeFloor, sprinklerConfig, extinguisherConfig, placedItems, combinedExistingEquipment]);

  // Populate initial canvas suggestions once per floor if empty
  useEffect(() => {
    if (calculationResult && placedItems.length === 0 && calculationResult.suggestedItems.length > 0) {
      setPlacedItems(calculationResult.suggestedItems);
    }
  }, [calculationResult, placedItems.length]);

  // Per-building summaries for directory + active dashboard + Step 3 cards
  const buildingSummariesMap = useMemo(() => {
    const map = new Map<number, ReturnType<typeof computeBuildingDesignSummary>>();
    for (const b of buildings) {
      map.set(
        b.id,
        computeBuildingDesignSummary({
          building: b,
          floors,
          layouts,
          systems,
          gapActions,
          existingEquipment: combinedExistingEquipment,
          activeFloor: b.id === activeBuilding?.id ? activeFloor : null,
          livePlacedItems: b.id === activeBuilding?.id ? placedItems : undefined,
          liveFloorCalc: b.id === activeBuilding?.id ? calculationResult : undefined,
        })
      );
    }
    return map;
  }, [
    buildings,
    floors,
    layouts,
    systems,
    gapActions,
    combinedExistingEquipment,
    activeBuilding?.id,
    activeFloor,
    placedItems,
    calculationResult,
  ]);

  const activeBuildingSummary = activeBuilding ? buildingSummariesMap.get(activeBuilding.id) || null : null;

  const filteredBuildings = useMemo(() => {
    const q = buildingSearch.trim().toLowerCase();
    return buildings.filter((b) => {
      if (occupancyFilter !== 'ALL' && b.occupancyType !== occupancyFilter) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.unitName.toLowerCase().includes(q)
      );
    });
  }, [buildings, buildingSearch, occupancyFilter]);

  // CRUD & Action Handlers
  const handleSaveBuilding = async (data: Partial<FireDesignBuilding>, id?: number) => {
    if (id) {
      const updated = await fireDesignApi.updateBuilding(id, data);
      setBuildings((prev) => prev.map((b) => (b.id === id ? updated : b)));
      setSelectedBuildingId(updated.id);
    } else {
      const created = await fireDesignApi.createBuilding(data);
      setBuildings((prev) => [created, ...prev]);
      setSelectedBuildingId(created.id);
    }
  };

  const handleDeleteBuilding = async (id: number, confirmDependentSoftDelete: boolean) => {
    await fireDesignApi.deleteBuilding(id, confirmDependentSoftDelete);
    setBuildings((prev) => prev.filter((b) => b.id !== id));
    setFloors((prev) => prev.filter((f) => f.buildingId !== id));
    setLayouts((prev) => prev.filter((l) => l.buildingId !== id));
    setSystems((prev) => prev.filter((s) => s.buildingId !== id));
    setGapActions((prev) => prev.filter((g) => g.buildingId !== id));
    if (selectedBuildingId === id) {
      setSelectedBuildingId(null);
      setSelectedFloorId(null);
      setSelectedSpaceId(null);
      setPlacedItems([]);
      setSprinklerConfig({});
      setExtinguisherConfig({ preferredCleanAgent: 'CO2' });
      setActiveStep('STEP_1');
    }
    void loadBootstrap();
  };

  const handleSaveFloor = async (data: Partial<FireDesignFloor>, id?: number) => {
    if (id) {
      const updated = await fireDesignApi.updateFloor(id, data);
      setFloors((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setSelectedFloorId(updated.id);
    } else {
      const created = await fireDesignApi.createFloor(data);
      setFloors((prev) => [...prev, created]);
      setSelectedFloorId(created.id);
    }
  };

  const handleDeleteFloor = async (id: number) => {
    await fireDesignApi.deleteFloor(id);
    setFloors((prev) => prev.filter((f) => f.id !== id));
    setSelectedFloorId(null);
  };

  const handleSaveLayoutRevision = async (notes?: string) => {
    if (!activeBuilding || !activeFloor) return;
    const saved = await fireDesignApi.saveLayoutRevision({
      buildingId: activeBuilding.id,
      floorId: activeFloor.id,
      sprinklerConfig,
      extinguisherConfig,
      placedItems,
      notes,
    });
    setLayouts((prev) => [saved, ...prev]);
    void loadBootstrap();
  };

  const handleApproveLayout = async (id: number, status: 'REVIEWED' | 'APPROVED', notes?: string) => {
    const approved = await fireDesignApi.approveLayout(id, status, notes);
    setLayouts((prev) => prev.map((l) => (l.id === approved.id ? approved : l)));
    void loadBootstrap();
  };

  const handleSaveSystem = async (payload: {
    buildingId: number;
    floorId?: number | null;
    systemType: FireSystemType;
    standardEdition: string;
    localCodeNotes?: string;
    designInputs: Record<string, any>;
  }) => {
    const saved = await fireDesignApi.saveSystemDesign(payload);
    setSystems((prev) => [saved, ...prev]);
  };

  const handleApproveSystem = async (
    id: number,
    status: 'REVIEWED' | 'APPROVED' = 'APPROVED',
    notes?: string
  ) => {
    const updated = await fireDesignApi.approveSystemDesign(id, status, notes);
    setSystems((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleDeleteSystem = async (id: number) => {
    await fireDesignApi.deleteSystemDesign(id);
    setSystems((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCreateGapAction = async (payload: Partial<FireDesignGapAction>) => {
    const created = await fireDesignApi.createGapAction(payload);
    setGapActions((prev) => [created, ...prev]);
  };

  const handleUpdateGapAction = async (id: number, payload: Partial<FireDesignGapAction>) => {
    const updated = await fireDesignApi.updateGapAction(id, payload);
    setGapActions((prev) => prev.map((g) => (g.id === id ? updated : g)));
  };

  const handleDeleteGapAction = async (id: number) => {
    await fireDesignApi.deleteGapAction(id);
    setGapActions((prev) => prev.filter((g) => g.id !== id));
  };

  const handleInjectSuggestedItemsToCanvas = (
    systemType: FireSystemType,
    newItems: PlacedSuppressionItem[]
  ) => {
    setPlacedItems((prev) => {
      const kept = prev.filter((it) => it.systemType !== systemType);
      return [...kept, ...newItems];
    });
  };

  const enterBuildingProject = (buildingId: number) => {
    setSelectedBuildingId(buildingId);
    setViewMode('DESIGN_WORKSPACE');
    setShowRegistryDrawer(false);
    setActiveStep('STEP_2');
  };

  const enterSystemWorkspace = (sysType: FireSystemType) => {
    setActiveSystemType(sysType);
    setViewMode('DESIGN_WORKSPACE');
    setActiveStep('STEP_4');
  };

  const stepperItems: { id: DesignStep; num: string; titleFa: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { id: 'STEP_1', num: 'گام ۱', titleFa: 'انتخاب و مدیریت ساختمان', icon: <Building2 className="w-4 h-4" /> },
    {
      id: 'STEP_2',
      num: 'گام ۲',
      titleFa: 'انتخاب طبقه و فضای کاری',
      icon: <Layers className="w-4 h-4" />,
      disabled: !activeBuilding,
    },
    {
      id: 'STEP_3',
      num: 'گام ۳',
      titleFa: 'انتخاب سیستم حفاظتی (۸ سیستم)',
      icon: <Shield className="w-4 h-4" />,
      disabled: !activeBuilding || !activeFloor,
    },
    {
      id: 'STEP_4',
      num: 'گام ۴',
      titleFa: 'محیط طراحی مشترک ۵‌ناحیه‌ای',
      icon: <Sliders className="w-4 h-4" />,
      disabled: !activeBuilding || !activeFloor || !calculationResult,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 overflow-y-auto h-full bg-slate-50 dark:bg-slate-900" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Unified Design Center Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-base md:text-lg font-black text-slate-900 dark:text-white">
            مرکز طراحی و مهندسی سیستم‌های حفاظت در برابر حریق
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            فرآیند یکپارچه: انتخاب ساختمان ← طبقه و فضا ← انتخاب سیستم حفاظتی ← ورود اطلاعات ← محاسبات ← جانمایی ۲بعدی ← ارزیابی ← گزارش نهایی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {viewMode === 'DASHBOARD' ? (
            <button
              type="button"
              onClick={() => setViewMode('DESIGN_WORKSPACE')}
              className="px-4 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer bg-red-600 hover:bg-red-700 text-white transition-colors shadow-xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>ورود به محیط طراحی و جانمایی</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode('DASHBOARD')}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-red-600" />
              <span>بازگشت به داشبورد</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void loadBootstrap()}
            className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-xl cursor-pointer"
            title="بروزرسانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Breadcrumb Strip */}
      <nav
        aria-label="مسیر پیمایش طراحی حفاظت حریق"
        className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px]"
      >
        <button
          type="button"
          onClick={() => setViewMode('DASHBOARD')}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
            viewMode === 'DASHBOARD'
              ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>داشبورد مدیریت طراحی حریق</span>
        </button>

        {viewMode === 'DESIGN_WORKSPACE' && (
          <>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <button
              type="button"
              onClick={() => setActiveStep('STEP_1')}
              className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                activeStep === 'STEP_1'
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              محیط طراحی و جانمایی
            </button>

            {activeBuilding && activeStep !== 'STEP_1' && (
              <>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setActiveStep('STEP_2')}
                  className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    activeStep === 'STEP_2'
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {activeBuilding.name}
                </button>
              </>
            )}

            {activeFloor && (activeStep === 'STEP_3' || activeStep === 'STEP_4') && (
              <>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setActiveStep('STEP_3')}
                  className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    activeStep === 'STEP_3'
                      ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {activeFloor.floorLabel}
                </button>
              </>
            )}

            {activeStep === 'STEP_4' && (
              <>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                <span className="px-2 py-1 rounded-lg font-black bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">
                  {getSystemPlugin(activeSystemType)?.titleFa || activeSystemType}
                </span>
              </>
            )}
          </>
        )}
      </nav>

      {/* Unified Stepper Navigation */}
      {viewMode === 'DESIGN_WORKSPACE' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
          {stepperItems.map((st) => {
            const isActive = activeStep === st.id;
            return (
              <button
                key={st.id}
                type="button"
                disabled={st.disabled}
                onClick={() => setActiveStep(st.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {st.icon}
                <div className="text-right min-w-0">
                  <div className={`text-[10px] ${isActive ? 'text-red-100' : 'text-slate-400'}`}>{st.num}</div>
                  <div className="truncate">{st.titleFa}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pinned Selected Building & Floor/Space Context Strip */}
      {viewMode === 'DESIGN_WORKSPACE' && activeBuilding && activeBuildingSummary && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="text-slate-400">ساختمان فعال: </span>
              <span className="font-black text-slate-900 dark:text-white">{activeBuilding.name}</span>
              <span className="font-mono text-slate-500 mr-1.5">({activeBuilding.code})</span>
            </div>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <div>
              <span className="text-slate-400">کاربری: </span>
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {OCCUPANCY_LABELS_FA[activeBuilding.occupancyType] || activeBuilding.occupancyType}
              </span>
            </div>
            {activeFloor && (
              <>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <div>
                  <span className="text-slate-400">محدوده فعال: </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {activeFloor.floorLabel}
                    {selectedSpace ? ` · ${selectedSpace.name} (${selectedSpace.areaSqm} m²)` : ` (${activeFloor.areaSqm} m²)`}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <div>
              <span className="text-slate-400">پیشرفت طراحی: </span>
              <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                {activeBuildingSummary.designProgressPercent}٪ ({activeBuildingSummary.designedCount}/8)
              </span>
            </div>
            <div>
              <span className="text-slate-400">انطباق استاندارد: </span>
              <span
                className={`font-mono font-black ${
                  activeBuildingSummary.standardCompliancePercent >= 85
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }`}
              >
                {activeBuildingSummary.standardCompliancePercent}٪
              </span>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Content Stage with Smooth HSECORE Transition */}
      <SubViewTransition viewKey={viewMode === 'DASHBOARD' ? 'DASHBOARD' : activeStep} isFa={isFa}>
        {/* ================================================================= */}
        {/* DEFAULT LANDING DASHBOARD (Management, KPIs, Projects & Alerts)   */}
        {/* ================================================================= */}
        {viewMode === 'DASHBOARD' ? (
          <FireProtectionDashboard
            isFa={isFa}
            canWrite={permissions.canWrite}
            canApprove={permissions.canApprove}
            buildings={buildings}
            floors={floors}
            layouts={layouts}
            systems={systems}
            gapActions={gapActions}
            existingEquipment={combinedExistingEquipment}
            activeBuildingId={selectedBuildingId}
            onEnterDesignWorkspace={() => setViewMode('DESIGN_WORKSPACE')}
            onStartNewBuilding={() => {
              setViewMode('DESIGN_WORKSPACE');
              setActiveStep('STEP_1');
              setShowRegistryDrawer(true);
              setNewBuildingSeq((n) => n + 1);
            }}
            onRequestDeleteBuilding={(b) => setBuildingToDelete(b)}
            onOpenBuildingDesign={(bId, fId, targetTab, sysType) => {
              if (bId) setSelectedBuildingId(bId);
              if (fId) setSelectedFloorId(fId);
              if (sysType) setActiveSystemType(sysType);
              setViewMode('DESIGN_WORKSPACE');
              if (targetTab === 'REGISTRY') {
                setShowRegistryDrawer(true);
                setActiveStep('STEP_1');
              } else if (targetTab === 'CANVAS_2D') {
                setShowRegistryDrawer(false);
                setActiveStep('STEP_4');
              } else if (targetTab === 'STEP_2') {
                setShowRegistryDrawer(false);
                setActiveStep('STEP_2');
              } else {
                setShowRegistryDrawer(false);
                setActiveStep('STEP_3');
              }
            }}
          />
        ) : activeStep === 'STEP_1' ? (
          /* ================================================================= */
          /* STEP 1: Building Registry, Project Selection & Status Dashboard   */
          /* ================================================================= */
          <div className="space-y-5">
            {/* Search & Create Toolbar */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={buildingSearch}
                    onChange={(e) => setBuildingSearch(e.target.value)}
                    placeholder="جستجوی ساختمان با نام، کد یا واحد..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                </div>
                <select
                  value={occupancyFilter}
                  onChange={(e) => setOccupancyFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                >
                  <option value="ALL">همه کاربری‌ها</option>
                  {Object.entries(OCCUPANCY_LABELS_FA).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              {permissions.canWrite && (
                <button
                  type="button"
                  onClick={() => setShowRegistryDrawer((v) => !v)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    showRegistryDrawer
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  }`}
                >
                  {showRegistryDrawer ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  <span>{showRegistryDrawer ? 'بستن فرم مدیریت ساختمان/طبقات' : 'ثبت ساختمان جدید / ویرایش مشخصات'}</span>
                </button>
              )}
            </div>

            {/* Expandable Authoritative Building & Floor Form Panel */}
            {showRegistryDrawer && (
              <BuildingFloorRegistryPanel
                isFa={isFa}
                canWrite={permissions.canWrite}
                canApprove={permissions.canApprove}
                buildings={buildings}
                floors={floors}
                companies={companies}
                units={units}
                selectedBuildingId={selectedBuildingId}
                selectedFloorId={selectedFloorId}
                onSelectBuilding={setSelectedBuildingId}
                onSelectFloor={setSelectedFloorId}
                onSaveBuilding={handleSaveBuilding}
                onRequestDeleteBuilding={(b) => setBuildingToDelete(b)}
                onSaveFloor={handleSaveFloor}
                onDeleteFloor={handleDeleteFloor}
                onProceedToCalculations={() => {
                  setShowRegistryDrawer(false);
                  setActiveStep('STEP_2');
                }}
                openNewBuildingSeq={newBuildingSeq}
              />
            )}

            {/* Visual Building Project Cards */}
            {filteredBuildings.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center space-y-3">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  ساختمانی مطابق جستجوی فعلی یافت نشد.
                </p>
                {permissions.canWrite && !showRegistryDrawer && (
                  <button
                    type="button"
                    onClick={() => setShowRegistryDrawer(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    ایجاد اولین پروژه ساختمان حفاظت حریق
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredBuildings.map((b) => {
                  const sum = buildingSummariesMap.get(b.id);
                  const isSelected = b.id === selectedBuildingId;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBuildingId(b.id)}
                      className={`p-5 rounded-2xl border bg-white dark:bg-slate-800 transition-colors cursor-pointer flex flex-col justify-between gap-4 ${
                        isSelected
                          ? 'border-red-600 ring-1 ring-red-600/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-red-400'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">{b.name}</h3>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              {b.code} · {b.unitName}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            {b.status === 'APPROVED' ? 'تأییدشده' : b.status === 'DESIGNED' ? 'طراحی‌شده' : 'پیش‌نویس'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px]">
                          <div>
                            <div className="text-slate-400">کاربری</div>
                            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {OCCUPANCY_LABELS_FA[b.occupancyType] || b.occupancyType}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">طبقات / زیربنا</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                              {sum?.floorsCount ?? 0} · {(sum?.totalAreaSqm ?? 0).toLocaleString()} m²
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">طراحی / انطباق</div>
                            <div className="font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                              {sum?.designProgressPercent ?? 0}٪ / {sum?.standardCompliancePercent ?? 0}٪
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBuildingId(b.id);
                              setShowRegistryDrawer(true);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>ویرایش</span>
                          </button>
                          {permissions.canApprove && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBuildingToDelete(b);
                              }}
                              title="حذف ساختمان"
                              aria-label={`حذف ساختمان ${b.name}`}
                              className="px-2 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            enterBuildingProject(b.id);
                          }}
                          className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>ورود به پروژه حفاظت حریق</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dedicated Per-Building Design Status Dashboard */}
            {activeBuildingSummary && (
              <BuildingDesignDashboard
                summary={activeBuildingSummary}
                onGoToStepTwo={() => setActiveStep('STEP_2')}
                onSelectSystemForDesign={(sysType) => {
                  if (buildingFloors.length > 0) {
                    enterSystemWorkspace(sysType);
                  } else {
                    setShowRegistryDrawer(true);
                  }
                }}
              />
            )}
          </div>
        ) : activeStep === 'STEP_2' && activeBuilding ? (
          /* ================================================================= */
          /* STEP 2: Visual Floor & Internal Space Selector                    */
          /* ================================================================= */
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">
                    گام ۲: انتخاب طبقه و فضای موردنظر — {activeBuilding.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    طبقه هدف را انتخاب کنید، مشخص کنید طراحی برای کل طبقه یا یک فضای داخلی مشخص انجام می‌شود و سوابق قبلی یا نقشه آن را مشاهده کنید.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {permissions.canWrite && (
                    <button
                      type="button"
                      onClick={() => setShowRegistryDrawer((v) => !v)}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showRegistryDrawer ? 'بستن ویرایشگر طبقه/فضاها' : 'مدیریت / افزودن طبقه، فضا و نقشه'}</span>
                    </button>
                  )}
                  {activeFloor && (
                    <button
                      type="button"
                      onClick={() => setActiveStep('STEP_3')}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>انتخاب سیستم حفاظتی (۸ سیستم)</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {showRegistryDrawer && (
                <BuildingFloorRegistryPanel
                  isFa={isFa}
                  canWrite={permissions.canWrite}
                  canApprove={permissions.canApprove}
                  buildings={buildings}
                  floors={floors}
                  companies={companies}
                  units={units}
                  selectedBuildingId={selectedBuildingId}
                  selectedFloorId={selectedFloorId}
                  onSelectBuilding={setSelectedBuildingId}
                  onSelectFloor={setSelectedFloorId}
                  onSaveBuilding={handleSaveBuilding}
                  onRequestDeleteBuilding={(b) => setBuildingToDelete(b)}
                  onSaveFloor={handleSaveFloor}
                  onDeleteFloor={handleDeleteFloor}
                  onProceedToCalculations={() => {
                    setShowRegistryDrawer(false);
                    setActiveStep('STEP_3');
                  }}
                />
              )}

              {buildingFloors.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    هنوز هیچ طبقه‌ای برای ساختمان «{activeBuilding.name}» ثبت نشده است.
                  </p>
                  {permissions.canWrite && (
                    <button
                      type="button"
                      onClick={() => setShowRegistryDrawer(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      ثبت اولین طبقه ساختمان
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {buildingFloors.map((fl) => {
                    const isSel = fl.id === selectedFloorId;
                    const revs = layouts.filter((l) => l.floorId === fl.id);
                    const flSystems = systems.filter((s) => s.buildingId === activeBuilding.id && s.floorId === fl.id && s.isActive);
                    return (
                      <div
                        key={fl.id}
                        onClick={() => setSelectedFloorId(fl.id)}
                        className={`p-4 rounded-2xl border transition-colors cursor-pointer space-y-3 ${
                          isSel
                            ? 'bg-red-50/40 dark:bg-red-950/20 border-red-600 ring-1 ring-red-600/30'
                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-red-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white">{fl.floorLabel}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              کد {fl.floorCode} · {fl.isBasement ? 'زیرزمین' : 'طبقه'}
                            </div>
                          </div>
                          {isSel && (
                            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>انتخاب‌شده</span>
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-200/70 dark:border-slate-700/70 tabular-nums">
                          <div>
                            <div className="text-slate-400">مساحت</div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white">{fl.areaSqm} m²</div>
                          </div>
                          <div>
                            <div className="text-slate-400">ابعاد (L×W)</div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white">
                              {fl.lengthM}×{fl.widthM}m
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400">ارتفاع سقف</div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white">{fl.ceilingHeightM}m</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                          <span className="flex items-center gap-1">
                            <FileImage className="w-3.5 h-3.5 text-slate-400" />
                            <span>{fl.floorPlanFileId ? 'نقشه آپلود شده' : 'بوم مهندسی استاندارد'}</span>
                          </span>
                          <span className="font-mono">
                            {revs.length} نسخه نقشه · {flSystems.length} سیستم
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Internal Space Scope Picker for Selected Floor */}
              {activeFloor && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                    <BoxSelect className="w-4 h-4 text-blue-600" />
                    <span>محدوده طراحی در طبقه «{activeFloor.floorLabel}»:</span>
                  </div>

                  <div className="flex flex-wrap gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedSpaceId(null)}
                      className={`px-4 py-2.5 rounded-xl border font-bold cursor-pointer ${
                        selectedSpaceId === null
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      کل طبقه ({activeFloor.areaSqm} m²)
                    </button>

                    {(activeFloor.spaces || []).map((sp) => {
                      const isSelSpace = sp.id === selectedSpaceId;
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => setSelectedSpaceId(sp.id)}
                          className={`px-4 py-2.5 rounded-xl border font-bold cursor-pointer flex items-center gap-2 ${
                            isSelSpace
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span>
                            {sp.name} ({sp.areaSqm} m²)
                          </span>
                          {sp.hasCriticalElectronics && (
                            <span className="text-[10px] font-normal opacity-80">· الکترونیکی حساس</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeStep === 'STEP_3' && activeBuilding && activeFloor && activeBuildingSummary ? (
          /* ================================================================= */
          /* STEP 3: Unified 8 Fire Protection System Selection Cards          */
          /* ================================================================= */
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  گام ۳: انتخاب سیستم حفاظت در برابر حریق — {activeBuilding.name} ({activeFloor.floorLabel})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تمام ۸ سیستم حفاظت حریق بدون ترک محیط فعلی و از طریق یک فضای طراحی مشترک ۵‌ناحیه‌ای طراحی و پایش می‌شوند.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs tabular-nums">
                <span className="text-slate-600 dark:text-slate-300">
                  طراحی‌شده: <strong className="font-mono text-emerald-600">{activeBuildingSummary.designedCount}/8</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 dark:text-slate-300">
                  در دست انجام: <strong className="font-mono text-blue-600">{activeBuildingSummary.inProgressCount}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-600 dark:text-slate-300">
                  طراحی‌نشده: <strong className="font-mono text-slate-500">{activeBuildingSummary.undesignedCount}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {activeBuildingSummary.perSystem.map((item) => {
                const { descriptor } = item;
                const designLabel =
                  item.designState === 'DESIGNED'
                    ? 'طراحی شده'
                    : item.designState === 'IN_PROGRESS'
                      ? 'در حال طراحی'
                      : 'طراحی نشده';
                const complianceLabel =
                  item.complianceState === 'COMPLIANT'
                    ? 'منطبق'
                    : item.complianceState === 'NON_COMPLIANT'
                      ? 'عدم انطباق'
                      : item.complianceState === 'NEEDS_REVIEW'
                        ? 'نیازمند بررسی'
                        : 'تکمیل نشده';

                const complianceColor =
                  item.complianceState === 'COMPLIANT'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : item.complianceState === 'NON_COMPLIANT'
                      ? 'text-rose-600 dark:text-rose-400'
                      : item.complianceState === 'NEEDS_REVIEW'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400';

                return (
                  <div
                    key={descriptor.type}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                          {renderFireSystemIcon(descriptor.iconKey, 'w-5 h-5')}
                        </div>
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {descriptor.standardCode}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">{descriptor.titleFa}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                          {descriptor.descriptionFa}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px]">
                        <div>
                          <div className="text-slate-400">وضعیت طراحی</div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{designLabel}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">تجهیزات ثبت‌شده</div>
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {item.registeredEquipmentCount}
                            {item.requiredEquipmentCount !== null ? ` / ${item.requiredEquipmentCount}` : ''}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400">انطباق</div>
                          <div className={`font-bold ${complianceColor}`}>{complianceLabel}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => enterSystemWorkspace(descriptor.type)}
                      className="w-full py-2.5 bg-slate-900 dark:bg-slate-700 hover:bg-red-600 dark:hover:bg-red-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>ورود به محیط طراحی</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeStep === 'STEP_4' &&
          activeBuilding &&
          activeFloor &&
          calculationResult &&
          activeBuildingSummary ? (
          /* ================================================================= */
          /* STEP 4: Shared 5-Zone Engineering Design Workspace                */
          /* ================================================================= */
          <UnifiedSystemWorkspace
            isFa={isFa}
            canWrite={permissions.canWrite}
            canApprove={permissions.canApprove}
            building={activeBuilding}
            floors={buildingFloors}
            activeFloor={activeFloor}
            selectedSpace={selectedSpace}
            onSelectFloor={setSelectedFloorId}
            onSelectSpaceId={setSelectedSpaceId}
            activeSystemType={activeSystemType}
            onSelectSystemType={setActiveSystemType}
            summary={activeBuildingSummary}
            calc={calculationResult}
            sprinklerConfig={sprinklerConfig}
            extinguisherConfig={extinguisherConfig}
            onChangeSprinklerConfig={setSprinklerConfig}
            onChangeExtinguisherConfig={setExtinguisherConfig}
            placedItems={placedItems}
            onChangePlacedItems={setPlacedItems}
            floorRevisions={floorRevisions}
            latestFloorLayout={latestFloorLayout}
            onLoadRevision={(rev) => {
              setSprinklerConfig(rev.sprinklerConfig || {});
              setExtinguisherConfig(rev.extinguisherConfig || { preferredCleanAgent: 'CO2' });
              setPlacedItems(Array.isArray(rev.placedItems) ? rev.placedItems : []);
            }}
            onFloorPlanUploaded={async (patch) => {
              await handleSaveFloor(patch, activeFloor.id);
            }}
            onSaveLayoutRevision={handleSaveLayoutRevision}
            onApproveLayout={handleApproveLayout}
            savedSystems={systems}
            onSaveSystem={handleSaveSystem}
            onApproveSystem={handleApproveSystem}
            onDeleteSystem={handleDeleteSystem}
            onInjectSuggestedItemsToCanvas={handleInjectSuggestedItemsToCanvas}
            gapActions={gapActions}
            onCreateGapAction={handleCreateGapAction}
            onUpdateGapAction={handleUpdateGapAction}
            onDeleteGapAction={handleDeleteGapAction}
            onEditBuildingOrFloor={() => {
              setShowRegistryDrawer(true);
              setActiveStep('STEP_1');
            }}
          />
        ) : null}
      </SubViewTransition>

      {/* Safe Building Deletion Confirmation Modal */}
      <DeleteBuildingConfirmModal
        isFa={isFa}
        building={buildingToDelete}
        onClose={() => setBuildingToDelete(null)}
        onConfirmDelete={handleDeleteBuilding}
      />
    </div>
  );
}
