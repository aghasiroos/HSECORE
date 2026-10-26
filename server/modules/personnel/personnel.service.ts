import { personnelRepository } from './personnel.repository.ts';
import { auditService } from '../audit/audit.service.ts';
import { ValidationError, NotFoundError } from '../../core/errors.ts';
import { db, schema } from '../../core/db.ts';
import { sql } from 'drizzle-orm';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';

export class PersonnelService {
  async getHierarchy() {
    return await personnelRepository.getHierarchy();
  }

  async seedHierarchy(data: any) {
    return await personnelRepository.seedHierarchy(data);
  }

  async getAllPersonnel() {
    return await personnelRepository.findAll();
  }

  async getByIdentifier(identifier: string) {
    const p = await personnelRepository.findByIdentifier(identifier);
    if (!p) {
      throw new NotFoundError(`پرسنل با کد پرسنلی یا کد ملی '${identifier}' یافت نشد.`);
    }
    return p;
  }

  async upsertPersonnel(data: any, actorName?: string) {
    const pCode = String(data.personnelCode || '').trim();
    if (!pCode) {
      throw new ValidationError('کد پرسنلی برای ثبت پرسنل الزامی است.');
    }
    if (!data.firstName || !data.lastName) {
      throw new ValidationError('نام و نام خانوادگی الزامی است.');
    }
    if (!data.nationalCode) {
      data.nationalCode = data.nationalId || pCode;
    }

    const existing = await personnelRepository.findByIdentifier(pCode);
    const result = await personnelRepository.upsert(data);

    // If personnel was deactivated, automatically manage/revoke active user assignments
    const statusNorm = String(result?.status || data.status || 'ACTIVE').trim().toUpperCase();
    const extraStatusNorm = String(result?.extraData?.status || data?.extraData?.status || '').trim().toLowerCase();
    if (
      result?.id &&
      (statusNorm === 'INACTIVE' ||
        statusNorm === 'DISABLED' ||
        statusNorm === 'غیرفعال' ||
        extraStatusNorm === 'inactive' ||
        extraStatusNorm === 'غیرفعال')
    ) {
      await personnelAccessService.handlePersonnelLifecycleChange(result.id, 'DEACTIVATED', {
        fullName: actorName,
      });
    }

    await auditService.log({
      action: existing ? 'UPDATE_PERSONNEL' : 'CREATE_PERSONNEL',
      module: 'PERSONNEL',
      entityType: 'PERSONNEL',
      entityId: pCode,
      personnelCode: pCode,
      oldValue: existing,
      newValue: result,
      details: { actor: actorName },
    });

    return result;
  }

  async batchUpsert(records: any[], actorName?: string) {
    if (!Array.isArray(records)) {
      throw new ValidationError('داده‌های ارسالی باید به صورت آرایه باشند.');
    }

    const results = [];
    for (const r of records) {
      if (!r.personnelCode && !r.nationalCode) continue;
      if (!r.personnelCode) r.personnelCode = r.nationalCode;
      const res = await this.upsertPersonnel(r, actorName);
      results.push(res);
    }

    return { count: results.length, success: true };
  }

  async deletePersonnel(identifier: string, actorName?: string, deleteAssociatedUser = false) {
    const cleanId = String(identifier || '').trim();
    if (!cleanId) {
      throw new ValidationError('مشخصه پرسنل برای حذف الزامی است.');
    }

    const existing = await personnelRepository.findByIdentifier(cleanId);
    if (existing?.id) {
      await personnelAccessService.handlePersonnelLifecycleChange(existing.id, 'DELETED', {
        fullName: actorName,
      });
    }

    const deleted = await personnelRepository.delete(cleanId);

    if (!deleted && !existing) {
      throw new NotFoundError(`پرسنل با کد یا شناسه '${cleanId}' یافت نشد.`);
    }

    // If requested, also remove/deactivate the associated user in users table
    if (deleteAssociatedUser && (existing || deleted)) {
      const pCode = existing?.personnelCode || (deleted as any)?.personnelCode;
      const nId = existing?.nationalCode || (deleted as any)?.nationalCode;
      try {
        await db.delete(schema.users).where(
          sql`(${schema.users.personnelNumber} = ${pCode} OR (${nId} <> '' AND ${schema.users.nationalId} = ${nId})) AND ${schema.users.role} NOT IN ('ADMIN', 'ADMINISTRATOR', 'Administrator')`
        );
      } catch (err) {
        console.warn('[PersonnelService] Associated user deletion note:', err);
      }
    }

    await auditService.log({
      action: 'DELETE_PERSONNEL',
      module: 'PERSONNEL',
      entityType: 'PERSONNEL',
      entityId: cleanId,
      personnelCode: existing?.personnelCode || cleanId,
      oldValue: existing,
      details: { actor: actorName, deleteAssociatedUser, success: true },
    });

    return deleted || existing;
  }
}

export const personnelService = new PersonnelService();

