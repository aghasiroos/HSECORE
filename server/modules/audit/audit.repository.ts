import { desc, eq, and, sql } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import { AuditLogEntry } from './audit.types.ts';
import { logger } from '../../core/logger.ts';

// In-memory fallback buffer for dev environments without full پایگاه داده connection
const inMemoryAuditLogs: AuditLogEntry[] = [];

export class AuditRepository {
  async create(entry: AuditLogEntry): Promise<void> {
    const record = {
      ...entry,
      createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
      result: entry.result || 'SUCCESS',
      module: entry.module || 'SYSTEM',
    };

    inMemoryAuditLogs.unshift({
      ...record,
      id: inMemoryAuditLogs.length + 1,
    });

    try {
      let validUserId: number | undefined = undefined;
      if (typeof record.userId === 'number' && Number.isInteger(record.userId) && record.userId > 0) {
        try {
          const userExists = await db
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.id, record.userId))
            .limit(1);
          if (userExists && userExists.length > 0) {
            validUserId = record.userId;
          }
        } catch {
          validUserId = undefined;
        }
      }

      await db.insert(schema.auditLogs).values({
        userId: validUserId,
        userUid: record.userUid,
        personnelCode: record.personnelCode,
        action: record.action,
        module: record.module,
        entityType: record.entityType,
        entityId: record.entityId,
        oldValue: record.oldValue ? record.oldValue : null,
        newValue: record.newValue ? record.newValue : null,
        details: record.details ? record.details : null,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        result: record.result,
      });
    } catch (error) {
      try {
        await db.insert(schema.auditLogs).values({
          userId: undefined,
          userUid: record.userUid,
          personnelCode: record.personnelCode,
          action: record.action,
          module: record.module,
          entityType: record.entityType,
          entityId: record.entityId,
          oldValue: record.oldValue ? record.oldValue : null,
          newValue: record.newValue ? record.newValue : null,
          details: record.details ? record.details : null,
          ipAddress: record.ipAddress,
          userAgent: record.userAgent,
          result: record.result,
        });
      } catch {
        // In-memory buffer preserved even if DB is unavailable
        logger.debug('Audit logged to memory fallback', { action: entry.action, entity: entry.entityType });
      }
    }
  }

  async findRecent(limit: number = 200): Promise<AuditLogEntry[]> {
    try {
      const logs = await db
        .select()
        .from(schema.auditLogs)
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(limit);

      if (logs.length > 0) {
        return logs.map((l) => ({
          id: l.id,
          userId: l.userId || undefined,
          userUid: l.userUid || undefined,
          personnelCode: l.personnelCode || undefined,
          action: l.action,
          module: l.module,
          entityType: l.entityType,
          entityId: l.entityId || undefined,
          oldValue: l.oldValue,
          newValue: l.newValue,
          details: l.details,
          ipAddress: l.ipAddress || undefined,
          userAgent: l.userAgent || undefined,
          result: (l.result as any) || 'SUCCESS',
          createdAt: l.createdAt.toISOString(),
        }));
      }
    } catch (error) {
      logger.debug('Fetching audit logs from fallback buffer');
    }

    return inMemoryAuditLogs.slice(0, limit);
  }
}

export const auditRepository = new AuditRepository();
