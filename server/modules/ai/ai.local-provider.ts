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
  onActivity?: () => void;
  skipQueue?: boolean;
}

export interface LocalChatResult {
  text: string;
  model: string;
  durationMs: number;
  completed?: boolean;
  doneReason?: string;
  incompleteReason?: string;
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
  private queue: Array<{ run: () => void; reject: (err: any) => void; timer?: NodeJS.Timeout; abortCleanup?: () => void }> = [];
  private offlineUntil = 0;
  private readonly offlineCooldownMs = 5_000;
  private pullInProgress = false;
  private activeUrl: string | null = null;
  private runtimeEngineReachable = false;
  private cachedInstalledModels: { data: OllamaModelInfo[]; expiresAt: number } | null = null;
  private cachedLoadedModels: { data: Array<{ name: string; size: number; size_vram?: number }>; expiresAt: number } | null = null;
  private lastActiveChatModel: string | null = null;
  private warmUpInFlight = false;

  constructor(customBaseUrl?: string) {
    if (customBaseUrl && customBaseUrl.trim()) {
      this.activeUrl = customBaseUrl.trim().replace(/\/$/, '');
      this.runtimeEngineReachable = true;
    }
  }

  private invalidateModelCaches(): void {
    this.cachedInstalledModels = null;
    this.cachedLoadedModels = null;
    this.lastActiveChatModel = null;
  }

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
    const urls = [...(this.activeUrl ? [this.activeUrl] : []), config.aiEngine.url];
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
    if (err?.name === 'AbortError') {
      return false;
    }
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('aborted')) {
      return false;
    }
    const isNetErr =
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
   * Concurrency-guarded execution queue with full AbortSignal cancellation support
   */
  private async enqueue<T>(
    task: QueueTask<T>,
    timeoutMs = config.aiEngine.timeoutMs || 180000,
    signal?: AbortSignal
  ): Promise<T> {
    if (signal?.aborted) {
      throw new DOMException('The user aborted a request.', 'AbortError');
    }
    if (this.pullInProgress) throw new Error('موتور محلی در حال عملیات نگهداری مدل است؛ لطفاً کمی بعد تلاش کنید.');
    const queuedAt = Date.now();
    const max = Math.max(1, config.aiEngine.maxConcurrency || 4);
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
      const queuedTask: { run: () => void; reject: (err: any) => void; timer?: NodeJS.Timeout; abortCleanup?: () => void } = {
        reject,
        run: () => undefined,
      };

      if (signal) {
        const onAbort = () => {
          if (queuedTask.timer) clearTimeout(queuedTask.timer);
          const idx = this.queue.indexOf(queuedTask);
          if (idx !== -1) {
            this.queue.splice(idx, 1);
          }
          reject(new DOMException('The user aborted a request.', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        queuedTask.abortCleanup = () => signal.removeEventListener('abort', onAbort);
      }

      queuedTask.run = async () => {
        if (queuedTask.timer) clearTimeout(queuedTask.timer);
        queuedTask.abortCleanup?.();
        if (signal?.aborted) {
          reject(new DOMException('The user aborted a request.', 'AbortError'));
          this.processQueue();
          return;
        }
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
        queuedTask.abortCleanup?.();
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
    const max = Math.max(1, config.aiEngine.maxConcurrency || 4);
    while (this.activeCount < max && this.queue.length > 0) {
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
          this.cachedInstalledModels = { data: status.installedModels, expiresAt: Date.now() + 60000 };
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

          // Query version and resident loaded models in parallel
          await Promise.all([
            (async () => {
              try {
                const vResp = await fetch(`${targetUrl}/api/version`, {
                  method: 'GET',
                  signal: AbortSignal.timeout(1800),
                });
                if (vResp.ok) {
                  const vData = (await vResp.json()) as { version?: string };
                  status.version = vData.version;
                }
              } catch {}
            })(),
            (async () => {
              try {
                const psResp = await fetch(`${targetUrl}/api/ps`, {
                  method: 'GET',
                  signal: AbortSignal.timeout(1800),
                });
                if (psResp.ok) {
                  const psData = (await psResp.json()) as { models?: any[] };
                  status.loadedModels = psData?.models || [];
                  this.cachedLoadedModels = { data: status.loadedModels, expiresAt: Date.now() + 15000 };
                }
              } catch {}
            })(),
          ]);

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
   * List installed models on Local LLM Engine (cached briefly to avoid serial HTTP overhead per chat request)
   */
  async listInstalledModels(forceRefresh = false): Promise<OllamaModelInfo[]> {
    if (Date.now() < this.offlineUntil) {
      return [];
    }
    if (!forceRefresh && this.cachedInstalledModels && Date.now() < this.cachedInstalledModels.expiresAt) {
      return this.cachedInstalledModels.data;
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
          const models = data.models || [];
          this.cachedInstalledModels = { data: models, expiresAt: Date.now() + 60000 };
          return models;
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
   * List currently resident models loaded in RAM (cached briefly to avoid repeated /api/ps round-trips)
   */
  async getLoadedModels(forceRefresh = false): Promise<Array<{ name: string; size: number; size_vram?: number }>> {
    if (!forceRefresh && this.cachedLoadedModels && Date.now() < this.cachedLoadedModels.expiresAt) {
      return this.cachedLoadedModels.data;
    }
    try {
      const resp = await fetch(`${this.baseUrl}/api/ps`, {
        method: 'GET',
        signal: AbortSignal.timeout(2500),
      });
      if (!resp.ok) return [];
      const data = await resp.json() as { models?: Array<{ name: string; size: number; size_vram?: number }> };
      const models = data?.models || [];
      this.cachedLoadedModels = { data: models, expiresAt: Date.now() + 15000 };
      return models;
    } catch {
      return [];
    }
  }

  /**
   * Non-blocking background warm-up so the chat model is already resident in RAM before user sends a message.
   */
  warmUpModel(preferredModel?: string): void {
    if (this.warmUpInFlight || this.activeCount > 0 || this.pullInProgress || Date.now() < this.offlineUntil) {
      return;
    }
    if (this.lastActiveChatModel && (!preferredModel || this.sameModelName(this.lastActiveChatModel, preferredModel))) {
      return;
    }
    this.warmUpInFlight = true;
    void (async () => {
      try {
        const [installed, loaded] = await Promise.all([
          this.listInstalledModels(),
          this.getLoadedModels(),
        ]);
        if (this.activeCount > 0 || this.pullInProgress || installed.length === 0) return;
        const generative = installed.filter(m => {
          const family = String(m?.details?.family || '').toLowerCase();
          const name = String(m?.name || m?.model || '');
          return Boolean(name) && family !== 'bert' && !/embed|embedding|bge-m3|nomic-embed|mxbai-embed/i.test(name);
        });
        if (generative.length === 0) return;

        // If any generative model is already loaded in RAM, record it and skip warm-up
        const alreadyLoadedGen = loaded.find(l =>
          l.name && generative.some(g => this.sameModelName(g.name || g.model, l.name))
        );
        if (alreadyLoadedGen && (!preferredModel || this.sameModelName(alreadyLoadedGen.name, preferredModel))) {
          this.lastActiveChatModel = alreadyLoadedGen.name;
          return;
        }

        const target =
          (preferredModel && generative.find(g => this.sameModelName(g.name || g.model, preferredModel))) ||
          (config.aiEngine.defaultChatModel && generative.find(g => this.sameModelName(g.name || g.model, config.aiEngine.defaultChatModel))) ||
          generative.slice().sort((a, b) => (a.size || 0) - (b.size || 0))[0];
        const targetName = target?.name || target?.model;
        if (!targetName || this.activeCount > 0) return;

        const safeCtx = AIMemoryEstimator.getSafeContextTokens(targetName, 2048);
        const resp = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: targetName,
            messages: [],
            stream: false,
            keep_alive: (config.aiEngine as any).keepAlive || '30m',
            options: { num_ctx: safeCtx, num_predict: 0 },
          }),
          signal: AbortSignal.timeout(45000),
        });
        if (resp.ok) {
          this.lastActiveChatModel = targetName;
          this.cachedLoadedModels = {
            data: [{ name: targetName, size: target.size || 0 }],
            expiresAt: Date.now() + 15000,
          };
        }
      } catch {
        // Non-blocking warm-up best effort
      } finally {
        this.warmUpInFlight = false;
      }
    })();
  }

  /**
   * Unload resident models from RAM (keep_alive: 0) to free memory instantly
   */
  async unloadModel(modelName?: string): Promise<boolean> {
    this.invalidateModelCaches();
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
        this.invalidateModelCaches();
        return true;
      }

      // Unload all active resident models
      const loaded = await this.getLoadedModels(true);
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
      this.invalidateModelCaches();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Intelligently manages loaded model residency in RAM.
   * Allows multiple models to remain resident in RAM up to maxLoadedModels (default 3)
   * so multiple concurrent users and models respond instantly without reload thrashing.
   * Evicts unneeded models only when exceeding capacity AND system memory is critically low.
   */
  async evictOtherLoadedModels(targetModel: string): Promise<void> {
    try {
      // Fast-path: if the exact same model was the last active chat model and no other model is cached as loaded, skip /api/ps!
      if (
        this.lastActiveChatModel &&
        this.sameModelName(this.lastActiveChatModel, targetModel) &&
        (!this.cachedLoadedModels ||
          this.cachedLoadedModels.data.every(m => !m.name || this.sameModelName(m.name, targetModel)))
      ) {
        return;
      }

      const maxAllowedLoaded = Math.max(1, (config.aiEngine as any).maxLoadedModels || 2);
      const targetParamsB = AIMemoryEstimator.estimateParameterCount(targetModel);
      let shouldCheckLoaded = targetParamsB >= 4;
      let forceSingleModelInRam = targetParamsB >= 4;

      try {
        const metrics = AIMemoryEstimator.getSystemMemoryMetrics();
        if (metrics.totalHostRamMB <= 16384 || metrics.availableHostRamMB < 2500 || metrics.freeHostRamMB < 1024) {
          shouldCheckLoaded = true;
        }
        if (metrics.totalHostRamMB <= 12288 || metrics.availableHostRamMB < 3000) {
          forceSingleModelInRam = true;
        }
      } catch {
        // ignore metric lookup failure
      }

      if (!shouldCheckLoaded) {
        return;
      }

      const loaded = await this.getLoadedModels();
      if (loaded.length === 0) return;

      const otherModels = loaded.filter(m => m.name && !this.sameModelName(m.name, targetModel));
      if (otherModels.length === 0) {
        this.lastActiveChatModel = targetModel;
        return;
      }

      if (!forceSingleModelInRam && loaded.length < maxAllowedLoaded) {
        return;
      }

      for (const m of otherModels) {
        if (m.name) {
          logger.info(`[LocalAIProvider] Unloading resident model ${m.name} from RAM before running ${targetModel} to prevent VPS swap thrashing`);
          await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: m.name, keep_alive: 0 }),
            signal: AbortSignal.timeout(4000),
          }).catch(() => null);
          this.invalidateModelCaches();
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
      this.invalidateModelCaches();
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

    const installed = await this.listInstalledModels(true);
    const exists = installed.some(model =>
      [model.name, model.model].some(name => typeof name === 'string' && this.sameModelName(name, normalized))
    );
    if (!exists) return { success: false, message: 'مدل موردنظر در موتور محلی نصب نشده است.' };
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
      this.invalidateModelCaches();
      return { success: true, message: `مدل ${normalized} با موفقیت حذف گردید.` };
    } catch (err: any) {
      this.markOfflineIfNetworkError(err);
      return { success: false, message: err?.name === 'AbortError' ? 'مهلت حذف مدل به پایان رسید.' : 'خطا در حذف مدل.' };
    } finally {
      clearTimeout(timeout);
      this.pullInProgress = false;
    }
  }

  private isSeparatorOrTableLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^[-=_*─━┄┈|:\s]+$/.test(trimmed)) return true;
    return false;
  }

  private hasDegenerateRepetition(text: string): boolean {
    if (text.length < 160) return false;
    // Detect deeply nested numbering loops like ۱.۱.۱.۱.۱. or 1.1.1.1.1.
    if (/(?:[۰-۹0-9]+\.){5,}/.test(text)) return true;
    const nonEmptyLines = text
      .split('\n')
      .filter(l => !this.isSeparatorOrTableLine(l))
      .map(l => l.replace(/^[\s\-*•۰-۹0-9.)]+/, '').trim())
      .filter(l => l.length >= 16);
    if (nonEmptyLines.length >= 4) {
      const last = nonEmptyLines[nonEmptyLines.length - 1];
      const prev1 = nonEmptyLines[nonEmptyLines.length - 2];
      const prev2 = nonEmptyLines[nonEmptyLines.length - 3];
      const prev3 = nonEmptyLines[nonEmptyLines.length - 4];
      if (last === prev1 && prev1 === prev2 && prev2 === prev3) return true;
    }
    return false;
  }

  private trimDegenerateRepetition(text: string): string {
    if (!text) return '';
    const rawLines = text.split('\n');
    const kept: string[] = [];
    let lastNormalized = '';
    let repeatCount = 0;

    for (const line of rawLines) {
      if (/(?:[۰-۹0-9]+\.){5,}/.test(line)) {
        break;
      }
      if (!this.isSeparatorOrTableLine(line)) {
        const normalized = line.replace(/^[\s\-*•۰-۹0-9.)]+/, '').trim();
        if (normalized.length >= 16) {
          if (normalized === lastNormalized) {
            repeatCount++;
            if (repeatCount >= 2) {
              break;
            }
          } else {
            lastNormalized = normalized;
            repeatCount = 0;
          }
        }
      }
      kept.push(line);
    }
    return kept.join('\n').trim();
  }

  private buildOptimalInferenceOptions(options: LocalChatOptions | undefined, safeCtx: number) {
    const cpuCores = AIMemoryEstimator.getSystemMemoryMetrics().hostCpuCores || 4;
    const optimalThreads = Math.max(2, Math.min(cpuCores, 8));
    return {
      temperature: options?.temperature ?? 0.25,
      top_p: options?.top_p ?? 0.9,
      top_k: 40,
      repeat_penalty: 1.06,
      repeat_last_n: 64,
      num_predict: options?.max_tokens ?? 2048,
      num_ctx: safeCtx,
      num_thread: optimalThreads,
      num_batch: 512,
    };
  }

  /**
   * Chat completion via Local LLM Engine with concurrency lock and AbortSignal support
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: LocalChatOptions,
    signal?: AbortSignal
  ): Promise<LocalChatResult> {
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    const executeChat = async (remainingMs: number): Promise<LocalChatResult> => {
      if (signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = this.requireModel(options?.model, 'chat');
      const timeoutMs = Math.min(options?.timeoutMs || config.aiEngine.timeoutMs || 300000, remainingMs);

      await this.evictOtherLoadedModels(model);

      const requestedCtx = options?.num_ctx || options?.contextTokens || config.aiEngine.contextTokens;
      const safeCtx = AIMemoryEstimator.getSafeContextTokens(model, requestedCtx);

      const controller = new AbortController();
      const abortFromCaller = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', abortFromCaller, { once: true });

      let timeout: ReturnType<typeof setTimeout> | null = null;
      const resetWatchdog = () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => controller.abort(), timeoutMs);
        options?.onActivity?.();
      };
      resetWatchdog();

      const prefillHeartbeat = setInterval(async () => {
        if (controller.signal.aborted) return;
        if (Date.now() - startTime > 480000) return;
        try {
          const psCtrl = new AbortController();
          const psTimer = setTimeout(() => psCtrl.abort(), 3500);
          const psResp = await fetch(`${this.baseUrl}/api/ps`, { signal: psCtrl.signal });
          clearTimeout(psTimer);
          if (psResp.ok) {
            resetWatchdog();
          }
        } catch {
          // Ignore transient probe errors
        }
      }, 12000);

      try {
        const payload: Record<string, any> = {
          model,
          messages,
          stream: false,
          keep_alive: (config.aiEngine as any).keepAlive || '30m',
          options: this.buildOptimalInferenceOptions(options, safeCtx),
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
        this.lastActiveChatModel = model;
        this.cachedLoadedModels = {
          data: [{ name: model, size: 0 }],
          expiresAt: Date.now() + 15000,
        };
        const data = (await resp.json()) as {
          message?: { content?: string };
          model?: string;
          done?: boolean;
          done_reason?: string;
        };
        const text = this.trimDegenerateRepetition(data.message?.content?.trim() || '');
        const doneReason = String(data.done_reason || 'stop');
        const completed = data.done !== false && doneReason !== 'length';

        return {
          text,
          model: data.model || model,
          durationMs: Date.now() - startTime,
          completed,
          doneReason,
          incompleteReason:
            doneReason === 'length'
              ? 'پاسخ به سقف تعداد توکن خروجی رسید؛ برای تکمیل تحلیل دکمه «ادامه تولید پاسخ» را انتخاب کنید.'
              : undefined,
        };
      } catch (err: any) {
        if (err?.message?.includes('ECONNRESET') || err?.code === 'ECONNRESET') {
          AIMemoryEstimator.recordOomEvent();
        }
        const callerCancelled = signal?.aborted === true;
        const isNet = callerCancelled ? false : this.markOfflineIfNetworkError(err);
        if (!callerCancelled && !isNet) {
          logger.debug('[LocalAIProvider] Chat completion non-network error', { error: err.message });
        }
        throw err;
      } finally {
        clearInterval(prefillHeartbeat);
        if (timeout) clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromCaller);
      }
    };

    if (options?.skipQueue) {
      return executeChat(options?.timeoutMs || config.aiEngine.timeoutMs || 300000);
    }
    return this.enqueue(executeChat, options?.timeoutMs || config.aiEngine.timeoutMs || 300000, signal);
  }

  /**
   * Stream chat tokens from Ollama with activity-based sliding watchdog and strict completion verification.
   */
  async chatStream(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options: LocalChatOptions,
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<LocalChatResult> {
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    const executeStream = async (remainingMs: number): Promise<LocalChatResult> => {
      if (signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      const startedAt = Date.now();
      const model = this.requireModel(options.model, 'chat');

      await this.evictOtherLoadedModels(model);

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

      const baseTimeoutMs = Math.min(options.timeoutMs || remainingMs, remainingMs);
      let timeout: NodeJS.Timeout | null = setTimeout(() => controller.abort(), baseTimeoutMs);
      const resetStreamWatchdog = () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => controller.abort(), baseTimeoutMs);
        options.onActivity?.();
      };

      // Active prefill liveness heartbeat: while Ollama is cold-loading weights from disk or
      // evaluating the prompt on CPU (before the first token is emitted), poll /api/ps every 12s.
      // As long as the Ollama daemon responds and total prefill time is under 8 minutes (480s),
      // keep resetting the activity watchdog so CPU prefill never triggers a false 185s timeout.
      let receivedFirstToken = false;
      const maxPrefillWallMs = 480_000;
      const prefillHeartbeat = setInterval(async () => {
        if (receivedFirstToken || signal?.aborted || controller.signal.aborted) return;
        if (Date.now() - startedAt > maxPrefillWallMs) return;
        try {
          const psResp = await fetch(`${this.baseUrl}/api/ps`, {
            method: 'GET',
            signal: AbortSignal.timeout(3500),
          });
          if (psResp.ok && !receivedFirstToken && !signal?.aborted) {
            resetStreamWatchdog();
          }
        } catch {
          // If Ollama /api/ps is unreachable, let the normal watchdog expire
        }
      }, 12_000);

      try {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            stream: true,
            keep_alive: (config.aiEngine as any).keepAlive || '30m',
            options: this.buildOptimalInferenceOptions(options, safeCtx),
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => '');
          throw new Error(`Ollama streaming error: HTTP ${response.status} ${detail}`);
        }

        this.offlineUntil = 0;
        this.lastActiveChatModel = model;
        this.cachedLoadedModels = {
          data: [{ name: model, size: 0 }],
          expiresAt: Date.now() + 15000,
        };
        resetStreamWatchdog();
        const reader = response.body.getReader();
        activeReader = reader;
        const decoder = new TextDecoder();
        let pending = '';
        let fullText = '';
        let returnedModel = model;
        let stoppedByRepetitionGuard = false;
        let receivedFinalDoneChunk = false;
        let doneReason = '';

        const processJsonLine = (rawLine: string): boolean => {
          const trimmedLine = rawLine.trim();
          if (!trimmedLine) return true;
          let chunk: any;
          try {
            chunk = JSON.parse(trimmedLine);
          } catch {
            return false;
          }
          if (chunk.error) throw new Error(String(chunk.error));
          if (chunk.model) returnedModel = chunk.model;
          const token = chunk.message?.content || '';
          if (token) {
            receivedFirstToken = true;
            fullText += token;
            if (this.hasDegenerateRepetition(fullText)) {
              stoppedByRepetitionGuard = true;
              return true;
            }
            onToken(token);
          }
          if (chunk.done === true) {
            receivedFirstToken = true;
            receivedFinalDoneChunk = true;
            doneReason = String(chunk.done_reason || 'stop');
          }
          return true;
        };

        while (true) {
          if (signal?.aborted) {
            throw new DOMException('The user aborted a request.', 'AbortError');
          }
          const { value, done } = await reader.read();
          if (done) break;
          resetStreamWatchdog();
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() || '';
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const parsedOk = processJsonLine(line);
            if (!parsedOk) {
              // Re-prepend incomplete JSON fragment if split mid-frame
              pending = lines.slice(i).join('\n') + (pending ? '\n' + pending : '');
              break;
            }
            if (stoppedByRepetitionGuard) {
              try { await reader.cancel(); } catch {}
              break;
            }
          }
          if (stoppedByRepetitionGuard) break;
        }
        if (!stoppedByRepetitionGuard) {
          pending += decoder.decode();
          if (pending.trim()) {
            for (const line of pending.split(/\r?\n/)) {
              if (line.trim()) processJsonLine(line);
            }
          }
        }

        const cleanText = this.trimDegenerateRepetition(fullText);
        const isTruncatedByLength = doneReason === 'length';
        const isCompleted =
          (receivedFinalDoneChunk || stoppedByRepetitionGuard) && !isTruncatedByLength;
        let incompleteReason: string | undefined;
        if (isTruncatedByLength) {
          incompleteReason =
            'پاسخ به سقف تعداد توکن خروجی رسید؛ برای تکمیل ادامه تحلیل روی دکمه «ادامه تولید پاسخ» کلیک کنید.';
        } else if (!receivedFinalDoneChunk && !stoppedByRepetitionGuard) {
          incompleteReason =
            'جریان خروجی مدل پیش از دریافت سیگنال پایان کامل قطع شد؛ می‌توانید ادامه پاسخ را دریافت کنید.';
        }

        return {
          text: cleanText,
          model: returnedModel,
          durationMs: Date.now() - startedAt,
          completed: isCompleted,
          doneReason: doneReason || (stoppedByRepetitionGuard ? 'repetition_guard' : 'incomplete'),
          incompleteReason,
        };
      } catch (error: any) {
        const callerCancelled = signal?.aborted === true;
        const isNetworkError = callerCancelled ? false : this.markOfflineIfNetworkError(error);
        if (!callerCancelled && !isNetworkError) {
          logger.debug('[LocalAIProvider] Streaming chat failed', { error: String(error?.message || error) });
        }
        throw error;
      } finally {
        clearInterval(prefillHeartbeat);
        if (timeout) clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromCaller);
        try { activeReader?.releaseLock(); } catch {}
      }
    };

    if (options.skipQueue) {
      return executeStream(options.timeoutMs || config.aiEngine.timeoutMs || 300000);
    }
    return this.enqueue(executeStream, options.timeoutMs || config.aiEngine.timeoutMs || 300000, signal);
  }

  /**
   * Generate text completion via Local LLM Engine
   */
  async generate(
    prompt: string,
    options?: LocalChatOptions,
    signal?: AbortSignal
  ): Promise<{ text: string; model: string; durationMs: number }> {
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      if (signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = options?.model || config.aiEngine.defaultChatModel;
      const timeoutMs = remainingMs;

      const controller = new AbortController();
      const abortFromCaller = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', abortFromCaller, { once: true });
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const payload: Record<string, any> = {
          model,
          prompt,
          system: options?.system,
          stream: false,
          keep_alive: (config.aiEngine as any).keepAlive || '15m',
          options: {
            temperature: options?.temperature ?? 0.2,
            top_p: options?.top_p ?? 0.85,
            top_k: 40,
            repeat_penalty: 1.18,
            repeat_last_n: 128,
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
        const text = this.trimDegenerateRepetition(data.response?.trim() || '');

        return {
          text,
          model: data.model || model,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        const isNet = this.markOfflineIfNetworkError(err);
        if (!isNet) {
          logger.debug('[LocalAIProvider] Generate completion non-network error', { error: err.message });
        }
        throw err;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromCaller);
      }
    }, config.aiEngine.timeoutMs || 180000, signal);
  }

  /**
   * Generate dense vector embedding (for BGE-M3 RAG)
   */
  async generateEmbedding(
    prompt: string,
    modelName?: string,
    timeoutLimitMs = 15000,
    signal?: AbortSignal
  ): Promise<{ embedding: number[]; model: string; durationMs: number }> {
    await this.ensureRuntimeReachable();
    if (!this.isEngineEnabled || Date.now() < this.offlineUntil) {
      throw new Error('Local AI engine is offline');
    }

    return this.enqueue(async (remainingMs) => {
      if (signal?.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      if (Date.now() < this.offlineUntil) {
        throw new Error('Local AI engine is offline');
      }

      const startTime = Date.now();
      const model = this.requireModel(modelName, 'embedding');
      const controller = new AbortController();
      const abortFromCaller = () => controller.abort();
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener('abort', abortFromCaller, { once: true });
      const timeout = setTimeout(() => controller.abort(), Math.min(timeoutLimitMs, remainingMs));

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
        return {
          embedding: data.embedding || [],
          model,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        this.markOfflineIfNetworkError(err);
        throw err;
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abortFromCaller);
      }
    }, timeoutLimitMs, signal);
  }
}

export const localAIProvider = new LocalAIProvider();
