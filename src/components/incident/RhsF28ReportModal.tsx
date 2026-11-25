import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertOctagon,
  FileText,
  MapPin,
  Paperclip,
  PenTool,
  Save,
  Send,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  OshaSeverityLevel,
  RhsF28Data,
  RhsF68AttachmentItem,
  SafetyIncidentRecord,
  UserProfile,
} from '../../types';
import { getOrgSites, getSubUnitsForUnit } from '../../utils/orgHelper';
import { useUnifiedOrgUnits } from '../../utils/orgUnitsHelper';
import { findPersonnelByCode } from '../../utils/personnelHelper';
import { getCurrentJalaliDate } from '../../utils/incidentSupplementaryHelper';
import CentralPersonnelSelector from '../CentralPersonnelSelector';
import PersianDatePicker from '../common/PersianDatePicker';
import PersianTimePicker from '../common/PersianTimePicker';
import { DigitalSignaturePad } from '../referral/DigitalSignaturePad';
import { RhsF68EvidencePanel } from './RhsF68EvidencePanel';
import { apiDb } from '../../services/apiDatabaseClient';
import { useFinalSubmit } from '../../context/FinalSubmitContext';

interface RhsF28ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  editingDraft?: SafetyIncidentRecord | null;
  onSaved: (record: SafetyIncidentRecord, isDraft: boolean) => void;
  isFa?: boolean;
}

