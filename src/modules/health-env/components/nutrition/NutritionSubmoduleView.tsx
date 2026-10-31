import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Apple, 
  Scale, 
  Activity, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Heart, 
  Trash2, 
  Edit, 
  Eye, 
  RefreshCw, 
  Download, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  FileSpreadsheet, 
  BarChart3, 
  Salad, 
  Clock, 
  Users, 
  TrendingUp,
  ShieldAlert
} from 'lucide-react';
import { 
  NutritionRecord, 
  NutritionFilterState, 
  NutritionStatistics, 
  NutritionBmiCategory,
  HighRiskPersonnelProfile
} from '../../types/nutritionTypes';
import { nutritionService } from '../../services/nutritionService';
import { highRiskNutritionService } from '../../services/highRiskNutritionService';
import { medicalExamService } from '../../services/medicalExamService';
import { occupationalHealthStructuredService } from '../../services/occupationalHealthStructuredService';
import { getComplexPersonnelList, fetchCentralPersonnelList } from '../../../../utils/personnelHelper';
import { apiDb } from '../../../../services/apiDatabaseClient';
import NutritionRecordModal from './NutritionRecordModal';
import NutritionRecordDetailModal from './NutritionRecordDetailModal';
import NutritionCarePlanPrintModal from './NutritionCarePlanPrintModal';
import HighRiskPersonnelTab from './HighRiskPersonnelTab';
import { downloadCsvFile } from '../../../../utils/fileHelpers';

interface Props {
  language: 'fa' | 'en';
  currentUser?: any;
}

