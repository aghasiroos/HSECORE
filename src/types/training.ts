export type TrainingRecordStatus = 'completed' | 'assigned' | 'in_progress' | 'expired';

export interface TrainingCourseRecord {
  id: string;
  firstName: string;
  lastName: string;
  personnelCode: string;
  unit: string;
  jobTitle: string;
  courseCode: string;
  courseTitle?: string;
  hours: number;
  date?: string; // Jalali completion date YYYY/MM/DD
  status?: TrainingRecordStatus;
  dueDate?: string; // Jalali deadline YYYY/MM/DD
  assignedDate?: string; // Jalali date YYYY/MM/DD
  assignedAt?: string; // ISO timestamp
  assignedBy?: string;
  assignedByCode?: string;
  assignmentBatchId?: string;
  assignmentSource?: 'manual' | 'bulk_job_title';
  isRenewalOverride?: boolean;
  overrideReason?: string;
  calendarEventId?: string;
  completedBy?: string;
  completedAt?: string;
}

export interface TrainingCourseDef {
  id: string;
  code: string;
  title: string;
  duration: number;
}

export interface TrainingNeed {
  id: string;
  unit: string;
  jobTitle: string;
  courseCodes: string[];
}

export interface TrainingCalendarEvent {
  id: string;
  courseCode: string;
  title: string;
  duration: number;
  date: string;
  time?: string;
  assignmentBatchId?: string;
  targetJobTitle?: string;
  targetUnit?: string;
  assignedCount?: number;
}

export interface TrainingBulkAssignRequest {
  jobTitle: string;
  unitFilter?: string;
  employmentStatusFilter?: 'all' | 'active' | 'inactive';
  personnelCodes: string[];
  courseCodes: string[];
  dueDate?: string;
  linkToCalendar?: boolean;
  calendarDate?: string;
  calendarTime?: string;
  allowRenewalOverride?: boolean;
  overrideReason?: string;
}

export interface TrainingBulkAssignItemResult {
  personnelCode: string;
  fullName: string;
  unit: string;
  jobTitle: string;
  courseCode: string;
  courseTitle: string;
  outcome: 'succeeded' | 'duplicate' | 'failed';
  reasonCode?: 'ACTIVE_ASSIGNMENT' | 'ALREADY_COMPLETED' | 'PERSONNEL_NOT_FOUND' | 'COURSE_NOT_FOUND' | 'INACTIVE_FILTERED' | 'RENEWAL_OVERRIDE';
  message: string;
  existingDate?: string;
  existingDueDate?: string;
  recordId?: string;
  calendarEventId?: string;
}

export interface TrainingBulkAssignmentBatch {
  batchId: string;
  assignedDate: string;
  assignedAt: string;
  assignedBy: string;
  assignedByCode?: string;
  jobTitle: string;
  unitFilter?: string;
  employmentStatusFilter?: 'all' | 'active' | 'inactive';
  courseCodes: string[];
  courseTitles: string[];
  dueDate?: string;
  linkedToCalendar: boolean;
  calendarDate?: string;
  calendarTime?: string;
  calendarEventIds?: string[];
  allowRenewalOverride: boolean;
  overrideReason?: string;
  targetPersonnelCount: number;
  totalRequested: number;
  succeededCount: number;
  duplicateCount: number;
  failedCount: number;
  assignedPersonnel: Array<{
    personnelCode: string;
    fullName: string;
    unit: string;
    courseCodes: string[];
  }>;
}

export interface TrainingBulkAssignResponse {
  batchId: string;
  assignedDate: string;
  assignedAt: string;
  assignedBy: string;
  summary: {
    targetPersonnelCount: number;
    coursesCount: number;
    totalRequested: number;
    succeeded: number;
    skippedDuplicates: number;
    failed: number;
    calendarEventsLinked: number;
  };
  succeededItems: TrainingBulkAssignItemResult[];
  duplicateItems: TrainingBulkAssignItemResult[];
  failedItems: TrainingBulkAssignItemResult[];
  batchRecord: TrainingBulkAssignmentBatch;
  updatedCourses: TrainingCourseRecord[];
  updatedCalendarEvents: TrainingCalendarEvent[];
}

// ============================================================================
// Contractor Companies & Individual Personnel Training Analytics Types
// ============================================================================

export interface ContractorCompany {
  id: string;
  name: string;
  normalizedKey: string;
  createdAt: string;
  createdBy?: string;
}

export interface ContractorTrainingRecord {
  id: string;
  companyId: string;
  companyName: string;
  personnelFullName: string;
  jobTitle: string;
  trainingHours: number; // Hours per person for this training entry (ساعت/نفر)
  trainingDate: string; // Jalali YYYY/MM/DD
  courseTitle?: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ContractorPersonnelDetail {
  personKey: string;
  fullName: string;
  jobTitles: string[];
  recordsCount: number;
  totalHours: number;
  dates: string[];
  records: ContractorTrainingRecord[];
}

export interface ContractorCompanyAggregate {
  companyId: string;
  companyName: string;
  normalizedKey: string;
  uniquePersonnelCount: number;
  recordsCount: number;
  totalHours: number;
  averagePerCapitaHours: number; // totalHours / uniquePersonnelCount
  lastTrainingDate: string;
  personnelDetails: ContractorPersonnelDetail[];
  records: ContractorTrainingRecord[];
}

export interface ContractorTrainingGlobalStats {
  totalCompanies: number;
  totalUniquePersonnel: number;
  totalRecords: number;
  totalHours: number;
  averagePerCapitaHours: number;
}

export interface ContractorTrainingAuditEntry {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  recordId: string;
  companyName: string;
  personnelFullName: string;
  actorName: string;
  actorRole?: string;
  timestamp: string;
  dateFa: string;
  summary: string;
  before?: Partial<ContractorTrainingRecord>;
  after?: Partial<ContractorTrainingRecord>;
}

export interface LegacyContractorSummary {
  id: string;
  name: string;
  headcount: number;
  perCapita: number;
  totalHours?: number;
  recordsCount?: number;
  source?: 'individual_records' | 'legacy';
}

export interface ContractorTrainingPayload {
  records: ContractorTrainingRecord[];
  companies: ContractorCompany[];
  auditHistory: ContractorTrainingAuditEntry[];
  syncedContractors: LegacyContractorSummary[];
}

