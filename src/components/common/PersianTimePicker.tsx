import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  Check,
  X,
  RotateCcw,
  Sun,
  Moon,
  Zap,
  Plus,
  Minus
} from 'lucide-react';
import { toEnglishDigits } from '../../utils/jalaliDate';

export interface PersianTimePickerProps {
  value?: string | null;
  onChange?: (timeStr: string) => void;
  placeholder?: string;
  isFa?: boolean;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  helperText?: string;
  className?: string;
  inputClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  showPresets?: boolean;
  id?: string;
}

/**
 * Validates and normalizes HH:mm time string
 */
export function normalizeTimeString(val: string): { isValid: boolean; normalized: string } {
  if (!val || typeof val !== 'string') return { isValid: false, normalized: '' };
  
  const clean = toEnglishDigits(val).trim();
  
  // Match HH:mm or H:m
  const match = clean.match(/^(\d{1,2}):(\d{1,2})$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return {
        isValid: true,
        normalized: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      };
    }
  }
  
  // Match 3 or 4 digits without colon (e.g., "830" -> 08:30, "1430" -> 14:30)
  const digitOnly = clean.replace(/\D/g, '');
  if (digitOnly.length === 3) {
    const h = parseInt(digitOnly.slice(0, 1), 10);
    const m = parseInt(digitOnly.slice(1), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return {
        isValid: true,
        normalized: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      };
    }
  } else if (digitOnly.length === 4) {
    const h = parseInt(digitOnly.slice(0, 2), 10);
    const m = parseInt(digitOnly.slice(2), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return {
        isValid: true,
        normalized: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      };
    }
  } else if (digitOnly.length >= 1 && digitOnly.length <= 2) {
    const h = parseInt(digitOnly, 10);
    if (h >= 0 && h <= 23) {
      return {
        isValid: true,
        normalized: `${String(h).padStart(2, '0')}:00`
      };
    }
  }

  return { isValid: false, normalized: clean };
}

/**
 * Common operational shift presets in industrial / petrochemical environments
 */
const COMMON_TIME_PRESETS = [
  { labelFa: '۰۷:۰۰ (شروع شیفت صبح)', labelEn: '07:00 (Morning Shift)', time: '07:00', icon: Sun },
  { labelFa: '۰۸:۰۰ (آغاز به کار اداری / روز)', labelEn: '08:00 (Start Work)', time: '08:00', icon: Sun },
  { labelFa: '۱۲:۰۰ (ظهر و ناهار)', labelEn: '12:00 (Noon / Lunch)', time: '12:00', icon: Sun },
  { labelFa: '۱۴:۳۰ (تحویل نوبت عصر)', labelEn: '14:30 (Afternoon Handover)', time: '14:30', icon: Sun },
  { labelFa: '۱۶:۳۰ (پایان کار اداری)', labelEn: '16:30 (End of Shift)', time: '16:30', icon: Sun },
  { labelFa: '۱۹:۰۰ (شروع شیفت شب)', labelEn: '19:00 (Night Shift)', time: '19:00', icon: Moon },
  { labelFa: '۲۳:۰۰ (پاس شب و بازرسی)', labelEn: '23:00 (Late Night Round)', time: '23:00', icon: Moon },
  { labelFa: '۰۴:۳۰ (پایان نوبت شب)', labelEn: '04:30 (Dawn Handover)', time: '04:30', icon: Moon }
];

// 24 Hours list (00 to 23)
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

// 5-minute step list (00, 05, ..., 55)
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5);

