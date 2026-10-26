/**
 * Background Outbox Processor Worker
 * Processes staged domain events with atomic locking, controlled retries, DLQ, and audit logging.
 */
import { v4 as uuidv4 } from 'uuid';
import { sql, eq, and, or, lte, desc } from 'drizzle-orm';
import { db } from '../../../src/db/index.ts';
import {
  automationEventsOutbox,
  automationRules,
  automationExecutionLogs,
} from '../../../src/db/schema.ts';
import { logger } from '../../core/logger.ts';
import {
  evaluateAllConditions,
  executeRuleAction,
} from './ruleEngine.ts';
import { registerWorkerWakeup } from './internalEventBus.ts';
import { OutboxRecord, OutboxStatus } from './types.ts';

const BATCH_SIZE = 10;
const POLLING_INTERVAL_MS = process.env.NODE_ENV === 'production' ? 5000 : 15000;
const LOCK_TIMEOUT_MINUTES = 5;

let isRunning = false;
let pollingTimer: NodeJS.Timeout | null = null;
let isBatchRunning = false;
const workerInstanceId = `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`;

/**
 * Starts the internal automation background worker.
 */
export function startAutomationWorker(): void {
  if (isRunning) return;
  isRunning = true;

  logger.info(`Starting HSECORE Internal Automation Worker [${workerInstanceId}]`);

  // Register immediate wake-up hook when new events are staged
  registerWorkerWakeup(() => {
    if (isRunning && !isBatchRunning) {
      void processOutboxBatch();
    }
  });

  // Periodic polling interval for scheduled retries and queued items
  pollingTimer = setInterval(() => {
    if (isRunning && !isBatchRunning) {
      void processOutboxBatch();
    }
  }, POLLING_INTERVAL_MS);

  // Trigger immediate initial pass
  void processOutboxBatch();
}

/**
 * Gracefully stops the automation background worker.
 */
export function stopAutomationWorker(): void {
  if (!isRunning) return;
  isRunning = false;
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  logger.info(`Stopped HSECORE Internal Automation Worker [${workerInstanceId}]`);
}

/**
 * Claims and processes a batch of staged outbox events.
 */
export async function processOutboxBatch(): Promise<number> {
  if (isBatchRunning) return 0;
  isBatchRunning = true;

  let processedCount = 0;

  try {
    // 1. Reclaim orphaned locks (workers that crashed or stalled > 5 mins)
    await db.execute(sql`
      UPDATE automation_events_outbox
      SET status = 'FAILED',
          locked_at = NULL,
          locked_by = NULL,
          error_message = 'Lock expired after 5 minutes of inactivity'
      WHERE status = 'PROCESSING'
        AND locked_at < NOW() - INTERVAL '5 minutes';
    `);

    // 2. Atomically claim up to BATCH_SIZE events using FOR UPDATE SKIP LOCKED
    const claimResult = await db.execute(sql`
      WITH eligible AS (
        SELECT id
        FROM automation_events_outbox
        WHERE status = 'PENDING'
           OR (status = 'FAILED' AND attempts < max_attempts AND next_retry_at <= NOW())
        ORDER BY id ASC
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE automation_events_outbox
      SET status = 'PROCESSING',
          locked_at = NOW(),
          locked_by = ${workerInstanceId}
      FROM eligible
      WHERE automation_events_outbox.id = eligible.id
      RETURNING
        automation_events_outbox.id,
        automation_events_outbox.event_id as "eventId",
        automation_events_outbox.event_type as "eventType",
        automation_events_outbox.source_module as "sourceModule",
        automation_events_outbox.correlation_key as "correlationKey",
        automation_events_outbox.idempotency_key as "idempotencyKey",
        automation_events_outbox.payload,
        automation_events_outbox.status,
        automation_events_outbox.attempts,
        automation_events_outbox.max_attempts as "maxAttempts",
        automation_events_outbox.next_retry_at as "nextRetryAt",
        automation_events_outbox.created_at as "createdAt";
    `);

    const claimedRecords = (claimResult.rows || []) as unknown as OutboxRecord[];

    if (!claimedRecords || claimedRecords.length === 0) {
      return 0;
    }

    for (const record of claimedRecords) {
      await processSingleOutboxRecord(record);
      processedCount++;
    }
  } catch (error: any) {
    logger.error('Error in automation outbox processing batch', {
      error: error?.message,
      workerInstanceId,
    });
  } finally {
    isBatchRunning = false;
  }

  return processedCount;
}

/**
 * Evaluates rules and executes actions for a single outbox event.
 */
