import { Router, Request, Response } from 'express';
import { db } from '../../../src/db/index.ts';
import {
  fireDesignBuildings,
  fireDesignFloors,
  fireDesignLayouts,
  fireDesignSystems,
  fireDesignGapActions,
  fireEquipment,
  orgCompanies,
  orgUnits,
} from '../../../src/db/schema.ts';
import { eq, desc, asc, and } from 'drizzle-orm';
import {
  requireAuth,
  checkUserHasPermission,
  isGlobalAdminUser,
} from '../../core/middleware/auth.ts';
import { auditService } from '../audit/audit.service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { logger } from '../../core/logger.ts';
import {
  runNfpaFloorCalculation,
  ExistingEquipmentSummaryItem,
} from '../../../src/modules/fire-dept/fire-design/nfpaEngine.ts';
import { getSystemPlugin } from '../../../src/modules/fire-dept/fire-design/systemsRegistry.ts';
import {
  sanitizeWaterSupply,
  resolveWaterSourceType,
} from '../../../src/modules/fire-dept/fire-design/waterSupplyUtils.ts';
import type {
  BuildingDependencyCheck,
  FireDesignBuilding,
  FireDesignFloor,
  FireSystemType,
  FloorCalculationResult,
  WaterSourceType,
} from '../../../src/modules/fire-dept/fire-design/types.ts';

const router = Router();

function canReadFireDesign(req: Request): boolean {
  if (!req.user) return false;
  if (isGlobalAdminUser(req.user)) return true;
  if (
    checkUserHasPermission(req.user, 'fire_equipment:read') ||
    checkUserHasPermission(req.user, 'fire_equipment:*')
  ) {
    return true;
  }
  const roleNorm = String(req.user.role || '').toUpperCase().replace(/[\s_-]+/g, '');
  return !['GUEST'].includes(roleNorm);
}

function canWriteFireDesign(req: Request): boolean {
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
    checkUserHasPermission(req.user, 'fire_equipment:*') ||
    checkUserHasPermission(req.user, 'fire_equipment:update') ||
    checkUserHasPermission(req.user, 'fire_equipment:create') ||
    ['FIREOFFICER', 'HSEMANAGER', 'EXECUTIVEMANAGER', 'MAINTENANCEMANAGER', 'SAFETYOFFICER', 'SAFETYINSPECTOR', 'PROJECTMANAGER'].includes(roleNorm) ||
    /آتش‌نشانی|ایمنی|مدیر|مهندس|کارشناس/i.test(roleRaw)
  );
}

function canApproveFireDesign(req: Request): boolean {
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
    checkUserHasPermission(req.user, 'fire_equipment:*') ||
    ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'FIREOFFICER', 'EXECUTIVEMANAGER', 'MAINTENANCEMANAGER'].includes(roleNorm) ||
    /مدیر|رئیس|فرمانده/i.test(roleRaw)
  );
}

async function recordAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | number,
  oldValue?: any,
  newValue?: any,
  details?: any
) {
  try {
    const recordLabel =
      newValue?.name ||
      newValue?.floorLabel ||
      newValue?.title ||
      oldValue?.name ||
      oldValue?.floorLabel ||
      oldValue?.title ||
      `#${entityId}`;
    await auditService.logFromRequest(req, {
      action,
      module: 'FIRE_DESIGN',
      entityType,
      entityId: String(entityId),
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      result: action === 'DELETE_BLOCKED' ? 'WARNING' : 'SUCCESS',
      details: {
        actionTitle: `عملیات ${action} روی ${entityType} (${recordLabel})`,
        ...(details && typeof details === 'object' ? details : {}),
      },
    });
  } catch (err) {
    logger.warn('[FireDesign] Audit log insert failed:', err);
  }
}

async function getNormalizedExistingEquipment(): Promise<ExistingEquipmentSummaryItem[]> {
  const rows = await db.select().from(fireEquipment);
  return rows.map((r) => {
    const extra = (r.extraData && typeof r.extraData === 'object' ? r.extraData : {}) as Record<string, any>;
    return {
      id: String(r.id),
      code: r.code,
      category: extra.category || r.equipmentType || '',
      location: r.location || '',
      unit: extra.unit || extra.locationDetails?.unit || '',
      complex: extra.complex || extra.locationDetails?.complex || '',
      floor: extra.floor || extra.locationDetails?.floor || '',
      type: extra.type || r.equipmentType || '',
      weight: extra.weight ?? r.capacity ?? '',
      operationalStatus: extra.operationalStatus || r.status || 'فعال',
      nextInspectionDue: r.nextInspectionDue ? new Date(r.nextInspectionDue).toISOString().slice(0, 10) : (extra.nextInspectionDue || null),
      hydrostaticTestDue: r.hydrostaticTestDue ? new Date(r.hydrostaticTestDue).toISOString().slice(0, 10) : (extra.hydrostaticTestDue || null),
    };
  });
}

