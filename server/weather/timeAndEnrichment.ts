import { WeatherLocationQuery } from "./types.ts";

export interface ClientTimeContext {
  nowMs: number;
  nowIso: string;
  timeZone: string;
}

/**
 * Validates and resolves the exact device timestamp and IANA timezone sent by the client,
 * falling back to Asia/Tehran for Iranian coordinates or UTC if unspecified.
 */
export function resolveClientTimeContext(query: WeatherLocationQuery): ClientTimeContext {
  const serverNow = Date.now();
  // Accept clientTs if within ±24 hours of server UTC clock (guards against malformed values while honoring device time)
  const nowMs =
    typeof query.clientTs === "number" &&
    Number.isFinite(query.clientTs) &&
    Math.abs(query.clientTs - serverNow) < 86400000
      ? query.clientTs
      : serverNow;

  let timeZone = "Asia/Tehran";
  if (query.clientTz && typeof query.clientTz === "string") {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: query.clientTz });
      timeZone = query.clientTz;
    } catch {
      timeZone = "Asia/Tehran";
    }
  } else if (
    query.lat !== undefined &&
    query.lon !== undefined &&
    (query.lat < 24 || query.lat > 40 || query.lon < 44 || query.lon > 64)
  ) {
    timeZone = "UTC";
  }

  return {
    nowMs,
    nowIso: new Date(nowMs).toISOString(),
    timeZone,
  };
}

/**
 * Formats an ISO timestamp or local date-time string into HH:mm using the device's exact timezone.
 */
export function formatTimeInZone(input: string | number | Date, timeZone: string): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.trim())) {
    // Already local ISO from Open-Meteo with timezone applied: extract HH:mm directly
    return input.trim().slice(11, 16);
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "--:--";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

/**
 * Formats an ISO timestamp into YYYY-MM-DD in the device's exact timezone.
 */
export function formatDateKeyInZone(input: string | number | Date, timeZone: string): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().split("T")[0];
  }
}

/**
 * Computes astronomical sunrise, sunset, and day length for given coordinates and timezone
 * when provider daily sunrise/sunset fields are unavailable.
 */
export function computeAstronomicalSunTimes(
  lat: number,
  lon: number,
  date = new Date()
): { sunrise: string; sunset: string; dayLength: string } {
  try {
    const rad = Math.PI / 180;
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
    const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
    const decl = 23.45 * Math.sin(rad * ((360 / 365) * (dayOfYear - 81)));
    const cosH = -Math.tan(lat * rad) * Math.tan(decl * rad);
    if (cosH < -1 || cosH > 1) {
      return { sunrise: "06:00", sunset: "18:00", dayLength: "12h 0m" };
    }
    const H = Math.acos(cosH) / rad;
    const dayHours = (2 * H) / 15;
    const tzOffset = lon >= 44 && lon <= 63 && lat >= 25 && lat <= 40 ? 3.5 : Math.round(lon / 15);
    const solarNoon = 12 + tzOffset - lon / 15;
    const riseH = solarNoon - dayHours / 2;
    const setH = solarNoon + dayHours / 2;
    const fmt = (h: number) => {
      const norm = ((h % 24) + 24) % 24;
      const hh = Math.floor(norm);
      const mm = Math.round((norm - hh) * 60) % 60;
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };
    const dH = Math.floor(dayHours);
    const dM = Math.round((dayHours - dH) * 60);
    return { sunrise: fmt(riseH), sunset: fmt(setH), dayLength: `${dH}h ${dM}m` };
  } catch {
    return { sunrise: "06:00", sunset: "18:00", dayLength: "12h 0m" };
  }
}

/**
 * Unified parser for sunrise, sunset, and dayLength across providers.
 */
export function resolveSunTimesAndDayLength(
  sunriseRaw: string | undefined,
  sunsetRaw: string | undefined,
  lat: number,
  lon: number,
  timeZone: string,
  refDate: Date
): { sunrise: string; sunset: string; dayLength: string } {
  if (sunriseRaw && sunsetRaw) {
    const sunrise = formatTimeInZone(sunriseRaw, timeZone);
    const sunset = formatTimeInZone(sunsetRaw, timeZone);
    const [rH, rM] = sunrise.split(":").map(Number);
    const [sH, sM] = sunset.split(":").map(Number);
    if (Number.isFinite(rH) && Number.isFinite(rM) && Number.isFinite(sH) && Number.isFinite(sM)) {
      const diffMinsTotal = sH * 60 + sM - (rH * 60 + rM);
      if (diffMinsTotal > 0) {
        const diffHours = Math.floor(diffMinsTotal / 60);
        const diffMins = diffMinsTotal % 60;
        return { sunrise, sunset, dayLength: `${diffHours}h ${diffMins}m` };
      }
    }
    return { sunrise, sunset, dayLength: "--" };
  }
  return computeAstronomicalSunTimes(lat, lon, refDate);
}

/**
 * Linearly interpolates meteorological readings between two bracketing hourly slots
 * for the exact timestamp of the user's device clock.
 */
export function interpolateMeteorologicalSlot(
  t0Ms: number,
  v0: number | undefined,
  t1Ms: number,
  v1: number | undefined,
  targetMs: number,
  decimals = 1
): number | undefined {
  if (v0 === undefined && v1 === undefined) return undefined;
  if (v0 !== undefined && (v1 === undefined || t1Ms <= t0Ms || targetMs <= t0Ms)) {
    return Number(v0.toFixed(decimals));
  }
  if (v1 !== undefined && (v0 === undefined || targetMs >= t1Ms)) {
    return Number(v1.toFixed(decimals));
  }
  const ratio = Math.max(0, Math.min(1, (targetMs - t0Ms) / (t1Ms - t0Ms)));
  const interpolated = Number(v0) + (Number(v1) - Number(v0)) * ratio;
  return Number(interpolated.toFixed(decimals));
}

export interface ParsedAirQuality {
  aqi?: number;
  pm25?: number;
  pm10?: number;
  co?: number;
  so2?: number;
  no2?: number;
  o3?: number;
}

/**
 * Shared parser for Open-Meteo Air Quality payload.
 */
export function parseAirQualityPayload(aqData: any): ParsedAirQuality {
  const curAq = aqData?.current;
  if (!curAq) return {};
  return {
    aqi:
      curAq.us_aqi !== undefined
        ? Number(curAq.us_aqi)
        : curAq.european_aqi !== undefined
        ? Number(curAq.european_aqi)
        : undefined,
    pm25: curAq.pm2_5 !== undefined ? Number(curAq.pm2_5) : undefined,
    pm10: curAq.pm10 !== undefined ? Number(curAq.pm10) : undefined,
    co: curAq.carbon_monoxide !== undefined ? Number(curAq.carbon_monoxide) : undefined,
    so2: curAq.sulphur_dioxide !== undefined ? Number(curAq.sulphur_dioxide) : undefined,
    no2: curAq.nitrogen_dioxide !== undefined ? Number(curAq.nitrogen_dioxide) : undefined,
    o3: curAq.ozone !== undefined ? Number(curAq.ozone) : undefined,
  };
}

/**
 * Shared parser for BigDataCloud reverse-geocode payload.
 */
export function parseReverseGeocodeLocality(geoData: any, fallbackQuery?: string): string {
  if (geoData && (geoData.city || geoData.locality || geoData.countryName)) {
    const formatted = `${geoData.city || geoData.locality || ""}${
      geoData.countryName ? ", " + geoData.countryName : ""
    }`.replace(/^,\s/, "");
    if (formatted.trim().length > 0) return formatted.trim();
  }
  return fallbackQuery || "ایستگاه پایش هواشناسی";
}
