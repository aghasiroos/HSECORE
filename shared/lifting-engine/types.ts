import type { LiftingUnitPreferences } from './unitConverter.ts';

export type VerificationStatus = 'PASS' | 'FAIL' | 'WARNING' | 'NOT_VERIFIED' | 'NOT_APPLICABLE';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface StandardReference {
  standardCode: string;
  edition: string;
  clause: string;
  descriptionFa: string;
  descriptionEn?: string;
}

export interface ParameterTraceItem {
  key: string;
  nameFa: string;
  inputValue: string | number | null;
  computedValue: string | number | null;
  unit: string;
  formula: string;
  standardRef: string;
  factors: string;
  assumptions: string[];
  validationStatus: VerificationStatus;
  finalStatus: VerificationStatus;
}

export interface EngineeringCheckItem {
  checkId: string;
  titleFa: string;
  titleEn: string;
  status: VerificationStatus;
  actualValue: number | null;
  allowableValue: number | null;
  remainingCapacity?: number | null;
  unit: string;
  utilizationPct: number | null;
  formulaText: string;
  standardRef: StandardReference;
  notesFa?: string;
}

export interface LoadChartPoint {
  id?: number;
  craneId?: number;
  chartName?: string;
  outriggerConfig: string;
  counterweightTon?: number;
  boomLengthM: number;
  radiusM: number;
  ratedCapacityTon: number;
  maxTipHeightM?: number | null;
  boomAngleDeg?: number | null;
  fallsOfRope?: number | null;
}

export interface CraneLookupInput {
  craneId?: number | null;
  craneName?: string;
  boomLengthM: number;
  radiusM: number;
  outriggerConfig: string;
  counterweightTon?: number;
  chartPoints: LoadChartPoint[];
  outriggerSpreadM?: number;
  craneDeadWeightTon?: number;
  outriggerPadAreaM2?: number;
  maxAllowableUtilizationPct?: number; // Default 85% normal, 75% tandem per ASME P30.1
}

export interface CraneLookupResult {
  status: VerificationStatus;
  ratedCapacityTon: number | null;
  remainingCapacityTon: number | null;
  lookupMethod: 'EXACT' | 'CONSERVATIVE_INTERPOLATION' | 'OUT_OF_RANGE' | 'NO_CHART_DATA';
  matchedBoomLengthM: number | null;
  matchedRadiusM: number | null;
  utilizationPct: number | null;
  outriggerReactionMaxTon: number | null;
  groundBearingPressureKpa: number | null;
  groundBearingVerified: boolean;
  bearingAssumptionNote?: string;
  standardRef: StandardReference;
  formulaText: string;
  blockers: string[];
  warnings: string[];
}

export type SlingArrangementType =
  | 'SINGLE_LEG'
  | 'TWO_LEG'
  | 'THREE_LEG'
  | 'FOUR_LEG'
  | 'MULTI_LEG'
  | 'BRIDLE'
  | 'SPREADER_BEAM'
  | 'LIFTING_BEAM';

export type SlingMaterialType = 'WIRE_ROPE' | 'ALLOY_CHAIN' | 'SYNTHETIC_WEB' | 'SYNTHETIC_ROUND';

export type LegParticipationStatus =
  | 'ACTIVE'
  | 'REDUCED_SHARE'
  | 'SLACK'
  | 'DROPPED_RIGID_ENVELOPE'
  | 'UNVERIFIED';

export type DeterminacyClassification =
  | 'DETERMINATE'
  | 'INDETERMINATE'
  | 'EQUALIZER_REDUCED'
  | 'UNDERCONSTRAINED'
  | 'UNSTABLE';

export type StaticSolutionMethod =
  | 'STATIC_EQUILIBRIUM_EXACT'
  | 'EQUALIZER_BALANCED_EQUILIBRIUM'
  | 'STIFFNESS_COMPATIBILITY_ACTIVE_SET'
  | 'RIGID_SUBSET_ENVELOPE_UNVERIFIED'
  | 'INSUFFICIENT_DATA_NOT_VERIFIED';

export interface EquilibriumResidualReport {
  sumFxTon: number;
  sumFyTon: number;
  sumFzTon: number;
  sumMxTonM: number;
  sumMyTonM: number;
  sumMzTonM: number;
  maxForceResidualTon: number;
  maxMomentResidualTonM: number;
  converged: boolean;
  toleranceTon: number;
  toleranceTonM: number;
}

export interface StaticEquilibriumReport {
  arrangementType: SlingArrangementType;
  unknownCount: number;
  independentEquationsCount: number;
  degreeOfIndeterminacy: number;
  determinacyClassification: DeterminacyClassification;
  solutionMethod: StaticSolutionMethod;
  stiffnessDataComplete: boolean;
  compatibilityVerified: boolean;
  noCompressionVerified: boolean;
  activeLegCount: number;
  slackLegIds: string[];
  symmetricGeometry: boolean;
  symmetricLoading: boolean;
  residuals: EquilibriumResidualReport;
  missingDataFields: string[];
  diagnosisFa: string;
}

