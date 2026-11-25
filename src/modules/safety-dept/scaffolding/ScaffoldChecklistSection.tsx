import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Camera,
  Trash2,
  Plus,
  Settings2,
  Loader2,
  ClipboardCheck,
  PenTool,
} from 'lucide-react';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import { getCurrentShamsiYear } from '../../../utils/jalaliDate';
import {
  evaluateScaffoldChecklist,
  resolveChecklistAnswer,
  resolveChecklistVerdict,
  ScaffoldChecklistAnswer,
  ScaffoldChecklistResponseItem,
  ScaffoldPersonnelOption,
} from './types';

const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;

function readDefectPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('فقط فایل تصویری (JPG, PNG, WEBP) مجاز است.'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      reject(new Error('حداکثر حجم تصویر نقص ۲.۵ مگابایت است.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر'));
    reader.readAsDataURL(file);
  });
}

/**
 * Shared client-side validator for the 23-item safety checklist.
 * Enforces complete responses, N/A setting compliance, and mandatory comment/CAPA on any unsafe answer.
 */
export function validateScaffoldChecklistBeforeSubmit(
  items: ScaffoldChecklistResponseItem[],
  allowNaOption: boolean
): string | null {
  if (!Array.isArray(items) || items.length < 23) {
    return 'چک‌لیست ایمنی نصب داربست باید شامل تمام ۲۳ آیتم استاندارد باشد.';
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const safe = it.safeAnswer || 'YES';
    const ans = resolveChecklistAnswer({ ...it, safeAnswer: safe });
    const rowNo = it.orderIndex || i + 1;

    if (!ans) {
      return `پاسخ ردیف ${rowNo} («${it.titleFa}») مشخص نشده است.`;
    }
    if (ans === 'NA' && !allowNaOption) {
      return `گزینه «نامرتبط» برای ردیف ${rowNo} در تنظیمات چک‌لیست غیرفعال است.`;
    }
    const verdict = resolveChecklistVerdict(ans, safe);
    if (verdict === 'FAIL' && !String(it.comment || '').trim() && !String(it.correctiveAction || '').trim()) {
      return `برای ردیف ${rowNo} («${it.titleFa}») به دلیل ثبت وضعیت ناایمن، درج توضیحات یا اقدام اصلاحی الزامی است.`;
    }
  }

  return null;
}

export interface PersonnelSelectionResult {
  id: number | null;
  personnelCode: string;
  fullName: string;
}

export interface ScaffoldApproverSignaturesBlockProps {
  personnelList: ScaffoldPersonnelOption[];
  inspectorName: string;
  inspectorPersonnelCode: string;
  onSelectInspector: (sel: PersonnelSelectionResult) => void;
  safetyUnitSupervisorName?: string;
  safetyUnitSupervisorCode?: string;
  onSelectSafetyUnitSupervisor?: (sel: PersonnelSelectionResult) => void;
  showSafetyUnitSupervisor?: boolean;
  signedAtPreview?: string;
}

/**
 * Single reusable bottom selector block for HSE Inspector and Safety Unit Supervisor,
 * extracted directly from the Central Personnel Bank (zero duplicate selectors).
 */
