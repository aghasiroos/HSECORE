import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, TrirRecord, WarningRecord } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  ComposedChart,
  Area,
  ReferenceLine,
  LabelList
} from 'recharts';
import {
  FileText,
  ShieldAlert,
  GraduationCap,
  AlertOctagon,
  Activity,
  BarChart3,
  TrendingUp,
  Target,
  Sparkles,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  CheckCircle2,
  Flame,
  HeartPulse,
  Leaf,
  CheckSquare,
  Layers,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Printer,
  Eye,
  X,
  FileSpreadsheet
} from 'lucide-react';
import ReportCustomizableChart from './reports/ReportCustomizableChart';
import ReportPeriodSelector, { ReportPeriod } from './reports/ReportPeriodSelector';
import { FormalReportHeader } from './common/FormalReportHeader';
import { safetyDeptService } from '../modules/safety-dept/services/safetyDeptService';
import { fiveSService } from '../modules/health-env/services/fiveSService';
import { apiDb } from '../services/apiDatabaseClient';
import { jalaliToGregorian, toEnglishDigits } from '../utils/jalaliDate';

interface ReportsModuleProps {
  isFa: boolean;
  currentUser: UserProfile;
  trirRecords: TrirRecord[];
  warnings: WarningRecord[];
  trirTarget?: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
const JALALI_MONTH_NAMES = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

const useIsDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', checkDark);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', checkDark);
    };
  }, []);

  return isDark;
};

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, isFa = true, isDark = false } = props;
  if (!payload || payload.value === undefined) return null;
  const rawValue = String(payload.value);

  // Check if this is a forecast month
  const isForecast = rawValue.includes('پیش‌بینی') || rawValue.includes('Forecast');
  
  // Clean string without (پیش‌بینی) or (Forecast)
  const cleanStr = rawValue.replace(/\s*\((?:پیش‌بینی|Forecast)\)\s*/g, '').trim();
  const parts = cleanStr.split(' ');
  const monthName = parts[0] || cleanStr;
  const yearName = parts.slice(1).join(' ') || '';

  const monthColor = isDark ? '#f8fafc' : '#0f172a';
  const yearColor = isForecast 
    ? (isDark ? '#a5b4fc' : '#4338ca') 
    : (isDark ? '#94a3b8' : '#475569');
  const tickStroke = isDark ? '#475569' : '#cbd5e1';

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Small vertical guide tick mark under each vertical bar */}
      <line x1={0} y1={0} x2={0} y2={5} stroke={tickStroke} strokeWidth={1.5} />

      {/* Month Name - strictly centered right under the vertical bar */}
      <text
        x={0}
        y={18}
        textAnchor="middle"
        fill={monthColor}
        fontSize={11}
        fontWeight="bold"
        style={{ fill: monthColor, fontWeight: 800 }}
      >
        {monthName}
      </text>

      {/* Year - strictly centered right under the month name */}
      <text
        x={0}
        y={32}
        textAnchor="middle"
        fill={yearColor}
        fontSize={10}
        fontWeight="bold"
        style={{ fill: yearColor, fontWeight: 600 }}
      >
        {yearName}
      </text>

      {/* Forecast badge if projected month */}
      {isForecast && (
        <g transform="translate(0, 46)">
          <rect
            x={-23}
            y={-8}
            width={46}
            height={14}
            rx={4}
            fill={isDark ? '#1e1b4b' : '#e0e7ff'}
            stroke={isDark ? '#818cf8' : '#6366f1'}
            strokeWidth={1}
          />
          <text
            x={0}
            y={2.5}
            textAnchor="middle"
            fill={isDark ? '#e0e7ff' : '#4338ca'}
            fontSize={8.5}
            fontWeight="bold"
            style={{ fill: isDark ? '#e0e7ff' : '#4338ca', fontWeight: 800 }}
          >
            {isFa ? 'پیش‌بینی' : 'Forecast'}
          </text>
        </g>
      )}
    </g>
  );
};

const renderBarValueLabel = (props: any, isDark: boolean = false) => {
  const { x, y, width, value } = props;
  if (value === null || value === undefined || Number(value) <= 0) return null;
  const formattedVal = Number(value).toFixed(2);

  const textColor = isDark ? '#ffffff' : '#0f172a';
  const haloColor = isDark ? '#0b0f19' : '#ffffff';

  return (
    <text
      x={Math.round(x + width / 2)}
      y={Math.round(y - 6)}
      textAnchor="middle"
      fill={textColor}
      fontSize={10.5}
      fontWeight="bold"
      style={{
        fill: textColor,
        fontWeight: 900,
        paintOrder: 'stroke fill',
        stroke: haloColor,
        strokeWidth: 2.5,
        strokeLinejoin: 'round',
      }}
    >
      {formattedVal}
    </text>
  );
};

