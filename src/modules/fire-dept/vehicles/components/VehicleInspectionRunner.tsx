import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Wrench, 
  HelpCircle, Camera, Upload, ArrowRight, Save, Clock, 
  Calendar, User, Layers, Gauge, Flame, ShieldAlert, 
  Activity, Bell, FileText, Check, AlertOctagon, CheckSquare
} from 'lucide-react';
import { 
  FireVehicle, 
  InspectionType, 
  ChecklistItemResultType, 
  VehicleInspectionRecord, 
  VehicleChecklistItemResult,
  VehicleDefectRecord,
  VehicleOverallReadiness
} from '../types/vehicleTypes';
import { VEHICLE_CHECKLIST_CATEGORIES, ChecklistCategoryGroup } from '../config/vehicleChecklistData';
import { useFinalSubmit } from '../../../../context/FinalSubmitContext';
import Checklist3TierSignatures from '../../../../components/common/Checklist3TierSignatures';

interface Props {
  language: 'fa' | 'en';
  vehicles: FireVehicle[];
  initialVehicle?: FireVehicle;
  onSaveInspection: (inspection: VehicleInspectionRecord, autoDefects: VehicleDefectRecord[]) => void;
  onCancel: () => void;
}

const INSPECTION_TYPES: InspectionType[] = [
  'روزانه',
  'هفتگی',
  'ماهانه',
  'فصلی',
  'شش‌ماهه',
  'سالانه',
  'قبل از عملیات',
  'بعد از عملیات',
  'بازرسی ویژه'
];

