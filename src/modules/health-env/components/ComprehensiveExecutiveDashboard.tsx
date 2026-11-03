import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Activity, Users, FileText, CheckCircle2, Clock, AlertTriangle,
  Wind, Droplets, Trash2, ShieldAlert,
  BarChart3, Filter, Calendar, Building2, Layers,
  ChevronLeft, ShieldCheck, HeartPulse, CheckSquare,
  Stethoscope, Apple, ClipboardCheck, Recycle, Globe, FileSpreadsheet,
  RefreshCw, Ambulance, Scale, Flame
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { healthEnvService, extractShamsiYear } from '../services/healthEnvService';
import { clinicService } from '../services/clinicService';
import { nutritionService } from '../services/nutritionService';
import { highRiskNutritionService } from '../services/highRiskNutritionService';
import { healthEnvChecklistService } from '../services/healthEnvChecklistService';
import { fiveSService } from '../services/fiveSService';
import { getComplexPersonnelList } from '../../../utils/personnelHelper';
import { ClinicVisit } from '../types/clinicTypes';
import { NutritionRecord, HighRiskPersonnelProfile } from '../types/nutritionTypes';
import { HealthEnvInspection } from '../types/checklistTypes';

interface Props {
  language: 'fa' | 'en';
  onNavigate?: (sectionId: string) => void;
}

type DashboardDomainFilter = 'all' | 'health' | 'environment';

interface KpiCardItem {
  id: string;
  domain: 'health' | 'environment';
  title: string;
  value: string | number;
  unit?: string;
  subtitle: string;
  badgeText?: string;
  badgeTone?: 'emerald' | 'teal' | 'amber' | 'rose' | 'indigo' | 'blue' | 'slate';
  progressPercent?: number;
  icon: React.ComponentType<{ className?: string }>;
  accentTone: 'teal' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'blue' | 'cyan';
  targetSection?: string;
}

interface SubmoduleSummaryItem {
  key: string;
  domain: 'health' | 'environment';
  title: string;
  subtitle: string;
  primaryMetric: string;
  secondaryMetric: string;
  statusTone: 'emerald' | 'teal' | 'amber' | 'rose' | 'indigo' | 'blue';
  icon: React.ComponentType<{ className?: string }>;
}

const TONE_CLASSES: Record<
  KpiCardItem['accentTone'],
  {
    borderHover: string;
    iconBg: string;
    iconText: string;
    valueText: string;
    barBg: string;
  }
> = {
  teal: {
    borderHover: 'hover:border-teal-400 dark:hover:border-teal-500',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60',
    iconText: 'text-teal-600 dark:text-teal-400',
    valueText: 'text-teal-700 dark:text-teal-300',
    barBg: 'bg-teal-500'
  },
  emerald: {
    borderHover: 'hover:border-emerald-400 dark:hover:border-emerald-500',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    valueText: 'text-emerald-700 dark:text-emerald-300',
    barBg: 'bg-emerald-500'
  },
  rose: {
    borderHover: 'hover:border-rose-400 dark:hover:border-rose-500',
    iconBg: 'bg-rose-50 dark:bg-rose-950/60',
    iconText: 'text-rose-600 dark:text-rose-400',
    valueText: 'text-rose-700 dark:text-rose-300',
    barBg: 'bg-rose-500'
  },
  amber: {
    borderHover: 'hover:border-amber-400 dark:hover:border-amber-500',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60',
    iconText: 'text-amber-600 dark:text-amber-400',
    valueText: 'text-amber-700 dark:text-amber-300',
    barBg: 'bg-amber-500'
  },
  indigo: {
    borderHover: 'hover:border-indigo-400 dark:hover:border-indigo-500',
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    valueText: 'text-indigo-700 dark:text-indigo-300',
    barBg: 'bg-indigo-500'
  },
  blue: {
    borderHover: 'hover:border-blue-400 dark:hover:border-blue-500',
    iconBg: 'bg-blue-50 dark:bg-blue-950/60',
    iconText: 'text-blue-600 dark:text-blue-400',
    valueText: 'text-blue-700 dark:text-blue-300',
    barBg: 'bg-blue-500'
  },
  cyan: {
    borderHover: 'hover:border-cyan-400 dark:hover:border-cyan-500',
    iconBg: 'bg-cyan-50 dark:bg-cyan-950/60',
    iconText: 'text-cyan-600 dark:text-cyan-400',
    valueText: 'text-cyan-700 dark:text-cyan-300',
    barBg: 'bg-cyan-500'
  }
};

const BADGE_TONE_CLASSES: Record<NonNullable<KpiCardItem['badgeTone']>, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800/60',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
};

// Reusable KPI Card Component (Zero Duplicate Code)
const ExecutiveKpiCard: React.FC<{
  item: KpiCardItem;
  isFa: boolean;
  onNavigate?: (sectionId: string) => void;
}> = ({ item, isFa, onNavigate }) => {
  const Icon = item.icon;
  const tone = TONE_CLASSES[item.accentTone];
  const badgeClass = BADGE_TONE_CLASSES[item.badgeTone || 'slate'];

  return (
    <div
      onClick={() => item.targetSection && onNavigate?.(item.targetSection)}
      className={`p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-xs transition-all duration-200 flex flex-col justify-between gap-2.5 group ${
        tone.borderHover
      } ${item.targetSection && onNavigate ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 leading-snug line-clamp-1">
          {item.title}
        </span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${tone.iconBg} ${tone.iconText}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2 my-0.5">
        <div className={`text-2xl font-black font-mono tracking-tight ${tone.valueText}`}>
          {item.value}
          {item.unit && (
            <span className="text-[11px] font-sans font-bold text-slate-400 dark:text-slate-500 mr-1 ml-1">
              {item.unit}
            </span>
          )}
        </div>
        {item.badgeText && (
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${badgeClass}`}>
            {item.badgeText}
          </span>
        )}
      </div>

      {typeof item.progressPercent === 'number' && (
        <div className="w-full bg-slate-100 dark:bg-slate-700/70 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tone.barBg}`}
            style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
        <span className="truncate">{item.subtitle}</span>
        {item.targetSection && onNavigate && (
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0 rtl:rotate-0 ltr:rotate-180 transition-colors" />
        )}
      </div>
    </div>
  );
};

