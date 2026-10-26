import { 
  IWeatherProvider, 
  WeatherLocationQuery, 
  UnifiedWeatherData, 
  HourlyForecastItem, 
  DailyForecastItem 
} from "../types.ts";
import { calculateFullHeatStressMetrics } from "../physics.ts";

interface ForecaTokenCache {
  token: string;
  expiresAt: number;
}

const WMO_CONDITIONS: Record<number, { en: string; fa: string }> = {
  0: { en: "Clear sky", fa: "آسمان کاملاً صاف" },
  1: { en: "Mainly clear", fa: "غالباً صاف" },
  2: { en: "Partly cloudy", fa: "نیمه‌ابری" },
  3: { en: "Overcast", fa: "ابری کامل" },
  45: { en: "Fog", fa: "مه‌آلود" },
  48: { en: "Depositing rime fog", fa: "مه غلیظ و یخبندان" },
  51: { en: "Light drizzle", fa: "نم‌نم باران خفیف" },
  53: { en: "Moderate drizzle", fa: "نم‌نم باران متوسط" },
  55: { en: "Dense drizzle", fa: "نم‌نم باران شدید" },
  61: { en: "Slight rain", fa: "باران ملایم" },
  63: { en: "Moderate rain", fa: "باران متوسط" },
  65: { en: "Heavy rain", fa: "باران شدید" },
  71: { en: "Slight snow", fa: "برف خفیف" },
  73: { en: "Moderate snow", fa: "برف متوسط" },
  75: { en: "Heavy snow", fa: "برف سنگین" },
  80: { en: "Rain showers", fa: "رگبار باران" },
  81: { en: "Moderate rain showers", fa: "رگبار متناوب" },
  82: { en: "Violent rain showers", fa: "رگبار شدید و سیل‌آسا" },
  95: { en: "Thunderstorm", fa: "رعد و برق و طوفان" },
  96: { en: "Thunderstorm with hail", fa: "طوفان همراه با تگرگ" }
};

export class ForecaWeatherProvider implements IWeatherProvider {
  public readonly id = "foreca";
  public readonly name = "Foreca Weather (Primary Source)";

  private baseUrl = "https://weatherapi.foreca.net/api/v1";
  private fallbackBaseUrl = "https://pfa.foreca.com/api/v1";
  private authUrl = "https://pfa.foreca.com/authorize/token";
  private tokenCache: ForecaTokenCache | null = null;
  private inactiveUntil: number = 0;
  private readonly requestTimeoutMs = 3000;

  /**
   * Check if Foreca API provider is configured
   */
  public isConfigured(): boolean {
    if (Date.now() < this.inactiveUntil) {
      return false; // In cooling off period due to expired/inactive account
    }
    return Boolean(
      process.env.FORECA_API_KEY || 
      process.env.FORECA_API_TOKEN || 
      (process.env.FORECA_USER && process.env.FORECA_PASSWORD)
    );
  }

