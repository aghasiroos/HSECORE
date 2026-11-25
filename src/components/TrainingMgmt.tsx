import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PersianDatePicker from './common/PersianDatePicker';
import DualDateBadge from './common/DualDateBadge';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Calendar, 
  GraduationCap, 
  Target, 
  UserCheck, 
  Building2, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Award,
  Layers,
  Sparkles,
  Users,
  LayoutDashboard
} from 'lucide-react';
import TrainingCalendar from './TrainingCalendar';
import TrainingDashboard from './TrainingDashboard';
import JobRoleBulkAssignPanel from './training/JobRoleBulkAssignPanel';
import ContractorTrainingPanel from './training/ContractorTrainingPanel';
import { getUnits, getJobTitles } from '../utils/orgHelper';
import { findPersonnelByCode } from '../utils/personnelHelper';
import CentralPersonnelSelector from './CentralPersonnelSelector';
import { apiDb } from '../services/apiDatabaseClient';
import { SubViewTransition } from '../motion';
import { toast } from 'react-hot-toast';
import { getShamsiToday } from '../utils/jalaliDate';
import type {
  TrainingCourseRecord as CourseData,
  TrainingCourseDef as CourseDef,
  TrainingNeed,
  TrainingCalendarEvent as CalendarEvent,
  LegacyContractorSummary as ContractorData,
} from '../types/training';

interface TrainingMgmtProps {
  isFa: boolean;
  currentUser: any;
}