export default function NutritionSubmoduleView({ language, currentUser }: Props) {
  const isFa = language === 'fa';

  // State
  const [records, setRecords] = useState<NutritionRecord[]>([]);
  const [highRiskProfiles, setHighRiskProfiles] = useState<HighRiskPersonnelProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHighRisk, setLoadingHighRisk] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'analytics' | 'high_risk'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NutritionRecord | null>(null);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<NutritionRecord | null>(null);
  const [selectedRecordForPrint, setSelectedRecordForPrint] = useState<NutritionRecord | null>(null);

  // Filters State
  const [filters, setFilters] = useState<NutritionFilterState>({
    searchQuery: '',
    unit: '',
    bmiCategory: 'all',
    dietGoal: 'all',
    priority: 'all',
    followUpStatus: 'all',
    fattyLiverGrade: 'all',
    dateFrom: '',
    dateTo: ''
  });

  // Calculate current Jalali date
  const todayJalali = useMemo(() => {
    try {
      const d = new Date();
      return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d).replace(/\//g, '/');
    } catch {
      return '1405/01/01';
    }
  }, []);

  const inFlightRef = useRef(false);

  // Load records from پایگاه داده and correlate with periodic medical exams
  const loadRecords = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setLoadingHighRisk(true);
    try {
      // 0. Ensure authoritative medical exams are freshly synced from server
      await medicalExamService.reloadFromServer();

      // 1. Fetch current nutrition records
      const nutritionList = await nutritionService.getRecords();

      // 2. Authoritative live periodic medical exams and records from service
      const periodicExams = medicalExamService.getAllExams() || [];
      const periodicRecords = medicalExamService.getAllRecords() || [];

      // 3. Authoritative structured laboratory test results (تب آزمایشگاه)
      const labResults = occupationalHealthStructuredService.getAllResults() || [];

      // 4. Load master personnel directory (ensure fresh state from central database/cache)
      let masterPersonnel = getComplexPersonnelList();
      if (!masterPersonnel || masterPersonnel.length === 0) {
        masterPersonnel = await fetchCentralPersonnelList();
      }

      // If personnel directory is loaded, filter out records belonging to explicitly deleted personnel
      let activeNutritionList = nutritionList;
      if (masterPersonnel && masterPersonnel.length > 0) {
        const deletedCodes = new Set(
          masterPersonnel
            .filter(p => (p as any).isDeleted === true || (p as any).status === 'deleted')
            .flatMap(p => [
              p.personnelCode?.trim().toLowerCase(),
              p.employeeCode?.trim().toLowerCase(),
              p.nationalCode?.trim().toLowerCase()
            ])
            .filter(Boolean) as string[]
        );
        activeNutritionList = nutritionList.filter(r => {
          const code = String(r.personnelCode || r.nationalCode || '').trim().toLowerCase();
          return !deletedCodes.has(code);
        });
      }
      setRecords(activeNutritionList);

      // 5. Intelligently synthesize and build high-risk personnel profiles
      // Automatically removes deleted personnel and personnel whose periodic exams were deleted
      const highRisk = highRiskNutritionService.buildHighRiskProfiles(
        activeNutritionList,
        periodicExams,
        periodicRecords,
        masterPersonnel,
        todayJalali,
        labResults
      );
      setHighRiskProfiles(highRisk);
    } catch (err) {
      console.error('Failed to load nutrition records / high risk profiles:', err);
      setRecords([]);
      setHighRiskProfiles([]);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setLoadingHighRisk(false);
    }
  }, [todayJalali]);

  useEffect(() => {
    loadRecords();

    // Debounced listener prevents rapid event bursts or cascading renders
    let updateTimeout: any = null;
    const handleUpdate = () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        loadRecords();
      }, 350);
    };

    window.addEventListener('hse_nutrition_records_updated', handleUpdate);
    window.addEventListener('hse_medical_data_updated', handleUpdate);
    window.addEventListener('hse_occ_health_data_updated', handleUpdate);
    window.addEventListener('hse_occ_health_updated', handleUpdate);
    window.addEventListener('hse_health_env_updated', handleUpdate);
    window.addEventListener('hse_personnel_updated', handleUpdate);

    return () => {
      if (updateTimeout) clearTimeout(updateTimeout);
      window.removeEventListener('hse_nutrition_records_updated', handleUpdate);
      window.removeEventListener('hse_medical_data_updated', handleUpdate);
      window.removeEventListener('hse_occ_health_data_updated', handleUpdate);
      window.removeEventListener('hse_occ_health_updated', handleUpdate);
      window.removeEventListener('hse_health_env_updated', handleUpdate);
      window.removeEventListener('hse_personnel_updated', handleUpdate);
    };
  }, [loadRecords]);

  // Real KPI statistics strictly from database
  const stats: NutritionStatistics = useMemo(() => {
    return nutritionService.calculateStatistics(records);
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return nutritionService.filterRecords(records, filters);
  }, [records, filters]);

  // Unique units for dropdown filter
  const uniqueUnits = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.unit) set.add(r.unit);
    });
    return Array.from(set).sort();
  }, [records]);

  // High risk records list
  const highRiskRecords = useMemo(() => {
    return records.filter(r => 
      r.priority === 'urgent' || 
      r.priority === 'high_risk' || 
      r.bmi >= 30 || 
      r.fattyLiverGrade === 'grade_2' || 
      r.fattyLiverGrade === 'grade_3'
    );
  }, [records]);

  // Delete handler
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`آیا از حذف پرونده مشاوره تغذیه پرسنل «${name}» اطمینان دارید؟ این عمل غیرقابل بازگشت است.`)) {
      return;
    }

    try {
      await nutritionService.deleteRecord(id);
      await loadRecords();
    } catch (err) {
      alert('خطا در حذف پرونده از سرور.');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;

    const headers = [
      'شماره پرونده',
      'تاریخ مراجعه',
      'کد پرسنلی',
      'کد ملی',
      'نام و نام خانوادگی',
      'واحد سازمانی',
      'سمت سازمانی',
      'قد (cm)',
      'وزن (kg)',
      'BMI',
      'رده BMI',
      'دور کمر (cm)',
      'نسبت WHR',
      'کبد چرب',
      'هدف رژیم',
      'کالری هدف',
      'وضعیت پیگیری',
      'تاریخ پیگیری بعدی',
      'اولویت',
      'کارشناس مشاور'
    ];

    const rows = filteredRecords.map(r => [
      r.recordNumber,
      r.visitDate,
      r.personnelCode,
      r.nationalCode,
      r.fullName,
      r.unit,
      r.jobTitle,
      r.height,
      r.weight,
      r.bmi,
      r.bmiCategory,
      r.waistCircumference || '',
      r.whr || '',
      r.fattyLiverGrade,
      r.dietGoal,
      r.dailyCalorieTarget || '',
      r.followUpStatus,
      r.nextFollowUpDate || '',
      r.priority,
      r.consultantName
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(v => `"${v}"`).join(','))].join('\n');
    downloadCsvFile(`hse_nutrition_dossiers_${todayJalali.replace(/\//g, '-')}.csv`, csvContent);
  };

  const getBmiBadge = (category: NutritionBmiCategory) => {
    switch (category) {
      case 'underweight':
        return { label: 'کم‌وزن', color: 'text-amber-700 dark:text-amber-300' };
      case 'normal':
        return { label: 'نرمال', color: 'text-emerald-700 dark:text-emerald-300 font-bold' };
      case 'overweight':
        return { label: 'اضافه وزن', color: 'text-orange-700 dark:text-orange-300 font-bold' };
      case 'obese_1':
      case 'obese_2':
      case 'obese_3':
        return { label: 'چاقی مفرط', color: 'text-rose-700 dark:text-rose-300 font-bold' };
      default:
        return { label: 'نامشخص', color: 'text-slate-500' };
    }
  };

  const getGoalLabel = (goal: string) => {
    switch (goal) {
      case 'weight_loss': return 'کاهش وزن';
      case 'weight_gain': return 'افزایش وزن';
      case 'weight_maintenance': return 'تثبیت وزن';
      case 'fatty_liver_reversal': return 'بهبود کبد چرب';
      case 'diabetes_control': return 'کنترل قند';
      case 'hypertension_dash': return 'کاهش فشار خون';
      case 'shift_work_optimization': return 'رژیم نوبت‌کاری';
      default: return 'سلامت عمومی';
    }
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto" dir="rtl">
      
      {/* Top Banner & Actions */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
            <Apple className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>زیرماژول کارشناس تغذیه و رژیم‌درمانی</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              پایش وضعیت تغذیه، شاخص‌های آنتروپومتریک، عادات غذایی، برنامه‌ها و مشاوره‌های تخصصی پرسنل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRecords.length === 0}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="خروجی اکسل و CSV"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>خروجی اکسل</span>
          </button>
          <button
            type="button"
            onClick={loadRecords}
            className="p-2.5 bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-2xl transition cursor-pointer"
            title="بازخوانی داده‌ها"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingRecord(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-2xl flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت پرونده و مشاوره جدید</span>
          </button>
        </div>
      </div>

      {/* Real Statistics Cards strictly calculated from DB */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">کل مراجعات ثبت‌شده</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white">{stats.totalRecords}</span>
            <Apple className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">پرسنل پایش‌شده</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white">{stats.totalUniquePersonnel}</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">وزن متناسب (BMI نرمال)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">{stats.bmiDistribution.normal}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">اضافه وزن و چاقی</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-orange-600 dark:text-orange-400">
              {stats.bmiDistribution.overweight + stats.bmiDistribution.obese}
            </span>
            <Scale className="w-4 h-4 text-orange-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">کبد چرب (گرید ۱ تا ۳)</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
              {stats.fattyLiverDistribution.grade_1 + stats.fattyLiverDistribution.grade_2 + stats.fattyLiverDistribution.grade_3}
            </span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
        </div>

        <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span className="text-[11px] text-slate-400 block font-bold">پیگیری فعال / پرخطر</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">{stats.highRiskCount}</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
        </div>
      </div>

      {/* Main View Segmented Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'table'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>فهرست پرونده‌ها و مراجعات ({filteredRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span>داشبورد و تحلیل شاخص‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('high_risk')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'high_risk'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>بیماری‌های پرخطر و پیگیری ({highRiskProfiles.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Dossiers Table & Filters */}
      {activeTab === 'table' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search query */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={filters.searchQuery}
                  onChange={e => setFilters({ ...filters, searchQuery: e.target.value })}
                  placeholder="جستجو با نام، کد پرسنلی یا کد ملی..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>

              {/* Unit Filter */}
              <div>
                <select
                  value={filters.unit}
                  onChange={e => setFilters({ ...filters, unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="">تمام واحدهای سازمانی</option>
                  {uniqueUnits.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* BMI Category Filter */}
              <div>
                <select
                  value={filters.bmiCategory}
                  onChange={e => setFilters({ ...filters, bmiCategory: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="all">تمام وضعیت‌های BMI</option>
                  <option value="underweight">کم‌وزن (Underweight)</option>
                  <option value="normal">وزن نرمال (Normal)</option>
                  <option value="overweight">اضافه وزن (Overweight)</option>
                  <option value="obese">چاقی مفرط (Obese)</option>
                </select>
              </div>

              {/* Diet Goal Filter */}
              <div>
                <select
                  value={filters.dietGoal}
                  onChange={e => setFilters({ ...filters, dietGoal: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="all">تمام اهداف رژیم</option>
                  <option value="weight_loss">کاهش وزن</option>
                  <option value="fatty_liver_reversal">کبد چرب</option>
                  <option value="diabetes_control">کنترل قند</option>
                  <option value="hypertension_dash">کنترل فشار خون</option>
                  <option value="shift_work_optimization">رژیم شیفت‌کاری</option>
                  <option value="general_wellness">سلامت عمومی</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <select
                  value={filters.priority}
                  onChange={e => setFilters({ ...filters, priority: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="all">تمام سطوح اولویت</option>
                  <option value="routine">عادی (Routine)</option>
                  <option value="high_risk">پرخطر (High Risk)</option>
                  <option value="urgent">اورژانسی (Urgent)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                <span>در حال بارگذاری پرونده‌ها...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <Apple className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-bold">هیچ پرونده مشاوره‌ای یافت نشد.</p>
                <p className="text-[11px] text-slate-400">
                  برای ثبت اولین پرونده، بر روی «ثبت پرونده و مشاوره جدید» کلیک کنید.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold">
                      <th className="p-3.5">مشخصات پرسنل</th>
                      <th className="p-3.5">واحد / سمت</th>
                      <th className="p-3.5">تاریخ مراجعه</th>
                      <th className="p-3.5">تن‌سنجی (قد / وزن)</th>
                      <th className="p-3.5">شاخص BMI</th>
                      <th className="p-3.5">هدف رژیم</th>
                      <th className="p-3.5">کبد چرب</th>
                      <th className="p-3.5">پیگیری بعدی</th>
                      <th className="p-3.5 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {filteredRecords.map(record => {
                      const bmiInfo = getBmiBadge(record.bmiCategory);
                      return (
                        <tr 
                          key={record.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors"
                        >
                          <td className="p-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {record.fullName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              کد: {record.personnelCode}
                            </div>
                          </td>

                          <td className="p-3.5">
                            <div className="text-slate-800 dark:text-slate-200 font-medium">
                              {record.unit || 'نامشخص'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {record.jobTitle || '---'}
                            </div>
                          </td>

                          <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                            {record.visitDate}
                            {record.visitTime && <span className="block text-[10px] text-slate-400">{record.visitTime}</span>}
                          </td>

                          <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                            <span>{record.height} cm</span>
                            <span aria-hidden="true" className="mx-1 text-slate-300">/</span>
                            <span>{record.weight} kg</span>
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-baseline gap-1 font-mono">
                              <strong className="text-slate-900 dark:text-white font-black">{record.bmi}</strong>
                              <span className={`text-[10px] ${bmiInfo.color}`}>
                                ({bmiInfo.label})
                              </span>
                            </div>
                          </td>

                          <td className="p-3.5 text-slate-800 dark:text-slate-200 font-medium">
                            {getGoalLabel(record.dietGoal)}
                          </td>

                          <td className="p-3.5">
                            <span className="text-slate-700 dark:text-slate-300">
                              {record.fattyLiverGrade === 'none' ? 'طبیعی' : `گرید ${record.fattyLiverGrade.replace('grade_', '')}`}
                            </span>
                          </td>

                          <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                            {record.nextFollowUpDate || '---'}
                          </td>

                          <td className="p-3.5">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedRecordForDetail(record)}
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                                title="مشاهده پرونده کامل"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRecordForPrint(record)}
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                                title="چاپ برگه رژیم"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRecord(record);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                                title="ویرایش"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(record.id, record.fullName)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Executive Analytics Dashboard (Strictly calculated from real DB) */}
      {activeTab === 'analytics' && (
        <div className="space-y-5">
          {records.length === 0 ? (
            <div className="p-12 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 space-y-2">
              <BarChart3 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="font-bold">داده‌ای جهت تحلیل آماری وجود ندارد.</p>
              <p className="text-[11px] text-slate-400">
                پس از ثبت اولین پرونده، نمودارها و آمارها به صورت بلادرنگ از پایگاه داده محاسبه خواهند شد.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* BMI Distribution Breakdown */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                  <h3 className="font-black text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600" />
                    <span>توزیع شاخص توده بدنی (BMI)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">{stats.totalRecords} پرونده</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>وزن طبیعی و نرمال (BMI: 18.5 - 24.9)</span>
                      <strong className="font-mono text-emerald-600">{stats.bmiDistribution.normal}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(stats.bmiDistribution.normal / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>اضافه وزن (BMI: 25.0 - 29.9)</span>
                      <strong className="font-mono text-orange-600">{stats.bmiDistribution.overweight}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-orange-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(stats.bmiDistribution.overweight / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>چاقی مفرط (BMI &ge; 30)</span>
                      <strong className="font-mono text-rose-600">{stats.bmiDistribution.obese}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(stats.bmiDistribution.obese / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>کم‌وزن (BMI &lt; 18.5)</span>
                      <strong className="font-mono text-amber-600">{stats.bmiDistribution.underweight}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(stats.bmiDistribution.underweight / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fatty Liver Breakdown */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                  <h3 className="font-black text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <span>شیوع کبد چرب در پرسنل</span>
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>سالم و بدون کبد چرب</span>
                      <strong className="font-mono text-emerald-600">{stats.fattyLiverDistribution.none}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${(stats.fattyLiverDistribution.none / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>کبد چرب گرید ۱ (خفیف)</span>
                      <strong className="font-mono text-amber-600">{stats.fattyLiverDistribution.grade_1}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${(stats.fattyLiverDistribution.grade_1 / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>کبد چرب گرید ۲ (متوسط)</span>
                      <strong className="font-mono text-orange-600">{stats.fattyLiverDistribution.grade_2}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-orange-500 h-full rounded-full"
                        style={{ width: `${(stats.fattyLiverDistribution.grade_2 / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 text-slate-700 dark:text-slate-300 font-medium">
                      <span>کبد چرب گرید ۳ (شدید)</span>
                      <strong className="font-mono text-rose-600">{stats.fattyLiverDistribution.grade_3}</strong>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-rose-500 h-full rounded-full"
                        style={{ width: `${(stats.fattyLiverDistribution.grade_3 / stats.totalRecords) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Nutrition Goals */}
              <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                  <h3 className="font-black text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <Salad className="w-4 h-4 text-emerald-600" />
                    <span>اهداف رژیم‌های درخواستی</span>
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  {stats.topGoals.map(g => (
                    <div key={g.goal} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {getGoalLabel(g.goal)}
                      </span>
                      <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                        {g.count} پرونده
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* TAB 3: High Risk & Active Follow-ups */}
      {activeTab === 'high_risk' && (
        <HighRiskPersonnelTab
          profiles={highRiskProfiles}
          loading={loadingHighRisk}
          onRefresh={loadRecords}
          onOpenDetail={(record) => setSelectedRecordForDetail(record)}
          onOpenPrint={(record) => setSelectedRecordForPrint(record)}
          currentUser={currentUser}
          todayJalali={todayJalali}
        />
      )}

      {/* Record Creation / Editing Modal */}
      <NutritionRecordModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecord(null);
        }}
        onSave={async (data) => {
          await nutritionService.saveRecord(data, currentUser);
          await loadRecords();
        }}
        initialData={editingRecord}
        currentUser={currentUser}
        todayJalali={todayJalali}
      />

      {/* Record Detail 360 Dossier Modal */}
      <NutritionRecordDetailModal
        isOpen={!!selectedRecordForDetail}
        onClose={() => setSelectedRecordForDetail(null)}
        record={selectedRecordForDetail}
        onEdit={(rec) => {
          setSelectedRecordForDetail(null);
          setEditingRecord(rec);
          setIsModalOpen(true);
        }}
        onOpenPrint={(rec) => {
          setSelectedRecordForPrint(rec);
        }}
      />

      {/* Printable Care Plan Sheet Modal */}
      <NutritionCarePlanPrintModal
        isOpen={!!selectedRecordForPrint}
        onClose={() => setSelectedRecordForPrint(null)}
        record={selectedRecordForPrint}
      />

    </div>
  );
}
