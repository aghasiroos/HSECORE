import { Router, Request, Response } from 'express';
import { eq, desc, asc } from 'drizzle-orm';
import { db, schema, withTransaction } from '../../core/db.ts';
import {
  requireAuth,
  checkUserHasPermission,
  isGlobalAdminUser,
} from '../../core/middleware/auth.ts';
import { auditService } from '../audit/audit.service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { logger } from '../../core/logger.ts';
import { liftingService, type WorkflowStageKey } from './lifting.service.ts';
import { runIndependentBenchmarkSuite } from '../../../shared/lifting-engine/validationSuite.ts';

const router = Router();

function canReadLifting(req: Request): boolean {
  if (!req.user) return false;
  if (isGlobalAdminUser(req.user)) return true;
  if (
    checkUserHasPermission(req.user, 'safety:read') ||
    checkUserHasPermission(req.user, 'safety:*') ||
    checkUserHasPermission(req.user, 'five_s:read')
  ) {
    return true;
  }
  const roleNorm = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '');
  return !['GUEST'].includes(roleNorm);
}

function canWriteLifting(req: Request): boolean {
  if (!req.user) return false;
  const roleNorm = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '');
  const roleRaw = String(req.user.role || '');
  if (
    ['VIEWER', 'READONLY', 'GUEST', 'OBSERVER', 'CONTRACTORVIEWER'].includes(roleNorm) ||
    /مشاهده‌گر|فقط مشاهده|مهمان/i.test(roleRaw)
  ) {
    return false;
  }
  if (isGlobalAdminUser(req.user)) return true;
  return (
    checkUserHasPermission(req.user, 'safety:create') ||
    checkUserHasPermission(req.user, 'safety:update') ||
    checkUserHasPermission(req.user, 'safety:*') ||
    ['HSEMANAGER', 'SAFETYOFFICER', 'SAFETYINSPECTOR', 'PROJECTMANAGER', 'MAINTENANCEMANAGER', 'EXECUTIVEMANAGER', 'ADMIN', 'ADMINISTRATOR'].includes(roleNorm) ||
    /ایمنی|مدیر|مهندس|کارشناس|بازرس/i.test(roleRaw)
  );
}

function canApproveLifting(req: Request): boolean {
  if (!req.user) return false;
  if (isGlobalAdminUser(req.user)) return true;
  const roleNorm = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '');
  const roleRaw = String(req.user.role || '');
  if (
    ['VIEWER', 'READONLY', 'GUEST', 'OBSERVER'].includes(roleNorm) ||
    /مشاهده‌گر|فقط مشاهده|مهمان/i.test(roleRaw)
  ) {
    return false;
  }
  return (
    checkUserHasPermission(req.user, 'safety:*') ||
    checkUserHasPermission(req.user, 'ptw:approve') ||
    ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'EXECUTIVEMANAGER', 'MAINTENANCEMANAGER', 'SAFETYOFFICER'].includes(roleNorm) ||
    /مدیر|رئیس|سرپرست ایمنی/i.test(roleRaw)
  );
}

function actorLabel(req: Request): string {
  return (req.user as any)?.fullName || req.user?.name || req.user?.username || 'کاربر سامانه';
}

async function logAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | number,
  oldValue?: any,
  newValue?: any,
  details?: any
) {
  try {
    await auditService.logFromRequest(req, {
      action,
      module: 'LIFTING_PLAN',
      entityType,
      entityId: String(entityId),
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      result: 'SUCCESS',
      details: details || { actionTitle: `${action} ${entityType} #${entityId}` },
    });
  } catch (err) {
    logger.warn('[Lifting] Audit log warning:', err);
  }
}

// ==========================================
// BOOTSTRAP & INTEGRATION CONTEXT
// ==========================================
router.get('/bootstrap', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) {
    return res.status(403).json({ success: false, error: 'دسترسی به ماژول Lifting Plan مجاز نیست.' });
  }
  try {
    const data = await liftingService.getBootstrapData();
    return res.json({
      success: true,
      data: {
        ...data,
        permissions: {
          canRead: true,
          canWrite: canWriteLifting(req),
          canApprove: canApproveLifting(req),
        },
      },
    });
  } catch (err: any) {
    logger.error('[Lifting] bootstrap error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'خطا در دریافت اطلاعات باربرداری' });
  }
});

router.get('/integration-context', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) {
    return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  }
  try {
    const ctx = await liftingService.getIntegrationContext();
    return res.json({ success: true, data: ctx });
  } catch (err: any) {
    logger.error('[Lifting] integration-context error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'خطا در بازیابی اطلاعات یکپارچه HSECORE' });
  }
});

// ==========================================
// STAGE GATES (G1-G6) & INDEPENDENT BENCHMARK SUITE
// ==========================================
router.get('/gates', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  try {
    const gates = await liftingService.getStageGates();
    return res.json({ success: true, data: gates });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در دریافت وضعیت دروازه‌ها' });
  }
});

