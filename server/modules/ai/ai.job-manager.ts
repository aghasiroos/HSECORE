/**
 * AI Deployment Job Manager (Phase 3c)
 * Tracks long-running provider operations (model pull/delete) in PostgreSQL
 * with recoverable status after process restart.
 */

import { randomUUID } from 'crypto';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';
import { localAIProvider } from './ai.local-provider.ts';
import { aiModelManager } from './ai.model-manager.ts';

export type AIJobType = 'pull' | 'delete';
export type AIJobStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface AIDeploymentJobView {
  id: string;
  jobType: AIJobType;
  providerId: string | null;
  targetRef: string | null;
  status: AIJobStatus;
  progress: number;
  message: string | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Only one mutating model job at a time on 8GB hosts */
let activeJobId: string | null = null;

function toView(row: any): AIDeploymentJobView {
  return {
    id: row.id,
    jobType: row.jobType as AIJobType,
    providerId: row.providerId,
    targetRef: row.targetRef,
    status: row.status as AIJobStatus,
    progress: row.progress ?? 0,
    message: row.message,
    errorMessage: row.errorMessage,
    createdBy: row.createdBy,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt),
  };
}

export class AIJobManager {
  async listJobs(limit = 30): Promise<AIDeploymentJobView[]> {
    const rows = await db
      .select()
      .from(schema.aiDeploymentJobs)
      .orderBy(desc(schema.aiDeploymentJobs.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map(toView);
  }

  async getJob(jobId: string): Promise<AIDeploymentJobView | null> {
    const rows = await db
      .select()
      .from(schema.aiDeploymentJobs)
      .where(eq(schema.aiDeploymentJobs.id, jobId))
      .limit(1);
    return rows[0] ? toView(rows[0]) : null;
  }

  private async updateJob(
    jobId: string,
    patch: Partial<{
      status: AIJobStatus;
      progress: number;
      message: string | null;
      errorMessage: string | null;
    }>
  ): Promise<void> {
    await db
      .update(schema.aiDeploymentJobs)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiDeploymentJobs.id, jobId));
  }

  private async assertNoActiveJob(): Promise<void> {
    if (activeJobId) {
      throw new Error('یک عملیات مدل در حال اجرا است؛ تا پایان آن صبر کنید.');
    }
    try {
      const running = await db
        .select({ id: schema.aiDeploymentJobs.id })
        .from(schema.aiDeploymentJobs)
        .where(inArray(schema.aiDeploymentJobs.status, ['pending', 'running']))
        .limit(1);
      if (running.length) {
        // Stale recovery: if process restarted, mark old running as failed
        const job = running[0];
        await this.updateJob(job.id, {
          status: 'failed',
          errorMessage: 'عملیات پس از راه‌اندازی مجدد سرور ناتمام ماند.',
          message: 'بازیابی پس از restart',
        });
      }
    } catch (err: any) {
      logger.warn('assertNoActiveJob DB check failed', { error: err?.message });
    }
  }

  /**
   * Enqueue model pull — returns immediately with job id; work runs in background.
   */
  async enqueuePull(modelRef: string, createdBy?: string): Promise<AIDeploymentJobView> {
    const normalized = (modelRef || '').trim();
    if (!normalized || normalized.length > 160) {
      throw new Error('شناسه مدل نامعتبر است.');
    }
    await this.assertNoActiveJob();

    const id = randomUUID();
    const now = new Date();
    await db.insert(schema.aiDeploymentJobs).values({
      id,
      jobType: 'pull',
      providerId: 'ollama',
      targetRef: normalized,
      status: 'pending',
      progress: 0,
      message: 'در صف دریافت مدل',
      errorMessage: null,
      createdBy: createdBy || null,
      createdAt: now,
      updatedAt: now,
    });

    activeJobId = id;
    setImmediate(() => {
      this.runPullJob(id, normalized).catch((err) => {
        logger.error('runPullJob unhandled', { jobId: id, error: err?.message });
      });
    });

    const job = await this.getJob(id);
    return job!;
  }

  async enqueueDelete(modelRef: string, createdBy?: string): Promise<AIDeploymentJobView> {
    const normalized = (modelRef || '').trim();
    if (!normalized || normalized.length > 160) {
      throw new Error('شناسه مدل نامعتبر است.');
    }
    await this.assertNoActiveJob();

    const id = randomUUID();
    const now = new Date();
    await db.insert(schema.aiDeploymentJobs).values({
      id,
      jobType: 'delete',
      providerId: 'ollama',
      targetRef: normalized,
      status: 'pending',
      progress: 0,
      message: 'در صف حذف مدل',
      errorMessage: null,
      createdBy: createdBy || null,
      createdAt: now,
      updatedAt: now,
    });

    activeJobId = id;
    setImmediate(() => {
      this.runDeleteJob(id, normalized).catch((err) => {
        logger.error('runDeleteJob unhandled', { jobId: id, error: err?.message });
      });
    });

    const job = await this.getJob(id);
    return job!;
  }

