import React, { useState } from 'react';
import {
  RefreshCw,
  Wind,
  X,
  Check
} from 'lucide-react';
import { WorkPermit, InspectionCycle, UserProfile } from '../../types';
import { toast } from 'react-hot-toast';

interface PermitReInspectionModalProps {
  permit: WorkPermit;
  currentUser: UserProfile;
  isFa: boolean;
  onSaveCycle: (newCycle: InspectionCycle, updatedPermit: Partial<WorkPermit>) => void;
  onClose: () => void;
}

const DEFAULT_CHECKLIST_ITEMS = [
  'تست مجدد گازهای قابل اشتعال و اکسیژن (Gas Testing)',
  'بازرسی تهویه و کنترل جریان هوای تازه',
  'آمادگی تجهیزات اطفاء حریق و کپسول‌های آتش‌نشانی',
  'بررسی تجهیزات حفاظت فردی (PPE) و استفاده صحیح نفرات',
  'ایزولاسیون خطوط فرآیندی و قفل‌گذاری LOTO',
  'سلامت داربست، لایف‌لاین و مهار کار در ارتفاع',
  'حضور ناظر ایمنی و نگهبان کشیک (Standby Man)',
  'پاکسازی محوطه از روغن، مواد قابل اشتعال و زباله'
];