router.post('/gates/:code/verify', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveLifting(req)) {
    return res.status(403).json({ success: false, error: 'فقط مدیر ایمنی یا مهندس مجاز اختیار تأیید دروازه‌های مهندسی را دارد.' });
  }
  const code = String(req.params.code || '').toUpperCase().trim();
  const decision = (req.body?.decision || 'VERIFIED') as 'VERIFIED' | 'FAILED' | 'PENDING';
  try {
    const updated = await liftingService.verifyStageGate(code, decision, actorLabel(req), req.body?.notes);
    await logAudit(req, 'GATE_VERIFY', 'LIFTING_STAGE_GATE', code, null, updated);
    broadcastDataMutation('lifting', 'verify_gate', updated);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'خطا در تأیید دروازه مرحله' });
  }
});

router.post('/engine/benchmark', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  try {
    const report = runIndependentBenchmarkSuite();
    return res.json({ success: true, data: report });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در اجرای بنچمارک موتور مهندسی' });
  }
});

// ==========================================
// STANDARDS CONFIGURATION (ASME)
// ==========================================
router.get('/standards', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  try {
    await liftingService.seedStandardsIfEmpty();
    const rows = await db.select().from(schema.liftingStandardsConfig).orderBy(asc(schema.liftingStandardsConfig.id));
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در بازیابی استانداردها' });
  }
});

router.put('/standards/:code', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveLifting(req)) {
    return res.status(403).json({ success: false, error: 'فقط مدیر ایمنی یا مهندس ارشد مجاز به تغییر تنظیمات استانداردها است.' });
  }
  const code = String(req.params.code || '').trim();
  try {
    const [existing] = await db
      .select()
      .from(schema.liftingStandardsConfig)
      .where(eq(schema.liftingStandardsConfig.standardCode, code));
    if (!existing) {
      return res.status(404).json({ success: false, error: 'استاندارد موردنظر یافت نشد.' });
    }
    const body = req.body || {};
    const [updated] = await db
      .update(schema.liftingStandardsConfig)
      .set({
        edition: body.edition !== undefined ? String(body.edition).trim() : existing.edition,
        activeClauses: body.activeClauses ?? existing.activeClauses,
        engineeringFactors: body.engineeringFactors ?? existing.engineeringFactors,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
        updatedBy: actorLabel(req),
        updatedAt: new Date(),
      })
      .where(eq(schema.liftingStandardsConfig.id, existing.id))
      .returning();

    await logAudit(req, 'UPDATE', 'STANDARD_CONFIG', code, existing, updated);
    broadcastDataMutation('lifting', 'update_standard', updated);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در به‌روزرسانی استاندارد' });
  }
});

// ==========================================
// CRANES & LOAD CHARTS CRUD
// ==========================================
router.post('/cranes', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) {
    return res.status(403).json({ success: false, error: 'مجوز ثبت جرثقیل را ندارید.' });
  }
  try {
    const b = req.body || {};
    const craneCode = String(b.craneCode || '').trim() || `CRN-${Date.now().toString().slice(-5)}`;
    const name = String(b.name || '').trim();
    const model = String(b.model || '').trim();
    const maxCap = Number(b.maxRatedCapacityTon || 0);
    if (!name || !model || maxCap <= 0) {
      return res.status(400).json({ success: false, error: 'نام، مدل و ظرفیت اسمی جرثقیل الزامی هستند.' });
    }

    const created = await withTransaction(async (tx) => {
      const [cr] = await tx
        .insert(schema.liftingCranes)
        .values({
          craneCode,
          name,
          craneType: b.craneType || 'MOBILE_ALL_TERRAIN',
          manufacturer: b.manufacturer || null,
          model,
          serialNumber: b.serialNumber || null,
          plateNumber: b.plateNumber || null,
          maxRatedCapacityTon: maxCap,
          minBoomLengthM: Number(b.minBoomLengthM || 10),
          maxBoomLengthM: Number(b.maxBoomLengthM || 50),
          maxRadiusM: Number(b.maxRadiusM || 40),
          counterweightTon: Number(b.counterweightTon || 0),
          outriggerSpreadM: Number(b.outriggerSpreadM || 7.5),
          deadWeightTon: b.deadWeightTon !== undefined && b.deadWeightTon !== '' ? Number(b.deadWeightTon) : null,
          defaultOutriggerPadAreaM2: b.defaultOutriggerPadAreaM2 !== undefined && b.defaultOutriggerPadAreaM2 !== '' ? Number(b.defaultOutriggerPadAreaM2) : null,
          hookBlockWeightTon: Number(b.hookBlockWeightTon ?? 0.6),
          ownershipType: b.ownershipType || 'COMPANY',
          contractorName: b.contractorName || null,
          unitId: b.unitId ? Number(b.unitId) : null,
          unitName: b.unitName || null,
          certificateNumber: b.certificateNumber || null,
          certificateDocId: b.certificateDocId || null,
          certificateIssueDate: b.certificateIssueDate || null,
          certificateExpiryDate: b.certificateExpiryDate || null,
          lastInspectionDate: b.lastInspectionDate || null,
          nextInspectionDate: b.nextInspectionDate || null,
          status: b.status || 'ACTIVE',
          notes: b.notes || null,
          createdBy: actorLabel(req),
          updatedBy: actorLabel(req),
        })
        .returning();

      if (Array.isArray(b.loadChartRows) && b.loadChartRows.length > 0) {
        for (const row of b.loadChartRows) {
          if (Number(row.boomLengthM) > 0 && Number(row.radiusM) > 0 && Number(row.ratedCapacityTon) > 0) {
            await tx.insert(schema.liftingCraneLoadCharts).values({
              craneId: cr.id,
              chartName: String(row.chartName || 'Main Boom'),
              outriggerConfig: String(row.outriggerConfig || '100_OUTRIGGERS'),
              counterweightTon: Number(row.counterweightTon ?? cr.counterweightTon ?? 0),
              boomLengthM: Number(row.boomLengthM),
              radiusM: Number(row.radiusM),
              ratedCapacityTon: Number(row.ratedCapacityTon),
              maxTipHeightM: row.maxTipHeightM ? Number(row.maxTipHeightM) : null,
              boomAngleDeg: row.boomAngleDeg ? Number(row.boomAngleDeg) : null,
              fallsOfRope: row.fallsOfRope ? Number(row.fallsOfRope) : 6,
            });
          }
        }
      }
      return cr;
    });

    await logAudit(req, 'CREATE', 'LIFTING_CRANE', created.id, null, created);
    broadcastDataMutation('lifting', 'create_crane', created);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    const pgCode = err?.code || err?.cause?.code;
    return res.status(pgCode === '23505' ? 409 : 500).json({
      success: false,
      error: pgCode === '23505' ? 'کد جرثقیل تکراری است.' : err?.message || 'خطا در ثبت جرثقیل',
    });
  }
});

