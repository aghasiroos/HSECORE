import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  Calendar, 
  Scale, 
  Heart, 
  FileSpreadsheet, 
  RefreshCw, 
  UserCheck, 
  Eye, 
  Printer, 
  CheckCircle2, 
  Clock, 
  Users, 
  Activity, 
  AlertOctagon, 
  Layers, 
  Edit3,
  Salad,
  Flame,
  CheckSquare,
  ShieldAlert,
  Droplet,
  ChevronDown,
  Stethoscope,
  ArrowUpDown,
  BookOpen
} from 'lucide-react';
import { 
  HighRiskPersonnelProfile, 
  HighRiskCategoryType, 
  NutritionRecord 
} from '../../types/nutritionTypes';
import { downloadCsvFile } from '../../../../utils/fileHelpers';
import NutritionFollowUpModal from './NutritionFollowUpModal';
import PersonnelExamHistoryModal from './PersonnelExamHistoryModal';

interface Props {
  profiles: HighRiskPersonnelProfile[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenDetail: (record: NutritionRecord) => void;
  onOpenPrint: (record: NutritionRecord) => void;
  currentUser?: any;
  todayJalali: string;
}

type SortField = 'priority' | 'bmi' | 'bp' | 'blood_sugar' | 'exam_date' | 'followup_due' | 'name' | 'code';

export default function HighRiskPersonnelTab({
  profiles,
  loading,
  onRefresh,
  onOpenDetail,
  onOpenPrint,
  currentUser,
  todayJalali
}: Props) {
  // Category Selection
  const [selectedCategory, setSelectedCategory] = useState<HighRiskCategoryType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [followUpFilter, setFollowUpFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  // Sorting State
  const [sortBy, setSortBy] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal States
  const [activeProfileForFollowUp, setActiveProfileForFollowUp] = useState<HighRiskPersonnelProfile | null>(null);
  const [activeProfileForHistory, setActiveProfileForHistory] = useState<HighRiskPersonnelProfile | null>(null);

  // Exact Category counts across all criteria
  const counts = useMemo(() => {
    return {
      all: profiles.length,
      bmi_overweight: profiles.filter(p => p.riskCategories.some(r => r.category === 'bmi_overweight')).length,
      bmi_obese_1: profiles.filter(p => p.riskCategories.some(r => r.category === 'bmi_obese_1')).length,
      bmi_obese_2: profiles.filter(p => p.riskCategories.some(r => r.category === 'bmi_obese_2')).length,
      bmi_obese_3: profiles.filter(p => p.riskCategories.some(r => r.category === 'bmi_obese_3')).length,
      bmi_obese: profiles.filter(p => p.riskCategories.some(r => r.category === 'bmi_obese' || r.category.startsWith('bmi_obese_'))).length,
      hypertension: profiles.filter(p => p.riskCategories.some(r => r.category === 'hypertension')).length,
      hyperglycemia: profiles.filter(p => p.riskCategories.some(r => r.category === 'hyperglycemia')).length,
      fatty_liver: profiles.filter(p => p.riskCategories.some(r => r.category === 'fatty_liver')).length,
      clinical_urgent: profiles.filter(p => p.riskCategories.some(r => r.category === 'clinical_urgent')).length,
      followup_due: profiles.filter(p => p.riskCategories.some(r => r.category === 'followup_due')).length,
      needs_review: profiles.filter(p => p.riskCategories.some(r => r.category === 'needs_review')).length,
    };
  }, [profiles]);

  // Statistical Dashboard for currently selected category
  const categoryStats = useMemo(() => {
    const list = selectedCategory === 'all'
      ? profiles
      : profiles.filter(p => p.riskCategories.some(r => {
          if (r.category === selectedCategory) return true;
          if (selectedCategory === 'bmi_obese' && (r.category === 'bmi_obese_1' || r.category === 'bmi_obese_2' || r.category === 'bmi_obese_3')) {
            return true;
          }
          return false;
        }));

    const total = list.length;
    const criticalCount = list.filter(p => p.overallPriority === 'urgent' || p.riskCategories.some(r => r.severity === 'critical')).length;
    const activeFollowUps = list.filter(p => p.followUpStatus === 'in_progress' || p.followUpStatus === 'achieved').length;
    const pendingDossier = list.filter(p => !p.hasNutritionRecord).length;
    const overdueCount = list.filter(p => p.isFollowUpOverdue || p.followUpStatus === 'missed').length;

    const validBmis = list.map(p => p.bmi).filter(b => b && b > 0);
    const avgBmi = validBmis.length > 0 ? (validBmis.reduce((a, b) => a + b, 0) / validBmis.length).toFixed(1) : '-';

    const validSys = list.map(p => p.systolicBp).filter(s => s && s > 0) as number[];
    const avgSys = validSys.length > 0 ? Math.round(validSys.reduce((a, b) => a + b, 0) / validSys.length) : '-';

    const validFbs = list.map(p => p.bloodSugarValue || p.fbs || p.randomBs).filter(f => f && f > 0) as number[];
    const avgFbs = validFbs.length > 0 ? Math.round(validFbs.reduce((a, b) => a + b, 0) / validFbs.length) : '-';

    return {
      total,
      criticalCount,
      activeFollowUps,
      pendingDossier,
      overdueCount,
      avgBmi,
      avgSys,
      avgFbs,
      percentageOfAll: profiles.length > 0 ? Math.round((total / profiles.length) * 100) : 0
    };
  }, [profiles, selectedCategory]);

  // Unique units for dropdown
  const uniqueUnits = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach(p => {
      if (p.unit) set.add(p.unit);
    });
    return Array.from(set).sort();
  }, [profiles]);

