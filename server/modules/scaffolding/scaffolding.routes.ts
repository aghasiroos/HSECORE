import { Router, Request, Response, NextFunction } from 'express';
import {
  checkUserHasPermission,
  isGlobalAdminUser,
  normalizeRoleToCanonical,
  requireAuth,
  resolveLiveUserContext,
  UserContext,
} from '../../core/middleware/auth.ts';
import { ForbiddenError, ValidationError } from '../../core/errors.ts';
import { auditService } from '../audit/audit.service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { scaffoldingService } from './scaffolding.service.ts';

const router = Router();

export interface ScaffoldPermissionsMatrix {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canInspect: boolean;
  canApprove: boolean;
  canChangeTag: boolean;
  canReport: boolean;
  canDelete: boolean;
}

async function resolveScaffoldPermissions(req: Request): Promise<{ user: UserContext; perms: ScaffoldPermissionsMatrix }> {
  const baseUser = req.user!;
  const user = await resolveLiveUserContext(baseUser);
  req.user = user;

  const canonical = normalizeRoleToCanonical(user.role);
  const isAdmin = isGlobalAdminUser(user) || canonical === 'ADMIN' || canonical === 'ADMINISTRATOR';

  if (isAdmin) {
    return {
      user,
      perms: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canInspect: true,
        canApprove: true,
        canChangeTag: true,
        canReport: true,
        canDelete: true,
      },
    };
  }

  const check = (action: string) =>
    checkUserHasPermission(user, `scaffolding:${action}`) ||
    checkUserHasPermission(user, `safety_dept.scaffolding.${action}`);

  const canApprove = check('approve');
  const canChangeTag = check('tag') || canApprove;
  const canInspect = check('inspect') || canApprove;
  const canCreate = check('create');
  const canEdit = check('update') || check('edit');
  const canDelete = check('delete');
  const canReport = check('report') || check('export') || check('print') || check('read');
  const canView = check('read') || check('view') || canCreate || canEdit || canInspect || canApprove;

  return {
    user,
    perms: {
      canView,
      canCreate,
      canEdit,
      canInspect,
      canApprove,
      canChangeTag,
      canReport,
      canDelete,
    },
  };
}

function assertScaffoldPerm(
  req: Request,
  allowed: boolean,
  permKey: string,
  reasonFa: string
): void {
  if (!allowed) {
    auditService.logAccessDenied(req, reasonFa, permKey).catch(() => {});
    throw new ForbiddenError(reasonFa);
  }
}

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('شناسه رکورد داربست نامعتبر است.');
  }
  return id;
}

// All scaffolding endpoints require authenticated JWT session
router.use(requireAuth);

/**
 * GET /api/v1/scaffolding/bootstrap
 * Returns live DB reference catalogs (PTW permits, work requests, org units, personnel, contractors)
 * plus current user's effective RBAC permissions matrix.
 */
