import { and, desc, eq, inArray, isNull, sql, or } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, withDbRetry } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';
import { authService } from './modules/auth/auth.service.ts';
import { generateNextPermitNumber, ensurePermitTablesExist } from './services/permitNumberService.ts';
import { dispatchDomainWebhookEvent } from './services/webhookDispatcher.ts';

// ============================================================================
// 1. ORGANIZATIONAL HIERARCHY
// ============================================================================
export async function getOrganizationHierarchy() {
  try {
    const companies = await db.select().from(schema.orgCompanies);
    const sites = await db.select().from(schema.orgSites);
    const departments = await db.select().from(schema.orgDepartments);
    const units = await db.select().from(schema.orgUnits);
    const positions = await db.select().from(schema.orgPositions);

    return { companies, sites, departments, units, positions };
  } catch (error) {
    console.error('Failed to get organization hierarchy:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function seedOrganizationHierarchy(data: {
  companies?: Array<{ code: string; name: string; description?: string }>;
  sites?: Array<{ companyCode: string; code: string; name: string; location?: string }>;
  departments?: Array<{ siteCode: string; code: string; name: string }>;
  units?: Array<{ departmentCode: string; code: string; name: string }>;
  positions?: Array<{ title: string; code?: string; riskLevel?: string }>;
}) {
  try {
    if (data.companies && data.companies.length > 0) {
      for (const comp of data.companies) {
        await db
          .insert(schema.orgCompanies)
          .values({ code: comp.code, name: comp.name, description: comp.description })
          .onConflictDoNothing({ target: schema.orgCompanies.code });
      }
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to seed organization hierarchy:', error);
    throw new Error('Failed to seed organization hierarchy', { cause: error });
  }
}

// ============================================================================
// 2. PERSONNEL MANAGEMENT (Master Records)
// ============================================================================
export async function getAllPersonnel(filters?: { companyId?: number; unitId?: number; status?: string }) {
  try {
    const conditions = [];
    if (filters?.companyId) conditions.push(eq(schema.personnel.companyId, filters.companyId));
    if (filters?.unitId) conditions.push(eq(schema.personnel.unitId, filters.unitId));
    if (filters?.status) conditions.push(eq(schema.personnel.status, filters.status));

    let list;
    if (conditions.length > 0) {
      list = await db.select().from(schema.personnel).where(and(...conditions)).orderBy(desc(schema.personnel.createdAt));
    } else {
      list = await db.select().from(schema.personnel).orderBy(desc(schema.personnel.createdAt));
    }

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
        signatureImage: extra.signatureImage || extra.digitalSignature || '',
      };
    });
  } catch (error) {
    console.error('Failed to fetch personnel:', error);
    throw new Error('Database query failed for personnel.', { cause: error });
  }
}

export async function getPersonnelByCodeOrNationalId(identifier: string) {
  try {
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
      signatureImage: extra.signatureImage || extra.digitalSignature || '',
    };
  } catch (error) {
    console.error('Failed to fetch personnel by code:', error);
    throw new Error('Failed to fetch personnel by code', { cause: error });
  }
}

export async function deletePersonnel(identifier: string, deleteAssociatedUser = false) {
  try {
    const isNum = /^\d+$/.test(identifier);
    let condition;
    if (isNum) {
      const numId = parseInt(identifier, 10);
      condition = sql`${schema.personnel.id} = ${numId} OR ${schema.personnel.personnelCode} = ${identifier} OR ${schema.personnel.nationalCode} = ${identifier}`;
    } else {
      condition = sql`${schema.personnel.personnelCode} = ${identifier} OR ${schema.personnel.nationalCode} = ${identifier}`;
    }

    const targetRecords = await db.select().from(schema.personnel).where(condition);
    const target = targetRecords[0];

    const deleted = await db.delete(schema.personnel).where(condition).returning();

    // If requested, also clean up associated user in schema.users (by personnelNumber or nationalId)
    if (deleteAssociatedUser && target) {
      const pCode = target.personnelCode;
      const nId = target.nationalCode;
      if (pCode || nId) {
        try {
          await db.delete(schema.users).where(
            sql`(${schema.users.personnelNumber} = ${pCode} OR (${nId} <> '' AND ${schema.users.nationalId} = ${nId})) AND ${schema.users.role} NOT IN ('ADMIN', 'ADMINISTRATOR', 'Administrator')`
          );
        } catch (err) {
          console.warn('Could not cascade delete user account:', err);
        }
      }
    }

    return deleted[0] || target || null;
  } catch (error) {
    console.error('Failed to delete personnel:', error);
    throw new Error('Database delete failed for personnel.', { cause: error });
  }
}

