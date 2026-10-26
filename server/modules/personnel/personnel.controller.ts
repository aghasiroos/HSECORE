import { Request, Response } from 'express';
import { personnelService } from './personnel.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class PersonnelController {
  async getHierarchy(req: Request, res: Response) {
    const data = await personnelService.getHierarchy();
    return ApiResponse.success(res, data);
  }

  async seedHierarchy(req: Request, res: Response) {
    const result = await personnelService.seedHierarchy(req.body);
    broadcastDataMutation('personnel_hierarchy', 'seed', result);
    return ApiResponse.success(res, result);
  }

  async getAllPersonnel(req: Request, res: Response) {
    const allList = await personnelService.getAllPersonnel();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = personnelAccessService.filterPersonnelList(ctx, allList);
    return res.json({ success: true, data: list, count: list.length });
  }

  async getByIdentifier(req: Request, res: Response) {
    const p = await personnelService.getByIdentifier(req.params.identifier);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, p);
    return ApiResponse.success(res, p);
  }

  async upsertPersonnel(req: Request, res: Response) {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!ctx.canAccessAll) {
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, req.body);
    }
    const record = await personnelService.upsertPersonnel(req.body, req.user?.name);
    broadcastDataMutation('personnel', 'upsert', record);
    return ApiResponse.success(res, record);
  }

  async batchUpsert(req: Request, res: Response) {
    const records = Array.isArray(req.body) ? req.body : req.body.records;
    const result = await personnelService.batchUpsert(records || [], req.user?.name);
    broadcastDataMutation('personnel', 'batch', result);
    return ApiResponse.success(res, result);
  }

  async deletePersonnel(req: Request, res: Response) {
    const identifier = req.params.identifier;
    const deleteUser = req.query.deleteUser === 'true' || req.body?.deleteUser === true;
    const deleted = await personnelService.deletePersonnel(identifier, req.user?.name, deleteUser);
    broadcastDataMutation('personnel', 'delete', { identifier, deleted });
    return ApiResponse.success(res, { deleted: true, record: deleted });
  }
}

export const personnelController = new PersonnelController();

