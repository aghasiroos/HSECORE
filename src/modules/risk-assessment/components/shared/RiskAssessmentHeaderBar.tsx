import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Printer,
  Save,
  Send,
  Archive,
  AlertCircle,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import {
  BaseRiskAssessment,
  RiskWorkflowStage,
} from '../../types';
import {
  getRiskLevelColor,
  getStatusBadgeMeta,
} from '../../services/riskAssessmentService';
import {
  RISK_WORKFLOW_STAGES,
  ValidationIssue,
} from '../../services/riskWorkflowEngine';

interface RiskAssessmentHeaderBarProps {
  formData: BaseRiskAssessment;
  methodTitleFa: string;
  methodTitleEn: string;
  isEdit: boolean;
  isFa: boolean;
  canApprove?: boolean;
  saving?: boolean;
  validationIssues?: ValidationIssue[];
  onCancel: () => void;
  onPrint: () => void;
  onSaveDraft: () => void;
  onSubmitReview: () => void;
  onApprove?: () => void;
  onArchive?: () => void;
  onStageClick?: (stage: RiskWorkflowStage) => void;
}

export default function RiskAssessmentHeaderBar({
  formData,
  methodTitleFa,
  methodTitleEn,
  isEdit,
  isFa,
  canApprove = true,
  saving = false,
  validationIssues = [],
  onCancel,
  onPrint,
  onSaveDraft,
  onSubmitReview,
  onApprove,
  onArchive,
  onStageClick,
}: RiskAssessmentHeaderBarProps) {
  const initialColors = getRiskLevelColor(formData.overallRiskLevel);
  const residualColors = formData.residualRiskLevel
    ? getRiskLevelColor(formData.residualRiskLevel)
    : null;
  const statusMeta = getStatusBadgeMeta(formData.status, isFa);
  const activeStageKey = formData.workflowStage || 'INITIAL_INFO';
  const activeStageIndex = Math.max(
    0,
    RISK_WORKFLOW_STAGES.findIndex(s => s.key === activeStageKey)
  );

  return (
    <div className="space-y-3">
      {/* Main Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title={isFa ? 'بازگشت به لیست' : 'Back'}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
              {isEdit
                ? (isFa ? `ویرایش: ${methodTitleFa}` : `Edit: ${methodTitleEn}`)
                : (isFa ? methodTitleFa : methodTitleEn)}
            </h2>
            <span
              className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 tabular-nums"
              dir="ltr"
            >
              {formData.code}
            </span>
            <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mr-8">
            <span className="flex items-center gap-1.5">
              <span>{isFa ? 'ریسک اولیه:' : 'Initial Risk:'}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${initialColors.badge}`}>
                {isFa ? initialColors.shortLabelFa : initialColors.shortLabelEn}
                {formData.initialRiskScore ? ` (${formData.initialRiskScore})` : ''}
              </span>
            </span>

            {residualColors && (
              <span className="flex items-center gap-1.5">
                <span>{isFa ? 'ریسک باقیمانده:' : 'Residual Risk:'}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${residualColors.badge}`}>
                  {isFa ? residualColors.shortLabelFa : residualColors.shortLabelEn}
                  {formData.residualRiskScore ? ` (${formData.residualRiskScore})` : ''}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPrint}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isFa ? 'چاپ / خروجی' : 'Print'}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'ذخیره پیش‌نویس' : 'Save Draft')}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onSubmitReview}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isFa ? 'ارسال برای بازبینی' : 'Submit for Review'}</span>
          </button>

          {canApprove && onApprove && formData.status !== 'APPROVED' && (
            <button
              type="button"
              disabled={saving}
              onClick={onApprove}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isFa ? 'تایید نهایی HSE' : 'Approve'}</span>
            </button>
          )}

          {canApprove && onArchive && formData.status === 'APPROVED' && (
            <button
              type="button"
              disabled={saving}
              onClick={onArchive}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isFa ? 'بایگانی' : 'Archive'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 10-Stage Unified Workflow Stepper */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isFa ? 'گردش کار یکپارچه ۱۰ مرحله‌ای ارزیابی ریسک و اقدامات اصلاحی' : '10-Stage Risk Assessment Workflow'}</span>
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
            {activeStageIndex + 1} / {RISK_WORKFLOW_STAGES.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {RISK_WORKFLOW_STAGES.map((stage, idx) => {
            const isDone = idx < activeStageIndex;
            const isCurrent = idx === activeStageIndex;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => onStageClick?.(stage.key)}
                title={isFa ? stage.titleFa : stage.titleEn}
                className={`shrink-0 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isCurrent
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : isDone
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="font-mono tabular-nums font-black">{stage.step}</span>
                {isDone && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                <span className="whitespace-nowrap">{isFa ? stage.shortFa : stage.titleEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Validation Issues Banner */}
      {validationIssues.length > 0 && (
        <div
          role="alert"
          className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 space-y-1.5"
        >
          <div className="flex items-center gap-2 text-xs font-black text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {isFa
                ? 'برای تکمیل این مرحله لطفاً موارد زیر را برطرف نمایید:'
                : 'Please fix the following required items:'}
            </span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-200 pr-2">
            {validationIssues.map((issue, idx) => (
              <li key={idx}>{isFa ? issue.messageFa : issue.messageEn}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