async function inspectBuildingDependencies(
  buildingRow: typeof fireDesignBuildings.$inferSelect
): Promise<BuildingDependencyCheck> {
  const [bFloors, bLayouts, bSystems, bGaps, eqList] = await Promise.all([
    db.select().from(fireDesignFloors).where(eq(fireDesignFloors.buildingId, buildingRow.id)),
    db.select().from(fireDesignLayouts).where(eq(fireDesignLayouts.buildingId, buildingRow.id)),
    db.select().from(fireDesignSystems).where(and(eq(fireDesignSystems.buildingId, buildingRow.id), eq(fireDesignSystems.isActive, true))),
    db.select().from(fireDesignGapActions).where(eq(fireDesignGapActions.buildingId, buildingRow.id)),
    getNormalizedExistingEquipment(),
  ]);

  const unitNorm = (buildingRow.unitName || '').trim().toLowerCase();
  const nameNorm = (buildingRow.name || '').trim().toLowerCase();
  const linkedEquipmentCount = eqList.filter((eq) => {
    const eqText = `${eq.unit || ''} ${eq.location || ''} ${eq.complex || ''}`.toLowerCase();
    return (unitNorm && eqText.includes(unitNorm)) || (nameNorm && eqText.includes(nameNorm));
  }).length;

  const approvedLayoutsCount = bLayouts.filter((l) => l.status === 'APPROVED').length;
  const reviewedLayoutsCount = bLayouts.filter((l) => l.status === 'REVIEWED').length;
  const approvedSystemsCount = bSystems.filter(
    (s) => s.designStage === 'APPROVED_ENGINEERING' || s.designStage === 'REVIEWED'
  ).length;
  const openGapActionsCount = bGaps.filter((g) => g.status === 'OPEN' || g.status === 'IN_PROGRESS').length;

  const hasApprovedProjects =
    buildingRow.status === 'APPROVED' ||
    approvedLayoutsCount > 0 ||
    reviewedLayoutsCount > 0 ||
    approvedSystemsCount > 0;

  const hasDependencies =
    bFloors.length > 0 ||
    bLayouts.length > 0 ||
    bSystems.length > 0 ||
    bGaps.length > 0 ||
    linkedEquipmentCount > 0;

  const parts: string[] = [];
  if (bFloors.length > 0) parts.push(`${bFloors.length} طبقه ثبت‌شده`);
  if (bLayouts.length > 0) parts.push(`${bLayouts.length} نسخه نقشه و محاسبات`);
  if (bSystems.length > 0) parts.push(`${bSystems.length} سیستم حفاظتی طراحی‌شده`);
  if (bGaps.length > 0) parts.push(`${bGaps.length} اقدام اصلاحی / مغایرت (${openGapActionsCount} باز)`);
  if (linkedEquipmentCount > 0) parts.push(`${linkedEquipmentCount} تجهیز آتش‌نشانی مرتبط در واحد`);

  const canDelete = !hasApprovedProjects;

  const blockReasonFa = hasApprovedProjects
    ? `محدودیت وابستگی: ساختمان «${buildingRow.name}» دارای پرونده یا اسناد مهندسی تأییدشده/بازبینی‌شده است (${approvedLayoutsCount} نقشه تأییدشده، ${reviewedLayoutsCount} بازبینی‌شده، ${approvedSystemsCount} سیستم تأییدشده). برای جلوگیری از حذف سوابق تاریخی و گزارش‌های رسمی، عملیات حذف متوقف شد.`
    : null;

  const warningDetailFa =
    !hasApprovedProjects && hasDependencies
      ? `هشدار تکمیلی: این ساختمان دارای اطلاعات وابسته شامل ${parts.join('، ')} است. در صورت تأیید نهایی، ساختمان با روش «حذف نرم (Soft Delete)» از فهرست فعال خارج شده و تمامی اسناد و سوابق تاریخی جهت بازیابی و ممیزی محفوظ می‌مانند.`
      : null;

  return {
    buildingId: buildingRow.id,
    buildingName: buildingRow.name,
    buildingCode: buildingRow.code,
    buildingStatus: buildingRow.status,
    floorsCount: bFloors.length,
    layoutsCount: bLayouts.length,
    approvedLayoutsCount,
    reviewedLayoutsCount,
    systemsCount: bSystems.length,
    approvedSystemsCount,
    gapActionsCount: bGaps.length,
    openGapActionsCount,
    linkedEquipmentCount,
    hasDependencies,
    hasApprovedProjects,
    canDelete,
    blockReasonFa,
    warningDetailFa,
  };
}

// ============================================================================
// GET /bootstrap
// ============================================================================
router.get('/bootstrap', requireAuth, async (req: Request, res: Response) => {
  if (!canReadFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'دسترسی به ماژول طراحی اطفای حریق مجاز نیست.' });
  }

  try {
    const [buildings, allFloors, allLayouts, allSystems, allGapActions, companies, units, equipmentSummary] =
      await Promise.all([
        db
          .select()
          .from(fireDesignBuildings)
          .where(eq(fireDesignBuildings.isDeleted, false))
          .orderBy(desc(fireDesignBuildings.updatedAt)),
        db.select().from(fireDesignFloors).orderBy(asc(fireDesignFloors.floorOrder), asc(fireDesignFloors.id)),
        db.select().from(fireDesignLayouts).orderBy(desc(fireDesignLayouts.revision), desc(fireDesignLayouts.updatedAt)),
        db.select().from(fireDesignSystems).orderBy(desc(fireDesignSystems.version), desc(fireDesignSystems.updatedAt)),
        db.select().from(fireDesignGapActions).orderBy(desc(fireDesignGapActions.createdAt)),
        db.select().from(orgCompanies),
        db.select().from(orgUnits),
        getNormalizedExistingEquipment(),
      ]);

    const activeBuildingIds = new Set(buildings.map((b) => b.id));
    const floors = allFloors.filter((f) => activeBuildingIds.has(f.buildingId));
    const layouts = allLayouts.filter((l) => activeBuildingIds.has(l.buildingId));
    const systems = allSystems.filter((s) => activeBuildingIds.has(s.buildingId));
    const gapActions = allGapActions.filter((g) => activeBuildingIds.has(g.buildingId));

    return res.json({
      success: true,
      data: {
        buildings,
        floors,
        layouts,
        systems,
        gapActions,
        companies,
        units,
        existingEquipmentCount: equipmentSummary.length,
        existingEquipment: equipmentSummary,
        permissions: {
          canRead: true,
          canWrite: canWriteFireDesign(req),
          canApprove: canApproveFireDesign(req),
        },
      },
    });
  } catch (error: any) {
    logger.error('[FireDesign] bootstrap failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در بازیابی داده‌های طراحی اطفای حریق' });
  }
});

