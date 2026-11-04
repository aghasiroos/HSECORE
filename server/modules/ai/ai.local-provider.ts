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
import { AIMemoryEstimator, type SystemMemoryMetrics } from './ai.memory-estimator.ts';

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
  loadedModels?: Array<{ name: string; size: number; size_vram?: number }>;
  memoryMetrics?: SystemMemoryMetrics;
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
}

export interface LocalChatOptions {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  system?: string;
  stream?: boolean;
  timeoutMs?: number;
  num_ctx?: number;
  contextTokens?: number;
}

type QueueTask<T> = (remainingMs: number) => Promise<T>;

/** Validate an Ollama model reference without restricting it to a curated allowlist. */
export function normalizeOllamaModelName(name: unknown): string | null {
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

export class LocalAIProvider {
  private activeCount = 0;
  private queue: Array<{ run: () => void; reject: (err: any) => void; timer?: NodeJS.Timeout }> = [];
  private offlineUntil = 0;
  private readonly offlineCooldownMs = 5_000;
  private pullInProgress = false;
  private activeUrl: string | null = null;
  private runtimeEngineReachable = false;

  get isEngineEnabled(): boolean {
    return config.aiEngine.enabled || this.runtimeEngineReachable;
  }

  get isReachable(): boolean {
    return this.runtimeEngineReachable;
  }

  private get baseUrl(): string {
    return this.activeUrl || config.aiEngine.url;
  }

  private requireModel(requested: string | undefined, kind: 'chat' | 'embedding'): string {
    const model = (requested || (kind === 'chat' ? config.aiEngine.defaultChatModel : config.aiEngine.defaultEmbedModel) || '').trim();
    if (!model) {
      throw new Error(kind === 'chat'
        ? 'هیچ مدل گفتگویی انتخاب نشده است؛ ابتدا یک مدل را از مدیریت مدل‌های هوش مصنوعی انتخاب کنید.'
        : 'هیچ مدل embedding انتخاب نشده است؛ برای استفاده از RAG ابتدا یک مدل embedding انتخاب کنید.');
    }
    return model;
  }

  private getCandidateUrls(): string[] {
    const urls = [config.aiEngine.url];
    if (config.aiEngine.url.includes(':11434')) {
      if (config.aiEngine.url.includes('hse-ai-engine')) {
        urls.push(
          'http://127.0.0.1:11434',
          'http://localhost:11434',
          'http://host.docker.internal:11434',
          'http://172.17.0.1:11434'
        );
      } else if (config.aiEngine.url.includes('127.0.0.1') || config.aiEngine.url.includes('localhost')) {
        urls.push(
          'http://hse-ai-engine:11434',
          'http://host.docker.internal:11434',
          'http://172.17.0.1:11434'
        );
      }
    }
    return [...new Set(urls.map(u => u.trim().replace(/\/$/, '')))];
  }

  private async ensureRuntimeReachable(): Promise<void> {
    if (!this.isEngineEnabled && Date.now() >= this.offlineUntil) {
      await this.checkHealth().catch(() => null);
    }
  }

  private normalizeModelName(name: string): string | null {
    return normalizeOllamaModelName(name);
  }

  /**
   * Ollama treats an omitted tag as :latest. Use the same canonical reference
   * for inventory checks and protection of configured default models.
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
    };

    if (Date.now() < this.offlineUntil) {
      status.latencyMs = 0;
      status.error = 'موتور محلی Ollama در این محیط در دسترس نیست.';
      return status;
    }

    const candidateUrls = this.getCandidateUrls();
    let lastError: any = null;

    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        const resp = await fetch(`${targetUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (resp.ok) {
          status.latencyMs = Date.now() - startTime;
          this.offlineUntil = 0;
          this.activeUrl = targetUrl;
          this.runtimeEngineReachable = true;

          const data = (await resp.json()) as { models?: OllamaModelInfo[] };
          status.isAvailable = true;
          status.engineUrl = targetUrl;
          status.installedModels = data.models || [];
          const installedNames = new Set(status.installedModels.flatMap(model =>
            [model.name, model.model].filter((name): name is string => typeof name === 'string')
          ).map(name => this.canonicalModelName(name)).filter((name): name is string => name !== null));
          const configuredChatCanonical = this.canonicalModelName(config.aiEngine.defaultChatModel);
          const configuredEmbedCanonical = this.canonicalModelName(config.aiEngine.defaultEmbedModel);
          const firstGenerativeModel = status.installedModels.find(model => {
            const family = String(model?.details?.family || '').toLowerCase();
            const name = String(model?.name || model?.model || '');
            return Boolean(name) && family !== 'bert' && !/embed|embedding|bge-m3|nomic-embed|mxbai-embed/i.test(name);
          });
          const firstEmbeddingModel = status.installedModels.find(model => {
            const family = String(model?.details?.family || '').toLowerCase();
            const name = String(model?.name || model?.model || '');
            return Boolean(name) && (family === 'bert' || /embed|embedding|bge-m3|nomic-embed|mxbai-embed/i.test(name));
          });
          status.chatModelInstalled = configuredChatCanonical
            ? installedNames.has(configuredChatCanonical)
            : Boolean(firstGenerativeModel);
          status.embeddingModelInstalled = configuredEmbedCanonical
            ? installedNames.has(configuredEmbedCanonical)
            : Boolean(firstEmbeddingModel);
          if (!status.defaultChatModel && firstGenerativeModel) {
            status.defaultChatModel = firstGenerativeModel.name || firstGenerativeModel.model;
          }
          if (!status.defaultEmbedModel && firstEmbeddingModel) {
            status.defaultEmbedModel = firstEmbeddingModel.name || firstEmbeddingModel.model;
          }
          status.localInferenceReady = status.chatModelInstalled;

          // Query version
          try {
            const vController = new AbortController();
            const vTimeout = setTimeout(() => vController.abort(), 2000);
            const vResp = await fetch(`${targetUrl}/api/version`, {
              method: 'GET',
              signal: vController.signal,
            });
            clearTimeout(vTimeout);
            if (vResp.ok) {
              const vData = (await vResp.json()) as { version?: string };
              status.version = vData.version;
            }
          } catch {}

          // Query resident loaded models in RAM
          try {
            const psResp = await fetch(`${targetUrl}/api/ps`, {
              method: 'GET',
              signal: AbortSignal.timeout(2000),
            });
            if (psResp.ok) {
              const psData = (await psResp.json()) as { models?: any[] };
              status.loadedModels = psData?.models || [];
            }
          } catch {}

          status.memoryMetrics = AIMemoryEstimator.getSystemMemoryMetrics();
          return status;
        } else {
          lastError = new Error(`پاسخ ناموفق موتور هوش مصنوعی: HTTP ${resp.status}`);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    this.runtimeEngineReachable = false;
    if (config.aiEngine.enabled) {
      this.markOfflineIfNetworkError(lastError);
    }
    status.latencyMs = Date.now() - startTime;
    if (!config.aiEngine.enabled) {
      status.error = 'سرویس هوش مصنوعی محلی در پیکربندی سامانه غیرفعال است.';
    } else {
      status.error = lastError?.name === 'AbortError'
        ? 'عدم پاسخگویی موتور در بازه زمانی تعیین‌شده (Timeout)'
        : (lastError?.message || 'خطا در ارتباط با موتور هوش مصنوعی');
    }
    return status;
  }

  /**
   * List installed models on Local LLM Engine
   */
  async listInstalledModels(): Promise<OllamaModelInfo[]> {
    if (Date.now() < this.offlineUntil) {
      return [];
    }
    const candidateUrls = this.getCandidateUrls();
    for (const targetUrl of candidateUrls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`${targetUrl}/api/tags`, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          this.offlineUntil = 0;
          this.activeUrl = targetUrl;
          this.runtimeEngineReachable = true;
          const data = (await resp.json()) as { models?: OllamaModelInfo[] };
          return data.models || [];
        }
      } catch (err) {
        // Try next candidate URL
      }
    }
    if (config.aiEngine.enabled) {
      logger.debug('[LocalAIProvider] Failed to list models from all candidate URLs');
    }
    return [];
  }

  /**
   * List currently resident models loaded in RAM
   */
  async getLoadedModels(): Promise<Array<{ name: string; size: number; size_vram?: number }>> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/ps`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return [];
      const data = await resp.json() as { models?: Array<{ name: string; size: number; size_vram?: number }> };
      return data?.models || [];
    } catch {
      return [];
    }
  }

  /**
   * Unload resident models from RAM (keep_alive: 0) to free memory instantly
   */
  async unloadModel(modelName?: string): Promise<boolean> {
    try {
      if (modelName) {
        const normalized = this.normalizeModelName(modelName);
        if (!normalized) return false;
        await fetch(`${this.baseUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: normalized, keep_alive: 0 }),
          signal: AbortSignal.timeout(5000),
        });
        return true;
      }

      // Unload all active resident models
      const loaded = await this.getLoadedModels();
      for (const m of loaded) {
        if (m.name) {
          await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: m.name, keep_alive: 0 }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => null);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Intelligently manages loaded model residency in RAM.
   * Allows multiple models to remain resident in RAM up to maxLoadedModels (default 3)
   * so multiple concurrent users and models respond instantly without reload thrashing.
   * Evicts unneeded models only when exceeding capacity or when system memory is low.
   */
  async evictOtherLoadedModels(targetModel: string): Promise<void> {
    try {
      const loaded = await this.getLoadedModels();
      const targetAlreadyLoaded = loaded.some(m => m.name && this.sameModelName(m.name, targetModel));
      const maxAllowedLoaded = (config.aiEngine as any).maxLoadedModels || 3;

      if (targetAlreadyLoaded && loaded.length <= maxAllowedLoaded) {
        return;
      }

      let memoryCritical = false;
      try {
        const metrics = AIMemoryEstimator.getSystemMemoryMetrics();
        if (metrics.availableHostRamMB < 600 || metrics.freeHostRamMB < 400) {
          memoryCritical = true;
        }
      } catch {
        // ignore metric lookup failure
      }

      if (!memoryCritical && loaded.length < maxAllowedLoaded) {
        return;
      }

      for (const m of loaded) {
        if (m.name && !this.sameModelName(m.name, targetModel)) {
          logger.info(`[LocalAIProvider] Freeing resident model ${m.name} from RAM to accommodate ${targetModel}`);
          await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: m.name, keep_alive: 0 }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => null);

          if (!memoryCritical && loaded.length - 1 < maxAllowedLoaded) {
            break;
          }
        }
      }
    } catch {
      // best-effort eviction
    }
  }

  /**
   * Request pulling/downloading a model inside the container
   */
  async pullModel(
    modelName: string,
    onProgress?: (progress: number, message: string) => void | Promise<void>
  ): Promise<{ success: boolean; message: string }> {
    const normalized = this.normalizeModelName(modelName);
    if (!normalized) {
      return { success: false, message: 'شناسه مدل نامعتبر است.' };
    }
    if (this.pullInProgress) {
      return { success: false, message: 'در حال حاضر یک عملیات دریافت مدل در حال اجرا است.' };
    }
    if (this.activeCount > 0 || this.queue.length > 0) {
      return { success: false, message: 'برای جلوگیری از فشار حافظه، دریافت مدل هنگام اجرای درخواست‌های AI مجاز نیست.' };
    }

    await this.ensureRuntimeReachable();
    this.pullInProgress = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.aiEngine.modelPullTimeoutMs);
    try {
      const resp = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Ollama streams manifest and layer download progress as NDJSON events.
        body: JSON.stringify({ model: normalized, stream: true }),
        signal: controller.signal,
      });

      const reportEvent = async (event: any): Promise<void> => {
        if (event?.error) throw new Error(String(event.error));
        const status = typeof event?.status === 'string' ? event.status : 'در حال دریافت مدل';
        let progress = 5;
        const total = Number(event?.total);
        const completed = Number(event?.completed);
        if (Number.isFinite(total) && total > 0 && Number.isFinite(completed) && completed >= 0) {
          progress = Math.min(95, Math.max(5, 5 + Math.floor((completed / total) * 90)));
        }
        if (status.toLowerCase() === 'success') progress = 100;
        await onProgress?.(progress, status);
      };

      let finalStatus = '';
      let apiError = '';
      const contentType = resp.headers.get('content-type') || '';
      if (resp.body && (contentType.includes('ndjson') || contentType.includes('json'))) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (typeof event?.status === 'string') finalStatus = event.status;
            if (typeof event?.error === 'string') apiError = event.error;
            await reportEvent(event);
          }
          if (done) break;
        }
        if (buffer.trim()) {
          const event = JSON.parse(buffer);
          if (typeof event?.status === 'string') finalStatus = event.status;
          if (typeof event?.error === 'string') apiError = event.error;
          await reportEvent(event);
        }
      } else {
        const payload = await resp.json().catch(() => null) as { error?: string; status?: string } | null;
        if (payload?.status) finalStatus = payload.status;
        if (payload?.error) apiError = payload.error;
        await reportEvent(payload);
      }

      if (!resp.ok || apiError) {
        return { success: false, message: `خطا در دریافت مدل ${normalized}: ${apiError || `HTTP ${resp.status}`}` };
      }
      if (finalStatus !== 'success') {
        return { success: false, message: `دریافت مدل ${normalized} کامل نشد: ${finalStatus || 'پاسخ نهایی معتبر از Ollama دریافت نشد.'}` };
      }
      this.offlineUntil = 0;
      return { success: true, message: `مدل ${normalized} با موفقیت بارگیری شد.` };
    } catch (err: any) {
      this.markOfflineIfNetworkError(err);
      return {
        success: false,
        message: err?.name === 'AbortError'
          ? 'مهلت مجاز دریافت مدل به پایان رسید.'
          : (err?.message || 'موتور محلی Ollama در دسترس نیست یا دریافت مدل با خطا مواجه شد.'),
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
        body: JSON.stringify({ model: normalized }),
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
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = this.requireModel(options?.model, 'chat');
      const timeoutMs = Math.min(options?.timeoutMs || config.aiEngine.timeoutMs || 180000, remainingMs);

      // Evict any other loaded models from RAM to prevent concurrent model residency OOM
      await this.evictOtherLoadedModels(model);

      // Auto-tune num_ctx for safety
      const requestedCtx = options?.num_ctx || options?.contextTokens || config.aiEngine.contextTokens;
      const safeCtx = AIMemoryEstimator.getSafeContextTokens(model, requestedCtx);

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
            num_ctx: safeCtx,
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
          if (resp.status === 502 || resp.status === 503) {
            AIMemoryEstimator.recordOomEvent();
          }
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
        if (err?.message?.includes('ECONNRESET') || err?.code === 'ECONNRESET') {
          AIMemoryEstimator.recordOomEvent();
        }
        const isNet = this.markOfflineIfNetworkError(err);
        if (!isNet) {
          logger.debug('[LocalAIProvider] Chat completion non-network error', { error: err.message });
        }
        throw err;
      }
    }, options?.timeoutMs || config.aiEngine.timeoutMs || 180000);
  }

  /**
   * Stream chat tokens from Ollama while holding the same bounded inference slot.
   */
  async chatStream(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: LocalChatOptions,
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<{ text: string; model: string; durationMs: number }> {
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      const startedAt = Date.now();
      const model = this.requireModel(options.model, 'chat');

      // Evict any other loaded models from RAM to prevent concurrent model residency OOM
      await this.evictOtherLoadedModels(model);

      // Auto-tune num_ctx for safety
      const requestedCtx = options.num_ctx || options.contextTokens || config.aiEngine.contextTokens;
      const safeCtx = AIMemoryEstimator.getSafeContextTokens(model, requestedCtx);

      const controller = new AbortController();
      let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      const abortFromCaller = () => {
        controller.abort();
        try { activeReader?.cancel().catch(() => null); } catch {}
      };
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', abortFromCaller, { once: true });
      const timeout = setTimeout(() => controller.abort(), Math.min(options.timeoutMs || remainingMs, remainingMs));

      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            options: {
              temperature: options.temperature ?? 0.4,
              top_p: options.top_p ?? 0.85,
              num_predict: options.max_tokens ?? 1024,
              num_ctx: safeCtx,
            },
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => '');
          throw new Error(`Ollama streaming error: HTTP ${response.status} ${detail}`);
        }

        this.offlineUntil = 0;
        const reader = response.body.getReader();
        activeReader = reader;
        const decoder = new TextDecoder();
        let pending = '';
        let fullText = '';
        let returnedModel = model;
        while (true) {
          if (signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
          }
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() || '';
          for (const line of lines) {
            if (!line.trim()) continue;
            const chunk = JSON.parse(line);
            if (chunk.error) throw new Error(String(chunk.error));
            if (chunk.model) returnedModel = chunk.model;
            const token = chunk.message?.content || '';
            if (token) {
              fullText += token;
              onToken(token);
            }
          }
        }
        pending += decoder.decode();
        if (pending.trim()) {
          const chunk = JSON.parse(pending);
          if (chunk.error) throw new Error(String(chunk.error));
          if (chunk.model) returnedModel = chunk.model;
          const token = chunk.message?.content || '';
          if (token) { fullText += token; onToken(token); }
        }
        return { text: fullText.trim(), model: returnedModel, durationMs: Date.now() - startedAt };
      } catch (error: any) {
        // A client-requested stop (or disconnected client) is not an Ollama outage.
        // Do not poison the provider's offline cooldown for an intentional cancellation.
        const callerCancelled = signal?.aborted === true;
        const isNetworkError = callerCancelled ? false : this.markOfflineIfNetworkError(error);
        if (!callerCancelled && !isNetworkError) {
          logger.debug('[LocalAIProvider] Streaming chat failed', { error: String(error?.message || error) });
        }
        throw error;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromCaller);
        try { activeReader?.releaseLock(); } catch {}
      }
    }, options.timeoutMs || config.aiEngine.timeoutMs || 180000);
  }

  /**
   * Generate text completion via Local LLM Engine
   */
  async generate(
    prompt: string,
    options?: LocalChatOptions
  ): Promise<{ text: string; model: string; durationMs: number }> {
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
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
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = this.requireModel(modelName, 'embedding');
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
