import { db } from '../../src/db/index.ts';
import * as schema from '../../src/db/schema.ts';
import { eq, and, inArray, isNull, or, sql, desc } from 'drizzle-orm';
import { ForbiddenError, ValidationError, NotFoundError } from './errors.ts';
import { broadcastDataMutation } from './socket.ts';
import { normalizeRoleToCanonical } from './middleware/auth.ts';
import { normalizePersianArabicText, normalizeDigits as sharedNormalizeDigits } from '../../src/utils/textNormalization.ts';

export type PersonnelAccessScope = 'ALL' | 'ASSIGNED';

export interface AssignedPersonnelSummary {
  id: string;
  personnelId: number;
  personnelCode: string;
  nationalCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  unit: string;
  jobTitle: string;
  status: string;
  assignedAt?: string;
  assignedBy?: string;
}

export interface PersonnelAccessContext {
  userId: number | null;
  userUid: string;
  username: string;
  fullName: string;
  role: string;
  isAdmin: boolean;
  scope: PersonnelAccessScope;
  canAccessAll: boolean;
  assignedPersonnelIds: number[];
  assignedPersonnelIdStrings: Set<string>;
  assignedPersonnelCodes: Set<string>;
  assignedNationalCodes: Set<string>;
  assignedFullNames: Set<string>;
  assignedPersonnel: AssignedPersonnelSummary[];
}

export interface UpdateUserPersonnelAssignmentsInput {
  targetUserIdentifier: string | number;
  scope: PersonnelAccessScope;
  personnelIds: Array<string | number>;
  actor?: {
    id?: string | number;
    uid?: string;
    username?: string;
    fullName?: string;
    role?: string;
    personnelNumber?: string;
  };
  ipAddress?: string;
  userAgent?: string;
  skipAdminCheck?: boolean;
}

let schemaVerified = false;

function normalizeText(val: unknown): string {
  return normalizePersianArabicText(val);
}

function normalizeDigits(val: unknown): string {
  return sharedNormalizeDigits(val);
}

function normalizeCode(val: unknown): string {
  return normalizeDigits(val).toUpperCase().replace(/\s+/g, '');
}

function isPersonnelActive(row: { status?: string | null; extraData?: any }): boolean {
  const statusUpper = normalizeText(row.status || 'ACTIVE').toUpperCase();
  if (statusUpper === 'INACTIVE' || statusUpper === 'DELETED' || statusUpper === 'DISABLED' || statusUpper === 'غیرفعال') {
    return false;
  }
  const extraStatus = normalizeText(row.extraData?.status || '').toLowerCase();
  if (extraStatus === 'inactive' || extraStatus === 'deleted' || extraStatus === 'غیرفعال') {
    return false;
  }
  return true;
}

export function isAdminRole(role?: string | null): boolean {
  const canonical = normalizeRoleToCanonical(role || '');
  return canonical === 'ADMINISTRATOR' || canonical === 'ADMIN';
}

