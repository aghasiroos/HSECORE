import React from 'react';
import {
  Droplets,
  Flame,
  Shield,
  Waves,
  Wind,
  BellRing,
  Gauge,
  Database,
} from 'lucide-react';
import type {
  FireDesignBuilding,
  FireDesignFloor,
  FireDesignGapAction,
  FireDesignLayout,
  FireDesignSystemRecord,
  FireSystemType,
  FloorCalculationResult,
  PlacedSuppressionItem,
} from './types';
import {
  ALL_EIGHT_FIRE_SYSTEMS,
  UnifiedFireSystemDescriptor,
} from './systemsRegistry';
import {
  ExistingEquipmentSummaryItem,
  runNfpaFloorCalculation,
} from './nfpaEngine';

export function renderFireSystemIcon(
  iconKey: UnifiedFireSystemDescriptor['iconKey'],
  className = 'w-5 h-5'
): React.ReactNode {
  switch (iconKey) {
    case 'SPRINKLER':
      return React.createElement(Droplets, { className });
    case 'EXTINGUISHER':
      return React.createElement(Flame, { className });
    case 'HYDRANT':
      return React.createElement(Shield, { className });
    case 'FOAM':
      return React.createElement(Waves, { className });
    case 'CLEAN_AGENT':
      return React.createElement(Wind, { className });
    case 'ALARM':
      return React.createElement(BellRing, { className });
    case 'PUMP':
      return React.createElement(Gauge, { className });
    case 'TANK':
      return React.createElement(Database, { className });
  }
}

export type SystemDesignProgressState = 'DESIGNED' | 'IN_PROGRESS' | 'UNDESIGNED';
export type SystemComplianceState = 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | 'INCOMPLETE';

export interface PerSystemDesignSummary {
  descriptor: UnifiedFireSystemDescriptor;
  designState: SystemDesignProgressState;
  complianceState: SystemComplianceState;
  complianceScore: number;
  registeredEquipmentCount: number;
  requiredEquipmentCount: number | null;
  latestSystemRecord: FireDesignSystemRecord | null;
  latestLayout: FireDesignLayout | null;
  isReviewed: boolean;
  isApproved: boolean;
  editionLabel: string;
}

export interface BuildingDesignStatusSummary {
  building: FireDesignBuilding;
  floorsCount: number;
  totalAreaSqm: number;
  designedCount: number;
  inProgressCount: number;
  undesignedCount: number;
  designProgressPercent: number;
  standardCompliancePercent: number;
  existingEquipmentCount: number;
  requiredEquipmentCount: number;
  openCapaCount: number;
  totalDiscrepanciesCount: number;
  engineeringApprovalStage: 'APPROVED' | 'REVIEWED' | 'PRELIMINARY';
  perSystem: PerSystemDesignSummary[];
}

function itemBelongsToSystem(item: PlacedSuppressionItem, sysType: FireSystemType): boolean {
  if (item.systemType === sysType) return true;
  switch (sysType) {
    case 'SPRINKLER_NFPA13':
      return item.kind === 'SPRINKLER_PROPOSED' || item.kind === 'SPRINKLER_EXISTING' || item.kind === 'RISER_VALVE';
    case 'EXTINGUISHER_NFPA10':
      return item.kind === 'EXTINGUISHER_PROPOSED' || item.kind === 'EXTINGUISHER_EXISTING';
    case 'STANDPIPE_HYDRANT_NFPA14':
      return item.kind === 'HYDRANT_HOSE_PROPOSED' || item.kind === 'HYDRANT_HOSE_EXISTING' || item.kind === 'HOSE_BOX';
    case 'FOAM_NFPA11':
      return item.kind === 'FOAM_MONITOR_PROPOSED' || item.kind === 'FOAM_MONITOR_EXISTING';
    case 'CLEAN_AGENT_NFPA2001':
      return item.kind === 'CLEAN_AGENT_NOZZLE' || item.kind === 'CLEAN_AGENT_CYLINDER';
    case 'FIRE_ALARM_NFPA72':
      return (
        item.kind === 'DETECTOR_SMOKE' ||
        item.kind === 'DETECTOR_HEAT' ||
        item.kind === 'DETECTOR_GAS' ||
        item.kind === 'PULL_STATION' ||
        item.kind === 'HORN_STROBE' ||
        item.kind === 'FACP_PANEL'
      );
    default:
      return false;
  }
}

