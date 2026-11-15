import { Request, Response } from 'express';
import { auditService } from './audit.service.ts';
import { ApiResponse } from '../../core/response.ts';

export class AuditController {
  async getLogs(req: Request, res: Response) {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 200;
    const result = await auditService.getLogsPaginated({
      page,
      limit,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      module: typeof req.query.module === 'string' ? req.query.module : undefined,
      actionType: typeof req.query.actionType === 'string' ? req.query.actionType : undefined,
      result: typeof req.query.result === 'string' ? req.query.result : undefined,
      user: typeof req.query.user === 'string' ? req.query.user : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
    });

    return ApiResponse.success(res, result.rows, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  }

  async createLog(req: Request, res: Response) {
    const body = req.body || {};
    await auditService.logFromRequest(req, {
      action: String(body.action || 'OTHER'),
      module: String(body.module || 'SYSTEM'),
      entityType: String(body.entityType || body.module || 'SYSTEM'),
      entityId: body.entityId,
      oldValue: body.oldValue,
      newValue: body.newValue,
      details: body.details,
      reason: body.reason,
      result: body.result === 'FAILED' ? 'FAILED' : body.result === 'WARNING' ? 'WARNING' : 'SUCCESS',
    });
    return ApiResponse.success(res, { message: 'گزارش ممیزی با موفقیت ثبت شد' });
  }
}

export const auditController = new AuditController();
