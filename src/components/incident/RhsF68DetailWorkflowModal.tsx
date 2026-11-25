import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calculator,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Paperclip,
  Plus,
  Printer,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  RhsF68AttachmentItem,
  RhsF68EventFactors,
  SafetyIncidentRecord,
  UserProfile,
} from '../../types';
import {
  DETECTION_SCALE_OPTIONS,
  PROBABILITY_SCALE_OPTIONS,
  RHS_F68_FACTOR_CATEGORIES,
  RHS_F68_REPORT_TYPES,
  SEVERITY_SCALE_OPTIONS,
  WORKFLOW_STAGE_META,
  computeRhsF68Rpn,
  createEmptyEventFactors,
  getCorrectiveOverdueInfo,
  getIncidentWorkflowStage,
} from '../../utils/rhsF68Config';
import { getCurrentJalaliDate } from '../../utils/incidentSupplementaryHelper';
import { useUnifiedOrgUnits } from '../../utils/orgUnitsHelper';
import { apiDb } from '../../services/apiDatabaseClient';
import CentralPersonnelSelector from '../CentralPersonnelSelector';
import PersianDatePicker from '../common/PersianDatePicker';
import { DigitalSignaturePad } from '../referral/DigitalSignaturePad';
import { RhsF68EvidencePanel } from './RhsF68EvidencePanel';
import { PrintDocumentSignaturesBox } from '../referral/PrintDocumentSignaturesBox';
import { handleVersionConflict } from '../common/ConflictResolutionModal';

interface RhsF68DetailWorkflowModalProps {
  incident: SafetyIncidentRecord | null;
  currentUser: UserProfile;
  onClose: () => void;
  onUpdated: (updated: SafetyIncidentRecord) => void;
  onEditDraft?: (record: SafetyIncidentRecord) => void;
  onOpenPrint: (record: SafetyIncidentRecord) => void;
  onOpenReferral: (record: SafetyIncidentRecord) => void;
  onOpenTracker: (record: SafetyIncidentRecord) => void;
  onOpenSupplementary?: (record: SafetyIncidentRecord) => void;
  onDelete?: (id: string) => void;
  isFa?: boolean;
}

