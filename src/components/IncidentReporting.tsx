import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile, SafetyIncidentRecord } from '../types';
import { downloadCsvFile } from '../utils/fileHelpers';
import { 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  Plus, 
  Search, 
  Download, 
  UserX, 
  BarChart3, 
  Eye, 
  Edit3,
  Trash2, 
  Layers, 
  Printer, 
  Clock,
  Send,
  History,
  Inbox
} from 'lucide-react';
import { HseIncidentCategoryItem, DEFAULT_INCIDENT_TYPES } from './OrganizationMgmt';
import WorkshopSafetyPyramid from './incident/WorkshopSafetyPyramid';
import IncidentSupplementaryModal from './incident/IncidentSupplementaryModal';
import { RhsF68ReportWizardModal } from './incident/RhsF68ReportWizardModal';
import { RhsF68DetailWorkflowModal } from './incident/RhsF68DetailWorkflowModal';
import { RhsF68PrintViewModal } from './incident/RhsF68PrintViewModal';
import { RhsF68AnalyticsPanel } from './incident/RhsF68AnalyticsPanel';
import { RhsF34DashboardPanel } from './incident/RhsF34DashboardPanel';
import { RhsF28ReportModal } from './incident/RhsF28ReportModal';
import { RhsF28DetailModal } from './incident/RhsF28DetailModal';
import { RhsF28PrintViewModal } from './incident/RhsF28PrintViewModal';
import {
  WORKFLOW_STAGE_META,
  computeRhsF68Rpn,
  getCorrectiveOverdueInfo,
  getIncidentWorkflowStage,
} from '../utils/rhsF68Config';
import PersianDatePicker from './common/PersianDatePicker';
import PersianTimePicker from './common/PersianTimePicker';
import DualDateBadge from './common/DualDateBadge';
import { 
  getSupplementaryFormByIncidentId, 
  calculateDeadlineInfo 
} from '../utils/incidentSupplementaryHelper';
import { SubViewTransition } from '../motion';
import { apiDb } from '../services/apiDatabaseClient';
import { useUnifiedOrgUnits } from '../utils/orgUnitsHelper';
import { CreateReferralModal } from './referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from './referral/DocumentWorkflowTrackerModal';
import { toast } from 'react-hot-toast';
import { handleVersionConflict } from './common/ConflictResolutionModal';

interface IncidentReportingProps {
  isFa: boolean;
  currentUser: UserProfile;
}

