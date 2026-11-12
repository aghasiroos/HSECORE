import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserSearch,
  Search,
  User,
  ShieldAlert,
  AlertTriangle,
  FileText,
  HardHat,
  GraduationCap,
  Clock,
  Printer,
  X,
  CheckCircle2,
  Building,
  Briefcase,
  Phone,
  CreditCard,
  BookOpen,
  Filter,
  Award,
  Lock,
  History,
  Heart,
  ShieldCheck,
  Paperclip,
  Plus,
  Eye,
  Download,
  Activity,
  Stethoscope,
  Pill,
  Ambulance,
  ChevronLeft,
  UserCheck,
  TrendingUp,
  SlidersHorizontal,
  CheckSquare,
  Send,
  ClipboardCheck
} from 'lucide-react';
import { getComplexPersonnelList, ComplexPersonnel } from '../utils/personnelHelper';
import { WarningRecord } from '../types';
import { ComprehensivePersonnelDossier } from '../types/personnelDossierTypes';
import { personnelDossierService } from '../services/personnelDossierService';

import PersonnelDossierPrintModal from './personnel-dossier/PersonnelDossierPrintModal';
import PersonnelDossierAttachmentsModal from './personnel-dossier/PersonnelDossierAttachmentsModal';
import PersonnelRestrictionModal from './personnel-dossier/PersonnelRestrictionModal';
import PersonnelQualificationModal from './personnel-dossier/PersonnelQualificationModal';

interface PersonnelHistoryModuleProps {
  isFa: boolean;
  currentUser?: any;
  warnings?: WarningRecord[];
}

