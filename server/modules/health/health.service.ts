import { desc, eq } from 'drizzle-orm';
import { db, schema, withTransaction } from '../../core/db.ts';
import {
  savePeriodicMedicalExam,
  getMedicalExamWithDetails,
  getPersonnelMultiYearMedicalHistory,
} from '../../db-services.ts';
import { workflowService } from '../workflow/workflow.service.ts';
import { auditService } from '../audit/audit.service.ts';
import { fileService } from '../files/file.service.ts';
import { ValidationError, NotFoundError, ForbiddenError } from '../../core/errors.ts';
import { UserContext } from '../../core/middleware/auth.ts';
import { logger } from '../../core/logger.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class HealthService {
  async getExamDetails(examId: number, user?: UserContext) {
    const details = await getMedicalExamWithDetails(examId);
    if (!details) {
      throw new NotFoundError(`پرونده معاینه پزشکی با شناسه ${examId} یافت نشد.`);
    }

    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, details);
    }

    const workflow = await workflowService.getInstanceByEntity('MEDICAL_EXAM', String(examId));
    const attachments = await fileService.getFilesForEntity('MEDICAL_EXAM', String(examId));

    return {
      ...details,
      workflow,
      attachments,
    };
  }

  async getPersonnelHistory(identifier: string, user?: UserContext) {
    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, identifier);
    }
    return await getPersonnelMultiYearMedicalHistory(identifier);
  }

  async saveExam(data: any, user?: UserContext) {
    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, data);
    }
    if (!data.personnelCode || !data.nationalCode || !data.examYear) {
      throw new ValidationError('کد پرسنلی، کد ملی و سال معاینه برای ثبت پرونده طب کار الزامی هستند.');
    }

    const doctorName = data.examiningDoctor || user?.name || 'پزشک طب کار';
    const result: any = await savePeriodicMedicalExam({
      ...data,
      examiningDoctor: doctorName,
    });

    const examId = result.id;

    // Connect to Workflow Engine for Doctor's electronic approval/signature
    const workflow = await workflowService.createInstance(
      {
        workflowKey: 'OCCUPATIONAL_HEALTH_EXAM_APPROVAL',
        entityType: 'MEDICAL_EXAM',
        entityId: String(examId),
        entityNumber: `MED-${data.examYear}-${data.personnelCode}`,
        title: `تایید نظریه نهایی پرونده سلامت سال ${data.examYear} - کد پرسنلی ${data.personnelCode}`,
        priority: data.fitnessStatus === 'UNFIT' ? 'HIGH' : 'NORMAL',
        requesterName: doctorName,
        requesterPersonnelCode: user?.personnelCode,
        metadata: {
          fitnessStatus: data.fitnessStatus,
          doctorVerdict: data.doctorVerdict,
          restrictions: data.restrictions,
        },
        steps: [
          {
            stepOrder: 1,
            stepName: 'بررسی پاراکلینیک و نتایج ادیومتری/اسپیرومتری',
            stepType: 'REVIEW',
            assignedRole: 'DOCTOR_OCCUPATIONAL',
            deadlineHours: 48,
          },
          {
            stepOrder: 2,
            stepName: 'تایید نهایی و امضای دیجیتال گواهی سلامت شغلی (Fit/Unfit)',
            stepType: 'APPROVE_SIGN',
            assignedRole: 'DOCTOR_OCCUPATIONAL',
            deadlineHours: 72,
          },
        ],
      },
      user
    );

    await auditService.log({
      action: 'SAVE_MEDICAL_EXAM',
      module: 'HEALTH',
      entityType: 'MEDICAL_EXAM',
      entityId: String(examId),
      personnelCode: data.personnelCode,
      newValue: {
        examId,
        year: data.examYear,
        fitnessStatus: data.fitnessStatus,
        verdict: data.doctorVerdict,
      },
    });

    return {
      ...result,
      workflowId: workflow.id,
    };
  }

  async getA4MedicalFitnessCard(examId: number) {
    const details: any = await this.getExamDetails(examId);
    const verification = details.workflow
      ? await workflowService.getA4PrintableVerification(details.workflow.id)
      : null;

    return {
      exam: details,
      personnel: details.personnel,
      vitals: {
        height: details.height,
        weight: details.weight,
        bmi: details.bmi,
        bloodPressure: `${details.systolicBp || '-'}/${details.diastolicBp || '-'}`,
        pulse: details.pulseRate,
      },
      fitnessStatus: details.fitnessStatus,
      doctorVerdict: details.doctorVerdict,
      restrictions: details.restrictions,
      diagnoses: details.diagnoses,
      audiometry: details.audiometry,
      spirometry: details.spirometry,
      verification,
      printMetadata: {
        paperSize: 'A4',
        orientation: 'portrait',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // --------------------------------------------------------------------------
  // Clinic & Dispensary (بهداری و مراجعات سرپایی)
  // --------------------------------------------------------------------------
  private async getRawClinicVisits(): Promise<any[]> {
    try {
      const records = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, 'hse_clinic_visits_v1'));
      if (records.length > 0 && Array.isArray(records[0].value)) {
        return records[0].value;
      }
      return [];
    } catch (err: any) {
      logger.error('Failed to get clinic visits from پایگاه داده:', err);
      return [];
    }
  }

  async getClinicVisits(user?: UserContext) {
    const raw = await this.getRawClinicVisits();
    if (!user) return raw;
    const ctx = await personnelAccessService.resolveAccessContext(user);
    return personnelAccessService.filterModuleRecords(ctx, raw);
  }

  async getPersonnelClinicHistory(identifier: string, user?: UserContext) {
    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, identifier);
    }
    const all = await this.getClinicVisits(user);
    const cleanId = String(identifier).trim().toLowerCase();
    return all.filter((v: any) => 
      String(v.personnelCode || '').trim().toLowerCase() === cleanId ||
      String(v.nationalCode || '').trim().toLowerCase() === cleanId ||
      String(v.personnelId || '').trim().toLowerCase() === cleanId
    );
  }

  async saveClinicVisit(data: any, user?: UserContext) {
    if (!data.personnelCode || !data.fullName || !data.chiefComplaint) {
      throw new ValidationError('کد پرسنلی، نام پرسنل و علت مراجعه به بهداری الزامی هستند.');
    }

    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, data);
    }

    const currentVisits = await this.getRawClinicVisits();
    const nowIso = new Date().toISOString();
    const visitId = data.id || `cln-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Auto-generate official visit number if missing
    let visitNumber = data.visitNumber;
    if (!visitNumber) {
      const datePart = (data.visitDate || '').replace(/\D/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      visitNumber = `CLN-${datePart}-${randomSeq}`;
    }

    const visitRecord = {
      ...data,
      id: visitId,
      visitNumber,
      updatedAt: nowIso,
      updatedBy: user?.username || user?.name || data.attendingMedic || 'کادر بهداری',
      createdAt: data.createdAt || nowIso,
      createdBy: data.createdBy || user?.username || user?.name || data.attendingMedic || 'کادر بهداری'
    };

    const existingIndex = currentVisits.findIndex((v: any) => v.id === visitId);
    let updatedList: any[];
    const isNew = existingIndex < 0;

    if (isNew) {
      updatedList = [visitRecord, ...currentVisits];
    } else {
      updatedList = [...currentVisits];
      updatedList[existingIndex] = visitRecord;
    }

    // Persist to پایگاه داده systemSettings
    const existingRow = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, 'hse_clinic_visits_v1'));
    if (existingRow.length > 0) {
      await db.update(schema.systemSettings)
        .set({ value: updatedList, updatedAt: new Date() })
        .where(eq(schema.systemSettings.key, 'hse_clinic_visits_v1'));
    } else {
      await db.insert(schema.systemSettings).values({
        key: 'hse_clinic_visits_v1',
        value: updatedList,
        description: 'سوابق و مراجعات بهداری، معاینات، داروها و اعزام‌های پزشکی',
        updatedAt: new Date()
      });
    }

    // Audit Logging
    await auditService.log({
      action: isNew ? 'CREATE_CLINIC_VISIT' : 'UPDATE_CLINIC_VISIT',
      module: 'HEALTH',
      entityType: 'CLINIC_VISIT',
      entityId: visitId,
      personnelCode: data.personnelCode,
      newValue: {
        visitNumber,
        fullName: data.fullName,
        visitType: data.visitType,
        triageLevel: data.triageLevel,
        diagnosis: data.primaryDiagnosis,
        outcome: data.outcome,
        isWorkRelated: data.isWorkRelated,
        ambulanceDispatched: data.ambulanceDispatch?.dispatched || false
      }
    });

    return visitRecord;
  }

  async deleteClinicVisit(id: string, user?: UserContext) {
    const currentVisits = await this.getRawClinicVisits();
    const target = currentVisits.find((v: any) => v.id === id);
    if (!target) {
      throw new NotFoundError(`مراجعه بهداری با شناسه ${id} یافت نشد.`);
    }

    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, target);
    }

    const filtered = currentVisits.filter((v: any) => v.id !== id);

    await db.update(schema.systemSettings)
      .set({ value: filtered, updatedAt: new Date() })
      .where(eq(schema.systemSettings.key, 'hse_clinic_visits_v1'));

    await auditService.log({
      action: 'DELETE_CLINIC_VISIT',
      module: 'HEALTH',
      entityType: 'CLINIC_VISIT',
      entityId: id,
      personnelCode: target.personnelCode,
      oldValue: target
    });

    return { id, success: true };
  }

  // ==========================================
  // Nutrition Specialist (کارشناس تغذیه) Endpoints
  // ==========================================
  private async getRawNutritionRecords(): Promise<any[]> {
    try {
      const records = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, 'hse_nutrition_records_v1'));
      if (records.length > 0 && Array.isArray(records[0].value)) {
        return records[0].value;
      }
      return [];
    } catch (err: any) {
      logger.error('Failed to get nutrition records from پایگاه داده:', err);
      return [];
    }
  }

  async getNutritionRecords(user?: UserContext) {
    const raw = await this.getRawNutritionRecords();
    if (!user) return raw;
    const ctx = await personnelAccessService.resolveAccessContext(user);
    return personnelAccessService.filterModuleRecords(ctx, raw);
  }

  async getPersonnelNutritionHistory(identifier: string, user?: UserContext) {
    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, identifier);
    }
    const all = await this.getNutritionRecords(user);
    const cleanId = String(identifier).trim().toLowerCase();
    return all.filter((r: any) => 
      String(r.personnelCode || '').trim().toLowerCase() === cleanId ||
      String(r.nationalCode || '').trim().toLowerCase() === cleanId ||
      String(r.personnelId || '').trim().toLowerCase() === cleanId
    );
  }

  async saveNutritionRecord(data: any, user?: UserContext) {
    if (!data.personnelCode || !data.fullName) {
      throw new ValidationError('کد پرسنلی و نام پرسنل الزامی هستند.');
    }

    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, data);
    }

    const currentRecords = await this.getRawNutritionRecords();
    const nowIso = new Date().toISOString();
    const recordId = data.id || `nut-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Auto-generate official record number if missing
    let recordNumber = data.recordNumber;
    if (!recordNumber) {
      const datePart = (data.visitDate || '').replace(/\D/g, '') || new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      recordNumber = `NUT-${datePart}-${randomSeq}`;
    }

    // Auto calculate BMI and WHR if height/weight/waist/hip are provided
    let calculatedBmi = data.bmi;
    let calculatedBmiCategory = data.bmiCategory;
    const heightCm = Number(data.height);
    const weightKg = Number(data.weight);
    if (heightCm > 0 && weightKg > 0) {
      const hM = heightCm / 100;
      calculatedBmi = Number((weightKg / (hM * hM)).toFixed(1));
      if (calculatedBmi < 18.5) calculatedBmiCategory = 'underweight';
      else if (calculatedBmi < 25) calculatedBmiCategory = 'normal';
      else if (calculatedBmi < 30) calculatedBmiCategory = 'overweight';
      else if (calculatedBmi < 35) calculatedBmiCategory = 'obese_1';
      else if (calculatedBmi < 40) calculatedBmiCategory = 'obese_2';
      else calculatedBmiCategory = 'obese_3';
    }

    let calculatedWhr = data.whr;
    const waist = Number(data.waistCircumference);
    const hip = Number(data.hipCircumference);
    if (waist > 0 && hip > 0) {
      calculatedWhr = Number((waist / hip).toFixed(2));
    }

    const nutritionRecord = {
      ...data,
      id: recordId,
      recordNumber,
      bmi: calculatedBmi !== undefined ? calculatedBmi : null,
      bmiCategory: calculatedBmiCategory || 'normal',
      whr: calculatedWhr !== undefined ? calculatedWhr : null,
      updatedAt: nowIso,
      updatedBy: user?.username || user?.name || data.consultantName || 'کارشناس تغذیه',
      createdAt: data.createdAt || nowIso,
      createdBy: data.createdBy || user?.username || user?.name || data.consultantName || 'کارشناس تغذیه'
    };

    const existingIndex = currentRecords.findIndex((r: any) => r.id === recordId);
    let updatedList: any[];
    const isNew = existingIndex < 0;

    if (isNew) {
      updatedList = [nutritionRecord, ...currentRecords];
    } else {
      updatedList = [...currentRecords];
      updatedList[existingIndex] = nutritionRecord;
    }

    // Authoritative persistence in پایگاه داده
    const existingRow = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, 'hse_nutrition_records_v1'));
    if (existingRow.length > 0) {
      await db.update(schema.systemSettings)
        .set({ value: updatedList, updatedAt: new Date() })
        .where(eq(schema.systemSettings.key, 'hse_nutrition_records_v1'));
    } else {
      await db.insert(schema.systemSettings).values({
        key: 'hse_nutrition_records_v1',
        value: updatedList,
        description: 'پرونده‌های پایش تغذیه، تن‌سنجی، عادات غذایی و مشاوره‌های کارشناس تغذیه',
        updatedAt: new Date()
      });
    }

    // Audit Logging
    await auditService.log({
      action: isNew ? 'CREATE_NUTRITION_RECORD' : 'UPDATE_NUTRITION_RECORD',
      module: 'HEALTH',
      entityType: 'NUTRITION_RECORD',
      entityId: recordId,
      personnelCode: data.personnelCode,
      newValue: {
        recordNumber,
        fullName: data.fullName,
        bmi: nutritionRecord.bmi,
        bmiCategory: nutritionRecord.bmiCategory,
        dietGoal: data.dietGoal,
        priority: data.priority,
        consultationType: data.consultationType
      }
    });

    return nutritionRecord;
  }

  async deleteNutritionRecord(id: string, user?: UserContext) {
    const currentRecords = await this.getRawNutritionRecords();
    const target = currentRecords.find((r: any) => r.id === id);
    if (!target) {
      throw new NotFoundError(`پرونده مشاوره تغذیه با شناسه ${id} یافت نشد.`);
    }

    if (user) {
      const ctx = await personnelAccessService.resolveAccessContext(user);
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, target);
    }

    const filtered = currentRecords.filter((r: any) => r.id !== id);

    await db.update(schema.systemSettings)
      .set({ value: filtered, updatedAt: new Date() })
      .where(eq(schema.systemSettings.key, 'hse_nutrition_records_v1'));

    await auditService.log({
      action: 'DELETE_NUTRITION_RECORD',
      module: 'HEALTH',
      entityType: 'NUTRITION_RECORD',
      entityId: id,
      personnelCode: target.personnelCode,
      oldValue: target
    });

    return { id, success: true };
  }
}

export const healthService = new HealthService();

