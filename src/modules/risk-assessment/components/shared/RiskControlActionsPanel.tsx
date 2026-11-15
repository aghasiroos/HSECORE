import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  History,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import {
  AnyRiskAssessment,
  RiskActionItem,
  RiskReviewRecord,
} from '../../types';
import PersianDatePicker from '../../../../components/common/PersianDatePicker';
import CentralPersonnelSelector from '../../../../components/CentralPersonnelSelector';
import {
  getTodayJalali,
  isActionOverdue,
  syncRiskActionsToNonConformance,
} from '../../services/riskWorkflowEngine';

interface RiskControlActionsPanelProps {
  assessment: AnyRiskAssessment;
  actions: RiskActionItem[];
  reviewHistory?: RiskReviewRecord[];
  onChangeActions: (next: RiskActionItem[]) => void;
  isFa: boolean;
  actorName: string;
  onStatusMessage?: (msg: string, type?: 'success' | 'error') => void;
}

export default function RiskControlActionsPanel({
  assessment,
  actions,
  reviewHistory = [],
  onChangeActions,
  isFa,
  actorName,
  onStatusMessage,
}: RiskControlActionsPanelProps) {
  const [syncingCapa, setSyncingCapa] = useState(false);

  const handleAddAction = () => {
    const newItem: RiskActionItem = {
      id: `act-${Date.now()}-${actions.length + 1}`,
      title: '',
      hierarchyControl: 'ENGINEERING',
      owner: '',
      deadline: getTodayJalali(),
      status: 'OPEN',
      evidenceNotes: '',
      effectivenessVerified: false,
    };
    onChangeActions([...actions, newItem]);
  };

  const handleUpdate = (id: string, patch: Partial<RiskActionItem>) => {
    onChangeActions(
      actions.map(a => (a.id === id ? { ...a, ...patch } : a))
    );
  };

  const handleDelete = (id: string) => {
    onChangeActions(actions.filter(a => a.id !== id));
  };

  const handleSyncToCapa = async () => {
    const eligible = actions.filter(a => a.title.trim() && a.owner.trim() && a.deadline.trim() && !a.nonConformanceId);
    if (eligible.length === 0) {
      onStatusMessage?.(
        isFa
          ? 'همه اقدامات واجد شرایط (دارای عنوان، مسئول و مهلت) قبلاً ثبت CAPA شده‌اند یا فیلدهای الزامی کامل نیستند.'
          : 'No unsynced eligible actions (title, owner, deadline required).',
        'error'
      );
      return;
    }
    setSyncingCapa(true);
    try {
      const updated = await syncRiskActionsToNonConformance(assessment, actions, actorName);
      onChangeActions(updated);
      onStatusMessage?.(
        isFa
          ? `${eligible.length} اقدام کنترلی با موفقیت در مرکز عدم انطباق و CAPA ثبت شد.`
          : `${eligible.length} actions synced to CAPA center.`,
        'success'
      );
    } finally {
      setSyncingCapa(false);
    }
  };

  const overdueCount = actions.filter(a => isActionOverdue(a.deadline, a.status)).length;
  const openCount = actions.filter(a => a.status !== 'DONE' && a.status !== 'VERIFIED').length;
  const verifiedCount = actions.filter(a => a.effectivenessVerified || a.status === 'VERIFIED').length;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>
                {isFa
                  ? 'برنامه اقدامات کنترلی، مسئول اجرا، مستندات و پایش اثربخشی (CAPA)'
                  : 'Corrective Actions, Ownership, Evidence & Effectiveness (CAPA)'}
              </span>
            </h3>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {isFa
                ? `باز: ${openCount} | معوقه: ${overdueCount} | تایید اثربخشی: ${verifiedCount} از ${actions.length}`
                : `Open: ${openCount} | Overdue: ${overdueCount} | Verified: ${verifiedCount}/${actions.length}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={syncingCapa || actions.length === 0}
              onClick={handleSyncToCapa}
              className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{syncingCapa ? (isFa ? 'در حال ثبت...' : 'Syncing...') : (isFa ? 'ارسال به ماژول CAPA' : 'Sync to CAPA')}</span>
            </button>

            <button
              type="button"
              onClick={handleAddAction}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isFa ? 'افزودن اقدام کنترلی' : 'Add Control Action'}</span>
            </button>
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs font-bold text-slate-400">
            {isFa
              ? 'هنوز اقدام اصلاحی/کنترلی متمرکزی تعریف نشده است. برای ردیابی مسئول، مهلت و اثربخشی روی «افزودن اقدام کنترلی» کلیک کنید.'
              : 'No centralized control actions yet.'}
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map((act, idx) => {
              const overdue = isActionOverdue(act.deadline, act.status);
              const missingOwnerOrDate = !act.owner?.trim() || !act.deadline?.trim();
              return (
                <div
                  key={act.id}
                  className={`p-4 rounded-xl border space-y-3 ${
                    overdue
                      ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-black flex items-center justify-center tabular-nums">
                        {idx + 1}
                      </span>
                      {act.nonConformanceCode && (
                        <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono text-[10px] font-bold">
                          CAPA: {act.nonConformanceCode}
                        </span>
                      )}
                      {overdue && (
                        <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-black flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {isFa ? 'تاخیر از مهلت' : 'Overdue'}
                        </span>
                      )}
                      {missingOwnerOrDate && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          {isFa ? 'مسئول و مهلت الزامی است' : 'Owner & deadline required'}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(act.id)}
                      className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                      title={isFa ? 'حذف اقدام' : 'Delete Action'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'شرح اقدام کنترلی / اصلاحی *' : 'Action Description *'}
                      </label>
                      <input
                        type="text"
                        value={act.title}
                        onChange={e => handleUpdate(act.id, { title: e.target.value })}
                        placeholder={isFa ? 'مثال: نصب گارد ایمنی و اینترلاک روی نوار نقاله' : 'Describe action...'}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'سلسله‌مراتب کنترل' : 'Hierarchy'}
                      </label>
                      <select
                        value={act.hierarchyControl}
                        onChange={e => handleUpdate(act.id, { hierarchyControl: e.target.value as any })}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      >
                        <option value="ELIMINATION">{isFa ? 'حذف (Elimination)' : 'Elimination'}</option>
                        <option value="SUBSTITUTION">{isFa ? 'جایگزینی (Substitution)' : 'Substitution'}</option>
                        <option value="ENGINEERING">{isFa ? 'مهندسی (Engineering)' : 'Engineering'}</option>
                        <option value="ADMINISTRATIVE">{isFa ? 'اداری / روش اجرا' : 'Administrative'}</option>
                        <option value="PPE">{isFa ? 'تجهیزات حفاظت فردی' : 'PPE'}</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'مسئول اجرا *' : 'Owner *'}
                      </label>
                      <div className="space-y-1">
                        <input
                          type="text"
                          value={act.owner}
                          onChange={e => handleUpdate(act.id, { owner: e.target.value })}
                          placeholder={isFa ? 'نام مسئول یا انتخاب پرسنل...' : 'Owner name...'}
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                        />
                        <CentralPersonnelSelector
                          language={isFa ? 'fa' : 'en'}
                          placeholder={isFa ? 'انتخاب سریع از پرسنل...' : 'Pick personnel...'}
                          compact
                          onSelectPersonnel={p => {
                            if (p) {
                              handleUpdate(act.id, {
                                owner: p.fullName,
                                ownerPersonnelCode: p.personnelCode,
                              });
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'مهلت اجرا *' : 'Deadline *'}
                      </label>
                      <PersianDatePicker
                        value={act.deadline}
                        onChange={jStr => handleUpdate(act.id, { deadline: jStr })}
                        isFa={isFa}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'وضعیت اجرا' : 'Status'}
                      </label>
                      <select
                        value={act.status}
                        onChange={e => {
                          const st = e.target.value as RiskActionItem['status'];
                          handleUpdate(act.id, {
                            status: st,
                            completedAtJalali: st === 'DONE' || st === 'VERIFIED' ? (act.completedAtJalali || getTodayJalali()) : act.completedAtJalali,
                            effectivenessVerified: st === 'VERIFIED' ? true : act.effectivenessVerified,
                          });
                        }}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      >
                        <option value="OPEN">{isFa ? 'تعریف‌شده (باز)' : 'Open'}</option>
                        <option value="IN_PROGRESS">{isFa ? 'در حال اجرا' : 'In Progress'}</option>
                        <option value="DONE">{isFa ? 'اجرا شده (نیازمند شواهد)' : 'Done'}</option>
                        <option value="VERIFIED">{isFa ? 'تایید اثربخشی' : 'Verified'}</option>
                        <option value="OVERDUE">{isFa ? 'تاخیر خورده' : 'Overdue'}</option>
                      </select>
                    </div>

                    <div className="md:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {isFa ? 'شواهد و مستندات اجرا (گزارش/توضیحات/کد سند)' : 'Execution Evidence / Notes'}
                      </label>
                      <input
                        type="text"
                        value={act.evidenceNotes || ''}
                        onChange={e => handleUpdate(act.id, { evidenceNotes: e.target.value })}
                        placeholder={isFa ? 'شرح مستندات نصب، شماره دستورکار تعمیرات یا عکس/فایل پیوست...' : 'Evidence summary...'}
                        className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold outline-hidden"
                      />
                    </div>

                    <div className="md:col-span-5 flex flex-col justify-end">
                      <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(act.effectivenessVerified)}
                          onChange={e =>
                            handleUpdate(act.id, {
                              effectivenessVerified: e.target.checked,
                              status: e.target.checked ? 'VERIFIED' : act.status,
                            })
                          }
                          className="w-4 h-4 accent-emerald-600"
                        />
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {isFa ? 'اثربخشی اقدام توسط کارشناس/مدیر HSE پایش و تایید شد' : 'Effectiveness verified'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review & Workflow Audit History */}
      {reviewHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <span>{isFa ? 'تاریخچه بازبینی، تاییدها و بازنگری' : 'Review & Approval History'}</span>
          </h4>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
            {reviewHistory.map(item => (
              <div key={item.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item.actor}</span>
                  <span className="text-slate-500">
                    ({item.fromStatus || '-'} → {item.toStatus})
                  </span>
                  {item.notes && <span className="text-slate-600 dark:text-slate-300">— {item.notes}</span>}
                </div>
                <span className="font-mono text-[10px] text-slate-400 tabular-nums" dir="ltr">
                  {item.persianDate || new Date(item.timestamp).toLocaleDateString('fa-IR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