export default function TrainingMgmt({ isFa, currentUser }: TrainingMgmtProps) {
  const [units, setUnits] = useState<string[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);

  useEffect(() => {
    setUnits(getUnits());
    setJobTitles(getJobTitles());

    const handleOrgUpdate = () => {
      setUnits(getUnits());
      setJobTitles(getJobTitles());
    };
    window.addEventListener('hse_org_nodes_updated', handleOrgUpdate);
    window.addEventListener('app_data_mutated', handleOrgUpdate);
    return () => {
      window.removeEventListener('hse_org_nodes_updated', handleOrgUpdate);
      window.removeEventListener('app_data_mutated', handleOrgUpdate);
    };
  }, []);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'course_def' | 'needs' | 'course' | 'contractor'>('dashboard');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState('');
  const [selectedCourseStatusFilter, setSelectedCourseStatusFilter] = useState<'all' | 'completed' | 'assigned'>('all');

  // Contractor Data (auto-synced from individual contractor training records)
  const [contractors, setContractors] = useState<ContractorData[]>([]);

  // Course Data
  const [courses, setCourses] = useState<CourseData[]>([]);

  const [newCourse, setNewCourse] = useState({
    firstName: '',
    lastName: '',
    personnelCode: '',
    unit: '',
    jobTitle: '',
    courseCode: '',
    date: ''
  });

  // Course Definitions Data
  const [courseDefs, setCourseDefs] = useState<CourseDef[]>([]);

  const [newCourseDef, setNewCourseDef] = useState({ code: '', title: '', duration: '' });

  // Training Needs Data
  const [trainingNeeds, setTrainingNeeds] = useState<TrainingNeed[]>([]);

  // Centralized database synchronization & Real-time listeners
  const loadTrainingDataFromDb = useCallback(async () => {
    try {
      const [dbCourses, dbDefs, dbNeeds, dbContractors, dbEvents] = await Promise.all([
        apiDb.getTrainingCourses(),
        apiDb.getTrainingCourseDefs(),
        apiDb.getTrainingNeeds(),
        apiDb.getTrainingContractors(),
        apiDb.getTrainingCalendarEvents(),
      ]);

      if (Array.isArray(dbCourses)) setCourses(dbCourses);
      if (Array.isArray(dbDefs)) setCourseDefs(dbDefs);
      if (Array.isArray(dbNeeds)) setTrainingNeeds(dbNeeds);
      if (Array.isArray(dbContractors)) setContractors(dbContractors);
      if (Array.isArray(dbEvents)) setCalendarEvents(dbEvents);
    } catch (err) {
      console.warn('[Training] Error syncing with database:', err);
    }
  }, []);

  useEffect(() => {
    loadTrainingDataFromDb();

    const handleDataMutation = (e: any) => {
      const entity = e?.detail?.entityType || e?.detail?.key || e?.detail?.entity;
      if (
        !entity ||
        entity === 'settings' ||
        entity === 'training' ||
        String(entity).startsWith('hse_training_')
      ) {
        loadTrainingDataFromDb();
      }
    };

    window.addEventListener('app_data_mutated', handleDataMutation);
    window.addEventListener('hse_data_mutated', handleDataMutation);
    window.addEventListener('hse_training_updated', loadTrainingDataFromDb);
    window.addEventListener('hse_realtime_reconnected', loadTrainingDataFromDb);
    window.addEventListener('hse_central_data_synced', loadTrainingDataFromDb);
    return () => {
      window.removeEventListener('app_data_mutated', handleDataMutation);
      window.removeEventListener('hse_data_mutated', handleDataMutation);
      window.removeEventListener('hse_training_updated', loadTrainingDataFromDb);
      window.removeEventListener('hse_realtime_reconnected', loadTrainingDataFromDb);
      window.removeEventListener('hse_central_data_synced', loadTrainingDataFromDb);
    };
  }, [loadTrainingDataFromDb]);

  const saveCourses = (next: CourseData[]) => {
    setCourses(next);
    apiDb.saveTrainingCourses(next).catch((err) => {
      console.error('[Training] Failed to persist courses:', err);
      toast.error(isFa ? 'خطا در ذخیره سوابق آموزشی در پایگاه داده مرکزی. داده‌ها بازخوانی شدند.' : 'Failed to save training records.');
      void loadTrainingDataFromDb();
    });
  };

  const saveCourseDefs = (next: CourseDef[]) => {
    setCourseDefs(next);
    apiDb.saveTrainingCourseDefs(next).catch((err) => {
      console.error('[Training] Failed to persist course definitions:', err);
      toast.error(isFa ? 'خطا در ذخیره تعاریف دوره‌ها در پایگاه داده مرکزی. داده‌ها بازخوانی شدند.' : 'Failed to save course definitions.');
      void loadTrainingDataFromDb();
    });
  };

  const saveTrainingNeedsList = (next: TrainingNeed[]) => {
    setTrainingNeeds(next);
    apiDb.saveTrainingNeeds(next).catch((err) => {
      console.error('[Training] Failed to persist training needs:', err);
      toast.error(isFa ? 'خطا در ذخیره نیازسنجی آموزشی در پایگاه داده مرکزی. داده‌ها بازخوانی شدند.' : 'Failed to save training needs.');
      void loadTrainingDataFromDb();
    });
  };

  const saveCalendarEventsList = (next: CalendarEvent[]) => {
    setCalendarEvents(next);
    apiDb.saveTrainingCalendarEvents(next).catch((err) => {
      console.error('[Training] Failed to persist calendar events:', err);
      toast.error(isFa ? 'خطا در ذخیره رویدادهای تقویم آموزشی در پایگاه داده مرکزی. داده‌ها بازخوانی شدند.' : 'Failed to save calendar events.');
      void loadTrainingDataFromDb();
    });
  };

  // Delete confirm modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  const availableCourseDefs = useMemo(() => {
    if (!newCourse.unit || !newCourse.jobTitle) return courseDefs;
    const need = trainingNeeds.find(n => n.unit === newCourse.unit && n.jobTitle === newCourse.jobTitle);
    if (!need) return courseDefs;
    return courseDefs.filter(c => need.courseCodes.includes(c.code));
  }, [newCourse.unit, newCourse.jobTitle, trainingNeeds, courseDefs]);

  const addCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse.firstName || !newCourse.lastName || !newCourse.personnelCode || !newCourse.courseCode) return;
    
    const def = courseDefs.find(c => c.code === newCourse.courseCode);
    const hours = def ? def.duration : 0;
    
    const next: CourseData[] = [{
      id: Date.now().toString(),
      firstName: newCourse.firstName.trim(),
      lastName: newCourse.lastName.trim(),
      personnelCode: newCourse.personnelCode.trim(),
      unit: newCourse.unit.trim(),
      jobTitle: newCourse.jobTitle.trim(),
      courseCode: newCourse.courseCode.trim(),
      courseTitle: def?.title || newCourse.courseCode.trim(),
      hours: hours,
      date: newCourse.date,
      status: 'completed',
      assignmentSource: 'manual',
    }, ...courses];
    saveCourses(next);
    setNewCourse({ firstName: '', lastName: '', personnelCode: '', unit: '', jobTitle: '', courseCode: '', date: '' });
  };

  const handleMarkCourseCompleted = async (record: CourseData) => {
    try {
      const today = getShamsiToday();
      const res = await apiDb.completeTrainingAssignment(record.id, today);
      if (Array.isArray(res?.updatedCourses)) {
        setCourses(res.updatedCourses);
      } else {
        setCourses((prev) =>
          prev.map((c) => (c.id === record.id ? { ...c, status: 'completed', date: today } : c))
        );
      }
      toast.success(
        isFa
          ? `اتمام دوره ${record.courseCode} برای ${record.firstName} ${record.lastName} ثبت شد.`
          : `Marked ${record.courseCode} as completed.`
      );
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در ثبت اتمام دوره' : 'Failed to mark completed'));
    }
  };

  const deleteCourse = (id: string) => {
    if (currentUser?.role !== 'Administrator') {
      toast.error(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const course = courses.find(c => c.id === id);
    const name = course ? `${course.firstName} ${course.lastName}` : '';
    setDeleteConfirm({
      title: isFa ? `آیا از حذف رکورد آموزشی "${name}" اطمینان دارید؟` : `Delete training record for "${name}"?`,
      description: isFa ? 'ساعت آموزشی ثبت‌شده از سوابق فرد کسر خواهد گردید.' : 'Hours will be deducted from personal record.',
      onConfirm: () => {
        const next = courses.filter(c => c.id !== id);
        saveCourses(next);
        setDeleteConfirm(null);
      }
    });
  };

  const addCourseDef = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseDef.code || !newCourseDef.title || !newCourseDef.duration) return;
    
    const next = [...courseDefs, {
      id: Date.now().toString(),
      code: newCourseDef.code.trim().toUpperCase(),
      title: newCourseDef.title.trim(),
      duration: Number(newCourseDef.duration)
    }];
    saveCourseDefs(next);
    setNewCourseDef({ code: '', title: '', duration: '' });
  };

  const deleteCourseDef = (id: string) => {
    if (currentUser?.role !== 'Administrator') {
      toast.error(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const cdef = courseDefs.find(c => c.id === id);
    const name = cdef ? `${cdef.code} - ${cdef.title}` : '';
    setDeleteConfirm({
      title: isFa ? `آیا از حذف تعریف دوره "${name}" اطمینان دارید؟` : `Delete course "${name}"?`,
      description: isFa ? 'این دوره از ماتریس نیازسنجی و تقویم آموزشی نیز خارج خواهد شد.' : 'This will remove the course from needs matrix.',
      onConfirm: () => {
        const next = courseDefs.filter(c => c.id !== id);
        saveCourseDefs(next);
        setDeleteConfirm(null);
      }
    });
  };

  const saveTrainingNeedEntry = (unit: string, jobTitle: string, courseCodes: string[]) => {
    const cleanUnit = unit.trim();
    const cleanJobTitle = jobTitle.trim();
    const cleanCodes = Array.from(new Set(courseCodes.filter(Boolean)));
    if (!cleanUnit || !cleanJobTitle || cleanCodes.length === 0) return;

    const existingIndex = trainingNeeds.findIndex(
      (n) => n.unit === cleanUnit && n.jobTitle === cleanJobTitle
    );
    let next: TrainingNeed[];
    if (existingIndex >= 0) {
      const mergedCodes = Array.from(new Set([...trainingNeeds[existingIndex].courseCodes, ...cleanCodes]));
      next = [...trainingNeeds];
      next[existingIndex] = { ...next[existingIndex], courseCodes: mergedCodes };
    } else {
      next = [
        ...trainingNeeds,
        {
          id: Date.now().toString(),
          unit: cleanUnit,
          jobTitle: cleanJobTitle,
          courseCodes: cleanCodes,
        },
      ];
    }

    saveTrainingNeedsList(next);
  };

  const deleteTrainingNeed = (id: string) => {
    if (currentUser?.role !== 'Administrator') {
      toast.error(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const need = trainingNeeds.find(n => n.id === id);
    const title = need ? `${need.unit} / ${need.jobTitle}` : '';
    setDeleteConfirm({
      title: isFa ? `آیا از حذف ماتریس نیازسنجی "${title}" اطمینان دارید؟` : `Delete training need for "${title}"?`,
      description: isFa ? 'دوره‌های اجباری مرتبط با این رده شغلی حذف خواهند شد.' : 'Required courses for this job title will be cleared.',
      onConfirm: () => {
        const next = trainingNeeds.filter(n => n.id !== id);
        saveTrainingNeedsList(next);
        setDeleteConfirm(null);
      }
    });
  };

  // High-level KPIs calculation (count completed training hours accurately)
  const totalComplexHours = useMemo(() => {
    return courses
      .filter((c) => !c.status || c.status === 'completed')
      .reduce((acc, c) => acc + (Number(c.hours) || 0), 0);
  }, [courses]);

  const totalContractorHours = useMemo(() => {
    const sum = contractors.reduce((acc, c) => {
      const exactTotal = Number(c.totalHours);
      if (Number.isFinite(exactTotal) && exactTotal > 0) return acc + exactTotal;
      return acc + (Number(c.headcount) || 0) * (Number(c.perCapita) || 0);
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [contractors]);

  // Tab Item Configuration
  const tabs = [
    { key: 'dashboard', label: isFa ? 'داشبورد جامع' : 'Comprehensive Dashboard', icon: LayoutDashboard, count: courses.length + calendarEvents.length },
    { key: 'calendar', label: isFa ? 'تقویم آموزشی' : 'Training Calendar', icon: Calendar, count: calendarEvents.length },
    { key: 'course_def', label: isFa ? 'تعریف دوره' : 'Course Definition', icon: GraduationCap, count: courseDefs.length },
    { key: 'needs', label: isFa ? 'نیازسنجی آموزشی' : 'Training Needs', icon: Target, count: trainingNeeds.length },
    { key: 'course', label: isFa ? 'سوابق آموزش پرسنل مجتمع' : 'Complex Personnel Records', icon: UserCheck, count: courses.length },
    { key: 'contractor', label: isFa ? 'سوابق آموزش شرکت‌ها و پیمانکاران' : 'Contractors Records', icon: Building2, count: contractors.length },
  ];

  // Filtered Courses for Personnel Tab
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      const matchSearch = searchTerm 
        ? `${c.firstName} ${c.lastName} ${c.personnelCode} ${c.courseCode} ${c.courseTitle || ''} ${c.unit} ${c.jobTitle} ${c.assignedBy || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchUnit = selectedUnitFilter ? c.unit === selectedUnitFilter : true;
      const recStatus = c.status === 'assigned' || c.status === 'in_progress' ? 'assigned' : 'completed';
      const matchStatus = selectedCourseStatusFilter === 'all' ? true : recStatus === selectedCourseStatusFilter;
      return matchSearch && matchUnit && matchStatus;
    });
  }, [courses, searchTerm, selectedUnitFilter, selectedCourseStatusFilter]);

  // Filtered Course Definitions
  const filteredCourseDefs = useMemo(() => {
    if (!searchTerm) return courseDefs;
    return courseDefs.filter(c => 
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [courseDefs, searchTerm]);

  return (
    <div className="space-y-6" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
      {/* Header Banner with Clean Executive KPIs */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                <BookOpen className="w-5 h-5 text-blue-200" />
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                {isFa ? 'مدیریت، تقویم و سوابق آموزش HSE' : 'HSE Training & Competency Management'}
              </h1>
            </div>
            <p className="text-xs text-blue-100/90 max-w-2xl font-medium leading-relaxed">
              {isFa 
                ? 'سامانه جامع پایش تقویم، ماتریس نیازسنجی، دوره‌های مصوب و ثبت سوابق آموزشی پرسنل و شرکت‌های پیمانکاری'
                : 'Centralized platform for calendar scheduling, training needs analysis, course catalog and competence records'}
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 text-center">
              <div className="text-[11px] text-blue-200 font-bold">{isFa ? 'کل دوره‌های مصوب' : 'Total Courses'}</div>
              <div className="text-lg font-black font-mono text-white mt-0.5">{courseDefs.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 text-center">
              <div className="text-[11px] text-blue-200 font-bold">{isFa ? 'ساعت آموزش پرسنل' : 'Personnel Hr'}</div>
              <div className="text-lg font-black font-mono text-emerald-300 mt-0.5">{totalComplexHours.toLocaleString()}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 text-center col-span-2 sm:col-span-1">
              <div className="text-[11px] text-blue-200 font-bold">{isFa ? 'ساعت آموزش پیمانکاران' : 'Contractor Hr'}</div>
              <div className="text-lg font-black font-mono text-amber-300 mt-0.5">{totalContractorHours.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Module Container with Segmented Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        {/* Navigation Tab Bar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-2">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap lg:flex-nowrap gap-1.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key as any);
                    setSearchTerm('');
                  }}
                  className={`hse-motion-tab sm:flex-1 sm:min-w-[160px] py-2.5 sm:py-3 px-2.5 sm:px-3.5 rounded-2xl text-[11px] sm:text-xs md:text-sm font-black flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md border border-slate-200/80 dark:border-slate-700/80'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span className="truncate">{tab.label}</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-lg leading-tight shrink-0 ${
                    isActive 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300' 
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Section */}
        <SubViewTransition viewKey={activeTab} isFa={isFa} className="p-5 md:p-7">
          {/* ========================================================
              TAB 1: COMPREHENSIVE DASHBOARD (داشبورد جامع)
             ======================================================== */}
          {activeTab === 'dashboard' && (
            <TrainingDashboard
              courses={courses}
              contractors={contractors}
              calendarEvents={calendarEvents}
              courseDefsCount={courseDefs.length}
              isFa={isFa}
            />
          )}

          {/* ========================================================
              TAB 2: TRAINING CALENDAR (تقویم آموزشی)
             ======================================================== */}
          {activeTab === 'calendar' && (
            <TrainingCalendar 
              courses={Object.values(courses.reduce((acc: any, curr) => {
                const key = `${curr.courseCode}-${curr.date}`;
                if (!acc[key]) {
                  const cdef = courseDefs.find(c => c.code === curr.courseCode);
                  acc[key] = {
                    id: key,
                    name: curr.courseCode + (cdef ? ` - ${cdef.title}` : ''),
                    headcount: 1,
                    hours: curr.hours,
                    date: curr.date
                  };
                } else {
                  acc[key].headcount += 1;
                }
                return acc;
              }, {}))}
              calendarEvents={calendarEvents}
              courseDefs={courseDefs}
              onAddEvent={(evt) => {
                const next = [...calendarEvents, evt];
                saveCalendarEventsList(next);
              }}
              onDeleteEvent={(eventId) => {
                if (currentUser?.role !== 'Administrator') {
                  toast.error(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
                  return;
                }
                const evt = calendarEvents.find(e => e.id === eventId);
                const title = evt ? `${evt.courseCode} - ${evt.title}` : eventId;
                setDeleteConfirm({
                  title: isFa ? `آیا از حذف رویداد تقویم آموزشی "${title}" اطمینان دارید؟` : `Delete training calendar event "${title}"?`,
                  description: isFa ? 'این رویداد از تقویم آموزش حذف خواهد شد.' : 'This event will be removed from the training calendar.',
                  onConfirm: () => {
                    const next = calendarEvents.filter(e => e.id !== eventId);
                    saveCalendarEventsList(next);
                    setDeleteConfirm(null);
                  }
                });
              }}
              isFa={isFa} 
            />
          )}

          {/* ========================================================
              TAB 2: COURSE DEFINITIONS (تعریف دوره)
             ======================================================== */}
          {activeTab === 'course_def' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Form Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base">
                      {isFa ? 'تعریف و ثبت دوره آموزشی جدید در کاتالوگ' : 'Define New Course in Catalog'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    {isFa ? 'مشخصات کد و مدت زمان استاندارد' : 'Course code & standard duration'}
                  </span>
                </div>

                <form onSubmit={addCourseDef} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'کد اختصاصی دوره:' : 'Course Code:'} *
                    </label>
                    <input 
                      type="text" 
                      value={newCourseDef.code} 
                      onChange={e => setNewCourseDef({...newCourseDef, code: e.target.value})} 
                      className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase shadow-2xs" 
                      placeholder="مثال: HSE-101"
                      required 
                    />
                  </div>

                  <div className="md:col-span-6 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'عنوان دوره آموزشی:' : 'Course Title:'} *
                    </label>
                    <input 
                      type="text" 
                      value={newCourseDef.title} 
                      onChange={e => setNewCourseDef({...newCourseDef, title: e.target.value})} 
                      className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-2xs" 
                      placeholder={isFa ? 'مثال: اصول ایمنی کار در ارتفاع و مهار سقوط' : 'Course title...'}
                      required 
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'مدت زمان استاندارد (ساعت):' : 'Duration (Hours):'} *
                    </label>
                    <input 
                      type="number" 
                      step="0.5" 
                      min="0.5" 
                      value={newCourseDef.duration} 
                      onChange={e => setNewCourseDef({...newCourseDef, duration: e.target.value})} 
                      className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-2xs" 
                      placeholder="8"
                      required 
                    />
                  </div>

                  <div className="md:col-span-12 flex justify-end pt-1">
                    <button 
                      type="submit" 
                      className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black py-2.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isFa ? 'ثبت دوره در کاتالوگ' : 'Add Course to Catalog'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 rtl:right-3 rtl:left-auto" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={isFa ? 'جستجو در کد یا عنوان دوره...' : 'Search code or title...'}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 self-end sm:self-auto">
                  {isFa ? `تعداد کل: ${filteredCourseDefs.length} دوره` : `Total: ${filteredCourseDefs.length} courses`}
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-right whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                    <tr>
                      <th className="px-4 py-3.5 text-center w-14 text-slate-400">#</th>
                      <th className="px-4 py-3.5 text-center w-36">{isFa ? 'کد دوره' : 'Code'}</th>
                      <th className="px-4 py-3.5">{isFa ? 'عنوان دوره آموزشی' : 'Course Title'}</th>
                      <th className="px-4 py-3.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-x border-slate-200 dark:border-slate-800/80 w-36">
                        {isFa ? 'مدت زمان (ساعت)' : 'Duration (Hr)'}
                      </th>
                      <th className="px-4 py-3.5 text-center w-20">{isFa ? 'عملیات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredCourseDefs.map((c, idx) => (
                      <tr key={`${c.id || 'def'}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="px-4 py-3.5 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                          <span className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 px-2 py-0.5 rounded-lg">
                            {c.code}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-black text-slate-900 dark:text-slate-100">{c.title}</td>
                        <td className="px-4 py-3.5 text-center font-mono font-black text-slate-800 dark:text-slate-200 bg-blue-50/30 dark:bg-blue-950/20 border-x border-slate-100 dark:border-slate-800/60">
                          {c.duration} {isFa ? 'ساعت' : 'hrs'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button 
                            onClick={() => deleteCourseDef(c.id)} 
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer" 
                            title={isFa ? 'حذف دوره' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredCourseDefs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                          {isFa ? 'هیچ دوره‌ای یافت نشد.' : 'No course definitions found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-black">
                    <tr>
                      <td colSpan={3} className="px-4 py-3.5 text-right">{isFa ? 'مجموع دوره‌های فعال در کاتالوگ' : 'Total Active Courses in Catalog'}</td>
                      <td className="px-4 py-3.5 text-center font-mono font-black text-blue-700 dark:text-blue-300 bg-blue-100/40 dark:bg-blue-950/40 border-x border-slate-200 dark:border-slate-700">
                        {filteredCourseDefs.length} {isFa ? 'عنوان' : 'courses'}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: TRAINING NEEDS & BULK ASSIGNMENT (نیازسنجی آموزشی)
             ======================================================== */}
          {activeTab === 'needs' && (
            <div className="animate-in fade-in duration-200">
              <JobRoleBulkAssignPanel
                isFa={isFa}
                currentUser={currentUser}
                units={units}
                jobTitles={jobTitles}
                courseDefs={courseDefs}
                trainingNeeds={trainingNeeds}
                courses={courses}
                onSaveTrainingNeed={saveTrainingNeedEntry}
                onDeleteTrainingNeed={deleteTrainingNeed}
                onAssignmentCompleted={(updatedCourses, updatedEvents) => {
                  if (Array.isArray(updatedCourses)) setCourses(updatedCourses);
                  if (Array.isArray(updatedEvents)) setCalendarEvents(updatedEvents);
                }}
              />
            </div>
          )}

          {/* ========================================================
              TAB 4: COMPLEX PERSONNEL RECORDS (سوابق آموزش پرسنل مجتمع)
             ======================================================== */}
          {activeTab === 'course' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Add Certificate Form */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base">
                      {isFa ? 'ثبت سابقه و گواهینامه دوره برای پرسنل مجتمع' : 'Record Personnel Training & Certificate'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    {isFa ? 'اتصال هوشمند به مخزن مرکزی پرسنل' : 'Connected to central personnel master data'}
                  </span>
                </div>

                <form onSubmit={addCourse} className="space-y-4">
                  {/* Master Personnel Selector */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <CentralPersonnelSelector
                      language={isFa ? 'fa' : 'en'}
                      label={isFa ? 'انتخاب فراگیر / پرسنل شرکت‌کننده در دوره آموزشی:' : 'Select Trainee from Master Data:'}
                      required
                      selectedPersonnelCode={newCourse.personnelCode}
                      onSelectPersonnel={(p, org) => {
                        if (p) {
                          setNewCourse(prev => ({
                            ...prev,
                            personnelCode: p.effectiveCode || p.personnelCode,
                            firstName: p.firstName,
                            lastName: p.lastName,
                            unit: org.unit || p.unit,
                            jobTitle: p.jobTitle || ''
                          }));
                        } else {
                          setNewCourse(prev => ({
                            ...prev,
                            personnelCode: '',
                            firstName: '',
                            lastName: '',
                            unit: '',
                            jobTitle: ''
                          }));
                        }
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-5 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        {isFa ? 'انتخاب دوره گذرانده‌شده:' : 'Completed Course:'} *
                      </label>
                      <select 
                        value={newCourse.courseCode} 
                        onChange={e => setNewCourse({...newCourse, courseCode: e.target.value})} 
                        className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-bold shadow-2xs cursor-pointer" 
                        required
                      >
                        <option value="">{isFa ? 'انتخاب دوره از کاتالوگ...' : 'Select course from catalog...'}</option>
                        {availableCourseDefs.map((c, idx) => (
                          <option key={`${c.id || 'c'}-${idx}`} value={c.code}>
                            {c.code} - {c.title} ({c.duration} {isFa ? 'ساعت' : 'Hr'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-4 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        {isFa ? 'تاریخ برگزاری دوره:' : 'Training Date:'}
                      </label>
                      <div className="w-full">
                        <PersianDatePicker
                          value={newCourse.date}
                          onChange={(jStr) => setNewCourse({...newCourse, date: jStr})}
                          isFa={isFa}
                          placeholder={isFa ? 'انتخاب تاریخ برگزاری...' : 'Select date...'}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm text-xs h-[42px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isFa ? 'ثبت سابقه آموزشی' : 'Record Training'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Search & Unit Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 rtl:right-3 rtl:left-auto" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder={isFa ? 'جستجو در نام، شماره پرسنلی یا کد دوره...' : 'Search name, personnel code, or course...'}
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={selectedUnitFilter}
                    onChange={e => setSelectedUnitFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                  >
                    <option value="">{isFa ? 'همه واحدها' : 'All Units'}</option>
                    {units.map((u, i) => (
                      <option key={i} value={u}>{u}</option>
                    ))}
                  </select>

                  <select
                    value={selectedCourseStatusFilter}
                    onChange={e => setSelectedCourseStatusFilter(e.target.value as 'all' | 'completed' | 'assigned')}
                    className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none"
                  >
                    <option value="all">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
                    <option value="completed">{isFa ? 'گذرانده‌شده' : 'Completed'}</option>
                    <option value="assigned">{isFa ? 'تخصیص‌داده‌شده (در انتظار)' : 'Assigned (Pending)'}</option>
                  </select>
                </div>

                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 self-end sm:self-auto">
                  {isFa ? `تعداد کل: ${filteredCourses.length} سابقه` : `Total: ${filteredCourses.length} records`}
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-right whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                    <tr>
                      <th className="px-4 py-3.5 text-center w-14 text-slate-400">#</th>
                      <th className="px-4 py-3.5">{isFa ? 'نام و نام خانوادگی' : 'Full Name'}</th>
                      <th className="px-4 py-3.5 text-center">{isFa ? 'شماره پرسنلی' : 'Personnel Code'}</th>
                      <th className="px-4 py-3.5 text-center">{isFa ? 'واحد سازمانی' : 'Unit'}</th>
                      <th className="px-4 py-3.5 text-center">{isFa ? 'عنوان شغلی' : 'Job Title'}</th>
                      <th className="px-4 py-3.5 text-center">{isFa ? 'کد دوره' : 'Course Code'}</th>
                      <th className="px-4 py-3.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-x border-slate-200 dark:border-slate-800/80">
                        {isFa ? 'ساعت' : 'Hours'}
                      </th>
                      <th className="px-4 py-3.5 text-center">{isFa ? 'وضعیت و مهلت' : 'Status & Deadline'}</th>
                      <th className="px-4 py-3.5 text-center">{isFa ? 'تاریخ برگزاری / تخصیص' : 'Date'}</th>
                      <th className="px-4 py-3.5 text-center w-24">{isFa ? 'عملیات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredCourses.map((c, idx) => {
                      const courseTitle = c.courseTitle || courseDefs.find(cd => cd.code === c.courseCode)?.title || c.courseCode;
                      const isAssigned = c.status === 'assigned' || c.status === 'in_progress';
                      return (
                        <tr key={`${c.id || 'course'}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-black text-slate-900 dark:text-slate-100">
                            {c.firstName} {c.lastName}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {c.personnelCode}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">{c.unit}</td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-700 dark:text-slate-300">{c.jobTitle}</td>
                          <td className="px-4 py-3.5 text-center font-mono font-black text-blue-600 dark:text-blue-400" title={courseTitle}>
                            <span className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 px-2 py-0.5 rounded-lg">
                              {c.courseCode}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-black bg-blue-50/30 dark:bg-blue-950/20 text-slate-800 dark:text-slate-200 border-x border-slate-100 dark:border-slate-800/60">
                            {c.hours}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {isAssigned ? (
                              <div className="inline-flex flex-col items-center gap-0.5" title={c.overrideReason ? `تمدید: ${c.overrideReason}` : c.assignedBy ? `تخصیص‌دهنده: ${c.assignedBy}` : undefined}>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  {c.isRenewalOverride
                                    ? isFa ? 'تخصیص مجدد (تمدید)' : 'Renewal Assigned'
                                    : isFa ? 'تخصیص‌داده‌شده' : 'Assigned'}
                                </span>
                                {c.dueDate && (
                                  <span className="text-[10px] font-mono font-bold text-slate-500">
                                    {isFa ? `مهلت: ${c.dueDate}` : `Due: ${c.dueDate}`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {isFa ? 'گذرانده‌شده' : 'Completed'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono">
                            {c.date ? (
                              <DualDateBadge date={c.date} mode="both" showTooltip />
                            ) : c.assignedDate ? (
                              <div className="space-y-0.5">
                                <DualDateBadge date={c.assignedDate} mode="both" showTooltip />
                                {c.assignedBy && (
                                  <div className="text-[10px] font-sans font-bold text-slate-400">
                                    {c.assignedBy}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1">
                              {isAssigned && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkCourseCompleted(c)}
                                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 p-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
                                  title={isFa ? 'ثبت اتمام و گذراندن دوره' : 'Mark Completed'}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => deleteCourse(c.id)} 
                                className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer" 
                                title={isFa ? 'حذف سابقه' : 'Delete'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCourses.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                          {isFa ? 'هیچ سابقه‌ای برای پرسنل یافت نشد.' : 'No personnel course records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-black">
                    <tr>
                      <td colSpan={6} className="px-4 py-3.5 text-right">{isFa ? 'مجموع ساعت آموزش گذرانده‌شده پرسنل' : 'Total Completed Training Hours'}</td>
                      <td className="px-4 py-3.5 text-center font-mono font-black bg-blue-100/40 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-x border-slate-200 dark:border-slate-700">
                        {filteredCourses
                          .filter((c) => !c.status || c.status === 'completed')
                          .reduce((acc, c) => acc + (Number(c.hours) || 0), 0)
                          .toLocaleString()}{' '}
                        {isFa ? 'ساعت' : 'hrs'}
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 5: CONTRACTORS RECORDS (سوابق آموزش شرکت‌ها و پیمانکاران)
             ======================================================== */}
          {activeTab === 'contractor' && (
            <ContractorTrainingPanel
              isFa={isFa}
              currentUser={currentUser}
              jobTitles={jobTitles}
              onContractorsSynced={(synced) => setContractors(synced)}
            />
          )}
        </SubViewTransition>

        {/* --- CONFIRM DELETE MODAL --- */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <div className="p-3 bg-red-100 dark:bg-red-950/60 rounded-2xl border border-red-200 dark:border-red-900/60">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">{isFa ? 'تایید حذف اطلاعات' : 'Confirm Delete'}</h4>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-relaxed">{deleteConfirm.title}</p>
                {deleteConfirm.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{deleteConfirm.description}</p>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={deleteConfirm.onConfirm}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  {isFa ? 'حذف قطعی' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
