import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FolderGit2,
  GitBranch,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserCheck,
  Wrench,
  ArrowLeft,
  Award,
  Bot,
  Calendar,
  Check,
  Eye,
  FileCheck2,
  History,
  ListChecks,
  Network,
  Target,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  CCPS_20_ELEMENTS,
  OSHA_14_CLAUSES,
  PSM_SPECIALIZED_SUBSYSTEMS,
  PSM_MATURITY_LEVELS,
  PSM_CAPA_STAGES,
  PSM_STAGE_GATES,
} from './psmStandardsCatalog';

interface PsmSubViewsProps {
  activeSubTab: string;
  activeProject: any;
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  };
  centralOrg: {
    companies: any[];
    sites: any[];
    departments: any[];
    units: any[];
    positions: any[];
    personnel: any[];
    linkedModulesSummary: Record<string, number>;
  };
  auditLogs: any[];
  permissions: { canWrite: boolean; canApprove: boolean };
  apiRequest: (path: string, options?: RequestInit) => Promise<any>;
  onRefresh: () => Promise<void>;
  availableUnits: string[];
}

export const PsmSubViews: React.FC<PsmSubViewsProps> = ({
  activeSubTab,
  activeProject,
  projectData,
  centralOrg,
  auditLogs,
  permissions,
  apiRequest,
  onRefresh,
  availableUnits,
}) => {
  // ==========================================================================
  // STAGE GATES GOVERNANCE & ENGINE (موتور حاکمیت و کنترل مراحل پروژه PSM)
  // ==========================================================================
  const [stageGates, setStageGates] = useState<any[]>([]);
  const [gateDeviations, setGateDeviations] = useState<any[]>([]);
  const [gatesSummary, setGatesSummary] = useState<any>(null);
  const [loadingGates, setLoadingGates] = useState(false);
  const [selectedGateKey, setSelectedGateKey] = useState<string>('G1');
  const [evaluatingGateKey, setEvaluatingGateKey] = useState<string | null>(null);

  // Decision Modal
  const [showGateDecisionModal, setShowGateDecisionModal] = useState(false);
  const [gateDecisionType, setGateDecisionType] = useState<'APPROVED' | 'REJECTED' | 'SUSPENDED'>('APPROVED');
  const [gateDecisionMinutes, setGateDecisionMinutes] = useState('');
  const [gateDecisionComments, setGateDecisionComments] = useState('');
  const [gateDecisionApprover, setGateDecisionApprover] = useState('');
  const [submittingGateDecision, setSubmittingGateDecision] = useState(false);

  // Deviation Modal
  const [showDeviationModal, setShowDeviationModal] = useState(false);
  const [submittingDeviation, setSubmittingDeviation] = useState(false);
  const [newDeviation, setNewDeviation] = useState({
    title: '',
    requirementDescription: '',
    technicalJustification: '',
    riskAssessmentSummary: '',
    compensatoryMeasures: '',
    isLegalRequirement: false,
    requestedByName: '',
    validUntilDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
  });

  // Gate Roles Edit State
  const [editingGateRoles, setEditingGateRoles] = useState(false);
  const [gatePreparerInput, setGatePreparerInput] = useState('');
  const [gateApproverInput, setGateApproverInput] = useState('');
  const [savingGateRoles, setSavingGateRoles] = useState(false);

  // Gap Deadline Extension Modal (قانون ۱ و سناریو ۷)
  const [extendingGap, setExtendingGap] = useState<any | null>(null);
  const [extensionNewDate, setExtensionNewDate] = useState('');
  const [extensionJustification, setExtensionJustification] = useState('');
  const [submittingExtension, setSubmittingExtension] = useState(false);

  const fetchStageGates = useCallback(async () => {
    if (!activeProject?.id) return;
    try {
      setLoadingGates(true);
      const res = await apiRequest(`/projects/${activeProject.id}/gates`);
      if (res?.data) {
        setStageGates(res.data.gates || []);
        setGateDeviations(res.data.deviations || []);
        setGatesSummary(res.data.projectSummary || null);
        if (res.data.projectSummary?.activeGateKey) {
          setSelectedGateKey((prev) => prev || res.data.projectSummary.activeGateKey);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load stage gates:', err);
    } finally {
      setLoadingGates(false);
    }
  }, [activeProject?.id, apiRequest]);

  useEffect(() => {
    if (activeSubTab === 'stage-gates' && activeProject?.id) {
      fetchStageGates();
    }
  }, [activeSubTab, activeProject?.id, fetchStageGates]);

  const handleEvaluateGate = async (gateKey: string) => {
    try {
      setEvaluatingGateKey(gateKey);
      const res = await apiRequest(`/projects/${activeProject.id}/gates/${gateKey}/evaluate`, { method: 'POST' });
      if (res?.data?.canPass) {
        toast.success(`دروازه ${gateKey} آماده تصویب است و هیچ مانع بحرانی ندارد.`);
      } else {
        toast.error(`دروازه ${gateKey} دارای ${res?.data?.blockingIssues?.length || 0} مانع بحرانی برای تصویب است.`);
      }
      await fetchStageGates();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ارزیابی دروازه');
    } finally {
      setEvaluatingGateKey(null);
    }
  };

  const handleSaveGateRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject?.id) return;
    try {
      setSavingGateRoles(true);
      await apiRequest(`/projects/${activeProject.id}/gates/${selectedGateKey}/assign`, {
        method: 'PUT',
        body: JSON.stringify({
          preparedByName: gatePreparerInput,
          approverName: gateApproverInput,
        }),
      });
      toast.success(`مسئولین آماده‌سازی و تصویب دروازه ${selectedGateKey} به‌روزرسانی شدند.`);
      setEditingGateRoles(false);
      await fetchStageGates();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ذخیره مسئولین دروازه');
    } finally {
      setSavingGateRoles(false);
    }
  };

  const handleSubmitGateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingGateDecision(true);
      await apiRequest(`/projects/${activeProject.id}/gates/${selectedGateKey}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: gateDecisionType,
          meetingMinutes: gateDecisionMinutes,
          comments: gateDecisionComments,
          approverName: gateDecisionApprover || centralOrg.personnel[0]?.fullName,
        }),
      });
      toast.success(
        gateDecisionType === 'APPROVED'
          ? `دروازه ${selectedGateKey} با موفقیت تصویب شد.`
          : `دروازه ${selectedGateKey} رد گردید و بازنگری الزامی شد.`
      );
      setShowGateDecisionModal(false);
      setGateDecisionMinutes('');
      setGateDecisionComments('');
      await fetchStageGates();
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت تصمیم دروازه');
    } finally {
      setSubmittingGateDecision(false);
    }
  };

  const handleCreateDeviation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingDeviation(true);
      await apiRequest(`/projects/${activeProject.id}/gates/${selectedGateKey}/deviations`, {
        method: 'POST',
        body: JSON.stringify(newDeviation),
      });
      toast.success('درخواست انحراف مصوب با توجیه فنی و ارزیابی ریسک ثبت گردید.');
      setShowDeviationModal(false);
      setNewDeviation({
        title: '',
        requirementDescription: '',
        technicalJustification: '',
        riskAssessmentSummary: '',
        compensatoryMeasures: '',
        isLegalRequirement: false,
        requestedByName: '',
        validUntilDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      });
      await fetchStageGates();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت انحراف');
    } finally {
      setSubmittingDeviation(false);
    }
  };

  const handleDecideDeviation = async (devId: number, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await apiRequest(`/deviations/${devId}/decide`, {
        method: 'PUT',
        body: JSON.stringify({ decision }),
      });
      toast.success(`انحراف با موفقیت ${decision === 'APPROVED' ? 'تصویب' : 'رد'} گردید.`);
      await fetchStageGates();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تصمیم‌گیری انحراف');
    }
  };

  const handleExtendGapDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingGap) return;
    try {
      setSubmittingExtension(true);
      await apiRequest(`/gaps/${extendingGap.id}/extend-due`, {
        method: 'PUT',
        body: JSON.stringify({
          newDueDate: extensionNewDate,
          extensionJustification,
        }),
      });
      toast.success('مهلت جدید شکاف با ثبت کامل سوابق و توجیه فنی ذخیره شد.');
      setExtendingGap(null);
      setExtensionJustification('');
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تمدید مهلت شکاف');
    } finally {
      setSubmittingExtension(false);
    }
  };

  // ==========================================================================
  // TAB 5: GAP ANALYSIS (تحلیل شکاف و استخراج خودکار - بند ۴)
  // ==========================================================================
  const [gapFilterRisk, setGapFilterRisk] = useState<string>('ALL');
  const [gapFilterUnit, setGapFilterUnit] = useState<string>('ALL');
  const [gapSearchQuery, setGapSearchQuery] = useState<string>('');
  const [showNewGapForm, setShowNewGapForm] = useState(false);
  const [extractingGaps, setExtractingGaps] = useState(false);
  const [newGap, setNewGap] = useState({
    title: '',
    description: '',
    ccpsElementCode: 'CCPS-06',
    standardReference: 'CCPS-06 | OSHA 1910.119(d) | RJL-PSM-06',
    unitName: availableUnits[0] || 'واحد پلیمریزاسیون',
    riskLevel: 'HIGH',
    requiredDocument: '',
    responsiblePersonName: '',
    proposedDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    isOutOfScope: false,
    technicalJustification: '',
    justificationApprovedBy: '',
  });

  // ==========================================================================
  // TAB 6: WBS & GANTT CHART (مدیریت WBS و برنامه اجرایی - بند ۵)
  // ==========================================================================
  const [showNewWbsForm, setShowNewWbsForm] = useState(false);
  const [wbsViewMode, setWbsViewMode] = useState<'SPLIT' | 'TABLE' | 'TIMELINE'>('SPLIT');
  const [wbsFilterStatus, setWbsFilterStatus] = useState<'ALL' | 'CRITICAL' | 'DELAYED' | 'COMPLETED' | 'MILESTONE'>('ALL');
  const [wbsFilterUnit, setWbsFilterUnit] = useState<string>('ALL');
  const [wbsSearchQuery, setWbsSearchQuery] = useState<string>('');
  const [editingWbsCostId, setEditingWbsCostId] = useState<number | null>(null);
  const [editingWbsCostValue, setEditingWbsCostValue] = useState<number>(0);
  const [newWbs, setNewWbs] = useState({
    wbsCode: '1.1',
    title: '',
    elementCode: 'CCPS-06',
    unitName: availableUnits[0] || 'کل مجتمع',
    ownerName: '',
    executorName: '',
    plannedStart: new Date().toISOString().slice(0, 10),
    plannedEnd: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    weight: 2,
    allocatedBudget: 0,
    resources: '',
    dependenciesText: '',
    isMilestone: false,
    isCritical: false,
  });

  // ==========================================================================
  // TAB 7: DOCUMENT BANK (مدیریت بانک مدارک PSM - بند ۶)
  // ==========================================================================
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [uploadingDocFile, setUploadingDocFile] = useState(false);
  const [selectedDocHistory, setSelectedDocHistory] = useState<any | null>(null);
  const [docFilterStatus, setDocFilterStatus] = useState<string>('ALL');
  const [docFilterType, setDocFilterType] = useState<string>('ALL');
  const [docFilterUnit, setDocFilterUnit] = useState<string>('ALL');
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [editingDocRevision, setEditingDocRevision] = useState<any | null>(null);
  const [docRevisionForm, setDocRevisionForm] = useState({
    title: '',
    version: '1.1',
    validityExpiryDate: '',
    evidenceSummary: '',
    changeNote: '',
  });
  const [newDoc, setNewDoc] = useState({
    docCode: `RJL-PSM-DOC-${Math.floor(100 + Math.random() * 900)}`,
    title: '',
    docType: 'PROCEDURE',
    ccpsElementCode: 'CCPS-06',
    oshaClauseCode: 'OSHA-02',
    unitName: availableUnits[0] || 'کل مجتمع',
    equipmentTag: '',
    version: '1.0',
    authorName: '',
    reviewerName: '',
    approverName: '',
    issueDate: new Date().toISOString().slice(0, 10),
    validityExpiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    status: 'DRAFT',
    evidenceSummary: '',
    fileId: '',
    fileUrl: '',
    fileName: '',
  });

  // ==========================================================================
  // TAB 8: CAPA 8-STAGE WORKFLOW (مدیریت CAPA و گردش کار ۸ مرحله‌ای - بند ۷)
  // ==========================================================================
  const [showNewCapaForm, setShowNewCapaForm] = useState(false);
  const [activeCapaModal, setActiveCapaModal] = useState<any | null>(null);
  const [capaFilterStage, setCapaFilterStage] = useState<string>('ALL');
  const [capaFilterRisk, setCapaFilterRisk] = useState<string>('ALL');
  const [capaFilterUnit, setCapaFilterUnit] = useState<string>('ALL');
  const [capaSearchQuery, setCapaSearchQuery] = useState<string>('');
  const [extendingCapa, setExtendingCapa] = useState<any | null>(null);
  const [capaExtensionNewDate, setCapaExtensionNewDate] = useState<string>('');
  const [capaExtensionJustification, setCapaExtensionJustification] = useState<string>('');
  const [submittingCapaExtension, setSubmittingCapaExtension] = useState(false);
  const [selectedCapaHistory, setSelectedCapaHistory] = useState<any | null>(null);
  const [capaTransitionForm, setCapaTransitionForm] = useState({
    targetStage: 'RISK_ASSESSED',
    rootCause: '',
    correctiveAction: '',
    preventiveAction: '',
    responsiblePersonName: '',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    evidenceDescription: '',
    reviewerName: '',
    reviewNotes: '',
    effectivenessVerifierName: '',
    effectivenessCriteriaMet: false,
    effectivenessReport: '',
    followupPlan: '',
    managementApprovalForResidual: false,
    transitionNote: '',
  });
  const [newCapa, setNewCapa] = useState({
    title: '',
    deficiencyDescription: '',
    sourceType: 'GAP_ANALYSIS',
    ccpsElementCode: 'CCPS-10',
    oshaClauseCode: 'OSHA-08',
    unitName: availableUnits[0] || 'واحد پلیمریزاسیون',
    equipmentTag: '',
    riskSeverity: 4,
    riskLikelihood: 3,
    riskLevel: 'HIGH',
    responsiblePersonName: '',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  });

  // ==========================================================================
  // TAB 9: SPECIALIZED STUDIES (۱۴ زیرسیستم تخصصی - بند ۸)
  // ==========================================================================
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>('ALL');
  const [studyFilterStatus, setStudyFilterStatus] = useState<string>('ALL');
  const [studyFilterUnit, setStudyFilterUnit] = useState<string>('ALL');
  const [studySearchQuery, setStudySearchQuery] = useState<string>('');
  const [showNewStudyForm, setShowNewStudyForm] = useState(false);
  const [newStudy, setNewStudy] = useState({
    subsystemType: 'HAZOP',
    title: '',
    unitName: availableUnits[0] || 'واحد پلیمریزاسیون',
    equipmentTag: '',
    nodeOrSection: '',
    ownerName: '',
    teamLeader: '',
    studyDate: new Date().toISOString().slice(0, 10),
    revalidationDueDate: new Date(Date.now() + 5 * 365 * 86400000).toISOString().slice(0, 10),
    status: 'IN_PROGRESS',
    technicalSummary: '',
    evidenceSummary: '',
    trackingPath: '',
    recommendationTitle: '',
    recommendationOwner: '',
    recommendationDueDate: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    recommendationRisk: 'HIGH',
  });

  // ==========================================================================
  // TAB 10: 5-LEVEL MATURITY MODEL (ارزیابی بلوغ ۵ سطحی - بند ۱۰)
  // ==========================================================================
  const [maturityAssessor, setMaturityAssessor] = useState('');
  const [maturityUnitScope, setMaturityUnitScope] = useState('کل مجتمع');
  const [maturityStrengths, setMaturityStrengths] = useState('');
  const [maturityRoadmap, setMaturityRoadmap] = useState('');
  const [maturityScores, setMaturityScores] = useState<
    Record<string, { design: number; execution: number; culture: number; sustainability: number }>
  >(() => {
    const init: Record<string, { design: number; execution: number; culture: number; sustainability: number }> = {};
    CCPS_20_ELEMENTS.forEach((el) => {
      init[el.code] = { design: 2, execution: 2, culture: 2, sustainability: 2 };
    });
    return init;
  });

  // ==========================================================================
  // TAB 11: FINAL HANDOVER & ACCEPTANCE (تأیید نهایی و تحویل پروژه - بند ۱۱)
  // ==========================================================================
  const [handoverForm, setHandoverForm] = useState({
    finalAuditCompleted: Boolean(activeProject?.handoverData?.finalAuditCompleted),
    finalAuditReportRef: activeProject?.handoverData?.finalAuditReportRef || '',
    operationalEvidenceVerified: Boolean(activeProject?.handoverData?.operationalEvidenceVerified),
    controlsEffectivenessVerified: Boolean(activeProject?.handoverData?.controlsEffectivenessVerified),
    authorizedApproverName: activeProject?.handoverData?.authorizedApproverName || '',
    authorizedApproverRole:
      activeProject?.handoverData?.authorizedApproverRole ||
      'مدیرعامل / رئیس کمیته راهبری PSM مجتمع',
    finalReportApprovalDate:
      activeProject?.handoverData?.finalReportApprovalDate || new Date().toISOString().slice(0, 10),
    handoverNotes: activeProject?.handoverData?.handoverNotes || '',
  });

  // ==========================================================================
  // TAB 12: LOCAL AI ADVISOR & AUDIT LOG (هوش مصنوعی محلی و لاگ ممیزی - بند ۱۲)
  // ==========================================================================
  const [aiMode, setAiMode] = useState<string>('IDENTIFY_GAPS');
  const [aiCustomContext, setAiCustomContext] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    analysisMode: string;
    modelUsed: string;
    analysisText: string;
    generatedAt: string;
    humanApproved?: boolean;
    approvedBy?: string;
  } | null>(null);
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState<string>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [selectedAuditLog, setSelectedAuditLog] = useState<any | null>(null);

  // Handlers
  const handleAutoExtractAllGaps = async () => {
    if (!activeProject) return;
    setExtractingGaps(true);
    try {
      const res = await apiRequest('/gaps/extract-all', {
        method: 'POST',
        body: JSON.stringify({ projectId: activeProject.id }),
      });
      toast.success(
        res.data?.extractedCount > 0
          ? `${res.data.extractedCount} شکاف جدید به‌صورت خودکار از ارزیابی‌ها استخراج شد.`
          : 'کلیه شکاف‌های ارزیابی‌های فعلی قبلاً استخراج شده‌اند.'
      );
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در استخراج خودکار شکاف‌ها');
    } finally {
      setExtractingGaps(false);
    }
  };

  const handleCreateGap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      const mappedOsha = CCPS_20_ELEMENTS.some((c) => c.code === newGap.ccpsElementCode)
        ? ['OSHA-02', 'OSHA-03']
        : [];
      await apiRequest('/gaps', {
        method: 'POST',
        body: JSON.stringify({
          ...newGap,
          projectId: activeProject.id,
          oshaClauseCodes: mappedOsha,
        }),
      });
      toast.success('شکاف جدید با موفقیت در سیستم تحلیل شکاف ثبت شد.');
      setShowNewGapForm(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت شکاف');
    }
  };

  const handleConvertGap = async (gapId: number, target: 'WBS' | 'CAPA' | 'BOTH') => {
    try {
      await apiRequest(`/gaps/${gapId}/convert`, {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      toast.success(
        target === 'BOTH'
          ? 'شکاف با موفقیت به فعالیت WBS و پرونده CAPA تبدیل شد.'
          : target === 'WBS'
          ? 'شکاف به فعالیت اجرایی WBS تبدیل شد.'
          : 'شکاف به پرونده CAPA تبدیل شد.'
      );
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تبدیل شکاف');
    }
  };

  const handleCreateWbs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      const dependencies = newWbs.dependenciesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiRequest('/wbs', {
        method: 'POST',
        body: JSON.stringify({
          ...newWbs,
          projectId: activeProject.id,
          dependencies,
        }),
      });
      toast.success('فعالیت اجرایی جدید در ساختار شکست کار (WBS) ثبت شد.');
      setShowNewWbsForm(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت فعالیت WBS');
    }
  };

  const handleUpdateWbsProgress = async (task: any, nextActualProgress: number) => {
    try {
      await apiRequest(`/wbs/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ actualProgress: nextActualProgress }),
      });
      toast.success(`پیشرفت واقعی فعالیت ${task.wbsCode} به ${nextActualProgress}٪ بروزرسانی شد.`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بروزرسانی پیشرفت WBS');
    }
  };

  const handleSaveWbsCost = async (task: any) => {
    try {
      await apiRequest(`/wbs/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ actualCost: Number(editingWbsCostValue || 0) }),
      });
      toast.success(`هزینه واقعی بسته کاری ${task.wbsCode} بروزرسانی شد.`);
      setEditingWbsCostId(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت هزینه واقعی فعالیت');
    }
  };

  const handleDeleteWbs = async (taskId: number, wbsCode: string) => {
    try {
      await apiRequest(`/wbs/${taskId}`, { method: 'DELETE' });
      toast.success(`فعالیت ${wbsCode} از ساختار شکست کار حذف شد.`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در حذف فعالیت WBS');
    }
  };

  const handleUploadDocumentFile = async (file: File) => {
    setUploadingDocFile(true);
    try {
      const token = sessionStorage.getItem('hse_auth_token') || localStorage.getItem('hse_auth_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'PSM_DOCUMENT');
      formData.append('entityId', String(activeProject?.id || '1'));
      const res = await fetch('/api/v1/files/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'خطا در بارگذاری فایل مدرک');
      }
      setNewDoc((prev) => ({
        ...prev,
        fileId: json.data?.fileId || '',
        fileUrl: json.data?.fileUrl || `/api/v1/files/${json.data?.fileId}/download`,
        fileName: file.name,
      }));
      toast.success('فایل مستند با موفقیت بارگذاری و پیوست شد.');
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بارگذاری فایل');
    } finally {
      setUploadingDocFile(false);
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      await apiRequest('/documents', {
        method: 'POST',
        body: JSON.stringify({
          ...newDoc,
          projectId: activeProject.id,
        }),
      });
      toast.success('مدرک با موفقیت در بانک مدارک PSM ثبت شد.');
      setShowNewDocForm(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت مدرک');
    }
  };

  const handleApproveDocument = async (doc: any) => {
    try {
      await apiRequest(`/documents/${doc.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'APPROVED',
          changeNote: 'تأیید نهایی مدرک پس از کنترل شواهد اجرایی',
        }),
      });
      toast.success(`مدرک ${doc.docCode} تأیید نهایی شد.`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تأیید مدرک');
    }
  };

  const handleOpenDocRevision = (doc: any) => {
    const nextVerParts = String(doc.version || '1.0').split('.');
    const major = Number(nextVerParts[0] || 1);
    const minor = Number(nextVerParts[1] || 0) + 1;
    setEditingDocRevision(doc);
    setDocRevisionForm({
      title: doc.title || '',
      version: `${major}.${minor}`,
      validityExpiryDate: doc.validityExpiryDate || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      evidenceSummary: doc.evidenceSummary || '',
      changeNote: '',
    });
  };

  const handleSaveDocRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDocRevision) return;
    try {
      const wasApproved = editingDocRevision.status === 'APPROVED';
      await apiRequest(`/documents/${editingDocRevision.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: docRevisionForm.title,
          version: docRevisionForm.version,
          validityExpiryDate: docRevisionForm.validityExpiryDate,
          evidenceSummary: docRevisionForm.evidenceSummary,
          changeNote:
            docRevisionForm.changeNote ||
            `ثبت بازنگری و ویرایش نسخه ${docRevisionForm.version} در بانک مدارک PSM`,
        }),
      });
      toast.success(
        wasApproved
          ? `نسخه جدید مدرک ${editingDocRevision.docCode} ثبت شد و طبق قانون حاکمیت به وضعیت «نیازمند بررسی مجدد (UNDER_REVIEW)» بازگشت.`
          : `ویرایش و شواهد مدرک ${editingDocRevision.docCode} با موفقیت بروزرسانی شد.`
      );
      setEditingDocRevision(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت ویرایش مدرک');
    }
  };

  const handleDeleteDocument = async (docId: number, docCode: string) => {
    try {
      await apiRequest(`/documents/${docId}`, { method: 'DELETE' });
      toast.success(`مدرک ${docCode} از بانک مدارک حذف شد.`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در حذف مدرک');
    }
  };

  const handleCreateCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      await apiRequest('/capa', {
        method: 'POST',
        body: JSON.stringify({
          ...newCapa,
          projectId: activeProject.id,
        }),
      });
      toast.success('پرونده نقص (CAPA) در مرحله «۱. ثبت نقص» ایجاد شد.');
      setShowNewCapaForm(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت CAPA');
    }
  };

  const handleExtendCapaDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingCapa) return;
    try {
      setSubmittingCapaExtension(true);
      await apiRequest(`/capa/${extendingCapa.id}/extend-due`, {
        method: 'PUT',
        body: JSON.stringify({
          newDueDate: capaExtensionNewDate,
          extensionJustification: capaExtensionJustification,
        }),
      });
      toast.success(`مهلت اقدام اصلاحی ${extendingCapa.capaCode} با ثبت توجیه فنی تمدید شد.`);
      setExtendingCapa(null);
      setCapaExtensionJustification('');
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تمدید مهلت CAPA');
    } finally {
      setSubmittingCapaExtension(false);
    }
  };

  const openCapaTransitionModal = (capa: any) => {
    const currentIdx = PSM_CAPA_STAGES.findIndex((s) => s.key === capa.stage);
    const nextStage = PSM_CAPA_STAGES[Math.min(PSM_CAPA_STAGES.length - 1, currentIdx + 1)]?.key || capa.stage;
    setActiveCapaModal(capa);
    setCapaTransitionForm({
      targetStage: nextStage,
      rootCause: capa.rootCause || '',
      correctiveAction: capa.correctiveAction || '',
      preventiveAction: capa.preventiveAction || '',
      responsiblePersonName: capa.responsiblePersonName || '',
      dueDate: capa.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      evidenceDescription: capa.evidenceDescription || '',
      reviewerName: capa.reviewerName || '',
      reviewNotes: capa.reviewNotes || '',
      effectivenessVerifierName: capa.effectivenessVerifierName || '',
      effectivenessCriteriaMet: Boolean(capa.effectivenessCriteriaMet),
      effectivenessReport: capa.effectivenessReport || '',
      followupPlan: capa.followupPlan || '',
      managementApprovalForResidual: Boolean(capa.managementApprovalForResidual),
      transitionNote: '',
    });
  };

  const handleTransitionCapa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCapaModal) return;
    try {
      await apiRequest(`/capa/${activeCapaModal.id}/transition`, {
        method: 'PUT',
        body: JSON.stringify(capaTransitionForm),
      });
      toast.success(`گردش کار CAPA (${activeCapaModal.capaCode}) با موفقیت به مرحله جدید منتقل شد.`);
      setActiveCapaModal(null);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تغییر مرحله CAPA');
    }
  };

  const handleCreateStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      const recommendations = newStudy.recommendationTitle.trim()
        ? [
            {
              id: `REC-${Date.now().toString().slice(-4)}`,
              title: newStudy.recommendationTitle.trim(),
              ownerName: newStudy.recommendationOwner || newStudy.ownerName,
              dueDate: newStudy.recommendationDueDate,
              riskLevel: newStudy.recommendationRisk,
              status: 'OPEN',
              evidence: newStudy.evidenceSummary || 'در انتظار اجرای توصیه',
              trackingPath: newStudy.trackingPath || 'ارجاع به CAPA / پیگیری واحد مهندسی فرایند',
            },
          ]
        : [];
      await apiRequest('/studies', {
        method: 'POST',
        body: JSON.stringify({
          ...newStudy,
          projectId: activeProject.id,
          recommendations,
        }),
      });
      toast.success('مطالعه تخصصی PSM و توصیه‌های مرتبط ثبت شد.');
      setShowNewStudyForm(false);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت مطالعه تخصصی');
    }
  };

  const handleUpdateStudyStatus = async (study: any, nextStatus: string) => {
    try {
      await apiRequest(`/studies/${study.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(`وضعیت مطالعه ${study.studyCode} به ${nextStatus} تغییر یافت.`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بروزرسانی وضعیت مطالعه');
    }
  };

  const handleConvertStudyRecommendation = async (studyId: number, recId: string) => {
    try {
      const res = await apiRequest(`/studies/${studyId}/convert-recommendation`, {
        method: 'POST',
        body: JSON.stringify({ recommendationId: recId }),
      });
      toast.success(
        `توصیه مطالعه با موفقیت به پرونده CAPA (${res.data?.capa?.capaCode || 'جدید'}) تبدیل شد.`
      );
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در تبدیل توصیه به CAPA');
    }
  };

  const handleDeleteStudy = async (studyId: number, studyCode: string) => {
    try {
      await apiRequest(`/studies/${studyId}`, { method: 'DELETE' });
      toast.success(`مطالعه تخصصی ${studyCode} حذف شد.`);
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در حذف مطالعه تخصصی');
    }
  };

  const handleLoadMaturityRecord = (rec: any) => {
    if (!rec || !Array.isArray(rec.elementMaturityData)) return;
    const loaded: Record<string, { design: number; execution: number; culture: number; sustainability: number }> = {};
    CCPS_20_ELEMENTS.forEach((el) => {
      const found = rec.elementMaturityData.find((x: any) => x.elementCode === el.code);
      loaded[el.code] = {
        design: Number(found?.designLevel || 2),
        execution: Number(found?.executionLevel || 2),
        culture: Number(found?.cultureLevel || 2),
        sustainability: Number(found?.sustainabilityLevel || 2),
      };
    });
    setMaturityScores(loaded);
    setMaturityAssessor(rec.assessorName || '');
    setMaturityUnitScope(rec.unitScope || 'کل مجتمع');
    setMaturityStrengths(rec.strengthsSummary || '');
    setMaturityRoadmap(rec.improvementRoadmap || '');
    toast.success(`ارزیابی بلوغ ${rec.assessmentCode} در جدول بارگذاری شد.`);
  };

  const handleSaveMaturityAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    if (!maturityAssessor.trim()) {
      toast.error('نام ارزیاب مدل بلوغ الزامی است.');
      return;
    }
    try {
      const elementMaturityData = CCPS_20_ELEMENTS.map((el) => {
        const sc = maturityScores[el.code] || { design: 2, execution: 2, culture: 2, sustainability: 2 };
        const avg = Number(((sc.design + sc.execution + sc.culture + sc.sustainability) / 4).toFixed(2));
        return {
          elementCode: el.code,
          elementTitleFa: el.titleFa,
          pillarId: el.pillarId,
          designLevel: sc.design,
          executionLevel: sc.execution,
          cultureLevel: sc.culture,
          sustainabilityLevel: sc.sustainability,
          elementLevel: avg,
        };
      });

      await apiRequest('/maturity', {
        method: 'POST',
        body: JSON.stringify({
          projectId: activeProject.id,
          assessmentDate: new Date().toISOString().slice(0, 10),
          assessorName: maturityAssessor.trim(),
          unitScope: maturityUnitScope,
          elementMaturityData,
          strengthsSummary: maturityStrengths,
          improvementRoadmap: maturityRoadmap,
        }),
      });
      toast.success('ارزیابی بلوغ ۵ سطحی PSM با موفقیت در پایگاه داده ثبت شد.');
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت ارزیابی بلوغ');
    }
  };

  const handleFinalHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    try {
      await apiRequest(`/projects/${activeProject.id}/handover`, {
        method: 'POST',
        body: JSON.stringify(handoverForm),
      });
      toast.success('پروژه استقرار PSM پس از احراز کلیه شرایط پذیرش، تأیید نهایی و تحویل شد.');
      await onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'شرایط تحویل نهایی پروژه هنوز تکمیل نشده است.');
    }
  };

  const handleRunLocalAiAnalysis = async () => {
    if (!activeProject) return;
    setAiLoading(true);
    try {
      const res = await apiRequest('/ai-analyze', {
        method: 'POST',
        body: JSON.stringify({
          projectId: activeProject.id,
          analysisMode: aiMode,
          customContext: aiCustomContext,
        }),
      });
      setAiResult({
        ...res.data,
        humanApproved: false,
      });
      toast.success('تحلیل توسط موتور هوش مصنوعی محلی HSECORE آماده شد (نیازمند بررسی و تأیید انسانی).');
    } catch (err: any) {
      toast.error(err?.message || 'خطا در اجرای تحلیل هوش مصنوعی محلی');
    } finally {
      setAiLoading(false);
    }
  };

  // ==========================================================================
  // RENDER BY ACTIVE SUB-TAB
  // ==========================================================================

  if (activeSubTab === 'stage-gates') {
    const selectedGate = stageGates.find((g) => g.gateKey === selectedGateKey) || stageGates[0];
    const approvedCount = stageGates.filter((g) => g.status === 'APPROVED').length;
    const progressPct = stageGates.length > 0 ? Math.round((approvedCount / stageGates.length) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>موتور حاکمیت و کنترل مراحل پروژه PSM</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                مدیریت دروازه‌های ۶ گانه کنترلی (Stage Gate Management G1–G6)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                کنترل اجباری چرخه اجرایی استقرار PSM؛ عبور از هر دروازه مشروط به احراز کامل معیارهای خروج، صحه‌گذاری شواهد، فقدان موانع بحرانی و تاییدیه مستقل در سمت سرور است (قانون اول تا سوم حاکمیت).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fetchStageGates()}
                disabled={loadingGates}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingGates ? 'animate-spin' : ''}`} />
                <span>ارزیابی مجدد و همگام‌سازی</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">کل دروازه‌های مرحله‌ای</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">۶ دروازه (G1 تا G6)</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">دروازه‌های تصویب‌شده</div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {approvedCount} از {stageGates.length || 6}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">پیشرفت حاکمیت پروژه</div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                {progressPct}٪
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">انحرافات مصوب ثبت‌شده</div>
              <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {gateDeviations.length} مورد
              </div>
            </div>
          </div>
        </div>

        {/* 6-Gate Interactive Pipeline Stepper */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              سلسله‌مراتب خط‌لوله دروازه‌های شش‌گانه (PSM Stage Gate Pipeline)
            </h3>
            <span className="text-xs font-bold text-slate-500">جهت بررسی جزئیات و تصمیم‌گیری بر روی هر دروازه کلیک کنید</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {(stageGates.length > 0 ? stageGates : PSM_STAGE_GATES).map((gate: any, idx: number) => {
              const isSelected = selectedGate?.gateKey === gate.gateKey;
              const status = gate.status || (idx === 0 ? 'IN_REVIEW' : 'PENDING');
              const hasBlockers = Boolean(gate.evaluation?.blockingIssues?.length > 0);

              let badgeBg = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
              let badgeBorder = 'border-slate-200 dark:border-slate-700';
              if (status === 'APPROVED') {
                badgeBg = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
              } else if (status === 'IN_REVIEW') {
                badgeBg = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';
              } else if (status === 'REJECTED') {
                badgeBg = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
              } else if (status === 'SUSPENDED') {
                badgeBg = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
              }

              return (
                <div
                  key={gate.gateKey}
                  onClick={() => setSelectedGateKey(gate.gateKey)}
                  className={`p-4 rounded-2xl border transition cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-500/5 ring-2 ring-amber-500/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs">
                        {gate.gateKey}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${badgeBg} ${badgeBorder}`}>
                        {status === 'APPROVED'
                          ? 'تصویب‌شده'
                          : status === 'IN_REVIEW'
                          ? 'در دست بررسی'
                          : status === 'REJECTED'
                          ? 'رد شده (Rework)'
                          : status === 'SUSPENDED'
                          ? 'معلق'
                          : 'در انتظار'}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-2 leading-snug">
                      {gate.titleFa}
                    </h4>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500">
                    {hasBlockers ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>دارای موانع عبور</span>
                      </span>
                    ) : status === 'APPROVED' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>معیارها تأیید شد</span>
                      </span>
                    ) : (
                      <span>آماده ارزیابی</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Gate Dossier */}
        {selectedGate && (() => {
          const catalogGate = PSM_STAGE_GATES.find((g) => g.gateKey === selectedGate.gateKey);
          const entryCriteria = selectedGate.entryCriteriaFa || catalogGate?.entryCriteriaFa || [];
          const exitCriteria = selectedGate.exitCriteriaFa || catalogGate?.exitCriteriaFa || [];

          return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 2 Cols: Details, Criteria, Checklists & Evidence */}
            <div className="lg:col-span-2 space-y-6">
              {/* Gate Info Header Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      دروازه کنترلی شماره {selectedGate.gateNumber} ({selectedGate.gateKey})
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {selectedGate.titleFa}
                    </h3>
                    <div className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                      {selectedGate.titleEn}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                        selectedGate.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : selectedGate.status === 'REJECTED'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : selectedGate.status === 'SUSPENDED'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          : selectedGate.status === 'IN_REVIEW'
                          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      وضعیت: {selectedGate.status === 'APPROVED' ? 'تصویب‌شده (APPROVED)' : selectedGate.status === 'REJECTED' ? 'رد شده (REJECTED)' : selectedGate.status === 'SUSPENDED' ? 'معلق (SUSPENDED)' : selectedGate.status === 'IN_REVIEW' ? 'در دست بررسی (IN_REVIEW)' : 'در انتظار (PENDING)'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  {selectedGate.descriptionFa}
                </p>

                {/* Preparer & Approver Assignment with Inline Edit */}
                {!editingGateRoles ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">ارکان مسئول دروازه (متصل به پرسنل مرکزی):</span>
                      {permissions.canWrite && (
                        <button
                          type="button"
                          onClick={() => {
                            setGatePreparerInput(selectedGate.preparedByName || catalogGate?.defaultPreparerRoleFa || 'مدیر پروژه PSM');
                            setGateApproverInput(selectedGate.approverName || catalogGate?.defaultApproverRoleFa || 'حامی پروژه و مدیرعامل');
                            setEditingGateRoles(true);
                          }}
                          className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          تغییر و انتصاب مسئولین
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50">
                        <span className="font-bold text-slate-500">مسئول آماده‌سازی شواهد: </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedGate.preparedByName || catalogGate?.defaultPreparerRoleFa || 'مدیر پروژه PSM'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/50">
                        <span className="font-bold text-slate-500">ارزیاب و مقام تصویب‌کننده: </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedGate.approverName || catalogGate?.defaultApproverRoleFa || 'حامی پروژه و مدیرعامل'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveGateRoles} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                    <div className="font-bold text-slate-800 dark:text-slate-100">
                      انتصاب مسئول آماده‌سازی و مقام تصویب‌کننده دروازه {selectedGate.gateKey}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">مسئول آماده‌سازی شواهد *</label>
                        <input
                          type="text"
                          required
                          list="psm-central-personnel-list"
                          value={gatePreparerInput}
                          onChange={(e) => setGatePreparerInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">ارزیاب و مقام تصویب‌کننده *</label>
                        <input
                          type="text"
                          required
                          list="psm-central-personnel-list"
                          value={gateApproverInput}
                          onChange={(e) => setGateApproverInput(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingGateRoles(false)}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
                      >
                        انصراف
                      </button>
                      <button
                        type="submit"
                        disabled={savingGateRoles}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black cursor-pointer"
                      >
                        {savingGateRoles ? 'در حال ثبت...' : 'ذخیره مسئولین دروازه'}
                      </button>
                    </div>
                  </form>
                )}

                {selectedGate.decisionDate && (
                  <div className="p-3.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/50 text-xs text-sky-900 dark:text-sky-200 space-y-1">
                    <div className="font-bold flex items-center justify-between">
                      <span>تاریخ آخرین تصمیم: {selectedGate.decisionDate}</span>
                      <span>تأییدکننده: {selectedGate.approvedBy || selectedGate.approverName}</span>
                    </div>
                    {selectedGate.meetingMinutes && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold">صورتجلسه: </span>
                        {selectedGate.meetingMinutes}
                      </div>
                    )}
                    {selectedGate.comments && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold">توضیحات: </span>
                        {selectedGate.comments}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Entry & Exit Criteria Card (معیارهای ورود و خروج دروازه) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-500" />
                    <span>معیارهای ورود و خروج دروازه {selectedGate.gateKey} (Entry & Exit Criteria)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">Gate Governance Standard</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                    <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs bg-sky-500" />
                      <span>معیارهای ورود به دروازه (Entry Criteria)</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside leading-relaxed">
                      {entryCriteria.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                    <div className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-xs bg-emerald-500" />
                      <span>معیارهای خروج و تصویب (Exit Criteria)</span>
                    </div>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 list-disc list-inside leading-relaxed">
                      {exitCriteria.map((c: string, i: number) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Mandatory Exit Checklist & Criteria */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-amber-500" />
                    <span>چک‌لیست الزامات اجباری خروج از دروازه (Mandatory Exit Checklist)</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400">ارزیابی خودکار سمت سرور</span>
                </div>

                <div className="space-y-2.5">
                  {(selectedGate.mandatoryChecklist || []).map((item: any) => {
                    const isChecked = Boolean(selectedGate.evaluation?.checklistResults?.[item.id]);
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                          isChecked
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-800 dark:text-slate-100'
                            : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isChecked
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                          }`}
                        >
                          {isChecked ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="font-bold">{item.labelFa}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{item.requirementKey}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                            isChecked
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                        >
                          {isChecked ? 'احراز شده' : 'در انتظار احراز'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Required Evidence Dossier */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-sky-500" />
                    <span>فهرست شواهد و مدارک موردنیاز دروازه (Required Evidence Dossier)</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400">کنترل شواهد و صحه‌گذاری</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {(selectedGate.requiredEvidenceList || []).map((ev: any) => (
                    <div
                      key={ev.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">{ev.titleFa}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {ev.descriptionFa}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/40 dark:border-slate-700/40 space-y-1 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-500">معیار پذیرش: </span>
                          <span className="text-slate-700 dark:text-slate-300">{ev.acceptanceCriteriaFa}</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500">مسئول ارائه: </span>
                          <span className="text-slate-700 dark:text-slate-300">{ev.responsibleRoleFa}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 1 Col: Evaluation & Server Controls */}
            <div className="space-y-6">
              {/* Live Blocker Alert Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span>موانع عبور و پایش سمت سرور</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleEvaluateGate(selectedGate.gateKey)}
                    disabled={evaluatingGateKey === selectedGate.gateKey}
                    className="text-[11px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${evaluatingGateKey === selectedGate.gateKey ? 'animate-spin' : ''}`} />
                    <span>ارزیابی مجدد</span>
                  </button>
                </div>

                {selectedGate.evaluation?.blockingIssues?.length > 0 ? (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-2 text-xs">
                    <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{selectedGate.evaluation.blockingIssues.length} مانع بحرانی برای عبور از دروازه:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-rose-900 dark:text-rose-300 text-[11.5px] leading-relaxed">
                      {selectedGate.evaluation.blockingIssues.map((issue: string, i: number) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                    <div className="text-[10.5px] text-rose-600 dark:text-rose-400 font-bold mt-2 pt-2 border-t border-rose-200/50 dark:border-rose-900/40">
                      قانون ۳ حاکمیت: تا زمان برطرف شدن موانع یا ثبت انحراف فنی مصوب، تصویب دروازه مسدود است.
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>هیچ مانع بحرانی در سمت سرور شناسایی نشد.</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      کلیه معیارهای ارزیابی اولیه، شواهد و وابستگی‌های پیش‌نیاز احراز شده‌اند.
                    </p>
                  </div>
                )}

                {/* Overriding Approved Deviations */}
                {selectedGate.evaluation?.approvedDeviations?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                    <div className="font-bold">انحرافات مصوب موثر بر این دروازه:</div>
                    {selectedGate.evaluation.approvedDeviations.map((dev: any) => (
                      <div key={dev.id} className="text-[11px]">
                        • کد: <span className="font-mono">{dev.deviationCode}</span> — {dev.title} (معتبر تا {dev.validUntilDate})
                      </div>
                    ))}
                  </div>
                )}

                {/* Decision Actions Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    عملیات تصمیم‌گیری حاکمیتی (تصویب / رد / تعلیق):
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={!permissions.canApprove}
                      onClick={() => {
                        setGateDecisionType('APPROVED');
                        setShowGateDecisionModal(true);
                      }}
                      className="px-2.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-xs disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>تصویب</span>
                    </button>

                    <button
                      type="button"
                      disabled={!permissions.canWrite}
                      onClick={() => {
                        setGateDecisionType('REJECTED');
                        setShowGateDecisionModal(true);
                      }}
                      className="px-2.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shadow-xs disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>رد (Rework)</span>
                    </button>

                    <button
                      type="button"
                      disabled={!permissions.canWrite}
                      onClick={() => {
                        setGateDecisionType('SUSPENDED');
                        setShowGateDecisionModal(true);
                      }}
                      className="px-2.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black shadow-xs disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>تعلیق</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!permissions.canWrite}
                    onClick={() => setShowDeviationModal(true)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 hover:bg-indigo-100/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>درخواست انحراف مصوب (Formal Deviation)</span>
                  </button>
                </div>
              </div>

              {/* Gate Change History */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>تاریخچه تصمیمات و سوابق تغییرات</span>
                </h4>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {(selectedGate.changeHistory || []).length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-4">هنوز سابقه‌ای ثبت نشده است.</div>
                  ) : (
                    (selectedGate.changeHistory || []).map((h: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{h.action}</span>
                          <span className="font-mono text-[10px]">{h.timestamp ? new Date(h.timestamp).toLocaleString('fa-IR') : '—'}</span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 text-[11px]">{h.note || '—'}</div>
                        <div className="text-[10px] text-slate-400">اقدام‌کننده: {h.actor || 'سیستم'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Deviations Register Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                دفتر ثبت انحرافات مصوب پروژه (PSM Gate Deviations Register)
              </h3>
              <p className="text-xs text-slate-500">
                قانون ۳: هرگونه انحراف موقت صرفاً با توجیه فنی، ارزیابی ریسک و تعیین اقدامات جبرانی مصوب می‌گردد (الزامات قانونی غیرقابل انحراف هستند).
              </p>
            </div>
            <button
              type="button"
              disabled={!permissions.canWrite}
              onClick={() => setShowDeviationModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت انحراف جدید</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                  <th className="py-3 px-3">کد انحراف</th>
                  <th className="py-3 px-3">دروازه</th>
                  <th className="py-3 px-3">عنوان و شرح الزام</th>
                  <th className="py-3 px-3">توجیه فنی و اقدامات جبرانی</th>
                  <th className="py-3 px-3">نوع الزام</th>
                  <th className="py-3 px-3">مهلت اعتبار</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3">عملیات تصویب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gateDeviations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      هیچ انحرافی برای این پروژه ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  gateDeviations.map((dev: any) => (
                    <tr key={dev.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {dev.deviationCode}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {dev.gateKey}
                        </span>
                      </td>
                      <td className="py-3 px-3 max-w-[220px]">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{dev.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{dev.requirementDescription}</div>
                      </td>
                      <td className="py-3 px-3 max-w-[240px] text-[11px] text-slate-600 dark:text-slate-300">
                        <div><span className="font-bold text-slate-500">توجیه: </span>{dev.technicalJustification}</div>
                        <div className="mt-1 text-emerald-700 dark:text-emerald-400">
                          <span className="font-bold">اقدامات جبرانی: </span>{dev.compensatoryMeasures}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-bold">
                        {dev.isLegalRequirement ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                            قانونی / اجباری (غیرقابل انحراف)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                            فنی / سازمانی
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {dev.validUntilDate}
                      </td>
                      <td className="py-3 px-3 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10.5px] ${
                            dev.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : dev.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}
                        >
                          {dev.status === 'APPROVED' ? 'تصویب‌شده' : dev.status === 'REJECTED' ? 'رد شده' : 'در انتظار بررسی'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {dev.status === 'PENDING' && permissions.canApprove ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDecideDeviation(dev.id, 'APPROVED')}
                              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold cursor-pointer"
                            >
                              تصویب
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecideDeviation(dev.id, 'REJECTED')}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] font-bold cursor-pointer"
                            >
                              رد
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Gate Decision (Approve / Reject) */}
        {showGateDecisionModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {gateDecisionType === 'APPROVED' ? 'تصویب رسمی دروازه' : 'رد دروازه و الزام بازنگری (Rework)'} — {selectedGateKey}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGateDecisionModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitGateDecision} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نوع تصمیم</label>
                  <select
                    value={gateDecisionType}
                    onChange={(e: any) => setGateDecisionType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="APPROVED">تصویب رسمی (APPROVED) — انتقال به مرحله بعد</option>
                    <option value="REJECTED">رد رسمی (REJECTED) — ارجاع به بازنگری و رفع نواقص</option>
                    <option value="SUSPENDED">تعلیق موقت (SUSPENDED)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شماره یا شرح صورتجلسه کمیته راهبری *
                  </label>
                  <input
                    type="text"
                    required
                    value={gateDecisionMinutes}
                    onChange={(e) => setGateDecisionMinutes(e.target.value)}
                    placeholder="مثال: صورتجلسه نشست ۳۴ کمیته راهبری PSM مورخ ۱۴۰۵/۱۱/۲۰"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {gateDecisionType === 'REJECTED' ? 'دستورات بازنگری و نواقص الزامی برای رفع *' : 'توضیحات و مصوبات نهایی'}
                  </label>
                  <textarea
                    rows={3}
                    required={gateDecisionType === 'REJECTED'}
                    value={gateDecisionComments}
                    onChange={(e) => setGateDecisionComments(e.target.value)}
                    placeholder={
                      gateDecisionType === 'REJECTED'
                        ? 'شرح دقیق مواردی که باید قبل از ارزیابی مجدد تکمیل شوند...'
                        : 'توضیحات تکمیلی پیرامون نحوه اجرای تصمیم...'
                    }
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نام مقام تأییدکننده</label>
                  <input
                    type="text"
                    value={gateDecisionApprover}
                    onChange={(e) => setGateDecisionApprover(e.target.value)}
                    placeholder="نام و سمت مدیر تصویب‌کننده..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowGateDecisionModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submittingGateDecision}
                    className={`px-5 py-2 rounded-xl text-white font-black shadow-md cursor-pointer disabled:opacity-50 ${
                      gateDecisionType === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {submittingGateDecision ? 'در حال ثبت...' : 'ثبت قطعی تصمیم دروازه'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Deviation */}
        {showDeviationModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl my-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  ثبت درخواست انحراف مصوب (Stage Gate Deviation Request)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowDeviationModal(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateDeviation} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان انحراف *</label>
                  <input
                    type="text"
                    required
                    value={newDeviation.title}
                    onChange={(e) => setNewDeviation({ ...newDeviation, title: e.target.value })}
                    placeholder="مثال: تمدید مهلت تدوین ماتریس ریسک یکپارچه پتروشیمی رجال"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">شرح الزام موضوع انحراف *</label>
                  <textarea
                    rows={2}
                    required
                    value={newDeviation.requirementDescription}
                    onChange={(e) => setNewDeviation({ ...newDeviation, requirementDescription: e.target.value })}
                    placeholder="شرح الزامی که عبور از دروازه را متوقف کرده است..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">توجیه فنی مستند (حداقل ۱۰ کاراکتر) *</label>
                    <textarea
                      rows={2}
                      required
                      value={newDeviation.technicalJustification}
                      onChange={(e) => setNewDeviation({ ...newDeviation, technicalJustification: e.target.value })}
                      placeholder="علت فنی و دلایل عدم امکان تحقق به موقع..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اقدامات جبرانی و کنترلی (Compensatory Measures) *</label>
                    <textarea
                      rows={2}
                      required
                      value={newDeviation.compensatoryMeasures}
                      onChange={(e) => setNewDeviation({ ...newDeviation, compensatoryMeasures: e.target.value })}
                      placeholder="چه کنترل‌های موقتی برای جبران ریسک اعمال شده است..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نام درخواست‌کننده *</label>
                    <input
                      type="text"
                      required
                      value={newDeviation.requestedByName}
                      onChange={(e) => setNewDeviation({ ...newDeviation, requestedByName: e.target.value })}
                      placeholder="نام و سمت متقاضی..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">مهلت اعتبار انحراف *</label>
                    <input
                      type="date"
                      required
                      value={newDeviation.validUntilDate}
                      onChange={(e) => setNewDeviation({ ...newDeviation, validUntilDate: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                {/* Legal / Statutory Checkbox */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newDeviation.isLegalRequirement}
                      onChange={(e) => setNewDeviation({ ...newDeviation, isLegalRequirement: e.target.checked })}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="font-bold text-amber-900 dark:text-amber-300">
                      این مورد از الزامات قانونی، استانداردهای ملی یا مقررات اجباری است
                    </span>
                  </label>
                  <p className="text-[10.5px] text-amber-700 dark:text-amber-400 mr-6">
                    توجه به قانون سوم: بر اساس قوانین حاکمیت PSM، الزامات قانونی تحت هیچ شرایطی قابل چشم‌پوشی یا انحراف نبوده و توسط سیستم مسدود خواهند شد.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowDeviationModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDeviation}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submittingDeviation ? 'در حال ثبت...' : 'ثبت درخواست انحراف مصوب'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSubTab === 'gap-analysis') {
    const filteredGaps = projectData.gaps.filter((g) => {
      if (gapFilterRisk !== 'ALL' && g.riskLevel !== gapFilterRisk) return false;
      if (gapFilterUnit !== 'ALL' && g.unitName !== gapFilterUnit) return false;
      if (gapSearchQuery.trim()) {
        const q = gapSearchQuery.trim().toLowerCase();
        const match =
          (g.gapCode || '').toLowerCase().includes(q) ||
          (g.title || '').toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q) ||
          (g.standardReference || '').toLowerCase().includes(q) ||
          (g.responsiblePersonName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const criticalHighOpenCount = projectData.gaps.filter(
      (g) => (g.riskLevel === 'CRITICAL' || g.riskLevel === 'HIGH') && g.status !== 'CLOSED' && !g.isOutOfScope
    ).length;
    const convertedGapsCount = projectData.gaps.filter(
      (g) => Boolean(g.linkedWbsId || g.linkedCapaId || g.status === 'CONVERTED_TO_WBS' || g.status === 'IN_CAPA')
    ).length;
    const outOfScopeGapsCount = projectData.gaps.filter((g) => Boolean(g.isOutOfScope)).length;

    return (
      <div className="space-y-5">
        {/* Gap Analysis KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">کل شکاف‌های ثبت / استخراج‌شده</div>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {projectData.gaps.length} شکاف
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">از ارزیابی‌های CCPS و OSHA</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <ListChecks className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">شکاف‌های بحرانی و ریسک بالا باز</div>
              <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {criticalHighOpenCount} مورد
              </div>
              <div className="text-[11px] text-rose-500 font-bold mt-0.5">نیازمند برنامه اجرایی پیش از دروازه G2</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">تبدیل‌شده به برنامه (WBS / CAPA)</div>
              <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {convertedGapsCount} شکاف
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">متصل به بسته کاری و اقدام اصلاحی</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">استثنائات خارج از دامنه مصوب</div>
              <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">
                {outOfScopeGapsCount} مورد
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">دارای توجیه فنی و تأیید مقام مجاز</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              مدیریت تحلیل شکاف (Gap Analysis) و استخراج خودکار از ارزیابی‌ها
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              شکاف‌ها پس از ارزیابی اولیه به‌صورت خودکار استخراج می‌شوند. موارد خارج از دامنه صرفاً با توجیه فنی مستند و تأیید مقام مجاز پذیرفته می‌شوند.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!permissions.canWrite || extractingGaps}
              onClick={handleAutoExtractAllGaps}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${extractingGaps ? 'animate-spin' : ''}`} />
              <span>استخراج خودکار شکاف‌ها از ارزیابی‌ها</span>
            </button>
            <button
              type="button"
              disabled={!permissions.canWrite}
              onClick={() => setShowNewGapForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت شکاف یا استثنای دامنه</span>
            </button>
          </div>
        </div>

        {showNewGapForm && (
          <form
            onSubmit={handleCreateGap}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              ثبت شکاف جدید / ثبت مورد خارج از دامنه با توجیه فنی
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان شکاف *</label>
                <input
                  required
                  value={newGap.title}
                  onChange={(e) => setNewGap({ ...newGap, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="مثلاً: نقص نقشه‌های P&ID As-Built راکتور پلیمریزاسیون"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنصر استاندارد CCPS *</label>
                <select
                  value={newGap.ccpsElementCode}
                  onChange={(e) => {
                    const el = CCPS_20_ELEMENTS.find((x) => x.code === e.target.value);
                    setNewGap({
                      ...newGap,
                      ccpsElementCode: e.target.value,
                      standardReference: el ? `${el.code} (${el.titleEn}) | ${el.nationalAndRejalRef}` : e.target.value,
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {CCPS_20_ELEMENTS.map((el) => (
                    <option key={el.code} value={el.code}>
                      {el.code} - {el.titleFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">واحد فرایندی مربوطه *</label>
                <input
                  required
                  list="psm-units-list"
                  value={newGap.unitName}
                  onChange={(e) => setNewGap({ ...newGap, unitName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">سطح ریسک *</label>
                <select
                  value={newGap.riskLevel}
                  onChange={(e) => setNewGap({ ...newGap, riskLevel: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="CRITICAL">بحرانی (CRITICAL)</option>
                  <option value="HIGH">بالا (HIGH)</option>
                  <option value="MEDIUM">متوسط (MEDIUM)</option>
                  <option value="LOW">پایین (LOW)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مسئول پیگیری *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newGap.responsiblePersonName}
                  onChange={(e) => setNewGap({ ...newGap, responsiblePersonName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مهلت پیشنهادی *</label>
                <input
                  type="date"
                  required
                  value={newGap.proposedDueDate}
                  onChange={(e) => setNewGap({ ...newGap, proposedDueDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">شرح دقیق شکاف *</label>
                <textarea
                  required
                  rows={2}
                  value={newGap.description}
                  onChange={(e) => setNewGap({ ...newGap, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مدرک موردنیاز جهت رفع شکاف</label>
                <input
                  value={newGap.requiredDocument}
                  onChange={(e) => setNewGap({ ...newGap, requiredDocument: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="مثلاً: پرونده P&ID As-Built ویرایش جدید"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newGap.isOutOfScope}
                  onChange={(e) => setNewGap({ ...newGap, isOutOfScope: e.target.checked })}
                />
                <span>این مورد خارج از دامنه شمول است (نیازمند توجیه فنی و تأیید مقام مجاز)</span>
              </label>

              {newGap.isOutOfScope && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                      توجیه فنی مستند خارج از دامنه بودن (حداقل ۱۵ کاراکتر) *
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={newGap.technicalJustification}
                      onChange={(e) => setNewGap({ ...newGap, technicalJustification: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-200 mb-1">
                      نام مقام مجاز تأییدکننده *
                    </label>
                    <input
                      required
                      list="psm-personnel-list"
                      value={newGap.justificationApprovedBy}
                      onChange={(e) => setNewGap({ ...newGap, justificationApprovedBy: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewGapForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                ذخیره در فهرست شکاف‌ها
              </button>
            </div>
          </form>
        )}

        {/* Filter bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setGapFilterRisk(lvl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  gapFilterRisk === lvl
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {lvl === 'ALL'
                  ? `همه شکاف‌ها (${projectData.gaps.length})`
                  : lvl === 'CRITICAL'
                  ? 'بحرانی'
                  : lvl === 'HIGH'
                  ? 'ریسک بالا'
                  : lvl === 'MEDIUM'
                  ? 'ریسک متوسط'
                  : 'ریسک پایین'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={gapFilterUnit}
              onChange={(e) => setGapFilterUnit(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
            >
              <option value="ALL">همه واحدها</option>
              <option value="کل مجتمع">کل مجتمع</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={gapSearchQuery}
              onChange={(e) => setGapSearchQuery(e.target.value)}
              placeholder="جستجوی کد، عنوان، مسئول یا مرجع..."
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs min-w-[210px]"
            />
          </div>
        </div>

        {/* Gaps Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {filteredGaps.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                هنوز شکافی در این فیلتر ثبت یا استخراج نشده است
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ابتدا در تب «ارزیابی اولیه CCPS/OSHA» عناصر را ارزیابی کنید یا روی «استخراج خودکار شکاف‌ها» کلیک نمایید.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">شناسه شکاف</th>
                    <th className="py-3 px-4 font-bold">عنوان و شرح شکاف</th>
                    <th className="py-3 px-4 font-bold">مرجع استاندارد</th>
                    <th className="py-3 px-4 font-bold">واحد</th>
                    <th className="py-3 px-4 font-bold">سطح ریسک</th>
                    <th className="py-3 px-4 font-bold">مدرک موردنیاز</th>
                    <th className="py-3 px-4 font-bold">مسئول و مهلت</th>
                    <th className="py-3 px-4 font-bold">وضعیت / تبدیل به برنامه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {filteredGaps.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">
                        {g.gapCode}
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{g.title}</div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{g.description}</div>
                        {g.isOutOfScope && (
                          <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                            خارج از دامنه (تأیید: {g.justificationApprovedBy}) — توجیه: {g.technicalJustification}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-[200px]">
                        {g.standardReference}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">{g.unitName}</td>
                      <td className="py-3 px-4 font-bold">
                        <span
                          className={
                            g.riskLevel === 'CRITICAL'
                              ? 'text-red-600 dark:text-red-400'
                              : g.riskLevel === 'HIGH'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-sky-600 dark:text-sky-400'
                          }
                        >
                          {g.riskLevel === 'CRITICAL'
                            ? 'بحرانی'
                            : g.riskLevel === 'HIGH'
                            ? 'بالا'
                            : g.riskLevel === 'MEDIUM'
                            ? 'متوسط'
                            : 'پایین'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[180px]">
                        {g.requiredDocument || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {g.responsiblePersonName}
                        </div>
                        <div className="font-mono tabular-nums text-slate-500">{g.proposedDueDate}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                              وضعیت: {g.status}
                            </span>
                            {g.linkedWbsId && (
                              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 text-[10px] font-bold">
                                متصل به WBS #{g.linkedWbsId}
                              </span>
                            )}
                            {g.linkedCapaId && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                                متصل به CAPA #{g.linkedCapaId}
                              </span>
                            )}
                          </div>
                          {!g.isOutOfScope && g.status !== 'CLOSED' && (
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleConvertGap(g.id, 'WBS')}
                                className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-700 text-white text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
                              >
                                + فعالیت WBS
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConvertGap(g.id, 'CAPA')}
                                className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
                              >
                                + پرونده CAPA
                              </button>
                              <button
                                type="button"
                                onClick={() => handleConvertGap(g.id, 'BOTH')}
                                className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
                                title="تبدیل همزمان به بسته کاری WBS و اقدام اصلاحی CAPA"
                              >
                                + هر دو (WBS & CAPA)
                              </button>
                              <button
                                type="button"
                                disabled={!permissions.canWrite}
                                onClick={() => {
                                  setExtendingGap(g);
                                  setExtensionNewDate(g.proposedDueDate || new Date().toISOString().slice(0, 10));
                                  setExtensionJustification('');
                                }}
                                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-800 text-white text-[10.5px] font-bold cursor-pointer whitespace-nowrap"
                              >
                                تمدید مهلت
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Extend Gap Due Date (قانون ۱ و سناریو ۷) */}
        {extendingGap && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  تمدید رسمی مهلت رفع شکاف — {extendingGap.gapCode}
                </h3>
                <button
                  type="button"
                  onClick={() => setExtendingGap(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleExtendGapDeadline} className="space-y-4 text-xs">
                <div>
                  <div className="text-slate-500 font-bold mb-1">عنوان شکاف:</div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold">
                    {extendingGap.title}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 mb-1">مهلت فعلی</label>
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 font-mono text-slate-700 dark:text-slate-300">
                      {extendingGap.proposedDueDate}
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">مهلت جدید پیشنهادی *</label>
                    <input
                      type="date"
                      required
                      value={extensionNewDate}
                      onChange={(e) => setExtensionNewDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    توجیه فنی مستند تمدید مهلت (حداقل ۱۰ کاراکتر) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={extensionJustification}
                    onChange={(e) => setExtensionJustification(e.target.value)}
                    placeholder="علت تأخیر، چالش‌های اجرایی یا فنی و دلایل تمدید مهلت..."
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    قانون ۱ و ۴ حاکمیت: کلیه تمدیدها به همراه مقادیر قبل و بعد در لاگ ممیزی (Audit Log) سیستم ثبت دائمی می‌شوند.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setExtendingGap(null)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submittingExtension}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {submittingExtension ? 'در حال ثبت...' : 'ثبت تمدید مهلت در سیستم'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSubTab === 'wbs-gantt') {
    const allTasks = projectData.wbsTasks;
    const totalWeight = allTasks.reduce((acc, t) => acc + Math.max(1, Number(t.weight || 1)), 0);
    const weightedActual =
      totalWeight > 0
        ? Math.round(
            allTasks.reduce((acc, t) => acc + Number(t.actualProgress || 0) * Math.max(1, Number(t.weight || 1)), 0) /
              totalWeight
          )
        : 0;
    const weightedPlanned =
      totalWeight > 0
        ? Math.round(
            allTasks.reduce((acc, t) => acc + Number(t.plannedProgress || 0) * Math.max(1, Number(t.weight || 1)), 0) /
              totalWeight
          )
        : 0;
    const criticalTasksCount = allTasks.filter((t) => Boolean(t.isCritical)).length;
    const milestonesCount = allTasks.filter((t) => Boolean(t.isMilestone)).length;
    const delayedTasks = allTasks.filter((t) => Number(t.delayDays || 0) > 0 && Number(t.actualProgress || 0) < 100);
    const maxDelayDays = delayedTasks.reduce((max, t) => Math.max(max, Number(t.delayDays || 0)), 0);
    const totalWbsBudget = allTasks.reduce((acc, t) => acc + Number(t.allocatedBudget || 0), 0);
    const totalWbsActualCost = allTasks.reduce((acc, t) => acc + Number(t.actualCost || 0), 0);

    const filteredTasks = allTasks.filter((t) => {
      if (wbsFilterStatus === 'CRITICAL' && !t.isCritical) return false;
      if (wbsFilterStatus === 'DELAYED' && !(Number(t.delayDays || 0) > 0 && Number(t.actualProgress || 0) < 100))
        return false;
      if (wbsFilterStatus === 'COMPLETED' && Number(t.actualProgress || 0) < 100) return false;
      if (wbsFilterStatus === 'MILESTONE' && !t.isMilestone) return false;
      if (wbsFilterUnit !== 'ALL' && t.unitName !== wbsFilterUnit) return false;
      if (wbsSearchQuery.trim()) {
        const q = wbsSearchQuery.trim().toLowerCase();
        const match =
          (t.wbsCode || '').toLowerCase().includes(q) ||
          (t.title || '').toLowerCase().includes(q) ||
          (t.ownerName || '').toLowerCase().includes(q) ||
          (t.executorName || '').toLowerCase().includes(q) ||
          (t.elementCode || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    // Compute Timeline Bounds for Visual Calendar Gantt
    const dateTimestamps = allTasks
      .flatMap((t) => [Date.parse(t.plannedStart), Date.parse(t.plannedEnd)])
      .filter((ts) => !Number.isNaN(ts));
    const minTs = dateTimestamps.length > 0 ? Math.min(...dateTimestamps) : Date.now() - 15 * 86400000;
    const maxTs = dateTimestamps.length > 0 ? Math.max(...dateTimestamps, minTs + 7 * 86400000) : Date.now() + 60 * 86400000;
    const totalSpanMs = Math.max(7 * 86400000, maxTs - minTs);
    const todayTs = Date.now();
    const todayOffsetPct = Math.min(100, Math.max(0, ((todayTs - minTs) / totalSpanMs) * 100));

    return (
      <div className="space-y-5">
        {/* WBS & Schedule KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">پیشرفت وزنی کل WBS (واقعی / برنامه‌ای)</div>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {weightedActual}% <span className="text-xs font-normal text-slate-400">/ برنامه {weightedPlanned}%</span>
              </div>
              <div
                className={`text-[11px] font-bold mt-0.5 ${
                  weightedActual >= weightedPlanned ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                انحراف کل: {weightedActual - weightedPlanned >= 0 ? `+${weightedActual - weightedPlanned}` : weightedActual - weightedPlanned}%
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">فعالیت‌های مسیر بحرانی و نقاط عطف</div>
              <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {criticalTasksCount} بحرانی
              </div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                ◆ {milestonesCount} نقطه عطف کلیدی (Milestone)
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <GitBranch className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">فعالیت‌های دارای تأخیر زمانی</div>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                {delayedTasks.length} فعالیت
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {maxDelayDays > 0 ? `بیشترین تأخیر: ${maxDelayDays} روز` : 'بدون تأخیر بحرانی'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-500">بودجه و هزینه بسته‌های کاری</div>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">
                {totalWbsActualCost.toLocaleString('fa-IR')} / {totalWbsBudget.toLocaleString('fa-IR')}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">هزینه واقعی / بودجه مصوب WBS</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Header & Action Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              مدیریت ساختار شکست کار (WBS)، مسیر بحرانی و نمودار گانت (Gantt Chart)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              مقایسه پیشرفت برنامه‌ای و واقعی، کنترل وابستگی‌های پیش‌نیاز، محاسبه خودکار تأخیر زمانی، بودجه و نقاط عطف اجرایی استقرار PSM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setWbsViewMode('SPLIT')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  wbsViewMode === 'SPLIT' ? 'bg-amber-500 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                نمای ترکیبی (جدول + گانت)
              </button>
              <button
                type="button"
                onClick={() => setWbsViewMode('TIMELINE')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  wbsViewMode === 'TIMELINE' ? 'bg-amber-500 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                گانت تقویمی
              </button>
              <button
                type="button"
                onClick={() => setWbsViewMode('TABLE')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  wbsViewMode === 'TABLE' ? 'bg-amber-500 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                جدول WBS
              </button>
            </div>

            <button
              type="button"
              disabled={!permissions.canWrite}
              onClick={() => setShowNewWbsForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تعریف فعالیت اصلی / زیرفعالیت WBS</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'ALL', label: `همه فعالیت‌ها (${allTasks.length})` },
                { key: 'CRITICAL', label: `مسیر بحرانی (${criticalTasksCount})` },
                { key: 'DELAYED', label: `دارای تأخیر (${delayedTasks.length})` },
                { key: 'MILESTONE', label: `نقاط عطف (${milestonesCount})` },
                { key: 'COMPLETED', label: 'تکمیل‌شده (100%)' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setWbsFilterStatus(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  wbsFilterStatus === f.key
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={wbsFilterUnit}
              onChange={(e) => setWbsFilterUnit(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
            >
              <option value="ALL">همه واحدها</option>
              <option value="کل مجتمع">کل مجتمع</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={wbsSearchQuery}
              onChange={(e) => setWbsSearchQuery(e.target.value)}
              placeholder="جستجوی کد WBS، عنوان، مسئول یا مجری..."
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs min-w-[210px]"
            />
          </div>
        </div>

        {/* WBS Creation Form */}
        {showNewWbsForm && (
          <form
            onSubmit={handleCreateWbs}
            className="bg-white dark:bg-slate-900 border-2 border-teal-500/40 rounded-2xl p-5 space-y-4"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              تعریف فعالیت جدید در ساختار شکست کار (WBS)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">کد WBS *</label>
                <input
                  required
                  value={newWbs.wbsCode}
                  onChange={(e) => setNewWbs({ ...newWbs, wbsCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                  placeholder="مثلاً 1.2.1"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان فعالیت اجرایی *</label>
                <input
                  required
                  value={newWbs.title}
                  onChange={(e) => setNewWbs({ ...newWbs, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="مثلاً: بازنگری و صحه‌گذاری P&ID واحد پلیمریزاسیون"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنصر CCPS مرتبط</label>
                <select
                  value={newWbs.elementCode}
                  onChange={(e) => setNewWbs({ ...newWbs, elementCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {CCPS_20_ELEMENTS.map((el) => (
                    <option key={el.code} value={el.code}>
                      {el.code} - {el.titleFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">واحد عملیاتی / فرایندی *</label>
                <input
                  required
                  list="psm-units-list"
                  value={newWbs.unitName}
                  onChange={(e) => setNewWbs({ ...newWbs, unitName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مسئول فعالیت (از پرسنل مرکزی) *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newWbs.ownerName}
                  onChange={(e) => setNewWbs({ ...newWbs, ownerName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مجری فعالیت (از پرسنل مرکزی) *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newWbs.executorName}
                  onChange={(e) => setNewWbs({ ...newWbs, executorName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">منابع و تحویل‌دادنی‌ها</label>
                <input
                  value={newWbs.resources}
                  onChange={(e) => setNewWbs({ ...newWbs, resources: e.target.value })}
                  placeholder="تیم HAZOP، نقشه‌های As-Built..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">شروع برنامه‌ای *</label>
                <input
                  type="date"
                  required
                  value={newWbs.plannedStart}
                  onChange={(e) => setNewWbs({ ...newWbs, plannedStart: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">پایان برنامه‌ای *</label>
                <input
                  type="date"
                  required
                  value={newWbs.plannedEnd}
                  onChange={(e) => setNewWbs({ ...newWbs, plannedEnd: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">وزن فعالیت (۱ تا ۱۰)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newWbs.weight}
                  onChange={(e) => setNewWbs({ ...newWbs, weight: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">بودجه تخصیصی (ریال)</label>
                <input
                  type="number"
                  min={0}
                  value={newWbs.allocatedBudget}
                  onChange={(e) => setNewWbs({ ...newWbs, allocatedBudget: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">وابستگی‌های پیش‌نیاز (کدهای WBS با کاما)</label>
                <input
                  value={newWbs.dependenciesText}
                  onChange={(e) => setNewWbs({ ...newWbs, dependenciesText: e.target.value })}
                  placeholder="مثلاً: 1.1, 1.2"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div className="flex items-center gap-4 pt-5 md:col-span-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newWbs.isCritical}
                    onChange={(e) => setNewWbs({ ...newWbs, isCritical: e.target.checked })}
                  />
                  <span>مسیر بحرانی (Critical Path)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newWbs.isMilestone}
                    onChange={(e) => setNewWbs({ ...newWbs, isMilestone: e.target.checked })}
                  />
                  <span>نقطه عطف (Milestone ◆)</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewWbsForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                ثبت در ساختار WBS
              </button>
            </div>
          </form>
        )}

        {/* Visual Calendar Timeline Gantt Chart */}
        {(wbsViewMode === 'SPLIT' || wbsViewMode === 'TIMELINE') && filteredTasks.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  <span>نمودار گانت تقویمی و مسیر بحرانی (Interactive Timeline Gantt & Critical Path)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  بازه تقویمی برنامه: {new Date(minTs).toISOString().slice(0, 10)} تا {new Date(maxTs).toISOString().slice(0, 10)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-3 h-2 rounded-xs bg-slate-300 dark:bg-slate-600 inline-block" />
                  خط مبنای برنامه (Baseline)
                </span>
                <span className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                  <span className="w-3 h-2 rounded-xs bg-teal-600 inline-block" />
                  پیشرفت واقعی عادی
                </span>
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <span className="w-3 h-2 rounded-xs bg-rose-600 inline-block" />
                  مسیر بحرانی / دارای تأخیر
                </span>
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  ◆ نقطه عطف (Milestone)
                </span>
              </div>
            </div>

            <div className="space-y-2.5 overflow-x-auto">
              {filteredTasks.map((t) => {
                const startTs = Date.parse(t.plannedStart) || minTs;
                const endTs = Math.max(startTs + 86400000, Date.parse(t.plannedEnd) || maxTs);
                const leftPct = Math.min(96, Math.max(0, ((startTs - minTs) / totalSpanMs) * 100));
                const widthPct = Math.min(100 - leftPct, Math.max(3, ((endTs - startTs) / totalSpanMs) * 100));
                const actPct = Math.min(100, Math.max(0, Number(t.actualProgress || 0)));

                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-12 items-center gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800/60 text-xs"
                  >
                    <div className="col-span-4 sm:col-span-3 truncate pr-1">
                      <span className="font-mono font-black text-slate-700 dark:text-slate-300 ml-1.5">
                        {t.wbsCode}
                      </span>
                      {t.isMilestone && <span className="text-amber-500 ml-1">◆</span>}
                      <span className="font-bold text-slate-900 dark:text-slate-100">{t.title}</span>
                    </div>

                    <div className="col-span-6 sm:col-span-7 relative h-7 bg-slate-100 dark:bg-slate-800/70 rounded-lg overflow-hidden">
                      {/* Today Vertical Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-500/70 z-10"
                        style={{ right: `${todayOffsetPct}%` }}
                        title="خط زمان امروز"
                      />
                      {/* Planned Baseline Bar */}
                      <div
                        className={`absolute top-1.5 bottom-1.5 rounded-md ${
                          t.isCritical
                            ? 'bg-rose-500/20 border border-rose-500/50'
                            : 'bg-slate-300/70 dark:bg-slate-700 border border-slate-400/40'
                        }`}
                        style={{ right: `${leftPct}%`, width: `${widthPct}%` }}
                      >
                        {/* Actual Progress Fill inside Planned Bar */}
                        <div
                          className={`h-full rounded-md transition-all ${
                            actPct >= 100
                              ? 'bg-emerald-600'
                              : t.isCritical || t.delayDays > 0
                              ? 'bg-rose-600'
                              : 'bg-teal-600'
                          }`}
                          style={{ width: `${actPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="col-span-2 text-left font-mono text-[11px] flex items-center justify-end gap-1.5">
                      <span className="font-black text-slate-800 dark:text-slate-200">{actPct}%</span>
                      <span className="text-slate-400">({t.plannedEnd})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Interactive Visual Gantt & Schedule Variance Table */}
        {(wbsViewMode === 'SPLIT' || wbsViewMode === 'TABLE') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {filteredTasks.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  هیچ فعالیتی در ساختار شکست کار (WBS) با این فیلتر یافت نشد
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  می‌توانید شکاف‌ها را از تب Gap Analysis مستقیماً به فعالیت WBS تبدیل کنید یا فعالیت جدید تعریف نمایید.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">کد WBS و وزن</th>
                      <th className="py-3 px-4 font-bold">فعالیت / عنصر و پیش‌نیاز</th>
                      <th className="py-3 px-4 font-bold">مسئول / مجری</th>
                      <th className="py-3 px-4 font-bold">زمان‌بندی و بودجه</th>
                      <th className="py-3 px-4 font-bold min-w-[210px]">مقایسه پیشرفت (برنامه‌ای در برابر واقعی)</th>
                      <th className="py-3 px-4 font-bold">تأخیر / انحراف</th>
                      <th className="py-3 px-4 font-bold">ثبت پیشرفت واقعی و عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {filteredTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          <div>{t.wbsCode}</div>
                          <span className="text-[10px] text-slate-400 font-sans">وزن: {t.weight || 1}</span>
                          {t.isCritical && (
                            <span className="block text-[10px] text-red-600 dark:text-red-400 font-sans font-black">
                              مسیر بحرانی
                            </span>
                          )}
                          {t.isMilestone && (
                            <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-sans font-black">
                              ◆ نقطه عطف
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{t.title}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            {t.elementCode || 'عمومی'} · {t.unitName || 'کل مجتمع'}
                            {Array.isArray(t.dependencies) && t.dependencies.length > 0
                              ? ` · پیش‌نیاز: ${t.dependencies.join(', ')}`
                              : ''}
                          </div>
                          {t.resources && (
                            <div className="text-[10.5px] text-teal-600 dark:text-teal-400 mt-0.5">
                              منابع/تحویل‌دادنی: {t.resources}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{t.ownerName}</div>
                          <div className="text-slate-500 text-[11px]">مجری: {t.executorName}</div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[11px] space-y-0.5">
                          <div>برنامه: {t.plannedStart} → {t.plannedEnd}</div>
                          <div className="text-slate-500">
                            واقعی: {t.actualStart || '—'} → {t.actualEnd || 'در جریان'}
                          </div>
                          <div className="text-[10.5px] text-slate-500 pt-0.5 flex items-center gap-1.5">
                            <span>
                              هزینه: {Number(t.actualCost || 0).toLocaleString('fa-IR')} /{' '}
                              {Number(t.allocatedBudget || 0).toLocaleString('fa-IR')}
                            </span>
                            {permissions.canWrite && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingWbsCostId(editingWbsCostId === t.id ? null : t.id);
                                  setEditingWbsCostValue(Number(t.actualCost || 0));
                                }}
                                className="text-amber-600 dark:text-amber-400 hover:underline font-sans font-bold cursor-pointer"
                              >
                                [ثبت هزینه]
                              </button>
                            )}
                          </div>
                          {editingWbsCostId === t.id && (
                            <div className="flex items-center gap-1 pt-1">
                              <input
                                type="number"
                                min={0}
                                value={editingWbsCostValue}
                                onChange={(e) => setEditingWbsCostValue(Number(e.target.value))}
                                className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveWbsCost(t)}
                                className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-sans font-bold cursor-pointer"
                              >
                                ذخیره
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1.5">
                            <div>
                              <div className="flex justify-between text-[10.5px] text-slate-500 mb-0.5">
                                <span>برنامه‌ای (Plan)</span>
                                <span className="font-mono tabular-nums">{t.plannedProgress}٪</span>
                              </div>
                              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-slate-500 dark:bg-slate-400 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(0, t.plannedProgress || 0))}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[10.5px] font-bold text-slate-700 dark:text-slate-200 mb-0.5">
                                <span>واقعی (Actual)</span>
                                <span className="font-mono tabular-nums">{t.actualProgress}٪</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    t.actualProgress >= 100
                                      ? 'bg-emerald-600'
                                      : t.delayDays > 0
                                      ? 'bg-red-600'
                                      : 'bg-teal-600'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, t.actualProgress || 0))}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <div
                            className={`font-bold ${
                              t.scheduleVariancePct < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            انحراف: {t.scheduleVariancePct > 0 ? `+${t.scheduleVariancePct}` : t.scheduleVariancePct}٪
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.delayDays > 0 ? `${t.delayDays} روز تأخیر` : 'بدون تأخیر'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1">
                            {[0, 25, 50, 75, 100].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                disabled={!permissions.canWrite}
                                onClick={() => handleUpdateWbsProgress(t, pct)}
                                className={`px-2 py-1 rounded text-[10.5px] font-mono tabular-nums font-bold cursor-pointer ${
                                  Math.round(t.actualProgress) === pct
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                            {permissions.canWrite && (
                              <button
                                type="button"
                                onClick={() => handleDeleteWbs(t.id, t.wbsCode)}
                                className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-[10px] font-bold transition cursor-pointer"
                                title="حذف فعالیت از WBS"
                              >
                                حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (activeSubTab === 'documents') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const soonStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const allDocs = projectData.documents || [];
    const approvedDocsCount = allDocs.filter((d) => d.status === 'APPROVED').length;
    const underReviewDocsCount = allDocs.filter((d) => d.status === 'UNDER_REVIEW' || d.status === 'DRAFT').length;
    const expiredOrSoonDocsCount = allDocs.filter(
      (d) =>
        d.status === 'EXPIRED' ||
        (d.validityExpiryDate && d.validityExpiryDate <= soonStr)
    ).length;

    const filteredDocs = allDocs.filter((d) => {
      if (docFilterStatus === 'APPROVED' && d.status !== 'APPROVED') return false;
      if (docFilterStatus === 'UNDER_REVIEW' && d.status !== 'UNDER_REVIEW') return false;
      if (docFilterStatus === 'DRAFT' && d.status !== 'DRAFT') return false;
      if (
        docFilterStatus === 'EXPIRED' &&
        d.status !== 'EXPIRED' &&
        !(d.validityExpiryDate && d.validityExpiryDate < todayStr)
      ) {
        return false;
      }
      if (docFilterType !== 'ALL' && d.docType !== docFilterType) return false;
      if (docFilterUnit !== 'ALL' && d.unitName !== docFilterUnit) return false;
      if (docSearchQuery.trim()) {
        const q = docSearchQuery.trim().toLowerCase();
        const match =
          String(d.docCode || '').toLowerCase().includes(q) ||
          String(d.title || '').toLowerCase().includes(q) ||
          String(d.ccpsElementCode || '').toLowerCase().includes(q) ||
          String(d.equipmentTag || '').toLowerCase().includes(q) ||
          String(d.authorName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    return (
      <div className="space-y-5">
        {/* Document Bank KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              کل مدارک و شواهد ثبت‌شده در بانک PSM
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {allDocs.length}
              </span>
              <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                پوشش {new Set(allDocs.map((d) => d.ccpsElementCode).filter(Boolean)).size} عنصر CCPS
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              مدارک مصوب دارای شواهد اجرایی معتبر (APPROVED)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {approvedDocsCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {allDocs.length > 0 ? Math.round((approvedDocsCount / allDocs.length) * 100) : 0}٪ کل بانک مدارک
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              در انتظار بررسی / بازگشایی پس از ویرایش
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {underReviewDocsCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                نیازمند کنترل شواهد و تصویب
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              منقضی یا در آستانه بازنگری دوره‌ای (۳۰ روز آینده)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span
                className={`text-2xl font-black font-mono tabular-nums ${
                  expiredOrSoonDocsCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {expiredOrSoonDocsCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">چرخه بازنگری ادواری</span>
            </div>
          </div>
        </div>

        {/* Header & Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                بانک مدارک ایمنی فرایند (PSM Document Bank) با کنترل شواهد و نسخه‌بندی
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                هر مدرک به عنصر CCPS، الزام OSHA، واحد، تجهیز و مطالعه ریسک متصل می‌شود. سیستم از تأیید مدرک فاقد شواهد کافی جلوگیری کرده و در صورت ویرایش مدرک مصوب، وضعیت آن را به «در حال بررسی مجدد» بازمی‌گرداند.
              </p>
            </div>
            <button
              type="button"
              disabled={!permissions.canWrite}
              onClick={() => setShowNewDocForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت و بارگذاری مدرک استاندارد</span>
            </button>
          </div>

          {/* Filter Strip */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: `همه (${allDocs.length})` },
                  { id: 'APPROVED', label: `مصوب (${approvedDocsCount})` },
                  {
                    id: 'UNDER_REVIEW',
                    label: `در حال بررسی مجدد (${allDocs.filter((d) => d.status === 'UNDER_REVIEW').length})`,
                  },
                  { id: 'DRAFT', label: `پیش‌نویس (${allDocs.filter((d) => d.status === 'DRAFT').length})` },
                  { id: 'EXPIRED', label: `منقضی (${expiredOrSoonDocsCount})` },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setDocFilterStatus(st.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    docFilterStatus === st.id
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={docFilterType}
                onChange={(e) => setDocFilterType(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">همه انواع مدرک</option>
                <option value="POLICY">خط‌مشی و نظام‌نامه (Policy)</option>
                <option value="PROCEDURE">روش اجرایی (Procedure)</option>
                <option value="WORK_INSTRUCTION">دستورالعمل عملیاتی (SOP/WI)</option>
                <option value="STANDARD_FORM">فرم و چک‌لیست استاندارد</option>
                <option value="P_AND_ID">نقشه مهندسی (P&ID / PFD)</option>
                <option value="STUDY_REPORT">گزارش مطالعه ریسک (PHA/HAZOP/LOPA)</option>
                <option value="CERTIFICATE">گواهینامه تست و بازرسی (MI/PSV)</option>
              </select>

              <select
                value={docFilterUnit}
                onChange={(e) => setDocFilterUnit(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">همه واحدها</option>
                <option value="کل مجتمع">کل مجتمع</option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <input
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="جستجوی کد، عنوان، عنصر، تجهیز..."
                className="w-52 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {showNewDocForm && (
          <form
            onSubmit={handleCreateDocument}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">ثبت و بارگذاری مدرک جدید در بانک مدارک PSM</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">کد مدرک *</label>
                <input
                  required
                  value={newDoc.docCode}
                  onChange={(e) => setNewDoc({ ...newDoc, docCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان مدرک *</label>
                <input
                  required
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  placeholder="مثلاً: روش اجرایی مدیریت تغییر (MOC) مجتمع پتروشیمی رجال"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">نوع مدرک *</label>
                <select
                  value={newDoc.docType}
                  onChange={(e) => setNewDoc({ ...newDoc, docType: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="POLICY">خط‌مشی و نظام‌نامه (Policy)</option>
                  <option value="PROCEDURE">روش اجرایی (Procedure)</option>
                  <option value="WORK_INSTRUCTION">دستورالعمل عملیاتی (SOP/WI)</option>
                  <option value="STANDARD_FORM">فرم و چک‌لیست استاندارد</option>
                  <option value="P_AND_ID">نقشه مهندسی (P&ID / PFD)</option>
                  <option value="STUDY_REPORT">گزارش مطالعه ریسک (PHA/HAZOP/LOPA)</option>
                  <option value="CERTIFICATE">گواهینامه تست و بازرسی (MI/PSV)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنصر CCPS *</label>
                <select
                  value={newDoc.ccpsElementCode}
                  onChange={(e) => setNewDoc({ ...newDoc, ccpsElementCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {CCPS_20_ELEMENTS.map((el) => (
                    <option key={el.code} value={el.code}>
                      {el.code} - {el.titleFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">الزام OSHA مرتبط</label>
                <select
                  value={newDoc.oshaClauseCode}
                  onChange={(e) => setNewDoc({ ...newDoc, oshaClauseCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="">— انتخاب الزام OSHA —</option>
                  {OSHA_14_CLAUSES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.titleFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">واحد مربوطه</label>
                <input
                  list="psm-units-list"
                  value={newDoc.unitName}
                  onChange={(e) => setNewDoc({ ...newDoc, unitName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">تگ تجهیز مرتبط</label>
                <input
                  value={newDoc.equipmentTag}
                  onChange={(e) => setNewDoc({ ...newDoc, equipmentTag: e.target.value })}
                  placeholder="مثلاً R-201 یا C-101"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مسئول تهیه *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newDoc.authorName}
                  onChange={(e) => setNewDoc({ ...newDoc, authorName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مسئول بررسی *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newDoc.reviewerName}
                  onChange={(e) => setNewDoc({ ...newDoc, reviewerName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مسئول تأیید *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newDoc.approverName}
                  onChange={(e) => setNewDoc({ ...newDoc, approverName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">نسخه / تاریخ اعتبار</label>
                <div className="flex gap-2">
                  <input
                    value={newDoc.version}
                    onChange={(e) => setNewDoc({ ...newDoc, version: e.target.value })}
                    className="w-20 px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    placeholder="1.0"
                  />
                  <input
                    type="date"
                    value={newDoc.validityExpiryDate}
                    onChange={(e) => setNewDoc({ ...newDoc, validityExpiryDate: e.target.value })}
                    className="flex-1 px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  خلاصه شواهد اجرایی پیوست‌شده (الزامی برای تأیید مدرک) *
                </label>
                <textarea
                  rows={2}
                  value={newDoc.evidenceSummary}
                  onChange={(e) => setNewDoc({ ...newDoc, evidenceSummary: e.target.value })}
                  placeholder="شواهد عینی، شماره صورتجلسه کمیته فنی یا شماره گزارش صحه‌گذاری میدانی را وارد کنید..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  بارگذاری فایل مدرک (PDF / Word / Excel / تصویر)
                </label>
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingDocFile ? 'در حال بارگذاری...' : 'انتخاب فایل مستند'}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadDocumentFile(f);
                      }}
                    />
                  </label>
                  {newDoc.fileName && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold truncate">
                      پیوست شد: {newDoc.fileName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewDocForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                ثبت مدرک در بانک PSM
              </button>
            </div>
          </form>
        )}

        {/* Document Revision / Alteration Modal (Triggers Governance Auto-Reopen if APPROVED) */}
        {editingDocRevision && (
          <form
            onSubmit={handleSaveDocRevision}
            className="bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  ویرایش و ثبت نسخه جدید مدرک: {editingDocRevision.docCode} (نسخه فعلی: v{editingDocRevision.version})
                </h4>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  توجه حاکمیتی (قانون ۳ / سناریو ۸): در صورت ویرایش مدرک مصوب، وضعیت آن به‌صورت خودکار به «نیازمند بررسی مجدد (UNDER_REVIEW)» تغییر یافته و در لاگ ممیزی ثبت می‌شود.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDocRevision(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                بستن
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">عنوان مدرک *</label>
                <input
                  required
                  value={docRevisionForm.title}
                  onChange={(e) => setDocRevisionForm({ ...docRevisionForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">شماره نسخه جدید *</label>
                <input
                  required
                  value={docRevisionForm.version}
                  onChange={(e) => setDocRevisionForm({ ...docRevisionForm, version: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">تاریخ اعتبار جدید</label>
                <input
                  type="date"
                  value={docRevisionForm.validityExpiryDate}
                  onChange={(e) => setDocRevisionForm({ ...docRevisionForm, validityExpiryDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  بروزرسانی خلاصه شواهد اجرایی (حداقل ۱۰ کاراکتر برای امکان تصویب مجدد) *
                </label>
                <textarea
                  rows={2}
                  value={docRevisionForm.evidenceSummary}
                  onChange={(e) => setDocRevisionForm({ ...docRevisionForm, evidenceSummary: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  علت بازنگری / شرح تغییرات نسخه (ثبت در Change History) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="مثلاً: بازنگری دستورالعمل پس از تغییر سنسورهای فشار راکتور R-201..."
                  value={docRevisionForm.changeNote}
                  onChange={(e) => setDocRevisionForm({ ...docRevisionForm, changeNote: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDocRevision(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                ثبت ویرایش جدید و بازگشایی چرخه بررسی
              </button>
            </div>
          </form>
        )}

        {/* Documents Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {filteredDocs.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                هیچ مدرکی با فیلترهای انتخابی در بانک مدارک یافت نشد
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                مدارک استاندارد هر یک از ۲۰ عنصر CCPS و ۱۴ الزام OSHA را به همراه شواهد اجرایی ثبت و بارگذاری نمایید.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">کد و نسخه</th>
                    <th className="py-3 px-4 font-bold">عنوان مدرک / نوع</th>
                    <th className="py-3 px-4 font-bold">عنصر CCPS / OSHA</th>
                    <th className="py-3 px-4 font-bold">واحد / تجهیز</th>
                    <th className="py-3 px-4 font-bold">تهیه / بررسی / تأیید</th>
                    <th className="py-3 px-4 font-bold">شواهد اجرایی</th>
                    <th className="py-3 px-4 font-bold">وضعیت و عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {filteredDocs.map((d) => {
                    const isExpired = Boolean(d.validityExpiryDate && d.validityExpiryDate < todayStr);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{d.docCode}</div>
                          <div className="text-[11px] text-slate-500">
                            v{d.version} (Rev {d.revisionNumber})
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{d.title}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{d.docType}</span>
                            <span>·</span>
                            <span className={isExpired ? 'text-rose-600 font-bold' : ''}>
                              اعتبار: {d.validityExpiryDate || '—'}
                              {isExpired ? ' (منقضی)' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{d.ccpsElementCode}</div>
                          <div className="text-slate-500 text-[11px]">{d.oshaClauseCode || '—'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{d.unitName || 'کل مجتمع'}</div>
                          {d.equipmentTag && <div className="font-mono text-[11px] text-slate-500">{d.equipmentTag}</div>}
                        </td>
                        <td className="py-3 px-4 text-[11px]">
                          <div>تهیه: {d.authorName}</div>
                          <div>بررسی: {d.reviewerName}</div>
                          <div>تأیید: {d.approverName}</div>
                        </td>
                        <td className="py-3 px-4 max-w-[220px]">
                          <div className="text-slate-700 dark:text-slate-300 line-clamp-2">
                            {d.evidenceSummary || 'فاقد شرح شواهد'}
                          </div>
                          {d.fileName && (
                            <a
                              href={d.fileUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-bold block mt-0.5 truncate"
                            >
                              فایل: {d.fileName}
                            </a>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`font-bold ${
                                d.status === 'APPROVED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : d.status === 'EXPIRED'
                                  ? 'text-red-600 dark:text-red-400'
                                  : d.status === 'UNDER_REVIEW'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {d.status === 'APPROVED'
                                ? 'مصوب و معتبر'
                                : d.status === 'UNDER_REVIEW'
                                ? 'در حال بررسی مجدد'
                                : d.status === 'DRAFT'
                                ? 'پیش‌نویس'
                                : d.status}
                            </span>
                            <div className="flex flex-wrap items-center gap-1">
                              {d.status !== 'APPROVED' && permissions.canApprove && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveDocument(d)}
                                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold cursor-pointer"
                                >
                                  تأیید نهایی
                                </button>
                              )}
                              {permissions.canWrite && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDocRevision(d)}
                                  className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-600 hover:text-white text-amber-700 dark:text-amber-300 text-[10.5px] font-bold transition cursor-pointer"
                                >
                                  ویرایش / نسخه جدید
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedDocHistory(d)}
                                className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10.5px] font-bold cursor-pointer"
                              >
                                سوابق تغییر
                              </button>
                              {permissions.canApprove && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDocument(d.id, d.docCode)}
                                  className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 text-[10.5px] font-bold transition cursor-pointer"
                                >
                                  حذف
                                </button>
                              )}
                            </div>
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

        {selectedDocHistory && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                سوابق تغییرات و نسخه‌بندی مدرک: {selectedDocHistory.title} ({selectedDocHistory.docCode})
              </h4>
              <button
                type="button"
                onClick={() => setSelectedDocHistory(null)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                بستن
              </button>
            </div>
            <div className="space-y-2">
              {(Array.isArray(selectedDocHistory.changeHistory) ? selectedDocHistory.changeHistory : []).map(
                (h: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono font-bold">نسخه {h.version}</span>
                      {h.action === 'DOCUMENT_REOPENED_AFTER_ALTERATION' && (
                        <span className="mx-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                          بازگشایی خودکار پس از ویرایش
                        </span>
                      )}
                      · <span>{h.note}</span>
                    </div>
                    <div className="text-slate-500 font-mono text-[11px]">
                      توسط {h.actor} در {new Date(h.timestamp).toLocaleString('fa-IR')}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSubTab === 'capa') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const allCapa = projectData.capaItems || [];
    const openCriticalHighCount = allCapa.filter(
      (c) => c.stage !== 'CLOSED' && (c.riskLevel === 'CRITICAL' || c.riskLevel === 'HIGH')
    ).length;
    const inVerificationCount = allCapa.filter(
      (c) => c.stage === 'UNDER_REVIEW' || c.stage === 'EFFECTIVENESS_VERIFIED'
    ).length;
    const closedCapaCount = allCapa.filter((c) => c.stage === 'CLOSED').length;
    const overdueCapaCount = allCapa.filter(
      (c) => c.stage !== 'CLOSED' && c.dueDate && c.dueDate < todayStr
    ).length;

    const filteredCapa = allCapa.filter((c) => {
      if (capaFilterStage !== 'ALL' && c.stage !== capaFilterStage) return false;
      if (capaFilterRisk !== 'ALL' && c.riskLevel !== capaFilterRisk) return false;
      if (capaFilterUnit !== 'ALL' && c.unitName !== capaFilterUnit) return false;
      if (capaSearchQuery.trim()) {
        const q = capaSearchQuery.trim().toLowerCase();
        const match =
          String(c.capaCode || '').toLowerCase().includes(q) ||
          String(c.title || '').toLowerCase().includes(q) ||
          String(c.deficiencyDescription || '').toLowerCase().includes(q) ||
          String(c.responsiblePersonName || '').toLowerCase().includes(q) ||
          String(c.ccpsElementCode || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    return (
      <div className="space-y-5">
        {/* CAPA 4 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              کل پرونده‌های CAPA در گردش کار ۸ مرحله‌ای
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {allCapa.length}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {allCapa.length - closedCapaCount} پرونده باز
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              نواقص بحرانی و ریسک بالا باز (CRITICAL / HIGH)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span
                className={`text-2xl font-black font-mono tabular-nums ${
                  openCriticalHighCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {openCriticalHighCount}
              </span>
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                {overdueCapaCount > 0 ? `${overdueCapaCount} مورد دارای تأخیر از مهلت` : 'بدون تأخیر از مهلت'}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              در مرحله بررسی فنی و صحه‌گذاری اثربخشی (مرحله ۶ و ۷)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {inVerificationCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">نیازمند ممیز مستقل</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              پرونده‌های مختومه و اثربخش (CLOSED)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {closedCapaCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                نرخ بستن اثربخش: {allCapa.length > 0 ? Math.round((closedCapaCount / allCapa.length) * 100) : 0}٪
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                مدیریت نواقص و اقدامات اصلاحی و پیشگیرانه (CAPA) — گردش کار ۸ مرحله‌ای مستقل
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                بستن نقص بدون ثبت شواهد مستند و تأیید اثربخشی توسط بازبین مستقل (متمایز از مجری اقدام) توسط سرور مسدود می‌شود. برای فیلتر بر اساس هر مرحله، روی کارت آن مرحله کلیک کنید.
              </p>
            </div>
            <button
              type="button"
              disabled={!permissions.canWrite}
              onClick={() => setShowNewCapaForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت نقص جدید در گردش کار CAPA</span>
            </button>
          </div>

          {/* Interactive 8-Stage Pipeline Filter Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
            {PSM_CAPA_STAGES.map((st) => {
              const count = allCapa.filter((c) => c.stage === st.key).length;
              const isSelected = capaFilterStage === st.key;
              return (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setCapaFilterStage(isSelected ? 'ALL' : st.key)}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 hover:border-teal-500/50'
                  }`}
                >
                  <div
                    className={`text-[11px] font-bold ${
                      isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {st.titleFa}
                  </div>
                  <div
                    className={`text-base font-black font-mono tabular-nums mt-1 ${
                      isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400'
                    }`}
                  >
                    {count}
                  </div>
                </button>
              );
            })}
          </div>

          {/* CAPA Filter Bar */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'همه سطوح ریسک' },
                  { id: 'CRITICAL', label: 'بحرانی (CRITICAL)' },
                  { id: 'HIGH', label: 'ریسک بالا (HIGH)' },
                  { id: 'MEDIUM', label: 'متوسط (MEDIUM)' },
                  { id: 'LOW', label: 'پایین (LOW)' },
                ] as const
              ).map((rk) => (
                <button
                  key={rk.id}
                  type="button"
                  onClick={() => setCapaFilterRisk(rk.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    capaFilterRisk === rk.id
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {rk.label}
                </button>
              ))}
              {capaFilterStage !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setCapaFilterStage('ALL')}
                  className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 text-xs font-bold cursor-pointer"
                >
                  نمایش همه مراحل ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={capaFilterUnit}
                onChange={(e) => setCapaFilterUnit(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">همه واحدها</option>
                <option value="کل مجتمع">کل مجتمع</option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <input
                value={capaSearchQuery}
                onChange={(e) => setCapaSearchQuery(e.target.value)}
                placeholder="جستجوی کد CAPA، عنوان، مسئول..."
                className="w-52 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {showNewCapaForm && (
          <form
            onSubmit={handleCreateCapa}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">ثبت نقص جدید در سیستم CAPA</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان نقص *</label>
                <input
                  required
                  value={newCapa.title}
                  onChange={(e) => setNewCapa({ ...newCapa, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">منبع شناسایی نقص</label>
                <select
                  value={newCapa.sourceType}
                  onChange={(e) => setNewCapa({ ...newCapa, sourceType: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="GAP_ANALYSIS">تحلیل شکاف (Gap Analysis)</option>
                  <option value="PHA_HAZOP">مطالعات ریسک (PHA / HAZOP / LOPA)</option>
                  <option value="MI_INSPECTION">بازرسی یکپارچگی مکانیکی (MI)</option>
                  <option value="PSSR">بازنگری پیش از راه‌اندازی (PSSR)</option>
                  <option value="MOC">مدیریت تغییر (MOC)</option>
                  <option value="PSM_AUDIT">ممیزی انطباق PSM</option>
                  <option value="INCIDENT">تحقیق حوادث فرایندی</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">واحد فرایندی *</label>
                <input
                  required
                  list="psm-units-list"
                  value={newCapa.unitName}
                  onChange={(e) => setNewCapa({ ...newCapa, unitName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنصر CCPS مرتبط</label>
                <select
                  value={newCapa.ccpsElementCode}
                  onChange={(e) => setNewCapa({ ...newCapa, ccpsElementCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {CCPS_20_ELEMENTS.map((el) => (
                    <option key={el.code} value={el.code}>
                      {el.code} - {el.titleFa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">سطح ریسک اولیه</label>
                <select
                  value={newCapa.riskLevel}
                  onChange={(e) => setNewCapa({ ...newCapa, riskLevel: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="CRITICAL">بحرانی (CRITICAL)</option>
                  <option value="HIGH">بالا (HIGH)</option>
                  <option value="MEDIUM">متوسط (MEDIUM)</option>
                  <option value="LOW">پایین (LOW)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مسئول مستقیم *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newCapa.responsiblePersonName}
                  onChange={(e) => setNewCapa({ ...newCapa, responsiblePersonName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مهلت اولیه انجام *</label>
                <input
                  required
                  type="date"
                  value={newCapa.dueDate}
                  onChange={(e) => setNewCapa({ ...newCapa, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">شرح کامل نقص *</label>
                <textarea
                  required
                  rows={2}
                  value={newCapa.deficiencyDescription}
                  onChange={(e) => setNewCapa({ ...newCapa, deficiencyDescription: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewCapaForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                ثبت پرونده CAPA
              </button>
            </div>
          </form>
        )}

        {/* CAPA Deadline Extension Modal */}
        {extendingCapa && (
          <form
            onSubmit={handleExtendCapaDeadline}
            className="bg-white dark:bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  تمدید رسمی مهلت اقدام اصلاحی: {extendingCapa.capaCode} — {extendingCapa.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  مهلت فعلی: <span className="font-mono font-bold">{extendingCapa.dueDate || '—'}</span> · طبق قانون حاکمیت PSM، تمدید مهلت نیازمند ثبت توجیه فنی مستند در تاریخچه پرونده است.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExtendingCapa(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                بستن
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  مهلت جدید پیشنهادی *
                </label>
                <input
                  required
                  type="date"
                  value={capaExtensionNewDate}
                  onChange={(e) => setCapaExtensionNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  توجیه فنی و مهندسی تمدید مهلت (حداقل ۱۰ کاراکتر) *
                </label>
                <input
                  required
                  value={capaExtensionJustification}
                  onChange={(e) => setCapaExtensionJustification(e.target.value)}
                  placeholder="مثلاً: نیاز به توقف برنامه‌ریزی‌شده واحد (Turnaround) جهت نصب شیر اطمینان..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtendingCapa(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={submittingCapaExtension}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                {submittingCapaExtension ? 'در حال ثبت...' : 'ثبت تمدید مهلت در لاگ ممیزی'}
              </button>
            </div>
          </form>
        )}

        {/* CAPA Items List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          {filteredCapa.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                هیچ پرونده CAPA با فیلترهای انتخابی یافت نشد
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                نواقص استخراج‌شده از Gap Analysis، مطالعات HAZOP یا بازرسی‌های MI را در این بخش پیگیری کنید.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">کد CAPA</th>
                    <th className="py-3 px-4 font-bold">عنوان و شرح نقص</th>
                    <th className="py-3 px-4 font-bold">واحد / عنصر</th>
                    <th className="py-3 px-4 font-bold">سطح ریسک</th>
                    <th className="py-3 px-4 font-bold">مسئول اقدام و مهلت</th>
                    <th className="py-3 px-4 font-bold">مرحله فعلی گردش کار (از ۸ مرحله)</th>
                    <th className="py-3 px-4 font-bold">تأییدکننده مستقل اثربخشی</th>
                    <th className="py-3 px-4 font-bold">مدیریت گردش کار و سوابق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {filteredCapa.map((c) => {
                    const stageMeta = PSM_CAPA_STAGES.find((s) => s.key === c.stage);
                    const isOverdue = Boolean(c.stage !== 'CLOSED' && c.dueDate && c.dueDate < todayStr);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {c.capaCode}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{c.title}</div>
                          <div className="text-slate-500 line-clamp-2 mt-0.5">{c.deficiencyDescription}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{c.unitName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{c.ccpsElementCode || c.sourceType}</div>
                        </td>
                        <td className="py-3 px-4 font-bold">
                          <span
                            className={
                              c.riskLevel === 'CRITICAL'
                                ? 'text-red-600 dark:text-red-400'
                                : c.riskLevel === 'HIGH'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-sky-600 dark:text-sky-400'
                            }
                          >
                            {c.riskLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{c.responsiblePersonName || 'تخصیص نیافته'}</div>
                          <div
                            className={`font-mono tabular-nums text-[11px] ${
                              isOverdue ? 'text-rose-600 font-bold' : 'text-slate-500'
                            }`}
                          >
                            {c.dueDate || '—'}
                            {isOverdue ? ' (دارای تأخیر)' : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-teal-700 dark:text-teal-300">
                            {stageMeta ? stageMeta.titleFa : c.stage}
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            مرحله {stageMeta?.order || 1} از ۸
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {c.effectivenessVerifierName ? (
                            <div>
                              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                {c.effectivenessVerifierName}
                              </div>
                              <div className="text-[10.5px] text-slate-500">
                                {c.effectivenessVerificationDate || ''}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">در انتظار تأیید مستقل</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openCapaTransitionModal(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                            >
                              بررسی / ارتقای مرحله
                            </button>
                            {c.stage !== 'CLOSED' && permissions.canWrite && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExtendingCapa(c);
                                  setCapaExtensionNewDate(
                                    c.dueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
                                  );
                                  setCapaExtensionJustification('');
                                }}
                                className="px-2 py-1.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                              >
                                تمدید مهلت
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedCapaHistory(c)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                            >
                              سوابق ۸ مرحله‌ای
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

        {/* CAPA Workflow Audit Log Viewer */}
        {selectedCapaHistory && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  تاریخچه و زنجیره ممیزی گردش کار ۸ مرحله‌ای: {selectedCapaHistory.capaCode} — {selectedCapaHistory.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  مسئول اقدام: {selectedCapaHistory.responsiblePersonName || '—'} · تأییدکننده مستقل اثربخشی:{' '}
                  {selectedCapaHistory.effectivenessVerifierName || 'تعیین نشده'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCapaHistory(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                بستن
              </button>
            </div>
            <div className="space-y-2">
              {(Array.isArray(selectedCapaHistory.workflowLogs) ? selectedCapaHistory.workflowLogs : []).map(
                (log: any, idx: number) => {
                  const stTitle = PSM_CAPA_STAGES.find((s) => s.key === log.stage)?.titleFa || log.stage;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-teal-700 dark:text-teal-300">{stTitle}</span>
                        {log.action === 'EXTEND_DUE_DATE' && (
                          <span className="mx-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                            تمدید مهلت رسمی
                          </span>
                        )}
                        {' · '}
                        <span className="text-slate-700 dark:text-slate-200">{log.note}</span>
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">
                        توسط {log.actor} ({log.role || 'User'}) در{' '}
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('fa-IR') : '—'}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {/* CAPA 8-Stage Transition Modal */}
        {activeCapaModal && (
          <form
            onSubmit={handleTransitionCapa}
            className="bg-white dark:bg-slate-900 border-2 border-teal-500/40 rounded-2xl p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                  مدیریت گردش کار ۸ مرحله‌ای CAPA: {activeCapaModal.title} ({activeCapaModal.capaCode})
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  مرحله فعلی: {PSM_CAPA_STAGES.find((s) => s.key === activeCapaModal.stage)?.titleFa}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCapaModal(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                بستن
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  انتقال به مرحله هدف *
                </label>
                <select
                  value={capaTransitionForm.targetStage}
                  onChange={(e) => setCapaTransitionForm({ ...capaTransitionForm, targetStage: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                >
                  {PSM_CAPA_STAGES.map((st) => (
                    <option key={st.key} value={st.key}>
                      {st.titleFa} ({st.titleEn})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  مسئول اجرای اقدام اصلاحی (مرحله ۳)
                </label>
                <input
                  list="psm-personnel-list"
                  value={capaTransitionForm.responsiblePersonName}
                  onChange={(e) =>
                    setCapaTransitionForm({ ...capaTransitionForm, responsiblePersonName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">مهلت اقدام</label>
                <input
                  type="date"
                  value={capaTransitionForm.dueDate}
                  onChange={(e) => setCapaTransitionForm({ ...capaTransitionForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  تحلیل علت ریشه‌ای - Root Cause (الزامی برای مرحله ۲)
                </label>
                <textarea
                  rows={2}
                  value={capaTransitionForm.rootCause}
                  onChange={(e) => setCapaTransitionForm({ ...capaTransitionForm, rootCause: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  شرح اقدام اصلاحی و پیشگیرانه (الزامی برای مرحله ۳ و ۴)
                </label>
                <textarea
                  rows={2}
                  value={capaTransitionForm.correctiveAction}
                  onChange={(e) => setCapaTransitionForm({ ...capaTransitionForm, correctiveAction: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  شرح مستند شواهد اجرایی (الزامی برای مرحله ۵)
                </label>
                <textarea
                  rows={2}
                  value={capaTransitionForm.evidenceDescription}
                  onChange={(e) =>
                    setCapaTransitionForm({ ...capaTransitionForm, evidenceDescription: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  نام بازبین فنی و نظر بررسی (الزامی برای مرحله ۶)
                </label>
                <input
                  list="psm-personnel-list"
                  placeholder="نام بازبین فنی"
                  value={capaTransitionForm.reviewerName}
                  onChange={(e) => setCapaTransitionForm({ ...capaTransitionForm, reviewerName: e.target.value })}
                  className="w-full px-3 py-1.5 mb-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <input
                  placeholder="نظر فنی بررسی شواهد"
                  value={capaTransitionForm.reviewNotes}
                  onChange={(e) => setCapaTransitionForm({ ...capaTransitionForm, reviewNotes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  نام تأییدکننده مستقل اثربخشی (متمایز از مسئول اقدام - مرحله ۷ و ۸)
                </label>
                <input
                  list="psm-personnel-list"
                  placeholder="نام ممیز / تأییدکننده مستقل"
                  value={capaTransitionForm.effectivenessVerifierName}
                  onChange={(e) =>
                    setCapaTransitionForm({ ...capaTransitionForm, effectivenessVerifierName: e.target.value })
                  }
                  className="w-full px-3 py-1.5 mb-1.5 text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 bg-slate-50 dark:bg-slate-800"
                />
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capaTransitionForm.effectivenessCriteriaMet}
                    onChange={(e) =>
                      setCapaTransitionForm({ ...capaTransitionForm, effectivenessCriteriaMet: e.target.checked })
                    }
                  />
                  <span>اثربخشی اقدام در عمل به طور کامل احراز شد</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  گزارش مستند صحه‌گذاری اثربخشی (الزامی برای بستن نقص)
                </label>
                <textarea
                  rows={2}
                  value={capaTransitionForm.effectivenessReport}
                  onChange={(e) =>
                    setCapaTransitionForm({ ...capaTransitionForm, effectivenessReport: e.target.value })
                  }
                  placeholder="نتایج ممیزی میدانی اثربخشی و عدم تکرار نقص..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Residual non-critical follow-up fields for Project Handover */}
            {activeCapaModal.riskLevel !== 'CRITICAL' && activeCapaModal.stage !== 'CLOSED' && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    برنامه پیگیری نقص غیربحرانی باقیمانده (جهت تحویل نهایی پروژه)
                  </label>
                  <input
                    value={capaTransitionForm.followupPlan}
                    onChange={(e) => setCapaTransitionForm({ ...capaTransitionForm, followupPlan: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex items-center pt-4">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capaTransitionForm.managementApprovalForResidual}
                      onChange={(e) =>
                        setCapaTransitionForm({
                          ...capaTransitionForm,
                          managementApprovalForResidual: e.target.checked,
                        })
                      }
                    />
                    <span>تأیید مدیریت جهت پیگیری زمان‌بندی‌شده این نقص غیربحرانی پس از تحویل</span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveCapaModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                ثبت و انتقال مرحله گردش کار CAPA
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  if (activeSubTab === 'studies') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const allStudies = projectData.studies || [];
    const coveredSubsystemCount = new Set(allStudies.map((s) => s.subsystemType).filter(Boolean)).size;
    const completedStudiesCount = allStudies.filter(
      (s) => s.status === 'COMPLETED' || s.status === 'APPROVED'
    ).length;
    const allRecommendations = allStudies.flatMap((s) =>
      Array.isArray(s.recommendations) ? s.recommendations : []
    );
    const openRecommendationsCount = allRecommendations.filter(
      (r: any) => r.status !== 'CLOSED' && r.status !== 'CONVERTED_TO_CAPA'
    ).length;
    const dueRevalidationCount = allStudies.filter(
      (s) => s.revalidationDueDate && s.revalidationDueDate <= todayStr
    ).length;

    const filteredStudies = allStudies.filter((s) => {
      if (selectedSubsystem !== 'ALL' && s.subsystemType !== selectedSubsystem) return false;
      if (studyFilterStatus !== 'ALL' && s.status !== studyFilterStatus) return false;
      if (studyFilterUnit !== 'ALL' && s.unitName !== studyFilterUnit) return false;
      if (studySearchQuery.trim()) {
        const q = studySearchQuery.trim().toLowerCase();
        const match =
          String(s.studyCode || '').toLowerCase().includes(q) ||
          String(s.title || '').toLowerCase().includes(q) ||
          String(s.subsystemType || '').toLowerCase().includes(q) ||
          String(s.nodeOrSection || '').toLowerCase().includes(q) ||
          String(s.ownerName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    return (
      <div className="space-y-5">
        {/* 4 KPI Summary Cards for 14 Specialized Subsystems */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              کل مطالعات تخصصی ثبت‌شده در ۱۴ زیرسیستم
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {allStudies.length}
              </span>
              <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">
                پوشش {coveredSubsystemCount} از ۱۴ زیرسیستم
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              مطالعات تکمیل‌شده و مصوب (COMPLETED / APPROVED)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {completedStudiesCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {allStudies.length > 0 ? Math.round((completedStudiesCount / allStudies.length) * 100) : 0}٪ کل مطالعات
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              توصیه‌های فنی مستخرج از مطالعات (HAZOP / LOPA / MI)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {allRecommendations.length}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {openRecommendationsCount} توصیه باز جهت ارجاع به CAPA
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              مطالعات نیازمند بازنگری دوره‌ای (Revalidation)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span
                className={`text-2xl font-black font-mono tabular-nums ${
                  dueRevalidationCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {dueRevalidationCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">چرخه بازنگری ۵ ساله OSHA</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                مدیریت مطالعات و ۱۴ زیرسیستم تخصصی PSM (PSI, PHA, HAZOP, HAZID, LOPA, Bow-Tie, MI, MOC, PSSR...)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                هر مطالعه و توصیه دارای مالک، وضعیت، شواهد و مسیر پیگیری مشخص بوده و با یک کلیک به پرونده اقدام اصلاحی (CAPA) تبدیل می‌شود.
              </p>
            </div>
            <button
              type="button"
              disabled={!permissions.canWrite}
              onClick={() => setShowNewStudyForm((v) => !v)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت مطالعه و توصیه تخصصی جدید</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'همه وضعیت‌ها' },
                  { id: 'IN_PROGRESS', label: 'در حال انجام (IN_PROGRESS)' },
                  { id: 'COMPLETED', label: 'تکمیل‌شده (COMPLETED)' },
                  { id: 'APPROVED', label: 'مصوب کمیته فنی (APPROVED)' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStudyFilterStatus(st.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    studyFilterStatus === st.id
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={studyFilterUnit}
                onChange={(e) => setStudyFilterUnit(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">همه واحدها</option>
                <option value="کل مجتمع">کل مجتمع</option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <input
                value={studySearchQuery}
                onChange={(e) => setStudySearchQuery(e.target.value)}
                placeholder="جستجوی کد، عنوان، گره، مالک..."
                className="w-52 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Live Cross-Module Integration Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">پروانه‌های کار (PTW)</div>
            <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {centralOrg.linkedModulesSummary.workPermitsCount || 0} رکورد زنده
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">مطالعات ارزیابی ریسک</div>
            <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {centralOrg.linkedModulesSummary.riskAssessmentsCount || 0} رکورد زنده
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">حوادث و شبه‌حوادث</div>
            <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {centralOrg.linkedModulesSummary.incidentsCount || 0} رکورد زنده
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">دوره‌های آموزشی HSE</div>
            <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {centralOrg.linkedModulesSummary.trainingsCount || 0} دوره فعال
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] text-slate-500">عدم‌انطباق‌های سازمانی</div>
            <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {centralOrg.linkedModulesSummary.nonConformancesCount || 0} پرونده
            </div>
          </div>
        </div>

        {/* 14 Subsystems Selector */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedSubsystem('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              selectedSubsystem === 'ALL'
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            همه ۱۴ زیرسیستم ({projectData.studies.length})
          </button>
          {PSM_SPECIALIZED_SUBSYSTEMS.map((sub) => {
            const c = projectData.studies.filter((s) => s.subsystemType === sub.key).length;
            return (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSelectedSubsystem(sub.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
                  selectedSubsystem === sub.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {sub.key} ({c})
              </button>
            );
          })}
        </div>

        {showNewStudyForm && (
          <form
            onSubmit={handleCreateStudy}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
          >
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">ثبت مطالعه و توصیه تخصصی در زیرسیستم‌های ۱۴گانه PSM</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">زیرسیستم تخصصی *</label>
                <select
                  value={newStudy.subsystemType}
                  onChange={(e) => {
                    const meta = PSM_SPECIALIZED_SUBSYSTEMS.find((x) => x.key === e.target.value);
                    setNewStudy({
                      ...newStudy,
                      subsystemType: e.target.value,
                      trackingPath: meta?.defaultTrackingPath || newStudy.trackingPath,
                    });
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  {PSM_SPECIALIZED_SUBSYSTEMS.map((sub) => (
                    <option key={sub.key} value={sub.key}>
                      {sub.titleFa} ({sub.key})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">عنوان مطالعه / پرونده *</label>
                <input
                  required
                  value={newStudy.title}
                  onChange={(e) => setNewStudy({ ...newStudy, title: e.target.value })}
                  placeholder="مثلاً: مطالعه HAZOP و LOPA راکتور پلیمریزاسیون R-201"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">واحد فرایندی *</label>
                <input
                  required
                  list="psm-units-list"
                  value={newStudy.unitName}
                  onChange={(e) => setNewStudy({ ...newStudy, unitName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">تگ تجهیز / گره (Node)</label>
                <input
                  value={newStudy.nodeOrSection}
                  onChange={(e) => setNewStudy({ ...newStudy, nodeOrSection: e.target.value })}
                  placeholder="مثلاً Node-03 / R-201 Feed Line"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مالک مطالعه / مسئول پیگیری *</label>
                <input
                  required
                  list="psm-personnel-list"
                  value={newStudy.ownerName}
                  onChange={(e) => setNewStudy({ ...newStudy, ownerName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">تاریخ انجام / بازنگری بعدی *</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    required
                    value={newStudy.studyDate}
                    onChange={(e) => setNewStudy({ ...newStudy, studyDate: e.target.value })}
                    className="flex-1 px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                  />
                  <input
                    type="date"
                    value={newStudy.revalidationDueDate}
                    onChange={(e) => setNewStudy({ ...newStudy, revalidationDueDate: e.target.value })}
                    className="flex-1 px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    title="تاریخ بازنگری دوره‌ای (Revalidation)"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">خلاصه فنی مطالعه و سناریوها *</label>
                <textarea
                  required
                  rows={2}
                  value={newStudy.technicalSummary}
                  onChange={(e) => setNewStudy({ ...newStudy, technicalSummary: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">شواهد و مسیر پیگیری</label>
                <textarea
                  rows={2}
                  value={newStudy.evidenceSummary}
                  onChange={(e) => setNewStudy({ ...newStudy, evidenceSummary: e.target.value })}
                  placeholder="شماره گزارش، صورتجلسه و مسیر پیگیری..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  توصیه کلیدی استخراج‌شده از مطالعه (اختیاری - دارای مالک و مهلت)
                </label>
                <input
                  value={newStudy.recommendationTitle}
                  onChange={(e) => setNewStudy({ ...newStudy, recommendationTitle: e.target.value })}
                  placeholder="مثلاً: نصب ترانسمیتر فشار مستقل با سطح تمامیت ایمنی SIL-2 روی راکتور"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">مالک توصیه و سطح ریسک</label>
                <div className="flex gap-2">
                  <input
                    list="psm-personnel-list"
                    value={newStudy.recommendationOwner}
                    onChange={(e) => setNewStudy({ ...newStudy, recommendationOwner: e.target.value })}
                    placeholder="مالک توصیه"
                    className="flex-1 px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                  <select
                    value={newStudy.recommendationRisk}
                    onChange={(e) => setNewStudy({ ...newStudy, recommendationRisk: e.target.value })}
                    className="w-28 px-2 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewStudyForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                ثبت مطالعه تخصصی
              </button>
            </div>
          </form>
        )}

        {/* Studies Cards / Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PSM_SPECIALIZED_SUBSYSTEMS.filter(
            (sub) => selectedSubsystem === 'ALL' || sub.key === selectedSubsystem
          ).map((sub) => {
            const subStudies = filteredStudies.filter((s) => s.subsystemType === sub.key);
            return (
              <div
                key={sub.key}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{sub.titleFa}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{sub.descriptionFa}</p>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400 shrink-0">
                    {subStudies.length} مطالعه
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  مسیر استاندارد پیگیری: {sub.defaultTrackingPath}
                </div>
                {subStudies.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    {subStudies.map((st) => {
                      const recs: any[] = Array.isArray(st.recommendations) ? st.recommendations : [];
                      return (
                        <div
                          key={st.id}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-slate-900 dark:text-slate-100">
                            <span>{st.title}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400">
                                {st.studyCode}
                              </span>
                              {permissions.canWrite && (
                                <select
                                  value={st.status || 'IN_PROGRESS'}
                                  onChange={(e) => handleUpdateStudyStatus(st, e.target.value)}
                                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10.5px] font-bold"
                                >
                                  <option value="IN_PROGRESS">در حال انجام</option>
                                  <option value="COMPLETED">تکمیل‌شده</option>
                                  <option value="APPROVED">مصوب</option>
                                </select>
                              )}
                              {permissions.canApprove && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudy(st.id, st.studyCode)}
                                  className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 text-[10px] font-bold cursor-pointer"
                                >
                                  حذف
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">{st.technicalSummary}</div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                            <span>واحد: {st.unitName}</span>
                            {st.nodeOrSection && (
                              <>
                                <span>·</span>
                                <span className="font-mono">گره/تگ: {st.nodeOrSection}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>مالک: {st.ownerName}</span>
                            {st.revalidationDueDate && (
                              <>
                                <span>·</span>
                                <span className="font-mono">بازنگری بعدی: {st.revalidationDueDate}</span>
                              </>
                            )}
                          </div>

                          {/* Study Recommendations with 1-Click CAPA Conversion */}
                          {recs.length > 0 && (
                            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                              <div className="text-[10.5px] font-bold text-slate-600 dark:text-slate-300">
                                توصیه‌های ایمنی مستخرج از مطالعه ({recs.length}):
                              </div>
                              {recs.map((rec: any, rIdx: number) => (
                                <div
                                  key={rec.id || rIdx}
                                  className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{rec.title}</span>
                                    <span className="text-slate-500 mr-2">
                                      ({rec.ownerName || st.ownerName} · مهلت: {rec.dueDate || '—'})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {rec.status === 'CONVERTED_TO_CAPA' ? (
                                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono">
                                        ✓ ارجاع به {rec.linkedCapaCode || 'CAPA'}
                                      </span>
                                    ) : (
                                      permissions.canWrite && (
                                        <button
                                          type="button"
                                          onClick={() => handleConvertStudyRecommendation(st.id, rec.id)}
                                          className="px-2 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold cursor-pointer"
                                        >
                                          + تبدیل به پرونده CAPA
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeSubTab === 'maturity') {
    const latestMaturity = projectData.maturityRecords[0];
    const currentLiveElementScores = CCPS_20_ELEMENTS.map((el) => {
      const sc = maturityScores[el.code] || { design: 2, execution: 2, culture: 2, sustainability: 2 };
      const avg = (sc.design + sc.execution + sc.culture + sc.sustainability) / 4;
      return { code: el.code, pillarId: el.pillarId, avg };
    });
    const liveOverallScore = Number(
      (
        currentLiveElementScores.reduce((acc, item) => acc + item.avg, 0) /
        Math.max(1, currentLiveElementScores.length)
      ).toFixed(2)
    );
    const liveOverallLevel = Math.max(1, Math.min(5, Math.floor(liveOverallScore)));

    const pillarDefinitions = [
      { id: 'COMMIT', titleFa: 'ستون ۱: تعهد به ایمنی فرایند (Commit to Process Safety)' },
      { id: 'UNDERSTAND', titleFa: 'ستون ۲: درک خطرات و ریسک (Understand Hazards & Risk)' },
      { id: 'MANAGE', titleFa: 'ستون ۳: مدیریت ریسک (Manage Risk)' },
      { id: 'LEARN', titleFa: 'ستون ۴: یادگیری از تجربه (Learn from Experience)' },
    ];

    return (
      <div className="space-y-5">
        {/* 4 KPI Summary Cards for 5-Level Maturity Model */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              سطح بلوغ ثبت‌شده مجتمع (PSM Maturity Level)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-teal-600 dark:text-teal-400">
                سطح {latestMaturity?.overallMaturityLevel || liveOverallLevel} از ۵
              </span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {
                  PSM_MATURITY_LEVELS.find(
                    (l) => l.level === (latestMaturity?.overallMaturityLevel || liveOverallLevel)
                  )?.titleFa
                }
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              امتیاز موزون بلوغ در ۴ بُعد پایداری (از ۵.۰۰)
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {latestMaturity?.overallMaturityScore || liveOverallScore}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                پیش‌نمایش جدول فعلی: {liveOverallScore}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              تعداد دوره‌های ارزیابی بلوغ ثبت‌شده
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                {projectData.maturityRecords.length}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                آخرین تاریخ: {latestMaturity?.assessmentDate || 'ثبت نشده'}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              ممیز / سرارزیاب آخرین دوره بلوغ
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                {latestMaturity?.assessorName || 'آماده ثبت ارزیابی جدید'}
              </span>
              <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400">CCPS RBPS</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              مدل بلوغ ۵ سطحی ایمنی فرایند (PSM 5-Level Maturity Model)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ارزیابی توسعه، فرهنگ و پایداری نظام PSM در ۵ سطح (اولیه، در حال شکل‌گیری، تعریف‌شده، مدیریت‌شده، بهینه‌شده)؛ کاملاً مستقل از درصد پیشرفت پروژه و درصد تکمیل مدارک.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {PSM_MATURITY_LEVELS.map((lvl) => {
              const isCurrent = (latestMaturity?.overallMaturityLevel || liveOverallLevel) === lvl.level;
              return (
                <div
                  key={lvl.level}
                  className={`p-3.5 rounded-xl border ${
                    isCurrent
                      ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-500 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-black text-slate-900 dark:text-slate-100">{lvl.titleFa}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{lvl.summaryFa}</p>
                </div>
              );
            })}
          </div>

          {/* 4-Pillar Maturity Breakdown Bars */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
            {pillarDefinitions.map((pil) => {
              const pilItems = currentLiveElementScores.filter((x) => x.pillarId === pil.id);
              const pilScore =
                pilItems.length > 0
                  ? Number((pilItems.reduce((a, b) => a + b.avg, 0) / pilItems.length).toFixed(2))
                  : 2;
              const pct = Math.min(100, Math.max(0, (pilScore / 5) * 100));
              return (
                <div
                  key={pil.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800 dark:text-slate-200 truncate">{pil.titleFa}</span>
                    <span className="font-mono text-teal-600 dark:text-teal-400 shrink-0">{pilScore} / 5</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Maturity Evaluation Form */}
        <form
          onSubmit={handleSaveMaturityAssessment}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              ثبت ارزیابی بلوغ مستقل برای ۲۰ عنصر CCPS RBPS (امتیاز ۱ تا ۵ در چهار بُعد پایداری)
            </h4>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                list="psm-units-list"
                value={maturityUnitScope}
                onChange={(e) => setMaturityUnitScope(e.target.value)}
                placeholder="دامنه واحد سازمانی"
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <input
                required
                list="psm-personnel-list"
                value={maturityAssessor}
                onChange={(e) => setMaturityAssessor(e.target.value)}
                placeholder="نام ممیز / ارزیاب بلوغ *"
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={!permissions.canWrite}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                ثبت و محاسبه سطح بلوغ PSM
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                نقاط قوت کلیدی احرازشده در نظام PSM مجتمع
              </label>
              <input
                value={maturityStrengths}
                onChange={(e) => setMaturityStrengths(e.target.value)}
                placeholder="مثلاً: استقرار کامل گردش کار MOC و مشارکت بالای اپراتورها در مطالعات PHA..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                نقشه راه ارتقا به سطح بلوغ بالاتر (Improvement Roadmap)
              </label>
              <input
                value={maturityRoadmap}
                onChange={(e) => setMaturityRoadmap(e.target.value)}
                placeholder="مثلاً: دیجیتال‌سازی کامل بازرسی‌های RBI و پایش شاخص‌های پیشرو Tier 3 & 4..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px] custom-scrollbar border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2.5 px-3 font-bold">کد و عنصر CCPS</th>
                  <th className="py-2.5 px-3 font-bold">۱. طراحی سیستم (۱-۵)</th>
                  <th className="py-2.5 px-3 font-bold">۲. استقرار عملیاتی (۱-۵)</th>
                  <th className="py-2.5 px-3 font-bold">۳. فرهنگ و صلاحیت (۱-۵)</th>
                  <th className="py-2.5 px-3 font-bold">۴. پایداری و بهبود (۱-۵)</th>
                  <th className="py-2.5 px-3 font-bold">سطح بلوغ عنصر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {CCPS_20_ELEMENTS.map((el) => {
                  const sc = maturityScores[el.code] || { design: 2, execution: 2, culture: 2, sustainability: 2 };
                  const avg = ((sc.design + sc.execution + sc.culture + sc.sustainability) / 4).toFixed(2);
                  return (
                    <tr key={el.code}>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        <span className="font-mono text-teal-600 ml-1.5">{el.code}</span>
                        {el.titleFa}
                      </td>
                      {(['design', 'execution', 'culture', 'sustainability'] as const).map((dim) => (
                        <td key={dim} className="py-2 px-3">
                          <select
                            value={sc[dim]}
                            onChange={(e) =>
                              setMaturityScores((prev) => ({
                                ...prev,
                                [el.code]: { ...sc, [dim]: Number(e.target.value) },
                              }))
                            }
                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono tabular-nums"
                          >
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                سطح {n}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                      <td className="py-2 px-3 font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400">
                        {avg} / 5.00
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>

        {/* Saved Maturity Assessments History */}
        {projectData.maturityRecords.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
              سوابق دوره‌های ارزیابی بلوغ ۵ سطحی ثبت‌شده در پایگاه داده ({projectData.maturityRecords.length})
            </h4>
            <div className="space-y-2">
              {projectData.maturityRecords.map((rec: any) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      <span className="font-mono text-teal-600 ml-2">{rec.assessmentCode}</span>
                      سطح بلوغ {rec.overallMaturityLevel} از ۵ (امتیاز کل: {rec.overallMaturityScore}) — دامنه:{' '}
                      {rec.unitScope}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      ارزیاب: {rec.assessorName} · تاریخ ارزیابی: {rec.assessmentDate}
                      {rec.improvementRoadmap ? ` · نقشه راه: ${rec.improvementRoadmap}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadMaturityRecord(rec)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[11px] font-bold cursor-pointer"
                  >
                    بارگذاری در جدول
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeSubTab === 'handover') {
    const assessedCcpsCount = new Set(
      projectData.assessments.filter((a) => a.framework === 'CCPS_RBPS').map((a) => a.elementCode)
    ).size;
    const assessedOshaCount = new Set(
      projectData.assessments.filter((a) => a.framework === 'OSHA_1910_119').map((a) => a.elementCode)
    ).size;
    const openCriticalCapas = projectData.capaItems.filter(
      (c) => c.riskLevel === 'CRITICAL' && c.stage !== 'CLOSED'
    );
    const openCriticalGaps = projectData.gaps.filter(
      (g) => g.riskLevel === 'CRITICAL' && g.status !== 'CLOSED' && g.status !== 'OUT_OF_SCOPE_APPROVED'
    );
    const openNonCriticalCapas = projectData.capaItems.filter(
      (c) => c.riskLevel !== 'CRITICAL' && c.stage !== 'CLOSED'
    );
    const approvedDocs = projectData.documents.filter((d) => d.status === 'APPROVED');

    const gateChecks = [
      {
        title: '۱. ارزیابی تمام ۲۰ عنصر CCPS و ۱۴ الزام OSHA مشمول',
        passed: assessedCcpsCount >= 20 && assessedOshaCount >= 14,
        detail: `CCPS: ${assessedCcpsCount}/20 · OSHA: ${assessedOshaCount}/14`,
      },
      {
        title: '۲. تعیین تکلیف و بستن تمام نواقص و شکاف‌های بحرانی (Critical Deficiencies)',
        passed: openCriticalCapas.length === 0 && openCriticalGaps.length === 0,
        detail: `${openCriticalCapas.length} نقص بحرانی باز در CAPA · ${openCriticalGaps.length} شکاف بحرانی باز`,
      },
      {
        title: '۳. تأیید نهایی مدارک موردنیاز در بانک مدارک PSM',
        passed: projectData.documents.length > 0 && approvedDocs.length === projectData.documents.length,
        detail: `${approvedDocs.length} از ${projectData.documents.length} مدرک تأیید شده`,
      },
      {
        title: '۴. تعیین مالک، مهلت، برنامه پیگیری و تأیید مدیریت برای نواقص غیربحرانی باقیمانده',
        passed: openNonCriticalCapas.every(
          (c) => c.responsiblePersonName && c.dueDate && c.followupPlan && c.managementApprovalForResidual
        ),
        detail: `${openNonCriticalCapas.length} نقص غیربحرانی باقیمانده`,
      },
    ];

    const isHandedOver =
      activeProject.overallStatus === 'COMPLETED' || Boolean(activeProject.handoverData?.finalAuditCompleted);

    return (
      <div className="space-y-5">
        {/* Official Handover Certificate Banner if already handed over */}
        {isHandedOver && (
          <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                گواهی رسمی پذیرش و تحویل نهایی پروژه استقرار ایمنی فرایند (PSM Official Handover Certificate)
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                پروژه «{activeProject.title}» با موفقیت ممیزی نهایی و تحویل رسمی گردید
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                شماره گزارش ممیزی نهایی: {activeProject.handoverData?.finalAuditReportRef || '—'} · مقام تصویب‌کننده:{' '}
                {activeProject.handoverData?.authorizedApproverName || '—'} (
                {activeProject.handoverData?.authorizedApproverRole || 'مدیر ارشد'}) · تاریخ تصویب:{' '}
                {activeProject.handoverData?.finalReportApprovalDate || '—'}
              </p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black">
              تحویل قطعی و مختومه (COMPLETED 100%)
            </span>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
            تأیید نهایی و تحویل پروژه استقرار PSM (Final Acceptance & Handover Gateway)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            تحویل نهایی پروژه صرفاً با تکمیل فعالیت‌ها کافی نیست؛ کلیه گلوگاه‌های فنی، ممیزی نهایی، تأیید اثربخشی کنترل‌ها و تصویب مقام مجاز باید احراز شوند.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gateChecks.map((chk, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                  chk.passed
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/50'
                    : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/50'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{chk.title}</div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">{chk.detail}</div>
                </div>
                <span
                  className={`text-xs font-bold shrink-0 ${
                    chk.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {chk.passed ? '✓ احراز شد' : 'نیازمند تکمیل'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Residual Non-Critical Deficiencies Governance Table */}
        {openNonCriticalCapas.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
              وضعیت نواقص غیربحرانی باقیمانده جهت تحویل مشروط ({openNonCriticalCapas.length} مورد)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="py-2 px-3 font-bold">کد CAPA</th>
                    <th className="py-2 px-3 font-bold">عنوان نقص</th>
                    <th className="py-2 px-3 font-bold">مالک و مهلت</th>
                    <th className="py-2 px-3 font-bold">برنامه پیگیری پس از تحویل</th>
                    <th className="py-2 px-3 font-bold">تأیید مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {openNonCriticalCapas.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 px-3 font-mono font-bold">{c.capaCode}</td>
                      <td className="py-2 px-3 font-semibold">{c.title}</td>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {c.responsiblePersonName || 'فاقد مالک'} · {c.dueDate || 'فاقد مهلت'}
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                        {c.followupPlan || 'ثبت نشده (از تب CAPA تکمیل شود)'}
                      </td>
                      <td className="py-2 px-3 font-bold">
                        {c.managementApprovalForResidual ? (
                          <span className="text-emerald-600 dark:text-emerald-400">✓ تأیید شده</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">✕ فاقد تأیید مدیریت</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form
          onSubmit={handleFinalHandoverSubmit}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ثبت صورتجلسه ممیزی نهایی، تأیید اثربخشی کنترل‌ها و تصویب گزارش نهایی توسط مقام مجاز
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                شماره گزارش ممیزی نهایی PSM *
              </label>
              <input
                required
                value={handoverForm.finalAuditReportRef}
                onChange={(e) => setHandoverForm({ ...handoverForm, finalAuditReportRef: e.target.value })}
                placeholder="مثلاً RJL-PSM-FINAL-AUDIT-1405"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                نام مقام مجاز تصویب‌کننده گزارش نهایی *
              </label>
              <input
                required
                list="psm-personnel-list"
                value={handoverForm.authorizedApproverName}
                onChange={(e) => setHandoverForm({ ...handoverForm, authorizedApproverName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                سمت سازمانی مقام تصویب‌کننده
              </label>
              <input
                value={handoverForm.authorizedApproverRole}
                onChange={(e) => setHandoverForm({ ...handoverForm, authorizedApproverRole: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                تاریخ تصویب نهایی *
              </label>
              <input
                type="date"
                required
                value={handoverForm.finalReportApprovalDate}
                onChange={(e) => setHandoverForm({ ...handoverForm, finalReportApprovalDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                خلاصه صورتجلسه تحویل نهایی و دستورات کمیته راهبری PSM
              </label>
              <textarea
                rows={2}
                value={handoverForm.handoverNotes}
                onChange={(e) => setHandoverForm({ ...handoverForm, handoverNotes: e.target.value })}
                placeholder="شروط بهره‌برداری مستمر، برنامه ممیزی‌های ادواری و مصوبات کمیته راهبری مجتمع پتروشیمی رجال..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={handoverForm.operationalEvidenceVerified}
                onChange={(e) => setHandoverForm({ ...handoverForm, operationalEvidenceVerified: e.target.checked })}
              />
              <span>شواهد اجرایی در واحدهای عملیاتی بررسی و صحه‌گذاری شد</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={handoverForm.finalAuditCompleted}
                onChange={(e) => setHandoverForm({ ...handoverForm, finalAuditCompleted: e.target.checked })}
              />
              <span>ممیزی نهایی مستقل استقرار PSM انجام شد</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={handoverForm.controlsEffectivenessVerified}
                onChange={(e) =>
                  setHandoverForm({ ...handoverForm, controlsEffectivenessVerified: e.target.checked })
                }
              />
              <span>اثربخشی کنترل‌های اجراشده تأیید نهایی شد</span>
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!permissions.canApprove}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
            >
              تصویب گزارش نهایی و ثبت تحویل رسمی پروژه PSM
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (activeSubTab === 'ai-audit') {
    const governanceActionsCount = auditLogs.filter((log: any) =>
      [
        'APPROVE_STAGE_GATE',
        'REJECT_STAGE_GATE',
        'SUBMIT_STAGE_GATE',
        'REOPEN_AFTER_ALTERATION',
        'EXTEND_DUE_DATE',
        'APPROVE_FINAL_HANDOVER',
        'CONVERT_TO_WBS_AND_CAPA',
      ].includes(log.action)
    ).length;

    const filteredAuditLogs = auditLogs.filter((log: any) => {
      if (auditEntityTypeFilter !== 'ALL' && log.entityType !== auditEntityTypeFilter) {
        return false;
      }
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.trim().toLowerCase();
        const actor = String(log.details?.actorName || log.userUid || '').toLowerCase();
        const action = String(log.action || '').toLowerCase();
        const entityType = String(log.entityType || '').toLowerCase();
        const entityId = String(log.entityId || '').toLowerCase();
        if (!actor.includes(q) && !action.includes(q) && !entityType.includes(q) && !entityId.includes(q)) {
          return false;
        }
      }
      return true;
    });

    return (
      <div className="space-y-5">
        {/* Phase 9: 4 KPI Summary Cards for Local AI & Governance Audit Trail */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              وضعیت پردازش هوش مصنوعی HSECORE
            </div>
            <div className="mt-1.5 text-sm font-black text-teal-600 dark:text-teal-400">
              ۱۰۰٪ محلی (On-Premise)
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              بدون ارسال هیچ‌گونه داده محرمانه به فضای ابری
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              کل رویدادهای ممیزی ثبت‌شده در سرور
            </div>
            <div className="mt-1 text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {auditLogs.length}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              ثبت غیرقابل‌تغییر (Immutable Audit Trail) در PostgreSQL
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              تصمیمات حاکمیتی و کنترل‌های دروازه‌ای
            </div>
            <div className="mt-1 text-2xl font-black font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
              {governanceActionsCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              تصویب/رد گیت، بازگشایی مدرک، تمدید CAPA و تحویل نهایی
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              کنترل انسانی خروجی‌های هوش مصنوعی
            </div>
            <div className="mt-1.5 text-sm font-black text-emerald-600 dark:text-emerald-400">
              {aiResult
                ? aiResult.humanApproved
                  ? '✓ تأیید انسانی ثبت شد'
                  : '⏳ در انتظار بررسی و تأیید انسانی'
                : 'الزام تأیید انسانی فعال است'}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              ممنوعیت اعمال خودکار بدون امضای کارشناس/مدیر
            </div>
          </div>
        </div>

        {/* Local HSECORE AI Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                دستیار هوش مصنوعی محلی HSECORE ویژه استقرار PSM (Local On-Premise AI)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                پردازش صددرصد محلی روی سرور داخلی سازمان بدون ارسال هیچ‌گونه اطلاعات محرمانه به سرویس‌های ابری. تمامی پیشنهادات نیازمند بررسی و تأیید انسانی هستند.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                نوع تحلیل هوشمند موردنیاز
              </label>
              <select
                value={aiMode}
                onChange={(e) => setAiMode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                <option value="IDENTIFY_GAPS">شناسایی شکاف‌ها و تحلیل انطباق CCPS/OSHA</option>
                <option value="ANALYZE_DOCUMENT">تحلیل مستندات و کفایت شواهد بانک مدارک</option>
                <option value="SUGGEST_CAPA">پیشنهاد اقدامات اصلاحی و پیشگیرانه (CAPA)</option>
                <option value="ANALYZE_TRENDS">تحلیل روندها، انحراف WBS و سطح بلوغ</option>
                <option value="EXECUTIVE_REPORT">تهیه گزارش مدیریتی کمیته راهبری PSM مجتمع</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                شرح موضوع یا متن مستند جهت تحلیل محلی (اختیاری)
              </label>
              <div className="flex gap-2">
                <input
                  value={aiCustomContext}
                  onChange={(e) => setAiCustomContext(e.target.value)}
                  placeholder="مثلاً: تمرکز روی واحد پلیمریزاسیون و کنترل‌های یکپارچگی مکانیکی راکتورها..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleRunLocalAiAnalysis}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Bot className="w-4 h-4" />
                  <span>{aiLoading ? 'در حال تحلیل محلی...' : 'اجرای تحلیل هوشمند محلی'}</span>
                </button>
              </div>
            </div>
          </div>

          {aiResult && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-100">
                  موتور پردازش: {aiResult.modelUsed} · حریم خصوصی: پردازش ۱۰۰٪ محلی (بدون ارسال به ابر)
                </div>
                <div className="flex items-center gap-2">
                  {aiResult.humanApproved ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ بررسی و تأیید انسانی انجام شد
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAiResult({ ...aiResult, humanApproved: true });
                        toast.success('پیشنهاد هوش مصنوعی پس از بررسی انسانی تأیید شد.');
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      تأیید انسانی پیشنهادات هوش مصنوعی
                    </button>
                  )}
                </div>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                {aiResult.analysisText}
              </pre>
            </div>
          )}
        </div>

        {/* Before/After Audit Log Snapshot Inspector */}
        {selectedAuditLog && (
          <div className="bg-slate-900 text-slate-100 border border-teal-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h5 className="text-xs font-black text-teal-400">
                  جزئیات کامل رویداد ممیزی و مقایسه قبل/بعد (Audit Snapshot #{selectedAuditLog.id})
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  عملیات: <span className="font-mono text-white">{selectedAuditLog.action}</span> · موجودیت:{' '}
                  <span className="font-mono text-white">{selectedAuditLog.entityType}</span> · کاربر:{' '}
                  <span className="font-semibold text-white">
                    {selectedAuditLog.details?.actorName || selectedAuditLog.userUid}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                بستن جزئیات
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="font-bold text-amber-400 mb-1">وضعیت قبلی (Old Value)</div>
                <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-300 max-h-44 overflow-y-auto">
                  {selectedAuditLog.oldValue ? JSON.stringify(selectedAuditLog.oldValue, null, 2) : '— (ایجاد اولیه)'}
                </pre>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="font-bold text-emerald-400 mb-1">وضعیت جدید (New Value)</div>
                <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-300 max-h-44 overflow-y-auto">
                  {selectedAuditLog.newValue ? JSON.stringify(selectedAuditLog.newValue, null, 2) : '—'}
                </pre>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="font-bold text-sky-400 mb-1">فراداده و جزئیات حاکمیتی (Details)</div>
                <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-300 max-h-44 overflow-y-auto">
                  {selectedAuditLog.details ? JSON.stringify(selectedAuditLog.details, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* PSM Audit Log History */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                ثبت لاگ ممیزی و تاریخچه عملیات ماژول PSM (Server Audit Trail)
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                نمایش {filteredAuditLogs.length} رویداد از {auditLogs.length} رویداد ثبت‌شده در سرور مرکزی
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={auditEntityTypeFilter}
                onChange={(e) => setAuditEntityTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
              >
                <option value="ALL">همه موجودیت‌ها (All Entities)</option>
                <option value="PSM_STAGE_GATE">دروازه‌های مرحله‌ای (PSM_STAGE_GATE)</option>
                <option value="PSM_DOCUMENT">بانک مدارک (PSM_DOCUMENT)</option>
                <option value="PSM_CAPA">اقدامات اصلاحی (PSM_CAPA)</option>
                <option value="PSM_GAP">تحلیل شکاف (PSM_GAP)</option>
                <option value="PSM_WBS">ساختار شکست کار (PSM_WBS)</option>
                <option value="PSM_STUDY">زیرسیستم‌های تخصصی (PSM_STUDY)</option>
                <option value="PSM_MATURITY">ارزیابی بلوغ (PSM_MATURITY)</option>
                <option value="PSM_PROJECT">پروژه و تحویل نهایی (PSM_PROJECT)</option>
                <option value="PSM_AI">هوش مصنوعی محلی (PSM_AI)</option>
              </select>
              <input
                type="text"
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                placeholder="جستجو در نام کاربر، عملیات یا شناسه..."
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 w-56"
              />
            </div>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              رویدادی مطابق فیلتر انتخابی در لاگ ممیزی PSM یافت نشد.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-96 custom-scrollbar">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 font-bold">زمان ثبت</th>
                    <th className="py-2 px-3 font-bold">کاربر اقدام‌کننده</th>
                    <th className="py-2 px-3 font-bold">عملیات</th>
                    <th className="py-2 px-3 font-bold">موجودیت</th>
                    <th className="py-2 px-3 font-bold">شناسه رکورد</th>
                    <th className="py-2 px-3 font-bold">جزئیات تغییر (Snapshot)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {filteredAuditLogs.map((log: any) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2 px-3 font-mono tabular-nums text-[11px]">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('fa-IR') : '—'}
                      </td>
                      <td className="py-2 px-3 font-semibold">{log.details?.actorName || log.userUid}</td>
                      <td className="py-2 px-3 font-mono text-teal-600 dark:text-teal-400 font-bold">
                        {log.action}
                      </td>
                      <td className="py-2 px-3 font-mono">{log.entityType}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">{log.entityId}</td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => setSelectedAuditLog(log)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/50 text-slate-700 dark:text-slate-300 hover:text-teal-600 text-[11px] font-bold cursor-pointer"
                        >
                          مشاهده Snapshot
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