// ============================================================================
// BUILDINGS CRUD
// ============================================================================
router.post('/buildings', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ثبت ساختمان جدید را ندارید.' });
  }
  try {
    const body = req.body || {};
    const code = String(body.code || '').trim() || `BLD-${Date.now().toString().slice(-5)}`;
    const name = String(body.name || '').trim();
    const unitName = String(body.unitName || '').trim();

    if (!name || !unitName) {
      return res.status(400).json({ success: false, error: 'نام ساختمان و واحد بهره‌بردار الزامی هستند.' });
    }

    const explicitSourceType: WaterSourceType | null =
      body.waterSourceType === 'FIRE_NETWORK' || body.waterSourceType === 'STORAGE_TANK'
        ? body.waterSourceType
        : body.waterSupply?.sourceType === 'FIRE_NETWORK' || body.waterSupply?.sourceType === 'STORAGE_TANK'
          ? body.waterSupply.sourceType
          : null;
    const normalizedWater = sanitizeWaterSupply(body.waterSupply, explicitSourceType);

    const [created] = await db
      .insert(fireDesignBuildings)
      .values({
        code,
        name,
        companyName: String(body.companyName || 'مجتمع پتروشیمی رجال').trim(),
        unitId: body.unitId ? Number(body.unitId) : null,
        unitName,
        occupancyType: body.occupancyType || 'INDUSTRIAL_PROCESS',
        nfpa13Edition: body.nfpa13Edition || '2022',
        nfpa10Edition: body.nfpa10Edition || '2022',
        floorsAboveGround: Math.max(1, Number(body.floorsAboveGround || 1)),
        basementFloors: Math.max(0, Number(body.basementFloors || 0)),
        structureType: body.structureType || 'CONCRETE',
        ceilingType: body.ceilingType || 'FLAT_UNOBSTRUCTED',
        storedMaterials: String(body.storedMaterials || '').trim(),
        hazardNature: Array.isArray(body.hazardNature) ? body.hazardNature : ['A'],
        riskLevelOverride: body.riskLevelOverride || 'AUTO',
        occupantLoad: Math.max(0, Number(body.occupantLoad || 0)),
        activityType: String(body.activityType || '').trim(),
        waterSourceType: normalizedWater.waterSourceType,
        waterSupply: normalizedWater.waterSupply,
        currentSuppressionNotes: body.currentSuppressionNotes || null,
        status: body.status || 'DRAFT',
        createdBy: req.user?.name || req.user?.username || 'کاربر سامانه',
      })
      .returning();

    await recordAudit(req, 'CREATE', 'BUILDING', created.id, null, created);
    broadcastDataMutation('fire_design', 'create_building', created);
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('[FireDesign] create building failed:', error);
    const pgCode = error?.code || error?.cause?.code;
    const isDuplicate =
      pgCode === '23505' ||
      String(error?.message || '').toLowerCase().includes('unique') ||
      String(error?.cause?.message || '').toLowerCase().includes('unique');
    return res.status(isDuplicate ? 409 : 500).json({
      success: false,
      error: isDuplicate ? 'کد ساختمان تکراری است؛ لطفاً کد یکتا وارد کنید.' : error?.message || 'خطا در ثبت ساختمان',
    });
  }
});

router.put('/buildings/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ویرایش ساختمان را ندارید.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه ساختمان نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignBuildings).where(eq(fireDesignBuildings.id, id));
    if (!existing || existing.isDeleted) return res.status(404).json({ success: false, error: 'ساختمان یافت نشد.' });

    const body = req.body || {};
    const hasWaterUpdate = body.waterSupply !== undefined || body.waterSourceType !== undefined;
    const nextRawWs = body.waterSupply !== undefined ? body.waterSupply : (existing.waterSupply as any);
    const explicitSourceType: WaterSourceType | null =
      body.waterSourceType === 'FIRE_NETWORK' || body.waterSourceType === 'STORAGE_TANK'
        ? body.waterSourceType
        : nextRawWs?.sourceType === 'FIRE_NETWORK' || nextRawWs?.sourceType === 'STORAGE_TANK'
          ? nextRawWs.sourceType
          : resolveWaterSourceType(
              { waterSourceType: (existing.waterSourceType as WaterSourceType | null), waterSupply: nextRawWs },
              'FIRE_NETWORK'
            );
    const normalizedWater = hasWaterUpdate
      ? sanitizeWaterSupply(nextRawWs, explicitSourceType)
      : null;

    const [updated] = await db
      .update(fireDesignBuildings)
      .set({
        code: body.code !== undefined ? String(body.code).trim() : existing.code,
        name: body.name !== undefined ? String(body.name).trim() : existing.name,
        companyName: body.companyName !== undefined ? String(body.companyName).trim() : existing.companyName,
        unitId: body.unitId !== undefined ? (body.unitId ? Number(body.unitId) : null) : existing.unitId,
        unitName: body.unitName !== undefined ? String(body.unitName).trim() : existing.unitName,
        occupancyType: body.occupancyType ?? existing.occupancyType,
        nfpa13Edition: body.nfpa13Edition ?? existing.nfpa13Edition,
        nfpa10Edition: body.nfpa10Edition ?? existing.nfpa10Edition,
        floorsAboveGround: body.floorsAboveGround !== undefined ? Math.max(1, Number(body.floorsAboveGround)) : existing.floorsAboveGround,
        basementFloors: body.basementFloors !== undefined ? Math.max(0, Number(body.basementFloors)) : existing.basementFloors,
        structureType: body.structureType ?? existing.structureType,
        ceilingType: body.ceilingType ?? existing.ceilingType,
        storedMaterials: body.storedMaterials !== undefined ? String(body.storedMaterials) : existing.storedMaterials,
        hazardNature: Array.isArray(body.hazardNature) ? body.hazardNature : existing.hazardNature,
        riskLevelOverride: body.riskLevelOverride ?? existing.riskLevelOverride,
        occupantLoad: body.occupantLoad !== undefined ? Math.max(0, Number(body.occupantLoad)) : existing.occupantLoad,
        activityType: body.activityType !== undefined ? String(body.activityType) : existing.activityType,
        waterSourceType: normalizedWater ? normalizedWater.waterSourceType : existing.waterSourceType,
        waterSupply: normalizedWater ? normalizedWater.waterSupply : existing.waterSupply,
        currentSuppressionNotes: body.currentSuppressionNotes !== undefined ? body.currentSuppressionNotes : existing.currentSuppressionNotes,
        status: body.status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(eq(fireDesignBuildings.id, id))
      .returning();

    await recordAudit(req, 'UPDATE', 'BUILDING', id, existing, updated);
    broadcastDataMutation('fire_design', 'update_building', updated);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('[FireDesign] update building failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در ویرایش ساختمان' });
  }
});

