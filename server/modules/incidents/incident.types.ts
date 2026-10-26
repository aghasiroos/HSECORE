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

export interface CAPAItem {
  id: string;
  actionTitle: string;
  actionType: 'CORRECTIVE' | 'PREVENTIVE';
  assignedTo: string;
  assignedRole?: string;
  dueDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface IncidentCreateRequest {
  title: string;
  incidentType: IncidentType;
  severity: SeverityLevel;
  incidentDate: string;
  location: string;
  companyId?: number;
  departmentId?: number;
  unitId?: number;
  reporterName?: string;
  reporterPersonnelCode?: string;
  injuredPersonName?: string;
  injuredPersonCode?: string;
  description: string;
  immediateActions?: string;
  rootCauses?: string[];
  capaActions?: CAPAItem[];
  attachedFileIds?: string[];
}