export interface EngineeringAssumption {
  id: string;
  category: 'EQUILIBRIUM' | 'STIFFNESS' | 'COG' | 'GEOMETRY' | 'STANDARD';
  statementFa: string;
  technicalBasis: string;
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresEngineerSignoff: boolean;
}

export interface SensitivityParameterImpact {
  parameterKey: string;
  parameterNameFa: string;
  perturbationLabel: string;
  baselineMaxTensionTon: number;
  perturbedMaxTensionTon: number;
  deltaTensionTon: number;
  relativeImpactPct: number;
  baselineUtilPct: number | null;
  perturbedUtilPct: number | null;
  dataBasis: 'USER_UNCERTAINTY' | 'FINITE_DIFFERENTIAL_STEP';
}

export interface SensitivityAnalysisReport {
  governingParameterKey: string;
  governingParameterFa: string;
  maxImpactPct: number;
  worstCaseLegTensionTon: number;
  hasUserUncertainties: boolean;
  noteFa: string;
  impacts: SensitivityParameterImpact[];
}

export interface AttachmentPointInput {
  id: string;
  label: string;
  position: Vector3D; // relative to load geometric center in meters (Y is vertical)
  upperPosition?: Vector3D; // optional per-leg upper hook/spreader attachment point (m)
  materialType?: SlingMaterialType;
  diameterMm?: number;
  metallicAreaMm2?: number;
  elasticModulusGpa?: number;
  axialStiffnessKn?: number; // Explicit manufacturer EA = E * A (kN)
  lengthToleranceMm?: number; // Fabrication / installation delta-L (+ means longer leg, less load / slack risk)
  connectionStiffnessKnPerM?: number; // Shackle / padeye connection axial stiffness in series
  preTensionTon?: number;
  customWllTon?: number;
}

export interface WeightComponentInput {
  id: string;
  label: string;
  category: 'LOAD' | 'RIGGING' | 'HOOK' | 'SPREADER' | 'AUX';
  weightTon: number;
  cogPosition?: Vector3D; // optional 3D CoG of component in meters
}

export interface RiggingEvaluationInput {
  arrangementType?: SlingArrangementType;
  netLoadWeightTon: number;
  riggingAccessoryWeightTon: number;
  hookBlockWeightTon: number;
  spreaderBeamWeightTon?: number;
  auxiliaryWeightTon?: number;
  weightComponents?: WeightComponentInput[]; // If provided without duplicate category summing, derives composite mass & CoG
  dynamicFactor: number; // DAF (ASME P30.1 / BTH-1)
  cogOffset: Vector3D; // relative to geometric center (m)
  hookPosition: Vector3D; // hook height & planar position above load geometric center (m)
  attachmentPoints: AttachmentPointInput[];
  hitchType?: 'VERTICAL' | 'CHOKER' | 'BASKET';
  hasEqualizer?: boolean; // Mechanical equalizer / sheave equalizing pairs (reduces indeterminacy)
  equalizerPairs?: Array<[string, string]>; // Optional explicit pairs e.g. [['P1','P2'], ['P3','P4']]
  enforceThreeLegEffectiveForFourLeg?: boolean; // ASME B30.9 / P30.1 rigid load rule
  slingWllTon?: number | null;
  shackleWllTon?: number | null;
  shackleLateralAngleDeg?: number; // Off-axis side load angle on shackle per ASME B30.26 Sec. 26-1.4
  shacklePinDiameterMm?: number;
  lugHoleDiameterMm?: number;
  minAllowedHorizontalSlingAngleDeg?: number; // default 45 deg warning, <30 deg fail
  outRiggedLoadFactor?: number;
  sensitivityUncertainties?: {
    weightPct?: number;
    cogShiftM?: number;
    slingToleranceMm?: number;
    hookHeightDeltaM?: number;
  };
}

export interface SlingLegResult {
  id: string;
  label: string;
  attachmentPos: Vector3D;
  upperPos?: Vector3D;
  verticalShareTon: number;
  axialTensionTon: number;
  forceVectorTon: Vector3D;
  lengthM: number;
  effectiveLengthM: number;
  horizontalAngleDeg: number;
  verticalAngleDeg: number;
  angleFactor: number;
  axialStiffnessKn?: number | null;
  axialElongationMm?: number | null;
  lengthToleranceMm?: number;
  participationStatus: LegParticipationStatus;
  allowableWllTon?: number | null;
  slingUtilizationPct: number | null;
  remainingSlingCapacityTon: number | null;
  shackleUtilizationPct: number | null;
  remainingShackleCapacityTon: number | null;
  status: VerificationStatus;
}

export interface LoadCaseResult {
  caseId: string;
  caseNameFa: string;
  dafApplied: number;
  cogShiftM: Vector3D;
  grossStaticLoadTon: number;
  designFactoredLoadTon: number;
  maxLegTensionTon: number;
  minHorizontalAngleDeg: number;
  craneUtilizationPct: number | null;
  status: VerificationStatus;
}

