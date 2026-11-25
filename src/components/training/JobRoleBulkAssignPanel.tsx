import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Clock,
  Search,
  CheckSquare,
  Square,
  ShieldAlert,
  BookOpen,
  UserCheck,
  Filter,
  Send,
  History,
  Briefcase,
  Building2,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import SearchableSelect from '../SearchableSelect';
import PersianDatePicker from '../common/PersianDatePicker';
import PersianTimePicker from '../common/PersianTimePicker';
import DualDateBadge from '../common/DualDateBadge';
import {
  ComplexPersonnel,
  getComplexPersonnelList,
  fetchCentralPersonnelList,
} from '../../utils/personnelHelper';
import {
  cleanPersonnelCode,
  normalizeForMatching,
  normalizeDigits,
} from '../../utils/textNormalization';
import { apiDb } from '../../services/apiDatabaseClient';
import type {
  TrainingCourseDef,
  TrainingCourseRecord,
  TrainingNeed,
  TrainingCalendarEvent,
  TrainingBulkAssignmentBatch,
  TrainingBulkAssignResponse,
} from '../../types/training';

interface JobRoleBulkAssignPanelProps {
  isFa: boolean;
  currentUser: any;
  units: string[];
  jobTitles: string[];
  courseDefs: TrainingCourseDef[];
  trainingNeeds: TrainingNeed[];
  courses: TrainingCourseRecord[];
  onSaveTrainingNeed: (unit: string, jobTitle: string, courseCodes: string[]) => void;
  onDeleteTrainingNeed: (id: string) => void;
  onAssignmentCompleted: (
    updatedCourses: TrainingCourseRecord[],
    updatedCalendarEvents: TrainingCalendarEvent[]
  ) => void;
}

function normalizeCodeKey(code?: string): string {
  return cleanPersonnelCode(normalizeDigits(String(code || ''))).toLowerCase();
}

function normalizeCourseCode(code?: string): string {
  return normalizeDigits(String(code || '')).trim().toUpperCase();
}

function getPersonnelJobTitle(p: ComplexPersonnel): string {
  return String(p.jobTitle || p.position || '').trim();
}

function getPersonnelUnit(p: ComplexPersonnel): string {
  return String(p.unit || p.department || '').trim();
}

function getPersonnelStatus(p: ComplexPersonnel): 'active' | 'inactive' {
  return p.status === 'inactive' ? 'inactive' : 'active';
}

const OVERRIDE_ALLOWED_ROLES = new Set([
  'ADMIN',
  'ADMINISTRATOR',
  'SUPER_ADMIN',
  'HSE_MANAGER',
  'SAFETY_OFFICER',
  'EXECUTIVE_MANAGER',
  'EXECUTIVEMANAGER',
  'TRAINING_OFFICER',
]);

function checkCanOverride(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (OVERRIDE_ALLOWED_ROLES.has(role)) return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return perms.some((p: string) => {
    const n = String(p || '').toLowerCase();
    return n === '*' || n === 'training:*' || n === 'training:override' || n === 'training:update';
  });
}

const OVERRIDE_REASON_PRESETS_FA = [
  'تمدید دوره‌ای و اعتبارسنجی مجدد گواهینامه',
  'آموزش مجدد پس از حادثه یا عدم انطباق',
  'بازآموزی الزامات جدید ایمنی و HSE',
];

