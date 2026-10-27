import React, { useState, useEffect, useRef } from 'react';
import { GisMapView } from './GisMapView';
import WeatherDashboardView, {
  getPersianDateString,
  SmallWeatherIcon,
  extractLocalizedCondition
} from './WeatherDashboardView';
import { WeatherIcon } from './common/WeatherIcon';
import { 
  MapPin, 
  Search, 
  RefreshCw, 
  Download, 
  Thermometer, 
  Droplets, 
  Wind, 
  AlertTriangle, 
  Clock,
  Compass,
  FileSpreadsheet,
  FileText,
  CloudRain,
  CloudSun,
  Eye,
  Gauge,
  Sun,
  Activity,
  Cloud
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart as ReBarChart, Bar,
  Cell
} from 'recharts';
import { HeatRecord, WeatherInfo } from '../types';
import { apiDb } from '../services/apiDatabaseClient';
import { centralSync } from '../services/centralSyncService';
import { downloadCsvFile } from '../utils/fileHelpers';
import { 
  bilinearHeatIndex, 
  categorizeHeatStress as categorize, 
  getDangerSubLevel as dangerSubLevel, 
  getActiveWorkPracticeKey, 
  isWeatherRecordStale, 
  getWeatherRecordAgeMinutes,
  resolveWeatherCondition,
  OFF_CHART, 
  RH_COLS, 
  HI_TABLE, 
  T_ROWS, 
  T_MIN, 
  T_MAX, 
  RH_MIN, 
  RH_MAX 
} from '../utils/weatherPhysics';

const HEAT_CONFIG_DB_KEY = 'hse_heat_monitor_config';

interface HeatMonitorDbConfig {
  companyName: string;
  refreshMinutes: number;
  nextRefreshAt: number;
  lastAutoRefreshAt: number;
  locateMode: 'gps' | 'internet' | 'manual';
  activeLocation: {
    lat: number;
    lon: number;
    loc: string;
    source: string;
    accuracy?: number | null;
  };
  gisConfig?: {
    mapLayer: 'google-satellite' | 'google-roadmap' | 'google-hybrid' | 'terrain';
    showWeatherLayer: boolean;
    showHeatStressLayer: boolean;
    showIncidentLayer: boolean;
    showRiskZones: boolean;
    showWorkers: boolean;
    showWindVectors: boolean;
  };
}

interface HeatStressMonitorProps {
  log: HeatRecord[];
  onLogUpdated: (newLog: HeatRecord[]) => void;
  activeRecord: HeatRecord | null;
  setActiveRecord: (rec: HeatRecord | null) => void;
  language: 'en' | 'fa';
  setLanguage: (lang: 'en' | 'fa') => void;
  currentUser?: any;
}

const COMPASS_DIR = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const TRANSLATIONS = {
  en: {
    title: "Heat Stress Monitor Pro",
    sub: "OSHA Heat Index & Field Safety Console",
    location: "Location & Site Settings",
    searchPh: "Search city / province / country...",
    noLoc: "No location selected.",
    refresh: "Refresh Now",
    everyMin: (m: number) => `Every ${m} min`,
    statMaxTemp: "Max Temp",
    statMaxHI: "Max Heat Index",
    statMinTemp: "Min Temp",
    statAvgHum: "Avg Humidity",
    rec: "Safety Recommendations",
    weather: "Current Weather Widgets",
    charts: "Trend Charts",
    log: "Data Log",
    ai: "AI HSE Assistant",
    settings: "Settings",
    refreshTitle: "Auto Refresh",
    stats: "Today's Statistics",
    th: { time: "Time", persian: "Persian Date", temp: "Temp", hum: "RH%", hi: "Heat Index", cat: "Category", loc: "Location", src: "Source" },
    gaugeUnit: "HEAT INDEX °C",
    awaiting: "Awaiting Data",
    noDataYet: "No data yet",
    metrics: { temp: "Air Temp", hum: "Humidity", feels: "Feels Like", wind: "Wind", uv: "UV Index" },
    categories: {
      Normal: { name: "Normal / عادی", risk: "No significant heat-related risk under typical conditions." },
      Caution: { name: "I – Caution / احتیاط", risk: "Work 50 min, Rest 10 min. Water: 250ml every 20 mins. Continuous heat stress monitoring." },
      ExtremeCaution: { name: "II – Extreme Caution / احتیاط شدید", risk: "Work 40 min, Rest 10 min. Water: 250ml every 20 mins. Only light work allowed." },
      Danger: { name: "III – Hazard 1 / خطر ۱", risk: "Work 30 min, Rest 10 min. Water: 250ml every 15 mins. Work under cover." },
      ExtremeDanger: { name: "IV – Hazard 2 / خطر ۲", risk: "Work 20 min, Rest 10 min. Water: 1 cup every 10 mins. Stop working in high places and confined spaces." },
      StopWork: { name: "V – Severe Hazard / خطر شدید", risk: "STOP ALL WORK IMMEDIATELY! Move all personnel to cooled shelters." }
    },
    recos: {
      Normal: ["Maintain routine hydration.", "Continue normal work schedule."],
      Caution: ["Work: 50 min, Rest: 10 min.", "Water: 250 ml every 20 minutes.", "Continuous heat stress monitoring."],
      ExtremeCaution: ["Work: 40 min, Rest: 10 min.", "Water: 250 ml every 20 minutes.", "Only light physical work allowed.", "Provide cooling accessories."],
      Danger: ["Work: 30 min, Rest: 10 min.", "Water: 250 ml every 15 minutes.", "Prefer shaded work areas.", "Buddy system mandatory."],
      ExtremeDanger: ["Work: 20 min, Rest: 10 min.", "Water: 250 ml every 10 minutes.", "Stop confined space work.", "Stop working at height."],
      StopWork: ["STOP ALL WORK IMMEDIATELY!", "Move all personnel to cooled shelters.", "Initiate emergency cooling measures."]
    },
    chartTitle: "General Heat Stress Index",
    chartNote: "Note: Degree of heat stress may vary with age, health, and body characteristics.",
    chartExample: "Example: Temperature is 34°C and RH is 62% → Heat Index is 44°C, in the Danger area.",
    workPracticesTitle: "OSHA Recommended Preventative Work Practices",
    wpHeaders: { cat: "Danger Category", range: "Heat Index (°C)", workRest: "Work:Rest (min)", water: "Water Requirements", controls: "Controls" },
    workPractices: {
      Caution: { cat: "I. Caution", range: "27 – 31", workRest: "50 : 10", water: "250 ml every 20m", controls: "Continuous heat stress monitoring" },
      ExtremeCaution: { cat: "II. Extreme Caution", range: "32 – 38", workRest: "40 : 10", water: "250 ml every 20m", controls: "Only light work allowed" },
      Danger1: { cat: "III. Hazard 1", range: "39 – 49", workRest: "30 : 10", water: "250 ml every 15m", controls: "Work under cover" },
      Danger2: { cat: "IV. Hazard 2", range: "50 – 53", workRest: "20 : 10", water: "1 cup / 10m", controls: "Stop working in high places and confined spaces" },
      StopWork: { cat: "V. Severe Hazard", range: ">= 54", workRest: "STOP", water: "—", controls: "Stop all work" }
    },
    quickQuestions: [
      "Explain today's risk category / محدوده ریسک امروز را توضیح بده",
      "How to prevent heat stroke / چطور از گرمازدگی جلوگیری کنیم؟",
      "Recommended work-rest cycles / چرخه کار و استراحت پیشنهادی چیست؟",
      "Summarize today's heat trend / روند دمایی امروز را خلاصه کن"
    ],
    chatPlaceholderReply: "AI Assist is currently offline or loading. Please double check backend connectivity.",
    ack: "Acknowledge",
    companyNameLabel: "Company Name / نام شرکت"
  },
  fa: {
    title: "پایشگر پیشرفته استرس گرمایی HSE",
    sub: "کنسول ایمنی و پایش شاخص گرما استاندارد OSHA",
    location: "تنظیمات موقعیت مکانی و ایستگاه کاری",
    searchPh: "جستجوی شهر / استان / کشور...",
    noLoc: "موقعیتی انتخاب نشده است.",
    refresh: "بروزرسانی زنده",
    everyMin: (m: number) => `هر ${m} دقیقه`,
    statMaxTemp: "حداکثر دما",
    statMaxHI: "حداکثر شاخص گرما",
    statMinTemp: "حداقل دما",
    statAvgHum: "میانگین رطوبت",
    rec: "توصیه‌های ایمنی کار در گرما",
    weather: "ویجت‌های فرعی هواشناسی",
    charts: "نمودارهای تحلیلی روند استرس",
    log: "تاریخچه داده‌های ثبت شده",
    ai: "دستیار هوشمند ایمنی و بهداشت (HSE)",
    settings: "تنظیمات عمومی",
    refreshTitle: "بروزرسانی خودکار",
    stats: "آمار کارکرد امروز",
    th: { time: "زمان", persian: "تاریخ شمسی", temp: "دما", hum: "رطوبت", hi: "شاخص گرما", cat: "سطح خطر", loc: "ایستگاه", src: "منبع" },
    gaugeUnit: "شاخص گرما °C",
    awaiting: "در انتظار داده",
    noDataYet: "داده‌ای موجود نیست",
    metrics: { temp: "دمای هوا", hum: "رطوبت", feels: "دمای محسوس", wind: "سرعت باد", uv: "شاخص UV" },
    categories: {
      Normal: { name: "Normal / عادی", risk: "در شرایط معمول خطر قابل توجهی مرتبط با گرما وجود ندارد." },
      Caution: { name: "۱. احتیاط (Caution)", risk: "کار ۵۰ دقیقه، استراحت ۱۰ دقیقه. مصرف ۲۵۰ میلی‌لیتر آب هر ۲۰ دقیقه. پایش مداوم." },
      ExtremeCaution: { name: "۲. احتیاط شدید (Extreme Caution)", risk: "کار ۴۰ دقیقه، استراحت ۱۰ دقیقه. مصرف ۲۵۰ میلی‌لیتر آب هر ۲۰ دقیقه. فقط کارهای سبک." },
      Danger: { name: "۳. خطر ۱ (Hazard 1)", risk: "شاخص گرما ۳۹ تا ۴۹. کار در مناطق دارای سایه‌بان." },
      ExtremeDanger: { name: "۴. خطر ۲ (Hazard 2)", risk: "شاخص گرما ۵۰ تا ۵۳. توقف کار در ارتفاع و فضاهای محبوس. ۱ فنجان آب هر ۱۰ دقیقه. چرخه کار ۲۰:۱۰." },
      StopWork: { name: "۵. خطر شدید (Severe Hazard)", risk: "توقف بی قید و شرط کلیه فعالیت‌ها." }
    },
    recos: {
      Normal: ["آبرسانی معمول و منظم روزانه را حفظ کنید.", "برنامه کاری روتین کارگاه را ادامه دهید."],
      Caution: ["کار ۵۰ دقیقه، استراحت ۱۰ دقیقه.", "مصرف ۲۵۰ میلی‌لیتر آب هر ۲۰ دقیقه.", "نظارت و پایش مداوم استرس گرمایی."],
      ExtremeCaution: ["کار ۴۰ دقیقه، استراحت ۱۰ دقیقه.", "مصرف ۲۵۰ میلی‌لیتر آب هر ۲۰ دقیقه.", "فقط انجام فعالیت‌ها و کارهای بدنی سبک.", "تجهیز به جلیقه‌های خنک‌کننده."],
      Danger: ["کار ۳۰ دقیقه، استراحت ۱۰ دقیقه.", "مصرف ۲۵۰ میلی‌لیتر آب هر ۱۵ دقیقه.", "انجام کارها در زیر سایه‌بان.", "الزام به پیاده‌سازی سیستم دونفره (بادی سیستم)."],
      ExtremeDanger: ["کار ۲۰ دقیقه، استراحت ۱۰ دقیقه.", "مصرف ۱ فنجان آب هر ۱۰ دقیقه.", "توقف فوری کار در فضاهای محبوس.", "توقف فوری کارهای در ارتفاع و داربست."],
      StopWork: ["توقف فوری کلیه کارها!", "انتقال اضطراری پرسنل به کانکس‌های خنک کننده.", "آماده‌باش کامل کادر پزشکی و اورژانس سایت."]
    },
    chartTitle: "شاخص عمومی استرس گرمایی",
    chartNote: "توجه: شدت استرس گرمایی بسته به سن، وضعیت سلامت و نوع پوشش بدنی پرسنل متفاوت است.",
    chartExample: "مثال: دمای هوا ۳۴ درجه و رطوبت ۶۲٪ باشد ← شاخص گرما ۴۴ درجه سانتی‌گراد (محدوده خطر) خواهد بود.",
    workPracticesTitle: "شیوه‌های کار پیشگیرانه پیشنهادی استرس گرمایی (OSHA)",
    wpHeaders: { cat: "دسته خطر", range: "محدوده شاخص (°C)", workRest: "چرخه کار:استراحت (دقیقه)", water: "میزان آب مصرفی", controls: "اقدامات کنترلی" },
    workPractices: {
      Caution: { cat: "۱. احتیاط", range: "۲۷ – ۳۱", workRest: "۵۰ : ۱۰", water: "۲۵۰ میلی‌لیتر هر ۲۰ دقیقه", controls: "پایش مداوم استرس گرمایی کارگاه" },
      ExtremeCaution: { cat: "۲. احتیاط شدید", range: "۳۲ – ۳۸", workRest: "۴۰ : ۱۰", water: "۲۵۰ میلی‌لیتر هر ۲۰ دقیقه", controls: "فقط انجام کارهای سبک بدنی" },
      Danger1: { cat: "۳. خطر ۱", range: "۳۹ – ۴۹", workRest: "۳۰ : ۱۰", water: "۲۵۰ میلی‌لیتر هر ۱۵ دقیقه", controls: "انجام کارها در زیر سایه‌بان (Work under cover)" },
      Danger2: { cat: "۴. خطر ۲", range: "۵۰ – ۵۳", workRest: "۲۰ : ۱۰", water: "۱ فنجان هر ۱۰ دقیقه", controls: "توقف کار در فضاهای محبوس و ارتفاع" },
      StopWork: { cat: "۵. خطر شدید", range: ">= ۵۴", workRest: "توقف کامل", water: "—", controls: "توقف تمام کارها (Stop all work)" }
    },
    quickQuestions: [
      "محدوده ریسک امروز را توضیح بده",
      "چطور از گرمازدگی جلوگیری کنیم؟",
      "چرخه کار و استراحت پیشنهادی چیست؟",
      "روند دمایی امروز را خلاصه کن"
    ],
    chatPlaceholderReply: "ارتباط با سرور هوش مصنوعی برقرار نشد یا کلید API تنظیم نشده است. لطفاً وضعیت اینترنت یا متغیرهای محیطی را بررسی کنید.",
    ack: "تأیید و بستن هشدار",
    companyNameLabel: "نام شرکت / سایت کارگاهی"
  }
};