export class PersonnelAccessService {
  async ensureSchema(): Promise<void> {
    if (schemaVerified) return;
    try {
      await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS personnel_access_scope TEXT DEFAULT 'ASSIGNED' NOT NULL;`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_personnel_assignments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_uid TEXT NOT NULL,
          personnel_id INTEGER NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
          personnel_code TEXT NOT NULL,
          assigned_by TEXT,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS user_personnel_assignment_unique_idx
        ON user_personnel_assignments (user_id, personnel_id);
      `);
      schemaVerified = true;
    } catch (err: any) {
      console.warn('[PersonnelAccessService] Schema check notice:', err?.message || err);
    }
  }

  /**
   * Resolves a user row from PostgreSQL by id, uid, username, email, or personnelNumber
   */
  async findUserRow(identifier: string | number | any): Promise<typeof schema.users.$inferSelect | null> {
    await this.ensureSchema();
    if (!identifier) return null;

    if (typeof identifier === 'object' && identifier !== null) {
      const candidateUid = identifier.uid || identifier.id;
      const candidateUsername = identifier.username;
      if (candidateUid !== undefined && candidateUid !== null) {
        const byUidOrId = await this.findUserRow(candidateUid);
        if (byUidOrId) return byUidOrId;
      }
      if (candidateUsername) {
        return this.findUserRow(candidateUsername);
      }
      return null;
    }

    const raw = String(identifier).trim();
    if (!raw) return null;

    const numericId = /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
    const conditions: any[] = [
      eq(schema.users.uid, raw),
      eq(schema.users.username, raw),
      eq(schema.users.email, raw),
      eq(schema.users.personnelNumber, raw),
    ];
    if (numericId !== null && Number.isSafeInteger(numericId)) {
      conditions.unshift(eq(schema.users.id, numericId));
    }

    const rows = await db
      .select()
      .from(schema.users)
      .where(and(isNull(schema.users.deletedAt), or(...conditions)))
      .limit(1);

    return rows[0] || null;
  }

  /**
   * Bulk loads active personnel assignments for all users (avoids N+1 queries in getAllUsers)
   */
  async getAllUsersAssignmentsMap(): Promise<
    Map<
      number,
      {
        assignedPersonnelIds: string[];
        assignedPersonnelCodes: string[];
        assignedPersonnel: AssignedPersonnelSummary[];
      }
    >
  > {
    await this.ensureSchema();
    const result = new Map<
      number,
      {
        assignedPersonnelIds: string[];
        assignedPersonnelCodes: string[];
        assignedPersonnel: AssignedPersonnelSummary[];
      }
    >();

    try {
      const units = await db.select().from(schema.orgUnits);
      const unitMap = new Map<number, string>(units.map((u) => [u.id, u.name]));

      const rows = await db
        .select({
          assignment: schema.userPersonnelAssignments,
          person: schema.personnel,
        })
        .from(schema.userPersonnelAssignments)
        .innerJoin(schema.personnel, eq(schema.userPersonnelAssignments.personnelId, schema.personnel.id));

      for (const { assignment, person } of rows) {
        if (!isPersonnelActive(person)) continue;

        const extra = (person.extraData as Record<string, any>) || {};
        const firstName = normalizeText(person.firstName);
        const lastName = normalizeText(person.lastName);
        const fullName = normalizeText(extra.fullName || `${firstName} ${lastName}`);
        const unitName = normalizeText(
          extra.unit || (person.unitId ? unitMap.get(person.unitId) : '') || 'نامشخص'
        );

        const summary: AssignedPersonnelSummary = {
          id: String(person.id),
          personnelId: person.id,
          personnelCode: normalizeCode(person.personnelCode),
          nationalCode: normalizeCode(person.nationalCode),
          firstName,
          lastName,
          fullName,
          unit: unitName,
          jobTitle: normalizeText(person.jobTitle || extra.jobTitle || ''),
          status: 'ACTIVE',
          assignedAt: assignment.createdAt?.toISOString(),
          assignedBy: assignment.assignedBy || undefined,
        };

        const existing = result.get(assignment.userId) || {
          assignedPersonnelIds: [],
          assignedPersonnelCodes: [],
          assignedPersonnel: [],
        };

        if (!existing.assignedPersonnelIds.includes(String(person.id))) {
          existing.assignedPersonnelIds.push(String(person.id));
          if (summary.personnelCode) {
            existing.assignedPersonnelCodes.push(summary.personnelCode);
          }
          existing.assignedPersonnel.push(summary);
          result.set(assignment.userId, existing);
        }
      }
    } catch (err: any) {
      console.error('[PersonnelAccessService] Failed to build assignments map:', err?.message || err);
    }

    return result;
  }

  /**
   * Resolves the complete PersonnelAccessContext for a user from PostgreSQL
   */
  async resolveAccessContext(userOrIdentifier: any): Promise<PersonnelAccessContext> {
    await this.ensureSchema();

    const userRow = await this.findUserRow(userOrIdentifier);

    if (!userRow) {
      // Fallback if user token payload is admin but row lookup missed
      const roleFromPayload = userOrIdentifier?.role || 'User';
      const adminPayload = isAdminRole(roleFromPayload);
      return {
        userId: null,
        userUid: String(userOrIdentifier?.uid || userOrIdentifier?.id || ''),
        username: String(userOrIdentifier?.username || ''),
        fullName: String(userOrIdentifier?.fullName || ''),
        role: roleFromPayload,
        isAdmin: adminPayload,
        scope: adminPayload ? 'ALL' : 'ASSIGNED',
        canAccessAll: adminPayload,
        assignedPersonnelIds: [],
        assignedPersonnelIdStrings: new Set(),
        assignedPersonnelCodes: new Set(),
        assignedNationalCodes: new Set(),
        assignedFullNames: new Set(),
        assignedPersonnel: [],
      };
    }

    const isAdmin = isAdminRole(userRow.role);
    const rawScope = String(userRow.personnelAccessScope || '').toUpperCase();
    const scope: PersonnelAccessScope = isAdmin || rawScope === 'ALL' ? 'ALL' : 'ASSIGNED';
    const canAccessAll = scope === 'ALL';

    const units = await db.select().from(schema.orgUnits);
    const unitMap = new Map<number, string>(units.map((u) => [u.id, u.name]));

    const assignmentRows = await db
      .select({
        assignment: schema.userPersonnelAssignments,
        person: schema.personnel,
      })
      .from(schema.userPersonnelAssignments)
      .innerJoin(schema.personnel, eq(schema.userPersonnelAssignments.personnelId, schema.personnel.id))
      .where(eq(schema.userPersonnelAssignments.userId, userRow.id));

    const assignedPersonnelIds: number[] = [];
    const assignedPersonnelIdStrings = new Set<string>();
    const assignedPersonnelCodes = new Set<string>();
    const assignedNationalCodes = new Set<string>();
    const assignedFullNames = new Set<string>();
    const assignedPersonnel: AssignedPersonnelSummary[] = [];

    for (const { assignment, person } of assignmentRows) {
      // Automatically exclude inactive or soft-deleted personnel
      if (!isPersonnelActive(person)) {
        continue;
      }

      const extra = (person.extraData as Record<string, any>) || {};
      const firstName = normalizeText(person.firstName);
      const lastName = normalizeText(person.lastName);
      const fullName = normalizeText(extra.fullName || `${firstName} ${lastName}`);
      const pCode = normalizeCode(person.personnelCode);
      const nCode = normalizeCode(person.nationalCode);
      const unitName = normalizeText(
        extra.unit || (person.unitId ? unitMap.get(person.unitId) : '') || 'نامشخص'
      );

      if (!assignedPersonnelIdStrings.has(String(person.id))) {
        assignedPersonnelIds.push(person.id);
        assignedPersonnelIdStrings.add(String(person.id));
        if (pCode) assignedPersonnelCodes.add(pCode);
        if (nCode) assignedNationalCodes.add(nCode);
        if (fullName) assignedFullNames.add(fullName);

        assignedPersonnel.push({
          id: String(person.id),
          personnelId: person.id,
          personnelCode: pCode,
          nationalCode: nCode,
          firstName,
          lastName,
          fullName,
          unit: unitName,
          jobTitle: normalizeText(person.jobTitle || extra.jobTitle || ''),
          status: 'ACTIVE',
          assignedAt: assignment.createdAt?.toISOString(),
          assignedBy: assignment.assignedBy || undefined,
        });
      }
    }

    return {
      userId: userRow.id,
      userUid: userRow.uid,
      username: userRow.username || userRow.email,
      fullName: userRow.fullName || userRow.username || '',
      role: userRow.role,
      isAdmin,
      scope,
      canAccessAll,
      assignedPersonnelIds,
      assignedPersonnelIdStrings,
      assignedPersonnelCodes,
      assignedNationalCodes,
      assignedFullNames,
      assignedPersonnel,
    };
  }

  /**
   * Updates a user's personnel access scope and assigned personnel in PostgreSQL,
   * records a full Audit Log entry, and broadcasts real-time updates to all active sessions.
   */
  async updateUserPersonnelAssignments(input: UpdateUserPersonnelAssignmentsInput) {
    await this.ensureSchema();

    const {
      targetUserIdentifier,
      scope,
      personnelIds,
      actor,
      ipAddress,
      userAgent,
      skipAdminCheck = false,
    } = input;

    if (!skipAdminCheck && actor && !isAdminRole(actor.role)) {
      throw new ForbiddenError('فقط مدیر ارشد سامانه (Admin) مجاز به تغییر اشخاص مرتبط کاربران است.');
    }

    const targetUser = await this.findUserRow(targetUserIdentifier);
    if (!targetUser) {
      throw new NotFoundError('کاربر مورد نظر در پایگاه داده یافت نشد.');
    }

    const normalizedScope: PersonnelAccessScope =
      String(scope || '').toUpperCase() === 'ALL' ? 'ALL' : 'ASSIGNED';

    // Validate requested personnel against PostgreSQL schema.personnel
    const rawInputs = Array.isArray(personnelIds)
      ? Array.from(new Set(personnelIds.map((v) => String(v).trim()).filter(Boolean)))
      : [];

    const validPersonnelRows: Array<typeof schema.personnel.$inferSelect> = [];

    if (rawInputs.length > 0) {
      const numericIds = rawInputs
        .filter((v) => /^\d+$/.test(v))
        .map((v) => parseInt(v, 10))
        .filter((n) => Number.isSafeInteger(n));

      const candidateRecords = await db
        .select()
        .from(schema.personnel)
        .where(
          or(
            numericIds.length > 0 ? inArray(schema.personnel.id, numericIds) : sql`FALSE`,
            inArray(schema.personnel.personnelCode, rawInputs),
            inArray(schema.personnel.nationalCode, rawInputs)
          )
        );

      // Map by id, personnelCode, nationalCode to ensure every requested item is valid
      const byId = new Map<number, typeof schema.personnel.$inferSelect>();
      const byCode = new Map<string, typeof schema.personnel.$inferSelect>();
      const byNational = new Map<string, typeof schema.personnel.$inferSelect>();

      for (const row of candidateRecords) {
        byId.set(row.id, row);
        if (row.personnelCode) byCode.set(normalizeCode(row.personnelCode), row);
        if (row.nationalCode) byNational.set(normalizeCode(row.nationalCode), row);
      }

      const seenIds = new Set<number>();
      const invalidIdentifiers: string[] = [];
      const inactiveIdentifiers: string[] = [];

      for (const rawItem of rawInputs) {
        const asNum = /^\d+$/.test(rawItem) ? parseInt(rawItem, 10) : null;
        const normCode = normalizeCode(rawItem);
        const matched =
          (asNum !== null ? byId.get(asNum) : undefined) ||
          byCode.get(normCode) ||
          byNational.get(normCode);

        if (!matched) {
          invalidIdentifiers.push(rawItem);
          continue;
        }
        if (!isPersonnelActive(matched)) {
          inactiveIdentifiers.push(`${matched.firstName} ${matched.lastName} (${matched.personnelCode})`);
          continue;
        }
        if (!seenIds.has(matched.id)) {
          seenIds.add(matched.id);
          validPersonnelRows.push(matched);
        }
      }

      if (invalidIdentifiers.length > 0) {
        throw new ValidationError(
          `شناسه پرسنلی نامعتبر یا ناموجود در اطلاعات پرسنل مجتمع: ${invalidIdentifiers.join('، ')}`
        );
      }

      if (inactiveIdentifiers.length > 0) {
        throw new ValidationError(
          `امکان انتساب پرسنل غیرفعال وجود ندارد: ${inactiveIdentifiers.join('، ')}`
        );
      }
    }

    // Load previous state for Audit Log
    const previousCtx = await this.resolveAccessContext(targetUser);
    const previousScope = String(targetUser.personnelAccessScope || 'ASSIGNED').toUpperCase() as PersonnelAccessScope;
    const oldPersonnelSummary = previousCtx.assignedPersonnel.map((p) => ({
      id: p.id,
      personnelCode: p.personnelCode,
      nationalCode: p.nationalCode,
      fullName: p.fullName,
      unit: p.unit,
    }));

    const actorLabel =
      actor?.fullName || actor?.username || actor?.uid || 'Administrator';
    const actorUserRow = actor ? await this.findUserRow(actor) : null;

    // Update users.personnel_access_scope & user_personnel_assignments
    const existingProfileData = (targetUser.profileData as Record<string, any>) || {};
    await db
      .update(schema.users)
      .set({
        personnelAccessScope: normalizedScope,
        profileData: {
          ...existingProfileData,
          assignmentsConfigured: true,
          lastAssignmentUpdateAt: new Date().toISOString(),
          lastAssignmentUpdateBy: actorLabel,
        },
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, targetUser.id));

    await db
      .delete(schema.userPersonnelAssignments)
      .where(eq(schema.userPersonnelAssignments.userId, targetUser.id));

    if (validPersonnelRows.length > 0) {
      await db.insert(schema.userPersonnelAssignments).values(
        validPersonnelRows.map((person) => ({
          userId: targetUser.id,
          userUid: targetUser.uid,
          personnelId: person.id,
          personnelCode: normalizeCode(person.personnelCode),
          assignedBy: actorLabel,
          createdAt: new Date(),
        }))
      );
    }

    // Fetch updated context
    const updatedCtx = await this.resolveAccessContext(targetUser.id);
    const newPersonnelSummary = updatedCtx.assignedPersonnel.map((p) => ({
      id: p.id,
      personnelCode: p.personnelCode,
      nationalCode: p.nationalCode,
      fullName: p.fullName,
      unit: p.unit,
    }));

    const oldIdsSet = new Set(oldPersonnelSummary.map((p) => p.id));
    const newIdsSet = new Set(newPersonnelSummary.map((p) => p.id));
    const addedPersonnel = newPersonnelSummary.filter((p) => !oldIdsSet.has(p.id));
    const removedPersonnel = oldPersonnelSummary.filter((p) => !newIdsSet.has(p.id));

    // Record comprehensive Audit Log in PostgreSQL
    try {
      await db.insert(schema.auditLogs).values({
        userId: actorUserRow?.id ?? null,
        userUid: actorUserRow?.uid || actor?.uid || String(actor?.id || 'admin'),
        personnelCode: actorUserRow?.personnelNumber || actor?.personnelNumber || null,
        action: 'UPDATE_USER_PERSONNEL_ASSIGNMENTS',
        module: 'USERS',
        entityType: 'USER_PERSONNEL_ASSIGNMENT',
        entityId: targetUser.uid,
        oldValue: {
          scope: previousScope,
          count: oldPersonnelSummary.length,
          personnel: oldPersonnelSummary,
        },
        newValue: {
          scope: normalizedScope,
          count: newPersonnelSummary.length,
          personnel: newPersonnelSummary,
        },
        details: {
          description: `تغییر اشخاص مرتبط کاربر «${targetUser.fullName || targetUser.username}» توسط «${actorLabel}»`,
          targetUserId: targetUser.id,
          targetUserUid: targetUser.uid,
          targetUsername: targetUser.username,
          targetFullName: targetUser.fullName,
          previousScope,
          newScope: normalizedScope,
          previousPersonnelCount: oldPersonnelSummary.length,
          newPersonnelCount: newPersonnelSummary.length,
          previousPersonnel: oldPersonnelSummary,
          newPersonnel: newPersonnelSummary,
          addedPersonnel,
          removedPersonnel,
          actorUid: actorUserRow?.uid || actor?.uid || 'admin',
          actorName: actorLabel,
          timestamp: new Date().toISOString(),
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        result: 'SUCCESS',
        createdAt: new Date(),
      });
    } catch (auditErr: any) {
      console.error('[PersonnelAccessService] Failed to insert audit log:', auditErr?.message || auditErr);
    }

    // Broadcast real-time update to all open browser tabs and sessions
    const broadcastPayload = {
      userId: targetUser.id,
      uid: targetUser.uid,
      username: targetUser.username,
      personnelAccessScope: updatedCtx.scope,
      canAccessAll: updatedCtx.canAccessAll,
      assignedPersonnelIds: updatedCtx.assignedPersonnel.map((p) => p.id),
      assignedPersonnelCodes: updatedCtx.assignedPersonnel.map((p) => p.personnelCode),
      assignedPersonnel: updatedCtx.assignedPersonnel,
      updatedBy: actorLabel,
      updatedAt: new Date().toISOString(),
    };

    broadcastDataMutation('user_assignments', 'update', broadcastPayload);
    broadcastDataMutation('users', 'upsert', broadcastPayload);
    broadcastDataMutation('audit_logs', 'create', {
      action: 'UPDATE_USER_PERSONNEL_ASSIGNMENTS',
      entityId: targetUser.uid,
    });

    return broadcastPayload;
  }

  /**
   * Automatically revokes and cleans up user assignments when a personnel record
   * is deactivated or deleted, logs the event in audit_logs, and notifies all active sessions.
   */
  async handlePersonnelLifecycleChange(
    personnelId: number | string,
    reason: 'DEACTIVATED' | 'DELETED',
    actor?: { uid?: string; username?: string; fullName?: string }
  ): Promise<void> {
    await this.ensureSchema();
    const numericId = typeof personnelId === 'number' ? personnelId : parseInt(String(personnelId), 10);
    if (!Number.isFinite(numericId)) return;

    try {
      const existingAssignments = await db
        .select()
        .from(schema.userPersonnelAssignments)
        .where(eq(schema.userPersonnelAssignments.personnelId, numericId));

      if (existingAssignments.length === 0) return;

      const affectedUserUids = Array.from(new Set(existingAssignments.map((a) => a.userUid)));
      const affectedUserIds = Array.from(new Set(existingAssignments.map((a) => a.userId)));
      const personnelCode = existingAssignments[0]?.personnelCode || String(numericId);

      // Remove active assignments for the deactivated/deleted personnel
      await db
        .delete(schema.userPersonnelAssignments)
        .where(eq(schema.userPersonnelAssignments.personnelId, numericId));

      await db.insert(schema.auditLogs).values({
        userUid: actor?.uid || 'SYSTEM',
        action: 'AUTO_REVOKE_PERSONNEL_ASSIGNMENT',
        module: 'USERS',
        entityType: 'USER_PERSONNEL_ASSIGNMENT',
        entityId: String(numericId),
        oldValue: existingAssignments.map((a) => ({
          userId: a.userId,
          userUid: a.userUid,
          personnelId: a.personnelId,
          personnelCode: a.personnelCode,
        })),
        newValue: [],
        details: {
          description: `حذف خودکار انتساب پرسنل (${personnelCode}) از کاربران به علت ${reason === 'DELETED' ? 'حذف پرسنل' : 'غیرفعال شدن پرسنل'}`,
          personnelId: numericId,
          personnelCode,
          reason,
          affectedUserIds,
          affectedUserUids,
          actorName: actor?.fullName || actor?.username || 'SYSTEM',
          timestamp: new Date().toISOString(),
        },
        result: 'SUCCESS',
        createdAt: new Date(),
      });

      broadcastDataMutation('user_assignments', 'revoke_personnel', {
        personnelId: String(numericId),
        personnelCode,
        reason,
        affectedUserIds,
        affectedUserUids,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[PersonnelAccessService] Lifecycle cleanup error:', err?.message || err);
    }
  }

  /**
   * Checks whether a given personnel record or identifier is accessible by the user context
   */
  canAccessPersonnel(ctx: PersonnelAccessContext, target: any): boolean {
    if (ctx.canAccessAll) return true;
    if (ctx.assignedPersonnelIds.length === 0) return false;
    if (!target) return false;

    if (typeof target === 'string' || typeof target === 'number') {
      const str = String(target).trim();
      const norm = normalizeCode(str);
      const normName = normalizeText(str);
      return (
        ctx.assignedPersonnelIdStrings.has(str) ||
        ctx.assignedPersonnelCodes.has(norm) ||
        ctx.assignedNationalCodes.has(norm) ||
        (normName.length > 2 && ctx.assignedFullNames.has(normName))
      );
    }

    if (typeof target === 'object') {
      if (!isPersonnelActive(target)) return false;

      const idCandidates = [target.id, target.personnelId, target.personnel_id]
        .filter((v) => v !== undefined && v !== null)
        .map((v) => String(v).trim());
      for (const idStr of idCandidates) {
        if (ctx.assignedPersonnelIdStrings.has(idStr)) return true;
      }

      const codeCandidates = [
        target.personnelCode,
        target.personnel_code,
        target.personnelNumber,
        target.personnel_number,
        target.code,
      ]
        .filter(Boolean)
        .map((v) => normalizeCode(v));
      for (const code of codeCandidates) {
        if (code && ctx.assignedPersonnelCodes.has(code)) return true;
      }

      const nationalCandidates = [
        target.nationalCode,
        target.national_code,
        target.nationalId,
        target.national_id,
      ]
        .filter(Boolean)
        .map((v) => normalizeCode(v));
      for (const nat of nationalCandidates) {
        if (nat && ctx.assignedNationalCodes.has(nat)) return true;
      }

      const fullName = normalizeText(
        target.fullName ||
          target.full_name ||
          (target.firstName || target.first_name
            ? `${target.firstName || target.first_name} ${target.lastName || target.last_name || ''}`
            : '')
      );
      if (fullName && ctx.assignedFullNames.has(fullName)) return true;
    }

    return false;
  }

  /**
   * Filters a list of personnel records according to the user's PersonnelAccessContext
   */
  filterPersonnelList<T>(ctx: PersonnelAccessContext, list: T[]): T[] {
    if (!Array.isArray(list)) return [];
    if (ctx.canAccessAll) return list;
    if (ctx.assignedPersonnelIds.length === 0) return [];
    return list.filter((item) => this.canAccessPersonnel(ctx, item));
  }

  /**
   * Determines whether a cross-module record (Medical Exam, Clinic Visit, Nutrition,
   * Warning, Incident, Work Permit, Training, PPE, Non-Conformance, Referral, etc.)
   * belongs to or involves any of the user's assigned personnel.
   */
  doesModuleRecordMatchContext(ctx: PersonnelAccessContext, record: any): boolean {
    if (ctx.canAccessAll) return true;
    if (ctx.assignedPersonnelIds.length === 0) return false;
    if (!record || typeof record !== 'object') return false;

    // 1. Direct Personnel ID fields
    const directIdFields = [
      record.personnelId,
      record.personnel_id,
      record.involvedPersonnelId,
      record.involved_personnel_id,
      record.workerId,
      record.worker_id,
      record.employeeId,
      record.targetPersonnelId,
    ];
    for (const val of directIdFields) {
      if (val !== undefined && val !== null && val !== '') {
        const str = String(val).trim();
        if (ctx.assignedPersonnelIdStrings.has(str) || ctx.assignedPersonnelCodes.has(normalizeCode(str))) {
          return true;
        }
      }
    }

    // 2. Personnel Code / National Code fields
    const codeFields = [
      record.personnelCode,
      record.personnel_code,
      record.personnelNumber,
      record.personnel_number,
      record.employeeCode,
      record.nationalCode,
      record.national_code,
      record.nationalId,
      record.national_id,
      record.requesterCode,
      record.acceptorCode,
      record.supervisorCode,
      record.assignedPersonnelCode,
      record.requesterPersonnelCode,
      record.assignedTo,
      record.assigned_to,
      record.targetPersonnelCode,
      record.injuredPersonnelCode,
    ];
    for (const val of codeFields) {
      if (val !== undefined && val !== null && val !== '') {
        const norm = normalizeCode(val);
        if (
          norm &&
          (ctx.assignedPersonnelCodes.has(norm) ||
            ctx.assignedNationalCodes.has(norm) ||
            ctx.assignedPersonnelIdStrings.has(String(val).trim()))
        ) {
          return true;
        }
      }
    }

    // 3. Nested JSONB containers (formData, extraData, metadata, details, currentStageAssignee)
    const nestedContainers = [
      record.formData,
      record.form_data,
      record.extraData,
      record.extra_data,
      record.metadata,
      record.details,
      record.currentStageAssignee,
      record.current_stage_assignee,
    ].filter((c) => c && typeof c === 'object');

    for (const container of nestedContainers) {
      const nestedCodeKeys = [
        'personnelId',
        'personnel_id',
        'personnelCode',
        'personnel_code',
        'nationalCode',
        'national_code',
        'requesterCode',
        'acceptorCode',
        'supervisorCode',
        'hseOfficerCode',
        'issuerCode',
        'injuredPersonnelCode',
        'employeeCode',
        'assignedTo',
      ];
      for (const key of nestedCodeKeys) {
        const val = container[key];
        if (val !== undefined && val !== null && val !== '') {
          const str = String(val).trim();
          const norm = normalizeCode(str);
          if (
            ctx.assignedPersonnelIdStrings.has(str) ||
            ctx.assignedPersonnelCodes.has(norm) ||
            ctx.assignedNationalCodes.has(norm)
          ) {
            return true;
          }
        }
      }

      const nestedNameKeys = [
        'fullName',
        'personnelName',
        'requesterName',
        'acceptorName',
        'supervisorName',
        'injuredName',
        'workerName',
      ];
      for (const key of nestedNameKeys) {
        const val = container[key];
        if (val) {
          const normName = normalizeText(val);
          if (normName && ctx.assignedFullNames.has(normName)) {
            return true;
          }
        }
      }

      // Arrays inside container (e.g., workers, teamMembers, involvedPersonnel, attendees, personnelList)
      const arrayKeys = [
        'workers',
        'teamMembers',
        'involvedPersonnel',
        'personnelList',
        'attendees',
        'participants',
        'injuredPersons',
      ];
      for (const arrKey of arrayKeys) {
        const arr = container[arrKey];
        if (Array.isArray(arr)) {
          for (const entry of arr) {
            if (typeof entry === 'string' || typeof entry === 'number') {
              if (this.canAccessPersonnel(ctx, entry)) return true;
            } else if (entry && typeof entry === 'object') {
              if (this.canAccessPersonnel(ctx, entry) || this.doesModuleRecordMatchContext(ctx, entry)) {
                return true;
              }
            }
          }
        }
      }
    }

    // 4. Top-level arrays of personnel on the record
    const topLevelArrays = [
      record.workers,
      record.involvedPersonnel,
      record.attendees,
      record.personnelList,
    ];
    for (const arr of topLevelArrays) {
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (this.canAccessPersonnel(ctx, item)) return true;
        }
      }
    }

    // 5. Full Name fallback for records that only persisted personnel name
    const nameFields = [
      record.fullName,
      record.full_name,
      record.personnelName,
      record.personnel_name,
      record.workerName,
      record.employeeName,
      record.assignedToName,
      record.assigned_to_name,
      record.requesterName,
      record.requester_name,
      // Only use `record.name` if the record looks like a personnel-linked record (e.g. safety warning)
      record.personnelCode !== undefined || record.violationType !== undefined || record.rewardType !== undefined
        ? record.name
        : null,
    ];
    for (const val of nameFields) {
      if (val) {
        const normName = normalizeText(val);
        if (normName && ctx.assignedFullNames.has(normName)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Filters an array of module records so the user only receives records for their assigned personnel
   */
  filterModuleRecords<T>(ctx: PersonnelAccessContext, records: T[]): T[] {
    if (!Array.isArray(records)) return [];
    if (ctx.canAccessAll) return records;
    if (ctx.assignedPersonnelIds.length === 0) return [];
    return records.filter((rec) => this.doesModuleRecordMatchContext(ctx, rec));
  }

  /**
   * Enforces that the user is authorized to perform an operation on the target personnel or module record
   */
  assertCanAccessRecordOrPersonnel(
    ctx: PersonnelAccessContext,
    target: any,
    customMessage?: string
  ): void {
    if (ctx.canAccessAll) return;

    const allowed =
      this.canAccessPersonnel(ctx, target) || this.doesModuleRecordMatchContext(ctx, target);

    if (!allowed) {
      throw new ForbiddenError(
        customMessage ||
          'شما مجوز دسترسی یا ثبت/ویرایش اطلاعات برای این شخص را ندارید (خارج از لیست اشخاص مرتبط کاربری شما).'
      );
    }
  }
}

export const personnelAccessService = new PersonnelAccessService();
