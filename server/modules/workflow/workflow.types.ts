export type WorkflowStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'SIGNED'
  | 'CANCELLED';

export type WorkflowStepType =
  | 'REVIEW'
  | 'APPROVE'
  | 'SIGN'
  | 'APPROVE_SIGN'
  | 'NOTIFY';

export type StepStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'RETURNED'
  | 'SKIPPED';

export type WorkflowAction =
  | 'SUBMIT'
  | 'REVIEW'
  | 'APPROVE'
  | 'REJECT'
  | 'SIGN'
  | 'APPROVE_SIGN'
  | 'RETURN'
  | 'REASSIGN'
  | 'CANCEL';

export interface WorkflowStepDefinition {
  stepOrder: number;
  stepName: string;
  stepType: WorkflowStepType;
  assignedRole?: string;
  assignedDepartment?: string;
  assignedUserId?: number;
  assignedPersonnelCode?: string;
  deadlineHours?: number;
}

export interface WorkflowInstanceDTO {
  id: number;
  workflowKey: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  title: string;
  status: WorkflowStatus;
  currentStepOrder: number;
  priority: string;
  requesterId?: number;
  requesterName?: string;
  requesterPersonnelCode?: string;
  isLocked: boolean;
  version: number;
  deadline?: string;
  metadata?: any;
  startedAt: string;
  completedAt?: string;
  updatedAt: string;
  steps?: WorkflowStepDTO[];
  history?: WorkflowHistoryDTO[];
  signatures?: WorkflowSignatureDTO[];
}

export interface WorkflowStepDTO {
  id: number;
  instanceId: number;
  stepOrder: number;
  stepName: string;
  stepType: WorkflowStepType;
  assignedRole?: string;
  assignedDepartment?: string;
  assignedUserId?: number;
  assignedPersonnelCode?: string;
  status: StepStatus;
  deadline?: string;
  completedAt?: string;
  completedBy?: string;
  completedByRole?: string;
  comment?: string;
  metadata?: any;
  createdAt: string;
}

export interface WorkflowHistoryDTO {
  id: number;
  instanceId: number;
  stepId?: number;
  action: WorkflowAction;
  actorName: string;
  actorRole?: string;
  actorDepartment?: string;
  actorPersonnelCode?: string;
  comment?: string;
  signatureHash?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface WorkflowSignatureDTO {
  id: number;
  instanceId: number;
  stepId?: number;
  signerName: string;
  signerRole: string;
  signerPersonnelCode?: string;
  signerDepartment?: string;
  signatureType: string;
  signatureData?: string;
  verificationCode: string;
  signedAt: string;
  ipAddress?: string;
}

export interface CreateWorkflowInstanceRequest {
  workflowKey: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  title: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  requesterName?: string;
  requesterPersonnelCode?: string;
  deadline?: string;
  metadata?: any;
  steps: WorkflowStepDefinition[];
}

export interface ExecuteWorkflowActionRequest {
  action: WorkflowAction;
  comment?: string;
  signatureData?: string; // Base64 or drawing
  targetAssignee?: {
    userId?: number;
    personnelCode?: string;
    role?: string;
    department?: string;
  };
}