export function computeBuildingDesignSummary(params: {
  building: FireDesignBuilding;
  floors: FireDesignFloor[];
  layouts: FireDesignLayout[];
  systems: FireDesignSystemRecord[];
  gapActions: FireDesignGapAction[];
  existingEquipment: ExistingEquipmentSummaryItem[];
  activeFloor?: FireDesignFloor | null;
  livePlacedItems?: PlacedSuppressionItem[];
  liveFloorCalc?: FloorCalculationResult | null;
}): BuildingDesignStatusSummary {
  const {
    building,
    floors,
    layouts,
    systems,
    gapActions,
    existingEquipment,
    activeFloor,
    livePlacedItems,
    liveFloorCalc,
  } = params;

  const bFloors = floors.filter((f) => f.buildingId === building.id);
  const bLayouts = layouts.filter((l) => l.buildingId === building.id);
  const bSystems = systems.filter((s) => s.buildingId === building.id && s.isActive);
  const bGaps = gapActions.filter((g) => g.buildingId === building.id);

  const totalAreaSqm = Number(bFloors.reduce((acc, f) => acc + (f.areaSqm || 0), 0).toFixed(1));
  const openCapaCount = bGaps.filter((g) => g.status === 'OPEN' || g.status === 'IN_PROGRESS').length;

  // Evaluate floors for Sprinkler & Extinguisher baseline
  let floorCalcs: { floor: FireDesignFloor; calc: FloorCalculationResult; layout: FireDesignLayout | null; placed: PlacedSuppressionItem[] }[] = [];
  for (const fl of bFloors) {
    const rev = bLayouts.find((l) => l.floorId === fl.id) || null;
    const isTargetActiveFloor = activeFloor && activeFloor.id === fl.id;
    const placed = isTargetActiveFloor && livePlacedItems ? livePlacedItems : (rev?.placedItems || []);
    const calc =
      isTargetActiveFloor && liveFloorCalc
        ? liveFloorCalc
        : runNfpaFloorCalculation({
            building,
            floor: fl,
            sprinklerConfig: rev?.sprinklerConfig,
            extinguisherConfig: rev?.extinguisherConfig,
            placedItems: placed,
            existingEquipment,
          });
    floorCalcs.push({ floor: fl, calc, layout: rev, placed });
  }

  // Focus calc (active floor if present, otherwise first floor)
  const focusEntry =
    (activeFloor ? floorCalcs.find((fc) => fc.floor.id === activeFloor.id) : null) || floorCalcs[0] || null;

  let existingEquipmentCount = 0;
  let requiredEquipmentCount = 0;
  let blindSpotsAndIncompatCount = 0;

  for (const fc of floorCalcs) {
    existingEquipmentCount += fc.calc.comparisonRows.reduce((s, r) => s + r.existingCount, 0);
    requiredEquipmentCount += fc.calc.comparisonRows.reduce((s, r) => s + r.requiredCount, 0);
    blindSpotsAndIncompatCount +=
      fc.calc.uncoveredZones.length + fc.calc.comparisonRows.reduce((s, r) => s + r.incompatibleCount, 0);
  }

  const perSystem: PerSystemDesignSummary[] = ALL_EIGHT_FIRE_SYSTEMS.map((descriptor) => {
    // 1. Sprinkler & Extinguisher derived from layout revisions + core NFPA engine
    if (descriptor.type === 'SPRINKLER_NFPA13' || descriptor.type === 'EXTINGUISHER_NFPA10') {
      const targetLayout = focusEntry?.layout || bLayouts[0] || null;
      const calc = focusEntry?.calc || null;
      const placedOnFocus = focusEntry?.placed || [];

      const registeredCount = placedOnFocus.filter((it) => itemBelongsToSystem(it, descriptor.type)).length;
      const requiredCount =
        !calc
          ? null
          : descriptor.type === 'SPRINKLER_NFPA13'
            ? calc.sprinkler.calculatedHeadCount
            : calc.extinguisher.requiredTotalCount;

      let designState: SystemDesignProgressState = 'UNDESIGNED';
      if (targetLayout && calc && calc.calculationStatus !== 'INCOMPLETE_DATA') {
        designState = targetLayout.status === 'DRAFT' && calc.calculationStatus === 'PARTIAL_WATER_DATA' ? 'IN_PROGRESS' : 'DESIGNED';
      } else if (calc && calc.calculationStatus !== 'INCOMPLETE_DATA' && registeredCount > 0) {
        designState = 'IN_PROGRESS';
      } else if (bFloors.length > 0 && calc && calc.calculationStatus === 'COMPLETE') {
        designState = 'IN_PROGRESS';
      }

      let complianceState: SystemComplianceState = 'INCOMPLETE';
      let complianceScore = 0;

      if (calc && calc.calculationStatus !== 'INCOMPLETE_DATA') {
        if (descriptor.type === 'SPRINKLER_NFPA13') {
          if (!calc.sprinkler.isRequiredOrRecommended) {
            complianceState = 'COMPLIANT';
            complianceScore = 100;
          } else {
            const cov = calc.sprinkler.coveragePercent;
            const hyd = calc.sprinkler.hydraulics.waterSupplyStatus;
            const coldErr = (calc.sprinkler.overDensityConflicts || 0) > 0;
            if (hyd === 'INADEQUATE' || cov < 70) {
              complianceState = 'NON_COMPLIANT';
              complianceScore = Math.max(15, Math.round(cov * 0.6));
            } else if (hyd === 'NEEDS_WATER_DATA' || cov < 90 || coldErr) {
              complianceState = 'NEEDS_REVIEW';
              complianceScore = Math.round(cov * 0.85);
            } else {
              complianceState = 'COMPLIANT';
              complianceScore = Math.round(cov);
            }
          }
        } else {
          // EXTINGUISHER_NFPA10
          const cov = calc.extinguisher.coveragePercent;
          const hasIncompat = calc.comparisonRows.some((r) => r.incompatibleCount > 0);
          if (hasIncompat || cov < 70) {
            complianceState = 'NON_COMPLIANT';
            complianceScore = hasIncompat ? Math.min(45, cov) : Math.round(cov);
          } else if (cov < 90) {
            complianceState = 'NEEDS_REVIEW';
            complianceScore = Math.round(cov);
          } else {
            complianceState = 'COMPLIANT';
            complianceScore = Math.round(cov);
          }
        }
      }

      return {
        descriptor,
        designState,
        complianceState,
        complianceScore,
        registeredEquipmentCount: registeredCount,
        requiredEquipmentCount,
        latestSystemRecord: null,
        latestLayout: targetLayout,
        isReviewed: targetLayout?.status === 'REVIEWED' || targetLayout?.status === 'APPROVED',
        isApproved: targetLayout?.status === 'APPROVED',
        editionLabel:
          descriptor.type === 'SPRINKLER_NFPA13'
            ? `NFPA 13 (${building.nfpa13Edition})`
            : `NFPA 10 (${building.nfpa10Edition})`,
      };
    }

    // 2. Plugin-driven systems (NFPA 14, 11, 2001, 72, 20, 22)
    // Prefer matching active floor if floor-scoped; fallback to any active record in this building
    const matchingRec =
      bSystems.find(
        (s) =>
          s.systemType === descriptor.type &&
          (descriptor.scope === 'BUILDING' || !activeFloor || s.floorId === activeFloor.id || !s.floorId)
      ) ||
      (descriptor.type === 'PUMP_NFPA20' || descriptor.type === 'TANK_NFPA22'
        ? bSystems.find((s) => s.systemType === 'PUMP_TANK_NFPA20_22')
        : undefined) ||
      bSystems.find((s) => s.systemType === descriptor.type) ||
      null;

    const placedOnFocus = focusEntry?.placed || [];
    const canvasCount = placedOnFocus.filter((it) => itemBelongsToSystem(it, descriptor.type)).length;
    const savedSuggestedCount = Array.isArray(matchingRec?.calculationOutput?.suggestedItems)
      ? matchingRec!.calculationOutput.suggestedItems.length
      : 0;

    let designState: SystemDesignProgressState = 'UNDESIGNED';
    if (matchingRec) {
      designState = matchingRec.complianceStatus === 'INCOMPLETE' ? 'IN_PROGRESS' : 'DESIGNED';
    } else if (canvasCount > 0) {
      designState = 'IN_PROGRESS';
    }

    const complianceState: SystemComplianceState = matchingRec ? matchingRec.complianceStatus : 'INCOMPLETE';
    const complianceScore =
      complianceState === 'COMPLIANT'
        ? 100
        : complianceState === 'NEEDS_REVIEW'
          ? 65
          : complianceState === 'NON_COMPLIANT'
            ? 25
            : 0;

    return {
      descriptor,
      designState,
      complianceState,
      complianceScore,
      registeredEquipmentCount: Math.max(canvasCount, savedSuggestedCount),
      requiredEquipmentCount: savedSuggestedCount > 0 ? savedSuggestedCount : null,
      latestSystemRecord: matchingRec,
      latestLayout: null,
      isReviewed:
        matchingRec?.designStage === 'REVIEWED' || matchingRec?.designStage === 'APPROVED_ENGINEERING',
      isApproved: matchingRec?.designStage === 'APPROVED_ENGINEERING',
      editionLabel: `${descriptor.standardCode} (${matchingRec?.standardEdition || descriptor.defaultEdition})`,
    };
  });

  const designedCount = perSystem.filter((s) => s.designState === 'DESIGNED').length;
  const inProgressCount = perSystem.filter((s) => s.designState === 'IN_PROGRESS').length;
  const undesignedCount = perSystem.filter((s) => s.designState === 'UNDESIGNED').length;

  // Strictly separated metrics:
  // 1) Design Progress % = proportion of the 8 systems designed/saved
  const designProgressPercent = Math.round(((designedCount * 1 + inProgressCount * 0.5) / 8) * 100);

  // 2) Standard Compliance % = actual engineering compliance score across started/designed systems
  const startedSystems = perSystem.filter((s) => s.designState !== 'UNDESIGNED' || s.complianceState !== 'INCOMPLETE');
  const standardCompliancePercent =
    startedSystems.length > 0
      ? Math.round(startedSystems.reduce((sum, s) => sum + s.complianceScore, 0) / startedSystems.length)
      : 0;

  const approvedCount = perSystem.filter((s) => s.isApproved).length;
  const reviewedCount = perSystem.filter((s) => s.isReviewed).length;
  const engineeringApprovalStage: 'APPROVED' | 'REVIEWED' | 'PRELIMINARY' =
    building.status === 'APPROVED' || (designedCount > 0 && approvedCount === designedCount)
      ? 'APPROVED'
      : reviewedCount > 0
        ? 'REVIEWED'
        : 'PRELIMINARY';

  return {
    building,
    floorsCount: bFloors.length,
    totalAreaSqm,
    designedCount,
    inProgressCount,
    undesignedCount,
    designProgressPercent,
    standardCompliancePercent,
    existingEquipmentCount,
    requiredEquipmentCount,
    openCapaCount,
    totalDiscrepanciesCount: openCapaCount + blindSpotsAndIncompatCount,
    engineeringApprovalStage,
    perSystem,
  };
}