router.put('/cranes/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [existing] = await db.select().from(schema.liftingCranes).where(eq(schema.liftingCranes.id, id));
    if (!existing || existing.isDeleted) return res.status(404).json({ success: false, error: 'جرثقیل یافت نشد.' });
    const b = req.body || {};
    const [updated] = await db
      .update(schema.liftingCranes)
      .set({
        name: b.name !== undefined ? String(b.name).trim() : existing.name,
        craneType: b.craneType ?? existing.craneType,
        manufacturer: b.manufacturer !== undefined ? b.manufacturer : existing.manufacturer,
        model: b.model !== undefined ? String(b.model).trim() : existing.model,
        serialNumber: b.serialNumber !== undefined ? b.serialNumber : existing.serialNumber,
        plateNumber: b.plateNumber !== undefined ? b.plateNumber : existing.plateNumber,
        maxRatedCapacityTon: b.maxRatedCapacityTon !== undefined ? Number(b.maxRatedCapacityTon) : existing.maxRatedCapacityTon,
        minBoomLengthM: b.minBoomLengthM !== undefined ? Number(b.minBoomLengthM) : existing.minBoomLengthM,
        maxBoomLengthM: b.maxBoomLengthM !== undefined ? Number(b.maxBoomLengthM) : existing.maxBoomLengthM,
        maxRadiusM: b.maxRadiusM !== undefined ? Number(b.maxRadiusM) : existing.maxRadiusM,
        counterweightTon: b.counterweightTon !== undefined ? Number(b.counterweightTon) : existing.counterweightTon,
        outriggerSpreadM: b.outriggerSpreadM !== undefined ? Number(b.outriggerSpreadM) : existing.outriggerSpreadM,
        deadWeightTon: b.deadWeightTon !== undefined ? (b.deadWeightTon ? Number(b.deadWeightTon) : null) : existing.deadWeightTon,
        defaultOutriggerPadAreaM2: b.defaultOutriggerPadAreaM2 !== undefined ? (b.defaultOutriggerPadAreaM2 ? Number(b.defaultOutriggerPadAreaM2) : null) : existing.defaultOutriggerPadAreaM2,
        hookBlockWeightTon: b.hookBlockWeightTon !== undefined ? Number(b.hookBlockWeightTon) : existing.hookBlockWeightTon,
        ownershipType: b.ownershipType ?? existing.ownershipType,
        contractorName: b.contractorName !== undefined ? b.contractorName : existing.contractorName,
        unitId: b.unitId !== undefined ? (b.unitId ? Number(b.unitId) : null) : existing.unitId,
        unitName: b.unitName !== undefined ? b.unitName : existing.unitName,
        certificateNumber: b.certificateNumber !== undefined ? b.certificateNumber : existing.certificateNumber,
        certificateDocId: b.certificateDocId !== undefined ? b.certificateDocId : existing.certificateDocId,
        certificateIssueDate: b.certificateIssueDate !== undefined ? b.certificateIssueDate : existing.certificateIssueDate,
        certificateExpiryDate: b.certificateExpiryDate !== undefined ? b.certificateExpiryDate : existing.certificateExpiryDate,
        lastInspectionDate: b.lastInspectionDate !== undefined ? b.lastInspectionDate : existing.lastInspectionDate,
        nextInspectionDate: b.nextInspectionDate !== undefined ? b.nextInspectionDate : existing.nextInspectionDate,
        status: b.status ?? existing.status,
        notes: b.notes !== undefined ? b.notes : existing.notes,
        updatedBy: actorLabel(req),
        updatedAt: new Date(),
      })
      .where(eq(schema.liftingCranes.id, id))
      .returning();

    await logAudit(req, 'UPDATE', 'LIFTING_CRANE', id, existing, updated);
    broadcastDataMutation('lifting', 'update_crane', updated);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در ویرایش جرثقیل' });
  }
});

