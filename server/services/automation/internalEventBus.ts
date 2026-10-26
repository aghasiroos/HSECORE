/**
 * Internal Event Bus & Transactional Outbox Producer
 * Guarantees zero-loss event publication with database-level idempotency.
 */
import { v4 as uuidv4 } from 'uuid';
import { sql, eq } from 'drizzle-orm';
import { db } from '../../../src/db/index.ts';
import { automationEventsOutbox } from '../../../src/db/schema.ts';
import { logger } from '../../core/logger.ts';
import { DomainEventEnvelope, OutboxRecord } from './types.ts';

type WorkerWakeupFn = () => void;
let workerWakeupCallback: WorkerWakeupFn | null = null;

export function registerWorkerWakeup(callback: WorkerWakeupFn): void {
  workerWakeupCallback = callback;
}

export function triggerWorkerWakeup(): void {
  if (workerWakeupCallback) {
    try {
      workerWakeupCallback();
    } catch (err: any) {
      logger.warn('Failed to wake up automation worker', { error: err?.message });
    }
  }
}

/**
 * Publishes a domain event into the PostgreSQL Transactional Outbox.
 * Supports running within an existing Drizzle transaction (`tx`) for atomic business + event commits.
 * Enforces database-level idempotency via unique index on `idempotency_key`.
 */
export async function publishDomainEvent(
  envelope: DomainEventEnvelope,
  tx?: typeof db
): Promise<{ success: boolean; eventId: string; duplicated: boolean; outboxId?: number }> {
  const eventId = envelope.eventId || `evt_${uuidv4()}`;
  const correlationKey = envelope.correlationKey || eventId;
  const idempotencyKey =
    envelope.idempotencyKey || `idem_${envelope.eventType}_${correlationKey}_${Date.now()}`;
  const sourceModule = envelope.sourceModule || 'system';

  const executor = tx || db;

  try {
    const inserted = await executor
      .insert(automationEventsOutbox)
      .values({
        eventId,
        eventType: envelope.eventType,
        sourceModule,
        correlationKey,
        idempotencyKey,
        payload: {
          ...envelope.payload,
          _meta: {
            triggeredBy: envelope.triggeredBy || 'system',
            timestamp: envelope.timestamp || new Date().toISOString(),
          },
        },
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 5,
        nextRetryAt: new Date(),
      })
      .onConflictDoNothing({ target: automationEventsOutbox.idempotencyKey })
      .returning({ id: automationEventsOutbox.id, eventId: automationEventsOutbox.eventId });

    if (inserted.length === 0) {
      logger.info('Duplicate domain event suppressed by database-level idempotency', {
        eventType: envelope.eventType,
        idempotencyKey,
        correlationKey,
      });

      return {
        success: true,
        eventId,
        duplicated: true,
      };
    }

    logger.info('Domain event successfully staged in Transactional Outbox', {
      outboxId: inserted[0].id,
      eventId: inserted[0].eventId,
      eventType: envelope.eventType,
      correlationKey,
    });

    // Notify background worker to process immediately
    triggerWorkerWakeup();

    return {
      success: true,
      eventId: inserted[0].eventId,
      duplicated: false,
      outboxId: inserted[0].id,
    };
  } catch (error: any) {
    logger.error('Failed to publish domain event to Transactional Outbox', {
      eventType: envelope.eventType,
      correlationKey,
      idempotencyKey,
      error: error?.message,
    });
    throw error;
  }
}
