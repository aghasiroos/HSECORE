import { UnifiedWeatherData, WeatherLocationQuery } from "./types.ts";

interface CacheEntry {
  data: UnifiedWeatherData;
  expiresAt: number;
  createdAt: number;
}

export class WeatherCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(ttlMinutes = 5) {
    this.defaultTtlMs = ttlMinutes * 60 * 1000;
  }

  public generateKey(query: WeatherLocationQuery): string {
    if (query.locationId) {
      return `id:${query.locationId.trim()}`;
    }
    if (query.lat !== undefined && query.lon !== undefined) {
      // Precision to ~100m (3 decimal places) for accurate site-level telemetry differentiation
      const roundedLat = query.lat.toFixed(3);
      const roundedLon = query.lon.toFixed(3);
      return `geo:${roundedLat},${roundedLon}`;
    }
    if (query.query) {
      return `q:${query.query.trim().toLowerCase()}`;
    }
    return "default:station";
  }

  public get(query: WeatherLocationQuery): UnifiedWeatherData | null {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    const remainingSeconds = Math.max(0, Math.round((entry.expiresAt - now) / 1000));
    const ageSeconds = Math.max(0, Math.round((now - entry.createdAt) / 1000));
    return {
      ...entry.data,
      cached: true,
      cacheAgeSeconds: ageSeconds,
      cacheExpiresIn: remainingSeconds,
    };
  }

  public set(query: WeatherLocationQuery, data: UnifiedWeatherData, customTtlMs?: number): void {
    const key = this.generateKey(query);
    const ttl = customTtlMs ?? this.defaultTtlMs;
    const now = Date.now();

    if (this.cache.size > 500) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: {
        ...data,
        cached: false,
        cacheAgeSeconds: 0,
        cacheExpiresIn: Math.round(ttl / 1000),
      },
      createdAt: now,
      expiresAt: now + ttl,
    });
  }

  public delete(query: WeatherLocationQuery): void {
    const key = this.generateKey(query);
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }

  public getStats() {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0%";
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio,
    };
  }
}
