/**
 * Automation Rule Evaluation and Action Execution Engine
 * Evaluates triggers, multi-condition rules, and executes side effects.
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../src/db/index.ts';
import { notifications, automationRules, automationExecutionLogs } from '../../../src/db/schema.ts';
import { logger } from '../../core/logger.ts';
import {
  RuleCondition,
  RuleAction,
  AutomationRuleDto,
  ExecutionLogRecord,
} from './types.ts';
import { executeWebhookDelivery } from '../webhookDispatcher.ts';

/**
 * Extracts a value from a nested payload using dot notation or case-insensitive matching.
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
  if (!obj || !path) return undefined;

  // Direct match
  if (obj[path] !== undefined) return obj[path];

  // Dot notation traversal
  const parts = path.split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }

  if (current !== undefined) return current;

  // Case-insensitive fallback for flat keys
  const lowerPath = path.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lowerPath) {
      return obj[key];
    }
  }

  return undefined;
}

/**
 * Evaluates a single rule condition against the event payload.
 */
export function evaluateCondition(condition: RuleCondition, payload: Record<string, any>): boolean {
  if (!condition || condition.operator === 'always') {
    return true;
  }

  const actualValue = getNestedValue(payload, condition.field);
  const targetValue = condition.value;

  switch (condition.operator) {
    case 'eq':
      if (typeof actualValue === 'string' && typeof targetValue === 'string') {
        return actualValue.trim().toLowerCase() === targetValue.trim().toLowerCase();
      }
      return actualValue == targetValue;

    case 'neq':
      if (typeof actualValue === 'string' && typeof targetValue === 'string') {
        return actualValue.trim().toLowerCase() !== targetValue.trim().toLowerCase();
      }
      return actualValue != targetValue;

    case 'gt':
      return Number(actualValue) > Number(targetValue);

    case 'gte':
      return Number(actualValue) >= Number(targetValue);

    case 'lt':
      return Number(actualValue) < Number(targetValue);

    case 'lte':
      return Number(actualValue) <= Number(targetValue);

    case 'contains':
      if (actualValue === null || actualValue === undefined) return false;
      return String(actualValue).toLowerCase().includes(String(targetValue).toLowerCase());

    case 'not_contains':
      if (actualValue === null || actualValue === undefined) return true;
      return !String(actualValue).toLowerCase().includes(String(targetValue).toLowerCase());

    case 'in':
      if (Array.isArray(targetValue)) {
        const needle = String(actualValue ?? '').trim().toLowerCase();
        return targetValue.some((v) => String(v).trim().toLowerCase() === needle);
      }
      return false;

    case 'not_in':
      if (Array.isArray(targetValue)) {
        const needle = String(actualValue ?? '').trim().toLowerCase();
        return !targetValue.some((v) => String(v).trim().toLowerCase() === needle);
      }
      return true;

    case 'is_null':
      return actualValue === null || actualValue === undefined || actualValue === '';

    case 'is_not_null':
      return actualValue !== null && actualValue !== undefined && actualValue !== '';

    default:
      logger.warn(`Unknown condition operator: ${condition.operator}`);
      return false;
  }
}

/**
 * Evaluates whether all conditions in a rule are satisfied.
 */
export function evaluateAllConditions(
  conditions: RuleCondition[],
  payload: Record<string, any>
): { matched: boolean; details: Record<string, any> } {
  if (!conditions || conditions.length === 0) {
    return { matched: true, details: { evaluatedCount: 0, reason: 'No conditions (always true)' } };
  }

  const results: Record<string, any>[] = [];

  for (const cond of conditions) {
    const passed = evaluateCondition(cond, payload);
    const actual = getNestedValue(payload, cond.field);
    results.push({
      field: cond.field,
      operator: cond.operator,
      expected: cond.value,
      actual,
      passed,
    });

    if (!passed) {
      return {
        matched: false,
        details: { passed: false, failedCondition: cond, evaluations: results },
      };
    }
  }

  return {
    matched: true,
    details: { passed: true, evaluations: results },
  };
}

/**
 * Executes a single action defined by a rule.
 */