export async function upsertPersonnel(data: {
  id?: string | number;
  personnelCode: string;
  nationalCode?: string;
  firstName: string;
  lastName: string;
  fatherName?: string;
  gender?: string;
  birthDate?: string;
  hireDate?: string;
  jobTitle?: string;
  companyId?: number;
  siteId?: number;
  departmentId?: number;
  unitId?: number;
  positionId?: number;
  mobile?: string;
  phone?: string;
  unit?: string;
  subUnit?: string;
  department?: string;
  workplace?: string;
  education?: string;
  childrenCount?: string | number;
  maritalStatus?: string;
  militaryStatus?: string;
  notes?: string;
  profilePhoto?: string;
  signatureImage?: string;
  age?: number;
  bloodGroup?: string;
  status?: string;
  extraData?: any;
}) {
  try {
    const cleanPCode = String(data.personnelCode || '').trim();
    if (!cleanPCode) {
      throw new Error('Personnel code is required');
    }

    const rawNCode = String(data.nationalCode || (data as any).nationalId || '').trim();

    // 1. Find existing personnel record by ID, personnelCode, or nationalCode
    let existingRecord: any = null;
    if (data.id !== undefined && data.id !== null && /^\d+$/.test(String(data.id).trim())) {
      const byId = await db
        .select()
        .from(schema.personnel)
        .where(eq(schema.personnel.id, parseInt(String(data.id).trim(), 10)))
        .limit(1);
      if (byId.length > 0) existingRecord = byId[0];
    }

    if (!existingRecord) {
      const byCode = await db
        .select()
        .from(schema.personnel)
        .where(eq(schema.personnel.personnelCode, cleanPCode))
        .limit(1);
      if (byCode.length > 0) existingRecord = byCode[0];
    }

    if (!existingRecord && rawNCode) {
      const byNational = await db
        .select()
        .from(schema.personnel)
        .where(eq(schema.personnel.nationalCode, rawNCode))
        .limit(1);
      if (byNational.length > 0) existingRecord = byNational[0];
    }

    const prevExtra =
      existingRecord?.extraData && typeof existingRecord.extraData === 'object'
        ? (existingRecord.extraData as Record<string, any>)
        : {};

    const sigImg =
      data.signatureImage !== undefined
        ? data.signatureImage
        : (data as any).digitalSignature !== undefined
        ? (data as any).digitalSignature
        : data.extraData?.signatureImage !== undefined
        ? data.extraData.signatureImage
        : prevExtra.signatureImage || prevExtra.digitalSignature || '';

    const extraData = {
      ...prevExtra,
      ...(data.extraData || {}),
      unit: data.unit !== undefined ? data.unit : (data.department || data.extraData?.unit || prevExtra.unit || ''),
      subUnit: data.subUnit !== undefined ? data.subUnit : (data.extraData?.subUnit || prevExtra.subUnit || ''),
      department: data.department !== undefined ? data.department : (data.unit || data.extraData?.department || prevExtra.department || ''),
      workplace: data.workplace !== undefined ? data.workplace : (data.extraData?.workplace || prevExtra.workplace || ''),
      education: data.education !== undefined ? data.education : (data.extraData?.education || prevExtra.education || ''),
      childrenCount: data.childrenCount !== undefined ? data.childrenCount : (data.extraData?.childrenCount ?? prevExtra.childrenCount ?? '0'),
      maritalStatus: data.maritalStatus !== undefined ? data.maritalStatus : (data.extraData?.maritalStatus || prevExtra.maritalStatus || ''),
      militaryStatus: data.militaryStatus !== undefined ? data.militaryStatus : (data.extraData?.militaryStatus || prevExtra.militaryStatus || ''),
      notes: data.notes !== undefined ? data.notes : (data.extraData?.notes || prevExtra.notes || ''),
      profilePhoto: data.profilePhoto !== undefined ? data.profilePhoto : (data.extraData?.profilePhoto || prevExtra.profilePhoto || ''),
      signatureImage: sigImg,
      phone: data.phone !== undefined ? data.phone : (data.mobile || data.extraData?.phone || prevExtra.phone || existingRecord?.mobile || ''),
      age: data.age !== undefined ? data.age : (data.extraData?.age ?? prevExtra.age ?? 0),
    };

    // Determine safe unique nationalCode
    let nCode = rawNCode || existingRecord?.nationalCode || cleanPCode;
    const conflictingNational = await db
      .select()
      .from(schema.personnel)
      .where(eq(schema.personnel.nationalCode, nCode))
      .limit(1);
    if (conflictingNational.length > 0 && (!existingRecord || conflictingNational[0].id !== existingRecord.id)) {
      nCode = `${cleanPCode}-${Date.now().toString().slice(-4)}`;
    }

    let saved: any;
    if (existingRecord) {
      const updatedRows = await db
        .update(schema.personnel)
        .set({
          personnelCode: cleanPCode,
          nationalCode: nCode,
          firstName: data.firstName ?? existingRecord.firstName,
          lastName: data.lastName ?? existingRecord.lastName,
          fatherName: data.fatherName !== undefined ? data.fatherName : existingRecord.fatherName,
          gender: data.gender || existingRecord.gender || 'MALE',
          birthDate: data.birthDate !== undefined ? data.birthDate : existingRecord.birthDate,
          hireDate: data.hireDate !== undefined ? data.hireDate : existingRecord.hireDate,
          jobTitle: data.jobTitle !== undefined ? data.jobTitle : existingRecord.jobTitle,
          companyId: data.companyId !== undefined ? data.companyId : existingRecord.companyId,
          siteId: data.siteId !== undefined ? data.siteId : existingRecord.siteId,
          departmentId: data.departmentId !== undefined ? data.departmentId : existingRecord.departmentId,
          unitId: data.unitId !== undefined ? data.unitId : existingRecord.unitId,
          positionId: data.positionId !== undefined ? data.positionId : existingRecord.positionId,
          mobile: data.mobile || data.phone || extraData.phone || existingRecord.mobile,
          bloodGroup: data.bloodGroup !== undefined ? data.bloodGroup : existingRecord.bloodGroup,
          status: data.status || existingRecord.status || 'ACTIVE',
          extraData: extraData,
          updatedAt: new Date(),
        })
        .where(eq(schema.personnel.id, existingRecord.id))
        .returning();
      saved = updatedRows[0];
    } else {
      const insertedRows = await db
        .insert(schema.personnel)
        .values({
          personnelCode: cleanPCode,
          nationalCode: nCode,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
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
        .returning();
      saved = insertedRows[0];
    }

    // Also synchronize signatureImage and key profile fields to linked user account if one exists
    if (cleanPCode) {
      try {
        const linkedUsers = await db
          .select()
          .from(schema.users)
          .where(or(eq(schema.users.personnelNumber, cleanPCode), eq(schema.users.username, cleanPCode)));
        for (const u of linkedUsers) {
          const uProfile = (u.profileData && typeof u.profileData === 'object') ? (u.profileData as Record<string, any>) : {};
          const updatedProfile = {
            ...uProfile,
            signatureImage: extraData.signatureImage,
            profilePhoto: extraData.profilePhoto || uProfile.profilePhoto || '',
            avatarUrl: extraData.profilePhoto || uProfile.avatarUrl || '',
            workplace: extraData.workplace || uProfile.workplace || '',
            unit: extraData.unit || uProfile.unit || '',
            department: extraData.unit || uProfile.department || '',
            subUnit: extraData.subUnit || uProfile.subUnit || '',
          };
          await db
            .update(schema.users)
            .set({
              fullName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || u.fullName,
              jobTitle: data.jobTitle !== undefined ? data.jobTitle : u.jobTitle,
              phoneNumber: extraData.phone || u.phoneNumber,
              profileData: updatedProfile,
              updatedAt: new Date(),
            })
            .where(eq(schema.users.id, u.id));
        }
      } catch {
        // Non-blocking sync
      }
    }

    return {
      ...extraData,
      ...saved,
      id: String(saved.id),
      phone: saved.mobile || extraData.phone || '',
      mobile: saved.mobile || extraData.phone || '',
      signatureImage: extraData.signatureImage || '',
    };
  } catch (error) {
    console.error('Failed to upsert personnel:', error);
    throw new Error('Failed to upsert personnel', { cause: error });
  }
}

export async function batchUpsertPersonnel(records: Array<any>) {
  try {
    const valid = records.filter(r => (r.personnelCode || r.nationalCode) && (r.firstName || r.lastName || r.fullName));
    const results = [];
    const chunkSize = 15;
    for (let i = 0; i < valid.length; i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((r, idx) => {
        const fn = r.firstName || (r.fullName ? r.fullName.split(' ')[0] : 'پرسنل');
        const ln = r.lastName || (r.fullName ? r.fullName.split(' ').slice(1).join(' ') : 'نامشخص');
        const pCode = r.personnelCode || r.rawPersonnelCode || r.nationalCode || `EMP-${Date.now()}-${idx}`;
        const nCode = r.nationalCode || r.rawNationalCode || pCode;
        const payload = {
          ...r,
          personnelCode: String(pCode).trim(),
          nationalCode: String(nCode).trim(),
          firstName: String(fn).trim(),
          lastName: String(ln).trim(),
          mobile: r.mobile || r.phone || '',
          phone: r.phone || r.mobile || '',
          jobTitle: r.jobTitle || 'کارشناس',
          birthDate: r.birthDate || '',
          gender: r.gender === 'زن' || r.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
          extraData: {
            ...(r.extraData || {}),
            workplace: r.workplace || '',
            unit: r.unit || '',
            subUnit: r.subUnit || '',
            education: r.education || '',
            maritalStatus: r.maritalStatus || '',
            militaryStatus: r.militaryStatus || '',
            childrenCount: r.childrenCount || '',
            phone: r.phone || r.mobile || '',
            notes: r.notes || '',
            profilePhoto: r.profilePhoto || '',
            signatureImage: r.signatureImage || r.digitalSignature || r.extraData?.signatureImage || '',
          }
        };
        return upsertPersonnel(payload);
      }));
      results.push(...chunkResults);
    }
    return { count: results.length, success: true };
  } catch (error) {
    console.error('Failed batch upsert personnel:', error);
    throw new Error('Failed batch upsert personnel', { cause: error });
  }
}

// ============================================================================
// 3. OCCUPATIONAL HEALTH & PERIODIC MEDICAL EXAMS
// Key indexing by (personnel_code / national_code + exam_year)
// ============================================================================
export async function getAllMedicalExams(year?: number) {
  try {
    if (year) {
      return await db
        .select()
        .from(schema.periodicMedicalExams)
        .where(eq(schema.periodicMedicalExams.examYear, year))
        .orderBy(desc(schema.periodicMedicalExams.examDate));
    }
    return await db.select().from(schema.periodicMedicalExams).orderBy(desc(schema.periodicMedicalExams.examYear));
  } catch (error) {
    console.error('Failed to fetch medical exams:', error);
    throw new Error('Failed to fetch medical exams', { cause: error });
  }
}

export async function getMedicalExamWithDetails(examId: number) {
  try {
    const examRes = await db.select().from(schema.periodicMedicalExams).where(eq(schema.periodicMedicalExams.id, examId));
    if (!examRes.length) return null;
    const exam = examRes[0];

    const [labs, audiometries, spirometries, optometries, diagnoses, referrals] = await Promise.all([
      db.select().from(schema.labResults).where(eq(schema.labResults.examId, examId)),
      db.select().from(schema.audiometryRecords).where(eq(schema.audiometryRecords.examId, examId)),
      db.select().from(schema.spirometryRecords).where(eq(schema.spirometryRecords.examId, examId)),
      db.select().from(schema.optometryRecords).where(eq(schema.optometryRecords.examId, examId)),
      db.select().from(schema.occupationalDiseaseDiagnoses).where(eq(schema.occupationalDiseaseDiagnoses.examId, examId)),
      db.select().from(schema.medicalReferrals).where(eq(schema.medicalReferrals.examId, examId)),
    ]);

    return {
      ...exam,
      labResults: labs,
      audiometry: audiometries,
      spirometry: spirometries,
      optometry: optometries,
      diagnoses,
      referrals,
    };
  } catch (error) {
    console.error('Failed to get medical exam with details:', error);
    throw new Error('Failed to get medical exam with details', { cause: error });
  }
}

export async function getPersonnelMultiYearMedicalHistory(personnelCodeOrNational: string) {
  try {
    const p = await getPersonnelByCodeOrNationalId(personnelCodeOrNational);
    if (!p) return { personnel: null, history: [] };

    const exams = await db
      .select()
      .from(schema.periodicMedicalExams)
      .where(eq(schema.periodicMedicalExams.personnelId, p.id))
      .orderBy(desc(schema.periodicMedicalExams.examYear));

    const detailedHistory = await Promise.all(exams.map(ex => getMedicalExamWithDetails(ex.id)));

    return {
      personnel: p,
      history: detailedHistory.filter(Boolean),
    };
  } catch (error) {
    console.error('Failed to get personnel multi-year history:', error);
    throw new Error('Failed to get multi-year history', { cause: error });
  }
}

export async function savePeriodicMedicalExam(data: {
  personnelCode: string;
  nationalCode: string;
  examYear: number;
  examDate?: string;
  examType?: string;
  height?: number;
  weight?: number;
  bmi?: number;
  systolicBp?: number;
  diastolicBp?: number;
  pulseRate?: number;
  respiratoryRate?: number;
  doctorVerdict?: string;
  restrictions?: string;
  fitnessStatus?: string;
  clinicalNotes?: string;
  nextExamDate?: string;
  examCenter?: string;
  examiningDoctor?: string;
  rawData?: any;
  labResultsList?: Array<any>;
  audiometryList?: Array<any>;
  spirometryList?: Array<any>;
  optometryList?: Array<any>;
  diagnosesList?: Array<any>;
  referralsList?: Array<any>;
}) {
  try {
    // Ensure personnel exists or find personnel id
    let p = await getPersonnelByCodeOrNationalId(data.personnelCode);
    if (!p) {
      p = await upsertPersonnel({
        personnelCode: data.personnelCode,
        nationalCode: data.nationalCode,
        firstName: data.rawData?.firstName || 'پرسنل',
        lastName: data.rawData?.lastName || data.personnelCode,
      });
    }

    // Upsert the main exam row (keyed on personnelId + examYear)
    const existing = await db
      .select()
      .from(schema.periodicMedicalExams)
      .where(
        and(
          eq(schema.periodicMedicalExams.personnelId, p.id),
          eq(schema.periodicMedicalExams.examYear, data.examYear)
        )
      );

    let examId: number;
    if (existing.length > 0) {
      examId = existing[0].id;
      await db
        .update(schema.periodicMedicalExams)
        .set({
          examDate: data.examDate,
          examType: data.examType || 'PERIODIC',
          height: data.height,
          weight: data.weight,
          bmi: data.bmi,
          systolicBp: data.systolicBp,
          diastolicBp: data.diastolicBp,
          pulseRate: data.pulseRate,
          respiratoryRate: data.respiratoryRate,
          doctorVerdict: data.doctorVerdict || 'FIT',
          restrictions: data.restrictions,
          fitnessStatus: data.fitnessStatus,
          clinicalNotes: data.clinicalNotes,
          nextExamDate: data.nextExamDate,
          examCenter: data.examCenter,
          examiningDoctor: data.examiningDoctor,
          rawData: data.rawData || {},
          updatedAt: new Date(),
        })
        .where(eq(schema.periodicMedicalExams.id, examId));
    } else {
      const inserted = await db
        .insert(schema.periodicMedicalExams)
        .values({
          personnelId: p.id,
          personnelCode: data.personnelCode,
          nationalCode: data.nationalCode,
          examYear: data.examYear,
          examDate: data.examDate,
          examType: data.examType || 'PERIODIC',
          height: data.height,
          weight: data.weight,
          bmi: data.bmi,
          systolicBp: data.systolicBp,
          diastolicBp: data.diastolicBp,
          pulseRate: data.pulseRate,
          respiratoryRate: data.respiratoryRate,
          doctorVerdict: data.doctorVerdict || 'FIT',
          restrictions: data.restrictions,
          fitnessStatus: data.fitnessStatus,
          clinicalNotes: data.clinicalNotes,
          nextExamDate: data.nextExamDate,
          examCenter: data.examCenter,
          examiningDoctor: data.examiningDoctor,
          rawData: data.rawData || {},
        })
        .returning();
      examId = inserted[0].id;
    }

    // Replace child sub-records cleanly with bulk inserts
    if (data.labResultsList && data.labResultsList.length > 0) {
      await db.delete(schema.labResults).where(eq(schema.labResults.examId, examId));
      const labRows = data.labResultsList.map(lab => ({
        examId,
        testCode: lab.testCode || lab.name || 'TEST',
        testName: lab.testName || lab.name || 'آزمایش',
        category: lab.category || 'BIOCHEMISTRY',
        numericValue: typeof lab.numericValue === 'number' ? lab.numericValue : (parseFloat(lab.value) || null),
        textValue: String(lab.textValue || lab.value || ''),
        unit: lab.unit,
        refMin: lab.refMin,
        refMax: lab.refMax,
        isAbnormal: Boolean(lab.isAbnormal),
        clinicalSignificance: lab.clinicalSignificance,
      }));
      await db.insert(schema.labResults).values(labRows);
    }

    if (data.audiometryList && data.audiometryList.length > 0) {
      await db.delete(schema.audiometryRecords).where(eq(schema.audiometryRecords.examId, examId));
      const audRows = data.audiometryList.map(aud => ({
        examId,
        earSide: aud.earSide || 'RIGHT',
        freq250: aud.freq250,
        freq500: aud.freq500,
        freq1000: aud.freq1000,
        freq2000: aud.freq2000,
        freq3000: aud.freq3000,
        freq4000: aud.freq4000,
        freq6000: aud.freq6000,
        freq8000: aud.freq8000,
        hearingLossType: aud.hearingLossType,
        hearingThresholdAvg: aud.hearingThresholdAvg,
        noiseInducedHearingLoss: Boolean(aud.noiseInducedHearingLoss),
        diagnosis: aud.diagnosis,
      }));
      await db.insert(schema.audiometryRecords).values(audRows);
    }

    if (data.spirometryList && data.spirometryList.length > 0) {
      await db.delete(schema.spirometryRecords).where(eq(schema.spirometryRecords.examId, examId));
      const spRows = data.spirometryList.map(sp => ({
        examId,
        fvcLiters: sp.fvcLiters,
        fvcPercent: sp.fvcPercent,
        fev1Liters: sp.fev1Liters,
        fev1Percent: sp.fev1Percent,
        fev1FvcRatio: sp.fev1FvcRatio,
        pef: sp.pef,
        spirometryPattern: sp.spirometryPattern,
        severity: sp.severity,
        interpretation: sp.interpretation,
      }));
      await db.insert(schema.spirometryRecords).values(spRows);
    }

    if (data.optometryList && data.optometryList.length > 0) {
      await db.delete(schema.optometryRecords).where(eq(schema.optometryRecords.examId, examId));
      const optRows = data.optometryList.map(opt => ({
        examId,
        visionRightUncorrected: opt.visionRightUncorrected,
        visionLeftUncorrected: opt.visionLeftUncorrected,
        visionRightCorrected: opt.visionRightCorrected,
        visionLeftCorrected: opt.visionLeftCorrected,
        colorBlindness: Boolean(opt.colorBlindness),
        visualField: opt.visualField,
        refractiveError: opt.refractiveError,
        findings: opt.findings,
      }));
      await db.insert(schema.optometryRecords).values(optRows);
    }

    if (data.diagnosesList && data.diagnosesList.length > 0) {
      await db.delete(schema.occupationalDiseaseDiagnoses).where(eq(schema.occupationalDiseaseDiagnoses.examId, examId));
      const diagRows = data.diagnosesList.map(diag => ({
        examId,
        groupNumber: diag.groupNumber || 1,
        groupName: diag.groupName || 'بیماری شغلی',
        diseaseName: diag.diseaseName || 'عنوان بیماری',
        icd10Code: diag.icd10Code,
        severity: diag.severity || 'MILD',
        isWorkRelated: diag.isWorkRelated !== undefined ? Boolean(diag.isWorkRelated) : true,
        isConfirmed: Boolean(diag.isConfirmed),
        notes: diag.notes,
      }));
      await db.insert(schema.occupationalDiseaseDiagnoses).values(diagRows);
    }

    return await getMedicalExamWithDetails(examId);
  } catch (error) {
    console.error('Failed to save periodic medical exam:', error);
    throw new Error('Failed to save medical exam record', { cause: error });
  }
}

// ============================================================================
// 4. WORK PERMITS (PTW)
// ============================================================================
export async function getAllWorkPermits(status?: string) {
  try {
    await ensurePermitTablesExist();
    if (status) {
      return await db.select().from(schema.workPermits).where(eq(schema.workPermits.status, status)).orderBy(desc(schema.workPermits.createdAt));
    }
    return await db.select().from(schema.workPermits).orderBy(desc(schema.workPermits.createdAt));
  } catch (error) {
    console.error('Failed to fetch work permits:', error);
    throw new Error('Failed to fetch work permits', { cause: error });
  }
}

export async function upsertWorkPermit(permitData: any) {
  try {
    await ensurePermitTablesExist();
    let existing: any[] = [];
    const inputPermitNumber = permitData.permitNumber || permitData.serialNumber;

    if (permitData.id) {
      const numId = Number(permitData.id);
      if (!isNaN(numId)) {
        existing = await db.select().from(schema.workPermits).where(eq(schema.workPermits.id, numId));
      }
    }

    if (existing.length === 0 && inputPermitNumber && !inputPermitNumber.startsWith('NEW') && !inputPermitNumber.startsWith('DRAFT')) {
      existing = await db.select().from(schema.workPermits).where(eq(schema.workPermits.permitNumber, inputPermitNumber));
    }

    let finalPermitNumber = '';
    let seqNum: number | null = null;
    let jYear: number | null = null;
    let parentNum: string | null = permitData.parentPermitNumber || permitData.mainPermitNumber || null;
    let category: string | null = permitData.permitCategory || permitData.category || null;

    if (existing.length > 0) {
      finalPermitNumber = existing[0].permitNumber;
      seqNum = existing[0].sequenceNumber;
      jYear = existing[0].jalaliYear;
      parentNum = existing[0].parentPermitNumber || parentNum;
      category = existing[0].permitCategory || category;
    } else {
      const genResult = await generateNextPermitNumber({
        permitType: permitData.permitType,
        permitCategory: category || undefined,
        parentPermitNumber: parentNum || undefined,
        issueDate: permitData.validFrom || permitData.startDate || permitData.issueDate,
      });
      finalPermitNumber = genResult.permitNumber;
      seqNum = genResult.sequenceNumber;
      jYear = genResult.jalaliYear;
      parentNum = genResult.parentPermitNumber || null;
    }

    const validFrom = permitData.validFrom || permitData.startDate || new Date().toISOString();
    const validTo = permitData.validTo || permitData.endDate || new Date(Date.now() + 86400000).toISOString();

    const updatedFormData = {
      ...(permitData.formData || permitData),
      serialNumber: finalPermitNumber,
      permitNumber: finalPermitNumber,
      parentPermitNumber: parentNum,
      permitCategory: category,
    };

    const formattedData: any = {
      permitNumber: finalPermitNumber,
      permitType: permitData.permitType || 'HOT',
      title: permitData.title || `پروانه کار شماره ${finalPermitNumber}`,
      companyId: permitData.companyId ? Number(permitData.companyId) : null,
      unitId: permitData.unitId ? Number(permitData.unitId) : null,
      location: permitData.location || 'سایت عملیاتی',
      description: permitData.description || '',
      hazards: permitData.hazards || null,
      precautions: permitData.precautions || null,
      status: permitData.status || 'PENDING_APPROVAL',
      validFrom,
      validTo,
      issuerId: permitData.issuerId ? Number(permitData.issuerId) : null,
      acceptorId: permitData.acceptorId ? Number(permitData.acceptorId) : null,
      contractorName: permitData.contractorName || null,
      workerCount: permitData.workerCount ? Number(permitData.workerCount) : 1,
      equipmentList: permitData.equipmentList || null,
      parentPermitNumber: parentNum,
      permitCategory: category,
      sequenceNumber: seqNum,
      jalaliYear: jYear,
      formData: updatedFormData,
      updatedAt: new Date(),
    };

    let savedPermit: any;
    const previousStatus = existing.length > 0 ? existing[0].status : null;
    if (existing.length > 0) {
      const res = await db
        .update(schema.workPermits)
        .set(formattedData)
        .where(eq(schema.workPermits.id, existing[0].id))
        .returning();
      savedPermit = res[0] || existing[0] || { ...formattedData, id: existing[0].id };
    } else {
      const res = await db.insert(schema.workPermits).values(formattedData).returning();
      savedPermit = res[0] || { ...formattedData, id: Date.now() };
    }

    if (!previousStatus || previousStatus !== savedPermit.status) {
      void dispatchDomainWebhookEvent({
        eventType: 'permit.status_adjusted',
        moduleName: 'ptw_management',
        correlationKey: savedPermit.permitNumber || String(savedPermit.id),
        idempotencyKey: `idem_permit_${savedPermit.permitNumber || savedPermit.id}_${previousStatus || 'NEW'}_to_${savedPermit.status}`,
        data: {
          id: savedPermit.id,
          permitNumber: savedPermit.permitNumber,
          permitType: savedPermit.permitType,
          permitCategory: savedPermit.permitCategory,
          title: savedPermit.title,
          location: savedPermit.location,
          previousStatus: previousStatus || 'CREATED',
          currentStatus: savedPermit.status,
          validFrom: savedPermit.validFrom,
          validTo: savedPermit.validTo,
          contractorName: savedPermit.contractorName,
          workerCount: savedPermit.workerCount,
        },
      });
    }

    return savedPermit;
  } catch (error) {
    console.error('Failed to upsert work permit:', error);
    throw new Error('Failed to upsert work permit', { cause: error });
  }
}

export async function deleteWorkPermit(idOrNumber: string | number) {
  try {
    const isNum = typeof idOrNumber === 'number' || (typeof idOrNumber === 'string' && /^\d+$/.test(idOrNumber.trim()));
    if (isNum) {
      const numId = Number(idOrNumber);
      const res = await db.delete(schema.workPermits).where(eq(schema.workPermits.id, numId)).returning();
      if (res.length > 0) return { success: true, count: res.length };
    }
    const res = await db.delete(schema.workPermits).where(eq(schema.workPermits.permitNumber, String(idOrNumber))).returning();
    return { success: true, count: res.length };
  } catch (error) {
    console.error('Failed to delete work permit:', error);
    throw new Error('Failed to delete work permit', { cause: error });
  }
}

export async function addPermitSignature(signatureData: {
  permitId: number;
  roleName: string;
  signerName: string;
  signerPersonnelCode?: string;
  action: string;
  digitalSignature?: string;
  comments?: string;
}) {
  try {
    const res = await db.insert(schema.permitSignatures).values(signatureData).returning();
    return res[0];
  } catch (error) {
    console.error('Failed to add permit signature:', error);
    throw new Error('Failed to add permit signature', { cause: error });
  }
}

// ============================================================================
// 5. RISK ASSESSMENTS & INCIDENTS
// ============================================================================
export async function getAllRiskAssessments() {
  try {
    return await db.select().from(schema.riskAssessments).orderBy(desc(schema.riskAssessments.createdAt));
  } catch (error) {
    console.error('Failed to fetch risk assessments:', error);
    throw new Error('Failed to fetch risk assessments', { cause: error });
  }
}

export async function createRiskAssessment(data: any) {
  try {
    const res = await db.insert(schema.riskAssessments).values(data).returning();
    return res[0];
  } catch (error) {
    console.error('Failed to create risk assessment:', error);
    throw new Error('Failed to create risk assessment', { cause: error });
  }
}

export async function deleteRiskAssessment(id: string | number) {
  try {
    const numId = Number(id);
    if (!isNaN(numId)) {
      return await db.delete(schema.riskAssessments).where(eq(schema.riskAssessments.id, numId)).returning();
    }
    return [];
  } catch (error) {
    console.error('Failed to delete risk assessment:', error);
    throw new Error('Failed to delete risk assessment', { cause: error });
  }
}

export async function getAllIncidents() {
  try {
    return await db.select().from(schema.incidents).orderBy(desc(schema.incidents.createdAt));
  } catch (error) {
    console.error('Failed to fetch incidents:', error);
    throw new Error('Failed to fetch incidents', { cause: error });
  }
}

export async function createIncident(data: any) {
  return upsertIncident(data);
}

export async function upsertIncident(data: any) {
  try {
    let existing = null;
    const isNum = data.id && (typeof data.id === 'number' || (typeof data.id === 'string' && /^\d+$/.test(data.id.trim())));
    if (isNum) {
      const byId = await db.select().from(schema.incidents).where(eq(schema.incidents.id, Number(data.id)));
      if (byId.length > 0) existing = byId[0];
    }
    if (!existing && data.incidentNumber) {
      const byNum = await db.select().from(schema.incidents).where(eq(schema.incidents.incidentNumber, data.incidentNumber));
      if (byNum.length > 0) existing = byNum[0];
    }

    let savedIncident: any;
    if (existing) {
      const { id, ...updateFields } = data;
      const res = await db.update(schema.incidents).set(updateFields).where(eq(schema.incidents.id, existing.id)).returning();
      savedIncident = res[0] || existing || data;
    } else {
      const { id, ...insertFields } = data;
      const res = await db.insert(schema.incidents).values(insertFields).returning();
      savedIncident = res[0] || data || { id: Date.now(), ...insertFields };
    }

    void dispatchDomainWebhookEvent({
      eventType: 'incident.reported',
      moduleName: 'incident_reporting',
      correlationKey: savedIncident.incidentNumber || String(savedIncident.id),
      idempotencyKey: `idem_incident_${savedIncident.incidentNumber || savedIncident.id}_${savedIncident.status || 'REPORTED'}`,
      data: {
        id: savedIncident.id,
        incidentNumber: savedIncident.incidentNumber,
        title: savedIncident.title,
        incidentType: savedIncident.incidentType,
        severity: savedIncident.severity,
        incidentDate: savedIncident.incidentDate,
        incidentTime: savedIncident.incidentTime,
        location: savedIncident.location,
        status: savedIncident.status || 'REPORTED',
        description: savedIncident.description,
        immediateActions: savedIncident.immediateActions,
        lostWorkDays: savedIncident.lostWorkDays || 0,
      },
    });

    return savedIncident;
  } catch (error) {
    console.error('Failed to upsert incident:', error);
    throw new Error('Failed to upsert incident', { cause: error });
  }
}

export async function deleteIncident(idOrNumber: string | number) {
  try {
    const raw = String(idOrNumber || '').trim();
    if (!raw) return { success: false, count: 0 };
    const isNum = /^\d+$/.test(raw);
    if (isNum) {
      const numId = Number(raw);
      const res = await db.delete(schema.incidents).where(
        or(
          eq(schema.incidents.id, numId),
          eq(schema.incidents.incidentNumber, raw)
        )
      ).returning();
      if (res.length > 0) return { success: true, count: res.length };
    }
    const res = await db.delete(schema.incidents).where(eq(schema.incidents.incidentNumber, raw)).returning();
    return { success: true, count: res.length };
  } catch (error) {
    console.error('Failed to delete incident:', error);
    throw new Error('Failed to delete incident', { cause: error });
  }
}

// ============================================================================
// 6. TRIR RECORDS & KPI METRICS
// ============================================================================
const JALALI_MONTH_NAMES_LIST = [
  'فروردین', 'اردیبهشت', 'خرداد', 
  'تیر', 'مرداد', 'شهریور', 
  'مهر', 'آبان', 'آذر', 
  'دی', 'بهمن', 'اسفند'
];

function normalizeMonthForDeduplication(m: unknown): string {
  return String(m || '')
    .replace(/[\u200C\u200B\u200D\u200E\u200F\uFEFF]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ی')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/["'«»]/g, '')
    .trim();
}