// Reusable Chart Panel Wrapper Component (Zero Duplicate Code)
const ChartPanelCard: React.FC<{
  title: string;
  subtitle: string;
  badgeText?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColorClass?: string;
  targetSection?: string;
  targetLabel?: string;
  isFa: boolean;
  hasData: boolean;
  emptyText: string;
  onNavigate?: (sectionId: string) => void;
  children: React.ReactNode;
}> = ({
  title,
  subtitle,
  badgeText,
  icon: Icon,
  iconColorClass = 'text-teal-600 dark:text-teal-400',
  targetSection,
  targetLabel,
  isFa,
  hasData,
  emptyText,
  onNavigate,
  children
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between min-w-0">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/70">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/70 shrink-0">
              <Icon className={`w-4 h-4 ${iconColorClass}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-xs sm:text-sm text-slate-800 dark:text-white truncate">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>

          {badgeText && (
            <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg shrink-0">
              {badgeText}
            </span>
          )}
        </div>

        {hasData ? (
          <div className="w-full h-[250px] sm:h-[270px]" dir="ltr">
            {children}
          </div>
        ) : (
          <div className="h-[230px] flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
            <Icon className={`w-8 h-8 mb-2 opacity-40 ${iconColorClass}`} />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{emptyText}</p>
            {targetSection && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate(targetSection)}
                className="mt-3 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold transition cursor-pointer"
              >
                {targetLabel || (isFa ? 'ورود به زیرماژول جهت ثبت داده' : 'Open Submodule')}
              </button>
            )}
          </div>
        )}
      </div>

      {targetSection && onNavigate && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 dark:text-slate-500 truncate">
            {isFa ? 'متصل به داده‌های واقعی زیرماژول' : 'Live Submodule Telemetry'}
          </span>
          <button
            type="button"
            onClick={() => onNavigate(targetSection)}
            className="font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>{targetLabel || (isFa ? 'مشاهده زیرماژول' : 'View Module')}</span>
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function ComprehensiveExecutiveDashboard({ language, onNavigate }: Props) {
  const isFa = language === 'fa';
  const [dataVersion, setDataVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Asynchronous live states from Clinic, Nutrition, and Checklists services
  const [clinicVisits, setClinicVisits] = useState<ClinicVisit[]>([]);
  const [nutritionRecords, setNutritionRecords] = useState<NutritionRecord[]>([]);
  const [checklistInspections, setChecklistInspections] = useState<HealthEnvInspection[]>(() =>
    healthEnvChecklistService.getAllInspections()
  );

  // Filters State
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<DashboardDomainFilter>('all');

  const todayJalali = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch {
      return '1404/07/01';
    }
  }, []);

  const loadAllAsyncSubmoduleData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [visitsData, nutritionData] = await Promise.all([
        clinicService.getVisits().catch(() => [] as ClinicVisit[]),
        nutritionService.getRecords().catch(() => [] as NutritionRecord[]),
        healthEnvService.reloadFromServer().catch(() => {}),
        healthEnvChecklistService.reloadFromServer().catch(() => {})
      ]);
      setClinicVisits(Array.isArray(visitsData) ? visitsData : []);
      setNutritionRecords(Array.isArray(nutritionData) ? nutritionData : []);
      setChecklistInspections(healthEnvChecklistService.getAllInspections());
      setDataVersion(v => v + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllAsyncSubmoduleData();

    const handleSyncUpdate = () => {
      setChecklistInspections(healthEnvChecklistService.getAllInspections());
      setDataVersion(v => v + 1);
    };

    const handleAsyncUpdate = () => {
      loadAllAsyncSubmoduleData();
    };

    window.addEventListener('hse_medical_data_updated', handleSyncUpdate);
    window.addEventListener('hse_occ_health_data_updated', handleSyncUpdate);
    window.addEventListener('hse_health_env_updated', handleSyncUpdate);
    window.addEventListener('five_s_data_updated', handleSyncUpdate);
    window.addEventListener('hse_health_env_inspections_updated', handleSyncUpdate);
    window.addEventListener('hse_clinic_visits_updated', handleAsyncUpdate);
    window.addEventListener('hse_nutrition_records_updated', handleAsyncUpdate);
    window.addEventListener('app_data_mutated', handleAsyncUpdate);
    window.addEventListener('storage', handleSyncUpdate);

    return () => {
      window.removeEventListener('hse_medical_data_updated', handleSyncUpdate);
      window.removeEventListener('hse_occ_health_data_updated', handleSyncUpdate);
      window.removeEventListener('hse_health_env_updated', handleSyncUpdate);
      window.removeEventListener('five_s_data_updated', handleSyncUpdate);
      window.removeEventListener('hse_health_env_inspections_updated', handleSyncUpdate);
      window.removeEventListener('hse_clinic_visits_updated', handleAsyncUpdate);
      window.removeEventListener('hse_nutrition_records_updated', handleAsyncUpdate);
      window.removeEventListener('app_data_mutated', handleAsyncUpdate);
      window.removeEventListener('storage', handleSyncUpdate);
    };
  }, [loadAllAsyncSubmoduleData]);

  // Raw Data Sources from Synchronous Services
  const masterPersonnel = useMemo(() => getComplexPersonnelList(), [dataVersion]);
  const allMedicalRecords = useMemo(() => healthEnvService.getAllRecords(), [dataVersion]);
  const allPeriodicExams = useMemo(() => healthEnvService.getAllPeriodicExams(), [dataVersion]);
  const allNonPeriodicExams = useMemo(() => healthEnvService.getAllNonPeriodicExams(), [dataVersion]);
  const allEnvMonitoring = useMemo(() => healthEnvService.getAllEnvMonitoring(), [dataVersion]);
  const allWasteRecords = useMemo(() => healthEnvService.getAllWasteRecords(), [dataVersion]);
  const allWastewater = useMemo(() => healthEnvService.getAllWastewater(), [dataVersion]);
  const allAirQuality = useMemo(() => healthEnvService.getAllAirQuality(), [dataVersion]);
  const allWaterSoil = useMemo(() => healthEnvService.getAllWaterSoil(), [dataVersion]);
  const allEnvNcs = useMemo(() => healthEnvService.getAllNonConformances(), [dataVersion]);
  const allFiveSInspections = useMemo(() => fiveSService.getAllInspections(), [dataVersion]);
  const allFiveSNcs = useMemo(() => fiveSService.getAllNonConformances(), [dataVersion]);

  // Available Years across ALL Health & Environment submodules
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    healthEnvService.getAvailableExamYears().forEach(y => years.add(y));
    healthEnvService.getAvailableMonitoringYears().forEach(y => years.add(y));
    clinicVisits.forEach(v => {
      const y = extractShamsiYear(v.visitDate);
      if (y) years.add(y);
    });
    nutritionRecords.forEach(r => {
      const y = extractShamsiYear(r.visitDate);
      if (y) years.add(y);
    });
    checklistInspections.forEach(i => {
      const y = extractShamsiYear(i.inspectionDate);
      if (y) years.add(y);
    });
    allFiveSInspections.forEach(i => {
      const y = extractShamsiYear(i.date);
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [dataVersion, clinicVisits, nutritionRecords, checklistInspections, allFiveSInspections]);

  // Dynamic Organizational Units / Departments across all submodules
  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    const addDept = (d?: string) => {
      if (d && d.trim()) depts.add(d.trim());
    };
    masterPersonnel.forEach(p => addDept(p.unit || p.department || p.workplace));
    allMedicalRecords.forEach(r => addDept(r.department));
    allPeriodicExams.forEach(e => addDept((e as any).department));
    allNonPeriodicExams.forEach(e => addDept(e.department));
    clinicVisits.forEach(v => addDept(v.unit || v.department));
    nutritionRecords.forEach(r => addDept(r.unit || r.department));
    checklistInspections.forEach(i => addDept(i.unit || i.site));
    allEnvMonitoring.forEach(m => addDept(m.department || m.site));
    allWasteRecords.forEach(w => addDept(w.department || w.originLocation));
    allFiveSInspections.forEach(i => addDept(i.department));
    return Array.from(depts).sort();
  }, [
    masterPersonnel,
    allMedicalRecords,
    allPeriodicExams,
    allNonPeriodicExams,
    clinicVisits,
    nutritionRecords,
    checklistInspections,
    allEnvMonitoring,
    allWasteRecords,
    allFiveSInspections
  ]);

  // Helper to match selectedYear and selectedDept
  const matchesYear = useCallback(
    (dateOrYear?: string | number) => {
      if (selectedYear === 'all') return true;
      const y = typeof dateOrYear === 'number' ? dateOrYear : extractShamsiYear(dateOrYear);
      return !y || y === selectedYear;
    },
    [selectedYear]
  );

  const matchesDept = useCallback(
    (...candidates: (string | undefined)[]) => {
      if (selectedDept === 'all') return true;
      const target = selectedDept.trim().toLowerCase();
      return candidates.some(c => c && c.trim().toLowerCase().includes(target));
    },
    [selectedDept]
  );

  // Map recordId / employeeCode -> department for periodic exam filtering
  const recordDeptMap = useMemo(() => {
    const map = new Map<string, string>();
    masterPersonnel.forEach(p => {
      const d = p.unit || p.department || p.workplace || '';
      if (p.personnelCode) map.set(p.personnelCode.toLowerCase(), d);
      if (p.nationalCode) map.set(p.nationalCode.toLowerCase(), d);
      if (p.id) map.set(p.id.toLowerCase(), d);
    });
    allMedicalRecords.forEach(r => {
      if (r.id) map.set(r.id.toLowerCase(), r.department || '');
      if (r.employeeCode) map.set(r.employeeCode.toLowerCase(), r.department || '');
      if (r.nationalCode) map.set(r.nationalCode.toLowerCase(), r.department || '');
    });
    return map;
  }, [masterPersonnel, allMedicalRecords]);

  // ============================================================================
  // FILTERED DATASETS ACROSS ALL SUBMODULES
  // ============================================================================
  const filteredPersonnel = useMemo(
    () => masterPersonnel.filter(p => matchesDept(p.unit, p.department, p.workplace)),
    [masterPersonnel, matchesDept]
  );

  const filteredMedicalRecords = useMemo(
    () => allMedicalRecords.filter(r => matchesDept(r.department)),
    [allMedicalRecords, matchesDept]
  );

  const filteredPeriodicExams = useMemo(
    () =>
      allPeriodicExams.filter(e => {
        if (!matchesYear(e.examYear || e.examDate)) return false;
        const empDept =
          (e as any).department ||
          recordDeptMap.get(String(e.recordId || '').toLowerCase()) ||
          recordDeptMap.get(String(e.employeeCode || '').toLowerCase());
        return matchesDept(empDept);
      }),
    [allPeriodicExams, matchesYear, matchesDept, recordDeptMap]
  );

  const filteredNonPeriodicExams = useMemo(
    () => allNonPeriodicExams.filter(e => matchesYear(e.examDate) && matchesDept(e.department)),
    [allNonPeriodicExams, matchesYear, matchesDept]
  );

  const filteredClinicVisits = useMemo(
    () => clinicVisits.filter(v => matchesYear(v.visitDate) && matchesDept(v.unit, v.department)),
    [clinicVisits, matchesYear, matchesDept]
  );

  const filteredNutritionRecords = useMemo(
    () => nutritionRecords.filter(r => matchesYear(r.visitDate) && matchesDept(r.unit, r.department)),
    [nutritionRecords, matchesYear, matchesDept]
  );

  // High-Risk Profiles synthesized directly from Periodic Medical Exams + Nutrition Submodule
  const highRiskProfiles: HighRiskPersonnelProfile[] = useMemo(() => {
    const profiles = highRiskNutritionService.buildHighRiskProfiles(
      filteredNutritionRecords,
      filteredPeriodicExams,
      filteredMedicalRecords,
      filteredPersonnel,
      todayJalali
    );
    return profiles.filter(p => matchesDept(p.unit, p.department));
  }, [filteredNutritionRecords, filteredPeriodicExams, filteredMedicalRecords, filteredPersonnel, todayJalali, matchesDept]);

  const filteredChecklists = useMemo(
    () => checklistInspections.filter(i => matchesYear(i.inspectionDate) && matchesDept(i.unit, i.site, i.areaLocation)),
    [checklistInspections, matchesYear, matchesDept]
  );

  const filteredEnvMonitoring = useMemo(
    () => allEnvMonitoring.filter(m => matchesYear(m.date) && matchesDept(m.department, m.site, m.stationOrLocation)),
    [allEnvMonitoring, matchesYear, matchesDept]
  );

  const filteredWasteRecords = useMemo(
    () => allWasteRecords.filter(w => matchesYear(w.productionDate || w.createdAt) && matchesDept(w.department, w.originLocation)),
    [allWasteRecords, matchesYear, matchesDept]
  );

  const filteredWastewater = useMemo(
    () => allWastewater.filter(ww => matchesYear(ww.date || ww.createdAt) && matchesDept(ww.samplingPoint)),
    [allWastewater, matchesYear, matchesDept]
  );

  const filteredAirQuality = useMemo(
    () => allAirQuality.filter(a => matchesYear(a.date || a.lastUpdated) && matchesDept(a.stationName)),
    [allAirQuality, matchesYear, matchesDept]
  );

  const filteredWaterSoil = useMemo(
    () => allWaterSoil.filter(ws => matchesYear(ws.date) && matchesDept(ws.location)),
    [allWaterSoil, matchesYear, matchesDept]
  );

  const filteredFiveSInspections = useMemo(
    () => allFiveSInspections.filter(i => matchesYear(i.date) && matchesDept(i.department, i.location)),
    [allFiveSInspections, matchesYear, matchesDept]
  );

  const filteredEnvNcs = useMemo(
    () => allEnvNcs.filter(n => matchesYear(n.identifiedDate || n.createdAt) && matchesDept(n.department, n.location)),
    [allEnvNcs, matchesYear, matchesDept]
  );

  const filteredFiveSNcs = useMemo(
    () => allFiveSNcs.filter(n => matchesYear(n.identifiedDate || n.createdAt) && matchesDept(n.department, n.location)),
    [allFiveSNcs, matchesYear, matchesDept]
  );

  // ============================================================================
  // AGGREGATED METRICS FOR KPI CARDS & CHARTS
  // ============================================================================
  const metrics = useMemo(() => {
    const totalPersonnel = Math.max(filteredPersonnel.length, filteredMedicalRecords.length);
    const uniqueExaminedCodes = new Set(
      filteredPeriodicExams.map(e => e.employeeCode || e.recordId).filter(Boolean)
    );
    const examinedCount = uniqueExaminedCodes.size || filteredPeriodicExams.length;
    const examCoveragePercent = totalPersonnel > 0 ? Math.min(100, Math.round((examinedCount / totalPersonnel) * 100)) : 0;

    // Fitness Breakdown
    const fitCount = filteredPeriodicExams.filter(e => e.status === 'fit').length;
    const conditionalCount = filteredPeriodicExams.filter(e => e.status === 'fit_with_limitations').length;
    const specialistCount = filteredPeriodicExams.filter(e => e.status === 'needs_specialist' || e.status === 'under_review').length;
    const unfitCount = filteredPeriodicExams.filter(e => e.status === 'unfit').length;
    const fitRatePercent = filteredPeriodicExams.length > 0 ? Math.round((fitCount / filteredPeriodicExams.length) * 100) : 0;

    // Clinic Statistics
    const clinicStats = clinicService.calculateStatistics(filteredClinicVisits, todayJalali);

    // Nutrition & High-Risk Statistics
    const nutritionStats = nutritionService.calculateStatistics(filteredNutritionRecords);
    const highRiskBmiCount = highRiskProfiles.filter(p => p.riskCategories.some(c => c.category === 'bmi_obese')).length;
    const highRiskFattyLiverCount = highRiskProfiles.filter(p => p.riskCategories.some(c => c.category === 'fatty_liver')).length;
    const highRiskUrgentCount = highRiskProfiles.filter(p => p.riskCategories.some(c => c.category === 'clinical_urgent')).length;
    const highRiskFollowUpDueCount = highRiskProfiles.filter(p => p.riskCategories.some(c => c.category === 'followup_due')).length;

    // Checklists Statistics
    const checklistAvgScore =
      filteredChecklists.length > 0
        ? Math.round(filteredChecklists.reduce((s, c) => s + (Number(c.scorePercent) || 0), 0) / filteredChecklists.length)
        : 0;
    const checklistActionReqCount = filteredChecklists.filter(c => c.status === 'ACTION_REQUIRED' || c.failedCount > 0).length;

    // Environment & Monitoring Statistics
    const totalEnvPoints = filteredEnvMonitoring.length + filteredWastewater.length + filteredWaterSoil.length;
    const compliantEnvPoints =
      filteredEnvMonitoring.filter(m => m.complianceStatus === 'compliant').length +
      filteredWastewater.filter(w => w.complianceStatus === 'compliant').length +
      filteredWaterSoil.filter(ws => ws.complianceStatus === 'compliant').length;
    const envCompliancePercent = totalEnvPoints > 0 ? Math.round((compliantEnvPoints / totalEnvPoints) * 100) : 0;
    const nonCompliantEnvCount = Math.max(0, totalEnvPoints - compliantEnvPoints);

    // Air & ETP Wastewater
    const latestAir = filteredAirQuality[0] || null;
    const latestWastewater =
      filteredWastewater.find(w => w.parameter.toLowerCase().includes('cod')) || filteredWastewater[0] || null;

    // Waste Management
    const totalWasteQty = Number(filteredWasteRecords.reduce((s, w) => s + (Number(w.quantity) || 0), 0).toFixed(1));
    const hazardousWasteQty = Number(
      filteredWasteRecords.filter(w => w.isHazardous || w.category.includes('خطرناک')).reduce((s, w) => s + (Number(w.quantity) || 0), 0).toFixed(1)
    );
    const recycledWasteQty = Number(
      filteredWasteRecords.filter(w => w.category === 'پسماند قابل بازیافت' || w.status === 'بازیافت کامل').reduce((s, w) => s + (Number(w.quantity) || 0), 0).toFixed(1)
    );
    const wasteRecoveryRate = totalWasteQty > 0 ? Math.round((recycledWasteQty / totalWasteQty) * 100) : 0;

    // 5S & CAPA
    const fiveSAvgScore =
      filteredFiveSInspections.length > 0
        ? Math.round(filteredFiveSInspections.reduce((s, i) => s + (Number(i.scores?.total) || 0), 0) / filteredFiveSInspections.length)
        : 0;
    const openEnvNcs = filteredEnvNcs.filter(n => !String(n.status).includes('بسته')).length;
    const openFiveSNcs = filteredFiveSNcs.filter(n => n.status === 'open' || n.status === 'in_progress' || n.status === 'overdue').length;
    const totalOpenNcs = openEnvNcs + openFiveSNcs + checklistActionReqCount;

    return {
      totalPersonnel,
      examinedCount,
      examCoveragePercent,
      fitCount,
      conditionalCount,
      specialistCount,
      unfitCount,
      fitRatePercent,
      clinicStats,
      nutritionStats,
      highRiskTotal: highRiskProfiles.length,
      highRiskBmiCount,
      highRiskFattyLiverCount,
      highRiskUrgentCount,
      highRiskFollowUpDueCount,
      checklistAvgScore,
      checklistActionReqCount,
      totalEnvPoints,
      compliantEnvPoints,
      envCompliancePercent,
      nonCompliantEnvCount,
      latestAir,
      latestWastewater,
      totalWasteQty,
      hazardousWasteQty,
      recycledWasteQty,
      wasteRecoveryRate,
      fiveSAvgScore,
      totalOpenNcs,
      openEnvNcs,
      openFiveSNcs
    };
  }, [
    filteredPersonnel,
    filteredMedicalRecords,
    filteredPeriodicExams,
    filteredClinicVisits,
    filteredNutritionRecords,
    highRiskProfiles,
    filteredChecklists,
    filteredEnvMonitoring,
    filteredWastewater,
    filteredWaterSoil,
    filteredAirQuality,
    filteredWasteRecords,
    filteredFiveSInspections,
    filteredEnvNcs,
    filteredFiveSNcs,
    todayJalali
  ]);

  // ============================================================================
  // DATA-DRIVEN KPI CARDS CONFIGURATION (Zero Duplicate JSX)
  // ============================================================================
  const allKpiCards: KpiCardItem[] = useMemo(
    () => [
      // --- HEALTH DOMAIN CARDS ---
      {
        id: 'periodic-exams-coverage',
        domain: 'health',
        title: isFa ? 'معاینات ادواری طب کار' : 'Periodic Medical Exams',
        value: filteredPeriodicExams.length,
        unit: isFa ? 'معاینه' : 'Exams',
        subtitle: isFa
          ? `پوشش ${metrics.examCoveragePercent}٪ از ${metrics.totalPersonnel} پرونده سلامت`
          : `${metrics.examCoveragePercent}% coverage of ${metrics.totalPersonnel} personnel`,
        badgeText: isFa ? `پوشش ${metrics.examCoveragePercent}٪` : `${metrics.examCoveragePercent}%`,
        badgeTone: metrics.examCoveragePercent >= 80 ? 'emerald' : 'amber',
        progressPercent: metrics.examCoveragePercent,
        icon: Stethoscope,
        accentTone: 'teal',
        targetSection: 'periodic-exams'
      },
      {
        id: 'occupational-fitness',
        domain: 'health',
        title: isFa ? 'صلاحیت شغلی بلامانع (Fit)' : 'Occupational Fitness Rate',
        value: `${metrics.fitRatePercent}%`,
        subtitle: isFa
          ? `${metrics.fitCount} بلامانع | ${metrics.conditionalCount} مشروط | ${metrics.specialistCount + metrics.unfitCount} نیازمند بررسی`
          : `${metrics.fitCount} Fit | ${metrics.conditionalCount} Conditional`,
        badgeText: `${metrics.fitCount} ${isFa ? 'نفر' : 'Fit'}`,
        badgeTone: 'emerald',
        progressPercent: metrics.fitRatePercent,
        icon: ShieldCheck,
        accentTone: 'emerald',
        targetSection: 'periodic-exams'
      },
      {
        id: 'clinic-visits',
        domain: 'health',
        title: isFa ? 'بهداری و مراجعات سرپایی' : 'Clinic & Outpatient Visits',
        value: metrics.clinicStats.totalVisits,
        unit: isFa ? 'مراجعه' : 'Visits',
        subtitle: isFa
          ? `${metrics.clinicStats.workRelatedCount} مراجعه شغلی | ${metrics.clinicStats.ambulanceDispatchCount} اعزام آمبولانس | ${metrics.clinicStats.totalMedicalRestDays} روز استراحت`
          : `${metrics.clinicStats.workRelatedCount} Work-related | ${metrics.clinicStats.ambulanceDispatchCount} Ambulance`,
        badgeText:
          metrics.clinicStats.todayVisits > 0
            ? `${metrics.clinicStats.todayVisits} ${isFa ? 'امروز' : 'Today'}`
            : isFa
            ? 'ثبت سرپایی'
            : 'Active',
        badgeTone: metrics.clinicStats.ambulanceDispatchCount > 0 ? 'rose' : 'teal',
        icon: HeartPulse,
        accentTone: 'rose',
        targetSection: 'clinic'
      },
      {
        id: 'nutrition-high-risk',
        domain: 'health',
        title: isFa ? 'کارشناس تغذیه و پرسنل پرخطر' : 'Nutrition & High-Risk Cases',
        value: metrics.highRiskTotal,
        unit: isFa ? 'نفر پرخطر' : 'High-Risk',
        subtitle: isFa
          ? `BMI≥30: ${metrics.highRiskBmiCount} | کبد چرب ۲و۳: ${metrics.highRiskFattyLiverCount} | مشاوره: ${filteredNutritionRecords.length}`
          : `BMI>=30: ${metrics.highRiskBmiCount} | Fatty Liver G2/3: ${metrics.highRiskFattyLiverCount}`,
        badgeText:
          metrics.highRiskUrgentCount > 0
            ? `${metrics.highRiskUrgentCount} ${isFa ? 'فوری' : 'Urgent'}`
            : `${filteredNutritionRecords.length} ${isFa ? 'مشاوره' : 'Consults'}`,
        badgeTone: metrics.highRiskTotal > 0 ? 'amber' : 'emerald',
        icon: Apple,
        accentTone: 'amber',
        targetSection: 'nutrition'
      },
      {
        id: 'non-periodic-exams',
        domain: 'health',
        title: isFa ? 'معاینات غیر دوره‌ای و اختصاصی' : 'Non-Periodic Medical Exams',
        value: filteredNonPeriodicExams.length,
        unit: isFa ? 'مورد' : 'Cases',
        subtitle: isFa
          ? 'بدو استخدام، بازگشت به کار و تغییر شغل'
          : 'Pre-employment, return-to-work & job transfer',
        badgeText: isFa ? 'گواهی سلامت' : 'Certificates',
        badgeTone: 'indigo',
        icon: ClipboardCheck,
        accentTone: 'indigo',
        targetSection: 'non-periodic-exams'
      },
      {
        id: 'operational-checklists',
        domain: 'health',
        title: isFa ? 'چک‌لیست‌های عملیاتی بهداشت' : 'Operational Health Checklists',
        value: filteredChecklists.length,
        unit: isFa ? 'بازرسی' : 'Audits',
        subtitle: isFa
          ? `میانگین امتیاز: ${metrics.checklistAvgScore}٪ | ${metrics.checklistActionReqCount} نیازمند اقدام`
          : `Avg Score: ${metrics.checklistAvgScore}% | ${metrics.checklistActionReqCount} Action Req`,
        badgeText: `${metrics.checklistAvgScore}%`,
        badgeTone: metrics.checklistAvgScore >= 80 ? 'emerald' : 'amber',
        progressPercent: metrics.checklistAvgScore,
        icon: CheckSquare,
        accentTone: 'cyan',
        targetSection: 'health-env-checklists'
      },

      // --- ENVIRONMENT DOMAIN CARDS ---
      {
        id: 'env-monitoring-compliance',
        domain: 'environment',
        title: isFa ? 'پایش‌های محیط‌زیستی و انطباق' : 'Environmental Monitoring',
        value: metrics.totalEnvPoints,
        unit: isFa ? 'پایش' : 'Samples',
        subtitle: isFa
          ? `${metrics.compliantEnvPoints} منطبق با استاندارد | ${metrics.nonCompliantEnvCount} فراتر از حد مجاز`
          : `${metrics.compliantEnvPoints} Compliant | ${metrics.nonCompliantEnvCount} Exceeded`,
        badgeText: isFa ? `انطباق ${metrics.envCompliancePercent}٪` : `${metrics.envCompliancePercent}%`,
        badgeTone: metrics.envCompliancePercent >= 85 ? 'emerald' : 'rose',
        progressPercent: metrics.envCompliancePercent,
        icon: Wind,
        accentTone: 'emerald',
        targetSection: 'env-monitoring'
      },
      {
        id: 'air-stacks-soil',
        domain: 'environment',
        title: isFa ? 'کیفیت هوا، دودکش (CEMS) و خاک' : 'Air Quality, Stacks & Soil',
        value: metrics.latestAir ? metrics.latestAir.aqi : filteredEnvMonitoring.filter(m => m.monitoringType === 'stacks' || m.monitoringType === 'air').length,
        unit: metrics.latestAir ? 'AQI' : isFa ? 'سنجش' : 'Tests',
        subtitle: metrics.latestAir
          ? `${metrics.latestAir.stationName} (${metrics.latestAir.aqiCategory})`
          : isFa
          ? `${filteredWaterSoil.length} پایش آب و خاک | ${filteredEnvMonitoring.filter(m => m.monitoringType === 'stacks').length} دودکش`
          : `${filteredWaterSoil.length} Water/Soil records`,
        badgeText: metrics.latestAir ? metrics.latestAir.aqiCategory : isFa ? 'پایش CEMS' : 'CEMS',
        badgeTone: 'teal',
        icon: Globe,
        accentTone: 'teal',
        targetSection: 'air-water-soil'
      },
      {
        id: 'wastewater-etp',
        domain: 'environment',
        title: isFa ? 'مدیریت پساب و تصفیه‌خانه (ETP)' : 'Wastewater Treatment (ETP)',
        value: metrics.latestWastewater ? metrics.latestWastewater.measuredValue : filteredWastewater.length,
        unit: metrics.latestWastewater ? metrics.latestWastewater.unit : isFa ? 'آزمایش' : 'Tests',
        subtitle: metrics.latestWastewater
          ? `${metrics.latestWastewater.parameter} (حد مجاز: ${metrics.latestWastewater.standardLimit}) - ${metrics.latestWastewater.samplingPoint}`
          : isFa
          ? 'پایش کیفی COD, BOD5, TSS و pH خروجی'
          : 'Effluent COD, BOD5, TSS & pH monitoring',
        badgeText: `${filteredWastewater.length} ${isFa ? 'نمونه' : 'Samples'}`,
        badgeTone: 'blue',
        icon: Droplets,
        accentTone: 'blue',
        targetSection: 'wastewater'
      },
      {
        id: 'waste-management-emp',
        domain: 'environment',
        title: isFa ? 'مدیریت پسماند صنعتی (EMP)' : 'Industrial Waste (EMP)',
        value: metrics.totalWasteQty,
        unit: isFa ? 'تن' : 'Tons',
        subtitle: isFa
          ? `پسماند ویژه/خطرناک: ${metrics.hazardousWasteQty} تن | بازیافت: ${metrics.wasteRecoveryRate}٪`
          : `Hazardous: ${metrics.hazardousWasteQty}t | Recovery: ${metrics.wasteRecoveryRate}%`,
        badgeText: isFa ? `بازیافت ${metrics.wasteRecoveryRate}٪` : `${metrics.wasteRecoveryRate}% Recycled`,
        badgeTone: 'amber',
        progressPercent: metrics.wasteRecoveryRate,
        icon: Recycle,
        accentTone: 'amber',
        targetSection: 'waste-management'
      },
      {
        id: 'five-s-audit',
        domain: 'environment',
        title: isFa ? 'نظام آراستگی و ساماندهی ۵S' : '5S Workplace Organization',
        value: `${metrics.fiveSAvgScore}%`,
        subtitle: isFa
          ? `${filteredFiveSInspections.length} ممیزی ثبت‌شده | ${metrics.openFiveSNcs} عدم انطباق باز ۵S`
          : `${filteredFiveSInspections.length} Audits | ${metrics.openFiveSNcs} Open 5S NCs`,
        badgeText: `${filteredFiveSInspections.length} ${isFa ? 'ممیزی' : 'Audits'}`,
        badgeTone: metrics.fiveSAvgScore >= 80 ? 'emerald' : 'amber',
        progressPercent: metrics.fiveSAvgScore,
        icon: CheckSquare,
        accentTone: 'emerald',
        targetSection: 'five-s'
      },
      {
        id: 'env-health-capa',
        domain: 'environment',
        title: isFa ? 'عدم انطباق‌ها و اقدامات اصلاحی' : 'Open Non-Conformances & CAPA',
        value: metrics.totalOpenNcs,
        unit: isFa ? 'مورد باز' : 'Open',
        subtitle: isFa
          ? `محیط‌زیست: ${metrics.openEnvNcs} | ۵S: ${metrics.openFiveSNcs} | چک‌لیست بهداشت: ${metrics.checklistActionReqCount}`
          : `Env: ${metrics.openEnvNcs} | 5S: ${metrics.openFiveSNcs} | Checklists: ${metrics.checklistActionReqCount}`,
        badgeText: metrics.totalOpenNcs === 0 ? (isFa ? 'بدون انحراف باز' : 'All Clear') : isFa ? 'نیازمند پیگیری' : 'Action Needed',
        badgeTone: metrics.totalOpenNcs > 0 ? 'rose' : 'emerald',
        icon: ShieldAlert,
        accentTone: 'rose',
        targetSection: 'env-reports'
      }
    ],
    [
      isFa,
      filteredPeriodicExams.length,
      metrics,
      filteredNutritionRecords.length,
      filteredNonPeriodicExams.length,
      filteredChecklists.length,
      filteredEnvMonitoring,
      filteredWaterSoil.length,
      filteredWastewater.length,
      filteredFiveSInspections.length
    ]
  );

  const visibleKpiCards = useMemo(() => {
    if (domainFilter === 'all') return allKpiCards;
    return allKpiCards.filter(c => c.domain === domainFilter);
  }, [allKpiCards, domainFilter]);

  // ============================================================================
  // CHART DATASETS (100% Derived from Submodule Records)
  // ============================================================================

  // Chart 1: Occupational Fitness & Non-Periodic Exam Status Distribution
  const fitnessChartData = useMemo(() => {
    const items = [
      {
        name: isFa ? 'بلامانع / مناسب کار' : 'Fit for Duty',
        value: metrics.fitCount + filteredNonPeriodicExams.filter(e => e.status === 'fit').length,
        color: '#10b981'
      },
      {
        name: isFa ? 'مشروط / با محدودیت' : 'Fit with Limitations',
        value: metrics.conditionalCount + filteredNonPeriodicExams.filter(e => e.status === 'fit_with_limitations').length,
        color: '#f59e0b'
      },
      {
        name: isFa ? 'نیازمند ارزیابی تخصصی' : 'Specialist Review',
        value: metrics.specialistCount + filteredNonPeriodicExams.filter(e => e.status === 'needs_specialist' || e.status === 'under_review').length,
        color: '#6366f1'
      },
      {
        name: isFa ? 'عدم صلاحیت شغلی' : 'Unfit',
        value: metrics.unfitCount + filteredNonPeriodicExams.filter(e => e.status === 'unfit').length,
        color: '#ef4444'
      }
    ];
    return items.filter(i => i.value > 0);
  }, [isFa, metrics, filteredNonPeriodicExams]);

  // Chart 2: Nutrition High-Risk Categories & BMI Breakdown (from Nutrition & Periodic Exams)
  const nutritionHighRiskChartData = useMemo(() => {
    // Also compute BMI categories across periodic exams + nutrition records
    let normalBmi = metrics.nutritionStats.bmiDistribution.normal;
    let overweightBmi = metrics.nutritionStats.bmiDistribution.overweight;
    if (normalBmi === 0 && overweightBmi === 0 && filteredPeriodicExams.length > 0) {
      filteredPeriodicExams.forEach(e => {
        const b = Number(e.findings?.bmi || (e as any)?.bmi || 0);
        if (b >= 18.5 && b < 25) normalBmi++;
        else if (b >= 25 && b < 30) overweightBmi++;
      });
    }

    return [
      {
        category: isFa ? 'چاقی (BMI≥30)' : 'Obese (BMI>=30)',
        count: metrics.highRiskBmiCount,
        fill: '#f59e0b'
      },
      {
        category: isFa ? 'کبد چرب گرید ۲و۳' : 'Fatty Liver G2/3',
        count: metrics.highRiskFattyLiverCount,
        fill: '#ef4444'
      },
      {
        category: isFa ? 'اولویت بالینی فوری' : 'Clinical Urgent',
        count: metrics.highRiskUrgentCount,
        fill: '#e11d48'
      },
      {
        category: isFa ? 'پیگیری فرارسیده' : 'Follow-up Due',
        count: metrics.highRiskFollowUpDueCount,
        fill: '#6366f1'
      },
      {
        category: isFa ? 'اضافه وزن (25-30)' : 'Overweight',
        count: overweightBmi,
        fill: '#0ea5e9'
      },
      {
        category: isFa ? 'وزن نرمال' : 'Normal BMI',
        count: normalBmi,
        fill: '#10b981'
      }
    ];
  }, [isFa, metrics, filteredPeriodicExams]);

  const hasNutritionOrExamBmiData = useMemo(
    () => nutritionHighRiskChartData.some(d => d.count > 0),
    [nutritionHighRiskChartData]
  );

  // Chart 3: Clinic Triage & Visit Outcomes Breakdown
  const clinicChartData = useMemo(() => {
    const tc = metrics.clinicStats.triageCounts;
    return [
      {
        level: isFa ? 'سطح ۱ (احیاء)' : 'L1 Resuscitation',
        count: tc[1] || 0,
        fill: '#ef4444'
      },
      {
        level: isFa ? 'سطح ۲ (اورژانسی)' : 'L2 Emergent',
        count: tc[2] || 0,
        fill: '#f97316'
      },
      {
        level: isFa ? 'سطح ۳ (فوری)' : 'L3 Urgent',
        count: tc[3] || 0,
        fill: '#f59e0b'
      },
      {
        level: isFa ? 'سطح ۴ (نیمه‌فوری)' : 'L4 Less Urgent',
        count: tc[4] || 0,
        fill: '#0ea5e9'
      },
      {
        level: isFa ? 'سطح ۵ (غیرفوری)' : 'L5 Non-Urgent',
        count: tc[5] || 0,
        fill: '#10b981'
      },
      {
        level: isFa ? 'مرتبط با کار' : 'Work-Related',
        count: metrics.clinicStats.workRelatedCount,
        fill: '#6366f1'
      }
    ];
  }, [isFa, metrics.clinicStats]);

  // Chart 4: Environmental Monitoring Compliance by Media (Air, Stacks, Water, Wastewater, Soil, Noise)
  const envMonitoringChartData = useMemo(() => {
    const categories: Array<{
      key: string;
      label: string;
      compliant: number;
      nonCompliant: number;
    }> = [
      {
        key: 'air',
        label: isFa ? 'هوای محیطی' : 'Ambient Air',
        compliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'air' && m.complianceStatus === 'compliant').length +
          filteredAirQuality.filter(a => a.status === 'compliant').length,
        nonCompliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'air' && m.complianceStatus !== 'compliant').length +
          filteredAirQuality.filter(a => a.status !== 'compliant').length
      },
      {
        key: 'stacks',
        label: isFa ? 'دودکش (CEMS)' : 'Stacks CEMS',
        compliant: filteredEnvMonitoring.filter(m => m.monitoringType === 'stacks' && m.complianceStatus === 'compliant').length,
        nonCompliant: filteredEnvMonitoring.filter(m => m.monitoringType === 'stacks' && m.complianceStatus !== 'compliant').length
      },
      {
        key: 'wastewater',
        label: isFa ? 'پساب (ETP)' : 'Wastewater ETP',
        compliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'wastewater' && m.complianceStatus === 'compliant').length +
          filteredWastewater.filter(w => w.complianceStatus === 'compliant').length,
        nonCompliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'wastewater' && m.complianceStatus !== 'compliant').length +
          filteredWastewater.filter(w => w.complianceStatus !== 'compliant').length
      },
      {
        key: 'water',
        label: isFa ? 'منابع آب' : 'Water',
        compliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'water' && m.complianceStatus === 'compliant').length +
          filteredWaterSoil.filter(w => w.type === 'water' && w.complianceStatus === 'compliant').length,
        nonCompliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'water' && m.complianceStatus !== 'compliant').length +
          filteredWaterSoil.filter(w => w.type === 'water' && w.complianceStatus !== 'compliant').length
      },
      {
        key: 'soil',
        label: isFa ? 'خاک' : 'Soil',
        compliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'soil' && m.complianceStatus === 'compliant').length +
          filteredWaterSoil.filter(w => w.type === 'soil' && w.complianceStatus === 'compliant').length,
        nonCompliant:
          filteredEnvMonitoring.filter(m => m.monitoringType === 'soil' && m.complianceStatus !== 'compliant').length +
          filteredWaterSoil.filter(w => w.type === 'soil' && w.complianceStatus !== 'compliant').length
      },
      {
        key: 'noise',
        label: isFa ? 'صوت محیطی' : 'Noise',
        compliant: filteredEnvMonitoring.filter(m => m.monitoringType === 'noise' && m.complianceStatus === 'compliant').length,
        nonCompliant: filteredEnvMonitoring.filter(m => m.monitoringType === 'noise' && m.complianceStatus !== 'compliant').length
      }
    ];
    return categories;
  }, [isFa, filteredEnvMonitoring, filteredAirQuality, filteredWastewater, filteredWaterSoil]);

  const hasEnvChartData = useMemo(
    () => envMonitoringChartData.some(c => c.compliant > 0 || c.nonCompliant > 0),
    [envMonitoringChartData]
  );

  // Chart 5: Industrial Waste Breakdown by Category
  const wasteCategoryChartData = useMemo(() => {
    const groups: Record<string, { label: string; qty: number; color: string }> = {
      hazardous: { label: isFa ? 'پسماند خطرناک' : 'Hazardous', qty: 0, color: '#ef4444' },
      industrial: { label: isFa ? 'صنعتی غیرخطرناک' : 'Non-Hazardous Ind.', qty: 0, color: '#f59e0b' },
      recyclable: { label: isFa ? 'قابل بازیافت' : 'Recyclable', qty: 0, color: '#10b981' },
      general: { label: isFa ? 'عادی و بهداشتی' : 'General/Sanitary', qty: 0, color: '#0ea5e9' },
      medical: { label: isFa ? 'بیولوژیک / بهداری' : 'Bio/Medical', qty: 0, color: '#8b5cf6' }
    };

    filteredWasteRecords.forEach(w => {
      const q = Number(w.quantity) || 0;
      if (w.category.includes('خطرناک') && !w.category.includes('غیرخطرناک')) {
        groups.hazardous.qty = Number((groups.hazardous.qty + q).toFixed(2));
      } else if (w.category.includes('غیرخطرناک')) {
        groups.industrial.qty = Number((groups.industrial.qty + q).toFixed(2));
      } else if (w.category.includes('بازیافت')) {
        groups.recyclable.qty = Number((groups.recyclable.qty + q).toFixed(2));
      } else if (w.category.includes('بیولوژیک') || w.category.includes('بهداری')) {
        groups.medical.qty = Number((groups.medical.qty + q).toFixed(2));
      } else {
        groups.general.qty = Number((groups.general.qty + q).toFixed(2));
      }
    });

    return Object.values(groups).filter(g => g.qty > 0);
  }, [isFa, filteredWasteRecords]);

  // Chart 6: 5S Pillars & Operational Checklists Radar/Bar Data
  const fiveSAndChecklistChartData = useMemo(() => {
    const count = filteredFiveSInspections.length;
    const avgPillar = (key: 'seiri' | 'seiton' | 'seiso' | 'seiketsu' | 'shitsuke') =>
      count > 0
        ? Math.round(filteredFiveSInspections.reduce((s, i) => s + (Number(i.scores?.[key]) || 0), 0) / count)
        : 0;

    return [
      { subject: isFa ? '۱. ساماندهی (Seiri)' : '1. Sort', score: avgPillar('seiri'), fullMark: 100 },
      { subject: isFa ? '۲. نظم (Seiton)' : '2. Set in Order', score: avgPillar('seiton'), fullMark: 100 },
      { subject: isFa ? '۳. پاکیزگی (Seiso)' : '3. Shine', score: avgPillar('seiso'), fullMark: 100 },
      { subject: isFa ? '۴. استاندارد (Seiketsu)' : '4. Standardize', score: avgPillar('seiketsu'), fullMark: 100 },
      { subject: isFa ? '۵. انضباط (Shitsuke)' : '5. Sustain', score: avgPillar('shitsuke'), fullMark: 100 },
      { subject: isFa ? 'چک‌لیست بهداشت' : 'Hygiene Checklists', score: metrics.checklistAvgScore, fullMark: 100 }
    ];
  }, [isFa, filteredFiveSInspections, metrics.checklistAvgScore]);

  const hasFiveSOrChecklistData = useMemo(
    () => filteredFiveSInspections.length > 0 || filteredChecklists.length > 0,
    [filteredFiveSInspections.length, filteredChecklists.length]
  );

  // ============================================================================
  // ALL 12 SUBMODULES DIRECTORY MATRIX (Zero Duplicate JSX)
  // ============================================================================
  const submoduleSummaries: SubmoduleSummaryItem[] = useMemo(
    () => [
      {
        key: 'clinic',
        domain: 'health',
        title: isFa ? 'بهداری و مراجعات سرپایی' : 'Dispensary & Clinic Visits',
        subtitle: isFa ? 'تریاژ، علائم حیاتی، دارو و اعزام' : 'Triage, vitals & emergency dispatch',
        primaryMetric: `${metrics.clinicStats.totalVisits} ${isFa ? 'مراجعه' : 'Visits'}`,
        secondaryMetric: `${metrics.clinicStats.workRelatedCount} ${isFa ? 'مورد شغلی' : 'Work-related'}`,
        statusTone: 'rose',
        icon: HeartPulse
      },
      {
        key: 'periodic-exams',
        domain: 'health',
        title: isFa ? 'معاینات ادواری طب کار' : 'Periodic Medical Exams',
        subtitle: isFa ? 'پرونده سلامت، آزمایشگاه، BMI و روند سنواتی' : 'Health dossiers, labs, BMI & YoY trends',
        primaryMetric: `${filteredPeriodicExams.length} ${isFa ? 'معاینه' : 'Exams'}`,
        secondaryMetric: `${isFa ? 'پوشش' : 'Coverage'} ${metrics.examCoveragePercent}٪`,
        statusTone: 'teal',
        icon: Stethoscope
      },
      {
        key: 'non-periodic-exams',
        domain: 'health',
        title: isFa ? 'معاینات غیر دوره‌ای' : 'Non-Periodic Medical Exams',
        subtitle: isFa ? 'بدو استخدام، بازگشت به کار و تغییر شغل' : 'Pre-employment & return-to-work',
        primaryMetric: `${filteredNonPeriodicExams.length} ${isFa ? 'پرونده' : 'Records'}`,
        secondaryMetric: `${filteredNonPeriodicExams.filter(e => e.status === 'fit').length} ${isFa ? 'بلامانع' : 'Fit'}`,
        statusTone: 'indigo',
        icon: ClipboardCheck
      },
      {
        key: 'nutrition',
        domain: 'health',
        title: isFa ? 'کارشناس تغذیه و افراد پرخطر' : 'Nutrition & High-Risk Follow-up',
        subtitle: isFa ? 'مشاوره رژیم، کبد چرب، BMI≥30 و پیگیری هوشمند' : 'Diet plans, fatty liver & high-risk tracking',
        primaryMetric: `${metrics.highRiskTotal} ${isFa ? 'نفر پرخطر' : 'High-Risk'}`,
        secondaryMetric: `${filteredNutritionRecords.length} ${isFa ? 'پرونده تغذیه' : 'Consultations'}`,
        statusTone: 'emerald',
        icon: Apple
      },
      {
        key: 'health-env-checklists',
        domain: 'health',
        title: isFa ? 'چک‌لیست‌های عملیاتی بهداشت' : 'Operational Health Checklists',
        subtitle: isFa ? 'اماکن، آبدارخانه، رستوران، آمبولانس و تسهیلات' : 'Premises, kitchen, ambulance & sanitation',
        primaryMetric: `${filteredChecklists.length} ${isFa ? 'بازرسی' : 'Inspections'}`,
        secondaryMetric: `${isFa ? 'انطباق' : 'Score'} ${metrics.checklistAvgScore}٪`,
        statusTone: 'teal',
        icon: CheckSquare
      },
      {
        key: 'env-dashboard',
        domain: 'environment',
        title: isFa ? 'داشبورد تخصصی پایش محیط‌زیست' : 'Environment Monitoring Dashboard',
        subtitle: isFa ? 'شاخص‌های کلان عملکردی و خوداظهاری محیط‌زیست' : 'Macro environmental KPIs & telemetry',
        primaryMetric: `${metrics.envCompliancePercent}٪ ${isFa ? 'انطباق' : 'Compliance'}`,
        secondaryMetric: `${metrics.totalEnvPoints} ${isFa ? 'نقطه پایش' : 'Points'}`,
        statusTone: 'emerald',
        icon: BarChart3
      },
      {
        key: 'env-monitoring',
        domain: 'environment',
        title: isFa ? 'پایش‌های محیط‌زیستی' : 'Environmental Monitoring',
        subtitle: isFa ? 'سنجش آلاینده‌های هوا، صوت و حدود مجاز' : 'Air, noise & pollutant measurements',
        primaryMetric: `${filteredEnvMonitoring.length} ${isFa ? 'سنجش' : 'Records'}`,
        secondaryMetric: `${filteredEnvMonitoring.filter(m => m.complianceStatus === 'compliant').length} ${isFa ? 'مجاز' : 'Compliant'}`,
        statusTone: 'blue',
        icon: Wind
      },
      {
        key: 'waste-management',
        domain: 'environment',
        title: isFa ? 'مدیریت پسماند صنعتی (EMP)' : 'Industrial Waste (EMP)',
        subtitle: isFa ? 'تفکیک، انبارش، مانیفست و امحاء پسماند ویژه' : 'Segregation, manifests & disposal',
        primaryMetric: `${metrics.totalWasteQty} ${isFa ? 'تن' : 'Tons'}`,
        secondaryMetric: `${metrics.hazardousWasteQty} ${isFa ? 'تن خطرناک' : 't Hazardous'}`,
        statusTone: 'amber',
        icon: Recycle
      },
      {
        key: 'wastewater',
        domain: 'environment',
        title: isFa ? 'مدیریت پساب (ETP)' : 'Wastewater Treatment (ETP)',
        subtitle: isFa ? 'تصفیه‌خانه پساب و شاخص‌های COD / BOD5 / TSS' : 'ETP outfall & COD/BOD5 quality',
        primaryMetric: `${filteredWastewater.length} ${isFa ? 'آزمایش' : 'Tests'}`,
        secondaryMetric: metrics.latestWastewater ? `${metrics.latestWastewater.parameter}: ${metrics.latestWastewater.measuredValue}` : isFa ? 'ثبت آزمایش' : 'Active',
        statusTone: 'blue',
        icon: Droplets
      },
      {
        key: 'air-water-soil',
        domain: 'environment',
        title: isFa ? 'پایش دودکش، آب و خاک' : 'Stacks, Water & Soil',
        subtitle: isFa ? 'سامانه CEMS دودکش‌ها، منابع آب و آنالیز خاک' : 'CEMS stacks, water & soil analysis',
        primaryMetric: metrics.latestAir ? `AQI ${metrics.latestAir.aqi}` : `${filteredWaterSoil.length} ${isFa ? 'مورد' : 'Records'}`,
        secondaryMetric: `${filteredEnvMonitoring.filter(m => m.monitoringType === 'stacks').length} ${isFa ? 'پایش دودکش' : 'Stack tests'}`,
        statusTone: 'teal',
        icon: Globe
      },
      {
        key: 'five-s',
        domain: 'environment',
        title: isFa ? 'ساماندهی ۵S محیط کار' : '5S Work Environment',
        subtitle: isFa ? 'ممیزی ۵ اصل آراستگی و رتبه‌بندی واحدها' : '5S audits, unit rankings & CAPA',
        primaryMetric: `${metrics.fiveSAvgScore}٪ ${isFa ? 'امتیاز' : 'Score'}`,
        secondaryMetric: `${filteredFiveSInspections.length} ${isFa ? 'ممیزی' : 'Audits'}`,
        statusTone: 'emerald',
        icon: CheckSquare
      },
      {
        key: 'env-reports',
        domain: 'environment',
        title: isFa ? 'گزارش‌های رسمی محیط‌زیست' : 'Official Environment Reports',
        subtitle: isFa ? 'گزارش‌های آماری، خروجی اکسل و عدم انطباق‌ها' : 'Regulatory exports & CAPA tracking',
        primaryMetric: `${filteredEnvNcs.length} ${isFa ? 'عدم انطباق' : 'NCs'}`,
        secondaryMetric: `${metrics.openEnvNcs} ${isFa ? 'پرونده باز' : 'Open'}`,
        statusTone: 'indigo',
        icon: FileSpreadsheet
      }
    ],
    [
      isFa,
      metrics,
      filteredPeriodicExams.length,
      filteredNonPeriodicExams,
      filteredNutritionRecords.length,
      filteredChecklists.length,
      filteredEnvMonitoring,
      filteredWastewater.length,
      filteredWaterSoil.length,
      filteredFiveSInspections.length,
      filteredEnvNcs.length
    ]
  );

  const visibleSubmodules = useMemo(() => {
    if (domainFilter === 'all') return submoduleSummaries;
    return submoduleSummaries.filter(s => s.domain === domainFilter);
  }, [submoduleSummaries, domainFilter]);

  return (
    <div className="w-full p-3 sm:p-4 md:p-6 space-y-5 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir={isFa ? 'rtl' : 'ltr'}>
      {/* ======================================================== */}
      {/* EXECUTIVE HEADER & DOMAIN / FILTER BAR */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-emerald-950 p-4 sm:p-6 rounded-3xl text-white shadow-md border border-slate-700/80 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl shrink-0">
              <Activity className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-xl md:text-2xl font-black tracking-tight truncate">
                  {isFa
                    ? 'داشبورد جامع مدیریتی واحد بهداشت و محیط‌زیست'
                    : 'Health & Environment Comprehensive Executive Dashboard'}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isFa ? 'خوانش مستقیم از ۱۲ زیرماژول' : 'Live 12-Submodule Sync'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {isFa
                  ? 'یکپارچه‌سازی برخط شاخص‌های کلیدی (KPI) و نمودارهای تحلیلی بهداری، معاینات طب کار، کارشناس تغذیه (افراد پرخطر)، چک‌لیست‌ها، پایش آلاینده‌ها، پساب، پسماند و ۵S'
                  : 'Real-time KPI cards and analytical charts directly synchronized with Clinic, Medical Exams, Nutrition, Checklists, Emissions, Wastewater, Waste & 5S.'}
              </p>
            </div>
          </div>

          {/* Action & Domain Switcher */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-white/10 text-xs font-bold">
              {(
                [
                  { id: 'all', labelFa: 'همه بخش‌ها (جامع)', labelEn: 'All Domains' },
                  { id: 'health', labelFa: 'بهداشت، طب کار و تغذیه', labelEn: 'Occupational Health' },
                  { id: 'environment', labelFa: 'محیط‌زیست و ۵S', labelEn: 'Environment & 5S' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDomainFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    domainFilter === tab.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {isFa ? tab.labelFa : tab.labelEn}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadAllAsyncSubmoduleData}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title={isFa ? 'به‌روزرسانی مستقیم اطلاعات از زیرماژول‌ها' : 'Refresh Live Data'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isFa ? 'به‌روزرسانی برخط' : 'Sync'}</span>
            </button>
          </div>
        </div>

        {/* Responsive Global Filter Bar inside Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/10 text-xs">
          {/* Year Filter */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-slate-300 font-bold shrink-0">{isFa ? 'سال پایش:' : 'Year:'}</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-800 text-white">
                {isFa ? 'همه سال‌های ثبت‌شده' : 'All Recorded Years'}
              </option>
              {availableYears.map(yr => (
                <option key={yr} value={yr} className="bg-slate-800 text-white">
                  {isFa ? `سال ${yr}` : `Year ${yr}`}
                </option>
              ))}
            </select>
          </div>

          {/* Organizational Unit / Site Filter */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10 sm:col-span-1 lg:col-span-2">
            <Building2 className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-slate-300 font-bold shrink-0">{isFa ? 'واحد / سایت:' : 'Unit / Site:'}</span>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full bg-transparent text-white font-bold outline-none cursor-pointer truncate"
            >
              <option value="all" className="bg-slate-800 text-white">
                {isFa ? 'همه واحدهای سازمانی و محل‌های خدمت' : 'All Organizational Units & Sites'}
              </option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept} className="bg-slate-800 text-white">
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Active Filter Status & Reset */}
          <div className="flex items-center justify-between gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-1.5 truncate">
              <Filter className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-slate-300 truncate">
                {selectedYear === 'all' && selectedDept === 'all'
                  ? isFa
                    ? 'نمایش کل داده‌های واحد'
                    : 'Showing all unit records'
                  : isFa
                  ? 'فیلتر فعال اعمال شد'
                  : 'Active filter applied'}
              </span>
            </div>
            {(selectedYear !== 'all' || selectedDept !== 'all' || domainFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedYear('all');
                  setSelectedDept('all');
                  setDomainFilter('all');
                }}
                className="text-[11px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer shrink-0"
              >
                {isFa ? 'پاک‌سازی فیلتر' : 'Reset'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: UNIFIED KPI CARDS GRID (Data-Driven) */}
      {/* ======================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
              {isFa
                ? 'شاخص‌های کلیدی عملکرد (KPI) زیرماژول‌های بهداشت و محیط‌زیست'
                : 'Key Performance Indicators (KPIs) Across Submodules'}
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {isFa ? `${visibleKpiCards.length} شاخص کلیدی فعال` : `${visibleKpiCards.length} Active KPIs`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {visibleKpiCards.map(card => (
            <ExecutiveKpiCard key={card.id} item={card} isFa={isFa} onNavigate={onNavigate} />
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 2: INTERACTIVE ANALYTICAL CHARTS GRID */}
      {/* ======================================================== */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm sm:text-base font-black text-slate-800 dark:text-white">
              {isFa
                ? 'نمودارهای تحلیلی و پایش بصری زیرماژول‌ها و تب‌ها'
                : 'Analytical Charts & Submodule Visual Telemetry'}
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            {isFa ? 'محاسبه مستقیم از رکوردهای ثبت‌شده در پایگاه داده' : 'Directly computed from database records'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* CHART 1: Occupational Fitness Breakdown (Periodic + Non-Periodic Exams) */}
          {(domainFilter === 'all' || domainFilter === 'health') && (
            <ChartPanelCard
              title={isFa ? 'توزیع نظریه نهایی و صلاحیت شغلی طب کار' : 'Occupational Medical Fitness Distribution'}
              subtitle={
                isFa
                  ? 'تجمیع نتایج معاینات ادواری و غیردوره‌ای (بلامانع، مشروط، تخصصی، عدم صلاحیت)'
                  : 'Combined Periodic & Non-Periodic exam fitness verdicts'
              }
              badgeText={`${filteredPeriodicExams.length + filteredNonPeriodicExams.length} ${isFa ? 'معاینه' : 'Exams'}`}
              icon={Stethoscope}
              iconColorClass="text-teal-600 dark:text-teal-400"
              targetSection="periodic-exams"
              targetLabel={isFa ? 'ورود به معاینات ادواری طب کار' : 'Open Periodic Exams'}
              isFa={isFa}
              hasData={fitnessChartData.length > 0}
              emptyText={isFa ? 'هنوز سابقه معاینه طب کار برای فیلتر انتخابی ثبت نشده است' : 'No medical exams recorded yet'}
              onNavigate={onNavigate}
            >
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={240} debounce={50}>
                <PieChart>
                  <Pie
                    data={fitnessChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {fitnessChartData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} ${isFa ? 'نفر' : 'Persons'}`, isFa ? 'تعداد' : 'Count']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: isFa ? 'rtl' : 'ltr' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanelCard>
          )}

          {/* CHART 2: Nutrition Specialist & High-Risk Personnel Categories */}
          {(domainFilter === 'all' || domainFilter === 'health') && (
            <ChartPanelCard
              title={isFa ? 'کارشناس تغذیه: بیماری‌های پرخطر، کبد چرب و BMI' : 'Nutrition: High-Risk Groups & BMI Breakdown'}
              subtitle={
                isFa
                  ? 'تفکیک افراد پرخطر (BMI≥30، کبد چرب گرید ۲و۳، اولویت بالینی فوری، موعد پیگیری)'
                  : 'High-risk categories from Nutrition & Periodic Medical Exams'
              }
              badgeText={`${metrics.highRiskTotal} ${isFa ? 'نفر پرخطر' : 'High-Risk'}`}
              icon={Apple}
              iconColorClass="text-emerald-600 dark:text-emerald-400"
              targetSection="nutrition"
              targetLabel={isFa ? 'ورود به زیرماژول کارشناس تغذیه' : 'Open Nutrition Module'}
              isFa={isFa}
              hasData={hasNutritionOrExamBmiData}
              emptyText={isFa ? 'داده‌ای در بخش مشاوره تغذیه یا شاخص BMI معاینات ثبت نشده است' : 'No nutrition or BMI records found'}
              onNavigate={onNavigate}
            >
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={240} debounce={50}>
                <BarChart data={nutritionHighRiskChartData} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} ${isFa ? 'نفر' : 'Persons'}`, isFa ? 'تعداد پرسنل' : 'Personnel']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: isFa ? 'rtl' : 'ltr' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={34}>
                    {nutritionHighRiskChartData.map((entry, idx) => (
                      <Cell key={`nut-bar-${idx}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanelCard>
          )}

          {/* CHART 3: Clinic & Outpatient Visits by Triage Level */}
          {(domainFilter === 'all' || domainFilter === 'health') && (
            <ChartPanelCard
              title={isFa ? 'بهداری: توزیع مراجعات سرپایی بر اساس سطح تریاژ' : 'Clinic: Visits by Triage Level & Work Relation'}
              subtitle={
                isFa
                  ? 'تفکیک سطوح تریاژ ESI (سطح ۱ تا ۵) و مراجعات ناشی از حوادث/بیماری شغلی'
                  : 'Outpatient triage distribution and work-related visits'
              }
              badgeText={`${metrics.clinicStats.totalVisits} ${isFa ? 'مراجعه' : 'Visits'}`}
              icon={HeartPulse}
              iconColorClass="text-rose-600 dark:text-rose-400"
              targetSection="clinic"
              targetLabel={isFa ? 'ورود به بهداری و مراجعات سرپایی' : 'Open Clinic Module'}
              isFa={isFa}
              hasData={filteredClinicVisits.length > 0}
              emptyText={isFa ? 'هنوز مراجعه‌ای در زیرماژول بهداری ثبت نشده است' : 'No clinic visits recorded yet'}
              onNavigate={onNavigate}
            >
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={240} debounce={50}>
                <BarChart data={clinicChartData} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="level" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} ${isFa ? 'مورد' : 'Visits'}`, isFa ? 'تعداد مراجعه' : 'Visits']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: isFa ? 'rtl' : 'ltr' }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={34}>
                    {clinicChartData.map((entry, idx) => (
                      <Cell key={`clinic-bar-${idx}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartPanelCard>
          )}

          {/* CHART 4: Environmental Monitoring Compliance by Media */}
          {(domainFilter === 'all' || domainFilter === 'environment') && (
            <ChartPanelCard
              title={isFa ? 'انطباق پایش‌های محیط‌زیستی به تفکیک بخش' : 'Environmental Compliance by Monitoring Media'}
              subtitle={
                isFa
                  ? 'مقایسه سنجش‌های منطبق با استاندارد و فراتر از حد مجاز (هوا، دودکش، پساب، آب، خاک، صوت)'
                  : 'Compliant vs. Non-Compliant measurements across environmental media'
              }
              badgeText={`${metrics.envCompliancePercent}% ${isFa ? 'انطباق' : 'Compliant'}`}
              icon={Wind}
              iconColorClass="text-emerald-600 dark:text-emerald-400"
              targetSection="env-monitoring"
              targetLabel={isFa ? 'ورود به پایش‌های محیط‌زیستی' : 'Open Env Monitoring'}
              isFa={isFa}
              hasData={hasEnvChartData}
              emptyText={isFa ? 'هنوز رکوردی در بخش پایش‌های محیط‌زیستی، پساب یا هوا ثبت نشده است' : 'No environmental monitoring records yet'}
              onNavigate={onNavigate}
            >
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={240} debounce={50}>
                <BarChart data={envMonitoringChartData} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: isFa ? 'rtl' : 'ltr' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="compliant"
                    name={isFa ? 'منطبق با استاندارد' : 'Compliant'}
                    stackId="env"
                    fill="#10b981"
                    radius={[0, 0, 0, 0]}
                    barSize={32}
                  />
                  <Bar
                    dataKey="nonCompliant"
                    name={isFa ? 'فراتر از حد مجاز' : 'Non-Compliant'}
                    stackId="env"
                    fill="#ef4444"
                    radius={[6, 6, 0, 0]}
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanelCard>
          )}

          {/* CHART 5: Industrial Waste Breakdown (EMP) */}
          {(domainFilter === 'all' || domainFilter === 'environment') && (
            <ChartPanelCard
              title={isFa ? 'تفکیک پسماندهای صنعتی و ویژه (سامانه EMP)' : 'Industrial & Hazardous Waste Breakdown (EMP)'}
              subtitle={
                isFa
                  ? 'توزیع وزنی پسماندهای خطرناک، صنعتی غیرخطرناک، قابل بازیافت، عادی و بیولوژیک'
                  : 'Distribution of waste quantities across EMP categories'
              }
              badgeText={`${metrics.totalWasteQty} ${isFa ? 'تن' : 'Tons'}`}
              icon={Recycle}
              iconColorClass="text-amber-600 dark:text-amber-400"
              targetSection="waste-management"
              targetLabel={isFa ? 'ورود به مدیریت پسماند (EMP)' : 'Open Waste Management'}
              isFa={isFa}
              hasData={wasteCategoryChartData.length > 0}
              emptyText={isFa ? 'هنوز سابقه پسماند صنعتی در زیرماژول پسماند ثبت نشده است' : 'No waste records registered yet'}
              onNavigate={onNavigate}
            >
              <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={240} debounce={50}>
                <PieChart>
                  <Pie
                    data={wasteCategoryChartData}
                    dataKey="qty"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={86}
                    paddingAngle={3}
                  >
                    {wasteCategoryChartData.map((entry, idx) => (
                      <Cell key={`waste-cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} ${isFa ? 'تن/واحد' : 'Units'}`, isFa ? 'مقدار' : 'Quantity']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: isFa ? 'rtl' : 'ltr' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanelCard>
          )}

          {/* CHART 6: 5S Pillars & Operational Hygiene Checklists */}
          <ChartPanelCard
            title={isFa ? 'ارزیابی ۵ اصل آراستگی (5S) و چک‌لیست‌های بهداشت' : '5S Pillars & Operational Hygiene Compliance'}
            subtitle={
              isFa
                ? 'میانگین امتیاز ممیزی‌های ۵S (تفکیک، نظم، پاکیزگی، استاندارد، انضباط) و بازرسی اماکن بهداشتی'
                : 'Average scores across the 5S pillars and hygiene inspection checklists'
            }
            badgeText={`5S: ${metrics.fiveSAvgScore}%`}
            icon={CheckSquare}
            iconColorClass="text-teal-600 dark:text-teal-400"
            targetSection="five-s"
            targetLabel={isFa ? 'ورود به زیرماژول ساماندهی ۵S' : 'Open 5S Module'}
            isFa={isFa}
            hasData={hasFiveSOrChecklistData}
            emptyText={isFa ? 'هنوز ممیزی ۵S یا چک‌لیست عملیاتی بهداشت ثبت نشده است' : 'No 5S audits or hygiene checklists recorded yet'}
            onNavigate={onNavigate}
          >
            <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={240} debounce={50}>
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={fiveSAndChecklistChartData}>
                <PolarGrid opacity={0.3} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                <Radar
                  name={isFa ? 'امتیاز انطباق (٪)' : 'Score (%)'}
                  dataKey="score"
                  stroke="#0d9488"
                  fill="#14b8a6"
                  fillOpacity={0.45}
                />
                <Tooltip
                  formatter={(val: any) => [`${val}%`, isFa ? 'امتیاز میانگین' : 'Average Score']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', direction: isFa ? 'rtl' : 'ltr' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </ChartPanelCard>
        </div>
      </section>

      {/* ======================================================== */}
      {/* SECTION 3: HIGH-RISK NUTRITION & FOLLOW-UP SPOTLIGHT */}
      {/* ======================================================== */}
      {(domainFilter === 'all' || domainFilter === 'health') && highRiskProfiles.length > 0 && (
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-200 dark:border-amber-800/60 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-xs sm:text-sm text-slate-800 dark:text-white">
                  {isFa
                    ? 'فهرست اولویت‌دار پیگیری هوشمند (تب بیماری‌های پرخطر کارشناس تغذیه و طب کار)'
                    : 'High-Risk Personnel Priority Follow-up Queue'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isFa
                    ? 'استخراج خودکار از نتایج معاینات ادواری و پرونده‌های تغذیه (BMI≥30، کبد چرب گرید ۲و۳، اولویت فوری و پیگیری معوق)'
                    : 'Automatically synthesized from Periodic Medical Exams and Nutrition records'}
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('nutrition')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 self-start sm:self-auto"
              >
                <span>{isFa ? 'مدیریت پرونده‌های پرخطر تغذیه' : 'Manage High-Risk Cases'}</span>
                <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-3 font-bold">{isFa ? 'نام و کد پرسنلی' : 'Personnel'}</th>
                  <th className="py-2.5 px-3 font-bold">{isFa ? 'واحد سازمانی' : 'Unit'}</th>
                  <th className="py-2.5 px-3 font-bold">{isFa ? 'عوامل خطر شناسایی‌شده' : 'Risk Factors'}</th>
                  <th className="py-2.5 px-3 font-bold">{isFa ? 'شاخص‌های کلیدی' : 'Key Findings'}</th>
                  <th className="py-2.5 px-3 font-bold">{isFa ? 'وضعیت پیگیری' : 'Follow-up'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {highRiskProfiles.slice(0, 5).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      <div>{p.fullName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{p.personnelCode}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">{p.unit}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {p.riskCategories.map((rc, i) => (
                          <span
                            key={i}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              rc.severity === 'critical'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {rc.valueBadge}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {p.bmi ? `BMI: ${p.bmi}` : '—'}
                      {p.fbs ? ` | FBS: ${p.fbs}` : ''}
                      {p.systolicBp && p.diastolicBp ? ` | BP: ${p.systolicBp}/${p.diastolicBp}` : ''}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.isFollowUpOverdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                        }`}
                      >
                        {p.nextFollowUpDate
                          ? `${isFa ? 'موعد:' : 'Due:'} ${p.nextFollowUpDate}`
                          : isFa
                          ? 'در انتظار تشکیل پرونده تغذیه'
                          : 'Pending Consultation'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: DIRECT NAVIGATION & STATUS HUB FOR ALL 12 SUBMODULES */}
      {/* ======================================================== */}
      <section className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-black text-slate-800 dark:text-white text-xs sm:text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {isFa
              ? 'وضعیت برخط و دسترسی مستقیم به تمامی زیرماژول‌های واحد بهداشت و محیط‌زیست'
              : 'Live Status & Direct Navigation to All Health & Environment Submodules'}
          </h3>
          <span className="text-[11px] font-bold text-slate-400 font-mono">
            {visibleSubmodules.length} {isFa ? 'زیرماژول' : 'Submodules'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {visibleSubmodules.map(sub => {
            const Icon = sub.icon;
            const tone = TONE_CLASSES[sub.statusTone];
            return (
              <div
                key={sub.key}
                onClick={() => onNavigate?.(sub.key)}
                className={`p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3 group hover:shadow-md ${tone.borderHover}`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-105 ${tone.iconBg} ${tone.iconText}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate">
                        {sub.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {sub.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 rtl:rotate-0 ltr:rotate-180 transition-colors shrink-0 mt-1" />
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/70 flex items-center justify-between text-[11px] font-mono">
                  <span className={`font-black ${tone.valueText}`}>{sub.primaryMetric}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-sans font-bold">{sub.secondaryMetric}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
