import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  LayoutDashboard,
  Printer,
  Edit3,
  Trash2,
  AlertCircle,
  X,
  Grid3X3,
} from 'lucide-react';
import { AnyRiskAssessment, RiskMethod } from './types';
import {
  riskAssessmentService,
  getRiskLevelColor,
  getMethodMeta,
  getDistinctMethods,
  getStatusBadgeMeta,
} from './services/riskAssessmentService';
import RiskDashboardOverview from './components/RiskDashboardOverview';
import RiskAssessmentPrintModal from './components/RiskAssessmentPrintModal';
import JsaForm from './components/JsaForm';
import FmeaForm from './components/FmeaForm';
import FtaForm from './components/FtaForm';
import HhaForm from './components/HhaForm';
import WhatIfForm from './components/WhatIfForm';
import BowTieEditor from './components/BowTieEditor';
import RiskMatrixWorkspace from './components/RiskMatrixWorkspace';
import JobActivityRiskForm from './components/JobActivityRiskForm';

interface RiskAssessmentModuleProps {
  currentUser: any;
  isFa: boolean;
}

type ActiveViewMode = 'OVERVIEW' | 'METHOD_RECORDS' | 'MATRIX_WORKSPACE';

interface FormModalState {
  open: boolean;
  method: RiskMethod;
  assessment: AnyRiskAssessment | null;
}

const CREATEABLE_METHODS: RiskMethod[] = [
  'FMEA',
  'JSA',
  'FTA',
  'HHA',
  'WHAT_IF',
  'BOWTIE',
  'JOB_ACTIVITY',
];

