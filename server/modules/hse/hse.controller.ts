import { Request, Response } from 'express';
import { hseService } from './hse.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class HSEController {
  // 5S
  async getFiveS(req: Request, res: Response) {
    const list = await hseService.getFiveSAudits();
    return ApiResponse.success(res, list);
  }

  async createFiveS(req: Request, res: Response) {
    const created = await hseService.createFiveSAudit(req.body, req.user?.name);
    return ApiResponse.success(res, created, undefined, 201);
  }

  // Fire Equipment
  async getFireEquipment(req: Request, res: Response) {
    const list = await hseService.getFireEquipment();
    return ApiResponse.success(res, list);
  }

  async upsertFireEquipment(req: Request, res: Response) {
    const result = await hseService.upsertFireEquipment(req.body, req.user?.name);
    return ApiResponse.success(res, result);
  }

  // Warnings
  async getWarnings(req: Request, res: Response) {
    const allList = await hseService.getSafetyWarnings();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = personnelAccessService.filterModuleRecords(ctx, allList);
    return res.json({ success: true, data: list, count: list.length });
  }

  async createWarning(req: Request, res: Response) {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!ctx.canAccessAll) {
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, req.body);
    }
    const created = await hseService.createSafetyWarning(req.body, req.user?.name);
    return ApiResponse.success(res, created, undefined, 201);
  }

  async deduplicateWarnings(req: Request, res: Response) {
    const result = await hseService.deduplicateWarnings();
    return ApiResponse.success(res, result);
  }

  async clearAllWarnings(req: Request, res: Response) {
    const result = await hseService.clearAllWarnings();
    return ApiResponse.success(res, result);
  }

  // TRIR & KPI
  async getTrirRecords(req: Request, res: Response) {
    const records = await hseService.getTrirRecords();
    return ApiResponse.success(res, records);
  }

  async upsertTrir(req: Request, res: Response) {
    const result = await hseService.upsertTrirRecord(req.body);
    return ApiResponse.success(res, result);
  }

  async deleteTrir(req: Request, res: Response) {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? String(req.query.month) : undefined;
    const result = await hseService.deleteTrirRecord(req.params.id, year, month);
    return ApiResponse.success(res, result);
  }

  async clearAllTrir(req: Request, res: Response) {
    const result = await hseService.clearAllTrirRecords();
    return ApiResponse.success(res, result);
  }

  // Settings
  async getSettings(req: Request, res: Response) {
    const settings = await hseService.getSystemSettings();
    return ApiResponse.success(res, settings);
  }

  async updateSetting(req: Request, res: Response) {
    const { key, value, description } = req.body;
    await hseService.setSystemSetting(key, value, description);
    return ApiResponse.success(res, { success: true, message: 'تنظیمات با موفقیت ذخیره شد.' });
  }

  // Full Sync
  async getFullSync(req: Request, res: Response) {
    const snapshot: any = await hseService.getFullSync();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!ctx.canAccessAll && snapshot?.data) {
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
      if (Array.isArray(snapshot.data.workPermits)) {
        snapshot.data.workPermits = personnelAccessService.filterModuleRecords(ctx, snapshot.data.workPermits);
      }
    }
    return res.json(snapshot);
  }
}

export const hseController = new HSEController();

