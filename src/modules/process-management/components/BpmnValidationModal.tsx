import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Info, ArrowRight, X } from 'lucide-react';

export interface BpmnValidationIssue {
  id: string;
  elementId?: string;
  type: 'error' | 'warning' | 'info';
  messageFa: string;
  messageEn: string;
  elementName?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  issues: BpmnValidationIssue[];
  language: 'fa' | 'en';
  onSelectElement?: (elementId: string) => void;
}

export default function BpmnValidationModal({
  isOpen,
  onClose,
  issues,
  language,
  onSelectElement
}: Props) {
  const isFa = language === 'fa';

  if (!isOpen) return null;

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              errors.length > 0 
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                : warnings.length > 0
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              {errors.length > 0 ? (
                <XCircle className="w-5 h-5" />
              ) : warnings.length > 0 ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'اعتبارسنجی فرآیند BPMN 2.0' : 'BPMN 2.0 Process Validation'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {errors.length === 0 && warnings.length === 0
                  ? (isFa ? 'فرآیند از نظر ساختاری کامل و بدون نقص است.' : 'Process structure is valid and ready for execution.')
                  : (isFa ? `${errors.length} خطا و ${warnings.length} هشدار شناسایی شد.` : `${errors.length} errors and ${warnings.length} warnings detected.`)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of issues */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {issues.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {isFa ? 'طراحی فرآیند استاندارد است' : 'Diagram is fully compliant'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {isFa ? 'تمامی اتصالات، رویدادها و وظایف دارای انسجام منطقی هستند.' : 'All connections, events, and tasks are syntactically consistent.'}
              </p>
            </div>
          ) : (
            issues.map((issue) => (
              <div
                key={issue.id}
                onClick={() => {
                  if (issue.elementId && onSelectElement) {
                    onSelectElement(issue.elementId);
                    onClose();
                  }
                }}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  issue.elementId ? 'cursor-pointer hover:scale-[1.01]' : ''
                } ${
                  issue.type === 'error'
                    ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200'
                    : issue.type === 'warning'
                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
                    : 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200'
                }`}
              >
                <div className="mt-0.5">
                  {issue.type === 'error' ? (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  ) : issue.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold leading-relaxed">
                      {isFa ? issue.messageFa : issue.messageEn}
                    </p>
                    {issue.elementId && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                        {issue.elementId}
                      </span>
                    )}
                  </div>
                  {issue.elementName && (
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {isFa ? 'عنصر:' : 'Element:'} <strong>{issue.elementName}</strong>
                    </p>
                  )}
                </div>
                {issue.elementId && (
                  <ArrowRight className="w-3.5 h-3.5 opacity-50 mt-1 rtl:rotate-180" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold rounded-xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-all"
          >
            {isFa ? 'متوجه شدم' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
