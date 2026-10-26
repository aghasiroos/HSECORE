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
  formatDateKeyInZone,
  resolveSunTimesAndDayLength,
  interpolateMeteorologicalSlot,
  parseAirQualityPayload,
  parseReverseGeocodeLocality,
} from "../timeAndEnrichment.ts";

/**
 * Primary Official Meteorological Provider (Priority 1):
 * Norwegian Meteorological Institute (MET Norway / Yr.no) Locationforecast 2.0 API
 * Synchronized with the user's exact device timestamp and timezone.
 */
export class MetNorwayWeatherProvider implements IWeatherProvider {
  public readonly id = "metno";
  public readonly name = "MET Norway (Yr.no)";

  public isConfigured(): boolean {
    return true;
  }

  public async getWeather(query: WeatherLocationQuery): Promise<UnifiedWeatherData | null> {
    const lat = Number((query.lat ?? 30.471003).toFixed(4));
    const lon = Number((query.lon ?? 49.090324).toFixed(4));
    const { nowMs, nowIso, timeZone } = resolveClientTimeContext(query);
    const encTz = encodeURIComponent(timeZone);

    try {
      const metNoUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
      const suppForecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=apparent_temperature,visibility,uv_index,shortwave_radiation&hourly=precipitation_probability,uv_index,apparent_temperature&daily=sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=${encTz}`;
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi&timezone=${encTz}`;
      const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fa`;

      const [data, suppData, aqData, geoData] = await Promise.all([
        fetch(metNoUrl, {
          headers: {
            "User-Agent": "HSECoreEnterprise/3.2 (https://hsecore.enterprise; hse-telemetry@hsecore.org)",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          signal: AbortSignal.timeout(9000),
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(suppForecastUrl, { signal: AbortSignal.timeout(5000) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(aqUrl, { signal: AbortSignal.timeout(5000) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch(geoUrl, { signal: AbortSignal.timeout(4500) })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      const timeseries = data?.properties?.timeseries;
      if (!Array.isArray(timeseries) || timeseries.length === 0) {
        return null;
      }

      // Locate bracketing hourly slots around exact device clock (t0 <= nowMs <= t1)
      let idx0 = 0;
      for (let i = 0; i < Math.min(timeseries.length - 1, 12); i++) {
        const t0 = new Date(timeseries[i]?.time).getTime();
        const t1 = new Date(timeseries[i + 1]?.time).getTime();
        if (Number.isFinite(t0) && Number.isFinite(t1) && nowMs >= t0 && nowMs <= t1) {
          idx0 = i;
          break;
        }
      }

      const entry0 = timeseries[idx0] || timeseries[0];
      const entry1 = timeseries[idx0 + 1] || entry0;
      const t0Ms = new Date(entry0?.time).getTime() || nowMs;
      const t1Ms = new Date(entry1?.time).getTime() || nowMs;

      const det0 = entry0?.data?.instant?.details;
      const det1 = entry1?.data?.instant?.details || det0;
      if (!det0 || det0.air_temperature === undefined || det0.relative_humidity === undefined) {
        return null;
      }

      // Nearest entry for symbol & discrete wind direction
      const nearestEntry = Math.abs(nowMs - t1Ms) < Math.abs(nowMs - t0Ms) ? entry1 : entry0;
      const nearestIdx = nearestEntry === entry1 ? idx0 + 1 : idx0;

      const next1h = nearestEntry?.data?.next_1_hours || entry0?.data?.next_1_hours;
      const next6h = nearestEntry?.data?.next_6_hours || entry0?.data?.next_6_hours;
      const symbolCode: string =
        next1h?.summary?.symbol_code ||
        next6h?.summary?.symbol_code ||
        "clearsky_day";

      const isDay = !symbolCode.includes("_night") && !symbolCode.includes("_polartwilight");

      // Exact-minute interpolation using the user's device timestamp (nowMs)
      const tempC =
        interpolateMeteorologicalSlot(t0Ms, det0.air_temperature, t1Ms, det1?.air_temperature, nowMs, 1) ??
        Number(det0.air_temperature);
      const hum =
        interpolateMeteorologicalSlot(t0Ms, det0.relative_humidity, t1Ms, det1?.relative_humidity, nowMs, 0) ??
        Number(det0.relative_humidity);
      const windSpeedMs =
        interpolateMeteorologicalSlot(t0Ms, det0.wind_speed ?? 0, t1Ms, det1?.wind_speed ?? 0, nowMs, 2) ??
        Number(det0.wind_speed ?? 0);
      const windSpeedKmh = parseFloat((windSpeedMs * 3.6).toFixed(1));
      const windDir = Number(nearestEntry?.data?.instant?.details?.wind_from_direction ?? det0.wind_from_direction ?? 0);
      const pressure =
        interpolateMeteorologicalSlot(
          t0Ms,
          det0.air_pressure_at_sea_level ?? 1013,
          t1Ms,
          det1?.air_pressure_at_sea_level ?? 1013,
          nowMs,
          1
        ) ?? 1013;
      const cloud =
        interpolateMeteorologicalSlot(
          t0Ms,
          det0.cloud_area_fraction ?? 0,
          t1Ms,
          det1?.cloud_area_fraction ?? 0,
          nowMs,
          0
        ) ?? 0;

      const suppCur = suppData?.current;
      const suppDaily = suppData?.daily;
      const suppHourly = suppData?.hourly;
      const aqParsed = parseAirQualityPayload(aqData);

      const uv =
        det0.ultraviolet_index_clear_sky !== undefined
          ? Number(det0.ultraviolet_index_clear_sky)
          : suppCur?.uv_index !== undefined
          ? Number(suppCur.uv_index)
          : suppDaily?.uv_index_max?.[0] !== undefined
          ? Number(suppDaily.uv_index_max[0])
          : 0;

      const solarRadiationWm2 =
        suppCur?.shortwave_radiation !== undefined ? Number(suppCur.shortwave_radiation) : undefined;

      // Exact live observation timestamp synchronized with the device clock interpolation
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

      const resolvedCond = resolveWeatherCondition(symbolCode, {
        isDay,
        cloudCover: cloud,
        pm10: aqParsed.pm10,
      });

      const feels =
        suppCur?.apparent_temperature !== undefined
          ? Number(suppCur.apparent_temperature)
          : fullMetrics.hi < tempC
          ? tempC
          : fullMetrics.hi;

      const visibilityKm =
        suppCur?.visibility !== undefined && suppCur?.visibility !== null
          ? Math.round((Number(suppCur.visibility) / 1000) * 10) / 10
          : 10;

      // Hourly forecast (next 24 entries starting at current slot, formatted in device timezone)
      const hourlyForecast: HourlyForecastItem[] = timeseries
        .slice(nearestIdx, nearestIdx + 24)
        .map((entry: any, idx: number) => {
          const det = entry?.data?.instant?.details || {};
          const sym =
            entry?.data?.next_1_hours?.summary?.symbol_code ||
            entry?.data?.next_6_hours?.summary?.symbol_code ||
            symbolCode;
          const hIsDay = !String(sym).includes("_night") && !String(sym).includes("_polartwilight");
          const hCloud = det.cloud_area_fraction !== undefined ? Number(det.cloud_area_fraction) : undefined;
          const hCond = resolveWeatherCondition(sym, {
            isDay: hIsDay,
            cloudCover: hCloud,
          });
          const hWindKmh = parseFloat((Number(det.wind_speed ?? 0) * 3.6).toFixed(1));
          const hProb =
            entry?.data?.next_1_hours?.details?.probability_of_precipitation !== undefined
              ? Number(entry.data.next_1_hours.details.probability_of_precipitation)
              : suppHourly?.precipitation_probability?.[idx] !== undefined
              ? Number(suppHourly.precipitation_probability[idx])
              : undefined;
          const hUv =
            det.ultraviolet_index_clear_sky !== undefined
              ? Number(det.ultraviolet_index_clear_sky)
              : suppHourly?.uv_index?.[idx] !== undefined
              ? Number(suppHourly.uv_index[idx])
              : undefined;

          return {
            time: formatTimeInZone(entry.time, timeZone),
            tempC: Number(det.air_temperature ?? tempC),
            feelsC:
              suppHourly?.apparent_temperature?.[idx] !== undefined
                ? Number(suppHourly.apparent_temperature[idx])
                : undefined,
            hum: Number(det.relative_humidity ?? hum),
            windSpeed: hWindKmh,
            windDir: det.wind_from_direction !== undefined ? Number(det.wind_from_direction) : undefined,
            precipProb: hProb,
            uvIndex: hUv,
            isDay: hIsDay,
            cloudCover: hCloud,
            symbol: String(hCond.code),
            symbolPhrase: hCond.combinedLabel,
          };
        });

      // Aggregate Daily Forecast by local date in the device's timezone
      const dailyMap = new Map<
        string,
        { temps: number[]; winds: number[]; precip: number; symbols: string[] }
      >();
      for (const entry of timeseries) {
        const dateKey = formatDateKeyInZone(entry.time, timeZone);
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { temps: [], winds: [], precip: 0, symbols: [] });
        }
        const bucket = dailyMap.get(dateKey)!;
        const det = entry?.data?.instant?.details || {};
        if (det.air_temperature !== undefined) bucket.temps.push(Number(det.air_temperature));
        if (det.wind_speed !== undefined) bucket.winds.push(Number(det.wind_speed) * 3.6);
        const p1 = entry?.data?.next_1_hours?.details?.precipitation_amount;
        const p6 = entry?.data?.next_6_hours?.details?.precipitation_amount;
        if (p1 !== undefined) bucket.precip += Number(p1);
        else if (p6 !== undefined) bucket.precip += Number(p6) / 6;
        const sym =
          entry?.data?.next_1_hours?.summary?.symbol_code ||
          entry?.data?.next_6_hours?.summary?.symbol_code;
        if (sym) bucket.symbols.push(sym);
      }

      const dailyForecast: DailyForecastItem[] = Array.from(dailyMap.entries())
        .slice(0, 7)
        .map(([date, bucket], idx) => {
          const maxTempC = bucket.temps.length ? Math.max(...bucket.temps) : tempC;
          const minTempC = bucket.temps.length ? Math.min(...bucket.temps) : tempC;
          const maxWindSpeed = bucket.winds.length
            ? parseFloat(Math.max(...bucket.winds).toFixed(1))
            : windSpeedKmh;
          const daySyms = bucket.symbols.filter((s) => !s.includes("_night"));
          const midSym =
            daySyms[Math.floor(daySyms.length / 2)] ||
            bucket.symbols[Math.floor(bucket.symbols.length / 2)] ||
            symbolCode;
          const dCond = resolveWeatherCondition(midSym, { isDay: true });

          return {
            date,
            maxTempC: parseFloat(maxTempC.toFixed(1)),
            minTempC: parseFloat(minTempC.toFixed(1)),
            precipAccum: parseFloat(bucket.precip.toFixed(1)),
            precipProb:
              suppDaily?.precipitation_probability_max?.[idx] !== undefined
                ? Number(suppDaily.precipitation_probability_max[idx])
                : undefined,
            maxWindSpeed,
            uvIndex:
              suppDaily?.uv_index_max?.[idx] !== undefined
                ? Number(suppDaily.uv_index_max[idx])
                : undefined,
            sunrise: suppDaily?.sunrise?.[idx]
              ? formatTimeInZone(suppDaily.sunrise[idx], timeZone)
              : undefined,
            sunset: suppDaily?.sunset?.[idx]
              ? formatTimeInZone(suppDaily.sunset[idx], timeZone)
              : undefined,
            symbol: String(dCond.code),
            symbolPhrase: dCond.combinedLabel,
          };
        });

      const rainAmount =
        next1h?.details?.precipitation_amount !== undefined
          ? Number(next1h.details.precipitation_amount)
          : next6h?.details?.precipitation_amount !== undefined
          ? Number(next6h.details.precipitation_amount)
          : 0;

      const currentRainProb =
        hourlyForecast.length > 0 && hourlyForecast[0].precipProb !== undefined
          ? hourlyForecast[0].precipProb
          : suppDaily?.precipitation_probability_max?.[0] !== undefined
          ? Number(suppDaily.precipitation_probability_max[0])
          : rainAmount > 0
          ? 80
          : 0;

      const { sunrise, sunset, dayLength } = resolveSunTimesAndDayLength(
        suppDaily?.sunrise?.[0],
        suppDaily?.sunset?.[0],
        lat,
        lon,
        timeZone,
        new Date(nowMs)
      );

      const coordinates = data?.geometry?.coordinates;
      const elevation = Array.isArray(coordinates) && coordinates.length >= 3 ? Number(coordinates[2]) : 0;
      const locationName = parseReverseGeocodeLocality(geoData, query.query);

      return {
        provider: "MET Norway (Yr.no)",
        source: "MET Norway (Yr.no)",
        locationName,
        locationId: query.locationId,
        lat,
        lon,
        observedAt,
        fetchedAt,
        tempC,
        hum,
        wind: windSpeedKmh,
        windDir,
        cloud,
        feels,
        pressure,
        visibility: visibilityKm,
        uv,
        solarRadiation: solarRadiationWm2 ?? fullMetrics.solarRadiationWm2,
        isDay,
        code: resolvedCond.code,
        condition: resolvedCond.combinedLabel,
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
        elevation,
        rainProb: currentRainProb,
        rainAmount,
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
