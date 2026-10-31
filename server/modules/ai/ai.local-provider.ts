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
}

export interface LocalChatOptions {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  system?: string;
  stream?: boolean;
}

type QueueTask<T> = () => Promise<T>;

export class LocalAIProvider {
  private activeCount = 0;
  private queue: Array<{ run: () => void; reject: (err: any) => void }> = [];
  private offlineUntil = 0;
  private readonly offlineCooldownMs = 60_000;

  private get baseUrl(): string {
    return config.aiEngine.url;
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
  private async enqueue<T>(task: QueueTask<T>): Promise<T> {
    const max = config.aiEngine.maxConcurrency || 1;
    if (this.activeCount < max) {
      this.activeCount++;
      try {
        return await task();
      } finally {
        this.activeCount--;
        this.processQueue();
      }
    }

    if (this.queue.length >= config.aiEngine.maxQueueLength) {
      throw new Error('ظرفیت صف موتور محلی هوش مصنوعی تکمیل است. لطفاً پس از آزاد شدن ظرفیت دوباره تلاش کنید.');
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: async () => {
          this.activeCount++;
          try {
            const res = await task();
            resolve(res);
          } catch (err) {
            reject(err);
          } finally {
            this.activeCount--;
            this.processQueue();
          }
        },
        reject,
      });
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
    try {
      const resp = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: false }),
      });
      if (!resp.ok) {
        return { success: false, message: `خطا در دریافت مدل: HTTP ${resp.status}` };
      }
      this.offlineUntil = 0;
      return { success: true, message: `مدل ${modelName} با موفقیت بارگیری شد.` };
    } catch (err: any) {
      this.markOfflineIfNetworkError(err);
      return { success: false, message: 'موتور محلی Ollama در این محیط فعال نیست؛ سامانه از موتور هوشمند داخلی استفاده می‌کند.' };
    }
  }

  /**
   * Delete a model from local engine storage
   */
  async deleteModel(modelName: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName }),
      });
      if (!resp.ok) {
        return { success: false, message: `خطا در حذف مدل: HTTP ${resp.status}` };
      }
      return { success: true, message: `مدل ${modelName} با موفقیت حذف گردید.` };
    } catch (err: any) {
      this.markOfflineIfNetworkError(err);
      return { success: false, message: err.message || 'خطا در حذف مدل' };
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

    return this.enqueue(async () => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = options?.model || config.aiEngine.defaultChatModel;
      const timeoutMs = config.aiEngine.timeoutMs || 180000;

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
    });
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

    return this.enqueue(async () => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = options?.model || config.aiEngine.defaultChatModel;
      const timeoutMs = config.aiEngine.timeoutMs || 180000;

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
    });
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

    return this.enqueue(async () => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = modelName || config.aiEngine.defaultEmbedModel;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

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
    });
  }
}

export const localAIProvider = new LocalAIProvider();
