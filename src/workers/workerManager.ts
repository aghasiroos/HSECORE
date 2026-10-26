import {
  WorkerTaskRequest,
  WorkerTaskResponse,
  WorkerTaskType
} from './types';

interface PendingTask {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  onProgress?: (progress: number, message?: string) => void;
  timeoutTimer?: any;
}

class WorkerManager {
  private analyticsWorker: Worker | null = null;
  private excelWorker: Worker | null = null;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private hasWorkerSupport: boolean = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.terminateAll());
    }
  }

  private getAnalyticsWorker(): Worker | null {
    if (!this.hasWorkerSupport) return null;
    if (!this.analyticsWorker) {
      try {
        this.analyticsWorker = new Worker(
          new URL('./analytics.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.setupWorkerListeners(this.analyticsWorker);
      } catch (e) {
        console.warn('HSECORE: Failed to instantiate Analytics Web Worker, falling back to sync:', e);
        this.analyticsWorker = null;
      }
    }
    return this.analyticsWorker;
  }

  private getExcelWorker(): Worker | null {
    if (!this.hasWorkerSupport) return null;
    if (!this.excelWorker) {
      try {
        this.excelWorker = new Worker(
          new URL('./excel.worker.ts', import.meta.url),
          { type: 'module' }
        );
        this.setupWorkerListeners(this.excelWorker);
      } catch (e) {
        console.warn('HSECORE: Failed to instantiate Excel Web Worker, falling back to sync:', e);
        this.excelWorker = null;
      }
    }
    return this.excelWorker;
  }

  private setupWorkerListeners(worker: Worker) {
    worker.onmessage = (event: MessageEvent<WorkerTaskResponse>) => {
      const data = event.data;
      if (!data || !data.taskId) return;

      const task = this.pendingTasks.get(data.taskId);
      if (!task) return;

      if (data.type === 'PROGRESS') {
        if (task.onProgress) {
          task.onProgress(data.progress, data.statusMessage);
        }
      } else if (data.type === 'SUCCESS') {
        clearTimeout(task.timeoutTimer);
        this.pendingTasks.delete(data.taskId);
        task.resolve(data.result);
      } else if (data.type === 'ERROR') {
        clearTimeout(task.timeoutTimer);
        this.pendingTasks.delete(data.taskId);
        task.reject(new Error(data.error));
      }
    };

    worker.onerror = (err) => {
      console.error('HSECORE Web Worker error:', err);
      // Clean up all pending tasks
      this.pendingTasks.forEach((task, id) => {
        clearTimeout(task.timeoutTimer);
        task.reject(new Error('خطا در اجرای ورکر پردازش داده‌ها'));
      });
      this.pendingTasks.clear();
    };
  }

  /**
   * Executes a task on the appropriate Web Worker
   */
  public executeTask<T = any, R = any>(
    type: WorkerTaskType,
    payload: T,
    onProgress?: (progress: number, message?: string) => void,
    timeoutMs: number = 60000
  ): { promise: Promise<R>; cancel: () => void } {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Choose appropriate worker
    const isExcel = type.startsWith('EXCEL_');
    const worker = isExcel ? this.getExcelWorker() : this.getAnalyticsWorker();

    let cancelFn = () => {};

    const promise = new Promise<R>((resolve, reject) => {
      cancelFn = () => {
        const task = this.pendingTasks.get(taskId);
        if (task) {
          clearTimeout(task.timeoutTimer);
          this.pendingTasks.delete(taskId);
          task.reject(new Error('عملیات پردازش توسط کاربر لغو گردید.'));
        }
      };

      if (!worker) {
        // Fallback to sync or throw
        reject(new Error('Web Worker در محیط جاری در دسترس نمی‌باشد.'));
        return;
      }

      const timeoutTimer = setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error(`زمان مجاز پردازش (${timeoutMs / 1000} ثانیه) به پایان رسید.`));
        }
      }, timeoutMs);

      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        onProgress,
        timeoutTimer
      });

      const message: WorkerTaskRequest<T> = {
        taskId,
        type,
        payload,
        timestamp: Date.now()
      };

      worker.postMessage(message);
    });

    return { promise, cancel: cancelFn };
  }

  public cancelTask(taskId: string) {
    const task = this.pendingTasks.get(taskId);
    if (task) {
      clearTimeout(task.timeoutTimer);
      this.pendingTasks.delete(taskId);
      task.reject(new Error('عملیات پردازش لغو شد.'));
    }
  }

  public terminateAll() {
    this.pendingTasks.forEach(task => {
      clearTimeout(task.timeoutTimer);
      task.reject(new Error('ورکرها خاتمه یافتند.'));
    });
    this.pendingTasks.clear();

    if (this.analyticsWorker) {
      this.analyticsWorker.terminate();
      this.analyticsWorker = null;
    }
    if (this.excelWorker) {
      this.excelWorker.terminate();
      this.excelWorker = null;
    }
  }
}

export const workerManager = new WorkerManager();
