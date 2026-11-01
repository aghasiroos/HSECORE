/**
 * HSECORE Local AI Provider
 * High-performance, offline HTTP client communicating with internal Ollama engine.
 * Features:
 * - Strict concurrency locking & FIFO queue to protect 8GB VPS RAM
 * - Healthcheck & model inventory inspection
 * - Streaming & non-streaming chat completions
 * - Vector embeddings generation (BGE-M3)
 * - Zero external API dependencies
 */

import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';

export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  modified_at?: string;
}

export interface OllamaHealthStatus {
  isAvailable: boolean;
  engineUrl: string;
  version?: string;
  installedModels: OllamaModelInfo[];
  defaultChatModel: string;
  defaultEmbedModel: string;
  activeRequests: number;
  queuedRequests: number;
  latencyMs?: number;
  error?: string;
  chatModelInstalled: boolean;
  embeddingModelInstalled: boolean;
  localInferenceReady: boolean;
  cloudFallbackEnabled: boolean;
  cloudFallbackConfigured: boolean;
}

export interface LocalChatOptions {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  system?: string;
  stream?: boolean;
  timeoutMs?: number;
}

type QueueTask<T> = (remainingMs: number) => Promise<T>;

export class LocalAIProvider {
  private activeCount = 0;
  private queue: Array<{ run: () => void; reject: (err: any) => void; timer?: NodeJS.Timeout }> = [];
  private offlineUntil = 0;
  private readonly offlineCooldownMs = 60_000;
  private pullInProgress = false;

  private get baseUrl(): string {
    return config.aiEngine.url;
  }

  private normalizeModelName(name: string): string | null {
    const normalized = typeof name === 'string' ? name.trim() : '';
    if (!normalized || normalized.length > 160) return null;
    const [repository, tag, ...extra] = normalized.split(':');
    if (extra.length > 0 || !repository) return null;
    if (tag !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(tag)) return null;
    const segments = repository.split('/');
    if (segments.length > 3 || segments.some(segment =>
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(segment) || segment.includes('..')
    )) return null;
    return normalized;
  }

  /**
   * Ollama treats an omitted tag as :latest. Use the same canonical reference
   * for allowlists, inventory checks and protection of configured default models.
   */
  private canonicalModelName(name: string): string | null {
    const normalized = this.normalizeModelName(name);
    if (!normalized) return null;
    const separator = normalized.lastIndexOf(':');
    const repository = separator === -1 ? normalized : normalized.slice(0, separator);
    const tag = separator === -1 ? 'latest' : normalized.slice(separator + 1);
    return `${repository.toLowerCase()}:${tag.toLowerCase()}`;
  }

  private sameModelName(left: string, right: string): boolean {
    const canonicalLeft = this.canonicalModelName(left);
    const canonicalRight = this.canonicalModelName(right);
    return canonicalLeft !== null && canonicalLeft === canonicalRight;
  }

  private markOfflineIfNetworkError(err: any): boolean {
    const msg = String(err?.message || err || '').toLowerCase();
    const isNetErr =
      err?.name === 'AbortError' ||
      msg.includes('fetch failed') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('network') ||
      msg.includes('offline');
    if (isNetErr) {
      this.offlineUntil = Date.now() + this.offlineCooldownMs;
    }
    return isNetErr;
  }

