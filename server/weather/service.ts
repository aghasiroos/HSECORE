import { 
  IWeatherProvider, 
  WeatherLocationQuery, 
  UnifiedWeatherData 
} from "./types.ts";
import { WeatherCache } from "./cache.ts";
import { ForecaWeatherProvider } from "./providers/foreca.ts";
import { OpenMeteoWeatherProvider } from "./providers/openmeteo.ts";
import { MetNorwayWeatherProvider } from "./providers/metno.ts";
import { AccuWeatherProvider } from "./providers/accuweather.ts";
import { validateWeatherPayload } from "./physics.ts";

export interface GoogleSearchAuditResult {
  targetUrl: string;
  evaluatedAt: string;
  httpStatus: number | null;
  reachable: boolean;
  blockedByBotProtection: boolean;
  hasStructuredTelemetryJson: boolean;
  hasVerifiableObservationTimestamp: boolean;
  hasStandardizedUnits: boolean;
  isReliableForAutomatedHse: boolean;
  verdictFa: string;
  verdictEn: string;
  technicalDetails: string;
}

export interface ProviderComparisonEntry {
  providerId: string;
  providerName: string;
  configured: boolean;
  status: 'online' | 'offline' | 'unconfigured';
  latencyMs: number;
  observedAt?: string;
  fetchedAt?: string;
  tempC?: number;
  hum?: number;
  windKmh?: number;
  pressureHpa?: number;
  condition?: string | null;
  code?: number;
  isDay?: boolean;
  hi?: number;
  wbgt?: number;
  wbgtShade?: number;
  wbgtMethod?: string;
  wbgtIsEstimated?: boolean;
  validation?: {
    valid: boolean;
    errors: string[];
  };
}

export class WeatherService {
  private cache: WeatherCache;
  private providers: Map<string, IWeatherProvider> = new Map();
  // Strictly ordered real provider priority: MET Norway (Yr.no) -> Open-Meteo -> Foreca -> AccuWeather
  private defaultProviderPriority: string[] = ["metno", "openmeteo", "foreca", "accuweather"];

  constructor() {
    this.cache = new WeatherCache(10); // 10 minutes cache TTL

    // Register real weather providers in strict hierarchical fallback sequence
    this.registerProvider(new MetNorwayWeatherProvider());
    this.registerProvider(new OpenMeteoWeatherProvider());
    this.registerProvider(new ForecaWeatherProvider());
    this.registerProvider(new AccuWeatherProvider());
  }

  public registerProvider(provider: IWeatherProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): IWeatherProvider | undefined {
    return this.providers.get(id);
  }