function getJalaliMonthIndexFromStr(monthInput: unknown): number {
  if (monthInput === null || monthInput === undefined) return 1;
  const num = parseInt(String(monthInput).trim(), 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return num;
  }
  const norm = normalizeMonthForDeduplication(monthInput);
  for (let i = 0; i < JALALI_MONTH_NAMES_LIST.length; i++) {
    const listNorm = normalizeMonthForDeduplication(JALALI_MONTH_NAMES_LIST[i]);
    if (norm === listNorm || norm.includes(listNorm) || listNorm.includes(norm)) {
      return i + 1;
    }
  }
  return 1;
}

export async function getTrirRecords() {
  try {
    const rows = await db
      .select()
      .from(schema.trirMonthlyRecords)
      .orderBy(desc(schema.trirMonthlyRecords.year), desc(schema.trirMonthlyRecords.monthIndex));

    return rows.map((r: any) => ({
      ...r,
      id: String(r.id),
      year: Number(r.year),
      month: String(r.month),
      monthIndex: Number(r.monthIndex || getJalaliMonthIndexFromStr(r.month)),
      attendance: Number(r.attendanceHours ?? 0),
      mission: Number(r.missionHours ?? 0),
      contractor: Number(r.contractorHours ?? 0),
      attendanceHours: Number(r.attendanceHours ?? 0),
      missionHours: Number(r.missionHours ?? 0),
      contractorHours: Number(r.contractorHours ?? 0),
      totalHours: Number(r.totalHours ?? 0),
      incidents: Number(r.incidents ?? 0),
      monthlyTrir: Number(r.monthlyTrir ?? 0),
      monthlyTRIR: Number(r.monthlyTrir ?? 0),
      rollingTrir: Number(r.rollingTrir ?? 0),
      rollingTRIR: Number(r.rollingTrir ?? 0),
      notes: r.notes || '',
    }));
  } catch (error) {
    console.error('Failed to fetch TRIR records:', error);
    throw new Error('Failed to fetch TRIR records', { cause: error });
  }
}

