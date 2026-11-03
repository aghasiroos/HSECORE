import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search,
  MapPin,
  RefreshCw,
  Droplets,
  Wind,
  Sun,
  Eye,
  Gauge,
  CloudRain,
  Sunrise,
  Sunset,
  AlertTriangle,
  Thermometer,
  Activity,
  Cloud,
  CloudSun,
  CloudMoon,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  CloudFog,
  Moon,
  Umbrella,
  Compass,
  Clock,
  ShieldAlert,
  ArrowUpLeft,
  WifiOff,
  CheckCircle2,
  Globe,
  Layers,
  Check,
  XCircle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { HeatRecord, WeatherInfo, HourlyForecastItem, DailyForecastItem } from '../types';
import {
  isWeatherRecordStale,
  getWeatherRecordAgeMinutes,
  resolveWeatherCondition,
  calculateFullHeatStressMetrics
} from '../utils/weatherPhysics';
import { gregorianToJalali } from '../utils/jalaliDate';

export interface IndustrialSiteOption {
  name: string;
  nameFa: string;
  lat: number;
  lon: number;
}

export interface WeatherDashboardViewProps {
  weatherInfo: WeatherInfo | null;
  activeRecord: HeatRecord | null;
  isFa: boolean;
  isLoading: boolean;
  weatherError: string | null;
  searchQuery: string;
  suggestions: any[];
  gpsLoading: boolean;
  industrialSites: IndustrialSiteOption[];
  refreshMinutes?: number;
  secondsLeft?: number;
  onSearchChange: (q: string) => void;
  onSelectSuggestion: (s: any) => void;
  onLocateGps: () => void;
  onLocateInternet?: () => void;
  onSelectSite: (lat: number, lon: number, label: string) => void;
  onRefresh: () => void;
  onSwitchToHeatStressTab: () => void;
  onSwitchToGisMapTab: () => void;
  persianDateStr: string;
  categoryInfo: {
    name: string;
    risk: string;
    color: string;
    recos: string[];
  };
}

interface CityLiveSummary extends IndustrialSiteOption {
  tempC?: number;
  condition?: string;
  code?: number;
  isDay?: boolean;
  cloud?: number;
  pm10?: number;
  hum?: number;
  loading: boolean;
  error: boolean;
}

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return [jy, jm, jd];
}

export function getPersianDateString(date: Date): string {
  const [jy, jm, jd] = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
}

function formatForecastDateLabel(dateStr: string, index: number, isFa: boolean): string {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    if (index === 0) return isFa ? 'امروز' : 'Today';
    if (index === 1) return isFa ? 'فردا' : 'Tomorrow';
    return dateStr;
  }
  const dayOfWeek = parsed.getDay();
  if (isFa) {
    const [, jm, jd] = toJalali(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    const weekday = index === 0 ? 'امروز' : index === 1 ? 'فردا' : PERSIAN_WEEKDAYS[dayOfWeek];
    return `${jd} ${JALALI_MONTHS[jm - 1]}، ${weekday}`;
  } else {
    const monthShort = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekday = index === 0 ? 'Today' : EN_WEEKDAYS[dayOfWeek];
    return `${monthShort}, ${weekday}`;
  }
}

export function extractLocalizedCondition(
  rawCondition: string | undefined,
  code: number | string | undefined,
  isFa: boolean,
  options: { isDay?: boolean; cloudCover?: number; pm10?: number } = {}
): string {
  const resolved = resolveWeatherCondition(code ?? 0, options);
  if (rawCondition && rawCondition.includes('/')) {
    const parts = rawCondition.split('/').map(s => s.trim());
    const hasPersianFirst = /[\u0600-\u06FF]/.test(parts[0]);
    if (isFa) return hasPersianFirst ? parts[0] : (parts[1] || resolved.labelFa);
    return hasPersianFirst ? (parts[1] || resolved.labelEn) : parts[0];
  }
  return isFa ? resolved.labelFa : resolved.labelEn;
}

function getWindDirectionText(deg: number | undefined, isFa: boolean): string {
  if (deg === undefined || isNaN(deg)) return '—';
  const dirsFa = ['شمال', 'شمال‌شرق', 'شرق', 'جنوب‌شرق', 'جنوب', 'جنوب‌غرب', 'غرب', 'شمال‌غرب'];
  const dirsEn = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 45) % 8;
  return isFa ? `${dirsFa[idx]} (${Math.round(deg)}°)` : `${dirsEn[idx]} (${Math.round(deg)}°)`;
}

function getAqiStatus(aqi: number | undefined, isFa: boolean) {
  if (aqi === undefined || aqi === null || isNaN(aqi)) {
    return {
      label: isFa ? 'نامشخص' : 'N/A',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      advice: isFa ? 'داده کیفیت هوا دریافت نشد' : 'No AQI data'
    };
  }
  if (aqi <= 50) {
    return {
      label: isFa ? 'پاک و سالم (Good)' : 'Good',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
      advice: isFa ? 'کیفیت هوا برای کلیه فعالیت‌های محیط باز مطلوب است.' : 'Air quality is satisfactory for outdoor operations.'
    };
  }
  if (aqi <= 100) {
    return {
      label: isFa ? 'متوسط / قابل قبول (Moderate)' : 'Moderate',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
      advice: isFa ? 'کیفیت هوا قابل قبول است؛ افراد دارای حساسیت تنفسی شدید احتیاط کنند.' : 'Acceptable air quality; unusually sensitive individuals should monitor symptoms.'
    };
  }
  if (aqi <= 150) {
    return {
      label: isFa ? 'ناسالم برای گروه‌های حساس' : 'Unhealthy for Sensitive Groups',
      badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/60',
      advice: isFa ? 'کاهش مواجهه طولانی‌مدت در فضای باز برای پرسنل دارای سابقه تنفسی.' : 'Reduce prolonged outdoor exertion for sensitive personnel.'
    };
  }
  return {
    label: isFa ? 'ناسالم / نیازمند مراقبت (Unhealthy)' : 'Unhealthy',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
    advice: isFa ? 'استفاده از ماسک استاندارد صنعتی و محدودسازی فعالیت‌های سنگین در فضای باز.' : 'Use respiratory protection and limit heavy outdoor exertion.'
  };
}

function getUvStatus(uv: number | undefined, isFa: boolean) {
  if (uv === undefined || isNaN(uv)) return { label: '—', colorClass: 'text-slate-500 dark:text-slate-400' };
  if (uv < 3) return { label: isFa ? 'کم' : 'Low', colorClass: 'text-emerald-600 dark:text-emerald-400' };
  if (uv < 6) return { label: isFa ? 'متوسط' : 'Moderate', colorClass: 'text-amber-600 dark:text-amber-400' };
  if (uv < 8) return { label: isFa ? 'زیاد' : 'High', colorClass: 'text-orange-600 dark:text-orange-400' };
  if (uv < 11) return { label: isFa ? 'بسیار زیاد' : 'Very High', colorClass: 'text-rose-600 dark:text-rose-400' };
  return { label: isFa ? 'شدید' : 'Extreme', colorClass: 'text-purple-600 dark:text-purple-400' };
}

import { WeatherIcon } from './common/WeatherIcon';
export { WeatherIcon };

/**
 * Modern, Minimalist Hero Weather Badge for HSECORE Weather Tab
 * Renders a tactile squircle card with standard Lucide icon and soft tonal tint.
 */
function WeatherHeroArtwork({
  code,
  isDay = true,
  cloudCover,
  pm10,
  rainProb
}: {
  code?: number;
  rainProb?: number;
  isDay?: boolean;
  cloudCover?: number;
  pm10?: number;
}) {
  return (
    <WeatherIcon
      code={code}
      isDay={isDay}
      cloudCover={cloudCover}
      pm10={pm10}
      precipProb={rainProb}
      variant="hero"
    />
  );
}

/**
 * Re-export SmallWeatherIcon for backward compatibility across HSECORE modules
 */