  /**
   * Obtain active Bearer token (from direct token or token authorization endpoint)
   */
  private async getBearerToken(): Promise<string | null> {
    const directToken = process.env.FORECA_API_KEY || process.env.FORECA_API_TOKEN;
    if (directToken) {
      return directToken.trim();
    }

    const user = process.env.FORECA_USER;
    const password = process.env.FORECA_PASSWORD;

    if (!user || !password) {
      return null;
    }

    // Check if cached token is still valid (with 60s buffer)
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAt - 60000) {
      return this.tokenCache.token;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      const response = await fetch(this.authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.inactiveUntil = Date.now() + 600000;
        return null;
      }

      const data = await response.json();
      const token = data.access_token_id || data.access_token || data.token;
      const expiresInSec = data.expires_in || 3600;

      if (!token) {
        this.inactiveUntil = Date.now() + 600000;
        return null;
      }

      this.tokenCache = {
        token,
        expiresAt: now + expiresInSec * 1000
      };

      return token;
    } catch {
      this.inactiveUntil = Date.now() + 600000;
      return null;
    }
  }

  /**
   * Formats location parameter for Foreca API (supports location ID or 'lon,lat')
   */
  private formatLocation(query: WeatherLocationQuery): string {
    if (query.locationId) {
      return query.locationId.trim();
    }
    const lat = query.lat ?? 30.471003;
    const lon = query.lon ?? 49.090324;
    return `${lon.toFixed(4)},${lat.toFixed(4)}`;
  }

  /**
   * Fetches weather telemetry & forecasts from Foreca Developer API
   */
  public async getWeather(query: WeatherLocationQuery): Promise<UnifiedWeatherData | null> {
    const token = await this.getBearerToken();
    if (!token) {
      // Primary source Foreca has no direct credentials configured, gracefully delegate to Open-Meteo (Priority 2)
      return null;
    }

    const locParam = this.formatLocation(query);
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    };

    try {
      // 1. Fetch Current Conditions
      const currentUrl = `${this.baseUrl}/current/${locParam}?windSpeedUnit=kmh&tempUnit=C`;
      // 2. Fetch Daily Forecast
      const dailyUrl = `${this.baseUrl}/forecast/daily/${locParam}?windSpeedUnit=kmh&tempUnit=C&dataset=full`;
      // 3. Fetch Hourly Forecast
      const hourlyUrl = `${this.baseUrl}/forecast/hourly/${locParam}?windSpeedUnit=kmh&tempUnit=C&dataset=full`;
      // 4. Reverse geocode location name
      const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${query.lat ?? 30.471003}&longitude=${query.lon ?? 49.090324}&localityLanguage=en`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      const [curRes, dailyRes, hourlyRes, geoRes] = await Promise.all([
        fetch(currentUrl, { headers, signal: controller.signal }).catch(() => null),
        fetch(dailyUrl, { headers, signal: controller.signal }).catch(() => null),
        fetch(hourlyUrl, { headers, signal: controller.signal }).catch(() => null),
        fetch(geoUrl, { signal: controller.signal }).catch(() => null)
      ]);

      clearTimeout(timeoutId);

      if (!curRes || !curRes.ok) {
        if (curRes?.status === 401 || curRes?.status === 403) {
          this.tokenCache = null;
          this.inactiveUntil = Date.now() + 600000; // Cool off for 10 minutes
        }
        return null;
      }

      const curJson = await curRes.json();
      const cur = curJson?.current;
      if (!cur || cur.temperature === undefined || cur.relHumidity === undefined) {
        return null;
      }

      const dailyJson = (dailyRes && dailyRes.ok) ? await dailyRes.json() : null;
      const hourlyJson = (hourlyRes && hourlyRes.ok) ? await hourlyRes.json() : null;
      const geoJson = (geoRes && geoRes.ok) ? await geoRes.json() : null;

      const tempC = Number(cur.temperature);
      const feels = cur.feelsLike !== undefined ? Number(cur.feelsLike) : tempC;
      const hum = Number(cur.relHumidity);
      const wind = Number(cur.windSpeed ?? 0);
      const windDir = Number(cur.windDir ?? 0);
      const pressure = Number(cur.pressure ?? 1013);
      const cloud = Number(cur.cloudiness ?? 0);
      const uv = Number(cur.uvIndex ?? 0);
      
      let visibility = 10;
      if (cur.visibility !== undefined) {
        visibility = cur.visibility > 100 ? Math.round(cur.visibility / 1000) : Number(cur.visibility);
      }

      const fullMetrics = calculateFullHeatStressMetrics(tempC, hum, {
        windSpeedKmh: wind,
        uvIndex: uv,
        cloudCover: cloud
      });

      const todayForecast = dailyJson?.forecast?.[0];
      const sunrise = todayForecast?.sunrise || "--:--";
      const sunset = todayForecast?.sunset || "--:--";

      let dayLength = "--";
      if (sunrise !== "--:--" && sunset !== "--:--") {
        const [rHour, rMin] = sunrise.split(":").map(Number);
        const [sHour, sMin] = sunset.split(":").map(Number);
        if (!isNaN(rHour) && !isNaN(sHour)) {
          let mins = (sHour * 60 + sMin) - (rHour * 60 + rMin);
          if (mins < 0) mins += 1440;
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          dayLength = `${h}h ${m}m`;
        }
      }

      const hourlyForecast: HourlyForecastItem[] = [];
      if (hourlyJson?.forecast && Array.isArray(hourlyJson.forecast)) {
        for (const h of hourlyJson.forecast.slice(0, 24)) {
          hourlyForecast.push({
            time: h.time ? h.time.split("T")[1]?.slice(0, 5) || h.time : "--",
            tempC: Number(h.temperature ?? tempC),
            feelsC: h.feelsLike !== undefined ? Number(h.feelsLike) : undefined,
            hum: Number(h.relHumidity ?? hum),
            windSpeed: Number(h.windSpeed ?? wind),
            windDir: h.windDir !== undefined ? Number(h.windDir) : undefined,
            precipProb: h.precipProb !== undefined ? Number(h.precipProb) : 0,
            uvIndex: h.uvIndex !== undefined ? Number(h.uvIndex) : 0,
            symbolPhrase: h.symbolPhrase
          });
        }
      }

      const dailyForecast: DailyForecastItem[] = [];
      if (dailyJson?.forecast && Array.isArray(dailyJson.forecast)) {
        for (const d of dailyJson.forecast.slice(0, 7)) {
          dailyForecast.push({
            date: d.date || "",
            maxTempC: Number(d.maxTemp ?? tempC),
            minTempC: Number(d.minTemp ?? tempC),
            maxFeelsC: d.maxFeelsLike !== undefined ? Number(d.maxFeelsLike) : undefined,
            precipAccum: d.precipAccum !== undefined ? Number(d.precipAccum) : 0,
            precipProb: d.precipProb !== undefined ? Number(d.precipProb) : 0,
            maxWindSpeed: d.maxWindSpeed !== undefined ? Number(d.maxWindSpeed) : undefined,
            uvIndex: d.uvIndex !== undefined ? Number(d.uvIndex) : undefined,
            sunrise: d.sunrise,
            sunset: d.sunset,
            symbolPhrase: d.symbolPhrase
          });
        }
      }

      const locationName = geoJson 
        ? `${geoJson.city || geoJson.locality || ''}${geoJson.countryName ? ', ' + geoJson.countryName : ''}`.replace(/^,\s/, '')
        : (query.query || "Operational Site Telemetry");

      const rawPhrase = cur.symbolPhrase || "Clear";
      const faPhrase = WMO_CONDITIONS[cur.symbolCode]?.fa || rawPhrase;
      const conditionStr = `${faPhrase} / ${rawPhrase}`;

      const observedAt = cur.time ? new Date(cur.time).toISOString() : new Date().toISOString();
      const fetchedAt = new Date().toISOString();

      return {
        provider: "Foreca Weather (Primary Source)",
        source: "Foreca Weather",
        locationName: locationName || "Foreca Live Station",
        locationId: query.locationId,
        lat: query.lat ?? 30.471003,
        lon: query.lon ?? 49.090324,
        observedAt,
        fetchedAt,
        tempC,
        feels,
        hum,
        wind,
        windDir,
        cloud,
        pressure,
        visibility,
        uv,
        code: cur.symbolCode || 0,
        condition: conditionStr,
        wbgt: fullMetrics.wbgt,
        wbgtShade: fullMetrics.wbgtShade,
        globeTemp: fullMetrics.globeTemp,
        dewPoint: fullMetrics.dewPoint,
        wetBulb: fullMetrics.wetBulb,
        hi: fullMetrics.hi,
        hiDisplay: fullMetrics.hiDisplay,
        offChart: fullMetrics.offChart,
        cat: fullMetrics.cat,
        subLevel: fullMetrics.subLevel,
        aqi: cur.aqi || cur.airQualityIndex,
        rainProb: cur.precipProb ?? todayForecast?.precipProb ?? 0,
        rainAmount: cur.precipRate ?? todayForecast?.precipAccum ?? 0,
        sunrise,
        sunset,
        dayLength,
        hourlyForecast,
        dailyForecast
      };

    } catch {
      this.inactiveUntil = Date.now() + 600000;
      return null;
    }
  }
}
