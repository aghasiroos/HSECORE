import { auditRepository } from './audit.repository.ts';
import { AuditLogEntry } from './audit.types.ts';
import { Request } from 'express';
import { getClientIp } from '../../core/ip.ts';

export class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    await auditRepository.create(entry);
  }

  async logFromRequest(req: Request, params: {
    action: string;
    module: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
    details?: any;
    result?: 'SUCCESS' | 'FAILED' | 'WARNING';
    ipAddress?: string;
  }): Promise<void> {
    const ip = params.ipAddress || getClientIp(req);
    const userAgent = req.headers['user-agent'] as string || '';
    const user = req.user;

    await this.log({
      userId: user?.id,
      userUid: user?.uid || (req.headers['x-user-id'] as string),
      personnelCode: user?.personnelCode || (req.headers['x-personnel-code'] as string),
      action: params.action,
      module: params.module,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: params.oldValue,
      newValue: params.newValue,
      details: params.details,
      ipAddress: ip,
      userAgent,
      result: params.result || 'SUCCESS',
    });
  }

  async getRecentLogs(limit: number = 200): Promise<AuditLogEntry[]> {
    return await auditRepository.findRecent(limit);
  }
}

export const auditService = new AuditService();
