import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';

export class PersonnelRepository {
  async getHierarchy() {
    const [companies, sites, departments, units, positions] = await Promise.all([
      db.select().from(schema.orgCompanies),
      db.select().from(schema.orgSites),
      db.select().from(schema.orgDepartments),
      db.select().from(schema.orgUnits),
      db.select().from(schema.orgPositions),
    ]);

    return { companies, sites, departments, units, positions };
  }

  async seedHierarchy(data: {
    companies?: Array<{ code: string; name: string; description?: string }>;
    sites?: Array<{ companyCode: string; code: string; name: string; location?: string }>;
    departments?: Array<{ siteCode: string; code: string; name: string }>;
    units?: Array<{ departmentCode: string; code: string; name: string }>;
    positions?: Array<{ title: string; code?: string; riskLevel?: string }>;
  }) {
    if (data.companies && data.companies.length > 0) {
      for (const comp of data.companies) {
        await db
          .insert(schema.orgCompanies)
          .values({ code: comp.code, name: comp.name, description: comp.description })
          .onConflictDoNothing({ target: schema.orgCompanies.code });
      }
    }
    return { success: true };
  }

  async findAll() {
    const list = await db.select().from(schema.personnel).orderBy(desc(schema.personnel.createdAt));
    return list.map((r: any) => {
      const extra = (r.extraData && typeof r.extraData === 'object') ? r.extraData : {};
      return {
        ...extra,
        ...r,
        phone: r.mobile || extra.phone || '',
        mobile: r.mobile || extra.phone || '',
        unit: extra.unit || r.unit || '',
        department: extra.department || extra.unit || r.department || '',
        workplace: extra.workplace || '',
        education: extra.education || '',
        notes: extra.notes || '',
        childrenCount: extra.childrenCount ?? '0',
        maritalStatus: extra.maritalStatus || '',
        militaryStatus: extra.militaryStatus || '',
        profilePhoto: extra.profilePhoto || '',
      };
    });
  }

  async findByIdentifier(identifier: string) {
    const isNum = /^\d+$/.test(identifier);
    let condition;
    if (isNum) {
      const numId = parseInt(identifier, 10);
      condition = sql`${schema.personnel.id} = ${numId} OR ${schema.personnel.personnelCode} = ${identifier} OR ${schema.personnel.nationalCode} = ${identifier}`;
    } else {
      condition = sql`${schema.personnel.personnelCode} = ${identifier} OR ${schema.personnel.nationalCode} = ${identifier}`;
    }

    const result = await db.select().from(schema.personnel).where(condition);
    const r = result[0];
    if (!r) return null;
    const extra = (r.extraData && typeof r.extraData === 'object') ? (r.extraData as Record<string, any>) : {};
    return {
      ...extra,
      ...r,
      phone: r.mobile || extra.phone || '',
      mobile: r.mobile || extra.phone || '',
      unit: extra.unit || '',
      department: extra.department || extra.unit || '',
      workplace: extra.workplace || '',
      education: extra.education || '',
      notes: extra.notes || '',
      childrenCount: extra.childrenCount ?? '0',
      maritalStatus: extra.maritalStatus || '',
      militaryStatus: extra.militaryStatus || '',
      profilePhoto: extra.profilePhoto || '',
    };
  }

  async delete(identifier: string) {
    const isNum = /^\d+$/.test(identifier);
    let condition;
    if (isNum) {
      const numId = parseInt(identifier, 10);
      condition = sql`${schema.personnel.id} = ${numId} OR ${schema.personnel.personnelCode} = ${identifier} OR ${schema.personnel.nationalCode} = ${identifier}`;
    } else {
      condition = sql`${schema.personnel.personnelCode} = ${identifier} OR ${schema.personnel.nationalCode} = ${identifier}`;
    }

    const deleted = await db.delete(schema.personnel).where(condition).returning();
    return deleted[0] || null;
  }

  async upsert(data: any) {
    const extraData = {
      ...(data.extraData || {}),
      unit: data.unit || data.department || data.extraData?.unit || '',
      subUnit: data.subUnit || data.extraData?.subUnit || '',
      department: data.department || data.unit || data.extraData?.department || '',
      workplace: data.workplace || data.extraData?.workplace || '',
      education: data.education || data.extraData?.education || '',
      childrenCount: data.childrenCount ?? data.extraData?.childrenCount ?? '0',
      maritalStatus: data.maritalStatus || data.extraData?.maritalStatus || '',
      militaryStatus: data.militaryStatus || data.extraData?.militaryStatus || '',
      notes: data.notes || data.extraData?.notes || '',
      profilePhoto: data.profilePhoto || data.extraData?.profilePhoto || '',
      phone: data.phone || data.mobile || data.extraData?.phone || '',
      age: data.age ?? data.extraData?.age ?? 0,
    };

    const res = await db
      .insert(schema.personnel)
      .values({
        personnelCode: data.personnelCode,
        nationalCode: data.nationalCode || data.personnelCode,
        firstName: data.firstName,
        lastName: data.lastName,
        fatherName: data.fatherName,
        gender: data.gender || 'MALE',
        birthDate: data.birthDate,
        hireDate: data.hireDate,
        jobTitle: data.jobTitle,
        companyId: data.companyId,
        siteId: data.siteId,
        departmentId: data.departmentId,
        unitId: data.unitId,
        positionId: data.positionId,
        mobile: data.mobile || data.phone || extraData.phone,
        bloodGroup: data.bloodGroup,
        status: data.status || 'ACTIVE',
        extraData: extraData,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.personnel.personnelCode,
        set: {
          firstName: data.firstName,
          lastName: data.lastName,
          fatherName: data.fatherName,
          jobTitle: data.jobTitle,
          mobile: data.mobile || data.phone || extraData.phone,
          bloodGroup: data.bloodGroup,
          status: data.status || 'ACTIVE',
          extraData: extraData,
          updatedAt: new Date(),
        },
      })
      .returning();

    const saved = res[0];
    return {
      ...extraData,
      ...saved,
      phone: saved.mobile || extraData.phone || '',
      mobile: saved.mobile || extraData.phone || '',
    };
  }
}

export const personnelRepository = new PersonnelRepository();
