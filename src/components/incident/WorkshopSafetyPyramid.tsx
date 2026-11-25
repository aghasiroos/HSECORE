import React, { useEffect, useMemo, useState } from 'react';
import { SafetyIncidentRecord, UserProfile } from '../../types';
import { HseIncidentCategoryItem, DEFAULT_INCIDENT_TYPES } from '../OrganizationMgmt';
import {
  extractIncidentShamsiYear,
  getAvailableIncidentYears,
  isIncidentFromToday,
} from '../../utils/rhsF68Config';
import { toPersianDigits } from '../../utils/jalaliDate';
import {
  Layers,
  AlertTriangle,
  Flame,
  Activity,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertOctagon,
  Zap,
  Eye,
  Building2,
  Search,
  HelpCircle,
  X,
  ChevronLeft,
  ShieldCheck,
  Award,
  Sun,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface WorkshopSafetyPyramidProps {
  isFa: boolean;
  incidents: SafetyIncidentRecord[];
  currentUser?: UserProfile;
  configuredIncidentTypes?: HseIncidentCategoryItem[];
  departmentList?: string[];
  onSelectIncident?: (incident: SafetyIncidentRecord) => void;
  onNavigateToReports?: () => void;
}

export type PyramidModelMode = '3_tier' | '5_tier';

type PyramidViewScope = 'ALL' | 'TODAY' | 'COMPARE' | string;

interface TierData {
  id: string;
  shortTitleFa: string;
  shortTitleEn: string;
  nameFa: string;
  nameEn: string;
  subTitleFa: string;
  subTitleEn: string;
  surfaceClass: string;
  activeRingClass: string;
  accentTextClass: string;
  iconBgClass: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  percentage: number;
  incidentTypes: { id: string; code?: string; titleFa: string; titleEn?: string; count: number }[];
  matchedIncidents: SafetyIncidentRecord[];
  standardBenchmarkRatio: number;
}

function matchesIncidentType(inc: SafetyIncidentRecord, type: HseIncidentCategoryItem): boolean {
  if (inc.incidentTypeId === type.id) return true;
  if (type.code === 'UA' && inc.category === 'Unsafe Act') return true;
  if (type.code === 'UC' && inc.category === 'Unsafe Condition') return true;
  if (type.code === 'NM' && inc.category === 'Near Miss') return true;
  if (type.code === 'FAC' && inc.severity === 'Minor / First Aid') return true;
  if (type.code === 'MTC' && inc.severity === 'Moderate / Medical Treatment') return true;
  if (type.code === 'LTI' && inc.severity === 'Critical / Lost Time (LTI)') return true;
  if (type.code === 'FAT' && inc.severity === 'Fatality') return true;
  return false;
}

function isHighSeverityIncident(inc: SafetyIncidentRecord, types: HseIncidentCategoryItem[]): boolean {
  const typeObj = types.find((t) => t.id === inc.incidentTypeId);
  if (typeObj?.group === 'high_severity') return true;
  return (
    inc.severity === 'Critical / Lost Time (LTI)' ||
    inc.severity === 'Fatality' ||
    inc.severity === 'High / Restricted Work'
  );
}

function isRecordableIncident(inc: SafetyIncidentRecord, types: HseIncidentCategoryItem[]): boolean {
  if (isHighSeverityIncident(inc, types)) return false;
  const typeObj = types.find((t) => t.id === inc.incidentTypeId);
  if (typeObj?.group === 'recordable') return true;
  return (
    inc.category === 'Incident' ||
    inc.category === 'Toxic Gas Leak' ||
    Boolean(inc.isOshaRecordable) ||
    inc.severity === 'Moderate / Medical Treatment' ||
    inc.severity === 'Minor / First Aid'
  );
}

function isProactiveIncident(inc: SafetyIncidentRecord, types: HseIncidentCategoryItem[]): boolean {
  return !isHighSeverityIncident(inc, types) && !isRecordableIncident(inc, types);
}

export default function WorkshopSafetyPyramid({
  isFa,
  incidents,
  configuredIncidentTypes = DEFAULT_INCIDENT_TYPES,
  departmentList = [],
  onSelectIncident,
  onNavigateToReports,
}: WorkshopSafetyPyramidProps) {
  // No year is pre-selected by default: default scope shows all ledger records
  const [scope, setScope] = useState<PyramidViewScope>('ALL');
  const [modelMode, setModelMode] = useState<PyramidModelMode>('3_tier');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [showBenchmarkModal, setShowBenchmarkModal] = useState<boolean>(false);

  // Dynamic comparison year pair (populated strictly from discovered ledger years)
  const [compareYearA, setCompareYearA] = useState<string>('');
  const [compareYearB, setCompareYearB] = useState<string>('');

  const fmtNum = (val: number | string) => (isFa ? toPersianDigits(String(val)) : String(val));

  // Merge configured org departments + any departments present in actual ledger records
  const allDepartments = useMemo(() => {
    const set = new Set<string>(departmentList.map((d) => d.trim()).filter(Boolean));
    incidents.forEach((inc) => {
      const dept = (inc.department || '').trim();
      if (dept) set.add(dept);
    });
    return Array.from(set);
  }, [departmentList, incidents]);

  // Filter ledger records by selected department
  const scopedByDept = useMemo(() => {
    if (selectedDept === 'ALL') return incidents;
    return incidents.filter((i) => (i.department || '').trim() === selectedDept.trim());
  }, [incidents, selectedDept]);

  // Dynamically discover available Shamsi years strictly from actual ledger records
  const availableYears = useMemo(() => getAvailableIncidentYears(scopedByDept), [scopedByDept]);

  // Count per discovered year
  const countsByYear = useMemo(() => {
    const map: Record<string, number> = {};
    scopedByDept.forEach((inc) => {
      const y = extractIncidentShamsiYear(inc);
      if (y) map[y] = (map[y] || 0) + 1;
    });
    return map;
  }, [scopedByDept]);

  // Today's records from ledger
  const dailyIncidents = useMemo(
    () => scopedByDept.filter((inc) => isIncidentFromToday(inc)),
    [scopedByDept]
  );

  // Keep selected scope and comparison years strictly valid against discovered years
  useEffect(() => {
    if (scope !== 'ALL' && scope !== 'TODAY' && scope !== 'COMPARE') {
      if (!availableYears.includes(scope)) {
        setScope('ALL');
      }
    }
    if (scope === 'COMPARE' && availableYears.length < 2) {
      setScope('ALL');
    }

    if (availableYears.length >= 2) {
      setCompareYearA((prev) => (prev && availableYears.includes(prev) ? prev : availableYears[0]));
      setCompareYearB((prev) => {
        if (prev && availableYears.includes(prev) && prev !== availableYears[0]) return prev;
        return availableYears[1];
      });
    } else {
      setCompareYearA('');
      setCompareYearB('');
    }
  }, [availableYears, scope]);

  // Active incidents for single-view pyramid
  const activeIncidents = useMemo(() => {
    if (scope === 'ALL') return scopedByDept;
    if (scope === 'TODAY') return dailyIncidents;
    if (scope === 'COMPARE') {
      return scopedByDept.filter((inc) => extractIncidentShamsiYear(inc) === compareYearA);
    }
    return scopedByDept.filter((inc) => extractIncidentShamsiYear(inc) === scope);
  }, [scope, scopedByDept, dailyIncidents, compareYearA]);

  // Comparison datasets (only active when >= 2 years exist in ledger)
  const yearAIncidents = useMemo(
    () =>
      compareYearA
        ? scopedByDept.filter((inc) => extractIncidentShamsiYear(inc) === compareYearA)
        : [],
    [scopedByDept, compareYearA]
  );

  const yearBIncidents = useMemo(
    () =>
      compareYearB
        ? scopedByDept.filter((inc) => extractIncidentShamsiYear(inc) === compareYearB)
        : [],
    [scopedByDept, compareYearB]
  );

  // Calculation Engine: 3-Tier (OSHA / Heinrich) and 5-Tier (Conoco / Bird)
  const buildPyramidTiers = (list: SafetyIncidentRecord[], mode: PyramidModelMode): TierData[] => {
    const totalCount = list.length;
    const pct = (n: number) => (totalCount > 0 ? Math.round((n / totalCount) * 100) : 0);

    if (mode === '3_tier') {
      const apexIncidents = list.filter((inc) => isHighSeverityIncident(inc, configuredIncidentTypes));
      const recordableIncidents = list.filter((inc) =>
        isRecordableIncident(inc, configuredIncidentTypes)
      );
      const proactiveIncidents = list.filter((inc) =>
        isProactiveIncident(inc, configuredIncidentTypes)
      );

      const getSubtypes = (groupName: string) =>
        configuredIncidentTypes
          .filter((t) => t.group === groupName)
          .map((t) => ({
            id: t.id,
            code: t.code,
            titleFa: t.titleFa,
            titleEn: t.titleEn,
            count: list.filter((inc) => matchesIncidentType(inc, t)).length,
          }));

      return [
        {
          id: 'tier-apex',
          shortTitleFa: 'رأس هرم · حوادث شدید (LTI / فوت)',
          shortTitleEn: 'Apex · High Severity (LTI / Fatality)',
          nameFa: 'رأس هرم: حوادث با شدت بالا (LTI / Fatality)',
          nameEn: 'Apex: High Severity Incidents (LTI / Fatality)',
          subTitleFa: 'حوادث منتهی به فوت، روزهای کاری ازدست‌رفته یا محدودیت شغلی',
          subTitleEn: 'Fatalities, Lost Time Injuries & Restricted Work Cases',
          surfaceClass:
            'bg-rose-50/90 dark:bg-rose-950/35 border-rose-200 dark:border-rose-800/80 hover:border-rose-400 dark:hover:border-rose-600',
          activeRingClass: 'ring-2 ring-rose-500 border-rose-500',
          accentTextClass: 'text-rose-700 dark:text-rose-300',
          iconBgClass: 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300',
          icon: Flame,
          count: apexIncidents.length,
          percentage: pct(apexIncidents.length),
          incidentTypes: getSubtypes('high_severity'),
          matchedIncidents: apexIncidents,
          standardBenchmarkRatio: 1,
        },
        {
          id: 'tier-recordable',
          shortTitleFa: 'سطح میانی · حوادث قابل ثبت (OSHA)',
          shortTitleEn: 'Mid-Tier · OSHA Recordables',
          nameFa: 'سطح میانی: حوادث قابل ثبت و درمان پزشکی',
          nameEn: 'Mid-Tier: Recordables & Medical Treatments',
          subTitleFa: 'درمان پزشکی، کمک‌های اولیه، حریق، خسارت تجهیزاتی و نشت گاز',
          subTitleEn: 'Medical Treatment, First Aid, Fire, Property & Gas Releases',
          surfaceClass:
            'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80 hover:border-amber-400 dark:hover:border-amber-600',
          activeRingClass: 'ring-2 ring-amber-500 border-amber-500',
          accentTextClass: 'text-amber-700 dark:text-amber-300',
          iconBgClass: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
          icon: AlertOctagon,
          count: recordableIncidents.length,
          percentage: pct(recordableIncidents.length),
          incidentTypes: getSubtypes('recordable'),
          matchedIncidents: recordableIncidents,
          standardBenchmarkRatio: 10,
        },
        {
          id: 'tier-proactive',
          shortTitleFa: 'قاعده هرم · گزارش‌های پیشگیرانه',
          shortTitleEn: 'Foundation · Proactive Reports',
          nameFa: 'قاعده هرم: رویدادهای پیشگیرانه (شبه‌حادثه، رفتار و شرایط ناایمن)',
          nameEn: 'Foundation Base: Near Misses, Unsafe Acts & Conditions',
          subTitleFa: 'شناسایی و ثبت ناهنجاری‌ها پیش از تبدیل شدن به حادثه',
          subTitleEn: 'Proactive hazard identification before incidents materialize',
          surfaceClass:
            'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80 hover:border-emerald-400 dark:hover:border-emerald-600',
          activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500',
          accentTextClass: 'text-emerald-700 dark:text-emerald-300',
          iconBgClass: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
          icon: ShieldCheck,
          count: proactiveIncidents.length,
          percentage: pct(proactiveIncidents.length),
          incidentTypes: getSubtypes('proactive'),
          matchedIncidents: proactiveIncidents,
          standardBenchmarkRatio: 300,
        },
      ];
    }

    // 5-Tier ConocoPhillips / Bird Enhanced Pyramid (mutually exclusive & exhaustive)
    const fatalIncidents: SafetyIncidentRecord[] = [];
    const ltiIncidents: SafetyIncidentRecord[] = [];
    const mtcIncidents: SafetyIncidentRecord[] = [];
    const facIncidents: SafetyIncidentRecord[] = [];
    const proactiveIncidents: SafetyIncidentRecord[] = [];

    list.forEach((inc) => {
      if (inc.severity === 'Fatality') {
        fatalIncidents.push(inc);
      } else if (
        inc.severity === 'Critical / Lost Time (LTI)' ||
        inc.severity === 'High / Restricted Work' ||
        isHighSeverityIncident(inc, configuredIncidentTypes)
      ) {
        ltiIncidents.push(inc);
      } else if (
        inc.severity === 'Moderate / Medical Treatment' ||
        inc.category === 'Toxic Gas Leak'
      ) {
        mtcIncidents.push(inc);
      } else if (
        inc.category === 'Incident' ||
        inc.severity === 'Minor / First Aid' ||
        Boolean(inc.isOshaRecordable)
      ) {
        facIncidents.push(inc);
      } else {
        proactiveIncidents.push(inc);
      }
    });

    return [
      {
        id: 'tier-5-fatality',
        shortTitleFa: 'سطح ۱ · فوت و آسیب بحرانی',
        shortTitleEn: 'Tier 1 · Fatalities',
        nameFa: 'سطح ۱ (رأس): فوت و آسیب‌های فوق‌بحرانی',
        nameEn: 'Tier 1: Fatalities & Catastrophic Events',
        subTitleFa: 'حوادث منجر به فوت یا ازکارافتادگی کلی دائم',
        subTitleEn: 'Fatalities and permanent total disability',
        surfaceClass:
          'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 hover:border-rose-500',
        activeRingClass: 'ring-2 ring-rose-600 border-rose-600',
        accentTextClass: 'text-rose-700 dark:text-rose-300',
        iconBgClass: 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300',
        icon: Flame,
        count: fatalIncidents.length,
        percentage: pct(fatalIncidents.length),
        incidentTypes: [{ id: 'fatal', code: 'FAT', titleFa: 'فوت شغلی', count: fatalIncidents.length }],
        matchedIncidents: fatalIncidents,
        standardBenchmarkRatio: 1,
      },
      {
        id: 'tier-5-lti',
        shortTitleFa: 'سطح ۲ · زمان ازدست‌رفته (LTI / RWC)',
        shortTitleEn: 'Tier 2 · LTI / Restricted Work',
        nameFa: 'سطح ۲: زمان ازدست‌رفته و کار محدود (LTI / RWC)',
        nameEn: 'Tier 2: Lost Time Injury & Restricted Work',
        subTitleFa: 'حوادث ناتوان‌کننده منتهی به غیبت از کار یا محدودیت شغلی',
        subTitleEn: 'Days away from work and restricted job activity',
        surfaceClass:
          'bg-orange-50/90 dark:bg-orange-950/35 border-orange-200 dark:border-orange-800 hover:border-orange-400',
        activeRingClass: 'ring-2 ring-orange-500 border-orange-500',
        accentTextClass: 'text-orange-700 dark:text-orange-300',
        iconBgClass: 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300',
        icon: AlertTriangle,
        count: ltiIncidents.length,
        percentage: pct(ltiIncidents.length),
        incidentTypes: [{ id: 'lti', code: 'LTI', titleFa: 'زمان تلف‌شده', count: ltiIncidents.length }],
        matchedIncidents: ltiIncidents,
        standardBenchmarkRatio: 10,
      },
      {
        id: 'tier-5-mtc',
        shortTitleFa: 'سطح ۳ · درمان پزشکی و نشت گاز',
        shortTitleEn: 'Tier 3 · Medical Treatment',
        nameFa: 'سطح ۳: درمان پزشکی و نشت گاز (MTC)',
        nameEn: 'Tier 3: Medical Treatment & Chemical Releases',
        subTitleFa: 'حوادث نیازمند مداخله و تجویز پزشک یا نشت مواد شیمیایی',
        subTitleEn: 'Medical treatments beyond first aid & releases',
        surfaceClass:
          'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400',
        activeRingClass: 'ring-2 ring-amber-500 border-amber-500',
        accentTextClass: 'text-amber-700 dark:text-amber-300',
        iconBgClass: 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300',
        icon: AlertOctagon,
        count: mtcIncidents.length,
        percentage: pct(mtcIncidents.length),
        incidentTypes: [{ id: 'mtc', code: 'MTC', titleFa: 'درمان پزشکی', count: mtcIncidents.length }],
        matchedIncidents: mtcIncidents,
        standardBenchmarkRatio: 30,
      },
      {
        id: 'tier-5-fac',
        shortTitleFa: 'سطح ۴ · کمک‌های اولیه (FAC)',
        shortTitleEn: 'Tier 4 · First Aid Cases',
        nameFa: 'سطح ۴: کمک‌های اولیه و جراحات سطحی (FAC)',
        nameEn: 'Tier 4: First Aid Cases (FAC)',
        subTitleFa: 'پانسمان و مداوای سرپایی در بهداری بدون غیبت شغلی',
        subTitleEn: 'On-site first aid dressing, minor cuts, no days lost',
        surfaceClass:
          'bg-sky-50/90 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 hover:border-sky-400',
        activeRingClass: 'ring-2 ring-sky-500 border-sky-500',
        accentTextClass: 'text-sky-700 dark:text-sky-300',
        iconBgClass: 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300',
        icon: Zap,
        count: facIncidents.length,
        percentage: pct(facIncidents.length),
        incidentTypes: [{ id: 'fac', code: 'FAC', titleFa: 'کمک اولیه', count: facIncidents.length }],
        matchedIncidents: facIncidents,
        standardBenchmarkRatio: 300,
      },
      {
        id: 'tier-5-proactive',
        shortTitleFa: 'سطح ۵ · شبه‌حوادث و ناهنجاری‌ها',
        shortTitleEn: 'Tier 5 · Proactive Hazards',
        nameFa: 'سطح ۵ (قاعده): شبه‌حوادث و رفتار/شرایط ناایمن',
        nameEn: 'Tier 5 (Base): Near Misses, Unsafe Acts & Conditions',
        subTitleFa: 'پایگاه بنیادی پیشگیری از حوادث با مشارکت همگانی پرسنل',
        subTitleEn: 'Foundation base: Proactive employee reporting',
        surfaceClass:
          'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400',
        activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500',
        accentTextClass: 'text-emerald-700 dark:text-emerald-300',
        iconBgClass: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300',
        icon: ShieldCheck,
        count: proactiveIncidents.length,
        percentage: pct(proactiveIncidents.length),
        incidentTypes: [
          { id: 'proactive', code: 'PRO', titleFa: 'پیشگیرانه', count: proactiveIncidents.length },
        ],
        matchedIncidents: proactiveIncidents,
        standardBenchmarkRatio: 600,
      },
    ];
  };

  const activeTiers = useMemo(
    () => buildPyramidTiers(activeIncidents, modelMode),
    [activeIncidents, modelMode, configuredIncidentTypes]
  );

  const yearATiers = useMemo(
    () => buildPyramidTiers(yearAIncidents, modelMode),
    [yearAIncidents, modelMode, configuredIncidentTypes]
  );

  const yearBTiers = useMemo(
    () => buildPyramidTiers(yearBIncidents, modelMode),
    [yearBIncidents, modelMode, configuredIncidentTypes]
  );

  // Executive counts for currently selected scope
  const summary = useMemo(() => {
    const high = activeIncidents.filter((i) => isHighSeverityIncident(i, configuredIncidentTypes)).length;
    const rec = activeIncidents.filter((i) => isRecordableIncident(i, configuredIncidentTypes)).length;
    const pro = activeIncidents.filter((i) => isProactiveIncident(i, configuredIncidentTypes)).length;
    const total = activeIncidents.length;
    const proactiveRatio = total > 0 ? Math.min(100, Math.round((pro / total) * 100)) : 0;
    return { high, rec, pro, total, proactiveRatio };
  }, [activeIncidents, configuredIncidentTypes]);

  // Health assessment based on actual data
  const healthAssessment = useMemo(() => {
    if (summary.total === 0) {
      return {
        labelFa: 'در انتظار ثبت داده‌های دفتر گزارشات',
        labelEn: 'Awaiting Incident Ledger Entries',
        toneClass: 'text-slate-600 dark:text-slate-400',
      };
    }
    if (summary.high > 0 && summary.pro < 10) {
      return {
        labelFa: 'هرم معکوس · نیازمند تقویت گزارش‌دهی پیشگیرانه',
        labelEn: 'Inverted Pyramid · Proactive Deficit',
        toneClass: 'text-rose-700 dark:text-rose-400',
      };
    }
    if (summary.proactiveRatio >= 85) {
      return {
        labelFa: 'متعادل و استاندارد · فرهنگ پیشگیری قوی',
        labelEn: 'Balanced Pyramid · Strong Proactive Culture',
        toneClass: 'text-emerald-700 dark:text-emerald-400',
      };
    }
    if (summary.proactiveRatio >= 65) {
      return {
        labelFa: 'پایدار و قابل قبول',
        labelEn: 'Stable & Acceptable Balance',
        toneClass: 'text-amber-700 dark:text-amber-400',
      };
    }
    return {
      labelFa: 'عدم توازن · نیاز به توسعه ثبت شبه‌حوادث',
      labelEn: 'Imbalanced · Encourage Near-Miss Reporting',
      toneClass: 'text-orange-700 dark:text-orange-400',
    };
  }, [summary]);

  const selectedTier = useMemo(
    () => (activeTierId ? activeTiers.find((t) => t.id === activeTierId) || null : null),
    [activeTierId, activeTiers]
  );

  const filteredTableTypes = useMemo(() => {
    if (!tableSearch.trim()) return configuredIncidentTypes;
    const q = tableSearch.toLowerCase();
    return configuredIncidentTypes.filter(
      (type) =>
        type.titleFa.toLowerCase().includes(q) ||
        (type.titleEn && type.titleEn.toLowerCase().includes(q)) ||
        (type.code && type.code.toLowerCase().includes(q))
    );
  }, [configuredIncidentTypes, tableSearch]);

  // Helper for comparison delta cards
  const compareMetrics = useMemo(() => {
    const calc = (list: SafetyIncidentRecord[]) => ({
      high: list.filter((i) => isHighSeverityIncident(i, configuredIncidentTypes)).length,
      rec: list.filter((i) => isRecordableIncident(i, configuredIncidentTypes)).length,
      pro: list.filter((i) => isProactiveIncident(i, configuredIncidentTypes)).length,
      total: list.length,
    });
    return { a: calc(yearAIncidents), b: calc(yearBIncidents) };
  }, [yearAIncidents, yearBIncidents, configuredIncidentTypes]);

  const scopeLabel = useMemo(() => {
    if (scope === 'ALL') return isFa ? 'تمامی گزارش‌های ثبت‌شده' : 'All Recorded Reports';
    if (scope === 'TODAY') return isFa ? 'گزارش‌های امروز' : 'Today';
    if (scope === 'COMPARE') {
      return isFa
        ? `مقایسه سال ${fmtNum(compareYearA)} در برابر ${fmtNum(compareYearB)}`
        : `Compare ${compareYearA} vs ${compareYearB}`;
    }
    return isFa ? `سال ${fmtNum(scope)}` : `Year ${scope}`;
  }, [scope, compareYearA, compareYearB, isFa]);

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6"
    >
      {/* HEADER & PROACTIVE HEALTH STRIP */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>{isFa ? 'همگام‌سازی خودکار با دفتر ثبت گزارشات' : 'Live Sync with Incident Ledger'}</span>
            <span aria-hidden="true">·</span>
            <span className={`font-bold ${healthAssessment.toneClass}`}>
              {isFa ? healthAssessment.labelFa : healthAssessment.labelEn}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{isFa ? 'هرم تحلیلی ایمنی و حوادث' : 'Safety & Incident Pyramid'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            {isFa
              ? 'پایش ساختاری توزیع ناهنجاری‌ها، شبه‌حوادث و حوادث ثبت‌شده در دفتر گزارشات. سال‌های قابل انتخاب به‌صورت خودکار پس از ثبت گزارش در سامانه نمایش داده می‌شوند.'
              : 'Geometric incident distribution synchronized automatically from the Incident Log Ledger. Selectable years appear dynamically as reports are logged.'}
          </p>
        </div>

        {/* Proactive Safety Health Gauge — Flat Hairline Surface */}
        <div className="w-full xl:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isFa ? 'شاخص سلامت پیشگیرانه' : 'Proactive Safety Ratio'}</span>
            </span>
            <span className="font-mono tabular-nums text-base font-black text-slate-900 dark:text-white">
              {fmtNum(summary.proactiveRatio)}%
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden flex">
            {summary.total > 0 ? (
              <>
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${(summary.pro / summary.total) * 100}%` }}
                  title={isFa ? `پیشگیرانه: ${summary.pro}` : `Proactive: ${summary.pro}`}
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${(summary.rec / summary.total) * 100}%` }}
                  title={isFa ? `قابل ثبت: ${summary.rec}` : `Recordable: ${summary.rec}`}
                />
                <div
                  className="bg-rose-600 h-full transition-all duration-300"
                  style={{ width: `${(summary.high / summary.total) * 100}%` }}
                  title={isFa ? `شدت بالا: ${summary.high}` : `High Severity: ${summary.high}`}
                />
              </>
            ) : (
              <div className="w-full h-full bg-slate-200 dark:bg-slate-800" />
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
            <span>
              {isFa ? 'پیشگیرانه:' : 'Proactive:'}{' '}
              <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {fmtNum(summary.pro)}
              </strong>
            </span>
            <span>
              {isFa ? 'قابل ثبت:' : 'Recordable:'}{' '}
              <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
                {fmtNum(summary.rec)}
              </strong>
            </span>
            <span>
              {isFa ? 'شدت بالا:' : 'High:'}{' '}
              <strong className="font-mono tabular-nums text-rose-700 dark:text-rose-400">
                {fmtNum(summary.high)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* UNIFIED FILTER & DYNAMIC YEAR TOOLBAR (NO DEFAULT HARDCODED YEAR) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
        {/* Left/Right: Dynamic Year & Scope Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setScope('ALL');
              setActiveTierId(null);
            }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              scope === 'ALL'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <span>{isFa ? 'همه گزارش‌ها' : 'All Reports'}</span>
            <span className="font-mono tabular-nums text-[11px] opacity-80">
              ({fmtNum(scopedByDept.length)})
            </span>
          </button>

          {/* Dynamically Generated Year Buttons — strictly from entered ledger records */}
          {availableYears.length > 0 ? (
            availableYears.map((yr) => {
              const isActive = scope === yr;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setScope(yr);
                    setActiveTierId(null);
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 opacity-80" />
                  <span>{isFa ? 'سال' : 'Year'}</span>
                  <span className="font-mono tabular-nums font-black">{fmtNum(yr)}</span>
                  <span className="font-mono tabular-nums text-[11px] opacity-80">
                    ({fmtNum(countsByYear[yr] || 0)})
                  </span>
                </button>
              );
            })
          ) : (
            <span className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
              {isFa
                ? 'سال‌های انتخابی پس از ثبت اولین گزارش فعال می‌شوند'
                : 'Selectable years appear once reports are recorded'}
            </span>
          )}

          {dailyIncidents.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setScope('TODAY');
                setActiveTierId(null);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'TODAY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>{isFa ? 'امروز' : 'Today'}</span>
              <span className="font-mono tabular-nums text-[11px] opacity-80">
                ({fmtNum(dailyIncidents.length)})
              </span>
            </button>
          )}

          {/* Comparative mode ONLY unlocked when at least 2 distinct years exist in ledger */}
          {availableYears.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                setScope('COMPARE');
                setActiveTierId(null);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'COMPARE'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isFa ? 'مقایسه تطبیقی سال‌ها' : 'Compare Years'}</span>
            </button>
          )}
        </div>

        {/* Secondary Controls: Department + Model Switcher + Guide */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setActiveTierId(null);
              }}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">{isFa ? 'همه واحدهای سازمانی' : 'All Departments'}</option>
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                setModelMode('3_tier');
                setActiveTierId(null);
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                modelMode === '3_tier'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isFa ? '۳ سطحی (OSHA)' : '3-Tier'}
            </button>
            <button
              type="button"
              onClick={() => {
                setModelMode('5_tier');
                setActiveTierId(null);
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                modelMode === '5_tier'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isFa ? '۵ سطحی (Conoco)' : '5-Tier'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBenchmarkModal(true)}
            className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition cursor-pointer"
            title={isFa ? 'راهنمای مدل‌ها و نسبت‌های استاندارد هرم ایمنی' : 'Safety Pyramid Standards Guide'}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PYRAMID CONTENT: ALWAYS RENDERED & AUTO-INCREMENTED FROM LEDGER */}
      {scope === 'COMPARE' && availableYears.length >= 2 ? (
        /* DYNAMIC COMPARATIVE VIEW (USER-SELECTED YEAR A vs YEAR B) */
        <div className="space-y-6">
          {/* Dynamic Year Pair Picker */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {isFa ? 'انتخاب دو سال ثبت‌شده جهت مقایسه تطبیقی:' : 'Select two recorded years to compare:'}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-bold">
                  {isFa ? 'سال مبنا:' : 'Baseline:'}
                </span>
                <select
                  value={compareYearB}
                  onChange={(e) => setCompareYearB(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono tabular-nums font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {fmtNum(yr)}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-slate-400 font-bold">{isFa ? 'در برابر' : 'vs'}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-bold">
                  {isFa ? 'سال هدف:' : 'Target:'}
                </span>
                <select
                  value={compareYearA}
                  onChange={(e) => setCompareYearA(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 font-mono tabular-nums font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {fmtNum(yr)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4-Column Comparison Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                key: 'high',
                title: isFa ? 'حوادث شدید (رأس هرم)' : 'High Severity (Apex)',
                valB: compareMetrics.b.high,
                valA: compareMetrics.a.high,
                lowerIsBetter: true,
                accent: 'text-rose-700 dark:text-rose-400',
              },
              {
                key: 'rec',
                title: isFa ? 'حوادث قابل ثبت (OSHA)' : 'Recordable Incidents',
                valB: compareMetrics.b.rec,
                valA: compareMetrics.a.rec,
                lowerIsBetter: true,
                accent: 'text-amber-700 dark:text-amber-400',
              },
              {
                key: 'pro',
                title: isFa ? 'گزارش‌های پیشگیرانه (قاعده)' : 'Proactive Base Reports',
                valB: compareMetrics.b.pro,
                valA: compareMetrics.a.pro,
                lowerIsBetter: false,
                accent: 'text-emerald-700 dark:text-emerald-400',
              },
              {
                key: 'total',
                title: isFa ? 'مجموع کل گزارش‌ها' : 'Total Logged Reports',
                valB: compareMetrics.b.total,
                valA: compareMetrics.a.total,
                lowerIsBetter: false,
                accent: 'text-indigo-700 dark:text-indigo-400',
              },
            ].map((item) => {
              const diff = item.valA - item.valB;
              const isGood = item.lowerIsBetter ? diff < 0 : diff > 0;
              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {item.title}
                    </span>
                    {diff === 0 ? (
                      <span className="text-[11px] font-medium text-slate-400">
                        {isFa ? 'بدون تغییر' : 'No change'}
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
                          isGood
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {item.lowerIsBetter ? (
                          diff < 0 ? (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          )
                        ) : diff > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span className="font-mono tabular-nums">
                          {diff > 0 ? `+${fmtNum(diff)}` : fmtNum(diff)}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <span className="block text-[11px] text-slate-400">
                        {isFa ? `سال ${fmtNum(compareYearB)}` : `Year ${compareYearB}`}
                      </span>
                      <span className="text-xl font-black font-mono tabular-nums text-slate-600 dark:text-slate-300">
                        {fmtNum(item.valB)}
                      </span>
                    </div>
                    <div className="text-left">
                      <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {isFa ? `سال ${fmtNum(compareYearA)}` : `Year ${compareYearA}`}
                      </span>
                      <span className={`text-2xl font-black font-mono tabular-nums ${item.accent}`}>
                        {fmtNum(item.valA)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side-by-Side Pyramids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { year: compareYearB, tiers: yearBTiers, total: yearBIncidents.length, label: isFa ? 'سال مبنا' : 'Baseline Year' },
              { year: compareYearA, tiers: yearATiers, total: yearAIncidents.length, label: isFa ? 'سال هدف' : 'Target Year' },
            ].map((side) => (
              <div
                key={`${side.label}-${side.year}`}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {isFa ? `هرم ایمنی سال ${fmtNum(side.year)}` : `Safety Pyramid · ${side.year}`}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{side.label}</p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span>{isFa ? 'مجموع:' : 'Total:'} </span>
                    <strong className="font-mono tabular-nums text-sm font-black text-slate-900 dark:text-white">
                      {fmtNum(side.total)}
                    </strong>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  {side.tiers.map((tier, idx) => {
                    const widthPercent = 48 + idx * (52 / (side.tiers.length - 1 || 1));
                    return (
                      <div
                        key={tier.id}
                        style={{ width: `${widthPercent}%` }}
                        className={`mx-auto rounded-xl border px-3.5 py-2.5 transition-colors ${tier.surfaceClass}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className={`font-bold truncate ${tier.accentTextClass}`}>
                            {isFa ? tier.shortTitleFa : tier.shortTitleEn}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-black text-slate-900 dark:text-white shrink-0">
                            {fmtNum(tier.count)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Comparative Category Breakdown Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa
                  ? 'جدول مقایسه تفصیلی عناوین حوادث و ناهنجاری‌ها'
                  : 'Detailed Incident Category Comparison'}
              </h3>
              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={isFa ? 'جستجو در کد یا عنوان...' : 'Search categories...'}
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-4">{isFa ? 'عنوان ناهنجاری / حادثه' : 'Category'}</th>
                    <th className="py-2.5 px-4">{isFa ? 'سطح هرم' : 'Pyramid Tier'}</th>
                    <th className="py-2.5 px-4 text-center">
                      {isFa ? `سال ${fmtNum(compareYearB)}` : compareYearB}
                    </th>
                    <th className="py-2.5 px-4 text-center">
                      {isFa ? `سال ${fmtNum(compareYearA)}` : compareYearA}
                    </th>
                    <th className="py-2.5 px-4 text-center">{isFa ? 'تغییر (Δ)' : 'Delta'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTableTypes.map((type) => {
                    const cntB = yearBIncidents.filter((i) => matchesIncidentType(i, type)).length;
                    const cntA = yearAIncidents.filter((i) => matchesIncidentType(i, type)).length;
                    const diff = cntA - cntB;
                    const levelLabel =
                      type.group === 'high_severity'
                        ? isFa
                          ? 'شدت بالا (رأس)'
                          : 'High Severity'
                        : type.group === 'recordable'
                        ? isFa
                          ? 'قابل ثبت (میانی)'
                          : 'Recordable'
                        : isFa
                        ? 'پیشگیرانه (قاعده)'
                        : 'Proactive';
                    const levelColor =
                      type.group === 'high_severity'
                        ? 'text-rose-700 dark:text-rose-400'
                        : type.group === 'recordable'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-emerald-700 dark:text-emerald-400';

                    return (
                      <tr
                        key={type.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                          <span>{type.titleFa}</span>
                          {type.code && (
                            <span className="mr-2 font-mono text-[11px] text-slate-400">
                              {type.code}
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 px-4 font-bold ${levelColor}`}>{levelLabel}</td>
                        <td className="py-2.5 px-4 text-center font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300">
                          {fmtNum(cntB)}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono tabular-nums font-black text-slate-900 dark:text-white">
                          {fmtNum(cntA)}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono tabular-nums font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400">{fmtNum(0)}</span>
                          ) : (
                            <span
                              className={
                                type.group === 'proactive'
                                  ? diff > 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                  : diff < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {diff > 0 ? `+${fmtNum(diff)}` : fmtNum(diff)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* SINGLE SCOPE INTERACTIVE GEOMETRIC PYRAMID VIEW */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <div>
              <span>{isFa ? 'بازه فعال:' : 'Active Scope:'} </span>
              <strong className="text-slate-900 dark:text-white font-black">{scopeLabel}</strong>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              <span>
                {isFa ? 'مجموع رکوردها:' : 'Records:'}{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                  {fmtNum(summary.total)}
                </strong>
              </span>
            </div>
            <span>
              {isFa
                ? 'برای مشاهده فهرست گزارش‌های هر طبقه، روی آن کلیک کنید'
                : 'Click any tier to inspect matched ledger records'}
            </span>
          </div>

          {/* Geometric Stepped Pyramid Tiers */}
          <div className="max-w-4xl mx-auto space-y-3 py-2">
            {activeTiers.map((tier, idx) => {
              const isSelected = activeTierId === tier.id;
              const widthPercent = 46 + idx * (54 / (activeTiers.length - 1 || 1));
              const IconComponent = tier.icon;
              const activeSubtypes = tier.incidentTypes.filter((s) => s.count > 0);
              const displaySubtypes =
                activeSubtypes.length > 0 ? activeSubtypes : tier.incidentTypes.slice(0, 4);

              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setActiveTierId(isSelected ? null : tier.id)}
                  style={{ width: `${widthPercent}%` }}
                  className={`block mx-auto text-right rounded-2xl border p-4 sm:p-5 transition-all duration-200 cursor-pointer ${
                    tier.surfaceClass
                  } ${isSelected ? tier.activeRingClass : ''}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${tier.iconBgClass}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-xs sm:text-sm font-black truncate ${tier.accentTextClass}`}>
                          {isFa ? tier.nameFa : tier.nameEn}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {isFa ? tier.subTitleFa : tier.subTitleEn}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 mr-auto">
                      <div className="text-left">
                        <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                          {fmtNum(tier.count)}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 justify-end">
                          <span className="font-mono tabular-nums font-bold">
                            {fmtNum(tier.percentage)}%
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{isFa ? 'نسبت معیار' : 'Ref'}</span>
                          <span className="font-mono tabular-nums font-bold">
                            {fmtNum(1)}:{fmtNum(tier.standardBenchmarkRatio)}
                          </span>
                        </div>
                      </div>
                      <div className="text-slate-400">
                        {isSelected ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {displaySubtypes.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/60 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                      {displaySubtypes.map((sub, sIdx) => (
                        <span key={sub.id} className="inline-flex items-center gap-1">
                          {sIdx > 0 && (
                            <span className="text-slate-300 dark:text-slate-600 ml-2" aria-hidden="true">
                              ·
                            </span>
                          )}
                          <span>{sub.titleFa}:</span>
                          <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                            {fmtNum(sub.count)}
                          </strong>
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* TIER DRILL-DOWN RECORDS TABLE */}
          {selectedTier && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg shrink-0 ${selectedTier.iconBgClass}`}>
                    <selectedTier.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {isFa ? selectedTier.nameFa : selectedTier.nameEn}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono tabular-nums font-bold">
                        {fmtNum(selectedTier.count)}
                      </span>{' '}
                      <span>{isFa ? 'پرونده در این سطح هرم' : 'records in this tier'}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTierId(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-4">{isFa ? 'شماره گزارش' : 'Report ID'}</th>
                      <th className="py-2.5 px-4">{isFa ? 'عنوان و گزارش‌دهنده' : 'Title & Reporter'}</th>
                      <th className="py-2.5 px-4">{isFa ? 'واحد / محل' : 'Unit / Location'}</th>
                      <th className="py-2.5 px-4">{isFa ? 'تاریخ وقوع' : 'Event Date'}</th>
                      <th className="py-2.5 px-4">{isFa ? 'شدت / وضعیت' : 'Severity / Status'}</th>
                      <th className="py-2.5 px-4 text-center">{isFa ? 'عملیات' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedTier.matchedIncidents.length > 0 ? (
                      selectedTier.matchedIncidents.map((inc) => (
                        <tr
                          key={inc.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                            {inc.reportNumber}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100 max-w-sm truncate">
                              {inc.title || '—'}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {inc.reporterName || '—'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            <div className="font-medium">{inc.department || '—'}</div>
                            {inc.locationSite && (
                              <div className="text-[11px] text-slate-400">{inc.locationSite}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {inc.eventDate ? fmtNum(inc.eventDate) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-700 dark:text-slate-200">
                              {inc.categoryFa || inc.severity}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {inc.status}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {onSelectIncident && (
                              <button
                                type="button"
                                onClick={() => onSelectIncident(inc)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-900 hover:text-white dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isFa ? 'مشاهده پرونده' : 'View'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-xs text-slate-500 dark:text-slate-400"
                        >
                          {isFa
                            ? 'در این بازه، رکوردی در این سطح هرم ثبت نشده است.'
                            : 'No records logged in this tier for the selected scope.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BENCHMARK RATIO COMPARISON STRIP */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-1.5">
              <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {isFa ? 'نسبت واقعی سازمان (بازه انتخابی)' : 'Actual Organization Ratio'}
              </div>
              <div className="font-mono tabular-nums text-xl font-black text-slate-900 dark:text-white">
                {fmtNum(summary.high > 0 ? 1 : 0)} :{' '}
                {fmtNum(summary.high > 0 ? Math.round(summary.rec / summary.high) : summary.rec)} :{' '}
                {fmtNum(summary.high > 0 ? Math.round(summary.pro / summary.high) : summary.pro)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFa ? 'شدید : قابل ثبت : پیشگیرانه' : 'High Severity : Recordable : Proactive'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-1.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'مدل استاندارد هاینریش (Heinrich)' : 'Heinrich Model (1931)'}
              </div>
              <div className="font-mono tabular-nums text-xl font-black text-slate-900 dark:text-white">
                {fmtNum(1)} : {fmtNum(29)} : {fmtNum(300)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFa ? '۱ حادثه شدید : ۲۹ جزئی : ۳۰۰ شبه‌حادثه' : '1 Major : 29 Minor : 300 Near Misses'}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-1.5">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isFa ? 'مدل جامع فرانک برد (Frank Bird)' : 'Frank Bird Model (1969)'}
              </div>
              <div className="font-mono tabular-nums text-xl font-black text-slate-900 dark:text-white">
                {fmtNum(1)} : {fmtNum(10)} : {fmtNum(30)} : {fmtNum(600)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isFa
                  ? '۱ فوت/LTI : ۱۰ جزئی : ۳۰ خسارت : ۶۰۰ ناهنجاری'
                  : '1 Major : 10 Minor : 30 Property : 600 Near Misses'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER LINK */}
      {onNavigateToReports && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {isFa
              ? 'کلیه داده‌های هرم ایمنی به‌طور مستقیم و خودکار از دفتر ثبت گزارشات محاسبه و به‌روزرسانی می‌شوند.'
              : 'All pyramid metrics synchronize automatically in real time with the Incident Log Ledger.'}
          </span>
          <button
            type="button"
            onClick={onNavigateToReports}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{isFa ? 'مشاهده دفتر ثبت گزارشات' : 'Open Incident Ledger'}</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* BENCHMARK STANDARDS MODAL */}
      {showBenchmarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isFa ? 'راهنمای علمی استانداردهای هرم ایمنی' : 'Safety Pyramid Standards Guide'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isFa ? 'نظریه هاینریش، فرانک برد و OSHA' : 'Heinrich, Frank Bird & OSHA Principles'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBenchmarkModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <div className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="font-black text-slate-900 dark:text-white">
                  {isFa ? '۱. نظریه هاینریش (H.W. Heinrich - 1931)' : '1. Heinrich Theory'}
                </h4>
                <p>
                  {isFa
                    ? 'به ازای هر ۱ حادثه شدید و ناتوان‌کننده در رأس هرم، به‌طور میانگین ۲۹ حادثه جزئی و ۳۰۰ رویداد بدون آسیب (شبه‌حادثه و عمل ناایمن) رخ می‌دهد. کنترل و حذف پایه ۳۰۰ تایی مانع از شکل‌گیری حوادث شدید می‌شود.'
                    : 'For every 1 major injury at the apex, approximately 29 minor injuries and 300 no-injury near misses occur at the base.'}
                </p>
              </div>

              <div className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="font-black text-slate-900 dark:text-white">
                  {isFa ? '۲. مدل جامع فرانک برد (Frank E. Bird - 1969)' : '2. Frank Bird Model'}
                </h4>
                <p>
                  {isFa
                    ? 'بر مبنای تحلیل ۱.۷ میلیون حادثه صنعتی، نسبت ۱ : ۱۰ : ۳۰ : ۶۰۰ (فوت/LTI در برابر آسیب جزئی، خسارت تجهیزاتی و ناهنجاری‌های پیشگیرانه) به عنوان استاندارد مرجع مدیریت HSE پذیرفته شده است.'
                    : 'Derived from 1.7 million industrial cases, establishing the 1 : 10 : 30 : 600 proportion across severe, minor, property damage, and proactive events.'}
                </p>
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-slate-900 dark:text-white">
                  {isFa ? '۳. تفسیر شاخص سلامت پیشگیرانه' : '3. Interpreting Proactive Ratio'}
                </h4>
                <p>
                  {isFa
                    ? 'سهم بالای ۸۰٪ گزارش‌های پیشگیرانه نشان‌دهنده فرهنگ ایمنی بالغ و شفافیت در شناسایی خطرات است. بروز حوادث شدید در کنار ثبت اندک ناهنجاری‌ها نشانه «هرم معکوس» و ریسک عدم گزارش‌دهی است.'
                    : 'A proactive ratio above 80% reflects a mature reporting culture. High apex counts with minimal base reports signal an inverted pyramid and under-reporting risk.'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowBenchmarkModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                {isFa ? 'بستن راهنما' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