export async function upsertTrirRecord(data: any) {
  try {
    const year = Number(data.year) || 1404;
    const month = data.month !== undefined && data.month !== null ? String(data.month) : 'فروردین';
    const monthIndex = getJalaliMonthIndexFromStr(month);

    const attendanceHours = Number(data.attendanceHours ?? data.attendance ?? 0) || 0;
    const missionHours = Number(data.missionHours ?? data.mission ?? 0) || 0;
    const contractorHours = Number(data.contractorHours ?? data.contractor ?? 0) || 0;
    const calculatedTotal = attendanceHours + missionHours + contractorHours;
    const totalHours = Number(data.totalHours ?? data.manHours ?? calculatedTotal) || calculatedTotal;
    const incidents = Number(data.incidents ?? data.recordableIncidents ?? 0) || 0;

    let monthlyTrir = 0;
    if (data.monthlyTrir !== undefined && data.monthlyTrir !== null && !isNaN(Number(data.monthlyTrir))) {
      monthlyTrir = Number(data.monthlyTrir);
    } else if (data.monthlyTRIR !== undefined && data.monthlyTRIR !== null && !isNaN(Number(data.monthlyTRIR))) {
      monthlyTrir = Number(data.monthlyTRIR);
    } else if (data.trir !== undefined && data.trir !== null && !isNaN(Number(data.trir))) {
      monthlyTrir = Number(data.trir);
    } else if (totalHours > 0) {
      monthlyTrir = Number(((incidents * 1000000) / totalHours).toFixed(2));
    }

    let rollingTrir = 0;
    if (data.rollingTrir !== undefined && data.rollingTrir !== null && !isNaN(Number(data.rollingTrir))) {
      rollingTrir = Number(data.rollingTrir);
    } else if (data.rollingTRIR !== undefined && data.rollingTRIR !== null && !isNaN(Number(data.rollingTRIR))) {
      rollingTrir = Number(data.rollingTRIR);
    }
    const notes = data.notes !== undefined && data.notes !== null ? String(data.notes) : null;

    // Check all existing records for the same period
    const allExisting = await db.select().from(schema.trirMonthlyRecords);
    const normTargetMonth = normalizeMonthForDeduplication(month);

    const isNumericId = data.id !== undefined && data.id !== null && /^\d+$/.test(String(data.id).trim());
    const targetNumericId = isNumericId ? Number(data.id) : null;

    const matchingRows = allExisting.filter((r: any) => {
      if (targetNumericId && r.id === targetNumericId) return true;
      const rYear = Number(r.year);
      const rNormMonth = normalizeMonthForDeduplication(r.month);
      return rYear === year && (rNormMonth === normTargetMonth || r.month === month);
    });

    let primaryRow = matchingRows.length > 0 ? matchingRows[0] : null;

    // If multiple duplicates exist, delete the extra ones to keep data strictly unique
    if (matchingRows.length > 1) {
      const extraIds = matchingRows.slice(1).map(r => r.id);
      await db.delete(schema.trirMonthlyRecords).where(inArray(schema.trirMonthlyRecords.id, extraIds));
    }

    let savedRow: any = null;
    if (primaryRow && primaryRow.id) {
      const res = await db
        .update(schema.trirMonthlyRecords)
        .set({
          year,
          month,
          monthIndex,
          incidents,
          attendanceHours,
          missionHours,
          contractorHours,
          totalHours,
          monthlyTrir,
          rollingTrir,
          notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.trirMonthlyRecords.id, Number(primaryRow.id)))
        .returning();
      savedRow = res && res.length > 0 ? res[0] : primaryRow;
    } else {
      const res = await db
        .insert(schema.trirMonthlyRecords)
        .values({
          year,
          month,
          monthIndex,
          incidents,
          attendanceHours,
          missionHours,
          contractorHours,
          totalHours,
          monthlyTrir,
          rollingTrir,
          notes,
          updatedAt: new Date(),
        })
        .returning();
      if (res && res.length > 0) {
        savedRow = res[0];
      }
    }

    if (!savedRow) {
      savedRow = {
        id: data.id || Date.now(),
        year,
        month,
        monthIndex,
        incidents,
        attendanceHours,
        missionHours,
        contractorHours,
        totalHours,
        monthlyTrir,
        rollingTrir,
        notes,
      };
    }

    const finalId = savedRow.id !== undefined && savedRow.id !== null ? String(savedRow.id) : String(data.id || Date.now());

    return {
      ...savedRow,
      id: finalId,
      year: Number(savedRow.year ?? year),
      month: String(savedRow.month ?? month),
      monthIndex: Number(savedRow.monthIndex ?? monthIndex),
      attendance: Number(savedRow.attendanceHours ?? attendanceHours),
      mission: Number(savedRow.missionHours ?? missionHours),
      contractor: Number(savedRow.contractorHours ?? contractorHours),
      attendanceHours: Number(savedRow.attendanceHours ?? attendanceHours),
      missionHours: Number(savedRow.missionHours ?? missionHours),
      contractorHours: Number(savedRow.contractorHours ?? contractorHours),
      totalHours: Number(savedRow.totalHours ?? totalHours),
      incidents: Number(savedRow.incidents ?? incidents),
      monthlyTrir: Number(savedRow.monthlyTrir ?? monthlyTrir),
      rollingTrir: Number(savedRow.rollingTrir ?? rollingTrir),
      notes: savedRow.notes || notes || '',
    };
  } catch (error) {
    console.error('Failed to upsert TRIR record:', error);
    throw new Error('Failed to upsert TRIR record', { cause: error });
  }
}

export async function upsertTrirBatch(records: any[]) {
  if (!Array.isArray(records) || records.length === 0) return [];
  const results: any[] = [];
  for (const rec of records) {
    try {
      const saved = await upsertTrirRecord(rec);
      if (saved) results.push(saved);
    } catch (e) {
      console.error('Error in upsertTrirBatch item:', e);
    }
  }
  return results;
}

export async function deduplicateTrirRecordsInDb(): Promise<number> {
  try {
    const all = await db.select().from(schema.trirMonthlyRecords);
    if (!all || all.length <= 1) return 0;

    const seenPeriods = new Set<string>();
    const idsToDelete: number[] = [];

    // Sort descending by ID so we keep the newest updated record
    all.sort((a, b) => b.id - a.id);

    for (const r of all) {
      const year = Number(r.year);
      const normMonth = normalizeMonthForDeduplication(r.month);
      const periodKey = `${year}-${normMonth}`;

      if (seenPeriods.has(periodKey)) {
        idsToDelete.push(r.id);
      } else {
        seenPeriods.add(periodKey);
      }
    }

    if (idsToDelete.length > 0) {
      for (let i = 0; i < idsToDelete.length; i += 100) {
        const chunk = idsToDelete.slice(i, i + 100);
        await db.delete(schema.trirMonthlyRecords).where(inArray(schema.trirMonthlyRecords.id, chunk));
      }
    }
    return idsToDelete.length;
  } catch (error) {
    console.error('Failed to deduplicate TRIR records in DB:', error);
    return 0;
  }
}

