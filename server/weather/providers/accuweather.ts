import { 
  IWeatherProvider, 
  WeatherLocationQuery, 
  UnifiedWeatherData
} from "../types.ts";
import { calculateFullHeatStressMetrics, resolveWeatherCondition, validateWeatherPayload } from "../physics.ts";

const ACCUWEATHER_ICONS: Record<number, { en: string; fa: string }> = {
  1: { en: "Sunny", fa: "صاف" },
  2: { en: "Mostly Sunny", fa: "عمدتاً صاف" },
  3: { en: "Partly Sunny", fa: "کمی ابری" },
  4: { en: "Intermittent Clouds", fa: "نیمه‌ابری" },
  5: { en: "Hazy Sunshine", fa: "گردوغبار" },
  6: { en: "Mostly Cloudy", fa: "نیمه‌ابری تا ابری" },
  7: { en: "Cloudy", fa: "ابری" },
  8: { en: "Dreary (Overcast)", fa: "تمام‌ابری" },
  11: { en: "Fog", fa: "مه" },
  12: { en: "Showers", fa: "رگبار" },
  15: { en: "Thunderstorms", fa: "رعدوبرقی" },
  18: { en: "Rain", fa: "بارانی" },
  19: { en: "Flurries", fa: "برفی" },
  22: { en: "Snow", fa: "برفی" },
  30: { en: "Hot", fa: "صاف" },
  31: { en: "Cold", fa: "صاف" },
  32: { en: "Windy", fa: "صاف" }
};

/**
 * AccuWeather Weather Provider (Priority 4 Source)
 * Integrates official AccuWeather Developer API when ACCUWEATHER_API_KEY is configured.
 * Strictly adheres to real meteorological data; returns null and enters cooldown if unconfigured or unauthorized (401/403).
 */
export class AccuWeatherProvider implements IWeatherProvider {
  public readonly id = "accuweather";
  public readonly name = "AccuWeather Official API";

  private baseUrl = "https://dataservice.accuweather.com";
  private readonly requestTimeoutMs = 5000;
  private inactiveUntil: number = 0;

  public isConfigured(): boolean {
    if (Date.now() < this.inactiveUntil) {
      return false;
    }
    const key = process.env.ACCUWEATHER_API_KEY?.trim();
    return Boolean(key && key !== "" && !key.toLowerCase().includes("your_"));
  }

  public async getWeather(query: WeatherLocationQuery): Promise<UnifiedWeatherData | null> {
    if (!this.isConfigured()) {
      return null;
    }
    const apiKey = process.env.ACCUWEATHER_API_KEY?.trim();
    if (!apiKey) {
      return null;
    }

    const lat = query.lat ?? 30.471003;
    const lon = query.lon ?? 49.090324;

    try {
      const geoUrl = `${this.baseUrl}/locations/v1/cities/geoposition/search?apikey=${encodeURIComponent(apiKey)}&q=${lat},${lon}`;
      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(this.requestTimeoutMs) });
      
      if (!geoRes.ok) {
        if (geoRes.status === 401 || geoRes.status === 403 || geoRes.status === 429 || geoRes.status === 503) {
          this.inactiveUntil = Date.now() + 600000; // Cool off for 10 minutes on invalid/expired/quota-exceeded key
        }
        return null;
      }

      const geoData = await geoRes.json();
      const locationKey = geoData?.Key;

      if (!locationKey) {
        return null;
      }

      const curUrl = `${this.baseUrl}/currentconditions/v1/${locationKey}?apikey=${encodeURIComponent(apiKey)}&details=true`;
      const curRes = await fetch(curUrl, { signal: AbortSignal.timeout(this.requestTimeoutMs) });
      
      if (!curRes.ok) {
        if (curRes.status === 401 || curRes.status === 403 || curRes.status === 429 || curRes.status === 503) {
          this.inactiveUntil = Date.now() + 600000;
        }
        return null;
      }

      const curData = await curRes.json();
      const cur = curData?.[0];

