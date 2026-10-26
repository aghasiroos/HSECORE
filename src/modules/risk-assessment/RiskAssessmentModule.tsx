import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Layers, 
  Activity, 
  AlertTriangle, 
  HeartPulse, 
  TrendingUp, 
  Flame, 
  FileCheck,
  Plus, 
  Search, 
  Filter, 
  Download, 
  LayoutDashboard,
  FileText,
  Sliders,
  CheckCircle2,
  Printer,
  Eye,
  Edit3,
  Trash2
} from 'lucide-react';
import { AnyRiskAssessment, RiskMethod, RiskLevel } from './types';
import { 
  riskAssessmentService, 
  getRiskLevelColor, 
  calculateRiskLevel,
  getMethodMeta,
  getDistinctMethods
} from './services/riskAssessmentService';
import RiskDashboardOverview from './components/RiskDashboardOverview';
import RiskAssessmentPrintModal from './components/RiskAssessmentPrintModal';
import JsaForm from './components/JsaForm';
import FmeaForm from './components/FmeaForm';
import FtaForm from './components/FtaForm';
import HhaForm from './components/HhaForm';

interface RiskAssessmentModuleProps {
  currentUser: any;
  isFa: boolean;
}

type ActiveViewMode = 'OVERVIEW' | 'METHOD_RECORDS' | 'FORM_NEW' | 'FORM_EDIT';

