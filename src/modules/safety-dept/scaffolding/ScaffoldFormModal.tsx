import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Link2,
  Camera,
  Trash2,
  Building2,
  FileCheck2,
  Wrench,
  AlertCircle,
  Loader2,
  Layers,
} from 'lucide-react';
import CentralPersonnelSelector from '../../../components/CentralPersonnelSelector';
import {
  SCAFFOLD_TYPES,
  ScaffoldBootstrapData,
  ScaffoldPhotoItem,
  ScaffoldRecord,
} from './types';
import { scaffoldingApi } from './scaffoldingApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bootstrap: ScaffoldBootstrapData;
  initialRecord?: ScaffoldRecord | null;
  onSaved: (saved: ScaffoldRecord) => void;
}

const MAX_FILE_SIZE_BYTES = 2.5 * 1024 * 1024;

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('فقط فایل‌های تصویری (JPG, PNG, WEBP) مجاز هستند.'));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reject(new Error('حداکثر حجم مجاز هر تصویر ۲.۵ مگابایت است.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر'));
    reader.readAsDataURL(file);
  });
}

export default function ScaffoldFormModal({
  isOpen,
  onClose,
  bootstrap,
  initialRecord,
  onSaved,
}: Props) {
  const isEdit = Boolean(initialRecord);

  const [requestDate, setRequestDate] = useState(bootstrap.todayJalali || '');
  const [requestingUnit, setRequestingUnit] = useState('');
  const [orgUnitId, setOrgUnitId] = useState<number | null>(null);
  const [installationLocation, setInstallationLocation] = useState('');
  const [areaName, setAreaName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [activityDescription, setActivityDescription] = useState('');

  const [permitId, setPermitId] = useState<number | null>(null);
  const [permitNumber, setPermitNumber] = useState('');
  const [workRequestId, setWorkRequestId] = useState<number | null>(null);
  const [workRequestNumber, setWorkRequestNumber] = useState('');

  const [contractorName, setContractorName] = useState('');
  const [erectorSupervisorName, setErectorSupervisorName] = useState('');
  const [inspectorPersonnelId, setInspectorPersonnelId] = useState<number | null>(null);
  const [inspectorPersonnelCode, setInspectorPersonnelCode] = useState('');
  const [inspectorName, setInspectorName] = useState('');

  const [installationCompletedDate, setInstallationCompletedDate] = useState('');
  const [heightMeters, setHeightMeters] = useState('4');
  const [scaffoldType, setScaffoldType] = useState<string>(SCAFFOLD_TYPES[0].value);
  const [notes, setNotes] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<ScaffoldPhotoItem[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<ScaffoldPhotoItem[]>([]);

  const [autoFillNotice, setAutoFillNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setAutoFillNotice(null);

    if (initialRecord) {
      setRequestDate(initialRecord.requestDate || bootstrap.todayJalali || '');
      setRequestingUnit(initialRecord.requestingUnit || '');
      setOrgUnitId(initialRecord.orgUnitId ?? null);
      setInstallationLocation(initialRecord.installationLocation || '');
      setAreaName(initialRecord.areaName || '');
      setUnitName(initialRecord.unitName || '');
      setEquipmentName(initialRecord.equipmentName || '');
      setActivityDescription(initialRecord.activityDescription || '');
      setPermitId(initialRecord.permitId ?? null);
      setPermitNumber(initialRecord.permitNumber || '');
      setWorkRequestId(initialRecord.workRequestId ?? null);
      setWorkRequestNumber(initialRecord.workRequestNumber || '');
      setContractorName(initialRecord.contractorName || '');
      setErectorSupervisorName(initialRecord.erectorSupervisorName || '');
      setInspectorPersonnelId(initialRecord.inspectorPersonnelId ?? null);
      setInspectorPersonnelCode(initialRecord.inspectorPersonnelCode || '');
      setInspectorName(initialRecord.inspectorName || '');
      setInstallationCompletedDate(initialRecord.installationCompletedDate || '');
      setHeightMeters(String(initialRecord.heightMeters ?? '4'));
      setScaffoldType(initialRecord.scaffoldType || SCAFFOLD_TYPES[0].value);
      setNotes(initialRecord.notes || '');
      setBeforePhotos(Array.isArray(initialRecord.beforePhotos) ? initialRecord.beforePhotos : []);
      setAfterPhotos(Array.isArray(initialRecord.afterPhotos) ? initialRecord.afterPhotos : []);
    } else {
      setRequestDate(bootstrap.todayJalali || '');
      setRequestingUnit('');
      setOrgUnitId(null);
      setInstallationLocation('');
      setAreaName('');
      setUnitName('');
      setEquipmentName('');
      setActivityDescription('');
      setPermitId(null);
      setPermitNumber('');
      setWorkRequestId(null);
      setWorkRequestNumber('');
      setContractorName('');
      setErectorSupervisorName('');
      setInspectorPersonnelId(null);
      setInspectorPersonnelCode('');
      setInspectorName('');
      setInstallationCompletedDate('');
      setHeightMeters('4');
      setScaffoldType(SCAFFOLD_TYPES[0].value);
      setNotes('');
      setBeforePhotos([]);
      setAfterPhotos([]);
    }
  }, [isOpen, initialRecord, bootstrap.todayJalali]);

  if (!isOpen) return null;

  const handleSelectPermit = (selectedIdStr: string) => {
    if (!selectedIdStr) {
      setPermitId(null);
      setPermitNumber('');
      return;
    }
    const idNum = Number(selectedIdStr);
    const ptw = bootstrap.permits.find(p => p.id === idNum);
    if (!ptw) return;

    setPermitId(ptw.id);
    setPermitNumber(ptw.permitNumber);

    const filledFields: string[] = [];
    if (ptw.unitName) {
      setRequestingUnit(ptw.unitName);
      setUnitName(ptw.unitName);
      if (ptw.unitId) setOrgUnitId(ptw.unitId);
      filledFields.push('واحد');
    }
    if (ptw.location) {
      setInstallationLocation(ptw.location);
      filledFields.push('محل نصب');
    }
    if (ptw.areaName) {
      setAreaName(ptw.areaName);
      filledFields.push('ناحیه');
    }
    if (ptw.equipmentName) {
      setEquipmentName(ptw.equipmentName);
      filledFields.push('تجهیز');
    }
    if (ptw.contractorName) {
      setContractorName(ptw.contractorName);
      filledFields.push('پیمانکار');
    }
    if (ptw.description) {
      setActivityDescription(ptw.description);
      filledFields.push('شرح فعالیت');
    }
    if (ptw.workOrderNumber && !workRequestNumber) {
      setWorkRequestNumber(ptw.workOrderNumber);
      filledFields.push('شماره درخواست کار');
    }

    if (filledFields.length > 0) {
      setAutoFillNotice(`اطلاعات مرتبط از پروانه کار ${ptw.permitNumber} (${filledFields.join('، ')}) به‌صورت خودکار فراخوانی شد.`);
    }
  };

  const handleSelectWorkRequest = (selectedIdStr: string) => {
    if (!selectedIdStr) {
      setWorkRequestId(null);
      setWorkRequestNumber('');
      return;
    }
    const idNum = Number(selectedIdStr);
    const wr = bootstrap.workRequests.find(w => w.id === idNum);
    if (!wr) return;

    setWorkRequestId(wr.id);
    setWorkRequestNumber(wr.workRequestNumber);

    const filledFields: string[] = [];
    if (wr.unitName && !requestingUnit) {
      setRequestingUnit(wr.unitName);
      setUnitName(wr.unitName);
      filledFields.push('واحد');
    }
    if (wr.location && !installationLocation) {
      setInstallationLocation(wr.location);
      filledFields.push('محل نصب');
    }
    if (wr.equipmentName && !equipmentName) {
      setEquipmentName(wr.equipmentName);
      filledFields.push('تجهیز');
    }
    if (wr.contractorName && !contractorName) {
      setContractorName(wr.contractorName);
      filledFields.push('پیمانکار');
    }
    if (wr.description && !activityDescription) {
      setActivityDescription(wr.description);
      filledFields.push('شرح فعالیت');
    }

    if (filledFields.length > 0) {
      setAutoFillNotice(`اطلاعات مرتبط از درخواست کار ${wr.workRequestNumber} (${filledFields.join('، ')}) به‌صورت خودکار فراخوانی شد.`);
    }
  };

  const handleSelectOrgUnit = (unitTitle: string) => {
    setRequestingUnit(unitTitle);
    const found = bootstrap.orgUnits.find(u => u.name === unitTitle);
    setOrgUnitId(found?.id ?? null);
    if (!unitName) setUnitName(unitTitle);
    if (found?.area && !areaName) setAreaName(found.area);
  };

  const handlePhotoUpload = async (
    files: FileList | null,
    stage: 'BEFORE' | 'AFTER'
  ) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    const list = stage === 'BEFORE' ? beforePhotos : afterPhotos;
    const setter = stage === 'BEFORE' ? setBeforePhotos : setAfterPhotos;

    const added: ScaffoldPhotoItem[] = [];
    for (const file of Array.from(files).slice(0, Math.max(0, 8 - list.length))) {
      try {
        const dataUrl = await readImageAsDataUrl(file);
        added.push({
          id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: dataUrl,
          fileName: file.name,
          stage,
          uploadedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        setErrorMsg(err?.message || 'خطا در بارگذاری تصویر');
      }
    }
    if (added.length > 0) {
      setter([...list, ...added]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!requestingUnit.trim()) return setErrorMsg('انتخاب واحد درخواست‌کننده الزامی است.');
    if (!installationLocation.trim()) return setErrorMsg('ورود محل نصب داربست الزامی است.');
    if (!activityDescription.trim()) return setErrorMsg('ورود شرح فعالیت و علت نصب داربست الزامی است.');
    if (!contractorName.trim()) return setErrorMsg('ورود نام پیمانکار الزامی است.');
    if (!erectorSupervisorName.trim()) return setErrorMsg('ورود نام مسئول نصب داربست الزامی است.');
    if (!inspectorName.trim()) return setErrorMsg('انتخاب نام بازرس HSE از بانک اطلاعات پرسنلی الزامی است.');

    const heightNum = Number(heightMeters);
    if (!Number.isFinite(heightNum) || heightNum <= 0) {
      return setErrorMsg('ارتفاع داربست باید عددی بزرگ‌تر از صفر باشد.');
    }

    setSubmitting(true);
    try {
      const payload = {
        requestDate,
        requestingUnit,
        orgUnitId,
        installationLocation,
        areaName,
        unitName: unitName || requestingUnit,
        equipmentName,
        activityDescription,
        permitId,
        permitNumber: permitNumber || null,
        workRequestId,
        workRequestNumber: workRequestNumber || null,
        contractorName,
        erectorSupervisorName,
        inspectorPersonnelId,
        inspectorPersonnelCode: inspectorPersonnelCode || null,
        inspectorName,
        installationCompletedDate: installationCompletedDate || null,
        heightMeters: heightNum,
        scaffoldType,
        notes,
        beforePhotos,
        afterPhotos,
      };

      const saved = isEdit && initialRecord
        ? await scaffoldingApi.update(initialRecord.id, payload)
        : await scaffoldingApi.create(payload);

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در ذخیره‌سازی اطلاعات داربست');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4" dir="rtl">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {isEdit ? `ویرایش مشخصات داربست (${initialRecord?.scaffoldCode})` : 'ثبت داربست جدید در سامانه'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                شماره شناسایی یکتا:{' '}
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {isEdit ? initialRecord?.scaffoldCode : bootstrap.nextScaffoldCode}
                </span>
                {' '}— ذخیره مستقیم در پایگاه داده مرکزی
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {autoFillNotice && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <FileCheck2 className="w-4 h-4 shrink-0" />
              <span>{autoFillNotice}</span>
            </div>
          )}

          {/* Section 1: PTW & Work Request Direct DB Integration */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-blue-800 dark:text-blue-300">
              <Link2 className="w-4 h-4" />
              <span>اتصال مستقیم به پروانه کار (PTW) و سیستم درخواست کار</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  شماره پروانه کار (اتصال به ماژول PTW)
                </label>
                <select
                  value={permitId ?? ''}
                  onChange={e => handleSelectPermit(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- انتخاب پروانه کار از پایگاه داده PTW (اختیاری) --</option>
                  {bootstrap.permits.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.permitNumber} — {p.title || p.location || p.permitType} ({p.status})
                    </option>
                  ))}
                </select>
                {!permitId && (
                  <input
                    type="text"
                    value={permitNumber}
                    onChange={e => setPermitNumber(e.target.value)}
                    placeholder="یا درج دستی شماره PTW در صورت نبود در لیست..."
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  شماره درخواست کار (اتصال به سیستم درخواست کار)
                </label>
                <select
                  value={workRequestId ?? ''}
                  onChange={e => handleSelectWorkRequest(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- انتخاب درخواست کار ثبت‌شده (اختیاری) --</option>
                  {bootstrap.workRequests.map(wr => (
                    <option key={wr.id} value={wr.id}>
                      {wr.workRequestNumber} — {wr.title} ({wr.status})
                    </option>
                  ))}
                </select>
                {!workRequestId && (
                  <input
                    type="text"
                    value={workRequestNumber}
                    onChange={e => setWorkRequestNumber(e.target.value)}
                    placeholder="یا درج دستی شماره درخواست کار / Work Order..."
                    className="mt-2 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Identity, Org Unit & Location */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>مشخصات مکانی و سازمانی داربست</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  شماره شناسایی یکتا (تولید خودکار)
                </label>
                <input
                  type="text"
                  readOnly
                  value={isEdit ? initialRecord?.scaffoldCode || '' : bootstrap.nextScaffoldCode}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-xs font-mono font-black text-blue-700 dark:text-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاریخ درخواست نصب <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={requestDate}
                  onChange={e => setRequestDate(e.target.value)}
                  placeholder="1405/09/03"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  واحد درخواست‌کننده (ساختار سازمانی) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={requestingUnit}
                  onChange={e => handleSelectOrgUnit(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- انتخاب واحد از ساختار سازمانی --</option>
                  {bootstrap.orgUnits.map(u => (
                    <option key={`${u.id ?? 's'}-${u.name}`} value={u.name}>
                      {u.name}{u.code ? ` (${u.code})` : ''}
                    </option>
                  ))}
                  {requestingUnit && !bootstrap.orgUnits.some(u => u.name === requestingUnit) && (
                    <option value={requestingUnit}>{requestingUnit}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  محل نصب داربست <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={installationLocation}
                  onChange={e => setInstallationLocation(e.target.value)}
                  placeholder="مثال: مجاور برج تقطیر C-101، طبقه دوم"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ناحیه (Area)
                </label>
                <input
                  type="text"
                  value={areaName}
                  onChange={e => setAreaName(e.target.value)}
                  placeholder="مثال: ناحیه فرآیندی شمال / یوتیلیتی"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  واحد عملیاتی / تجهیز مربوطه
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={unitName}
                    onChange={e => setUnitName(e.target.value)}
                    placeholder="واحد (Unit)"
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none"
                  />
                  <input
                    type="text"
                    value={equipmentName}
                    onChange={e => setEquipmentName(e.target.value)}
                    placeholder="تجهیز (Tag)"
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                شرح فعالیت و علت نصب داربست <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={activityDescription}
                onChange={e => setActivityDescription(e.target.value)}
                placeholder="شرح دقیق عملیات اجرایی (تعمیر شیرآلات، عایق‌کاری، رنگ‌آمیزی، بازرسی فنی و...)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Section 3: Technical Specs, Contractor & HSE Inspector */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              <span>مشخصات فنی داربست، پیمانکار و بازرس HSE</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام پیمانکار <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="scaffold-contractors-datalist"
                  value={contractorName}
                  onChange={e => setContractorName(e.target.value)}
                  placeholder="نام شرکت پیمانکاری مجری"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <datalist id="scaffold-contractors-datalist">
                  {bootstrap.contractors.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام مسئول نصب داربست <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={erectorSupervisorName}
                  onChange={e => setErectorSupervisorName(e.target.value)}
                  placeholder="نام و نام خانوادگی سرپرست داربست‌بندی"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  تاریخ تکمیل نصب (اختیاری در مرحله درخواست)
                </label>
                <input
                  type="text"
                  value={installationCompletedDate}
                  onChange={e => setInstallationCompletedDate(e.target.value)}
                  placeholder="مثال: 1405/09/04"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ارتفاع داربست (متر) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.1"
                  min="0.5"
                  max="200"
                  value={heightMeters}
                  onChange={e => setHeightMeters(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع داربست <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={scaffoldType}
                  onChange={e => setScaffoldType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {SCAFFOLD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.labelFa}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* HSE Inspector from Central Personnel Bank */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <CentralPersonnelSelector
                isFa
                required
                compact
                label="نام بازرس HSE (انتخاب از بانک اطلاعات پرسنلی)"
                selectedPersonnelCode={inspectorPersonnelCode}
                placeholder="جستجوی نام یا کد پرسنلی بازرس HSE..."
                onSelectPersonnel={person => {
                  if (person) {
                    const matched = bootstrap.personnelList.find(
                      p => p.personnelCode === person.personnelCode || p.fullName === person.fullName
                    );
                    setInspectorPersonnelId(matched?.id ?? null);
                    setInspectorPersonnelCode(person.personnelCode || '');
                    setInspectorName(person.fullName || '');
                  } else {
                    setInspectorPersonnelId(null);
                    setInspectorPersonnelCode('');
                    setInspectorName('');
                  }
                }}
              />
              {inspectorName && (
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  بازرس انتخاب‌شده: {inspectorName} {inspectorPersonnelCode ? `(کد پرسنلی: ${inspectorPersonnelCode})` : ''}
                </div>
              )}
              {!inspectorName && bootstrap.personnelList.length > 0 && (
                <div className="pt-1">
                  <select
                    value={inspectorPersonnelId ?? ''}
                    onChange={e => {
                      const p = bootstrap.personnelList.find(x => x.id === Number(e.target.value));
                      if (p) {
                        setInspectorPersonnelId(p.id);
                        setInspectorPersonnelCode(p.personnelCode);
                        setInspectorName(p.fullName);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <option value="">یا انتخاب سریع بازرس HSE از لیست پرسنل پایگاه داده...</option>
                    {bootstrap.personnelList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} — {p.personnelCode} {p.jobTitle ? `(${p.jobTitle})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توضیحات تکمیلی
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ملاحظات مهندسی، شرایط محیطی خاص، الزامات حفاظتی مجاور و..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Section 4: Before & After Photos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before Photos */}
            <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-blue-600" />
                  تصاویر قبل از نصب ({beforePhotos.length}/8)
                </span>
                <label className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 cursor-pointer">
                  افزودن تصویر
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handlePhotoUpload(e.target.files, 'BEFORE')}
                  />
                </label>
              </div>
              {beforePhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {beforePhotos.map(ph => (
                    <div key={ph.id} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square bg-slate-100">
                      <img src={ph.url} alt={ph.fileName} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setBeforePhotos(prev => prev.filter(x => x.id !== ph.id))}
                        className="absolute top-1 left-1 p-1 rounded-lg bg-rose-600 text-white opacity-90 hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 text-center py-3">تصویری برای مرحله قبل از نصب بارگذاری نشده است.</p>
              )}
            </div>

            {/* After Photos */}
            <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  تصاویر بعد از نصب ({afterPhotos.length}/8)
                </span>
                <label className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 cursor-pointer">
                  افزودن تصویر
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => handlePhotoUpload(e.target.files, 'AFTER')}
                  />
                </label>
              </div>
              {afterPhotos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {afterPhotos.map(ph => (
                    <div key={ph.id} className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 aspect-square bg-slate-100">
                      <img src={ph.url} alt={ph.fileName} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setAfterPhotos(prev => prev.filter(x => x.id !== ph.id))}
                        className="absolute top-1 left-1 p-1 rounded-lg bg-rose-600 text-white opacity-90 hover:opacity-100 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 text-center py-3">تصویری برای مرحله پس از نصب بارگذاری نشده است.</p>
              )}
            </div>
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-black shadow-md shadow-blue-500/20 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isEdit ? 'ذخیره تغییرات داربست' : 'ثبت داربست جدید'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
