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
import SearchableSelect from './SearchableSelect';
import { getUnits, getJobTitles } from '../utils/orgHelper';
import { findPersonnelByCode } from '../utils/personnelHelper';
import CentralPersonnelSelector from './CentralPersonnelSelector';
import { apiDb } from '../services/apiDatabaseClient';

interface TrainingMgmtProps {
  isFa: boolean;
  currentUser: any;
}

interface ContractorData {
  id: string;
  name: string;
  headcount: number;
  perCapita: number;
}

interface CourseData {
  id: string;
  firstName: string;
  lastName: string;
  personnelCode: string;
  unit: string;
  jobTitle: string;
  courseCode: string;
  hours: number;
  date?: string;
}

interface CourseDef {
  id: string;
  code: string;
  title: string;
  duration: number;
}

interface TrainingNeed {
  id: string;
  unit: string;
  jobTitle: string;
  courseCodes: string[];
}

interface CalendarEvent {
  id: string;
  courseCode: string;
  title: string;
  duration: number;
  date: string;
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

  // Contractor Data
  const [contractors, setContractors] = useState<ContractorData[]>([]);

  const [newContractor, setNewContractor] = useState({ name: '', headcount: '', perCapita: '' });

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

  const [newNeed, setNewNeed] = useState({ unit: '', jobTitle: '', courseCodes: [] as string[] });

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
    return () => {
      window.removeEventListener('app_data_mutated', handleDataMutation);
      window.removeEventListener('hse_data_mutated', handleDataMutation);
      window.removeEventListener('hse_training_updated', loadTrainingDataFromDb);
    };
  }, [loadTrainingDataFromDb]);

  const saveContractors = (next: ContractorData[]) => {
    setContractors(next);
    apiDb.saveTrainingContractors(next).catch(console.error);
  };

  const saveCourses = (next: CourseData[]) => {
    setCourses(next);
    apiDb.saveTrainingCourses(next).catch(console.error);
  };

  const saveCourseDefs = (next: CourseDef[]) => {
    setCourseDefs(next);
    apiDb.saveTrainingCourseDefs(next).catch(console.error);
  };

  const saveTrainingNeedsList = (next: TrainingNeed[]) => {
    setTrainingNeeds(next);
    apiDb.saveTrainingNeeds(next).catch(console.error);
  };

  const saveCalendarEventsList = (next: CalendarEvent[]) => {
    setCalendarEvents(next);
    apiDb.saveTrainingCalendarEvents(next).catch(console.error);
  };

  const addContractor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContractor.name || !newContractor.headcount || !newContractor.perCapita) return;
    
    const next = [...contractors, {
      id: Date.now().toString(),
      name: newContractor.name.trim(),
      headcount: Number(newContractor.headcount),
      perCapita: Number(newContractor.perCapita)
    }];
    saveContractors(next);
    setNewContractor({ name: '', headcount: '', perCapita: '' });
  };

  // Delete confirm modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  const deleteContractor = (id: string) => {
    if (currentUser?.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const contractor = contractors.find(c => c.id === id);
    const name = contractor ? contractor.name : '';
    setDeleteConfirm({
      title: isFa ? `آیا از حذف شرکت پیمانکار "${name}" اطمینان دارید؟` : `Delete contractor "${name}"?`,
      description: isFa ? 'اطلاعات پرسنل و ساعت سرانه این شرکت حذف خواهد شد.' : 'Personnel headcount and hours will be removed.',
      onConfirm: () => {
        const next = contractors.filter(c => c.id !== id);
        saveContractors(next);
        setDeleteConfirm(null);
      }
    });
  };

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
    
    const next = [...courses, {
      id: Date.now().toString(),
      firstName: newCourse.firstName.trim(),
      lastName: newCourse.lastName.trim(),
      personnelCode: newCourse.personnelCode.trim(),
      unit: newCourse.unit.trim(),
      jobTitle: newCourse.jobTitle.trim(),
      courseCode: newCourse.courseCode.trim(),
      hours: hours,
      date: newCourse.date
    }];
    saveCourses(next);
    setNewCourse({ firstName: '', lastName: '', personnelCode: '', unit: '', jobTitle: '', courseCode: '', date: '' });
  };

  const deleteCourse = (id: string) => {
    if (currentUser?.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
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
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
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

  const addTrainingNeed = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNeed.unit || !newNeed.jobTitle || newNeed.courseCodes.length === 0) return;
    
    // Check if matrix for this unit & jobTitle already exists
    const existingIndex = trainingNeeds.findIndex(n => n.unit === newNeed.unit && n.jobTitle === newNeed.jobTitle);
    let next: TrainingNeed[];
    if (existingIndex >= 0) {
      // Merge unique codes
      const mergedCodes = Array.from(new Set([...trainingNeeds[existingIndex].courseCodes, ...newNeed.courseCodes]));
      next = [...trainingNeeds];
      next[existingIndex] = { ...next[existingIndex], courseCodes: mergedCodes };
    } else {
      next = [...trainingNeeds, {
        id: Date.now().toString(),
        unit: newNeed.unit,
        jobTitle: newNeed.jobTitle,
        courseCodes: newNeed.courseCodes
      }];
    }
    
    saveTrainingNeedsList(next);
    setNewNeed({ unit: '', jobTitle: '', courseCodes: [] });
  };

  const deleteTrainingNeed = (id: string) => {
    if (currentUser?.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
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

  const toggleCourseCodeForNeed = (code: string) => {
    setNewNeed(prev => {
      const current = prev.courseCodes;
      if (current.includes(code)) {
        return { ...prev, courseCodes: current.filter(c => c !== code) };
      } else {
        return { ...prev, courseCodes: [...current, code] };
      }
    });
  };

  // High-level KPIs calculation
  const totalComplexHours = useMemo(() => {
    return courses.reduce((acc, c) => acc + (Number(c.hours) || 0), 0);
  }, [courses]);

  const totalContractorHours = useMemo(() => {
    return contractors.reduce((acc, c) => acc + ((Number(c.headcount) || 0) * (Number(c.perCapita) || 0)), 0);
  }, [contractors]);

  const totalContractorHeadcount = useMemo(() => {
    return contractors.reduce((acc, c) => acc + (Number(c.headcount) || 0), 0);
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
        ? `${c.firstName} ${c.lastName} ${c.personnelCode} ${c.courseCode} ${c.unit} ${c.jobTitle}`.toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      const matchUnit = selectedUnitFilter ? c.unit === selectedUnitFilter : true;
      return matchSearch && matchUnit;
    });
  }, [courses, searchTerm, selectedUnitFilter]);

  // Filtered Contractors
  const filteredContractors = useMemo(() => {
    if (!searchTerm) return contractors;
    return contractors.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [contractors, searchTerm]);

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
                  className={`sm:flex-1 sm:min-w-[160px] py-2.5 sm:py-3 px-2.5 sm:px-3.5 rounded-2xl text-[11px] sm:text-xs md:text-sm font-black transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 ${
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
        <div className="p-5 md:p-7">
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
                  alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
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
              TAB 3: TRAINING NEEDS (نیازسنجی آموزشی)
             ======================================================== */}
          {activeTab === 'needs' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Needs Definition Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base">
                      {isFa ? 'ماتریس نیازسنجی آموزشی بر اساس واحد سازمانی و سمت شغلی' : 'Training Needs Analysis Matrix'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    {isFa ? 'تخصیص دوره‌های اجباری و شایستگی' : 'Assign mandatory courses to job roles'}
                  </span>
                </div>

                <form onSubmit={addTrainingNeed} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-4 space-y-1.5 relative">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'واحد سازمانی:' : 'Organizational Unit:'} *
                    </label>
                    <SearchableSelect 
                      options={units} 
                      value={newNeed.unit} 
                      onChange={(val) => setNewNeed({...newNeed, unit: val})} 
                      placeholder={isFa ? 'انتخاب واحد...' : 'Select unit...'}
                      isFa={isFa}
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1.5 relative">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'عنوان رده شغلی:' : 'Job Title:'} *
                    </label>
                    <SearchableSelect 
                      options={jobTitles} 
                      value={newNeed.jobTitle} 
                      onChange={(val) => setNewNeed({...newNeed, jobTitle: val})} 
                      placeholder={isFa ? 'انتخاب عنوان شغلی...' : 'Select job title...'}
                      isFa={isFa}
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'دوره‌های موردنیاز (انتخاب چندگانه):' : 'Required Courses (Multi-select):'} *
                    </label>
                    <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-2xl p-2.5 max-h-36 overflow-y-auto flex flex-wrap gap-1.5 shadow-2xs custom-scrollbar">
                      {courseDefs.length === 0 ? (
                        <span className="text-xs text-slate-400 dark:text-slate-500 p-1 font-bold">
                          {isFa ? 'ابتدا در تب تعریف دوره کدی اضافه فرمایید.' : 'Add courses in Course Definition tab first.'}
                        </span>
                      ) : (
                        courseDefs.map((c, idx) => {
                          const isSelected = newNeed.courseCodes.includes(c.code);
                          return (
                            <button
                              type="button"
                              key={`${c.id || 'code'}-${idx}`}
                              onClick={() => toggleCourseCodeForNeed(c.code)}
                              className={`text-[11px] px-2.5 py-1 rounded-xl border font-mono font-black transition-all cursor-pointer ${
                                isSelected 
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600'
                              }`}
                              title={c.title}
                            >
                              {c.code}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-12 flex justify-end pt-1">
                    <button 
                      type="submit" 
                      className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black py-2.5 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isFa ? 'افزودن به ماتریس نیازسنجی' : 'Add to Needs Matrix'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-right whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                    <tr>
                      <th className="px-4 py-3.5 text-center w-14 text-slate-400">#</th>
                      <th className="px-4 py-3.5 w-48">{isFa ? 'واحد سازمانی' : 'Unit'}</th>
                      <th className="px-4 py-3.5 w-48">{isFa ? 'عنوان شغلی' : 'Job Title'}</th>
                      <th className="px-4 py-3.5">{isFa ? 'دوره‌های الزامی تخصیص‌یافته' : 'Assigned Mandatory Courses'}</th>
                      <th className="px-4 py-3.5 text-center w-20">{isFa ? 'عملیات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {trainingNeeds.map((n, idx) => (
                      <tr key={`${n.id || 'need'}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                        <td className="px-4 py-3.5 font-black text-slate-900 dark:text-slate-100">{n.unit}</td>
                        <td className="px-4 py-3.5 font-bold text-slate-700 dark:text-slate-300">{n.jobTitle}</td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                          <div className="flex flex-wrap gap-1.5">
                            {n.courseCodes.map((code, cIdx) => {
                              const courseTitle = courseDefs.find(cd => cd.code === code)?.title;
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
                          <button 
                            onClick={() => deleteTrainingNeed(n.id)} 
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer" 
                            title={isFa ? 'حذف نیازسنجی' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {trainingNeeds.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                          {isFa ? 'هیچ رکورد نیازسنجی ثبت نشده است.' : 'No training needs records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
                      <th className="px-4 py-3.5 text-center">{isFa ? 'تاریخ برگزاری' : 'Date'}</th>
                      <th className="px-4 py-3.5 text-center w-20">{isFa ? 'عملیات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredCourses.map((c, idx) => {
                      const courseTitle = courseDefs.find(cd => cd.code === c.courseCode)?.title || c.courseCode;
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
                          <td className="px-4 py-3.5 text-center font-mono">
                            {c.date ? (
                              <DualDateBadge date={c.date} mode="both" showTooltip />
                            ) : (
                              <span className="text-slate-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button 
                              onClick={() => deleteCourse(c.id)} 
                              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer" 
                              title={isFa ? 'حذف سابقه' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCourses.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                          {isFa ? 'هیچ سابقه‌ای برای پرسنل یافت نشد.' : 'No personnel course records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-black">
                    <tr>
                      <td colSpan={6} className="px-4 py-3.5 text-right">{isFa ? 'مجموع ساعت آموزش ثبت‌شده پرسنل' : 'Total Training Hours'}</td>
                      <td className="px-4 py-3.5 text-center font-mono font-black bg-blue-100/40 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-x border-slate-200 dark:border-slate-700">
                        {filteredCourses.reduce((acc, c) => acc + (Number(c.hours) || 0), 0).toLocaleString()} {isFa ? 'ساعت' : 'hrs'}
                      </td>
                      <td colSpan={2}></td>
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
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Add Contractor Form */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base">
                      {isFa ? 'ثبت آمار و ساعات آموزش شرکت‌ها و پیمانکاران' : 'Record Contractor Company Training Hours'}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    {isFa ? 'محاسبه خودکار نفر-ساعت و سرانه آموزش' : 'Auto man-hours & per capita calculation'}
                  </span>
                </div>

                <form onSubmit={addContractor} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'نام شرکت / پیمانکار:' : 'Company / Contractor:'} *
                    </label>
                    <input 
                      type="text" 
                      value={newContractor.name} 
                      onChange={e => setNewContractor({...newContractor, name: e.target.value})} 
                      className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-bold shadow-2xs" 
                      placeholder={isFa ? 'مثال: شرکت فنی مهندسی فرآیند سازان' : 'Company name...'}
                      required 
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'تعداد نفرات شاغل:' : 'Headcount:'} *
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      value={newContractor.headcount} 
                      onChange={e => setNewContractor({...newContractor, headcount: e.target.value})} 
                      className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-2xs" 
                      placeholder="50"
                      required 
                    />
                  </div>

                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      {isFa ? 'ساعت سرانه آموزش (ساعت/نفر):' : 'Per Capita Hours:'} *
                    </label>
                    <input 
                      type="number" 
                      step="0.1" 
                      min="0.1"
                      value={newContractor.perCapita} 
                      onChange={e => setNewContractor({...newContractor, perCapita: e.target.value})} 
                      className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-2xs" 
                      placeholder="4.5"
                      required 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <button 
                      type="submit" 
                      className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black py-2.5 px-4 rounded-2xl flex items-center justify-center gap-1.5 transition-all h-[42px] cursor-pointer shadow-sm text-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isFa ? 'افزودن پیمانکار' : 'Add Contractor'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <table className="w-full text-xs text-right whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                    <tr>
                      <th className="px-4 py-3.5 text-center w-14 text-slate-400">#</th>
                      <th className="px-4 py-3.5">{isFa ? 'شرکت / پیمانکار' : 'Company'}</th>
                      <th className="px-4 py-3.5 text-center w-28">{isFa ? 'تعداد نفر' : 'Headcount'}</th>
                      <th className="px-4 py-3.5 text-center w-28">{isFa ? 'ساعت سرانه' : 'Per Capita'}</th>
                      <th className="px-4 py-3.5 text-center w-32">{isFa ? 'مجموع ساعت' : 'Total Hours'}</th>
                      <th className="px-4 py-3.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-x border-slate-200 dark:border-slate-800/80 w-32">
                        {isFa ? 'مجموع به ساعت' : 'Hours'}
                      </th>
                      <th className="px-4 py-3.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-r border-slate-200 dark:border-slate-800/80 w-32">
                        {isFa ? 'دقیقه' : 'Minutes'}
                      </th>
                      <th className="px-4 py-3.5 text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 border-r border-slate-200 dark:border-slate-800/80 w-32">
                        {isFa ? 'ثانیه' : 'Seconds'}
                      </th>
                      <th className="px-4 py-3.5 text-center w-20">{isFa ? 'عملیات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredContractors.map((c, idx) => {
                      const total = (Number(c.headcount) || 0) * (Number(c.perCapita) || 0);
                      const hours = total * 24;
                      const mins = hours * 60;
                      const secs = mins * 60;
                      return (
                        <tr key={`${c.id || 'contractor'}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3.5 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-black text-slate-900 dark:text-slate-100">{c.name}</td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {(Number(c.headcount) || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                            {(Number(c.perCapita) || 0)}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                            {total.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold bg-blue-50/30 dark:bg-blue-950/20 text-slate-800 dark:text-slate-200 border-x border-slate-100 dark:border-slate-800/60">
                            {hours.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold bg-blue-50/30 dark:bg-blue-950/20 text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800/60">
                            {mins.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-center font-mono font-bold bg-blue-50/30 dark:bg-blue-950/20 text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800/60">
                            {secs.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button 
                              onClick={() => deleteContractor(c.id)} 
                              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer" 
                              title={isFa ? 'حذف پیمانکار' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredContractors.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">
                          {isFa ? 'هیچ پیمانکاری ثبت نشده است.' : 'No contractor training records found.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-950 border-t-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-black">
                    <tr>
                      <td colSpan={2} className="px-4 py-3.5 text-right">{isFa ? 'مجموع کل پیمانکاران' : 'Total Contractors'}</td>
                      <td className="px-4 py-3.5 text-center font-mono font-black text-slate-900 dark:text-white">
                        {totalContractorHeadcount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-center"></td>
                      <td className="px-4 py-3.5 text-center font-mono font-black text-blue-600 dark:text-blue-400">
                        {totalContractorHours.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-black bg-blue-100/40 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-x border-slate-200 dark:border-slate-700">
                        {contractors.reduce((acc, c) => acc + ((Number(c.headcount) || 0) * (Number(c.perCapita) || 0) * 24), 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-black bg-blue-100/40 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-r border-slate-200 dark:border-slate-700">
                        {contractors.reduce((acc, c) => acc + ((Number(c.headcount) || 0) * (Number(c.perCapita) || 0) * 24 * 60), 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-black bg-blue-100/40 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-r border-slate-200 dark:border-slate-700">
                        {contractors.reduce((acc, c) => acc + ((Number(c.headcount) || 0) * (Number(c.perCapita) || 0) * 24 * 60 * 60), 0).toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

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
