/**
 * HSECORE AI Chat Session Service
 * Persistent, user-isolated chat history stored in PostgreSQL.
 * Replaces frontend localStorage storage for compliance with HSECORE security rules.
 */

import { eq, desc, and, or, sql } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import { logger } from '../../core/logger.ts';
import { randomUUID } from 'crypto';
import type { UserContext } from '../../core/middleware/auth.ts';

export interface SessionSummary {
  id: string;
  title: string;
  assistantId: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolsUsed?: string[];
  citations?: string[];
  durationMs?: number;
  model?: string;
  createdAt: string;
}

export class AISessionService {
  private schemaReadyPromise: Promise<void> | null = null;

  private inMemorySessions: Map<string, {
    id: string;
    userId: number | null;
    userUid: string | null;
    username: string | null;
    title: string;
    assistantId: string;
    createdAt: string;
    updatedAt: string;
    messages: SessionMessage[];
  }> = new Map();

  private resolveUserIdentity(user: UserContext): {
    userId: number | null;
    userUid: string | null;
    username: string | null;
  } {
    const rawId = user?.id != null ? Number(user.id) : NaN;
    const userId = Number.isInteger(rawId) && rawId > 0 ? rawId : null;
    const userUid = user?.uid ? String(user.uid).trim() : null;
    const username = (user?.username || user?.name || '').trim().toLowerCase() || null;
    return { userId, userUid, username };
  }