export const PermitReInspectionModal: React.FC<PermitReInspectionModalProps> = ({
  permit,
  currentUser,
  isFa,
  onSaveCycle,
  onClose
}) => {
  const nextCycleNumber = ((permit.inspectionCycles?.length || 0) + 1);

  const [inspectorName, setInspectorName] = useState(currentUser.fullName || currentUser.username);
  const [inspectorRole, setInspectorRole] = useState(currentUser.role === 'Administrator' ? 'افسر ارشد HSE' : 'کارشناس ایمنی HSE');
  const [findings, setFindings] = useState('');
  const [safetyApproved, setSafetyApproved] = useState(true);
  const [status, setStatus] = useState<'Approved' | 'Conditional' | 'Rejected'>('Approved');
  const [notes, setNotes] = useState('');
  const [correctiveActions, setCorrectiveActions] = useState('');

  // Gas testing state
  const [hasGasTest, setHasGasTest] = useState(permit.permitCategory === 'Hot' || permit.permitCategory === 'ConfinedSpace');
  const [o2, setO2] = useState<number>(20.9);
  const [lel, setLel] = useState<number>(0);
  const [h2s, setH2s] = useState<number>(0);
  const [co, setCo] = useState<number>(1);
  const [voc, setVoc] = useState<number>(0);
  const [gasNotes, setGasNotes] = useState('');

  // Checklist state
  const [checklist, setChecklist] = useState<Record<string, 'بله' | 'خیر' | 'لازم نیست'>>(() => {
    const initial: Record<string, 'بله' | 'خیر' | 'لازم نیست'> = {};
    DEFAULT_CHECKLIST_ITEMS.forEach(item => {
      initial[item] = 'بله';
    });
    return initial;
  });

  const handleToggleChecklist = (item: string, val: 'بله' | 'خیر' | 'لازم نیست') => {
    setChecklist(prev => ({ ...prev, [item]: val }));
  };

  const isGasTestSafe = o2 >= 19.5 && o2 <= 23.5 && lel < 5 && h2s < 10 && co < 25;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!findings.trim()) {
      toast.error(isFa ? 'لطفاً مشاهدات و نتایج بازرسی را وارد کنید.' : 'Please enter inspection findings.');
      return;
    }

    const now = new Date();
    const jalaliTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const jalaliDateStr = `${permit.year}/${permit.month}/${permit.day} ${jalaliTime}`;

    const newCycle: InspectionCycle = {
      id: `insp-${permit.id}-${nextCycleNumber}-${Date.now()}`,
      cycleNumber: nextCycleNumber,
      inspectedAt: now.toISOString(),
      persianDate: jalaliDateStr,
      inspectorName,
      inspectorRole,
      findings,
      checklistResults: checklist,
      gasTestResults: hasGasTest ? {
        testTime: jalaliTime,
        testerName: inspectorName,
        o2,
        lel,
        h2s,
        co,
        voc,
        status: isGasTestSafe && status !== 'Rejected' ? 'Approved' : 'Rejected',
        notes: gasNotes || (isGasTestSafe ? 'خوانش گازها در محدوده استاندارد' : 'عدم انطباق در گازسنجی')
      } : undefined,
      safetyApproved: status === 'Approved' || status === 'Conditional',
      status,
      notes,
      correctiveActionsRequired: correctiveActions
    };

    // Prepare updated permit fields without destroying previous cycles!
    const existingCycles = permit.inspectionCycles || [];
    const updatedCycles = [...existingCycles, newCycle];

    const partialUpdate: Partial<WorkPermit> = {
      inspectionCycles: updatedCycles,
      currentInspectionCycle: nextCycleNumber,
      safetyInspection: status === 'Approved' || status === 'Conditional' ? 'Approved' : 'Not Approved',
      updatedDate: now.toISOString()
    };

    // If inspection failed, suggest suspension
    if (status === 'Rejected') {
      partialUpdate.status = 'Suspended';
      partialUpdate.suspension = {
        reason: `رد بازرسی دوره ${nextCycleNumber}: ${findings}`,
        date: jalaliDateStr,
        suspendedBy: `${inspectorName} (${inspectorRole})`
      };
    }

    onSaveCycle(newCycle, partialUpdate);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-950/60 text-purple-600 rounded-2xl">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {isFa ? `ثبت دوره بازرسی مجدد (دوره ${nextCycleNumber})` : `Re-Inspection Cycle #${nextCycleNumber}`}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-mono text-xs font-bold">
                  {permit.serialNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa 
                  ? 'سوابق دوره‌های پیشین حفظ شده و این بازرسی به تاریخچه پروانه افزوده خواهد شد.' 
                  : 'Previous records will be preserved in the inspection history archive.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Inspector & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نام بازرس ایمنی / افسر HSE:</label>
              <input
                type="text"
                required
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">سمت / واحد بازرسی:</label>
              <input
                type="text"
                required
                value={inspectorRole}
                onChange={(e) => setInspectorRole(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Gas Testing Panel (Optional / Auto-suggested for Hot & Confined Space) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer">
                <Wind className="w-4 h-4 text-blue-500" />
                <span>تست مجدد اتمسفر و گازسنجی دوره {nextCycleNumber}</span>
              </label>
              <input
                type="checkbox"
                checked={hasGasTest}
                onChange={(e) => setHasGasTest(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {hasGasTest && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block text-[11px] mb-1">اکسیژن O2 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={o2}
                    onChange={(e) => setO2(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border text-center font-mono font-bold ${
                      o2 >= 19.5 && o2 <= 23.5 ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-800'
                    }`}
                  />
                  <span className="text-[9px] text-slate-400">استاندارد: 19.5-23.5</span>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block text-[11px] mb-1">گاز اشتعال LEL (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lel}
                    onChange={(e) => setLel(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border text-center font-mono font-bold ${
                      lel < 5 ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-800'
                    }`}
                  />
                  <span className="text-[9px] text-slate-400">حداکثر: 0-4%</span>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block text-[11px] mb-1">سولفید هیدروژن H2S</label>
                  <input
                    type="number"
                    step="0.1"
                    value={h2s}
                    onChange={(e) => setH2s(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border text-center font-mono font-bold ${
                      h2s < 10 ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-800'
                    }`}
                  />
                  <span className="text-[9px] text-slate-400">حد مجاز: &lt; 10 ppm</span>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block text-[11px] mb-1">مونوکسید کربن CO</label>
                  <input
                    type="number"
                    step="1"
                    value={co}
                    onChange={(e) => setCo(parseFloat(e.target.value) || 0)}
                    className={`w-full p-2 rounded-xl border text-center font-mono font-bold ${
                      co < 25 ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-rose-300 bg-rose-50 text-rose-800'
                    }`}
                  />
                  <span className="text-[9px] text-slate-400">حد مجاز: &lt; 25 ppm</span>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 block text-[11px] mb-1">ترکیبات آلی VOC</label>
                  <input
                    type="number"
                    step="0.1"
                    value={voc}
                    onChange={(e) => setVoc(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-mono font-bold"
                  />
                  <span className="text-[9px] text-slate-400">ppm</span>
                </div>
              </div>
            )}
          </div>

          {/* Checklist Evaluation */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">چک‌لیست بازرسی میدانی و شرایط کارگاهی:</label>
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 max-h-48 overflow-y-auto">
              {DEFAULT_CHECKLIST_ITEMS.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                  <span className="text-slate-800 dark:text-slate-200 text-xs font-medium">{item}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {(['بله', 'خیر', 'لازم نیست'] as const).map(choice => (
                      <button
                        type="button"
                        key={choice}
                        onClick={() => handleToggleChecklist(item, choice)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                          checklist[item] === choice
                            ? choice === 'بله'
                              ? 'bg-emerald-600 text-white'
                              : choice === 'خیر'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Findings and Observations */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              مشاهدات، عدم انطباق‌ها و یافته‌های بازرسی دوره {nextCycleNumber} (الزامی):
            </label>
            <textarea
              required
              rows={2}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="بررسی دمای بدنه، وضعیت جرقه، استقرار نگهبان، نتایج چک‌لیست..."
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Final Cycle Status & Corrective Action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">نتیجه نهایی این دوره بازرسی:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className={`w-full p-2.5 rounded-xl border font-bold ${
                  status === 'Approved'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : status === 'Conditional'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                <option value="Approved">تأیید کامل (Approved) - ادامه کار مجاز</option>
                <option value="Conditional">مشروط (Conditional) - رفع ایرادات جزئی حین کار</option>
                <option value="Rejected">رد صلاحیت (Rejected) - توقف کار و تعلیق پروانه</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">اقدامات اصلاحی مورد نیاز:</label>
              <input
                type="text"
                value={correctiveActions}
                onChange={(e) => setCorrectiveActions(e.target.value)}
                placeholder="مثال: خیساندن مجدد اطراف، تعویض فیلتر ماسک..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-500">
              این رکورد در سابقه دوره #{nextCycleNumber} ثبت و لاگ ممیزی خواهد شد.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-md shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>ثبت دوره بازرسی #{nextCycleNumber}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
