import React, { useState } from 'react';
import {
  History,
  X,
  Shield,
  Search
} from 'lucide-react';
import { WorkPermit } from '../../types';
import { PermitAuditLogViewer } from './PermitAuditLogViewer';
import { PERMIT_CATEGORIES_CONFIG } from './PermitTypes';

interface PermitAuditModalProps {
  permit: WorkPermit;
  isFa: boolean;
  onClose: () => void;
}

export const PermitAuditModal: React.FC<PermitAuditModalProps> = ({
  permit,
  isFa,
  onClose
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const logs = permit.auditLogs || [];

  const filteredLogs = logs.filter(log => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(term) ||
      (log.user || '').toLowerCase().includes(term) ||
      (log.userRole || '').toLowerCase().includes(term) ||
      (log.details || '').toLowerCase().includes(term) ||
      (log.persianDateTime || '').toLowerCase().includes(term)
    );
  });

  const categoryConfig = PERMIT_CATEGORIES_CONFIG[permit.permitCategory] || {
    titleFa: permit.permitCategory || permit.permitType,
    titleEn: permit.permitCategory || permit.permitType,
    badgeColor: 'bg-slate-100 text-slate-800'
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200"
        dir={isFa ? 'rtl' : 'ltr'}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/15 backdrop-blur-md">
              <History className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-lg">
                  {isFa ? 'لاگ‌های ممیزی و تاریخچه اختصاصی پروانه کار' : 'Permit Audit Trail & Event Logs'}
                </h3>
                <span className="font-mono font-bold text-xs bg-white/15 px-2.5 py-0.5 rounded-lg border border-white/20">
                  {permit.serialNumber}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/30 border border-blue-400/40 text-blue-100">
                  نسخه: v{permit.version || 1}
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-1 line-clamp-1">
                {permit.description} | {isFa ? categoryConfig.titleFa : categoryConfig.titleEn}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition cursor-pointer"
            title={isFa ? 'بستن' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Overview Sub-header */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={isFa ? 'جستجو در رویدادها، کاربر، اقدام...' : 'Search logs, users, actions...'}
              className="w-full pr-9 pl-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-bold self-end sm:self-auto">
            <span>
              {isFa ? `تعداد کل رویدادها: ${logs.length}` : `Total Events: ${logs.length}`}
            </span>
            {searchTerm && (
              <span className="text-blue-600 dark:text-blue-400 font-normal">
                ({isFa ? `یافت شده: ${filteredLogs.length}` : `Matched: ${filteredLogs.length}`})
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Audit Log Timeline */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <PermitAuditLogViewer
            permit={{
              ...permit,
              auditLogs: filteredLogs
            }}
            isFa={isFa}
          />
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isFa ? 'سوابق ثبت شده غیرقابل دستکاری و بر اساس زمان‌بندی دقیق سامانه می‌باشند' : 'Audit logs are immutable and timestamped'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-xl transition cursor-pointer"
          >
            {isFa ? 'بستن پنجره' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