  /**
   * Concurrency-guarded execution queue
   * Enforces maxConcurrency limit (1 on 8GB RAM VPS) to prevent OOM
   */
  private async enqueue<T>(task: QueueTask<T>, timeoutMs = config.aiEngine.timeoutMs || 180000): Promise<T> {
    if (this.pullInProgress) throw new Error('موتور محلی در حال عملیات نگهداری مدل است؛ لطفاً کمی بعد تلاش کنید.');
    const queuedAt = Date.now();
    const max = config.aiEngine.maxConcurrency || 1;
    if (this.activeCount < max) {
      this.activeCount++;
      try {
        return await task(timeoutMs);
      } finally {
        this.activeCount--;
        this.processQueue();
      }
    }

    if (this.queue.length >= config.aiEngine.maxQueueLength) {
      throw new Error('ظرفیت صف موتور محلی هوش مصنوعی تکمیل است. لطفاً پس از آزاد شدن ظرفیت دوباره تلاش کنید.');
    }

    return new Promise<T>((resolve, reject) => {
      const queuedTask: { run: () => void; reject: (err: any) => void; timer?: NodeJS.Timeout } = {
        reject,
        run: () => undefined,
      };
      queuedTask.run = async () => {
        if (queuedTask.timer) clearTimeout(queuedTask.timer);
        const remainingMs = timeoutMs - (Date.now() - queuedAt);
        if (remainingMs <= 0) {
          reject(new Error('مهلت انتظار درخواست در صف موتور محلی هوش مصنوعی به پایان رسید.'));
          this.processQueue();
          return;
        }
        this.activeCount++;
        try {
          const res = await task(remainingMs);
          resolve(res);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      queuedTask.timer = setTimeout(() => {
        const queuedIndex = this.queue.indexOf(queuedTask);
        if (queuedIndex !== -1) {
          this.queue.splice(queuedIndex, 1);
          reject(new Error('مهلت انتظار درخواست در صف موتور محلی هوش مصنوعی به پایان رسید.'));
        }
      }, timeoutMs);
      this.queue.push(queuedTask);
    });
  }

  private processQueue() {
    const max = config.aiEngine.maxConcurrency || 1;
    if (this.activeCount < max && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next.run();
      }
    }
  }

  /**
   * Healthcheck & Engine Status Check
   */
  async checkHealth(): Promise<OllamaHealthStatus> {
    const startTime = Date.now();
    const status: OllamaHealthStatus = {
      isAvailable: false,
      engineUrl: this.baseUrl,
      installedModels: [],
      defaultChatModel: config.aiEngine.defaultChatModel,
      defaultEmbedModel: config.aiEngine.defaultEmbedModel,
      activeRequests: this.activeCount,
      queuedRequests: this.queue.length,
      chatModelInstalled: false,
      embeddingModelInstalled: false,
      localInferenceReady: false,
      cloudFallbackEnabled: config.aiEngine.allowCloudFallback,
      cloudFallbackConfigured: config.aiEngine.allowCloudFallback && Boolean(config.geminiApiKey),
    };

    if (!config.aiEngine.enabled) {
      status.error = 'سرویس هوش مصنوعی محلی در پیکربندی سامانه غیرفعال است.';
      return status;
    }

    if (Date.now() < this.offlineUntil) {
      status.latencyMs = 0;
      status.error = 'موتور محلی Ollama در این محیط در دسترس نیست (استفاده از موتور داخلی HSECORE).';
      return status;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const resp = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      status.latencyMs = Date.now() - startTime;

      if (!resp.ok) {
        status.error = `پاسخ ناموفق موتور هوش مصنوعی: HTTP ${resp.status}`;
        return status;
      }

      this.offlineUntil = 0;
      const data = (await resp.json()) as { models?: OllamaModelInfo[] };
      status.isAvailable = true;
      status.installedModels = data.models || [];
      const installedNames = new Set(status.installedModels.flatMap(model =>
        [model.name, model.model].filter((name): name is string => typeof name === 'string')
      ).map(name => this.canonicalModelName(name)).filter((name): name is string => name !== null));
      status.chatModelInstalled = installedNames.has(this.canonicalModelName(config.aiEngine.defaultChatModel) || '');
      status.embeddingModelInstalled = installedNames.has(this.canonicalModelName(config.aiEngine.defaultEmbedModel) || '');
      // Engine reachability is not equivalent to inference readiness.
      status.localInferenceReady = status.chatModelInstalled;

      // Query version
      try {
        const vController = new AbortController();
        const vTimeout = setTimeout(() => vController.abort(), 2000);
        const vResp = await fetch(`${this.baseUrl}/api/version`, {
          method: 'GET',
          signal: vController.signal,
        });
        clearTimeout(vTimeout);
        if (vResp.ok) {
          const vData = (await vResp.json()) as { version?: string };
          status.version = vData.version;
        }
      } catch {}

      return status;
    } catch (err: any) {
      this.markOfflineIfNetworkError(err);
      status.latencyMs = Date.now() - startTime;
      status.error = err.name === 'AbortError' ? 'عدم پاسخگویی موتور در بازه زمانی تعیین‌شده (Timeout)' : (err.message || 'خطا در ارتباط با موتور هوش مصنوعی');
      return status;
    }
  }

  /**
   * List installed models on Local LLM Engine
   */
  async listInstalledModels(): Promise<OllamaModelInfo[]> {
    if (!config.aiEngine.enabled || Date.now() < this.offlineUntil) {
      return [];
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) return [];
      this.offlineUntil = 0;
      const data = (await resp.json()) as { models?: OllamaModelInfo[] };
      return data.models || [];
    } catch (err) {
      this.markOfflineIfNetworkError(err);
      logger.debug('[LocalAIProvider] Failed to list models', { error: String(err) });
      return [];
    }
  }

