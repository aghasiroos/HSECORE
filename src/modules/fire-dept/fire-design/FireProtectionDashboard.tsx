import React, { useMemo, useState } from 'react';
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  Droplets,
  CalendarClock,
  ArrowUpLeft,
  Filter,
  ClipboardList,
  Plus,
  Trash2,
  Layers,
  Clock,
  FolderKanban,
  CheckCircle2,
  FileWarning,
  Sliders,
} from 'lucide-react';
import type {
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignGapAction,
  FireDesignLayout,
  FireDesignSystemRecord,
  FireSystemType,
} from './types';
import {
  ENGINEERING_DISCLAIMER_FA,
  ExistingEquipmentSummaryItem,
  OCCUPANCY_LABELS_FA,
  runNfpaFloorCalculation,
} from './nfpaEngine';
import { FIRE_SYSTEM_PLUGINS, getSystemPlugin } from './systemsRegistry';

interface Props {
  isFa: boolean;
  canWrite?: boolean;
  canApprove?: boolean;
  buildings: FireDesignBuilding[];
  floors: FireDesignFloor[];
  layouts: FireDesignLayout[];
  systems: FireDesignSystemRecord[];
  gapActions: FireDesignGapAction[];
  existingEquipment: ExistingEquipmentSummaryItem[];
  activeBuildingId?: number | null;
  onEnterDesignWorkspace: () => void;
  onStartNewBuilding?: () => void;
  onRequestDeleteBuilding?: (building: FireDesignBuilding) => void;
  onOpenBuildingDesign: (
    buildingId: number,
    floorId?: number | null,
    targetTab?: string,
    systemType?: FireSystemType
  ) => void;
}