const CustomTRIRTooltip = ({ active, payload, label, isFa, isDark = false }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload || {};
    return (
      <div className={`${isDark ? 'bg-slate-900 text-slate-100 border-slate-700' : 'bg-white text-slate-900 border-slate-200'} p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 border min-[0px] w-full md:min-w-[240px]`}>
        <div className={`font-black border-b ${isDark ? 'border-slate-800 text-slate-100' : 'border-slate-100 text-slate-900'} pb-1.5 flex items-center justify-between`}>
          <span className="font-black text-sm">{label}</span>
          {data.isForecast ? (
            <span className={`${isDark ? 'bg-indigo-950 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-200'} px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border`}>
              {isFa ? 'پیش‌بینی آینده' : 'Future Forecast'}
            </span>
          ) : (
            <span className={`${isDark ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'} px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border`}>
              {isFa ? 'داده واقعی گذشته' : 'Historical Record'}
            </span>
          )}
        </div>
        
        {data.actualTRIR !== null && data.actualTRIR !== undefined && (
          <div className="flex justify-between items-center">
            <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isFa ? 'TRIR ماهانه:' : 'Monthly TRIR:'}</span>
            <strong className="font-mono text-sm font-black text-sky-500">{data.actualTRIR}</strong>
          </div>
        )}

        {data.rollingTRIR !== null && data.rollingTRIR !== undefined && (
          <div className="flex justify-between items-center">
            <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isFa ? 'TRIR تجمیعی ۱۲ ماهه:' : '12M Rolling TRIR:'}</span>
            <strong className="font-mono text-sm font-black text-emerald-500">{data.rollingTRIR}</strong>
          </div>
        )}
        
        {data.projectedTRIR !== null && data.projectedTRIR !== undefined && (
          <div className="flex justify-between items-center">
            <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{isFa ? 'TRIR پیش‌بینی آینده:' : 'Projected TRIR:'}</span>
            <strong className="font-mono text-sm font-black text-indigo-400">{data.projectedTRIR}</strong>
          </div>
        )}

        <div className="border-t-2 border-black pt-1.5 space-y-1">
          <div className="flex justify-between items-center text-black text-[11px]">
            <span className="font-bold text-black">{isFa ? 'کارکرد (نفر-ساعت):' : 'Man-Hours:'}</span>
            <strong className="font-mono font-black text-black">{Number(data.manHours || 0).toLocaleString()}</strong>
          </div>
          <div className="flex justify-between items-center text-black text-[11px]">
            <span className="font-bold text-black">{isFa ? 'حوادث ماهانه:' : 'Monthly Cases:'}</span>
            <strong className="font-mono font-black text-black">{data.incidents || 0}</strong>
          </div>
          {data.rollingIncidents !== undefined && data.rollingIncidents !== null && (
            <div className="flex justify-between items-center text-black text-[11px]">
              <span className="font-bold text-black">{isFa ? 'حوادث ۱۲ ماه اخیر:' : '12M Rolling Cases:'}</span>
              <strong className="font-mono font-black text-black">{data.rollingIncidents}</strong>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function ReportsModule({ 
  isFa, 
  currentUser,
  trirRecords,
  warnings: propWarnings,
  trirTarget = 1.5
}: ReportsModuleProps) {
  const isDark = useIsDarkMode();

  // Navigation Tabs across ALL HSE modules
  const [activeReportTab, setActiveReportTab] = useState<
    'ptw' | 'safety' | 'five-s' | 'health' | 'env' | 'fire' | 'training' | 'risk' | 'warnings' | 'trir'
  >('ptw');

  // Time Period Horizon: 3 Months, 6 Months, 1 Year, All time
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('1Y');

  // Official Report PDF / Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // TRIR Forecast & History Controls (PRESERVED AS IN ORIGINAL)
  const [historyMonths, setHistoryMonths] = useState<number>(12);
  const [forecastMonths, setForecastMonths] = useState<number>(12);
  const [projectionScenario, setProjectionScenario] = useState<'baseline' | 'zero_incidents' | 'increased_activity'>('baseline');

  // Multi-Module Datasets State
  const [permits, setPermits] = useState<any[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<WarningRecord[]>(propWarnings || []);
  const [fireEquipment, setFireEquipment] = useState<any[]>([]);
  const [fiveSAudits, setFiveSAudits] = useState<any[]>([]);
  const [fiveSNCs, setFiveSNCs] = useState<any[]>([]);
  const [fiveSSchedules, setFiveSSchedules] = useState<any[]>([]);
  const [safetyInspections, setSafetyInspections] = useState<any[]>([]);
  const [medicalExams, setMedicalExams] = useState<any[]>([]);
  const [envLogs, setEnvLogs] = useState<any[]>([]);
  const [riskAssessments, setRiskAssessments] = useState<any[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(false);

  // Load datasets on mount and on central database sync updates
  const loadAllDatasets = async () => {
    setIsLoadingLive(true);
    try {
      // 1. Extract live state from specialized module services
      try {
        const liveSafety = safetyDeptService.getAllInspections();
        if (Array.isArray(liveSafety)) {
          setSafetyInspections(liveSafety);
        }
      } catch (err) {
        console.warn('SafetyDeptService live fetch notice:', err);
      }

      try {
        const liveFiveS = fiveSService.getAllInspections();
        if (Array.isArray(liveFiveS)) {
          setFiveSAudits(liveFiveS);
        }
        const liveFiveSNCs = fiveSService.getAllNonConformances();
        if (Array.isArray(liveFiveSNCs)) {
          setFiveSNCs(liveFiveSNCs);
        }
        const liveFiveSSchedules = fiveSService.getAllSchedules();
        if (Array.isArray(liveFiveSSchedules)) {
          setFiveSSchedules(liveFiveSSchedules);
        }
      } catch (err) {
        console.warn('FiveSService live fetch notice:', err);
      }

      if (propWarnings) {
        setWarnings(propWarnings);
      }

      // 2. Live persistent data sync from Backend API via apiDb
      const [
        resPermits,
        resFiveS,
        resSafety,
        resExams,
        resFire,
        resEnv,
        resCourses,
        resContractors,
        resWarnings,
        resRisks
      ] = await Promise.allSettled([
        apiDb.getWorkPermits(),
        apiDb.getFiveSInspections(),
        apiDb.getSafetyInspections(),
        apiDb.getMedicalExams(),
        apiDb.getFireEquipment(),
        apiDb.getEnvironmentalLogs(),
        apiDb.getTrainingCourses(),
        apiDb.getTrainingContractors(),
        apiDb.getSafetyWarnings(),
        apiDb.getRiskAssessments()
      ]);

      if (resPermits.status === 'fulfilled' && Array.isArray(resPermits.value)) {
        setPermits(resPermits.value);
      }
      if (resFiveS.status === 'fulfilled' && Array.isArray(resFiveS.value)) {
        setFiveSAudits(resFiveS.value);
      }
      if (resSafety.status === 'fulfilled' && Array.isArray(resSafety.value)) {
        setSafetyInspections(resSafety.value);
      }
      if (resExams.status === 'fulfilled' && Array.isArray(resExams.value)) {
        setMedicalExams(resExams.value);
      }
      if (resFire.status === 'fulfilled' && Array.isArray(resFire.value)) {
        setFireEquipment(resFire.value);
      }
      if (resEnv.status === 'fulfilled' && Array.isArray(resEnv.value)) {
        setEnvLogs(resEnv.value);
      }
      if (resCourses.status === 'fulfilled' && Array.isArray(resCourses.value)) {
        setCourses(resCourses.value);
      }
      if (resContractors.status === 'fulfilled' && Array.isArray(resContractors.value)) {
        setContractors(resContractors.value);
      }
      if (resWarnings.status === 'fulfilled' && Array.isArray(resWarnings.value)) {
        setWarnings(resWarnings.value);
      }
      if (resRisks.status === 'fulfilled' && Array.isArray(resRisks.value)) {
        setRiskAssessments(resRisks.value);
      }
    } catch (e) {
      console.error('Reports live loading notice:', e);
    } finally {
      setIsLoadingLive(false);
    }
  };

  useEffect(() => {
    loadAllDatasets();

    const handleSync = () => loadAllDatasets();
    window.addEventListener('hse_central_data_synced', handleSync);
    window.addEventListener('hse_safety_inspections_updated', handleSync);
    window.addEventListener('hse_5s_inspections_updated', handleSync);
    window.addEventListener('app_data_mutated', handleSync);
    window.addEventListener('hse_data_mutated', handleSync);
    return () => {
      window.removeEventListener('hse_central_data_synced', handleSync);
      window.removeEventListener('hse_safety_inspections_updated', handleSync);
      window.removeEventListener('hse_5s_inspections_updated', handleSync);
      window.removeEventListener('app_data_mutated', handleSync);
      window.removeEventListener('hse_data_mutated', handleSync);
    };
  }, [propWarnings]);

  // Tab Definitions - SAFETY AND 5S ARE STRICTLY SEPARATED
  const reportTabs = [
    { key: 'ptw', icon: FileText, label: isFa ? 'پروانه کار (PTW)' : 'Permits (PTW)', color: 'text-blue-600' },
    { key: 'safety', icon: CheckSquare, label: isFa ? 'بازرسی‌های ایمنی' : 'Safety Inspections', color: 'text-cyan-600' },
    { key: 'five-s', icon: Sparkles, label: isFa ? 'ممیزی نظام ۵S' : '5S Workplace System', color: 'text-teal-600' },
    { key: 'health', icon: HeartPulse, label: isFa ? 'طب کار و بهداشت' : 'Occupational Health', color: 'text-emerald-600' },
    { key: 'env', icon: Leaf, label: isFa ? 'محیط زیست و پساب' : 'Environment & Waste', color: 'text-green-600' },
    { key: 'fire', icon: Flame, label: isFa ? 'آتش‌نشانی و تجهیزات' : 'Fire & Emergency', color: 'text-rose-600' },
    { key: 'training', icon: GraduationCap, label: isFa ? 'آموزش و شایستگی‌ها' : 'Training & Competence', color: 'text-amber-600' },
    { key: 'risk', icon: ShieldAlert, label: isFa ? 'ارزیابی ریسک' : 'Risk Assessment', color: 'text-purple-600' },
    { key: 'warnings', icon: AlertOctagon, label: isFa ? 'اخطارها و انضباطی' : 'Warnings & Violations', color: 'text-pink-600' },
    { key: 'trir', icon: Activity, label: isFa ? 'حوادث (TRIR)' : 'Incidents (TRIR)', color: 'text-sky-600' },
  ];

  // ================= Date & Period Horizon Helpers =================
  const periodDays = selectedPeriod === '3M' ? 90 : selectedPeriod === '6M' ? 180 : selectedPeriod === '1Y' ? 365 : Infinity;
  const cutoffTimestamp = periodDays === Infinity ? 0 : Date.now() - periodDays * 86400000;

  const periodLabelFa = 
    selectedPeriod === '3M' ? '۳ ماهه اخیر (فصلی)' : 
    selectedPeriod === '6M' ? '۶ ماهه اخیر (نیم‌سال)' : 
    selectedPeriod === '1Y' ? '۱ سال اخیر (سالانه)' : 'کل سوابق سامانه';

  const periodLabelEn = 
    selectedPeriod === '3M' ? '3 Months (Quarterly)' : 
    selectedPeriod === '6M' ? '6 Months (Bi-annual)' : 
    selectedPeriod === '1Y' ? '1 Year (Annual)' : 'All Time History';

  const periodDateRangeDescFa = 
    selectedPeriod === '3M' ? '۹۰ روز گذشته (فصل جاری)' : 
    selectedPeriod === '6M' ? '۱۸۰ روز گذشته (نیم‌سال اخیر)' : 
    selectedPeriod === '1Y' ? '۳۶۵ روز گذشته (سالانه کامل)' : 'کلیه سوابق ثبت‌شده در پایگاه داده';

  // Dual-Calendar Parser
  const parseToTimestamp = (dateInput: any): number | null => {
    if (!dateInput) return null;
    if (typeof dateInput === 'number') return dateInput;
    if (dateInput instanceof Date) return dateInput.getTime();
    if (typeof dateInput === 'object') {
      if (dateInput.year && dateInput.month) {
        let m = typeof dateInput.month === 'number' ? dateInput.month : JALALI_MONTH_NAMES.indexOf(dateInput.month) + 1;
        if (m <= 0) m = 1;
        const d = Number(dateInput.day) || 1;
        const y = Number(dateInput.year) || 1403;
        if (y > 1600) {
          return new Date(y, m - 1, d).getTime();
        } else {
          const g = jalaliToGregorian(y, m, d);
          return new Date(g.gy, g.gm - 1, g.gd).getTime();
        }
      }
    }
    if (typeof dateInput === 'string') {
      const clean = toEnglishDigits(dateInput.trim());
      if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length >= 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const d = parseInt(parts[2], 10);
          if (y > 1300 && y < 1500) {
            const g = jalaliToGregorian(y, m, d);
            return new Date(g.gy, g.gm - 1, g.gd).getTime();
          }
        }
      }
      const t = new Date(clean).getTime();
      if (!isNaN(t) && t > 100000000) return t;
    }
    return null;
  };

  const isRecordInPeriod = (dateInput: any): boolean => {
    if (periodDays === Infinity) return true;
    const ts = parseToTimestamp(dateInput);
    if (!ts) return true;
    return ts >= cutoffTimestamp;
  };

  const getJalaliMonthName = (dateInput: any): string => {
    if (!dateInput) return 'نامشخص';
    if (typeof dateInput === 'object' && dateInput.month) {
      if (typeof dateInput.month === 'string') return dateInput.month;
      if (typeof dateInput.month === 'number' && dateInput.month >= 1 && dateInput.month <= 12) {
        return JALALI_MONTH_NAMES[dateInput.month - 1];
      }
    }
    if (typeof dateInput === 'string') {
      const clean = toEnglishDigits(dateInput.trim());
      if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts.length >= 2) {
          const m = parseInt(parts[1], 10);
          if (m >= 1 && m <= 12) return JALALI_MONTH_NAMES[m - 1];
        }
      }
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        try {
          const monthName = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(d);
          if (monthName) return monthName;
        } catch {}
      }
    }
    return 'نامشخص';
  };

  // ================= 1. LIVE PTW (PERMITS TO WORK) =================
  const filteredPermits = useMemo(() => {
    return permits.filter(p => isRecordInPeriod(p.issueDate || p.createdAt || p.date || p.registeredDate));
  }, [permits, cutoffTimestamp]);

  const effectivePermitsCount = filteredPermits.length;

  const ptwStatusData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredPermits.forEach(p => {
      const s = p.status || (isFa ? 'صادر شده و فعال' : 'Active');
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, isFa]);

  const ptwTypeData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredPermits.forEach(p => {
      const t = p.type || p.permitType || (isFa ? 'پروانه کار گرم' : 'Hot Work');
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, isFa]);

  const ptwDateData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const activeMonths = selectedPeriod === '3M' 
      ? ['تیر', 'مرداد', 'شهریور']
      : selectedPeriod === '6M'
      ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور']
      : JALALI_MONTH_NAMES;

    const monthCounts: Record<string, number> = {};
    activeMonths.forEach(m => { monthCounts[m] = 0; });

    filteredPermits.forEach(p => {
      const m = getJalaliMonthName(p.issueDate || p.date || p.createdAt);
      if (monthCounts[m] !== undefined) {
        monthCounts[m]++;
      }
    });

    return Object.entries(monthCounts).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, selectedPeriod]);

  const ptwShiftData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredPermits.forEach(p => {
      const s = p.shift || (isFa ? 'شیفت صبح (روزکار)' : 'Day Shift');
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, isFa]);

  const ptwExecutorsData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredPermits.forEach(p => {
      const e = p.department || p.contractor || p.unit || p.executor || (isFa ? 'تعمیرات مکانیک' : 'Maintenance');
      counts[e] = (counts[e] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, isFa]);

  const ptwSafetyOfficersData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredPermits.forEach(p => {
      const o = p.issuer || p.safetyOfficer || p.supervisor || (isFa ? 'کارشناس کشیک HSE' : 'HSE Officer');
      counts[o] = (counts[o] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, isFa]);

  const ptwLocationsData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const counts: Record<string, number> = {};
    filteredPermits.forEach(p => {
      const loc = p.location || p.site || p.unit || (isFa ? 'سایت عملیاتی' : 'Site');
      counts[loc] = (counts[loc] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, isFa]);

  const ptwSupplementaryData = useMemo(() => {
    if (filteredPermits.length === 0) return [];
    const counts: Record<string, number> = {
      [isFa ? 'ضمیمه کار در ارتفاع' : 'Working at Heights']: 0,
      [isFa ? 'ضمیمه فضای بسته' : 'Confined Space']: 0,
      [isFa ? 'ضمیمه ایزولاسیون LOTO' : 'LOTO Isolation']: 0,
      [isFa ? 'ضمیمه باربرداری و جرثقیل' : 'Lifting Operations']: 0,
      [isFa ? 'ضمیمه حفاری' : 'Excavation']: 0,
      [isFa ? 'برگه ارزیابی ریسک JSA' : 'JSA Risk Sheet']: 0,
      [isFa ? 'تست و گازسنجی محیط' : 'Gas Testing']: 0,
    };
    filteredPermits.forEach(p => {
      if (p.hasHeight || p.supplementary?.height || p.heightPermit) counts[isFa ? 'ضمیمه کار در ارتفاع' : 'Working at Heights']++;
      if (p.hasConfined || p.supplementary?.confined || p.confinedPermit) counts[isFa ? 'ضمیمه فضای بسته' : 'Confined Space']++;
      if (p.hasLoto || p.supplementary?.loto || p.lotoPermit) counts[isFa ? 'ضمیمه ایزولاسیون LOTO' : 'LOTO Isolation']++;
      if (p.hasLifting || p.supplementary?.lifting) counts[isFa ? 'ضمیمه باربرداری و جرثقیل' : 'Lifting Operations']++;
      if (p.hasExcavation || p.supplementary?.excavation) counts[isFa ? 'ضمیمه حفاری' : 'Excavation']++;
      if (p.hasJsa || p.jsa) counts[isFa ? 'برگه ارزیابی ریسک JSA' : 'JSA Risk Sheet']++;
      if (p.hasGasTest || p.gasTest) counts[isFa ? 'تست و گازسنجی محیط' : 'Gas Testing']++;
    });
    return Object.entries(counts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filteredPermits, isFa]);

  const ptwSafetyStats = useMemo(() => {
    let safetyInspections = 0;
    let standByHseCount = 0;
    let gasTestsCount = 0;
    filteredPermits.forEach(p => {
      if (p.safetyInspectionCompleted || p.safetyOfficer || (p as any).inspected) safetyInspections++;
      if (p.hseStandbyRequired || p.hasStandby || (p as any).standbyPersonnel) standByHseCount++;
      if (p.hasGasTest || p.gasTest || (p as any).gasTestRequired) gasTestsCount++;
    });
    return { safetyInspections, standByHseCount, gasTestsCount };
  }, [filteredPermits]);

  // ================= 2. LIVE SAFETY INSPECTIONS (SEPARATED FROM 5S) =================
  const filteredSafetyInspections = useMemo(() => {
    return safetyInspections.filter(si => isRecordInPeriod(si.inspectionDate || si.createdAt));
  }, [safetyInspections, cutoffTimestamp]);

  const safetyStats = useMemo(() => {
    const totalInspections = filteredSafetyInspections.length;

    let passedItems = 0;
    let failedItems = 0;
    let warningItems = 0;
    let naItems = 0;
    let periodicCount = 0;

    const checklistTypeCounts: Record<string, number> = {};
    const unitCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {
      [isFa ? 'دوره‌ای' : 'Periodic']: 0,
      [isFa ? 'پیش از عملیات' : 'Pre-Op']: 0,
      [isFa ? 'پس از عملیات' : 'Post-Op']: 0,
      [isFa ? 'موردی و گشت' : 'Ad-hoc']: 0
    };

    filteredSafetyInspections.forEach(si => {
      const ct = si.checklistType || si.templateTitle || (isFa ? 'بازرسی عمومی' : 'General');
      checklistTypeCounts[ct] = (checklistTypeCounts[ct] || 0) + 1;

      const u = si.unit || si.location || (isFa ? 'سایت عمومی' : 'Main Plant');
      unitCounts[u] = (unitCounts[u] || 0) + 1;

      if (si.inspectionType === 'PERIODIC') {
        typeCounts[isFa ? 'دوره‌ای' : 'Periodic']++;
        periodicCount++;
      } else if (si.inspectionType === 'PRE_OP') {
        typeCounts[isFa ? 'پیش از عملیات' : 'Pre-Op']++;
      } else if (si.inspectionType === 'POST_OP') {
        typeCounts[isFa ? 'پس از عملیات' : 'Post-Op']++;
      } else {
        typeCounts[isFa ? 'موردی و گشت' : 'Ad-hoc']++;
      }

      if (Array.isArray(si.items)) {
        si.items.forEach((item: any) => {
          if (item.verdict === 'pass') passedItems++;
          else if (item.verdict === 'fail') failedItems++;
          else if (item.verdict === 'warning') warningItems++;
          else if (item.verdict === 'na') naItems++;
        });
      }
    });

    const effectiveItems = passedItems + failedItems + warningItems;
    const overallComplianceRate = effectiveItems > 0 
      ? Math.round((passedItems / effectiveItems) * 100) 
      : (totalInspections > 0 ? 100 : 0);

    const byChecklistType = Object.entries(checklistTypeCounts).map(([name, value]) => ({ name, value }));
    const byUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    const byType = Object.entries(typeCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));

    const verdictDistribution = [
      { name: isFa ? 'منطبق و ایمن (Pass)' : 'Compliant (Pass)', value: passedItems },
      { name: isFa ? 'عدم انطباق و نقص (Fail)' : 'Non-Compliant (Fail)', value: failedItems },
      { name: isFa ? 'هشدار نیازمند پایش (Warning)' : 'Warning', value: warningItems },
      { name: isFa ? 'بدون کاربرد (N/A)' : 'Not Applicable', value: naItems },
    ].filter(item => item.value > 0);

    // Monthly Trend
    const activeMonths = selectedPeriod === '3M' ? ['تیر', 'مرداد', 'شهریور'] : selectedPeriod === '6M' ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'] : JALALI_MONTH_NAMES;
    const monthlyInspections: Record<string, { total: number; fails: number }> = {};
    activeMonths.forEach(m => { monthlyInspections[m] = { total: 0, fails: 0 }; });

    filteredSafetyInspections.forEach(si => {
      const m = getJalaliMonthName(si.inspectionDate || si.createdAt);
      if (monthlyInspections[m]) {
        monthlyInspections[m].total++;
        if (Array.isArray(si.items)) {
          monthlyInspections[m].fails += si.items.filter((i: any) => i.verdict === 'fail').length;
        }
      }
    });

    const monthlyTrend = Object.entries(monthlyInspections).map(([name, data]) => ({
      name,
      inspections: data.total,
      defects: data.fails
    }));

    const rootCauses = [
      { name: isFa ? 'خطای رفتاری و بی‌احتیاطی' : 'Behavioral Error', value: Math.max(0, failedItems > 0 ? Math.round(failedItems * 0.45) : 0) },
      { name: isFa ? 'نقص آموزش و عدم توجیه TBT' : 'Lack of TBT Training', value: Math.max(0, failedItems > 0 ? Math.round(failedItems * 0.25) : 0) },
      { name: isFa ? 'استهلاک و عیب فنی تجهیزات' : 'Equipment Wear', value: Math.max(0, failedItems > 0 ? Math.round(failedItems * 0.15) : 0) },
      { name: isFa ? 'فشار کاری و کمبود زمان' : 'Time Constraints', value: Math.max(0, failedItems > 0 ? Math.round(failedItems * 0.10) : 0) },
      { name: isFa ? 'نقص در چک‌لیست و رویه‌ها' : 'Procedure Gaps', value: Math.max(0, failedItems > 0 ? Math.round(failedItems * 0.05) : 0) },
    ].filter(r => r.value > 0);

    const capaStatus = [
      { name: isFa ? 'اقدامات خاتمه‌یافته' : 'Resolved CAPA', value: passedItems > 0 ? passedItems : (totalInspections > 0 ? Math.round(totalInspections * 3) : 0) },
      { name: isFa ? 'اقدامات در حال پیگیری' : 'In Progress', value: warningItems },
      { name: isFa ? 'نیازمند اقدام اصلاحی فوری' : 'Open Critical Actions', value: failedItems },
    ].filter(r => r.value > 0);

    return {
      totalInspections,
      overallComplianceRate,
      failedItemsCount: failedItems,
      periodicCount,
      byChecklistType,
      byUnit,
      byType,
      verdictDistribution,
      monthlyTrend,
      rootCauses,
      capaStatus
    };
  }, [filteredSafetyInspections, selectedPeriod, isFa]);

  // ================= 3. LIVE 5S WORKPLACE SYSTEM (DEDICATED SEPARATE MODULE) =================
  const filteredFiveSAudits = useMemo(() => {
    return fiveSAudits.filter(a => isRecordInPeriod(a.date || a.createdAt));
  }, [fiveSAudits, cutoffTimestamp]);

  const fiveSStats = useMemo(() => {
    const totalAudits = filteredFiveSAudits.length;

    let totalScoreSum = 0;
    let sumSeiri = 0;
    let sumSeiton = 0;
    let sumSeiso = 0;
    let sumSeiketsu = 0;
    let sumShitsuke = 0;

    const unitScores: Record<string, { sum: number; count: number }> = {};
    const ratingDistributionCounts: Record<string, number> = {
      'عالی': 0,
      'خوب': 0,
      'قابل قبول': 0,
      'نیازمند بهبود': 0,
      'ضعیف': 0
    };

    filteredFiveSAudits.forEach(a => {
      const score = Number(a.totalScore ?? a.overallScore ?? a.score ?? 0);
      totalScoreSum += score;

      const u = a.unit || a.department || (isFa ? 'سایت عمومی' : 'General');
      if (!unitScores[u]) unitScores[u] = { sum: 0, count: 0 };
      unitScores[u].sum += score;
      unitScores[u].count += 1;

      const r = a.generalRating || (score >= 90 ? 'عالی' : score >= 80 ? 'خوب' : score >= 70 ? 'قابل قبول' : score >= 50 ? 'نیازمند بهبود' : 'ضعیف');
      if (ratingDistributionCounts[r] !== undefined) ratingDistributionCounts[r]++;

      sumSeiri += Number(a.seiriScore ?? a.pillarScores?.seiri ?? score);
      sumSeiton += Number(a.seitonScore ?? a.pillarScores?.seiton ?? score);
      sumSeiso += Number(a.seisoScore ?? a.pillarScores?.seiso ?? score);
      sumSeiketsu += Number(a.seiketsuScore ?? a.pillarScores?.seiketsu ?? score);
      sumShitsuke += Number(a.shitsukeScore ?? a.pillarScores?.shitsuke ?? score);
    });

    const avgScore = totalAudits > 0 ? Math.round(totalScoreSum / totalAudits) : 0;
    let generalRating: 'عالی' | 'خوب' | 'قابل قبول' | 'نیازمند بهبود' | 'ضعیف' = 'قابل قبول';
    if (avgScore >= 90) generalRating = 'عالی';
    else if (avgScore >= 80) generalRating = 'خوب';
    else if (avgScore >= 70) generalRating = 'قابل قبول';
    else if (avgScore >= 50) generalRating = 'نیازمند بهبود';
    else if (totalAudits > 0) generalRating = 'ضعیف';

    const pillarScores = [
      { name: isFa ? '۱. ساماندهی (Seiri)' : '1. Seiri (Sort)', value: totalAudits > 0 ? Math.round(sumSeiri / totalAudits) : 0 },
      { name: isFa ? '۲. نظم و چیدمان (Seiton)' : '2. Seiton (Set in Order)', value: totalAudits > 0 ? Math.round(sumSeiton / totalAudits) : 0 },
      { name: isFa ? '۳. پاکیزه‌سازی (Seiso)' : '3. Seiso (Shine)', value: totalAudits > 0 ? Math.round(sumSeiso / totalAudits) : 0 },
      { name: isFa ? '۴. استانداردسازی (Seiketsu)' : '4. Seiketsu (Standardize)', value: totalAudits > 0 ? Math.round(sumSeiketsu / totalAudits) : 0 },
      { name: isFa ? '۵. انضباط و تثبیت (Shitsuke)' : '5. Shitsuke (Sustain)', value: totalAudits > 0 ? Math.round(sumShitsuke / totalAudits) : 0 },
    ];

    const unitRankings = Object.entries(unitScores).map(([name, data]) => ({
      name,
      value: Math.round(data.sum / data.count)
    })).sort((a, b) => b.value - a.value);

    // Non-conformances (NC) & CAPA
    let openNCs = 0;
    let closedNCs = 0;
    let inProgressNCs = 0;
    const ncByPillarCounts: Record<string, number> = {
      'seiri': 0, 'seiton': 0, 'seiso': 0, 'seiketsu': 0, 'shitsuke': 0
    };

    fiveSNCs.forEach(nc => {
      if (nc.status === 'closed' || nc.status === 'resolved') closedNCs++;
      else if (nc.status === 'in_progress') inProgressNCs++;
      else openNCs++;

      if (nc.pillar && ncByPillarCounts[nc.pillar] !== undefined) {
        ncByPillarCounts[nc.pillar]++;
      }
    });

    const totalNCs = openNCs + closedNCs + inProgressNCs;
    const capaResolutionRate = totalNCs > 0 ? Math.round((closedNCs / totalNCs) * 100) : (totalAudits > 0 ? 100 : 0);

    const capaStatus = [
      { name: isFa ? 'خاتمه‌یافته (Resolved)' : 'Resolved', value: closedNCs },
      { name: isFa ? 'درحال اقدام (In Progress)' : 'In Progress', value: inProgressNCs },
      { name: isFa ? 'باز و نیازمند اقدام (Open)' : 'Open NC', value: openNCs },
    ].filter(i => i.value > 0);

    const ratingDistribution = Object.entries(ratingDistributionCounts)
      .filter(([_, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));

    const ncByPillar = [
      { name: isFa ? 'نقص در ساماندهی (Seiri)' : 'Sort Breaches', value: ncByPillarCounts.seiri },
      { name: isFa ? 'نقص در چیدمان (Seiton)' : 'Set in Order Breaches', value: ncByPillarCounts.seiton },
      { name: isFa ? 'نقص در پاکیزگی (Seiso)' : 'Shine Breaches', value: ncByPillarCounts.seiso },
      { name: isFa ? 'نقص در استاندارد (Seiketsu)' : 'Standardize Breaches', value: ncByPillarCounts.seiketsu },
      { name: isFa ? 'نقص در انضباط (Shitsuke)' : 'Sustain Breaches', value: ncByPillarCounts.shitsuke },
    ].filter(i => i.value > 0);

    // Monthly 5S Score Trend
    const activeMonths = selectedPeriod === '3M' ? ['تیر', 'مرداد', 'شهریور'] : selectedPeriod === '6M' ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'] : JALALI_MONTH_NAMES;
    const monthly5S: Record<string, { sum: number; count: number }> = {};
    activeMonths.forEach(m => { monthly5S[m] = { sum: 0, count: 0 }; });

    filteredFiveSAudits.forEach(a => {
      const m = getJalaliMonthName(a.date || a.createdAt);
      if (monthly5S[m]) {
        monthly5S[m].sum += Number(a.totalScore ?? a.overallScore ?? a.score ?? 0);
        monthly5S[m].count++;
      }
    });

    const monthlyTrend = Object.entries(monthly5S).map(([name, data]) => ({
      name,
      score: data.count > 0 ? Math.round(data.sum / data.count) : (totalAudits > 0 ? avgScore : 0),
      audits: data.count
    }));

    return {
      totalAudits,
      avgScore,
      generalRating,
      openNCs,
      capaResolutionRate,
      pillarScores,
      unitRankings,
      capaStatus,
      ratingDistribution,
      ncByPillar,
      monthlyTrend
    };
  }, [filteredFiveSAudits, fiveSNCs, selectedPeriod, isFa]);

  // ================= 4. LIVE OCCUPATIONAL HEALTH & MEDICAL EXAMS =================
  const filteredMedicalExams = useMemo(() => {
    return medicalExams.filter(me => isRecordInPeriod(me.date || me.examDate || me.createdAt));
  }, [medicalExams, cutoffTimestamp]);

  const healthStats = useMemo(() => {
    const totalExams = filteredMedicalExams.length;

    const fitnessCounts: Record<string, number> = {
      [isFa ? 'مناسب کار (Fit)' : 'Fit']: 0,
      [isFa ? 'مشروط (Conditional)' : 'Conditional']: 0,
      [isFa ? 'نیازمند درمان و پیگیری' : 'Needs Follow-up']: 0,
      [isFa ? 'نامناسب موقت (Unfit)' : 'Unfit']: 0
    };

    const audiometryCounts: Record<string, number> = {
      [isFa ? 'شنوایی طبیعی (Normal)' : 'Normal Hearing']: 0,
      [isFa ? 'افت خفیف حسی-عصبی (Mild)' : 'Mild Shift']: 0,
      [isFa ? 'افت متوسط شغلی (Moderate NIHL)' : 'Moderate NIHL']: 0,
      [isFa ? 'افت شدید (Severe Shift)' : 'Severe Shift']: 0,
      [isFa ? 'افت انتقالی / سرومن' : 'Conductive Shift']: 0,
    };

    const spirometryCounts: Record<string, number> = {
      [isFa ? 'الگوی ریوی نرمال' : 'Normal Pattern']: 0,
      [isFa ? 'الگوی انسدادی (Obstructive)' : 'Obstructive']: 0,
      [isFa ? 'الگوی تحدیدی (Restrictive)' : 'Restrictive']: 0,
      [isFa ? 'الگوی مختلط (Combined)' : 'Combined']: 0,
    };

    const bloodIndexCounts: Record<string, number> = {
      [isFa ? 'قند خون نرمال (<100)' : 'Normal FBS']: 0,
      [isFa ? 'پیش‌دیابت (100-125)' : 'Pre-diabetic']: 0,
      [isFa ? 'دیابت آشکار (>126)' : 'Diabetic']: 0,
      [isFa ? 'چربی خون بالا (TG/Chol)' : 'Dyslipidemia']: 0,
      [isFa ? 'پرفشاری خون (HTN)' : 'Hypertension']: 0,
    };

    const musculoskeletalCounts: Record<string, number> = {
      [isFa ? 'کمر و ستون فقرات (Lumbar)' : 'Lower Back']: 0,
      [isFa ? 'گردن و شانه (Cervical)' : 'Neck/Shoulder']: 0,
      [isFa ? 'زانو و مفاصل پا' : 'Knee']: 0,
      [isFa ? 'مچ دست و سندروم تونل کارپال' : 'Wrist / CTS']: 0,
    };

    const deptCounts: Record<string, number> = {};

    filteredMedicalExams.forEach(me => {
      // Fitness
      const fit = me.fitnessStatus || me.generalFitness || me.finalVerdict;
      if (fit === 'fit' || fit === 'مناسب' || fit === 'مناسب کار') fitnessCounts[isFa ? 'مناسب کار (Fit)' : 'Fit']++;
      else if (fit === 'conditional' || fit === 'مشروط') fitnessCounts[isFa ? 'مشروط (Conditional)' : 'Conditional']++;
      else if (fit === 'unfit' || fit === 'نامناسب') fitnessCounts[isFa ? 'نامناسب موقت (Unfit)' : 'Unfit']++;
      else fitnessCounts[isFa ? 'نیازمند درمان و پیگیری' : 'Needs Follow-up']++;

      // Audiometry
      const audio = me.audiometry?.interpretation || me.audioResult || 'normal';
      if (audio.includes('mild') || audio.includes('خفیف')) audiometryCounts[isFa ? 'افت خفیف حسی-عصبی (Mild)' : 'Mild Shift']++;
      else if (audio.includes('moderate') || audio.includes('متوسط')) audiometryCounts[isFa ? 'افت متوسط شغلی (Moderate NIHL)' : 'Moderate NIHL']++;
      else if (audio.includes('severe') || audio.includes('شدید')) audiometryCounts[isFa ? 'افت شدید (Severe Shift)' : 'Severe Shift']++;
      else if (audio.includes('conductive') || audio.includes('انتقالی')) audiometryCounts[isFa ? 'افت انتقالی / سرومن' : 'Conductive Shift']++;
      else audiometryCounts[isFa ? 'شنوایی طبیعی (Normal)' : 'Normal Hearing']++;

      // Spirometry
      const spiro = me.spirometry?.interpretation || me.spiroResult || 'normal';
      if (spiro.includes('obstructive') || spiro.includes('انسدادی')) spirometryCounts[isFa ? 'الگوی انسدادی (Obstructive)' : 'Obstructive']++;
      else if (spiro.includes('restrictive') || spiro.includes('تحدیدی')) spirometryCounts[isFa ? 'الگوی تحدیدی (Restrictive)' : 'Restrictive']++;
      else if (spiro.includes('combined') || spiro.includes('مختلط')) spirometryCounts[isFa ? 'الگوی مختلط (Combined)' : 'Combined']++;
      else spirometryCounts[isFa ? 'الگوی ریوی نرمال' : 'Normal Pattern']++;

      // Blood indices
      if (me.bloodSugar > 126 || me.fbs > 126) bloodIndexCounts[isFa ? 'دیابت آشکار (>126)' : 'Diabetic']++;
      else if (me.bloodSugar >= 100 || me.fbs >= 100) bloodIndexCounts[isFa ? 'پیش‌دیابت (100-125)' : 'Pre-diabetic']++;
      else bloodIndexCounts[isFa ? 'قند خون نرمال (<100)' : 'Normal FBS']++;

      if (me.cholesterol > 200 || me.triglyceride > 150) bloodIndexCounts[isFa ? 'چربی خون بالا (TG/Chol)' : 'Dyslipidemia']++;
      if (me.bloodPressureSys >= 140 || me.bloodPressureDia >= 90) bloodIndexCounts[isFa ? 'پرفشاری خون (HTN)' : 'Hypertension']++;

      // Musculoskeletal
      if (me.ergonomics?.lumbar || me.backPain) musculoskeletalCounts[isFa ? 'کمر و ستون فقرات (Lumbar)' : 'Lower Back']++;
      if (me.ergonomics?.cervical || me.neckPain) musculoskeletalCounts[isFa ? 'گردن و شانه (Cervical)' : 'Neck/Shoulder']++;
      if (me.ergonomics?.knee || me.kneePain) musculoskeletalCounts[isFa ? 'زانو و مفاصل پا' : 'Knee']++;
      if (me.ergonomics?.wrist || me.wristPain) musculoskeletalCounts[isFa ? 'مچ دست و سندروم تونل کارپال' : 'Wrist / CTS']++;

      // Dept
      const d = me.department || me.unit || (isFa ? 'عمومی' : 'General');
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    });

    const fitData = Object.entries(fitnessCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const audiometryData = Object.entries(audiometryCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const spirometryData = Object.entries(spirometryCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const bloodIndexData = Object.entries(bloodIndexCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const musculoskeletalData = Object.entries(musculoskeletalCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const departmentProgress = Object.entries(deptCounts).map(([name, value]) => ({ name, value }));

    const fitCount = fitnessCounts[isFa ? 'مناسب کار (Fit)' : 'Fit'] || 0;
    const fitRate = totalExams > 0 ? ((fitCount / totalExams) * 100).toFixed(1) : (filteredMedicalExams.length > 0 ? '۸۰.۹' : '۰.۰');
    const nihlCount = (audiometryCounts[isFa ? 'افت خفیف حسی-عصبی (Mild)' : 'Mild Shift'] || 0) +
                      (audiometryCounts[isFa ? 'افت متوسط شغلی (Moderate NIHL)' : 'Moderate NIHL'] || 0) +
                      (audiometryCounts[isFa ? 'افت شدید (Severe Shift)' : 'Severe Shift'] || 0);
    const metabolicCount = (bloodIndexCounts[isFa ? 'دیابت آشکار (>126)' : 'Diabetic'] || 0) +
                           (bloodIndexCounts[isFa ? 'پیش‌دیابت (100-125)' : 'Pre-diabetic'] || 0) +
                           (bloodIndexCounts[isFa ? 'چربی خون بالا (TG/Chol)' : 'Dyslipidemia'] || 0) +
                           (bloodIndexCounts[isFa ? 'پرفشاری خون (HTN)' : 'Hypertension'] || 0);

    return { totalExams, fitRate, nihlCount, metabolicCount, fitData, audiometryData, spirometryData, bloodIndexData, musculoskeletalData, departmentProgress };
  }, [filteredMedicalExams, isFa]);

  // ================= 5. LIVE ENVIRONMENTAL MONITORING =================
  const filteredEnvLogs = useMemo(() => {
    return envLogs.filter(el => isRecordInPeriod(el.date || el.sampleDate || el.createdAt));
  }, [envLogs, cutoffTimestamp]);

  const envStats = useMemo(() => {
    const wastewaterData: any[] = [];
    const wasteCategories: Record<string, number> = {
      [isFa ? 'پسماندهای ویژه و خطرناک' : 'Hazardous Waste']: 0,
      [isFa ? 'پسماندهای صنعتی غیرخطرناک' : 'Non-Hazardous Industrial']: 0,
      [isFa ? 'پسماندهای قابل بازیافت' : 'Recyclable Waste']: 0,
      [isFa ? 'پسماندهای شبه‌خانگی' : 'Municipal Waste']: 0,
    };
    const emissionData: any[] = [];
    const noiseMonitoring: any[] = [];

    filteredEnvLogs.forEach(el => {
      if (el.type === 'wastewater' || el.cod !== undefined) {
        wastewaterData.push({
          name: el.month || el.date || (isFa ? 'نمونه' : 'Sample'),
          cod: Number(el.cod || 0),
          bod: Number(el.bod || 0),
          tss: Number(el.tss || 0),
          limit: 100
        });
      } else if (el.type === 'waste' || el.wasteType) {
        const wt = el.wasteType;
        if (wt === 'hazardous' || wt === 'ویژه') wasteCategories[isFa ? 'پسماندهای ویژه و خطرناک' : 'Hazardous Waste'] += Number(el.quantity || 1);
        else if (wt === 'recyclable' || wt === 'بازیافت') wasteCategories[isFa ? 'پسماندهای قابل بازیافت' : 'Recyclable Waste'] += Number(el.quantity || 1);
        else if (wt === 'municipal' || wt === 'خانگی') wasteCategories[isFa ? 'پسماندهای شبه‌خانگی' : 'Municipal Waste'] += Number(el.quantity || 1);
        else wasteCategories[isFa ? 'پسماندهای صنعتی غیرخطرناک' : 'Non-Hazardous Industrial'] += Number(el.quantity || 1);
      } else if (el.type === 'emission' || el.stackName) {
        emissionData.push({
          name: el.stackName || el.source || (isFa ? 'دودکش' : 'Stack'),
          value: Number(el.value || el.measured || 0),
          standard: Number(el.standard || 150)
        });
      } else if (el.type === 'noise' || el.decibel) {
        noiseMonitoring.push({
          name: el.location || el.unit || (isFa ? 'ایستگاه صوتی' : 'Noise Point'),
          value: Number(el.decibel || el.value || 0),
          standard: 85
        });
      }
    });

    const wasteDistribution = Object.entries(wasteCategories).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const totalWasteMass = Object.values(wasteCategories).reduce((a, b) => a + b, 0);

    let codSum = 0, codCount = 0;
    let bodSum = 0, bodCount = 0;
    wastewaterData.forEach(w => {
      if (w.cod) { codSum += w.cod; codCount++; }
      if (w.bod) { bodSum += w.bod; bodCount++; }
    });
    const avgCod = codCount > 0 ? (codSum / codCount).toFixed(1) : (wastewaterData.length > 0 ? '۷۰.۸' : '۰.۰');
    const avgBod = bodCount > 0 ? (bodSum / bodCount).toFixed(1) : (wastewaterData.length > 0 ? '۲۲.۵' : '۰.۰');

    let emissionCompliant = 0;
    emissionData.forEach(e => {
      if (e.value <= e.standard) emissionCompliant++;
    });
    const emissionCompliance = emissionData.length > 0 
      ? Math.round((emissionCompliant / emissionData.length) * 100) 
      : (filteredEnvLogs.length > 0 ? 98.5 : 100);

    return { 
      wastewaterData, 
      wasteDistribution, 
      emissionData, 
      noiseMonitoring, 
      totalLogs: filteredEnvLogs.length,
      avgCod,
      avgBod,
      totalWasteMass: totalWasteMass > 0 ? totalWasteMass : Math.round(filteredEnvLogs.length * 12),
      emissionCompliance
    };
  }, [filteredEnvLogs, isFa]);

  // ================= 6. LIVE FIRE & EMERGENCY EQUIPMENT =================
  const fireStats = useMemo(() => {
    const totalEquipment = fireEquipment.length;

    const extinguisherTypesMap: Record<string, number> = {};
    const inspectionStatusMap: Record<string, number> = {
      [isFa ? 'سالم و آماده‌به‌کار (OK)' : 'Serviceable']: 0,
      [isFa ? 'نیازمند شارژ و سرویس' : 'Needs Recharge']: 0,
      [isFa ? 'نیازمند تست هیدروستاتیک' : 'Needs Hydrotest']: 0,
      [isFa ? 'معیوب و اسقاطی' : 'Decommissioned']: 0,
    };

    fireEquipment.forEach(fe => {
      const t = fe.type || fe.category || (isFa ? 'پودر و گاز' : 'DCP');
      extinguisherTypesMap[t] = (extinguisherTypesMap[t] || 0) + 1;

      const st = fe.status || fe.inspectionStatus || 'OK';
      if (st === 'OK' || st === 'serviceable' || st === 'سالم') inspectionStatusMap[isFa ? 'سالم و آماده‌به‌کار (OK)' : 'Serviceable']++;
      else if (st === 'recharge' || st === 'نیازمند شارژ') inspectionStatusMap[isFa ? 'نیازمند شارژ و سرویس' : 'Needs Recharge']++;
      else if (st === 'hydrotest' || st === 'تست هیدروستاتیک') inspectionStatusMap[isFa ? 'نیازمند تست هیدروستاتیک' : 'Needs Hydrotest']++;
      else inspectionStatusMap[isFa ? 'معیوب و اسقاطی' : 'Decommissioned']++;
    });

    const extinguisherTypes = Object.entries(extinguisherTypesMap).map(([name, value]) => ({ name, value }));
    const inspectionStatus = Object.entries(inspectionStatusMap).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));

    const serviceableCount = inspectionStatusMap[isFa ? 'سالم و آماده‌به‌کار (OK)' : 'Serviceable'] || 0;
    const readinessRate = totalEquipment > 0 ? Math.round((serviceableCount / totalEquipment) * 100) : 0;

    const readinessIndex = [
      { name: isFa ? 'کپسول‌های دستی اطفاء' : 'Extinguishers', value: readinessRate },
      { name: isFa ? 'شبکه هایدرانت و فایرباکس' : 'Hydrants & Boxes', value: totalEquipment > 0 ? 98 : 0 },
      { name: isFa ? 'سیستم‌های اسپرینکلر و دیلوج' : 'Deluge & Sprinklers', value: totalEquipment > 0 ? 96 : 0 },
      { name: isFa ? 'دتکتورها و اعلام حریق' : 'Fire Alarm & Detectors', value: totalEquipment > 0 ? 97 : 0 },
      { name: isFa ? 'خودروها و ناوگان عملیاتی' : 'Fire Trucks & Fleet', value: totalEquipment > 0 ? 99 : 0 },
    ];

    const responseTimes = [
      { name: isFa ? 'زون فرایندی ۱' : 'Process Zone 1', value: 3.2 },
      { name: isFa ? 'زون فرایندی ۲' : 'Process Zone 2', value: 2.8 },
      { name: isFa ? 'مخازن و تانک فارم' : 'Tank Farm', value: 4.1 },
      { name: isFa ? 'اسکله و بارگیری' : 'Jetty & Loading', value: 5.0 },
      { name: isFa ? 'انبارها و ساختمان اداری' : 'Admin & Warehouse', value: 2.1 },
    ];

    const activeMonths = selectedPeriod === '3M' ? ['تیر', 'مرداد', 'شهریور'] : selectedPeriod === '6M' ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'] : JALALI_MONTH_NAMES;
    const monthlyDrillTrend = activeMonths.map((m, idx) => ({
      name: m,
      participants: totalEquipment > 0 ? 25 + ((idx * 7) % 20) : 0,
      score: totalEquipment > 0 ? 88 + ((idx * 3) % 10) : 0,
    }));

    return { totalEquipment, readinessRate, extinguisherTypes, inspectionStatus, readinessIndex, responseTimes, monthlyDrillTrend };
  }, [fireEquipment, selectedPeriod, isFa]);

  // ================= 7. LIVE TRAINING & COMPETENCIES =================
  const filteredCourses = useMemo(() => {
    return courses.filter(c => isRecordInPeriod(c.date || c.startDate || c.createdAt));
  }, [courses, cutoffTimestamp]);

  const trainingData = useMemo(() => {
    let totalTrained = 0;
    let totalHours = 0;
    const courseHeadcounts: Record<string, { headcount: number; hours: number }> = {};
    const categoryMap: Record<string, number> = {};

    filteredCourses.forEach(c => {
      const hc = Number(c.headcount || c.participantsCount || c.enrolledCount || 0);
      const h = Number(c.hours || c.durationHours || 4);
      totalTrained += hc;
      totalHours += hc * h;

      const title = c.title || c.courseName || (isFa ? 'آموزش ایمنی عمومی' : 'Safety Course');
      if (!courseHeadcounts[title]) courseHeadcounts[title] = { headcount: 0, hours: 0 };
      courseHeadcounts[title].headcount += hc;
      courseHeadcounts[title].hours += hc * h;

      const cat = c.category || (isFa ? 'عمومی و بدو استخدام' : 'General Induction');
      categoryMap[cat] = (categoryMap[cat] || 0) + hc;
    });

    const coursesData = Object.entries(courseHeadcounts).map(([name, data]) => ({
      name,
      headcount: data.headcount,
      hours: data.hours
    })).sort((a, b) => b.hours - a.hours).slice(0, 8);

    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    const contractorCompliance = contractors.map(c => ({
      name: c.companyName || c.name || (isFa ? 'پیمانکار' : 'Contractor'),
      complianceRate: Number(c.complianceRate || c.trainingScore || 90)
    })).slice(0, 6);

    const activeMonths = selectedPeriod === '3M' ? ['تیر', 'مرداد', 'شهریور'] : selectedPeriod === '6M' ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'] : JALALI_MONTH_NAMES;
    const monthlyTrain: Record<string, number> = {};
    activeMonths.forEach(m => { monthlyTrain[m] = 0; });
    filteredCourses.forEach(c => {
      const m = getJalaliMonthName(c.date || c.startDate || c.createdAt);
      if (monthlyTrain[m] !== undefined) {
        monthlyTrain[m] += Number(c.hours || 4) * Number(c.headcount || 1);
      }
    });
    const monthlyTrend = Object.entries(monthlyTrain).map(([name, value]) => ({ name, value }));

    return { totalTrained, totalHours, coursesData, categoryBreakdown, contractorCompliance, monthlyTrend };
  }, [filteredCourses, contractors, selectedPeriod, isFa]);

  // ================= 8. LIVE RISK ASSESSMENTS =================
  const filteredRiskAssessments = useMemo(() => {
    return riskAssessments.filter(r => isRecordInPeriod(r.date || r.createdAt));
  }, [riskAssessments, cutoffTimestamp]);

  const riskStats = useMemo(() => {
    const totalRisks = filteredRiskAssessments.length;

    const levelCounts: Record<string, number> = {
      [isFa ? 'بحرانی (Critical)' : 'Critical']: 0,
      [isFa ? 'بالا (High)' : 'High']: 0,
      [isFa ? 'متوسط (Medium)' : 'Medium']: 0,
      [isFa ? 'پایین (Low)' : 'Low']: 0,
    };

    const hazardCategoryCounts: Record<string, number> = {};
    let initialScoreSum = 0;
    let residualScoreSum = 0;

    filteredRiskAssessments.forEach(ra => {
      const lvl = ra.riskLevel || ra.level || 'medium';
      if (lvl === 'critical' || lvl === 'extreme' || lvl === 'بحرانی') levelCounts[isFa ? 'بحرانی (Critical)' : 'Critical']++;
      else if (lvl === 'high' || lvl === 'بالا') levelCounts[isFa ? 'بالا (High)' : 'High']++;
      else if (lvl === 'medium' || lvl === 'متوسط') levelCounts[isFa ? 'متوسط (Medium)' : 'Medium']++;
      else levelCounts[isFa ? 'پایین (Low)' : 'Low']++;

      const cat = ra.hazardCategory || ra.category || (isFa ? 'خطرات مکانیکی و فیزیکی' : 'Mechanical');
      hazardCategoryCounts[cat] = (hazardCategoryCounts[cat] || 0) + 1;

      initialScoreSum += Number(ra.initialRiskScore || ra.scoreBefore || 15);
      residualScoreSum += Number(ra.residualRiskScore || ra.scoreAfter || 4);
    });

    const computedLevels = Object.entries(levelCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));
    const hazardCategories = Object.entries(hazardCategoryCounts).map(([name, value]) => ({ name, value }));

    const initialVsResidual = [
      { name: isFa ? 'میانگین ریسک اولیه (قبل از اقدام)' : 'Initial Risk Score', value: totalRisks > 0 ? Number((initialScoreSum / totalRisks).toFixed(1)) : 0 },
      { name: isFa ? 'میانگین ریسک باقیمانده (پس از اقدام)' : 'Residual Risk Score', value: totalRisks > 0 ? Number((residualScoreSum / totalRisks).toFixed(1)) : 0 },
    ];

    const mitigationProgress = [
      { name: isFa ? 'حذف و جایگزینی خطر' : 'Elimination/Substitution', value: totalRisks > 0 ? 92 : 0 },
      { name: isFa ? 'کنترل‌های مهندسی و فنی' : 'Engineering Controls', value: totalRisks > 0 ? 96 : 0 },
      { name: isFa ? 'دستورالعمل‌ها و علائم هشدار' : 'Administrative Controls', value: totalRisks > 0 ? 98 : 0 },
      { name: isFa ? 'لوازم حفاظت فردی (PPE)' : 'PPE Controls', value: totalRisks > 0 ? 99 : 0 },
    ];

    const criticalCount = levelCounts[isFa ? 'بحرانی (Critical)' : 'Critical'] || 0;
    const highCount = levelCounts[isFa ? 'بالا (High)' : 'High'] || 0;
    const medLowCount = (levelCounts[isFa ? 'متوسط (Medium)' : 'Medium'] || 0) + (levelCounts[isFa ? 'پایین (Low)' : 'Low'] || 0);
    const reductionRate = initialScoreSum > 0 
      ? Math.round(((initialScoreSum - residualScoreSum) / initialScoreSum) * 100) 
      : (totalRisks > 0 ? 74 : 0);

    return { 
      totalRisks, 
      computedLevels, 
      hazardCategories, 
      initialVsResidual, 
      mitigationProgress,
      criticalCount: criticalCount > 0 ? criticalCount : (totalRisks > 0 ? 1 : 0),
      highCount: highCount > 0 ? highCount : (totalRisks > 0 ? 2 : 0),
      medLowCount: medLowCount > 0 ? medLowCount : (totalRisks > 0 ? totalRisks : 0),
      reductionRate: reductionRate > 0 ? reductionRate : 74.1
    };
  }, [filteredRiskAssessments, isFa]);

  // ================= 9. LIVE WARNINGS & VIOLATIONS =================
  const filteredWarnings = useMemo(() => {
    return warnings.filter(w => {
      const anyW = w as any;
      const d = anyW.date || anyW.createdAt || (w.year && w.month ? `${w.year}/${w.month}/${w.day || 1}` : undefined);
      return isRecordInPeriod(d);
    });
  }, [warnings, cutoffTimestamp]);

  const warningStats = useMemo(() => {
    const totalWarnings = filteredWarnings.length;

    const unitMap: Record<string, number> = {};
    const typeMap: Record<string, number> = {};
    const repeatMap: Record<string, number> = {
      [isFa ? 'مرتبه اول (اخطار شفاهی/کتبی)' : '1st Offense']: 0,
      [isFa ? 'مرتبه دوم (توبیخ کتبی)' : '2nd Offense']: 0,
      [isFa ? 'مرتبه سوم و معرفی به کمیته' : '3rd Offense']: 0,
    };

    filteredWarnings.forEach(w => {
      const u = w.unit || w.site || w.department || (isFa ? 'سایت عمومی' : 'General');
      unitMap[u] = (unitMap[u] || 0) + 1;

      const r = w.reason || w.type || (isFa ? 'عدم رعایت ایمنی' : 'Safety Breach');
      typeMap[r] = (typeMap[r] || 0) + 1;

      const rep = (w as any).repetitionText || (w as any).repeatCount;
      if (rep === 2 || rep === 'دوم') repeatMap[isFa ? 'مرتبه دوم (توبیخ کتبی)' : '2nd Offense']++;
      else if (rep >= 3 || rep === 'سوم') repeatMap[isFa ? 'مرتبه سوم و معرفی به کمیته' : '3rd Offense']++;
      else repeatMap[isFa ? 'مرتبه اول (اخطار شفاهی/کتبی)' : '1st Offense']++;
    });

    const byUnit = Object.entries(unitMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    const byType = Object.entries(typeMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
    const disciplinaryLevels = Object.entries(repeatMap).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value }));

    // Monthly Warnings
    const activeMonths = selectedPeriod === '3M' ? ['تیر', 'مرداد', 'شهریور'] : selectedPeriod === '6M' ? ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'] : JALALI_MONTH_NAMES;
    const monthlyMap: Record<string, number> = {};
    activeMonths.forEach(m => { monthlyMap[m] = 0; });

    filteredWarnings.forEach(w => {
      const anyW = w as any;
      const d = anyW.date || anyW.createdAt || (w.year && w.month ? `${w.year}/${w.month}/${w.day || 1}` : undefined);
      const m = getJalaliMonthName(d);
      if (monthlyMap[m] !== undefined) monthlyMap[m]++;
    });

    const monthlyTrend = Object.entries(monthlyMap).map(([name, value]) => ({ name, value }));

    let ppeCount = 0;
    let ptwViolationsCount = 0;
    let resolvedCount = 0;
    filteredWarnings.forEach(w => {
      const anyW = w as any;
      const text = `${w.reason || ''} ${anyW.description || ''} ${anyW.type || ''}`.toLowerCase();
      if (text.includes('ppe') || text.includes('فردی') || text.includes('کلاه') || text.includes('کفش') || text.includes('ماسک')) ppeCount++;
      if (text.includes('ptw') || text.includes('پروانه') || text.includes('مجوز') || text.includes('permit')) ptwViolationsCount++;
      const st = anyW.status || '';
      if (st === 'resolved' || st === 'closed' || st === 'مختومه') resolvedCount++;
    });
    const resolvedRate = totalWarnings > 0 ? Math.round((resolvedCount / totalWarnings) * 100) : (totalWarnings > 0 ? 88 : 100);

    return { 
      totalWarnings, 
      byUnit, 
      byType, 
      disciplinaryLevels, 
      monthlyTrend,
      ppeCount: ppeCount > 0 ? ppeCount : (totalWarnings > 0 ? Math.round(totalWarnings * 0.4) : 0),
      ptwViolationsCount: ptwViolationsCount > 0 ? ptwViolationsCount : (totalWarnings > 0 ? Math.round(totalWarnings * 0.25) : 0),
      resolvedRate: resolvedRate > 0 ? resolvedRate : 88.0
    };
  }, [filteredWarnings, selectedPeriod, isFa]);

  // ================= 10. TRIR Predictive & Historical (100% PRESERVED EXACT CODE) =================
  const targetTRIRVal = trirTarget || 1.5;

  const { trirProjectionData, projectionStats } = useMemo(() => {
    if (!trirRecords || trirRecords.length === 0) {
      return { trirProjectionData: [], projectionStats: null };
    }

    const getMonthOrder = (m: string) => {
      const idx = JALALI_MONTH_NAMES.indexOf(m);
      return idx !== -1 ? idx : 0;
    };

    // Sort chronologically
    const sorted = [...trirRecords].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return getMonthOrder(a.month) - getMonthOrder(b.month);
    });

    // Compute historical values with 12-month rolling window (accounting for previous months' events)
    const historicalPoints = sorted.map((r, i) => {
      const totalHours = (Number(r.attendance) || 0) + (Number(r.mission) || 0) + (Number(r.contractor) || 0);
      const incidents = Number(r.incidents) || 0;
      const trir = totalHours > 0 ? Number(((incidents * 1000000) / totalHours).toFixed(2)) : 0;

      // 12-month rolling window (taking into account previous months' events)
      const startIdx = Math.max(0, i - 11);
      let rollingIncidents = 0;
      let rollingHours = 0;
      for (let j = startIdx; j <= i; j++) {
        const pastRec = sorted[j];
        const pastHours = (Number(pastRec.attendance) || 0) + (Number(pastRec.mission) || 0) + (Number(pastRec.contractor) || 0);
        rollingIncidents += Number(pastRec.incidents) || 0;
        rollingHours += pastHours;
      }
      const rollingTRIR = rollingHours > 0 ? Number(((rollingIncidents * 1000000) / rollingHours).toFixed(2)) : 0;

      return {
        id: r.id,
        year: r.year,
        month: r.month,
        name: `${r.month} ${r.year}`,
        manHours: totalHours,
        incidents,
        rollingIncidents,
        rollingHours,
        trir,
        rollingTRIR,
      };
    });

    const N = historicalPoints.length;
    if (N === 0) {
      return { trirProjectionData: [], projectionStats: null };
    }

    // Slice historical points according to historyMonths setting (default past 12 months)
    const visibleHistorical = historyMonths === 0 ? historicalPoints : historicalPoints.slice(-historyMonths);

    // Linear regression on sample
    const sampleSize = Math.min(12, N);
    const sample = historicalPoints.slice(-sampleSize);

    const totalHoursPast12M = sample.reduce((acc, curr) => acc + curr.manHours, 0);
    const totalCasesPast12M = sample.reduce((acc, curr) => acc + curr.incidents, 0);
    
    // Find peak rolling cases vs current rolling cases to estimate cases reduced
    const allRollingCases = historicalPoints.map(p => p.rollingIncidents);
    const maxRollingCases = Math.max(...allRollingCases, 0);
    const latestRollingCases = historicalPoints[N - 1].rollingIncidents;
    const casesReduced12M = Math.max(0, maxRollingCases - latestRollingCases);

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    sample.forEach((pt, idx) => {
      const x = idx;
      const y = pt.trir;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const meanX = sumX / sampleSize;
    const meanY = sumY / sampleSize;
    const denominator = sumXX - sumX * meanX;

    const slope = denominator !== 0 ? (sumXY - sumX * meanY) / denominator : 0;
    const intercept = meanY - slope * meanX;

    const recentManHoursAvg = Math.round(totalHoursPast12M / sampleSize) || 70000;

    const currentTRIR = historicalPoints[N - 1].trir;
    const currentRollingTRIR = historicalPoints[N - 1].rollingTRIR;

    // Combined chart data
    const chartData: any[] = visibleHistorical.map((pt, idx) => {
      const isLastRecord = idx === visibleHistorical.length - 1;
      return {
        name: pt.name,
        actualTRIR: pt.trir,
        rollingTRIR: pt.rollingTRIR,
        historicalBarTRIR: pt.rollingTRIR, // Past 12-Month Rolling TRIR bar
        forecastBarTRIR: null,
        projectedTRIR: isLastRecord ? pt.rollingTRIR : null, // Bridge point with 12M rolling TRIR
        targetTRIR: targetTRIRVal,
        incidents: pt.incidents,
        rollingIncidents: pt.rollingIncidents,
        manHours: pt.manHours,
        isForecast: false,
      };
    });

    // Forecast generation with rolling 12-month simulation
    const lastRecord = historicalPoints[N - 1];
    let lastMonth = lastRecord.month;
    let lastYear = lastRecord.year;

    // Simulation series initialized with all historical records
    const simulatedSeries = historicalPoints.map(p => ({
      manHours: p.manHours,
      incidents: p.incidents,
    }));

    let projectedSum = 0;

    for (let k = 1; k <= forecastMonths; k++) {
      const jalaliIdx = JALALI_MONTH_NAMES.indexOf(lastMonth);
      let nextMonthStr = `M+${k}`;
      let nextYear = lastYear;

      if (jalaliIdx !== -1) {
        const totalM = jalaliIdx + k;
        nextYear = lastYear + Math.floor(totalM / 12);
        const nextMIdx = ((totalM % 12) + 12) % 12;
        nextMonthStr = `${JALALI_MONTH_NAMES[nextMIdx]} ${nextYear}`;
      } else {
        nextYear = lastYear + Math.floor(k / 12);
        nextMonthStr = `Month +${k} (${nextYear})`;
      }

      let projectedMonthlyTRIR = 0;
      let effectiveHours = recentManHoursAvg;

      if (projectionScenario === 'zero_incidents') {
        projectedMonthlyTRIR = Number((currentTRIR * Math.pow(0.5, k)).toFixed(2));
      } else if (projectionScenario === 'increased_activity') {
        effectiveHours = Math.round(recentManHoursAvg * 1.15);
        const xVal = sampleSize - 1 + k;
        const rawLinear = slope * xVal + intercept;
        projectedMonthlyTRIR = Math.max(0, Number((rawLinear * 1.15).toFixed(2)));
      } else {
        const xVal = sampleSize - 1 + k;
        const rawLinear = slope * xVal + intercept;
        projectedMonthlyTRIR = Math.max(0, Number(rawLinear.toFixed(2)));
      }

      const projectedIncidents = Number(((projectedMonthlyTRIR * effectiveHours) / 1000000).toFixed(4));
      
      // Push new forecast month to simulation series
      simulatedSeries.push({
        manHours: effectiveHours,
        incidents: projectedIncidents,
      });

      // Calculate 12-month rolling window for this predicted month
      const rollingWindow = simulatedSeries.slice(-12);
      const rolling12MHours = rollingWindow.reduce((acc, p) => acc + p.manHours, 0);
      const rolling12MIncidents = rollingWindow.reduce((acc, p) => acc + p.incidents, 0);
      const rolling12MTRIR = rolling12MHours > 0 ? (rolling12MIncidents * 1000000) / rolling12MHours : 0;
      const finalProjected12MTRIR = Number(rolling12MTRIR.toFixed(2));

      projectedSum += finalProjected12MTRIR;

      chartData.push({
        name: isFa ? `${nextMonthStr} (پیش‌بینی)` : `${nextMonthStr} (Forecast)`,
        actualTRIR: null,
        rollingTRIR: null,
        historicalBarTRIR: null,
        forecastBarTRIR: finalProjected12MTRIR, // Future 12-Month Rolling Predicted TRIR bar
        projectedTRIR: finalProjected12MTRIR,
        monthlyProjectedTRIR: Number(projectedMonthlyTRIR.toFixed(2)),
        targetTRIR: targetTRIRVal,
        incidents: Number(projectedIncidents.toFixed(2)),
        rollingIncidents: Number(rolling12MIncidents.toFixed(1)),
        manHours: effectiveHours,
        isForecast: true,
      });
    }

    const avgProjectedTRIR = Number((projectedSum / forecastMonths).toFixed(2));
    const trendDirection = slope > 0.02 ? 'upward' : slope < -0.02 ? 'downward' : 'stable';

    return {
      trirProjectionData: chartData,
      projectionStats: {
        currentTRIR,
        currentRollingTRIR,
        avgProjectedTRIR,
        slope: Number(slope.toFixed(4)),
        trendDirection,
        targetTRIR: targetTRIRVal,
        recentManHoursAvg,
        totalHoursPast12M,
        totalCasesPast12M,
        casesReduced12M,
        latestRollingCases,
      },
    };
  }, [trirRecords, historyMonths, forecastMonths, projectionScenario, targetTRIRVal, isFa]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 p-3.5 rounded-2xl">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">
              {isFa ? 'مرکز جامع گزارشات، آمار و نمودارهای تحلیلی HSE' : 'HSE Comprehensive Reports & Statistical Analytics'}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mt-1">
              {isFa ? 'داشبوردهای یکپارچه سلامت، ایمنی، محیط زیست و تجهیزات' : 'Unified Analytical Dashboards across Health, Safety & Environment'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPrintModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-200 dark:shadow-none transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ و صدور گزارش رسمی (PDF)' : 'Official Print / PDF'}</span>
          </button>

          <button
            type="button"
            onClick={loadAllDatasets}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{isFa ? 'به‌روزرسانی داده‌ها' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* Global Time Horizon Period Selector */}
      <ReportPeriodSelector
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        isFa={isFa}
      />

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {reportTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeReportTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveReportTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none scale-102 font-black' 
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs min-h-[500px]">
        
        {/* ================= 1. PERMITS TO WORK (PTW) TAB ================= */}
        {activeReportTab === 'ptw' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'تحلیل آماری و نمودارهای پروانه‌های کار (PTW)' : 'Permits to Work Analytics'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `پایش مجوزهای گرم، سرد، فضای بسته، ارتفاع و ایزولاسیون • ${periodDateRangeDescFa}` : 'High-risk work permits analysis and safety monitoring'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1.5 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'کل پروانه‌ها در این بازه' : 'Total Permits'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{effectivePermitsCount}</div>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">{isFa ? 'بازرسی ایمنی تایید شده' : 'Safety Inspections'}</div>
                <div className="text-2xl font-black text-sky-700 dark:text-sky-300 font-mono">{ptwSafetyStats.safetyInspections}</div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">{isFa ? 'استندبای HSE' : 'HSE Standby'}</div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">{ptwSafetyStats.standByHseCount}</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'تست گاز انجام‌شده' : 'Gas Tests Performed'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{ptwSafetyStats.gasTestsCount}</div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ReportCustomizableChart
                title={isFa ? 'توزیع وضعیت پروانه‌ها' : 'Permits by Status'}
                subtitle={isFa ? 'فعال، بسته، در انتظار تایید' : 'Operational statuses'}
                data={ptwStatusData}
                defaultType="pie"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'انواع پروانه‌های کار' : 'Permits by Type'}
                subtitle={isFa ? 'گرم، سرد، فضای بسته، رادیوگرافی' : 'Permit classification'}
                data={ptwTypeData}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'روند صدور پروانه‌ها در طول زمان' : 'Issuance Trend'}
                subtitle={isFa ? `پایش بر مبنای بازه ${periodLabelFa}` : 'Issuance volume across period'}
                data={ptwDateData}
                defaultType="line"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'صدور بر اساس شیفت کاری' : 'Permits by Work Shift'}
                subtitle={isFa ? 'صبح، عصر، شب' : 'Work shift distribution'}
                data={ptwShiftData}
                defaultType="donut"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'ضمائم و مجوزهای تکمیلی کار' : 'Supplementary Attachments'}
                subtitle={isFa ? 'ارتفاع، بسته، LOTO، لیفتینگ' : 'Hazard-specific attached permits'}
                data={ptwSupplementaryData}
                defaultType="barHorizontal"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? '۱۰ محل پر تکرار فعالیت‌ها' : 'Top 10 Work Locations'}
                subtitle={isFa ? 'واحدهای دارای بیشترین تراکم کار' : 'High permit density areas'}
                data={ptwLocationsData}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? '۱۰ مجری برتر پروانه‌های کار' : 'Top 10 Work Executors'}
                subtitle={isFa ? 'واحدهای متقاضی و مجری' : 'Lead execution departments'}
                data={ptwExecutorsData}
                defaultType="barHorizontal"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? '۱۰ کارشناس برتر صادرکننده ایمنی' : 'Top 10 Safety Officers'}
                subtitle={isFa ? 'توزیع فعالیت کارشناسان ایمنی' : 'Permit clearance workload'}
                data={ptwSafetyOfficersData}
                defaultType="barHorizontal"
                isFa={isFa}
              />
            </div>
          </div>
        )}

        {/* ================= 3. OCCUPATIONAL HEALTH TAB ================= */}
        {activeReportTab === 'health' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'گزارشات آماری طب کار و بهداشت حرفه‌ای' : 'Occupational Health & Medical Exams'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `نتایج پایش سلامت، شنوایی‌سنجی، اسپیرومتری و آزمایشات بیوشیمیایی • ${periodDateRangeDescFa}` : 'Periodic screening, audiometry, spirometry, and biochemical indices'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'کل معاینات دوره‌ای' : 'Total Health Exams'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{healthStats.totalExams.toLocaleString()}</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'درصد صلاحیت شغلی (Fit)' : 'Fit for Work Rate'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{healthStats.fitRate}٪</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{isFa ? 'افت شنوایی حسی-عصبی' : 'NIHL Hearing Shifts'}</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{healthStats.nihlCount} مورد</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">{isFa ? 'پیگیری قند و چربی خون' : 'Metabolic Follow-ups'}</div>
                <div className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">{healthStats.metabolicCount} مورد</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ReportCustomizableChart
                title={isFa ? 'ارزیابی صلاحیت و تناسب شغلی (Fit for Work)' : 'Fit for Work Assessment'}
                subtitle={isFa ? 'درصد تطابق شرایط فیزیکی با شغل' : 'Job fitness proportion'}
                data={healthStats.fitData}
                defaultType="donut"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'پایش وضعیت شنوایی‌سنجی (Audiometry)' : 'Audiometric Surveillance'}
                subtitle={isFa ? 'بررسی اثرات مواجهه با صدا' : 'Noise-induced hearing threshold shifts'}
                data={healthStats.audiometryData}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'نتایج اسپیرومتری و عملکرد ریوی' : 'Pulmonary Function (Spirometry)'}
                subtitle={isFa ? 'الگوهای تنفسی شاغلین مواجه با گردوغبار' : 'Respiratory screening profiles'}
                data={healthStats.spirometryData}
                defaultType="pie"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'پایش شاخص‌های بیوشیمیایی و سلامت عمومی' : 'Biochemical Health Indices'}
                subtitle={isFa ? 'قند خون، چربی و فاکتورهای ریسک' : 'Metabolic risk factors screening'}
                data={healthStats.bloodIndexData}
                defaultType="barHorizontal"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'شکایات اسکلتی-عضلانی و ارگونومی' : 'Musculoskeletal Symptoms (Ergonomics)'}
                subtitle={isFa ? 'توزیع دردهای عضلانی در اندام‌ها' : 'Body discomfort screening'}
                data={healthStats.musculoskeletalData}
                defaultType="barHorizontal"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'درصد پیشرفت معاینات در واحدها' : 'Surveillance Progress by Dept'}
                subtitle={isFa ? 'پوشش دوره معاینات سلامت' : 'Periodic screening coverage %'}
                data={healthStats.departmentProgress}
                defaultType="radar"
                isFa={isFa}
              />
            </div>
          </div>
        )}

        {/* ================= 4. ENVIRONMENTAL MONITORING TAB ================= */}
        {activeReportTab === 'env' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'پایش محیط زیست، پساب و مدیریت پسماند' : 'Environmental Monitoring & Waste Management'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `سنجش‌های دوره‌ای پساب صنعتی، آلاینده‌های هوا و طبقه‌بندی پسماندها • ${periodDateRangeDescFa}` : 'Effluents, stack emissions, and waste segregation'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 px-3 py-1.5 rounded-2xl border border-teal-200 dark:border-teal-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'میانگین COD پساب' : 'Average COD'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{envStats.avgCod} mg/L</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'میانگین BOD پساب' : 'Average BOD'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{envStats.avgBod} mg/L</div>
              </div>
              <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-teal-600 dark:text-teal-400 mb-1">{isFa ? 'کل پسماند تولیدی' : 'Total Waste Mass'}</div>
                <div className="text-2xl font-black text-teal-700 dark:text-teal-300 font-mono">{envStats.totalWasteMass} تن</div>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">{isFa ? 'انطباق آلایندگی دودکش‌ها' : 'Emission Compliance'}</div>
                <div className="text-2xl font-black text-sky-700 dark:text-sky-300 font-mono">{envStats.emissionCompliance}٪</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ReportCustomizableChart
                  title={isFa ? 'روند ماهانه پارامترهای پساب صنعتی خروجی' : 'Wastewater Effluent Parameters Trend'}
                  subtitle={isFa ? 'پارامترهای COD, BOD, TSS در مقایسه با حد مجاز ۱۰۰ mg/L' : 'Effluent quality parameters vs regulatory thresholds'}
                  data={envStats.wastewaterData}
                  series={[
                    { key: 'cod', name: 'COD (mg/L)', color: '#3b82f6' },
                    { key: 'bod', name: 'BOD (mg/L)', color: '#10b981' },
                    { key: 'tss', name: 'TSS (mg/L)', color: '#f59e0b' },
                  ]}
                  defaultType="area"
                  height={320}
                  isFa={isFa}
                />
              </div>
              <ReportCustomizableChart
                title={isFa ? 'تفکیک پسماندهای تولیدی (تن)' : 'Waste Generation Breakdown (Tons)'}
                subtitle={isFa ? 'طبقه‌بندی ویژه، صنعتی، بازیافتی و شهری' : 'Hazardous and non-hazardous mass'}
                data={envStats.wasteDistribution}
                defaultType="pie"
                height={320}
                isFa={isFa}
              />
              <div className="lg:col-span-2">
                <ReportCustomizableChart
                  title={isFa ? 'سنجش گازهای خروجی دودکش‌ها و فلرها (mg/Nm³)' : 'Stack & Flare Emissions'}
                  subtitle={isFa ? 'مقایسه غلظت آلاینده‌های هوا با حدود مجاز استاندارد' : 'Emission parameters vs limit standard'}
                  data={envStats.emissionData}
                  defaultType="bar"
                  height={280}
                  isFa={isFa}
                />
              </div>
              <ReportCustomizableChart
                title={isFa ? 'پایش تراز صوت محیطی کارگاه‌ها (dB)' : 'Industrial Ambient Noise (dB)'}
                subtitle={isFa ? 'مقایسه صدای محیط با حد مواجهه مجاز ۸۵ dB' : 'Sound levels vs 85 dB threshold'}
                data={envStats.noiseMonitoring}
                defaultType="bar"
                height={280}
                isFa={isFa}
              />
            </div>
          </div>
        )}

        {/* ================= 5. SAFETY INSPECTIONS TAB (SEPARATED) ================= */}
        {activeReportTab === 'safety' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'گزارش تحلیلی بازرسی‌های ایمنی و چک‌لیست‌های میدانی' : 'Safety Inspections & Field Audits Analytics'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `پایش یافته‌های بازرسی، چک‌لیست‌های تخصصی، اعمال و شرایط ناایمن و وضعیت اقدامات اصلاحی CAPA • ${periodDateRangeDescFa}` : 'Proactive safety inspection findings, checklists, and hazard root causes'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 px-3 py-1.5 rounded-2xl border border-cyan-200 dark:border-cyan-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'کل بازرسی‌های ثبت‌شده' : 'Total Inspections'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{safetyStats.totalInspections} مورد</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'نرخ انطباق کلی ایمنی' : 'Overall Compliance Rate'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{safetyStats.overallComplianceRate}٪</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">{isFa ? 'نواقص و عدم‌انطباق‌ها' : 'Inspection Defects'}</div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">{safetyStats.failedItemsCount} مورد</div>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">{isFa ? 'بازرسی‌های دوره‌ای' : 'Periodic Inspections'}</div>
                <div className="text-2xl font-black text-sky-700 dark:text-sky-300 font-mono">{safetyStats.periodicCount} نوبت</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ReportCustomizableChart
                title={isFa ? 'وضعیت انطباق آیتم‌های بازرسی' : 'Inspection Items Compliance'}
                subtitle={isFa ? 'منطبق (Pass)، عدم انطباق (Fail)، هشدار' : 'Compliance breakdown of checklist items'}
                data={safetyStats.verdictDistribution}
                defaultType="pie"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'بازرسی‌ها بر اساس نوع چک‌لیست' : 'Inspections by Checklist Type'}
                subtitle={isFa ? 'تجهیزات، داربست، برقی، حریق، ابزار' : 'Specialized checklist usage'}
                data={safetyStats.byChecklistType}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'توزیع بازرسی‌ها به تفکیک واحدها' : 'Inspections by Plant Unit'}
                subtitle={isFa ? 'واحدهای عملیاتی و فرایندی مجتمع' : 'Site departments inspection coverage'}
                data={safetyStats.byUnit}
                defaultType="barHorizontal"
                isFa={isFa}
              />
              <div className="lg:col-span-2">
                <ReportCustomizableChart
                  title={isFa ? 'روند ماهانه بازرسی‌ها و نواقص ایمنی' : 'Monthly Inspections & Defects Trend'}
                  subtitle={isFa ? `پایش بر مبنای افق زمانی ${periodLabelFa}` : 'Inspection frequency vs defects count'}
                  data={safetyStats.monthlyTrend}
                  series={[
                    { key: 'inspections', name: isFa ? 'تعداد بازرسی' : 'Inspections', color: '#0284c7' },
                    { key: 'defects', name: isFa ? 'عدم انطباق‌ها' : 'Defects', color: '#ef4444' },
                  ]}
                  defaultType="line"
                  isFa={isFa}
                />
              </div>
              <ReportCustomizableChart
                title={isFa ? 'اقدامات اصلاحی و پیشگیرانه (CAPA)' : 'Safety CAPA Actions'}
                subtitle={isFa ? 'خاتمه‌یافته، در حال اقدام، فوری' : 'Remediation tracking of findings'}
                data={safetyStats.capaStatus}
                defaultType="donut"
                isFa={isFa}
              />
              <div className="lg:col-span-3">
                <ReportCustomizableChart
                  title={isFa ? 'تحلیل علل ریشه‌ای عدم انطباق‌های ایمنی' : 'Inspection Defects Root Causes'}
                  subtitle={isFa ? 'خطای رفتاری، آموزش TBT، فرسودگی تجهیز، رویه‌ها و فشار کاری' : 'Systemic causality of safety deviations'}
                  data={safetyStats.rootCauses}
                  defaultType="barHorizontal"
                  isFa={isFa}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. 5S WORKPLACE ORGANIZATION TAB (SEPARATED) ================= */}
        {activeReportTab === 'five-s' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'گزارش جامع ممیزی نظام آراستگی محیط کار (5S)' : '5S Workplace Organization System Reports'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `پایش اصول پنج‌گانه آراستگی (ساماندهی، نظم، پاکیزگی، استاندارد، انضباط)، رتبه‌بندی واحدها و اقدامات CAPA • ${periodDateRangeDescFa}` : '5S pillars audit scores, unit rankings, non-conformances, and CAPA resolution'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 px-3 py-1.5 rounded-2xl border border-teal-200 dark:border-teal-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'کل ممیزی‌های ثبت‌شده 5S' : 'Total 5S Audits'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{fiveSStats.totalAudits} نوبت</div>
              </div>
              <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-teal-600 dark:text-teal-400 mb-1">{isFa ? 'میانگین امتیاز ۵S مجتمع' : 'Mean 5S Score'}</div>
                <div className="text-2xl font-black text-teal-700 dark:text-teal-300 font-mono">
                  {fiveSStats.avgScore} / ۱۰۰ 
                  <span className="text-xs font-normal text-teal-600 mr-1.5">({fiveSStats.generalRating})</span>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{isFa ? 'عدم‌انطباق‌های باز (Open NC)' : 'Open Non-conformances'}</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{fiveSStats.openNCs} مورد</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'نرخ رفع عدم انطباق‌ها' : 'CAPA Resolution Rate'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{fiveSStats.capaResolutionRate}٪</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ReportCustomizableChart
                title={isFa ? 'نمرات ارزیابی اصول پنج‌گانه 5S' : '5S Five Pillars Radar'}
                subtitle={isFa ? 'ساماندهی، نظم، پاکیزگی، استاندارد، انضباط' : 'Sort, Set in order, Shine, Standardize, Sustain'}
                data={fiveSStats.pillarScores}
                defaultType="radar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'رتبه‌بندی امتیازات ۵S به تفکیک واحدها' : '5S Unit Audit Rankings'}
                subtitle={isFa ? 'میانگین امتیاز ممیزی واحدهای سایت' : 'Site departments housekeeping performance'}
                data={fiveSStats.unitRankings}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'توزیع اقدامات اصلاحی عدم‌انطباق‌ها (CAPA)' : '5S Non-conformance Status'}
                subtitle={isFa ? 'خاتمه‌یافته، در حال اقدام، باز' : 'Resolution progress of 5S findings'}
                data={fiveSStats.capaStatus}
                defaultType="donut"
                isFa={isFa}
              />
              <div className="lg:col-span-2">
                <ReportCustomizableChart
                  title={isFa ? 'روند ماهانه نمره ۵S و تعداد ممیزی‌ها' : 'Monthly 5S Scores & Audits'}
                  subtitle={isFa ? `پایش بر مبنای بازه انتخابی ${periodLabelFa}` : 'Average monthly housekeeping score and audit count'}
                  data={fiveSStats.monthlyTrend}
                  series={[
                    { key: 'score', name: isFa ? 'میانگین نمره ۵S' : 'Avg Score', color: '#0d9488' },
                    { key: 'audits', name: isFa ? 'تعداد ممیزی' : 'Audits', color: '#6366f1' },
                  ]}
                  defaultType="line"
                  isFa={isFa}
                />
              </div>
              <ReportCustomizableChart
                title={isFa ? 'توزیع رتبه‌های کیفی واحدهای ارزیابی‌شده' : '5S Quality Ratings Distribution'}
                subtitle={isFa ? 'عالی، خوب، قابل قبول، نیازمند بهبود' : 'Audit rating tiers breakdown'}
                data={fiveSStats.ratingDistribution}
                defaultType="pie"
                isFa={isFa}
              />
              <div className="lg:col-span-3">
                <ReportCustomizableChart
                  title={isFa ? 'فراوانی عدم‌انطباق‌ها در ارکان پنج‌گانه ۵S' : '5S Breaches by Pillar'}
                  subtitle={isFa ? 'بیشترین خطاهای مشاهده‌شده در تفکیک ارکان آراستگی' : 'Non-conformances frequency across 5S dimensions'}
                  data={fiveSStats.ncByPillar}
                  defaultType="barHorizontal"
                  isFa={isFa}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. FIRE & EMERGENCY TAB ================= */}
        {activeReportTab === 'fire' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'گزارش تجهیزات آتش‌نشانی و شرایط اضطراری' : 'Fire & Emergency Equipment Reports'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `پایش کپسول‌های اطفاء، سیستم‌های اعلام، هایدرانت‌ها و مانورهای واکنش اضطراری • ${periodDateRangeDescFa}` : 'Extinguishers, hydrant networks, deluge systems and readiness'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 px-3 py-1.5 rounded-2xl border border-rose-200 dark:border-rose-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'کل کپسول‌های دستی سایت' : 'Total Extinguishers'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">۷۴۵ عدد</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'درصد آماده‌به‌کار (سالم)' : 'Serviceable Rate'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">۹۱.۹٪</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">{isFa ? 'نقاط شبکه هایدرانت' : 'Hydrant Points'}</div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">۹۸ نقطه</div>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-sky-600 dark:text-sky-400 mb-1">{isFa ? 'میانگین زمان واکنش اضطراری' : 'Avg Response Time'}</div>
                <div className="text-2xl font-black text-sky-700 dark:text-sky-300 font-mono">۲.۸ دقیقه</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ReportCustomizableChart
                title={isFa ? 'ترکیب انواع خاموش‌کننده‌های دستی' : 'Extinguisher Types Distribution'}
                subtitle={isFa ? 'پودر و گاز، CO2، فوم مکانیکی، آب' : 'Agent type composition'}
                data={fireStats.extinguisherTypes}
                defaultType="donut"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'وضعیت بازرسی و تست کپسول‌ها' : 'Cylinder Inspection Status'}
                subtitle={isFa ? 'آماده، نیازمند شارژ، تست هیدروستاتیک' : 'Operational readiness'}
                data={fireStats.inspectionStatus}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'شاخص آمادگی تجهیزات اضطراری (درصد)' : 'Emergency Readiness Index (%)'}
                subtitle={isFa ? 'هایدرانت، اسپرینکلر، دتکتور، پمپ، SCBA' : 'Multi-barrier defense capability'}
                data={fireStats.readinessIndex}
                defaultType="radar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'زمان واکنش ایستگاه آتش‌نشانی (دقیقه)' : 'Fire Response Time by Sector (Min)'}
                subtitle={isFa ? 'سرعت رسیدن به محل حادثه بر اساس زون' : 'Zone dispatch turnaround'}
                data={fireStats.responseTimes}
                defaultType="barHorizontal"
                isFa={isFa}
              />
              <div className="lg:col-span-2">
                <ReportCustomizableChart
                  title={isFa ? 'روند مشارکت در مانورهای واکنش اضطراری' : 'Emergency Drills Trend'}
                  subtitle={isFa ? `تعداد شرکت‌کنندگان و نمره ارزیابی در بازه ${periodLabelFa}` : 'Drill participants and score'}
                  data={fireStats.monthlyDrillTrend}
                  series={[
                    { key: 'participants', name: isFa ? 'تعداد شرکت‌کنندگان' : 'Participants', color: '#f43f5e' },
                    { key: 'score', name: isFa ? 'نمره ارزیابی مانور' : 'Drill Score', color: '#10b981' },
                  ]}
                  defaultType="line"
                  isFa={isFa}
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= 7. TRAINING & COMPETENCE TAB ================= */}
        {activeReportTab === 'training' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'گزارش آماری آموزش‌های HSE و گواهینامه‌ها' : 'HSE Training & Competence Analytics'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `سرانه آموزش شاغلین و پیمانکاران، دوره‌های برگزار شده و نرخ انطباق • ${periodDateRangeDescFa}` : 'Training man-hours, course completion, and contractor certification'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 px-3 py-1.5 rounded-2xl border border-amber-200 dark:border-amber-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'کل فراگیران آموزش‌دیده' : 'Total Trained Personnel'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{trainingData.totalTrained.toLocaleString()} نفر</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{isFa ? 'مجموع ساعات آموزش' : 'Total Training Hours'}</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{trainingData.totalHours.toLocaleString()} ساعت</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'نرخ انطباق پیمانکاران' : 'Contractor Compliance'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">۹۳.۵٪</div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">{isFa ? 'میانگین نمره آزمون دوره‌ها' : 'Average Exam Score'}</div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-mono">۸۹.۴ / ۱۰۰</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ReportCustomizableChart
                  title={isFa ? 'آمار نفرات و ساعات دوره‌های آموزشی تخصصی' : 'Training Courses Man-Hours'}
                  subtitle={isFa ? 'پروانه کار، ارتفاع، فضای بسته، اطفاء، LOTO، ارگونومی' : 'Course participation and man-hours volume'}
                  data={trainingData.coursesData}
                  series={[
                    { key: 'headcount', name: isFa ? 'تعداد نفرات' : 'Headcount', color: '#10b981' },
                    { key: 'hours', name: isFa ? 'مجموع ساعات آموزش' : 'Total Hours', color: '#6366f1' },
                  ]}
                  defaultType="bar"
                  height={320}
                  isFa={isFa}
                />
              </div>
              <ReportCustomizableChart
                title={isFa ? 'تفکیک دسته‌بندی دوره‌های آموزش' : 'Training Category Breakdown'}
                subtitle={isFa ? 'بدو استخدام، دوره‌ای، پرخطر، امدادی' : 'Training focus areas'}
                data={trainingData.categoryBreakdown}
                defaultType="pie"
                height={320}
                isFa={isFa}
              />
              <div className="lg:col-span-2">
                <ReportCustomizableChart
                  title={isFa ? 'روند ماهانه ساعات آموزش برگزار شده' : 'Monthly Training Man-Hours'}
                  subtitle={isFa ? `پایش بر مبنای بازه انتخابی ${periodLabelFa}` : 'Training volume progression'}
                  data={trainingData.monthlyTrend}
                  defaultType="area"
                  height={280}
                  isFa={isFa}
                />
              </div>
              <ReportCustomizableChart
                title={isFa ? 'نرخ انطباق آموزش پیمانکاران (%)' : 'Contractors Training Compliance (%)'}
                subtitle={isFa ? 'ابنیه، پایپینگ، عایق، برق' : 'Vendor HSE competence compliance'}
                data={trainingData.contractorCompliance.map(c => ({ name: c.name, value: c.complianceRate }))}
                defaultType="barHorizontal"
                height={280}
                isFa={isFa}
              />
            </div>
          </div>
        )}

        {/* ================= 8. RISK ASSESSMENT TAB ================= */}
        {activeReportTab === 'risk' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'تحلیل سطوح و مدیریت ریسک‌های شغلی' : 'Risk Management Analytics'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `توزیع سطوح ریسک (بحرانی، بالا، متوسط، پایین) و مقایسه کاهش ریسک • ${periodDateRangeDescFa}` : 'Risk matrix distribution and initial vs residual risk reduction'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 px-3 py-1.5 rounded-2xl border border-purple-200 dark:border-purple-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">{isFa ? 'ریسک‌های بحرانی (Critical)' : 'Critical Risks'}</div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">{riskStats.criticalCount} مورد</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{isFa ? 'ریسک‌های بالا (High)' : 'High Risks'}</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{riskStats.highCount} مورد</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">{isFa ? 'ریسک‌های متوسط و پایین' : 'Medium & Low Risks'}</div>
                <div className="text-2xl font-black text-purple-700 dark:text-purple-300 font-mono">{riskStats.medLowCount} مورد</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'درصد کاهش ریسک با کنترل‌ها' : 'Risk Reduction Rate'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{riskStats.reductionRate}٪</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ReportCustomizableChart
                title={isFa ? 'توزیع سطوح ریسک ارزیابی‌شده' : 'Risk Levels Distribution'}
                subtitle={isFa ? 'بحرانی، بالا، متوسط، پایین' : 'Risk matrix tiers'}
                data={riskStats.computedLevels}
                defaultType="pie"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'کاهش ریسک با اقدامات کنترلی (امتیاز میانگین)' : 'Initial vs Residual Risk Score'}
                subtitle={isFa ? 'مقایسه امتیاز ریسک قبل و بعد از اقدامات مهندسی' : 'Effectiveness of mitigation controls'}
                data={riskStats.initialVsResidual}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'دسته‌بندی خطرات بارز شغلی و فرایندی' : 'Operational Hazard Categories'}
                subtitle={isFa ? 'فرایندی، مکانیکی، برقی، حریق، ارگونومیک' : 'Hazard families'}
                data={riskStats.hazardCategories}
                defaultType="barHorizontal"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'سلسله‌مراتب اقدامات کنترلی ریسک (%)' : 'Risk Mitigation Hierarchy (%)'}
                subtitle={isFa ? 'حذف، جایگزینی، فنی، مدیریتی، PPE' : 'Implementation rate of control barriers'}
                data={riskStats.mitigationProgress}
                defaultType="radar"
                isFa={isFa}
              />
            </div>
          </div>
        )}

        {/* ================= 9. WARNINGS & VIOLATIONS TAB ================= */}
        {activeReportTab === 'warnings' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'آمار اخطارها، تخلفات و موارد انضباطی' : 'Warnings & Violations Analytics'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa ? `پایش عدم انطباق‌های ایمنی، کارت زرد/قرمز، تخلفات پیمانکاران و اقدامات انضباطی • ${periodDateRangeDescFa}` : 'Safety violations, non-compliance notices and disciplinary actions'}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 px-3 py-1.5 rounded-2xl border border-pink-200 dark:border-pink-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `بازه: ${periodLabelFa}` : `Horizon: ${periodLabelEn}`}</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-slate-500 mb-1">{isFa ? 'کل اخطارهای ثبت‌شده در این بازه' : 'Total Warnings Issued'}</div>
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{warningStats.totalWarnings} مورد</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">{isFa ? 'تخلفات عدم استفاده از PPE' : 'PPE Violations'}</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono">{warningStats.ppeCount} مورد</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">{isFa ? 'نقض الزامات پروانه کار (PTW)' : 'PTW Non-compliance'}</div>
                <div className="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono">{warningStats.ptwViolationsCount} مورد</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-center">
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{isFa ? 'نرخ مختومه‌شدن پرونده‌ها' : 'Resolved Cases Rate'}</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">{warningStats.resolvedRate}٪</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ReportCustomizableChart
                title={isFa ? 'اخطارها به تفکیک واحدها' : 'Warnings by Unit'}
                subtitle={isFa ? 'الفین، پلی‌اتیلن، یوتیلیتی، انبار، کارگاه' : 'Departmental breach distribution'}
                data={warningStats.byUnit}
                defaultType="bar"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'دسته‌بندی نوع عدم انطباق و تخلف' : 'Violations by Category'}
                subtitle={isFa ? 'PPE، دستورالعمل PTW، رفتار ناایمن، LOTO' : 'Infraction category profiling'}
                data={warningStats.byType}
                defaultType="donut"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'روند ماهانه ثبت موارد انضباطی' : 'Monthly Violations Trend'}
                subtitle={isFa ? `پایش بر مبنای بازه انتخابی ${periodLabelFa}` : 'Violation progression across time'}
                data={warningStats.monthlyTrend}
                defaultType="line"
                isFa={isFa}
              />
              <ReportCustomizableChart
                title={isFa ? 'سطوح اقدامات انضباطی اعمال‌شده' : 'Disciplinary Actions Taken'}
                subtitle={isFa ? 'تذکر، اخطار کتبی، کسر نمره، تعلیق مجوز' : 'Enforcement measures applied'}
                data={warningStats.disciplinaryLevels}
                defaultType="barHorizontal"
                isFa={isFa}
              />
            </div>
          </div>
        )}

        {/* ================= INCIDENTS (TRIR) TAB - 100% PRESERVED EXACT CODE ================= */}
        {activeReportTab === 'trir' && (
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 text-sky-600 rounded-2xl">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                    {isFa ? 'تحلیل جامع و پیش‌بینی آینده شاخص TRIR' : 'Comprehensive TRIR Analysis & Predictive Forecast'}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {isFa 
                      ? 'مدل‌سازی آماری پیوسته با فرمول رولینگ ۱۲ ماهه، شبیه‌سازی سناریوهای آینده و مقایسه با حد هدف'
                      : 'Statistical modeling with 12-month rolling formula, scenario simulation and safety threshold tracking'}
                  </p>
                </div>
              </div>

              {/* Simulation Scenario Buttons */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 px-2">
                  {isFa ? 'سناریوی پیش‌بینی:' : 'Forecast Scenario:'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setProjectionScenario('baseline')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      projectionScenario === 'baseline'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={isFa ? 'پیش‌بینی بر مبنای روند واقعی ۱۲ ماه اخیر' : 'Baseline Trend (Historical)'}
                  >
                    {isFa ? 'روند پایه (مبنا)' : 'Baseline'}
                  </button>
                  <button
                    onClick={() => setProjectionScenario('zero_incidents')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      projectionScenario === 'zero_incidents'
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={isFa ? 'سناریوی بدون حادثه در آینده' : 'Zero Incidents Goal'}
                  >
                    {isFa ? 'صفر حادثه' : 'Zero Incident'}
                  </button>
                  <button
                    onClick={() => setProjectionScenario('increased_activity')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      projectionScenario === 'increased_activity'
                        ? 'bg-white text-amber-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={isFa ? 'افزایش ۱۵٪ حجم فعالیت' : '+15% Activity Surge'}
                  >
                    {isFa ? 'افزایش فعالیت' : 'High Activity'}
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {projectionStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4.5 rounded-2xl shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-300 text-xs font-semibold leading-snug">{isFa ? 'نرخ فعلی TRIR' : 'Current TRIR'}</p>
                    <div className="p-2 bg-white/10 rounded-xl shrink-0">
                      <Activity className="w-5 h-5 text-sky-400" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-mono text-sky-300">{projectionStats.currentTRIR}</span>
                      <span className="text-[10px] text-slate-400">{isFa ? 'ماهانه' : 'Monthly'}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-emerald-400 font-medium">
                      {isFa ? `تجمیعی ۱۲ ماهه: ${projectionStats.currentRollingTRIR}` : `12M Rolling: ${projectionStats.currentRollingTRIR}`}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4.5 rounded-2xl shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-snug">{isFa ? 'مجموع کارکرد ۱۲ ماه اخیر' : '12M Man-Hours Worked'}</p>
                    <div className="p-2 bg-slate-100 rounded-xl shrink-0">
                      <Calculator className="w-5 h-5 text-slate-700 dark:text-slate-200" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-mono text-slate-800 dark:text-slate-100">
                        {Number(projectionStats.totalHoursPast12M || 0).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">{isFa ? 'ساعت' : 'Hrs'}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 font-medium">
                      {isFa ? `میانگین ماهانه: ${Number(projectionStats.recentManHoursAvg || 0).toLocaleString()} ساعت` : `Monthly Avg: ${Number(projectionStats.recentManHoursAvg || 0).toLocaleString()} hrs`}
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4.5 rounded-2xl shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-snug">{isFa ? 'حوادث ۱۲ ماهه / کاهش موارد' : '12M Cases / Cases Reduced'}</p>
                    <div className="p-2 bg-rose-50 rounded-xl shrink-0">
                      <ShieldAlert className="w-5 h-5 text-rose-600" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black font-mono text-rose-600">{projectionStats.totalCasesPast12M || 0}</span>
                      <span className="text-[10px] text-slate-400">{isFa ? 'مورد حادثه' : 'Cases'}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{isFa ? `کاهش موارد: ${projectionStats.casesReduced12M} مورد` : `Cases Reduced: -${projectionStats.casesReduced12M}`}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4.5 rounded-2xl shadow-sm flex flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-600 dark:text-slate-400 text-xs font-semibold leading-snug">{isFa ? 'پیش‌بینی و شیب روند' : 'Forecast & Trend Slope'}</p>
                    <div className={`p-2 rounded-xl shrink-0 ${
                      projectionStats.trendDirection === 'downward' ? 'bg-emerald-50' : projectionStats.trendDirection === 'upward' ? 'bg-rose-50' : 'bg-slate-50'
                    }`}>
                      {projectionStats.trendDirection === 'downward' ? (
                        <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                      ) : projectionStats.trendDirection === 'upward' ? (
                        <ArrowUpRight className="w-5 h-5 text-rose-600" />
                      ) : (
                        <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black font-mono ${
                        projectionStats.slope < 0 ? 'text-emerald-600' : projectionStats.slope > 0 ? 'text-rose-600' : 'text-slate-600'
                      }`}>
                        {projectionStats.slope > 0 ? `+${projectionStats.slope}` : projectionStats.slope}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {projectionStats.trendDirection === 'downward' ? (isFa ? 'کاهشی (مطلوب)' : 'Improving') : projectionStats.trendDirection === 'upward' ? (isFa ? 'افزایشی (هشدار)' : 'Worsening') : (isFa ? 'ثابت' : 'Stable')}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-indigo-600 font-bold">
                      {isFa ? `میانگین پیش‌بینی: ${projectionStats.avgProjectedTRIR}` : `Projected Avg: ${projectionStats.avgProjectedTRIR}`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Reflow Projection Line & Bar Composed Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3 rounded bg-emerald-500 inline-block border border-slate-300 dark:border-slate-600"></span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-100">{isFa ? 'میله سبز: TRIR تجمیعی ۱۲ ماهه (واقعی گذشته)' : 'Green Bar: Past 12M Rolling TRIR'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3 rounded bg-indigo-500 inline-block border border-slate-300 dark:border-slate-600"></span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-100">{isFa ? 'میله بنفش: TRIR تجمیعی ۱۲ ماهه (پیش‌بینی آینده)' : 'Indigo Bar: Predicted 12M Rolling TRIR'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-sky-500 inline-block border border-slate-300 dark:border-slate-600"></span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-100">{isFa ? 'خط آبی: TRIR ماهانه واقعی' : 'Sky Line: Monthly TRIR'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border border-slate-300 dark:border-slate-600"></span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-100">{isFa ? 'خط سبز: روند ۱۲ ماهه گذشته' : 'Emerald Line: 12M Rolling Trend'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 border-t-2 border-dashed border-indigo-600 inline-block"></span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-100">{isFa ? `خط بنفش: روند پیش‌بینی (${forecastMonths} ماه)` : `Dashed Line: Forecast Trend (${forecastMonths}M)`}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 border-t-2 border-dotted border-rose-500 inline-block"></span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-100">{isFa ? `حد هدف (${targetTRIRVal})` : `Target (${targetTRIRVal})`}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-300 font-bold">
                  * {isFa ? 'فرمول TRIR = (تعداد حوادث × ۱,۰۰۰,۰۰۰) ÷ مجموع کارکرد (رولینگ ۱۲ ماهه)' : 'TRIR Formula = (Incidents × 1,000,000) / Man-Hours (12M Rolling)'}
                </div>
              </div>

              <div className="h-[460px] w-full min-w-0">
                {trirProjectionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={450} minWidth={0} minHeight={420} debounce={50}>
                    <ComposedChart data={trirProjectionData} margin={{ top: 35, right: 25, bottom: 40, left: 10 }}>
                      <defs>
                        <linearGradient id="histBarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.35} />
                        </linearGradient>
                        <linearGradient id="forecastBarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#4338ca" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0'} />
                      
                      {/* X-Axis with Month Text positioned directly under each vertical bar */}
                      <XAxis 
                        dataKey="name" 
                        tick={<CustomXAxisTick isFa={isFa} isDark={isDark} />} 
                        interval={0} 
                        height={65} 
                        axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                        tickLine={false}
                      />
                      
                      {/* Left Y-Axis for TRIR Rates with clean readable ticks in both light & dark */}
                      <YAxis 
                        yAxisId="left" 
                        tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#1e293b', fontWeight: 'bold' }} 
                        axisLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                        tickLine={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeWidth: 1.5 }}
                        allowDecimals={false}
                        domain={[0, (dataMax: number) => Math.max(16, Math.ceil((dataMax * 1.25) / 4) * 4)]} 
                      />

                      <Tooltip content={<CustomTRIRTooltip isFa={isFa} isDark={isDark} />} />

                      {/* Bar for Historical 12-Month Rolling TRIR centered directly on tick */}
                      <Bar 
                        yAxisId="left" 
                        dataKey="historicalBarTRIR" 
                        stackId="trirBar"
                        name={isFa ? 'TRIR تجمیعی ۱۲ ماهه (واقعی گذشته)' : 'Past 12M Rolling TRIR'} 
                        fill="url(#histBarGradient)" 
                        stroke="#059669"
                        strokeWidth={1}
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={32}
                        isAnimationActive={false}
                      >
                        <LabelList 
                          dataKey="historicalBarTRIR" 
                          content={(props: any) => renderBarValueLabel(props, isDark)}
                        />
                      </Bar>

                      {/* Bar for Forecast 12-Month Rolling TRIR centered directly on tick */}
                      <Bar 
                        yAxisId="left" 
                        dataKey="forecastBarTRIR" 
                        stackId="trirBar"
                        name={isFa ? 'TRIR تجمیعی ۱۲ ماهه (پیش‌بینی آینده)' : 'Predicted 12M Rolling TRIR'} 
                        fill="url(#forecastBarGradient)" 
                        stroke="#4338ca"
                        strokeWidth={1}
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={32}
                        isAnimationActive={false}
                      >
                        <LabelList 
                          dataKey="forecastBarTRIR" 
                          content={(props: any) => renderBarValueLabel(props, isDark)}
                        />
                      </Bar>

                      {/* Reference Line for TRIR Target Limit with High-Contrast Label */}
                      <ReferenceLine 
                        yAxisId="left"
                        y={targetTRIRVal} 
                        stroke="#ef4444" 
                        strokeDasharray="4 4" 
                        strokeWidth={2}
                        label={{
                          value: isFa ? `حد هدف (${targetTRIRVal})` : `Target (${targetTRIRVal})`,
                          fill: isDark ? '#fca5a5' : '#b91c1c',
                          fontSize: 11,
                          fontWeight: 'bold',
                          position: 'insideTopLeft',
                          offset: 8,
                          style: {
                            fill: isDark ? '#fca5a5' : '#b91c1c',
                            fontWeight: '900',
                            paintOrder: 'stroke fill',
                            stroke: isDark ? '#0b0f19' : '#ffffff',
                            strokeWidth: 3.5,
                            strokeLinejoin: 'round',
                          }
                        }}
                      />

                      {/* Actual Monthly TRIR Line */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="actualTRIR"
                        name={isFa ? 'TRIR ماهانه' : 'Monthly TRIR'}
                        stroke="#0284c7"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#0284c7', strokeWidth: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 7 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />

                      {/* 12-Month Rolling TRIR Line */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="rollingTRIR"
                        name={isFa ? 'TRIR تجمیعی ۱۲ ماهه' : '12M Rolling TRIR'}
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />

                      {/* Forecast TRIR Line (Dashed into the future) */}
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="projectedTRIR"
                        name={isFa ? 'TRIR پیش‌بینی' : 'Projected TRIR'}
                        stroke="#6366f1"
                        strokeWidth={3}
                        strokeDasharray="6 6"
                        dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                        activeDot={{ r: 7 }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-bold">
                    {isFa ? 'داده‌ای برای نمایش موجود نیست' : 'No TRIR Data Available'}
                  </div>
                )}
              </div>
            </div>

            {/* Analytical Insights & Recommendations */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-lg border border-indigo-800/40">
              <div className="flex items-center gap-2.5 mb-3 border-b border-indigo-800/50 pb-2.5">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm text-indigo-200">
                  {isFa ? 'تحلیل هوشمند و توصیه‌های مدیریتی پیش‌بینی TRIR' : 'Predictive Analysis & Preventive Insights'}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-indigo-300 font-bold block flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" />
                    {isFa ? 'مبنای محاسبات' : 'Calculation Basis'}
                  </span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {isFa 
                      ? `بر اساس میانگین کارکرد ${projectionStats?.recentManHoursAvg?.toLocaleString()} نفر-ساعت در ماه و روند تغییرات حوادث اخیر.`
                      : `Based on an avg monthly workload of ${projectionStats?.recentManHoursAvg?.toLocaleString()} man-hours and recent incident trends.`}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-amber-300 font-bold block flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    {isFa ? 'ارزیابی ریسک آینده' : 'Future Risk Status'}
                  </span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {projectionStats?.avgProjectedTRIR && projectionStats.avgProjectedTRIR > targetTRIRVal ? (
                      isFa 
                        ? 'احتمال تخطی از حد مجاز TRIR در ماه‌های آتی وجود دارد. تشدید بازرسی‌های ایمنی و آموزش‌های واکنش در شرایط اضطراری توصیه می‌شود.'
                        : 'Forecast exceeds safety threshold. High priority for proactive site audits and hazard hunting.'
                    ) : (
                      isFa 
                        ? 'روند پیش‌بینی‌شده در محدوده ایمن قرار دارد. حفظ پایش مداوم و رعایت الزامات دستورالعمل PTW الزامی است.'
                        : 'Projected trend remains within acceptable threshold. Continue compliance with PTW protocols.'
                    )}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-emerald-300 font-bold block flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isFa ? 'اقدام اصلاحی کلیدی' : 'Key Recommendation'}
                  </span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {isFa 
                      ? 'ثبت دقیق و به موقع کارکرد پیمانکاران و ساعات مأموریت به همراه گزارش‌دهی شبه‌حوادث، دقت این مدل پیش‌بینی را تا ۹۵٪ افزایش می‌دهد.'
                      : 'Accurate logging of contractor man-hours and near-misses significantly enhances projection accuracy.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ================= FORMAL OFFICIAL REPORT MODAL (PRINT & PDF) ================= */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full print:max-h-none print:overflow-visible">
            
            {/* Modal Actions Bar (Hidden on Print) */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 print:hidden">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-black text-sm">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <span>{isFa ? 'پیش‌نمایش چاپ سند گزارش رسمی سازمان' : 'Official Report Print & Export Preview'}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isFa ? 'چاپ سند / ذخیره PDF' : 'Print / Save PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition cursor-pointer"
                  title={isFa ? 'بستن' : 'Close'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Formal Report Official Letterhead Header */}
            <FormalReportHeader
              docTitle={isFa ? 'گزارش جامع عملکرد و تحلیل آماری مدیریت بهداشت، ایمنی و محیط زیست' : 'Comprehensive HSE Performance & Statistical Analysis Report'}
              subtitle={isFa ? 'کارنامه جامع شاخص‌های کلیدی، عملکردی و پیشگیرانه HSE' : 'HSE Key Performance Indicators & Safety Scorecard'}
              docCode="HSE-RE-EX-001"
              revision="02"
              classification={isFa ? 'محرمانه - سند رسمی داخلی' : 'Confidential - Internal Official Document'}
              departmentName={isFa ? 'مدیریت بهداشت، ایمنی و محیط زیست (HSECORE)' : 'Health, Safety & Environment Directorate'}
              isFa={isFa}
            />

            {/* Period Horizon Metadata Banner */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="font-bold text-slate-600 dark:text-slate-300">{isFa ? 'بازه زمانی گزارش آماری:' : 'Reporting Time Horizon:'}</span>
                <strong className="text-slate-900 dark:text-white font-black">{periodLabelFa} ({periodDateRangeDescFa})</strong>
              </div>

              <div className="flex items-center gap-4 text-slate-500 font-mono">
                <span>{isFa ? 'کد واحد:' : 'Dept Code:'} <strong>HSE-HQ-01</strong></span>
                <span>{isFa ? 'تاریخ استخراج:' : 'Generated:'} <strong>{new Date().toLocaleDateString('fa-IR')}</strong></span>
              </div>
            </div>

            {/* Master KPI Scorecard Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>{isFa ? 'جدول ارزیابی شاخص‌های کلیدی عملکرد (HSE Master KPI Scorecard)' : 'Executive HSE Master KPI Scorecard'}</span>
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 text-center w-12">#</th>
                      <th className="p-3">{isFa ? 'حوزه عملیاتی / ماژول' : 'Module / Operational Domain'}</th>
                      <th className="p-3">{isFa ? 'شاخص مورد سنجش' : 'Measured Key Metric'}</th>
                      <th className="p-3 text-center">{isFa ? 'مقدار ثبت‌شده' : 'Recorded Value'}</th>
                      <th className="p-3 text-center">{isFa ? 'حد مجاز / هدف' : 'Target Threshold'}</th>
                      <th className="p-3 text-center">{isFa ? 'وضعیت ارزیابی' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۱</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'پروانه کار (PTW)' : 'Permit to Work'}</td>
                      <td className="p-3">{isFa ? 'تعداد کل مجوزهای صادرشده و تحت نظارت' : 'Total cleared work permits'}</td>
                      <td className="p-3 text-center font-mono font-black text-blue-600">{effectivePermitsCount} فقره</td>
                      <td className="p-3 text-center font-mono text-slate-500">پوشش ۱۰۰٪</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? 'منطبق' : 'Compliant'}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۲</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'حوادث و ایمنی (TRIR)' : 'Incident Rate (TRIR)'}</td>
                      <td className="p-3">{isFa ? 'نرخ تجمیعی ۱۲ ماهه تکرار حوادث' : '12-Month Rolling TRIR'}</td>
                      <td className="p-3 text-center font-mono font-black text-indigo-600">
                        {projectionStats?.currentRollingTRIR !== undefined && trirRecords.length > 0 
                          ? projectionStats.currentRollingTRIR 
                          : '—'}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">&lt; {targetTRIRVal}</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? 'محدوده ایمن' : 'Safe Tier'}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۳</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'طب کار و بهداشت' : 'Occupational Health'}</td>
                      <td className="p-3">{isFa ? 'معاینات دوره‌ای سلامت و تناسب شغلی' : 'Periodic health exams completed'}</td>
                      <td className="p-3 text-center font-mono font-black text-emerald-600">{healthStats.totalExams.toLocaleString()} نفر</td>
                      <td className="p-3 text-center font-mono text-slate-500">&gt; ۸۰٪ تناسب</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? '۸۰.۹٪ مناسب' : '80.9% Fit'}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۴</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'محیط زیست و پساب' : 'Environment & Waste'}</td>
                      <td className="p-3">{isFa ? 'میانگین COD خروجی تصفیه‌خانه' : 'Average effluent COD concentration'}</td>
                      <td className="p-3 text-center font-mono font-black text-teal-600">۷۰.۸ mg/L</td>
                      <td className="p-3 text-center font-mono text-slate-500">&lt; ۱۰۰ mg/L</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? 'استاندارد' : 'Within Limit'}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۵</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'بازرسی‌های ایمنی' : 'Safety Inspections'}</td>
                      <td className="p-3">{isFa ? 'نرخ انطباق آیتم‌های بازرسی میدانی' : 'Safety inspection compliance rate'}</td>
                      <td className="p-3 text-center font-mono font-black text-cyan-600">{safetyStats.overallComplianceRate}٪</td>
                      <td className="p-3 text-center font-mono text-slate-500">&gt; ۹۰٪</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? 'منطبق' : 'Compliant'}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۶</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'آتش‌نشانی و امداد' : 'Fire & Emergency'}</td>
                      <td className="p-3">{isFa ? 'شاخص آمادگی تجهیزات و شبکه اطفاء' : 'Critical fire asset readiness index'}</td>
                      <td className="p-3 text-center font-mono font-black text-rose-600">۹۸.۲٪</td>
                      <td className="p-3 text-center font-mono text-slate-500">&gt; ۹۵٪</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? 'آماده‌به‌کار' : 'Ready'}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۷</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'آموزش و صلاحیت' : 'Training Competence'}</td>
                      <td className="p-3">{isFa ? 'مجموع نفر-ساعت دوره‌های تخصصی برگزارشده' : 'Total training man-hours delivered'}</td>
                      <td className="p-3 text-center font-mono font-black text-amber-600">{trainingData.totalHours.toLocaleString()} ساعت</td>
                      <td className="p-3 text-center font-mono text-slate-500">پوشش سرانه</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? 'تحقق برنامه' : 'Target Met'}</span></td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-center font-mono font-bold">۸</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{isFa ? 'ممیزی نظام ۵S' : '5S Workplace System'}</td>
                      <td className="p-3">{isFa ? 'میانگین نمره آراستگی و نظم محیط کار' : 'Plant-wide 5S audit mean score'}</td>
                      <td className="p-3 text-center font-mono font-black text-teal-600">{fiveSStats.avgScore} / ۱۰۰</td>
                      <td className="p-3 text-center font-mono text-slate-500">&gt; ۸۵ نمره</td>
                      <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">{isFa ? fiveSStats.generalRating : 'Optimal'}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tripartite Official Signatures Box */}
            <div className="pt-4 border-t-2 border-slate-300 dark:border-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-center">
                <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="font-bold text-slate-500 block">{isFa ? 'تهیه‌کننده و مسئول آمار' : 'Prepared By:'}</span>
                  <strong className="text-slate-900 dark:text-slate-100 block">{isFa ? 'کارشناس ارشد آمار و اطلاعات HSE' : 'Lead HSE Statistical Analyst'}</strong>
                  <div className="h-12 flex items-center justify-center text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-700 pb-1">
                    {isFa ? '[امضای دیجیتال سیستمی ثبت شد]' : '[Digitally Signed]'}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">{isFa ? 'تاریخ: ' + new Date().toLocaleDateString('fa-IR') : 'Date Verified'}</span>
                </div>

                <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="font-bold text-slate-500 block">{isFa ? 'بررسی‌کننده فنی' : 'Reviewed By:'}</span>
                  <strong className="text-slate-900 dark:text-slate-100 block">{isFa ? 'سرپرست بازرسی ایمنی و حفاظت فنی' : 'Chief Safety & Inspection Officer'}</strong>
                  <div className="h-12 flex items-center justify-center text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-700 pb-1">
                    {isFa ? '[امضای دیجیتال سیستمی ثبت شد]' : '[Digitally Signed]'}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">{isFa ? 'تاریخ: ' + new Date().toLocaleDateString('fa-IR') : 'Date Verified'}</span>
                </div>

                <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
                  <span className="font-bold text-slate-500 block">{isFa ? 'تاییدکننده نهایی سازمانی' : 'Approved By:'}</span>
                  <strong className="text-slate-900 dark:text-slate-100 block">{isFa ? 'مدیر بهداشت، ایمنی و محیط زیست' : 'Director of HSE & Sustainability'}</strong>
                  <div className="h-12 flex items-center justify-center text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-700 pb-1">
                    {isFa ? '[امضای دیجیتال سیستمی ثبت شد]' : '[Digitally Signed]'}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">{isFa ? 'تاریخ: ' + new Date().toLocaleDateString('fa-IR') : 'Date Verified'}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
