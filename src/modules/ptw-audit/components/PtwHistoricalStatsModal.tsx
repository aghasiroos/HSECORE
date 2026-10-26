import React, { useState, useEffect } from 'react';
import { 
  History, 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Sparkles, 
  RotateCcw, 
  Calendar, 
  Check, 
  FileSpreadsheet, 
  Info,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  BarChart2,
  FileText
} from 'lucide-react';
import { PtwHistoricalYearStat } from '../types';
import { 
  getHistoricalYearStats, 
  saveHistoricalYearStat, 
  deleteHistoricalYearStat, 
  resetHistoricalYearStatsToDefault 
} from '../services/ptwAuditService';

interface PtwHistoricalStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatsUpdated?: () => void;
  currentYearAutoStats?: {
    year: string;
    totalAudits: number;
    defectiveAudits: number;
    defectRate: number;
    totalDefectsSum: number;
    avgComplianceScore: number;
  };
}

export default function PtwHistoricalStatsModal({
  isOpen,
  onClose,
  onStatsUpdated,
  currentYearAutoStats
}: PtwHistoricalStatsModalProps) {
  const [statsList, setStatsList] = useState<PtwHistoricalYearStat[]>(() => getHistoricalYearStats());
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');
  const [editingOriginalYear, setEditingOriginalYear] = useState<string | null>(null);
  const [editingStat, setEditingStat] = useState<Partial<PtwHistoricalYearStat>>({
    year: '',
    totalAudits: 100,
    defectiveAudits: 20,
    defectRate: 20,
    totalDefectsSum: 35,
    avgComplianceScore: 80,
    hotPermitCount: 50,
    coldPermitCount: 40,
    confinedSpaceCount: 10,
    attachedPermitCount: 15,
    notes: '',
    isManualEntry: true
  });
  const [isAutoCalcRate, setIsAutoCalcRate] = useState(true);
  const [isAutoCalcScore, setIsAutoCalcScore] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Custom confirmation modal states (replaces window.confirm)
  const [statToDelete, setStatToDelete] = useState<PtwHistoricalYearStat | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStatsList(getHistoricalYearStats());
    }
  }, [isOpen]);

  // Recalculate defectRate and avgComplianceScore in real-time when inputs change
  useEffect(() => {
    const total = Number(editingStat.totalAudits) || 0;
    const defective = Number(editingStat.defectiveAudits) || 0;
    
    let computedRate = Number(editingStat.defectRate) || 0;

    if (isAutoCalcRate) {
      if (total > 0) {
        computedRate = Number(((defective / total) * 100).toFixed(1));
        computedRate = Math.min(100, Math.max(0, computedRate));
      } else {
        computedRate = 0;
      }
    }

    let computedScore = Number(editingStat.avgComplianceScore) || 0;
    if (isAutoCalcScore) {
      computedScore = Number((100 - computedRate).toFixed(1));
      computedScore = Math.min(100, Math.max(0, computedScore));
    }

    setEditingStat(prev => {
      const shouldUpdateRate = isAutoCalcRate && prev.defectRate !== computedRate;
      const shouldUpdateScore = isAutoCalcScore && prev.avgComplianceScore !== computedScore;
      if (shouldUpdateRate || shouldUpdateScore) {
        return {
          ...prev,
          ...(shouldUpdateRate ? { defectRate: computedRate } : {}),
          ...(shouldUpdateScore ? { avgComplianceScore: computedScore } : {})
        };
      }
      return prev;
    });
  }, [editingStat.totalAudits, editingStat.defectiveAudits, editingStat.defectRate, isAutoCalcRate, isAutoCalcScore]);

  if (!isOpen) return null;

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleStartAdd = () => {
    setEditingOriginalYear(null);
    // Suggest a prior year not in list
    const existingYears = new Set(statsList.map(s => s.year));
    let suggestedYear = '1400';
    for (let y = 1404; y >= 1390; y--) {
      if (!existingYears.has(String(y)) && String(y) !== currentYearAutoStats?.year) {
        suggestedYear = String(y);
        break;
      }
    }

    setEditingStat({
      year: suggestedYear,
      totalAudits: 100,
      defectiveAudits: 20,
      defectRate: 20,
      totalDefectsSum: 35,
      avgComplianceScore: 80,
      hotPermitCount: 50,
      coldPermitCount: 40,
      confinedSpaceCount: 10,
      attachedPermitCount: 15,
      notes: '',
      isManualEntry: true
    });
    setIsAutoCalcRate(true);
    setIsAutoCalcScore(true);
    setActiveTab('form');
  };

  const handleStartEdit = (stat: PtwHistoricalYearStat) => {
    setEditingOriginalYear(stat.year);
    const total = Number(stat.totalAudits) || 0;
    const defective = Number(stat.defectiveAudits) || 0;
    const computedDefectRate = total > 0 ? Number(((defective / total) * 100).toFixed(1)) : 0;
    const computedScore = Number((100 - computedDefectRate).toFixed(1));

    // If existing stat already matches computed values, keep auto-calc active
    const rateMatches = Math.abs((Number(stat.defectRate) || 0) - computedDefectRate) < 0.2;
    const scoreMatches = Math.abs((Number(stat.avgComplianceScore) || 0) - computedScore) < 0.2;

    setEditingStat({ 
      ...stat,
      defectRate: rateMatches ? computedDefectRate : stat.defectRate,
      avgComplianceScore: scoreMatches ? computedScore : stat.avgComplianceScore
    });
    setIsAutoCalcRate(true);
    setIsAutoCalcScore(true);
    setActiveTab('form');
  };

  const handleConfirmDelete = () => {
    if (!statToDelete) return;
    const yearToDelete = statToDelete.year || statToDelete.id;
    const updated = deleteHistoricalYearStat(yearToDelete);
    setStatsList(updated);
    showNotification('success', `آمار سال ${statToDelete.year} با موفقیت حذف گردید.`);
    if (onStatsUpdated) onStatsUpdated();
    if (activeTab === 'form' && (editingStat.year === statToDelete.year || editingOriginalYear === statToDelete.year)) {
      setActiveTab('list');
      setEditingOriginalYear(null);
    }
    setStatToDelete(null);
  };

  const handleConfirmReset = () => {
    const updated = resetHistoricalYearStatsToDefault();
    setStatsList(updated);
    showNotification('success', 'آمار سال‌های قبل با موفقیت به مقادیر پیش‌فرض بازنشانی گردید.');
    if (onStatsUpdated) onStatsUpdated();
    setIsResetConfirmOpen(false);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredYear = (editingStat.year || '').trim();
    if (!enteredYear) {
      showNotification('error', 'لطفاً سال مورد نظر را مشخص نمایید.');
      return;
    }

    const total = Math.max(0, Number(editingStat.totalAudits) || 0);
    const defective = Math.max(0, Number(editingStat.defectiveAudits) || 0);

    if (total === 0) {
      showNotification('error', 'تعداد کل ممیزی‌ها باید عددی بزرگتر از صفر باشد.');
      return;
    }

    if (defective > total) {
      showNotification('error', 'تعداد پروانه‌های دارای خطا نمی‌تواند از تعداد کل ممیزی‌ها بیشتر باشد.');
      return;
    }

    const payload: PtwHistoricalYearStat = {
      id: `hist-${enteredYear}`,
      year: enteredYear,
      totalAudits: total,
      defectiveAudits: defective,
      defectRate: Number(editingStat.defectRate) || (total > 0 ? Number(((defective / total) * 100).toFixed(1)) : 0),
      totalDefectsSum: Math.max(0, Number(editingStat.totalDefectsSum) || 0),
      avgComplianceScore: Math.min(100, Math.max(0, Number(editingStat.avgComplianceScore) || 0)),
      hotPermitCount: Number(editingStat.hotPermitCount) || 0,
      coldPermitCount: Number(editingStat.coldPermitCount) || 0,
      confinedSpaceCount: Number(editingStat.confinedSpaceCount) || 0,
      attachedPermitCount: Number(editingStat.attachedPermitCount) || 0,
      notes: editingStat.notes || '',
      isManualEntry: true
    };

    const isAddingNew = !editingOriginalYear;
    const updated = saveHistoricalYearStat(payload, editingOriginalYear || undefined);
    setStatsList(updated);
    
    if (isAddingNew) {
      showNotification('success', `آمار سال ${payload.year} به عنوان رکورد جدید ثبت شد و به فهرست سنوات قبل افزوده گردید.`);
    } else {
      showNotification('success', `آمار سال ${payload.year} با موفقیت به‌روزرسانی و در داشبورد اعمال شد.`);
    }
    
    setEditingOriginalYear(null);
    setActiveTab('list');
    if (onStatsUpdated) onStatsUpdated();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in"
      dir="rtl"
      id="ptw-historical-stats-modal"
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between relative overflow-hidden border-b border-slate-700">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-xs">
              <History className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black">
                  ورود دستی و مدیریت آمار سال‌های گذشته ممیزی پروانه کار
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                  تحلیل و مقایسه چندساله
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                ثبت شاخص‌های آماری سنوات قبل جهت ترسیم روند تاریخی، مقایسه سالانه و پایش اثربخشی برنامه‌های ایمنی
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer relative z-10"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Banner */}
        {notification && (
          <div className={`p-3 text-xs font-bold flex items-center gap-2 transition-all ${
            notification.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-b border-rose-200 dark:border-rose-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-rose-500" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Current Year Auto-Calculation Notice */}
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-800/40 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>نکته مهم:</strong> آمار سال جاری (به‌ویژه <strong>میانگین امتیاز انطباق</strong> و تعداد خطاها) به صورت کاملاً خودکار و برخط از ممیزی‌های ثبت‌شده واقعی در سیستم استخراج و در کنار آمار سنوات قبل در نمودارها مقایسه می‌شود.
            </span>
          </div>
          {currentYearAutoStats && (
            <div className="flex items-center gap-1 bg-amber-200/60 dark:bg-amber-900/60 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold shrink-0">
              <span>سال جاری ({currentYearAutoStats.year}):</span>
              <span>{currentYearAutoStats.totalAudits} ممیزی | انطباق: {currentYearAutoStats.avgComplianceScore}%</span>
            </div>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>فهرست سال‌های ثبت‌شده ({statsList.length})</span>
            </button>
            <button
              onClick={handleStartAdd}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت سال جدید</span>
            </button>
          </div>

          {activeTab === 'list' && (
            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="text-xs text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
              title="بازنشانی به ۳ سال پیش‌فرض نمونه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>داده‌های نمونه</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {activeTab === 'list' ? (
            <div className="space-y-4">
              {statsList.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <p className="text-sm text-slate-500">هیچ آمار سال گذشته‌ای ثبت نشده است.</p>
                  <button
                    onClick={handleStartAdd}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن اولین سال</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {statsList.map((stat, index) => {
                    const cleanAudits = Math.max(0, stat.totalAudits - stat.defectiveAudits);
                    return (
                      <div 
                        key={`hist-year-card-${stat.year || stat.id || index}`}
                        className="p-5 rounded-3xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all shadow-xs flex flex-col justify-between space-y-4 group"
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-mono font-black text-sm flex items-center justify-center shadow-xs">
                              {stat.year.slice(-2)}
                            </span>
                            <div>
                              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                آمار سال {stat.year}
                              </h3>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                ثبت دستی سنوات قبل
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEdit(stat)}
                              className="p-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 shadow-xs transition-colors cursor-pointer"
                              title="ویرایش این سال"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setStatToDelete(stat)}
                              className="p-1.5 rounded-xl bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 shadow-xs transition-colors cursor-pointer"
                              title="حذف این سال با تایید"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Metric Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                          <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] text-slate-400 font-bold">کل ممیزی‌ها</div>
                            <div className="text-base font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                              {stat.totalAudits}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] text-slate-400 font-bold">دارای خطا</div>
                            <div className="text-base font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                              {stat.defectiveAudits}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] text-slate-400 font-bold">درصد خطا</div>
                            <div className="text-base font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                              {stat.defectRate}%
                            </div>
                          </div>

                          <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                            <div className="text-[10px] text-slate-400 font-bold">امتیاز انطباق</div>
                            <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {stat.avgComplianceScore}%
                            </div>
                          </div>
                        </div>

                        {/* Breakdown and Details */}
                        <div className="space-y-1.5 text-xs bg-white/60 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-[11px]">مجموع کل خطاهای ثبت‌شده:</span>
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{stat.totalDefectsSum} نقص</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span className="text-[11px]">پروانه‌های کاملاً منطبق:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{cleanAudits} پروانه</span>
                          </div>
                          {(stat.hotPermitCount || stat.coldPermitCount) ? (
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span>گرم: {stat.hotPermitCount || 0} | سرد: {stat.coldPermitCount || 0} | بسته: {stat.confinedSpaceCount || 0}</span>
                            </div>
                          ) : null}
                          {stat.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-100 dark:border-slate-800">
                              {stat.notes}
                            </p>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: Add / Edit Form */
            <form onSubmit={handleSaveForm} className="space-y-5">
              
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {editingOriginalYear ? `ویرایش آمار سال ${editingOriginalYear}` : 'ثبت اطلاعات آماری سال جدید (افزودن به سنوات قبل)'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {editingOriginalYear 
                      ? 'تغییرات این سال در داشبورد و نمودار روند سالانه اعمال خواهد شد'
                      : 'این سال به فهرست سال‌های گذشته اضافه شده و سایر سال‌ها حفظ می‌شوند'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* 1. Year */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      سال شمسی <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingStat.year || ''}
                      onChange={e => setEditingStat({ ...editingStat, year: e.target.value })}
                      placeholder="مثلاً 1402"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* 2. Total Audits */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تعداد کل ممیزی‌ها <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingStat.totalAudits ?? ''}
                      onChange={e => setEditingStat({ ...editingStat, totalAudits: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* 3. Defective Audits */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تعداد پروانه‌های دارای خطا <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingStat.defectiveAudits ?? ''}
                      onChange={e => setEditingStat({ ...editingStat, defectiveAudits: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* 4. Defect Rate (%) with Auto-calculation Toggle */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        درصد پروانه‌های دارای خطا (%)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAutoCalcRate(!isAutoCalcRate)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                          isAutoCalcRate 
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300' 
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                        title="تغییر وضعیت محاسبه خودکار از تقسیم خطا بر کل"
                      >
                        {isAutoCalcRate ? 'محاسبه خودکار ✓' : 'دستی'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editingStat.defectRate ?? ''}
                        readOnly={isAutoCalcRate}
                        onChange={e => setEditingStat({ ...editingStat, defectRate: Number(e.target.value) })}
                        className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm font-bold focus:outline-hidden ${
                          isAutoCalcRate 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700' 
                            : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                        }`}
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">%</span>
                    </div>
                  </div>

                  {/* 5. Total Defects Sum */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      مجموع کل خطاها (نواقص) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingStat.totalDefectsSum ?? ''}
                      onChange={e => setEditingStat({ ...editingStat, totalDefectsSum: Number(e.target.value) })}
                      placeholder="مجموع کل نواقص ثبت شده"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* 6. Average Compliance Score (%) with Auto-calculation */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        میانگین امتیاز انطباق (%) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAutoCalcScore(!isAutoCalcScore)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                          isAutoCalcScore 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' 
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                        title="تغییر وضعیت محاسبه خودکار (۱۰۰ منهای درصد پروانه‌های دارای خطا)"
                      >
                        {isAutoCalcScore ? 'محاسبه خودکار ✓' : 'دستی'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={editingStat.avgComplianceScore ?? ''}
                        readOnly={isAutoCalcScore}
                        onChange={e => setEditingStat({ ...editingStat, avgComplianceScore: Number(e.target.value) })}
                        placeholder="مثلاً 85.5"
                        className={`w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm font-bold focus:outline-hidden ${
                          isAutoCalcScore 
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60 shadow-xs' 
                            : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500'
                        }`}
                        required
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">%</span>
                    </div>
                    {isAutoCalcScore && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>محاسبه خودکار: ۱۰۰٪ منهای درصد پروانه‌های دارای خطا</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Optional Permit Types Breakdown */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span>تفکیک تعداد بر اساس نوع پروانه کار (اختیاری):</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">پروانه گرم (Hot)</label>
                      <input
                        type="number"
                        min="0"
                        value={editingStat.hotPermitCount ?? ''}
                        onChange={e => setEditingStat({ ...editingStat, hotPermitCount: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">پروانه سرد (Cold)</label>
                      <input
                        type="number"
                        min="0"
                        value={editingStat.coldPermitCount ?? ''}
                        onChange={e => setEditingStat({ ...editingStat, coldPermitCount: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">فضای بسته</label>
                      <input
                        type="number"
                        min="0"
                        value={editingStat.confinedSpaceCount ?? ''}
                        onChange={e => setEditingStat({ ...editingStat, confinedSpaceCount: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">پروانه‌های الحاقی</label>
                      <input
                        type="number"
                        min="0"
                        value={editingStat.attachedPermitCount ?? ''}
                        onChange={e => setEditingStat({ ...editingStat, attachedPermitCount: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    توضیحات و تحلیل مدیریتی این سال (اختیاری)
                  </label>
                  <textarea
                    rows={2}
                    value={editingStat.notes || ''}
                    onChange={e => setEditingStat({ ...editingStat, notes: e.target.value })}
                    placeholder="مثلاً: دلایل کاهش نرخ خطا، تغییرات فرآیندی یا الزامات استقرار یافته در این سال..."
                    className="w-full px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                {editingOriginalYear && statsList.some(s => s.year === editingOriginalYear) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const found = statsList.find(s => s.year === editingOriginalYear) || (editingStat as PtwHistoricalYearStat);
                      setStatToDelete(found);
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs cursor-pointer transition-colors inline-flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/40"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف آمار سال {editingOriginalYear}</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                  >
                    انصراف و بازگشت
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-md shadow-amber-500/20 inline-flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingOriginalYear ? `ذخیره تغییرات سال ${editingOriginalYear} و اعمال در داشبورد` : 'ثبت سال جدید و اعمال در داشبورد'}</span>
                  </button>
                </div>
              </div>

            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>پایگاه داده مقایسه‌ای ممیزی پروانه کار - واحد HSE</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold cursor-pointer transition-colors"
          >
            بستن پنجره
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 1. Confirmation Modal for Deleting a Historical Year */}
      {/* ========================================================================= */}
      {statToDelete && (
        <div 
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs font-sans animate-fade-in"
          dir="rtl"
          onClick={() => setStatToDelete(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-scale-up text-slate-800 dark:text-slate-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Header with Danger Badge */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تایید حذف آمار سال {statToDelete.year}
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                    هشدار: این عملیات غیرقابل بازگشت است
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatToDelete(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Year Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  سال شمسی:
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white px-2.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm">
                  {statToDelete.year}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block">کل ممیزی‌ها:</span>
                  <strong className="font-mono text-sm text-blue-600 dark:text-blue-400">{statToDelete.totalAudits}</strong>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block">پروانه‌های دارای خطا:</span>
                  <strong className="font-mono text-sm text-rose-600 dark:text-rose-400">{statToDelete.defectiveAudits} ({statToDelete.defectRate}%)</strong>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block">میانگین امتیاز انطباق:</span>
                  <strong className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{statToDelete.avgComplianceScore}%</strong>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block">مجموع کل خطاها:</span>
                  <strong className="font-mono text-sm text-amber-600 dark:text-amber-400">{statToDelete.totalDefectsSum} نقص</strong>
                </div>
              </div>
            </div>

            {/* Message Body */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              آیا از حذف اطلاعات و شاخص‌های آماری ثبت‌شده برای <strong>سال {statToDelete.year}</strong> اطمینان دارید؟ پس از حذف، این سال از نمودارهای روند سالانه و محاسبات مقایسه‌ای سنوات قبل حذف خواهد شد.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs sm:text-sm font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shadow-rose-600/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>بله، حذف آمار سال {statToDelete.year}</span>
              </button>
              
              <button
                type="button"
                onClick={() => setStatToDelete(null)}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Confirmation Modal for Resetting to Default Samples */}
      {/* ========================================================================= */}
      {isResetConfirmOpen && (
        <div 
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs font-sans animate-fade-in"
          dir="rtl"
          onClick={() => setIsResetConfirmOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-scale-up text-slate-800 dark:text-slate-100"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400 shrink-0">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    بازنشانی به داده‌های نمونه پیش‌فرض
                  </h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                    بارگذاری داده‌های پایه سال‌های ۱۴۰۱، ۱۴۰۲ و ۱۴۰۳
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Body */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              با تایید این عملیات، آمار ثبت‌شده سنوات قبل با ۳ رکورد استاندارد نمونه (سال‌های ۱۴۰۱، ۱۴۰۲ و ۱۴۰۳) جایگزین خواهد شد. آیا مایل به بازنشانی هستید؟
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs sm:text-sm font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shadow-amber-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>بله، بازنشانی به داده‌های نمونه</span>
              </button>
              
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
