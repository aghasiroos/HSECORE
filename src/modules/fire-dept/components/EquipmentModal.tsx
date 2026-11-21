import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Building2,
  Compass,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { FireEquipment, OperationalStatus, OperationalStatusChangeLog } from '../types';
import {
  ColumnDefinition,
  GEOGRAPHICAL_DIRECTIONS,
  FLOOR_OPTIONS,
  OPERATIONAL_STATUS_OPTIONS,
  getPrimaryCodeFieldForCategory,
  extractEquipmentUniqueCode,
  composeStructuredLocation,
} from '../config/columns';
import { getUnits, getOrgSites, getSubUnitsForUnit } from '../../../utils/orgHelper';
import { getStoredOrgNodes } from '../../../utils/personnelHelper';
import { getCurrentUser } from '../../../utils/authHelper';

interface Props {
  language: 'fa' | 'en';
  category: string;
  columns: ColumnDefinition[];
  initialData: FireEquipment | null;
  allEquipment?: FireEquipment[];
  onSave: (data: any) => Promise<void> | void;
  onSelectExisting?: (existingItem: FireEquipment) => void;
  onClose: () => void;
}

function getCurrentActorDisplayName(): string {
  const parsed = getCurrentUser();
  return parsed?.fullName || parsed?.username || 'کارشناس آتش‌نشانی';
}

