import { personnelRepository } from './personnel.repository.ts';
import { auditService } from '../audit/audit.service.ts';
import { ValidationError, NotFoundError } from '../../core/errors.ts';
import { personnelAccessService } from '../../core/personnelAccess.service.ts';
import { cleanPersonnelCode } from '../../../src/utils/textNormalization.ts';

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
    const pCode = cleanPersonnelCode(data.personnelCode);
    const nCode = String(data.nationalCode || data.nationalId || '').trim();
    if (!data.firstName && !data.lastName && !data.fullName) {
      throw new ValidationError('نام و نام خانوادگی الزامی است.');
    }

    const lookupKey = pCode || nCode || (data.id ? String(data.id) : '');
    const existing = lookupKey ? await personnelRepository.findByIdentifier(lookupKey) : null;
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
      entityId: pCode || nCode || String(result?.id || ''),
      personnelCode: pCode || undefined,
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

    const result = await personnelRepository.batchUpsert(records);

    await auditService.log({
      action: 'BATCH_UPSERT_PERSONNEL',
      module: 'PERSONNEL',
      entityType: 'PERSONNEL',
      entityId: `batch-${Date.now()}`,
      details: { actor: actorName, count: result.count },
    }).catch(() => {});

    return result;
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

    const deleted = await personnelRepository.delete(cleanId, deleteAssociatedUser);

    if (!deleted && !existing) {
      throw new NotFoundError(`پرسنل با کد یا شناسه '${cleanId}' یافت نشد.`);
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


