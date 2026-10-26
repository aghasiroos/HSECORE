import React from 'react';
import {
  X,
  Users,
  Shield,
  Building,
  User,
  Clock,
  Edit3,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ListFilter
} from 'lucide-react';
import { WorkflowStep, AssigneeType } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  steps: WorkflowStep[];
  onEditStep: (step: WorkflowStep) => void;
  language: 'fa' | 'en';
}

export default function WorkflowApproversMatrixDrawer({
  isOpen,
  onClose,
  steps,
  onEditStep,
  language
}: Props) {
  const isFa = language === 'fa';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-left duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {isFa ? 'ماتریس تأییدکنندگان و مسئولان فرآیند' : 'Workflow Approvers & Responsibilities Matrix'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa
                  ? `${steps.length} گام تأیید و اقدام در این گردش‌کار تعریف شده است`
                  : `${steps.length} approval steps configured in this workflow`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {steps.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ListFilter className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">
                {isFa ? 'هیچ فعالیت یا گامی در دیاگرام BPMN یافت نشد.' : 'No tasks found in diagram.'}
              </p>
            </div>
          ) : (
            steps.map((step, index) => {
              const assigneeType: AssigneeType = step.assigneeType || (step.assignedUsers && step.assignedUsers.length > 0 ? 'user' : 'role');
              const hasInactiveWarning = step.requiresSubstitute;

              return (
                <div
                  key={step.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-blue-400 dark:hover:border-blue-700 transition-all shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            {step.titleFa}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({step.id})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {/* SLA */}
                          <span className="text-[10px] flex items-center gap-1 text-slate-500 dark:text-slate-400">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{step.slaHours} {isFa ? 'ساعت SLA' : 'hrs'}</span>
                          </span>

                          <span className="text-slate-300 dark:text-slate-700">•</span>

                          {/* Action Type */}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {step.actionType === 'approval' && (isFa ? 'تأییدیه' : 'Approval')}
                            {step.actionType === 'inspection' && (isFa ? 'بازرسی' : 'Inspection')}
                            {step.actionType === 'signature' && (isFa ? 'امضا' : 'Signature')}
                            {step.actionType === 'form' && (isFa ? 'تکمیل فرم' : 'Form')}
                            {step.actionType === 'test' && (isFa ? 'تست و گازسنجی' : 'Test')}
                            {step.actionType === 'notification' && (isFa ? 'اطلاع‌رسانی' : 'Notification')}
                          </span>

                          {/* Logic badge if multiple users */}
                          {assigneeType === 'user' && (step.assignedUsers?.length || 0) > 1 && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                              {step.approvalLogic === 'all' && (isFa ? 'همه افراد (AND)' : 'All (AND)')}
                              {step.approvalLogic === 'any' && (isFa ? 'یکی از افراد (OR)' : 'Any (OR)')}
                              {step.approvalLogic === 'sequential' && (isFa ? 'به ترتیب (Sequential)' : 'Sequential')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEditStep(step)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isFa ? 'ویرایش تأییدکنندگان' : 'Edit'}</span>
                    </button>
                  </div>

                  {/* Assignees Body */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    {assigneeType === 'user' ? (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-500" />
                          <span>{isFa ? 'کاربران تأییدکننده:' : 'Assigned Approvers:'}</span>
                        </div>

                        {step.assignedUsers && step.assignedUsers.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {step.assignedUsers.map((u, uIdx) => (
                              <div
                                key={u.id || uIdx}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs"
                              >
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">
                                    {step.approvalLogic === 'sequential' && (
                                      <span className="text-blue-600 dark:text-blue-400 ml-1">
                                        {uIdx + 1}.
                                      </span>
                                    )}
                                    {u.fullName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {u.jobTitle} • {u.department}
                                  </div>
                                </div>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                  u.accountStatus === 'Active' 
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 font-bold'
                                }`}>
                                  {u.accountStatus === 'Active' ? (isFa ? 'فعال' : 'Active') : (isFa ? 'غیرفعال' : 'Inactive')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            {isFa ? 'هنوز هیچ کاربری انتخاب نشده است.' : 'No users assigned yet.'}
                          </p>
                        )}
                      </div>
                    ) : assigneeType === 'role' ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-slate-500 dark:text-slate-400">{isFa ? 'مسئول بر اساس نقش:' : 'Assigned Role:'}</span>
                        <span className="font-bold text-purple-700 dark:text-purple-300">
                          {step.assignedRole}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <Building className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-slate-500 dark:text-slate-400">{isFa ? 'مسئول بر اساس واحد سازمانی:' : 'Assigned Dept:'}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-300">
                          {step.assignedDepartment || 'واحد HSE'}
                        </span>
                      </div>
                    )}

                    {hasInactiveWarning && (
                      <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{isFa ? 'تأییدکننده این مرحله غیرفعال شده و نیازمند جانشین است.' : 'Assigned user is inactive.'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 rounded-xl transition-all"
          >
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}
