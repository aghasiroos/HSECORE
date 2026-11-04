import crypto from 'crypto';
import { ptwRepository } from './ptw.repository.ts';
import { PTWCreateRequest } from './ptw.types.ts';
import { workflowService } from '../workflow/workflow.service.ts';
import { auditService } from '../audit/audit.service.ts';
import { ValidationError, NotFoundError } from '../../core/errors.ts';
import { UserContext } from '../../core/middleware/auth.ts';

import { generateNextPermitNumber } from '../../services/permitNumberService.ts';
import { dispatchDomainWebhookEvent } from '../../services/webhookDispatcher.ts';
import { validateHotWorkHolidayIssuance } from '../../services/ptwHolidayService.ts';

export class PTWService {
  async checkClashes(location: string, startDateStr: string, endDateStr: string, excludePermitNumber?: string) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('تاریخ و زمان شروع یا پایان مجوز نامعتبر است.');
    }

    if (end <= start) {
      throw new ValidationError('زمان پایان مجوز باید بعد از زمان شروع باشد.');
    }

    const conflicting = await ptwRepository.findActivePermitsAtLocation(location, start, end, excludePermitNumber);

    return {
      hasClash: conflicting.length > 0,
      clashesCount: conflicting.length,
      conflicts: conflicting.map((c: any) => ({
        permitNumber: c.permitNumber,
        title: c.title,
        permitType: c.permitType,
        location: c.location,
        startDate: c.startDate,
        endDate: c.endDate,
        applicant: c.applicantName,
      })),
    };
  }

  async createPermit(req: PTWCreateRequest, user?: UserContext) {
    if (!req.title || !req.location || !req.startDate || !req.endDate) {
      throw new ValidationError('عنوان، موقعیت مکانی، تاریخ شروع و تاریخ پایان مجوز الزامی هستند.');
    }

    // Hot Work Holiday and Senior Duty Officer validation
    const holidayVal = await validateHotWorkHolidayIssuance(req, user);
    if (!holidayVal.allowed) {
      throw new ValidationError(holidayVal.errorMessage || holidayVal.warningMessage || 'صدور پروانه کار گرم در روز تعطیل مجاز نمی‌باشد.');
    }

    // Clash detection check
    const clashResult = await this.checkClashes(req.location, req.startDate, req.endDate);

    const genResult = await generateNextPermitNumber({
      permitType: req.permitType,
      issueDate: req.startDate
    });
    const permitNumber = genResult.permitNumber;
    const applicantName = req.applicantName || user?.name || 'متقاضی مجوز';

    const permitRecord = await ptwRepository.create({
      permitNumber,
      title: req.title,
      permitType: req.permitType || 'HOT_WORK',
      status: 'PENDING_APPROVAL',
      companyId: req.companyId,
      departmentId: req.departmentId,
      unitId: req.unitId,
      location: req.location,
      applicantName,
      startDate: req.startDate,
      endDate: req.endDate,
      hazards: req.hazards || [],
      precautions: req.precautions || [],
      gasTests: req.gasTests || [],
      permitData: {
        ...req.permitData,
        contractorName: req.contractorName,
        requiredPPE: req.requiredPPE,
        authorizedGasTester: req.authorizedGasTester,
        isolationRequired: req.isolationRequired,
        isolationDetails: req.isolationDetails,
        weatherRestrictions: req.weatherRestrictions,
        clashWarning: clashResult.hasClash ? clashResult.conflicts : null,
      },
    });

    // Auto-create associated Workflow Instance
    const workflow = await workflowService.createInstance(
      {
        workflowKey: 'PTW_STANDARD_APPROVAL',
        entityType: 'WORK_PERMIT',
        entityId: permitNumber,
        entityNumber: permitNumber,
        title: `فرآیند صدور و تایید مجوز کار: ${req.title}`,
        priority: req.permitType === 'HOT_WORK' ? 'HIGH' : 'NORMAL',
        requesterName: applicantName,
        requesterPersonnelCode: req.applicantPersonnelCode || user?.personnelCode,
        deadline: req.startDate,
        metadata: {
          permitType: req.permitType,
          location: req.location,
          clashesCount: clashResult.clashesCount,
        },
        steps: [
          {
            stepOrder: 1,
            stepName: 'تایید سرپرست اجرایی / مسئول محوطه',
            stepType: 'APPROVE',
            assignedRole: 'AREA_AUTHORITY',
            deadlineHours: 6,
          },
          {
            stepOrder: 2,
            stepName: 'بررسی افسر ایمنی و تست گاز اتمسفر',
            stepType: 'APPROVE_SIGN',
            assignedRole: 'SAFETY_OFFICER',
            deadlineHours: 4,
          },
          {
            stepOrder: 3,
            stepName: 'تایید و امضای نهایی صدور پروانه (مدیر HSE)',
            stepType: 'APPROVE_SIGN',
            assignedRole: 'HSE_MANAGER',
            deadlineHours: 8,
          },
        ],
      },
      user
    );

    await auditService.log({
      action: 'CREATE_PERMIT',
      module: 'PTW',
      entityType: 'WORK_PERMIT',
      entityId: permitNumber,
      newValue: { permitNumber, title: req.title, location: req.location },
    });

    void dispatchDomainWebhookEvent({
      eventType: 'permit.status_adjusted',
      moduleName: 'ptw_management',
      correlationKey: permitNumber,
      idempotencyKey: `idem_permit_${permitNumber}_NEW_to_PENDING_APPROVAL`,
      triggeredBy: user?.username || applicantName,
      data: {
        permitNumber,
        permitType: req.permitType || 'HOT_WORK',
        title: req.title,
        location: req.location,
        previousStatus: 'CREATED',
        currentStatus: 'PENDING_APPROVAL',
        validFrom: req.startDate,
        validTo: req.endDate,
        contractorName: req.contractorName,
        clashesCount: clashResult.clashesCount,
      },
    });

    return {
      permit: permitRecord,
      workflowId: workflow.id,
      clashWarning: clashResult.hasClash ? clashResult : null,
    };
  }

  async getAllPermits() {
    await this.autoExpirePermits();
    return await ptwRepository.findAll();
  }

  async getPermitByNumber(permitNumber: string) {
    await this.autoExpirePermits();
    const p = await ptwRepository.findByNumber(permitNumber);
    if (!p) {
      throw new NotFoundError(`مجوز کار با شماره '${permitNumber}' یافت نشد.`);
    }

    // Attach active workflow info if present
    const workflow = await workflowService.getInstanceByEntity('WORK_PERMIT', permitNumber);

    return {
      ...p,
      workflow,
    };
  }

  /**
   * Automatically expires permits that reached their end date and are not closed
   */
  async autoExpirePermits() {
    const all = await ptwRepository.findAll();
    const now = new Date().getTime();

    for (const p of all) {
      if (!p.isClosed && p.status !== 'EXPIRED' && p.status !== 'REJECTED' && p.status !== 'CANCELLED') {
        const end = new Date(p.endDate).getTime();
        if (end < now) {
          const previousStatus = p.status;
          await ptwRepository.updateStatus(p.permitNumber, 'EXPIRED', true);
          await auditService.log({
            action: 'AUTO_EXPIRE_PERMIT',
            module: 'PTW',
            entityType: 'WORK_PERMIT',
            entityId: p.permitNumber,
            details: { reason: 'Permit end date reached' },
          });
          void dispatchDomainWebhookEvent({
            eventType: 'permit.status_adjusted',
            moduleName: 'ptw_management',
            correlationKey: p.permitNumber,
            idempotencyKey: `idem_permit_${p.permitNumber}_${previousStatus}_to_EXPIRED`,
            triggeredBy: 'sla_auto_expiration_engine',
            data: {
              permitNumber: p.permitNumber,
              permitType: p.permitType,
              title: p.title,
              location: p.location,
              previousStatus,
              currentStatus: 'EXPIRED',
              validTo: p.endDate,
            },
          });
        }
      }
    }
  }

  async getA4PrintablePermit(permitNumber: string) {
    const permit = await this.getPermitByNumber(permitNumber);
    const verification = permit.workflow
      ? await workflowService.getA4PrintableVerification(permit.workflow.id)
      : null;

    return {
      permit,
      verification,
      printMetadata: {
        paperSize: 'A4',
        orientation: 'portrait',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async deletePermit(idOrNumber: string | number) {
    return await ptwRepository.delete(idOrNumber);
  }
}

export const ptwService = new PTWService();
