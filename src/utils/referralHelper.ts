import { DocumentReferral, ReferralAssignee, ReferralHistoryLog, ReferralStatus, ReferralActionType } from '../types';
import { addAuditLog } from './authHelper';
import { getPersonnelSignature, getComplexPersonnelList, ComplexPersonnel } from './personnelHelper';
import { centralSync } from '../services/centralSyncService';
import { apiDb } from '../services/apiDatabaseClient';
import { CentralNotificationService } from '../services/notificationService';
import { normalizeForMatching } from './textNormalization';
import moment from 'moment-jalaali';

const STORAGE_KEY = 'hse_document_referrals_v1';

let memoryReferralsCache: DocumentReferral[] | null = null;

/**
 * Checks whether the current user is the System Manager or Main Application Admin
 * (مدیر سامانه و ادمین اصلی برنامه) who has global visibility across all cartables.
 */
export function isGlobalAdminUser(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim();
  const roleLower = role.toLowerCase();
  const usernameLower = String(user.username || '').trim().toLowerCase();
  const uidLower = String(user.id || user.uid || '').trim().toLowerCase();
  const jobTitle = String(user.jobTitle || '').trim();

  if (
    role === 'Administrator' ||
    role === 'Admin' ||
    role === 'SUPERADMIN' ||
    roleLower === 'administrator' ||
    roleLower === 'admin' ||
    roleLower === 'superadmin' ||
    role === 'مدیر سامانه' ||
    role === 'مدیر سیستم' ||
    role === 'مدیر ارشد' ||
    role === 'ادمین اصلی' ||
    jobTitle.includes('مدیر سامانه') ||
    jobTitle.includes('ادمین اصلی') ||
    usernameLower === 'admin' ||
    uidLower === 'user-admin'
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether a specific ReferralAssignee corresponds to the given user
 * by ID, username, personnel code, or normalized full name (with personnel registry lookup).
 */
export function isAssigneeMatchingUser(
  assignee: ReferralAssignee | undefined | null,
  user: any,
  personnelList?: ComplexPersonnel[]
): boolean {
  if (!assignee || !user) return false;

  const userId = String(user.id || user.uid || '').trim();
  const username = String(user.username || '').trim().toLowerCase();
  const personnelNumber = String(user.personnelNumber || user.personnelCode || '').trim().toLowerCase();
  const userFullName = normalizeForMatching(user.fullName || user.name || '');

  const asgId = String(assignee.userId || '').trim();
  const asgCode = String(assignee.personnelCode || '').trim().toLowerCase();
  const asgName = normalizeForMatching(assignee.userName || '');

  // 1. Direct ID or username match
  if (asgId) {
    if (userId && asgId === userId) return true;
    if (username && asgId.toLowerCase() === username) return true;
    if (personnelNumber && asgId.toLowerCase() === personnelNumber) return true;
    if (userFullName && asgId.startsWith('user-') && normalizeForMatching(decodeURIComponent(asgId.replace(/^user-(\d+-)?/, ''))) === userFullName) {
      return true;
    }
  }

  // 2. Personnel code match
  if (asgCode) {
    if (personnelNumber && asgCode === personnelNumber) return true;
    if (username && asgCode === username) return true;
    if (userId && asgCode === userId.toLowerCase()) return true;
  }

  // 3. Match via personnel registry if assignee was selected from personnel list
  const list = personnelList || getComplexPersonnelList();
  if (asgId && list.length > 0) {
    const matchedPersonnel = list.find(p => String(p.id) === asgId);
    if (matchedPersonnel) {
      const pCode = String(matchedPersonnel.personnelCode || matchedPersonnel.effectiveCode || '').trim().toLowerCase();
      if (personnelNumber && pCode && pCode === personnelNumber) return true;
      if (username && pCode && pCode === username) return true;
      if (userFullName && normalizeForMatching(matchedPersonnel.fullName) === userFullName) return true;
    }
  }

  // 4. Exact normalized full name match
  if (userFullName && asgName) {
    if (userFullName === asgName) return true;
    if (userFullName.length >= 3 && asgName.length >= 3 && (asgName === userFullName)) return true;
  }

  return false;
}

/**
 * Checks whether the given user is the sender/creator of the referral.
 */
export function isReferralSender(
  referral: DocumentReferral | undefined | null,
  user: any
): boolean {
  if (!referral || !user) return false;
  const userId = String(user.id || user.uid || '').trim();
  const username = String(user.username || '').trim().toLowerCase();
  const personnelNumber = String(user.personnelNumber || user.personnelCode || '').trim().toLowerCase();
  const userFullName = normalizeForMatching(user.fullName || user.name || '');

  const senderId = String(referral.senderId || '').trim();
  const senderName = normalizeForMatching(referral.senderName || '');

  if (senderId) {
    if (userId && senderId === userId) return true;
    if (username && senderId.toLowerCase() === username) return true;
    if (personnelNumber && senderId.toLowerCase() === personnelNumber) return true;
  }
  if (userFullName && senderName && userFullName === senderName) {
    return true;
  }
  return false;
}

/**
 * Recalculates active stage (`isCurrentActive`), `overallStatus`, and `isLocked`
 * for a referral in either SEQUENTIAL or PARALLEL workflow mode.
 */
export function recalculateReferralWorkflowState(referral: DocumentReferral): DocumentReferral {
  if (!referral || !Array.isArray(referral.assignees)) return referral;

  const isCancelled = (referral.overallStatus as string) === 'CANCELLED';
  if (isCancelled) {
    referral.assignees = referral.assignees.map((a, idx) => ({
      ...a,
      order: a.order || idx + 1,
      isCurrentActive: false
    }));
    referral.isLocked = true;
    return referral;
  }

  const anyRejected = referral.assignees.some(a => a.status === 'REJECTED');
  const allCompleted =
    referral.assignees.length > 0 &&
    referral.assignees.every(
      a =>
        a.status === 'APPROVED' ||
        a.status === 'SIGNED' ||
        a.status === 'REVIEWED' ||
        a.status === 'DELEGATED'
    );

  if (anyRejected) {
    referral.overallStatus = 'REJECTED';
    referral.isLocked = false;
    referral.assignees = referral.assignees.map((a, idx) => ({
      ...a,
      order: a.order || idx + 1,
      isCurrentActive: false
    }));
  } else if (allCompleted) {
    referral.overallStatus = 'COMPLETED';
    referral.isLocked = true;
    referral.assignees = referral.assignees.map((a, idx) => ({
      ...a,
      order: a.order || idx + 1,
      isCurrentActive: false
    }));
  } else {
    referral.overallStatus = 'IN_PROGRESS';
    referral.isLocked = false;
    const firstPendingIdx = referral.assignees.findIndex(a => a.status === 'PENDING');
    referral.assignees = referral.assignees.map((a, idx) => ({
      ...a,
      order: a.order || idx + 1,
      isCurrentActive:
        referral.workflowMode === 'PARALLEL'
          ? a.status === 'PENDING'
          : idx === firstPendingIdx
    }));
  }

  return referral;
}

/**
 * Determines whether a user is authorized to view a specific referral.
 * - System Manager & Main Admin (`isGlobalAdminUser`) can view all referrals.
 * - Regular users can ONLY view referrals where they are an assignee or the sender.
 */
export function canUserViewReferral(
  user: any,
  referral: DocumentReferral | undefined | null,
  personnelList?: ComplexPersonnel[]
): boolean {
  if (!referral || !user) return false;
  if (isGlobalAdminUser(user)) return true;
  if (isReferralSender(referral, user)) return true;
  const list = personnelList || getComplexPersonnelList();
  return (referral.assignees || []).some(a => isAssigneeMatchingUser(a, user, list));
}

/**
 * Determines whether a user is authorized to execute an action (approve, sign, reject, delegate)
 * on a specific assignee step of a referral.
 */
export function canUserActOnAssignee(
  user: any,
  referral: DocumentReferral | undefined | null,
  assignee: ReferralAssignee | undefined | null,
  personnelList?: ComplexPersonnel[]
): { allowed: boolean; reason?: string } {
  if (!user || !referral || !assignee) {
    return { allowed: false, reason: 'اطلاعات کاربر یا ارجاع نامعتبر است.' };
  }
  if (referral.isLocked || referral.overallStatus === 'COMPLETED' || (referral.overallStatus as string) === 'CANCELLED') {
    return { allowed: false, reason: 'این گردش کار مختومه و قفل شده است و امکان تغییر آن وجود ندارد.' };
  }
  if (assignee.status !== 'PENDING') {
    return { allowed: false, reason: 'این مرحله قبلاً اقدام شده است.' };
  }
  if (referral.workflowMode === 'SEQUENTIAL' && !assignee.isCurrentActive) {
    return { allowed: false, reason: 'در گردش کار ترتیبی، هنوز نوبت اقدام این مرحله فرا نرسیده است.' };
  }
  if (isGlobalAdminUser(user)) {
    return { allowed: true };
  }
  const list = personnelList || getComplexPersonnelList();
  if (!isAssigneeMatchingUser(assignee, user, list)) {
    return {
      allowed: false,
      reason: `این مرحله صرفاً به «${assignee.userName}» ارجاع شده است و شما مجاز به اقدام یا امضای جایگاه سایر کاربران نیستید.`
    };
  }
  return { allowed: true };
}

/**
 * Filters a list of referrals so non-admin users only receive referrals they are allowed to view.
 */
export function filterReferralsForUser(
  referrals: DocumentReferral[],
  user: any,
  personnelList?: ComplexPersonnel[]
): DocumentReferral[] {
  if (!Array.isArray(referrals)) return [];
  if (!user) return [];
  if (isGlobalAdminUser(user)) return referrals;
  const list = personnelList || getComplexPersonnelList();
  return referrals.filter(r => canUserViewReferral(user, r, list));
}

// Hydrate from central database sync & dedicated API when available
if (typeof window !== 'undefined') {
  window.addEventListener('hse_central_data_synced', (e: any) => {
    try {
      const settings = e.detail?.settings;
      if (Array.isArray(settings)) {
        const found = settings.find((s: any) => s.key === STORAGE_KEY);
        if (found && Array.isArray(found.value)) {
          memoryReferralsCache = found.value.map((r: DocumentReferral) => recalculateReferralWorkflowState({ ...r }));
          window.dispatchEvent(new CustomEvent('hse_document_referrals_updated', { detail: memoryReferralsCache }));
        }
      }
    } catch {
      // ignore
    }
  });

  const handleRemoteReferralMutation = (e: any) => {
    const entity = String(e?.detail?.entityType || e?.detail?.entity || e?.detail?.data?.key || '').toLowerCase();
    if (entity && (entity.includes('referral') || entity.includes('cartable') || entity.includes(STORAGE_KEY))) {
      fetchDocumentReferralsFromServer().catch(() => {});
    }
  };

  window.addEventListener('hse_data_mutated', handleRemoteReferralMutation);

  // Initial fetch from database backend
  setTimeout(() => {
    fetchDocumentReferralsFromServer().catch(() => {});
  }, 100);
}

export async function fetchDocumentReferralsFromServer(): Promise<DocumentReferral[]> {
  try {
    apiDb.invalidateCache('referrals');
    const serverList = await apiDb.getReferrals();
    if (Array.isArray(serverList)) {
      memoryReferralsCache = serverList.map(r => recalculateReferralWorkflowState({ ...r }));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_document_referrals_updated', { detail: memoryReferralsCache }));
      }
      return memoryReferralsCache;
    }
    // Fallback to setting query
    const settingVal = await apiDb.getSetting(STORAGE_KEY);
    if (Array.isArray(settingVal)) {
      memoryReferralsCache = settingVal.map((r: DocumentReferral) => recalculateReferralWorkflowState({ ...r }));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_document_referrals_updated', { detail: memoryReferralsCache }));
      }
      return memoryReferralsCache;
    }
  } catch (err) {
    console.warn('[Referrals] Failed to fetch referrals from server:', err);
  }
  return getDocumentReferrals();
}