export async function deleteTrirRecord(idOrYearMonth: string | number, year?: number, month?: string) {
  try {
    const rawId = String(idOrYearMonth || '').trim();

    // 1. CLEAR ALL RECORDS if requested
    if (rawId.toLowerCase() === 'all' || rawId.toLowerCase() === 'clear_all' || rawId === '') {
      const res = await db.delete(schema.trirMonthlyRecords).returning();
      return { success: true, deletedCount: res.length, message: 'All TRIR records cleared permanently.' };
    }

    // 2. Query all existing records to find all matching rows (including duplicates)
    const allRecords = await db.select().from(schema.trirMonthlyRecords);
    const isNumeric = /^\d+$/.test(rawId);
    const numId = isNumeric ? Number(rawId) : null;

    let targetYear = year ? Number(year) : undefined;
    let targetMonth = month ? normalizeMonthForDeduplication(month) : undefined;

    // If numeric ID given, locate target record to also get its year & month
    if (numId !== null) {
      const matched = allRecords.find(r => r.id === numId);
      if (matched) {
        if (!targetYear) targetYear = Number(matched.year);
        if (!targetMonth) targetMonth = normalizeMonthForDeduplication(matched.month);
      }
    }

    const idsToDelete = new Set<number>();

    for (const r of allRecords) {
      const rIdStr = String(r.id);
      const rYear = Number(r.year);
      const rNormMonth = normalizeMonthForDeduplication(r.month);

      // Match by exact primary key
      if (numId !== null && r.id === numId) {
        idsToDelete.add(r.id);
      } else if (rIdStr === rawId) {
        idsToDelete.add(r.id);
      }

      // Match by year & month
      if (targetYear && targetMonth && rYear === targetYear && rNormMonth === targetMonth) {
        idsToDelete.add(r.id);
      }

      // Match by composite string ID like "1404-فروردین" or "trir-1404-1"
      if (rawId.includes(String(rYear)) && (rawId.includes(r.month) || (rNormMonth && rawId.includes(rNormMonth)))) {
        idsToDelete.add(r.id);
      }
    }

    if (idsToDelete.size > 0) {
      const deleteArray = Array.from(idsToDelete);
      const res = await db.delete(schema.trirMonthlyRecords).where(inArray(schema.trirMonthlyRecords.id, deleteArray)).returning();
      return { success: true, deletedCount: res.length, deletedIds: deleteArray };
    }

    // 3. Fallback direct condition if passed directly
    if (year && month) {
      const normM = normalizeMonthForDeduplication(month);
      const res = await db.delete(schema.trirMonthlyRecords).where(
        and(eq(schema.trirMonthlyRecords.year, Number(year)), eq(schema.trirMonthlyRecords.month, String(month)))
      ).returning();
      return { success: true, deletedCount: res.length };
    }

    return { success: true, deletedCount: 0, message: 'No matching records found to delete' };
  } catch (error) {
    console.error('Failed to delete TRIR record:', error);
    throw new Error('Failed to delete TRIR record', { cause: error });
  }
}

// ============================================================================
// 7. HSE WARNINGS
// ============================================================================
export async function getAllSafetyWarnings() {
  try {
    const rows = await withDbRetry(() =>
      db.select().from(schema.safetyWarnings).orderBy(desc(schema.safetyWarnings.createdAt))
    );
    return rows.map((r: any, idx: number) => {
      let d = r.day;
      let m = r.month;
      let y = r.year;
      if (!d || !m || !y) {
        if (r.warningDate && typeof r.warningDate === 'string') {
          const parts = r.warningDate.split('/');
          if (parts.length === 3) {
            y = parseInt(parts[0], 10) || 1404;
            m = parts[1] || 'فروردین';
            d = parseInt(parts[2], 10) || 1;
          }
        }
      }
      return {
        ...r,
        id: String(r.id),
        day: d || 1,
        month: m || 'فروردین',
        year: y || 1404,
        number: r.number || `HSE/w/${String(r.id || idx + 1).padStart(3, '0')}`,
        site: r.site || '',
        name: r.name || r.personnelName || 'پرسنل',
        unit: r.unit || '',
        type: r.type || (r.warningLevel === 'WRITTEN_1' ? 'واحدی' : 'فردی'),
        reason: r.reason || '',
        noticeText: r.actionTaken || undefined,
        personnelName: r.personnelName || r.name || 'پرسنل',
        warningDate: r.warningDate || `${y || 1404}/${m || 'فروردین'}/${d || 1}`,
        warningLevel: r.warningLevel || 'VERBAL',
        status: r.status || 'ACTIVE',
      };
    });
  } catch (error) {
    console.error('Failed to fetch safety warnings:', error);
    throw new Error('Failed to fetch safety warnings', { cause: error });
  }
}

export async function createSafetyWarning(data: any) {
  try {
    const payload: any = {
      personnelName: data.name || data.personnelName || 'پرسنل',
      warningDate: data.warningDate || `${data.year || 1404}/${data.month || 'فروردین'}/${data.day || 1}`,
      warningLevel: data.warningLevel || (data.type === 'واحدی' ? 'WRITTEN_1' : 'VERBAL'),
      reason: data.reason || 'نقض موازین ایمنی',
      issuedBy: data.issuedBy || 'مسئول HSE',
      status: data.status || 'ACTIVE',
      number: data.number || undefined,
      name: data.name || data.personnelName || undefined,
      site: data.site || '',
      unit: data.unit || '',
      type: data.type || 'فردی',
      day: data.day ? parseInt(String(data.day), 10) : undefined,
      month: data.month || undefined,
      year: data.year ? parseInt(String(data.year), 10) : undefined,
    };
    if (data.nationalCode) payload.nationalCode = data.nationalCode;
    if (data.personnelCode) payload.personnelCode = data.personnelCode;
    if (data.noticeText || data.actionTaken) payload.actionTaken = data.noticeText || data.actionTaken;

    // Deduplication check by notice number before inserting
    if (payload.number) {
      const existing = await db
        .select()
        .from(schema.safetyWarnings)
        .where(eq(schema.safetyWarnings.number, payload.number))
        .limit(1);

      if (existing.length > 0) {
        const res = await db
          .update(schema.safetyWarnings)
          .set(payload)
          .where(eq(schema.safetyWarnings.id, existing[0].id))
          .returning();
        const r = res[0] || existing[0];
        return {
          ...r,
          id: String(r.id),
          day: r.day || data.day || 1,
          month: r.month || data.month || 'فروردین',
          year: r.year || data.year || 1404,
          number: r.number || data.number || `HSE/w/${String(r.id).padStart(3, '0')}`,
          site: r.site || data.site || '',
          name: r.name || r.personnelName || data.name || 'پرسنل',
          unit: r.unit || data.unit || '',
          type: r.type || data.type || 'فردی',
          reason: r.reason || data.reason || '',
          noticeText: r.actionTaken || data.noticeText || undefined,
        };
      }
    }

    const res = await db.insert(schema.safetyWarnings).values(payload).returning();
    const r = res[0] || { id: Date.now(), ...payload };
    const formattedWarning = {
      ...r,
      id: String(r.id),
      day: r.day || data.day || 1,
      month: r.month || data.month || 'فروردین',
      year: r.year || data.year || 1404,
      number: r.number || data.number || `HSE/w/${String(r.id).padStart(3, '0')}`,
      site: r.site || data.site || '',
      name: r.name || r.personnelName || data.name || 'پرسنل',
      unit: r.unit || data.unit || '',
      type: r.type || data.type || 'فردی',
      reason: r.reason || data.reason || '',
      noticeText: r.actionTaken || data.noticeText || undefined,
    };

    void dispatchDomainWebhookEvent({
      eventType: 'warning.issued',
      moduleName: 'safety_warnings',
      correlationKey: formattedWarning.number,
      idempotencyKey: `idem_warning_${formattedWarning.number}_${formattedWarning.warningDate || ''}`,
      data: {
        id: formattedWarning.id,
        number: formattedWarning.number,
        type: formattedWarning.type,
        warningLevel: r.warningLevel || payload.warningLevel,
        site: formattedWarning.site,
        unit: formattedWarning.unit,
        personnelCode: r.personnelCode || payload.personnelCode || null,
        reason: formattedWarning.reason,
        warningDate: r.warningDate || payload.warningDate,
        issuedBy: r.issuedBy || payload.issuedBy,
        status: r.status || payload.status,
      },
    });

    return formattedWarning;
  } catch (error) {
    console.error('Failed to create safety warning:', error);
    throw new Error('Failed to create safety warning', { cause: error });
  }
}

export async function createSafetyWarningsBatch(warnings: any[]) {
  if (!Array.isArray(warnings) || warnings.length === 0) return [];
  const results = [];
  for (const w of warnings) {
    try {
      const saved = await createSafetyWarning(w);
      if (saved) results.push(saved);
    } catch (e) {
      console.error('Error inserting warning in batch:', e);
    }
  }
  return results;
}

export async function deduplicateSafetyWarningsInDb(): Promise<number> {
  try {
    const all = await db.select().from(schema.safetyWarnings);
    if (!all || all.length <= 1) return 0;

    const seenNumbers = new Set<string>();
    const seenSignatures = new Set<string>();
    const idsToDelete: number[] = [];

    // Sort descending by ID so we keep the newest record
    all.sort((a, b) => b.id - a.id);

    for (const r of all) {
      const num = String(r.number || '').trim().toLowerCase();
      const pName = String(r.personnelName || r.name || '').trim().toLowerCase();
      const wDate = String(r.warningDate || '').trim();
      const u = String(r.unit || '').trim().toLowerCase();
      const reas = String(r.reason || '').trim().toLowerCase();
      const sig = `${pName}:::${wDate}:::${u}:::${reas}`;

      let isDup = false;
      if (num && num !== 'hse/w/' && num !== 'hse/w/000' && seenNumbers.has(num)) {
        isDup = true;
      } else if (pName && reas && seenSignatures.has(sig)) {
        isDup = true;
      }

      if (isDup) {
        idsToDelete.push(r.id);
      } else {
        if (num && num !== 'hse/w/' && num !== 'hse/w/000') seenNumbers.add(num);
        if (pName && reas) seenSignatures.add(sig);
      }
    }

    if (idsToDelete.length > 0) {
      for (let i = 0; i < idsToDelete.length; i += 100) {
        const chunk = idsToDelete.slice(i, i + 100);
        await db.delete(schema.safetyWarnings).where(inArray(schema.safetyWarnings.id, chunk));
      }
    }
    return idsToDelete.length;
  } catch (error) {
    console.error('Failed to deduplicate safety warnings in DB:', error);
    return 0;
  }
}

export async function deleteSafetyWarningById(id: number | string): Promise<boolean> {
  try {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numericId)) {
      // If it's a string that doesn't parse to number, try checking by notice number
      await db.delete(schema.safetyWarnings).where(eq(schema.safetyWarnings.number, String(id)));
      return true;
    }
    await db.delete(schema.safetyWarnings).where(eq(schema.safetyWarnings.id, numericId));
    return true;
  } catch (error) {
    console.error('Failed to delete safety warning by ID in DB:', error);
    return false;
  }
}