async function processSingleOutboxRecord(record: OutboxRecord): Promise<void> {
  const startTime = Date.now();
  const currentAttempt = (record.attempts || 0) + 1;

  try {
    // 1. Fetch active rules matching this event type (or wildcard 'all')
    const matchingRules = await db
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.isActive, true),
          or(
            eq(automationRules.eventType, record.eventType),
            eq(automationRules.eventType, 'all')
          )
        )
      )
      .orderBy(automationRules.priority);

    const payload = (typeof record.payload === 'object' && record.payload !== null)
      ? record.payload
      : {};

    // 2. Evaluate each rule
    for (const rule of matchingRules) {
      const ruleStartTime = Date.now();
      const conditions = (rule.conditions as any[]) || [];
      const actions = (rule.actions as any[]) || [];

      const evalResult = evaluateAllConditions(conditions, payload);

      if (!evalResult.matched) {
        // Record skipped audit log
        await db.insert(automationExecutionLogs).values({
          logId: `log_${uuidv4()}`,
          eventId: record.eventId,
          ruleId: rule.id,
          ruleCode: rule.ruleCode,
          eventType: record.eventType,
          correlationKey: record.correlationKey,
          status: 'SKIPPED',
          conditionMatched: false,
          conditionDetails: evalResult.details,
          actionsExecuted: [],
          durationMs: Date.now() - ruleStartTime,
          actor: String(payload._meta?.triggeredBy || 'system'),
        });
        continue;
      }

      // 3. Conditions matched! Execute rule actions
      const executedActionsResults: Record<string, any>[] = [];
      let ruleSuccess = true;
      let ruleErrorMessage: string | null = null;

      for (const action of actions) {
        const actionResult = await executeRuleAction(
          action,
          {
            eventId: record.eventId,
            eventType: record.eventType,
            sourceModule: record.sourceModule,
            correlationKey: record.correlationKey,
            payload,
          },
          {
            ruleCode: rule.ruleCode,
            nameFa: rule.nameFa,
            nameEn: rule.nameEn,
          }
        );

        executedActionsResults.push(actionResult);
        if (!actionResult.success) {
          ruleSuccess = false;
          ruleErrorMessage = actionResult.error || 'Action failed';
        }
      }

      // Update rule execution metrics
      await db
        .update(automationRules)
        .set({
          executionCount: sql`${automationRules.executionCount} + 1`,
          lastTriggeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(automationRules.id, rule.id));

      // Record execution audit log
      await db.insert(automationExecutionLogs).values({
        logId: `log_${uuidv4()}`,
        eventId: record.eventId,
        ruleId: rule.id,
        ruleCode: rule.ruleCode,
        eventType: record.eventType,
        correlationKey: record.correlationKey,
        status: ruleSuccess ? 'SUCCESS' : 'PARTIAL_SUCCESS',
        conditionMatched: true,
        conditionDetails: evalResult.details,
        actionsExecuted: executedActionsResults,
        durationMs: Date.now() - ruleStartTime,
        errorMessage: ruleErrorMessage,
        actor: String(payload._meta?.triggeredBy || 'system'),
      });
    }

    // 4. Mark outbox event as COMPLETED
    await db
      .update(automationEventsOutbox)
      .set({
        status: 'COMPLETED',
        attempts: currentAttempt,
        lockedAt: null,
        lockedBy: null,
        errorMessage: null,
        processedAt: new Date(),
      })
      .where(eq(automationEventsOutbox.id, record.id));

    logger.info('Outbox event processed successfully', {
      outboxId: record.id,
      eventId: record.eventId,
      eventType: record.eventType,
      rulesMatched: matchingRules.length,
      durationMs: Date.now() - startTime,
    });
  } catch (error: any) {
    const isExhausted = currentAttempt >= (record.maxAttempts || 5);
    const nextRetrySeconds = Math.min(600, 5 * Math.pow(2, currentAttempt)); // 10s, 20s, 40s, 80s, etc.
    const nextRetryDate = new Date(Date.now() + nextRetrySeconds * 1000);
    const newStatus: OutboxStatus = isExhausted ? 'DEAD_LETTER' : 'FAILED';

    await db
      .update(automationEventsOutbox)
      .set({
        status: newStatus,
        attempts: currentAttempt,
        nextRetryAt: nextRetryDate,
        lockedAt: null,
        lockedBy: null,
        errorMessage: error?.message || 'Processing failed',
      })
      .where(eq(automationEventsOutbox.id, record.id));

    if (isExhausted) {
      logger.error('Outbox event moved to DEAD_LETTER queue after max attempts', {
        outboxId: record.id,
        eventId: record.eventId,
        attempts: currentAttempt,
        error: error?.message,
      });
    } else {
      logger.warn('Outbox event scheduled for retry with exponential backoff', {
        outboxId: record.id,
        eventId: record.eventId,
        attempt: currentAttempt,
        nextRetryInSec: nextRetrySeconds,
        error: error?.message,
      });
    }
  }
}

/**
 * Manually retries a failed or dead-letter outbox event.
 */
export async function retryOutboxEventById(outboxId: number): Promise<boolean> {
  const result = await db
    .update(automationEventsOutbox)
    .set({
      status: 'PENDING',
      attempts: 0,
      nextRetryAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      errorMessage: null,
    })
    .where(eq(automationEventsOutbox.id, outboxId));

  // Wake up worker to immediately pick it up
  if (isRunning) {
    void processOutboxBatch();
  }

  return true;
}

/**
 * Gets aggregated queue metrics for the UI dashboard.
 */
export async function getAutomationQueueStats(): Promise<{
  counts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    total: number;
  };
  recentOutbox: OutboxRecord[];
}> {
  const statsQuery = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
      COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing,
      COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
      COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
      COUNT(*) FILTER (WHERE status = 'DEAD_LETTER') as dead_letter,
      COUNT(*) as total
    FROM automation_events_outbox;
  `);

  const row = statsQuery.rows[0] as any;
  const counts = {
    pending: Number(row?.pending || 0),
    processing: Number(row?.processing || 0),
    completed: Number(row?.completed || 0),
    failed: Number(row?.failed || 0),
    deadLetter: Number(row?.dead_letter || 0),
    total: Number(row?.total || 0),
  };

  const recent = await db
    .select()
    .from(automationEventsOutbox)
    .orderBy(desc(automationEventsOutbox.id))
    .limit(30);

  return {
    counts,
    recentOutbox: recent as unknown as OutboxRecord[],
  };
}
