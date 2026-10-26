import { UnifiedInspectionTimingType, PeriodicIntervalType, InspectionAuditHistoryRecord } from '../../utils/inspectionScheduleHelper';

export type InspectionFrequency = 'DAILY' | 'PRE_OP' | 'POST_OP' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'BIANNUAL' | 'ANNUAL' | 'ADHOC';

export interface ChecklistSchedule {
  id: string;
  checklistTypeId: string;
  checklistTypeNameFa: string;
  title: string;
  frequency: InspectionFrequency;
  warningDaysBefore: number;
  lastInspectionDate?: string; // Jalali
  nextDueDate?: string; // Jalali
  status: 'VALID' | 'WARNING' | 'OVERDUE' | 'NOT_SCHEDULED';
  inspectorName: string;
  supervisorName?: string;
  hseManagerName?: string;
  site: string;
  unit: string;
  areaLocation: string;
  description?: string;
  historyIds: string[]; // references to OperationalSafetyInspection.id
  createdAt: string;
  updatedAt: string;
}

export interface SafetyChecklistItem {
  id: string;
  title: string;
  category: string;
  requirement: string;
  standardRef?: string; // e.g., OSHA 1910, ISO 45001, NFPA
  isRequired?: boolean;
  responseType?: 'verdict' | 'text' | 'number' | 'boolean';
  orderIndex?: number;
  isCustom?: boolean;
}

export type ChecklistItemVerdict = 'pass' | 'fail' | 'na' | 'warning' | null;

export interface SafetyAuditPhoto {
  id: string;
  url: string; // Base64 or remote URL
  caption?: string;
  fileName?: string;
  fileSize?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  itemId?: string; // If tied to a specific checklist item
}

export interface SafetyChecklistInspectionItem {
  itemId: string;
  title: string;
  category: string;
  requirement?: string;
  standardRef?: string;
  verdict: ChecklistItemVerdict;
  comment?: string;
  defectDescription?: string;
  correctiveAction?: string;
  responsiblePerson?: string;
  responsiblePersonCode?: string;
  dueDate?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  photoUrl?: string;
  photos?: SafetyAuditPhoto[];
  correctiveActionRequired?: boolean;
  previousVerdict?: ChecklistItemVerdict; // Verdict in previous audit cycle for comparison
  previousComment?: string; // Remarks from previous cycle
}

export interface OperationalSafetyInspection {
  id: string;
  checklistTypeId: string; // e.g. 'scaffolding', 'hot-work', 'confined-space', 'electrical', 'lifting', 'excavation', 'general-patrol', 'chemical', 'loto', 'working-at-height'
  checklistTypeNameFa: string;
  title: string;
  inspectionType: UnifiedInspectionTimingType; // 'PERIODIC' | 'PRE_OP' | 'POST_OP' | 'ADHOC'
  periodicInterval?: PeriodicIntervalType; // 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
  inspectionDate: string; // Jalali e.g. 1404/06/04
  inspectionTime: string; // e.g. 10:30
  nextInspectionDate?: string; // Auto-calculated (1 Month for PERIODIC) or manual
  relatedOperationId?: string; // Connected event/operation ID (especially for PRE_OP & POST_OP)
  relatedOperationTitle?: string; // Description/name of connected operation/event
  site: string; // e.g. رجال، پتروفن، سراج
  unit: string; // e.g. تعميرات، توليد، يوتيليتي
  areaLocation: string; // e.g. واحد 20 - پمپ روم الفین
  inspectorName: string;
  hseManagerName?: string;
  inspectorCode?: string;
  supervisorName?: string;
  supervisorCode?: string;
  hseManagerCode?: string;
  contractorName?: string;
  permitNumber?: string;
  // Machinery & Equipment Specifications (Auto-enabled for Mobile Crane, Forklift & Lifting Checklists)
  machineryType?: string; // e.g. جرثقیل متحرک بوم تلسکوپی / لیفتراک دیزلی / لیفتراک برقی / جرثقیل کفی
  machinerySpecs?: string; // مشخصات و مدل دستگاه (e.g. تادانو Tadano GR-500EX / کوماتسو FD30-17)
  machineryTonnage?: string; // تناژ و ظرفیت باربرداری مجاز (e.g. ۵۰ تن، ۲۵ تن، ۳ تن، ۵ تن)
  machineryTagNumber?: string; // شماره تگ / پلاک / شماره شناسایی دستگاه (e.g. CR-012, FL-004)
  status: 'COMPLETED' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'CLOSED';
  scorePercent: number; // 0 - 100%
  totalItems: number;
  passedCount: number;
  failedCount: number;
  warningCount: number;
  naCount: number;
  items: SafetyChecklistInspectionItem[];
  findingsSummary?: string;
  immediateActionsTaken?: string;
  recommendedCapa?: string;
  photos?: SafetyAuditPhoto[];
  signature?: string;
  createdAt: string;
  updatedAt: string;
  createdByUser?: string;
  parentScheduleId?: string;
  // Re-inspection & historical audit lineage fields
  isReinspection?: boolean;
  previousInspectionId?: string; // ID of the preceding inspection in the cycle (e.g. INSP-1404-001)
  rootInspectionId?: string; // ID of the first original inspection in this equipment's chain
  reinspectionCycle?: number; // Cycle count (e.g. 1 for initial, 2 for 2nd round, 3 for 3rd round)
  reinspectionNotes?: string;
  isArchivedCycle?: boolean; // Set to true when this checklist cycle is completed and superseded by a new re-inspection
  supersededByInspectionId?: string; // ID of the new inspection record (e.g. INSP-1404-002)
  completedCycleDate?: string;
  inspectionHistory?: InspectionAuditHistoryRecord[];
}

export interface SafetyChecklistTypeTemplate {
  id: string;
  titleFa: string;
  titleEn: string;
  categoryFa: string;
  iconName: string;
  descriptionFa: string;
  standardRef: string;
  defaultFrequency: string;
  isActive?: boolean;
  defaultItems: SafetyChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SafetyDepartmentSubItemConfig {
  key: string;
  titleFa: string;
  titleEn: string;
  group: 'checklists' | 'operations';
  enabled?: boolean;
  descriptionFa?: string;
}
