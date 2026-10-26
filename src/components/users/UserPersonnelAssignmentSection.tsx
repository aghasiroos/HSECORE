import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Search,
  Building2,
  ShieldCheck,
  X,
  Check,
  Trash2,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  ComplexPersonnel,
  getUnfilteredComplexPersonnelList,
  fetchCentralPersonnelList,
} from '../../utils/personnelHelper';
import { UserProfile } from '../../types';
import { apiDb } from '../../services/apiDatabaseClient';
import { toast } from 'react-hot-toast';

export interface UserPersonnelAssignmentSectionProps {
  language?: 'fa' | 'en';
  scope: 'ALL' | 'ASSIGNED';
  onChangeScope: (scope: 'ALL' | 'ASSIGNED') => void;
  selectedPersonnelIds: string[];
  onChangeSelectedPersonnelIds: (ids: string[]) => void;
  canGrantAllScope?: boolean;
  userPersonnelNumber?: string;
  userFullName?: string;
  userRole?: string;
}

export const UserPersonnelAssignmentSection: React.FC<UserPersonnelAssignmentSectionProps> = ({
  language = 'fa',
  scope,
  onChangeScope,
  selectedPersonnelIds,
  onChangeSelectedPersonnelIds,
  canGrantAllScope = true,
  userPersonnelNumber,
  userRole,
}) => {
  const isFa = language === 'fa';
  const [allPersonnel, setAllPersonnel] = useState<ComplexPersonnel[]>(() =>
    getUnfilteredComplexPersonnelList()
  );
  const [isLoadingPersonnel, setIsLoadingPersonnel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState('ALL');

  const isRoleGlobalAdmin = useMemo(() => {
    const r = String(userRole || '').toLowerCase().replace(/[\s_]/g, '');
    return r === 'administrator' || r === 'admin' || r.includes('مدیرارشد') || r.includes('مدیرسیستم');
  }, [userRole]);

  useEffect(() => {
    const refresh = () => {
      setAllPersonnel(getUnfilteredComplexPersonnelList());
    };
    if (allPersonnel.length === 0) {
      setIsLoadingPersonnel(true);
      fetchCentralPersonnelList(true)
        .then((list) => {
          setAllPersonnel(list.filter((p) => p.status !== 'inactive'));
        })
        .finally(() => setIsLoadingPersonnel(false));
    }
    window.addEventListener('hse_personnel_updated', refresh);
    return () => window.removeEventListener('hse_personnel_updated', refresh);
  }, []);

  // Only valid database-backed active personnel (numeric ID from PostgreSQL schema.personnel)
  const validComplexPersonnel = useMemo(() => {
    return allPersonnel.filter((p) => p.status !== 'inactive' && p.id && /^\d+$/.test(String(p.id)));
  }, [allPersonnel]);

  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    validComplexPersonnel.forEach((p) => {
      const u = (p.unit || p.department || '').trim();
      if (u && u !== 'نامشخص') set.add(u);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [validComplexPersonnel]);

  // Normalize selected IDs (also resolve if any code was passed instead of DB id)
  const selectedIdsSet = useMemo(() => {
    const s = new Set<string>();
    for (const raw of selectedPersonnelIds) {
      const clean = String(raw).trim();
      if (!clean) continue;
      const byId = validComplexPersonnel.find((p) => String(p.id) === clean);
      if (byId) {
        s.add(String(byId.id));
        continue;
      }
      const byCode = validComplexPersonnel.find(
        (p) => String(p.personnelCode) === clean || String(p.nationalCode) === clean
      );
      if (byCode) {
        s.add(String(byCode.id));
      }
    }
    return s;
  }, [selectedPersonnelIds, validComplexPersonnel]);

  const selectedPersonnelObjects = useMemo(() => {
    return validComplexPersonnel.filter((p) => selectedIdsSet.has(String(p.id)));
  }, [validComplexPersonnel, selectedIdsSet]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return validComplexPersonnel
      .filter((p) => {
        if (unitFilter !== 'ALL' && (p.unit || p.department || '') !== unitFilter) {
          return false;
        }
        if (!q) return true;
        return (
          (p.fullName || '').toLowerCase().includes(q) ||
          (p.personnelCode || '').toLowerCase().includes(q) ||
          (p.nationalCode || '').toLowerCase().includes(q) ||
          (p.unit || '').toLowerCase().includes(q) ||
          (p.jobTitle || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [validComplexPersonnel, searchQuery, unitFilter]);

  const selfPersonnelMatch = useMemo(() => {
    if (!userPersonnelNumber) return null;
    const clean = String(userPersonnelNumber).trim();
    return (
      validComplexPersonnel.find(
        (p) => String(p.personnelCode).trim() === clean || String(p.nationalCode).trim() === clean
      ) || null
    );
  }, [userPersonnelNumber, validComplexPersonnel]);

  const togglePersonnel = (personId: string) => {
    const idStr = String(personId);
    const next = new Set(selectedIdsSet);
    if (next.has(idStr)) {
      next.delete(idStr);
    } else {
      next.add(idStr);
    }
    onChangeSelectedPersonnelIds(Array.from(next));
  };

  const handleAddUnitPersonnel = () => {
    if (unitFilter === 'ALL') return;
    const unitMembers = validComplexPersonnel.filter(
      (p) => (p.unit || p.department || '') === unitFilter
    );
    const next = new Set(selectedIdsSet);
    unitMembers.forEach((p) => next.add(String(p.id)));
    onChangeSelectedPersonnelIds(Array.from(next));
  };

  const handleClearAll = () => {
    onChangeSelectedPersonnelIds([]);
  };

  const handleReloadPersonnel = async () => {
    setIsLoadingPersonnel(true);
    try {
      const list = await fetchCentralPersonnelList(true);
      setAllPersonnel(list.filter((p) => p.status !== 'inactive'));
    } finally {
      setIsLoadingPersonnel(false);
    }
  };

  return (
    <div className="md:col-span-3 mt-3 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900/80 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-indigo-100 dark:border-indigo-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isFa ? 'اشخاص مرتبط (کنترل مرکزی دسترسی به اطلاعات پرسنل مجتمع)' : 'Assigned Personnel (Centralized Data Access)'}
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                PostgreSQL
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa
                ? 'کاربر در تمامی ماژول‌ها، فرم‌ها، سوابق و گزارش‌ها صرفاً به اطلاعات اشخاص مرتبط انتخاب‌شده در این بخش دسترسی خواهد داشت.'
                : 'User access to records, forms, histories, and reports across all modules is strictly bound to these assigned personnel.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReloadPersonnel}
          disabled={isLoadingPersonnel}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
          title={isFa ? 'بروزرسانی لیست اطلاعات پرسنل مجتمع' : 'Refresh Complex Personnel'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPersonnel ? 'animate-spin' : ''}`} />
          <span>
            {isFa
              ? `${validComplexPersonnel.length} پرسنل معتبر در دیتابیس`
              : `${validComplexPersonnel.length} Active DB Personnel`}
          </span>
        </button>
      </div>

      {/* Scope Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <button
          type="button"
          onClick={() => onChangeScope('ASSIGNED')}
          disabled={isRoleGlobalAdmin}
          className={`flex items-start gap-3 p-3.5 rounded-xl border text-right transition-all ${
            scope === 'ASSIGNED' && !isRoleGlobalAdmin
              ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 dark:border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'
          } ${isRoleGlobalAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              scope === 'ASSIGNED' && !isRoleGlobalAdmin
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
          >
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {isFa ? 'انتخاب اشخاص مشخص (یک یا چند شخص)' : 'Selected Personnel Only'}
              </span>
              {scope === 'ASSIGNED' && !isRoleGlobalAdmin && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white">
                  {isFa ? `${selectedPersonnelObjects.length} نفر انتخاب شده` : `${selectedPersonnelObjects.length} Selected`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isFa
                ? 'کاربر فقط به اطلاعات، سوابق و عملیات اشخاصی که از لیست پرسنل مجتمع انتخاب می‌کنید دسترسی دارد.'
                : 'User can only view and operate on the specific personnel selected below.'}
            </p>
          </div>
        </button>

        {canGrantAllScope && (
          <button
            type="button"
            onClick={() => onChangeScope('ALL')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-right transition-all ${
              scope === 'ALL' || isRoleGlobalAdmin
                ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 dark:border-emerald-500 ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                scope === 'ALL' || isRoleGlobalAdmin
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {isFa ? 'همه اشخاص مجتمع (دسترسی کامل)' : 'All Complex Personnel'}
                </span>
                {(scope === 'ALL' || isRoleGlobalAdmin) && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white">
                    {isFa ? 'فعال' : 'Active'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {isFa
                  ? 'دسترسی به کلیه پرسنل فعال ثبت‌شده در اطلاعات پرسنل مجتمع (مخصوص مدیران ارشد و مسئولین مجاز).'
                  : 'Full access to all active personnel records in the complex database.'}
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Assigned Personnel Picker when scope === 'ASSIGNED' */}
      {scope === 'ASSIGNED' && !isRoleGlobalAdmin ? (
        <div className="space-y-4">
          {/* Quick Actions & Search Bar */}
          <div className="flex flex-col md:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isFa
                    ? 'جستجو در اطلاعات پرسنل مجتمع (نام، کد پرسنلی، کد ملی، واحد، سمت)...'
                    : 'Search complex personnel by name, code, national ID, unit...'
                }
                className="w-full pr-9 pl-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="pr-8 pl-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="ALL">{isFa ? 'همه واحدهای مجتمع' : 'All Units'}</option>
                  {availableUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {unitFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={handleAddUnitPersonnel}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/40 hover:bg-indigo-200 rounded-xl transition-colors whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isFa ? 'افزودن همه پرسنل این واحد' : 'Add All in Unit'}</span>
                </button>
              )}

              {selfPersonnelMatch && !selectedIdsSet.has(String(selfPersonnelMatch.id)) && (
                <button
                  type="button"
                  onClick={() => togglePersonnel(String(selfPersonnelMatch.id))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 rounded-xl transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isFa
                      ? `افزودن شخصِ خودِ کاربر (${selfPersonnelMatch.fullName})`
                      : `Add Self (${selfPersonnelMatch.fullName})`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Selected Personnel Chips */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {isFa
                  ? `لیست اشخاص مرتبط انتخاب‌شده (${selectedPersonnelObjects.length} نفر)`
                  : `Assigned Personnel (${selectedPersonnelObjects.length})`}
              </span>
              {selectedPersonnelObjects.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>{isFa ? 'حذف همه اشخاص مرتبط' : 'Clear All'}</span>
                </button>
              )}
            </div>

            {selectedPersonnelObjects.length === 0 ? (
              <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {isFa
                    ? 'هیچ شخصی به این کاربر منتسب نشده است. در این حالت کاربر به اطلاعات هیچ پرسنلی در ماژول‌ها دسترسی نخواهد داشت.'
                    : 'No personnel assigned. User will not have access to any personnel data across modules.'}
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                {selectedPersonnelObjects.map((person) => (
                  <div
                    key={person.id}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-indigo-950 dark:text-indigo-200">
                        {person.fullName}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isFa ? 'کد پرسنلی:' : 'Code:'} {person.personnelCode} | {person.unit || '—'} (ID: #{person.id})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePersonnel(String(person.id))}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                      title={isFa ? 'حذف از اشخاص مرتبط' : 'Remove'}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Searchable Directory Table from Complex Personnel */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <span>
                {isFa
                  ? 'انتخاب از بانک اطلاعات پرسنل مجتمع (بر اساس Personnel ID معتبر دیتابیس)'
                  : 'Select from Complex Personnel Master Database'}
              </span>
              <span>
                {isFa ? `نمایش ${filteredCandidates.length} مورد` : `Showing ${filteredCandidates.length}`}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredCandidates.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  {isFa
                    ? 'پرسنلی با مشخصات جستجو شده در اطلاعات پرسنل مجتمع یافت نشد.'
                    : 'No matching active personnel found in complex database.'}
                </div>
              ) : (
                filteredCandidates.map((person) => {
                  const isSelected = selectedIdsSet.has(String(person.id));
                  return (
                    <div
                      key={person.id}
                      onClick={() => togglePersonnel(String(person.id))}
                      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100/70'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {person.fullName}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              کد: {person.personnelCode}
                            </span>
                            {person.nationalCode && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                ملی: {person.nationalCode}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                              DB ID: #{person.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {person.unit || 'واحد نامشخص'} — {person.jobTitle || person.position || 'کارشناس'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePersonnel(String(person.id));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300'
                            : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300'
                        }`}
                      >
                        {isSelected ? (isFa ? 'حذف' : 'Remove') : isFa ? 'افزودن' : 'Add'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="font-bold">
              {isFa
                ? 'دسترسی به «همه اشخاص مجتمع» برای این کاربر فعال است.'
                : 'Access to "All Complex Personnel" is active for this user.'}
            </p>
            <p className="text-[11px] opacity-90 mt-0.5">
              {isFa
                ? 'این کاربر مجوز مشاهده و عملیات بر روی تمامی پرسنل فعال موجود در بانک اطلاعات پرسنل مجتمع را در کلیه ماژول‌ها دارد.'
                : 'This user is authorized to view and operate on all active personnel records across all modules.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export interface UserPersonnelAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfile | null;
  language?: 'fa' | 'en';
  onSaved?: (updatedData: any) => void;
}

export const UserPersonnelAssignmentModal: React.FC<UserPersonnelAssignmentModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  language = 'fa',
  onSaved,
}) => {
  const isFa = language === 'fa';
  const [scope, setScope] = useState<'ALL' | 'ASSIGNED'>('ASSIGNED');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetUser) return;
    const initialScope =
      targetUser.personnelAccessScope === 'ALL' || targetUser.canAccessAllPersonnel
        ? 'ALL'
        : 'ASSIGNED';
    setScope(initialScope);
    setSelectedIds(Array.isArray(targetUser.assignedPersonnelIds) ? targetUser.assignedPersonnelIds : []);

    // Fetch fresh assignments from PostgreSQL
    const uid = (targetUser as any).uid || targetUser.id || targetUser.username;
    if (uid) {
      setIsLoadingInitial(true);
      apiDb
        .getUserPersonnelAssignments(String(uid))
        .then((res) => {
          if (res) {
            setScope(res.scope === 'ALL' ? 'ALL' : 'ASSIGNED');
            if (Array.isArray(res.assignedPersonnelIds)) {
              setSelectedIds(res.assignedPersonnelIds.map((v: any) => String(v)));
            }
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingInitial(false));
    }
  }, [isOpen, targetUser]);

  if (!isOpen || !targetUser) return null;

  const handleSave = async () => {
    const uid = (targetUser as any).uid || targetUser.id || targetUser.username;
    if (!uid) return;
    setIsSaving(true);
    try {
      const updated = await apiDb.updateUserPersonnelAssignments(String(uid), {
        scope,
        personnelIds: selectedIds,
      });
      toast.success(
        isFa
          ? `اشخاص مرتبط کاربر «${targetUser.fullName}» در PostgreSQL ذخیره و در تمام نشست‌ها اعمال شد.`
          : 'User personnel assignments saved and applied across all active sessions.'
      );
      if (onSaved) onSaved(updated);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در ذخیره اشخاص مرتبط کاربر' : 'Failed to save assignments'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isFa
                  ? `مدیریت اشخاص مرتبط کاربر: ${targetUser.fullName}`
                  : `Manage Assigned Personnel: ${targetUser.fullName}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFa
                  ? `نام کاربری: ${targetUser.username} | کد پرسنلی: ${targetUser.personnelNumber || '—'} | نقش: ${targetUser.role}`
                  : `Username: ${targetUser.username} | Role: ${targetUser.role}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isLoadingInitial ? (
            <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>{isFa ? 'در حال دریافت اطلاعات انتساب از پایگاه داده PostgreSQL...' : 'Loading assignments...'}</span>
            </div>
          ) : (
            <UserPersonnelAssignmentSection
              language={language}
              scope={scope}
              onChangeScope={setScope}
              selectedPersonnelIds={selectedIds}
              onChangeSelectedPersonnelIds={setSelectedIds}
              canGrantAllScope={true}
              userPersonnelNumber={targetUser.personnelNumber}
              userFullName={targetUser.fullName}
              userRole={targetUser.role}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isFa ? 'ذخیره و اعمال آنی تغییرات' : 'Save & Apply Immediately'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