router.put('/cranes/:id/load-chart', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const craneId = Number(req.params.id);
  try {
    const [crane] = await db.select().from(schema.liftingCranes).where(eq(schema.liftingCranes.id, craneId));
    if (!crane || crane.isDeleted) return res.status(404).json({ success: false, error: 'جرثقیل یافت نشد.' });

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const validRows = rows.filter(
      (r: any) => Number(r.boomLengthM) > 0 && Number(r.radiusM) > 0 && Number(r.ratedCapacityTon) > 0
    );

    const inserted = await withTransaction(async (tx) => {
      await tx.delete(schema.liftingCraneLoadCharts).where(eq(schema.liftingCraneLoadCharts.craneId, craneId));
      const out = [];
      for (const r of validRows) {
        const [ins] = await tx
          .insert(schema.liftingCraneLoadCharts)
          .values({
            craneId,
            chartName: String(r.chartName || 'Main Boom'),
            outriggerConfig: String(r.outriggerConfig || '100_OUTRIGGERS'),
            counterweightTon: Number(r.counterweightTon ?? crane.counterweightTon ?? 0),
            boomLengthM: Number(r.boomLengthM),
            radiusM: Number(r.radiusM),
            ratedCapacityTon: Number(r.ratedCapacityTon),
            maxTipHeightM: r.maxTipHeightM ? Number(r.maxTipHeightM) : null,
            boomAngleDeg: r.boomAngleDeg ? Number(r.boomAngleDeg) : null,
            fallsOfRope: r.fallsOfRope ? Number(r.fallsOfRope) : 6,
          })
          .returning();
        out.push(ins);
      }
      return out;
    });

    await logAudit(req, 'UPDATE', 'CRANE_LOAD_CHART', craneId, null, { rowsCount: inserted.length });
    broadcastDataMutation('lifting', 'update_load_chart', { craneId, rowsCount: inserted.length });
    return res.json({ success: true, data: inserted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در ذخیره جدول بار جرثقیل' });
  }
});

router.delete('/cranes/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveLifting(req)) return res.status(403).json({ success: false, error: 'مجوز حذف جرثقیل را ندارید.' });
  const id = Number(req.params.id);
  try {
    const [existing] = await db.select().from(schema.liftingCranes).where(eq(schema.liftingCranes.id, id));
    if (!existing || existing.isDeleted) return res.status(404).json({ success: false, error: 'جرثقیل یافت نشد.' });

    // Dependency guard: block if active approved/executing plan uses this crane
    const activePlans = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.isDeleted, false));
    const lockedPlan = activePlans.find(
      (p) =>
        ['APPROVED', 'ACTIVE_EXECUTION'].includes(String(p.status).toUpperCase()) &&
        (Number(p.craneSetup?.primaryCraneId) === id || Number(p.craneSetup?.tailCraneId) === id)
    );
    if (lockedPlan) {
      return res.status(409).json({
        success: false,
        error: `جرثقیل به طرح فعال «${lockedPlan.planCode}» متصل است و قابل حذف نیست.`,
      });
    }

    await db
      .update(schema.liftingCranes)
      .set({ isDeleted: true, updatedBy: actorLabel(req), updatedAt: new Date() })
      .where(eq(schema.liftingCranes.id, id));
    await logAudit(req, 'SOFT_DELETE', 'LIFTING_CRANE', id, existing, { isDeleted: true });
    broadcastDataMutation('lifting', 'delete_crane', { id });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در حذف جرثقیل' });
  }
});