export default function EquipmentModal({
  language,
  category,
  columns,
  initialData,
  allEquipment = [],
  onSave,
  onSelectExisting,
  onClose,
}: Props) {
  const isFa = language === 'fa';
  const primaryCodeMeta = useMemo(() => getPrimaryCodeFieldForCategory(category), [category]);

  const [formData, setFormData] = useState<any>({});
  // Structured 5-part location state
  const [complex, setComplex] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [direction, setDirection] = useState<string>('');
  const [floor, setFloor] = useState<string>('همکف');
  const [exactLocation, setExactLocation] = useState<string>('');

  // Manual toggle flags so users can either pick from dropdown or type manually
  const [manualComplex, setManualComplex] = useState(false);
  const [manualUnit, setManualUnit] = useState(false);
  const [manualDirection, setManualDirection] = useState(false);
  const [manualFloor, setManualFloor] = useState(false);

  // Operational Status & Relocation Metadata
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus | string>('فعال');
  const [changeDate, setChangeDate] = useState<string>(() => new Date().toLocaleDateString('fa-IR'));
  const [changeReason, setChangeReason] = useState<string>('');
  const [changeNotes, setChangeNotes] = useState<string>('');
  const [previousLocation, setPreviousLocation] = useState<string>('');
  const [destinationLocation, setDestinationLocation] = useState<string>('');
  const [recordedBy, setRecordedBy] = useState<string>(() => getCurrentActorDisplayName());
  const [isReturnAction, setIsReturnAction] = useState<boolean>(false);

  // Submission & validation state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictRecord, setConflictRecord] = useState<FireEquipment | null>(null);

  // Dynamic Organization Lists (Complexes/Companies & Units)
  const availableComplexes = useMemo(() => {
    const set = new Set<string>();
    try {
      getOrgSites().forEach((s) => {
        if (s && s.trim()) set.add(s.trim());
      });
      getStoredOrgNodes().forEach((n) => {
        if (n.status !== 'inactive' && (n.type === 'Company' || n.type === 'Site' || n.type === 'Plant')) {
          if (n.name && n.name.trim()) set.add(n.name.trim());
        }
      });
    } catch {}
    allEquipment.forEach((eq) => {
      const c = eq.locationDetails?.complex || eq.complex;
      if (c && c.trim()) set.add(c.trim());
    });
    return Array.from(set);
  }, [allEquipment]);

  const availableUnits = useMemo(() => {
    const set = new Set<string>();
    try {
      // Check if selected complex has child nodes in org hierarchy
      if (complex && complex.trim()) {
        const nodes = getStoredOrgNodes();
        const parentNode = nodes.find((n) => n.name.trim().toLowerCase() === complex.trim().toLowerCase());
        if (parentNode) {
          nodes
            .filter((n) => n.parentId === parentNode.id && n.status !== 'inactive')
            .forEach((child) => {
              if (child.name && child.name.trim()) set.add(child.name.trim());
            });
        }
        getSubUnitsForUnit(complex).forEach((sub) => {
          if (sub && sub.trim()) set.add(sub.trim());
        });
      }
      // Also include all standard organizational units
      getUnits().forEach((u) => {
        if (u && u.trim()) set.add(u.trim());
      });
    } catch {}
    allEquipment.forEach((eq) => {
      const u = eq.locationDetails?.unit || eq.unit;
      if (u && u.trim()) set.add(u.trim());
    });
    return Array.from(set);
  }, [complex, allEquipment]);

  useEffect(() => {
    setErrorMessage(null);
    setConflictRecord(null);
    setIsReturnAction(false);

    if (initialData) {
      const initAny = initialData as any;
      const codeVal = extractEquipmentUniqueCode(initAny);
      setFormData({
        ...initAny,
        code: codeVal,
        [primaryCodeMeta.key]: initAny[primaryCodeMeta.key] || codeVal,
      });

      const loc = initAny.locationDetails || {};
      const initComplex = String(loc.complex ?? initAny.complex ?? '').trim();
      const initUnit = String(loc.unit ?? initAny.unit ?? '').trim();
      const initDirection = String(loc.direction ?? initAny.direction ?? '').trim();
      const initFloor = String(loc.floor ?? initAny.floor ?? 'همکف').trim();
      const initExact = String(loc.exactLocation ?? initAny.exactLocation ?? initAny.location ?? '').trim();

      setComplex(initComplex);
      setUnit(initUnit);
      setDirection(initDirection);
      setFloor(initFloor || 'همکف');
      setExactLocation(initExact);

      setManualComplex(Boolean(initComplex && !availableComplexes.includes(initComplex)));
      setManualUnit(Boolean(initUnit && !availableUnits.includes(initUnit)));
      setManualDirection(Boolean(initDirection && !GEOGRAPHICAL_DIRECTIONS.includes(initDirection)));
      setManualFloor(Boolean(initFloor && !FLOOR_OPTIONS.includes(initFloor)));

      const initOpStatus = initAny.operationalStatus || 'فعال';
      setOperationalStatus(initOpStatus);
      setPreviousLocation(initAny.primaryLocation || initAny.location || '');
      setDestinationLocation(initAny.currentDestination || '');
      setChangeDate(new Date().toLocaleDateString('fa-IR'));
      setChangeReason('');
      setChangeNotes('');
      setRecordedBy(getCurrentActorDisplayName());
    } else {
      const defaults: any = {
        code: '',
      };
      columns.forEach((col) => {
        if (col.options && col.options.length > 0) {
          defaults[col.key] = col.options[0];
        }
      });
      setFormData(defaults);
      setComplex(availableComplexes[0] || '');
      setUnit(availableUnits[0] || '');
      setDirection('N – North');
      setFloor('همکف');
      setExactLocation('');
      setManualComplex(availableComplexes.length === 0);
      setManualUnit(availableUnits.length === 0);
      setManualDirection(false);
      setManualFloor(false);
      setOperationalStatus('فعال');
      setChangeDate(new Date().toLocaleDateString('fa-IR'));
      setChangeReason('ثبت اولیه و استقرار تجهیز در محل');
      setChangeNotes('');
      setPreviousLocation('');
      setDestinationLocation('');
      setRecordedBy(getCurrentActorDisplayName());
    }
  }, [initialData, columns, primaryCodeMeta.key]);

  const composedLocationPreview = useMemo(() => {
    return composeStructuredLocation({
      complex,
      unit,
      direction,
      floor,
      exactLocation,
    });
  }, [complex, unit, direction, floor, exactLocation]);

  // Real-time detection of existing or similar equipment across ALL 8 inspection forms
  const currentEnteredCode = useMemo(() => {
    const val =
      formData[primaryCodeMeta.key] ||
      formData.code ||
      formData.assetCode ||
      formData.specializedCode ||
      formData.fireBoxNo ||
      formData.foamStationNo ||
      formData.tag ||
      '';
    return String(val).trim();
  }, [formData, primaryCodeMeta.key]);

  const detectedExistingMatches = useMemo(() => {
    const normCode = currentEnteredCode.toLowerCase();
    return allEquipment.filter((eq) => {
      if (initialData && (eq.id === initialData.id || eq.code === initialData.code)) {
        return false;
      }
      const eqCodes = [
        eq.code,
        eq.id,
        (eq as any).assetCode,
        (eq as any).specializedCode,
        (eq as any).fireBoxNo,
        (eq as any).foamStationNo,
        (eq as any).tag,
      ]
        .map((v) => String(v ?? '').trim().toLowerCase())
        .filter(Boolean);

      if (normCode && eqCodes.includes(normCode)) {
        return true;
      }

      // Also detect exact same location + category + type when creating a new record
      if (!initialData && exactLocation.trim().length > 3) {
        const sameCategory = eq.category === category;
        const eqLoc: any = eq.locationDetails || {};
        const sameComplexAndUnit =
          String(eqLoc.complex || eq.complex || '').trim().toLowerCase() === complex.trim().toLowerCase() &&
          String(eqLoc.unit || eq.unit || '').trim().toLowerCase() === unit.trim().toLowerCase() &&
          String(eqLoc.exactLocation || eq.exactLocation || '').trim().toLowerCase() ===
            exactLocation.trim().toLowerCase();
        if (sameCategory && sameComplexAndUnit) {
          return true;
        }
      }
      return false;
    });
  }, [allEquipment, currentEnteredCode, initialData, exactLocation, category, complex, unit]);

  const exactCodeDuplicate = useMemo(() => {
    if (!currentEnteredCode) return null;
    const normCode = currentEnteredCode.toLowerCase();
    return (
      allEquipment.find((eq) => {
        if (initialData && (eq.id === initialData.id || eq.code === initialData.code)) {
          return false;
        }
        const eqCodes = [
          eq.code,
          eq.id,
          (eq as any).assetCode,
          (eq as any).specializedCode,
          (eq as any).fireBoxNo,
          (eq as any).foamStationNo,
          (eq as any).tag,
        ]
          .map((v) => String(v ?? '').trim().toLowerCase())
          .filter(Boolean);
        return eqCodes.includes(normCode);
      }) || null
    );
  }, [allEquipment, currentEnteredCode, initialData]);

  const handleChange = (key: string, value: any) => {
    setErrorMessage(null);
    setConflictRecord(null);
    setFormData((prev: any) => {
      const next = { ...prev, [key]: value };
      if (key === primaryCodeMeta.key || key === 'code') {
        next.code = value;
        next[primaryCodeMeta.key] = value;
      }
      return next;
    });
  };

  // One-click Return to Primary Location & Reactivation
  const handleReturnToPrimaryLocation = () => {
    if (!initialData) return;
    const primaryLoc = initialData.primaryLocation || composedLocationPreview;
    const primaryDetails = initialData.primaryLocationDetails || initialData.locationDetails;
    if (primaryDetails) {
      if (primaryDetails.complex) setComplex(primaryDetails.complex);
      if (primaryDetails.unit) setUnit(primaryDetails.unit);
      if (primaryDetails.direction) setDirection(primaryDetails.direction);
      if (primaryDetails.floor) setFloor(primaryDetails.floor);
      if (primaryDetails.exactLocation) setExactLocation(primaryDetails.exactLocation);
    }
    setPreviousLocation(
      initialData.currentDestination ||
        (initialData.operationalStatus === 'انتقال جهت شارژ' ? 'کارگاه شارژ' : 'مرکز تست هیدرواستاتیک / فنی')
    );
    setDestinationLocation(primaryLoc);
    setOperationalStatus('فعال');
    setChangeDate(new Date().toLocaleDateString('fa-IR'));
    setChangeReason('بازگشت تجهیز از شارژ/تست به محل استقرار اصلی و فعال‌سازی مجدد');
    setIsReturnAction(true);
  };

  const isStatusTransferred =
    operationalStatus === 'انتقال جهت شارژ' || operationalStatus === 'انتقال جهت تست';

  const statusChangedFromInitial =
    !initialData || initialData.operationalStatus !== operationalStatus || isReturnAction;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setErrorMessage(null);
    setConflictRecord(null);

    const cleanCode = currentEnteredCode;
    if (!cleanCode) {
      setErrorMessage(
        isFa
          ? `لطفاً «${primaryCodeMeta.labelFa}» را وارد نمایید. کد یکتای تجهیز الزامی است.`
          : `Please enter ${primaryCodeMeta.labelEn}. Unique equipment code is required.`
      );
      return;
    }

    if (!complex.trim() || !unit.trim() || !direction.trim() || !floor.trim() || !exactLocation.trim()) {
      setErrorMessage(
        isFa
          ? 'لطفاً تمام ۵ بخش محل استقرار تجهیز (مجتمع/شرکت، واحد، جهت جغرافیایی، طبقه و موقعیت دقیق) را تکمیل نمایید.'
          : 'Please complete all 5 structured location fields (Complex, Unit, Direction, Floor, and Exact Location).'
      );
      return;
    }

    if (exactCodeDuplicate) {
      setConflictRecord(exactCodeDuplicate);
      setErrorMessage(
        isFa
          ? `کد یکتای «${cleanCode}» قبلاً برای تجهیز دیگری در فرم «${exactCodeDuplicate.category}» ثبت شده است. امکان ثبت کد تکراری وجود ندارد.`
          : `Duplicate equipment code "${cleanCode}" already exists in "${exactCodeDuplicate.category}".`
      );
      return;
    }

    if (isStatusTransferred && !destinationLocation.trim()) {
      setErrorMessage(
        isFa
          ? 'در وضعیت «انتقال جهت شارژ» یا «انتقال جهت تست»، وارد کردن «محل یا مقصد جدید انتقال» الزامی است.'
          : 'Please enter the transfer destination location.'
      );
      return;
    }

    if (statusChangedFromInitial && (!changeDate.trim() || !recordedBy.trim())) {
      setErrorMessage(
        isFa
          ? 'لطفاً تاریخ تغییر وضعیت و نام فرد ثبت‌کننده تغییر را وارد نمایید.'
          : 'Please enter the status change date and recorder name.'
      );
      return;
    }

    const locationDetails = {
      complex: complex.trim(),
      unit: unit.trim(),
      direction: direction.trim(),
      floor: floor.trim(),
      exactLocation: exactLocation.trim(),
    };

    const composedLocation = composeStructuredLocation(locationDetails);

    const prevHistory: OperationalStatusChangeLog[] = Array.isArray(initialData?.statusHistory)
      ? [...initialData!.statusHistory!]
      : [];

    let updatedHistory = prevHistory;
    if (statusChangedFromInitial || prevHistory.length === 0) {
      const newLog: OperationalStatusChangeLog = {
        id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        status: operationalStatus,
        previousStatus: initialData?.operationalStatus || null,
        changeDate: changeDate.trim() || new Date().toLocaleDateString('fa-IR'),
        reason:
          changeReason.trim() ||
          (initialData ? `تغییر وضعیت به ${operationalStatus}` : 'ثبت اولیه تجهیز در سامانه'),
        notes: changeNotes.trim(),
        previousLocation: previousLocation.trim() || initialData?.location || composedLocation,
        destinationLocation: isStatusTransferred
          ? destinationLocation.trim()
          : destinationLocation.trim() || composedLocation,
        recordedBy: recordedBy.trim() || getCurrentActorDisplayName(),
        isReturnToService: isReturnAction,
        timestamp: new Date().toISOString(),
      };
      updatedHistory = [newLog, ...prevHistory];
    }

    const payload = {
      ...formData,
      id: initialData?.id || cleanCode,
      code: cleanCode,
      [primaryCodeMeta.key]: cleanCode,
      category,
      location: composedLocation,
      complex: locationDetails.complex,
      unit: locationDetails.unit,
      direction: locationDetails.direction,
      floor: locationDetails.floor,
      exactLocation: locationDetails.exactLocation,
      locationDetails,
      primaryLocation: isStatusTransferred
        ? initialData?.primaryLocation || composedLocation
        : composedLocation,
      primaryLocationDetails: isStatusTransferred
        ? initialData?.primaryLocationDetails || locationDetails
        : locationDetails,
      operationalStatus,
      isTemporaryOut: isStatusTransferred,
      currentDestination: isStatusTransferred ? destinationLocation.trim() : '',
      statusHistory: updatedHistory,
      statusChangeMeta: {
        changeDate: changeDate.trim(),
        reason: changeReason.trim(),
        notes: changeNotes.trim(),
        previousLocation: previousLocation.trim() || initialData?.location || composedLocation,
        destinationLocation: isStatusTransferred ? destinationLocation.trim() : composedLocation,
        recordedBy: recordedBy.trim(),
        isReturnToService: isReturnAction,
      },
    };

    try {
      setIsSaving(true);
      await onSave(payload);
    } catch (err: any) {
      if (err?.existingRecord) {
        setConflictRecord(err.existingRecord);
      }
      setErrorMessage(err?.message || (isFa ? 'خطا در ذخیره اطلاعات تجهیز' : 'Failed to save equipment'));
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out `location` and primary code field from generic loop because we render them in dedicated structured sections
  const technicalColumns = useMemo(() => {
    return columns.filter((c) => c.key !== 'location' && c.key !== primaryCodeMeta.key && c.key !== 'code');
  }, [columns, primaryCodeMeta.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-4">
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-700"
        dir={isFa ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/90 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[11px] font-black rounded-md bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {category}
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
                {initialData
                  ? isFa
                    ? 'ویرایش شناسنامه، موقعیت و وضعیت عملیاتی تجهیز'
                    : 'Edit Equipment Passport, Location & Status'
                  : isFa
                  ? 'ثبت تجهیز جدید (فرم استاندارد یکپارچه آتش‌نشانی)'
                  : 'Register New Fire Equipment'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isFa
                ? 'کلیه اطلاعات موقعیت پنج‌بخشی، وضعیت عملیاتی و تاریخچه جابه‌جایی در پایگاه داده مرکزی ثبت می‌شود.'
                : 'Structured 5-part location, operational status, and movement history are stored in the central database.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Validation / Conflict Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
              {conflictRecord && onSelectExisting && (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-rose-200 dark:border-rose-800 mt-1">
                  <div className="text-xs">
                    <span className="font-black text-slate-800 dark:text-slate-100">
                      {isFa ? 'تجهیز ثبت‌شده در سامانه:' : 'Existing Record:'}{' '}
                    </span>
                    <span className="font-mono font-bold text-red-600">{conflictRecord.id}</span>
                    <span className="mx-1.5 text-slate-400">|</span>
                    <span className="text-slate-600 dark:text-slate-300">{conflictRecord.category}</span>
                    <span className="mx-1.5 text-slate-400">|</span>
                    <span className="text-slate-500">{conflictRecord.location}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectExisting(conflictRecord)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                  >
                    <span>{isFa ? 'انتخاب و استفاده از این تجهیز موجود' : 'Use Existing Record'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cross-Form Existing / Similar Equipment Detection Alert */}
          {detectedExistingMatches.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-black text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {exactCodeDuplicate
                    ? isFa
                      ? 'هشدار کد تکراری: تجهیز با همین کد یکتا قبلاً در سامانه ثبت شده است!'
                      : 'Duplicate Code Alert: An equipment with this exact code already exists!'
                    : isFa
                    ? 'تجهیز مشابه در همین موقعیت شناسایی شد (جلوگیری از ثبت تکراری در فرم‌های بازرسی):'
                    : 'Similar equipment detected in the system:'}
                </span>
              </div>
              <div className="space-y-2">
                {detectedExistingMatches.slice(0, 3).map((match) => (
                  <div
                    key={match.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200 dark:border-amber-800/80 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-red-600 dark:text-red-400">
                          {extractEquipmentUniqueCode(match) || match.id}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                          {match.category}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                          {match.operationalStatus || 'فعال'}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {isFa ? 'موقعیت:' : 'Location:'} {match.location}
                      </p>
                    </div>
                    {onSelectExisting && (
                      <button
                        type="button"
                        onClick={() => onSelectExisting(match)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <span>{isFa ? 'انتخاب و باز کردن همین تجهیز' : 'Select & Open Record'}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form id="equipForm" onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Unique Code & Technical Specifications */}
            <div className="bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-red-600" />
                  <span>{isFa ? '۱. شناسه یکتا و مشخصات فنی تجهیز' : '1. Unique Code & Technical Specifications'}</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {isFa ? 'کد تجهیز در کل سامانه یکتا است' : 'Unique across all forms'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Canonical Unique Equipment Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? primaryCodeMeta.labelFa : primaryCodeMeta.labelEn}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentEnteredCode}
                    onChange={(e) => handleChange(primaryCodeMeta.key, e.target.value)}
                    placeholder={isFa ? 'مثال: EXT-101 یا FB-01' : 'e.g. EXT-101'}
                    className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 outline-none ${
                      exactCodeDuplicate
                        ? 'border-rose-500 focus:ring-rose-500'
                        : 'border-slate-300 dark:border-slate-600 focus:ring-red-500'
                    }`}
                    required
                  />
                </div>

                {/* Category-specific technical columns */}
                {technicalColumns.map((col) => (
                  <div key={col.key} className={col.type === 'array' ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      {isFa ? col.labelFa : col.labelEn}
                    </label>
                    {col.type === 'select' || col.options ? (
                      <select
                        value={formData[col.key] ?? (col.options?.[0] || '')}
                        onChange={(e) => handleChange(col.key, e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                        required
                      >
                        {col.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : col.type === 'array' ? (
                      <input
                        type="text"
                        placeholder={
                          isFa
                            ? 'مقادیر را با کاما جدا کنید (مثال: هوز, نازل, ولو)'
                            : 'Comma separated (e.g. Hose, Nozzle, Valve)'
                        }
                        value={
                          Array.isArray(formData[col.key])
                            ? formData[col.key].join(', ')
                            : formData[col.key] || ''
                        }
                        onChange={(e) =>
                          handleChange(
                            col.key,
                            e.target.value
                              .split(/[,،]/)
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    ) : (
                      <input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={formData[col.key] ?? ''}
                        onChange={(e) =>
                          handleChange(
                            col.key,
                            col.type === 'number'
                              ? e.target.value === ''
                                ? ''
                                : Number(e.target.value)
                              : e.target.value
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                        required={col.key === 'type'}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: 5-Part Structured Location Field */}
            <div className="bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span>
                    {isFa
                      ? '۲. محل استقرار / موقعیت دقیق تجهیز (ساختار استاندارد ۵ بخشی)'
                      : '2. Structured Equipment Location (5-Part Standard)'}
                  </span>
                </h3>
                {composedLocationPreview && (
                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                    {composedLocationPreview}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Complex / Company (مجتمع / شرکت) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isFa ? 'مجتمع / شرکت' : 'Complex / Company'}</span>
                      <span className="text-red-500">*</span>
                    </label>
                    {availableComplexes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualComplex(!manualComplex)}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {manualComplex
                          ? isFa
                            ? 'انتخاب از لیست'
                            : 'Select from list'
                          : isFa
                          ? '+ ورود دستی'
                          : '+ Manual entry'}
                      </button>
                    )}
                  </div>
                  {!manualComplex && availableComplexes.length > 0 ? (
                    <select
                      value={complex}
                      onChange={(e) => setComplex(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    >
                      <option value="">{isFa ? 'انتخاب مجتمع / شرکت...' : 'Select Complex...'}</option>
                      {availableComplexes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      list="fire-equip-complex-list"
                      value={complex}
                      onChange={(e) => setComplex(e.target.value)}
                      placeholder={isFa ? 'نام مجتمع یا شرکت را وارد کنید...' : 'Enter complex or company...'}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  )}
                  <datalist id="fire-equip-complex-list">
                    {availableComplexes.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {/* 2. Organizational Unit (واحد) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isFa ? 'واحد سازمانی' : 'Organizational Unit'} <span className="text-red-500">*</span>
                    </label>
                    {availableUnits.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualUnit(!manualUnit)}
                        className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        {manualUnit
                          ? isFa
                            ? 'انتخاب از لیست'
                            : 'Select from list'
                          : isFa
                          ? '+ ورود دستی'
                          : '+ Manual entry'}
                      </button>
                    )}
                  </div>
                  {!manualUnit && availableUnits.length > 0 ? (
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    >
                      <option value="">{isFa ? 'انتخاب واحد...' : 'Select Unit...'}</option>
                      {availableUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      list="fire-equip-units-list"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder={isFa ? 'نام واحد سازمانی را وارد کنید...' : 'Enter organizational unit...'}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  )}
                  <datalist id="fire-equip-units-list">
                    {availableUnits.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                {/* 3. Geographical Direction (جهت جغرافیایی) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isFa ? 'جهت جغرافیایی' : 'Geographical Direction'}</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setManualDirection(!manualDirection)}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {manualDirection
                        ? isFa
                          ? 'انتخاب استاندارد'
                          : 'Standard list'
                        : isFa
                        ? '+ ورود دستی'
                        : '+ Manual'}
                    </button>
                  </div>
                  {!manualDirection ? (
                    <select
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      dir="ltr"
                      required
                    >
                      {GEOGRAPHICAL_DIRECTIONS.map((dir) => (
                        <option key={dir} value={dir}>
                          {dir}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      list="fire-equip-directions-list"
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                      placeholder="N – North, NE, ..."
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  )}
                  <datalist id="fire-equip-directions-list">
                    {GEOGRAPHICAL_DIRECTIONS.map((dir) => (
                      <option key={dir} value={dir} />
                    ))}
                  </datalist>
                </div>

                {/* 4. Floor (طبقه: همکف، فاقد طبقه، ۱ تا ۲۰) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isFa ? 'طبقه' : 'Floor'} <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setManualFloor(!manualFloor)}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {manualFloor
                        ? isFa
                          ? 'انتخاب از لیست'
                          : 'Select from list'
                        : isFa
                        ? '+ ورود دستی'
                        : '+ Manual'}
                    </button>
                  </div>
                  {!manualFloor ? (
                    <select
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    >
                      {FLOOR_OPTIONS.map((fl) => (
                        <option key={fl} value={fl}>
                          {fl === 'همکف' || fl === 'فاقد طبقه' ? fl : isFa ? `طبقه ${fl}` : `Floor ${fl}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      list="fire-equip-floors-list"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder={isFa ? 'همکف، فاقد طبقه یا عدد ۱ تا ۲۰' : 'Ground, None, or 1-20'}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                      required
                    />
                  )}
                  <datalist id="fire-equip-floors-list">
                    {FLOOR_OPTIONS.map((fl) => (
                      <option key={fl} value={fl} />
                    ))}
                  </datalist>
                </div>

                {/* 5. Exact Location / Additional Details (موقعیت دقیق / توضیحات تکمیلی) */}
                <div className="md:col-span-2 lg:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa
                      ? 'موقعیت دقیق / توضیحات تکمیلی (نام ساختمان، سالن، اتاق، محوطه، ایستگاه، کد پستی یا نشانه شاخص)'
                      : 'Exact Location / Landmark Details (Building, Hall, Room, Yard, Station, Postal Code)'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={exactLocation}
                    onChange={(e) => setExactLocation(e.target.value)}
                    placeholder={
                      isFa
                        ? 'مثال: ساختمان کنترل مرکزی، جنب درب ورودی شرقی، ستون B4'
                        : 'e.g. Central Control Building, Near East Entrance, Pillar B4'
                    }
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Operational Status & Equipment Movement / Relocation Tracking */}
            <div className="bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-red-600" />
                  <span>
                    {isFa
                      ? '۳. وضعیت عملیاتی و مدیریت جابه‌جایی تجهیز'
                      : '3. Operational Status & Relocation Management'}
                  </span>
                </h3>

                {/* Quick Return to Primary Location Button when equipment is currently out for recharge/test */}
                {initialData &&
                  (initialData.operationalStatus === 'انتقال جهت شارژ' ||
                    initialData.operationalStatus === 'انتقال جهت تست') && (
                    <button
                      type="button"
                      onClick={handleReturnToPrimaryLocation}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        {isFa
                          ? 'بازگشت تجهیز به محل استقرار اصلی و فعال‌سازی مجدد'
                          : 'Return to Primary Location & Reactivate'}
                      </span>
                    </button>
                  )}
              </div>

              {/* 4 Standardized Operational Status Buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  {isFa ? 'انتخاب وضعیت عملیاتی تجهیز:' : 'Select Operational Status:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {OPERATIONAL_STATUS_OPTIONS.map((statusOpt) => {
                    const isSelected = operationalStatus === statusOpt;
                    const badgeStyle =
                      statusOpt === 'فعال'
                        ? isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        : statusOpt === 'غیرفعال'
                        ? isSelected
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 border-slate-200 dark:border-slate-700 hover:border-rose-400'
                        : statusOpt === 'انتقال جهت شارژ'
                        ? isSelected
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        : isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border-slate-200 dark:border-slate-700 hover:border-blue-400';

                    return (
                      <button
                        key={statusOpt}
                        type="button"
                        onClick={() => {
                          setOperationalStatus(statusOpt);
                          setIsReturnAction(false);
                          if (
                            (statusOpt === 'انتقال جهت شارژ' || statusOpt === 'انتقال جهت تست') &&
                            !previousLocation
                          ) {
                            setPreviousLocation(initialData?.location || composedLocationPreview);
                          }
                        }}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${badgeStyle}`}
                      >
                        {statusOpt === 'فعال' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        <span>{statusOpt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Temporary Out-of-Service Notice when transferred for recharge or test */}
              {isStatusTransferred && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {isFa
                      ? `با انتخاب «${operationalStatus}»، تجهیز در محل اصلی خود (${
                          initialData?.primaryLocation || composedLocationPreview || 'محل اصلی'
                        }) به عنوان «خارج از سرویس موقت» علامت‌گذاری می‌شود تا زمان بازگشت و فعال‌سازی مجدد.`
                      : 'Equipment will be marked as Temporarily Out of Service at its primary location until returned.'}
                  </span>
                </div>
              )}

              {/* Status Change & Movement Metadata Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'تاریخ ثبت / تغییر وضعیت' : 'Status Change Date'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={changeDate}
                    onChange={(e) => setChangeDate(e.target.value)}
                    placeholder="1403/08/12"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'نام فرد ثبت‌کننده تغییر' : 'Recorded By'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                    placeholder={isFa ? 'نام و نام خانوادگی کارشناس' : 'Inspector / Officer Name'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'علت تغییر وضعیت / جابه‌جایی' : 'Reason for Status Change'}
                  </label>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder={
                      isFa
                        ? 'مثال: افت فشار گیج، سررسید شارژ سالیانه، تست هیدرواستاتیک'
                        : 'e.g. Annual recharge due, pressure drop, hydrostatic test'
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'محل استقرار قبلی' : 'Previous Location'}
                  </label>
                  <input
                    type="text"
                    value={previousLocation || initialData?.location || composedLocationPreview}
                    onChange={(e) => setPreviousLocation(e.target.value)}
                    placeholder={isFa ? 'محل استقرار قبلی تجهیز' : 'Previous equipment location'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'محل یا مقصد جدید (در صورت انتقال)' : 'Destination Location (if transferred)'}{' '}
                    {isStatusTransferred && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={destinationLocation}
                    onChange={(e) => setDestinationLocation(e.target.value)}
                    placeholder={
                      isFa
                        ? 'مثال: کارگاه شارژ مرکزی / آزمایشگاه تست هیدرواستاتیک'
                        : 'e.g. Central Recharge Workshop / Hydrostatic Test Lab'
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                    required={isStatusTransferred}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'توضیحات تکمیلی وضعیت' : 'Additional Status Notes'}
                  </label>
                  <input
                    type="text"
                    value={changeNotes}
                    onChange={(e) => setChangeNotes(e.target.value)}
                    placeholder={isFa ? 'شماره رسید، پیمانکار شارژ یا توضیحات...' : 'Receipt number, contractor, notes...'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 flex flex-wrap justify-between items-center gap-2.5 shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            {initialData?.statusHistory && initialData.statusHistory.length > 0 && (
              <span>
                {isFa
                  ? `تعداد سوابق تغییر وضعیت ثبت‌شده: ${initialData.statusHistory.length} مورد`
                  : `Recorded status changes: ${initialData.statusHistory.length}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors cursor-pointer text-center"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              form="equipForm"
              type="submit"
              disabled={isSaving || Boolean(exactCodeDuplicate)}
              className="flex-1 sm:flex-initial px-5 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors cursor-pointer text-center"
            >
              {isSaving
                ? isFa
                  ? 'در حال ذخیره در پایگاه داده...'
                  : 'Saving...'
                : initialData
                ? isFa
                  ? 'بروزرسانی و ذخیره تغییرات'
                  : 'Update & Save'
                : isFa
                ? 'ثبت تجهیز جدید در سامانه'
                : 'Register Equipment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
