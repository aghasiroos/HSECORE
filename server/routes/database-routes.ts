import { Router, Request, Response } from 'express';
import * as dbServices from '../db-services.ts';
import { requireAuth, requireRole, requirePermission, isGlobalAdminUser } from '../core/middleware/auth.ts';
import { getClientIp } from '../core/ip.ts';
import { broadcastDataMutation, registerSSEClient } from '../core/socket.ts';
import {
  REFERRAL_STORAGE_KEY,
  filterReferralsForUser,
  loadReferrals,
  mergeAndDeduplicateReferrals,
  persistReferrals,
} from './referral.router.ts';
import {
  SENSITIVE_ADMIN_READ_KEYS,
  ADMIN_ONLY_SETTING_KEYS,
  checkIsAdminRequest,
  syncSettingsMemoryCache,
} from './settings.router.ts';
import {
  INTEGRATION_CONFIG_KEY,
  maskIntegrationConfigForClient,
  saveIntegrationConfigToDb,
} from '../services/webhookDispatcher.ts';
import { personnelAccessService } from '../core/personnelAccess.service.ts';
import {
  validatePermitSignaturesPayload,
  verifyPersonPtwAuthorization,
  PTW_UNAUTHORIZED_MESSAGE
} from '../services/ptwQualificationService.ts';

const router = Router();