export function SmallWeatherIcon(props: {
  code?: number;
  symbol?: string;
  precipProb?: number;
  isDay?: boolean;
  cloudCover?: number;
  pm10?: number;
  className?: string;
  variant?: 'hero' | 'card' | 'badge' | 'sm' | 'inline';
}) {
  return <WeatherIcon variant={props.variant || 'inline'} {...props} />;
}

/**
 * Interactive Resilient Leaflet Mini-Map for Weather Tab
 * Replaces external iframe embeds (which fail under CSP / network restrictions)
 * with an embedded Leaflet GIS canvas + multi-provider tile fallback + tactical radar overlay.
 */
function WeatherStationMiniMap({
  activeRecord,
  weatherInfo,
  isFa,
  industrialSites,
  onSelectSite,
  onSwitchToGisMapTab
}: {
  activeRecord: HeatRecord | null;
  weatherInfo: WeatherInfo | null;
  isFa: boolean;
  industrialSites: IndustrialSiteOption[];
  onSelectSite: (lat: number, lon: number, label: string) => void;
  onSwitchToGisMapTab: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const [miniLayer, setMiniLayer] = useState<'roadmap' | 'hybrid'>('hybrid');

  const lat = activeRecord?.lat ?? 30.471003;
  const lon = activeRecord?.lon ?? 49.090324;
  const tempDisplay = weatherInfo?.tempC !== undefined
    ? `${weatherInfo.tempC.toFixed(1)}°C`
    : activeRecord?.tempC !== undefined
    ? `${Number(activeRecord.tempC).toFixed(1)}°C`
    : '';

  const createMiniTileLayer = (mode: 'roadmap' | 'hybrid', map: L.Map) => {
    const primaryUrl =
      mode === 'hybrid'
        ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    const fallbackUrl =
      mode === 'hybrid'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    let fallbackUsed = false;
    let errCount = 0;

    const layer = L.tileLayer(primaryUrl, {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxZoom: 19,
      keepBuffer: 2,
      updateWhenIdle: false,
      crossOrigin: true
    });

    layer.on('tileerror', () => {
      errCount += 1;
      if (!fallbackUsed && errCount >= 3 && mapInstanceRef.current === map) {
        fallbackUsed = true;
        const backup = L.tileLayer(fallbackUrl, {
          maxZoom: 19,
          keepBuffer: 2,
          updateWhenIdle: false
        });
        if (tileLayerRef.current === layer) {
          map.removeLayer(layer);
          backup.addTo(map);
          tileLayerRef.current = backup;
        }
      }
    });

    return layer;
  };

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (!mapInstanceRef.current) {
      const map = L.map(container, {
        center: [lat, lon],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
      });

      const tLayer = createMiniTileLayer(miniLayer, map).addTo(map);
      tileLayerRef.current = tLayer;

      const mGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = mGroup;

      map.on('click', (e: L.LeafletMouseEvent) => {
        const clickedLat = e.latlng.lat;
        const clickedLon = e.latlng.lng;
        onSelectSite(
          clickedLat,
          clickedLon,
          isFa
            ? `ایستگاه انتخابی (${clickedLat.toFixed(3)}, ${clickedLon.toFixed(3)})`
            : `Selected (${clickedLat.toFixed(3)}, ${clickedLon.toFixed(3)})`
        );
      });

      mapInstanceRef.current = map;
    }

    const syncSize = () => {
      const map = mapInstanceRef.current;
      const el = mapContainerRef.current;
      if (!map || !el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        map.invalidateSize({ animate: false, pan: false });
      }
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => requestAnimationFrame(syncSize));
      ro.observe(container);
    }
    const timer = window.setTimeout(syncSize, 150);

    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const nextLayer = createMiniTileLayer(miniLayer, map).addTo(map);
    tileLayerRef.current = nextLayer;
  }, [miniLayer]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    map.invalidateSize({ animate: false, pan: false });
    map.setView([lat, lon], map.getZoom() || 12, { animate: true });

    // Radar perimeter circle
    L.circle([lat, lon], {
      color: '#0ea5e9',
      fillColor: '#38bdf8',
      fillOpacity: 0.14,
      radius: 1600,
      weight: 1.5,
      dashArray: '5, 5'
    }).addTo(group);

    // Reference industrial sites
    industrialSites.forEach((site) => {
      if (Math.abs(site.lat - lat) < 0.001 && Math.abs(site.lon - lon) < 0.001) return;
      const siteIcon = L.divIcon({
        className: 'weather-mini-site-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        html: `<div title="${isFa ? site.nameFa : site.name}" style="width:12px;height:12px;border-radius:9999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45);cursor:pointer;"></div>`
      });
      const m = L.marker([site.lat, site.lon], { icon: siteIcon });
      m.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onSelectSite(site.lat, site.lon, isFa ? site.nameFa : site.name);
      });
      m.addTo(group);
    });

    // Active station pulsing marker with live temperature badge
    const activeIcon = L.divIcon({
      className: 'weather-mini-active-pin',
      iconSize: [96, 48],
      iconAnchor: [48, 24],
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
          ${
            tempDisplay
              ? `<div style="background:rgba(15,23,42,0.92);color:#38bdf8;border:1px solid rgba(56,189,248,0.45);padding:1px 7px;border-radius:9999px;font-size:11px;font-weight:900;font-family:monospace;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,0.35);margin-bottom:3px;">${tempDisplay}</div>`
              : ''
          }
          <div style="position:relative;display:flex;align-items:center;justify-content:center;width:28px;height:28px;">
            <span style="position:absolute;width:32px;height:32px;border-radius:9999px;background:rgba(245,158,11,0.45);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
            <div style="position:relative;width:24px;height:24px;border-radius:9999px;background:#f59e0b;border:2.5px solid #ffffff;box-shadow:0 3px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:12px;">
              📍
            </div>
          </div>
        </div>
      `
    });

    L.marker([lat, lon], { icon: activeIcon }).addTo(group);
  }, [lat, lon, tempDisplay, industrialSites, isFa]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 h-52 sm:h-56 shadow-xs group select-none">
      {/* Tactical GIS Coordinate Grid Backdrop (visible while tiles load or if offline) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.22) 0%, transparent 65%), linear-gradient(to right, rgba(148, 163, 184, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.14) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 28px 28px, 28px 28px'
        }}
      />

      {/* Interactive Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full relative z-10" />

      {/* Top Map Controls: Layer Toggle & Zoom */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-md border border-white/15 rounded-xl p-1 pointer-events-auto shadow-md">
          <button
            type="button"
            onClick={() => setMiniLayer('hybrid')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              miniLayer === 'hybrid'
                ? 'bg-sky-500 text-white shadow-2xs'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {isFa ? 'ماهواره' : 'Satellite'}
          </button>
          <button
            type="button"
            onClick={() => setMiniLayer('roadmap')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
              miniLayer === 'roadmap'
                ? 'bg-sky-500 text-white shadow-2xs'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            {isFa ? 'نقشه' : 'Map'}
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-md border border-white/15 rounded-xl p-1 pointer-events-auto shadow-md">
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="w-6 h-6 rounded-lg text-white hover:bg-white/15 flex items-center justify-center text-xs font-black transition cursor-pointer"
            title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="w-6 h-6 rounded-lg text-white hover:bg-white/15 flex items-center justify-center text-xs font-black transition cursor-pointer"
            title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
          >
            −
          </button>
        </div>
      </div>

      {/* Bottom Station Info & Full GIS Button Overlay */}
      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950/95 via-slate-900/70 to-transparent p-3.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 text-xs pointer-events-auto">
          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">
            {activeRecord?.loc || '—'}
          </span>
          <span className="text-[10px] text-slate-200 font-mono tabular-nums hidden sm:inline">
            ({lat.toFixed(2)}, {lon.toFixed(2)})
          </span>
        </div>
        <button
          type="button"
          onClick={onSwitchToGisMapTab}
          className="pointer-events-auto px-3 py-1.5 bg-white/95 hover:bg-amber-500 text-slate-900 hover:text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
        >
          <span>{isFa ? 'نقشه کامل GIS' : 'Full GIS Map'}</span>
          <ArrowUpLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function WeatherDashboardView({
  weatherInfo,
  activeRecord,
  isFa,
  isLoading,
  weatherError,
  searchQuery,
  suggestions,
  gpsLoading,
  industrialSites,
  refreshMinutes = 30,
  secondsLeft = 1800,
  onSearchChange,
  onSelectSuggestion,
  onLocateGps,
  onLocateInternet,
  onSelectSite,
  onRefresh,
  onSwitchToHeatStressTab,
  onSwitchToGisMapTab,
  persianDateStr,
  categoryInfo
}: WeatherDashboardViewProps) {
  const [forecastMode, setForecastMode] = useState<'7days' | 'details'>('7days');
  const [summaryMode, setSummaryMode] = useState<'summary' | 'hourly' | 'details'>('summary');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  // Reactively track Light / Dark theme changes on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [citiesWeather, setCitiesWeather] = useState<CityLiveSummary[]>(() =>
    industrialSites.map(c => ({ ...c, loading: true, error: false }))
  );

  // Independent Multi-Source Comparison & Google Search Evaluation State
  const [comparisonData, setComparisonData] = useState<any | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState<boolean>(false);
  const [showComparisonPanel, setShowComparisonPanel] = useState<boolean>(true);

  const fetchMultiSourceComparison = async (lat?: number, lon?: number) => {
    const targetLat = lat ?? activeRecord?.lat ?? 30.471003;
    const targetLon = lon ?? activeRecord?.lon ?? 49.090324;
    const clientTs = Date.now();
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran';
    const tzOffsetMin = new Date().getTimezoneOffset();
    setComparisonLoading(true);
    try {
      const res = await fetch(
        `/api/weather/compare?lat=${targetLat}&lon=${targetLon}&clientTs=${clientTs}&clientTz=${encodeURIComponent(clientTz)}&tzOffsetMin=${tzOffsetMin}`
      );
      if (res.ok) {
        const data = await res.json();
        setComparisonData(data);
      }
    } catch {
      // Keep previous comparison state if network fails
    } finally {
      setComparisonLoading(false);
    }
  };

  const fetchReferenceCitiesWeather = async () => {
    setCitiesWeather(industrialSites.map(c => ({ ...c, loading: true, error: false })));
    const clientTs = Date.now();
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran';
    const tzOffsetMin = new Date().getTimezoneOffset();
    const results = await Promise.all(
      industrialSites.map(async (city) => {
        try {
          const res = await fetch(
            `/api/weather?lat=${city.lat}&lon=${city.lon}&refresh=true&clientTs=${clientTs}&clientTz=${encodeURIComponent(clientTz)}&tzOffsetMin=${tzOffsetMin}`
          );
          if (!res.ok) throw new Error('City weather failed');
          const data = await res.json();
          if (data.error) throw new Error(data.message);
          return {
            ...city,
            tempC: Number(data.tempC),
            condition: data.condition,
            code: data.code ?? 0,
            isDay: data.isDay !== undefined ? Boolean(data.isDay) : true,
            cloud: data.cloud !== undefined ? Number(data.cloud) : undefined,
            pm10: data.pm10 !== undefined ? Number(data.pm10) : undefined,
            hum: Number(data.hum),
            loading: false,
            error: false
          };
        } catch {
          return {
            ...city,
            loading: false,
            error: true
          };
        }
      })
    );
    setCitiesWeather(results);
  };

  useEffect(() => {
    fetchReferenceCitiesWeather();
  }, [industrialSites]);

  useEffect(() => {
    if (activeRecord?.lat !== undefined && activeRecord?.lon !== undefined) {
      fetchMultiSourceComparison(activeRecord.lat, activeRecord.lon);
    }
  }, [activeRecord?.lat, activeRecord?.lon]);

  const hourlyList: HourlyForecastItem[] =
    (weatherInfo?.hourlyForecast && weatherInfo.hourlyForecast.length > 0)
      ? weatherInfo.hourlyForecast
      : (activeRecord?.hourlyForecast && activeRecord.hourlyForecast.length > 0)
      ? activeRecord.hourlyForecast
      : [];

  const dailyList: DailyForecastItem[] =
    (weatherInfo?.dailyForecast && weatherInfo.dailyForecast.length > 0)
      ? weatherInfo.dailyForecast
      : (activeRecord?.dailyForecast && activeRecord.dailyForecast.length > 0)
      ? activeRecord.dailyForecast
      : [];

  const enrichedHourlyList = hourlyList.map((item, idx) => {
    const isDaySlot = item.isDay !== undefined ? item.isDay : true;
    const humVal = item.hum !== undefined && Number.isFinite(item.hum)
      ? Math.round(item.hum)
      : Math.round(weatherInfo?.hum ?? activeRecord?.hum ?? 50);
    const hs = calculateFullHeatStressMetrics(item.tempC, humVal, {
      windSpeedKmh: item.windSpeed,
      uvIndex: item.uvIndex,
      cloudCover: item.cloudCover,
      isDay: isDaySlot
    });
    return {
      ...item,
      index: idx,
      timeLabel: idx === 0 ? (isFa ? 'اکنون' : 'Now') : item.time,
      temp: Math.round(item.tempC),
      tempExact: Number(item.tempC.toFixed(1)),
      rainProb: item.precipProb !== undefined ? Math.round(item.precipProb) : undefined,
      hum: humVal,
      hi: Math.round(hs.hi),
      hiExact: hs.hi,
      hiDisplay: hs.hiDisplay,
      hiCat: hs.cat,
      windSpeed: item.windSpeed,
      uv: item.uvIndex ?? 0,
      isDay: isDaySlot,
      cloudCover: item.cloudCover,
      symbol: item.symbol,
      condition: extractLocalizedCondition(item.symbolPhrase, item.symbol, isFa, {
        isDay: isDaySlot,
        cloudCover: item.cloudCover
      })
    };
  });

  const summaryChartSlots = enrichedHourlyList.slice(0, 10);

  const currentIsDay = weatherInfo?.isDay !== undefined ? weatherInfo.isDay : (activeRecord?.isDay ?? true);
  const currentConditionText = extractLocalizedCondition(
    activeRecord?.condition,
    weatherInfo?.code,
    isFa,
    {
      isDay: currentIsDay,
      cloudCover: weatherInfo?.cloud,
      pm10: weatherInfo?.pm10
    }
  );

  const aqiStatus = getAqiStatus(weatherInfo?.aqi, isFa);
  const uvStatus = getUvStatus(weatherInfo?.uv, isFa);

  const computeSunProgress = (): number => {
    if (!weatherInfo?.sunrise || !weatherInfo?.sunset || !weatherInfo.sunrise.includes(':')) return 50;
    const [rH, rM] = weatherInfo.sunrise.split(':').map(Number);
    const [sH, sM] = weatherInfo.sunset.split(':').map(Number);
    if (isNaN(rH) || isNaN(sH)) return 50;
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const riseMins = rH * 60 + (rM || 0);
    const setMins = sH * 60 + (sM || 0);
    if (setMins <= riseMins) return 50;
    const ratio = (curMins - riseMins) / (setMins - riseMins);
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  };

  const sunProgress = computeSunProgress();
  const formattedCountdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      className="w-full space-y-5 animate-fade-in"
      id="hse-weather-dashboard"
    >
      {/* Top Action, Location & Auto-Refresh Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                  {activeRecord?.loc || (isFa ? 'در حال دریافت موقعیت...' : 'Fetching location...')}
                </h2>
                {(weatherInfo?.source || activeRecord?.provider) && (
                  <span className="text-[11px] text-sky-600 dark:text-sky-400 font-mono bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                    {isFa ? 'منبع داده: ' : 'Source: '}{weatherInfo?.source || activeRecord?.provider}
                  </span>
                )}
                {(() => {
                  const recordTs = weatherInfo?.fetchedAt || weatherInfo?.observedAt || activeRecord?.observedAt || activeRecord?.ts;
                  const obsTs = weatherInfo?.observedAt || activeRecord?.observedAt || activeRecord?.ts;
                  const isStale = isWeatherRecordStale( obsTs, 75 ) && isWeatherRecordStale( recordTs, 75 );
                  const recordAge = getWeatherRecordAgeMinutes(obsTs);
                  if (isStale) {
                    return (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        {isFa ? `هشدار داده قدیمی (${recordAge !== null ? `${recordAge} دقیقه قبل` : 'نیازمند بروزرسانی'})` : `Telemetry Stale (${recordAge !== null ? `${recordAge}m ago` : 'old'})`}
                      </span>
                    );
                  }
                  return (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {isFa ? 'داده معتبر و زنده' : 'Verified Live Telemetry'}
                    </span>
                  );
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                <span
                  className="flex items-center gap-1 cursor-help"
                  title={
                    isFa
                      ? 'زمان سنجش ایستگاه (Observation Time): ساعت رسمی ثبت و کالیبراسیون پارامترهای جوی در ایستگاه یا مدل سینوپتیک جهانی (سیکل‌های یک‌ساعته UTC)'
                      : 'Station Observation Time: Official synoptic model/station measurement slot'
                  }
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  {isFa
                    ? `زمان سنجش ایستگاه: ${persianDateStr} — ساعت ${weatherInfo?.updated || '—'}`
                    : `Observed: ${persianDateStr} at ${weatherInfo?.updated || '—'}`}
                </span>
                {weatherInfo?.fetchedAt && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span>
                      {isFa
                        ? `دریافت سرور: ${new Date(weatherInfo.fetchedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : `Fetched: ${new Date(weatherInfo.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                    </span>
                  </>
                )}
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  {isFa ? `بروزرسانی خودکار (${refreshMinutes} دقیقه): ${formattedCountdown}` : `Auto-Sync (${refreshMinutes}m): ${formattedCountdown}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Location Search, Site Select, GPS, Internet IP & Refresh Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Quick Industrial Site Dropdown */}
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') return;
              const site = industrialSites[Number(val)];
              if (site) {
                onSelectSite(site.lat, site.lon, isFa ? site.nameFa : site.name);
              }
            }}
            defaultValue=""
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 font-semibold cursor-pointer"
            aria-label={isFa ? 'انتخاب ایستگاه صنعتی' : 'Select Industrial Site'}
          >
            <option value="" disabled>
              {isFa ? 'انتخاب سریع سایت صنعتی...' : 'Quick Select Site...'}
            </option>
            {industrialSites.map((site, idx) => (
              <option key={idx} value={idx}>
                {isFa ? site.nameFa : site.name}
              </option>
            ))}
          </select>

          {/* Search City Input */}
          <div className="relative flex-1 sm:w-56">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isFa ? 'جستجوی شهر یا ایستگاه...' : 'Search city or station...'}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs rounded-xl py-2.5 pr-3 pl-9 focus:outline-none focus:border-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 p-1.5 space-y-1">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectSuggestion(s)}
                    className="w-full text-right text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-2 rounded-lg transition cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-bold">{s.name}</span>
                    <span className="text-[10px] text-slate-400">{s.admin1 ? `${s.admin1}, ` : ''}{s.country}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLocateGps}
              disabled={gpsLoading}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              title={isFa ? 'دریافت موقعیت دقیق با GPS' : 'Locate via GPS'}
            >
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span>{gpsLoading ? (isFa ? 'در حال ردیابی...' : 'Locating...') : 'GPS'}</span>
            </button>

            {onLocateInternet && (
              <button
                type="button"
                onClick={onLocateInternet}
                disabled={gpsLoading}
                className="px-3 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/25 rounded-xl text-xs font-bold text-sky-700 dark:text-sky-300 transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                title={isFa ? 'استخراج موقعیت مکانی از شبکه اینترنت (IP)' : 'Locate via Internet IP'}
              >
                <Globe className="w-3.5 h-3.5 text-sky-500" />
                <span>{isFa ? 'موقعیت اینترنت' : 'IP Locate'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onRefresh();
                fetchReferenceCitiesWeather();
                fetchMultiSourceComparison();
              }}
              disabled={isLoading}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isFa ? 'به‌روزرسانی' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Explicit API Error / Disconnection Notice */}
      {weatherError && (
        <div className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <WifiOff className="w-6 h-6 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-rose-800 dark:text-rose-200">
                {isFa ? 'خطای دریافت اطلاعات یا قطع ارتباط با سرویس آنلاین هواشناسی' : 'Weather Service Disconnected / Error'}
              </h3>
              <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed">
                {weatherError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
          >
            {isFa ? 'تلاش مجدد' : 'Retry Connection'}
          </button>
        </div>
      )}

      {/* ROW 1: Current Weather Card + Center Map/Sun Overview + Reference Industrial Cities Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 1. Current Weather Card (4 cols) - Distinguished in Light & Dark Mode */}
        <div className="lg:col-span-4 bg-gradient-to-br from-sky-50/95 via-blue-50/45 to-white dark:from-slate-900 dark:via-slate-850 dark:to-sky-950/45 border border-sky-200/90 dark:border-sky-500/30 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-md shadow-sky-500/5 dark:shadow-sky-950/40 ring-1 ring-sky-300/40 dark:ring-sky-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 dark:bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between gap-2 border-b border-sky-100 dark:border-sky-900/50 pb-3 relative z-10">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span>{isFa ? 'وضعیت فعلی هواشناسی' : 'Current Weather'}</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 flex items-center gap-1.5">
                <span>{weatherInfo?.updated || '—'}</span>
                <span>·</span>
                <span className="font-sans font-bold text-sky-600 dark:text-sky-400">
                  {currentIsDay ? (isFa ? 'وضعیت روز' : 'Daytime') : (isFa ? 'وضعیت شب' : 'Nighttime')}
                </span>
              </p>
            </div>
            <span className="text-xs text-sky-700 dark:text-sky-300 font-bold truncate max-w-[170px] bg-sky-100/80 dark:bg-sky-950/80 px-2.5 py-0.5 rounded-full border border-sky-200/80 dark:border-sky-800/60 shadow-2xs">
              {activeRecord?.loc ? activeRecord.loc.split('،')[0].split(',')[0] : ''}
            </span>
          </div>

          {weatherInfo ? (
            <>
              <div className="flex items-center justify-around gap-4 my-5 relative z-10">
                <WeatherHeroArtwork
                  code={weatherInfo.code}
                  rainProb={weatherInfo.rainProb}
                  isDay={currentIsDay}
                  cloudCover={weatherInfo.cloud}
                  pm10={weatherInfo.pm10}
                />
                <div className="text-center sm:text-right">
                  <div className="flex items-start justify-center sm:justify-start font-mono tabular-nums leading-none">
                    <span className="text-5xl sm:text-6xl font-black tracking-tight text-slate-900 dark:text-white">
                      {weatherInfo.tempC.toFixed(1)}
                    </span>
                    <span className="text-xl sm:text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1 mr-1">°C</span>
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 mt-2">
                    {currentConditionText}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                    {isFa ? `دمای محسوس: ${weatherInfo.feels.toFixed(1)}°C` : `Feels like ${weatherInfo.feels.toFixed(1)}°C`}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums mt-0.5">
                    {isFa ? `پوشش ابر: ${weatherInfo.cloud}% · کد WMO: ${weatherInfo.code}` : `Cloud: ${weatherInfo.cloud}% · WMO: ${weatherInfo.code}`}
                  </div>
                </div>
              </div>

              {/* Primary 4 Metrics Strip (AQI, Humidity, Wind, UV) */}
              <div className="grid grid-cols-4 gap-2 pt-4 border-t border-sky-100 dark:border-sky-900/50 text-center relative z-10">
                <div className="bg-white/90 dark:bg-slate-800/80 backdrop-blur-xs border border-sky-100 dark:border-sky-900/50 rounded-2xl p-2.5 space-y-1 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1 shadow-2xs">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo.aqi !== undefined ? weatherInfo.aqi : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{isFa ? 'شاخص AQI' : 'AQI'}</div>
                </div>
                <div className="bg-white/90 dark:bg-slate-800/80 backdrop-blur-xs border border-sky-100 dark:border-sky-900/50 rounded-2xl p-2.5 space-y-1 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-1 shadow-2xs">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo.hum}%
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{isFa ? 'رطوبت' : 'Humidity'}</div>
                </div>
                <div className="bg-white/90 dark:bg-slate-800/80 backdrop-blur-xs border border-sky-100 dark:border-sky-900/50 rounded-2xl p-2.5 space-y-1 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-1 shadow-2xs">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {Math.round(weatherInfo.wind)} <span className="text-[9px] font-normal">km/h</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{isFa ? 'سرعت باد' : 'Wind'}</div>
                </div>
                <div className="bg-white/90 dark:bg-slate-800/80 backdrop-blur-xs border border-sky-100 dark:border-sky-900/50 rounded-2xl p-2.5 space-y-1 shadow-2xs">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-1 shadow-2xs">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo.uv !== undefined ? Number(weatherInfo.uv).toFixed(1) : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{isFa ? 'شاخص UV' : 'UV Index'}</div>
                </div>
              </div>

              {/* Secondary 4 Metrics Strip (Visibility, Pressure, Rain Amount, Rain Prob) */}
              <div className="grid grid-cols-4 gap-2 pt-3 mt-3 border-t border-sky-100 dark:border-sky-900/50 text-center relative z-10">
                <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2 space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Eye className="w-3 h-3 text-sky-500 shrink-0" />
                    <span>{isFa ? 'میزان دید' : 'Visibility'}</span>
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo.visibility} km
                  </div>
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2 space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Gauge className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>{isFa ? 'فشار هوا' : 'Pressure'}</span>
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {Math.round(weatherInfo.pressure)} hPa
                  </div>
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2 space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <CloudRain className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>{isFa ? 'میزان بارش' : 'Rain'}</span>
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo.rainAmount !== undefined ? `${weatherInfo.rainAmount} mm` : '0 mm'}
                  </div>
                </div>
                <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 rounded-xl p-2 space-y-0.5">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Umbrella className="w-3 h-3 text-teal-500 shrink-0" />
                    <span>{isFa ? 'احتمال بارش' : 'Rain %'}</span>
                  </div>
                  <div className="text-xs font-bold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo.rainProb !== undefined ? `${weatherInfo.rainProb}%` : '—'}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              {isLoading
                ? (isFa ? 'در حال دریافت اطلاعات زنده هواشناسی...' : 'Loading live weather telemetry...')
                : (isFa ? 'داده‌ای برای نمایش وجود ندارد.' : 'No weather data available.')}
            </div>
          )}
        </div>

        {/* 2. Center Interactive Station Map & Sunrise/Sunset Card (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Interactive Station Map Preview */}
          <WeatherStationMiniMap
            activeRecord={activeRecord}
            weatherInfo={weatherInfo}
            isFa={isFa}
            industrialSites={industrialSites}
            onSelectSite={onSelectSite}
            onSwitchToGisMapTab={onSwitchToGisMapTab}
          />

          {/* Sunrise & Sunset + Day Length Card */}
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>{isFa ? 'طلوع و غروب خورشید' : 'Sunrise & Sunset'}</span>
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {isFa ? `طول روز: ${weatherInfo?.dayLength || '—'}` : `Day Length: ${weatherInfo?.dayLength || '—'}`}
              </span>
            </div>

            <div className="my-2 flex items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Sunrise className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{isFa ? 'طلوع خورشید' : 'Sunrise'}</div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo?.sunrise || '--:--'}
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-[180px] hidden sm:block">
                <svg viewBox="0 0 160 55" className="w-full h-12 overflow-visible">
                  <path
                    d="M 10 45 Q 80 -10 150 45"
                    fill="none"
                    stroke={isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.35)'}
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1="4"
                    y1="45"
                    x2="156"
                    y2="45"
                    stroke={isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.4)'}
                    strokeWidth="1"
                  />
                  {(() => {
                    const t = sunProgress / 100;
                    const x = (1 - t) * (1 - t) * 10 + 2 * (1 - t) * t * 80 + t * t * 150;
                    const y = (1 - t) * (1 - t) * 45 + 2 * (1 - t) * t * -10 + t * t * 45;
                    return (
                      <g>
                        <circle cx={x} cy={y} r="9" fill="rgba(245,158,11,0.22)" />
                        <circle cx={x} cy={y} r="5" fill="#f59e0b" />
                      </g>
                    );
                  })()}
                </svg>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                  <Sunset className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">{isFa ? 'غروب خورشید' : 'Sunset'}</div>
                  <div className="text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                    {weatherInfo?.sunset || '--:--'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Reference Industrial Hubs Card (3 cols) */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{isFa ? 'سایت‌ها و شهرهای مرجع' : 'Industrial Hubs'}</span>
            </h3>
            <button
              type="button"
              onClick={fetchReferenceCitiesWeather}
              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline transition cursor-pointer font-bold"
            >
              {isFa ? 'بروزرسانی' : 'Refresh'}
            </button>
          </div>

          <div className="space-y-2 flex-1 flex flex-col justify-around">
            {citiesWeather.map((city, idx) => {
              const isSelectedCity =
                activeRecord &&
                Math.abs(activeRecord.lat - city.lat) < 0.08 &&
                Math.abs(activeRecord.lon - city.lon) < 0.08;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectSite(city.lat, city.lon, isFa ? city.nameFa : city.name)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl transition cursor-pointer text-right border ${
                    isSelectedCity
                      ? 'bg-amber-500/10 border-amber-500/30 text-slate-900 dark:text-white shadow-2xs'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <WeatherIcon
                      code={city.code}
                      isDay={city.isDay ?? true}
                      cloudCover={city.cloud}
                      pm10={city.pm10}
                      variant="badge"
                    />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {isFa ? city.nameFa : city.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {city.loading ? (
                      <span className="text-[11px] text-slate-400">...</span>
                    ) : city.error ? (
                      <span className="text-[11px] text-rose-500">{isFa ? 'آفلاین' : 'Offline'}</span>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden xl:inline truncate max-w-[85px]">
                          {extractLocalizedCondition(city.condition, city.code, isFa, {
                            isDay: city.isDay ?? true,
                            cloudCover: city.cloud,
                            pm10: city.pm10
                          })}
                        </span>
                        <span className="text-xs font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                          {city.tempC !== undefined ? `${Math.round(city.tempC)}°` : '—'}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROW 2: 7-Day Forecast (Left 4 cols) + Summary & Hourly Forecast (Right 8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Daily Forecast Card (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{isFa ? 'پیش‌بینی روزانه (۷ روز آینده)' : '7-Day Daily Forecast'}</span>
            </h3>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setForecastMode('7days')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                  forecastMode === '7days'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {isFa ? 'وضعیت و باد' : 'Sky & Wind'}
              </button>
              <button
                type="button"
                onClick={() => setForecastMode('details')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                  forecastMode === 'details'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {isFa ? 'بارش و UV' : 'Rain & UV'}
              </button>
            </div>
          </div>

          {dailyList.length > 0 ? (
            <div className="space-y-2 flex-1 flex flex-col justify-between">
              {dailyList.slice(0, 7).map((day, idx) => {
                const isSelected = selectedDayIdx === idx;
                const dayCondText = extractLocalizedCondition(day.symbolPhrase, day.symbol, isFa, { isDay: true });
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl transition cursor-pointer border ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 shadow-2xs'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <WeatherIcon
                        symbol={day.symbol}
                        precipProb={day.precipProb}
                        isDay={true}
                        variant="card"
                      />
                      <div className="text-right min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                            {Math.round(day.maxTempC)}° <span className="text-slate-400 font-normal">/ {Math.round(day.minTempC)}°</span>
                          </span>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                            {dayCondText}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                          {day.maxWindSpeed !== undefined && (
                            <span className="flex items-center gap-0.5">
                              <Wind className="w-3 h-3 text-teal-500" />
                              {Math.round(day.maxWindSpeed)} km/h
                            </span>
                          )}
                          {day.precipProb !== undefined && (
                            <span className="text-sky-600 dark:text-sky-400 font-semibold">
                              {isFa ? `احتمال بارش: ${day.precipProb}%` : `Rain: ${day.precipProb}%`}
                            </span>
                          )}
                          {forecastMode === 'details' && day.uvIndex !== undefined && (
                            <span>UV: {day.uvIndex}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {formatForecastDateLabel(day.date, idx, isFa)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              {isFa ? 'اطلاعات پیش‌بینی روزانه دریافت نشد.' : 'No daily forecast data available.'}
            </div>
          )}
        </div>

        {/* Summary & Hourly Forecast Card (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>
                  {isFa
                    ? 'پیش‌بینی ساعتی وضعیت آسمان، دما، رطوبت، شاخص استرس گرمایی، باد و بارندگی'
                    : 'Hourly Sky, Temp, Humidity, Heat Stress Index, Wind & Rain Forecast'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa
                  ? 'تشخیص خودکار روز/شب، کد وضعیت جوی WMO، دما، درصد رطوبت، شاخص استرس گرمایی (HI)، سرعت باد و احتمال بارش'
                  : 'Auto day/night detection, WMO code, temperature, relative humidity %, Heat Stress Index (HI), wind speed & precipitation'}
              </p>
            </div>

            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSummaryMode('summary')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                  summaryMode === 'summary'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {isFa ? 'خلاصه نموداری' : 'Summary'}
              </button>
              <button
                type="button"
                onClick={() => setSummaryMode('hourly')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                  summaryMode === 'hourly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {isFa ? 'ساعتی (۲۴ ساعت)' : 'Hourly (24h)'}
              </button>
              <button
                type="button"
                onClick={() => setSummaryMode('details')}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap ${
                  summaryMode === 'details'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {isFa ? 'جزئیات تکمیلی' : 'More Details'}
              </button>
            </div>
          </div>

          {summaryMode === 'summary' && (
            summaryChartSlots.length > 0 ? (
              <div className="flex-1 flex flex-col justify-between space-y-3">
                {/* Chart Legend Strip */}
                <div className="flex flex-wrap items-center justify-end gap-4 px-2 text-[11px] font-bold">
                  <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                    <span>{isFa ? 'دما (°C)' : 'Temp (°C)'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>{isFa ? 'شاخص استرس گرمایی (HI °C)' : 'Heat Stress Index (HI °C)'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                    <span>{isFa ? 'درصد رطوبت (%)' : 'Humidity (%)'}</span>
                  </span>
                </div>

                <div className="h-52 sm:h-56 w-full pt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={175}>
                    <AreaChart data={summaryChartSlots} margin={{ top: 26, right: 24, left: 24, bottom: 6 }}>
                      <defs>
                        <linearGradient id="summaryTempFillAdaptive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isDark ? '#38bdf8' : '#0284c7'} stopOpacity={isDark ? 0.35 : 0.22} />
                          <stop offset="100%" stopColor={isDark ? '#38bdf8' : '#0284c7'} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="summaryHiFillAdaptive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isDark ? '#fbbf24' : '#f59e0b'} stopOpacity={isDark ? 0.25 : 0.16} />
                          <stop offset="100%" stopColor={isDark ? '#fbbf24' : '#f59e0b'} stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="summaryHumFillAdaptive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isDark ? '#2dd4bf' : '#0d9488'} stopOpacity={isDark ? 0.18 : 0.12} />
                          <stop offset="100%" stopColor={isDark ? '#2dd4bf' : '#0d9488'} stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timeLabel" hide />
                      <YAxis yAxisId="temp" domain={['dataMin - 4', 'dataMax + 5']} hide />
                      <YAxis yAxisId="hum" orientation="right" domain={[0, 110]} hide />
                      <ReTooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          borderRadius: '12px',
                          color: isDark ? '#f8fafc' : '#0f172a',
                          fontSize: '12px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
                        }}
                        formatter={(val: any, name: string) => {
                          if (name === 'hum') return [`${val}%`, isFa ? 'درصد رطوبت' : 'Humidity'];
                          if (name === 'hi') return [`${val}°C`, isFa ? 'شاخص استرس گرمایی (HI)' : 'Heat Stress Index'];
                          return [`${val}°C`, isFa ? 'دما' : 'Temp'];
                        }}
                      />
                      <Area
                        yAxisId="hum"
                        type="monotone"
                        dataKey="hum"
                        name="hum"
                        stroke={isDark ? '#2dd4bf' : '#0d9488'}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        fillOpacity={1}
                        fill="url(#summaryHumFillAdaptive)"
                      >
                        <LabelList
                          dataKey="hum"
                          position="bottom"
                          formatter={(v: any) => `${v}%`}
                          style={{
                            fill: isDark ? '#5eead4' : '#0f766e',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'monospace'
                          }}
                        />
                      </Area>
                      <Area
                        yAxisId="temp"
                        type="monotone"
                        dataKey="hi"
                        name="hi"
                        stroke={isDark ? '#fbbf24' : '#f59e0b'}
                        strokeWidth={2.2}
                        fillOpacity={1}
                        fill="url(#summaryHiFillAdaptive)"
                      >
                        <LabelList
                          dataKey="hi"
                          position="top"
                          offset={18}
                          formatter={(v: any) => `HI:${v}°`}
                          style={{
                            fill: isDark ? '#fcd34d' : '#d97706',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'monospace'
                          }}
                        />
                      </Area>
                      <Area
                        yAxisId="temp"
                        type="monotone"
                        dataKey="temp"
                        name="temp"
                        stroke={isDark ? '#38bdf8' : '#0284c7'}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#summaryTempFillAdaptive)"
                      >
                        <LabelList
                          dataKey="temp"
                          position="top"
                          offset={5}
                          formatter={(v: any) => `${v}°`}
                          style={{
                            fill: isDark ? '#e2e8f0' : '#0f172a',
                            fontSize: 11,
                            fontWeight: 800,
                            fontFamily: 'monospace'
                          }}
                        />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 overflow-x-auto">
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center min-w-[580px]" dir="ltr">
                    {summaryChartSlots.map((slot, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center space-y-1 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl py-2 px-1.5 border border-slate-100 dark:border-slate-800"
                      >
                        <WeatherIcon
                          symbol={slot.symbol}
                          precipProb={slot.rainProb}
                          isDay={slot.isDay}
                          cloudCover={slot.cloudCover}
                          variant="badge"
                        />
                        <div
                          className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate w-full"
                          dir={isFa ? 'rtl' : 'ltr'}
                          title={slot.condition}
                        >
                          {slot.condition}
                        </div>
                        <div className="text-[10px] font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400" title={isFa ? 'شاخص استرس گرمایی' : 'Heat Stress Index'}>
                          {isFa ? `HI: ${slot.hiDisplay}°C` : `HI: ${slot.hiDisplay}°C`}
                        </div>
                        <div className="text-[10px] font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400">
                          {isFa ? `رطوبت: ${slot.hum}%` : `RH: ${slot.hum}%`}
                        </div>
                        {slot.rainProb !== undefined && (
                          <div className="text-[10px] font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400">
                            {isFa ? `بارش: ${slot.rainProb}%` : `Rain: ${slot.rainProb}%`}
                          </div>
                        )}
                        <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {Math.round(slot.windSpeed)} km/h
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 font-mono tabular-nums pt-0.5">
                          {slot.timeLabel}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 px-1">
                    <span>
                      {isFa
                        ? 'پیش‌بینی ساعتی (آیکون روز/شب، شرح وضعیت، شاخص استرس گرمایی HI، درصد رطوبت، احتمال بارش و سرعت باد)'
                        : 'Hourly Forecast (Icon, Sky Phrase, Heat Index HI, Humidity %, Rain % & Wind Speed)'}
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {isFa ? `بارش فعلی: ${weatherInfo?.rainAmount ?? 0} میلی‌متر` : `Current Precip: ${weatherInfo?.rainAmount ?? 0} mm`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                {isFa ? 'داده‌های ساعتی برای رسم نمودار در دسترس نیست.' : 'No hourly data available for chart.'}
              </div>
            )
          )}

          {summaryMode === 'hourly' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5 max-h-80 overflow-y-auto p-1">
              {enrichedHourlyList.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 text-center space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono tabular-nums font-bold text-sky-600 dark:text-sky-400">
                    <span>{item.timeLabel}</span>
                    <span className="text-[10px] text-slate-400">{item.isDay ? (isFa ? 'روز' : 'Day') : (isFa ? 'شب' : 'Night')}</span>
                  </div>
                  <div className="flex justify-center py-1">
                    <WeatherIcon
                      symbol={item.symbol}
                      precipProb={item.precipProb}
                      isDay={item.isDay}
                      cloudCover={item.cloudCover}
                      variant="card"
                    />
                  </div>
                  <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200 truncate" title={item.condition}>
                    {item.condition}
                  </div>
                  <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white">
                    {item.tempC.toFixed(1)}°C
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[10px] font-mono tabular-nums font-bold">
                    <span className="text-amber-600 dark:text-amber-400">HI: {item.hiDisplay}°C</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-teal-600 dark:text-teal-400">{isFa ? `رطوبت: ${item.hum}%` : `RH: ${item.hum}%`}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums flex items-center justify-center gap-1">
                    <Wind className="w-3 h-3 text-teal-500" />
                    <span>{isFa ? `باد: ${Math.round(item.windSpeed)} km/h` : `Wind: ${Math.round(item.windSpeed)} km/h`}</span>
                  </div>
                  {item.rainProb !== undefined && (
                    <div className="text-[10px] text-sky-600 dark:text-sky-400 font-mono tabular-nums font-semibold">
                      {isFa ? `احتمال بارش: ${item.rainProb}%` : `Rain: ${item.rainProb}%`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {summaryMode === 'details' && weatherInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 my-auto">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'جهت و سرعت باد' : 'Wind Velocity'}</div>
                <div className="text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                  {weatherInfo.wind} km/h
                </div>
                <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">{getWindDirectionText(weatherInfo.windDir, isFa)}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'شاخص اشعه فرابنفش (UV)' : 'UV Radiation'}</div>
                <div className={`text-sm font-extrabold font-mono tabular-nums ${uvStatus.colorClass}`}>
                  {weatherInfo.uv} ({uvStatus.label})
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isFa ? 'پایش مواجهه تابشی محیط باز' : 'Outdoor solar exposure'}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'نقطه شبنم و حباب تر' : 'Dew Point & Wet Bulb'}</div>
                <div className="text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                  {weatherInfo.dewPoint ?? '—'}°C / {weatherInfo.wetBulb ?? '—'}°C
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isFa ? 'شاخص رطوبت مطلق و تبخیر' : 'Psychrometric telemetry'}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'پوشش ابر و ارتفاع' : 'Cloud Cover & Elevation'}</div>
                <div className="text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100">
                  {weatherInfo.cloud}% · {weatherInfo.elevation ?? 0}m
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isFa ? 'تراز ارتفاع ایستگاه از سطح دریا' : 'Station elevation ASL'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: Air Quality Index (AQI) Card + HSE Heat Stress Environmental Advisory Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Dedicated Air Quality Index (AQI) Card (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                {isFa ? 'شاخص کیفیت هوا (AQI)' : 'Air Quality Index (AQI)'}
              </h3>
            </div>
            <span className={`text-xs font-extrabold px-2.5 py-1 rounded-xl border font-mono tabular-nums ${aqiStatus.badgeClass}`}>
              {weatherInfo?.aqi !== undefined ? `AQI ${weatherInfo.aqi}` : '—'} · {aqiStatus.label}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {aqiStatus.advice}
          </p>

          {/* AQI Spectrum Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-gradient-to-l from-rose-500 via-amber-400 to-emerald-400 relative overflow-hidden">
              {weatherInfo?.aqi !== undefined && (
                <div
                  className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full shadow-md border-2 border-slate-900"
                  style={{
                    right: isFa ? `${Math.min(96, Math.max(2, (weatherInfo.aqi / 200) * 100))}%` : undefined,
                    left: !isFa ? `${Math.min(96, Math.max(2, (weatherInfo.aqi / 200) * 100))}%` : undefined
                  }}
                />
              )}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>0 ({isFa ? 'پاک' : 'Good'})</span>
              <span>50</span>
              <span>100</span>
              <span>150</span>
              <span>200+ ({isFa ? 'خطرناک' : 'Hazardous'})</span>
            </div>
          </div>

          {/* Pollutants Breakdown Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">PM2.5</div>
              <div className="text-xs font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                {weatherInfo?.pm25 !== undefined ? weatherInfo.pm25.toFixed(1) : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">PM10</div>
              <div className="text-xs font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                {weatherInfo?.pm10 !== undefined ? weatherInfo.pm10.toFixed(1) : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">O₃</div>
              <div className="text-xs font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                {weatherInfo?.o3 !== undefined ? Math.round(weatherInfo.o3) : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">NO₂</div>
              <div className="text-xs font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                {weatherInfo?.no2 !== undefined ? weatherInfo.no2.toFixed(1) : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">SO₂</div>
              <div className="text-xs font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                {weatherInfo?.so2 !== undefined ? weatherInfo.so2.toFixed(1) : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">CO</div>
              <div className="text-xs font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-0.5">
                {weatherInfo?.co !== undefined ? Math.round(weatherInfo.co) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* HSE Heat Stress Integration & Environmental Warning Card (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${categoryInfo.color}18`, color: categoryInfo.color }}
              >
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                  {isFa ? 'پایش شرایط محیطی و ارتباط با شاخص استرس گرمایی (HSE)' : 'Environmental Heat Stress Advisory'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isFa
                    ? 'محاسبه علمی شاخص گرما (OSHA) و تخمین محاسباتی WBGT (ISO 7243) بر پایه پارامترهای ایستگاه هواشناسی'
                    : 'Scientific OSHA Heat Index & ISO 7243 WBGT meteorological estimation'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSwitchToHeatStressTab}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
            >
              <span>{isFa ? 'پنل محاسبات استرس گرمایی' : 'Heat Stress Console'}</span>
              <ArrowUpLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Thermal Indices Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'شاخص گرما (Heat Index)' : 'Heat Index'}</div>
              <div className="text-lg font-black font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                {activeRecord ? `${activeRecord.hiDisplay}°C` : '—'}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">{isFa ? 'ماتریس استاندارد OSHA' : 'OSHA Matrix'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-emerald-500/25 rounded-2xl p-3">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'تخمین WBGT محیط باز' : 'Est. Outdoor WBGT'}</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded font-bold">
                  {isFa ? 'تخمینی' : 'Est.'}
                </span>
              </div>
              <div className="text-lg font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                {weatherInfo?.wbgt !== undefined ? `${weatherInfo.wbgt}°C` : '—'}
              </div>
              <div className="text-[9px] text-slate-400 font-mono tabular-nums mt-0.5">
                {isFa ? `در سایه: ${weatherInfo?.wbgtShade ?? '—'}°C` : `Shade: ${weatherInfo?.wbgtShade ?? '—'}°C`}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'سطح ریسک گرمایی' : 'Risk Category'}</div>
              <div className="text-xs sm:text-sm font-extrabold mt-1 truncate" style={{ color: categoryInfo.color }}>
                {categoryInfo.name}
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">
                {isFa ? `گوی سیاه تخمینی: ${weatherInfo?.globeTemp ?? '—'}°C` : `Est. Globe: ${weatherInfo?.globeTemp ?? '—'}°C`}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-3">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isFa ? 'دمای حباب تر / شبنم' : 'Wet Bulb / Dew'}</div>
              <div className="text-sm font-extrabold font-mono tabular-nums text-slate-800 dark:text-slate-100 mt-1">
                {weatherInfo?.wetBulb ?? '—'}°C / {weatherInfo?.dewPoint ?? '—'}°C
              </div>
              <div className="text-[9px] text-slate-400 mt-0.5">{isFa ? 'محاسبه سایکرومتریک Stull' : 'Stull Psychrometric'}</div>
            </div>
          </div>

          {/* HSE Actionable Recommendations */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
              {activeRecord?.cat && activeRecord.cat !== 'Normal' ? (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              )}
              <span>{categoryInfo.risk}</span>
            </div>
            {categoryInfo.recos && categoryInfo.recos.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                {categoryInfo.recos.map((rec, i) => (
                  <span key={i}>• {rec}</span>
                ))}
              </div>
            )}
          </div>

          {/* Mandatory HSE Technical Note: Explicit WBGT Estimation Disclosure */}
          <div className="flex items-start gap-2.5 text-[11px] text-amber-900 dark:text-amber-200 bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-bold">
                {isFa
                  ? `شفافیت محاسبات WBGT: ${weatherInfo?.wbgtNoteFa || 'مقدار نمایش‌داده‌شده تخمین محاسباتی بر پایه داده‌های ایستگاه هواشناسی (ISO 7243) است و سنسور مستقیم گوی سیاه در محل کار نیست.'}`
                  : `WBGT Calculation Transparency: ${weatherInfo?.wbgtNoteEn || 'Displayed value is a meteorological station estimate (ISO 7243), not a direct physical black-globe sensor.'}`}
              </p>
              <p className="text-[10px] opacity-90">
                {isFa
                  ? 'الزام استاندارد HSE: داده‌های هواشناسی صرفاً جهت پایش شرایط محیطی و کمک به ارزیابی اولیه استرس گرمایی استفاده می‌شوند و جایگزین اندازه‌گیری‌های مستقیم با دستگاه WBGT استاندارد در محل دقیق فعالیت پرسنل نمی‌شوند.'
                  : 'HSE Standard Note: Meteorological telemetry aids ambient environmental monitoring and does not replace certified in-situ workplace WBGT instrument measurements.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 4: Multi-Source Independent Comparison & Google Search Source Evaluation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100">
                {isFa
                  ? 'ممیزی، اعتبارسنجی سرور و مقایسه منابع مستقل هواشناسی'
                  : 'Server-Side Validation & Independent Multi-Source Weather Comparison'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFa
                  ? 'اولویت اول: MET Norway (Yr.no) · منبع پشتیبان دوم: Open-Meteo (WMO/ECMWF) · ارزیابی فنی استخراج از جست‌وجوی گوگل'
                  : 'Priority 1: MET Norway (Yr.no) · Fallback 2: Open-Meteo (WMO/ECMWF) · Google Search technical audit'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchMultiSourceComparison()}
              disabled={comparisonLoading}
              className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/25 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${comparisonLoading ? 'animate-spin' : ''}`} />
              <span>{isFa ? 'استعلام و مقایسه مجدد منابع' : 'Compare Sources Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowComparisonPanel(!showComparisonPanel)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
            >
              {showComparisonPanel ? (isFa ? 'بستن جزئیات' : 'Hide') : (isFa ? 'نمایش جدول مقایسه' : 'Show')}
            </button>
          </div>
        </div>

        {showComparisonPanel && comparisonData && (
          <div className="space-y-4">
            {/* Cross-Check Summary Banner */}
            {comparisonData.crossCheckSummary && (
              <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{comparisonData.crossCheckSummary.agreementNoteFa}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  <span>ΔT: {comparisonData.crossCheckSummary.tempDeltaC}°C</span>
                  <span>·</span>
                  <span>ΔRH: {comparisonData.crossCheckSummary.humDeltaPct}%</span>
                  <span>·</span>
                  <span>ΔWind: {comparisonData.crossCheckSummary.windDeltaKmh} km/h</span>
                  <span>·</span>
                  <span>ΔWBGT: {comparisonData.crossCheckSummary.wbgtDeltaC}°C</span>
                </div>
              </div>
            )}

            {/* Independent Sources Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                    <th className="py-2.5 px-3">{isFa ? 'منبع مستقل هواشناسی' : 'Independent Source'}</th>
                    <th className="py-2.5 px-3">{isFa ? 'وضعیت و اعتبارسنجی' : 'Status & Validation'}</th>
                    <th className="py-2.5 px-3">{isFa ? 'وضعیت آسمان' : 'Sky Condition'}</th>
                    <th className="py-2.5 px-3">{isFa ? 'دما (°C)' : 'Temp (°C)'}</th>
                    <th className="py-2.5 px-3">{isFa ? 'رطوبت (%)' : 'RH (%)'}</th>
                    <th className="py-2.5 px-3">{isFa ? 'سرعت باد (km/h)' : 'Wind (km/h)'}</th>
                    <th className="py-2.5 px-3">{isFa ? 'تخمین WBGT (°C)' : 'Est. WBGT (°C)'}</th>
                    <th className="py-2.5 px-3">{isFa ? 'زمان سنجش ایستگاه' : 'Observed At'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {(comparisonData.sources || []).map((src: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100">
                        {src.providerName}
                      </td>
                      <td className="py-2.5 px-3">
                        {src.status === 'online' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            <Check className="w-3 h-3" />
                            {isFa ? `معتبر (${src.latencyMs}ms)` : `Valid (${src.latencyMs}ms)`}
                          </span>
                        ) : src.status === 'unconfigured' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px]">
                            {isFa ? 'نیازمند کلید تجاری' : 'API Key Not Set'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 text-[10px] font-bold">
                            <XCircle className="w-3 h-3" />
                            {isFa ? 'عدم پاسخ' : 'Offline'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {src.status === 'online' ? (
                          <span className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                            <WeatherIcon code={src.code} isDay={src.isDay ?? true} variant="badge" />
                            <span>{extractLocalizedCondition(src.condition, src.code, isFa, { isDay: src.isDay ?? true })}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100">
                        {src.tempC !== undefined ? `${src.tempC.toFixed(1)}°C` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {src.hum !== undefined ? `${src.hum}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 dark:text-slate-200">
                        {src.windKmh !== undefined ? `${src.windKmh} km/h` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                        {src.wbgt !== undefined ? `${src.wbgt}°C (${isFa ? 'تخمینی' : 'Est.'})` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        {src.observedAt
                          ? new Date(src.observedAt).toLocaleTimeString(isFa ? 'fa-IR' : [], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Google Search (`https://www.google.com/search`) Technical Audit Box */}
            {comparisonData.googleSearchEvaluation && (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-100">
                    <Globe className="w-4 h-4 text-amber-500" />
                    <span>
                      {isFa
                        ? 'نتیجه ارزیابی استخراج خودکار از لینک جست‌وجوی گوگل (https://www.google.com/search):'
                        : 'Evaluation of Automated Extraction from Google Search (https://www.google.com/search):'}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-mono">
                    {comparisonData.googleSearchEvaluation.technicalDetails}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isFa
                    ? comparisonData.googleSearchEvaluation.verdictFa
                    : comparisonData.googleSearchEvaluation.verdictEn}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
