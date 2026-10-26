import { Router } from 'express';
import { db, withDbRetry } from '../../src/db/index.ts';
import { systemSettings } from '../../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger } from '../core/logger.ts';
import { requireAuth, isGlobalAdminUser, UserContext } from '../core/middleware/auth.ts';
import { broadcastDataMutation } from '../core/socket.ts';

export const referralRouter = Router();

export const REFERRAL_STORAGE_KEY = 'hse_document_referrals_v1';
let memoryReferralsCache: any[] | null = null;

/**
 * Normalizes Persian/English text for deterministic user & assignee matching
 */
export function normalizeReferralText(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Checks if a user context matches a specific referral assignee
 */
export function isAssigneeMatchingUser(user: UserContext | any | undefined, assignee: any): boolean {
  if (!user || !assignee) return false;

  const uId = String(user.uid || user.id || '').trim().toLowerCase();
  const uUsername = String(user.username || '').trim().toLowerCase();
  const uCode = String(user.personnelCode || user.personnelNumber || '').trim().toLowerCase();
  const uName = normalizeReferralText(user.name || user.fullName);

  const aId = String(assignee.userId || '').trim().toLowerCase();
  const aCode = String(assignee.personnelCode || '').trim().toLowerCase();
  const aName = normalizeReferralText(assignee.userName);

  if (aId && (aId === uId || (uUsername && aId === uUsername) || (uCode && aId === uCode))) {
    return true;
  }
  if (aCode && ((uCode && aCode === uCode) || (uUsername && aCode === uUsername) || (uId && aCode === uId))) {
    return true;
  }
  if (uName && aName && uName === aName) {
    return true;
  }
  return false;
}

/**
 * Checks if the user is the sender/creator of the referral
 */
export function isReferralSender(user: UserContext | any | undefined, referral: any): boolean {
  if (!user || !referral) return false;
  const uId = String(user.uid || user.id || '').trim().toLowerCase();
  const uUsername = String(user.username || '').trim().toLowerCase();
  const uCode = String(user.personnelCode || user.personnelNumber || '').trim().toLowerCase();
  const uName = normalizeReferralText(user.name || user.fullName);

  const sId = String(referral.senderId || '').trim().toLowerCase();
  const sName = normalizeReferralText(referral.senderName);

  if (sId && (sId === uId || (uUsername && sId === uUsername) || (uCode && sId === uCode))) {
    return true;
  }
  if (uName && sName && uName === sName) {
    return true;
  }
  return false;
}

/**
 * Deterministically recalculates workflow stages, isCurrentActive flags, overallStatus, and lock state.
 * Prevents stuck sequential workflows when earlier steps are already signed/approved.
 */
export function recalculateReferralWorkflowState(rawReferral: any): any {
  if (!rawReferral || typeof rawReferral !== 'object') return rawReferral;
  const referral = { ...rawReferral };
  const assignees = Array.isArray(referral.assignees)
    ? referral.assignees.map((a: any, idx: number) => ({
        ...a,
        order: typeof a.order === 'number' ? a.order : idx + 1,
      }))
    : [];

  // Sort by order
  assignees.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  const anyRejected = assignees.some((a: any) => a.status === 'REJECTED');
  const isCancelled = referral.overallStatus === 'REJECTED' && !anyRejected;

  if (anyRejected || isCancelled) {
    referral.overallStatus = 'REJECTED';
    referral.isLocked = false;
    referral.assignees = assignees.map((a: any) => ({
      ...a,
      isCurrentActive: false,
    }));
    return referral;
  }

  const allCompleted =
    assignees.length > 0 &&
    assignees.every((a: any) => a.status === 'APPROVED' || a.status === 'SIGNED' || a.status === 'DELEGATED' || a.status === 'REVIEWED');

  if (allCompleted) {
    // Only mark COMPLETED and locked if all non-delegated steps are APPROVED or SIGNED
    const allFinalized = assignees.every(
      (a: any) => a.status === 'APPROVED' || a.status === 'SIGNED' || a.status === 'DELEGATED'
    );
    if (allFinalized) {
      referral.overallStatus = 'COMPLETED';
      referral.isLocked = true;
      referral.assignees = assignees.map((a: any) => ({
        ...a,
        isCurrentActive: false,
      }));
      return referral;
    }
  }

  referral.overallStatus = 'IN_PROGRESS';
  referral.isLocked = false;

  if (referral.workflowMode === 'PARALLEL') {
    referral.assignees = assignees.map((a: any) => ({
      ...a,
      isCurrentActive: a.status === 'PENDING',
    }));
  } else {
    // SEQUENTIAL mode: only the FIRST pending assignee is active
    let foundFirstPending = false;
    referral.assignees = assignees.map((a: any) => {
      if (a.status === 'PENDING' && !foundFirstPending) {
        foundFirstPending = true;
        return { ...a, isCurrentActive: true };
      }
      return { ...a, isCurrentActive: false };
    });
  }

  return referral;
}

/**
 * Checks whether a user is allowed to view a referral in their cartable / tracker.
 * - System Manager & Main Admin: Can view all referrals globally.
 * - Sender: Can view referrals they sent.
 * - Assignee:
 *   - In PARALLEL mode: Can view if assigned to them.
 *   - In SEQUENTIAL mode: Can view ONLY when it is their active turn (isCurrentActive) OR after they have already acted on their step.
 */
export function canUserViewReferral(user: UserContext | any | undefined, referral: any): boolean {
  if (!user || !referral) return false;
  if (isGlobalAdminUser(user)) return true;
  if (isReferralSender(user, referral)) return true;

  const normalized = recalculateReferralWorkflowState(referral);
  const assignees: any[] = Array.isArray(normalized.assignees) ? normalized.assignees : [];

  return assignees.some((a: any) => {
    if (!isAssigneeMatchingUser(user, a)) return false;
    if (normalized.workflowMode === 'PARALLEL') return true;
    // In SEQUENTIAL mode, visible when it is currently their turn OR they have already acted on it
    return Boolean(a.isCurrentActive) || a.status !== 'PENDING';
  });
}

/**
 * Checks whether a user is allowed to execute an action (Approve, Sign, Reject, Delegate) on a specific assignee step.
 */
export function canUserActOnAssignee(
  user: UserContext | any | undefined,
  referral: any,
  assignee: any
): boolean {
  if (!user || !referral || !assignee) return false;
  const normalized = recalculateReferralWorkflowState(referral);
  if (normalized.overallStatus !== 'IN_PROGRESS' || normalized.isLocked) return false;

  const normalizedAssignee =
    (normalized.assignees || []).find((a: any) => a.id === assignee.id) || assignee;

  if (normalizedAssignee.status !== 'PENDING') return false;
  if (normalized.workflowMode === 'SEQUENTIAL' && !normalizedAssignee.isCurrentActive) {
    return false;
  }

  if (isGlobalAdminUser(user)) return true;
  return isAssigneeMatchingUser(user, normalizedAssignee);
}

/**
 * Filters a list of referrals according to the authenticated user's access level.
 */
export function filterReferralsForUser(user: UserContext | any | undefined, referrals: any[]): any[] {
  if (!Array.isArray(referrals)) return [];
  const normalizedList = referrals.map((r) => recalculateReferralWorkflowState(r));
  if (isGlobalAdminUser(user)) {
    return normalizedList;
  }
  return normalizedList.filter((r) => canUserViewReferral(user, r));
}

/**
 * Safely merges incoming referral(s) into the master database list without losing other users' referrals
 * and deduplicating by id or (documentType + documentId/documentNumber).
 */
export function mergeAndDeduplicateReferrals(
  existingList: any[],
  incomingPayload: any,
  actingUser?: UserContext | any
): any[] {
  const incomingArray = Array.isArray(incomingPayload)
    ? incomingPayload
    : incomingPayload && typeof incomingPayload === 'object'
    ? [incomingPayload]
    : [];

  const byId = new Map<string, any>();
  const docKeyToId = new Map<string, string>();

  const getDocKey = (r: any): string => {
    if (!r || !r.documentType) return '';
    const docId = String(r.documentId || r.documentNumber || '').trim();
    if (!docId) return '';
    return `${String(r.documentType).trim().toUpperCase()}::${docId.toLowerCase()}`;
  };

  // Seed with existing master referrals
  for (const item of Array.isArray(existingList) ? existingList : []) {
    if (!item || !item.id) continue;
    const normalized = recalculateReferralWorkflowState(item);
    const dKey = getDocKey(normalized);
    if (dKey && docKeyToId.has(dKey)) {
      // Consolidate duplicate if any existed previously
      const primaryId = docKeyToId.get(dKey)!;
      const primary = byId.get(primaryId);
      if (primary) {
        const mergedLogs = [...(primary.historyLogs || []), ...(normalized.historyLogs || [])];
        const uniqueLogs = Array.from(new Map(mergedLogs.map((l: any) => [l.id, l])).values());
        byId.set(
          primaryId,
          recalculateReferralWorkflowState({
            ...normalized,
            ...primary,
            historyLogs: uniqueLogs,
          })
        );
      }
      continue;
    }
    byId.set(normalized.id, normalized);
    if (dKey) docKeyToId.set(dKey, normalized.id);
  }

  // Merge incoming items
  for (const inc of incomingArray) {
    if (!inc || typeof inc !== 'object') continue;
    const dKey = getDocKey(inc);
    const existingId = byId.has(inc.id)
      ? inc.id
      : dKey && docKeyToId.has(dKey)
      ? docKeyToId.get(dKey)!
      : null;

    if (existingId && byId.has(existingId)) {
      const current = byId.get(existingId)!;
      // Authorization check: only allow modifying an existing referral if admin, sender, or an assignee
      const canModify =
        !actingUser ||
        isGlobalAdminUser(actingUser) ||
        isReferralSender(actingUser, current) ||
        isReferralSender(actingUser, inc) ||
        (Array.isArray(current.assignees) &&
          current.assignees.some((a: any) => isAssigneeMatchingUser(actingUser, a)));

      if (!canModify) {
        continue;
      }

      // Preserve existing historyLogs and merge new ones
      const combinedLogs = [...(current.historyLogs || []), ...(inc.historyLogs || [])];
      const uniqueLogs = Array.from(
        new Map(combinedLogs.filter(Boolean).map((l: any) => [l.id || `${l.timestamp}-${l.action}`, l])).values()
      );

      const merged = recalculateReferralWorkflowState({
        ...current,
        ...inc,
        id: current.id,
        historyLogs: uniqueLogs,
        updatedDate: inc.updatedDate || new Date().toISOString(),
      });
      byId.set(current.id, merged);
      if (dKey) docKeyToId.set(dKey, current.id);
    } else if (inc.id) {
      const normalized = recalculateReferralWorkflowState(inc);
      byId.set(normalized.id, normalized);
      if (dKey) docKeyToId.set(dKey, normalized.id);
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.updatedDate || b.createdDate || 0).getTime() -
      new Date(a.updatedDate || a.createdDate || 0).getTime()
  );
}

// Helper: load from DB or cache
export async function loadReferrals(): Promise<any[]> {
  if (memoryReferralsCache !== null) {
    return memoryReferralsCache;
  }
  try {
    const records = await withDbRetry(() =>
      db.select().from(systemSettings).where(eq(systemSettings.key, REFERRAL_STORAGE_KEY))
    );
    if (records.length > 0) {
      const val = records[0].value;
      const parsed = Array.isArray(val)
        ? val
        : val && typeof val === 'object' && Array.isArray((val as any).value)
        ? (val as any).value
        : [];
      memoryReferralsCache = mergeAndDeduplicateReferrals([], parsed);
      return memoryReferralsCache;
    }
  } catch (err: any) {
    logger.warn('[Referrals] DB read failed, using memory cache fallback', { error: err?.message });
  }
  memoryReferralsCache = memoryReferralsCache || [];
  return memoryReferralsCache;
}

// Helper: save to DB and cache
export async function persistReferrals(referrals: any[]) {
  const clean = mergeAndDeduplicateReferrals([], referrals);
  memoryReferralsCache = clean;
  try {
    await withDbRetry(() =>
      db
        .insert(systemSettings)
        .values({
          key: REFERRAL_STORAGE_KEY,
          value: clean,
          description: 'HSE Document Referrals and Digital Signatures',
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: clean, updatedAt: new Date() },
        })
    );
  } catch (err: any) {
    logger.warn('[Referrals] DB write failed, preserved in memory cache', { error: err?.message });
  }
  broadcastDataMutation('referrals', 'update', { updatedAt: new Date().toISOString() });
  broadcastDataMutation('settings', 'update', { key: REFERRAL_STORAGE_KEY });
}

