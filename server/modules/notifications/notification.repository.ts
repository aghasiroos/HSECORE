import fs from 'fs';
import path from 'path';
import { desc, eq, and, or, sql } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import {
  NotificationRecord,
  NotificationCategory,
  NotificationPriority,
  UserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  WebPushSubscriptionRecord,
  VapidKeySet,
} from './notification.types.ts';
import { logger } from '../../core/logger.ts';

const VAPID_SETTING_KEY = 'hse_web_push_vapid_keys_v1';
const PUSH_SUBS_SETTING_KEY = 'hse_web_push_subscriptions_v1';

// In-memory notification fallback buffer (clean and empty by default)
const inMemoryNotifications: NotificationRecord[] = [];
let inMemoryVapidKeys: VapidKeySet | null = null;
let inMemoryPushSubscriptions: WebPushSubscriptionRecord[] = [];

export class NotificationRepository {
  async getAll(currentUserId?: string): Promise<NotificationRecord[]> {
    try {
      const records = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.isDeleted, false))
        .orderBy(desc(schema.notifications.createdAt));

      // Map database records to NotificationRecord
      return records.map((r) => {
        const readList = (r.readBy as string[]) || [];
        const isRead = currentUserId ? readList.includes(currentUserId) : readList.length > 0;
        const ackList = (r.acknowledgedBy as any[]) || [];

        return {
          id: r.id,
          notifId: r.notifId,
          title: r.title,
          body: r.body,
          type: r.type,
          category: (r.category as NotificationCategory) || 'info',
          priority: (r.priority as NotificationPriority) || 'medium',
          sourceModule: r.sourceModule || 'system',
          actionUrl: r.actionUrl || (r.type === 'REFERRAL' ? '#pending-documents' : undefined),
          recordId: r.recordId || undefined,
          targetType: (r.targetType as any) || 'all',
          targetValues: (r.targetValues as string[]) || [],
          sender: r.sender || undefined,
          readBy: readList,
          read: isRead,
          requiresAck: !!r.requiresAck,
          acknowledgedBy: ackList,
          sirenType: (r.metadata as any)?.sirenType || (r.priority === 'critical' || r.category === 'critical_hse' ? 'siren_evacuation' : undefined),
          metadata: (r.metadata as Record<string, any>) || undefined,
          createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
        };
      });
    } catch (error) {
      logger.debug('Using in-memory fallback for notifications list:', error);
      return [...inMemoryNotifications];
    }
  }

  /**
   * Public active emergency alerts strictly sanitized for unauthenticated / Login Screen / Lock Screen display.
   * Contains NO confidential personnel records, NO internal IDs, and NO private comments.
   */
  async getPublicActiveEmergencies(sinceIso?: string): Promise<Array<{
    notifId: string;
    id: number;
    title: string;
    body: string;
    priority: string;
    riskLevelFa: string;
    category: string;
    sourceModule: string;
    sirenType?: string;
    actionGuidelines?: string;
    requiresAck: boolean;
    acknowledgedCount: number;
    createdAt: string;
  }>> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const minDate = sinceIso && !isNaN(Date.parse(sinceIso))
        ? new Date(Math.max(oneDayAgo.getTime(), Date.parse(sinceIso)))
        : oneDayAgo;

      const records = await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.isDeleted, false),
            or(
              eq(schema.notifications.category, 'critical_hse'),
              eq(schema.notifications.priority, 'critical')
            ),
            sql`${schema.notifications.createdAt} >= ${minDate}`
          )
        )
        .orderBy(desc(schema.notifications.createdAt))
        .limit(15);

      return records
        .filter((r) => r.targetType === 'all' || !r.targetType)
        .map((r) => {
          const ackList = Array.isArray(r.acknowledgedBy) ? r.acknowledgedBy : [];
          return {
            id: r.id,
            notifId: r.notifId,
            title: String(r.title || 'هشدار فوری اضطراری HSE').slice(0, 200),
            body: String(r.body || '').slice(0, 1000),
            priority: r.priority || 'critical',
            riskLevelFa: r.priority === 'critical' || r.category === 'critical_hse'
              ? 'بحرانی (سطح ۱ اضطراری)'
              : 'فوری (سطح ۲)',
            category: r.category || 'critical_hse',
            sourceModule: r.sourceModule || 'emergency',
            sirenType: (r.metadata as any)?.sirenType || 'siren_evacuation',
            actionGuidelines: String((r.metadata as any)?.actionGuidelines || r.body || 'دستورالعمل‌های ایمنی و تخلیه فوری را رعایت فرمایید.').slice(0, 600),
            requiresAck: true,
            acknowledgedCount: ackList.length,
            createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
          };
        });
    } catch (err) {
      logger.error('Error fetching public active emergencies:', err);
      return inMemoryNotifications
        .filter(
          (n) =>
            (n.category === 'critical_hse' || n.priority === 'critical') &&
            (n.targetType === 'all' || !n.targetType)
        )
        .slice(0, 5)
        .map((n) => ({
          id: n.id || 0,
          notifId: n.notifId,
          title: n.title,
          body: n.body,
          priority: n.priority,
          riskLevelFa: 'بحرانی (سطح ۱ اضطراری)',
          category: n.category,
          sourceModule: n.sourceModule,
          sirenType: n.sirenType || 'siren_evacuation',
          actionGuidelines: n.metadata?.actionGuidelines || n.body,
          requiresAck: true,
          acknowledgedCount: (n.acknowledgedBy || []).length,
          createdAt: n.createdAt,
        }));
    }
  }

  async getById(idOrNotifId: string | number): Promise<NotificationRecord | null> {
    const numId = Number(idOrNotifId);
    const idStr = String(idOrNotifId);

    try {
      const condition =
        !isNaN(numId) && Number.isInteger(numId) && numId > 0
          ? or(eq(schema.notifications.id, numId), eq(schema.notifications.notifId, idStr))
          : eq(schema.notifications.notifId, idStr);

      const [record] = await db
        .select()
        .from(schema.notifications)
        .where(and(eq(schema.notifications.isDeleted, false), condition!))
        .limit(1);

      if (!record) return null;

      return {
        id: record.id,
        notifId: record.notifId,
        title: record.title,
        body: record.body,
        type: record.type,
        category: (record.category as NotificationCategory) || 'info',
        priority: (record.priority as NotificationPriority) || 'medium',
        sourceModule: record.sourceModule || 'system',
        actionUrl: record.actionUrl || undefined,
        recordId: record.recordId || undefined,
        targetType: (record.targetType as any) || 'all',
        targetValues: (record.targetValues as string[]) || [],
        sender: record.sender || undefined,
        readBy: (record.readBy as string[]) || [],
        read: ((record.readBy as string[]) || []).length > 0,
        requiresAck: !!record.requiresAck,
        acknowledgedBy: (record.acknowledgedBy as any[]) || [],
        sirenType: (record.metadata as any)?.sirenType || (record.priority === 'critical' || record.category === 'critical_hse' ? 'siren_evacuation' : undefined),
        metadata: (record.metadata as Record<string, any>) || undefined,
        createdAt: record.createdAt.toISOString(),
      };
    } catch {
      const match = inMemoryNotifications.find(
        (n) => n.notifId === idStr || String(n.id) === idStr
      );
      return match || null;
    }
  }

  async create(record: NotificationRecord): Promise<NotificationRecord> {
    inMemoryNotifications.unshift(record);

    try {
      const [inserted] = await db
        .insert(schema.notifications)
        .values({
          notifId: record.notifId,
          title: record.title,
          body: record.body,
          type: record.type,
          category: record.category || 'info',
          priority: record.priority || 'medium',
          sourceModule: record.sourceModule || 'system',
          actionUrl: record.actionUrl || null,
          recordId: record.recordId || null,
          targetType: record.targetType || 'all',
          targetValues: record.targetValues || [],
          sender: record.sender,
          readBy: record.read ? ['system'] : [],
          requiresAck: !!record.requiresAck,
          acknowledgedBy: record.acknowledgedBy || [],
          metadata: record.metadata || null,
          isDeleted: false,
        })
        .returning();

      if (inserted) {
        return {
          ...record,
          id: inserted.id,
          createdAt: inserted.createdAt.toISOString(),
        };
      }
    } catch (error) {
      logger.error('Database notification insert note:', error);
    }

    return record;
  }

  async markRead(idOrNotifId: string | number, userId?: string): Promise<boolean> {
    const idStr = String(idOrNotifId);
    const numId = Number(idOrNotifId);

    // Update in-memory fallback
    for (const item of inMemoryNotifications) {
      if (item.notifId === idStr || String(item.id) === idStr) {
        item.read = true;
        if (userId && (!item.readBy || !item.readBy.includes(userId))) {
          item.readBy = [...(item.readBy || []), userId];
        }
      }
    }

    try {
      const condition =
        !isNaN(numId) && Number.isInteger(numId) && numId > 0
          ? or(eq(schema.notifications.id, numId), eq(schema.notifications.notifId, idStr))
          : eq(schema.notifications.notifId, idStr);

      const [existing] = await db.select().from(schema.notifications).where(condition!).limit(1);

      if (existing) {
        const readList = (existing.readBy as string[]) || [];
        const uidToRecord = userId || 'system';
        if (!readList.includes(uidToRecord)) {
          readList.push(uidToRecord);
        }

        await db
          .update(schema.notifications)
          .set({ readBy: readList })
          .where(eq(schema.notifications.id, existing.id));
      }
      return true;
    } catch (error) {
      logger.debug('Error marking notification read in پایگاه داده:', error);
      return true;
    }
  }

  async acknowledge(
    idOrNotifId: string | number,
    userId: string,
    userName?: string,
    note?: string,
    extra?: {
      acknowledgmentSource?: string;
      clientIp?: string;
    }
  ): Promise<boolean> {
    const idStr = String(idOrNotifId);
    const numId = Number(idOrNotifId);
    const nowIso = new Date().toISOString();
    const ackEntry = {
      userId,
      userName: userName || userId,
      timestamp: nowIso,
      note: note || undefined,
      acknowledgmentSource: extra?.acknowledgmentSource || 'in_app_modal',
      clientIp: extra?.clientIp || undefined,
      status: 'acknowledged' as const,
    };

    // Update in-memory fallback (idempotent per userId)
    for (const item of inMemoryNotifications) {
      if (item.notifId === idStr || String(item.id) === idStr) {
        item.read = true;
        const currentAcks = item.acknowledgedBy || [];
        const existingIdx = currentAcks.findIndex((a) => a.userId === userId);
        if (existingIdx >= 0) {
          currentAcks[existingIdx] = { ...currentAcks[existingIdx], ...ackEntry };
          item.acknowledgedBy = [...currentAcks];
        } else {
          item.acknowledgedBy = [...currentAcks, ackEntry];
        }
        if (!item.readBy?.includes(userId)) {
          item.readBy = [...(item.readBy || []), userId];
        }
      }
    }

    try {
      const condition =
        !isNaN(numId) && Number.isInteger(numId) && numId > 0
          ? or(eq(schema.notifications.id, numId), eq(schema.notifications.notifId, idStr))
          : eq(schema.notifications.notifId, idStr);

      const [existing] = await db.select().from(schema.notifications).where(condition!).limit(1);

      if (existing) {
        const ackList = Array.isArray(existing.acknowledgedBy) ? [...(existing.acknowledgedBy as any[])] : [];
        const existingIdx = ackList.findIndex((a: any) => a && a.userId === userId);
        if (existingIdx >= 0) {
          ackList[existingIdx] = { ...ackList[existingIdx], ...ackEntry };
        } else {
          ackList.push(ackEntry);
        }

        const readList = Array.isArray(existing.readBy) ? [...(existing.readBy as string[])] : [];
        if (!readList.includes(userId)) {
          readList.push(userId);
        }

        await db
          .update(schema.notifications)
          .set({
            acknowledgedBy: ackList,
            readBy: readList,
          })
          .where(eq(schema.notifications.id, existing.id));

        // Record in central audit_logs table for full traceability
        try {
          await db.insert(schema.auditLogs).values({
            userUid: userId,
            action: `تأیید دریافت هشدار فوری HSE و توقف آژیر (${existing.notifId}: ${existing.title})`,
            module: 'Notifications',
            entityType: 'NOTIFICATION',
            entityId: existing.notifId,
            details: {
              notifId: existing.notifId,
              title: existing.title,
              userName: userName || userId,
              acknowledgmentSource: ackEntry.acknowledgmentSource,
              note: ackEntry.note,
              timestamp: nowIso,
            },
            ipAddress: extra?.clientIp || 'local',
            result: 'SUCCESS',
          });
        } catch (auditErr) {
          logger.debug('Audit log entry for alert acknowledgment skipped:', auditErr);
        }
      }
      return true;
    } catch (error) {
      logger.error('Error acknowledging notification in پایگاه داده:', error);
      return true;
    }
  }

  async delete(idOrNotifId: string | number): Promise<boolean> {
    const idStr = String(idOrNotifId);
    const numId = Number(idOrNotifId);

    // Remove from in-memory fallback
    for (let i = inMemoryNotifications.length - 1; i >= 0; i--) {
      const item = inMemoryNotifications[i];
      if (item.notifId === idStr || String(item.id) === idStr) {
        inMemoryNotifications.splice(i, 1);
      }
    }

    try {
      const condition =
        !isNaN(numId) && Number.isInteger(numId) && numId > 0
          ? or(eq(schema.notifications.id, numId), eq(schema.notifications.notifId, idStr))
          : eq(schema.notifications.notifId, idStr);

      await db
        .update(schema.notifications)
        .set({ isDeleted: true })
        .where(condition!);
      return true;
    } catch (error) {
      logger.debug('Error soft-deleting notification from database:', error);
      return true;
    }
  }

  async clearAll(): Promise<boolean> {
    inMemoryNotifications.length = 0;

    try {
      await db
        .update(schema.notifications)
        .set({ isDeleted: true })
        .where(eq(schema.notifications.isDeleted, false));
      return true;
    } catch (error) {
      logger.debug('Error clearing all notifications from database:', error);
      return true;
    }
  }

  async markAllRead(userId?: string): Promise<void> {
    const uidToRecord = userId || 'system';

    inMemoryNotifications.forEach((n) => {
      n.read = true;
      if (!n.readBy || !n.readBy.includes(uidToRecord)) {
        n.readBy = [...(n.readBy || []), uidToRecord];
      }
    });

    try {
      const all = await db
        .select({ id: schema.notifications.id, readBy: schema.notifications.readBy })
        .from(schema.notifications)
        .where(eq(schema.notifications.isDeleted, false));

      for (const n of all) {
        const readList = (n.readBy as string[]) || [];
        if (!readList.includes(uidToRecord)) {
          readList.push(uidToRecord);
          await db
            .update(schema.notifications)
            .set({ readBy: readList })
            .where(eq(schema.notifications.id, n.id));
        }
      }
    } catch (error) {
      logger.debug('Error marking all read in پایگاه داده:', error);
    }
  }

  // --- Web Push VAPID Keys & Device Subscriptions Persisted in PostgreSQL ---
  async getVapidKeys(): Promise<VapidKeySet | null> {
    if (inMemoryVapidKeys) return inMemoryVapidKeys;
    try {
      const [row] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, VAPID_SETTING_KEY))
        .limit(1);
      if (row && row.value && typeof row.value === 'object') {
        const val = row.value as any;
        if (val.publicKey && val.privateKey) {
          inMemoryVapidKeys = val as VapidKeySet;
          return inMemoryVapidKeys;
        }
      }
    } catch (err) {
      logger.debug('Error reading VAPID keys from DB:', err);
    }
    return null;
  }

  async saveVapidKeys(keys: VapidKeySet): Promise<VapidKeySet> {
    inMemoryVapidKeys = keys;
    try {
      await db
        .insert(schema.systemSettings)
        .values({
          key: VAPID_SETTING_KEY,
          value: keys,
          description: 'کلیدهای رمزنگاری VAPID جهت اعلان‌های بومی Web Push و صفحه قفل (RFC 8292)',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: {
            value: keys,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      logger.debug('Error saving VAPID keys to DB:', err);
    }
    return keys;
  }

  async getAllPushSubscriptions(): Promise<WebPushSubscriptionRecord[]> {
    try {
      const [row] = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, PUSH_SUBS_SETTING_KEY))
        .limit(1);
      if (row && Array.isArray(row.value)) {
        inMemoryPushSubscriptions = row.value as WebPushSubscriptionRecord[];
        return inMemoryPushSubscriptions;
      }
    } catch (err) {
      logger.debug('Error loading Web Push subscriptions from DB:', err);
    }
    return inMemoryPushSubscriptions;
  }

  async upsertPushSubscription(sub: Omit<WebPushSubscriptionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebPushSubscriptionRecord> {
    const existingList = await this.getAllPushSubscriptions();
    const nowIso = new Date().toISOString();
    const existingIdx = existingList.findIndex((item) => item.endpoint === sub.endpoint);

    let savedRecord: WebPushSubscriptionRecord;
    if (existingIdx >= 0) {
      savedRecord = {
        ...existingList[existingIdx],
        ...sub,
        updatedAt: nowIso,
      };
      existingList[existingIdx] = savedRecord;
    } else {
      savedRecord = {
        id: `pushsub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...sub,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      existingList.unshift(savedRecord);
    }

    // Keep max 500 active device subscriptions
    const trimmed = existingList.slice(0, 500);
    inMemoryPushSubscriptions = trimmed;

    try {
      await db
        .insert(schema.systemSettings)
        .values({
          key: PUSH_SUBS_SETTING_KEY,
          value: trimmed,
          description: 'فهرست اشتراک‌های فعال Web Push دستگاه‌ها (موبایل و دسکتاپ)',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: {
            value: trimmed,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      logger.debug('Error persisting Web Push subscription to DB:', err);
    }

    return savedRecord;
  }

  async removePushSubscription(endpoint: string): Promise<boolean> {
    const existingList = await this.getAllPushSubscriptions();
    const filtered = existingList.filter((item) => item.endpoint !== endpoint);
    inMemoryPushSubscriptions = filtered;

    try {
      await db
        .insert(schema.systemSettings)
        .values({
          key: PUSH_SUBS_SETTING_KEY,
          value: filtered,
          description: 'فهرست اشتراک‌های فعال Web Push دستگاه‌ها (موبایل و دسکتاپ)',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: {
            value: filtered,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      logger.debug('Error removing Web Push subscription from DB:', err);
    }
    return true;
  }

  // --- User & System Preferences Persisted in Database ---
  private inMemoryPreferencesByUser = new Map<string, UserNotificationPreferences>();

  async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    const key = String(userId || 'anonymous');
    try {
      const [user] = await db
        .select({ profileData: schema.users.profileData })
        .from(schema.users)
        .where(or(eq(schema.users.uid, key), eq(schema.users.username, key)))
        .limit(1);

      if (user && user.profileData && typeof user.profileData === 'object') {
        const p = user.profileData as any;
        if (p.notificationSettings) {
          const ns = { ...p.notificationSettings };
          if (ns.criticalHseCustomAudioUrl?.startsWith('data:')) {
            try {
              const base64Data = ns.criticalHseCustomAudioUrl.split(',')[1];
              if (base64Data) {
                const targetDir = path.resolve(process.cwd(), 'public/assets');
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
                fs.writeFileSync(path.join(targetDir, 'custom-siren.mp3'), Buffer.from(base64Data, 'base64'));
              }
            } catch (writeErr) {
              logger.warn('Failed saving custom-siren.mp3 to disk:', writeErr);
            }
            ns.criticalHseCustomAudioUrl = '/api/v1/notifications/custom-siren';
          }
          const resolved: UserNotificationPreferences = {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...ns,
            enabledCategories: {
              ...DEFAULT_NOTIFICATION_PREFERENCES.enabledCategories,
              ...(ns.enabledCategories || {}),
            },
          };
          this.inMemoryPreferencesByUser.set(key, resolved);
          return resolved;
        }
      }
    } catch (err) {
      logger.debug('Failed to load user notification preferences from DB:', err);
    }

    return this.inMemoryPreferencesByUser.get(key) || { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  async saveUserPreferences(
    userId: string,
    prefs: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    const key = String(userId || 'anonymous');
    const existing = await this.getUserPreferences(key);
    const mergedSettings: UserNotificationPreferences = {
      ...existing,
      ...prefs,
      enabledCategories: {
        ...existing.enabledCategories,
        ...(prefs.enabledCategories || {}),
      },
    };

    // If custom audio was passed as base64 data URL, extract it to disk to prevent DB/sync bloat
    if (mergedSettings.criticalHseCustomAudioUrl?.startsWith('data:')) {
      try {
        const base64Data = mergedSettings.criticalHseCustomAudioUrl.split(',')[1];
        if (base64Data) {
          const targetDir = path.resolve(process.cwd(), 'public/assets');
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.writeFileSync(path.join(targetDir, 'custom-siren.mp3'), Buffer.from(base64Data, 'base64'));
        }
      } catch (err) {
        logger.warn('Failed to extract custom siren audio to disk:', err);
      }
      mergedSettings.criticalHseCustomAudioUrl = '/api/v1/notifications/custom-siren';
    }

    this.inMemoryPreferencesByUser.set(key, mergedSettings);

    try {
      const [user] = await db
        .select({ id: schema.users.id, profileData: schema.users.profileData })
        .from(schema.users)
        .where(or(eq(schema.users.uid, key), eq(schema.users.username, key)))
        .limit(1);

      if (user) {
        const currentProfile = (user.profileData as Record<string, any>) || {};
        currentProfile.notificationSettings = mergedSettings;

        await db
          .update(schema.users)
          .set({
            profileData: currentProfile,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id));
      }

      return mergedSettings;
    } catch (err) {
      logger.error('Failed to save notification preferences in DB:', err);
      return mergedSettings;
    }
  }
}

export const notificationRepository = new NotificationRepository();

