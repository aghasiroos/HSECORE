export type Nfpa13Edition = '2022' | '2019' | '2016';
export type Nfpa10Edition = '2022' | '2018';

export type OccupancyType =
  | 'ADMINISTRATIVE'
  | 'CONTROL_ROOM'
  | 'SERVER_ROOM'
  | 'WAREHOUSE'
  | 'INDUSTRIAL_PROCESS'
  | 'LABORATORY'
  | 'KITCHEN_DINING'
  | 'ELECTRICAL_SUBSTATION'
  | 'WORKSHOP'
  | 'PARKING'
  | 'OTHER';

export type StructureType =
  | 'CONCRETE'
  | 'STEEL_PROTECTED'
  | 'STEEL_UNPROTECTED'
  | 'MASONRY'
  | 'COMPOSITE';

export type CeilingType =
  | 'FLAT_UNOBSTRUCTED'
  | 'EXPOSED_BEAMS'
  | 'SUSPENDED_CEILING'
  | 'SLOPED'
  | 'OPEN_TRUSS';

export type HazardGroup =
  | 'LIGHT'
  | 'OH1'
  | 'OH2'
  | 'EH1'
  | 'EH2'
  | 'SPECIAL_STORAGE';

export type FireClass = 'A' | 'B' | 'C' | 'D' | 'K';

export type AgentType =
  | 'ABC_DRY_POWDER'
  | 'CO2'
  | 'CLEAN_AGENT'
  | 'FOAM_AFFF'
  | 'WATER'
  | 'WET_CHEMICAL'
  | 'CLASS_D_POWDER';

export type WaterSourceType = 'FIRE_NETWORK' | 'STORAGE_TANK';

export interface WaterSupplyInput {
  sourceType?: WaterSourceType;
  hasFirePump?: boolean;
  hasNetworkConnection?: boolean;
  /** @deprecated Legacy flag kept only for backward compatibility with older records */
  isAvailable?: boolean;
  tankCapacityLiters?: number | null;
  pumpRatedFlowGpm?: number | null;
  pumpRatedPressureBar?: number | null;
  staticPressureBar?: number | null;
  residualPressureBar?: number | null;
  riserDiameterMm?: number | null;
  pipeMaterial?: 'BLACK_STEEL_WET' | 'BLACK_STEEL_DRY' | 'GALVANIZED' | 'CPVC_COPPER';
  cFactor?: number | null;
  hoseStreamAllowanceGpm?: number | null;
  supplyDurationMin?: number | null;
}

