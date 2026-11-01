/**
 * HSECORE AI Chat Session Service
 * Persistent, user-isolated chat history stored in PostgreSQL.
 * Replaces frontend localStorage storage for compliance with HSECORE security rules.
 */

import { eq, desc, and, sql } from 'drizzle-orm';
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
  /**
   * List sessions belonging to the authenticated user only.
   */
  async listSessions(user: UserContext, limit = 50): Promise<SessionSummary[]> {
    const userId = user.id != null ? Number(user.id) : null;
    const userUid = user.uid || null;

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

    const rows = await db
      .select({
        id: schema.aiChatSessions.id,
        title: schema.aiChatSessions.title,
        assistantId: schema.aiChatSessions.assistantId,
        createdAt: schema.aiChatSessions.createdAt,
        updatedAt: schema.aiChatSessions.updatedAt,
      })
      .from(schema.aiChatSessions)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(schema.aiChatSessions.updatedAt))
      .limit(Math.min(Math.max(limit, 1), 100));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      assistantId: r.assistantId || 'GENERAL_HSE',
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
      updatedAt: r.updatedAt?.toISOString?.() ?? String(r.updatedAt),
    }));
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

    await db.insert(schema.aiChatSessions).values({
      id,
      userId: user.id != null ? Number(user.id) : null,
      userUid: user.uid || null,
      title: sessionTitle,
      assistantId: assistantId || 'GENERAL_HSE',
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });

    return {
      id,
      title: sessionTitle,
      assistantId: assistantId || 'GENERAL_HSE',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }

  /**
   * Ensure the session belongs to the requesting user (fail-closed).
   */
  private async assertSessionOwnership(sessionId: string, user: UserContext): Promise<boolean> {
    const rows = await db
      .select({
        userId: schema.aiChatSessions.userId,
        userUid: schema.aiChatSessions.userUid,
      })
      .from(schema.aiChatSessions)
      .where(eq(schema.aiChatSessions.id, sessionId))
      .limit(1);

    if (!rows.length) return false;
    const row = rows[0];
    const userId = user.id != null ? Number(user.id) : null;
    const userUid = user.uid || null;

    if (userId != null && row.userId != null && Number(row.userId) === userId) return true;
    if (userUid && row.userUid && row.userUid === userUid) return true;
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

    const rows = await db
      .select()
      .from(schema.aiChatMessages)
      .where(eq(schema.aiChatMessages.sessionId, sessionId))
      .orderBy(schema.aiChatMessages.createdAt)
      .limit(Math.min(Math.max(limit, 1), 500));

    return rows.map((r) => ({
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
        }
      } catch (e) {
        logger.warn('AI session auto-title failed', e);
      }
    }

    return {
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
  }

  /**
   * Delete a session and its messages (cascade) — ownership-checked.
   */
  async deleteSession(sessionId: string, user: UserContext): Promise<void> {
    const owned = await this.assertSessionOwnership(sessionId, user);
    if (!owned) {
      throw new Error('دسترسی به این گفتگو مجاز نیست یا گفتگو یافت نشد.');
    }
    await db.delete(schema.aiChatSessions).where(eq(schema.aiChatSessions.id, sessionId));
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