router.get('/buildings/:id/dependencies', requireAuth, async (req: Request, res: Response) => {
  if (!canReadFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز است.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه ساختمان نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignBuildings).where(eq(fireDesignBuildings.id, id));
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ success: false, error: 'ساختمان موردنظر یافت نشد یا قبلاً حذف شده است.' });
    }
    const deps = await inspectBuildingDependencies(existing);
    return res.json({ success: true, data: deps });
  } catch (error: any) {
    logger.error('[FireDesign] check building dependencies failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در بررسی وابستگی‌های ساختمان' });
  }
});

router.delete('/buildings/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveFireDesign(req)) {
    return res.status(403).json({
      success: false,
      error: 'فقط مدیران ایمنی، مدیران سیستم یا افسر آتش‌نشانی مجاز به حذف ساختمان هستند.',
    });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه ساختمان نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignBuildings).where(eq(fireDesignBuildings.id, id));
    if (!existing || existing.isDeleted) {
      return res.status(404).json({ success: false, error: 'ساختمان یافت نشد یا قبلاً حذف شده است.' });
    }

    const deps = await inspectBuildingDependencies(existing);
    const actorName = req.user?.name || req.user?.username || 'مدیر سامانه';

    if (!deps.canDelete) {
      await recordAudit(req, 'DELETE_BLOCKED', 'BUILDING', id, existing, null, {
        reason: deps.blockReasonFa,
        dependencies: deps,
      });
      return res.status(409).json({
        success: false,
        error: deps.blockReasonFa || 'امکان حذف ساختمان دارای پروژه یا اسناد تأییدشده وجود ندارد.',
        dependencies: deps,
      });
    }

    if (deps.hasDependencies && req.body?.confirmDependentSoftDelete !== true) {
      return res.status(409).json({
        success: false,
        error:
          deps.warningDetailFa ||
          'این ساختمان دارای اطلاعات وابسته است. لطفاً پس از مشاهده هشدار، عملیات حذف نرم را صریحاً تأیید کنید.',
        dependencies: deps,
      });
    }

    const [softDeletedRow] = await db
      .update(fireDesignBuildings)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: actorName,
        updatedAt: new Date(),
      })
      .where(eq(fireDesignBuildings.id, id))
      .returning();

    await recordAudit(req, 'SOFT_DELETE', 'BUILDING', id, existing, softDeletedRow, {
      softDelete: true,
      deletedBy: actorName,
      dependenciesSummary: deps,
    });
    broadcastDataMutation('fire_design', 'delete_building', { id, softDeleted: true });
    return res.json({
      success: true,
      message: 'ساختمان با رعایت حذف نرم (Soft Delete) از فهرست فعال حذف شد و سوابق مهندسی محفوظ ماند.',
      data: { id, softDeleted: true },
    });
  } catch (error: any) {
    logger.error('[FireDesign] delete building failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در حذف ساختمان' });
  }
});

// ============================================================================
// FLOORS CRUD
// ============================================================================
router.post('/floors', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ثبت طبقه جدید را ندارید.' });
  }
  try {
    const body = req.body || {};
    const buildingId = Number(body.buildingId);
    if (!buildingId) {
      return res.status(400).json({ success: false, error: 'انتخاب ساختمان الزامی است.' });
    }
    const [bld] = await db.select().from(fireDesignBuildings).where(eq(fireDesignBuildings.id, buildingId));
    if (!bld || bld.isDeleted) return res.status(404).json({ success: false, error: 'ساختمان مرتبط یافت نشد.' });

    const lengthM = Number(body.lengthM || 0);
    const widthM = Number(body.widthM || 0);
    const areaSqm = Number(body.areaSqm || 0) || Number((lengthM * widthM).toFixed(2));

    const [created] = await db
      .insert(fireDesignFloors)
      .values({
        buildingId,
        floorCode: String(body.floorCode || 'GF').trim(),
        floorLabel: String(body.floorLabel || 'همکف').trim(),
        floorOrder: Number(body.floorOrder ?? 0),
        isBasement: Boolean(body.isBasement),
        lengthM,
        widthM,
        ceilingHeightM: Number(body.ceilingHeightM || 0),
        areaSqm,
        falseCeilingHeightM: Number(body.falseCeilingHeightM || 0),
        beamDepthM: Number(body.beamDepthM || 0),
        beamSpacingM: Number(body.beamSpacingM || 0),
        spaces: Array.isArray(body.spaces) ? body.spaces : [],
        obstacles: Array.isArray(body.obstacles) ? body.obstacles : [],
        floorPlanFileId: body.floorPlanFileId || null,
        floorPlanFileName: body.floorPlanFileName || null,
        floorPlanMimeType: body.floorPlanMimeType || null,
        floorPlanWidthPx: body.floorPlanWidthPx ? Number(body.floorPlanWidthPx) : null,
        floorPlanHeightPx: body.floorPlanHeightPx ? Number(body.floorPlanHeightPx) : null,
        scaleMetersPerPixel: body.scaleMetersPerPixel ? Number(body.scaleMetersPerPixel) : null,
        calibrationLine: body.calibrationLine || null,
        notes: body.notes || null,
      })
      .returning();

    await recordAudit(req, 'CREATE', 'FLOOR', created.id, null, created);
    broadcastDataMutation('fire_design', 'create_floor', created);
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('[FireDesign] create floor failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در ثبت طبقه' });
  }
});

