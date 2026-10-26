import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  X,
  User,
  Shield,
  Layers,
  ChevronDown
} from 'lucide-react';
import { WorkflowInstance } from '../types';

interface Props {
  language: 'fa' | 'en';
  instances: WorkflowInstance[];
  selectedInstance: WorkflowInstance | null;
  onSelectInstance: (instanceId: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export default function BpmnLiveTrackingBar({
  language,
  instances,
  selectedInstance,
  onSelectInstance,
  onRefresh,
  onClose
}: Props) {
  const isFa = language === 'fa';

  return (
    <div className="flex flex-wrap items-center justify-between p-2.5 px-4 bg-blue-50/90 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800/60 gap-3 backdrop-blur-xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* Live Indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{isFa ? 'رهگیری زنده فرآیند (Live Tracking)' : 'Live Process Tracking'}</span>
        </div>

        {/* Instance Selector Dropdown */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1 shadow-2xs">
          <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <select
            value={selectedInstance?.id || ''}
            onChange={(e) => onSelectInstance(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer max-w-[220px] truncate"
          >
            <option value="" disabled>
              {isFa ? 'انتخاب پرونده در حال اجرا...' : 'Select running instance...'}
            </option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id} className="text-slate-900 bg-white">
                {inst.id}: {inst.title} ({inst.workflowName})
              </option>
            ))}
          </select>
        </div>

        {/* Details of Selected Instance */}
        {selectedInstance && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              <User className="w-3 h-3 text-slate-400" />
              <span>{selectedInstance.initiatorName}</span>
            </span>

            <span className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-200/80 dark:border-slate-700 font-mono">
              <Clock className="w-3 h-3 text-amber-500" />
              <span>{new Date(selectedInstance.startedAt).toLocaleTimeString(isFa ? 'fa-IR' : 'en-US')}</span>
            </span>

            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
              selectedInstance.state === 'ACTIVE'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                : selectedInstance.state === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
            }`}>
              {selectedInstance.state === 'ACTIVE'
                ? (isFa ? 'در حال اجرا' : 'ACTIVE')
                : selectedInstance.state === 'COMPLETED'
                ? (isFa ? 'تکمیل شده' : 'COMPLETED')
                : (isFa ? 'متوقف/رد شده' : 'REJECTED')}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          title={isFa ? 'تازه‌سازی وضعیت' : 'Refresh'}
          className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onClose}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
        >
          <X className="w-3.5 h-3.5" />
          <span>{isFa ? 'خروج از رهگیری' : 'Exit Tracker'}</span>
        </button>
      </div>
    </div>
  );
}
