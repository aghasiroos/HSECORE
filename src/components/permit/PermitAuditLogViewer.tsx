import React from 'react';
import { History, Clock, ArrowRight } from 'lucide-react';
import { WorkPermit } from '../../types';

interface PermitAuditLogViewerProps {
  permit: WorkPermit;
  isFa: boolean;
}

export const PermitAuditLogViewer: React.FC<PermitAuditLogViewerProps> = ({
  permit,
  isFa
}) => {
  const logs = permit.auditLogs || [];

  const getActionBadgeColor = (action: string) => {
    if (action.includes('ایجاد') || action.includes('ثبت')) return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
    if (action.includes('تأیید') || action.includes('صدور')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
    if (action.includes('تعلیق') || action.includes('توقف')) return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
    if (action.includes('تمدید')) return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
    if (action.includes('بازرسی')) return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
    if (action.includes('خاتمه') || action.includes('بستن')) return 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 rounded-2xl">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
              {isFa ? 'سوابق و لاگ جامع ممیزی پروانه (Enterprise Audit Trail)' : 'Permit Audit Trail & Change Log'}
            </h4>
            <p className="text-xs text-slate-500">
              {isFa ? `ثبت دقیق کلیه رویدادها، تغییر وضعیت‌ها و ویرایش‌ها (تعداد رویداد: ${logs.length})` : 'Detailed tamper-evident log of all permit operations'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-400">نسخه جاری: v{permit.version || 1}</span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          هنوز لاگی برای این پروانه ثبت نشده است.
        </div>
      ) : (
        <div className="relative border-r-2 border-slate-200 dark:border-slate-800 mr-4 pr-6 space-y-6">
          {logs.slice().reverse().map((log, index) => (
            <div key={log.id || index} className="relative group">
              {/* Timeline marker */}
              <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-4 border-blue-500 group-hover:scale-125 transition-transform" />

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${getActionBadgeColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {log.user}
                    </span>
                    {log.userRole && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {log.userRole}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{log.persianDateTime || log.timestamp}</span>
                  </div>
                </div>

                {/* Details text */}
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {log.details}
                </p>

                {/* Value changes delta */}
                {log.fieldName && (log.oldValue || log.newValue) && (
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-xs font-mono">
                    <span className="font-bold text-slate-500">{log.fieldName}:</span>
                    <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 line-through">
                      {log.oldValue || '—'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                      {log.newValue || '—'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
