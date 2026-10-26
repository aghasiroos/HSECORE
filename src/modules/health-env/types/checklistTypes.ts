import { SafetyAuditPhoto } from '../../safety-dept/types';

export type HealthEnvChecklistType = 
  | 'premises-buildings'
  | 'pantries-kitchenettes'
  | 'restaurant-dining'
  | 'ambulance-equipment'
  | 'workshop-restrooms'
  | (string & {});

export type HealthEnvChecklistItemVerdict = 'pass' | 'fail' | 'na';
export type ChecklistItemVerdict = HealthEnvChecklistItemVerdict;

export interface HealthEnvChecklistItem {
  id: string;
  title: string;
  category: string;
  requirement: string;
  standardRef?: string;
  isCustom?: boolean;
  isRequired?: boolean;
  orderIndex?: number;
  responseType?: 'verdict' | 'score' | 'text' | 'checkbox';
}

export interface HealthEnvChecklistInspectionItem {
  itemId: string;
  title: string;
  category: string;
  requirement?: string;
  standardRef?: string;
  verdict: HealthEnvChecklistItemVerdict | null;
  comment?: string;
  defectDescription?: string;
  correctiveAction?: string;
  responsiblePerson?: string;
  responsiblePersonCode?: string;
  dueDate?: string; // تاریخ مهلت رفع نقص (شمسی)
  photoUrl?: string;
  photos?: SafetyAuditPhoto[];
}

export type HealthEnvApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type HealthEnvInspectionStatus = 'COMPLETED' | 'IN_PROGRESS' | 'ACTION_REQUIRED' | 'CLOSED';

// زمان‌بندی: دوره‌ای یا موردی
export type HealthEnvScheduleType = 'PERIODIC' | 'ADHOC';
// دوره‌های تناوب: روزانه، ماهانه، سه‌ماهه، شش‌ماهه، سالانه
export type HealthEnvPeriodicInterval = 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

export interface HealthEnvAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  mimeType: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
  uploadedBy?: string;
  description?: string;
}

export interface HealthEnvApprovalLog {
  id: string;
  step: 'SUBMITTED' | 'SUPERVISOR_REVIEW' | 'MANAGER_APPROVAL' | 'REJECTED' | 'REFERRED' | 'SIGNED';
  actionBy: string;
  role: string;
  timestamp: string; // ISO or Jalali
  comment?: string;
}

export interface HealthEnvInspection {
  id: string;
  checklistTypeId: HealthEnvChecklistType;
  checklistTypeNameFa: string;
  title: string;
  inspectionDate: string; // تاریخ شمسی e.g. 1404/07/15
  inspectionTime: string; // e.g. 10:30
  site: string; // سایت/محل
  unit: string; // واحد/اداره
  areaLocation: string; // موقعیت دقیق / نام ساختمان / پلاک
  equipmentOrFacilityCode?: string; // پلاک آمبولانس / کد ساختمان / شناسه محل
  inspectorName: string;
  inspectorCode?: string;
  supervisorName?: string;
  supervisorCode?: string;
  hseManagerName?: string;
  hseManagerCode?: string;
  status: HealthEnvInspectionStatus;
  approvalStatus: HealthEnvApprovalStatus;
  approvalLogs?: HealthEnvApprovalLog[];
  approvalNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  scorePercent: number; // 0 - 100%
  totalItems: number;
  passedCount: number;
  failedCount: number;
  naCount: number;
  items: HealthEnvChecklistInspectionItem[];
  findingsSummary?: string;
  immediateActionsTaken?: string;
  recommendedCapa?: string;
  photos?: SafetyAuditPhoto[];
  
  // زمان‌بندی چک‌لیست
  scheduleType?: HealthEnvScheduleType; // 'PERIODIC' یا 'ADHOC'
  periodicInterval?: HealthEnvPeriodicInterval; // 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
  nextInspectionDate?: string; // تاریخ سررسید بعدی (شمسی)
  
  // پیوست فایل‌ها (عکس و PDF)
  attachments?: HealthEnvAttachment[];
  
  // ارجاع و امضا
  referralId?: string; // شناسه گردش کار ارجاع
  inspectorSignature?: string;
  supervisorSignature?: string;
  hseManagerSignature?: string;
  
  createdAt: string;
  updatedAt: string;
  createdByUser?: string;
}

export interface HealthEnvChecklistTypeTemplate {
  id: HealthEnvChecklistType;
  titleFa: string;
  titleEn: string;
  categoryFa: string;
  iconName: string;
  descriptionFa: string;
  standardRef: string;
  defaultFrequency: string;
  defaultScheduleType?: HealthEnvScheduleType;
  defaultPeriodicInterval?: HealthEnvPeriodicInterval;
  defaultItems: HealthEnvChecklistItem[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