export default function RiskAssessmentModule({ currentUser, isFa }: RiskAssessmentModuleProps) {
  const [assessments, setAssessments] = useState<AnyRiskAssessment[]>([]);
  const [activeView, setActiveView] = useState<ActiveViewMode>('OVERVIEW');
  const [selectedMethod, setSelectedMethod] = useState<RiskMethod>('FMEA');
  const [formModal, setFormModal] = useState<FormModalState>({
    open: false,
    method: 'FMEA',
    assessment: null,
  });
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [previewAssessment, setPreviewAssessment] = useState<AnyRiskAssessment | null>(null);
  const [deleteConfirmAssessment, setDeleteConfirmAssessment] = useState<AnyRiskAssessment | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const userRoleUpper = String(currentUser?.role || '').toUpperCase().replace(/[\s_]/g, '');
  const canEditMatrixConfig = [
    'ADMIN',
    'ADMINISTRATOR',
    'HSEMANAGER',
    'EXECUTIVEMANAGER',
  ].includes(userRoleUpper);

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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteConfirmAssessment) {
        setDeleteConfirmAssessment(null);
      } else if (previewAssessment) {
        setPreviewAssessment(null);
      } else if (formModal.open) {
        setFormModal(prev => ({ ...prev, open: false, assessment: null }));
      } else if (methodPickerOpen) {
        setMethodPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [deleteConfirmAssessment, previewAssessment, formModal.open, methodPickerOpen]);

  const closeFormModal = () => {
    setFormModal(prev => ({ ...prev, open: false, assessment: null }));
  };

  const handleSaveAssessment = async (assessment: AnyRiskAssessment) => {
    setActionError(null);
    try {
      await riskAssessmentService.saveAssessment(assessment);
      await loadAssessments();
      closeFormModal();
    } catch (err: any) {
      setActionError(
        err?.message ||
          (isFa
            ? 'خطا در ذخیره‌سازی ارزیابی ریسک در پایگاه داده. لطفاً دوباره تلاش کنید.'
            : 'Failed to save risk assessment.')
      );
      throw err;
    }
  };

  const handleRequestDelete = (assessment: AnyRiskAssessment) => {
    setDeleteConfirmAssessment(assessment);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmAssessment) return;
    setActionError(null);
    try {
      const ok = await riskAssessmentService.deleteAssessment(
        deleteConfirmAssessment.dbId || deleteConfirmAssessment.id
      );
      if (!ok) {
        setActionError(
          isFa ? 'حذف پرونده ارزیابی با خطا مواجه شد.' : 'Failed to delete risk assessment.'
        );
        return;
      }
      await loadAssessments();
      if (formModal.assessment?.id === deleteConfirmAssessment.id) {
        closeFormModal();
      }
      if (previewAssessment?.id === deleteConfirmAssessment.id) {
        setPreviewAssessment(null);
      }
      setDeleteConfirmAssessment(null);
    } catch (err: any) {
      setActionError(err?.message || (isFa ? 'خطا در حذف پرونده.' : 'Delete error.'));
    }
  };

  const handleSelectTab = (method: RiskMethod) => {
    setActionError(null);
    setSelectedMethod(method);
    if (method === 'MATRIX') {
      setActiveView('MATRIX_WORKSPACE');
    } else {
      setActiveView('METHOD_RECORDS');
    }
  };

  const handleStartNewAssessment = (method?: RiskMethod) => {
    setActionError(null);
    if (method && method !== 'MATRIX') {
      setMethodPickerOpen(false);
      setFormModal({ open: true, method, assessment: null });
      return;
    }
    if (activeView === 'METHOD_RECORDS' && selectedMethod !== 'MATRIX') {
      setMethodPickerOpen(false);
      setFormModal({ open: true, method: selectedMethod, assessment: null });
      return;
    }
    setMethodPickerOpen(true);
  };

  const handleEditAssessment = (assessment: AnyRiskAssessment) => {
    setActionError(null);
    setPreviewAssessment(null);
    setMethodPickerOpen(false);
    setFormModal({
      open: true,
      method: assessment.method,
      assessment,
    });
  };

  const handleOpenPrintModal = (assessment: AnyRiskAssessment) => {
    setPreviewAssessment(assessment);
  };

  const availableMethods = getDistinctMethods(assessments);

  const currentMethodAssessments = assessments.filter(a => {
    if (activeView === 'METHOD_RECORDS' && a.method !== selectedMethod) return false;
    if (filterLevel !== 'ALL' && a.overallRiskLevel !== filterLevel) return false;
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
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
  const modalMethodMeta = getMethodMeta(formModal.method);

  return (
    <div className="w-full space-y-5 pb-12" id="risk-assessment-module">
      {/* ── Top Navigation Bar: Dashboard + 8 Specialized Tabs ── */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full custom-scrollbar">
          <button
            type="button"
            onClick={() => {
              setActiveView('OVERVIEW');
              setActionError(null);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeView === 'OVERVIEW'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{isFa ? 'داشبورد جامع' : 'Risk Dashboard'}</span>
          </button>

          {availableMethods.map(method => {
            const meta = getMethodMeta(method);
            const count =
              method === 'MATRIX'
                ? assessments.length
                : assessments.filter(a => (a.method || '').toUpperCase() === method).length;
            const isSelected =
              (method === 'MATRIX' && activeView === 'MATRIX_WORKSPACE') ||
              (method !== 'MATRIX' && activeView === 'METHOD_RECORDS' && selectedMethod === method);
            return (
              <button
                type="button"
                key={method}
                onClick={() => handleSelectTab(method)}
                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {method === 'MATRIX' && <Grid3X3 className="w-3.5 h-3.5" />}
                <span>{isFa ? meta.shortFa : method}</span>
                {count > 0 && method !== 'MATRIX' && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
                      isSelected
                        ? 'bg-indigo-800/80 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              handleStartNewAssessment(
                activeView === 'METHOD_RECORDS' && selectedMethod !== 'MATRIX'
                  ? selectedMethod
                  : undefined
              )
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>
              {activeView === 'METHOD_RECORDS' && selectedMethod !== 'MATRIX'
                ? isFa
                  ? `ارزیابی جدید (${currentMethodMeta.shortFa})`
                  : `New ${selectedMethod}`
                : isFa
                ? 'ارزیابی جدید'
                : 'New Assessment'}
            </span>
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── View Router (Background Tab Workspace stays mounted cleanly behind modals) ── */}
      {activeView === 'OVERVIEW' && (
        <RiskDashboardOverview
          assessments={assessments}
          isFa={isFa}
          onSelectMethod={handleSelectTab}
          onNewAssessment={m => handleStartNewAssessment(m)}
          onViewAssessment={a => handleOpenPrintModal(a)}
          onPrintAssessment={a => handleOpenPrintModal(a)}
          onEditAssessment={a => handleEditAssessment(a)}
          onDeleteAssessment={a => handleRequestDelete(a)}
        />
      )}

      {activeView === 'MATRIX_WORKSPACE' && (
        <RiskMatrixWorkspace
          assessments={assessments}
          isFa={isFa}
          canEditConfig={canEditMatrixConfig}
          onViewAssessment={a => handleOpenPrintModal(a)}
          onEditAssessment={a => handleEditAssessment(a)}
        />
      )}

      {activeView === 'METHOD_RECORDS' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Method Info Header */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl text-white font-mono font-black flex items-center justify-center text-xs shadow-sm shrink-0"
                style={{ backgroundColor: currentMethodMeta.chartColor }}
              >
                {selectedMethod === 'JOB_ACTIVITY' ? 'JOB' : selectedMethod === 'WHAT_IF' ? 'W-IF' : selectedMethod}
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? currentMethodMeta.titleFa : currentMethodMeta.titleEn}
                </h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa ? currentMethodMeta.descFa : currentMethodMeta.titleEn}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 tabular-nums">
                {currentMethodAssessments.length} {isFa ? 'سند ثبت‌شده' : 'Records'}
              </span>
              <button
                type="button"
                onClick={() => handleStartNewAssessment(selectedMethod)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? `ثبت فرم ${currentMethodMeta.shortFa}` : `New ${selectedMethod}`}</span>
              </button>
            </div>
          </div>

          {/* Method Filter & Search */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isFa ? 'جستجو در عنوان، کد، واحد، ارزیاب...' : 'Search assessments...'}
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-hidden text-slate-800 dark:text-slate-100"
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

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'تمام وضعیت‌ها' : 'All Statuses'}</option>
                <option value="DRAFT">{isFa ? 'پیش‌نویس' : 'Draft'}</option>
                <option value="UNDER_REVIEW">{isFa ? 'در انتظار بازبینی/تایید' : 'Under Review'}</option>
                <option value="APPROVED">{isFa ? 'تایید نهایی' : 'Approved'}</option>
                <option value="ARCHIVED">{isFa ? 'بایگانی‌شده' : 'Archived'}</option>
              </select>
            </div>
          </div>

          {/* Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3 font-bold whitespace-nowrap">{isFa ? 'کد سند' : 'Code'}</th>
                    <th className="p-3 font-bold min-w-[200px]">{isFa ? 'عنوان ارزیابی' : 'Title'}</th>
                    <th className="p-3 font-bold min-w-[160px]">{isFa ? 'واحد / موقعیت' : 'Unit'}</th>
                    <th className="p-3 font-bold min-w-[120px]">{isFa ? 'ارزیاب' : 'Assessor'}</th>
                    <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'تاریخ' : 'Date'}</th>
                    <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'ریسک اولیه' : 'Initial Risk'}</th>
                    <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'ریسک باقیمانده' : 'Residual Risk'}</th>
                    <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'اقدامات' : 'CAPA'}</th>
                    <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'وضعیت' : 'Status'}</th>
                    <th className="p-3 font-bold text-center whitespace-nowrap">{isFa ? 'عملیات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentMethodAssessments.length > 0 ? (
                    currentMethodAssessments.map(item => {
                      const initColors = getRiskLevelColor(item.overallRiskLevel);
                      const resColors = getRiskLevelColor(item.residualRiskLevel || 'LOW');
                      const statusMeta = getStatusBadgeMeta(item.status, isFa);
                      const actionCount = Array.isArray(item.controlActions) ? item.controlActions.length : 0;
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className="font-mono font-bold text-indigo-600 dark:text-indigo-400 inline-block px-2 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-[11px]"
                              dir="ltr"
                            >
                              {item.code}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200 max-w-sm">
                            {item.title}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {item.unit} {item.areaLocation ? `- ${item.areaLocation}` : ''}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">{item.assessorName}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-500 text-center whitespace-nowrap" dir="ltr">
                            {item.assessmentDate}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-black ${initColors.badge}`}>
                              {isFa ? initColors.shortLabelFa : initColors.shortLabelEn}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[10px] font-black ${resColors.badge}`}>
                              {isFa ? resColors.shortLabelFa : resColors.shortLabelEn}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap tabular-nums font-bold text-slate-600 dark:text-slate-300">
                            {actionCount}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenPrintModal(item)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1 text-[11px] cursor-pointer"
                                title={isFa ? 'مشاهده و چاپ استاندارد' : 'View & Print'}
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>{isFa ? 'چاپ' : 'Print'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditAssessment(item)}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg transition cursor-pointer"
                                title={isFa ? 'ویرایش سند' : 'Edit'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
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
                      <td colSpan={10} className="p-8 text-center text-slate-400 font-bold text-xs">
                        {isFa ? 'موردی با شرایط فیلتر انتخاب شده یافت نشد.' : 'No records found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Methodology Selector Modal (when creating from Dashboard / Matrix tab) ── */}
      {methodPickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => setMethodPickerOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {isFa ? 'انتخاب روش ارزیابی ریسک جدید' : 'Select Risk Assessment Methodology'}
                </h3>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa
                    ? 'روش مورد نظر را انتخاب کنید تا فرم تخصصی آن در پنجره مستقل باز شود'
                    : 'Choose a methodology to open its dedicated assessment form'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMethodPickerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition cursor-pointer"
                title={isFa ? 'بستن' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {CREATEABLE_METHODS.map(m => {
                const meta = getMethodMeta(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleStartNewAssessment(m)}
                    className="text-right p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-white dark:hover:bg-slate-800 transition flex items-start gap-3 cursor-pointer group"
                  >
                    <span
                      className="w-11 h-11 rounded-xl text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: meta.chartColor }}
                    >
                      {m === 'JOB_ACTIVITY' ? 'JOB' : m === 'WHAT_IF' ? 'W-IF' : m}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {isFa ? meta.titleFa : meta.titleEn}
                      </div>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {isFa ? meta.descFa : meta.titleEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Standalone Form Modal Window (All 7 Assessment Forms open separately over active tab) ── */}
      {formModal.open && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={isFa ? modalMethodMeta.titleFa : modalMethodMeta.titleEn}
        >
          <div
            className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            dir={isFa ? 'rtl' : 'ltr'}
          >
            {/* Dedicated Modal Top Window Bar */}
            <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="px-2.5 py-1.5 rounded-xl text-white font-mono font-black text-xs shrink-0 shadow-xs"
                  style={{ backgroundColor: modalMethodMeta.chartColor }}
                >
                  {modalMethodMeta.shortFa}
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                    {formModal.assessment
                      ? isFa
                        ? `ویرایش پرونده ارزیابی ریسک — ${formModal.assessment.code}`
                        : `Edit Risk Assessment — ${formModal.assessment.code}`
                      : isFa
                      ? `ثبت ارزیابی ریسک جدید — ${modalMethodMeta.titleFa}`
                      : `New Risk Assessment — ${modalMethodMeta.titleEn}`}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                    {isFa ? modalMethodMeta.descFa : modalMethodMeta.titleEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeFormModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                title={isFa ? 'بستن پنجره فرم' : 'Close Form'}
                aria-label={isFa ? 'بستن' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Specialized Form Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {formModal.method === 'FMEA' && (
                <FmeaForm
                  initialData={formModal.assessment as any}
                  allAssessments={assessments}
                  onSave={handleSaveAssessment}
                  onCancel={closeFormModal}
                  isFa={isFa}
                  currentUser={currentUser}
                />
              )}

              {formModal.method === 'JSA' && (
                <JsaForm
                  initialData={formModal.assessment as any}
                  allAssessments={assessments}
                  onSave={handleSaveAssessment}
                  onCancel={closeFormModal}
                  isFa={isFa}
                  currentUser={currentUser}
                />
              )}

              {formModal.method === 'FTA' && (
                <FtaForm
                  initialData={formModal.assessment as any}
                  allAssessments={assessments}
                  onSave={handleSaveAssessment}
                  onCancel={closeFormModal}
                  isFa={isFa}
                  currentUser={currentUser}
                />
              )}

              {formModal.method === 'HHA' && (
                <HhaForm
                  initialData={formModal.assessment as any}
                  allAssessments={assessments}
                  onSave={handleSaveAssessment}
                  onCancel={closeFormModal}
                  isFa={isFa}
                  currentUser={currentUser}
                />
              )}

              {formModal.method === 'WHAT_IF' && (
                <WhatIfForm
                  initialData={formModal.assessment as any}
                  allAssessments={assessments}
                  onSave={handleSaveAssessment}
                  onCancel={closeFormModal}
                  isFa={isFa}
                  currentUser={currentUser}
                />
              )}

              {formModal.method === 'BOWTIE' && (
                <BowTieEditor
                  initialData={formModal.assessment as any}
                  allAssessments={assessments}
                  onSave={handleSaveAssessment}
                  onCancel={closeFormModal}
                  isFa={isFa}
                  currentUser={currentUser}
                />
              )}

              {formModal.method === 'JOB_ACTIVITY' && (
                <JobActivityRiskForm
                  initialData={formModal.assessment as any}
                  allAssessments={assessments}
                  onSave={handleSaveAssessment}
                  onCancel={closeFormModal}
                  isFa={isFa}
                  currentUser={currentUser}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Print & View Modal ── */}
      {previewAssessment && (
        <RiskAssessmentPrintModal
          assessment={previewAssessment}
          isFa={isFa}
          onClose={() => setPreviewAssessment(null)}
          onEdit={a => handleEditAssessment(a)}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteConfirmAssessment && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 text-right"
            dir={isFa ? 'rtl' : 'ltr'}
          >
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
