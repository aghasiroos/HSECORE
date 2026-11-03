import fs from 'node:fs';
import os from 'node:os';

export interface SystemMemoryMetrics {
  totalHostRamMB: number;
  freeHostRamMB: number;
  availableHostRamMB: number;
  usedHostRamMB: number;
  reservedHostRamMB: number;
  totalSwapMB: number;
  freeSwapMB: number;
  containerLimitMB: number;
  containerUsageMB?: number;
  hostCpuCores: number;
  isCgroupLimited: boolean;
  hasHostSwap: boolean;
}

export interface ModelMemoryProfile {
  modelName: string;
  ggufSizeMB: number;
  parameterCountB: number;
  quantization: string;
  isVisionModel: boolean;
  kvCacheMB: number;
  cpuRepackMB: number;
  visionMmprojMB: number;
  totalEstimatedMB: number;
  safeContextTokens: number;
  oomRisk: 'safe' | 'warning' | 'critical';
  recommendations: string[];
}

function parseMemoryStringMB(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = String(raw).trim().replace(/^["']|["']$/g, '').toUpperCase();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*(G|GB|GIB|M|MB|MIB|K|KB|KIB)?$/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (isNaN(value) || value <= 0) return null;
  const unit = match[2] || 'M';
  if (unit.startsWith('G')) return Math.round(value * 1024);
  if (unit.startsWith('K')) return Math.round(value / 1024);
  return Math.round(value);
}

export class AIMemoryEstimator {
  private static lastOomTime = 0;
  private static oomKillCounter = 0;

  /**
   * Reads real host system memory metrics from /host/proc/meminfo, /proc/meminfo, os.totalmem(), and AI container limits
   */
  public static getSystemMemoryMetrics(): SystemMemoryMetrics {
    let totalHostRamMB = Math.max(512, Math.round(os.totalmem() / (1024 * 1024)));
    let freeHostRamMB = Math.max(0, Math.round(os.freemem() / (1024 * 1024)));
    let availableHostRamMB = freeHostRamMB;
    let totalSwapMB = 0;
    let freeSwapMB = 0;
    let hasMemAvailableField = false;
    let buffersMB = 0;
    let cachedMB = 0;

    const meminfoPath = fs.existsSync('/host/proc/meminfo')
      ? '/host/proc/meminfo'
      : fs.existsSync('/proc/meminfo')
      ? '/proc/meminfo'
      : null;

    try {
      if (meminfoPath) {
        const meminfo = fs.readFileSync(meminfoPath, 'utf8');
        const lines = meminfo.split('\n');
        for (const line of lines) {
          const [key, valWithKb] = line.split(':');
          if (!key || !valWithKb) continue;
          const kb = parseInt(valWithKb.trim().split(/\s+/)[0], 10);
          if (isNaN(kb)) continue;
          const mb = Math.round(kb / 1024);

          switch (key.trim()) {
            case 'MemTotal':
              if (mb > 0) totalHostRamMB = mb;
              break;
            case 'MemFree':
              freeHostRamMB = mb;
              break;
            case 'MemAvailable':
              availableHostRamMB = mb;
              hasMemAvailableField = true;
              break;
            case 'Buffers':
              buffersMB = mb;
              break;
            case 'Cached':
              cachedMB = mb;
              break;
            case 'SwapTotal':
              totalSwapMB = mb;
              break;
            case 'SwapFree':
              freeSwapMB = mb;
              break;
          }
        }
        if (!hasMemAvailableField) {
          availableHostRamMB = Math.min(totalHostRamMB, freeHostRamMB + buffersMB + cachedMB);
        }
      }
    } catch {
      // fallback to os.totalmem() / os.freemem() already initialized above
    }

    // If the host installer/runtime explicitly passed physical HOST_TOTAL_RAM_MB (e.g. when cgroup virtualizes /proc/meminfo)
    const envHostRamMB = parseMemoryStringMB(process.env.HOST_TOTAL_RAM_MB);
    if (envHostRamMB && envHostRamMB > totalHostRamMB) {
      totalHostRamMB = envHostRamMB;
    }

    const envHostSwapMB = parseMemoryStringMB(process.env.HOST_TOTAL_SWAP_MB);
    if (envHostSwapMB !== null && envHostSwapMB > totalSwapMB) {
      totalSwapMB = envHostSwapMB;
    }

    // Calculate host OS + PostgreSQL + HSECORE reserved RAM
    const defaultReservedMB =
      totalHostRamMB >= 10000
        ? 2560
        : totalHostRamMB >= 6000
        ? 2048
        : Math.max(1024, Math.round(totalHostRamMB * 0.25));

    const safeMaxContainerMB = Math.max(1024, totalHostRamMB - defaultReservedMB);

    // Determine AI container limit:
    // 1. Check explicit AI_MEMORY_LIMIT from .env / environment (used by docker-compose.server.yml for hse-ai-engine)
    // 2. Otherwise check cgroup limit only if it is strictly smaller than totalHostRamMB
    // 3. Otherwise use safeMaxContainerMB (totalHostRamMB - reservedHostRamMB)
    let containerLimitMB = safeMaxContainerMB;
    let isCgroupLimited = false;

    const configuredAiLimitMB = parseMemoryStringMB(process.env.AI_MEMORY_LIMIT);
    if (configuredAiLimitMB && configuredAiLimitMB > 0) {
      containerLimitMB = Math.min(configuredAiLimitMB, totalHostRamMB);
      isCgroupLimited = true;
    } else {
      try {
        if (fs.existsSync('/sys/fs/cgroup/memory.max')) {
          const val = fs.readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim();
          if (val !== 'max') {
            const bytes = parseInt(val, 10);
            const cgroupMB = Math.round(bytes / (1024 * 1024));
            if (!isNaN(cgroupMB) && cgroupMB > 0 && cgroupMB < totalHostRamMB) {
              containerLimitMB = cgroupMB;
              isCgroupLimited = true;
            }
          }
        } else if (fs.existsSync('/sys/fs/cgroup/memory/memory.limit_in_bytes')) {
          const val = fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8').trim();
          const bytes = parseInt(val, 10);
          const cgroupMB = Math.round(bytes / (1024 * 1024));
          if (!isNaN(cgroupMB) && cgroupMB > 0 && cgroupMB < totalHostRamMB && bytes < 1099511627776) {
            containerLimitMB = cgroupMB;
            isCgroupLimited = true;
          }
        }
      } catch {
        // best-effort
      }
    }

    const reservedHostRamMB = Math.max(512, totalHostRamMB - containerLimitMB);
    const usedHostRamMB = Math.max(0, totalHostRamMB - availableHostRamMB);
    const envCpuCores = parseInt(String(process.env.HOST_CPU_CORES || ''), 10);
    const hostCpuCores = !isNaN(envCpuCores) && envCpuCores > 0 ? envCpuCores : Math.max(1, os.cpus()?.length || 1);

    return {
      totalHostRamMB,
      freeHostRamMB,
      availableHostRamMB,
      usedHostRamMB,
      reservedHostRamMB,
      totalSwapMB,
      freeSwapMB,
      containerLimitMB,
      hostCpuCores,
      isCgroupLimited,
      hasHostSwap: totalSwapMB >= 1024,
    };
  }

  /**
   * Detects if the model is multimodal/vision-enabled
   */
  public static detectVisionModel(modelName: string): boolean {
    const lower = (modelName || '').toLowerCase();
    return /vision|vl\b|llava|bakllava|minicpm-v|moondream|deepseek-vl|gemma[34]:.*12b/i.test(lower);
  }

  /**
   * Estimates model parameter count in billions from model name tag
   */
  public static estimateParameterCount(modelName: string): number {
    const lower = (modelName || '').toLowerCase();
    const match = lower.match(/(\d+(?:\.\d+)?)b\b/i);
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (/70b/i.test(lower)) return 70;
    if (/32b|33b/i.test(lower)) return 32;
    if (/14b/i.test(lower)) return 14;
    if (/12b/i.test(lower)) return 12;
    if (/8b|9b/i.test(lower)) return 8.5;
    if (/7b/i.test(lower)) return 7;
    if (/3b|4b/i.test(lower)) return 3.5;
    if (/1\.5b|1\.7b|2b/i.test(lower)) return 1.7;
    return 7; // default average
  }

  /**
   * Calculates KV Cache memory footprint in MB based on context length & model params
   */
  public static calculateKvCacheMB(paramsB: number, contextLength: number): number {
    // Modern models with Grouped Query Attention (GQA):
    // ~2 bytes per element (fp16), KV cache is 2 * num_layers * num_kv_heads * head_dim * contextLength
    // Empirical ratio:
    // 1.5B ~ 0.08 MB per token
    // 7B - 8B ~ 0.22 MB per token
    // 12B - 14B ~ 0.28 MB per token
    // 32B ~ 0.55 MB per token
    const factorPerToken = Math.max(0.06, Math.min(0.65, (paramsB / 7) * 0.22));
    const kvMb = Math.round((contextLength * factorPerToken));
    return Math.max(64, kvMb);
  }

  /**
   * Estimates full model RAM footprint and computes safe context window
   */
  public static estimateModelMemory(
    modelName: string,
    ggufSizeBytes?: number,
    contextLength = 2048,
    quantization = 'Q4_K_M'
  ): ModelMemoryProfile {
    const paramsB = this.estimateParameterCount(modelName);
    const isVision = this.detectVisionModel(modelName);

    // GGUF Size in MB
    let ggufSizeMB = 0;
    if (ggufSizeBytes && ggufSizeBytes > 0) {
      ggufSizeMB = Math.round(ggufSizeBytes / (1024 * 1024));
    } else {
      // Fallback estimate for 4-bit quant: ~0.65 GB per billion params
      ggufSizeMB = Math.round(paramsB * 680);
    }

    // CPU Repack overhead:
    // Ollama CPU execution dynamically repacks weights into contiguous memory buffers during inference
    const cpuRepackMB = Math.round(Math.min(Math.max(ggufSizeMB * 0.12, 256), 1200));

    // KV Cache
    const kvCacheMB = this.calculateKvCacheMB(paramsB, contextLength);

    // Multimodal / Vision Projector (mmproj)
    const visionMmprojMB = isVision ? 1150 : 0;

    // Runtime runtime baseline overhead (libc, Ollama core, embeddings buffer)
    const baseRuntimeMB = 280;

    const totalEstimatedMB = ggufSizeMB + cpuRepackMB + kvCacheMB + visionMmprojMB + baseRuntimeMB;

    const sys = this.getSystemMemoryMetrics();
    const containerLimit = sys.containerLimitMB;

    // Determine safe context window
    const availableForContext = Math.max(0, containerLimit - (ggufSizeMB + cpuRepackMB + visionMmprojMB + baseRuntimeMB + 400));
    const factorPerToken = Math.max(0.06, Math.min(0.65, (paramsB / 7) * 0.22));
    const maxCalculatedTokens = Math.floor(availableForContext / factorPerToken);

    let safeContextTokens = 2048;
    if (maxCalculatedTokens >= 8192) {
      safeContextTokens = 8192;
    } else if (maxCalculatedTokens >= 4096) {
      safeContextTokens = 4096;
    } else if (maxCalculatedTokens >= 2048) {
      safeContextTokens = 2048;
    } else {
      safeContextTokens = Math.max(512, Math.floor(maxCalculatedTokens / 256) * 256);
    }

    let oomRisk: 'safe' | 'warning' | 'critical' = 'safe';
    const recommendations: string[] = [];

    if (totalEstimatedMB > containerLimit) {
      oomRisk = 'critical';
      recommendations.push(
        `هشدار OOM: حجم تخمینی مدل (${(totalEstimatedMB / 1024).toFixed(1)}GB) از سقف کانتینر (${(containerLimit / 1024).toFixed(1)}GB) بیشتر است.`
      );
      if (!sys.hasHostSwap) {
        recommendations.push('سرور فاقد فضای Swap است. اجرای دستور `sudo hsecore ai swap` برای جلوگیری از کرش کانتینر ضروری است.');
      }
      recommendations.push(`طول پنجره کانتکست را به ${safeContextTokens} توکن محدود کنید.`);
    } else if (totalEstimatedMB > containerLimit * 0.85) {
      oomRisk = 'warning';
      recommendations.push(
        `مصرف مرزی حافظه: مدل نزدیک به سقف رم کانتینر است. کانتکست پیشنهادی: ${safeContextTokens} توکن.`
      );
    } else {
      oomRisk = 'safe';
      recommendations.push('مدل به طور کامل و ایمن در سقف حافظه کانتینر جای می‌گیرد.');
    }

    if (isVision) {
      recommendations.push('مدل دارای Vision Encoder است که حدود ۱.۱ گیگابایت حافظه اضافی به همراه دارد.');
    }

    return {
      modelName,
      ggufSizeMB,
      parameterCountB: paramsB,
      quantization,
      isVisionModel: isVision,
      kvCacheMB,
      cpuRepackMB,
      visionMmprojMB,
      totalEstimatedMB,
      safeContextTokens,
      oomRisk,
      recommendations,
    };
  }

  /**
   * Computes the optimal context length for an inference call to avoid OOM
   */
  public static getSafeContextTokens(modelName: string, requestedCtx?: number, ggufSizeBytes?: number): number {
    const profile = this.estimateModelMemory(modelName, ggufSizeBytes, requestedCtx || 2048);
    if (!requestedCtx || requestedCtx <= 0) {
      return profile.safeContextTokens;
    }
    // Never allow requested context to exceed safe limit if risk is critical/warning
    if (requestedCtx > profile.safeContextTokens && profile.oomRisk !== 'safe') {
      return profile.safeContextTokens;
    }
    return Math.min(requestedCtx, 8192);
  }

  public static recordOomEvent(): void {
    this.lastOomTime = Date.now();
    this.oomKillCounter++;
  }

  public static getOomDiagnostics() {
    return {
      lastOomTime: this.lastOomTime ? new Date(this.lastOomTime).toISOString() : null,
      oomKillCounter: this.oomKillCounter,
    };
  }
}
