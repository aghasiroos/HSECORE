import { Request, Response } from 'express';
import {
  incidentService,
  isHseHeadUser,
  isHseExpertUser,
  isAssignedActionOfficer,
} from './incident.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class IncidentController {
  async getNextNumber(req: Request, res: Response) {
    const eventDate = typeof req.query.eventDate === 'string' ? req.query.eventDate : undefined;
    const formType = req.query.formType === 'RHS-F28' ? 'RHS-F28' : 'RHS-F68';
    const nextNumber = await incidentService.getNextReportNumber(eventDate, formType);
    return ApiResponse.success(res, { reportNumber: nextNumber });
  }

  async getAllIncidents(req: Request, res: Response) {
    const allList = await incidentService.getAllIncidents();
    // HSE Head / Safety Officers / Admins see all reports for operational triage & investigation
    if (isHseHeadUser(req.user) || isHseExpertUser(req.user)) {
      return res.json({ success: true, data: allList, count: allList.length });
    }
    const ctx = await personnelAccessService.resolveAccessContext(req.user);
    const filtered = allList.filter((rec: any) => {
      // Reporter always sees their own drafts & submitted reports
      const createdByUid = String(rec?.createdByUid || rec?.incidentData?.createdByUid || '').trim();
      if (createdByUid && req.user?.uid && createdByUid === String(req.user.uid).trim()) {
        return true;
      }
      const userCode = String(req.user?.personnelCode || '').trim();
      const officerCode = String(rec?.rhsF68?.correctiveFollowUp?.responsiblePersonnelCode || '').trim();
      if (
        userCode &&
        (String(rec?.reporterPersonnelCode || '').trim() === userCode ||
          String(rec?.assignedExpertCode || '').trim() === userCode ||
          officerCode === userCode)
      ) {
        return true;
      }
      if (isAssignedActionOfficer(req.user, rec)) {
        return true;
      }
      return personnelAccessService.doesModuleRecordMatchContext(ctx, rec);
    });
    return res.json({ success: true, data: filtered, count: filtered.length });
  }

  async getIncidentByNumber(req: Request, res: Response) {
    const inc = await incidentService.getIncidentByNumber(req.params.incidentNumber);
    if (!isHseHeadUser(req.user) && !isHseExpertUser(req.user, inc) && !isAssignedActionOfficer(req.user, inc)) {
      const createdByUid = String(inc?.createdByUid || inc?.incidentData?.createdByUid || '').trim();
      const isCreator = Boolean(createdByUid && req.user?.uid && createdByUid === String(req.user.uid).trim());
      if (!isCreator) {
        const ctx = await personnelAccessService.resolveAccessContext(req.user);
        personnelAccessService.assertCanAccessRecordOrPersonnel(ctx, inc);
      }
    }
    return ApiResponse.success(res, inc);
  }

  async createIncident(req: Request, res: Response) {
    const result = await incidentService.createIncident(req.body, req.user);
    broadcastDataMutation('incidents', 'create', result);
    return ApiResponse.success(res, result, undefined, 201);
  }

  async updateIncident(req: Request, res: Response) {
    const idOrNumber = req.params.idOrNumber;
    const result = await incidentService.updateIncident(idOrNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'update', result);
    return ApiResponse.success(res, result);
  }

  async hseHeadTriage(req: Request, res: Response) {
    const result = await incidentService.hseHeadTriage(req.params.idOrNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'workflow_triage', result);
    return ApiResponse.success(res, result);
  }

  async hseExpertInvestigate(req: Request, res: Response) {
    const result = await incidentService.hseExpertInvestigate(req.params.idOrNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'workflow_investigate', result);
    return ApiResponse.success(res, result);
  }

  async hseHeadFinalApprove(req: Request, res: Response) {
    const result = await incidentService.hseHeadFinalApprove(req.params.idOrNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'workflow_final_approve', result);
    return ApiResponse.success(res, result);
  }

  async saveRhsF34(req: Request, res: Response) {
    const result = await incidentService.saveRhsF34(req.params.idOrNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'rhs_f34_update', result);
    return ApiResponse.success(res, result);
  }

  async reviewRhsF34(req: Request, res: Response) {
    const result = await incidentService.reviewRhsF34(req.params.idOrNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'rhs_f34_review', result);
    return ApiResponse.success(res, result);
  }

  async updateRhsF34NonConformance(req: Request, res: Response) {
    const result = await incidentService.updateRhsF34NonConformance(req.params.idOrNumber, req.body, req.user);
    broadcastDataMutation('incidents', 'rhs_f34_nc_update', result.incident);
    broadcastDataMutation('non_conformances', 'update', result.nonConformance);
    return ApiResponse.success(res, result);
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
