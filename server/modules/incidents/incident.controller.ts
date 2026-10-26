import { Request, Response } from 'express';
import { incidentService } from './incident.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class IncidentController {
  async getAllIncidents(req: Request, res: Response) {
    const allList = await incidentService.getAllIncidents();
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const list = personnelAccessService.filterModuleRecords(ctx, allList);
    return res.json({ success: true, data: list, count: list.length });
  }

  async getIncidentByNumber(req: Request, res: Response) {
    const inc = await incidentService.getIncidentByNumber(req.params.incidentNumber);
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, inc);
    return ApiResponse.success(res, inc);
  }

  async createIncident(req: Request, res: Response) {
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    if (!ctx.canAccessAll && (req.body?.personnelCode || req.body?.involvedPersonnelId || req.body?.personnelName)) {
      personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, req.body);
    }
    const result = await incidentService.createIncident(req.body, req.user);
    broadcastDataMutation('incidents', 'create', result);
    return ApiResponse.success(res, result, undefined, 201);
  }

  async addCAPA(req: Request, res: Response) {
    const capa = await incidentService.addCAPAAction(req.params.incidentNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'update_capa', capa);
    return ApiResponse.success(res, capa);
  }

  async getA4PrintableReport(req: Request, res: Response) {
    const printable = await incidentService.getA4PrintableReport(req.params.incidentNumber);
    return ApiResponse.success(res, printable);
  }

  async deleteIncident(req: Request, res: Response) {
    const targetId = req.params.id || req.params.incidentNumber;
    const result = await incidentService.deleteIncident(targetId, req.user);
    broadcastDataMutation('incidents', 'delete', { id: targetId });
    return ApiResponse.success(res, result);
  }
}

export const incidentController = new IncidentController();