  /**
   * Request pulling/downloading a model inside the container
   */
  async pullModel(modelName: string): Promise<{ success: boolean; message: string }> {
    const normalized = this.normalizeModelName(modelName);
    if (!normalized) {
      return { success: false, message: 'شناسه مدل نامعتبر است.' };
    }
    const allowed = config.aiEngine.allowedModels.some(name => this.sameModelName(name, normalized));
    if (!allowed) {
      return { success: false, message: 'این مدل در فهرست مجاز دانلود مدل‌های HSECORE قرار ندارد.' };
    }
    if (this.pullInProgress) {
      return { success: false, message: 'در حال حاضر یک عملیات دریافت مدل در حال اجرا است.' };
    }
    if (this.activeCount > 0 || this.queue.length > 0) {
      return { success: false, message: 'برای جلوگیری از فشار حافظه، دریافت مدل هنگام اجرای درخواست‌های AI مجاز نیست.' };
    }

    this.pullInProgress = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.aiEngine.modelPullTimeoutMs);
    try {
      const resp = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalized, stream: false }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        return { success: false, message: `خطا در دریافت مدل: HTTP ${resp.status}` };
      }
      await resp.json().catch(() => null);
      this.offlineUntil = 0;
      return { success: true, message: `مدل ${normalized} با موفقیت بارگیری شد.` };
    } catch (err: any) {
      this.markOfflineIfNetworkError(err);
      return {
        success: false,
        message: err?.name === 'AbortError'
          ? 'مهلت مجاز دریافت مدل به پایان رسید.'
          : 'موتور محلی Ollama در دسترس نیست یا دریافت مدل با خطا مواجه شد.',
      };
    } finally {
      clearTimeout(timeout);
      this.pullInProgress = false;
    }
  }

  /**
   * Delete a model from local engine storage. Active/default models are protected.
   */
  async deleteModel(modelName: string): Promise<{ success: boolean; message: string }> {
    const normalized = this.normalizeModelName(modelName);
    if (!normalized) return { success: false, message: 'شناسه مدل نامعتبر است.' };

    const protectedModels = [
      config.aiEngine.defaultChatModel,
      config.aiEngine.defaultEmbedModel,
    ];
    if (protectedModels.some(name => this.sameModelName(name, normalized))) {
      return { success: false, message: 'حذف مدل پیش‌فرض گفت‌وگو یا embedding مجاز نیست.' };
    }
    if (this.pullInProgress || this.activeCount > 0 || this.queue.length > 0) {
      return { success: false, message: 'حذف مدل هنگام اجرای عملیات AI یا دریافت مدل مجاز نیست.' };
    }

    const installed = await this.listInstalledModels();
    const exists = installed.some(model =>
      [model.name, model.model].some(name => typeof name === 'string' && this.sameModelName(name, normalized))
    );
    if (!exists) return { success: false, message: 'مدل موردنظر در موتور محلی نصب نشده است.' };
    // Re-check after the inventory request, then lock inference during deletion.
    if (this.pullInProgress || this.activeCount > 0 || this.queue.length > 0) {
      return { success: false, message: 'حذف مدل در زمان اجرای درخواست AI مجاز نیست.' };
    }
    this.pullInProgress = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resp = await fetch(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: normalized }),
        signal: controller.signal,
      });
      if (!resp.ok) return { success: false, message: `خطا در حذف مدل: HTTP ${resp.status}` };
      return { success: true, message: `مدل ${normalized} با موفقیت حذف گردید.` };
    } catch (err: any) {
      this.markOfflineIfNetworkError(err);
      return { success: false, message: err?.name === 'AbortError' ? 'مهلت حذف مدل به پایان رسید.' : 'خطا در حذف مدل.' };
    } finally {
      clearTimeout(timeout);
      this.pullInProgress = false;
    }
  }

  /**
   * Chat completion via Local LLM Engine with concurrency lock
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: LocalChatOptions
  ): Promise<{ text: string; model: string; durationMs: number }> {
    if (!config.aiEngine.enabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = options?.model || config.aiEngine.defaultChatModel;
      const timeoutMs = Math.min(options?.timeoutMs || config.aiEngine.timeoutMs || 180000, remainingMs);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const payload: Record<string, any> = {
          model,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.3,
            top_p: options?.top_p ?? 0.85,
            num_predict: options?.max_tokens ?? 1024,
            num_ctx: config.aiEngine.contextTokens,
          },
        };

        const resp = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`Ollama chat error: HTTP ${resp.status} - ${errText}`);
        }

        this.offlineUntil = 0;
        const data = (await resp.json()) as { message?: { content?: string }; model?: string };
        clearTimeout(timeout);
        const text = data.message?.content?.trim() || '';

        return {
          text,
          model: data.model || model,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        clearTimeout(timeout);
        const isNet = this.markOfflineIfNetworkError(err);
        if (!isNet) {
          logger.debug('[LocalAIProvider] Chat completion non-network error', { error: err.message });
        }
        throw err;
      }
    }, options?.timeoutMs || config.aiEngine.timeoutMs || 180000);
  }

  /**
   * Generate text completion via Local LLM Engine
   */
  async generate(
    prompt: string,
    options?: LocalChatOptions
  ): Promise<{ text: string; model: string; durationMs: number }> {
    if (!config.aiEngine.enabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = options?.model || config.aiEngine.defaultChatModel;
      const timeoutMs = remainingMs;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const payload: Record<string, any> = {
          model,
          prompt,
          system: options?.system,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.3,
            top_p: options?.top_p ?? 0.85,
            num_predict: options?.max_tokens ?? 1024,
            num_ctx: config.aiEngine.contextTokens,
          },
        };

        const resp = await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`Ollama generate error: HTTP ${resp.status} - ${errText}`);
        }

        this.offlineUntil = 0;
        const data = (await resp.json()) as { response?: string; model?: string };
        clearTimeout(timeout);
        const text = data.response?.trim() || '';

        return {
          text,
          model: data.model || model,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        clearTimeout(timeout);
        const isNet = this.markOfflineIfNetworkError(err);
        if (!isNet) {
          logger.debug('[LocalAIProvider] Generate completion non-network error', { error: err.message });
        }
        throw err;
      }
    }, config.aiEngine.timeoutMs || 180000);
  }

  /**
   * Generate dense vector embedding (for BGE-M3 RAG)
   */
  async generateEmbedding(
    prompt: string,
    modelName?: string
  ): Promise<{ embedding: number[]; model: string; durationMs: number }> {
    if (!config.aiEngine.enabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = modelName || config.aiEngine.defaultEmbedModel;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), Math.min(30000, remainingMs));

      try {
        const resp = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          throw new Error(`Ollama embeddings error: HTTP ${resp.status}`);
        }

        this.offlineUntil = 0;
        const data = (await resp.json()) as { embedding?: number[] };
        clearTimeout(timeout);
        return {
          embedding: data.embedding || [],
          model,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        clearTimeout(timeout);
        this.markOfflineIfNetworkError(err);
        throw err;
      }
    }, 30000);
  }
}

export const localAIProvider = new LocalAIProvider();
