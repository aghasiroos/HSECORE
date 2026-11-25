import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Info,
  MapPin,
  Paperclip,
  PenTool,
  Plus,
  Save,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  AnomalyTypeFa,
  RhsF68AttachmentItem,
  RhsF68InvolvedPerson,
  SafetyIncidentRecord,
  UserProfile,
} from '../../types';
import {
  RHS_F68_REPORT_TYPES,
  RhsF68ReportType,
  createDefaultRhsF68Data,
} from '../../utils/rhsF68Config';
import {
  getJobsForUnitAndSubUnit,
  getOrgSites,
  getSubUnitsForUnit,
} from '../../utils/orgHelper';
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

interface RhsF68ReportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  editingDraft?: SafetyIncidentRecord | null;
  onSaved: (record: SafetyIncidentRecord, isDraft: boolean) => void;
  isFa?: boolean;
}

const WIZARD_STEPS = [
  { id: 1, titleFa: 'نوع گزارش و گزارش‌دهنده', icon: UserCheck },
  { id: 2, titleFa: 'مشخصات رویداد و افراد مرتبط', icon: MapPin },
  { id: 3, titleFa: 'شواهد و مستندات', icon: Paperclip },
  { id: 4, titleFa: 'امضا و ارسال نهایی', icon: PenTool },
];