export default function PersonnelHistoryModule({ isFa, currentUser, warnings: propsWarnings }: PersonnelHistoryModuleProps) {
  // --- Search State Fields ---
  const [personnelCodeInput, setPersonnelCodeInput] = useState('');
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [selectedJobTitle, setSelectedJobTitle] = useState('ALL');
  const [selectedRecordYear, setSelectedRecordYear] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Selected target personnel
  const [selectedPersonnel, setSelectedPersonnel] = useState<ComplexPersonnel | null>(null);

  // Active Tab inside the 360° Dossier View
  const [activeTab, setActiveTab] = useState<
    'overview' | 'identity' | 'health' | 'training' | 'permits' | 'incidents' | 'capa' | 'risks' | 'inspections' | 'referrals' | 'warnings' | 'ppe' | 'attachments' | 'audit_logs'
  >('overview');

  // Modals state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDefaultSection, setPrintDefaultSection] = useState('all');
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [showQualificationModal, setShowQualificationModal] = useState(false);

  // State ticker for re-triggering dynamic data reload
  const [dataVersion, setDataVersion] = useState(0);

  // --- All Personnel Database ---
  const [allPersonnel, setAllPersonnel] = useState<ComplexPersonnel[]>([]);

  const loadPersonnel = useCallback(() => {
    const list = getComplexPersonnelList();
    setAllPersonnel(list);
  }, []);

  useEffect(() => {
    loadPersonnel();

    const handleStorageUpdate = () => {
      setDataVersion(v => v + 1);
      loadPersonnel();
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('hse_medical_data_updated', handleStorageUpdate);
    window.addEventListener('hse_safety_inspections_updated', handleStorageUpdate);
    window.addEventListener('hse_personnel_updated', handleStorageUpdate);
    window.addEventListener('app_data_mutated', handleStorageUpdate);
    window.addEventListener('hse_data_mutated', handleStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('hse_medical_data_updated', handleStorageUpdate);
      window.removeEventListener('hse_safety_inspections_updated', handleStorageUpdate);
      window.removeEventListener('hse_personnel_updated', handleStorageUpdate);
      window.removeEventListener('app_data_mutated', handleStorageUpdate);
      window.removeEventListener('hse_data_mutated', handleStorageUpdate);
    };
  }, [loadPersonnel]);

  // Log Dossier View when personnel is selected (Guarded against duplicate re-render logging)
  const lastLoggedPersonnelIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (selectedPersonnel && selectedPersonnel.id !== lastLoggedPersonnelIdRef.current) {
      lastLoggedPersonnelIdRef.current = selectedPersonnel.id;
      personnelDossierService.logDossierAccess(selectedPersonnel, currentUser, 'VIEW');
    } else if (!selectedPersonnel) {
      lastLoggedPersonnelIdRef.current = null;
    }
  }, [selectedPersonnel, currentUser]);

  // Unique Units and Job Titles for search filters
  const uniqueUnits = useMemo(() => {
    const units = new Set<string>();
    allPersonnel.forEach(p => {
      if (p.unit && p.unit.trim()) units.add(p.unit.trim());
    });
    return Array.from(units).sort();
  }, [allPersonnel]);

  const uniqueJobTitles = useMemo(() => {
    const titles = new Set<string>();
    allPersonnel.forEach(p => {
      if (p.jobTitle && p.jobTitle.trim()) titles.add(p.jobTitle.trim());
    });
    return Array.from(titles).sort();
  }, [allPersonnel]);

  // --- Dynamic Personnel Filtering ---
  const filteredPersonnelList = useMemo(() => {
    return allPersonnel.filter(p => {
      const pCode = (p.personnelCode || p.effectiveCode || '').toLowerCase();
      const pNatCode = (p.nationalCode || '').toLowerCase();
      const pFirst = (p.firstName || '').toLowerCase();
      const pLast = (p.lastName || '').toLowerCase();
      const pFull = (p.fullName || `${p.firstName} ${p.lastName}`).toLowerCase();

      // Search Inputs
      if (personnelCodeInput) {
        const inputCode = personnelCodeInput.trim().toLowerCase();
        if (!pCode.includes(inputCode) && !pNatCode.includes(inputCode)) {
          return false;
        }
      }
      if (firstNameInput) {
        const inputFirst = firstNameInput.trim().toLowerCase();
        if (!pFirst.includes(inputFirst) && !pFull.includes(inputFirst)) {
          return false;
        }
      }
      if (lastNameInput) {
        const inputLast = lastNameInput.trim().toLowerCase();
        if (!pLast.includes(inputLast) && !pFull.includes(inputLast)) {
          return false;
        }
      }

      // Unit filter
      if (selectedUnit !== 'ALL' && p.unit !== selectedUnit) {
        return false;
      }

      // Job Title filter
      if (selectedJobTitle !== 'ALL' && p.jobTitle !== selectedJobTitle) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter === 'ACTIVE' && p.status === 'inactive') return false;
      if (selectedStatusFilter === 'INACTIVE' && p.status !== 'inactive') return false;

      return true;
    });
  }, [allPersonnel, personnelCodeInput, firstNameInput, lastNameInput, selectedUnit, selectedJobTitle, selectedStatusFilter]);

  // --- 360° Comprehensive Dossier Data Gathering ---
  const [dossier, setDossier] = useState<ComprehensivePersonnelDossier | null>(null);

  useEffect(() => {
    if (!selectedPersonnel) {
      setDossier(null);
      return;
    }
    let isMounted = true;
    personnelDossierService.buildDossier(selectedPersonnel).then(res => {
      if (isMounted) setDossier(res);
    }).catch(console.error);

    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersonnel, dataVersion, propsWarnings]);

  const hasSearchFilterActive = 
    Boolean(personnelCodeInput || firstNameInput || lastNameInput || selectedUnit !== 'ALL' || selectedJobTitle !== 'ALL' || selectedStatusFilter !== 'ALL');

  const handleResetSearch = () => {
    setPersonnelCodeInput('');
    setFirstNameInput('');
    setLastNameInput('');
    setSelectedUnit('ALL');
    setSelectedJobTitle('ALL');
    setSelectedStatusFilter('ALL');
    setSelectedRecordYear('ALL');
    setSelectedPersonnel(null);
  };

  // Quick Print Direct Handler
  const handleQuickPrint = (section = 'all') => {
    setPrintDefaultSection(section);
    setShowPrintModal(true);
  };

  return (
    <div className="space-y-6 pb-16 font-sans text-slate-900 dark:text-slate-100" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
      
      {/* Module Title Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 rounded-3xl border border-slate-700/60 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <UserSearch className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">
                  {isFa ? 'سامانه و پرونده جامع ۳۶۰ درجه پرسنل' : 'Comprehensive 360° Personnel Dossier & Records'}
                </h1>
                <span className="text-[10px] font-black font-mono bg-blue-600 text-white px-2 py-0.5 rounded-md">
                  V3.0 Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-1">
                {isFa 
                  ? 'نمای یکپارچه و آنی تمامی سوابق شغلی، طب کار، پروانه‌های PTW، آموزش‌های HSE، ارزیابی‌های ریسک، حوادث، اخطارها و صلاحیت‌ها'
                  : 'Holistic real-time view integrating medical, safety training, permits, risk assessments, incidents, warnings and certificates.'}
              </p>
            </div>
          </div>

          {selectedPersonnel && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleQuickPrint('all')}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-500/20"
                title="مشاهده پیش‌نمایش، تنظیم تراکم و چاپ رسمی فرم استاندارد A4 با درج لوگوی سازمانی"
              >
                <Printer className="w-4 h-4" />
                <span>{isFa ? 'چاپ رسمی با درج لوگو A4' : 'Print Formal Dossier (A4)'}</span>
              </button>
              <button
                onClick={() => {
                  setPrintDefaultSection('all');
                  setShowPrintModal(true);
                }}
                className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-500/20"
                title="دانلود و صدور نسخه PDF پرونده پرسنل"
              >
                <Download className="w-4 h-4" />
                <span>{isFa ? 'خروجی PDF' : 'Export PDF'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- Search & Identification Panel --- */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 font-black text-sm text-slate-800 dark:text-slate-100">
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
            <span>{isFa ? 'فیلترها و استعلام هوشمند پرسنل' : 'Smart Personnel Query & Filters'}</span>
          </div>

          <div className="flex items-center gap-3">
            {hasSearchFilterActive && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                {isFa ? `پرسنل منطبق: ${filteredPersonnelList.length} از ${allPersonnel.length} نفر` : `Matched: ${filteredPersonnelList.length} of ${allPersonnel.length}`}
              </span>
            )}
            {hasSearchFilterActive && (
              <button
                onClick={handleResetSearch}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
                <span>{isFa ? 'پاکسازی فیلترها' : 'Clear Filters'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 5-Field Responsive Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* 1. Personnel Code / National Code */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-500" />
              <span>{isFa ? 'کد پرسنلی / کد ملی' : 'Code / ID'}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={personnelCodeInput}
                onChange={(e) => setPersonnelCodeInput(e.target.value)}
                placeholder={isFa ? 'مثال: 98102 یا 1810...' : 'e.g. 98102...'}
                className="w-full pl-9 pr-7 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {personnelCodeInput && (
                <button
                  type="button"
                  onClick={() => setPersonnelCodeInput('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. First Name */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>{isFa ? 'نام' : 'First Name'}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={firstNameInput}
                onChange={(e) => setFirstNameInput(e.target.value)}
                placeholder={isFa ? 'مثال: محمد، علی...' : 'First name...'}
                className="w-full px-3 py-2 pr-7 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              {firstNameInput && (
                <button
                  type="button"
                  onClick={() => setFirstNameInput('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 3. Last Name */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span>{isFa ? 'نام خانوادگی' : 'Last Name'}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={lastNameInput}
                onChange={(e) => setLastNameInput(e.target.value)}
                placeholder={isFa ? 'مثال: خلیلی، عساکره...' : 'Last name...'}
                className="w-full px-3 py-2 pr-7 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              {lastNameInput && (
                <button
                  type="button"
                  onClick={() => setLastNameInput('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 4. Unit Filter */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-500" />
              <span>{isFa ? 'واحد سازمانی' : 'Unit'}</span>
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
            >
              <option value="ALL">{isFa ? 'همه واحدها' : 'All Units'}</option>
              {uniqueUnits.map((u, i) => (
                <option key={i} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* 5. Job Title Filter */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              <span>{isFa ? 'سمت / شغل' : 'Job Title'}</span>
            </label>
            <select
              value={selectedJobTitle}
              onChange={(e) => setSelectedJobTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
            >
              <option value="ALL">{isFa ? 'همه سمت‌ها' : 'All Job Titles'}</option>
              {uniqueJobTitles.map((t, i) => (
                <option key={i} value={t}>{t}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Quick-select Personnel Chips - ONLY shown when user actively searches */}
        {!hasSearchFilterActive ? (
          <div className="pt-2 pb-1">
            <div className="flex items-center justify-between p-3.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold">
                  {isFa
                    ? 'جهت انتخاب سریع پرسنل و مشاهده پرونده جامع، کد پرسنلی یا نام فرد را جستجو فرمایید.'
                    : 'To view personnel dossier, please search by code or name above.'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-blue-600/70 dark:text-blue-400/70 hidden sm:inline">
                {allPersonnel.length} پرسنل در سیستم
              </span>
            </div>
          </div>
        ) : filteredPersonnelList.length > 0 ? (
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isFa ? `نتایج جستجو (${filteredPersonnelList.length} نفر):` : `Search Results (${filteredPersonnelList.length}):`}
              </span>
              <span className="text-[10px] text-slate-400">
                {isFa ? 'برای بارگذاری پرونده روی نام فرد کلیک کنید' : 'Click on personnel to load dossier'}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {filteredPersonnelList.map((p, idx) => {
                const isSelected = selectedPersonnel?.id === p.id;
                const pCode = p.personnelCode || p.effectiveCode || '';
                return (
                  <button
                    key={`${p.id || 'p'}-${idx}`}
                    type="button"
                    onClick={() => setSelectedPersonnel(p)}
                    className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition shrink-0 cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20 font-black'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-500'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[10px] font-black">
                      {p.firstName?.[0] || 'پ'}
                    </div>
                    <span>{p.fullName || `${p.firstName} ${p.lastName}`}</span>
                    <span className="font-mono text-[10px] opacity-80 px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10">
                      {pCode}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="pt-2 pb-1">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
              {isFa ? 'پرسنلی با این مشخصات یافت نشد. لطفاً عبارت جستجو را بررسی نمایید.' : 'No personnel found matching search criteria.'}
            </div>
          </div>
        )}

      </div>

      {/* --- Personnel 360° Dossier View --- */}
      {selectedPersonnel && dossier ? (
        <div className="space-y-6">

          {/* 1. TOP EXECUTIVE DASHBOARD CARD */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-md relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              
              {/* Personnel Identification Block */}
              <div className="flex items-start sm:items-center gap-5">
                {/* Photo / Avatar */}
                <div className="relative group">
                  <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-3xl shadow-xl shadow-blue-500/20 border-2 border-blue-400 overflow-hidden shrink-0">
                    {selectedPersonnel.profilePhoto ? (
                      <img src={selectedPersonnel.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>
                        {selectedPersonnel.firstName?.[0] || 'پ'}
                        {selectedPersonnel.lastName?.[0] || ''}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Core Identifiers */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                      {selectedPersonnel.fullName || `${selectedPersonnel.firstName} ${selectedPersonnel.lastName}`}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-mono font-black text-xs">
                      کد: {selectedPersonnel.personnelCode || selectedPersonnel.effectiveCode}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                      {selectedPersonnel.jobTitle || 'عضو سازمان'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      {selectedPersonnel.unit || 'واحد نامشخص'}
                    </span>
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      کد ملی: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedPersonnel.nationalCode || '-'}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      تماس: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedPersonnel.phone || '-'}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      تحصیلات: <strong className="text-slate-700 dark:text-slate-300">{selectedPersonnel.education || '-'}</strong>
                    </span>
                  </div>

                  {/* Actions Bar inside Card */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={() => setShowAttachmentsModal(true)}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-blue-500" />
                      <span>پیوست‌ها ({dossier.attachments.length})</span>
                    </button>

                    <button
                      onClick={() => setShowRestrictionModal(true)}
                      className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-rose-200 dark:border-rose-900"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                      <span>ثبت محدودیت پزشکی</span>
                    </button>

                    <button
                      onClick={() => setShowQualificationModal(true)}
                      className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-indigo-200 dark:border-indigo-900"
                    >
                      <Award className="w-3.5 h-3.5 text-indigo-500" />
                      <span>ثبت صلاحیت / گواهینامه</span>
                    </button>

                    <button
                      onClick={() => handleQuickPrint(activeTab === 'overview' ? 'all' : activeTab)}
                      className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-blue-500/30"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-500" />
                      <span>چاپ صفحه جاری</span>
                    </button>

                    <button
                      onClick={() => setSelectedPersonnel(null)}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                      title="بستن پرونده و عدم نمایش"
                    >
                      <X className="w-3.5 h-3.5 text-rose-500" />
                      <span>بستن پرونده</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Status Verdict Pill */}
              <div className="flex flex-col items-start lg:items-end gap-2 shrink-0 border-t lg:border-t-0 lg:border-r border-slate-100 dark:border-slate-800 pt-4 lg:pt-0 lg:pr-6">
                <span className="text-[11px] font-bold text-slate-400">وضعیت تناسب طب کار و سلامت:</span>
                <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border font-black text-xs ${
                  dossier.summary.fitnessStatus === 'FIT'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-700 dark:text-emerald-400'
                    : dossier.summary.fitnessStatus === 'CONDITIONAL'
                    ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 text-sky-700 dark:text-sky-400'
                    : dossier.summary.fitnessStatus === 'UNFIT'
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-700 dark:text-rose-400'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 text-slate-700 dark:text-slate-300'
                }`}>
                  <Heart className="w-4 h-4 fill-current" />
                  <span>{dossier.summary.fitnessStatusFa}</span>
                </div>
                {dossier.summary.lastMedicalExamDate && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    آخرین معاینه: {dossier.summary.lastMedicalExamDate}
                  </span>
                )}
              </div>

            </div>

            {/* 8 Comprehensive 360° KPI Stat Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              
              {/* 1. Safety Score */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">امتیاز ایمنی</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                    {dossier.summary.safetyScore}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">/ ۱۰۰</span>
                </div>
              </div>

              {/* 2. Total Training Hours */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">آموزش HSE</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                    {dossier.summary.totalTrainingHours}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">ساعت</span>
                </div>
              </div>

              {/* 3. Safe Work Permits */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">پروانه PTW</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                    {dossier.summary.totalPermitsCount}
                  </span>
                  <span className="text-[9px] font-bold text-emerald-600">({dossier.summary.activePermitsCount} فعال)</span>
                </div>
              </div>

              {/* 4. CAPA & Non-Conformances */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">عدم انطباق CAPA</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-black font-mono ${dossier.summary.openCapaCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {dossier.summary.openCapaCount}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">باز از {dossier.summary.totalCapaCount}</span>
                </div>
              </div>

              {/* 5. Occupational Restrictions */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">محدودیت شغلی</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-black font-mono ${dossier.summary.activeRestrictionsCount > 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
                    {dossier.summary.activeRestrictionsCount}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">مورد فعال</span>
                </div>
              </div>

              {/* 6. Special Qualifications */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">گواهینامه و مجوز</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {dossier.summary.validCertificatesCount}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">معتبر</span>
                </div>
              </div>

              {/* 7. Inspections & Audits */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">بازرسی و 5S</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono text-teal-600 dark:text-teal-400">
                    {dossier.summary.totalInspectionsCount}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">مورد</span>
                </div>
              </div>

              {/* 8. Referrals & Signatures */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">ارجاعات کارتابل</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black font-mono text-sky-600 dark:text-sky-400">
                    {dossier.summary.totalReferralsCount}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">سند</span>
                </div>
              </div>

            </div>

          </div>

          {/* 2. 10-TAB NAVIGATION BAR */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-thin">
            
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>داشبورد ۳۶۰ درجه</span>
            </button>

            <button
              onClick={() => setActiveTab('identity')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'identity'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <User className="w-4 h-4" />
              <span>اطلاعات هویتی و سازمانی</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'health'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <Heart className={`w-4 h-4 ${activeTab === 'health' ? 'text-white' : 'text-rose-500'}`} />
              <span>طب کار و محدودیت‌ها</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'health'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
                {dossier.medicalExams.length + dossier.occupationalRestrictions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('training')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'training'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <GraduationCap className={`w-4 h-4 ${activeTab === 'training' ? 'text-white' : 'text-blue-500'}`} />
              <span>آموزش و صلاحیت‌ها</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'training'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>
                {dossier.trainingCourses.length + dossier.qualifications.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('permits')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'permits'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <FileText className={`w-4 h-4 ${activeTab === 'permits' ? 'text-white' : 'text-blue-500'}`} />
              <span>پروانه‌های کار (PTW)</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'permits'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>
                {dossier.workPermits.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('incidents')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'incidents'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${activeTab === 'incidents' ? 'text-white' : 'text-rose-500'}`} />
              <span>حوادث و BBS</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'incidents'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
                {dossier.incidents.length + dossier.bbsObservations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('capa')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'capa'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <CheckSquare className={`w-4 h-4 ${activeTab === 'capa' ? 'text-white' : 'text-indigo-500'}`} />
              <span>عدم انطباق‌ها و CAPA</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'capa'
                  ? 'bg-white/20 text-white'
                  : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              }`}>
                {dossier.nonConformances?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('risks')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'risks'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'risks' ? 'text-white' : 'text-emerald-500'}`} />
              <span>ارزیابی ریسک</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'risks'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                {dossier.riskAssessments.length + dossier.safetyInspections.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('inspections')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'inspections'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <ClipboardCheck className={`w-4 h-4 ${activeTab === 'inspections' ? 'text-white' : 'text-teal-500'}`} />
              <span>بازرسی‌های بهداشت و 5S</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'inspections'
                  ? 'bg-white/20 text-white'
                  : 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
              }`}>
                {(dossier.healthEnvInspections?.length || 0) + (dossier.fiveSInspections?.length || 0)}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('referrals')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'referrals'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <Send className={`w-4 h-4 ${activeTab === 'referrals' ? 'text-white' : 'text-sky-500'}`} />
              <span>ارجاعات و کارتابل</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'referrals'
                  ? 'bg-white/20 text-white'
                  : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
              }`}>
                {dossier.referrals?.length || 0}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('warnings')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'warnings'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <ShieldAlert className={`w-4 h-4 ${activeTab === 'warnings' ? 'text-white' : 'text-rose-500'}`} />
              <span>اخطارهای انضباطی و ایمنی</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'warnings'
                  ? 'bg-white/20 text-white'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
                {dossier.warnings.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ppe')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'ppe'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <HardHat className={`w-4 h-4 ${activeTab === 'ppe' ? 'text-white' : 'text-blue-500'}`} />
              <span>تجهیزات حفاظت فردی (PPE)</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'ppe'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>
                {dossier.ppeIssuances.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('attachments')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'attachments'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <Paperclip className="w-4 h-4" />
              <span>پیوست‌ها</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'attachments'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {dossier.attachments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('audit_logs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                activeTab === 'audit_logs'
                  ? 'bg-blue-600 text-white font-black shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              <History className="w-4 h-4" />
              <span>لاگ سوابق</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                activeTab === 'audit_logs'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {dossier.auditLogs.length}
              </span>
            </button>

          </div>

          {/* 3. TAB CONTENT PANELS */}

          {/* =========================================================================
              TAB 1: OVERVIEW & 360° PANORAMIC DOSSIER VIEW
             ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Alerts & Critical Highlights */}
              {dossier.occupationalRestrictions.some(r => r.status === 'ACTIVE') && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-3xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-rose-900 dark:text-rose-200">
                      هشدار محدودیت شغلی فعال برای این پرسنل
                    </h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300">
                      پرسنل دارای {dossier.occupationalRestrictions.filter(r => r.status === 'ACTIVE').length} محدودیت فعال طب کار می‌باشد. قبل از ارجاع کار و صدور پروانه PTW، الزامات محدودیت را بررسی کنید.
                    </p>
                  </div>
                </div>
              )}

              {/* --- 360° PANORAMIC DOSSIER SUMMARY CARDS (نمای کلی از کل پرونده) --- */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      نمای کلی از کل پرونده ۳۶۰ درجه و وضعیت یکپارچه شاخص‌ها
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">شاخص سلامت و انطباق HSE:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 font-mono font-black text-xs">
                      {dossier.summary.safetyScore}%
                    </span>
                  </div>
                </div>

                {/* 6 Grid Domain Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* 1. Identity & Employment Summary */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <UserCheck className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">مشخصات هویتی و سازمانی</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold">شاغل</span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">کد پرسنلی:</span>
                          <strong className="font-mono text-slate-900 dark:text-white">{selectedPersonnel.personnelCode || selectedPersonnel.effectiveCode}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">سمت / شغل:</span>
                          <strong>{selectedPersonnel.jobTitle || 'عضو سازمان'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">واحد سازمانی:</span>
                          <strong>{selectedPersonnel.unit || 'نامشخص'}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('identity')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده جزئیات شناسنامه</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 2. Occupational Health & Fitness */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                            <Heart className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">طب کار و سلامت شغلی</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          dossier.summary.fitnessStatus === 'FIT' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-sky-500/10 text-sky-600'
                        }`}>
                          {dossier.summary.fitnessStatusFa}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">آخرین معاینه دوره‌ای:</span>
                          <strong className="font-mono">{dossier.summary.lastMedicalExamDate || 'ثبت نشده'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">محدودیت‌های شغلی:</span>
                          <strong className={dossier.summary.activeRestrictionsCount > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {dossier.summary.activeRestrictionsCount > 0 ? `${dossier.summary.activeRestrictionsCount} مورد فعال` : 'بدون محدودیت'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">تعداد پرونده‌های ثبت‌شده:</span>
                          <strong className="font-mono">{dossier.medicalExams.length} دوره</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('health')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-rose-600 dark:text-rose-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده پرونده سلامت</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 3. Training & Qualifications */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">آموزش و صلاحیت‌ها</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold font-mono">
                          {dossier.summary.totalTrainingHours} ساعت
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">دوره‌های آموزش HSE:</span>
                          <strong className="font-mono">{dossier.trainingCourses.length} دوره سپری‌شده</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">گواهینامه‌های معتبر:</span>
                          <strong className="text-emerald-600 font-mono font-bold">{dossier.summary.validCertificatesCount} مدرک فعال</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">صلاحیت ویژه:</span>
                          <strong>{dossier.qualifications[0]?.certificateName || 'ندارد'}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('training')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده دوره‌ها و مدارک</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 4. Safe Work Permits (PTW) */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                            <FileText className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">پروانه‌های کار ایمن (PTW)</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 font-bold font-mono">
                          {dossier.summary.activePermitsCount} فعال
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">مجموع پروانه‌های کار:</span>
                          <strong className="font-mono">{dossier.summary.totalPermitsCount} پروانه</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">نقش در پروانه‌ها:</span>
                          <strong>مجری / درخواست‌کننده</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">آخرین پروانه صادرشده:</span>
                          <span className="font-mono text-[11px] truncate max-w-[120px]">{dossier.workPermits[0]?.serialNumber || '-'}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('permits')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده کارنامه پروانه‌ها</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 5. Incidents & BBS Observations */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">حوادث و مشاهدات BBS</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          dossier.incidents.length === 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          {dossier.incidents.length === 0 ? 'بدون حادثه' : `${dossier.incidents.length} حادثه`}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">حوادث و شبه‌حوادث:</span>
                          <strong className={dossier.incidents.length === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {dossier.incidents.length} رویداد
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">مشاهدات رفتاری BBS:</span>
                          <strong className="font-mono">{dossier.bbsObservations.length} مشاهده</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">رفتارهای ایمن ثبت‌شده:</span>
                          <strong className="text-emerald-600 font-mono font-bold">
                            {dossier.bbsObservations.filter(b => b.behaviorType === 'SAFE').length} رفتار
                          </strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('incidents')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده گزارش‌های حوادث</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 6. Warnings & PPE */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                            <HardHat className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">اخطارها و تجهیزات فردی</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold font-mono">
                          {dossier.ppeIssuances.length} قلم PPE
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">اخطارهای انضباطی:</span>
                          <strong className={dossier.warnings.length > 0 ? 'text-rose-600 font-mono font-bold' : 'text-emerald-600 font-bold'}>
                            {dossier.warnings.length > 0 ? `${dossier.warnings.length} اخطار` : 'بدون اخطار'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">اقلام PPE تحویل‌شده:</span>
                          <strong className="font-mono">{dossier.ppeIssuances.length} قلم</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">آخرین تحویل تجهیزات:</span>
                          <span className="font-mono text-[11px]">{dossier.ppeIssuances[0]?.issueDate || 'ثبت نشده'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => setActiveTab('warnings')}
                        className="py-1.5 bg-white dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-rose-600 dark:text-rose-300 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-0.5 cursor-pointer"
                      >
                        <span>اخطارها</span>
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setActiveTab('ppe')}
                        className="py-1.5 bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-blue-600 dark:text-blue-300 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-0.5 cursor-pointer"
                      >
                        <span>تجهیزات PPE</span>
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* 7. CAPA & Non-Conformances */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                            <CheckSquare className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">اقدامات اصلاحی و CAPA</h4>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold font-mono ${
                          dossier.summary.openCapaCount === 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {dossier.summary.openCapaCount} باز
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">مجموع عدم انطباق‌های منتسب:</span>
                          <strong className="font-mono">{dossier.summary.totalCapaCount} مورد</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">اقدامات خاتمه‌یافته:</span>
                          <strong className="text-emerald-600 font-mono font-bold">{dossier.summary.totalCapaCount - dossier.summary.openCapaCount} مورد</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">وضعیت انطباق:</span>
                          <strong className={dossier.summary.openCapaCount === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                            {dossier.summary.openCapaCount === 0 ? 'کاملاً منطبق' : 'نیازمند اقدام تکمیلی'}
                          </strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('capa')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-indigo-600 dark:text-indigo-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مدیریت عدم انطباق‌ها</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 8. Health, Environmental & 5S Inspections */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                            <ClipboardCheck className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">بازرسی‌های بهداشت و 5S</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 font-bold font-mono">
                          {dossier.summary.totalInspectionsCount} بازرسی
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">بازرسی‌های بهداشت و محیط زیست:</span>
                          <strong className="font-mono">{dossier.healthEnvInspections?.length || 0} مورد</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">ممیزی‌های نظام 5S:</span>
                          <strong className="font-mono">{dossier.fiveSInspections?.length || 0} مورد</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">بازرسی‌های عملیاتی ایمنی:</span>
                          <strong className="font-mono">{dossier.safetyInspections.length} مورد</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('inspections')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-teal-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-teal-600 dark:text-teal-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده نتایج بازرسی‌ها</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* 9. Referrals & Signatures */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                            <Send className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">کارتابل و گردش اسناد</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 font-bold font-mono">
                          {dossier.summary.totalReferralsCount} گردش
                        </span>
                      </div>
                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">اسناد امضا / ارجاع شده:</span>
                          <strong className="font-mono">{dossier.referrals?.length || 0} مدرک</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">حساب کاربری سامانه:</span>
                          <strong className="text-slate-900 dark:text-white">{dossier.userAccount ? dossier.userAccount.username : 'بدون اکانت مجزا'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">سطح دسترسی:</span>
                          <strong>{dossier.userAccount?.role || 'پرسنل عادی'}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('referrals')}
                      className="w-full mt-2 py-1.5 bg-white dark:bg-slate-700 hover:bg-sky-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-sky-600 dark:text-sky-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>مشاهده کارتابل ارجاعات</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              </div>

              {/* 2-Column Overview Layout: Timeline and Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left (2 cols): Chronological Timeline */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-center gap-2 font-black text-sm">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>گاه‌شمار جامع ۳۶۰ درجه فعالیت‌ها و رویدادهای پرسنل</span>
                    </div>
                    <span className="text-[11px] text-slate-400">به ترتیب زمانی</span>
                  </div>

                  {/* Dynamic Timeline Stream */}
                  <div className="relative border-r-2 border-slate-200 dark:border-slate-700 pr-6 mr-3 space-y-6 py-2">
                    
                    {/* Medical Exam Event */}
                    {dossier.medicalExams.length > 0 && (
                      <div className="relative">
                        <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900"></div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-rose-700 dark:text-rose-400">معاینات دوره‌ای طب کار</span>
                            <span className="text-[10px] font-mono text-slate-400">{dossier.medicalExams[0].examDate || '1404'}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            نظریه پزشک: <strong>{dossier.medicalExams[0].status === 'fit' ? 'بلامانع و مناسب' : 'مشروط با محدودیت'}</strong> - {dossier.medicalExams[0].doctor || 'متخصص طب کار'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Latest Permit Event */}
                    {dossier.workPermits.length > 0 && (
                      <div className="relative">
                        <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900"></div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-blue-700 dark:text-blue-400">اجرای پروانه کار ایمن (PTW)</span>
                            <span className="text-[10px] font-mono text-slate-400">{dossier.workPermits[0].createdDate || '1404'}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            پروانه کار شماره <strong className="font-mono">{dossier.workPermits[0].serialNumber || dossier.workPermits[0].id}</strong> ({dossier.workPermits[0].permitType || 'پروانه گرم'}) در واحد {dossier.workPermits[0].department || dossier.workPermits[0].location || 'بهره‌برداری'}.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Training Course Event */}
                    {dossier.trainingCourses.length > 0 && (
                      <div className="relative">
                        <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900"></div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-blue-700 dark:text-blue-400">تکمیل دوره آموزشی HSE</span>
                            <span className="text-[10px] font-mono text-slate-400">{dossier.trainingCourses[0].date || '1403'}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            گواهینامه <strong>{dossier.trainingCourses[0].courseTitle || 'اصول ایمنی و آتش‌نشانی'}</strong> ({dossier.trainingCourses[0].hours || 8} ساعت) ثبت و صادر شد.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* BBS Observation Event */}
                    {dossier.bbsObservations.length > 0 && (
                      <div className="relative">
                        <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900"></div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">مشاهده رفتار ایمنی (BBS)</span>
                            <span className="text-[10px] font-mono text-slate-400">{dossier.bbsObservations[0].observationDate}</span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            {dossier.bbsObservations[0].description} (مشاهده‌گر: {dossier.bbsObservations[0].observerName})
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Clean History Marker if no incidents */}
                    {dossier.incidents.length === 0 && (
                      <div className="relative">
                        <div className="absolute -right-[31px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                          <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                            پرونده عاری از هرگونه آسیب، ناتوانی شغلی یا رویداد ناگوار
                          </span>
                          <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            پرسنل دارای بیش از ۳۶۵ روز کار ایمن و بدون حادثه است.
                          </span>
                        </div>
                      </div>
                    )}

                  </div>

                </div>

                {/* Right (1 col): Key Identity & Organizational Summary */}
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                    <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                      <span>خلاصه صلاحیت‌ها و مجوزها</span>
                      <Award className="w-4 h-4 text-blue-500" />
                    </h3>
                    
                    {dossier.qualifications.length > 0 ? (
                      <div className="space-y-2">
                        {dossier.qualifications.map(q => (
                          <div key={q.id} className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white block">{q.certificateName}</span>
                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                              <span>انقضا: {q.expiryDate || 'نامحدود'}</span>
                              <span className="text-emerald-600 font-bold">معتبر</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 block py-2">هیچ گواهینامه‌ای ثبت نشده است.</span>
                    )}

                    <button
                      onClick={() => setShowQualificationModal(true)}
                      className="w-full py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن صلاحیت یا گواهینامه</span>
                    </button>
                  </div>

                  {/* System Account Card */}
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
                    <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                      <span>حساب کاربری در سامانه</span>
                      <Lock className="w-4 h-4 text-slate-400" />
                    </h3>

                    {dossier.userAccount ? (
                      <div className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
                        <div>نام کاربری: <strong className="font-mono text-slate-900 dark:text-white">{dossier.userAccount.username}</strong></div>
                        <div>سطح دسترسی: <strong className="text-indigo-600 font-bold">{dossier.userAccount.role}</strong></div>
                        <div>وضعیت حساب: <span className="text-emerald-600 font-bold">فعال</span></div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 py-1">
                        فاقد نام کاربری مستقیم (پرسنل ثبت‌شده سازمانی)
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* =========================================================================
              TAB 2: IDENTITY & ORGANIZATIONAL DETAILS
             ========================================================================= */}
          {activeTab === 'identity' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span>شناسنامه هویتی و سازمانی پرسنل</span>
                </h3>
                <button
                  onClick={() => handleQuickPrint('identity')}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ مشخصات</span>
                </button>
              </div>

              {/* Identity 8-Box Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">نام و نام خانوادگی</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {selectedPersonnel.fullName || `${selectedPersonnel.firstName} ${selectedPersonnel.lastName}`}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">کد پرسنلی سازمانی</span>
                  <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                    {selectedPersonnel.personnelCode || selectedPersonnel.effectiveCode}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">کد ملی ده رقمی</span>
                  <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                    {selectedPersonnel.nationalCode || '-'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">نام پدر</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {(selectedPersonnel as any).fatherName || '-'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">تاریخ تولد و سن</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedPersonnel.birthDate || '-'} {selectedPersonnel.age ? `(${selectedPersonnel.age} سال)` : ''}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">جنسیت و وضعیت تاهل</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {(selectedPersonnel as any).gender || 'مرد'} | {selectedPersonnel.maritalStatus || 'نامشخص'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">تحصیلات و مدرک</span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedPersonnel.education || '-'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[11px] mb-1">شماره تماس اضطراری</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white text-sm">
                    {selectedPersonnel.phone || '-'}
                  </span>
                </div>
              </div>

              {/* Organizational Path & Hierarchy */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                  موقعیت سازمانی و محل خدمت:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>واحد: <strong className="text-slate-900 dark:text-white">{selectedPersonnel.unit || '-'}</strong></div>
                  <div>سمت: <strong className="text-slate-900 dark:text-white">{selectedPersonnel.jobTitle || '-'}</strong></div>
                  <div>سایت / محل خدمت: <strong className="text-slate-900 dark:text-white">{selectedPersonnel.workplace || 'سایت اصلی مجتمع'}</strong></div>
                  <div>وضعیت استخدام: <strong className="text-slate-900 dark:text-white">{(selectedPersonnel as any).employmentStatus || 'دائم / رسمی'}</strong></div>
                  <div>سرپرست مستقیم: <strong className="text-slate-900 dark:text-white">{selectedPersonnel.supervisor || 'مدیر بهره‌برداری'}</strong></div>
                  <div>شیفت کاری: <strong className="text-slate-900 dark:text-white">نوبت‌کاری ۱۲ ساعته (روز/شب)</strong></div>
                </div>
              </div>

              {/* Career Progression & Promotions */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span>سوابق ارتقای شغلی و انتقال واحد (Career History)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">{dossier.careerHistory.length} سابقه</span>
                </div>

                <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">تاریخ تغییر</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">واحد قبلی</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">واحد جدید</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">سمت جدید</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">نوع تغییر</th>
                      <th className="p-2">مرجع تصویب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.careerHistory.map((c, idx) => (
                      <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono font-bold">{c.date}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-slate-500">{c.previousUnit || '-'}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{c.newUnit}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-indigo-600 dark:text-indigo-400">{c.newJobTitle}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px]">
                            {c.changeType === 'PROMOTION' ? 'ارتقای شغلی' : 'استخدام / تثبیت'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600 dark:text-slate-400">{c.approvedBy || 'مدیریت منابع انسانی'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>

            </div>
          )}

          {/* =========================================================================
              TAB 3: OCCUPATIONAL HEALTH & RESTRICTIONS
             ========================================================================= */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              
              {/* Top Action Bar */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <Heart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">سوابق طب کار، سلامت شغلی و محدودیت‌ها</h3>
                    <p className="text-[11px] text-slate-400">یکپارچه با سامانه سلامت و طب کار</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRestrictionModal(true)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ثبت محدودیت پزشکی جدید</span>
                  </button>
                  <button
                    onClick={() => handleQuickPrint('health')}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>چاپ کارنامه سلامت</span>
                  </button>
                </div>
              </div>

              {/* Active Restrictions Table */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>محدودیت‌های شغلی و پزشکی ثبت‌شده در پرونده:</span>
                </h4>

                {dossier.occupationalRestrictions.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 font-bold border-b border-rose-200 dark:border-rose-900">
                        <th className="p-2 border-r border-rose-200 dark:border-rose-900 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-rose-200 dark:border-rose-900">عنوان محدودیت</th>
                        <th className="p-2 border-r border-rose-200 dark:border-rose-900">دسته عامل زیان‌آور</th>
                        <th className="p-2 border-r border-rose-200 dark:border-rose-900">تاریخ شروع / اعتبار</th>
                        <th className="p-2 border-r border-rose-200 dark:border-rose-900">پزشک صادرکننده</th>
                        <th className="p-2 border-r border-rose-200 dark:border-rose-900 text-center">وضعیت</th>
                        <th className="p-2">شرح و علت پزشکی</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.occupationalRestrictions.map((r, idx) => (
                        <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-rose-700 dark:text-rose-400">{r.title}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{r.category}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono">{r.startDate} {r.endDate ? `تا ${r.endDate}` : '(دائمی)'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{r.physicianName}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold">
                            <span className={r.status === 'ACTIVE' ? 'px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 text-[10px]' : 'text-slate-400'}>
                              {r.status === 'ACTIVE' ? 'فعال و لازم‌الاجرا' : 'منقضی شده'}
                            </span>
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-400">{r.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold text-center">
                    فاقد هرگونه محدودیت پزشکی یا منع کار در ارتفاع، شیفت شب یا مواجهه با صدا و مواد شیمیایی
                  </div>
                )}
              </div>

              {/* Periodic Exams List */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-500" />
                    <span>سوابق معاینات ادواری طب کار و آزمایشات پاراکلینیک</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">{dossier.medicalExams.length} پرونده</span>
                </div>

                {dossier.medicalExams.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">سال / تاریخ معاینه</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">نوع معاینه</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">پزشک و مرکز طب کار</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">نظریه نهایی</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">فشار خون / BMI</th>
                        <th className="p-2">توصیه‌های پزشکی و ارگونومی</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.medicalExams.map((e, idx) => (
                        <tr key={e.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono font-bold">{e.examDate || `${e.examYear}/--/--`}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{e.examType?.includes('دوره‌ای') ? 'معاینات ادواری سالیانه' : (e.examType || 'بدو استخدام')}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{e.medicalCenter || 'مرکز سلامت شغلی'} {e.doctor ? `- ${e.doctor}` : ''}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold">
                            <span className={e.status === 'fit' ? 'text-emerald-600' : 'text-sky-600'}>
                              {e.status === 'fit' ? 'بلامانع' : 'مشروط'}
                            </span>
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">
                            {e.findings?.bloodPressure || '-'} {e.findings?.bmi ? `(BMI: ${e.findings.bmi})` : ''}
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-400">{e.recommendations || e.description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    هیچ سابقه معاینه دوره‌ای ثبت نشده است.
                  </div>
                )}
              </div>

              {/* Dispensary & Clinic Visits (سوابق مراجعات بهداری و درمان سرپایی) */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span>سوابق مراجعات بهداری و درمانگاه شغلی (ثبت شده در زیرماژول بهداری)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {(dossier.clinicVisits || []).length} مورد مراجعه
                  </span>
                </div>

                {(dossier.clinicVisits && dossier.clinicVisits.length > 0) ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">تاریخ و ساعت مراجعه</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">علت مراجعه و شکایت اصلی</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">تشخیص بالینی</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">علائم حیاتی</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">اقدامات درمانی و داروها</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">سرانجام مراجعه</th>
                        <th className="p-2 text-center">پزشک / بهیار</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.clinicVisits.map((v: any, idx: number) => (
                        <tr key={v.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono">
                            <span className="font-bold">{v.visitDate || '-'}</span>
                            {v.visitTime && <span className="text-[10px] text-slate-400 block">{v.visitTime}</span>}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                            {v.chiefComplaint || v.visitReason || '-'}
                            {v.category === 'OCCUPATIONAL_INJURY' && (
                              <span className="mr-1.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-bold">حادثه شغلی</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {v.diagnosis || '-'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-[11px]">
                            {v.vitalSigns?.bloodPressure ? `BP: ${v.vitalSigns.bloodPressure}` : ''}
                            {v.vitalSigns?.pulseRate ? ` | PR: ${v.vitalSigns.pulseRate}` : ''}
                            {v.vitalSigns?.temperature ? ` | T: ${v.vitalSigns.temperature}°C` : ''}
                            {!v.vitalSigns?.bloodPressure && !v.vitalSigns?.pulseRate && !v.vitalSigns?.temperature && '-'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                            {v.treatment || '-'}
                            {v.medications && Array.isArray(v.medications) && v.medications.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {v.medications.map((m: any, mIdx: number) => (
                                  <span key={mIdx} className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px]">
                                    {m.name || m.drugName} {m.dosage ? `(${m.dosage})` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">
                            {v.disposition === 'DISCHARGED' && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">ترخیص و بازگشت به کار</span>
                            )}
                            {v.disposition === 'REST_RESTRICTION' && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">استراحت پزشکی</span>
                            )}
                            {v.disposition === 'REFERRED_SPECIALIST' && (
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">ارجاع به متخصص</span>
                            )}
                            {v.disposition === 'HOSPITALIZED_DISPATCH' && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 text-[10px] font-bold">اعزام به بیمارستان</span>
                            )}
                            {!['DISCHARGED', 'REST_RESTRICTION', 'REFERRED_SPECIALIST', 'HOSPITALIZED_DISPATCH'].includes(v.disposition) && (
                              <span className="text-slate-500 text-[10px]">{v.disposition || 'ترخیص'}</span>
                            )}
                          </td>
                          <td className="p-2 text-center text-slate-700 dark:text-slate-300 font-medium">
                            {v.physicianName || v.attendingStaff || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    هیچ سابقه مراجعه سرپایی به بهداری برای این فرد ثبت نشده است.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =========================================================================
              TAB 4: TRAINING & QUALIFICATIONS
             ========================================================================= */}
          {activeTab === 'training' && (
            <div className="space-y-6">
              
              <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black">سوابق آموزش، القائات ایمنی و صلاحیت‌های تخصصی</h3>
                    <p className="text-[11px] text-slate-400">مجموع آموزش‌ها: {dossier.summary.totalTrainingHours} ساعت</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowQualificationModal(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ثبت صلاحیت یا گواهینامه</span>
                  </button>
                  <button
                    onClick={() => handleQuickPrint('training')}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-500" />
                    <span>چاپ سوابق آموزشی</span>
                  </button>
                </div>
              </div>

              {/* Special Licenses & Certificates */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-blue-500" />
                  <span>گواهینامه‌های ویژه، صلاحیت‌های اپراتوری و مجوزهای کار خطرناک:</span>
                </h4>

                {dossier.qualifications.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold border-b border-blue-200 dark:border-blue-900">
                        <th className="p-2 border-r border-blue-200 dark:border-blue-900 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-blue-200 dark:border-blue-900">عنوان صلاحیت / گواهینامه</th>
                        <th className="p-2 border-r border-blue-200 dark:border-blue-900">شماره مدرک</th>
                        <th className="p-2 border-r border-blue-200 dark:border-blue-900">مرجع صادرکننده</th>
                        <th className="p-2 border-r border-blue-200 dark:border-blue-900 text-center">تاریخ صدور</th>
                        <th className="p-2 border-r border-blue-200 dark:border-blue-900 text-center">تاریخ انقضا</th>
                        <th className="p-2 text-center">وضعیت قانونی</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.qualifications.map((q, idx) => (
                        <tr key={q.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{q.certificateName}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono text-indigo-600 dark:text-indigo-400">{q.certificateNumber}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{q.issuingAuthority}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{q.issueDate}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{q.expiryDate || 'نامحدود'}</td>
                          <td className="p-2 text-center font-bold">
                            <span className={q.isValid ? 'px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px]' : 'text-rose-600'}>
                              {q.isValid ? 'معتبر' : 'منقضی'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    هیچ گواهینامه ویژه‌ای ثبت نشده است.
                  </div>
                )}
              </div>

              {/* Training Courses Table */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span>دوره‌های آموزشی HSE و عمومی گذرانده‌شده:</span>
                </h4>

                {dossier.trainingCourses.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">عنوان دوره آموزشی</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">کد دوره</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">مدت (ساعت)</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">تاریخ برگزاری</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">مدرس / مرکز</th>
                        <th className="p-2 text-center">وضعیت قبولی</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.trainingCourses.map((c, idx) => (
                        <tr key={c.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{c.courseTitle || c.title || 'دوره آموزشی HSE'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-slate-500">{c.courseCode || '-'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-blue-600">{c.hours || 8}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{c.date || '-'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{c.trainer || 'واحد آموزش HSE مجتمع'}</td>
                          <td className="p-2 text-center font-bold text-emerald-600">تایید شده</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    هیچ دوره‌ای ثبت نشده است.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =========================================================================
              TAB 5: SAFE WORK PERMITS (PTW) & AUDITS
             ========================================================================= */}
          {activeTab === 'permits' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-black text-sm">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>سوابق پروانه‌های کار ایمن (PTW) و ممیزی‌ها</span>
                </div>
                <button
                  onClick={() => handleQuickPrint('permits')}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ سوابق PTW</span>
                </button>
              </div>

              {dossier.workPermits.length > 0 ? (
                <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">شماره سریال پروانه</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">نوع پروانه</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">نقش پرسنل</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">واحد و موقعیت</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">تاریخ صدور</th>
                      <th className="p-2 text-center">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.workPermits.map((p, idx) => (
                      <tr key={p.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-indigo-400">{p.serialNumber || p.id}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">{p.permitType || 'پروانه کار ایمن'}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">مجری / متقاضی کار</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700">{p.department || p.location || '-'}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{p.createdDate || '-'}</td>
                        <td className="p-2 text-center font-bold">
                          <span className={p.status === 'Closed' || p.status === 'Finished' ? 'text-slate-500' : 'text-emerald-600'}>
                            {p.status === 'Closed' || p.status === 'Finished' ? 'بسته شده' : 'فعال و جاری'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  هیچ پروانه کاری برای این پرسنل ثبت نشده است.
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 6: INCIDENTS & BBS
             ========================================================================= */}
          {activeTab === 'incidents' && (
            <div className="space-y-6">
              
              {/* Incidents Table */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>سوابق رویدادها، حوادث، شبه‌حوادث و اقدامات اصلاحی (CAPA):</span>
                  </h4>
                  <button
                    onClick={() => handleQuickPrint('incidents')}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>چاپ سوابق رویدادها</span>
                  </button>
                </div>

                {dossier.incidents.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">شماره گزارش</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">عنوان رویداد</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">دسته‌بندی</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">نقش پرسنل</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">تاریخ وقوع</th>
                        <th className="p-2 text-center">اقدام اصلاحی</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.incidents.map((inc, idx) => (
                        <tr key={inc.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-rose-700">{inc.reportNumber || inc.id}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{inc.title}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">{inc.categoryFa || inc.category}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold">
                            {inc.reporterPersonnelCode === selectedPersonnel.personnelCode ? 'گزارش‌دهنده' : 'فرد درگیر'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{inc.eventDate || (inc as any).date}</td>
                          <td className="p-2 text-center font-bold text-emerald-600">اقدامات انجام شد</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                      فاقد هرگونه سابقه حادثه، شبه‌حادثه یا آسیب شغلی (پرونده پاک)
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 block">
                      هیچ رویداد نامطلوبی برای این پرسنل گزارش نشده است.
                    </span>
                  </div>
                )}
              </div>

              {/* BBS Table */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>مشاهدات ایمنی بر پایه رفتار (Behavior-Based Safety - BBS):</span>
                </h4>

                {dossier.bbsObservations.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 font-bold border-b border-indigo-200 dark:border-indigo-900">
                        <th className="p-2 border-r border-indigo-200 dark:border-indigo-900 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-indigo-200 dark:border-indigo-900">تاریخ</th>
                        <th className="p-2 border-r border-indigo-200 dark:border-indigo-900">ناظر / افسر ایمنی</th>
                        <th className="p-2 border-r border-indigo-200 dark:border-indigo-900 text-center">نوع رفتار</th>
                        <th className="p-2 border-r border-indigo-200 dark:border-indigo-900">محل مشاهده</th>
                        <th className="p-2">شرح مشاهده و بازخورد داده شده</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.bbsObservations.map((b, idx) => (
                        <tr key={b.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono">{b.observationDate}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">{b.observerName}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold">
                            <span className={b.behaviorType === 'SAFE' ? 'px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px]' : 'text-rose-600'}>
                              {b.behaviorType === 'SAFE' ? 'رفتار ایمن و شایسته' : 'رفتار پرخطر'}
                            </span>
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">{b.unit} ({b.workArea})</td>
                          <td className="p-2 text-slate-700 dark:text-slate-300">{b.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    مشاهده رفتاری برای این پرسنل ثبت نشده است.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =========================================================================
              TAB: CAPA & NON-CONFORMANCES (اقدامات اصلاحی و پیشگیرانه)
             ========================================================================= */}
          {activeTab === 'capa' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                  <CheckSquare className="w-4 h-4 text-indigo-500" />
                  <span>اقدامات اصلاحی و پیشگیرانه سازمانی (CAPA) و پیگیری عدم انطباق‌ها</span>
                </div>
                <button
                  onClick={() => handleQuickPrint('capa')}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ سوابق CAPA</span>
                </button>
              </div>

              {dossier.nonConformances && dossier.nonConformances.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-28 text-center">کد رهگیری</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">عنوان و شرح عدم انطباق</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-28 text-center">ماژول مبدا</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-24 text-center">سررسید اقدام</th>
                        <th className="p-2 text-center w-28">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.nonConformances.map((nc, idx) => (
                        <tr key={nc.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-blue-600 dark:text-blue-400 text-center">
                            {nc.code || `NC-${idx + 1}`}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-slate-900 dark:text-white block">{nc.title || nc.description}</span>
                            {nc.actionPlan && <span className="text-[10px] text-slate-500 block mt-0.5">طرح اقدام: {nc.actionPlan}</span>}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                              {nc.sourceModule || 'HSE-Core'}
                            </span>
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-slate-600 dark:text-slate-400">
                            {nc.dueDate || '-'}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              nc.status === 'Closed' || nc.status === 'Completed'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            }`}>
                              {nc.status === 'Closed' || nc.status === 'Completed' ? 'تکمیل و بسته شده' : 'باز / در جریان پیگیری'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  هیچ اقدام اصلاحی یا عدم انطباقی به نام این پرسنل ثبت نشده است (سابقه کاملاً منطبق).
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 7: RISK ASSESSMENTS & INSPECTIONS
             ========================================================================= */}
          {activeTab === 'risks' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-black text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>مشارکت در ارزیابی‌های ریسک (JSA/FMEA/FTA/HHA) و بازرسی‌ها</span>
                </div>
                <button
                  onClick={() => handleQuickPrint('risks')}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ سوابق ارزیابی ریسک</span>
                </button>
              </div>

              {dossier.riskAssessments.length > 0 || dossier.safetyInspections.length > 0 ? (
                <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">کد سند</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">عنوان ارزیابی / چک‌لیست</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">متدولوژی</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">نقش پرسنل</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">تاریخ</th>
                      <th className="p-2 text-center">سطح ریسک / امتیاز</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.riskAssessments.map((a, idx) => (
                      <tr key={a.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white">{a.code}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">{a.title}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-indigo-600">{a.method}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold">عضو تیم ارزیابی / ارزیاب</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{a.assessmentDate}</td>
                        <td className="p-2 text-center font-bold text-emerald-600">{a.overallRiskLevel || 'قابل قبول'}</td>
                      </tr>
                    ))}
                    {dossier.safetyInspections.map((insp, idx) => (
                      <tr key={insp.id || idx} className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{dossier.riskAssessments.length + idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono text-slate-700 dark:text-slate-300">{insp.id}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">{insp.title || insp.checklistTypeNameFa}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold text-emerald-600">بازرسی عملیاتی</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold">بازرس مسئول</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{insp.inspectionDate}</td>
                        <td className="p-2 text-center font-mono font-bold text-emerald-600">{insp.scorePercent || 100}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  سابقه‌ای در ارزیابی ریسک یا بازرسی‌های ایمنی ثبت نشده است.
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB: HEALTH, ENVIRONMENTAL & 5S INSPECTIONS
             ========================================================================= */}
          {activeTab === 'inspections' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                  <ClipboardCheck className="w-4 h-4 text-teal-500" />
                  <span>بازرسی‌های تخصصی بهداشت حرفه‌ای، محیط زیست و ممیزی‌های نظام 5S</span>
                </div>
                <button
                  onClick={() => handleQuickPrint('inspections')}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ سوابق بازرسی‌ها</span>
                </button>
              </div>

              {[...(dossier.healthEnvInspections || []), ...(dossier.fiveSInspections || [])].length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-36 text-center">نوع بازرسی</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">حوزه / دپارتمان بازرسی‌شده</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-32 text-center">نقش / مسئول</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-24 text-center">تاریخ</th>
                        <th className="p-2 text-center w-28">امتیاز / انطباق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(dossier.healthEnvInspections || []), ...(dossier.fiveSInspections || [])].map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-bold text-teal-700 dark:text-teal-400">
                            {item.zoneName || item.checklistTitle ? 'بهداشت و محیط زیست' : 'ممیزی نظام 5S'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">
                            {item.department || item.unit || item.area || 'واحد عملیاتی'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">
                            {item.inspectorName || item.auditorName || 'بازرس ثبت‌شده'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">
                            {item.date || item.inspectionDate || '-'}
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-emerald-600">
                            {item.score !== undefined ? `${item.score}%` : 'تایید نهایی'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  سابقه‌ای از بازرسی‌های 5S و بهداشت/محیط زیست برای این پرسنل ثبت نشده است.
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB: REFERRALS & WORKFLOW SIGNATURES
             ========================================================================= */}
          {activeTab === 'referrals' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-black text-sm text-slate-900 dark:text-white">
                  <Send className="w-4 h-4 text-sky-500" />
                  <span>گردش اسناد، ارجاعات اداری و امضاهای دیجیتال پرسنل (کارتابل یکپارچه)</span>
                </div>
                <button
                  onClick={() => handleQuickPrint('referrals')}
                  className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>چاپ گردش اسناد</span>
                </button>
              </div>

              {dossier.referrals && dossier.referrals.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">عنوان و موضوع سند</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-28 text-center">نوع مدرک</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-32 text-center">فرستنده</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-24 text-center">تاریخ</th>
                        <th className="p-2 text-center w-28">وضعیت گردش</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.referrals.map((ref, idx) => (
                        <tr key={ref.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-slate-900 dark:text-white block">{ref.documentTitle || ref.subject || 'سند سازمانی'}</span>
                            {ref.notes && <span className="text-[10px] text-slate-500 block mt-0.5">{ref.notes}</span>}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-[10px]">
                            {ref.documentType || 'سند HSE'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">
                            {ref.senderName || 'سیستم HSE'}
                          </td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-slate-600 dark:text-slate-400">
                            {ref.createdAt ? ref.createdAt.split('T')[0] : '-'}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ref.status === 'Completed' || ref.status === 'Signed' || ref.status === 'Approved'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-sky-500/10 text-sky-600 border border-sky-500/20'
                            }`}>
                              {ref.status === 'Completed' || ref.status === 'Signed' || ref.status === 'Approved' ? 'امضا و تایید شده' : 'در دست بررسی'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  سابقه‌ای از گردش مدرک یا امضای ارجاعی در کارتابل این پرسنل ثبت نشده است.
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 8: WARNINGS & DISCIPLINARY
             ========================================================================= */}
          {activeTab === 'warnings' && (
            <div className="space-y-6">
              
              {/* Warnings Table Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h4 className="text-xs font-black text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>سوابق اخطارهای انضباطی ایمنی و تذکرات ثبت‌شده برای پرسنل:</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      مجموع اخطارها: <strong className="text-rose-600 font-bold">{dossier.warnings.length}</strong>
                    </span>
                    <button
                      onClick={() => handleQuickPrint('warnings')}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-500" />
                      <span>چاپ اخطارها</span>
                    </button>
                  </div>
                </div>

                {dossier.warnings.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">کد پیگیری</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">علت و شرح تخلف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">تاریخ</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">امتیاز منفی</th>
                        <th className="p-2 text-center">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.warnings.map((w, idx) => (
                        <tr key={w.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono font-bold text-rose-700">{w.number || w.id}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold">{w.reason || 'تذکر انضباطی ایمنی'}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{w.year}/{w.month}/{w.day}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono font-bold text-rose-700">5</td>
                          <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">{w.type === 'فردی' ? 'اخطار فردی' : 'اخطار واحدی'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-8 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                      فاقد هرگونه اخطار، تذکر کتبی یا تخلف ایمنی (انضباط ۱۰۰٪)
                    </span>
                    <span className="text-[11px] text-emerald-600 mt-1 block">
                      عملکرد پرسنل منطبق با استانداردها و مقررات ایمنی شرکت می‌باشد.
                    </span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =========================================================================
              TAB 9: PPE ISSUANCES & EQUIPMENT
             ========================================================================= */}
          {activeTab === 'ppe' && (
            <div className="space-y-6">
              
              {/* PPE Issuance Card */}
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <HardHat className="w-4 h-4 text-blue-500" />
                    <span>تجهیزات حفاظت فردی تحویل‌شده (PPE Delivery & Tracking):</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">
                      مجموع اقلام: <strong className="text-blue-600 font-bold">{dossier.ppeIssuances.length}</strong>
                    </span>
                    <button
                      onClick={() => handleQuickPrint('ppe')}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-500" />
                      <span>چاپ سوابق PPE</span>
                    </button>
                  </div>
                </div>

                {dossier.ppeIssuances.length > 0 ? (
                  <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700">نام تجهیز</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">تعداد</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">تاریخ تحویل</th>
                        <th className="p-2 border-r border-slate-200 dark:border-slate-700 text-center">سررسید تعویض</th>
                        <th className="p-2 text-center">وضعیت تحویل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossier.ppeIssuances.map((item, idx) => (
                        <tr key={item.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{item.ppeItemName}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono font-bold">{item.quantity || 1}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{item.issueDate}</td>
                          <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{item.expiryDate || '-'}</td>
                          <td className="p-2 text-center font-bold text-emerald-600">تحویل شد</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                ) : (
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                    هیچ سابقه‌ای از تحویل تجهیزات حفاظت فردی برای این پرسنل ثبت نشده است.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* =========================================================================
              TAB 9: ATTACHMENTS & DOCUMENTS
             ========================================================================= */}
          {activeTab === 'attachments' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-black text-sm">
                  <Paperclip className="w-4 h-4 text-blue-500" />
                  <span>اسناد، مدارک و پیوست‌های دیجیتال پرونده</span>
                </div>
                <button
                  onClick={() => setShowAttachmentsModal(true)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>بارگذاری مدرک جدید</span>
                </button>
              </div>

              {dossier.attachments.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {dossier.attachments.map((att) => (
                    <div key={att.id} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{att.fileName}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{att.uploadDate} | {Math.round(att.fileSize / 1024)} KB</span>
                        {att.description && <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2">{att.description}</p>}
                      </div>
                      {att.dataUrl && (
                        <a
                          href={att.dataUrl}
                          download={att.fileName}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>دانلود فایل</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  هیچ سند یا مدرک پیوستی برای این پرسنل بارگذاری نشده است.
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 10: AUDIT LOGS & SECURITY
             ========================================================================= */}
          {activeTab === 'audit_logs' && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2 font-black text-sm">
                  <History className="w-4 h-4 text-indigo-500" />
                  <span>لاگ امنیتی و سوابق دسترسی به پرونده پرسنلی (Audit Trail)</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">{dossier.auditLogs.length} ثبت لاگ</span>
              </div>

              {dossier.auditLogs.length > 0 ? (
                <div className="overflow-x-auto w-full"><table className="w-full text-right border-collapse border border-slate-200 dark:border-slate-800 text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700 w-10 text-center">ردیف</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">زمان دقیق</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">کاربر عامل</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">نوع عملیات</th>
                      <th className="p-2 border-r border-slate-200 dark:border-slate-700">شرح اقدام</th>
                      <th className="p-2 text-center">نتیجه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dossier.auditLogs.map((l, idx) => (
                      <tr key={l.id || idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-mono text-slate-500">{l.tsFa || l.ts}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">{l.username}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 font-bold text-indigo-600 dark:text-indigo-400">{l.actionType || 'VIEW'}</td>
                        <td className="p-2 border-r border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">{l.action}</td>
                        <td className="p-2 text-center font-bold text-emerald-600">{l.result || 'موفق'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400">
                  لاگ امنیتی مستقیمی ثبت نشده است.
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner border border-blue-100 dark:border-blue-900/50">
            <UserSearch className="w-8 h-8" />
          </div>
          
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              {hasSearchFilterActive && filteredPersonnelList.length > 0
                ? isFa
                  ? `تعداد ${filteredPersonnelList.length} پرسنل مطابق با جستجو یافت شد`
                  : `${filteredPersonnelList.length} personnel found`
                : hasSearchFilterActive && filteredPersonnelList.length === 0
                ? isFa
                  ? 'پرسنلی با این مشخصات یافت نشد'
                  : 'No personnel found'
                : isFa
                ? 'هیچ پرسنلی انتخاب نشده است'
                : 'No personnel selected'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {hasSearchFilterActive && filteredPersonnelList.length > 0
                ? isFa
                  ? 'لطفاً برای نمایش شناسنامه و سوابق جامع پرونده، روی نام پرسنل مورد نظر در نوار نتایج جستجو کلیک فرمایید.'
                  : 'Please click on the personnel name in the search results bar above to load their dossier.'
                : hasSearchFilterActive && filteredPersonnelList.length === 0
                ? isFa
                  ? 'لطفاً عبارت جستجو یا فیلترهای واحد/سمت را تغییر دهید.'
                  : 'Please adjust your search query or filters.'
                : isFa
                ? 'جهت مشاهده شناسنامه، وضعیت سلامت و سوابق پرونده، ابتدا نام یا کد پرسنلی را در کادر بالا جستجو نموده و سپس روی نام فرد کلیک فرمایید.'
                : 'To view personnel records, search above and click on the desired personnel name.'}
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
         ========================================================================= */}
      
      {/* 1. Formal Dossier Printable A4 Document Modal */}
      {showPrintModal && dossier && (
        <PersonnelDossierPrintModal
          dossier={dossier}
          isFa={isFa}
          currentUser={currentUser}
          defaultSection={printDefaultSection}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* 2. Attachments & Scans Manager Modal */}
      {showAttachmentsModal && selectedPersonnel && (
        <PersonnelDossierAttachmentsModal
          personnelCode={selectedPersonnel.personnelCode || selectedPersonnel.effectiveCode}
          personnelName={selectedPersonnel.fullName || `${selectedPersonnel.firstName} ${selectedPersonnel.lastName}`}
          isFa={isFa}
          currentUser={currentUser}
          existingAttachments={dossier?.attachments || []}
          onClose={() => setShowAttachmentsModal(false)}
          onUpdated={() => setDataVersion(v => v + 1)}
        />
      )}

      {/* 3. Occupational Medical Restrictions Modal */}
      {showRestrictionModal && selectedPersonnel && (
        <PersonnelRestrictionModal
          personnelCode={selectedPersonnel.personnelCode || selectedPersonnel.effectiveCode}
          personnelName={selectedPersonnel.fullName || `${selectedPersonnel.firstName} ${selectedPersonnel.lastName}`}
          isFa={isFa}
          onClose={() => setShowRestrictionModal(false)}
          onSaved={() => setDataVersion(v => v + 1)}
        />
      )}

      {/* 4. Professional Qualifications & Certifications Modal */}
      {showQualificationModal && selectedPersonnel && (
        <PersonnelQualificationModal
          personnelCode={selectedPersonnel.personnelCode || selectedPersonnel.effectiveCode}
          personnelName={selectedPersonnel.fullName || `${selectedPersonnel.firstName} ${selectedPersonnel.lastName}`}
          isFa={isFa}
          onClose={() => setShowQualificationModal(false)}
          onSaved={() => setDataVersion(v => v + 1)}
        />
      )}

    </div>
  );
}
