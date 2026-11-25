import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  Plus,
  Camera,
  Trash2,
  Save,
  Loader2,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import {
  evaluateScaffoldChecklist,
  SCAFFOLD_INSPECTION_REASONS,
  ScaffoldBootstrapData,
  ScaffoldChecklistResponseItem,
  ScaffoldChecklistVerdict,
  ScaffoldInspectionReason,
  ScaffoldPermissionsMatrix,
  ScaffoldRecord,
  STANDARD_SCAFFOLD_CHECKLIST_ITEMS,
} from './types';
import { scaffoldingApi } from './scaffoldingApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scaffold: ScaffoldRecord;
  bootstrap: ScaffoldBootstrapData;
  permissions: ScaffoldPermissionsMatrix;
  previousChecklist?: ScaffoldChecklistResponseItem[] | null;
  onRecorded: (updatedScaffold: ScaffoldRecord) => void;
}

const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('فقط فایل تصویری مجاز است.'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      reject(new Error('حداکثر حجم تصویر نقص ۲.۵ مگابایت است.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خطا در خواندن تصویر'));
    reader.readAsDataURL(file);
  });
}

export default function ScaffoldInspectionModal({
  isOpen,
  onClose,
  scaffold,
  bootstrap,
  permissions,
  previousChecklist,
  onRecorded,
}: Props) {
  const defaultReason: ScaffoldInspectionReason =
    scaffold.inspectionsCount > 0 ? 'PERIODIC_WEEKLY' : 'INITIAL_POST_INSTALL';

  const [inspectionReason, setInspectionReason] = useState<ScaffoldInspectionReason>(defaultReason);
  const [inspectionDate, setInspectionDate] = useState(bootstrap.todayJalali || '');
  const [nextDueDate, setNextDueDate] = useState(bootstrap.defaultNextDueDate || '');
  const [weatherCondition, setWeatherCondition] = useState('مساعد / نرمال');
  const [maxLoadCapacityKg, setMaxLoadCapacityKg] = useState('250');
  const [inspectorPersonnelId, setInspectorPersonnelId] = useState<number | null>(
    scaffold.inspectorPersonnelId ?? null
  );
  const [inspectorPersonnelCode, setInspectorPersonnelCode] = useState(
    scaffold.inspectorPersonnelCode || ''
  );
  const [inspectorName, setInspectorName] = useState(scaffold.inspectorName || '');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [approveAndIssueGreenTag, setApproveAndIssueGreenTag] = useState(false);

  const [items, setItems] = useState<ScaffoldChecklistResponseItem[]>([]);
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [newCustomTitle, setNewCustomTitle] = useState('');
  const [newCustomCritical, setNewCustomCritical] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setInspectionReason(scaffold.inspectionsCount > 0 ? 'PERIODIC_WEEKLY' : 'INITIAL_POST_INSTALL');
    setInspectionDate(bootstrap.todayJalali || '');
    setNextDueDate(bootstrap.defaultNextDueDate || '');
    setInspectorPersonnelId(scaffold.inspectorPersonnelId ?? null);
    setInspectorPersonnelCode(scaffold.inspectorPersonnelCode || '');
    setInspectorName(scaffold.inspectorName || '');
    setSummaryNotes('');
    setApproveAndIssueGreenTag(false);
    setNewCustomTitle('');
    setNewCustomCritical(false);

    // Initialize from standard 15 items; carry forward unresolved defect descriptions if re-inspecting
    const prevByCode = new Map(
      (Array.isArray(previousChecklist) ? previousChecklist : []).map(i => [i.code, i])
    );

    const initialized: ScaffoldChecklistResponseItem[] = STANDARD_SCAFFOLD_CHECKLIST_ITEMS.map(tpl => {
      const prev = prevByCode.get(tpl.code);
      return {
        code: tpl.code,
        orderIndex: tpl.orderIndex,
        categoryFa: tpl.categoryFa,
        titleFa: tpl.titleFa,
        requirementFa: tpl.requirementFa,
        standardRef: tpl.standardRef,
        isCritical: tpl.isCritical,
        isCustom: false,
        verdict: prev?.verdict === 'FAIL' && !prev.resolved ? 'FAIL' : 'PASS',
        comment: prev?.verdict === 'FAIL' && !prev.resolved ? prev.comment : '',
        defectPhoto: prev?.verdict === 'FAIL' && !prev.resolved ? prev.defectPhoto : undefined,
        correctiveAction: prev?.verdict === 'FAIL' && !prev.resolved ? prev.correctiveAction : '',
        responsiblePerson: prev?.verdict === 'FAIL' && !prev.resolved ? prev.responsiblePerson : '',
        dueDate: prev?.verdict === 'FAIL' && !prev.resolved ? prev.dueDate : '',
        resolved: false,
      };
    });

    // Preserve any custom items from previous inspection
    if (Array.isArray(previousChecklist)) {
      previousChecklist
        .filter(i => i.isCustom)
        .forEach((c, idx) => {
          initialized.push({
            ...c,
            orderIndex: initialized.length + idx + 1,
          });
        });
    }

    setItems(initialized);

    const initialExpanded: Record<string, boolean> = {};
    initialized.forEach(it => {
      if (it.verdict === 'FAIL') initialExpanded[it.code] = true;
    });
    setExpandedCodes(initialExpanded);
  }, [isOpen, scaffold, bootstrap, previousChecklist]);

  const evaluation = useMemo(() => evaluateScaffoldChecklist(items), [items]);

  if (!isOpen) return null;

  const updateItem = (code: string, patch: Partial<ScaffoldChecklistResponseItem>) => {
    setItems(prev => prev.map(it => (it.code === code ? { ...it, ...patch } : it)));
    if (patch.verdict === 'FAIL') {
      setExpandedCodes(prev => ({ ...prev, [code]: true }));
    }
  };

  const setAllVerdict = (verdict: ScaffoldChecklistVerdict) => {
    setItems(prev => prev.map(it => ({ ...it, verdict, resolved: false })));
  };

  const handleAddCustomItem = () => {
    const title = newCustomTitle.trim();
    if (!title) return;
    const code = `SCF-C${String(items.length + 1).padStart(2, '0')}-${Date.now().toString().slice(-3)}`;
    setItems(prev => [
      ...prev,
      {
        code,
        orderIndex: prev.length + 1,
        categoryFa: 'بند تکمیلی بازرس',
        titleFa: title,
        requirementFa: 'الزام اختصاصی ثبت‌شده توسط بازرس HSE بر اساس شرایط سایت',
        standardRef: 'CUSTOM-HSE',
        isCritical: newCustomCritical,
        isCustom: true,
        verdict: 'PASS',
        comment: '',
        correctiveAction: '',
        responsiblePerson: '',
        dueDate: '',
        resolved: false,
      },
    ]);
    setNewCustomTitle('');
    setNewCustomCritical(false);
  };

  const handleDefectPhoto = async (code: string, files: FileList | null) => {
    if (!files || !files[0]) return;
    setErrorMsg(null);
    try {
      const dataUrl = await readPhoto(files[0]);
      updateItem(code, { defectPhoto: dataUrl });
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در بارگذاری تصویر نقص');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!inspectorName.trim()) {
      return setErrorMsg('انتخاب نام بازرس HSE الزامی است.');
    }
    const missingVerdict = items.find(i => !i.verdict);
    if (missingVerdict) {
      return setErrorMsg(`وضعیت بند «${missingVerdict.titleFa}» مشخص نشده است.`);
    }

    setSubmitting(true);
    try {
      const res = await scaffoldingApi.recordInspection(scaffold.id, {
        inspectionReason,
        inspectionDate,
        nextDueDate,
        weatherCondition,
        maxLoadCapacityKg: maxLoadCapacityKg ? Number(maxLoadCapacityKg) : null,
        inspectorPersonnelId,
        inspectorPersonnelCode: inspectorPersonnelCode || null,
        inspectorName,
        checklistItems: items,
        summaryNotes,
        approveAndIssueGreenTag:
          evaluation.openDefectsCount === 0 &&
          permissions.canApprove &&
          permissions.canChangeTag &&
          approveAndIssueGreenTag,
      });
      onRecorded(res.scaffold);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در ثبت بازرسی داربست');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl max-h-[94vh] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                ثبت بازرسی و چک‌لیست استاندارد داربست — {scaffold.scaffoldCode}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {scaffold.requestingUnit} | {scaffold.installationLocation} | پیمانکار: {scaffold.contractorName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Inspection Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نوع / علت بازرسی <span className="text-rose-500">*</span>
              </label>
              <select
                value={inspectionReason}
                onChange={e => setInspectionReason(e.target.value as ScaffoldInspectionReason)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
              >
                {SCAFFOLD_INSPECTION_REASONS.map(r => (
                  <option key={r.value} value={r.value}>
                    {r.labelFa}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                تاریخ بازرسی
              </label>
              <input
                type="text"
                required
                value={inspectionDate}
                onChange={e => setInspectionDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                سررسید بازرسی بعدی (دوره‌ای)
              </label>
              <input
                type="text"
                value={nextDueDate}
                onChange={e => setNextDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <CentralPersonnelSelector
                isFa
                compact
                required
                label="بازرس انجام‌دهنده بازرسی HSE"
                selectedPersonnelCode={inspectorPersonnelCode}
                onSelectPersonnel={person => {
                  if (person) {
                    const matched = bootstrap.personnelList.find(p => p.personnelCode === person.personnelCode);
                    setInspectorPersonnelId(matched?.id ?? null);
                    setInspectorPersonnelCode(person.personnelCode || '');
                    setInspectorName(person.fullName || '');
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                شرایط جوی زمان بازرسی
              </label>
              <input
                type="text"
                value={weatherCondition}
                onChange={e => setWeatherCondition(e.target.value)}
                placeholder="مثال: صاف، سرعت باد کم"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                حداکثر بار مجاز (کیلوگرم)
              </label>
              <input
                type="number"
                value={maxLoadCapacityKg}
                onChange={e => setMaxLoadCapacityKg(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Live Evaluation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-black">
                امتیاز انطباق: {evaluation.complianceScore}٪
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold">
                تأیید: {evaluation.passedCount}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 font-bold">
                عدم تأیید باز: {evaluation.openDefectsCount}
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                نامرتبط: {evaluation.naCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllVerdict('PASS')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/20 text-[11px] font-bold cursor-pointer"
              >
                تأیید همه بندها
              </button>
            </div>
          </div>

          {/* Critical Defect Hard Blocker Warning */}
          {evaluation.criticalDefectCount > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-700 text-rose-800 dark:text-rose-200">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="text-xs leading-relaxed">
                <div className="font-black">
                  هشدار ایمنی بحرانی: {evaluation.criticalDefectCount} نقص بحرانی باز ثبت شده است!
                </div>
                <p className="mt-1">
                  طبق الزامات ایمنی HSECORE، در صورت وجود نقص بحرانی، تأیید نهایی و صدور تگ سبز به‌صورت سیستمی مسدود شده و تگ داربست به‌صورت خودکار <strong>قرمز (غیرمجاز به استفاده)</strong> خواهد شد.
                </p>
              </div>
            </div>
          )}

          {evaluation.criticalDefectCount === 0 && evaluation.openDefectsCount > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div className="font-black">ثبت {evaluation.openDefectsCount} نقص غیربحرانی باز</div>
                <p className="mt-0.5">
                  تگ داربست به <strong>زرد (ممنوعیت استفاده تا تکمیل اصلاحات و بازرسی مجدد)</strong> تغییر خواهد یافت.
                </p>
              </div>
            </div>
          )}

          {/* Checklist Items List */}
          <div className="space-y-2.5">
            {items.map((item, idx) => {
              const isFailed = item.verdict === 'FAIL';
              const isExpanded = Boolean(expandedCodes[item.code]) || isFailed;
              return (
                <div
                  key={item.code}
                  className={`rounded-2xl border transition-colors ${
                    isFailed
                      ? item.isCritical
                        ? 'border-rose-300 dark:border-rose-700 bg-rose-50/40 dark:bg-rose-950/20'
                        : 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'
                  }`}
                >
                  <div className="p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-[11px] font-black text-slate-700 dark:text-slate-200">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {item.titleFa}
                        </span>
                        {item.isCritical && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                            بند بحرانی
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.standardRef}
                        </span>
                      </div>
                      {item.requirementFa && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed pr-8">
                          {item.requirementFa}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateItem(item.code, { verdict: 'PASS', resolved: false })}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                          item.verdict === 'PASS'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        تأیید
                      </button>

                      <button
                        type="button"
                        onClick={() => updateItem(item.code, { verdict: 'FAIL', resolved: false })}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                          item.verdict === 'FAIL'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-50'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        عدم تأیید
                      </button>

                      <button
                        type="button"
                        onClick={() => updateItem(item.code, { verdict: 'NA', resolved: false })}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                          item.verdict === 'NA'
                            ? 'bg-slate-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        نامرتبط
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCodes(prev => ({ ...prev, [item.code]: !prev[item.code] }))
                        }
                        title="توضیحات / اقدام اصلاحی / تصویر نقص"
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {item.isCustom && (
                        <button
                          type="button"
                          onClick={() => setItems(prev => prev.filter(x => x.code !== item.code))}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 cursor-pointer"
                          title="حذف بند سفارشی"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Defect / CAPA / Photo Panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-200/70 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          توضیحات بازرس / شرح نقص مشاهده‌شده
                        </label>
                        <input
                          type="text"
                          value={item.comment || ''}
                          onChange={e => updateItem(item.code, { comment: e.target.value })}
                          placeholder="شرح دقیق وضعیت یا نقص مشاهده‌شده..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          اقدام اصلاحی مورد نیاز (CAPA)
                        </label>
                        <input
                          type="text"
                          value={item.correctiveAction || ''}
                          onChange={e => updateItem(item.code, { correctiveAction: e.target.value })}
                          placeholder="مثال: نصب گاردریل میانی و مهار تخته‌ها"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          مسئول رفع نقص
                        </label>
                        <input
                          type="text"
                          value={item.responsiblePerson || ''}
                          onChange={e => updateItem(item.code, { responsiblePerson: e.target.value })}
                          placeholder="نام سرپرست یا پیمانکار مسئول"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                        />
                      </div>

                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            مهلت رفع نقص
                          </label>
                          <input
                            type="text"
                            value={item.dueDate || ''}
                            onChange={e => updateItem(item.code, { dueDate: e.target.value })}
                            placeholder="1405/09/05"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100"
                          />
                        </div>

                        <label className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                          <Camera className="w-3.5 h-3.5" />
                          <span>تصویر نقص</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleDefectPhoto(item.code, e.target.files)}
                          />
                        </label>
                      </div>

                      {item.defectPhoto && (
                        <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
                          <img
                            src={item.defectPhoto}
                            alt="تصویر نقص"
                            className="w-20 h-20 rounded-xl object-cover border border-slate-300"
                          />
                          <button
                            type="button"
                            onClick={() => updateItem(item.code, { defectPhoto: undefined })}
                            className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            حذف تصویر نقص
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Extensible Checklist: Add Custom Item */}
          <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={newCustomTitle}
              onChange={e => setNewCustomTitle(e.target.value)}
              placeholder="افزودن بند بازرسی تکمیلی / سفارشی (قابل توسعه)..."
              className="flex-1 px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
            />
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={newCustomCritical}
                onChange={e => setNewCustomCritical(e.target.checked)}
                className="rounded border-slate-300"
              />
              بند بحرانی
            </label>
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              افزودن بند
            </button>
          </div>

          {/* Summary & Optional Direct Approval */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                جمع‌بندی و ملاحظات نهایی بازرس HSE
              </label>
              <textarea
                rows={2}
                value={summaryNotes}
                onChange={e => setSummaryNotes(e.target.value)}
                placeholder="توضیحات کلی بازرس درباره استحکام سازه، شرایط بهره‌برداری و توصیه‌های ایمنی..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
              />
            </div>

            {evaluation.openDefectsCount === 0 && permissions.canApprove && permissions.canChangeTag && (
              <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveAndIssueGreenTag}
                  onChange={e => setApproveAndIssueGreenTag(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                  تأیید نهایی بازرس HSE و صدور هم‌زمان «تگ سبز (مجاز به استفاده)» تا تاریخ {nextDueDate}
                </span>
              </label>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>ثبت نهایی بازرسی در پایگاه داده</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