export function ScaffoldApproverSignaturesBlock({
  personnelList,
  inspectorName,
  inspectorPersonnelCode,
  onSelectInspector,
  safetyUnitSupervisorName = '',
  safetyUnitSupervisorCode = '',
  onSelectSafetyUnitSupervisor,
  showSafetyUnitSupervisor = true,
  signedAtPreview,
}: ScaffoldApproverSignaturesBlockProps) {
  const resolveSelection = (person: any): PersonnelSelectionResult => {
    if (!person) {
      return { id: null, personnelCode: '', fullName: '' };
    }
    const matched = personnelList.find(
      p => p.personnelCode === person.personnelCode || p.fullName === person.fullName
    );
    return {
      id: matched?.id ?? null,
      personnelCode: person.personnelCode || matched?.personnelCode || '',
      fullName: person.fullName || matched?.fullName || '',
    };
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
        <span className="flex items-center gap-1.5">
          <PenTool className="w-4 h-4 text-blue-600" />
          تأییدیه‌ها و امضاهای رسمی (استخراج از بانک اطلاعاتی پرسنل)
        </span>
        {signedAtPreview && (
          <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
            تاریخ ثبت: {signedAtPreview}
          </span>
        )}
      </div>

      <div className={`grid grid-cols-1 ${showSafetyUnitSupervisor ? 'md:grid-cols-2' : ''} gap-4`}>
        <div>
          <CentralPersonnelSelector
            isFa
            required
            compact
            showOrgBadges={false}
            label="بازرس واحد HSE"
            selectedPersonnelCode={inspectorPersonnelCode}
            value={inspectorName}
            placeholder="جستجوی نام یا کد پرسنلی بازرس واحد HSE..."
            onSelectPersonnel={person => onSelectInspector(resolveSelection(person))}
          />
          {inspectorName && (
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              بازرس انتخاب‌شده: {inspectorName}
              {inspectorPersonnelCode ? ` (کد پرسنلی: ${inspectorPersonnelCode})` : ''}
            </div>
          )}
        </div>

        {showSafetyUnitSupervisor && onSelectSafetyUnitSupervisor && (
          <div>
            <CentralPersonnelSelector
              isFa
              compact
              showOrgBadges={false}
              label="مسئول واحد ایمنی"
              selectedPersonnelCode={safetyUnitSupervisorCode}
              value={safetyUnitSupervisorName}
              placeholder="جستجوی نام یا کد پرسنلی مسئول واحد ایمنی..."
              onSelectPersonnel={person => onSelectSafetyUnitSupervisor(resolveSelection(person))}
            />
            {safetyUnitSupervisorName && (
              <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mt-1">
                مسئول واحد ایمنی: {safetyUnitSupervisorName}
                {safetyUnitSupervisorCode ? ` (کد پرسنلی: ${safetyUnitSupervisorCode})` : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ScaffoldChecklistSectionProps {
  items: ScaffoldChecklistResponseItem[];
  onChangeItems: React.Dispatch<React.SetStateAction<ScaffoldChecklistResponseItem[]>>;
  allowNaOption: boolean;
  canConfigureSettings?: boolean;
  savingSettings?: boolean;
  onToggleAllowNa?: (nextVal: boolean) => void | Promise<void>;
  summaryNotes: string;
  onChangeSummaryNotes: (val: string) => void;
  personnelList: ScaffoldPersonnelOption[];
  inspectorName: string;
  inspectorPersonnelCode: string;
  onSelectInspector: (sel: PersonnelSelectionResult) => void;
  safetyUnitSupervisorName: string;
  safetyUnitSupervisorCode: string;
  onSelectSafetyUnitSupervisor: (sel: PersonnelSelectionResult) => void;
  signedAtPreview?: string;
  onError?: (msg: string) => void;
  allowCustomItems?: boolean;
}

export default function ScaffoldChecklistSection({
  items,
  onChangeItems,
  allowNaOption,
  canConfigureSettings = false,
  savingSettings = false,
  onToggleAllowNa,
  summaryNotes,
  onChangeSummaryNotes,
  personnelList,
  inspectorName,
  inspectorPersonnelCode,
  onSelectInspector,
  safetyUnitSupervisorName,
  safetyUnitSupervisorCode,
  onSelectSafetyUnitSupervisor,
  signedAtPreview,
  onError,
  allowCustomItems = true,
}: ScaffoldChecklistSectionProps) {
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [newCustomTitle, setNewCustomTitle] = useState('');
  const [newCustomCritical, setNewCustomCritical] = useState(false);

  const evaluation = evaluateScaffoldChecklist(items);
  const pickerMaxYear = getCurrentShamsiYear() + 5;

  const updateItem = (code: string, patch: Partial<ScaffoldChecklistResponseItem>) => {
    onChangeItems(prev =>
      prev.map(it => {
        if (it.code !== code) return it;
        const safe = it.safeAnswer || 'YES';
        const nextAnswer = patch.answer !== undefined ? patch.answer : it.answer;
        const nextVerdict =
          patch.answer !== undefined
            ? resolveChecklistVerdict(nextAnswer, safe)
            : patch.verdict !== undefined
              ? patch.verdict
              : it.verdict;
        return {
          ...it,
          ...patch,
          answer: nextAnswer,
          verdict: nextVerdict,
        };
      })
    );
  };

  const handleSelectAnswer = (item: ScaffoldChecklistResponseItem, answer: ScaffoldChecklistAnswer) => {
    const safe = item.safeAnswer || 'YES';
    const nextVerdict = resolveChecklistVerdict(answer, safe);
    updateItem(item.code, { answer, verdict: nextVerdict, resolved: false });
    if (nextVerdict === 'FAIL') {
      setExpandedCodes(prev => ({ ...prev, [item.code]: true }));
    }
  };

  const handleSetAllSafe = () => {
    onChangeItems(prev =>
      prev.map(it => {
        const safe = it.safeAnswer || 'YES';
        return {
          ...it,
          answer: safe,
          verdict: 'PASS',
          resolved: false,
        };
      })
    );
  };

  const handleDefectPhoto = async (code: string, files: FileList | null) => {
    if (!files || !files[0]) return;
    try {
      const dataUrl = await readDefectPhoto(files[0]);
      updateItem(code, { defectPhoto: dataUrl });
    } catch (err: any) {
      onError?.(err?.message || 'خطا در بارگذاری تصویر نقص');
    }
  };

  const handleAddCustomItem = () => {
    const title = newCustomTitle.trim();
    if (!title) return;
    const code = `SCF-C${String(items.length + 1).padStart(2, '0')}-${Date.now().toString().slice(-3)}`;
    onChangeItems(prev => [
      ...prev,
      {
        code,
        orderIndex: prev.length + 1,
        categoryFa: 'بند تکمیلی بازرس',
        titleFa: title,
        requirementFa: 'الزام اختصاصی ثبت‌شده توسط بازرس HSE بر اساس شرایط محل نصب',
        standardRef: 'CUSTOM-HSE',
        isCritical: newCustomCritical,
        safeAnswer: 'YES',
        isCustom: true,
        answer: 'YES',
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

  return (
    <div className="space-y-4">
      {/* Header & Live Compliance Bar */}
      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/50 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
              چک‌لیست ایمنی نصب داربست ({items.length} آیتم استاندارد)
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canConfigureSettings && onToggleAllowNa && (
              <button
                type="button"
                disabled={savingSettings}
                onClick={() => onToggleAllowNa(!allowNaOption)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                  allowNaOption
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title="تنظیم سراسری چک‌لیست (ذخیره در پایگاه داده مرکزی)"
              >
                {savingSettings ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Settings2 className="w-3.5 h-3.5" />
                )}
                <span>گزینه «نامرتبط»: {allowNaOption ? 'فعال' : 'غیرفعال'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSetAllSafe}
              className="px-3 py-1.5 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/20 text-[11px] font-black cursor-pointer transition"
            >
              پاسخ ایمن به همه
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-blue-100/80 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-black">
            انطباق ایمنی: {evaluation.complianceScore}٪
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-100/80 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-bold">
            ایمن (منطبق): {evaluation.passedCount}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-rose-100/80 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 font-bold">
            ناایمن (نقص باز): {evaluation.openDefectsCount}
          </span>
          {evaluation.criticalDefectCount > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black">
              نقص بحرانی: {evaluation.criticalDefectCount}
            </span>
          )}
          {allowNaOption && (
            <span className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
              نامرتبط: {evaluation.naCount}
            </span>
          )}
        </div>
      </div>

      {/* Safety Alert Banners */}
      {evaluation.criticalDefectCount > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-400 dark:border-rose-700 text-rose-800 dark:text-rose-200">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div className="text-xs leading-relaxed">
            <div className="font-black">
              هشدار ایمنی بحرانی: {evaluation.criticalDefectCount} نقص بحرانی باز ثبت شده است!
            </div>
            <p className="mt-1">
              طبق الزامات ایمنی HSECORE، در صورت وجود نقص بحرانی، تأیید نهایی و صدور تگ سبز به‌صورت سیستمی مسدود شده و تگ داربست به‌صورت خودکار{' '}
              <strong>قرمز (غیرمجاز به استفاده)</strong> خواهد شد. تکمیل توضیحات/اقدام اصلاحی برای تمام بندهای ناایمن الزامی است.
            </p>
          </div>
        </div>
      )}

      {evaluation.criticalDefectCount === 0 && evaluation.openDefectsCount > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <div className="font-black">ثبت {evaluation.openDefectsCount} مورد عدم انطباق غیربحرانی</div>
            <p className="mt-0.5">
              تگ داربست به <strong>زرد (ممنوعیت استفاده تا تکمیل اصلاحات و بازرسی مجدد)</strong> تغییر خواهد یافت.
            </p>
          </div>
        </div>
      )}

      {/* 23-Item Checklist Rows (Responsive Cards / Structured Columns) */}
      <div className="space-y-2">
        {items.map((item, idx) => {
          const safeAnswer = item.safeAnswer || 'YES';
          const currentAnswer = resolveChecklistAnswer({ ...item, safeAnswer });
          const currentVerdict = resolveChecklistVerdict(currentAnswer, safeAnswer);
          const isUnsafe = currentVerdict === 'FAIL';
          const missingMandatoryNote =
            isUnsafe && !String(item.comment || '').trim() && !String(item.correctiveAction || '').trim();
          const isExpanded = Boolean(expandedCodes[item.code]) || isUnsafe;
          const rowNo = item.orderIndex || idx + 1;

          const yesIsSafe = safeAnswer === 'YES';
          const noIsSafe = safeAnswer === 'NO';

          return (
            <div
              key={item.code}
              className={`rounded-2xl border transition-colors ${
                isUnsafe
                  ? item.isCritical
                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50/45 dark:bg-rose-950/25'
                    : 'border-amber-300 dark:border-amber-700 bg-amber-50/45 dark:bg-amber-950/25'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'
              }`}
            >
              <div className="p-3 sm:p-3.5 space-y-2.5">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  {/* Question Column */}
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-[11px] font-black font-mono text-slate-700 dark:text-slate-200 shrink-0 mt-0.5">
                      {rowNo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-relaxed">
                        {item.titleFa}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {item.isCritical && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-black">
                            بند بحرانی
                          </span>
                        )}
                        {safeAnswer === 'NO' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                            پاسخ ایمن: خیر
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{item.categoryFa}</span>
                      </div>
                    </div>
                  </div>

                  {/* Answer Controls: بله | خیر | (نامرتبط) */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSelectAnswer(item, 'YES')}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                        currentAnswer === 'YES'
                          ? yesIsSafe
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {yesIsSafe ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      بله
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectAnswer(item, 'NO')}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                        currentAnswer === 'NO'
                          ? noIsSafe
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {noIsSafe ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      خیر
                    </button>

                    {allowNaOption && (
                      <button
                        type="button"
                        onClick={() => handleSelectAnswer(item, 'NA')}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                          currentAnswer === 'NA'
                            ? 'bg-slate-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        نامرتبط
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCodes(prev => ({ ...prev, [item.code]: !prev[item.code] }))
                      }
                      title="جزئیات اقدام اصلاحی (CAPA)، مسئول و تصویر نقص"
                      className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {item.isCustom && (
                      <button
                        type="button"
                        onClick={() => onChangeItems(prev => prev.filter(x => x.code !== item.code))}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 cursor-pointer"
                        title="حذف بند سفارشی"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Dedicated Comment / Action Input per Row */}
                <div className="pr-0 sm:pr-8">
                  <input
                    type="text"
                    value={item.comment || ''}
                    onChange={e => updateItem(item.code, { comment: e.target.value })}
                    placeholder={
                      isUnsafe
                        ? 'اقدام / توضیحات (الزامی به علت پاسخ ناایمن)...'
                        : 'اقدام / توضیحات (اختیاری)...'
                    }
                    className={`w-full px-3 py-2 rounded-xl border text-xs outline-none transition ${
                      missingMandatoryNote
                        ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/70 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500'
                    }`}
                  />
                  {missingMandatoryNote && (
                    <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1">
                      به علت پاسخ ناایمن، درج توضیحات یا اقدام اصلاحی برای این بند الزامی است.
                    </div>
                  )}
                </div>
              </div>

              {/* Expandable CAPA, Responsible Person, Due Date & Defect Photo */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      اقدام اصلاحی (CAPA)
                    </label>
                    <input
                      type="text"
                      value={item.correctiveAction || ''}
                      onChange={e => updateItem(item.code, { correctiveAction: e.target.value })}
                      placeholder="شرح اقدام اصلاحی مورد نیاز..."
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
                      <PersianDatePicker
                        isFa
                        label="مهلت رفع نقص"
                        value={item.dueDate || ''}
                        onChange={val => updateItem(item.code, { dueDate: val })}
                        maxYear={pickerMaxYear}
                        placeholder="انتخاب مهلت"
                        showGregorianPreview={false}
                      />
                    </div>

                    <label className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                      <Camera className="w-3.5 h-3.5" />
                      <span>تصویر</span>
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
                        className="w-16 h-16 rounded-xl object-cover border border-slate-300"
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

      {/* Optional Extensible Custom Row */}
      {allowCustomItems && (
        <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-900/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={newCustomTitle}
            onChange={e => setNewCustomTitle(e.target.value)}
            placeholder="افزودن بند بازرسی تکمیلی (اختیاری)..."
            className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100"
          />
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0">
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
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            افزودن بند
          </button>
        </div>
      )}

      {/* General Remarks Section (توضیحات کلی) */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
          توضیحات کلی چک‌لیست ایمنی نصب داربست
        </label>
        <textarea
          rows={2}
          value={summaryNotes}
          onChange={e => onChangeSummaryNotes(e.target.value)}
          placeholder="توضیحات کلی، جمع‌بندی ایمنی نصب داربست، شرایط محیطی و ملاحظات ویژه..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Bottom Official Approvers from Central Personnel Bank (HSE Inspector & Safety Unit Supervisor) */}
      <ScaffoldApproverSignaturesBlock
        personnelList={personnelList}
        inspectorName={inspectorName}
        inspectorPersonnelCode={inspectorPersonnelCode}
        onSelectInspector={onSelectInspector}
        safetyUnitSupervisorName={safetyUnitSupervisorName}
        safetyUnitSupervisorCode={safetyUnitSupervisorCode}
        onSelectSafetyUnitSupervisor={onSelectSafetyUnitSupervisor}
        signedAtPreview={signedAtPreview}
      />
    </div>
  );
}
