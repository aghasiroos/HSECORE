import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldAlert,
  FileText,
  FlaskConical,
  Flame,
  HardHat,
  Truck,
  BookOpen,
  Lock,
  GitBranch,
  CheckCircle2,
  Upload,
} from 'lucide-react';
import moment from 'moment-jalaali';
import { toast } from 'react-hot-toast';
import { sdsApi, DuplicateCheckResult } from '../sdsApi';
import {
  SdsRecordItem,
  SdsPhysicalState,
  SdsSignalWord,
  SdsGhsData,
  SdsSections16,
  SdsCompositionRow,
  createDefaultGhsData,
  createEmptySections16,
} from '../types';
import {
  PHYSICAL_STATE_LABELS,
  COMMON_EXPOSURE_ROUTES,
  COMMON_HAZARD_CLASSES,
  COMMON_H_STATEMENTS,
  COMMON_P_STATEMENTS,
  SDS_STATUS_META,
} from '../constants';
import { GhsPictogramSelector } from './GhsPictograms';

interface SdsFormModalProps {
  isOpen: boolean;
  editingRecord: SdsRecordItem | null;
  orgUnits: string[];
  isFa: boolean;
  onClose: () => void;
  onSaved: (record: SdsRecordItem) => void;
  onStartRevision?: (record: SdsRecordItem) => Promise<void>;
}

type FormStepKey = 'core_ghs' | 'sec_1_4' | 'sec_5_8' | 'sec_9_12' | 'sec_13_16';

