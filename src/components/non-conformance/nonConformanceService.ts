/**
 * HSECORE Comprehensive Non-Conformance & CAPA Service
 * Authoritative persistence in database
 */

import { apiDb } from '../../services/apiDatabaseClient';
import { addAuditLog } from '../../utils/authHelper';
import { createDocumentReferral } from '../../utils/referralHelper';
import moment from 'moment-jalaali';

export type NonConformanceSourceModule = 
  | 'safety_inspection' 
  | 'ptw' 
  | 'incident' 
  | 'ptw_audit' 
  | '5s' 
  | 'health_env' 
  | 'fire_dept' 
  | 'general';

export type NonConformanceRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type NonConformanceWorkflowStatus = 
  | 'REGISTERED' 
  | 'UNDER_EVALUATION' 
  | 'CAPA_DEFINED' 
  | 'IN_PROGRESS' 
  | 'EFFECTIVENESS_REVIEW' 
  | 'CLOSED' 
  | 'REOPENED'
  | 'CANCELLED';

export interface StageSignatureInfo {
  signerName: string;
  signerRole?: string;
  signerId?: string;
  signedAt: string;
  signedAtJalali: string;
  signatureImage?: string;
  notes?: string;
  status: 'SIGNED' | 'REJECTED';
}

export interface CurrentStageAssignee {
  userId: string;
  userName: string;
  userRole?: string;
  department?: string;
  deadline?: string;
  instructions?: string;
  assignedAt?: string;
  assignedAtJalali?: string;
  actionType?: string;
}

export interface CancellationInfo {
  reason: string;
  cancelledBy: string;
  cancelledRole?: string;
  cancelledAt: string;
  cancelledAtJalali?: string;
  previousStatus: NonConformanceWorkflowStatus;
}

export interface WorkflowHistoryEntry {
  id?: string;
  timestamp: string;
  persianDateTime?: string;
  actor: string;
  actorRole?: string;
  action: string;
  notes: string;
  fromStage?: NonConformanceWorkflowStatus;
  toStage?: NonConformanceWorkflowStatus;
  signature?: StageSignatureInfo | null;
  assignee?: CurrentStageAssignee | null;
  cancellation?: CancellationInfo | null;
}

