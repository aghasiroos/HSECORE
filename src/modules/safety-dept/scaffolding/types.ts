import {
  ScaffoldChecklistResponseItem,
  ScaffoldChecklistTemplateItem,
  ScaffoldInspectionReason,
  ScaffoldPhotoItem,
  ScaffoldTagStatus,
  ScaffoldWorkflowStatus,
} from '../../../../shared/scaffolding/constants';

export * from '../../../../shared/scaffolding/constants';

export interface ScaffoldPermissionsMatrix {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canInspect: boolean;
  canApprove: boolean;
  canChangeTag: boolean;
  canReport: boolean;
  canDelete: boolean;
}

export interface ScaffoldPermitOption {
  id: number;
  permitNumber: string;
  permitType: string;
  title: string;
  location: string;
  areaName: string;
  unitId: number | null;
  unitName: string;
  equipmentName: string;
  contractorName: string;
  description: string;
  workOrderNumber: string;
  status: string;
}

export interface ScaffoldWorkRequestOption {
  id: number;
  workRequestNumber: string;
  workflowKey: string;
  entityType: string;
  title: string;
  status: string;
  requesterName: string;
  unitName: string;
  location: string;
  equipmentName: string;
  contractorName: string;
  description: string;
}

export interface ScaffoldOrgUnitOption {
  id: number | null;
  name: string;
  code?: string | null;
  area?: string | null;
}

export interface ScaffoldPersonnelOption {
  id: number;
  personnelCode: string;
  fullName: string;
  jobTitle?: string | null;
  departmentName?: string | null;
  contractorName?: string | null;
  employmentType?: string | null;
}

export interface ScaffoldRecord {
  id: number;
  scaffoldCode: string;
  requestDate: string;
  requestingUnit: string;
  orgUnitId?: number | null;
  installationLocation: string;
  areaName?: string | null;
  unitName?: string | null;
  equipmentName?: string | null;
  activityDescription: string;
  permitId?: number | null;
  permitNumber?: string | null;
  workRequestId?: number | null;
  workRequestNumber?: string | null;
  contractorName: string;
  erectorSupervisorName: string;
  inspectorPersonnelId?: number | null;
  inspectorPersonnelCode?: string | null;
  inspectorName: string;
  installationCompletedDate?: string | null;
  heightMeters: number;
  scaffoldType: string;
  notes?: string | null;
  beforePhotos: ScaffoldPhotoItem[];
  afterPhotos: ScaffoldPhotoItem[];
  workflowStatus: ScaffoldWorkflowStatus;
  tagStatus: ScaffoldTagStatus;
  tagIssuedAt?: string | null;
  tagValidUntil?: string | null;
  tagIssuedBy?: string | null;
  hasOpenDefects: boolean;
  hasCriticalDefect: boolean;
  openDefectsCount: number;
  criticalDefectsCount: number;
  latestInspectionId?: number | null;
  latestInspectionDate?: string | null;
  nextInspectionDueDate?: string | null;
  inspectionsCount: number;
  approvedBy?: string | null;
  approvedByUid?: string | null;
  approvedAt?: string | null;
  approvalComment?: string | null;
  createdByUid?: string | null;
  createdByName?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScaffoldInspectionRecord {
  id: number;
  scaffoldId: number;
  inspectionNumber: string;
  inspectionReason: ScaffoldInspectionReason;
  inspectionDate: string;
  inspectionTime?: string | null;
  nextDueDate?: string | null;
  inspectorPersonnelId?: number | null;
  inspectorPersonnelCode?: string | null;
  inspectorName: string;
  inspectorUid?: string | null;
  checklistItems: ScaffoldChecklistResponseItem[];
  totalItems: number;
  passedCount: number;
  failedCount: number;
  naCount: number;
  criticalDefectCount: number;
  complianceScore: number;
  overallResult: 'APPROVED_SAFE' | 'CONDITIONAL_YELLOW' | 'REJECTED_UNSAFE';
  recommendedTag: ScaffoldTagStatus;
  summaryNotes?: string | null;
  weatherCondition?: string | null;
  maxLoadCapacityKg?: number | null;
  inspectorSignature?: string | null;
  supervisorSignature?: string | null;
  createdAt: string;
}

export interface ScaffoldTagHistoryRecord {
  id: number;
  scaffoldId: number;
  inspectionId?: number | null;
  previousTag: string;
  newTag: ScaffoldTagStatus;
  previousWorkflowStatus?: string | null;
  newWorkflowStatus?: string | null;
  reason: string;
  validUntil?: string | null;
  changedByUid?: string | null;
  changedByName: string;
  changedByRole?: string | null;
  changedDateJalali: string;
  changedTime: string;
  createdAt: string;
}

export interface ScaffoldKpis {
  totalScaffolds: number;
  greenTagCount: number;
  yellowTagCount: number;
  redTagCount: number;
  pendingInspectionCount: number;
  openDefectsScaffoldsCount: number;
  openDefectsTotalItems: number;
  criticalDefectsScaffoldsCount: number;
  totalInspectionsPerformed: number;
}

export interface ScaffoldBootstrapData {
  nextScaffoldCode: string;
  todayJalali: string;
  defaultNextDueDate: string;
  permits: ScaffoldPermitOption[];
  workRequests: ScaffoldWorkRequestOption[];
  orgUnits: ScaffoldOrgUnitOption[];
  personnelList: ScaffoldPersonnelOption[];
  contractors: string[];
  checklistTemplate: ScaffoldChecklistTemplateItem[];
  permissions: ScaffoldPermissionsMatrix;
}

export interface ScaffoldDetailData {
  scaffold: ScaffoldRecord;
  inspections: ScaffoldInspectionRecord[];
  tagHistory: ScaffoldTagHistoryRecord[];
  linkedPermit: any | null;
  linkedWorkRequest: any | null;
  permissions: ScaffoldPermissionsMatrix;
}

export interface ScaffoldManagementReportData {
  generatedAtJalali: string;
  kpis: ScaffoldKpis;
  byUnit: Array<{ unit: string; total: number; green: number; yellow: number; red: number; openDefects: number }>;
  byContractor: Array<{ contractor: string; total: number; green: number; yellow: number; red: number; openDefects: number }>;
  items: ScaffoldRecord[];
}
