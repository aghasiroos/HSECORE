export type RiskMethod = 'JSA' | 'FMEA' | 'FTA' | 'HHA';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BaseRiskAssessment {
  id: string;
  code: string; // e.g. JSA-1404-001
  title: string;
  site: string;
  unit: string;
  areaLocation: string;
  assessorName: string;
  assessmentDate: string; // Jalali e.g. 1404/06/05
  teamMembers?: string[];
  status: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'ARCHIVED';
  approverName?: string;
  hseEngineerName?: string;
  method: RiskMethod;
  overallRiskLevel: RiskLevel;
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
  initialProbability: number; // 1-5
  initialSeverity: number; // 1-5
  initialRiskScore: number; // P * S
  initialRiskLevel: RiskLevel;
  hierarchyControl: 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE';
  controlMeasures: string;
  residualProbability: number; // 1-5
  residualSeverity: number; // 1-5
  residualRiskScore: number; // P * S
  residualRiskLevel: RiskLevel;
  actionOwner?: string;
  actionDeadline?: string;
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
  itemFunction: string; // آیتم / کارکرد تجهیز
  failureMode: string; // حالت بالقوه خرابی
  failureEffects: string; // اثرات خرابی بر ایمنی و فرآیند
  severity: number; // S (1-10)
  causesOfFailure: string; // علل وقوع خرابی
  occurrence: number; // O (1-10)
  currentControls: string; // کنترل‌های جاری / روش کشف
  detection: number; // D (1-10)
  rpn: number; // S * O * D (1-1000)
  rpnLevel: RiskLevel;
  recommendedActions: string;
  responsibility: string;
  targetDate: string;
  revisedSeverity?: number;
  revisedOccurrence?: number;
  revisedDetection?: number;
  revisedRpn?: number;
  revisedRpnLevel?: RiskLevel;
}

export interface FmeaAssessment extends BaseRiskAssessment {
  method: 'FMEA';
  equipmentTag: string; // e.g. P-101A
  systemName: string; // e.g. سیستم هیدرولیک و پمپاژ
  rows: FmeaRowItem[];
}

// 3. FTA (Fault Tree Analysis)
export interface FtaEventNode {
  id: string;
  parentId?: string | null;
  type: 'TOP_EVENT' | 'INTERMEDIATE_EVENT' | 'BASIC_EVENT' | 'UNDEVELOPED_EVENT';
  gateType?: 'AND' | 'OR' | 'VOTING' | 'INHIBIT' | null;
  description: string;
  probability?: number; // 0.0 to 1.0 (e.g. 0.005)
  code?: string; // G1, E1, etc.
}

export interface FtaAssessment extends BaseRiskAssessment {
  method: 'FTA';
  topEventTitle: string; // e.g. آتش‌سوزی در مخزن ذخیره نفت خام TK-102
  topEventProbability?: number;
  nodes: FtaEventNode[];
}

// 4. HHA (Health Hazard Assessment / بهداشت حرفه‌ای)
export interface HhaItem {
  id: string;
  jobRole: string; // عنوان شغلی
  workplaceArea: string; // بخش یا کارگاه
  hazardCategory: 'CHEMICAL' | 'PHYSICAL' | 'BIOLOGICAL' | 'ERGONOMIC' | 'PSYCHOSOCIAL';
  agentName: string; // e.g. بنزن، سر و صدا، گرد و غبار، ارتعاش
  exposureRoute: 'INHALATION' | 'DERMAL' | 'INGESTION' | 'EYE' | 'ACOUSTIC' | 'WHOLE_BODY';
  exposureDuration: string; // e.g. 6 ساعت در روز
  measuredLevel?: string; // e.g. 88 dBA, 1.2 ppm
  standardOel?: string; // e.g. 85 dBA (OEL/TLV)
  healthEffect: string; // عوارض حاد و مزمن
  riskRating: RiskLevel;
  existingControls: string;
  proposedControls: string;
  targetMedicalTests: string; // آزمایش‌های اختصاصی طب کار (اسپیرومتری، اودیوگرام و ...)
}

export interface HhaAssessment extends BaseRiskAssessment {
  method: 'HHA';
  assessedDepartment: string;
  headcountExposed: number;
  items: HhaItem[];
}

export type AnyRiskAssessment = 
  | JsaAssessment 
  | FmeaAssessment 
  | FtaAssessment 
  | HhaAssessment;