// ==========================================
// RIGGING EQUIPMENT BANK CRUD
// ==========================================
router.post('/rigging', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  try {
    const b = req.body || {};
    const assetCode = String(b.assetCode || '').trim() || `RIG-${Date.now().toString().slice(-5)}`;
    const name = String(b.name || '').trim();
    const wllTon = Number(b.wllTon || 0);
    if (!name || wllTon <= 0) {
      return res.status(400).json({ success: false, error: 'نام تجهیز و ظرفیت مجاز کار (WLL) الزامی هستند.' });
    }
    const [created] = await db
      .insert(schema.liftingRiggingEquipment)
      .values({
        assetCode,
        name,
        category: b.category || 'WIRE_ROPE_SLING',
        standardRef: b.standardRef || 'ASME B30.9',
        wllTon,
        safetyFactor: Number(b.safetyFactor || 5),
        selfWeightKg: Number(b.selfWeightKg || 12),
        lengthM: b.lengthM !== undefined ? Number(b.lengthM) : null,
        diameterMm: b.diameterMm !== undefined ? Number(b.diameterMm) : null,
        minSlingAngleDeg: b.minSlingAngleDeg !== undefined ? Number(b.minSlingAngleDeg) : 45,
        serialNumber: b.serialNumber || null,
        manufacturer: b.manufacturer || null,
        ownerType: b.ownerType || 'COMPANY',
        contractorName: b.contractorName || null,
        unitName: b.unitName || null,
        storageLocation: b.storageLocation || null,
        certificateNumber: b.certificateNumber || null,
        certificateDocId: b.certificateDocId || null,
        certificateExpiryDate: b.certificateExpiryDate || null,
        lastInspectionDate: b.lastInspectionDate || null,
        nextInspectionDate: b.nextInspectionDate || null,
        safetyLatchOk: b.safetyLatchOk !== undefined ? Boolean(b.safetyLatchOk) : true,
        conditionStatus: b.conditionStatus || 'SERVICEABLE',
        notes: b.notes || null,
        createdBy: actorLabel(req),
        updatedBy: actorLabel(req),
      })
      .returning();

    await logAudit(req, 'CREATE', 'RIGGING_EQUIPMENT', created.id, null, created);
    broadcastDataMutation('lifting', 'create_rigging', created);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    const pgCode = err?.code || err?.cause?.code;
    return res.status(pgCode === '23505' ? 409 : 500).json({
      success: false,
      error: pgCode === '23505' ? 'کد تجهیز Rigging تکراری است.' : err?.message || 'خطا در ثبت تجهیز Rigging',
    });
  }
});

router.put('/rigging/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [existing] = await db.select().from(schema.liftingRiggingEquipment).where(eq(schema.liftingRiggingEquipment.id, id));
    if (!existing || existing.isDeleted) return res.status(404).json({ success: false, error: 'تجهیز یافت نشد.' });
    const b = req.body || {};
    const [updated] = await db
      .update(schema.liftingRiggingEquipment)
      .set({
        name: b.name !== undefined ? String(b.name).trim() : existing.name,
        category: b.category ?? existing.category,
        standardRef: b.standardRef ?? existing.standardRef,
        wllTon: b.wllTon !== undefined ? Number(b.wllTon) : existing.wllTon,
        safetyFactor: b.safetyFactor !== undefined ? Number(b.safetyFactor) : existing.safetyFactor,
        selfWeightKg: b.selfWeightKg !== undefined ? Number(b.selfWeightKg) : existing.selfWeightKg,
        lengthM: b.lengthM !== undefined ? (b.lengthM ? Number(b.lengthM) : null) : existing.lengthM,
        diameterMm: b.diameterMm !== undefined ? (b.diameterMm ? Number(b.diameterMm) : null) : existing.diameterMm,
        serialNumber: b.serialNumber !== undefined ? b.serialNumber : existing.serialNumber,
        manufacturer: b.manufacturer !== undefined ? b.manufacturer : existing.manufacturer,
        ownerType: b.ownerType ?? existing.ownerType,
        contractorName: b.contractorName !== undefined ? b.contractorName : existing.contractorName,
        unitName: b.unitName !== undefined ? b.unitName : existing.unitName,
        storageLocation: b.storageLocation !== undefined ? b.storageLocation : existing.storageLocation,
        certificateNumber: b.certificateNumber !== undefined ? b.certificateNumber : existing.certificateNumber,
        certificateDocId: b.certificateDocId !== undefined ? b.certificateDocId : existing.certificateDocId,
        certificateExpiryDate: b.certificateExpiryDate !== undefined ? b.certificateExpiryDate : existing.certificateExpiryDate,
        lastInspectionDate: b.lastInspectionDate !== undefined ? b.lastInspectionDate : existing.lastInspectionDate,
        nextInspectionDate: b.nextInspectionDate !== undefined ? b.nextInspectionDate : existing.nextInspectionDate,
        safetyLatchOk: b.safetyLatchOk !== undefined ? Boolean(b.safetyLatchOk) : existing.safetyLatchOk,
        conditionStatus: b.conditionStatus ?? existing.conditionStatus,
        notes: b.notes !== undefined ? b.notes : existing.notes,
        updatedBy: actorLabel(req),
        updatedAt: new Date(),
      })
      .where(eq(schema.liftingRiggingEquipment.id, id))
      .returning();

    await logAudit(req, 'UPDATE', 'RIGGING_EQUIPMENT', id, existing, updated);
    broadcastDataMutation('lifting', 'update_rigging', updated);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در ویرایش تجهیز' });
  }
});

router.delete('/rigging/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [existing] = await db.select().from(schema.liftingRiggingEquipment).where(eq(schema.liftingRiggingEquipment.id, id));
    if (!existing || existing.isDeleted) return res.status(404).json({ success: false, error: 'تجهیز یافت نشد.' });
    await db
      .update(schema.liftingRiggingEquipment)
      .set({ isDeleted: true, updatedBy: actorLabel(req), updatedAt: new Date() })
      .where(eq(schema.liftingRiggingEquipment.id, id));
    await logAudit(req, 'SOFT_DELETE', 'RIGGING_EQUIPMENT', id, existing, { isDeleted: true });
    broadcastDataMutation('lifting', 'delete_rigging', { id });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در حذف تجهیز' });
  }
});