// 1. GET /api/v1/referrals - Get referrals authorized for the current user
referralRouter.get('/', requireAuth, async (req, res) => {
  try {
    const all = await loadReferrals();
    const visible = filterReferralsForUser(req.user, all);
    res.json({
      success: true,
      data: visible,
      meta: {
        isGlobalAdmin: isGlobalAdminUser(req.user),
        totalVisible: visible.length,
      },
    });
  } catch (err: any) {
    const fallback = filterReferralsForUser(req.user, memoryReferralsCache || []);
    res.status(500).json({ success: false, message: err.message, data: fallback });
  }
});

// 1b. GET /api/v1/referrals/:id - Get single referral with strict access control
referralRouter.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const all = await loadReferrals();
    const found = all.find((r) => r.id === id);
    if (!found) {
      return res.status(404).json({ success: false, message: 'سند ارجاع مورد نظر یافت نشد' });
    }
    if (!canUserViewReferral(req.user, found)) {
      return res.status(403).json({
        success: false,
        message: 'شما مجاز به مشاهده یا دسترسی به این سند ارجاعی نیستید.',
      });
    }
    res.json({ success: true, data: recalculateReferralWorkflowState(found) });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. POST /api/v1/referrals - Create or safely merge referrals without overwriting other users' records
referralRouter.post('/', requireAuth, async (req, res) => {
  try {
    const payload = req.body;
    const existing = await loadReferrals();
    const merged = mergeAndDeduplicateReferrals(existing, payload, req.user);

    await persistReferrals(merged);
    const visible = filterReferralsForUser(req.user, merged);
    res.json({
      success: true,
      message: 'ارجاع با موفقیت در پایگاه داده ثبت و همگام‌سازی گردید',
      data: visible,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. POST /api/v1/referrals/:id/action - Process referral action (Approve, Sign, Reject, Delegate, Review, Cancel)
referralRouter.post('/:id/action', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { assigneeId, action, comment, signatureImage, delegateTo, actor } = req.body;

    const all = await loadReferrals();
    const refIndex = all.findIndex((r) => r.id === id);
    if (refIndex === -1) {
      return res.status(404).json({ success: false, message: 'سند ارجاع مورد نظر یافت نشد' });
    }

    let referral = recalculateReferralWorkflowState({ ...all[refIndex] });
    const now = new Date();
    const persianDateTime =
      now.toLocaleDateString('fa-IR') +
      ' ' +
      now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    // Handle CANCEL / WITHDRAW (انصراف از ارجاع توسط فرستنده یا مدیر سامانه)
    if (action === 'CANCEL') {
      const canCancel = isGlobalAdminUser(req.user) || isReferralSender(req.user, referral);
      if (!canCancel) {
        return res.status(403).json({
          success: false,
          message: 'فقط ایجادکننده ارجاع یا مدیر سامانه مجاز به انصراف و لغو ارجاع می‌باشد.',
        });
      }
      if (referral.isLocked) {
        return res.status(400).json({
          success: false,
          message: 'این سند نهایی و قفل شده است و امکان لغو ارجاع آن وجود ندارد.',
        });
      }

      referral.overallStatus = 'REJECTED';
      referral.isLocked = false;
      referral.assignees = (referral.assignees || []).map((a: any) => ({
        ...a,
        isCurrentActive: false,
      }));
      referral.historyLogs = referral.historyLogs || [];
      referral.historyLogs.push({
        id: `log-${Date.now()}`,
        action: 'CANCEL',
        actionTitleFa: 'انصراف و لغو گردش کار ارجاع',
        userId: actor?.id || req.user?.uid || req.user?.id || 'system',
        userName: actor?.fullName || req.user?.name || req.user?.username || 'کاربر سامانه',
        userRole: actor?.role || req.user?.role,
        timestamp: now.toISOString(),
        persianDateTime,
        comment: comment || 'ارجاع سند توسط فرستنده لغو / انصراف داده شد.',
        statusAfter: referral.overallStatus,
      });
      referral.updatedDate = now.toISOString();
      all[refIndex] = referral;
      await persistReferrals(all);
      return res.json({
        success: true,
        message: 'انصراف از ارجاع با موفقیت ثبت گردید',
        data: referral,
      });
    }

    // Find target assignee
    let assigneeIndex = (referral.assignees || []).findIndex((a: any) => a.id === assigneeId);
    if (assigneeIndex === -1 && req.user) {
      assigneeIndex = (referral.assignees || []).findIndex(
        (a: any) => a.status === 'PENDING' && isAssigneeMatchingUser(req.user, a)
      );
    }

    if (assigneeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'ردیف اقدام‌کننده مورد نظر در این ارجاع یافت نشد.',
      });
    }

    const targetAssignee = { ...referral.assignees[assigneeIndex] };

    // Strict Server-Side Authorization & Sequential Stage Check
    if (!canUserActOnAssignee(req.user, referral, targetAssignee)) {
      return res.status(403).json({
        success: false,
        message:
          'شما مجاز به مشاهده، تأیید یا امضای مرحله ارجاع‌شده به شخص دیگر یا خارج از نوبت گردش کار نیستید.',
      });
    }

    let newStatus = 'PENDING';
    let actionTitleFa = '';
    if (action === 'REVIEW') {
      newStatus = 'APPROVED';
      actionTitleFa = 'بررسی و ثبت نظر کارشناسی';
    } else if (action === 'APPROVE') {
      newStatus = 'APPROVED';
      actionTitleFa = 'تأیید سند';
    } else if (action === 'REJECT') {
      newStatus = 'REJECTED';
      actionTitleFa = 'رد سند و اعلام عدم انطباق';
    } else if (action === 'SIGN') {
      newStatus = 'SIGNED';
      actionTitleFa = 'امضای دیجیتال سند';
    } else if (action === 'APPROVE_AND_SIGN') {
      newStatus = 'SIGNED';
      actionTitleFa = 'تأیید و امضای دیجیتال سند';
    } else if (action === 'DELEGATE') {
      newStatus = 'DELEGATED';
      actionTitleFa = 'ارجاع مجدد (تفویض) سند';
    }

    targetAssignee.status = newStatus;
    targetAssignee.statusDate = now.toISOString();
    targetAssignee.comment = comment;
    if (signatureImage) {
      targetAssignee.signatureImage = signatureImage;
      targetAssignee.signedAt = now.toISOString();
      targetAssignee.signedAtPersian = persianDateTime;
    }
    targetAssignee.isCurrentActive = false;

    const updatedAssignees = [...referral.assignees];
    updatedAssignees[assigneeIndex] = targetAssignee;

    // Handle Delegation (Re-referral): insert right after current assignee so workflow continues cleanly
    if (action === 'DELEGATE' && delegateTo) {
      const delegatedStep = {
        id: `asg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        userId: delegateTo.userId,
        userName: delegateTo.userName,
        userRole: delegateTo.userRole,
        userJobTitle: delegateTo.userJobTitle,
        department: delegateTo.department,
        personnelCode: delegateTo.personnelCode,
        actionType: delegateTo.actionType || 'REVIEW',
        deadline: delegateTo.deadline || targetAssignee.deadline || referral.deadline,
        instructions: delegateTo.instructions || comment,
        status: 'PENDING',
        order: (targetAssignee.order || assigneeIndex + 1) + 0.5,
        isCurrentActive: true,
        delegatedBy: targetAssignee.userName,
      };
      updatedAssignees.splice(assigneeIndex + 1, 0, delegatedStep);
      updatedAssignees.forEach((a: any, idx: number) => {
        a.order = idx + 1;
      });
    }

    referral.assignees = updatedAssignees;
    referral = recalculateReferralWorkflowState(referral);

    // Audit log entry
    referral.historyLogs = referral.historyLogs || [];
    referral.historyLogs.push({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      actionTitleFa:
        action === 'DELEGATE' && delegateTo
          ? `ارجاع مجدد به ${delegateTo.userName}`
          : actionTitleFa,
      userId: actor?.id || req.user?.uid || req.user?.id || targetAssignee.userId || 'system',
      userName: actor?.fullName || req.user?.name || req.user?.username || targetAssignee.userName || 'کاربر سامانه',
      userRole: actor?.role || req.user?.role || targetAssignee.userRole,
      userJobTitle: actor?.jobTitle || targetAssignee.userJobTitle,
      department: actor?.department || targetAssignee.department,
      timestamp: now.toISOString(),
      persianDateTime,
      comment: comment || '',
      signatureImage,
      statusAfter: referral.overallStatus,
    });

    referral.updatedDate = now.toISOString();
    all[refIndex] = referral;

    await persistReferrals(all);
    res.json({
      success: true,
      message: 'اقدام با موفقیت ثبت و مرحله بعدی گردش کار بروزرسانی گردید',
      data: referral,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. DELETE /api/v1/referrals/:id - Delete a referral (restricted to Global Admin or sender of unlocked referral)
referralRouter.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let all = await loadReferrals();
    const target = all.find((r) => r.id === id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'ارجاع یافت نشد' });
    }
    if (!isGlobalAdminUser(req.user) && (!isReferralSender(req.user, target) || target.isLocked)) {
      return res.status(403).json({
        success: false,
        message: 'فقط مدیر سامانه مجاز به حذف این رکورد ارجاع می‌باشد.',
      });
    }
    all = all.filter((r) => r.id !== id);
    await persistReferrals(all);
    res.json({ success: true, message: 'ارجاع با موفقیت حذف گردید' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