router.put('/floors/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ویرایش طبقه را ندارید.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه طبقه نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignFloors).where(eq(fireDesignFloors.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'طبقه یافت نشد.' });

    const body = req.body || {};
    const lengthM = body.lengthM !== undefined ? Number(body.lengthM) : existing.lengthM;
    const widthM = body.widthM !== undefined ? Number(body.widthM) : existing.widthM;
    const areaSqm =
      body.areaSqm !== undefined
        ? Number(body.areaSqm)
        : Number((lengthM * widthM).toFixed(2)) || existing.areaSqm;

    const [updated] = await db
      .update(fireDesignFloors)
      .set({
        floorCode: body.floorCode !== undefined ? String(body.floorCode).trim() : existing.floorCode,
        floorLabel: body.floorLabel !== undefined ? String(body.floorLabel).trim() : existing.floorLabel,
        floorOrder: body.floorOrder !== undefined ? Number(body.floorOrder) : existing.floorOrder,
        isBasement: body.isBasement !== undefined ? Boolean(body.isBasement) : existing.isBasement,
        lengthM,
        widthM,
        ceilingHeightM: body.ceilingHeightM !== undefined ? Number(body.ceilingHeightM) : existing.ceilingHeightM,
        areaSqm,
        falseCeilingHeightM:
          body.falseCeilingHeightM !== undefined ? Number(body.falseCeilingHeightM) : existing.falseCeilingHeightM,
        beamDepthM: body.beamDepthM !== undefined ? Number(body.beamDepthM) : existing.beamDepthM,
        beamSpacingM: body.beamSpacingM !== undefined ? Number(body.beamSpacingM) : existing.beamSpacingM,
        spaces: Array.isArray(body.spaces) ? body.spaces : existing.spaces,
        obstacles: Array.isArray(body.obstacles) ? body.obstacles : existing.obstacles,
        floorPlanFileId: body.floorPlanFileId !== undefined ? body.floorPlanFileId : existing.floorPlanFileId,
        floorPlanFileName: body.floorPlanFileName !== undefined ? body.floorPlanFileName : existing.floorPlanFileName,
        floorPlanMimeType: body.floorPlanMimeType !== undefined ? body.floorPlanMimeType : existing.floorPlanMimeType,
        floorPlanWidthPx: body.floorPlanWidthPx !== undefined ? body.floorPlanWidthPx : existing.floorPlanWidthPx,
        floorPlanHeightPx: body.floorPlanHeightPx !== undefined ? body.floorPlanHeightPx : existing.floorPlanHeightPx,
        scaleMetersPerPixel: body.scaleMetersPerPixel !== undefined ? body.scaleMetersPerPixel : existing.scaleMetersPerPixel,
        calibrationLine: body.calibrationLine !== undefined ? body.calibrationLine : existing.calibrationLine,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(fireDesignFloors.id, id))
      .returning();

    await recordAudit(req, 'UPDATE', 'FLOOR', id, existing, updated);
    broadcastDataMutation('fire_design', 'update_floor', updated);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('[FireDesign] update floor failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در ویرایش طبقه' });
  }
});

router.delete('/floors/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'فقط مدیران/افسر آتش‌نشانی مجاز به حذف طبقه هستند.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه طبقه نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignFloors).where(eq(fireDesignFloors.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'طبقه یافت نشد.' });

    await db.delete(fireDesignFloors).where(eq(fireDesignFloors.id, id));
    await recordAudit(req, 'DELETE', 'FLOOR', id, existing, null);
    broadcastDataMutation('fire_design', 'delete_floor', { id });
    return res.json({ success: true, message: 'طبقه حذف گردید.' });
  } catch (error: any) {
    logger.error('[FireDesign] delete floor failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در حذف طبقه' });
  }
});

