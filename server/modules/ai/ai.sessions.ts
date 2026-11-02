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
  private inMemorySessions: Map<string, {
    id: string;
    userId: number | null;
    userUid: string | null;
    title: string;
    assistantId: string;
    createdAt: string;
    updatedAt: string;
    messages: SessionMessage[];
  }> = new Map();

  /**
   * List sessions belonging to the authenticated user only.
   */
  async listSessions(user: UserContext, limit = 50): Promise<SessionSummary[]> {
    const userId = user.id != null ? Number(user.id) : null;
    const userUid = user.uid || null;

    try {
      // Match sessions owned by this user via userId OR userUid (not AND).
      const conditions = [];
      if (userId != null && !Number.isNaN(userId)) {
        conditions.push(eq(schema.aiChatSessions.userId, userId));
      }
      if (userUid) {
        conditions.push(eq(schema.aiChatSessions.userUid, userUid));
      }
      if (conditions.length === 0) {
        return [];
      }

      const whereClause = conditions.length === 1 ? conditions[0] : or(...conditions);

      const rows = await db
        .select({
          id: schema.aiChatSessions.id,
          title: schema.aiChatSessions.title,
          assistantId: schema.aiChatSessions.assistantId,
          createdAt: schema.aiChatSessions.createdAt,
          updatedAt: schema.aiChatSessions.updatedAt,
        })
        .from(schema.aiChatSessions)
        .where(whereClause!)
        .orderBy(desc(schema.aiChatSessions.updatedAt))
        .limit(Math.min(Math.max(limit, 1), 100));

      const list = rows.map((r) => ({
        id: r.id,
        title: r.title,
        assistantId: r.assistantId || 'GENERAL_HSE',
        createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
        updatedAt: r.updatedAt?.toISOString?.() ?? String(r.updatedAt),
      }));

      // Keep in-memory cache synchronized
      for (const item of list) {
        if (!this.inMemorySessions.has(item.id)) {
          this.inMemorySessions.set(item.id, {
            ...item,
            userId,
            userUid,
            messages: [],
          });
        }
      }

      return list;
    } catch (err: any) {
      logger.warn('[AISessionService] Database error listing sessions, using in-memory store fallback', { error: err?.message || err });
      const memList: SessionSummary[] = [];
      for (const item of this.inMemorySessions.values()) {
        const match =
          (userId != null && item.userId === userId) ||
          (userUid && item.userUid === userUid);
        if (match) {
          memList.push({
            id: item.id,
            title: item.title,
            assistantId: item.assistantId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            messageCount: item.messages.length,
          });
        }
      }
      memList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return memList.slice(0, limit);
    }
  }

  /**
   * Create a new chat session owned by the user.
   */
  async createSession(
    user: UserContext,
    title?: string,
    assistantId: string = 'GENERAL_HSE'
  ): Promise<SessionSummary> {
    const id = randomUUID();
    const now = new Date();
    const sessionTitle = (title || 'مشاوره جدید HSE').slice(0, 200);
    const userId = user.id != null ? Number(user.id) : null;
    const userUid = user.uid || null;

    const summary: SessionSummary = {
      id,
      title: sessionTitle,
      assistantId: assistantId || 'GENERAL_HSE',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.inMemorySessions.set(id, {
      ...summary,
      userId,
      userUid,
      messages: [],
    });

    try {
      await db.insert(schema.aiChatSessions).values({
        id,
        userId,
        userUid,
        title: sessionTitle,
        assistantId: assistantId || 'GENERAL_HSE',
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
    } catch (err: any) {
      logger.warn('[AISessionService] Database error creating session, session cached in memory', { error: err?.message || err });
    }

    return summary;
  }

  /**
   * Ensure the session belongs to the requesting user (fail-closed).
   */
  private async assertSessionOwnership(sessionId: string, user: UserContext): Promise<boolean> {
    const userId = user.id != null ? Number(user.id) : null;
    const userUid = user.uid || null;

    try {
      const rows = await db
        .select({
          userId: schema.aiChatSessions.userId,
          userUid: schema.aiChatSessions.userUid,
        })
        .from(schema.aiChatSessions)
        .where(eq(schema.aiChatSessions.id, sessionId))
        .limit(1);

      if (rows.length > 0) {
        const row = rows[0];
        if (userId != null && row.userId != null && Number(row.userId) === userId) return true;
        if (userUid && row.userUid && row.userUid === userUid) return true;
        return false;
      }
    } catch (err: any) {
      logger.warn('[AISessionService] Database error checking ownership, checking in-memory cache', { error: err?.message || err });
    }

    const mem = this.inMemorySessions.get(sessionId);
    if (mem) {
      if (userId != null && mem.userId != null && mem.userId === userId) return true;
      if (userUid && mem.userUid && mem.userUid === userUid) return true;
    }

    return false;
  }

  /**
   * Get messages of a session (ownership-checked).
   */
  async getMessages(sessionId: string, user: UserContext, limit = 200): Promise<SessionMessage[]> {
    const owned = await this.assertSessionOwnership(sessionId, user);
    if (!owned) {
      throw new Error('دسترسی به این گفتگو مجاز نیست یا گفتگو یافت نشد.');
    }

    try {
      const rows = await db
        .select()
        .from(schema.aiChatMessages)
        .where(eq(schema.aiChatMessages.sessionId, sessionId))
        .orderBy(schema.aiChatMessages.createdAt)
        .limit(Math.min(Math.max(limit, 1), 500));

      const list = rows.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        role: r.role as 'user' | 'assistant' | 'system',
        content: r.content,
        toolsUsed: (r.toolsUsed as string[]) || undefined,
        citations: (r.citations as string[]) || undefined,
        durationMs: r.durationMs ?? undefined,
        model: r.model ?? undefined,
        createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
      }));

      const mem = this.inMemorySessions.get(sessionId);
      if (mem) mem.messages = list;

      return list;
    } catch (err: any) {
      logger.warn('[AISessionService] Database error fetching messages, using in-memory store fallback', { error: err?.message || err });
      const mem = this.inMemorySessions.get(sessionId);
      return mem?.messages || [];
    }
  }

  /**
   * Append a message to a session and touch updatedAt.
   */
  async appendMessage(
    sessionId: string,
    user: UserContext,
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      toolsUsed?: string[];
      citations?: string[];
      durationMs?: number;
      model?: string;
    }
  ): Promise<SessionMessage> {
    const owned = await this.assertSessionOwnership(sessionId, user);
    if (!owned) {
      throw new Error('دسترسی به این گفتگو مجاز نیست یا گفتگو یافت نشد.');
    }

    const id = randomUUID();
    const now = new Date();

    const newMsg: SessionMessage = {
      id,
      sessionId,
      role: message.role,
      content: message.content,
      toolsUsed: message.toolsUsed,
      citations: message.citations,
      durationMs: message.durationMs,
      model: message.model,
      createdAt: now.toISOString(),
    };

    const mem = this.inMemorySessions.get(sessionId);
    if (mem) {
      mem.messages.push(newMsg);
      mem.updatedAt = now.toISOString();
    }

    try {
      await db.insert(schema.aiChatMessages).values({
        id,
        sessionId,
        role: message.role,
        content: message.content,
        toolsUsed: message.toolsUsed || null,
        citations: message.citations || null,
        durationMs: message.durationMs ?? null,
        model: message.model ?? null,
        createdAt: now,
      });

      await db
        .update(schema.aiChatSessions)
        .set({ updatedAt: now })
        .where(eq(schema.aiChatSessions.id, sessionId));

      // Auto-title from first user message if still default
      if (message.role === 'user' && message.content.trim()) {
        try {
          const sessions = await db
            .select({ title: schema.aiChatSessions.title })
            .from(schema.aiChatSessions)
            .where(eq(schema.aiChatSessions.id, sessionId))
            .limit(1);
          const currentTitle = sessions[0]?.title || '';
          if (
            currentTitle.startsWith('مشاوره جدید') ||
            currentTitle.startsWith('مشاوره جامع') ||
            currentTitle === 'گفتگوی جدید'
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
      logger.warn('[AISessionService] Database error appending message, stored in-memory', { error: err?.message || err });
    }

    return newMsg;
  }

  /**
   * Delete a session and its messages (cascade) — ownership-checked.
   */
  async deleteSession(sessionId: string, user: UserContext): Promise<void> {
    const owned = await this.assertSessionOwnership(sessionId, user);
    if (!owned) {
      throw new Error('دسترسی به این گفتگو مجاز نیست یا گفتگو یافت نشد.');
    }
    this.inMemorySessions.delete(sessionId);
    try {
      await db.delete(schema.aiChatSessions).where(eq(schema.aiChatSessions.id, sessionId));
    } catch (err: any) {
      logger.warn('[AISessionService] Database error deleting session', { error: err?.message || err });
    }
  }

  /**
   * Optional one-time migration helper: import sessions from a client payload.
   * Only imports into the current user's account.
   */
  async importLocalSessions(
    user: UserContext,
    payload: Array<{
      title?: string;
      assistantId?: string;
      messages?: Array<{
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
    let imported = 0;
    for (const item of payload.slice(0, 30)) {
      const session = await this.createSession(user, item.title, item.assistantId || 'GENERAL_HSE');
      const msgs = Array.isArray(item.messages) ? item.messages.slice(0, 100) : [];
      for (const m of msgs) {
        if (!m.content || (m.role !== 'user' && m.role !== 'assistant')) continue;
        await this.appendMessage(session.id, user, {
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