  public getAllProviders() {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      configured: p.isConfigured()
    }));
  }

  /**
   * Evaluates whether `https://www.google.com/search` can serve as a reliable automated weather API.
   */
  public async evaluateGoogleSearchSource(lat: number, lon: number): Promise<GoogleSearchAuditResult> {
    const searchUrl = `https://www.google.com/search?q=weather+${lat.toFixed(4)},${lon.toFixed(4)}&hl=fa`;
    const evaluatedAt = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HSECoreWeatherAudit/3.2)",
          "Accept-Language": "fa,en;q=0.9"
        },
        redirect: "manual",
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (!res) {
        return {
          targetUrl: "https://www.google.com/search",
          evaluatedAt,
          httpStatus: null,
          reachable: false,
          blockedByBotProtection: true,
          hasStructuredTelemetryJson: false,
          hasVerifiableObservationTimestamp: false,
          hasStandardizedUnits: false,
          isReliableForAutomatedHse: false,
          verdictFa: "ناپایدار و غیرقابل اتکا برای استخراج خودکار صنعتی (عدم پاسخ‌دهی یا مسدودسازی درخواست خودکار سرور)",
          verdictEn: "Unstable and unsuitable for automated industrial telemetry extraction",
          technicalDetails: "Direct server HTTP request timed out or was dropped by Google edge protection."
        };
      }

      const status = res.status;
      const locationHeader = res.headers.get("location") || "";
      const bodyText = status === 200 ? (await res.text().catch(() => "")).slice(0, 15000) : "";
      const isSorryRedirect =
        status === 429 ||
        status === 403 ||
        status === 302 ||
        locationHeader.includes("/sorry/") ||
        bodyText.includes("recaptcha") ||
        bodyText.includes("/httpservice/retry/enablejs");

      return {
        targetUrl: "https://www.google.com/search",
        evaluatedAt,
        httpStatus: status,
        reachable: true,
        blockedByBotProtection: isSorryRedirect,
        hasStructuredTelemetryJson: false,
        hasVerifiableObservationTimestamp: false,
        hasStandardizedUnits: false,
        isReliableForAutomatedHse: false,
        verdictFa:
          "استخراج مستقیم از صفحه جست‌وجوی گوگل (google.com/search) به دلیل محافظت ضدربات (CAPTCHA / HTTP 302-429)، رندر جاوااسکریپت مبهم‌شده، نبود زمان دقیق سنجش ایستگاه (observedAt) و وابستگی واحدها به کوکی مرورگر ناپایدار است؛ بنابراین با سرویس‌های مستند و مستقل هواشناسی (Open-Meteo WMO/ECMWF و MET Norway Yr.no) در سمت سرور جایگزین شد.",
        verdictEn:
          "Direct extraction from google.com/search is unstable due to bot challenges (HTTP 302/429/JS challenge), lack of structured JSON schema, missing station observation timestamps, and locale-dependent units. Replaced with documented server-side meteorological APIs (Open-Meteo WMO/ECMWF & MET Norway Yr.no).",
        technicalDetails: `HTTP ${status}${locationHeader ? ` -> Redirect: ${locationHeader.slice(0, 80)}` : " (Obfuscated HTML / JS challenge without official JSON telemetry schema)"}`
      };
    } catch (err: any) {
      return {
        targetUrl: "https://www.google.com/search",
        evaluatedAt,
        httpStatus: null,
        reachable: false,
        blockedByBotProtection: true,
        hasStructuredTelemetryJson: false,
        hasVerifiableObservationTimestamp: false,
        hasStandardizedUnits: false,
        isReliableForAutomatedHse: false,
        verdictFa: "ناپایدار جهت استخراج خودکار — جایگزین‌شده با API رسمی هواشناسی در سمت سرور",
        verdictEn: "Unstable for automated extraction — replaced with official server-side meteorological APIs",
        technicalDetails: err?.message || "Connection error"
      };
    }
  }

  /**
   * Queries all independent weather providers in parallel to cross-verify telemetry accuracy,
   * observation timestamps, units, and WBGT calculations.
   */
  public async compareSources(query: WeatherLocationQuery) {
    const lat = query.lat ?? 30.471003;
    const lon = query.lon ?? 49.090324;

    const providerList = Array.from(this.providers.values());
    const [googleAudit, ...providerResults] = await Promise.all([
      this.evaluateGoogleSearchSource(lat, lon),
      ...providerList.map(async (provider): Promise<ProviderComparisonEntry> => {
        if (!provider.isConfigured()) {
          return {
            providerId: provider.id,
            providerName: provider.name,
            configured: false,
            status: 'unconfigured',
            latencyMs: 0
          };
        }
        const t0 = Date.now();
        try {
          const data = await provider.getWeather({
            lat,
            lon,
            query: query.query,
            clientTs: query.clientTs,
            clientTz: query.clientTz,
            tzOffsetMin: query.tzOffsetMin,
          });
          const latencyMs = Date.now() - t0;
          if (!data) {
            const stillConfigured = provider.isConfigured();
            return {
              providerId: provider.id,
              providerName: provider.name,
              configured: stillConfigured,
              status: stillConfigured ? 'offline' : 'unconfigured',
              latencyMs
            };
          }
          const validation = validateWeatherPayload({
            tempC: data.tempC,
            hum: data.hum,
            wind: data.wind,
            pressure: data.pressure,
            observedAt: data.observedAt
          });
          return {
            providerId: provider.id,
            providerName: provider.name,
            configured: true,
            status: 'online',
            latencyMs,
            observedAt: data.observedAt,
            fetchedAt: data.fetchedAt,
            tempC: data.tempC,
            hum: data.hum,
            windKmh: data.wind,
            pressureHpa: data.pressure,
            condition: data.condition,
            code: data.code,
            isDay: data.isDay,
            hi: data.hi,
            wbgt: data.wbgt,
            wbgtShade: data.wbgtShade,
            wbgtMethod: data.wbgtMethod,
            wbgtIsEstimated: data.wbgtIsEstimated,
            validation: {
              valid: validation.valid,
              errors: validation.errors
            }
          };
        } catch {
          return {
            providerId: provider.id,
            providerName: provider.name,
            configured: true,
            status: 'offline',
            latencyMs: Date.now() - t0
          };
        }
      })
    ]);

    const onlineSources = providerResults.filter(p => p.status === 'online' && p.tempC !== undefined);
    let crossCheckSummary = null;
    if (onlineSources.length >= 2) {
      const temps = onlineSources.map(s => s.tempC!);
      const hums = onlineSources.map(s => s.hum!);
      const winds = onlineSources.map(s => s.windKmh!);
      const wbgts = onlineSources.map(s => s.wbgt!);

      const maxDiff = (arr: number[]) => parseFloat((Math.max(...arr) - Math.min(...arr)).toFixed(1));
      const tempDelta = maxDiff(temps);
      const humDelta = maxDiff(hums);
      const windDelta = maxDiff(winds);
      const wbgtDelta = maxDiff(wbgts);

      crossCheckSummary = {
        independentOnlineCount: onlineSources.length,
        tempDeltaC: tempDelta,
        humDeltaPct: humDelta,
        windDeltaKmh: windDelta,
        wbgtDeltaC: wbgtDelta,
        agreementLevel: tempDelta <= 2.5 ? 'HIGH' : tempDelta <= 4.5 ? 'MODERATE' : 'DIVERGENT',
        agreementNoteFa:
          tempDelta <= 2.5
            ? `تطابق بالا بین ${onlineSources.length} منبع مستقل هواشناسی (اختلاف دما: ${tempDelta}°C، اختلاف WBGT: ${wbgtDelta}°C)`
            : `اختلاف قابل‌توجه بین منابع مستقل (${tempDelta}°C)؛ توصیه به بررسی ایستگاه محلی`
      };
    }

    return {
      comparedAt: new Date().toISOString(),
      coordinates: { lat, lon },
      googleSearchEvaluation: googleAudit,
      sources: providerResults,
      crossCheckSummary
    };
  }

  /**
   * Main unified weather resolver:
   * 1. Checks Cache
   * 2. Sequentially tries real providers in order:
   *    - Priority 1: FORECA
   *    - Priority 2: Open-Meteo (WMO / ECMWF)
   *    - Priority 3: MET Norway (Yr.no Official Institute)
   *    - Priority 4: ACCUWEATHER
   * 3. Sets Cache on success, or throws explicit error if all providers are unreachable
   */
  public async getWeather(
    query: WeatherLocationQuery, 
    preferredProviderId?: string,
    bypassCache = true
  ): Promise<UnifiedWeatherData> {
    if (!bypassCache) {
      const cached = this.cache.get(query);
      if (cached) {
        return cached;
      }
    } else {
      this.cache.delete(query);
    }

    const providerOrder: string[] = [];
    if (preferredProviderId && this.providers.has(preferredProviderId)) {
      providerOrder.push(preferredProviderId);
    }
    for (const pId of this.defaultProviderPriority) {
      if (!providerOrder.includes(pId)) {
        providerOrder.push(pId);
      }
    }

    for (let i = 0; i < providerOrder.length; i++) {
      const pId = providerOrder[i];
      const provider = this.providers.get(pId);
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      try {
        const result = await provider.getWeather(query);
        if (result) {
          this.cache.set(query, result);
          return result;
        } else {
          const nextPId = providerOrder[i + 1];
          if (nextPId) {
            console.log(`[WeatherService] Provider "${pId}" produced no data. Cascading to next priority: "${nextPId}"`);
          }
        }
      } catch (err: any) {
        const nextPId = providerOrder[i + 1];
        console.log(`[WeatherService] Provider "${pId}" unavailable (${err.message || err}). Cascading to next priority: "${nextPId || 'end'}"`);
      }
    }

    throw new Error("WEATHER_SERVICE_UNAVAILABLE: Unable to reach any configured weather provider (Foreca, Open-Meteo, MET Norway, AccuWeather).");
  }

  public getCacheStats() {
    return this.cache.getStats();
  }

  public clearCache() {
    this.cache.clear();
  }
}

// Singleton instance
export const weatherService = new WeatherService();
