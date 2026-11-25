import { incidentRepository } from './incident.repository.ts';
import { CAPAItem, RhsF68RiskLevel, RhsF68WorkflowStage } from './incident.types.ts';
import { workflowService } from '../workflow/workflow.service.ts';
import { auditService } from '../audit/audit.service.ts';
import { fileService } from '../files/file.service.ts';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../core/errors.ts';
import {
  UserContext,
  checkUserHasPermission,
  normalizeRoleToCanonical,
} from '../../core/middleware/auth.ts';
import { dispatchDomainWebhookEvent } from '../../services/webhookDispatcher.ts';
import { notificationService } from '../notifications/notification.service.ts';
import {
  buildAutoRhsF34FromF28,
  computeRhsF34Deadline,
  getCurrentJalaliDateServer,
  getCurrentJalaliDateTimeServer,
  syncRhsF34DeadlineAndAutoNc,
  updateLinkedRhsF34NonConformance,
} from './rhsF34.helper.ts';

function normalizeStr(v: any): string {
  return typeof v === 'string' ? v.trim() : '';
}

function getCurrentJalaliYear(): string {
  try {
    const formatted = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date());
    const en = formatted.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    const cleaned = en.replace(/[^0-9]/g, '').slice(0, 4);
    return cleaned.length === 4 ? cleaned : '1405';
  } catch {
    return '1405';
  }
}

export function computeServerRhsF68Rpn(
  probabilityInput: any,
  severityInput: any,
  detectionInput: any
): {
  probability: number;
  severity: number;
  detection: number;
  rpn: number;
  riskLevel: RhsF68RiskLevel;
  riskLevelFa: string;
  riskLevelColor: 'green' | 'yellow' | 'orange' | 'red';
} {
  const clamp = (val: any) => {
    const n = Math.round(Number(val));
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(5, n));
  };

  const probability = clamp(probabilityInput);
  const severity = clamp(severityInput);
  const detection = clamp(detectionInput);
  const rpn = probability * severity * detection;

  if (rpn >= 50) {
    return {
      probability,
      severity,
      detection,
      rpn,
      riskLevel: 'E',
      riskLevelFa: 'شدید / بارز (E)',
      riskLevelColor: 'red',
    };
  }
  if (rpn >= 25) {
    return {
      probability,
      severity,
      detection,
      rpn,
      riskLevel: 'H',
      riskLevelFa: 'بالا (H)',
      riskLevelColor: 'orange',
    };
  }
  if (rpn >= 11) {
    return {
      probability,
      severity,
      detection,
      rpn,
      riskLevel: 'M',
      riskLevelFa: 'متوسط (M)',
      riskLevelColor: 'yellow',
    };
  }
  return {
    probability,
    severity,
    detection,
    rpn,
    riskLevel: 'L',
    riskLevelFa: 'پایین (L)',
    riskLevelColor: 'green',
  };
}

function buildAuditEntry(
  user: UserContext | undefined,
  action: string,
  fromStage?: string,
  toStage?: string,
  details?: string,
  referralMeta?: {
    referredToName?: string;
    referredToCode?: string;
    referralNote?: string;
  }
) {
  return {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    jalaliDateTime: new Date().toLocaleString('fa-IR'),
    actorName: user?.name || user?.username || 'کاربر سامانه',
    actorUsername: user?.username,
    actorRole: user?.role,
    actorPersonnelCode: user?.personnelCode,
    action,
    fromStage,
    toStage,
    details,
    ...(referralMeta?.referredToName ? { referredToName: referralMeta.referredToName } : {}),
    ...(referralMeta?.referredToCode ? { referredToCode: referralMeta.referredToCode } : {}),
    ...(referralMeta?.referralNote ? { referralNote: referralMeta.referralNote } : {}),
  };
}

async function notifyRhsF68StageAssignee(params: {
  incidentNumber: string;
  title: string;
  categoryFa?: string;
  targetRole: 'HSE_HEAD' | 'HSE_EXPERT' | 'ACTION_OFFICER' | 'REPORTER' | 'CLOSED_PARTIES';
  targetNames?: string[];
  targetCodes?: string[];
  senderName: string;
  notifTitle: string;
  notifBody: string;
  category?: 'info' | 'warning' | 'success' | 'error';
  priority?: 'low' | 'medium' | 'high';
  stage?: string;
}) {
  try {
    const cleanValues = Array.from(
      new Set([...(params.targetCodes || []), ...(params.targetNames || [])].map((v) => normalizeStr(v)).filter(Boolean))
    );

    let targetType: 'users' | 'roles' | 'hse_experts' = 'roles';
    let targetValues: string[] = [];

    if (params.targetRole === 'HSE_HEAD') {
      targetType = 'roles';
      targetValues = ['HSE_MANAGER', 'EXECUTIVE_MANAGER', 'ADMIN', 'ADMINISTRATOR'];
    } else if (params.targetRole === 'HSE_EXPERT') {
      if (cleanValues.length > 0) {
        targetType = 'users';
        targetValues = cleanValues;
      } else {
        targetType = 'hse_experts';
        targetValues = [];
      }
    } else if (params.targetRole === 'ACTION_OFFICER') {
      if (cleanValues.length > 0) {
        targetType = 'users';
        targetValues = cleanValues;
      } else {
        targetType = 'hse_experts';
        targetValues = [];
      }
    } else if (params.targetRole === 'REPORTER' || params.targetRole === 'CLOSED_PARTIES') {
      if (cleanValues.length > 0) {
        targetType = 'users';
        targetValues = cleanValues;
      } else {
        targetType = 'roles';
        targetValues = ['HSE_MANAGER', 'ADMIN'];
      }
    }

    await notificationService.send({
      title: params.notifTitle,
      body: params.notifBody,
      type: 'popup',
      category: params.category || 'warning',
      priority: params.priority || 'high',
      sourceModule: 'incidents',
      entityType: 'INCIDENT',
      entityId: params.incidentNumber,
      recordId: params.incidentNumber,
      actionUrl: `#incidents?report=${encodeURIComponent(params.incidentNumber)}`,
      targetType,
      targetValues,
      sender: params.senderName || 'سامانه HSECORE',
      metadata: {
        reportNumber: params.incidentNumber,
        workflowStage: params.stage,
        categoryFa: params.categoryFa,
      },
    });
  } catch {
    // Notification delivery must not fail core incident persistence
  }
}

function normalizeRhsCategory(rawCategory?: string, rawIncidentType?: string): {
  category: string;
  categoryFa: string;
  incidentType: string;
} {
  const val = String(rawCategory || rawIncidentType || '').trim();
  const upper = val.toUpperCase().replace(/\s+/g, '_');

  if (upper === 'UNSAFE_ACT' || val === 'Unsafe Act' || val.includes('رفتار ناایمن') || val.includes('عمل ناایمن')) {
    return { category: 'Unsafe Act', categoryFa: 'رفتار ناایمن', incidentType: 'UNSAFE_ACT' };
  }
  if (upper === 'UNSAFE_CONDITION' || val === 'Unsafe Condition' || val.includes('شرایط ناایمن')) {
    return { category: 'Unsafe Condition', categoryFa: 'شرایط ناایمن', incidentType: 'UNSAFE_CONDITION' };
  }
  if (upper === 'NEAR_MISS' || val === 'Near Miss' || val.includes('شبه حادثه') || val.includes('شبه‌حادثه')) {
    return { category: 'Near Miss', categoryFa: 'شبه حادثه', incidentType: 'NEAR_MISS' };
  }
  if (upper === 'TOXIC_GAS_LEAK' || val === 'Toxic Gas Leak' || val.includes('نشت گاز')) {
    return { category: 'Toxic Gas Leak', categoryFa: 'نشت گازهای سمی', incidentType: 'TOXIC_GAS_LEAK' };
  }
  return { category: 'Incident', categoryFa: 'حادثه', incidentType: upper || 'INCIDENT' };
}

