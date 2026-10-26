import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Users,
  AlertTriangle,
  Heart,
  Scale,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Plus,
  RotateCcw,
  Sparkles,
  GripVertical,
  HelpCircle,
  BarChart3,
  Sliders,
  Check,
  Info
} from 'lucide-react';
import { CustomizableChart, ChartType, ChartPalette } from '../CustomizableChart';
import { AVAILABLE_METRICS, MetricDefinition, getMetricIcon } from '../chartMetrics';
import { EditChartModal, UserChartItemConfig } from '../EditChartModal';
import { DashboardFilterBar, DashboardFilterState, INITIAL_DASHBOARD_FILTERS } from '../DashboardFilterBar';
import {
  loadUserChartConfigs,
  saveUserChartConfigs,
  resetUserChartConfigs,
  DEFAULT_DASHBOARD_CHARTS
} from '../chartConfigStorage';
import { printService } from '../../../../../services/printService';

interface Props {
  joinedRecords: any[];
  personnelList: any[];
  toNum: (v: any) => number | null;
  bmiCat: (v: number | null) => any;
  bpCategory: (sys: number | null, dia: number | null) => string | null;
  splitMulti: (v: any) => string[];
  renderOpinionBadge: (op: string) => React.ReactNode;
}

export const DashboardTab: React.FC<Props> = ({
  joinedRecords,
  personnelList,
  toNum,
  bmiCat,
  bpCategory,
  splitMulti,
  renderOpinionBadge
}) => {
  // 1. Common Shared Dashboard Filters State
  const [filters, setFilters] = useState<DashboardFilterState>(INITIAL_DASHBOARD_FILTERS);

  // 2. User Charts Layout & Configuration State (Stored per user in localStorage)
  const [chartConfigs, setChartConfigs] = useState<UserChartItemConfig[]>(() => loadUserChartConfigs());

  // 3. Edit / Add Chart Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingChartConfig, setEditingChartConfig] = useState<UserChartItemConfig | null>(null);

  // 4. Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Save configs whenever chartConfigs state changes
  const updateAndSaveConfigs = (newConfigs: UserChartItemConfig[]) => {
    setChartConfigs(newConfigs);
    saveUserChartConfigs(newConfigs);
  };

  // Extract unique available years and companies from real dataset
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    joinedRecords.forEach(r => {
      if (r.exam_year) years.add(String(r.exam_year));
      else if (r.exam_date) {
        const y = String(r.exam_date).substring(0, 4);
        if (y.startsWith('13') || y.startsWith('14')) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [joinedRecords]);

  const availableCompanies = useMemo(() => {
    const comps = new Set<string>();
    joinedRecords.forEach(r => {
      if (r.company && String(r.company).trim()) {
        comps.add(String(r.company).trim());
      }
    });
    return Array.from(comps).sort();
  }, [joinedRecords]);

  // Real-time Synchronized Filter Application across all charts & KPIs
  const filteredRecords = useMemo(() => {
    return joinedRecords.filter(r => {
      // 1. Text Search
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const fname = (r.fname || '').toLowerCase();
        const lname = (r.lname || '').toLowerCase();
        const nid = (r.nid || '').toString().toLowerCase();
        const pcode = (r.pcode || '').toString().toLowerCase();
        const comp = (r.company || '').toLowerCase();
        const match = fname.includes(q) || lname.includes(q) || nid.includes(q) || pcode.includes(q) || comp.includes(q);
        if (!match) return false;
      }

      // 2. Year Filter
      if (filters.year !== 'all') {
        const y = String(r.exam_year || (r.exam_date ? String(r.exam_date).substring(0, 4) : ''));
        if (y !== filters.year) return false;
      }

      // 3. Company Filter
      if (filters.company !== 'all') {
        if ((r.company || '').trim() !== filters.company.trim()) return false;
      }

      // 4. Final Opinion Status
      if (filters.opinion !== 'all') {
        const op = (r.final_opinion || '').trim();
        if (filters.opinion === 'بلامانع' && !op.includes('بلامانع')) return false;
        if (filters.opinion === 'مشروط' && !op.includes('مشروط')) return false;
        if (filters.opinion === 'عدم صلاحیت' && !op.includes('عدم صلاحیت') && !op.includes('نامناسب')) return false;
        if (filters.opinion === 'ارجاع' && !op.includes('ارجاع')) return false;
      }

      // 5. Work Hazards Filter
      if (filters.hazard !== 'all') {
        const allHazards = [r.haz_phys, r.haz_chem, r.haz_bio, r.haz_ergo, r.haz_psych, r.haz_other].filter(Boolean).join(' ');
        if (!allHazards.includes(filters.hazard)) return false;
      }

      // 6. Gender Filter
      if (filters.gender !== 'all') {
        const g = (r.gender || 'مرد').trim();
        if (g !== filters.gender) return false;
      }

      // 7. Followup status Filter
      if (filters.followup !== 'all') {
        const f = r.final_followup_needed === 'بله' ? 'بله' : 'خیر';
        if (f !== filters.followup) return false;
      }

      return true;
    });
  }, [joinedRecords, filters]);

  const totalFilteredExams = filteredRecords.length || 1;

  // Filtered unique personnel count
  const filteredPersonnelCount = useMemo(() => {
    const pKeys = new Set<string>();
    filteredRecords.forEach(r => {
      if (r.personnel_id) pKeys.add(r.personnel_id);
      else if (r.nid) pKeys.add(String(r.nid));
    });
    return pKeys.size;
  }, [filteredRecords]);

  // Synchronized KPI Calculations
  const fitPercent = useMemo(() => {
    const ok = filteredRecords.filter(r => (r.final_opinion || '').includes('بلامانع')).length;
    return ((ok / totalFilteredExams) * 100).toFixed(0);
  }, [filteredRecords, totalFilteredExams]);

  const followupCount = useMemo(() => {
    return filteredRecords.filter(r => r.final_followup_needed === 'بله').length;
  }, [filteredRecords]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set transparent image or drag data
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newConfigs = [...chartConfigs];
    const [movedItem] = newConfigs.splice(draggedIndex, 1);
    newConfigs.splice(targetIndex, 0, movedItem);

    updateAndSaveConfigs(newConfigs);
    setDraggedIndex(null);
    setDragOverIndex(null);
    showToast('چیدمان جدید نمودارها با موفقیت ذخیره شد.');
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Add or Save Chart Config from Modal
  const handleSaveChartFromModal = (config: UserChartItemConfig) => {
    const existingIndex = chartConfigs.findIndex(c => c.id === config.id);
    let updated: UserChartItemConfig[];
    if (existingIndex >= 0) {
      updated = [...chartConfigs];
      updated[existingIndex] = config;
      showToast(`تنظیمات نمودار «${config.title}» به‌روزرسانی شد.`);
    } else {
      updated = [config, ...chartConfigs];
      showToast(`نمودار «${config.title}» به داشبورد افزوده شد.`);
    }
    updateAndSaveConfigs(updated);
  };

  // Quick In-Place Type Change
  const handleChartTypeChange = (chartId: string, newType: ChartType) => {
    const updated = chartConfigs.map(c => (c.id === chartId ? { ...c, chartType: newType } : c));
    updateAndSaveConfigs(updated);
  };

  // Quick In-Place Palette Change
  const handleChartPaletteChange = (chartId: string, newPalette: ChartPalette) => {
    const updated = chartConfigs.map(c => (c.id === chartId ? { ...c, palette: newPalette } : c));
    updateAndSaveConfigs(updated);
  };

  // Remove Chart
  const handleRemoveChart = (chartId: string) => {
    const target = chartConfigs.find(c => c.id === chartId);
    const updated = chartConfigs.filter(c => c.id !== chartId);
    updateAndSaveConfigs(updated);
    showToast(`نمودار «${target?.title || ''}» حذف شد.`);
  };

  // Reset to Default Dashboard Layout
  const handleResetLayout = () => {
    if (window.confirm('آیا از بازنشانی چیدمان نمودارها به حالت پیش‌فرض سازمان اطمینان دارید؟')) {
      const defs = resetUserChartConfigs();
      setChartConfigs(defs);
      showToast('چیدمان پیش‌فرض نمودارها بازیابی شد.');
    }
  };

  // Print Official Report View
  const handlePrintDashboard = () => {
    printService.printElement('periodic-exams-dashboard-report', {
      title: 'داشبورد تحلیلی و آماری معاینات ادواری طب کار',
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: 'HSE-MED-DASH-01',
      documentDate: new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
      isFa: true,
      autoPrint: true
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900/95 text-white dark:bg-white dark:text-slate-900 text-xs font-bold shadow-2xl border border-slate-700 animate-slideUp">
          <Check className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified Live Filter Bar */}
      <DashboardFilterBar
        filters={filters}
        onChange={setFilters}
        availableYears={availableYears}
        availableCompanies={availableCompanies}
        totalRecordsCount={joinedRecords.length}
        filteredRecordsCount={filteredRecords.length}
        filteredRecords={filteredRecords}
        onPrintReport={handlePrintDashboard}
      />

      <div id="periodic-exams-dashboard-report" className="space-y-4">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-[#17222c] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-1">پرسنل منطبق با فیلتر</span>
            <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">{filteredPersonnelCount}</div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold mt-0.5 block">از مجموع {personnelList.length} پرسنل</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/80 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#17222c] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-1">معاینات ادواری انتخابی</span>
            <div className="text-2xl font-black text-slate-800 dark:text-white font-mono">{filteredRecords.length}</div>
            <span className="text-[10px] text-slate-500 font-bold mt-0.5 block">از کل {joinedRecords.length} نوبت معاینه</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#17222c] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-1">صلاحیت بلامانع (Fit)</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{fitPercent}٪</div>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 block">آمادگی و سلامت کامل شغلی</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#17222c] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block mb-1">نیازمند پیگیری درمانی</span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{followupCount}</div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5 block">پیگیری آزمایشگاهی یا ارجاع</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Dashboard Management & Customization Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-850/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-teal-600 text-white shadow-xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
              <span>داشبورد تحلیلی و نمودارهای شخصی‌سازی‌شده</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {chartConfigs.length} نمودار فعال
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              با کشیدن آیکون کنار هر کارت، چیدمان نمودارها را با Drag & Drop جابه‌جا کنید.
            </p>
          </div>
        </div>

        {/* Buttons: Add Custom Chart & Reset Layout */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="بازنشانی چیدمان نمودارها به وضعیت پیش‌فرض"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>چیدمان پیش‌فرض</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingChartConfig(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 transition-all cursor-pointer"
            title="افزودن نمودار تحلیلی جدید به داشبورد"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن نمودار سفارشی</span>
          </button>
        </div>
      </div>

      {/* Grid of Drag & Drop Customizable Charts */}
      {chartConfigs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#17222c] border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 mx-auto flex items-center justify-center">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-white">هیچ نموداری در داشبورد تعریف نشده است</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            می‌توانید با زدن دکمه «افزودن نمودار سفارشی» نمودارهای دلخواه را اضافه کنید یا چیدمان پیش‌فرض را بازیابی نمایید.
          </p>
          <button
            type="button"
            onClick={handleResetLayout}
            className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shadow-md"
          >
            بازیابی چیدمان پیش‌فرض
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartConfigs.map((config, index) => {
            const metricDef = AVAILABLE_METRICS[config.metricKey] || AVAILABLE_METRICS['opinion'];
            const chartData = metricDef.calculate(filteredRecords, totalFilteredExams);
            const isDragging = draggedIndex === index;
            const isDragTarget = dragOverIndex === index;

            const gridSpanClass = config.width === 'full' ? 'col-span-1 lg:col-span-2' : 'col-span-1';

            return (
              <div
                key={config.id}
                draggable
                onDragStart={e => handleDragStart(e, index)}
                onDragOver={e => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`${gridSpanClass} transition-all duration-200 ${
                  isDragging ? 'opacity-40 scale-[0.98]' : ''
                } ${isDragTarget ? 'ring-2 ring-teal-500 rounded-2xl ring-offset-2' : ''}`}
              >
                <CustomizableChart
                  id={config.id}
                  title={config.title}
                  subtitle={config.subtitle}
                  icon={getMetricIcon(metricDef.icon)}
                  data={chartData}
                  unit={metricDef.unit}
                  totalCount={totalFilteredExams}
                  defaultType={config.chartType}
                  defaultPalette={config.palette}
                  height={config.height || 260}
                  isDraggable={true}
                  allowTypeSwitch={true}
                  allowCustomization={true}
                  onEditConfig={() => {
                    setEditingChartConfig(config);
                    setIsModalOpen(true);
                  }}
                  onRemove={() => handleRemoveChart(config.id)}
                  onTypeChange={newType => handleChartTypeChange(config.id, newType)}
                  onPaletteChange={newPal => handleChartPaletteChange(config.id, newPal)}
                />
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Edit & Add Chart Modal */}
      <EditChartModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingChartConfig(null);
        }}
        onSave={handleSaveChartFromModal}
        initialConfig={editingChartConfig}
        filteredRecords={filteredRecords}
      />
    </div>
  );
};

export default DashboardTab;
