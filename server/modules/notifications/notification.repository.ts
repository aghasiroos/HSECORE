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
} from './notification.types.ts';
import { logger } from '../../core/logger.ts';

// In-memory notification fallback buffer (clean and empty by default)
const inMemoryNotifications: NotificationRecord[] = [];

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
          metadata: (r.metadata as Record<string, any>) || undefined,
          createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
        };
      });
    } catch (error) {
      logger.debug('Using in-memory fallback for notifications list:', error);
      return [...inMemoryNotifications];
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
    note?: string
  ): Promise<boolean> {
    const idStr = String(idOrNotifId);
    const numId = Number(idOrNotifId);
    const ackEntry = {
      userId,
      userName: userName || userId,
      timestamp: new Date().toISOString(),
      note: note || undefined,
    };

    // Update in-memory fallback
    for (const item of inMemoryNotifications) {
      if (item.notifId === idStr || String(item.id) === idStr) {
        item.read = true;
        item.acknowledgedBy = [...(item.acknowledgedBy || []), ackEntry];
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
        const ackList = (existing.acknowledgedBy as any[]) || [];
        ackList.push(ackEntry);

        const readList = (existing.readBy as string[]) || [];
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

  // --- User & System Preferences Persisted in Database ---
  private inMemoryPreferences: UserNotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };

  async getUserPreferences(userId: string): Promise<UserNotificationPreferences> {
    try {
      const [user] = await db
        .select({ profileData: schema.users.profileData })
        .from(schema.users)
        .where(or(eq(schema.users.uid, userId), eq(schema.users.username, userId)))
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
          this.inMemoryPreferences = {
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...this.inMemoryPreferences,
            ...ns,
          };
          return this.inMemoryPreferences;
        }
      }
    } catch (err) {
      logger.debug('Failed to load user notification preferences from DB:', err);
    }

    return this.inMemoryPreferences;
  }

  async saveUserPreferences(
    userId: string,
    prefs: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    const mergedSettings: UserNotificationPreferences = {
      ...this.inMemoryPreferences,
      ...prefs,
      enabledCategories: {
        ...this.inMemoryPreferences.enabledCategories,
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

    this.inMemoryPreferences = mergedSettings;

    try {
      const [user] = await db
        .select({ id: schema.users.id, profileData: schema.users.profileData })
        .from(schema.users)
        .where(or(eq(schema.users.uid, userId), eq(schema.users.username, userId)))
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
