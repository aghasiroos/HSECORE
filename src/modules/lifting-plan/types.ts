import type {
  AttachmentPointInput,
  EngineeringAssumption,
  FullLiftingEvaluationResult as FullPlanEvaluationResult,
  TandemLiftInput,
  LiftingTurningInput as LiftingAndTurningInput,
  ParameterTraceItem,
  SensitivityAnalysisReport,
  SlingArrangementType,
  SlingLegResult,
  SlingMaterialType,
  StaticEquilibriumReport,
  VerificationStatus,
  WeightComponentInput,
} from '../../../shared/lifting-engine/types';
import type { LiftingUnitPreferences } from '../../../shared/lifting-engine/unitConverter';
import type { BenchmarkSuiteReport, BenchmarkTestCaseResult } from '../../../shared/lifting-engine/validationSuite';

export type {
  AttachmentPointInput,
  EngineeringAssumption,
  VerificationStatus,
  FullPlanEvaluationResult,
  ParameterTraceItem,
  LiftingUnitPreferences,
  BenchmarkSuiteReport,
  BenchmarkTestCaseResult,
  SensitivityAnalysisReport,
  SlingArrangementType,
  SlingLegResult,
  SlingMaterialType,
  StaticEquilibriumReport,
  WeightComponentInput,
};

export interface LiftingStandardConfig {
  id: number;
  standardCode: string;
  titleFa: string;
  titleEn: string;
  edition: string;
  category: string;
  activeClauses: Record<string, any>;
  engineeringFactors: Record<string, any>;
  notes?: string | null;
  isActive: boolean;
  updatedBy?: string | null;
  updatedAt?: string;
}

export interface LiftingStageGateRow {
  id: number;
  gateCode: string;
  titleFa: string;
  criteriaFa: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  evidenceSummary: Record<string, any>;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  updatedAt?: string;
}

export interface CraneLoadChartRow {
  id?: number;
  craneId?: number;
  chartName: string;
  outriggerConfig: string;
  counterweightTon: number;
  boomLengthM: number;
  radiusM: number;
  ratedCapacityTon: number;
  maxTipHeightM?: number | null;
  boomAngleDeg?: number | null;
  fallsOfRope?: number | null;
}

export interface LiftingCrane {
  id: number;
  craneCode: string;
  name: string;
  craneType: string;
  manufacturer?: string | null;
  model: string;
  serialNumber?: string | null;
  plateNumber?: string | null;
  maxRatedCapacityTon: number;
  minBoomLengthM: number;
  maxBoomLengthM: number;
  maxRadiusM: number;
  counterweightTon: number;
  outriggerSpreadM: number;
  deadWeightTon?: number | null;
  defaultOutriggerPadAreaM2?: number | null;
  hookBlockWeightTon: number;
  ownershipType: string;
  contractorName?: string | null;
  unitId?: number | null;
  unitName?: string | null;
  certificateNumber?: string | null;
  certificateDocId?: string | null;
  certificateIssueDate?: string | null;
  certificateExpiryDate?: string | null;
  lastInspectionDate?: string | null;
  nextInspectionDate?: string | null;
  status: string;
  certExpiryState?: 'VALID' | 'WARNING_SOON' | 'EXPIRED' | 'MISSING';
  loadChartRows: CraneLoadChartRow[];
  notes?: string | null;
}

export interface RiggingEquipmentItem {
  id: number;
  assetCode: string;
  name: string;
  category: string;
  standardRef: string;
  wllTon: number;
  safetyFactor: number;
  selfWeightKg: number;
  lengthM?: number | null;
  diameterMm?: number | null;
  minSlingAngleDeg?: number | null;
  serialNumber?: string | null;
  manufacturer?: string | null;
  ownerType: string;
  contractorName?: string | null;
  unitName?: string | null;
  storageLocation?: string | null;
  certificateNumber?: string | null;
  certificateDocId?: string | null;
  certificateExpiryDate?: string | null;
  lastInspectionDate?: string | null;
  nextInspectionDate?: string | null;
  safetyLatchOk: boolean;
  conditionStatus: string;
  certExpiryState?: 'VALID' | 'WARNING_SOON' | 'EXPIRED' | 'MISSING';
  notes?: string | null;
}

export interface LiftingWorkflowStageRow {
  id: number;
  planId: number;
  revisionNumber: number;
  stageKey: string;
  stageTitleFa: string;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'RESET_ON_REVISION';
  signerName?: string | null;
  signerRole?: string | null;
  signerPersonnelCode?: string | null;
  checklistState: Record<string, boolean>;
  blockingReasons: string[];
  comments?: string | null;
  decidedAt?: string | null;
}

