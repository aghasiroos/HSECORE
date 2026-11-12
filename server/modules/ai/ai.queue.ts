/**
 * HSECORE AI Priority Request Queue
 * Regulates local CPU inference tasks to prevent server overload on 8GB RAM VPS.
 */

import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';

export interface AIQueueTask<T> {
  id: string;
  userId?: string | number;
  sessionId?: string;
  priority: number; // Higher number = higher priority
  timestamp: number;
  timeoutMs?: number;
  queueTimer?: NodeJS.Timeout;
  execute: (remainingMs: number, touchActivity: () => void) => Promise<T>;
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
      maxConcurrency: Math.max(1, config.aiEngine.maxConcurrency || 4),
      totalProcessed: this.totalProcessed,
      totalErrors: this.totalErrors,
    };
  }

  /**
   * Immediately remove and abort any queued tasks matching sessionId or userId.
   */
  cancelTasks(filter: { sessionId?: string; userId?: string | number }): number {
    let cancelled = 0;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const task = this.queue[i];
      const matchSession = Boolean(filter.sessionId && task.sessionId === filter.sessionId);
      const matchUser = Boolean(filter.userId !== undefined && task.userId !== undefined && String(task.userId) === String(filter.userId));
      if (matchSession || matchUser) {
        if (task.queueTimer) clearTimeout(task.queueTimer);
        this.queue.splice(i, 1);
        task.reject(new DOMException('The user aborted a request.', 'AbortError'));
        cancelled++;
      }
    }
    return cancelled;
  }

  async enqueue<T>(
    taskFn: (remainingMs: number, touchActivity: () => void) => Promise<T>,
    options?: { userId?: string | number; sessionId?: string; role?: string; timeoutMs?: number; signal?: AbortSignal }
  ): Promise<{ data: T; queueWaitMs: number }> {
    const queueEntryTime = Date.now();
    const timeoutLimit = options?.timeoutMs || config.aiEngine.timeoutMs || 180000;
    const maxConcurrency = Math.max(1, config.aiEngine.maxConcurrency || 4);
    const isHighPriority = options?.role === 'ADMIN' || options?.role === 'ADMINISTRATOR' || options?.role === 'HSE_MANAGER';
    const priority = isHighPriority ? 10 : 1;
    const signal = options?.signal;

    if (signal?.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }

    // Check queue capacity
    if (this.queue.length >= this.maxQueueLength) {
      throw new Error('ظرفیت صف پردازش هوش مصنوعی تکمیل است. لطفاً دقایقی دیگر مجدداً تلاش نمایید.');
    }

    // Fast-path: Execute immediately if under concurrency ceiling
    if (this.activeCount < maxConcurrency) {
      this.activeCount++;
      try {
        const result = await this.executeWithTimeout(
          (touchActivity) => taskFn(timeoutLimit, touchActivity),
          timeoutLimit,
          signal
        );
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
      let abortHandler: (() => void) | null = null;
      const task: AIQueueTask<T> = {
        id: `ai-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: options?.userId,
        sessionId: options?.sessionId,
        priority,
        timestamp: queueEntryTime,
        timeoutMs: timeoutLimit,
        execute: taskFn,
        resolve: (data) => {
          if (abortHandler && signal) signal.removeEventListener('abort', abortHandler);
          resolve({ data, queueWaitMs: Date.now() - queueEntryTime });
        },
        reject: (err) => {
          if (abortHandler && signal) signal.removeEventListener('abort', abortHandler);
          reject(err);
        },
      };

      if (signal) {
        abortHandler = () => {
          if (task.queueTimer) clearTimeout(task.queueTimer);
          const queuedIndex = this.queue.indexOf(task);
          if (queuedIndex !== -1) {
            this.queue.splice(queuedIndex, 1);
          }
          task.reject(new DOMException('The user aborted a request.', 'AbortError'));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }

      // The request deadline includes time spent waiting in queue.
      task.queueTimer = setTimeout(() => {
        if (abortHandler && signal) signal.removeEventListener('abort', abortHandler);
        const queuedIndex = this.queue.indexOf(task);
        if (queuedIndex !== -1) {
          this.queue.splice(queuedIndex, 1);
          reject(new Error(`مهلت انتظار در صف هوش مصنوعی (${Math.round(timeoutLimit / 1000)} ثانیه) به پایان رسید.`));
        }
      }, timeoutLimit);

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
    const maxConcurrency = Math.max(1, config.aiEngine.maxConcurrency || 4);
    while (this.activeCount < maxConcurrency && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (!nextTask) return;
      if (nextTask.queueTimer) clearTimeout(nextTask.queueTimer);

      const remainingMs = (nextTask.timeoutMs || config.aiEngine.timeoutMs) - (Date.now() - nextTask.timestamp);
      if (remainingMs <= 0) {
        this.totalErrors++;
        nextTask.reject(new Error('مهلت درخواست هوش مصنوعی پیش از شروع پردازش به پایان رسید.'));
        continue;
      }

      this.activeCount++;
      void (async () => {
        try {
          const result = await this.executeWithTimeout(
            (touchActivity) => nextTask.execute(remainingMs, touchActivity),
            remainingMs
          );
          this.totalProcessed++;
          nextTask.resolve(result);
        } catch (err) {
          this.totalErrors++;
          nextTask.reject(err);
        } finally {
          this.activeCount--;
          this.processNext();
        }
      })();
    }
  }

  private async executeWithTimeout<T>(
    fn: (touchActivity: () => void) => Promise<T>,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<T> {
    const limit = timeoutMs || config.aiEngine.timeoutMs || 180000;
    let timer: NodeJS.Timeout | null = null;
    let onAbort: (() => void) | null = null;
    let rejectPromise: ((err: any) => void) | null = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        rejectPromise?.(new Error(`زمان پردازش هوش مصنوعی از حد مجاز (${Math.round(limit / 1000)} ثانیه بدون دریافت داده) فراتر رفت.`));
      }, limit);
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      rejectPromise = reject;
      if (signal?.aborted) {
        reject(new DOMException('The user aborted a request.', 'AbortError'));
        return;
      }
      if (signal) {
        onAbort = () => reject(new DOMException('The user aborted a request.', 'AbortError'));
        signal.addEventListener('abort', onAbort, { once: true });
      }
      resetTimer();
    });

    try {
      return await Promise.race([fn(resetTimer), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
      if (onAbort && signal) signal.removeEventListener('abort', onAbort);
    }
  }
}

export const aiRequestQueue = new AIRequestQueue();
