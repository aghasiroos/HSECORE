import { desc, eq, and, sql, or } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import { logger } from '../../core/logger.ts';
import { ensurePermitTablesExist } from '../../services/permitNumberService.ts';

// In-memory fallback permits list
const inMemoryPermits: any[] = [
  {
    id: 1,
    permitNumber: 'PTW-140409-0012',
    title: 'تعمیرات اساسی خط لوله بخار فشار بالا',
    permitType: 'HOT_WORK',
    status: 'IN_PROGRESS',
    location: 'محوطه واحد تقطیر شماره ۲ - سکوی C',
    startDate: new Date(Date.now() - 3600000).toISOString(),
    endDate: new Date(Date.now() + 86400000).toISOString(),
    hazards: ['حرارت بالا', 'گازهای قابل اشتعال', 'فشار بخار'],
    precautions: ['تهویه مکانیکی', 'آماده‌سازی کپسول اطفا', 'مسدودسازی خطوط'],
    applicantName: 'رضا صیادی',
    safetyOfficerName: 'مرتضی تقوی',
    isClosed: false,
    createdAt: new Date().toISOString(),
    permitData: {},
  },
];

export class PTWRepository {
  async findAll() {
    try {
      await ensurePermitTablesExist();
      const records = await db
        .select()
        .from(schema.workPermits)
        .orderBy(desc(schema.workPermits.createdAt));

      // Authoritative database result
      return records;
    } catch (e) {
      logger.error('Database query failed for PTW list, using fallback:', e);
    }
    return inMemoryPermits;
  }

  async findByNumber(permitNumber: string) {
    try {
      await ensurePermitTablesExist();
      const [permit] = await db
        .select()
        .from(schema.workPermits)
        .where(eq(schema.workPermits.permitNumber, permitNumber));

      if (permit) return permit;
    } catch (e) {
      // Fallback
    }
    return inMemoryPermits.find((p) => p.permitNumber === permitNumber) || null;
  }

  async delete(idOrNumber: string | number): Promise<boolean> {
    const str = String(idOrNumber);
    const numId = Number(idOrNumber);

    // Remove from in-memory fallback
    for (let i = inMemoryPermits.length - 1; i >= 0; i--) {
      if (String(inMemoryPermits[i].id) === str || inMemoryPermits[i].permitNumber === str) {
        inMemoryPermits.splice(i, 1);
      }
    }

    try {
      await ensurePermitTablesExist();
      if (!isNaN(numId) && Number.isInteger(numId) && numId > 0) {
        await db
          .delete(schema.workPermits)
          .where(or(eq(schema.workPermits.id, numId), eq(schema.workPermits.permitNumber, str)));
      } else {
        await db
          .delete(schema.workPermits)
          .where(eq(schema.workPermits.permitNumber, str));
      }
    } catch (e) {
      logger.error('Error purging permit from database:', e);
    }
    return true;
  }

  async findActivePermitsAtLocation(location: string, startDate: Date, endDate: Date, excludePermitNumber?: string) {
    const all = await this.findAll();
    return all.filter((p: any) => {
      if (excludePermitNumber && p.permitNumber === excludePermitNumber) return false;
      if (p.isClosed || p.status === 'EXPIRED' || p.status === 'REJECTED' || p.status === 'CANCELLED') return false;

      // Location match
      const sameLocation = p.location && location && (p.location.toLowerCase().includes(location.toLowerCase()) || location.toLowerCase().includes(p.location.toLowerCase()));
      if (!sameLocation) return false;

      // Time overlap check: startA <= endB && endA >= startB
      const pStart = new Date(p.startDate).getTime();
      const pEnd = new Date(p.endDate).getTime();
      const reqStart = startDate.getTime();
      const reqEnd = endDate.getTime();

      return reqStart <= pEnd && reqEnd >= pStart;
    });
  }

  async create(data: any) {
    inMemoryPermits.unshift(data);

    try {
      await ensurePermitTablesExist();
      const [inserted] = await db
        .insert(schema.workPermits)
        .values({
          permitNumber: data.permitNumber,
          title: data.title || `مجوز کار شماره ${data.permitNumber}`,
          permitType: data.permitType || 'HOT',
          status: data.status || 'SUBMITTED',
          companyId: data.companyId ? Number(data.companyId) : null,
          unitId: data.unitId ? Number(data.unitId) : null,
          location: data.location || 'کارگاه',
          description: data.description,
          validFrom: String(data.startDate || data.validFrom || new Date().toISOString()),
          validTo: String(data.endDate || data.validTo || new Date().toISOString()),
          contractorName: data.contractorName || data.applicantName,
          hazards: data.hazards || [],
          precautions: data.precautions || [],
          formData: data.permitData || data.formData || {},
        })
        .returning();

      if (inserted) return inserted;
    } catch (e) {
      // Handled
    }
    return data;
  }

  async updateStatus(permitNumber: string, status: string, isClosed: boolean = false) {
    const mem = inMemoryPermits.find((p) => p.permitNumber === permitNumber);
    if (mem) {
      mem.status = status;
      mem.isClosed = isClosed;
      mem.updatedAt = new Date().toISOString();
    }

    try {
      await db
        .update(schema.workPermits)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(schema.workPermits.permitNumber, permitNumber));
    } catch (e) {
      // Handled
    }
  }
}

export const ptwRepository = new PTWRepository();
