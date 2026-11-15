export interface AuditLogEntry {
  id?: number;
  userId?: number;
  userUid?: string;
  personnelCode?: string;
  username?: string;
  fullName?: string;
  userRole?: string;
  action: string; // CREATE, UPDATE, DELETE, SIGN, EXPORT, LOGIN, APPROVE, REJECT, DEPLOY, SIMULATE, SOFT_DELETE, etc.
  module: string; // PTW, INCIDENTS, HEALTH, PERSONNEL, WORKFLOW, USERS, SETTINGS, BPMN, FIRE_DESIGN, PSM, ORGANIZATION, SYSTEM
  entityType: string; // WORK_PERMIT, INCIDENT, MEDICAL_EXAM, PERSONNEL, USER, SYSTEM_SETTING, BUILDING, etc.
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  result?: 'SUCCESS' | 'FAILED' | 'WARNING';
  createdAt?: string | Date;
}

export interface AuditLogFilterQuery {
  page?: number;
  limit?: number;
  search?: string;
  module?: string;
  actionType?: string;
  result?: string;
  user?: string;
  from?: string;
  to?: string;
}

export interface PaginatedAuditResult {
  rows: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