export interface NonConformanceRecord {
  id?: number | string;
  trackingCode: string;
  title: string;
  sourceModule: NonConformanceSourceModule;
  sourceRecordId?: string | null;
  sourceTitle?: string | null;
  unitId?: number | null;
  unitName?: string | null;
  riskLevel: NonConformanceRiskLevel;
  category?: string;
  description: string;
  evidence?: string | null;
  immediateAction?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  dueDate?: string | null;
  completionDate?: string | null;
  status: NonConformanceWorkflowStatus;
  effectivenessVerified?: boolean;
  effectivenessNotes?: string | null;
  workflowHistory?: WorkflowHistoryEntry[];
  stageSignatures?: Record<string, StageSignatureInfo>;
  currentStageAssignee?: CurrentStageAssignee | null;
  cancellationInfo?: CancellationInfo | null;
  activeReferralId?: string | null;
  attachments?: Array<{ name: string; url?: string; size?: string }>;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const SOURCE_MODULE_LABELS: Record<NonConformanceSourceModule, { fa: string; en: string; color: string }> = {
  safety_inspection: { fa: 'چک‌لیست و بازرسی ایمنی', en: 'Safety Inspection', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  ptw: { fa: 'پروانه کار ایمن (PTW)', en: 'Permit to Work', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  incident: { fa: 'گزارش شبه‌حادثه و حوادث', en: 'Incidents & Anomalies', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30' },
  ptw_audit: { fa: 'ممیزی پروانه کار (PTW Audit)', en: 'PTW Audit System', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' },
  '5s': { fa: 'ممیزی نظام ۵S آراستگی', en: '5S Audit System', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  health_env: { fa: 'بهداشت و محیط زیست', en: 'Health & Environment', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  fire_dept: { fa: 'واحد آتش‌نشانی و تجهیزات', en: 'Fire & Emergency', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  general: { fa: 'ثبت مستقیم و عمومی', en: 'General Inspection', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
};

export const RISK_LEVEL_CONFIG: Record<NonConformanceRiskLevel, { fa: string; en: string; badge: string; border: string }> = {
  LOW: { fa: 'پایین (Low)', en: 'Low', badge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500' },
  MEDIUM: { fa: 'متوسط (Medium)', en: 'Medium', badge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300', border: 'border-amber-500' },
  HIGH: { fa: 'بالا (High)', en: 'High', badge: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300', border: 'border-orange-500' },
  CRITICAL: { fa: 'بحرانی (Critical)', en: 'Critical', badge: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300', border: 'border-rose-500' },
};

export const WORKFLOW_STATUS_CONFIG: Record<NonConformanceWorkflowStatus, { fa: string; en: string; badge: string; step: number }> = {
  REGISTERED: { fa: 'ثبت اولیه', en: 'Registered', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', step: 1 },
  UNDER_EVALUATION: { fa: 'بررسی و تعیین تکلیف', en: 'Under Evaluation', badge: 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300', step: 2 },
  CAPA_DEFINED: { fa: 'ارجاع و تخصیص اقدام (CAPA)', en: 'CAPA Defined', badge: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300', step: 3 },
  IN_PROGRESS: { fa: 'اقدام اصلاحی در حال اجرا', en: 'In Progress', badge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300', step: 4 },
  EFFECTIVENESS_REVIEW: { fa: 'بررسی و تأیید اثربخشی', en: 'Effectiveness Review', badge: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300', step: 5 },
  CLOSED: { fa: 'بسته شده و اثربخش', en: 'Closed & Effective', badge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300', step: 6 },
  REOPENED: { fa: 'بازگشایی مجدد (عدم اثربخشی)', en: 'Reopened', badge: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300', step: 2 },
  CANCELLED: { fa: 'منصرف‌شده (ابطال فرآیند)', en: 'Cancelled', badge: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300', step: 0 },
};

export const WORKFLOW_STAGES_ORDER: NonConformanceWorkflowStatus[] = [
  'REGISTERED',
  'UNDER_EVALUATION',
  'CAPA_DEFINED',
  'IN_PROGRESS',
  'EFFECTIVENESS_REVIEW',
  'CLOSED'
];

export function getPreviousWorkflowStatus(current: NonConformanceWorkflowStatus): NonConformanceWorkflowStatus | null {
  switch (current) {
    case 'UNDER_EVALUATION': return 'REGISTERED';
    case 'CAPA_DEFINED': return 'UNDER_EVALUATION';
    case 'IN_PROGRESS': return 'CAPA_DEFINED';
    case 'EFFECTIVENESS_REVIEW': return 'IN_PROGRESS';
    case 'CLOSED': return 'EFFECTIVENESS_REVIEW';
    case 'REOPENED': return 'UNDER_EVALUATION';
    default: return null;
  }
}

export function getNextWorkflowStatus(current: NonConformanceWorkflowStatus): NonConformanceWorkflowStatus | null {
  switch (current) {
    case 'REGISTERED': return 'UNDER_EVALUATION';
    case 'UNDER_EVALUATION': return 'CAPA_DEFINED';
    case 'CAPA_DEFINED': return 'IN_PROGRESS';
    case 'IN_PROGRESS': return 'EFFECTIVENESS_REVIEW';
    case 'EFFECTIVENESS_REVIEW': return 'CLOSED';
    case 'REOPENED': return 'CAPA_DEFINED';
    default: return null;
  }
}

export const SOURCE_MODULE_TAB_MAP: Record<NonConformanceSourceModule, string> = {
  safety_inspection: 'safety-unit',
  ptw: 'permit',
  incident: 'incidents',
  ptw_audit: 'ptw-audit',
  '5s': 'health-env',
  health_env: 'health-env',
  fire_dept: 'fire-dept',
  general: 'dashboard'
};

export const nonConformanceService = {
  async getAll(filters?: { sourceModule?: string; status?: string; riskLevel?: string; assignedTo?: string }): Promise<NonConformanceRecord[]> {
    return apiDb.getNonConformances(filters);
  },

  async getById(id: string | number): Promise<NonConformanceRecord | null> {
    return apiDb.getNonConformanceById(id);
  },

  async create(data: Partial<NonConformanceRecord>, actor = 'کاربر سامانه'): Promise<NonConformanceRecord> {
    const created = await apiDb.createNonConformance(data);
    addAuditLog(actor, `ثبت عدم انطباق با کد رهگیری ${created?.trackingCode || 'جدید'}`, 'عدم انطباق');

    // Send in-app notification to responsible person / HSE unit
    try {
      await apiDb.saveNotification({
        notifId: `notif-nc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: `ثبت عدم انطباق جدید: ${created?.trackingCode || ''}`,
        body: `عدم انطباق «${created?.title || ''}» در واحد ${created?.unitName || 'عمومی'} با سطح ریسک ${created?.riskLevel || 'متوسط'} ثبت شد.`,
        type: 'in-app',
        priority: created?.riskLevel === 'CRITICAL' ? 'critical' : created?.riskLevel === 'HIGH' ? 'high' : 'medium',
        category: 'warning',
        sourceModule: 'non_conformances',
        actionUrl: `#non-conformances?code=${created?.trackingCode}`,
        recordId: String(created?.id || created?.trackingCode),
        targetType: created?.assignedTo ? 'user' : 'roles',
        targetValues: created?.assignedTo ? [created.assignedTo] : ['HSE_MANAGER', 'SAFETY_OFFICER']
      });
    } catch (err) {
      console.warn('Failed to dispatch notification for non-conformance:', err);
    }

    return created;
  },

  async update(id: string | number, data: Partial<NonConformanceRecord>, actor = 'کاربر سامانه'): Promise<NonConformanceRecord> {
    const updated = await apiDb.updateNonConformance(id, data);
    addAuditLog(actor, `ویرایش عدم انطباق ${updated?.trackingCode || id}`, 'عدم انطباق');
    return updated;
  },

  async advanceWorkflow(
    id: string | number, 
    nextStatus: NonConformanceWorkflowStatus, 
    note: string, 
    extraPayload: Partial<NonConformanceRecord> = {}, 
    actor = 'کارشناس HSE',
    actorRole = 'مسئول HSE'
  ): Promise<NonConformanceRecord> {
    const current = await this.getById(id);
    const history = Array.isArray(current?.workflowHistory) ? [...current.workflowHistory] : [];
    
    history.push({
      id: `wf-${Date.now()}`,
      timestamp: new Date().toISOString(),
      persianDateTime: moment().format('jYYYY/jMM/jDD HH:mm'),
      actor,
      actorRole,
      action: nextStatus,
      fromStage: current?.status,
      toStage: nextStatus,
      notes: note || `ارتقا به مرحله ${WORKFLOW_STATUS_CONFIG[nextStatus]?.fa || nextStatus}`
    });

    const updated = await this.update(id, {
      ...extraPayload,
      status: nextStatus,
      workflowHistory: history
    }, actor);

    // Notify of status transition
    try {
      await apiDb.saveNotification({
        notifId: `notif-wf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: `به‌روزرسانی گردش کار عدم انطباق: ${updated?.trackingCode}`,
        body: `وضعیت پرونده «${updated?.title}» به «${WORKFLOW_STATUS_CONFIG[nextStatus]?.fa || nextStatus}» تغییر یافت. اقدام‌کننده: ${actor}`,
        type: 'in-app',
        priority: nextStatus === 'CLOSED' ? 'low' : nextStatus === 'REOPENED' ? 'high' : 'medium',
        category: nextStatus === 'CLOSED' ? 'success' : nextStatus === 'REOPENED' ? 'error' : 'info',
        sourceModule: 'non_conformances',
        actionUrl: `#non-conformances?code=${updated?.trackingCode}`,
        recordId: String(updated?.id || updated?.trackingCode),
        targetType: 'all',
      });
    } catch (err) {
      console.warn('Failed to dispatch workflow notification:', err);
    }

    return updated;
  },

  async stepBackWorkflow(
    id: string | number,
    targetPreviousStatus: NonConformanceWorkflowStatus,
    reason: string,
    actor = 'کاربر سامانه',
    actorRole = 'مسئول ارزیابی'
  ): Promise<NonConformanceRecord> {
    const current = await this.getById(id);
    if (!current) throw new Error('پرونده عدم انطباق یافت نشد.');

    const history = Array.isArray(current.workflowHistory) ? [...current.workflowHistory] : [];
    history.push({
      id: `back-${Date.now()}`,
      timestamp: new Date().toISOString(),
      persianDateTime: moment().format('jYYYY/jMM/jDD HH:mm'),
      actor,
      actorRole,
      action: 'STEP_BACK',
      fromStage: current.status,
      toStage: targetPreviousStatus,
      notes: reason || `بازگشت به مرحله قبلی: ${WORKFLOW_STATUS_CONFIG[targetPreviousStatus]?.fa}`
    });

    const updated = await this.update(id, {
      status: targetPreviousStatus,
      workflowHistory: history
    }, actor);

    addAuditLog(actor, `بازگشت پرونده ${current.trackingCode} از مرحله ${WORKFLOW_STATUS_CONFIG[current.status]?.fa} به ${WORKFLOW_STATUS_CONFIG[targetPreviousStatus]?.fa}`, 'عدم انطباق');

    try {
      await apiDb.saveNotification({
        notifId: `notif-back-${Date.now()}`,
        title: `بازگشت پرونده عدم انطباق به مرحله قبل: ${current.trackingCode}`,
        body: `پرونده «${current.title}» توسط ${actor} به مرحله «${WORKFLOW_STATUS_CONFIG[targetPreviousStatus]?.fa}» بازگردانده شد. دلیل: ${reason}`,
        type: 'in-app',
        priority: 'high',
        category: 'warning',
        sourceModule: 'non_conformances',
        actionUrl: `#non-conformances?code=${current.trackingCode}`,
        recordId: String(current.id || current.trackingCode),
        targetType: 'all',
      });
    } catch (_) {}

    return updated;
  },

  async cancelWorkflow(
    id: string | number,
    reason: string,
    actor = 'کاربر سامانه',
    actorRole = 'مدیر / مسئول HSE'
  ): Promise<NonConformanceRecord> {
    const current = await this.getById(id);
    if (!current) throw new Error('پرونده عدم انطباق یافت نشد.');

    const now = new Date();
    const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');

    const cancellation: CancellationInfo = {
      reason,
      cancelledBy: actor,
      cancelledRole: actorRole,
      cancelledAt: now.toISOString(),
      cancelledAtJalali: persianDateTime,
      previousStatus: current.status
    };

    const history = Array.isArray(current.workflowHistory) ? [...current.workflowHistory] : [];
    history.push({
      id: `cnl-${Date.now()}`,
      timestamp: now.toISOString(),
      persianDateTime,
      actor,
      actorRole,
      action: 'CANCELLED',
      fromStage: current.status,
      toStage: 'CANCELLED',
      notes: `انصراف و ابطال پرونده: ${reason}`,
      cancellation
    });

    const updated = await this.update(id, {
      status: 'CANCELLED',
      cancellationInfo: cancellation,
      workflowHistory: history
    }, actor);

    addAuditLog(actor, `انصراف و ابطال پرونده عدم انطباق ${current.trackingCode}. دلیل: ${reason}`, 'عدم انطباق');

    try {
      await apiDb.saveNotification({
        notifId: `notif-cancel-${Date.now()}`,
        title: `انصراف و ابطال پرونده عدم انطباق: ${current.trackingCode}`,
        body: `پرونده «${current.title}» توسط ${actor} با ثبت علت «${reason}» مختومه/منصرف گردید. کلیه سوابق محفوظ است.`,
        type: 'in-app',
        priority: 'medium',
        category: 'info',
        sourceModule: 'non_conformances',
        actionUrl: `#non-conformances?code=${current.trackingCode}`,
        recordId: String(current.id || current.trackingCode),
        targetType: 'all',
      });
    } catch (_) {}

    return updated;
  },

  async recordStageSignature(
    id: string | number,
    stage: NonConformanceWorkflowStatus,
    signature: StageSignatureInfo,
    actor = 'امضاکننده'
  ): Promise<NonConformanceRecord> {
    const current = await this.getById(id);
    if (!current) throw new Error('پرونده عدم انطباق یافت نشد.');

    const stageSignatures = { ...(current.stageSignatures || {}) };
    stageSignatures[stage] = signature;

    const history = Array.isArray(current.workflowHistory) ? [...current.workflowHistory] : [];
    history.push({
      id: `sig-${Date.now()}`,
      timestamp: new Date().toISOString(),
      persianDateTime: signature.signedAtJalali || moment().format('jYYYY/jMM/jDD HH:mm'),
      actor: signature.signerName,
      actorRole: signature.signerRole,
      action: 'SIGNED',
      fromStage: stage,
      toStage: stage,
      notes: `ثبت امضای الکترونیکی مرحله «${WORKFLOW_STATUS_CONFIG[stage]?.fa || stage}» توسط ${signature.signerName} (${signature.signerRole || 'مسئول'})`,
      signature
    });

    const updated = await this.update(id, {
      stageSignatures,
      workflowHistory: history
    }, actor);

    addAuditLog(actor, `ثبت امضای دیجیتال برای مرحله ${stage} پرونده عدم انطباق ${current.trackingCode}`, 'عدم انطباق');
    return updated;
  },

  async referToUser(
    id: string | number,
    assignee: CurrentStageAssignee,
    actor = 'ارجاع‌دهنده',
    actorRole = 'کارشناس HSE'
  ): Promise<NonConformanceRecord> {
    const current = await this.getById(id);
    if (!current) throw new Error('پرونده عدم انطباق یافت نشد.');

    const now = new Date();
    const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');

    const history = Array.isArray(current.workflowHistory) ? [...current.workflowHistory] : [];
    history.push({
      id: `ref-${Date.now()}`,
      timestamp: now.toISOString(),
      persianDateTime,
      actor,
      actorRole,
      action: 'REFERRAL',
      fromStage: current.status,
      toStage: current.status,
      notes: `ارجاع به «${assignee.userName}» (${assignee.userRole || 'اقدام‌کننده'}) - مهلت: ${assignee.deadline || 'تعیین نشده'} • توضیحات: ${assignee.instructions || 'اقدام مقتضی'}`,
      assignee
    });

    let activeReferralId = current.activeReferralId || null;
    try {
      const centralRef = createDocumentReferral(
        {
          documentType: 'NON_CONFORMANCE',
          documentId: String(current.id || current.trackingCode),
          documentNumber: current.trackingCode,
          documentTitle: current.title,
          version: 'Rev 1.0',
          senderId: actor,
          senderName: actor,
          senderRole: actorRole,
          senderDepartment: current.unitName || 'HSE',
          workflowMode: 'PARALLEL',
          priority: current.riskLevel === 'CRITICAL' ? 'CRITICAL' : current.riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
          notes: assignee.instructions || 'اقدام مقتضی و پیگیری پرونده عدم انطباق',
          deadline: assignee.deadline || moment().add(3, 'days').format('jYYYY/jMM/jDD'),
          assignees: [
            {
              id: `nc-asg-${Date.now()}`,
              userId: assignee.userId,
              userName: assignee.userName,
              userRole: assignee.userRole || 'مسئول پیگیری و اقدام',
              department: assignee.department || current.unitName || 'HSE',
              personnelCode: assignee.userId,
              actionType: (assignee.actionType as any) || 'APPROVE_AND_SIGN',
              instructions: assignee.instructions || 'اقدام اصلاحی و تکمیل مستندات در سامانه عدم انطباق',
              deadline: assignee.deadline,
              status: 'PENDING',
              order: 1
            }
          ]
        },
        assignee.instructions
      );
      if (centralRef?.id) {
        activeReferralId = centralRef.id;
      }
    } catch (err) {
      console.warn('Failed to register in central cartable referral:', err);
    }

    const updated = await this.update(id, {
      assignedTo: assignee.userId,
      assignedToName: assignee.userName,
      dueDate: assignee.deadline || current.dueDate,
      activeReferralId,
      currentStageAssignee: {
        ...assignee,
        assignedAt: now.toISOString(),
        assignedAtJalali: persianDateTime
      },
      workflowHistory: history
    }, actor);

    addAuditLog(actor, `ارجاع پرونده عدم انطباق ${current.trackingCode} به ${assignee.userName}`, 'عدم انطباق');

    // Notify assignee directly
    try {
      await apiDb.saveNotification({
        notifId: `notif-ref-${Date.now()}`,
        title: `ارجاع پرونده عدم انطباق: ${current.trackingCode}`,
        body: `پرونده «${current.title}» توسط ${actor} با مهلت اقدام «${assignee.deadline || 'فوری'}» به شما ارجاع گردید.\nدستورالعمل: ${assignee.instructions || 'اقدام مقتضی'}`,
        type: 'in-app',
        priority: 'high',
        category: 'warning',
        sourceModule: 'non_conformances',
        actionUrl: `#non-conformances?code=${current.trackingCode}`,
        recordId: String(current.id || current.trackingCode),
        targetType: 'single',
        targetValues: [assignee.userId]
      });
    } catch (_) {}

    return updated;
  },

  async reopenCancelled(
    id: string | number,
    reason: string,
    targetStage: NonConformanceWorkflowStatus = 'UNDER_EVALUATION',
    actor = 'مدیر سامانه',
    actorRole = 'مدیر HSE'
  ): Promise<NonConformanceRecord> {
    const current = await this.getById(id);
    if (!current) throw new Error('پرونده عدم انطباق یافت نشد.');

    const now = new Date();
    const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');

    const history = Array.isArray(current.workflowHistory) ? [...current.workflowHistory] : [];
    history.push({
      id: `reopen-cnl-${Date.now()}`,
      timestamp: now.toISOString(),
      persianDateTime,
      actor,
      actorRole,
      action: 'REOPENED',
      fromStage: 'CANCELLED',
      toStage: targetStage,
      notes: `بازگشایی و خروج از وضعیت انصراف: ${reason || 'تصمیم مدیریت'}`,
    });

    const updated = await this.update(id, {
      status: targetStage,
      cancellationInfo: null,
      workflowHistory: history
    }, actor);

    addAuditLog(actor, `بازگشایی پرونده منصرف‌شده ${current.trackingCode} به مرحله ${WORKFLOW_STATUS_CONFIG[targetStage]?.fa}. دلیل: ${reason}`, 'عدم انطباق');
    return updated;
  },

  async sendOverdueAlert(record: NonConformanceRecord, sender = 'سیستم پایش HSE'): Promise<boolean> {
    try {
      await apiDb.saveNotification({
        notifId: `notif-overdue-${record.id || record.trackingCode}-${Date.now()}`,
        title: `هشدار سررسیدگذشته: عدم انطباق ${record.trackingCode}`,
        body: `مهلت اقدام اصلاحی پرونده «${record.title}» در تاریخ ${record.dueDate || 'نامشخص'} به اتمام رسیده است و نیازمند پیگیری فوری در واحد ${record.unitName || 'مربوطه'} است.`,
        type: 'in-app',
        priority: 'critical',
        category: 'critical_hse',
        sourceModule: 'non_conformances',
        actionUrl: `#non-conformances?code=${record.trackingCode}`,
        recordId: String(record.id || record.trackingCode),
        targetType: record.assignedTo ? 'user' : 'roles',
        targetValues: record.assignedTo ? [record.assignedTo] : ['HSE_MANAGER', 'SAFETY_OFFICER']
      });
      addAuditLog(sender, `ارسال هشدار سررسیدگذشته برای عدم انطباق ${record.trackingCode}`, 'عدم انطباق');
      return true;
    } catch (err) {
      console.error('Failed to send overdue alert:', err);
      return false;
    }
  },

  async delete(id: string | number, actor = 'مدیر سیستم'): Promise<boolean> {
    const ok = await apiDb.deleteNonConformance(id);
    if (ok) {
      addAuditLog(actor, `حذف عدم انطباق با شناسه ${id}`, 'عدم انطباق');
    }
    return ok;
  },

  async deleteBatch(ids: Array<string | number>, actor = 'مدیر سیستم'): Promise<boolean> {
    const ok = await apiDb.deleteBatchNonConformances(ids);
    if (ok) {
      addAuditLog(actor, `حذف دسته‌جمعی ${ids.length} مورد عدم انطباق`, 'عدم انطباق');
    }
    return ok;
  }
};
