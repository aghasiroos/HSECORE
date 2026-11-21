import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile, SafetyIncidentRecord, IncidentCategory, OshaSeverityLevel, AnomalyTypeFa, CapaAction } from '../types';
import { findPersonnelByCode, getComplexPersonnelList } from '../utils/personnelHelper';
import { normalizeDigits as normalizeDigitsCentral } from '../utils/textNormalization';
import { downloadCsvFile } from '../utils/fileHelpers';
import CentralPersonnelSelector from './CentralPersonnelSelector';
import { 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  UserX, 
  BarChart3, 
  Eye, 
  Edit3,
  Trash2, 
  Layers, 
  Printer, 
  CheckSquare, 
  UserCheck, 
  Calculator, 
  Info
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { HseIncidentCategoryItem, DEFAULT_INCIDENT_TYPES } from './OrganizationMgmt';
import { useFinalSubmit } from '../context/FinalSubmitContext';
import WorkshopSafetyPyramid from './incident/WorkshopSafetyPyramid';
import IncidentSupplementaryModal from './incident/IncidentSupplementaryModal';
import PersianDatePicker from './common/PersianDatePicker';
import PersianTimePicker from './common/PersianTimePicker';
import DualDateBadge from './common/DualDateBadge';
import { 
  getSupplementaryFormByIncidentId, 
  calculateDeadlineInfo 
} from '../utils/incidentSupplementaryHelper';
import { printService } from '../services/printService';
import { SubViewTransition } from '../motion';
import { apiDb } from '../services/apiDatabaseClient';
import { useUnifiedOrgUnits } from '../utils/orgUnitsHelper';
import { CreateReferralModal } from './referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from './referral/DocumentWorkflowTrackerModal';
import { PrintDocumentSignaturesBox } from './referral/PrintDocumentSignaturesBox';
import { CentralNotificationService } from '../services/notificationService';
import { Send, History } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { handleVersionConflict } from './common/ConflictResolutionModal';

interface IncidentReportingProps {
  isFa: boolean;
  currentUser: UserProfile;
}

const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981'];

// Initial Seed Data for Safety Anomalies & Incidents according to OSHA / REGAL Standard
const INITIAL_INCIDENTS: SafetyIncidentRecord[] = [];

// Helper function to generate SDS context based on toxic gas leak data
const generateSdsInfo = (gas: string, ppm: number, duration: number, isFa: boolean) => {
  if (!gas) return '';
  let info = '';
  switch (gas) {
    case 'H2S (Hydrogen Sulfide)':
    case 'H2S':
      if (ppm < 10) info = isFa ? 'زیر حد مجاز تماس شغلی (10 ppm). خطر حاد ندارد.' : 'Below OEL (10 ppm). No acute hazard.';
      else if (ppm < 100) info = isFa ? 'بیش از حد مجاز تماس. سوزش چشم و دستگاه تنفسی. استفاده از ماسک تنفسی الزامی است.' : 'Above OEL. Eye and respiratory irritation. Respirator required.';
      else info = isFa ? 'خطر مرگ! فلج حس بویایی و بیهوشی سریع. تخلیه فوری و استفاده از دستگاه تنفسی هوای فشرده (SCBA).' : 'IDLH! Loss of smell and rapid unconsciousness. Evacuate immediately, SCBA required.';
      break;
    case 'CO (Carbon Monoxide)':
    case 'CO':
      if (ppm < 50) info = isFa ? 'زیر حد مجاز (50 ppm). علائم خاصی ندارد.' : 'Below OEL (50 ppm). No specific symptoms.';
      else if (ppm < 200) info = isFa ? 'سردرد خفیف، سرگیجه پس از چند ساعت تماس.' : 'Mild headache, dizziness after hours of exposure.';
      else if (ppm < 1200) info = isFa ? 'سردرد شدید، گیجی، خطر بیهوشی. تخلیه سریع.' : 'Severe headache, confusion, risk of unconsciousness. Evacuate.';
      else info = isFa ? 'خطر مرگ فوری! تخلیه و عملیات نجات با SCBA.' : 'IDLH! Immediate danger to life. Evacuate, SCBA required.';
      break;
    case 'NH3 (Ammonia)':
    case 'NH3':
      if (ppm < 25) info = isFa ? 'زیر حد مجاز (25 ppm). بوی تند.' : 'Below OEL (25 ppm). Strong odor.';
      else if (ppm < 300) info = isFa ? 'تحریک شدید چشم، بینی و گلو. احتمال آسیب به قرنیه.' : 'Severe irritation of eyes, nose, throat. Potential corneal damage.';
      else info = isFa ? 'خطر مرگ! اسپاسم برونش، ادم ریوی. تخلیه فوری.' : 'IDLH! Bronchospasm, pulmonary edema. Evacuate immediately.';
      break;
    case 'Cl2 (Chlorine)':
    case 'Cl2':
      if (ppm < 1) info = isFa ? 'زیر حد مجاز (1 ppm).' : 'Below OEL (1 ppm).';
      else if (ppm < 10) info = isFa ? 'سوزش شدید چشم، سرفه و تنگی نفس.' : 'Severe eye irritation, coughing, shortness of breath.';
      else info = isFa ? 'خطر مرگ! ادم ریوی شدید. تخلیه با تجهیزات کامل.' : 'IDLH! Severe pulmonary edema. Evacuate with full gear.';
      break;
    case 'SO2 (Sulfur Dioxide)':
    case 'SO2':
      if (ppm < 2) info = isFa ? 'زیر حد مجاز (2 ppm).' : 'Below OEL (2 ppm).';
      else if (ppm < 100) info = isFa ? 'تحریک شدید مجاری تنفسی، خطر برای افراد مبتلا به آسم.' : 'Severe respiratory irritation, dangerous for asthmatics.';
      else info = isFa ? 'خطر مرگ! تخلیه فوری.' : 'IDLH! Evacuate immediately.';
      break;
    case 'NO2 (Nitrogen Dioxide)':
    case 'NO2':
      if (ppm < 3) info = isFa ? 'زیر حد مجاز (3 ppm).' : 'Below OEL (3 ppm).';
      else if (ppm < 20) info = isFa ? 'سرفه، تنگی نفس و خستگی.' : 'Coughing, shortness of breath, fatigue.';
      else info = isFa ? 'خطر ادم ریوی تأخیری و مرگ! تخلیه فوری.' : 'Risk of delayed pulmonary edema and death! Evacuate immediately.';
      break;
    default:
      info = isFa ? 'اطلاعات SDS برای این گاز موجود نیست. لطفاً به برگه اطلاعات ایمنی مواد مراجعه کنید.' : 'SDS info not available for this gas. Please refer to Safety Data Sheet.';
  }

  // Factor in duration if applicable
  if (duration >= 15 && ppm > 0) {
    info += isFa ? ` (توجه: تماس طولانی‌مدت (≥۱۵ دقیقه) در غلظت ${ppm} ppm خطرات را تشدید می‌کند.)` : ` (Note: Exposure over 15 mins at ${ppm} ppm exacerbates risks.)`;
  }
  
  return info;
};

export default function IncidentReporting({ isFa, currentUser }: IncidentReportingProps) {
  const { confirmFinalSubmit } = useFinalSubmit();
  const [activeTab, setActiveTab] = useState<'reports' | 'pyramid' | 'osha_300' | 'stats'>('reports');

  // Unified Department / Units List derived strictly from Org Structure in System Settings
  const { units: unifiedOrgUnits } = useUnifiedOrgUnits();
  const departmentList = useMemo<string[]>(() => {
    return Array.from(new Set(unifiedOrgUnits.map(u => u.name).filter(Boolean)));
  }, [unifiedOrgUnits]);

  // Personnel Database State (for auto-filling reporter and action owner details)
  const [personnelList, setPersonnelList] = useState<any[]>(() => getComplexPersonnelList());

  useEffect(() => {
    const refreshPersonnel = () => {
      setPersonnelList(getComplexPersonnelList());
    };
    window.addEventListener('hse_personnel_updated', refreshPersonnel);
    window.addEventListener('app_data_mutated', refreshPersonnel);
    window.addEventListener('storage', refreshPersonnel);
    return () => {
      window.removeEventListener('hse_personnel_updated', refreshPersonnel);
      window.removeEventListener('app_data_mutated', refreshPersonnel);
      window.removeEventListener('storage', refreshPersonnel);
    };
  }, []);

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
          const rawData = r.incidentData || {};
          return {
            id: String(r.id),
            reportNumber: r.reportNumber || r.incidentNumber || `INC-${r.id}`,
            category: r.category || rawData.category || r.incidentType || 'Incident',
            categoryFa: r.categoryFa || rawData.categoryFa || (r.incidentType === 'NEAR_MISS' ? 'شبه حادثه' : r.incidentType === 'UNSAFE_ACT' ? 'عمل ناایمن' : r.incidentType === 'UNSAFE_CONDITION' ? 'شرایط ناایمن' : 'حادثه'),
            incidentTypeId: r.incidentTypeId || rawData.incidentTypeId || '',
            title: r.title || r.description || '',
            eventDate: r.eventDate || r.incidentDate || '',
            eventTime: r.eventTime || r.incidentTime || '10:00',
            locationSite: r.locationSite || r.location || '',
            department: r.department || rawData.department || '',
            reporterPersonnelCode: r.reporterPersonnelCode || rawData.reporterPersonnelCode || '',
            reporterName: r.reporterName || r.personnelName || '',
            reporterRole: r.reporterRole || rawData.reporterRole || 'User',
            riskAssessment: r.riskAssessment || rawData.riskAssessment || undefined,
            description: r.description || r.title || '',
            immediateActionTaken: r.immediateActionTaken || r.immediateCauses || rawData.immediateActions || '',
            severity: r.severity || 'Minor / First Aid',
            isOshaRecordable: Boolean(r.isOshaRecordable !== undefined ? r.isOshaRecordable : (r.lostWorkDays > 0 || r.severity === 'FATALITY' || r.severity === 'LOST_TIME_INJURY')),
            lostDays: Number(r.lostDays ?? r.lostWorkDays ?? 0) || 0,
            injuredPersonName: r.injuredPersonName || rawData.injuredPersonName || '',
            injuredPersonCode: r.injuredPersonCode || rawData.injuredPersonCode || '',
            bodyPartAffected: r.bodyPartAffected || rawData.bodyPartAffected || 'None',
            medicalTreatmentType: r.medicalTreatmentType || rawData.medicalTreatmentType || 'N/A',
            rootCauses: typeof r.rootCauses === 'object' && r.rootCauses !== null && !Array.isArray(r.rootCauses)
              ? r.rootCauses
              : { humanFactors: Array.isArray(r.rootCauses) ? r.rootCauses : [], equipmentFactors: [], environmentalFactors: [], systemicFactors: [] },
            fiveWhys: r.fiveWhys || rawData.fiveWhys || [],
            toxicGasLeak: r.toxicGasLeak || rawData.toxicGasLeak || undefined,
            capaList: r.capaList || rawData.capaActions || (r.correctiveActions ? [{ id: '1', description: r.correctiveActions, responsiblePerson: '', targetDate: '', status: 'Open' }] : []),
            status: r.status || 'Submitted',
            createdDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString('fa-IR') : (r.createdDate || '1405/01/01')
          };
        });
        saveIncidentsToStorage(mapped);
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

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState<SafetyIncidentRecord | null>(null);
  const [selectedIncidentForSupplementary, setSelectedIncidentForSupplementary] = useState<SafetyIncidentRecord | null>(null);

  // Helper: Check if current user is authorized to edit status (Action Responsible Person OR HSE Head/Manager/Admin)
  const canEditReportStatus = (incident: SafetyIncidentRecord) => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toLowerCase();
    const job = (currentUser.jobTitle || '').toLowerCase();
    
    // 1. Check if HSE Head / Manager / Safety Inspector / Admin
    const isHseHeadOrAdmin = 
      role === 'administrator' || 
      role === 'executivemanager' || 
      role === 'safetyinspector' || 
      job.includes('hse') || 
      job.includes('ایمنی') || 
      job.includes('رئیس') || 
      job.includes('مدیر') || 
      job.includes('سرپرست') ||
      Boolean(currentUser.permissions?.Incidents?.edit || currentUser.permissions?.Incidents?.approve);

    if (isHseHeadOrAdmin) return true;

    // 2. Check if Action Responsible Person (مسئول اقدام)
    const userName = (currentUser.fullName || '').trim().toLowerCase();
    const userCode = (currentUser.personnelNumber || '').trim().toLowerCase();

    if (incident.capaList && incident.capaList.length > 0) {
      const isOwner = incident.capaList.some(capa => {
        const resp = (capa.responsiblePerson || '').toLowerCase();
        return (userName && resp.includes(userName)) || (userCode && resp.includes(userCode));
      });
      if (isOwner) return true;
    }

    if (userCode && incident.reporterPersonnelCode && String(incident.reporterPersonnelCode).trim().toLowerCase() === userCode) {
      return true;
    }

    return false;
  };

  const handleUpdateIncidentStatus = (id: string, newStatus: SafetyIncidentRecord['status']) => {
    setIncidents(prev => {
      const updated = prev.map(inc => inc.id === id ? { ...inc, status: newStatus } : inc);
      return updated;
    });
    if (selectedIncidentForDetail && selectedIncidentForDetail.id === id) {
      setSelectedIncidentForDetail(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  // State for Editing full incident details (Admin only)
  const [editingIncident, setEditingIncident] = useState<SafetyIncidentRecord | null>(null);
  const [ncToast, setNcToast] = useState<string | null>(null);

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

  const handlePrintIncidentDetail = () => {
    if (!selectedIncidentForDetail) return;
    printService.printElement('printable-incident-detail-modal', {
      title: `گزارش رویداد - ${selectedIncidentForDetail.reportNumber} - ${selectedIncidentForDetail.title}`,
      orientation: 'portrait',
      pageSize: 'A4',
      documentCode: selectedIncidentForDetail.reportNumber,
      documentDate: selectedIncidentForDetail.eventDate,
      isFa: isFa,
      autoPrint: true
    });
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

  // Selected Period for Safety Pyramid Tab
  const [pyramidPeriod, setPyramidPeriod] = useState<'compare' | 'current_year' | 'last_year' | 'daily' | 'all'>('compare');

  // New Form State
  const [newReport, setNewReport] = useState({
    category: 'Unsafe Act' as IncidentCategory,
    incidentTypeId: '',
    title: '',
    eventDate: new Date().toLocaleDateString('fa-IR'),
    eventTime: '10:00',
    locationSite: '',
    department: '',
    reporterPersonnelCode: '',
    reporterName: '',
    description: '',
    immediateActionTaken: '',
    severity: 'Minor / First Aid' as OshaSeverityLevel,
    isOshaRecordable: false,
    injuredPersonName: '',
    bodyPartAffected: 'None' as any,
    humanFactorsStr: '',
    equipmentFactorsStr: '',
    capaDesc: '',
    capaOwnerPersonnelCode: '',
    capaOwner: '',
    // Risk Assessment Fields (Values 1 to 5)
    riskProbability: 2,
    riskSeverity: 2,
    riskDetection: 2,
    riskEnvSeverity: 1,
    // Toxic Gas Leak Fields
    toxicGasType: '',
    toxicGasAmountPpm: 0,
    toxicWindSpeed: '',
    toxicWindDirection: '',
    toxicLeakLocations: '',
    toxicLeakDurationMinutes: 0
  });

  const selectedIncidentTypeObj = useMemo(() => {
    return configuredIncidentTypes.find(t => t.id === newReport.incidentTypeId);
  }, [configuredIncidentTypes, newReport.incidentTypeId]);

  // Helper: Auto-lookup reporter details from Personnel Management
  const handlePersonnelCodeChange = (code: string) => {
    const trimmed = code.trim();
    let foundName = '';
    let foundDept = newReport.department;

    if (trimmed) {
      const matched = findPersonnelByCode(trimmed);
      if (matched) {
        foundName = matched.fullName;
        if (matched.unit) foundDept = matched.unit;
      }
    }

    setNewReport(prev => ({
      ...prev,
      reporterPersonnelCode: code,
      reporterName: foundName,
      department: foundDept
    }));
  };

  // Helper: Matched Reporter Personnel Preview
  const matchedPersonnel = useMemo(() => {
    const trimmed = newReport.reporterPersonnelCode.trim();
    if (!trimmed) return null;
    return findPersonnelByCode(trimmed);
  }, [newReport.reporterPersonnelCode]);

  // Helper: Auto-lookup Action Responsible Person details from Personnel Management
  const handleCapaOwnerCodeChange = (code: string) => {
    const trimmed = code.trim();
    let foundName = '';

    if (trimmed) {
      const matched = findPersonnelByCode(trimmed);
      if (matched) {
        foundName = matched.fullName;
      }
    }

    setNewReport(prev => ({
      ...prev,
      capaOwnerPersonnelCode: code,
      capaOwner: foundName
    }));
  };

  // Helper: Matched Action Owner Preview
  const matchedCapaOwner = useMemo(() => {
    const trimmed = newReport.capaOwnerPersonnelCode.trim();
    if (!trimmed) return null;
    return personnelList.find((p: any) => 
      (p.personnelCode && String(p.personnelCode).trim() === trimmed) ||
      (p.nationalCode && String(p.nationalCode).trim() === trimmed) ||
      (p.id && String(p.id).trim() === trimmed)
    );
  }, [newReport.capaOwnerPersonnelCode, personnelList]);

  // Helper: Calculate Next Report Number (e.g. REGAL-1405-001)
  const generateReportNumber = (eventDateStr: string) => {
    let year = '1405';
    if (eventDateStr) {
      const parts = eventDateStr.split('/');
      if (parts.length >= 1 && parts[0].length === 4) {
        year = parts[0];
      }
    }
    const prefix = `REGAL-${year}-`;
    const yearReports = incidents.filter(i => i.reportNumber && i.reportNumber.startsWith(prefix));
    let maxSeq = 0;
    yearReports.forEach(r => {
      const numPart = r.reportNumber.replace(prefix, '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  };

  // Helper: RPN & Risk Level Calculation
  const calculateRpnInfo = (prob: number, sev: number, det: number, envSev: number) => {
    const effSeverity = Math.max(sev, envSev);
    const rpn = prob * effSeverity * det; // Max = 5 * 5 * 5 = 125
    let levelFa = 'ریسک پایین';
    let color: 'green' | 'yellow' | 'red' = 'green';
    
    if (rpn >= 37) {
      levelFa = 'ریسک بالا';
      color = 'red';
    } else if (rpn >= 13) {
      levelFa = 'ریسک متوسط';
      color = 'yellow';
    } else {
      levelFa = 'ریسک پایین';
      color = 'green';
    }
    return { rpn, levelFa, color };
  };

  // Filtered Records
  const [incidentPage, setIncidentPage] = useState<number>(1);
  const [incidentPageSize, setIncidentPageSize] = useState<number>(25);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(item => {
      const matchSearch = 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.reportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.locationSite.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.reporterPersonnelCode && item.reporterPersonnelCode.includes(searchTerm));

      const matchCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchSeverity = severityFilter === 'ALL' || item.severity === severityFilter;

      return matchSearch && matchCategory && matchSeverity;
    });
  }, [incidents, searchTerm, categoryFilter, severityFilter]);

  // Reset page when filters change
  useEffect(() => {
    setIncidentPage(1);
  }, [searchTerm, categoryFilter, severityFilter]);

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

  // Helper to calculate Pyramid Stats for any array of incidents
  const calculatePyramidForList = (list: SafetyIncidentRecord[]) => {
    let unsafeActsCount = 0;
    let unsafeCondsCount = 0;
    let nearMissCount = 0;
    let firstAidCount = 0;
    let oshaRecordableCount = 0;
    let ltiCount = 0;

    let highSeverityTotal = 0;
    let recordableTotal = 0;
    let proactiveTotal = 0;

    const typeCounts: Record<string, number> = {};
    configuredIncidentTypes.forEach(t => {
      typeCounts[t.id] = 0;
    });

    list.forEach(inc => {
      if (inc.category === 'Unsafe Act') unsafeActsCount++;
      if (inc.category === 'Unsafe Condition') unsafeCondsCount++;
      if (inc.category === 'Near Miss') nearMissCount++;

      // Direct ID match
      if (inc.incidentTypeId && typeCounts[inc.incidentTypeId] !== undefined) {
        typeCounts[inc.incidentTypeId]++;
        const typeObj = configuredIncidentTypes.find(t => t.id === inc.incidentTypeId);
        if (typeObj?.group === 'high_severity') {
          highSeverityTotal++;
          ltiCount++;
        } else if (typeObj?.group === 'recordable') {
          recordableTotal++;
          if (typeObj.code === 'FAC') firstAidCount++;
          else oshaRecordableCount++;
        } else if (typeObj?.group === 'proactive') {
          proactiveTotal++;
        }
      } else {
        // Fallback for legacy records
        if (inc.category === 'Unsafe Act') {
          proactiveTotal++;
          const t = configuredIncidentTypes.find(x => x.code === 'UA' || x.titleFa.includes('عمل'));
          if (t) typeCounts[t.id] = (typeCounts[t.id] || 0) + 1;
        } else if (inc.category === 'Unsafe Condition') {
          proactiveTotal++;
          const t = configuredIncidentTypes.find(x => x.code === 'UC' || x.titleFa.includes('شرایط'));
          if (t) typeCounts[t.id] = (typeCounts[t.id] || 0) + 1;
        } else if (inc.category === 'Near Miss') {
          proactiveTotal++;
          const t = configuredIncidentTypes.find(x => x.code === 'NM' || x.titleFa.includes('شبه'));
          if (t) typeCounts[t.id] = (typeCounts[t.id] || 0) + 1;
        } else if (inc.category === 'Incident') {
          if (inc.severity === 'Critical / Lost Time (LTI)' || inc.severity === 'Fatality' || inc.severity === 'High / Restricted Work') {
            highSeverityTotal++;
            ltiCount++;
            const t = configuredIncidentTypes.find(x => x.code === 'LTI' || x.code === 'FAT' || x.code === 'RWC');
            if (t) typeCounts[t.id] = (typeCounts[t.id] || 0) + 1;
          } else {
            recordableTotal++;
            if (!inc.isOshaRecordable || inc.severity === 'Minor / First Aid') {
              firstAidCount++;
              const t = configuredIncidentTypes.find(x => x.code === 'FAC');
              if (t) typeCounts[t.id] = (typeCounts[t.id] || 0) + 1;
            } else {
              oshaRecordableCount++;
              const t = configuredIncidentTypes.find(x => x.code === 'MTC');
              if (t) typeCounts[t.id] = (typeCounts[t.id] || 0) + 1;
            }
          }
        }
      }
    });

    return {
      total: list.length,
      totalAnomalies: unsafeActsCount + unsafeCondsCount,
      unsafeActsCount,
      unsafeCondsCount,
      nearMissCount,
      firstAidCount,
      oshaRecordableCount,
      ltiCount,
      highSeverityTotal,
      recordableTotal,
      proactiveTotal,
      typeCounts
    };
  };

  // Helper to normalize digits via central utility
  const normalizeDigits = (str: string) => normalizeDigitsCentral(str, true).trim();

  const todayDateFaStr = useMemo(() => {
    try {
      const raw = new Date().toLocaleDateString('fa-IR');
      return normalizeDigits(raw);
    } catch (e) {
      return '1405/05/04';
    }
  }, []);

  const todayIsoDateStr = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Temporal subsets extracted directly and accurately from incident log book (incidents)
  const lastYearIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const d = normalizeDigits(inc.eventDate || inc.createdDate || '');
      return d.includes('1404') || d.includes('2025');
    });
  }, [incidents]);

  const currentYearIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const d = normalizeDigits(inc.eventDate || inc.createdDate || '');
      return d.includes('1405') || d.includes('2026') || d === todayDateFaStr || d === todayIsoDateStr;
    });
  }, [incidents, todayDateFaStr, todayIsoDateStr]);

  const dailyIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const d = normalizeDigits(inc.eventDate || inc.createdDate || '');
      const isTodayFa = d === todayDateFaStr || d === '1405/05/04' || d === '1405/5/4';
      const isTodayIso = d === todayIsoDateStr || d.includes('2026-07-26');
      const isKeywordToday = d.includes('امروز');
      return isTodayFa || isTodayIso || isKeywordToday;
    });
  }, [incidents, todayDateFaStr, todayIsoDateStr]);

  const lastYearStats = useMemo(() => calculatePyramidForList(lastYearIncidents), [lastYearIncidents, configuredIncidentTypes]);
  const currentYearStats = useMemo(() => calculatePyramidForList(currentYearIncidents), [currentYearIncidents, configuredIncidentTypes]);
  const dailyStats = useMemo(() => calculatePyramidForList(dailyIncidents), [dailyIncidents, configuredIncidentTypes]);
  const allTimeStats = useMemo(() => calculatePyramidForList(incidents), [incidents, configuredIncidentTypes]);

  // Primary active stats for single pyramid display
  const pyramidStats = useMemo(() => {
    if (pyramidPeriod === 'last_year') return lastYearStats;
    if (pyramidPeriod === 'current_year') return currentYearStats;
    if (pyramidPeriod === 'daily') return dailyStats;
    if (pyramidPeriod === 'all') return allTimeStats;
    return currentYearStats;
  }, [pyramidPeriod, lastYearStats, currentYearStats, dailyStats, allTimeStats]);

  // Category Chart Data
  const categoryChartData = useMemo(() => {
    return [
      { name: isFa ? 'عمل ناایمن' : 'Unsafe Act', value: incidents.filter(i => i.category === 'Unsafe Act').length },
      { name: isFa ? 'شرایط ناایمن' : 'Unsafe Condition', value: incidents.filter(i => i.category === 'Unsafe Condition').length },
      { name: isFa ? 'شبه حادثه' : 'Near Miss', value: incidents.filter(i => i.category === 'Near Miss').length },
      { name: isFa ? 'حادثه' : 'Incident', value: incidents.filter(i => i.category === 'Incident').length }
    ];
  }, [incidents, isFa]);

  // Create Report Handler
  const handleCreateReport = (e: React.FormEvent) => {
    e.preventDefault();

    const categoryFaMap: Record<IncidentCategory, AnomalyTypeFa> = {
      'Unsafe Act': 'عمل ناایمن',
      'Unsafe Condition': 'شرایط ناایمن',
      'Near Miss': 'شبه حادثه',
      'Incident': 'حادثه',
      'Toxic Gas Leak': 'نشت گازهای سمی'
    };

    const reportNum = generateReportNumber(newReport.eventDate);
    const isAnomalyRiskCategory = newReport.category === 'Unsafe Act' || newReport.category === 'Unsafe Condition' || newReport.category === 'Near Miss';
    
    let riskAssessmentData = undefined;
    if (isAnomalyRiskCategory) {
      const rpnInfo = calculateRpnInfo(
        newReport.riskProbability,
        newReport.riskSeverity,
        newReport.riskDetection,
        newReport.riskEnvSeverity
      );
      riskAssessmentData = {
        probability: newReport.riskProbability,
        severity: newReport.riskSeverity,
        detection: newReport.riskDetection,
        envSeverity: newReport.riskEnvSeverity,
        rpn: rpnInfo.rpn,
        riskLevelFa: rpnInfo.levelFa,
        riskLevelColor: rpnInfo.color
      };
    }

    const newRecPayload = {
      incidentNumber: reportNum,
      reportNumber: reportNum,
      category: newReport.category,
      categoryFa: categoryFaMap[newReport.category],
      title: newReport.title,
      eventDate: newReport.eventDate || '1405/01/01',
      eventTime: newReport.eventTime || '10:00',
      location: newReport.locationSite || 'واحد کارخانه',
      locationSite: newReport.locationSite || 'واحد کارخانه',
      department: newReport.department,
      reporterPersonnelCode: newReport.reporterPersonnelCode,
      reporterName: newReport.reporterName || currentUser.fullName || currentUser.username || '',
      reporterRole: currentUser.role,
      riskAssessment: riskAssessmentData,
      description: newReport.description,
      immediateActionTaken: newReport.immediateActionTaken,
      severity: newReport.category === 'Incident' ? newReport.severity : 'Minor / First Aid',
      isOshaRecordable: newReport.category === 'Incident' ? newReport.isOshaRecordable : false,
      lostDays: newReport.severity === 'High / Restricted Work' ? 3 : 0,
      injuredPersonName: newReport.injuredPersonName,
      bodyPartAffected: newReport.bodyPartAffected,
      rootCauses: {
        humanFactors: newReport.humanFactorsStr ? newReport.humanFactorsStr.split(',') : [],
        equipmentFactors: newReport.equipmentFactorsStr ? newReport.equipmentFactorsStr.split(',') : [],
        environmentalFactors: [],
        systemicFactors: []
      },
      fiveWhys: [],
      toxicGasLeak: newReport.category === 'Toxic Gas Leak' ? {
        gasType: newReport.toxicGasType,
        gasAmountPpm: newReport.toxicGasAmountPpm,
        windSpeed: newReport.toxicWindSpeed,
        windDirection: newReport.toxicWindDirection,
        leakLocations: newReport.toxicLeakLocations,
        leakDurationMinutes: newReport.toxicLeakDurationMinutes
      } : undefined,
      capaList: (newReport.capaDesc || newReport.capaOwner) ? [{
        id: '1',
        description: newReport.capaDesc || 'بررسی و پیگیری وضعیت ایمنی گزارش‌شده',
        responsiblePerson: newReport.capaOwner || currentUser.fullName,
        department: newReport.department,
        targetDate: '1405/02/01',
        status: 'Open' as const
      }] : [] as CapaAction[],
      status: 'Submitted' as const,
      createdDate: new Date().toLocaleDateString('fa-IR')
    };

    confirmFinalSubmit({
      isFa,
      onConfirm: async () => {
        try {
          const savedResult = await apiDb.saveIncident(newRecPayload);
          if (!savedResult || !savedResult.id) {
            toast.error(isFa ? 'خطا در ثبت گزارش حادثه در پایگاه داده سامانه. شناسه معتبر صادر نشد.' : 'Failed to receive valid record ID from backend.');
            return;
          }

          const createdRecord: SafetyIncidentRecord = {
            ...newRecPayload,
            id: String(savedResult.id),
            reportNumber: savedResult.incidentNumber || savedResult.reportNumber || reportNum,
            status: (savedResult.status || 'Submitted') as any
          };

          saveIncidentsToStorage([createdRecord, ...incidents]);

          // Dispatch Central Notification with Popup
          const isCritical = createdRecord.severity === 'Fatality' || createdRecord.severity === 'Critical / Lost Time (LTI)';
          CentralNotificationService.sendNotification({
            title: `گزارش رویداد/حادثه: ${createdRecord.reportNumber}`,
            body: `گزارش جدید با عنوان "${createdRecord.title}" (${createdRecord.severity || 'متوسط'}) در واحد ${createdRecord.department || 'عملیاتی'} ثبت گردید.`,
            category: isCritical ? 'critical_hse' : 'warning',
            priority: isCritical ? 'critical' : 'high',
            sourceModule: 'incidents',
            type: 'popup',
            triggerPopup: true,
            actionUrl: '#incidents',
            recordId: createdRecord.reportNumber,
            sender: currentUser.fullName || currentUser.username,
            playSound: true,
          }).catch(() => {});

          setShowNewModal(false);
          setNewReport({
            category: 'Unsafe Act',
            incidentTypeId: '',
            title: '',
            eventDate: new Date().toLocaleDateString('fa-IR'),
            eventTime: '10:00',
            locationSite: '',
            department: '',
            reporterPersonnelCode: '',
            reporterName: '',
            description: '',
            immediateActionTaken: '',
            severity: 'Minor / First Aid',
            isOshaRecordable: false,
            injuredPersonName: '',
            bodyPartAffected: 'None',
            humanFactorsStr: '',
            equipmentFactorsStr: '',
            capaDesc: '',
            capaOwnerPersonnelCode: '',
            capaOwner: '',
            riskProbability: 2,
            riskSeverity: 2,
            riskDetection: 2,
            riskEnvSeverity: 1,
            toxicGasType: '',
            toxicGasAmountPpm: 0,
            toxicWindSpeed: '',
            toxicWindDirection: '',
            toxicLeakLocations: '',
            toxicLeakDurationMinutes: 0
          });
        } catch (err: any) {
          toast.error(err.message || (isFa ? 'خطا در ذخیره‌سازی حادثه در پایگاه داده' : 'Database error'));
        }
      }
    });
  };

  // Export CSV
  const exportToCsv = () => {
    let csv = 'شماره گزارش,دسته بندی,عنوان,تاریخ,مکان,واحد,شدت,OSHA Recordable,وضعیت\n';
    incidents.forEach(r => {
      csv += `${r.reportNumber},${r.categoryFa},${r.title},${r.eventDate},${r.locationSite},${r.department},${r.severity},${r.isOshaRecordable ? 'بله' : 'خیر'},${r.status}\n`;
    });
    downloadCsvFile(`OSHA_Safety_Incidents_Log_${Date.now()}.csv`, csv);
  };

  return (
    <div className="space-y-6 pb-12" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-rose-900/50">
        <div className="absolute top-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-rose-500/30 text-rose-300 border border-rose-400/30 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                OSHA 29 CFR 1904 Standard
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-blue-400/20 text-[10px] font-bold px-2.5 py-1 rounded-full">
                {isFa ? 'سامانه ثبت ناهنجاری‌ها، شبه‌حوادث و حوادث' : 'Safety Anomaly & Incident System'}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black flex items-center gap-3 text-white">
              <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
              {isFa ? 'گزارشات ناهنجاری و حوادث کارگاهی' : 'Unsafe Act, Condition, Near Miss & Incident Portal'}
            </h1>
            <p className="text-slate-300 text-xs max-w-3xl leading-relaxed">
              {isFa 
                ? 'ثبت و تحلیل ۴ سطح ناهنجاری (عمل ناایمن، شرایط ناایمن، شبه حادثه، حادثه)، ریشه‌یابی علل (RCA)، اقدام اصلاحی (CAPA) و صدور فرم‌های استاندارد OSHA 300 و OSHA 301.' 
                : 'Reporting, RCA analysis, CAPA actions, OSHA 300 log & OSHA 301 incident reporting compliant with OSHA standards.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowNewModal(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-black text-xs px-4 py-3 rounded-2xl shadow-lg transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {isFa ? 'ثبت گزارش ناهنجاری / حادثه جدید' : 'Report Incident / Anomaly'}
            </button>
            <button
              onClick={exportToCsv}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-3 rounded-2xl border border-white/10 transition flex items-center gap-2"
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
            <FileText className="w-4 h-4 text-rose-600" />
            {isFa ? 'دفتر ثبت گزارشات' : 'Incident Log Ledger'}
            <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-1.5 py-0.5 rounded-full">
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
            <Layers className="w-4 h-4 text-amber-500" />
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
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            {isFa ? 'نمودارها و تحلیل آماری' : 'Analytics & Charts'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="hse-stagger-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'کل اعمال و شرایط ناایمن' : 'Total Unsafe Acts/Cond.'}</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1 font-mono">{pyramidStats.totalAnomalies}</h3>
          </div>
          <div className="hse-card-icon p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'شبه‌حوادث (Near Misses)' : 'Near Misses'}</p>
            <h3 className="text-2xl font-black text-sky-600 mt-1 font-mono">{pyramidStats.nearMissCount}</h3>
          </div>
          <div className="hse-card-icon p-3 bg-sky-50 text-sky-600 rounded-2xl">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'حوادث قابل ثبت (OSHA Recordable)' : 'OSHA Recordables'}</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1 font-mono">{pyramidStats.oshaRecordableCount}</h3>
          </div>
          <div className="hse-card-icon p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="hse-motion-card bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold">{isFa ? 'حوادث منجر به روز تلف‌شده (LTI)' : 'Lost Time Injury (LTI)'}</p>
            <h3 className="text-2xl font-black text-purple-600 mt-1 font-mono">{pyramidStats.ltiCount}</h3>
          </div>
          <div className="hse-card-icon p-3 bg-purple-50 text-purple-600 rounded-2xl">
            <UserX className="w-6 h-6" />
          </div>
        </div>
      </div>

      <SubViewTransition viewKey={activeTab} isFa={isFa}>
      {/* TAB 1: INCIDENT LOG LEDGER */}
      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={isFa ? 'جستجو بر اساس عنوان، کد گزارش، مکان، نام گزارش‌دهنده...' : 'Search title, code, site...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه ۴ دسته‌بندی' : 'All Categories'}</option>
                <option value="Unsafe Act">{isFa ? 'عمل ناایمن' : 'Unsafe Act'}</option>
                <option value="Unsafe Condition">{isFa ? 'شرایط ناایمن' : 'Unsafe Condition'}</option>
                <option value="Near Miss">{isFa ? 'شبه حادثه' : 'Near Miss'}</option>
                <option value="Incident">{isFa ? 'حادثه' : 'Incident'}</option>
                <option value="Toxic Gas Leak">{isFa ? 'نشت گازهای سمی' : 'Toxic Gas Leak'}</option>
              </select>

              <select
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">{isFa ? 'همه سطوح شدت' : 'All Severities'}</option>
                <option value="Minor / First Aid">{isFa ? 'جزیی / کمک اولیه' : 'First Aid'}</option>
                <option value="Moderate / Medical Treatment">{isFa ? 'متوسط / درمان پزشکی' : 'Medical Treatment'}</option>
                <option value="High / Restricted Work">{isFa ? 'شدید / کار محدود' : 'Restricted Work'}</option>
                <option value="Critical / Lost Time (LTI)">{isFa ? 'بحرانی / زمان تلف‌شده' : 'LTI'}</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-black border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">{isFa ? 'کد گزارش' : 'Report ID'}</th>
                  <th className="p-3.5">{isFa ? 'دسته ناهنجاری' : 'Category'}</th>
                  <th className="p-3.5">{isFa ? 'عنوان و شرح مختصر' : 'Title & Summary'}</th>
                  <th className="p-3.5">{isFa ? 'تاریخ و زمان' : 'Date / Time'}</th>
                  <th className="p-3.5">{isFa ? 'محل و واحد' : 'Site / Department'}</th>
                  <th className="p-3.5">{isFa ? 'سطح شدت' : 'Severity'}</th>
                  <th className="p-3.5">{isFa ? 'OSHA Recordable' : 'OSHA Status'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'فرم تکمیلی حادثه (RHS-F34)' : 'Supplementary Form'}</th>
                  <th className="p-3.5">{isFa ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'عملیات' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedIncidents.length > 0 ? (
                  paginatedIncidents.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50/80 transition">
                      <td className="p-3.5 font-mono">
                        <span className="block font-bold text-rose-600 text-xs">{row.reportNumber}</span>
                        {row.riskAssessment && (
                          <div className={`mt-1.5 block w-fit text-[10px] font-black px-2 py-0.5 rounded-md whitespace-nowrap ${
                            row.riskAssessment.riskLevelColor === 'red' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                            row.riskAssessment.riskLevelColor === 'yellow' ? 'bg-amber-100 text-amber-900 border border-blue-300' :
                            'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}>
                            RPN: {row.riskAssessment.rpn} ({row.riskAssessment.riskLevelFa})
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${
                            row.category === 'Unsafe Act' ? 'bg-amber-100 text-amber-800' :
                            row.category === 'Unsafe Condition' ? 'bg-indigo-100 text-indigo-800' :
                            row.category === 'Toxic Gas Leak' ? 'bg-purple-100 text-purple-800' :
                            row.category === 'Near Miss' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {row.categoryFa}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100 block max-w-xs truncate">{row.title}</span>
                        <span className="text-[10px] text-slate-500 block font-normal">
                          {isFa ? 'گزارش‌دهنده:' : 'By:'} {row.reporterName} 
                          {row.reporterPersonnelCode ? ` (کد: ${row.reporterPersonnelCode})` : ` (${row.reporterRole})`}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <DualDateBadge dateStr={row.eventDate} showTime={false} />
                        <span className="block text-[10px] text-slate-400 font-mono">{row.eventTime}</span>
                      </td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-200">
                        {row.department}
                        <span className="block text-[10px] text-slate-400">{row.locationSite}</span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                        {row.severity}
                      </td>
                      <td className="p-3.5">
                        {row.isOshaRecordable ? (
                          <span className="bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded-md">
                            OSHA 300 Yes
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 font-bold text-[9px] px-2 py-0.5 rounded-md">
                            Non-Recordable
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {row.category === 'Incident' ? (() => {
                          const suppForm = getSupplementaryFormByIncidentId(row.id, row, currentUser);
                          const deadline = calculateDeadlineInfo(suppForm.startDate?.replace(/\./g, '/') || row.eventDate, suppForm.status);
                          
                          return (
                            <button
                              onClick={() => setSelectedIncidentForSupplementary(row)}
                              className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black transition flex flex-col items-center justify-center gap-0.5 mx-auto border shadow-sm ${
                                suppForm.status === 'completed'
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : suppForm.status === 'expired' || deadline.isExpired
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                                  : suppForm.status === 'in_progress'
                                  ? 'bg-amber-50 hover:bg-blue-100 text-amber-900 border-blue-300'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                              }`}
                              title={isFa ? 'مشاهده و تکمیل فرم تجزیه و تحلیل رویداد (RHS-F34)' : 'Incident Supplementary Form (RHS-F34)'}
                            >
                              <div className="flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5 text-rose-600" />
                                <span>
                                  {suppForm.status === 'completed' ? (isFa ? 'تکمیل شده' : 'Completed') :
                                   suppForm.status === 'expired' || deadline.isExpired ? (isFa ? 'منقضی شده' : 'Expired') :
                                   suppForm.status === 'in_progress' ? (isFa ? 'در حال تکمیل' : 'In Progress') :
                                   (isFa ? 'فرم تکمیلی' : 'Form RHS-F34')}
                                </span>
                              </div>
                              <span className="text-[9px] font-normal opacity-90">
                                {suppForm.status === 'completed' 
                                  ? (isFa ? '✓ پیوست به پرونده' : 'Attached')
                                  : deadline.daysRemaining > 0 
                                  ? (isFa ? `${deadline.daysRemaining} روز مهلت` : `${deadline.daysRemaining}d left`)
                                  : deadline.daysRemaining === 0
                                  ? (isFa ? 'آخرین روز مهلت' : 'Last day')
                                  : (isFa ? 'مهلت پایان یافته' : 'Overdue')}
                              </span>
                            </button>
                          );
                        })() : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {canEditReportStatus(row) ? (
                          <div className="space-y-1">
                            <select
                              value={row.status}
                              onChange={e => handleUpdateIncidentStatus(row.id, e.target.value as SafetyIncidentRecord['status'])}
                              className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition cursor-pointer shadow-sm focus:outline-none focus:ring-2 ${
                                row.status === 'Resolved & Closed' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500' :
                                row.status === 'CAPA In Progress' ? 'bg-amber-50 text-amber-800 border-blue-300 focus:ring-blue-500' :
                                row.status === 'Under Investigation' ? 'bg-sky-50 text-sky-800 border-sky-300 focus:ring-sky-500' :
                                'bg-slate-100 text-slate-800 border-slate-300 focus:ring-slate-500'
                              }`}
                            >
                              <option value="Submitted">{isFa ? 'ثبت اولیه / در انتظار بررسی' : 'Submitted'}</option>
                              <option value="Under Investigation">{isFa ? 'در حال بررسی و پیگیری' : 'Under Investigation'}</option>
                              <option value="CAPA In Progress">{isFa ? 'در حال اجرای اقدام اصلاحی' : 'CAPA In Progress'}</option>
                              <option value="Resolved & Closed">{isFa ? 'مختومه و بسته‌شده' : 'Resolved & Closed'}</option>
                            </select>
                            <span className="block text-[9px] text-emerald-700 font-bold">
                              {isFa ? '✓ قابل ویرایش توسط شما' : 'Editable by you'}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                              row.status === 'Resolved & Closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                              row.status === 'CAPA In Progress' ? 'bg-amber-50 text-amber-700 border-blue-200' :
                              row.status === 'Under Investigation' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {row.status === 'Resolved & Closed' ? (isFa ? 'مختومه و بسته‌شده' : 'Resolved & Closed') :
                               row.status === 'CAPA In Progress' ? (isFa ? 'در حال اجرای اقدام اصلاحی' : 'CAPA In Progress') :
                               row.status === 'Under Investigation' ? (isFa ? 'در حال بررسی' : 'Under Investigation') :
                               (isFa ? 'ثبت اولیه' : 'Submitted')}
                            </span>
                            <span className="block text-[9px] text-slate-400 font-normal mt-0.5" title={isFa ? 'تغییر وضعیت فقط توسط مسئول اقدام یا رئیس مرکز HSE' : 'Locked for other users'}>
                              {isFa ? '🔒 غیرقابل ویرایش' : 'Locked'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedIncidentForDetail(row)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                            title={isFa ? 'مشاهده کامل' : 'View Details'}
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            {isFa ? 'جزئیات' : 'Details'}
                          </button>
                          <button
                            onClick={() => setReferralTargetIncident(row)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title={isFa ? 'ارجاع، تأیید و امضا' : 'Referral & Sign'}
                          >
                            <Send className="w-3.5 h-3.5 text-blue-600" />
                            {isFa ? 'ارجاع' : 'Refer'}
                          </button>
                          <button
                            onClick={() => setTrackerTargetIncident(row)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                            title={isFa ? 'رهگیری گردش کار و امضاها' : 'Workflow Tracker'}
                          >
                            <History className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleStartEditIncident(row)}
                            className="px-2 py-1 bg-amber-50 hover:bg-blue-100 text-amber-800 rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                            title={isFa ? 'ویرایش کامل گزارش (فقط مدیر اصلی)' : 'Edit Report (Admin Only)'}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                            {isFa ? 'ویرایش' : 'Edit'}
                          </button>
                          <button
                            onClick={() => handleDeleteIncident(row.id)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                            title={isFa ? 'حذف گزارش (فقط مدیر اصلی)' : 'Delete Report (Admin Only)'}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            {isFa ? 'حذف' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
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

      {/* TAB 4: STATS & CHARTS */}
      {activeTab === 'stats' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            {isFa ? 'تحلیل توزیع ناهنجاری‌ها و حوادث' : 'Incident Category Distribution'}
          </h2>

          <div className="h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height={310} minWidth={0} minHeight={280} debounce={50}>
              <PieChart>
                <Pie data={categoryChartData} cx="50%" cy="50%" outerRadius={110} dataKey="value" label>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${entry.name || index}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </SubViewTransition>

      {/* NEW REPORT MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-rose-600" />
                  {isFa ? 'فرم ثبت گزارش ناهنجاری / حادثه (استاندارد HSE)' : 'New Safety Incident Form'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                  <span>{isFa ? 'کد گزارش اختصاصی تولیدی:' : 'Generated Report Code:'}</span>
                  <span className="font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    {generateReportNumber(newReport.eventDate)}
                  </span>
                </p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-400 font-bold text-sm">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-4 text-xs">
              {/* Category & Severity Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'دسته‌بندی ناهنجاری / حادثه' : 'Category'}</label>
                  <select
                    value={newReport.category}
                    onChange={e => {
                      const cat = e.target.value as IncidentCategory;
                      setNewReport(prev => ({
                        ...prev,
                        category: cat,
                        incidentTypeId: cat === 'Incident' ? prev.incidentTypeId : ''
                      }));
                    }}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-rose-500 font-bold"
                  >
                    <option value="Unsafe Act">{isFa ? 'عمل ناایمن (Unsafe Act)' : 'Unsafe Act'}</option>
                    <option value="Unsafe Condition">{isFa ? 'شرایط ناایمن (Unsafe Condition)' : 'Unsafe Condition'}</option>
                    <option value="Near Miss">{isFa ? 'شبه حادثه (Near Miss)' : 'Near Miss'}</option>
                    <option value="Incident">{isFa ? 'حادثه (Incident/Accident)' : 'Incident'}</option>
                    <option value="Toxic Gas Leak">{isFa ? 'نشت گازهای سمی (Toxic Gas Leak)' : 'Toxic Gas Leak'}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-200">
                      {isFa ? 'نوع و سطح شدت حادثه (تعاریف ساختار سازمانی)' : 'Incident Type & Severity'}
                    </label>
                    {newReport.category !== 'Incident' ? (
                      <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-blue-200">
                        {isFa ? 'تنها برای حادثه فعال است' : 'Active for Incidents only'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        {isFa ? '۲ سطح ساختار سازمانی' : 'Org 2-Tier'}
                      </span>
                    )}
                  </div>

                  <select
                    disabled={newReport.category !== 'Incident'}
                    value={newReport.category === 'Incident' ? newReport.incidentTypeId : ''}
                    onChange={e => {
                      const selectedTypeId = e.target.value;
                      const selectedType = configuredIncidentTypes.find(t => t.id === selectedTypeId);
                      if (selectedType) {
                        let oshaSev: OshaSeverityLevel = 'Minor / First Aid';
                        let isRecordable = true;

                        if (selectedType.code === 'FAT' || selectedType.code === 'LTI' || selectedType.group === 'high_severity') {
                          oshaSev = selectedType.code === 'RWC' ? 'High / Restricted Work' : 'Critical / Lost Time (LTI)';
                        } else if (selectedType.code === 'MTC') {
                          oshaSev = 'Moderate / Medical Treatment';
                        } else if (selectedType.code === 'FAC') {
                          oshaSev = 'Minor / First Aid';
                          isRecordable = false;
                        } else {
                          oshaSev = 'Moderate / Medical Treatment';
                        }

                        setNewReport(prev => ({
                          ...prev,
                          incidentTypeId: selectedTypeId,
                          severity: oshaSev,
                          isOshaRecordable: isRecordable,
                          title: !prev.title.trim() ? selectedType.titleFa : prev.title
                        }));
                      } else {
                        setNewReport(prev => ({ ...prev, incidentTypeId: '' }));
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold transition ${
                      newReport.category === 'Incident'
                        ? 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-rose-500 text-slate-800'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-75'
                    }`}
                  >
                    {newReport.category !== 'Incident' ? (
                      <option value="">{isFa ? '— مربوط به گزارش ناهنجاری و پیشگیرانه —' : '— Proactive Anomaly —'}</option>
                    ) : (
                      <>
                        <option value="">{isFa ? '-- انتخاب نوع حادثه (از ساختار سازمانی) --' : '-- Select Incident Type --'}</option>
                        
                        {/* 🔴 High Severity Incidents (حوادث با شدت بالا) */}
                        <optgroup label={isFa ? '🔴 حوادث با شدت بالا (High Severity Incidents)' : '🔴 High Severity Incidents'}>
                          {configuredIncidentTypes.filter(t => t.group === 'high_severity').map(type => (
                            <option key={type.id} value={type.id}>
                              {type.titleFa} {type.code ? `(${type.code})` : ''}
                            </option>
                          ))}
                        </optgroup>

                        {/* 🟡 Recordable Incidents (حوادث و رویدادهای قابل ثبت) */}
                        <optgroup label={isFa ? '🟡 حوادث و رویدادهای قابل ثبت (Recordable Incidents)' : '🟡 Recordable Incidents'}>
                          {configuredIncidentTypes.filter(t => t.group === 'recordable').map(type => (
                            <option key={type.id} value={type.id}>
                              {type.titleFa} {type.code ? `(${type.code})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>

                  {newReport.category === 'Incident' && selectedIncidentTypeObj && (
                    <div className="mt-2 p-2 bg-rose-50/80 border border-rose-200 rounded-xl text-[11px] text-rose-900 space-y-0.5">
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          {selectedIncidentTypeObj.group === 'high_severity' 
                            ? (isFa ? '🔴 سطح: حادثه با شدت بالا' : '🔴 Tier: High Severity')
                            : (isFa ? '🟡 سطح: حادثه و رویداد قابل ثبت' : '🟡 Tier: Recordable Incident')}
                        </span>
                        {selectedIncidentTypeObj.code && (
                          <span className="bg-rose-100 px-1.5 py-0.5 rounded font-mono text-[10px] text-rose-800">
                            {selectedIncidentTypeObj.code}
                          </span>
                        )}
                      </div>
                      {selectedIncidentTypeObj.descriptionFa && (
                        <p className="text-slate-600 dark:text-slate-400 font-normal leading-relaxed mt-0.5">
                          {selectedIncidentTypeObj.descriptionFa}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {newReport.category !== 'Toxic Gas Leak' && (
                <>
                  {/* Personnel Reporter & Report Details Section */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold mb-1">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>{isFa ? 'اطلاعات گزارش‌دهنده و مشخصات گزارش' : 'Reporter Information & Details'}</span>
                </div>

                {/* Row 1: Central Personnel Search & Reporter Info */}
                <div className="pb-1">
                  <CentralPersonnelSelector
                    label={isFa ? 'جستجو و انتخاب گزارش‌دهنده از «اطلاعات پرسنل» (کد پرسنلی، نام یا کد ملی)' : 'Select Reporter from Central Personnel'}
                    value={newReport.reporterName ? `${newReport.reporterName} (${newReport.reporterPersonnelCode || ''})` : ''}
                    selectedPersonnelCode={newReport.reporterPersonnelCode || ''}
                    isFa={isFa}
                    onSelect={(person) => {
                      if (!person) return;
                      const code = person.effectiveCode || person.personnelCode || '';
                      setNewReport(prev => ({
                        ...prev,
                        reporterPersonnelCode: code,
                        reporterName: person.fullName || `${person.firstName} ${person.lastName}`.trim(),
                        department: person.unit || person.department || prev.department,
                        locationSite: prev.locationSite || person.subUnit || person.workplace || ''
                      }));
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'شماره پرسنلی گزارش‌دهنده' : 'Personnel Code'}</label>
                    <input
                      type="text"
                      value={newReport.reporterPersonnelCode}
                      onChange={e => handlePersonnelCodeChange(e.target.value)}
                      placeholder="مثال: 1 یا EMP-1024"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'نام و نام خانوادگی گزارش‌دهنده' : 'Reporter Name'}</label>
                    <input
                      type="text"
                      required
                      value={newReport.reporterName}
                      onChange={e => setNewReport({ ...newReport, reporterName: e.target.value })}
                      placeholder="نام و نام خانوادگی..."
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'واحد کاری گزارش‌دهنده (خودکار)' : 'Reporter Work Unit'}</label>
                    <select
                      value={newReport.department}
                      onChange={e => setNewReport({ ...newReport, department: e.target.value })}
                      required
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">{isFa ? '-- انتخاب واحد سازمانی --' : '-- Select Department --'}</option>
                      {departmentList.length === 0 && (
                        <option value="" disabled>
                          {isFa ? '⚠️ هنوز واحدی در ساختار سازمانی تعریف نشده است' : '⚠️ No units defined in Org Structure'}
                        </option>
                      )}
                      {departmentList.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Date, Time, Unit / Location (UNIT) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'تاریخ وقوع / ثبت' : 'Date'}</label>
                    <PersianDatePicker
                      value={newReport.eventDate}
                      onChange={(jStr) => setNewReport({ ...newReport, eventDate: jStr })}
                      isFa={isFa}
                      placeholder={isFa ? 'انتخاب تاریخ وقوع...' : 'Event date...'}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'ساعت' : 'Time'}</label>
                    <PersianTimePicker
                      value={newReport.eventTime}
                      onChange={(t) => setNewReport({ ...newReport, eventTime: t })}
                      isFa={isFa}
                      placeholder="14:30"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'واحد / محل (UNIT)' : 'Unit / Location (UNIT)'}</label>
                    <input
                      type="text"
                      value={newReport.locationSite}
                      onChange={e => setNewReport({ ...newReport, locationSite: e.target.value })}
                      placeholder="مثال: یونیت 101 - کمپرسور خانه"
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Row 3: Report Title & Description */}
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'عنوان صریح گزارش' : 'Report Title'}</label>
                  <input
                    type="text"
                    required
                    value={newReport.title}
                    onChange={e => setNewReport({ ...newReport, title: e.target.value })}
                    placeholder="مثال: عدم استفاده از عینک ایمنی هنگام فرزکاری"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'شرح گزارش' : 'Report Description'}</label>
                  <textarea
                    rows={3}
                    required
                    value={newReport.description}
                    onChange={e => setNewReport({ ...newReport, description: e.target.value })}
                    placeholder="توضیحات دقیق شرایط و نحوه مشاهده رویداد / ناهنجاری..."
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">{isFa ? 'اقدام فوری انجام‌شده' : 'Immediate Action'}</label>
                  <input
                    type="text"
                    value={newReport.immediateActionTaken}
                    onChange={e => setNewReport({ ...newReport, immediateActionTaken: e.target.value })}
                    placeholder="مثال: توقف کار و ایمن‌سازی محل"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>

                {matchedPersonnel ? (
                  <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {isFa ? `✓ شناسه پرسنلی تأیید شد: ${matchedPersonnel.firstName} ${matchedPersonnel.lastName}` : `Matched: ${matchedPersonnel.firstName} ${matchedPersonnel.lastName}`}
                    </span>
                    {matchedPersonnel.unit && (
                      <span className="text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md text-[10px]">
                        {isFa ? `واحد کاری: ${matchedPersonnel.unit}` : `Unit: ${matchedPersonnel.unit}`}
                      </span>
                    )}
                  </div>
                ) : newReport.reporterPersonnelCode ? (
                  <div className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-blue-200">
                    {isFa ? 'کد پرسنلی واردشده در تنظیمات پرسنل یافت نشد (می‌توانید اطلاعات را دستی وارد کنید).' : 'Code not found in personnel list.'}
                  </div>
                ) : null}
              </div>

              {/* Action Responsible Person & Corrective Action Section */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-emerald-900 font-bold border-b border-emerald-100 pb-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isFa ? 'تعیین مسئول اقدام و اقدام اصلاحی / پیشگیرانه (CAPA)' : 'Action Responsible Person'}</span>
                </div>

                <div className="pb-1">
                  <CentralPersonnelSelector
                    label={isFa ? 'جستجو و انتخاب مسئول اقدام از «اطلاعات پرسنل» (کد پرسنلی، نام یا کد ملی)' : 'Select Action Owner from Central Personnel'}
                    value={newReport.capaOwner ? `${newReport.capaOwner} (${newReport.capaOwnerPersonnelCode || ''})` : ''}
                    selectedPersonnelCode={newReport.capaOwnerPersonnelCode || ''}
                    isFa={isFa}
                    onSelect={(person) => {
                      if (!person) return;
                      const code = person.effectiveCode || person.personnelCode || '';
                      setNewReport(prev => ({
                        ...prev,
                        capaOwnerPersonnelCode: code,
                        capaOwner: person.fullName || `${person.firstName} ${person.lastName}`.trim()
                      }));
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'کد پرسنلی مسئول اقدام' : 'Action Owner Code'}</label>
                    <input
                      type="text"
                      value={newReport.capaOwnerPersonnelCode}
                      onChange={e => handleCapaOwnerCodeChange(e.target.value)}
                      placeholder="مثال: 2 یا EMP-1025"
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نام و نام خانوادگی مسئول اقدام' : 'Action Owner Name'}</label>
                    <input
                      type="text"
                      value={newReport.capaOwner}
                      onChange={e => setNewReport({ ...newReport, capaOwner: e.target.value })}
                      placeholder="نام و نام خانوادگی مسئول..."
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {matchedCapaOwner ? (
                  <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 bg-white dark:bg-slate-900/80 p-2 rounded-xl border border-emerald-200 shadow-sm">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {isFa ? `✓ مسئول اقدام شناسایی شد: ${matchedCapaOwner.firstName} ${matchedCapaOwner.lastName}` : `Matched: ${matchedCapaOwner.firstName} ${matchedCapaOwner.lastName}`}
                    </span>
                    {matchedCapaOwner.unit && (
                      <span className="text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md text-[10px]">
                        {isFa ? `واحد: ${matchedCapaOwner.unit}` : `Unit: ${matchedCapaOwner.unit}`}
                      </span>
                    )}
                  </div>
                ) : newReport.capaOwnerPersonnelCode ? (
                  <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-blue-200">
                    {isFa ? 'کد پرسنلی مسئول اقدام در سامانه پرسنل یافت نشد (می‌توانید نام را دستی وارد کنید).' : 'Personnel code not found in personnel list.'}
                  </div>
                ) : null}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'شرح اقدام اصلاحی / پیشگیرانه پیشنهادی' : 'Action Description'}</label>
                  <textarea
                    rows={2}
                    value={newReport.capaDesc}
                    onChange={e => setNewReport({ ...newReport, capaDesc: e.target.value })}
                    placeholder="توضیحات اقداماتی که جهت پیشگیری از تکرار مجدد باید انجام شود..."
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Risk Assessment Section (Activated AFTER Action Responsible Person is assigned) */}
              {(newReport.category === 'Unsafe Act' || newReport.category === 'Unsafe Condition' || newReport.category === 'Near Miss') && (
                <div className={`p-3.5 border rounded-2xl space-y-3 transition ${
                  newReport.capaOwner && newReport.capaOwner.trim()
                    ? 'bg-gradient-to-br from-indigo-50/80 to-slate-50 border-indigo-200'
                    : 'bg-slate-50 border-slate-200 opacity-90'
                }`}>
                  <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                    <h4 className="font-black text-xs text-indigo-900 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-indigo-600" />
                      {isFa ? 'ارزیابی ریسک و محاسبه عدد اولویت ریسک (RPN)' : 'Risk Assessment & RPN Calculator'}
                    </h4>
                    {newReport.capaOwner && newReport.capaOwner.trim() ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <span>✓</span>
                        {isFa ? `فعال برای مسئول: ${newReport.capaOwner}` : `Active for: ${newReport.capaOwner}`}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                        <Info className="w-3 h-3 text-amber-600" />
                        {isFa ? 'نیازمند تعیین مسئول اقدام' : 'Requires Action Owner'}
                      </span>
                    )}
                  </div>

                  {newReport.capaOwner && newReport.capaOwner.trim() ? (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'ضریب احتمال' : 'Probability'}</label>
                          <select
                            value={newReport.riskProbability}
                            onChange={e => setNewReport({ ...newReport, riskProbability: Number(e.target.value) })}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value={1}>1 - خیلی کم</option>
                            <option value={2}>2 - کم</option>
                            <option value={3}>3 - متوسط</option>
                            <option value={4}>4 - زیاد</option>
                            <option value={5}>5 - خیلی زیاد</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'ضریب شدت' : 'Severity'}</label>
                          <select
                            value={newReport.riskSeverity}
                            onChange={e => setNewReport({ ...newReport, riskSeverity: Number(e.target.value) })}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value={1}>1 - ناچیز</option>
                            <option value={2}>2 - جزئی</option>
                            <option value={3}>3 - متوسط</option>
                            <option value={4}>4 - با اهمیت</option>
                            <option value={5}>5 - بحرانی</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'ضریب کشف' : 'Detection'}</label>
                          <select
                            value={newReport.riskDetection}
                            onChange={e => setNewReport({ ...newReport, riskDetection: Number(e.target.value) })}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value={1}>1 - حتماً کشف می‌شود</option>
                            <option value={2}>2 - کشف بالا</option>
                            <option value={3}>3 - کشف متوسط</option>
                            <option value={4}>4 - کشف پایین</option>
                            <option value={5}>5 - غیرقابل کشف</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'شدت زیست‌محیطی' : 'Env Severity'}</label>
                          <select
                            value={newReport.riskEnvSeverity}
                            onChange={e => setNewReport({ ...newReport, riskEnvSeverity: Number(e.target.value) })}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value={1}>1 - بدون اثر</option>
                            <option value={2}>2 - اثر جزئی</option>
                            <option value={3}>3 - اثر متوسط</option>
                            <option value={4}>4 - اثر شدید</option>
                            <option value={5}>5 - آلودگی گسترده</option>
                          </select>
                        </div>
                      </div>

                      {/* Calculated RPN & Highlighted Risk Level */}
                      {(() => {
                        const rpnInfo = calculateRpnInfo(
                          newReport.riskProbability,
                          newReport.riskSeverity,
                          newReport.riskDetection,
                          newReport.riskEnvSeverity
                        );
                        return (
                          <div className="flex flex-wrap items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{isFa ? 'عدد RPN محاسبه‌شده:' : 'Calculated RPN:'}</span>
                              <span className="text-xl font-black font-mono text-slate-900">{rpnInfo.rpn}</span>
                              <span className="text-[10px] text-slate-400 font-mono">(1 الی 125)</span>
                            </div>

                            <div className={`px-4 py-1.5 rounded-xl text-xs font-black shadow-sm transition ${
                              rpnInfo.color === 'red' ? 'bg-rose-600 text-white shadow-rose-200' :
                              rpnInfo.color === 'yellow' ? 'bg-amber-400 text-amber-950 shadow-amber-200' :
                              'bg-emerald-500 text-white shadow-emerald-200'
                            }`}>
                              {isFa ? `سطح ریسک: ${rpnInfo.levelFa}` : `Level: ${rpnInfo.levelFa}`}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="p-3 bg-amber-50/80 border border-blue-200/80 rounded-xl text-amber-900 flex items-center gap-2 text-xs font-bold">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        {isFa
                          ? 'ارزیابی ریسک پس از تعیین کد پرسنلی یا نام مسئول اقدام در کادر بالا، برای آن شخص فعال می‌گردد.'
                          : 'Risk assessment will be enabled after assigning the Action Owner above.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              </>
              )}

              {/* Toxic Gas Leak Section */}
              {newReport.category === 'Toxic Gas Leak' && (
                <div className="border border-purple-200 rounded-xl overflow-hidden mb-3">
                  <div className="bg-purple-50 p-3 flex items-center justify-between border-b border-purple-200">
                    <div className="flex items-center gap-2">
                      <strong className="text-purple-900 text-xs">
                        {isFa ? 'جزئیات نشت گاز سمی' : 'Toxic Gas Leak Details'}
                      </strong>
                    </div>
                  </div>
                  <div className="p-3 bg-purple-50/30 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'کد پرسنلی گزارش‌دهنده' : 'Personnel Code'}</label>
                        <input
                          type="text"
                          value={newReport.reporterPersonnelCode}
                          onChange={e => handlePersonnelCodeChange(e.target.value)}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نام و نام خانوادگی' : 'Full Name'}</label>
                        <input
                          type="text"
                          value={newReport.reporterName}
                          onChange={e => setNewReport({ ...newReport, reporterName: e.target.value })}
                          className="w-full p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-purple-500 focus:outline-none"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نوع گاز' : 'Gas Type'}</label>
                        <select
                          value={newReport.toxicGasType}
                          onChange={e => setNewReport({ ...newReport, toxicGasType: e.target.value })}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">{isFa ? '-- انتخاب نوع گاز --' : '-- Select Gas --'}</option>
                          <option value="H2S">H2S (سولفید هیدروژن)</option>
                          <option value="CO">CO (مونوکسید کربن)</option>
                          <option value="NH3">NH3 (آمونیاک)</option>
                          <option value="Cl2">Cl2 (کلر)</option>
                          <option value="SO2">SO2 (دی‌اکسید گوگرد)</option>
                          <option value="NO2">NO2 (دی‌اکسید نیتروژن)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'مقدار گاز سمی (PPM)' : 'Gas Amount (PPM)'}</label>
                        <input
                          type="number"
                          value={newReport.toxicGasAmountPpm}
                          onChange={e => setNewReport({ ...newReport, toxicGasAmountPpm: parseFloat(e.target.value) || 0 })}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'مقدار زمان نشتی (دقیقه)' : 'Leak Duration (mins)'}</label>
                        <input
                          type="number"
                          value={newReport.toxicLeakDurationMinutes}
                          onChange={e => setNewReport({ ...newReport, toxicLeakDurationMinutes: parseInt(e.target.value) || 0 })}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'محل های انتشار نشتی' : 'Leak Locations'}</label>
                        <input
                          type="text"
                          value={newReport.toxicLeakLocations}
                          onChange={e => setNewReport({ ...newReport, toxicLeakLocations: e.target.value })}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'سرعت وزش باد' : 'Wind Speed'}</label>
                        <input
                          type="text"
                          value={newReport.toxicWindSpeed}
                          onChange={e => setNewReport({ ...newReport, toxicWindSpeed: e.target.value })}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'جهت وزش باد' : 'Wind Direction'}</label>
                        <input
                          type="text"
                          value={newReport.toxicWindDirection}
                          onChange={e => setNewReport({ ...newReport, toxicWindDirection: e.target.value })}
                          className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-purple-200">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'توضیحات / SDS' : 'Description / SDS Info'}</label>
                      <textarea
                        readOnly
                        value={newReport.toxicGasType ? generateSdsInfo(newReport.toxicGasType, newReport.toxicGasAmountPpm, newReport.toxicLeakDurationMinutes, isFa) : ''}
                        className="w-full p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-[11px] font-bold text-purple-900 leading-relaxed min-h-[60px] resize-none focus:outline-none"
                        placeholder={isFa ? 'اطلاعات ایمنی و اثرات بر سلامتی انسان با توجه به غلظت و مدت تماس پس از انتخاب گاز به صورت خودکار در اینجا نمایش داده می‌شود.' : 'SDS safety info will be generated automatically here based on gas and PPM...'}
                      />
                    </div>
                  </div>
                </div>
              )}

              {newReport.category === 'Incident' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                    <input
                      type="checkbox"
                      id="osha_rec font-bold"
                      checked={newReport.isOshaRecordable}
                      onChange={e => setNewReport({ ...newReport, isOshaRecordable: e.target.checked })}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <label htmlFor="osha_rec" className="font-bold text-rose-900 text-xs">
                      {isFa ? 'این حادثه طبق استاندارد OSHA 300 قابل ثبت (Recordable) می‌باشد.' : 'Is OSHA 300 Recordable'}
                    </label>
                  </div>

                  <div className="p-3.5 bg-gradient-to-r from-rose-50 via-indigo-50/40 to-slate-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs">
                    <div className="p-2 bg-rose-600 text-white rounded-xl font-mono text-[10px] font-black shrink-0">
                      RHS-F34
                    </div>
                    <div className="space-y-1">
                      <strong className="text-slate-900 font-bold block">
                        {isFa ? 'اتصال خودکار به فرم تکمیلی حادثه (تجزيه و تحليل رويداد)' : 'Automatic Supplementary Form Integration'}
                      </strong>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        {isFa 
                          ? 'پس از ثبت این گزارش، فرم استاندارد تجزیه و تحلیل رویداد (کد RHS-F34) با مهلت تکمیل ۱۰ روزه به پرونده متصل شده و اطلاعات اولیه به صورت خودکار در آن بارگذاری می‌شود.'
                          : 'Upon registration, standard Incident Analysis Form (RHS-F34) with 10-day deadline will be automatically attached.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 dark:text-slate-200 font-bold rounded-xl"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl shadow-md"
                >
                  {isFa ? 'ثبت گزارش ناهنجاری / حادثه' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INCIDENT DETAILS & STATUS EDIT MODAL */}
      {selectedIncidentForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-incident-detail-modal, #printable-incident-detail-modal * {
                visibility: visible !important;
              }
              #printable-incident-detail-modal {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 16px !important;
                background: white !important;
                box-shadow: none !important;
                border: none !important;
                max-height: none !important;
                overflow: visible !important;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `}</style>
          <div id="printable-incident-detail-modal" className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black font-mono text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100">
                  {selectedIncidentForDetail.reportNumber}
                </span>
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100 mt-1">
                  {selectedIncidentForDetail.title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReferralTargetIncident(selectedIncidentForDetail)}
                  className="print:hidden px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title={isFa ? 'ارجاع سند جهت تأیید و امضا' : 'Refer Document'}
                >
                  <Send className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isFa ? 'ارجاع سند' : 'Refer'}</span>
                </button>
                <button
                  onClick={() => setTrackerTargetIncident(selectedIncidentForDetail)}
                  className="print:hidden px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title={isFa ? 'رهگیری گردش کار و امضاها' : 'Workflow Tracker'}
                >
                  <History className="w-3.5 h-3.5 text-slate-600" />
                  <span>{isFa ? 'گردش کار' : 'Workflow'}</span>
                </button>
                <button
                  onClick={handlePrintIncidentDetail}
                  className="print:hidden px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  title={isFa ? 'چاپ فرم گزارش' : 'Print Report'}
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>{isFa ? 'چاپ فرم' : 'Print'}</span>
                </button>
                <button 
                  onClick={() => setSelectedIncidentForDetail(null)} 
                  className="print:hidden w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* STATUS UPDATE PANEL */}
            <div className={`p-4 rounded-2xl border ${
              canEditReportStatus(selectedIncidentForDetail)
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <span>{isFa ? 'وضعیت پرونده ناهنجاری / حادثه:' : 'Report Status:'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 print:hidden">
                    {canEditReportStatus(selectedIncidentForDetail)
                      ? (isFa ? '✓ شما به عنوان مسئول اقدام / رئیس مرکز HSE مجاز به تغییر وضعیت هستید.' : '✓ Authorized as Action Responsible or HSE Head.')
                      : (isFa ? '🔒 تغییر وضعیت فقط برای مسئول اقدام و رئیس مرکز HSE امکان‌پذیر است.' : '🔒 Editable only by Action Owner or HSE Head.')}
                  </p>
                </div>

                {canEditReportStatus(selectedIncidentForDetail) ? (
                  <select
                    value={selectedIncidentForDetail.status}
                    onChange={e => handleUpdateIncidentStatus(selectedIncidentForDetail.id, e.target.value as SafetyIncidentRecord['status'])}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 rounded-xl font-black text-xs text-emerald-900 shadow-sm focus:ring-2 focus:ring-emerald-500 print:hidden"
                  >
                    <option value="Submitted">{isFa ? 'ثبت اولیه / در انتظار بررسی' : 'Submitted'}</option>
                    <option value="Under Investigation">{isFa ? 'در حال بررسی و پیگیری' : 'Under Investigation'}</option>
                    <option value="CAPA In Progress">{isFa ? 'در حال اجرای اقدام اصلاحی' : 'CAPA In Progress'}</option>
                    <option value="Resolved & Closed">{isFa ? 'مختومه و بسته‌شده' : 'Resolved & Closed'}</option>
                  </select>
                ) : null}

                {/* Status Badge always visible for print & view */}
                <span className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 rounded-xl font-bold text-xs text-slate-800 dark:text-slate-100 shadow-sm">
                  {selectedIncidentForDetail.status === 'Resolved & Closed' ? (isFa ? 'مختومه و بسته‌شده' : 'Resolved & Closed') :
                   selectedIncidentForDetail.status === 'CAPA In Progress' ? (isFa ? 'در حال اجرای اقدام اصلاحی' : 'CAPA In Progress') :
                   selectedIncidentForDetail.status === 'Under Investigation' ? (isFa ? 'در حال بررسی' : 'Under Investigation') :
                   (isFa ? 'ثبت اولیه / در انتظار بررسی' : 'Submitted')}
                </span>

                {/* Direct Link to Non-Conformance Management (CAPA) */}
                <button
                  onClick={async () => {
                    try {
                      const fullDesc = `گزارش رویداد / ناهنجاری ایمنی شماره ${selectedIncidentForDetail.reportNumber || 'بدون کد'}\nنوع رویداد: ${selectedIncidentForDetail.categoryFa} | تاریخ وقوع: ${selectedIncidentForDetail.eventDate}\nمحل / واحد: ${selectedIncidentForDetail.locationSite || selectedIncidentForDetail.department || 'واحد عملیاتی'} | شدت: ${selectedIncidentForDetail.severity}\n\nشرح کامل بند ناهنجاری و شرح واقعه:\n• ${selectedIncidentForDetail.description || 'شرح رویداد ثبت شده است.'}`;

                      const nc = await apiDb.createNonConformance({
                        title: `عدم انطباق ناشی از رویداد: ${selectedIncidentForDetail.categoryFa} (${selectedIncidentForDetail.reportNumber || 'بدون شماره'})`,
                        sourceModule: 'incident',
                        sourceRecordId: String(selectedIncidentForDetail.id),
                        sourceTitle: `گزارش رویداد ${selectedIncidentForDetail.reportNumber || ''}`,
                        unitName: selectedIncidentForDetail.locationSite || selectedIncidentForDetail.department || 'واحد عملیاتی',
                        riskLevel: (selectedIncidentForDetail.severity?.includes('Critical') || selectedIncidentForDetail.severity?.includes('Fatality')) ? 'CRITICAL' : selectedIncidentForDetail.severity?.includes('High') ? 'HIGH' : 'MEDIUM',
                        category: 'حوادث و شبه‌حوادث',
                        description: fullDesc,
                        correctiveAction: (selectedIncidentForDetail.capaList && selectedIncidentForDetail.capaList[0]?.description) || selectedIncidentForDetail.immediateActionTaken || '',
                        assignedToName: (selectedIncidentForDetail.capaList && selectedIncidentForDetail.capaList[0]?.responsiblePerson) || selectedIncidentForDetail.reporterName,
                        status: 'REGISTERED'
                      });
                      setNcToast(isFa ? `عدم انطباق با کد رهگیری «${nc?.trackingCode || 'جدید'}» در سامانه CAPA ثبت شد.` : 'Registered in CAPA successfully.');
                      setTimeout(() => setNcToast(null), 4000);
                    } catch (e: any) {
                      setNcToast(`خطا در ثبت: ${e?.message || e}`);
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer print:hidden"
                  title={isFa ? 'ارجاع و ثبت در سامانه جامع عدم انطباق و اقدامات اصلاحی (CAPA)' : 'Register in CAPA'}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isFa ? 'ارجاع به عدم انطباق (CAPA)' : 'Link to CAPA'}</span>
                </button>
              </div>
            </div>

            {ncToast && (
              <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md animate-in fade-in">
                <span>{ncToast}</span>
                <button onClick={() => setNcToast(null)} className="p-1 hover:bg-white/20 rounded-lg">✕</button>
              </div>
            )}

            {/* DETAILS GRID (SEPARATE FIELD CARDS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'دسته‌بندی و نوع گزارش:' : 'Category:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.categoryFa} ({selectedIncidentForDetail.category})</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'تاریخ و زمان وقوع:' : 'Event Date/Time:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.eventDate} - {selectedIncidentForDetail.eventTime}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'واحد مربوطه:' : 'Department:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.department || '-'}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'محل وقوع (UNIT / سایت):' : 'Location (UNIT):'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.locationSite || '-'}</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'گزارش‌دهنده:' : 'Reporter:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {selectedIncidentForDetail.reporterName} {selectedIncidentForDetail.reporterPersonnelCode ? `(کد پرسنلی: ${selectedIncidentForDetail.reporterPersonnelCode})` : ''}
                </span>
              </div>
            </div>

            {/* SUPPLEMENTARY INCIDENT FORM CARD (RHS-F34) */}
            {selectedIncidentForDetail.category === 'Incident' && (() => {
              const suppForm = getSupplementaryFormByIncidentId(selectedIncidentForDetail.id, selectedIncidentForDetail, currentUser);
              const deadline = calculateDeadlineInfo(suppForm.startDate?.replace(/\./g, '/') || selectedIncidentForDetail.eventDate, suppForm.status);
              
              return (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/90 via-indigo-50/50 to-slate-50 border border-rose-200 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-mono font-black text-xs shadow-md">
                        F34
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 font-black text-xs">
                            {isFa ? 'فرم تکمیلی تجزیه و تحلیل رویداد' : 'Incident Analysis Supplementary Form'}
                          </strong>
                          <span className="bg-rose-100 text-rose-800 font-mono text-[9px] font-black px-1.5 py-0.5 rounded border border-rose-200">
                            RHS – F34
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                          {isFa ? 'مهلت تکمیل حداکثر ۱۰ روز از تاریخ وقوع / ثبت رویداد' : '10-Day Completion Deadline from Event Date'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border shadow-xs ${
                        suppForm.status === 'completed' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                          : suppForm.status === 'expired' || deadline.isExpired
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : suppForm.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-900 border-blue-300'
                          : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}>
                        {suppForm.status === 'completed' ? (isFa ? '✓ تکمیل شده (ثبت نهایی)' : 'Completed') :
                         suppForm.status === 'expired' || deadline.isExpired ? (isFa ? 'مهلت منقضی شده' : 'Expired') :
                         suppForm.status === 'in_progress' ? (isFa ? 'در حال تکمیل' : 'In Progress') :
                         (isFa ? 'تکمیل نشده' : 'Not Started')}
                      </span>

                      {suppForm.status !== 'completed' && (
                        <span className={`px-2 py-1 rounded-xl text-[10px] font-bold ${
                          deadline.daysRemaining > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {deadline.daysRemaining > 0 
                            ? (isFa ? `${deadline.daysRemaining} روز مهلت` : `${deadline.daysRemaining}d left`) 
                            : (isFa ? 'پایان مهلت' : 'Overdue')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-rose-200/70 text-xs">
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {isFa 
                        ? 'ماتریس شدت، علل مستقیم، غیرمستقیم و ریشه‌ای، اطلاعات مصدوم، خسارات و امضای HSE'
                        : 'Severity Matrix, Direct/Indirect/Root Causes, Victim details & HSE Approval'}
                    </p>
                    <button
                      onClick={() => {
                        const target = selectedIncidentForDetail;
                        setSelectedIncidentForSupplementary(target);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>
                        {suppForm.status === 'completed' 
                          ? (isFa ? 'مشاهده و چاپ فرم تکمیلی (RHS-F34)' : 'View/Print Form') 
                          : (isFa ? 'باز کردن و تکمیل فرم تکمیلی (RHS-F34)' : 'Open & Edit Supplementary Form')}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* RPN RISK ASSESSMENT (IF AVAILABLE) */}
            {selectedIncidentForDetail.riskAssessment && (
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900">{isFa ? 'ارزیابی ریسک (RPN):' : 'Risk Assessment:'}</span>
                  <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black ${
                    selectedIncidentForDetail.riskAssessment.riskLevelColor === 'red' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    selectedIncidentForDetail.riskAssessment.riskLevelColor === 'yellow' ? 'bg-amber-100 text-amber-900 border border-blue-300' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    RPN: {selectedIncidentForDetail.riskAssessment.rpn} ({selectedIncidentForDetail.riskAssessment.riskLevelFa})
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-600 dark:text-slate-400 text-center font-mono pt-1 border-t border-indigo-100">
                  <div>احتمال: <strong>{selectedIncidentForDetail.riskAssessment.probability}</strong></div>
                  <div>شدت: <strong>{selectedIncidentForDetail.riskAssessment.severity}</strong></div>
                  <div>کشف: <strong>{selectedIncidentForDetail.riskAssessment.detection}</strong></div>
                  <div>محیط زیست: <strong>{selectedIncidentForDetail.riskAssessment.envSeverity}</strong></div>
                </div>
              </div>
            )}

            {/* DESCRIPTION & IMMEDIATE ACTION */}
            {selectedIncidentForDetail.category !== 'Toxic Gas Leak' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <strong className="text-slate-700 dark:text-slate-200 block mb-1">{isFa ? 'شرح حادثه / ناهنجاری:' : 'Description:'}</strong>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{selectedIncidentForDetail.description}</p>
              </div>

              {selectedIncidentForDetail.immediateActionTaken && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-blue-100">
                  <strong className="text-amber-900 block mb-1">{isFa ? 'اقدام فوری انجام‌شده:' : 'Immediate Action:'}</strong>
                  <p className="text-amber-800 leading-relaxed">{selectedIncidentForDetail.immediateActionTaken}</p>
                </div>
              )}
            </div>
            )}

            {/* TOXIC GAS LEAK DETAILS */}
            {selectedIncidentForDetail.toxicGasLeak && (
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2 text-xs">
                <strong className="text-purple-900 block border-b border-purple-200 pb-1 mb-2">{isFa ? 'جزئیات حادثه نشت گاز سمی' : 'Toxic Gas Leak Details'}</strong>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-purple-600 font-bold block">{isFa ? 'نوع گاز:' : 'Gas Type:'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.toxicGasLeak.gasType || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-600 font-bold block">{isFa ? 'مقدار گاز (PPM):' : 'Amount (PPM):'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{selectedIncidentForDetail.toxicGasLeak.gasAmountPpm}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-600 font-bold block">{isFa ? 'سرعت وزش باد:' : 'Wind Speed:'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.toxicGasLeak.windSpeed || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-600 font-bold block">{isFa ? 'جهت وزش باد:' : 'Wind Direction:'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.toxicGasLeak.windDirection || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-600 font-bold block">{isFa ? 'محل های انتشار نشتی:' : 'Leak Locations:'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{selectedIncidentForDetail.toxicGasLeak.leakLocations || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-purple-600 font-bold block">{isFa ? 'مدت زمان نشتی (دقیقه):' : 'Duration (mins):'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{selectedIncidentForDetail.toxicGasLeak.leakDurationMinutes}</span>
                  </div>
                </div>
              </div>
            )}

            {/* CAPA LIST */}
            {selectedIncidentForDetail.capaList && selectedIncidentForDetail.capaList.length > 0 && (
              <div className="space-y-2 text-xs">
                <strong className="text-slate-700 dark:text-slate-200 block">{isFa ? 'اقدامات اصلاحی و پیشگیرانه (CAPA):' : 'Corrective Actions (CAPA):'}</strong>
                {selectedIncidentForDetail.capaList.map((capa, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100">{capa.description}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isFa ? 'مسئول اقدام:' : 'Responsible:'} <strong className="text-slate-700 dark:text-slate-200">{capa.responsiblePerson}</strong> ({capa.department})
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold self-start sm:self-center ${
                      capa.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {capa.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* UNIFIED REFERRAL & SIGNATURES PRINT BOX */}
            <div className="pt-2">
              <PrintDocumentSignaturesBox
                documentType="INCIDENT"
                documentId={selectedIncidentForDetail.id}
                isFa={isFa}
                title={isFa ? 'تأییدات و امضاهای الکترونیک گزارش رویداد (Incident Signatures)' : 'Incident Approvals & Signatures'}
              />
            </div>

            {/* FOOTER ACTIONS */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden">
              <div className="flex items-center gap-2">
                {currentUser?.role === 'Administrator' && (
                  <>
                    <button
                      onClick={() => {
                        const target = selectedIncidentForDetail;
                        setSelectedIncidentForDetail(null);
                        handleStartEditIncident(target);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>{isFa ? 'ویرایش کامل (ادمین)' : 'Edit Report'}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteIncident(selectedIncidentForDetail.id)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{isFa ? 'حذف گزارش (ادمین)' : 'Delete Report'}</span>
                    </button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReferralTargetIncident(selectedIncidentForDetail)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isFa ? 'ارجاع سند' : 'Refer'}</span>
                </button>
                <button
                  onClick={() => setTrackerTargetIncident(selectedIncidentForDetail)}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <History className="w-4 h-4" />
                  <span>{isFa ? 'گردش کار' : 'Workflow'}</span>
                </button>
                <button
                  onClick={handlePrintIncidentDetail}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isFa ? 'چاپ / پرینت فرم' : 'Print Report'}</span>
                </button>
                <button
                  onClick={() => setSelectedIncidentForDetail(null)}
                  className="px-5 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl hover:bg-slate-700 transition"
                >
                  {isFa ? 'بستن' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              if (inc.id === updatedForm.incidentId) {
                return {
                  ...inc,
                  supplementaryFormId: updatedForm.id,
                  supplementaryFormStatus: updatedForm.status,
                  supplementaryForm: updatedForm
                };
              }
              return inc;
            }));
            if (selectedIncidentForDetail && selectedIncidentForDetail.id === updatedForm.incidentId) {
              setSelectedIncidentForDetail(prev => prev ? {
                ...prev,
                supplementaryFormId: updatedForm.id,
                supplementaryFormStatus: updatedForm.status,
                supplementaryForm: updatedForm
              } : null);
            }
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