export interface FireDesignBuilding {
  id: number;
  code: string;
  name: string;
  companyName: string;
  unitId?: number | null;
  unitName: string;
  occupancyType: OccupancyType;
  nfpa13Edition: Nfpa13Edition;
  nfpa10Edition: Nfpa10Edition;
  floorsAboveGround: number;
  basementFloors: number;
  structureType: StructureType;
  ceilingType: CeilingType;
  storedMaterials: string;
  hazardNature: FireClass[];
  riskLevelOverride: 'AUTO' | HazardGroup;
  occupantLoad: number;
  activityType: string;
  waterSourceType?: WaterSourceType | null;
  waterSupply: WaterSupplyInput;
  currentSuppressionNotes?: string | null;
  status: 'DRAFT' | 'DESIGNED' | 'APPROVED';
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuildingDependencyCheck {
  buildingId: number;
  buildingName: string;
  buildingCode: string;
  buildingStatus: string;
  floorsCount: number;
  layoutsCount: number;
  approvedLayoutsCount: number;
  reviewedLayoutsCount: number;
  systemsCount: number;
  approvedSystemsCount: number;
  gapActionsCount: number;
  openGapActionsCount: number;
  linkedEquipmentCount: number;
  hasDependencies: boolean;
  hasApprovedProjects: boolean;
  canDelete: boolean;
  blockReasonFa: string | null;
  warningDetailFa: string | null;
}

export interface FloorSpaceZone {
  id: string;
  name: string;
  occupancyType: OccupancyType;
  areaSqm: number;
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
  hazardClasses: FireClass[];
  hasFalseCeiling: boolean;
  hasCriticalElectronics: boolean;
  sprinklerProtected: boolean;
}

export interface FloorObstacle {
  id: string;
  type: 'WALL' | 'BEAM' | 'COLUMN' | 'SHAFT' | 'PARTITION';
  label: string;
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
  blocksSprinkler: boolean;
  blocksTravel: boolean;
}

export interface CalibrationLine {
  x1Px: number;
  y1Px: number;
  x2Px: number;
  y2Px: number;
  realDistanceMeters: number;
}

export interface FireDesignFloor {
  id: number;
  buildingId: number;
  floorCode: string;
  floorLabel: string;
  floorOrder: number;
  isBasement: boolean;
  lengthM: number;
  widthM: number;
  ceilingHeightM: number;
  areaSqm: number;
  falseCeilingHeightM: number;
  beamDepthM: number;
  beamSpacingM: number;
  spaces: FloorSpaceZone[];
  obstacles: FloorObstacle[];
  floorPlanFileId?: string | null;
  floorPlanFileName?: string | null;
  floorPlanMimeType?: string | null;
  floorPlanWidthPx?: number | null;
  floorPlanHeightPx?: number | null;
  scaleMetersPerPixel?: number | null;
  calibrationLine?: CalibrationLine | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type PlacedItemKind =
  | 'SPRINKLER_PROPOSED'
  | 'SPRINKLER_EXISTING'
  | 'EXTINGUISHER_PROPOSED'
  | 'EXTINGUISHER_EXISTING'
  | 'RISER_VALVE'
  | 'CLEAN_AGENT_NOZZLE'
  | 'CLEAN_AGENT_CYLINDER'
  | 'HOSE_BOX'
  | 'HYDRANT_HOSE_PROPOSED'
  | 'HYDRANT_HOSE_EXISTING'
  | 'FOAM_MONITOR_PROPOSED'
  | 'FOAM_MONITOR_EXISTING'
  | 'DETECTOR_SMOKE'
  | 'DETECTOR_HEAT'
  | 'DETECTOR_GAS'
  | 'PULL_STATION'
  | 'HORN_STROBE'
  | 'FACP_PANEL';

export type FireSystemType =
  | 'SPRINKLER_NFPA13'
  | 'EXTINGUISHER_NFPA10'
  | 'STANDPIPE_HYDRANT_NFPA14'
  | 'FOAM_NFPA11'
  | 'CLEAN_AGENT_NFPA2001'
  | 'FIRE_ALARM_NFPA72'
  | 'PUMP_NFPA20'
  | 'TANK_NFPA22'
  | 'PUMP_TANK_NFPA20_22';

export type CoverageCellStatus = 'GREEN' | 'RED' | 'YELLOW' | 'GRAY';

export interface CoverageMapCell {
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
  status: CoverageCellStatus;
  reasonsFa: string[];
  nearestSprinklerM?: number | null;
  nearestExtinguisherM?: number | null;
  nearestHydrantM?: number | null;
  nearestDetectorM?: number | null;
}

export interface FireDesignSystemRecord {
  id: number;
  buildingId: number;
  floorId?: number | null;
  systemType: FireSystemType;
  standardCode: string;
  standardEdition: string;
  localCodeNotes?: string | null;
  designInputs: Record<string, any>;
  calculationOutput: Record<string, any>;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'NEEDS_REVIEW' | 'INCOMPLETE';
  designStage: 'PRELIMINARY' | 'REVIEWED' | 'APPROVED_ENGINEERING';
  version: number;
  isActive: boolean;
  updatedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  reviewNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FireDesignGapAction {
  id: number;
  buildingId: number;
  floorId?: number | null;
  actionCode: string;
  systemType: string;
  gapType: 'DEFICIT' | 'INCOMPATIBLE' | 'BLIND_SPOT' | 'MISPLACED' | 'HYDRAULIC_DEFICIT' | 'INSPECTION_DUE' | 'OTHER';
  title: string;
  description: string;
  riskPriority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  responsiblePerson?: string | null;
  dueDate?: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED';
  resolutionNotes?: string | null;
  createdBy?: string | null;
  resolvedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlacedSuppressionItem {
  id: string;
  kind: PlacedItemKind;
  systemType?: FireSystemType;
  origin: 'EXISTING' | 'PROPOSED';
  code: string;
  label: string;
  xM: number;
  yM: number;
  coverageRadiusM: number;
  agentType?: AgentType;
  fireClasses?: FireClass[];
  rating?: string;
  capacityLabel?: string;
  kFactor?: number;
  sprinklerHeadType?: string;
  mountingNote?: string;
  existingEquipmentId?: string;
  locked?: boolean;
}

export interface SprinklerConfigInput {
  headType?: 'PENDENT' | 'UPRIGHT' | 'SIDEWALL' | 'CONCEALED' | 'HIGH_TEMP_UPRIGHT' | 'ESFR';
  kFactor?: number;
  tempRatingC?: number;
  designDensityOverride?: number;
  remoteAreaSqftOverride?: number;
}

export interface ExtinguisherConfigInput {
  preferredCleanAgent?: 'CO2' | 'CLEAN_AGENT';
  preferHigherCapacity?: boolean;
  includeExistingInCoverage?: boolean;
}

export interface FireDesignLayout {
  id: number;
  buildingId: number;
  floorId: number;
  revision: number;
  nfpa13Edition: Nfpa13Edition;
  nfpa10Edition: Nfpa10Edition;
  sprinklerConfig: SprinklerConfigInput;
  extinguisherConfig: ExtinguisherConfigInput;
  placedItems: PlacedSuppressionItem[];
  calculationSnapshot: FloorCalculationResult;
  complianceSummary: ComplianceCheckItem[];
  status: 'DRAFT' | 'REVIEWED' | 'APPROVED';
  calculatedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  reviewNotes?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UncoveredZone {
  id: string;
  system: 'SPRINKLER' | 'EXTINGUISHER';
  xM: number;
  yM: number;
  widthM: number;
  heightM: number;
  areaSqm: number;
  reasonFa: string;
  severity: 'HIGH' | 'MEDIUM';
}

export interface ComplianceCheckItem {
  id: string;
  standard: 'NFPA 13' | 'NFPA 10';
  edition: string;
  clause: string;
  titleFa: string;
  status: 'PASS' | 'WARNING' | 'FAIL' | 'INCOMPLETE';
  detailFa: string;
}

export interface AgentCompatibilityDecision {
  fireClass: FireClass;
  zoneName: string;
  recommendedAgent: AgentType;
  recommendedLabelFa: string;
  recommendedCapacityFa: string;
  recommendedRating: string;
  forbiddenAgents: { agent: AgentType; labelFa: string; reasonFa: string }[];
  notesFa: string;
}

export interface EquipmentComparisonRow {
  categoryKey: string;
  categoryTitleFa: string;
  agentOrType: string;
  existingCount: number;
  requiredCount: number;
  deficitCount: number;
  surplusCount: number;
  incompatibleCount: number;
  incompatibleReasons: string[];
  status: 'ADEQUATE' | 'DEFICIT' | 'SURPLUS' | 'INCOMPATIBLE';
}

export interface HydraulicCalculationResult {
  applicable: boolean;
  standardRef: string;
  designDensityGpmSqft: number;
  designDensityMmMin: number;
  remoteAreaSqft: number;
  remoteAreaSqm: number;
  kFactor: number;
  flowPerHeadGpm: number;
  flowPerHeadLpm: number;
  operatingPressurePsi: number;
  operatingPressureBar: number;
  sprinklerDemandGpm: number;
  sprinklerDemandLpm: number;
  hoseStreamAllowanceGpm: number;
  hoseStreamAllowanceLpm: number;
  totalWaterDemandGpm: number;
  totalWaterDemandLpm: number;
  supplyDurationMin: number;
  requiredTankVolumeLiters: number;
  frictionLossBar: number;
  elevationLossBar: number;
  totalRequiredPressureBar: number;
  cFactorUsed: number;
  riserDiameterMm: number;
  sourceTypeUsed?: WaterSourceType;
  waterSupplyStatus: 'ADEQUATE' | 'INADEQUATE' | 'NEEDS_WATER_DATA';
  missingWaterFields: string[];
  tankCheckDetailFa: string;
  pumpCheckDetailFa: string;
}

export interface FloorCalculationResult {
  calculationStatus: 'COMPLETE' | 'PARTIAL_WATER_DATA' | 'INCOMPLETE_DATA';
  missingRequiredFields: string[];
  warnings: string[];
  nfpa13Edition: Nfpa13Edition;
  nfpa10Edition: Nfpa10Edition;
  hazardGroup: HazardGroup;
  hazardGroupLabelFa: string;
  hazardBasisCitation: string;
  detectedFireClasses: FireClass[];
  overallCompliancePercent?: number;
  sprinkler: {
    isRequiredOrRecommended: boolean;
    suppressionAlternativeNoteFa?: string;
    recommendedHeadType: string;
    recommendedHeadLabelFa: string;
    kFactor: number;
    tempRatingC: number;
    maxCoveragePerHeadSqm: number;
    maxSpacingM: number;
    minSpacingM: number;
    maxWallDistanceM: number;
    designSpacingXM: number;
    designSpacingYM: number;
    calculatedHeadCount: number;
    placedSprinklerCount: number;
    coveragePercent: number;
    overDensityConflicts?: number;
    obstructionAlerts: string[];
    hydraulics: HydraulicCalculationResult;
  };
  extinguisher: {
    maxTravelDistanceClassAM: number;
    maxTravelDistanceClassBM: number;
    maxAreaPerUnitClassASqm: number;
    recommendedPrimaryAgent: AgentType;
    requiredTotalCount: number;
    placedExtinguisherCount: number;
    coveragePercent: number;
    maxObservedTravelM: number;
    compatibilityMatrix: AgentCompatibilityDecision[];
    allocationByAgent: {
      agent: AgentType;
      labelFa: string;
      rating: string;
      capacityFa: string;
      requiredCount: number;
      mountingLocationFa: string;
    }[];
  };
  uncoveredZones: UncoveredZone[];
  comparisonRows: EquipmentComparisonRow[];
  complianceChecks: ComplianceCheckItem[];
  suggestedItems: PlacedSuppressionItem[];
  engineeringDisclaimerFa: string;
}

