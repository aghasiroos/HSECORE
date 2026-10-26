export type AssigneeType = 'user' | 'role' | 'department';
export type ApprovalLogic = 'all' | 'any' | 'sequential'; // همه افراد | یکی از افراد | به ترتیب

export interface WorkflowApprover {
  id: string;
  username: string;
  fullName: string;
  jobTitle: string;
  department: string;
  role: string;
  accountStatus: 'Active' | 'Inactive' | 'Suspended' | 'Locked' | string;
  personnelNumber?: string;
}

export interface WorkflowStep {
  id: string;
  titleFa: string;
  titleEn: string;
  assignedRole: string; // Fallback / Primary role
  actionType: 'form' | 'approval' | 'inspection' | 'test' | 'signature' | 'notification';
  slaHours: number;

  // Rich Assignee Definition
  assigneeType?: AssigneeType; // 'user' | 'role' | 'department'
  assignedRoleName?: string;
  assignedUserIds?: string[];
  assignedUsers?: WorkflowApprover[];
  assignedDepartment?: string;
  assignedDepartmentId?: string;
  
  // Multi-approver logic
  approvalLogic?: ApprovalLogic; // 'all' | 'any' | 'sequential'
  
  // Status check & substitute handling
  requiresSubstitute?: boolean;
  substituteReason?: string;
}

export interface WorkflowItem {
  id: string;
  name: string;
  module_type: string;
  category: 'safety' | 'operations' | 'health' | 'fire' | 'training' | 'audit' | 'environment';
  descriptionFa: string;
  descriptionEn?: string;
  version: number;
  is_active: boolean;
  slaHours: number;
  roles: string[];
  steps: WorkflowStep[];
  xml_data?: string;
  createdAt?: string;
  activeInstancesCount?: number;
  totalInstancesCount?: number;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  moduleType: string;
  entityId?: string;
  title: string;
  initiator: string;
  initiatorName: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  state: 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'SUSPENDED';
  currentStepIndex: number;
  currentStepId: string;
  currentStepTitleFa: string;
  currentStepRole: string;
  variables: Record<string, any>;
  history: {
    stepId: string;
    stepTitleFa: string;
    action: 'START' | 'APPROVE' | 'REJECT' | 'RETURN' | 'DELEGATE' | 'COMMENT' | 'SUBSTITUTE';
    actor: string;
    actorName: string;
    comments?: string;
    timestamp: string;
  }[];
  startedAt: string;
  updatedAt: string;
  dueDate: string;
}

export interface WorkflowTask {
  id: string;
  instanceId: string;
  workflowId: string;
  workflowName: string;
  moduleType: string;
  title: string;
  stepId: string;
  stepTitleFa: string;
  stepTitleEn: string;
  assignedRole: string;
  
  // Assignee information
  assigneeType?: AssigneeType;
  assignee?: string; // username
  assigneeName?: string; // full name
  assigneeId?: string;
  assignedDepartment?: string;
  candidateUserIds?: string[];
  candidateUsers?: WorkflowApprover[];

  // Multi-approver progress
  approvalLogic?: ApprovalLogic; // 'all' | 'any' | 'sequential'
  approvedUserIds?: string[];
  approvedUserNames?: string[];
  pendingUserIds?: string[];
  sequentialOrder?: string[];
  currentSequentialIndex?: number;

  // Substitute handling
  requiresSubstitute?: boolean;
  substituteAlert?: string;
  substituteAssigned?: {
    originalUserId: string;
    originalUserName: string;
    substituteUserId: string;
    substituteUserName: string;
    assignedAt: string;
    assignedBy: string;
    reason?: string;
  };

  department: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'RETURNED';
  variables: Record<string, any>;
  slaHours: number;
  creationTime: string;
  dueDate: string;
}

export interface ProcessStats {
  totalWorkflows: number;
  activeInstances: number;
  completedInstances: number;
  rejectedInstances: number;
  pendingTasks: number;
  criticalTasks: number;
  slaCompliance: number;
  categories: Record<string, number>;
}