  private async ensureSchema(): Promise<void> {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = (async () => {
        try {
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS ai_chat_sessions (
              id TEXT PRIMARY KEY,
              user_id INTEGER,
              user_uid TEXT,
              title TEXT NOT NULL,
              assistant_id TEXT DEFAULT 'GENERAL_HSE' NOT NULL,
              metadata JSONB DEFAULT '{}'::jsonb,
              created_at TIMESTAMP DEFAULT NOW() NOT NULL,
              updated_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
            ALTER TABLE ai_chat_sessions
              ADD COLUMN IF NOT EXISTS user_id INTEGER,
              ADD COLUMN IF NOT EXISTS user_uid TEXT,
              ADD COLUMN IF NOT EXISTS assistant_id TEXT DEFAULT 'GENERAL_HSE' NOT NULL,
              ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
              ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL,
              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
            CREATE TABLE IF NOT EXISTS ai_chat_messages (
              id TEXT PRIMARY KEY,
              session_id TEXT NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              tools_used JSONB,
              citations JSONB,
              duration_ms INTEGER,
              model TEXT,
              created_at TIMESTAMP DEFAULT NOW() NOT NULL
            );
            ALTER TABLE ai_chat_messages
              ADD COLUMN IF NOT EXISTS tools_used JSONB,
              ADD COLUMN IF NOT EXISTS citations JSONB,
              ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
              ADD COLUMN IF NOT EXISTS model TEXT,
              ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW() NOT NULL;
          `);
        } catch (err: any) {
          // Do not mark the schema as ready when DDL failed. A rejected promise is
          // retried on the next request instead of silently switching to volatile memory.
          this.schemaReadyPromise = null;
          logger.error('[AISessionService] Schema initialization failed', { error: err?.message || err });
          throw err;
        }
      })();
    }
    return this.schemaReadyPromise;
  }

  private matchesUser(
    record: { userId?: number | null; userUid?: string | null; username?: string | null },
    identity: { userId: number | null; userUid: string | null; username: string | null }
  ): boolean {
    const recordHasStableIdentity = record.userId != null || Boolean(record.userUid?.trim());
    const identityHasStableIdentity = identity.userId != null || Boolean(identity.userUid?.trim());

    // Stable identifiers are authoritative: any available stable-identity mismatch denies access.
    if (identity.userId != null && record.userId != null && Number(record.userId) !== identity.userId) return false;
    if (identity.userUid && record.userUid && record.userUid.trim() !== identity.userUid) return false;

    if (recordHasStableIdentity && identityHasStableIdentity) {
      return (identity.userId != null && record.userId != null && Number(record.userId) === identity.userId) ||
        Boolean(identity.userUid && record.userUid && record.userUid.trim() === identity.userUid);
    }

    // Username matching is reserved for genuinely legacy rows with no stable owner identifiers.
    if (!recordHasStableIdentity && identity.username && record.username) {
      return record.username.trim().toLowerCase() === identity.username;
    }
    return false;
  }

  /**
   * List sessions belonging to the authenticated user only.
   */
  async listSessions(user: UserContext, limit = 50): Promise<SessionSummary[]> {
    await this.ensureSchema();
    const identity = this.resolveUserIdentity(user);
    const { userId, userUid, username } = identity;

    const mergedMap = new Map<string, SessionSummary>();

    try {
      const conditions = [];
      if (userId != null) {
        conditions.push(eq(schema.aiChatSessions.userId, userId));
      }
      if (userUid) {
        conditions.push(eq(schema.aiChatSessions.userUid, userUid));
      }
      if (username) {
        conditions.push(sql`user_id IS NULL AND user_uid IS NULL AND LOWER(COALESCE(${schema.aiChatSessions.metadata}->>'username', '')) = ${username}`);
      }

      if (conditions.length > 0) {
        const whereClause = conditions.length === 1 ? conditions[0] : or(...conditions);

        const rows = await db
          .select({
            id: schema.aiChatSessions.id,
            title: schema.aiChatSessions.title,
            assistantId: schema.aiChatSessions.assistantId,
            createdAt: schema.aiChatSessions.createdAt,
            updatedAt: schema.aiChatSessions.updatedAt,
            messageCount: sql<number>`(SELECT COUNT(*)::int FROM ai_chat_messages m WHERE m.session_id = ${schema.aiChatSessions.id})`,
          })
          .from(schema.aiChatSessions)
          .where(whereClause!)
          .orderBy(desc(schema.aiChatSessions.updatedAt))
          .limit(Math.min(Math.max(limit, 1), 100));

        for (const r of rows) {
          const existingMem = this.inMemorySessions.get(r.id);
          const createdAtStr = r.createdAt?.toISOString?.() ?? String(r.createdAt);
          const updatedAtStr = r.updatedAt?.toISOString?.() ?? String(r.updatedAt);
          const dbMsgCount = Number(r.messageCount || 0);
          const memMsgCount = existingMem?.messages?.length || 0;

          const item: SessionSummary = {
            id: r.id,
            title: existingMem?.title && existingMem.title !== 'گفت‌وگوی جدید' && r.title === 'گفت‌وگوی جدید'
              ? existingMem.title
              : r.title,
            assistantId: r.assistantId || 'GENERAL_HSE',
            createdAt: createdAtStr,
            updatedAt: existingMem && new Date(existingMem.updatedAt).getTime() > new Date(updatedAtStr).getTime()
              ? existingMem.updatedAt
              : updatedAtStr,
            messageCount: Math.max(dbMsgCount, memMsgCount),
          };
          mergedMap.set(item.id, item);

          if (!existingMem) {
            this.inMemorySessions.set(item.id, {
              ...item,
              userId,
              userUid,
              username,
              messages: [],
            });
          } else {
            existingMem.title = item.title;
            existingMem.updatedAt = item.updatedAt;
          }
        }
      }
    } catch (err: any) {
      logger.error('[AISessionService] Database error listing sessions', { error: err?.message || err });
      throw new Error('ذخیره‌ساز گفتگوها در دسترس نیست؛ تاریخچه از پایگاه داده قابل دریافت نیست.');
    }

    // Merge any in-memory sessions not yet reflected in DB query
    for (const item of this.inMemorySessions.values()) {
      if (this.matchesUser(item, identity) && !mergedMap.has(item.id)) {
        mergedMap.set(item.id, {
          id: item.id,
          title: item.title,
          assistantId: item.assistantId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          messageCount: item.messages.length,
        });
      }
    }

    const result = Array.from(mergedMap.values());
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return result.slice(0, limit);
  }

  /**
   * Create a new chat session owned by the user.
   */
  async createSession(
    user: UserContext,
    title?: string,
    assistantId: string = 'GENERAL_HSE',
    customId?: string
  ): Promise<SessionSummary> {
    await this.ensureSchema();
    const id = customId && customId.trim() ? customId.trim() : randomUUID();
    const now = new Date();
    const sessionTitle = (title || 'مشاوره جدید HSE').slice(0, 200);
    const { userId, userUid, username } = this.resolveUserIdentity(user);

    const summary: SessionSummary = {
      id,
      title: sessionTitle,
      assistantId: assistantId || 'GENERAL_HSE',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messageCount: 0,
    };

    try {
      await db
        .insert(schema.aiChatSessions)
        .values({
          id,
          userId,
          userUid,
          title: sessionTitle,
          assistantId: assistantId || 'GENERAL_HSE',
          metadata: username ? { username } : {},
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: schema.aiChatSessions.id });

      const rows = await db.select({
        userId: schema.aiChatSessions.userId,
        userUid: schema.aiChatSessions.userUid,
        metadata: schema.aiChatSessions.metadata,
        title: schema.aiChatSessions.title,
        assistantId: schema.aiChatSessions.assistantId,
        createdAt: schema.aiChatSessions.createdAt,
        updatedAt: schema.aiChatSessions.updatedAt,
      }).from(schema.aiChatSessions).where(eq(schema.aiChatSessions.id, id)).limit(1);
      const row = rows[0];
      if (!row || !this.matchesUser({
        userId: row.userId,
        userUid: row.userUid,
        username: (row.metadata as any)?.username || null,
      }, { userId, userUid, username })) {
        throw new Error('شناسه گفت‌وگو قبلاً به کاربر دیگری تعلق دارد.');
      }

      const actualUsername = (row.metadata as any)?.username || username;
      this.inMemorySessions.set(id, {
        id,
        userId: row.userId ?? null,
        userUid: row.userUid ?? null,
        username: actualUsername ?? null,
        title: row.title,
        assistantId: row.assistantId || 'GENERAL_HSE',
        createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
        updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
        messages: this.inMemorySessions.get(id)?.messages || [],
      });
      return {
        ...summary,
        title: row.title,
        assistantId: row.assistantId || 'GENERAL_HSE',
        createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
        updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
      };
    } catch (err: any) {
      logger.error('[AISessionService] Database error creating session', { error: err?.message || err });
      throw new Error(err?.message?.includes('تعلق') ? err.message : 'ایجاد گفت‌وگو در پایگاه داده انجام نشد؛ لطفاً اتصال پایگاه داده را بررسی کنید.');
    }
  }

  /**
   * Check session ownership status: 'owned' | 'forbidden' | 'not_found' (fail-closed).
   */
  private async checkSessionOwnership(
    sessionId: string,
    user: UserContext
  ): Promise<'owned' | 'forbidden' | 'not_found'> {
    await this.ensureSchema();
    const identity = this.resolveUserIdentity(user);

    const mem = this.inMemorySessions.get(sessionId);
    if (mem) {
      return this.matchesUser(mem, identity) ? 'owned' : 'forbidden';
    }

    try {
      const rows = await db
        .select({
          userId: schema.aiChatSessions.userId,
          userUid: schema.aiChatSessions.userUid,
          metadata: schema.aiChatSessions.metadata,
          title: schema.aiChatSessions.title,
          assistantId: schema.aiChatSessions.assistantId,
          createdAt: schema.aiChatSessions.createdAt,
          updatedAt: schema.aiChatSessions.updatedAt,
        })
        .from(schema.aiChatSessions)
        .where(eq(schema.aiChatSessions.id, sessionId))
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        const rowUsername = (row.metadata as any)?.username || null;
        if (this.matchesUser({ userId: row.userId, userUid: row.userUid, username: rowUsername }, identity)) {
          this.inMemorySessions.set(sessionId, {
            id: sessionId,
            userId: row.userId ?? identity.userId,
            userUid: row.userUid ?? identity.userUid,
            username: rowUsername ?? identity.username,
            title: row.title,
            assistantId: row.assistantId || 'GENERAL_HSE',
            createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
            updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
            messages: [],
          });
          return 'owned';
        }
        return 'forbidden';
      }
    } catch (err: any) {
      logger.error('[AISessionService] Database error checking session ownership', { error: err?.message || err });
      throw new Error('بررسی مالکیت گفتگو در پایگاه داده ناموفق بود.');
    }

    return 'not_found';
  }

  /**
   * Get messages of a session (ownership-checked), merging DB and in-memory state so no reply is lost.
   */
  async getMessages(sessionId: string, user: UserContext, limit = 200): Promise<SessionMessage[]> {
    const status = await this.checkSessionOwnership(sessionId, user);
    if (status !== 'owned') {
      throw new Error('دسترسی به این گفتگو مجاز نیست یا گفتگو یافت نشد.');
    }

    const mem = this.inMemorySessions.get(sessionId);
    const memMessages = mem?.messages || [];
    const mergedById = new Map<string, SessionMessage>();

    try {
      const rows = await db
        .select()
        .from(schema.aiChatMessages)
        .where(eq(schema.aiChatMessages.sessionId, sessionId))
        .orderBy(schema.aiChatMessages.createdAt)
        .limit(Math.min(Math.max(limit, 1), 500));

      for (const r of rows) {
        mergedById.set(r.id, {
          id: r.id,
          sessionId: r.sessionId,
          role: r.role as 'user' | 'assistant' | 'system',
          content: r.content,
          toolsUsed: Array.isArray(r.toolsUsed) ? (r.toolsUsed as string[]) : undefined,
          citations: Array.isArray(r.citations) ? (r.citations as string[]) : undefined,
          durationMs: r.durationMs ?? undefined,
          model: r.model ?? undefined,
          createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
        });
      }
    } catch (err: any) {
      logger.error('[AISessionService] Database error fetching messages', { error: err?.message || err });
      throw new Error('خواندن پیام‌های گفتگو از پایگاه داده ناموفق بود.');
    }

    // Merge any in-memory messages that might not have been flushed to DB yet
    const unsyncedMessages: SessionMessage[] = [];
    for (const m of memMessages) {
      const existing = mergedById.get(m.id);
      if (!existing || (m.content.length > existing.content.length)) {
        mergedById.set(m.id, m);
        if (!existing) unsyncedMessages.push(m);
      }
    }

    // Best-effort background flush of any in-memory message that was missing in DB
    if (unsyncedMessages.length > 0) {
      void (async () => {
        for (const m of unsyncedMessages) {
          try {
            await db
              .insert(schema.aiChatMessages)
              .values({
                id: m.id,
                sessionId,
                role: m.role,
                content: m.content,
                toolsUsed: m.toolsUsed || null,
                citations: m.citations || null,
                durationMs: m.durationMs != null ? Math.round(Number(m.durationMs)) : null,
                model: m.model ?? null,
                createdAt: new Date(m.createdAt || Date.now()),
              })
              .onConflictDoNothing();
          } catch {
            // ignore background sync error
          }
        }
      })();
    }

    const list = Array.from(mergedById.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (mem) {
      mem.messages = list;
    }

    return list;
  }

  /**
   * Append or update a message in a session (idempotent by message.id) and touch updatedAt.
   */
  async appendMessage(
    sessionId: string,
    user: UserContext,
    message: {
      id?: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      toolsUsed?: string[];
      citations?: string[];
      durationMs?: number;
      model?: string;
    }
  ): Promise<SessionMessage> {
    const status = await this.checkSessionOwnership(sessionId, user);
    if (status === 'forbidden') {
      throw new Error('دسترسی به این گفتگو مجاز نیست یا گفتگو یافت نشد.');
    }
    if (status === 'not_found') {
      await this.createSession(user, 'گفت‌وگوی جدید', 'GENERAL_HSE', sessionId);
    }

    const id = message.id && message.id.trim() ? message.id.trim() : randomUUID();
    const now = new Date();
    const safeDurationMs =
      message.durationMs != null && Number.isFinite(Number(message.durationMs))
        ? Math.round(Number(message.durationMs))
        : undefined;

    const newMsg: SessionMessage = {
      id,
      sessionId,
      role: message.role,
      content: message.content,
      toolsUsed: Array.isArray(message.toolsUsed) && message.toolsUsed.length > 0 ? message.toolsUsed : undefined,
      citations: Array.isArray(message.citations) && message.citations.length > 0 ? message.citations : undefined,
      durationMs: safeDurationMs,
      model: message.model,
      createdAt: now.toISOString(),
    };

    const mem = this.inMemorySessions.get(sessionId);
    if (mem) {
      const existingIdx = mem.messages.findIndex((m) => m.id === id);
      if (existingIdx >= 0) {
        newMsg.createdAt = mem.messages[existingIdx].createdAt || newMsg.createdAt;
        mem.messages[existingIdx] = newMsg;
      } else {
        // Also deduplicate if the exact same role + content was appended within the last 3 seconds
        const recentDupIdx = mem.messages.findIndex(
          (m) =>
            m.role === message.role &&
            m.content === message.content &&
            Math.abs(new Date(m.createdAt).getTime() - now.getTime()) < 3000
        );
        if (recentDupIdx >= 0) {
          mem.messages[recentDupIdx] = { ...mem.messages[recentDupIdx], ...newMsg, id: mem.messages[recentDupIdx].id };
          return mem.messages[recentDupIdx];
        }
        mem.messages.push(newMsg);
      }
      mem.updatedAt = now.toISOString();
    }

    try {
      const identity = this.resolveUserIdentity(user);
      // Ensure parent session exists in PostgreSQL before inserting message
      await db
        .insert(schema.aiChatSessions)
        .values({
          id: sessionId,
          userId: identity.userId,
          userUid: identity.userUid,
          title: mem?.title || 'گفت‌وگوی جدید',
          assistantId: mem?.assistantId || 'GENERAL_HSE',
          metadata: identity.username ? { username: identity.username } : {},
          createdAt: mem?.createdAt ? new Date(mem.createdAt) : now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.aiChatSessions.id,
          set: { updatedAt: now },
        });

      await db
        .insert(schema.aiChatMessages)
        .values({
          id,
          sessionId,
          role: message.role,
          content: message.content,
          toolsUsed: newMsg.toolsUsed || null,
          citations: newMsg.citations || null,
          durationMs: safeDurationMs ?? null,
          model: message.model ?? null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: schema.aiChatMessages.id,
          set: {
            content: message.content,
            toolsUsed: newMsg.toolsUsed || null,
            citations: newMsg.citations || null,
            durationMs: safeDurationMs ?? null,
            model: message.model ?? null,
          },
        });

      // Auto-title from first user message if still default
      if (message.role === 'user' && message.content.trim()) {
        try {
          const sessions = await db
            .select({ title: schema.aiChatSessions.title })
            .from(schema.aiChatSessions)
            .where(eq(schema.aiChatSessions.id, sessionId))
            .limit(1);
          const currentTitle = (sessions[0]?.title || '').trim();
          if (
            !currentTitle ||
            currentTitle.startsWith('مشاوره جدید') ||
            currentTitle.startsWith('مشاوره جامع') ||
            currentTitle === 'گفتگوی جدید' ||
            currentTitle === 'گفت‌وگوی جدید'
          ) {
            const autoTitle = message.content.trim().slice(0, 80);
            await db
              .update(schema.aiChatSessions)
              .set({ title: autoTitle, updatedAt: now })
              .where(eq(schema.aiChatSessions.id, sessionId));
            if (mem) mem.title = autoTitle;
          }
        } catch (e) {
          logger.warn('AI session auto-title failed', e);
        }
      }
    } catch (err: any) {
      if (mem) mem.messages = mem.messages.filter(item => item.id !== id);
      logger.error('[AISessionService] Database error appending message', { error: err?.message || err });
      throw new Error('ذخیره پیام در پایگاه داده ناموفق بود؛ پیام به‌عنوان ذخیره‌شده تأیید نمی‌شود.');
    }

    return newMsg;
  }

  /**
   * Delete a session and its messages (cascade) — ownership-checked.
   */
  async deleteSession(sessionId: string, user: UserContext): Promise<void> {
    const status = await this.checkSessionOwnership(sessionId, user);
    if (status !== 'owned') {
      throw new Error('دسترسی به این گفتگو مجاز نیست یا گفتگو یافت نشد.');
    }
    try {
      await db.delete(schema.aiChatSessions).where(eq(schema.aiChatSessions.id, sessionId));
      this.inMemorySessions.delete(sessionId);
    } catch (err: any) {
      logger.error('[AISessionService] Database error deleting session', { error: err?.message || err });
      throw new Error('حذف گفتگو در پایگاه داده ناموفق بود؛ سابقه موجود حفظ شد.');
    }
  }

  /**
   * Optional one-time migration helper: import sessions from a client payload.
   * Only imports into the current user's account.
   */
  async importLocalSessions(
    user: UserContext,
    payload: Array<{
      id?: string;
      title?: string;
      assistantId?: string;
      messages?: Array<{
        id?: string;
        role: 'user' | 'assistant';
        content: string;
        toolsUsed?: string[];
        citations?: string[];
        durationMs?: number;
        model?: string;
        timestamp?: string;
      }>;
    }>
  ): Promise<{ imported: number }> {
    if (!Array.isArray(payload) || payload.length === 0) return { imported: 0 };
    const batch = payload.slice(0, 30);
    if (batch.some(item => !item?.id || !String(item.id).trim())) {
      throw new Error('انتقال تاریخچه به شناسه پایدار برای هر گفتگو نیاز دارد؛ نسخه محلی حفظ شد.');
    }
    let imported = 0;
    for (const item of batch) {
      const session = await this.createSession(user, item.title, item.assistantId || 'GENERAL_HSE', item.id);
      const msgs = Array.isArray(item.messages) ? item.messages.slice(0, 100) : [];
      for (let messageIndex = 0; messageIndex < msgs.length; messageIndex++) {
        const m = msgs[messageIndex];
        if (!m.content || (m.role !== 'user' && m.role !== 'assistant')) continue;
        await this.appendMessage(session.id, user, {
          id: m.id || `legacy-${session.id}-${messageIndex}`.slice(0, 200),
          role: m.role,
          content: String(m.content).slice(0, 50000),
          toolsUsed: m.toolsUsed,
          citations: m.citations,
          durationMs: m.durationMs,
          model: m.model,
        });
      }
      imported += 1;
    }
    return { imported };
  }
}

export const aiSessionService = new AISessionService();
