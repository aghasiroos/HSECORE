import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Eye,
  FileText,
  UserCheck,
  RefreshCw,
  X,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Building2,
  User,
  Paperclip,
  ChevronDown,
  Download,
  Printer,
  History,
  Activity,
  AlertOctagon,
  CheckCircle,
  TrendingUp,
  FileCheck2,
  Flame,
  Send,
  Layers,
  Sparkles,
  Bell,
  ExternalLink,
  PenTool,
  RotateCcw,
  Ban,
  ShieldCheck,
  CheckSquare,
  Undo2,
  UserPlus
} from 'lucide-react';
import {
  NonConformanceRecord,
  NonConformanceSourceModule,
  NonConformanceRiskLevel,
  NonConformanceWorkflowStatus,
  StageSignatureInfo,
  CurrentStageAssignee,
  CancellationInfo,
  nonConformanceService,
  SOURCE_MODULE_LABELS,
  SOURCE_MODULE_TAB_MAP,
  RISK_LEVEL_CONFIG,
  WORKFLOW_STATUS_CONFIG,
  WORKFLOW_STAGES_ORDER,
  getPreviousWorkflowStatus,
  getNextWorkflowStatus
} from './nonConformanceService';
import { getUnits } from '../../utils/orgHelper';
import { getComplexPersonnelList, ComplexPersonnel } from '../../utils/personnelHelper';
import { getSystemUsers } from '../../utils/authHelper';
import { apiDb } from '../../services/apiDatabaseClient';
import { DigitalSignaturePad } from '../referral/DigitalSignaturePad';
import moment from 'moment-jalaali';
import * as XLSX from 'xlsx';

interface Props {
  language?: 'fa' | 'en';
  currentUser?: any;
  initialSourceModule?: NonConformanceSourceModule;
  onNavigateToModule?: (moduleKey: string) => void;
}

