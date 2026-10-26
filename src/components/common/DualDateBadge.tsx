import React, { useState } from 'react';
import { Calendar, Globe } from 'lucide-react';
import { getDualDateDisplay } from '../../utils/jalaliDate';

export type DateFormatMode = 'shamsi' | 'miladi' | 'both';

export interface DualDateBadgeProps {
  dateStr?: string | null;
  date?: string | null;
  mode?: DateFormatMode;
  showTime?: boolean;
  className?: string;
  showIcon?: boolean;
  showTooltip?: boolean;
}

export default function DualDateBadge({
  dateStr,
  date,
  mode = 'shamsi',
  showTime = true,
  className = '',
  showIcon = false,
  showTooltip: enableTooltip = true
}: DualDateBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const effectiveDate = dateStr || date;

  if (!effectiveDate) {
    return <span className="text-slate-400 font-mono text-xs">—</span>;
  }

  const dual = getDualDateDisplay(effectiveDate);

  return (
    <span
      className={`relative inline-flex items-center gap-1 font-mono text-xs cursor-help ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {showIcon && <Calendar className="w-3 h-3 text-blue-500 shrink-0" />}

      {mode === 'shamsi' && (
        <span className="text-slate-800 dark:text-slate-200 font-bold">
          {dual.shamsi} {showTime && dual.time ? `(${dual.time})` : ''}
        </span>
      )}

      {mode === 'miladi' && (
        <span className="text-indigo-600 dark:text-indigo-400 font-bold dir-ltr">
          {dual.miladi} {showTime && dual.time ? `(${dual.time})` : ''}
        </span>
      )}

      {mode === 'both' && (
        <span className="flex items-center gap-1">
          <span className="text-slate-800 dark:text-slate-200 font-bold">{dual.shamsi}</span>
          <span className="text-slate-400 text-[10px]">/</span>
          <span className="text-indigo-600 dark:text-indigo-400 text-[11px] dir-ltr">{dual.miladi}</span>
        </span>
      )}

      {/* Tooltip on hover */}
      {enableTooltip && isHovered && (
        <div className="absolute z-40 bottom-full mb-1.5 right-0 bg-slate-900 text-white text-[10px] px-2.5 py-1.5 rounded-xl shadow-xl border border-slate-700 whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95">
          <div className="font-bold text-blue-300 font-sans">{dual.fullShamsi}</div>
          <div className="text-slate-300 font-mono dir-ltr flex items-center gap-1 mt-0.5">
            <Globe className="w-2.5 h-2.5 text-cyan-400" />
            <span>{dual.miladi} ({dual.fullMiladi})</span>
          </div>
        </div>
      )}
    </span>
  );
}