export default function FireProtectionDashboard({
  isFa,
  canWrite = false,
  canApprove = false,
  buildings,
  floors,
  layouts,
  systems,
  gapActions,
  existingEquipment,
  activeBuildingId,
  onEnterDesignWorkspace,
  onStartNewBuilding,
  onRequestDeleteBuilding,
  onOpenBuildingDesign,
}: Props) {
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [systemFilter, setSystemFilter] = useState<string>('ALL');
  const [complianceFilter, setComplianceFilter] = useState<
    'ALL' | 'COMPLIANT' | 'NEEDS_ATTENTION' | 'INCOMPLETE'
  >('ALL');

  const uniqueUnits = useMemo(() => {
    const s = new Set<string>();
    buildings.forEach((b) => {
      if (b.unitName) s.add(b.unitName);
    });
    return Array.from(s);
  }, [buildings]);

  const buildingsById = useMemo(() => {
    const map = new Map<number, FireDesignBuilding>();
    buildings.forEach((b) => map.set(b.id, b));
    return map;
  }, [buildings]);

  const floorsById = useMemo(() => {
    const map = new Map<number, FireDesignFloor>();
    floors.forEach((f) => map.set(f.id, f));
    return map;
  }, [floors]);

  // Evaluate each building across its floors + latest layout + saved systems
  const buildingRows = useMemo(() => {
    return buildings.map((b) => {
      const bFloors = floors.filter((f) => f.buildingId === b.id);
      const bLayouts = layouts.filter((l) => l.buildingId === b.id);
      const bSystems = systems.filter((s) => s.buildingId === b.id && s.isActive);
      const bGaps = gapActions.filter((g) => g.buildingId === b.id);
      const openGaps = bGaps.filter((g) => g.status === 'OPEN' || g.status === 'IN_PROGRESS').length;

      let requiredEquipTotal = 0;
      let existingEquipTotal = 0;
      let blindSpotTotal = 0;
      let complianceSum = 0;
      let evaluatedFloors = 0;
      let waterStatus: 'ADEQUATE' | 'INADEQUATE' | 'NEEDS_WATER_DATA' = 'NEEDS_WATER_DATA';
      let hasIncompleteFloor = false;

      for (const fl of bFloors) {
        const latestLayout = bLayouts.find((l) => l.floorId === fl.id);
        const calc = runNfpaFloorCalculation({
          building: b,
          floor: fl,
          sprinklerConfig: latestLayout?.sprinklerConfig,
          extinguisherConfig: latestLayout?.extinguisherConfig,
          placedItems: latestLayout?.placedItems,
          existingEquipment,
        });

        if (calc.calculationStatus === 'INCOMPLETE_DATA') {
          hasIncompleteFloor = true;
        } else {
          evaluatedFloors++;
          complianceSum += calc.overallCompliancePercent ?? 0;
        }

        requiredEquipTotal += calc.comparisonRows.reduce((s, r) => s + r.requiredCount, 0);
        existingEquipTotal += calc.comparisonRows.reduce((s, r) => s + r.existingCount, 0);
        blindSpotTotal += calc.uncoveredZones.length;

        if (calc.sprinkler.hydraulics.waterSupplyStatus === 'INADEQUATE') {
          waterStatus = 'INADEQUATE';
        } else if (calc.sprinkler.hydraulics.waterSupplyStatus === 'ADEQUATE' && waterStatus !== 'INADEQUATE') {
          waterStatus = 'ADEQUATE';
        }
      }

      const avgCompliance = evaluatedFloors > 0 ? Math.round(complianceSum / evaluatedFloors) : 0;

      const activeSystemLabels = new Set<string>();
      if (bFloors.length > 0 && bLayouts.length > 0) {
        activeSystemLabels.add('NFPA 13 / 10');
      }
      bSystems.forEach((s) => activeSystemLabels.add(s.standardCode));

      const statusCategory: 'COMPLIANT' | 'NEEDS_ATTENTION' | 'INCOMPLETE' =
        bFloors.length === 0 || hasIncompleteFloor
          ? 'INCOMPLETE'
          : avgCompliance >= 85 && openGaps === 0 && waterStatus !== 'INADEQUATE'
            ? 'COMPLIANT'
            : 'NEEDS_ATTENTION';

      return {
        building: b,
        floorsCount: bFloors.length,
        layoutsCount: bLayouts.length,
        systemsCount: bSystems.length,
        firstFloorId: bFloors[0]?.id ?? null,
        activeSystems: Array.from(activeSystemLabels),
        systemTypes: new Set([
          ...(bLayouts.length > 0 ? ['SPRINKLER_NFPA13', 'EXTINGUISHER_NFPA10'] : []),
          ...bSystems.map((s) => s.systemType),
        ]),
        requiredEquipTotal,
        existingEquipTotal,
        blindSpotTotal,
        avgCompliance,
        openGaps,
        totalGaps: bGaps.length,
        waterStatus,
        statusCategory,
        hasIncompleteAssessment: bFloors.length === 0 || hasIncompleteFloor || bLayouts.length === 0,
      };
    });
  }, [buildings, floors, layouts, systems, gapActions, existingEquipment]);

  const filteredRows = useMemo(() => {
    return buildingRows.filter((row) => {
      if (unitFilter !== 'ALL' && row.building.unitName !== unitFilter) return false;
      if (buildingFilter !== 'ALL' && String(row.building.id) !== buildingFilter) return false;
      if (systemFilter !== 'ALL' && !row.systemTypes.has(systemFilter)) return false;
      if (complianceFilter !== 'ALL' && row.statusCategory !== complianceFilter) return false;
      return true;
    });
  }, [buildingRows, unitFilter, buildingFilter, systemFilter, complianceFilter]);

  const filteredBuildingIds = useMemo(
    () => new Set(filteredRows.map((r) => r.building.id)),
    [filteredRows]
  );

  // Build real design projects list from latest floor layouts + latest system designs + unstarted buildings
  const designProjects = useMemo(() => {
    type ProjectRow = {
      key: string;
      buildingId: number;
      buildingName: string;
      buildingCode: string;
      floorId: number | null;
      floorLabel: string;
      systemType: FireSystemType;
      titleFa: string;
      standardCode: string;
      stage: 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_REVIEW';
      stageLabelFa: string;
      revisionOrVersion: string;
      updatedAt: string;
    };

    const items: ProjectRow[] = [];

    // 1. Latest layout per (buildingId, floorId)
    const latestLayoutByFloor = new Map<string, FireDesignLayout>();
    for (const lay of layouts) {
      if (!filteredBuildingIds.has(lay.buildingId)) continue;
      const key = `${lay.buildingId}-${lay.floorId}`;
      const prev = latestLayoutByFloor.get(key);
      if (!prev || lay.revision > prev.revision) {
        latestLayoutByFloor.set(key, lay);
      }
    }

    latestLayoutByFloor.forEach((lay) => {
      const bld = buildingsById.get(lay.buildingId);
      const flr = floorsById.get(lay.floorId);
      if (!bld) return;
      const calcStatus = (lay.calculationSnapshot as any)?.calculationStatus;
      let stage: ProjectRow['stage'] = 'IN_PROGRESS';
      let stageLabelFa = 'در حال اجرا';
      if (lay.status === 'APPROVED') {
        stage = 'COMPLETED';
        stageLabelFa = 'تکمیل و تأییدشده';
      } else if (lay.status === 'REVIEWED' || calcStatus === 'NON_COMPLIANT') {
        stage = 'NEEDS_REVIEW';
        stageLabelFa = lay.status === 'REVIEWED' ? 'بازبینی‌شده / نیازمند تأیید' : 'نیازمند بازبینی (عدم انطباق)';
      }

      items.push({
        key: `lay-${lay.id}`,
        buildingId: bld.id,
        buildingName: bld.name,
        buildingCode: bld.code,
        floorId: lay.floorId,
        floorLabel: flr?.floorLabel || `طبقه #${lay.floorId}`,
        systemType: 'SPRINKLER_NFPA13',
        titleFa: 'طراحی و جانمایی اسپرینکلر و خاموش‌کننده‌ها',
        standardCode: 'NFPA 13 / 10',
        stage,
        stageLabelFa,
        revisionOrVersion: `نسخه ${lay.revision}`,
        updatedAt: lay.updatedAt || lay.createdAt || '',
      });
    });

    // 2. Latest active system design per (buildingId, systemType)
    const latestSystemByType = new Map<string, FireDesignSystemRecord>();
    for (const sys of systems) {
      if (!sys.isActive || !filteredBuildingIds.has(sys.buildingId)) continue;
      const key = `${sys.buildingId}-${sys.systemType}`;
      const prev = latestSystemByType.get(key);
      if (!prev || sys.version > prev.version) {
        latestSystemByType.set(key, sys);
      }
    }

    latestSystemByType.forEach((sys) => {
      const bld = buildingsById.get(sys.buildingId);
      const flr = sys.floorId ? floorsById.get(sys.floorId) : null;
      if (!bld) return;
      const plugin = getSystemPlugin(sys.systemType);
      let stage: ProjectRow['stage'] = 'IN_PROGRESS';
      let stageLabelFa = 'در حال اجرا';
      if (sys.designStage === 'APPROVED_ENGINEERING') {
        stage = 'COMPLETED';
        stageLabelFa = 'تکمیل و تأییدشده';
      } else if (
        sys.designStage === 'REVIEWED' ||
        sys.complianceStatus === 'NEEDS_REVIEW' ||
        sys.complianceStatus === 'NON_COMPLIANT'
      ) {
        stage = 'NEEDS_REVIEW';
        stageLabelFa = 'نیازمند بازبینی';
      }

      items.push({
        key: `sys-${sys.id}`,
        buildingId: bld.id,
        buildingName: bld.name,
        buildingCode: bld.code,
        floorId: sys.floorId ?? null,
        floorLabel: flr?.floorLabel || 'کل ساختمان',
        systemType: sys.systemType,
        titleFa: plugin?.titleFa || sys.systemType,
        standardCode: sys.standardCode,
        stage,
        stageLabelFa,
        revisionOrVersion: `V${sys.version}`,
        updatedAt: sys.updatedAt || sys.createdAt || '',
      });
    });

    // 3. Registered buildings with zero layouts & zero systems count as initial in-progress project
    for (const row of filteredRows) {
      if (row.layoutsCount === 0 && row.systemsCount === 0) {
        items.push({
          key: `bld-init-${row.building.id}`,
          buildingId: row.building.id,
          buildingName: row.building.name,
          buildingCode: row.building.code,
          floorId: row.firstFloorId,
          floorLabel: row.floorsCount > 0 ? 'طبقه ثبت‌شده' : 'فاقد طبقه',
          systemType: 'SPRINKLER_NFPA13',
          titleFa: 'پرونده طراحی جدید (نیازمند تکمیل پلان/محاسبات)',
          standardCode: 'NFPA',
          stage: 'IN_PROGRESS',
          stageLabelFa: 'در حال اجرا (آغاز طراحی)',
          revisionOrVersion: row.floorsCount > 0 ? `${row.floorsCount} طبقه` : 'ثبت اولیه',
          updatedAt: row.building.updatedAt || row.building.createdAt || '',
        });
      }
    }

    return items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [layouts, systems, filteredBuildingIds, buildingsById, floorsById, filteredRows]);

  // All 8 mandatory KPIs + hydraulic / equipment metrics strictly computed from real DB rows
  const kpis = useMemo(() => {
    const totalBuildings = filteredRows.length;
    const totalDesignProjects = designProjects.length;
    const inProgressProjects = designProjects.filter((p) => p.stage === 'IN_PROGRESS').length;
    const completedProjects = designProjects.filter((p) => p.stage === 'COMPLETED').length;
    const needsReviewProjects = designProjects.filter((p) => p.stage === 'NEEDS_REVIEW').length;

    // Distinct active designed systems across filtered buildings
    const uniqueSystemInstances = new Set<string>();
    layouts.forEach((l) => {
      if (filteredBuildingIds.has(l.buildingId)) {
        uniqueSystemInstances.add(`${l.buildingId}-SPRINKLER_NFPA13`);
        uniqueSystemInstances.add(`${l.buildingId}-EXTINGUISHER_NFPA10`);
      }
    });
    systems.forEach((s) => {
      if (s.isActive && filteredBuildingIds.has(s.buildingId)) {
        uniqueSystemInstances.add(`${s.buildingId}-${s.systemType}`);
      }
    });
    const designedSystemsCount = uniqueSystemInstances.size;

    const scopedGaps = gapActions.filter((g) => filteredBuildingIds.has(g.buildingId));
    const openGaps = scopedGaps.filter((g) => g.status === 'OPEN' || g.status === 'IN_PROGRESS').length;
    const incompleteAssessmentBuildings = filteredRows.filter((r) => r.hasIncompleteAssessment).length;

    const totalReq = filteredRows.reduce((s, r) => s + r.requiredEquipTotal, 0);
    const totalEx = filteredRows.reduce((s, r) => s + r.existingEquipTotal, 0);
    const avgComp =
      totalBuildings > 0
        ? Math.round(filteredRows.reduce((s, r) => s + r.avgCompliance, 0) / totalBuildings)
        : 0;
    const inadequateWater = filteredRows.filter((r) => r.waterStatus === 'INADEQUATE').length;

    return {
      totalBuildings,
      totalDesignProjects,
      inProgressProjects,
      completedProjects,
      needsReviewProjects,
      designedSystemsCount,
      openGaps,
      incompleteAssessmentBuildings,
      totalReq,
      totalEx,
      avgComp,
      inadequateWater,
    };
  }, [filteredRows, designProjects, layouts, systems, gapActions, filteredBuildingIds]);

  // Real follow-up alerts from DB (critical open CAPAs, inadequate water, incomplete assessments)
  const followUpAlerts = useMemo(() => {
    const alerts: {
      id: string;
      severity: 'HIGH' | 'MEDIUM';
      title: string;
      detail: string;
      buildingId: number;
      floorId?: number | null;
      targetTab: string;
    }[] = [];

    for (const gap of gapActions) {
      if (!filteredBuildingIds.has(gap.buildingId)) continue;
      if (gap.status !== 'OPEN' && gap.status !== 'IN_PROGRESS') continue;
      const bld = buildingsById.get(gap.buildingId);
      alerts.push({
        id: `gap-${gap.id}`,
        severity: gap.riskPriority === 'CRITICAL' || gap.riskPriority === 'HIGH' ? 'HIGH' : 'MEDIUM',
        title: gap.title,
        detail: `${bld?.name || `ساختمان #${gap.buildingId}`} · اولویت ${gap.riskPriority}${gap.dueDate ? ` · سررسید ${gap.dueDate}` : ''}`,
        buildingId: gap.buildingId,
        floorId: gap.floorId ?? null,
        targetTab: 'CANVAS_2D',
      });
    }

    for (const row of filteredRows) {
      if (row.waterStatus === 'INADEQUATE') {
        alerts.push({
          id: `water-${row.building.id}`,
          severity: 'HIGH',
          title: `کسری منبع آب یا فشار هیدرولیکی در ${row.building.name}`,
          detail: `${row.building.unitName} — نیاز به بازنگری ظرفیت مخزن یا مشخصات پمپ آتش‌نشانی`,
          buildingId: row.building.id,
          floorId: row.firstFloorId,
          targetTab: 'REGISTRY',
        });
      }
      if (row.hasIncompleteAssessment) {
        alerts.push({
          id: `inc-${row.building.id}`,
          severity: 'MEDIUM',
          title: `پرونده ارزیابی ناقص: ${row.building.name}`,
          detail:
            row.floorsCount === 0
              ? 'هنوز هیچ طبقه‌ای برای این ساختمان ثبت نشده است.'
              : row.layoutsCount === 0
                ? 'نسخه نقشه و محاسبات برای طبقات ذخیره نشده است.'
                : 'برخی طبقات دارای داده‌های مهندسی ناقص هستند.',
          buildingId: row.building.id,
          floorId: row.firstFloorId,
          targetTab: row.floorsCount === 0 ? 'REGISTRY' : 'CANVAS_2D',
        });
      }
    }

    return alerts.slice(0, 8);
  }, [gapActions, filteredBuildingIds, buildingsById, filteredRows]);

  // NFPA 25 Upcoming / Overdue Equipment Inspection Alerts
  const dueInspections = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const list: {
      id: string;
      code: string;
      unit: string;
      location: string;
      dueType: string;
      dueDate: string;
      isOverdue: boolean;
    }[] = [];

    for (const eq of existingEquipment) {
      if (eq.operationalStatus === 'غیرفعال') continue;
      if (unitFilter !== 'ALL' && !(eq.unit || '').includes(unitFilter)) continue;

      if (eq.nextInspectionDue) {
        const ts = Date.parse(eq.nextInspectionDue);
        if (!Number.isNaN(ts) && ts - now <= thirtyDaysMs) {
          list.push({
            id: `${eq.id}-insp`,
            code: eq.code,
            unit: eq.unit || '-',
            location: eq.location || '-',
            dueType: 'بازرسی دوره‌ای NFPA 25/10',
            dueDate: eq.nextInspectionDue,
            isOverdue: ts < now,
          });
        }
      }
      if (eq.hydrostaticTestDue) {
        const ts = Date.parse(eq.hydrostaticTestDue);
        if (!Number.isNaN(ts) && ts - now <= thirtyDaysMs) {
          list.push({
            id: `${eq.id}-hydro`,
            code: eq.code,
            unit: eq.unit || '-',
            location: eq.location || '-',
            dueType: 'آزمون هیدرواستاتیک',
            dueDate: eq.hydrostaticTestDue,
            isOverdue: ts < now,
          });
        }
      }
    }
    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 10);
  }, [existingEquipment, unitFilter]);

  const activeBuildingObj = activeBuildingId ? buildingsById.get(activeBuildingId) || null : null;

  return (
    <div className="space-y-5" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Executive Command Banner & Primary Workspace Entry */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-[11px] font-black">
              داشبورد مدیریتی
            </span>
            <h2 className="text-base md:text-lg font-black text-slate-900 dark:text-white">
              داشبورد مدیریت طراحی و جانمایی سیستم‌های حفاظت در برابر حریق
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            پایش متمرکز وضعیت ساختمان‌ها، پروژه‌های طراحی سیستم‌های ۸گانه NFPA، مغایرت‌های باز و آماده‌سازی ورود به محیط طراحی ۲بعدی
          </p>
        </div>

        {/* Shortcuts & Primary CTA */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canWrite && onStartNewBuilding && (
            <button
              type="button"
              onClick={onStartNewBuilding}
              className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت ساختمان جدید</span>
            </button>
          )}
          {activeBuildingObj && (
            <button
              type="button"
              onClick={onEnterDesignWorkspace}
              className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-red-400 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-red-600" />
              <span>ادامه پرونده: {activeBuildingObj.name}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onEnterDesignWorkspace}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
          >
            <Sliders className="w-4 h-4" />
            <span>ورود به محیط طراحی و جانمایی</span>
            <ArrowUpLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-xs">
          <Filter className="w-4 h-4 text-slate-500" />
          <span>فیلترهای تحلیلی داشبورد</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">همه واحدهای بهره‌بردار</option>
            {uniqueUnits.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">همه ساختمان‌ها</option>
            {buildings.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>

          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">همه سیستم‌های حفاظت حریق</option>
            {FIRE_SYSTEM_PLUGINS.map((p) => (
              <option key={p.type} value={p.type}>
                {p.titleFa} ({p.standardCode})
              </option>
            ))}
          </select>

          <select
            value={complianceFilter}
            onChange={(e) => setComplianceFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">همه وضعیت‌های انطباق</option>
            <option value="COMPLIANT">منطبق (۸۵٪ به بالا)</option>
            <option value="NEEDS_ATTENTION">نیازمند اصلاح / کسری</option>
            <option value="INCOMPLETE">اطلاعات یا ارزیابی ناقص</option>
          </select>
        </div>
      </div>

      {/* 8 Real-Data KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>تعداد کل ساختمان‌های ثبت‌شده</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {kpis.totalBuildings}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            انطباق متوسط مهندسی: {kpis.avgComp}٪
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>تعداد پروژه‌های طراحی</span>
            <FolderKanban className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {kpis.totalDesignProjects}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            کل پروژه‌های نقشه و سیستم‌های فعال
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>پروژه‌های در حال اجرا</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-sky-600 dark:text-sky-400">
            {kpis.inProgressProjects}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            پیش‌نویس یا در انتظار تکمیل طراحی
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>پروژه‌های تکمیل‌شده</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {kpis.completedProjects}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            دارای تأیید نهایی مهندسی / HSE
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>پروژه‌های نیازمند بازبینی</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {kpis.needsReviewProjects}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            بازبینی‌شده یا دارای مغایرت استاندارد
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>تعداد سیستم‌های طراحی‌شده</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {kpis.designedSystemsCount}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            تجهیز موجود / نیاز: {kpis.totalEx} / {kpis.totalReq}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>تعداد مغایرت‌های باز</span>
            <ClipboardList className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {kpis.openGaps}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            اقدامات اصلاحی باز و در دست پیگیری (CAPA)
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>ساختمان‌های فاقد ارزیابی کامل</span>
            <FileWarning className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {kpis.incompleteAssessmentBuildings}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            {kpis.inadequateWater > 0 ? `${kpis.inadequateWater} ساختمان با کسری منبع آب` : 'منبع آب ساختمان‌های ارزیابی‌شده مطلوب'}
          </div>
        </div>
      </div>

      {/* Building-by-Building Engineering Matrix + Delete Option */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              فهرست ساختمان‌های اخیر و وضعیت حفاظت در برابر حریق
            </h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {filteredRows.length} ساختمان ثبت‌شده
          </span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {buildings.length === 0
                ? 'هنوز هیچ ساختمانی در سیستم حفاظت حریق ثبت نشده است.'
                : 'ساختمانی مطابق فیلترهای انتخاب‌شده یافت نشد.'}
            </p>
            {canWrite && (
              <button
                type="button"
                onClick={() => (onStartNewBuilding ? onStartNewBuilding() : onOpenBuildingDesign(0, null, 'REGISTRY'))}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ثبت اولین ساختمان در سامانه</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 text-right font-bold">ساختمان و کد</th>
                  <th className="py-2.5 px-3 text-right font-bold">واحد / کاربری</th>
                  <th className="py-2.5 px-3 text-right font-bold">سیستم‌های فعال</th>
                  <th className="py-2.5 px-3 text-center font-bold">موجود / نیاز</th>
                  <th className="py-2.5 px-3 text-center font-bold">درصد انطباق</th>
                  <th className="py-2.5 px-3 text-center font-bold">منبع آب</th>
                  <th className="py-2.5 px-3 text-center font-bold">CAPA باز</th>
                  <th className="py-2.5 px-3 text-center font-bold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {filteredRows.map((row) => (
                  <tr key={row.building.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{row.building.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {row.building.code} · {row.floorsCount} طبقه
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      <div>{row.building.unitName}</div>
                      <div className="text-[11px] text-slate-500">
                        {OCCUPANCY_LABELS_FA[row.building.occupancyType] || row.building.occupancyType}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                      {row.activeSystems.length > 0 ? row.activeSystems.join(' / ') : 'ثبت‌نشده'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {row.existingEquipTotal} / {row.requiredEquipTotal}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums font-bold">
                      <span
                        className={
                          row.statusCategory === 'COMPLIANT'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : row.statusCategory === 'INCOMPLETE'
                              ? 'text-slate-500'
                              : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {row.statusCategory === 'INCOMPLETE' ? 'ارزیابی ناقص' : `${row.avgCompliance}٪`}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-[11px] font-bold">
                      {row.waterStatus === 'ADEQUATE' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">کافی</span>
                      ) : row.waterStatus === 'INADEQUATE' ? (
                        <span className="text-rose-600 dark:text-rose-400">کسری</span>
                      ) : (
                        <span className="text-slate-500">ثبت‌نشده</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums">
                      <span className={row.openGaps > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                        {row.openGaps}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenBuildingDesign(
                              row.building.id,
                              row.firstFloorId,
                              row.firstFloorId ? 'CANVAS_2D' : 'REGISTRY'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-red-600 hover:text-white text-slate-800 dark:text-slate-100 rounded-lg font-bold cursor-pointer whitespace-nowrap transition-colors"
                        >
                          <span>ورود به طراحی</span>
                          <ArrowUpLeft className="w-3.5 h-3.5" />
                        </button>
                        {canApprove && onRequestDeleteBuilding && (
                          <button
                            type="button"
                            onClick={() => onRequestDeleteBuilding(row.building)}
                            title="حذف ساختمان"
                            aria-label={`حذف ساختمان ${row.building.name}`}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 cursor-pointer transition-colors"
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
        )}
      </div>

      {/* Recent Design Projects (Audit logs are centralized in System Settings -> Audit Logs) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              آخرین پروژه‌های طراحی و مهندسی
            </h3>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">{designProjects.length} پرونده</span>
        </div>

        {designProjects.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
            هنوز هیچ پروژه طراحی یا نسخه نقشه‌ای ثبت نشده است.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/70 max-h-[340px] overflow-y-auto">
            {designProjects.slice(0, 8).map((proj) => {
              const badgeClass =
                proj.stage === 'COMPLETED'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : proj.stage === 'NEEDS_REVIEW'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                    : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300';
              return (
                <div
                  key={proj.key}
                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/40 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {proj.titleFa}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {proj.standardCode} · {proj.revisionOrVersion}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                      <span>{proj.buildingName}</span>
                      <span>·</span>
                      <span>{proj.floorLabel}</span>
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${badgeClass}`}>
                        {proj.stageLabelFa}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenBuildingDesign(
                        proj.buildingId,
                        proj.floorId,
                        proj.floorId ? 'CANVAS_2D' : 'STEP_2',
                        proj.systemType
                      )
                    }
                    className="px-2.5 py-1.5 bg-slate-900 dark:bg-slate-700 hover:bg-red-600 text-white rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <span>بازکردن</span>
                    <ArrowUpLeft className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Follow-up Alerts & Upcoming NFPA 25 Inspections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Alerts & Follow-up Items */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                هشدارها و موارد نیازمند پیگیری
              </h3>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">{followUpAlerts.length} مورد</span>
          </div>

          {followUpAlerts.length === 0 ? (
            <div className="p-5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>در حال حاضر هشدار هیدرولیکی، مغایرت باز یا نقص ارزیابی ثبت نشده است.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/70 max-h-[300px] overflow-y-auto">
              {followUpAlerts.map((al) => (
                <div key={al.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 mt-0.5 ${
                        al.severity === 'HIGH' ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{al.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{al.detail}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenBuildingDesign(al.buildingId, al.floorId ?? null, al.targetTab)}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-red-600 hover:text-white text-slate-800 dark:text-slate-200 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer transition-colors"
                  >
                    رسیدگی
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming / Overdue NFPA 25 Inspections */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                تجهیزات در سررسید بازرسی و آزمون (NFPA 25 / NFPA 10)
              </h3>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">{dueInspections.length} مورد نزدیک</span>
          </div>

          {dueInspections.length === 0 ? (
            <div className="p-5 text-xs text-slate-500 dark:text-slate-400">
              مورد منقضی‌شده یا در آستانه سررسید ۳۰ روزه در تجهیزات ثبت‌شده یافت نشد.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-3 text-right font-bold">کد تجهیز</th>
                    <th className="py-2 px-3 text-right font-bold">واحد / محل نصب</th>
                    <th className="py-2 px-3 text-right font-bold">نوع بازرسی</th>
                    <th className="py-2 px-3 text-center font-bold">سررسید</th>
                    <th className="py-2 px-3 text-center font-bold">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                  {dueInspections.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">{item.code}</td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                        {item.unit} — {item.location}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{item.dueType}</td>
                      <td className="py-2 px-3 text-center font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {item.dueDate}
                      </td>
                      <td className="py-2 px-3 text-center font-bold">
                        {item.isOverdue ? (
                          <span className="text-rose-600 dark:text-rose-400">معوقه</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">در آستانه سررسید</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{ENGINEERING_DISCLAIMER_FA}</span>
      </div>
    </div>
  );
}