export function getDocumentReferrals(): DocumentReferral[] {
  return memoryReferralsCache || [];
}

export function saveDocumentReferrals(referrals: DocumentReferral[]) {
  try {
    const normalized = (referrals || []).map(r => recalculateReferralWorkflowState({ ...r }));
    memoryReferralsCache = normalized;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_document_referrals_updated', { detail: normalized }));
    }
    // Authoritative persistence in database via dedicated referrals API and settings fallback
    apiDb.saveReferrals(normalized).catch(() => {});
    apiDb.saveSetting(STORAGE_KEY, normalized, 'HSE Document Referrals and Digital Signatures').catch(() => {});
    centralSync.persistSetting(STORAGE_KEY, normalized, 'HSE Document Referrals and Digital Signatures');
  } catch (e) {
    console.error('Failed to save referrals:', e);
  }
}

export function getReferralById(id: string): DocumentReferral | undefined {
  const all = getDocumentReferrals();
  return all.find(r => r.id === id);
}

export function getReferralsForDocument(docType: string, docId: string): DocumentReferral[] {
  const all = getDocumentReferrals();
  return all.filter(r => r.documentType === docType && (r.documentId === docId || r.documentNumber === docId));
}

/**
 * Returns list of referrals waiting for action by a given user (by user object, user id, username, or personnel code)
 */