export async function clearAllSafetyWarnings(): Promise<number> {
  try {
    const res = await db.delete(schema.safetyWarnings).returning({ id: schema.safetyWarnings.id });
    return res.length;
  } catch (error) {
    console.error('Failed to clear all safety warnings in DB:', error);
    throw new Error('Failed to clear all safety warnings in DB', { cause: error });
  }
}

// ============================================================================
// 8. FIRE EQUIPMENT & 5S AUDITS
// ============================================================================
function normalizeEquipCodeValue(val: any): string {
  return String(val ?? '').trim();
}

function extractCanonicalEquipmentCode(data: any): string {
  const candidates = [
    data?.code,
    data?.assetCode,
    data?.specializedCode,
    data?.fireBoxNo,
    data?.foamStationNo,
    data?.tag,
    data?.id,
  ];
  for (const c of candidates) {
    const clean = normalizeEquipCodeValue(c);
    if (clean) return clean;
  }
  return '';
}

function buildComposedLocationString(data: any): string {
  const details = data?.locationDetails && typeof data.locationDetails === 'object' ? data.locationDetails : {};
  const complex = normalizeEquipCodeValue(details.complex ?? data?.complex);
  const unit = normalizeEquipCodeValue(details.unit ?? data?.unit);
  const direction = normalizeEquipCodeValue(details.direction ?? data?.direction);
  const floor = normalizeEquipCodeValue(details.floor ?? data?.floor);
  const exactLocation = normalizeEquipCodeValue(details.exactLocation ?? data?.exactLocation);

  const parts = [
    complex,
    unit,
    direction,
    floor ? (floor === 'همکف' || floor === 'فاقد طبقه' || floor.startsWith('طبقه') ? floor : `طبقه ${floor}`) : '',
    exactLocation,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' - ');
  }
  return normalizeEquipCodeValue(data?.location) || 'نامشخص';
}

function mapFireEquipmentRowToDto(row: any): any {
  let extra: Record<string, any> = {};
  if (row.extraData && typeof row.extraData === 'object') {
    extra = { ...(row.extraData as Record<string, any>) };
  } else if (typeof row.notes === 'string' && row.notes.trim().startsWith('{')) {
    try {
      extra = JSON.parse(row.notes);
    } catch {
      extra = {};
    }
  }

  const canonicalCode = normalizeEquipCodeValue(extra.code || row.code || extra.id || row.id);
  const frontendId = normalizeEquipCodeValue(extra.id || row.code || String(row.id));
  const category = normalizeEquipCodeValue(extra.category || row.equipmentType || 'Fire Extinguisher Capsol');

  const locationDetails = {
    complex: normalizeEquipCodeValue(extra.locationDetails?.complex ?? extra.complex ?? ''),
    unit: normalizeEquipCodeValue(extra.locationDetails?.unit ?? extra.unit ?? ''),
    direction: normalizeEquipCodeValue(extra.locationDetails?.direction ?? extra.direction ?? ''),
    floor: normalizeEquipCodeValue(extra.locationDetails?.floor ?? extra.floor ?? ''),
    exactLocation: normalizeEquipCodeValue(extra.locationDetails?.exactLocation ?? extra.exactLocation ?? ''),
  };

  const composedLocation =
    normalizeEquipCodeValue(extra.location) ||
    normalizeEquipCodeValue(row.location) ||
    buildComposedLocationString({ ...extra, locationDetails });

  const operationalStatus =
    normalizeEquipCodeValue(extra.operationalStatus) ||
    (row.status === 'OUT_OF_SERVICE'
      ? 'غیرفعال'
      : row.status === 'NEEDS_RECHARGE'
      ? 'انتقال جهت شارژ'
      : row.status === 'IN_TEST'
      ? 'انتقال جهت تست'
      : 'فعال');

  const isTemporaryOut =
    operationalStatus === 'انتقال جهت شارژ' || operationalStatus === 'انتقال جهت تست';

  return {
    ...extra,
    dbId: row.id,
    id: frontendId,
    code: canonicalCode,
    category,
    equipmentType: row.equipmentType || category,
    location: composedLocation,
    complex: locationDetails.complex,
    unit: locationDetails.unit,
    direction: locationDetails.direction,
    floor: locationDetails.floor,
    exactLocation: locationDetails.exactLocation,
    locationDetails,
    primaryLocation: extra.primaryLocation || composedLocation,
    primaryLocationDetails: extra.primaryLocationDetails || locationDetails,
    operationalStatus,
    isTemporaryOut,
    currentDestination: extra.currentDestination || '',
    statusHistory: Array.isArray(extra.statusHistory) ? extra.statusHistory : [],
    inspections: Array.isArray(extra.inspections) ? extra.inspections : [],
    defects: Array.isArray(extra.defects) ? extra.defects : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getAllFireEquipment() {
  try {
    const rows = await withDbRetry(() =>
      db.select().from(schema.fireEquipment).orderBy(desc(schema.fireEquipment.updatedAt))
    );
    return rows.map(mapFireEquipmentRowToDto);
  } catch (error) {
    console.error('Failed to fetch fire equipment:', error);
    throw new Error('Failed to fetch fire equipment', { cause: error });
  }
}

export async function upsertFireEquipment(data: any, actorUsername: string = 'system') {
  try {
    const isCreateMode = Boolean(data?.__isCreate);
    const canonicalCode = extractCanonicalEquipmentCode(data);
    if (!canonicalCode) {
      const err: any = new Error('کد یکتای تجهیز الزامی است.');
      err.statusCode = 400;
      throw err;
    }

    // Load all existing records to check for cross-form or case-insensitive code collisions
    const allRows = await withDbRetry(() => db.select().from(schema.fireEquipment));
    const allDtos = allRows.map(mapFireEquipmentRowToDto);

    const normalizedTargetCode = canonicalCode.toLowerCase();
    const targetFrontendId = normalizeEquipCodeValue(data?.id || canonicalCode).toLowerCase();

    const matchedExistingDto = allDtos.find((item) => {
      const itemCodes = [
        item.code,
        item.id,
        item.assetCode,
        item.specializedCode,
        item.fireBoxNo,
        item.foamStationNo,
        item.tag,
      ]
        .map((v) => normalizeEquipCodeValue(v).toLowerCase())
        .filter(Boolean);

      return itemCodes.includes(normalizedTargetCode) || (targetFrontendId && itemCodes.includes(targetFrontendId));
    });

    if (isCreateMode && matchedExistingDto) {
      const conflictErr: any = new Error(
        `تجهیز با کد/شناسه «${canonicalCode}» قبلاً در فرم «${matchedExistingDto.category}» (${matchedExistingDto.location || 'بدون موقعیت'}) ثبت شده است.`
      );
      conflictErr.statusCode = 409;
      conflictErr.code = 'DUPLICATE_EQUIPMENT_CODE';
      conflictErr.existingRecord = matchedExistingDto;
      throw conflictErr;
    }

    // Even in update mode, ensure user didn't change the secondary code (assetCode/tag/etc.) to collide with a DIFFERENT existing equipment
    if (!isCreateMode && matchedExistingDto) {
      const editingId = normalizeEquipCodeValue(data?.__editingId || data?.id).toLowerCase();
      if (
        editingId &&
        normalizeEquipCodeValue(matchedExistingDto.id).toLowerCase() !== editingId &&
        normalizeEquipCodeValue(matchedExistingDto.code).toLowerCase() !== editingId
      ) {
        const conflictErr: any = new Error(
          `کد واردشده «${canonicalCode}» متعلق به تجهیز دیگری با شناسه «${matchedExistingDto.id}» در فرم «${matchedExistingDto.category}» است.`
        );
        conflictErr.statusCode = 409;
        conflictErr.code = 'DUPLICATE_EQUIPMENT_CODE';
        conflictErr.existingRecord = matchedExistingDto;
        throw conflictErr;
      }
    }

    const existingRow = matchedExistingDto
      ? allRows.find((r) => r.id === matchedExistingDto.dbId)
      : undefined;
    const existingDto = matchedExistingDto || null;

    const locationDetails = {
      complex: normalizeEquipCodeValue(data?.locationDetails?.complex ?? data?.complex ?? existingDto?.locationDetails?.complex ?? ''),
      unit: normalizeEquipCodeValue(data?.locationDetails?.unit ?? data?.unit ?? existingDto?.locationDetails?.unit ?? ''),
      direction: normalizeEquipCodeValue(data?.locationDetails?.direction ?? data?.direction ?? existingDto?.locationDetails?.direction ?? ''),
      floor: normalizeEquipCodeValue(data?.locationDetails?.floor ?? data?.floor ?? existingDto?.locationDetails?.floor ?? ''),
      exactLocation: normalizeEquipCodeValue(data?.locationDetails?.exactLocation ?? data?.exactLocation ?? existingDto?.locationDetails?.exactLocation ?? ''),
    };

    const composedLocation = buildComposedLocationString({
      ...existingDto,
      ...data,
      locationDetails,
    });

    const operationalStatus =
      normalizeEquipCodeValue(data?.operationalStatus) ||
      existingDto?.operationalStatus ||
      'فعال';

    const isTemporaryOut =
      operationalStatus === 'انتقال جهت شارژ' || operationalStatus === 'انتقال جهت تست';

    // Preserve primary location when equipment is temporarily transferred out
    const primaryLocation =
      !isTemporaryOut
        ? composedLocation
        : normalizeEquipCodeValue(data?.primaryLocation || existingDto?.primaryLocation || composedLocation);

    const primaryLocationDetails =
      !isTemporaryOut
        ? locationDetails
        : data?.primaryLocationDetails || existingDto?.primaryLocationDetails || locationDetails;

    // Merge and preserve statusHistory without losing prior entries
    const prevStatusHistory = Array.isArray(existingDto?.statusHistory) ? existingDto.statusHistory : [];
    let nextStatusHistory = Array.isArray(data?.statusHistory) ? data.statusHistory : [...prevStatusHistory];
    if (prevStatusHistory.length > 0 && nextStatusHistory.length < prevStatusHistory.length) {
      const existingIds = new Set(nextStatusHistory.map((h: any) => h.id));
      const merged = [...prevStatusHistory];
      for (const entry of nextStatusHistory) {
        if (!existingIds.has(entry.id)) merged.push(entry);
      }
      nextStatusHistory = merged;
    }

    // If operational status changed or this is a new registration with no status history, ensure an entry is recorded
    const statusChanged = existingDto && existingDto.operationalStatus !== operationalStatus;
    if ((isCreateMode && nextStatusHistory.length === 0) || (statusChanged && nextStatusHistory.length === prevStatusHistory.length)) {
      nextStatusHistory = [
        {
          id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          status: operationalStatus,
          previousStatus: existingDto?.operationalStatus || null,
          changeDate: data?.statusChangeMeta?.changeDate || new Date().toLocaleDateString('fa-IR'),
          reason:
            data?.statusChangeMeta?.reason ||
            (isCreateMode ? 'ثبت اولیه تجهیز در سامانه' : `تغییر وضعیت به ${operationalStatus}`),
          notes: data?.statusChangeMeta?.notes || '',
          previousLocation: data?.statusChangeMeta?.previousLocation || existingDto?.location || composedLocation,
          destinationLocation:
            data?.statusChangeMeta?.destinationLocation ||
            (isTemporaryOut ? data?.currentDestination || '' : composedLocation),
          recordedBy: data?.statusChangeMeta?.recordedBy || actorUsername || 'کارشناس آتش‌نشانی',
          isReturnToService: Boolean(data?.statusChangeMeta?.isReturnToService),
          timestamp: new Date().toISOString(),
        },
        ...nextStatusHistory,
      ];
    }

    // Preserve inspections and defects unless explicitly updated
    const inspections = Array.isArray(data?.inspections)
      ? data.inspections
      : Array.isArray(existingDto?.inspections)
      ? existingDto.inspections
      : [];

    const defects = Array.isArray(data?.defects)
      ? data.defects
      : Array.isArray(existingDto?.defects)
      ? existingDto.defects
      : [];

    const frontendId = normalizeEquipCodeValue(data?.id || existingDto?.id || canonicalCode);
    const category = normalizeEquipCodeValue(data?.category || existingDto?.category || data?.equipmentType || 'Fire Extinguisher Capsol');

    const cleanExtra: Record<string, any> = {
      ...(existingDto || {}),
      ...data,
      id: frontendId,
      code: canonicalCode,
      category,
      location: composedLocation,
      complex: locationDetails.complex,
      unit: locationDetails.unit,
      direction: locationDetails.direction,
      floor: locationDetails.floor,
      exactLocation: locationDetails.exactLocation,
      locationDetails,
      primaryLocation,
      primaryLocationDetails,
      operationalStatus,
      isTemporaryOut,
      statusHistory: nextStatusHistory,
      inspections,
      defects,
    };
    delete cleanExtra.__isCreate;
    delete cleanExtra.__editingId;
    delete cleanExtra.statusChangeMeta;
    delete cleanExtra.dbId;

    const dbStatus =
      operationalStatus === 'غیرفعال'
        ? 'OUT_OF_SERVICE'
        : operationalStatus === 'انتقال جهت شارژ'
        ? 'NEEDS_RECHARGE'
        : operationalStatus === 'انتقال جهت تست'
        ? 'IN_TEST'
        : 'SERVICEABLE';

    const dbValues: any = {
      code: existingRow ? existingRow.code : canonicalCode,
      equipmentType: category,
      location: composedLocation,
      capacity: data?.weight ? `${data.weight} kg` : data?.size ? String(data.size) : existingRow?.capacity || null,
      manufacturingYear:
        data?.buildYear && !isNaN(Number(data.buildYear))
          ? Number(data.buildYear)
          : existingRow?.manufacturingYear || null,
      status: dbStatus,
      pressureStatus: normalizeEquipCodeValue(data?.gaugeStatus || data?.standbyStatus || existingRow?.pressureStatus || 'NORMAL'),
      notes: normalizeEquipCodeValue(data?.description || data?.notes || ''),
      extraData: cleanExtra,
      updatedAt: new Date(),
    };

    let savedRow: any;
    if (existingRow) {
      // Allow updating code if it changed and didn't conflict
      dbValues.code = canonicalCode;
      const res = await withDbRetry(() =>
        db
          .update(schema.fireEquipment)
          .set(dbValues)
          .where(eq(schema.fireEquipment.id, existingRow.id))
          .returning()
      );
      savedRow = res[0];
    } else {
      const res = await withDbRetry(() =>
        db
          .insert(schema.fireEquipment)
          .values(dbValues)
          .onConflictDoUpdate({
            target: schema.fireEquipment.code,
            set: dbValues,
          })
          .returning()
      );
      savedRow = res[0];
    }

    const dto = mapFireEquipmentRowToDto(savedRow);

    await logAudit({
      action: existingRow ? (statusChanged ? 'STATUS_CHANGE_FIRE_EQUIPMENT' : 'UPDATE_FIRE_EQUIPMENT') : 'CREATE_FIRE_EQUIPMENT',
      entityType: 'FIRE_EQUIPMENT',
      entityId: dto.code || dto.id,
      details: {
        id: dto.id,
        code: dto.code,
        category: dto.category,
        location: dto.location,
        operationalStatus: dto.operationalStatus,
        actor: actorUsername,
      },
    }).catch(() => {});

    return dto;
  } catch (error: any) {
    console.error('Failed to upsert fire equipment:', error);
    if (error?.statusCode) {
      throw error;
    }
    throw new Error(error?.message || 'Failed to upsert fire equipment', { cause: error });
  }
}

export async function deleteFireEquipment(idOrCode: string | number, actorUsername: string = 'system') {
  try {
    const cleanTarget = String(idOrCode).trim();
    const allRows = await withDbRetry(() => db.select().from(schema.fireEquipment));
    const matchedRow = allRows.find((r) => {
      const dto = mapFireEquipmentRowToDto(r);
      return (
        String(r.id) === cleanTarget ||
        r.code === cleanTarget ||
        dto.id === cleanTarget ||
        dto.code === cleanTarget
      );
    });

    if (matchedRow) {
      await withDbRetry(() =>
        db.delete(schema.fireEquipment).where(eq(schema.fireEquipment.id, matchedRow.id))
      );
      await logAudit({
        action: 'DELETE_FIRE_EQUIPMENT',
        entityType: 'FIRE_EQUIPMENT',
        entityId: matchedRow.code,
        details: { idOrCode: cleanTarget, actor: actorUsername },
      }).catch(() => {});
      return true;
    }

    const isNum = !isNaN(Number(idOrCode));
    const conditions = [];
    if (isNum) conditions.push(eq(schema.fireEquipment.id, Number(idOrCode)));
    conditions.push(eq(schema.fireEquipment.code, cleanTarget));
    await db.delete(schema.fireEquipment).where(or(...conditions));
    return true;
  } catch (error) {
    console.error('Failed to delete fire equipment:', error);
    throw new Error('Failed to delete fire equipment', { cause: error });
  }
}

export async function getAllFiveSAudits() {
  try {
    return await db.select().from(schema.fiveSAudits).orderBy(desc(schema.fiveSAudits.auditDate));
  } catch (error) {
    console.error('Failed to fetch 5S audits:', error);
    throw new Error('Failed to fetch 5S audits', { cause: error });
  }
}

export async function createFiveSAudit(data: any) {
  try {
    const res = await db.insert(schema.fiveSAudits).values(data).returning();
    return res[0];
  } catch (error) {
    console.error('Failed to create 5S audit:', error);
    throw new Error('Failed to create 5S audit', { cause: error });
  }
}

// ============================================================================
// 9. SYSTEM SETTINGS, AUDIT LOGS, USERS & CENTRAL FULL SYNC
// ============================================================================
export async function getAllSystemSettings() {
  try {
    const res = await withDbRetry(() => db.select().from(schema.systemSettings));
    const map: Record<string, any> = {};
    for (const r of res) {
      map[r.key] = r.value;
    }
    return map;
  } catch (error) {
    console.error('Failed to get all system settings:', error);
    return {};
  }
}

export async function getSystemSetting(key: string) {
  try {
    const res = await withDbRetry(() =>
      db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key))
    );
    return res[0]?.value || null;
  } catch (error) {
    console.error('Failed to get system setting:', error);
    return null;
  }
}