// ==========================================
// LIFTING PLANS CRUD + REVISIONS + CALCULATIONS
// ==========================================
router.post('/plans', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'مجوز ثبت طرح باربرداری را ندارید.' });
  try {
    const b = req.body || {};
    if (!b.title || !b.loadName || !b.areaLocation || Number(b.netLoadWeightTon || 0) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'عنوان طرح، نام بار، محل عملیات و وزن خالص بار (بزرگتر از صفر) الزامی هستند.',
      });
    }
    const created = await liftingService.createPlan(b, actorLabel(req));
    await logAudit(req, 'CREATE', 'LIFTING_PLAN', created.id, null, { planCode: created.planCode, title: created.title });
    broadcastDataMutation('lifting', 'create_plan', created);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    const pgCode = err?.code || err?.cause?.code;
    return res.status(pgCode === '23505' ? 409 : 500).json({
      success: false,
      error: pgCode === '23505' ? 'کد طرح باربرداری تکراری است.' : err?.message || 'خطا در ثبت طرح باربرداری',
    });
  }
});

router.put('/plans/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'مجوز ویرایش طرح را ندارید.' });
  const id = Number(req.params.id);
  try {
    const { plan, revisionBumped } = await liftingService.updatePlan(id, req.body || {}, actorLabel(req));
    await logAudit(req, 'UPDATE', 'LIFTING_PLAN', id, null, {
      planCode: plan.planCode,
      revisionNumber: plan.revisionNumber,
      revisionBumped,
    });
    broadcastDataMutation('lifting', 'update_plan', plan);
    return res.json({ success: true, data: plan, revisionBumped });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در ویرایش طرح باربرداری' });
  }
});

router.delete('/plans/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req) && !canApproveLifting(req)) {
    return res.status(403).json({ success: false, error: 'مجوز حذف طرح باربرداری را ندارید.' });
  }
  const id = Number(req.params.id);
  try {
    const [existing] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, id));
    if (!existing || existing.isDeleted) return res.status(404).json({ success: false, error: 'طرح یافت نشد.' });
    if (['APPROVED', 'ACTIVE_EXECUTION'].includes(String(existing.status).toUpperCase())) {
      return res.status(409).json({
        success: false,
        error: 'طرح تأییدشده یا در حال اجرا قابل حذف نیست؛ برای ابطال از گردش کار رد یا اختتام استفاده کنید.',
      });
    }
    await db
      .update(schema.liftingPlans)
      .set({ isDeleted: true, updatedBy: actorLabel(req), updatedAt: new Date() })
      .where(eq(schema.liftingPlans.id, id));
    await logAudit(req, 'SOFT_DELETE', 'LIFTING_PLAN', id, existing, { isDeleted: true });
    broadcastDataMutation('lifting', 'delete_plan', { id });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در حذف طرح' });
  }
});

router.get('/plans/:id/revisions', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [revs, calcs] = await Promise.all([
      db
        .select()
        .from(schema.liftingPlanRevisions)
        .where(eq(schema.liftingPlanRevisions.planId, id))
        .orderBy(desc(schema.liftingPlanRevisions.revisionNumber)),
      db
        .select()
        .from(schema.liftingCalculations)
        .where(eq(schema.liftingCalculations.planId, id))
        .orderBy(desc(schema.liftingCalculations.createdAt)),
    ]);
    return res.json({ success: true, data: { revisions: revs, calculations: calcs } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در دریافت تاریخچه نسخه‌ها' });
  }
});

// ==========================================
// SERVER-SIDE AUTHORITATIVE CALCULATIONS
// ==========================================
router.post('/calculate', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  try {
    const saveId = req.body?.saveToPlanId ? Number(req.body.saveToPlanId) : undefined;
    const result = await liftingService.evaluatePlanByIdOrPayload(req.body || {}, saveId, actorLabel(req));
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در اجرای محاسبات مهندسی' });
  }
});

router.post('/plans/:id/calculate', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [plan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, id));
    if (!plan || plan.isDeleted) return res.status(404).json({ success: false, error: 'طرح یافت نشد.' });
    const mergedPayload = { ...plan, ...(req.body || {}) };
    const result = await liftingService.evaluatePlanByIdOrPayload(mergedPayload, id, actorLabel(req));
    const [fresh] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, id));
    broadcastDataMutation('lifting', 'calculate_plan', { id, overallStatus: result.overallStatus });
    return res.json({ success: true, data: { calculation: result, plan: fresh } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در محاسبه طرح' });
  }
});

router.put('/plans/:id/governance', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const updated = await liftingService.updateGovernanceChecklists(id, req.body || {}, actorLabel(req));
    await logAudit(req, 'GOVERNANCE_UPDATE', 'LIFTING_PLAN', id, null, {
      hasEng: Boolean(req.body?.engineeringChecklist),
      hasHse: Boolean(req.body?.hseChecklist),
      hasField: Boolean(req.body?.fieldConditionsVerification),
    });
    broadcastDataMutation('lifting', 'update_governance', updated);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'خطا در ثبت چک‌لیست‌های کنترلی طرح' });
  }
});

