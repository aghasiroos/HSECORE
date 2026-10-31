/**
 * HSECORE AI Audit Service
 * Dedicated logging for AI interactions, prompt/response telemetry, and token analytics.
 */

import { AIAuditRecord } from './ai.types.ts';
import { auditService } from '../audit/audit.service.ts';
import { logger } from '../../core/logger.ts';

const MAX_IN_MEMORY_LOGS = 500;
const inMemoryAILogs: AIAuditRecord[] = [];

/** Normalize caller-controlled audit pagination to a bounded, predictable range. */
export function normalizeAILogLimit(value: unknown): number {
  const requested = Number(value);
  return Number.isFinite(requested) && requested > 0
    ? Math.min(Math.trunc(requested), 200)
    : 50;
}

export class AIAuditService {
  log(record: AIAuditRecord): void {
    // 1. Maintain in-memory ring buffer
    inMemoryAILogs.unshift(record);
    if (inMemoryAILogs.length > MAX_IN_MEMORY_LOGS) {
      inMemoryAILogs.pop();
    }

    // 2. Persist to central HSECORE audit trail
    auditService.log({
      userId: record.userId ? Number(record.userId) : undefined,
      userUid: record.userUid,
      action: 'AI_CHAT_INVOCATION',
      module: 'AI_ASSISTANT',
      entityType: 'AI_CONVERSATION',
      entityId: record.assistantId,
      details: {
        assistantId: record.assistantId,
        toolsUsed: record.toolsUsed,
        promptLength: record.promptLength,
        responseLength: record.responseLength,
        durationMs: record.durationMs,
        model: record.model,
        success: record.success,
      },
      result: record.success ? 'SUCCESS' : 'FAILED',
    }).catch(err => {
      logger.warn('[AIAuditService] Failed to persist AI audit entry to DB', { error: String(err) });
    });
  }

  getRecentLogs(limit = 100): AIAuditRecord[] {
    return inMemoryAILogs.slice(0, limit);
  }

  getAnalyticsSummary() {
    const total = inMemoryAILogs.length;
    let totalDurationMs = 0;
    let totalPromptChars = 0;
    let totalResponseChars = 0;
    const assistantUsage: Record<string, number> = {};

    for (const log of inMemoryAILogs) {
      totalDurationMs += log.durationMs;
      totalPromptChars += log.promptLength;
      totalResponseChars += log.responseLength;
      assistantUsage[log.assistantId] = (assistantUsage[log.assistantId] || 0) + 1;
    }

    return {
      totalRequests: total,
      avgDurationMs: total > 0 ? Math.round(totalDurationMs / total) : 0,
      totalPromptChars,
      totalResponseChars,
      assistantUsage,
    };
  }
}

export const aiAuditService = new AIAuditService();
