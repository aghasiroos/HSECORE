/**
 * Canonical Atmospheric & Industrial Heat Stress Physics Engine
 * Shared between Server and Client for 100% calculation consistency and zero code duplication.
 *
 * Implements:
 * 1. Dew Point: WMO Alduchov-Eskridge Magnus-Tetens Equation
 * 2. Psychrometric Wet Bulb: Stull (2011) formula bounded to [T_d, T_a]
 * 3. 150mm Black Globe Temp & Natural Wet Bulb: ISO 7243 with 2m wind & solar irradiance
 * 4. ISO 7243 Outdoor & Indoor WBGT
 * 5. OSHA / Fluor Industrial Heat Index Matrix with Bilinear Interpolation & Rothfusz regression
 * 6. Staleness and telemetry age detection
 */

export type HeatStressCategory = 'Normal' | 'Caution' | 'ExtremeCaution' | 'Danger' | 'ExtremeDanger' | 'StopWork';

export interface ThermalPhysicsOptions {
  windSpeedKmh?: number;
  solarRadiationWm2?: number;
  uvIndex?: number;
  cloudCover?: number;
  isDay?: boolean;
}

export type WbgtCalculationMethod =
  | 'ISO_7243_OUTDOOR_SOLAR_ESTIMATE'
  | 'ISO_7243_SHADED_PSYCHROMETRIC_ESTIMATE';

export interface ThermalPhysicsData {
  dewPoint: number;
  wetBulb: number;
  globeTemp: number;
  wbgt: number;
  wbgtShade: number;
  solarRadiationWm2: number;
  wbgtIsEstimated: boolean;
  wbgtMethod: WbgtCalculationMethod;
  wbgtNoteFa: string;
  wbgtNoteEn: string;
}

export interface FullHeatStressMetrics extends ThermalPhysicsData {
  hi: number;
  hiDisplay: string;
  offChart: boolean;
  cat: HeatStressCategory;
  subLevel: 'Danger1' | 'Danger2' | null;
}

export type WeatherVisualKey =
  | 'sunny'
  | 'clear-night'
  | 'mostly-clear-day'
  | 'mostly-clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'mostly-cloudy'
  | 'cloudy'
  | 'overcast'
  | 'drizzle'
  | 'rain'
  | 'showers'
  | 'thunderstorm'
  | 'snow'
  | 'fog'
  | 'dust';

export interface WeatherConditionOptions {
  isDay?: boolean;
  cloudCover?: number;
  pm10?: number;
  visibilityKm?: number;
}

export interface ResolvedWeatherCondition {
  code: number;
  iconKey: WeatherVisualKey;
  emoji: string;
  labelFa: string;
  labelEn: string;
  combinedLabel: string;
  isNight: boolean;
}

