import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Printer,
  Edit3,
  Trash2,
  History,
  FileText,
  Camera,
  Loader2,
  Wrench,
  Link2,
  Clock,
  Check,
} from 'lucide-react';
import {
  getInspectionReasonLabelFa,
  getScaffoldTypeLabelFa,
  getWorkflowStepIndex,
  resolveChecklistAnswer,
  SCAFFOLD_TAG_META,
  SCAFFOLD_WORKFLOW_STEPS,
  ScaffoldBootstrapData,
  ScaffoldDetailData,
  ScaffoldInspectionRecord,
  ScaffoldRecord,
  ScaffoldTagStatus,
} from './types';
import { scaffoldingApi } from './scaffoldingApi';
import ScaffoldInspectionModal from './ScaffoldInspectionModal';
import ScaffoldPrintModal from './ScaffoldPrintModal';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import { getCurrentShamsiYear } from '../../../utils/jalaliDate';

interface Props {
  scaffoldId: number;
  bootstrap: ScaffoldBootstrapData;
  onClose: () => void;
  onEdit: (record: ScaffoldRecord) => void;
  onChanged: () => void;
  onSettingsUpdated?: (allowNaOption: boolean) => void;
}

export default function ScaffoldDetailModal({
  scaffoldId,
  bootstrap,
  onClose,
  onEdit,
  onChanged,
  onSettingsUpdated,
}: Props) {
  const [detail, setDetail] = useState<ScaffoldDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'checklist' | 'inspections' | 'tagHistory'>('overview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Sub-modals & inline action drawers
  const [showInspectModal, setShowInspectModal] = useState(false);
  const [printInspection, setPrintInspection] = useState<ScaffoldInspectionRecord | null | undefined>(undefined);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [newTagChoice, setNewTagChoice] = useState<ScaffoldTagStatus>('YELLOW');
  const [tagReason, setTagReason] = useState('');
  const [tagValidUntil, setTagValidUntil] = useState(bootstrap.defaultNextDueDate || '');

  const [showApprovePanel, setShowApprovePanel] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [issueGreenWithApproval, setIssueGreenWithApproval] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedHistoryInspectionId, setSelectedHistoryInspectionId] = useState<number | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await scaffoldingApi.getDetail(scaffoldId);
      setDetail(data);
      setNewTagChoice(data.scaffold.tagStatus);
      setTagValidUntil(data.scaffold.nextInspectionDueDate || bootstrap.defaultNextDueDate || '');
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در دریافت اطلاعات داربست');
    } finally {
      setLoading(false);
    }
  }, [scaffoldId, bootstrap.defaultNextDueDate]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleCompleteInstall = async () => {
    if (!detail) return;
    setBusyAction('complete');
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await scaffoldingApi.completeInstallation(detail.scaffold.id, {
        installationCompletedDate: bootstrap.todayJalali,
      });
      setSuccessMsg('تکمیل نصب داربست با موفقیت ثبت شد. داربست آماده بازرسی HSE است.');
      await loadDetail();
      onChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در ثبت تکمیل نصب');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setBusyAction('approve');
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await scaffoldingApi.approve(detail.scaffold.id, {
        comment: approvalComment,
        issueGreenTag: issueGreenWithApproval,
        tagValidUntil,
      });
      setShowApprovePanel(false);
      setApprovalComment('');
      setSuccessMsg(
        issueGreenWithApproval
          ? 'تأیید نهایی بازرس HSE ثبت و تگ سبز (مجاز به استفاده) صادر گردید.'
          : 'تأیید نهایی بازرس HSE ثبت گردید.'
      );
      await loadDetail();
      onChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در تأیید نهایی داربست');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTagChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    if (!tagReason.trim()) {
      setErrorMsg('درج علت تغییر وضعیت تگ رنگی الزامی است.');
      return;
    }
    setBusyAction('tag');
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await scaffoldingApi.changeTag(detail.scaffold.id, {
        newTag: newTagChoice,
        reason: tagReason.trim(),
        validUntil: newTagChoice === 'GREEN' ? tagValidUntil : undefined,
      });
      setShowTagPanel(false);
      setTagReason('');
      setSuccessMsg(`وضعیت تگ داربست با موفقیت به «${SCAFFOLD_TAG_META[newTagChoice].shortFa}» تغییر یافت.`);
      await loadDetail();
      onChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در تغییر وضعیت تگ');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setBusyAction('delete');
    setErrorMsg(null);
    try {
      await scaffoldingApi.delete(detail.scaffold.id);
      onChanged();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در حذف رکورد داربست');
      setBusyAction(null);
    }
  };

  const scaffold = detail?.scaffold;
  const perms = detail?.permissions;
  const latestInspection = detail?.inspections[0] || null;
  const currentStepOrder = scaffold ? getWorkflowStepIndex(scaffold.workflowStatus) : 1;

  const canApproveNow = Boolean(
    scaffold &&
      perms?.canApprove &&
      scaffold.inspectionsCount > 0 &&
      !scaffold.hasCriticalDefect &&
      !scaffold.hasOpenDefects
  );

  const tagBannerClasses =
    scaffold?.tagStatus === 'GREEN'
      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
      : scaffold?.tagStatus === 'YELLOW'
        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-100'
        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-100';

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-2 sm:p-4" dir="rtl">
        <div className="bg-white dark:bg-slate-800 w-full max-w-6xl max-h-[94vh] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 shrink-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  پرونده فنی داربست {scaffold ? `— ${scaffold.scaffoldCode}` : ''}
                </h3>
                {scaffold && (
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black ${
                      scaffold.tagStatus === 'GREEN'
                        ? 'bg-emerald-600 text-white'
                        : scaffold.tagStatus === 'YELLOW'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-rose-600 text-white'
                    }`}
                  >
                    {SCAFFOLD_TAG_META[scaffold.tagStatus].shortFa}
                  </span>
                )}
              </div>
              {scaffold && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {scaffold.requestingUnit} • {scaffold.installationLocation} • پیمانکار: {scaffold.contractorName}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20 text-slate-500 gap-2 text-sm font-bold">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              در حال دریافت پرونده داربست از پایگاه داده...
            </div>
          ) : !detail || !scaffold ? (
            <div className="flex-1 flex items-center justify-center py-20 text-rose-600 text-sm font-bold">
              {errorMsg || 'اطلاعات داربست یافت نشد.'}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Alerts */}
              {errorMsg && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Prominent Color Tag Banner */}
              <div className={`p-4 rounded-2xl border-2 flex flex-col md:flex-row md:items-center justify-between gap-4 ${tagBannerClasses}`}>
                <div className="flex items-start gap-3">
                  {scaffold.tagStatus === 'GREEN' ? (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
                  ) : scaffold.tagStatus === 'YELLOW' ? (
                    <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-7 h-7 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-sm font-black">{SCAFFOLD_TAG_META[scaffold.tagStatus].labelFa}</div>
                    <p className="text-xs opacity-90 mt-1">{SCAFFOLD_TAG_META[scaffold.tagStatus].descriptionFa}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs shrink-0">
                  <div className="px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-current/15">
                    <div className="text-[10px] opacity-75">اعتبار تگ تا</div>
                    <div className="font-mono font-black">{scaffold.tagValidUntil || 'نامعتبر'}</div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-current/15">
                    <div className="text-[10px] opacity-75">تأییدکننده نهایی</div>
                    <div className="font-bold">{scaffold.approvedBy || 'تأیید نشده'}</div>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/50 border border-current/15">
                    <div className="text-[10px] opacity-75">نواقص باز</div>
                    <div className="font-mono font-black">
                      {scaffold.openDefectsCount} ({scaffold.criticalDefectsCount} بحرانی)
                    </div>
                  </div>
                </div>
              </div>

              {/* 8-Stage Approval Workflow Stepper */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <div className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3">
                  فرآیند تأیید و مجازسازی داربست (۸ مرحله استاندارد)
                </div>
                <div className="grid grid-cols-4 lg:grid-cols-8 gap-2 min-w-[640px]">
                  {SCAFFOLD_WORKFLOW_STEPS.map(step => {
                    const isCompleted = currentStepOrder > step.order || (step.order === 8 && scaffold.workflowStatus === 'AUTHORIZED_FOR_USE');
                    const isCurrent = scaffold.workflowStatus === step.key;
                    const isDefectBlocked = step.key === 'DEFECTS_REVIEW' && scaffold.hasOpenDefects;
                    return (
                      <div
                        key={step.key}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isDefectBlocked
                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-800 dark:text-rose-200'
                            : isCurrent
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                        }`}
                      >
                        <div className="text-[10px] font-mono font-black flex items-center justify-center gap-1">
                          {isCompleted && !isCurrent ? <Check className="w-3 h-3" /> : `${step.order}`}
                        </div>
                        <div className="text-[10px] font-bold mt-1 leading-tight">{step.shortFa}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RBAC-Gated Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {scaffold.workflowStatus === 'INSTALLATION_REQUESTED' && (perms?.canEdit || perms?.canCreate || perms?.canInspect) && (
                  <button
                    type="button"
                    disabled={busyAction === 'complete'}
                    onClick={handleCompleteInstall}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black cursor-pointer"
                  >
                    {busyAction === 'complete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                    ثبت تکمیل نصب
                  </button>
                )}

                {perms?.canInspect && (
                  <button
                    type="button"
                    onClick={() => setShowInspectModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    {scaffold.inspectionsCount > 0 ? 'ثبت بازرسی دوره‌ای / مجدد' : 'شروع بازرسی و تکمیل چک‌لیست'}
                  </button>
                )}

                {perms?.canApprove && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowApprovePanel(v => !v);
                      setShowTagPanel(false);
                    }}
                    disabled={!canApproveNow}
                    title={
                      !canApproveNow
                        ? scaffold.inspectionsCount === 0
                          ? 'ابتدا چک‌لیست بازرسی را ثبت کنید'
                          : 'وجود نقص باز/بحرانی مانع تأیید نهایی است'
                        : 'تأیید نهایی بازرس مجاز HSE'
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-black cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    تأیید نهایی بازرس HSE
                  </button>
                )}

                {perms?.canChangeTag && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTagPanel(v => !v);
                      setShowApprovePanel(false);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    <Tag className="w-4 h-4" />
                    تغییر وضعیت تگ رنگی
                  </button>
                )}

                {perms?.canReport && (
                  <button
                    type="button"
                    onClick={() => setPrintInspection(latestInspection)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    پیش‌نمایش چاپ / PDF چک‌لیست
                  </button>
                )}

                {perms?.canEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(scaffold)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    ویرایش
                  </button>
                )}

                {perms?.canDelete && !confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-xs font-bold cursor-pointer mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </button>
                )}

                {perms?.canDelete && confirmDelete && (
                  <div className="flex items-center gap-2 mr-auto bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 px-3 py-1.5 rounded-xl">
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">حذف دائمی؟</span>
                    <button
                      type="button"
                      disabled={busyAction === 'delete'}
                      onClick={handleDelete}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-black cursor-pointer"
                    >
                      تأیید حذف
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                )}
              </div>

              {/* Inline Approval Drawer */}
              {showApprovePanel && perms?.canApprove && (
                <form
                  onSubmit={handleApprove}
                  className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 space-y-3"
                >
                  <div className="text-xs font-black text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    تأیید نهایی بازرس مجاز HSE
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        توضیحات تأیید نهایی
                      </label>
                      <input
                        type="text"
                        value={approvalComment}
                        onChange={e => setApprovalComment(e.target.value)}
                        placeholder="انطباق کامل داربست با الزامات ایمنی تأیید می‌گردد"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <PersianDatePicker
                        isFa
                        label="تاریخ اعتبار تگ سبز"
                        value={tagValidUntil}
                        onChange={val => setTagValidUntil(val)}
                        maxYear={getCurrentShamsiYear() + 5}
                        placeholder="انتخاب تاریخ اعتبار تگ سبز"
                        showGregorianPreview={false}
                      />
                    </div>
                  </div>
                  {perms.canChangeTag && (
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={issueGreenWithApproval}
                        onChange={e => setIssueGreenWithApproval(e.target.checked)}
                      />
                      صدور هم‌زمان تگ سبز و مجاز کردن استفاده عملیاتی
                    </label>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApprovePanel(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={busyAction === 'approve'}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-black cursor-pointer"
                    >
                      {busyAction === 'approve' ? 'در حال ثبت...' : 'ثبت تأیید نهایی'}
                    </button>
                  </div>
                </form>
              )}

              {/* Inline Tag Status Change Drawer */}
              {showTagPanel && perms?.canChangeTag && (
                <form
                  onSubmit={handleTagChange}
                  className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-3"
                >
                  <div className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    مدیریت و تغییر وضعیت تگ رنگی داربست (با ثبت در تاریخچه ممیزی)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['GREEN', 'YELLOW', 'RED'] as ScaffoldTagStatus[]).map(t => {
                      const blockedGreen =
                        t === 'GREEN' &&
                        (scaffold.inspectionsCount === 0 ||
                          scaffold.hasCriticalDefect ||
                          scaffold.hasOpenDefects ||
                          !scaffold.approvedAt);
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={blockedGreen}
                          onClick={() => setNewTagChoice(t)}
                          className={`p-3 rounded-xl border-2 text-right transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            newTagChoice === t
                              ? t === 'GREEN'
                                ? 'border-emerald-600 bg-emerald-100 dark:bg-emerald-900/40'
                                : t === 'YELLOW'
                                  ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/40'
                                  : 'border-rose-600 bg-rose-100 dark:bg-rose-900/40'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                          }`}
                        >
                          <div className="text-xs font-black">{SCAFFOLD_TAG_META[t].shortFa}</div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                            {blockedGreen
                              ? 'مسدود: نیازمند بازرسی بدون نقص و تأیید بازرس'
                              : SCAFFOLD_TAG_META[t].descriptionFa.slice(0, 65) + '...'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className={newTagChoice === 'GREEN' ? 'sm:col-span-2' : 'sm:col-span-3'}>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        علت تغییر وضعیت تگ <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={tagReason}
                        onChange={e => setTagReason(e.target.value)}
                        placeholder="مثال: مشاهده لق‌شدگی بست‌های مهاربندی / طوفان شدید / تکمیل اصلاحات و تأیید مجدد..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                    {newTagChoice === 'GREEN' && (
                      <div>
                        <PersianDatePicker
                          isFa
                          label="تاریخ اعتبار تگ سبز"
                          value={tagValidUntil}
                          onChange={val => setTagValidUntil(val)}
                          maxYear={getCurrentShamsiYear() + 5}
                          placeholder="انتخاب تاریخ اعتبار تگ سبز"
                          showGregorianPreview={false}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTagPanel(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      disabled={busyAction === 'tag'}
                      className="px-4 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-black cursor-pointer"
                    >
                      {busyAction === 'tag' ? 'در حال ثبت...' : 'ثبت تغییر تگ'}
                    </button>
                  </div>
                </form>
              )}

              {/* Detail Sub-tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                {[
                  { key: 'overview', label: 'مشخصات، PTW و تصاویر', icon: FileText },
                  { key: 'checklist', label: `آخرین چک‌لیست (${latestInspection ? latestInspection.checklistItems.length : 0})`, icon: ClipboardCheck },
                  { key: 'inspections', label: `تاریخچه بازرسی‌ها (${detail.inspections.length})`, icon: History },
                  { key: 'tagHistory', label: `تاریخچه تگ رنگی (${detail.tagHistory.length})`, icon: Tag },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = activeSubTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveSubTab(tab.key as any)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-black border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                        active
                          ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub-Tab 1: Overview & Photos */}
              {activeSubTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {[
                      { label: 'شماره یکتای داربست', val: scaffold.scaffoldCode, mono: true },
                      { label: 'تاریخ درخواست نصب', val: scaffold.requestDate, mono: true },
                      { label: 'تاریخ تکمیل نصب', val: scaffold.installationCompletedDate || 'ثبت نشده', mono: true },
                      { label: 'واحد درخواست‌کننده', val: scaffold.requestingUnit },
                      { label: 'محل نصب و ناحیه', val: `${scaffold.installationLocation}${scaffold.areaName ? ` (${scaffold.areaName})` : ''}` },
                      { label: 'واحد / تجهیز مربوطه', val: `${scaffold.unitName || '-'} / ${scaffold.equipmentName || '-'}` },
                      { label: 'نوع داربست', val: getScaffoldTypeLabelFa(scaffold.scaffoldType) },
                      { label: 'ارتفاع داربست', val: `${scaffold.heightMeters} متر`, mono: true },
                      { label: 'نام پیمانکار', val: scaffold.contractorName },
                      { label: 'مسئول نصب داربست', val: scaffold.erectorSupervisorName },
                      {
                        label: 'بازرس HSE (بانک پرسنلی)',
                        val: `${scaffold.inspectorName}${scaffold.inspectorPersonnelCode ? ` (${scaffold.inspectorPersonnelCode})` : ''}`,
                      },
                      { label: 'سررسید بازرسی بعدی', val: scaffold.nextInspectionDueDate || '-', mono: true },
                    ].map(f => (
                      <div key={f.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                        <div className="text-[10px] font-bold text-slate-500">{f.label}</div>
                        <div className={`font-black text-slate-900 dark:text-white mt-1 ${f.mono ? 'font-mono' : ''}`}>
                          {f.val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Linked PTW & Work Request */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs">
                      <div className="font-black text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <Link2 className="w-4 h-4" />
                        پروانه کار متصل (PTW)
                      </div>
                      <div className="mt-1.5 font-mono font-black text-slate-900 dark:text-white">
                        {detail.linkedPermit?.permitNumber || scaffold.permitNumber || 'متصل نشده'}
                      </div>
                      {detail.linkedPermit && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                          {detail.linkedPermit.title} — وضعیت: {detail.linkedPermit.status}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs">
                      <div className="font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                        <Link2 className="w-4 h-4" />
                        شماره درخواست کار
                      </div>
                      <div className="mt-1.5 font-mono font-black text-slate-900 dark:text-white">
                        {scaffold.workRequestNumber || 'ثبت نشده'}
                      </div>
                    </div>
                  </div>

                  {/* Activity & Notes */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                    <div className="font-black text-slate-800 dark:text-slate-200">شرح فعالیت و علت نصب داربست</div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{scaffold.activityDescription}</p>
                    {scaffold.notes && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="font-bold text-slate-500">توضیحات تکمیلی: </span>
                        <span className="text-slate-700 dark:text-slate-300">{scaffold.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Before & After Photos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-blue-600" />
                        تصاویر قبل از نصب ({scaffold.beforePhotos?.length || 0})
                      </div>
                      {scaffold.beforePhotos?.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {scaffold.beforePhotos.map(p => (
                            <img key={p.id} src={p.url} alt={p.fileName} className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">تصویری ثبت نشده است.</p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-emerald-600" />
                        تصاویر بعد از نصب ({scaffold.afterPhotos?.length || 0})
                      </div>
                      {scaffold.afterPhotos?.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                          {scaffold.afterPhotos.map(p => (
                            <img key={p.id} src={p.url} alt={p.fileName} className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">تصویری ثبت نشده است.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Latest Checklist */}
              {activeSubTab === 'checklist' && (
                <div>
                  {!latestInspection ? (
                    <div className="text-center py-12 text-slate-500 text-xs space-y-3">
                      <ClipboardCheck className="w-10 h-10 mx-auto text-slate-300" />
                      <div className="font-bold">هنوز هیچ چک‌لیست ایمنی نصب داربست برای این پرونده ثبت نشده است.</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs">
                        <div>
                          <span className="font-mono font-black text-blue-700 dark:text-blue-400">
                            {latestInspection.inspectionNumber}
                          </span>{' '}
                          — <span>{getInspectionReasonLabelFa(latestInspection.inspectionReason)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 font-bold">
                          <span>بازرس: {latestInspection.inspectorName}</span>
                          <span className="font-mono">
                            {latestInspection.inspectionDate}
                            {latestInspection.inspectionTime ? ` (${latestInspection.inspectionTime})` : ''}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            انطباق: {latestInspection.complianceScore}٪
                          </span>
                          {perms?.canReport && (
                            <button
                              type="button"
                              onClick={() => setPrintInspection(latestInspection)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              چاپ / PDF
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-900/70 text-slate-700 dark:text-slate-300">
                            <tr>
                              <th className="p-2.5 text-center w-10">ردیف</th>
                              <th className="p-2.5 text-right">موارد بازرسی و چک کردن داربست</th>
                              <th className="p-2.5 text-center w-14">بله</th>
                              <th className="p-2.5 text-center w-14">خیر</th>
                              <th className="p-2.5 text-right">اقدام / توضیحات</th>
                              <th className="p-2.5 text-center w-16">تصویر</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {latestInspection.checklistItems.map((it, idx) => {
                              const safe = it.safeAnswer || 'YES';
                              const ans = resolveChecklistAnswer({ ...it, safeAnswer: safe });
                              return (
                                <tr
                                  key={it.code}
                                  className={it.verdict === 'FAIL' ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}
                                >
                                  <td className="p-2.5 text-center font-mono font-bold">{it.orderIndex || idx + 1}</td>
                                  <td className="p-2.5">
                                    <div className="font-bold text-slate-900 dark:text-white leading-relaxed flex flex-wrap items-center gap-1.5">
                                      <span>{it.titleFa}</span>
                                      {it.isCritical && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                                          بحرانی
                                        </span>
                                      )}
                                      {ans === 'NA' && (
                                        <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold">
                                          نامرتبط
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-center font-black text-base">
                                    {ans === 'YES' ? (
                                      <span className={safe === 'YES' ? 'text-emerald-600' : 'text-rose-600'}>✓</span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-600">—</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center font-black text-base">
                                    {ans === 'NO' ? (
                                      <span className={safe === 'NO' ? 'text-emerald-600' : 'text-rose-600'}>✓</span>
                                    ) : (
                                      <span className="text-slate-300 dark:text-slate-600">—</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-300 space-y-0.5">
                                    {it.comment && <div>{it.comment}</div>}
                                    {it.correctiveAction && (
                                      <div className="text-amber-700 dark:text-amber-300 font-bold">
                                        اقدام اصلاحی: {it.correctiveAction}
                                      </div>
                                    )}
                                    {(it.responsiblePerson || it.dueDate) && (
                                      <div className="text-[11px] text-slate-500">
                                        {it.responsiblePerson ? `مسئول: ${it.responsiblePerson}` : ''}{' '}
                                        {it.dueDate ? `| مهلت: ${it.dueDate}` : ''}
                                      </div>
                                    )}
                                    {!it.comment && !it.correctiveAction && '-'}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    {it.defectPhoto ? (
                                      <img
                                        src={it.defectPhoto}
                                        alt="نقص"
                                        className="w-12 h-12 rounded-lg object-cover mx-auto border"
                                      />
                                    ) : (
                                      '-'
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {latestInspection.summaryNotes && (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs">
                          <div className="font-black text-slate-700 dark:text-slate-200 mb-1">توضیحات کلی:</div>
                          <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                            {latestInspection.summaryNotes}
                          </p>
                        </div>
                      )}

                      {/* Two Official Signatures Summary (HSE Inspector & Safety Unit Supervisor) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] font-bold text-slate-500">امضای بازرس واحد HSE</div>
                          <div className="font-black text-slate-900 dark:text-white mt-1">
                            {latestInspection.signaturesMeta?.inspectorName ||
                              latestInspection.inspectorSignature ||
                              latestInspection.inspectorName}
                            {(latestInspection.signaturesMeta?.inspectorPersonnelCode ||
                              latestInspection.inspectorPersonnelCode) && (
                              <span className="text-[11px] font-mono font-bold text-slate-500 mr-1.5">
                                ({latestInspection.signaturesMeta?.inspectorPersonnelCode ||
                                  latestInspection.inspectorPersonnelCode})
                              </span>
                            )}
                          </div>
                          {latestInspection.signaturesMeta?.inspectorSignedAt && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {latestInspection.signaturesMeta.inspectorSignedAt}
                            </div>
                          )}
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] font-bold text-slate-500">امضای مسئول واحد ایمنی</div>
                          <div className="font-black text-slate-900 dark:text-white mt-1">
                            {latestInspection.signaturesMeta?.unitSupervisorName ||
                              latestInspection.unitSupervisorSignature ||
                              'ثبت نشده'}
                            {latestInspection.signaturesMeta?.unitSupervisorPersonnelCode && (
                              <span className="text-[11px] font-mono font-bold text-slate-500 mr-1.5">
                                ({latestInspection.signaturesMeta.unitSupervisorPersonnelCode})
                              </span>
                            )}
                          </div>
                          {latestInspection.signaturesMeta?.unitSupervisorSignedAt && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {latestInspection.signaturesMeta.unitSupervisorSignedAt}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 3: Full Inspection History */}
              {activeSubTab === 'inspections' && (
                <div className="space-y-3">
                  {detail.inspections.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs font-bold">
                      هیچ سابقه بازرسی ثبت نشده است.
                    </div>
                  ) : (
                    detail.inspections.map(insp => {
                      const isOpen = selectedHistoryInspectionId === insp.id;
                      return (
                        <div
                          key={insp.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 overflow-hidden"
                        >
                          <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono font-black text-xs text-blue-700 dark:text-blue-400">
                                  {insp.inspectionNumber}
                                </span>
                                <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-[11px] font-bold">
                                  {getInspectionReasonLabelFa(insp.inspectionReason)}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                                    insp.recommendedTag === 'GREEN'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : insp.recommendedTag === 'YELLOW'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  نتیجه: {SCAFFOLD_TAG_META[insp.recommendedTag].shortFa}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-3">
                                <span>بازرس: {insp.inspectorName}</span>
                                <span className="font-mono">تاریخ: {insp.inspectionDate} {insp.inspectionTime || ''}</span>
                                <span>انطباق: {insp.complianceScore}٪</span>
                                <span>نواقص: {insp.failedCount} ({insp.criticalDefectCount} بحرانی)</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {perms?.canReport && (
                                <button
                                  type="button"
                                  onClick={() => setPrintInspection(insp)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  چاپ این بازرسی
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedHistoryInspectionId(isOpen ? null : insp.id)}
                                className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold cursor-pointer"
                              >
                                {isOpen ? 'بستن جزئیات' : 'مشاهده چک‌لیست'}
                              </button>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="p-4 pt-0 border-t border-slate-200 dark:border-slate-700 text-xs space-y-2">
                              {insp.summaryNotes && (
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 mt-3">
                                  <span className="font-bold">جمع‌بندی بازرس: </span>
                                  {insp.summaryNotes}
                                </div>
                              )}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                {insp.checklistItems.map((it, i) => {
                                  const safe = it.safeAnswer || 'YES';
                                  const ans = resolveChecklistAnswer({ ...it, safeAnswer: safe });
                                  return (
                                    <div
                                      key={it.code}
                                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                                    >
                                      <span className="truncate font-bold">
                                        {it.orderIndex || i + 1}. {it.titleFa}
                                      </span>
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                          it.verdict === 'PASS'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : it.verdict === 'FAIL'
                                              ? 'bg-rose-100 text-rose-800'
                                              : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        {ans === 'YES' ? 'بله' : ans === 'NO' ? 'خیر' : 'نامرتبط'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Sub-Tab 4: Immutable Tag Status Audit History */}
              {activeSubTab === 'tagHistory' && (
                <div className="space-y-2.5">
                  {detail.tagHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs font-bold">
                      تاریخچه تغییر تگ ثبت نشده است.
                    </div>
                  ) : (
                    detail.tagHistory.map(h => (
                      <div
                        key={h.id}
                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-500">{h.previousTag}</span>
                            <span>←</span>
                            <span
                              className={`px-2.5 py-0.5 rounded-lg font-black text-[11px] ${
                                h.newTag === 'GREEN'
                                  ? 'bg-emerald-600 text-white'
                                  : h.newTag === 'YELLOW'
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-rose-600 text-white'
                              }`}
                            >
                              {SCAFFOLD_TAG_META[h.newTag].shortFa}
                            </span>
                            {h.validUntil && (
                              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                                (اعتبار تا {h.validUntil})
                              </span>
                            )}
                          </div>
                          <p className="text-slate-700 dark:text-slate-300 font-medium">{h.reason}</p>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 sm:text-left space-y-0.5">
                          <div className="font-black text-slate-800 dark:text-slate-200">
                            {h.changedByName} {h.changedByRole ? `(${h.changedByRole})` : ''}
                          </div>
                          <div className="font-mono flex items-center sm:justify-end gap-1">
                            <Clock className="w-3 h-3" />
                            {h.changedDateJalali} — {h.changedTime}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inspection Modal */}
      {showInspectModal && detail && (
        <ScaffoldInspectionModal
          isOpen={showInspectModal}
          onClose={() => setShowInspectModal(false)}
          scaffold={detail.scaffold}
          bootstrap={bootstrap}
          permissions={detail.permissions}
          previousChecklist={latestInspection?.checklistItems || null}
          onRecorded={() => {
            setSuccessMsg('بازرسی جدید با موفقیت در پایگاه داده ثبت و تاریخچه به‌روزرسانی شد.');
            loadDetail();
            onChanged();
          }}
          onSettingsUpdated={onSettingsUpdated}
        />
      )}

      {/* A4 Certificate Print Modal */}
      {printInspection !== undefined && detail && (
        <ScaffoldPrintModal
          mode="certificate"
          detail={detail}
          inspection={printInspection}
          onClose={() => setPrintInspection(undefined)}
        />
      )}
    </>
  );
}
