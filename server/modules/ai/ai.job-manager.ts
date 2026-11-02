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
import { localAIProvider, normalizeOllamaModelName } from './ai.local-provider.ts';
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
let enqueueReservationInProgress = false;

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

  private async reserveJobSlot(): Promise<void> {
    if (enqueueReservationInProgress) {
      throw new Error('درخواست عملیات مدل دیگری در حال ثبت است؛ لحظه‌ای بعد دوباره تلاش کنید.');
    }
    enqueueReservationInProgress = true;
    try {
      await this.assertNoActiveJob();
    } catch (error) {
      enqueueReservationInProgress = false;
      throw error;
    }
  }

  private releaseJobReservation(): void {
    enqueueReservationInProgress = false;
  }

  private async assertNoActiveJob(): Promise<void> {
    if (activeJobId) {
      throw new Error('یک عملیات مدل در حال اجرا است؛ تا پایان آن صبر کنید.');
    }

    let activeRows: Array<{ id: string; status: string; updatedAt: Date | string }> = [];
    try {
      activeRows = await db
        .select({
          id: schema.aiDeploymentJobs.id,
          status: schema.aiDeploymentJobs.status,
          updatedAt: schema.aiDeploymentJobs.updatedAt,
        })
        .from(schema.aiDeploymentJobs)
        .where(inArray(schema.aiDeploymentJobs.status, ['pending', 'running']));
    } catch (err: any) {
      logger.error('assertNoActiveJob DB check failed; refusing model mutation', { error: err?.message });
      throw new Error('امکان بررسی وضعیت عملیات قبلی مدل وجود ندارد؛ برای جلوگیری از عملیات هم‌زمان، درخواست پذیرفته نشد.');
    }

    const now = Date.now();
    for (const job of activeRows) {
      const updatedAt = job.updatedAt instanceof Date ? job.updatedAt.getTime() : new Date(job.updatedAt).getTime();
      const staleAfterMs = job.status === 'pending'
        ? 10 * 60 * 1000
        : Math.max(config.aiEngine.modelPullTimeoutMs || 30 * 60 * 1000, 60 * 1000) + 60 * 1000;

      // A running pull may legitimately take the full configured timeout.
      // Never mark it stale merely because a second request arrived.
      if (!Number.isFinite(updatedAt) || now - updatedAt <= staleAfterMs) {
        throw new Error('یک عملیات مدل در حال اجرا یا بازیابی است؛ پس از پایان آن دوباره تلاش کنید.');
      }

      await this.updateJob(job.id, {
        status: 'failed',
        errorMessage: 'عملیات پس از توقف پردازش یا پایان مهلت مجاز ناتمام ماند.',
        message: 'بازیابی امن عملیات منقضی‌شده',
      });
    }
  }

  /**
   * Enqueue model pull — returns immediately with job id; work runs in background.
   */
  async enqueuePull(modelRef: string, createdBy?: string): Promise<AIDeploymentJobView> {
    const normalized = normalizeOllamaModelName(modelRef);
    if (!normalized) {
      throw new Error('شناسه مدل نامعتبر است. از قالب model:tag یا namespace/model:tag استفاده کنید.');
    }
    await this.reserveJobSlot();

    const id = randomUUID();
    const now = new Date();
    try {
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
    } catch (error) {
      this.releaseJobReservation();
      throw error;
    }
    this.releaseJobReservation();
    setImmediate(() => {
      this.runPullJob(id, normalized).catch((err) => {
        logger.error('runPullJob unhandled', { jobId: id, error: err?.message });
      });
    });

    const job = await this.getJob(id);
    return job!;
  }

  async enqueueDelete(modelRef: string, createdBy?: string): Promise<AIDeploymentJobView> {
    const normalized = normalizeOllamaModelName(modelRef);
    if (!normalized) {
      throw new Error('شناسه مدل نامعتبر است. از قالب model:tag یا namespace/model:tag استفاده کنید.');
    }
    await this.reserveJobSlot();

    const id = randomUUID();
    const now = new Date();
    try {
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
    } catch (error) {
      this.releaseJobReservation();
      throw error;
    }
    this.releaseJobReservation();
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
        progress: 5,
        message: 'شروع دریافت مدل از موتور Ollama',
      });

      // Use one authoritative pull path for validation, API payload, timeout,
      // error handling, and installed-model inventory synchronization.
      const result = await localAIProvider.pullModel(modelRef, async (progress, status) => {
        await this.updateJob(jobId, {
          progress: Math.min(95, Math.max(5, progress)),
          message: status ? `دریافت مدل: ${status}` : 'در حال دریافت مدل از Ollama',
        });
      });
      if (!result.success) {
        await this.updateJob(jobId, {
          status: 'failed',
          progress: 100,
          message: 'دریافت مدل ناموفق بود',
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
        progress: 100,
        message: 'دریافت مدل با خطا مواجه شد',
        errorMessage: err?.message || 'خطای ناشناخته',
      });
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