export function isHseHeadUser(user?: UserContext): boolean {
  if (!user) return false;
  const canonical = normalizeRoleToCanonical(user.role);
  if (['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'EXECUTIVE_MANAGER', 'EXECUTIVEMANAGER'].includes(canonical)) {
    return true;
  }
  return checkUserHasPermission(user, 'incidents:approve') || checkUserHasPermission(user, 'incidents:*');
}

export function isHseExpertUser(user?: UserContext, existingRecord?: any): boolean {
  if (!user) return false;
  if (isHseHeadUser(user)) return true;
  const canonical = normalizeRoleToCanonical(user.role);
  if (['SAFETY_OFFICER', 'SAFETY_INSPECTOR', 'SAFETYINSPECTOR', 'FIRE_OFFICER'].includes(canonical)) {
    return true;
  }
  const assignedCode = normalizeStr(
    existingRecord?.rhsF68?.hseUnitReview?.assignedExpertCode ||
      existingRecord?.supplementaryForm?.assignedExpertCode ||
      existingRecord?.incidentData?.supplementaryForm?.assignedExpertCode
  );
  const assignedName = normalizeStr(
    existingRecord?.rhsF68?.hseUnitReview?.assignedExpertName ||
      existingRecord?.supplementaryForm?.assignedExpertName ||
      existingRecord?.incidentData?.supplementaryForm?.assignedExpertName
  );
  if (assignedCode && user.personnelCode && normalizeStr(user.personnelCode) === assignedCode) {
    return true;
  }
  if (assignedName && (normalizeStr(user.name) === assignedName || normalizeStr(user.username) === assignedName)) {
    return true;
  }
  return false;
}

export function isAssignedActionOfficer(user?: UserContext, existingRecord?: any): boolean {
  if (!user || !existingRecord) return false;
  if (isHseExpertUser(user, existingRecord)) return true;
  const fu = existingRecord?.rhsF68?.correctiveFollowUp || {};
  const officerCode = normalizeStr(fu.responsiblePersonnelCode);
  const officerName = normalizeStr(fu.responsiblePerson);
  if (officerCode && user.personnelCode && officerCode === normalizeStr(user.personnelCode)) {
    return true;
  }
  if (officerName && (normalizeStr(user.name) === officerName || normalizeStr(user.username) === officerName)) {
    return true;
  }
  return false;
}

function isReporterOwner(user: UserContext | undefined, existingRecord: any): boolean {
  if (!user || !existingRecord) return false;
  const createdByUid = normalizeStr(existingRecord?.incidentData?.createdByUid || existingRecord?.createdByUid);
  if (createdByUid && user.uid && createdByUid === normalizeStr(user.uid)) return true;
  const recCode = normalizeStr(existingRecord?.reporterPersonnelCode);
  if (recCode && user.personnelCode && recCode === normalizeStr(user.personnelCode)) return true;
  return false;
}

export class IncidentService {
  async getNextReportNumber(
    eventDate?: string,
    formType: 'RHS-F68' | 'RHS-F28' = 'RHS-F68'
  ): Promise<string> {
    let year = getCurrentJalaliYear();
    if (eventDate && typeof eventDate === 'string') {
      const m = eventDate.match(/^(1[34]\d{2})/);
      if (m) year = m[1];
    }
    return incidentRepository.generateNextReportNumber(year, formType);
  }

  async createIncident(req: any, user?: UserContext) {
    const isDraft = Boolean(req.isDraft);
    const isRhsF28 = req.formVariant === 'RHS-F28' || Boolean(req.rhsF28);

    if (isRhsF28) {
      const rawF28 = req.rhsF28 && typeof req.rhsF28 === 'object' ? req.rhsF28 : {};
      const reportDate = normalizeStr(req.reportDate || rawF28.reportDate) || new Date().toLocaleDateString('fa-IR');
      const observationDate =
        normalizeStr(req.incidentDate || req.eventDate || rawF28.observationDate) ||
        new Date().toLocaleDateString('fa-IR');
      const observationTime = normalizeStr(req.incidentTime || req.eventTime || rawF28.observationTime) || '10:00';
      const locationSite =
        normalizeStr(req.location || req.locationSite || rawF28.locationSite || req.department || rawF28.department) ||
        (isDraft ? 'محوطه کارخانه' : '');
      const department = normalizeStr(req.department || rawF28.department);
      const exactLocation = normalizeStr(req.exactLocation || rawF28.exactLocation);
      const description = normalizeStr(req.description || rawF28.description);
      const damagesOrInjuries = normalizeStr(rawF28.damagesOrInjuries);
      const actionsTaken = normalizeStr(rawF28.actionsTaken || req.immediateActions || req.immediateActionTaken);
      const recommendations = normalizeStr(rawF28.recommendations);
      const otherNotes = normalizeStr(rawF28.otherNotes);
      const reporterName =
        normalizeStr(req.reporterName || rawF28.reporterName) || user?.name || user?.username || 'گزارش‌دهنده';
      const reporterPersonnelCode = normalizeStr(
        req.reporterPersonnelCode || rawF28.reporterPersonnelCode || user?.personnelCode
      );
      const injuredPersonName = normalizeStr(rawF28.injuredPersonName || req.injuredPersonName);
      const injuredPersonCode = normalizeStr(rawF28.injuredPersonCode || req.injuredPersonCode);
      const injuredPersonJobTitle = normalizeStr(rawF28.injuredPersonJobTitle);
      const injuredBodyPart = normalizeStr(rawF28.injuredBodyPart);

      if (!isDraft && !locationSite) {
        throw new ValidationError('تعیین مکان بروز حادثه / رویداد الزامی است.');
      }
      if (!isDraft && !description) {
        throw new ValidationError('تکمیل شرح مورد (شرح حادثه / رویداد) الزامی است.');
      }

      const derivedTitle =
        normalizeStr(req.title) ||
        (description ? description.slice(0, 90) : '') ||
        (isDraft ? 'پیش‌نویس گزارش حادثه / رویداد (RHS-F28)' : `گزارش حادثه / رویداد — ${locationSite}`);

      let incidentNumber = normalizeStr(req.reportNumber || req.incidentNumber);
      if (!incidentNumber || !incidentNumber.startsWith('RHS-F28-')) {
        incidentNumber = await this.getNextReportNumber(observationDate, 'RHS-F28');
      } else {
        const existingByNum = await incidentRepository.findByNumber(incidentNumber);
        if (existingByNum && !req.id) {
          incidentNumber = await this.getNextReportNumber(observationDate, 'RHS-F28');
        }
      }

      const workflowStage: RhsF68WorkflowStage = isDraft ? 'DRAFT' : 'HSE_FINAL_APPROVAL';
      const status = 'Submitted';
      const existingAudit = Array.isArray(rawF28.auditHistory) ? rawF28.auditHistory : [];
      const auditEntry = buildAuditEntry(
        user,
        isDraft
          ? 'ذخیره پیش‌نویس گزارش حادثه / رویداد (RHS-F28)'
          : 'ثبت گزارش حادثه / رویداد (RHS-F28) و ارسال به رئیس مرکز HSE',
        undefined,
        workflowStage,
        derivedTitle,
        isDraft ? undefined : { referredToName: 'رئیس مرکز ایمنی، بهداشت و محیط زیست' }
      );

      // Strict Stage 1 whitelisting: strip any client-supplied HSE Center Head approval/signature fields
      const rhsF28Payload = {
        formCode: 'RHS-F28 Rev.01' as const,
        reportDate,
        reporterName,
        reporterPersonnelCode,
        department,
        observationDate,
        observationTime,
        locationSite: locationSite || 'محوطه کارخانه',
        exactLocation,
        isIncidentEvent: rawF28.isIncidentEvent !== undefined ? Boolean(rawF28.isIncidentEvent) : true,
        injuredPersonName,
        injuredPersonCode,
        injuredPersonJobTitle,
        injuredBodyPart,
        description: description || derivedTitle,
        damagesOrInjuries,
        actionsTaken,
        recommendations,
        otherNotes,
        attachments: Array.isArray(rawF28.attachments) ? rawF28.attachments : [],
        reporterSignature: rawF28.reporterSignature || '',
        reporterSignedDate: rawF28.reporterSignedDate || (rawF28.reporterSignature ? reportDate : ''),
        hseCenterHeadNotes: '',
        hseCenterHeadName: '',
        hseCenterHeadPersonnelCode: '',
        hseCenterHeadSignature: '',
        hseCenterHeadSignedDate: '',
        auditHistory: [auditEntry, ...existingAudit],
      };

      const attachedFileIds = Array.isArray(req.attachedFileIds)
        ? req.attachedFileIds
        : rhsF28Payload.attachments.map((a: any) => a.fileId).filter(Boolean);

      const payloadJson = {
        createdByUid: user?.uid || '',
        formVariant: 'RHS-F28' as const,
        category: 'Incident',
        categoryFa: 'حادثه / رویداد',
        incidentTypeId: req.incidentTypeId || '',
        title: derivedTitle,
        reportDate,
        department,
        locationSite: rhsF28Payload.locationSite,
        exactLocation,
        reporterPersonnelCode,
        reporterName,
        reporterRole: req.reporterRole || user?.role || 'User',
        injuredPersonName,
        injuredPersonCode,
        bodyPartAffected: req.bodyPartAffected || (injuredBodyPart ? 'Multiple' : 'None'),
        medicalTreatmentType: req.medicalTreatmentType || 'N/A',
        isOshaRecordable: Boolean(req.isOshaRecordable),
        immediateActions: actionsTaken,
        attachedFileIds,
        workflowStage,
        isDraft,
        rhsF28: rhsF28Payload,
      };

      const record = await incidentRepository.create({
        id: req.id,
        incidentNumber,
        title: derivedTitle,
        reportDate,
        incidentType: req.incidentType || 'INCIDENT',
        category: 'Incident',
        severity: req.severity || 'Minor / First Aid',
        incidentDate: observationDate,
        incidentTime: observationTime,
        department,
        location: rhsF28Payload.locationSite,
        exactLocation,
        reporterPersonnelCode,
        reporterName,
        description: rhsF28Payload.description,
        immediateCauses: actionsTaken || null,
        lostWorkDays: Number(req.lostWorkDays || req.lostDays || 0),
        status,
        workflowStage,
        isDraft,
        companyId: req.companyId,
        departmentId: req.departmentId,
        unitId: req.unitId,
        payload: payloadJson,
      });

      let workflowId: number | string | undefined;
      if (!isDraft) {
        try {
          const workflow = await workflowService.createInstance(
            {
              workflowKey: 'INCIDENT_INVESTIGATION_WORKFLOW',
              entityType: 'INCIDENT',
              entityId: incidentNumber,
              entityNumber: incidentNumber,
              title: `گزارش RHS-F28: ${derivedTitle}`,
              priority: req.severity === 'CRITICAL' ? 'HIGH' : 'NORMAL',
              requesterName: reporterName,
              requesterPersonnelCode: reporterPersonnelCode,
              steps: [
                {
                  stepOrder: 1,
                  stepName: 'بررسی و امضای رئیس مرکز ایمنی، بهداشت و محیط زیست',
                  stepType: 'APPROVE_SIGN',
                  assignedRole: 'HSE_MANAGER',
                  deadlineHours: 24,
                },
              ],
            },
            user
          );
          workflowId = workflow?.id;
        } catch (e) {
          console.warn('RHS-F28 workflow instantiation optional warning:', e);
        }

        await notifyRhsF68StageAssignee({
          incidentNumber,
          title: derivedTitle,
          categoryFa: 'حادثه / رویداد (RHS-F28)',
          targetRole: 'HSE_HEAD',
          senderName: reporterName,
          notifTitle: `گزارش حادثه / رویداد جدید RHS-F28: ${incidentNumber}`,
          notifBody: `گزارش حادثه / رویداد «${derivedTitle}» توسط ${reporterName} ثبت و جهت بررسی و امضا به کارتابل رئیس مرکز HSE ارسال گردید.`,
          category: 'warning',
          priority: 'high',
          stage: workflowStage,
        });

        void dispatchDomainWebhookEvent({
          eventType: 'incident.reported',
          moduleName: 'incident_reporting',
          correlationKey: incidentNumber,
          idempotencyKey: `idem_incident_f28_${incidentNumber}_${workflowStage}`,
          triggeredBy: user?.username || reporterName,
          data: {
            id: record?.id || incidentNumber,
            incidentNumber,
            formVariant: 'RHS-F28',
            title: derivedTitle,
            incidentDate: observationDate,
            location: rhsF28Payload.locationSite,
            status,
            workflowStage,
            description: rhsF28Payload.description,
            workflowId,
          },
        });
      }

      try {
        await auditService.log({
          action: isDraft ? 'SAVE_RHS_F28_DRAFT' : 'CREATE_RHS_F28_INCIDENT',
          module: 'INCIDENTS',
          entityType: 'INCIDENT',
          entityId: incidentNumber,
          newValue: { incidentNumber, formVariant: 'RHS-F28', title: derivedTitle, workflowStage },
        });
      } catch {}

      return { ...record, workflowId };
    }

    const { category, categoryFa, incidentType } = normalizeRhsCategory(req.category, req.incidentType);

    const title = normalizeStr(req.title) || normalizeStr(req.description) || (isDraft ? 'پیش‌نویس گزارش ناهنجاری ایمنی' : '');
    if (!isDraft && !title) {
      throw new ValidationError('موضوع / عنوان گزارش الزامی است.');
    }

    const description = normalizeStr(req.description) || title || 'پیش‌نویس گزارش';
    if (!isDraft && !normalizeStr(req.description) && !normalizeStr(req.title)) {
      throw new ValidationError('شرح رویداد / ناهنجاری الزامی است.');
    }

    const incidentDate = String(req.incidentDate || req.eventDate || new Date().toLocaleDateString('fa-IR'));
    const eventTime = String(req.incidentTime || req.eventTime || '10:00');
    const location = normalizeStr(req.location || req.locationSite || req.department) || 'محوطه کارخانه';
    const reporterName = normalizeStr(req.reporterName) || user?.name || user?.username || 'گزارش‌دهنده';
    const reporterPersonnelCode = normalizeStr(req.reporterPersonnelCode || user?.personnelCode);

    let incidentNumber = normalizeStr(req.reportNumber || req.incidentNumber);
    if (!incidentNumber) {
      incidentNumber = await this.getNextReportNumber(incidentDate);
    } else {
      const existingByNum = await incidentRepository.findByNumber(incidentNumber);
      if (existingByNum && !req.id) {
        incidentNumber = await this.getNextReportNumber(incidentDate);
      }
    }

    // Authoritative Risk Assessment if provided
    let computedRisk: ReturnType<typeof computeServerRhsF68Rpn> | undefined;
    const rawRisk = req.rhsF68?.riskAssessment || req.riskAssessment;
    if (rawRisk && (rawRisk.probability || rawRisk.severity || rawRisk.detection)) {
      computedRisk = computeServerRhsF68Rpn(rawRisk.probability, rawRisk.severity, rawRisk.detection);
    }

    const referTargetType: 'HSE_HEAD' | 'HSE_EXPERT' =
      (req.referTargetType || req.rhsF68?.referTargetType) === 'HSE_EXPERT' ? 'HSE_EXPERT' : 'HSE_HEAD';

    const directExpertName = normalizeStr(
      req.assignedExpertName || req.rhsF68?.hseUnitReview?.assignedExpertName
    );
    const directExpertCode = normalizeStr(
      req.assignedExpertCode || req.rhsF68?.hseUnitReview?.assignedExpertCode
    );
    const directExpertJobTitle = normalizeStr(
      req.assignedExpertJobTitle || req.rhsF68?.hseUnitReview?.assignedExpertJobTitle
    );

    if (!isDraft && referTargetType === 'HSE_EXPERT' && !directExpertName) {
      throw new ValidationError('در صورت انتخاب ارجاع مستقیم به کارشناس، تعیین کارشناس مربوطه الزامی است.');
    }

    const workflowStage: RhsF68WorkflowStage = isDraft
      ? 'DRAFT'
      : referTargetType === 'HSE_EXPERT'
      ? 'HSE_EXPERT_REVIEW'
      : 'HSE_HEAD_TRIAGE';

    const status = isDraft
      ? 'Submitted'
      : workflowStage === 'HSE_EXPERT_REVIEW'
      ? 'Under Investigation'
      : 'Submitted';

    const baseRhsF68 = req.rhsF68 && typeof req.rhsF68 === 'object' ? { ...req.rhsF68 } : {};
    const existingAudit = Array.isArray(baseRhsF68.auditHistory) ? baseRhsF68.auditHistory : [];
    const auditEntry = buildAuditEntry(
      user,
      isDraft
        ? 'ذخیره پیش‌نویس گزارش RHS-F68'
        : referTargetType === 'HSE_EXPERT'
        ? 'ثبت گزارش و ارجاع مستقیم به کارشناس مسئول HSE'
        : 'ثبت گزارش و ارجاع به رئیس واحد HSE',
      undefined,
      workflowStage,
      `${categoryFa} — ${title}`,
      isDraft
        ? undefined
        : referTargetType === 'HSE_EXPERT'
        ? { referredToName: directExpertName, referredToCode: directExpertCode }
        : { referredToName: 'رئیس واحد HSE' }
    );

    // Stage 1 strict whitelisting: do not trust downstream triage/investigation/final fields on reporter creation
    const rhsF68Payload = {
      formCode: 'RHS-F68 Rev.01' as const,
      reportDate: req.reportDate || baseRhsF68.reportDate || new Date().toLocaleDateString('fa-IR'),
      companyName: req.companyName ?? baseRhsF68.companyName ?? '',
      reporterJobTitle: req.reporterJobTitle ?? baseRhsF68.reporterJobTitle ?? '',
      exactLocation: req.exactLocation ?? baseRhsF68.exactLocation ?? '',
      referTargetType,
      involvedPersonnel: Array.isArray(baseRhsF68.involvedPersonnel) ? baseRhsF68.involvedPersonnel : [],
      suggestions: baseRhsF68.suggestions ?? '',
      reporterSignature: baseRhsF68.reporterSignature ?? '',
      reporterSignedDate: baseRhsF68.reporterSignedDate ?? '',
      attachments: Array.isArray(baseRhsF68.attachments) ? baseRhsF68.attachments : [],
      hseUnitReview:
        referTargetType === 'HSE_EXPERT'
          ? {
              inspectionStatus: 'PENDING' as const,
              inspectionResult: '',
              actionRequired: false,
              assignedExpertCode: directExpertCode,
              assignedExpertName: directExpertName,
              assignedExpertJobTitle: directExpertJobTitle,
              hseHeadNotes: '',
            }
          : {
              inspectionStatus: 'PENDING' as const,
              inspectionResult: '',
              actionRequired: false,
              assignedExpertCode: '',
              assignedExpertName: '',
              assignedExpertJobTitle: '',
              hseHeadNotes: '',
            },
      eventFactors: baseRhsF68.eventFactors || undefined,
      riskAssessment: computedRisk
        ? {
            ...computedRisk,
            assessedBy: baseRhsF68.riskAssessment?.assessedBy || reporterName,
            assessedDate: baseRhsF68.riskAssessment?.assessedDate || incidentDate,
          }
        : undefined,
      auditHistory: [auditEntry, ...existingAudit],
    };

    const attachedFileIds = Array.isArray(req.attachedFileIds)
      ? req.attachedFileIds
      : Array.isArray(rhsF68Payload.attachments)
      ? rhsF68Payload.attachments.map((a: any) => a.fileId).filter(Boolean)
      : [];

    const payloadJson = {
      createdByUid: user?.uid || '',
      category,
      categoryFa: req.categoryFa || categoryFa,
      incidentTypeId: req.incidentTypeId || '',
      title,
      reportDate: rhsF68Payload.reportDate,
      companyName: rhsF68Payload.companyName,
      department: req.department || '',
      locationSite: location,
      exactLocation: rhsF68Payload.exactLocation,
      reporterPersonnelCode,
      reporterName,
      reporterJobTitle: rhsF68Payload.reporterJobTitle,
      reporterRole: req.reporterRole || user?.role || 'User',
      injuredPersonName: req.injuredPersonName || '',
      injuredPersonCode: req.injuredPersonCode || '',
      bodyPartAffected: req.bodyPartAffected || 'None',
      medicalTreatmentType: req.medicalTreatmentType || 'N/A',
      isOshaRecordable: Boolean(req.isOshaRecordable),
      immediateActions: req.immediateActions || req.immediateActionTaken || '',
      rootCauses: req.rootCauses || [],
      fiveWhys: req.fiveWhys || [],
      capaActions: req.capaActions || req.capaList || [],
      attachedFileIds,
      riskAssessment: computedRisk,
      toxicGasLeak: req.toxicGasLeak,
      workflowStage,
      isDraft,
      rhsF68: rhsF68Payload,
    };

    const record = await incidentRepository.create({
      id: req.id,
      incidentNumber,
      title,
      reportDate: rhsF68Payload.reportDate,
      incidentType,
      category,
      severity: req.severity || 'Minor / First Aid',
      incidentDate,
      incidentTime: eventTime,
      companyName: rhsF68Payload.companyName,
      department: req.department || '',
      location,
      exactLocation: rhsF68Payload.exactLocation,
      reporterPersonnelCode,
      reporterName,
      reporterJobTitle: rhsF68Payload.reporterJobTitle,
      description,
      immediateCauses: req.immediateActions || req.immediateActionTaken || null,
      rootCauses: req.rootCauses,
      capaList: req.capaActions || req.capaList,
      lostWorkDays: Number(req.lostWorkDays || req.lostDays || 0),
      status,
      workflowStage,
      isDraft,
      rpn: computedRisk?.rpn ?? null,
      riskLevel: computedRisk?.riskLevel ?? null,
      investigator: rhsF68Payload.hseUnitReview?.assignedExpertName || null,
      companyId: req.companyId,
      departmentId: req.departmentId,
      unitId: req.unitId,
      payload: payloadJson,
    });

    let workflowId: number | string | undefined;
    if (!isDraft) {
      try {
        const workflow = await workflowService.createInstance(
          {
            workflowKey: 'INCIDENT_INVESTIGATION_WORKFLOW',
            entityType: 'INCIDENT',
            entityId: incidentNumber,
            entityNumber: incidentNumber,
            title: `گزارش RHS-F68: ${title}`,
            priority:
              computedRisk?.riskLevel === 'E' || computedRisk?.riskLevel === 'H' || req.severity === 'CRITICAL'
                ? 'HIGH'
                : 'NORMAL',
            requesterName: reporterName,
            requesterPersonnelCode: reporterPersonnelCode,
            steps: [
              {
                stepOrder: 1,
                stepName: 'بررسی اولیه و ارجاع توسط رئیس واحد HSE',
                stepType: 'REVIEW',
                assignedRole: 'HSE_MANAGER',
                deadlineHours: 24,
              },
              {
                stepOrder: 2,
                stepName: 'تعیین فاکتورهای رویداد، ارزیابی ریسک RPN و ثبت اقدام اصلاحی توسط کارشناس HSE',
                stepType: 'APPROVE',
                assignedRole: 'SAFETY_OFFICER',
                deadlineHours: 48,
              },
              {
                stepOrder: 3,
                stepName: 'جمع‌بندی و تایید نهایی رئیس HSE',
                stepType: 'APPROVE_SIGN',
                assignedRole: 'HSE_MANAGER',
                deadlineHours: 72,
              },
            ],
          },
          user
        );
        workflowId = workflow?.id;
      } catch (e) {
        console.warn('Incident workflow instantiation optional warning:', e);
      }
    }

    try {
      await auditService.log({
        action: isDraft ? 'SAVE_INCIDENT_DRAFT' : 'CREATE_INCIDENT',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: incidentNumber,
        newValue: {
          incidentNumber,
          title,
          categoryFa,
          workflowStage,
          rpn: computedRisk?.rpn,
          riskLevel: computedRisk?.riskLevel,
        },
      });
    } catch {}

    if (!isDraft) {
      if (workflowStage === 'HSE_EXPERT_REVIEW') {
        await notifyRhsF68StageAssignee({
          incidentNumber,
          title,
          categoryFa,
          targetRole: 'HSE_EXPERT',
          targetCodes: directExpertCode ? [directExpertCode] : [],
          targetNames: directExpertName ? [directExpertName] : [],
          senderName: reporterName,
          notifTitle: `ارجاع مستقیم گزارش ${categoryFa}: ${incidentNumber}`,
          notifBody: `گزارش «${title}» توسط ${reporterName} ثبت و جهت بررسی عوامل رویداد، ارزیابی ریسک RPN و تعیین اقدام اصلاحی به شما ارجاع داده شد.`,
          category: 'warning',
          priority: 'high',
          stage: workflowStage,
        });
      } else {
        await notifyRhsF68StageAssignee({
          incidentNumber,
          title,
          categoryFa,
          targetRole: 'HSE_HEAD',
          senderName: reporterName,
          notifTitle: `گزارش جدید RHS-F68 جهت بررسی رئیس HSE: ${incidentNumber}`,
          notifBody: `گزارش ${categoryFa} با موضوع «${title}» توسط ${reporterName} ثبت و جهت تعیین وضعیت بازرسی و ارجاع به کارشناس ارسال گردید.`,
          category: 'warning',
          priority: 'high',
          stage: workflowStage,
        });
      }

      void dispatchDomainWebhookEvent({
        eventType: 'incident.reported',
        moduleName: 'incident_reporting',
        correlationKey: incidentNumber,
        idempotencyKey: `idem_incident_${incidentNumber}_${workflowStage}`,
        triggeredBy: user?.username || reporterName,
        data: {
          id: record?.id || incidentNumber,
          incidentNumber,
          title,
          incidentType,
          severity: req.severity || 'Minor / First Aid',
          incidentDate,
          location,
          status,
          workflowStage,
          rpn: computedRisk?.rpn,
          riskLevel: computedRisk?.riskLevel,
          description,
          workflowId,
        },
      });
    }

    return {
      ...record,
      workflowId,
    };
  }

  async updateIncident(idOrNumber: string, req: any, user?: UserContext) {
    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError(`گزارش با شناسه '${idOrNumber}' یافت نشد.`);
    }

    const canManageAll = isHseHeadUser(user) || isHseExpertUser(user, existing);
    const isOwner = isReporterOwner(user, existing);
    const currentStage = (existing.workflowStage || 'HSE_HEAD_TRIAGE') as RhsF68WorkflowStage;

    if (currentStage === 'CLOSED') {
      throw new ForbiddenError('پرونده‌های تایید نهایی و مختومه‌شده قابل ویرایش نیستند.');
    }

    if (!canManageAll && !isOwner) {
      throw new ForbiddenError('شما مجوز ویرایش این گزارش را ندارید.');
    }
    if (!canManageAll && currentStage !== 'DRAFT' && currentStage !== 'RETURNED') {
      throw new ForbiddenError('پس از ارسال گزارش به واحد HSE، تنها مراحل گردش کار مجاز قابل ثبت هستند.');
    }

    if (req.expectedVersion !== undefined && Number(req.expectedVersion) !== Number(existing.version)) {
      throw new ConflictError('این گزارش همزمان توسط کاربر دیگری بروزرسانی شده است. لطفاً نسخه جدید را بارگذاری کنید.', {
        serverVersion: existing.version,
        updatedAt: existing.updatedAt,
        currentRecord: existing,
      });
    }

    const existingPayload = existing.incidentData || {};
    const existingRhs = existing.rhsF68 || existingPayload.rhsF68 || {};
    const existingF28 = existing.rhsF28 || existingPayload.rhsF28 || {};
    const isRhsF28 =
      existing.formVariant === 'RHS-F28' ||
      existingPayload.formVariant === 'RHS-F28' ||
      Boolean(existingPayload.rhsF28) ||
      req.formVariant === 'RHS-F28';
    const incomingRhs = req.rhsF68 && typeof req.rhsF68 === 'object' ? req.rhsF68 : {};
    const incomingF28 = req.rhsF28 && typeof req.rhsF28 === 'object' ? req.rhsF28 : {};
    const prevHistory = Array.isArray(isRhsF28 ? existingF28.auditHistory : existingRhs.auditHistory)
      ? isRhsF28
        ? existingF28.auditHistory
        : existingRhs.auditHistory
      : [];

    // Safe attachments-only update from Evidence panel for active workflow stages
    if (
      req.attachmentsOnly === true &&
      Array.isArray(incomingRhs.attachments || incomingF28.attachments || req.attachments)
    ) {
      const nextAtts =
        incomingF28.attachments ||
        incomingRhs.attachments ||
        req.attachments ||
        (isRhsF28 ? existingF28.attachments : existingRhs.attachments) ||
        [];
      const attachedFileIds = nextAtts.map((a: any) => a.fileId).filter(Boolean);
      const auditEntry = buildAuditEntry(
        user,
        'بروزرسانی مستندات و پیوست‌های پرونده',
        currentStage,
        currentStage,
        `${nextAtts.length} فایل`
      );
      const updated = await incidentRepository.create({
        ...existing,
        id: existing.id,
        incidentNumber: existing.incidentNumber,
        payload: {
          ...existingPayload,
          attachedFileIds,
          ...(isRhsF28
            ? {
                rhsF28: {
                  ...existingF28,
                  attachments: nextAtts,
                  auditHistory: [auditEntry, ...prevHistory],
                },
              }
            : {
                rhsF68: {
                  ...existingRhs,
                  attachments: nextAtts,
                  auditHistory: [auditEntry, ...prevHistory],
                },
              }),
        },
      });
      return updated;
    }

    const submitForReview = req.isDraft === false || req.submitForReview === true;
    const targetDraft = req.isDraft !== undefined ? Boolean(req.isDraft) : existing.isDraft;

    if (isRhsF28) {
      const nextStage: RhsF68WorkflowStage =
        submitForReview && (currentStage === 'DRAFT' || currentStage === 'RETURNED')
          ? 'HSE_FINAL_APPROVAL'
          : targetDraft && (currentStage === 'DRAFT' || currentStage === 'RETURNED')
          ? 'DRAFT'
          : currentStage;

      const nextDescription =
        incomingF28.description !== undefined
          ? normalizeStr(incomingF28.description)
          : req.description !== undefined
          ? normalizeStr(req.description)
          : existingF28.description || existing.description;
      const nextLocation =
        incomingF28.locationSite !== undefined
          ? normalizeStr(incomingF28.locationSite)
          : req.locationSite !== undefined || req.location !== undefined
          ? normalizeStr(req.locationSite || req.location)
          : existingF28.locationSite || existing.locationSite;

      if (submitForReview && (!nextLocation || !nextDescription)) {
        throw new ValidationError('پیش از ارسال نهایی، تکمیل مکان بروز و شرح مورد الزامی است.');
      }

      const nextTitle =
        normalizeStr(req.title) ||
        (nextDescription ? nextDescription.slice(0, 90) : '') ||
        existing.title;

      const auditEntry = buildAuditEntry(
        user,
        submitForReview && (currentStage === 'DRAFT' || currentStage === 'RETURNED')
          ? 'تکمیل و ارسال گزارش حادثه / رویداد (RHS-F28) به رئیس مرکز HSE'
          : 'بروزرسانی گزارش حادثه / رویداد (RHS-F28)',
        currentStage,
        nextStage,
        nextTitle,
        submitForReview ? { referredToName: 'رئیس مرکز ایمنی، بهداشت و محیط زیست' } : undefined
      );

      // Preserve HSE Center Head sign-off fields strictly; only update reporter-owned RHS-F28 fields
      const mergedF28 = {
        ...existingF28,
        formCode: 'RHS-F28 Rev.01' as const,
        reportDate: req.reportDate || incomingF28.reportDate || existingF28.reportDate || existing.reportDate,
        reporterName: req.reporterName ?? incomingF28.reporterName ?? existingF28.reporterName ?? existing.reporterName,
        reporterPersonnelCode:
          req.reporterPersonnelCode ??
          incomingF28.reporterPersonnelCode ??
          existingF28.reporterPersonnelCode ??
          existing.reporterPersonnelCode ??
          '',
        department: req.department ?? incomingF28.department ?? existingF28.department ?? existing.department ?? '',
        observationDate:
          req.eventDate ||
          req.incidentDate ||
          incomingF28.observationDate ||
          existingF28.observationDate ||
          existing.eventDate,
        observationTime:
          req.eventTime ||
          req.incidentTime ||
          incomingF28.observationTime ||
          existingF28.observationTime ||
          existing.eventTime ||
          '10:00',
        locationSite: nextLocation || 'محوطه کارخانه',
        exactLocation: req.exactLocation ?? incomingF28.exactLocation ?? existingF28.exactLocation ?? existing.exactLocation ?? '',
        isIncidentEvent:
          incomingF28.isIncidentEvent !== undefined
            ? Boolean(incomingF28.isIncidentEvent)
            : existingF28.isIncidentEvent !== undefined
            ? Boolean(existingF28.isIncidentEvent)
            : true,
        injuredPersonName:
          incomingF28.injuredPersonName !== undefined
            ? normalizeStr(incomingF28.injuredPersonName)
            : req.injuredPersonName ?? existingF28.injuredPersonName ?? '',
        injuredPersonCode:
          incomingF28.injuredPersonCode !== undefined
            ? normalizeStr(incomingF28.injuredPersonCode)
            : req.injuredPersonCode ?? existingF28.injuredPersonCode ?? '',
        injuredPersonJobTitle:
          incomingF28.injuredPersonJobTitle !== undefined
            ? normalizeStr(incomingF28.injuredPersonJobTitle)
            : existingF28.injuredPersonJobTitle ?? '',
        injuredBodyPart:
          incomingF28.injuredBodyPart !== undefined
            ? normalizeStr(incomingF28.injuredBodyPart)
            : existingF28.injuredBodyPart ?? '',
        description: nextDescription,
        damagesOrInjuries:
          incomingF28.damagesOrInjuries !== undefined
            ? normalizeStr(incomingF28.damagesOrInjuries)
            : existingF28.damagesOrInjuries ?? '',
        actionsTaken:
          incomingF28.actionsTaken !== undefined
            ? normalizeStr(incomingF28.actionsTaken)
            : req.immediateActionTaken ?? req.immediateActions ?? existingF28.actionsTaken ?? '',
        recommendations:
          incomingF28.recommendations !== undefined
            ? normalizeStr(incomingF28.recommendations)
            : existingF28.recommendations ?? '',
        otherNotes:
          incomingF28.otherNotes !== undefined
            ? normalizeStr(incomingF28.otherNotes)
            : existingF28.otherNotes ?? '',
        attachments: Array.isArray(incomingF28.attachments)
          ? incomingF28.attachments
          : existingF28.attachments || [],
        reporterSignature:
          incomingF28.reporterSignature !== undefined
            ? incomingF28.reporterSignature
            : existingF28.reporterSignature || '',
        reporterSignedDate:
          incomingF28.reporterSignedDate !== undefined
            ? incomingF28.reporterSignedDate
            : existingF28.reporterSignedDate || '',
        auditHistory: [auditEntry, ...prevHistory],
      };

      const attachedFileIds = Array.isArray(req.attachedFileIds)
        ? req.attachedFileIds
        : mergedF28.attachments.map((a: any) => a.fileId).filter(Boolean);

      const mergedPayload = {
        ...existingPayload,
        formVariant: 'RHS-F28' as const,
        category: 'Incident',
        categoryFa: 'حادثه / رویداد',
        title: nextTitle,
        reportDate: mergedF28.reportDate,
        department: mergedF28.department,
        locationSite: mergedF28.locationSite,
        exactLocation: mergedF28.exactLocation,
        reporterPersonnelCode: mergedF28.reporterPersonnelCode,
        reporterName: mergedF28.reporterName,
        injuredPersonName: mergedF28.injuredPersonName,
        injuredPersonCode: mergedF28.injuredPersonCode,
        isOshaRecordable:
          req.isOshaRecordable !== undefined ? Boolean(req.isOshaRecordable) : Boolean(existingPayload.isOshaRecordable),
        immediateActions: mergedF28.actionsTaken,
        attachedFileIds,
        workflowStage: nextStage,
        isDraft: targetDraft && !submitForReview,
        rhsF28: mergedF28,
      };

      const updated = await incidentRepository.create({
        ...existing,
        id: existing.id,
        incidentNumber: existing.incidentNumber,
        title: nextTitle,
        reportDate: mergedF28.reportDate,
        incidentType: req.incidentType || existing.incidentType || 'INCIDENT',
        category: 'Incident',
        severity: req.severity ?? existing.severity,
        incidentDate: mergedF28.observationDate,
        incidentTime: mergedF28.observationTime,
        department: mergedF28.department,
        location: mergedF28.locationSite,
        exactLocation: mergedF28.exactLocation,
        reporterPersonnelCode: mergedF28.reporterPersonnelCode,
        reporterName: mergedF28.reporterName,
        description: mergedF28.description,
        immediateActionTaken: mergedF28.actionsTaken,
        status: 'Submitted',
        workflowStage: nextStage,
        isDraft: targetDraft && !submitForReview,
        payload: mergedPayload,
      });

      if (submitForReview && (currentStage === 'DRAFT' || currentStage === 'RETURNED')) {
        const repNum = existing.incidentNumber || String(existing.id);
        const actor = updated.reporterName || user?.name || 'گزارش‌دهنده';
        await notifyRhsF68StageAssignee({
          incidentNumber: repNum,
          title: updated.title,
          categoryFa: 'حادثه / رویداد (RHS-F28)',
          targetRole: 'HSE_HEAD',
          senderName: actor,
          notifTitle: `گزارش حادثه / رویداد RHS-F28 آماده تایید: ${repNum}`,
          notifBody: `گزارش «${updated.title}» توسط ${actor} تکمیل و جهت بررسی و امضای رئیس مرکز HSE ارسال گردید.`,
          stage: nextStage,
        });
      }

      try {
        await auditService.log({
          action: 'UPDATE_RHS_F28_INCIDENT',
          module: 'INCIDENTS',
          entityType: 'INCIDENT',
          entityId: existing.incidentNumber || String(existing.id),
          newValue: { workflowStage: nextStage, title: updated.title },
        });
      } catch {}

      return updated;
    }

    const { category, categoryFa, incidentType } = normalizeRhsCategory(
      req.category || existing.category,
      req.incidentType || existing.incidentType
    );

    const referTargetType: 'HSE_HEAD' | 'HSE_EXPERT' =
      (req.referTargetType || incomingRhs.referTargetType || existingRhs.referTargetType) === 'HSE_EXPERT'
        ? 'HSE_EXPERT'
        : 'HSE_HEAD';
    const directExpertName = normalizeStr(
      req.assignedExpertName || incomingRhs.hseUnitReview?.assignedExpertName || existingRhs.hseUnitReview?.assignedExpertName
    );
    const directExpertCode = normalizeStr(
      req.assignedExpertCode || incomingRhs.hseUnitReview?.assignedExpertCode || existingRhs.hseUnitReview?.assignedExpertCode
    );
    const directExpertJobTitle = normalizeStr(
      req.assignedExpertJobTitle || incomingRhs.hseUnitReview?.assignedExpertJobTitle || existingRhs.hseUnitReview?.assignedExpertJobTitle
    );

    if (submitForReview && referTargetType === 'HSE_EXPERT' && !directExpertName) {
      throw new ValidationError('در صورت انتخاب ارجاع مستقیم به کارشناس، تعیین کارشناس مربوطه الزامی است.');
    }

    let nextStage: RhsF68WorkflowStage = currentStage;
    if (submitForReview && (currentStage === 'DRAFT' || currentStage === 'RETURNED')) {
      nextStage = referTargetType === 'HSE_EXPERT' ? 'HSE_EXPERT_REVIEW' : 'HSE_HEAD_TRIAGE';
    } else if (targetDraft && (currentStage === 'DRAFT' || currentStage === 'RETURNED')) {
      nextStage = 'DRAFT';
    }

    const nextStatus =
      nextStage === 'ACTION_IN_PROGRESS' || nextStage === 'HSE_FINAL_APPROVAL'
        ? 'CAPA In Progress'
        : nextStage === 'HSE_EXPERT_REVIEW'
        ? 'Under Investigation'
        : 'Submitted';

    const auditEntry = buildAuditEntry(
      user,
      submitForReview && (currentStage === 'DRAFT' || currentStage === 'RETURNED')
        ? referTargetType === 'HSE_EXPERT'
          ? 'ارسال گزارش / اصلاحیه و ارجاع مستقیم به کارشناس HSE'
          : 'ارسال گزارش / اصلاحیه به رئیس واحد HSE'
        : 'بروزرسانی اطلاعات بخش ۱ گزارش',
      currentStage,
      nextStage,
      normalizeStr(req.title) || existing.title,
      submitForReview
        ? referTargetType === 'HSE_EXPERT'
          ? { referredToName: directExpertName, referredToCode: directExpertCode }
          : { referredToName: 'رئیس واحد HSE' }
        : undefined
    );

    // Strictly preserve all downstream sections (hseUnitReview, eventFactors, riskAssessment, correctiveFollowUp, finalConclusion)
    const preservedHseUnitReview =
      submitForReview && referTargetType === 'HSE_EXPERT' && directExpertName
        ? {
            ...(existingRhs.hseUnitReview || {
              inspectionStatus: 'PENDING',
              inspectionResult: '',
              actionRequired: false,
            }),
            assignedExpertCode: directExpertCode,
            assignedExpertName: directExpertName,
            assignedExpertJobTitle: directExpertJobTitle,
          }
        : existingRhs.hseUnitReview;

    const mergedRhs = {
      ...existingRhs,
      formCode: 'RHS-F68 Rev.01' as const,
      reportDate: req.reportDate || incomingRhs.reportDate || existingRhs.reportDate || existing.reportDate,
      companyName: req.companyName ?? incomingRhs.companyName ?? existing.companyName ?? '',
      reporterJobTitle: req.reporterJobTitle ?? incomingRhs.reporterJobTitle ?? existing.reporterJobTitle ?? '',
      exactLocation: req.exactLocation ?? incomingRhs.exactLocation ?? existing.exactLocation ?? '',
      referTargetType,
      involvedPersonnel: Array.isArray(incomingRhs.involvedPersonnel)
        ? incomingRhs.involvedPersonnel
        : existingRhs.involvedPersonnel || [],
      suggestions: incomingRhs.suggestions !== undefined ? incomingRhs.suggestions : existingRhs.suggestions || '',
      reporterSignature:
        incomingRhs.reporterSignature !== undefined ? incomingRhs.reporterSignature : existingRhs.reporterSignature || '',
      reporterSignedDate:
        incomingRhs.reporterSignedDate !== undefined ? incomingRhs.reporterSignedDate : existingRhs.reporterSignedDate || '',
      attachments: Array.isArray(incomingRhs.attachments)
        ? incomingRhs.attachments
        : existingRhs.attachments || [],
      hseUnitReview: preservedHseUnitReview,
      eventFactors: existingRhs.eventFactors,
      riskAssessment: existingRhs.riskAssessment,
      correctiveFollowUp: existingRhs.correctiveFollowUp,
      finalConclusion: existingRhs.finalConclusion,
      auditHistory: [auditEntry, ...prevHistory],
    };

    const attachedFileIds = Array.isArray(req.attachedFileIds)
      ? req.attachedFileIds
      : Array.isArray(mergedRhs.attachments)
      ? mergedRhs.attachments.map((a: any) => a.fileId).filter(Boolean)
      : existing.attachedFileIds || [];

    const mergedPayload = {
      ...existingPayload,
      category,
      categoryFa: req.categoryFa || categoryFa,
      title: req.title ?? existing.title,
      reportDate: mergedRhs.reportDate,
      companyName: mergedRhs.companyName,
      department: req.department ?? existing.department,
      locationSite: req.locationSite || req.location || existing.locationSite,
      exactLocation: mergedRhs.exactLocation,
      reporterPersonnelCode: req.reporterPersonnelCode ?? existing.reporterPersonnelCode,
      reporterName: req.reporterName ?? existing.reporterName,
      reporterJobTitle: mergedRhs.reporterJobTitle,
      immediateActions: req.immediateActionTaken ?? req.immediateActions ?? existing.immediateActionTaken,
      attachedFileIds,
      workflowStage: nextStage,
      isDraft: targetDraft && !submitForReview,
      rhsF68: mergedRhs,
    };

    const updated = await incidentRepository.create({
      ...existing,
      id: existing.id,
      incidentNumber: existing.incidentNumber,
      title: req.title ?? existing.title,
      reportDate: mergedRhs.reportDate,
      incidentType,
      category,
      severity: req.severity ?? existing.severity,
      incidentDate: req.eventDate || req.incidentDate || existing.eventDate,
      incidentTime: req.eventTime || req.incidentTime || existing.eventTime,
      companyName: mergedRhs.companyName,
      department: req.department ?? existing.department,
      location: req.locationSite || req.location || existing.locationSite,
      exactLocation: mergedRhs.exactLocation,
      reporterPersonnelCode: req.reporterPersonnelCode ?? existing.reporterPersonnelCode,
      reporterName: req.reporterName ?? existing.reporterName,
      reporterJobTitle: mergedRhs.reporterJobTitle,
      description: req.description ?? existing.description,
      immediateActionTaken: req.immediateActionTaken ?? req.immediateActions ?? existing.immediateActionTaken,
      status: nextStatus,
      workflowStage: nextStage,
      isDraft: targetDraft && !submitForReview,
      investigator: preservedHseUnitReview?.assignedExpertName || existing.investigator,
      payload: mergedPayload,
    });

    if (submitForReview && (currentStage === 'DRAFT' || currentStage === 'RETURNED')) {
      const repNum = existing.incidentNumber || String(existing.id);
      const actor = updated.reporterName || user?.name || 'گزارش‌دهنده';
      if (nextStage === 'HSE_EXPERT_REVIEW') {
        await notifyRhsF68StageAssignee({
          incidentNumber: repNum,
          title: updated.title,
          categoryFa: req.categoryFa || categoryFa,
          targetRole: 'HSE_EXPERT',
          targetCodes: directExpertCode ? [directExpertCode] : [],
          targetNames: directExpertName ? [directExpertName] : [],
          senderName: actor,
          notifTitle: `ارجاع گزارش اصلاحی/پیش‌نویس به کارشناس: ${repNum}`,
          notifBody: `گزارش «${updated.title}» توسط ${actor} تکمیل و به شما ارجاع داده شد.`,
          stage: nextStage,
        });
      } else {
        await notifyRhsF68StageAssignee({
          incidentNumber: repNum,
          title: updated.title,
          categoryFa: req.categoryFa || categoryFa,
          targetRole: 'HSE_HEAD',
          senderName: actor,
          notifTitle: `گزارش آماده بررسی اولیه رئیس HSE: ${repNum}`,
          notifBody: `گزارش «${updated.title}» توسط ${actor} ارسال و در کارتابل بررسی اولیه رئیس HSE قرار گرفت.`,
          stage: nextStage,
        });
      }
    }

    try {
      await auditService.log({
        action: 'UPDATE_INCIDENT',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: existing.incidentNumber || String(existing.id),
        newValue: { workflowStage: nextStage, status: nextStatus, title: updated.title },
      });
    } catch {}

    return updated;
  }

  /**
   * Stage 2: HSE Head Initial Triage & Expert Assignment
   */
  async hseHeadTriage(idOrNumber: string, body: any, user?: UserContext) {
    if (!isHseHeadUser(user)) {
      throw new ForbiddenError('تنها رئیس واحد HSE یا مدیر سامانه مجاز به بررسی اولیه و تعیین کارشناس مسئول است.');
    }

    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError(`گزارش با شناسه '${idOrNumber}' یافت نشد.`);
    }

    const currentStage = (existing.workflowStage || 'HSE_HEAD_TRIAGE') as RhsF68WorkflowStage;
    if (currentStage === 'CLOSED') {
      throw new ForbiddenError('این پرونده قبلاً تایید نهایی و مختومه شده است.');
    }
    if (currentStage !== 'HSE_HEAD_TRIAGE' && currentStage !== 'RETURNED') {
      throw new ConflictError('مرحله بررسی اولیه رئیس HSE برای این گزارش قبلاً تکمیل و به مرحله بعدی ارجاع شده است.', {
        currentStage,
      });
    }

    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(existing.version)) {
      throw new ConflictError('این گزارش همزمان توسط کاربر دیگری تغییر یافته است.', {
        serverVersion: existing.version,
        currentRecord: existing,
      });
    }

    const inspectionStatus = body.inspectionStatus || 'INSPECTED';
    if (!['INSPECTED', 'NO_INSPECTION_NEEDED', 'PENDING'].includes(inspectionStatus)) {
      throw new ValidationError('وضعیت بازرسی نامعتبر است.');
    }

    const actionRequired = Boolean(body.actionRequired);
    const assignedExpertName = normalizeStr(body.assignedExpertName);
    const assignedExpertCode = normalizeStr(body.assignedExpertCode);

    if (actionRequired && !assignedExpertName) {
      throw new ValidationError('در صورت درخواست اقدام اصلاحی، تعیین کارشناس مسئول الزامی است.');
    }

    const existingPayload = existing.incidentData || {};
    const existingRhs = existing.rhsF68 || existingPayload.rhsF68 || {};
    const prevHistory = Array.isArray(existingRhs.auditHistory) ? existingRhs.auditHistory : [];

    let nextStage: RhsF68WorkflowStage = 'HSE_EXPERT_REVIEW';
    let nextStatus: string = 'Under Investigation';

    if (body.proceedToFinalApproval && inspectionStatus === 'NO_INSPECTION_NEEDED' && !actionRequired && !assignedExpertName) {
      nextStage = 'HSE_FINAL_APPROVAL';
      nextStatus = 'Under Investigation';
    }

    const hseUnitReview = {
      ...(existingRhs.hseUnitReview || {}),
      inspectionStatus,
      inspectionResult: normalizeStr(body.inspectionResult),
      actionRequired,
      assignedExpertCode,
      assignedExpertName,
      assignedExpertJobTitle: normalizeStr(body.assignedExpertJobTitle),
      hseHeadNotes: normalizeStr(body.hseHeadNotes),
      hseHeadName: normalizeStr(body.hseHeadName) || user?.name || user?.username || 'رئیس واحد HSE',
      hseHeadPersonnelCode: normalizeStr(body.hseHeadPersonnelCode) || user?.personnelCode || '',
      hseHeadSignature: body.hseHeadSignature || existingRhs.hseUnitReview?.hseHeadSignature || '',
      hseHeadSignedDate: body.hseHeadSignedDate || new Date().toLocaleDateString('fa-IR'),
    };

    const auditEntry = buildAuditEntry(
      user,
      nextStage === 'HSE_FINAL_APPROVAL'
        ? 'بررسی اولیه رئیس HSE (بدون نیاز به بازرسی/اقدام) و ارسال به جمع‌بندی نهایی'
        : 'بررسی اولیه واحد HSE و ارجاع به کارشناس مسئول',
      currentStage,
      nextStage,
      assignedExpertName ? `ارجاع به کارشناس: ${assignedExpertName}` : `وضعیت بازرسی: ${inspectionStatus}`,
      {
        referredToName: nextStage === 'HSE_FINAL_APPROVAL' ? 'رئیس واحد HSE' : assignedExpertName || 'کارشناسان HSE',
        referredToCode: assignedExpertCode || undefined,
        referralNote: hseUnitReview.hseHeadNotes || undefined,
      }
    );

    const updatedRhs = {
      ...existingRhs,
      formCode: 'RHS-F68 Rev.01',
      hseUnitReview,
      auditHistory: [auditEntry, ...prevHistory],
    };

    const updated = await incidentRepository.create({
      ...existing,
      id: existing.id,
      incidentNumber: existing.incidentNumber,
      status: nextStatus,
      workflowStage: nextStage,
      isDraft: false,
      investigator: assignedExpertName || existing.investigator,
      payload: {
        ...existingPayload,
        assignedExpertCode,
        assignedTo: assignedExpertCode,
        workflowStage: nextStage,
        isDraft: false,
        rhsF68: updatedRhs,
      },
    });

    const repNum = existing.incidentNumber || String(existing.id);
    if (nextStage === 'HSE_EXPERT_REVIEW') {
      await notifyRhsF68StageAssignee({
        incidentNumber: repNum,
        title: existing.title,
        targetRole: 'HSE_EXPERT',
        targetCodes: assignedExpertCode ? [assignedExpertCode] : [],
        targetNames: assignedExpertName ? [assignedExpertName] : [],
        senderName: hseUnitReview.hseHeadName,
        notifTitle: `ارجاع کارشناسی گزارش RHS-F68: ${repNum}`,
        notifBody: `گزارش «${existing.title}» توسط رئیس واحد HSE (${hseUnitReview.hseHeadName}) بررسی و جهت تعیین عوامل رویداد، ارزیابی RPN و ثبت برنامه اقدام اصلاحی به شما ارجاع شد.`,
        stage: nextStage,
      });
    } else {
      await notifyRhsF68StageAssignee({
        incidentNumber: repNum,
        title: existing.title,
        targetRole: 'HSE_HEAD',
        senderName: hseUnitReview.hseHeadName,
        notifTitle: `گزارش آماده جمع‌بندی نهایی: ${repNum}`,
        notifBody: `گزارش «${existing.title}» در مرحله جمع‌بندی و تایید نهایی رئیس HSE قرار گرفت.`,
        stage: nextStage,
      });
    }

    try {
      await auditService.log({
        action: 'HSE_HEAD_TRIAGE',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: existing.incidentNumber || String(existing.id),
        newValue: { inspectionStatus, actionRequired, assignedExpertName, nextStage },
      });
    } catch {}

    return updated;
  }

  /**
   * Stage 3 (HSE Unit Expert: Factors + RPN + CAPA Plan) & Stage 4 (HSE Officer/Expert: Action Results)
   */
  async hseExpertInvestigate(idOrNumber: string, body: any, user?: UserContext) {
    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError(`گزارش با شناسه '${idOrNumber}' یافت نشد.`);
    }

    const currentStage = (existing.workflowStage || 'HSE_HEAD_TRIAGE') as RhsF68WorkflowStage;
    if (currentStage === 'CLOSED') {
      throw new ForbiddenError('این پرونده تایید نهایی و مختومه شده و امکان ویرایش ندارد.');
    }
    if (currentStage !== 'HSE_EXPERT_REVIEW' && currentStage !== 'ACTION_IN_PROGRESS') {
      throw new ConflictError('در مرحله فعلی گردش کار امکان ثبت اطلاعات کارشناس/افسر HSE وجود ندارد.', {
        currentStage,
      });
    }

    if (currentStage === 'HSE_EXPERT_REVIEW' && !isHseExpertUser(user, existing)) {
      throw new ForbiddenError('تنها کارشناس HSE مسئول یا مدیر HSE مجاز به تکمیل عوامل رویداد، ارزیابی ریسک و تعیین اقدام اصلاحی است.');
    }
    if (currentStage === 'ACTION_IN_PROGRESS' && !isAssignedActionOfficer(user, existing)) {
      throw new ForbiddenError('تنها کارشناس / افسر HSE مسئول یا مجری تعیین‌شده مجاز به ثبت نتایج اقدامات انجام‌شده است.');
    }

    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(existing.version)) {
      throw new ConflictError('این گزارش همزمان توسط کاربر دیگری تغییر یافته است.', {
        serverVersion: existing.version,
        currentRecord: existing,
      });
    }

    const existingPayload = existing.incidentData || {};
    const existingRhs = existing.rhsF68 || existingPayload.rhsF68 || {};
    const prevHistory = Array.isArray(existingRhs.auditHistory) ? existingRhs.auditHistory : [];
    const existingFollowUp = existingRhs.correctiveFollowUp || {};
    const incomingFu = body.correctiveFollowUp && typeof body.correctiveFollowUp === 'object' ? body.correctiveFollowUp : {};

    let computedRisk = existingRhs.riskAssessment;
    let updatedFactors = existingRhs.eventFactors;
    let updatedFollowUp: Record<string, any> = { ...existingFollowUp };
    let nextStage: RhsF68WorkflowStage = currentStage;
    let auditAction = '';
    let auditDetails = '';
    let referralMeta: { referredToName?: string; referredToCode?: string; referralNote?: string } | undefined;

    const submitToFinalApproval = Boolean(body.submitToFinalApproval);
    const referToActionOfficer = Boolean(body.referToActionOfficer);
    const actorDisplayName = user?.name || user?.username || existingRhs.hseUnitReview?.assignedExpertName || 'کارشناس HSE';

    if (currentStage === 'HSE_EXPERT_REVIEW') {
      // Stage 3: HSE Unit Expert owns eventFactors, server-computed RPN, and CAPA plan definition
      const rInput = body.riskAssessment || existingRhs.riskAssessment;
      if (rInput) {
        computedRisk = {
          ...computeServerRhsF68Rpn(rInput.probability, rInput.severity, rInput.detection),
          assessedBy: actorDisplayName,
          assessedDate: rInput.assessedDate || new Date().toLocaleDateString('fa-IR'),
        };
      }
      if (body.eventFactors && typeof body.eventFactors === 'object') {
        updatedFactors = body.eventFactors;
      }

      updatedFollowUp = {
        ...existingFollowUp,
        correctiveActionNumber:
          incomingFu.correctiveActionNumber !== undefined
            ? normalizeStr(incomingFu.correctiveActionNumber)
            : existingFollowUp.correctiveActionNumber || '',
        workOrderNumber:
          incomingFu.workOrderNumber !== undefined
            ? normalizeStr(incomingFu.workOrderNumber)
            : existingFollowUp.workOrderNumber || '',
        letterNumber:
          incomingFu.letterNumber !== undefined
            ? normalizeStr(incomingFu.letterNumber)
            : existingFollowUp.letterNumber || '',
        actionsTakenDescription:
          incomingFu.actionsTakenDescription !== undefined
            ? normalizeStr(incomingFu.actionsTakenDescription)
            : existingFollowUp.actionsTakenDescription || '',
        dueDate:
          incomingFu.dueDate !== undefined ? String(incomingFu.dueDate || '') : existingFollowUp.dueDate || '',
        responsibleUnit:
          incomingFu.responsibleUnit !== undefined
            ? normalizeStr(incomingFu.responsibleUnit)
            : existingFollowUp.responsibleUnit || '',
        responsiblePerson:
          incomingFu.responsiblePerson !== undefined
            ? normalizeStr(incomingFu.responsiblePerson)
            : existingFollowUp.responsiblePerson || '',
        responsiblePersonnelCode:
          incomingFu.responsiblePersonnelCode !== undefined
            ? normalizeStr(incomingFu.responsiblePersonnelCode)
            : existingFollowUp.responsiblePersonnelCode || '',
        followUpStatus: referToActionOfficer
          ? 'IN_PROGRESS'
          : submitToFinalApproval
          ? 'COMPLETED'
          : incomingFu.followUpStatus || existingFollowUp.followUpStatus || 'OPEN',
      };

      if (submitToFinalApproval) {
        // Optional fast-track straight to HSE Head when no separate officer execution is required
        if (incomingFu.actionResults !== undefined) {
          updatedFollowUp.actionResults = normalizeStr(incomingFu.actionResults);
        }
        if (incomingFu.actionDate !== undefined) {
          updatedFollowUp.actionDate = String(incomingFu.actionDate || '');
        }
        updatedFollowUp.expertName = normalizeStr(incomingFu.expertName) || actorDisplayName;
        updatedFollowUp.expertPersonnelCode = normalizeStr(incomingFu.expertPersonnelCode) || user?.personnelCode || '';
        if (incomingFu.expertSignature) {
          updatedFollowUp.expertSignature = incomingFu.expertSignature;
        }
        updatedFollowUp.expertSignedDate =
          incomingFu.expertSignedDate || new Date().toLocaleDateString('fa-IR');

        nextStage = 'HSE_FINAL_APPROVAL';
        auditAction = 'تکمیل ارزیابی کارشناس و ارسال مستقیم به جمع‌بندی نهایی رئیس HSE';
        auditDetails = computedRisk ? `RPN=${computedRisk.rpn} (${computedRisk.riskLevel})` : '';
        referralMeta = { referredToName: 'رئیس واحد HSE' };
      } else if (referToActionOfficer) {
        nextStage = 'ACTION_IN_PROGRESS';
        auditAction = 'تعیین عوامل، RPN و برنامه اقدام اصلاحی و ارجاع به کارشناس/افسر HSE جهت اجرا';
        auditDetails = `${computedRisk ? `RPN=${computedRisk.rpn} (${computedRisk.riskLevel}) | ` : ''}مهلت: ${updatedFollowUp.dueDate || '—'}`;
        referralMeta = {
          referredToName:
            updatedFollowUp.responsiblePerson ||
            updatedFollowUp.responsibleUnit ||
            existingRhs.hseUnitReview?.assignedExpertName ||
            'کارشناس / افسر HSE',
          referredToCode:
            updatedFollowUp.responsiblePersonnelCode ||
            existingRhs.hseUnitReview?.assignedExpertCode ||
            undefined,
          referralNote: updatedFollowUp.actionsTakenDescription || undefined,
        };
      } else {
        nextStage = 'HSE_EXPERT_REVIEW';
        auditAction = 'ذخیره موقت عوامل رویداد، ارزیابی ریسک RPN و برنامه اقدام';
        auditDetails = computedRisk ? `RPN=${computedRisk.rpn} (${computedRisk.riskLevel})` : '';
      }
    } else {
      // Stage 4: ACTION_IN_PROGRESS -> Action Officer / HSE Officer ONLY records execution results, date, status & signature.
      // Stage 3 eventFactors, riskAssessment (RPN), and CAPA plan definitions are STRICTLY preserved intact!
      const incomingResults =
        incomingFu.actionResults !== undefined
          ? normalizeStr(incomingFu.actionResults)
          : existingFollowUp.actionResults || '';

      if (submitToFinalApproval && !incomingResults && existingRhs.hseUnitReview?.actionRequired) {
        throw new ValidationError('پیش از ارسال به تایید نهایی، ثبت نتایج اقدامات انجام‌شده الزامی است.');
      }

      updatedFollowUp = {
        ...existingFollowUp,
        actionResults: incomingResults,
        actionDate:
          incomingFu.actionDate !== undefined
            ? String(incomingFu.actionDate || '')
            : existingFollowUp.actionDate || new Date().toLocaleDateString('fa-IR'),
        followUpStatus: submitToFinalApproval
          ? 'COMPLETED'
          : incomingFu.followUpStatus === 'IN_PROGRESS' || incomingFu.followUpStatus === 'COMPLETED'
          ? incomingFu.followUpStatus
          : 'IN_PROGRESS',
        expertName: normalizeStr(incomingFu.expertName) || actorDisplayName,
        expertPersonnelCode: normalizeStr(incomingFu.expertPersonnelCode) || user?.personnelCode || '',
        expertSignature: incomingFu.expertSignature || existingFollowUp.expertSignature || '',
        expertSignedDate: incomingFu.expertSignedDate || new Date().toLocaleDateString('fa-IR'),
      };

      if (submitToFinalApproval) {
        nextStage = 'HSE_FINAL_APPROVAL';
        auditAction = 'ثبت نتایج اقدامات انجام‌شده توسط کارشناس/افسر HSE و ارسال به جمع‌بندی رئیس HSE';
        auditDetails = updatedFollowUp.actionResults ? updatedFollowUp.actionResults.slice(0, 140) : undefined;
        referralMeta = { referredToName: 'رئیس واحد HSE' };
      } else {
        nextStage = 'ACTION_IN_PROGRESS';
        auditAction = 'بروزرسانی پیشرفت و نتایج اقدامات انجام‌شده';
        auditDetails = updatedFollowUp.actionResults ? updatedFollowUp.actionResults.slice(0, 140) : undefined;
      }
    }

    const nextStatus =
      nextStage === 'HSE_FINAL_APPROVAL' || nextStage === 'ACTION_IN_PROGRESS'
        ? 'CAPA In Progress'
        : 'Under Investigation';

    // Sync CAPA summary item cleanly for compatibility with CAPA dashboards
    let updatedCapaList = Array.isArray(existing.capaList) ? [...existing.capaList] : [];
    if (normalizeStr(updatedFollowUp.actionsTakenDescription)) {
      const primaryCapa = {
        id: updatedCapaList[0]?.id || 'rhs-f68-capa-1',
        description: updatedFollowUp.actionsTakenDescription,
        responsiblePerson:
          updatedFollowUp.responsiblePerson ||
          updatedFollowUp.responsibleUnit ||
          existingRhs.hseUnitReview?.assignedExpertName ||
          '',
        department: updatedFollowUp.responsibleUnit || existing.department || '',
        targetDate: updatedFollowUp.dueDate || updatedFollowUp.actionDate || '',
        completionDate: updatedFollowUp.actionDate || '',
        status:
          updatedFollowUp.followUpStatus === 'COMPLETED' || updatedFollowUp.followUpStatus === 'VERIFIED'
            ? ('Closed' as const)
            : updatedFollowUp.followUpStatus === 'IN_PROGRESS'
            ? ('In Progress' as const)
            : ('Open' as const),
        verificationNotes: updatedFollowUp.actionResults || '',
      };
      if (updatedCapaList.length > 0) updatedCapaList[0] = primaryCapa;
      else updatedCapaList = [primaryCapa];
    }

    const auditEntry = buildAuditEntry(
      user,
      auditAction,
      currentStage,
      nextStage,
      auditDetails,
      referralMeta
    );

    const updatedRhs = {
      ...existingRhs,
      formCode: 'RHS-F68 Rev.01',
      eventFactors: updatedFactors,
      riskAssessment: computedRisk,
      correctiveFollowUp: updatedFollowUp,
      auditHistory: [auditEntry, ...prevHistory],
    };

    const updated = await incidentRepository.create({
      ...existing,
      id: existing.id,
      incidentNumber: existing.incidentNumber,
      capaList: updatedCapaList,
      status: nextStatus,
      workflowStage: nextStage,
      isDraft: false,
      rpn: computedRisk?.rpn ?? existing.rpn,
      riskLevel: computedRisk?.riskLevel ?? existing.riskLevel,
      payload: {
        ...existingPayload,
        capaActions: updatedCapaList,
        riskAssessment: computedRisk,
        workflowStage: nextStage,
        rhsF68: updatedRhs,
      },
    });

    const repNum = existing.incidentNumber || String(existing.id);
    if (nextStage === 'ACTION_IN_PROGRESS' && referToActionOfficer) {
      await notifyRhsF68StageAssignee({
        incidentNumber: repNum,
        title: existing.title,
        targetRole: 'ACTION_OFFICER',
        targetCodes: [updatedFollowUp.responsiblePersonnelCode, existingRhs.hseUnitReview?.assignedExpertCode].filter(Boolean),
        targetNames: [updatedFollowUp.responsiblePerson, existingRhs.hseUnitReview?.assignedExpertName].filter(Boolean),
        senderName: actorDisplayName,
        notifTitle: `ارجاع اجرای اقدام اصلاحی RHS-F68: ${repNum}`,
        notifBody: `اقدام اصلاحی گزارش «${existing.title}» با سررسید ${updatedFollowUp.dueDate || 'تعیین‌شده'} جهت اجرا و ثبت نتایج اقدامات به شما ارجاع شد.`,
        stage: nextStage,
      });
    } else if (nextStage === 'HSE_FINAL_APPROVAL' && submitToFinalApproval) {
      await notifyRhsF68StageAssignee({
        incidentNumber: repNum,
        title: existing.title,
        targetRole: 'HSE_HEAD',
        senderName: actorDisplayName,
        notifTitle: `تکمیل بررسی و آماده تایید نهایی رئیس HSE: ${repNum}`,
        notifBody: `گزارش «${existing.title}» توسط ${actorDisplayName} تکمیل و جهت جمع‌بندی نهایی، تایید و امضا به کارتابل رئیس HSE ارسال گردید.`,
        stage: nextStage,
      });
    }

    try {
      await auditService.log({
        action: currentStage === 'ACTION_IN_PROGRESS' ? 'HSE_OFFICER_ACTION_RESULTS' : 'HSE_EXPERT_INVESTIGATION',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: existing.incidentNumber || String(existing.id),
        newValue: {
          rpn: computedRisk?.rpn,
          riskLevel: computedRisk?.riskLevel,
          nextStage,
          correctiveActionNumber: updatedFollowUp.correctiveActionNumber,
        },
      });
    } catch {}

    return updated;
  }

  /**
   * Stage 5: HSE Head Final Conclusion & Sign-off
   */
  async hseHeadFinalApprove(idOrNumber: string, body: any, user?: UserContext) {
    if (!isHseHeadUser(user)) {
      throw new ForbiddenError('تنها رئیس واحد HSE یا مدیر سامانه مجاز به جمع‌بندی و تایید نهایی گزارش است.');
    }

    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError(`گزارش با شناسه '${idOrNumber}' یافت نشد.`);
    }

    const existingPayload = existing.incidentData || {};
    const isRhsF28 =
      existing.formVariant === 'RHS-F28' ||
      existingPayload.formVariant === 'RHS-F28' ||
      Boolean(existingPayload.rhsF28);

    const currentStage = (existing.workflowStage || 'HSE_HEAD_TRIAGE') as RhsF68WorkflowStage;
    if (currentStage === 'CLOSED') {
      throw new ForbiddenError('این پرونده قبلاً تایید نهایی و مختومه شده است.');
    }
    if (
      currentStage !== 'HSE_FINAL_APPROVAL' &&
      !(isRhsF28 && currentStage === 'HSE_HEAD_TRIAGE')
    ) {
      throw new ConflictError('جمع‌بندی نهایی رئیس HSE تنها پس از ارسال پرونده به مرحله تایید نهایی امکان‌پذیر است.', {
        currentStage,
      });
    }

    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(existing.version)) {
      throw new ConflictError('این گزارش همزمان توسط کاربر دیگری تغییر یافته است.', {
        serverVersion: existing.version,
        currentRecord: existing,
      });
    }

    const decision = body.decision === 'RETURN_FOR_REVISION' ? 'RETURN_FOR_REVISION' : 'APPROVE_CLOSE';
    const returnTo: 'REPORTER' | 'EXPERT' | 'ACTION_OFFICER' = isRhsF28
      ? 'REPORTER'
      : body.returnTo === 'REPORTER'
      ? 'REPORTER'
      : body.returnTo === 'ACTION_OFFICER'
      ? 'ACTION_OFFICER'
      : 'EXPERT';

    const nextStage: RhsF68WorkflowStage =
      decision === 'APPROVE_CLOSE'
        ? 'CLOSED'
        : returnTo === 'REPORTER'
        ? 'RETURNED'
        : returnTo === 'ACTION_OFFICER'
        ? 'ACTION_IN_PROGRESS'
        : 'HSE_EXPERT_REVIEW';

    const nextStatus =
      decision === 'APPROVE_CLOSE'
        ? 'Resolved & Closed'
        : returnTo === 'ACTION_OFFICER'
        ? 'CAPA In Progress'
        : returnTo === 'REPORTER'
        ? 'Submitted'
        : 'Under Investigation';

    if (isRhsF28) {
      const existingF28 = existing.rhsF28 || existingPayload.rhsF28 || {};
      const prevF28History = Array.isArray(existingF28.auditHistory) ? existingF28.auditHistory : [];
      const headName = normalizeStr(body.finalHseHeadName || body.hseCenterHeadName) || user?.name || user?.username || 'رئیس مرکز HSE';
      const headCode = normalizeStr(body.finalHseHeadPersonnelCode || body.hseCenterHeadPersonnelCode) || user?.personnelCode || '';
      const headNotes = normalizeStr(body.conclusionNotes || body.hseCenterHeadNotes);
      const headSignature = body.finalHseHeadSignature || body.hseCenterHeadSignature || '';
      const headSignedDate = body.finalApprovedDate || body.hseCenterHeadSignedDate || new Date().toLocaleDateString('fa-IR');

      const auditEntry = buildAuditEntry(
        user,
        decision === 'APPROVE_CLOSE'
          ? 'بررسی، امضا و تایید نهایی گزارش RHS-F28 توسط رئیس مرکز HSE'
          : 'عودت گزارش RHS-F28 به گزارش‌دهنده جهت اصلاح',
        currentStage,
        nextStage,
        headNotes || undefined,
        decision === 'RETURN_FOR_REVISION'
          ? {
              referredToName: existing.reporterName || 'گزارش‌دهنده',
              referredToCode: existing.reporterPersonnelCode || undefined,
              referralNote: headNotes || undefined,
            }
          : undefined
      );

      const updatedF28 = {
        ...existingF28,
        formCode: 'RHS-F28 Rev.01' as const,
        hseCenterHeadNotes: headNotes,
        hseCenterHeadName: headName,
        hseCenterHeadPersonnelCode: headCode,
        hseCenterHeadSignature: headSignature || existingF28.hseCenterHeadSignature || '',
        hseCenterHeadSignedDate: headSignedDate,
        auditHistory: [auditEntry, ...prevF28History],
      };

      const approvedAtIso = new Date().toISOString();
      let nextSupplementaryForm = existingPayload.supplementaryForm || existing.supplementaryForm || undefined;
      let autoCreatedF34 = false;

      if (decision === 'APPROVE_CLOSE' && !nextSupplementaryForm) {
        const assignedF34ExpertCode = normalizeStr(body.assignedF34ExpertCode);
        const assignedF34ExpertName = normalizeStr(body.assignedF34ExpertName);
        nextSupplementaryForm = buildAutoRhsF34FromF28({
          incident: existing,
          f28: updatedF28,
          approverUser: user,
          approvedDateJalali: headSignedDate,
          approvedAtIso,
          assignedExpertCode: assignedF34ExpertCode,
          assignedExpertName: assignedF34ExpertName,
        });
        autoCreatedF34 = true;
      }

      const updated = await incidentRepository.create({
        ...existing,
        id: existing.id,
        incidentNumber: existing.incidentNumber,
        status: nextStatus,
        workflowStage: nextStage,
        isDraft: false,
        closedAt: decision === 'APPROVE_CLOSE' ? new Date() : null,
        payload: {
          ...existingPayload,
          workflowStage: nextStage,
          rhsF28: updatedF28,
          ...(nextSupplementaryForm
            ? {
                supplementaryForm: nextSupplementaryForm,
                supplementaryFormId: nextSupplementaryForm.id,
                supplementaryFormStatus: nextSupplementaryForm.status,
              }
            : {}),
        },
      });

      const repNum = existing.incidentNumber || String(existing.id);
      if (decision === 'RETURN_FOR_REVISION') {
        await notifyRhsF68StageAssignee({
          incidentNumber: repNum,
          title: existing.title,
          targetRole: 'REPORTER',
          targetCodes: [existing.reporterPersonnelCode || ''].filter(Boolean),
          targetNames: [existing.reporterName || ''].filter(Boolean),
          senderName: headName,
          notifTitle: `عودت گزارش حادثه / رویداد RHS-F28 جهت اصلاح: ${repNum}`,
          notifBody: `گزارش «${existing.title}» توسط رئیس مرکز HSE جهت اصلاح بازگشت داده شد. توضیح: ${headNotes || '—'}`,
          category: 'error',
          priority: 'high',
          stage: nextStage,
        });
      } else {
        await notifyRhsF68StageAssignee({
          incidentNumber: repNum,
          title: existing.title,
          targetRole: 'CLOSED_PARTIES',
          targetCodes: [existing.reporterPersonnelCode || ''].filter(Boolean),
          targetNames: [existing.reporterName || ''].filter(Boolean),
          senderName: headName,
          notifTitle: `تایید و امضای گزارش RHS-F28: ${repNum}`,
          notifBody: `گزارش حادثه / رویداد «${existing.title}» توسط رئیس مرکز HSE (${headName}) تایید و امضا شد و پرونده تجزیه و تحلیل حادثه (RHS-F34) به‌صورت خودکار ایجاد گردید.`,
          category: 'success',
          priority: 'medium',
          stage: nextStage,
        });

        if (autoCreatedF34 && nextSupplementaryForm) {
          try {
            const expertCodes = [nextSupplementaryForm.assignedExpertCode].filter(Boolean);
            const expertNames = [nextSupplementaryForm.assignedExpertName].filter(Boolean);
            const hasDirectExpert = expertCodes.length > 0 || expertNames.length > 0;
            await notificationService.send({
              title: `الزام تکمیل تجزیه و تحلیل حادثه RHS-F34: ${repNum}`,
              body: `پس از تأیید نهایی گزارش حادثه ${repNum}، پرونده تجزیه و تحلیل رویداد (${nextSupplementaryForm.formNumber}) به‌صورت خودکار ایجاد شد. مهلت قانونی ۱۰ روزه تا تاریخ ${nextSupplementaryForm.deadlineDate} است.`,
              type: 'popup',
              category: 'warning',
              priority: 'high',
              sourceModule: 'incidents',
              entityType: 'INCIDENT',
              entityId: repNum,
              recordId: repNum,
              actionUrl: `#incidents?report=${encodeURIComponent(repNum)}&openF34=1`,
              targetType: hasDirectExpert ? 'users' : 'hse_experts',
              targetValues: hasDirectExpert ? [...expertCodes, ...expertNames] : [],
              sender: headName,
              metadata: {
                reportNumber: repNum,
                formNumber: nextSupplementaryForm.formNumber,
                deadlineDate: nextSupplementaryForm.deadlineDate,
              },
            });
          } catch {}
        }
      }

      try {
        await auditService.log({
          action: decision === 'APPROVE_CLOSE' ? 'RHS_F28_HEAD_APPROVE' : 'RHS_F28_HEAD_RETURN',
          module: 'INCIDENTS',
          entityType: 'INCIDENT',
          entityId: repNum,
          newValue: {
            decision,
            nextStage,
            headNotes,
            autoCreatedRhsF34: autoCreatedF34,
            rhsF34FormNumber: nextSupplementaryForm?.formNumber,
            rhsF34DeadlineDate: nextSupplementaryForm?.deadlineDate,
          },
        });
      } catch {}

      return updated;
    }

    const existingRhs = existing.rhsF68 || existingPayload.rhsF68 || {};
    const prevHistory = Array.isArray(existingRhs.auditHistory) ? existingRhs.auditHistory : [];

    const finalConclusion = {
      decision,
      conclusionNotes: normalizeStr(body.conclusionNotes),
      finalHseHeadName: normalizeStr(body.finalHseHeadName) || user?.name || user?.username || 'رئیس واحد HSE',
      finalHseHeadPersonnelCode: normalizeStr(body.finalHseHeadPersonnelCode) || user?.personnelCode || '',
      finalHseHeadSignature: body.finalHseHeadSignature || '',
      finalApprovedDate: body.finalApprovedDate || new Date().toLocaleDateString('fa-IR'),
    };

    const updatedFollowUp =
      decision === 'APPROVE_CLOSE' && existingRhs.correctiveFollowUp
        ? { ...existingRhs.correctiveFollowUp, followUpStatus: 'VERIFIED' }
        : existingRhs.correctiveFollowUp;

    const returnedTargetName =
      returnTo === 'REPORTER'
        ? existing.reporterName || 'گزارش‌دهنده'
        : returnTo === 'ACTION_OFFICER'
        ? existingRhs.correctiveFollowUp?.responsiblePerson ||
          existingRhs.correctiveFollowUp?.expertName ||
          existingRhs.hseUnitReview?.assignedExpertName ||
          'کارشناس / افسر HSE'
        : existingRhs.hseUnitReview?.assignedExpertName || 'کارشناس واحد HSE';

    const returnedTargetCode =
      returnTo === 'REPORTER'
        ? existing.reporterPersonnelCode || ''
        : returnTo === 'ACTION_OFFICER'
        ? existingRhs.correctiveFollowUp?.responsiblePersonnelCode ||
          existingRhs.hseUnitReview?.assignedExpertCode ||
          ''
        : existingRhs.hseUnitReview?.assignedExpertCode || '';

    const auditEntry = buildAuditEntry(
      user,
      decision === 'APPROVE_CLOSE'
        ? 'جمع‌بندی، تایید نهایی و اختتام پرونده توسط رئیس HSE'
        : `عودت پرونده جهت اصلاح به ${returnedTargetName}`,
      currentStage,
      nextStage,
      finalConclusion.conclusionNotes || undefined,
      decision === 'RETURN_FOR_REVISION'
        ? {
            referredToName: returnedTargetName,
            referredToCode: returnedTargetCode || undefined,
            referralNote: finalConclusion.conclusionNotes || undefined,
          }
        : undefined
    );

    const updatedRhs = {
      ...existingRhs,
      formCode: 'RHS-F68 Rev.01',
      correctiveFollowUp: updatedFollowUp,
      finalConclusion,
      auditHistory: [auditEntry, ...prevHistory],
    };

    const updated = await incidentRepository.create({
      ...existing,
      id: existing.id,
      incidentNumber: existing.incidentNumber,
      status: nextStatus,
      workflowStage: nextStage,
      isDraft: false,
      closedAt: decision === 'APPROVE_CLOSE' ? new Date() : null,
      payload: {
        ...existingPayload,
        workflowStage: nextStage,
        rhsF68: updatedRhs,
      },
    });

    const repNum = existing.incidentNumber || String(existing.id);
    if (decision === 'RETURN_FOR_REVISION') {
      await notifyRhsF68StageAssignee({
        incidentNumber: repNum,
        title: existing.title,
        targetRole: returnTo === 'REPORTER' ? 'REPORTER' : returnTo === 'ACTION_OFFICER' ? 'ACTION_OFFICER' : 'HSE_EXPERT',
        targetCodes: [returnedTargetCode].filter(Boolean),
        targetNames: [returnedTargetName].filter(Boolean),
        senderName: finalConclusion.finalHseHeadName,
        notifTitle: `عودت گزارش RHS-F68 جهت اصلاح: ${repNum}`,
        notifBody: `گزارش «${existing.title}» توسط رئیس واحد HSE جهت اصلاح/تکمیل بازگشت داده شد. توضیح: ${finalConclusion.conclusionNotes || '—'}`,
        category: 'error',
        priority: 'high',
        stage: nextStage,
      });
    } else {
      await notifyRhsF68StageAssignee({
        incidentNumber: repNum,
        title: existing.title,
        targetRole: 'CLOSED_PARTIES',
        targetCodes: [
          existing.reporterPersonnelCode || '',
          existingRhs.hseUnitReview?.assignedExpertCode || '',
          existingRhs.correctiveFollowUp?.responsiblePersonnelCode || '',
        ].filter(Boolean),
        targetNames: [
          existing.reporterName || '',
          existingRhs.hseUnitReview?.assignedExpertName || '',
          existingRhs.correctiveFollowUp?.responsiblePerson || '',
        ].filter(Boolean),
        senderName: finalConclusion.finalHseHeadName,
        notifTitle: `تایید نهایی و اختتام گزارش RHS-F68: ${repNum}`,
        notifBody: `پرونده گزارش «${existing.title}» توسط رئیس واحد HSE (${finalConclusion.finalHseHeadName}) تایید نهایی و مختومه گردید.`,
        category: 'success',
        priority: 'medium',
        stage: nextStage,
      });
    }

    try {
      await auditService.log({
        action: decision === 'APPROVE_CLOSE' ? 'HSE_FINAL_APPROVE_CLOSE' : 'HSE_FINAL_RETURN',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: existing.incidentNumber || String(existing.id),
        newValue: { decision, returnTo, nextStage, conclusionNotes: finalConclusion.conclusionNotes },
      });
    } catch {}

    return updated;
  }

  private async ensureRhsF34Consistency(inc: any): Promise<any> {
    if (!inc) return inc;
    const existingPayload = inc.incidentData || {};
    const isRhsF28 =
      inc.formVariant === 'RHS-F28' ||
      existingPayload.formVariant === 'RHS-F28' ||
      Boolean(inc.rhsF28 || existingPayload.rhsF28);
    const isClosedF28 =
      isRhsF28 && (inc.workflowStage === 'CLOSED' || inc.status === 'Resolved & Closed' || inc.status === 'CLOSED');

    let suppForm = inc.supplementaryForm || existingPayload.supplementaryForm;

    const persistSupp = async (nextSupp: any) => {
      if (!inc.id || typeof inc.id !== 'number') return;
      const mergedPayload = {
        ...existingPayload,
        supplementaryForm: nextSupp,
        supplementaryFormId: nextSupp.id,
        supplementaryFormStatus: nextSupp.status,
      };
      await incidentRepository.updateById(inc.id, { payload: mergedPayload });
    };

    // Executive rule: No finalized RHS-F28 report may exist without a linked RHS-F34 record
    if (isClosedF28 && !suppForm) {
      const f28 = inc.rhsF28 || existingPayload.rhsF28 || {};
      suppForm = buildAutoRhsF34FromF28({
        incident: inc,
        f28,
        approvedDateJalali: f28.hseCenterHeadSignedDate || inc.reportDate || getCurrentJalaliDateServer(),
        approvedAtIso: inc.closedAt ? new Date(inc.closedAt).toISOString() : inc.updatedAt || new Date().toISOString(),
      });
      await persistSupp(suppForm);
      inc = {
        ...inc,
        supplementaryForm: suppForm,
        supplementaryFormId: suppForm.id,
        supplementaryFormStatus: suppForm.status,
        incidentData: {
          ...existingPayload,
          supplementaryForm: suppForm,
          supplementaryFormId: suppForm.id,
          supplementaryFormStatus: suppForm.status,
        },
      };
    }

    if (suppForm) {
      const synced = await syncRhsF34DeadlineAndAutoNc(inc, persistSupp);
      if (synced) {
        return {
          ...inc,
          supplementaryForm: synced,
          supplementaryFormId: synced.id,
          supplementaryFormStatus: synced.status,
          incidentData: {
            ...existingPayload,
            supplementaryForm: synced,
            supplementaryFormId: synced.id,
            supplementaryFormStatus: synced.status,
          },
        };
      }
    }

    return inc;
  }

  /**
   * Save, update, assign expert, or submit RHS-F34 Incident Analysis Form for HSE Head approval.
   */
  async saveRhsF34(idOrNumber: string, body: any, user?: UserContext) {
    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError(`گزارش حادثه با شناسه '${idOrNumber}' یافت نشد.`);
    }

    if (!isHseHeadUser(user) && !isHseExpertUser(user, existing)) {
      throw new ForbiddenError('شما مجوز تکمیل یا ویرایش فرم تجزیه و تحلیل حادثه (RHS-F34) را ندارید.');
    }

    const existingPayload = existing.incidentData || {};
    const existingF28 = existing.rhsF28 || existingPayload.rhsF28 || {};
    let baseForm = existing.supplementaryForm || existingPayload.supplementaryForm;

    if (!baseForm) {
      baseForm = buildAutoRhsF34FromF28({
        incident: existing,
        f28: existingF28,
        approverUser: user,
        approvedDateJalali: existingF28.hseCenterHeadSignedDate || existing.reportDate || getCurrentJalaliDateServer(),
        approvedAtIso: existing.closedAt ? new Date(existing.closedAt).toISOString() : new Date().toISOString(),
      });
    }

    if (baseForm.status === 'completed' || baseForm.workflowStage === 'COMPLETED') {
      if (!isHseHeadUser(user) || !body.unlockCompleted) {
        throw new ForbiddenError('فرم تجزیه و تحلیل حادثه (RHS-F34) پس از تأیید نهایی قفل شده است.');
      }
    }

    const submitForApproval = Boolean(body.submitForApproval);
    const incoming = body.form && typeof body.form === 'object' ? body.form : body;

    const validSeverity = ['High', 'Medium', 'Low', 'Minimal', ''].includes(String(incoming.riskSeverityMatrix ?? ''))
      ? (incoming.riskSeverityMatrix as any)
      : baseForm.riskSeverityMatrix || '';

    const nextBriefDescription =
      incoming.briefDescription !== undefined ? normalizeStr(incoming.briefDescription) : baseForm.briefDescription || '';
    const nextDirectCauses =
      incoming.directCauses !== undefined ? normalizeStr(incoming.directCauses) : baseForm.directCauses || '';
    const nextIndirectCauses =
      incoming.indirectCauses !== undefined ? normalizeStr(incoming.indirectCauses) : baseForm.indirectCauses || '';
    const nextRootCauses =
      incoming.rootCauses !== undefined ? normalizeStr(incoming.rootCauses) : baseForm.rootCauses || '';
    const nextCapaRequired =
      incoming.capaRequiredActions !== undefined
        ? normalizeStr(incoming.capaRequiredActions)
        : baseForm.capaRequiredActions || '';

    if (submitForApproval) {
      if (!nextBriefDescription) {
        throw new ValidationError('پیش از ارسال جهت تأیید نهایی، تکمیل شرح مختصر رویداد الزامی است.');
      }
      if (!validSeverity) {
        throw new ValidationError('پیش از ارسال جهت تأیید نهایی، تعیین شدت ریسک در ماتریس شدت الزامی است.');
      }
      if (!nextDirectCauses && !nextRootCauses) {
        throw new ValidationError('پیش از ارسال جهت تأیید نهایی، ثبت حداقل علل مستقیم یا علل ریشه‌ای الزامی است.');
      }
    }

    // Server-authoritative 10-day anchor date (never let non-head override RHS-F28 final approval anchor date)
    const authoritativeStartDate =
      baseForm.f28FinalApprovedDate ||
      baseForm.startDate ||
      existingF28.hseCenterHeadSignedDate ||
      getCurrentJalaliDateServer();
    const authoritativeApprovedIso = baseForm.f28ApprovedAtIso || undefined;

    const nextWorkflowStage = submitForApproval
      ? 'PENDING_APPROVAL'
      : baseForm.workflowStage === 'RETURNED'
      ? 'IN_PROGRESS'
      : baseForm.workflowStage === 'PENDING_APPROVAL' && !isHseHeadUser(user)
      ? 'PENDING_APPROVAL'
      : 'IN_PROGRESS';

    const deadline = computeRhsF34Deadline(
      authoritativeStartDate,
      nextWorkflowStage === 'PENDING_APPROVAL' ? 'pending_approval' : 'in_progress',
      nextWorkflowStage,
      authoritativeApprovedIso
    );

    const nowStr = getCurrentJalaliDateTimeServer();
    const actorName = user?.name || user?.username || 'کارشناس HSE';
    const assignedExpertName =
      incoming.assignedExpertName !== undefined
        ? normalizeStr(incoming.assignedExpertName)
        : baseForm.assignedExpertName || baseForm.hseExpertName || '';
    const assignedExpertCode =
      incoming.assignedExpertCode !== undefined
        ? normalizeStr(incoming.assignedExpertCode)
        : baseForm.assignedExpertCode || baseForm.hseExpertPersonnelCode || '';

    const prevLogs = Array.isArray(baseForm.auditLogs) ? baseForm.auditLogs : [];
    const auditAction = submitForApproval
      ? 'submit_approval'
      : body.actionType === 'assign'
      ? 'assign'
      : body.actionType === 'draft_save'
      ? 'draft_save'
      : 'update';

    const auditEntry = {
      id: `f34-aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user: actorName,
      userCode: user?.personnelCode || '',
      role: user?.role || 'SAFETY_OFFICER',
      action: auditAction,
      actionFa: submitForApproval
        ? 'تکمیل تجزیه و تحلیل حادثه (RHS-F34) و ارسال جهت تأیید رئیس HSE'
        : body.actionType === 'assign'
        ? `ارجاع پرونده RHS-F34 به کارشناس HSE (${assignedExpertName || 'تعیین‌نشده'})`
        : 'ذخیره و بروزرسانی اطلاعات فرم تجزیه و تحلیل حادثه (RHS-F34)',
      timestamp: nowStr,
      outcome: submitForApproval ? 'در انتظار تأیید نهایی رئیس HSE' : 'در حال تکمیل تحلیل',
      details:
        normalizeStr(body.auditNote) ||
        (submitForApproval
          ? `شدت ریسک: ${validSeverity} | کارشناس تحلیل‌گر: ${normalizeStr(incoming.hseExpertName) || actorName}`
          : undefined),
    };

    const nextForm = {
      ...baseForm,
      formCode: 'RHS – F34',
      revision: '00',
      formNumber: normalizeStr(incoming.formNumber) || baseForm.formNumber,
      formDate: normalizeStr(incoming.formDate) || baseForm.formDate || getCurrentJalaliDateServer().replace(/\//g, '.'),
      distributionList:
        normalizeStr(incoming.distributionList) ||
        baseForm.distributionList ||
        'توزیع نسخ: ۱- مدیریت امور مجتمع  ۲- واحد HSE  ۳- امور اداری',

      eventDate: incoming.eventDate !== undefined ? normalizeStr(incoming.eventDate) : baseForm.eventDate,
      eventTime: incoming.eventTime !== undefined ? normalizeStr(incoming.eventTime) : baseForm.eventTime,
      exactLocation: incoming.exactLocation !== undefined ? normalizeStr(incoming.exactLocation) : baseForm.exactLocation,
      reportDate: incoming.reportDate !== undefined ? normalizeStr(incoming.reportDate) : baseForm.reportDate,
      reportTime: incoming.reportTime !== undefined ? normalizeStr(incoming.reportTime) : baseForm.reportTime,
      locationOccurrence:
        incoming.locationOccurrence !== undefined ? normalizeStr(incoming.locationOccurrence) : baseForm.locationOccurrence,
      reporterNameAndRole:
        incoming.reporterNameAndRole !== undefined ? normalizeStr(incoming.reporterNameAndRole) : baseForm.reporterNameAndRole,
      victimOrgUnit: incoming.victimOrgUnit !== undefined ? normalizeStr(incoming.victimOrgUnit) : baseForm.victimOrgUnit,
      activityDuringIncident:
        incoming.activityDuringIncident !== undefined
          ? normalizeStr(incoming.activityDuringIncident)
          : baseForm.activityDuringIncident,
      victimCount: incoming.victimCount !== undefined ? incoming.victimCount : baseForm.victimCount,

      estimatedLoss: incoming.estimatedLoss !== undefined ? normalizeStr(incoming.estimatedLoss) : baseForm.estimatedLoss,
      briefDescription: nextBriefDescription,
      riskSeverityMatrix: validSeverity,
      directCauses: nextDirectCauses,
      indirectCauses: nextIndirectCauses,
      rootCauses: nextRootCauses,

      victimName: incoming.victimName !== undefined ? normalizeStr(incoming.victimName) : baseForm.victimName,
      victimPersonnelCode:
        incoming.victimPersonnelCode !== undefined ? normalizeStr(incoming.victimPersonnelCode) : baseForm.victimPersonnelCode,
      victimDepartment:
        incoming.victimDepartment !== undefined ? normalizeStr(incoming.victimDepartment) : baseForm.victimDepartment,
      victimWorkExperience:
        incoming.victimWorkExperience !== undefined
          ? normalizeStr(incoming.victimWorkExperience)
          : baseForm.victimWorkExperience,
      injuryType: incoming.injuryType !== undefined ? normalizeStr(incoming.injuryType) : baseForm.injuryType,
      injuredBodyPart:
        incoming.injuredBodyPart !== undefined ? normalizeStr(incoming.injuredBodyPart) : baseForm.injuredBodyPart,
      medicalTreatment:
        incoming.medicalTreatment !== undefined ? normalizeStr(incoming.medicalTreatment) : baseForm.medicalTreatment,
      lostWorkDays: incoming.lostWorkDays !== undefined ? incoming.lostWorkDays : baseForm.lostWorkDays,

      capaFormNumber: incoming.capaFormNumber !== undefined ? normalizeStr(incoming.capaFormNumber) : baseForm.capaFormNumber,
      capaRequiredActions: nextCapaRequired,

      startDate: authoritativeStartDate,
      endDate: incoming.endDate !== undefined && normalizeStr(incoming.endDate) ? normalizeStr(incoming.endDate) : deadline.deadlineDate,
      f28FinalApprovedDate: authoritativeStartDate,
      f28ApprovedAtIso: authoritativeApprovedIso,

      hseExpertName:
        incoming.hseExpertName !== undefined
          ? normalizeStr(incoming.hseExpertName)
          : baseForm.hseExpertName || assignedExpertName || actorName,
      hseExpertPersonnelCode:
        incoming.hseExpertPersonnelCode !== undefined
          ? normalizeStr(incoming.hseExpertPersonnelCode)
          : baseForm.hseExpertPersonnelCode || assignedExpertCode || user?.personnelCode || '',
      hseExpertSignature:
        incoming.hseExpertSignature !== undefined ? incoming.hseExpertSignature : baseForm.hseExpertSignature || '',
      hseExpertApproved: submitForApproval ? true : Boolean(baseForm.hseExpertApproved),

      assignedExpertCode,
      assignedExpertName,
      attachments: Array.isArray(incoming.attachments) ? incoming.attachments : baseForm.attachments || [],

      workflowStage: nextWorkflowStage,
      status: deadline.computedStatus,
      deadlineDate: deadline.deadlineDate,
      daysPassed: deadline.daysPassed,
      daysRemaining: deadline.daysRemaining,
      isNearDeadline: deadline.isNearDeadline,
      isExpired: deadline.isExpired,

      auditLogs: [...prevLogs, auditEntry],
      updatedAt: nowStr,
    };

    const updated = await incidentRepository.create({
      ...existing,
      id: existing.id,
      incidentNumber: existing.incidentNumber,
      payload: {
        ...existingPayload,
        supplementaryForm: nextForm,
        supplementaryFormId: nextForm.id,
        supplementaryFormStatus: nextForm.status,
      },
    });

    const synced = await this.ensureRhsF34Consistency(updated);

    const repNum = existing.incidentNumber || String(existing.id);
    if (submitForApproval) {
      try {
        await notificationService.send({
          title: `آماده تأیید نهایی تجزیه و تحلیل حادثه RHS-F34: ${repNum}`,
          body: `فرم تجزیه و تحلیل رویداد (${nextForm.formNumber}) مرتبط با حادثه ${repNum} توسط ${actorName} تکمیل و جهت بررسی و تأیید نهایی به کارتابل رئیس HSE ارسال گردید.`,
          type: 'popup',
          category: 'warning',
          priority: 'high',
          sourceModule: 'incidents',
          entityType: 'INCIDENT',
          entityId: repNum,
          recordId: repNum,
          actionUrl: `#incidents?report=${encodeURIComponent(repNum)}&openF34=1`,
          targetType: 'roles',
          targetValues: ['HSE_MANAGER', 'EXECUTIVE_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
          sender: actorName,
        });
      } catch {}
    } else if (body.actionType === 'assign' && (assignedExpertCode || assignedExpertName)) {
      try {
        await notificationService.send({
          title: `ارجاع پرونده تجزیه و تحلیل حادثه RHS-F34: ${repNum}`,
          body: `پرونده تجزیه و تحلیل حادثه ${repNum} با مهلت قانونی تا ${nextForm.deadlineDate} به شما ارجاع داده شد.`,
          type: 'popup',
          category: 'warning',
          priority: 'high',
          sourceModule: 'incidents',
          entityType: 'INCIDENT',
          entityId: repNum,
          recordId: repNum,
          actionUrl: `#incidents?report=${encodeURIComponent(repNum)}&openF34=1`,
          targetType: 'users',
          targetValues: [assignedExpertCode, assignedExpertName].filter(Boolean),
          sender: actorName,
        });
      } catch {}
    }

    try {
      await auditService.log({
        action: submitForApproval ? 'RHS_F34_SUBMIT_APPROVAL' : 'RHS_F34_UPDATE',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: repNum,
        newValue: {
          formNumber: nextForm.formNumber,
          workflowStage: nextForm.workflowStage,
          status: nextForm.status,
          riskSeverityMatrix: nextForm.riskSeverityMatrix,
        },
      });
    } catch {}

    return synced;
  }

  /**
   * HSE Head review of RHS-F34: Final Approval or Return for Revision (preserving all prior audit history).
   */
  async reviewRhsF34(idOrNumber: string, body: any, user?: UserContext) {
    if (!isHseHeadUser(user)) {
      throw new ForbiddenError('تنها رئیس واحد HSE یا مدیر سامانه مجاز به تأیید نهایی یا عودت فرم RHS-F34 است.');
    }

    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError(`گزارش حادثه با شناسه '${idOrNumber}' یافت نشد.`);
    }

    const existingPayload = existing.incidentData || {};
    const baseForm = existing.supplementaryForm || existingPayload.supplementaryForm;
    if (!baseForm) {
      throw new NotFoundError('پرونده تجزیه و تحلیل حادثه (RHS-F34) برای این گزارش ایجاد نشده است.');
    }

    const decision: 'APPROVE' | 'RETURN' = body.decision === 'RETURN' ? 'RETURN' : 'APPROVE';
    const reviewNotes = normalizeStr(body.reviewNotes || body.notes);
    if (decision === 'RETURN' && !reviewNotes) {
      throw new ValidationError('در صورت عودت پرونده جهت اصلاح، درج علت و توضیحات اصلاحی الزامی است.');
    }

    const nowStr = getCurrentJalaliDateTimeServer();
    const todayJalali = getCurrentJalaliDateServer();
    const reviewerName = normalizeStr(body.reviewerName) || user?.name || user?.username || 'رئیس مرکز HSE';
    const reviewerCode = normalizeStr(body.reviewerCode) || user?.personnelCode || '';
    const prevLogs = Array.isArray(baseForm.auditLogs) ? baseForm.auditLogs : [];

    const nextWorkflowStage = decision === 'APPROVE' ? 'COMPLETED' : 'RETURNED';
    const anchorDate = baseForm.f28FinalApprovedDate || baseForm.startDate || todayJalali;
    const deadline = computeRhsF34Deadline(
      anchorDate,
      decision === 'APPROVE' ? 'completed' : 'returned',
      nextWorkflowStage,
      baseForm.f28ApprovedAtIso
    );

    const auditEntry = {
      id: `f34-rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user: reviewerName,
      userCode: reviewerCode,
      role: user?.role || 'HSE_MANAGER',
      action: decision === 'APPROVE' ? 'approve' : 'return',
      actionFa:
        decision === 'APPROVE'
          ? 'تأیید نهایی و اختتام تجزیه و تحلیل حادثه (RHS-F34) توسط رئیس HSE'
          : 'عودت پرونده تجزیه و تحلیل حادثه (RHS-F34) جهت اصلاح بدون حذف سوابق',
      timestamp: nowStr,
      outcome: decision === 'APPROVE' ? 'تکمیل و تأیید نهایی شد' : 'عودت شده جهت اصلاح به کارشناس HSE',
      details: reviewNotes || (decision === 'APPROVE' ? 'کلیه بخش‌های تحلیل حادثه و اقدامات اصلاحی تأیید شد.' : undefined),
    };

    const nextForm = {
      ...baseForm,
      workflowStage: nextWorkflowStage,
      status: deadline.computedStatus,
      deadlineDate: deadline.deadlineDate,
      daysPassed: deadline.daysPassed,
      daysRemaining: deadline.daysRemaining,
      isNearDeadline: deadline.isNearDeadline,
      isExpired: deadline.isExpired,
      hseExpertApproved: decision === 'APPROVE' ? true : baseForm.hseExpertApproved,
      hseHeadReviewerName: reviewerName,
      hseHeadReviewerCode: reviewerCode,
      hseHeadSignature: body.signature || baseForm.hseHeadSignature || '',
      hseHeadReviewNotes: reviewNotes,
      hseHeadApprovedAt: decision === 'APPROVE' ? nowStr : baseForm.hseHeadApprovedAt,
      completedAt: decision === 'APPROVE' ? nowStr : baseForm.completedAt,
      completedBy: decision === 'APPROVE' ? reviewerName : baseForm.completedBy,
      endDate: decision === 'APPROVE' ? baseForm.endDate || todayJalali : baseForm.endDate,
      auditLogs: [...prevLogs, auditEntry],
      updatedAt: nowStr,
    };

    const updated = await incidentRepository.create({
      ...existing,
      id: existing.id,
      incidentNumber: existing.incidentNumber,
      payload: {
        ...existingPayload,
        supplementaryForm: nextForm,
        supplementaryFormId: nextForm.id,
        supplementaryFormStatus: nextForm.status,
      },
    });

    const repNum = existing.incidentNumber || String(existing.id);
    try {
      const targetValues = [
        nextForm.assignedExpertCode,
        nextForm.assignedExpertName,
        nextForm.hseExpertPersonnelCode,
        nextForm.hseExpertName,
      ].filter(Boolean);
      await notificationService.send({
        title:
          decision === 'APPROVE'
            ? `تأیید نهایی تجزیه و تحلیل حادثه RHS-F34: ${repNum}`
            : `عودت فرم تجزیه و تحلیل حادثه RHS-F34 جهت اصلاح: ${repNum}`,
        body:
          decision === 'APPROVE'
            ? `پرونده تجزیه و تحلیل حادثه (${nextForm.formNumber}) توسط ${reviewerName} تأیید نهایی شد.`
            : `پرونده تجزیه و تحلیل حادثه (${nextForm.formNumber}) توسط ${reviewerName} جهت اصلاح بازگشت داده شد. توضیح: ${reviewNotes}`,
        type: 'popup',
        category: decision === 'APPROVE' ? 'success' : 'error',
        priority: decision === 'APPROVE' ? 'medium' : 'high',
        sourceModule: 'incidents',
        entityType: 'INCIDENT',
        entityId: repNum,
        recordId: repNum,
        actionUrl: `#incidents?report=${encodeURIComponent(repNum)}&openF34=1`,
        targetType: targetValues.length > 0 ? 'users' : 'hse_experts',
        targetValues,
        sender: reviewerName,
      });
    } catch {}

    try {
      await auditService.log({
        action: decision === 'APPROVE' ? 'RHS_F34_APPROVE' : 'RHS_F34_RETURN',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: repNum,
        newValue: { decision, reviewNotes, formNumber: nextForm.formNumber },
      });
    } catch {}

    return updated;
  }

  /**
   * Update linked overdue Non-Conformity (follow-up owner, due date, corrective actions, status) from RHS-F34.
   */
  async updateRhsF34NonConformance(idOrNumber: string, body: any, user?: UserContext) {
    if (!isHseHeadUser(user) && !isHseExpertUser(user)) {
      throw new ForbiddenError('شما مجوز مدیریت عدم انطباق مرتبط با تحلیل حادثه را ندارید.');
    }

    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    if (!existing) {
      throw new NotFoundError(`گزارش حادثه با شناسه '${idOrNumber}' یافت نشد.`);
    }

    const existingPayload = existing.incidentData || {};
    const baseForm = existing.supplementaryForm || existingPayload.supplementaryForm;
    if (!baseForm || !baseForm.nonConformanceId) {
      throw new NotFoundError('عدم انطباق مرتبطی برای این پرونده RHS-F34 ثبت نشده است.');
    }

    const actorName = user?.name || user?.username || 'کارشناس HSE';
    const updatedNc = await updateLinkedRhsF34NonConformance({
      ncId: baseForm.nonConformanceId,
      patch: {
        assignedTo: body.assignedTo !== undefined ? normalizeStr(body.assignedTo) : undefined,
        assignedToName: body.assignedToName !== undefined ? normalizeStr(body.assignedToName) : undefined,
        dueDate: body.dueDate !== undefined ? normalizeStr(body.dueDate) : undefined,
        correctiveAction: body.correctiveAction !== undefined ? normalizeStr(body.correctiveAction) : undefined,
        preventiveAction: body.preventiveAction !== undefined ? normalizeStr(body.preventiveAction) : undefined,
        status: body.status !== undefined ? normalizeStr(body.status) : undefined,
        notes: normalizeStr(body.notes),
      },
      username: actorName,
    });

    const nowStr = getCurrentJalaliDateTimeServer();
    const prevLogs = Array.isArray(baseForm.auditLogs) ? baseForm.auditLogs : [];
    const nextForm = {
      ...baseForm,
      nonConformanceStatus: updatedNc?.status || body.status || baseForm.nonConformanceStatus,
      nonConformanceAssignedTo: updatedNc?.assignedTo ?? body.assignedTo ?? baseForm.nonConformanceAssignedTo,
      nonConformanceAssignedToName:
        updatedNc?.assignedToName ?? body.assignedToName ?? baseForm.nonConformanceAssignedToName,
      nonConformanceDueDate: updatedNc?.dueDate ?? body.dueDate ?? baseForm.nonConformanceDueDate,
      nonConformanceCorrectiveAction:
        updatedNc?.correctiveAction ?? body.correctiveAction ?? baseForm.nonConformanceCorrectiveAction,
      auditLogs: [
        ...prevLogs,
        {
          id: `f34-nc-upd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          user: actorName,
          userCode: user?.personnelCode || '',
          role: user?.role || 'HSE_MANAGER',
          action: 'update_nc',
          actionFa: `بروزرسانی عدم انطباق تأخیر (${baseForm.nonConformanceTrackingCode || baseForm.nonConformanceId})`,
          timestamp: nowStr,
          outcome: `مسئول پیگیری: ${updatedNc?.assignedToName || body.assignedToName || '—'} | مهلت: ${updatedNc?.dueDate || body.dueDate || '—'}`,
          details: normalizeStr(body.correctiveAction) || undefined,
        },
      ],
      updatedAt: nowStr,
    };

    const updated = await incidentRepository.create({
      ...existing,
      id: existing.id,
      incidentNumber: existing.incidentNumber,
      payload: {
        ...existingPayload,
        supplementaryForm: nextForm,
        supplementaryFormId: nextForm.id,
        supplementaryFormStatus: nextForm.status,
      },
    });

    return { incident: updated, nonConformance: updatedNc };
  }

  async getAllIncidents() {
    const records = await incidentRepository.findAll();
    const synced: any[] = [];
    for (const rec of records) {
      synced.push(await this.ensureRhsF34Consistency(rec));
    }
    return synced;
  }

  async getIncidentByNumber(incidentNumber: string) {
    let inc = await incidentRepository.findByIdOrNumber(incidentNumber);
    if (!inc) {
      throw new NotFoundError(`گزارش حادثه با شماره '${incidentNumber}' یافت نشد.`);
    }

    inc = await this.ensureRhsF34Consistency(inc);

    const entityKey = inc.incidentNumber || String(inc.id);
    const workflow = await workflowService.getInstanceByEntity('INCIDENT', entityKey);
    const files = await fileService.getFilesForEntity('INCIDENT', entityKey);

    return {
      ...inc,
      workflow,
      files,
    };
  }

  async addCAPAAction(incidentNumber: string, action: CAPAItem, user?: UserContext) {
    const inc = await this.getIncidentByNumber(incidentNumber);
    const existingCapa = inc.incidentData?.capaActions || inc.capaList || [];
    existingCapa.push(action);

    await incidentRepository.updateStatus(inc.incidentNumber || incidentNumber, inc.status, {
      ...inc.incidentData,
      capaActions: existingCapa,
    });

    await auditService.log({
      action: 'ADD_CAPA',
      module: 'INCIDENTS',
      entityType: 'INCIDENT',
      entityId: inc.incidentNumber || incidentNumber,
      newValue: action,
    });

    return existingCapa;
  }

  async getA4PrintableReport(incidentNumber: string) {
    const incident = await this.getIncidentByNumber(incidentNumber);
    const verification = incident.workflow
      ? await workflowService.getA4PrintableVerification(incident.workflow.id)
      : null;

    return {
      incident,
      verification,
      printMetadata: {
        paperSize: 'A4',
        orientation: 'portrait',
        formCode:
          incident?.formVariant === 'RHS-F28' || Boolean(incident?.rhsF28)
            ? 'RHS-F28 Rev.01'
            : 'RHS-F68 Rev.01',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async deleteIncident(idOrNumber: string | number, user?: UserContext) {
    const existing = await incidentRepository.findByIdOrNumber(idOrNumber);
    // Allow draft creator to delete their own draft; otherwise require HSE/Admin roles
    if (existing) {
      const canAdminDelete = isHseHeadUser(user) || isHseExpertUser(user, existing);
      if (!canAdminDelete && !(existing.isDraft && isReporterOwner(user, existing))) {
        throw new ForbiddenError('شما مجوز حذف این گزارش را ندارید.');
      }
    }

    const result = await incidentRepository.delete(idOrNumber);
    try {
      await auditService.log({
        action: 'DELETE_INCIDENT',
        module: 'INCIDENTS',
        entityType: 'INCIDENT',
        entityId: String(idOrNumber),
        details: { deletedBy: user?.name || user?.username || 'system' },
      });
    } catch {}
    return result;
  }
}

export const incidentService = new IncidentService();
