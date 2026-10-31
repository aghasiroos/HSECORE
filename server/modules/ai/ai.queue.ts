/**
 * HSECORE AI Priority Request Queue
 * Regulates local CPU inference tasks to prevent server overload on 8GB RAM VPS.
 */

import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';

export interface AIQueueTask<T> {
  id: string;
  userId?: string | number;
  priority: number; // Higher number = higher priority
  timestamp: number;
  timeoutMs?: number;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

export class AIRequestQueue {
  private activeCount = 0;
  private queue: AIQueueTask<any>[] = [];
  private get maxQueueLength() {
    return config.aiEngine.maxQueueLength;
  }
  private totalProcessed = 0;
  private totalErrors = 0;

  get telemetry() {
    return {
      activeRequests: this.activeCount,
      queuedRequests: this.queue.length,
      maxConcurrency: config.aiEngine.maxConcurrency || 1,
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
    };
  }

  async enqueue<T>(
    taskFn: () => Promise<T>,
    options?: { userId?: string | number; role?: string; timeoutMs?: number }
  ): Promise<{ data: T; queueWaitMs: number }> {
    const queueEntryTime = Date.now();
    const maxConcurrency = config.aiEngine.maxConcurrency || 1;
    const isHighPriority = options?.role === 'ADMIN' || options?.role === 'ADMINISTRATOR' || options?.role === 'HSE_MANAGER';
    const priority = isHighPriority ? 10 : 1;

    // Check queue capacity
    if (this.queue.length >= this.maxQueueLength) {
      throw new Error('ظرفیت صف پردازش هوش مصنوعی تکمیل است. لطفاً دقایقی دیگر مجدداً تلاش نمایید.');
    }

    // Fast-path: Execute immediately if under concurrency ceiling
    if (this.activeCount < maxConcurrency) {
      this.activeCount++;
      try {
        const result = await this.executeWithTimeout(taskFn, options?.timeoutMs);
        this.totalProcessed++;
        return { data: result, queueWaitMs: Date.now() - queueEntryTime };
      } catch (err) {
        this.totalErrors++;
        throw err;
      } finally {
        this.activeCount--;
        this.processNext();
      }
    }

    // Queue task
    return new Promise<{ data: T; queueWaitMs: number }>((resolve, reject) => {
      const task: AIQueueTask<T> = {
        id: `ai-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: options?.userId,
        priority,
        timestamp: queueEntryTime,
        timeoutMs: options?.timeoutMs,
        execute: taskFn,
        resolve: (data) => resolve({ data, queueWaitMs: Date.now() - queueEntryTime }),
        reject,
      };

      // Insert by priority descending, then timestamp ascending
      const insertIndex = this.queue.findIndex(q => q.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(task);
      } else {
        this.queue.splice(insertIndex, 0, task);
      }
    });
  }

  private async processNext() {
    const maxConcurrency = config.aiEngine.maxConcurrency || 1;
    if (this.activeCount < maxConcurrency && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (!nextTask) return;

      this.activeCount++;
      try {
        const result = await this.executeWithTimeout(nextTask.execute, nextTask.timeoutMs);
        this.totalProcessed++;
        nextTask.resolve(result);
      } catch (err) {
        this.totalErrors++;
        nextTask.reject(err);
      } finally {
        this.activeCount--;
        this.processNext();
      }
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const limit = timeoutMs || config.aiEngine.timeoutMs || 60000;
    let timer: NodeJS.Timeout | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`زمان پردازش هوش مصنوعی از حد مجاز (${limit / 1000} ثانیه) فراتر رفت.`));
      }, limit);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export const aiRequestQueue = new AIRequestQueue();
