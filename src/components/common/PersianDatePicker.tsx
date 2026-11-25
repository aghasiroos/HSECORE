import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Clock, 
  X, 
  Check, 
  Sparkles, 
  Globe, 
  RotateCcw,
  CalendarDays,
  Keyboard
} from 'lucide-react';
import {
  parseDateString,
  getTodayJalaliObj,
  getJalaliMonthDaysCount,
  getJalaliDayOfWeek,
  formatJalaliString,
  formatGregorianString,
  formatJalaliFullText,
  formatGregorianFullText,
  jalaliToGregorian,
  toEnglishDigits,
  JALALI_MONTH_NAMES_FA,
  PERSIAN_WEEK_DAYS_FA,
  getDualDateDisplay
} from '../../utils/jalaliDate';

export interface PersianDatePickerProps {
  value?: string | null;
  onChange?: (jalaliStr: string, gregorianStr?: string, details?: {
    shamsi: string;
    miladi: string;
    time: string;
    rawDate: Date;
  }) => void;
  placeholder?: string;
  isFa?: boolean;
  includeTime?: boolean;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  helperText?: string;
  className?: string;
  inputClassName?: string;
  showGregorianPreview?: boolean;
  minDate?: string;
  maxDate?: string;
  minYear?: number;
  maxYear?: number;
  allowManualInput?: boolean;
  id?: string;
}

type ViewMode = 'days' | 'months' | 'years';

