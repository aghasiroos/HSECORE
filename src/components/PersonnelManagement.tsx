import React, { useState, useEffect, useMemo } from 'react';
import PersianDatePicker from './common/PersianDatePicker';
import DualDateBadge from './common/DualDateBadge';
import { downloadCsvFile } from '../utils/fileHelpers';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Search,
  Save,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Building2,
  Briefcase,
  GitFork,
  Printer,
  Filter,
  Eye,
  GraduationCap,
  Phone,
  Check,
  PieChart,
  LayoutGrid,
  List,
  UserCheck,
  Calendar,
  UserPlus,
  FileSpreadsheet,
  Heart,
  Sparkles,
  MapPin,
  Camera,
  FolderTree,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  PenTool,
  Upload
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import {
  getUnits,
  getJobTitles,
  getOrgUnitsStructure,
  saveOrgUnitsStructure,
  saveJobTitlesToDb,
  fetchAllOrgConfigFromDb,
  getSubUnitsForUnit,
  OrgUnitsDataMap,
  getOrgSites,
  findUnitDetail
} from '../utils/orgHelper';
import { calculateExactAge } from '../utils/jalaliDate';
import { OrgNode } from '../utils/authHelper';
import {
  getStoredOrgNodes,
  fetchStoredOrgNodes,
  fetchCentralPersonnelList,
  removePersonnelFromMemory,
  setInMemoryPersonnelList,
  purgeLegacyBrowserCache,
  processSignatureImageFile,
  getPersonnelSignature
} from '../utils/personnelHelper';
import { apiDb } from '../services/apiDatabaseClient';
import OrgChartPickerModal from './OrgChartPickerModal';

import PersonnelExcelImportModal from './PersonnelExcelImportModal';
import { GENDER_OPTIONS, MILITARY_STATUS_OPTIONS, downloadPersonnelExcelTemplate } from '../services/personnelImportService';
import { printService } from '../services/printService';
import { getSystemBrandingConfig } from '../utils/systemBrandingHelper';
import { VirtualizedDataTable, VirtualizedColumn } from './common/virtualized/VirtualizedDataTable';

export interface Personnel {
  id: string;
  firstName: string;
  lastName: string;
  personnelCode: string;
  unit?: string;
  subUnit?: string;
  jobTitle?: string;
  workplace?: string;
  nationalCode: string;
  birthDate: string;
  age: number;
  phone: string;
  education: string;
  childrenCount: string;
  maritalStatus: string;
  gender?: string;
  militaryStatus?: string;
  notes: string;
  profilePhoto?: string;
  signatureImage?: string;
}

const EDUCATION_LEVELS = [
  'بيسواد',
  'سيكل',
  'ديپلم',
  'فوق ديپلم',
  'كارشناسي',
  'كارشناسي ارشد',
  'دكترا'
];

const MARITAL_STATUS = [
  'متاهل',
  'مجرد'
];

const CHILDREN_COUNTS = Array.from({ length: 11 }, (_, i) => i.toString()); // 0 to 10

export const WORKPLACE_OPTIONS: string[] = [];