export function getPendingReferralsForUser(userOrId: any, userName?: string): DocumentReferral[] {
  const all = getDocumentReferrals();
  const personnelList = getComplexPersonnelList();
  const userObj =
    typeof userOrId === 'object' && userOrId !== null
      ? userOrId
      : {
          id: String(userOrId || ''),
          username: String(userOrId || ''),
          personnelNumber: String(userOrId || ''),
          fullName: userName || ''
        };

  return all.filter(r => {
    if (r.isLocked || r.overallStatus === 'COMPLETED' || (r.overallStatus as string) === 'CANCELLED') {
      return false;
    }
    return (r.assignees || []).some(a => {
      if (a.status !== 'PENDING') return false;
      if (r.workflowMode === 'SEQUENTIAL' && !a.isCurrentActive) return false;
      return isAssigneeMatchingUser(a, userObj, personnelList);
    });
  });
}

/**
 * Creates a new Document Referral (or updates existing active referral for the same document to prevent duplicates)
 * and notifies the active assignees.
 */
export function createDocumentReferral(
  params: Omit<DocumentReferral, 'id' | 'createdDate' | 'createdDatePersian' | 'updatedDate' | 'historyLogs' | 'overallStatus' | 'isLocked'>,
  initialComment?: string
): DocumentReferral {
  const now = new Date();
  const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');
  const all = getDocumentReferrals();

  // Check if an existing referral already exists for the same documentType + documentId/documentNumber to avoid duplicates
  const existingIdx = all.findIndex(
    r =>
      r.documentType === params.documentType &&
      ((params.documentId && r.documentId === params.documentId) ||
        (params.documentNumber && r.documentNumber === params.documentNumber))
  );

  // Set sequence order and active status, preserving any pre-signed step or resolving stored signature
  const rawAssignees: ReferralAssignee[] = params.assignees.map((a, idx) => {
    const isAlreadyDone = a.status === 'SIGNED' || a.status === 'APPROVED';
    const sig = a.signatureImage || (isAlreadyDone ? getPersonnelSignature(a) : undefined);
    return {
      ...a,
      id: a.id || `asg-${Date.now()}-${idx}`,
      order: idx + 1,
      status: (isAlreadyDone ? a.status : 'PENDING') as ReferralStatus,
      signatureImage: sig,
      signedAt: isAlreadyDone ? (a.signedAt || now.toISOString()) : a.signedAt,
      signedAtPersian: isAlreadyDone ? (a.signedAtPersian || persianDateTime) : a.signedAtPersian,
      isCurrentActive: false
    };
  });

  const senderSig = getPersonnelSignature({ id: params.senderId, fullName: params.senderName });

  let targetReferral: DocumentReferral;

  if (existingIdx !== -1) {
    const existing = { ...all[existingIdx] };
    const updateLog: ReferralHistoryLog = {
      id: `log-${Date.now()}`,
      action: 'REVISE',
      actionTitleFa: 'بروزرسانی و ارجاع مجدد گردش کار سند',
      userId: params.senderId,
      userName: params.senderName,
      userRole: params.senderRole,
      department: params.senderDepartment,
      timestamp: now.toISOString(),
      persianDateTime,
      comment: initialComment || params.notes || 'گردش کار سند بروزرسانی و به گیرندگان ارجاع گردید.',
      signatureImage: senderSig,
      statusAfter: 'PENDING',
      version: params.version || existing.version || 'Rev 1.0'
    };

    targetReferral = recalculateReferralWorkflowState({
      ...existing,
      ...params,
      id: existing.id,
      assignees: rawAssignees,
      version: params.version || existing.version || 'Rev 1.0',
      updatedDate: now.toISOString(),
      historyLogs: [...(existing.historyLogs || []), updateLog]
    });

    all[existingIdx] = targetReferral;
  } else {
    const id = `ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const initialLog: ReferralHistoryLog = {
      id: `log-${Date.now()}`,
      action: 'CREATE',
      actionTitleFa: 'ایجاد و ارجاع اولیه سند',
      userId: params.senderId,
      userName: params.senderName,
      userRole: params.senderRole,
      department: params.senderDepartment,
      timestamp: now.toISOString(),
      persianDateTime,
      comment: initialComment || params.notes || 'سند جهت بررسی/اقدام ارجاع گردید.',
      signatureImage: senderSig,
      statusAfter: 'PENDING',
      version: params.version || 'Rev 1.0'
    };

    targetReferral = recalculateReferralWorkflowState({
      ...params,
      id,
      assignees: rawAssignees,
      version: params.version || 'Rev 1.0',
      overallStatus: 'IN_PROGRESS',
      isLocked: false,
      createdDate: now.toISOString(),
      createdDatePersian: persianDateTime,
      updatedDate: now.toISOString(),
      historyLogs: [initialLog]
    });

    all.unshift(targetReferral);
  }

  saveDocumentReferrals(all);

  // Dispatch in-app notifications to all initial active recipients (except the creator)
  try {
    const activeRecipients = targetReferral.assignees.filter(
      a => a.isCurrentActive && a.status === 'PENDING' && a.userId !== params.senderId
    );
    activeRecipients.forEach(a => {
      const actionText =
        a.actionType === 'APPROVE_AND_SIGN' ? 'تأیید و امضا' :
        a.actionType === 'SIGN' ? 'امضای دیجیتال' :
        a.actionType === 'APPROVE' ? 'تأیید' :
        a.actionType === 'REJECT' ? 'رد' : 'بررسی و اعلام نظر';

      CentralNotificationService.sendNotification({
        title: `ارجاع جدید: ${params.documentTitle}`,
        body: `سند شماره ${params.documentNumber} توسط ${params.senderName} با مهلت اقدام جهت "${actionText}" به شما ارجاع گردید.`,
        category: 'warning',
        priority: 'high',
        sourceModule: 'referral',
        type: 'popup',
        triggerPopup: true,
        actionUrl: '#pending-documents',
        recordId: params.documentNumber,
        targetType: 'single',
        targetValues: [a.userId],
        sender: params.senderName,
        playSound: true,
      }).catch(() => {});
    });
  } catch (e) {
    console.error('Failed to notify assignees:', e);
  }

  // Add system audit log
  addAuditLog(
    params.senderName,
    `ارجاع سند ${params.documentNumber} (${params.documentTitle}) نسخه ${targetReferral.version} به ${targetReferral.assignees.map(a => a.userName).join('، ')}`,
    'موفقیت‌آمیز',
    {
      module: 'ارجاع مدارک و اسناد',
      recordType: params.documentType,
      recordId: params.documentId,
      description: `نوع گردش: ${params.workflowMode === 'SEQUENTIAL' ? 'ترتیبی' : 'موازی'} - تعداد اقدام‌کنندگان: ${targetReferral.assignees.length}`
    }
  );

  return targetReferral;
}

/**
 * Synchronizes referral status & signatures back to the underlying source module record
 */
function syncReferralOutcomeToSourceDocument(referral: DocumentReferral) {
  try {
    const docId = String(referral.documentId || '');
    const docNum = String(referral.documentNumber || '');

    if (referral.documentType === 'PERMIT') {
      apiDb.getWorkPermits().then(list => {
        if (!Array.isArray(list)) return;
        const pIndex = list.findIndex(
          (p: any) => String(p.id) === docId || p.permitNumber === docNum || p.serialNumber === docNum
        );
        if (pIndex !== -1) {
          const permit = { ...list[pIndex] };
          const form = permit.formData ? { ...permit.formData } : {};
          const sigs = { ...(form.signatures4Tier || permit.signatures4Tier || {}) };

          const tierKeys: ('issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit')[] = [
            'issuer',
            'executor',
            'areaSupervisor',
            'safetyUnit'
          ];
          referral.assignees.forEach((asg, idx) => {
            const key = tierKeys[idx];
            if (key) {
              const currentTier = sigs[key] || {};
              const isApproved = asg.status === 'SIGNED' || asg.status === 'APPROVED';
              sigs[key] = {
                ...currentTier,
                name: asg.userName && asg.userName !== currentTier.roleTitle ? asg.userName : currentTier.name,
                time: asg.approvalTime || currentTier.time,
                signatureImage: asg.signatureImage || currentTier.signatureImage,
                status: isApproved ? 'Approved' : asg.status === 'REJECTED' ? 'Rejected' : 'Pending',
                signedAt: asg.signedAt || currentTier.signedAt,
                persianTimestamp: asg.signedAtPersian || currentTier.persianTimestamp
              };
            }
          });

          permit.signatures4Tier = sigs;
          if (permit.formData) permit.formData.signatures4Tier = sigs;
          if (referral.overallStatus === 'COMPLETED') {
            permit.status = 'Approved';
          } else if (referral.overallStatus === 'REJECTED') {
            permit.status = 'Rejected';
          }
          apiDb.saveWorkPermit(permit).catch(() => {});
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hse_data_mutated', { detail: { entityType: 'permits' } }));
            window.dispatchEvent(new CustomEvent('hse_permits_updated'));
          }
        }
      }).catch(() => {});
    } else if (referral.documentType === 'NON_CONFORMANCE') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hse_data_mutated', {
            detail: { entityType: 'non_conformance', recordId: docId, overallStatus: referral.overallStatus }
          })
        );
      }
    } else if (referral.documentType === 'INCIDENT' || referral.documentType === 'INCIDENT_SUPPLEMENT') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hse_data_mutated', {
            detail: { entityType: 'incidents', recordId: docId, overallStatus: referral.overallStatus }
          })
        );
      }
    } else if (referral.documentType === 'SAFETY_WARNING' || referral.documentType === 'WARNING') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('hse_data_mutated', {
            detail: { entityType: 'warnings', recordId: docId, overallStatus: referral.overallStatus }
          })
        );
      }
    }
  } catch (e) {
    console.warn('Source module sync on referral action:', e);
  }
}

/**
 * Executes an action (Review, Approve, Reject, Sign, Approve & Sign, Delegate) on a referral
 * with strict recipient & stage verification.
 */
export function processReferralAction(params: {
  referralId: string;
  assigneeId: string;
  action: 'REVIEW' | 'APPROVE' | 'REJECT' | 'SIGN' | 'APPROVE_AND_SIGN' | 'DELEGATE';
  comment: string;
  signatureImage?: string;
  delegateTo?: {
    userId: string;
    userName: string;
    userRole?: string;
    userJobTitle?: string;
    department?: string;
    personnelCode?: string;
    actionType: ReferralActionType;
    deadline?: string;
    instructions?: string;
  };
  currentUser: {
    id: string;
    username?: string;
    personnelNumber?: string;
    fullName: string;
    role?: string;
    jobTitle?: string;
    department?: string;
  };
}): DocumentReferral {
  const all = getDocumentReferrals();
  const index = all.findIndex(r => r.id === params.referralId);
  if (index === -1) {
    throw new Error('ارجاع مورد نظر یافت نشد.');
  }

  const referral = { ...all[index], assignees: [...all[index].assignees], historyLogs: [...(all[index].historyLogs || [])] };
  const now = new Date();
  const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');

  const assigneeIndex = referral.assignees.findIndex(a => a.id === params.assigneeId);
  if (assigneeIndex === -1) {
    throw new Error('اقدام‌کننده مورد نظر در این ارجاع یافت نشد.');
  }

  const targetAssignee = { ...referral.assignees[assigneeIndex] };

  // Strict authorization check: only the designated recipient (in their active turn) or Global Admin can act
  const authCheck = canUserActOnAssignee(params.currentUser, referral, targetAssignee);
  if (!authCheck.allowed) {
    throw new Error(authCheck.reason || 'شما مجاز به اقدام یا امضای این مرحله نیستید.');
  }

  let newStatus: ReferralStatus = 'PENDING';
  let actionTitleFa = '';

  if (params.action === 'REVIEW') {
    newStatus = 'REVIEWED';
    actionTitleFa = 'بررسی و ثبت نظر کارشناسی';
  } else if (params.action === 'APPROVE') {
    newStatus = 'APPROVED';
    actionTitleFa = 'تأیید سند';
  } else if (params.action === 'REJECT') {
    newStatus = 'REJECTED';
    actionTitleFa = 'رد سند';
  } else if (params.action === 'SIGN') {
    newStatus = 'SIGNED';
    actionTitleFa = 'امضای دیجیتال سند';
  } else if (params.action === 'APPROVE_AND_SIGN') {
    newStatus = 'SIGNED';
    actionTitleFa = 'تأیید و امضای دیجیتال سند';
  } else if (params.action === 'DELEGATE') {
    newStatus = 'DELEGATED';
    actionTitleFa = 'ارجاع مجدد (تفویض) سند';
  }

  // Resolve signature from explicit parameter or stored personnel signature sample
  const resolvedSignature =
    params.signatureImage ||
    (params.action !== 'REJECT'
      ? (getPersonnelSignature(params.currentUser) || getPersonnelSignature(targetAssignee) || targetAssignee.signatureImage)
      : undefined);

  // Update target assignee
  targetAssignee.status = newStatus;
  targetAssignee.statusDate = now.toISOString();
  targetAssignee.comment = params.comment;
  if (resolvedSignature) {
    targetAssignee.signatureImage = resolvedSignature;
    targetAssignee.signedAt = now.toISOString();
    targetAssignee.signedAtPersian = persianDateTime;
  }
  targetAssignee.isCurrentActive = false;

  referral.assignees[assigneeIndex] = targetAssignee;

  // If delegating, insert new assignee right after current assignee so sequential order continues smoothly
  if (params.action === 'DELEGATE' && params.delegateTo) {
    const newAssignee: ReferralAssignee = {
      id: `asg-${Date.now()}`,
      userId: params.delegateTo.userId,
      userName: params.delegateTo.userName,
      userRole: params.delegateTo.userRole,
      userJobTitle: params.delegateTo.userJobTitle,
      department: params.delegateTo.department,
      personnelCode: params.delegateTo.personnelCode,
      actionType: params.delegateTo.actionType,
      deadline: params.delegateTo.deadline,
      instructions: params.delegateTo.instructions || params.comment,
      status: 'PENDING',
      order: assigneeIndex + 2,
      isCurrentActive: true
    };
    referral.assignees.splice(assigneeIndex + 1, 0, newAssignee);
    referral.assignees = referral.assignees.map((a, idx) => ({ ...a, order: idx + 1 }));
  }

  // Recalculate active stage and overall workflow state
  recalculateReferralWorkflowState(referral);

  // If sequential workflow advanced to a new active assignee, notify them
  if (referral.workflowMode === 'SEQUENTIAL' && referral.overallStatus === 'IN_PROGRESS') {
    const nextAssignee = referral.assignees.find(a => a.isCurrentActive && a.status === 'PENDING');
    if (nextAssignee) {
      try {
        const actionText =
          nextAssignee.actionType === 'APPROVE_AND_SIGN' ? 'تأیید و امضا' :
          nextAssignee.actionType === 'SIGN' ? 'امضای دیجیتال' :
          nextAssignee.actionType === 'APPROVE' ? 'تأیید' :
          nextAssignee.actionType === 'REJECT' ? 'رد' : 'بررسی و اعلام نظر';

        CentralNotificationService.sendNotification({
          title: `نوبت اقدام ارجاع: ${referral.documentTitle}`,
          body: `سند شماره ${referral.documentNumber} در مرحله گردش به شما رسیده است. مهلت اقدام جهت "${actionText}".`,
          category: 'warning',
          priority: 'high',
          sourceModule: 'referral',
          type: 'popup',
          triggerPopup: true,
          actionUrl: '#pending-documents',
          recordId: referral.documentNumber,
          targetType: 'single',
          targetValues: [nextAssignee.userId],
          sender: 'سامانه کارتابل گردش اسناد',
          playSound: true,
        }).catch(() => {});
      } catch (e) {
        console.error('Failed to notify next assignee:', e);
      }
    }
  }

  // Notify document creator / sender about the action taken (Approval, Signature, Rejection)
  try {
    const isApproveOrSign = params.action === 'APPROVE' || params.action === 'SIGN' || params.action === 'APPROVE_AND_SIGN';
    const isReject = params.action === 'REJECT';

    if (referral.senderId && referral.senderId !== params.currentUser.id) {
      CentralNotificationService.sendNotification({
        title: isReject
          ? `رد ارجاع سند: ${referral.documentTitle}`
          : `ثبت ${actionTitleFa} برای سند: ${referral.documentTitle}`,
        body: isReject
          ? `سند شماره ${referral.documentNumber} توسط ${params.currentUser.fullName} رد شد. دلیل: ${params.comment || 'عدم تأیید الزامات'}`
          : `سند شماره ${referral.documentNumber} توسط ${params.currentUser.fullName} (${actionTitleFa}) گردید.${params.comment ? `\nتوضیحات: ${params.comment}` : ''}`,
        category: isReject ? 'error' : 'success',
        priority: 'high',
        sourceModule: isApproveOrSign ? 'signature' : 'referral',
        type: 'popup',
        triggerPopup: true,
        actionUrl: '#pending-documents',
        recordId: referral.documentNumber,
        targetType: 'single',
        targetValues: [referral.senderId],
        sender: params.currentUser.fullName,
        playSound: true,
      }).catch(() => {});
    }

    if (referral.overallStatus === 'COMPLETED') {
      const recipientIds = Array.from(new Set([referral.senderId, ...referral.assignees.map(a => a.userId)].filter(Boolean)));
      CentralNotificationService.sendNotification({
        title: `تکمیل گردش کار و ثبت کلیه امضاها: ${referral.documentTitle}`,
        body: `تمامی امضاها و تأییدات سند شماره ${referral.documentNumber} با موفقیت ثبت شد و پرونده به وضعیت نهایی و قفل‌شده تغییر یافت.`,
        category: 'success',
        priority: 'high',
        sourceModule: 'signature',
        type: 'popup',
        triggerPopup: true,
        actionUrl: '#pending-documents',
        recordId: referral.documentNumber,
        targetType: 'user',
        targetValues: recipientIds,
        sender: 'سامانه کارتابل گردش اسناد',
        playSound: true,
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to notify creator/participants of action:', e);
  }

  // Append history audit log
  const newLog: ReferralHistoryLog = {
    id: `log-${Date.now()}`,
    action: params.action === 'APPROVE_AND_SIGN' ? 'SIGN' : params.action,
    actionTitleFa,
    userId: params.currentUser.id,
    userName: params.currentUser.fullName,
    userRole: params.currentUser.role,
    userJobTitle: params.currentUser.jobTitle,
    department: params.currentUser.department,
    timestamp: now.toISOString(),
    persianDateTime,
    comment: params.comment,
    signatureImage: resolvedSignature || params.signatureImage,
    statusBefore: 'PENDING',
    statusAfter: newStatus,
    version: referral.version
  };

  referral.historyLogs.push(newLog);
  referral.updatedDate = now.toISOString();

  all[index] = referral;
  saveDocumentReferrals(all);

  // Authoritative server-side action execution
  apiDb.executeReferralAction(referral.id, {
    assigneeId: params.assigneeId,
    action: params.action,
    comment: params.comment,
    signatureImage: resolvedSignature || params.signatureImage,
    delegateTo: params.delegateTo,
    userId: params.currentUser.id,
    userName: params.currentUser.fullName,
    userRole: params.currentUser.role,
    userJobTitle: params.currentUser.jobTitle,
    department: params.currentUser.department,
    persianDateTime
  }).catch(() => {});

  // Synchronize back to source module
  syncReferralOutcomeToSourceDocument(referral);

  // Global audit trail
  addAuditLog(
    params.currentUser.fullName,
    `${actionTitleFa} برای سند ${referral.documentNumber} (${referral.documentTitle}): ${params.comment || 'بدون توضیح'}`,
    params.action === 'REJECT' ? 'رد شد' : 'موفقیت‌آمیز',
    {
      module: 'ارجاع و امضای مدارک',
      recordType: referral.documentType,
      recordId: referral.documentId,
      description: `اقدام: ${actionTitleFa} - سمت/نقش: ${params.currentUser.jobTitle || params.currentUser.role || 'کاربر'} - وضعیت جدید: ${referral.overallStatus}`
    }
  );

  return referral;
}

/**
 * Cancels / withdraws an active referral (انصراف از ارجاع) by its sender or Global Admin.
 */
export function cancelDocumentReferral(params: {
  referralId: string;
  reason?: string;
  currentUser: {
    id: string;
    username?: string;
    personnelNumber?: string;
    fullName: string;
    role?: string;
    jobTitle?: string;
    department?: string;
  };
}): DocumentReferral {
  const all = getDocumentReferrals();
  const index = all.findIndex(r => r.id === params.referralId);
  if (index === -1) {
    throw new Error('ارجاع مورد نظر یافت نشد.');
  }

  const referral = { ...all[index], assignees: [...all[index].assignees], historyLogs: [...(all[index].historyLogs || [])] };
  if (!isGlobalAdminUser(params.currentUser) && !isReferralSender(referral, params.currentUser)) {
    throw new Error('صرفاً ایجادکننده ارجاع یا مدیر سامانه مجاز به انصراف و لغو ارجاع می‌باشد.');
  }

  const now = new Date();
  const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');

  referral.overallStatus = 'REJECTED';
  referral.isLocked = true;
  referral.assignees = referral.assignees.map(a => ({
    ...a,
    isCurrentActive: false
  }));
  referral.updatedDate = now.toISOString();

  referral.historyLogs.push({
    id: `log-${Date.now()}`,
    action: 'REJECT',
    actionTitleFa: 'انصراف و لغو گردش کار ارجاع توسط فرستنده/مدیر',
    userId: params.currentUser.id,
    userName: params.currentUser.fullName,
    userRole: params.currentUser.role,
    userJobTitle: params.currentUser.jobTitle,
    department: params.currentUser.department,
    timestamp: now.toISOString(),
    persianDateTime,
    comment: params.reason || 'لغو و انصراف از گردش کار ارجاع',
    statusBefore: 'PENDING',
    statusAfter: 'REJECTED',
    version: referral.version
  });

  all[index] = referral;
  saveDocumentReferrals(all);

  apiDb.executeReferralAction(referral.id, {
    action: 'CANCEL',
    comment: params.reason || 'لغو و انصراف از گردش کار ارجاع',
    userId: params.currentUser.id,
    userName: params.currentUser.fullName,
    userRole: params.currentUser.role,
    userJobTitle: params.currentUser.jobTitle,
    department: params.currentUser.department,
    persianDateTime
  }).catch(() => {});

  addAuditLog(
    params.currentUser.fullName,
    `انصراف و لغو ارجاع سند ${referral.documentNumber} (${referral.documentTitle})`,
    'لغو شد',
    {
      module: 'ارجاع و امضای مدارک',
      recordType: referral.documentType,
      recordId: referral.documentId,
      description: params.reason || 'انصراف از ارجاع'
    }
  );

  return referral;
}

/**
 * Creates a revised version of an existing referral document (Document Version Control)
 */
export function reviseDocumentReferral(params: {
  referralId: string;
  revisionReason: string;
  newAssignees?: ReferralAssignee[];
  currentUser: {
    id: string;
    fullName: string;
    role?: string;
    jobTitle?: string;
    department?: string;
  };
}): DocumentReferral {
  const all = getDocumentReferrals();
  const index = all.findIndex(r => r.id === params.referralId);
  if (index === -1) {
    throw new Error('ارجاع مورد نظر یافت نشد.');
  }

  const referral = { ...all[index] };
  const now = new Date();
  const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');

  // Increment version number e.g. Rev 1.0 -> Rev 1.1 or Rev 2.0
  const currentVer = referral.version || 'Rev 1.0';
  const match = currentVer.match(/Rev (\d+)(?:\.(\d+))?/i);
  let nextVer = 'Rev 1.1';
  if (match) {
    const major = parseInt(match[1], 10) || 1;
    const minor = match[2] ? parseInt(match[2], 10) : 0;
    nextVer = `Rev ${major}.${minor + 1}`;
  }

  referral.version = nextVer;
  referral.revisionReason = params.revisionReason;
  referral.overallStatus = 'IN_PROGRESS';
  referral.isLocked = false;
  referral.updatedDate = now.toISOString();

  // If new assignees provided, reset workflow
  if (params.newAssignees && params.newAssignees.length > 0) {
    referral.assignees = params.newAssignees.map((a, idx) => ({
      ...a,
      id: `asg-${Date.now()}-${idx}`,
      status: 'PENDING' as ReferralStatus,
      isCurrentActive: referral.workflowMode === 'PARALLEL' ? true : idx === 0,
      order: idx + 1
    }));
  } else {
    // Reset existing assignees to pending for new version review
    referral.assignees = referral.assignees.map((a, idx) => ({
      ...a,
      status: 'PENDING' as ReferralStatus,
      isCurrentActive: referral.workflowMode === 'PARALLEL' ? true : idx === 0,
      comment: undefined,
      signatureImage: undefined,
      signedAt: undefined,
      signedAtPersian: undefined
    }));
  }

  recalculateReferralWorkflowState(referral);

  const revisionLog: ReferralHistoryLog = {
    id: `log-${Date.now()}`,
    action: 'REVISE',
    actionTitleFa: `بازنگری و ارتقای نسخه به ${nextVer}`,
    userId: params.currentUser.id,
    userName: params.currentUser.fullName,
    userRole: params.currentUser.role,
    userJobTitle: params.currentUser.jobTitle,
    department: params.currentUser.department,
    timestamp: now.toISOString(),
    persianDateTime,
    comment: `علت بازنگری: ${params.revisionReason}`,
    version: nextVer,
    statusAfter: 'PENDING'
  };

  referral.historyLogs.push(revisionLog);
  all[index] = referral;
  saveDocumentReferrals(all);

  addAuditLog(
    params.currentUser.fullName,
    `بازنگری و انتشار نسخه ${nextVer} سند ${referral.documentNumber}: ${params.revisionReason}`,
    'موفقیت‌آمیز',
    {
      module: 'کنترل نسخه مدارک',
      recordType: referral.documentType,
      recordId: referral.documentId,
      description: `نسخه قبلی: ${currentVer} به ${nextVer}`
    }
  );

  return referral;
}

/**
 * Standard 4-Tier roles and default approval times for permits (Hot & Cold)
 */
export const PERMIT_4TIER_CONFIG = [
  { key: 'issuer', title: 'کشیک ارشد تولید / صادر کننده', defaultTime: '07:30', decl: 'اینجانب شخصاً بازرسی‌های لازم را انجام داده و شرایط را مناسب می‌دانم.' },
  { key: 'executor', title: 'مسئول انجام کار', defaultTime: '07:45', decl: 'اینجانب با اطلاع کامل از احتیاط های لازم، پس از پایان‌کار مراتب را به مسئول محوطه اطلاع خواهم داد.' },
  { key: 'areaSupervisor', title: 'مسئول محوطه', defaultTime: '07:50', decl: 'اینجانب شخصاً بازرسی‌های فوق را انجام داده و شرایط را مناسب می‌دانم.' },
  { key: 'safetyUnit', title: 'واحد ایمنی', defaultTime: '08:00', decl: 'کلیه بازرسی ها و موارد ایمنی انجام گردید و مورد تایید می باشد' }
] as const;

/**
 * Returns default referral assignees matching exactly the names and approval times from permit form
 */
export function getPermitDefaultAssignees(permit: any): any[] {
  const sigs = permit?.signatures4Tier || {};
  const personnelList = getComplexPersonnelList();

  return PERMIT_4TIER_CONFIG.map(t => {
    const tierData = sigs[t.key] || {};
    const exactName = (tierData.name || '').trim();
    const approvalTime = tierData.time || t.defaultTime;

    // Resolve matching personnel record if available so userId and personnelCode are accurate
    const matchedPerson = exactName
      ? personnelList.find(p => normalizeForMatching(p.fullName) === normalizeForMatching(exactName))
      : undefined;

    return {
      id: `asg-${permit?.id || 'new'}-${t.key}`,
      source: matchedPerson ? 'COMPLEX_PERSONNEL' : 'USERS',
      personId: matchedPerson?.id || exactName || `user-${t.key}`,
      fullName: exactName || t.title,
      jobTitle: matchedPerson?.jobTitle || t.title,
      department: matchedPerson?.department || (t.key === 'safetyUnit' ? 'واحد ایمنی' : (permit?.location || 'عملیات / محوطه')),
      personnelCode: matchedPerson?.personnelCode || matchedPerson?.effectiveCode || '',
      actionType: 'APPROVE_AND_SIGN',
      approvalTime: approvalTime,
      instructions: `ساعت تایید: ${approvalTime}`,
      deadline: moment(new Date(Date.now() + 24 * 3600 * 1000)).format('jYYYY/jMM/jDD')
    };
  });
}

/**
 * Synchronizes permit signatures with Document Referral System (ارجاع و امضا).
 * Guarantees that:
 * 1. The exact same names filled by permit completer appear in referral assignees.
 * 2. The approval times in the permit match exactly the approval times in referral and signature.
 * 3. Sequential workflow progression (`SEQUENTIAL`) is respected across the 4 tiers.
 */
export function syncPermitReferral(permit: any, currentUser?: any): DocumentReferral {
  const all = getDocumentReferrals();
  const docId = String(permit.id || permit.serialNumber || '');
  const docNum = permit.serialNumber || permit.permitNumber || `PTW-${docId}`;
  const isHot = permit.permitType === 'Hot' || permit.permitCategory === 'Hot';
  const docTitle = `پروانه کار ${isHot ? 'گرم' : 'سرد'} - شماره ${docNum}`;

  const sigs = permit.signatures4Tier || permit.formData?.signatures4Tier || {};
  const existingIdx = all.findIndex(r => r.documentType === 'PERMIT' && (r.documentId === docId || r.documentNumber === docNum));

  const now = new Date();
  const persianDateTime = moment(now).format('jYYYY/jMM/jDD HH:mm');
  const personnelList = getComplexPersonnelList();

  // Build assignees from permit's 4-tier signatures
  const assignees: ReferralAssignee[] = PERMIT_4TIER_CONFIG.map((t, idx) => {
    const tierData = sigs[t.key] || {};
    const exactName = (tierData.name || '').trim();
    const approvalTime = tierData.time || t.defaultTime;
    const hasSignature = !!tierData.signatureImage || (tierData.status === 'Approved' && !!exactName);

    const existingAssignee = existingIdx !== -1 ? all[existingIdx]?.assignees?.[idx] : undefined;
    const effectiveSignature = tierData.signatureImage || existingAssignee?.signatureImage;
    const isSigned = hasSignature || existingAssignee?.status === 'SIGNED' || existingAssignee?.status === 'APPROVED';

    const matchedPerson = exactName
      ? personnelList.find(p => normalizeForMatching(p.fullName) === normalizeForMatching(exactName))
      : undefined;

    return {
      id: existingAssignee?.id || `asg-${docId}-${t.key}`,
      userId: matchedPerson?.id || existingAssignee?.userId || `user-${idx}-${encodeURIComponent(exactName || t.key)}`,
      userName: exactName || existingAssignee?.userName || t.title,
      userRole: t.title,
      userJobTitle: matchedPerson?.jobTitle || t.title,
      department: matchedPerson?.department || (t.key === 'safetyUnit' ? 'واحد ایمنی و آتش‌نشانی' : (permit.location || 'بهره‌برداری / تعمیرات')),
      personnelCode: matchedPerson?.personnelCode || matchedPerson?.effectiveCode || existingAssignee?.personnelCode,
      actionType: 'APPROVE_AND_SIGN',
      approvalTime: approvalTime,
      instructions: `تأیید و امضای پروانه کار - ساعت تایید: ${approvalTime}`,
      status: isSigned ? 'SIGNED' : 'PENDING',
      statusDate: isSigned ? (existingAssignee?.statusDate || now.toISOString()) : undefined,
      signatureImage: effectiveSignature,
      signedAt: isSigned ? (existingAssignee?.signedAt || now.toISOString()) : undefined,
      signedAtPersian: isSigned ? (existingAssignee?.signedAtPersian || `${persianDateTime.split(' ')[0]} ${approvalTime}`) : undefined,
      order: idx + 1,
      isCurrentActive: false
    };
  });

  if (existingIdx !== -1) {
    const existing = recalculateReferralWorkflowState({
      ...all[existingIdx],
      documentTitle: docTitle,
      documentNumber: docNum,
      assignees,
      updatedDate: now.toISOString()
    });
    all[existingIdx] = existing;
    saveDocumentReferrals(all);
    return existing;
  } else {
    const newRef = recalculateReferralWorkflowState({
      id: `ref-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      documentType: 'PERMIT',
      documentId: docId,
      documentNumber: docNum,
      documentTitle: docTitle,
      senderId: currentUser?.id || currentUser?.username || 'system',
      senderName: currentUser?.fullName || currentUser?.username || (sigs.issuer?.name || 'صادرکننده پروانه'),
      senderRole: currentUser?.role || 'صادرکننده پروانه',
      senderDepartment: currentUser?.departmentIds?.[0] || 'ستاد ایمنی و صدور پروانه',
      workflowMode: 'SEQUENTIAL',
      assignees,
      overallStatus: 'IN_PROGRESS',
      priority: isHot ? 'HIGH' : 'MEDIUM',
      version: 'Rev 1.0',
      notes: `پروانه کار ${isHot ? 'گرم' : 'سرد'} با ۴ امضای مجاز صادرکننده، مسئول اجرا، مسئول محوطه و واحد ایمنی.`,
      deadline: moment(new Date(Date.now() + 24 * 3600 * 1000)).format('jYYYY/jMM/jDD'),
      isLocked: false,
      createdDate: now.toISOString(),
      createdDatePersian: persianDateTime,
      updatedDate: now.toISOString(),
      historyLogs: [
        {
          id: `log-${Date.now()}`,
          action: 'CREATE',
          actionTitleFa: 'ثبت و ارجاع پروانه کار با امضاهای چهارگانه',
          userId: currentUser?.id || 'system',
          userName: currentUser?.fullName || (sigs.issuer?.name || 'تکمیل‌کننده پروانه'),
          userRole: currentUser?.role || 'صادرکننده',
          timestamp: now.toISOString(),
          persianDateTime,
          comment: 'پروانه کار صادر و جهت امضا و تایید در گردش کار قرار گرفت.',
          statusAfter: 'PENDING',
          version: 'Rev 1.0'
        }
      ]
    });
    all.unshift(newRef);
    saveDocumentReferrals(all);
    return newRef;
  }
}

