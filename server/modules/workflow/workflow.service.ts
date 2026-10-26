import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { workflowRepository } from './workflow.repository.ts';
import {
  CreateWorkflowInstanceRequest,
  ExecuteWorkflowActionRequest,
  WorkflowInstanceDTO,
  WorkflowStatus,
  StepStatus,
} from './workflow.types.ts';
import { notificationService } from '../notifications/notification.service.ts';
import { auditService } from '../audit/audit.service.ts';
import { NotFoundError, ValidationError, ForbiddenError } from '../../core/errors.ts';
import { UserContext } from '../../core/middleware/auth.ts';
import { logger } from '../../core/logger.ts';

export class WorkflowService {
  async createInstance(req: CreateWorkflowInstanceRequest, user?: UserContext): Promise<WorkflowInstanceDTO> {
    if (!req.steps || req.steps.length === 0) {
      throw new ValidationError('حداقل یک مرحله برای گردش کار باید تعریف شود.');
    }

    const instance = await workflowRepository.createInstanceWithSteps({
      instance: {
        workflowKey: req.workflowKey,
        entityType: req.entityType,
        entityId: req.entityId,
        entityNumber: req.entityNumber,
        title: req.title,
        status: 'IN_PROGRESS',
        currentStepOrder: 1,
        priority: req.priority || 'NORMAL',
        requesterId: user?.id,
        requesterName: req.requesterName || user?.name || 'کاربر سیستم',
        requesterPersonnelCode: req.requesterPersonnelCode || user?.personnelCode,
        isLocked: false,
        version: 1,
        deadline: req.deadline,
        metadata: req.metadata || {},
      },
      steps: req.steps.map((s) => ({
        stepOrder: s.stepOrder,
        stepName: s.stepName,
        stepType: s.stepType,
        assignedRole: s.assignedRole,
        assignedDepartment: s.assignedDepartment,
        assignedUserId: s.assignedUserId,
        assignedPersonnelCode: s.assignedPersonnelCode,
        status: s.stepOrder === 1 ? 'IN_PROGRESS' : 'PENDING',
        deadline: s.deadlineHours
          ? new Date(Date.now() + s.deadlineHours * 3600 * 1000).toISOString()
          : undefined,
      })),
    });

    // Add initial history
    await workflowRepository.addHistory({
      instanceId: instance.id,
      action: 'SUBMIT',
      actorName: instance.requesterName || 'ایجادکننده',
      actorRole: user?.role || 'REQUESTER',
      actorPersonnelCode: instance.requesterPersonnelCode,
      comment: 'ثبت و آغاز گردش‌کار سند در سامانه',
    });

    // Notify assigned role/user of step 1
    const firstStep = instance.steps?.[0];
    if (firstStep) {
      await notificationService.send({
        title: `ارجاع سند جدید: ${instance.title}`,
        body: `سند شماره ${instance.entityNumber || instance.entityId} جهت مرحله "${firstStep.stepName}" به کارتابل شما ارجاع گردید.`,
        type: 'REFERRAL',
        targetType: firstStep.assignedRole ? 'roles' : 'all',
        targetValues: firstStep.assignedRole ? [firstStep.assignedRole] : undefined,
        sender: instance.requesterName,
        entityType: instance.entityType,
        entityId: instance.entityId,
      });
    }

    await auditService.log({
      action: 'CREATE_WORKFLOW',
      module: 'WORKFLOW',
      entityType: instance.entityType,
      entityId: instance.entityId,
      newValue: { workflowId: instance.id, title: instance.title },
    });

    return (await workflowRepository.findInstanceById(instance.id))!;
  }