const RESULT_OPTIONS: { value: ChecklistItemResultType; labelFa: string; color: string; isDefectTrigger: boolean }[] = [
  { value: 'مطابق', labelFa: 'مطابق (Compliant)', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300', isDefectTrigger: false },
  { value: 'نامنطبق', labelFa: 'نامنطبق (Non-Compliant)', color: 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300', isDefectTrigger: true },
  { value: 'نیازمند تعمیر', labelFa: 'نیازمند تعمیر (Needs Repair)', color: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300', isDefectTrigger: true },
  { value: 'موجود نیست', labelFa: 'موجود نیست (Missing)', color: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300', isDefectTrigger: true },
  { value: 'قابل استفاده نیست', labelFa: 'غیرقابل استفاده (Unusable)', color: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300', isDefectTrigger: true },
  { value: 'نیازمند آزمون', labelFa: 'نیازمند آزمون (Testing Due)', color: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300', isDefectTrigger: false },
  { value: 'خارج از سرویس', labelFa: 'خارج از سرویس (OOS)', color: 'bg-red-100 text-red-900 border-red-500 dark:bg-red-950 dark:text-red-200', isDefectTrigger: true },
  { value: 'N/A', labelFa: 'عدم کاربرد (N/A)', color: 'bg-slate-50 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400', isDefectTrigger: false }
];

export default function VehicleInspectionRunner({
  language,
  vehicles,
  initialVehicle,
  onSaveInspection,
  onCancel
}: Props) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const isFa = language === 'fa';

  // Selection & Header State
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(
    initialVehicle?.id || (vehicles.length > 0 ? vehicles[0].id : '')
  );
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  const [inspectionType, setInspectionType] = useState<InspectionType>('روزانه');
  const [date, setDate] = useState<string>(new Date().toLocaleDateString('fa-IR'));
  const [time, setTime] = useState<string>(
    new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
  );
  const [inspector, setInspector] = useState<string>('کارشناس بازرسی آتش‌نشانی');
  const [inspectorCode, setInspectorCode] = useState<string>('');
  const [supervisorName, setSupervisorName] = useState<string>('');
  const [supervisorCode, setSupervisorCode] = useState<string>('');
  const [hseManagerName, setHseManagerName] = useState<string>('');
  const [hseManagerCode, setHseManagerCode] = useState<string>('');
  const [shift, setShift] = useState<string>('shift A');
  const [mileage, setMileage] = useState<number>(selectedVehicle?.mileage || 0);
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [signatureVerified, setSignatureVerified] = useState<boolean>(true);

  // Active Category Tab
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(0);

  // Checklist Items State: key is itemId
  const [itemResults, setItemResults] = useState<Record<string, VehicleChecklistItemResult>>(() => {
    const initial: Record<string, VehicleChecklistItemResult> = {};
    VEHICLE_CHECKLIST_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        initial[item.id] = {
          id: item.id,
          category: item.category,
          itemTitle: item.titleFa,
          result: 'مطابق',
          description: '',
          measuredValue: '',
          allowedLimit: item.defaultAllowedLimit || '',
          photo: '',
          date: new Date().toLocaleDateString('fa-IR'),
          time: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          inspector: 'کارشناس بازرسی آتش‌نشانی',
          standardRefId: item.standardRefId
        };
      });
    });
    return initial;
  });

  // Calculate live score
  const { score, compliantCount, evaluableCount, overallState, defectCandidates } = useMemo(() => {
    let compliant = 0;
    let evaluable = 0;
    const candidates: { item: typeof itemResults[string]; isCritical: boolean }[] = [];

    VEHICLE_CHECKLIST_CATEGORIES.forEach(cat => {
      cat.items.forEach(tmplItem => {
        const res = itemResults[tmplItem.id]?.result || 'مطابق';
        if (res !== 'N/A') {
          evaluable++;
          if (res === 'مطابق') {
            compliant++;
          }
        }

        const opt = RESULT_OPTIONS.find(o => o.value === res);
        if (opt && opt.isDefectTrigger) {
          candidates.push({
            item: itemResults[tmplItem.id],
            isCritical: !!tmplItem.critical || res === 'خارج از سرویس'
          });
        }
      });
    });

    const calculatedScore = evaluable > 0 ? Math.round((compliant / evaluable) * 100) : 100;

    let state: VehicleOverallReadiness = 'عالی';
    if (candidates.some(c => c.isCritical) || calculatedScore < 50) {
      state = 'بحرانی';
    } else if (calculatedScore < 75) {
      state = 'نیازمند اقدام';
    } else if (calculatedScore < 90) {
      state = 'قابل قبول';
    } else {
      state = 'عالی';
    }

    return {
      score: calculatedScore,
      compliantCount: compliant,
      evaluableCount: evaluable,
      overallState: state,
      defectCandidates: candidates
    };
  }, [itemResults]);

  const handleResultChange = (itemId: string, result: ChecklistItemResultType) => {
    setItemResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        result
      }
    }));
  };

  const handleFieldChange = (itemId: string, field: keyof VehicleChecklistItemResult, value: string) => {
    setItemResults(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  // Quick mark all in current category as Compliant
  const handleMarkCategoryAllCompliant = (cat: ChecklistCategoryGroup) => {
    setItemResults(prev => {
      const next = { ...prev };
      cat.items.forEach(it => {
        next[it.id] = { ...next[it.id], result: 'مطابق' };
      });
      return next;
    });
  };

  // Submit Inspection
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    // Generate inspection record
    const inspectionId = 'insp-' + Date.now();
    const inspectionRecord: VehicleInspectionRecord = {
      id: inspectionId,
      vehicleId: selectedVehicle.id,
      vehicleCode: selectedVehicle.code,
      inspectionType,
      date,
      inspector,
      inspectorName: inspector,
      inspectorCode: inspectorCode || undefined,
      supervisorName: supervisorName || undefined,
      supervisorCode: supervisorCode || undefined,
      hseManagerName: hseManagerName || undefined,
      hseManagerCode: hseManagerCode || undefined,
      shift,
      mileageAtInspection: Number(mileage),
      complianceScore: score,
      overallState,
      items: Object.values(itemResults),
      notes: generalNotes,
      signatureVerified,
      station: selectedVehicle.fireStation
    };

    // Auto-create defects for non-compliant items
    const autoDefects: VehicleDefectRecord[] = defectCandidates.map((cand, idx) => {
      const defectId = `DEF-${selectedVehicle.code}-${Date.now().toString().slice(-4)}-${idx + 1}`;
      return {
        id: defectId,
        vehicleId: selectedVehicle.id,
        vehicleCode: selectedVehicle.code,
        inspectionId,
        item: cand.item.itemTitle,
        category: cand.item.category,
        description: cand.item.description || `عدم انطباق در آیتم «${cand.item.itemTitle}» با نتیجه «${cand.item.result}» در بازرسی ${inspectionType}`,
        severity: cand.isCritical ? 'بحرانی' : cand.item.result === 'نیازمند تعمیر' ? 'متوسط' : 'بالا',
        priority: cand.isCritical ? 'فوری (اضطراری)' : 'بالا',
        photo: cand.item.photo,
        responsiblePerson: 'سرپرست تعمیرات و تجهیزات آتش‌نشانی',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fa-IR'),
        status: 'باز',
        createdDate: date,
        correctiveAction: {
          rootCause: '',
          immediateAction: cand.isCritical ? 'اعلام محدودیت عملیاتی یا خارج از سرویس بودن سامانه' : 'پیگیری رفع نقص',
          correctiveActionPlan: '',
          responsible: 'واحد تعمیرات آتش‌نشانی',
          startDate: date,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fa-IR'),
          hseApproval: false,
          finalStatus: 'در انتظار اقدام'
        }
      };
    });

    confirmFinalSubmit({
      isFa,
      onConfirm: () => {
        onSaveInspection(inspectionRecord, autoDefects);
      }
    });
  };

  const activeCategory = VEHICLE_CHECKLIST_CATEGORIES[activeCategoryIndex];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fadeIn max-w-7xl mx-auto pb-10">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-xl transition-colors cursor-pointer"
            title={isFa ? 'بازگشت' : 'Back'}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-600" />
              <span>{isFa ? 'فرم چک‌لیست هوشمند بازرسی فنی خودروی آتش‌نشانی' : 'Smart Fire Vehicle Inspection Checklist'}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isFa ? 'ثبت آنلاین نتایج بخش‌های ۸‌گانه، محاسبه اتوماتیک امتیاز آمادگی و ثبت خودکار مغایرت‌ها' : 'Live 8-category inspection, automated scoring & defect dispatching'}
            </p>
          </div>
        </div>

        {/* Live Score Counter */}
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/80 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'امتیاز انطباق خودرو:' : 'Compliance Score:'}</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className={`text-xl font-black ${
                score >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                score >= 75 ? 'text-amber-600 dark:text-amber-400' :
                score >= 50 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {score}%
              </span>
              <span className="text-xs font-bold text-slate-500 font-sans">({overallState})</span>
            </div>
          </div>

          <div className="text-xs text-slate-500 border-r pr-3 dark:border-slate-700 font-mono">
            <div>{compliantCount} / {evaluableCount} {isFa ? 'مطابق' : 'Pass'}</div>
            {defectCandidates.length > 0 && (
              <div className="text-rose-600 font-bold text-[10px]">
                {defectCandidates.length} {isFa ? 'مغایرت شناسایی شد' : 'Defects Found'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta Specs & Parameters */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5 text-xs">
        {/* Vehicle Selection */}
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
            {isFa ? 'انتخاب خودرو آتش‌نشانی:' : 'Fire Vehicle:'} *
          </label>
          <select
            value={selectedVehicleId}
            onChange={e => {
              setSelectedVehicleId(e.target.value);
              const found = vehicles.find(v => v.id === e.target.value);
              if (found) setMileage(found.mileage);
            }}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
            required
          >
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.code} - {v.vehicleType} ({v.brandModel} / {v.plateNumber})
              </option>
            ))}
          </select>
        </div>

        {/* Inspection Type */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
            {isFa ? 'نوع بازرسی:' : 'Inspection Type:'}
          </label>
          <select
            value={inspectionType}
            onChange={e => setInspectionType(e.target.value as InspectionType)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
          >
            {INSPECTION_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Shift */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
            {isFa ? 'شیفت کاری:' : 'Work Shift:'}
          </label>
          <select
            value={shift}
            onChange={e => setShift(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
          >
            <option value="shift A">shift A</option>
            <option value="shift B">shift B</option>
            <option value="shift C">shift C</option>
            <option value="shift D">shift D</option>
            <option value="روزكار">روزكار</option>
          </select>
        </div>

        {/* Inspector */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
            {isFa ? 'نام بازرس / کارشناس:' : 'Inspector:'}
          </label>
          <input
            type="text"
            value={inspector}
            onChange={e => setInspector(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 outline-none"
            required
          />
        </div>

        {/* Mileage */}
        <div>
          <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
            {isFa ? 'کیلومتر کارکرد فعلی:' : 'Current Mileage (km):'}
          </label>
          <input
            type="number"
            value={mileage}
            onChange={e => setMileage(Number(e.target.value))}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 font-bold text-slate-800 dark:text-slate-100 font-mono outline-none"
            required
          />
        </div>
      </div>

      {/* 8 Categories Step / Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        {VEHICLE_CHECKLIST_CATEGORIES.map((cat, idx) => {
          const isActive = idx === activeCategoryIndex;
          const defectInCat = cat.items.some(it => {
            const res = itemResults[it.id]?.result;
            const opt = RESULT_OPTIONS.find(o => o.value === res);
            return opt && opt.isDefectTrigger;
          });

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryIndex(idx)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span className={`w-5 h-5 rounded-md text-[11px] font-black flex items-center justify-center ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}>
                {idx + 1}
              </span>
              <span>{isFa ? cat.nameFa : cat.nameEn}</span>
              {defectInCat && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Category Content */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-red-600 text-white text-xs flex items-center justify-center font-bold">
                {activeCategoryIndex + 1}
              </span>
              <span>{isFa ? activeCategory.nameFa : activeCategory.nameEn}</span>
            </h2>
            <span className="text-xs text-slate-500 mt-0.5">
              {isFa ? `شامل ${activeCategory.items.length} آیتم کنترلی استاندارد` : `${activeCategory.items.length} inspection criteria`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleMarkCategoryAllCompliant(activeCategory)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isFa ? 'ثبت همه آیتم‌های این بخش به عنوان «مطابق»' : 'Mark all compliant'}</span>
          </button>
        </div>

        {/* Items List */}
        <div className="space-y-4">
          {activeCategory.items.map((item, itemIdx) => {
            const currentRes = itemResults[item.id] || ({} as Partial<VehicleChecklistItemResult>);
            const isDefect = RESULT_OPTIONS.find(o => o.value === currentRes.result)?.isDefectTrigger;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isDefect
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                    : 'bg-slate-50/60 dark:bg-slate-850 border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Title & Critical flag */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] font-bold flex items-center justify-center text-slate-700 dark:text-slate-300 font-mono">
                      {itemIdx + 1}
                    </span>
                    <h4 className="font-black text-xs text-slate-900 dark:text-white">
                      {item.titleFa}
                    </h4>
                    {item.critical && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        {isFa ? 'آیتم بحرانی' : 'Critical'}
                      </span>
                    )}
                  </div>

                  {item.defaultAllowedLimit && (
                    <div className="text-[11px] text-slate-500 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="font-bold">{isFa ? 'حد مجاز / معیار:' : 'Criteria:'} </span>
                      <span>{item.defaultAllowedLimit}</span>
                    </div>
                  )}
                </div>

                {/* Result Radios / Buttons Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 text-xs">
                  {RESULT_OPTIONS.map(opt => {
                    const isSelected = currentRes.result === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleResultChange(item.id, opt.value)}
                        className={`py-2 px-1 text-center font-bold rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? `${opt.color} ring-2 ring-red-500 shadow-xs`
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-[11px] truncate block">{opt.labelFa.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Measured Value, Allowed Limit, Notes & Photo Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-bold mb-1">
                      {isFa ? 'مقدار اندازه‌گیری‌شده (اختیاری):' : 'Measured Value:'}
                    </label>
                    <input
                      type="text"
                      placeholder={isFa ? 'مثال: 10.5 Bar / 12.8V / 115 PSI' : 'e.g. 10.5 Bar'}
                      value={currentRes.measuredValue || ''}
                      onChange={e => handleFieldChange(item.id, 'measuredValue', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-1.5 font-mono text-xs outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 font-bold mb-1">
                      {isFa ? 'توضیحات و شرح نقص یا شرایط مشاهده‌شده:' : 'Notes / Defect Details:'}
                    </label>
                    <input
                      type="text"
                      placeholder={isFa ? 'توضیحات تکمیلی، محل دقیق ایراد...' : 'Detailed observations...'}
                      value={currentRes.description || ''}
                      onChange={e => handleFieldChange(item.id, 'description', e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step Navigation Bottom Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={activeCategoryIndex === 0}
            onClick={() => setActiveCategoryIndex(prev => Math.max(0, prev - 1))}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
          >
            {isFa ? 'بخش قبلی' : 'Previous Section'}
          </button>

          {activeCategoryIndex < VEHICLE_CHECKLIST_CATEGORIES.length - 1 ? (
            <button
              type="button"
              onClick={() => setActiveCategoryIndex(prev => prev + 1)}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-xs cursor-pointer"
            >
              {isFa ? 'بخش بعدی' : 'Next Section'}
            </button>
          ) : (
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              {isFa ? 'تمام بخش‌ها تکمیل گردید' : 'All Sections Ready'}
            </span>
          )}
        </div>
      </div>

      {/* General Notes & Submit Card */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
            {isFa ? 'جمع‌بندی نهایی و دستورات ویژه بازرس:' : 'Final Summary & Instructions:'}
          </label>
          <textarea
            rows={3}
            value={generalNotes}
            onChange={e => setGeneralNotes(e.target.value)}
            placeholder={isFa ? 'توضیحات کلی در مورد وضعیت عملیاتی خودرو، توصیه‌ها و پیگیری‌های لازم...' : 'General notes...'}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-3 text-xs outline-none"
          />
        </div>

        {/* 3-Tier Official Signatures Matrix */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <Checklist3TierSignatures
            isFa={isFa}
            formData={{
              inspectorName: inspector,
              inspectorCode,
              supervisorName,
              supervisorCode,
              hseManagerName,
              hseManagerCode
            }}
            onChange={(updated) => {
              if (updated.inspectorName !== undefined) setInspector(updated.inspectorName);
              if (updated.inspectorCode !== undefined) setInspectorCode(updated.inspectorCode);
              if (updated.supervisorName !== undefined) setSupervisorName(updated.supervisorName);
              if (updated.supervisorCode !== undefined) setSupervisorCode(updated.supervisorCode);
              if (updated.hseManagerName !== undefined) setHseManagerName(updated.hseManagerName);
              if (updated.hseManagerCode !== undefined) setHseManagerCode(updated.hseManagerCode);
            }}
            tier1Title={isFa ? 'کارشناس / نماینده بازرسی آتش‌نشانی' : 'Fire Inspector'}
            tier1Subtitle={isFa ? 'بازرس و ثبت‌کننده فنی ناوگان' : 'Vehicle Technical Auditor'}
            tier2Title={isFa ? 'سرپرست / مسئول ایستگاه آتش‌نشانی' : 'Fire Station Lead'}
            tier2Subtitle={isFa ? 'مسئول تجهیزات و آماده‌به‌کاری' : 'Station Readiness Lead'}
            tier3Title={isFa ? 'رئیس مرکز HSE' : 'Head of HSE Center'}
            tier3Subtitle={isFa ? 'تصویب و تایید نهایی' : 'Final Approval'}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={signatureVerified}
              onChange={e => setSignatureVerified(e.target.checked)}
              className="w-4 h-4 rounded text-red-600 border-slate-300"
            />
            <span>{isFa ? 'تأیید اصالت اطلاعات و ثبت تاییدیه سازمانی' : 'Verified by Technical Inspector'}</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-transform hover:scale-105"
            >
              <Save className="w-4 h-4" />
              <span>{isFa ? 'ثبت نهایی گزارش بازرسی و مغایرت‌ها' : 'Save & Submit Inspection'}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
