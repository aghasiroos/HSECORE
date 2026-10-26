import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  Eye, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Snowflake, 
  Box, 
  FileText, 
  BarChart3, 
  ShieldCheck, 
  ShieldAlert, 
  HardHat, 
  Check, 
  RotateCcw,
  Calendar,
  Building2,
  ChevronLeft,
  Download,
  Paperclip,
  Send,
  GitCommit,
  PenTool,
  Lock
} from 'lucide-react';
import { PtwAuditRecord, PermitType, AuditLifecycleStatus } from '../types';
import { computePtwAuditStats } from '../services/ptwAuditService';
import { useUnifiedOrgUnits } from '../../../utils/orgUnitsHelper';
import { getReferralsForDocument } from '../../../utils/referralHelper';
import ConfirmDeleteModal from '../../../components/common/ConfirmDeleteModal';

interface PtwAuditListProps {
  audits: PtwAuditRecord[];
  onAddNew: () => void;
  onViewDetail: (audit: PtwAuditRecord) => void;
  onEdit: (audit: PtwAuditRecord) => void;
  onPrint: (audit: PtwAuditRecord) => void;
  onDelete: (id: string) => void;
  onOpenReferral?: (audit: PtwAuditRecord) => void;
  onOpenWorkflowTracker?: (audit: PtwAuditRecord) => void;
  onSwitchToDashboard?: () => void;
  isFa?: boolean;
}