export default function RiskAssessmentModule({ currentUser, isFa }: RiskAssessmentModuleProps) {
  const [assessments, setAssessments] = useState<AnyRiskAssessment[]>([]);
  const [activeView, setActiveView] = useState<ActiveViewMode>('OVERVIEW');
  const [selectedMethod, setSelectedMethod] = useState<RiskMethod>('JSA');
  const [selectedAssessment, setSelectedAssessment] = useState<AnyRiskAssessment | null>(null);
  
  // Print & Delete Modals
  const [previewAssessment, setPreviewAssessment] = useState<AnyRiskAssessment | null>(null);
  const [deleteConfirmAssessment, setDeleteConfirmAssessment] = useState<AnyRiskAssessment | null>(null);

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  // Load initial assessments
  const loadAssessments = async () => {
    const list = await riskAssessmentService.getAssessments();
    setAssessments(list);
  };

  useEffect(() => {
    loadAssessments();

    const handleRemoteMutation = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('risk') || entity.includes('jsa') || entity.includes('fmea')) {
        loadAssessments();
      }
    };

    window.addEventListener('hse_risks_updated', loadAssessments);
    window.addEventListener('app_data_mutated', handleRemoteMutation);
    window.addEventListener('hse_data_mutated', handleRemoteMutation);

    return () => {
      window.removeEventListener('hse_risks_updated', loadAssessments);
      window.removeEventListener('app_data_mutated', handleRemoteMutation);
      window.removeEventListener('hse_data_mutated', handleRemoteMutation);
    };
  }, []);

  const handleSaveAssessment = async (assessment: AnyRiskAssessment) => {
    await riskAssessmentService.saveAssessment(assessment);
    await loadAssessments();
    setSelectedAssessment(null);
    setActiveView('OVERVIEW');
  };

  const handleRequestDelete = (assessment: AnyRiskAssessment) => {
    setDeleteConfirmAssessment(assessment);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmAssessment) return;
    await riskAssessmentService.deleteAssessment(deleteConfirmAssessment.id);
    await loadAssessments();
    if (selectedAssessment?.id === deleteConfirmAssessment.id) {
      setSelectedAssessment(null);
      setActiveView('OVERVIEW');
    }
    if (previewAssessment?.id === deleteConfirmAssessment.id) {
      setPreviewAssessment(null);
    }
    setDeleteConfirmAssessment(null);
  };

  const handleStartNewAssessment = (method?: RiskMethod) => {
    const targetMethod = method || selectedMethod || 'JSA';
    setSelectedMethod(targetMethod);
    setSelectedAssessment(null);
    setActiveView('FORM_NEW');
  };

  const handleEditAssessment = (assessment: AnyRiskAssessment) => {
    setPreviewAssessment(null);
    setSelectedMethod(assessment.method);
    setSelectedAssessment(assessment);
    setActiveView('FORM_EDIT');
  };

  const handleOpenPrintModal = (assessment: AnyRiskAssessment) => {
    setPreviewAssessment(assessment);
  };

  // Available distinct methods in records and system
  const availableMethods = getDistinctMethods(assessments);

  // Filtered assessments for method view
  const currentMethodAssessments = assessments.filter(a => {
    if (activeView === 'METHOD_RECORDS' && a.method !== selectedMethod) return false;
    if (filterLevel !== 'ALL' && a.overallRiskLevel !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.unit.toLowerCase().includes(q) ||
        a.assessorName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const currentMethodMeta = getMethodMeta(selectedMethod);

  return (
    <div 
      className="w-full space-y-6 pb-12" 
      id="risk-assessment-module"
    >
      {/* ── Top Navigation Bar ── */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
          <button
            onClick={() => { setActiveView('OVERVIEW'); setSelectedAssessment(null); }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeView === 'OVERVIEW'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{isFa ? 'داشبورد جامع ارزیابی ریسک' : 'Risk Dashboard'}</span>
          </button>

          {availableMethods.map(method => {
            const count = assessments.filter(a => (a.method || '').toUpperCase() === method.toUpperCase()).length;
            const isSelected = activeView === 'METHOD_RECORDS' && selectedMethod.toUpperCase() === method.toUpperCase();
            return (
              <button
                key={method}
                onClick={() => {
                  setSelectedMethod(method as RiskMethod);
                  setActiveView('METHOD_RECORDS');
                  setSelectedAssessment(null);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{method}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isSelected 
                      ? 'bg-indigo-700/90 text-white' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleStartNewAssessment(selectedMethod)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? '+ ارزیابی جدید' : '+ New Assessment'}</span>
          </button>
        </div>
      </div>

      {/* ── View Router ── */}
      {activeView === 'OVERVIEW' && (
        <RiskDashboardOverview
          assessments={assessments}
          isFa={isFa}
          onSelectMethod={(m) => {
            setSelectedMethod(m);
            setActiveView('METHOD_RECORDS');
          }}
          onNewAssessment={(m) => handleStartNewAssessment(m)}
          onViewAssessment={(a) => handleOpenPrintModal(a)}
          onPrintAssessment={(a) => handleOpenPrintModal(a)}
          onEditAssessment={(a) => handleEditAssessment(a)}
          onDeleteAssessment={(a) => handleRequestDelete(a)}
        />
      )}

      {activeView === 'METHOD_RECORDS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Method Info Header */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div 
                className="w-12 h-12 rounded-2xl text-white font-mono font-black flex items-center justify-center text-sm shadow-md"
                style={{ backgroundColor: currentMethodMeta.chartColor }}
              >
                {selectedMethod}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  {isFa ? currentMethodMeta.titleFa : currentMethodMeta.titleEn}
                </h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa ? currentMethodMeta.descFa : currentMethodMeta.titleEn}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {currentMethodAssessments.length} {isFa ? 'سند ثبت‌شده' : 'Records'}
              </span>
              <button
                onClick={() => handleStartNewAssessment(selectedMethod)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? `ثبت فرم ${selectedMethod}` : `New ${selectedMethod}`}</span>
              </button>
            </div>
          </div>

          {/* Method Filter & Search */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-[0px] w-full md:min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isFa ? 'جستجو در عنوان، کد، واحد، ارزیاب...' : 'Search assessments...'}
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-hidden"
                />
              </div>

              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'تمام سطوح ریسک' : 'All Risk Levels'}</option>
                <option value="CRITICAL">{isFa ? 'فقط بحرانی (Critical)' : 'Critical Only'}</option>
                <option value="HIGH">{isFa ? 'فقط بالا (High)' : 'High Only'}</option>
                <option value="MEDIUM">{isFa ? 'فقط متوسط (Medium)' : 'Medium Only'}</option>
                <option value="LOW">{isFa ? 'فقط پایین (Low)' : 'Low Only'}</option>
              </select>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-3 font-bold whitespace-nowrap">{isFa ? 'کد سند' : 'Code'}</th>
                  <th className="p-3 font-bold min-w-[200px]">{isFa ? 'عنوان ارزیابی' : 'Title'}</th>
                  <th className="p-3 font-bold min-w-[170px]">{isFa ? 'واحد عملیاتی' : 'Unit'}</th>
                  <th className="p-3 font-bold min-w-[130px]">{isFa ? 'ارزیاب / تیم' : 'Assessor'}</th>
                  <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'تاریخ' : 'Date'}</th>
                  <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'سطح ریسک' : 'Risk Level'}</th>
                  <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentMethodAssessments.length > 0 ? (
                  currentMethodAssessments.map(item => {
                    const colors = getRiskLevelColor(item.overallRiskLevel);
                    return (
                      <tr 
                        key={item.id} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 inline-block px-2 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-[11px]" dir="ltr">
                            {item.code}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200 max-w-sm">
                          {item.title}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {item.unit} - {item.areaLocation}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {item.assessorName}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500 text-center whitespace-nowrap" dir="ltr">
                          {item.assessmentDate}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[11px] font-black whitespace-nowrap ${colors.badge}`}>
                            {isFa ? colors.labelFa : colors.labelEn}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                            {isFa ? 'تأییدشده' : 'Approved'}
                          </span>
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 1. View & Print */}
                            <button
                              onClick={() => handleOpenPrintModal(item)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 text-[11px] cursor-pointer"
                              title={isFa ? 'مشاهده و چاپ استاندارد' : 'View & Print'}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>{isFa ? 'مشاهده و چاپ' : 'Print'}</span>
                            </button>

                            {/* 2. Edit */}
                            <button
                              onClick={() => handleEditAssessment(item)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg transition cursor-pointer"
                              title={isFa ? 'ویرایش سند' : 'Edit'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* 3. Delete */}
                            <button
                              onClick={() => handleRequestDelete(item)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-500 hover:text-red-700 dark:text-red-400 rounded-lg transition cursor-pointer"
                              title={isFa ? 'حذف سند' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-bold text-xs">
                      {isFa ? 'موردی با شرایط فیلتر انتخاب شده یافت نشد.' : 'No records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* ── Active Form Rendering (JSA, FMEA, FTA, HHA) ── */}
      {(activeView === 'FORM_NEW' || activeView === 'FORM_EDIT') && (
        <div>
          {selectedMethod === 'JSA' && (
            <JsaForm
              initialData={selectedAssessment as any}
              onSave={handleSaveAssessment}
              onCancel={() => setActiveView('OVERVIEW')}
              isFa={isFa}
              currentUser={currentUser}
            />
          )}

          {selectedMethod === 'FMEA' && (
            <FmeaForm
              initialData={selectedAssessment as any}
              onSave={handleSaveAssessment}
              onCancel={() => setActiveView('OVERVIEW')}
              isFa={isFa}
              currentUser={currentUser}
            />
          )}

          {selectedMethod === 'FTA' && (
            <FtaForm
              initialData={selectedAssessment as any}
              onSave={handleSaveAssessment}
              onCancel={() => setActiveView('OVERVIEW')}
              isFa={isFa}
              currentUser={currentUser}
            />
          )}

          {selectedMethod === 'HHA' && (
            <HhaForm
              initialData={selectedAssessment as any}
              onSave={handleSaveAssessment}
              onCancel={() => setActiveView('OVERVIEW')}
              isFa={isFa}
              currentUser={currentUser}
            />
          )}

          {/* Fallback for other methods */}
          {!['JSA', 'FMEA', 'FTA', 'HHA'].includes(selectedMethod) && (
            <JsaForm
              initialData={selectedAssessment as any}
              onSave={handleSaveAssessment}
              onCancel={() => setActiveView('OVERVIEW')}
              isFa={isFa}
              currentUser={currentUser}
            />
          )}
        </div>
      )}

      {/* ── Standard Print & View Modal ── */}
      {previewAssessment && (
        <RiskAssessmentPrintModal
          assessment={previewAssessment}
          isFa={isFa}
          onClose={() => setPreviewAssessment(null)}
          onEdit={(a) => handleEditAssessment(a)}
        />
      )}

      {/* ── Standard Delete Confirmation Modal ── */}
      {deleteConfirmAssessment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 text-right" dir={isFa ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-2xl">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                  {isFa ? 'تأیید حذف پرونده ارزیابی ریسک' : 'Confirm Risk Assessment Deletion'}
                </h4>
                <p className="text-[11px] font-mono text-slate-500">
                  {deleteConfirmAssessment.code} - {deleteConfirmAssessment.method}
                </p>
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                {isFa 
                  ? `آیا از حذف ارزیابی «${deleteConfirmAssessment.title}» اطمینان دارید؟` 
                  : `Are you sure you want to delete assessment "${deleteConfirmAssessment.title}"?`}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {isFa 
                  ? 'این عملیات غیرقابل بازگشت است و تمام ردیف‌ها، ماتریس‌ها و سوابق این ارزیابی ریسک به‌طور دائم حذف خواهند شد.' 
                  : 'This action is irreversible and all data, steps, and matrices for this risk assessment will be permanently deleted.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmAssessment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isFa ? 'تأیید و حذف قطعی' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
