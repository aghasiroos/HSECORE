import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Cpu,
  FileCheck2,
  FileText,
  FolderGit2,
  GitBranch,
  Layers,
  ListChecks,
  Network,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Search,
  Filter,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { UserProfile } from '../../types';
import { getAuthToken } from '../../services/apiDatabaseClient';
import { showConfirmDialog } from '../../components/common/ConfirmDialogModal';
import {
  CCPS_PILLARS,
  CCPS_20_ELEMENTS,
  OSHA_14_CLAUSES,
  CCPS_OSHA_TRACEABILITY_MATRIX,
  PSM_SPECIALIZED_SUBSYSTEMS,
} from './psmStandardsCatalog';
import { PsmSubViews } from './PsmSubViews';
import { PsmPersonalWorkspace } from './PsmPersonalWorkspace';
import { PsmExecutiveDashboard } from './PsmExecutiveDashboard';
import { PsmProjectFormWizard, PsmProjectFormPayload } from './PsmProjectFormWizard';
import { PsmCommandCenter } from './PsmCommandCenter';
import { PsmComprehensiveGuide } from './PsmComprehensiveGuide';
import { PsmDeepLinkAction } from './psmGuidedEngine';
import PersianDatePicker from '../../components/common/PersianDatePicker';
import { SubViewTransition, PsmSubmoduleSkeleton } from '../../motion';

interface PsmManagementModuleProps {
  language?: 'fa' | 'en';
  currentUser: UserProfile | null;
}

export type PsmSubTabKey =
  | 'command-center'
  | 'my-workspace'
  | 'dashboard'
  | 'project'
  | 'stage-gates'
  | 'org-assets'
  | 'assessment'
  | 'gap-analysis'
  | 'wbs-gantt'
  | 'documents'
  | 'capa'
  | 'studies'
  | 'maturity'
  | 'handover'
  | 'ai-audit'
  | 'comprehensive-guide';

export type PsmZoneKey = 'workspace' | 'command' | 'planning' | 'compliance' | 'closeout' | 'guide';

export interface PsmZoneMeta {
  key: PsmZoneKey;
  titleFa: string;
  titleEn: string;
  icon: any;
  subTabs: PsmSubTabKey[];
}

export const PSM_ZONES: PsmZoneMeta[] = [
  {
    key: 'workspace',
    titleFa: 'راهبر و کارهای من',
    titleEn: 'Guided Hub & My Tasks',
    icon: UserCheck,
    subTabs: ['command-center', 'my-workspace'],
  },
  {
    key: 'command',
    titleFa: 'فرماندهی و پایش مدیران',
    titleEn: 'Command & Governance',
    icon: BarChart3,
    subTabs: ['dashboard', 'stage-gates', 'maturity'],
  },
  {
    key: 'planning',
    titleFa: 'برنامه‌ریزی و دارایی‌ها',
    titleEn: 'Scope & Planning',
    icon: Target,
    subTabs: ['project', 'org-assets', 'wbs-gantt'],
  },
  {
    key: 'compliance',
    titleFa: 'ارزیابی و انطباق',
    titleEn: 'Assessment & Gaps',
    icon: ClipboardCheck,
    subTabs: ['assessment', 'gap-analysis', 'studies'],
  },
  {
    key: 'closeout',
    titleFa: 'اسناد، اقدام و تحویل',
    titleEn: 'Execution & Closeout',
    icon: FolderGit2,
    subTabs: ['documents', 'capa', 'handover', 'ai-audit'],
  },
  {
    key: 'guide',
    titleFa: 'راهنمای جامع',
    titleEn: 'Comprehensive Guide',
    icon: BookOpen,
    subTabs: ['comprehensive-guide'],
  },
];

export const PSM_NAVIGATION_TABS: Array<{
  key: PsmSubTabKey;
  titleFa: string;
  titleEn: string;
  badgeText?: string;
  icon: any;
}> = [
  { key: 'command-center', titleFa: 'مسیر استقرار PSM (راهبر هوشمند)', titleEn: 'Guided PSM Roadmap', badgeText: 'مرکز راهبر', icon: Sparkles },
  { key: 'my-workspace', titleFa: 'کارهای من (کارتابل عملیاتی)', titleEn: 'My Action Center', badgeText: '۸ دسته', icon: UserCheck },
  { key: 'dashboard', titleFa: 'داشبورد کنترل و پایش مدیران', titleEn: 'Control & Monitoring', icon: BarChart3 },
  { key: 'project', titleFa: 'مدیریت پروژه و دامنه', titleEn: 'Project & Scope', icon: Target },
  { key: 'stage-gates', titleFa: 'موتور حاکمیت و دروازه‌های کنترلی (G1–G6)', titleEn: 'Stage Gate Governance', badgeText: '6 Gates', icon: ShieldCheck },
  { key: 'org-assets', titleFa: 'ساختار سازمانی و تجهیزات', titleEn: 'Org & Process Assets', icon: Building2 },
  { key: 'assessment', titleFa: 'ارزیابی اولیه و ماتریس تطبیق', titleEn: 'Initial Assessment & Matrix', badgeText: '20 CCPS / 14 OSHA', icon: ClipboardCheck },
  { key: 'gap-analysis', titleFa: 'تحلیل شکاف (Gap Analysis)', titleEn: 'Gap Analysis', icon: AlertTriangle },
  { key: 'wbs-gantt', titleFa: 'برنامه اجرایی، WBS و گانت', titleEn: 'WBS & Gantt Schedule', icon: GitBranch },
  { key: 'documents', titleFa: 'بانک اسناد و شواهد PSM', titleEn: 'PSM Document Bank', icon: FolderGit2 },
  { key: 'capa', titleFa: 'گردش کار ۸ مرحله‌ای CAPA', titleEn: '8-Stage CAPA Workflow', icon: ShieldAlert },
  { key: 'studies', titleFa: '۱۴ زیرماژول تخصصی PSM', titleEn: '14 Specialized Subsystems', badgeText: '14 Subsystems', icon: Layers },
  { key: 'maturity', titleFa: 'مدل بلوغ ۵ سطحی PSM', titleEn: '5-Level Maturity Model', icon: Award },
  { key: 'handover', titleFa: 'تحویل نهایی و نگهداشت', titleEn: 'Final Handover Gate', icon: FileCheck2 },
  { key: 'ai-audit', titleFa: 'هوش مصنوعی محلی و Audit Log', titleEn: 'Local AI & Audit Trail', icon: Bot },
  { key: 'comprehensive-guide', titleFa: 'راهنمای جامع استقرار PSM (مرجع آموزشی و عملیاتی)', titleEn: 'Comprehensive PSM User Guide', badgeText: '۱۲ بخش', icon: BookOpen },
];

