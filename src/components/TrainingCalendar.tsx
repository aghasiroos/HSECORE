import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  Info, 
  Trash2, 
  Plus, 
  CalendarDays,
  Sparkles,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import moment from 'moment-jalaali';
import PersianTimePicker from './common/PersianTimePicker';

const HOLIDAYS_DATA: Record<string, string> = {};
const OCCASIONS_DATA: Record<string, string> = {};

interface CourseData {
  id: string;
  name: string;
  headcount: number;
  hours: number;
  date?: string; // Stored as YYYY/MM/DD
}

interface CalendarEvent {
  id: string;
  courseCode: string;
  title: string;
  duration: number;
  date: string;
  time?: string;
}

interface CourseDef {
  id: string;
  code: string;
  title: string;
  duration: number;
}

export default function TrainingCalendar({ 
  courses, 
  calendarEvents = [],
  courseDefs = [],
  onAddEvent,
  onDeleteEvent,
  isFa 
}: { 
  courses: CourseData[];
  calendarEvents?: CalendarEvent[];
  courseDefs?: CourseDef[];
  onAddEvent?: (evt: CalendarEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
  isFa: boolean;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => moment());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const isJalali = isFa;

  const nextMonth = () => {
    if (isJalali) {
      setCurrentMonth(moment(currentMonth).add(1, 'jMonth'));
    } else {
      setCurrentMonth(moment(currentMonth).add(1, 'months'));
    }
    setSelectedDate(null);
  };

  const prevMonth = () => {
    if (isJalali) {
      setCurrentMonth(moment(currentMonth).subtract(1, 'jMonth'));
    } else {
      setCurrentMonth(moment(currentMonth).subtract(1, 'months'));
    }
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentMonth(moment());
    if (isJalali) {
      const todayStr = `${moment().jYear()}/${String(moment().jMonth() + 1).padStart(2, '0')}/${String(moment().jDate()).padStart(2, '0')}`;
      setSelectedDate(todayStr);
    } else {
      setSelectedDate(moment().format('YYYY-MM-DD'));
    }
  };

  const getCalendarDays = () => {
    const days = [];
    const blanks = [];
    let daysInMonth, firstDay;

    if (isJalali) {
      daysInMonth = moment.jDaysInMonth(currentMonth.jYear(), currentMonth.jMonth());
      const startOfMonth = moment(`${currentMonth.jYear()}/${currentMonth.jMonth() + 1}/1`, 'jYYYY/jM/jD');
      const dayOfWeek = startOfMonth.day();
      firstDay = (dayOfWeek + 1) % 7;
      
      for (let i = 0; i < firstDay; i++) blanks.push(i);
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
      }
    } else {
      daysInMonth = currentMonth.daysInMonth();
      const startOfMonth = moment(currentMonth).startOf('month');
      firstDay = startOfMonth.day();

      for (let i = 0; i < firstDay; i++) blanks.push(i);
      for (let i = 1; i <= daysInMonth; i++) {
        days.push(i);
      }
    }

    return { days, blanks };
  };

  const { days, blanks } = getCalendarDays();

  const jalaliMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

  const monthTitle = isJalali
    ? `${jalaliMonths[currentMonth.jMonth()]} ${currentMonth.jYear()}`
    : currentMonth.format('MMMM YYYY');

  const weekDays = isJalali
    ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const weekDayNamesFull = isJalali
    ? ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const getFormattedDateStr = (day: number) => {
    if (isJalali) {
      const jYear = currentMonth.jYear();
      const jMonth = String(currentMonth.jMonth() + 1).padStart(2, '0');
      const jDay = String(day).padStart(2, '0');
      return `${jYear}/${jMonth}/${jDay}`;
    } else {
      const year = currentMonth.year();
      const month = String(currentMonth.month() + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      return `${year}-${month}-${d}`;
    }
  };

  const getCoursesForDate = (dateStr: string) => {
    const personnelCourses = courses.filter(c => c.date === dateStr);
    const addedEvents = calendarEvents.filter(e => e.date === dateStr);
    return { personnelCourses, addedEvents };
  };

  const selectedDateData = selectedDate ? getCoursesForDate(selectedDate) : { personnelCourses: [], addedEvents: [] };

  const displaySelectedDate = () => {
    if (!selectedDate) return isFa ? 'انتخاب نشده' : 'None';
    return selectedDate;
  };

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventCode, setNewEventCode] = useState('');
  const [newEventTime, setNewEventTime] = useState('');

  const handleAddEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !newEventCode || !onAddEvent) return;
    const def = courseDefs.find(c => c.code === newEventCode);
    if (!def) return;

    onAddEvent({
      id: Date.now().toString(),
      courseCode: def.code,
      title: def.title,
      duration: def.duration,
      date: selectedDate,
      time: newEventTime
    });
    setNewEventCode('');
    setNewEventTime('');
    setIsAddingEvent(false);
  };

  // Month Statistics
  const monthStats = React.useMemo(() => {
    let plannedEvents = 0;
    let completedSessions = 0;
    let totalPlannedHours = 0;

    days.forEach(day => {
      const dStr = getFormattedDateStr(day);
      const { personnelCourses, addedEvents } = getCoursesForDate(dStr);
      plannedEvents += addedEvents.length;
      completedSessions += personnelCourses.length;
      addedEvents.forEach(e => totalPlannedHours += (Number(e.duration) || 0));
      personnelCourses.forEach(c => totalPlannedHours += (Number(c.hours) || 0));
    });

    return {
      plannedEvents,
      completedSessions,
      totalHours: totalPlannedHours,
      totalDaysWithTraining: days.filter(day => {
        const dStr = getFormattedDateStr(day);
        const { personnelCourses, addedEvents } = getCoursesForDate(dStr);
        return personnelCourses.length > 0 || addedEvents.length > 0;
      }).length
    };
  }, [days, courses, calendarEvents]);

  // Today representation for current month
  const todayDateStr = isJalali
    ? `${moment().jYear()}/${String(moment().jMonth() + 1).padStart(2, '0')}/${String(moment().jDate()).padStart(2, '0')}`
    : moment().format('YYYY-MM-DD');

  return (
    <div className="space-y-5 animate-in fade-in duration-200" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
      {/* Top Quick Stats Bar for Month */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'رویدادهای زمان‌بندی‌شده ماه' : 'Scheduled Events'}
            </div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
              {monthStats.plannedEvents} <span className="text-xs font-normal text-slate-400">{isFa ? 'دوره' : 'courses'}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'کلاس‌های پرسنلی برگزارشده' : 'Completed Sessions'}
            </div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
              {monthStats.completedSessions} <span className="text-xs font-normal text-slate-400">{isFa ? 'جلسه' : 'sessions'}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'مجموع ساعت آموزش ماه' : 'Total Month Hours'}
            </div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
              {monthStats.totalHours.toLocaleString()} <span className="text-xs font-normal text-slate-400">{isFa ? 'ساعت' : 'hours'}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'روزهای فعال آموزشی' : 'Active Training Days'}
            </div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
              {monthStats.totalDaysWithTraining} <span className="text-xs font-normal text-slate-400">{isFa ? 'روز' : 'days'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Calendar Matrix */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm">
            {/* Calendar Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>{monthTitle}</span>
                  </h3>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {isFa ? 'تقویم رسمی و برنامه‌ریزی دوره‌های ایمنی و فنی' : 'Official training schedule & timeline'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={goToToday}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  {isFa ? 'امروز' : 'Today'}
                </button>
                <div className="flex gap-1" dir="ltr">
                  <button 
                    onClick={isFa ? nextMonth : prevMonth} 
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
                    title={isFa ? 'ماه بعد' : 'Next Month'}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={isFa ? prevMonth : nextMonth} 
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs cursor-pointer"
                    title={isFa ? 'ماه قبل' : 'Previous Month'}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Day of Week Headers */}
            <div className={`grid grid-cols-7 gap-1.5 text-center mb-2.5 ${isFa ? 'rtl' : 'ltr'}`}>
              {weekDays.map((d, i) => (
                <div 
                  key={i} 
                  className={`text-xs font-black py-2 rounded-xl tracking-wider ${
                    (isFa ? i === 6 : (i === 0 || i === 6)) 
                      ? 'text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20' 
                      : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40'
                  }`}
                  title={weekDayNamesFull[i]}
                >
                  {d}
                </div>
              ))}
            </div>
            
            {/* Days Grid */}
            <div className={`grid grid-cols-7 gap-1.5 ${isFa ? 'rtl' : 'ltr'}`}>
              {blanks.map(b => (
                <div key={`blank-${b}`} className="min-h-[92px] p-2 rounded-2xl border border-transparent bg-slate-50/30 dark:bg-slate-900/20"></div>
              ))}
              {days.map(day => {
                const dateStr = getFormattedDateStr(day);
                const { personnelCourses, addedEvents } = getCoursesForDate(dateStr);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === todayDateStr;
                const hasCourses = personnelCourses.length > 0 || addedEvents.length > 0;
                const totalItems = personnelCourses.length + addedEvents.length;
                
                const colIndex = (blanks.length + day - 1) % 7;
                const isFriday = isJalali ? colIndex === 6 : colIndex === 5 || colIndex === 6;
                const holidayTitle = HOLIDAYS_DATA[dateStr];
                const occasionTitle = OCCASIONS_DATA[dateStr];
                const isHoliday = isFriday || !!holidayTitle;
                
                return (
                  <button
                    key={day}
                    onClick={() => { setSelectedDate(dateStr); setIsAddingEvent(false); }}
                    className={`
                      min-h-[92px] p-2 rounded-2xl border relative flex flex-col items-start transition-all cursor-pointer text-right group
                      ${isSelected 
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50/90 dark:bg-blue-950/70 ring-2 ring-blue-500/20 shadow-md scale-[1.02] z-10' 
                        : isToday
                          ? 'border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-xs'
                          : isHoliday 
                            ? 'border-rose-100 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-700/60' 
                            : 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 hover:border-blue-300 dark:hover:border-blue-600/60 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span className={`text-sm font-mono font-black tabular-nums tracking-tight ${
                        isSelected 
                          ? 'text-blue-700 dark:text-blue-300' 
                          : isToday
                            ? 'text-amber-700 dark:text-amber-300'
                            : isHoliday 
                              ? 'text-rose-600 dark:text-rose-400' 
                              : 'text-slate-800 dark:text-slate-100'
                      }`}>
                        {day}
                      </span>

                      {isToday && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500 text-white leading-none">
                          {isFa ? 'امروز' : 'Today'}
                        </span>
                      )}

                      {isHoliday && !isToday && (
                        <span 
                          className="text-[9px] text-rose-600 dark:text-rose-300 font-bold bg-rose-100 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/60 px-1 py-0.2 rounded truncate max-w-[70%]" 
                          title={holidayTitle || (isFa ? 'جمعه' : 'Friday')}
                        >
                          {holidayTitle || (isFa ? 'تعطیل' : 'Holiday')}
                        </span>
                      )}
                    </div>

                    {occasionTitle && !isHoliday && (
                      <span 
                        className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 ring-2 ring-white dark:ring-slate-900 absolute top-2.5 left-2.5 rtl:right-auto rtl:left-2.5" 
                        title={occasionTitle}
                      ></span>
                    )}

                    {hasCourses && (
                      <div className="mt-auto w-full flex flex-col gap-1 pt-1.5">
                        {addedEvents.slice(0, 1).map((e, i) => (
                          <div 
                            key={`e-${i}`} 
                            className="w-full text-[10px] font-black bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200/90 dark:border-blue-700/60 rounded-lg px-1.5 py-0.5 truncate text-right font-sans"
                            title={`[${e.courseCode}] ${e.title}`}
                          >
                            {e.title}
                          </div>
                        ))}
                        {personnelCourses.slice(0, addedEvents.length > 0 ? 1 : 2).map((c, i) => (
                          <div 
                            key={`p-${i}`} 
                            className="w-full text-[10px] font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/90 dark:border-emerald-800/60 rounded-lg px-1.5 py-0.5 truncate text-right font-sans"
                            title={`${c.name} (${c.headcount} ${isFa ? 'نفر' : 'people'})`}
                          >
                            {c.name}
                          </div>
                        ))}
                        {totalItems > 2 && (
                          <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono font-bold w-full text-right">
                            +{totalItems - 2} {isFa ? 'مورد دیگر' : 'more'}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-blue-100 border border-blue-300 dark:bg-blue-900/60 dark:border-blue-700"></span>
                <span>{isFa ? 'دوره زمان‌بندی‌شده تقویم' : 'Scheduled Course'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300 dark:bg-emerald-950/70 dark:border-emerald-800"></span>
                <span>{isFa ? 'سوابق ثبت‌شده پرسنل' : 'Personnel Sessions'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-100 border border-rose-300 dark:bg-rose-950/60 dark:border-rose-900"></span>
                <span>{isFa ? 'تعطیلات رسمی' : 'Official Holidays'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-amber-100 border border-amber-300 dark:bg-amber-950/60 dark:border-amber-800"></span>
                <span>{isFa ? 'امروز' : 'Today'}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Day Details & Event Scheduler Side Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-3.5">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-base">
                  {isFa ? 'رویدادهای تاریخ' : 'Events for'}
                </h3>
              </div>
              <span className="text-blue-600 dark:text-blue-400 font-mono font-black tracking-wider bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl text-xs shadow-xs">
                {displaySelectedDate()}
              </span>
            </div>
            
            <div className="space-y-3">
              {!selectedDate ? (
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center py-10 bg-white/50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <CalendarDays className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  {isFa ? 'یک روز را از تقویم بالا انتخاب فرمایید.' : 'Select a date from the calendar above.'}
                </div>
              ) : (
                <>
                  {selectedDateData.personnelCourses.length === 0 && selectedDateData.addedEvents.length === 0 && (
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center py-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1">
                      <p>{isFa ? 'هیچ دوره‌ای برای این روز ثبت نشده است.' : 'No courses scheduled for this day.'}</p>
                      <p className="text-[11px] text-slate-400">{isFa ? 'با زدن دکمه زیر می‌توانید دوره جدید تعریف کنید.' : 'Use the button below to add an event.'}</p>
                    </div>
                  )}
                  
                  {/* Scheduled Calendar Events */}
                  {selectedDateData.addedEvents.map((evt, evtIdx) => (
                    <div key={`${evt.id || 'evt'}-${evtIdx}`} className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/70 rounded-2xl p-3.5 shadow-xs space-y-2 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-600 dark:bg-blue-500"></div>
                      <div className="flex justify-between items-start gap-2 pr-2">
                        <div className="font-black text-slate-900 dark:text-white text-xs md:text-sm">
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-bold ml-1.5">[{evt.courseCode}]</span>
                          {evt.title}
                        </div>
                        {onDeleteEvent && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteEvent(evt.id);
                            }}
                            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                            title={isFa ? 'حذف رویداد' : 'Delete Event'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 pr-2">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="font-mono font-bold">{evt.duration}</span>
                          <span>{isFa ? 'ساعت' : 'hours'}</span>
                        </div>
                        {evt.time && (
                          <div className="flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg text-xs">
                            {evt.time}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Registered Personnel Sessions */}
                  {selectedDateData.personnelCourses.map((course, cIdx) => (
                    <div key={`${course.id || 'course'}-${cIdx}`} className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-3.5 shadow-xs space-y-2 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-600 dark:bg-emerald-500"></div>
                      <div className="font-black text-slate-900 dark:text-white text-xs md:text-sm pr-2">{course.name}</div>
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pr-2">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-mono font-bold">{course.headcount}</span>
                          <span>{isFa ? 'نفر شرکت‌کننده' : 'participants'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-mono font-bold">{course.hours}</span>
                          <span>{isFa ? 'ساعت' : 'hours'}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Event Form or Trigger Button */}
                  <div className="pt-2">
                    {isAddingEvent ? (
                      <form onSubmit={handleAddEventSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 animate-in slide-in-from-top-2">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-blue-600" />
                            {isFa ? 'برنامه‌ریزی دوره جدید در تقویم' : 'Schedule New Event'}
                          </span>
                        </div>

                        {selectedDate && (() => {
                          const isFriday = moment(selectedDate, isFa ? 'jYYYY/jMM/jDD' : 'YYYY-MM-DD').day() === 5;
                          const isHoliday = isFriday || !!HOLIDAYS_DATA[selectedDate];
                          if (isHoliday) {
                            return (
                              <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-bold p-2.5 rounded-xl flex gap-2 items-start border border-rose-200 dark:border-rose-900/60">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                                <p>{isFa ? 'توجه: این روز تعطیل است. ثبت برنامه آموزشی در روزهای تعطیل نیازمند هماهنگی است.' : 'Holiday note: Scheduling on holidays requires coordination.'}</p>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="space-y-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                              {isFa ? 'انتخاب عنوان دوره:' : 'Select Course:'} *
                            </label>
                            <select 
                              value={newEventCode} 
                              onChange={e => setNewEventCode(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-bold"
                              required
                            >
                              <option value="">{isFa ? 'انتخاب از لیست دوره‌ها...' : 'Select course...'}</option>
                              {courseDefs.map((def, defIdx) => (
                                <option key={`${def.id || 'def'}-${defIdx}`} value={def.code}>
                                  {def.code} - {def.title} ({def.duration} {isFa ? 'ساعت' : 'Hr'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                              {isFa ? 'ساعت برگزاری (۲۴ ساعته):' : 'Event Time (24h):'}
                            </label>
                            <PersianTimePicker
                              value={newEventTime}
                              onChange={(t) => setNewEventTime(t)}
                              isFa={isFa}
                              placeholder="09:00"
                              required
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button 
                            type="submit" 
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2 rounded-xl text-xs transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {isFa ? 'ثبت در تقویم' : 'Add Event'}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setIsAddingEvent(false)} 
                            className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            {isFa ? 'انصراف' : 'Cancel'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button 
                        onClick={() => setIsAddingEvent(true)}
                        className="w-full border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-2xl py-2.5 px-4 text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isFa ? 'افزودن رویداد آموزشی به این روز' : 'Add Training Event'}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Holiday / Occasion Information Card */}
          {selectedDate && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="font-black text-slate-900 dark:text-white text-xs md:text-sm">
                  {isFa ? 'وضعیت تقویمی و مناسبت‌ها' : 'Calendar & Occasions'}
                </h4>
              </div>
              
              {(() => {
                const dateObj = moment(selectedDate, isFa ? 'jYYYY/jMM/jDD' : 'YYYY-MM-DD');
                const isFriday = dateObj.day() === 5;
                const holidayTitle = HOLIDAYS_DATA[selectedDate];
                const occasionTitle = OCCASIONS_DATA[selectedDate];
                
                let dayType = isFa ? 'روز کاری رسمی' : 'Official Workday';
                let typeColor = 'text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
                
                if (holidayTitle) {
                  dayType = isFa ? 'تعطیل رسمی کشور' : 'Official Holiday';
                  typeColor = 'text-rose-700 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900/60';
                } else if (isFriday) {
                  dayType = isFa ? 'تعطیلات پایان هفته (جمعه)' : 'Weekend Holiday';
                  typeColor = 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/60';
                }
                
                return (
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-bold">{isFa ? 'وضعیت روز:' : 'Status:'}</span>
                      <span className={`px-2.5 py-1 rounded-xl font-black border text-[11px] ${typeColor}`}>
                        {dayType}
                      </span>
                    </div>
                    
                    {(holidayTitle || isFriday || occasionTitle) && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {holidayTitle && (
                          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                            <span className="font-black">•</span>
                            <span>{holidayTitle}</span>
                          </div>
                        )}
                        {occasionTitle && (
                          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold">
                            <span className="font-black">•</span>
                            <span>{occasionTitle}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