const CAT_COLOR = {
  Normal: '#10b981',          // Green (Safe)
  Caution: '#eab308',         // Yellow (Caution)
  ExtremeCaution: '#f97316',  // Orange (Extreme Caution)
  Danger: '#dc2626',          // Red (Danger)
  ExtremeDanger: '#991b1b',   // Dark Red (Extreme Danger)
  StopWork: '#7f1d1d'         // Deepest Red
};

const INDUSTRIAL_SITES = [
  { name: "Bandar Imam Khomeini SEZ", nameFa: "بندر امام خمینی (منطقه ویژه پتروشیمی)", lat: 30.471003, lon: 49.090324 },
  { name: "Assaluyeh Petrochemical (Zone 1)", nameFa: "عسلویه (پارس جنوبی)", lat: 27.4815, lon: 52.6175 },
  { name: "Bandar Abbas Petrochemical", nameFa: "بندرعباس (پتروشیمی)", lat: 27.1471, lon: 56.1264 },
  { name: "Ahvaz Industrial Complex", nameFa: "اهواز (مجتمع صنعتی)", lat: 31.3203, lon: 48.6836 },
  { name: "Tehran Petrochemical", nameFa: "تهران (پتروشیمی)", lat: 35.5397, lon: 51.4253 }
];

export default function HeatStressMonitor({
  log: rawLog,
  onLogUpdated,
  activeRecord,
  setActiveRecord,
  language,
  setLanguage
}: HeatStressMonitorProps) {
  const isFa = language === 'fa';
  const L = TRANSLATIONS[language];
  const log = Array.isArray(rawLog) ? rawLog : [];

  const safeFixed = (val: any, decimals = 1): string => {
    const num = Number(val);
    return !isNaN(num) ? num.toFixed(decimals) : (decimals === 0 ? '0' : '0.0');
  };

  // Map & Location states
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('HSE Field Monitor');
  
  // Weather Info states
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Auto refresh states
  const [refreshMinutes, setRefreshMinutes] = useState(30);
  const [secondsLeft, setSecondsLeft] = useState(1800);
  
  // Visual states
  const [chartTab, setChartTab] = useState<'line' | 'summary' | 'matrix' | 'forecast'>('line');
  const [forecastView, setForecastView] = useState<'hourly' | 'daily'>('hourly');
  const [showAlertOverlay, setShowAlertOverlay] = useState(false);
  const [alertDetails, setAlertDetails] = useState({ title: '', sub: '', color: '' });

  // GIS map layers and states
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showWindVectors, setShowWindVectors] = useState(true);
  const [showWorkers, setShowWorkers] = useState(true);

  // Module tab state — Default to 'weather' («هواشناسی») on first entry!
  const [mapViewMode, setMapViewMode] = useState<'weather' | 'analytics' | 'map'>('weather');
  const [mapLayer, setMapLayer] = useState<'google-satellite' | 'google-roadmap' | 'google-hybrid' | 'terrain'>('google-satellite');
  const [showWeatherLayer, setShowWeatherLayer] = useState(true);
  const [showHeatStressLayer, setShowHeatStressLayer] = useState(true);
  const [showIncidentLayer, setShowIncidentLayer] = useState(true);
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  
  // References for latest state in async/timer callbacks (prevents stale closures)
  const logRef = useRef<HeatRecord[]>(log);
  useEffect(() => {
    logRef.current = log;
  }, [log]);

  const gpsWatchIdRef = useRef<number | null>(null);
  const triggerWeatherRefreshRef = useRef<any>(null);
  const runScheduledAutoRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const companySaveTimerRef = useRef<any>(null);

  const countdownIntervalRef = useRef<any>(null);
  const refreshMinutesRef = useRef<number>(30);
  const nextRefreshAtRef = useRef<number>(Date.now() + 30 * 60 * 1000);
  const locateModeRef = useRef<'gps' | 'internet' | 'manual'>('auto' as any);
  const isConfigHydratedRef = useRef<boolean>(false);

  const lastFetchedLocationRef = useRef<{ lat: number; lon: number; loc: string; source: string; accuracy?: number | null }>({
    lat: 30.471003,
    lon: 49.090324,
    loc: 'منطقه ویژه اقتصادی بندر امام خمینی، ایران',
    source: 'Industrial Reference Hub',
    accuracy: null
  });
  const isFetchingRef = useRef<boolean>(false);
  const prevAlertCategoryRef = useRef<string>('Normal');

  // Persist unified Heat Stress module configuration to the main database (zero browser storage)
  const persistHeatMonitorConfigToDb = (overrides: Partial<HeatMonitorDbConfig> = {}) => {
    const payload: HeatMonitorDbConfig = {
      companyName: overrides.companyName !== undefined ? overrides.companyName : companyName,
      refreshMinutes: overrides.refreshMinutes !== undefined ? overrides.refreshMinutes : refreshMinutesRef.current,
      nextRefreshAt: overrides.nextRefreshAt !== undefined ? overrides.nextRefreshAt : nextRefreshAtRef.current,
      lastAutoRefreshAt: overrides.lastAutoRefreshAt !== undefined ? overrides.lastAutoRefreshAt : Date.now(),
      locateMode: overrides.locateMode !== undefined ? overrides.locateMode : (locateModeRef.current || 'manual'),
      activeLocation: overrides.activeLocation !== undefined ? overrides.activeLocation : lastFetchedLocationRef.current,
      gisConfig: overrides.gisConfig !== undefined ? overrides.gisConfig : {
        mapLayer,
        showWeatherLayer,
        showHeatStressLayer,
        showIncidentLayer,
        showRiskZones,
        showWorkers,
        showWindVectors
      }
    };
    centralSync.persistSetting(HEAT_CONFIG_DB_KEY, payload, 'Heat Stress Monitor Configuration');
    apiDb.saveSetting(HEAT_CONFIG_DB_KEY, payload, 'Heat Stress Monitor Configuration').catch(console.error);
  };

  // --- Accurate Reverse Geocoding & Location Resolution (GPS + Internet IP) ---
  const reverseGeocodeCoordinates = async (lat: number, lon: number, fallbackCity?: string): Promise<string> => {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
      if (res.ok) {
        const geo = await res.json();
        const label = geo.displayName || [geo.locality, geo.city, geo.countryName].filter(Boolean).join('، ');
        if (label && label.trim().length > 0) return label;
      }
    } catch {}
    return fallbackCity || `${safeFixed(lat, 4)}, ${safeFixed(lon, 4)}`;
  };

  const extractLocationFromInternet = async (): Promise<{ lat: number; lon: number; loc: string; source: string; accuracy: number | null } | null> => {
    // 1. Client-side BigDataCloud IP Geolocation (resolves user's browser public IP directly with Persian locality)
    try {
      const bdcRes = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=fa', {
        signal: AbortSignal.timeout(4000)
      });
      if (bdcRes.ok) {
        const bdc = await bdcRes.json();
        if (typeof bdc.latitude === 'number' && typeof bdc.longitude === 'number') {
          const fallbackName = [bdc.locality || bdc.city, bdc.principalSubdivision, bdc.countryName].filter(Boolean).join('، ');
          const preciseName = await reverseGeocodeCoordinates(bdc.latitude, bdc.longitude, fallbackName);
          return {
            lat: bdc.latitude,
            lon: bdc.longitude,
            loc: preciseName,
            source: 'Internet / IP Geolocation',
            accuracy: null
          };
        }
      }
    } catch {}

    // 2. Client-side ipwho.is lookup
    try {
      const ipRes = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData && ipData.success !== false && typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
          const fallbackName = [ipData.city, ipData.region, ipData.country].filter(Boolean).join('، ');
          const preciseName = await reverseGeocodeCoordinates(ipData.latitude, ipData.longitude, fallbackName);
          return {
            lat: ipData.latitude,
            lon: ipData.longitude,
            loc: preciseName,
            source: 'Internet / IP Geolocation',
            accuracy: null
          };
        }
      }
    } catch {}

    // 3. Backend /api/ip-location fallback
    try {
      const srvRes = await fetch('/api/ip-location');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData && !srvData.error && typeof srvData.lat === 'number' && typeof srvData.lon === 'number') {
          const fallbackName = [srvData.city, srvData.region, srvData.countryName].filter(Boolean).join('، ');
          const preciseName = await reverseGeocodeCoordinates(srvData.lat, srvData.lon, fallbackName);
          return {
            lat: srvData.lat,
            lon: srvData.lon,
            loc: preciseName,
            source: 'Internet / IP Geolocation',
            accuracy: null
          };
        }
      }
    } catch {}

    return null;
  };

  const extractGpsPositionPromise = (timeoutMs = 8000): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
      );
    });
  };

  const stopLiveTracking = () => {
    if (gpsWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
  };

  // Unified accurate location resolver: GPS first -> automatic fallback to Internet IP -> updates DB & weather
  const resolveAccurateLocation = async (
    mode: 'auto' | 'gps' | 'internet' = 'auto',
    options: { isManual?: boolean; recordInHistory?: boolean; enableWatch?: boolean } = {}
  ) => {
    const { isManual = true, recordInHistory = true, enableWatch = false } = options;
    setGpsLoading(true);
    setGpsPermissionDenied(false);

    try {
      if (mode === 'gps' || mode === 'auto') {
        const gpsPos = await extractGpsPositionPromise(8000);
        if (gpsPos) {
          const lat = gpsPos.coords.latitude;
          const lon = gpsPos.coords.longitude;
          const acc = gpsPos.coords.accuracy;
          setGpsAccuracy(acc);
          locateModeRef.current = 'gps';

          const locLabel = await reverseGeocodeCoordinates(lat, lon);
          await triggerWeatherRefresh(lat, lon, locLabel, 'GPS Live Tracking', {
            isManual,
            forceBypassCache: true,
            recordInHistory,
            accuracy: acc,
            locateMode: 'gps'
          });

          if (enableWatch && typeof navigator !== 'undefined' && navigator.geolocation) {
            stopLiveTracking();
            gpsWatchIdRef.current = navigator.geolocation.watchPosition(
              async (watchPos) => {
                const wLat = watchPos.coords.latitude;
                const wLon = watchPos.coords.longitude;
                const prev = lastFetchedLocationRef.current;
                const movedSignificantly =
                  Math.abs(wLat - prev.lat) > 0.0015 || Math.abs(wLon - prev.lon) > 0.0015;
                if (movedSignificantly && !isFetchingRef.current) {
                  setGpsAccuracy(watchPos.coords.accuracy);
                  const wLabel = await reverseGeocodeCoordinates(wLat, wLon);
                  await triggerWeatherRefresh(wLat, wLon, wLabel, 'GPS Live Tracking', {
                    isManual: false,
                    forceBypassCache: true,
                    recordInHistory: true,
                    accuracy: watchPos.coords.accuracy,
                    locateMode: 'gps'
                  });
                }
              },
              () => {},
              { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
            );
          }
          setGpsLoading(false);
          return;
        }
      }

      // Automatic fallback or explicit Internet IP geolocation
      const netLoc = await extractLocationFromInternet();
      if (netLoc) {
        setGpsAccuracy(null);
        locateModeRef.current = 'internet';
        await triggerWeatherRefresh(netLoc.lat, netLoc.lon, netLoc.loc, netLoc.source, {
          isManual,
          forceBypassCache: true,
          recordInHistory,
          accuracy: null,
          locateMode: 'internet'
        });
        setGpsLoading(false);
        return;
      }

      if (mode === 'gps') {
        setGpsPermissionDenied(true);
      }
    } finally {
      setGpsLoading(false);
    }
  };

  const startLiveTracking = () => {
    resolveAccurateLocation('auto', { isManual: true, recordInHistory: true, enableWatch: true });
  };

  const handleGpsLocation = () => {
    resolveAccurateLocation('auto', { isManual: true, recordInHistory: true, enableWatch: false });
  };

  const handleCitySearchInput = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const r = await fetch(`/api/geocode?query=${encodeURIComponent(query)}`);
      const j = await r.json();
      setSuggestions(j.results || []);
    } catch (e) {
      console.error(e);
    }
  };

  const selectSuggestion = async (s: any) => {
    setSearchQuery(s.name);
    setSuggestions([]);
    setGpsAccuracy(null);
    stopLiveTracking();
    locateModeRef.current = 'manual';
    const cityLabel = `${s.name}${s.admin1 ? '، ' + s.admin1 : ''}${s.country ? '، ' + s.country : ''}`;
    await triggerWeatherRefresh(s.latitude, s.longitude, cityLabel, 'Manual Search', {
      isManual: true,
      forceBypassCache: true,
      recordInHistory: true,
      accuracy: null,
      locateMode: 'manual'
    });
  };

  const triggerWeatherRefresh = async (
    lat: number, 
    lon: number, 
    locationName: string, 
    source: string,
    options: {
      isManual?: boolean;
      isAutoScheduled?: boolean;
      forceBypassCache?: boolean;
      recordInHistory?: boolean;
      accuracy?: number | null;
      locateMode?: 'gps' | 'internet' | 'manual';
    } = {}
  ) => {
    const {
      isManual = false,
      isAutoScheduled = false,
      forceBypassCache = false,
      recordInHistory = isManual || isAutoScheduled,
      accuracy = gpsAccuracy,
      locateMode = locateModeRef.current || 'manual'
    } = options;

    // Prevent overlapping concurrent network requests
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;

    try {
      setSearchLoading(true);
      setWeatherError(null);
      const clientTs = Date.now();
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran';
      const tzOffsetMin = new Date().getTimezoneOffset();
      const res = await fetch(
        `/api/weather?lat=${lat}&lon=${lon}&refresh=true&clientTs=${clientTs}&clientTz=${encodeURIComponent(clientTz)}&tzOffsetMin=${tzOffsetMin}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        throw new Error(data?.message || (isFa ? 'عدم دسترسی به سرویس هواشناسی معتبر یا قطع ارتباط شبکه.' : 'Weather service unavailable or network disconnected.'));
      }

      const tempC = Number(data.tempC);
      const hum = Number(data.hum);
      const isDay = data.isDay !== undefined ? Boolean(data.isDay) : true;
      const cloud = data.cloud !== undefined ? Number(data.cloud) : 0;
      const pm10Val = data.pm10 !== undefined ? Number(data.pm10) : undefined;
      const resolvedLocationName = locationName || data.locationName || 'ایستگاه پایش';
      const resolvedSource = data.source || data.provider || source || 'MET Norway (Yr.no)';
      const resolvedCondObj = resolveWeatherCondition(data.code ?? 0, {
        isDay,
        cloudCover: cloud,
        pm10: pm10Val
      });
      const resolvedCondition = data.condition || resolvedCondObj.combinedLabel;

      lastFetchedLocationRef.current = {
        lat,
        lon,
        loc: resolvedLocationName,
        source: resolvedSource,
        accuracy: accuracy ?? null
      };

      const hiResult = bilinearHeatIndex(tempC, hum);
      const hi = data.hi !== undefined ? Number(data.hi) : (hiResult.offChart ? 54 : (hiResult.value || tempC));
      const offChart = data.offChart !== undefined ? Boolean(data.offChart) : hiResult.offChart;
      const hiDisplay = data.hiDisplay || (offChart ? OFF_CHART : safeFixed(hi, 1));
      const cat = data.cat || categorize(hi, offChart);
      const subLevel = data.subLevel !== undefined ? data.subLevel : (cat === 'Danger' ? dangerSubLevel(hi) : null);

      const weather: WeatherInfo = {
        tempC,
        hum,
        feels: data.feels !== undefined ? Number(data.feels) : tempC,
        wind: data.wind !== undefined ? Number(data.wind) : 0,
        windDir: data.windDir !== undefined ? Number(data.windDir) : 0,
        cloud,
        pressure: data.pressure !== undefined ? Number(data.pressure) : 1013,
        visibility: data.visibility !== undefined && data.visibility !== null ? String(data.visibility) : '--',
        code: data.code ?? resolvedCondObj.code,
        sunrise: data.sunrise || '--:--',
        sunset: data.sunset || '--:--',
        uv: data.uv !== undefined ? Number(data.uv) : 0,
        isDay,
        observedAt: data.observedAt || new Date().toISOString(),
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        hi,
        hiDisplay,
        offChart,
        cat,
        subLevel,
        wbgt: data.wbgt,
        wbgtShade: data.wbgtShade,
        wbgtIsEstimated: data.wbgtIsEstimated !== undefined ? data.wbgtIsEstimated : true,
        wbgtMethod: data.wbgtMethod,
        wbgtNoteFa: data.wbgtNoteFa,
        wbgtNoteEn: data.wbgtNoteEn,
        globeTemp: data.globeTemp,
        solarRadiation: data.solarRadiation,
        dewPoint: data.dewPoint,
        wetBulb: data.wetBulb,
        aqi: data.aqi,
        pm25: data.pm25,
        pm10: pm10Val,
        co: data.co,
        so2: data.so2,
        no2: data.no2,
        o3: data.o3,
        elevation: data.elevation,
        rainProb: data.rainProb,
        rainAmount: data.rainAmount,
        dayLength: data.dayLength,
        provider: data.provider || data.source || "MET Norway (Yr.no)",
        source: data.source || data.provider || "MET Norway (Yr.no)",
        cached: data.cached || false,
        hourlyForecast: data.hourlyForecast,
        dailyForecast: data.dailyForecast,
        updated: new Date(data.observedAt || Date.now()).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      };

      setWeatherInfo(weather);

      const currentLogs = Array.isArray(logRef.current) ? logRef.current : [];
      const shouldRecordInHistory = recordInHistory || currentLogs.length === 0;

      // Create new record with full meteorological and thermal telemetry
      const newRecord: HeatRecord = {
        id: shouldRecordInHistory
          ? 'hr' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
          : (activeRecord?.id || currentLogs[0]?.id || 'hr' + Date.now().toString(36)),
        ts: data.observedAt || new Date().toISOString(),
        observedAt: weather.observedAt,
        fetchedAt: weather.fetchedAt,
        tempC,
        hum,
        hi,
        hiDisplay,
        offChart,
        cat,
        subLevel,
        loc: resolvedLocationName,
        lat,
        lon,
        source: resolvedSource,
        condition: resolvedCondition,
        code: weather.code,
        sunrise: weather.sunrise,
        sunset: weather.sunset,
        persianDate: shouldRecordInHistory
          ? getPersianDateString(new Date())
          : (activeRecord?.persianDate || currentLogs[0]?.persianDate || getPersianDateString(new Date())),
        accuracy: accuracy ?? null,
        wind: weather.wind,
        feels: weather.feels,
        cloud: weather.cloud,
        pressure: weather.pressure,
        visibility: weather.visibility,
        uv: weather.uv,
        isDay: weather.isDay,
        aqi: weather.aqi,
        windDir: weather.windDir,
        wbgt: weather.wbgt,
        wbgtShade: weather.wbgtShade,
        wbgtIsEstimated: weather.wbgtIsEstimated,
        wbgtMethod: weather.wbgtMethod,
        wbgtNoteFa: weather.wbgtNoteFa,
        wbgtNoteEn: weather.wbgtNoteEn,
        globeTemp: weather.globeTemp,
        solarRadiation: weather.solarRadiation,
        dewPoint: weather.dewPoint,
        wetBulb: weather.wetBulb,
        pm25: weather.pm25,
        pm10: weather.pm10,
        co: weather.co,
        so2: weather.so2,
        no2: weather.no2,
        o3: weather.o3,
        elevation: weather.elevation,
        rainProb: weather.rainProb,
        rainAmount: weather.rainAmount,
        dayLength: weather.dayLength,
        provider: weather.provider,
        cached: Boolean(data.cached),
        hourlyForecast: weather.hourlyForecast,
        dailyForecast: weather.dailyForecast
      };

      setActiveRecord(newRecord);

      if (shouldRecordInHistory) {
        const updatedLogs = [newRecord, ...currentLogs.filter(l => l.id !== newRecord.id)].slice(0, 300);
        logRef.current = updatedLogs;
        onLogUpdated(updatedLogs);

        // Reset synchronized auto-refresh timer and persist to main database
        const mins = Math.max(1, refreshMinutesRef.current || 30);
        const nextTarget = Date.now() + mins * 60 * 1000;
        nextRefreshAtRef.current = nextTarget;
        setSecondsLeft(mins * 60);

        persistHeatMonitorConfigToDb({
          refreshMinutes: mins,
          nextRefreshAt: nextTarget,
          lastAutoRefreshAt: Date.now(),
          locateMode,
          activeLocation: lastFetchedLocationRef.current
        });
      }

      // Trigger critical heat alert only on manual trigger or escalated status
      if (cat !== 'Normal' && cat !== 'Caution' && cat !== prevAlertCategoryRef.current && (isManual || isAutoScheduled)) {
        setAlertDetails({
          title: TRANSLATIONS[language].categories[cat]?.name || cat,
          sub: TRANSLATIONS[language].categories[cat]?.risk || '',
          color: CAT_COLOR[cat] || '#ef4444'
        });
        setShowAlertOverlay(true);
        triggerSoundAlert();
      }
      prevAlertCategoryRef.current = cat;

    } catch (err: any) {
      console.warn('[HeatStress] Weather refresh notice:', err);
      setWeatherError(
        err?.message ||
          (isFa
            ? 'ارتباط با سرویس هواشناسی برقرار نشد. اطلاعات ساختگی نمایش داده نمی‌شود.'
            : 'Unable to reach weather service. Synthetic data is not displayed.')
      );
    } finally {
      isFetchingRef.current = false;
      setSearchLoading(false);
    }
  };

  // Scheduled Auto-Refresh Runner: refreshes GPS/Internet coordinates if active, fetches live weather, and inserts into History DB
  const runScheduledAutoRefresh = async () => {
    const mode = locateModeRef.current;
    let target = { ...lastFetchedLocationRef.current };

    if (mode === 'gps') {
      const gpsPos = await extractGpsPositionPromise(6000);
      if (gpsPos) {
        const lat = gpsPos.coords.latitude;
        const lon = gpsPos.coords.longitude;
        const acc = gpsPos.coords.accuracy;
        setGpsAccuracy(acc);
        const locName = await reverseGeocodeCoordinates(lat, lon, target.loc);
        target = { lat, lon, loc: locName, source: 'Auto Scheduled (GPS)', accuracy: acc };
      } else {
        const netLoc = await extractLocationFromInternet();
        if (netLoc) {
          target = { lat: netLoc.lat, lon: netLoc.lon, loc: netLoc.loc, source: 'Auto Scheduled (Internet IP)', accuracy: null };
        }
      }
    } else if (mode === 'internet') {
      const netLoc = await extractLocationFromInternet();
      if (netLoc) {
        target = { lat: netLoc.lat, lon: netLoc.lon, loc: netLoc.loc, source: 'Auto Scheduled (Internet IP)', accuracy: null };
      }
    }

    if (triggerWeatherRefreshRef.current) {
      await triggerWeatherRefreshRef.current(
        target.lat,
        target.lon,
        target.loc,
        target.source || 'Auto Scheduled System',
        {
          isManual: false,
          isAutoScheduled: true,
          forceBypassCache: true,
          recordInHistory: true,
          accuracy: target.accuracy ?? null,
          locateMode: mode
        }
      );
    }
  };

  // Sync callbacks to refs to prevent stale closures
  useEffect(() => {
    triggerWeatherRefreshRef.current = triggerWeatherRefresh;
    runScheduledAutoRefreshRef.current = runScheduledAutoRefresh;
  });

  // Clean up GPS watch on unmount
  useEffect(() => {
    return () => {
      stopLiveTracking();
      if (companySaveTimerRef.current) clearTimeout(companySaveTimerRef.current);
    };
  }, []);

  // Apply remote configuration object from main database
  const applyRemoteConfig = (cfg: Partial<HeatMonitorDbConfig>, triggerDueRefresh = false) => {
    if (!cfg || typeof cfg !== 'object') return;
    if (typeof cfg.companyName === 'string' && cfg.companyName.trim().length > 0) {
      setCompanyName(cfg.companyName);
    }
    const validMins = typeof cfg.refreshMinutes === 'number' && cfg.refreshMinutes >= 1 ? cfg.refreshMinutes : refreshMinutesRef.current;
    refreshMinutesRef.current = validMins;
    setRefreshMinutes(validMins);

    if (cfg.locateMode) {
      locateModeRef.current = cfg.locateMode;
    }
    if (cfg.activeLocation && typeof cfg.activeLocation.lat === 'number' && typeof cfg.activeLocation.lon === 'number') {
      lastFetchedLocationRef.current = cfg.activeLocation;
      if (cfg.activeLocation.accuracy !== undefined) {
        setGpsAccuracy(cfg.activeLocation.accuracy);
      }
    }
    if (cfg.gisConfig) {
      if (cfg.gisConfig.mapLayer) setMapLayer(cfg.gisConfig.mapLayer);
      if (typeof cfg.gisConfig.showWeatherLayer === 'boolean') setShowWeatherLayer(cfg.gisConfig.showWeatherLayer);
      if (typeof cfg.gisConfig.showHeatStressLayer === 'boolean') setShowHeatStressLayer(cfg.gisConfig.showHeatStressLayer);
      if (typeof cfg.gisConfig.showIncidentLayer === 'boolean') setShowIncidentLayer(cfg.gisConfig.showIncidentLayer);
      if (typeof cfg.gisConfig.showRiskZones === 'boolean') setShowRiskZones(cfg.gisConfig.showRiskZones);
      if (typeof cfg.gisConfig.showWorkers === 'boolean') setShowWorkers(cfg.gisConfig.showWorkers);
      if (typeof cfg.gisConfig.showWindVectors === 'boolean') setShowWindVectors(cfg.gisConfig.showWindVectors);
    }

    const now = Date.now();
    if (typeof cfg.nextRefreshAt === 'number' && cfg.nextRefreshAt > now) {
      nextRefreshAtRef.current = cfg.nextRefreshAt;
      setSecondsLeft(Math.max(1, Math.ceil((cfg.nextRefreshAt - now) / 1000)));
    } else if (triggerDueRefresh && typeof cfg.nextRefreshAt === 'number' && cfg.nextRefreshAt <= now) {
      const nextTarget = now + validMins * 60 * 1000;
      nextRefreshAtRef.current = nextTarget;
      setSecondsLeft(validMins * 60);
      if (runScheduledAutoRefreshRef.current) {
        runScheduledAutoRefreshRef.current();
      }
    }
  };

  // Initial mount: hydrate config & logs from main database, resolve accurate location if first run, and sync real-time updates across all users
  useEffect(() => {
    let isMounted = true;

    const hydrateFromDatabase = async () => {
      try {
        const [savedCfg, savedLogs] = await Promise.all([
          apiDb.getSetting(HEAT_CONFIG_DB_KEY).catch(() => null),
          apiDb.getSetting('hse_heat_log').catch(() => null)
        ]);
        if (!isMounted) return;

        const dbLogs: HeatRecord[] = Array.isArray(savedLogs) ? savedLogs : logRef.current;
        if (Array.isArray(savedLogs) && savedLogs.length > 0 && logRef.current.length === 0) {
          logRef.current = savedLogs;
        }

        if (savedCfg && typeof savedCfg === 'object') {
          isConfigHydratedRef.current = true;
          const now = Date.now();
          const isOverdue = typeof savedCfg.nextRefreshAt === 'number' && savedCfg.nextRefreshAt <= now;
          applyRemoteConfig(savedCfg, isOverdue);

          if (!isOverdue) {
            // Hydrate live weather forecast telemetry directly from live provider (never stale cache)
            const loc = savedCfg.activeLocation || (dbLogs[0] ? { lat: dbLogs[0].lat, lon: dbLogs[0].lon, loc: dbLogs[0].loc, source: dbLogs[0].source } : lastFetchedLocationRef.current);
            if (loc && typeof loc.lat === 'number' && typeof loc.lon === 'number') {
              await triggerWeatherRefresh(loc.lat, loc.lon, loc.loc, loc.source || 'Database Station', {
                isManual: false,
                isAutoScheduled: false,
                forceBypassCache: true,
                recordInHistory: dbLogs.length === 0
              });
            }
          }
        } else {
          // First time initialization in database: extract accurate GPS / Internet location and persist
          isConfigHydratedRef.current = true;
          const initialMins = refreshMinutesRef.current || 30;
          nextRefreshAtRef.current = Date.now() + initialMins * 60 * 1000;
          setSecondsLeft(initialMins * 60);
          await resolveAccurateLocation('auto', {
            isManual: false,
            recordInHistory: dbLogs.length === 0,
            enableWatch: false
          });
        }
      } catch {
        isConfigHydratedRef.current = true;
      }
    };

    hydrateFromDatabase();

    // Listen to real-time WebSocket mutations so any change by any user is immediately applied
    const handleRemoteSync = (e: any) => {
      const detail = e?.detail;
      const entity = String(detail?.entityType || detail?.entity || detail?.key || '').toLowerCase();
      if (entity === HEAT_CONFIG_DB_KEY || (detail?.key === HEAT_CONFIG_DB_KEY && detail?.value)) {
        applyRemoteConfig(detail.value || detail.data || detail, false);
        return;
      }
      if (entity.includes('heat') || entity.includes('setting')) {
        apiDb.invalidateCache('settings');
        apiDb.getSetting(HEAT_CONFIG_DB_KEY).then((remoteCfg) => {
          if (isMounted && remoteCfg) {
            applyRemoteConfig(remoteCfg, false);
          }
        }).catch(() => {});
      }
    };

    window.addEventListener('hse_data_mutated', handleRemoteSync);
    window.addEventListener('hse_heat_log_updated', handleRemoteSync);
    window.addEventListener('hse_central_data_synced', handleRemoteSync);

    return () => {
      isMounted = false;
      window.removeEventListener('hse_data_mutated', handleRemoteSync);
      window.removeEventListener('hse_heat_log_updated', handleRemoteSync);
      window.removeEventListener('hse_central_data_synced', handleRemoteSync);
    };
  }, []);

  // Sync weatherInfo state on active record change to support precise historical telemetry clicking across all tabs
  useEffect(() => {
    if (activeRecord) {
      setWeatherInfo(prev => ({
        tempC: activeRecord.tempC,
        hum: activeRecord.hum,
        feels: activeRecord.feels !== undefined ? activeRecord.feels : activeRecord.tempC,
        wind: activeRecord.wind !== undefined ? activeRecord.wind : 0,
        windDir: activeRecord.windDir !== undefined ? activeRecord.windDir : 0,
        cloud: activeRecord.cloud !== undefined ? activeRecord.cloud : 0,
        pressure: activeRecord.pressure !== undefined ? activeRecord.pressure : 1013,
        visibility: activeRecord.visibility !== undefined ? activeRecord.visibility : '--',
        code: activeRecord.code !== undefined ? activeRecord.code : (prev?.code ?? 0),
        sunrise: activeRecord.sunrise || activeRecord.dailyForecast?.[0]?.sunrise || prev?.sunrise || '--:--',
        sunset: activeRecord.sunset || activeRecord.dailyForecast?.[0]?.sunset || prev?.sunset || '--:--',
        uv: activeRecord.uv !== undefined ? activeRecord.uv : 0,
        isDay: activeRecord.isDay !== undefined ? activeRecord.isDay : (prev?.isDay ?? true),
        observedAt: activeRecord.observedAt || activeRecord.ts || prev?.observedAt,
        fetchedAt: activeRecord.fetchedAt || prev?.fetchedAt,
        hi: activeRecord.hi,
        hiDisplay: activeRecord.hiDisplay,
        offChart: activeRecord.offChart,
        cat: activeRecord.cat,
        subLevel: activeRecord.subLevel,
        wbgt: activeRecord.wbgt ?? prev?.wbgt,
        wbgtShade: activeRecord.wbgtShade ?? prev?.wbgtShade,
        wbgtIsEstimated: activeRecord.wbgtIsEstimated ?? prev?.wbgtIsEstimated ?? true,
        wbgtMethod: activeRecord.wbgtMethod ?? prev?.wbgtMethod,
        wbgtNoteFa: activeRecord.wbgtNoteFa ?? prev?.wbgtNoteFa,
        wbgtNoteEn: activeRecord.wbgtNoteEn ?? prev?.wbgtNoteEn,
        globeTemp: activeRecord.globeTemp ?? prev?.globeTemp,
        solarRadiation: activeRecord.solarRadiation ?? prev?.solarRadiation,
        dewPoint: activeRecord.dewPoint ?? prev?.dewPoint,
        wetBulb: activeRecord.wetBulb ?? prev?.wetBulb,
        aqi: activeRecord.aqi ?? prev?.aqi,
        pm25: activeRecord.pm25 ?? prev?.pm25,
        pm10: activeRecord.pm10 ?? prev?.pm10,
        co: activeRecord.co ?? prev?.co,
        so2: activeRecord.so2 ?? prev?.so2,
        no2: activeRecord.no2 ?? prev?.no2,
        o3: activeRecord.o3 ?? prev?.o3,
        elevation: activeRecord.elevation ?? prev?.elevation,
        rainProb: activeRecord.rainProb ?? prev?.rainProb,
        rainAmount: activeRecord.rainAmount ?? prev?.rainAmount,
        dayLength: activeRecord.dayLength || prev?.dayLength,
        provider: activeRecord.provider || prev?.provider || "MET Norway (Yr.no)",
        source: activeRecord.provider || activeRecord.source || prev?.source || "MET Norway (Yr.no)",
        cached: activeRecord.cached,
        hourlyForecast: activeRecord.hourlyForecast || prev?.hourlyForecast,
        dailyForecast: activeRecord.dailyForecast || prev?.dailyForecast,
        updated: new Date(activeRecord.observedAt || activeRecord.ts).toLocaleTimeString(isFa ? 'fa-IR' : [], { hour: '2-digit', minute: '2-digit' })
      }));
    }
  }, [activeRecord]);

  // --- Exact Wall-Clock Synchronized Auto-Refresh Countdown ---
  useEffect(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      if (!isConfigHydratedRef.current) return;
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((nextRefreshAtRef.current - now) / 1000));
      setSecondsLeft(remaining);

      if (remaining <= 0 && !isFetchingRef.current) {
        const mins = Math.max(1, refreshMinutesRef.current || 30);
        nextRefreshAtRef.current = now + mins * 60 * 1000;
        setSecondsLeft(mins * 60);
        if (runScheduledAutoRefreshRef.current) {
          runScheduledAutoRefreshRef.current();
        }
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Ensure page stays at the top upon entering the Heat Stress Monitoring module
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // --- Audio Alerts ---
  const triggerSoundAlert = () => {
    try {
      const Actx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Actx) return;
      const ctx = new Actx();
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'square';
        o.frequency.value = 880;
        o.connect(g);
        g.connect(ctx.destination);
        const start = ctx.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
        o.start(start);
        o.stop(start + 0.32);
      }
    } catch {
      // Audio autoplay policy handled safely
    }
  };



  // --- Reporting & Exports ---
  const handleExportCSV = () => {
    const headers = [
      'Timestamp (UTC)', 'Persian Date', 'Temperature (°C)', 'Humidity (%)', 
      'Heat Stress Index (°C)', 'WBGT (°C)', 'AQI', 'Wind Speed (km/h)', 
      'Barometric Pressure (hPa)', 'Risk Level', 'Supervisor', 'Department', 'Weather Source'
    ];
    const rows = log.map(r => [
      r.ts, r.persianDate, r.tempC, r.hum, r.hiDisplay, 
      r.wbgt !== undefined ? r.wbgt : '--', 
      r.aqi !== undefined ? r.aqi : '--', 
      r.wind !== undefined ? r.wind : '--', 
      r.pressure !== undefined ? r.pressure : '--', 
      r.cat, 
      r.supervisor || "--", 
      r.department || "--", 
      r.source
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    downloadCsvFile(`HSE_HeatStress_Log_${companyName.replace(/\s+/g, '_')}.csv`, csvContent);
  };

  const handleExportXLSX = () => {
    const XLSX_ = (window as any).XLSX;
    if (!XLSX_) {
      alert("Excel export library is loading... Please wait.");
      return;
    }
    const headers: (string | number)[] = [
      'Time', 'Persian Date', 'Temp (°C)', 'Humidity (%)', 
      'Heat Index (°C)', 'WBGT (°C)', 'AQI', 'Wind (km/h)', 
      'Pressure (hPa)', 'Risk Level', 'Supervisor', 'Department', 'Source'
    ];
    const rows: (string | number)[][] = log.map(r => [
      new Date(r.ts).toLocaleString('fa-IR'), r.persianDate, r.tempC, r.hum, r.hiDisplay, 
      r.wbgt !== undefined ? r.wbgt : '--', 
      r.aqi !== undefined ? r.aqi : '--', 
      r.wind !== undefined ? r.wind : '--', 
      r.pressure !== undefined ? r.pressure : '--', 
      r.cat, 
      r.supervisor || "--", 
      r.department || "--", 
      r.source
    ]);
    const fullData: (string | number)[][] = [headers, ...rows];
    
    const ws = XLSX_.utils.aoa_to_sheet(fullData);
    const wb = XLSX_.utils.book_new();
    XLSX_.utils.book_append_sheet(wb, ws, 'HeatStressLog');
    XLSX_.writeFile(wb, `HSE_HeatStress_Report_${companyName.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleExportPDF = () => {
    const jspdf_ = (window as any).jspdf;
    if (!jspdf_) {
      alert("PDF library is loading... Please wait.");
      return;
    }
    const doc = new jspdf_.jsPDF({ orientation: 'landscape' });
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.text(companyName, 14, 16);
    doc.setFontSize(10);
    doc.text('HSE Heat Stress Monitor Pro — OSHA Apparent Temp, WBGT & AQI Report', 14, 23);
    doc.text('Generated: ' + new Date().toLocaleString(), 14, 29);
    
    let y = 40;
    doc.setFontSize(8);
    doc.text('Time | Persian Date | Temp | RH% | Heat Index | WBGT | AQI | Wind | Pressure | Category | Supervisor | Department | Source', 14, y);
    y += 4;
    doc.line(14, y, 280, y);
    y += 6;

    log.slice(0, 30).forEach(r => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      const timeStr = new Date(r.ts).toLocaleTimeString('fa-IR');
      const tempStr = `${safeFixed(r.tempC, 1)}°C`;
      const humStr = `${r.hum}%`;
      const hiStr = `${r.hiDisplay}°C`;
      const wbgtStr = r.wbgt !== undefined ? `${r.wbgt}°C` : '--';
      const aqiStr = r.aqi !== undefined ? String(r.aqi) : '--';
      const windStr = r.wind !== undefined ? `${r.wind} km/h` : '--';
      const presStr = r.pressure !== undefined ? `${r.pressure} hPa` : '--';
      const supervisorStr = r.supervisor || "--";
      const deptStr = r.department || "--";

      doc.text(`${timeStr} | ${r.persianDate} | ${tempStr} | ${humStr} | ${hiStr} | ${wbgtStr} | ${aqiStr} | ${windStr} | ${presStr} | ${r.cat} | ${supervisorStr} | ${deptStr} | ${r.source.substring(0,18)}`, 14, y);
      y += 6;
    });

    doc.save(`HSE_HeatStress_Report_${companyName.replace(/\s+/g, '_')}.pdf`);
  };

  // --- Sub Level Rendering ---
  const activeWpKey = () => {
    if (!activeRecord) return null;
    return getActiveWorkPracticeKey(activeRecord.cat);
  };

  const currentWp = activeWpKey();

  // Recharts Line Chart Data formatting
  const chartData = [...log].slice(0, 30).reverse().map(r => ({
    time: new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temp: r.tempC,
    hum: r.hum,
    hi: r.hi
  }));

  // Recharts Summary Bar Chart
  const summaryMap: { [key: string]: number } = { Normal: 0, Caution: 0, ExtremeCaution: 0, Danger: 0, ExtremeDanger: 0 };
  log.forEach(r => { summaryMap[r.cat] = (summaryMap[r.cat] || 0) + 1; });
  const summaryChartData = Object.entries(summaryMap).map(([key, count]) => ({
    name: TRANSLATIONS[language].categories[key as keyof typeof TRANSLATIONS.en.categories]?.name || key,
    count,
    color: CAT_COLOR[key as keyof typeof CAT_COLOR]
  }));

  return (
    <div className="w-full space-y-6" id="heat-stress-wrapper">
      
      {/* Alert Overlay */}
      {showAlertOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-fade-in" id="heat-alert-overlay">
          <div className="bg-white dark:bg-slate-900 max-w-lg p-8 rounded-3xl border-2 text-center relative overflow-hidden shadow-2xl space-y-4" style={{ borderColor: alertDetails.color }}>
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-repeating-linear-gradient-45"></div>
            <AlertTriangle className="w-16 h-16 mx-auto animate-bounce" style={{ color: alertDetails.color }} />
            <h2 className="text-2xl font-black uppercase tracking-wider" style={{ color: alertDetails.color }}>{alertDetails.title}</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{alertDetails.sub}</p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button 
                type="button"
                onClick={() => setShowAlertOverlay(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {L.ack}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Module View Selector Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{L.title}</h1>
            <p className="text-xs text-slate-400 font-medium">{L.sub}</p>
          </div>
        </div>

        <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto gap-1">
          <button
            type="button"
            onClick={() => setMapViewMode('weather')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              mapViewMode === 'weather'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
            id="tab-weather-dashboard"
          >
            <CloudSun className="w-4 h-4 text-sky-500" />
            <span>{isFa ? "هواشناسی" : "Weather"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapViewMode('analytics')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              mapViewMode === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
            id="tab-heat-stress-index"
          >
            <Thermometer className="w-4 h-4 text-amber-500" />
            <span>{isFa ? "شاخص استرس گرمایی" : "Heat Stress Index"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMapViewMode('map')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
              mapViewMode === 'map'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
            id="tab-live-gis-map"
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            <span>{isFa ? "نقشه زنده جی‌آی‌اس" : "Live GIS Map"}</span>
          </button>
        </div>
      </div>

      {/* 0. Default Tab: Weather Dashboard («هواشناسی») */}
      {mapViewMode === 'weather' && (
        <WeatherDashboardView
          weatherInfo={weatherInfo}
          activeRecord={activeRecord}
          isFa={isFa}
          isLoading={searchLoading}
          weatherError={weatherError}
          searchQuery={searchQuery}
          suggestions={suggestions}
          gpsLoading={gpsLoading}
          industrialSites={INDUSTRIAL_SITES}
          refreshMinutes={refreshMinutes}
          secondsLeft={secondsLeft}
          onSearchChange={handleCitySearchInput}
          onSelectSuggestion={selectSuggestion}
          onLocateGps={handleGpsLocation}
          onLocateInternet={() => resolveAccurateLocation('internet', { isManual: true, recordInHistory: true, enableWatch: false })}
          onSelectSite={(lat, lon, label) => {
            setGpsAccuracy(null);
            setGpsPermissionDenied(false);
            stopLiveTracking();
            locateModeRef.current = 'manual';
            triggerWeatherRefresh(lat, lon, label, 'Industrial Site Selection', {
              isManual: true,
              forceBypassCache: true,
              recordInHistory: true,
              accuracy: null,
              locateMode: 'manual'
            });
          }}
          onRefresh={() => {
            if (locateModeRef.current === 'gps' || locateModeRef.current === 'internet') {
              resolveAccurateLocation(locateModeRef.current, { isManual: true, recordInHistory: true });
              return;
            }
            const target = activeRecord
              ? { lat: activeRecord.lat, lon: activeRecord.lon, loc: activeRecord.loc }
              : lastFetchedLocationRef.current;
            triggerWeatherRefresh(target.lat, target.lon, target.loc, 'Manual User Trigger', {
              isManual: true,
              forceBypassCache: true,
              recordInHistory: true
            });
          }}
          onSwitchToHeatStressTab={() => setMapViewMode('analytics')}
          onSwitchToGisMapTab={() => setMapViewMode('map')}
          persianDateStr={activeRecord?.persianDate || getPersianDateString(new Date())}
          categoryInfo={{
            name: activeRecord ? (L.categories[activeRecord.cat]?.name || activeRecord.cat) : L.awaiting,
            risk: activeRecord ? (L.categories[activeRecord.cat]?.risk || '') : '',
            color: activeRecord ? (CAT_COLOR[activeRecord.cat] || '#10b981') : '#10b981',
            recos: activeRecord ? (L.recos[activeRecord.cat] || []) : []
          }}
        />
      )}

      {/* 1. Map Viewport Container */}
      <div className={`grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in ${mapViewMode === 'map' ? 'grid' : 'hidden'}`} id="live-gis-map-viewport">
        {/* GIS Controls Panel */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                {isFa ? "کنترل پایش جی‌آی‌اس" : "GIS Field Controller"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">{isFa ? "پایش زنده پرسنل، حوادث و عوارض محیطی" : "Live trackers for personnel, incidents, and hazards"}</p>
            </div>

            {/* Industrial Sites Selection Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {isFa ? "انتخاب سایت صنعتی مرجع" : "Reference Industrial Site"}
              </label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const site = INDUSTRIAL_SITES[Number(val)];
                  setGpsAccuracy(null);
                  setGpsPermissionDenied(false);
                  triggerWeatherRefresh(site.lat, site.lon, isFa ? site.nameFa : site.name, 'Industrial Site DB', { isManual: true });
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-blue-500 font-bold"
                defaultValue=""
                id="industrial-site-selector"
              >
                <option value="" disabled>{isFa ? "--- انتخاب سایت صنعتی ---" : "--- Select Reference Site ---"}</option>
                {INDUSTRIAL_SITES.map((site, index) => (
                  <option key={index} value={index}>
                    {isFa ? site.nameFa : site.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Search Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {isFa ? "جستجوی موقعیت آزاد" : "Free Location Search"}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => handleCitySearchInput(e.target.value)}
                  placeholder={L.searchPh}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:border-blue-500 placeholder-slate-400 font-medium"
                  id="map-sidebar-search-input"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              </div>

              {suggestions.length > 0 && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-h-40 overflow-y-auto space-y-1 p-2 shadow-lg z-50 absolute left-0 right-0" id="map-sidebar-suggestions">
                  {suggestions.map((s, idx) => (
                    <button 
                      key={idx}
                      onClick={() => selectSuggestion(s)}
                      className="w-full text-right text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 px-3 py-2 rounded-lg transition font-medium"
                    >
                      {s.name}, {s.admin1 ? `${s.admin1}, ` : ''}{s.country}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live Geolocation Tracker */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {isFa ? "ردیاب جی‌پی‌اس پرسنل (موقعیت یابی زنده)" : "Personnel GPS Tracker (Live Auto-Locate)"}
              </label>
              <button 
                onClick={startLiveTracking}
                disabled={gpsLoading}
                className={`w-full text-xs py-2.5 rounded-xl transition font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs border ${
                  gpsWatchIdRef.current !== null
                    ? 'bg-teal-500 text-white border-teal-600 hover:bg-teal-600'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                id="map-live-tracking-btn"
              >
                <MapPin className={`w-4 h-4 ${gpsWatchIdRef.current !== null ? 'animate-bounce text-white' : 'text-amber-600'}`} />
                {gpsLoading ? (isFa ? 'درحال ارتباط با ماهواره...' : 'Syncing Satellites...') : 
                 gpsWatchIdRef.current !== null ? (isFa ? 'ردیابی خودکار فعال است' : 'Live Tracking Active') : 
                 (isFa ? 'فعالسازی ردیابی زنده فیلد' : 'Enable Live Field Tracking')}
              </button>

              {gpsWatchIdRef.current !== null && (
                <button 
                  onClick={stopLiveTracking}
                  className="w-full text-xs text-red-600 hover:text-red-700 font-bold py-1 rounded-xl transition text-center hover:bg-red-50 cursor-pointer"
                >
                  {isFa ? "توقف ردیابی خودکار" : "Stop Auto-Tracking"}
                </button>
              )}
            </div>

            {/* Base Map Selector */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {isFa ? "منبع و لایه پایه نقشه GIS" : "Base Map Style & Source"}
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {[
                  { id: 'google-satellite', labelFa: 'ماهواره گوگل', labelEn: 'Google Sat' },
                  { id: 'google-roadmap', labelFa: 'نقشه گوگل', labelEn: 'Google Street' },
                  { id: 'google-hybrid', labelFa: 'ترکیبی گوگل', labelEn: 'Google Hybrid' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => {
                      const nextStyle = style.id as any;
                      setMapLayer(nextStyle);
                      persistHeatMonitorConfigToDb({
                        gisConfig: { mapLayer: nextStyle, showWeatherLayer, showHeatStressLayer, showIncidentLayer, showRiskZones, showWorkers, showWindVectors }
                      });
                    }}
                    className={`text-[10px] font-bold py-1.5 px-2 rounded-lg transition cursor-pointer ${
                      mapLayer === style.id 
                        ? 'bg-amber-500 text-slate-950 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                    }`}
                  >
                    {isFa ? style.labelFa : style.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Layer Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                {isFa ? "فیلتر لایه‌های اطلاعاتی جی‌آی‌اس" : "GIS Information Overlays"}
              </label>
              <div className="space-y-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 transition">
                  <input 
                    type="checkbox" 
                    checked={showWeatherLayer} 
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShowWeatherLayer(next);
                      persistHeatMonitorConfigToDb({
                        gisConfig: { mapLayer, showWeatherLayer: next, showHeatStressLayer, showIncidentLayer, showRiskZones, showWorkers, showWindVectors }
                      });
                    }}
                    className="rounded border-slate-300 text-amber-500 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>{isFa ? "پوشش رادار هواشناسی" : "Weather Radar Overlay"}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 transition">
                  <input 
                    type="checkbox" 
                    checked={showHeatStressLayer} 
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShowHeatStressLayer(next);
                      persistHeatMonitorConfigToDb({
                        gisConfig: { mapLayer, showWeatherLayer, showHeatStressLayer: next, showIncidentLayer, showRiskZones, showWorkers, showWindVectors }
                      });
                    }}
                    className="rounded border-slate-300 text-amber-500 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>{isFa ? "کنتورهای استرس گرمایی OSHA" : "OSHA Heat Stress Contours"}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 transition">
                  <input 
                    type="checkbox" 
                    checked={showIncidentLayer} 
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShowIncidentLayer(next);
                      persistHeatMonitorConfigToDb({
                        gisConfig: { mapLayer, showWeatherLayer, showHeatStressLayer, showIncidentLayer: next, showRiskZones, showWorkers, showWindVectors }
                      });
                    }}
                    className="rounded border-slate-300 text-amber-500 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>{isFa ? "محل ثبت حوادث و گزارشات" : "Incident Marker Layer"}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 transition">
                  <input 
                    type="checkbox" 
                    checked={showRiskZones} 
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShowRiskZones(next);
                      persistHeatMonitorConfigToDb({
                        gisConfig: { mapLayer, showWeatherLayer, showHeatStressLayer, showIncidentLayer, showRiskZones: next, showWorkers, showWindVectors }
                      });
                    }}
                    className="rounded border-slate-300 text-amber-500 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>{isFa ? "بخش‌بندی نواحی فرآیندی سایت" : "Plant Refineries Sectors"}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 transition">
                  <input 
                    type="checkbox" 
                    checked={showWorkers} 
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShowWorkers(next);
                      persistHeatMonitorConfigToDb({
                        gisConfig: { mapLayer, showWeatherLayer, showHeatStressLayer, showIncidentLayer, showRiskZones, showWorkers: next, showWindVectors }
                      });
                    }}
                    className="rounded border-slate-300 text-amber-500 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>{isFa ? "موقعیت زنده پرسنل تحت پایش" : "Personnel Live Tracking"}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 transition">
                  <input 
                    type="checkbox" 
                    checked={showWindVectors} 
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShowWindVectors(next);
                      persistHeatMonitorConfigToDb({
                        gisConfig: { mapLayer, showWeatherLayer, showHeatStressLayer, showIncidentLayer, showRiskZones, showWorkers, showWindVectors: next }
                      });
                    }}
                    className="rounded border-slate-300 text-amber-500 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>{isFa ? "جریان باد دینامیکی" : "Dynamic Wind Vectors"}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Large Map Viewport Area */}
        <div className="lg:col-span-3 relative rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900 flex flex-col h-[650px] lg:h-[750px]">
          {/* Interactive GIS Map with OpenFreeMap & Google Maps */}
          <GisMapView
            activeRecord={activeRecord}
            isFa={isFa}
            isVisible={mapViewMode === 'map'}
            mapLayer={mapLayer}
            setMapLayer={setMapLayer}
            showWeatherLayer={showWeatherLayer}
            showRiskZones={showRiskZones}
            showWindVectors={showWindVectors}
            showWorkers={showWorkers}
            showIncidentLayer={showIncidentLayer}
            showHeatStressLayer={showHeatStressLayer}
            industrialSites={INDUSTRIAL_SITES}
            onSelectLocation={async (lat, lon, label) => {
              setGpsAccuracy(null);
              setGpsPermissionDenied(false);
              stopLiveTracking();
              locateModeRef.current = 'manual';
              const resolvedName = await reverseGeocodeCoordinates(lat, lon, label);
              triggerWeatherRefresh(lat, lon, resolvedName, 'Interactive Map Click', {
                isManual: true,
                forceBypassCache: true,
                recordInHistory: true,
                accuracy: null,
                locateMode: 'manual'
              });
            }}
          />

          {/* Floating zoom controls inside Map */}
          

          {/* GPS disabled / Permissions Help Overlay inside Map */}
          {gpsPermissionDenied && !activeRecord && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-30 flex items-center justify-center p-6 text-center animate-fade-in" id="gps-denied-help-overlay">
              <div className="bg-white dark:bg-slate-900 max-w-md p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                  {isFa ? "عدم دسترسی به موقعیت‌یاب جی‌پی‌اس" : "GPS Geolocation Access Denied / Unavailable"}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {isFa ? "مجوز دسترسی به موقعیت‌یاب صادر نشده است یا دستگاه شما فاقد سنسور جی‌پی‌اس فعال می‌باشد. لطفاً یا دسترسی مرورگر را آزاد کنید، و یا از پنل سمت راست یکی از ایستگاه‌ها و سایت‌های صنعتی پیش‌فرض پتروشیمی را انتخاب نمایید تا نقشه لود شود." 
                       : "Could not retrieve your GPS location. Please check your browser's geolocation permissions or choose one of our pre-configured industrial sites from the sidebar dropdown to explore."}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      const site = INDUSTRIAL_SITES[0];
                      setGpsPermissionDenied(false);
                      triggerWeatherRefresh(site.lat, site.lon, isFa ? site.nameFa : site.name, 'Industrial Site DB', { isManual: true });
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer"
                  >
                    {isFa ? "پتروشیمی عسلویه (پیش‌فرض)" : "Load Assaluyeh (Default)"}
                  </button>
                </div>
              </div>
            </div>
          )}

          
        </div>
      </div>

      {/* 2. Original Bento Grid View for Analytics (Visible when mapViewMode === 'analytics') */}
      <div className={`grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in ${mapViewMode === 'analytics' ? 'grid' : 'hidden'}`} id="live-gis-analytics-viewport">
        
        {/* Left Column: Location & Gauges */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Active Station Card & Map (With view-map button placeholder to prevent ref collisions) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {L.location}
          </h2>

          <div className="space-y-2">
            <div className="relative">
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => handleCitySearchInput(e.target.value)}
                placeholder={L.searchPh}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-blue-500 placeholder-slate-400"
                id="location-search-input"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>

            {/* Suggestions list */}
            {suggestions.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto space-y-1 p-2 shadow-lg" id="location-suggestions">
                {suggestions.map((s, idx) => (
                  <button 
                    key={idx}
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50 px-3 py-2 rounded-lg transition"
                  >
                    {s.name}, {s.admin1 ? `${s.admin1}, ` : ''}{s.country}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => resolveAccurateLocation('auto', { isManual: true, recordInHistory: true, enableWatch: true })}
                disabled={gpsLoading}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-800 disabled:opacity-55 active:scale-95 text-slate-700 dark:text-slate-200 text-xs py-2.5 px-3 rounded-xl transition font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                id="gps-trigger-btn"
                title={isFa ? "دریافت موقعیت دقیق با جی‌پی‌اس و پشتیبان خودکار شبکه اینترنت" : "Locate via High-Accuracy GPS with Internet IP fallback"}
              >
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{gpsLoading ? (isFa ? 'درحال ردیابی...' : 'Locating...') : (isFa ? 'موقعیت‌یابی دقیق (GPS)' : 'Locate via GPS')}</span>
              </button>
              <button 
                type="button"
                onClick={() => resolveAccurateLocation('internet', { isManual: true, recordInHistory: true, enableWatch: false })}
                disabled={gpsLoading}
                className="bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 disabled:opacity-55 active:scale-95 text-sky-700 dark:text-sky-300 text-xs py-2.5 px-3 rounded-xl transition font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                id="internet-locate-trigger-btn"
                title={isFa ? "استخراج و بروزرسانی موقعیت مکانی از داده‌های شبکه اینترنت (IP)" : "Extract location from Internet IP data"}
              >
                <Compass className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{isFa ? 'موقعیت از اینترنت (IP)' : 'Internet IP Locate'}</span>
              </button>
            </div>
          </div>

          {activeRecord ? (() => {
            const isHistoricalArchive = Boolean(log.length > 0 && activeRecord.id !== log[0]?.id);
            const recordAgeMin = getWeatherRecordAgeMinutes(activeRecord.ts);
            const isStale = isWeatherRecordStale(activeRecord.ts, 75);
            return (
              <div className={`text-xs space-y-2 p-3 rounded-xl border transition-all ${
                isHistoricalArchive 
                  ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200' 
                  : isStale 
                  ? 'bg-rose-500/10 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-500'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate">{activeRecord.loc}</div>
                  {isHistoricalArchive ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-slate-950 shadow-xs">
                      {isFa ? 'آرشیو داده‌های گذشته' : 'Historical Archive'}
                    </span>
                  ) : isStale ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white shadow-xs">
                      {isFa ? 'داده منقضی (نیاز به استعلام زنده)' : 'Telemetry Stale'}
                    </span>
                  ) : (
                    <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      {isFa ? 'اطلاعات زنده ایستگاه' : 'Live Synced'}
                    </span>
                  )}
                </div>

                <div>Lat: {safeFixed(activeRecord?.lat, 4)}, Lon: {safeFixed(activeRecord?.lon, 4)}</div>
                {activeRecord.accuracy && <div>Accuracy: ±{Math.round(activeRecord.accuracy || 0)}m</div>}
                
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-800 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">{isFa ? 'منبع استعلام هواشناسی:' : 'Weather Telemetry Source:'}</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800 flex items-center gap-1.5 shadow-xs">
                    {!isHistoricalArchive && !isStale && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>}
                    {activeRecord.provider || activeRecord.source || 'Meteorological Telemetry'}
                  </span>
                </div>
                
                <div className="text-[10px] text-slate-500 dark:text-slate-400 text-left pt-0.5 font-mono flex items-center justify-between">
                  <span>
                    {isHistoricalArchive 
                      ? (isFa ? `زمان ثبت: ${new Date(activeRecord.ts).toLocaleString('fa-IR')}` : `Logged At: ${new Date(activeRecord.ts).toLocaleString()}`)
                      : (isFa ? `زمان دریافت: ${new Date(activeRecord.ts).toLocaleTimeString('fa-IR')} (${recordAgeMin !== null ? `${recordAgeMin} دقیقه پیش` : 'زنده'})` : `Received: ${new Date(activeRecord.ts).toLocaleTimeString()} (${recordAgeMin !== null ? `${recordAgeMin}m ago` : 'live'})`)}
                  </span>
                  <span className="text-[9px] font-sans">
                    {isFa ? `روش ثبت: ${activeRecord.source || 'ثبت شده'}` : `Mode: ${activeRecord.source || 'Synced'}`}
                  </span>
                </div>

                {isHistoricalArchive && log.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveRecord(log[0])}
                    className="w-full mt-2 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold text-[11px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isFa ? 'بازگشت به آخرین وضعیت زنده فعلی' : 'Return to Latest Live Telemetry'}</span>
                  </button>
                )}
              </div>
            );
          })() : (
            <div className="p-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              {L.noLoc}
            </div>
          )}

          {/* Fullscreen Interactive Map Switcher Shortcut (Prevents Ref Collision & improves UX) */}
          <button
            type="button"
            onClick={() => setMapViewMode('map')}
            className="w-full h-44 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-600/5 text-slate-500 hover:text-amber-800 transition flex flex-col items-center justify-center gap-2 group cursor-pointer"
          >
            <MapPin className="w-6 h-6 text-slate-400 group-hover:text-blue-600 animate-bounce" />
            <span className="text-xs font-black">{isFa ? "نمای نقشه تمام‌صفحه جی‌آی‌اس" : "Fullscreen GIS Map View"}</span>
            <span className="text-[10px] text-slate-400 font-medium">{isFa ? "کلیک کنید برای پایش موقعیت و فیلترهای نقشه زنده" : "Click to monitor live sites and overlays"}</span>
          </button>
        </div>

        {/* Refresh & Timer Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {L.refreshTitle}
          </h2>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-500 font-bold">{L.everyMin(refreshMinutes)}</span>
              <div className="text-2xl font-mono text-amber-600 font-extrabold tabular-nums">
                {`${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`}
              </div>
            </div>
            <button 
              type="button"
              onClick={() => {
                if (locateModeRef.current === 'gps' || locateModeRef.current === 'internet') {
                  resolveAccurateLocation(locateModeRef.current, { isManual: true, recordInHistory: true });
                  return;
                }
                const target = activeRecord
                  ? { lat: activeRecord.lat, lon: activeRecord.lon, loc: activeRecord.loc }
                  : lastFetchedLocationRef.current;
                triggerWeatherRefresh(target.lat, target.lon, target.loc, 'Manual User Trigger', {
                  isManual: true,
                  forceBypassCache: true,
                  recordInHistory: true
                });
              }}
              disabled={searchLoading || gpsLoading}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-55 rounded-xl transition text-white shadow-md cursor-pointer flex items-center gap-2 font-bold text-xs active:scale-95"
              id="manual-refresh-trigger"
              title={isFa ? "دریافت لحظه‌ای داده‌های اقلیمی و ثبت در تاریخچه دیتابیس اصلی" : "Fetch live climate telemetry and record in main database history"}
            >
              <RefreshCw className={`w-4 h-4 ${searchLoading || gpsLoading ? 'animate-spin' : ''}`} />
              <span>{isFa ? "بروزرسانی داده‌های اقلیمی" : "Sync Climate Data"}</span>
            </button>
          </div>
        </div>

        
        {/* Weather statistics widget */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {L.stats}
          </h2>
          
          <div className="grid grid-cols-2 gap-3 text-center mb-3">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold">{L.statMaxTemp}</div>
              <div className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100">
                {log.length > 0 ? Math.max(...log.map(r => r.tempC)).toFixed(1) + '°C' : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold">{L.statMaxHI}</div>
              <div className="text-lg font-mono font-bold text-amber-600">
                {log.length > 0 ? Math.max(...log.map(r => r.hi)).toFixed(1) + '°C' : '—'}
              </div>
            </div>
          </div>

          {activeRecord && (
            <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">{isFa ? 'اطلاعات کامل هواشناسی و حرارتی' : 'Current Weather & Thermal Details'}</h3>
                <span className="inline-flex items-center gap-2 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                  <WeatherIcon
                    code={activeRecord.code ?? weatherInfo?.code}
                    isDay={activeRecord.isDay ?? weatherInfo?.isDay ?? true}
                    cloudCover={activeRecord.cloud ?? weatherInfo?.cloud}
                    pm10={activeRecord.pm10 ?? weatherInfo?.pm10}
                    variant="badge"
                  />
                  <span>
                    {extractLocalizedCondition(
                      activeRecord.condition,
                      activeRecord.code ?? weatherInfo?.code,
                      isFa,
                      {
                        isDay: activeRecord.isDay ?? weatherInfo?.isDay ?? true,
                        cloudCover: activeRecord.cloud ?? weatherInfo?.cloud,
                        pm10: activeRecord.pm10 ?? weatherInfo?.pm10
                      }
                    )}
                  </span>
                </span>
              </div>
              
              <div className="space-y-1.5 text-[11px] font-mono bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'دما:' : 'Temperature:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{activeRecord.tempC?.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'دمای محسوس:' : 'Feels Like:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {activeRecord.feels !== undefined ? `${activeRecord.feels.toFixed(1)}°C` : `${activeRecord.tempC.toFixed(1)}°C`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'رطوبت نسبی:' : 'Humidity:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{activeRecord.hum}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'سرعت باد:' : 'Wind Speed:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {activeRecord.wind !== undefined ? `${activeRecord.wind} km/h` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'جهت باد:' : 'Wind Dir:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {activeRecord.windDir !== undefined ? `${activeRecord.windDir}°` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'فشار هوا / پوشش ابر:' : 'Pressure / Cloud:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {activeRecord.pressure !== undefined ? `${Math.round(activeRecord.pressure)} hPa` : '--'} / {activeRecord.cloud !== undefined ? `${activeRecord.cloud}%` : '0%'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'اشعه فرابنفش (UV):' : 'UV Index:'}</span>
                  <span className="font-bold text-amber-500">{activeRecord.uv !== undefined ? activeRecord.uv : '--'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'شاخص کیفیت هوا (AQI):' : 'AQI:'}</span>
                  <span className="font-bold text-emerald-500">{activeRecord.aqi !== undefined ? activeRecord.aqi : '--'}</span>
                </div>
                <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 font-sans">{isFa ? 'شاخص گرما (HI):' : 'Heat Index:'}</span>
                  <span className="font-bold text-blue-600">{activeRecord.hiDisplay || activeRecord.hi?.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'تخمین WBGT (محیط باز / سایه):' : 'Est. WBGT (Out / Shade):'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {activeRecord.wbgt !== undefined ? `${activeRecord.wbgt.toFixed(1)}°C` : '--'}
                    {activeRecord.wbgtShade !== undefined ? ` / ${activeRecord.wbgtShade.toFixed(1)}°C` : ''}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'دمای حباب تر / شبنم:' : 'Wet Bulb / Dew Point:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {activeRecord.wetBulb !== undefined ? `${activeRecord.wetBulb}°C` : '--'} / {activeRecord.dewPoint !== undefined ? `${activeRecord.dewPoint}°C` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">{isFa ? 'سطح استرس حرارتی:' : 'Heat Stress Level:'}</span>
                  <span className="font-bold text-right" style={{ color: CAT_COLOR[activeRecord.cat] }}>
                    {L.categories[activeRecord.cat]?.name || activeRecord.cat}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>


      </div>

      {/* Right Columns: Main Gauges, Charts & Chat */}
      <div className="lg:col-span-2 space-y-6">

        {/* Dynamic Apparent Temperature Gauge & Risk info */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow grid grid-cols-1 md:grid-cols-3 gap-8 items-center min-h-[300px]" id="apparent-gauge-panel">
          <div className="flex flex-col items-center justify-center space-y-2 md:col-span-1">
            <div className="relative w-56 h-56 flex items-center justify-center">
              <svg width="220" height="220" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r="90" fill="none" stroke="currentColor" className="text-slate-100" strokeWidth="14" />
                <circle 
                  cx="110" 
                  cy="110" 
                  r="90" 
                  fill="none" 
                  stroke={activeRecord ? CAT_COLOR[activeRecord.cat] : '#10b981'} 
                  strokeWidth="14" 
                  strokeLinecap="round"
                  strokeDasharray="565"
                  strokeDashoffset={activeRecord ? Math.max(0, 565 - (activeRecord.hi / 60) * 565) : 400}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute text-center flex flex-col items-center">
                <div className="text-5xl font-black font-mono tracking-tighter text-slate-800 dark:text-slate-100 drop-shadow-sm">
                  {activeRecord ? activeRecord.hiDisplay : '—'}
                </div>
                <div className="text-xs uppercase font-bold text-slate-400 tracking-widest mt-1">{L.gaugeUnit}</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">
                {activeRecord ? (L.categories[activeRecord.cat]?.name || activeRecord.cat) : L.awaiting}
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">
                {activeRecord ? (L.categories[activeRecord.cat]?.risk || 'Please search or use GPS to monitor active field risk.') : 'Please search or use GPS to monitor active field risk.'}
              </p>
            </div>

            {/* Core metrics bar */}
            {activeRecord && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <WeatherIcon
                      code={activeRecord.code ?? weatherInfo?.code}
                      isDay={activeRecord.isDay ?? weatherInfo?.isDay ?? true}
                      cloudCover={activeRecord.cloud ?? weatherInfo?.cloud}
                      pm10={activeRecord.pm10 ?? weatherInfo?.pm10}
                      variant="badge"
                    />
                    <strong className="text-slate-800 dark:text-slate-100">
                      {extractLocalizedCondition(
                        activeRecord.condition,
                        activeRecord.code ?? weatherInfo?.code,
                        isFa,
                        {
                          isDay: activeRecord.isDay ?? weatherInfo?.isDay ?? true,
                          cloudCover: activeRecord.cloud ?? weatherInfo?.cloud,
                          pm10: activeRecord.pm10 ?? weatherInfo?.pm10
                        }
                      )}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Thermometer className="w-4 h-4 text-sky-500" />
                    <span>{L.metrics.temp}: <strong className="text-slate-800 dark:text-slate-100 font-mono">{activeRecord.tempC.toFixed(1)}°C</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span>{L.metrics.feels}: <strong className="text-slate-800 dark:text-slate-100 font-mono">{(activeRecord.feels ?? activeRecord.tempC).toFixed(1)}°C</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Droplets className="w-4 h-4 text-indigo-500" />
                    <span>{L.metrics.hum}: <strong className="text-slate-800 dark:text-slate-100 font-mono">{activeRecord.hum}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Wind className="w-4 h-4 text-teal-500" />
                    <span>{isFa ? 'سرعت باد' : 'Wind'}: <strong className="text-slate-800 dark:text-slate-100 font-mono">{(activeRecord.wind ?? weatherInfo?.wind ?? 0).toFixed(1)} km/h</strong></span>
                  </div>
                  {activeRecord.wbgt !== undefined && (
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <span>{isFa ? 'تخمین WBGT' : 'Est. WBGT'}: <strong className="font-mono">{activeRecord.wbgt.toFixed(1)}°C</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* OSHA Work Practices Highlight Table */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {L.workPracticesTitle}
          </h2>

          <div className="overflow-x-auto text-[11px]" id="work-practices-table">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                  <th className="pb-2 text-right">{L.wpHeaders.cat}</th>
                  <th className="pb-2 text-center">{L.wpHeaders.range}</th>
                  <th className="pb-2 text-center">{L.wpHeaders.workRest}</th>
                  <th className="pb-2 text-center">{L.wpHeaders.water}</th>
                  <th className="pb-2 text-right">{L.wpHeaders.controls}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 dark:text-slate-400">
                {Object.entries(L.workPractices).map(([key, value]) => {
                  const isActive = currentWp === key;
                  return (
                    <tr 
                      key={key} 
                      className={`transition-colors ${isActive ? 'bg-amber-500/10 text-slate-900 font-bold border-l-2 border-blue-500' : 'text-slate-500'}`}
                    >
                      <td className="py-2.5 text-right font-semibold">{value.cat}</td>
                      <td className="py-2.5 text-center font-mono">{value.range}</td>
                      <td className="py-2.5 text-center font-mono">{value.workRest}</td>
                      <td className="py-2.5 text-center">{value.water}</td>
                      <td className="py-2.5 text-right">{value.controls}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed space-y-1 pt-1 border-t border-slate-50">
            <p>{L.chartNote}</p>
            <p className="text-amber-600 font-semibold">{L.chartExample}</p>
          </div>
        </div>

        {/* Current Weather Widgets Extra Details */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {L.weather}
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs" id="weather-details-grid">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'پوشش ابر' : 'Cloud Cover'}</span>
                <div className="w-6 h-6 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-500 flex items-center justify-center shrink-0">
                  <Cloud className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.cloud !== undefined ? weatherInfo.cloud + '%' : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'دید افقی' : 'Visibility'}</span>
                <div className="w-6 h-6 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center shrink-0">
                  <Eye className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.visibility ? weatherInfo.visibility + ' km' : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'فشار اتمسفر' : 'Pressure'}</span>
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                  <Gauge className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.pressure ? Math.round(weatherInfo.pressure) + ' hPa' : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'شاخص فرابنفش' : 'UV Index'}</span>
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <Sun className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.uv !== undefined ? weatherInfo.uv : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'شاخص WBGT' : 'WBGT Index'}</span>
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <Thermometer className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-emerald-600 font-mono">{weatherInfo && weatherInfo.wbgt !== undefined ? weatherInfo.wbgt + ' °C' : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'نقطه شبنم' : 'Dew Point'}</span>
                <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center shrink-0">
                  <Droplets className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.dewPoint !== undefined ? weatherInfo.dewPoint + ' °C' : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'دمای حباب تر' : 'Wet Bulb'}</span>
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                  <Thermometer className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.wetBulb !== undefined ? weatherInfo.wetBulb + ' °C' : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'کیفیت هوا (AQI)' : 'Air Quality'}</span>
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <Activity className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={`text-[11px] font-bold font-mono ${weatherInfo && weatherInfo.aqi && weatherInfo.aqi > 100 ? 'text-blue-600' : 'text-green-600'}`}>
                {weatherInfo && weatherInfo.aqi !== undefined ? `${weatherInfo.aqi} (${weatherInfo.aqi <= 50 ? (isFa ? 'عالی' : 'Good') : weatherInfo.aqi <= 100 ? (isFa ? 'متوسط' : 'Moderate') : (isFa ? 'ناسالم' : 'Unhealthy')})` : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'ذرات معلق' : 'Particulates'}</span>
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <Wind className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.pm25 !== undefined ? `${weatherInfo.pm25} / ${weatherInfo.pm10} µg/m³` : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'آلاینده‌ها' : 'Pollutants'}</span>
                <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.co !== undefined ? `${weatherInfo.co} / ${weatherInfo.so2} µg/m³` : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'بارش' : 'Precipitation'}</span>
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                  <CloudRain className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.rainProb !== undefined ? `${weatherInfo.rainProb}% / ${weatherInfo.rainAmount}mm` : '—'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-slate-400 font-semibold">{isFa ? 'طول روز' : 'Day Length'}</span>
                <div className="w-6 h-6 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-500 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">{weatherInfo && weatherInfo.dayLength ? weatherInfo.dayLength : '—'}</div>
            </div>
          </div>
        </div>

        {/* Recharts Analytics Section */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {L.charts}
            </h2>
            <div className="flex gap-1.5 text-xs">
              <button 
                onClick={() => setChartTab('line')}
                className={`px-3 py-1.5 rounded-lg border transition font-bold cursor-pointer ${chartTab === 'line' ? 'bg-amber-500/10 text-amber-600 border-blue-500/20' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
              >
                {isFa ? 'روند تغییرات زمانی' : 'Over-time Trend'}
              </button>
              <button 
                onClick={() => setChartTab('summary')}
                className={`px-3 py-1.5 rounded-lg border transition font-bold cursor-pointer ${chartTab === 'summary' ? 'bg-amber-500/10 text-amber-600 border-blue-500/20' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
              >
                {isFa ? 'توزیع کلاسی دما' : 'Risk Distribution'}
              </button>
              <button 
                onClick={() => setChartTab('matrix')}
                className={`px-3 py-1.5 rounded-lg border transition font-bold cursor-pointer ${chartTab === 'matrix' ? 'bg-amber-500/10 text-amber-600 border-blue-500/20' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
              >
                {isFa ? 'جدول ماتریس شاخص گرما' : 'Heat Index Matrix'}
              </button>
              <button 
                onClick={() => setChartTab('forecast')}
                className={`px-3 py-1.5 rounded-lg border transition font-bold cursor-pointer flex items-center gap-1.5 ${chartTab === 'forecast' ? 'bg-sky-500/10 text-sky-600 border-sky-500/20 shadow-xs' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
              >
                <CloudRain className="w-3.5 h-3.5" />
                {isFa ? 'پیش‌بینی ساعتی و روزانه' : 'Forecast Outlook'}
              </button>
            </div>
          </div>

          <div className={chartTab === 'matrix' || chartTab === 'forecast' ? "h-[360px] overflow-auto" : "h-64"} id="heat-charts-container">
            {chartTab === 'forecast' ? (
              <div className="space-y-4 p-1">
                {/* Forecast Controls & Header */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {isFa ? 'منبع داده پیش‌بینی:' : 'Forecast Engine:'}
                    </span>
                    <span className="bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-md font-mono font-semibold">
                      {activeRecord?.provider || weatherInfo?.provider || 'MET Norway (Yr.no)'}
                    </span>
                    {activeRecord?.cached && (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                        {isFa ? 'حافظه کَش فعال' : 'Cached Response'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setForecastView('hourly')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${forecastView === 'hourly' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
                    >
                      {isFa ? '۲۴ ساعت آینده' : '24h Hourly'}
                    </button>
                    <button
                      onClick={() => setForecastView('daily')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer ${forecastView === 'daily' ? 'bg-sky-600 text-white shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700'}`}
                    >
                      {isFa ? '۷ روزه' : '7-Day Outlook'}
                    </button>
                  </div>
                </div>

                {/* Hourly View */}
                {forecastView === 'hourly' && (
                  activeRecord?.hourlyForecast && activeRecord.hourlyForecast.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                      {activeRecord.hourlyForecast.map((item, idx) => {
                        const hIsDay = item.isDay !== undefined ? item.isDay : true;
                        const hCond = extractLocalizedCondition(item.symbolPhrase, item.symbol, isFa, {
                          isDay: hIsDay,
                          cloudCover: item.cloudCover
                        });
                        return (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-center space-y-1.5 hover:border-sky-300 transition">
                            <div className="text-xs font-mono font-bold text-slate-500">{item.time}</div>
                            <div className="flex justify-center py-1">
                              <WeatherIcon
                                symbol={item.symbol}
                                precipProb={item.precipProb}
                                isDay={hIsDay}
                                cloudCover={item.cloudCover}
                                variant="card"
                              />
                            </div>
                            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate" title={hCond}>
                              {hCond}
                            </div>
                            <div className="text-base font-mono font-black text-slate-800 dark:text-slate-100">{item.tempC.toFixed(1)}°C</div>
                            <div className="text-[10px] text-slate-500 font-mono">{isFa ? `رطوبت: ${item.hum}%` : `${item.hum}% RH`}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{isFa ? `باد: ${Math.round(item.windSpeed)} km/h` : `${Math.round(item.windSpeed)} km/h`}</div>
                            {item.precipProb !== undefined && (
                              <div className="text-[10px] text-sky-600 font-bold font-mono">{isFa ? `بارش: ${item.precipProb}%` : `Rain: ${item.precipProb}%`}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-400">
                      {isFa ? 'داده‌های پیش‌بینی ساعتی از سرویس هواشناسی دریافت نشده است.' : 'No hourly forecast data received from weather service.'}
                    </div>
                  )
                )}

                {/* Daily View */}
                {forecastView === 'daily' && (
                  activeRecord?.dailyForecast && activeRecord.dailyForecast.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {activeRecord.dailyForecast.map((item, idx) => {
                        const dCond = extractLocalizedCondition(item.symbolPhrase, item.symbol, isFa, { isDay: true });
                        return (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 hover:border-sky-300 transition">
                            <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200 dark:border-slate-700 pb-1.5 text-slate-700 dark:text-slate-200">
                              <span>{item.date}</span>
                              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                                <WeatherIcon symbol={item.symbol} precipProb={item.precipProb} isDay={true} variant="badge" />
                                <span>{dCond}</span>
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-mono font-bold">
                              <span className="text-red-500 font-black">{item.maxTempC.toFixed(1)}°C</span>
                              <span className="text-slate-400 text-xs font-normal">/</span>
                              <span className="text-sky-500">{item.minTempC.toFixed(1)}°C</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                              <span>{isFa ? `باد: ${item.maxWindSpeed ?? '--'} km/h` : `Wind: ${item.maxWindSpeed ?? '--'} km/h`}</span>
                              {item.precipProb !== undefined && (
                                <span className="text-sky-600 font-bold">{isFa ? `بارش: ${item.precipProb}%` : `Rain: ${item.precipProb}%`}</span>
                              )}
                            </div>
                            {(item.sunrise || item.sunset) && (
                              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                <span>{isFa ? `طلوع: ${item.sunrise || '--:--'}` : `Rise: ${item.sunrise || '--:--'}`}</span>
                                <span>{isFa ? `غروب: ${item.sunset || '--:--'}` : `Set: ${item.sunset || '--:--'}`}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-xs text-slate-400">
                      {isFa ? 'داده‌های پیش‌بینی روزانه از سرویس هواشناسی دریافت نشده است.' : 'No daily forecast data received from weather service.'}
                    </div>
                  )
                )}
              </div>
            ) : log.length > 0 ? (
              chartTab === 'line' ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} debounce={50}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <ReTooltip contentStyle={{ backgroundColor: 'var(--color-white)', borderColor: 'var(--color-slate-200)', color: 'var(--color-slate-900)', borderRadius: '12px', fontSize: '11px', boxShadow: 'var(--shadow-md)' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line type="monotone" dataKey="temp" name={isFa ? "دمای هوا" : "Air Temp"} stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="hum" name={isFa ? "رطوبت" : "Humidity"} stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="hi" name={isFa ? "شاخص گرما" : "Heat Index"} stroke="#f59e0b" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : chartTab === 'summary' ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} debounce={50}>
                  <ReBarChart data={summaryChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <ReTooltip contentStyle={{ backgroundColor: 'var(--color-white)', borderColor: 'var(--color-slate-200)', color: 'var(--color-slate-900)', borderRadius: '12px', fontSize: '11px', boxShadow: 'var(--shadow-md)' }} />
                    <Bar dataKey="count" name={isFa ? "تعداد نمونه" : "Sample Count"}>
                      {summaryChartData.map((entry, index) => (
                        <Cell key={`cell-${entry.name || index}-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              ) : (
                <div className="overflow-auto h-full border border-slate-100 dark:border-slate-800 rounded-xl" id="heat-index-matrix-table">
                  <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-center text-[10px] border-collapse min-w-[600px]">
                    <thead className="sticky top-0 bg-slate-100 z-20 text-slate-600 dark:text-slate-400 font-bold shadow-xs">
                      <tr>
                        <th className="py-2 px-1 border border-slate-200 dark:border-slate-800 bg-slate-100">{isFa ? 'دما / رطوبت' : 'Temp / RH'}</th>
                        {RH_COLS.map(rh => (
                          <th key={rh} className="py-2 px-1 border border-slate-200 dark:border-slate-800 bg-slate-100">{rh}%</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...T_ROWS].sort((a, b) => b - a).map(t => {
                        const isCurrentTempRow = activeRecord && Math.max(26, Math.min(50, Math.round(activeRecord.tempC))) === t;
                        return (
                          <tr key={t} className={isCurrentTempRow ? 'bg-amber-500/5' : ''}>
                            <td className="py-1 px-1.5 border border-slate-200 dark:border-slate-800 font-bold bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-mono">{t}°C</td>
                            {RH_COLS.map(rh => {
                              const isCurrentCell = activeRecord && 
                                Math.max(26, Math.min(50, Math.round(activeRecord.tempC))) === t && 
                                Math.max(10, Math.min(90, Math.round(activeRecord.hum / 10) * 10)) === rh;
                              const val = HI_TABLE[t]?.[RH_COLS.indexOf(rh)];
                              const displayVal = val === undefined ? '—' : val;
                              
                              let cellClass = 'bg-slate-50 text-slate-400';
                              if (val !== undefined) {
                                const numVal = val === OFF_CHART ? 100 : Number(val);
                                if (numVal >= 54) {
                                  cellClass = 'bg-purple-100 text-purple-800 font-semibold';
                                } else if (numVal >= 39) {
                                  cellClass = 'bg-red-100 text-red-800 font-semibold';
                                } else if (numVal >= 32) {
                                  cellClass = 'bg-blue-100 text-blue-800 font-semibold';
                                } else if (numVal >= 27) {
                                  cellClass = 'bg-yellow-100 text-yellow-800 font-semibold';
                                } else {
                                  cellClass = 'bg-emerald-100 text-emerald-800 font-semibold';
                                }
                              }

                              return (
                                <td 
                                  key={rh} 
                                  className={`py-1 px-0.5 border border-slate-100 font-mono text-center transition-all ${cellClass} ${
                                    isCurrentCell ? 'ring-2 ring-blue-500 ring-offset-1 font-black scale-105 shadow-sm relative z-10 animate-pulse text-amber-950 bg-amber-200' : ''
                                  }`}
                                  title={`Temp: ${t}°C, RH: ${rh}% → HI: ${displayVal}`}
                                >
                                  {isCurrentCell ? (
                                    <span className="flex items-center justify-center gap-0.5">
                                      <span>{displayVal}</span>
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
                                    </span>
                                  ) : (
                                    displayVal
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table></div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                {isFa ? 'نمودار در انتظار دریافت داده کارگاهی است.' : 'Waiting for workshop weather data to render graphs.'}
              </div>
            )}
          </div>
        </div>

        {/* Historic Data Log Panel */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {L.log}
            </h2>
            <div className="flex flex-wrap gap-1.5 text-xs" id="log-export-options">
              <button 
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-sky-500" />
                <span>CSV</span>
              </button>
              <button 
                onClick={handleExportXLSX}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>Excel</span>
              </button>
              <button 
                onClick={handleExportPDF}
                className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-rose-500" />
                <span>PDF Report</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto text-[11px]" id="historic-logs-table">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right divide-y divide-slate-100">
              <thead>
                <tr className="text-slate-400 font-bold">
                  <th className="pb-2 text-right">{L.th.time}</th>
                  <th className="pb-2 text-right">{L.th.persian}</th>
                  <th className="pb-2 text-center">{L.th.temp}</th>
                  <th className="pb-2 text-center">{L.th.hum}</th>
                  <th className="pb-2 text-center">{L.th.hi}</th>
                  <th className="pb-2 text-right">{L.th.cat}</th>
                  <th className="pb-2 text-right">{L.th.loc}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 dark:text-slate-400">
                {log.slice(0, 15).map((r, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => setActiveRecord(r)}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${activeRecord?.id === r.id ? 'bg-amber-500/5 font-medium border-l-2 border-blue-500' : ''}`}
                  >
                    <td className="py-2.5 text-right font-mono text-slate-500">{new Date(r.ts).toLocaleTimeString()}</td>
                    <td className="py-2.5 text-right">{r.persianDate}</td>
                    <td className="py-2.5 text-center font-mono">{r.tempC.toFixed(1)}°C</td>
                    <td className="py-2.5 text-center font-mono">{r.hum}%</td>
                    <td className="py-2.5 text-center font-mono font-bold text-amber-600">{r.hiDisplay}°C</td>
                    <td className="py-2.5 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${CAT_COLOR[r.cat] || '#10b981'}15`, color: CAT_COLOR[r.cat] || '#10b981' }}>
                        {L.categories[r.cat]?.name || r.cat || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right truncate max-w-[120px] text-slate-700 dark:text-slate-200">{r.loc}</td>
                  </tr>
                ))}
                {log.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {L.noDataYet}
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>

        {/* Global Configuration settings block */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            {L.settings}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">{L.companyNameLabel}</label>
              <input 
                type="text" 
                value={companyName}
                onChange={(e) => {
                  const val = e.target.value;
                  setCompanyName(val);
                  if (companySaveTimerRef.current) clearTimeout(companySaveTimerRef.current);
                  companySaveTimerRef.current = setTimeout(() => {
                    persistHeatMonitorConfigToDb({ companyName: val });
                  }, 400);
                }}
                onBlur={(e) => {
                  if (companySaveTimerRef.current) clearTimeout(companySaveTimerRef.current);
                  persistHeatMonitorConfigToDb({ companyName: e.target.value });
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-blue-500 placeholder-slate-400"
                id="settings-company-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-400 font-bold">{L.refreshTitle} (min)</label>
              <input 
                type="number" 
                value={refreshMinutes}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value, 10);
                  const m = !isNaN(parsed) ? Math.max(1, Math.min(180, parsed)) : 1;
                  refreshMinutesRef.current = m;
                  setRefreshMinutes(m);
                  const nextTarget = Date.now() + m * 60 * 1000;
                  nextRefreshAtRef.current = nextTarget;
                  setSecondsLeft(m * 60);
                  persistHeatMonitorConfigToDb({
                    refreshMinutes: m,
                    nextRefreshAt: nextTarget
                  });
                }}
                min="1"
                max="180"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-blue-500 placeholder-slate-400"
                id="settings-refresh-minutes-input"
              />
            </div>
          </div>
        </div>

      </div>

    </div>

  </div>
  );
}