export default function PsmManagementModule({ currentUser }: PsmManagementModuleProps) {
  const [activeZone, setActiveZone] = useState<PsmZoneKey>('workspace');
  const [activeSubTab, setActiveSubTab] = useState<PsmSubTabKey>('command-center');
  const [activeDeepLinkContext, setActiveDeepLinkContext] = useState<PsmDeepLinkAction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [centralOrg, setCentralOrg] = useState<{
    companies: any[];
    sites: any[];
    departments: any[];
    units: any[];
    positions: any[];
    personnel: any[];
    linkedModulesSummary: Record<string, number>;
    centralAutofillCatalog?: any[];
  }>({
    companies: [],
    sites: [],
    departments: [],
    units: [],
    positions: [],
    personnel: [],
    linkedModulesSummary: {},
    centralAutofillCatalog: [],
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<{ canWrite: boolean; canApprove: boolean }>({
    canWrite: true,
    canApprove: true,
  });

  const [projectData, setProjectData] = useState<{
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
    stageGates: any[];
    gateDeviations: any[];
  }>({
    assets: [],
    assessments: [],
    gaps: [],
    wbsTasks: [],
    documents: [],
    capaItems: [],
    studies: [],
    maturityRecords: [],
    stageGates: [],
    gateDeviations: [],
  });

  // Modals & Forms State (Unified on PsmProjectFormWizard)
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  // Tab 2: Edit Active Project State
  const [editingProject, setEditingProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState<any>(null);

  // Tab 3: Process Assets State
  const [showNewAssetForm, setShowNewAssetForm] = useState(false);
  const [newAssetForm, setNewAssetForm] = useState({
    complexName: 'مجتمع پتروشیمی رجال',
    companyName: 'شرکت پتروشیمی رجال',
    processUnitName: '',
    operationalZone: '',
    equipmentTag: '',
    equipmentName: '',
    equipmentType: 'PRESSURE_VESSEL',
    hazardousChemicalsText: '',
    operatingTempDesc: '',
    operatingPressureDesc: '',
    responsiblePersonName: '',
    safetyCriticality: 'CRITICAL',
    psiCompleted: false,
  });

  // Tab 3: Asset Filter & Milestone States
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetUnitFilter, setAssetUnitFilter] = useState('ALL');
  const [assetCriticalityFilter, setAssetCriticalityFilter] = useState('ALL');
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  // Tab 4: Initial Assessment & Traceability Matrix State
  const [assessmentStandardFilter, setAssessmentStandardFilter] = useState<'CCPS_RBPS' | 'OSHA_1910_119' | 'MATRIX'>('CCPS_RBPS');
  const [selectedAssessmentUnit, setSelectedAssessmentUnit] = useState<string>('ALL');
  const [matrixFilterRelation, setMatrixFilterRelation] = useState<'ALL' | 'DIRECT' | 'INDIRECT'>('ALL');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [assessmentForm, setAssessmentForm] = useState({
    standardType: 'CCPS_RBPS' as 'CCPS_RBPS' | 'OSHA_1910_119',
    elementCode: 'CCPS-01',
    unitName: 'کل مجتمع',
    complianceStatus: 'PARTIAL',
    currentScore: 55,
    requiredScore: 85,
    maturityStage: 2,
    weight: 5,
    strengths: '',
    weaknesses: '',
    existingDocumentsText: '',
    missingDocumentsText: '',
    technicalEvidenceText: '',
    fieldObservations: '',
    assessorName: '',
    assessmentDate: new Date().toISOString().slice(0, 10),
    isOutOfScope: false,
    outOfScopeJustification: '',
    outOfScopeApprovedBy: '',
  });

  // Listen to external subtab navigation events (e.g., from HSECORE AI `/` slash command)
  useEffect(() => {
    const handleSubTabNav = (e: any) => {
      const detail = e?.detail;
      if (detail?.tab === 'psm' && detail?.subItem) {
        const validKey = PSM_NAVIGATION_TABS.find((t) => t.key === detail.subItem)?.key;
        if (validKey) {
          setActiveSubTab(validKey);
        }
      }
    };
    window.addEventListener('hse-navigate-subtab', handleSubTabNav);
    return () => window.removeEventListener('hse-navigate-subtab', handleSubTabNav);
  }, []);

  const apiRequest = useCallback(async (path: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`/api/v1/psm${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || `خطای ارتباط با سرور (${res.status})`);
    }
    return json;
  }, []);

  const fetchBootstrap = useCallback(async (preferredProjectId?: number | null) => {
    try {
      setLoading(true);
      const data = await apiRequest('/bootstrap');
      const loadedProjects = Array.isArray(data.projects) ? data.projects : [];
      setProjects(loadedProjects);
      if (data.centralOrg) {
        setCentralOrg(data.centralOrg);
      }
      if (Array.isArray(data.auditLogs)) {
        setAuditLogs(data.auditLogs);
      }
      if (data.permissions) {
        setPermissions(data.permissions);
      }

      const targetId =
        preferredProjectId ??
        selectedProjectId ??
        (loadedProjects.length > 0 ? loadedProjects[0].id : null);

      if (targetId && loadedProjects.some((p: any) => p.id === targetId)) {
        setSelectedProjectId(targetId);
        const detail = await apiRequest(`/projects/${targetId}/full`);
        if (detail) {
          setProjectData({
            assets: Array.isArray(detail.assets) ? detail.assets : [],
            assessments: Array.isArray(detail.assessments) ? detail.assessments : [],
            gaps: Array.isArray(detail.gaps) ? detail.gaps : [],
            wbsTasks: Array.isArray(detail.wbsTasks) ? detail.wbsTasks : [],
            documents: Array.isArray(detail.documents) ? detail.documents : [],
            capaItems: Array.isArray(detail.capaItems) ? detail.capaItems : [],
            studies: Array.isArray(detail.studies) ? detail.studies : [],
            maturityRecords: Array.isArray(detail.maturityRecords) ? detail.maturityRecords : [],
            stageGates: Array.isArray(detail.stageGates)
              ? detail.stageGates
              : Array.isArray(data.projectData?.stageGates)
              ? data.projectData.stageGates
              : [],
            gateDeviations: Array.isArray(detail.gateDeviations)
              ? detail.gateDeviations
              : Array.isArray(data.projectData?.gateDeviations)
              ? data.projectData.gateDeviations
              : [],
          });
        }
      } else {
        setSelectedProjectId(null);
        setProjectData({
          assets: [],
          assessments: [],
          gaps: [],
          wbsTasks: [],
          documents: [],
          capaItems: [],
          studies: [],
          maturityRecords: [],
          stageGates: [],
          gateDeviations: [],
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بارگذاری داده‌های سامانه PSM');
    } finally {
      setLoading(false);
    }
  }, [apiRequest, selectedProjectId]);

  useEffect(() => {
    fetchBootstrap();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleRemoteUpdate = (e?: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('psm')) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void fetchBootstrap();
        }, 300);
      }
    };

    window.addEventListener('hse_psm_updated', handleRemoteUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteUpdate);
    window.addEventListener('app_data_mutated', handleRemoteUpdate);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('hse_psm_updated', handleRemoteUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteUpdate);
      window.removeEventListener('app_data_mutated', handleRemoteUpdate);
    };
  }, []);

  const handleSelectProject = async (projectId: number) => {
    setSelectedProjectId(projectId);
    setEditingProject(false);
    try {
      const detail = await apiRequest(`/projects/${projectId}/full`);
      setProjectData({
        assets: Array.isArray(detail.assets) ? detail.assets : [],
        assessments: Array.isArray(detail.assessments) ? detail.assessments : [],
        gaps: Array.isArray(detail.gaps) ? detail.gaps : [],
        wbsTasks: Array.isArray(detail.wbsTasks) ? detail.wbsTasks : [],
        documents: Array.isArray(detail.documents) ? detail.documents : [],
        capaItems: Array.isArray(detail.capaItems) ? detail.capaItems : [],
        studies: Array.isArray(detail.studies) ? detail.studies : [],
        maturityRecords: Array.isArray(detail.maturityRecords) ? detail.maturityRecords : [],
        stageGates: Array.isArray(detail.stageGates) ? detail.stageGates : [],
        gateDeviations: Array.isArray(detail.gateDeviations) ? detail.gateDeviations : [],
      });
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بارگذاری جزئیات پروژه');
    }
  };

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const handleSelectZone = (zoneKey: PsmZoneKey) => {
    setActiveZone(zoneKey);
    const zoneMeta = PSM_ZONES.find((z) => z.key === zoneKey);
    if (zoneMeta && !zoneMeta.subTabs.includes(activeSubTab)) {
      setActiveSubTab(zoneMeta.subTabs[0]);
    }
  };

  const handleSelectSubTab = (subTabKey: PsmSubTabKey) => {
    setActiveSubTab(subTabKey);
    const parentZone = PSM_ZONES.find((z) => z.subTabs.includes(subTabKey));
    if (parentZone && parentZone.key !== activeZone) {
      setActiveZone(parentZone.key);
    }
  };

  const visibleSubTabs = useMemo(() => {
    const zoneMeta = PSM_ZONES.find((z) => z.key === activeZone);
    if (!zoneMeta) {
      return PSM_NAVIGATION_TABS;
    }
    return PSM_NAVIGATION_TABS.filter((tab) => zoneMeta.subTabs.includes(tab.key));
  }, [activeZone]);

  // Derived available units from central organization + active project covered units + process assets
  const availableUnits = useMemo(() => {
    const unitSet = new Set<string>();
    if (Array.isArray(activeProject?.coveredUnits)) {
      activeProject.coveredUnits.forEach((u: any) => {
        const name = typeof u === 'string' ? u : u?.name;
        if (name) unitSet.add(String(name).trim());
      });
    }
    centralOrg.units.forEach((u: any) => {
      if (u?.name) unitSet.add(String(u.name).trim());
    });
    centralOrg.departments.forEach((d: any) => {
      if (d?.name) unitSet.add(String(d.name).trim());
    });
    projectData.assets.forEach((a: any) => {
      if (a?.processUnitName) unitSet.add(String(a.processUnitName).trim());
    });
    const list = Array.from(unitSet).filter(Boolean);
    return list.length > 0 ? list : ['کل مجتمع'];
  }, [activeProject, centralOrg.units, centralOrg.departments, projectData.assets]);

  // Derived filtered process assets based on search, unit, and criticality
  const filteredAssets = useMemo(() => {
    return projectData.assets.filter((a) => {
      if (assetUnitFilter !== 'ALL' && a.processUnitName !== assetUnitFilter) return false;
      if (assetCriticalityFilter !== 'ALL' && a.safetyCriticality !== assetCriticalityFilter) return false;
      if (assetSearchQuery.trim()) {
        const q = assetSearchQuery.trim().toLowerCase();
        const tag = (a.equipmentTag || '').toLowerCase();
        const name = (a.equipmentName || '').toLowerCase();
        const area = (a.operationalArea || a.operationalZone || '').toLowerCase();
        if (!tag.includes(q) && !name.includes(q) && !area.includes(q)) return false;
      }
      return true;
    });
  }, [projectData.assets, assetUnitFilter, assetCriticalityFilter, assetSearchQuery]);

  // Comprehensive Project Control & Monitoring Metrics (Section 9)
  const dashboardMetrics = useMemo(() => {
    const assessments = projectData.assessments;
    const gaps = projectData.gaps;
    const wbsTasks = projectData.wbsTasks;
    const documents = projectData.documents;
    const capaItems = projectData.capaItems;
    const studies = projectData.studies;
    const maturityRecords = projectData.maturityRecords;

    // 1. CCPS 20 Elements Progress
    const ccpsProgress = CCPS_20_ELEMENTS.map((el) => {
      const elAssessments = assessments.filter((a) => a.elementCode === el.code && !a.isOutOfScope);
      const avgScore =
        elAssessments.length > 0
          ? Math.round(
              elAssessments.reduce((acc, cur) => acc + Number(cur.currentScore || 0), 0) /
                elAssessments.length
            )
          : 0;
      const openGaps = gaps.filter((g) => g.ccpsElementCode === el.code && g.status !== 'CLOSED' && !g.isOutOfScope).length;
      return {
        ...el,
        score: avgScore,
        assessedCount: elAssessments.length,
        openGaps,
      };
    });

    // 2. OSHA 14 Clauses Status
    const oshaProgress = OSHA_14_CLAUSES.map((cl) => {
      const clAssessments = assessments.filter((a) => a.elementCode === cl.code && !a.isOutOfScope);
      const avgScore =
        clAssessments.length > 0
          ? Math.round(
              clAssessments.reduce((acc, cur) => acc + Number(cur.currentScore || 0), 0) /
                clAssessments.length
            )
          : 0;
      return {
        ...cl,
        score: avgScore,
        assessedCount: clAssessments.length,
      };
    });

    // 3. Unit-by-unit Progress
    const unitProgress = availableUnits.map((unitName) => {
      const unitTasks = wbsTasks.filter((t) => t.unitName === unitName);
      const unitGaps = gaps.filter((g) => g.unitName === unitName && !g.isOutOfScope);
      const closedUnitGaps = unitGaps.filter((g) => g.status === 'CLOSED').length;
      const taskAvg =
        unitTasks.length > 0
          ? Math.round(
              unitTasks.reduce((acc, t) => acc + Number(t.actualProgress || 0), 0) / unitTasks.length
            )
          : unitGaps.length > 0
          ? Math.round((closedUnitGaps / unitGaps.length) * 100)
          : 0;
      return {
        unitName,
        progress: taskAvg,
        tasksCount: unitTasks.length,
        openGapsCount: unitGaps.filter((g) => g.status !== 'CLOSED').length,
      };
    });

    // 4. Tasks & Schedule Variance
    const completedTasks = wbsTasks.filter((t) => Number(t.actualProgress || 0) >= 100 || t.status === 'COMPLETED').length;
    const remainingTasks = wbsTasks.length - completedTasks;
    const delayedTasks = wbsTasks.filter((t) => Number(t.delayDays || 0) > 0 && Number(t.actualProgress || 0) < 100).length;
    const avgScheduleVariance =
      wbsTasks.length > 0
        ? Math.round(
            wbsTasks.reduce(
              (acc, t) => acc + (Number(t.actualProgress || 0) - Number(t.plannedProgress || 0)),
              0
            ) / wbsTasks.length
          )
        : 0;

    // 5. Critical & Overdue Gaps
    const todayStr = new Date().toISOString().slice(0, 10);
    const criticalOpenGaps = gaps.filter(
      (g) => g.riskLevel === 'CRITICAL' && g.status !== 'CLOSED' && !g.isOutOfScope
    ).length;
    const highOpenGaps = gaps.filter(
      (g) => g.riskLevel === 'HIGH' && g.status !== 'CLOSED' && !g.isOutOfScope
    ).length;
    const overdueGaps = gaps.filter(
      (g) =>
        g.status !== 'CLOSED' &&
        !g.isOutOfScope &&
        g.proposedDueDate &&
        String(g.proposedDueDate) < todayStr
    ).length;

    // 6. Documents Status
    const approvedDocs = documents.filter((d) => d.status === 'APPROVED').length;
    const expiredDocs = documents.filter(
      (d) => d.status === 'EXPIRED' || (d.expiryDate && String(d.expiryDate) < todayStr)
    ).length;
    const incompleteDocs = documents.filter((d) => d.status !== 'APPROVED').length;

    // 7. CAPA Effectiveness
    const closedCapa = capaItems.filter((c) => c.currentStage === 'CLOSED').length;
    const effectiveCapa = capaItems.filter((c) => c.isEffective === true).length;
    const capaEffectivenessRate =
      closedCapa > 0 ? Math.round((effectiveCapa / closedCapa) * 100) : 0;

    return {
      ccpsProgress,
      oshaProgress,
      unitProgress,
      completedTasks,
      remainingTasks,
      delayedTasks,
      avgScheduleVariance,
      criticalOpenGaps,
      highOpenGaps,
      overdueGaps,
      approvedDocs,
      expiredDocs,
      incompleteDocs,
      closedCapa,
      effectiveCapa,
      capaEffectivenessRate,
      studiesCount: studies.length,
      latestMaturity: maturityRecords[0] || null,
    };
  }, [projectData, availableUnits]);

  const handleWizardCreateProject = async (payload: PsmProjectFormPayload) => {
    try {
      setCreatingProject(true);
      const res = await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(
        payload.isDraft
          ? 'پیش‌نویس پروژه استقرار PSM در پایگاه داده ذخیره شد'
          : 'پروژه استقرار PSM ثبت نهایی شد و دروازه‌های کنترلی G1–G6 و برنامه WBS راه‌اندازی شدند'
      );
      setShowCreateProjectModal(false);
      await fetchBootstrap(res.project?.id || res.data?.id);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت پروژه PSM');
      throw err;
    } finally {
      setCreatingProject(false);
    }
  };

  const handleWizardUpdateProject = async (payload: PsmProjectFormPayload) => {
    if (!activeProject) return;
    try {
      await apiRequest(`/projects/${activeProject.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      toast.success(
        payload.isDraft
          ? 'تغییرات پیش‌نویس پروژه ذخیره شد'
          : 'مشخصات و منشور پروژه استقرار PSM با موفقیت به‌روزرسانی و همگام‌سازی شد'
      );
      setEditingProject(false);
      await fetchBootstrap(activeProject.id);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ذخیره تغییرات پروژه');
      throw err;
    }
  };

  const handleStartEditProject = () => {
    if (!activeProject) return;
    setEditProjectForm(activeProject);
    setEditingProject(true);
  };

  const handleCreateProcessAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    if (!newAssetForm.processUnitName.trim() || !newAssetForm.equipmentTag.trim() || !newAssetForm.equipmentName.trim()) {
      toast.error('نام واحد فرایندی، تگ تجهیز و نام تجهیز الزامی است');
      return;
    }
    try {
      await apiRequest(`/projects/${activeProject.id}/assets`, {
        method: 'POST',
        body: JSON.stringify({
          ...newAssetForm,
          projectId: activeProject.id,
          operationalArea: newAssetForm.operationalZone,
          equipmentClass: newAssetForm.equipmentType,
          designParameters: [newAssetForm.operatingPressureDesc, newAssetForm.operatingTempDesc].filter(Boolean).join(' | '),
          hazardousChemicals: newAssetForm.hazardousChemicalsText
            .split(/[،,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      toast.success('تجهیز فرایندی و ناحیه عملیاتی در ساختار پروژه ثبت شد');
      setShowNewAssetForm(false);
      setNewAssetForm({
        ...newAssetForm,
        equipmentTag: '',
        equipmentName: '',
        hazardousChemicalsText: '',
      });
      await fetchBootstrap(activeProject.id);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت تجهیز فرایندی');
    }
  };

  const handleDeleteProcessAsset = async (assetId: number) => {
    const confirmed = await showConfirmDialog('آیا از حذف این تجهیز از ساختار پروژه PSM اطمینان دارید؟', { isFa: true, variant: 'danger' });
    if (!confirmed) return;
    try {
      await apiRequest(`/assets/${assetId}`, { method: 'DELETE' });
      toast.success('تجهیز از ساختار دارایی‌های PSM حذف شد');
      await fetchBootstrap(activeProject?.id);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در حذف تجهیز');
    }
  };

  const handleToggleMilestone = async (index: number) => {
    if (!activeProject) return;
    const currentMilestones = Array.isArray(activeProject.milestones) ? [...activeProject.milestones] : [];
    if (!currentMilestones[index]) return;
    const ms = currentMilestones[index];
    const newStatus = ms.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
    currentMilestones[index] = { ...ms, status: newStatus };

    try {
      await apiRequest(`/projects/${activeProject.id}`, {
        method: 'PUT',
        body: JSON.stringify({ milestones: currentMilestones }),
      });
      toast.success(`وضعیت نقطه عطف به «${newStatus === 'COMPLETED' ? 'تکمیل‌شده' : 'در جریان'}» تغییر یافت`);
      await fetchBootstrap(activeProject.id);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در بروزرسانی نقطه عطف');
    }
  };

  const handleAddMilestone = async (title: string, targetDate?: string) => {
    if (!activeProject || !title.trim()) return;
    const currentMilestones = Array.isArray(activeProject.milestones) ? [...activeProject.milestones] : [];
    currentMilestones.push({
      id: `ms-${Date.now()}`,
      title: title.trim(),
      targetDate: targetDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: 'IN_PROGRESS',
    });

    try {
      await apiRequest(`/projects/${activeProject.id}`, {
        method: 'PUT',
        body: JSON.stringify({ milestones: currentMilestones }),
      });
      toast.success('نقطه عطف جدید به منشور پروژه افزوده شد');
      setNewMilestoneTitle('');
      setNewMilestoneDate('');
      await fetchBootstrap(activeProject.id);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت نقطه عطف');
    }
  };

  const handleOpenQuickAssessment = (
    standardType: 'CCPS_RBPS' | 'OSHA_1910_119',
    elementCode: string,
    existingRecord?: any
  ) => {
    const isOut = existingRecord
      ? Boolean(existingRecord.isOutOfScope ?? (existingRecord.isInScope === false))
      : false;
    const scoreVal = existingRecord
      ? Number(existingRecord.currentScore ?? existingRecord.complianceScore ?? 55)
      : 55;
    const reqScoreVal = existingRecord ? Number(existingRecord.requiredScore ?? 85) : 85;
    const evidenceArr = Array.isArray(existingRecord?.evidenceList)
      ? existingRecord.evidenceList
      : Array.isArray(existingRecord?.existingDocuments)
      ? existingRecord.existingDocuments
      : [];

    setAssessmentForm({
      standardType,
      elementCode,
      unitName:
        existingRecord?.unitName ||
        (selectedAssessmentUnit !== 'ALL' ? selectedAssessmentUnit : 'کل مجتمع'),
      complianceStatus: existingRecord?.complianceStatus || (scoreVal >= reqScoreVal ? 'COMPLIANT' : scoreVal >= 50 ? 'PARTIAL' : 'NON_COMPLIANT'),
      currentScore: scoreVal,
      requiredScore: reqScoreVal,
      maturityStage: Number(existingRecord?.maturityStage || 2),
      weight: Number(existingRecord?.weight || 5),
      strengths: existingRecord?.strengths || '',
      weaknesses: existingRecord?.weaknesses || existingRecord?.deficiencies || '',
      existingDocumentsText: evidenceArr.join('، '),
      missingDocumentsText: Array.isArray(existingRecord?.missingDocuments)
        ? existingRecord.missingDocuments.join('، ')
        : '',
      technicalEvidenceText: Array.isArray(existingRecord?.technicalEvidence)
        ? existingRecord.technicalEvidence.join('، ')
        : '',
      fieldObservations: existingRecord?.fieldObservations || existingRecord?.currentStatusDesc || '',
      assessorName:
        existingRecord?.assessorName ||
        currentUser?.fullName ||
        currentUser?.username ||
        '',
      assessmentDate:
        existingRecord?.assessmentDate || new Date().toISOString().slice(0, 10),
      isOutOfScope: isOut,
      outOfScopeJustification: existingRecord?.outOfScopeJustification || '',
      outOfScopeApprovedBy: existingRecord?.outOfScopeApprovedBy || '',
    });
    setShowAssessmentForm(true);
  };

  // Principle 2: Execute Context-Carrying Deep Link (Direct Navigation + Form Pre-Filling)
  const handleExecuteDeepLink = (deepLink: PsmDeepLinkAction) => {
    setActiveDeepLinkContext(deepLink);
    handleSelectSubTab(deepLink.targetSubTab);

    const p = deepLink.prefillData || {};
    if (deepLink.actionType === 'OPEN_CREATE_PROJECT') {
      setShowCreateProjectModal(true);
    } else if (deepLink.actionType === 'OPEN_EDIT_PROJECT') {
      if (activeProject) {
        setEditProjectForm({ ...activeProject });
        setEditingProject(true);
      }
    } else if (deepLink.actionType === 'OPEN_ASSESSMENT_FORM') {
      const std = p.standardType || 'CCPS_RBPS';
      const elCode = p.elementCode || 'CCPS-01';
      const existing = projectData.assessments.find((a) => a.elementCode === elCode);
      handleOpenQuickAssessment(std, elCode, existing);
    }
  };

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    if (assessmentForm.isOutOfScope) {
      if (assessmentForm.outOfScopeJustification.trim().length < 15 || !assessmentForm.outOfScopeApprovedBy.trim()) {
        toast.error('حذف هر عنصر از دامنه، بدون ثبت توجیه فنی مستند (حداقل ۱۵ کاراکتر) و نام تأییدکننده مجاز نیست');
        return;
      }
    }

    const catalogItem =
      assessmentForm.standardType === 'CCPS_RBPS'
        ? CCPS_20_ELEMENTS.find((el) => el.code === assessmentForm.elementCode)
        : OSHA_14_CLAUSES.find((cl) => cl.code === assessmentForm.elementCode);

    const pillarObj =
      assessmentForm.standardType === 'CCPS_RBPS' && catalogItem && 'pillarId' in catalogItem
        ? CCPS_PILLARS.find((p) => p.id === catalogItem.pillarId)
        : null;

    try {
      const res = await apiRequest(`/projects/${activeProject.id}/assessments`, {
        method: 'POST',
        body: JSON.stringify({
          standardType: assessmentForm.standardType,
          pillarCode: pillarObj?.id || null,
          pillarTitleFa: pillarObj?.titleFa || null,
          elementCode: assessmentForm.elementCode,
          elementTitleFa: catalogItem?.titleFa || assessmentForm.elementCode,
          elementTitleEn: catalogItem?.titleEn || assessmentForm.elementCode,
          unitName: assessmentForm.unitName,
          complianceStatus: assessmentForm.isOutOfScope ? 'OUT_OF_SCOPE' : assessmentForm.complianceStatus,
          currentScore: Number(assessmentForm.currentScore),
          requiredScore: Number(assessmentForm.requiredScore),
          maturityStage: Number(assessmentForm.maturityStage),
          weight: Number(assessmentForm.weight),
          strengths: assessmentForm.strengths,
          weaknesses: assessmentForm.weaknesses,
          existingDocuments: assessmentForm.existingDocumentsText
            .split(/[،,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          missingDocuments: assessmentForm.missingDocumentsText
            .split(/[،,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          technicalEvidence: assessmentForm.technicalEvidenceText
            .split(/[،,\n]/)
            .map((s) => s.trim())
            .filter(Boolean),
          fieldObservations: assessmentForm.fieldObservations,
          assessorName: assessmentForm.assessorName || currentUser?.fullName || currentUser?.username,
          assessmentDate: assessmentForm.assessmentDate,
          isOutOfScope: assessmentForm.isOutOfScope,
          outOfScopeJustification: assessmentForm.outOfScopeJustification,
          outOfScopeApprovedBy: assessmentForm.outOfScopeApprovedBy,
        }),
      });
      if (res.autoCreatedGap) {
        toast.success('ارزیابی ثبت شد و شکاف (Gap) متناظر به صورت خودکار استخراج گردید');
      } else {
        toast.success('ارزیابی عنصر PSM با موفقیت ثبت شد');
      }
      setShowAssessmentForm(false);
      await fetchBootstrap(activeProject.id);
    } catch (err: any) {
      toast.error(err?.message || 'خطا در ثبت ارزیابی');
    }
  };

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      {/* Top Executive Banner & Project Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-[11px] font-black">
                CCPS RBPS (20 Elements) & OSHA 29 CFR 1910.119 (14 Clauses)
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 leading-snug">
              <ShieldCheck className="w-6 h-6 text-blue-500 shrink-0" />
              <span>سیستم جامع مدیریت پروژه استقرار و بلوغ ایمنی فرایند (PSM)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              مدیریت یکپارچه چرخه استقرار از تعیین دامنه، ارزیابی اولیه، تحلیل شکاف، برنامه‌ریزی WBS/Gantt، بانک اسناد، گردش کار ۸ مرحله‌ای CAPA، ۱۴ زیرماژول تخصصی، ممیزی بلوغ و تحویل نهایی
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 max-w-full">
            {projects.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 max-w-full min-w-0">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">پروژه فعال:</span>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => handleSelectProject(Number(e.target.value))}
                  className="bg-transparent text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer min-w-0 truncate"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-white dark:bg-slate-900">
                      {p.code} — {p.name} ({p.overallProgress || 0}%)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => fetchBootstrap(selectedProjectId)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer shrink-0"
              title="همگام‌سازی زنده با پایگاه داده"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => handleSelectSubTab('comprehensive-guide')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-black transition cursor-pointer whitespace-nowrap ${
                activeSubTab === 'comprehensive-guide'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              }`}
              title="مشاهده راهنمای جامع استقرار PSM (۱۲ بخش آموزشی و عملیاتی)"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>راهنمای جامع</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateProjectModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>تعریف پروژه جدید استقرار PSM</span>
            </button>
          </div>
        </div>

        {/* 2-Tier Navigation: Tier 1 - Functional Zones */}
        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 min-w-0">
            {/* Zone Selector */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar p-1 bg-slate-100/80 dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
              {PSM_ZONES.map((zone) => {
                const ZoneIcon = zone.icon;
                const isZoneActive = activeZone === zone.key;
                const tabCount = zone.subTabs.length;
                return (
                  <button
                    key={zone.key}
                    type="button"
                    onClick={() => handleSelectZone(zone.key)}
                    className={`hse-motion-tab flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                      isZoneActive
                        ? 'bg-blue-600 text-white shadow-xs font-black'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <ZoneIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{zone.titleFa}</span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                        isZoneActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tabCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick-Jump direct switcher */}
            <div className="hidden sm:flex items-center gap-2 self-end lg:self-center">
              <span className="text-[11px] text-slate-400 whitespace-nowrap font-medium">پرش سریع به:</span>
              <select
                aria-label="پرش سریع به زیرماژول"
                value={activeSubTab}
                onChange={(e) => handleSelectSubTab(e.target.value as PsmSubTabKey)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold focus:ring-1 focus:ring-blue-500"
              >
                {PSM_NAVIGATION_TABS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.titleFa}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tier 2: Sub-tabs within the selected Zone */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {visibleSubTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSelectSubTab(tab.key)}
                  className={`hse-motion-tab flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-black'
                      : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.titleFa}</span>
                  {tab.badgeText && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {tab.badgeText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Guided Action Context & 1-Click Return Banner (Principle 2) */}
      {activeDeepLinkContext && activeSubTab !== 'command-center' && activeSubTab !== 'my-workspace' && (
        <div className="bg-gradient-to-l from-blue-500/15 via-white to-teal-500/15 dark:from-blue-950/40 dark:via-slate-900 dark:to-teal-950/30 border-2 border-blue-500/50 rounded-2xl p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-black text-blue-800 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
              <span>هدایت هوشمند سیستم (اصل دوم): اطلاعات پایه پروژه، واحد و مسئول به صورت خودکار در فرم آماده شد</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              {activeDeepLinkContext.contextHintFa}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveDeepLinkContext(null);
                handleSelectSubTab('command-center');
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:text-white text-white text-xs font-black transition cursor-pointer"
            >
              بازگشت به مسیر استقرار PSM
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveDeepLinkContext(null);
                handleSelectSubTab('my-workspace');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              بازگشت به کارهای من
            </button>
            <button
              type="button"
              onClick={() => setActiveDeepLinkContext(null)}
              className="px-2 py-1.5 rounded-lg text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              بستن راهنما
            </button>
          </div>
        </div>
      )}

      {/* Initial Skeleton Loading State when fetching PSM bootstrap */}
      {loading && projects.length === 0 ? (
        <PsmSubmoduleSkeleton />
      ) : (
        <SubViewTransition viewKey={activeSubTab} isFa={true}>
      {/* =================================================================
          GUIDED PSM COMMAND CENTER: مسیر استقرار PSM (فاز ۲، ۵، ۶، ۸، ۹)
         ================================================================= */}
      {activeSubTab === 'command-center' && (
        <PsmCommandCenter
          currentUser={currentUser}
          activeProject={activeProject}
          projectData={projectData}
          stageGates={projectData.stageGates || []}
          centralOrg={centralOrg}
          permissions={permissions}
          onExecuteDeepLink={handleExecuteDeepLink}
          onNavigateSubTab={handleSelectSubTab}
          onRefresh={() => fetchBootstrap(selectedProjectId)}
        />
      )}

      {/* =================================================================
          COMPREHENSIVE GUIDE TAB: راهنمای جامع استقرار PSM (۱۲ بخش)
         ================================================================= */}
      {activeSubTab === 'comprehensive-guide' && (
        <PsmComprehensiveGuide
          activeProject={activeProject}
          projectData={projectData}
          onNavigateSubTab={handleSelectSubTab}
          onExecuteDeepLink={handleExecuteDeepLink}
          onOpenCreateProjectModal={() => setShowCreateProjectModal(true)}
        />
      )}

      {/* Unified Empty State when no project exists yet (Zero Fake Data Policy) */}
      {!loading && projects.length === 0 && activeSubTab !== 'command-center' && activeSubTab !== 'project' && activeSubTab !== 'my-workspace' && activeSubTab !== 'comprehensive-guide' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-500">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="max-w-xl mx-auto space-y-1.5">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              نیاز به تعریف یا انتخاب پروژه استقرار PSM در پایگاه داده
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              مطابق سیاست داده واقعی سامانه، هیچ پروژه آزمایشی به صورت خودکار ایجاد نشده است. جهت پایش و ثبت اطلاعات در این زیرماژول، ابتدا اولین پروژه استقرار PSM مجتمع پتروشیمی رجال را با تعیین دامنه، مدیر پروژه، حامی و واحدهای مشمول تعریف نمایید.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateProjectModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تعریف پروژه جدید استقرار PSM</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectSubTab('project')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>ورود به تب مدیریت پروژه و دامنه شمول</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================
          PERSONAL WORKSPACE: کارهای من (کارتابل عملیاتی یکپارچه - بخش ۴)
         ================================================================= */}
      {activeSubTab === 'my-workspace' && (
        <PsmPersonalWorkspace
          currentUser={currentUser}
          activeProject={activeProject}
          projectData={projectData}
          onNavigateSubTab={handleSelectSubTab}
          onExecuteDeepLink={handleExecuteDeepLink}
          onRefresh={() => fetchBootstrap(selectedProjectId)}
          onRequestCreateGap={() => handleSelectSubTab('gap-analysis')}
          onRequestCreateDoc={() => handleSelectSubTab('documents')}
        />
      )}

      {/* =================================================================
          TAB 2: MAIN PROJECT & SCOPE MANAGEMENT (بند ۱)
          Accessible ALWAYS (whether projects exist or not)
         ================================================================= */}
      {activeSubTab === 'project' && (
        <div className="space-y-5">
          {/* Tab 2 Header Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-500" />
                  <span>مدیریت پروژه و دامنه شمول استقرار PSM (Project & Scope Governance)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  تعریف پروژه جدید، انتخاب پروژه فعال، مدیریت کد، دامنه شمول، مدیر و حامی، اعضای تیم، واحدهای مشمول و بودجه
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateProjectModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ تعریف پروژه جدید استقرار PSM</span>
                </button>
                {activeProject && !editingProject && (
                  <button
                    type="button"
                    onClick={handleStartEditProject}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    ویرایش مشخصات پروژه فعال
                  </button>
                )}
              </div>
            </div>

            {/* Directory of all registered PSM Projects */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FolderGit2 className="w-4 h-4 text-slate-500" />
                  <span>فهرست و بانک پروژه‌های استقرار PSM مجتمع ({projects.length} پروژه ثبت‌شده)</span>
                </h4>
                {projects.length > 1 && (
                  <span className="text-[11px] text-slate-400">
                    با انتخاب هر پروژه، کلیه زیرماژول‌ها و داده‌ها روی پروژه انتخاب‌شده تنظیم می‌شوند.
                  </span>
                )}
              </div>

              {projects.length === 0 ? (
                <div className="p-6 rounded-xl bg-blue-500/5 border border-dashed border-blue-500/30 text-center space-y-3">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                    در حال حاضر هیچ پروژه‌ای در پایگاه داده ثبت نشده است. می‌توانید با زدن دکمه زیر، اولین پروژه را تعریف و فعال نمایید:
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateProjectModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>تعریف و ایجاد اولین پروژه استقرار PSM</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projects.map((p) => {
                    const isCurrent = p.id === activeProject?.id;
                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-3 ${
                          isCurrent
                            ? 'bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/30'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/70 hover:border-slate-300'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              {p.code}
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                p.status === 'ACTIVE_SYSTEM'
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : 'bg-blue-500/10 text-blue-600'
                              }`}
                            >
                              {p.status === 'ACTIVE_SYSTEM' ? 'سیستم فعال' : 'در حال استقرار'}
                            </span>
                          </div>
                          <h5 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2">
                            {p.name}
                          </h5>
                          <div className="text-[11px] text-slate-500 space-y-0.5">
                            <div>مدیر: {p.projectManagerName || '—'}</div>
                            <div>حامی: {p.sponsorName || '—'}</div>
                          </div>
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>پیشرفت استقرار</span>
                              <span className="font-mono">{p.overallProgress || 0}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${p.overallProgress || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                          {isCurrent ? (
                            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              پروژه فعال کنونی
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSelectProject(p.id)}
                              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                            >
                              انتخاب این پروژه ←
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Charter View or Inline Project Creation Form */}
          {activeProject ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      شناسنامه و منشور پروژه فعال (PSM Charter)
                    </h3>
                    {(activeProject.overallStatus === 'DRAFT' || activeProject.status === 'DRAFT') && (
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 text-xs font-black">
                        پیش‌نویس (Draft)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    مدیریت یکپارچه کد، عنوان، تقویم شمسی، مدیر و حامی پروژه، اعضای تیم از پرسنل مجتمع، واحدهای مشمول از ساختار سازمانی، اهداف کمی/کیفی و نقاط عطف
                  </p>
                </div>
                {!editingProject && (
                  <div className="flex items-center gap-2">
                    {(activeProject.overallStatus === 'DRAFT' || activeProject.status === 'DRAFT') && (
                      <button
                        type="button"
                        onClick={handleStartEditProject}
                        className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black transition cursor-pointer"
                      >
                        تکمیل و ثبت نهایی پیش‌نویس
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleStartEditProject}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition cursor-pointer"
                    >
                      ویرایش هوشمند منشور پروژه
                    </button>
                  </div>
                )}
              </div>

              {!editingProject ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <div className="text-slate-400 font-bold">کد و عنوان رسمی پروژه</div>
                    <div className="font-black text-sm text-slate-900 dark:text-white">
                      {activeProject.code || activeProject.projectCode} — {activeProject.name || activeProject.title}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <div className="text-slate-400 font-bold">بازه زمانی پروژه (تقویم شمسی)</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      شروع: {activeProject.startDateShamsi || activeProject.startDate} | پایان: {activeProject.endDateShamsi || activeProject.endDate || '—'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <div className="text-slate-400 font-bold">مدیر پروژه و حامی (Sponsor) — متصل به پرسنل مجتمع</div>
                    <div className="font-bold text-slate-800 dark:text-slate-100">
                      مدیر: {activeProject.projectManagerName || '—'} (شناسه: #{activeProject.projectManagerId || 'مرکزی'}) | حامی: {activeProject.sponsorName || activeProject.projectSponsorName || '—'}
                    </div>
                  </div>

                  <div className="md:col-span-2 lg:col-span-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <div className="text-slate-400 font-bold">دامنه شمول پروژه (Project Scope)</div>
                    <div className="text-slate-800 dark:text-slate-100 leading-relaxed">
                      {activeProject.scope || activeProject.scopeDescription}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                    <div className="text-slate-400 font-bold">واحدهای مشمول پروژه (متصل به ساختار سازمانی)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(activeProject.coveredUnits) && activeProject.coveredUnits.length > 0 ? (
                        activeProject.coveredUnits.map((u: any, idx: number) => {
                          const isObj = typeof u === 'object' && u !== null;
                          const unitLabel = isObj ? u.name || u.unitName : String(u);
                          const isPrimary = isObj ? Boolean(u.isPrimary) : idx === 0;
                          return (
                            <span
                              key={idx}
                              title={isObj ? u.hierarchyPath : ''}
                              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 ${
                                isPrimary
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              <span>{unitLabel}</span>
                              <span className="text-[10px] opacity-85">
                                ({isPrimary ? 'واحد اصلی' : 'وابسته'})
                              </span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-slate-400">تمام واحدهای عملیاتی مجتمع</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2">
                    <div className="text-slate-400 font-bold">اعضای تیم استقرار PSM (متصل به پرسنل مجتمع)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(activeProject.teamMembers) && activeProject.teamMembers.length > 0 ? (
                        activeProject.teamMembers.map((m: any, idx: number) => {
                          const isObj = typeof m === 'object' && m !== null;
                          const label = isObj ? m.fullName || m.name : String(m);
                          const sub = isObj ? m.psmRole || m.jobTitle || m.role : '';
                          return (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 font-bold"
                            >
                              {label} {sub ? `(${sub})` : ''}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-slate-400">ثبت نشده</span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                    <div className="text-slate-400 font-bold">منابع و بودجه</div>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      تخصیص: {Number(activeProject.allocatedBudget || activeProject.budgetAllocated || 0).toLocaleString('fa-IR')} ریال
                    </div>
                    <div className="font-mono text-slate-600 dark:text-slate-300">
                      مصرف‌شده: {Number(activeProject.spentBudget || activeProject.budgetSpent || 0).toLocaleString('fa-IR')} ریال
                    </div>
                    {activeProject.resourcesSummary && (
                      <div className="text-slate-500 pt-1">{activeProject.resourcesSummary}</div>
                    )}
                  </div>

                  {/* Quantitative and Qualitative Goals */}
                  <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <Target className="w-4 h-4 text-blue-500" />
                          <span>اهداف کمی پروژه استقرار PSM ({Array.isArray(activeProject.quantitativeGoals) ? activeProject.quantitativeGoals.length : 0} شاخص)</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Quantitative Objectives</span>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Array.isArray(activeProject.quantitativeGoals) && activeProject.quantitativeGoals.length > 0 ? (
                          activeProject.quantitativeGoals.map((g: any, idx: number) => {
                            if (typeof g === 'string') {
                              return (
                                <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                                  {idx + 1}. {g}
                                </div>
                              );
                            }
                            return (
                              <div key={g.id || idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {idx + 1}. {g.title || g.objective}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-mono text-[10px] font-bold shrink-0">
                                    هدف: {g.targetValue ?? g.target ?? 100} {g.unit || '%'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                                  <span>مبنا: {g.baselineValue ?? 0}</span>
                                  <span>فعلی: {g.currentValue ?? 0}</span>
                                  {g.dueDate && <span>موعد: {g.dueDate}</span>}
                                  {g.responsiblePersonName && <span>مسئول: {g.responsiblePersonName}</span>}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-400">هدفی ثبت نشده است.</div>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-teal-500" />
                          <span>اهداف کیفی پروژه استقرار PSM ({Array.isArray(activeProject.qualitativeGoals) ? activeProject.qualitativeGoals.length : 0} هدف)</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Qualitative Objectives</span>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {Array.isArray(activeProject.qualitativeGoals) && activeProject.qualitativeGoals.length > 0 ? (
                          activeProject.qualitativeGoals.map((g: any, idx: number) => {
                            const titleStr = typeof g === 'string' ? g : g.title || g.objective;
                            const descStr = typeof g === 'object' && g ? g.description : '';
                            return (
                              <div key={idx} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {idx + 1}. {titleStr}
                                </div>
                                {descStr && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">{descStr}</div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-xs text-slate-400">هدفی ثبت نشده است.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Milestones Management Section */}
                  <div className="md:col-span-2 lg:col-span-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 dark:border-slate-700/70 pb-2.5">
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>مدیریت نقاط عطف پروژه استقرار (Project Milestones)</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          نقاط کنترل کلیدی پروژه متصل به برنامه زمان‌بندی WBS با تاریخ شمسی، مسئول تحقق و شواهد تأیید
                        </p>
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-500">
                        تکمیل‌شده:{' '}
                        {Array.isArray(activeProject.milestones)
                          ? activeProject.milestones.filter((m: any) => m.status === 'COMPLETED').length
                          : 0}{' '}
                        از {Array.isArray(activeProject.milestones) ? activeProject.milestones.length : 0}
                      </div>
                    </div>

                    {/* Milestones List */}
                    <div className="space-y-2">
                      {Array.isArray(activeProject.milestones) && activeProject.milestones.length > 0 ? (
                        activeProject.milestones.map((ms: any, idx: number) => {
                          const isDone = ms.status === 'COMPLETED';
                          return (
                            <div
                              key={ms.id || idx}
                              className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition ${
                                isDone
                                  ? 'bg-emerald-500/5 border-emerald-500/30'
                                  : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/80'
                              }`}
                            >
                              <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={() => handleToggleMilestone(idx)}
                                  className="rounded text-blue-500 focus:ring-blue-500"
                                />
                                <div>
                                  <div
                                    className={`font-bold text-xs ${
                                      isDone
                                        ? 'line-through text-slate-400'
                                        : 'text-slate-900 dark:text-white'
                                    }`}
                                  >
                                    {ms.title || ms}
                                  </div>
                                  {ms.description && (
                                    <div className="text-[11px] text-slate-500">{ms.description}</div>
                                  )}
                                </div>
                              </label>

                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                {ms.responsiblePersonName && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                    مسئول: {ms.responsiblePersonName}
                                  </span>
                                )}
                                {(ms.plannedDate || ms.targetDate) && (
                                  <span className="text-[10px] font-mono text-slate-500">
                                    موعد شمسی: {ms.plannedDate || ms.targetDate}
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isDone
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  {isDone ? 'تکمیل‌شده (100%)' : `در جریان (${ms.progressPct ?? 0}%)`}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-400 text-center py-2">
                          نقطه عطفی ثبت نشده است.
                        </div>
                      )}
                    </div>

                    {/* Add Milestone Form with Shamsi PersianDatePicker */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        placeholder="عنوان نقطه عطف جدید (مثلاً: تصویب گزارش تحلیل شکاف در کمیته راهبری)..."
                        value={newMilestoneTitle}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      <div className="w-48">
                        <PersianDatePicker
                          value={newMilestoneDate}
                          onChange={(val) => setNewMilestoneDate(val)}
                          placeholder="تاریخ برنامه‌ریزی (شمسی)"
                          minYear={1395}
                          maxYear={1425}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddMilestone(newMilestoneTitle, newMilestoneDate)}
                        disabled={!newMilestoneTitle.trim()}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black transition cursor-pointer shrink-0"
                      >
                        + افزودن نقطه عطف
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <PsmProjectFormWizard
                  mode="edit"
                  initialData={editProjectForm || activeProject}
                  centralOrg={centralOrg}
                  onSubmit={handleWizardUpdateProject}
                  onCancel={() => setEditingProject(false)}
                  isInline
                />
              )}
            </div>
          ) : (
            /* Inline Smart Project Creation Wizard inside Tab 2 when no project exists */
            <PsmProjectFormWizard
              mode="create"
              centralOrg={centralOrg}
              onSubmit={handleWizardCreateProject}
              isInline
            />
          )}
        </div>
      )}

      {/* Active Project Workspace */}
      {activeProject && (
        <>
          {/* =================================================================
              TAB 1: CONTROL & MONITORING DASHBOARD (بند ۹ و فاز ۲)
              Executive Dashboard with EVM, Predictive Alerts & Filters
             ================================================================= */}
          {activeSubTab === 'dashboard' && (
            <PsmExecutiveDashboard
              activeProject={activeProject}
              projectData={projectData}
              centralOrg={centralOrg}
              dashboardMetrics={dashboardMetrics}
              availableUnits={availableUnits}
              onNavigateSubTab={handleSelectSubTab}
              onExecuteDeepLink={handleExecuteDeepLink}
              onRefresh={() => fetchBootstrap(selectedProjectId)}
              onOpenCreateProjectModal={() => setShowCreateProjectModal(true)}
            />
          )}



          {/* =================================================================
              TAB 3: CENTRAL ORG STRUCTURE & PROCESS ASSETS (بند ۲)
             ================================================================= */}
          {activeSubTab === 'org-assets' && (
            <div className="space-y-5">
              {/* Live Integration Summary with Central HSECORE Modules */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Network className="w-4 h-4 text-teal-500" />
                      <span>یکپارچگی زنده با ساختار سازمانی مرکزی و ماژول‌های HSECORE</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      اطلاعات پرسنلی و ساختار سازمانی مستقیماً از ماژول مرکزی خوانده می‌شود و بدون تکرار داده به فرآیندهای PSM متصل است
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-black">
                    متصل به پایگاه داده مرکزی (Zero Data Duplication)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-slate-800 dark:text-white">
                      {centralOrg.companies.length || 1}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">شرکت / مجتمع</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-slate-800 dark:text-white">
                      {centralOrg.sites.length}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">سایت‌ها</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-slate-800 dark:text-white">
                      {centralOrg.departments.length}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">امور / دپارتمان‌ها</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-slate-800 dark:text-white">
                      {centralOrg.units.length}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">واحدهای عملیاتی</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-teal-600 dark:text-teal-400">
                      {centralOrg.personnel.length}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">پرسنل مرکزی</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                      {centralOrg.linkedModulesSummary?.workPermits || 0}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">پروانه‌های کار (PTW)</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                      {centralOrg.linkedModulesSummary?.incidents || 0}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">حوادث ثبت‌شده</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {centralOrg.linkedModulesSummary?.trainings || 0}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">دوره‌های آموزشی</div>
                  </div>
                </div>
              </div>

              {/* Process Units, Operational Zones & Safety-Critical Equipment */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      <span>ساختار واحدهای فرایندی، نواحی عملیاتی، تجهیزات بحرانی ایمنی (SCE) و مسئولان</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      ثبت تجهیزات فرایندی مشمول PSM، مواد شیمیایی خطرناک، شرایط عملیاتی (دما/فشار) و وضعیت اطلاعات ایمنی فرایند (PSI)
                    </p>
                  </div>
                  {permissions.canWrite && (
                    <button
                      type="button"
                      onClick={() => setShowNewAssetForm(!showNewAssetForm)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>ثبت تجهیز / ناحیه عملیاتی جدید</span>
                    </button>
                  )}
                </div>

                {showNewAssetForm && (
                  <form
                    onSubmit={handleCreateProcessAsset}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
                  >
                    <div>
                      <label className="block font-bold mb-1">واحد فرایندی *</label>
                      <input
                        type="text"
                        list="psm-units-list"
                        value={newAssetForm.processUnitName}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, processUnitName: e.target.value })}
                        placeholder="مثلاً: واحد پلیمریزاسیون"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">ناحیه عملیاتی (Operational Zone)</label>
                      <input
                        type="text"
                        value={newAssetForm.operationalZone}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, operationalZone: e.target.value })}
                        placeholder="مثلاً: سکشن راکتورهای خط A"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">تگ تجهیز (Tag No.) *</label>
                      <input
                        type="text"
                        value={newAssetForm.equipmentTag}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, equipmentTag: e.target.value })}
                        placeholder="مثلاً: R-201A"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">نام تجهیز *</label>
                      <input
                        type="text"
                        value={newAssetForm.equipmentName}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, equipmentName: e.target.value })}
                        placeholder="مثلاً: راکتور اصلی پلیمریزاسیون"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">نوع تجهیز</label>
                      <select
                        value={newAssetForm.equipmentType}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, equipmentType: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="REACTOR">راکتور فرایندی (Reactor)</option>
                        <option value="PRESSURE_VESSEL">مخزن تحت فشار (Pressure Vessel)</option>
                        <option value="STORAGE_TANK">مخزن ذخیره (Storage Tank)</option>
                        <option value="COMPRESSOR">کمپرسور گاز خطرناک (Compressor)</option>
                        <option value="COLUMN">برج تقطیر / تفکیک (Column)</option>
                        <option value="SIS_LOOP">حلقه ابزار دقیق ایمنی (SIS / ESD)</option>
                        <option value="RELIEF_VALVE">شیر اطمینان (PSV / PRV)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold mb-1">مواد شیمیایی خطرناک (پروپیلن، هیدروژن و...)</label>
                      <input
                        type="text"
                        value={newAssetForm.hazardousChemicalsText}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, hazardousChemicalsText: e.target.value })}
                        placeholder="پروپیلن، هگزان، کاتالیست..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">مسئول تجهیز (از پرسنل مرکزی)</label>
                      <input
                        type="text"
                        list="psm-personnel-list"
                        value={newAssetForm.responsiblePersonName}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, responsiblePersonName: e.target.value })}
                        placeholder="انتخاب مسئول..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">سطح بحران ایمنی (Safety Criticality)</label>
                      <select
                        value={newAssetForm.safetyCriticality}
                        onChange={(e) => setNewAssetForm({ ...newAssetForm, safetyCriticality: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="CRITICAL">بحرانی ایمنی (Safety Critical - SCE)</option>
                        <option value="HIGH">ریسک بالا (High Risk)</option>
                        <option value="MEDIUM">ریسک متوسط (Medium)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newAssetForm.psiCompleted}
                          onChange={(e) => setNewAssetForm({ ...newAssetForm, psiCompleted: e.target.checked })}
                          className="rounded text-blue-500"
                        />
                        <span className="font-bold">بسته اطلاعات ایمنی فرایند (PSI: PFD, P&ID, SDS) این تجهیز کامل است</span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowNewAssetForm(false)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700"
                        >
                          انصراف
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black cursor-pointer"
                        >
                          ثبت تجهیز در ساختار PSM
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Asset Search & Filter Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative min-w-[200px] flex-1 max-w-xs">
                      <input
                        type="text"
                        placeholder="جستجوی تگ (مثلاً R-201)، نام تجهیز یا ناحیه..."
                        value={assetSearchQuery}
                        onChange={(e) => setAssetSearchQuery(e.target.value)}
                        className="w-full pl-3 pr-8 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-blue-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                    </div>

                    <select
                      aria-label="فیلتر واحد عملیاتی"
                      value={assetUnitFilter}
                      onChange={(e) => setAssetUnitFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">همه واحدهای فرایندی ({availableUnits.length})</option>
                      {availableUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="فیلتر سطح بحرانی"
                      value={assetCriticalityFilter}
                      onChange={(e) => setAssetCriticalityFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">همه سطوح بحرانی</option>
                      <option value="CRITICAL">بحرانی ایمنی (SCE)</option>
                      <option value="HIGH">ریسک بالا (High)</option>
                      <option value="MEDIUM">ریسک متوسط (Medium)</option>
                    </select>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-400">
                    نمایش {filteredAssets.length} از {projectData.assets.length} تجهیز
                  </span>
                </div>

                {projectData.assets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                    <Cpu className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <div className="font-bold text-slate-600 dark:text-slate-300">
                      هنوز تجهیز فرایندی برای این پروژه ثبت نشده است.
                    </div>
                    <p className="text-[11px] text-slate-400">
                      با دکمه بالا تجهیزات بحرانی ایمنی (SCE) واحدهای مشمول مجتمع پتروشیمی رجال را ثبت کنید.
                    </p>
                  </div>
                ) : filteredAssets.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                    هیچ تجهیزی مطابق با فیلترها و کلمه جستجو شده یافت نشد.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold">
                          <th className="py-2.5 px-3">تگ تجهیز</th>
                          <th className="py-2.5 px-3">نام و مشخصات تجهیز</th>
                          <th className="py-2.5 px-3">واحد فرایندی / ناحیه</th>
                          <th className="py-2.5 px-3">سطح بحران (Criticality)</th>
                          <th className="py-2.5 px-3">شرایط عملیاتی (دما/فشار)</th>
                          <th className="py-2.5 px-3">مواد شیمیایی خطرناک</th>
                          <th className="py-2.5 px-3">مسئول مستقیم</th>
                          <th className="py-2.5 px-3">وضعیت PSI</th>
                          <th className="py-2.5 px-3 text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                        {filteredAssets.map((asset) => (
                          <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2.5 px-3 font-mono font-black text-blue-600 dark:text-blue-400">
                              {asset.equipmentTag}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {asset.equipmentName}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                کلاس: {asset.equipmentClass || asset.equipmentType || 'REACTOR'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {asset.processUnitName}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {asset.operationalArea || asset.operationalZone || 'ناحیه عملیاتی'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  asset.safetyCriticality === 'CRITICAL'
                                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                    : asset.safetyCriticality === 'HIGH'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                                }`}
                              >
                                {asset.safetyCriticality === 'CRITICAL'
                                  ? 'بحرانی ایمنی (SCE)'
                                  : asset.safetyCriticality === 'HIGH'
                                  ? 'ریسک بالا (High)'
                                  : 'ریسک متوسط (Medium)'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {asset.designParameters || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              {Array.isArray(asset.hazardousChemicals) && asset.hazardousChemicals.length > 0
                                ? asset.hazardousChemicals.join('، ')
                                : asset.hazardousSubstances || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                                <span>{asset.responsiblePersonName || '—'}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  asset.psiCompleted
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                }`}
                              >
                                {asset.psiCompleted ? 'PSI تکمیل‌شده' : 'در دست تکمیل PSI'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {permissions.canWrite && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProcessAsset(asset.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                                  title="حذف تجهیز از ساختار PSM"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 4: INITIAL ASSESSMENT & N:M TRACEABILITY MATRIX (بند ۳)
             ================================================================= */}
          {activeSubTab === 'assessment' && (
            <div className="space-y-5">
              {/* Assessment KPI Summary Cards */}
              {(() => {
                const ccpsRecords = projectData.assessments.filter(
                  (a) => (a.framework === 'CCPS_RBPS' || a.standardType === 'CCPS_RBPS' || String(a.elementCode || '').startsWith('CCPS-'))
                );
                const oshaRecords = projectData.assessments.filter(
                  (a) => (a.framework === 'OSHA_1910_119' || a.standardType === 'OSHA_1910_119' || String(a.elementCode || '').startsWith('OSHA-'))
                );
                const ccpsAssessedSet = new Set(ccpsRecords.map((a) => a.elementCode));
                const oshaAssessedSet = new Set(oshaRecords.map((a) => a.elementCode));
                const ccpsAvgScore =
                  ccpsRecords.length > 0
                    ? Math.round(
                        ccpsRecords.reduce((acc, r) => acc + Number(r.currentScore ?? r.complianceScore ?? 0), 0) /
                          ccpsRecords.length
                      )
                    : 0;
                const oshaAvgScore =
                  oshaRecords.length > 0
                    ? Math.round(
                        oshaRecords.reduce((acc, r) => acc + Number(r.currentScore ?? r.complianceScore ?? 0), 0) /
                          oshaRecords.length
                      )
                    : 0;
                const outOfScopeCount = projectData.assessments.filter(
                  (a) => Boolean(a.isOutOfScope ?? (a.isInScope === false))
                ).length;
                const autoExtractedGapsCount = projectData.gaps.filter((g) => Boolean(g.assessmentId)).length;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500">پوشش ارزیابی ۲۰ عنصر CCPS</div>
                        <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                          {ccpsAssessedSet.size} / 20
                        </div>
                        <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                          میانگین انطباق: {ccpsAvgScore}%
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <ClipboardCheck className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500">پوشش ارزیابی ۱۴ الزام OSHA</div>
                        <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                          {oshaAssessedSet.size} / 14
                        </div>
                        <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                          میانگین انطباق: {oshaAvgScore}%
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500">عناصر خارج از دامنه (مصوب)</div>
                        <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">
                          {outOfScopeCount} مورد
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          دارای توجیه فنی و تأیید مدیریت
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-500/10 text-slate-500 flex items-center justify-center">
                        <Layers className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500">شکاف‌های استخراج‌شده خودکار</div>
                        <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                          {autoExtractedGapsCount} شکاف
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectSubTab('gap-analysis')}
                          className="text-[11px] font-black text-teal-600 dark:text-teal-400 hover:underline mt-0.5 cursor-pointer"
                        >
                          مشاهده در تحلیل شکاف ←
                        </button>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Sub-mode Switcher: CCPS 20 Elements | OSHA 14 Clauses | N:M Traceability Matrix */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAssessmentStandardFilter('CCPS_RBPS')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      assessmentStandardFilter === 'CCPS_RBPS'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    ۲۰ عنصر CCPS RBPS (چهار رکن)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentStandardFilter('OSHA_1910_119')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      assessmentStandardFilter === 'OSHA_1910_119'
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    ۱۴ الزام اصلی OSHA 29 CFR 1910.119
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssessmentStandardFilter('MATRIX')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                      assessmentStandardFilter === 'MATRIX'
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    ماتریس تطبیق چندبه‌چند (N:M Traceability Matrix)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedAssessmentUnit}
                    onChange={(e) => setSelectedAssessmentUnit(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value="ALL">همه واحدها</option>
                    <option value="کل مجتمع">کل مجتمع</option>
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>

                  {permissions.canWrite && (
                    <button
                      type="button"
                      onClick={() => setShowAssessmentForm(!showAssessmentForm)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>ثبت / به‌روزرسانی ارزیابی عنصر</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Assessment Form Modal/Panel */}
              {showAssessmentForm && (
                <form
                  onSubmit={handleSaveAssessment}
                  className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 rounded-2xl p-5 space-y-4 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      فرم ارزیابی فنی عنصر PSM (با استخراج خودکار شکاف در صورت نمره کمتر از حد مطلوب)
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAssessmentForm(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
                    >
                      بستن ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold mb-1">مرجع استاندارد</label>
                      <select
                        value={assessmentForm.standardType}
                        onChange={(e) => {
                          const st = e.target.value as 'CCPS_RBPS' | 'OSHA_1910_119';
                          setAssessmentForm({
                            ...assessmentForm,
                            standardType: st,
                            elementCode: st === 'CCPS_RBPS' ? 'CCPS-01' : 'OSHA-01',
                          });
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="CCPS_RBPS">CCPS RBPS (۲۰ عنصر)</option>
                        <option value="OSHA_1910_119">OSHA 29 CFR 1910.119 (۱۴ الزام)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold mb-1">عنصر / الزام مورد ارزیابی</label>
                      <select
                        value={assessmentForm.elementCode}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, elementCode: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        {assessmentForm.standardType === 'CCPS_RBPS'
                          ? CCPS_20_ELEMENTS.map((el) => (
                              <option key={el.code} value={el.code}>
                                {el.code} — {el.titleFa} ({el.titleEn})
                              </option>
                            ))
                          : OSHA_14_CLAUSES.map((cl) => (
                              <option key={cl.code} value={cl.code}>
                                {cl.code} ({cl.cfrParagraph}) — {cl.titleFa} ({cl.titleEn})
                              </option>
                            ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold mb-1">واحد فرایندی / عملیاتی</label>
                      <input
                        type="text"
                        list="psm-units-list"
                        value={assessmentForm.unitName}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, unitName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">وضعیت انطباق</label>
                      <select
                        value={assessmentForm.complianceStatus}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, complianceStatus: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="COMPLIANT">منطبق (Compliant)</option>
                        <option value="PARTIAL">انطباق نسبی (Partial)</option>
                        <option value="NON_COMPLIANT">عدم انطباق (Non-Compliant)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold mb-1">امتیاز فعلی (0 تا 100)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={assessmentForm.currentScore}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, currentScore: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">امتیاز مطلوب هدف (Required)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={assessmentForm.requiredScore}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, requiredScore: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">سطح بلوغ عنصر (۱ تا ۵) و وزن</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={assessmentForm.maturityStage}
                          onChange={(e) => setAssessmentForm({ ...assessmentForm, maturityStage: Number(e.target.value) })}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                          title="سطح بلوغ ۱ تا ۵"
                        />
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={assessmentForm.weight}
                          onChange={(e) => setAssessmentForm({ ...assessmentForm, weight: Number(e.target.value) })}
                          className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                          title="وزن عنصر"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold mb-1">نقاط قوت شناسایی‌شده</label>
                      <input
                        type="text"
                        value={assessmentForm.strengths}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, strengths: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-bold mb-1">نقاط ضعف / شرح شکاف (مبنای تولید خودکار Gap)</label>
                      <input
                        type="text"
                        value={assessmentForm.weaknesses}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, weaknesses: e.target.value })}
                        placeholder="شرح دقیق نقص یا عدم انطباق مشاهده‌شده..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">مدارک موجود (جداشده با ویرگول)</label>
                      <input
                        type="text"
                        value={assessmentForm.existingDocumentsText}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, existingDocumentsText: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">مدارک کسری / مورد نیاز</label>
                      <input
                        type="text"
                        value={assessmentForm.missingDocumentsText}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, missingDocumentsText: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">شواهد فنی و مشاهدات میدانی</label>
                      <input
                        type="text"
                        value={assessmentForm.fieldObservations}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, fieldObservations: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-bold mb-1">نام ارزیاب (از پرسنل مرکزی)</label>
                      <input
                        type="text"
                        list="psm-personnel-list"
                        value={assessmentForm.assessorName}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, assessorName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  {/* Out-of-Scope Gate with Mandatory Technical Justification */}
                  <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/30 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assessmentForm.isOutOfScope}
                        onChange={(e) => setAssessmentForm({ ...assessmentForm, isOutOfScope: e.target.checked })}
                      />
                      <span className="font-black text-blue-700 dark:text-blue-300">
                        خارج از دامنه شمول (Out-of-Scope) — نیازمند ثبت توجیه فنی مستند و تأیید رسمی
                      </span>
                    </label>
                    {assessmentForm.isOutOfScope && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                        <div className="md:col-span-2">
                          <label className="block font-bold mb-1 text-blue-700 dark:text-blue-300">
                            توجیه فنی مستند (حداقل ۱۵ کاراکتر الزامی) *
                          </label>
                          <input
                            type="text"
                            value={assessmentForm.outOfScopeJustification}
                            onChange={(e) =>
                              setAssessmentForm({ ...assessmentForm, outOfScopeJustification: e.target.value })
                            }
                            placeholder="علت فنی عدم موضوعیت این الزام در واحد مورد نظر را به صورت مستند وارد کنید..."
                            className="w-full px-3 py-2 rounded-xl border border-blue-500/40 bg-white dark:bg-slate-900"
                            required
                          />
                        </div>
                        <div>
                          <label className="block font-bold mb-1 text-blue-700 dark:text-blue-300">
                            مقام تأییدکننده توجیه فنی *
                          </label>
                          <input
                            type="text"
                            list="psm-personnel-list"
                            value={assessmentForm.outOfScopeApprovedBy}
                            onChange={(e) =>
                              setAssessmentForm({ ...assessmentForm, outOfScopeApprovedBy: e.target.value })
                            }
                            placeholder="نام مدیر فنی / HSE..."
                            className="w-full px-3 py-2 rounded-xl border border-blue-500/40 bg-white dark:bg-slate-900"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAssessmentForm(false)}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black cursor-pointer"
                    >
                      ثبت ارزیابی و استخراج خودکار شکاف‌ها
                    </button>
                  </div>
                </form>
              )}

              {/* View 1: 20 CCPS Elements grouped by 4 Pillars */}
              {assessmentStandardFilter === 'CCPS_RBPS' && (
                <div className="space-y-4">
                  {CCPS_PILLARS.map((pillar) => {
                    const pillarElements = CCPS_20_ELEMENTS.filter((e) => e.pillarId === pillar.id);
                    return (
                      <div
                        key={pillar.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2.5">
                          <div>
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-black ml-2">
                              {pillar.id}
                            </span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">
                              {pillar.titleFa} ({pillar.titleEn})
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">{pillarElements.length} عنصر</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {pillarElements.map((el) => {
                            const records = projectData.assessments.filter(
                              (a) =>
                                a.elementCode === el.code &&
                                (selectedAssessmentUnit === 'ALL' || a.unitName === selectedAssessmentUnit)
                            );
                            const latest = records[0] || null;
                            const isOut = latest ? Boolean(latest.isOutOfScope ?? (latest.isInScope === false)) : false;
                            const scoreVal = latest ? Number(latest.currentScore ?? latest.complianceScore ?? 0) : 0;
                            const reqScoreVal = latest ? Number(latest.requiredScore ?? 85) : 85;
                            const weaknessText = latest ? (latest.weaknesses || latest.deficiencies || '') : '';

                            return (
                              <div
                                key={el.code}
                                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-2 flex flex-col justify-between"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-black">
                                          {el.code}
                                        </span>
                                        <span className="text-xs font-black text-slate-900 dark:text-white">
                                          {el.titleFa}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                        {el.titleEn} | مرجع رجال: {el.nationalAndRejalRef}
                                      </div>
                                    </div>
                                    {latest ? (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-black shrink-0 ${
                                          isOut
                                            ? 'bg-slate-500/10 text-slate-500'
                                            : scoreVal >= reqScoreVal
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                            : scoreVal >= 50
                                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                        }`}
                                      >
                                        {isOut ? 'خارج از دامنه' : `${scoreVal}% / هدف ${reqScoreVal}%`}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 text-[10px] shrink-0">
                                        ارزیابی‌نشده
                                      </span>
                                    )}
                                  </div>

                                  {latest && (
                                    <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                      <div>
                                        <span className="text-slate-400">واحد:</span> {latest.unitName} |{' '}
                                        <span className="text-slate-400">ارزیاب:</span> {latest.assessorName || '—'} |{' '}
                                        <span className="text-slate-400">تاریخ:</span> {latest.assessmentDate || '—'}
                                      </div>
                                      {weaknessText && (
                                        <div className="text-rose-600 dark:text-rose-400 font-medium">
                                          شکاف شناسایی‌شده: {weaknessText}
                                        </div>
                                      )}
                                      {isOut && latest.outOfScopeJustification && (
                                        <div className="text-blue-700 dark:text-blue-300">
                                          توجیه خارج از دامنه: {latest.outOfScopeJustification} (تأیید: {latest.outOfScopeApprovedBy})
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {permissions.canWrite && (
                                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">
                                      {el.requiredDocTemplates?.slice(0, 2).join('، ')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenQuickAssessment('CCPS_RBPS', el.code, latest)}
                                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 text-[10.5px] font-black transition cursor-pointer shrink-0"
                                    >
                                      {latest ? 'ویرایش ارزیابی عنصر' : '+ ثبت ارزیابی عنصر'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View 2: 14 OSHA 29 CFR 1910.119 Clauses */}
              {assessmentStandardFilter === 'OSHA_1910_119' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {OSHA_14_CLAUSES.map((cl) => {
                    const records = projectData.assessments.filter(
                      (a) =>
                        a.elementCode === cl.code &&
                        (selectedAssessmentUnit === 'ALL' || a.unitName === selectedAssessmentUnit)
                    );
                    const latest = records[0] || null;
                    const isOut = latest ? Boolean(latest.isOutOfScope ?? (latest.isInScope === false)) : false;
                    const scoreVal = latest ? Number(latest.currentScore ?? latest.complianceScore ?? 0) : 0;
                    const reqScoreVal = latest ? Number(latest.requiredScore ?? 85) : 85;
                    const weaknessText = latest ? (latest.weaknesses || latest.deficiencies || '') : '';

                    return (
                      <div
                        key={cl.code}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-2 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 font-mono text-[10px] font-black">
                                  {cl.code} — {cl.cfrParagraph}
                                </span>
                                <span className="text-xs font-black text-slate-900 dark:text-white">
                                  {cl.titleFa}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{cl.titleEn}</div>
                            </div>
                            {latest ? (
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-black shrink-0 ${
                                  isOut
                                    ? 'bg-slate-500/10 text-slate-500'
                                    : scoreVal >= reqScoreVal
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : scoreVal >= 50
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isOut ? 'خارج از دامنه' : `${scoreVal}% / هدف ${reqScoreVal}%`}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 text-[10px] shrink-0">
                                ارزیابی‌نشده
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{cl.defaultCriteriaFa}</p>
                          {latest && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              <div>
                                <span className="text-slate-400">واحد:</span> {latest.unitName} |{' '}
                                <span className="text-slate-400">ارزیاب:</span> {latest.assessorName || '—'}
                              </div>
                              {weaknessText && (
                                <div className="text-rose-600 dark:text-rose-400 font-medium">
                                  شکاف: {weaknessText}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {permissions.canWrite && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              {cl.requiredDeliverables?.slice(0, 2).join('، ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenQuickAssessment('OSHA_1910_119', cl.code, latest)}
                              className="px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-600 hover:text-white text-sky-600 dark:text-sky-400 text-[10.5px] font-black transition cursor-pointer shrink-0"
                            >
                              {latest ? 'ویرایش ارزیابی بند OSHA' : '+ ثبت ارزیابی بند OSHA'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View 3: Many-to-Many (N:M) Traceability Matrix between CCPS & OSHA */}
              {assessmentStandardFilter === 'MATRIX' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        ماتریس تطبیق چندبه‌چند (N:M Traceability Matrix) بین ۲۰ عنصر CCPS RBPS و ۱۴ الزام OSHA 1910.119
                      </h3>
                      <p className="text-xs text-slate-500">
                        تفکیک صریح ارتباط مستقیم (Direct Link) و ارتباط غیرمستقیم / پشتیبان (Indirect Link) همراه با وضعیت زنده انطباق در پروژه
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setMatrixFilterRelation('ALL')}
                        className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                          matrixFilterRelation === 'ALL'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        همه روابط ({CCPS_OSHA_TRACEABILITY_MATRIX.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatrixFilterRelation('DIRECT')}
                        className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                          matrixFilterRelation === 'DIRECT'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        مستقیم (DIRECT): {CCPS_OSHA_TRACEABILITY_MATRIX.filter((m) => m.relationType === 'DIRECT').length} رابطه
                      </button>
                      <button
                        type="button"
                        onClick={() => setMatrixFilterRelation('INDIRECT')}
                        className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                          matrixFilterRelation === 'INDIRECT'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                        }`}
                      >
                        غیرمستقیم (INDIRECT): {CCPS_OSHA_TRACEABILITY_MATRIX.filter((m) => m.relationType === 'INDIRECT').length} رابطه
                      </button>
                    </div>
                  </div>

                  {/* Matrix Search Bar */}
                  <div className="relative max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={matrixSearchQuery}
                      onChange={(e) => setMatrixSearchQuery(e.target.value)}
                      placeholder="جستجوی کد عنصر CCPS، بند OSHA یا منطق مهندسی..."
                      className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                          <th className="py-2.5 px-3">عنصر CCPS RBPS و وضعیت انطباق</th>
                          <th className="py-2.5 px-3">الزام OSHA 29 CFR 1910.119 و وضعیت</th>
                          <th className="py-2.5 px-3">نوع ارتباط (Direct / Indirect)</th>
                          <th className="py-2.5 px-3">منطق تطبیق مهندسی و ممیزی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                        {CCPS_OSHA_TRACEABILITY_MATRIX.filter((link) => {
                          if (matrixFilterRelation !== 'ALL' && link.relationType !== matrixFilterRelation) return false;
                          if (!matrixSearchQuery.trim()) return true;
                          const q = matrixSearchQuery.trim().toLowerCase();
                          const ccps = CCPS_20_ELEMENTS.find((e) => e.code === link.ccpsCode);
                          const osha = OSHA_14_CLAUSES.find((c) => c.code === link.oshaCode);
                          return (
                            link.ccpsCode.toLowerCase().includes(q) ||
                            link.oshaCode.toLowerCase().includes(q) ||
                            (ccps?.titleFa || '').toLowerCase().includes(q) ||
                            (osha?.titleFa || '').toLowerCase().includes(q) ||
                            link.rationaleFa.toLowerCase().includes(q)
                          );
                        }).map((link, idx) => {
                          const ccps = CCPS_20_ELEMENTS.find((e) => e.code === link.ccpsCode);
                          const osha = OSHA_14_CLAUSES.find((c) => c.code === link.oshaCode);
                          const ccpsAssessment = projectData.assessments.find((a) => a.elementCode === link.ccpsCode);
                          const oshaAssessment = projectData.assessments.find((a) => a.elementCode === link.oshaCode);
                          const ccpsScore = ccpsAssessment ? Number(ccpsAssessment.currentScore ?? ccpsAssessment.complianceScore ?? 0) : null;
                          const oshaScore = oshaAssessment ? Number(oshaAssessment.currentScore ?? oshaAssessment.complianceScore ?? 0) : null;

                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <span className="font-mono font-black text-blue-600 dark:text-blue-400 ml-1.5">
                                      {link.ccpsCode}
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                      {ccps?.titleFa}
                                    </span>
                                  </div>
                                  {ccpsScore !== null && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[10px] font-bold">
                                      {ccpsScore}%
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <span className="font-mono font-black text-sky-600 dark:text-sky-400 ml-1.5">
                                      {link.oshaCode} ({osha?.cfrParagraph})
                                    </span>
                                    <span className="font-bold text-slate-800 dark:text-slate-100">
                                      {osha?.titleFa}
                                    </span>
                                  </div>
                                  {oshaScore !== null && (
                                    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono text-[10px] font-bold">
                                      {oshaScore}%
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-black ${
                                    link.relationType === 'DIRECT'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  {link.relationType === 'DIRECT'
                                    ? 'ارتباط مستقیم (DIRECT)'
                                    : 'ارتباط غیرمستقیم (INDIRECT)'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {link.rationaleFa}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              TABS 5 TO 12: DELEGATED TO PsmSubViews
             ================================================================= */}
          {['stage-gates', 'gap-analysis', 'wbs-gantt', 'documents', 'capa', 'studies', 'maturity', 'handover', 'ai-audit'].includes(
            activeSubTab
          ) && (
            <PsmSubViews
              activeSubTab={activeSubTab}
              activeProject={activeProject}
              projectData={projectData}
              centralOrg={centralOrg}
              auditLogs={auditLogs}
              permissions={permissions}
              apiRequest={apiRequest}
              onRefresh={() => fetchBootstrap(activeProject.id)}
              availableUnits={availableUnits}
              activeDeepLinkContext={activeDeepLinkContext}
              onClearDeepLinkContext={() => setActiveDeepLinkContext(null)}
              onExecuteDeepLink={handleExecuteDeepLink}
            />
          )}
        </>
      )}
        </SubViewTransition>
      )}

      {/* Create New PSM Project Smart Wizard Modal */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs animate-fade-in flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-5xl w-full my-8 animate-scaleIn">
            <PsmProjectFormWizard
              mode="create"
              centralOrg={centralOrg}
              onSubmit={handleWizardCreateProject}
              onCancel={() => setShowCreateProjectModal(false)}
            />
          </div>
        </div>
      )}

      {/* Single Canonical Datalists for Central Personnel and Central Organizational Units */}
      <datalist id="psm-personnel-list">
        {centralOrg.personnel.map((p: any) => (
          <option
            key={p.id || p.personnelCode}
            value={p.fullName}
          >{`${p.fullName} (${p.personnelCode || ''} - ${p.unit || p.department || ''})`}</option>
        ))}
      </datalist>

      <datalist id="psm-units-list">
        {availableUnits.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
}
