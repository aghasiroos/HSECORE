import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
} from 'recharts';
import { 
  BarChart3, 
  LineChart as LineChartIcon, 
  PieChart as PieChartIcon, 
  AreaChart as AreaChartIcon, 
  GripVertical, 
  Filter, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Maximize2, 
  Minimize2, 
  Download, 
  Printer, 
  SlidersHorizontal,
  ChevronDown,
  X,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { WarningRecord } from '../../types';
import { printService } from '../../services/printService';
import { getComplexPersonnelList } from '../../utils/personnelHelper';
import { apiDb } from '../../services/apiDatabaseClient';
import * as XLSX from 'xlsx';

export type ChartType = 'bar' | 'line' | 'pie' | 'area';

export type WarningMetric = 
  | 'unit'             // توزیع بر اساس واحد سازمانی
  | 'month'            // روند زمانی ماهانه
  | 'year'             // توزیع سالانه
  | 'type'             // نوع اخطار (فردی / واحدی)
  | 'site'             // سایت کاری
  | 'reason'           // علت و موضوع تخلف
  | 'jobTitle'         // رده شغلی پرسنل
  | 'medicalStatus'    // وضعیت سلامت و معاینه ادواری
  | 'repeatOffenders'; // پرتکرارترین افراد دریافت‌کننده اخطار

export interface ChartConfig {
  id: string;
  title: string;
  chartType: ChartType;
  metric: WarningMetric;
  colSpan: 1 | 2; // ۱ ستونه یا تمام‌عرض
  colorTheme: string;
}

interface CustomizableWarningChartsProps {
  warnings: WarningRecord[];
  language: 'en' | 'fa';
  currentUser?: any;
}

const MONTHS_ORDER = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

const PALETTE = [
  '#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', 
  '#10b981', '#f59e0b', '#ef4444', '#ec4899', 
  '#14b8a6', '#2563eb', '#84cc16', '#a855f7'
];

const DEFAULT_CHARTS: ChartConfig[] = [
  {
    id: 'chart_unit',
    title: 'توزیع اخطارها بر اساس واحد سازمانی',
    chartType: 'bar',
    metric: 'unit',
    colSpan: 1,
    colorTheme: '#8b5cf6'
  },
  {
    id: 'chart_month',
    title: 'روند زمانی ماهانه ثبت تخلفات ایمنی',
    chartType: 'area',
    metric: 'month',
    colSpan: 1,
    colorTheme: '#f59e0b'
  },
  {
    id: 'chart_type',
    title: 'نسبت اخطارهای فردی به واحدی',
    chartType: 'pie',
    metric: 'type',
    colSpan: 1,
    colorTheme: '#3b82f6'
  },
  {
    id: 'chart_medical',
    title: 'تحلیل وضعیت سلامت و معاینات ادواری پرسنل متخلف',
    chartType: 'bar',
    metric: 'medicalStatus',
    colSpan: 1,
    colorTheme: '#10b981'
  },
  {
    id: 'chart_reason',
    title: 'فراوانی علل و مصادیق نقض موازین ایمنی',
    chartType: 'bar',
    metric: 'reason',
    colSpan: 2,
    colorTheme: '#ef4444'
  },
  {
    id: 'chart_job',
    title: 'تحلیل اخطارها بر اساس رده شغلی پرسنل',
    chartType: 'bar',
    metric: 'jobTitle',
    colSpan: 1,
    colorTheme: '#06b6d4'
  },
  {
    id: 'chart_repeat',
    title: 'افراد دارای بیشترین سابقه ثبت اخطار',
    chartType: 'bar',
    metric: 'repeatOffenders',
    colSpan: 1,
    colorTheme: '#2563eb'
  }
];

export const CustomizableWarningCharts: React.FC<CustomizableWarningChartsProps> = ({
  warnings,
  language,
  currentUser
}) => {
  const isFa = language === 'fa';
  const printRef = useRef<HTMLDivElement>(null);

  // Storage key based on user
  const userKey = currentUser?.id || currentUser?.username || 'default_user';
  const storageKey = `hse_custom_charts_settings_${userKey}`;

  // State: Chart Configurations
  const [charts, setCharts] = useState<ChartConfig[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load chart preferences, fallback to defaults:', e);
    }
    return DEFAULT_CHARTS;
  });

  // Save to localStorage when charts config change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(charts));
    } catch (e) {
      console.warn('Failed to persist chart preferences:', e);
    }
  }, [charts, storageKey]);

  // Personnel & Medical Exams data for enrichment
  const [medicalExams, setMedicalExams] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    apiDb.getMedicalExams().then(exams => {
      if (isMounted && Array.isArray(exams)) {
        setMedicalExams(exams);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const personnelList = useMemo(() => {
    return getComplexPersonnelList();
  }, []);

  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<string>('all');
  const [selectedMedicalStatus, setSelectedMedicalStatus] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(true);

  // Drag and Drop state
  const [draggedChartId, setDraggedChartId] = useState<string | null>(null);
  const [dragOverChartId, setDragOverChartId] = useState<string | null>(null);

  // Inline editing state for chart title
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState<string>('');

  // Enrich Warnings with personnel and medical exam information
  const enrichedWarnings = useMemo(() => {
    const personnelByFullName = new Map<string, any>();
    const personnelByCode = new Map<string, any>();
    personnelList.forEach(p => {
      if (p.fullName) personnelByFullName.set(p.fullName.trim().toLowerCase(), p);
      if (p.effectiveCode) personnelByCode.set(String(p.effectiveCode).trim(), p);
      if (p.nationalCode) personnelByCode.set(String(p.nationalCode).trim(), p);
      if (p.personnelCode) personnelByCode.set(String(p.personnelCode).trim(), p);
    });

    // Medical exams indexed by personnel
    const examsByPersonnel = new Map<string, any>();
    medicalExams.forEach(ex => {
      const code = String(ex.nationalCode || ex.personnelCode || '').trim();
      const name = String(ex.personnelName || ex.name || '').trim().toLowerCase();
      if (code) examsByPersonnel.set(code, ex);
      if (name) examsByPersonnel.set(name, ex);
    });

    return warnings.map((w, idx) => {
      const safeName = (w.name || (w as any).personnelName || '').trim();
      const safeCode = String((w as any).personnelCode || (w as any).nationalCode || '').trim();
      
      const matchedPerson = (safeCode && personnelByCode.get(safeCode)) || 
                            (safeName && personnelByFullName.get(safeName.toLowerCase()));

      const jobTitle = matchedPerson?.jobTitle || (w as any).jobTitle || 'پرسنل عملیاتی';
      const personUnit = w.unit || matchedPerson?.unit || 'عمومی';

      const matchedExam = (safeCode && examsByPersonnel.get(safeCode)) || 
                          (safeName && examsByPersonnel.get(safeName.toLowerCase()));
      
      let medicalStatus = 'ثبت نشده';
      if (matchedExam) {
        const rawStatus = (matchedExam.fitnessStatus || matchedExam.status || matchedExam.doctorOpinion || '').toLowerCase();
        if (rawStatus.includes('fit') || rawStatus.includes('مناسب') || rawStatus.includes('صلاحیت')) {
          medicalStatus = 'دارای صلاحیت کامل (Fit)';
        } else if (rawStatus.includes('cond') || rawStatus.includes('مشروط')) {
          medicalStatus = 'مشروط با محدودیت (Conditional)';
        } else if (rawStatus.includes('unfit') || rawStatus.includes('عدم') || rawStatus.includes('نامناسب')) {
          medicalStatus = 'عدم صلاحیت (Unfit)';
        } else if (rawStatus.includes('ref') || rawStatus.includes('ارجاع')) {
          medicalStatus = 'نیازمند ارجاع تخصصی';
        } else {
          medicalStatus = matchedExam.fitnessStatus || 'بررسی شده';
        }
      }

      return {
        ...w,
        id: String(w.id || `w_${idx + 1}`),
        day: Number(w.day) || 1,
        month: String(w.month || 'فروردین'),
        year: Number(w.year) || 1404,
        unit: personUnit,
        jobTitle: jobTitle,
        medicalStatus: medicalStatus,
        name: safeName || 'ناشناس',
        site: w.site || 'رجال',
        type: (w.type === 'واحدی' ? 'واحدی' : 'فردی') as 'فردی' | 'واحدی',
        reason: w.reason || 'نقض موازین ایمنی'
      };
    });
  }, [warnings, personnelList, medicalExams]);

  // Extract distinct filter options
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    enrichedWarnings.forEach(w => { if (w.year) set.add(w.year); });
    return Array.from(set).sort((a, b) => b - a);
  }, [enrichedWarnings]);

  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    enrichedWarnings.forEach(w => { if (w.unit) set.add(w.unit); });
    return Array.from(set).sort();
  }, [enrichedWarnings]);

  const availableJobs = useMemo(() => {
    const set = new Set<string>();
    enrichedWarnings.forEach(w => { if (w.jobTitle) set.add(w.jobTitle); });
    return Array.from(set).sort();
  }, [enrichedWarnings]);

  const availableMedicalStatuses = useMemo(() => {
    const set = new Set<string>();
    enrichedWarnings.forEach(w => { if (w.medicalStatus) set.add(w.medicalStatus); });
    return Array.from(set).sort();
  }, [enrichedWarnings]);

  // Apply Global Filters
  const filteredWarnings = useMemo(() => {
    return enrichedWarnings.filter(w => {
      if (selectedYear !== 'all' && String(w.year) !== selectedYear) return false;
      if (selectedMonth !== 'all' && w.month !== selectedMonth) return false;
      if (selectedUnit !== 'all' && w.unit !== selectedUnit) return false;
      if (selectedJob !== 'all' && w.jobTitle !== selectedJob) return false;
      if (selectedMedicalStatus !== 'all' && w.medicalStatus !== selectedMedicalStatus) return false;
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        const matchName = (w.name || '').toLowerCase().includes(q);
        const matchUnit = (w.unit || '').toLowerCase().includes(q);
        const matchReason = (w.reason || '').toLowerCase().includes(q);
        const matchNumber = (w.number || '').toLowerCase().includes(q);
        const matchJob = (w.jobTitle || '').toLowerCase().includes(q);
        if (!matchName && !matchUnit && !matchReason && !matchNumber && !matchJob) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedWarnings, selectedYear, selectedMonth, selectedUnit, selectedJob, selectedMedicalStatus, filterSearch]);

  const activeFiltersCount = [
    selectedYear !== 'all',
    selectedMonth !== 'all',
    selectedUnit !== 'all',
    selectedJob !== 'all',
    selectedMedicalStatus !== 'all',
    !!filterSearch.trim()
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedYear('all');
    setSelectedMonth('all');
    setSelectedUnit('all');
    setSelectedJob('all');
    setSelectedMedicalStatus('all');
    setFilterSearch('');
  };

  // Metric Data Calculators
  const getMetricData = (metric: WarningMetric) => {
    if (metric === 'month') {
      const counts: Record<string, number> = {};
      MONTHS_ORDER.forEach(m => { counts[m] = 0; });
      filteredWarnings.forEach(w => {
        if (w.month && counts[w.month] !== undefined) {
          counts[w.month]++;
        }
      });
      return MONTHS_ORDER.map(m => ({
        name: m,
        count: counts[m] || 0
      }));
    }

    if (metric === 'year') {
      const counts: Record<string, number> = {};
      filteredWarnings.forEach(w => {
        const y = String(w.year);
        counts[y] = (counts[y] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (metric === 'repeatOffenders') {
      const counts: Record<string, { count: number; unit: string }> = {};
      filteredWarnings.forEach(w => {
        const name = w.name || 'نامشخص';
        if (!counts[name]) counts[name] = { count: 0, unit: w.unit };
        counts[name].count++;
      });
      return Object.entries(counts)
        .map(([name, val]) => ({ name, count: val.count, unit: val.unit }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    }

    // Default key aggregation
    const keyMap: Record<string, string> = {
      unit: 'unit',
      type: 'type',
      site: 'site',
      reason: 'reason',
      jobTitle: 'jobTitle',
      medicalStatus: 'medicalStatus'
    };
    const targetProp = keyMap[metric] || 'unit';
    const counts: Record<string, number> = {};
    filteredWarnings.forEach(w => {
      const val = String((w as any)[targetProp] || 'نامشخص');
      counts[val] = (counts[val] || 0) + 1;
    });

    const list = Object.entries(counts).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => b.count - a.count);

    // Limit reasons or jobs to top 10 for readability
    if (metric === 'reason' || metric === 'jobTitle') {
      return list.slice(0, 10);
    }
    return list;
  };

  // Chart actions
  const updateChartType = (id: string, type: ChartType) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, chartType: type } : c));
  };

  const updateChartMetric = (id: string, metric: WarningMetric) => {
    const titles: Record<WarningMetric, string> = {
      unit: 'توزیع اخطارها بر اساس واحد سازمانی',
      month: 'روند زمانی ماهانه ثبت تخلفات ایمنی',
      year: 'توزیع سالانه اخطارها',
      type: 'نسبت اخطارهای فردی به واحدی',
      site: 'توزیع اخطارها بر اساس سایت عملیاتی',
      reason: 'فراوانی علل و موضوعات تخلف ایمنی',
      jobTitle: 'تحلیل اخطارها بر اساس رده شغلی',
      medicalStatus: 'تحلیل وضعیت سلامت و معاینات ادواری',
      repeatOffenders: 'پرتکرارترین افراد دریافت‌کننده اخطار'
    };

    setCharts(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          metric,
          title: titles[metric] || c.title
        };
      }
      return c;
    }));
  };

  const toggleColSpan = (id: string) => {
    setCharts(prev => prev.map(c => c.id === id ? { ...c, colSpan: c.colSpan === 1 ? 2 : 1 } : c));
  };

  const removeChart = (id: string) => {
    if (charts.length <= 1) {
      alert(isFa ? 'حداقل یک نمودار باید در داشبورد فعال باشد.' : 'At least one chart must remain active.');
      return;
    }
    setCharts(prev => prev.filter(c => c.id !== id));
  };

  const addNewChart = () => {
    const newId = `chart_${Date.now()}`;
    const newChart: ChartConfig = {
      id: newId,
      title: 'نمودار تحلیلی جدید',
      chartType: 'bar',
      metric: 'unit',
      colSpan: 1,
      colorTheme: PALETTE[charts.length % PALETTE.length]
    };
    setCharts(prev => [...prev, newChart]);
  };

  const resetToDefaultCharts = () => {
    if (window.confirm(isFa ? 'آیا مایلید چیدمان و تنظیمات نمودارها به حالت پیش‌فرض سامانه بازگردد؟' : 'Reset all chart layouts and settings to system default?')) {
      setCharts(DEFAULT_CHARTS);
    }
  };

  // Inline Title Save
  const startEditTitle = (c: ChartConfig) => {
    setEditingTitleId(c.id);
    setEditingTitleValue(c.title);
  };

  const saveTitle = (id: string) => {
    if (editingTitleValue.trim()) {
      setCharts(prev => prev.map(c => c.id === id ? { ...c, title: editingTitleValue.trim() } : c));
    }
    setEditingTitleId(null);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedChartId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedChartId !== id) {
      setDragOverChartId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverChartId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedChartId || draggedChartId === targetId) {
      setDraggedChartId(null);
      setDragOverChartId(null);
      return;
    }

    const newCharts = [...charts];
    const sourceIndex = newCharts.findIndex(c => c.id === draggedChartId);
    const targetIndex = newCharts.findIndex(c => c.id === targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [moved] = newCharts.splice(sourceIndex, 1);
      newCharts.splice(targetIndex, 0, moved);
      setCharts(newCharts);
    }

    setDraggedChartId(null);
    setDragOverChartId(null);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Raw filtered records
    const rawData = filteredWarnings.map((w, idx) => ({
      'ردیف': idx + 1,
      'شماره اخطار': w.number || '',
      'تاریخ': `${w.year}/${w.month}/${w.day}`,
      'نام پرسنل': w.name,
      'واحد سازمانی': w.unit,
      'رده شغلی': w.jobTitle,
      'وضعیت معاینه ادواری': w.medicalStatus,
      'سایت': w.site,
      'نوع اخطار': w.type,
      'علت و شرح تخلف': w.reason
    }));
    const ws1 = XLSX.utils.json_to_sheet(rawData);
    XLSX.utils.book_append_sheet(wb, ws1, 'داده‌های فیلترشده اخطارها');

    // Sheet 2: Chart Aggregations
    const aggSummary: any[] = [];
    charts.forEach(c => {
      const data = getMetricData(c.metric);
      data.forEach(item => {
        aggSummary.push({
          'عنوان نمودار': c.title,
          'شاخص تحلیلی': c.metric,
          'عنوان دسته / مقطع': item.name,
          'تعداد تخلفات': item.count
        });
      });
    });
    const ws2 = XLSX.utils.json_to_sheet(aggSummary);
    XLSX.utils.book_append_sheet(wb, ws2, 'خلاصه شاخص‌های نمودارها');

    XLSX.writeFile(wb, `HSE_Safety_Warnings_Analytics_${Date.now()}.xlsx`);
  };

  // Print / PDF
  const handlePrintDashboard = () => {
    printService.printElement('customizable-charts-container', {
      title: 'داشبورد هوشمند و گزارش تحلیلی اخطارهای کتبی و انضباطی ایمنی',
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: 'HSE-WARN-STAT',
      documentDate: new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      isFa: isFa,
      autoPrint: true
    });
  };

  return (
    <div className="space-y-6 select-none" id="customizable-charts-container">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #customizable-charts-container, #customizable-charts-container * {
            visibility: visible;
          }
          #customizable-charts-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px !important;
          }
          .no-print, button, select, input, .cursor-grab {
            display: none !important;
          }
          .print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Official Print Header (Only visible on print / PDF export) */}
      <div className="hidden print:block pb-4 mb-4 border-b-2 border-slate-800 text-slate-900 text-right space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-left font-mono text-xs text-slate-600">
            <div>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
            <div>تعداد کل پرونده‌های فیلترشده: {filteredWarnings.length} مورد</div>
          </div>
          <div className="text-center flex-1">
            <h1 className="text-xl font-black">سامانه جامع مدیریت سلامت، ایمنی و محیط زیست (HSE)</h1>
            <h2 className="text-sm font-bold text-slate-700 mt-1">گزارش و هوش آماری اخطارهای کتبی و انضباطی پرسنل</h2>
          </div>
        </div>
        <div className="text-[11px] text-slate-600 bg-slate-100 p-2 rounded flex justify-between">
          <span>دامنه فیلتر: سال: {selectedYear === 'all' ? 'همه' : selectedYear} | ماه: {selectedMonth === 'all' ? 'همه' : selectedMonth} | واحد: {selectedUnit === 'all' ? 'همه' : selectedUnit} | شغل: {selectedJob === 'all' ? 'همه' : selectedJob}</span>
          <span>وضعیت معاینه: {selectedMedicalStatus === 'all' ? 'همه' : selectedMedicalStatus}</span>
        </div>
      </div>

      {/* Top Header & Action Controls */}
      <div className="no-print bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-lg border border-slate-700/50 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/20 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {isFa ? 'داشبورد هوشمند و شخصی‌سازی‌شده تحلیل اخطارها' : 'Customizable Safety Warnings Dashboard'}
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {isFa 
                  ? 'شخصی‌سازی نامحدود نوع، ابعاد، شاخص و چیدمان با کشیدن و رها کردن (Drag & Drop) همراه با فیلتر مشترک' 
                  : 'Customize chart types, dimensions, metrics and layout with real-time synchronized filtering'}
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Top Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              showFiltersPanel 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{isFa ? 'فیلترهای همزمان' : 'Synced Filters'}</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button
            onClick={addNewChart}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
            title={isFa ? 'افزودن نمودار جدید به داشبورد' : 'Add new chart'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isFa ? 'افزودن نمودار' : 'Add Chart'}</span>
          </button>

          <button
            onClick={resetToDefaultCharts}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold transition-all"
            title={isFa ? 'بازنشانی چیدمان به پیش‌فرض' : 'Reset layout'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isFa ? 'بازنشانی چیدمان' : 'Reset'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-bold transition-all"
            title={isFa ? 'خروجی اکسل از نمودارها و داده‌ها' : 'Export Excel'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isFa ? 'اکسل' : 'Excel'}</span>
          </button>

          <button
            onClick={handlePrintDashboard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-bold transition-all"
            title={isFa ? 'چاپ و خروجی PDF رسمی' : 'Print / PDF'}
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span>{isFa ? 'چاپ / PDF' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Global Unified Filters Bar */}
      {showFiltersPanel && (
        <div className="no-print bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 transition-all">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                {isFa ? 'فیلتر مشترک سراسری (بروزرسانی بلادرنگ تمام نمودارها)' : 'Global Real-time Filters'}
              </span>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>{isFa ? 'پاکسازی فیلترها' : 'Clear All'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {/* Filter: Year */}
            <div className="space-y-1">
              <label className="text-slate-500 dark:text-slate-400 font-bold block">{isFa ? 'سال شمسی' : 'Year'}</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{isFa ? 'تمام سال‌ها' : 'All Years'}</option>
                {availableYears.map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            {/* Filter: Month */}
            <div className="space-y-1">
              <label className="text-slate-500 dark:text-slate-400 font-bold block">{isFa ? 'ماه سال' : 'Month'}</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{isFa ? 'تمام ماه‌ها' : 'All Months'}</option>
                {MONTHS_ORDER.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Filter: Organizational Unit */}
            <div className="space-y-1">
              <label className="text-slate-500 dark:text-slate-400 font-bold block">{isFa ? 'واحد سازمانی' : 'Unit'}</label>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{isFa ? 'همه واحدها' : 'All Units'}</option>
                {availableUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Filter: Job Title */}
            <div className="space-y-1">
              <label className="text-slate-500 dark:text-slate-400 font-bold block">{isFa ? 'شغل و سمت' : 'Job Title'}</label>
              <select
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{isFa ? 'همه مشاغل' : 'All Job Titles'}</option>
                {availableJobs.map(j => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>

            {/* Filter: Medical Exam Status */}
            <div className="space-y-1">
              <label className="text-slate-500 dark:text-slate-400 font-bold block">{isFa ? 'وضعیت معاینه ادواری' : 'Medical Exam'}</label>
              <select
                value={selectedMedicalStatus}
                onChange={(e) => setSelectedMedicalStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl p-2 font-bold focus:outline-none focus:border-indigo-500"
              >
                <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
                {availableMedicalStatuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Search bar within filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder={isFa ? 'جستجوی نام فرد، شماره اخطار، علت یا واحد...' : 'Search person, code, violation...'}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500"
              />
              {filterSearch && (
                <button
                  onClick={() => setFilterSearch('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              {isFa ? 'نتایج منطبق:' : 'Matching Records:'} <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs">{filteredWarnings.length}</span> {isFa ? 'مورد' : 'records'}
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid with Drag & Drop */}
      <div 
        ref={printRef}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6" 
        id="warning-charts-grid"
      >
        {charts.map((config) => {
          const chartData = getMetricData(config.metric);
          const isFullWidth = config.colSpan === 2;
          const isDragging = draggedChartId === config.id;
          const isDragOver = dragOverChartId === config.id;

          return (
            <div
              key={config.id}
              draggable
              onDragStart={(e) => handleDragStart(e, config.id)}
              onDragOver={(e) => handleDragOver(e, config.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, config.id)}
              className={`print-card bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 shadow-sm p-5 space-y-4 flex flex-col justify-between ${
                isFullWidth ? 'lg:col-span-2' : 'lg:col-span-1'
              } ${
                isDragging ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
              } ${
                isDragOver ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Card Header & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                {/* Title & Drag Handle */}
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <div 
                    className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                    title={isFa ? 'برای جابه‌جایی نمودار بکشید' : 'Drag to reorder'}
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {editingTitleId === config.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={editingTitleValue}
                        onChange={(e) => setEditingTitleValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveTitle(config.id)}
                        autoFocus
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-indigo-500 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-100"
                      />
                      <button
                        onClick={() => saveTitle(config.id)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight line-clamp-1">
                        {config.title}
                      </h3>
                      <button
                        onClick={() => startEditTitle(config)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                        title={isFa ? 'ویرایش عنوان' : 'Edit title'}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right controls: Chart Type switcher + Metric + Resize + Remove */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Metric Selector */}
                  <select
                    value={config.metric}
                    onChange={(e) => updateChartMetric(config.id, e.target.value as WarningMetric)}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none focus:border-indigo-500"
                    title={isFa ? 'تغییر شاخص تحلیلی' : 'Change Metric'}
                  >
                    <option value="unit">{isFa ? 'واحد سازمانی' : 'Unit'}</option>
                    <option value="month">{isFa ? 'روند ماهانه' : 'Monthly Trend'}</option>
                    <option value="type">{isFa ? 'نوع اخطار (فردی/واحدی)' : 'Warning Type'}</option>
                    <option value="medicalStatus">{isFa ? 'وضعیت معاینه ادواری' : 'Medical Status'}</option>
                    <option value="jobTitle">{isFa ? 'رده شغلی' : 'Job Title'}</option>
                    <option value="reason">{isFa ? 'علت تخلف' : 'Violation Reason'}</option>
                    <option value="repeatOffenders">{isFa ? 'افراد پرتکرار' : 'Repeat Offenders'}</option>
                    <option value="site">{isFa ? 'سایت' : 'Site'}</option>
                    <option value="year">{isFa ? 'سال' : 'Year'}</option>
                  </select>

                  {/* Chart Type Toggle Buttons */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => updateChartType(config.id, 'bar')}
                      className={`p-1.5 rounded-md transition-all ${
                        config.chartType === 'bar' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title={isFa ? 'نمودار ستونی (Bar)' : 'Bar Chart'}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateChartType(config.id, 'line')}
                      className={`p-1.5 rounded-md transition-all ${
                        config.chartType === 'line' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title={isFa ? 'نمودار خطی (Line)' : 'Line Chart'}
                    >
                      <LineChartIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateChartType(config.id, 'pie')}
                      className={`p-1.5 rounded-md transition-all ${
                        config.chartType === 'pie' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title={isFa ? 'نمودار دایره‌ای (Pie)' : 'Pie Chart'}
                    >
                      <PieChartIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateChartType(config.id, 'area')}
                      className={`p-1.5 rounded-md transition-all ${
                        config.chartType === 'area' 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title={isFa ? 'نمودار مساحتی (Area)' : 'Area Chart'}
                    >
                      <AreaChartIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Colspan toggle */}
                  <button
                    onClick={() => toggleColSpan(config.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title={isFullWidth ? (isFa ? 'ابعاد استاندارد' : 'Normal width') : (isFa ? 'تمام‌عرض کردن' : 'Full width')}
                  >
                    {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>

                  {/* Remove chart */}
                  <button
                    onClick={() => removeChart(config.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    title={isFa ? 'حذف نمودار' : 'Remove chart'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chart Body */}
              <div className="h-72 w-full min-w-0 pt-2">
                {chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs space-y-1">
                    <Info className="w-6 h-6 text-slate-300" />
                    <span>{isFa ? 'هیچ رکوردی منطبق بر فیلترهای انتخابی یافت نشد.' : 'No data matching selected filters.'}</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={275} minWidth={0} minHeight={260} debounce={50}>
                    {config.chartType === 'bar' ? (
                      <BarChart 
                        data={chartData} 
                        layout={config.metric === 'unit' || config.metric === 'reason' || config.metric === 'jobTitle' ? 'vertical' : 'horizontal'}
                        margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-10" />
                        {config.metric === 'unit' || config.metric === 'reason' || config.metric === 'jobTitle' ? (
                          <>
                            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} width={100} />
                          </>
                        ) : (
                          <>
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                          </>
                        )}
                        <Tooltip 
                          formatter={(value: any) => [`${value} مورد`, isFa ? 'تعداد اخطار' : 'Count']}
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            borderColor: '#e2e8f0', 
                            color: '#1e293b', 
                            borderRadius: '12px', 
                            fontSize: '11px', 
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                            textAlign: 'right',
                            direction: 'rtl'
                          }} 
                        />
                        <Bar 
                          dataKey="count" 
                          fill={config.colorTheme || '#6366f1'} 
                          radius={config.metric === 'unit' || config.metric === 'reason' ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    ) : config.chartType === 'line' ? (
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-10" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip 
                          formatter={(value: any) => [`${value} مورد`, isFa ? 'تعداد اخطار' : 'Count']}
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            borderColor: '#e2e8f0', 
                            color: '#1e293b', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            textAlign: 'right',
                            direction: 'rtl'
                          }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke={config.colorTheme || '#3b82f6'} 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: config.colorTheme || '#3b82f6' }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    ) : config.chartType === 'area' ? (
                      <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                        <defs>
                          <linearGradient id={`grad_${config.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={config.colorTheme || '#f59e0b'} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={config.colorTheme || '#f59e0b'} stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-10" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip 
                          formatter={(value: any) => [`${value} مورد`, isFa ? 'تعداد اخطار' : 'Count']}
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            borderColor: '#e2e8f0', 
                            color: '#1e293b', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            textAlign: 'right',
                            direction: 'rtl'
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="count" 
                          stroke={config.colorTheme || '#f59e0b'} 
                          strokeWidth={2.5}
                          fillOpacity={1} 
                          fill={`url(#grad_${config.id})`} 
                        />
                      </AreaChart>
                    ) : (
                      <PieChart>
                        <Tooltip 
                          formatter={(value: any) => [`${value} مورد`, isFa ? 'تعداد اخطار' : 'Count']}
                          contentStyle={{ 
                            backgroundColor: '#ffffff', 
                            borderColor: '#e2e8f0', 
                            color: '#1e293b', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            textAlign: 'right',
                            direction: 'rtl'
                          }} 
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Pie
                          data={chartData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={45}
                          paddingAngle={3}
                          label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-pie-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                )}
              </div>

              {/* Card Footer Summary */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span>{isFa ? 'مجموع موارد:' : 'Total Items:'} <strong className="text-slate-700 dark:text-slate-300 font-mono">{chartData.reduce((acc, curr) => acc + curr.count, 0)}</strong></span>
                <span>{isFa ? 'تعداد دسته‌ها:' : 'Categories:'} <strong className="text-slate-700 dark:text-slate-300 font-mono">{chartData.length}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CustomizableWarningCharts;
