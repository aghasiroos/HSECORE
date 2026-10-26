/**
 * Internal Automation Engine Type Definitions
 * Enterprise-grade event-driven automation for HSECORE
 */

export type AutomationEventType =
  | 'incident.reported'
  | 'warning.issued'
  | 'permit.status_adjusted'
  | 'heat_stress.level_change'
  | 'sla.threshold_reached'
  | 'non_conformance.created'
  | 'audit.completed'
  | 'task.escalated'
  | 'system.test_ping'
  | string;

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'always';

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export type ActionType =
  | 'notification'
  | 'cartable_task'
  | 'escalation'
  | 'generic_webhook'
  | 'audit_log';

export interface RuleAction {
  type: ActionType;
  config: {
    title?: string;
    body?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    category?: 'info' | 'success' | 'warning' | 'error' | 'critical_hse';
    targetRole?: string;
    targetRoles?: string[];
    targetUser?: string;
    targetDepartment?: string;
    actionUrl?: string;
    taskTitle?: string;
    webhookUrl?: string;
    message?: string;
    [key: string]: any;
  };
}

export interface AutomationRuleDto {
  id?: number;
  ruleCode: string;
  nameFa: string;
  nameEn: string;
  descriptionFa?: string;
  descriptionEn?: string;
  eventType: string;
  sourceModule?: string;
  priority?: number;
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  executionCount?: number;
  lastTriggeredAt?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DomainEventEnvelope<T = Record<string, any>> {
  eventId?: string;
  eventType: AutomationEventType;
  sourceModule: string;
  correlationKey?: string;
  idempotencyKey?: string;
  triggeredBy?: string;
  payload: T;
  timestamp?: string;
}

export interface OutboxRecord {
  id: number;
  eventId: string;
  eventType: string;
  sourceModule: string;
  correlationKey: string | null;
  idempotencyKey: string;
  payload: Record<string, any>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  lockedAt: string | null;
  lockedBy: string | null;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface ExecutionLogRecord {
  id?: number;
  logId: string;
  eventId: string;
  ruleId?: number | null;
  ruleCode: string;
  eventType: string;
  correlationKey?: string | null;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED';
  conditionMatched: boolean;
  conditionDetails?: Record<string, any>;
  actionsExecuted?: Record<string, any>[];
  durationMs: number;
  errorMessage?: string | null;
  actor: string;
  createdAt?: string;
}
