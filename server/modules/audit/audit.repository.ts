import { desc, eq, and, gte, lte, or, ilike, sql, SQL } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import { AuditLogEntry, AuditLogFilterQuery, PaginatedAuditResult } from './audit.types.ts';
import { logger } from '../../core/logger.ts';

// Sensitive field patterns that MUST NEVER be stored in plaintext inside audit logs
const SENSITIVE_KEY_PATTERN =
  /(password|passcode|passwd|secret|token|apikey|api_key|privatekey|private_key|authorization|cookie|jwt|smtppass|smtp_pass|clientsecret|client_secret|webhooksecret|encryptionkey|pin)/i;

/**
 * Recursively scrubs sensitive fields (passwords, tokens, secrets, cookies, raw base64 images)
 * from any audit payload before persisting to PostgreSQL or memory.
 */
export function sanitizeAuditPayload(value: any, depth: number = 0): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (depth > 6) return '[Truncated Deep Object]';

  if (typeof value === 'string') {
    if (value.startsWith('data:image/') || value.startsWith('data:application/pdf')) {
      return `[Binary Data Redacted (${value.length} chars)]`;
    }
    if (/^Bearer\s+[A-Za-z0-9\-_.]+$/i.test(value.trim())) {
      return 'Bearer [REDACTED]';
    }
    if (value.length > 4000) {
      return `${value.slice(0, 2000)}... [Truncated ${value.length} chars]`;
    }
    return value;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const sliced = value.slice(0, 100).map((item) => sanitizeAuditPayload(item, depth + 1));
    if (value.length > 100) {
      sliced.push(`[+${value.length - 100} more items]`);
    }
    return sliced;
  }

  const out: Record<string, any> = {};
  const entries = Object.entries(value).slice(0, 120);
  for (const [key, val] of entries) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = val === undefined || val === null || val === '' ? null : '[REDACTED]';
    } else {
      out[key] = sanitizeAuditPayload(val, depth + 1);
    }
  }
  return out;
}

// In-memory fallback buffer & short-window deduplication cache
const inMemoryAuditLogs: AuditLogEntry[] = [];
const recentDedupeMap = new Map<string, number>();

function isDuplicateAuditBurst(entry: AuditLogEntry): boolean {
  const now = Date.now();
  // Prune expired entries occasionally
  if (recentDedupeMap.size > 300) {
    for (const [k, ts] of recentDedupeMap.entries()) {
      if (now - ts > 5000) recentDedupeMap.delete(k);
    }
  }

  const actorKey = String(entry.userUid || entry.userId || entry.username || 'system');
  const sig = `${actorKey}|${String(entry.action).toUpperCase()}|${String(entry.module).toUpperCase()}|${String(entry.entityType).toUpperCase()}|${String(entry.entityId || '')}|${String(entry.result || 'SUCCESS')}`;
  const prevTs = recentDedupeMap.get(sig);
  if (prevTs && now - prevTs < 1200) {
    return true;
  }
  recentDedupeMap.set(sig, now);
  return false;
}

function mapDbRowToEntry(row: {
  log: typeof schema.auditLogs.$inferSelect;
  userUsername?: string | null;
  userFullName?: string | null;
  userRole?: string | null;
  userPersonnelNumber?: string | null;
}): AuditLogEntry {
  const l = row.log;
  const detailsObj =
    l.details && typeof l.details === 'object' ? (l.details as Record<string, any>) : undefined;

  const enrichedDetails = detailsObj
    ? {
        ...detailsObj,
        username: detailsObj.username || row.userUsername || undefined,
        fullName: detailsObj.fullName || detailsObj.actorName || row.userFullName || undefined,
        actorName: detailsObj.actorName || detailsObj.fullName || row.userFullName || row.userUsername || undefined,
        userRole: detailsObj.userRole || detailsObj.actorRole || row.userRole || undefined,
      }
    : row.userUsername || row.userFullName || row.userRole
      ? {
          username: row.userUsername || undefined,
          fullName: row.userFullName || undefined,
          actorName: row.userFullName || row.userUsername || undefined,
          userRole: row.userRole || undefined,
        }
      : undefined;

  return {
    id: l.id,
    userId: l.userId || undefined,
    userUid: l.userUid || row.userUsername || undefined,
    personnelCode: l.personnelCode || row.userPersonnelNumber || undefined,
    username: row.userUsername || detailsObj?.username || l.userUid || undefined,
    fullName: row.userFullName || detailsObj?.fullName || detailsObj?.actorName || undefined,
    userRole: row.userRole || detailsObj?.userRole || detailsObj?.actorRole || undefined,
    action: l.action,
    module: l.module,
    entityType: l.entityType,
    entityId: l.entityId || undefined,
    oldValue: l.oldValue,
    newValue: l.newValue,
    details: enrichedDetails,
    ipAddress: l.ipAddress || undefined,
    userAgent: l.userAgent || undefined,
    result: (l.result as any) || 'SUCCESS',
    createdAt: l.createdAt.toISOString(),
  };
}