// ==========================================
// 9-STAGE WORKFLOW GATEKEEPER
// ==========================================
router.post('/plans/:id/workflow/advance', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const { stageKey, decision, comments, checklistState, signerPersonnelCode } = req.body || {};
    if (!stageKey || !['APPROVED', 'REJECTED', 'RETURNED'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'مرحله یا تصمیم گردش کار نامعتبر است.' });
    }
    const result = await liftingService.advanceWorkflowStage(
      id,
      stageKey as WorkflowStageKey,
      decision,
      {
        name: actorLabel(req),
        role: req.user?.role || 'کارشناس',
        personnelCode: signerPersonnelCode,
        canApprove: canApproveLifting(req),
      },
      comments,
      checklistState
    );

    if (result.blocked) {
      return res.status(422).json({
        success: false,
        error: result.blockers[0] || 'شرایط الزامی این مرحله احراز نشده است.',
        blockers: result.blockers,
        data: result.plan,
      });
    }

    await logAudit(req, decision === 'APPROVED' ? 'APPROVE' : decision, 'LIFTING_WORKFLOW', id, null, {
      stageKey,
      decision,
      newStatus: result.plan.status,
      newStage: result.plan.workflowStage,
    });
    broadcastDataMutation('lifting', 'workflow_advance', result.plan);
    return res.json({ success: true, data: result.plan });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err?.message || 'خطا در پیشرفت گردش کار' });
  }
});

// ==========================================
// CROSS-MODULE LINKING (JSA, PTW, NON-CONFORMANCE)
// ==========================================
router.post('/plans/:id/link-jsa', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [plan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, id));
    if (!plan || plan.isDeleted) return res.status(404).json({ success: false, error: 'طرح یافت نشد.' });

    const b = req.body || {};
    let riskId = b.existingRiskAssessmentId ? Number(b.existingRiskAssessmentId) : 0;

    if (!riskId) {
      const severity = Math.max(1, Math.min(5, Number(b.severity || 4)));
      const probability = Math.max(1, Math.min(5, Number(b.probability || 3)));
      const score = severity * probability;
      const level = score >= 15 ? 'CRITICAL' : score >= 10 ? 'HIGH' : score >= 5 ? 'MEDIUM' : 'LOW';
      const [createdRisk] = await db
        .insert(schema.riskAssessments)
        .values({
          assessmentCode: `JSA-LP-${plan.planCode}`,
          activityTitle: String(b.activityTitle || `ارزیابی ریسک و JSA باربرداری: ${plan.title}`),
          unitId: plan.unitId,
          unitName: plan.unitName,
          areaLocation: plan.areaLocation,
          assessorName: actorLabel(req),
          assessmentDate: new Date().toISOString().slice(0, 10),
          methodology: 'JSA',
          hazardDescription: String(b.hazardDescription || 'سقوط بار، واژگونی جرثقیل، گسیختگی اسلینگ/شگل، برخورد با تأسیسات مجاور'),
          consequences: String(b.consequences || 'آسیب شدید جانی، خسارت تجهیزاتی یا نشت مواد شیمیایی'),
          existingControls: String(b.existingControls || 'گواهینامه معتبر جرثقیل و ریگینگ، محصورسازی محدوده خطر، تگ‌لاین'),
          severity,
          probability,
          initialRiskScore: score,
          initialRiskLevel: level,
          proposedControls: String(b.proposedControls || 'تأیید محاسبات Lifting Plan مطابق ASME P30.1، برگزاری Pre-Lift Meeting و پایش سرعت باد'),
          residualSeverity: Math.max(1, severity - 1),
          residualProbability: Math.max(1, probability - 2),
          residualRiskScore: Math.max(1, severity - 1) * Math.max(1, probability - 2),
          residualRiskLevel: 'LOW',
          responsiblePerson: plan.personnelAssignment?.safetySupervisorName || actorLabel(req),
          status: 'APPROVED',
          payload: { source: 'LIFTING_PLAN', liftingPlanId: plan.id, planCode: plan.planCode, steps: Array.isArray(b.steps) ? b.steps : [] },
          linkedRefs: { liftingPlanId: plan.id, planCode: plan.planCode },
        })
        .returning();
      riskId = createdRisk.id;
    }

    const [updatedPlan] = await db
      .update(schema.liftingPlans)
      .set({ linkedRiskAssessmentId: riskId, updatedBy: actorLabel(req), updatedAt: new Date() })
      .where(eq(schema.liftingPlans.id, id))
      .returning();

    await logAudit(req, 'LINK_JSA', 'LIFTING_PLAN', id, null, { linkedRiskAssessmentId: riskId });
    broadcastDataMutation('lifting', 'link_jsa', updatedPlan);
    return res.json({ success: true, data: updatedPlan, linkedRiskAssessmentId: riskId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در ثبت/اتصال JSA' });
  }
});

