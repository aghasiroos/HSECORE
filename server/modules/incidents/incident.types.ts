export type IncidentType =
  | 'NEAR_MISS'
  | 'FIRST_AID'
  | 'MEDICAL_TREATMENT'
  | 'LOST_TIME_INJURY'
  | 'FATALITY'
  | 'ENVIRONMENTAL_SPILL'
  | 'FIRE_EXPLOSION'
  | 'PROPERTY_DAMAGE'
  | 'UNSAFE_ACT'
  | 'UNSAFE_CONDITION';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RhsF68RiskLevel = 'L' | 'M' | 'H' | 'E';

export type RhsF68WorkflowStage =
  | 'DRAFT'
  | 'HSE_HEAD_TRIAGE'
  | 'HSE_EXPERT_REVIEW'
  | 'ACTION_IN_PROGRESS'
  | 'HSE_FINAL_APPROVAL'
  | 'CLOSED'
  | 'RETURNED';

export interface CAPAItem {
  id: string;
  actionTitle?: string;
  description?: string;
  actionType?: 'CORRECTIVE' | 'PREVENTIVE';
  assignedTo?: string;
  responsiblePerson?: string;
  department?: string;
  assignedRole?: string;
  targetDate?: string;
  dueDate?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED' | 'Open' | 'In Progress' | 'Closed' | 'Overdue';
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface IncidentCreateRequest {
  title: string;
  incidentType: IncidentType | string;
  severity?: SeverityLevel | string;
  incidentDate: string;
  incidentTime?: string;
  reportDate?: string;
  location: string;
  exactLocation?: string;
  companyName?: string;
  department?: string;
  companyId?: number;
  departmentId?: number;
  unitId?: number;
  reporterName?: string;
  reporterPersonnelCode?: string;
  reporterJobTitle?: string;
  injuredPersonName?: string;
  injuredPersonCode?: string;
  description: string;
  immediateActions?: string;
  rootCauses?: any;
  capaActions?: CAPAItem[];
  attachedFileIds?: string[];
  isDraft?: boolean;
  referTargetType?: 'HSE_HEAD' | 'HSE_EXPERT';
  assignedExpertCode?: string;
  assignedExpertName?: string;
  assignedExpertJobTitle?: string;
  formVariant?: 'RHS-F68' | 'RHS-F28';
  rhsF68?: Record<string, any>;
  rhsF28?: Record<string, any>;
}