export async function setSystemSetting(key: string, value: any, description?: string) {
  try {
    await db
      .insert(schema.systemSettings)
      .values({ key, value, description, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value, description, updatedAt: new Date() },
      });
    return { success: true };
  } catch (error) {
    console.error('Failed to set system setting:', error);
    throw new Error('Failed to set system setting', { cause: error });
  }
}

export async function deleteSystemSetting(key: string) {
  try {
    await db.delete(schema.systemSettings).where(eq(schema.systemSettings.key, key));
    return { success: true };
  } catch (error) {
    console.error('Failed to delete system setting:', error);
    return { success: false };
  }
}

export async function getAllUsersList() {
  try {
    return await authService.getAllUsers();
  } catch (error) {
    console.error('Failed to get users:', error);
    return [];
  }
}

export async function upsertUserRecord(userData: any, actor?: any) {
  try {
    return await authService.upsertUser(userData, actor);
  } catch (error) {
    console.error('Failed to upsert user:', error);
    throw error;
  }
}

export async function softDeleteUserRecord(uid: string, actor?: any) {
  try {
    return await authService.softDeleteUser(uid, actor);
  } catch (error) {
    console.error('Failed to soft delete user:', error);
    throw error;
  }
}

export async function getAllNotificationsList() {
  try {
    return await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.isDeleted, false))
      .orderBy(desc(schema.notifications.createdAt));
  } catch (error) {
    console.error('Failed to get notifications:', error);
    return [];
  }
}

export async function saveNotificationRecord(notif: any) {
  try {
    const notifId = notif.id || notif.notifId || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const values = {
      notifId,
      title: notif.title || 'Notification',
      body: notif.body || '',
      type: notif.type || 'in-app',
      targetType: notif.targetType || 'all',
      targetValues: notif.targetValues || [],
      sender: notif.sender || 'System',
      readBy: notif.readBy || [],
      isDeleted: false,
    };

    await db
      .insert(schema.notifications)
      .values(values)
      .onConflictDoUpdate({
        target: schema.notifications.notifId,
        set: {
          title: values.title,
          body: values.body,
          type: values.type,
          targetType: values.targetType,
          targetValues: values.targetValues,
          readBy: values.readBy,
          isDeleted: false,
        },
      });
    return values;
  } catch (error) {
    console.error('Failed to save notification:', error);
    throw new Error('Failed to save notification', { cause: error });
  }
}

export async function deleteNotificationRecord(idOrNotifId: string) {
  try {
    const numId = Number(idOrNotifId);
    if (!isNaN(numId) && Number.isInteger(numId) && numId > 0) {
      await db
        .update(schema.notifications)
        .set({ isDeleted: true })
        .where(or(eq(schema.notifications.id, numId), eq(schema.notifications.notifId, idOrNotifId)));
    } else {
      await db
        .update(schema.notifications)
        .set({ isDeleted: true })
        .where(eq(schema.notifications.notifId, idOrNotifId));
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete notification:', error);
    throw new Error('Failed to delete notification', { cause: error });
  }
}

export async function clearAllNotificationsRecords() {
  try {
    await db
      .update(schema.notifications)
      .set({ isDeleted: true })
      .where(eq(schema.notifications.isDeleted, false));
    return { success: true };
  } catch (error) {
    console.error('Failed to clear notifications:', error);
    throw new Error('Failed to clear notifications', { cause: error });
  }
}

export async function logAudit(entry: {
  userId?: number;
  userUid?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
}) {
  try {
    let validUserId: number | null = null;
    if (typeof entry.userId === 'number' && Number.isInteger(entry.userId) && entry.userId > 0) {
      try {
        const userExists = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.id, entry.userId))
          .limit(1);
        if (userExists && userExists.length > 0) {
          validUserId = entry.userId;
        }
      } catch {
        validUserId = null;
      }
    }

    await db.insert(schema.auditLogs).values({
      ...entry,
      userId: validUserId,
      createdAt: new Date(),
    });
  } catch (error) {
    try {
      // Fallback with userId = null in case of constraint failure
      await db.insert(schema.auditLogs).values({
        ...entry,
        userId: null,
        createdAt: new Date(),
      });
    } catch (fallbackError) {
      console.error('Audit log failed silently:', fallbackError);
    }
  }
}

export async function getAuditLogsList(limit: number = 200) {
  try {
    return await withDbRetry(() =>
      db
        .select()
        .from(schema.auditLogs)
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(limit)
    );
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return [];
  }
}