  async executeAction(
    instanceId: number,
    req: ExecuteWorkflowActionRequest,
    user?: UserContext,
    ipAddress?: string
  ): Promise<WorkflowInstanceDTO> {
    const instance = await workflowRepository.findInstanceById(instanceId);
    if (!instance) {
      throw new NotFoundError('گردش کار مورد نظر یافت نشد.');
    }

    if (instance.isLocked && req.action !== 'RETURN') {
      throw new ForbiddenError('این سند به دلیل تکمیل مراحل و نهایی شدن امضاها قفل شده است و قابل تغییر نمی‌باشد.');
    }

    const currentStep = instance.steps?.find((s) => s.stepOrder === instance.currentStepOrder);
    const actorName = user?.name || 'مسئول تایید';
    const actorRole = user?.role || currentStep?.assignedRole || 'HSE_OFFICER';
    const actorPersonnelCode = user?.personnelCode || currentStep?.assignedPersonnelCode;

    // Handle different actions
    switch (req.action) {
      case 'APPROVE':
      case 'SIGN':
      case 'APPROVE_SIGN': {
        if (currentStep) {
          await workflowRepository.updateStepStatus(currentStep.id, {
            status: 'APPROVED',
            completedBy: actorName,
            completedByRole: actorRole,
            comment: req.comment,
            completedAt: new Date().toISOString(),
          });
        }

        // If action is sign or approve_sign, generate electronic signature record
        let verificationCode = '';
        if (req.action === 'SIGN' || req.action === 'APPROVE_SIGN') {
          verificationCode = `VER-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
          const signatureHash = crypto
            .createHash('sha256')
            .update(`${instanceId}-${currentStep?.id}-${actorName}-${Date.now()}`)
            .digest('hex');

          await workflowRepository.addSignature({
            instanceId,
            stepId: currentStep?.id,
            signerName: actorName,
            signerRole: actorRole,
            signerPersonnelCode: actorPersonnelCode,
            signerDepartment: user?.department || currentStep?.assignedDepartment,
            signatureType: 'ELECTRONIC',
            signatureData: req.signatureData || signatureHash,
            verificationCode,
            ipAddress,
          });
        }

        // Record history
        await workflowRepository.addHistory({
          instanceId,
          stepId: currentStep?.id,
          action: req.action,
          actorName,
          actorRole,
          actorPersonnelCode,
          comment: req.comment || (req.action.includes('SIGN') ? 'تایید و امضای الکترونیک سند' : 'تایید مرحله گردش کار'),
          ipAddress,
        });

        // Determine next step
        const nextStep = instance.steps?.find((s) => s.stepOrder === instance.currentStepOrder + 1);
        if (nextStep) {
          // Progress to next step
          await workflowRepository.updateStepStatus(nextStep.id, {
            status: 'IN_PROGRESS',
          });
          await workflowRepository.updateInstanceStatus(instanceId, {
            currentStepOrder: nextStep.stepOrder,
            status: 'IN_PROGRESS',
          });

          // Notify next step assignee
          await notificationService.send({
            title: `ارجاع مرحله بعدی: ${instance.title}`,
            body: `مرحله قبلی توسط ${actorName} تایید شد. مرحله "${nextStep.stepName}" در انتظار اقدام شماست.`,
            type: 'REFERRAL',
            targetType: nextStep.assignedRole ? 'roles' : 'all',
            targetValues: nextStep.assignedRole ? [nextStep.assignedRole] : undefined,
            sender: actorName,
            entityType: instance.entityType,
            entityId: instance.entityId,
          });
        } else {
          // Final step reached -> Complete & Lock
          await workflowRepository.updateInstanceStatus(instanceId, {
            status: 'APPROVED',
            isLocked: true,
            completedAt: new Date().toISOString(),
          });

          await notificationService.send({
            title: `گردش کار تکمیل و تایید نهایی شد: ${instance.title}`,
            body: `کلیه مراحل و امضاهای سند شماره ${instance.entityNumber || instance.entityId} تکمیل و نسخه نهایی قفل شد.`,
            type: 'WORKFLOW_COMPLETED',
            targetType: 'all',
            sender: actorName,
            entityType: instance.entityType,
            entityId: instance.entityId,
          });
        }
        break;
      }

      case 'REJECT': {
        if (currentStep) {
          await workflowRepository.updateStepStatus(currentStep.id, {
            status: 'REJECTED',
            completedBy: actorName,
            completedByRole: actorRole,
            comment: req.comment,
            completedAt: new Date().toISOString(),
          });
        }

        await workflowRepository.updateInstanceStatus(instanceId, {
          status: 'REJECTED',
        });

        await workflowRepository.addHistory({
          instanceId,
          stepId: currentStep?.id,
          action: 'REJECT',
          actorName,
          actorRole,
          actorPersonnelCode,
          comment: req.comment || 'رد درخواست در گردش کار',
          ipAddress,
        });

        await notificationService.send({
          title: `درخواست رد شد: ${instance.title}`,
          body: `سند شماره ${instance.entityNumber || instance.entityId} توسط ${actorName} رد شد. دلیل: ${req.comment || 'بدون توضیح'}`,
          type: 'REJECTION',
          targetType: 'all',
          sender: actorName,
          entityType: instance.entityType,
          entityId: instance.entityId,
        });
        break;
      }

      case 'RETURN': {
        // Return for revision (ارجاع مجدد جهت اصلاح)
        if (currentStep) {
          await workflowRepository.updateStepStatus(currentStep.id, {
            status: 'RETURNED',
            completedBy: actorName,
            completedByRole: actorRole,
            comment: req.comment,
            completedAt: new Date().toISOString(),
          });
        }

        // Return to initial step and increment version
        const newVersion = instance.version + 1;
        await workflowRepository.updateInstanceStatus(instanceId, {
          status: 'RETURNED',
          currentStepOrder: 1,
          isLocked: false,
          version: newVersion,
        });

        // Reset step 1 to in_progress
        const firstStep = instance.steps?.find((s) => s.stepOrder === 1);
        if (firstStep) {
          await workflowRepository.updateStepStatus(firstStep.id, {
            status: 'IN_PROGRESS',
          });
        }

        await workflowRepository.addHistory({
          instanceId,
          stepId: currentStep?.id,
          action: 'RETURN',
          actorName,
          actorRole,
          actorPersonnelCode,
          comment: `ارجاع مجدد جهت بازبینی و اصلاح (نسخه جدید ${newVersion}). دلیل: ${req.comment || 'نیاز به اصلاحات'}`,
          ipAddress,
        });

        await notificationService.send({
          title: `سند عودت داده شد: ${instance.title}`,
          body: `سند جهت اصلاحات و ارسال مجدد عودت گردید (ایجاد نسخه ${newVersion}). نظر سرپرست: ${req.comment || 'اصلاح مفاد سند'}`,
          type: 'REFERRAL',
          targetType: 'all',
          sender: actorName,
          entityType: instance.entityType,
          entityId: instance.entityId,
        });
        break;
      }

      case 'REASSIGN': {
        if (currentStep && req.targetAssignee) {
          await workflowRepository.addHistory({
            instanceId,
            stepId: currentStep.id,
            action: 'REASSIGN',
            actorName,
            actorRole,
            comment: `تغییر مسئول پیگیری به ${req.targetAssignee.role || req.targetAssignee.personnelCode || 'کاربر جدید'}`,
            ipAddress,
          });
        }
        break;
      }

      case 'CANCEL': {
        await workflowRepository.updateInstanceStatus(instanceId, {
          status: 'CANCELLED',
        });
        await workflowRepository.addHistory({
          instanceId,
          stepId: currentStep?.id,
          action: 'CANCEL',
          actorName,
          actorRole,
          comment: req.comment || 'لغو فرآیند گردش کار',
          ipAddress,
        });
        break;
      }
    }

    await auditService.log({
      action: `WORKFLOW_${req.action}`,
      module: 'WORKFLOW',
      entityType: instance.entityType,
      entityId: instance.entityId,
      oldValue: { status: instance.status, currentStep: instance.currentStepOrder },
      details: { action: req.action, comment: req.comment, actor: actorName },
    });

    return (await workflowRepository.findInstanceById(instanceId))!;
  }

  async getInstanceDetails(id: number): Promise<WorkflowInstanceDTO> {
    const inst = await workflowRepository.findInstanceById(id);
    if (!inst) {
      throw new NotFoundError('گردش کار پیدا نشد.');
    }
    return inst;
  }

  async getInstanceByEntity(entityType: string, entityId: string): Promise<WorkflowInstanceDTO | null> {
    return await workflowRepository.findByEntity(entityType, entityId);
  }

  async getAllInstances(): Promise<WorkflowInstanceDTO[]> {
    return await workflowRepository.getAllInstances();
  }

  async getA4PrintableVerification(instanceId: number) {
    const instance = await this.getInstanceDetails(instanceId);
    return {
      documentTitle: instance.title,
      entityType: instance.entityType,
      entityId: instance.entityId,
      entityNumber: instance.entityNumber || instance.entityId,
      version: instance.version,
      isLocked: instance.isLocked,
      status: instance.status,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      approvalChain: instance.steps?.map((s) => ({
        step: s.stepOrder,
        title: s.stepName,
        role: s.assignedRole,
        status: s.status,
        completedBy: s.completedBy,
        completedAt: s.completedAt,
        comment: s.comment,
      })),
      signatures: instance.signatures?.map((sig) => ({
        signerName: sig.signerName,
        signerRole: sig.signerRole,
        signedAt: sig.signedAt,
        verificationCode: sig.verificationCode,
        signatureData: sig.signatureData,
      })),
      officialSeal: {
        system: 'HSE Enterprise Management Platform',
        certifiedDate: new Date().toISOString(),
        qrVerificationUrl: `/api/v1/workflows/instances/${instance.id}/a4-verification`,
      },
    };
  }
}

export const workflowService = new WorkflowService();
