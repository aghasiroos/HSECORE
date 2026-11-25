import { desc, eq, like, or } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';

// In-memory incidents fallback buffer (empty by default - PostgreSQL is authoritative)
const inMemoryIncidents: any[] = [];

function safeParseJson<T>(val: any, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val as T;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function hydrateIncidentRecord(row: any): any {
  if (!row) return null;
  const payload = safeParseJson<Record<string, any>>(row.payload, {});
  const legacyIncidentData = safeParseJson<Record<string, any>>(row.incidentData, {});
  const mergedExtra = { ...legacyIncidentData, ...payload };

  const parsedRootCauses = safeParseJson<any>(row.rootCauses, mergedExtra.rootCauses || []);
  const parsedCapaList = safeParseJson<any[]>(
    mergedExtra.capaActions || mergedExtra.capaList || row.correctiveActions,
    []
  );

  const rhsF68 = mergedExtra.rhsF68 || undefined;
  const rhsF28 = mergedExtra.rhsF28 || undefined;
  const formVariant: 'RHS-F68' | 'RHS-F28' =
    mergedExtra.formVariant === 'RHS-F28' || Boolean(rhsF28) ? 'RHS-F28' : 'RHS-F68';
  const riskAssessment =
    mergedExtra.riskAssessment ||
    (rhsF68?.riskAssessment
      ? {
          probability: rhsF68.riskAssessment.probability,
          severity: rhsF68.riskAssessment.severity,
          detection: rhsF68.riskAssessment.detection,
          rpn: rhsF68.riskAssessment.rpn,
          riskLevel: rhsF68.riskAssessment.riskLevel,
          riskLevelFa: rhsF68.riskAssessment.riskLevelFa,
          riskLevelColor:
            rhsF68.riskAssessment.riskLevel === 'E'
              ? 'red'
              : rhsF68.riskAssessment.riskLevel === 'H'
              ? 'orange'
              : rhsF68.riskAssessment.riskLevel === 'M'
              ? 'yellow'
              : 'green',
        }
      : undefined);

  const workflowStage =
    row.workflowStage ||
    mergedExtra.workflowStage ||
    (row.isDraft ? 'DRAFT' : row.status === 'Resolved & Closed' || row.status === 'CLOSED' ? 'CLOSED' : 'HSE_HEAD_TRIAGE');

  const involvedPersonnel = Array.isArray(rhsF68?.involvedPersonnel)
    ? rhsF68.involvedPersonnel
    : Array.isArray(mergedExtra.involvedPersonnel)
    ? mergedExtra.involvedPersonnel
    : [];

  return {
    ...row,
    formVariant,
    reportNumber: row.incidentNumber || row.reportNumber || `INC-${row.id}`,
    title: row.title || mergedExtra.title || row.description || 'گزارش رویداد / ناهنجاری ایمنی',
    reportDate: row.reportDate || mergedExtra.reportDate || rhsF28?.reportDate || rhsF68?.reportDate || row.incidentDate,
    eventDate: row.incidentDate || mergedExtra.eventDate || rhsF28?.observationDate,
    eventTime: row.incidentTime || mergedExtra.eventTime || rhsF28?.observationTime || '10:00',
    locationSite: row.location || mergedExtra.locationSite || rhsF28?.locationSite || '',
    exactLocation: row.exactLocation || mergedExtra.exactLocation || rhsF28?.exactLocation || rhsF68?.exactLocation || '',
    companyName: row.companyName || mergedExtra.companyName || rhsF68?.companyName || '',
    department: row.department || mergedExtra.department || rhsF28?.department || '',
    reporterPersonnelCode:
      row.reporterPersonnelCode || mergedExtra.reporterPersonnelCode || rhsF28?.reporterPersonnelCode || '',
    reporterName: row.reporterName || row.personnelName || mergedExtra.reporterName || rhsF28?.reporterName || '',
    reporterJobTitle: row.reporterJobTitle || mergedExtra.reporterJobTitle || rhsF68?.reporterJobTitle || '',
    reporterRole: mergedExtra.reporterRole || 'User',
    category: mergedExtra.category || row.incidentType,
    categoryFa: mergedExtra.categoryFa,
    incidentTypeId: mergedExtra.incidentTypeId || '',
    immediateActionTaken:
      row.immediateCauses || mergedExtra.immediateActions || mergedExtra.immediateActionTaken || rhsF28?.actionsTaken || '',
    isOshaRecordable: Boolean(mergedExtra.isOshaRecordable),
    lostDays: Number(row.lostWorkDays ?? mergedExtra.lostDays ?? 0) || 0,
    injuredPersonName: mergedExtra.injuredPersonName || rhsF28?.injuredPersonName || '',
    injuredPersonCode: mergedExtra.injuredPersonCode || rhsF28?.injuredPersonCode || '',
    bodyPartAffected: mergedExtra.bodyPartAffected || 'None',
    medicalTreatmentType: mergedExtra.medicalTreatmentType || 'N/A',
    rootCauses: parsedRootCauses,
    fiveWhys: mergedExtra.fiveWhys || [],
    toxicGasLeak: mergedExtra.toxicGasLeak,
    riskAssessment,
    rpn: row.rpn ?? riskAssessment?.rpn ?? null,
    riskLevel: row.riskLevel ?? riskAssessment?.riskLevel ?? null,
    capaList: Array.isArray(parsedCapaList) ? parsedCapaList : [],
    attachedFileIds: Array.isArray(mergedExtra.attachedFileIds) ? mergedExtra.attachedFileIds : [],
    involvedPersonnel,
    assignedExpertCode: rhsF68?.hseUnitReview?.assignedExpertCode || mergedExtra.assignedExpertCode || '',
    assignedTo: rhsF68?.hseUnitReview?.assignedExpertCode || mergedExtra.assignedTo || '',
    createdByUid: mergedExtra.createdByUid || '',
    workflowStage,
    isDraft: Boolean(row.isDraft || workflowStage === 'DRAFT'),
    rhsF68,
    rhsF28,
    supplementaryForm: mergedExtra.supplementaryForm || undefined,
    supplementaryFormId: mergedExtra.supplementaryForm?.id || mergedExtra.supplementaryFormId || undefined,
    supplementaryFormStatus: mergedExtra.supplementaryForm?.status || mergedExtra.supplementaryFormStatus || undefined,
    incidentData: mergedExtra,
    version: Number(row.version ?? 1),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export class IncidentRepository {
  async findAll() {
    try {
      const records = await db.select().from(schema.incidents).orderBy(desc(schema.incidents.createdAt));
      return records.map(hydrateIncidentRecord);
    } catch (e) {
      console.warn('Fallback to in-memory incidents buffer:', e);
      return inMemoryIncidents.map(hydrateIncidentRecord);
    }
  }

  async findByIdOrNumber(idOrNumber: string | number) {
    const raw = String(idOrNumber || '').trim();
    if (!raw) return null;
    const isNum = /^\d+$/.test(raw);
    try {
      const rows = await db
        .select()
        .from(schema.incidents)
        .where(
          isNum
            ? or(eq(schema.incidents.id, Number(raw)), eq(schema.incidents.incidentNumber, raw))
            : eq(schema.incidents.incidentNumber, raw)
        )
        .limit(1);
      if (rows.length > 0) return hydrateIncidentRecord(rows[0]);
    } catch (e) {
      // Fallback
    }
    const found = inMemoryIncidents.find(
      (i) => String(i.id) === raw || i.incidentNumber === raw || i.reportNumber === raw
    );
    return found ? hydrateIncidentRecord(found) : null;
  }

  async findByNumber(incidentNumber: string) {
    return this.findByIdOrNumber(incidentNumber);
  }

  async generateNextReportNumber(
    jalaliYear: string,
    formType: 'RHS-F68' | 'RHS-F28' = 'RHS-F68'
  ): Promise<string> {
    const cleanYear = String(jalaliYear || '1405').replace(/[^0-9]/g, '').slice(0, 4) || '1405';
    const formPrefix = formType === 'RHS-F28' ? 'RHS-F28' : 'RHS-F68';
    const prefix = `${formPrefix}-${cleanYear}-`;
    try {
      const rows = await db
        .select({ incidentNumber: schema.incidents.incidentNumber })
        .from(schema.incidents)
        .where(like(schema.incidents.incidentNumber, `${prefix}%`));

      let maxSeq = 0;
      for (const r of rows) {
        if (!r.incidentNumber) continue;
        const seqPart = r.incidentNumber.replace(prefix, '');
        const n = parseInt(seqPart, 10);
        if (!isNaN(n) && n > maxSeq) maxSeq = n;
      }
      return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
    } catch {
      const matching = inMemoryIncidents.filter((i) => String(i.incidentNumber || '').startsWith(prefix));
      return `${prefix}${String(matching.length + 1).padStart(3, '0')}`;
    }
  }

  async create(data: any) {
    try {
      let existing: any = null;
      const isNum =
        data.id &&
        (typeof data.id === 'number' || (typeof data.id === 'string' && /^\d+$/.test(String(data.id).trim())));
      if (isNum) {
        const byId = await db.select().from(schema.incidents).where(eq(schema.incidents.id, Number(data.id)));
        if (byId.length > 0) existing = byId[0];
      }
      if (!existing && (data.incidentNumber || data.reportNumber)) {
        const num = data.incidentNumber || data.reportNumber;
        const byNum = await db
          .select()
          .from(schema.incidents)
          .where(eq(schema.incidents.incidentNumber, num));
        if (byNum.length > 0) existing = byNum[0];
      }

      const payloadObj = {
        ...(data.incidentData && typeof data.incidentData === 'object' ? data.incidentData : {}),
        ...(data.payload && typeof data.payload === 'object' ? data.payload : {}),
      };

      const valuesToPersist: any = {
        incidentNumber: data.incidentNumber || data.reportNumber,
        title: data.title || payloadObj.title || data.description || 'گزارش رویداد و ناهنجاری ایمنی',
        reportDate: data.reportDate || payloadObj.reportDate || data.incidentDate,
        incidentDate: String(data.incidentDate || data.eventDate || new Date().toLocaleDateString('fa-IR')),
        incidentTime: data.incidentTime || data.eventTime || '10:00',
        incidentType: data.incidentType || data.category || 'UNSAFE_ACT',
        severity: data.severity || 'MINOR',
        companyName: data.companyName ?? payloadObj.companyName ?? null,
        department: data.department ?? payloadObj.department ?? null,
        location: data.location || data.locationSite || data.department || 'محوطه کارخانه',
        exactLocation: data.exactLocation ?? payloadObj.exactLocation ?? null,
        personnelName: data.reporterName || data.personnelName || null,
        reporterPersonnelCode: data.reporterPersonnelCode ?? payloadObj.reporterPersonnelCode ?? null,
        reporterName: data.reporterName || data.personnelName || null,
        reporterJobTitle: data.reporterJobTitle ?? payloadObj.reporterJobTitle ?? null,
        description: data.description || data.title || 'گزارش رویداد ایمنی',
        immediateCauses: data.immediateCauses || data.immediateActionTaken || payloadObj.immediateActions || null,
        rootCauses:
          typeof data.rootCauses === 'string'
            ? data.rootCauses
            : data.rootCauses
            ? JSON.stringify(data.rootCauses)
            : null,
        correctiveActions:
          typeof data.correctiveActions === 'string'
            ? data.correctiveActions
            : data.capaList || payloadObj.capaActions
            ? JSON.stringify(data.capaList || payloadObj.capaActions)
            : null,
        lostWorkDays: Number(data.lostWorkDays || data.lostDays || 0),
        status: data.status || 'Submitted',
        workflowStage: data.workflowStage || (data.isDraft ? 'DRAFT' : 'HSE_HEAD_TRIAGE'),
        isDraft: Boolean(data.isDraft),
        rpn: data.rpn !== undefined && data.rpn !== null ? Number(data.rpn) : null,
        riskLevel: data.riskLevel ?? null,
        investigator: data.investigator ?? payloadObj.rhsF68?.hseUnitReview?.assignedExpertName ?? null,
        unitId: data.unitId ? Number(data.unitId) : null,
        payload: payloadObj,
        closedAt: data.closedAt ?? (data.workflowStage === 'CLOSED' || data.status === 'Resolved & Closed' ? new Date() : null),
      };

      if (existing) {
        const [updated] = await db
          .update(schema.incidents)
          .set({
            ...valuesToPersist,
            version: Number(existing.version ?? 1) + 1,
            updatedAt: new Date(),
          })
          .where(eq(schema.incidents.id, existing.id))
          .returning();
        return hydrateIncidentRecord(updated || { ...existing, ...valuesToPersist });
      } else {
        const [inserted] = await db.insert(schema.incidents).values(valuesToPersist).returning();
        if (inserted) return hydrateIncidentRecord(inserted);
      }
    } catch (e: any) {
      if (e?.statusCode === 409) throw e;
      console.warn('Incident database insert/update fallback:', e?.message || e);
    }

    const memRecord = {
      id: data.id || Date.now(),
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: Number(data.version || 1),
    };
    inMemoryIncidents.unshift(memRecord);
    return hydrateIncidentRecord(memRecord);
  }

  async updateById(id: number, patch: Record<string, any>) {
    try {
      const [updated] = await db
        .update(schema.incidents)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(schema.incidents.id, id))
        .returning();
      if (updated) return hydrateIncidentRecord(updated);
    } catch (e: any) {
      console.warn('Incident updateById error:', e?.message || e);
      throw e;
    }
    return null;
  }

  async updateStatus(incidentNumber: string, status: string, incidentData?: any) {
    const mem = inMemoryIncidents.find((i) => i.incidentNumber === incidentNumber || i.reportNumber === incidentNumber);
    if (mem) {
      mem.status = status;
      if (incidentData) mem.payload = { ...mem.payload, ...incidentData };
      mem.updatedAt = new Date().toISOString();
    }

    try {
      const [existing] = await db
        .select()
        .from(schema.incidents)
        .where(eq(schema.incidents.incidentNumber, incidentNumber))
        .limit(1);
      if (existing) {
        const existingPayload = safeParseJson<Record<string, any>>(existing.payload, {});
        const mergedPayload = incidentData ? { ...existingPayload, ...incidentData } : existingPayload;
        await db
          .update(schema.incidents)
          .set({
            status,
            payload: mergedPayload,
            closedAt: status === 'CLOSED' || status === 'Resolved & Closed' ? new Date() : undefined,
            version: Number(existing.version ?? 1) + 1,
            updatedAt: new Date(),
          })
          .where(eq(schema.incidents.id, existing.id));
      }
    } catch {
      // Handled
    }
  }

  async delete(idOrNumber: string | number) {
    const raw = String(idOrNumber || '').trim();
    if (!raw) return { success: false, count: 0 };
    const isNum = /^\d+$/.test(raw);
    let deletedCount = 0;

    const initialLen = inMemoryIncidents.length;
    for (let i = inMemoryIncidents.length - 1; i >= 0; i--) {
      if (
        String(inMemoryIncidents[i].id) === raw ||
        String(inMemoryIncidents[i].incidentNumber) === raw ||
        String(inMemoryIncidents[i].reportNumber) === raw
      ) {
        inMemoryIncidents.splice(i, 1);
      }
    }
    if (inMemoryIncidents.length < initialLen) {
      deletedCount += initialLen - inMemoryIncidents.length;
    }

    try {
      if (isNum) {
        const res = await db
          .delete(schema.incidents)
          .where(or(eq(schema.incidents.id, Number(raw)), eq(schema.incidents.incidentNumber, raw)))
          .returning();
        if (res.length > 0) return { success: true, count: res.length };
      }
      const res = await db.delete(schema.incidents).where(eq(schema.incidents.incidentNumber, raw)).returning();
      return { success: res.length > 0 || deletedCount > 0, count: res.length || deletedCount };
    } catch (error) {
      console.warn('Incident delete DB operation failed, returning in-memory count:', error);
      return { success: deletedCount > 0, count: deletedCount };
    }
  }
}

export const incidentRepository = new IncidentRepository();
