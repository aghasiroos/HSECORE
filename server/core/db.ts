/**
 * Central Database Access & Transaction Layer
 * Wraps Drizzle ORM, connection health verification, and atomic transaction execution.
 */
import { sql } from 'drizzle-orm';
import { db, createPool } from '../../src/db/index.ts';
import * as schema from '../../src/db/schema.ts';
import { logger } from './logger.ts';
import { DatabaseError } from './errors.ts';

export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unreachable';
  latencyMs: number;
  pool?: { totalCount: number; idleCount: number; waitingCount: number; maxConnections: number };
  error?: string;
}> {
  const start = Date.now();
  const pool = createPool();
  const maxConnections = Number(process.env.PG_MAX_POOL || process.env.SQL_MAX_POOL) || 15;
  const getPoolStats = () => ({
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections,
  });

  if (process.env.SIMULATE_DB_OUTAGE === 'true') {
    return {
      status: 'unreachable',
      latencyMs: Date.now() - start,
      pool: getPoolStats(),
      error: 'Database connection unreachable (simulated or disconnected)',
    };
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    const queryPromise = (async () => {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Database health check timed out after 4000ms')), 4000);
    });

    await Promise.race([queryPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);

    const latencyMs = Date.now() - start;
    return {
      status: 'healthy',
      latencyMs,
      pool: getPoolStats(),
    };
  } catch (error: any) {
    if (timer) clearTimeout(timer);
    const latencyMs = Date.now() - start;
    logger.error('Database health check failed', error);
    return {
      status: 'unreachable',
      latencyMs,
      pool: getPoolStats(),
      error: error?.message || 'Failed to connect to database',
    };
  }
}

/**
 * Execute an atomic transaction with automatic rollback on error.
 */
export async function withTransaction<T>(
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      return await callback(tx as any);
    });
  } catch (error: any) {
    logger.error('Transaction rolled back due to error', error);
    throw new DatabaseError(error?.message || 'Transaction failed', error);
  }
}

export { db, schema, sql };
