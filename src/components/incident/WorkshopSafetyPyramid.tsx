import React, { useState, useMemo } from 'react';
import { SafetyIncidentRecord, UserProfile } from '../../types';
import { HseIncidentCategoryItem, DEFAULT_INCIDENT_TYPES } from '../OrganizationMgmt';
import { normalizeDigits as normalizeDigitsCentral } from '../../utils/textNormalization';
import {
  Layers,
  AlertTriangle,
  Flame,
  Activity,
  Calendar,
  CalendarDays,
  Sun,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertOctagon,
  Zap,
  Eye,
  CheckSquare,
  Info,
  Filter,
  Building2,
  Search,
  Sparkles,
  HelpCircle,
  X,
  ChevronLeft,
  ShieldCheck,
  Award
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

export type PyramidPeriod = 'compare' | 'current_year' | 'last_year' | 'daily' | 'all';
export type PyramidModelMode = '3_tier' | '5_tier';

interface TierData {
  id: string;
  nameFa: string;
  nameEn: string;
  subTitleFa: string;
  subTitleEn: string;
  colorClass: string;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  textColor: string;
  badgeBg: string;
  icon: any;
  count: number;
  percentage: number;
  incidentTypes: { id: string; code?: string; titleFa: string; titleEn?: string; count: number }[];
  matchedIncidents: SafetyIncidentRecord[];
  standardBenchmarkRatio?: number; // Expected count relative to apex (e.g. 1, 10, 30, 600)
}

export default function WorkshopSafetyPyramid({
  isFa,
  incidents,
  currentUser,
  configuredIncidentTypes = DEFAULT_INCIDENT_TYPES,
  departmentList = [],
  onSelectIncident,
  onNavigateToReports
}: WorkshopSafetyPyramidProps) {
  // Period & Model settings
  const [period, setPeriod] = useState<PyramidPeriod>('compare');
  const [modelMode, setModelMode] = useState<PyramidModelMode>('3_tier');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [showBenchmarkModal, setShowBenchmarkModal] = useState<boolean>(false);

  // Helper to normalize digits via central utility
  const normalizeDigits = (str: string) => normalizeDigitsCentral(str, true).trim();

  const todayDateFaStr = useMemo(() => {
    try {
      const raw = new Date().toLocaleDateString('fa-IR');
      return normalizeDigits(raw);
    } catch {
      return '1405/05/04';
    }
  }, []);

  const todayIsoDateStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Filter incidents by Department if specified
  const scopedIncidents = useMemo(() => {
    if (selectedDept === 'ALL') return incidents;
    return incidents.filter(i => (i.department || '').trim() === selectedDept.trim());
  }, [incidents, selectedDept]);

  // Temporal subsets
  const lastYearIncidents = useMemo(() => {
    return scopedIncidents.filter(inc => {
      const d = normalizeDigits(inc.eventDate || inc.createdDate || '');
      return d.includes('1404') || d.includes('2025');
    });
  }, [scopedIncidents]);

  const currentYearIncidents = useMemo(() => {
    return scopedIncidents.filter(inc => {
      const d = normalizeDigits(inc.eventDate || inc.createdDate || '');
      return d.includes('1405') || d.includes('2026') || d === todayDateFaStr || d === todayIsoDateStr;
    });
  }, [scopedIncidents, todayDateFaStr, todayIsoDateStr]);

  const dailyIncidents = useMemo(() => {
    return scopedIncidents.filter(inc => {
      const d = normalizeDigits(inc.eventDate || inc.createdDate || '');
      const isTodayFa = d === todayDateFaStr || d === '1405/05/04' || d === '1405/5/4';
      const isTodayIso = d === todayIsoDateStr || d.includes('2026-07-26');
      const isKeywordToday = d.includes('امروز');
      return isTodayFa || isTodayIso || isKeywordToday;
    });
  }, [scopedIncidents, todayDateFaStr, todayIsoDateStr]);

  // Primary active incident list based on selected period
  const activeIncidents = useMemo(() => {
    if (period === 'last_year') return lastYearIncidents;
    if (period === 'current_year') return currentYearIncidents;
    if (period === 'daily') return dailyIncidents;
    if (period === 'all') return scopedIncidents;
    return currentYearIncidents; // Default fallback for stats
  }, [period, lastYearIncidents, currentYearIncidents, dailyIncidents, scopedIncidents]);

  // Calculation Engine: 3-Tier and 5-Tier Pyramids
  const buildPyramidTiers = (list: SafetyIncidentRecord[], mode: PyramidModelMode): TierData[] => {
    const totalCount = list.length || 1; // avoid division by zero

    if (mode === '3_tier') {
      // Standard OSHA / Heinrich 3-Tier
      const apexIncidents = list.filter(inc => {
        const typeObj = configuredIncidentTypes.find(t => t.id === inc.incidentTypeId);
        if (typeObj?.group === 'high_severity') return true;
        return (
          inc.severity === 'Critical / Lost Time (LTI)' ||
          inc.severity === 'Fatality' ||
          inc.severity === 'High / Restricted Work'
        );
      });

      const recordableIncidents = list.filter(inc => {
        if (apexIncidents.includes(inc)) return false;
        const typeObj = configuredIncidentTypes.find(t => t.id === inc.incidentTypeId);
        if (typeObj?.group === 'recordable') return true;
        return (
          inc.category === 'Incident' ||
          inc.category === 'Toxic Gas Leak' ||
          inc.isOshaRecordable ||
          inc.severity === 'Moderate / Medical Treatment' ||
          inc.severity === 'Minor / First Aid'
        );
      });

      const proactiveIncidents = list.filter(inc => {
        if (apexIncidents.includes(inc) || recordableIncidents.includes(inc)) return false;
        return inc.category === 'Unsafe Act' || inc.category === 'Unsafe Condition' || inc.category === 'Near Miss';
      });

      // Type sub-counts
      const getSubtypes = (groupName: string) => {
        return configuredIncidentTypes
          .filter(t => t.group === groupName)
          .map(t => {
            const count = list.filter(inc => {
              if (inc.incidentTypeId === t.id) return true;
              if (t.code === 'UA' && inc.category === 'Unsafe Act') return true;
              if (t.code === 'UC' && inc.category === 'Unsafe Condition') return true;
              if (t.code === 'NM' && inc.category === 'Near Miss') return true;
              if (t.code === 'FAC' && inc.severity === 'Minor / First Aid') return true;
              if (t.code === 'MTC' && inc.severity === 'Moderate / Medical Treatment') return true;
              if (t.code === 'LTI' && inc.severity === 'Critical / Lost Time (LTI)') return true;
              if (t.code === 'FAT' && inc.severity === 'Fatality') return true;
              return false;
            }).length;
            return { id: t.id, code: t.code, titleFa: t.titleFa, titleEn: t.titleEn, count };
          });
      };

      return [
        {
          id: 'tier-apex',
          nameFa: 'رأس هرم: حوادث با شدت بالا (LTI / Fatality)',
          nameEn: 'Apex: High Severity Incidents (LTI/FAT)',
          subTitleFa: 'حوادث منتهی به فوت، از دست رفتن زمان کاری یا محدودیت شغلی',
          subTitleEn: 'Fatalities, Lost Time Injuries & Restricted Work Cases',
          colorClass: 'text-rose-400',
          bgGradient: 'from-rose-950/90 via-red-900/80 to-rose-950/90',
          borderColor: 'border-rose-500/80',
          glowColor: 'shadow-rose-600/30',
          textColor: 'text-rose-200',
          badgeBg: 'bg-rose-900/80 text-rose-200 border-rose-500/50',
          icon: Flame,
          count: apexIncidents.length,
          percentage: Math.round((apexIncidents.length / totalCount) * 100),
          incidentTypes: getSubtypes('high_severity'),
          matchedIncidents: apexIncidents,
          standardBenchmarkRatio: 1
        },
        {
          id: 'tier-recordable',
          nameFa: 'سطح میانی: حوادث قابل ثبت و درمان پزشکی (OSHA Recordables)',
          nameEn: 'Mid-Tier: Recordables & Medical Treatments',
          subTitleFa: 'درمان پزشکی، کمک‌های اولیه، حریق، خسارت تجهیزاتی و نشت گاز',
          subTitleEn: 'Medical Treatment, First Aid, Fire, Property & Gas Releases',
          colorClass: 'text-amber-400',
          bgGradient: 'from-amber-950/90 via-amber-900/75 to-amber-950/90',
          borderColor: 'border-blue-400/80',
          glowColor: 'shadow-amber-600/30',
          textColor: 'text-amber-200',
          badgeBg: 'bg-amber-900/80 text-amber-200 border-blue-400/50',
          icon: AlertOctagon,
          count: recordableIncidents.length,
          percentage: Math.round((recordableIncidents.length / totalCount) * 100),
          incidentTypes: getSubtypes('recordable'),
          matchedIncidents: recordableIncidents,
          standardBenchmarkRatio: 10
        },
        {
          id: 'tier-proactive',
          nameFa: 'قاعده هرم: رویدادهای پیشگیرانه (Near Miss & Unsafe Conditions/Acts)',
          nameEn: 'Foundation Base: Proactive Safety & Hazards',
          subTitleFa: 'شناسایی و ثبت اعمال ناایمن، شرایط ناایمن و شبه‌حوادث قبل از بروز حادثه',
          subTitleEn: 'Unsafe Acts, Unsafe Conditions & Near Miss Hazard Identification',
          colorClass: 'text-emerald-400',
          bgGradient: 'from-emerald-950/90 via-teal-900/80 to-emerald-950/90',
          borderColor: 'border-emerald-400/80',
          glowColor: 'shadow-emerald-600/30',
          textColor: 'text-emerald-200',
          badgeBg: 'bg-emerald-900/80 text-emerald-200 border-emerald-400/50',
          icon: ShieldCheck,
          count: proactiveIncidents.length,
          percentage: Math.round((proactiveIncidents.length / totalCount) * 100),
          incidentTypes: getSubtypes('proactive'),
          matchedIncidents: proactiveIncidents,
          standardBenchmarkRatio: 300
        }
      ];
    } else {
      // 5-Tier ConocoPhillips / Bird Enhanced Pyramid
      const fatalIncidents = list.filter(inc => inc.severity === 'Fatality');
      const ltiIncidents = list.filter(inc => 
        inc.severity === 'Critical / Lost Time (LTI)' || inc.severity === 'High / Restricted Work'
      );
      const mtcIncidents = list.filter(inc => 
        inc.severity === 'Moderate / Medical Treatment' || inc.category === 'Toxic Gas Leak'
      );
      const facIncidents = list.filter(inc => 
        inc.severity === 'Minor / First Aid' && inc.category === 'Incident'
      );
      const proactiveIncidents = list.filter(inc => 
        inc.category === 'Unsafe Act' || inc.category === 'Unsafe Condition' || inc.category === 'Near Miss'
      );

      return [
        {
          id: 'tier-5-fatality',
          nameFa: 'سطح ۱ (رأس): فوت و آسیب‌های فوق بحرانی (Fatality)',
          nameEn: 'Tier 1: Fatalities & Severe Catastrophic Events',
          subTitleFa: 'حوادث منجر به فوت یا ازکارافتادگی کلی دائم',
          subTitleEn: 'Fatal accidents and permanent total disability',
          colorClass: 'text-rose-500',
          bgGradient: 'from-red-950 via-rose-900 to-red-950',
          borderColor: 'border-red-600',
          glowColor: 'shadow-red-600/50',
          textColor: 'text-red-100',
          badgeBg: 'bg-red-900 text-red-100 border-red-500',
          icon: Flame,
          count: fatalIncidents.length,
          percentage: Math.round((fatalIncidents.length / totalCount) * 100),
          incidentTypes: [{ id: 'fatal', code: 'FAT', titleFa: 'فوت شغلی', count: fatalIncidents.length }],
          matchedIncidents: fatalIncidents,
          standardBenchmarkRatio: 1
        },
        {
          id: 'tier-5-lti',
          nameFa: 'سطح ۲: زمان از دست رفته و کار محدود (LTI / RWC)',
          nameEn: 'Tier 2: Lost Time Injury & Restricted Work',
          subTitleFa: 'حوادث ناتوان‌کننده منتهی به غیبت از کار و تغییر وظایف',
          subTitleEn: 'Days away from work and restricted job activity',
          colorClass: 'text-blue-400',
          bgGradient: 'from-blue-950 via-blue-900 to-blue-950',
          borderColor: 'border-blue-500',
          glowColor: 'shadow-blue-600/40',
          textColor: 'text-blue-100',
          badgeBg: 'bg-blue-900 text-blue-200 border-blue-400',
          icon: AlertTriangle,
          count: ltiIncidents.length,
          percentage: Math.round((ltiIncidents.length / totalCount) * 100),
          incidentTypes: [{ id: 'lti', code: 'LTI', titleFa: 'زمان تلف‌شده (LTI)', count: ltiIncidents.length }],
          matchedIncidents: ltiIncidents,
          standardBenchmarkRatio: 10
        },
        {
          id: 'tier-5-mtc',
          nameFa: 'سطح ۳: درمان پزشکی و نشت گاز (MTC & Chemical)',
          nameEn: 'Tier 3: Medical Treatment & Gas Leaks',
          subTitleFa: 'حوادث نیازمند مداخله و تجویز پزشک متخصص کارگاه',
          subTitleEn: 'Medical treatments beyond first aid & environmental releases',
          colorClass: 'text-amber-400',
          bgGradient: 'from-amber-950 via-amber-900 to-amber-950',
          borderColor: 'border-blue-400',
          glowColor: 'shadow-amber-600/30',
          textColor: 'text-amber-100',
          badgeBg: 'bg-amber-900 text-amber-200 border-blue-400',
          icon: AlertOctagon,
          count: mtcIncidents.length,
          percentage: Math.round((mtcIncidents.length / totalCount) * 100),
          incidentTypes: [{ id: 'mtc', code: 'MTC', titleFa: 'درمان پزشکی', count: mtcIncidents.length }],
          matchedIncidents: mtcIncidents,
          standardBenchmarkRatio: 30
        },
        {
          id: 'tier-5-fac',
          nameFa: 'سطح ۴: کمک‌های اولیه و جراحات سطحی (First Aid Cases)',
          nameEn: 'Tier 4: First Aid Cases (FAC)',
          subTitleFa: 'پانسمان، شستشو و مداوای سرپایی در بهداری بدون غیبت شغلی',
          subTitleEn: 'On-site first aid dressing, minor cuts, no days lost',
          colorClass: 'text-sky-400',
          bgGradient: 'from-sky-950 via-cyan-900 to-sky-950',
          borderColor: 'border-sky-400',
          glowColor: 'shadow-sky-600/30',
          textColor: 'text-sky-100',
          badgeBg: 'bg-sky-900 text-sky-200 border-sky-400',
          icon: Zap,
          count: facIncidents.length,
          percentage: Math.round((facIncidents.length / totalCount) * 100),
          incidentTypes: [{ id: 'fac', code: 'FAC', titleFa: 'کمک اولیه', count: facIncidents.length }],
          matchedIncidents: facIncidents,
          standardBenchmarkRatio: 300
        },
        {
          id: 'tier-5-proactive',
          nameFa: 'سطح ۵ (پایه): شبه‌حوادث و شرایط/اعمال ناایمن (Near Miss / Hazards)',
          nameEn: 'Tier 5 (Base): Near Misses, Unsafe Acts & Conditions',
          subTitleFa: 'پایگاه بنیادی پیشگیری از حوادث با مشارکت همگانی پرسنل',
          subTitleEn: 'Foundation base: Proactive employee reporting',
          colorClass: 'text-emerald-400',
          bgGradient: 'from-emerald-950 via-teal-900 to-emerald-950',
          borderColor: 'border-emerald-400',
          glowColor: 'shadow-emerald-600/30',
          textColor: 'text-emerald-100',
          badgeBg: 'bg-emerald-900 text-emerald-200 border-emerald-400',
          icon: ShieldCheck,
          count: proactiveIncidents.length,
          percentage: Math.round((proactiveIncidents.length / totalCount) * 100),
          incidentTypes: [{ id: 'proactive', code: 'PRO', titleFa: 'پیشگیرانه', count: proactiveIncidents.length }],
          matchedIncidents: proactiveIncidents,
          standardBenchmarkRatio: 600
        }
      ];
    }
  };

  // Active tiers
  const activeTiers = useMemo(() => {
    return buildPyramidTiers(activeIncidents, modelMode);
  }, [activeIncidents, modelMode, configuredIncidentTypes]);

  // Comparative Tiers for Side-by-Side View
  const lastYearTiers = useMemo(() => buildPyramidTiers(lastYearIncidents, modelMode), [lastYearIncidents, modelMode, configuredIncidentTypes]);
  const currentYearTiers = useMemo(() => buildPyramidTiers(currentYearIncidents, modelMode), [currentYearIncidents, modelMode, configuredIncidentTypes]);

  // Executive Totals
  const proactiveCount = useMemo(() => {
    return activeIncidents.filter(i => i.category === 'Unsafe Act' || i.category === 'Unsafe Condition' || i.category === 'Near Miss').length;
  }, [activeIncidents]);

  const recordableCount = useMemo(() => {
    return activeIncidents.filter(i => {
      if (i.category === 'Incident' || i.category === 'Toxic Gas Leak') {
        return i.severity !== 'Critical / Lost Time (LTI)' && i.severity !== 'Fatality';
      }
      return false;
    }).length;
  }, [activeIncidents]);

  const highSeverityCount = useMemo(() => {
    return activeIncidents.filter(i => i.severity === 'Critical / Lost Time (LTI)' || i.severity === 'Fatality' || i.severity === 'High / Restricted Work').length;
  }, [activeIncidents]);

  const totalIncidentsCount = activeIncidents.length;

  // Proactive Health Ratio (درصد گزارش‌های پیشگیرانه به کل)
  const proactiveHealthRatio = useMemo(() => {
    if (totalIncidentsCount === 0) return 100;
    return Math.min(100, Math.round((proactiveCount / totalIncidentsCount) * 100));
  }, [proactiveCount, totalIncidentsCount]);

  // Health Rating Assessment
  const healthAssessment = useMemo(() => {
    if (highSeverityCount > 0 && proactiveCount < 10) {
      return {
        level: 'Critical',
        titleFa: 'هرم معکوس / نیاز به تقویت مفرط گزارش‌دهی پیشگیرانه',
        titleEn: 'Inverted Pyramid / Proactive Deficit',
        descFa: 'تعداد حوادث شدید نسبت به گزارش‌های پیشگیرانه بالاست. احتمال کتمان شبه‌حوادث و شرایط ناایمن وجود دارد.',
        color: 'rose',
        badgeClass: 'bg-rose-950 text-rose-300 border-rose-500/60'
      };
    }
    if (proactiveHealthRatio >= 85) {
      return {
        level: 'Excellent',
        titleFa: 'هرم ایمنی استاندارد و متعادل (فرهنگ HSE عالی)',
        titleEn: 'Balanced Safety Pyramid (Excellent HSE Culture)',
        descFa: 'بیش از ۸۵٪ گزارشات در قاعده پیشگیرانه هرم ثبت شده‌اند. این ساختار مانع از شکل‌گیری حوادث در رأس هرم می‌شود.',
        color: 'emerald',
        badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-500/60'
      };
    }
    if (proactiveHealthRatio >= 65) {
      return {
        level: 'Good',
        titleFa: 'هرم ایمنی در وضعیت پایدار و قابل قبول',
        titleEn: 'Stable & Acceptable Pyramid Balance',
        descFa: 'ثبت مناسب ناهنجاری‌ها و شبه‌حوادث؛ تشویق به گزارش‌دهی شرایط ناایمن در واحدهای فنی توصیه می‌شود.',
        color: 'amber',
        badgeClass: 'bg-amber-950 text-amber-300 border-blue-500/60'
      };
    }
    return {
      level: 'Warning',
      titleFa: 'هشدار عدم توازن هرم (نیاز به تشویق گزارش‌دهی)',
      titleEn: 'Imbalanced Pyramid (Under-reporting Warning)',
      descFa: 'حجم گزارشات پیشگیرانه پایین‌تر از استانداردهای ایمنی است. برگزاری مانورهای ثبت شبه‌حادثه ضروری است.',
      color: 'blue',
      badgeClass: 'bg-blue-950 text-blue-300 border-blue-500/60'
    };
  }, [proactiveHealthRatio, highSeverityCount, proactiveCount]);

  // Selected Tier Object for Drilldown Drawer / Details
  const selectedTier = useMemo(() => {
    if (!activeTierId) return null;
    return activeTiers.find(t => t.id === activeTierId) || null;
  }, [activeTierId, activeTiers]);

  // Table items for breakdown
  const filteredTableTypes = useMemo(() => {
    return configuredIncidentTypes.filter(type => {
      if (!tableSearch) return true;
      const q = tableSearch.toLowerCase();
      return (
        type.titleFa.toLowerCase().includes(q) ||
        (type.titleEn && type.titleEn.toLowerCase().includes(q)) ||
        (type.code && type.code.toLowerCase().includes(q))
      );
    });
  }, [configuredIncidentTypes, tableSearch]);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 p-5 md:p-8 shadow-2xl space-y-7 relative overflow-hidden transition-all">
      {/* Background Ambient Aura */}
      <div className="absolute -top-32 -right-32 w-[30rem] h-[30rem] bg-rose-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-[30rem] h-[30rem] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* TOP HEADER & CONTROLS */}
      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-800/80 pb-6">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-amber-400 text-xs font-black shadow-xs">
              <Layers className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{isFa ? 'مدل تحلیلی هرم حوادث هاینریش و فرانک برد (OSHA / Bird)' : 'Heinrich & Bird Safety Pyramid Model'}</span>
            </div>
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${healthAssessment.badgeClass}`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isFa ? healthAssessment.titleFa : healthAssessment.titleEn}</span>
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <span>{isFa ? 'هرم تحلیلی ایمنی، حوادث و ناهنجاری‌های کارگاهی' : 'Workshop Safety & Incident Analytics Pyramid'}</span>
          </h2>
          
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
            {isFa 
              ? 'پایش هندسی توزیع حوادث و ناهنجاری‌ها. هر چقدر قاعده هرم (شناسایی شرایط و اعمال ناایمن) گسترده‌تر و قوی‌تر باشد، احتمال وقوع حوادث جانی و بحرانی در رأس هرم به صفر نزدیک می‌شود.'
              : 'Geometric visualization of incident distribution. Strengthening the broad proactive foundation prevents critical recordable injuries and fatalities at the apex.'}
          </p>
        </div>

        {/* TOP RIGHT EXECUTIVE RATIO GAUGE */}
        <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4.5 w-full xl:w-96 shadow-xl space-y-3.5 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <Activity className="w-4 h-4" />
              {isFa ? 'شاخص سلامت پیشگیرانه (Proactive Ratio)' : 'Proactive Safety Index'}
            </span>
            <span className="font-mono text-emerald-300 text-base font-black bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-500/40">
              {proactiveHealthRatio}%
            </span>
          </div>

          {/* Stepped Progress Bar */}
          <div className="w-full bg-slate-950 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700 flex shadow-inner">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(5, proactiveHealthRatio)}%` }}
              title={isFa ? `پیشگیرانه: ${proactiveCount} مورد` : `Proactive: ${proactiveCount}`}
            ></div>
            <div 
              className="bg-amber-500 h-full transition-all duration-700"
              style={{ width: `${totalIncidentsCount > 0 ? (recordableCount / totalIncidentsCount) * 100 : 0}%` }}
              title={isFa ? `قابل ثبت: ${recordableCount} مورد` : `Recordable: ${recordableCount}`}
            ></div>
            <div 
              className="bg-rose-600 h-full transition-all duration-700"
              style={{ width: `${totalIncidentsCount > 0 ? (highSeverityCount / totalIncidentsCount) * 100 : 0}%` }}
              title={isFa ? `شدت بالا: ${highSeverityCount} مورد` : `High Severity: ${highSeverityCount}`}
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span className="text-emerald-400">🟢 {isFa ? 'پیشگیرانه' : 'Proactive'}: {proactiveCount}</span>
            <span className="text-amber-400">🟡 {isFa ? 'قابل ثبت' : 'Recordable'}: {recordableCount}</span>
            <span className="text-rose-400">🔴 {isFa ? 'شدت بالا' : 'Critical'}: {highSeverityCount}</span>
          </div>
        </div>
      </div>

      {/* FILTER & CONFIGURATION TOOLBAR */}
      <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/80 shadow-lg">
        {/* Period Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setPeriod('compare')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              period === 'compare' 
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black' 
                : 'text-slate-300 hover:bg-slate-700/70'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>{isFa ? '📊 مقایسه تطبیقی (۱۴۰۵ vs ۱۴۰۴)' : 'Comparative Analysis'}</span>
          </button>

          <button
            onClick={() => setPeriod('current_year')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              period === 'current_year' 
                ? 'bg-indigo-600 text-white shadow-lg font-black' 
                : 'text-slate-300 hover:bg-slate-700/70'
            }`}
          >
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span>{isFa ? 'سال جاری (۱۴۰۵)' : 'Current Year (1405)'}</span>
            <span className="bg-slate-900/90 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {currentYearIncidents.length}
            </span>
          </button>

          <button
            onClick={() => setPeriod('last_year')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              period === 'last_year' 
                ? 'bg-indigo-600 text-white shadow-lg font-black' 
                : 'text-slate-300 hover:bg-slate-700/70'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-sky-400" />
            <span>{isFa ? 'سال گذشته (۱۴۰۴)' : 'Last Year (1404)'}</span>
            <span className="bg-slate-900/90 text-sky-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {lastYearIncidents.length}
            </span>
          </button>

          <button
            onClick={() => setPeriod('daily')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              period === 'daily' 
                ? 'bg-emerald-600 text-white shadow-lg font-black' 
                : 'text-slate-300 hover:bg-slate-700/70'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{isFa ? 'امروز (روزانه)' : 'Daily (Today)'}</span>
            <span className="bg-slate-900/90 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {dailyIncidents.length}
            </span>
          </button>

          <button
            onClick={() => setPeriod('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              period === 'all' 
                ? 'bg-slate-700 text-white shadow-lg font-black' 
                : 'text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            <span>{isFa ? 'همه گزارش‌ها' : 'All Time'}</span>
            <span className="bg-slate-900/90 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
              {scopedIncidents.length}
            </span>
          </button>
        </div>

        {/* Right Controls: Department & 3-Tier/5-Tier Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">{isFa ? 'همه واحدهای کارگاهی' : 'All Departments'}</option>
              {departmentList.map(dept => (
                <option key={dept} value={dept} className="bg-slate-900">{dept}</option>
              ))}
            </select>
          </div>

          {/* 3-Tier vs 5-Tier Toggle */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setModelMode('3_tier')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                modelMode === '3_tier' 
                  ? 'bg-slate-700 text-white shadow-sm font-black' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isFa ? '۳ سطحی (OSHA)' : '3-Tier'}
            </button>
            <button
              onClick={() => setModelMode('5_tier')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                modelMode === '5_tier' 
                  ? 'bg-slate-700 text-white shadow-sm font-black' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isFa ? '۵ سطحی (Conoco)' : '5-Tier'}
            </button>
          </div>

          {/* Benchmark Guide Button */}
          <button
            onClick={() => setShowBenchmarkModal(true)}
            className="p-2 bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 rounded-xl transition cursor-pointer"
            title={isFa ? 'راهنمای مدل‌ها و نسبت‌های استاندارد هرم ایمنی' : 'Pyramid Benchmark Model Guide'}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* VIEW 1: COMPARATIVE VIEW (مقایسه تطبیقی سال جاری و سال گذشته) */}
      {period === 'compare' && (
        <div className="space-y-8 relative z-10 animate-fade-in">
          {/* COMPARISON SCORECARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Scorecard 1: High Severity (LTI/FAT) */}
            <div className="bg-slate-800/90 border border-rose-500/40 rounded-2xl p-4 space-y-3 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500" />
                  {isFa ? 'حوادث شدید (LTI / رأس)' : 'High Severity / Apex'}
                </span>
                {(() => {
                  const lastCnt = lastYearIncidents.filter(i => i.severity === 'Critical / Lost Time (LTI)' || i.severity === 'Fatality' || i.severity === 'High / Restricted Work').length;
                  const currCnt = currentYearIncidents.filter(i => i.severity === 'Critical / Lost Time (LTI)' || i.severity === 'Fatality' || i.severity === 'High / Restricted Work').length;
                  const diff = currCnt - lastCnt;
                  if (diff === 0) return <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">بدون تغییر</span>;
                  const isGood = diff < 0;
                  return (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-0.5 ${
                      isGood ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                    }`}>
                      {isGood ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      {diff > 0 ? `+${diff}` : `${diff}`} {isFa ? 'مورد' : 'cases'}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400">{isFa ? 'سال گذشته (۱۴۰۴)' : 'Last Year (1404)'}</span>
                  <span className="text-xl font-black font-mono text-slate-300">
                    {lastYearIncidents.filter(i => i.severity === 'Critical / Lost Time (LTI)' || i.severity === 'Fatality' || i.severity === 'High / Restricted Work').length}
                  </span>
                </div>
                <div className="text-center text-slate-500 font-black text-xs">← vs →</div>
                <div className="text-left">
                  <span className="block text-[10px] text-rose-400 font-bold">{isFa ? 'سال جاری (۱۴۰۵)' : 'Current Year (1405)'}</span>
                  <span className="text-2xl font-black font-mono text-rose-300">
                    {currentYearIncidents.filter(i => i.severity === 'Critical / Lost Time (LTI)' || i.severity === 'Fatality' || i.severity === 'High / Restricted Work').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Scorecard 2: Recordables (MTC / FAC) */}
            <div className="bg-slate-800/90 border border-blue-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-amber-400" />
                  {isFa ? 'حوادث قابل ثبت (Recordable)' : 'Recordables'}
                </span>
                {(() => {
                  const lastCnt = lastYearIncidents.filter(i => (i.category === 'Incident' || i.category === 'Toxic Gas Leak') && i.severity !== 'Critical / Lost Time (LTI)' && i.severity !== 'Fatality').length;
                  const currCnt = currentYearIncidents.filter(i => (i.category === 'Incident' || i.category === 'Toxic Gas Leak') && i.severity !== 'Critical / Lost Time (LTI)' && i.severity !== 'Fatality').length;
                  const diff = currCnt - lastCnt;
                  if (diff === 0) return <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">بدون تغییر</span>;
                  const isGood = diff < 0;
                  return (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-0.5 ${
                      isGood ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' : 'bg-rose-950 text-rose-300 border border-rose-500/50'
                    }`}>
                      {isGood ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      {diff > 0 ? `+${diff}` : `${diff}`} {isFa ? 'مورد' : 'cases'}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400">{isFa ? 'سال گذشته (۱۴۰۴)' : 'Last Year'}</span>
                  <span className="text-xl font-black font-mono text-slate-300">
                    {lastYearIncidents.filter(i => (i.category === 'Incident' || i.category === 'Toxic Gas Leak') && i.severity !== 'Critical / Lost Time (LTI)' && i.severity !== 'Fatality').length}
                  </span>
                </div>
                <div className="text-center text-slate-500 font-black text-xs">← vs →</div>
                <div className="text-left">
                  <span className="block text-[10px] text-amber-400 font-bold">{isFa ? 'سال جاری (۱۴۰۵)' : 'Current Year'}</span>
                  <span className="text-2xl font-black font-mono text-amber-300">
                    {currentYearIncidents.filter(i => (i.category === 'Incident' || i.category === 'Toxic Gas Leak') && i.severity !== 'Critical / Lost Time (LTI)' && i.severity !== 'Fatality').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Scorecard 3: Proactive Base (Near Misses & Unsafe Acts/Cond) */}
            <div className="bg-slate-800/90 border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  {isFa ? 'گزارش‌های پیشگیرانه (Base)' : 'Proactive Base Reports'}
                </span>
                {(() => {
                  const lastCnt = lastYearIncidents.filter(i => i.category === 'Unsafe Act' || i.category === 'Unsafe Condition' || i.category === 'Near Miss').length;
                  const currCnt = currentYearIncidents.filter(i => i.category === 'Unsafe Act' || i.category === 'Unsafe Condition' || i.category === 'Near Miss').length;
                  const diff = currCnt - lastCnt;
                  if (diff === 0) return <span className="bg-slate-700 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">بدون تغییر</span>;
                  const isGood = diff > 0; // Higher proactive reporting is a major positive!
                  return (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-0.5 ${
                      isGood ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50' : 'bg-amber-950 text-amber-300 border border-blue-500/50'
                    }`}>
                      {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {diff > 0 ? `+${diff}` : `${diff}`} {isFa ? 'گزارش' : 'reports'}
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400">{isFa ? 'سال گذشته (۱۴۰۴)' : 'Last Year'}</span>
                  <span className="text-xl font-black font-mono text-slate-300">
                    {lastYearIncidents.filter(i => i.category === 'Unsafe Act' || i.category === 'Unsafe Condition' || i.category === 'Near Miss').length}
                  </span>
                </div>
                <div className="text-center text-slate-500 font-black text-xs">← vs →</div>
                <div className="text-left">
                  <span className="block text-[10px] text-emerald-400 font-bold">{isFa ? 'سال جاری (۱۴۰۵)' : 'Current Year'}</span>
                  <span className="text-2xl font-black font-mono text-emerald-300">
                    {currentYearIncidents.filter(i => i.category === 'Unsafe Act' || i.category === 'Unsafe Condition' || i.category === 'Near Miss').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Scorecard 4: Daily Total (Today) */}
            <div className="bg-slate-800/90 border border-sky-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  {isFa ? 'آمار ثبت روزانه (امروز)' : 'Daily Log (Today)'}
                </span>
                <span className="bg-sky-950 text-sky-300 border border-sky-500/50 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  {todayDateFaStr}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="block text-[10px] text-slate-400">{isFa ? 'گزارش‌های امروز' : 'Today Total'}</span>
                  <span className="text-2xl font-black font-mono text-white">{dailyIncidents.length}</span>
                </div>
                <div className="text-left text-[10px] space-y-0.5 text-slate-300 font-medium">
                  <span className="block text-emerald-400 font-bold">
                    🟢 {isFa ? 'پیشگیرانه' : 'Proactive'}: {dailyIncidents.filter(i => i.category === 'Unsafe Act' || i.category === 'Unsafe Condition' || i.category === 'Near Miss').length}
                  </span>
                  <span className="block text-amber-400 font-bold">
                    🟡 {isFa ? 'حادثه' : 'Incident'}: {dailyIncidents.filter(i => i.category === 'Incident' || i.category === 'Toxic Gas Leak').length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* DUAL VISUAL PYRAMIDS: SIDE-BY-SIDE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT PYRAMID: 1404 */}
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-3xl p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="w-5 h-5 text-sky-400" />
                  <div>
                    <h3 className="font-black text-base text-white">
                      {isFa ? 'هرم ایمنی سال گذشته (۱۴۰۴)' : 'Safety Pyramid - Last Year (1404)'}
                    </h3>
                    <p className="text-[11px] text-slate-400">{isFa ? 'ساختار تجمیعی دوره‌ای ۱۴۰۴' : 'Annual Aggregated Hierarchy'}</p>
                  </div>
                </div>
                <span className="bg-sky-950 text-sky-300 border border-sky-500/40 font-mono text-xs px-3 py-1 rounded-full font-bold">
                  {lastYearIncidents.length} {isFa ? 'کل موارد' : 'Total'}
                </span>
              </div>

              {/* Stacked Stepped Tiers for Last Year */}
              <div className="space-y-3 pt-2">
                {lastYearTiers.map((tier, idx) => {
                  const widthPercent = 45 + idx * (55 / (lastYearTiers.length - 1 || 1));
                  return (
                    <div
                      key={tier.id}
                      style={{ width: `${widthPercent}%` }}
                      className={`mx-auto bg-gradient-to-r ${tier.bgGradient} border-2 ${tier.borderColor} rounded-2xl p-3.5 text-center text-white shadow-lg transition-all duration-300 hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-1 text-xs font-bold">
                        <span className="truncate">{isFa ? tier.nameFa.split(':')[0] : tier.nameEn.split(':')[0]}</span>
                        <span className="font-mono text-sm font-black text-white px-2 py-0.5 bg-black/40 rounded-md">
                          {tier.count}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-[10px]">
                        {tier.incidentTypes.slice(0, 4).map(sub => (
                          <span key={sub.id} className="bg-black/30 text-slate-200 px-2 py-0.5 rounded border border-white/10">
                            {sub.titleFa}: <strong className="font-mono text-white">{sub.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PYRAMID: 1405 */}
            <div className="bg-slate-950/80 border border-indigo-900/60 rounded-3xl p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="font-black text-base text-white">
                      {isFa ? 'هرم ایمنی سال جاری (۱۴۰۵)' : 'Safety Pyramid - Current Year (1405)'}
                    </h3>
                    <p className="text-[11px] text-slate-400">{isFa ? 'عملکرد تا به امروز سال ۱۴۰۵' : 'Year-to-Date Hierarchy'}</p>
                  </div>
                </div>
                <span className="bg-indigo-950 text-indigo-300 border border-indigo-500/40 font-mono text-xs px-3 py-1 rounded-full font-bold">
                  {currentYearIncidents.length} {isFa ? 'کل موارد' : 'Total'}
                </span>
              </div>

              {/* Stacked Stepped Tiers for Current Year */}
              <div className="space-y-3 pt-2">
                {currentYearTiers.map((tier, idx) => {
                  const widthPercent = 45 + idx * (55 / (currentYearTiers.length - 1 || 1));
                  return (
                    <div
                      key={tier.id}
                      style={{ width: `${widthPercent}%` }}
                      className={`mx-auto bg-gradient-to-r ${tier.bgGradient} border-2 ${tier.borderColor} rounded-2xl p-3.5 text-center text-white shadow-lg transition-all duration-300 hover:scale-[1.02]`}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-1 text-xs font-bold">
                        <span className="truncate">{isFa ? tier.nameFa.split(':')[0] : tier.nameEn.split(':')[0]}</span>
                        <span className="font-mono text-sm font-black text-white px-2 py-0.5 bg-black/40 rounded-md">
                          {tier.count}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-[10px]">
                        {tier.incidentTypes.slice(0, 4).map(sub => (
                          <span key={sub.id} className="bg-black/30 text-slate-200 px-2 py-0.5 rounded border border-white/10">
                            {sub.titleFa}: <strong className="font-mono text-white">{sub.count}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DETAILED CATEGORY COMPARISON TABLE */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-sm text-white">
                  {isFa ? 'جدول مقایسه تطبیقی تفصیلی عناوین حوادث و ناهنجاری‌ها' : 'Detailed Anomaly & Incident Trend Breakdown'}
                </h3>
              </div>

              {/* Search filter in table */}
              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={isFa ? 'جستجو در عناوین...' : 'Search types...'}
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-900/60">
                    <th className="p-3">{isFa ? 'کد و عنوان ناهنجاری / حادثه' : 'Code & Category Title'}</th>
                    <th className="p-3">{isFa ? 'سطح هرم سازمانی' : 'Pyramid Level'}</th>
                    <th className="p-3 text-center">{isFa ? 'آمار امروز' : 'Today'}</th>
                    <th className="p-3 text-center">{isFa ? 'سال گذشته (۱۴۰۴)' : 'Last Year (1404)'}</th>
                    <th className="p-3 text-center">{isFa ? 'سال جاری (۱۴۰۵)' : 'Current Year (1405)'}</th>
                    <th className="p-3 text-center">{isFa ? 'تغییرات (Δ)' : 'Trend Δ'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredTableTypes.map(type => {
                    const dailyCnt = dailyIncidents.filter(i => {
                      if (i.incidentTypeId === type.id) return true;
                      if (type.code === 'UA' && i.category === 'Unsafe Act') return true;
                      if (type.code === 'UC' && i.category === 'Unsafe Condition') return true;
                      if (type.code === 'NM' && i.category === 'Near Miss') return true;
                      if (type.code === 'FAC' && i.severity === 'Minor / First Aid') return true;
                      if (type.code === 'MTC' && i.severity === 'Moderate / Medical Treatment') return true;
                      if (type.code === 'LTI' && i.severity === 'Critical / Lost Time (LTI)') return true;
                      if (type.code === 'FAT' && i.severity === 'Fatality') return true;
                      return false;
                    }).length;

                    const lastCnt = lastYearIncidents.filter(i => {
                      if (i.incidentTypeId === type.id) return true;
                      if (type.code === 'UA' && i.category === 'Unsafe Act') return true;
                      if (type.code === 'UC' && i.category === 'Unsafe Condition') return true;
                      if (type.code === 'NM' && i.category === 'Near Miss') return true;
                      if (type.code === 'FAC' && i.severity === 'Minor / First Aid') return true;
                      if (type.code === 'MTC' && i.severity === 'Moderate / Medical Treatment') return true;
                      if (type.code === 'LTI' && i.severity === 'Critical / Lost Time (LTI)') return true;
                      if (type.code === 'FAT' && i.severity === 'Fatality') return true;
                      return false;
                    }).length;

                    const currCnt = currentYearIncidents.filter(i => {
                      if (i.incidentTypeId === type.id) return true;
                      if (type.code === 'UA' && i.category === 'Unsafe Act') return true;
                      if (type.code === 'UC' && i.category === 'Unsafe Condition') return true;
                      if (type.code === 'NM' && i.category === 'Near Miss') return true;
                      if (type.code === 'FAC' && i.severity === 'Minor / First Aid') return true;
                      if (type.code === 'MTC' && i.severity === 'Moderate / Medical Treatment') return true;
                      if (type.code === 'LTI' && i.severity === 'Critical / Lost Time (LTI)') return true;
                      if (type.code === 'FAT' && i.severity === 'Fatality') return true;
                      return false;
                    }).length;

                    const diff = currCnt - lastCnt;

                    let levelLabel = 'پیشگیرانه';
                    let levelBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
                    if (type.group === 'high_severity') {
                      levelLabel = 'شدت بالا (Apex)';
                      levelBg = 'bg-rose-950/80 text-rose-300 border-rose-500/40';
                    } else if (type.group === 'recordable') {
                      levelLabel = 'قابل ثبت';
                      levelBg = 'bg-amber-950/80 text-amber-300 border-blue-500/40';
                    }

                    return (
                      <tr key={type.id} className="hover:bg-slate-900/80 transition">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          {type.code && (
                            <span className="bg-slate-800 text-amber-300 font-mono text-[10px] px-2 py-0.5 rounded-md border border-slate-700 font-bold">
                              {type.code}
                            </span>
                          )}
                          <span>{type.titleFa}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${levelBg}`}>
                            {levelLabel}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-sky-300">
                          {dailyCnt > 0 ? <span className="bg-sky-900/80 text-sky-200 px-2 py-0.5 rounded-full">{dailyCnt}</span> : '۰'}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-slate-300">
                          {lastCnt}
                        </td>
                        <td className="p-3 text-center font-mono font-black text-amber-300 text-sm">
                          {currCnt}
                        </td>
                        <td className="p-3 text-center">
                          {diff === 0 ? (
                            <span className="text-slate-500 font-mono text-[10px]">۰</span>
                          ) : (
                            <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              type.group === 'proactive' 
                                ? (diff > 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' : 'bg-amber-950 text-amber-300 border-blue-500/50')
                                : (diff < 0 ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' : 'bg-rose-950 text-rose-300 border-rose-500/50')
                            }`}>
                              {diff > 0 ? `+${diff}` : diff}
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
      )}

      {/* VIEW 2: SINGLE PERIOD INTERACTIVE 3D PYRAMID VIEW */}
      {period !== 'compare' && (
        <div className="space-y-8 relative z-10 animate-fade-in">
          {/* Main Visual Stepped 3D Pyramid Canvas */}
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {isFa ? 'برای مشاهده جزئیات و لیست گزارشات، روی هر طبقه از هرم کلیک کنید' : 'Click any tier to inspect incident breakdown & list'}
              </span>
            </div>

            {/* Stepped Geometric Layers */}
            <div className="space-y-3.5 pt-2">
              {activeTiers.map((tier, idx) => {
                const isSelected = activeTierId === tier.id;
                // Calculate width to create realistic pyramid trapezoids
                const widthPercent = 42 + idx * (58 / (activeTiers.length - 1 || 1));
                const IconComponent = tier.icon;

                return (
                  <div
                    key={tier.id}
                    onClick={() => setActiveTierId(isSelected ? null : tier.id)}
                    style={{ width: `${widthPercent}%` }}
                    className={`mx-auto cursor-pointer transition-all duration-300 group relative ${
                      isSelected ? 'scale-[1.03] z-20' : 'hover:scale-[1.015]'
                    }`}
                  >
                    {/* Glowing Aura when active */}
                    <div className={`absolute -inset-1 bg-gradient-to-r ${tier.bgGradient} rounded-3xl blur-md opacity-30 group-hover:opacity-70 transition duration-300 ${isSelected ? 'opacity-100' : ''}`}></div>

                    <div className={`relative bg-gradient-to-r ${tier.bgGradient} border-2 ${tier.borderColor} rounded-2xl md:rounded-3xl p-4 md:p-5 text-white shadow-2xl transition-all ${
                      isSelected ? 'ring-4 ring-white/30' : ''
                    }`}>
                      {/* Top Header of Tier */}
                      <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-black/40 rounded-xl">
                            <IconComponent className={`w-4 h-4 md:w-5 md:h-5 ${tier.colorClass}`} />
                          </div>
                          <div>
                            <h3 className="font-black text-xs md:text-sm text-white">
                              {isFa ? tier.nameFa : tier.nameEn}
                            </h3>
                            <p className="text-[10px] md:text-[11px] text-slate-300 font-normal">
                              {isFa ? tier.subTitleFa : tier.subTitleEn}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${tier.badgeBg}`}>
                            {tier.percentage}% {isFa ? 'از کل' : 'of total'}
                          </span>
                        </div>
                      </div>

                      {/* Tier Metrics & Ratio */}
                      <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl md:text-4xl font-black font-mono tracking-tight text-white drop-shadow-md">
                            {tier.count}
                          </span>
                          <div className="text-right leading-tight">
                            <span className="block text-xs font-bold text-slate-200">
                              {isFa ? 'مورد ثبت‌شده' : 'Logged Records'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {isFa ? 'در بازه زمانی انتخابی' : 'In Selected Period'}
                            </span>
                          </div>
                        </div>

                        {/* Ratio tag relative to apex */}
                        <div className="text-left bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                          <span className="block text-[10px] text-slate-400">{isFa ? 'نسبت نظری بنچمارک' : 'Standard Ratio'}</span>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            ۱ : {tier.standardBenchmarkRatio}
                          </span>
                        </div>
                      </div>

                      {/* Sub-types Badges */}
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2.5 border-t border-white/15">
                        {tier.incidentTypes.map(sub => (
                          <div 
                            key={sub.id}
                            className="bg-black/35 hover:bg-black/50 border border-white/10 rounded-xl px-2.5 py-1 text-[11px] flex items-center gap-1.5 font-bold transition"
                          >
                            <span className="text-slate-200">{sub.titleFa}</span>
                            {sub.code && <span className="text-[9px] font-mono text-amber-300 opacity-90">({sub.code})</span>}
                            <span className="bg-white/20 text-white font-mono text-[10px] px-1.5 py-0.5 rounded font-black">
                              {sub.count}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Expand / View Hint */}
                      <div className="mt-3 pt-2 text-center text-[10px] text-slate-400 font-bold border-t border-white/10 flex items-center justify-center gap-1">
                        <span>{isSelected ? (isFa ? '▲ بستن جزئیات گزارشات' : '▲ Collapse Details') : (isFa ? '▼ کلیک برای مشاهده لیست گزارشات این سطح' : '▼ Click to View Incidents')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTIVE SELECTED TIER DRILL-DOWN PANEL */}
          {selectedTier && (
            <div className="bg-slate-950/95 border-2 border-blue-500/60 rounded-3xl p-6 space-y-4 shadow-2xl animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-black/40 border border-white/10`}>
                    <selectedTier.icon className={`w-5 h-5 ${selectedTier.colorClass}`} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white flex items-center gap-2">
                      <span>{isFa ? selectedTier.nameFa : selectedTier.nameEn}</span>
                      <span className="bg-amber-500 text-slate-950 text-xs px-2.5 py-0.5 rounded-full font-mono font-black">
                        {selectedTier.count} {isFa ? 'مورد' : 'records'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">{isFa ? selectedTier.subTitleFa : selectedTier.subTitleEn}</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTierId(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Incidents Table for this Tier */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-900/60">
                      <th className="p-3">{isFa ? 'کد گزارش' : 'Report ID'}</th>
                      <th className="p-3">{isFa ? 'عنوان و شرح مختصر' : 'Title & Summary'}</th>
                      <th className="p-3">{isFa ? 'واحد / مکان' : 'Department / Site'}</th>
                      <th className="p-3">{isFa ? 'تاریخ وقوع' : 'Date'}</th>
                      <th className="p-3">{isFa ? 'شدت / وضعیت' : 'Severity / Status'}</th>
                      <th className="p-3 text-center">{isFa ? 'عملیات' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {selectedTier.matchedIncidents.length > 0 ? (
                      selectedTier.matchedIncidents.map(inc => (
                        <tr key={inc.id} className="hover:bg-slate-900/80 transition">
                          <td className="p-3 font-mono font-bold text-amber-400">
                            {inc.reportNumber}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-white block max-w-sm truncate">{inc.title}</span>
                            <span className="text-[10px] text-slate-400 block">{inc.reporterName} ({inc.reporterRole})</span>
                          </td>
                          <td className="p-3 text-slate-300">
                            {inc.department}
                            <span className="block text-[10px] text-slate-500">{inc.locationSite}</span>
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {inc.eventDate}
                          </td>
                          <td className="p-3">
                            <span className="text-[11px] font-bold block">{inc.severity}</span>
                            <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded mt-0.5 ${
                              inc.status === 'Resolved & Closed' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' :
                              inc.status === 'CAPA In Progress' ? 'bg-amber-950 text-amber-300 border border-blue-500/40' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {inc.status}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {onSelectIncident && (
                              <button
                                onClick={() => onSelectIncident(inc)}
                                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 rounded-lg font-bold text-xs transition flex items-center gap-1 mx-auto cursor-pointer"
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
                        <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                          {isFa ? 'هیچ رکوردی در این سطح هرم در این بازه زمانی ثبت نشده است.' : 'No records found in this tier.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* THEORETICAL RATIO BENCHMARK COMPARISON CARD */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm text-white">
                    {isFa ? 'تحلیل و مقایسه نسبت‌های واقعی کارگاه با مدل‌های استاندارد جهانی' : 'Workshop Ratio vs. World Standard Benchmarks'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isFa ? 'مقایسه نسبت ثبت حوادث شدید به حوادث جزیی و ناهنجاری‌های پیشگیرانه' : 'LTI to Recordables to Proactive Ratio Validation'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Ratio 1: Workshop Actual */}
              <div className="bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300">{isFa ? 'نسبت واقعی کارگاه شما' : 'Your Actual Workshop Ratio'}</span>
                  <span className="bg-indigo-950 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full font-bold">زنده</span>
                </div>
                <div className="py-2 text-center">
                  <span className="font-mono text-xl font-black text-white">
                    {highSeverityCount > 0 ? '۱' : '۰'} : {highSeverityCount > 0 ? Math.round(recordableCount / (highSeverityCount || 1)) : recordableCount} : {highSeverityCount > 0 ? Math.round(proactiveCount / (highSeverityCount || 1)) : proactiveCount}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    {isFa ? '(۱ شدید : [N] قابل ثبت : [M] پیشگیرانه)' : '(1 Major : N Minor : M Hazards)'}
                  </span>
                </div>
              </div>

              {/* Ratio 2: Heinrich Model */}
              <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{isFa ? 'مدل استاندارد هاینریش (Heinrich)' : 'Heinrich Triangle (1931)'}</span>
                  <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">Standard</span>
                </div>
                <div className="py-2 text-center">
                  <span className="font-mono text-xl font-black text-amber-300">
                    ۱ : ۲۹ : ۳۰۰
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    {isFa ? '۱ حادثه شدید = ۲۹ حادثه جزیی = ۳۰۰ شبه‌حادثه' : '1 Major = 29 Minor = 300 Near Misses'}
                  </span>
                </div>
              </div>

              {/* Ratio 3: Frank E. Bird Model */}
              <div className="bg-slate-900/90 border border-slate-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{isFa ? 'مدل جامع فرانک برد (Bird Model)' : 'Frank E. Bird Model (1969)'}</span>
                  <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">Standard</span>
                </div>
                <div className="py-2 text-center">
                  <span className="font-mono text-xl font-black text-emerald-300">
                    ۱ : ۱۰ : ۳۰ : ۶۰۰
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-1">
                    {isFa ? '۱ فوت/LTI = ۱۰ جزیی = ۳۰ خسارت مالی = ۶۰۰ عمل ناایمن' : '1 Major : 10 Minor : 30 Property : 600 Incidents'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER ACTION BAR */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-400">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {isFa 
              ? 'تمامی اطلاعات و نسبت‌های هرم فوق به صورت آنی و خودکار از لاگ‌بوک حوادث و تنظیمات ساختار سازمانی همگام‌سازی می‌شوند.'
              : 'All pyramid tiers automatically synchronize with the Safety Incidents Ledger and Org Management settings.'}
          </span>
        </div>

        {onNavigateToReports && (
          <button
            onClick={onNavigateToReports}
            className="text-amber-400 hover:text-amber-300 font-black flex items-center gap-1.5 transition text-xs cursor-pointer"
          >
            <span>{isFa ? 'مشاهده دفاتر و جداول ثبت حوادث' : 'View Full Incident Ledger'}</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* BENCHMARK EXPLANATION MODAL */}
      {showBenchmarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {isFa ? 'راهنمای علمی و استانداردهای هرم ایمنی و حوادث' : 'Safety Pyramid Analytical Standards Guide'}
                  </h3>
                  <p className="text-xs text-slate-400">{isFa ? 'نظریه هاینریش، فرانک برد و دستورالعمل OSHA' : 'Heinrich, Frank Bird & OSHA Principles'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 space-y-2">
                <h4 className="font-black text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  {isFa ? '۱. نظریه هاینریش (H.W. Heinrich - 1931)' : '1. Heinrich Theory'}
                </h4>
                <p>
                  {isFa 
                    ? 'طبق تحقیقات هاینریش در صنایع، به ازای هر ۱ حادثه شدید و ناتوان‌کننده (رأس)، ۲۹ حادثه با جراحت جزیی و ۳۰۰ رویداد بدون آسیب (شبه‌حادثه و عمل ناایمن) رخ می‌دهد. تمرکز بر حذف ۳۰۰ مورد پایه‌ای، رأس هرم را به کلی مسدود می‌کند.'
                    : 'For every 1 major injury, there are 29 minor injuries and 300 no-injury incidents (near misses). Addressing the base eliminates the apex.'}
                </p>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 space-y-2">
                <h4 className="font-black text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {isFa ? '۲. هرم جامع فرانک برد (Frank E. Bird - 1969)' : '2. Frank Bird Model'}
                </h4>
                <p>
                  {isFa 
                    ? 'فرانک برد با بررسی ۱.۷ میلیون حادثه در ۲۹۷ شرکت، نسبت ۱ : ۱۰ : ۳۰ : ۶۰۰ را استخراج کرد. (۱ فوت/LTI در برابر ۱۰ درمان اولیه، ۳۰ خسارت تجهیزاتی و ۶۰۰ شبه‌حادثه). این مدل مبنای سیستم‌های نوین مدیریت HSE و استاندارد OSHA 29 CFR 1904 است.'
                    : 'Bird analyzed 1.7 million incidents yielding the 1 : 10 : 30 : 600 ratio, integrating property damage and comprehensive proactive hazards.'}
                </p>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700 space-y-2">
                <h4 className="font-black text-sky-300 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  {isFa ? '۳. شاخص سلامت هرم (Pyramid Health Ratio)' : '3. Pyramid Health Ratio'}
                </h4>
                <p>
                  {isFa 
                    ? 'اگر سهم رویدادهای پیشگیرانه (قاعده هرم) از کل گزارشات بالای ۸۰٪ باشد، سازمان در سلامت کامل پیشگیرانه قرار دارد. اگر رأس هرم بدون ثبت کافی در قاعده باشد، نشانه خطای "عدم گزارش‌دهی ناهنجاری‌ها" است.'
                    : 'A proactive ratio above 80% reflects a mature reporting culture where hazards are captured before developing into recordables.'}
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                {isFa ? 'متوجه شدم و بستن' : 'Got it & Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