// --- Official OSHA / Fluor Industrial Heat Index Reference Matrix (°C) ---
export const OFF_CHART = '>54';
export const RH_COLS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
export const HI_TABLE: { [temp: number]: (number | string)[] } = {
  50: [44, 52, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  49: [43, 51, 54, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  48: [43, 50, 52, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  47: [42, 48, 52, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  46: [41, 47, 50, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  45: [41, 46, 50, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  44: [40, 45, 49, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  43: [39, 44, 48, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  42: [38, 43, 46, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  41: [38, 41, 46, 52, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  40: [37, 40, 42, 49, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  39: [36, 38, 42, 47, 52, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  38: [35, 37, 41, 43, 49, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  37: [34, 36, 38, 41, 43, OFF_CHART, OFF_CHART, OFF_CHART, OFF_CHART],
  36: [33, 35, 37, 40, 42, 49, 53, OFF_CHART, OFF_CHART],
  35: [32, 34, 36, 39, 42, 46, 52, OFF_CHART, OFF_CHART],
  34: [32, 34, 35, 38, 41, 44, 50, 53, OFF_CHART],
  33: [31, 32, 33, 36, 38, 41, 46, 50, 53],
  32: [29, 31, 32, 33, 36, 38, 43, 46, 50],
  31: [28, 30, 31, 32, 34, 35, 38, 41, 46],
  30: [27, 29, 29, 31, 32, 33, 36, 38, 43],
  29: [26, 27, 28, 29, 30, 32, 32, 35, 37],
  28: [25, 26, 27, 27, 29, 29, 32, 33, 35],
  27: [25, 26, 26, 27, 28, 29, 30, 32, 32],
  26: [22, 24, 25, 25, 26, 27, 27, 28, 29],
};

export const T_ROWS = Object.keys(HI_TABLE).map(Number).sort((a, b) => a - b);
export const T_MIN = T_ROWS[0];
export const T_MAX = T_ROWS[T_ROWS.length - 1];
export const RH_MIN = RH_COLS[0];
export const RH_MAX = RH_COLS[RH_COLS.length - 1];

/**
 * NOAA / NWS Rothfusz Regression Heat Index Equation (°C)
 * Used for continuous physical evaluation and high-humidity (>90%) / boundary interpolation.
 */
export function calculateHeatIndex(tC: number, rh: number): { hiC: number; offChart: boolean } {
  const safeT = Number.isFinite(tC) ? tC : 0;
  const clampedRh = Math.max(0, Math.min(100, Number.isFinite(rh) ? rh : 0));
  const tF = (safeT * 9) / 5 + 32;

  if (tF < 80) {
    // Steadman simple formula for moderate temperatures (< 26.7°C)
    const simpleHiF = 0.5 * (tF + 61.0 + (tF - 68.0) * 1.2 + clampedRh * 0.094);
    const simpleHiC = ((simpleHiF - 32) * 5) / 9;
    return {
      hiC: parseFloat(simpleHiC.toFixed(1)),
      offChart: false,
    };
  }

  // Full Rothfusz regression equation
  let hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * clampedRh -
    0.22475541 * tF * clampedRh -
    0.00683783 * tF * tF -
    0.05481717 * clampedRh * clampedRh +
    0.00122874 * tF * tF * clampedRh +
    0.00085282 * tF * clampedRh * clampedRh -
    0.00000199 * tF * tF * clampedRh * clampedRh;

  // NWS Low-humidity adjustment
  if (clampedRh < 13 && tF >= 80 && tF <= 112) {
    const insideSqrt = Math.max(0, (17 - Math.abs(tF - 95)) / 17);
    const adj = ((13 - clampedRh) / 4) * Math.sqrt(insideSqrt);
    hiF -= adj;
  } else if (clampedRh > 85 && tF >= 80 && tF <= 87) {
    // NWS High-humidity adjustment
    const adj = ((clampedRh - 85) / 10) * ((87 - tF) / 5);
    hiF += adj;
  }

  const hiC = ((hiF - 32) * 5) / 9;
  const offChart = hiC >= 54;

  return {
    hiC: parseFloat(hiC.toFixed(1)),
    offChart,
  };
}

/**
 * Resolves a numeric value for a single cell (t, rh) in the OSHA/Fluor matrix.
 */
function resolveMatrixCornerValue(t: number, rhCol: number): number {
  const rIdx = RH_COLS.indexOf(rhCol);
  const raw = HI_TABLE[t]?.[rIdx];
  if (typeof raw === 'number') {
    return raw;
  }
  return Math.max(54, calculateHeatIndex(t, rhCol).hiC);
}

/**
 * Bilinear Heat Index Calculator aligned with the Official OSHA/Fluor Matrix
 * with continuous Rothfusz boundary handling for RH > 90% and partial OFF_CHART brackets.
 */
export function bilinearHeatIndex(
  tempC: number,
  hum: number
): { value: number | null; numericValue: number; offChart: boolean } {
  const safeT = Number.isFinite(tempC) ? tempC : 0;
  const safeRh = Math.max(0, Math.min(100, Number.isFinite(hum) ? hum : 0));

  if (safeT < T_MIN || safeRh < RH_MIN) {
    const rounded = parseFloat(safeT.toFixed(1));
    return { value: rounded, numericValue: rounded, offChart: false };
  }

  if (safeT > T_MAX) {
    const roth = calculateHeatIndex(safeT, safeRh);
    return { value: null, numericValue: Math.max(54, roth.hiC), offChart: true };
  }

  // If humidity exceeds the 90% table column (e.g., 91%–100% in coastal industrial zones)
  if (safeRh > RH_MAX) {
    const at90 = bilinearHeatIndex(safeT, RH_MAX);
    if (at90.offChart) {
      return { value: null, numericValue: at90.numericValue, offChart: true };
    }
    const roth90 = calculateHeatIndex(safeT, RH_MAX).hiC;
    const rothActual = calculateHeatIndex(safeT, safeRh).hiC;
    const increment = Math.max(0, rothActual - roth90);
    const combined = parseFloat(((at90.value ?? safeT) + increment).toFixed(1));
    if (combined >= 54) {
      return { value: null, numericValue: combined, offChart: true };
    }
    return { value: combined, numericValue: combined, offChart: false };
  }

  const Tc = Math.max(T_MIN, Math.min(T_MAX, safeT));
  const R = Math.max(RH_MIN, Math.min(RH_MAX, safeRh));

  let t0 = T_ROWS[0];
  let t1 = T_ROWS[T_ROWS.length - 1];
  for (let i = 0; i < T_ROWS.length - 1; i++) {
    if (Tc >= T_ROWS[i] && Tc <= T_ROWS[i + 1]) {
      t0 = T_ROWS[i];
      t1 = T_ROWS[i + 1];
      break;
    }
  }

  let r0 = RH_COLS[0];
  let r1 = RH_COLS[RH_COLS.length - 1];
  for (let i = 0; i < RH_COLS.length - 1; i++) {
    if (R >= RH_COLS[i] && R <= RH_COLS[i + 1]) {
      r0 = RH_COLS[i];
      r1 = RH_COLS[i + 1];
      break;
    }
  }

  const r0Idx = RH_COLS.indexOf(r0);
  const r1Idx = RH_COLS.indexOf(r1);

  const raw11 = HI_TABLE[t0][r0Idx];
  const raw21 = HI_TABLE[t1][r0Idx];
  const raw12 = HI_TABLE[t0][r1Idx];
  const raw22 = HI_TABLE[t1][r1Idx];

  // If all four surrounding cells are OFF_CHART, result is strictly OFF_CHART
  if (raw11 === OFF_CHART && raw21 === OFF_CHART && raw12 === OFF_CHART && raw22 === OFF_CHART) {
    const roth = calculateHeatIndex(Tc, R);
    return { value: null, numericValue: Math.max(54, roth.hiC), offChart: true };
  }

  // If exact grid point is OFF_CHART
  if (Tc === t0 && R === r0 && raw11 === OFF_CHART) {
    return { value: null, numericValue: Math.max(54, calculateHeatIndex(Tc, R).hiC), offChart: true };
  }

  const q11 = resolveMatrixCornerValue(t0, r0);
  const q21 = resolveMatrixCornerValue(t1, r0);
  const q12 = resolveMatrixCornerValue(t0, r1);
  const q22 = resolveMatrixCornerValue(t1, r1);

  const tx = t1 === t0 ? 0 : (Tc - t0) / (t1 - t0);
  const rx = r1 === r0 ? 0 : (R - r0) / (r1 - r0);
  const top = q11 + (q21 - q11) * tx;
  const bot = q12 + (q22 - q12) * tx;
  const interpolated = parseFloat((top + (bot - top) * rx).toFixed(1));

  if (interpolated >= 54) {
    return { value: null, numericValue: interpolated, offChart: true };
  }

  return { value: interpolated, numericValue: interpolated, offChart: false };
}

export function categorizeHeatStress(hi: number, offChart: boolean): HeatStressCategory {
  if (offChart || hi >= 54) return 'StopWork';
  if (hi >= 50) return 'ExtremeDanger';
  if (hi >= 39) return 'Danger';
  if (hi >= 32) return 'ExtremeCaution';
  if (hi >= 27) return 'Caution';
  return 'Normal';
}

export function getDangerSubLevel(hi: number): 'Danger1' | 'Danger2' | null {
  if (hi >= 50 && hi < 54) return 'Danger2';
  if (hi >= 39 && hi < 50) return 'Danger1';
  return null;
}

/**
 * Maps a HeatStressCategory to its exact row key in the OSHA Preventative Work Practices table
 */
export function getActiveWorkPracticeKey(
  cat: HeatStressCategory | undefined | null
): 'Caution' | 'ExtremeCaution' | 'Danger1' | 'Danger2' | 'StopWork' | null {
  if (!cat || cat === 'Normal') return null;
  if (cat === 'Caution') return 'Caution';
  if (cat === 'ExtremeCaution') return 'ExtremeCaution';
  if (cat === 'Danger') return 'Danger1';
  if (cat === 'ExtremeDanger') return 'Danger2';
  if (cat === 'StopWork') return 'StopWork';
  return null;
}

/**
 * High-Precision Industrial Thermal & ISO 7243 Heat Stress Physics Calculator
 */
export function calculateThermalPhysics(
  t: number,
  rh: number,
  options: ThermalPhysicsOptions = {}
): ThermalPhysicsData {
  const safeT = Number.isFinite(t) ? Math.max(-60, Math.min(65, t)) : 0;
  const clampedRh = Math.max(1, Math.min(100, Number.isFinite(rh) ? rh : 50));

  // 1. Dew Point (WMO Alduchov & Eskridge 1996 Magnus coefficients)
  const a = 17.625;
  const b = 243.04;
  const alpha = (a * safeT) / (b + safeT) + Math.log(clampedRh / 100);
  const rawDewPoint = (b * alpha) / (a - alpha);
  const dewPoint = Math.min(safeT, rawDewPoint);

  // 2. Psychrometric Wet Bulb Temperature (Stull 2011) bounded to [dewPoint, safeT]
  const rawWetBulb =
    safeT * Math.atan(0.151977 * Math.sqrt(clampedRh + 8.313659)) +
    Math.atan(safeT + clampedRh) -
    Math.atan(clampedRh - 1.676331) +
    0.00391838 * Math.pow(clampedRh, 1.5) * Math.atan(0.023101 * clampedRh) -
    4.686035;
  const wetBulb = Math.max(dewPoint, Math.min(safeT, rawWetBulb));

  // 3. Wind speed conversion from 10m meteorological anemometer (km/h) to 2m workplace height (m/s)
  const windKmh = Number.isFinite(options.windSpeedKmh) && options.windSpeedKmh! >= 0 ? options.windSpeedKmh! : 0;
  const wind10mMs = windKmh / 3.6;
  const wind2mMs = Math.max(0.13, wind10mMs * 0.786);

  // 4. Effective Solar Shortwave Irradiance (W/m²)
  let solarWm2 = 0;
  if (options.solarRadiationWm2 !== undefined && Number.isFinite(options.solarRadiationWm2) && options.solarRadiationWm2 >= 0) {
    solarWm2 = options.solarRadiationWm2;
  } else if (options.uvIndex !== undefined && Number.isFinite(options.uvIndex) && options.uvIndex > 0) {
    const isDay = options.isDay !== undefined ? options.isDay : true;
    if (isDay) {
      const cloudFrac = Math.max(0, Math.min(1, (options.cloudCover ?? 0) / 100));
      const cloudAttenuation = 1 - 0.65 * Math.pow(cloudFrac, 2);
      solarWm2 = Math.min(1150, Math.max(0, options.uvIndex * 102 * cloudAttenuation));
    }
  }

  // 5. 150mm Black Globe Temperature (T_g) & Natural Wet Bulb (T_nw)
  const globeDelta =
    solarWm2 > 0
      ? (0.0175 * solarWm2) / (1 + 0.38 * Math.pow(wind2mMs, 0.58))
      : 0;
  const globeTemp = safeT + globeDelta;

  const lowWindFactor = Math.max(0, 1 - Math.min(wind2mMs, 3.0) / 3.0);
  const naturalWetBulbDelta =
    (solarWm2 > 0 ? (0.0022 * solarWm2) / (1 + 0.42 * Math.pow(wind2mMs, 0.58)) : 0) +
    (safeT - wetBulb) * 0.05 * lowWindFactor;
  const naturalWetBulb = Math.min(globeTemp, wetBulb + naturalWetBulbDelta);

  // 6. ISO 7243 WBGT (Meteorological Station Parameter Estimation - Never fabricated as direct physical sensor)
  const wbgtShade = 0.7 * wetBulb + 0.3 * safeT;
  const hasOutdoorSolarParams = solarWm2 > 0;
  const wbgt =
    hasOutdoorSolarParams || lowWindFactor > 0
      ? 0.7 * naturalWetBulb + 0.2 * globeTemp + 0.1 * safeT
      : wbgtShade;

  const wbgtMethod: WbgtCalculationMethod = hasOutdoorSolarParams
    ? 'ISO_7243_OUTDOOR_SOLAR_ESTIMATE'
    : 'ISO_7243_SHADED_PSYCHROMETRIC_ESTIMATE';

  const wbgtNoteFa = hasOutdoorSolarParams
    ? 'تخمین محاسباتی محیط باز (ISO 7243 با تابش خورشید و باد ایستگاه هواشناسی — جایگزین سنسور گوی سیاه محیط کار نیست)'
    : 'تخمین محاسباتی در شرایط سایه/بدون تابش (ISO 7243 بر پایه دما و رطوبت ایستگاه — فاقد پارامتر تابش مستقیم)';

  const wbgtNoteEn = hasOutdoorSolarParams
    ? 'Calculated Outdoor Solar Estimate (ISO 7243 from meteorological station solar/wind — not a physical black-globe sensor)'
    : 'Calculated Shaded Psychrometric Estimate (ISO 7243 from ambient temp/RH — no direct solar radiation input)';

  return {
    dewPoint: parseFloat(dewPoint.toFixed(1)),
    wetBulb: parseFloat(wetBulb.toFixed(1)),
    globeTemp: parseFloat(globeTemp.toFixed(1)),
    wbgt: parseFloat(wbgt.toFixed(1)),
    wbgtShade: parseFloat(wbgtShade.toFixed(1)),
    solarRadiationWm2: Math.round(solarWm2),
    wbgtIsEstimated: true,
    wbgtMethod,
    wbgtNoteFa,
    wbgtNoteEn,
  };
}

/**
 * Unified single-call calculator for both Thermal Physics and OSHA Heat Stress Index
 */
export function calculateFullHeatStressMetrics(
  tempC: number,
  hum: number,
  options: ThermalPhysicsOptions = {}
): FullHeatStressMetrics {
  const thermal = calculateThermalPhysics(tempC, hum, options);
  const hiResult = bilinearHeatIndex(tempC, hum);
  const hi = hiResult.offChart ? Math.max(54, hiResult.numericValue) : (hiResult.value ?? tempC);
  const hiDisplay = hiResult.offChart ? OFF_CHART : hi.toFixed(1);
  const cat = categorizeHeatStress(hi, hiResult.offChart);
  const subLevel = getDangerSubLevel(hi);

  return {
    ...thermal,
    hi: parseFloat(hi.toFixed(1)),
    hiDisplay,
    offChart: hiResult.offChart,
    cat,
    subLevel,
  };
}

/**
 * Resolves exact Persian sky condition phrase, icon key, and emoji based on API weather code,
 * Day/Night status (`isDay`), cloud cover percentage, and particulate dust (`pm10`).
 * Never relies on temperature or static strings.
 */
export function resolveWeatherCondition(
  rawCode: number | string | undefined | null,
  options: WeatherConditionOptions = {}
): ResolvedWeatherCondition {
  const isDay = options.isDay !== undefined ? Boolean(options.isDay) : true;
  const isNight = !isDay;
  const cloud = options.cloudCover !== undefined && Number.isFinite(options.cloudCover) ? Number(options.cloudCover) : undefined;
  const pm10 = options.pm10 !== undefined && Number.isFinite(options.pm10) ? Number(options.pm10) : undefined;

  let code = 0;
  if (typeof rawCode === 'number' && Number.isFinite(rawCode)) {
    code = rawCode;
  } else if (typeof rawCode === 'string') {
    const trimmed = rawCode.trim().toLowerCase();
    if (/^\d+$/.test(trimmed)) {
      code = parseInt(trimmed, 10);
    } else if (trimmed.includes('thunder')) {
      code = 95;
    } else if (trimmed.includes('snow') || trimmed.includes('sleet')) {
      code = 73;
    } else if (trimmed.includes('rainshowers') || trimmed.includes('shower')) {
      code = 80;
    } else if (trimmed.includes('drizzle')) {
      code = 53;
    } else if (trimmed.includes('rain')) {
      code = 63;
    } else if (trimmed.includes('fog')) {
      code = 45;
    } else if (trimmed.includes('dust') || trimmed.includes('sand')) {
      code = 49;
    } else if (trimmed.includes('cloudy') && !trimmed.includes('partly')) {
      code = 3;
    } else if (trimmed.includes('partlycloudy')) {
      code = 2;
    } else if (trimmed.includes('fair')) {
      code = 1;
    } else {
      code = 0;
    }
  }

  // Dust / Sandstorm detection (explicit code 49 or high coarse particulate PM10 >= 150 µg/m³ during non-precipitating sky)
  if (code === 49 || (code <= 3 && pm10 !== undefined && pm10 >= 150)) {
    return {
      code: 49,
      iconKey: 'dust',
      emoji: '🌫️',
      labelFa: 'گردوغبار',
      labelEn: 'Dust & Haze',
      combinedLabel: 'گردوغبار / Dust & Haze',
      isNight,
    };
  }

  // Thunderstorm
  if (code >= 95) {
    const labelFa = code >= 96 ? 'رعدوبرقی همراه با تگرگ' : 'رعدوبرقی';
    const labelEn = code >= 96 ? 'Thunderstorm with Hail' : 'Thunderstorm';
    return {
      code,
      iconKey: 'thunderstorm',
      emoji: '⛈️',
      labelFa,
      labelEn,
      combinedLabel: `${labelFa} / ${labelEn}`,
      isNight,
    };
  }

  // Rain Showers
  if (code >= 80 && code <= 82) {
    const labelFa = code === 82 ? 'رگبار شدید باران' : 'رگبار باران';
    const labelEn = code === 82 ? 'Heavy Rain Showers' : 'Rain Showers';
    return {
      code,
      iconKey: 'showers',
      emoji: '🌦️',
      labelFa,
      labelEn,
      combinedLabel: `${labelFa} / ${labelEn}`,
      isNight,
    };
  }

  // Snow
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return {
      code,
      iconKey: 'snow',
      emoji: '❄️',
      labelFa: 'برفی',
      labelEn: 'Snowy',
      combinedLabel: 'برفی / Snowy',
      isNight,
    };
  }

  // Rain & Drizzle
  if (code >= 51 && code <= 67) {
    const isDrizzle = code <= 57;
    const labelFa = isDrizzle ? 'بارانی (نم‌نم باران)' : code >= 65 ? 'بارانی شدید' : 'بارانی';
    const labelEn = isDrizzle ? 'Light Drizzle' : code >= 65 ? 'Heavy Rain' : 'Rainy';
    return {
      code,
      iconKey: isDrizzle ? 'drizzle' : 'rain',
      emoji: isDrizzle ? '🌦️' : '🌧️',
      labelFa,
      labelEn,
      combinedLabel: `${labelFa} / ${labelEn}`,
      isNight,
    };
  }

  // Fog
  if (code === 45 || code === 48) {
    return {
      code,
      iconKey: 'fog',
      emoji: '🌁',
      labelFa: 'مه‌آلود',
      labelEn: 'Foggy',
      combinedLabel: 'مه‌آلود / Foggy',
      isNight,
    };
  }

  // Overcast / Cloudy (WMO 3)
  if (code === 3) {
    if (cloud !== undefined && cloud >= 92) {
      return {
        code,
        iconKey: 'overcast',
        emoji: '🌥️',
        labelFa: 'تمام‌ابری',
        labelEn: 'Overcast',
        combinedLabel: 'تمام‌ابری / Overcast',
        isNight,
      };
    }
    return {
      code,
      iconKey: 'cloudy',
      emoji: '☁️',
      labelFa: 'ابری',
      labelEn: 'Cloudy',
      combinedLabel: 'ابری / Cloudy',
      isNight,
    };
  }

  // Partly Cloudy (WMO 2)
  if (code === 2) {
    if (cloud !== undefined && cloud >= 68) {
      return {
        code,
        iconKey: 'mostly-cloudy',
        emoji: '🌥️',
        labelFa: 'نیمه‌ابری تا ابری',
        labelEn: 'Mostly Cloudy',
        combinedLabel: 'نیمه‌ابری تا ابری / Mostly Cloudy',
        isNight,
      };
    }
    if (cloud !== undefined && cloud < 35) {
      return {
        code,
        iconKey: isNight ? 'mostly-clear-night' : 'mostly-clear-day',
        emoji: isNight ? '🌙' : '🌤️',
        labelFa: 'کمی ابری',
        labelEn: 'Slight Clouds',
        combinedLabel: 'کمی ابری / Slight Clouds',
        isNight,
      };
    }
    return {
      code,
      iconKey: isNight ? 'partly-cloudy-night' : 'partly-cloudy-day',
      emoji: '⛅',
      labelFa: 'نیمه‌ابری',
      labelEn: 'Partly Cloudy',
      combinedLabel: 'نیمه‌ابری / Partly Cloudy',
      isNight,
    };
  }

  // Mainly Clear / Slight Clouds (WMO 1)
  if (code === 1) {
    if (cloud !== undefined && cloud >= 28) {
      return {
        code,
        iconKey: isNight ? 'mostly-clear-night' : 'mostly-clear-day',
        emoji: isNight ? '🌙' : '🌤️',
        labelFa: 'کمی ابری',
        labelEn: 'Few Clouds',
        combinedLabel: 'کمی ابری / Few Clouds',
        isNight,
      };
    }
    return {
      code,
      iconKey: isNight ? 'mostly-clear-night' : 'mostly-clear-day',
      emoji: isNight ? '🌙' : '🌤️',
      labelFa: 'عمدتاً صاف',
      labelEn: 'Mostly Clear',
      combinedLabel: 'عمدتاً صاف / Mostly Clear',
      isNight,
    };
  }

  // Clear Sky (WMO 0)
  if (cloud !== undefined && cloud >= 20) {
    return {
      code: 1,
      iconKey: isNight ? 'mostly-clear-night' : 'mostly-clear-day',
      emoji: isNight ? '🌙' : '🌤️',
      labelFa: 'عمدتاً صاف',
      labelEn: 'Mostly Clear',
      combinedLabel: 'عمدتاً صاف / Mostly Clear',
      isNight,
    };
  }

  if (isNight) {
    return {
      code: 0,
      iconKey: 'clear-night',
      emoji: '🌙',
      labelFa: 'صاف شبانه',
      labelEn: 'Clear Night',
      combinedLabel: 'صاف شبانه / Clear Night',
      isNight: true,
    };
  }

  return {
    code: 0,
    iconKey: 'sunny',
    emoji: '☀️',
    labelFa: 'صاف (آفتابی)',
    labelEn: 'Sunny / Clear',
    combinedLabel: 'صاف (آفتابی) / Sunny',
    isNight: false,
  };
}

export interface TelemetryValidationResult {
  valid: boolean;
  errors: string[];
  unitsVerified: {
    tempC: '°C';
    hum: '%';
    wind: 'km/h';
    pressure: 'hPa';
    visibility: 'km';
  };
}

/**
 * Validates server-side meteorological response data for physical bounds, unit consistency, and timestamp validity.
 */
export function validateWeatherPayload(data: {
  tempC?: number;
  hum?: number;
  wind?: number;
  pressure?: number;
  observedAt?: string;
}): TelemetryValidationResult {
  const errors: string[] = [];

  if (typeof data.tempC !== 'number' || !Number.isFinite(data.tempC) || data.tempC < -65 || data.tempC > 65) {
    errors.push(`Invalid temperature value: ${data.tempC} (expected °C in [-65, 65])`);
  }
  if (typeof data.hum !== 'number' || !Number.isFinite(data.hum) || data.hum < 0 || data.hum > 100) {
    errors.push(`Invalid relative humidity value: ${data.hum} (expected % in [0, 100])`);
  }
  if (typeof data.wind !== 'number' || !Number.isFinite(data.wind) || data.wind < 0 || data.wind > 400) {
    errors.push(`Invalid wind speed value: ${data.wind} (expected km/h in [0, 400])`);
  }
  if (data.pressure !== undefined && (!Number.isFinite(data.pressure) || data.pressure < 850 || data.pressure > 1100)) {
    errors.push(`Invalid atmospheric pressure: ${data.pressure} (expected hPa in [850, 1100])`);
  }
  if (!data.observedAt || isNaN(new Date(data.observedAt).getTime())) {
    errors.push(`Invalid or missing observation timestamp: ${data.observedAt}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    unitsVerified: {
      tempC: '°C',
      hum: '%',
      wind: 'km/h',
      pressure: 'hPa',
      visibility: 'km',
    },
  };
}

/**
 * Returns the age in minutes of a weather observation or record timestamp.
 */
export function getWeatherRecordAgeMinutes(tsIso?: string | number | null): number | null {
  if (!tsIso) return null;
  const parsed = typeof tsIso === 'number' ? tsIso : new Date(tsIso).getTime();
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / 60000));
}

/**
 * Determines whether a weather record is stale (older than maxAgeMinutes).
 * Standard meteorological stations and global models (MET Norway, Open-Meteo, SYNOP)
 * publish observations on 60-minute synoptic cycles, so 75 minutes is the standard threshold.
 */
export function isWeatherRecordStale(tsIso?: string | number | null, maxAgeMinutes = 75): boolean {
  const age = getWeatherRecordAgeMinutes(tsIso);
  if (age === null) return true;
  return age > maxAgeMinutes;
}
