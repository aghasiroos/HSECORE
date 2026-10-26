import { Request, Response } from 'express';
import { ptwService } from './ptw.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class PTWController {
  async getAllPermits(req: Request, res: Response) {
    const allPermits = await ptwService.getAllPermits();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const permits = personnelAccessService.filterModuleRecords(ctx, allPermits);
    return res.json({ success: true, data: permits, count: permits.length });
  }

  async getPermitByNumber(req: Request, res: Response) {
    const permit = await ptwService.getPermitByNumber(req.params.permitNumber);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, permit);
    return ApiResponse.success(res, permit);
  }

  async createPermit(req: Request, res: Response) {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (
      !ctx.canAccessAll &&
      (req.body?.requesterCode ||
        req.body?.acceptorCode ||
        req.body?.personnelCode ||
        req.body?.formData?.requesterCode ||
        req.body?.formData?.acceptorCode)
    ) {
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, req.body);
    }
    const result = await ptwService.createPermit(req.body, req.user);
    broadcastDataMutation('permits', 'upsert', result);
    return ApiResponse.success(res, result, undefined, 201);
  }

  async checkClashes(req: Request, res: Response) {
    const { location, startDate, endDate, excludePermitNumber } = req.body;
    const clashResult = await ptwService.checkClashes(location, startDate, endDate, excludePermitNumber);
    return ApiResponse.success(res, clashResult);
  }

  async getA4PrintablePermit(req: Request, res: Response) {
    const printable = await ptwService.getA4PrintablePermit(req.params.permitNumber);
    return ApiResponse.success(res, printable);
  }

  async deletePermit(req: Request, res: Response) {
    const permitNumber = req.params.permitNumber || req.params.id;
    if (!permitNumber) {
      return res.status(400).json({ success: false, error: 'شناسه یا شماره پروانه الزامی است.' });
    }
    await ptwService.deletePermit(permitNumber);
    broadcastDataMutation('permits', 'delete', { permitNumber });
    return res.json({ success: true, message: 'پروانه کار با موفقیت حذف شد.' });
  }
}

export const ptwController = new PTWController();