export default function PersonnelManagement({ isFa, currentUser }: { isFa: boolean; currentUser?: any }) {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [isInitLoaded, setIsInitLoaded] = useState(false);

  useEffect(() => {
    purgeLegacyBrowserCache();

    let isMounted = true;
    const formatPersonnelRecords = (data: any[]): Personnel[] => {
      const seenIds = new Set<string>();
      return (data || []).map((p: any, idx: number) => {
        let id = p.id || `emp-${Date.now()}-${idx}`;
        if (seenIds.has(id)) {
          id = `${id}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
        }
        seenIds.add(id);
        const calculatedAge = p.birthDate ? calculateExactAge(p.birthDate) : (p.age || 0);
        return { ...p, id, workplace: p.workplace || '', age: calculatedAge };
      });
    };

    const fetchRemote = async (forceRefresh = false) => {
      const data = await fetchCentralPersonnelList(forceRefresh);
      if (isMounted) {
        setPersonnelList(formatPersonnelRecords(data));
        setIsInitLoaded(true);
      }
    };
    fetchRemote(true);

    // Listen for real-time WebSocket / SSE / cross-module mutations
    const handleRemoteUpdate = async (e?: any) => {
      if (!isMounted) return;
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('personnel') || entity.includes('user')) {
        const data = await fetchCentralPersonnelList(true);
        if (isMounted) {
          setPersonnelList(formatPersonnelRecords(data));
        }
      }
    };
    
    window.addEventListener('app_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_central_data_synced', handleRemoteUpdate);
    window.addEventListener('hse_personnel_updated', () => fetchRemote(false));

    return () => {
      isMounted = false;
      window.removeEventListener('app_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_central_data_synced', handleRemoteUpdate);
    };
  }, []);

  const [orgStructure, setOrgStructure] = useState<OrgUnitsDataMap>(() => getOrgUnitsStructure());
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>(() => getStoredOrgNodes());
  const [units, setUnits] = useState<string[]>(() => getUnits());
  const availableUnits = units;
  const [allJobTitles, setAllJobTitles] = useState<string[]>(() => getJobTitles());
  const [siteOptions, setSiteOptions] = useState<string[]>(() => getOrgSites());
  
  // Org chart picker & hierarchy controls
  const [showOrgPickerModal, setShowOrgPickerModal] = useState(false);
  const [allowAllJobsFallback, setAllowAllJobsFallback] = useState(false);
  const [quickNewJobTitle, setQuickNewJobTitle] = useState('');
  const [showQuickAddJob, setShowQuickAddJob] = useState(false);

  const loadOrgData = async (forceRefresh = false) => {
    const [nodes, config] = await Promise.all([
      fetchStoredOrgNodes(forceRefresh),
      fetchAllOrgConfigFromDb(forceRefresh)
    ]);
    setOrgStructure(config.orgStructure);
    setOrgNodes(nodes);

    const combinedUnitsSet = new Set<string>();
    nodes.forEach(n => {
      if (n.status !== 'inactive' && (n.type === 'Plant' || n.type === 'Department' || n.type === 'Area')) {
        combinedUnitsSet.add(n.name.trim());
      }
    });
    getUnits().forEach(u => combinedUnitsSet.add(u.trim()));
    setUnits(Array.from(combinedUnitsSet));

    setAllJobTitles(getJobTitles());
    setSiteOptions(getOrgSites());
  };

  useEffect(() => {
    loadOrgData(true);

    const handleOrgRemoteUpdate = (e?: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || e?.detail?.key || '').toLowerCase();
      if (
        !entity ||
        entity.includes('org') ||
        entity.includes('node') ||
        entity.includes('unit') ||
        entity.includes('department') ||
        entity.includes('setting')
      ) {
        loadOrgData(true);
      }
    };

    window.addEventListener('hse_org_nodes_updated', () => loadOrgData(false));
    window.addEventListener('hse_unit_structure_updated', () => loadOrgData(false));
    window.addEventListener('hse_org_jobs_updated', () => loadOrgData(false));
    window.addEventListener('hse_data_mutated', handleOrgRemoteUpdate);
    window.addEventListener('hse_central_data_synced', handleOrgRemoteUpdate);
    return () => {
      window.removeEventListener('hse_data_mutated', handleOrgRemoteUpdate);
      window.removeEventListener('hse_central_data_synced', handleOrgRemoteUpdate);
    };
  }, []);

  // Filtering & View states
  const [search, setSearch] = useState('');
  const [workplaceFilter, setWorkplaceFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [subUnitFilter, setSubUnitFilter] = useState('');
  const [educationFilter, setEducationFilter] = useState('');
  const [maritalFilter, setMaritalFilter] = useState('');
  
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'analytics'>('table');
  const [pageSize, setPageSize] = useState<number>(15);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Form & Drawer states
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingPersonnel, setViewingPersonnel] = useState<Personnel | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'personnelCode' | 'unit' | 'age' | 'education' | 'workplace' | 'jobTitle' | 'nationalCode' | 'gender'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Deletion modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [personnelToDelete, setPersonnelToDelete] = useState<Personnel | null>(null);
  const [deleteAssociatedUser, setDeleteAssociatedUser] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  // Save Confirmation & Toast states
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [isSavingPersonnel, setIsSavingPersonnel] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);

  // Excel Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);

  const initialForm: Omit<Personnel, 'id' | 'age'> = {
    firstName: '',
    lastName: '',
    personnelCode: '',
    workplace: '',
    unit: '',
    subUnit: '',
    jobTitle: '',
    nationalCode: '',
    birthDate: '',
    phone: '',
    education: EDUCATION_LEVELS[2], // Default Diploma
    childrenCount: '0',
    maritalStatus: MARITAL_STATUS[0], // Default Married
    gender: 'مرد',
    militaryStatus: 'پایان خدمت',
    notes: '',
    profilePhoto: '',
    signatureImage: ''
  };

  const [form, setForm] = useState(initialForm);
  const [signatureError, setSignatureError] = useState<string>('');

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureError('');
    try {
      const dataUrl = await processSignatureImageFile(file);
      setForm(prev => ({ ...prev, signatureImage: dataUrl }));
    } catch (err: any) {
      setSignatureError(err?.message || (isFa ? 'فرمت فایل امضا نامعتبر است. فقط PNG یا JPEG مجاز است.' : 'Invalid signature file format. Only PNG or JPEG allowed.'));
    } finally {
      e.target.value = '';
    }
  };

  // Available sub-units strictly for the selected unit from both orgStructure and orgNodes
  const availableSubUnits = useMemo(() => {
    if (!form.unit) return [];
    const subUnitsSet = new Set<string>();

    // 1. From OrgUnitsDataMap (Units/Jobs tab)
    const match = findUnitDetail(form.unit, orgStructure);
    if (match?.subUnits) {
      Object.keys(match.subUnits).forEach(s => {
        if (s.trim()) subUnitsSet.add(s.trim());
      });
    }

    // 2. From OrgNodes (Chart/Tree hierarchy tab)
    const cleanUnit = form.unit.trim().toLowerCase();
    const parentNode = orgNodes.find(n => 
      n.name.trim().toLowerCase() === cleanUnit || 
      (n.code && n.code.trim().toLowerCase() === cleanUnit)
    );
    if (parentNode) {
      const childNodes = orgNodes.filter(n => n.parentId === parentNode.id && n.status !== 'inactive');
      childNodes.forEach(child => {
        if (child.name.trim()) subUnitsSet.add(child.name.trim());
        if (child.type === 'Area' || child.type === 'Department') {
          const grandChildren = orgNodes.filter(n => n.parentId === child.id && n.status !== 'inactive');
          grandChildren.forEach(gc => {
            if (gc.name.trim()) subUnitsSet.add(gc.name.trim());
          });
        }
      });
    }

    return Array.from(subUnitsSet);
  }, [form.unit, orgStructure, orgNodes]);

  // Sub-units for filter bar
  const filterAvailableSubUnits = useMemo(() => {
    if (!unitFilter) return [];
    return getSubUnitsForUnit(unitFilter);
  }, [unitFilter, orgStructure]);

  // Strict hierarchical jobs retrieval: ONLY from the selected sub-unit or unit!
  const { availableJobs, jobOriginInfo } = useMemo(() => {
    if (allowAllJobsFallback) {
      return { 
        availableJobs: allJobTitles, 
        jobOriginInfo: isFa ? 'کلیه عناوین شغلی تعریف‌شده در سامانه (حالت آزاد)' : 'All system job titles'
      };
    }

    if (!form.unit) {
      return { 
        availableJobs: [], 
        jobOriginInfo: isFa ? 'ابتدا واحد و زیرمجموعه سازمانی را انتخاب نمایید تا مشاغل مربوطه فراخوانی شوند.' : 'Please select organizational unit and sub-unit first.'
      };
    }

    const match = findUnitDetail(form.unit, orgStructure);
    const unitData = match;

    // CASE 1: Sub-unit is selected -> ONLY jobs defined for that specific sub-unit in Org Structure
    if (form.subUnit && form.subUnit.trim()) {
      const cleanSub = form.subUnit.trim().toLowerCase();
      let subJobs: string[] = [];

      if (unitData?.subUnits) {
        if (Array.isArray(unitData.subUnits[form.subUnit])) {
          subJobs = unitData.subUnits[form.subUnit];
        } else {
          // Fuzzy match sub-unit name
          for (const [sKey, sJobs] of Object.entries(unitData.subUnits)) {
            const sClean = sKey.trim().toLowerCase();
            if (sClean === cleanSub || cleanSub.includes(sClean) || sClean.includes(cleanSub)) {
              subJobs = Array.isArray(sJobs) ? sJobs as string[] : [];
              break;
            }
          }
        }
      }

      const cleanJobs = Array.from(new Set(subJobs.filter(Boolean)));
      return {
        availableJobs: cleanJobs,
        jobOriginInfo: cleanJobs.length > 0 
          ? (isFa ? `عناوین شغلی منحصراً فراخوانی‌شده از زیرمجموعه «${form.subUnit}» (${cleanJobs.length} عنوان)` : `Jobs strictly loaded from sub-unit "${form.subUnit}"`)
          : (isFa ? `در ساختار سازمانی، هنوز شغلی به زیرمجموعه «${form.subUnit}» اختصاص نیافته است.` : `No jobs defined for sub-unit "${form.subUnit}"`)
      };
    }

    // CASE 2: No sub-unit selected (Direct in Unit) -> ONLY direct jobs of this unit
    const directJobs = unitData?.jobs || [];
    if (directJobs.length > 0) {
      const cleanJobs = Array.from(new Set(directJobs.filter(Boolean)));
      return {
        availableJobs: cleanJobs,
        jobOriginInfo: isFa 
          ? `عناوین شغلی مستقیم در سطح واحد «${form.unit}» (${cleanJobs.length} عنوان)` 
          : `Direct jobs for unit "${form.unit}"`
      };
    }

    // Fallback: If unit has sub-units with jobs, list those
    if (unitData?.subUnits) {
      const allSubJobs = Object.values(unitData.subUnits).flat().filter(Boolean);
      if (allSubJobs.length > 0) {
        const cleanJobs = Array.from(new Set(allSubJobs));
        return {
          availableJobs: cleanJobs,
          jobOriginInfo: isFa 
            ? `مشاغل تعریف‌شده در زیرمجموعه‌های واحد «${form.unit}» (${cleanJobs.length} عنوان)` 
            : `Jobs defined under sub-units of "${form.unit}"`
        };
      }
    }

    return {
      availableJobs: [],
      jobOriginInfo: isFa ? `در ساختار سازمانی، هنوز عنوانی برای واحد «${form.unit}» ثبت نشده است.` : `No jobs defined for unit "${form.unit}"`
    };
  }, [form.unit, form.subUnit, allowAllJobsFallback, orgStructure, allJobTitles, isFa]);

  // Visual breadcrumb path in organizational hierarchy
  const hierarchyBreadcrumb = useMemo(() => {
    if (!form.unit) return null;
    const parts: string[] = [];
    if (form.workplace) parts.push(form.workplace);
    parts.push(form.unit);
    if (form.subUnit) parts.push(form.subUnit);
    if (form.jobTitle) parts.push(form.jobTitle);
    return parts.join(' ← ');
  }, [form.workplace, form.unit, form.subUnit, form.jobTitle]);

  // Age calculation (Exact Shamsi calculation based on current date)
  const calculateAge = (birthDate: string): number => {
    return calculateExactAge(birthDate);
  };

  const handleUnitChange = (newUnit: string) => {
    if (!newUnit) {
      setForm(prev => ({ ...prev, unit: '', subUnit: '', jobTitle: '' }));
      return;
    }

    // Check valid sub-units for new unit
    const validSubUnits = getSubUnitsForUnit(newUnit);
    const keepSubUnit = form.subUnit && validSubUnits.includes(form.subUnit) ? form.subUnit : '';

    // Check valid jobs for new unit and keepSubUnit
    const match = findUnitDetail(newUnit, orgStructure);
    let validJobs: string[] = [];
    if (keepSubUnit && match?.subUnits?.[keepSubUnit]) {
      validJobs = match.subUnits[keepSubUnit];
    } else if (match?.jobs) {
      validJobs = match.jobs;
    }

    const keepJob = form.jobTitle && validJobs.includes(form.jobTitle) ? form.jobTitle : (validJobs.length > 0 ? validJobs[0] : '');

    setForm(prev => ({
      ...prev,
      unit: newUnit,
      subUnit: keepSubUnit,
      jobTitle: keepJob
    }));
  };

  const handleSubUnitChange = (newSubUnit: string) => {
    const match = findUnitDetail(form.unit, orgStructure);
    let validJobs: string[] = [];
    if (newSubUnit && match?.subUnits?.[newSubUnit]) {
      validJobs = match.subUnits[newSubUnit];
    } else if (match?.jobs) {
      validJobs = match.jobs;
    }

    const keepJob = form.jobTitle && validJobs.includes(form.jobTitle) ? form.jobTitle : (validJobs.length > 0 ? validJobs[0] : '');

    setForm(prev => ({
      ...prev,
      subUnit: newSubUnit,
      jobTitle: keepJob
    }));
  };

  // Add new job directly into the Org Structure for current unit / sub-unit
  const handleAddNewJobToCurrentOrgLevel = (titleToAdd?: string) => {
    const title = (titleToAdd || quickNewJobTitle).trim();
    if (!title || !form.unit) return;

    const updated = { ...orgStructure };
    if (!updated[form.unit]) {
      updated[form.unit] = { jobs: [], subUnits: {} };
    }

    if (form.subUnit) {
      if (!updated[form.unit].subUnits[form.subUnit]) {
        updated[form.unit].subUnits[form.subUnit] = [];
      }
      if (!updated[form.unit].subUnits[form.subUnit].includes(title)) {
        updated[form.unit].subUnits[form.subUnit] = [...updated[form.unit].subUnits[form.subUnit], title];
      }
    } else {
      if (!updated[form.unit].jobs.includes(title)) {
        updated[form.unit].jobs = [...updated[form.unit].jobs, title];
      }
    }

    saveOrgUnitsStructure(updated);
    setOrgStructure(updated);
    const updatedGlobalJobs = getJobTitles();
    if (!updatedGlobalJobs.includes(title)) {
      saveJobTitlesToDb([...updatedGlobalJobs, title]);
    }
    setAllJobTitles(getJobTitles());
    setForm(prev => ({ ...prev, jobTitle: title }));
    setQuickNewJobTitle('');
    setShowQuickAddJob(false);
    window.dispatchEvent(new Event('hse_unit_structure_updated'));
    window.dispatchEvent(new Event('app_data_mutated'));
  };

  // Direct selection from Org Chart Picker Modal
  const handleOrgSelectionFromModal = (selection: { workplace?: string; unit?: string; subUnit?: string; jobTitle?: string }) => {
    setForm(prev => ({
      ...prev,
      workplace: selection.workplace || prev.workplace,
      unit: selection.unit || prev.unit,
      subUnit: selection.subUnit || '',
      jobTitle: selection.jobTitle || prev.jobTitle
    }));
  };

  const openNewForm = () => {
    loadOrgData();
    setEditingId(null);
    setForm(initialForm);
    setSignatureError('');
    setAllowAllJobsFallback(false);
    setShowQuickAddJob(false);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.personnelCode) return;
    setSaveConfirmOpen(true);
  };

  const executeSavePersonnel = async () => {
    if (!form.firstName || !form.lastName || !form.personnelCode) return;
    setIsSavingPersonnel(true);

    try {
      const payload = {
        ...form,
        id: editingId || undefined,
        age: calculateAge(form.birthDate)
      };

      // Push to central server
      const savedData = await apiDb.savePersonnel(payload);
      if (!savedData) throw new Error('Failed to save to central server');
      
      const savedId = savedData?.id ? String(savedData.id) : (editingId || savedData?.personnelCode || Date.now().toString());
      const updatedRecord: Personnel = {
        ...form,
        id: savedId,
        age: calculateAge(form.birthDate),
        signatureImage: form.signatureImage || savedData?.signatureImage || ''
      };

      let nextList: Personnel[] = [];
      if (editingId) {
        const matched = personnelList.some(
          p => p.id === editingId || p.personnelCode === form.personnelCode
        );
        if (matched) {
          nextList = personnelList.map(p =>
            (p.id === editingId || p.personnelCode === form.personnelCode)
              ? updatedRecord
              : p
          );
        } else {
          nextList = [updatedRecord, ...personnelList];
        }
        setEditingId(null);
      } else {
        const existsIdx = personnelList.findIndex(p => p.personnelCode === form.personnelCode);
        if (existsIdx >= 0) {
          nextList = personnelList.map((p, i) => (i === existsIdx ? updatedRecord : p));
        } else {
          nextList = [updatedRecord, ...personnelList];
        }
      }
      
      setPersonnelList(nextList);
      setInMemoryPersonnelList(nextList);
      setSaveConfirmOpen(false);
      setForm(initialForm);
      setFormOpen(false);
      
      purgeLegacyBrowserCache();

      // Invalidate cache and broadcast update
      apiDb.invalidateCache('personnel', 'users', 'sync:full');
      window.dispatchEvent(new Event('app_data_mutated'));
      window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: { code: payload.personnelCode } }));

      setSaveToastMessage(
        isFa
          ? `تغییرات مشخصات «${form.firstName} ${form.lastName}»${form.signatureImage ? ' به همراه نمونه امضا' : ''} با موفقیت در پایگاه داده اصلی ذخیره شد.`
          : `Personnel record for "${form.firstName} ${form.lastName}" saved successfully.`
      );
      setTimeout(() => setSaveToastMessage(null), 5000);
    } catch (err) {
      console.error('Failed to sync to central DB', err);
      alert(isFa ? 'خطا در ارتباط با سرور مرکزی جهت ذخیره اطلاعات پرسنل' : 'Failed to save personnel to central server');
    } finally {
      setIsSavingPersonnel(false);
    }
  };

  const handleEdit = (p: Personnel) => {
    if (currentUser?.role && currentUser.role !== 'Administrator' && currentUser.role !== 'ADMIN' && currentUser.role !== 'ADMINISTRATOR') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    loadOrgData();
    setEditingId(p.id);
    setSignatureError('');
    setAllowAllJobsFallback(false);
    setShowQuickAddJob(false);
    setForm({
      firstName: p.firstName,
      lastName: p.lastName,
      personnelCode: p.personnelCode,
      workplace: p.workplace || '',
      unit: p.unit || '',
      subUnit: p.subUnit || '',
      jobTitle: p.jobTitle || '',
      nationalCode: p.nationalCode,
      birthDate: p.birthDate,
      phone: p.phone,
      education: p.education,
      childrenCount: p.childrenCount,
      maritalStatus: p.maritalStatus,
      gender: p.gender || 'مرد',
      militaryStatus: p.militaryStatus || 'پایان خدمت',
      notes: p.notes,
      profilePhoto: p.profilePhoto || '',
      signatureImage: p.signatureImage || getPersonnelSignature(p) || ''
    });
    setFormOpen(true);
  };

  const handleDelete = (target: Personnel | string) => {
    if (currentUser?.role && currentUser.role !== 'Administrator' && currentUser.role !== 'ADMIN' && currentUser.role !== 'ADMINISTRATOR') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const person = typeof target === 'string' 
      ? personnelList.find(p => p.id === target || p.personnelCode === target || p.nationalCode === target)
      : target;
    if (person) {
      setPersonnelToDelete(person);
      setDeleteModalOpen(true);
    }
  };

  const executeDelete = async () => {
    if (!personnelToDelete) return;
    setIsDeleting(true);
    try {
      const primaryIdentifier = personnelToDelete.personnelCode || personnelToDelete.id;
      const success = await apiDb.deletePersonnel(primaryIdentifier, deleteAssociatedUser);
      if (success) {
        // Drop from in-memory cache and indices
        removePersonnelFromMemory(primaryIdentifier);
        removePersonnelFromMemory(personnelToDelete.id);
        if (personnelToDelete.personnelCode) {
          removePersonnelFromMemory(personnelToDelete.personnelCode);
        }
        if (personnelToDelete.nationalCode) {
          removePersonnelFromMemory(personnelToDelete.nationalCode);
        }

        // Update local list state
        setPersonnelList(prev => prev.filter(p => 
          p.id !== personnelToDelete.id && 
          p.personnelCode !== personnelToDelete.personnelCode
        ));

        if (viewingPersonnel?.id === personnelToDelete.id || viewingPersonnel?.personnelCode === personnelToDelete.personnelCode) {
          setViewingPersonnel(null);
        }
        setDeleteModalOpen(false);
        setPersonnelToDelete(null);

        purgeLegacyBrowserCache();

        // Invalidate central cache and broadcast
        apiDb.invalidateCache('personnel', 'users', 'sync:full');
        window.dispatchEvent(new Event('app_data_mutated'));
        window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: { deleted: primaryIdentifier } }));
      } else {
        alert(isFa ? 'خطا در حذف پرسنل از پایگاه داده اصلی سرور' : 'Failed to delete personnel from server');
      }
    } catch (err) {
      console.error('Delete personnel error:', err);
      alert(isFa ? 'خطا در ارتباط با سرور هنگام حذف پرسنل' : 'Server connection error during personnel deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, profilePhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = ['نام', 'نام خانوادگی', 'کد پرسنلی', 'تحصیلات', 'محل خدمت', 'واحد', 'زیرمجموعه', 'عنوان شغلی', 'کد ملی', 'سن', 'جنسیت', 'تلفن', 'وضعیت تاهل', 'تعداد فرزند'];
    const rows = filteredList.map(p => [
      p.firstName,
      p.lastName,
      p.personnelCode,
      p.education || '',
      p.workplace || '',
      p.unit || '',
      p.subUnit || '',
      p.jobTitle || '',
      p.nationalCode,
      p.age || 0,
      p.gender || 'مرد',
      p.phone || '',
      p.maritalStatus || '',
      p.childrenCount || '0'
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadCsvFile(`personnel_export_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  // Print View - Centralized Enterprise Print Service
  const handlePrint = () => {
    const branding = getSystemBrandingConfig();
    const today = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const listToPrint = filteredList.length > 0 ? filteredList : personnelList;
    
    const rowsHtml = listToPrint.map((p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 10px;">
        <td style="padding: 6px; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 6px; text-align: center; font-family: 'JetBrains Mono', monospace; font-weight: bold;">${p.personnelCode || '-'}</td>
        <td style="padding: 6px; font-weight: bold;">${p.firstName} ${p.lastName}</td>
        <td style="padding: 6px; text-align: center; font-family: 'JetBrains Mono', monospace;">${p.nationalCode || '-'}</td>
        <td style="padding: 6px; text-align: center;">${p.unit || '-'}${p.subUnit ? ` / ${p.subUnit}` : ''}</td>
        <td style="padding: 6px; text-align: center;">${p.jobTitle || '-'}</td>
        <td style="padding: 6px; text-align: center;">${p.workplace || '-'}</td>
        <td style="padding: 6px; text-align: center; font-family: 'JetBrains Mono', monospace;">${p.phone || '-'}</td>
        <td style="padding: 6px; text-align: center;">${p.education || '-'}</td>
        <td style="padding: 6px; text-align: center;">${p.maritalStatus || '-'}</td>
      </tr>
    `).join('');

    const html = `
      <div style="direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif;">
        <!-- Official Standard HSE Header -->
        <div style="border: 2px solid #0f172a; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${branding.logoUrl ? `<img src="${branding.logoUrl}" style="height: 18mm; max-width: 45mm; object-fit: contain;" alt="Logo" />` : ''}
            <div>
              <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">${branding.organizationNameFa || 'مدیریت بهداشت، ایمنی و محیط زیست (HSE)'}</h2>
              <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 700; color: #475569;">گزارش رسمی فهرست و مشخصات پرسنل مجتمع</p>
            </div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; font-size: 10px; line-height: 1.6; background: #f8fafc;">
            <div><strong>کد سند:</strong> <span style="font-family: 'JetBrains Mono', monospace;">HSE-HR-LIST</span></div>
            <div><strong>تاریخ گزارش:</strong> <span style="font-family: 'JetBrains Mono', monospace;">${today}</span></div>
            <div><strong>تعداد شاغلین:</strong> <strong>${listToPrint.length} نفر</strong></div>
          </div>
        </div>

        <!-- Data Table -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #0f172a; font-weight: 800; font-size: 10.5px;">
              <th style="padding: 8px; text-align: center; width: 35px;">ردیف</th>
              <th style="padding: 8px; text-align: center; width: 85px;">شماره پرسنلی</th>
              <th style="padding: 8px; text-align: right;">نام و نام خانوادگی</th>
              <th style="padding: 8px; text-align: center; width: 90px;">کد ملی</th>
              <th style="padding: 8px; text-align: center;">واحد سازمانی</th>
              <th style="padding: 8px; text-align: center;">عنوان شغل</th>
              <th style="padding: 8px; text-align: center;">محل خدمت</th>
              <th style="padding: 8px; text-align: center; width: 85px;">شماره تماس</th>
              <th style="padding: 8px; text-align: center;">تحصیلات</th>
              <th style="padding: 8px; text-align: center;">وضعیت تاهل</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Signatures and Archival Stamp -->
        <div class="avoid-break" style="margin-top: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center; font-size: 11px;">
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-weight: bold; color: #475569; margin-bottom: 30px;">کارشناس منابع انسانی / آمار</div>
            <div style="color: #94a3b8; font-size: 10px;">امضا و تاریخ</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-weight: bold; color: #475569; margin-bottom: 30px;">رئیس واحد بهداشت، ایمنی و محیط زیست</div>
            <div style="color: #94a3b8; font-size: 10px;">امضا و مهر واحد</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #fafafa;">
            <div style="font-weight: bold; color: #475569; margin-bottom: 30px;">مدیریت مجتمع / منابع انسانی</div>
            <div style="color: #94a3b8; font-size: 10px;">تأیید نهایی و بایگانی</div>
          </div>
        </div>
      </div>
    `;

    printService.printHtml(html, {
      title: 'فهرست رسمی پرسنل مجتمع پتروشیمی',
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: 'HSE-HR-LIST',
      documentDate: today,
      isFa: true,
      autoPrint: true
    });
  };

  // Filtering
  const filteredList = useMemo(() => {
    return personnelList.filter(p => {
      const s = search.toLowerCase().trim();
      const matchesSearch = !s || 
        p.firstName.toLowerCase().includes(s) ||
        p.lastName.toLowerCase().includes(s) ||
        p.personnelCode.toLowerCase().includes(s) ||
        (p.nationalCode && p.nationalCode.includes(s)) ||
        (p.phone && p.phone.includes(s)) ||
        (p.workplace && p.workplace.toLowerCase().includes(s)) ||
        (p.unit && p.unit.toLowerCase().includes(s)) ||
        (p.subUnit && p.subUnit.toLowerCase().includes(s)) ||
        (p.jobTitle && p.jobTitle.toLowerCase().includes(s));

      const matchesWorkplace = !workplaceFilter || (p.workplace || '') === workplaceFilter;
      const matchesUnit = !unitFilter || p.unit === unitFilter;
      const matchesSubUnit = !subUnitFilter || p.subUnit === subUnitFilter;
      const matchesEdu = !educationFilter || p.education === educationFilter;
      const matchesMarital = !maritalFilter || p.maritalStatus === maritalFilter;

      return matchesSearch && matchesWorkplace && matchesUnit && matchesSubUnit && matchesEdu && matchesMarital;
    }).sort((a, b) => {
      if (!sortField) return 0;
      let aVal: any = '';
      let bVal: any = '';

      if (sortField === 'name') {
        aVal = `${a.firstName} ${a.lastName}`;
        bVal = `${b.firstName} ${b.lastName}`;
      } else if (sortField === 'personnelCode') {
        aVal = a.personnelCode;
        bVal = b.personnelCode;
      } else if (sortField === 'education') {
        aVal = a.education || '';
        bVal = b.education || '';
      } else if (sortField === 'workplace') {
        aVal = a.workplace || '';
        bVal = b.workplace || '';
      } else if (sortField === 'unit') {
        aVal = a.unit || '';
        bVal = b.unit || '';
      } else if (sortField === 'jobTitle') {
        aVal = a.jobTitle || '';
        bVal = b.jobTitle || '';
      } else if (sortField === 'nationalCode') {
        aVal = a.nationalCode || '';
        bVal = b.nationalCode || '';
      } else if (sortField === 'age') {
        aVal = a.age || 0;
        bVal = b.age || 0;
      } else if (sortField === 'gender') {
        aVal = a.gender || 'مرد';
        bVal = b.gender || 'مرد';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [personnelList, search, workplaceFilter, unitFilter, subUnitFilter, educationFilter, maritalFilter, sortField, sortDirection]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, workplaceFilter, unitFilter, subUnitFilter, educationFilter, maritalFilter]);

  // Paginated List
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Analytics Aggregates
  const stats = useMemo(() => {
    const total = personnelList.length;
    const unitMap: Record<string, number> = {};
    const eduMap: Record<string, number> = {};
    let totalAge = 0;
    let ageCount = 0;
    let marriedCount = 0;

    personnelList.forEach(p => {
      if (p.unit) {
        unitMap[p.unit] = (unitMap[p.unit] || 0) + 1;
      }
      if (p.education) {
        eduMap[p.education] = (eduMap[p.education] || 0) + 1;
      }
      if (p.age > 0) {
        totalAge += p.age;
        ageCount++;
      }
      if (p.maritalStatus === 'متاهل' || p.maritalStatus === 'Married') {
        marriedCount++;
      }
    });

    const avgAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;
    const activeUnitsCount = Object.keys(unitMap).length;

    return {
      total,
      avgAge,
      marriedCount,
      marriedPercent: total > 0 ? Math.round((marriedCount / total) * 100) : 0,
      activeUnitsCount,
      unitMap,
      eduMap
    };
  }, [personnelList]);

  const toggleSort = (field: 'name' | 'personnelCode' | 'unit' | 'age' | 'education' | 'workplace' | 'jobTitle' | 'nationalCode' | 'gender') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: 'name' | 'personnelCode' | 'unit' | 'age' | 'education' | 'workplace' | 'jobTitle' | 'nationalCode' | 'gender' }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 inline-block opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-500 inline-block font-bold" /> : <ArrowDown className="w-3 h-3 text-amber-500 inline-block font-bold" />;
  };

  const hasActiveFilters = search || workplaceFilter || unitFilter || subUnitFilter || educationFilter || maritalFilter;

  const resetFilters = () => {
    setSearch('');
    setWorkplaceFilter('');
    setUnitFilter('');
    setSubUnitFilter('');
    setEducationFilter('');
    setMaritalFilter('');
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: HEADER & METRICS CARDS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/10 dark:bg-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'مدیریت و بانک اطلاعات پرسنل مجتمع' : 'Complex Personnel Management Suite'}
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  {isFa ? 'سامانه یکپارچه پرسنلی، اتصال به چارت سازمانی، تخصیص مشاغل و آنالیز دموگرافیک' : 'Integrated personnel database, organizational structure mapping, and demographic analytics'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => {
                if (currentUser?.role && currentUser.role !== 'Administrator') {
                  alert(isFa ? 'ورود و بارگذاری فایل اکسل پرسنل تنها برای مدیر اصلی سیستم (Administrator) مجاز است.' : 'Excel import is restricted to System Administrators.');
                  return;
                }
                setImportModalOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              title={isFa ? 'ورود اطلاعات از اکسل (.xlsx)' : 'Import Personnel Excel'}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>{isFa ? 'ورود اطلاعات از اکسل (Excel)' : 'Import Excel'}</span>
            </button>

            <button
              onClick={downloadPersonnelExcelTemplate}
              className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title={isFa ? 'دانلود فایل اکسل نمونه جهت ورود صحیح اطلاعات' : 'Download Sample Excel Template'}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isFa ? 'اکسل نمونه' : 'Sample Excel'}</span>
            </button>

            <button
              onClick={exportToCSV}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title={isFa ? 'خروجی اکسل / CSV' : 'Export CSV'}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{isFa ? 'خروجی اکسل' : 'Export CSV'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title={isFa ? 'چاپ لیست پرسنل' : 'Print Personnel List'}
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              <span>{isFa ? 'چاپ لیست' : 'Print'}</span>
            </button>

            <button
              onClick={openNewForm}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isFa ? 'افزودن پرسنل جدید' : 'Add Personnel'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-blue-500/20 space-y-1">
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
              <span className="text-xs font-bold">{isFa ? 'کل پرسنل ثبت‌شده' : 'Total Personnel'}</span>
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{stats.total}</span>
              <span className="text-[10px] text-amber-600 font-bold">{isFa ? 'نفر شاغل' : 'Active Staff'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 space-y-1">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
              <span className="text-xs font-bold">{isFa ? 'واحدهای پوشش داده‌شده' : 'Active Units'}</span>
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{stats.activeUnitsCount}</span>
              <span className="text-[10px] text-blue-600 font-bold">{isFa ? 'واحد عملیاتی' : 'Units'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 space-y-1">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <span className="text-xs font-bold">{isFa ? 'میانگین سنی پرسنل' : 'Average Age'}</span>
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">{stats.avgAge}</span>
              <span className="text-[10px] text-emerald-600 font-bold">{isFa ? 'سال' : 'Years'}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 space-y-1">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
              <span className="text-xs font-bold">{isFa ? 'نسبت افراد متاهل' : 'Marital Ratio'}</span>
              <Heart className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono">٪{stats.marriedPercent}</span>
              <span className="text-[10px] text-purple-600 font-bold">{isFa ? `(${stats.marriedCount} نفر)` : `(${stats.marriedCount})`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SEARCH, FILTER BAR & VIEW TOGGLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Main Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isFa ? "جستجو سریع در نام، کد پرسنلی، کد ملی، شماره تلفن، واحد یا شغل..." : "Search name, code, national ID, unit or job title..."}
              className="w-full pr-10 pl-9 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Switcher Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl shrink-0 self-end lg:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>{isFa ? 'جدول اطلاعات' : 'Table'}</span>
            </button>

            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'cards' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isFa ? 'کارت‌های پرسنلی' : 'Cards'}</span>
            </button>

            <button
              onClick={() => setViewMode('analytics')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'analytics' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>{isFa ? 'تحلیل دموگرافیک' : 'Analytics'}</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-[10px] font-bold text-slate-500 mb-1 block flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-500" />
              {isFa ? 'محل خدمت (سایت / پتروشیمی)' : 'Workplace / Site'}
            </label>
            <select
              value={workplaceFilter}
              onChange={(e) => setWorkplaceFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{isFa ? 'همه محل‌های خدمت' : 'All Workplaces'}</option>
              {siteOptions.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 mb-1 block flex items-center gap-1">
              <Building2 className="w-3 h-3 text-blue-500" />
              {isFa ? 'فیلتر واحد سازمانی' : 'Unit Filter'}
            </label>
            <select
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value);
                setSubUnitFilter('');
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{isFa ? 'همه واحدها' : 'All Units'}</option>
              {units.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 mb-1 block flex items-center gap-1">
              <GitFork className="w-3 h-3 text-indigo-500" />
              {isFa ? 'فیلتر زیرمجموعه' : 'Sub-Unit Filter'}
            </label>
            <select
              disabled={!unitFilter || filterAvailableSubUnits.length === 0}
              value={subUnitFilter}
              onChange={(e) => setSubUnitFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium disabled:opacity-50 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{isFa ? 'همه زیرمجموعه‌ها' : 'All Sub-Units'}</option>
              {filterAvailableSubUnits.map(su => (
                <option key={su} value={su}>{su}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 mb-1 block flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-emerald-500" />
              {isFa ? 'فیلتر تحصیلات' : 'Education Filter'}
            </label>
            <select
              value={educationFilter}
              onChange={(e) => setEducationFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{isFa ? 'همه مدارک تحصیلی' : 'All Education Levels'}</option>
              {EDUCATION_LEVELS.map(edu => (
                <option key={edu} value={edu}>{edu}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 mb-1 block flex items-center gap-1">
              <Heart className="w-3 h-3 text-purple-500" />
              {isFa ? 'وضعیت تاهل' : 'Marital Status'}
            </label>
            <select
              value={maritalFilter}
              onChange={(e) => setMaritalFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="">{isFa ? 'همه وضعیت‌ها' : 'All'}</option>
              {MARITAL_STATUS.map(ms => (
                <option key={ms} value={ms}>{ms}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center flex-wrap gap-1.5">
            {units.length > 0 && (
              <>
                <span className="text-[11px] font-bold text-slate-400">{isFa ? 'فیلترهای سریع:' : 'Quick Filters:'}</span>
                {units.slice(0, 6).map((u) => (
                  <button
                    key={u}
                    onClick={() => { setUnitFilter(unitFilter === u ? '' : u); setSubUnitFilter(''); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      unitFilter === u
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-blue-400'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>{isFa ? 'پاکسازی فیلترها' : 'Clear Filters'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Badges & Count */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span>
              {hasActiveFilters 
                ? (isFa ? `تعداد یافته‌ها: ${filteredList.length} نفر` : `Found: ${filteredList.length} personnel`)
                : (isFa ? 'جهت نمایش اطلاعات، جستجو کنید یا فیلتر مورد نظر را انتخاب نمایید' : 'Search or filter to view personnel')}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span>{isFa ? 'تعداد در صفحه:' : 'Per Page:'}</span>
            {[10, 15, 25, 50, 100].map(sz => (
              <button
                key={sz}
                onClick={() => { setPageSize(sz); setCurrentPage(1); }}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold cursor-pointer ${pageSize === sz ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 3: MAIN VIEW CONTENT (TABLE / CARDS / ANALYTICS) */}

      {/* SEARCH PROMPT EMPTY STATE (Shown when no active filters in table/cards mode) */}
      {!hasActiveFilters && viewMode !== 'analytics' && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Search className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              {isFa ? 'جستجو و انتخاب پرسنل مجتمع' : 'Search & Select Complex Personnel'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isFa 
                ? 'جهت حفظ حریم خصوصی و بهینه‌سازی بارگذاری، اطلاعات پرسنل به صورت پیش‌فرض نمایش داده نمی‌شوند. لطفاً نام، کد پرسنلی یا واحد مورد نظر خود را فیلتر کنید.' 
                : 'For privacy and performance, the personnel list is hidden by default. Please search or apply a filter to view records.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setSearch(' ')}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl transition shadow-xs cursor-pointer"
            >
              {isFa ? 'مشاهده همه پرسنل' : 'Display All Personnel'}
            </button>
            <button
              onClick={() => setUnitFilter('واحد ایمنی و بهداشت')}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              {isFa ? 'واحد ایمنی و بهداشت' : 'Safety Unit'}
            </button>
            <button
              onClick={() => setUnitFilter('واحد آتش‌نشانی و امداد')}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              {isFa ? 'واحد آتش‌نشانی' : 'Fire Dept'}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: TABLE */}
      {viewMode === 'table' && hasActiveFilters && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-xs text-right whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-black">
                <tr>
                  <th className="px-3.5 py-3.5 text-center w-12">{isFa ? 'ردیف' : '#'}</th>
                  <th className="px-3.5 py-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('personnelCode')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'شماره پرسنلی' : 'Personnel Code'}
                      <SortIcon field="personnelCode" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-1">
                      {isFa ? 'نام و نام خانوادگی' : 'Full Name'}
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('education')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'تحصیلات' : 'Education'}
                      <SortIcon field="education" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('workplace')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'محل خدمت' : 'Workplace'}
                      <SortIcon field="workplace" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('unit')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'واحد سازمانی و زیر مجموعه' : 'Unit & Sub-Unit'}
                      <SortIcon field="unit" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('jobTitle')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'عنوان شغلی' : 'Job Title'}
                      <SortIcon field="jobTitle" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center font-mono cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('nationalCode')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'کد ملی' : 'National Code'}
                      <SortIcon field="nationalCode" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('age')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'سن' : 'Age'}
                      <SortIcon field="age" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none" onClick={() => toggleSort('gender')}>
                    <div className="flex items-center justify-center gap-1">
                      {isFa ? 'جنسیت' : 'Gender'}
                      <SortIcon field="gender" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3.5 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedList.map((p, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={`${p.id || 'emp'}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                      {/* 1. ردیف */}
                      <td className="px-3.5 py-3.5 text-center text-slate-400 font-bold font-mono">{globalIdx}</td>
                      
                      {/* 2. شماره پرسنلی */}
                      <td className="px-3.5 py-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {p.personnelCode}
                      </td>

                      {/* 3. نام و نام خانوادگی */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-black flex items-center justify-center text-xs shrink-0 overflow-hidden">
                            {p.profilePhoto ? (
                              <img src={p.profilePhoto} alt={p.firstName} className="w-full h-full object-cover" />
                            ) : (
                              p.firstName[0]
                            )}
                          </div>
                          <div>
                            <button
                              onClick={() => setViewingPersonnel(p)}
                              className="font-extrabold text-slate-800 dark:text-slate-100 hover:text-amber-600 transition text-right block cursor-pointer"
                            >
                              {p.firstName} {p.lastName}
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono block">{p.phone || '-'}</span>
                          </div>
                        </div>
                      </td>

                      {/* 4. تحصیلات */}
                      <td className="px-3.5 py-3.5 text-center font-semibold text-slate-600 dark:text-slate-300">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                          {p.education || '-'}
                        </span>
                      </td>

                      {/* 5. محل خدمت */}
                      <td className="px-3.5 py-3.5 text-center">
                        {p.workplace ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-blue-200 dark:border-blue-800/60 font-bold text-[11px]">
                            <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                            {p.workplace}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      {/* 6. واحد سازمانی و زیر مجموعه */}
                      <td className="px-3.5 py-3.5 text-center">
                        {p.unit ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold text-slate-700 dark:text-slate-200">{p.unit}</span>
                            {p.subUnit && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                <GitFork className="w-2.5 h-2.5" />
                                {p.subUnit}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 7. عنوان شغلی */}
                      <td className="px-3.5 py-3.5 text-center">
                        {p.jobTitle ? (
                          <span className="inline-block font-bold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px]">
                            {p.jobTitle}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 8. کد ملی */}
                      <td className="px-3.5 py-3.5 text-center font-mono font-bold text-slate-600 dark:text-slate-400">
                        {p.nationalCode || '-'}
                      </td>

                      {/* 9. سن */}
                      <td className="px-3.5 py-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {p.age > 0 ? `${p.age} سال` : '-'}
                      </td>

                      {/* 10. جنسیت */}
                      <td className="px-3.5 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${p.gender === 'زن' ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800' : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'}`}>
                          {p.gender || 'مرد'}
                        </span>
                      </td>

                      {/* 11. عملیات */}
                      <td className="px-3.5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingPersonnel(p)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title={isFa ? 'مشاهده پرونده کامل' : 'View Profile'}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title={isFa ? 'ویرایش پرسنل' : 'Edit'}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title={isFa ? 'حذف پرسنل' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400 space-y-2">
                      <Users className="w-8 h-8 mx-auto opacity-40" />
                      <p className="font-bold">{isFa ? 'هیچ پرسنلی با فیلترهای انتخابی یافت نشد.' : 'No personnel found matching criteria.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-500">
                {isFa ? `صفحه ${currentPage} از ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isFa ? 'صفحه قبل' : 'Prev'}
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                ).map(pg => (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    className={`px-3 py-1.5 rounded-xl ${currentPage === pg ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white dark:bg-slate-900 border text-slate-700 dark:text-slate-300'}`}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border rounded-xl disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {isFa ? 'صفحه بعد' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PROFILE CARDS GRID */}
      {viewMode === 'cards' && hasActiveFilters && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedList.map((p, idx) => (
              <div
                key={`${p.id || 'emp'}-${idx}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 hover:shadow-md transition-all relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-black flex items-center justify-center text-base border border-blue-500/20 overflow-hidden shrink-0">
                      {p.profilePhoto ? (
                        <img src={p.profilePhoto} alt={p.firstName} className="w-full h-full object-cover" />
                      ) : (
                        p.firstName[0]
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                        {p.firstName} {p.lastName}
                      </h4>
                      <span className="text-xs font-mono font-extrabold text-amber-600 block">
                        کد: {p.personnelCode}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                    <button
                      onClick={() => setViewingPersonnel(p)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1 font-bold">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      محل خدمت:
                    </span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{p.workplace || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1 font-bold">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      واحد:
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{p.unit || '-'}</span>
                  </div>

                  {p.subUnit && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1 font-bold">
                        <GitFork className="w-3.5 h-3.5 text-indigo-500" />
                        زیرمجموعه:
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{p.subUnit}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1 font-bold">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                      عنوان شغلی:
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{p.jobTitle || '-'}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-slate-500">
                    <span>تلفن: {p.phone || '-'}</span>
                    <span>سن: {p.age > 0 ? `${p.age} سال` : '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination for Cards */}
          {totalPages > 1 && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs font-bold">
              <span className="text-slate-500">صفحه {currentPage} از {totalPages}</span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40"
                >
                  قبل
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40"
                >
                  بعد
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: DEMOGRAPHIC ANALYTICS */}
      {viewMode === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unit Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              <span>{isFa ? 'توزیع پرسنل در واحدهای سازمانی' : 'Personnel Distribution by Unit'}</span>
            </h4>
            <div className="space-y-3">
              {Object.entries(stats.unitMap).map(([unitName, count]) => {
                const numCount = Number(count) || 0;
                const percent = stats.total > 0 ? Math.round((numCount / stats.total) * 100) : 0;
                return (
                  <div key={unitName} className="space-y-1 text-xs">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700 dark:text-slate-200">{unitName}</span>
                      <span className="text-slate-500">{numCount} نفر ({percent}٪)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Education Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-500" />
              <span>{isFa ? 'توزیع مدارک تحصیلی پرسنل' : 'Education Level Distribution'}</span>
            </h4>
            <div className="space-y-3">
              {Object.entries(stats.eduMap).map(([eduLevel, count]) => {
                const numCount = Number(count) || 0;
                const percent = stats.total > 0 ? Math.round((numCount / stats.total) * 100) : 0;
                return (
                  <div key={eduLevel} className="space-y-1 text-xs">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-700 dark:text-slate-200">{eduLevel}</span>
                      <span className="text-slate-500">{numCount} نفر ({percent}٪)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: ADD / EDIT PERSONNEL DRAWER MODAL */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in" onClick={() => setFormOpen(false)}>
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 p-6 space-y-6 animate-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-amber-500" />
                <span>{editingId ? (isFa ? 'ویرایش پرونده پرسنلی' : 'Edit Personnel Record') : (isFa ? 'ثبت پرسنل جدید' : 'Add New Personnel')}</span>
              </h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center justify-center space-y-3 pt-2">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-amber-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm">
                    {form.profilePhoto ? (
                      <img src={form.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-black text-amber-500/50">{form.firstName ? form.firstName.charAt(0) : 'U'}</span>
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 p-2 bg-amber-500 text-white rounded-xl shadow-lg cursor-pointer hover:bg-amber-600 transition hover:scale-105">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  {form.profilePhoto && (
                    <button type="button" onClick={() => setForm(prev => ({...prev, profilePhoto: ''}))} className="absolute -top-2 -left-2 p-1 bg-red-500 text-white rounded-lg shadow cursor-pointer hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-bold">{isFa ? 'عكس پرسنلی' : 'Profile Photo'}</p>
              </div>

              {/* Category 1: Personal Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  {isFa ? '۱. اطلاعات فردی و شناسه' : '1. Personal Information'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'نام' : 'First Name'} *</label>
                    <input required type="text" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'نام خانوادگی' : 'Last Name'} *</label>
                    <input required type="text" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'کد ملی' : 'National Code'}</label>
                    <input type="text" value={form.nationalCode} onChange={e => setForm({...form, nationalCode: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'تلفن همراه' : 'Phone Number'}</label>
                    <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'جنسیت' : 'Gender'}</label>
                    <select
                      value={form.gender || 'مرد'}
                      onChange={e => {
                        const newGender = e.target.value;
                        const autoMilitary = newGender === 'زن' ? 'غیرمشمول (خانم‌ها)' : (form.militaryStatus === 'غیرمشمول (خانم‌ها)' ? 'پایان خدمت' : form.militaryStatus);
                        setForm({...form, gender: newGender, militaryStatus: autoMilitary});
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                    >
                      {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'وضعیت نظام وظیفه' : 'Military Status'}</label>
                    <select
                      value={form.militaryStatus || 'پایان خدمت'}
                      onChange={e => setForm({...form, militaryStatus: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                    >
                      {MILITARY_STATUS_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'تاريخ تولد (شمسی)' : 'Birth Date'}</label>
                  <PersianDatePicker
                    value={form.birthDate}
                    onChange={(jStr) => setForm({...form, birthDate: jStr})}
                    isFa={isFa}
                    placeholder={isFa ? 'انتخاب تاریخ تولد (مثال: ۱۳۶۵/۰۴/۱۵)' : 'YYYY/MM/DD'}
                  />
                </div>
              </div>

              {/* Category 2: Organizational Position */}
              <div className="space-y-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                      <FolderTree className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                        {isFa ? '۲. موقعیت سازمانی و شغل (فراخوانی مستقیم از چارت سازمانی)' : '2. Organizational Mapping'}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {isFa ? 'عناوین شغلی و واحدهای سازمانی دقیقاً بر اساس زیرمجموعه مربوطه در ساختار سازمانی فیلتر می‌شوند.' : 'Units and jobs are strictly filtered by organizational sub-units.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowOrgPickerModal(true)}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                    title={isFa ? 'مشاهده ساختار درختی سازمانی و انتخاب موقعیت' : 'Browse Org Chart'}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>{isFa ? 'انتخاب از درخت چارت سازمانی' : 'Pick from Org Chart'}</span>
                  </button>
                </div>

                {/* Hierarchy Breadcrumb Banner */}
                {hierarchyBreadcrumb && (
                  <div className="p-2.5 bg-gradient-to-r from-blue-50/80 via-slate-50 to-indigo-50/60 dark:from-blue-950/40 dark:via-slate-800/40 dark:to-indigo-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 truncate min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{isFa ? 'مسیر در چارت:' : 'Org Path:'}</span>
                      <span className="font-bold text-blue-700 dark:text-blue-300 text-[11px] truncate">
                        {hierarchyBreadcrumb}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black shrink-0">
                      {isFa ? 'متصل به ساختار' : 'Linked to Org'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'شماره پرسنلی' : 'Personnel Code'} *</label>
                    <input required type="text" value={form.personnelCode} onChange={e => setForm({...form, personnelCode: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold" />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                        {isFa ? 'محل خدمت (سایت / پتروشیمی)' : 'Workplace / Site'}
                      </span>
                      {form.workplace && (
                        <button 
                          type="button" 
                          onClick={() => setForm({...form, workplace: ''})} 
                          className="text-[10px] text-red-500 hover:underline"
                        >
                          {isFa ? 'حذف' : 'Clear'}
                        </button>
                      )}
                    </label>
                    <SearchableSelect 
                      options={siteOptions} 
                      value={form.workplace || ''} 
                      onChange={(val) => setForm({...form, workplace: val})} 
                      placeholder={isFa ? (siteOptions.length > 0 ? 'انتخاب سایت / پتروشیمی از چارت سازمانی...' : 'نوشتن و ثبت محل خدمت (سایت / پتروشیمی)...') : 'Select or enter workplace...'} 
                      isFa={isFa}
                      allowCustom={true}
                    />
                  </div>
                </div>

                {/* Unit selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-500" />
                      {isFa ? 'واحد سازمانی / پلنت / دپارتمان' : 'Unit'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {units.length} {isFa ? 'واحد تعریف‌شده' : 'units'}
                      </span>
                      {form.unit && (
                        <button type="button" onClick={() => handleUnitChange('')} className="text-[10px] text-red-500 hover:underline">
                          {isFa ? 'حذف' : 'Clear'}
                        </button>
                      )}
                    </div>
                  </label>
                  <SearchableSelect 
                    options={units} 
                    value={form.unit || ''} 
                    onChange={handleUnitChange} 
                    placeholder={isFa ? 'انتخاب واحد سازمانی از چارت...' : 'Select unit...'} 
                    isFa={isFa} 
                  />
                </div>

                {/* Sub-unit selection */}
                {form.unit && (
                  availableSubUnits.length > 0 ? (
                    <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/40 space-y-1.5">
                      <label className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <GitFork className="w-3.5 h-3.5 text-indigo-500" />
                          {isFa ? 'زیرمجموعه واحد سازمانی (فیلترکننده مستقیم مشاغل)' : 'Sub-Unit'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-blue-600 font-mono">
                            {availableSubUnits.length} {isFa ? 'زیرمجموعه' : 'sub-units'}
                          </span>
                          {form.subUnit && (
                            <button type="button" onClick={() => handleSubUnitChange('')} className="text-[10px] text-blue-600 hover:underline font-bold">
                              {isFa ? 'مستقیم در سطح واحد' : 'Direct Unit'}
                            </button>
                          )}
                        </div>
                      </label>
                      <SearchableSelect 
                        options={availableSubUnits} 
                        value={form.subUnit || ''} 
                        onChange={handleSubUnitChange} 
                        placeholder={isFa ? 'انتخاب زیرمجموعه سازمانی...' : 'Select sub-unit...'} 
                        isFa={isFa} 
                      />
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span>{isFa ? 'این واحد فاقد زیرمجموعه مجزا در چارت است و پرسنل مستقیماً به خود واحد منتسب می‌گردد.' : 'This unit has no sub-units and assigns staff directly.'}</span>
                    </div>
                  )
                )}

                {/* Job Title - STRICTLY FILTERED BY SUB-UNIT / UNIT */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isFa ? 'عنوان شغلی / سمت سازمانی' : 'Job Title'}</span>
                      {form.subUnit ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black">
                          {isFa ? `منحصراً زیرمجموعه «${form.subUnit}»` : `Sub-unit: ${form.subUnit}`}
                        </span>
                      ) : form.unit ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-black">
                          {isFa ? `منحصراً واحد «${form.unit}»` : `Unit: ${form.unit}`}
                        </span>
                      ) : null}
                    </label>

                    <div className="flex items-center gap-2">
                      {form.jobTitle && (
                        <button type="button" onClick={() => setForm(prev => ({ ...prev, jobTitle: '' }))} className="text-[10px] text-red-500 hover:underline">
                          {isFa ? 'حذف' : 'Clear'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* If jobs exist for this sub-unit/unit */}
                  {availableJobs.length > 0 ? (
                    <SearchableSelect 
                      options={availableJobs as string[]} 
                      value={form.jobTitle || ''} 
                      onChange={val => setForm({...form, jobTitle: val})} 
                      placeholder={isFa ? (form.subUnit ? `انتخاب شغل از زیرمجموعه ${form.subUnit}...` : 'انتخاب عنوان شغلی...') : 'Select job...'} 
                      isFa={isFa} 
                    />
                  ) : (
                    /* If no jobs exist for this sub-unit/unit in the Org Structure */
                    <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/60 space-y-2.5">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>{jobOriginInfo}</span>
                      </div>

                      {form.unit && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 block font-semibold">
                            {isFa ? 'افزودن و تخصیص شغل جدید به این موقعیت سازمانی:' : 'Add and link new job title:'}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={quickNewJobTitle}
                              onChange={e => setQuickNewJobTitle(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddNewJobToCurrentOrgLevel();
                                }
                              }}
                              placeholder={isFa ? 'عنوان شغلی جدید (مثال: کارشناس ارشد عملیات)...' : 'New job title...'}
                              className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddNewJobToCurrentOrgLevel()}
                              disabled={!quickNewJobTitle.trim()}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 transition shadow-xs cursor-pointer shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isFa ? 'ثبت در ساختار' : 'Add to Org'}</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback badge and admin overrides */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-medium">{jobOriginInfo}</span>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {form.unit && !showQuickAddJob && availableJobs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowQuickAddJob(true)}
                          className="text-blue-600 hover:text-blue-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>{isFa ? '+ ثبت شغل جدید برای این واحد' : '+ New Job'}</span>
                        </button>
                      )}

                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowAllJobsFallback}
                          onChange={e => setAllowAllJobsFallback(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                        />
                        <span>{isFa ? 'نمایش تمام مشاغل سامانه' : 'Show all jobs'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Expandable inline Quick Add job for current unit/subUnit */}
                  {showQuickAddJob && (
                    <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-300">
                        <span>
                          {isFa 
                            ? `افزودن و انتساب مستقیم شغل به ${form.subUnit ? `زیرمجموعه «${form.subUnit}»` : `واحد «${form.unit}»`} در ساختار سازمانی:`
                            : 'Add new job to current organizational level:'}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setShowQuickAddJob(false)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={quickNewJobTitle}
                          onChange={e => setQuickNewJobTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddNewJobToCurrentOrgLevel();
                            }
                          }}
                          placeholder={isFa ? 'عنوان شغلی مورد نظر را بنویسید...' : 'Job title...'}
                          className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddNewJobToCurrentOrgLevel()}
                          disabled={!quickNewJobTitle.trim()}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition shadow-xs cursor-pointer shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isFa ? 'تأیید و ذخیره در ساختار' : 'Save'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Category 3: Additional Details */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                  {isFa ? '۳. مشخصات تحصیلی و خانوادگی' : '3. Additional Details'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'مدرک تحصیلی' : 'Education'}</label>
                    <select value={form.education} onChange={e => setForm({...form, education: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                      {EDUCATION_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'وضعیت تاهل' : 'Marital Status'}</label>
                    <select value={form.maritalStatus} onChange={e => setForm({...form, maritalStatus: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                      {MARITAL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'تعداد فرزند' : 'Children'}</label>
                    <select value={form.childrenCount} onChange={e => setForm({...form, childrenCount: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs">
                      {CHILDREN_COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{isFa ? 'توضیحات و ملاحظات' : 'Notes'}</label>
                  <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs min-h-[60px]" />
                </div>

                {/* Official Signature Sample (PNG / JPEG) */}
                <div className="pt-2">
                  <div className="p-4 bg-indigo-50/50 dark:bg-slate-800/60 border border-indigo-200/80 dark:border-indigo-900/50 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                          {isFa ? 'نمونه امضای رسمی پرسنل (فرمت PNG یا JPEG)' : 'Official Signature Sample (PNG / JPEG)'}
                        </span>
                      </div>
                      {form.signatureImage && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isFa ? 'ثبت شده' : 'Uploaded'}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {isFa
                        ? 'نمونه امضای بارگذاری‌شده در هنگام امضای مجوزهای کار (پرمیت)، ارزیابی ریسک و ارجاع اسناد کارتابل به‌صورت خودکار استفاده می‌شود.'
                        : 'Used automatically when signing work permits, risk assessments, and document referrals.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-7">
                        <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 rounded-xl bg-white/80 dark:bg-slate-900/70 transition cursor-pointer text-center">
                          <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-1" />
                          <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                            {form.signatureImage
                              ? (isFa ? 'تغییر فایل نمونه امضا (PNG / JPEG)' : 'Replace Signature (PNG / JPEG)')
                              : (isFa ? 'انتخاب فایل نمونه امضا (PNG / JPEG)' : 'Select Signature (PNG / JPEG)')}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {isFa ? 'فرمت PNG یا JPG/JPEG • حداکثر ۵ مگابایت' : 'PNG or JPG/JPEG • Max 5MB'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
                            onChange={handleSignatureUpload}
                            className="hidden"
                          />
                        </label>
                        {signatureError && (
                          <p className="text-[11px] text-rose-600 font-bold mt-1.5">{signatureError}</p>
                        )}
                      </div>

                      <div className="sm:col-span-5">
                        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 min-h-[96px] flex flex-col items-center justify-center relative">
                          {form.signatureImage ? (
                            <>
                              <img
                                src={form.signatureImage}
                                alt="Signature Preview"
                                className="max-h-14 max-w-full object-contain my-1 mix-blend-multiply dark:mix-blend-normal"
                              />
                              <button
                                type="button"
                                onClick={() => setForm(prev => ({ ...prev, signatureImage: '' }))}
                                className="mt-1 px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{isFa ? 'حذف امضا' : 'Remove'}</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-bold">
                              {isFa ? 'بدون نمونه امضا' : 'No Signature'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-amber-500/20">
                  <Save className="w-4 h-4" />
                  <span>{editingId ? (isFa ? 'ذخیره تغییرات' : 'Save Changes') : (isFa ? 'ثبت نهایی پرسنل' : 'Create Personnel')}</span>
                </button>
                <button type="button" onClick={() => setFormOpen(false)} className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold py-2.5 rounded-xl transition cursor-pointer">
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION 5: VIEW PERSONNEL PROFILE MODAL */}
      {viewingPersonnel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in" onClick={() => setViewingPersonnel(null)}>
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 space-y-0"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white space-y-2 relative">
              <button 
                onClick={() => setViewingPersonnel(null)} 
                className="absolute left-4 top-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title={isFa ? 'بستن' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 text-white font-black flex items-center justify-center text-2xl border border-white/20 shadow-inner shrink-0 overflow-hidden">
                  {viewingPersonnel.profilePhoto ? (
                    <img src={viewingPersonnel.profilePhoto} alt={viewingPersonnel.firstName} className="w-full h-full object-cover" />
                  ) : (
                    viewingPersonnel.firstName[0]
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white flex items-center gap-2 flex-wrap">
                    <span>{viewingPersonnel.firstName} {viewingPersonnel.lastName}</span>
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-white/20 font-mono text-xs font-black text-white">
                      کد پرسنلی: {viewingPersonnel.personnelCode}
                    </span>
                    {viewingPersonnel.gender && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/15 text-xs font-bold text-blue-100">
                        {viewingPersonnel.gender}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-6 space-y-5 text-xs">
              {/* Organizational Position - 5 Columns on wide view */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="space-y-1 min-w-0">
                  <span className="text-slate-400 block font-bold text-[10px]">{isFa ? 'محل خدمت' : 'Workplace'}</span>
                  <strong className="text-amber-600 dark:text-amber-400 block font-extrabold truncate" title={viewingPersonnel.workplace || '-'}>
                    {viewingPersonnel.workplace || '-'}
                  </strong>
                </div>

                <div className="space-y-1 min-w-0">
                  <span className="text-slate-400 block font-bold text-[10px]">{isFa ? 'واحد سازمانی' : 'Unit'}</span>
                  <strong className="text-slate-800 dark:text-slate-100 block font-extrabold truncate" title={viewingPersonnel.unit || '-'}>
                    {viewingPersonnel.unit || '-'}
                  </strong>
                </div>

                <div className="space-y-1 min-w-0">
                  <span className="text-slate-400 block font-bold text-[10px]">{isFa ? 'زیرمجموعه واحد' : 'Sub-Unit'}</span>
                  <strong className="text-blue-600 dark:text-blue-400 block font-extrabold truncate" title={viewingPersonnel.subUnit || '-'}>
                    {viewingPersonnel.subUnit || '-'}
                  </strong>
                </div>

                <div className="space-y-1 min-w-0">
                  <span className="text-slate-400 block font-bold text-[10px]">{isFa ? 'عنوان شغلی' : 'Job Title'}</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 block font-extrabold truncate" title={viewingPersonnel.jobTitle || '-'}>
                    {viewingPersonnel.jobTitle || '-'}
                  </strong>
                </div>

                <div className="space-y-1 min-w-0">
                  <span className="text-slate-400 block font-bold text-[10px]">{isFa ? 'کد ملی' : 'National ID'}</span>
                  <strong className="text-slate-800 dark:text-slate-100 font-mono block font-bold">
                    {viewingPersonnel.nationalCode || '-'}
                  </strong>
                </div>
              </div>

              {/* Personal & Demographic Details - 3 Columns with single-line labels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 font-semibold">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/20 rounded-2xl flex items-center justify-between gap-2 border border-slate-100/80 dark:border-slate-800">
                  <span className="text-slate-400 text-xs font-bold whitespace-nowrap">وضعیت نظام وظیفه:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                    {viewingPersonnel.militaryStatus || 'پایان خدمت'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/20 rounded-2xl flex items-center justify-between gap-2 border border-slate-100/80 dark:border-slate-800">
                  <span className="text-slate-400 text-xs font-bold whitespace-nowrap">تلفن تماس همراه:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs dir-ltr">
                    {viewingPersonnel.phone || '-'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/20 rounded-2xl flex items-center justify-between gap-2 border border-slate-100/80 dark:border-slate-800">
                  <span className="text-slate-400 text-xs font-bold whitespace-nowrap">سن / تاریخ تولد:</span>
                  <div className="flex items-center gap-2 text-xs">
                    {viewingPersonnel.age > 0 && <span className="font-bold text-slate-800 dark:text-slate-200">{viewingPersonnel.age} سال</span>}
                    {viewingPersonnel.birthDate && <DualDateBadge date={viewingPersonnel.birthDate} mode="both" showTooltip />}
                    {!viewingPersonnel.age && !viewingPersonnel.birthDate && <span className="text-slate-400 font-mono">-</span>}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/20 rounded-2xl flex items-center justify-between gap-2 border border-slate-100/80 dark:border-slate-800">
                  <span className="text-slate-400 text-xs font-bold whitespace-nowrap">مدرک تحصیلی:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {viewingPersonnel.education || '-'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/20 rounded-2xl flex items-center justify-between gap-2 border border-slate-100/80 dark:border-slate-800">
                  <span className="text-slate-400 text-xs font-bold whitespace-nowrap">وضعیت تاهل / فرزندان:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {viewingPersonnel.maritalStatus} ({viewingPersonnel.childrenCount || '۰'} فرزند)
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/20 rounded-2xl flex items-center justify-between gap-2 border border-slate-100/80 dark:border-slate-800">
                  <span className="text-slate-400 text-xs font-bold whitespace-nowrap">جنسیت:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {viewingPersonnel.gender || 'مرد'}
                  </span>
                </div>
              </div>

              {viewingPersonnel.notes && (
                <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl space-y-1">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">توضیحات و ملاحظات:</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs">{viewingPersonnel.notes}</p>
                </div>
              )}

              {/* Official Signature Sample Display in Profile Modal */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFa ? 'نمونه امضای رسمی پرسنل (PNG / JPEG):' : 'Official Signature Sample:'}</span>
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {(viewingPersonnel.signatureImage || getPersonnelSignature(viewingPersonnel))
                      ? (isFa ? 'ثبت شده و آماده استفاده خودکار در امضا و ارجاع اسناد' : 'Registered for document signing & referrals')
                      : (isFa ? 'نمونه امضا ثبت نشده است' : 'No signature uploaded yet')}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 min-w-[130px] h-16 flex items-center justify-center shrink-0">
                  {(viewingPersonnel.signatureImage || getPersonnelSignature(viewingPersonnel)) ? (
                    <img
                      src={viewingPersonnel.signatureImage || getPersonnelSignature(viewingPersonnel)}
                      alt="Signature Sample"
                      className="max-h-12 max-w-[120px] object-contain mix-blend-multiply dark:mix-blend-normal"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold">{isFa ? 'بدون نمونه امضا' : 'No Signature'}</span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    const p = viewingPersonnel;
                    setViewingPersonnel(null);
                    handleDelete(p);
                  }}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/30 dark:hover:bg-red-900/40 dark:text-red-400 font-bold rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isFa ? 'حذف پرسنل' : 'Delete'}</span>
                </button>
                <button
                  onClick={() => {
                    const p = viewingPersonnel;
                    setViewingPersonnel(null);
                    handleEdit(p);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>{isFa ? 'ویرایش اطلاعات پرسنل' : 'Edit Personnel'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && personnelToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in" onClick={() => !isDeleting && setDeleteModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md p-6 text-center space-y-4 border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
              {isFa ? 'تأییدیه حذف پرسنل از پایگاه داده اصلی' : 'Permanent Personnel Deletion'}
            </h3>

            <div className="p-3 bg-red-50/70 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 rounded-2xl text-right space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-200">
                <span className="font-bold text-slate-500">{isFa ? 'نام و نام خانوادگی:' : 'Full Name:'}</span>
                <span className="font-black">{personnelToDelete.firstName} {personnelToDelete.lastName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-200">
                <span className="font-bold text-slate-500">{isFa ? 'کد پرسنلی:' : 'Personnel Code:'}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{personnelToDelete.personnelCode || '—'}</span>
              </div>
              {personnelToDelete.nationalCode && (
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-200">
                  <span className="font-bold text-slate-500">{isFa ? 'کد ملی:' : 'National ID:'}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">{personnelToDelete.nationalCode}</span>
                </div>
              )}
              {personnelToDelete.unit && (
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-200">
                  <span className="font-bold text-slate-500">{isFa ? 'واحد سازمانی:' : 'Unit:'}</span>
                  <span className="text-slate-600 dark:text-slate-300">{personnelToDelete.unit}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-red-600 dark:text-red-400 font-bold leading-relaxed">
              {isFa 
                ? 'هشدار: این پرسنل به طور مستقیم و دائمی از پایگاه داده PostgreSQL حذف شده و از کش سیستم پاکسازی می‌گردد.' 
                : 'Warning: This will permanently delete the personnel record directly from PostgreSQL database.'}
            </p>

            <label className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl cursor-pointer text-right border border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              <input
                type="checkbox"
                checked={deleteAssociatedUser}
                onChange={e => setDeleteAssociatedUser(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {isFa 
                  ? 'حذف همزمان حساب کاربری متناظر در بخش کاربران (در صورت وجود)' 
                  : 'Also delete associated user login account (if exists)'}
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setPersonnelToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={executeDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{isFa ? 'در حال حذف...' : 'Deleting...'}</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isFa ? 'تأیید و حذف قطعی' : 'Confirm Delete'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* EXCEL IMPORT MODAL */}
      <PersonnelExcelImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        personnelList={personnelList}
        onSuccess={async (updatedList) => {
          setPersonnelList(updatedList);
          try {
            await apiDb.batchSavePersonnel(updatedList);
            const fresh = await apiDb.getPersonnel();
            if (fresh && fresh.length > 0) {
              setPersonnelList(fresh as any);
            }
          } catch (e) {
            console.error('Failed to sync updated personnel list with database:', e);
          }
        }}
        currentUser={currentUser}
        isFa={isFa}
      />

      {/* SAVE CONFIRMATION MODAL */}
      {saveConfirmOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
          <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-emerald-700/60 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  {editingId
                    ? (isFa ? 'تایید نهایی ذخیره تغییرات پرسنل' : 'Confirm Saving Personnel Changes')
                    : (isFa ? 'تایید نهایی ثبت پرسنل جدید' : 'Confirm New Personnel Registration')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {isFa ? 'اطلاعات در پایگاه داده اصلی ذخیره و برای تمام کاربران همگام‌سازی می‌شود' : 'Data will be persisted to the central database'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isFa ? 'نام و نام خانوادگی:' : 'Full Name:'}</span>
                <span className="font-black text-slate-900 dark:text-white">{form.firstName} {form.lastName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isFa ? 'کد پرسنلی:' : 'Personnel Code:'}</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{form.personnelCode}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">{isFa ? 'واحد / عنوان شغلی:' : 'Unit / Job Title:'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{form.unit || '—'} / {form.jobTitle || '—'}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                <span className="text-slate-500 font-bold">{isFa ? 'وضعیت نمونه امضا:' : 'Signature Sample:'}</span>
                {form.signatureImage ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-black">
                      {isFa ? 'دارای نمونه امضا' : 'Attached'}
                    </span>
                    <img src={form.signatureImage} alt="Signature" className="h-8 max-w-[80px] object-contain bg-white rounded border border-slate-200 px-1" />
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 font-bold">{isFa ? 'بدون نمونه امضا' : 'None'}</span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
              {isFa
                ? `آیا از ثبت و ذخیره تغییرات مشخصات «${form.firstName} ${form.lastName}» اطمینان دارید؟`
                : `Are you sure you want to save changes for "${form.firstName} ${form.lastName}"?`}
            </p>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSavingPersonnel}
                onClick={executeSavePersonnel}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingPersonnel ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'بله، تایید و ذخیره شود' : 'Yes, Confirm & Save')}</span>
              </button>
              <button
                type="button"
                disabled={isSavingPersonnel}
                onClick={() => setSaveConfirmOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                {isFa ? 'بازگشت به فرم' : 'Back'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE SUCCESS TOAST BANNER */}
      {saveToastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400 flex items-center gap-3 text-xs sm:text-sm font-black animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />
          <span>{saveToastMessage}</span>
          <button
            type="button"
            onClick={() => setSaveToastMessage(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ORGANIZATIONAL CHART & SUB-UNITS PICKER MODAL */}
      <OrgChartPickerModal
        isOpen={showOrgPickerModal}
        onClose={() => setShowOrgPickerModal(false)}
        onSelect={handleOrgSelectionFromModal}
        orgNodes={orgNodes}
        orgStructure={orgStructure}
        currentWorkplace={form.workplace}
        currentUnit={form.unit}
        currentSubUnit={form.subUnit}
        currentJobTitle={form.jobTitle}
        isFa={isFa}
      />
    </div>
  );
}
