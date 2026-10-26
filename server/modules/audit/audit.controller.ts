import { Request, Response } from 'express';
import { auditService } from './audit.service.ts';
import { ApiResponse } from '../../core/response.ts';

export class AuditController {
  async getLogs(req: Request, res: Response) {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
    const logs = await auditService.getRecentLogs(limit);
    return ApiResponse.success(res, logs, { total: logs.length, limit });
  }

  async createLog(req: Request, res: Response) {
    await auditService.logFromRequest(req, req.body);
    return ApiResponse.success(res, { message: 'گزارش ممیزی با موفقیت ثبت شد' });
  }
}

export const auditController = new AuditController();