// ============================================================================
// AUTHORITATIVE NFPA 13 & NFPA 10 CALCULATION + LAYOUT REVISIONS
// ============================================================================
router.post('/calculate', requireAuth, async (req: Request, res: Response) => {
  if (!canReadFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'دسترسی مجاز نیست.' });
  }
  try {
    const { buildingId, floorId, sprinklerConfig, extinguisherConfig, placedItems } = req.body || {};
    let building = req.body?.building as FireDesignBuilding | undefined;
    let floor = req.body?.floor as FireDesignFloor | undefined;

    if (!building && buildingId) {
      const [row] = await db
        .select()
        .from(fireDesignBuildings)
        .where(eq(fireDesignBuildings.id, Number(buildingId)));
      building = row as any;
    }
    if (!floor && floorId) {
      const [row] = await db
        .select()
        .from(fireDesignFloors)
        .where(eq(fireDesignFloors.id, Number(floorId)));
      floor = row as any;
    }

    if (!building || !floor) {
      return res.status(400).json({ success: false, error: 'اطلاعات ساختمان و طبقه جهت محاسبه یافت نشد.' });
    }

    const existingEq = await getNormalizedExistingEquipment();
    const result = runNfpaFloorCalculation({
      building,
      floor,
      sprinklerConfig,
      extinguisherConfig,
      placedItems,
      existingEquipment: existingEq,
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[FireDesign] calculate failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در اجرای موتور محاسبات NFPA' });
  }
});

router.post('/layouts', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ذخیره نقشه و جانمایی را ندارید.' });
  }
  try {
    const body = req.body || {};
    const buildingId = Number(body.buildingId);
    const floorId = Number(body.floorId);

    if (!buildingId || !floorId) {
      return res.status(400).json({ success: false, error: 'شناسه ساختمان و طبقه الزامی است.' });
    }

    const [[buildingRow], [floorRow]] = await Promise.all([
      db.select().from(fireDesignBuildings).where(eq(fireDesignBuildings.id, buildingId)),
      db.select().from(fireDesignFloors).where(eq(fireDesignFloors.id, floorId)),
    ]);

    if (!buildingRow || buildingRow.isDeleted || !floorRow) {
      return res.status(404).json({ success: false, error: 'ساختمان یا طبقه در پایگاه داده یافت نشد.' });
    }

    const existingEq = await getNormalizedExistingEquipment();
    const placedItems = Array.isArray(body.placedItems) ? body.placedItems : [];
    const sprinklerConfig = body.sprinklerConfig || {};
    const extinguisherConfig = body.extinguisherConfig || {};

    const snapshot = runNfpaFloorCalculation({
      building: buildingRow as any,
      floor: floorRow as any,
      sprinklerConfig,
      extinguisherConfig,
      placedItems,
      existingEquipment: existingEq,
    });

    const prevLayouts = await db
      .select()
      .from(fireDesignLayouts)
      .where(and(eq(fireDesignLayouts.buildingId, buildingId), eq(fireDesignLayouts.floorId, floorId)))
      .orderBy(desc(fireDesignLayouts.revision));

    const nextRevision = (prevLayouts[0]?.revision || 0) + 1;

    const [created] = await db
      .insert(fireDesignLayouts)
      .values({
        buildingId,
        floorId,
        revision: nextRevision,
        nfpa13Edition: buildingRow.nfpa13Edition,
        nfpa10Edition: buildingRow.nfpa10Edition,
        sprinklerConfig,
        extinguisherConfig,
        placedItems: placedItems.length > 0 ? placedItems : snapshot.suggestedItems,
        calculationSnapshot: snapshot,
        complianceSummary: snapshot.complianceChecks,
        status: 'DRAFT',
        calculatedBy: req.user?.name || req.user?.username || 'مهندس طراح',
        notes: body.notes || null,
      })
      .returning();

    // Update building status to DESIGNED if previously DRAFT
    if (buildingRow.status === 'DRAFT' && snapshot.calculationStatus !== 'INCOMPLETE_DATA') {
      await db
        .update(fireDesignBuildings)
        .set({ status: 'DESIGNED', updatedAt: new Date() })
        .where(eq(fireDesignBuildings.id, buildingId));
    }

    await recordAudit(req, 'CREATE', 'LAYOUT_REVISION', created.id, null, {
      buildingId,
      floorId,
      revision: nextRevision,
      calculationStatus: snapshot.calculationStatus,
    });
    broadcastDataMutation('fire_design', 'save_layout', created);
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('[FireDesign] save layout failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در ذخیره نسخه جانمایی' });
  }
});

router.post('/layouts/:id/approve', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'فقط مدیر HSE یا افسر آتش‌نشانی مجاز به تایید نهایی طرح است.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه نسخه نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignLayouts).where(eq(fireDesignLayouts.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'نسخه جانمایی یافت نشد.' });

    const snap = (existing.calculationSnapshot || {}) as Partial<FloorCalculationResult>;
    if (snap.calculationStatus === 'INCOMPLETE_DATA') {
      return res.status(400).json({
        success: false,
        error: 'امکان تایید نهایی طرح با اطلاعات ناقص وجود ندارد. ابتدا نواقص ورودی را برطرف کنید.',
      });
    }

    const nextStatus = req.body?.status === 'REVIEWED' ? 'REVIEWED' : 'APPROVED';
    const actorName = req.user?.name || req.user?.username || 'مدیر تاییدکننده';
    const notesValue = req.body?.notes !== undefined ? String(req.body.notes) : existing.reviewNotes;

    const updateSet =
      nextStatus === 'REVIEWED'
        ? {
            status: 'REVIEWED',
            reviewedBy: actorName,
            reviewedAt: new Date(),
            reviewNotes: notesValue ?? existing.reviewNotes,
            notes: req.body?.notes ?? existing.notes,
            updatedAt: new Date(),
          }
        : {
            status: 'APPROVED',
            reviewedBy: existing.reviewedBy || actorName,
            reviewedAt: existing.reviewedAt || new Date(),
            approvedBy: actorName,
            approvedAt: new Date(),
            reviewNotes: notesValue ?? existing.reviewNotes,
            notes: req.body?.notes ?? existing.notes,
            updatedAt: new Date(),
          };

    const [updated] = await db
      .update(fireDesignLayouts)
      .set(updateSet)
      .where(eq(fireDesignLayouts.id, id))
      .returning();

    if (nextStatus === 'APPROVED') {
      await db
        .update(fireDesignBuildings)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(eq(fireDesignBuildings.id, existing.buildingId));
    }

    await recordAudit(req, nextStatus === 'REVIEWED' ? 'REVIEW' : 'APPROVE', 'LAYOUT_REVISION', id, { status: existing.status }, { status: nextStatus, by: actorName, notes: notesValue });
    broadcastDataMutation('fire_design', 'approve_layout', updated);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('[FireDesign] approve layout failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در تایید نسخه طراحی' });
  }
});