  private async runPullJob(jobId: string, modelRef: string): Promise<void> {
    try {
      await this.updateJob(jobId, {
        status: 'running',
        progress: 1,
        message: 'شروع دریافت مدل از موتور Ollama',
      });

      const baseUrl = config.aiEngine.url;
      const timeoutMs = config.aiEngine.modelPullTimeoutMs || 30 * 60 * 1000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetch(`${baseUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelRef, stream: true }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          const errText = resp.ok ? '' : await resp.text().catch(() => '');
          throw new Error(`HTTP ${resp.status} ${errText}`.trim());
        }

        // Prefer LocalAIProvider allowlist by also calling through it when stream fails
        const reader = (resp.body as any).getReader?.();
        if (!reader) {
          // Fallback: non-stream pull via existing provider
          clearTimeout(timer);
          const result = await localAIProvider.pullModel(modelRef);
          if (!result.success) throw new Error(result.message);
          await this.updateJob(jobId, {
            status: 'success',
            progress: 100,
            message: result.message,
            errorMessage: null,
          });
          await aiModelManager.syncInstalledModelsFromProvider('ollama').catch(() => 0);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let lastProgress = 1;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const evt = JSON.parse(trimmed);
              if (evt.error) {
                throw new Error(String(evt.error));
              }
              // Ollama stream: status, completed, total
              let progress = lastProgress;
              if (typeof evt.completed === 'number' && typeof evt.total === 'number' && evt.total > 0) {
                progress = Math.min(99, Math.max(1, Math.floor((evt.completed / evt.total) * 100)));
              } else if (evt.status === 'success') {
                progress = 100;
              } else if (typeof evt.status === 'string') {
                // incremental nudge while downloading layers
                progress = Math.min(95, lastProgress + 1);
              }
              if (progress !== lastProgress) {
                lastProgress = progress;
                await this.updateJob(jobId, {
                  status: 'running',
                  progress,
                  message: typeof evt.status === 'string' ? evt.status : 'در حال دریافت',
                });
              }
            } catch (parseErr: any) {
              if (parseErr?.message && String(parseErr.message).includes('HTTP')) throw parseErr;
              // ignore partial JSON lines
            }
          }
        }

        clearTimeout(timer);
        await this.updateJob(jobId, {
          status: 'success',
          progress: 100,
          message: `مدل ${modelRef} با موفقیت بارگیری شد.`,
          errorMessage: null,
        });
        await aiModelManager.syncInstalledModelsFromProvider('ollama').catch(() => 0);
      } catch (err: any) {
        clearTimeout(timer);
        // Fallback to non-stream provider pull once
        if (err?.name !== 'AbortError') {
          const result = await localAIProvider.pullModel(modelRef);
          if (result.success) {
            await this.updateJob(jobId, {
              status: 'success',
              progress: 100,
              message: result.message,
              errorMessage: null,
            });
            await aiModelManager.syncInstalledModelsFromProvider('ollama').catch(() => 0);
            return;
          }
          await this.updateJob(jobId, {
            status: 'failed',
            message: 'دریافت مدل ناموفق بود',
            errorMessage: result.message || err?.message || 'خطای ناشناخته',
          });
          return;
        }
        await this.updateJob(jobId, {
          status: 'failed',
          message: 'دریافت مدل ناموفق بود',
          errorMessage:
            err?.name === 'AbortError'
              ? 'مهلت مجاز دریافت مدل به پایان رسید.'
              : err?.message || 'خطای ناشناخته',
        });
      }
    } finally {
      if (activeJobId === jobId) activeJobId = null;
    }
  }

  private async runDeleteJob(jobId: string, modelRef: string): Promise<void> {
    try {
      await this.updateJob(jobId, {
        status: 'running',
        progress: 10,
        message: 'در حال حذف مدل',
      });
      const result = await localAIProvider.deleteModel(modelRef);
      if (!result.success) {
        await this.updateJob(jobId, {
          status: 'failed',
          progress: 100,
          message: 'حذف مدل ناموفق بود',
          errorMessage: result.message,
        });
        return;
      }
      await this.updateJob(jobId, {
        status: 'success',
        progress: 100,
        message: result.message,
        errorMessage: null,
      });
      await aiModelManager.syncInstalledModelsFromProvider('ollama').catch(() => 0);
    } catch (err: any) {
      await this.updateJob(jobId, {
        status: 'failed',
        message: 'حذف مدل با خطا مواجه شد',
        errorMessage: err?.message || 'خطای ناشناخته',
      });
    } finally {
      if (activeJobId === jobId) activeJobId = null;
    }
  }
}

export const aiJobManager = new AIJobManager();
