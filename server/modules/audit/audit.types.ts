export interface AuditLogEntry {
  id?: number;
  userId?: number;
  userUid?: string;
  personnelCode?: string;
  action: string; // CREATE, UPDATE, DELETE, SIGN, EXPORT, LOGIN, APPROVE, REJECT, DEPLOY, SIMULATE
  module: string; // PTW, INCIDENTS, HEALTH, PERSONNEL, WORKFLOW, USERS, SETTINGS, BPMN, SYSTEM
  entityType: string; // WORK_PERMIT, INCIDENT, MEDICAL_EXAM, PERSONNEL, USER, SYSTEM_SETTING, etc.
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  result?: 'SUCCESS' | 'FAILED' | 'WARNING';
  createdAt?: string | Date;
}