export default function IncidentReporting({ isFa, currentUser }: IncidentReportingProps) {
  const [activeTab, setActiveTab] = useState<'reports' | 'pyramid' | 'osha_300' | 'stats'>('reports');
  const [statsSubView, setStatsSubView] = useState<'all' | 'analytics' | 'overdue' | 'f34'>('all');

  // Unified Department / Units List derived strictly from Org Structure in System Settings
  const { units: unifiedOrgUnits } = useUnifiedOrgUnits();
  const departmentList = useMemo<string[]>(() => {
    return Array.from(new Set(unifiedOrgUnits.map(u => u.name).filter(Boolean)));
  }, [unifiedOrgUnits]);

  // Incidents State
  const [incidents, setIncidents] = useState<SafetyIncidentRecord[]>([]);

  const saveIncidentsToStorage = (updated: SafetyIncidentRecord[]) => {
    setIncidents(updated);
  };

  const loadIncidents = async () => {
    try {
      const dbIncidents = await apiDb.getIncidents();
      if (Array.isArray(dbIncidents)) {
        const mapped: SafetyIncidentRecord[] = dbIncidents.map((r: any) => {
          const rawData = r.incidentData || r.payload || {};
          const rhs = r.rhsF68 || rawData.rhsF68;
          const rawRisk = rhs?.riskAssessment || r.riskAssessment || rawData.riskAssessment;
          const normalizedRisk = rawRisk
            ? (() => {
                const p = Number(rawRisk.probability) || 1;
                const s = Number(rawRisk.severity) || 1;
                const d = Number(rawRisk.detection) || 1;
                const computed = computeRhsF68Rpn(p, s, d);
                return {
                  probability: p,
                  severity: s,
                  detection: d,
                  envSeverity: rawRisk.envSeverity,
                  rpn: Number(rawRisk.rpn) || computed.rpn,
                  riskLevel: rawRisk.riskLevel || computed.riskLevel,
                  riskLevelFa: rawRisk.riskLevelFa || computed.riskLevelFa,
                  riskLevelColor: rawRisk.riskLevelColor || computed.color,
                };
              })()
            : undefined;

          return {
            id: String(r.id),
            formVariant: r.formVariant || rawData.formVariant || (r.rhsF28 || rawData.rhsF28 ? 'RHS-F28' : 'RHS-F68'),
            reportNumber: r.reportNumber || r.incidentNumber || `RHS-F68-${r.id}`,
            category: r.category || rawData.category || r.incidentType || 'Unsafe Act',
            categoryFa:
              r.categoryFa ||
              rawData.categoryFa ||
              (r.incidentType === 'NEAR_MISS'
                ? 'شبه حادثه'
                : r.incidentType === 'UNSAFE_ACT'
                ? 'عمل ناایمن'
                : r.incidentType === 'UNSAFE_CONDITION'
                ? 'شرایط ناایمن'
                : 'حادثه'),
            incidentTypeId: r.incidentTypeId || rawData.incidentTypeId || '',
            title: r.title || r.description || '',
            reportDate: r.reportDate || r.rhsF28?.reportDate || rhs?.reportDate || '',
            eventDate: r.eventDate || r.incidentDate || '',
            eventTime: r.eventTime || r.incidentTime || '10:00',
            companyName: r.companyName || rhs?.companyName || rawData.companyName || '',
            locationSite: r.locationSite || r.location || '',
            exactLocation: r.exactLocation || rhs?.exactLocation || rawData.exactLocation || '',
            department: r.department || rawData.department || '',
            reporterPersonnelCode: r.reporterPersonnelCode || rawData.reporterPersonnelCode || '',
            reporterName: r.reporterName || r.personnelName || '',
            reporterJobTitle: r.reporterJobTitle || rhs?.reporterJobTitle || rawData.reporterJobTitle || '',
            reporterRole: r.reporterRole || rawData.reporterRole || 'User',
            riskAssessment: normalizedRisk,
            description: r.description || r.title || '',
            immediateActionTaken: r.immediateActionTaken || r.immediateCauses || rawData.immediateActions || '',
            severity: r.severity || 'Minor / First Aid',
            isOshaRecordable: Boolean(
              r.isOshaRecordable !== undefined
                ? r.isOshaRecordable
                : r.lostWorkDays > 0 || r.severity === 'FATALITY' || r.severity === 'LOST_TIME_INJURY'
            ),
            lostDays: Number(r.lostDays ?? r.lostWorkDays ?? 0) || 0,
            injuredPersonName: r.injuredPersonName || rawData.injuredPersonName || '',
            injuredPersonCode: r.injuredPersonCode || rawData.injuredPersonCode || '',
            bodyPartAffected: r.bodyPartAffected || rawData.bodyPartAffected || 'None',
            medicalTreatmentType: r.medicalTreatmentType || rawData.medicalTreatmentType || 'N/A',
            rootCauses:
              typeof r.rootCauses === 'object' && r.rootCauses !== null && !Array.isArray(r.rootCauses)
                ? r.rootCauses
                : {
                    humanFactors: Array.isArray(r.rootCauses) ? r.rootCauses : [],
                    equipmentFactors: [],
                    environmentalFactors: [],
                    systemicFactors: [],
                  },
            fiveWhys: r.fiveWhys || rawData.fiveWhys || [],
            toxicGasLeak: r.toxicGasLeak || rawData.toxicGasLeak || undefined,
            capaList:
              r.capaList ||
              rawData.capaActions ||
              (r.correctiveActions
                ? [{ id: '1', description: r.correctiveActions, responsiblePerson: '', targetDate: '', status: 'Open' }]
                : []),
            status: r.status || 'Submitted',
            workflowStage: r.workflowStage || rawData.workflowStage || rhs?.workflowStage,
            isDraft: Boolean(r.isDraft ?? rawData.isDraft),
            attachedFileIds: Array.isArray(r.attachedFileIds)
              ? r.attachedFileIds
              : Array.isArray(rawData.attachedFileIds)
              ? rawData.attachedFileIds
              : [],
            rhsF68: rhs,
            rhsF28: r.rhsF28 || rawData.rhsF28,
            supplementaryForm: r.supplementaryForm || rawData.supplementaryForm,
            supplementaryFormId:
              r.supplementaryFormId || r.supplementaryForm?.id || rawData.supplementaryForm?.id,
            supplementaryFormStatus:
              r.supplementaryFormStatus || r.supplementaryForm?.status || rawData.supplementaryForm?.status,
            version: r.version,
            updatedAt: r.updatedAt,
            createdDate: r.createdDate || (r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : ''),
          };
        });
        saveIncidentsToStorage(mapped);
        setSelectedIncidentForDetail((curr) => {
          if (!curr) return null;
          return mapped.find((m) => m.id === curr.id || m.reportNumber === curr.reportNumber) || curr;
        });
        setSelectedIncidentForSupplementary((curr) => {
          if (!curr) return null;
          return mapped.find((m) => m.id === curr.id || m.reportNumber === curr.reportNumber) || curr;
        });
      }
    } catch (err) {
      console.warn('Failed to load incidents from backend:', err);
    }
  };

  useEffect(() => {
    loadIncidents();

    const handleDataMutated = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('incident')) {
        loadIncidents();
      }
    };
    window.addEventListener('hse_data_mutated', handleDataMutated);
    window.addEventListener('app_data_mutated', handleDataMutated);
    window.addEventListener('hse_incidents_updated', loadIncidents);
    return () => {
      window.removeEventListener('hse_data_mutated', handleDataMutated);
      window.removeEventListener('app_data_mutated', handleDataMutated);
      window.removeEventListener('hse_incidents_updated', loadIncidents);
    };
  }, []);

  // Deep-link report opener (#incidents?report=RHS-F28-...&openF34=1)
  const extractDeepLinkFromHash = () => {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return { report: '', openF34: false };
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    return {
      report: (params.get('report') || '').trim(),
      openF34: params.get('openF34') === '1' || params.get('openF34') === 'true',
    };
  };
  const [pendingDeepLink, setPendingDeepLink] = useState<{ report: string; openF34: boolean }>(() =>
    extractDeepLinkFromHash()
  );

  useEffect(() => {
    const onHashChange = () => {
      const target = extractDeepLinkFromHash();
      if (target.report) {
        setActiveTab('reports');
        setPendingDeepLink(target);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!pendingDeepLink.report || incidents.length === 0) return;
    const match = incidents.find(
      (inc) =>
        inc.reportNumber?.toLowerCase() === pendingDeepLink.report.toLowerCase() ||
        String(inc.id) === pendingDeepLink.report
    );
    if (match) {
      setActiveTab('reports');
      if (pendingDeepLink.openF34) {
        setSelectedIncidentForSupplementary(match);
      } else {
        setSelectedIncidentForDetail(match);
      }
      setPendingDeepLink({ report: '', openF34: false });
      try {
        if (window.location.hash.includes('?')) {
          window.history.replaceState(null, '', '#incidents');
        }
      } catch {}
    }
  }, [incidents, pendingDeepLink]);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('ALL');
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState<boolean>(false);
  const [onlyMyInboxFilter, setOnlyMyInboxFilter] = useState<boolean>(false);

  // Modals
  const [showTypeChooserModal, setShowTypeChooserModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingDraft, setEditingDraft] = useState<SafetyIncidentRecord | null>(null);
  const [showNewF28Modal, setShowNewF28Modal] = useState(false);
  const [editingF28Draft, setEditingF28Draft] = useState<SafetyIncidentRecord | null>(null);
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState<SafetyIncidentRecord | null>(null);
  const [selectedIncidentForSupplementary, setSelectedIncidentForSupplementary] = useState<SafetyIncidentRecord | null>(null);
  const [printTargetIncident, setPrintTargetIncident] = useState<SafetyIncidentRecord | null>(null);

  // State for Editing legacy incident details (Admin only)
  const [editingIncident, setEditingIncident] = useState<SafetyIncidentRecord | null>(null);

  // State for Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  const handleDeleteIncident = (id: string) => {
    const roleUpper = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
    const canDelete = ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'SAFETYOFFICER', 'EXECUTIVEMANAGER'].includes(roleUpper) ||
                      roleUpper.includes('ADMIN') ||
                      roleUpper.includes('مدیر') ||
                      Boolean(currentUser?.permissions?.Incidents?.delete);

    if (!canDelete) {
      toast.error(isFa ? 'تنها مدیر ارشد و سرپرستان مجاز سیستم دسترسی حذف این اطلاعات را دارند.' : 'Only authorized managers and administrators can delete this record.');
      return;
    }
    const incident = incidents.find(i => i.id === id || i.reportNumber === id);
    const incidentTitle = incident ? `${incident.reportNumber ? incident.reportNumber + ' - ' : ''}${incident.title}` : id;

    setDeleteConfirm({
      title: isFa ? `آیا از حذف قطعی گزارش حادثه / ناهنجاری "${incidentTitle}" اطمینان دارید؟` : `Delete safety incident report "${incidentTitle}"?`,
      description: isFa ? 'این عملیات غیرقابل بازگشت است و رکورد مربوطه به صورت کامل از پایگاه داده و سامانه پاک خواهد شد.' : 'This action cannot be undone and the record will be permanently deleted from the database.',
      onConfirm: async () => {
        // 1. Immediately update state and storage
        setIncidents(prev => {
          const updated = prev.filter(i => String(i.id) !== String(id) && String(i.reportNumber) !== String(id));
          saveIncidentsToStorage(updated);
          return updated;
        });
        if (selectedIncidentForDetail?.id === id || selectedIncidentForDetail?.reportNumber === id) {
          setSelectedIncidentForDetail(null);
        }
        setDeleteConfirm(null);

        // 2. Perform deletion on database backend and clear caches
        try {
          await apiDb.deleteIncident(id);
          if (incident?.reportNumber && String(incident.reportNumber) !== String(id)) {
            await apiDb.deleteIncident(incident.reportNumber).catch(() => {});
          }
        } catch (e: any) {
          console.error('Error deleting incident from database:', e);
          toast.error(e?.message || (isFa ? 'خطا در حذف حادثه از پایگاه داده' : 'Database delete error'));
          loadIncidents();
        }
      }
    });
  };

  const handleStartEditIncident = (row: SafetyIncidentRecord) => {
    const roleUpper = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
    const canEdit = ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'SAFETYOFFICER', 'EXECUTIVEMANAGER'].includes(roleUpper) ||
                    roleUpper.includes('ADMIN') ||
                    roleUpper.includes('مدیر') ||
                    Boolean(currentUser?.permissions?.Incidents?.edit);

    if (!canEdit) {
      toast.error(isFa ? 'تنها مدیر ارشد و سرپرستان مجاز سیستم دسترسی ویرایش این اطلاعات را دارند.' : 'Only authorized managers and administrators can edit this record.');
      return;
    }
    setEditingIncident({ ...row });
  };

  const handleSaveEditedIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident) return;
    const roleUpper = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
    const canEdit = ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'SAFETYOFFICER', 'EXECUTIVEMANAGER'].includes(roleUpper) ||
                    roleUpper.includes('ADMIN') ||
                    roleUpper.includes('مدیر') ||
                    Boolean(currentUser?.permissions?.Incidents?.edit);

    if (!canEdit) {
      toast.error(isFa ? 'تنها مدیر ارشد و سرپرستان مجاز سیستم دسترسی ویرایش این اطلاعات را دارند.' : 'Only authorized managers and administrators can edit this record.');
      return;
    }
    try {
      await apiDb.saveIncident(editingIncident);
    } catch (err: any) {
      if (err?.status === 409 || err?.code === 'VERSION_CONFLICT') {
        await handleVersionConflict(err, {
          localRecord: editingIncident,
          onReloadLatest: () => {
            loadIncidents();
            setEditingIncident(null);
          },
        });
        return;
      }
      toast.error(err?.message || (isFa ? 'خطا در ذخیره‌سازی ویرایش حادثه در پایگاه داده' : 'Failed to save incident'));
      return;
    }
    setIncidents(prev => {
      const updated = prev.map(i => i.id === editingIncident.id ? editingIncident : i);
      saveIncidentsToStorage(updated);
      return updated;
    });
    if (selectedIncidentForDetail?.id === editingIncident.id) {
      setSelectedIncidentForDetail(editingIncident);
    }
    setEditingIncident(null);
  };

  // Referral and Workflow Tracker Modals
  const [referralTargetIncident, setReferralTargetIncident] = useState<SafetyIncidentRecord | null>(null);
  const [trackerTargetIncident, setTrackerTargetIncident] = useState<SafetyIncidentRecord | null>(null);

  // Load HSE Incident Categories from PostgreSQL Organization Settings
  const [configuredIncidentTypes, setConfiguredIncidentTypes] = useState<HseIncidentCategoryItem[]>(DEFAULT_INCIDENT_TYPES);

  useEffect(() => {
    let mounted = true;
    const loadIncidentTypes = () => {
      apiDb.getSetting('hse_incident_types_config').then((saved) => {
        if (mounted && Array.isArray(saved) && saved.length > 0) {
          setConfiguredIncidentTypes(saved);
        }
      }).catch(() => {});
    };
    loadIncidentTypes();
    window.addEventListener('hse_data_mutated', loadIncidentTypes);
    return () => {
      mounted = false;
      window.removeEventListener('hse_data_mutated', loadIncidentTypes);
    };
  }, []);

  // Filtered Records & Overdue count
  const [incidentPage, setIncidentPage] = useState<number>(1);
  const [incidentPageSize, setIncidentPageSize] = useState<number>(25);

  const roleUpperForInbox = (currentUser?.role || '').toUpperCase().replace(/[\s_]+/g, '');
  const isHseHeadUser =
    ['ADMIN', 'ADMINISTRATOR', 'HSEMANAGER', 'EXECUTIVEMANAGER'].includes(roleUpperForInbox) ||
    roleUpperForInbox.includes('ADMIN') ||
    Boolean(currentUser?.permissions?.Incidents?.approve);
  const isHseStaffUser =
    isHseHeadUser ||
    ['SAFETYOFFICER', 'SAFETYINSPECTOR', 'FIREOFFICER'].includes(roleUpperForInbox) ||
    (currentUser?.jobTitle || '').toLowerCase().includes('hse') ||
    (currentUser?.jobTitle || '').includes('ایمنی') ||
    Boolean(currentUser?.permissions?.Incidents?.edit);

  const isMyActionableIncident = (item: SafetyIncidentRecord): boolean => {
    const stage = getIncidentWorkflowStage(item);
    if (stage === 'CLOSED') return false;
    const pCode = currentUser?.personnelNumber || '';
    const uName = currentUser?.fullName || '';
    const uLogin = currentUser?.username || '';
    const matchesIdentity = (code?: string, name?: string) =>
      (Boolean(code) && Boolean(pCode) && code === pCode) ||
      (Boolean(name) && (name === uName || name === uLogin));

    if (stage === 'DRAFT' || stage === 'RETURNED') {
      return matchesIdentity(item.reporterPersonnelCode, item.reporterName);
    }
    if (stage === 'HSE_HEAD_TRIAGE' || stage === 'HSE_FINAL_APPROVAL') {
      return isHseHeadUser;
    }
    if (stage === 'HSE_EXPERT_REVIEW') {
      const expCode = item.rhsF68?.hseUnitReview?.assignedExpertCode;
      const expName = item.rhsF68?.hseUnitReview?.assignedExpertName;
      if (expCode || expName) {
        return matchesIdentity(expCode, expName) || isHseHeadUser;
      }
      return isHseStaffUser;
    }
    if (stage === 'ACTION_IN_PROGRESS') {
      const offCode = item.rhsF68?.correctiveFollowUp?.responsiblePersonnelCode;
      const offName = item.rhsF68?.correctiveFollowUp?.responsiblePerson;
      if (offCode || offName) {
        return matchesIdentity(offCode, offName) || isHseHeadUser;
      }
      return isHseStaffUser;
    }
    return false;
  };

  const overdueCount = useMemo(
    () => incidents.filter((item) => getCorrectiveOverdueInfo(item).isOverdue).length,
    [incidents]
  );

  const myInboxCount = useMemo(
    () => incidents.filter((item) => isMyActionableIncident(item)).length,
    [incidents, currentUser]
  );

  const filteredIncidents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return incidents.filter((item) => {
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.reportNumber.toLowerCase().includes(q) ||
        (item.locationSite || '').toLowerCase().includes(q) ||
        (item.department || '').toLowerCase().includes(q) ||
        (item.reporterName || '').toLowerCase().includes(q) ||
        (item.reporterPersonnelCode && item.reporterPersonnelCode.toLowerCase().includes(q));

      const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchSeverity = severityFilter === 'ALL' || item.severity === severityFilter;
      const stage = getIncidentWorkflowStage(item);
      const matchStage = stageFilter === 'ALL' || stage === stageFilter;

      const rpnVal = item.riskAssessment?.rpn ?? item.rhsF68?.riskAssessment?.rpn;
      const rpnLevel =
        item.riskAssessment?.riskLevel ||
        item.rhsF68?.riskAssessment?.riskLevel ||
        (typeof rpnVal === 'number'
          ? rpnVal >= 50
            ? 'E'
            : rpnVal >= 25
            ? 'H'
            : rpnVal >= 11
            ? 'M'
            : 'L'
          : undefined);
      const matchRisk = riskLevelFilter === 'ALL' || rpnLevel === riskLevelFilter;
      const matchOverdue = !onlyOverdueFilter || getCorrectiveOverdueInfo(item).isOverdue;
      const matchMyInbox = !onlyMyInboxFilter || isMyActionableIncident(item);

      return matchSearch && matchCategory && matchSeverity && matchStage && matchRisk && matchOverdue && matchMyInbox;
    });
  }, [incidents, searchTerm, categoryFilter, severityFilter, stageFilter, riskLevelFilter, onlyOverdueFilter, onlyMyInboxFilter, currentUser]);

  // Reset page when filters change
  useEffect(() => {
    setIncidentPage(1);
  }, [searchTerm, categoryFilter, severityFilter, stageFilter, riskLevelFilter, onlyOverdueFilter, onlyMyInboxFilter]);

  const paginatedIncidents = useMemo(() => {
    if (incidentPageSize === 0 || filteredIncidents.length <= incidentPageSize) {
      return filteredIncidents;
    }
    const start = (incidentPage - 1) * incidentPageSize;
    return filteredIncidents.slice(start, start + incidentPageSize);
  }, [filteredIncidents, incidentPage, incidentPageSize]);

  const totalIncidentPages = incidentPageSize > 0 
    ? Math.ceil(filteredIncidents.length / incidentPageSize) || 1 
    : 1;

  // Live KPI Summary computed directly from the Incident Log Ledger (no hardcoded years)
  const ledgerSummary = useMemo(() => {
    let totalAnomalies = 0;
    let nearMissCount = 0;
    let recordableOrLtiCount = 0;
    let f34TrackedCount = 0;

    incidents.forEach((inc) => {
      if (inc.category === 'Unsafe Act' || inc.category === 'Unsafe Condition') {
        totalAnomalies++;
      } else if (inc.category === 'Near Miss') {
        nearMissCount++;
      }

      const typeObj = configuredIncidentTypes.find((t) => t.id === inc.incidentTypeId);
      const isHighOrRecordable =
        typeObj?.group === 'high_severity' ||
        (typeObj?.group === 'recordable' && typeObj.code !== 'FAC') ||
        inc.severity === 'Critical / Lost Time (LTI)' ||
        inc.severity === 'Fatality' ||
        inc.severity === 'High / Restricted Work' ||
        (inc.category === 'Incident' && Boolean(inc.isOshaRecordable) && inc.severity !== 'Minor / First Aid');
      if (isHighOrRecordable) {
        recordableOrLtiCount++;
      }

      if (
        (Boolean(inc.supplementaryForm) || inc.formVariant === 'RHS-F28' || inc.category === 'Incident') &&
        (Boolean(inc.supplementaryForm) || inc.workflowStage === 'CLOSED')
      ) {
        f34TrackedCount++;
      }
    });

    return {
      totalAnomalies,
      nearMissCount,
      recordableOrLtiCount,
      f34TrackedCount,
    };
  }, [incidents, configuredIncidentTypes]);

  // Export CSV
  const exportToCsv = () => {
    let csv = 'شماره گزارش,دسته بندی,عنوان,تاریخ,شرکت,واحد,محل,RPN,سطح ریسک,مرحله گردش کار,وضعیت\n';
    filteredIncidents.forEach((r) => {
      const stageLabel = WORKFLOW_STAGE_META[getIncidentWorkflowStage(r)].labelFa;
      const rpnVal = r.riskAssessment?.rpn ?? r.rhsF68?.riskAssessment?.rpn ?? '';
      const rpnLevel = r.riskAssessment?.riskLevelFa ?? r.rhsF68?.riskAssessment?.riskLevelFa ?? '';
      csv += `${r.reportNumber},${r.categoryFa},"${(r.title || '').replace(/"/g, '""')}",${r.eventDate},"${r.companyName || ''}","${r.department || ''}","${r.locationSite || ''}",${rpnVal},"${rpnLevel}","${stageLabel}",${r.status}\n`;
    });
    downloadCsvFile(`RHS_F68_Safety_Anomalies_Log_${Date.now()}.csv`, csv);
  };

  return (
    <div className="space-y-6 pb-12" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-rose-900/50">
        <div className="absolute top-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-amber-500/20 text-amber-300 border border-blue-400/20 text-[10px] font-bold px-2.5 py-1 rounded-full">
                {isFa ? 'سامانه جامع ثبت ناهنجاری، شرایط/رفتار ناایمن و شبه‌حادثه' : 'Safety Anomaly & Incident Workflow'}
              </span>
              {myInboxCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('reports');
                    setOnlyMyInboxFilter((v) => !v);
                  }}
                  className="bg-indigo-500/90 hover:bg-indigo-400 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer"
                >
                  <Inbox className="w-3 h-3" />
                  <span>{isFa ? `${myInboxCount} مورد در کارتابل شما` : `${myInboxCount} In My Inbox`}</span>
                </button>
              )}
              {overdueCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('reports');
                    setOnlyOverdueFilter((v) => !v);
                  }}
                  className="bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3 h-3" />
                  <span>{isFa ? `${overdueCount} اقدام معوق` : `${overdueCount} Overdue`}</span>
                </button>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3 text-white">
              <ShieldAlert className="w-8 h-8 text-rose-500 shrink-0" />
              {isFa ? 'ثبت و بررسی گزارش ناهنجاری / حادثه' : 'Unsafe Act, Condition, Near Miss & Incident Portal'}
            </h1>
            <p className="text-slate-300 text-xs max-w-3xl leading-relaxed">
              {isFa 
                ? 'ثبت ساختاریافته رفتار ناایمن، شرایط ناایمن و شبه‌حادثه مطابق فرم RHS-F68 Rev.01 با گردش کار ۵ مرحله‌ای ارجاع نقش‌محور، دسته‌بندی ۸ گانه عوامل رویداد، محاسبه RPN (L/M/H/E)، پیگیری اقدامات اصلاحی و چاپ رسمی A4.' 
                : 'Structured RHS-F68 Rev.01 anomaly reporting, 5-stage role-gated referral workflow, 8-factor classification, RPN risk grading, CAPA tracking & A4 printing.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowTypeChooserModal(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isFa ? 'ثبت گزارش جدید' : 'New Report'}
            </button>
            <button
              onClick={exportToCsv}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-3 rounded-2xl border border-white/10 transition flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              {isFa ? 'خروجی اکسل / CSV' : 'Export Log'}
            </button>
          </div>
        </div>

        {/* Sub Tabs Navigation */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('reports')}
            className={`hse-motion-tab px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'reports' 
                ? 'bg-rose-600 text-white shadow-md' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <FileText className="w-4 h-4 text-rose-200" />
            {isFa ? 'دفتر ثبت گزارشات' : 'Incident Log Ledger'}
            <span className="bg-white text-rose-800 text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {incidents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('pyramid')}
            className={`hse-motion-tab px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'pyramid' 
                ? 'bg-rose-600 text-white shadow-md' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            {isFa ? 'هرم ایمنی و حوادث (Safety Triangle)' : 'OSHA Incident Pyramid'}
          </button>

          <button
            onClick={() => setActiveTab('stats')}
            className={`hse-motion-tab px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'stats' 
                ? 'bg-rose-600 text-white shadow-md' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-indigo-300" />
            {isFa ? 'تحلیل آماری، RPN و اقدامات معوق' : 'Analytics & Overdue'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="hse-stagger-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'کل رفتارها و شرایط ناایمن' : 'Total Unsafe Acts/Cond.'}</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1 font-mono tabular-nums">{ledgerSummary.totalAnomalies}</h3>
          </div>
          <div className="hse-card-icon p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'شبه‌حوادث (Near Misses)' : 'Near Misses'}</p>
            <h3 className="text-2xl font-black text-sky-600 mt-1 font-mono tabular-nums">{ledgerSummary.nearMissCount}</h3>
          </div>
          <div className="hse-card-icon p-3 bg-sky-50 text-sky-600 rounded-2xl">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'اقدامات اصلاحی معوق' : 'Overdue Actions'}</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1 font-mono tabular-nums">{overdueCount}</h3>
          </div>
          <div className="hse-card-icon p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'حوادث قابل ثبت / LTI' : 'OSHA / LTI'}</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1 font-mono tabular-nums">
              {ledgerSummary.recordableOrLtiCount}
            </h3>
          </div>
          <div className="hse-card-icon p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <UserX className="w-6 h-6" />
          </div>
        </div>
      </div>

      <SubViewTransition viewKey={activeTab} isFa={isFa}>
      {/* TAB 1: INCIDENT LOG LEDGER */}
      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={isFa ? 'جستجو بر اساس موضوع، شماره گزارش، مکان، واحد یا گزارش‌دهنده...' : 'Search...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه انواع گزارش' : 'All Categories'}</option>
                <option value="Incident">{isFa ? 'حادثه / رویداد (RHS-F28 و سوابق)' : 'Incident / Event (RHS-F28)'}</option>
                <option value="Unsafe Act">{isFa ? 'رفتار ناایمن (Unsafe Act)' : 'Unsafe Act'}</option>
                <option value="Unsafe Condition">{isFa ? 'شرایط ناایمن (Unsafe Condition)' : 'Unsafe Condition'}</option>
                <option value="Near Miss">{isFa ? 'شبه‌حادثه (Near Miss)' : 'Near Miss'}</option>
                <option value="Toxic Gas Leak">{isFa ? 'نشت گازهای سمی' : 'Toxic Gas Leak'}</option>
              </select>

              <select
                value={stageFilter}
                onChange={e => setStageFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه مراحل گردش کار' : 'All Workflow Stages'}</option>
                <option value="DRAFT">{isFa ? 'پیش‌نویس' : 'Draft'}</option>
                <option value="HSE_HEAD_TRIAGE">{isFa ? 'بررسی رئیس HSE' : 'HSE Head Triage'}</option>
                <option value="HSE_EXPERT_REVIEW">{isFa ? 'بررسی کارشناس HSE' : 'HSE Expert Review'}</option>
                <option value="ACTION_IN_PROGRESS">{isFa ? 'در حال اقدام اصلاحی' : 'CAPA In Progress'}</option>
                <option value="HSE_FINAL_APPROVAL">{isFa ? 'جمع‌بندی نهایی رئیس HSE' : 'HSE Final Approval'}</option>
                <option value="CLOSED">{isFa ? 'مختومه و تایید نهایی' : 'Closed'}</option>
                <option value="RETURNED">{isFa ? 'عودت جهت اصلاح' : 'Returned'}</option>
              </select>

              <select
                value={riskLevelFilter}
                onChange={e => setRiskLevelFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه سطوح RPN' : 'All RPN Levels'}</option>
                <option value="L">{isFa ? 'پایین L (1-10)' : 'Low (L)'}</option>
                <option value="M">{isFa ? 'متوسط M (11-24)' : 'Medium (M)'}</option>
                <option value="H">{isFa ? 'بالا H (25-49)' : 'High (H)'}</option>
                <option value="E">{isFa ? 'شدید/بارز E (50-125)' : 'Extreme (E)'}</option>
              </select>

              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه سطوح شدت OSHA' : 'All OSHA Severities'}</option>
                <option value="Minor / First Aid">{isFa ? 'جزیی / کمک اولیه' : 'First Aid'}</option>
                <option value="Moderate / Medical Treatment">{isFa ? 'متوسط / درمان پزشکی' : 'Medical Treatment'}</option>
                <option value="High / Restricted Work">{isFa ? 'شدید / کار محدود' : 'Restricted Work'}</option>
                <option value="Critical / Lost Time (LTI)">{isFa ? 'بحرانی / زمان تلف‌شده' : 'LTI'}</option>
              </select>

              <button
                type="button"
                onClick={() => setOnlyMyInboxFilter(v => !v)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition ${
                  onlyMyInboxFilter
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Inbox className="w-3.5 h-3.5" />
                <span>{isFa ? `کارتابل ارجاعات من (${myInboxCount})` : `My Inbox (${myInboxCount})`}</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyOverdueFilter(v => !v)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition ${
                  onlyOverdueFilter
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isFa ? `فقط معوق (${overdueCount})` : `Overdue (${overdueCount})`}</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-black border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">{isFa ? 'کد گزارش و RPN' : 'Report ID & RPN'}</th>
                  <th className="p-3.5">{isFa ? 'نوع گزارش' : 'Type'}</th>
                  <th className="p-3.5">{isFa ? 'موضوع و گزارش‌دهنده' : 'Subject & Reporter'}</th>
                  <th className="p-3.5">{isFa ? 'تاریخ و زمان' : 'Date / Time'}</th>
                  <th className="p-3.5">{isFa ? 'واحد و موقعیت' : 'Unit / Location'}</th>
                  <th className="p-3.5">{isFa ? 'وضعیت و گردش کار' : 'Workflow Stage'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'فرم تکمیلی (F34)' : 'RHS-F34'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedIncidents.length > 0 ? (
                  paginatedIncidents.map(row => {
                    const stage = getIncidentWorkflowStage(row);
                    const stageMeta = WORKFLOW_STAGE_META[stage];
                    const overdue = getCorrectiveOverdueInfo(row);
                    const rpnData = row.riskAssessment || row.rhsF68?.riskAssessment;
                    const involvedCount = row.rhsF68?.involvedPersonnel?.length || 0;
                    const assignedExpert = row.rhsF68?.hseUnitReview?.assignedExpertName;

                    const isF28Row = row.formVariant === 'RHS-F28' || Boolean(row.rhsF28);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-rose-600 text-xs">{row.reportNumber}</span>
                            {isF28Row && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-black">
                                RHS-F28
                              </span>
                            )}
                          </div>
                          {rpnData && (
                            <div
                              className={`mt-1 block w-fit text-[10px] font-black px-2 py-0.5 rounded-md whitespace-nowrap ${
                                rpnData.riskLevel === 'E' || ('riskLevelColor' in rpnData && rpnData.riskLevelColor === 'red')
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : rpnData.riskLevel === 'H'
                                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                  : rpnData.riskLevel === 'M' || ('riskLevelColor' in rpnData && rpnData.riskLevelColor === 'yellow')
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              RPN: {rpnData.rpn} ({rpnData.riskLevel || ''})
                            </div>
                          )}
                          {overdue.isOverdue && (
                            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600 text-white font-sans text-[10px] font-black">
                              <Clock className="w-2.5 h-2.5" />
                              {overdue.daysOverdue} روز تاخیر
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${
                              row.category === 'Unsafe Act'
                                ? 'bg-amber-100 text-amber-800'
                                : row.category === 'Unsafe Condition'
                                ? 'bg-indigo-100 text-indigo-800'
                                : row.category === 'Toxic Gas Leak'
                                ? 'bg-purple-100 text-purple-800'
                                : row.category === 'Near Miss'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isF28Row
                              ? 'حادثه / رویداد (F28)'
                              : row.category === 'Unsafe Act'
                              ? 'رفتار ناایمن'
                              : row.category === 'Unsafe Condition'
                              ? 'شرایط ناایمن'
                              : row.category === 'Near Miss'
                              ? 'شبه‌حادثه'
                              : row.categoryFa}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block max-w-xs truncate">
                            {row.title}
                          </span>
                          <span className="text-[10px] text-slate-500 block font-normal mt-0.5">
                            {isFa ? 'گزارش‌دهنده:' : 'By:'} {row.reporterName || '—'}
                            {row.reporterPersonnelCode ? ` (${row.reporterPersonnelCode})` : ''}
                            {involvedCount > 0 && (
                              <span className="mr-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                                {involvedCount} فرد مرتبط
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <DualDateBadge dateStr={row.eventDate} showTime={false} />
                          <span className="block text-[10px] text-slate-400 font-mono">{row.eventTime}</span>
                        </td>
                        <td className="p-3.5 text-slate-700 dark:text-slate-200">
                          <span className="font-bold block">{row.department || '—'}</span>
                          <span className="block text-[10px] text-slate-400">
                            {row.locationSite}
                            {row.exactLocation ? ` — ${row.exactLocation}` : ''}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${stageMeta.badgeClass}`}>
                            {isF28Row && stage === 'HSE_FINAL_APPROVAL'
                              ? 'در انتظار امضای رئیس مرکز HSE'
                              : stageMeta.labelFa}
                          </span>
                          {!isF28Row && (
                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                              مرحله {stageMeta.stepOrder} از ۵
                            </span>
                          )}
                          {assignedExpert && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              کارشناس: <strong className="text-slate-700 dark:text-slate-300">{assignedExpert}</strong>
                            </span>
                          )}
                          {stage === 'ACTION_IN_PROGRESS' && row.rhsF68?.correctiveFollowUp?.responsiblePerson && (
                            <span className="block text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                              مجری اقدام: <strong>{row.rhsF68.correctiveFollowUp.responsiblePerson}</strong>
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          {row.category === 'Incident' || isF28Row ? (() => {
                            const hasF34 = Boolean(row.supplementaryForm) || stage === 'CLOSED' || !isF28Row;
                            if (!hasF34) {
                              return (
                                <span className="text-[10px] font-bold text-slate-400">
                                  {isFa ? 'پس از تأیید RHS-F28' : 'After F28 Approval'}
                                </span>
                              );
                            }
                            const suppForm = getSupplementaryFormByIncidentId(row.id, row, currentUser);
                            const anchor =
                              suppForm.f28FinalApprovedDate ||
                              suppForm.startDate ||
                              row.rhsF28?.hseCenterHeadSignedDate ||
                              row.reportDate ||
                              row.eventDate;
                            const deadline = calculateDeadlineInfo(anchor.replace(/\./g, '/'), suppForm.status);
                            const isF34Done = suppForm.status === 'completed' || suppForm.workflowStage === 'COMPLETED';
                            const isF34Overdue = !isF34Done && (suppForm.isExpired || deadline.isExpired);
                            const isF34Near = !isF34Done && !isF34Overdue && (suppForm.isNearDeadline || deadline.isNearDeadline);
                            return (
                              <button
                                onClick={() => setSelectedIncidentForSupplementary(row)}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition inline-flex flex-col items-center border shadow-xs cursor-pointer ${
                                  isF34Done
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : isF34Overdue
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : isF34Near
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                }`}
                              >
                                <span>
                                  {isF34Done
                                    ? 'تحلیل تکمیل‌شده'
                                    : suppForm.workflowStage === 'PENDING_APPROVAL'
                                    ? 'در انتظار تأیید HSE'
                                    : isF34Overdue
                                    ? `تأخیر (${Math.abs(deadline.daysRemaining)} روز)`
                                    : `RHS-F34 (${deadline.daysRemaining} روز)`}
                                </span>
                                {suppForm.nonConformanceTrackingCode && (
                                  <span className="text-[9px] font-mono text-rose-700 mt-0.5">
                                    NC: {suppForm.nonConformanceTrackingCode}
                                  </span>
                                )}
                              </button>
                            );
                          })() : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <button
                              onClick={() => setSelectedIncidentForDetail(row)}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                              title={isFa ? (isF28Row ? 'جزئیات و امضای RHS-F28' : 'بررسی گردش کار و جزئیات RHS-F68') : 'Workflow & Details'}
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{isFa ? 'جزئیات' : 'Details'}</span>
                            </button>
                            {(stage === 'DRAFT' || stage === 'RETURNED') && (
                              <button
                                onClick={() => (isF28Row ? setEditingF28Draft(row) : setEditingDraft(row))}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                title={isFa ? 'ویرایش و ارسال پیش‌نویس' : 'Edit Draft'}
                              >
                                <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                <span>{isFa ? 'تکمیل' : 'Resume'}</span>
                              </button>
                            )}
                            <button
                              onClick={() => setPrintTargetIncident(row)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title={isFa ? (isF28Row ? 'چاپ رسمی RHS-F28' : 'چاپ رسمی RHS-F68') : 'Print'}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setReferralTargetIncident(row)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition cursor-pointer"
                              title={isFa ? 'ارجاع، تأیید و امضا' : 'Refer'}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setTrackerTargetIncident(row)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title={isFa ? 'رهگیری گردش کار' : 'Tracker'}
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            {row.category === 'Incident' && !isF28Row && (
                              <button
                                onClick={() => handleStartEditIncident(row)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition cursor-pointer"
                                title={isFa ? 'ویرایش رکورد حادثه' : 'Edit Legacy'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteIncident(row.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer"
                              title={isFa ? 'حذف گزارش' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                      {isFa ? 'هیچ رکوردی یافت نشد' : 'No Incidents Found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>

          {/* Incident Table Pagination Controls */}
          {filteredIncidents.length > 20 && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span>
                  {isFa 
                    ? `نمایش ${paginatedIncidents.length} از مجموع ${filteredIncidents.length} رویداد` 
                    : `Showing ${paginatedIncidents.length} of ${filteredIncidents.length} incidents`}
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">{isFa ? 'تعداد در صفحه:' : 'Per page:'}</span>
                  {[25, 50, 100].map(sz => (
                    <button
                      key={sz}
                      onClick={() => { setIncidentPageSize(sz); setIncidentPage(1); }}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold cursor-pointer ${incidentPageSize === sz ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                    >
                      {sz}
                    </button>
                  ))}
                  <button
                    onClick={() => { setIncidentPageSize(0); setIncidentPage(1); }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold cursor-pointer ${incidentPageSize === 0 ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    {isFa ? 'همه' : 'All'}
                  </button>
                </div>
              </div>

              {totalIncidentPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={incidentPage === 1}
                    onClick={() => setIncidentPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border rounded-lg disabled:opacity-40 hover:bg-slate-100 cursor-pointer text-xs"
                  >
                    {isFa ? 'قبلی' : 'Prev'}
                  </button>
                  <span className="px-2 font-mono font-bold text-slate-700 dark:text-slate-200">
                    {incidentPage} / {totalIncidentPages}
                  </span>
                  <button
                    disabled={incidentPage === totalIncidentPages}
                    onClick={() => setIncidentPage(p => Math.min(totalIncidentPages, p + 1))}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border rounded-lg disabled:opacity-40 hover:bg-slate-100 cursor-pointer text-xs"
                  >
                    {isFa ? 'بعدی' : 'Next'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OSHA SAFETY PYRAMID */}
      {activeTab === 'pyramid' && (
        <WorkshopSafetyPyramid
          isFa={isFa}
          incidents={incidents}
          currentUser={currentUser}
          configuredIncidentTypes={configuredIncidentTypes}
          departmentList={departmentList}
          onSelectIncident={(inc) => setSelectedIncidentForDetail(inc)}
          onNavigateToReports={() => setActiveTab('reports')}
        />
      )}

      {/* TAB 4: STATS, RPN & OVERDUE ANALYTICS */}
      {activeTab === 'stats' && (
        <div className="space-y-5">
          {/* Clean Segmented Sub-View Switcher for Faster Executive Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1">
              {[
                { key: 'all' as const, labelFa: 'نمای جامع تحلیلی', labelEn: 'Full Overview' },
                { key: 'analytics' as const, labelFa: 'نمودارها و توزیع RPN', labelEn: 'Charts & RPN' },
                {
                  key: 'overdue' as const,
                  labelFa: `اقدامات اصلاحی معوق (${overdueCount})`,
                  labelEn: `Overdue CAPA (${overdueCount})`,
                },
                {
                  key: 'f34' as const,
                  labelFa: `پایش تحلیل حوادث RHS-F34 (${ledgerSummary.f34TrackedCount})`,
                  labelEn: `RHS-F34 Compliance (${ledgerSummary.f34TrackedCount})`,
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setStatsSubView(item.key)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    statsSubView === item.key
                      ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isFa ? item.labelFa : item.labelEn}
                </button>
              ))}
            </div>
          </div>

          {statsSubView !== 'f34' && (
            <RhsF68AnalyticsPanel
              incidents={incidents}
              departmentList={departmentList}
              sectionMode={statsSubView === 'all' ? 'all' : statsSubView}
              onSelectIncident={(inc) => setSelectedIncidentForDetail(inc)}
              isFa={isFa}
            />
          )}

          {(statsSubView === 'all' || statsSubView === 'f34') && (
            <RhsF34DashboardPanel
              incidents={incidents}
              currentUser={currentUser}
              onOpenSupplementary={(inc) => setSelectedIncidentForSupplementary(inc)}
              onSelectIncident={(inc) => setSelectedIncidentForDetail(inc)}
              isFa={isFa}
            />
          )}
        </div>
      )}
      </SubViewTransition>

      {/* NEW REPORT FORM TYPE CHOOSER MODAL */}
      {showTypeChooserModal && createPortal(
        <div className="fixed inset-0 z-[99998] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            dir={isFa ? 'rtl' : 'ltr'}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {isFa ? 'انتخاب نوع فرم ثبت گزارش جدید' : 'Select Report Form Type'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isFa
                    ? 'مطابق دستورالعمل‌های HSE پتروشیمی رجال، فرم مورد نظر خود را انتخاب نمایید.'
                    : 'Choose the official HSE report form to fill out.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTypeChooserModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowTypeChooserModal(false);
                  setEditingF28Draft(null);
                  setShowNewF28Modal(true);
                }}
                className="text-right p-4 rounded-2xl border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 hover:border-rose-500 hover:bg-rose-50 transition cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-black">
                    RHS-F28 Rev.01
                  </span>
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {isFa ? 'گزارش حادثه / رویداد' : 'Incident / Event Report'}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isFa
                    ? 'ثبت مستقل گزارش حادثه و رویداد پتروشیمی رجال شامل مشخصات مصدوم، شرح مورد، خسارات، اقدامات انجام‌شده و تایید رئیس مرکز HSE.'
                    : 'Independent incident/event form with injured person details, damages, actions taken, and HSE Center Head sign-off.'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowTypeChooserModal(false);
                  setEditingDraft(null);
                  setShowNewModal(true);
                }}
                className="text-right p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 hover:border-indigo-500 hover:bg-indigo-50 transition cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[10px] font-black">
                    RHS-F68 Rev.01
                  </span>
                  <AlertTriangle className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {isFa ? 'گزارش ناهنجاری / شبه‌حادثه' : 'Unsafe Act / Condition / Near Miss'}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isFa
                    ? 'ثبت رفتار ناایمن، شرایط ناایمن و شبه‌حادثه با گردش کار ۵ مرحله‌ای کارشناسی، تحلیل RPN و پیگیری اقدام اصلاحی.'
                    : 'Unsafe Act, Unsafe Condition & Near Miss with 5-stage expert review, RPN risk grading, and CAPA tracking.'}
                </p>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RHS-F28 REV.01 CREATE / EDIT DRAFT MODAL */}
      <RhsF28ReportModal
        isOpen={showNewF28Modal || Boolean(editingF28Draft)}
        onClose={() => {
          setShowNewF28Modal(false);
          setEditingF28Draft(null);
        }}
        currentUser={currentUser}
        editingDraft={editingF28Draft}
        onSaved={() => {
          loadIncidents();
        }}
        isFa={isFa}
      />

      {/* RHS-F68 REV.01 WIZARD MODAL (CREATE / EDIT DRAFT) */}
      <RhsF68ReportWizardModal
        isOpen={showNewModal || Boolean(editingDraft)}
        onClose={() => {
          setShowNewModal(false);
          setEditingDraft(null);
        }}
        currentUser={currentUser}
        editingDraft={editingDraft}
        onSaved={() => {
          loadIncidents();
        }}
        isFa={isFa}
      />

      {/* DETAIL MODAL (ROUTED CLEANLY BETWEEN RHS-F28 AND RHS-F68) */}
      {selectedIncidentForDetail &&
      (selectedIncidentForDetail.formVariant === 'RHS-F28' || Boolean(selectedIncidentForDetail.rhsF28)) ? (
        <RhsF28DetailModal
          incident={selectedIncidentForDetail}
          currentUser={currentUser}
          onClose={() => setSelectedIncidentForDetail(null)}
          onUpdated={(updated) => {
            setSelectedIncidentForDetail(updated);
            loadIncidents();
          }}
          onEditDraft={(rec) => {
            setSelectedIncidentForDetail(null);
            setEditingF28Draft(rec);
          }}
          onOpenPrint={(rec) => setPrintTargetIncident(rec)}
          onOpenReferral={(rec) => setReferralTargetIncident(rec)}
          onOpenTracker={(rec) => setTrackerTargetIncident(rec)}
          onOpenSupplementary={(rec) => setSelectedIncidentForSupplementary(rec)}
          onDelete={handleDeleteIncident}
          isFa={isFa}
        />
      ) : (
        <RhsF68DetailWorkflowModal
          incident={selectedIncidentForDetail}
          currentUser={currentUser}
          onClose={() => setSelectedIncidentForDetail(null)}
          onUpdated={(updated) => {
            setSelectedIncidentForDetail(updated);
            loadIncidents();
          }}
          onEditDraft={(rec) => {
            setSelectedIncidentForDetail(null);
            setEditingDraft(rec);
          }}
          onOpenPrint={(rec) => setPrintTargetIncident(rec)}
          onOpenReferral={(rec) => setReferralTargetIncident(rec)}
          onOpenTracker={(rec) => setTrackerTargetIncident(rec)}
          onOpenSupplementary={(rec) => setSelectedIncidentForSupplementary(rec)}
          onDelete={handleDeleteIncident}
          isFa={isFa}
        />
      )}

      {/* OFFICIAL A4 PRINT VIEW MODAL (RHS-F28 OR RHS-F68) */}
      {printTargetIncident &&
        ((printTargetIncident.formVariant === 'RHS-F28' || Boolean(printTargetIncident.rhsF28)) ? (
          <RhsF28PrintViewModal
            incident={printTargetIncident}
            isOpen={Boolean(printTargetIncident)}
            onClose={() => setPrintTargetIncident(null)}
            isFa={isFa}
          />
        ) : (
          <RhsF68PrintViewModal
            incident={printTargetIncident}
            isOpen={Boolean(printTargetIncident)}
            onClose={() => setPrintTargetIncident(null)}
            isFa={isFa}
          />
        ))}

      {/* FULL EDIT INCIDENT MODAL (ADMINISTRATOR ONLY) */}
      {editingIncident && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto" dir={isFa ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" />
                <span>{isFa ? 'ویرایش کامل گزارش حادثه / ناهنجاری (مدیر اصلی)' : 'Edit Safety Incident Report'}</span>
              </h3>
              <button onClick={() => setEditingIncident(null)} className="text-slate-400 hover:text-slate-600 dark:text-slate-400 font-bold text-sm w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedIncident} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'عنوان / خلاصه گزارش:' : 'Title / Summary:'}</label>
                  <input
                    type="text"
                    required
                    value={editingIncident.title}
                    onChange={(e) => setEditingIncident({ ...editingIncident, title: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'دسته‌بندی (OSHA / ناهنجاری):' : 'Category:'}</label>
                  <select
                    value={editingIncident.category}
                    onChange={(e) => setEditingIncident({ ...editingIncident, category: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Unsafe Act">{isFa ? 'عمل ناایمن (Unsafe Act)' : 'Unsafe Act'}</option>
                    <option value="Unsafe Condition">{isFa ? 'شرایط ناایمن (Unsafe Condition)' : 'Unsafe Condition'}</option>
                    <option value="Near Miss">{isFa ? 'شبه حادثه (Near Miss)' : 'Near Miss'}</option>
                    <option value="Incident">{isFa ? 'حادثه کارگاهی (Incident / Injury)' : 'Incident'}</option>
                    <option value="Toxic Gas Leak">{isFa ? 'نشت گازهای سمی (Toxic Gas Leak)' : 'Toxic Gas Leak'}</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'تاریخ وقوع:' : 'Event Date:'}</label>
                  <PersianDatePicker
                    value={editingIncident.eventDate}
                    onChange={(jStr) => setEditingIncident({ ...editingIncident, eventDate: jStr })}
                    isFa={isFa}
                    placeholder={isFa ? 'انتخاب تاریخ وقوع...' : 'Event Date...'}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'زمان وقوع:' : 'Event Time:'}</label>
                  <PersianTimePicker
                    value={editingIncident.eventTime}
                    onChange={(t) => setEditingIncident({ ...editingIncident, eventTime: t })}
                    isFa={isFa}
                    placeholder="14:30"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'واحد سازمانی:' : 'Department:'}</label>
                  <input
                    type="text"
                    list="edit-incident-dept-list"
                    value={editingIncident.department || ''}
                    onChange={(e) => setEditingIncident({ ...editingIncident, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <datalist id="edit-incident-dept-list">
                    {departmentList.map(dept => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'محل وقوع (سایت / UNIT):' : 'Location:'}</label>
                  <input
                    type="text"
                    value={editingIncident.locationSite || ''}
                    onChange={(e) => setEditingIncident({ ...editingIncident, locationSite: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'نام گزارش‌دهنده:' : 'Reporter Name:'}</label>
                  <input
                    type="text"
                    value={editingIncident.reporterName}
                    onChange={(e) => setEditingIncident({ ...editingIncident, reporterName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'وضعیت گزارش:' : 'Report Status:'}</label>
                  <select
                    value={editingIncident.status}
                    onChange={(e) => setEditingIncident({ ...editingIncident, status: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="Submitted">{isFa ? 'ثبت اولیه / در انتظار بررسی' : 'Submitted'}</option>
                    <option value="Under Investigation">{isFa ? 'در حال بررسی' : 'Under Investigation'}</option>
                    <option value="CAPA In Progress">{isFa ? 'در حال اجرای اقدام اصلاحی' : 'CAPA In Progress'}</option>
                    <option value="Resolved & Closed">{isFa ? 'مختومه و بسته‌شده' : 'Resolved & Closed'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'شرح کامل حادثه / ناهنجاری:' : 'Full Description:'}</label>
                <textarea
                  rows={3}
                  required
                  value={editingIncident.description}
                  onChange={(e) => setEditingIncident({ ...editingIncident, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'اقدام فوری انجام‌شده:' : 'Immediate Action:'}</label>
                <textarea
                  rows={2}
                  value={editingIncident.immediateActionTaken || ''}
                  onChange={(e) => setEditingIncident({ ...editingIncident, immediateActionTaken: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingIncident(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-500 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-md"
                >
                  {isFa ? 'ذخیره تغییرات' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {/* CONFIRM DELETE MODAL (ADMINISTRATOR ONLY) */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200" dir={isFa ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <h4 className="font-black text-slate-900 text-sm">{isFa ? 'تایید حذف اطلاعات' : 'Confirm Deletion'}</h4>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-relaxed">{deleteConfirm.title}</p>
              {deleteConfirm.description && (
                <p className="text-[11px] text-slate-500 leading-relaxed">{deleteConfirm.description}</p>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={deleteConfirm.onConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isFa ? 'حذف قطعی' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* INCIDENT SUPPLEMENTARY FORM MODAL (RHS-F34) */}
      {selectedIncidentForSupplementary && (
        <IncidentSupplementaryModal
          isOpen={Boolean(selectedIncidentForSupplementary)}
          onClose={() => setSelectedIncidentForSupplementary(null)}
          incident={selectedIncidentForSupplementary}
          currentUser={currentUser}
          isFa={isFa}
          onSaved={(updatedForm) => {
            setIncidents(prev => prev.map(inc => {
              if (inc.id === updatedForm.incidentId || inc.reportNumber === updatedForm.incidentReportNumber) {
                return {
                  ...inc,
                  supplementaryFormId: updatedForm.id,
                  supplementaryFormStatus: updatedForm.status,
                  supplementaryForm: updatedForm
                };
              }
              return inc;
            }));
            if (
              selectedIncidentForDetail &&
              (selectedIncidentForDetail.id === updatedForm.incidentId ||
                selectedIncidentForDetail.reportNumber === updatedForm.incidentReportNumber)
            ) {
              setSelectedIncidentForDetail(prev => prev ? {
                ...prev,
                supplementaryFormId: updatedForm.id,
                supplementaryFormStatus: updatedForm.status,
                supplementaryForm: updatedForm
              } : null);
            }
            loadIncidents();
          }}
        />
      )}

      {/* UNIFIED REFERRAL MODAL */}
      {referralTargetIncident && (
        <CreateReferralModal
          documentType="INCIDENT"
          documentId={referralTargetIncident.id}
          documentNumber={referralTargetIncident.reportNumber}
          documentTitle={referralTargetIncident.title}
          currentUser={currentUser}
          isFa={isFa}
          onClose={() => setReferralTargetIncident(null)}
          onSuccess={() => {
            setReferralTargetIncident(null);
            toast.success(isFa ? 'سند با موفقیت به افراد منتخب ارجاع داده شد و در کارتابل ایشان قرار گرفت.' : 'Incident referred successfully.');
          }}
        />
      )}

      {/* UNIFIED WORKFLOW TRACKER MODAL */}
      {trackerTargetIncident && (
        <DocumentWorkflowTrackerModal
          documentType="INCIDENT"
          documentId={trackerTargetIncident.id}
          documentNumber={trackerTargetIncident.reportNumber}
          documentTitle={trackerTargetIncident.title}
          currentUser={currentUser}
          isFa={isFa}
          onClose={() => setTrackerTargetIncident(null)}
        />
      )}
    </div>
  );
}