export async function executeRuleAction(
  action: RuleAction,
  event: {
    eventId: string;
    eventType: string;
    sourceModule: string;
    correlationKey?: string | null;
    payload: Record<string, any>;
  },
  rule: { ruleCode: string; nameFa: string; nameEn: string }
): Promise<{ success: boolean; actionType: string; result?: any; error?: string }> {
  try {
    switch (action.type) {
      case 'notification': {
        const notifId = `notif_auto_${uuidv4().substring(0, 8)}`;
        const title =
          action.config.title ||
          `اعلان خودکار: ${rule.nameFa}`;
        const body =
          action.config.body ||
          `رویداد "${event.eventType}" محرک قانون ${rule.ruleCode} شد.`;

        const targetType = action.config.targetRole ? 'roles' : action.config.targetUser ? 'user' : 'all';
        const targetValues = action.config.targetRole
          ? [action.config.targetRole]
          : action.config.targetUser
            ? [action.config.targetUser]
            : null;

        await db.insert(notifications).values({
          notifId,
          title,
          body,
          type: 'in-app',
          targetType,
          targetValues,
          sender: 'موتور اتوماسیون سامانه (Automation Engine)',
          priority: action.config.priority || 'medium',
          category: action.config.category || 'info',
          sourceModule: event.sourceModule || 'system',
          actionUrl: action.config.actionUrl || null,
          metadata: {
            eventId: event.eventId,
            ruleCode: rule.ruleCode,
            correlationKey: event.correlationKey,
          },
        });

        return { success: true, actionType: 'notification', result: { notifId, title } };
      }

      case 'cartable_task': {
        const notifId = `task_auto_${uuidv4().substring(0, 8)}`;
        const title = action.config.taskTitle || `وظیفه کارتابل ارجاعی: ${rule.nameFa}`;
        const targetRole = action.config.targetRole || 'HSE_OFFICER';

        await db.insert(notifications).values({
          notifId,
          title,
          body: `تسک جدید ارجاع‌شده بر اساس قانون اتوماسیون ${rule.ruleCode}: ${event.eventType}`,
          type: 'REFERRAL',
          targetType: 'roles',
          targetValues: [targetRole],
          sender: 'موتور گردش‌کار خودکار (HSECORE Workflow)',
          priority: action.config.priority || 'high',
          category: 'warning',
          sourceModule: event.sourceModule || 'workflow',
          actionUrl: `#workflow?ref=${event.correlationKey || event.eventId}`,
          metadata: {
            autoAssignedRole: targetRole,
            ruleCode: rule.ruleCode,
            eventId: event.eventId,
          },
        });

        return { success: true, actionType: 'cartable_task', result: { notifId, targetRole } };
      }

      case 'escalation': {
        const notifId = `escl_auto_${uuidv4().substring(0, 8)}`;
        const targetRoles = action.config.targetRoles || ['HSE_MANAGER', 'ADMIN'];
        const title = action.config.title || `🚨 تصاعد فوری وظیفه: ${rule.nameFa}`;

        await db.insert(notifications).values({
          notifId,
          title,
          body: action.config.message || `هشدار تصاعد سطح بالا برای رویداد ${event.eventType} با کلید ${event.correlationKey}`,
          type: 'alert',
          targetType: 'roles',
          targetValues: targetRoles,
          sender: 'سیستم تصاعد خودکار (SLA Escalation Engine)',
          priority: 'critical',
          category: 'critical_hse',
          sourceModule: event.sourceModule || 'system',
          metadata: {
            escalatedRoles: targetRoles,
            ruleCode: rule.ruleCode,
            eventId: event.eventId,
          },
        });

        return { success: true, actionType: 'escalation', result: { notifId, targetRoles } };
      }

      case 'generic_webhook': {
        if (!action.config.webhookUrl) {
          return { success: false, actionType: 'generic_webhook', error: 'Missing webhookUrl in action config' };
        }

        const log = await executeWebhookDelivery({
          eventType: event.eventType as any,
          targetUrl: action.config.webhookUrl,
          data: event.payload,
          moduleName: event.sourceModule,
          correlationKey: event.correlationKey || undefined,
          triggeredBy: `automation_rule_${rule.ruleCode}`,
          maxAttempts: 2,
        });

        return {
          success: log.status === 'DELIVERED',
          actionType: 'generic_webhook',
          result: { deliveryId: log.id, status: log.status, httpStatus: log.httpStatus },
        };
      }

      case 'audit_log': {
        return {
          success: true,
          actionType: 'audit_log',
          result: { logged: true, ruleCode: rule.ruleCode },
        };
      }

      default:
        return { success: false, actionType: (action as any).type, error: `Unknown action type: ${(action as any).type}` };
    }
  } catch (err: any) {
    logger.error('Error executing rule action', {
      actionType: action.type,
      ruleCode: rule.ruleCode,
      error: err?.message,
    });
    return { success: false, actionType: action.type, error: err?.message || 'Action execution failed' };
  }
}