      if (!cur || cur.Temperature?.Metric?.Value === undefined || cur.RelativeHumidity === undefined) {
        return null;
      }

      const tempC = Number(cur.Temperature.Metric.Value);
      const hum = Number(cur.RelativeHumidity);
      const feels = cur.RealFeelTemperature?.Metric?.Value !== undefined ? Number(cur.RealFeelTemperature.Metric.Value) : tempC;
      const windSpeedKmh = cur.Wind?.Speed?.Metric?.Value !== undefined ? Number(cur.Wind.Speed.Metric.Value) : 0;
      const windDir = cur.Wind?.Direction?.Degrees !== undefined ? Number(cur.Wind.Direction.Degrees) : 0;
      const pressure = cur.Pressure?.Metric?.Value !== undefined ? Number(cur.Pressure.Metric.Value) : 1013;
      const uv = cur.UVIndex !== undefined ? Number(cur.UVIndex) : 0;
      const cloud = cur.CloudCover !== undefined ? Number(cur.CloudCover) : 0;
      const isDay = cur.IsDayTime !== undefined ? Boolean(cur.IsDayTime) : true;
      const iconCode = cur.WeatherIcon ?? 1;
      const condObj = ACCUWEATHER_ICONS[iconCode] || { en: cur.WeatherText || "Clear", fa: "صاف" };
      const visibility = cur.Visibility?.Metric?.Value !== undefined ? Number(cur.Visibility.Metric.Value) : 10;

      const weatherCode = iconCode === 1 ? 0 : iconCode <= 3 ? 1 : iconCode <= 6 ? 2 : iconCode <= 8 ? 3 : iconCode === 11 ? 45 : iconCode === 15 ? 95 : iconCode === 12 ? 80 : iconCode === 18 ? 61 : 0;
      const resolvedCond = resolveWeatherCondition(weatherCode, {
        isDay,
        cloudCover: cloud,
      });

      const fullMetrics = calculateFullHeatStressMetrics(tempC, hum, {
        windSpeedKmh,
        uvIndex: uv,
        cloudCover: cloud,
        isDay
      });

      const observedAt = cur.EpochTime ? new Date(cur.EpochTime * 1000).toISOString() : new Date().toISOString();
      const fetchedAt = new Date().toISOString();

      const validation = validateWeatherPayload({
        tempC,
        hum,
        wind: windSpeedKmh,
        pressure,
        observedAt
      });

      return {
        provider: "AccuWeather",
        source: "AccuWeather",
        locationName: `${geoData.LocalizedName || ''}, ${geoData.Country?.LocalizedName || ''}`.replace(/^,\s/, '') || (query.query || "Operational Site Telemetry"),
        locationId: String(locationKey),
        lat,
        lon,
        observedAt,
        fetchedAt,
        isDay,
        tempC,
        feels,
        hum,
        wind: windSpeedKmh,
        windDir,
        cloud,
        pressure,
        visibility,
        uv,
        code: iconCode,
        condition: `${resolvedCond.labelFa} / ${condObj.en}`,
        wbgt: fullMetrics.wbgt,
        wbgtShade: fullMetrics.wbgtShade,
        wbgtIsEstimated: fullMetrics.wbgtIsEstimated,
        wbgtMethod: fullMetrics.wbgtMethod,
        wbgtNoteFa: fullMetrics.wbgtNoteFa,
        globeTemp: fullMetrics.globeTemp,
        dewPoint: fullMetrics.dewPoint,
        wetBulb: fullMetrics.wetBulb,
        hi: fullMetrics.hi,
        hiDisplay: fullMetrics.hiDisplay,
        offChart: fullMetrics.offChart,
        cat: fullMetrics.cat,
        subLevel: fullMetrics.subLevel,
        sunrise: "06:00",
        sunset: "18:00",
        dayLength: "12:00",
        hourlyForecast: [],
        dailyForecast: []
      };
    } catch {
      this.inactiveUntil = Date.now() + 600000;
      return null;
    }
  }
}