export interface RiggingSolverResult {
  status: VerificationStatus;
  arrangementType: SlingArrangementType;
  grossStaticLoadTon: number;
  designTotalLoadTon: number;
  loadAtSlingsTon: number;
  compositeCogM: Vector3D;
  overturningMomentTonM: number;
  cogInsideSupportPolygon: boolean;
  effectiveLegCount: number;
  governingLegTensionTon: number;
  minHorizontalAngleDeg: number;
  maxAngleFactor: number;
  effectiveSlingWllTon: number | null;
  effectiveShackleWllTon: number | null;
  shackleAngleDeratingFactor: number;
  staticEquilibrium: StaticEquilibriumReport;
  sensitivityAnalysis: SensitivityAnalysisReport;
  engineeringAssumptions: EngineeringAssumption[];
  legs: SlingLegResult[];
  loadCases: LoadCaseResult[];
  checks: EngineeringCheckItem[];
  parameterTrace: ParameterTraceItem[];
  blockers: string[];
  warnings: string[];
}

export interface TurningPhasePoint {
  tiltAngleDeg: number; // 0 = horizontal, 90 = vertical
  mainCraneLoadTon: number;
  tailCraneLoadTon: number;
  mainCraneSharePct: number;
  tailCraneSharePct: number;
  cogHorizontalFromTailM: number;
  mainSlingAngleFromVerticalDeg: number;
  status: VerificationStatus;
}

export interface LiftingTurningInput {
  enabled: boolean;
  totalWeightTon: number;
  vesselLengthM: number;
  cogFromBottomM: number; // distance of CoG from bottom/tail hinge
  mainLugFromBottomM: number; // top trunnion/lug distance from bottom
  tailLugFromBottomM: number; // tailing lug distance from bottom (usually near 0)
  radialOffsetM?: number; // lug radial offset from centerline
  dynamicFactor: number;
  mainCraneCapacityTon?: number | null;
  tailCraneCapacityTon?: number | null;
}

export interface LiftingTurningResult {
  status: VerificationStatus;
  maxMainCraneLoadTon: number;
  maxTailCraneLoadTon: number;
  criticalAngleForMainDeg: number;
  criticalAngleForTailDeg: number;
  phases: TurningPhasePoint[];
  checks: EngineeringCheckItem[];
  blockers: string[];
  warnings: string[];
}

export interface TandemLiftInput {
  enabled: boolean;
  grossLoadTon: number;
  dynamicFactor: number;
  crane1DistanceFromCogM: number;
  crane2DistanceFromCogM: number;
  cogUncertaintyM: number; // e.g. ±0.5 m
  outOfLevelDeg: number; // boom/beam out-of-level angle tolerance (deg)
  crane1RatedCapacityTon: number | null;
  crane2RatedCapacityTon: number | null;
  tandemDeratingFactorPct?: number; // ASME P30.1 standard max 75%
  equalizerBeamWeightTon?: number;
}

export interface TandemLiftResult {
  status: VerificationStatus;
  crane1NominalLoadTon: number;
  crane2NominalLoadTon: number;
  crane1WorstCaseLoadTon: number;
  crane2WorstCaseLoadTon: number;
  crane1UtilizationPct: number | null;
  crane2UtilizationPct: number | null;
  checks: EngineeringCheckItem[];
  blockers: string[];
  warnings: string[];
}

export interface FullLiftingEvaluationInput {
  liftCategory: string;
  crane: CraneLookupInput;
  tailCrane?: CraneLookupInput;
  rigging: RiggingEvaluationInput;
  tandem?: TandemLiftInput;
  turning?: LiftingTurningInput;
  windSpeedMs?: number;
  groundBearingMaxKpa?: number;
  equipmentCertsValid?: boolean;
  personnelQualified?: boolean;
  unitPreferences?: Partial<LiftingUnitPreferences>;
  verifiedGates?: string[]; // e.g. ['G1', 'G2', 'G3']
  blindLiftParams?: {
    isBlindLift: boolean;
    hasDedicatedSignaler: boolean;
    communicationPrimary: string;
    communicationBackup: string;
    emergencyStopVerified: boolean;
  };
  standardsOverrides?: Record<string, { edition?: string; factors?: Record<string, any> }>;
}

export interface FullLiftingEvaluationResult {
  engineVersion: string;
  validationTier: 'VERIFIED_CORE' | 'EXPERIMENTAL_UNVERIFIED';
  moduleTiers: Record<string, 'VERIFIED_CORE' | 'EXPERIMENTAL_UNVERIFIED'>;
  unitPreferences: LiftingUnitPreferences;
  overallStatus: VerificationStatus;
  remainingCraneCapacityTon: number | null;
  craneResult: CraneLookupResult;
  tailCraneResult?: CraneLookupResult;
  riggingResult: RiggingSolverResult;
  tandemResult?: TandemLiftResult;
  turningResult?: LiftingTurningResult;
  standardReferences: StandardReference[];
  allChecks: EngineeringCheckItem[];
  parameterTrace: ParameterTraceItem[];
  blockers: string[];
  warnings: string[];
  calculatedAt: string;
}
