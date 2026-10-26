import { desc, eq, or } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';

// In-memory incidents fallback buffer (empty by default - پایگاه داده is authoritative)
const inMemoryIncidents: any[] = [];

export class IncidentRepository {
  async findAll() {
    try {
      const records = await db.select().from(schema.incidents).orderBy(desc(schema.incidents.createdAt));
      return records;
    } catch (e) {
      console.warn('Fallback to in-memory incidents buffer:', e);
      return inMemoryIncidents;
    }
  }

  async findByNumber(incidentNumber: string) {
    try {
      const [record] = await db
        .select()
        .from(schema.incidents)
        .where(eq(schema.incidents.incidentNumber, incidentNumber));
      if (record) return record;
    } catch (e) {
      // Fallback
    }
    return inMemoryIncidents.find((i) => i.incidentNumber === incidentNumber || i.reportNumber === incidentNumber) || null;
  }

  async create(data: any) {
    try {
      let existing = null;
      const isNum = data.id && (typeof data.id === 'number' || (typeof data.id === 'string' && /^\d+$/.test(String(data.id).trim())));
      if (isNum) {
        const byId = await db.select().from(schema.incidents).where(eq(schema.incidents.id, Number(data.id)));
        if (byId.length > 0) existing = byId[0];
      }
      if (!existing && (data.incidentNumber || data.reportNumber)) {
        const num = data.incidentNumber || data.reportNumber;
        const byNum = await db.select().from(schema.incidents).where(eq(schema.incidents.incidentNumber, num));
        if (byNum.length > 0) existing = byNum[0];
      }

      const valuesToPersist = {
        incidentNumber: data.incidentNumber || data.reportNumber,
        incidentDate: String(data.incidentDate || data.eventDate || new Date().toLocaleDateString('fa-IR')),
        incidentTime: data.incidentTime || data.eventTime || '10:00',
        incidentType: data.incidentType || data.category || 'NEAR_MISS',
        severity: data.severity || 'MINOR',
        location: data.location || data.locationSite || 'کارگاه',
        personnelName: data.reporterName || data.personnelName,
        description: data.description || data.title || 'گزارش رویداد ایمنی',
        status: data.status || 'REPORTED',
        unitId: data.unitId ? Number(data.unitId) : null,
        correctiveActions: typeof data.correctiveActions === 'string' ? data.correctiveActions : (data.capaList ? JSON.stringify(data.capaList) : null),
        rootCauses: typeof data.rootCauses === 'string' ? data.rootCauses : (data.rootCauses ? JSON.stringify(data.rootCauses) : null),
        immediateCauses: data.immediateCauses || data.immediateActionTaken || null,
        lostWorkDays: Number(data.lostWorkDays || data.lostDays || 0),
      };

      if (existing) {
        const [updated] = await db
          .update(schema.incidents)
          .set(valuesToPersist)
          .where(eq(schema.incidents.id, existing.id))
          .returning();
        return updated || { ...existing, ...data };
      } else {
        const [inserted] = await db
          .insert(schema.incidents)
          .values(valuesToPersist)
          .returning();
        if (inserted) return inserted;
      }
    } catch (e) {
      console.warn('Incident پایگاه داده insert/update fallback:', e);
    }

    inMemoryIncidents.unshift(data);
    return data;
  }

  async updateStatus(incidentNumber: string, status: string, incidentData?: any) {
    const mem = inMemoryIncidents.find((i) => i.incidentNumber === incidentNumber || i.reportNumber === incidentNumber);
    if (mem) {
      mem.status = status;
      if (incidentData) mem.incidentData = { ...mem.incidentData, ...incidentData };
      mem.updatedAt = new Date().toISOString();
    }

    try {
      await db
        .update(schema.incidents)
        .set({
          status,
          closedAt: status === 'CLOSED' ? new Date() : undefined,
        })
        .where(eq(schema.incidents.incidentNumber, incidentNumber));
    } catch (e) {
      // Handled
    }
  }

  async delete(idOrNumber: string | number) {
    const raw = String(idOrNumber || '').trim();
    if (!raw) return { success: false, count: 0 };
    const isNum = /^\d+$/.test(raw);
    let deletedCount = 0;

    // 1. Remove from inMemoryIncidents buffer
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

    // 2. Delete from پایگاه داده
    try {
      if (isNum) {
        const res = await db.delete(schema.incidents).where(
          or(
            eq(schema.incidents.id, Number(raw)),
            eq(schema.incidents.incidentNumber, raw)
          )
        ).returning();
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