export const RhsF68DetailWorkflowModal: React.FC<RhsF68DetailWorkflowModalProps> = ({
  incident,
  currentUser,
  onClose,
  onUpdated,
  onEditDraft,
  onOpenPrint,
  onOpenReferral,
  onOpenTracker,
  onOpenSupplementary,
  onDelete,
  isFa = true,
}) => {
  const { units: unifiedOrgUnits } = useUnifiedOrgUnits();
  const departmentList = useMemo(
    () => Array.from(new Set(unifiedOrgUnits.map((u) => u.name).filter(Boolean))),
    [unifiedOrgUnits]
  );

  const [activeTab, setActiveTab] = useState<'workflow' | 'evidence' | 'audit'>('workflow');
  const [saving, setSaving] = useState(false);

  // Role determinations (mirrored cleanly on backend RBAC)
  const roleUpper = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
  const isHseHead =
    ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'EXECUTIVEMANAGER'].includes(roleUpper) ||
    roleUpper.includes('ADMIN') ||
    Boolean(currentUser?.permissions?.Incidents?.approve);

  const isHseStaff =
    isHseHead ||
    ['SAFETYOFFICER', 'SAFETYINSPECTOR', 'FIREOFFICER'].includes(roleUpper) ||
    (currentUser?.jobTitle || '').toLowerCase().includes('hse') ||
    (currentUser?.jobTitle || '').includes('ایمنی') ||
    Boolean(currentUser?.permissions?.Incidents?.edit);

  // Stage 2 (HSE Head Triage) local form state
  const [inspectionStatus, setInspectionStatus] = useState<'INSPECTED' | 'NO_INSPECTION_NEEDED' | 'PENDING'>('INSPECTED');
  const [inspectionResult, setInspectionResult] = useState('');
  const [actionRequired, setActionRequired] = useState<boolean>(true);
  const [assignedExpertCode, setAssignedExpertCode] = useState('');
  const [assignedExpertName, setAssignedExpertName] = useState('');
  const [assignedExpertJobTitle, setAssignedExpertJobTitle] = useState('');
  const [hseHeadNotes, setHseHeadNotes] = useState('');
  const [hseHeadSignature, setHseHeadSignature] = useState('');

  // Stage 3 (HSE Expert Investigation: 8 factors + RPN + CAPA follow-up)
  const [eventFactors, setEventFactors] = useState<RhsF68EventFactors>(createEmptyEventFactors());
  const [customFactorInputs, setCustomFactorInputs] = useState<Record<string, string>>({});
  const [prob, setProb] = useState<number>(2);
  const [sev, setSev] = useState<number>(2);
  const [det, setDet] = useState<number>(2);

  const [correctiveActionNumber, setCorrectiveActionNumber] = useState('');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [letterNumber, setLetterNumber] = useState('');
  const [actionsTakenDescription, setActionsTakenDescription] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [responsibleUnit, setResponsibleUnit] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [responsiblePersonnelCode, setResponsiblePersonnelCode] = useState('');
  const [actionResults, setActionResults] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED'>('OPEN');
  const [expertSignature, setExpertSignature] = useState('');

  // Stage 4 (HSE Head Final Conclusion)
  const [conclusionNotes, setConclusionNotes] = useState('');
  const [finalDecision, setFinalDecision] = useState<'APPROVE_CLOSE' | 'RETURN_FOR_REVISION'>('APPROVE_CLOSE');
  const [finalHseHeadSignature, setFinalHseHeadSignature] = useState('');

  // Evidence state (fetched or hydrated)
  const [attachments, setAttachments] = useState<RhsF68AttachmentItem[]>([]);

  useEffect(() => {
    if (!incident) return;
    setActiveTab('workflow');
    const rhs = incident.rhsF68;
    const rev = rhs?.hseUnitReview;
    setInspectionStatus(rev?.inspectionStatus || 'INSPECTED');
    setInspectionResult(rev?.inspectionResult || '');
    setActionRequired(rev?.actionRequired !== undefined ? Boolean(rev.actionRequired) : true);
    setAssignedExpertCode(rev?.assignedExpertCode || '');
    setAssignedExpertName(rev?.assignedExpertName || '');
    setAssignedExpertJobTitle(rev?.assignedExpertJobTitle || '');
    setHseHeadNotes(rev?.hseHeadNotes || '');
    setHseHeadSignature(rev?.hseHeadSignature || '');

    setEventFactors(rhs?.eventFactors ? { ...createEmptyEventFactors(), ...rhs.eventFactors } : createEmptyEventFactors());
    const ra = rhs?.riskAssessment || incident.riskAssessment;
    setProb(ra?.probability || 2);
    setSev(ra?.severity || 2);
    setDet(ra?.detection || 2);

    const fu = rhs?.correctiveFollowUp;
    setCorrectiveActionNumber(fu?.correctiveActionNumber || '');
    setWorkOrderNumber(fu?.workOrderNumber || '');
    setLetterNumber(fu?.letterNumber || '');
    setActionsTakenDescription(fu?.actionsTakenDescription || '');
    setActionDate(fu?.actionDate || '');
    setDueDate(fu?.dueDate || '');
    setResponsibleUnit(fu?.responsibleUnit || incident.department || '');
    setResponsiblePerson(fu?.responsiblePerson || '');
    setResponsiblePersonnelCode(fu?.responsiblePersonnelCode || '');
    setActionResults(fu?.actionResults || '');
    setFollowUpStatus(fu?.followUpStatus || 'OPEN');
    setExpertSignature(fu?.expertSignature || '');

    setConclusionNotes(rhs?.finalConclusion?.conclusionNotes || '');
    setFinalDecision(
      rhs?.finalConclusion?.decision === 'RETURN_FOR_REVISION' ? 'RETURN_FOR_REVISION' : 'APPROVE_CLOSE'
    );
    setFinalHseHeadSignature(rhs?.finalConclusion?.finalHseHeadSignature || '');

    setAttachments(rhs?.attachments || []);
    // Also fetch server entity files to ensure any legacy or additional uploaded files appear
    apiDb
      .getEntityFiles('INCIDENT', incident.reportNumber)
      .then((files) => {
        if (Array.isArray(files) && files.length > 0) {
          setAttachments((prev) => {
            const map = new Map<string, RhsF68AttachmentItem>();
            prev.forEach((a) => map.set(a.fileId, a));
            files.forEach((f: any) => {
              if (f.fileId && !map.has(f.fileId)) {
                map.set(f.fileId, {
                  fileId: f.fileId,
                  originalName: f.originalName,
                  mimeType: f.mimeType,
                  fileSize: f.fileSize,
                  fileUrl: f.fileUrl,
                  uploadedAt: f.createdAt,
                  uploadedBy: f.uploadedBy,
                });
              }
            });
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});
  }, [incident]);

  const recommendedFactorKeys = useMemo(() => {
    const typeMeta = RHS_F68_REPORT_TYPES.find((t) => t.value === incident?.category);
    return new Set(typeMeta?.recommendedFactors || []);
  }, [incident?.category]);

  if (!incident) return null;

  const stage = getIncidentWorkflowStage(incident);
  const stageMeta = WORKFLOW_STAGE_META[stage];
  const overdueInfo = getCorrectiveOverdueInfo(incident);
  const liveRpn = computeRhsF68Rpn(prob, sev, det);
  const isClosed = stage === 'CLOSED';

  const isAssignedExpert =
    Boolean(assignedExpertCode && currentUser?.personnelNumber === assignedExpertCode) ||
    Boolean(
      assignedExpertName &&
        (currentUser?.fullName === assignedExpertName || currentUser?.username === assignedExpertName)
    );
  const canExecuteExpertStage = isHseStaff || isAssignedExpert;
  const isAssignedOfficer =
    Boolean(responsiblePersonnelCode && currentUser?.personnelNumber === responsiblePersonnelCode) ||
    Boolean(
      responsiblePerson &&
        (currentUser?.fullName === responsiblePerson || currentUser?.username === responsiblePerson)
    ) ||
    canExecuteExpertStage;
  const isReporter =
    Boolean(incident.reporterPersonnelCode && currentUser?.personnelNumber === incident.reporterPersonnelCode) ||
    Boolean(
      incident.reporterName &&
        (currentUser?.fullName === incident.reporterName || currentUser?.username === incident.reporterName)
    );

  // Strict active-stage & role-based editing locks (previous & future stages stay read-only)
  const canEditTriage = !isClosed && isHseHead && (stage === 'HSE_HEAD_TRIAGE' || stage === 'RETURNED');
  const canEditExpertPlan = !isClosed && canExecuteExpertStage && stage === 'HSE_EXPERT_REVIEW';
  const canEditActionResults = !isClosed && isAssignedOfficer && stage === 'ACTION_IN_PROGRESS';
  const canEditFinalConclusion = !isClosed && isHseHead && stage === 'HSE_FINAL_APPROVAL';

  const toggleFactorItem = (catKey: keyof RhsF68EventFactors, item: string) => {
    setEventFactors((prev) => {
      const curr = prev[catKey]?.selectedItems || [];
      const exists = curr.includes(item);
      return {
        ...prev,
        [catKey]: {
          ...prev[catKey],
          selectedItems: exists ? curr.filter((x) => x !== item) : [...curr, item],
        },
      };
    });
  };

  const addCustomFactorItem = (catKey: keyof RhsF68EventFactors) => {
    const val = (customFactorInputs[catKey] || '').trim();
    if (!val) return;
    setEventFactors((prev) => {
      const curr = prev[catKey]?.selectedItems || [];
      if (curr.includes(val)) return prev;
      return {
        ...prev,
        [catKey]: {
          ...prev[catKey],
          selectedItems: [...curr, val],
        },
      };
    });
    setCustomFactorInputs((prev) => ({ ...prev, [catKey]: '' }));
  };

  const handleSaveTriage = async (proceedToFinalApproval = false) => {
    if (actionRequired && !assignedExpertName.trim()) {
      toast.error(isFa ? 'در صورت درخواست اقدام اصلاحی، کارشناس مسئول را انتخاب کنید.' : 'Assign an HSE expert.');
      return;
    }
    setSaving(true);
    try {
      const updated = await apiDb.triageIncidentWorkflow(incident.reportNumber || incident.id, {
        inspectionStatus,
        inspectionResult,
        actionRequired,
        assignedExpertCode,
        assignedExpertName,
        assignedExpertJobTitle,
        hseHeadNotes,
        hseHeadName: currentUser.fullName || currentUser.username,
        hseHeadPersonnelCode: currentUser.personnelNumber,
        hseHeadSignature,
        hseHeadSignedDate: getCurrentJalaliDate(),
        proceedToFinalApproval,
        expectedVersion: incident.version,
      });
      toast.success(isFa ? 'بررسی اولیه واحد HSE و ارجاع کارشناس ثبت شد.' : 'HSE triage saved.');
      onUpdated(updated);
    } catch (err: any) {
      if (err?.status === 409) {
        await handleVersionConflict(err, { localRecord: incident, onReloadLatest: onClose });
        return;
      }
      toast.error(err?.message || (isFa ? 'خطا در ثبت بررسی اولیه HSE' : 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInvestigation = async (actionMode: 'SAVE_ONLY' | 'REFER_OFFICER' | 'SUBMIT_FINAL') => {
    const isStage4Officer = stage === 'ACTION_IN_PROGRESS';
    const submitToFinalApproval = actionMode === 'SUBMIT_FINAL';
    const referToActionOfficer = actionMode === 'REFER_OFFICER';

    if (!isStage4Officer && (referToActionOfficer || submitToFinalApproval) && actionRequired && !actionsTakenDescription.trim()) {
      toast.error(
        isFa ? 'لطفاً شرح اقدامات اصلاحی یا دستورات اجرایی را وارد کنید.' : 'Enter corrective action plan.'
      );
      return;
    }

    if (isStage4Officer && submitToFinalApproval && actionRequired && !actionResults.trim()) {
      toast.error(
        isFa
          ? 'لطفاً نتایج اقدامات انجام‌شده را پیش از ارسال به تایید نهایی رئیس HSE وارد کنید.'
          : 'Enter action results before submitting.'
      );
      return;
    }

    setSaving(true);
    try {
      const payload = isStage4Officer
        ? {
            correctiveFollowUp: {
              actionDate: actionDate || getCurrentJalaliDate(),
              actionResults,
              followUpStatus: submitToFinalApproval ? 'COMPLETED' : followUpStatus,
              expertName: currentUser.fullName || currentUser.username,
              expertPersonnelCode: currentUser.personnelNumber,
              expertSignature,
              expertSignedDate: getCurrentJalaliDate(),
            },
            submitToFinalApproval,
            expectedVersion: incident.version,
          }
        : {
            eventFactors,
            riskAssessment: {
              probability: prob,
              severity: sev,
              detection: det,
              assessedDate: getCurrentJalaliDate(),
            },
            correctiveFollowUp: {
              correctiveActionNumber,
              workOrderNumber,
              letterNumber,
              actionsTakenDescription,
              dueDate,
              responsibleUnit,
              responsiblePerson,
              responsiblePersonnelCode,
              actionDate: submitToFinalApproval ? actionDate || getCurrentJalaliDate() : actionDate,
              actionResults: submitToFinalApproval ? actionResults : undefined,
              followUpStatus: referToActionOfficer
                ? 'IN_PROGRESS'
                : submitToFinalApproval
                ? 'COMPLETED'
                : followUpStatus,
              expertName: currentUser.fullName || currentUser.username,
              expertPersonnelCode: currentUser.personnelNumber,
              expertSignature: submitToFinalApproval ? expertSignature : undefined,
              expertSignedDate: submitToFinalApproval ? getCurrentJalaliDate() : undefined,
            },
            referToActionOfficer,
            submitToFinalApproval,
            expectedVersion: incident.version,
          };

      const updated = await apiDb.investigateIncidentWorkflow(incident.reportNumber || incident.id, payload);
      toast.success(
        submitToFinalApproval
          ? isFa
            ? 'اطلاعات تکمیل و جهت جمع‌بندی نهایی به کارتابل رئیس HSE ارسال شد.'
            : 'Sent for final approval.'
          : referToActionOfficer
          ? isFa
            ? 'عوامل رویداد، RPN و اقدام اصلاحی ثبت و جهت اجرا به کارشناس/افسر HSE ارجاع شد.'
            : 'Referred to Action Officer.'
          : isFa
          ? 'تغییرات با موفقیت ذخیره شد.'
          : 'Saved.'
      );
      onUpdated(updated);
    } catch (err: any) {
      if (err?.status === 409) {
        await handleVersionConflict(err, { localRecord: incident, onReloadLatest: onClose });
        return;
      }
      toast.error(err?.message || (isFa ? 'خطا در ثبت اطلاعات مرحله' : 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleFinalApproval = async (
    decision: 'APPROVE_CLOSE' | 'RETURN_FOR_REVISION',
    returnTo?: 'EXPERT' | 'REPORTER' | 'ACTION_OFFICER'
  ) => {
    setSaving(true);
    try {
      const updated = await apiDb.finalApproveIncidentWorkflow(incident.reportNumber || incident.id, {
        decision,
        returnTo,
        conclusionNotes,
        finalHseHeadName: currentUser.fullName || currentUser.username,
        finalHseHeadPersonnelCode: currentUser.personnelNumber,
        finalHseHeadSignature,
        finalApprovedDate: getCurrentJalaliDate(),
        expectedVersion: incident.version,
      });
      toast.success(
        decision === 'APPROVE_CLOSE'
          ? isFa
            ? 'پرونده با جمع‌بندی نهایی رئیس HSE تایید و مختومه شد.'
            : 'Approved & closed.'
          : isFa
          ? 'پرونده جهت اصلاح یا تکمیل به مرحله منتخب عودت داده شد.'
          : 'Returned for revision.'
      );
      onUpdated(updated);
    } catch (err: any) {
      if (err?.status === 409) {
        await handleVersionConflict(err, { localRecord: incident, onReloadLatest: onClose });
        return;
      }
      toast.error(err?.message || (isFa ? 'خطا در ثبت جمع‌بندی نهایی' : 'Failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAttachmentsUpdate = async (nextList: RhsF68AttachmentItem[]) => {
    setAttachments(nextList);
    try {
      const updated = await apiDb.updateIncident(incident.reportNumber || incident.id, {
        attachmentsOnly: stage !== 'DRAFT' && stage !== 'RETURNED',
        attachedFileIds: nextList.map((a) => a.fileId),
        rhsF68: { ...(incident.rhsF68 || {}), attachments: nextList },
        expectedVersion: incident.version,
      });
      onUpdated(updated);
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در بروزرسانی فایل‌های پیوست' : 'Attachment update failed'));
    }
  };

  const handleReferToNonConformance = async () => {
    try {
      const fullDesc = `گزارش RHS-F68 شماره ${incident.reportNumber}\nنوع: ${incident.categoryFa} | تاریخ: ${incident.eventDate}\nواحد: ${incident.department} | RPN: ${liveRpn.rpn} (${liveRpn.riskLevelFa})\n\nشرح:\n${incident.description}`;
      const nc = await apiDb.createNonConformance({
        title: `عدم انطباق ناشی از گزارش ${incident.categoryFa} (${incident.reportNumber})`,
        sourceModule: 'incident',
        sourceRecordId: String(incident.id),
        sourceTitle: `گزارش ${incident.reportNumber} - ${incident.title}`,
        unit: incident.department || 'عملیات',
        department: incident.department || 'عملیات',
        severity: liveRpn.riskLevel === 'E' || liveRpn.riskLevel === 'H' ? 'بالا' : 'متوسط',
        description: fullDesc,
        reportedBy: currentUser.fullName || currentUser.username,
        status: 'OPEN',
        dueDate: dueDate || actionDate || undefined,
      });
      if (nc && (nc.id || nc.trackingCode)) {
        toast.success(isFa ? 'درخواست عدم انطباق با موفقیت در بخش CAPA ثبت شد.' : 'Referred to Non-Conformance.');
      }
    } catch (err: any) {
      toast.error(err?.message || (isFa ? 'خطا در ثبت عدم انطباق' : 'Error'));
    }
  };

  const auditHistory = incident.rhsF68?.auditHistory || [];

  return createPortal(
    <div className="fixed inset-0 z-[99998] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-6xl w-full max-h-[94vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        dir={isFa ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-rose-600 text-[10px] font-mono font-black">
                RHS-F68 Rev.01
              </span>
              <span className="font-mono text-xs font-black text-slate-100 tabular-nums">
                {incident.reportNumber}
              </span>
              <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${stageMeta.badgeClass}`}>
                {stageMeta.labelFa}
              </span>
              {overdueInfo.isOverdue && (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-rose-600 text-white">
                  {isFa ? `معوق (${overdueInfo.daysOverdue} روز تاخیر)` : `Overdue (${overdueInfo.daysOverdue}d)`}
                </span>
              )}
            </div>
            <h2 className="text-base font-black text-white mt-1 truncate">{incident.title}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(stage === 'DRAFT' || stage === 'RETURNED') && (isReporter || isHseHead) && onEditDraft && (
              <button
                type="button"
                onClick={() => onEditDraft(incident)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isFa ? 'ویرایش بخش ۱ (گزارش‌دهنده)' : 'Edit Reporter Form'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenPrint(incident)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isFa ? 'چاپ RHS-F68' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenReferral(incident)}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isFa ? 'ارجاع' : 'Refer'}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenTracker(incident)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>{isFa ? 'گردش امضا' : 'Tracker'}</span>
            </button>
            {incident.category === 'Incident' && onOpenSupplementary && (
              <button
                type="button"
                onClick={() => onOpenSupplementary(incident)}
                className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>RHS-F34</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs & 3-Stage Visual Pipeline */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('workflow')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'workflow'
                  ? 'bg-slate-900 text-white dark:bg-indigo-600'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>{isFa ? 'فرم و گردش کار ۵ مرحله‌ای' : '5-Stage Workflow & Form'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'evidence'
                  ? 'bg-slate-900 text-white dark:bg-indigo-600'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>{isFa ? 'شواهد و فایل‌ها' : 'Evidence'}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono tabular-nums">
                {attachments.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-slate-900 text-white dark:bg-indigo-600'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>{isFa ? 'تاریخچه ارجاع و ممیزی' : 'Audit Trail'}</span>
              <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono tabular-nums">
                {auditHistory.length}
              </span>
            </button>
          </div>

          {/* 5-Stage Stepper Indicator */}
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
            {[
              { order: 1, label: '۱. گزارش‌دهنده' },
              { order: 2, label: '۲. رئیس HSE' },
              { order: 3, label: '۳. کارشناس HSE' },
              { order: 4, label: '۴. افسر اقدام' },
              { order: 5, label: '۵. تایید نهایی' },
            ].map((st, idx) => {
              const done = stageMeta.stepOrder > st.order || isClosed;
              const current = stageMeta.stepOrder === st.order && !isClosed;
              return (
                <React.Fragment key={st.order}>
                  <span
                    className={`px-2 py-1 rounded-lg border ${
                      done
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : current
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-500/20'
                        : 'bg-white text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-700'
                    }`}
                  >
                    {done && '✓ '}
                    {st.label}
                  </span>
                  {idx < 4 && <span className="text-slate-300">←</span>}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {activeTab === 'workflow' && (
            <>
              {/* Active Stage Guidance Banner */}
              <div
                className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs font-bold ${
                  isClosed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200'
                    : canEditTriage || canEditExpertPlan || canEditActionResults || canEditFinalConclusion
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isClosed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Clock className="w-4 h-4" />}
                  <span>
                    {isClosed
                      ? isFa
                        ? 'پرونده تایید نهایی و مختومه شده است — تمامی بخش‌ها برای مشاهده قفل هستند.'
                        : 'Case is approved and closed.'
                      : canEditTriage
                      ? isFa
                        ? 'مرحله فعال شما (بخش ۲): تعیین نیاز به بازرسی، درخواست اقدام اصلاحی و ارجاع کارشناس مسئول فعال است.'
                        : 'Your active stage: Section 2 (HSE Head Triage).'
                      : canEditExpertPlan
                      ? isFa
                        ? 'مرحله فعال شما (بخش ۳): دسته‌بندی عوامل رویداد، ارزیابی ریسک RPN و تعیین اقدام اصلاحی فعال است.'
                        : 'Your active stage: Section 3 (HSE Expert).'
                      : canEditActionResults
                      ? isFa
                        ? 'مرحله فعال شما (بخش ۴): ثبت نتایج اقدامات اصلاحی انجام‌شده، امضا و ارسال به رئیس HSE فعال است.'
                        : 'Your active stage: Section 4 (Action Officer).'
                      : canEditFinalConclusion
                      ? isFa
                        ? 'مرحله فعال شما (بخش ۵): جمع‌بندی، تایید نهایی یا عودت گزارش جهت اصلاح فعال است.'
                        : 'Your active stage: Section 5 (HSE Final Approval).'
                      : isFa
                      ? `وضعیت فعلی پرونده: «${stageMeta.labelFa}» — فیلدهای سایر مراحل جهت حفظ یکپارچگی سوابق قفل شده‌اند.`
                      : `Current stage: ${stageMeta.labelFa}`}
                  </span>
                </div>
                <span className="text-[10px] font-mono opacity-80">
                  مرحله {stageMeta.stepOrder} از ۵
                </span>
              </div>
              {/* STAGE 1 SUMMARY: REPORTER */}
              <section className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>{isFa ? 'بخش ۱: اطلاعات گزارش‌دهنده و شرح رویداد' : 'Section 1: Reporter & Event Details'}</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-[11px]">
                    {incident.categoryFa}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">نام گزارش‌دهنده:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{incident.reporterName || '—'}</strong>
                    {incident.reporterPersonnelCode && (
                      <span className="block font-mono text-[10px] text-slate-500">کد: {incident.reporterPersonnelCode}</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">شرکت / عنوان شغلی:</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {incident.rhsF68?.companyName || incident.companyName || '—'}
                    </strong>
                    <span className="block text-[10px] text-slate-500">
                      {incident.rhsF68?.reporterJobTitle || incident.reporterJobTitle || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">واحد سازمانی / موقعیت دقیق:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{incident.department || '—'}</strong>
                    <span className="block text-[10px] text-slate-500">
                      {incident.locationSite}
                      {incident.rhsF68?.exactLocation ? ` — ${incident.rhsF68.exactLocation}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">تاریخ و زمان وقوع:</span>
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {incident.eventDate} • {incident.eventTime}
                    </strong>
                    <span className="block text-[10px] text-slate-500 font-mono">
                      ثبت فرم: {incident.rhsF68?.reportDate || incident.createdDate}
                    </span>
                  </div>
                </div>

                {incident.rhsF68?.involvedPersonnel && incident.rhsF68.involvedPersonnel.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 font-bold text-[11px] block mb-1">فرد / افراد مرتبط یا خاطی:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.rhsF68.involvedPersonnel.map((p) => (
                        <span
                          key={p.id}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-[11px]"
                        >
                          {p.fullName} {p.personnelCode ? `(${p.personnelCode})` : ''}
                          {p.jobTitle ? ` — ${p.jobTitle}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="font-bold text-slate-600 dark:text-slate-400 block mb-1">شرح رویداد:</span>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {incident.description}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div>
                      <span className="font-bold text-slate-600 dark:text-slate-400 block">پیشنهادات گزارش‌دهنده:</span>
                      <p className="text-slate-800 dark:text-slate-200 mt-0.5">
                        {incident.rhsF68?.suggestions || '—'}
                      </p>
                    </div>
                    {incident.immediateActionTaken && (
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-slate-600 dark:text-slate-400 block">اقدام فوری انجام‌شده:</span>
                        <p className="text-slate-800 dark:text-slate-200 mt-0.5">{incident.immediateActionTaken}</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* STAGE 2: HSE UNIT REVIEW & HEAD TRIAGE */}
              <section
                className={`p-4 rounded-2xl border space-y-4 ${
                  canEditTriage
                    ? 'border-amber-400 bg-white dark:bg-slate-900 ring-2 ring-amber-500/15'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>
                      {isFa
                        ? 'بخش ۲: بررسی واحد HSE و تعیین کارشناس مسئول (رئیس HSE)'
                        : 'Section 2: HSE Head Review'}
                    </span>
                  </h3>
                  {canEditTriage ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black">
                      {isFa ? 'مرحله فعال — در انتظار بررسی شما' : 'Active Stage'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {stageMeta.stepOrder > 2 || isClosed
                        ? isFa
                          ? 'تکمیل و قفل‌شده'
                          : 'Completed & Locked'
                        : isFa
                        ? 'فقط رئیس واحد HSE در مرحله ۲'
                        : 'Locked'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      وضعیت نیاز به بازرسی:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { val: 'INSPECTED', label: 'بازرسی انجام شده است' },
                        { val: 'NO_INSPECTION_NEEDED', label: 'نیاز به بازرسی ندارد' },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          disabled={!canEditTriage}
                          onClick={() => setInspectionStatus(opt.val as any)}
                          className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            inspectionStatus === opt.val
                              ? 'bg-slate-900 text-white border-slate-900 dark:bg-indigo-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {inspectionStatus === opt.val && <Check className="w-3.5 h-3.5" />}
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      درخواست اقدام اصلاحی:
                    </label>
                    <div className="flex gap-2">
                      {[
                        { val: true, label: 'درخواست اقدام دارد' },
                        { val: false, label: 'درخواست اقدام ندارد' },
                      ].map((opt) => (
                        <button
                          key={String(opt.val)}
                          type="button"
                          disabled={!canEditTriage}
                          onClick={() => setActionRequired(opt.val)}
                          className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                            actionRequired === opt.val
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {actionRequired === opt.val && <Check className="w-3.5 h-3.5" />}
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نتیجه بازرسی:
                    </label>
                    <textarea
                      rows={2}
                      disabled={!canEditTriage}
                      value={inspectionResult}
                      onChange={(e) => setInspectionResult(e.target.value)}
                      placeholder="مشاهدات و نتیجه بازرسی میدانی واحد HSE..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs disabled:opacity-75"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      توضیحات رئیس HSE:
                    </label>
                    <textarea
                      rows={2}
                      disabled={!canEditTriage}
                      value={hseHeadNotes}
                      onChange={(e) => setHseHeadNotes(e.target.value)}
                      placeholder="دستورات یا توضیحات تکمیلی رئیس واحد HSE..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs disabled:opacity-75"
                    />
                  </div>

                  <div className="md:col-span-2">
                    {canEditTriage ? (
                      <CentralPersonnelSelector
                        label={isFa ? 'تعیین کارشناس مربوطه (از لیست پرسنل):' : 'Assign HSE Expert:'}
                        selectedPersonnelCode={assignedExpertCode}
                        value={
                          assignedExpertName
                            ? `${assignedExpertName}${assignedExpertCode ? ` (${assignedExpertCode})` : ''}`
                            : ''
                        }
                        isFa={isFa}
                        onSelect={(person) => {
                          if (!person) return;
                          setAssignedExpertCode(person.effectiveCode || person.personnelCode || '');
                          setAssignedExpertName(person.fullName || `${person.firstName} ${person.lastName}`.trim());
                          setAssignedExpertJobTitle(person.jobTitle || person.position || '');
                        }}
                      />
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-slate-500">کارشناس مسئول ارجاع‌شده: </span>
                          <strong className="text-slate-900 dark:text-slate-100">
                            {assignedExpertName || 'هنوز تعیین نشده'}
                            {assignedExpertCode ? ` (${assignedExpertCode})` : ''}
                          </strong>
                        </div>
                        {incident.rhsF68?.hseUnitReview?.hseHeadName && (
                          <span className="text-[11px] text-slate-500">
                            تایید رئیس HSE: <strong>{incident.rhsF68.hseUnitReview.hseHeadName}</strong>
                            {incident.rhsF68.hseUnitReview.hseHeadSignedDate
                              ? ` (${incident.rhsF68.hseUnitReview.hseHeadSignedDate})`
                              : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {canEditTriage && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <DigitalSignaturePad
                      isFa={isFa}
                      initialSignature={hseHeadSignature}
                      onSave={setHseHeadSignature}
                      onClear={() => setHseHeadSignature('')}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      {inspectionStatus === 'NO_INSPECTION_NEEDED' && !actionRequired && !assignedExpertName && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveTriage(true)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                        >
                          {isFa ? 'انتقال مستقیم به جمع‌بندی نهایی' : 'Skip to Final Approval'}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveTriage(false)}
                        className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isFa ? 'ثبت نظر واحد HSE و ارجاع به کارشناس' : 'Save & Assign Expert'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* STAGE 3: HSE EXPERT INVESTIGATION (8 FACTORS + RPN + CAPA PLAN) */}
              <section
                className={`p-4 rounded-2xl border space-y-5 ${
                  canEditExpertPlan
                    ? 'border-indigo-400 bg-white dark:bg-slate-900 ring-2 ring-indigo-500/15'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-indigo-600" />
                    <span>
                      {isFa
                        ? 'بخش ۳: کارشناس واحد HSE — دسته‌بندی عوامل رویداد، ارزیابی ریسک (RPN) و تعیین اقدام اصلاحی'
                        : 'Section 3: HSE Expert Factors, Risk Assessment (RPN) & CAPA Plan'}
                    </span>
                  </h3>
                  {canEditExpertPlan ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 text-[10px] font-black">
                      {isFa ? 'مرحله فعال — در انتظار تکمیل کارشناس' : 'Active Stage'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {stageMeta.stepOrder > 3 || isClosed
                        ? isFa
                          ? 'تکمیل و قفل‌شده (فقط خواندنی)'
                          : 'Completed & Locked'
                        : isFa
                        ? 'در انتظار ارجاع به مرحله ۳ (کارشناس واحد HSE)'
                        : 'Locked'}
                    </span>
                  )}
                </div>

                {/* 8 Factor Categories */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-slate-800 dark:text-slate-100">
                      مشخص نمودن فاکتورهای رویداد (۸ دسته‌بندی استاندارد RHS-F68):
                    </span>
                    <span className="text-[10px] text-indigo-600 font-bold">
                      دسته‌های مرتبط با «{incident.categoryFa}» برجسته شده‌اند
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {RHS_F68_FACTOR_CATEGORIES.map((cat) => {
                      const catState = eventFactors[cat.key] || { selectedItems: [], customNote: '' };
                      const isRecommended = recommendedFactorKeys.has(cat.key);
                      return (
                        <div
                          key={cat.key}
                          className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${
                            isRecommended
                              ? 'border-indigo-300 bg-indigo-50/30 dark:border-indigo-800 dark:bg-indigo-950/20'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-700">
                              <span className="font-black text-[11px] text-slate-800 dark:text-slate-100">
                                {cat.titleFa}
                              </span>
                              {catState.selectedItems.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white font-mono text-[10px] font-bold">
                                  {catState.selectedItems.length}
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5 max-h-44 overflow-y-auto pl-1">
                              {Array.from(new Set([...cat.items, ...catState.selectedItems])).map((item) => {
                                const checked = catState.selectedItems.includes(item);
                                return (
                                  <label
                                    key={item}
                                    className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!canEditExpertPlan}
                                      checked={checked}
                                      onChange={() => toggleFactorItem(cat.key, item)}
                                      className="mt-0.5 rounded text-indigo-600"
                                    />
                                    <span className={checked ? 'font-bold text-slate-950 dark:text-white' : ''}>
                                      {item}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          {canEditExpertPlan ? (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={customFactorInputs[cat.key] || ''}
                                  onChange={(e) =>
                                    setCustomFactorInputs((p) => ({ ...p, [cat.key]: e.target.value }))
                                  }
                                  placeholder="افزودن مورد جدید..."
                                  className="flex-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => addCustomFactorItem(cat.key)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 text-white text-[10px] cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <input
                                type="text"
                                value={catState.customNote || ''}
                                onChange={(e) =>
                                  setEventFactors((prev) => ({
                                    ...prev,
                                    [cat.key]: { ...prev[cat.key], customNote: e.target.value },
                                  }))
                                }
                                placeholder="توضیح تکمیلی..."
                                className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px]"
                              />
                            </div>
                          ) : (
                            catState.customNote && (
                              <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400">
                                <strong>توضیح:</strong> {catState.customNote}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RHS-F68 Risk Assessment (P × S × D => 1..125, L/M/H/E) */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-black text-slate-900 dark:text-slate-100">
                      ارزیابی ریسک مطابق فرم RHS-F68 (مقیاس ۱ تا ۵):
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">۱-۱۰: پایین (L)</span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900">۱۱-۲۴: متوسط (M)</span>
                      <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-900">۲۵-۴۹: بالا (H)</span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900">۵۰-۱۲۵: شدید/بارز (E)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        احتمال وقوع (۱ تا ۵)
                      </label>
                      <select
                        disabled={!canEditExpertPlan}
                        value={prob}
                        onChange={(e) => setProb(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs disabled:opacity-75"
                      >
                        {PROBABILITY_SCALE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شدت پیامد (۱ تا ۵)
                      </label>
                      <select
                        disabled={!canEditExpertPlan}
                        value={sev}
                        onChange={(e) => setSev(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs disabled:opacity-75"
                      >
                        {SEVERITY_SCALE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        قابلیت تشخیص (۱ تا ۵)
                      </label>
                      <select
                        disabled={!canEditExpertPlan}
                        value={det}
                        onChange={(e) => setDet(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs disabled:opacity-75"
                      >
                        {DETECTION_SCALE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 dark:text-slate-400 font-bold">عدد RPN محاسبه‌شده:</span>
                      <span className="text-2xl font-black font-mono tabular-nums text-slate-950 dark:text-white">
                        {liveRpn.rpn}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        ({prob} × {sev} × {det})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 hidden md:inline">{liveRpn.actionPriorityFa}</span>
                      <span className={`px-4 py-1.5 rounded-xl font-black text-xs border ${liveRpn.badgeClass}`}>
                        سطح ریسک: {liveRpn.riskLevelFa}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CAPA Plan Definition (Stage 3) */}
                <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <h4 className="font-black text-slate-900 dark:text-slate-100">
                      تعیین برنامه اقدام اصلاحی، مسئول اجرا و مهلت اقدام (RHS-F68):
                    </h4>
                    <button
                      type="button"
                      onClick={handleReferToNonConformance}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600" />
                      <span>{isFa ? 'ارجاع به ماژول عدم انطباق (CAPA)' : 'Send to Non-Conformance'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شماره اقدام اصلاحی
                      </label>
                      <input
                        type="text"
                        disabled={!canEditExpertPlan}
                        value={correctiveActionNumber}
                        onChange={(e) => setCorrectiveActionNumber(e.target.value)}
                        placeholder="مثال: CA-1405-012"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs disabled:opacity-75"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شماره درخواست کار (Work Order)
                      </label>
                      <input
                        type="text"
                        disabled={!canEditExpertPlan}
                        value={workOrderNumber}
                        onChange={(e) => setWorkOrderNumber(e.target.value)}
                        placeholder="مثال: WO-8842"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs disabled:opacity-75"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        شماره نامه
                      </label>
                      <input
                        type="text"
                        disabled={!canEditExpertPlan}
                        value={letterNumber}
                        onChange={(e) => setLetterNumber(e.target.value)}
                        placeholder="شماره مکاتبه اداری..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs disabled:opacity-75"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        مهلت انجام (سررسید اقدام اصلاحی)
                      </label>
                      <PersianDatePicker
                        value={dueDate}
                        onChange={setDueDate}
                        isFa={isFa}
                        disabled={!canEditExpertPlan}
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        واحد مسئول اجرا
                      </label>
                      <select
                        disabled={!canEditExpertPlan}
                        value={responsibleUnit}
                        onChange={(e) => setResponsibleUnit(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs disabled:opacity-75"
                      >
                        <option value="">-- انتخاب واحد --</option>
                        {departmentList.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {canEditExpertPlan ? (
                    <CentralPersonnelSelector
                      label={isFa ? 'کارشناس / افسر یا مسئول اجرای اقدام اصلاحی' : 'Action Officer'}
                      selectedPersonnelCode={responsiblePersonnelCode}
                      value={
                        responsiblePerson
                          ? `${responsiblePerson}${responsiblePersonnelCode ? ` (${responsiblePersonnelCode})` : ''}`
                          : ''
                      }
                      isFa={isFa}
                      onSelect={(p) => {
                        if (!p) return;
                        setResponsiblePersonnelCode(p.effectiveCode || p.personnelCode || '');
                        setResponsiblePerson(p.fullName);
                        if (!responsibleUnit && (p.unit || p.department)) {
                          setResponsibleUnit(p.unit || p.department);
                        }
                      }}
                    />
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[11px]">
                      <span className="text-slate-500">مسئول / افسر ارجاع‌شده جهت اقدام: </span>
                      <strong className="text-slate-900 dark:text-slate-100">
                        {responsiblePerson || 'تعیین نشده'}
                        {responsiblePersonnelCode ? ` (${responsiblePersonnelCode})` : ''}
                      </strong>
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شرح اقدامات اتخاذ شده / دستورالعمل اصلاحی:
                    </label>
                    <textarea
                      rows={3}
                      disabled={!canEditExpertPlan}
                      value={actionsTakenDescription}
                      onChange={(e) => setActionsTakenDescription(e.target.value)}
                      placeholder="شرح کامل اقدامات مهندسی، مدیریتی یا آموزشی ابلاغ‌شده جهت اجرا..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs disabled:opacity-75"
                    />
                  </div>

                  {canEditExpertPlan && (
                    <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveInvestigation('SAVE_ONLY')}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs cursor-pointer"
                      >
                        {isFa ? 'ذخیره موقت عوامل و RPN' : 'Save Progress'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveInvestigation('REFER_OFFICER')}
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isFa
                            ? 'ارجاع به کارشناس / افسر HSE جهت اجرا و ثبت نتایج'
                            : 'Refer to Officer for Execution'}
                        </span>
                      </button>
                      {!actionRequired && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveInvestigation('SUBMIT_FINAL')}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                        >
                          {isFa ? 'ارسال مستقیم به تایید نهایی رئیس HSE' : 'Fast-track to Final Approval'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* STAGE 4: HSE OFFICER / ACTION OWNER (RESULTS & SIGNATURE) */}
              <section
                className={`p-4 rounded-2xl border space-y-4 ${
                  canEditActionResults
                    ? 'border-blue-500 bg-white dark:bg-slate-900 ring-2 ring-blue-500/15'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-blue-600" />
                    <span>
                      {isFa
                        ? 'بخش ۴: کارشناس / افسر HSE — ثبت نتایج اقدامات انجام‌شده، توضیحات و امضا'
                        : 'Section 4: Action Results & Execution Sign-off'}
                    </span>
                  </h3>
                  {canEditActionResults ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-black">
                      {isFa ? 'مرحله فعال — در انتظار ثبت نتایج اقدام شما' : 'Active Stage'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {stageMeta.stepOrder > 4 || isClosed
                        ? isFa
                          ? 'تکمیل و قفل‌شده (فقط خواندنی)'
                          : 'Completed & Locked'
                        : isFa
                        ? 'در انتظار ارجاع به مرحله ۴ (افسر / مجری اقدام)'
                        : 'Locked'}
                    </span>
                  )}
                </div>

                {/* Read-only context of assigned CAPA order */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">واحد / مجری مسئول:</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {responsiblePerson || responsibleUnit || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">مهلت اقدام:</span>
                    <strong className="font-mono text-slate-900 dark:text-slate-100">{dueDate || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">شماره اقدام / کار / نامه:</span>
                    <strong className="font-mono text-slate-900 dark:text-slate-100">
                      {[correctiveActionNumber, workOrderNumber, letterNumber].filter(Boolean).join(' • ') || '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">وضعیت فعلی:</span>
                    <strong className="text-slate-900 dark:text-slate-100">
                      {followUpStatus === 'VERIFIED'
                        ? 'تایید و مختومه'
                        : followUpStatus === 'COMPLETED'
                        ? 'انجام‌شده'
                        : followUpStatus === 'IN_PROGRESS'
                        ? 'در حال اجرا'
                        : 'ابلاغ‌شده'}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ اجرای اقدام:
                    </label>
                    <PersianDatePicker
                      value={actionDate}
                      onChange={setActionDate}
                      isFa={isFa}
                      disabled={!canEditActionResults}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      وضعیت پیشرفت اجرای اقدام:
                    </label>
                    <select
                      disabled={!canEditActionResults}
                      value={followUpStatus}
                      onChange={(e) => setFollowUpStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs disabled:opacity-75"
                    >
                      <option value="OPEN">باز / ابلاغ‌شده</option>
                      <option value="IN_PROGRESS">در حال اجرا</option>
                      <option value="COMPLETED">انجام‌شده (آماده تایید نهایی)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نتایج اقدامات انجام‌شده و توضیحات افسر / کارشناس HSE:
                  </label>
                  <textarea
                    rows={3}
                    disabled={!canEditActionResults}
                    value={actionResults}
                    onChange={(e) => setActionResults(e.target.value)}
                    placeholder="شرح دقیق نتایج پایش میدانی، رفع نقص، شواهد اجرایی و اثربخشی اقدامات..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs disabled:opacity-75"
                  />
                </div>

                {canEditActionResults ? (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <DigitalSignaturePad
                      isFa={isFa}
                      initialSignature={expertSignature}
                      onSave={setExpertSignature}
                      onClear={() => setExpertSignature('')}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveInvestigation('SAVE_ONLY')}
                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs cursor-pointer"
                      >
                        {isFa ? 'ذخیره موقت نتایج' : 'Save Progress'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveInvestigation('SUBMIT_FINAL')}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isFa
                            ? 'تکمیل نتایج، امضا و ارسال به تایید نهایی رئیس HSE'
                            : 'Submit to HSE Final Approval'}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  incident.rhsF68?.correctiveFollowUp?.expertName && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                      <span>
                        ثبت و تایید کارشناس / افسر HSE:{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {incident.rhsF68.correctiveFollowUp.expertName}
                        </strong>
                        {incident.rhsF68.correctiveFollowUp.expertSignedDate
                          ? ` (${incident.rhsF68.correctiveFollowUp.expertSignedDate})`
                          : ''}
                      </span>
                      {incident.rhsF68.correctiveFollowUp.expertSignature && (
                        <img
                          src={incident.rhsF68.correctiveFollowUp.expertSignature}
                          alt="امضای کارشناس/افسر HSE"
                          className="max-h-10 object-contain"
                        />
                      )}
                    </div>
                  )
                )}
              </section>

              {/* STAGE 5: FINAL HSE HEAD CONCLUSION */}
              <section
                className={`p-4 rounded-2xl border space-y-4 ${
                  canEditFinalConclusion
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10 ring-2 ring-emerald-500/15'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {isFa
                        ? 'بخش ۵: رئیس HSE — بررسی نهایی، جمع‌بندی، تایید یا عودت گزارش'
                        : 'Section 5: Final HSE Head Conclusion'}
                    </span>
                  </h3>
                  {canEditFinalConclusion ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black">
                      {isFa ? 'مرحله فعال — در انتظار جمع‌بندی نهایی شما' : 'Active Stage'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-500 text-[10px] font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {isClosed
                        ? isFa
                          ? 'تایید و مختومه شده'
                          : 'Approved & Closed'
                        : isFa
                        ? 'فقط رئیس واحد HSE در مرحله ۵'
                        : 'HSE Head Stage 5 Only'}
                    </span>
                  )}
                </div>

                <textarea
                  rows={2}
                  disabled={!canEditFinalConclusion}
                  value={conclusionNotes}
                  onChange={(e) => setConclusionNotes(e.target.value)}
                  placeholder="نظر نهایی، ارزیابی اثربخشی، علت عودت یا دستور اختتام پرونده..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs disabled:opacity-75"
                />

                {canEditFinalConclusion ? (
                  <div className="space-y-3">
                    <DigitalSignaturePad
                      isFa={isFa}
                      initialSignature={finalHseHeadSignature}
                      onSave={setFinalHseHeadSignature}
                      onClear={() => setFinalHseHeadSignature('')}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleFinalApproval('RETURN_FOR_REVISION', 'REPORTER')}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer"
                      >
                        {isFa ? 'عودت به گزارش‌دهنده' : 'Return to Reporter'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleFinalApproval('RETURN_FOR_REVISION', 'EXPERT')}
                        className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer"
                      >
                        {isFa ? 'عودت به کارشناس HSE' : 'Return to Expert'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleFinalApproval('RETURN_FOR_REVISION', 'ACTION_OFFICER')}
                        className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs cursor-pointer"
                      >
                        {isFa ? 'عودت به مجری / افسر اقدام' : 'Return to Officer'}
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleFinalApproval('APPROVE_CLOSE')}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isFa ? 'تایید نهایی و اختتام پرونده' : 'Approve & Close Report'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  incident.rhsF68?.finalConclusion?.finalHseHeadName && (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <span>
                        {incident.rhsF68.finalConclusion.decision === 'RETURN_FOR_REVISION'
                          ? 'عودت جهت اصلاح توسط: '
                          : 'تایید نهایی توسط: '}
                        {incident.rhsF68.finalConclusion.finalHseHeadName} (
                        {incident.rhsF68.finalConclusion.finalApprovedDate})
                      </span>
                      {incident.rhsF68.finalConclusion.finalHseHeadSignature && (
                        <img
                          src={incident.rhsF68.finalConclusion.finalHseHeadSignature}
                          alt="امضای نهایی رئیس HSE"
                          className="max-h-10 object-contain"
                        />
                      )}
                    </div>
                  )
                )}
              </section>

              <PrintDocumentSignaturesBox
                documentType="INCIDENT"
                documentId={incident.id}
                isFa={isFa}
                title={isFa ? 'تأییدات و امضاهای الکترونیک ارجاعات سامانه' : 'Electronic Referral Signatures'}
              />
            </>
          )}

          {activeTab === 'evidence' && (
            <RhsF68EvidencePanel
              entityId={incident.reportNumber || String(incident.id)}
              attachments={attachments}
              onChange={handleAttachmentsUpdate}
              readOnly={isClosed || (!isHseStaff && !isReporter && !isAssignedOfficer)}
              isFa={isFa}
            />
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              {auditHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {isFa ? 'هنوز رویدادی در تاریخچه این پرونده ثبت نشده است.' : 'No audit entries yet.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {auditHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 dark:text-slate-100">{entry.action}</span>
                          {entry.toStage && (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                              {WORKFLOW_STAGE_META[entry.toStage as keyof typeof WORKFLOW_STAGE_META]?.labelFa || entry.toStage}
                            </span>
                          )}
                          {entry.referredToName && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                              ارجاع به: {entry.referredToName}
                              {entry.referredToCode ? ` (${entry.referredToCode})` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          اقدام‌کننده: <strong>{entry.actorName}</strong>
                          {entry.actorRole ? ` (${entry.actorRole})` : ''}
                          {entry.details ? ` — ${entry.details}` : ''}
                        </p>
                        {entry.referralNote && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            یادداشت ارجاع: {entry.referralNote}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {entry.jalaliDateTime || new Date(entry.timestamp).toLocaleString('fa-IR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div>
            {(isHseHead || (incident.isDraft && isReporter)) && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(incident.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isFa ? 'حذف گزارش' : 'Delete'}</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