// ============================================================================
// 1. ORGANIZATIONAL HIERARCHY
// ============================================================================
router.get('/organizations', requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await dbServices.getOrganizationHierarchy();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/organizations/seed', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const result = await dbServices.seedOrganizationHierarchy(req.body);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 2. PERSONNEL MANAGEMENT
// ============================================================================
router.get('/personnel', requireAuth, async (req: Request, res: Response) => {
  try {
    const filters = {
      companyId: req.query.companyId ? parseInt(req.query.companyId as string, 10) : undefined,
      unitId: req.query.unitId ? parseInt(req.query.unitId as string, 10) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
    };
    const allList = await dbServices.getAllPersonnel(filters);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = personnelAccessService.filterPersonnelList(ctx, allList);
    res.json({ success: true, data: list, count: list.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/personnel/:identifier', requireAuth, async (req: Request, res: Response) => {
  try {
    const p = await dbServices.getPersonnelByCodeOrNationalId(req.params.identifier);
    if (!p) {
      return res.status(404).json({ success: false, error: 'Personnel not found' });
    }
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!personnelAccessService.canAccessPersonnel(ctx, p)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز دسترسی به اطلاعات این شخص را ندارید (خارج از لیست اشخاص مرتبط).',
      });
    }
    res.json({ success: true, data: p });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/personnel', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), async (req: Request, res: Response) => {
  try {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!ctx.canAccessAll && req.body?.id) {
      if (!personnelAccessService.canAccessPersonnel(ctx, req.body)) {
        return res.status(403).json({
          success: false,
          error: 'شما مجوز ویرایش اطلاعات این شخص را ندارید (خارج از لیست اشخاص مرتبط).',
        });
      }
    }
    const record: any = await dbServices.upsertPersonnel(req.body);
    const statusNorm = String(record?.status || req.body?.status || 'ACTIVE').trim().toUpperCase();
    const extraStatusNorm = String(record?.extraData?.status || req.body?.extraData?.status || '').trim().toLowerCase();
    if (
      record?.id &&
      (statusNorm === 'INACTIVE' ||
        statusNorm === 'DISABLED' ||
        statusNorm === 'غیرفعال' ||
        extraStatusNorm === 'inactive' ||
        extraStatusNorm === 'غیرفعال')
    ) {
      await personnelAccessService.handlePersonnelLifecycleChange(record.id, 'DEACTIVATED', {
        uid: req.user?.uid,
        username: req.user?.username,
        fullName: req.user?.name,
      });
    }
    broadcastDataMutation('personnel', 'upsert', record);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/personnel/batch', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), async (req: Request, res: Response) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body.records;
    const result = await dbServices.batchUpsertPersonnel(records || []);
    broadcastDataMutation('personnel', 'batch', result);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/personnel/:identifier', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier;
    const deleteUser = req.query.deleteUser === 'true' || req.body?.deleteUser === true;
    const existing = await dbServices.getPersonnelByCodeOrNationalId(identifier);
    if (existing?.id) {
      await personnelAccessService.handlePersonnelLifecycleChange(existing.id, 'DELETED', {
        uid: req.user?.uid,
        username: req.user?.username,
        fullName: req.user?.name,
      });
    }
    const deleted = await dbServices.deletePersonnel(identifier, deleteUser);
    broadcastDataMutation('personnel', 'delete', { identifier, deleted });
    res.json({ success: true, deleted: true, record: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 3. OCCUPATIONAL HEALTH & MEDICAL EXAMS (Primary single-source-of-truth)
// ============================================================================
router.get('/medical-exams', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const allList = await dbServices.getAllMedicalExams(year);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = personnelAccessService.filterModuleRecords(ctx, allList);
    res.json({ success: true, data: list, count: list.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/medical-exams/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), async (req: Request, res: Response) => {
  try {
    const examId = parseInt(req.params.id, 10);
    const details = await dbServices.getMedicalExamWithDetails(examId);
    if (!details) {
      return res.status(404).json({ success: false, error: 'Exam record not found' });
    }
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!personnelAccessService.doesModuleRecordMatchContext(ctx, details)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز مشاهده پرونده سلامت این شخص را ندارید (خارج از لیست اشخاص مرتبط).',
      });
    }
    res.json({ success: true, data: details });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/medical-exams/history/:identifier', requireAuth, async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier;
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!personnelAccessService.canAccessPersonnel(ctx, identifier)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجاز به مشاهده پرونده سلامت این پرسنل نیستید (خارج از لیست اشخاص مرتبط).',
      });
    }
    const result = await dbServices.getPersonnelMultiYearMedicalHistory(identifier);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/medical-exams', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), async (req: Request, res: Response) => {
  try {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!personnelAccessService.doesModuleRecordMatchContext(ctx, req.body)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز ثبت یا ویرایش پرونده سلامت برای این شخص را ندارید (خارج از لیست اشخاص مرتبط).',
      });
    }
    const exam = await dbServices.savePeriodicMedicalExam(req.body);
    broadcastDataMutation('medicalExams', 'upsert', exam);
    res.json({ success: true, data: exam });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch import medical records (from Excel / Structured Parsers)
router.post('/medical-exams/batch-import', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'DOCTOR_OCCUPATIONAL'), async (req: Request, res: Response) => {
  try {
    const records = Array.isArray(req.body) ? req.body : req.body.records;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'Expected an array of records' });
    }
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const validRecords = records
      .filter((rec: any) => rec.personnelCode || rec.nationalCode)
      .filter((rec: any) => personnelAccessService.doesModuleRecordMatchContext(ctx, rec));
    const saved = [];
    const chunkSize = 5;
    for (let i = 0; i < validRecords.length; i += chunkSize) {
      const chunk = validRecords.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map((rec: any) => dbServices.savePeriodicMedicalExam(rec)));
      saved.push(...chunkResults);
    }
    broadcastDataMutation('medicalExams', 'batch', { count: saved.length });
    res.json({ success: true, count: saved.length, data: saved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 4. WORK PERMITS (PTW)
// ============================================================================
router.get('/work-permits', requireAuth, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const allPermits = await dbServices.getAllWorkPermits(status);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const permits = personnelAccessService.filterModuleRecords(ctx, allPermits);
    res.json({ success: true, data: permits, count: permits.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/work-permits', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (
      !ctx.canAccessAll &&
      (req.body?.requesterCode ||
        req.body?.acceptorCode ||
        req.body?.personnelCode ||
        req.body?.formData?.requesterCode ||
        req.body?.formData?.acceptorCode)
    ) {
      if (!personnelAccessService.doesModuleRecordMatchContext(ctx, req.body)) {
        return res.status(403).json({
          success: false,
          error: 'شما مجوز ثبت یا ویرایش مجوز کار برای این شخص را ندارید (خارج از لیست اشخاص مرتبط).',
        });
      }
    }

    // Server-side strict check: PTW Training Qualification and Issuance Authorization
    const sigValidation = await validatePermitSignaturesPayload(req.body);
    if (!sigValidation.allowed) {
      return res.status(403).json({
        success: false,
        error: sigValidation.errorMessage || PTW_UNAUTHORIZED_MESSAGE,
      });
    }

    const permit = await dbServices.upsertWorkPermit(req.body);
    broadcastDataMutation('permits', 'upsert', permit);
    res.json({ success: true, data: permit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/work-permits/:id/signatures', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const permitId = parseInt(req.params.id, 10);

    // Server-side real-time check for signature addition
    const signerIdentifier = req.body?.signerPersonnelCode || req.body?.signerName;
    const roleKey = req.body?.roleName || req.body?.roleKey;
    if (signerIdentifier) {
      const authCheck = await verifyPersonPtwAuthorization(signerIdentifier, roleKey);
      if (!authCheck.valid) {
        return res.status(403).json({
          success: false,
          error: authCheck.message || PTW_UNAUTHORIZED_MESSAGE,
        });
      }
    }

    const sig = await dbServices.addPermitSignature({ ...req.body, permitId });
    broadcastDataMutation('permits', 'sign', { permitId, sig });
    res.json({ success: true, data: sig });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/work-permits/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const result = await dbServices.deleteWorkPermit(req.params.id);
    broadcastDataMutation('permits', 'delete', { id: req.params.id });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 5. RISK ASSESSMENTS & INCIDENTS
// ============================================================================
router.get('/risk-assessments', requireAuth, async (req: Request, res: Response) => {
  try {
    const risks = await dbServices.getAllRiskAssessments();
    res.json({ success: true, data: risks, count: risks.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/risk-assessments', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const risk = await dbServices.createRiskAssessment(req.body);
    broadcastDataMutation('risks', 'create', risk);
    res.json({ success: true, data: risk });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/risk-assessments/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const result = await dbServices.deleteRiskAssessment(req.params.id);
    broadcastDataMutation('risks', 'delete', { id: req.params.id });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/incidents', requireAuth, async (req: Request, res: Response) => {
  try {
    const allList = await dbServices.getAllIncidents();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = personnelAccessService.filterModuleRecords(ctx, allList);
    res.json({ success: true, data: list, count: list.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/incidents', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!ctx.canAccessAll && (req.body?.personnelCode || req.body?.involvedPersonnelId || req.body?.personnelName)) {
      if (!personnelAccessService.doesModuleRecordMatchContext(ctx, req.body)) {
        return res.status(403).json({
          success: false,
          error: 'شما مجوز ثبت حادثه برای این شخص را ندارید (خارج از لیست اشخاص مرتبط).',
        });
      }
    }
    const inc = await dbServices.createIncident(req.body);
    broadcastDataMutation('incidents', 'create', inc);
    res.json({ success: true, data: inc });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/incidents/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const result = await dbServices.deleteIncident(req.params.id);
    broadcastDataMutation('incidents', 'delete', { id: req.params.id });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 6. TRIR RECORDS & METRICS
// ============================================================================
router.get('/trir', requireAuth, async (req: Request, res: Response) => {
  try {
    const records = await dbServices.getTrirRecords();
    res.json({ success: true, data: records, count: records.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trir', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    if (Array.isArray(req.body)) {
      const results = await dbServices.upsertTrirBatch(req.body);
      broadcastDataMutation('trirRecords', 'batch_upsert', { count: results.length });
      return res.json({ success: true, data: results, count: results.length });
    }
    const trir = await dbServices.upsertTrirRecord(req.body);
    broadcastDataMutation('trirRecords', 'upsert', trir);
    res.json({ success: true, data: trir });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trir/batch', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body.records || []);
    const results = await dbServices.upsertTrirBatch(list);
    broadcastDataMutation('trirRecords', 'batch_upsert', { count: results.length });
    res.json({ success: true, data: results, count: results.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/trir/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'SUPERVISOR'), async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? String(req.query.month) : undefined;
    const result = await dbServices.deleteTrirRecord(rawId, year, month);
    broadcastDataMutation('trirRecords', 'delete', { id: rawId, year, month });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/trir', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const result = await dbServices.deleteTrirRecord('clear_all');
    broadcastDataMutation('trirRecords', 'clear_all', result);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/trir/deduplicate', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const removedCount = await dbServices.deduplicateTrirRecordsInDb();
    broadcastDataMutation('trirRecords', 'deduplicate', { removedCount });
    res.json({ success: true, removedCount, message: `تعداد ${removedCount} سطر تکراری حذف گردید.` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 7. SAFETY WARNINGS
// ============================================================================
router.get('/warnings', requireAuth, async (req: Request, res: Response) => {
  try {
    const allList = await dbServices.getAllSafetyWarnings();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = personnelAccessService.filterModuleRecords(ctx, allList);
    res.json({ success: true, data: list, count: list.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/warnings', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!personnelAccessService.doesModuleRecordMatchContext(ctx, req.body)) {
      return res.status(403).json({
        success: false,
        error: 'شما مجوز ثبت اخطار/تشویق برای این شخص را ندارید (خارج از لیست اشخاص مرتبط).',
      });
    }
    const warning = await dbServices.createSafetyWarning(req.body);
    broadcastDataMutation('warnings', 'create', warning);
    res.json({ success: true, data: warning });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/warnings/batch', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const list = Array.isArray(req.body) ? req.body : (req.body.warnings || []);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const allowedList = personnelAccessService.filterModuleRecords(ctx, list);
    const saved = await dbServices.createSafetyWarningsBatch(allowedList);
    broadcastDataMutation('warnings', 'batch', { count: saved.length });
    res.json({ success: true, data: saved, count: saved.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/warnings/deduplicate', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const removedCount = await dbServices.deduplicateSafetyWarningsInDb();
    broadcastDataMutation('warnings', 'deduplicate', { removedCount });
    res.json({ success: true, removedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/warnings/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const success = await dbServices.deleteSafetyWarningById(req.params.id);
    broadcastDataMutation('warnings', 'delete', { id: req.params.id });
    res.json({ success, message: success ? 'Warning deleted' : 'Failed to delete warning' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/warnings', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const count = await dbServices.clearAllSafetyWarnings();
    broadcastDataMutation('warnings', 'clearAll', { count });
    res.json({ success: true, message: 'All safety warnings cleared', count });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 8. FIRE EQUIPMENT & 5S AUDITS
// ============================================================================
router.get('/fire-equipment', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await dbServices.getAllFireEquipment();
    res.json({ success: true, data: list, count: list.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/fire-equipment', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const item = await dbServices.upsertFireEquipment(req.body);
    broadcastDataMutation('fireEquipment', 'upsert', item);
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/fire-equipment/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    await dbServices.deleteFireEquipment(req.params.id);
    broadcastDataMutation('fireEquipment', 'delete', { id: req.params.id });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/five-s', requireAuth, async (req: Request, res: Response) => {
  try {
    const audits = await dbServices.getAllFiveSAudits();
    res.json({ success: true, data: audits, count: audits.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/five-s', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const audit = await dbServices.createFiveSAudit(req.body);
    broadcastDataMutation('fiveSAudits', 'create', audit);
    res.json({ success: true, data: audit });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 8.5 NON-CONFORMANCE MANAGEMENT (CAPA)
// ============================================================================
router.get('/non-conformances', requireAuth, async (req: Request, res: Response) => {
  try {
    const filters = {
      sourceModule: req.query.sourceModule ? String(req.query.sourceModule) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      riskLevel: req.query.riskLevel ? String(req.query.riskLevel) : undefined,
      assignedTo: req.query.assignedTo ? String(req.query.assignedTo) : undefined,
      unitId: req.query.unitId ? parseInt(req.query.unitId as string, 10) : undefined,
    };
    const allList = await dbServices.getAllNonConformances(filters);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = ctx.canAccessAll
      ? allList
      : allList.filter(
          (nc: any) =>
            personnelAccessService.doesModuleRecordMatchContext(ctx, nc) ||
            nc.createdBy === ctx.username ||
            nc.createdBy === ctx.fullName
        );
    res.json({ success: true, data: list, count: list.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/non-conformances/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const record = await dbServices.getNonConformanceByIdOrTrackingCode(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Non-conformance record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/non-conformances', requireAuth, async (req: Request, res: Response) => {
  try {
    const created = await dbServices.createNonConformance(req.body, req.user?.username || req.user?.name || 'system');
    broadcastDataMutation('nonConformances', 'create', created);
    broadcastDataMutation('non_conformances', 'create', created);
    res.json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/non-conformances/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const updated = await dbServices.updateNonConformance(req.params.id, req.body, req.user?.username || req.user?.name || 'system');
    broadcastDataMutation('nonConformances', 'update', updated);
    broadcastDataMutation('non_conformances', 'update', updated);
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/non-conformances/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const success = await dbServices.deleteNonConformance(req.params.id, req.user?.username || req.user?.name || 'system');
    if (success) {
      broadcastDataMutation('nonConformances', 'delete', { id: req.params.id });
      broadcastDataMutation('non_conformances', 'delete', { id: req.params.id });
    }
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/non-conformances/batch-delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No IDs provided for batch deletion' });
    }
    const username = req.user?.username || req.user?.name || 'system';
    let deletedCount = 0;
    for (const id of ids) {
      const ok = await dbServices.deleteNonConformance(id, username);
      if (ok) deletedCount++;
    }
    broadcastDataMutation('nonConformances', 'delete', { ids });
    broadcastDataMutation('non_conformances', 'delete', { ids });
    res.json({ success: true, count: deletedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 9. SYSTEM SETTINGS, USERS, NOTIFICATIONS, AUDIT & CENTRAL FULL SYNC
// ============================================================================
router.get('/sync/full', requireAuth, async (req: Request, res: Response) => {
  try {
    const isPrivileged = checkIsAdminRequest(req);
    const snapshot = await dbServices.getFullSyncSnapshot();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);

    if (snapshot && snapshot.data) {
      if (!isPrivileged) {
        // Redact high-privilege administrative domains from regular users
        snapshot.data.users = [];
        snapshot.data.auditLogs = [];
        if (snapshot.data.settings && typeof snapshot.data.settings === 'object') {
          for (const sensitiveKey of SENSITIVE_ADMIN_READ_KEYS) {
            delete snapshot.data.settings[sensitiveKey];
          }
        }
      }

      if (!ctx.canAccessAll) {
        if (Array.isArray(snapshot.data.personnel)) {
          snapshot.data.personnel = personnelAccessService.filterPersonnelList(ctx, snapshot.data.personnel);
        }
        if (Array.isArray(snapshot.data.medicalExams)) {
          snapshot.data.medicalExams = personnelAccessService.filterModuleRecords(ctx, snapshot.data.medicalExams);
        }
        if (Array.isArray(snapshot.data.warnings)) {
          snapshot.data.warnings = personnelAccessService.filterModuleRecords(ctx, snapshot.data.warnings);
        }
        if (Array.isArray(snapshot.data.incidents)) {
          snapshot.data.incidents = personnelAccessService.filterModuleRecords(ctx, snapshot.data.incidents);
        }
        if (Array.isArray(snapshot.data.permits)) {
          snapshot.data.permits = personnelAccessService.filterModuleRecords(ctx, snapshot.data.permits);
        }
        if (Array.isArray((snapshot.data as any).workPermits)) {
          (snapshot.data as any).workPermits = personnelAccessService.filterModuleRecords(ctx, (snapshot.data as any).workPermits);
        }
        if (snapshot.data.settings && typeof snapshot.data.settings === 'object') {
          const personnelLinkedSettingKeys = [
            'hse_clinic_visits_v1',
            'hse_nutrition_records_v1',
            'hse_ppe_issuances_v1',
            'hse_training_records_v1',
          ];
          for (const sKey of personnelLinkedSettingKeys) {
            if (Array.isArray(snapshot.data.settings[sKey])) {
              snapshot.data.settings[sKey] = personnelAccessService.filterModuleRecords(
                ctx,
                snapshot.data.settings[sKey]
              );
            }
          }
        }
      }

      if (snapshot.data.settings && snapshot.data.settings[INTEGRATION_CONFIG_KEY] !== undefined) {
        snapshot.data.settings[INTEGRATION_CONFIG_KEY] = maskIntegrationConfigForClient(
          snapshot.data.settings[INTEGRATION_CONFIG_KEY]
        );
      }
      if (snapshot.data.settings && snapshot.data.settings[REFERRAL_STORAGE_KEY] !== undefined) {
        const rawRefs = Array.isArray(snapshot.data.settings[REFERRAL_STORAGE_KEY])
          ? snapshot.data.settings[REFERRAL_STORAGE_KEY]
          : [];
        snapshot.data.settings[REFERRAL_STORAGE_KEY] = filterReferralsForUser(req.user, rawRefs);
      }
    }
    res.json({ success: true, ...snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint (public, unmetered, verifies real PostgreSQL connectivity)
router.get('/sync/health', async (req: Request, res: Response) => {
  try {
    const { checkDatabaseHealth } = await import('../core/db.ts');
    const dbHealth = await checkDatabaseHealth();
    const isHealthy = dbHealth.status === 'healthy';
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'connected' : 'disconnected',
      database: dbHealth.status,
      latencyMs: dbHealth.latencyMs,
      serverTime: new Date().toISOString(),
      protocolVersion: '2.0-central-sync',
    });
  } catch (err: any) {
    res.status(503).json({
      success: false,
      status: 'disconnected',
      database: 'unreachable',
      error: err?.message || 'Database unreachable',
      serverTime: new Date().toISOString(),
      protocolVersion: '2.0-central-sync',
    });
  }
});

// Realtime Server-Sent Events (SSE) stream for cross-client multi-user sync
router.get('/sync/events', requireAuth, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  registerSSEClient(res);
  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

router.post('/sync/push', requireAuth, async (req: Request, res: Response) => {
  try {
    const { entityType, data } = req.body;
    if (!entityType) {
      return res.status(400).json({ success: false, error: 'پارامتر entityType الزامی است.' });
    }

    const userRole = (req.user?.role || 'USER').toUpperCase();
    const isAdmin = userRole === 'ADMIN' || userRole === 'ADMINISTRATOR';
    const isHseManager = isAdmin || userRole === 'HSE_MANAGER';
    const isSafetyOfficer = isHseManager || userRole === 'SAFETY_OFFICER';
    const isDoctor = isAdmin || userRole === 'DOCTOR_OCCUPATIONAL';

    let result = null;
    switch (entityType) {
      case 'user':
        if (!isAdmin) {
          return res.status(403).json({ success: false, error: 'تنها مدیران ارشد سیستم مجاز به تغییر اطلاعات کاربران هستند.' });
        }
        result = await dbServices.upsertUserRecord(data);
        break;
      case 'setting':
        if (ADMIN_ONLY_SETTING_KEYS.includes(data?.key) && !checkIsAdminRequest(req)) {
          return res.status(403).json({ success: false, error: 'تنها مدیران ارشد سیستم مجاز به تغییر تنظیمات سامانه هستند.' });
        }
        if (data?.key === INTEGRATION_CONFIG_KEY) {
          const saved = await saveIntegrationConfigToDb(data.value || {});
          syncSettingsMemoryCache(data.key, saved.config);
          result = maskIntegrationConfigForClient(saved.config);
        } else {
          result = await dbServices.setSystemSetting(data.key, data.value, data.description);
          syncSettingsMemoryCache(data.key, data.value);
        }
        break;
      case 'personnel':
        if (!isHseManager) {
          return res.status(403).json({ success: false, error: 'شما مجوز ثبت یا ویرایش اطلاعات پرسنل را ندارید.' });
        }
        result = await dbServices.upsertPersonnel(data);
        break;
      case 'medicalExam':
        if (!isDoctor && !isHseManager) {
          return res.status(403).json({ success: false, error: 'شما مجوز ثبت یا ویرایش پرونده‌های پزشکی را ندارید.' });
        }
        result = await dbServices.savePeriodicMedicalExam(data);
        break;
      case 'workPermit':
        if (!isSafetyOfficer) {
          return res.status(403).json({ success: false, error: 'شما مجوز ثبت یا ویرایش مجوز کار (PTW) را ندارید.' });
        }
        result = await dbServices.upsertWorkPermit(data);
        break;
      case 'incident':
        result = await dbServices.createIncident(data);
        break;
      case 'trir':
        if (!isSafetyOfficer) {
          return res.status(403).json({ success: false, error: 'شما مجوز ثبت اطلاعات شاخص TRIR را ندارید.' });
        }
        result = await dbServices.upsertTrirRecord(data);
        break;
      case 'warning':
        if (!isSafetyOfficer) {
          return res.status(403).json({ success: false, error: 'شما مجوز ثبت اخطار ایمنی را ندارید.' });
        }
        result = await dbServices.createSafetyWarning(data);
        break;
      case 'fireEquipment':
        if (!isSafetyOfficer) {
          return res.status(403).json({ success: false, error: 'شما مجوز تغییر تجهیزات آتش‌نشانی را ندارید.' });
        }
        result = await dbServices.upsertFireEquipment(data);
        break;
      case 'fiveS':
        if (!isSafetyOfficer) {
          return res.status(403).json({ success: false, error: 'شما مجوز ثبت ممیزی 5S را ندارید.' });
        }
        result = await dbServices.createFiveSAudit(data);
        break;
      case 'notification':
        if (!isSafetyOfficer) {
          return res.status(403).json({ success: false, error: 'شما مجوز ارسال اعلان عمومی را ندارید.' });
        }
        result = await dbServices.saveNotificationRecord(data);
        break;
      default:
        return res.status(400).json({ success: false, error: `نوع داده ناشناخته است: ${entityType}` });
    }
    broadcastDataMutation(entityType, 'push', result);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Users
router.get('/users', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), async (req: Request, res: Response) => {
  try {
    const users = await dbServices.getAllUsersList();
    res.json({ success: true, data: users, count: users.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/users', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const user = await dbServices.upsertUserRecord(req.body, req.user);
    broadcastDataMutation('users', 'upsert', user);
    res.json({ success: true, data: user });
  } catch (error: any) {
    if (error.name === 'ValidationError' || error.statusCode === 422 || error.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message, code: 'VALIDATION_ERROR' });
    }
    if (error.name === 'ForbiddenError' || error.statusCode === 403) {
      return res.status(403).json({ success: false, error: error.message, code: 'FORBIDDEN' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/:uid/personnel-assignments', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), async (req: Request, res: Response) => {
  try {
    const ctx = await personnelAccessService.resolveAccessContext(req.params.uid);
    res.json({
      success: true,
      data: {
        userId: ctx.userId,
        uid: ctx.userUid,
        username: ctx.username,
        fullName: ctx.fullName,
        scope: ctx.scope,
        canAccessAll: ctx.canAccessAll,
        assignedPersonnelIds: ctx.assignedPersonnel.map((p) => p.id),
        assignedPersonnelCodes: ctx.assignedPersonnel.map((p) => p.personnelCode),
        assignedPersonnel: ctx.assignedPersonnel,
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.put('/users/:uid/personnel-assignments', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const scope = req.body?.scope || req.body?.personnelAccessScope || 'ASSIGNED';
    const personnelIds = Array.isArray(req.body?.personnelIds)
      ? req.body.personnelIds
      : Array.isArray(req.body?.assignedPersonnelIds)
      ? req.body.assignedPersonnelIds
      : [];

    const result = await personnelAccessService.updateUserPersonnelAssignments({
      targetUserIdentifier: req.params.uid,
      scope,
      personnelIds,
      actor: req.user
        ? {
            id: req.user.id,
            uid: req.user.uid,
            username: req.user.username,
            fullName: req.user.name,
            role: req.user.role,
            personnelNumber: req.user.personnelCode,
          }
        : undefined,
      ipAddress: ip,
      userAgent,
    });
    res.json({ success: true, data: result, message: 'اشخاص مرتبط کاربر با موفقیت ذخیره شد.' });
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ success: false, error: error.message });
  }
});

router.delete('/users/:uid', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    if (req.user?.uid === req.params.uid || String(req.user?.id) === String(req.params.uid) || req.user?.username === req.params.uid) {
      return res.status(400).json({ success: false, error: 'امکان حذف حساب کاربری جاری خودتان وجود ندارد.' });
    }
    const result = await dbServices.softDeleteUserRecord(req.params.uid, req.user);
    broadcastDataMutation('users', 'delete', { uid: req.params.uid });
    res.json({ success: true, message: 'User soft deleted', data: result });
  } catch (error: any) {
    if (error.name === 'NotFoundError' || error.message?.includes('یافت نشد')) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.name === 'ValidationError' || error.message?.includes('امکان حذف')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.name === 'ForbiddenError' || error.message?.includes('مجاز')) {
      return res.status(403).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Notifications
router.get('/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const notifs = await dbServices.getAllNotificationsList();
    res.json({ success: true, data: notifs, count: notifs.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/notifications', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    const notif = await dbServices.saveNotificationRecord(req.body);
    broadcastDataMutation('notifications', 'create', notif);
    res.json({ success: true, data: notif });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/notifications/:id', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    await dbServices.deleteNotificationRecord(req.params.id);
    broadcastDataMutation('notifications', 'delete', { id: req.params.id });
    res.json({ success: true, message: 'اعلان با موفقیت حذف شد.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/notifications', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER'), async (req: Request, res: Response) => {
  try {
    await dbServices.clearAllNotificationsRecords();
    broadcastDataMutation('notifications', 'clear_all', {});
    res.json({ success: true, message: 'تمام اعلان‌ها با موفقیت پاکسازی شدند.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Settings
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  try {
    const isAdmin = checkIsAdminRequest(req);
    const settings = await dbServices.getAllSystemSettings();
    if (settings && typeof settings === 'object') {
      if (!isAdmin) {
        for (const sensitiveKey of SENSITIVE_ADMIN_READ_KEYS) {
          delete settings[sensitiveKey];
        }
      }
      if (settings[INTEGRATION_CONFIG_KEY] !== undefined) {
        settings[INTEGRATION_CONFIG_KEY] = maskIntegrationConfigForClient(settings[INTEGRATION_CONFIG_KEY]);
      }
      if (settings[REFERRAL_STORAGE_KEY] !== undefined) {
        settings[REFERRAL_STORAGE_KEY] = filterReferralsForUser(
          req.user,
          Array.isArray(settings[REFERRAL_STORAGE_KEY]) ? settings[REFERRAL_STORAGE_KEY] : []
        );
      }
    }
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/settings/:key', requireAuth, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    if (SENSITIVE_ADMIN_READ_KEYS.includes(key) && !checkIsAdminRequest(req)) {
      return res.status(403).json({
        success: false,
        error: 'دسترسی غیرمجاز برای مشاهده تنظیمات امنیتی سامانه',
        message: 'دسترسی غیرمجاز برای مشاهده تنظیمات امنیتی سامانه',
      });
    }
    if (key === REFERRAL_STORAGE_KEY) {
      const all = await loadReferrals();
      const visible = filterReferralsForUser(req.user, all);
      return res.json({ success: true, key, value: visible, data: visible });
    }
    const val = await dbServices.getSystemSetting(key);
    syncSettingsMemoryCache(key, val);
    const outVal = key === INTEGRATION_CONFIG_KEY ? maskIntegrationConfigForClient(val) : val;
    res.json({ success: true, key, value: outVal, data: outVal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/settings/:key', requireAuth, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const isAdmin = checkIsAdminRequest(req);
    if (ADMIN_ONLY_SETTING_KEYS.includes(key) && !isAdmin) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز برای تغییر تنظیمات سیستمی' });
    }

    const incomingValue = req.body && typeof req.body === 'object' && 'value' in req.body ? req.body.value : req.body;

    if (key === INTEGRATION_CONFIG_KEY) {
      try {
        const { config } = await saveIntegrationConfigToDb(incomingValue || {});
        syncSettingsMemoryCache(key, config);
        return res.json({ success: true, key, value: maskIntegrationConfigForClient(config) });
      } catch (err: any) {
        return res.status(err?.statusCode || 400).json({
          success: false,
          code: err?.code || 'INVALID_WEBHOOK_CONFIG',
          error: err?.message || 'خطا در اعتبارسنجی تنظیمات وب‌هوک',
          message: err?.message || 'خطا در اعتبارسنجی تنظیمات وب‌هوک',
        });
      }
    }

    if (key === REFERRAL_STORAGE_KEY) {
      const existing = await loadReferrals();
      const merged = mergeAndDeduplicateReferrals(existing, incomingValue, req.user);
      await persistReferrals(merged);
      syncSettingsMemoryCache(key, merged);
      return res.json({ success: true, key });
    }
    await dbServices.setSystemSetting(key, incomingValue, req.body?.description);
    syncSettingsMemoryCache(key, incomingValue);
    broadcastDataMutation('settings', 'update', { key, value: incomingValue });
    res.json({ success: true, key });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/settings/:key', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const result = await dbServices.deleteSystemSetting(req.params.key);
    syncSettingsMemoryCache(req.params.key, null);
    broadcastDataMutation('settings', 'delete', { key: req.params.key });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Audit Logs
router.get('/audit-logs', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
    const logs = await dbServices.getAuditLogsList(limit);
    res.json({ success: true, data: logs, count: logs.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/audit-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const realIp = getClientIp(req);
    const payload = {
      ...req.body,
      ipAddress: realIp,
      userUid: req.user?.uid || req.body.userUid,
      userId: req.user?.id || req.body.userId,
    };
    await dbServices.logAudit(payload);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