// ============================================================================
// EXTENSIBLE FIRE PROTECTION SYSTEMS (NFPA 14, 11, 2001, 72, 20/22)
// ============================================================================
router.post('/systems', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ثبت طراحی سیستم جدید را ندارید.' });
  }
  try {
    const body = req.body || {};
    const buildingId = Number(body.buildingId);
    const floorId = body.floorId ? Number(body.floorId) : null;
    const systemType = String(body.systemType || '') as FireSystemType;

    const plugin = getSystemPlugin(systemType);
    if (!plugin || !buildingId) {
      return res.status(400).json({ success: false, error: 'نوع سیستم یا شناسه ساختمان نامعتبر است.' });
    }

    const [buildingRow] = await db.select().from(fireDesignBuildings).where(eq(fireDesignBuildings.id, buildingId));
    if (!buildingRow || buildingRow.isDeleted) return res.status(404).json({ success: false, error: 'ساختمان یافت نشد.' });

    let floorRow: any = null;
    if (floorId) {
      const [f] = await db.select().from(fireDesignFloors).where(eq(fireDesignFloors.id, floorId));
      floorRow = f || null;
    }

    const standardEdition = String(body.standardEdition || plugin.defaultEdition);
    const designInputs = body.designInputs && typeof body.designInputs === 'object' ? body.designInputs : {};

    const evalOutput = plugin.evaluate({
      building: buildingRow as any,
      floor: floorRow,
      edition: standardEdition,
      inputs: designInputs,
    });

    const existingVersions = await db
      .select()
      .from(fireDesignSystems)
      .where(and(eq(fireDesignSystems.buildingId, buildingId), eq(fireDesignSystems.systemType, systemType)))
      .orderBy(desc(fireDesignSystems.version));

    const nextVersion = (existingVersions[0]?.version || 0) + 1;

    const [created] = await db
      .insert(fireDesignSystems)
      .values({
        buildingId,
        floorId,
        systemType,
        standardCode: plugin.standardCode,
        standardEdition,
        localCodeNotes: body.localCodeNotes || null,
        designInputs,
        calculationOutput: evalOutput,
        complianceStatus: evalOutput.complianceStatus,
        designStage: 'PRELIMINARY',
        version: nextVersion,
        isActive: true,
        updatedBy: req.user?.name || req.user?.username || 'مهندس طراح',
      })
      .returning();

    await recordAudit(req, 'CREATE', 'SYSTEM_DESIGN', created.id, null, {
      buildingId,
      floorId,
      systemType,
      standardEdition,
      version: nextVersion,
    });
    broadcastDataMutation('fire_design', 'save_system', created);
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('[FireDesign] save system design failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در ثبت طراحی سیستم' });
  }
});

router.post('/systems/:id/approve', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'فقط مدیر HSE یا افسر آتش‌نشانی مجاز به تایید مهندسی سیستم است.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه سیستم نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignSystems).where(eq(fireDesignSystems.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'طراحی سیستم یافت نشد.' });

    if (existing.complianceStatus === 'INCOMPLETE' && req.body?.status !== 'REVIEWED') {
      return res.status(400).json({
        success: false,
        error: 'امکان تایید نهایی مهندسی برای سیستمی که داده‌های ورودی آن ناقص است وجود ندارد.',
      });
    }

    const nextStage = req.body?.status === 'REVIEWED' ? 'REVIEWED' : 'APPROVED_ENGINEERING';
    const actorName = req.user?.name || req.user?.username || 'مدیر تاییدکننده';
    const notesValue = req.body?.notes !== undefined ? String(req.body.notes) : existing.reviewNotes;

    const updateSet =
      nextStage === 'REVIEWED'
        ? {
            designStage: 'REVIEWED',
            reviewedBy: actorName,
            reviewedAt: new Date(),
            reviewNotes: notesValue ?? existing.reviewNotes,
            updatedAt: new Date(),
          }
        : {
            designStage: 'APPROVED_ENGINEERING',
            reviewedBy: existing.reviewedBy || actorName,
            reviewedAt: existing.reviewedAt || new Date(),
            approvedBy: actorName,
            approvedAt: new Date(),
            reviewNotes: notesValue ?? existing.reviewNotes,
            updatedAt: new Date(),
          };

    const [updated] = await db
      .update(fireDesignSystems)
      .set(updateSet)
      .where(eq(fireDesignSystems.id, id))
      .returning();

    await recordAudit(req, nextStage === 'REVIEWED' ? 'REVIEW' : 'APPROVE', 'SYSTEM_DESIGN', id, { designStage: existing.designStage }, { designStage: nextStage, by: actorName, notes: notesValue });
    broadcastDataMutation('fire_design', 'approve_system', updated);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('[FireDesign] approve system failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در تایید طراحی سیستم' });
  }
});