router.post('/plans/:id/link-ptw', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [plan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, id));
    if (!plan || plan.isDeleted) return res.status(404).json({ success: false, error: 'طرح یافت نشد.' });

    const b = req.body || {};
    let permitId = b.existingPermitId ? Number(b.existingPermitId) : 0;

    if (!permitId) {
      const permitNumber = `PTW-LP-${plan.planCode}-${Date.now().toString().slice(-4)}`;
      const today = new Date().toISOString().slice(0, 10);
      const [createdPtw] = await db
        .insert(schema.workPermits)
        .values({
          permitNumber,
          permitType: String(b.permitType || 'COLD'),
          permitCategory: 'VEHICLE_CRANE',
          title: String(b.title || `مجوز باربرداری ${plan.title} (${plan.planCode})`),
          companyId: plan.companyId,
          unitId: plan.unitId,
          location: `${plan.unitName} - ${plan.areaLocation}`,
          description: `عملیات باربرداری ${plan.loadName} (${plan.netLoadWeightTon} تن خالص) مطابق طرح ${plan.planCode} ویرایش ${plan.revisionNumber}`,
          hazards: ['سقوط بار معلق', 'برخورد دکل', 'واژگونی'],
          precautions: ['حضور ریگر و اپراتور مجاز', 'چک‌لیست پیش از باربرداری', 'محدودسازی مسیر'],
          status: 'PENDING_APPROVAL',
          validFrom: String(b.validFrom || plan.plannedDate || today),
          validTo: String(b.validTo || plan.plannedDate || today),
          contractorName: plan.contractorName,
          equipmentList: `بار: ${plan.loadName} | طرح: ${plan.planCode}`,
          formData: { liftingPlanId: plan.id, planCode: plan.planCode, liftCategory: plan.liftCategory },
        })
        .returning();
      permitId = createdPtw.id;
    }

    const [updatedPlan] = await db
      .update(schema.liftingPlans)
      .set({ linkedPermitId: permitId, updatedBy: actorLabel(req), updatedAt: new Date() })
      .where(eq(schema.liftingPlans.id, id))
      .returning();

    await logAudit(req, 'LINK_PTW', 'LIFTING_PLAN', id, null, { linkedPermitId: permitId });
    broadcastDataMutation('lifting', 'link_ptw', updatedPlan);
    return res.json({ success: true, data: updatedPlan, linkedPermitId: permitId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در اتصال/صدور PTW' });
  }
});

router.post('/plans/:id/link-nc', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const [plan] = await db.select().from(schema.liftingPlans).where(eq(schema.liftingPlans.id, id));
    if (!plan || plan.isDeleted) return res.status(404).json({ success: false, error: 'طرح یافت نشد.' });

    const b = req.body || {};
    let ncId = b.existingNcId ? Number(b.existingNcId) : 0;

    if (!ncId) {
      const trackingCode = `NC-LP-${Date.now().toString().slice(-6)}`;
      const [createdNc] = await db
        .insert(schema.nonConformances)
        .values({
          trackingCode,
          title: String(b.title || `عدم انطباق باربرداری: ${plan.planCode}`),
          sourceModule: 'lifting_plan',
          sourceRecordId: String(plan.id),
          sourceTitle: `${plan.planCode} - ${plan.title}`,
          unitId: plan.unitId,
          unitName: plan.unitName,
          riskLevel: String(b.riskLevel || 'HIGH'),
          category: 'عملیات باربرداری و جرثقیل',
          description: String(b.description || 'مغایرت فنی یا ایمنی شناسایی‌شده در ممیزی طرح باربرداری'),
          correctiveAction: String(b.correctiveAction || 'اصلاح تجهیزات Rigging / تأمین گواهینامه معتبر / بازطراحی مهندسی'),
          assignedToName: plan.personnelAssignment?.safetySupervisorName || actorLabel(req),
          status: 'REGISTERED',
          createdBy: actorLabel(req),
        })
        .returning();
      ncId = createdNc.id;
    }

    const [updatedPlan] = await db
      .update(schema.liftingPlans)
      .set({ linkedNonConformanceId: ncId, updatedBy: actorLabel(req), updatedAt: new Date() })
      .where(eq(schema.liftingPlans.id, id))
      .returning();

    await logAudit(req, 'LINK_NC', 'LIFTING_PLAN', id, null, { linkedNonConformanceId: ncId });
    broadcastDataMutation('lifting', 'link_nc', updatedPlan);
    return res.json({ success: true, data: updatedPlan, linkedNonConformanceId: ncId });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در ثبت عدم انطباق' });
  }
});

// ==========================================
// INTERNAL HSECORE AI ADVISORY ENDPOINT (NO APPROVAL POWER)
// ==========================================
router.post('/plans/:id/ai-analyze', requireAuth, async (req: Request, res: Response) => {
  if (!canReadLifting(req)) return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز' });
  const id = Number(req.params.id);
  try {
    const result = await liftingService.analyzePlanWithAI(id, req.body?.question);
    await logAudit(req, 'AI_ADVISORY', 'LIFTING_PLAN', id, null, { aiEngineOnline: result.aiEngineOnline });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'خطا در تحلیل هوش مصنوعی داخلی' });
  }
});

export default router;