export interface LiftingPlanRecord {
  id: number;
  planCode: string;
  title: string;
  revisionNumber: number;
  liftCategory: string;
  companyId?: number | null;
  unitId?: number | null;
  unitName: string;
  areaLocation: string;
  plannedDate: string;
  contractorName?: string | null;
  loadName: string;
  loadShape: string;
  netLoadWeightTon: number;
  riggingAccessoryWeightTon: number;
  hookBlockWeightTon: number;
  dynamicFactor: number;
  loadDimensions: {
    lengthM?: number;
    widthM?: number;
    heightM?: number;
    diameterM?: number;
  };
  cogOffset: { x: number; y: number; z: number };
  craneSetup: {
    primaryCraneId?: number;
    tailCraneId?: number;
    boomLengthM?: number;
    radiusM?: number;
    outriggerConfig?: string;
    outriggerSpreadM?: number;
    craneDeadWeightTon?: number;
    outriggerPadAreaM2?: number;
    counterweightTon?: number;
    windSpeedMs?: number;
    groundBearingMaxKpa?: number;
    maxUtilizationPct?: number;
  };
  riggingSetup: {
    arrangementType?: SlingArrangementType;
    hitchType?: string;
    legCount?: number;
    hookHeightM?: number;
    hookX?: number;
    hookZ?: number;
    hitchFactor?: number;
    spreaderBeamWeightTon?: number;
    hasEqualizer?: boolean;
    equalizerPairs?: Array<[string, string]>;
    enforceThreeLegEffectiveForFourLeg?: boolean;
    slingWllTon?: number;
    shackleWllTon?: number;
    shackleLateralAngleDeg?: number;
    shacklePinDiameterMm?: number;
    lugHoleDiameterMm?: number;
    slingIds?: number[];
    shackleIds?: number[];
    attachmentPoints?: AttachmentPointInput[];
    weightComponents?: WeightComponentInput[];
    sensitivityUncertainties?: {
      weightPct?: number;
      cogShiftM?: number;
      slingToleranceMm?: number;
      hookHeightDeltaM?: number;
    };
  };
  tandemConfig: Partial<TandemLiftInput> & Record<string, any>;
  blindConfig: {
    enabled?: boolean;
    signalerName?: string;
    signalerCode?: string;
    backupSignalerName?: string;
    primaryRadioChannel?: string;
    backupRadioChannel?: string;
    blindZonesDescription?: string;
    handSignalsAgreed?: boolean;
    emergencyStopProcedure?: string;
    obstructionHeightM?: number;
  };
  turningConfig: Partial<LiftingAndTurningInput> & { previewAngleDeg?: number } & Record<string, any>;
  personnelAssignment: {
    plannerName?: string;
    plannerCode?: string;
    operatorName?: string;
    operatorCode?: string;
    riggerName?: string;
    riggerCode?: string;
    safetySupervisorName?: string;
    safetySupervisorCode?: string;
  };
  unitPreferences?: LiftingUnitPreferences;
  engineeringChecklist?: Record<string, { checked: boolean; note?: string; verifiedBy?: string; verifiedAt?: string }>;
  hseChecklist?: Record<string, { checked: boolean; note?: string; verifiedBy?: string; verifiedAt?: string }>;
  fieldConditionsVerification?: Record<string, { planned?: string; actual?: string; verified: boolean; note?: string }>;
  engineVersion?: string;
  linkedRiskAssessmentId?: number | null;
  linkedPermitId?: number | null;
  linkedNonConformanceId?: number | null;
  linkedInspectionIds: number[];
  linkedDocumentIds: string[];
  engineeringStatus: VerificationStatus;
  workflowStage: string;
  status: string;
  requiresReapproval: boolean;
  latestCalculationSummary: Partial<FullPlanEvaluationResult>;
  aiAnalysisSnapshot: Record<string, any>;
  notes?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  workflowApprovals?: LiftingWorkflowStageRow[];
}

export interface LiftingIntegrationContext {
  personnel: Array<{
    id: number;
    personnelCode: string;
    fullName: string;
    position: string;
    unitId?: number | null;
    unitName: string;
    status: string;
    totalTrainings: number;
    liftingTrainings: any[];
    allTrainings: any[];
  }>;
  companies: Array<{ id: number; name: string }>;
  units: Array<{ id: number; name: string; departmentId?: number }>;
  contractors: Array<{ id: string; name: string; managerName?: string; phone?: string; status?: string }>;
  trainings: any[];
  riskAssessments: any[];
  workPermits: any[];
  safetyInspections: any[];
  documents: any[];
  nonConformances: any[];
}

export type LiftingSubTab =
  | 'dashboard'
  | 'plans'
  | 'engineering'
  | 'cranes'
  | 'rigging'
  | 'special-ops'
  | 'risk-jsa'
  | 'workflow'
  | 'reports'
  | 'assets-certs'
  | 'standards';