export const ComprehensiveNonConformanceModule: React.FC<Props> = ({
  language = 'fa',
  currentUser,
  initialSourceModule,
  onNavigateToModule
}) => {
  const isFa = language === 'fa';
  const [records, setRecords] = useState<NonConformanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>(initialSourceModule || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [selectedRecord, setSelectedRecord] = useState<NonConformanceRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<NonConformanceRecord | null>(null);

  // Workflow Action Modal
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState<boolean>(false);
  const [workflowActionType, setWorkflowActionType] = useState<NonConformanceWorkflowStatus>('UNDER_EVALUATION');
  const [workflowNote, setWorkflowNote] = useState<string>('');
  const [effectivenessNotes, setEffectivenessNotes] = useState<string>('');
  const [effectivenessVerified, setEffectivenessVerified] = useState<boolean>(true);

  // Referral Modal State
  const [isReferModalOpen, setIsReferModalOpen] = useState<boolean>(false);
  const [referPickerSource, setReferPickerSource] = useState<'USERS' | 'PERSONNEL'>('USERS');
  const [referSearch, setReferSearch] = useState<string>('');
  const [selectedAssigneeUser, setSelectedAssigneeUser] = useState<any | null>(null);
  const [referDeadline, setReferDeadline] = useState<string>(() => moment().add(3, 'days').format('jYYYY/jMM/jDD'));
  const [referInstructions, setReferInstructions] = useState<string>('');
  const [referActionType, setReferActionType] = useState<string>('APPROVE_AND_SIGN');

  // Signature Modal State
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [signatureTargetStage, setSignatureTargetStage] = useState<NonConformanceWorkflowStatus>('REGISTERED');
  const [signerName, setSignerName] = useState<string>('');
  const [signerRole, setSignerRole] = useState<string>('');
  const [signatureStatus, setSignatureStatus] = useState<'SIGNED' | 'REJECTED'>('SIGNED');
  const [signatureNotes, setSignatureNotes] = useState<string>('');
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelRecordTarget, setCancelRecordTarget] = useState<NonConformanceRecord | null>(null);

  // Step Back Modal State
  const [isStepBackModalOpen, setIsStepBackModalOpen] = useState<boolean>(false);
  const [stepBackReason, setStepBackReason] = useState<string>('');
  const [stepBackTargetStage, setStepBackTargetStage] = useState<NonConformanceWorkflowStatus | null>(null);

  // Confirm Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [recordsToDelete, setRecordsToDelete] = useState<NonConformanceRecord[]>([]);

  // System Users
  const systemUsers = useMemo(() => getSystemUsers(), []);

  // Form State
  const [formData, setFormData] = useState<Partial<NonConformanceRecord>>({
    title: '',
    sourceModule: initialSourceModule || 'general',
    sourceRecordId: '',
    sourceTitle: '',
    unitName: '',
    riskLevel: 'MEDIUM',
    category: 'ایمنی و بهداشت',
    description: '',
    evidence: '',
    immediateAction: '',
    rootCause: '',
    correctiveAction: '',
    preventiveAction: '',
    assignedTo: '',
    assignedToName: '',
    dueDate: '',
    status: 'REGISTERED'
  });

  // Personnel & Org Data
  const [orgUnitsList, setOrgUnitsList] = useState<string[]>([]);
  const [personnelList, setPersonnelList] = useState<any[]>([]);

  const [availableSourceItems, setAvailableSourceItems] = useState<
    Array<{ id: string; code: string; title: string; unit?: string; risk?: NonConformanceRiskLevel; description?: string }>
  >([]);
  const [loadingSourceItems, setLoadingSourceItems] = useState<boolean>(false);
  const [selectedSourceItem, setSelectedSourceItem] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<NonConformanceRecord | null>(null);

  const loadSourceModuleRecords = async (moduleKey: NonConformanceSourceModule) => {
    if (moduleKey === 'general') {
      setAvailableSourceItems([]);
      return;
    }
    setLoadingSourceItems(true);
    try {
      let items: Array<{ id: string; code: string; title: string; unit?: string; risk?: NonConformanceRiskLevel; description?: string }> = [];
      if (moduleKey === 'safety_inspection') {
        const inspections = await apiDb.getSafetyInspections();
        items = (inspections || []).map((insp: any) => ({
          id: String(insp.id || insp.checklistNumber),
          code: insp.checklistNumber || String(insp.id),
          title: insp.checklistTypeNameFa || insp.title || 'بازرسی ایمنی و بهداشت',
          unit: insp.location || insp.unitName || '',
          risk: insp.severity === 'CRITICAL' ? 'CRITICAL' : insp.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
          description: insp.findings || insp.notes || insp.description || ''
        }));
      } else if (moduleKey === 'ptw' || moduleKey === 'ptw_audit') {
        const permits = await apiDb.getWorkPermits();
        items = (permits || []).map((ptw: any) => ({
          id: String(ptw.id || ptw.permitNumber),
          code: ptw.permitNumber || String(ptw.id),
          title: ptw.title || ptw.workDescription || `مجوز کار ${ptw.permitNumber}`,
          unit: ptw.location || ptw.unitName || '',
          risk: ptw.hazardLevel === 'HIGH' ? 'HIGH' : 'MEDIUM',
          description: ptw.precautions || ptw.workDescription || ''
        }));
      } else if (moduleKey === 'incident') {
        const incidents = await apiDb.getIncidents();
        items = (incidents || []).map((inc: any) => ({
          id: String(inc.id || inc.trackingCode),
          code: inc.trackingCode || inc.incidentNumber || String(inc.id),
          title: inc.title || inc.description || `گزارش حادثه ${inc.trackingCode}`,
          unit: inc.department || inc.location || '',
          risk: (inc.severity === 'FATAL' || inc.severity === 'MAJOR') ? 'CRITICAL' : 'HIGH',
          description: inc.description || inc.immediateAction || ''
        }));
      } else if (moduleKey === 'health_env') {
        const healthItems = await apiDb.getHealthEnvInspections();
        items = (healthItems || []).map((h: any) => ({
          id: String(h.id || h.checklistNumber),
          code: h.checklistNumber || String(h.id),
          title: h.checklistTypeNameFa || h.title || 'بازرسی بهداشت و محیط زیست',
          unit: h.location || h.unitName || '',
          description: h.findings || h.notes || ''
        }));
      } else if (moduleKey === '5s') {
        const fiveSItems = await apiDb.getFiveSInspections();
        items = (fiveSItems || []).map((f: any) => ({
          id: String(f.id || f.auditNumber),
          code: f.auditNumber || String(f.id),
          title: f.zoneName || f.title || `ممیزی نظام ۵S - ${f.auditNumber || f.id}`,
          unit: f.unitName || f.location || '',
          description: f.findings || f.weakPoints || ''
        }));
      }
      setAvailableSourceItems(items);
    } catch (err) {
      console.warn('Failed to load source module records:', err);
    } finally {
      setLoadingSourceItems(false);
    }
  };

  useEffect(() => {
    try {
      const unitNames = getUnits();
      setOrgUnitsList(unitNames || []);
      const persons = getComplexPersonnelList();
      setPersonnelList(persons || []);
    } catch (_) {}
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await nonConformanceService.getAll();
      setRecords(data || []);
    } catch (err) {
      console.error('Failed to load non-conformances from database:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleRemoteChange = (e: any) => {
      const entity = e?.detail?.entity || e?.detail?.key;
      if (!entity || entity === 'nonConformances' || entity === 'non_conformances' || entity === 'settings') {
        loadData();
      }
    };

    window.addEventListener('storage', handleRemoteChange);
    window.addEventListener('hsecore-sync', handleRemoteChange);
    return () => {
      window.removeEventListener('storage', handleRemoteChange);
      window.removeEventListener('hsecore-sync', handleRemoteChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDeleteModalOpen) setIsDeleteModalOpen(false);
        else if (isWorkflowModalOpen) setIsWorkflowModalOpen(false);
        else if (isReferModalOpen) setIsReferModalOpen(false);
        else if (isSignatureModalOpen) setIsSignatureModalOpen(false);
        else if (isCancelModalOpen) setIsCancelModalOpen(false);
        else if (isStepBackModalOpen) setIsStepBackModalOpen(false);
        else if (isModalOpen) handleCloseModalWithoutChanges();
        else if (isViewModalOpen) handleCloseViewModalWithoutChanges();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDeleteModalOpen,
    isWorkflowModalOpen,
    isReferModalOpen,
    isSignatureModalOpen,
    isCancelModalOpen,
    isStepBackModalOpen,
    isModalOpen,
    isViewModalOpen
  ]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const matchSearch =
        !searchTerm ||
        rec.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.trackingCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (rec.unitName && rec.unitName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (rec.assignedToName && rec.assignedToName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        rec.description.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSource = selectedSource === 'all' || rec.sourceModule === selectedSource;
      const matchStatus = selectedStatus === 'all' || rec.status === selectedStatus;
      const matchRisk = selectedRisk === 'all' || rec.riskLevel === selectedRisk;

      return matchSearch && matchSource && matchStatus && matchRisk;
    });
  }, [records, searchTerm, selectedSource, selectedStatus, selectedRisk]);

  // Statistics
  const stats = useMemo(() => {
    const total = records.length;
    const open = records.filter(r => r.status === 'REGISTERED' || r.status === 'UNDER_EVALUATION' || r.status === 'REOPENED').length;
    const inProgress = records.filter(r => r.status === 'CAPA_DEFINED' || r.status === 'IN_PROGRESS').length;
    const review = records.filter(r => r.status === 'EFFECTIVENESS_REVIEW').length;
    const closed = records.filter(r => r.status === 'CLOSED').length;
    const cancelled = records.filter(r => r.status === 'CANCELLED').length;
    const critical = records.filter(r => (r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH') && r.status !== 'CLOSED' && r.status !== 'CANCELLED').length;
    const resolutionRate = (total - cancelled) > 0 ? Math.round((closed / (total - cancelled)) * 100) : 0;
    return { total, open, inProgress, review, closed, cancelled, critical, resolutionRate };
  }, [records]);

  // Toast Feedback State
  const [alertSuccessToast, setAlertSuccessToast] = useState<string | null>(null);

  // Overdue Actions Detection
  const overdueRecords = useMemo(() => {
    const today = new Date().toLocaleDateString('fa-IR');
    return records.filter(r => r.dueDate && r.dueDate < today && r.status !== 'CLOSED');
  }, [records]);

  const handleBroadcastOverdueAlerts = async () => {
    if (overdueRecords.length === 0) return;
    try {
      const actor = currentUser?.fullName || currentUser?.username || 'مدیریت HSE';
      for (const rec of overdueRecords) {
        await nonConformanceService.sendOverdueAlert(rec, actor);
      }
      setAlertSuccessToast(`هشدار سیستمی به مسئولان ${overdueRecords.length} پرونده عدم انطباق سررسیدگذشته با موفقیت ارسال شد.`);
      setTimeout(() => setAlertSuccessToast(null), 4500);
    } catch (e: any) {
      alert(`خطا در ارسال اعلان: ${e?.message || e}`);
    }
  };

  // Handle Create / Edit Open
  const handleOpenAdd = () => {
    setEditingRecord(null);
    setDuplicateWarning(null);
    setSelectedSourceItem('');
    const targetModule = (selectedSource !== 'all' ? selectedSource : 'general') as NonConformanceSourceModule;
    setFormData({
      title: '',
      sourceModule: targetModule,
      sourceRecordId: '',
      sourceTitle: '',
      unitName: orgUnitsList[0] || '',
      riskLevel: 'MEDIUM',
      category: 'ایمنی و بهداشت',
      description: '',
      evidence: '',
      immediateAction: '',
      rootCause: '',
      correctiveAction: '',
      preventiveAction: '',
      assignedTo: '',
      assignedToName: '',
      dueDate: new Date().toLocaleDateString('fa-IR'),
      status: 'REGISTERED'
    });
    loadSourceModuleRecords(targetModule);
    setIsModalOpen(true);
  };

  const handleSelectSourceItem = (itemId: string) => {
    setSelectedSourceItem(itemId);
    if (!itemId) {
      setDuplicateWarning(null);
      return;
    }
    const item = availableSourceItems.find(it => it.id === itemId);
    if (!item) return;

    // Check duplicate in existing records to prevent data redundancy
    const duplicate = records.find(r =>
      r.sourceModule === formData.sourceModule &&
      (r.sourceRecordId === item.code || r.sourceRecordId === item.id)
    );
    if (duplicate) {
      setDuplicateWarning(duplicate);
    } else {
      setDuplicateWarning(null);
    }

    setFormData(prev => ({
      ...prev,
      sourceRecordId: item.code || item.id,
      sourceTitle: item.title,
      title: prev.title?.trim() ? prev.title : `عدم انطباق ناشی از ${SOURCE_MODULE_LABELS[prev.sourceModule || 'general']?.fa || ''}: ${item.title}`,
      unitName: item.unit || prev.unitName,
      riskLevel: item.risk || prev.riskLevel,
      description: prev.description?.trim() ? prev.description : (item.description || `مغایرت و شرایط ناایمن شناسایی‌شده در ${item.title} (${item.code})`)
    }));
  };

  const handleOpenEdit = (rec: NonConformanceRecord) => {
    setEditingRecord(rec);
    setFormData({ ...rec });
    setIsModalOpen(true);
  };

  const handleOpenView = (rec: NonConformanceRecord) => {
    setSelectedRecord(rec);
    setIsViewModalOpen(true);
  };

  // Safe exit handlers without saving any changes
  const handleCloseModalWithoutChanges = () => {
    setIsModalOpen(false);
    setEditingRecord(null);
    setFormData({});
    setSelectedSourceItem('');
    setDuplicateWarning(null);
  };

  const handleCloseViewModalWithoutChanges = () => {
    setIsViewModalOpen(false);
    setSelectedRecord(null);
  };

  // Submit Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.description?.trim()) {
      alert('لطفاً عنوان و شرح کامل عدم انطباق را تکمیل فرمایید.');
      return;
    }

    try {
      const actor = currentUser?.fullName || currentUser?.username || 'کارشناس HSE';
      if (editingRecord && editingRecord.id) {
        await nonConformanceService.update(editingRecord.id, formData, actor);
      } else {
        await nonConformanceService.create(formData, actor);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(`خطا در ذخیره عدم انطباق در پایگاه داده: ${err?.message || err}`);
    }
  };

  // Multi-Selection State
  const [selectedRecordKeys, setSelectedRecordKeys] = useState<Set<string | number>>(new Set());

  // Open Delete Modal
  const handleOpenDeleteModal = (recs: NonConformanceRecord[]) => {
    if (recs.length === 0) return;
    setRecordsToDelete(recs);
    setIsDeleteModalOpen(true);
  };

  // Confirm Delete Handler
  const handleConfirmDelete = async () => {
    if (recordsToDelete.length === 0) return;
    try {
      const actor = currentUser?.fullName || currentUser?.username || 'مدیر سیستم';
      const ids = recordsToDelete.map(r => r.id || r.trackingCode);

      if (ids.length === 1) {
        await nonConformanceService.delete(ids[0], actor);
      } else {
        await nonConformanceService.deleteBatch(ids, actor);
      }

      setIsDeleteModalOpen(false);
      if (isViewModalOpen && recordsToDelete.some(r => r.trackingCode === selectedRecord?.trackingCode)) {
        setIsViewModalOpen(false);
      }
      setSelectedRecordKeys(new Set());
      setAlertSuccessToast(
        ids.length === 1
          ? `پرونده عدم انطباق «${recordsToDelete[0].trackingCode}» با موفقیت حذف گردید.`
          : `تعداد ${ids.length} پرونده عدم انطباق انتخابی با موفقیت حذف گردیدند.`
      );
      setTimeout(() => setAlertSuccessToast(null), 4000);
      loadData();
    } catch (err: any) {
      alert(`خطا در حذف عدم انطباق: ${err?.message || err}`);
    }
  };

  // Open Workflow Transition
  const handleOpenWorkflowAction = (rec: NonConformanceRecord, nextStatus: NonConformanceWorkflowStatus) => {
    setSelectedRecord(rec);
    setWorkflowActionType(nextStatus);
    setWorkflowNote('');
    setEffectivenessNotes('');
    setEffectivenessVerified(true);
    setIsWorkflowModalOpen(true);
  };

  const handleExecuteWorkflow = async () => {
    if (!selectedRecord || !selectedRecord.id) return;
    try {
      const actor = currentUser?.fullName || currentUser?.username || 'مسئول بررسی و اقدام';
      const extraPayload: Partial<NonConformanceRecord> = {};
      if (workflowActionType === 'CLOSED' || workflowActionType === 'EFFECTIVENESS_REVIEW') {
        extraPayload.effectivenessVerified = effectivenessVerified;
        extraPayload.effectivenessNotes = effectivenessNotes || workflowNote;
        if (workflowActionType === 'CLOSED') {
          extraPayload.completionDate = new Date().toLocaleDateString('fa-IR');
        }
      }

      await nonConformanceService.advanceWorkflow(
        selectedRecord.id,
        workflowActionType,
        workflowNote || `تغییر وضعیت به ${WORKFLOW_STATUS_CONFIG[workflowActionType]?.fa}`,
        extraPayload,
        actor
      );

      setIsWorkflowModalOpen(false);
      if (isViewModalOpen) {
        const updated = await nonConformanceService.getById(selectedRecord.id);
        if (updated) setSelectedRecord(updated);
      }
      loadData();
    } catch (err: any) {
      alert(`خطا در اجرای فرآیند گردش کار: ${err?.message || err}`);
    }
  };

  // Referral Action Handler
  const handleOpenReferModal = (rec: NonConformanceRecord) => {
    setSelectedRecord(rec);
    setReferSearch('');
    const existingUser = systemUsers.find(u => u.id === rec.assignedTo || u.username === rec.assignedTo) || systemUsers[0];
    setSelectedAssigneeUser(existingUser || null);
    setReferDeadline(rec.dueDate || moment().add(3, 'days').format('jYYYY/jMM/jDD'));
    setReferInstructions(rec.currentStageAssignee?.instructions || '');
    setReferActionType(rec.currentStageAssignee?.actionType || 'APPROVE_AND_SIGN');
    setIsReferModalOpen(true);
  };

  const handleExecuteRefer = async () => {
    if (!selectedRecord || !selectedRecord.id || !selectedAssigneeUser) {
      alert('لطفاً کاربر مسئول را جهت ارجاع انتخاب فرمایید.');
      return;
    }
    try {
      const actor = currentUser?.fullName || currentUser?.username || 'کارشناس HSE';
      const actorRole = currentUser?.role || 'مسئول HSE';
      const assigneeInfo: CurrentStageAssignee = {
        userId: selectedAssigneeUser.id || selectedAssigneeUser.username || selectedAssigneeUser.personnelCode,
        userName: selectedAssigneeUser.fullName || selectedAssigneeUser.name || selectedAssigneeUser.username,
        userRole: selectedAssigneeUser.role || selectedAssigneeUser.jobTitle || 'مسئول پیگیری',
        department: selectedAssigneeUser.departmentIds?.[0] || selectedAssigneeUser.unit || selectedAssigneeUser.department || selectedRecord.unitName || '',
        deadline: referDeadline,
        instructions: referInstructions || 'اقدام اصلاحی و بازخورد در سامانه عدم انطباق',
        actionType: referActionType,
      };

      const updated = await nonConformanceService.referToUser(selectedRecord.id, assigneeInfo, actor, actorRole);
      setSelectedRecord(updated);
      setIsReferModalOpen(false);
      setAlertSuccessToast(`پرونده عدم انطباق با موفقیت به «${assigneeInfo.userName}» ارجاع گردید و در کارتابل ایشان ثبت شد.`);
      setTimeout(() => setAlertSuccessToast(null), 4000);
      loadData();
    } catch (err: any) {
      alert(`خطا در ارجاع پرونده: ${err?.message || err}`);
    }
  };

  // Signature Action Handler
  const handleOpenSignatureModal = (rec: NonConformanceRecord, stage?: NonConformanceWorkflowStatus) => {
    setSelectedRecord(rec);
    const target = stage || rec.status;
    setSignatureTargetStage(target);
    const existingSig = rec.stageSignatures?.[target];
    setSignerName(existingSig?.signerName || currentUser?.fullName || currentUser?.username || 'مسئول بررسی و اقدام');
    setSignerRole(existingSig?.signerRole || currentUser?.role || 'کارشناس HSE');
    setSignatureStatus(existingSig?.status || 'SIGNED');
    setSignatureNotes(existingSig?.notes || '');
    setSignatureImage(existingSig?.signatureImage || currentUser?.digitalSignature || currentUser?.signatureImage || null);
    setIsSignatureModalOpen(true);
  };

  const handleExecuteSignature = async () => {
    if (!selectedRecord || !selectedRecord.id) return;
    if (signatureStatus === 'SIGNED' && !signatureImage) {
      alert('لطفاً پیش از تأیید، امضای الکترونیکی خود را ترسیم فرمایید.');
      return;
    }
    try {
      const actor = currentUser?.fullName || currentUser?.username || signerName || 'مسئول امضا';
      const sigInfo: StageSignatureInfo = {
        signerName: signerName || actor,
        signerRole,
        signerId: currentUser?.id,
        signedAt: new Date().toISOString(),
        signedAtJalali: moment().format('jYYYY/jMM/jDD HH:mm'),
        signatureImage: signatureImage || undefined,
        notes: signatureNotes || undefined,
        status: signatureStatus
      };

      const updated = await nonConformanceService.recordStageSignature(
        selectedRecord.id,
        signatureTargetStage,
        sigInfo,
        actor
      );

      setSelectedRecord(updated);
      setIsSignatureModalOpen(false);
      setAlertSuccessToast(`امضای الکترونیکی مرحله «${WORKFLOW_STATUS_CONFIG[signatureTargetStage]?.fa}» با موفقیت ثبت و تأیید گردید.`);
      setTimeout(() => setAlertSuccessToast(null), 4000);
      loadData();
    } catch (err: any) {
      alert(`خطا در ثبت امضای الکترونیکی: ${err?.message || err}`);
    }
  };

  // Cancellation Action Handler
  const handleOpenCancelModal = (rec: NonConformanceRecord) => {
    setCancelRecordTarget(rec);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleExecuteCancel = async () => {
    if (!cancelRecordTarget || !cancelRecordTarget.id) return;
    if (!cancelReason.trim()) {
      alert('ثبت علت انصراف از فرآیند الزامی است.');
      return;
    }
    try {
      const actor = currentUser?.fullName || currentUser?.username || 'کاربر سامانه';
      const actorRole = currentUser?.role || 'مدیر / مسئول HSE';
      const updated = await nonConformanceService.cancelWorkflow(
        cancelRecordTarget.id,
        cancelReason.trim(),
        actor,
        actorRole
      );

      if (selectedRecord?.id === cancelRecordTarget.id) {
        setSelectedRecord(updated);
      }
      setIsCancelModalOpen(false);
      setAlertSuccessToast(`فرآیند پرونده ${cancelRecordTarget.trackingCode} با ثبت علت انصراف متوقف گردید. کلیه سوابق قبلی در پایگاه داده حفظ شده‌اند.`);
      setTimeout(() => setAlertSuccessToast(null), 5000);
      loadData();
    } catch (err: any) {
      alert(`خطا در انصراف از فرآیند: ${err?.message || err}`);
    }
  };

  // Step Back Action Handler
  const handleOpenStepBackModal = (rec: NonConformanceRecord) => {
    setSelectedRecord(rec);
    const prev = getPreviousWorkflowStatus(rec.status);
    if (!prev) {
      alert('این پرونده در مرحله اولیه قرار دارد و امکان بازگشت به مرحله قبل وجود ندارد.');
      return;
    }
    setStepBackTargetStage(prev);
    setStepBackReason('');
    setIsStepBackModalOpen(true);
  };

  const handleExecuteStepBack = async () => {
    if (!selectedRecord || !selectedRecord.id || !stepBackTargetStage) return;
    if (!stepBackReason.trim()) {
      alert('ثبت علت بازگشت به مرحله قبلی الزامی است.');
      return;
    }
    try {
      const actor = currentUser?.fullName || currentUser?.username || 'کارشناس HSE';
      const actorRole = currentUser?.role || 'مسئول ارزیابی';
      const updated = await nonConformanceService.stepBackWorkflow(
        selectedRecord.id,
        stepBackTargetStage,
        stepBackReason.trim(),
        actor,
        actorRole
      );

      setSelectedRecord(updated);
      setIsStepBackModalOpen(false);
      setAlertSuccessToast(`پرونده با موفقیت به مرحله «${WORKFLOW_STATUS_CONFIG[stepBackTargetStage]?.fa}» بازگردانده شد.`);
      setTimeout(() => setAlertSuccessToast(null), 4000);
      loadData();
    } catch (err: any) {
      alert(`خطا در بازگشت به مرحله قبل: ${err?.message || err}`);
    }
  };

  const handleExecuteReopenCancelled = async (rec: NonConformanceRecord) => {
    if (!confirm(`آیا از بازگشایی مجدد پرونده منصرف‌شده ${rec.trackingCode} و ادامه گردش کار اطمینان دارید؟`)) {
      return;
    }
    try {
      const actor = currentUser?.fullName || currentUser?.username || 'مدیر سیستم';
      const actorRole = currentUser?.role || 'مدیر HSE';
      const updated = await nonConformanceService.reopenCancelled(
        rec.id!,
        'تصمیم مدیریت جهت خروج از وضعیت انصراف و پیگیری مجدد',
        'UNDER_EVALUATION',
        actor,
        actorRole
      );
      setSelectedRecord(updated);
      setAlertSuccessToast(`پرونده ${rec.trackingCode} مجدداً بازگشایی و به مرحله بررسی منتقل گردید.`);
      setTimeout(() => setAlertSuccessToast(null), 4000);
      loadData();
    } catch (err: any) {
      alert(`خطا در بازگشایی پرونده: ${err?.message || err}`);
    }
  };

  // Excel Export
  const handleExportExcel = () => {
    if (records.length === 0) {
      alert('داده‌ای برای خروجی اکسل وجود ندارد.');
      return;
    }
    const exportRows = filteredRecords.map((r, idx) => ({
      'ردیف': idx + 1,
      'کد رهگیری': r.trackingCode,
      'عنوان عدم انطباق': r.title,
      'ماژول مبدأ': SOURCE_MODULE_LABELS[r.sourceModule]?.fa || r.sourceModule,
      'مرجع مبدأ': r.sourceTitle || r.sourceRecordId || '-',
      'واحد سازمانی': r.unitName || '-',
      'سطح ریسک': RISK_LEVEL_CONFIG[r.riskLevel]?.fa || r.riskLevel,
      'وضعیت پیگیری': WORKFLOW_STATUS_CONFIG[r.status]?.fa || r.status,
      'مسئول اقدام': r.assignedToName || r.assignedTo || '-',
      'مهلت اقدام': r.dueDate || '-',
      'اقدام اصلاحی (CAPA)': r.correctiveAction || '-',
      'اقدام پیشگیرانه': r.preventiveAction || '-',
      'اثربخشی تأیید شده': r.effectivenessVerified ? 'بله' : 'خیر',
      'تاریخ ثبت': r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'عدم_انطباق_CAPA');
    XLSX.writeFile(wb, `HSECORE_NonConformances_${Date.now()}.xlsx`);
  };

  return (
    <div className="w-full p-4 md:p-6 space-y-6 max-w-7xl 2xl:max-w-[1720px] mx-auto text-slate-800 dark:text-slate-100" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 rounded-3xl text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">
                {isFa ? 'سامانه جامع مدیریت عدم انطباق و اقدامات اصلاحی (CAPA)' : 'Enterprise Non-Conformity Management (CAPA)'}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-sm border border-white/30">
                Database Authoritative
              </span>
            </div>
            <p className="text-xs text-amber-100 mt-1">
              {isFa
                ? 'شناسایی، ثبت، ارجاع و گردش کار اصلاحی و پیشگیرانه متصل به کلیه ماژول‌ها، چک‌لیست‌ها، بازرسی‌ها، حوادث و پروانه‌های کار'
                : 'Centralized non-conformance logging, multi-module linking, root-cause investigation and CAPA effectiveness tracking.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            title={isFa ? 'بارگذاری مجدد از دیتابیس' : 'Reload from Database'}
            className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl transition border border-white/20 flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isFa ? 'همگام‌سازی' : 'Sync'}</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl transition border border-white/20 flex items-center gap-2 text-xs font-bold"
          >
            <Download className="w-4 h-4" />
            <span>{isFa ? 'خروجی اکسل' : 'Excel'}</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-white text-amber-700 hover:bg-amber-50 active:scale-95 rounded-xl font-black text-xs shadow-md transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ثبت عدم انطباق جدید' : 'New Non-Conformance'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold">{isFa ? 'کل پرونده‌ها' : 'Total NCs'}</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-slate-800 dark:text-white">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">{isFa ? 'ثبت‌شده در تمام ماژول‌ها' : 'All source modules'}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold">{isFa ? 'موارد باز / ارزیابی' : 'Open / Eval'}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-amber-600 dark:text-amber-400">{stats.open}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">{isFa ? 'نیاز به تعیین تکلیف' : 'Action required'}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold">{isFa ? 'در حال اقدام CAPA' : 'CAPA Active'}</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-purple-600 dark:text-purple-400">{stats.inProgress}</div>
          <div className="text-[11px] text-purple-600/80 mt-1">{isFa ? 'اقدامات در حال انجام' : 'In execution'}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold">{isFa ? 'ریسک بالا و بحرانی' : 'High / Critical'}</span>
            <AlertOctagon className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-rose-600 dark:text-rose-400">{stats.critical}</div>
          <div className="text-[11px] text-rose-600/80 mt-1">{isFa ? 'نیازمند مداخله فوری' : 'Urgent priority'}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold">{isFa ? 'بسته شده و اثربخش' : 'Closed Effective'}</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.closed}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">{isFa ? 'اقدامات خاتمه‌یافته' : 'Resolved'}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold">{isFa ? 'نرخ اثربخشی CAPA' : 'CAPA Success Rate'}</span>
            <TrendingUp className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-3 text-2xl font-black text-cyan-600 dark:text-cyan-400">{stats.resolutionRate}%</div>
          <div className="text-[11px] text-cyan-600/80 mt-1">{isFa ? 'شاخص اثربخشی سامانه' : 'Effectiveness metric'}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isFa ? 'جستجو بر اساس عنوان، کد رهگیری، واحد، مسئول یا شرح عدم انطباق...' : 'Search by title, tracking code, unit or description...'}
            className="w-full pr-10 pl-4 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Source Module Filter */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{isFa ? 'همه ماژول‌های مبدأ' : 'All Source Modules'}</option>
            {Object.entries(SOURCE_MODULE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{isFa ? v.fa : v.en}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{isFa ? 'همه وضعیت‌های گردش‌کار' : 'All Workflow Statuses'}</option>
            {Object.entries(WORKFLOW_STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{isFa ? v.fa : v.en}</option>
            ))}
          </select>

          {/* Risk Level Filter */}
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">{isFa ? 'همه سطوح ریسک' : 'All Risk Levels'}</option>
            {Object.entries(RISK_LEVEL_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{isFa ? v.fa : v.en}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toast Feedback */}
      {alertSuccessToast && (
        <div className="p-3.5 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{alertSuccessToast}</span>
          </div>
          <button onClick={() => setAlertSuccessToast(null)} className="p-1 hover:bg-white/20 rounded-lg">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Overdue Warnings Alert Banner */}
      {overdueRecords.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 dark:from-rose-950/40 dark:via-orange-950/40 dark:to-amber-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-rose-900 dark:text-rose-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-md animate-pulse shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="font-black text-sm">
                {isFa ? `هشدار عدم انطباق‌های سررسیدگذشته: ${overdueRecords.length} پرونده از مهلت اقدام فراتر رفته‌اند!` : `${overdueRecords.length} Non-conformances have passed their due date!`}
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                {isFa ? 'اقدامات اصلاحی و پیشگیرانه (CAPA) این پرونده‌ها نیازمند تسریع، پیگیری و ارسال یادآوری فوری به مسئولان مربوطه است.' : 'Immediate follow-up required from responsible persons.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleBroadcastOverdueAlerts}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0"
          >
            <Bell className="w-4 h-4" />
            <span>{isFa ? 'ارسال اعلان هشدار به کلیه مسئولان' : 'Dispatch Overdue Alerts'}</span>
          </button>
        </div>
      )}

      {/* Batch Action Bar */}
      {selectedRecordKeys.size > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border border-amber-500/30 dark:bg-amber-950/40 rounded-2xl p-3.5 flex items-center justify-between text-xs font-bold shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{isFa ? `تعداد ${selectedRecordKeys.size} پرونده عدم انطباق انتخاب شده است` : `${selectedRecordKeys.size} records selected`}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedRecordKeys(new Set())}
              className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {isFa ? 'لغو انتخاب' : 'Clear Selection'}
            </button>
            <button
              onClick={() => {
                const recs = filteredRecords.filter(r => selectedRecordKeys.has(r.id || r.trackingCode));
                handleOpenDeleteModal(recs);
              }}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm font-bold"
            >
              <Trash2 className="w-4 h-4" />
              <span>{isFa ? `حذف موارد انتخابی (${selectedRecordKeys.size})` : 'Delete Selected'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Records Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs font-bold">{isFa ? 'در حال بارگذاری اطلاعات از پایگاه داده...' : 'Loading data from database...'}</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <ShieldAlert className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {isFa ? 'هیچ عدم انطباقی با فیلترهای انتخابی یافت نشد.' : 'No non-conformances match selected filters.'}
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'ثبت اولین عدم انطباق' : 'Register First Non-Conformance'}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] font-black border-b border-slate-200 dark:border-slate-800 select-none">
                  <th className="py-3 px-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={filteredRecords.length > 0 && selectedRecordKeys.size === filteredRecords.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRecordKeys(new Set(filteredRecords.map(r => r.id || r.trackingCode)));
                        } else {
                          setSelectedRecordKeys(new Set());
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      title={isFa ? 'انتخاب / لغو انتخاب همه' : 'Select All'}
                    />
                  </th>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-4">{isFa ? 'کد رهگیری و عنوان' : 'Code & Title'}</th>
                  <th className="py-3 px-4">{isFa ? 'ماژول مبدأ و ارجاع' : 'Source Module'}</th>
                  <th className="py-3 px-4">{isFa ? 'واحد سازمانی' : 'Unit'}</th>
                  <th className="py-3 px-4">{isFa ? 'سطح ریسک' : 'Risk'}</th>
                  <th className="py-3 px-4">{isFa ? 'وضعیت گردش کار (CAPA)' : 'Workflow Status'}</th>
                  <th className="py-3 px-4">{isFa ? 'مسئول و مهلت اقدام' : 'Assignee & Due Date'}</th>
                  <th className="py-3 px-4 text-center w-36">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredRecords.map((rec, index) => {
                  const sourceConfig = SOURCE_MODULE_LABELS[rec.sourceModule] || SOURCE_MODULE_LABELS.general;
                  const riskConfig = RISK_LEVEL_CONFIG[rec.riskLevel] || RISK_LEVEL_CONFIG.MEDIUM;
                  const statusConfig = WORKFLOW_STATUS_CONFIG[rec.status] || WORKFLOW_STATUS_CONFIG.REGISTERED;
                  const key = rec.id || rec.trackingCode;
                  const isChecked = selectedRecordKeys.has(key);

                  return (
                    <tr
                      key={key}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group ${isChecked ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}
                    >
                      <td className="py-3.5 px-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newSet = new Set(selectedRecordKeys);
                            if (e.target.checked) newSet.add(key);
                            else newSet.delete(key);
                            setSelectedRecordKeys(newSet);
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                              {rec.trackingCode}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {rec.title}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {rec.description}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sourceConfig.color}`}>
                            {isFa ? sourceConfig.fa : sourceConfig.en}
                          </span>
                          {rec.sourceTitle && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 font-mono">
                              {rec.sourceTitle}
                            </span>
                          )}
                          {onNavigateToModule && (
                            <button
                              onClick={() => onNavigateToModule(SOURCE_MODULE_TAB_MAP[rec.sourceModule] || 'dashboard')}
                              className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 hover:underline font-bold mt-0.5 cursor-pointer"
                              title={isFa ? 'انتقال و مشاهده مستقیم در ماژول مبدأ' : 'Open in origin module'}
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>{isFa ? 'مشاهده در ماژول مبدأ' : 'Module'}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{rec.unitName || 'عمومی'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-black border ${riskConfig.badge} ${riskConfig.border}`}>
                          {isFa ? riskConfig.fa : riskConfig.en}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusConfig.badge} flex items-center gap-1`}>
                              {rec.status === 'CANCELLED' && <Ban className="w-3 h-3 text-rose-600" />}
                              <span>{isFa ? statusConfig.fa : statusConfig.en}</span>
                            </span>
                            {rec.effectivenessVerified && (
                              <span title={isFa ? 'اثربخشی اقدام تأیید شده است' : 'Effectiveness verified'}>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          {rec.stageSignatures && Object.keys(rec.stageSignatures).length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              <ShieldCheck className="w-3 h-3 text-indigo-600" />
                              <span>{Object.keys(rec.stageSignatures).length} امضای ثبت‌شده</span>
                            </span>
                          )}
                          {rec.status === 'CANCELLED' && rec.cancellationInfo?.reason && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 line-clamp-1 italic max-w-xs" title={rec.cancellationInfo.reason}>
                              علت: {rec.cancellationInfo.reason}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{rec.assignedToName || rec.assignedTo || (isFa ? 'تعیین‌نشده' : 'Unassigned')}</span>
                          </div>
                          {rec.currentStageAssignee?.userRole && (
                            <span className="text-[10px] text-slate-400">
                              {rec.currentStageAssignee.userRole}
                            </span>
                          )}
                          {rec.dueDate && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span>{rec.dueDate}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenView(rec)}
                            title={isFa ? 'مشاهده پرونده و گردش کار' : 'View & Workflow'}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenReferModal(rec)}
                            title={isFa ? 'ارجاع گردش کار به کاربر مشخص' : 'Refer to User'}
                            className="p-1.5 hover:bg-sky-50 dark:hover:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-lg transition cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenSignatureModal(rec)}
                            title={isFa ? 'امضای الکترونیکی مرحله' : 'Electronic Signature'}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg transition cursor-pointer"
                          >
                            <PenTool className="w-4 h-4" />
                          </button>
                          {rec.status !== 'CANCELLED' && rec.status !== 'CLOSED' && (
                            <button
                              onClick={() => handleOpenCancelModal(rec)}
                              title={isFa ? 'انصراف از فرآیند (ابطال با حفظ سوابق)' : 'Cancel Process'}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-500 hover:text-rose-700 rounded-lg transition cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {rec.status === 'CANCELLED' && (
                            <button
                              onClick={() => handleExecuteReopenCancelled(rec)}
                              title={isFa ? 'خروج از وضعیت انصراف و بازگشایی پرونده' : 'Reopen Cancelled'}
                              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg transition cursor-pointer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEdit(rec)}
                            title={isFa ? 'ویرایش اطلاعات' : 'Edit'}
                            className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg transition cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal([rec])}
                            title={isFa ? 'حذف عدم انطباق' : 'Delete'}
                            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create / Edit Non-Conformance */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl overflow-hidden my-8"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm shadow-inner">
                  <ShieldAlert className="w-6 h-6 text-amber-200" />
                </div>
                <div>
                  <h3 className="text-lg font-black">
                    {editingRecord ? (isFa ? 'ویرایش و پیگیری عدم انطباق' : 'Edit & Track Non-Conformance') : (isFa ? 'ثبت و پیگیری عدم انطباق (CAPA)' : 'Register & Track Non-Conformance')}
                  </h3>
                  <p className="text-[11px] text-amber-100 mt-0.5">
                    {isFa ? 'سامانه یکپارچه ثبت و پیگیری عدم انطباق‌ها و اقدامات اصلاحی' : 'Non-Conformance Logging & Corrective Action System'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModalWithoutChanges}
                  title={isFa ? 'بستن فرم و خروج بدون هیچ‌گونه تغییرات' : 'Close form without changes'}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl transition text-white cursor-pointer border border-rose-400/80 text-xs font-bold shadow-md"
                >
                  <X className="w-4 h-4 text-white" />
                  <span>{isFa ? 'بستن فرم (خروج بدون تغییرات)' : 'Close'}</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Quick exit field / notice bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/90 dark:border-rose-900/60 rounded-2xl text-xs">
                <div className="flex items-center gap-2.5 text-rose-950 dark:text-rose-200">
                  <div className="p-1.5 bg-rose-100 dark:bg-rose-900/60 rounded-lg text-rose-600 dark:text-rose-400 shrink-0">
                    <X className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold block">
                      {isFa ? 'بستن فرم و خروج بدون اعمال هیچ‌گونه تغییرات' : 'Exit Form Without Saving Modifications'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isFa ? 'در صورت انصراف در هر مرحله، با کلیک روی دکمه خروج یا آیکون ضربدر (✕) فرم بدون تغییرات بسته می‌شود.' : 'Click close to discard all inputs and safely exit.'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModalWithoutChanges}
                  className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-700 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs text-xs shrink-0"
                  title={isFa ? 'بستن فرم بدون اعمال تغییرات' : 'Close without saving'}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isFa ? 'خروج بدون تغییرات (بستن)' : 'Discard & Exit'}</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'عنوان عدم انطباق *' : 'Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={isFa ? 'مثال: نشتی روغن از هیدرولیک جرثقیل در سایت' : 'e.g. Oil leakage in crane hydraulic system'}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'ماژول مبدأ *' : 'Source Module *'}
                  </label>
                  <select
                    value={formData.sourceModule || 'general'}
                    onChange={(e) => {
                      const mod = e.target.value as NonConformanceSourceModule;
                      setFormData({ ...formData, sourceModule: mod });
                      setSelectedSourceItem('');
                      setDuplicateWarning(null);
                      loadSourceModuleRecords(mod);
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {Object.entries(SOURCE_MODULE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{isFa ? v.fa : v.en}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Related Module Records Selector & Duplicate Detection */}
              {formData.sourceModule && formData.sourceModule !== 'general' && (
                <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-600" />
                      <span>{isFa ? `دریافت مستقیم اطلاعات از ماژول «${SOURCE_MODULE_LABELS[formData.sourceModule]?.fa}»:` : 'Import from module:'}</span>
                    </label>
                    {loadingSourceItems && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>{isFa ? 'در حال بازیابی...' : 'Loading...'}</span>
                      </span>
                    )}
                  </div>

                  {availableSourceItems.length > 0 ? (
                    <div>
                      <select
                        value={selectedSourceItem}
                        onChange={(e) => handleSelectSourceItem(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">{isFa ? '-- انتخاب رکورد مرتبط جهت بارگذاری خودکار و پیشگیری از ثبت تکراری --' : '-- Select record to auto-fill --'}</option>
                        {availableSourceItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.code} | {item.title} {item.unit ? `(${item.unit})` : ''}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                        {isFa ? 'با انتخاب رکورد، عنوان، شماره مرجع، واحد سازمانی، سطح ریسک و شرح شرایط ناایمن بدون ثبت تکراری تکمیل می‌شوند.' : 'Auto-fills all details and prevents redundant records.'}
                      </span>
                    </div>
                  ) : !loadingSourceItems ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isFa ? 'رکوردی در پایگاه داده برای این ماژول یافت نشد یا می‌توانید به صورت دستی شماره مرجع مبدأ را وارد نمایید.' : 'No records found. You can enter reference manually.'}
                    </p>
                  ) : null}

                  {duplicateWarning && (
                    <div className="p-3 bg-amber-100/80 dark:bg-amber-950/70 border border-amber-400 dark:border-amber-700 rounded-xl flex items-center justify-between text-xs text-amber-950 dark:text-amber-200">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <div>
                          <strong className="block">{isFa ? 'هشدار عدم انطباق تکراری:' : 'Duplicate Warning:'}</strong>
                          <span className="text-[11px]">
                            {isFa ? `این مورد قبلاً تحت کد رهگیری ${duplicateWarning.trackingCode} در سامانه ثبت شده است.` : `Already registered as ${duplicateWarning.trackingCode}.`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModalOpen(false);
                          handleOpenView(duplicateWarning);
                        }}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition shrink-0 cursor-pointer shadow-xs"
                      >
                        {isFa ? 'مشاهده و پیگیری پرونده' : 'Open Existing'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'واحد سازمانی مسئول' : 'Responsible Unit'}
                  </label>
                  <select
                    value={formData.unitName || ''}
                    onChange={(e) => setFormData({ ...formData, unitName: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="">{isFa ? 'انتخاب واحد سازمانی...' : 'Select unit...'}</option>
                    {orgUnitsList.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'سطح ریسک *' : 'Risk Level *'}
                  </label>
                  <select
                    value={formData.riskLevel || 'MEDIUM'}
                    onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value as NonConformanceRiskLevel })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {Object.entries(RISK_LEVEL_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{isFa ? v.fa : v.en}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'شناسه/شماره ارجاع مبدأ' : 'Source Reference ID'}
                  </label>
                  <input
                    type="text"
                    value={formData.sourceRecordId || ''}
                    onChange={(e) => setFormData({ ...formData, sourceRecordId: e.target.value })}
                    placeholder={isFa ? 'مثال: PTW-1404-023 یا CHK-09' : 'e.g. PTW-1404-023'}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'شرح کامل عدم انطباق و یافته‌های بازرسی *' : 'Full Description & Findings *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={isFa ? 'شرح دقیق شرایط ناایمن، عدم رعایت الزامات استاندارد یا آیین‌نامه‌ها...' : 'Describe non-conformity in detail...'}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'اقدام فوری / مهار آنی انحراف (Immediate Containment)' : 'Immediate Action'}
                </label>
                <input
                  type="text"
                  value={formData.immediateAction || ''}
                  onChange={(e) => setFormData({ ...formData, immediateAction: e.target.value })}
                  placeholder={isFa ? 'اقدام اولیه جهت توقف خطر یا ایمن‌سازی فوری محل...' : 'Immediate action taken...'}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'تحلیل ریشه‌ای (Root Cause Analysis)' : 'Root Cause'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.rootCause || ''}
                    onChange={(e) => setFormData({ ...formData, rootCause: e.target.value })}
                    placeholder={isFa ? 'علت ریشه‌ای وقوع مغایرت (بر اساس تکنیک ۵ چرا، نمودار پارتو یا علل زمینه‌ای)...' : 'Root cause analysis...'}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'اقدام اصلاحی (Corrective Action)' : 'Corrective Action'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.correctiveAction || ''}
                    onChange={(e) => setFormData({ ...formData, correctiveAction: e.target.value })}
                    placeholder={isFa ? 'اقدام اصلاحی مشخص جهت رفع نقص و بازگرداندن شرایط به استاندارد...' : 'Corrective action plan...'}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'اقدام پیشگیرانه (Preventive Action)' : 'Preventive Action'}
                  </label>
                  <input
                    type="text"
                    value={formData.preventiveAction || ''}
                    onChange={(e) => setFormData({ ...formData, preventiveAction: e.target.value })}
                    placeholder={isFa ? 'اقدام پیشگیرانه جهت جلوگیری از تکرار مجدد...' : 'Preventive action plan...'}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'مسئول پیگیری / اجرا' : 'Assignee'}
                  </label>
                  <input
                    type="text"
                    list="nc-assignees-list"
                    value={formData.assignedToName || ''}
                    onChange={(e) => setFormData({ ...formData, assignedToName: e.target.value, assignedTo: e.target.value })}
                    placeholder={isFa ? 'انتخاب از لیست یا درج نام مسئول...' : 'Assignee name...'}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                  <datalist id="nc-assignees-list">
                    {systemUsers.map((u: any) => (
                      <option key={u.id || u.username} value={u.fullName || u.name || u.username}>
                        {u.role ? `کاربر سامانه - ${u.role}` : 'کاربر سامانه'}
                      </option>
                    ))}
                    {personnelList.slice(0, 30).map((p: any) => (
                      <option key={p.id || p.personnelCode} value={p.fullName || p.name}>
                        {p.jobTitle || p.unit ? `${p.jobTitle || ''} (${p.unit || ''})` : 'پرسنل'}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'مهلت اقدام (Due Date)' : 'Due Date'}
                  </label>
                  <input
                    type="text"
                    value={formData.dueDate || ''}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    placeholder="1404/05/15"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseModalWithoutChanges}
                  className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-300 transition flex items-center justify-center gap-2 cursor-pointer border border-slate-300 dark:border-slate-700 shadow-xs"
                  title={isFa ? 'انصراف و بستن فرم بدون هیچ‌گونه تغییرات' : 'Close and discard changes'}
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{isFa ? 'بستن فرم و خروج بدون تغییرات' : 'Cancel & Exit'}</span>
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isFa ? 'ذخیره در پایگاه داده' : 'Save to database'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Details & Workflow Action */}
      {isViewModalOpen && selectedRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsViewModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl overflow-hidden my-8"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-500/30">
                  <ShieldAlert className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-amber-300">
                      {selectedRecord.trackingCode}
                    </span>
                    <h3 className="text-base font-black">{selectedRecord.title}</h3>
                  </div>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    {isFa ? 'فرم ثبت و پیگیری عدم انطباق سازمانی (مشاهده و گردش کار)' : 'Non-Conformance Electronic Record & Tracking'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onNavigateToModule && selectedRecord.sourceModule && (
                  <button
                    onClick={() => {
                      handleCloseViewModalWithoutChanges();
                      onNavigateToModule(SOURCE_MODULE_TAB_MAP[selectedRecord.sourceModule] || 'dashboard');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition border border-amber-500/40 cursor-pointer"
                    title={isFa ? 'انتقال و مشاهده مستقیم در ماژول مبدأ' : 'Open in Origin Module'}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isFa ? `مشاهده در ${SOURCE_MODULE_LABELS[selectedRecord.sourceModule]?.fa}` : 'Open in Origin'}</span>
                  </button>
                )}

                {/* Close Button & X Icon */}
                <button
                  type="button"
                  onClick={handleCloseViewModalWithoutChanges}
                  title={isFa ? 'بستن فرم و خروج بدون هیچ‌گونه تغییرات' : 'Close form without changes'}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition border border-rose-400/80 cursor-pointer shadow-md"
                >
                  <X className="w-4 h-4 text-white" />
                  <span>{isFa ? 'بستن فرم (خروج بدون تغییرات)' : 'Close'}</span>
                </button>
              </div>
            </div>

            {/* Workflow Progress Steps */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs overflow-x-auto gap-2">
              {Object.entries(WORKFLOW_STATUS_CONFIG).map(([key, cfg]) => {
                const isCurrent = selectedRecord.status === key;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${
                      isCurrent
                        ? key === 'CANCELLED'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <span>{cfg.step > 0 ? `${cfg.step}.` : '•'}</span>
                    <span>{isFa ? cfg.fa : cfg.en}</span>
                  </div>
                );
              })}
            </div>

            {/* Cancellation Notice Banner if Cancelled */}
            {selectedRecord.status === 'CANCELLED' && (
              <div className="mx-6 mt-6 p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-rose-900 dark:text-rose-200">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm">
                      {isFa ? 'پرونده عدم انطباق منصرف‌شده (ابطال فرآیند)' : 'Non-Conformance Cancelled'}
                    </h4>
                    <p className="text-xs text-rose-800 dark:text-rose-300 font-bold mt-1">
                      {isFa ? 'علت انصراف ثبت‌شده:' : 'Cancellation Reason:'}{' '}
                      <span className="font-normal">{selectedRecord.cancellationInfo?.reason || 'علت ثبت نشده'}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-rose-700 dark:text-rose-400 mt-1.5">
                      <span>کاربر: {selectedRecord.cancellationInfo?.cancelledBy || '-'}</span>
                      {selectedRecord.cancellationInfo?.cancelledRole && (
                        <span>سمت: {selectedRecord.cancellationInfo.cancelledRole}</span>
                      )}
                      <span>زمان: {selectedRecord.cancellationInfo?.cancelledAtJalali || '-'}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        • کلیه سوابق قبلی در دیتابیس معتبر و محفوظ است
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleExecuteReopenCancelled(selectedRecord)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{isFa ? 'خروج از وضعیت انصراف و ادامه' : 'Reopen Workflow'}</span>
                </button>
              </div>
            )}

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto text-xs">
              {/* Primary Attributes */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block mb-0.5">{isFa ? 'ماژول مبدأ:' : 'Source Module:'}</span>
                  <span className="font-black text-slate-800 dark:text-white">
                    {SOURCE_MODULE_LABELS[selectedRecord.sourceModule]?.fa || selectedRecord.sourceModule}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{isFa ? 'واحد مسئول:' : 'Unit:'}</span>
                  <span className="font-black text-slate-800 dark:text-white">{selectedRecord.unitName || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{isFa ? 'سطح ریسک:' : 'Risk Level:'}</span>
                  <span className={`px-2 py-0.5 rounded font-black text-[11px] ${RISK_LEVEL_CONFIG[selectedRecord.riskLevel]?.badge}`}>
                    {RISK_LEVEL_CONFIG[selectedRecord.riskLevel]?.fa}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">{isFa ? 'مسئول پیگیری:' : 'Assignee:'}</span>
                  <span className="font-black text-slate-800 dark:text-white">{selectedRecord.assignedToName || selectedRecord.assignedTo || '-'}</span>
                </div>
              </div>

              {/* Current Assignee & Referral Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border border-sky-200 dark:border-sky-800/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-sky-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-sky-900 dark:text-sky-200">
                        {isFa ? 'مسئول اقدام و آخرین وضعیت ارجاع' : 'Current Assignee & Referral'}
                      </h4>
                      {selectedRecord.currentStageAssignee?.actionType && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-200 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                          {selectedRecord.currentStageAssignee.actionType}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300 mt-1">
                      <span className="font-bold">
                        کاربر مسئول: {selectedRecord.assignedToName || selectedRecord.assignedTo || 'تعیین‌نشده'}
                      </span>
                      {selectedRecord.currentStageAssignee?.userRole && (
                        <span className="text-slate-500">({selectedRecord.currentStageAssignee.userRole})</span>
                      )}
                      {selectedRecord.dueDate && (
                        <span className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          مهلت انجام: {selectedRecord.dueDate}
                        </span>
                      )}
                    </div>
                    {selectedRecord.currentStageAssignee?.instructions && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
                        دستور اقدام: «{selectedRecord.currentStageAssignee.instructions}»
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenReferModal(selectedRecord)}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isFa ? 'ارجاع به کاربر مشخص' : 'Refer to User'}</span>
                  </button>
                  <button
                    onClick={() => handleOpenSignatureModal(selectedRecord)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>{isFa ? 'امضای الکترونیکی' : 'Sign Stage'}</span>
                  </button>
                </div>
              </div>

              {/* Stage Signatures Matrix (شناسنامه و امضاهای دیجیتال مراحل) */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                  <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>{isFa ? 'شناسنامه و امضاهای الکترونیکی مراحل گردش کار' : 'Electronic Signatures Certificate'}</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {Object.keys(selectedRecord.stageSignatures || {}).length} از {WORKFLOW_STAGES_ORDER.length} مرحله امضا شده
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {WORKFLOW_STAGES_ORDER.map((stageKey) => {
                    const cfg = WORKFLOW_STATUS_CONFIG[stageKey];
                    const sig = selectedRecord.stageSignatures?.[stageKey];
                    const isSigned = Boolean(sig);

                    return (
                      <div
                        key={stageKey}
                        className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                          isSigned
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-800 dark:text-white text-xs">
                            {cfg.step}. {isFa ? cfg.fa : cfg.en}
                          </span>
                          {isSigned ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              {isFa ? 'امضا شده' : 'Signed'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                              {isFa ? 'در انتظار امضا' : 'Pending'}
                            </span>
                          )}
                        </div>

                        {isSigned && sig ? (
                          <div className="space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                              <span className="font-bold">{sig.signerName}</span>
                              <span className="text-slate-400 text-[10px]">{sig.signerRole}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {sig.signedAtJalali || new Date(sig.signedAt).toLocaleDateString('fa-IR')}
                            </div>
                            {sig.signatureImage && (
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 flex items-center justify-center">
                                <img src={sig.signatureImage} alt="Digital Signature" className="h-10 object-contain max-w-full" />
                              </div>
                            )}
                            {sig.notes && (
                              <p className="text-[10px] text-slate-500 italic mt-0.5">«{sig.notes}»</p>
                            )}
                          </div>
                        ) : (
                          <div className="pt-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              {isFa ? 'مسئول این مرحله هنوز امضا نکرده است' : 'Pending signature'}
                            </span>
                            <button
                              onClick={() => handleOpenSignatureModal(selectedRecord, stageKey)}
                              className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg border border-indigo-300 dark:border-indigo-700 transition cursor-pointer"
                            >
                              {isFa ? 'ثبت امضا' : 'Sign'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Description & Immediate Action */}
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>{isFa ? 'شرح عدم انطباق و مستندات' : 'Description'}</span>
                  </h4>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedRecord.description}
                  </p>
                </div>

                {selectedRecord.immediateAction && (
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                    <h4 className="font-black text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span>{isFa ? 'اقدام فوری و مهار آنی' : 'Immediate Containment'}</span>
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300">{selectedRecord.immediateAction}</p>
                  </div>
                )}
              </div>

              {/* Root Cause & CAPA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span>{isFa ? 'تحلیل ریشه‌ای (Root Cause)' : 'Root Cause'}</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300">{selectedRecord.rootCause || (isFa ? 'هنوز ثبت نشده است.' : 'Not recorded yet.')}</p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <h4 className="font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-500" />
                    <span>{isFa ? 'اقدام اصلاحی (CAPA Plan)' : 'CAPA Plan'}</span>
                  </h4>
                  <p className="text-slate-600 dark:text-slate-300">{selectedRecord.correctiveAction || (isFa ? 'هنوز تعریف نشده است.' : 'Not defined yet.')}</p>
                </div>
              </div>

              {/* Workflow & Referral History */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <h4 className="font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>{isFa ? 'سوابق جامع گردش کار، ارجاعات و امضاها' : 'Workflow & Referral Audit History'}</span>
                </h4>
                {selectedRecord.workflowHistory && selectedRecord.workflowHistory.length > 0 ? (
                  <div className="space-y-2.5">
                    {selectedRecord.workflowHistory.map((item, idx) => {
                      const isRef = item.action === 'REFERRAL';
                      const isSig = item.action === 'SIGNED';
                      const isStepBack = item.action === 'STEP_BACK';
                      const isCancel = item.action === 'CANCELLED';

                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                            isCancel
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                              : isRef
                              ? 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900'
                              : isSig
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900'
                              : isStepBack
                              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white ${
                              isCancel
                                ? 'bg-rose-600'
                                : isRef
                                ? 'bg-sky-600'
                                : isSig
                                ? 'bg-indigo-600'
                                : isStepBack
                                ? 'bg-amber-600'
                                : 'bg-slate-600'
                            }`}
                          >
                            {isCancel ? (
                              <Ban className="w-3.5 h-3.5" />
                            ) : isRef ? (
                              <Send className="w-3.5 h-3.5" />
                            ) : isSig ? (
                              <PenTool className="w-3.5 h-3.5" />
                            ) : isStepBack ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Activity className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-800 dark:text-white">{item.actor}</span>
                                {item.actorRole && (
                                  <span className="text-[10px] text-slate-400">({item.actorRole})</span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.persianDateTime || new Date(item.timestamp).toLocaleString('fa-IR')}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">{item.notes}</p>
                            {item.signature?.signatureImage && (
                              <div className="mt-2 inline-block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                                <img src={item.signature.signatureImage} alt="Signature" className="h-8 object-contain" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-400">{isFa ? 'تاریخچه‌ای برای این رکورد ثبت نشده است.' : 'No history entries.'}</p>
                )}
              </div>
            </div>

            {/* Workflow Action Bar */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  {isFa ? 'عملیات و گردش کار:' : 'Actions:'}
                </span>

                {/* Refer Button */}
                <button
                  onClick={() => handleOpenReferModal(selectedRecord)}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isFa ? 'ارجاع به کاربر' : 'Refer'}</span>
                </button>

                {/* Sign Button */}
                <button
                  onClick={() => handleOpenSignatureModal(selectedRecord)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{isFa ? 'امضای دیجیتال' : 'Sign'}</span>
                </button>

                {/* Step Back Button */}
                {selectedRecord.status !== 'REGISTERED' && selectedRecord.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleOpenStepBackModal(selectedRecord)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title={isFa ? 'بازگشت به مرحله قبلی فرآیند' : 'Step Back'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isFa ? 'بازگشت به مرحله قبل' : 'Step Back'}</span>
                  </button>
                )}

                {/* Cancel Process Button */}
                {selectedRecord.status !== 'CANCELLED' && (
                  <button
                    onClick={() => handleOpenCancelModal(selectedRecord)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title={isFa ? 'انصراف از فرآیند در هر مرحله با حفظ سوابق قبلی' : 'Cancel Process'}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{isFa ? 'انصراف از فرآیند' : 'Cancel'}</span>
                  </button>
                )}

                {/* Close Form Button Without Changes */}
                <button
                  type="button"
                  onClick={handleCloseViewModalWithoutChanges}
                  className="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-slate-300 dark:border-slate-700"
                  title={isFa ? 'بستن فرم و خروج بدون هیچ‌گونه تغییرات' : 'Close form without changes'}
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{isFa ? 'بستن فرم (خروج بدون تغییرات)' : 'Close Form'}</span>
                </button>
              </div>

              {/* Advance Next Stage Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedRecord.status === 'REGISTERED' && (
                  <button
                    onClick={() => handleOpenWorkflowAction(selectedRecord, 'UNDER_EVALUATION')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <span>{isFa ? 'شروع بررسی و ارزیابی' : 'Start Evaluation'}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {(selectedRecord.status === 'UNDER_EVALUATION' || selectedRecord.status === 'REOPENED') && (
                  <button
                    onClick={() => handleOpenWorkflowAction(selectedRecord, 'CAPA_DEFINED')}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <span>{isFa ? 'تصویب و تعریف اقدام (CAPA)' : 'Define CAPA'}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedRecord.status === 'CAPA_DEFINED' && (
                  <button
                    onClick={() => handleOpenWorkflowAction(selectedRecord, 'IN_PROGRESS')}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <span>{isFa ? 'شروع اجرای اقدام اصلاحی' : 'Start Execution'}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedRecord.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handleOpenWorkflowAction(selectedRecord, 'EFFECTIVENESS_REVIEW')}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <span>{isFa ? 'خاتمه اقدام و بررسی اثربخشی' : 'Review Effectiveness'}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {selectedRecord.status === 'EFFECTIVENESS_REVIEW' && (
                  <>
                    <button
                      onClick={() => handleOpenWorkflowAction(selectedRecord, 'CLOSED')}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isFa ? 'تأیید اثربخشی و بستن پرونده' : 'Approve & Close'}</span>
                    </button>
                    <button
                      onClick={() => handleOpenWorkflowAction(selectedRecord, 'REOPENED')}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{isFa ? 'عدم اثربخشی و بازگشایی' : 'Reject & Reopen'}</span>
                    </button>
                  </>
                )}

                {selectedRecord.status === 'CLOSED' && (
                  <button
                    onClick={() => handleOpenWorkflowAction(selectedRecord, 'REOPENED')}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <span>{isFa ? 'بازگشایی مجدد پرونده' : 'Reopen Record'}</span>
                  </button>
                )}

                {selectedRecord.status === 'CANCELLED' && (
                  <button
                    onClick={() => handleExecuteReopenCancelled(selectedRecord)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isFa ? 'خروج از وضعیت انصراف و بازگشایی' : 'Reopen Workflow'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Workflow Action Confirmation */}
      {isWorkflowModalOpen && selectedRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsWorkflowModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-black text-sm">
                {isFa ? `گردش کار: ${WORKFLOW_STATUS_CONFIG[workflowActionType]?.fa}` : `Workflow: ${workflowActionType}`}
              </h4>
              <button
                type="button"
                onClick={() => setIsWorkflowModalOpen(false)}
                title={isFa ? 'بستن فرم و خروج بدون تغییرات' : 'Close without changes'}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                {isFa
                  ? `آیا از تغییر وضعیت عدم انطباق ${selectedRecord.trackingCode} به «${WORKFLOW_STATUS_CONFIG[workflowActionType]?.fa}» اطمینان دارید؟`
                  : `Are you sure you want to transition ${selectedRecord.trackingCode} to ${workflowActionType}?`}
              </p>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  {isFa ? 'توضیحات و دستور اقدام / علت تصمیم:' : 'Notes / Decision explanation:'}
                </label>
                <textarea
                  rows={3}
                  value={workflowNote}
                  onChange={(e) => setWorkflowNote(e.target.value)}
                  placeholder={isFa ? 'توضیحات مربوط به این مرحله از گردش کار...' : 'Enter workflow step notes...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {(workflowActionType === 'CLOSED' || workflowActionType === 'EFFECTIVENESS_REVIEW') && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effectivenessVerified}
                      onChange={(e) => setEffectivenessVerified(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-bold text-slate-800 dark:text-white">
                      {isFa ? 'اثربخشی اقدام اصلاحی مورد ارزیابی و تأیید قرار گرفت' : 'CAPA effectiveness verified'}
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWorkflowModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title={isFa ? 'انصراف و خروج بدون تغییرات' : 'Cancel & Exit'}
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{isFa ? 'انصراف و خروج' : 'Cancel & Exit'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteWorkflow}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-md"
                >
                  {isFa ? 'تأیید و اعمال در پایگاه داده' : 'Confirm in database'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Refer to User */}
      {isReferModalOpen && selectedRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsReferModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden my-6"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-sky-200" />
                <h4 className="font-black text-sm">
                  {isFa ? `ارجاع پرونده عدم انطباق (${selectedRecord.trackingCode}) به کاربر مشخص` : 'Refer Non-Conformance to User'}
                </h4>
              </div>
              <button onClick={() => setIsReferModalOpen(false)} className="text-white/80 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{isFa ? 'مرحله جاری پرونده:' : 'Current Stage:'}</span>
                  <span className="font-bold text-sky-800 dark:text-sky-300 text-xs">
                    {WORKFLOW_STATUS_CONFIG[selectedRecord.status]?.fa}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">{isFa ? 'سطح ریسک:' : 'Risk Level:'}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${RISK_LEVEL_CONFIG[selectedRecord.riskLevel]?.badge}`}>
                    {RISK_LEVEL_CONFIG[selectedRecord.riskLevel]?.fa}
                  </span>
                </div>
              </div>

              {/* Source Picker: Users or Personnel */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    {isFa ? 'انتخاب کاربر یا مسئول اقدام *' : 'Select Target Assignee *'}
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setReferPickerSource('USERS')}
                      className={`px-2.5 py-1 rounded-md transition ${referPickerSource === 'USERS' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs' : 'text-slate-500'}`}
                    >
                      {isFa ? 'کاربران سامانه' : 'System Users'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferPickerSource('PERSONNEL')}
                      className={`px-2.5 py-1 rounded-md transition ${referPickerSource === 'PERSONNEL' ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs' : 'text-slate-500'}`}
                    >
                      {isFa ? 'پرسنل مجتمع' : 'Personnel'}
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={referSearch}
                    onChange={(e) => setReferSearch(e.target.value)}
                    placeholder={isFa ? 'جستجوی نام، سمت، واحد یا کد پرسنلی...' : 'Search name, role, department...'}
                    className="w-full pr-8 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                  />
                </div>

                {/* List */}
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  {(referPickerSource === 'USERS' ? systemUsers : personnelList)
                    .filter((u: any) => {
                      if (!referSearch) return true;
                      const q = referSearch.toLowerCase();
                      const name = (u.fullName || u.name || u.username || '').toLowerCase();
                      const role = (u.role || u.jobTitle || '').toLowerCase();
                      const dept = (u.department || u.departmentIds?.[0] || u.unit || '').toLowerCase();
                      const code = (u.personnelCode || u.username || '').toLowerCase();
                      return name.includes(q) || role.includes(q) || dept.includes(q) || code.includes(q);
                    })
                    .map((item: any, idx: number) => {
                      const id = item.id || item.username || item.personnelCode;
                      const name = item.fullName || item.name || item.username;
                      const role = item.role || item.jobTitle || 'کارشناس';
                      const dept = item.department || item.departmentIds?.[0] || item.unit || '-';
                      const isSelected = selectedAssigneeUser?.id === id || selectedAssigneeUser?.username === id || selectedAssigneeUser?.personnelCode === id;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedAssigneeUser(item)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-sky-100 dark:bg-sky-950/70 border-r-4 border-sky-600'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                              {name ? name[0] : 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-xs">{name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                {role} {dept !== '-' ? `• ${dept}` : ''}
                              </div>
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-600" />}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Deadline & Quick Chips */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'مهلت انجام اقدام (تاریخ سررسید) *' : 'Due Date *'}
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={referDeadline}
                    onChange={(e) => setReferDeadline(e.target.value)}
                    placeholder="1404/05/20"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    {[
                      { days: 3, label: '۳ روز' },
                      { days: 7, label: '۷ روز' },
                      { days: 14, label: '۱۴ روز' },
                      { days: 30, label: '۳۰ روز' },
                    ].map((chip) => (
                      <button
                        key={chip.days}
                        type="button"
                        onClick={() => setReferDeadline(moment().add(chip.days, 'days').format('jYYYY/jMM/jDD'))}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold transition"
                      >
                        +{chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Type */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'نوع اقدام مورد انتظار از کاربر *' : 'Expected Action Type *'}
                </label>
                <select
                  value={referActionType}
                  onChange={(e) => setReferActionType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                >
                  <option value="APPROVE_AND_SIGN">{isFa ? 'بررسی، اقدام اصلاحی و امضای الکترونیکی' : 'Approve & Sign'}</option>
                  <option value="REVIEW">{isFa ? 'بررسی فنی و اعلام نظر کارشناسی' : 'Review'}</option>
                  <option value="APPROVE">{isFa ? 'تأیید صحت اجرای اقدام' : 'Approve'}</option>
                  <option value="SIGN">{isFa ? 'صرفاً امضای الکترونیکی مرحله' : 'Sign'}</option>
                </select>
              </div>

              {/* Instructions / Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'دستور اقدام و شرح مأموریت ارجاع‌شده:' : 'Instructions & Notes:'}
                </label>
                <textarea
                  rows={3}
                  value={referInstructions}
                  onChange={(e) => setReferInstructions(e.target.value)}
                  placeholder={isFa ? 'توضیحات و اولویت‌های اجرایی مورد انتظار را یادداشت فرمایید...' : 'Enter instructions for the assignee...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReferModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title={isFa ? 'انصراف و خروج بدون تغییرات' : 'Cancel & Exit'}
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{isFa ? 'انصراف و خروج' : 'Cancel & Exit'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRefer}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تأیید و ارجاع در دیتابیس و کارتابل' : 'Confirm Referral'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Digital Signature */}
      {isSignatureModalOpen && selectedRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsSignatureModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden my-6"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-indigo-200" />
                <h4 className="font-black text-sm">
                  {isFa ? `ثبت امضای الکترونیکی مرحله «${WORKFLOW_STATUS_CONFIG[signatureTargetStage]?.fa}»` : 'Electronic Signature'}
                </h4>
              </div>
              <button onClick={() => setIsSignatureModalOpen(false)} className="text-white/80 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isFa ? 'کد پرونده و عنوان:' : 'Record:'}</span>
                  <span className="font-black text-indigo-900 dark:text-indigo-200 text-xs">
                    {selectedRecord.trackingCode} - {selectedRecord.title}
                  </span>
                </div>
                <div className="text-left font-mono text-[11px] text-slate-500">
                  {moment().format('jYYYY/jMM/jDD HH:mm')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'نام امضاکننده *' : 'Signer Name *'}
                  </label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'سمت / نقش سازمانی' : 'Role / Title'}
                  </label>
                  <input
                    type="text"
                    value={signerRole}
                    onChange={(e) => setSignerRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Signature Decision */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isFa ? 'وضعیت تأیید و امضا:' : 'Decision:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignatureStatus('SIGNED')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition cursor-pointer ${
                      signatureStatus === 'SIGNED'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{isFa ? 'تأیید و امضای مرحله' : 'Approve & Sign'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureStatus('REJECTED')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition cursor-pointer ${
                      signatureStatus === 'REJECTED'
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                    }`}
                  >
                    <X className="w-4 h-4 text-rose-600" />
                    <span>{isFa ? 'عدم تأیید / رد مرحله' : 'Reject'}</span>
                  </button>
                </div>
              </div>

              {/* Digital Signature Pad */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'ترسیم امضای دیجیتال الکترونیکی *' : 'Draw Digital Signature *'}
                </label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800 p-2">
                  <DigitalSignaturePad
                    onSave={(b64) => setSignatureImage(b64)}
                    onClear={() => setSignatureImage(null)}
                    initialSignature={signatureImage || undefined}
                    isFa={isFa}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'ملاحظات، شروط یا توضیحات امضاکننده:' : 'Signer Comments / Notes:'}
                </label>
                <textarea
                  rows={2}
                  value={signatureNotes}
                  onChange={(e) => setSignatureNotes(e.target.value)}
                  placeholder={isFa ? 'در صورت وجود هرگونه توضیح یا شرط، یادداشت فرمایید...' : 'Enter any notes...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title={isFa ? 'انصراف و خروج بدون تغییرات' : 'Cancel & Exit'}
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{isFa ? 'انصراف و خروج' : 'Cancel & Exit'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSignature}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md flex items-center gap-1.5"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{isFa ? 'ثبت رسمی امضا در پایگاه داده' : 'Save Signature'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Process Cancellation (انصراف در تمام مراحل) */}
      {isCancelModalOpen && cancelRecordTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsCancelModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-rose-700 to-red-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Ban className="w-5 h-5 text-rose-200" />
                <h4 className="font-black text-sm">
                  {isFa ? `انصراف از فرآیند عدم انطباق (${cancelRecordTarget.trackingCode})` : 'Cancel Non-Conformance Process'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                title={isFa ? 'بستن و انصراف از این اقدام' : 'Close'}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 rounded-xl space-y-1.5 text-rose-900 dark:text-rose-200">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{isFa ? 'هشدار مهم در خصوص انصراف از فرآیند:' : 'Process Cancellation Notice:'}</span>
                </p>
                <p className="text-[11px] leading-relaxed text-rose-800 dark:text-rose-300">
                  {isFa
                    ? 'با ثبت انصراف، گردش کار متوقف و وضعیت پرونده به «منصرف‌شده» تغییر خواهد یافت؛ اما کلیه اطلاعات قبلی، یافته‌ها، امضاها و سوابق پیگیری به صورت کامل در پایگاه داده مرکزی برای ممیزی‌های آینده حفظ خواهند شد.'
                    : 'Cancelling this workflow stops further steps. All previous history, signatures and findings will be fully preserved in the database.'}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'علت انصراف از فرآیند *' : 'Cancellation Reason *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder={isFa ? 'علت دقیق توقف یا انصراف از این پرونده (مثال: برطرف شدن خطر با اقدام فوری، تغییر خط تولید، گزارش اشتباه و...)...' : 'Enter specific cancellation reason...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                <div className="flex items-center justify-between">
                  <span>کاربر انصراف‌دهنده:</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {currentUser?.fullName || currentUser?.username || 'کاربر سامانه'} ({currentUser?.role || 'مسئول HSE'})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>تاریخ و زمان ثبت:</span>
                  <span className="font-mono">{moment().format('jYYYY/jMM/jDD HH:mm')}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title={isFa ? 'انصراف و خروج بدون تغییرات' : 'Cancel & Exit'}
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{isFa ? 'انصراف و بازگشت' : 'Cancel & Exit'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteCancel}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تأیید انصراف و ثبت نهایی در دیتابیس' : 'Confirm Cancellation'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Step Back to Previous Stage (بازگشت به مرحله قبل) */}
      {isStepBackModalOpen && selectedRecord && stepBackTargetStage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsStepBackModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95"
            dir={isFa ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="w-5 h-5 text-amber-200" />
                <h4 className="font-black text-sm">
                  {isFa ? `بازگشت به مرحله قبلی: ${WORKFLOW_STATUS_CONFIG[stepBackTargetStage]?.fa}` : 'Return to Previous Stage'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsStepBackModalOpen(false)}
                title={isFa ? 'بستن و انصراف از بازگشت' : 'Close'}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isFa ? 'مرحله فعلی:' : 'From:'}</span>
                  <span className="font-bold text-slate-800 dark:text-white">
                    {WORKFLOW_STATUS_CONFIG[selectedRecord.status]?.fa}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">{isFa ? 'مرحله هدف بازگشت:' : 'To:'}</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">
                    {WORKFLOW_STATUS_CONFIG[stepBackTargetStage]?.fa}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'علت بازگشت به مرحله قبل و نواقص مورد نظر *' : 'Reason for Stepping Back *'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={stepBackReason}
                  onChange={(e) => setStepBackReason(e.target.value)}
                  placeholder={isFa ? 'دلایل عدم تأیید، نواقص در اقدام اصلاحی یا نیاز به بازبینی مجدد را وارد نمایید...' : 'Enter reason for returning to previous stage...'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStepBackModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title={isFa ? 'انصراف و خروج بدون تغییرات' : 'Cancel & Exit'}
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>{isFa ? 'انصراف و بازگشت' : 'Cancel & Exit'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteStepBack}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تأیید و بازگشت پرونده' : 'Confirm Step Back'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs font-sans animate-in fade-in duration-200"
          dir={isFa ? 'rtl' : 'ltr'}
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 text-slate-800 dark:text-slate-100 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertOctagon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {isFa
                      ? recordsToDelete.length === 1
                        ? 'تأیید حذف عدم انطباق'
                        : `تأیید حذف دسته‌جمعی (${recordsToDelete.length} مورد)`
                      : 'Confirm Non-Conformance Deletion'}
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                    {isFa ? 'هشدار: این عملیات غیرقابل بازگشت است' : 'Warning: This action cannot be undone'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Records Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 space-y-2.5 max-h-56 overflow-y-auto text-xs">
              {recordsToDelete.map((item, idx) => (
                <div key={item.id || item.trackingCode || idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded text-[11px]">
                      {item.trackingCode}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                      {isFa ? (RISK_LEVEL_CONFIG[item.riskLevel]?.fa || item.riskLevel) : item.riskLevel}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{item.title}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>واحد: {item.unitName || 'عمومی'}</span>
                    <span>ماژول: {SOURCE_MODULE_LABELS[item.sourceModule]?.fa || item.sourceModule}</span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isFa
                ? 'با حذف این رکورد، اطلاعات پرونده عدم انطباق به همراه سوابق اقدامات اصلاحی و تاریخچه گردش کار به صورت کامل و دائمی از پایگاه داده پاک خواهد شد.'
                : 'Deleting this record will permanently remove all associated CAPA history and workflow logs from database.'}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isFa ? 'تأیید و حذف نهایی' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComprehensiveNonConformanceModule;
