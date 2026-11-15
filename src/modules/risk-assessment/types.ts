export type RiskMethod =
  | 'FMEA'
  | 'JSA'
  | 'FTA'
  | 'HHA'
  | 'WHAT_IF'
  | 'BOWTIE'
  | 'MATRIX'
  | 'JOB_ACTIVITY';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RiskAssessmentStatus = 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'ARCHIVED';

export type RiskWorkflowStage =
  | 'DRAFT_NEW'
  | 'INITIAL_INFO'
  | 'HAZARD_ID'
  | 'RISK_ANALYSIS'
  | 'CONTROL_MEASURES'
  | 'OWNER_DEADLINE'
  | 'REVIEW_APPROVAL'
  | 'ACTION_EXECUTION'
  | 'RESIDUAL_REEVALUATION'
  | 'EFFECTIVENESS_ARCHIVE';

export interface RiskActionItem {
  id: string;
  title: string;
  hierarchyControl: 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE';
  owner: string;
  ownerPersonnelCode?: string;
  deadline: string; // Jalali YYYY/MM/DD
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'VERIFIED' | 'OVERDUE';
  evidenceNotes?: string;
  evidenceAttachmentName?: string;
  completedAtJalali?: string;
  effectivenessVerified?: boolean;
  effectivenessNotes?: string;
  nonConformanceId?: string | number;
  nonConformanceCode?: string;
}

export interface RiskReviewRecord {
  id: string;
  timestamp: string;
  persianDate?: string;
  actor: string;
  actorRole?: string;
  fromStatus?: string;
  toStatus: string;
  fromStage?: string;
  toStage?: string;
  notes?: string;
}

export interface LinkedHseContext {
  permitNumber?: string;
  permitTitle?: string;
  equipmentTag?: string;
  equipmentName?: string;
  incidentNumber?: string;
  incidentTitle?: string;
  inspectionId?: string;
  inspectionTitle?: string;
  contractorName?: string;
  contractorId?: string;
}

