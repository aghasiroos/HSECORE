import React, { useState } from 'react';
import {
  GitCompare,
  CheckCircle2,
  XCircle,
  User,
  ShieldCheck,
  Wind,
  FileText,
  ArrowLeftRight,
  Check
} from 'lucide-react';
import { WorkPermit } from '../../types';

interface PermitInspectionComparisonProps {
  permit: WorkPermit;
  isFa: boolean;
  onOpenNewCycle?: () => void;
}

export const PermitInspectionComparison: React.FC<PermitInspectionComparisonProps> = ({
  permit,
  isFa,
  onOpenNewCycle
}) => {
  const cycles = permit.inspectionCycles || [];
  const [selectedCycleIds, setSelectedCycleIds] = useState<string[]>(() => {
    return cycles.slice(-3).map(c => c.id);
  });

  const handleToggleSelectCycle = (id: string) => {
    if (selectedCycleIds.includes(id)) {
      if (selectedCycleIds.length > 1) {
        setSelectedCycleIds(prev => prev.filter(cId => cId !== id));
      }
    } else {
      setSelectedCycleIds(prev => [...prev, id]);
    }
  };

  const cyclesToCompare = cycles.filter(c => selectedCycleIds.includes(c.id));

  // Extract all distinct checklist questions across compared cycles
  const allChecklistKeys: string[] = Array.from(
    new Set(cyclesToCompare.flatMap(c => Object.keys(c.checklistResults || {})))
  );

  if (cycles.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 mx-auto flex items-center justify-center">
          <GitCompare className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
            {isFa ? 'هنوز دوره‌ای برای بازرسی مجدد ثبت نشده است' : 'No Re-Inspection cycles recorded yet'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isFa 
              ? 'با ثبت دوره‌های جدید بازرسی ایمنی (Mid-shift یا تجدید دوره)، کلیه سوابق در اینجا حفظ شده و امکان مقایسه دقیق پارامترها و تست گاز فراهم خواهد شد.' 
              : 'Add inspection cycles to track safety status progression over time.'}
          </p>
        </div>
        {onOpenNewCycle && (
          <button
            onClick={onOpenNewCycle}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition inline-flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>ثبت اولین دوره بازرسی مجدد</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with cycle selector chips */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-600 rounded-xl">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {isFa ? 'جدول مقایسه تطبیقی دوره‌های بازرسی ایمنی (Side-by-Side Comparison)' : 'Inspection Cycles Comparison'}
              </h4>
              <p className="text-xs text-slate-500">
                مجموع دوره‌های ثبت شده: {cycles.length} دوره | دوره‌های در حال مقایسه: {cyclesToCompare.length}
              </p>
            </div>
          </div>

          {onOpenNewCycle && (
            <button
              onClick={onOpenNewCycle}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>افزودن دوره جدید</span>
            </button>
          )}
        </div>

        {/* Cycle Selection Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-500">انتخاب دوره‌ها جهت مقایسه:</span>
          {cycles.map((c) => {
            const isSelected = selectedCycleIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => handleToggleSelectCycle(c.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <span>دوره {c.cycleNumber}</span>
                <span className="text-[10px] opacity-80">({c.persianDate})</span>
                {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                <th className="p-3.5 font-bold text-slate-700 dark:text-slate-300 min-w-[200px] border-l border-slate-200 dark:border-slate-700">
                  شاخص / پارامتر بازرسی
                </th>
                {cyclesToCompare.map(cycle => (
                  <th key={cycle.id} className="p-3.5 font-bold text-slate-900 dark:text-white min-w-[240px] text-center border-l border-slate-200 dark:border-slate-700 last:border-l-0">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-extrabold text-xs">
                          دوره بازرسی {cycle.cycleNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          cycle.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : cycle.status === 'Conditional'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {cycle.status === 'Approved' && 'تأیید کامل'}
                          {cycle.status === 'Conditional' && 'تأیید مشروط'}
                          {cycle.status === 'Rejected' && 'مردود / تعلیق'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal">
                        {cycle.persianDate}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Row: Inspector */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>بازرس ایمنی / ثبت‌کننده</span>
                  </div>
                </td>
                {cyclesToCompare.map(cycle => (
                  <td key={cycle.id} className="p-3 text-center border-l border-slate-200 dark:border-slate-700 last:border-l-0">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{cycle.inspectorName}</div>
                    <div className="text-[10px] text-slate-400">{cycle.inspectorRole}</div>
                  </td>
                ))}
              </tr>

              {/* Row: Gas Testing Section Header */}
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100">
                <td colSpan={cyclesToCompare.length + 1} className="p-2.5 px-3 flex items-center gap-2">
                  <Wind className="w-4 h-4 text-blue-500" />
                  <span>نتایج گازسنجی و سلامت اتمسفر (Atmospheric Gas Testing)</span>
                </td>
              </tr>

              {/* Row: O2 Gas */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700">
                  اکسیژن O2 (استاندارد: ۱۹.۵٪ تا ۲۳.۵٪)
                </td>
                {cyclesToCompare.map(cycle => {
                  const val = cycle.gasTestResults?.o2;
                  const isNormal = val !== undefined && val >= 19.5 && val <= 23.5;
                  return (
                    <td key={cycle.id} className="p-3 text-center border-l border-slate-200 dark:border-slate-700 last:border-l-0">
                      {val !== undefined ? (
                        <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                          isNormal 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {val}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row: LEL Gas */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700">
                  گازهای قابل اشتعال LEL (حد مجاز: &lt; ۵٪)
                </td>
                {cyclesToCompare.map(cycle => {
                  const val = cycle.gasTestResults?.lel;
                  const isNormal = val !== undefined && val < 5;
                  return (
                    <td key={cycle.id} className="p-3 text-center border-l border-slate-200 dark:border-slate-700 last:border-l-0">
                      {val !== undefined ? (
                        <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                          isNormal 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        }`}>
                          {val}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row: H2S & CO */}
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700">
                  گازهای سمی H2S / CO (ppm)
                </td>
                {cyclesToCompare.map(cycle => {
                  const h2s = cycle.gasTestResults?.h2s;
                  const co = cycle.gasTestResults?.co;
                  return (
                    <td key={cycle.id} className="p-3 text-center border-l border-slate-200 dark:border-slate-700 last:border-l-0">
                      {h2s !== undefined && co !== undefined ? (
                        <div className="flex items-center justify-center gap-2 font-mono text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-300">H2S: {h2s}</span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-700 dark:text-slate-300">CO: {co}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Row: Checklist Section Header */}
              {allChecklistKeys.length > 0 && (
                <tr className="bg-slate-100/70 dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100">
                  <td colSpan={cyclesToCompare.length + 1} className="p-2.5 px-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>مقایسه موارد کنترلی چک‌لیست ایمنی</span>
                  </td>
                </tr>
              )}

              {/* Dynamic Checklist Rows */}
              {allChecklistKeys.map((itemKey, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-3 text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700">
                    {itemKey}
                  </td>
                  {cyclesToCompare.map(cycle => {
                    const statusVal = (cycle.checklistResults as Record<string, any>)?.[itemKey];
                    return (
                      <td key={cycle.id} className="p-3 text-center border-l border-slate-200 dark:border-slate-700 last:border-l-0">
                        {statusVal === 'بله' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>تأیید</span>
                          </span>
                        ) : statusVal === 'خیر' ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                            <XCircle className="w-4 h-4" />
                            <span>عدم رعایت</span>
                          </span>
                        ) : statusVal === 'لازم نیست' ? (
                          <span className="text-slate-400">لازم نیست</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Row: Findings & Observations */}
              <tr className="bg-slate-100/70 dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100">
                <td colSpan={cyclesToCompare.length + 1} className="p-2.5 px-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <span>مشاهدات و اقدامات اصلاحی</span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700">
                  مشاهدات میدانی بازرس
                </td>
                {cyclesToCompare.map(cycle => (
                  <td key={cycle.id} className="p-3 text-slate-800 dark:text-slate-200 border-l border-slate-200 dark:border-slate-700 last:border-l-0 text-right leading-relaxed">
                    {cycle.findings || '—'}
                  </td>
                ))}
              </tr>
              <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700">
                  اقدامات اصلاحی صادره
                </td>
                {cyclesToCompare.map(cycle => (
                  <td key={cycle.id} className="p-3 text-slate-800 dark:text-slate-200 border-l border-slate-200 dark:border-slate-700 last:border-l-0 text-right">
                    {cycle.correctiveActionsRequired ? (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        {cycle.correctiveActionsRequired}
                      </span>
                    ) : (
                      <span className="text-slate-400">بدون اقدام اصلاحی</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function Plus(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