export default function JobRoleBulkAssignPanel({
  isFa,
  currentUser,
  units,
  jobTitles,
  courseDefs,
  trainingNeeds,
  courses,
  onSaveTrainingNeed,
  onDeleteTrainingNeed,
  onAssignmentCompleted,
}: JobRoleBulkAssignPanelProps) {
  const topWorkspaceRef = useRef<HTMLDivElement | null>(null);

  // Master personnel state (sourced strictly from existing personnel repository, including inactive for status filtering)
  const [allPersonnel, setAllPersonnel] = useState<ComplexPersonnel[]>(() =>
    getComplexPersonnelList({ includeInactive: true })
  );
  const [isHydratingPersonnel, setIsHydratingPersonnel] = useState(false);

  // Unified Selection & Filter State (Single source for both Needs Matrix & Bulk Assignment)
  const [selectedJobTitle, setSelectedJobTitle] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [selectedPersonnelCodes, setSelectedPersonnelCodes] = useState<string[]>([]);

  // Course & Schedule State
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [linkToCalendar, setLinkToCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState('');
  const [calendarTime, setCalendarTime] = useState('');
  const [alsoSaveToNeedsMatrix, setAlsoSaveToNeedsMatrix] = useState(true);

  // Duplicate Override State
  const [allowRenewalOverride, setAllowRenewalOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  // Execution & Results State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<TrainingBulkAssignResponse | null>(null);
  const [resultTab, setResultTab] = useState<'all' | 'succeeded' | 'duplicate' | 'failed'>('all');

  // Unified Bottom Records Switcher (Needs Matrix vs Bulk Assignment Audit History)
  const [recordsView, setRecordsView] = useState<'matrix' | 'history'>('matrix');
  const [bulkHistory, setBulkHistory] = useState<TrainingBulkAssignmentBatch[]>([]);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const canOverride = useMemo(() => checkCanOverride(currentUser), [currentUser]);

  // Load personnel from central DB if cache is empty & keep synchronized
  const syncPersonnelList = useCallback(async (force = false) => {
    const cached = getComplexPersonnelList({ includeInactive: true });
    if (cached.length > 0 && !force) {
      setAllPersonnel(cached);
      return;
    }
    setIsHydratingPersonnel(true);
    try {
      await fetchCentralPersonnelList(force);
      setAllPersonnel(getComplexPersonnelList({ includeInactive: true }));
    } catch (err) {
      console.warn('[TrainingNeedsWorkspace] Personnel sync warning:', err);
    } finally {
      setIsHydratingPersonnel(false);
    }
  }, []);

  const loadBulkHistory = useCallback(async () => {
    try {
      const list = await apiDb.getTrainingBulkAssignments();
      setBulkHistory(Array.isArray(list) ? list : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    syncPersonnelList(false);
    loadBulkHistory();

    const onPersonnelUpdate = () => setAllPersonnel(getComplexPersonnelList({ includeInactive: true }));
    const onTrainingUpdate = () => loadBulkHistory();

    window.addEventListener('hse_personnel_updated', onPersonnelUpdate);
    window.addEventListener('hse_org_nodes_updated', onPersonnelUpdate);
    window.addEventListener('hse_training_updated', onTrainingUpdate);
    return () => {
      window.removeEventListener('hse_personnel_updated', onPersonnelUpdate);
      window.removeEventListener('hse_org_nodes_updated', onPersonnelUpdate);
      window.removeEventListener('hse_training_updated', onTrainingUpdate);
    };
  }, [syncPersonnelList, loadBulkHistory]);

  // Unified Job Titles list: existing org jobTitles + distinct jobTitles from master personnel
  const unifiedJobTitles = useMemo(() => {
    const normMap = new Map<string, string>();
    const countMap = new Map<string, number>();

    allPersonnel.forEach((p) => {
      const jt = getPersonnelJobTitle(p);
      if (!jt) return;
      const norm = normalizeForMatching(jt);
      if (!norm) return;
      if (!normMap.has(norm)) normMap.set(norm, jt);
      countMap.set(norm, (countMap.get(norm) || 0) + 1);
    });

    jobTitles.forEach((jt) => {
      const trimmed = String(jt || '').trim();
      if (!trimmed) return;
      const norm = normalizeForMatching(trimmed);
      if (norm && !normMap.has(norm)) {
        normMap.set(norm, trimmed);
      }
    });

    return Array.from(normMap.entries())
      .map(([norm, label]) => ({
        label,
        norm,
        count: countMap.get(norm) || 0,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fa'));
  }, [allPersonnel, jobTitles]);

  const jobTitleOptions = useMemo(() => unifiedJobTitles.map((j) => j.label), [unifiedJobTitles]);

  // All personnel matching the selected job title (before unit / employment status filters)
  const personnelByJobTitle = useMemo(() => {
    if (!selectedJobTitle.trim()) return [];
    const targetNorm = normalizeForMatching(selectedJobTitle);
    return allPersonnel.filter((p) => normalizeForMatching(getPersonnelJobTitle(p)) === targetNorm);
  }, [allPersonnel, selectedJobTitle]);

  // Available units (combining org units + units of matched personnel)
  const availableUnitOptions = useMemo(() => {
    const map = new Map<string, string>();
    personnelByJobTitle.forEach((p) => {
      const u = getPersonnelUnit(p);
      if (u) {
        const n = normalizeForMatching(u);
        if (!map.has(n)) map.set(n, u);
      }
    });
    units.forEach((u) => {
      const t = String(u || '').trim();
      if (t) {
        const n = normalizeForMatching(t);
        if (!map.has(n)) map.set(n, t);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [personnelByJobTitle, units]);

  // Counts by employment status for the currently selected job title (+ unit filter)
  const statusCounts = useMemo(() => {
    const targetUnitNorm = unitFilter ? normalizeForMatching(unitFilter) : '';
    let all = 0;
    let active = 0;
    let inactive = 0;
    personnelByJobTitle.forEach((p) => {
      if (targetUnitNorm && normalizeForMatching(getPersonnelUnit(p)) !== targetUnitNorm) return;
      all++;
      if (getPersonnelStatus(p) === 'inactive') inactive++;
      else active++;
    });
    return { all, active, inactive };
  }, [personnelByJobTitle, unitFilter]);

  // Filtered eligible personnel list
  const eligiblePersonnel = useMemo(() => {
    const targetUnitNorm = unitFilter ? normalizeForMatching(unitFilter) : '';
    const q = normalizeForMatching(personnelSearch);
    return personnelByJobTitle.filter((p) => {
      if (targetUnitNorm && normalizeForMatching(getPersonnelUnit(p)) !== targetUnitNorm) {
        return false;
      }
      if (employmentStatusFilter !== 'all' && getPersonnelStatus(p) !== employmentStatusFilter) {
        return false;
      }
      if (q) {
        const hay = normalizeForMatching(
          `${p.fullName} ${p.firstName} ${p.lastName} ${p.personnelCode} ${p.effectiveCode} ${getPersonnelUnit(p)}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [personnelByJobTitle, unitFilter, employmentStatusFilter, personnelSearch]);

  // Auto-select all matching eligible personnel whenever jobTitle / unitFilter / statusFilter changes
  useEffect(() => {
    if (!selectedJobTitle) {
      setSelectedPersonnelCodes([]);
      return;
    }
    const targetUnitNorm = unitFilter ? normalizeForMatching(unitFilter) : '';
    const autoCodes = personnelByJobTitle
      .filter((p) => {
        if (targetUnitNorm && normalizeForMatching(getPersonnelUnit(p)) !== targetUnitNorm) return false;
        if (employmentStatusFilter !== 'all' && getPersonnelStatus(p) !== employmentStatusFilter) return false;
        return true;
      })
      .map((p) => cleanPersonnelCode(normalizeDigits(p.effectiveCode || p.personnelCode)))
      .filter(Boolean);
    setSelectedPersonnelCodes(Array.from(new Set(autoCodes)));
  }, [selectedJobTitle, unitFilter, employmentStatusFilter, personnelByJobTitle]);

  // Index existing course records for instant live duplicate detection preview
  const existingRecordIndex = useMemo(() => {
    const map = new Map<
      string,
      { hasActive: boolean; hasCompleted: boolean; date?: string; dueDate?: string }
    >();
    courses.forEach((rec) => {
      const pk = normalizeCodeKey(rec.personnelCode);
      const ck = normalizeCourseCode(rec.courseCode);
      if (!pk || !ck) return;
      const key = `${pk}::${ck}`;
      const prev = map.get(key) || { hasActive: false, hasCompleted: false };
      if (rec.status === 'assigned' || rec.status === 'in_progress') {
        prev.hasActive = true;
        if (rec.dueDate) prev.dueDate = rec.dueDate;
      } else if (!rec.status || rec.status === 'completed') {
        prev.hasCompleted = true;
        if (rec.date) prev.date = rec.date;
      }
      map.set(key, prev);
    });
    return map;
  }, [courses]);

  // Check conflict status for a single person across selected courses
  const getPersonConflictSummary = useCallback(
    (pCode: string) => {
      const pk = normalizeCodeKey(pCode);
      const duplicateCourses: Array<{ code: string; type: 'active' | 'completed'; date?: string }> = [];
      let cleanCount = 0;

      selectedCourseCodes.forEach((code) => {
        const ck = normalizeCourseCode(code);
        const info = existingRecordIndex.get(`${pk}::${ck}`);
        if (info && (info.hasActive || info.hasCompleted)) {
          duplicateCourses.push({
            code: ck,
            type: info.hasActive ? 'active' : 'completed',
            date: info.hasActive ? info.dueDate : info.date,
          });
        } else {
          cleanCount++;
        }
      });

      return { duplicateCourses, cleanCount, totalSelected: selectedCourseCodes.length };
    },
    [selectedCourseCodes, existingRecordIndex]
  );

  // Live pre-flight counters for selected personnel x selected courses
  const preflightStats = useMemo(() => {
    let totalPairs = 0;
    let newPairs = 0;
    let duplicatePairs = 0;

    selectedPersonnelCodes.forEach((code) => {
      const info = getPersonConflictSummary(code);
      totalPairs += info.totalSelected;
      newPairs += info.cleanCount;
      duplicatePairs += info.duplicateCourses.length;
    });

    return { totalPairs, newPairs, duplicatePairs };
  }, [selectedPersonnelCodes, getPersonConflictSummary]);

  // Mandatory courses defined in Needs Matrix for this jobTitle (+ unitFilter)
  const needsMatrixCoursesForRole = useMemo(() => {
    if (!selectedJobTitle) return [];
    const jtNorm = normalizeForMatching(selectedJobTitle);
    const uNorm = unitFilter ? normalizeForMatching(unitFilter) : '';
    const codes = new Set<string>();
    trainingNeeds.forEach((n) => {
      if (normalizeForMatching(n.jobTitle) !== jtNorm) return;
      if (uNorm && normalizeForMatching(n.unit) !== uNorm && n.unit !== 'همه واحدها') return;
      (n.courseCodes || []).forEach((c) => codes.add(c));
    });
    if (codes.size === 0 && uNorm) {
      trainingNeeds.forEach((n) => {
        if (normalizeForMatching(n.jobTitle) === jtNorm) {
          (n.courseCodes || []).forEach((c) => codes.add(c));
        }
      });
    }
    return Array.from(codes);
  }, [selectedJobTitle, unitFilter, trainingNeeds]);

  // Filtered course catalog
  const filteredCourseDefs = useMemo(() => {
    const q = normalizeForMatching(courseSearch);
    if (!q) return courseDefs;
    return courseDefs.filter((c) =>
      normalizeForMatching(`${c.code} ${c.title}`).includes(q)
    );
  }, [courseDefs, courseSearch]);

  const togglePersonnel = (code: string) => {
    setSelectedPersonnelCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const selectAllVisible = () => {
    const visibleCodes = eligiblePersonnel
      .map((p) => cleanPersonnelCode(normalizeDigits(p.effectiveCode || p.personnelCode)))
      .filter(Boolean);
    setSelectedPersonnelCodes((prev) => Array.from(new Set([...prev, ...visibleCodes])));
  };

  const clearSelection = () => {
    setSelectedPersonnelCodes([]);
  };

  const selectOnlyNonDuplicateVisible = () => {
    if (selectedCourseCodes.length === 0) {
      selectAllVisible();
      return;
    }
    const cleanCodes = eligiblePersonnel
      .map((p) => cleanPersonnelCode(normalizeDigits(p.effectiveCode || p.personnelCode)))
      .filter((code) => code && getPersonConflictSummary(code).cleanCount > 0);
    setSelectedPersonnelCodes(Array.from(new Set(cleanCodes)));
  };

  const toggleCourse = (code: string) => {
    setSelectedCourseCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const loadNeedsMatrixCourses = () => {
    if (needsMatrixCoursesForRole.length === 0) return;
    setSelectedCourseCodes(Array.from(new Set([...selectedCourseCodes, ...needsMatrixCoursesForRole])));
    toast.success(
      isFa
        ? `${needsMatrixCoursesForRole.length} دوره از ماتریس نیازسنجی انتخاب شد.`
        : `${needsMatrixCoursesForRole.length} courses loaded from Needs Matrix.`
    );
  };

  // Load an existing Needs Matrix row into the single unified form above
  const loadNeedRowIntoWorkspace = (need: TrainingNeed) => {
    setSelectedJobTitle(need.jobTitle);
    setUnitFilter(need.unit === 'همه واحدها' || need.unit === 'All Units' ? '' : need.unit);
    setSelectedCourseCodes(Array.from(new Set(need.courseCodes || [])));
    setLastResult(null);
    topWorkspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Save current unified selection into the Needs Matrix (hse_training_needs)
  const handleSaveToNeedsMatrix = () => {
    if (!selectedJobTitle.trim()) {
      toast.error(isFa ? 'ابتدا رده شغلی / سمت سازمانی را انتخاب کنید.' : 'Please select a job title first.');
      return;
    }
    if (selectedCourseCodes.length === 0) {
      toast.error(isFa ? 'حداقل یک دوره آموزشی انتخاب کنید.' : 'Select at least one course.');
      return;
    }
    const targetUnit = unitFilter.trim() || (isFa ? 'همه واحدها' : 'All Units');
    onSaveTrainingNeed(targetUnit, selectedJobTitle.trim(), selectedCourseCodes);
    setRecordsView('matrix');
    toast.success(
      isFa
        ? `نیازسنجی سمت «${selectedJobTitle}» (${targetUnit}) در ماتریس ثبت شد.`
        : `Saved training needs for ${selectedJobTitle} (${targetUnit}).`
    );
  };

  // Execute bulk assignment (and optionally sync into Needs Matrix)
  const handleBulkAssignSubmit = async () => {
    if (!selectedJobTitle) {
      toast.error(isFa ? 'لطفاً ابتدا یک رده شغلی یا سمت سازمانی انتخاب کنید.' : 'Please select a job title first.');
      return;
    }
    if (selectedPersonnelCodes.length === 0) {
      toast.error(isFa ? 'حداقل یک نفر از کارکنان واجد شرایط را انتخاب کنید.' : 'Select at least one employee.');
      return;
    }
    if (selectedCourseCodes.length === 0) {
      toast.error(isFa ? 'حداقل یک دوره آموزشی انتخاب کنید.' : 'Select at least one course.');
      return;
    }
    if (linkToCalendar && !calendarDate) {
      toast.error(
        isFa
          ? 'برای اتصال دوره به تقویم آموزشی، انتخاب تاریخ برگزاری الزامی است.'
          : 'Select a scheduled date to link to Training Calendar.'
      );
      return;
    }
    if (allowRenewalOverride && overrideReason.trim().length < 5) {
      toast.error(
        isFa
          ? 'برای تمدید یا آموزش مجدد، ثبت دلیل (حداقل ۵ کاراکتر) الزامی است.'
          : 'A reason (min 5 chars) is required for renewal/retraining override.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response: TrainingBulkAssignResponse = await apiDb.bulkAssignTrainingByJobTitle({
        jobTitle: selectedJobTitle,
        unitFilter: unitFilter || undefined,
        employmentStatusFilter,
        personnelCodes: selectedPersonnelCodes,
        courseCodes: selectedCourseCodes,
        dueDate: dueDate || undefined,
        linkToCalendar,
        calendarDate: linkToCalendar ? calendarDate : undefined,
        calendarTime: linkToCalendar ? calendarTime : undefined,
        allowRenewalOverride,
        overrideReason: allowRenewalOverride ? overrideReason.trim() : undefined,
      });

      if (alsoSaveToNeedsMatrix) {
        const targetUnit = unitFilter.trim() || (isFa ? 'همه واحدها' : 'All Units');
        onSaveTrainingNeed(targetUnit, selectedJobTitle.trim(), selectedCourseCodes);
      }

      setLastResult(response);
      setResultTab('all');
      setRecordsView('history');
      onAssignmentCompleted(response.updatedCourses, response.updatedCalendarEvents);
      setBulkHistory((prev) => [response.batchRecord, ...prev.filter((b) => b.batchId !== response.batchId)]);

      const { succeeded, skippedDuplicates, failed } = response.summary;
      if (succeeded > 0) {
        toast.success(
          isFa
            ? `تخصیص گروهی انجام شد: ${succeeded} موفق${skippedDuplicates > 0 ? `، ${skippedDuplicates} تکراری` : ''}${failed > 0 ? `، ${failed} ناموفق` : ''}`
            : `Bulk assign done: ${succeeded} succeeded, ${skippedDuplicates} duplicates, ${failed} failed`
        );
      } else if (skippedDuplicates > 0) {
        toast(
          isFa
            ? `همه ${skippedDuplicates} مورد انتخابی دارای تخصیص فعال یا سابقه معتبر بودند و از ثبت تکراری جلوگیری شد.`
            : `All ${skippedDuplicates} items were skipped as duplicates.`,
          { icon: '⚠️' }
        );
      } else {
        toast.error(isFa ? 'هیچ تخصیصی ثبت نشد. جزئیات را بررسی کنید.' : 'No assignments succeeded.');
      }

      if (allowRenewalOverride) {
        setAllowRenewalOverride(false);
        setOverrideReason('');
      }
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در اجرای تخصیص گروهی آموزش' : 'Bulk assignment failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combined result rows for result viewer
  const resultRows = useMemo(() => {
    if (!lastResult) return [];
    if (resultTab === 'succeeded') return lastResult.succeededItems;
    if (resultTab === 'duplicate') return lastResult.duplicateItems;
    if (resultTab === 'failed') return lastResult.failedItems;
    return [
      ...lastResult.succeededItems,
      ...lastResult.duplicateItems,
      ...lastResult.failedItems,
    ];
  }, [lastResult, resultTab]);

  return (
    <div ref={topWorkspaceRef} className="space-y-6">
      {/* ========================================================
          SINGLE UNIFIED INPUT WORKSPACE: NEEDS MATRIX + BULK ASSIGN
         ======================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Clean Enterprise Top Header */}
        <div className="px-5 py-4 md:px-6 md:py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/15 border border-blue-200/80 dark:border-blue-800/70 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base leading-snug">
                {isFa
                  ? 'نیازسنجی آموزشی و تخصیص گروهی دوره بر اساس سمت شغلی'
                  : 'Unified Training Needs Matrix & Role-Based Bulk Assignment'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {isFa
                  ? 'تعریف دوره‌های الزامی هر رده شغلی و تخصیص گروهی هوشمند به کارکنان واجد شرایط از بانک مرکزی پرسنل در یک فرم واحد'
                  : 'Define mandatory role courses and bulk-assign to eligible personnel from central master data in one unified workspace'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => syncPersonnelList(true)}
            disabled={isHydratingPersonnel}
            className="self-start md:self-auto px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${isHydratingPersonnel ? 'animate-spin' : ''}`} />
            <span>
              {isFa ? 'بروزرسانی پرسنل' : 'Sync Personnel'}{' '}
              <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                ({allPersonnel.length})
              </span>
            </span>
          </button>
        </div>

        <div className="p-5 md:p-6 space-y-5">
          {/* STEP 1: UNIFIED ROLE, UNIT & EMPLOYMENT STATUS BAR */}
          <div className="bg-slate-50/80 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3.5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              {/* Job Title / Position */}
              <div className="lg:col-span-5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-mono tabular-nums inline-flex items-center justify-center shrink-0">
                      1
                    </span>
                    <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{isFa ? 'رده شغلی / سمت سازمانی' : 'Job Title / Position'} *</span>
                  </label>
                  {selectedJobTitle && (
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 px-2 py-0.5 rounded-lg">
                      <span className="font-mono tabular-nums font-black">{personnelByJobTitle.length}</span>{' '}
                      <span>{isFa ? 'نفر ثبت‌شده' : 'registered'}</span>
                    </span>
                  )}
                </div>
                <SearchableSelect
                  options={jobTitleOptions}
                  value={selectedJobTitle}
                  onChange={(val) => {
                    setSelectedJobTitle(val);
                    setLastResult(null);
                  }}
                  placeholder={isFa ? 'جستجو و انتخاب سمت شغلی از ساختار سازمانی...' : 'Search & select job title...'}
                  isFa={isFa}
                />
              </div>

              {/* Organizational Unit */}
              <div className="lg:col-span-4 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{isFa ? 'واحد سازمانی (فیلتر و ماتریس)' : 'Organizational Unit'}</span>
                </label>
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-[42px] cursor-pointer"
                >
                  <option value="">{isFa ? 'همه واحدهای سازمانی' : 'All Organizational Units'}</option>
                  {availableUnitOptions.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Employment Status Filter */}
              <div className="lg:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{isFa ? 'وضعیت اشتغال' : 'Employment Status'}</span>
                </label>
                <div className="grid grid-cols-3 gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 h-[42px]">
                  {(
                    [
                      { key: 'active', label: isFa ? 'فعال' : 'Active', count: statusCounts.active },
                      { key: 'all', label: isFa ? 'همه' : 'All', count: statusCounts.all },
                      { key: 'inactive', label: isFa ? 'غیرفعال' : 'Inactive', count: statusCounts.inactive },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setEmploymentStatusFilter(opt.key)}
                      className={`rounded-lg text-[11px] font-bold transition cursor-pointer inline-flex items-center justify-center gap-1 ${
                        employmentStatusFilter === opt.key
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="font-mono tabular-nums text-[10px] opacity-85">({opt.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Role Suggestions when none selected */}
            {!selectedJobTitle && unifiedJobTitles.some((j) => j.count > 0) && (
              <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1">
                  {isFa ? 'سمت‌های ثبت‌شده:' : 'Registered roles:'}
                </span>
                {unifiedJobTitles
                  .filter((j) => j.count > 0)
                  .slice(0, 10)
                  .map((j) => (
                    <button
                      key={j.norm}
                      type="button"
                      onClick={() => setSelectedJobTitle(j.label)}
                      className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <span>{j.label}</span>
                      <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                        {j.count}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* STEP 2 & STEP 3: TWO-COLUMN INTERACTIVE WORKSPACE */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            {/* Eligible Personnel Checklist (7 cols) */}
            <div className="xl:col-span-7 flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/30">
              <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-mono tabular-nums inline-flex items-center justify-center shrink-0">
                      2
                    </span>
                    <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {isFa ? 'کارکنان واجد شرایط سمت انتخاب‌شده' : 'Eligible Personnel'}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <span className="font-mono tabular-nums font-black">{selectedPersonnelCodes.length}</span>{' '}
                      <span>{isFa ? 'از' : '/'}</span>{' '}
                      <span className="font-mono tabular-nums font-black">{eligiblePersonnel.length}</span>{' '}
                      <span>{isFa ? 'نفر انتخاب‌شده' : 'selected'}</span>
                    </span>
                  </div>

                  {eligiblePersonnel.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={selectAllVisible}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 transition cursor-pointer"
                      >
                        {isFa ? 'انتخاب همه' : 'Select All'}
                      </button>
                      {selectedCourseCodes.length > 0 && (
                        <button
                          type="button"
                          onClick={selectOnlyNonDuplicateVisible}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                        >
                          {isFa ? 'فقط غیرتکراری‌ها' : 'Non-Duplicates'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                      >
                        {isFa ? 'لغو انتخاب' : 'Clear'}
                      </button>
                    </div>
                  )}
                </div>

                {selectedJobTitle && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={personnelSearch}
                      onChange={(e) => setPersonnelSearch(e.target.value)}
                      placeholder={isFa ? 'جستجو در نام، کد پرسنلی یا واحد...' : 'Search name, code, or unit...'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-[260px] max-h-[380px] overflow-y-auto custom-scrollbar">
                {!selectedJobTitle ? (
                  <div className="h-full min-h-[260px] flex flex-col items-center justify-center p-8 text-center text-xs font-bold text-slate-400 dark:text-slate-500 space-y-2.5">
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center">
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="max-w-sm leading-relaxed">
                      {isFa
                        ? 'با انتخاب رده شغلی در بخش بالا، کارکنان دارای همان سمت به‌صورت خودکار از بانک پرسنل شناسایی و آماده انتخاب می‌شوند.'
                        : 'Select a job title above to automatically identify eligible personnel from the central directory.'}
                    </p>
                  </div>
                ) : eligiblePersonnel.length === 0 ? (
                  <div className="h-full min-h-[260px] flex flex-col items-center justify-center p-8 text-center text-xs font-bold text-slate-400 dark:text-slate-500 space-y-2">
                    <Users className="w-7 h-7 text-slate-300 dark:text-slate-700" />
                    <p>
                      {isFa
                        ? 'هیچ پرسنلی با این سمت شغلی و فیلترهای انتخاب‌شده یافت نشد.'
                        : 'No personnel match this job title and filter criteria.'}
                    </p>
                    {(unitFilter || employmentStatusFilter !== 'all' || personnelSearch) && (
                      <button
                        type="button"
                        onClick={() => {
                          setUnitFilter('');
                          setEmploymentStatusFilter('all');
                          setPersonnelSearch('');
                        }}
                        className="text-blue-600 dark:text-blue-400 underline text-xs font-bold cursor-pointer"
                      >
                        {isFa ? 'پاک کردن فیلترها' : 'Reset filters'}
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-xs text-right">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-xs text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-10"></th>
                        <th className="px-3 py-2.5">{isFa ? 'نام و نام خانوادگی' : 'Full Name'}</th>
                        <th className="px-3 py-2.5 text-center">{isFa ? 'کد پرسنلی' : 'Code'}</th>
                        <th className="px-3 py-2.5">{isFa ? 'واحد' : 'Unit'}</th>
                        <th className="px-3 py-2.5 text-center">{isFa ? 'وضعیت' : 'Status'}</th>
                        <th className="px-3 py-2.5 text-center">{isFa ? 'بررسی تکراری' : 'Pre-Check'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {eligiblePersonnel.map((p) => {
                        const code = cleanPersonnelCode(normalizeDigits(p.effectiveCode || p.personnelCode));
                        const isChecked = selectedPersonnelCodes.includes(code);
                        const status = getPersonnelStatus(p);
                        const conflict = getPersonConflictSummary(code);
                        const dupTooltip = conflict.duplicateCourses
                          .map(
                            (d) =>
                              `${d.code}: ${
                                d.type === 'active'
                                  ? isFa
                                    ? 'تخصیص فعال'
                                    : 'Active assignment'
                                  : isFa
                                    ? 'سابقه گذرانده‌شده'
                                    : 'Completed'
                              }${d.date ? ` (${d.date})` : ''}`
                          )
                          .join(' | ');

                        return (
                          <tr
                            key={p.id || code}
                            onClick={() => togglePersonnel(code)}
                            className={`cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-blue-50/45 dark:bg-blue-950/25 hover:bg-blue-50/80 dark:hover:bg-blue-950/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="px-3 py-2.5 text-center">
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-black text-slate-900 dark:text-slate-100">
                              {p.fullName}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                              {code}
                            </td>
                            <td className="px-3 py-2.5 font-bold text-slate-600 dark:text-slate-400">
                              {getPersonnelUnit(p) || '-'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black border ${
                                  status === 'active'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {status === 'active' ? (isFa ? 'فعال' : 'Active') : isFa ? 'غیرفعال' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center" title={dupTooltip}>
                              {selectedCourseCodes.length === 0 ? (
                                <span className="text-[11px] text-slate-400 font-medium">
                                  {isFa ? 'انتخاب دوره...' : 'Select course...'}
                                </span>
                              ) : conflict.duplicateCourses.length === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{isFa ? 'قابل تخصیص' : 'Ready'}</span>
                                </span>
                              ) : allowRenewalOverride ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md">
                                  <Sparkles className="w-3 h-3" />
                                  <span>
                                    {isFa ? 'تمدید' : 'Override'} (
                                    <span className="font-mono tabular-nums">{conflict.duplicateCourses.length}</span>)
                                  </span>
                                </span>
                              ) : conflict.cleanCount === 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{isFa ? 'تکراری (رد می‌شود)' : 'Duplicate'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md">
                                  <span className="font-mono tabular-nums">{conflict.cleanCount}</span>{' '}
                                  <span>{isFa ? 'جدید /' : 'new /'}</span>{' '}
                                  <span className="font-mono tabular-nums">{conflict.duplicateCourses.length}</span>{' '}
                                  <span>{isFa ? 'تکراری' : 'dup'}</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Course Selection + Deadline & Calendar (5 cols) */}
            <div className="xl:col-span-5 flex flex-col gap-4">
              {/* Multi-Course Selector */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/30 flex flex-col flex-1">
                <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-mono tabular-nums inline-flex items-center justify-center shrink-0">
                        3
                      </span>
                      <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {isFa ? 'انتخاب دوره‌های آموزشی (چندگانه)' : 'Select Training Courses'} *
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/70 px-2 py-0.5 rounded-lg">
                      <span className="font-mono tabular-nums font-black">{selectedCourseCodes.length}</span>{' '}
                      <span>{isFa ? 'دوره انتخاب‌شده' : 'selected'}</span>
                    </span>
                  </div>

                  {needsMatrixCoursesForRole.length > 0 && (
                    <button
                      type="button"
                      onClick={loadNeedsMatrixCourses}
                      className="w-full py-1.5 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {isFa ? 'بارگذاری دوره‌های ثبت‌شده در ماتریس این سمت' : 'Load mandatory role courses'} (
                        <span className="font-mono tabular-nums">{needsMatrixCoursesForRole.length}</span>)
                      </span>
                    </button>
                  )}

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      placeholder={isFa ? 'جستجوی کد یا عنوان دوره...' : 'Search course code or title...'}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-2.5 max-h-[195px] overflow-y-auto custom-scrollbar space-y-1.5 flex-1">
                  {filteredCourseDefs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 font-bold leading-relaxed">
                      {isFa
                        ? 'هیچ دوره‌ای یافت نشد. ابتدا در تب «تعریف دوره» دوره‌های آموزشی را ثبت کنید.'
                        : 'No courses defined. Add courses in the Course Definition tab first.'}
                    </div>
                  ) : (
                    filteredCourseDefs.map((c) => {
                      const checked = selectedCourseCodes.includes(c.code);
                      return (
                        <button
                          key={c.id || c.code}
                          type="button"
                          onClick={() => toggleCourse(c.code)}
                          className={`w-full text-right px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                            checked
                              ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-100'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                            )}
                            <span className="font-mono tabular-nums font-black text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300 shrink-0">
                              {c.code}
                            </span>
                            <span className="text-xs font-bold truncate">{c.title}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                            <span className="font-mono tabular-nums">{c.duration}</span> {isFa ? 'ساعت' : 'h'}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Deadline & Calendar Scheduling Card */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/70 dark:bg-slate-800/30 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[10px] font-mono tabular-nums inline-flex items-center justify-center shrink-0">
                      4
                    </span>
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{isFa ? 'مهلت گذراندن دوره (اختیاری)' : 'Completion Deadline (Optional)'}</span>
                  </label>
                  <PersianDatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    isFa={isFa}
                    placeholder={isFa ? 'انتخاب تاریخ مهلت تکمیل دوره...' : 'Select deadline date...'}
                  />
                </div>

                <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={linkToCalendar}
                      onChange={(e) => setLinkToCalendar(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    />
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>
                        {isFa
                          ? 'اتصال و ثبت خودکار دوره(ها) در تقویم آموزشی'
                          : 'Link & schedule course(s) in Training Calendar'}
                      </span>
                    </span>
                  </label>

                  {linkToCalendar && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                          {isFa ? 'تاریخ برگزاری در تقویم' : 'Calendar Date'} *
                        </label>
                        <PersianDatePicker
                          value={calendarDate}
                          onChange={setCalendarDate}
                          isFa={isFa}
                          placeholder={isFa ? 'انتخاب تاریخ برگزاری...' : 'Select date...'}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                          {isFa ? 'ساعت برگزاری (اختیاری)' : 'Time (Optional)'}
                        </label>
                        <PersianTimePicker
                          value={calendarTime}
                          onChange={setCalendarTime}
                          isFa={isFa}
                          placeholder={isFa ? 'مثلاً ۰۹:۰۰' : '09:00'}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* UNIFIED PRE-FLIGHT GUARDRAIL, OVERRIDE & DUAL-ACTION FOOTER */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/70 dark:bg-slate-800/30 space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-300">
                  {isFa ? 'پیش‌نمایش تخصیص:' : 'Preview:'}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100">
                  {isFa ? 'کل درخواست‌ها:' : 'Total:'}{' '}
                  <span className="font-mono tabular-nums font-black">{preflightStats.totalPairs}</span>
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                  {isFa ? 'تخصیص جدید:' : 'New:'}{' '}
                  <span className="font-mono tabular-nums font-black">{preflightStats.newPairs}</span>
                </span>
                {preflightStats.duplicatePairs > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                    {isFa ? 'موارد تکراری:' : 'Duplicates:'}{' '}
                    <span className="font-mono tabular-nums font-black">{preflightStats.duplicatePairs}</span>
                  </span>
                )}
              </div>

              {canOverride && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowRenewalOverride}
                    onChange={(e) => setAllowRenewalOverride(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-600 cursor-pointer"
                  />
                  <span className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      {isFa
                        ? 'مجوز تخصیص مجدد (تمدید یا آموزش مجدد)'
                        : 'Authorize Renewal / Retraining Override'}
                    </span>
                  </span>
                </label>
              )}
            </div>

            {allowRenewalOverride && (
              <div className="pt-2.5 border-t border-amber-200/70 dark:border-amber-800/60 space-y-2 animate-in fade-in duration-150">
                <label className="text-xs font-black text-amber-900 dark:text-amber-200 block">
                  {isFa
                    ? 'دلیل تمدید یا آموزش مجدد (الزامی و ثبت‌شده در سوابق ممیزی):'
                    : 'Reason for Renewal / Retraining (Required):'}{' '}
                  *
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={
                    isFa
                      ? 'مثال: تمدید سالانه گواهینامه ایمنی یا بازآموزی پس از حادثه...'
                      : 'e.g. Annual certificate renewal or post-incident retraining...'
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                />
                {isFa && (
                  <div className="flex flex-wrap gap-1.5">
                    {OVERRIDE_REASON_PRESETS_FA.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setOverrideReason(preset)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 transition cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Unified Action Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={alsoSaveToNeedsMatrix}
                  onChange={(e) => setAlsoSaveToNeedsMatrix(e.target.checked)}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                />
                <span>
                  {isFa
                    ? 'ذخیره هم‌زمان دوره‌های انتخابی در ماتریس نیازسنجی این سمت شغلی'
                    : 'Also save selected courses to this role’s Training Needs Matrix'}
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={handleSaveToNeedsMatrix}
                  disabled={!selectedJobTitle || selectedCourseCodes.length === 0}
                  className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{isFa ? 'فقط ثبت در ماتریس نیازسنجی' : 'Save to Needs Matrix Only'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkAssignSubmit}
                  disabled={
                    isSubmitting ||
                    !selectedJobTitle ||
                    selectedPersonnelCodes.length === 0 ||
                    selectedCourseCodes.length === 0
                  }
                  className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-black text-xs inline-flex items-center justify-center gap-2 transition shadow-sm cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isSubmitting ? (
                      isFa ? 'در حال ثبت تخصیص گروهی...' : 'Assigning...'
                    ) : (
                      <>
                        {isFa ? 'تخصیص گروهی دوره' : 'Bulk Assign'}{' '}
                        <span className="font-mono tabular-nums">
                          ({selectedPersonnelCodes.length} × {selectedCourseCodes.length})
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================
              ASSIGNMENT EXECUTION RESULT SUMMARY (ON SUBMIT)
             ======================================================== */}
          {lastResult && (
            <div className="border border-blue-200 dark:border-blue-800/80 rounded-2xl bg-blue-50/30 dark:bg-blue-950/20 p-4 md:p-5 space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/60 dark:border-blue-800/60 pb-3">
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{isFa ? 'نتیجه تخصیص گروهی دوره آموزشی' : 'Bulk Assignment Execution Summary'}</span>
                  </h4>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>
                      {isFa ? 'شناسه دسته:' : 'Batch:'}{' '}
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {lastResult.batchId}
                      </span>
                    </span>
                    <span>•</span>
                    <span>
                      {isFa ? 'تاریخ:' : 'Date:'}{' '}
                      <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {lastResult.assignedDate}
                      </span>
                    </span>
                    <span>•</span>
                    <span>
                      {isFa ? 'کاربر:' : 'By:'} {lastResult.assignedBy}
                    </span>
                  </p>
                </div>
                {lastResult.summary.calendarEventsLinked > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs font-black">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      <span className="font-mono tabular-nums">{lastResult.summary.calendarEventsLinked}</span>{' '}
                      {isFa ? 'دوره به تقویم آموزشی متصل شد' : 'linked to Calendar'}
                    </span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-slate-500">{isFa ? 'کل درخواست‌ها' : 'Total Requested'}</div>
                  <div className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {lastResult.summary.totalRequested}
                  </div>
                </div>
                <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isFa ? 'تخصیص موفق' : 'Succeeded'}</span>
                  </div>
                  <div className="text-xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {lastResult.summary.succeeded}
                  </div>
                </div>
                <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{isFa ? 'موارد تکراری (ردشده)' : 'Skipped Duplicates'}</span>
                  </div>
                  <div className="text-xl font-black font-mono tabular-nums text-amber-700 dark:text-amber-300 mt-0.5">
                    {lastResult.summary.skippedDuplicates}
                  </div>
                </div>
                <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 rounded-xl p-3">
                  <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isFa ? 'موارد ناموفق' : 'Failed'}</span>
                  </div>
                  <div className="text-xl font-black font-mono tabular-nums text-rose-700 dark:text-rose-300 mt-0.5">
                    {lastResult.summary.failed}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: isFa ? 'همه' : 'All', count: lastResult.summary.totalRequested },
                    { key: 'succeeded', label: isFa ? 'موفق' : 'Succeeded', count: lastResult.summary.succeeded },
                    { key: 'duplicate', label: isFa ? 'تکراری' : 'Duplicates', count: lastResult.summary.skippedDuplicates },
                    { key: 'failed', label: isFa ? 'ناموفق' : 'Failed', count: lastResult.summary.failed },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setResultTab(tab.key)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                      resultTab === tab.key
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono tabular-nums text-[11px]">({tab.count})</span>
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 custom-scrollbar">
                <table className="w-full text-xs text-right">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                    <tr>
                      <th className="px-3 py-2">{isFa ? 'پرسنل' : 'Personnel'}</th>
                      <th className="px-3 py-2 text-center">{isFa ? 'کد پرسنلی' : 'Code'}</th>
                      <th className="px-3 py-2">{isFa ? 'دوره آموزشی' : 'Course'}</th>
                      <th className="px-3 py-2 text-center">{isFa ? 'نتیجه' : 'Outcome'}</th>
                      <th className="px-3 py-2">{isFa ? 'توضیحات سیستمی' : 'Details'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {resultRows.map((item, idx) => (
                      <tr key={`${item.personnelCode}-${item.courseCode}-${idx}`}>
                        <td className="px-3 py-2 font-black text-slate-900 dark:text-slate-100">
                          {item.fullName}
                        </td>
                        <td className="px-3 py-2 text-center font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300">
                          {item.personnelCode}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-200">
                          <span className="font-mono text-blue-600 dark:text-blue-400 ml-1">
                            [{item.courseCode}]
                          </span>
                          {item.courseTitle}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {item.outcome === 'succeeded' && (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {isFa ? 'موفق' : 'Succeeded'}
                            </span>
                          )}
                          {item.outcome === 'duplicate' && (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {isFa ? 'تکراری' : 'Duplicate'}
                            </span>
                          )}
                          {item.outcome === 'failed' && (
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {isFa ? 'ناموفق' : 'Failed'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 font-medium">
                          {item.message}
                        </td>
                      </tr>
                    ))}
                    {resultRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-slate-400 font-bold">
                          {isFa ? 'موردی در این دسته وجود ندارد.' : 'No items in this category.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          UNIFIED RECORDS VIEW: NEEDS MATRIX & BULK AUDIT HISTORY
         ======================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setRecordsView('matrix')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 transition cursor-pointer ${
                recordsView === 'matrix'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>{isFa ? 'ماتریس نیازسنجی ثبت‌شده' : 'Training Needs Matrix'}</span>
              <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {trainingNeeds.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRecordsView('history')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 transition cursor-pointer ${
                recordsView === 'history'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isFa ? 'سوابق تخصیص‌های گروهی' : 'Bulk Assignment History'}</span>
              <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {bulkHistory.length}
              </span>
            </button>
          </div>
        </div>

        {/* VIEW A: NEEDS MATRIX TABLE */}
        {recordsView === 'matrix' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                <tr>
                  <th className="px-4 py-3.5 text-center w-14 text-slate-400">#</th>
                  <th className="px-4 py-3.5 w-48">{isFa ? 'واحد سازمانی' : 'Unit'}</th>
                  <th className="px-4 py-3.5 w-48">{isFa ? 'عنوان رده شغلی' : 'Job Title'}</th>
                  <th className="px-4 py-3.5">{isFa ? 'دوره‌های الزامی ثبت‌شده' : 'Mandatory Courses'}</th>
                  <th className="px-4 py-3.5 text-center w-44">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {trainingNeeds.map((n, idx) => (
                  <tr key={`${n.id || 'need'}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5 text-center text-slate-400 font-mono tabular-nums font-bold">{idx + 1}</td>
                    <td className="px-4 py-3.5 font-black text-slate-900 dark:text-slate-100">{n.unit}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300">{n.jobTitle}</td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                      <div className="flex flex-wrap gap-1.5">
                        {n.courseCodes.map((code, cIdx) => {
                          const courseTitle = courseDefs.find((cd) => cd.code === code)?.title;
                          return (
                            <span
                              key={`${code}-${cIdx}`}
                              className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 text-blue-700 dark:text-blue-300 font-mono font-black px-2 py-0.5 rounded-lg text-xs"
                              title={courseTitle}
                            >
                              {code}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => loadNeedRowIntoWorkspace(n)}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-black inline-flex items-center gap-1 transition cursor-pointer"
                          title={isFa ? 'بارگذاری در فرم بالا برای تخصیص گروهی یا ویرایش' : 'Load into form above'}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>{isFa ? 'بارگذاری و تخصیص' : 'Load & Assign'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTrainingNeed(n.id)}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                          title={isFa ? 'حذف نیازسنجی' : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {trainingNeeds.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500 font-bold">
                      {isFa
                        ? 'هیچ رکوردی در ماتریس نیازسنجی ثبت نشده است. از فرم واحد بالا استفاده کنید.'
                        : 'No training needs records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW B: BULK ASSIGNMENT AUDIT HISTORY TABLE */}
        {recordsView === 'history' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                <tr>
                  <th className="px-4 py-3 text-center">{isFa ? 'تاریخ تخصیص' : 'Assigned Date'}</th>
                  <th className="px-4 py-3">{isFa ? 'سمت شغلی / واحد' : 'Job Title / Unit'}</th>
                  <th className="px-4 py-3">{isFa ? 'دوره‌ها' : 'Courses'}</th>
                  <th className="px-4 py-3 text-center">{isFa ? 'مهلت / تقویم' : 'Deadline / Calendar'}</th>
                  <th className="px-4 py-3 text-center">{isFa ? 'نتیجه (موفق / تکراری / ناموفق)' : 'Result'}</th>
                  <th className="px-4 py-3">{isFa ? 'کاربر تخصیص‌دهنده' : 'Assigned By'}</th>
                  <th className="px-4 py-3 text-center">{isFa ? 'جزئیات' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {bulkHistory.map((batch) => {
                  const isExpanded = expandedBatchId === batch.batchId;
                  return (
                    <React.Fragment key={batch.batchId}>
                      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-center font-mono">
                          <DualDateBadge date={batch.assignedDate} mode="both" showTooltip />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-black text-slate-900 dark:text-slate-100">{batch.jobTitle}</div>
                          {batch.unitFilter && (
                            <div className="text-[11px] font-bold text-slate-500">{batch.unitFilter}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {batch.courseCodes.map((code, idx) => (
                              <span
                                key={`${batch.batchId}-${code}-${idx}`}
                                title={batch.courseTitles?.[idx] || code}
                                className="font-mono font-black text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="space-y-0.5">
                            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                              {batch.dueDate ? (
                                <>
                                  {isFa ? 'مهلت: ' : 'Due: '}
                                  <span className="font-mono tabular-nums">{batch.dueDate}</span>
                                </>
                              ) : (
                                '-'
                              )}
                            </div>
                            {batch.linkedToCalendar && batch.calendarDate && (
                              <div className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                                {isFa ? 'تقویم: ' : 'Cal: '}
                                <span className="font-mono tabular-nums">{batch.calendarDate}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono tabular-nums font-black">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {batch.succeededCount}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {batch.duplicateCount}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {batch.failedCount}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200">
                          <div>{batch.assignedBy}</div>
                          {batch.allowRenewalOverride && batch.overrideReason && (
                            <div
                              className="text-[10px] font-bold text-amber-600 dark:text-amber-400 max-w-[180px] truncate"
                              title={batch.overrideReason}
                            >
                              {isFa ? `تمدید: ${batch.overrideReason}` : `Override: ${batch.overrideReason}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedBatchId(isExpanded ? null : batch.batchId)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer"
                          >
                            {isExpanded ? (
                              isFa ? 'بستن' : 'Hide'
                            ) : (
                              <>
                                {isFa ? 'نفرات' : 'People'} (
                                <span className="font-mono tabular-nums">{batch.assignedPersonnel?.length || 0}</span>)
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-950/50">
                          <td colSpan={7} className="px-5 py-3 whitespace-normal">
                            {batch.assignedPersonnel && batch.assignedPersonnel.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {batch.assignedPersonnel.map((person) => (
                                  <span
                                    key={`${batch.batchId}-${person.personnelCode}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                                  >
                                    <span>{person.fullName}</span>
                                    <span className="font-mono tabular-nums text-slate-400">({person.personnelCode})</span>
                                    <span className="font-mono text-blue-600 dark:text-blue-400">
                                      [{person.courseCodes.join(', ')}]
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-bold">
                                {isFa ? 'هیچ تخصیص جدیدی در این دسته ثبت نشده است.' : 'No new assignments recorded.'}
                              </span>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {bulkHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400 dark:text-slate-500 font-bold">
                      {isFa
                        ? 'هنوز هیچ تخصیص گروهی آموزشی ثبت نشده است.'
                        : 'No bulk training assignments recorded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