export const SdsFormModal: React.FC<SdsFormModalProps> = ({
  isOpen,
  editingRecord,
  orgUnits,
  isFa,
  onClose,
  onSaved,
  onStartRevision,
}) => {
  const [activeStep, setActiveStep] = useState<FormStepKey>('core_ghs');
  const [submitting, setSubmitting] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult | null>(null);

  // Core metadata
  const [documentNumber, setDocumentNumber] = useState('');
  const [materialNameFa, setMaterialNameFa] = useState('');
  const [materialNameEn, setMaterialNameEn] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [unNumber, setUnNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [supplier, setSupplier] = useState('');
  const [unitName, setUnitName] = useState('عمومی مجتمع');
  const [storageLocation, setStorageLocation] = useState('');
  const [physicalState, setPhysicalState] = useState<SdsPhysicalState>('LIQUID');
  const [revisionNumber, setRevisionNumber] = useState<number>(1);
  const [preparedDate, setPreparedDate] = useState(() => moment().format('jYYYY/jMM/jDD'));
  const [lastRevisionDate, setLastRevisionDate] = useState(() => moment().format('jYYYY/jMM/jDD'));
  const [revisionTriggerReason, setRevisionTriggerReason] = useState('تدوین اولیه سند');

  // Optional immediate primary PDF attachment on create
  const [initialPdfFile, setInitialPdfFile] = useState<File | null>(null);

  // GHS & 16 Sections
  const [ghsData, setGhsData] = useState<SdsGhsData>(createDefaultGhsData());
  const [sections, setSections] = useState<SdsSections16>(createEmptySections16());
  const [customHInput, setCustomHInput] = useState('');
  const [customPInput, setCustomPInput] = useState('');
  const [customHazardClass, setCustomHazardClass] = useState('');

  const isLockedApproved =
    Boolean(editingRecord) &&
    (editingRecord?.status === 'APPROVED' ||
      editingRecord?.status === 'PUBLISHED' ||
      editingRecord?.status === 'OBSOLETE');

  useEffect(() => {
    if (!isOpen) return;
    setActiveStep('core_ghs');
    setDuplicateInfo(null);
    setInitialPdfFile(null);

    if (editingRecord) {
      setDocumentNumber(editingRecord.documentNumber || '');
      setMaterialNameFa(editingRecord.materialNameFa || '');
      setMaterialNameEn(editingRecord.materialNameEn || '');
      setTradeName(editingRecord.tradeName || '');
      setCasNumber(editingRecord.casNumber || '');
      setUnNumber(editingRecord.unNumber || '');
      setManufacturer(editingRecord.manufacturer || '');
      setSupplier(editingRecord.supplier || '');
      setUnitName(editingRecord.unitName || 'عمومی مجتمع');
      setStorageLocation(editingRecord.storageLocation || '');
      setPhysicalState(editingRecord.physicalState || 'LIQUID');
      setRevisionNumber(editingRecord.revisionNumber || 1);
      setPreparedDate(editingRecord.preparedDate || moment().format('jYYYY/jMM/jDD'));
      setLastRevisionDate(editingRecord.lastRevisionDate || '');
      setRevisionTriggerReason(editingRecord.revisionTriggerReason || '');
      setGhsData(editingRecord.ghsData || createDefaultGhsData());
      setSections(editingRecord.sections || createEmptySections16(editingRecord.materialNameEn));
    } else {
      const todayJ = moment().format('jYYYY/jMM/jDD');
      setDocumentNumber('');
      setMaterialNameFa('');
      setMaterialNameEn('');
      setTradeName('');
      setCasNumber('');
      setUnNumber('');
      setManufacturer('');
      setSupplier('');
      setUnitName(orgUnits[0] || 'عمومی مجتمع');
      setStorageLocation('');
      setPhysicalState('LIQUID');
      setRevisionNumber(1);
      setPreparedDate(todayJ);
      setLastRevisionDate(todayJ);
      setRevisionTriggerReason('تدوین اولیه سند');
      setGhsData(createDefaultGhsData());
      setSections(createEmptySections16());
    }
  }, [isOpen, editingRecord, orgUnits]);

  // Debounced live duplicate check for CAS number & names
  useEffect(() => {
    if (!isOpen || isLockedApproved) return;
    if (!casNumber.trim() && !materialNameFa.trim() && !materialNameEn.trim()) {
      setDuplicateInfo(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await sdsApi.checkDuplicate({
          casNumber: casNumber.trim() || undefined,
          materialNameFa: materialNameFa.trim() || undefined,
          materialNameEn: materialNameEn.trim() || undefined,
          excludeId: editingRecord?.id,
        });
        setDuplicateInfo(res);
      } catch {
        // Silent check fallback; backend enforces strictly on save
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [casNumber, materialNameFa, materialNameEn, editingRecord?.id, isOpen, isLockedApproved]);

  if (!isOpen) return null;

  const updateSection = <K extends keyof SdsSections16>(
    secKey: K,
    patch: Partial<SdsSections16[K]>
  ) => {
    setSections((prev) => ({
      ...prev,
      [secKey]: {
        ...(prev[secKey] as any),
        ...patch,
      },
    }));
  };

  const addIngredientRow = () => {
    const nextRows: SdsCompositionRow[] = [
      ...(sections.section3.ingredients || []),
      { ingredientName: '', casNumber: '', concentration: '', classification: '' },
    ];
    updateSection('section3', { ingredients: nextRows });
  };

  const updateIngredientRow = (idx: number, patch: Partial<SdsCompositionRow>) => {
    const nextRows = [...(sections.section3.ingredients || [])];
    nextRows[idx] = { ...nextRows[idx], ...patch };
    updateSection('section3', { ingredients: nextRows });
  };

  const removeIngredientRow = (idx: number) => {
    const nextRows = (sections.section3.ingredients || []).filter((_, i) => i !== idx);
    updateSection('section3', { ingredients: nextRows });
  };

  const toggleArrayItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleSubmit = async (submitForReview = false) => {
    if (isLockedApproved) {
      toast.error(
        isFa
          ? 'نسخه تأییدشده یا منتشرشده قابل ویرایش مستقیم نیست. ابتدا بازنگری جدید ایجاد کنید.'
          : 'Approved/Published SDS cannot be edited directly.'
      );
      return;
    }
    if (!materialNameFa.trim() && !materialNameEn.trim()) {
      toast.error(isFa ? 'وارد کردن نام فارسی یا انگلیسی ماده شیمیایی الزامی است.' : 'Chemical name is required.');
      setActiveStep('core_ghs');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        documentNumber: documentNumber.trim() || undefined,
        materialNameFa: materialNameFa.trim() || materialNameEn.trim(),
        materialNameEn: materialNameEn.trim() || materialNameFa.trim(),
        tradeName: tradeName.trim(),
        casNumber: casNumber.trim(),
        unNumber: unNumber.trim(),
        manufacturer: manufacturer.trim(),
        supplier: supplier.trim(),
        unitName: unitName.trim() || 'عمومی مجتمع',
        storageLocation: storageLocation.trim(),
        physicalState,
        revisionNumber,
        preparedDate: preparedDate.trim() || moment().format('jYYYY/jMM/jDD'),
        lastRevisionDate: lastRevisionDate.trim(),
        revisionTriggerReason: revisionTriggerReason.trim(),
        status: submitForReview ? 'UNDER_REVIEW' : editingRecord?.status || 'DRAFT',
        ghsData,
        sections: {
          ...sections,
          section1: {
            ...sections.section1,
            productIdentifier:
              sections.section1.productIdentifier?.trim() ||
              `${materialNameFa.trim() || materialNameEn.trim()}`,
          },
          section14: {
            ...sections.section14,
            unNumber: sections.section14.unNumber || unNumber.trim(),
          },
        },
      };

      let saved: SdsRecordItem;
      if (editingRecord) {
        saved = await sdsApi.update(editingRecord.id, payload);
        if (submitForReview && saved.status === 'DRAFT') {
          saved = await sdsApi.changeStatus(saved.id, { action: 'SUBMIT_REVIEW' });
        }
        toast.success(isFa ? 'برگه اطلاعات ایمنی (SDS) با موفقیت بروزرسانی شد.' : 'SDS updated.');
      } else {
        saved = await sdsApi.create(payload);
        if (initialPdfFile) {
          try {
            await sdsApi.uploadAttachment(saved.id, {
              file: initialPdfFile,
              attachmentRole: 'PRIMARY_SDS_PDF',
              title: initialPdfFile.name,
              isPrimary: true,
            });
            saved = await sdsApi.getById(saved.id);
          } catch (uploadErr: any) {
            toast.error(
              `رکورد SDS ثبت شد اما بارگذاری فایل پیوست با خطا مواجه شد: ${uploadErr?.message || ''}`
            );
          }
        }
        toast.success(isFa ? 'برگه اطلاعات ایمنی (SDS) با موفقیت ثبت گردید.' : 'SDS created.');
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در ذخیره برگه SDS' : 'Error saving SDS'));
    } finally {
      setSubmitting(false);
    }
  };

  const stepTabs: { key: FormStepKey; labelFa: string; labelEn: string; icon: any }[] = [
    { key: 'core_ghs', labelFa: 'اطلاعات پایه و خطرات GHS', labelEn: 'Core Info & GHS', icon: ShieldAlert },
    { key: 'sec_1_4', labelFa: 'بخش‌های ۱ تا ۴ (شناسایی، ترکیب، کمک اولیه)', labelEn: 'Sections 1–4', icon: FlaskConical },
    { key: 'sec_5_8', labelFa: 'بخش‌های ۵ تا ۸ (حریق، نشت، انبارش، PPE)', labelEn: 'Sections 5–8', icon: Flame },
    { key: 'sec_9_12', labelFa: 'بخش‌های ۹ تا ۱۲ (خواص فیزیکی، سمیت، محیط)', labelEn: 'Sections 9–12', icon: HardHat },
    { key: 'sec_13_16', labelFa: 'بخش‌های ۱۳ تا ۱۶ (دفع، حمل، قوانین، سایر)', labelEn: 'Sections 13–16', icon: Truck },
  ];

  const inputClass =
    'w-full px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-slate-800 dark:text-slate-100 disabled:opacity-60';
  const textareaClass = `${inputClass} min-h-[72px] resize-y leading-relaxed`;
  const labelClass = 'block text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1';

  const statusMeta = editingRecord ? SDS_STATUS_META[editingRecord.status] : null;

  return (
    <div className="fixed inset-0 z-[10050] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-6xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                  {editingRecord
                    ? isFa
                      ? `ویرایش برگه اطلاعات ایمنی ماده: ${editingRecord.materialNameFa}`
                      : `Edit SDS: ${editingRecord.materialNameEn}`
                    : isFa
                    ? 'ثبت برگه اطلاعات ایمنی ماده شیمیایی جدید (SDS — ۱۶ بخشی GHS)'
                    : 'Register New Chemical Safety Data Sheet (SDS)'}
                </h3>
                {statusMeta && (
                  <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${statusMeta.badgeClass}`}>
                    {isFa ? statusMeta.fa : statusMeta.en}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {isFa
                  ? 'منطبق با استاندارد بین‌المللی GHS / ISO 11014 و الزامات HSE مجتمع پتروشیمی رجال'
                  : 'Compliant with GHS / ISO 11014 16-Section Standard'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Locked Approved/Published Banner */}
        {isLockedApproved && editingRecord && (
          <div className="mx-5 mt-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                <span className="font-black block">
                  {isFa
                    ? 'نسخه تأییدشده / منتشرشده قفل شده است'
                    : 'Approved / Published SDS is locked'}
                </span>
                {isFa
                  ? 'برای حفظ اصالت اسناد HSE، ویرایش مستقیم نسخه تأییدشده مجاز نیست. جهت اعمال اصلاحات، یک بازنگری جدید (Revision) ایجاد نمایید.'
                  : 'Direct editing is blocked. Create a new revision to modify.'}
              </div>
            </div>
            {editingRecord.status !== 'OBSOLETE' && onStartRevision && (
              <button
                type="button"
                onClick={async () => {
                  await onStartRevision(editingRecord);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <GitBranch className="w-4 h-4" />
                <span>{isFa ? 'ایجاد بازنگری جدید و باز کردن ویرایش' : 'Create New Revision'}</span>
              </button>
            )}
          </div>
        )}

        {/* Duplicate Warning Banner */}
        {duplicateInfo?.isDuplicate && duplicateInfo.existingRecord && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 flex items-center gap-2.5 text-xs font-bold text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {duplicateInfo.conflictType === 'CAS'
                ? `هشدار تکرار شماره CAS: شماره ${duplicateInfo.existingRecord.casNumber} قبلاً در مدرک ${duplicateInfo.existingRecord.documentNumber} (${duplicateInfo.existingRecord.materialNameFa}) ثبت شده است.`
                : `هشدار ماده تکراری: ماده «${duplicateInfo.existingRecord.materialNameFa} / ${duplicateInfo.existingRecord.materialNameEn}» قبلاً با کد ${duplicateInfo.existingRecord.documentNumber} ثبت شده است.`}
            </span>
          </div>
        )}

        {/* Section Stepper Strip */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto bg-slate-50/40 dark:bg-slate-900/60">
          {stepTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeStep === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStep(tab.key)}
                className={`px-3 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 border transition cursor-pointer ${
                  active
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{isFa ? tab.labelFa : tab.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeStep === 'core_ghs' && (
            <>
              {/* Basic Identification Metadata */}
              <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-sky-600" />
                  <span>{isFa ? 'مشخصات پایه شناسنامه ماده شیمیایی' : 'Chemical Core Metadata'}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label className={labelClass}>{isFa ? 'نام فارسی ماده شیمیایی *' : 'Material Name (FA) *'}</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={materialNameFa}
                      onChange={(e) => setMaterialNameFa(e.target.value)}
                      placeholder="مثلاً: متانول / سود سوزآور"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'نام انگلیسی ماده (IUPAC / Standard) *' : 'Material Name (EN) *'}</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={materialNameEn}
                      onChange={(e) => setMaterialNameEn(e.target.value)}
                      placeholder="e.g. Methanol / Sodium Hydroxide"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'نام تجاری (Trade Name)' : 'Trade Name'}</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="مثلاً: Methyl Alcohol / Caustic Soda"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'شماره سند SDS' : 'SDS Document Code'}</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder={isFa ? 'تولید خودکار در صورت خالی بودن' : 'Auto-generated if empty'}
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{isFa ? 'شماره CAS Number' : 'CAS Number'}</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={casNumber}
                      onChange={(e) => setCasNumber(e.target.value)}
                      placeholder="e.g. 67-56-1"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'شماره UN حمل‌ونقل' : 'UN Number'}</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={unNumber}
                      onChange={(e) => setUnNumber(e.target.value)}
                      placeholder="e.g. UN1230"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'حالت فیزیکی ماده' : 'Physical State'}</label>
                    <select
                      disabled={isLockedApproved}
                      value={physicalState}
                      onChange={(e) => setPhysicalState(e.target.value as SdsPhysicalState)}
                      className={inputClass}
                    >
                      {Object.entries(PHYSICAL_STATE_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {isFa ? lbl.fa : lbl.en}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'واحد مصرف‌کننده / سازمانی' : 'Org Unit'}</label>
                    <select
                      disabled={isLockedApproved}
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      className={inputClass}
                    >
                      {orgUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>{isFa ? 'تولیدکننده / سازنده (Manufacturer)' : 'Manufacturer'}</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      placeholder="نام شرکت سازنده یا پتروشیمی مبدا"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'تأمین‌کننده / فروشنده (Supplier)' : 'Supplier'}</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="نام شرکت تأمین‌کننده"
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>{isFa ? 'محل دقیق مصرف یا انبارش در مجتمع' : 'Consumption / Storage Location'}</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={storageLocation}
                      onChange={(e) => setStorageLocation(e.target.value)}
                      placeholder="مثلاً: انبار مرکزی مواد شیمیایی - سایت الف / واحد پلیمریزاسیون"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>{isFa ? 'تاریخ تهیه سند (شمسی/میلادی)' : 'Prepared Date'}</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={preparedDate}
                      onChange={(e) => setPreparedDate(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'تاریخ آخرین بازنگری' : 'Last Revision Date'}</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={lastRevisionDate}
                      onChange={(e) => setLastRevisionDate(e.target.value)}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'شماره ویرایش (Revision)' : 'Revision No.'}</label>
                    <input
                      type="number"
                      min={1}
                      disabled={true}
                      value={revisionNumber}
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'علت / مبنای تدوین یا بازنگری' : 'Revision Basis'}</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={revisionTriggerReason}
                      onChange={(e) => setRevisionTriggerReason(e.target.value)}
                      placeholder="تغییر مقررات / نسخه سازنده / رویه مجتمع"
                      className={inputClass}
                    />
                  </div>
                </div>

                {!editingRecord && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/70">
                    <label className={labelClass}>
                      {isFa
                        ? 'بارگذاری فایل اصلی SDS (اختیاری - PDF سازنده یا مستند استاندارد، تا ۲۵ مگابایت)'
                        : 'Optional Primary SDS PDF Upload'}
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-dashed border-sky-400 hover:border-sky-600 text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>{initialPdfFile ? initialPdfFile.name : isFa ? 'انتخاب فایل PDF از سیستم' : 'Choose PDF'}</span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) setInitialPdfFile(f);
                          }}
                        />
                      </label>
                      {initialPdfFile && (
                        <button
                          type="button"
                          onClick={() => setInitialPdfFile(null)}
                          className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          {isFa ? 'حذف انتخاب' : 'Clear'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* GHS Classification & Official SVG Pictograms */}
              <div className="bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>{isFa ? 'طبقه‌بندی خطرات GHS، علائم لوزی استاندارد و عبارات H / P' : 'GHS Hazard Classification & Pictograms'}</span>
                  </h4>
                </div>

                {/* Pictograms */}
                <div>
                  <label className={labelClass}>
                    {isFa ? 'انتخاب علائم خطر لوزی استاندارد GHS (SVG رسمی)' : 'Standard GHS Pictograms'}
                  </label>
                  <GhsPictogramSelector
                    selected={ghsData.pictograms}
                    onChange={(next) => setGhsData((prev) => ({ ...prev, pictograms: next }))}
                    disabled={isLockedApproved}
                    isFa={isFa}
                  />
                </div>

                {/* Signal Word & Exposure Routes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{isFa ? 'واژه اخطار (Signal Word)' : 'Signal Word'}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['DANGER', 'WARNING', 'NONE'] as SdsSignalWord[]).map((sw) => {
                        const active = ghsData.signalWord === sw;
                        return (
                          <button
                            key={sw}
                            type="button"
                            disabled={isLockedApproved}
                            onClick={() => setGhsData((p) => ({ ...p, signalWord: sw }))}
                            className={`py-2 px-3 rounded-xl border text-xs font-black cursor-pointer transition ${
                              active
                                ? sw === 'DANGER'
                                  ? 'bg-rose-600 text-white border-rose-600'
                                  : sw === 'WARNING'
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-slate-700 text-white border-slate-700'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {sw === 'DANGER' ? 'خطر (Danger)' : sw === 'WARNING' ? 'هشدار (Warning)' : 'بدون اخطار'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{isFa ? 'مسیرهای مواجهه (Exposure Routes)' : 'Exposure Routes'}</label>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_EXPOSURE_ROUTES.map((route) => {
                        const active = ghsData.exposureRoutes.includes(route.fa);
                        return (
                          <button
                            key={route.id}
                            type="button"
                            disabled={isLockedApproved}
                            onClick={() =>
                              setGhsData((p) => ({
                                ...p,
                                exposureRoutes: toggleArrayItem(p.exposureRoutes, route.fa),
                              }))
                            }
                            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition ${
                              active
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {isFa ? route.fa : route.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Hazard Classes */}
                <div className="space-y-2">
                  <label className={labelClass}>{isFa ? 'کلاس‌های خطر (Hazard Classes)' : 'Hazard Classes'}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_HAZARD_CLASSES.map((hc) => {
                      const active = ghsData.hazardClasses.includes(hc);
                      return (
                        <button
                          key={hc}
                          type="button"
                          disabled={isLockedApproved}
                          onClick={() =>
                            setGhsData((p) => ({
                              ...p,
                              hazardClasses: toggleArrayItem(p.hazardClasses, hc),
                            }))
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                            active
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {hc}
                        </button>
                      );
                    })}
                  </div>
                  {!isLockedApproved && (
                    <div className="flex gap-2 mt-1.5">
                      <input
                        type="text"
                        value={customHazardClass}
                        onChange={(e) => setCustomHazardClass(e.target.value)}
                        placeholder={isFa ? 'افزودن کلاس خطر سفارشی...' : 'Add custom hazard class...'}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!customHazardClass.trim()) return;
                          setGhsData((p) => ({
                            ...p,
                            hazardClasses: Array.from(new Set([...p.hazardClasses, customHazardClass.trim()])),
                          }));
                          setCustomHazardClass('');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold shrink-0 cursor-pointer"
                      >
                        افزودن
                      </button>
                    </div>
                  )}
                </div>

                {/* H-Statements & P-Statements */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={labelClass}>{isFa ? 'عبارات خطر (H-Statements)' : 'H-Statements'}</label>
                    <select
                      disabled={isLockedApproved}
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setGhsData((p) => ({
                          ...p,
                          hStatements: Array.from(new Set([...p.hStatements, e.target.value])),
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="">{isFa ? '+ انتخاب سریع عبارت خطر استاندارد (H)...' : '+ Quick select H-Statement...'}</option>
                      {COMMON_H_STATEMENTS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    {!isLockedApproved && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customHInput}
                          onChange={(e) => setCustomHInput(e.target.value)}
                          placeholder="افزودن عبارت H سفارشی (مثلاً H225: مایع بسیار اشتعال‌پذیر)"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customHInput.trim()) return;
                            setGhsData((p) => ({
                              ...p,
                              hStatements: Array.from(new Set([...p.hStatements, customHInput.trim()])),
                            }));
                            setCustomHInput('');
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {ghsData.hStatements.map((h) => (
                        <div
                          key={h}
                          className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-800 dark:text-rose-200"
                        >
                          <span>{h}</span>
                          {!isLockedApproved && (
                            <button
                              type="button"
                              onClick={() =>
                                setGhsData((p) => ({
                                  ...p,
                                  hStatements: p.hStatements.filter((x) => x !== h),
                                }))
                              }
                              className="text-rose-600 hover:text-rose-800 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>{isFa ? 'عبارات احتیاطی (P-Statements)' : 'P-Statements'}</label>
                    <select
                      disabled={isLockedApproved}
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setGhsData((p) => ({
                          ...p,
                          pStatements: Array.from(new Set([...p.pStatements, e.target.value])),
                        }));
                      }}
                      className={inputClass}
                    >
                      <option value="">{isFa ? '+ انتخاب سریع عبارت احتیاطی استاندارد (P)...' : '+ Quick select P-Statement...'}</option>
                      {COMMON_P_STATEMENTS.map((pItem) => (
                        <option key={pItem} value={pItem}>
                          {pItem}
                        </option>
                      ))}
                    </select>
                    {!isLockedApproved && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customPInput}
                          onChange={(e) => setCustomPInput(e.target.value)}
                          placeholder="افزودن عبارت P سفارشی (مثلاً P280: استفاده از دستکش حفاظتی)"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customPInput.trim()) return;
                            setGhsData((p) => ({
                              ...p,
                              pStatements: Array.from(new Set([...p.pStatements, customPInput.trim()])),
                            }));
                            setCustomPInput('');
                          }}
                          className="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {ghsData.pStatements.map((pItem) => (
                        <div
                          key={pItem}
                          className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] font-bold text-sky-800 dark:text-sky-200"
                        >
                          <span>{pItem}</span>
                          {!isLockedApproved && (
                            <button
                              type="button"
                              onClick={() =>
                                setGhsData((p) => ({
                                  ...p,
                                  pStatements: p.pStatements.filter((x) => x !== pItem),
                                }))
                              }
                              className="text-sky-600 hover:text-sky-800 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Health / Physical / Environmental Summaries */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>{isFa ? 'خلاصه خطرات بهداشتی / سلامتی' : 'Health Hazards Summary'}</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={ghsData.healthHazardsSummary || ''}
                      onChange={(e) => setGhsData((p) => ({ ...p, healthHazardsSummary: e.target.value }))}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'خلاصه خطرات فیزیکی (اشتعال/انفجار/واکنش)' : 'Physical Hazards Summary'}</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={ghsData.physicalHazardsSummary || ''}
                      onChange={(e) => setGhsData((p) => ({ ...p, physicalHazardsSummary: e.target.value }))}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{isFa ? 'خلاصه خطرات زیست‌محیطی' : 'Environmental Hazards Summary'}</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={ghsData.environmentalHazardsSummary || ''}
                      onChange={(e) => setGhsData((p) => ({ ...p, environmentalHazardsSummary: e.target.value }))}
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeStep === 'sec_1_4' && (
            <div className="space-y-4">
              {/* Section 1 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱: شناسایی ماده / فرآورده و اطلاعات شرکت و تلفن‌های اضطراری
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>شناسه محصول (Product Identifier)</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section1.productIdentifier || ''}
                      onChange={(e) => updateSection('section1', { productIdentifier: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>نام‌های مترادف (Synonyms)</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section1.synonyms || ''}
                      onChange={(e) => updateSection('section1', { synonyms: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>کاربردهای توصیه‌شده (Recommended Use)</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section1.recommendedUse || ''}
                      onChange={(e) => updateSection('section1', { recommendedUse: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>محدودیت‌های مصرف (Restrictions on Use)</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section1.restrictionsOnUse || ''}
                      onChange={(e) => updateSection('section1', { restrictionsOnUse: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>تلفن اضطراری سازنده / مرکز مسمومیت</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section1.emergencyPhone || ''}
                      onChange={(e) => updateSection('section1', { emergencyPhone: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>شماره تماس اضطراری مجتمع پتروشیمی رجال</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section1.complexEmergencyPhone || ''}
                      onChange={(e) => updateSection('section1', { complexEmergencyPhone: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۲: شناسایی خطرات (جزئیات تکمیلی علائم و هشدارهای GHS)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>طبقه‌بندی تکمیلی GHS</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section2.ghsClassificationText || ''}
                      onChange={(e) => updateSection('section2', { ghsClassificationText: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>الزامات برچسب‌گذاری ظروف و تانک‌ها</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section2.labelElementsNotes || ''}
                      onChange={(e) => updateSection('section2', { labelElementsNotes: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>سایر خطرات طبقه‌بندی‌نشده (HNOC)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section2.otherHazards || ''}
                      onChange={(e) => updateSection('section2', { otherHazards: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                    بخش ۳: ترکیب شیمیایی و اطلاعات اجزاء سازنده
                  </h4>
                  {!isLockedApproved && (
                    <button
                      type="button"
                      onClick={addIngredientRow}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن جزء شیمیایی</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>ماهیت ماده</label>
                    <select
                      disabled={isLockedApproved}
                      value={sections.section3.substanceOrMixture}
                      onChange={(e) =>
                        updateSection('section3', { substanceOrMixture: e.target.value as any })
                      }
                      className={inputClass}
                    >
                      <option value="SUBSTANCE">ماده خالص (Substance)</option>
                      <option value="MIXTURE">مخلوط / فرآورده ترکیبی (Mixture)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>فرمول شیمیایی</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={sections.section3.chemicalFormula || ''}
                      onChange={(e) => updateSection('section3', { chemicalFormula: e.target.value })}
                      placeholder="e.g. CH3OH"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>جرم مولکولی (g/mol)</label>
                    <input
                      type="text"
                      dir="ltr"
                      disabled={isLockedApproved}
                      value={sections.section3.molecularWeight || ''}
                      onChange={(e) => updateSection('section3', { molecularWeight: e.target.value })}
                      placeholder="e.g. 32.04"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </div>

                {(sections.section3.ingredients || []).length > 0 && (
                  <div className="space-y-2">
                    {sections.section3.ingredients.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <input
                          type="text"
                          disabled={isLockedApproved}
                          value={row.ingredientName}
                          onChange={(e) => updateIngredientRow(idx, { ingredientName: e.target.value })}
                          placeholder="نام جزء / ماده"
                          className={`${inputClass} sm:col-span-4`}
                        />
                        <input
                          type="text"
                          dir="ltr"
                          disabled={isLockedApproved}
                          value={row.casNumber || ''}
                          onChange={(e) => updateIngredientRow(idx, { casNumber: e.target.value })}
                          placeholder="CAS"
                          className={`${inputClass} sm:col-span-2 font-mono`}
                        />
                        <input
                          type="text"
                          dir="ltr"
                          disabled={isLockedApproved}
                          value={row.concentration || ''}
                          onChange={(e) => updateIngredientRow(idx, { concentration: e.target.value })}
                          placeholder="درصد (%w/w)"
                          className={`${inputClass} sm:col-span-2 font-mono`}
                        />
                        <input
                          type="text"
                          disabled={isLockedApproved}
                          value={row.classification || ''}
                          onChange={(e) => updateIngredientRow(idx, { classification: e.target.value })}
                          placeholder="طبقه‌بندی خطر جزء"
                          className={`${inputClass} sm:col-span-3`}
                        />
                        {!isLockedApproved && (
                          <button
                            type="button"
                            onClick={() => removeIngredientRow(idx)}
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 sm:col-span-1 flex justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 4 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۴: اقدامات کمک‌های اولیه
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>در صورت استنشاق (Inhalation)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section4.inhalation || ''}
                      onChange={(e) => updateSection('section4', { inhalation: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>در صورت تماس با پوست (Skin Contact)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section4.skinContact || ''}
                      onChange={(e) => updateSection('section4', { skinContact: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>در صورت تماس با چشم (Eye Contact)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section4.eyeContact || ''}
                      onChange={(e) => updateSection('section4', { eyeContact: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>در صورت بلع / خوردن (Ingestion)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section4.ingestion || ''}
                      onChange={(e) => updateSection('section4', { ingestion: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>علائم و اثرات حاد و تأخیری</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section4.acuteAndDelayedSymptoms || ''}
                      onChange={(e) => updateSection('section4', { acuteAndDelayedSymptoms: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>توصیه به پزشک و پادزهر / مراقبت ویژه</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section4.medicalAttentionAndSpecialTreatment || ''}
                      onChange={(e) =>
                        updateSection('section4', { medicalAttentionAndSpecialTreatment: e.target.value })
                      }
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'sec_5_8' && (
            <div className="space-y-4">
              {/* Section 5 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۵: اقدامات اطفای حریق (Fire-Fighting Measures)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>عوامل اطفاکننده مناسب (فوم، CO2، پودر خشک، آب اسپری...)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section5.suitableExtinguishingMedia || ''}
                      onChange={(e) => updateSection('section5', { suitableExtinguishingMedia: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>عوامل اطفاکننده نامناسب / ممنوعه</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section5.unsuitableExtinguishingMedia || ''}
                      onChange={(e) => updateSection('section5', { unsuitableExtinguishingMedia: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>خطرات ویژه ناشی از احتراق ماده (گازهای سمی، انفجار بخار...)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section5.specificHazardsFromChemical || ''}
                      onChange={(e) => updateSection('section5', { specificHazardsFromChemical: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>تجهیزات حفاظت فردی و دستورالعمل تیم آتش‌نشانی</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section5.firefighterProtectiveEquipment || ''}
                      onChange={(e) => updateSection('section5', { firefighterProtectiveEquipment: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>

              {/* Section 6 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۶: اقدامات در زمان رهاسازی اتفاقی و نشت (Accidental Release Measures)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>احتیاطات فردی، تجهیزات حفاظتی و تخلیه اضطراری</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section6.personalPrecautions || ''}
                      onChange={(e) => updateSection('section6', { personalPrecautions: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>احتیاطات زیست‌محیطی (جلوگیری از ورود به فاضلاب و آب)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section6.environmentalPrecautions || ''}
                      onChange={(e) => updateSection('section6', { environmentalPrecautions: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>روش‌های مهار، خنثی‌سازی و پاکسازی نشت</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section6.containmentAndCleanupMethods || ''}
                      onChange={(e) => updateSection('section6', { containmentAndCleanupMethods: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>

              {/* Section 7 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۷: حمل‌ونقل، جابجایی و انبارش ایمن (Handling & Storage)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>اصول جابجایی و کاربری ایمن (اتصال زمین، تهویه، عدم جرقه)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section7.safeHandlingPrecautions || ''}
                      onChange={(e) => updateSection('section7', { safeHandlingPrecautions: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>شرایط انبارش ایمن (دما، رطوبت، تهویه، دایک حبس نشت)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section7.safeStorageConditions || ''}
                      onChange={(e) => updateSection('section7', { safeStorageConditions: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>مواد ناسازگار جهت هم‌جواری در انبار (Incompatibilities)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section7.incompatibleStorageMaterials || ''}
                      onChange={(e) => updateSection('section7', { incompatibleStorageMaterials: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                </div>
              </div>

              {/* Section 8 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۸: کنترل‌های مواجهه شغلی و تجهیزات حفاظت فردی (PPE)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>حدود مجاز مواجهه شغلی (TLV-TWA / STEL / PEL / OEL ایران)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section8.occupationalExposureLimits || ''}
                      onChange={(e) => updateSection('section8', { occupationalExposureLimits: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>کنترل‌های مهندسی (تهویه موضعی، سیستم بسته، دوش اضطراری)</label>
                    <textarea
                      disabled={isLockedApproved}
                      value={sections.section8.engineeringControls || ''}
                      onChange={(e) => updateSection('section8', { engineeringControls: e.target.value })}
                      className={textareaClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>حفاظت چشم و صورت</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section8.eyeFaceProtection || ''}
                      onChange={(e) => updateSection('section8', { eyeFaceProtection: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>حفاظت دست و پوست (جنس دستکش و لباس مقاوم شیمیایی)</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section8.handSkinProtection || ''}
                      onChange={(e) => updateSection('section8', { handSkinProtection: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>حفاظت تنفسی (کارتریج فیلتر / SCBA)</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section8.respiratoryProtection || ''}
                      onChange={(e) => updateSection('section8', { respiratoryProtection: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ملاحظات بهداشت صنعتی و خطرات حرارتی</label>
                    <input
                      type="text"
                      disabled={isLockedApproved}
                      value={sections.section8.thermalHazardsAndHygiene || ''}
                      onChange={(e) => updateSection('section8', { thermalHazardsAndHygiene: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'sec_9_12' && (
            <div className="space-y-4">
              {/* Section 9 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۹: خواص فیزیکی و شیمیایی (Physical & Chemical Properties)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>شکل ظاهری و رنگ</label>
                    <input type="text" disabled={isLockedApproved} value={sections.section9.appearanceAndColor || ''} onChange={(e) => updateSection('section9', { appearanceAndColor: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>بو و آستانه بو</label>
                    <input type="text" disabled={isLockedApproved} value={sections.section9.odor || ''} onChange={(e) => updateSection('section9', { odor: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>pH</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.ph || ''} onChange={(e) => updateSection('section9', { ph: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>چگالی نسبی (Specific Gravity)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.relativeDensity || ''} onChange={(e) => updateSection('section9', { relativeDensity: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>نقطه ذوب / انجماد</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.meltingFreezingPoint || ''} onChange={(e) => updateSection('section9', { meltingFreezingPoint: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>نقطه جوش اولیه</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.initialBoilingPoint || ''} onChange={(e) => updateSection('section9', { initialBoilingPoint: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>نقطه اشتعال (Flash Point)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.flashPoint || ''} onChange={(e) => updateSection('section9', { flashPoint: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>حدود اشتعال‌پذیری (LEL / UEL)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.flammabilityUpperLower || ''} onChange={(e) => updateSection('section9', { flammabilityUpperLower: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>دمای خوداشتعالی (Auto-Ignition)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.autoIgnitionTemp || ''} onChange={(e) => updateSection('section9', { autoIgnitionTemp: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>فشار بخار (Vapor Pressure)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.vaporPressure || ''} onChange={(e) => updateSection('section9', { vaporPressure: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>چگالی بخار نسبت به هوا</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section9.vaporDensity || ''} onChange={(e) => updateSection('section9', { vaporDensity: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>حلالیت در آب و حلال‌ها</label>
                    <input type="text" disabled={isLockedApproved} value={sections.section9.waterSolubility || ''} onChange={(e) => updateSection('section9', { waterSolubility: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Section 10 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱۰: پایداری و واکنش‌پذیری (Stability & Reactivity)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>پایداری شیمیایی و واکنش‌پذیری</label>
                    <textarea disabled={isLockedApproved} value={sections.section10.chemicalStability || ''} onChange={(e) => updateSection('section10', { chemicalStability: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>واکنش‌های خطرناک احتمالی (پلیمریزاسیون، انفجار...)</label>
                    <textarea disabled={isLockedApproved} value={sections.section10.hazardousReactions || ''} onChange={(e) => updateSection('section10', { hazardousReactions: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>شرایطی که باید اجتناب شود (گرما، جرقه، رطوبت، نور)</label>
                    <textarea disabled={isLockedApproved} value={sections.section10.conditionsToAvoid || ''} onChange={(e) => updateSection('section10', { conditionsToAvoid: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>مواد ناسازگار و محصولات تجزیه خطرناک</label>
                    <textarea disabled={isLockedApproved} value={sections.section10.incompatibleMaterials || ''} onChange={(e) => updateSection('section10', { incompatibleMaterials: e.target.value })} className={textareaClass} />
                  </div>
                </div>
              </div>

              {/* Section 11 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱۱: اطلاعات سم‌شناسی (Toxicological Information)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>سمیت حاد (LD50 / LC50)</label>
                    <textarea disabled={isLockedApproved} value={sections.section11.acuteToxicity || ''} onChange={(e) => updateSection('section11', { acuteToxicity: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>خورندگی / تحریک‌پذیری پوست و چشم</label>
                    <textarea disabled={isLockedApproved} value={sections.section11.skinCorrosionIrritation || ''} onChange={(e) => updateSection('section11', { skinCorrosionIrritation: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>سرطان‌زایی / جهش‌زایی / سمیت تولیدمثلی / اندام هدف</label>
                    <textarea disabled={isLockedApproved} value={sections.section11.carcinogenicity || ''} onChange={(e) => updateSection('section11', { carcinogenicity: e.target.value })} className={textareaClass} />
                  </div>
                </div>
              </div>

              {/* Section 12 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱۲: اطلاعات زیست‌محیطی (Ecological Information)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>سمیت بوم‌شناختی (Ecotoxicity)</label>
                    <textarea disabled={isLockedApproved} value={sections.section12.ecotoxicity || ''} onChange={(e) => updateSection('section12', { ecotoxicity: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>پایداری و تجزیه‌پذیری زیستی</label>
                    <textarea disabled={isLockedApproved} value={sections.section12.persistenceAndDegradability || ''} onChange={(e) => updateSection('section12', { persistenceAndDegradability: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>تجمع زیستی و تحرک در خاک / آب‌های زیرزمینی</label>
                    <textarea disabled={isLockedApproved} value={sections.section12.bioaccumulativePotential || ''} onChange={(e) => updateSection('section12', { bioaccumulativePotential: e.target.value })} className={textareaClass} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStep === 'sec_13_16' && (
            <div className="space-y-4">
              {/* Section 13 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱۳: ملاحظات دفع پسماند و ضایعات شیمیایی (Disposal Considerations)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>روش‌های امحا و تصفیه پسماند ماده</label>
                    <textarea disabled={isLockedApproved} value={sections.section13.wasteTreatmentMethods || ''} onChange={(e) => updateSection('section13', { wasteTreatmentMethods: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>دفع ظروف و بسته‌بندی‌های آلوده</label>
                    <textarea disabled={isLockedApproved} value={sections.section13.contaminatedPackagingDisposal || ''} onChange={(e) => updateSection('section13', { contaminatedPackagingDisposal: e.target.value })} className={textareaClass} />
                  </div>
                </div>
              </div>

              {/* Section 14 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱۴: اطلاعات حمل‌ونقل (Transport Information)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>شماره UN</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section14.unNumber || unNumber} onChange={(e) => updateSection('section14', { unNumber: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>نام رسمی حمل‌ونقل (Proper Shipping Name)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section14.properShippingName || ''} onChange={(e) => updateSection('section14', { properShippingName: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>کلاس خطر حمل‌ونقل (Hazard Class)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section14.transportHazardClass || ''} onChange={(e) => updateSection('section14', { transportHazardClass: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div>
                    <label className={labelClass}>گروه بسته‌بندی (Packing Group)</label>
                    <input type="text" dir="ltr" disabled={isLockedApproved} value={sections.section14.packingGroup || ''} onChange={(e) => updateSection('section14', { packingGroup: e.target.value })} className={`${inputClass} font-mono`} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>آلاینده دریایی (Marine Pollutant)</label>
                    <input type="text" disabled={isLockedApproved} value={sections.section14.environmentalHazardsMarinePollutant || ''} onChange={(e) => updateSection('section14', { environmentalHazardsMarinePollutant: e.target.value })} className={inputClass} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>ملاحظات ADR / RID / IMDG / IATA</label>
                    <input type="text" disabled={isLockedApproved} value={sections.section14.adrRidImdgIataNotes || ''} onChange={(e) => updateSection('section14', { adrRidImdgIataNotes: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Section 15 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱۵: اطلاعات قانونی و مقرراتی (Regulatory Information)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>قوانین ایمنی، بهداشت و محیط زیست ملی و بین‌المللی</label>
                    <textarea disabled={isLockedApproved} value={sections.section15.safetyHealthEnvironmentalRegulations || ''} onChange={(e) => updateSection('section15', { safetyHealthEnvironmentalRegulations: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>استانداردها و رویه‌های اختصاصی پتروشیمی رجال / REACH / OSHA</label>
                    <textarea disabled={isLockedApproved} value={sections.section15.iranAndPetrochemicalStandards || ''} onChange={(e) => updateSection('section15', { iranAndPetrochemicalStandards: e.target.value })} className={textareaClass} />
                  </div>
                </div>
              </div>

              {/* Section 16 */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black text-sky-700 dark:text-sky-400">
                  بخش ۱۶: سایر اطلاعات، مراجع علمی و ملاحظات بازنگری
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>مراجع و منابع تدوین (NFPA، NIOSH، ECHA، سازنده...)</label>
                    <textarea disabled={isLockedApproved} value={sections.section16.keyLiteratureReferences || ''} onChange={(e) => updateSection('section16', { keyLiteratureReferences: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>توصیه‌های آموزشی ویژه پرسنل و پیمانکاران</label>
                    <textarea disabled={isLockedApproved} value={sections.section16.trainingAdvice || ''} onChange={(e) => updateSection('section16', { trainingAdvice: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>اختصارات و یادداشت‌های بازنگری</label>
                    <textarea disabled={isLockedApproved} value={sections.section16.abbreviationsAndAcronyms || ''} onChange={(e) => updateSection('section16', { abbreviationsAndAcronyms: e.target.value })} className={textareaClass} />
                  </div>
                  <div>
                    <label className={labelClass}>سلب مسئولیت و کنترل مستند</label>
                    <textarea disabled={isLockedApproved} value={sections.section16.disclaimer || ''} onChange={(e) => updateSection('section16', { disclaimer: e.target.value })} className={textareaClass} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {isFa
              ? 'توجه: تاریخ بازنگری به معنای تاریخ انقضای خودکار نیست؛ بازنگری بر اساس تغییر مقررات، نسخه جدید سازنده یا رویه مصوب انجام می‌شود.'
              : 'Note: Revision date is not automatic expiration.'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>

            {!isLockedApproved && (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(false)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {submitting
                      ? isFa ? 'در حال ذخیره...' : 'Saving...'
                      : editingRecord
                      ? isFa ? 'ذخیره تغییرات' : 'Save Changes'
                      : isFa ? 'ثبت پیش‌نویس SDS' : 'Save Draft SDS'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isFa ? 'ذخیره و ارسال برای تأیید' : 'Save & Submit Review'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