export default function PtwAuditList({
  audits,
  onAddNew,
  onViewDetail,
  onEdit,
  onPrint,
  onDelete,
  onOpenReferral,
  onOpenWorkflowTracker,
  onSwitchToDashboard,
  isFa = true
}: PtwAuditListProps) {
  const { units: unifiedUnits } = useUnifiedOrgUnits();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPermitType, setSelectedPermitType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [auditToDelete, setAuditToDelete] = useState<PtwAuditRecord | null>(null);

  const stats = useMemo(() => {
    return computePtwAuditStats(audits);
  }, [audits]);

  // Filtered audits
  const filteredAudits = useMemo(() => {
    return audits.filter(audit => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesQuery = 
          audit.permitNumber?.toLowerCase().includes(q) ||
          audit.unitName?.toLowerCase().includes(q) ||
          audit.subUnitName?.toLowerCase().includes(q) ||
          audit.workDescription?.toLowerCase().includes(q) ||
          audit.signers?.areaResponsibleName?.toLowerCase().includes(q) ||
          audit.signers?.workPerformerName?.toLowerCase().includes(q) ||
          audit.hseAuditor?.auditorName?.toLowerCase().includes(q);

        if (!matchesQuery) return false;
      }

      // Permit Type
      if (selectedPermitType !== 'ALL' && audit.permitType !== selectedPermitType) {
        return false;
      }

      // Status
      if (selectedStatus !== 'ALL' && audit.status !== selectedStatus) {
        return false;
      }

      // Unit
      if (selectedUnit !== 'ALL' && audit.unitName !== selectedUnit) {
        return false;
      }

      return true;
    });
  }, [audits, searchQuery, selectedPermitType, selectedStatus, selectedUnit]);

  const getPermitTypeMeta = (type: PermitType) => {
    switch (type) {
      case 'HOT':
        return { label: 'گرم (Hot Work)', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800', icon: Flame };
      case 'COLD':
        return { label: 'سرد (Cold Work)', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800', icon: Snowflake };
      case 'CONFINED_SPACE':
        return { label: 'فضای بسته (Confined)', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800', icon: Box };
      default:
        return { label: type, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: FileText };
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* ========================================================================= */}
      {/* 1. Header & Quick Actions */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>ممیزی پروانه کار (Audit permit)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800 font-mono">
                  REG-HSE-FO-024
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                سامانه هوشمند ارزیابی انطباق، نظارت میدانی و ممیزی سیستم صدور پروانه‌های کار گرم، سرد و فضای بسته
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {onSwitchToDashboard && (
            <button
              onClick={onSwitchToDashboard}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm rounded-2xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span>مشاهده داشبورد تحلیلی</span>
            </button>
          )}

          <button
            onClick={onAddNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ثبت ممیزی جدید (Audit permit)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Executive KPI Cards */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Audits */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">کل ممیزی‌های ثبت‌شده</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white mt-2">
            {stats.totalAudits}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="font-bold text-emerald-600">{stats.finalizedCount} نهایی</span>
            <span>•</span>
            <span className="font-bold text-slate-400">{stats.draftCount} پیش‌نویس</span>
          </div>
        </div>

        {/* Average Compliance Score */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">میانگین انطباق استاندارد</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-700 dark:text-emerald-400 mt-2">
            {stats.avgComplianceScore}%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-1 font-bold">
            سطح رعایت الزامات ایمنی و HSE
          </div>
        </div>

        {/* Observations / Defects Identified */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">نواقص مشاهده‌شده (O)</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-rose-700 dark:text-rose-400 mt-2">
            {stats.totalDefectsIdentified}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-bold">
            اقدامات اصلاحی و مشاهدات میدانی
          </div>
        </div>

        {/* Permit Distribution */}
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">توزیع انواع پروانه</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 font-mono text-xs font-bold">
            <span className="px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              گرم: {stats.hotPermitCount}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              سرد: {stats.coldPermitCount}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              فضا: {stats.confinedSpacePermitCount}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            تفکیک بر حسب ریسک عملیاتی
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. Search & Filter Bar */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            <input
              type="text"
              placeholder="جستجو در شماره پرمیت، واحد، مجری..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pr-10 pl-4 py-2.5 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Permit Type Filter */}
          <div>
            <select
              value={selectedPermitType}
              onChange={(e) => setSelectedPermitType(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">همه انواع پرمیت (گرم، سرد، فضای بسته)</option>
              <option value="HOT">فقط پروانه کار گرم (HOT)</option>
              <option value="COLD">فقط پروانه کار سرد (COLD)</option>
              <option value="CONFINED_SPACE">فقط ورود به فضای بسته (CONFINED)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">همه وضعیت‌های ممیزی</option>
              <option value="FINALIZED">نهایی و تایید شده</option>
              <option value="DRAFT">پیش‌نویس</option>
              <option value="CRITICAL_NC">دارای عدم انطباق بحرانی</option>
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">همه واحدهای سازمانی</option>
              {unifiedUnits.map(u => (
                <option key={u.id} value={u.name}>
                  {u.fullPath && u.fullPath !== u.name ? `${u.name} (${u.fullPath})` : u.name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Active Filters Bar */}
        {(searchQuery || selectedPermitType !== 'ALL' || selectedStatus !== 'ALL' || selectedUnit !== 'ALL') && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500">
              یافت شد: <strong className="text-slate-800 dark:text-slate-200">{filteredAudits.length} ممیزی</strong>
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedPermitType('ALL');
                setSelectedStatus('ALL');
                setSelectedUnit('ALL');
              }}
              className="text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>پاکسازی فیلترها</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. Audits Data Table */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {filteredAudits.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
              هیچ رکورد ممیزی پروانه کار یافت نشد
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              ممیزی جدیدی ثبت نشده یا فیلترهای جستجو موردی پیدا نکرده‌اند. برای شروع روی دکمه «ثبت ممیزی جدید» کلیک کنید.
            </p>
            <button
              onClick={onAddNew}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
            >
              ثبت اولین ممیزی PTW
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black">
                  <th className="py-3 px-4">شماره پروانه کار</th>
                  <th className="py-3 px-3">نوع پرمیت</th>
                  <th className="py-3 px-3">واحد و موقعیت</th>
                  <th className="py-3 px-3">تاریخ و شیفت</th>
                  <th className="py-3 px-3">انطباق استاندارد</th>
                  <th className="py-3 px-3">ممیز HSE</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredAudits.map((audit) => {
                  const typeMeta = getPermitTypeMeta(audit.permitType);
                  const TypeIcon = typeMeta.icon;
                  const score = audit.complianceScore ?? 100;
                  const defects = audit.defectsCount ?? 0;
                  const docReferrals = getReferralsForDocument('PTW_AUDIT', audit.id);
                  const activeReferral = docReferrals[0];
                  const hasReferral = Boolean(activeReferral);
                  const isReferralCompleted = activeReferral?.overallStatus === 'COMPLETED';
                  const isReferralRejected = activeReferral?.overallStatus === 'REJECTED';

                  return (
                    <tr 
                      key={audit.id} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Permit Number & Attached Permit */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-slate-900 dark:text-white text-xs flex items-center gap-1.5 flex-wrap">
                          <span>{audit.permitNumber}</span>
                          {audit.hasAttachedPermit && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-sans text-[10px] font-black border border-purple-200 dark:border-purple-800">
                              + الحاقی {audit.attachedPermitNumber ? `(${audit.attachedPermitNumber})` : ''}
                            </span>
                          )}
                          {hasReferral && (
                            <button
                              type="button"
                              onClick={() => onOpenWorkflowTracker?.(audit)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold border cursor-pointer ${
                                isReferralCompleted 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : isReferralRejected
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300'
                              }`}
                              title="مشاهده گردش کار و امضاهای ممیزی"
                            >
                              <GitCommit className="w-2.5 h-2.5" />
                              <span>{isReferralCompleted ? 'امضا شده' : 'در گردش کار'}</span>
                            </button>
                          )}
                          {audit.attachments && audit.attachments.length > 0 && (
                            <span 
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800"
                              title={`${audit.attachments.length} فایل ضمیمه (تصویر / PDF)`}
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              <span>{audit.attachments.length}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {audit.documentCode}
                        </div>
                      </td>

                      {/* Permit Type */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${typeMeta.color}`}>
                          <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{typeMeta.label}</span>
                        </span>
                      </td>

                      {/* Unit & Sub-unit */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {audit.unitName}
                        </div>
                        {audit.subUnitName && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                            {audit.subUnitName}
                          </div>
                        )}
                      </td>

                      {/* Date & Shift */}
                      <td className="py-3.5 px-3">
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {audit.auditDate}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {audit.shift} {audit.auditTime ? `(${audit.auditTime})` : ''}
                        </div>
                      </td>

                      {/* Compliance Score Gauge */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                score >= 90 ? 'bg-emerald-500' :
                                score >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                            {score}%
                          </span>
                        </div>
                        {defects > 0 && (
                          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                            {defects} نقص مشاهده شد
                          </div>
                        )}
                      </td>

                      {/* HSE Auditor */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {audit.hseAuditor?.auditorName || 'نماینده HSE'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          امضاء شده
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {audit.status === 'FINALIZED' ? (
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                            نهایی و تایید
                          </span>
                        ) : audit.status === 'CRITICAL_NC' ? (
                          <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold">
                            عدم انطباق بحرانی
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                            پیش‌نویس
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onViewDetail(audit)}
                            title="مشاهده جزئیات کامل"
                            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Referral action: Send for approval / sign */}
                          <button
                            onClick={() => onOpenReferral?.(audit)}
                            title="ارجاع ممیزی جهت تایید و امضا"
                            className="p-1.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>

                          {/* Workflow Tracker modal */}
                          {hasReferral && (
                            <button
                              onClick={() => onOpenWorkflowTracker?.(audit)}
                              title="گردش کار و وضعیت امضاها"
                              className="p-1.5 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-950/40 text-purple-600 dark:text-purple-400 transition cursor-pointer"
                            >
                              <GitCommit className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => onPrint(audit)}
                            title="چاپ فرم رسمی A4 مطابق پیوست"
                            className="p-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 transition cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onEdit(audit)}
                            title="ویرایش ممیزی"
                            className="p-1.5 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 transition cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setAuditToDelete(audit)}
                            title="حذف ممیزی"
                            className="p-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Confirmation Modal for Audit Deletion */}
      <ConfirmDeleteModal
        isOpen={Boolean(auditToDelete)}
        audit={auditToDelete}
        onConfirm={() => {
          if (auditToDelete) {
            onDelete(auditToDelete.id);
            setAuditToDelete(null);
          }
        }}
        onClose={() => setAuditToDelete(null)}
        isFa={isFa}
      />

    </div>
  );
}
