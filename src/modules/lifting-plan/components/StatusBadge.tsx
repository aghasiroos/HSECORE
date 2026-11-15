import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, MinusCircle } from 'lucide-react';
import type { VerificationStatus } from '../types';

interface Props {
  status?: VerificationStatus | string | null;
  size?: 'sm' | 'md';
  isFa?: boolean;
}

export default function StatusBadge({ status, size = 'sm', isFa = true }: Props) {
  const norm = String(status || 'NOT_VERIFIED').toUpperCase();

  const meta =
    norm === 'PASS'
      ? {
          label: isFa ? 'تأیید مهندسی (PASS)' : 'PASS',
          cls: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700',
          Icon: CheckCircle2,
        }
      : norm === 'FAIL'
        ? {
            label: isFa ? 'مردود / غیرمجاز (FAIL)' : 'FAIL',
            cls: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700',
            Icon: XCircle,
          }
        : norm === 'WARNING'
          ? {
              label: isFa ? 'نیازمند کنترل ویژه (WARNING)' : 'WARNING',
              cls: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700',
              Icon: AlertTriangle,
            }
          : norm === 'NOT_APPLICABLE'
            ? {
                label: isFa ? 'موضوعیت ندارد (N/A)' : 'NOT APPLICABLE',
                cls: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700',
                Icon: MinusCircle,
              }
            : {
                label: isFa ? 'احراز نشده (NOT VERIFIED)' : 'NOT VERIFIED',
                cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
                Icon: HelpCircle,
              };

  const Icon = meta.Icon;
  const pad = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-md font-bold whitespace-nowrap shrink-0 tabular-nums ${pad} ${meta.cls}`}
    >
      <Icon className={size === 'md' ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span>{meta.label}</span>
    </span>
  );
}