export const RhsF68ReportWizardModal: React.FC<RhsF68ReportWizardModalProps> = ({
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

  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [generatedNumber, setGeneratedNumber] = useState<string>('');

  // Form fields
  const [reportType, setReportType] = useState<RhsF68ReportType>('Unsafe Act');
  const [reportDate, setReportDate] = useState<string>(() => getCurrentJalaliDate());
  const [reporterPersonnelCode, setReporterPersonnelCode] = useState<string>('');
  const [reporterName, setReporterName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [reporterJobTitle, setReporterJobTitle] = useState<string>('');

  const [title, setTitle] = useState<string>('');
  const [locationSite, setLocationSite] = useState<string>('');
  const [exactLocation, setExactLocation] = useState<string>('');
  const [eventDate, setEventDate] = useState<string>(() => getCurrentJalaliDate());
  const [eventTime, setEventTime] = useState<string>('10:00');
  const [description, setDescription] = useState<string>('');
  const [immediateActionTaken, setImmediateActionTaken] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string>('');

  const [involvedPersonnel, setInvolvedPersonnel] = useState<RhsF68InvolvedPerson[]>([]);
  const [manualPersonOpen, setManualPersonOpen] = useState(false);
  const [manualPerson, setManualPerson] = useState({
    fullName: '',
    personnelCode: '',
    company: '',
    jobTitle: '',
    isContractor: true,
    roleInEvent: '',
  });

  const [attachments, setAttachments] = useState<RhsF68AttachmentItem[]>([]);
  const [reporterSignature, setReporterSignature] = useState<string>('');
  const [referTargetType, setReferTargetType] = useState<'HSE_HEAD' | 'HSE_EXPERT'>('HSE_HEAD');
  const [directExpertCode, setDirectExpertCode] = useState<string>('');
  const [directExpertName, setDirectExpertName] = useState<string>('');
  const [directExpertJobTitle, setDirectExpertJobTitle] = useState<string>('');

  const subUnitsForSelectedDept = useMemo(() => getSubUnitsForUnit(department), [department]);
  const jobTitlesForSelectedDept = useMemo(
    () => getJobsForUnitAndSubUnit(department, locationSite),
    [department, locationSite]
  );
  const activeTypeMeta = useMemo(
    () => RHS_F68_REPORT_TYPES.find((t) => t.value === reportType) || RHS_F68_REPORT_TYPES[0],
    [reportType]
  );

  // Initialize state when modal opens (new or editingDraft)
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);

    if (editingDraft) {
      const cat: RhsF68ReportType =
        editingDraft.category === 'Unsafe Condition'
          ? 'Unsafe Condition'
          : editingDraft.category === 'Near Miss'
          ? 'Near Miss'
          : 'Unsafe Act';
      const rhs = editingDraft.rhsF68;
      setReportType(cat);
      setGeneratedNumber(editingDraft.reportNumber);
      setReportDate(rhs?.reportDate || editingDraft.createdDate || getCurrentJalaliDate());
      setReporterPersonnelCode(editingDraft.reporterPersonnelCode || '');
      setReporterName(editingDraft.reporterName || '');
      setCompanyName(rhs?.companyName || editingDraft.companyName || '');
      setDepartment(editingDraft.department || '');
      setReporterJobTitle(rhs?.reporterJobTitle || editingDraft.reporterJobTitle || '');
      setTitle(editingDraft.title || '');
      setLocationSite(editingDraft.locationSite || '');
      setExactLocation(rhs?.exactLocation || editingDraft.exactLocation || '');
      setEventDate(editingDraft.eventDate || getCurrentJalaliDate());
      setEventTime(editingDraft.eventTime || '10:00');
      setDescription(editingDraft.description || '');
      setImmediateActionTaken(editingDraft.immediateActionTaken || '');
      setSuggestions(rhs?.suggestions || '');
      setInvolvedPersonnel(rhs?.involvedPersonnel || []);
      setAttachments(rhs?.attachments || []);
      setReporterSignature(rhs?.reporterSignature || '');
      setReferTargetType(rhs?.referTargetType === 'HSE_EXPERT' ? 'HSE_EXPERT' : 'HSE_HEAD');
      setDirectExpertCode(rhs?.hseUnitReview?.assignedExpertCode || '');
      setDirectExpertName(rhs?.hseUnitReview?.assignedExpertName || '');
      setDirectExpertJobTitle(rhs?.hseUnitReview?.assignedExpertJobTitle || '');
    } else {
      const today = getCurrentJalaliDate();
      setReportType('Unsafe Act');
      setReportDate(today);
      setEventDate(today);
      setEventTime(
        new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
      );

      // Auto-fill current user from personnel directory
      const matched = currentUser?.personnelNumber
        ? findPersonnelByCode(currentUser.personnelNumber)
        : undefined;
      setReporterPersonnelCode(
        matched?.effectiveCode || matched?.personnelCode || currentUser?.personnelNumber || ''
      );
      setReporterName(matched?.fullName || currentUser?.fullName || currentUser?.username || '');
      setCompanyName(matched?.workplace || companySites[0] || '');
      setDepartment(matched?.unit || matched?.department || '');
      setReporterJobTitle(matched?.jobTitle || matched?.position || currentUser?.jobTitle || '');
      setTitle('');
      setLocationSite(matched?.subUnit || '');
      setExactLocation('');
      setDescription('');
      setImmediateActionTaken('');
      setSuggestions('');
      setInvolvedPersonnel([]);
      setAttachments([]);
      setReporterSignature('');
      setReferTargetType('HSE_HEAD');
      setDirectExpertCode('');
      setDirectExpertName('');
      setDirectExpertJobTitle('');

      apiDb
        .getNextIncidentNumber(today)
        .then((num) => {
          if (num) setGeneratedNumber(num);
        })
        .catch(() => {
          setGeneratedNumber(`RHS-F68-${today.slice(0, 4)}-001`);
        });
    }
  }, [isOpen, editingDraft]);

  if (!isOpen) return null;

  const handleReporterCodeLookup = (code: string) => {
    setReporterPersonnelCode(code);
    const trimmed = code.trim();
    if (!trimmed) return;
    const matched = findPersonnelByCode(trimmed);
    if (matched) {
      setReporterName(matched.fullName);
      if (matched.unit || matched.department) setDepartment(matched.unit || matched.department);
      if (matched.jobTitle || matched.position) setReporterJobTitle(matched.jobTitle || matched.position);
      if (matched.workplace) setCompanyName(matched.workplace);
    }
  };

  const handleAddInvolvedFromDirectory = (person: any) => {
    if (!person) return;
    const code = person.effectiveCode || person.personnelCode || '';
    const exists = involvedPersonnel.some(
      (p) => (code && p.personnelCode === code) || p.fullName === person.fullName
    );
    if (exists) {
      toast(isFa ? 'این فرد قبلاً به فهرست اضافه شده است.' : 'Already added.');
      return;
    }
    setInvolvedPersonnel((prev) => [
      ...prev,
      {
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        personnelCode: code,
        fullName: person.fullName || `${person.firstName} ${person.lastName}`.trim(),
        company: person.workplace || companyName || '',
        department: person.unit || person.department || '',
        jobTitle: person.jobTitle || person.position || '',
        isContractor: false,
      },
    ]);
  };

  const handleAddManualPerson = () => {
    if (!manualPerson.fullName.trim()) {
      toast.error(isFa ? 'نام و نام خانوادگی فرد الزامی است.' : 'Full name is required.');
      return;
    }
    setInvolvedPersonnel((prev) => [
      ...prev,
      {
        id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        personnelCode: manualPerson.personnelCode.trim(),
        fullName: manualPerson.fullName.trim(),
        company: manualPerson.company.trim() || companyName,
        jobTitle: manualPerson.jobTitle.trim(),
        isContractor: manualPerson.isContractor,
        roleInEvent: manualPerson.roleInEvent.trim(),
      },
    ]);
    setManualPerson({
      fullName: '',
      personnelCode: '',
      company: '',
      jobTitle: '',
      isContractor: true,
      roleInEvent: '',
    });
    setManualPersonOpen(false);
  };

  const validateForSubmit = (): string | null => {
    if (!reporterName.trim()) return isFa ? 'نام و نام خانوادگی گزارش‌دهنده الزامی است.' : 'Reporter name required.';
    if (!title.trim()) return isFa ? 'موضوع گزارش الزامی است.' : 'Subject is required.';
    if (!department.trim() && !locationSite.trim())
      return isFa ? 'تعیین واحد سازمانی یا محوطه الزامی است.' : 'Department or site is required.';
    if (!eventDate.trim()) return isFa ? 'تاریخ وقوع یا مشاهده الزامی است.' : 'Event date is required.';
    if (!description.trim()) return isFa ? 'شرح کامل رویداد الزامی است.' : 'Event description is required.';
    if (referTargetType === 'HSE_EXPERT' && !directExpertName.trim()) {
      return isFa
        ? 'در صورت انتخاب ارجاع مستقیم به کارشناس، تعیین کارشناس مسئول HSE الزامی است.'
        : 'Select an assigned HSE expert for direct referral.';
    }
    return null;
  };

  const buildPayload = (asDraft: boolean) => {
    const categoryFaMap: Record<RhsF68ReportType, AnomalyTypeFa> = {
      'Unsafe Act': 'عمل ناایمن',
      'Unsafe Condition': 'شرایط ناایمن',
      'Near Miss': 'شبه حادثه',
    };

    const existingRhs = editingDraft?.rhsF68 || createDefaultRhsF68Data(reportDate);
    const rhsF68 = {
      ...existingRhs,
      formCode: 'RHS-F68 Rev.01' as const,
      reportDate,
      companyName,
      reporterJobTitle,
      exactLocation,
      referTargetType,
      involvedPersonnel,
      suggestions,
      reporterSignature,
      reporterSignedDate: reporterSignature ? reportDate : '',
      attachments,
    };

    return {
      id: editingDraft?.id ? Number(editingDraft.id) || editingDraft.id : undefined,
      reportNumber: generatedNumber || editingDraft?.reportNumber || undefined,
      incidentNumber: generatedNumber || editingDraft?.reportNumber || undefined,
      category: reportType,
      categoryFa: categoryFaMap[reportType],
      incidentType:
        reportType === 'Unsafe Act'
          ? 'UNSAFE_ACT'
          : reportType === 'Unsafe Condition'
          ? 'UNSAFE_CONDITION'
          : 'NEAR_MISS',
      title: title.trim() || (asDraft ? 'پیش‌نویس گزارش RHS-F68' : ''),
      reportDate,
      eventDate,
      incidentDate: eventDate,
      eventTime,
      incidentTime: eventTime,
      companyName,
      department,
      locationSite: locationSite || department || 'محوطه کارخانه',
      location: locationSite || department || 'محوطه کارخانه',
      exactLocation,
      reporterPersonnelCode,
      reporterName: reporterName.trim(),
      reporterJobTitle,
      reporterRole: currentUser.role,
      description: description.trim() || title.trim() || 'پیش‌نویس',
      immediateActionTaken: immediateActionTaken.trim(),
      immediateActions: immediateActionTaken.trim(),
      attachedFileIds: attachments.map((a) => a.fileId),
      isDraft: asDraft,
      submitForReview: !asDraft,
      referTargetType,
      assignedExpertCode: referTargetType === 'HSE_EXPERT' ? directExpertCode : '',
      assignedExpertName: referTargetType === 'HSE_EXPERT' ? directExpertName : '',
      assignedExpertJobTitle: referTargetType === 'HSE_EXPERT' ? directExpertJobTitle : '',
      workflowStage: asDraft
        ? 'DRAFT'
        : referTargetType === 'HSE_EXPERT'
        ? 'HSE_EXPERT_REVIEW'
        : 'HSE_HEAD_TRIAGE',
      status: 'Submitted' as const,
      expectedVersion: editingDraft?.version,
      rhsF68,
    };
  };

  const executePersist = async (asDraft: boolean) => {
    if (!asDraft) {
      const err = validateForSubmit();
      if (err) {
        toast.error(err);
        return;
      }
    } else if (!title.trim() && !description.trim()) {
      toast.error(isFa ? 'برای ذخیره پیش‌نویس حداقل موضوع یا شرح مختصر را وارد کنید.' : 'Enter subject or description.');
      return;
    }

    const doSave = async () => {
      setSubmitting(true);
      try {
        const payload = buildPayload(asDraft);
        const saved = editingDraft?.id
          ? await apiDb.updateIncident(editingDraft.reportNumber || editingDraft.id, payload)
          : await apiDb.saveIncident(payload);

        toast.success(
          asDraft
            ? isFa
              ? 'پیش‌نویس با موفقیت در پایگاه داده ذخیره شد.'
              : 'Draft saved.'
            : referTargetType === 'HSE_EXPERT'
            ? isFa
              ? `گزارش ثبت و مستقیم به کارشناس HSE (${directExpertName}) ارجاع شد.`
              : 'Report referred directly to HSE expert.'
            : isFa
            ? 'گزارش با موفقیت ثبت و به کارتابل رئیس HSE ارجاع شد.'
            : 'Report submitted to HSE Head.'
        );
        onSaved(saved, asDraft);
        onClose();
      } catch (err: any) {
        toast.error(err?.message || (isFa ? 'خطا در ذخیره‌سازی گزارش' : 'Save error'));
      } finally {
        setSubmitting(false);
      }
    };

    if (asDraft) {
      await doSave();
    } else {
      confirmFinalSubmit({
        isFa,
        onConfirm: doSave,
      });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        dir={isFa ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-rose-600 text-[10px] font-mono font-black tracking-wide">
                RHS – F68. REV.01
              </span>
              <span className="px-2 py-0.5 rounded bg-white/10 text-slate-200 text-[11px] font-mono tabular-nums font-bold">
                {generatedNumber || '...'}
              </span>
              {editingDraft?.isDraft && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                  {isFa ? 'ویرایش پیش‌نویس' : 'Editing Draft'}
                </span>
              )}
            </div>
            <h2 className="text-base font-black mt-1">
              {isFa
                ? 'فرم ثبت گزارش رفتار ناایمن / شرایط ناایمن / شبه‌حادثه'
                : 'Unsafe Act / Unsafe Condition / Near Miss Report Form'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Stepper */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          {WIZARD_STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const completed = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition text-right cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-500'
                    : completed
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono shrink-0 ${
                    active
                      ? 'bg-white/20 text-white'
                      : completed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {completed ? <Check className="w-3 h-3" /> : s.id}
                </span>
                <Icon className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
                <span className="truncate">{s.titleFa}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {step === 1 && (
            <div className="space-y-5">
              {/* Report Type Cards */}
              <div>
                <label className="block font-black text-slate-800 dark:text-slate-100 mb-2">
                  {isFa ? '۱. نوع گزارش را انتخاب کنید (الزامی):' : '1. Select Report Type:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {RHS_F68_REPORT_TYPES.map((t) => {
                    const selected = reportType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setReportType(t.value)}
                        className={`p-3.5 rounded-2xl border text-right transition cursor-pointer flex flex-col justify-between gap-2 ${
                          selected
                            ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30 ring-2 ring-rose-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 dark:text-slate-100 text-xs">
                            {t.labelFa}
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              selected
                                ? 'bg-rose-600 border-rose-600 text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {selected && <Check className="w-2.5 h-2.5" />}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {t.subtitleFa}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Context Guidance */}
                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-[11px] text-slate-700 dark:text-slate-300">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{activeTypeMeta.guidanceFa}</p>
                </div>
              </div>

              {/* Reporter Details (Connected to Central Personnel DB & Org Base Data) */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                  <span className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    {isFa ? 'مشخصات گزارش‌دهنده (متصل به بانک پرسنلی)' : 'Reporter Information'}
                  </span>
                  <div className="w-44">
                    <PersianDatePicker
                      value={reportDate}
                      onChange={setReportDate}
                      isFa={isFa}
                      placeholder={isFa ? 'تاریخ ثبت فرم' : 'Report Date'}
                    />
                  </div>
                </div>

                <CentralPersonnelSelector
                  label={isFa ? 'انتخاب سریع گزارش‌دهنده از اطلاعات پرسنل' : 'Search Reporter'}
                  selectedPersonnelCode={reporterPersonnelCode}
                  value={reporterName ? `${reporterName}${reporterPersonnelCode ? ` (${reporterPersonnelCode})` : ''}` : ''}
                  isFa={isFa}
                  onSelect={(person) => {
                    if (!person) return;
                    const code = person.effectiveCode || person.personnelCode || '';
                    setReporterPersonnelCode(code);
                    setReporterName(person.fullName || `${person.firstName} ${person.lastName}`.trim());
                    if (person.unit || person.department) setDepartment(person.unit || person.department);
                    if (person.jobTitle || person.position) setReporterJobTitle(person.jobTitle || person.position);
                    if (person.workplace) setCompanyName(person.workplace);
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'شماره پرسنلی' : 'Personnel Code'}
                    </label>
                    <input
                      type="text"
                      value={reporterPersonnelCode}
                      onChange={(e) => handleReporterCodeLookup(e.target.value)}
                      placeholder="کد پرسنلی..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'نام و نام خانوادگی *' : 'Full Name *'}
                    </label>
                    <input
                      type="text"
                      value={reporterName}
                      onChange={(e) => setReporterName(e.target.value)}
                      placeholder="نام کامل گزارش‌دهنده"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'شرکت (اطلاعات پایه)' : 'Company'}
                    </label>
                    <input
                      type="text"
                      list="rhs-f68-companies"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="نام شرکت / مجتمع..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                    <datalist id="rhs-f68-companies">
                      {companySites.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'واحد سازمانی گزارش‌دهنده *' : 'Organizational Unit *'}
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                    >
                      <option value="">{isFa ? '-- انتخاب واحد سازمانی --' : '-- Select Unit --'}</option>
                      {departmentList.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'عنوان شغلی (اطلاعات پایه مشاغل)' : 'Job Title'}
                    </label>
                    <input
                      type="text"
                      list="rhs-f68-jobs"
                      value={reporterJobTitle}
                      onChange={(e) => setReporterJobTitle(e.target.value)}
                      placeholder="مثال: تکنسین بهره‌برداری / اپراتور ایمنی..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                    <datalist id="rhs-f68-jobs">
                      {jobTitlesForSelectedDept.map((j) => (
                        <option key={j} value={j} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Subject & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'موضوع گزارش *' : 'Subject *'}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={activeTypeMeta.subjectPlaceholderFa}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'واحد / محوطه وقوع' : 'Area / Unit'}
                  </label>
                  <input
                    type="text"
                    list="rhs-f68-subunits"
                    value={locationSite}
                    onChange={(e) => setLocationSite(e.target.value)}
                    placeholder="انتخاب زیرواحد / محوطه..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                  <datalist id="rhs-f68-subunits">
                    {subUnitsForSelectedDept.map((su) => (
                      <option key={su} value={su} />
                    ))}
                    {departmentList.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'موقعیت دقیق وقوع' : 'Exact Location'}
                  </label>
                  <input
                    type="text"
                    value={exactLocation}
                    onChange={(e) => setExactLocation(e.target.value)}
                    placeholder="مثال: طبقه دوم رک لوله، کنار پمپ P-104B"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'تاریخ وقوع / مشاهده *' : 'Date Observed *'}
                  </label>
                  <PersianDatePicker
                    value={eventDate}
                    onChange={setEventDate}
                    isFa={isFa}
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'زمان وقوع / مشاهده' : 'Time Observed'}
                  </label>
                  <PersianTimePicker
                    value={eventTime}
                    onChange={setEventTime}
                    isFa={isFa}
                  />
                </div>
              </div>

              {/* Involved / Violating Personnel */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-rose-600" />
                      {activeTypeMeta.involvedTitleFa}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{activeTypeMeta.involvedHintFa}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualPersonOpen((v) => !v)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer hover:bg-slate-100"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isFa ? 'افزودن پیمانکار / شخص خارج از لیست' : 'Add Contractor / External'}</span>
                  </button>
                </div>

                <CentralPersonnelSelector
                  label={isFa ? 'جستجو و افزودن فرد از بانک اطلاعات پرسنلی' : 'Add from Personnel Directory'}
                  isFa={isFa}
                  onSelect={handleAddInvolvedFromDirectory}
                  placeholder={isFa ? 'نام، کد پرسنلی یا کد ملی فرد مرتبط را جستجو کنید...' : 'Search...'}
                />

                {manualPersonOpen && (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={manualPerson.fullName}
                      onChange={(e) => setManualPerson((p) => ({ ...p, fullName: e.target.value }))}
                      placeholder="نام و نام خانوادگی *"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                    />
                    <input
                      type="text"
                      value={manualPerson.company}
                      onChange={(e) => setManualPerson((p) => ({ ...p, company: e.target.value }))}
                      placeholder="شرکت / پیمانکار"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={manualPerson.jobTitle}
                        onChange={(e) => setManualPerson((p) => ({ ...p, jobTitle: e.target.value }))}
                        placeholder="سمت / شغل"
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddManualPerson}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {involvedPersonnel.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {involvedPersonnel.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-100">{p.fullName}</span>
                        {p.personnelCode && (
                          <span className="font-mono text-[10px] text-slate-500">({p.personnelCode})</span>
                        )}
                        {p.jobTitle && <span className="text-[10px] text-slate-500">• {p.jobTitle}</span>}
                        {p.company && <span className="text-[10px] text-indigo-600">• {p.company}</span>}
                        <button
                          type="button"
                          onClick={() =>
                            setInvolvedPersonnel((prev) => prev.filter((item) => item.id !== p.id))
                          }
                          className="text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Description, Immediate Action & Suggestions */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'شرح کامل رویداد / مشاهده *' : 'Event Description *'}
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={activeTypeMeta.descriptionPlaceholderFa}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'اقدام فوری انجام‌شده در صحنه (در صورت وجود)' : 'Immediate Action Taken'}
                    </label>
                    <textarea
                      rows={2}
                      value={immediateActionTaken}
                      onChange={(e) => setImmediateActionTaken(e.target.value)}
                      placeholder="مثال: توقف موقت کار، تذکر ایمنی و نصب نوار خطر..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {isFa ? 'پیشنهادات گزارش‌دهنده (طبق فرم RHS-F68)' : 'Suggestions'}
                    </label>
                    <textarea
                      rows={2}
                      value={suggestions}
                      onChange={(e) => setSuggestions(e.target.value)}
                      placeholder="پیشنهاد اصلاحی یا پیشگیرانه برای جلوگیری از تکرار..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                <strong className="block text-slate-900 dark:text-slate-100 mb-1">
                  {isFa ? 'مستندات، تصاویر و فیلم‌های شاهد' : 'Evidence & Supporting Documents'}
                </strong>
                <p className="text-[11px] text-slate-500">
                  {isFa
                    ? 'می‌توانید تصاویر صحنه، ویدیوهای کوتاه (MP4 / WebM / MOV) و مدارک تکمیلی را پیوست نمایید. تمام فایل‌ها با کد امنیتی بررسی و در پرونده نگهداری می‌شوند.'
                    : 'Attach site photos, short videos, or PDF/Office documents.'}
                </p>
              </div>

              <RhsF68EvidencePanel
                entityId={generatedNumber || editingDraft?.reportNumber || `RHS-F68-DRAFT`}
                attachments={attachments}
                onChange={setAttachments}
                isFa={isFa}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              {/* Summary Review Grid */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                <h4 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  {isFa ? 'بازبینی خلاصه گزارش پیش از ثبت' : 'Review Report Summary'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">نوع گزارش:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{activeTypeMeta.labelFa}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">گزارش‌دهنده:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{reporterName || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">واحد / محوطه:</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {department || '—'} {locationSite ? `(${locationSite})` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">تاریخ و ساعت وقوع:</span>
                    <strong className="font-mono text-slate-900 dark:text-slate-100">
                      {eventDate} - {eventTime}
                    </strong>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-slate-500 block">موضوع و شرح:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">{title || '—'}</p>
                  <p className="text-slate-600 dark:text-slate-400 mt-1">{description || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    افراد مرتبط ثبت‌شده: <strong className="font-mono">{involvedPersonnel.length}</strong>
                  </span>
                  <span>
                    فایل‌های پیوست: <strong className="font-mono">{attachments.length}</strong>
                  </span>
                </div>
              </div>

              {/* Referral Destination Selector */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-indigo-600" />
                    <span>{isFa ? 'مسیر ارجاع پس از ثبت گزارش' : 'Referral Target After Submission'}</span>
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {isFa ? 'اعلان و کارتابل مرحله بعد به‌صورت خودکار ارسال می‌شود' : 'Automatic inbox notification'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReferTargetType('HSE_HEAD')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-start gap-2.5 ${
                      referTargetType === 'HSE_HEAD'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        referTargetType === 'HSE_HEAD' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {referTargetType === 'HSE_HEAD' && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <div>
                      <div className="font-black text-slate-900 dark:text-slate-100">
                        {isFa ? 'ارجاع به رئیس واحد HSE (مسیر استاندارد)' : 'Refer to HSE Head (Standard)'}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {isFa
                          ? 'رئیس HSE وضعیت بازرسی و درخواست اقدام اصلاحی را تعیین و به کارشناس مسئول ارجاع می‌دهد.'
                          : 'HSE Head determines inspection need, CAPA request, and assigns an expert.'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReferTargetType('HSE_EXPERT')}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex items-start gap-2.5 ${
                      referTargetType === 'HSE_EXPERT'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        referTargetType === 'HSE_EXPERT' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                      }`}
                    >
                      {referTargetType === 'HSE_EXPERT' && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <div>
                      <div className="font-black text-slate-900 dark:text-slate-100">
                        {isFa ? 'ارجاع مستقیم به کارشناس مسئول HSE' : 'Direct Referral to HSE Expert'}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {isFa
                          ? 'ارسال مستقیم جهت تحلیل ۸ دسته عوامل رویداد، ارزیابی RPN و تعریف اقدام اصلاحی.'
                          : 'Send directly to an assigned HSE expert for factors, RPN & CAPA planning.'}
                      </p>
                    </div>
                  </button>
                </div>

                {referTargetType === 'HSE_EXPERT' && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <CentralPersonnelSelector
                      label={isFa ? 'انتخاب کارشناس مسئول HSE برای ارجاع مستقیم *' : 'Select HSE Expert *'}
                      selectedPersonnelCode={directExpertCode}
                      value={
                        directExpertName
                          ? `${directExpertName}${directExpertCode ? ` (${directExpertCode})` : ''}`
                          : ''
                      }
                      isFa={isFa}
                      onSelect={(person) => {
                        if (!person) return;
                        setDirectExpertCode(person.effectiveCode || person.personnelCode || '');
                        setDirectExpertName(person.fullName || `${person.firstName} ${person.lastName}`.trim());
                        setDirectExpertJobTitle(person.jobTitle || person.position || '');
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Reporter Digital Signature */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <DigitalSignaturePad
                  isFa={isFa}
                  initialSignature={reporterSignature}
                  onSave={(sig) => setReporterSignature(sig)}
                  onClear={() => setReporterSignature('')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
                <span>{isFa ? 'مرحله قبل' : 'Previous'}</span>
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={() => executePersist(true)}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isFa ? 'ذخیره پیش‌نویس' : 'Save Draft'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isFa ? 'مرحله بعد' : 'Next'}</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => executePersist(false)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {submitting
                    ? isFa
                      ? 'در حال ثبت...'
                      : 'Submitting...'
                    : referTargetType === 'HSE_EXPERT'
                    ? isFa
                      ? 'ثبت و ارجاع مستقیم به کارشناس HSE'
                      : 'Submit to HSE Expert'
                    : isFa
                    ? 'ثبت و ارسال به رئیس واحد HSE'
                    : 'Submit to HSE Head'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