export const RhsF28ReportModal: React.FC<RhsF28ReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  editingDraft,
  onSaved,
  isFa = true,
}) => {
  const { confirmFinalSubmit } = useFinalSubmit();
  const { units: unifiedOrgUnits } = useUnifiedOrgUnits();
  const departmentList = useMemo(
    () => Array.from(new Set(unifiedOrgUnits.map((u) => u.name).filter(Boolean))),
    [unifiedOrgUnits]
  );
  const companySites = useMemo(() => getOrgSites(), []);

  const [submitting, setSubmitting] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState<string>('');

  // Header & Reporter fields
  const [reportDate, setReportDate] = useState<string>(() => getCurrentJalaliDate());
  const [reporterPersonnelCode, setReporterPersonnelCode] = useState<string>('');
  const [reporterName, setReporterName] = useState<string>('');
  const [department, setDepartment] = useState<string>('');

  // Observation & Location fields
  const [observationDate, setObservationDate] = useState<string>(() => getCurrentJalaliDate());
  const [observationTime, setObservationTime] = useState<string>('10:00');
  const [locationSite, setLocationSite] = useState<string>('');
  const [exactLocation, setExactLocation] = useState<string>('');
  const [isIncidentEvent, setIsIncidentEvent] = useState<boolean>(true);

  // Injured person specs
  const [injuredPersonCode, setInjuredPersonCode] = useState<string>('');
  const [injuredPersonName, setInjuredPersonName] = useState<string>('');
  const [injuredPersonJobTitle, setInjuredPersonJobTitle] = useState<string>('');
  const [injuredBodyPart, setInjuredBodyPart] = useState<string>('');

  // OSHA severity compatibility (optional metadata)
  const [severity, setSeverity] = useState<OshaSeverityLevel>('Minor / First Aid');
  const [isOshaRecordable, setIsOshaRecordable] = useState<boolean>(false);
  const [lostDays, setLostDays] = useState<number>(0);

  // Narrative sections matching RHS-F28 Rev.01
  const [description, setDescription] = useState<string>('');
  const [damagesOrInjuries, setDamagesOrInjuries] = useState<string>('');
  const [actionsTaken, setActionsTaken] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string>('');
  const [otherNotes, setOtherNotes] = useState<string>('');

  // Evidence & Signature
  const [attachments, setAttachments] = useState<RhsF68AttachmentItem[]>([]);
  const [reporterSignature, setReporterSignature] = useState<string>('');

  const subUnitsForSelectedDept = useMemo(() => getSubUnitsForUnit(department), [department]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingDraft) {
      const f28 = editingDraft.rhsF28;
      setGeneratedNumber(editingDraft.reportNumber);
      setReportDate(f28?.reportDate || editingDraft.reportDate || editingDraft.createdDate || getCurrentJalaliDate());
      setReporterPersonnelCode(f28?.reporterPersonnelCode || editingDraft.reporterPersonnelCode || '');
      setReporterName(f28?.reporterName || editingDraft.reporterName || '');
      setDepartment(f28?.department || editingDraft.department || '');
      setObservationDate(f28?.observationDate || editingDraft.eventDate || getCurrentJalaliDate());
      setObservationTime(f28?.observationTime || editingDraft.eventTime || '10:00');
      setLocationSite(f28?.locationSite || editingDraft.locationSite || '');
      setExactLocation(f28?.exactLocation || editingDraft.exactLocation || '');
      setIsIncidentEvent(f28?.isIncidentEvent !== undefined ? Boolean(f28.isIncidentEvent) : true);
      setInjuredPersonCode(f28?.injuredPersonCode || editingDraft.injuredPersonCode || '');
      setInjuredPersonName(f28?.injuredPersonName || editingDraft.injuredPersonName || '');
      setInjuredPersonJobTitle(f28?.injuredPersonJobTitle || '');
      setInjuredBodyPart(f28?.injuredBodyPart || '');
      setSeverity(editingDraft.severity || 'Minor / First Aid');
      setIsOshaRecordable(Boolean(editingDraft.isOshaRecordable));
      setLostDays(Number(editingDraft.lostDays || 0));
      setDescription(f28?.description || editingDraft.description || '');
      setDamagesOrInjuries(f28?.damagesOrInjuries || '');
      setActionsTaken(f28?.actionsTaken || editingDraft.immediateActionTaken || '');
      setRecommendations(f28?.recommendations || '');
      setOtherNotes(f28?.otherNotes || '');
      setAttachments(Array.isArray(f28?.attachments) ? f28.attachments : []);
      setReporterSignature(f28?.reporterSignature || '');
    } else {
      const today = getCurrentJalaliDate();
      const matched = currentUser?.personnelNumber
        ? findPersonnelByCode(currentUser.personnelNumber)
        : undefined;
      setReportDate(today);
      setReporterPersonnelCode(
        matched?.effectiveCode || matched?.personnelCode || currentUser?.personnelNumber || ''
      );
      setReporterName(matched?.fullName || currentUser?.fullName || currentUser?.username || '');
      setDepartment(matched?.unit || matched?.department || '');
      setObservationDate(today);
      const now = new Date();
      setObservationTime(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      );
      setLocationSite(matched?.subUnit || matched?.unit || '');
      setExactLocation('');
      setIsIncidentEvent(true);
      setInjuredPersonCode('');
      setInjuredPersonName('');
      setInjuredPersonJobTitle('');
      setInjuredBodyPart('');
      setSeverity('Minor / First Aid');
      setIsOshaRecordable(false);
      setLostDays(0);
      setDescription('');
      setDamagesOrInjuries('');
      setActionsTaken('');
      setRecommendations('');
      setOtherNotes('');
      setAttachments([]);
      setReporterSignature('');
      setGeneratedNumber('');
      apiDb
        .getNextIncidentNumber(today, 'RHS-F28')
        .then((num) => {
          if (num) setGeneratedNumber(num);
        })
        .catch(() => {});
    }
  }, [isOpen, editingDraft, currentUser]);

  if (!isOpen) return null;

  const handleSelectReporter = (person: any) => {
    if (!person) {
      setReporterPersonnelCode('');
      return;
    }
    setReporterPersonnelCode(person.effectiveCode || person.personnelCode || '');
    if (person.fullName) setReporterName(person.fullName);
    if (person.unit || person.department) setDepartment(person.unit || person.department);
    if (person.subUnit && !locationSite) setLocationSite(person.subUnit);
  };

  const handleSelectInjured = (person: any) => {
    if (!person) {
      setInjuredPersonCode('');
      return;
    }
    setInjuredPersonCode(person.effectiveCode || person.personnelCode || '');
    if (person.fullName) setInjuredPersonName(person.fullName);
    if (person.jobTitle || person.position) setInjuredPersonJobTitle(person.jobTitle || person.position);
  };

  const buildPayload = (isDraft: boolean) => {
    const today = getCurrentJalaliDate();
    const cleanDesc = description.trim();
    const cleanLoc = locationSite.trim() || department.trim() || 'محوطه کارخانه';
    const derivedTitle =
      cleanDesc.slice(0, 90) ||
      (isDraft ? 'پیش‌نویس گزارش حادثه / رویداد (RHS-F28)' : `گزارش حادثه / رویداد — ${cleanLoc}`);

    const rhsF28: RhsF28Data = {
      formCode: 'RHS-F28 Rev.01',
      reportDate: reportDate || today,
      reporterName: reporterName.trim() || currentUser?.fullName || 'گزارش‌دهنده',
      reporterPersonnelCode: reporterPersonnelCode.trim(),
      department: department.trim(),
      observationDate: observationDate || today,
      observationTime: observationTime || '10:00',
      locationSite: cleanLoc,
      exactLocation: exactLocation.trim(),
      isIncidentEvent,
      injuredPersonName: injuredPersonName.trim(),
      injuredPersonCode: injuredPersonCode.trim(),
      injuredPersonJobTitle: injuredPersonJobTitle.trim(),
      injuredBodyPart: injuredBodyPart.trim(),
      description: cleanDesc || derivedTitle,
      damagesOrInjuries: damagesOrInjuries.trim(),
      actionsTaken: actionsTaken.trim(),
      recommendations: recommendations.trim(),
      otherNotes: otherNotes.trim(),
      attachments,
      reporterSignature,
      reporterSignedDate: reporterSignature ? today : editingDraft?.rhsF28?.reporterSignedDate || '',
      auditHistory: editingDraft?.rhsF28?.auditHistory || [],
    };

    return {
      ...(editingDraft?.id ? { id: Number(editingDraft.id) || editingDraft.id } : {}),
      ...(editingDraft?.version !== undefined ? { expectedVersion: editingDraft.version } : {}),
      formVariant: 'RHS-F28' as const,
      reportNumber: generatedNumber || editingDraft?.reportNumber || undefined,
      reportDate: rhsF28.reportDate,
      category: 'Incident',
      categoryFa: 'حادثه / رویداد',
      incidentType: 'INCIDENT',
      title: derivedTitle,
      eventDate: rhsF28.observationDate,
      incidentDate: rhsF28.observationDate,
      eventTime: rhsF28.observationTime,
      incidentTime: rhsF28.observationTime,
      locationSite: rhsF28.locationSite,
      location: rhsF28.locationSite,
      exactLocation: rhsF28.exactLocation,
      department: rhsF28.department,
      reporterPersonnelCode: rhsF28.reporterPersonnelCode,
      reporterName: rhsF28.reporterName,
      reporterRole: currentUser?.role || 'User',
      injuredPersonName: rhsF28.injuredPersonName,
      injuredPersonCode: rhsF28.injuredPersonCode,
      severity,
      isOshaRecordable,
      lostDays: Number(lostDays || 0),
      lostWorkDays: Number(lostDays || 0),
      description: rhsF28.description,
      immediateActions: rhsF28.actionsTaken,
      immediateActionTaken: rhsF28.actionsTaken,
      attachedFileIds: attachments.map((a) => a.fileId).filter(Boolean),
      isDraft,
      submitForReview: !isDraft,
      rhsF28,
    };
  };

  const handleSave = async (isDraft: boolean) => {
    if (!isDraft) {
      if (!locationSite.trim() && !department.trim()) {
        toast.error(isFa ? 'تعیین مکان بروز یا واحد سازمانی الزامی است.' : 'Location is required.');
        return;
      }
      if (!description.trim()) {
        toast.error(isFa ? 'تکمیل بخش «شرح مورد» برای ثبت نهایی الزامی است.' : 'Description is required.');
        return;
      }
    }

    const executePersist = async () => {
      setSubmitting(true);
      try {
        const payload = buildPayload(isDraft);
        const saved = editingDraft?.id
          ? await apiDb.updateIncident(editingDraft.reportNumber || editingDraft.id, payload)
          : await apiDb.saveIncident(payload);

        toast.success(
          isDraft
            ? isFa
              ? 'پیش‌نویس گزارش حادثه / رویداد (RHS-F28) با موفقیت ذخیره شد.'
              : 'Draft saved.'
            : isFa
            ? `گزارش حادثه / رویداد با کد ${saved?.reportNumber || generatedNumber} ثبت و به رئیس مرکز HSE ارسال شد.`
            : 'Report submitted.'
        );
        onSaved(saved, isDraft);
        onClose();
      } catch (err: any) {
        toast.error(err?.message || (isFa ? 'خطا در ذخیره‌سازی گزارش RHS-F28' : 'Failed to save RHS-F28'));
      } finally {
        setSubmitting(false);
      }
    };

    if (isDraft) {
      await executePersist();
    } else {
      confirmFinalSubmit({
        title: isFa ? 'ثبت نهایی گزارش حادثه / رویداد (RHS-F28)' : 'Submit RHS-F28 Incident Report',
        message: isFa
          ? `گزارش شماره ${generatedNumber || 'جدید'} پس از ثبت به کارتابل رئیس مرکز ایمنی، بهداشت و محیط زیست ارسال می‌شود. آیا از ثبت نهایی اطمینان دارید؟`
          : 'This report will be sent to the HSE Center Head for review and signature.',
        isFa,
        onConfirm: executePersist,
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99998] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-400/30 font-mono text-[10px] font-black">
                  RHS - F28 - Rev 01
                </span>
                {generatedNumber && (
                  <span className="px-2 py-0.5 rounded bg-white/10 text-slate-100 font-mono text-[11px] font-bold tabular-nums">
                    {generatedNumber}
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-black text-white mt-0.5 truncate">
                {editingDraft
                  ? isFa
                    ? 'ویرایش و تکمیل گزارش حادثه / رویداد (پتروشیمی رجال)'
                    : 'Edit RHS-F28 Incident Report'
                  : isFa
                  ? 'ثبت گزارش حادثه / رویداد (فرم رسمی پتروشیمی رجال)'
                  : 'New Incident / Event Report (RHS-F28)'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Section 1: Report Meta & Reporter */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <UserCheck className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa ? '۱. مشخصات ثبت و گزارش‌دهنده' : '1. Report & Reporter Info'}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'شماره گزارش:' : 'Report No:'}
                </label>
                <input
                  type="text"
                  readOnly
                  value={generatedNumber || 'در حال تخصیص خودکار...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-mono font-black text-slate-700 dark:text-slate-200 tabular-nums"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'تاریخ گزارش:' : 'Report Date:'}
                </label>
                <PersianDatePicker
                  value={reportDate}
                  onChange={setReportDate}
                  isFa={isFa}
                  placeholder="۱۴۰۵/۰۱/۰۱"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'شماره پرسنلی گزارش‌دهنده:' : 'Personnel Code:'}
                </label>
                <input
                  type="text"
                  value={reporterPersonnelCode}
                  onChange={(e) => setReporterPersonnelCode(e.target.value)}
                  placeholder="کد پرسنلی"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'واحد سازمانی:' : 'Org Unit:'}
                </label>
                <input
                  type="text"
                  list="rhs-f28-dept-options"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="واحد سازمانی..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100"
                />
                <datalist id="rhs-f28-dept-options">
                  {departmentList.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'انتخاب سریع گزارش‌دهنده از پرسنل:' : 'Select Reporter:'}
                </label>
                <CentralPersonnelSelector
                  selectedPersonnelCode={reporterPersonnelCode}
                  onSelectPersonnel={(person) => handleSelectReporter(person)}
                  isFa={isFa}
                  placeholder={isFa ? 'جستجوی نام یا کد پرسنلی گزارش‌دهنده...' : 'Search reporter...'}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'نام و نام خانوادگی گزارش‌دهنده:' : 'Reporter Name:'}
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="نام و نام خانوادگی..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Observation Time, Location & Event Checkbox */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isFa ? '۲. زمان مشاهده، مکان بروز و نوع رویداد' : '2. Observation Time & Location'}
                </h3>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 font-black">
                <input
                  type="checkbox"
                  checked={isIncidentEvent}
                  onChange={(e) => setIsIncidentEvent(e.target.checked)}
                  className="w-4 h-4 accent-rose-600 rounded"
                />
                <span>{isFa ? 'رویداد (حادثه)' : 'Incident / Event'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'تاریخ مشاهده / وقوع:' : 'Observation Date:'}
                </label>
                <PersianDatePicker
                  value={observationDate}
                  onChange={setObservationDate}
                  isFa={isFa}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'ساعت مشاهده:' : 'Observation Time:'}
                </label>
                <PersianTimePicker
                  value={observationTime}
                  onChange={setObservationTime}
                  isFa={isFa}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'مکان بروز (واحد / سایت): *' : 'Location Site: *'}
                </label>
                <input
                  type="text"
                  list="rhs-f28-location-list"
                  value={locationSite}
                  onChange={(e) => setLocationSite(e.target.value)}
                  placeholder="محل / سایت / کارگاه..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100"
                />
                <datalist id="rhs-f28-location-list">
                  {Array.from(new Set([...subUnitsForSelectedDept, ...companySites])).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'جزئیات نقطه / تجهیز (اختیاری):' : 'Exact Point:'}
                </label>
                <input
                  type="text"
                  value={exactLocation}
                  onChange={(e) => setExactLocation(e.target.value)}
                  placeholder="پلاک تجهیز، طبقه، محوطه..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Injured Person Specs */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isFa ? '۳. مشخصات مصدوم (در صورت وجود آسیب‌دیدگی)' : '3. Injured Person Details'}
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                {isFa ? 'در حوادث بدون مصدوم می‌تواند خالی بماند' : 'Optional if no injury'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'انتخاب مصدوم از پرسنل:' : 'Select Injured Employee:'}
                </label>
                <CentralPersonnelSelector
                  selectedPersonnelCode={injuredPersonCode}
                  onSelectPersonnel={(person) => handleSelectInjured(person)}
                  isFa={isFa}
                  placeholder="انتخاب پرسنل..."
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'نام و نام خانوادگی مصدوم:' : 'Injured Person Name:'}
                </label>
                <input
                  type="text"
                  value={injuredPersonName}
                  onChange={(e) => setInjuredPersonName(e.target.value)}
                  placeholder="نام و نام خانوادگی (یا پیمانکار)..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'شغل مصدوم:' : 'Injured Job Title:'}
                </label>
                <input
                  type="text"
                  value={injuredPersonJobTitle}
                  onChange={(e) => setInjuredPersonJobTitle(e.target.value)}
                  placeholder="عنوان شغل / تخصص..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'عضو حادثه‌دیده:' : 'Injured Body Part:'}
                </label>
                <input
                  type="text"
                  value={injuredBodyPart}
                  onChange={(e) => setInjuredBodyPart(e.target.value)}
                  placeholder="دست راست، چشم، کمر..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 font-bold text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Compact OSHA Severity row for safety pyramid / KPI accuracy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'سطح شدت حادثه (جهت تحلیل آماری):' : 'Severity Classification:'}
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as OshaSeverityLevel)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                >
                  <option value="Minor / First Aid">{isFa ? 'جزئی / کمک اولیه (FAC)' : 'Minor / First Aid'}</option>
                  <option value="Moderate / Medical Treatment">{isFa ? 'متوسط / درمان پزشکی (MTC)' : 'Medical Treatment'}</option>
                  <option value="High / Restricted Work">{isFa ? 'شدید / کار محدود (RWC)' : 'Restricted Work'}</option>
                  <option value="Critical / Lost Time (LTI)">{isFa ? 'بحرانی / اتلاف وقت (LTI)' : 'Lost Time (LTI)'}</option>
                  <option value="Fatality">{isFa ? 'فوتی (Fatality)' : 'Fatality'}</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  {isFa ? 'روزهای کاری از دست رفته:' : 'Lost Work Days:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={lostDays}
                  onChange={(e) => setLostDays(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold tabular-nums"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={isOshaRecordable}
                    onChange={(e) => setIsOshaRecordable(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded"
                  />
                  <span>{isFa ? 'حادثه قابل ثبت در آمار OSHA 300' : 'OSHA Recordable'}</span>
                </label>
              </div>
            </div>
          </section>

          {/* Section 4: RHS-F28 Narrative Boxes */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <FileText className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa ? '۴. شرح واقعه، خسارات، اقدامات و توصیه‌های پیشگیرانه' : '4. Incident Narratives'}
              </h3>
            </div>

            <div>
              <label className="block font-black text-slate-800 dark:text-slate-100 mb-1">
                {isFa ? 'شرح مورد: *' : 'Incident Description: *'}
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="شرح دقیق نحوه وقوع حادثه / رویداد، شرایط محیطی و توالی اتفاقات..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-black text-slate-800 dark:text-slate-100 mb-1">
                {isFa ? 'خسارات وارده / آسیب به فرد(افراد):' : 'Damages / Personal Injuries:'}
              </label>
              <textarea
                rows={3}
                value={damagesOrInjuries}
                onChange={(e) => setDamagesOrInjuries(e.target.value)}
                placeholder="نوع و میزان صدمات بدنی به افراد و یا خسارات تجهیزاتی، تولیدی و زیست‌محیطی..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-black text-slate-800 dark:text-slate-100 mb-1">
                {isFa ? 'شرح اقدامات انجام شده:' : 'Actions Taken:'}
              </label>
              <textarea
                rows={3}
                value={actionsTaken}
                onChange={(e) => setActionsTaken(e.target.value)}
                placeholder="اقدامات امدادی، درمانی، ایمن‌سازی محل، قطع انرژی یا مهار اولیه انجام‌شده..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-black text-slate-800 dark:text-slate-100 mb-1">
                {isFa
                  ? 'توصیه برای رفع و اصلاح / پیشگیری از بروز مجدد مورد:'
                  : 'Corrective & Preventive Recommendations:'}
              </label>
              <textarea
                rows={3}
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="پیشنهادات فنی، مدیریتی یا اجرایی جهت رفع ریشه‌ای مشکل و جلوگیری از تکرار..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-black text-slate-800 dark:text-slate-100 mb-1">
                {isFa ? 'سایر توضیحات:' : 'Other Notes:'}
              </label>
              <textarea
                rows={2}
                value={otherNotes}
                onChange={(e) => setOtherNotes(e.target.value)}
                placeholder="توضیحات تکمیلی، اسامی شاهدان یا نکات مرتبط..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </section>

          {/* Section 5: Attachments */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <Paperclip className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa ? '۵. مستندات و پیوست‌ها' : '5. Attachments'}
              </h3>
            </div>
            <RhsF68EvidencePanel
              entityId={generatedNumber || editingDraft?.reportNumber || 'DRAFT-RHS-F28'}
              attachments={attachments}
              onChange={setAttachments}
              isFa={isFa}
            />
          </section>

          {/* Section 6: Reporter Signature */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <PenTool className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isFa ? '۶. امضای گزارش‌دهنده' : '6. Reporter Signature'}
              </h3>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-2">
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {isFa
                  ? 'امضای دیجیتال ثبت‌شده مستقیماً در بخش «گزارش‌دهنده» فرم چاپی رسمی RHS-F28 درج می‌شود.'
                  : 'Signature appears in the printed RHS-F28 form.'}
              </p>
              <DigitalSignaturePad
                initialSignature={reporterSignature}
                onSave={setReporterSignature}
                onClear={() => setReporterSignature('')}
                isFa={isFa}
                signerTarget={currentUser}
              />
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            {isFa ? 'انصراف' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(true)}
              className="px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isFa ? 'ذخیره پیش‌نویس' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSave(false)}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {submitting
                  ? isFa
                    ? 'در حال ثبت...'
                    : 'Submitting...'
                  : isFa
                  ? 'ثبت و ارسال به رئیس مرکز HSE'
                  : 'Submit to HSE Center Head'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