  // Filtered and Sorted List
  const filteredProfiles = useMemo(() => {
    const result = profiles.filter(profile => {
      // Category Filter
      if (selectedCategory !== 'all') {
        const matchesCategory = profile.riskCategories.some(rc => {
          if (rc.category === selectedCategory) return true;
          if (selectedCategory === 'bmi_obese' && (rc.category === 'bmi_obese_1' || rc.category === 'bmi_obese_2' || rc.category === 'bmi_obese_3')) {
            return true;
          }
          return false;
        });
        if (!matchesCategory) return false;
      }

      // Unit Filter
      if (selectedUnit !== 'all' && profile.unit !== selectedUnit) {
        return false;
      }

      // Severity Filter
      if (severityFilter !== 'all') {
        if (severityFilter === 'urgent' && profile.overallPriority !== 'urgent') return false;
        if (severityFilter === 'high_risk' && profile.overallPriority !== 'high_risk') return false;
        if (severityFilter === 'moderate' && profile.overallPriority !== 'routine') return false;
      }

      // Follow-up Filter
      if (followUpFilter !== 'all') {
        if (followUpFilter === 'overdue' && !profile.isFollowUpOverdue && profile.followUpStatus !== 'missed') return false;
        if (followUpFilter === 'no_dossier' && profile.hasNutritionRecord) return false;
        if (followUpFilter === 'needs_review') {
          if (!profile.hasIndeterminateLabResults && profile.followUpStatus !== 'pending') return false;
        } else if (followUpFilter !== 'overdue' && followUpFilter !== 'no_dossier' && profile.followUpStatus !== followUpFilter) {
          return false;
        }
      }

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = (profile.fullName || '').toLowerCase().includes(q);
        const matchCode = (profile.personnelCode || '').toLowerCase().includes(q);
        const matchNat = (profile.nationalCode || '').toLowerCase().includes(q);
        const matchUnit = (profile.unit || '').toLowerCase().includes(q);
        const matchJob = (profile.jobTitle || '').toLowerCase().includes(q);
        const matchRisk = profile.riskCategories.some(r => r.detailsFa.toLowerCase().includes(q) || r.categoryLabelFa.toLowerCase().includes(q));

        if (!matchName && !matchCode && !matchNat && !matchUnit && !matchJob && !matchRisk) {
          return false;
        }
      }

      return true;
    });

    // Apply Sorting
    return result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'priority') {
        const priorityScore = (p: HighRiskPersonnelProfile) => {
          let score = 0;
          if (p.overallPriority === 'urgent') score += 1000;
          if (p.isFollowUpOverdue) score += 500;
          if (p.bloodPressureStage === 'crisis') score += 400;
          if (p.fattyLiverGrade === 'grade_3') score += 350;
          if (p.bmi >= 40) score += 300;
          if (p.bloodSugarStage === 'diabetes') score += 250;
          if (p.bloodPressureStage === 'stage_2') score += 200;
          if (p.bmi >= 35) score += 150;
          if (p.bmi >= 30) score += 100;
          return score;
        };
        cmp = priorityScore(b) - priorityScore(a);
      } else if (sortBy === 'bmi') {
        cmp = (b.bmi || 0) - (a.bmi || 0);
      } else if (sortBy === 'bp') {
        cmp = (b.systolicBp || 0) - (a.systolicBp || 0);
      } else if (sortBy === 'blood_sugar') {
        const sugarA = a.bloodSugarValue || a.fbs || a.randomBs || 0;
        const sugarB = b.bloodSugarValue || b.fbs || b.randomBs || 0;
        cmp = sugarB - sugarA;
      } else if (sortBy === 'exam_date') {
        cmp = (b.lastExamDate || '').localeCompare(a.lastExamDate || '');
      } else if (sortBy === 'followup_due') {
        cmp = (a.nextFollowUpDate || '9999').localeCompare(b.nextFollowUpDate || '9999');
      } else if (sortBy === 'name') {
        cmp = (a.fullName || '').localeCompare(b.fullName || '');
      } else if (sortBy === 'code') {
        cmp = (a.personnelCode || '').localeCompare(b.personnelCode || '');
      }

