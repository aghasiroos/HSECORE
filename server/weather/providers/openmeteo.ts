import {
  IWeatherProvider,
  WeatherLocationQuery,
  UnifiedWeatherData,
  HourlyForecastItem,
  DailyForecastItem,
} from "../types.ts";
import {
  calculateFullHeatStressMetrics,
  resolveWeatherCondition,
  validateWeatherPayload,
} from "../physics.ts";
import {
  resolveClientTimeContext,
  formatTimeInZone,
  resolveSunTimesAndDayLength,
  parseAirQualityPayload,
  parseReverseGeocodeLocality,
} from "../timeAndEnrichment.ts";

export class OpenMeteoWeatherProvider implements IWeatherProvider {
  public readonly id = "openmeteo";
  public readonly name = "Open-Meteo WMO/ECMWF (Official Meteorological API)";

  public isConfigured(): boolean {
    return true;
  }

  public async getWeather(query: WeatherLocationQuery): Promise<UnifiedWeatherData | null> {
    const lat = query.lat ?? 30.471003;
    const lon = query.lon ?? 49.090324;
    const { nowMs, nowIso, timeZone } = resolveClientTimeContext(query);
    const encTz = encodeURIComponent(timeZone);

    try {
      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,pressure_msl,surface_pressure,precipitation,visibility,uv_index,shortwave_radiation,direct_radiation,diffuse_radiation,is_day&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,uv_index,weather_code,cloud_cover,is_day&daily=sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,apparent_temperature_max,wind_speed_10m_max,weather_code&timezone=${encTz}`;
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi&timezone=${encTz}`;
      const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fa`;

      const [weatherData, aqData, geoData] = await Promise.all([
        fetch(openMeteoUrl, { signal: AbortSignal.timeout(9000) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(aqUrl, { signal: AbortSignal.timeout(5000) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(geoUrl, { signal: AbortSignal.timeout(4500) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (!weatherData || !weatherData.current) {
        return null;
      }

      const cur = weatherData.current;
      const daily = weatherData.daily;
      const hourly = weatherData.hourly;
      const aqParsed = parseAirQualityPayload(aqData);

      const tempC = Number(cur.temperature_2m);
      const hum = Number(cur.relative_humidity_2m);
      const feels = cur.apparent_temperature !== undefined ? Number(cur.apparent_temperature) : tempC;
      const windSpeedKmh = Number(cur.wind_speed_10m ?? 0);
      const solarRadiationWm2 =
        cur.shortwave_radiation !== undefined ? Number(cur.shortwave_radiation) : undefined;
      const uv = cur.uv_index !== undefined ? Number(cur.uv_index) : (daily?.uv_index_max?.[0] ?? 0);
      const cloud = Number(cur.cloud_cover ?? 0);
      const isDay = cur.is_day !== undefined ? cur.is_day === 1 : true;
      const pressure = Number(cur.pressure_msl ?? (cur.surface_pressure ?? 1013));
      const observedAt = nowIso;
      const fetchedAt = new Date().toISOString();

      const validation = validateWeatherPayload({
        tempC,
        hum,
        wind: windSpeedKmh,
        pressure,
        observedAt,
      });
      if (!validation.valid) {
        return null;
      }

      const fullMetrics = calculateFullHeatStressMetrics(tempC, hum, {
        windSpeedKmh,
        solarRadiationWm2,
        uvIndex: uv,
        cloudCover: cloud,
        isDay,
      });

      const rawCode = cur.weather_code ?? 0;
      const resolvedCurrentCond = resolveWeatherCondition(rawCode, {
        isDay,
        cloudCover: cloud,
        pm10: aqParsed.pm10,
      });

      const { sunrise, sunset, dayLength } = resolveSunTimesAndDayLength(
        daily?.sunrise?.[0],
        daily?.sunset?.[0],
        lat,
        lon,
        timeZone,
        new Date(nowMs)
      );

      // Map Hourly Forecast starting from current hour in device timezone (next 24 entries)
      const hourlyForecast: HourlyForecastItem[] = [];
      if (hourly?.time && Array.isArray(hourly.time)) {
        const curTimePrefix = typeof cur.time === "string" ? cur.time.slice(0, 13) : "";
        let startIndex = 0;
        if (curTimePrefix) {
          const foundIdx = hourly.time.findIndex((t: string) => t.startsWith(curTimePrefix));
          if (foundIdx >= 0) startIndex = foundIdx;
        }
        for (let i = startIndex; i < Math.min(startIndex + 24, hourly.time.length); i++) {
          const hCode = hourly.weather_code?.[i] ?? 0;
          const hCloud = hourly.cloud_cover?.[i] !== undefined ? Number(hourly.cloud_cover[i]) : undefined;
          const hIsDay = hourly.is_day?.[i] !== undefined ? hourly.is_day[i] === 1 : true;
          const hResolved = resolveWeatherCondition(hCode, {
            isDay: hIsDay,
            cloudCover: hCloud,
          });
          hourlyForecast.push({
            time: formatTimeInZone(hourly.time[i], timeZone),
            tempC: Number(hourly.temperature_2m?.[i] ?? 0),
            feelsC:
              hourly.apparent_temperature?.[i] !== undefined
                ? Number(hourly.apparent_temperature[i])
                : undefined,
            hum: Number(hourly.relative_humidity_2m?.[i] ?? 0),
            windSpeed: Number(hourly.wind_speed_10m?.[i] ?? 0),
            windDir:
              hourly.wind_direction_10m?.[i] !== undefined
                ? Number(hourly.wind_direction_10m[i])
                : undefined,
            precipProb:
              hourly.precipitation_probability?.[i] !== undefined
                ? Number(hourly.precipitation_probability[i])
                : undefined,
            uvIndex: hourly.uv_index?.[i] !== undefined ? Number(hourly.uv_index[i]) : 0,
            isDay: hIsDay,
            cloudCover: hCloud,
            symbol: String(hResolved.code),
            symbolPhrase: hResolved.combinedLabel,
          });
        }
      }

      // Map Daily Forecast (next 7 days)
      const dailyForecast: DailyForecastItem[] = [];
      if (daily?.sunrise && Array.isArray(daily.sunrise)) {
        for (let i = 0; i < Math.min(7, daily.sunrise.length); i++) {
          const dCode = daily.weather_code?.[i] ?? 0;
          const dResolved = resolveWeatherCondition(dCode, { isDay: true });
          dailyForecast.push({
            date: String(daily.sunrise[i]).split("T")[0],
            maxTempC: Number(daily.temperature_2m_max?.[i] ?? 0),
            minTempC: Number(daily.temperature_2m_min?.[i] ?? 0),
            maxFeelsC:
              daily.apparent_temperature_max?.[i] !== undefined
                ? Number(daily.apparent_temperature_max[i])
                : undefined,
            precipAccum:
              daily.precipitation_sum?.[i] !== undefined ? Number(daily.precipitation_sum[i]) : 0,
            precipProb:
              daily.precipitation_probability_max?.[i] !== undefined
                ? Number(daily.precipitation_probability_max[i])
                : undefined,
            maxWindSpeed:
              daily.wind_speed_10m_max?.[i] !== undefined
                ? Number(daily.wind_speed_10m_max[i])
                : undefined,
            uvIndex:
              daily.uv_index_max?.[i] !== undefined ? Number(daily.uv_index_max[i]) : undefined,
            sunrise: daily.sunrise[i] ? formatTimeInZone(daily.sunrise[i], timeZone) : undefined,
            sunset: daily.sunset?.[i] ? formatTimeInZone(daily.sunset[i], timeZone) : undefined,
            symbol: String(dResolved.code),
            symbolPhrase: dResolved.combinedLabel,
          });
        }
      }

      const locationName = parseReverseGeocodeLocality(geoData, query.query);
      const visibilityKm =
        cur.visibility !== undefined && cur.visibility !== null
          ? Math.round((Number(cur.visibility) / 1000) * 10) / 10
          : 10;
      const currentRainProb =
        hourlyForecast.length > 0 && hourlyForecast[0].precipProb !== undefined
          ? hourlyForecast[0].precipProb
          : (daily?.precipitation_probability_max?.[0] ?? 0);

      return {
        provider: "Open-Meteo",
        source: "Open-Meteo (WMO / ECMWF IFS)",
        locationName,
        locationId: query.locationId,
        lat,
        lon,
        observedAt,
        fetchedAt,
        tempC,
        hum,
        wind: windSpeedKmh,
        windDir: cur.wind_direction_10m !== undefined ? Number(cur.wind_direction_10m) : 0,
        cloud,
        feels,
        pressure,
        visibility: visibilityKm,
        uv,
        solarRadiation: solarRadiationWm2,
        isDay,
        code: resolvedCurrentCond.code,
        condition: resolvedCurrentCond.combinedLabel,
        wbgt: fullMetrics.wbgt,
        wbgtShade: fullMetrics.wbgtShade,
        wbgtIsEstimated: fullMetrics.wbgtIsEstimated,
        wbgtMethod: fullMetrics.wbgtMethod,
        wbgtNoteFa: fullMetrics.wbgtNoteFa,
        wbgtNoteEn: fullMetrics.wbgtNoteEn,
        globeTemp: fullMetrics.globeTemp,
        dewPoint: fullMetrics.dewPoint,
        wetBulb: fullMetrics.wetBulb,
        hi: fullMetrics.hi,
        hiDisplay: fullMetrics.hiDisplay,
        offChart: fullMetrics.offChart,
        cat: fullMetrics.cat,
        subLevel: fullMetrics.subLevel,
        ...aqParsed,
        elevation: weatherData.elevation || 0,
        rainProb: currentRainProb,
        rainAmount:
          cur.precipitation !== undefined
            ? Number(cur.precipitation)
            : (daily?.precipitation_sum?.[0] || 0),
        sunrise,
        sunset,
        dayLength,
        hourlyForecast,
        dailyForecast,
      };
    } catch {
      return null;
    }
  }
}