export const PersianTimePicker: React.FC<PersianTimePickerProps> = ({
  value = '',
  onChange,
  placeholder,
  isFa = true,
  disabled = false,
  required = false,
  label,
  helperText,
  className = '',
  inputClassName = '',
  size = 'md',
  showPresets = true,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState<string>(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoursColRef = useRef<HTMLDivElement>(null);
  const minutesColRef = useRef<HTMLDivElement>(null);

  // Split hours and minutes state for the visual picker
  const initialTimeObj = useMemo(() => {
    const norm = normalizeTimeString(value || '');
    if (norm.isValid) {
      const [h, m] = norm.normalized.split(':');
      return { hour: parseInt(h, 10), minute: parseInt(m, 10) };
    }
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes() };
  }, [value]);

  const [selectedHour, setSelectedHour] = useState<number>(initialTimeObj.hour);
  const [selectedMinute, setSelectedMinute] = useState<number>(initialTimeObj.minute);
  const [activeTab, setActiveTab] = useState<'picker' | 'presets'>('picker');
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  // Sync internal states when value changes from parent
  useEffect(() => {
    if (value) {
      const norm = normalizeTimeString(value);
      setInputText(norm.isValid ? norm.normalized : value);
      if (norm.isValid) {
        const [h, m] = norm.normalized.split(':');
        setSelectedHour(parseInt(h, 10));
        setSelectedMinute(parseInt(m, 10));
      }
    } else {
      setInputText('');
    }
  }, [value]);

  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(false);

  // Position popover with viewport boundary detection (safe down to 320px)
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const compact = vw < 480;
    setIsCompactViewport(compact);

    const popoverWidth = Math.min(320, vw - 16);

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
    const popoverHeight = Math.min(420, vh - 24);

    // Check vertical space (open upwards if tight at bottom)
    const spaceBelow = vh - rect.bottom;
    const shouldOpenUp = spaceBelow < popoverHeight && rect.top > spaceBelow;

    const rawTop = shouldOpenUp 
      ? rect.top - popoverHeight - 8 
      : rect.bottom + 8;
    const top = Math.max(8, Math.min(rawTop, vh - popoverHeight - 8));

    // Horizontal placement keeping it strictly inside screen margins
    let left: number;
    if (isFa) {
      left = rect.right - popoverWidth;
    } else {
      left = rect.left;
    }

    left = Math.max(8, Math.min(left, Math.max(8, vw - popoverWidth - 8)));

    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      maxWidth: 'calc(100vw - 16px)',
      maxHeight: 'calc(100dvh - 16px)',
      overflowY: 'auto',
      zIndex: 99999,
    });
  }, [isFa]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Scroll active hour and minute into view when popover opens
  useEffect(() => {
    if (isOpen && activeTab === 'picker') {
      const timer = setTimeout(() => {
        if (hoursColRef.current) {
          const activeHourEl = hoursColRef.current.querySelector('[data-active="true"]') as HTMLElement;
          if (activeHourEl) {
            activeHourEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
        if (minutesColRef.current) {
          const activeMinuteEl = minutesColRef.current.querySelector('[data-active="true"]') as HTMLElement;
          if (activeMinuteEl) {
            activeMinuteEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

  // Close when clicking outside both container AND popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
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

  // Current formatted time
  const currentFormattedTime = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;

  const updateTimeSelection = (newHour: number, newMinute: number, autoApply = false) => {
    setSelectedHour(newHour);
    setSelectedMinute(newMinute);
    const formatted = `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
    setInputText(formatted);
    if (autoApply) {
      onChange?.(formatted);
    }
  };

  const adjustHour = (delta: number) => {
    const next = (selectedHour + delta + 24) % 24;
    updateTimeSelection(next, selectedMinute, true);
  };

  const adjustMinute = (delta: number) => {
    const next = (selectedMinute + delta + 60) % 60;
    updateTimeSelection(selectedHour, next, true);
  };

  // Set time to current exact machine time
  const handleSetCurrentTime = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    updateTimeSelection(h, m, true);
  };

  const handleManualInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = toEnglishDigits(e.target.value);
    raw = raw.replace(/[^\d:]/g, '');
    
    // Auto insert colon after 2 digits
    if (raw.length === 2 && !raw.includes(':') && !inputText.includes(':')) {
      raw = raw + ':';
    }
    if (raw.length > 5) raw = raw.slice(0, 5);
    
    setInputText(raw);

    if (raw.length === 5) {
      const norm = normalizeTimeString(raw);
      if (norm.isValid) {
        const [h, m] = norm.normalized.split(':');
        setSelectedHour(parseInt(h, 10));
        setSelectedMinute(parseInt(m, 10));
        onChange?.(norm.normalized);
      }
    }
  };

  const handleApplyManualInput = () => {
    if (!inputText.trim()) {
      onChange?.('');
      return;
    }
    const norm = normalizeTimeString(inputText);
    if (norm.isValid) {
      setInputText(norm.normalized);
      const [h, m] = norm.normalized.split(':');
      setSelectedHour(parseInt(h, 10));
      setSelectedMinute(parseInt(m, 10));
      onChange?.(norm.normalized);
    } else if (value) {
      setInputText(value);
    }
  };

  const handleConfirm = () => {
    const formatted = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    setInputText(formatted);
    onChange?.(formatted);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputText('');
    onChange?.('');
    setIsOpen(false);
  };

  const handleSelectPreset = (presetTime: string) => {
    const norm = normalizeTimeString(presetTime);
    if (norm.isValid) {
      const [h, m] = norm.normalized.split(':');
      setSelectedHour(parseInt(h, 10));
      setSelectedMinute(parseInt(m, 10));
      setInputText(norm.normalized);
      onChange?.(norm.normalized);
      setIsOpen(false);
    }
  };

  const sizeClasses = {
    sm: 'py-0.5 px-6 text-xs min-h-[26px]',
    md: 'py-1.5 px-8 text-xs sm:text-sm min-h-[36px]',
    lg: 'py-2 px-9 text-sm sm:text-base min-h-[42px]'
  };

  const isDayTime = selectedHour >= 6 && selectedHour < 18;

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-block w-full select-none ${className}`}
      dir={isFa ? 'rtl' : 'ltr'}
      id={id ? `${id}-container` : undefined}
    >
      {label && (
        <label 
          htmlFor={id} 
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
        >
          {label}
          {required && <span className="text-rose-500 mr-1">*</span>}
        </label>
      )}

      {/* Main Trigger Input */}
      <div className="relative flex items-center group w-full">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputText}
          onChange={handleManualInputChange}
          onBlur={handleApplyManualInput}
          onClick={() => !disabled && setIsOpen(true)}
          placeholder={placeholder || 'HH:mm'}
          disabled={disabled}
          required={required}
          dir="ltr"
          className={`w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold text-center tracking-normal placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
            size === 'sm'
              ? (isFa ? 'pr-6 pl-6' : 'pl-6 pr-6')
              : (isFa ? 'pr-8 pl-8' : 'pl-8 pr-8')
          } ${sizeClasses[size]} ${disabled ? 'opacity-50 bg-slate-100 cursor-not-allowed' : 'cursor-pointer hover:border-slate-400'} ${inputClassName}`}
        />

        {/* Clock Icon Trigger Button */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(prev => !prev)}
          className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center ${
            size === 'sm'
              ? (isFa ? 'right-1.5' : 'left-1.5')
              : (isFa ? 'right-2.5' : 'left-2.5')
          }`}
          title={isFa ? 'باز کردن انتخابگر ساعت' : 'Open time picker'}
        >
          <Clock className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${isOpen ? 'text-blue-600 dark:text-blue-400' : ''}`} />
        </button>

        {/* Quick Clear Button */}
        {inputText && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center ${
              size === 'sm'
                ? (isFa ? 'left-1 p-0.5' : 'right-1 p-0.5')
                : (isFa ? 'left-2 p-1' : 'right-2 p-1')
            }`}
            title={isFa ? 'پاک کردن' : 'Clear'}
          >
            <X className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          </button>
        )}
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-sans">
          {helperText}
        </p>
      )}

      {/* POPUP TIME PICKER DIALOG */}
      {isOpen && createPortal(
        <>
          {isCompactViewport && (
            <div
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-[99998]"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
          )}
          <div 
            ref={popoverRef}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-3 sm:p-4 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 sm:gap-3.5 max-h-[calc(100dvh-20px)] overflow-y-auto custom-scrollbar"
            style={popoverStyle}
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {isFa ? 'تنظیم زمان ۲۴ ساعته' : '24-Hour Time Picker'}
              </span>
            </div>

            {/* Quick Set to Now button */}
            <button
              type="button"
              onClick={handleSetCurrentTime}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900 transition flex items-center gap-1 cursor-pointer active:scale-95"
              title={isFa ? 'ثبت ساعت و دقیقه جاری سیستم' : 'Set to current time'}
            >
              <Zap className="w-3 h-3 text-blue-500" />
              <span>{isFa ? 'زمان اکنون' : 'Now'}</span>
            </button>
          </div>

          {/* Large Hero Digital Display & Stepper */}
          {/* Layout: ساعت در سمت چپ و دقیقه در سمت راست */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            {/* In RTL: First child renders on the RIGHT (Minute), Last child renders on the LEFT (Hour). In LTR: Left is Hour, Right is Minute. */}
            {isFa ? (
              <>
                {/* Minute Card (Right side) */}
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mb-1">
                    دقیقه
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustMinute(-1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="کاهش دقیقه"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-14 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-xl shadow-xs">
                      <span className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                        {String(selectedMinute).padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustMinute(1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="افزایش دقیقه"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Pulsating Colon & Shift Status */}
                <div className="flex flex-col items-center justify-center px-1">
                  <span className="text-xl font-black font-mono text-slate-400 animate-pulse">:</span>
                  <div className={`mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5 border ${
                    isDayTime 
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-900/60' 
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60'
                  }`}>
                    {isDayTime ? <Sun className="w-2.5 h-2.5" /> : <Moon className="w-2.5 h-2.5" />}
                    <span>{isDayTime ? 'روز' : 'شب'}</span>
                  </div>
                </div>

                {/* Hour Card (Left side) */}
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mb-1">
                    ساعت
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustHour(-1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="کاهش ساعت"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-14 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-xl shadow-xs">
                      <span className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                        {String(selectedHour).padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustHour(1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="افزایش ساعت"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Hour Card (Left side in LTR) */}
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mb-1">
                    Hour
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustHour(-1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="Decrease Hour"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-14 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-xl shadow-xs">
                      <span className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                        {String(selectedHour).padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustHour(1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="Increase Hour"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Pulsating Colon & Shift Status */}
                <div className="flex flex-col items-center justify-center px-1">
                  <span className="text-xl font-black font-mono text-slate-400 animate-pulse">:</span>
                  <div className={`mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-0.5 border ${
                    isDayTime 
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-900/60' 
                      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60'
                  }`}>
                    {isDayTime ? <Sun className="w-2.5 h-2.5" /> : <Moon className="w-2.5 h-2.5" />}
                    <span>{isDayTime ? 'Day' : 'Night'}</span>
                  </div>
                </div>

                {/* Minute Card (Right side in LTR) */}
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 mb-1">
                    Minute
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => adjustMinute(-1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="Decrease Minute"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-14 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-xl shadow-xs">
                      <span className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                        {String(selectedMinute).padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustMinute(1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs active:scale-90 transition cursor-pointer"
                      title="Increase Minute"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Navigation Sub-Tabs */}
          {showPresets && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('picker')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold ${
                  activeTab === 'picker'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? 'انتخاب ساعت و دقیقه' : 'Time Columns'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold ${
                  activeTab === 'presets'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isFa ? 'شیفت‌ها و نوبت‌ها' : 'Shift Presets'}</span>
              </button>
            </div>
          )}

          {/* TAB 1: ELEGANT DUAL-COLUMN TIME SELECTOR */}
          {/* Columns matching: ساعت در سمت چپ و دقیقه در سمت راست */}
          {activeTab === 'picker' ? (
            <div className="grid grid-cols-2 gap-2">
              {isFa ? (
                <>
                  {/* MINUTES COLUMN (Right in RTL) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                      <span>دقیقه پرکاربرد:</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => adjustMinute(-5)}
                          className="px-1 py-0.5 text-[9px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded font-mono font-bold cursor-pointer"
                          title="-5 دقیقه"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustMinute(5)}
                          className="px-1 py-0.5 text-[9px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded font-mono font-bold cursor-pointer"
                          title="+5 دقیقه"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                    <div 
                      ref={minutesColRef}
                      className="h-44 overflow-y-auto pr-1 space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-1 scrollbar-thin"
                    >
                      {MINUTE_STEPS.map((m) => {
                        const isSelected = selectedMinute === m;
                        return (
                          <button
                            key={`m-${m}`}
                            type="button"
                            data-active={isSelected}
                            onClick={() => updateTimeSelection(selectedHour, m, true)}
                            className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span>:{String(m).padStart(2, '0')}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* HOURS COLUMN (Left in RTL) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                      <span>انتخاب ساعت:</span>
                    </div>
                    <div 
                      ref={hoursColRef}
                      className="h-44 overflow-y-auto pr-1 space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-1 scrollbar-thin"
                    >
                      {ALL_HOURS.map((h) => {
                        const isSelected = selectedHour === h;
                        const isDay = h >= 6 && h < 18;
                        return (
                          <button
                            key={`h-${h}`}
                            type="button"
                            data-active={isSelected}
                            onClick={() => updateTimeSelection(h, selectedMinute, true)}
                            className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {isDay ? (
                                <Sun className={`w-3 h-3 ${isSelected ? 'text-blue-200' : 'text-blue-500'}`} />
                              ) : (
                                <Moon className={`w-3 h-3 ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`} />
                              )}
                              <span>{String(h).padStart(2, '0')}:00</span>
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* HOURS COLUMN (Left in LTR) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                      <span>Hours (00-23):</span>
                    </div>
                    <div 
                      ref={hoursColRef}
                      className="h-44 overflow-y-auto pr-1 space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-1 scrollbar-thin"
                    >
                      {ALL_HOURS.map((h) => {
                        const isSelected = selectedHour === h;
                        const isDay = h >= 6 && h < 18;
                        return (
                          <button
                            key={`h-${h}`}
                            type="button"
                            data-active={isSelected}
                            onClick={() => updateTimeSelection(h, selectedMinute, true)}
                            className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              {isDay ? (
                                <Sun className={`w-3 h-3 ${isSelected ? 'text-blue-200' : 'text-blue-500'}`} />
                              ) : (
                                <Moon className={`w-3 h-3 ${isSelected ? 'text-indigo-200' : 'text-indigo-400'}`} />
                              )}
                              <span>{String(h).padStart(2, '0')}:00</span>
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* MINUTES COLUMN (Right in LTR) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                      <span>Minutes (5m):</span>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => adjustMinute(-5)}
                          className="px-1 py-0.5 text-[9px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded font-mono font-bold cursor-pointer"
                          title="-5 minutes"
                        >
                          -5
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustMinute(5)}
                          className="px-1 py-0.5 text-[9px] bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 rounded font-mono font-bold cursor-pointer"
                          title="+5 minutes"
                        >
                          +5
                        </button>
                      </div>
                    </div>
                    <div 
                      ref={minutesColRef}
                      className="h-44 overflow-y-auto pr-1 space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-1 scrollbar-thin"
                    >
                      {MINUTE_STEPS.map((m) => {
                        const isSelected = selectedMinute === m;
                        return (
                          <button
                            key={`m-${m}`}
                            type="button"
                            data-active={isSelected}
                            onClick={() => updateTimeSelection(selectedHour, m, true)}
                            className={`w-full py-1.5 px-2 rounded-lg text-xs font-mono font-bold flex items-center justify-between transition cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'hover:bg-slate-200/70 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span>:{String(m).padStart(2, '0')}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* TAB 2: SHIFT PRESETS */
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block px-1 mb-1">
                {isFa ? 'زمان‌های پرکاربرد عملیاتی و نوبت‌های کاری:' : 'Operational shift times:'}
              </span>
              {COMMON_TIME_PRESETS.map((p, idx) => {
                const Icon = p.icon;
                const isSelected = currentFormattedTime === p.time;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p.time)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-800 dark:bg-blue-950/70 dark:border-blue-700 dark:text-blue-200 shadow-xs'
                        : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-white dark:bg-slate-700 rounded-lg text-blue-500 shadow-2xs">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-right">{isFa ? p.labelFa : p.labelEn}</span>
                    </div>
                    <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-bold">
                      {p.time}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer Actions */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-2">
            <div>
              {inputText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isFa ? 'پاک' : 'Clear'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-1.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5 shadow-md shadow-blue-500/25 cursor-pointer active:scale-95"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isFa ? 'تأیید ساعت' : 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default PersianTimePicker;