/**
 * Append-only Audit Repository.
 * Note: Intentionally exposes NO update or delete methods to enforce log immutability.
 */
export class AuditRepository {
  async create(entry: AuditLogEntry): Promise<void> {
    if (isDuplicateAuditBurst(entry)) {
      return;
    }

    const sanitizedOld = entry.oldValue !== undefined ? sanitizeAuditPayload(entry.oldValue) : null;
    const sanitizedNew = entry.newValue !== undefined ? sanitizeAuditPayload(entry.newValue) : null;
    const sanitizedDetails = entry.details !== undefined ? sanitizeAuditPayload(entry.details) : null;

    const record: AuditLogEntry = {
      ...entry,
      oldValue: sanitizedOld,
      newValue: sanitizedNew,
      details: sanitizedDetails,
      createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
      result: entry.result || 'SUCCESS',
      module: entry.module || 'SYSTEM',
    };

    inMemoryAuditLogs.unshift({
      ...record,
      id: inMemoryAuditLogs.length + 1,
    });
    if (inMemoryAuditLogs.length > 1000) {
      inMemoryAuditLogs.length = 1000;
    }

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
        userUid: record.userUid ? String(record.userUid).slice(0, 128) : undefined,
        personnelCode: record.personnelCode ? String(record.personnelCode).slice(0, 64) : undefined,
        action: String(record.action || 'OTHER').slice(0, 100),
        module: String(record.module || 'SYSTEM').slice(0, 50),
        entityType: String(record.entityType || 'SYSTEM').slice(0, 100),
        entityId: record.entityId ? String(record.entityId).slice(0, 128) : undefined,
        oldValue: sanitizedOld,
        newValue: sanitizedNew,
        details: sanitizedDetails,
        ipAddress: record.ipAddress ? String(record.ipAddress).slice(0, 45) : undefined,
        userAgent: record.userAgent ? String(record.userAgent).slice(0, 500) : undefined,
        result: String(record.result || 'SUCCESS').slice(0, 20),
      });
    } catch {
      try {
        await db.insert(schema.auditLogs).values({
          userId: undefined,
          userUid: record.userUid ? String(record.userUid).slice(0, 128) : undefined,
          personnelCode: record.personnelCode ? String(record.personnelCode).slice(0, 64) : undefined,
          action: String(record.action || 'OTHER').slice(0, 100),
          module: String(record.module || 'SYSTEM').slice(0, 50),
          entityType: String(record.entityType || 'SYSTEM').slice(0, 100),
          entityId: record.entityId ? String(record.entityId).slice(0, 128) : undefined,
          oldValue: sanitizedOld,
          newValue: sanitizedNew,
          details: sanitizedDetails,
          ipAddress: record.ipAddress ? String(record.ipAddress).slice(0, 45) : undefined,
          userAgent: record.userAgent ? String(record.userAgent).slice(0, 500) : undefined,
          result: String(record.result || 'SUCCESS').slice(0, 20),
        });
      } catch {
        logger.debug('Audit logged to memory fallback', { action: entry.action, entity: entry.entityType });
      }
    }
  }

  async findRecent(limit: number = 200): Promise<AuditLogEntry[]> {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 200), 1000);
    const res = await this.findPaginated({ page: 1, limit: safeLimit });
    return res.rows;
  }

  async findPaginated(query: AuditLogFilterQuery): Promise<PaginatedAuditResult> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 50), 500);
    const offset = (page - 1) * limit;

    try {
      const conditions: SQL[] = [];

      if (query.module && query.module !== 'ALL') {
        const modTrim = query.module.trim();
        conditions.push(
          or(
            ilike(schema.auditLogs.module, modTrim),
            sql`${schema.auditLogs.details}->>'module' ILIKE ${modTrim}`
          )!
        );
      }

      if (query.actionType && query.actionType !== 'ALL') {
        const actTrim = query.actionType.trim();
        conditions.push(
          or(
            ilike(schema.auditLogs.action, `%${actTrim}%`),
            sql`${schema.auditLogs.details}->>'actionType' ILIKE ${actTrim}`
          )!
        );
      }

      if (query.result && query.result !== 'ALL') {
        const r = query.result.trim().toUpperCase();
        if (r === 'FAIL' || r === 'FAILED') {
          conditions.push(ilike(schema.auditLogs.result, 'FAILED'));
        } else if (r === 'SUCCESS') {
          conditions.push(ilike(schema.auditLogs.result, 'SUCCESS'));
        } else {
          conditions.push(ilike(schema.auditLogs.result, r));
        }
      }

      if (query.user && query.user !== 'ALL') {
        const u = `%${query.user.trim()}%`;
        conditions.push(
          or(
            ilike(schema.auditLogs.userUid, u),
            ilike(schema.auditLogs.personnelCode, u),
            ilike(schema.users.username, u),
            ilike(schema.users.fullName, u),
            sql`${schema.auditLogs.details}->>'username' ILIKE ${u}`,
            sql`${schema.auditLogs.details}->>'actorName' ILIKE ${u}`
          )!
        );
      }

      if (query.from) {
        const fromDate = new Date(query.from);
        if (!isNaN(fromDate.getTime())) {
          conditions.push(gte(schema.auditLogs.createdAt, fromDate));
        }
      }

      if (query.to) {
        const toDate = new Date(query.to);
        if (!isNaN(toDate.getTime())) {
          // Include entire end day if only YYYY-MM-DD was provided
          if (query.to.length <= 10) {
            toDate.setHours(23, 59, 59, 999);
          }
          conditions.push(lte(schema.auditLogs.createdAt, toDate));
        }
      }

      if (query.search && query.search.trim()) {
        const q = `%${query.search.trim()}%`;
        conditions.push(
          or(
            ilike(schema.auditLogs.action, q),
            ilike(schema.auditLogs.module, q),
            ilike(schema.auditLogs.entityType, q),
            ilike(schema.auditLogs.entityId, q),
            ilike(schema.auditLogs.userUid, q),
            ilike(schema.auditLogs.personnelCode, q),
            ilike(schema.auditLogs.ipAddress, q),
            ilike(schema.users.username, q),
            ilike(schema.users.fullName, q),
            sql`CAST(${schema.auditLogs.details} AS TEXT) ILIKE ${q}`,
            sql`CAST(${schema.auditLogs.newValue} AS TEXT) ILIKE ${q}`,
            sql`CAST(${schema.auditLogs.oldValue} AS TEXT) ILIKE ${q}`
          )!
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.auditLogs)
        .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
        .where(whereClause);

      const total = Number(countRow?.total || 0);

      const rowsRaw = await db
        .select({
          log: schema.auditLogs,
          userUsername: schema.users.username,
          userFullName: schema.users.fullName,
          userRole: schema.users.role,
          userPersonnelNumber: schema.users.personnelNumber,
        })
        .from(schema.auditLogs)
        .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
        .where(whereClause)
        .orderBy(desc(schema.auditLogs.createdAt), desc(schema.auditLogs.id))
        .limit(limit)
        .offset(offset);

      const rows = rowsRaw.map(mapDbRowToEntry);
      return {
        rows,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    } catch (error) {
      logger.debug('Fetching audit logs from fallback buffer', { error: (error as any)?.message });
      const total = inMemoryAuditLogs.length;
      const sliced = inMemoryAuditLogs.slice(offset, offset + limit);
      return {
        rows: sliced,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }
  }
}

export const auditRepository = new AuditRepository();