// ============================================================================
// NON-CONFORMANCE MANAGEMENT (CAPA)
// ============================================================================
export async function getAllNonConformances(filters?: {
  sourceModule?: string;
  status?: string;
  riskLevel?: string;
  assignedTo?: string;
  unitId?: number;
}) {
  try {
    const conditions = [];
    if (filters?.sourceModule) conditions.push(eq(schema.nonConformances.sourceModule, filters.sourceModule));
    if (filters?.status) conditions.push(eq(schema.nonConformances.status, filters.status));
    if (filters?.riskLevel) conditions.push(eq(schema.nonConformances.riskLevel, filters.riskLevel));
    if (filters?.assignedTo) conditions.push(eq(schema.nonConformances.assignedTo, filters.assignedTo));
    if (filters?.unitId) conditions.push(eq(schema.nonConformances.unitId, filters.unitId));

    let result = [];
    if (conditions.length > 0) {
      result = await withDbRetry(() =>
        db
          .select()
          .from(schema.nonConformances)
          .where(and(...conditions))
          .orderBy(desc(schema.nonConformances.createdAt))
      );
    } else {
      result = await withDbRetry(() =>
        db
          .select()
          .from(schema.nonConformances)
          .orderBy(desc(schema.nonConformances.createdAt))
      );
    }

    // Deduplicate records with matching sourceModule + sourceRecordId + title or trackingCode
    const seen = new Set<string>();
    const deduplicated = [];
    for (const record of result) {
      const key = (record.sourceModule && record.sourceRecordId)
        ? `${record.sourceModule}:${record.sourceRecordId}:${record.title || ''}`
        : record.trackingCode || `id:${record.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(record);
      }
    }
    return deduplicated;
  } catch (error) {
    console.error('Failed to get non conformances:', error);
    return [];
  }
}

export async function getNonConformanceByIdOrTrackingCode(idOrCode: string | number) {
  try {
    const isNum = !isNaN(Number(idOrCode));
    const conditions = [];
    if (isNum) conditions.push(eq(schema.nonConformances.id, Number(idOrCode)));
    conditions.push(eq(schema.nonConformances.trackingCode, String(idOrCode)));

    const records = await withDbRetry(() =>
      db
        .select()
        .from(schema.nonConformances)
        .where(or(...conditions))
        .limit(1)
    );
    return records[0] || null;
  } catch (error) {
    console.error('Failed to get non conformance by id/code:', error);
    return null;
  }
}

export async function createNonConformance(data: any, username: string = 'system') {
  try {
    // 1. Prevent duplicate records by sourceModule + sourceRecordId
    if (data.sourceModule && data.sourceRecordId) {
      const existing = await withDbRetry(() =>
        db
          .select()
          .from(schema.nonConformances)
          .where(
            and(
              eq(schema.nonConformances.sourceModule, data.sourceModule),
              eq(schema.nonConformances.sourceRecordId, String(data.sourceRecordId))
            )
          )
          .limit(1)
      );

      if (existing && existing.length > 0) {
        const found = existing[0];
        const updated = await updateNonConformance(found.id, {
          title: data.title || found.title,
          description: data.description || found.description,
          riskLevel: data.riskLevel || found.riskLevel,
          unitName: data.unitName || found.unitName,
          category: data.category || found.category,
          correctiveAction: data.correctiveAction || found.correctiveAction,
          assignedToName: data.assignedToName || found.assignedToName,
          updatedAt: new Date(),
        }, username);
        return updated || found;
      }
    }

    // 2. Prevent duplicate by trackingCode
    if (data.trackingCode) {
      const existingByCode = await getNonConformanceByIdOrTrackingCode(data.trackingCode);
      if (existingByCode) {
        return existingByCode;
      }
    }

    const year = new Date().toLocaleDateString('fa-IR').split('/')[0] || '1404';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const trackingCode = data.trackingCode || `NC-${year}-${randomSuffix}`;

    const newRecord = {
      trackingCode,
      title: data.title || 'ثبت عدم انطباق',
      sourceModule: data.sourceModule || 'general',
      sourceRecordId: data.sourceRecordId ? String(data.sourceRecordId) : null,
      sourceTitle: data.sourceTitle || null,
      unitId: data.unitId ? Number(data.unitId) : null,
      unitName: data.unitName || null,
      riskLevel: data.riskLevel || 'MEDIUM',
      category: data.category || 'ایمنی و بهداشت',
      description: data.description || '',
      evidence: data.evidence || null,
      rootCause: data.rootCause || null,
      correctiveAction: data.correctiveAction || null,
      preventiveAction: data.preventiveAction || null,
      assignedTo: data.assignedTo || null,
      assignedToName: data.assignedToName || null,
      dueDate: data.dueDate || null,
      completionDate: data.completionDate || null,
      status: data.status || 'REGISTERED',
      effectivenessVerified: !!data.effectivenessVerified,
      effectivenessNotes: data.effectivenessNotes || null,
      workflowHistory: [
        {
          timestamp: new Date().toISOString(),
          actor: username,
          action: 'REGISTERED',
          notes: 'ثبت اولیه عدم انطباق در سامانه'
        }
      ],
      stageSignatures: data.stageSignatures || {},
      currentStageAssignee: data.currentStageAssignee || null,
      cancellationInfo: data.cancellationInfo || null,
      activeReferralId: data.activeReferralId || null,
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      createdBy: username,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const inserted = await withDbRetry(() =>
      db.insert(schema.nonConformances).values(newRecord).returning()
    );

    await logAudit({
      action: 'CREATE',
      entityType: 'NON_CONFORMANCE',
      entityId: trackingCode,
      details: { trackingCode, sourceModule: newRecord.sourceModule, user: username },
    });

    return inserted[0];
  } catch (error) {
    console.error('Failed to create non-conformance:', error);
    throw error;
  }
}

export async function updateNonConformance(id: number | string, data: any, username: string = 'system') {
  try {
    const current = await getNonConformanceByIdOrTrackingCode(id);
    if (!current) throw new Error('Non-conformance record not found');

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.sourceModule !== undefined) updateData.sourceModule = data.sourceModule;
    if (data.sourceRecordId !== undefined) updateData.sourceRecordId = String(data.sourceRecordId);
    if (data.sourceTitle !== undefined) updateData.sourceTitle = data.sourceTitle;
    if (data.unitId !== undefined) updateData.unitId = data.unitId ? Number(data.unitId) : null;
    if (data.unitName !== undefined) updateData.unitName = data.unitName;
    if (data.riskLevel !== undefined) updateData.riskLevel = data.riskLevel;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.evidence !== undefined) updateData.evidence = data.evidence;
    if (data.rootCause !== undefined) updateData.rootCause = data.rootCause;
    if (data.correctiveAction !== undefined) updateData.correctiveAction = data.correctiveAction;
    if (data.preventiveAction !== undefined) updateData.preventiveAction = data.preventiveAction;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.assignedToName !== undefined) updateData.assignedToName = data.assignedToName;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.completionDate !== undefined) updateData.completionDate = data.completionDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.effectivenessVerified !== undefined) updateData.effectivenessVerified = !!data.effectivenessVerified;
    if (data.effectivenessNotes !== undefined) updateData.effectivenessNotes = data.effectivenessNotes;
    if (data.stageSignatures !== undefined) updateData.stageSignatures = data.stageSignatures;
    if (data.currentStageAssignee !== undefined) updateData.currentStageAssignee = data.currentStageAssignee;
    if (data.cancellationInfo !== undefined) updateData.cancellationInfo = data.cancellationInfo;
    if (data.activeReferralId !== undefined) updateData.activeReferralId = data.activeReferralId;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;

    if (Array.isArray(data.workflowHistory)) {
      updateData.workflowHistory = data.workflowHistory;
    } else {
      const history = Array.isArray(current.workflowHistory) ? [...(current.workflowHistory as any[])] : [];
      if (data.historyNote || (data.status && data.status !== current.status) || data.historyAction) {
        history.push({
          timestamp: new Date().toISOString(),
          actor: username,
          action: data.historyAction || data.status || current.status,
          notes: data.historyNote || `به‌روزرسانی اطلاعات توسط ${username}`,
          signature: data.stageSignature || null,
          assignee: data.stageAssignee || null,
          cancellation: data.cancellationInfo || null
        });
        updateData.workflowHistory = history;
      }
    }

    const updated = await withDbRetry(() =>
      db.update(schema.nonConformances)
        .set(updateData)
        .where(eq(schema.nonConformances.id, current.id))
        .returning()
    );

    await logAudit({
      action: 'UPDATE',
      entityType: 'NON_CONFORMANCE',
      entityId: current.trackingCode,
      details: { trackingCode: current.trackingCode, status: updateData.status || current.status, user: username },
    });

    return updated[0];
  } catch (error) {
    console.error('Failed to update non-conformance:', error);
    throw error;
  }
}

export async function deleteNonConformance(id: number | string, username: string = 'system') {
  try {
    const current = await getNonConformanceByIdOrTrackingCode(id);
    if (!current) return false;

    await withDbRetry(() =>
      db.delete(schema.nonConformances).where(eq(schema.nonConformances.id, current.id))
    );

    await logAudit({
      action: 'DELETE',
      entityType: 'NON_CONFORMANCE',
      entityId: current.trackingCode,
      details: { trackingCode: current.trackingCode, title: current.title, user: username },
    });

    return true;
  } catch (error) {
    console.error('Failed to delete non-conformance:', error);
    throw error;
  }
}

export async function getFullSyncSnapshot() {
  try {
    const [
      usersList,
      personnelList,
      medicalExamsList,
      permitsList,
      risksList,
      incidentsList,
      trirList,
      warningsList,
      fireEquipmentList,
      fiveSList,
      notificationsList,
      settingsMap,
      orgHierarchy,
      recentLogs,
      nonConformancesList,
    ] = await Promise.all([
      getAllUsersList().catch(() => []),
      getAllPersonnel().catch(() => []),
      getAllMedicalExams().catch(() => []),
      getAllWorkPermits().catch(() => []),
      getAllRiskAssessments().catch(() => []),
      getAllIncidents().catch(() => []),
      getTrirRecords().catch(() => []),
      getAllSafetyWarnings().catch(() => []),
      getAllFireEquipment().catch(() => []),
      getAllFiveSAudits().catch(() => []),
      getAllNotificationsList().catch(() => []),
      getAllSystemSettings().catch(() => ({})),
      getOrganizationHierarchy().catch(() => ({})),
      getAuditLogsList(100).catch(() => []),
      getAllNonConformances().catch(() => []),
    ]);

    return {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      data: {
        users: (usersList || []).map((u: any) => {
          if (u.profileData?.notificationSettings?.criticalHseCustomAudioUrl?.startsWith('data:')) {
            return {
              ...u,
              profileData: {
                ...u.profileData,
                notificationSettings: {
                  ...u.profileData.notificationSettings,
                  criticalHseCustomAudioUrl: '/api/v1/notifications/custom-siren',
                },
              },
            };
          }
          return u;
        }),
        personnel: personnelList,
        medicalExams: medicalExamsList,
        permits: permitsList,
        risks: risksList,
        incidents: incidentsList,
        trirRecords: trirList,
        warnings: warningsList,
        fireEquipment: fireEquipmentList,
        fiveSAudits: fiveSList,
        notifications: notificationsList,
        settings: settingsMap,
        orgHierarchy,
        auditLogs: recentLogs,
        nonConformances: nonConformancesList,
      },
    };
  } catch (error) {
    console.error('Failed to produce full sync snapshot:', error);
    throw new Error('Failed to generate full sync snapshot', { cause: error });
  }
}

export { runMigrations } from './migrate.ts';