/**
 * Returns the current live status and signature info of a permit signatory from the referral workflow
 */
export function getPermitReferralSignerStatus(
  permitId: string,
  roleKey: string,
  roleTitle: string,
  fallbackName?: string
): {
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'NOT_STARTED';
  fullName: string;
  jobTitle?: string;
  signedAtPersian?: string;
  signatureImage?: string;
  comment?: string;
  time?: string;
} {
  const referrals = getReferralsForDocument('PERMIT', permitId);
  for (const ref of referrals) {
    const assignee = ref.assignees.find(a =>
      a.userRole === roleTitle ||
      a.userJobTitle === roleTitle ||
      (fallbackName && a.userName === fallbackName)
    );
    if (assignee) {
      return {
        status: assignee.status === 'SIGNED' ? 'APPROVED' : assignee.status === 'APPROVED' ? 'APPROVED' : assignee.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
        fullName: assignee.userName || fallbackName || roleTitle,
        jobTitle: assignee.userJobTitle || assignee.userRole || roleTitle,
        signedAtPersian: assignee.signedAtPersian || (assignee.approvalTime ? `ساعت ${assignee.approvalTime}` : undefined),
        time: assignee.approvalTime || (assignee.signedAtPersian?.split(' ')[1]),
        signatureImage: assignee.signatureImage,
        comment: assignee.comment
      };
    }
  }
  return {
    status: fallbackName ? 'PENDING' : 'NOT_STARTED',
    fullName: fallbackName || '',
    jobTitle: roleTitle
  };
}
