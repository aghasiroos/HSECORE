import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  BarChart2,
  TrendingUp,
  PieChart as PieIcon,
  Calendar,
  Clock,
  Users,
  GraduationCap,
  Building2,
  CheckCircle2,
  XCircle,
  Filter,
  Settings2,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';

interface CourseData {
  id: string;
  firstName: string;
  lastName: string;
  personnelCode: string;
  unit: string;
  jobTitle: string;
  courseCode: string;
  hours: number;
  date?: string; // YYYY/MM/DD or Jalali string
}

interface ContractorData {
  id: string;
  name: string;
  headcount: number;
  perCapita: number;
  date?: string;
}

interface CalendarEvent {
  id: string;
  courseCode: string;
  title: string;
  duration: number;
  date: string;
}

interface TrainingDashboardProps {
  courses: CourseData[];
  contractors: ContractorData[];
  calendarEvents: CalendarEvent[];
  courseDefsCount: number;
  isFa: boolean;
}

const JALALI_MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

const JALALI_MONTHS_EN = [
  'Farvardin', 'Ordibehesht', 'Khordad',
  'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar',
  'Dey', 'Bahman', 'Esfand'
];

export default function TrainingDashboard({
  courses,
  contractors,
  calendarEvents,
  courseDefsCount,
  isFa
}: TrainingDashboardProps) {
  const months = isFa ? JALALI_MONTHS_FA : JALALI_MONTHS_EN;

  // Chart & Dashboard Customization State
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');
  const [showComplexMetrics, setShowComplexMetrics] = useState<boolean>(true);
  const [showContractorMetrics, setShowContractorMetrics] = useState<boolean>(true);
  const [activeMetricView, setActiveMetricView] = useState<'manHours' | 'hours' | 'headcount'>('manHours');

  // Extract unique years from data
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>();
    
    courses.forEach(c => {
      if (c.date) {
        const parts = c.date.split('/');
        if (parts[0] && parts[0].length === 4) yearSet.add(parts[0]);
      }
    });

    calendarEvents.forEach(e => {
      if (e.date) {
        const parts = e.date.split('/');
        if (parts[0] && parts[0].length === 4) yearSet.add(parts[0]);
      }
    });

    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [courses, calendarEvents]);

  // Extract unique units
  const availableUnits = useMemo(() => {
    const unitSet = new Set<string>();
    courses.forEach(c => { if (c.unit) unitSet.add(c.unit); });
    return Array.from(unitSet).sort();
  }, [courses]);

  // Filtered Courses
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (selectedUnit !== 'all' && c.unit !== selectedUnit) return false;
      if (selectedYear !== 'all') {
        if (!c.date) return false;
        const year = c.date.split('/')[0];
        if (year !== selectedYear) return false;
      }
      return true;
    });
  }, [courses, selectedUnit, selectedYear]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return calendarEvents.filter(e => {
      if (selectedYear !== 'all') {
        if (!e.date) return false;
        const year = e.date.split('/')[0];
        if (year !== selectedYear) return false;
      }
      return true;
    });
  }, [calendarEvents, selectedYear]);

  // Scheduled vs Held Class Stats
  const heldClassesCount = useMemo(() => {
    // Unique course-date pairs in course records
    const uniqueHeld = new Set<string>();
    filteredCourses.forEach(c => {
      if (c.courseCode && c.date) uniqueHeld.add(`${c.courseCode}_${c.date}`);
    });
    return uniqueHeld.size;
  }, [filteredCourses]);

  const scheduledEventsCount = filteredEvents.length;
  // Classes that are scheduled but not yet recorded in executed courses
  const unheldClassesCount = useMemo(() => {
    let unheld = 0;
    filteredEvents.forEach(e => {
      const isExecuted = filteredCourses.some(c => c.courseCode === e.courseCode && c.date === e.date);
      if (!isExecuted) unheld++;
    });
    return unheld;
  }, [filteredEvents, filteredCourses]);

  // Total Personnel Training Hours & Man-Hours
  const totalComplexHours = useMemo(() => {
    return filteredCourses.reduce((sum, c) => sum + (Number(c.hours) || 0), 0);
  }, [filteredCourses]);

  // Man-Hours = sum of (hours) for each attendee
  const totalComplexManHours = totalComplexHours;

  // Contractor Metrics
  const totalContractorHeadcount = useMemo(() => {
    return contractors.reduce((sum, c) => sum + (Number(c.headcount) || 0), 0);
  }, [contractors]);

  const totalContractorHours = useMemo(() => {
    return contractors.reduce((sum, c) => sum + ((Number(c.headcount) || 0) * (Number(c.perCapita) || 0)), 0);
  }, [contractors]);

  const totalContractorManHours = totalContractorHours;

  // Monthly Breakdown Matrix for Charting
  const monthlyData = useMemo(() => {
    return months.map((monthName, idx) => {
      const monthNumStr = String(idx + 1).padStart(2, '0');

      // Complex Personnel monthly stats
      const monthCourses = filteredCourses.filter(c => {
        if (!c.date) return false;
        const parts = c.date.split('/');
        return parts.length >= 2 && (parts[1] === monthNumStr || parts[1] === String(idx + 1));
      });

      const complexHours = monthCourses.reduce((sum, c) => sum + (Number(c.hours) || 0), 0);
      const complexManHours = complexHours;
      const complexTrainees = monthCourses.length;

      // Contractor monthly distributed approximation or direct match
      const contractorRatio = 1 / 12;
      const contractorHeadcount = Math.round(totalContractorHeadcount * (monthCourses.length > 0 ? 0.1 : 0.05));
      const contractorHours = Math.round(totalContractorHours * contractorRatio);
      const contractorManHours = contractorHours;

      return {
        monthIndex: idx,
        monthName,
        complexHours,
        complexManHours,
        complexTrainees,
        contractorHeadcount,
        contractorHours,
        contractorManHours,
        totalManHours: complexManHours + contractorManHours,
        totalHours: complexHours + contractorHours
      };
    });
  }, [months, filteredCourses, totalContractorHeadcount, totalContractorHours]);

  // Find max value for chart auto-scaling
  const maxChartValue = useMemo(() => {
    let max = 10;
    monthlyData.forEach(d => {
      let val = 0;
      if (activeMetricView === 'manHours') {
        val = (showComplexMetrics ? d.complexManHours : 0) + (showContractorMetrics ? d.contractorManHours : 0);
      } else if (activeMetricView === 'hours') {
        val = (showComplexMetrics ? d.complexHours : 0) + (showContractorMetrics ? d.contractorHours : 0);
      } else {
        val = (showComplexMetrics ? d.complexTrainees : 0) + (showContractorMetrics ? d.contractorHeadcount : 0);
      }
      if (val > max) max = val;
    });
    return Math.ceil(max * 1.15);
  }, [monthlyData, activeMetricView, showComplexMetrics, showContractorMetrics]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Customization Toolbar & Global Filters */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-4 md:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/80 rounded-2xl text-blue-600 dark:text-blue-400">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base">
                {isFa ? 'داشبورد مدیریتی و پایش آماری آموزش HSE' : 'HSE Training Analytics & Executive Dashboard'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                {isFa ? 'تحلیل عملکرد، نفر-ساعات، مقایسه برگزارشده/برگذارنشده و آموزش پیمانکاران' : 'Performance KPIs, man-hours breakdown & contractor analytics'}
              </p>
            </div>
          </div>

          {/* Chart Controls & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Year Filter */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                {isFa ? 'سال:' : 'Year:'}
              </span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="bg-transparent font-black text-slate-900 dark:text-slate-100 outline-none cursor-pointer"
              >
                <option value="all">{isFa ? 'همه سال‌ها' : 'All Years'}</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Unit Filter */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5 text-xs shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-bold text-slate-600 dark:text-slate-400 text-[11px]">
                {isFa ? 'واحد:' : 'Unit:'}
              </span>
              <select
                value={selectedUnit}
                onChange={e => setSelectedUnit(e.target.value)}
                className="bg-transparent font-black text-slate-900 dark:text-slate-100 outline-none cursor-pointer max-w-[120px] truncate"
              >
                <option value="all">{isFa ? 'همه واحدها' : 'All Units'}</option>
                {availableUnits.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            {/* Chart Type Toggle */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-1 shadow-2xs gap-0.5">
              <button
                type="button"
                onClick={() => setChartType('bar')}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  chartType === 'bar'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title={isFa ? 'نمودار میله‌ای' : 'Bar Chart'}
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  chartType === 'line'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title={isFa ? 'نمودار خطی' : 'Line Chart'}
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  chartType === 'area'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title={isFa ? 'نمودار سطحی' : 'Area Chart'}
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Customization Metric Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-600 dark:text-slate-300">
              {isFa ? 'شخصی‌سازی نمایه‌های نمودار:' : 'Customize Chart Metric View:'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Metric Mode Selection */}
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-700/60 rounded-xl p-0.5 font-bold text-[11px]">
              <button
                type="button"
                onClick={() => setActiveMetricView('manHours')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  activeMetricView === 'manHours'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-black'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {isFa ? 'مجموع نفر-ساعت' : 'Total Man-Hours'}
              </button>
              <button
                type="button"
                onClick={() => setActiveMetricView('hours')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  activeMetricView === 'hours'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-black'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {isFa ? 'ساعات دوره' : 'Course Hours'}
              </button>
              <button
                type="button"
                onClick={() => setActiveMetricView('headcount')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  activeMetricView === 'headcount'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs font-black'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {isFa ? 'تعداد نفرات' : 'Headcount'}
              </button>
            </div>

            {/* Checkboxes for Series Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showComplexMetrics}
                onChange={e => setShowComplexMetrics(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                {isFa ? 'پرسنل مجتمع' : 'Complex Personnel'}
              </span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showContractorMetrics}
                onChange={e => setShowContractorMetrics(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                {isFa ? 'شرکت‌ها و پیمانکاران' : 'Contractors'}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Top Level Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Scheduled Events */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-600 rounded-r-3xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'رویدادهای زمان‌بندی‌شده' : 'Scheduled Events'}
            </span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/80 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {scheduledEventsCount}
          </div>
          <div className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{isFa ? 'ثبت‌شده در تقویم آموزش' : 'In Training Calendar'}</span>
            <span className="text-blue-600 dark:text-blue-400 font-mono font-black">{courseDefsCount} {isFa ? 'عنوان دوره' : 'Courses'}</span>
          </div>
        </div>

        {/* Card 2: Executed vs Unheld Classes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 rounded-r-3xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'کلاس‌های برگزارشده / نشده' : 'Held vs Unheld Classes'}
            </span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/80 rounded-2xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {heldClassesCount}
            </span>
            <span className="text-xs font-bold text-slate-400">{isFa ? 'برگزارشده' : 'Held'}</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-lg font-black font-mono text-amber-500">
              {unheldClassesCount}
            </span>
            <span className="text-xs font-bold text-slate-400">{isFa ? 'برگزار نشده' : 'Pending'}</span>
          </div>
          <div className="mt-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{
                width: `${(heldClassesCount + unheldClassesCount) > 0 ? (heldClassesCount / (heldClassesCount + unheldClassesCount)) * 100 : 0}%`
              }}
            ></div>
            <div
              className="bg-amber-400 h-full transition-all duration-500"
              style={{
                width: `${(heldClassesCount + unheldClassesCount) > 0 ? (unheldClassesCount / (heldClassesCount + unheldClassesCount)) * 100 : 0}%`
              }}
            ></div>
          </div>
        </div>

        {/* Card 3: Complex Personnel Hours */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 rounded-r-3xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'مجموع نفر-ساعت پرسنل' : 'Complex Man-Hours'}
            </span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/80 rounded-2xl text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
            {totalComplexManHours.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{isFa ? 'ثبت‌شده در سوابق پرسنل' : 'Recorded Records'}</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-black">{filteredCourses.length} {isFa ? 'نفر دوره' : 'trainees'}</span>
          </div>
        </div>

        {/* Card 4: Contractor Training Hours */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500 rounded-r-3xl"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'مجموع نفر-ساعت پیمانکاران' : 'Contractor Man-Hours'}
            </span>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-2xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {totalContractorManHours.toLocaleString()}
          </div>
          <div className="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{isFa ? 'تعداد شاغلین پیمانکار' : 'Contractor Headcount'}</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-black">{totalContractorHeadcount.toLocaleString()} {isFa ? 'نفر' : 'persons'}</span>
          </div>
        </div>
      </div>

      {/* Customizable Visual Chart Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h4 className="font-black text-slate-900 dark:text-white text-sm md:text-base">
              {isFa 
                ? `توزیع ماهانه ${activeMetricView === 'manHours' ? 'نفر-ساعت آموزش' : activeMetricView === 'hours' ? 'ساعات دوره' : 'تعداد شرکت‌کنندگان'}`
                : `Monthly Breakdown (${activeMetricView})`}
            </h4>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center gap-4 text-xs font-bold">
            {showComplexMetrics && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-600 inline-block shadow-2xs"></span>
                <span className="text-slate-700 dark:text-slate-300">{isFa ? 'پرسنل مجتمع' : 'Complex'}</span>
              </div>
            )}
            {showContractorMetrics && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-500 inline-block shadow-2xs"></span>
                <span className="text-slate-700 dark:text-slate-300">{isFa ? 'پیمانکاران' : 'Contractors'}</span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Interactive Chart Render */}
        <div className="w-full pt-4 pb-2 overflow-x-auto">
          <div className="min-w-[650px] h-64 flex flex-col justify-end relative px-2">
            {/* Grid Background Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30 dark:opacity-20 border-b border-slate-300 dark:border-slate-700">
              <div className="border-b border-dashed border-slate-400 dark:border-slate-600 w-full flex justify-end">
                <span className="text-[9px] font-mono font-bold text-slate-400 -mt-2.5 px-1">{maxChartValue}</span>
              </div>
              <div className="border-b border-dashed border-slate-400 dark:border-slate-600 w-full flex justify-end">
                <span className="text-[9px] font-mono font-bold text-slate-400 -mt-2.5 px-1">{Math.round(maxChartValue * 0.75)}</span>
              </div>
              <div className="border-b border-dashed border-slate-400 dark:border-slate-600 w-full flex justify-end">
                <span className="text-[9px] font-mono font-bold text-slate-400 -mt-2.5 px-1">{Math.round(maxChartValue * 0.5)}</span>
              </div>
              <div className="border-b border-dashed border-slate-400 dark:border-slate-600 w-full flex justify-end">
                <span className="text-[9px] font-mono font-bold text-slate-400 -mt-2.5 px-1">{Math.round(maxChartValue * 0.25)}</span>
              </div>
              <div className="w-full flex justify-end">
                <span className="text-[9px] font-mono font-bold text-slate-400 -mt-2.5 px-1">0</span>
              </div>
            </div>

            {/* Bars / Data Rendering */}
            <div className="grid grid-cols-12 gap-2 h-52 items-end relative z-10">
              {monthlyData.map((d, idx) => {
                let complexVal = 0;
                let contractorVal = 0;

                if (activeMetricView === 'manHours') {
                  complexVal = d.complexManHours;
                  contractorVal = d.contractorManHours;
                } else if (activeMetricView === 'hours') {
                  complexVal = d.complexHours;
                  contractorVal = d.contractorHours;
                } else {
                  complexVal = d.complexTrainees;
                  contractorVal = d.contractorHeadcount;
                }

                const cValNorm = showComplexMetrics ? complexVal : 0;
                const contValNorm = showContractorMetrics ? contractorVal : 0;
                const totalVal = cValNorm + contValNorm;

                const complexHeightPct = maxChartValue > 0 ? (cValNorm / maxChartValue) * 100 : 0;
                const contractorHeightPct = maxChartValue > 0 ? (contValNorm / maxChartValue) * 100 : 0;

                return (
                  <div key={idx} className="flex flex-col items-center h-full justify-end group">
                    {/* Tooltip on Hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white rounded-xl p-2 text-[10px] absolute -top-12 z-30 shadow-lg pointer-events-none whitespace-nowrap font-bold">
                      <div>{d.monthName}</div>
                      {showComplexMetrics && <div className="text-blue-300">{isFa ? 'پرسنل:' : 'Complex:'} {cValNorm.toLocaleString()}</div>}
                      {showContractorMetrics && <div className="text-amber-300">{isFa ? 'پیمانکار:' : 'Contractor:'} {contValNorm.toLocaleString()}</div>}
                    </div>

                    {/* Bar Render */}
                    {chartType === 'bar' && (
                      <div className="w-full max-w-[32px] flex items-end justify-center gap-1 h-full">
                        {showComplexMetrics && (
                          <div
                            className="w-1/2 bg-gradient-to-t from-blue-700 to-blue-500 rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                            style={{ height: `${Math.max(complexHeightPct, cValNorm > 0 ? 4 : 0)}%` }}
                          ></div>
                        )}
                        {showContractorMetrics && (
                          <div
                            className="w-1/2 bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                            style={{ height: `${Math.max(contractorHeightPct, contValNorm > 0 ? 4 : 0)}%` }}
                          ></div>
                        )}
                      </div>
                    )}

                    {/* Area / Stacked Render */}
                    {(chartType === 'area' || chartType === 'line') && (
                      <div className="w-full max-w-[28px] flex flex-col justify-end items-center h-full">
                        <div
                          className="w-full bg-gradient-to-t from-blue-600 via-indigo-500 to-amber-400 rounded-t-xl transition-all duration-300 group-hover:scale-105 shadow-xs"
                          style={{ height: `${Math.max((totalVal / maxChartValue) * 100, totalVal > 0 ? 5 : 0)}%` }}
                        ></div>
                      </div>
                    )}

                    {/* Month Label */}
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2 truncate max-w-full">
                      {d.monthName}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Analytics Data Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table 1: Monthly Man-Hours & Course Statistics */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="font-black text-slate-900 dark:text-white text-xs md:text-sm">
                {isFa ? 'جدول مجموع ساعات و نفر-ساعت آموزش به تفکیک ماه' : 'Monthly Training Hours & Man-Hours'}
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg">
              {selectedYear === 'all' ? (isFa ? 'کل دوره' : 'All') : selectedYear}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2.5">{isFa ? 'ماه' : 'Month'}</th>
                  <th className="p-2.5 text-center">{isFa ? 'تعداد نفر' : 'Trainees'}</th>
                  <th className="p-2.5 text-center">{isFa ? 'ساعات دوره' : 'Hours'}</th>
                  <th className="p-2.5 text-center text-blue-600 dark:text-blue-400 font-mono">{isFa ? 'مجموع نفر-ساعت' : 'Man-Hours'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {monthlyData.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{m.monthName}</td>
                    <td className="p-2.5 text-center font-mono">{m.complexTrainees}</td>
                    <td className="p-2.5 text-center font-mono">{m.complexHours}</td>
                    <td className="p-2.5 text-center font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20">
                      {m.complexManHours.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td className="p-2.5">{isFa ? 'مجموع سالانه' : 'Total'}</td>
                  <td className="p-2.5 text-center font-mono">{filteredCourses.length}</td>
                  <td className="p-2.5 text-center font-mono">{totalComplexHours.toLocaleString()}</td>
                  <td className="p-2.5 text-center font-mono text-blue-600 dark:text-blue-400">{totalComplexManHours.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Table 2: Contractor Training Statistics */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              <h4 className="font-black text-slate-900 dark:text-white text-xs md:text-sm">
                {isFa ? 'جدول آمار آموزش شرکت‌ها و پیمانکاران' : 'Contractor Training Statistics'}
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg">
              {contractors.length} {isFa ? 'شرکت' : 'Companies'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2.5">{isFa ? 'پیمانکار' : 'Contractor'}</th>
                  <th className="p-2.5 text-center">{isFa ? 'تعداد نفر' : 'Headcount'}</th>
                  <th className="p-2.5 text-center">{isFa ? 'سرانه (ساعت)' : 'Per Capita'}</th>
                  <th className="p-2.5 text-center text-amber-600 dark:text-amber-400 font-mono">{isFa ? 'مجموع نفر-ساعت' : 'Total Hours'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {contractors.map((c, idx) => {
                  const hrs = (Number(c.headcount) || 0) * (Number(c.perCapita) || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">{c.name}</td>
                      <td className="p-2.5 text-center font-mono">{(Number(c.headcount) || 0).toLocaleString()}</td>
                      <td className="p-2.5 text-center font-mono">{Number(c.perCapita) || 0}</td>
                      <td className="p-2.5 text-center font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20">
                        {hrs.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {contractors.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 font-bold">
                      {isFa ? 'هیچ شرکت پیمانکاری ثبت نشده است.' : 'No contractor data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-slate-950 font-black border-t-2 border-slate-200 dark:border-slate-700">
                <tr>
                  <td className="p-2.5">{isFa ? 'مجموع کل' : 'Total'}</td>
                  <td className="p-2.5 text-center font-mono">{totalContractorHeadcount.toLocaleString()}</td>
                  <td className="p-2.5 text-center font-mono">-</td>
                  <td className="p-2.5 text-center font-mono text-amber-600 dark:text-amber-400">{totalContractorManHours.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
