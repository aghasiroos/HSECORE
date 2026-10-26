export type HeatStressCategory =
  | 'Normal'
  | 'Caution'
  | 'ExtremeCaution'
  | 'Danger'
  | 'ExtremeDanger'
  | 'StopWork';

export interface WeatherLocationQuery {
  lat?: number;
  lon?: number;
  locationId?: string;
  query?: string;
  clientTs?: number;
  clientTz?: string;
  tzOffsetMin?: number;
}

export interface HourlyForecastItem {
  time: string;
  tempC: number;
  feelsC?: number;
  hum: number;
  windSpeed: number;
  windDir?: number;
  precipProb?: number;
  uvIndex?: number;
  isDay?: boolean;
  cloudCover?: number;
  symbol?: string;
  symbolPhrase?: string;
}

export interface DailyForecastItem {
  date: string;
  maxTempC: number;
  minTempC: number;
  maxFeelsC?: number;
  precipAccum?: number;
  precipProb?: number;
  maxWindSpeed?: number;
  uvIndex?: number;
  sunrise?: string;
  sunset?: string;
  symbol?: string;
  symbolPhrase?: string;
}

export interface ThermalPhysicsOptions {
  windSpeedKmh?: number;
  solarRadiationWm2?: number;
  uvIndex?: number;
  cloudCover?: number;
  isDay?: boolean;
}

export interface ThermalPhysicsData {
  dewPoint: number;
  wetBulb: number;
  globeTemp: number;
  wbgt: number;
  wbgtShade: number;
  solarRadiationWm2: number;
  wbgtIsEstimated?: boolean;
  wbgtMethod?: 'ISO_7243_OUTDOOR_SOLAR_ESTIMATE' | 'ISO_7243_SHADED_PSYCHROMETRIC_ESTIMATE';
  wbgtNoteFa?: string;
  wbgtNoteEn?: string;
}

export interface FullHeatStressMetrics extends ThermalPhysicsData {
  hi: number;
  hiDisplay: string;
  offChart: boolean;
  cat: HeatStressCategory;
  subLevel: 'Danger1' | 'Danger2' | null;
}

export interface UnifiedWeatherData {
  provider: string;
  source: string;
  locationName: string;
  locationId?: string;
  lat: number;
  lon: number;
  tempC: number;
  feels: number;
  hum: number;
  wind: number;
  windDir: number;
  windGusts?: number;
  cloud?: number;
  pressure: number;
  surfacePressure?: number;
  visibility?: number;
  uv: number;
  code: number;
  condition: string | null;
  hi: number;
  hiDisplay: string;
  offChart: boolean;
  cat: HeatStressCategory;
  subLevel: 'Danger1' | 'Danger2' | null;
  wbgt: number;
  wbgtShade: number;
  wbgtIsEstimated?: boolean;
  wbgtMethod?: 'ISO_7243_OUTDOOR_SOLAR_ESTIMATE' | 'ISO_7243_SHADED_PSYCHROMETRIC_ESTIMATE';
  wbgtNoteFa?: string;
  wbgtNoteEn?: string;
  globeTemp: number;
  dewPoint: number;
  wetBulb: number;
  solarRadiation?: number;
  isDay?: boolean;
  aqi?: number;
  pm25?: number;
  pm10?: number;
  co?: number;
  so2?: number;
  no2?: number;
  o3?: number;
  elevation?: number;
  rainProb?: number;
  rainAmount?: number;
  sunrise: string;
  sunset: string;
  dayLength: string;
  observedAt: string;
  fetchedAt: string;
  cached?: boolean;
  cacheAgeSeconds?: number;
  cacheExpiresIn?: number;
  hourlyForecast?: HourlyForecastItem[];
  dailyForecast?: DailyForecastItem[];
}

export interface IWeatherProvider {
  readonly id: string;
  readonly name: string;
  isConfigured(): boolean;
  getWeather(query: WeatherLocationQuery): Promise<UnifiedWeatherData | null>;
  searchLocation?(query: string): Promise<any[]>;
}