export default function PersianDatePicker({
  value = '',
  onChange,
  placeholder,
  isFa = true,
  includeTime = false,
  disabled = false,
  required = false,
  label,
  helperText,
  className = '',
  inputClassName = '',
  showGregorianPreview = true,
  minYear = 1320,
  maxYear,
  allowManualInput = true,
  id
}: PersianDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('days');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedYearBtnRef = useRef<HTMLButtonElement>(null);

  // Parse current value
  const parsedValue = useMemo(() => parseDateString(value), [value]);
  const todayObj = useMemo(() => getTodayJalaliObj(), []);

  const effectiveMinYear = minYear || 1320;
  const effectiveMaxYear = maxYear ?? todayObj.jy;

  // View state (which month/year is currently being viewed)
  const [viewYear, setViewYear] = useState<number>(() => {
    const initialY = parsedValue.jalali?.jy || todayObj.jy;
    return Math.min(Math.max(initialY, effectiveMinYear), Math.max(effectiveMaxYear, todayObj.jy));
  });
  const [viewMonth, setViewMonth] = useState<number>(parsedValue.jalali?.jm || todayObj.jm); // 1-12

  // Time state (HH:mm)
  const [timeStr, setTimeStr] = useState<string>(() => {
    if (parsedValue.time) return parsedValue.time;
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Manual input text
  const [inputText, setInputText] = useState<string>(value || '');
  const [isHovered, setIsHovered] = useState(false);

  // Full list of selectable years (from effectiveMaxYear down to effectiveMinYear, e.g. current year down to 1320)
  const allYearsDesc = useMemo(() => {
    const start = Math.max(effectiveMinYear, effectiveMaxYear);
    const end = Math.min(effectiveMinYear, effectiveMaxYear);
    const list: number[] = [];
    for (let y = start; y >= end; y--) {
      list.push(y);
    }
    return list;
  }, [effectiveMinYear, effectiveMaxYear]);

  // Auto-scroll to currently active year when opening years grid
  useEffect(() => {
    if (isOpen && viewMode === 'years' && selectedYearBtnRef.current) {
      selectedYearBtnRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [isOpen, viewMode]);

  // Sync internal view when value prop changes externally (do NOT overwrite while user is typing)
  useEffect(() => {
    if (value) {
      if (!isInputFocused) {
        setInputText(value);
      }
      const p = parseDateString(value);
      if (p.jalali) {
        setViewYear(p.jalali.jy);
        setViewMonth(p.jalali.jm);
      }
      if (p.time) {
        setTimeStr(p.time);
      }
    } else if (!isInputFocused) {
      setInputText('');
    }
  }, [value, isInputFocused]);

  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(false);

  // Responsive and smart positioning for popup portal (safe down to 320px)
  const updatePosition = () => {
    if (containerRef.current) {
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const compact = vw < 480;
      setIsCompactViewport(compact);

      const popoverWidth = Math.min(350, vw - 16);

      if (compact) {
        setPopoverStyle({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${popoverWidth}px`,
          maxWidth: 'calc(100vw - 16px)',
          maxHeight: 'calc(100dvh - 24px)',
          overflowY: 'auto',
          zIndex: 99999,
        });
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const popoverHeight = Math.min(includeTime ? 500 : 440, vh - 24);

      const spaceBelow = vh - rect.bottom;
      const shouldOpenUp = spaceBelow < popoverHeight && rect.top > spaceBelow;
      const rawTop = shouldOpenUp ? rect.top - popoverHeight - 8 : rect.bottom + 8;
      const top = Math.max(8, Math.min(rawTop, vh - popoverHeight - 8));

      let right: number | undefined;
      let left: number | undefined;

      if (isFa) {
        const desiredRight = vw - rect.right;
        right = Math.max(8, Math.min(desiredRight, Math.max(8, vw - popoverWidth - 8)));
      } else {
        left = Math.max(8, Math.min(rect.left, Math.max(8, vw - popoverWidth - 8)));
      }

      setPopoverStyle({
        position: 'fixed',
        top: `${top}px`,
        width: `${popoverWidth}px`,
        maxWidth: 'calc(100vw - 16px)',
        maxHeight: 'calc(100dvh - 16px)',
        overflowY: 'auto',
        ...(right !== undefined ? { right: `${right}px` } : {}),
        ...(left !== undefined ? { left: `${left}px` } : {}),
        zIndex: 99999,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, viewMode, viewYear, viewMonth]);

  // Outside click & ESC listener (respecting both containerRef and popoverRef)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
        setViewMode('days');
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setViewMode('days');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Navigate months
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      const prevY = Math.max(effectiveMinYear, viewYear - 1);
      setViewMonth(12);
      setViewYear(prevY);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      const nextY = Math.min(effectiveMaxYear, viewYear + 1);
      setViewMonth(1);
      setViewYear(nextY);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Select day handler
  const handleSelectDay = (dayNum: number, targetMonth = viewMonth, targetYear = viewYear) => {
    const clampedYear = Math.min(Math.max(targetYear, effectiveMinYear), effectiveMaxYear);
    const maxDays = getJalaliMonthDaysCount(clampedYear, targetMonth);
    const clampedDay = Math.min(Math.max(dayNum, 1), maxDays);

    const jStr = formatJalaliString(clampedYear, targetMonth, clampedDay);
    const gObj = jalaliToGregorian(clampedYear, targetMonth, clampedDay);
    const gStr = formatGregorianString(gObj.gy, gObj.gm, gObj.gd);

    let finalJalali = jStr;
    let finalGregorian = gStr;
    const dateObj = new Date(gObj.gy, gObj.gm - 1, gObj.gd);

    if (includeTime) {
      const [h, m] = (timeStr || '08:00').split(':').map(n => parseInt(n, 10) || 0);
      dateObj.setHours(h, m, 0, 0);
      finalJalali = `${jStr} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      finalGregorian = `${gStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }

    setInputText(finalJalali);
    onChange?.(finalJalali, finalGregorian, {
      shamsi: finalJalali,
      miladi: finalGregorian,
      time: timeStr,
      rawDate: dateObj
    });

    if (!includeTime) {
      setIsOpen(false);
      setViewMode('days');
    }
  };

  // Jump to today
  const handleSelectToday = () => {
    const targetY = Math.min(Math.max(todayObj.jy, effectiveMinYear), effectiveMaxYear);
    setViewYear(targetY);
    setViewMonth(todayObj.jm);
    setViewMode('days');
    handleSelectDay(todayObj.jd, todayObj.jm, targetY);
  };

  // Clear date
  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setInputText('');
    onChange?.('', '', {
      shamsi: '',
      miladi: '',
      time: '',
      rawDate: new Date()
    });
  };

  // Commit / normalize manual date entry
  const commitManualInput = (rawText: string, normalizeFieldText: boolean) => {
    const clean = toEnglishDigits(rawText.trim());
    if (!clean) {
      onChange?.('', '', {
        shamsi: '',
        miladi: '',
        time: '',
        rawDate: new Date()
      });
      return;
    }

    const parsed = parseDateString(clean);
    if (parsed.jalali && parsed.gregorian) {
      const clampedY = Math.min(Math.max(parsed.jalali.jy, effectiveMinYear), effectiveMaxYear);
      const jm = Math.min(12, Math.max(1, parsed.jalali.jm));
      const maxD = getJalaliMonthDaysCount(clampedY, jm);
      const jd = Math.min(maxD, Math.max(1, parsed.jalali.jd));

      const jStr = formatJalaliString(clampedY, jm, jd);
      const gObj = jalaliToGregorian(clampedY, jm, jd);
      const gStr = formatGregorianString(gObj.gy, gObj.gm, gObj.gd);

      let finalJalali = jStr;
      let finalGregorian = gStr;
      const dateObj = new Date(gObj.gy, gObj.gm - 1, gObj.gd);

      if (includeTime && parsed.time) {
        const [h, m] = parsed.time.split(':').map(n => parseInt(n, 10) || 0);
        dateObj.setHours(h, m, 0, 0);
        finalJalali = `${jStr} ${parsed.time}`;
        finalGregorian = `${gStr}T${parsed.time}:00`;
      }

      setViewYear(clampedY);
      setViewMonth(jm);

      if (normalizeFieldText) {
        setInputText(finalJalali);
      }

      onChange?.(finalJalali, finalGregorian, {
        shamsi: finalJalali,
        miladi: finalGregorian,
        time: parsed.time || timeStr,
        rawDate: dateObj
      });
    }
  };

  // Handle manual typing without interrupting incomplete strokes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!allowManualInput) return;
    const raw = e.target.value;
    setInputText(raw);

    const eng = toEnglishDigits(raw.trim());
    if (!eng) {
      onChange?.('', '', {
        shamsi: '',
        miladi: '',
        time: '',
        rawDate: new Date()
      });
      return;
    }

    // Only auto-emit while typing if user completed a full date (e.g. YYYY/MM/DD or 8 digits YYYYMMDD)
    const isCompletePattern =
      /^\d{4}[/.-]\d{1,2}[/.-]\d{2}(\s+\d{1,2}:\d{2})?$/.test(eng) ||
      /^\d{8}$/.test(eng);

    if (isCompletePattern) {
      commitManualInput(eng, /^\d{8}$/.test(eng));
    }
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    if (allowManualInput && inputText.trim()) {
      commitManualInput(inputText, true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && allowManualInput) {
      e.preventDefault();
      commitManualInput(inputText, true);
      setIsOpen(false);
      setViewMode('days');
    }
  };

  // Apply time change
  const handleTimeChange = (newTime: string) => {
    setTimeStr(newTime);
    if (parsedValue.jalali && parsedValue.gregorian) {
      const { jy, jm, jd } = parsedValue.jalali;
      const { gy, gm, gd } = parsedValue.gregorian;
      const jStr = formatJalaliString(jy, jm, jd);
      const gStr = formatGregorianString(gy, gm, gd);
      const [h, m] = (newTime || '08:00').split(':').map(n => parseInt(n, 10) || 0);
      const dateObj = new Date(gy, gm - 1, gd, h, m, 0);

      const finalJ = `${jStr} ${newTime}`;
      const finalG = `${gStr}T${newTime}:00`;
      setInputText(finalJ);
      onChange?.(finalJ, finalG, {
        shamsi: finalJ,
        miladi: finalG,
        time: newTime,
        rawDate: dateObj
      });
    }
  };

  // Build calendar matrix (35 or 42 cells)
  const calendarCells = useMemo(() => {
    const daysInMonth = getJalaliMonthDaysCount(viewYear, viewMonth);
    const firstDayOfWeek = getJalaliDayOfWeek(viewYear, viewMonth, 1); // 0 = Sat, 6 = Fri

    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const daysInPrevMonth = getJalaliMonthDaysCount(prevYear, prevMonth);

    const cells: Array<{
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isFriday: boolean;
      gregorian: { gy: number; gm: number; gd: number };
    }> = [];

    // Fill leading previous month days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const gObj = jalaliToGregorian(prevYear, prevMonth, dayNum);
      cells.push({
        day: dayNum,
        month: prevMonth,
        year: prevYear,
        isCurrentMonth: false,
        isToday: prevYear === todayObj.jy && prevMonth === todayObj.jm && dayNum === todayObj.jd,
        isSelected: !!parsedValue.jalali && parsedValue.jalali.jy === prevYear && parsedValue.jalali.jm === prevMonth && parsedValue.jalali.jd === dayNum,
        isFriday: cells.length % 7 === 6,
        gregorian: gObj
      });
    }

    // Fill current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const gObj = jalaliToGregorian(viewYear, viewMonth, d);
      const isSelected = !!parsedValue.jalali && parsedValue.jalali.jy === viewYear && parsedValue.jalali.jm === viewMonth && parsedValue.jalali.jd === d;
      const isToday = viewYear === todayObj.jy && viewMonth === todayObj.jm && d === todayObj.jd;
      const isFriday = cells.length % 7 === 6;

      cells.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        isToday,
        isSelected,
        isFriday,
        gregorian: gObj
      });
    }

    // Fill trailing next month days
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    let nextDayNum = 1;
    const totalSlots = cells.length > 35 ? 42 : 35;

    while (cells.length < totalSlots) {
      const gObj = jalaliToGregorian(nextYear, nextMonth, nextDayNum);
      cells.push({
        day: nextDayNum,
        month: nextMonth,
        year: nextYear,
        isCurrentMonth: false,
        isToday: nextYear === todayObj.jy && nextMonth === todayObj.jm && nextDayNum === todayObj.jd,
        isSelected: !!parsedValue.jalali && parsedValue.jalali.jy === nextYear && parsedValue.jalali.jm === nextMonth && parsedValue.jalali.jd === nextDayNum,
        isFriday: cells.length % 7 === 6,
        gregorian: gObj
      });
      nextDayNum++;
    }

    return cells;
  }, [viewYear, viewMonth, parsedValue.jalali, todayObj]);

  // Dual display helpers for header & tooltip
  const dualInfo = useMemo(() => getDualDateDisplay(value), [value]);

  // Gregorian month span text
  const gregorianMonthSpan = useMemo(() => {
    const gStart = jalaliToGregorian(viewYear, viewMonth, 1);
    const gEnd = jalaliToGregorian(viewYear, viewMonth, getJalaliMonthDaysCount(viewYear, viewMonth));
    return `${formatGregorianFullText(gStart.gy, gStart.gm, gStart.gd)} — ${formatGregorianFullText(gEnd.gy, gEnd.gm, gEnd.gd)}`;
  }, [viewYear, viewMonth]);

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full text-right ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id={id ? `${id}-container` : undefined}
    >
      {label && (
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
            {label}
            {required && <span className="text-rose-500 font-bold">*</span>}
          </span>
          {showGregorianPreview && parsedValue.gregorian && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-medium tracking-tight dir-ltr">
              {formatGregorianString(parsedValue.gregorian.gy, parsedValue.gregorian.gm, parsedValue.gregorian.gd)}
            </span>
          )}
        </label>
      )}

      {/* Input Field (supports both direct manual typing and calendar popup) */}
      <div
        dir="rtl"
        className={`flex items-center gap-1 w-full px-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 group ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              setIsOpen(prev => !prev);
              setViewMode('days');
            }
          }}
          className="shrink-0 text-slate-400 hover:text-blue-600 transition cursor-pointer p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700"
          title={isFa ? 'باز کردن تقویم شمسی (انتخاب سال و تاریخ)' : 'Open Calendar'}
        >
          <CalendarIcon className="w-4 h-4" />
        </button>

        <input
          ref={inputRef}
          type="text"
          id={id}
          dir="ltr"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setIsInputFocused(true)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          onClick={() => {
            if (!disabled && !isOpen) {
              setIsOpen(true);
              setViewMode('days');
            }
          }}
          disabled={disabled}
          required={required}
          readOnly={!allowManualInput}
          placeholder={placeholder || (includeTime ? (isFa ? '1405/06/04 08:30' : 'YYYY/MM/DD HH:mm') : (isFa ? '1365/04/15 (تایپ دستی یا انتخاب از تقویم)' : 'YYYY/MM/DD'))}
          className={`flex-1 min-w-0 w-full py-2 bg-transparent border-0 text-xs font-mono font-bold text-right text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed ${inputClassName}`}
        />

        {/* Quick action buttons on input */}
        <div className="shrink-0 flex items-center gap-1">
          {inputText && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              title={isFa ? 'پاک کردن تاریخ' : 'Clear'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
                setViewMode('years');
              }}
              className="px-1.5 py-0.5 text-[9px] font-black whitespace-nowrap bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded border border-blue-300 dark:border-blue-700/50 hover:bg-blue-200 transition cursor-pointer"
              title={isFa ? `انتخاب سریع سال (${effectiveMinYear} تا ${effectiveMaxYear})` : 'Select Year'}
            >
              {isFa ? 'انتخاب سال' : 'Year'}
            </button>
          )}
        </div>
      </div>

      {/* Gregorian Hover Tooltip */}
      {isHovered && !isOpen && parsedValue.gregorian && parsedValue.jalali && (
        <div className="absolute z-40 bottom-full mb-1.5 right-0 bg-slate-900/95 text-white text-[11px] px-3 py-1.5 rounded-xl shadow-xl border border-slate-700 backdrop-blur-xs flex items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 whitespace-nowrap">
          <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="space-y-0.5">
            <div className="font-bold text-blue-300 font-sans">
              {dualInfo.fullShamsi} {dualInfo.time ? `- ساعت ${dualInfo.time}` : ''}
            </div>
            <div className="text-[10px] text-slate-300 font-mono dir-ltr flex items-center gap-1.5">
              <span>{dualInfo.miladi}</span>
              <span className="text-slate-400">({dualInfo.fullMiladi})</span>
            </div>
          </div>
        </div>
      )}

      {/* POPUP CALENDAR */}
      {isOpen && createPortal(
        <>
          {isCompactViewport && (
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-[99998]"
              onClick={() => {
                setIsOpen(false);
                setViewMode('days');
              }}
              aria-hidden="true"
            />
          )}
          <div 
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(350px,calc(100vw-16px))] max-h-[calc(100dvh-20px)] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl shadow-slate-900/15 p-3 sm:p-4 space-y-2.5 sm:space-y-3 animate-in fade-in zoom-in-95 backdrop-blur-md select-none text-right custom-scrollbar"
            style={popoverStyle}
            dir="rtl"
          >
          {/* Top Summary Banner: Current Date Snapshot + Quick Today Action */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-blue-500/30">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {parsedValue.jalali 
                    ? formatJalaliFullText(parsedValue.jalali.jy, parsedValue.jalali.jm, parsedValue.jalali.jd)
                    : `${JALALI_MONTH_NAMES_FA[viewMonth - 1]} ${viewYear}`}
                </div>
                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 dir-ltr text-right truncate">
                  {parsedValue.gregorian 
                    ? formatGregorianFullText(parsedValue.gregorian.gy, parsedValue.gregorian.gm, parsedValue.gregorian.gd)
                    : `بازه سال: ${effectiveMinYear} الی ${effectiveMaxYear}`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSelectToday}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 border border-slate-200 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-slate-600 transition shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
              title="انتخاب و پرش به تاریخ امروز"
            >
              <Sparkles className="w-3 h-3 text-blue-500" />
              <span>امروز</span>
            </button>
          </div>

          {/* Direct Year (1320..Current) & Month Dropdowns + View Switchers */}
          <div className="flex items-center justify-between gap-1.5 px-0.5">
            {/* Prev month / year button */}
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'days') handlePrevMonth();
                else setViewYear(y => Math.max(effectiveMinYear, y - 1));
              }}
              className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title={viewMode === 'days' ? 'ماه قبل' : 'سال قبل'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Month & Year Direct Selectors */}
            <div className="flex items-center gap-1 flex-1 justify-center min-w-0">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => {
                  const nextM = Number(e.target.value);
                  setViewMonth(nextM);
                  setViewMode('days');
                }}
                className="min-w-0 flex-1 px-1.5 sm:px-2 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer outline-none"
                title="انتخاب ماه"
              >
                {JALALI_MONTH_NAMES_FA.map((mName, idx) => (
                  <option key={mName} value={idx + 1}>
                    {mName}
                  </option>
                ))}
              </select>

              {/* Year Dropdown (1320 to Current Year) */}
              <select
                value={viewYear}
                onChange={(e) => {
                  const nextY = Number(e.target.value);
                  setViewYear(nextY);
                  if (parsedValue.jalali) {
                    handleSelectDay(parsedValue.jalali.jd, viewMonth, nextY);
                  } else {
                    setViewMode('days');
                  }
                }}
                className="min-w-0 flex-1 px-1.5 sm:px-2 py-1.5 rounded-xl text-[11px] sm:text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/70 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer outline-none"
                title={`انتخاب سال (${effectiveMinYear} الی ${effectiveMaxYear})`}
              >
                {allYearsDesc.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              {/* Grid Year Picker Toggle */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
                className={`px-1.5 sm:px-2 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition flex items-center gap-0.5 cursor-pointer border shrink-0 whitespace-nowrap ${
                  viewMode === 'years'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-blue-600 dark:text-blue-400 border-slate-200/70 dark:border-slate-700 hover:bg-slate-200'
                }`}
                title="نمایش جدول کامل سال‌ها (۱۳۲۰ الی سال جاری)"
              >
                <span>سال</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${viewMode === 'years' ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Next month / year button */}
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'days') handleNextMonth();
                else setViewYear(y => Math.min(effectiveMaxYear, y + 1));
              }}
              className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title={viewMode === 'days' ? 'ماه بعد' : 'سال بعد'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Manual Date Input Bar inside Popup */}
          {allowManualInput && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
                <Keyboard className="w-3.5 h-3.5 text-blue-500" />
                <span>ورود دستی (YYYY/MM/DD):</span>
              </span>
              <input
                type="text"
                dir="ltr"
                value={inputText}
                onChange={handleInputChange}
                onFocus={() => setIsInputFocused(true)}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                placeholder="1365/04/15"
                className="w-28 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-center text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Gregorian Equivalent Sub-bar */}
          <div className="flex items-center justify-between px-3 py-1 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>معادل میلادی:</span>
            </div>
            <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold dir-ltr truncate">
              {gregorianMonthSpan}
            </span>
          </div>

          {/* VIEW: DAYS GRID (Default) */}
          {viewMode === 'days' && (
            <div className="space-y-1">
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 dark:text-slate-500 pb-1">
                {PERSIAN_WEEK_DAYS_FA.map((wd, i) => (
                  <div 
                    key={wd.key} 
                    className={`py-1 text-center ${i === 6 ? 'text-rose-500 font-extrabold' : ''}`}
                    title={wd.full}
                  >
                    {wd.short}
                  </div>
                ))}
              </div>

              {/* Days Numbers Matrix */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  const isSelected = cell.isSelected;
                  const isToday = cell.isToday;
                  const isCurrent = cell.isCurrentMonth;
                  const isFri = cell.isFriday;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDay(cell.day, cell.month, cell.year)}
                      className={`relative h-9 rounded-xl font-mono text-xs flex flex-col items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-500/30 scale-102 z-10'
                          : isToday
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-black border border-blue-400 dark:border-blue-600 hover:bg-blue-100'
                          : !isCurrent
                          ? 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-normal opacity-60'
                          : isFri
                          ? 'text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30'
                          : 'text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={`${cell.year}/${cell.month}/${cell.day} (${formatGregorianString(cell.gregorian.gy, cell.gregorian.gm, cell.gregorian.gd)})`}
                    >
                      <span>{cell.day}</span>
                      {isToday && !isSelected && (
                        <span className="w-1 h-1 rounded-full bg-blue-500 absolute bottom-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: MONTHS PICKER */}
          {viewMode === 'months' && (
            <div className="space-y-3 py-1 animate-in fade-in">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 text-center">
                انتخاب سریع ماه در سال {viewYear}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {JALALI_MONTH_NAMES_FA.map((mName, idx) => {
                  const mNum = idx + 1;
                  const isSelected = viewMonth === mNum;
                  const isCurrent = todayObj.jm === mNum && todayObj.jy === viewYear;

                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => {
                        setViewMonth(mNum);
                        setViewMode('days');
                      }}
                      className={`py-2.5 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer text-center border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                          : isCurrent
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {mName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: FULL SCROLLABLE YEARS PICKER (1320 to Current Year) */}
          {viewMode === 'years' && (
            <div className="space-y-2.5 py-1 animate-in fade-in">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                <span>انتخاب سال ({effectiveMinYear} الی {effectiveMaxYear})</span>
                <button
                  type="button"
                  onClick={() => {
                    setViewYear(Math.min(todayObj.jy, effectiveMaxYear));
                    setViewMode('days');
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  سال جاری ({todayObj.jy})
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-2xl">
                {allYearsDesc.map((yr) => {
                  const isSelected = viewYear === yr;
                  const isCurrent = todayObj.jy === yr;

                  return (
                    <button
                      key={yr}
                      ref={isSelected ? selectedYearBtnRef : undefined}
                      type="button"
                      onClick={() => {
                        setViewYear(yr);
                        setViewMode('months');
                      }}
                      className={`py-2 px-1.5 rounded-xl text-xs font-mono font-extrabold transition cursor-pointer text-center border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                          : isCurrent
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-100'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIME SELECTION (When includeTime is enabled) */}
          {includeTime && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Clock className="w-3.5 h-3.5" />
                  {isFa ? 'ساعت و دقیقه:' : 'Time:'}
                </span>
                <input
                  type="text"
                  value={timeStr}
                  onChange={e => handleTimeChange(e.target.value)}
                  placeholder="HH:mm"
                  className="w-16 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold border border-slate-300 dark:border-slate-700 outline-none text-center"
                />
              </div>

              {/* Quick time presets */}
              <div className="flex items-center gap-1 justify-center flex-wrap">
                {['07:00', '08:00', '12:00', '14:30', '16:00', '19:00', '23:00'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTimeChange(t)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border transition cursor-pointer ${
                      timeStr === t
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div>
              {inputText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isFa ? 'پاک کردن' : 'Clear'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (allowManualInput && inputText.trim()) {
                    commitManualInput(inputText, true);
                  }
                  setIsOpen(false);
                  setViewMode('days');
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isFa ? 'تأیید' : 'Done'}</span>
              </button>
            </div>
          </div>
        </div>
        </>,
        document.body
      )}

      {helperText && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