router.get('/bootstrap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canView, 'scaffolding:read', 'شما مجوز مشاهده ماژول بازرسی و وضعیت داربست‌بندی را ندارید.');
    const data = await scaffoldingService.getBootstrapContext();
    res.json({ success: true, data: { ...data, permissions: perms } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/scaffolding/settings
 * Persist scaffolding checklist settings (such as enabling/disabling the N/A option) in PostgreSQL.
 */
router.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(
      req,
      perms.canInspect || perms.canEdit || perms.canApprove,
      'scaffolding:update',
      'شما مجوز تغییر تنظیمات چک‌لیست داربست‌بندی را ندارید.'
    );

    const settings = await scaffoldingService.updateChecklistSettings(req.body || {}, user);

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_SETTINGS_UPDATE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD_SETTINGS',
      newValue: settings,
      details: {
        actionTitle: `به‌روزرسانی تنظیمات چک‌لیست داربست (گزینه نامرتبط: ${settings.allowNaOption ? 'فعال' : 'غیرفعال'})`,
      },
    });

    broadcastDataMutation('scaffolding', 'settings_update', settings, {
      module: 'SCAFFOLDING',
      actorId: user.uid,
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/scaffolding
 * List all scaffolds with multi-criteria filters & live KPIs.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canView, 'scaffolding:read', 'شما مجوز مشاهده فهرست داربست‌ها را ندارید.');

    const result = await scaffoldingService.listScaffolds({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      unit: typeof req.query.unit === 'string' ? req.query.unit : undefined,
      contractor: typeof req.query.contractor === 'string' ? req.query.contractor : undefined,
      inspector: typeof req.query.inspector === 'string' ? req.query.inspector : undefined,
      tagStatus: typeof req.query.tagStatus === 'string' ? req.query.tagStatus : undefined,
      workflowStatus: typeof req.query.workflowStatus === 'string' ? req.query.workflowStatus : undefined,
      permitNumber: typeof req.query.permitNumber === 'string' ? req.query.permitNumber : undefined,
    });

    res.json({ success: true, data: { ...result, permissions: perms } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/scaffolding/reports/summary
 * Executive management summary report.
 */
router.get('/reports/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canReport, 'scaffolding:report', 'شما مجوز دریافت گزارش مدیریتی داربست‌ها را ندارید.');

    const report = await scaffoldingService.getManagementReport({
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      unit: typeof req.query.unit === 'string' ? req.query.unit : undefined,
      contractor: typeof req.query.contractor === 'string' ? req.query.contractor : undefined,
      inspector: typeof req.query.inspector === 'string' ? req.query.inspector : undefined,
      tagStatus: typeof req.query.tagStatus === 'string' ? req.query.tagStatus : undefined,
      workflowStatus: typeof req.query.workflowStatus === 'string' ? req.query.workflowStatus : undefined,
      permitNumber: typeof req.query.permitNumber === 'string' ? req.query.permitNumber : undefined,
    });

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_REPORT_VIEW',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD_REPORT',
      details: { totalCount: report.items.length },
    });

    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/scaffolding/:id
 * Full scaffold details including inspection history and tag status audit trail.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canView, 'scaffolding:read', 'شما مجوز مشاهده جزئیات داربست را ندارید.');

    const id = parseIdParam(req.params.id);
    const detail = await scaffoldingService.getScaffoldDetail(id);
    res.json({ success: true, data: { ...detail, permissions: perms } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/scaffolding
 * Register a new scaffold.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canCreate, 'scaffolding:create', 'شما مجوز ثبت داربست جدید را ندارید.');

    const created = await scaffoldingService.createScaffold(req.body || {}, user, {
      canApprove: perms.canApprove,
      canChangeTag: perms.canChangeTag,
    });

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_CREATE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD',
      entityId: created.id,
      newValue: {
        scaffoldCode: created.scaffoldCode,
        requestingUnit: created.requestingUnit,
        contractorName: created.contractorName,
        permitNumber: created.permitNumber,
        tagStatus: created.tagStatus,
        workflowStatus: created.workflowStatus,
      },
      details: { actionTitle: `ثبت داربست جدید ${created.scaffoldCode}` },
    });

    broadcastDataMutation('scaffolding', 'create', { id: created.id, scaffoldCode: created.scaffoldCode }, {
      module: 'SCAFFOLDING',
      recordId: created.id,
      actorId: user.uid,
      version: created.version,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/scaffolding/:id
 * Edit scaffold registration details (workflow/tag/approval fields protected against tampering).
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canEdit, 'scaffolding:update', 'شما مجوز ویرایش اطلاعات داربست را ندارید.');

    const id = parseIdParam(req.params.id);
    const { previous, updated } = await scaffoldingService.updateScaffold(id, req.body || {}, user);

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_UPDATE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD',
      entityId: updated.id,
      oldValue: {
        requestingUnit: previous.requestingUnit,
        installationLocation: previous.installationLocation,
        contractorName: previous.contractorName,
        heightMeters: previous.heightMeters,
      },
      newValue: {
        requestingUnit: updated.requestingUnit,
        installationLocation: updated.installationLocation,
        contractorName: updated.contractorName,
        heightMeters: updated.heightMeters,
      },
      details: { actionTitle: `ویرایش مشخصات داربست ${updated.scaffoldCode}` },
    });

    broadcastDataMutation('scaffolding', 'update', { id: updated.id, scaffoldCode: updated.scaffoldCode }, {
      module: 'SCAFFOLDING',
      recordId: updated.id,
      actorId: user.uid,
      version: updated.version,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/scaffolding/:id/complete-installation
 * Mark scaffold installation complete (Stage 1 -> Stage 2).
 */
router.post('/:id/complete-installation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(
      req,
      perms.canEdit || perms.canCreate || perms.canInspect,
      'scaffolding:update',
      'شما مجوز ثبت تکمیل نصب داربست را ندارید.'
    );

    const id = parseIdParam(req.params.id);
    const { previous, updated } = await scaffoldingService.completeInstallation(id, req.body || {}, user);

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_INSTALL_COMPLETE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD',
      entityId: updated.id,
      oldValue: { workflowStatus: previous.workflowStatus },
      newValue: { workflowStatus: updated.workflowStatus, installationCompletedDate: updated.installationCompletedDate },
      details: { actionTitle: `ثبت تکمیل نصب داربست ${updated.scaffoldCode}` },
    });

    broadcastDataMutation('scaffolding', 'update', { id: updated.id, scaffoldCode: updated.scaffoldCode }, {
      module: 'SCAFFOLDING',
      recordId: updated.id,
      actorId: user.uid,
      version: updated.version,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/scaffolding/:id/inspections
 * Record a standard 15+ item inspection (initial, periodic, or event-triggered re-inspection).
 */
router.post('/:id/inspections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canInspect, 'scaffolding:inspect', 'شما مجوز ثبت بازرسی و چک‌لیست داربست را ندارید.');

    const id = parseIdParam(req.params.id);
    const result = await scaffoldingService.recordInspection(id, req.body || {}, user, {
      canApprove: perms.canApprove,
      canChangeTag: perms.canChangeTag,
    });

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_INSPECTION_CREATE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD_INSPECTION',
      entityId: result.inspection.id,
      newValue: {
        scaffoldId: id,
        scaffoldCode: result.scaffold.scaffoldCode,
        inspectionNumber: result.inspection.inspectionNumber,
        inspectionReason: result.inspection.inspectionReason,
        complianceScore: result.evaluation.complianceScore,
        openDefectsCount: result.evaluation.openDefectsCount,
        criticalDefectCount: result.evaluation.criticalDefectCount,
        tagStatus: result.scaffold.tagStatus,
        workflowStatus: result.scaffold.workflowStatus,
      },
      details: {
        actionTitle: `ثبت بازرسی ${result.inspection.inspectionNumber} برای داربست ${result.scaffold.scaffoldCode}`,
      },
    });

    broadcastDataMutation('scaffolding', 'inspect', { id: result.scaffold.id, inspectionId: result.inspection.id }, {
      module: 'SCAFFOLDING',
      recordId: result.scaffold.id,
      actorId: user.uid,
      version: result.scaffold.version,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/scaffolding/:id/approve
 * Authorized HSE Inspector final approval (hard-blocked if critical/open defects exist).
 */
router.post('/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(
      req,
      perms.canApprove,
      'scaffolding:approve',
      'فقط بازرس مجاز HSE یا مدیران دارای مجوز تأیید می‌توانند تأیید نهایی داربست را انجام دهند.'
    );

    const id = parseIdParam(req.params.id);
    const { previous, updated } = await scaffoldingService.approveScaffold(
      id,
      req.body || {},
      user,
      perms.canChangeTag
    );

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_APPROVE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD',
      entityId: updated.id,
      oldValue: { tagStatus: previous.tagStatus, workflowStatus: previous.workflowStatus },
      newValue: {
        tagStatus: updated.tagStatus,
        workflowStatus: updated.workflowStatus,
        approvedBy: updated.approvedBy,
        tagValidUntil: updated.tagValidUntil,
      },
      details: { actionTitle: `تأیید نهایی بازرس HSE برای داربست ${updated.scaffoldCode}` },
    });

    broadcastDataMutation('scaffolding', 'approve', { id: updated.id, tagStatus: updated.tagStatus }, {
      module: 'SCAFFOLDING',
      recordId: updated.id,
      actorId: user.uid,
      version: updated.version,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/scaffolding/:id/tag
 * Authorized color tag transition (GREEN / YELLOW / RED) with mandatory reason and immutable history.
 */
router.post('/:id/tag', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(
      req,
      perms.canChangeTag,
      'scaffolding:tag',
      'شما مجوز تغییر وضعیت تگ رنگی داربست را ندارید.'
    );

    const id = parseIdParam(req.params.id);
    const { previous, updated, historyEntry } = await scaffoldingService.changeTagStatus(id, req.body || {}, user);

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_TAG_CHANGE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD_TAG',
      entityId: updated.id,
      oldValue: { tagStatus: previous.tagStatus, workflowStatus: previous.workflowStatus },
      newValue: { tagStatus: updated.tagStatus, workflowStatus: updated.workflowStatus, validUntil: updated.tagValidUntil },
      reason: historyEntry.reason,
      details: {
        actionTitle: `تغییر تگ داربست ${updated.scaffoldCode} از ${previous.tagStatus} به ${updated.tagStatus}`,
      },
    });

    broadcastDataMutation('scaffolding', 'tag_change', { id: updated.id, tagStatus: updated.tagStatus }, {
      module: 'SCAFFOLDING',
      recordId: updated.id,
      actorId: user.uid,
      version: updated.version,
    });

    res.json({ success: true, data: { scaffold: updated, historyEntry } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/scaffolding/:id
 * Delete scaffold record (restricted to delete permission).
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, perms } = await resolveScaffoldPermissions(req);
    assertScaffoldPerm(req, perms.canDelete, 'scaffolding:delete', 'شما مجوز حذف رکورد داربست را ندارید.');

    const id = parseIdParam(req.params.id);
    const deleted = await scaffoldingService.deleteScaffold(id);

    await auditService.logFromRequest(req, {
      action: 'SCAFFOLD_DELETE',
      module: 'SCAFFOLDING',
      entityType: 'SCAFFOLD',
      entityId: deleted.id,
      oldValue: { scaffoldCode: deleted.scaffoldCode, requestingUnit: deleted.requestingUnit },
      details: { actionTitle: `حذف رکورد داربست ${deleted.scaffoldCode}` },
    });

    broadcastDataMutation('scaffolding', 'delete', { id: deleted.id, scaffoldCode: deleted.scaffoldCode }, {
      module: 'SCAFFOLDING',
      recordId: deleted.id,
      actorId: user.uid,
    });

    res.json({ success: true, data: { id: deleted.id, scaffoldCode: deleted.scaffoldCode } });
  } catch (err) {
    next(err);
  }
});

export default router;