      return sortDirection === 'desc' ? cmp : -cmp;
    });
  }, [profiles, selectedCategory, selectedUnit, severityFilter, followUpFilter, searchQuery, sortBy, sortDirection]);

  // CSV Export
  const handleExportCsv = () => {
    if (filteredProfiles.length === 0) return;

    const headers = [
      'کد پرسنلی',
      'کد ملی',
      'نام و نام خانوادگی',
      'واحد سازمانی',
      'سمت سازمانی',
      'عوامل خطر شناسایی‌شده',
      'رده‌بندی خطر',
      'قد (cm)',
      'وزن (kg)',
      'BMI',
      'رده BMI',
      'تاریخ ثبت BMI',
      'فشار خون (mmHg)',
      'وضعیت فشار خون',
      'تاریخ اندازه‌گیری فشار خون',
      'نوع آزمایش قند خون',
      'مقدار قند خون',
      'واحد قند خون',
      'وضعیت قند خون',
      'تاریخ آزمایش قند خون',
      'کبد چرب',
      'تاریخ آخرین معاینه ادواری',
      'هدف رژیم تغذیه',
      'وضعیت پیگیری',
      'تاریخ آخرین پیگیری',
      'تاریخ پیگیری بعدی',
      'موعد گذشته',
      'توضیحات کارشناس تغذیه'
    ];

    const rows = filteredProfiles.map(p => [
      p.personnelCode,
      p.nationalCode,
      p.fullName,
      p.unit,
      p.jobTitle,
      p.riskCategories.map(r => r.detailsFa).join(' | '),
      p.overallPriority === 'urgent' ? 'بحرانی / فوری' : p.overallPriority === 'high_risk' ? 'پرخطر' : 'روتین',
      p.height || '',
      p.weight || '',
      p.bmi,
      p.bmiCategory,
      p.bmiMeasurementDate || '',
      p.systolicBp && p.diastolicBp ? `${p.systolicBp}/${p.diastolicBp}` : '',
      p.bloodPressureStage || '',
      p.bpMeasurementDate || '',
      p.bloodSugarTestType || (p.fbs ? 'FBS' : p.hba1c ? 'HbA1c' : p.randomBs ? 'BS' : ''),
      p.bloodSugarValue || p.fbs || p.randomBs || p.hba1c || '',
      p.bloodSugarUnit || (p.hba1c ? '%' : 'mg/dL'),
      p.bloodSugarStage || '',
      p.bloodSugarMeasurementDate || '',
      p.fattyLiverGrade !== 'none' ? `گرید ${p.fattyLiverGrade.replace('grade_', '')}` : 'طبیعی',
      p.lastExamDate || '',
      p.dietGoal || '',
      p.followUpStatus,
      p.lastFollowUpDate || '',
      p.nextFollowUpDate || '',
      p.isFollowUpOverdue ? 'بله' : 'خیر',
      (p.consultationNotes || p.recommendations.join('؛ ') || '').replace(/"/g, '""')
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(v => `"${v}"`).join(','))].join('\n');
    downloadCsvFile(`hse_high_risk_personnel_${todayJalali.replace(/\//g, '-')}.csv`, csvContent);
  };

  // Convert profile to lightweight nutrition record for modal preview
  const profileToNutritionRecord = (p: HighRiskPersonnelProfile): NutritionRecord => {
    return {
      id: p.nutritionRecordId || `pseudo-${p.personnelCode}`,
      recordNumber: `HR-${p.personnelCode}`,
      visitDate: p.lastExamDate || todayJalali,
      personnelCode: p.personnelCode,
      nationalCode: p.nationalCode,
      fullName: p.fullName,
      unit: p.unit,
      department: p.department,
      jobTitle: p.jobTitle,
      height: p.height || 175,
      weight: p.weight || 75,
      bmi: p.bmi,
      bmiCategory: p.bmiCategory,
      waistCircumference: p.waistCircumference,
      whr: p.whr,
      fastFoodFrequency: 'rarely',
      sugaryDrinksFrequency: 'rarely',
      saltIntake: 'moderate',
      fatOilPreference: 'olive_liquid',
      mealTimingPattern: 'regular_3_meals',
      caffeineIntake: 'moderate',
      physicalActivityLevel: 'moderate',
      fattyLiverGrade: p.fattyLiverGrade,
      systolicBp: p.systolicBp,
      diastolicBp: p.diastolicBp,
      fbs: p.fbs,
      cholesterol: p.cholesterol,
      triglycerides: p.triglycerides,
      underlyingConditions: p.underlyingConditions,
      dietGoal: p.dietGoal || 'weight_loss',
      dietPlanSummary: p.dietPlanSummary || 'الگوی رژیم سلامت و کنترل عوامل خطر متابولیک',
      recommendations: p.recommendations,
      supplements: p.supplements,
      consultationType: p.consultationType || 'initial_assessment',
      consultantName: p.consultantName || 'کارشناس تغذیه',
      consultationNotes: p.consultationNotes || '',
      followUpStatus: p.followUpStatus,
      nextFollowUpDate: p.nextFollowUpDate,
      priority: p.overallPriority,
      createdAt: p.updatedAt,
      createdBy: 'سیستم هوشمند پایش تغذیه',
      updatedAt: p.updatedAt,
      updatedBy: 'سیستم هوشمند پایش تغذیه'
    };
  };

  return (
    <div className="space-y-4">
      
      {/* ── Official High-Risk Criteria Advisory Banner (Exact Match to Requirement & Screenshot) ── */}
      <div className="bg-[#FEFCE8] dark:bg-amber-950/25 px-5 py-3 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 flex items-center gap-3.5 shadow-2xs">
        <div className="shrink-0 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-6 h-6 stroke-[1.8]" />
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-200">
            معیار شناسایی پرسنل پرخطر:
          </div>
          <div className="text-xs sm:text-sm font-normal text-amber-900/90 dark:text-amber-300/90 leading-relaxed">
            افراد دارای شاخص توده بدنی (BMI &gt;= 30)، کبد چرب گرید ۲ و ۳، سطح اولویت بالینی فوری/پرخطر یا افرادی که تاریخ پیگیری آن‌ها فرارسیده است.
          </div>
        </div>
      </div>

      {/* ── High-Risk Category Filter Cards (Tab Chips with Badge Counts) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        
        {/* Category 1: ALL */}
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'all'
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white ring-2 ring-slate-400/30'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Layers className="w-4 h-4 opacity-75" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'all'
                ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              {counts.all}
            </span>
          </div>
          <span className="text-xs font-black">همه پرسنل پرخطر</span>
        </button>

        {/* Category 2: Overweight (25 - 29.9) */}
        <button
          type="button"
          onClick={() => setSelectedCategory('bmi_overweight')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'bmi_overweight'
              ? 'bg-orange-600 text-white border-orange-600 ring-2 ring-orange-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Scale className="w-4 h-4 text-orange-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'bmi_overweight'
                ? 'bg-white/20 text-white'
                : 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300'
            }`}>
              {counts.bmi_overweight}
            </span>
          </div>
          <span className="text-xs font-black">اضافه‌وزن (BMI 25 - 29.9)</span>
        </button>

        {/* Category 3: Obese Grade 1 (30 - 34.9) */}
        <button
          type="button"
          onClick={() => setSelectedCategory('bmi_obese_1')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'bmi_obese_1'
              ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Scale className="w-4 h-4 text-rose-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'bmi_obese_1'
                ? 'bg-white/20 text-white'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            }`}>
              {counts.bmi_obese_1}
            </span>
          </div>
          <span className="text-xs font-black">چاقی درجه ۱ (BMI 30 - 34.9)</span>
        </button>

        {/* Category 4: Obese Grade 2 (35 - 39.9) */}
        <button
          type="button"
          onClick={() => setSelectedCategory('bmi_obese_2')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'bmi_obese_2'
              ? 'bg-red-700 text-white border-red-700 ring-2 ring-red-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Scale className="w-4 h-4 text-red-600" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'bmi_obese_2'
                ? 'bg-white/20 text-white'
                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
            }`}>
              {counts.bmi_obese_2}
            </span>
          </div>
          <span className="text-xs font-black">چاقی درجه ۲ (BMI 35 - 39.9)</span>
        </button>

        {/* Category 5: Obese Grade 3 (BMI >= 40) */}
        <button
          type="button"
          onClick={() => setSelectedCategory('bmi_obese_3')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'bmi_obese_3'
              ? 'bg-purple-800 text-white border-purple-800 ring-2 ring-purple-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Scale className="w-4 h-4 text-purple-600" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'bmi_obese_3'
                ? 'bg-white/20 text-white'
                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
            }`}>
              {counts.bmi_obese_3}
            </span>
          </div>
          <span className="text-xs font-black">چاقی درجه ۳ / مفرط (BMI &ge; 40)</span>
        </button>

        {/* Category 6: High Blood Pressure */}
        <button
          type="button"
          onClick={() => setSelectedCategory('hypertension')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'hypertension'
              ? 'bg-rose-700 text-white border-rose-700 ring-2 ring-rose-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'hypertension'
                ? 'bg-white/20 text-white'
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            }`}>
              {counts.hypertension}
            </span>
          </div>
          <span className="text-xs font-black">فشار خون بالا</span>
        </button>

        {/* Category 7: High Blood Sugar */}
        <button
          type="button"
          onClick={() => setSelectedCategory('hyperglycemia')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'hyperglycemia'
              ? 'bg-cyan-700 text-white border-cyan-700 ring-2 ring-cyan-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-cyan-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Droplet className="w-4 h-4 text-cyan-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'hyperglycemia'
                ? 'bg-white/20 text-white'
                : 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300'
            }`}>
              {counts.hyperglycemia}
            </span>
          </div>
          <span className="text-xs font-black">قند خون بالا (دیابت / پیش‌دیابت)</span>
        </button>

        {/* Category 8: Fatty Liver Grade 2 & 3 */}
        <button
          type="button"
          onClick={() => setSelectedCategory('fatty_liver')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'fatty_liver'
              ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Activity className="w-4 h-4 text-amber-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'fatty_liver'
                ? 'bg-white/20 text-white'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
            }`}>
              {counts.fatty_liver}
            </span>
          </div>
          <span className="text-xs font-black">کبد چرب گرید ۲ و ۳</span>
        </button>

        {/* Category 9: Clinical Urgent Priority */}
        <button
          type="button"
          onClick={() => setSelectedCategory('clinical_urgent')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'clinical_urgent'
              ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <AlertOctagon className="w-4 h-4 text-purple-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'clinical_urgent'
                ? 'bg-white/20 text-white'
                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
            }`}>
              {counts.clinical_urgent}
            </span>
          </div>
          <span className="text-xs font-black">اولویت بالینی فوری / پرخطر</span>
        </button>

        {/* Category 10: Follow-up Due / Overdue */}
        <button
          type="button"
          onClick={() => setSelectedCategory('followup_due')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'followup_due'
              ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <Clock className="w-4 h-4 text-red-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'followup_due'
                ? 'bg-white/20 text-white'
                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
            }`}>
              {counts.followup_due}
            </span>
          </div>
          <span className="text-xs font-black">موعد پیگیری فرارسیده / معوق</span>
        </button>

        {/* Category 11: Needs Review / Unspecified Lab Units */}
        <button
          type="button"
          onClick={() => setSelectedCategory('needs_review')}
          className={`p-3 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-1.5 shadow-2xs ${
            selectedCategory === 'needs_review'
              ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400/40'
              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
              selectedCategory === 'needs_review'
                ? 'bg-white/20 text-white'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
            }`}>
              {counts.needs_review}
            </span>
          </div>
          <span className="text-xs font-black">نیازمند بررسی / واحد نامشخص</span>
        </button>

      </div>

      {/* ── Category Statistical Dashboard Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* KPI 1: Unique Individuals Count */}
        <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 font-medium block">
              افراد یکتا در این دسته
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {categoryStats.total}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                نفر ({categoryStats.percentageOfAll}٪ از کل)
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 2: Critical / Urgent Severity */}
        <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-rose-200 dark:border-rose-900/40 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium block">
              اولویت فوری و بحرانی
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {categoryStats.criticalCount}
              </span>
              <span className="text-[10px] text-rose-500 font-bold">
                مورد حاد
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 3: Key Metric Average */}
        <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 font-medium block">
              {selectedCategory.startsWith('bmi') ? 'میانگین BMI این دسته'
                : selectedCategory === 'hypertension' ? 'میانگین سیستولیک'
                : selectedCategory === 'hyperglycemia' ? 'میانگین قند (FBS/BS)'
                : 'پیگیری‌های فعال'}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {selectedCategory.startsWith('bmi') ? categoryStats.avgBmi
                  : selectedCategory === 'hypertension' ? (categoryStats.avgSys !== '-' ? `${categoryStats.avgSys}` : '-')
                  : selectedCategory === 'hyperglycemia' ? (categoryStats.avgFbs !== '-' ? `${categoryStats.avgFbs}` : '-')
                  : categoryStats.activeFollowUps}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                {selectedCategory.startsWith('bmi') ? 'kg/m²'
                  : selectedCategory === 'hypertension' ? 'mmHg'
                  : selectedCategory === 'hyperglycemia' ? 'mg/dL'
                  : 'پرونده'}
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 4: Pending Follow-up / Overdue */}
        <div className="bg-white dark:bg-slate-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] text-slate-500 font-medium block">
              نیازمند پیگیری / معوق
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {categoryStats.pendingDossier + categoryStats.overdueCount}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                ({categoryStats.overdueCount} موعد گذشته)
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── Search & Filters & Sorting Toolbar ── */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            <input
              type="text"
              placeholder="جستجو بر اساس نام، کد پرسنلی، کد ملی، سمت یا عامل خطر..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-10 pr-9 pl-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {/* Unit Filter */}
          <select
            value={selectedUnit}
            onChange={e => setSelectedUnit(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="all">تمام واحدهای سازمانی</option>
            {uniqueUnits.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="all">تمام سطوح شدت خطر</option>
            <option value="urgent">بحرانی / اولویت فوری (Urgent)</option>
            <option value="high_risk">پرخطر بالینی (High Risk)</option>
            <option value="moderate">متوسط / پایش روتین (Moderate)</option>
          </select>

          {/* Follow-up Status Filter */}
          <select
            value={followUpFilter}
            onChange={e => setFollowUpFilter(e.target.value)}
            className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="all">تمام وضعیت‌های پیگیری</option>
            <option value="needs_review">نیازمند بررسی (Needs Review)</option>
            <option value="in_progress">در حال پیگیری فعال (In Progress)</option>
            <option value="achieved">پیگیری انجام‌شده / تحقق هدف (Achieved)</option>
            <option value="overdue">موعد فرارسیده / معوق (Overdue)</option>
            <option value="no_dossier">فاقد پرونده تغذیه (نیازمند تشکیل)</option>
          </select>

          {/* Sorting Field Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
              title="مرتب‌سازی نتایج"
            >
              <option value="priority">مرتب‌سازی: اولویت و فوریت بالینی</option>
              <option value="bmi">مرتب‌سازی: شاخص توده بدنی (BMI)</option>
              <option value="bp">مرتب‌سازی: فشار خون سیستولیک</option>
              <option value="blood_sugar">مرتب‌سازی: قند خون</option>
              <option value="exam_date">مرتب‌سازی: تاریخ معاینه / آزمایش</option>
              <option value="followup_due">مرتب‌سازی: موعد نوبت پیگیری</option>
              <option value="name">مرتب‌سازی: نام خانوادگی</option>
              <option value="code">مرتب‌سازی: کد پرسنلی</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
              title={sortDirection === 'desc' ? 'ترتیب نزولی (بیشترین به کمترین)' : 'ترتیب صعودی (کمترین به بیشترین)'}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Actions: Sync from Medical & Export */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="به‌روزرسانی خودکار و همگام‌سازی از معاینات ادواری و پرسنل"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
            <span>به‌روزرسانی</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredProfiles.length === 0}
            className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل ({filteredProfiles.length})</span>
          </button>
        </div>
      </div>

      {/* ── High-Risk Personnel Data Table ── */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span>در حال فراخوانی هوشمند و انطباق سوابق معاینات ادواری و تغذیه...</span>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
            <p className="font-bold text-slate-700 dark:text-slate-300">
              هیچ پرسنل پرخطری در فیلتر انتخابی یافت نشد.
            </p>
            <p className="text-[11px] text-slate-400">
              تمامی شاخص‌های ثبت‌شده در محدوده مجاز قرار دارند یا با شرایط جستجو همخوانی ندارند.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold">
                  <th className="p-3.5">مشخصات پرسنلی</th>
                  <th className="p-3.5">عوامل خطر و رده‌بندی</th>
                  <th className="p-3.5">مقادیر شاخص‌ها و تاریخ ثبت</th>
                  <th className="p-3.5">وضعیت و تاریخ‌های پیگیری</th>
                  <th className="p-3.5">توضیحات و توصیه‌های تغذیه</th>
                  <th className="p-3.5 text-center">اقدامات و پرونده</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredProfiles.map(profile => (
                  <tr 
                    key={profile.id}
                    className={`transition-colors ${
                      profile.overallPriority === 'urgent'
                        ? 'bg-rose-50/30 dark:bg-rose-950/15 hover:bg-rose-50/50'
                        : profile.isFollowUpOverdue
                        ? 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/50'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    {/* 1. Personnel Info - Name clickable to view full exam history */}
                    <td className="p-3.5 min-w-[190px]">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setActiveProfileForHistory(profile)}
                          className="text-right text-slate-900 dark:text-white font-black block text-xs sm:text-sm hover:text-emerald-600 transition cursor-pointer"
                          title="مشاهده سوابق کامل معاینات ادواری و پرونده"
                        >
                          {profile.fullName}
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                          <span>کد: {profile.personnelCode}</span>
                          {profile.nationalCode && <span>· کدملی: {profile.nationalCode}</span>}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          <span>{profile.unit}</span>
                          {profile.jobTitle && <span className="opacity-75"> ({profile.jobTitle})</span>}
                        </div>
                      </div>
                    </td>

                    {/* 2. Matched Risk Factors & Severity Classification */}
                    <td className="p-3.5 min-w-[220px]">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {profile.riskCategories.map((rc, i) => (
                            <div 
                              key={i}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                rc.severity === 'critical'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                                  : rc.severity === 'high'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                              }`}
                              title={rc.detailsFa}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                              <span>{rc.categoryLabelFa}</span>
                            </div>
                          ))}
                        </div>

                        {/* Priority Badge */}
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                            profile.overallPriority === 'urgent'
                              ? 'bg-rose-600 text-white'
                              : profile.overallPriority === 'high_risk'
                              ? 'bg-amber-500 text-white'
                              : 'bg-blue-600 text-white'
                          }`}>
                            {profile.overallPriority === 'urgent' ? 'اولویت: بحرانی و فوری'
                              : profile.overallPriority === 'high_risk' ? 'اولویت: پرخطر بالینی'
                              : 'اولویت: پایش روتین'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 3. Registered Metric Values & Dates (BMI, BP, Blood Sugar, Fatty Liver) */}
                    <td className="p-3.5 min-w-[240px]">
                      <div className="space-y-1.5 text-xs">
                        {/* BMI */}
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-normal">BMI:</span>
                          <span className={`font-mono font-black ${
                            profile.bmi >= 40 ? 'text-purple-600 dark:text-purple-400 font-black'
                            : profile.bmi >= 35 ? 'text-rose-600 dark:text-rose-400'
                            : profile.bmi >= 30 ? 'text-red-600 dark:text-red-400'
                            : profile.bmi >= 25 ? 'text-orange-600 dark:text-orange-400'
                            : 'text-slate-800 dark:text-slate-200'
                          }`}>
                            {profile.bmi || '-'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-sans">
                            ({profile.bmiCategory === 'overweight' ? 'اضافه‌وزن'
                              : profile.bmiCategory === 'obese_1' ? 'چاقی درجه ۱'
                              : profile.bmiCategory === 'obese_2' ? 'چاقی درجه ۲'
                              : profile.bmiCategory === 'obese_3' ? 'چاقی درجه ۳'
                              : 'نرمال'})
                          </span>
                          {profile.height && profile.weight && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({profile.weight}kg / {profile.height}cm)
                            </span>
                          )}
                        </div>

                        {/* Blood Pressure */}
                        {profile.systolicBp && profile.diastolicBp && (
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-400 font-normal font-sans">فشار خون:</span>
                            <span className={`font-bold ${
                              profile.bloodPressureStage === 'crisis' || profile.bloodPressureStage === 'stage_2'
                                ? 'text-rose-600 dark:text-rose-400 font-black'
                                : profile.bloodPressureStage === 'stage_1'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}>
                              {profile.systolicBp}/{profile.diastolicBp} mmHg
                            </span>
                            {profile.bloodPressureStage !== 'normal' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-slate-100 dark:bg-slate-700 font-sans font-bold">
                                {profile.bloodPressureStage === 'crisis' ? 'بحران'
                                  : profile.bloodPressureStage === 'stage_2' ? 'مرحله ۲'
                                  : profile.bloodPressureStage === 'stage_1' ? 'مرحله ۱'
                                  : 'پیش‌فشار'}
                              </span>
                            )}
                            {profile.bpMeasurementDate && (
                              <span className="text-[10px] text-slate-400 font-sans">
                                ({profile.bpMeasurementDate})
                              </span>
                            )}
                          </div>
                        )}

                        {/* Blood Sugar (FBS, BS, HbA1c) */}
                        {(profile.bloodSugarValue || profile.fbs || profile.randomBs || profile.hba1c) && (
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-slate-400 font-normal font-sans">قند خون:</span>
                            <span className={`font-bold ${
                              profile.bloodSugarStage === 'diabetes'
                                ? 'text-rose-600 dark:text-rose-400 font-black'
                                : profile.bloodSugarStage === 'prediabetes'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}>
                              {profile.bloodSugarTestType || (profile.fbs ? 'FBS' : profile.hba1c ? 'HbA1c' : 'BS')}:{' '}
                              {profile.bloodSugarValue || profile.fbs || profile.randomBs || profile.hba1c}{' '}
                              {profile.bloodSugarUnit || (profile.hba1c ? '%' : 'mg/dL')}
                            </span>
                            {profile.bloodSugarStage && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-slate-100 dark:bg-slate-700 font-sans font-bold">
                                {profile.bloodSugarStage === 'diabetes' ? 'دیابت'
                                  : profile.bloodSugarStage === 'prediabetes' ? 'پیش‌دیابت'
                                  : 'طبیعی'}
                              </span>
                            )}
                            {profile.bloodSugarMeasurementDate && (
                              <span className="text-[10px] text-slate-400 font-sans">
                                ({profile.bloodSugarMeasurementDate})
                              </span>
                            )}
                          </div>
                        )}

                        {/* Fatty Liver */}
                        {profile.fattyLiverGrade !== 'none' && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-normal">کبد چرب:</span>
                            <span className={`font-bold ${
                              profile.fattyLiverGrade === 'grade_3'
                                ? 'text-rose-600 dark:text-rose-400 font-black'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              گرید {profile.fattyLiverGrade.replace('grade_', '')}
                            </span>
                          </div>
                        )}

                        {profile.lastExamYear && (
                          <div className="text-[10px] text-slate-400">
                            معاینه ادواری: {profile.lastExamDate || `سال ${profile.lastExamYear}`}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 4. Follow-up Status, Last Follow-up Date & Next Due Date */}
                    <td className="p-3.5 min-w-[180px]">
                      <div className="space-y-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          profile.followUpStatus === 'achieved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                            : profile.followUpStatus === 'in_progress'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
                            : profile.followUpStatus === 'missed'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                        }`}>
                          {profile.followUpStatus === 'achieved' ? 'تحقق هدف رژیم'
                            : profile.followUpStatus === 'in_progress' ? 'در حال پیگیری فعال'
                            : profile.followUpStatus === 'missed' ? 'جلسه پیگیری معوق'
                            : 'در انتظار پیگیری'}
                        </span>

                        <div className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                          {profile.dietGoal ? (
                            profile.dietGoal === 'weight_loss' ? 'کاهش وزن'
                            : profile.dietGoal === 'fatty_liver_reversal' ? 'بهبود کبد چرب'
                            : profile.dietGoal === 'diabetes_control' ? 'کنترل قند'
                            : profile.dietGoal === 'hypertension_dash' ? 'کاهش فشار خون'
                            : profile.dietGoal === 'shift_work_optimization' ? 'رژیم شیفت‌کاری'
                            : 'تعادل تغذیه‌ای'
                          ) : (
                            <span className="text-slate-400 font-normal">هدف رژیم: تعیین‌نشده</span>
                          )}
                        </div>

                        {/* Last Follow-up Date */}
                        <div className="text-[11px] text-slate-500">
                          <span>آخرین پیگیری: </span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {profile.lastFollowUpDate || 'ثبت‌نشده'}
                          </span>
                        </div>

                        {/* Next Follow-up Due Date */}
                        <div className="text-[11px]">
                          <span className="text-slate-500">موعد بعدی: </span>
                          {profile.nextFollowUpDate ? (
                            <span className={`font-mono font-bold ${
                              profile.isFollowUpOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {profile.nextFollowUpDate}
                            </span>
                          ) : (
                            <span className="text-slate-400">تعیین‌نشده</span>
                          )}
                          {profile.isFollowUpOverdue && (
                            <span className="block mt-0.5 text-[9px] font-black text-rose-600 dark:text-rose-400">
                              ⚠️ موعد پیگیری فرارسیده / معوق
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 5. Nutritionist Notes & Recommendations */}
                    <td className="p-3.5 min-w-[200px] max-w-[260px]">
                      <div className="space-y-1 text-xs">
                        {profile.hasNutritionRecord ? (
                          <>
                            {profile.consultationNotes && (
                              <p className="text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed" title={profile.consultationNotes}>
                                {profile.consultationNotes}
                              </p>
                            )}
                            {profile.dietPlanSummary && !profile.consultationNotes && (
                              <p className="text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed" title={profile.dietPlanSummary}>
                                {profile.dietPlanSummary}
                              </p>
                            )}
                            {profile.consultantName && (
                              <span className="text-[10px] text-slate-400 block">
                                مشاور: {profile.consultantName}
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-900/40">
                            <div className="font-bold">فاقد پرونده تغذیه</div>
                            <div className="text-[10px] opacity-80 mt-0.5">نیازمند ثبت پیگیری و مشاوره اولیه</div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 6. Action Operations */}
                    <td className="p-3.5 text-center min-w-[160px]">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Primary Quick Follow-up Action */}
                        <button
                          type="button"
                          onClick={() => setActiveProfileForFollowUp(profile)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          title="ثبت / به‌روزرسانی پیگیری هوشمند"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ثبت پیگیری</span>
                        </button>

                        {/* View Periodic Exam History & Full Dossier */}
                        <button
                          type="button"
                          onClick={() => setActiveProfileForHistory(profile)}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                          title="مشاهده سوابق معاینات ادواری و پرونده"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Print Care Plan */}
                        <button
                          type="button"
                          onClick={() => onOpenPrint(profileToNutritionRecord(profile))}
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                          title="چاپ برنامه تغذیه"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Follow-Up Smart Recording Modal ── */}
      <NutritionFollowUpModal
        isOpen={!!activeProfileForFollowUp}
        onClose={() => setActiveProfileForFollowUp(null)}
        profile={activeProfileForFollowUp}
        onSaved={onRefresh}
        currentUser={currentUser}
        todayJalali={todayJalali}
      />

      {/* ── Personnel Examination History & Medical Dossier Modal ── */}
      <PersonnelExamHistoryModal
        isOpen={!!activeProfileForHistory}
        onClose={() => setActiveProfileForHistory(null)}
        profile={activeProfileForHistory}
        onOpenFollowUp={(p) => {
          setActiveProfileForHistory(null);
          setActiveProfileForFollowUp(p);
        }}
        onOpenPrint={(p) => {
          onOpenPrint(profileToNutritionRecord(p));
        }}
      />

    </div>
  );
}
