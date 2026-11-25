import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ClipboardCheck,
  AlertTriangle,
  Save,
  Loader2,
} from 'lucide-react';
import PersianDatePicker from '../../../components/common/PersianDatePicker';
import { getCurrentShamsiYear } from '../../../utils/jalaliDate';
import {
  createInitialScaffoldChecklist,
  evaluateScaffoldChecklist,
  SCAFFOLD_INSPECTION_REASONS,
  ScaffoldBootstrapData,
  ScaffoldChecklistResponseItem,
  ScaffoldInspectionReason,
  ScaffoldPermissionsMatrix,
  ScaffoldRecord,
} from './types';
import { scaffoldingApi } from './scaffoldingApi';
import ScaffoldChecklistSection, {
  validateScaffoldChecklistBeforeSubmit,
} from './ScaffoldChecklistSection';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scaffold: ScaffoldRecord;
  bootstrap: ScaffoldBootstrapData;
  permissions: ScaffoldPermissionsMatrix;
  previousChecklist?: ScaffoldChecklistResponseItem[] | null;
  onRecorded: (updatedScaffold: ScaffoldRecord) => void;
  onSettingsUpdated?: (allowNaOption: boolean) => void;
}

export default function ScaffoldInspectionModal({
  isOpen,
  onClose,
  scaffold,
  bootstrap,
  permissions,
  previousChecklist,
  onRecorded,
  onSettingsUpdated,
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
  const [safetyUnitSupervisorCode, setSafetyUnitSupervisorCode] = useState('');
  const [safetyUnitSupervisorName, setSafetyUnitSupervisorName] = useState('');
  const [approveAndIssueGreenTag, setApproveAndIssueGreenTag] = useState(false);

  const [allowNaOption, setAllowNaOption] = useState(Boolean(bootstrap.checklistSettings?.allowNaOption));
  const [savingSettings, setSavingSettings] = useState(false);
  const [items, setItems] = useState<ScaffoldChecklistResponseItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initialAllowNa = Boolean(bootstrap.checklistSettings?.allowNaOption);
    setErrorMsg(null);
    setAllowNaOption(initialAllowNa);
    setInspectionReason(scaffold.inspectionsCount > 0 ? 'PERIODIC_WEEKLY' : 'INITIAL_POST_INSTALL');
    setInspectionDate(bootstrap.todayJalali || '');
    setNextDueDate(bootstrap.defaultNextDueDate || '');
    setInspectorPersonnelId(scaffold.inspectorPersonnelId ?? null);
    setInspectorPersonnelCode(scaffold.inspectorPersonnelCode || '');
    setInspectorName(scaffold.inspectorName || '');
    setSafetyUnitSupervisorCode('');
    setSafetyUnitSupervisorName('');
    setSummaryNotes('');
    setApproveAndIssueGreenTag(false);
    setItems(createInitialScaffoldChecklist(previousChecklist, initialAllowNa));
  }, [isOpen, scaffold, bootstrap, previousChecklist]);

  const evaluation = useMemo(() => evaluateScaffoldChecklist(items), [items]);

  if (!isOpen) return null;

  const handleToggleAllowNa = async (nextVal: boolean) => {
    setSavingSettings(true);
    setErrorMsg(null);
    try {
      const saved = await scaffoldingApi.updateChecklistSettings({ allowNaOption: nextVal });
      setAllowNaOption(saved.allowNaOption);
      if (!saved.allowNaOption) {
        setItems(prev =>
          prev.map(it => {
            if (it.answer !== 'NA') return it;
            const safe = it.safeAnswer || 'YES';
            return { ...it, answer: safe, verdict: 'PASS' };
          })
        );
      }
      onSettingsUpdated?.(saved.allowNaOption);
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در ذخیره تنظیمات چک‌لیست');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!inspectorName.trim()) {
      return setErrorMsg('انتخاب نام بازرس HSE الزامی است.');
    }

    const validationErr = validateScaffoldChecklistBeforeSubmit(items, allowNaOption);
    if (validationErr) {
      return setErrorMsg(validationErr);
    }

    setSubmitting(true);
    try {
      const nowTime = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
      const stamp = `${inspectionDate} - ${nowTime}`;

      const res = await scaffoldingApi.recordInspection(scaffold.id, {
        inspectionReason,
        inspectionDate,
        inspectionTime: nowTime,
        nextDueDate,
        weatherCondition,
        maxLoadCapacityKg: maxLoadCapacityKg ? Number(maxLoadCapacityKg) : null,
        inspectorPersonnelId,
        inspectorPersonnelCode: inspectorPersonnelCode || null,
        inspectorName,
        checklistItems: items,
        summaryNotes,
        inspectorSignature: inspectorName,
        unitSupervisorSignature: safetyUnitSupervisorName || null,
        signaturesMeta: {
          inspectorName,
          inspectorPersonnelCode: inspectorPersonnelCode || undefined,
          inspectorSignedAt: stamp,
          unitSupervisorName: safetyUnitSupervisorName || undefined,
          unitSupervisorPersonnelCode: safetyUnitSupervisorCode || undefined,
          unitSupervisorSignedAt: safetyUnitSupervisorName ? stamp : undefined,
        },
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
                ثبت بازرسی و چک‌لیست ایمنی نصب داربست (۲۳ آیتم) — {scaffold.scaffoldCode}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
            <div className="sm:col-span-2 lg:col-span-2">
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

            <div className="lg:col-span-2">
              <PersianDatePicker
                isFa
                required
                label="تاریخ بازرسی"
                value={inspectionDate}
                onChange={val => setInspectionDate(val)}
                maxYear={getCurrentShamsiYear() + 5}
                placeholder="انتخاب تاریخ بازرسی"
              />
            </div>

            <div className="lg:col-span-2">
              <PersianDatePicker
                isFa
                label="سررسید بازرسی بعدی (دوره‌ای)"
                value={nextDueDate}
                onChange={val => setNextDueDate(val)}
                maxYear={getCurrentShamsiYear() + 5}
                placeholder="انتخاب سررسید بازرسی بعدی"
              />
            </div>

            <div className="lg:col-span-3">
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

            <div className="lg:col-span-3">
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

          {/* Unified 23-Item Checklist Component */}
          <ScaffoldChecklistSection
            items={items}
            onChangeItems={setItems}
            allowNaOption={allowNaOption}
            canConfigureSettings={permissions.canInspect || permissions.canEdit || permissions.canApprove}
            savingSettings={savingSettings}
            onToggleAllowNa={handleToggleAllowNa}
            summaryNotes={summaryNotes}
            onChangeSummaryNotes={setSummaryNotes}
            personnelList={bootstrap.personnelList}
            inspectorName={inspectorName}
            inspectorPersonnelCode={inspectorPersonnelCode}
            onSelectInspector={sel => {
              setInspectorPersonnelId(sel.id);
              setInspectorPersonnelCode(sel.personnelCode);
              setInspectorName(sel.fullName);
            }}
            safetyUnitSupervisorName={safetyUnitSupervisorName}
            safetyUnitSupervisorCode={safetyUnitSupervisorCode}
            onSelectSafetyUnitSupervisor={sel => {
              setSafetyUnitSupervisorCode(sel.personnelCode);
              setSafetyUnitSupervisorName(sel.fullName);
            }}
            signedAtPreview={inspectionDate}
            onError={msg => setErrorMsg(msg)}
          />

          {/* Optional Direct Approval */}
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