export interface BaseRiskAssessment {
  id: string;
  dbId?: number;
  code: string;
  title: string;
  site: string;
  unit: string;
  unitId?: number | null;
  areaLocation: string;
  assessorName: string;
  assessmentDate: string; // Jalali YYYY/MM/DD
  teamMembers?: string[];
  contractorName?: string;
  contractorId?: string;
  status: RiskAssessmentStatus;
  workflowStage?: RiskWorkflowStage;
  approverName?: string;
  method: RiskMethod;
  overallRiskLevel: RiskLevel;
  initialRiskScore?: number;
  residualRiskScore?: number;
  residualRiskLevel?: RiskLevel;
  controlActions?: RiskActionItem[];
  reviewHistory?: RiskReviewRecord[];
  linkedRefs?: LinkedHseContext;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 1. JSA (Job Safety Analysis)
export interface JsaStepItem {
  id: string;
  stepNumber: number;
  taskDescription: string;
  hazards: string;
  potentialConsequences: string;
  existingControls?: string;
  initialProbability: number;
  initialSeverity: number;
  initialRiskScore: number;
  initialRiskLevel: RiskLevel;
  hierarchyControl: 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE';
  controlMeasures: string;
  residualProbability: number;
  residualSeverity: number;
  residualRiskScore: number;
  residualRiskLevel: RiskLevel;
  actionOwner?: string;
  actionDeadline?: string;
  actionStatus?: RiskActionItem['status'];
  evidenceNotes?: string;
}

export interface JsaAssessment extends BaseRiskAssessment {
  method: 'JSA';
  jobTitle: string;
  permitRefNumber?: string;
  requiredPpe: string[];
  steps: JsaStepItem[];
}

// 2. FMEA (Failure Mode and Effects Analysis)
export interface FmeaRowItem {
  id: string;
  itemFunction: string;
  failureMode: string;
  failureEffects: string;
  severity: number; // S (1-10)
  causesOfFailure: string;
  occurrence: number; // O (1-10)
  currentControls: string;
  detection: number; // D (1-10)
  rpn: number; // S * O * D (1-1000)
  rpnLevel: RiskLevel;
  recommendedActions: string;
  responsibility: string;
  targetDate: string;
  actionStatus?: RiskActionItem['status'];
  evidenceNotes?: string;
  revisedSeverity?: number;
  revisedOccurrence?: number;
  revisedDetection?: number;
  revisedRpn?: number;
  revisedRpnLevel?: RiskLevel;
}

export interface FmeaAssessment extends BaseRiskAssessment {
  method: 'FMEA';
  equipmentTag: string;
  systemName: string;
  rows: FmeaRowItem[];
}

// 3. FTA (Fault Tree Analysis - preserved 100%)
export interface FtaEventNode {
  id: string;
  parentId?: string | null;
  type: 'TOP_EVENT' | 'INTERMEDIATE_EVENT' | 'BASIC_EVENT' | 'UNDEVELOPED_EVENT';
  gateType?: 'AND' | 'OR' | 'VOTING' | 'INHIBIT' | null;
  votingThreshold?: number;
  description: string;
  probability?: number; // 0.0 to 1.0
  computedProbability?: number;
  code?: string;
}

export interface FtaAssessment extends BaseRiskAssessment {
  method: 'FTA';
  topEventTitle: string;
  topEventProbability?: number;
  nodes: FtaEventNode[];
}

// 4. HHA (Health Hazard Assessment + Human Error / Human Factors Analysis)
export type HumanErrorType =
  | ''
  | 'INATTENTION'
  | 'DECISION_ERROR'
  | 'SKILL_GAP'
  | 'PROCEDURE_VIOLATION'
  | 'ENVIRONMENTAL_HEALTH_FACTOR';

export interface HhaItem {
  id: string;
  jobRole: string;
  workplaceArea: string;
  analysisDomain?: 'OCCUPATIONAL_HEALTH' | 'HUMAN_FACTORS' | 'COMBINED';
  hazardCategory: 'CHEMICAL' | 'PHYSICAL' | 'BIOLOGICAL' | 'ERGONOMIC' | 'PSYCHOSOCIAL' | 'HUMAN_ERROR';
  agentName: string;
  exposureRoute: 'INHALATION' | 'DERMAL' | 'INGESTION' | 'EYE' | 'ACOUSTIC' | 'WHOLE_BODY' | 'COGNITIVE_TASK';
  exposureDuration: string;
  measuredLevel?: string;
  standardOel?: string;
  healthEffect: string;
  riskRating: RiskLevel;
  existingControls: string;
  proposedControls: string;
  targetMedicalTests: string;
  // Human Error & Human Factors extensions
  errorType?: HumanErrorType;
  performanceShapingFactors?: string;
  organizationalConditions?: string;
  preventiveBarriers?: string;
  trainingActions?: string;
  // Quantitative initial & residual P x S
  initialProbability?: number;
  initialSeverity?: number;
  initialRiskScore?: number;
  residualProbability?: number;
  residualSeverity?: number;
  residualRiskScore?: number;
  residualRiskLevel?: RiskLevel;
  actionOwner?: string;
  actionDeadline?: string;
}

export interface HhaAssessment extends BaseRiskAssessment {
  method: 'HHA';
  assessedDepartment: string;
  headcountExposed: number;
  items: HhaItem[];
}

// 5. WHAT_IF Analysis
export interface WhatIfQuestionItem {
  id: string;
  question: string;
  expertAnswer: string;
  hazards: string;
  consequences: string;
  existingControls: string;
  initialProbability: number;
  initialSeverity: number;
  initialRiskScore: number;
  initialRiskLevel: RiskLevel;
  recommendations: string;
  responsible: string;
  deadline: string;
  status: RiskActionItem['status'];
  evidenceNotes?: string;
  residualProbability: number;
  residualSeverity: number;
  residualRiskScore: number;
  residualRiskLevel: RiskLevel;
}

export interface WhatIfAssessment extends BaseRiskAssessment {
  method: 'WHAT_IF';
  studyScope: string;
  processSubject: string;
  questions: WhatIfQuestionItem[];
}

// 6. BOWTIE Analysis
export interface BowTieEscalationFactor {
  id: string;
  title: string;
  controlMeasure: string;
  owner?: string;
}

export interface BowTieBarrier {
  id: string;
  title: string;
  barrierType: 'ENGINEERING' | 'PROCEDURAL' | 'DETECTIVE' | 'PPE' | 'EMERGENCY_RESPONSE';
  owner: string;
  effectiveness: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'ACTIVE' | 'DEGRADED' | 'FAILED';
  escalationFactors: BowTieEscalationFactor[];
}

export interface BowTieThreat {
  id: string;
  title: string;
  likelihood: number; // 1-5
  barriers: BowTieBarrier[];
}

export interface BowTieConsequence {
  id: string;
  title: string;
  severity: number; // 1-5
  category: 'SAFETY' | 'HEALTH' | 'ENVIRONMENT' | 'ASSET';
  barriers: BowTieBarrier[];
}

export interface BowTieDiagramData {
  hazard: string;
  topEvent: string;
  threats: BowTieThreat[];
  consequences: BowTieConsequence[];
}

export interface BowTieAssessment extends BaseRiskAssessment {
  method: 'BOWTIE';
  bowtie: BowTieDiagramData;
}

// 7. MATRIX Snapshot / Configuration
export interface MatrixAxisScaleItem {
  value: number;
  labelFa: string;
  labelEn: string;
  descriptionFa: string;
}

export interface MatrixThresholdBand {
  level: RiskLevel;
  minScore: number;
  maxScore: number;
  labelFa: string;
  labelEn: string;
  colorHex: string;
  acceptabilityFa: string;
  requiredActionFa: string;
}

export interface RiskMatrixConfig {
  id: string;
  nameFa: string;
  standardRef: string;
  probabilityScale: MatrixAxisScaleItem[];
  severityScale: MatrixAxisScaleItem[];
  thresholds: MatrixThresholdBand[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface MatrixAssessment extends BaseRiskAssessment {
  method: 'MATRIX';
  matrixConfigId?: string;
}

// 8. JOB_ACTIVITY (ارزیابی ریسک فعالیتها و مشاغل)
export interface JobActivityHazardItem {
  id: string;
  hazardCategory: 'SAFETY' | 'HEALTH' | 'ENVIRONMENT' | 'ERGONOMIC';
  hazardTitle: string;
  exposureCondition: string;
  consequence: string;
  existingControls: string;
  initialProbability: number;
  initialSeverity: number;
  initialScore: number;
  initialLevel: RiskLevel;
  hierarchyControl: 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE';
  controlMeasures: string;
  actionOwner: string;
  actionDeadline: string;
  actionStatus: RiskActionItem['status'];
  evidenceNotes?: string;
  residualProbability: number;
  residualSeverity: number;
  residualScore: number;
  residualLevel: RiskLevel;
}

export interface JobActivityAssessment extends BaseRiskAssessment {
  method: 'JOB_ACTIVITY';
  jobPosition: string;
  exposedPersonnel: string[];
  reviewCycleMonths: number;
  nextReviewDate: string;
  hazardsList: JobActivityHazardItem[];
}

export type AnyRiskAssessment =
  | JsaAssessment
  | FmeaAssessment
  | FtaAssessment
  | HhaAssessment
  | WhatIfAssessment
  | BowTieAssessment
  | MatrixAssessment
  | JobActivityAssessment;
