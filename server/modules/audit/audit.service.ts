import { auditRepository, sanitizeAuditPayload } from './audit.repository.ts';
import { AuditLogEntry, AuditLogFilterQuery, PaginatedAuditResult } from './audit.types.ts';
import { Request } from 'express';
import { getClientIp } from '../../core/ip.ts';

export { sanitizeAuditPayload };

export class AuditService {
  async log(entry: AuditLogEntry): Promise<void> {
    await auditRepository.create(entry);
  }

  async logFromRequest(
    req: Request,
    params: {
      action: string;
      module: string;
      entityType: string;
      entityId?: string | number;
      oldValue?: any;
      newValue?: any;
      details?: any;
      reason?: string;
      result?: 'SUCCESS' | 'FAILED' | 'WARNING';
      ipAddress?: string;
    }
  ): Promise<void> {
    const ip = params.ipAddress || getClientIp(req);
    const userAgent = (req.headers['user-agent'] as string) || '';
    const user = req.user;

    const baseDetails =
      params.details && typeof params.details === 'object' ? { ...params.details } : {};

    const enrichedDetails = {
      ...baseDetails,
      actorName: baseDetails.actorName || user?.name || user?.username || undefined,
      username: baseDetails.username || user?.username || undefined,
      userRole: baseDetails.userRole || baseDetails.actorRole || user?.role || undefined,
      personnelCode: baseDetails.personnelCode || user?.personnelCode || undefined,
      httpMethod: baseDetails.httpMethod || req.method,
      endpoint: baseDetails.endpoint || req.originalUrl,
      ...(params.reason ? { reason: params.reason } : {}),
    };

    await this.log({
      userId: user?.id,
      userUid: user?.uid || user?.username || 'system',
      personnelCode: user?.personnelCode || undefined,
      username: user?.username,
      fullName: user?.name,
      userRole: user?.role,
      action: params.action,
      module: params.module || 'SYSTEM',
      entityType: params.entityType || 'SYSTEM',
      entityId: params.entityId !== undefined && params.entityId !== null ? String(params.entityId) : undefined,
      oldValue: params.oldValue,
      newValue: params.newValue,
      details: enrichedDetails,
      ipAddress: ip,
      userAgent,
      result: params.result || 'SUCCESS',
    });
  }

  async logAccessDenied(req: Request, reason: string, permission?: string): Promise<void> {
    try {
      await this.logFromRequest(req, {
        action: 'ACCESS_DENIED',
        module: 'AUTH',
        entityType: 'PERMISSION_GUARD',
        entityId: req.originalUrl,
        result: 'FAILED',
        reason,
        details: {
          actionTitle: `عدم دسترسی به مسیر ${req.method} ${req.originalUrl}`,
          actionType: 'PERMISSIONS_CHANGE',
          description: reason,
          requiredPermission: permission,
          statusCode: 403,
        },
      });
    } catch {
      // Never block request lifecycle due to audit logging
    }
  }

  async getRecentLogs(limit: number = 200): Promise<AuditLogEntry[]> {
    return await auditRepository.findRecent(limit);
  }

  async getLogsPaginated(query: AuditLogFilterQuery): Promise<PaginatedAuditResult> {
    return await auditRepository.findPaginated(query);
  }
}

export const auditService = new AuditService();