router.delete('/systems/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز حذف طراحی سیستم را ندارید.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignSystems).where(eq(fireDesignSystems.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'رکورد یافت نشد.' });

    await db.delete(fireDesignSystems).where(eq(fireDesignSystems.id, id));
    await recordAudit(req, 'DELETE', 'SYSTEM_DESIGN', id, existing, null);
    broadcastDataMutation('fire_design', 'delete_system', { id });
    return res.json({ success: true, message: 'طراحی سیستم حذف شد.' });
  } catch (error: any) {
    logger.error('[FireDesign] delete system failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در حذف طراحی سیستم' });
  }
});

// ============================================================================
// GAP ANALYSIS & CORRECTIVE ACTIONS (CAPA) CRUD
// ============================================================================
router.post('/gap-actions', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ثبت اقدام اصلاحی را ندارید.' });
  }
  try {
    const body = req.body || {};
    const buildingId = Number(body.buildingId);
    const title = String(body.title || '').trim();
    if (!buildingId || !title) {
      return res.status(400).json({ success: false, error: 'شناسه ساختمان و عنوان عدم انطباق الزامی است.' });
    }

    const [buildingRow] = await db.select().from(fireDesignBuildings).where(eq(fireDesignBuildings.id, buildingId));
    if (!buildingRow || buildingRow.isDeleted) {
      return res.status(404).json({ success: false, error: 'ساختمان مرتبط یافت نشد یا حذف شده است.' });
    }

    const actionCode =
      String(body.actionCode || '').trim() ||
      `FGAP-${buildingId}-${Date.now().toString().slice(-6)}`;

    const [existingByCode] = await db
      .select()
      .from(fireDesignGapActions)
      .where(eq(fireDesignGapActions.actionCode, actionCode));

    if (existingByCode) {
      return res.json({ success: true, data: existingByCode, alreadyExisted: true });
    }

    const [created] = await db
      .insert(fireDesignGapActions)
      .values({
        buildingId,
        floorId: body.floorId ? Number(body.floorId) : null,
        actionCode,
        systemType: String(body.systemType || 'GENERAL'),
        gapType: String(body.gapType || 'DEFICIT'),
        title,
        description: String(body.description || title),
        riskPriority: String(body.riskPriority || 'HIGH'),
        recommendedAction: String(body.recommendedAction || 'اصلاح مهندسی و تامین تجهیز مطابق NFPA'),
        responsiblePerson: body.responsiblePerson || null,
        dueDate: body.dueDate || null,
        status: String(body.status || 'OPEN'),
        resolutionNotes: body.resolutionNotes || null,
        createdBy: req.user?.name || req.user?.username || 'کارشناس ایمنی',
      })
      .returning();

    await recordAudit(req, 'CREATE', 'GAP_ACTION', created.id, null, created);
    broadcastDataMutation('fire_design', 'create_gap_action', created);
    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('[FireDesign] create gap action failed:', error);
    const pgCode = error?.code || error?.cause?.code;
    const isDup =
      pgCode === '23505' ||
      String(error?.message || '').toLowerCase().includes('unique') ||
      String(error?.cause?.message || '').toLowerCase().includes('unique');
    return res.status(isDup ? 409 : 500).json({
      success: false,
      error: isDup ? 'این اقدام اصلاحی قبلاً با همین کد ثبت شده است.' : error?.message || 'خطا در ثبت اقدام اصلاحی',
    });
  }
});

router.put('/gap-actions/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canWriteFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'شما مجوز ویرایش اقدام اصلاحی را ندارید.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignGapActions).where(eq(fireDesignGapActions.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'اقدام اصلاحی یافت نشد.' });

    const body = req.body || {};
    const nextStatus = body.status ?? existing.status;
    const isResolved = nextStatus === 'RESOLVED' || nextStatus === 'VERIFIED';

    const [updated] = await db
      .update(fireDesignGapActions)
      .set({
        riskPriority: body.riskPriority ?? existing.riskPriority,
        recommendedAction: body.recommendedAction ?? existing.recommendedAction,
        responsiblePerson: body.responsiblePerson !== undefined ? body.responsiblePerson : existing.responsiblePerson,
        dueDate: body.dueDate !== undefined ? body.dueDate : existing.dueDate,
        status: nextStatus,
        resolutionNotes: body.resolutionNotes !== undefined ? body.resolutionNotes : existing.resolutionNotes,
        resolvedAt: isResolved ? (existing.resolvedAt || new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(fireDesignGapActions.id, id))
      .returning();

    await recordAudit(req, 'UPDATE', 'GAP_ACTION', id, existing, updated);
    broadcastDataMutation('fire_design', 'update_gap_action', updated);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('[FireDesign] update gap action failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در بروزرسانی اقدام اصلاحی' });
  }
});

router.delete('/gap-actions/:id', requireAuth, async (req: Request, res: Response) => {
  if (!canApproveFireDesign(req)) {
    return res.status(403).json({ success: false, error: 'فقط مدیران/افسر آتش‌نشانی مجاز به حذف اقدام اصلاحی هستند.' });
  }
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'شناسه نامعتبر است.' });

  try {
    const [existing] = await db.select().from(fireDesignGapActions).where(eq(fireDesignGapActions.id, id));
    if (!existing) return res.status(404).json({ success: false, error: 'اقدام اصلاحی یافت نشد.' });

    await db.delete(fireDesignGapActions).where(eq(fireDesignGapActions.id, id));
    await recordAudit(req, 'DELETE', 'GAP_ACTION', id, existing, null);
    broadcastDataMutation('fire_design', 'delete_gap_action', { id });
    return res.json({ success: true, message: 'اقدام اصلاحی حذف شد.' });
  } catch (error: any) {
    logger.error('[FireDesign] delete gap action failed:', error);
    return res.status(500).json({ success: false, error: error?.message || 'خطا در حذف اقدام اصلاحی' });
  }
});

export default router;
