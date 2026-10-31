import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Shield,
  ShieldCheck,
  Check,
  Pencil,
  Search,
  Info,
  X,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FolderTree,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GitFork,
  Tag,
  ArrowLeft,
  Briefcase,
  Sparkles,
  Users,
  Filter
} from 'lucide-react';
import {
  UNITS as defaultUnits,
  getJobTitles,
  OrgUnitsDataMap,
  getOrgUnitsStructure,
  saveOrgUnitsStructure,
  fetchAllOrgConfigFromDb,
  saveJobTitlesToDb,
  getStoredIncidentTypes,
  saveIncidentTypesToDb,
  getStoredPpeCategories,
  savePpeCategoriesToDb,
  getStoredPpeItems,
  savePpeItemsToDb,
  translatePpeNameToEn
} from '../utils/orgHelper';
import { PpeItem, OshaPpeCategory } from '../types';
import { syncAndGetExtractedDepartments, getStoredOrgNodes, fetchStoredOrgNodes, saveStoredOrgNodes } from '../utils/personnelHelper';
import { OrgNode, hasPermission, isUserAdmin } from '../utils/authHelper';
import OrgStructureManager, { ORG_TYPE_LABELS } from './OrgStructureManager';
import OrgBackupRestorePanel from './OrgBackupRestorePanel';

export interface PpeCategoryItem {
  id: string;
  nameFa: string;
  nameEn: string;
  oshaCode?: string;
}

export interface HseIncidentCategoryItem {
  id: string;
  group: 'high_severity' | 'recordable' | 'proactive';
  titleFa: string;
  titleEn: string;
  code?: string;
  descriptionFa?: string;
}

export const DEFAULT_INCIDENT_TYPES: HseIncidentCategoryItem[] = [
  // 🔴 High Severity Incidents
  { id: 'inc-type-1', group: 'high_severity', titleFa: 'فوت (Fatality)', titleEn: 'Fatality', code: 'FAT', descriptionFa: 'حوادث منجر به فوت نیروی کار در محیط شغلی' },
  { id: 'inc-type-2', group: 'high_severity', titleFa: 'زمان از دست رفته (Lost Time / LTI)', titleEn: 'Lost Time Injury (LTI)', code: 'LTI', descriptionFa: 'حوادث منجر به غیبت از کار و ناتوانی موقت یا دائم' },
  { id: 'inc-type-3', group: 'high_severity', titleFa: 'کار محدود شده (Restricted Work / RWC)', titleEn: 'Restricted Work Case (RWC)', code: 'RWC', descriptionFa: 'حوادث منجر به عدم توانایی انجام وظایف عادی شغلی و انتقال به کار سبک' },

  // 🟡 Recordable Incidents
  { id: 'inc-type-4', group: 'recordable', titleFa: 'درمان پزشکی (Medical Treatment / MTC)', titleEn: 'Medical Treatment Case (MTC)', code: 'MTC', descriptionFa: 'حوادث نیازمند مداخله و درمان تخصصی توسط پزشک یا کلینیک' },
  { id: 'inc-type-5', group: 'recordable', titleFa: 'کمک‌های اولیه (First Aid / FAC)', titleEn: 'First Aid Case (FAC)', code: 'FAC', descriptionFa: 'جراحات جزیی و سطحی قابل درمان در بهداری کارگاه' },
  { id: 'inc-type-6', group: 'recordable', titleFa: 'حریق و آتش‌سوزی (Fires)', titleEn: 'Fires & Explosions', code: 'FIRE', descriptionFa: 'وقوع هرگونه حریق، انباشت دود یا انفجار در کارگاه' },
  { id: 'inc-type-7', group: 'recordable', titleFa: 'خسارت به اموال و تجهیزات (Property Damage)', titleEn: 'Property Damage', code: 'PD', descriptionFa: 'آسیب به ماشین‌آلات، ابزارآلات، دستگاه‌ها و زیرساخت‌های کارگاهی' },
  { id: 'inc-type-8', group: 'recordable', titleFa: 'حوادث ترافیکی و خودرویی (Traffic Incidents)', titleEn: 'Traffic Incidents', code: 'TRF', descriptionFa: 'تصادفات، واژگونی و برخورد وسایل نقلیه و ماشین‌آلات سنگین' },
  { id: 'inc-type-9', group: 'recordable', titleFa: 'نشت و آلودگی محیط زیست (Environment Release)', titleEn: 'Environmental Release', code: 'ENV', descriptionFa: 'ریزش مواد شیمیایی، نشت گاز، مواد نفتی یا آلودگی خاک و آب' },

  // 🟢 Proactive HSE Reporting
  { id: 'inc-type-10', group: 'proactive', titleFa: 'شبه حادثه (Near Miss)', titleEn: 'Near Miss', code: 'NM', descriptionFa: 'رویدادهای بدون خسارت جانبی و مالی اما دارای پتانسیل خطر' },
  { id: 'inc-type-11', group: 'proactive', titleFa: 'شرایط ناایمن (Unsafe Condition)', titleEn: 'Unsafe Condition', code: 'UC', descriptionFa: 'وجود عیوب فیزیکی، ساختاری یا محیطی مخاطره‌آمیز در محیط کار' },
  { id: 'inc-type-12', group: 'proactive', titleFa: 'عمل ناایمن (Unsafe Act)', titleEn: 'Unsafe Act', code: 'UA', descriptionFa: 'اقدام یا رفتار غیرایمن فردی بر خلاف دستورالعمل‌های HSE' },
];

export const DEFAULT_PPE_CATEGORIES: PpeCategoryItem[] = [
  { id: 'cat-1', nameFa: 'محافظت از سر', nameEn: 'Head Protection', oshaCode: 'OSHA 1910.135' },
  { id: 'cat-2', nameFa: 'محافظت از چشم و صورت', nameEn: 'Eye & Face Protection', oshaCode: 'OSHA 1910.133' },
  { id: 'cat-3', nameFa: 'محافظت از دستگاه تنفسی', nameEn: 'Respiratory Protection', oshaCode: 'OSHA 1910.134' },
  { id: 'cat-4', nameFa: 'محافظت از پا', nameEn: 'Foot Protection', oshaCode: 'OSHA 1910.136' },
  { id: 'cat-5', nameFa: 'محافظت از دست و بازو', nameEn: 'Hand & Arm Protection', oshaCode: 'OSHA 1910.138' },
  { id: 'cat-6', nameFa: 'محافظت شنیداری', nameEn: 'Hearing Protection', oshaCode: 'OSHA 1910.95' },
  { id: 'cat-7', nameFa: 'سیستم‌های مهار سقوط', nameEn: 'Fall Protection', oshaCode: 'OSHA 1926.502' },
  { id: 'cat-8', nameFa: 'لباس کار و جلیقه شبرنگ', nameEn: 'Body & High-Vis Clothing', oshaCode: 'OSHA General' }
];

// --- ORG STRUCTURE & CHART SYNC HELPERS ---
// Helper: get full hierarchical path for an OrgNode
const getOrgNodeFullPath = (nodeId: string, allNodes: OrgNode[]): string => {
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) return '';
  const path: string[] = [node.name];
  let curr = node;
  let guard = 0;
  while (curr.parentId && guard < 10) {
    guard++;
    const parent = allNodes.find(n => n.id === curr.parentId);
    if (!parent) break;
    path.unshift(parent.name);
    curr = parent;
  }
  return path.join(' > ');
};

// Helper: get direct child nodes for an OrgNode
const getOrgNodeChildren = (nodeId: string, allNodes: OrgNode[]): OrgNode[] => {
  return allNodes.filter(n => n.parentId === nodeId);
};

// Helper: match unit name with an OrgNode (case-insensitive & trimmed)
const findOrgNodeByName = (name: string, allNodes: OrgNode[]): OrgNode | undefined => {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return allNodes.find(n => n.name.trim().toLowerCase() === clean);
};

// Helper: register/sync a sub-unit to org_nodes as a child Section
const syncSubUnitToOrgNodes = (parentUnitName: string, subUnitName: string, allNodes: OrgNode[]): OrgNode[] => {
  const parentNode = findOrgNodeByName(parentUnitName, allNodes);
  if (!parentNode) return allNodes;

  const existingChild = allNodes.find(
    n => n.parentId === parentNode.id && n.name.trim().toLowerCase() === subUnitName.trim().toLowerCase()
  );
  if (existingChild) return allNodes;

  const newNode: OrgNode = {
    id: `org-sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: subUnitName.trim(),
    type: 'Section',
    parentId: parentNode.id,
    code: `SEC-${Math.floor(100 + Math.random() * 900)}`,
    description: `بخش و زیرمجموعه عملیاتی واحد ${parentUnitName}`,
    status: 'active',
    createdAt: new Date().toLocaleDateString('fa-IR')
  };

  const updated = [...allNodes, newNode];
  try {
    saveStoredOrgNodes(updated);
    syncAndGetExtractedDepartments();
  } catch (e) {
    console.error('Failed to sync sub-unit to org nodes', e);
  }
  return updated;
};

export default function OrganizationMgmt({ isFa, currentUser }: { isFa: boolean; currentUser?: any }) {
  const [activeTab, setActiveTab] = useState<'org_hierarchy' | 'units_jobs' | 'incident_types' | 'ppe_equipment' | 'backup_restore'>('org_hierarchy');

  // Master Org Nodes (Synchronized strictly with central database)
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>(() => getStoredOrgNodes());

  // --- 1. Units, Sub-Units & Position Structure State ---
  const [orgStructure, setOrgStructure] = useState<OrgUnitsDataMap>(() => getOrgUnitsStructure());
  const [jobTitles, setJobTitles] = useState<string[]>(() => getJobTitles());

  // --- 2. Incident Category Types State ---
  const [incidentTypes, setIncidentTypes] = useState<HseIncidentCategoryItem[]>(() => getStoredIncidentTypes());

  // --- 3. PPE Categories & Catalog Items State ---
  const [ppeCategories, setPpeCategories] = useState<PpeCategoryItem[]>(() => getStoredPpeCategories());
  const [ppeItems, setPpeItems] = useState<PpeItem[]>(() => getStoredPpeItems());

  const [isRemoteHydrated, setIsRemoteHydrated] = useState(false);

  const refreshOrgNodes = async (forceRefresh = false) => {
    const nodes = await fetchStoredOrgNodes(forceRefresh);
    setOrgNodes(nodes);
  };

  const refreshAllOrgSettings = async (forceRefresh = false) => {
    const [nodes, config] = await Promise.all([
      fetchStoredOrgNodes(forceRefresh),
      fetchAllOrgConfigFromDb(forceRefresh)
    ]);
    setOrgNodes(nodes);
    setOrgStructure(config.orgStructure);
    setJobTitles(config.jobTitles);
    setIncidentTypes(config.incidentTypes);
    setPpeCategories(config.ppeCategories);
    setPpeItems(config.ppeItems);
    setIsRemoteHydrated(true);
  };

  useEffect(() => {
    refreshAllOrgSettings(true);

    const handleRemoteUpdate = (e?: any) => {
      // Ignore updates initiated by this component to avoid self-overwrite race conditions
      if (e?.detail?.origin === 'OrganizationMgmt') return;
      const entity = String(e?.detail?.entityType || e?.detail?.entity || e?.detail?.key || '').toLowerCase();
      if (
        entity.includes('org') ||
        entity.includes('node') ||
        entity.includes('department') ||
        entity.includes('unit') ||
        entity.includes('setting') ||
        entity.includes('ppe') ||
        entity.includes('incident')
      ) {
        refreshAllOrgSettings(false);
      }
    };

    window.addEventListener('hse_org_nodes_updated', () => setOrgNodes(getStoredOrgNodes()));
    window.addEventListener('app_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_central_data_synced', handleRemoteUpdate);
    return () => {
      window.removeEventListener('hse_org_nodes_updated', () => setOrgNodes(getStoredOrgNodes()));
      window.removeEventListener('app_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_central_data_synced', handleRemoteUpdate);
    };
  }, [activeTab]);

  // Org Chart Unit Picker Modal State
  const [showOrgChartPickerModal, setShowOrgChartPickerModal] = useState(false);
  const [orgChartSearch, setOrgChartSearch] = useState('');
  const [orgChartTypeFilter, setOrgChartTypeFilter] = useState('ALL');
  const [selectedOrgNodeForConfig, setSelectedOrgNodeForConfig] = useState<OrgNode | null>(null);
  const [selectedChildNodesToImport, setSelectedChildNodesToImport] = useState<Record<string, boolean>>({});
  const [pickerCustomSubUnits, setPickerCustomSubUnits] = useState('');
  const [pickerCustomJobs, setPickerCustomJobs] = useState('');
  
  // Sync Sub-Unit to Org Chart toggle per unit
  const [syncSubUnitToOrgChart, setSyncSubUnitToOrgChart] = useState<Record<string, boolean>>({});

  // Feedback Toast
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type?: 'success' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Add Unit Modal Source Selection
  const [addUnitSource, setAddUnitSource] = useState<'from_org_chart' | 'manual'>('from_org_chart');
  const [selectedOrgNodeIdInAddModal, setSelectedOrgNodeIdInAddModal] = useState<string>('');

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    const struct = getOrgUnitsStructure();
    Object.keys(struct).slice(0, 5).forEach(k => { init[k] = true; });
    return init;
  });

  const [expandedSubUnits, setExpandedSubUnits] = useState<Record<string, boolean>>({});

  const [unitSearch, setUnitSearch] = useState('');
  const [jobSearch, setJobSearch] = useState('');

  const [newUnit, setNewUnit] = useState('');
  const [newUnitSubUnitsStr, setNewUnitSubUnitsStr] = useState('');
  const [newUnitJobsStr, setNewUnitJobsStr] = useState('');
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);

  // Quick inputs per unit/sub-unit
  const [newSubUnitInputs, setNewSubUnitInputs] = useState<Record<string, string>>({});
  const [newUnitDirectJobInputs, setNewUnitDirectJobInputs] = useState<Record<string, string>>({});
  const [newSubUnitJobInputs, setNewSubUnitJobInputs] = useState<Record<string, string>>({}); // Key: `${unitName}:::${subName}`
  
  // In-place editing state
  const [editingUnitName, setEditingUnitName] = useState<string | null>(null);
  const [editUnitVal, setEditUnitVal] = useState('');
  
  const [editingSubUnit, setEditingSubUnit] = useState<{ unitName: string; oldSubName: string; val: string } | null>(null);
  
  const [editingJobItem, setEditingJobItem] = useState<{
    type: 'unit_direct' | 'subunit' | 'global';
    unitName?: string;
    subUnitName?: string;
    idx: number;
    val: string;
  } | null>(null);

  const [newJob, setNewJob] = useState('');
  const [editingJobIdx, setEditingJobIdx] = useState<number | null>(null);
  const [editJobVal, setEditJobVal] = useState('');

  // Explicit, atomic database persistence handlers with error handling & feedback
  const persistOrgStructure = async (nextStruct: OrgUnitsDataMap, successMsg?: string): Promise<boolean> => {
    setOrgStructure(nextStruct);
    const ok = await saveOrgUnitsStructure(nextStruct);
    if (ok) {
      syncAndGetExtractedDepartments();
      window.dispatchEvent(new CustomEvent('hse_unit_structure_updated', { detail: { origin: 'OrganizationMgmt' } }));
      window.dispatchEvent(new CustomEvent('hse_departments_updated', { detail: { origin: 'OrganizationMgmt' } }));
      window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { origin: 'OrganizationMgmt', entity: 'unit_structure' } }));
      if (successMsg) showToast(successMsg, 'success');
    } else {
      showToast(isFa ? 'خطا در ذخیره‌سازی اطلاعات در پایگاه داده اصلی.' : 'Error saving to database.', 'info');
    }
    return ok;
  };

  const persistJobTitles = async (nextJobs: string[], successMsg?: string): Promise<boolean> => {
    setJobTitles(nextJobs);
    const ok = await saveJobTitlesToDb(nextJobs);
    if (ok) {
      window.dispatchEvent(new CustomEvent('hse_org_jobs_updated', { detail: { origin: 'OrganizationMgmt' } }));
      window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { origin: 'OrganizationMgmt', entity: 'job_titles' } }));
      if (successMsg) showToast(successMsg, 'success');
    }
    return ok;
  };

  const persistIncidentTypes = (nextTypes: HseIncidentCategoryItem[]) => {
    setIncidentTypes(nextTypes);
    saveIncidentTypesToDb(nextTypes);
    window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { origin: 'OrganizationMgmt', entity: 'incident_types' } }));
  };

  const [incTypeFilter, setIncTypeFilter] = useState<'all' | 'high_severity' | 'recordable' | 'proactive'>('all');
  const [incTypeSearch, setIncTypeSearch] = useState('');
  const [editingIncTypeId, setEditingIncTypeId] = useState<string | null>(null);

  const [incForm, setIncForm] = useState<{
    group: 'high_severity' | 'recordable' | 'proactive';
    titleFa: string;
    titleEn: string;
    code: string;
    descriptionFa: string;
  }>({
    group: 'high_severity',
    titleFa: '',
    titleEn: '',
    code: '',
    descriptionFa: ''
  });

  const savePpeItems = (items: PpeItem[]) => {
    setPpeItems(items);
    savePpeItemsToDb(items);
    window.dispatchEvent(new Event('app_data_mutated'));
  };

  const [ppeSearch, setPpeSearch] = useState('');
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipmentItem, setEditingEquipmentItem] = useState<PpeItem | null>(null);

  const [equipmentForm, setEquipmentForm] = useState({
    code: '',
    nameFa: '',
    nameEn: '',
    category: 'Head Protection (OSHA 1910.135)' as OshaPpeCategory,
    oshaStandard: '',
    totalStock: 50,
    reorderLevel: 10,
    unitCostToman: 0,
    lifespanMonths: 12
  });

  // --- Handlers for Units & Sub-Units & Positions ---
  const toggleUnitExpand = (unitName: string) => {
    setExpandedUnits(prev => ({ ...prev, [unitName]: !prev[unitName] }));
  };

  const toggleSubUnitExpand = (unitName: string, subName: string) => {
    const key = `${unitName}:::${subName}`;
    setExpandedSubUnits(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAllUnits = () => {
    const next: Record<string, boolean> = {};
    Object.keys(orgStructure).forEach(k => { next[k] = true; });
    setExpandedUnits(next);
  };

  const collapseAllUnits = () => {
    setExpandedUnits({});
  };

  const canManageOrg = !currentUser || isUserAdmin(currentUser) || currentUser?.role === 'Administrator' || currentUser?.role === 'admin' || hasPermission(currentUser, 'system.org_structure', 'edit');

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ثبت واحد سازمانی جدید را دارد.' : 'Only the main Administrator is authorized to add units.');
      return;
    }
    const name = newUnit.trim();
    if (!name) return;
    if (orgStructure[name]) {
      alert(isFa ? 'این واحد قبلاً در لیست ثبت شده است.' : 'Unit already exists.');
      return;
    }

    const initialSubs = newUnitSubUnitsStr
      .split(/[,،\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const subRecords: Record<string, string[]> = {};
    initialSubs.forEach(s => {
      subRecords[s] = [];
    });

    const initialDirectJobs = newUnitJobsStr
      .split(/[,،\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const nextStruct: OrgUnitsDataMap = {
      ...orgStructure,
      [name]: {
        jobs: initialDirectJobs,
        subUnits: subRecords
      }
    };

    await persistOrgStructure(nextStruct, isFa ? `واحد «${name}» با موفقیت در پایگاه داده ثبت شد.` : `Unit "${name}" registered.`);

    // Auto add jobs to global list
    if (initialDirectJobs.length > 0) {
      const nextJobs = Array.from(new Set([...jobTitles, ...initialDirectJobs]));
      await persistJobTitles(nextJobs);
    }

    // Sync sub-units to org chart nodes if present
    if (initialSubs.length > 0) {
      let currentNodes = orgNodes;
      initialSubs.forEach(sub => {
        currentNodes = syncSubUnitToOrgNodes(name, sub, currentNodes);
      });
      await saveStoredOrgNodes(currentNodes);
      setOrgNodes(currentNodes);
    }

    setExpandedUnits(prev => ({ ...prev, [name]: true }));
    setNewUnit('');
    setNewUnitSubUnitsStr('');
    setNewUnitJobsStr('');
    setShowAddUnitModal(false);
  };

  // Select Org Node from Org Chart for configuring sub-units
  const handleSelectOrgNodeForConfig = (node: OrgNode) => {
    setSelectedOrgNodeForConfig(node);
    const children = getOrgNodeChildren(node.id, orgNodes);
    const initialChecked: Record<string, boolean> = {};
    children.forEach(c => {
      initialChecked[c.name.trim()] = true;
    });
    setSelectedChildNodesToImport(initialChecked);
    setPickerCustomSubUnits('');
    setPickerCustomJobs(node.manager ? `مدیر/مسئول: ${node.manager}` : '');
  };

  // Confirm import and configuration of unit and sub-units from Org Chart
  const handleConfirmOrgNodeImport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOrgNodeForConfig) return;

    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ثبت یا ویرایش واحد سازمانی را دارد.' : 'Only Administrator is authorized.');
      return;
    }

    const unitName = selectedOrgNodeForConfig.name.trim();
    if (!unitName) return;

    // Collect child nodes that were checked
    const children = getOrgNodeChildren(selectedOrgNodeForConfig.id, orgNodes);
    const chosenChildNames = children
      .filter(c => selectedChildNodesToImport[c.name.trim()] || selectedChildNodesToImport[c.name])
      .map(c => c.name.trim());

    // Additional custom sub-units
    const additionalSubs = pickerCustomSubUnits
      .split(/[,،\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const allSubs = Array.from(new Set([...chosenChildNames, ...additionalSubs]));

    // Direct jobs
    const directJobs = pickerCustomJobs
      .split(/[,،\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const existing = orgStructure[unitName] || { jobs: [], subUnits: {} };
    const mergedSubs = { ...(existing.subUnits || {}) };
    allSubs.forEach(sub => {
      if (!mergedSubs[sub]) {
        mergedSubs[sub] = [];
      }
    });
    const mergedJobs = Array.from(new Set([...(existing.jobs || []), ...directJobs]));

    const nextStruct: OrgUnitsDataMap = {
      ...orgStructure,
      [unitName]: {
        jobs: mergedJobs,
        subUnits: mergedSubs
      }
    };

    const nextJobs = directJobs.length > 0 ? Array.from(new Set([...jobTitles, ...directJobs])) : jobTitles;

    const ok = await persistOrgStructure(nextStruct);
    if (directJobs.length > 0) {
      await persistJobTitles(nextJobs);
    }

    // Sync additional custom sub-units into orgNodes in central database
    if (additionalSubs.length > 0) {
      let currentNodes = orgNodes;
      additionalSubs.forEach(sub => {
        currentNodes = syncSubUnitToOrgNodes(unitName, sub, currentNodes);
      });
      await saveStoredOrgNodes(currentNodes);
      setOrgNodes(currentNodes);
    }

    setExpandedUnits(prev => ({ ...prev, [unitName]: true }));
    setShowOrgChartPickerModal(false);
    setSelectedOrgNodeForConfig(null);
    showToast(
      isFa 
        ? `واحد «${unitName}» همراه با ${allSubs.length} زیرمجموعه از چارت سازمانی با موفقیت در دیتابیس ثبت و ذخیره شد.` 
        : `Unit "${unitName}" configured with ${allSubs.length} sub-units and saved.`,
      'success'
    );

    // Scroll to the unit card
    setTimeout(() => {
      const elem = document.getElementById(`unit-card-${unitName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '-')}`);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // Delete Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const handleDeleteUnit = (unitName: string) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const subCount = Object.keys(orgStructure[unitName]?.subUnits || {}).length;
    const directJobCount = (orgStructure[unitName]?.jobs || []).length;
    const totalJobsCount = directJobCount + Number(Object.values(orgStructure[unitName]?.subUnits || {}).reduce((acc: number, j: any) => acc + Number(Array.isArray(j) ? j.length : 0), 0));

    setDeleteConfirm({
      title: isFa ? `آیا از حذف واحد «${unitName}» اطمینان دارید؟` : `Delete unit "${unitName}"?`,
      description: (subCount > 0 || totalJobsCount > 0)
        ? (isFa ? `توجه: این واحد شامل ${subCount} زیرمجموعه و ${totalJobsCount} سمت/شغل تعریف‌شده است که همگی حذف خواهند شد.` : `Note: This unit contains ${subCount} sub-units and ${totalJobsCount} positions which will also be deleted.`)
        : undefined,
      onConfirm: async () => {
        const next = { ...orgStructure };
        delete next[unitName];

        // Also remove or deactivate matching OrgNode in orgNodes so it never reappears
        const matchingNode = findOrgNodeByName(unitName, orgNodes);
        if (matchingNode) {
          const children = getOrgNodeChildren(matchingNode.id, orgNodes);
          const idsToRemove = [matchingNode.id, ...children.map(c => c.id)];
          const updatedNodes = orgNodes.filter(n => !idsToRemove.includes(n.id));
          await saveStoredOrgNodes(updatedNodes);
          setOrgNodes(updatedNodes);
        }

        await persistOrgStructure(next, isFa ? `واحد «${unitName}» با موفقیت حذف گردید.` : `Unit "${unitName}" deleted.`);
        setDeleteConfirm(null);
      }
    });
  };

  const handleSaveUnitRename = async (oldName: string) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const newName = editUnitVal.trim();
    if (!newName || newName === oldName) {
      setEditingUnitName(null);
      setEditUnitVal('');
      return;
    }
    if (orgStructure[newName]) {
      alert(isFa ? 'واحدی با این نام از قبل وجود دارد.' : 'A unit with this name already exists.');
      return;
    }

    const next: OrgUnitsDataMap = {};
    Object.keys(orgStructure).forEach(key => {
      if (key === oldName) {
        next[newName] = orgStructure[oldName] || { jobs: [], subUnits: {} };
      } else {
        next[key] = orgStructure[key];
      }
    });

    await persistOrgStructure(next, isFa ? `نام واحد به «${newName}» تغییر یافت.` : `Renamed to "${newName}".`);

    setExpandedUnits(prev => {
      const nextExp = { ...prev };
      if (nextExp[oldName]) {
        delete nextExp[oldName];
        nextExp[newName] = true;
      }
      return nextExp;
    });

    setEditingUnitName(null);
    setEditUnitVal('');
  };

  // --- Sub-Units Handlers ---
  const handleAddSubUnit = async (unitName: string, subUnitNamesOverride?: string[]) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی تعریف زیرمجموعه را دارد.' : 'Only the main Administrator is authorized to add sub-units.');
      return;
    }
    const inputVal = subUnitNamesOverride ? subUnitNamesOverride.join('،') : (newSubUnitInputs[unitName] || '').trim();
    if (!inputVal) return;

    const itemsToAdd = inputVal.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
    if (itemsToAdd.length === 0) return;

    const currentUnit = orgStructure[unitName] || { jobs: [], subUnits: {} };
    const currentSubs = { ...(currentUnit.subUnits || {}) };
    itemsToAdd.forEach(item => {
      if (!currentSubs[item]) {
        currentSubs[item] = [];
      }
    });

    const nextStruct: OrgUnitsDataMap = {
      ...orgStructure,
      [unitName]: {
        ...currentUnit,
        subUnits: currentSubs
      }
    };

    await persistOrgStructure(nextStruct, isFa ? `زیرمجموعه(ها) با موفقیت به واحد «${unitName}» افزوده شدند.` : `Sub-units added to "${unitName}".`);

    // Check if user requested syncing to Org Chart
    const shouldSyncToOrgChart = syncSubUnitToOrgChart[unitName] ?? true;
    if (shouldSyncToOrgChart) {
      let currentNodes = orgNodes;
      itemsToAdd.forEach(item => {
        currentNodes = syncSubUnitToOrgNodes(unitName, item, currentNodes);
      });
      await saveStoredOrgNodes(currentNodes);
      setOrgNodes(currentNodes);
    }

    if (!subUnitNamesOverride) {
      setNewSubUnitInputs(prev => ({ ...prev, [unitName]: '' }));
    }
    setExpandedUnits(prev => ({ ...prev, [unitName]: true }));
  };

  const handleAddAllOrgChildrenAsSubUnits = (unitName: string, childNodes: OrgNode[]) => {
    if (childNodes.length === 0) return;
    const names = childNodes.map(c => c.name.trim());
    handleAddSubUnit(unitName, names);
  };

  const handleAddSingleSubUnit = (unitName: string, subName: string) => {
    handleAddSubUnit(unitName, [subName]);
  };

  const handleDeleteSubUnit = (unitName: string, subName: string) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const jobCount = (orgStructure[unitName]?.subUnits?.[subName] || []).length;
    setDeleteConfirm({
      title: isFa ? `حذف زیرمجموعه «${subName}» از واحد «${unitName}»؟` : `Remove sub-unit "${subName}" from "${unitName}"?`,
      description: jobCount > 0 ? (isFa ? `این زیرمجموعه دارای ${jobCount} شغل/سمت تعریف‌شده است که همراه آن حذف خواهند شد.` : `This sub-unit has ${jobCount} positions that will also be removed.`) : undefined,
      onConfirm: async () => {
        const currentUnit = orgStructure[unitName];
        if (!currentUnit) return;
        const updatedSubs = { ...(currentUnit.subUnits || {}) };
        delete updatedSubs[subName];
        const next = {
          ...orgStructure,
          [unitName]: {
            ...currentUnit,
            subUnits: updatedSubs
          }
        };

        // Also clean corresponding child section in orgNodes if present
        const parentNode = findOrgNodeByName(unitName, orgNodes);
        if (parentNode) {
          const matchingChild = orgNodes.find(
            n => n.parentId === parentNode.id && n.name.trim().toLowerCase() === subName.trim().toLowerCase()
          );
          if (matchingChild) {
            const updatedNodes = orgNodes.filter(n => n.id !== matchingChild.id);
            await saveStoredOrgNodes(updatedNodes);
            setOrgNodes(updatedNodes);
          }
        }

        await persistOrgStructure(next, isFa ? `زیرمجموعه «${subName}» با موفقیت حذف گردید.` : `Sub-unit "${subName}" deleted.`);
        setDeleteConfirm(null);
      }
    });
  };

  const handleSaveSubUnitRename = async () => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ویرایش زیرمجموعه‌ها را دارد.' : 'Only the main Administrator is authorized to edit sub-units.');
      return;
    }
    if (!editingSubUnit) return;
    const { unitName, oldSubName, val } = editingSubUnit;
    const newName = val.trim();
    if (!newName || newName === oldSubName) {
      setEditingSubUnit(null);
      return;
    }

    const currentUnit = orgStructure[unitName];
    if (!currentUnit) return;
    const subs = currentUnit.subUnits || {};
    const newSubs: Record<string, string[]> = {};
    Object.keys(subs).forEach(k => {
      if (k === oldSubName) {
        newSubs[newName] = subs[oldSubName] || [];
      } else {
        newSubs[k] = subs[k];
      }
    });

    const next: OrgUnitsDataMap = {
      ...orgStructure,
      [unitName]: {
        ...currentUnit,
        subUnits: newSubs
      }
    };

    await persistOrgStructure(next, isFa ? `زیرمجموعه به «${newName}» تغییر یافت.` : `Renamed to "${newName}".`);
    setEditingSubUnit(null);
  };

  // --- Direct Unit Jobs Handlers ---
  const handleAddUnitDirectJob = async (unitName: string) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ثبت شغل و سمت شغلی را دارد.' : 'Only the main Administrator is authorized to add jobs/positions.');
      return;
    }
    const inputVal = (newUnitDirectJobInputs[unitName] || '').trim();
    if (!inputVal) return;

    const itemsToAdd = inputVal.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
    if (itemsToAdd.length === 0) return;

    const currentUnit = orgStructure[unitName] || { jobs: [], subUnits: {} };
    const currentJobs = [...(currentUnit.jobs || [])];
    itemsToAdd.forEach(item => {
      if (!currentJobs.includes(item)) {
        currentJobs.push(item);
      }
    });

    const nextStruct: OrgUnitsDataMap = {
      ...orgStructure,
      [unitName]: {
        ...currentUnit,
        jobs: currentJobs
      }
    };

    await persistOrgStructure(nextStruct, isFa ? `سمت‌های شغلی با موفقیت ثبت شدند.` : `Positions saved.`);

    const nextJobs = [...jobTitles];
    itemsToAdd.forEach(item => {
      if (!nextJobs.includes(item)) {
        nextJobs.push(item);
      }
    });
    await persistJobTitles(nextJobs);

    setNewUnitDirectJobInputs(prev => ({ ...prev, [unitName]: '' }));
  };

  const handleDeleteUnitDirectJob = (unitName: string, jobIdx: number) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const jobName = orgStructure[unitName]?.jobs?.[jobIdx];
    setDeleteConfirm({
      title: isFa ? `حذف سمت شغلی «${jobName}» از واحد «${unitName}»؟` : `Remove position "${jobName}" from "${unitName}"?`,
      onConfirm: async () => {
        const currentUnit = orgStructure[unitName];
        if (!currentUnit) return;
        const currentJobs = (currentUnit.jobs || []).filter((_, idx) => idx !== jobIdx);
        const next = {
          ...orgStructure,
          [unitName]: {
            ...currentUnit,
            jobs: currentJobs
          }
        };
        await persistOrgStructure(next, isFa ? `سمت شغلی «${jobName}» حذف شد.` : `Position "${jobName}" deleted.`);
        setDeleteConfirm(null);
      }
    });
  };

  // --- Sub-Unit Specific Jobs Handlers ---
  const handleAddSubUnitJob = async (unitName: string, subName: string) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ثبت شغل و سمت شغلی را دارد.' : 'Only the main Administrator is authorized to add jobs/positions.');
      return;
    }
    const key = `${unitName}:::${subName}`;
    const inputVal = (newSubUnitJobInputs[key] || '').trim();
    if (!inputVal) return;

    const itemsToAdd = inputVal.split(/[,،\n]+/).map(s => s.trim()).filter(Boolean);
    if (itemsToAdd.length === 0) return;

    const currentUnit = orgStructure[unitName] || { jobs: [], subUnits: {} };
    const currentSubs = { ...(currentUnit.subUnits || {}) };
    const currentJobs = [...(currentSubs[subName] || [])];
    itemsToAdd.forEach(item => {
      if (!currentJobs.includes(item)) {
        currentJobs.push(item);
      }
    });
    currentSubs[subName] = currentJobs;

    const nextStruct: OrgUnitsDataMap = {
      ...orgStructure,
      [unitName]: {
        ...currentUnit,
        subUnits: currentSubs
      }
    };

    await persistOrgStructure(nextStruct, isFa ? `شغل‌های انتسابی با موفقیت ثبت شدند.` : `Positions saved.`);

    const nextJobs = [...jobTitles];
    itemsToAdd.forEach(item => {
      if (!nextJobs.includes(item)) {
        nextJobs.push(item);
      }
    });
    await persistJobTitles(nextJobs);

    setNewSubUnitJobInputs(prev => ({ ...prev, [key]: '' }));
  };

  const handleDeleteSubUnitJob = (unitName: string, subName: string, jobIdx: number) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const jobName = orgStructure[unitName]?.subUnits?.[subName]?.[jobIdx];
    setDeleteConfirm({
      title: isFa ? `حذف سمت شغلی «${jobName}» از زیرمجموعه «${subName}»؟` : `Remove position "${jobName}" from "${subName}"?`,
      onConfirm: async () => {
        const currentUnit = orgStructure[unitName];
        if (!currentUnit) return;
        const currentSubs = { ...(currentUnit.subUnits || {}) };
        const currentJobs = (currentSubs[subName] || []).filter((_, idx) => idx !== jobIdx);
        currentSubs[subName] = currentJobs;
        const next = {
          ...orgStructure,
          [unitName]: {
            ...currentUnit,
            subUnits: currentSubs
          }
        };
        await persistOrgStructure(next, isFa ? `سمت شغلی «${jobName}» حذف شد.` : `Position "${jobName}" deleted.`);
        setDeleteConfirm(null);
      }
    });
  };

  const handleSaveJobItemEdit = async () => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ویرایش را دارد.' : 'Only the main Administrator is authorized to edit.');
      return;
    }
    if (!editingJobItem) return;
    const { type, unitName, subUnitName, idx, val } = editingJobItem;
    const newVal = val.trim();
    if (!newVal) {
      setEditingJobItem(null);
      return;
    }

    let nextStruct = { ...orgStructure };
    if (type === 'unit_direct' && unitName) {
      const unit = nextStruct[unitName];
      if (!unit) return;
      const jobs = [...(unit.jobs || [])];
      jobs[idx] = newVal;
      nextStruct[unitName] = { ...unit, jobs };
    } else if (type === 'subunit' && unitName && subUnitName) {
      const unit = nextStruct[unitName];
      if (!unit) return;
      const subs = { ...(unit.subUnits || {}) };
      const jobs = [...(subs[subUnitName] || [])];
      jobs[idx] = newVal;
      subs[subUnitName] = jobs;
      nextStruct[unitName] = { ...unit, subUnits: subs };
    }

    await persistOrgStructure(nextStruct, isFa ? `سمت شغلی به «${newVal}» ویرایش شد.` : `Position updated to "${newVal}".`);
    setEditingJobItem(null);
  };

  const handleResetToDefaults = () => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی بازیابی پیش‌فرض را دارد.' : 'Only the main Administrator is authorized to reset defaults.');
      return;
    }
    setDeleteConfirm({
      title: isFa ? 'بازیابی پیش‌فرض‌های ساختار واحدها و سمت‌ها؟' : 'Reset Units & Positions to Defaults?',
      description: isFa 
        ? 'این عملیات تمام واحدهای استاندارد را با زیرمجموعه و سمت‌های خالی تنظیم می‌کند تا توسط مدیر سیستم به صورت سفارشی وارد شوند.' 
        : 'This will restore standard units with empty sub-units and positions, ready to be populated by the Administrator.',
      onConfirm: async () => {
        const defaultStruct: OrgUnitsDataMap = {};
        defaultUnits.forEach(u => {
          defaultStruct[u] = { jobs: [], subUnits: {} };
        });
        await persistOrgStructure(defaultStruct, isFa ? 'ساختار واحدها به حالت اولیه بازنشانی شد.' : 'Reset to defaults.');
        setDeleteConfirm(null);
      }
    });
  };

  const addJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی ثبت عنوان شغلی جدید را دارد.' : 'Only the main Administrator is authorized to add job titles.');
      return;
    }
    const clean = newJob.trim();
    if (!clean) return;
    if (jobTitles.includes(clean)) {
      alert(isFa ? 'این عنوان شغلی قبلا ثبت شده است.' : 'Job title already exists.');
      return;
    }
    const next = [...jobTitles, clean];
    await persistJobTitles(next, isFa ? `عنوان شغلی «${clean}» افزوده شد.` : `Job "${clean}" added.`);
    setNewJob('');
  };

  const deleteJob = (idx: number) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const name = jobTitles[idx];
    setDeleteConfirm({
      title: isFa ? `آیا از حذف عنوان شغلی "${name}" اطمینان دارید؟` : `Delete job title "${name}"?`,
      onConfirm: async () => {
        const newArr = [...jobTitles];
        newArr.splice(idx, 1);
        await persistJobTitles(newArr, isFa ? `عنوان شغلی "${name}" حذف شد.` : `Job "${name}" deleted.`);
        setDeleteConfirm(null);
      }
    });
  };

  const saveJobEdit = async (idx: number) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    const clean = editJobVal.trim();
    if (!clean) return;
    const newArr = [...jobTitles];
    newArr[idx] = clean;
    await persistJobTitles(newArr, isFa ? `عنوان شغلی به «${clean}» ویرایش شد.` : `Job updated to "${clean}".`);
    setEditingJobIdx(null);
  };

  // --- Handlers for Incident Category Types ---
  const handleSaveIncType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incForm.titleFa.trim()) return;

    if (editingIncTypeId) {
      const next = incidentTypes.map(item => {
        if (item.id === editingIncTypeId) {
          return {
            ...item,
            group: incForm.group,
            titleFa: incForm.titleFa.trim(),
            titleEn: incForm.titleEn.trim() || incForm.titleFa.trim(),
            code: incForm.code.trim().toUpperCase() || 'INC',
            descriptionFa: incForm.descriptionFa.trim()
          };
        }
        return item;
      });
      persistIncidentTypes(next);
      setEditingIncTypeId(null);
    } else {
      const newItem: HseIncidentCategoryItem = {
        id: `inc-type-${Date.now()}`,
        group: incForm.group,
        titleFa: incForm.titleFa.trim(),
        titleEn: incForm.titleEn.trim() || incForm.titleFa.trim(),
        code: incForm.code.trim().toUpperCase() || 'INC',
        descriptionFa: incForm.descriptionFa.trim()
      };
      persistIncidentTypes([...incidentTypes, newItem]);
    }

    setIncForm({
      group: 'high_severity',
      titleFa: '',
      titleEn: '',
      code: '',
      descriptionFa: ''
    });
  };

  const handleEditIncType = (item: HseIncidentCategoryItem) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    setEditingIncTypeId(item.id);
    setIncForm({
      group: item.group,
      titleFa: item.titleFa,
      titleEn: item.titleEn,
      code: item.code || '',
      descriptionFa: item.descriptionFa || ''
    });
  };

  const handleCancelIncEdit = () => {
    setEditingIncTypeId(null);
    setIncForm({
      group: 'high_severity',
      titleFa: '',
      titleEn: '',
      code: '',
      descriptionFa: ''
    });
  };

  const handleDeleteIncType = (id: string, name: string) => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    setDeleteConfirm({
      title: isFa ? `آیا از حذف دسته‌بندی حادثه "${name}" اطمینان دارید؟` : `Delete incident type "${name}"?`,
      description: isFa ? 'این عنوان از لیست تعاریف حوادث سازمان حذف می‌شود.' : 'This incident category definition will be deleted.',
      onConfirm: () => {
        persistIncidentTypes(incidentTypes.filter(i => i.id !== id));
        setDeleteConfirm(null);
      }
    });
  };

  const handleResetIncTypesToDefault = () => {
    if (!canManageOrg) {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    setDeleteConfirm({
      title: isFa ? 'بازنشانی دسته‌بندی‌های حوادث به استانداردهای پیش‌فرض HSE' : 'Reset incident types to defaults',
      description: isFa ? 'تمامی عناوین دسته‌بندی حوادث به ۳ سطح اصلی (شدت بالا، قابل ثبت، پیشگیرانه) بازمی‌گردند.' : 'All incident categories will be restored to default HSE severity tiers.',
      onConfirm: () => {
        persistIncidentTypes(DEFAULT_INCIDENT_TYPES);
        setDeleteConfirm(null);
      }
    });
  };

  // --- Handlers for PPE Equipment Items ---
  const handleOpenNewEquipmentModal = () => {
    setEditingEquipmentItem(null);
    const catName = ppeCategories[0]?.nameFa || 'محافظت از سر';
    setEquipmentForm({
      code: `PPE-${Date.now().toString().slice(-4)}`,
      nameFa: '',
      nameEn: '',
      category: (catName.includes('سر') ? 'Head Protection (OSHA 1910.135)' : catName) as OshaPpeCategory,
      oshaStandard: 'ANSI / ISIRI',
      totalStock: 50,
      reorderLevel: 10,
      unitCostToman: 0,
      lifespanMonths: 12
    });
    setShowEquipmentModal(true);
  };

  const handleOpenEditEquipmentModal = (item: PpeItem) => {
    if (currentUser?.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    setEditingEquipmentItem(item);
    setEquipmentForm({
      code: item.code,
      nameFa: item.nameFa,
      nameEn: item.nameEn,
      category: item.category,
      oshaStandard: item.oshaStandard,
      totalStock: item.totalStock,
      reorderLevel: item.reorderLevel,
      unitCostToman: item.unitCostToman || 0,
      lifespanMonths: item.lifespanMonths
    });
    setShowEquipmentModal(true);
  };

  const handleSaveEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentForm.nameFa.trim()) return;

    if (editingEquipmentItem) {
      const updated = ppeItems.map(i => {
        if (i.id === editingEquipmentItem.id) {
          const avail = Math.max(0, equipmentForm.totalStock - i.allocatedStock);
          return {
            ...i,
            code: equipmentForm.code,
            nameFa: equipmentForm.nameFa,
            nameEn: equipmentForm.nameEn || translatePpeNameToEn(equipmentForm.nameFa),
            category: equipmentForm.category,
            oshaStandard: equipmentForm.oshaStandard,
            totalStock: equipmentForm.totalStock,
            availableStock: avail,
            reorderLevel: equipmentForm.reorderLevel,
            unitCostToman: equipmentForm.unitCostToman,
            lifespanMonths: equipmentForm.lifespanMonths,
            status: (avail <= 0 ? 'Out of Stock' : avail <= equipmentForm.reorderLevel ? 'Low Stock' : 'In Stock') as any
          };
        }
        return i;
      });
      savePpeItems(updated);
    } else {
      const newItem: PpeItem = {
        id: `ppe-${Date.now()}`,
        code: equipmentForm.code || `PPE-${Date.now().toString().slice(-4)}`,
        nameFa: equipmentForm.nameFa,
        nameEn: equipmentForm.nameEn || translatePpeNameToEn(equipmentForm.nameFa),
        category: equipmentForm.category,
        oshaStandard: equipmentForm.oshaStandard || 'ANSI / ISIRI',
        totalStock: equipmentForm.totalStock,
        allocatedStock: 0,
        availableStock: equipmentForm.totalStock,
        reorderLevel: equipmentForm.reorderLevel,
        unitCostToman: equipmentForm.unitCostToman,
        lifespanMonths: equipmentForm.lifespanMonths,
        status: equipmentForm.totalStock > equipmentForm.reorderLevel ? 'In Stock' : 'Low Stock'
      };
      savePpeItems([...ppeItems, newItem]);
    }

    setShowEquipmentModal(false);
  };

  const handleDeleteEquipment = (id: string, name: string) => {
    if (currentUser?.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر اصلی سیستم (Administrator) دسترسی حذف یا ویرایش این اطلاعات را دارد.' : 'Only the main Administrator is authorized to delete or edit this information.');
      return;
    }
    setDeleteConfirm({
      title: isFa ? `آیا از حذف تجهیز "${name}" اطمینان دارید؟` : `Delete equipment "${name}"?`,
      description: isFa ? 'این تجهیز از فهرست نام‌های مجاز تجهیزات حفاظت فردی حذف خواهد شد.' : 'This equipment will be deleted from the PPE master list.',
      onConfirm: () => {
        const updated = ppeItems.filter(i => i.id !== id);
        savePpeItems(updated);
        setDeleteConfirm(null);
      }
    });
  };

  // Filtered PPE Items
  const filteredPpeItems = ppeItems.filter(i => 
    i.nameFa.toLowerCase().includes(ppeSearch.toLowerCase()) ||
    i.nameEn.toLowerCase().includes(ppeSearch.toLowerCase()) ||
    i.code.toLowerCase().includes(ppeSearch.toLowerCase()) ||
    i.category.toLowerCase().includes(ppeSearch.toLowerCase())
  );

  const canViewOrgStructure = isUserAdmin(currentUser) || hasPermission(currentUser, 'Org Structure', 'view');
  if (!canViewOrgStructure) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md mx-auto space-y-4">
        <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto" />
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
          {isFa ? 'عدم مجوز دسترسی به ساختار سازمانی' : 'Access Denied'}
        </h3>
        <p className="text-xs text-slate-500 font-bold leading-relaxed">
          {isFa
            ? 'دسترسی به بخش ساختار سازمانی و چارت مجتمع نیازمند مجوز مدیریتی مربوطه می‌باشد.'
            : 'You do not have permission to access the Organizational Structure module.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            <span>{isFa ? 'تعاریف و ساختار سازمانی مجتمع' : 'Organization & PPE Structure Config'}</span>
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-1">
            {isFa ? 'مدیریت متمرکز واحدها، عناوین شغلی، دسته‌بندی انواع حوادث و نام تجاری تجهیزات حفاظت فردی (PPE)' : 'Manage units, job titles, incident categories and PPE equipment names'}
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl self-start md:self-auto border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('org_hierarchy')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'org_hierarchy' ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderTree className="w-4 h-4 text-slate-950" />
            <span>{isFa ? 'ساختار و چارت سازمانی' : 'Org Hierarchy & Chart'}</span>
          </button>

          <button
            onClick={() => setActiveTab('units_jobs')}
            className={`px-3.5 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'units_jobs' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            <span>{isFa ? 'واحدها و مشاغل عملیاتی' : 'Units & Jobs'}</span>
          </button>

          <button
            onClick={() => setActiveTab('incident_types')}
            className={`px-3.5 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'incident_types' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>{isFa ? 'دسته‌بندی انواع حوادث' : 'Incident Category Types'}</span>
          </button>

          <button
            onClick={() => setActiveTab('ppe_equipment')}
            className={`px-3.5 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ppe_equipment' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isFa ? 'نام تجهیزات PPE' : 'PPE Equipment Names'}</span>
          </button>

          <button
            onClick={() => setActiveTab('backup_restore')}
            className={`px-3.5 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'backup_restore' ? 'bg-indigo-600 text-white shadow-md scale-[1.02]' : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isFa ? 'پشتیبان‌گیری و بازیابی یکپارچه' : 'Backup & Restore'}</span>
          </button>
        </div>
      </div>

      {/* --- TAB 4: INTEGRATED ORG BACKUP & RESTORE --- */}
      {activeTab === 'backup_restore' && (
        <OrgBackupRestorePanel
          isFa={isFa}
          canManageOrg={canManageOrg}
          onDataRestored={async () => {
            await refreshAllOrgSettings(true);
            window.dispatchEvent(new Event('hse_org_nodes_updated'));
            window.dispatchEvent(new Event('hse_unit_structure_updated'));
            window.dispatchEvent(new Event('hse_org_jobs_updated'));
          }}
        />
      )}

      {/* --- TAB 0: HIERARCHICAL ORG STRUCTURE & CHART --- */}
      {activeTab === 'org_hierarchy' && (
        <OrgStructureManager 
          isFa={isFa} 
          currentUser={currentUser} 
          onUpdate={() => {
            refreshAllOrgSettings(true);
          }}
          onOpenBackupRestore={() => setActiveTab('backup_restore')}
        />
      )}

      {/* --- TAB 1: UNITS & SUB-UNITS & JOB TITLES --- */}
      {activeTab === 'units_jobs' && (
        <div className="space-y-4">
            {/* Header & Controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <span>{isFa ? 'واحدها، زیرمجموعه‌ها و سمت‌های شغلی' : 'Units, Sub-Units & Job Positions'}</span>
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-bold">
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                        {Object.keys(orgStructure).length} {isFa ? 'واحد اصلی' : 'Units'}
                      </span>
                      <span>•</span>
                      <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <GitFork className="w-3 h-3" />
                        {Object.values(orgStructure).reduce((acc: number, u: any) => acc + Object.keys(u?.subUnits || {}).length, 0)} {isFa ? 'زیرمجموعه' : 'Sub-units'}
                      </span>
                      <span>•</span>
                      <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {Object.values(orgStructure).reduce((acc: number, u: any) => {
                          const direct = (u?.jobs || []).length;
                          const subJobs = Object.values(u?.subUnits || {}).reduce((sacc: number, sj: any) => sacc + (Array.isArray(sj) ? sj.length : 0), 0);
                          return acc + direct + subJobs;
                        }, 0)} {isFa ? 'سمت اختصاص‌یافته' : 'Positions'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrgNodeForConfig(null);
                      setShowOrgChartPickerModal(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                    title={isFa ? 'انتخاب واحد از ساختار و چارت سازمانی و تعریف زیرمجموعه' : 'Select unit from Org Chart'}
                  >
                    <FolderTree className="w-4 h-4 text-amber-300" />
                    <span>{isFa ? 'انتخاب واحد از چارت سازمانی' : 'From Org Chart'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={expandAllUnits}
                    title={isFa ? 'باز کردن همه واحدها' : 'Expand all'}
                    className="p-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isFa ? 'باز کردن همه' : 'Expand'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={collapseAllUnits}
                    title={isFa ? 'بستن همه واحدها' : 'Collapse all'}
                    className="p-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isFa ? 'بستن همه' : 'Collapse'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setAddUnitSource('from_org_chart');
                      setShowAddUnitModal(true);
                    }}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isFa ? 'افزودن واحد جدید' : 'Add Unit'}</span>
                  </button>
                </div>
              </div>

              {/* Org Chart Quick Connection Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-indigo-50/90 via-blue-50/50 to-amber-50/60 dark:from-indigo-950/40 dark:via-slate-900/50 dark:to-amber-950/30 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <FolderTree className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      {isFa ? 'اتصال مستقیم به ساختار و چارت سازمانی' : 'Direct Org Chart Connection'}
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                        {orgNodes.length} {isFa ? 'واحد/گره در چارت' : 'Chart Nodes'}
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {isFa ? 'واحدهای واردشده در تب «ساختار و چارت سازمانی» را انتخاب کرده و برای آن زیرمجموعه و مشاغل عملیاتی تعیین کنید.' : 'Select units from the Org Chart tab and configure their sub-units and job positions.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrgNodeForConfig(null);
                    setShowOrgChartPickerModal(true);
                  }}
                  className="px-3.5 py-2 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{isFa ? 'مرور و انتخاب از چارت سازمانی' : 'Browse Org Chart'}</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={unitSearch}
                  onChange={e => setUnitSearch(e.target.value)}
                  placeholder={isFa ? 'جستجو در نام واحدها، زیرمجموعه‌ها یا سمت‌های شغلی...' : 'Search units, sub-units or positions...'}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs font-bold focus:border-blue-500 outline-none transition"
                />
                {unitSearch && (
                  <button
                    onClick={() => setUnitSearch('')}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add Unit Inline Bar with Org Chart Select Dropdown */}
            <form onSubmit={handleAddUnit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={newUnit} 
                  onChange={e => setNewUnit(e.target.value)} 
                  placeholder={isFa ? 'نام واحد (یا از لیست چارت سازمانی روبه‌رو انتخاب کنید)...' : 'New unit name or select from chart...'} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-bold focus:border-blue-500 outline-none transition-colors shadow-xs"
                />
              </div>

              {/* Quick Select from Org Nodes */}
              <div className="relative sm:w-72">
                <select
                  value=""
                  onChange={e => {
                    const pickedId = e.target.value;
                    if (!pickedId) return;
                    const node = orgNodes.find(n => n.id === pickedId);
                    if (node) {
                      handleSelectOrgNodeForConfig(node);
                      setShowOrgChartPickerModal(true);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">{isFa ? '⚡ انتخاب سریع واحد از چارت سازمانی...' : '⚡ Quick pick from Org Chart...'}</option>
                  {orgNodes.map(n => {
                    const isAlreadyAdded = !!orgStructure[n.name];
                    return (
                      <option key={n.id} value={n.id}>
                        {isAlreadyAdded ? '✓ ' : '+ '}
                        {n.name} ({ORG_TYPE_LABELS[n.type]?.fa || n.type})
                      </option>
                    );
                  })}
                </select>
              </div>

              <button 
                type="submit" 
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{isFa ? 'ثبت دستی واحد' : 'Add Unit'}</span>
              </button>
            </form>

            {/* Units & Sub-Units List */}
            <div className="space-y-3.5">
              {Object.keys(orgStructure)
                .filter(uName => {
                  if (!unitSearch.trim()) return true;
                  const query = unitSearch.trim().toLowerCase();
                  if (uName.toLowerCase().includes(query)) return true;
                  const unitData = orgStructure[uName];
                  if (!unitData) return false;
                  // Search direct jobs
                  if ((unitData.jobs || []).some(j => j.toLowerCase().includes(query))) return true;
                  // Search sub-units and their jobs
                  const subs = (unitData.subUnits || {}) as Record<string, any>;
                  for (const [sName, sJobs] of Object.entries(subs)) {
                    if (sName.toLowerCase().includes(query)) return true;
                    const sJobsList = Array.isArray(sJobs) ? sJobs : [];
                    if (sJobsList.some((sj: string) => typeof sj === 'string' && sj.toLowerCase().includes(query))) return true;
                  }
                  return false;
                })
                .map(unitName => {
                  const unitData = orgStructure[unitName] || { jobs: [], subUnits: {} };
                  const subUnitsObj = (unitData.subUnits || {}) as Record<string, any>;
                  const subUnitNames = Object.keys(subUnitsObj);
                  const directJobs = unitData.jobs || [];
                  const totalSubJobsCount = Object.values(subUnitsObj).reduce((acc: number, j: any) => acc + (Array.isArray(j) ? j.length : 0), 0);
                  const isExpanded = expandedUnits[unitName] ?? false;
                  const isEditingThisUnit = editingUnitName === unitName;
                  const matchingOrgNode = findOrgNodeByName(unitName, orgNodes);

                  return (
                    <div 
                      key={unitName}
                      id={`unit-card-${unitName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '-')}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs hover:border-blue-300 dark:hover:border-blue-800/60 transition"
                    >
                      {/* Unit Header Row */}
                      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                        {isEditingThisUnit ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={editUnitVal}
                              onChange={e => setEditUnitVal(e.target.value)}
                              className="flex-1 border border-blue-400 bg-white dark:bg-slate-900 rounded-lg px-2.5 py-1 text-xs font-bold outline-none"
                              onKeyDown={e => e.key === 'Enter' && handleSaveUnitRename(unitName)}
                            />
                            <button
                              onClick={() => handleSaveUnitRename(unitName)}
                              className="text-emerald-600 font-bold text-xs px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg hover:bg-emerald-100 cursor-pointer"
                            >
                              {isFa ? 'ذخیره' : 'Save'}
                            </button>
                            <button
                              onClick={() => setEditingUnitName(null)}
                              className="text-slate-500 font-bold text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 cursor-pointer"
                            >
                              {isFa ? 'انصراف' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="flex-1 flex flex-wrap items-center gap-2.5 cursor-pointer select-none"
                            onClick={() => toggleUnitExpand(unitName)}
                          >
                            <button 
                              type="button"
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-amber-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 rtl:rotate-180 text-slate-400" />
                              )}
                            </button>

                            <span className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                              {unitName}
                            </span>

                            {/* Org Chart Link Badge */}
                            {matchingOrgNode && (
                              <span 
                                title={isFa ? `متصل به چارت سازمانی: ${getOrgNodeFullPath(matchingOrgNode.id, orgNodes)}` : `Linked to Org Chart: ${getOrgNodeFullPath(matchingOrgNode.id, orgNodes)}`}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs"
                              >
                                <FolderTree className="w-2.5 h-2.5 text-amber-500" />
                                <span>{ORG_TYPE_LABELS[matchingOrgNode.type]?.fa || matchingOrgNode.type}</span>
                              </span>
                            )}

                            {/* Sub-Units Count Badge */}
                            <span 
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                subUnitNames.length > 0
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-blue-200 dark:border-blue-800/50'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <GitFork className="w-2.5 h-2.5" />
                              {subUnitNames.length > 0 
                                ? (isFa ? `${subUnitNames.length} زیرمجموعه` : `${subUnitNames.length} sub-units`)
                                : (isFa ? 'بدون زیرمجموعه' : 'No sub-units')}
                            </span>

                            {/* Direct Unit Jobs Badge */}
                            {directJobs.length > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                                <Briefcase className="w-2.5 h-2.5" />
                                {directJobs.length} {isFa ? 'سمت مستقیم واحد' : 'Unit positions'}
                              </span>
                            )}

                            {/* Sub-unit Jobs Badge */}
                            {totalSubJobsCount > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                                <Users className="w-2.5 h-2.5" />
                                {totalSubJobsCount} {isFa ? 'سمت در زیرمجموعه‌ها' : 'Sub-unit positions'}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleUnitExpand(unitName)}
                            title={isFa ? 'مشاهده و مدیریت زیرمجموعه‌ها و سمت‌ها' : 'Manage sub-units & positions'}
                            className="p-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer flex items-center gap-1 font-bold"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden md:inline text-[11px]">{isFa ? 'افزودن سمت/زیرمجموعه' : 'Add'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUnitName(unitName);
                              setEditUnitVal(unitName);
                            }}
                            title={isFa ? 'ویرایش نام واحد' : 'Rename Unit'}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUnit(unitName)}
                            title={isFa ? 'حذف واحد' : 'Delete Unit'}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Container */}
                      {isExpanded && (
                        <div className="p-4 bg-slate-50/40 dark:bg-slate-900/40 space-y-5">
                          
                          {/* SECTION 1: DIRECT UNIT JOBS & POSITIONS */}
                          <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-950/60 rounded-2xl p-3.5 space-y-3 shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                  <Briefcase className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">
                                    {isFa ? `مشاغل و سمت‌های مستقیم واحد سازمانی «${unitName}»` : `Direct Unit Positions for "${unitName}"`}
                                  </h5>
                                  <p className="text-[10px] text-slate-500 font-medium">
                                    {isFa ? 'سمت‌های سطح مدیریتی و سازمانی اصلی این واحد (مانند: مدیر، رئیس، سرپرست ارشد، کارشناس مسئول، منشی)' : 'Direct unit positions (e.g. Unit Manager, Supervisor, Lead Specialist, Secretary)'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                                {directJobs.length} {isFa ? 'سمت مستقیم' : 'Positions'}
                              </span>
                            </div>

                            {/* Quick Add Direct Job Input */}
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <Briefcase className="w-3.5 h-3.5 text-indigo-500 absolute right-3 top-2.5" />
                                <input
                                  type="text"
                                  value={newUnitDirectJobInputs[unitName] || ''}
                                  onChange={e => setNewUnitDirectJobInputs({ ...newUnitDirectJobInputs, [unitName]: e.target.value })}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddUnitDirectJob(unitName);
                                    }
                                  }}
                                  placeholder={isFa ? `افزودن سمت/شغل مستقیم به واحد «${unitName}» (چند عنوان را با ویرگول جدا کنید)...` : `Add direct job title to "${unitName}"...`}
                                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold focus:border-indigo-500 outline-none transition shadow-xs"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddUnitDirectJob(unitName)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>{isFa ? 'ثبت سمت' : 'Add Position'}</span>
                              </button>
                            </div>

                            {/* Direct Jobs Badges */}
                            {directJobs.length === 0 ? (
                              <div className="text-center py-2.5 px-3 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <p className="text-[11px] text-slate-400 font-bold">
                                  {isFa 
                                    ? 'هنوز سمتی در سطح مستقیم این واحد ثبت نشده است. از کادر بالا برای ثبت سمت‌های مستقیم استفاده کنید.' 
                                    : 'No direct positions registered for this unit yet.'}
                                </p>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {directJobs.map((job, jobIdx) => {
                                  const isEditing = editingJobItem?.type === 'unit_direct' && editingJobItem?.unitName === unitName && editingJobItem?.idx === jobIdx;

                                  if (isEditing) {
                                    return (
                                      <div 
                                        key={jobIdx} 
                                        className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-indigo-400 rounded-xl px-2 py-1 shadow-xs"
                                      >
                                        <input
                                          autoFocus
                                          type="text"
                                          value={editingJobItem.val}
                                          onChange={e => setEditingJobItem({ ...editingJobItem, val: e.target.value })}
                                          onKeyDown={e => e.key === 'Enter' && handleSaveJobItemEdit()}
                                          className="text-xs font-bold bg-transparent outline-none w-36"
                                        />
                                        <button
                                          onClick={handleSaveJobItemEdit}
                                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                        >
                                          <Check className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setEditingJobItem(null)}
                                          className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={jobIdx}
                                      className="group flex items-center gap-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:border-indigo-400 rounded-xl px-2.5 py-1 text-xs font-bold text-indigo-900 dark:text-indigo-200 shadow-xs transition"
                                    >
                                      <Briefcase className="w-3 h-3 text-indigo-500" />
                                      <span>{job}</span>

                                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition mr-1">
                                        <button
                                          type="button"
                                          onClick={() => setEditingJobItem({ type: 'unit_direct', unitName, idx: jobIdx, val: job })}
                                          title={isFa ? 'ویرایش سمت' : 'Edit position'}
                                          className="p-0.5 text-blue-500 hover:text-blue-700 rounded cursor-pointer"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteUnitDirectJob(unitName, jobIdx)}
                                          title={isFa ? 'حذف سمت' : 'Delete position'}
                                          className="p-0.5 text-red-500 hover:text-red-700 rounded cursor-pointer"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* SECTION 2: SUB-UNITS & THEIR JOBS */}
                          <div className="bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-950/60 rounded-2xl p-3.5 space-y-3 shadow-xs">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg">
                                  <GitFork className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">
                                    {isFa ? `زیرمجموعه‌های واحد «${unitName}» و سمت‌های شغلی هر بخش` : `Sub-Units & Specific Job Titles for "${unitName}"`}
                                  </h5>
                                  <p className="text-[10px] text-slate-500 font-medium">
                                    {isFa ? 'ثبت بخش‌های زیرمجموعه و تعریف اختصاصی سمت‌های شغلی فعال در هر زیرمجموعه' : 'Sub-units with their dedicated job positions'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                                {subUnitNames.length} {isFa ? 'زیرمجموعه' : 'Sub-units'}
                              </span>
                            </div>

                            {/* Smart Org Chart Child Nodes Recommendation Banner */}
                            {(() => {
                              const orgChildNodes = matchingOrgNode ? getOrgNodeChildren(matchingOrgNode.id, orgNodes) : [];
                              const unaddedOrgChildren = orgChildNodes.filter(c => !subUnitsObj[c.name.trim()]);
                              if (unaddedOrgChildren.length === 0) return null;

                              return (
                                <div className="bg-gradient-to-r from-amber-50/90 via-indigo-50/60 to-blue-50/50 dark:from-amber-950/30 dark:via-indigo-950/30 dark:to-slate-900 border border-amber-200/90 dark:border-amber-800/60 rounded-xl p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-2xs">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="p-1 bg-amber-500 text-slate-950 rounded-lg shrink-0">
                                      <Sparkles className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[11px] font-bold text-amber-950 dark:text-amber-200">
                                      {isFa 
                                        ? `${unaddedOrgChildren.length} زیرگره در چارت سازمانی برای این واحد شناسایی شد:` 
                                        : `${unaddedOrgChildren.length} child nodes found in Org Chart:`}
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {unaddedOrgChildren.map(c => (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => handleAddSingleSubUnit(unitName, c.name)}
                                          className="text-[10px] font-bold px-2 py-0.5 bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/50 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                          title={isFa ? `افزودن «${c.name}» به زیرمجموعه‌های این واحد` : `Add "${c.name}" as sub-unit`}
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                          <span>{c.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddAllOrgChildrenAsSubUnits(unitName, unaddedOrgChildren)}
                                    className="text-[10px] font-black px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition shadow-xs cursor-pointer flex items-center justify-center gap-1 shrink-0"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{isFa ? 'افزودن همه به عنوان زیرمجموعه' : 'Add all as sub-units'}</span>
                                  </button>
                                </div>
                              );
                            })()}

                            {/* Quick Add Sub-Unit Input */}
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <GitFork className="w-3.5 h-3.5 text-amber-500 absolute right-3 top-2.5" />
                                  <input
                                    type="text"
                                    value={newSubUnitInputs[unitName] || ''}
                                    onChange={e => setNewSubUnitInputs({ ...newSubUnitInputs, [unitName]: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddSubUnit(unitName);
                                      }
                                    }}
                                    placeholder={isFa ? `افزودن زیرمجموعه جدید به واحد «${unitName}» (چند مورد را با ویرگول جدا کنید)...` : `Add sub-unit to ${unitName}...`}
                                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold focus:border-blue-500 outline-none transition shadow-xs"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddSubUnit(unitName)}
                                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isFa ? 'افزودن زیرمجموعه' : 'Add Sub-Unit'}</span>
                                </button>
                              </div>

                              {/* Sync Sub-Unit to Org Chart toggle */}
                              <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500 dark:text-slate-400">
                                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={syncSubUnitToOrgChart[unitName] ?? true}
                                    onChange={e => setSyncSubUnitToOrgChart({ ...syncSubUnitToOrgChart, [unitName]: e.target.checked })}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="font-bold text-slate-600 dark:text-slate-300">
                                    {isFa ? 'ثبت همزمان زیرمجموعه جدید در ساختار و چارت سازمانی به عنوان زیرگره تابعه' : 'Also register new sub-unit in Org Chart as child node'}
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Sub-Units Cards List */}
                            {subUnitNames.length === 0 ? (
                              <div className="text-center py-3 px-4 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                <p className="text-[11px] text-slate-400 font-bold">
                                  {isFa 
                                    ? 'هنوز زیرمجموعه‌ای برای این واحد ثبت نشده است. از کادر بالا برای اضافه کردن زیرمجموعه استفاده کنید.' 
                                    : 'No sub-units registered for this unit yet.'}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2.5 pt-1">
                                {subUnitNames.map((subName, sIdx) => {
                                  const subJobs = subUnitsObj[subName] || [];
                                  const subKey = `${unitName}:::${subName}`;
                                  const isEditingSub = editingSubUnit?.unitName === unitName && editingSubUnit?.oldSubName === subName;
                                  const isSubExpanded = expandedSubUnits[subKey] ?? true;

                                  return (
                                    <div 
                                      key={sIdx}
                                      className="border border-slate-200 dark:border-slate-700/80 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 overflow-hidden"
                                    >
                                      {/* Sub-Unit Card Header */}
                                      <div className="p-2.5 flex items-center justify-between gap-2 bg-slate-100/60 dark:bg-slate-800/70 border-b border-slate-200/70 dark:border-slate-700/70">
                                        {isEditingSub ? (
                                          <div className="flex-1 flex items-center gap-2">
                                            <input
                                              autoFocus
                                              type="text"
                                              value={editingSubUnit.val}
                                              onChange={e => setEditingSubUnit({ ...editingSubUnit, val: e.target.value })}
                                              onKeyDown={e => e.key === 'Enter' && handleSaveSubUnitRename()}
                                              className="flex-1 text-xs font-bold bg-white dark:bg-slate-900 border border-blue-400 rounded-lg px-2 py-1 outline-none"
                                            />
                                            <button
                                              onClick={handleSaveSubUnitRename}
                                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              onClick={() => setEditingSubUnit(null)}
                                              className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div 
                                            className="flex-1 flex items-center gap-2 cursor-pointer select-none"
                                            onClick={() => toggleSubUnitExpand(unitName, subName)}
                                          >
                                            <button 
                                              type="button"
                                              className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                                            >
                                              {isSubExpanded ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-amber-600" />
                                              ) : (
                                                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180 text-slate-400" />
                                              )}
                                            </button>
                                            <Tag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                                              {subName}
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                              {subJobs.length} {isFa ? 'سمت شغلی' : 'jobs'}
                                            </span>
                                          </div>
                                        )}

                                        {/* Actions for Sub-Unit */}
                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => setEditingSubUnit({ unitName, oldSubName: subName, val: subName })}
                                            title={isFa ? 'ویرایش نام زیرمجموعه' : 'Edit sub-unit'}
                                            className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition cursor-pointer"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSubUnit(unitName, subName)}
                                            title={isFa ? 'حذف زیرمجموعه' : 'Delete sub-unit'}
                                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Sub-Unit Jobs Inner Content */}
                                      {isSubExpanded && (
                                        <div className="p-3 space-y-2.5 bg-white/70 dark:bg-slate-900/70">
                                          {/* Quick Add Job to Sub-Unit */}
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="text"
                                              value={newSubUnitJobInputs[subKey] || ''}
                                              onChange={e => setNewSubUnitJobInputs({ ...newSubUnitJobInputs, [subKey]: e.target.value })}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleAddSubUnitJob(unitName, subName);
                                                }
                                              }}
                                              placeholder={isFa ? `افزودن سمت/شغل به «${subName}» (مانند: افسر شیفت، آتش‌نشان، کاردان فنی...)...` : `Add position to "${subName}"...`}
                                              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold focus:border-blue-500 outline-none transition"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleAddSubUnitJob(unitName, subName)}
                                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                                            >
                                              <Plus className="w-3 h-3" />
                                              <span>{isFa ? 'افزودن سمت' : 'Add'}</span>
                                            </button>
                                          </div>

                                          {/* Jobs Pills in Subunit */}
                                          {subJobs.length === 0 ? (
                                            <p className="text-[10px] text-slate-400 italic py-1">
                                              {isFa ? 'هنوز سمتی برای این زیرمجموعه تعریف نشده است.' : 'No positions added yet.'}
                                            </p>
                                          ) : (
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                              {subJobs.map((sj, sjIdx) => {
                                                const isEditingJob = editingJobItem?.type === 'subunit' && editingJobItem?.unitName === unitName && editingJobItem?.subUnitName === subName && editingJobItem?.idx === sjIdx;

                                                if (isEditingJob) {
                                                  return (
                                                    <div 
                                                      key={sjIdx} 
                                                      className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-blue-400 rounded-lg px-2 py-0.5 shadow-2xs"
                                                    >
                                                      <input
                                                        autoFocus
                                                        type="text"
                                                        value={editingJobItem.val}
                                                        onChange={e => setEditingJobItem({ ...editingJobItem, val: e.target.value })}
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveJobItemEdit()}
                                                        className="text-xs font-bold bg-transparent outline-none w-32"
                                                      />
                                                      <button
                                                        onClick={handleSaveJobItemEdit}
                                                        className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                                      >
                                                        <Check className="w-3 h-3" />
                                                      </button>
                                                      <button
                                                        onClick={() => setEditingJobItem(null)}
                                                        className="p-0.5 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                                      >
                                                        <X className="w-3 h-3" />
                                                      </button>
                                                    </div>
                                                  );
                                                }

                                                return (
                                                  <div
                                                    key={sjIdx}
                                                    className="group flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-lg px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition"
                                                  >
                                                    <Briefcase className="w-2.5 h-2.5 text-amber-500" />
                                                    <span>{sj}</span>

                                                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition mr-0.5">
                                                      <button
                                                        type="button"
                                                        onClick={() => setEditingJobItem({ type: 'subunit', unitName, subUnitName: subName, idx: sjIdx, val: sj })}
                                                        title={isFa ? 'ویرایش سمت' : 'Edit position'}
                                                        className="p-0.5 text-blue-500 hover:text-blue-700 rounded cursor-pointer"
                                                      >
                                                        <Pencil className="w-2.5 h-2.5" />
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => handleDeleteSubUnitJob(unitName, subName, sjIdx)}
                                                        title={isFa ? 'حذف سمت' : 'Delete position'}
                                                        className="p-0.5 text-red-500 hover:text-red-700 rounded cursor-pointer"
                                                      >
                                                        <X className="w-2.5 h-2.5" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
        </div>
      )}

      {/* --- FLOATING FEEDBACK TOAST --- */}
      {feedbackToast && (
        <div className="fixed bottom-6 left-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="bg-slate-900/95 text-white border border-slate-700 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-3 backdrop-blur-md">
            <div className="p-1.5 bg-emerald-500 text-white rounded-xl shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold text-slate-100">{feedbackToast.message}</p>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* --- ORG CHART UNIT PICKER & SUB-UNITS CONFIG MODAL --- */}
      {showOrgChartPickerModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-xs">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center gap-2">
                    {selectedOrgNodeForConfig
                      ? (isFa ? `تعریف زیرمجموعه‌های واحد «${selectedOrgNodeForConfig.name}»` : `Configure Sub-Units for "${selectedOrgNodeForConfig.name}"`)
                      : (isFa ? 'انتخاب واحد از ساختار و چارت سازمانی' : 'Select Unit from Organizational Chart')}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                    {selectedOrgNodeForConfig 
                      ? (isFa ? 'انتخاب گره‌های تابعه چارت به عنوان زیرمجموعه یا افزودن بخش‌های اختصاصی جدید' : 'Select child nodes as sub-units or add custom sections')
                      : (isFa ? 'واحد مورد نظر را از ساختار سازمان انتخاب کنید تا برای آن زیرمجموعه و سمت‌های عملیاتی تعریف نمایید.' : 'Pick a unit to define its sub-units and operational jobs.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOrgChartPickerModal(false);
                  setSelectedOrgNodeForConfig(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
              {selectedOrgNodeForConfig ? (
                /* === VIEW B: CONFIGURE SUB-UNITS FOR SELECTED NODE === */
                <div className="space-y-4">
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => setSelectedOrgNodeForConfig(null)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
                    <span>{isFa ? 'بازگشت به لیست انتخاب واحدها' : 'Back to Unit Selection'}</span>
                  </button>

                  {/* Selected Node Summary Box */}
                  <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-slate-50 dark:from-indigo-950/40 dark:via-blue-950/30 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                          {selectedOrgNodeForConfig.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                          {ORG_TYPE_LABELS[selectedOrgNodeForConfig.type]?.fa || selectedOrgNodeForConfig.type}
                        </span>
                      </div>
                      {orgStructure[selectedOrgNodeForConfig.name] && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                          {isFa ? '✓ هم‌اکنون در واحدهای عملیاتی ثبت است' : '✓ Already Registered in Units'}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'مسیر در چارت: ' : 'Path: '}</span>
                      <span>{getOrgNodeFullPath(selectedOrgNodeForConfig.id, orgNodes)}</span>
                    </div>

                    {selectedOrgNodeForConfig.manager && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'مسئول واحد: ' : 'Manager: '}</span>
                        <span>{selectedOrgNodeForConfig.manager}</span>
                      </div>
                    )}
                  </div>

                  {/* Child Nodes Selection from Org Chart */}
                  {(() => {
                    const childNodes = getOrgNodeChildren(selectedOrgNodeForConfig.id, orgNodes);

                    return (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <GitFork className="w-3.5 h-3.5 text-amber-500" />
                            <span>{isFa ? 'زیرگره‌های موجود در ساختار سازمانی برای این واحد:' : 'Existing child nodes in Org Chart:'}</span>
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono">
                              {childNodes.length}
                            </span>
                          </label>

                          {childNodes.length > 0 && (
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() => {
                                  const all: Record<string, boolean> = {};
                                  childNodes.forEach(c => { all[c.name.trim()] = true; });
                                  setSelectedChildNodesToImport(all);
                                }}
                                className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                              >
                                {isFa ? 'انتخاب همه' : 'Select All'}
                              </button>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <button
                                type="button"
                                onClick={() => setSelectedChildNodesToImport({})}
                                className="text-slate-500 hover:underline font-bold cursor-pointer"
                              >
                                {isFa ? 'لغو انتخاب همه' : 'Deselect All'}
                              </button>
                            </div>
                          )}
                        </div>

                        {childNodes.length === 0 ? (
                          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                            <p className="text-xs text-slate-500 font-bold">
                              {isFa 
                                ? 'در ساختار چارت، زیرگره‌ای زیر این واحد ثبت نشده است. می‌توانید زیرمجموعه‌ها را در کادر زیر به صورت مستقیم وارد نمایید.' 
                                : 'No child nodes found under this unit in the Org Chart. Enter custom sub-units below.'}
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                            {childNodes.map(child => {
                              const cName = child.name.trim();
                              const isChecked = !!selectedChildNodesToImport[cName] || !!selectedChildNodesToImport[child.name];
                              const isAlreadyInUnit = !!orgStructure[selectedOrgNodeForConfig.name.trim()]?.subUnits?.[cName];

                              return (
                                <label
                                  key={child.id}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                    isChecked 
                                      ? 'bg-amber-50/80 dark:bg-amber-950/30 border-blue-300 dark:border-blue-700/80' 
                                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      setSelectedChildNodesToImport({
                                        ...selectedChildNodesToImport,
                                        [cName]: e.target.checked
                                      });
                                    }}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                                      {child.name}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                      <span>{ORG_TYPE_LABELS[child.type]?.fa || child.type}</span>
                                      {isAlreadyInUnit && (
                                        <span className="text-emerald-600 font-bold">{isFa ? '(قبلاً ثبت شده)' : '(added)'}</span>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Additional Custom Sub-Units */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      {isFa ? 'زیرمجموعه‌های دلخواه دیگر (با ویرگول یا خط جدید جدا کنید):' : 'Additional Sub-Units (comma or newline separated):'}
                    </label>
                    <textarea
                      rows={2}
                      value={pickerCustomSubUnits}
                      onChange={e => setPickerCustomSubUnits(e.target.value)}
                      placeholder={isFa ? 'مثال: ایمنی فرآیند، شیفت آتش‌نشانی، آزمایشگاه تخصصی...' : 'e.g. Safety, Operations Shift, Lab...'}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* Initial Unit Positions / Jobs */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      {isFa ? 'سمت‌ها و مشاغل مستقیم این واحد (اختیاری - با ویرگول جدا کنید):' : 'Direct Unit Positions (Optional - comma separated):'}
                    </label>
                    <input
                      type="text"
                      value={pickerCustomJobs}
                      onChange={e => setPickerCustomJobs(e.target.value)}
                      placeholder={isFa ? 'مثال: مدیر واحد، کارشناس ارشد، سرپرست کارگاه...' : 'e.g. Unit Manager, Senior Specialist...'}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              ) : (
                /* === VIEW A: SEARCH & SELECT ORG NODE === */
                <div className="space-y-3.5">
                  {/* Search and Filters */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        value={orgChartSearch}
                        onChange={e => setOrgChartSearch(e.target.value)}
                        placeholder={isFa ? 'جستجو در نام واحد سازمانی، مدیر، کد یا مسیر...' : 'Search units by name, manager, code, path...'}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-9 pl-4 py-2 text-xs font-bold focus:border-indigo-500 outline-none"
                      />
                    </div>

                    {/* Filter by Type */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {['ALL', 'PLANT', 'DEPARTMENT', 'AREA', 'SECTION', 'SITE'].map(typeKey => (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => setOrgChartTypeFilter(typeKey)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            orgChartTypeFilter === typeKey
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {typeKey === 'ALL' ? (isFa ? 'همه رده‌ها' : 'All Types') : (ORG_TYPE_LABELS[typeKey]?.fa || typeKey)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nodes List */}
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {orgNodes
                      .filter(node => {
                        if (orgChartTypeFilter !== 'ALL' && node.type !== orgChartTypeFilter) return false;
                        if (!orgChartSearch.trim()) return true;
                        const q = orgChartSearch.trim().toLowerCase();
                        if (node.name.toLowerCase().includes(q)) return true;
                        if (node.manager?.toLowerCase().includes(q)) return true;
                        if (node.code?.toLowerCase().includes(q)) return true;
                        const fullPath = getOrgNodeFullPath(node.id, orgNodes).toLowerCase();
                        return fullPath.includes(q);
                      })
                      .map(node => {
                        const childNodes = getOrgNodeChildren(node.id, orgNodes);
                        const isAlreadyAdded = !!orgStructure[node.name];
                        const currentSubCount = Object.keys(orgStructure[node.name]?.subUnits || {}).length;

                        return (
                          <div
                            key={node.id}
                            className={`p-3 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isAlreadyAdded
                                ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                  {node.name}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {ORG_TYPE_LABELS[node.type]?.fa || node.type}
                                </span>
                                {isAlreadyAdded && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                    {isFa ? `ثبت‌شده (${currentSubCount} زیرمجموعه)` : `Added (${currentSubCount} subs)`}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-500 truncate">
                                <span>{getOrgNodeFullPath(node.id, orgNodes)}</span>
                              </div>

                              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold">
                                {node.manager && (
                                  <span>{isFa ? `مسئول: ${node.manager}` : `Mgr: ${node.manager}`}</span>
                                )}
                                <span>
                                  {childNodes.length} {isFa ? 'زیرگره در چارت' : 'Child nodes in chart'}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectOrgNodeForConfig(node)}
                              className="self-start sm:self-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                              <GitFork className="w-3.5 h-3.5" />
                              <span>{isFa ? 'انتخاب و تعریف زیرمجموعه' : 'Select & Configure'}</span>
                            </button>
                          </div>
                        );
                      })}

                    {orgNodes.length === 0 && (
                      <div className="text-center py-8 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                        <FolderTree className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          {isFa ? 'هنوز واحدی در تب «ساختار و چارت سازمانی» تعریف نشده است.' : 'No units defined in Org Structure tab yet.'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {isFa ? 'ابتدا به تب چارت سازمانی رفته و ساختار درختی واحدهای سازمان را ثبت کنید.' : 'Switch to Org Structure tab to build your hierarchy.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowOrgChartPickerModal(false);
                  setSelectedOrgNodeForConfig(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>

              {selectedOrgNodeForConfig && (
                <button
                  type="button"
                  onClick={handleConfirmOrgNodeImport}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isFa ? 'ثبت و ذخیره زیرمجموعه‌ها در واحدهای عملیاتی' : 'Save Sub-Units to Units'}</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- ADD UNIT MODAL --- */}
      {showAddUnitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-amber-600">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-950/40 rounded-2xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{isFa ? 'افزودن واحد عملیاتی جدید' : 'Add New Operational Unit'}</h4>
                  <p className="text-[11px] text-slate-500 font-bold">{isFa ? 'همراه با امکان ثبت فوری زیرمجموعه‌ها و سمت‌های مستقیم' : 'With sub-units and positions'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUnitModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Source Selection Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setAddUnitSource('from_org_chart')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  addUnitSource === 'from_org_chart'
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? 'انتخاب از چارت سازمانی' : 'From Org Chart'}</span>
              </button>
              <button
                type="button"
                onClick={() => setAddUnitSource('manual')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  addUnitSource === 'manual'
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isFa ? 'ورود دستی نام واحد' : 'Manual Entry'}</span>
              </button>
            </div>

            <form onSubmit={handleAddUnit} className="space-y-4">
              {addUnitSource === 'from_org_chart' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'انتخاب واحد از ساختار و چارت سازمانی *' : 'Select Unit from Org Chart *'}
                  </label>
                  <select
                    value={selectedOrgNodeIdInAddModal}
                    onChange={e => {
                      const id = e.target.value;
                      setSelectedOrgNodeIdInAddModal(id);
                      const found = orgNodes.find(n => n.id === id);
                      if (found) {
                        setNewUnit(found.name);
                        // Pre-populate child nodes as sub-units
                        const children = getOrgNodeChildren(found.id, orgNodes);
                        if (children.length > 0) {
                          setNewUnitSubUnitsStr(children.map(c => c.name).join('، '));
                        }
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="">{isFa ? '-- یک واحد از چارت انتخاب کنید --' : '-- Select from chart --'}</option>
                    {orgNodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({ORG_TYPE_LABELS[n.type]?.fa || n.type})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {isFa ? 'نام واحد سازمانی *' : 'Unit Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnit}
                    onChange={e => setNewUnit(e.target.value)}
                    placeholder={isFa ? 'مثال: تولید، خدمات، HSE، آزمایشگاه...' : 'e.g. Production, HSE...'}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isFa ? 'زیرمجموعه‌های این واحد (اختیاری - با ویرگول یا خط جدید جدا کنید)' : 'Sub-units (Optional - comma or newline separated)'}
                </label>
                <textarea
                  rows={2}
                  value={newUnitSubUnitsStr}
                  onChange={e => setNewUnitSubUnitsStr(e.target.value)}
                  placeholder={isFa ? 'مثال: ایمنی، آتش‌نشانی، بهداشت، محیط زیست' : 'e.g. Safety, Fire, Health, Environment'}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {isFa ? 'سمت‌ها و مشاغل اولیه واحد (اختیاری - با ویرگول جدا کنید)' : 'Initial Unit Positions (Optional - comma separated)'}
                </label>
                <input
                  type="text"
                  value={newUnitJobsStr}
                  onChange={e => setNewUnitJobsStr(e.target.value)}
                  placeholder={isFa ? 'مثال: مدیر واحد، سرپرست، کارشناس مسئول' : 'e.g. Unit Manager, Supervisor, Lead Specialist'}
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:border-blue-500 outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUnitModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isFa ? 'ثبت و ایجاد واحد' : 'Create Unit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- TAB 2: INCIDENT TYPES MANAGEMENT --- */}
      {activeTab === 'incident_types' && (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 md:p-6 shadow-md border border-slate-700/50 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h4 className="font-extrabold text-sm md:text-base text-white">
                    {isFa ? 'دسته‌بندی استاندارد انواع حوادث و رویدادهای HSE' : 'Standard HSE Incident & Event Categories'}
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                  {isFa 
                    ? 'تعریف و طبقه‌بندی استاندارد حوادث شغلی مجتمع بر اساس سطح شدت و الزامات گزارش‌دهی سازمان‌های بین‌المللی (OSHA / ISO 45001). این عناوین در فرم‌های ثبت حوادث، تحلیل ریشه‌ای (RCA) و گزارش‌دهی دوره استفاده می‌شوند.'
                    : 'Classify workspace incidents into high severity cases, recordables, and proactive safety reporting tiers according to OSHA/ISO standards.'}
                </p>
              </div>

              <button
                onClick={handleResetIncTypesToDefault}
                className="self-start md:self-center px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                title={isFa ? 'بازنشانی تعاریف به حالت اولیه استاندارد' : 'Reset to default standards'}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>{isFa ? 'بازیابی پیش‌فرض استاندارد' : 'Reset Defaults'}</span>
              </button>
            </div>

            {/* 3 Main Tiers Summary Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
              <div className="bg-red-950/50 border border-red-500/30 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                  <div>
                    <h5 className="font-black text-xs text-red-200">{isFa ? '🔴 حوادث با شدت بالا' : '🔴 High Severity'}</h5>
                    <p className="text-[10px] text-red-300/80 mt-0.5">{isFa ? 'فوت، زمان از دست رفته، کار محدود' : 'Fatality, LTI, Restricted Work'}</p>
                  </div>
                </div>
                <span className="text-sm font-black font-mono px-2 py-0.5 bg-red-900/60 text-red-100 rounded-lg border border-red-500/40">
                  {incidentTypes.filter(i => i.group === 'high_severity').length}
                </span>
              </div>

              <div className="bg-amber-950/50 border border-blue-500/30 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0"></span>
                  <div>
                    <h5 className="font-black text-xs text-amber-200">{isFa ? '🟡 رویدادهای قابل ثبت' : '🟡 Recordable Incidents'}</h5>
                    <p className="text-[10px] text-amber-300/80 mt-0.5">{isFa ? 'درمان پزشکی، حریق، خسارت، محیط‌زیست' : 'Medical, Fires, Property, Env'}</p>
                  </div>
                </div>
                <span className="text-sm font-black font-mono px-2 py-0.5 bg-amber-900/60 text-amber-100 rounded-lg border border-blue-500/40">
                  {incidentTypes.filter(i => i.group === 'recordable').length}
                </span>
              </div>

              <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0"></span>
                  <div>
                    <h5 className="font-black text-xs text-emerald-200">{isFa ? '🟢 رویدادهای پیشگیرانه' : '🟢 Proactive Reporting'}</h5>
                    <p className="text-[10px] text-emerald-300/80 mt-0.5">{isFa ? 'شبه حادثه، شرایط و عمل ناایمن' : 'Near Miss, Unsafe Act/Condition'}</p>
                  </div>
                </div>
                <span className="text-sm font-black font-mono px-2 py-0.5 bg-emerald-900/60 text-emerald-100 rounded-lg border border-emerald-500/40">
                  {incidentTypes.filter(i => i.group === 'proactive').length}
                </span>
              </div>
            </div>
          </div>

          {/* Form Section: Add or Edit Incident Category */}
          <form onSubmit={handleSaveIncType} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                <span>{editingIncTypeId ? (isFa ? 'ویرایش عنوان دسته‌بندی حادثه' : 'Edit Incident Type') : (isFa ? 'تعریف عنوان جدید نوع حادثه' : 'Add New Incident Type')}</span>
              </h4>
              {editingIncTypeId && (
                <button
                  type="button"
                  onClick={handleCancelIncEdit}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-100 font-bold underline cursor-pointer"
                >
                  {isFa ? 'انصراف از ویرایش' : 'Cancel Edit'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Category Tier Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'سطح اصلی (دسته بندی)' : 'Severity Tier'}
                </label>
                <select
                  value={incForm.group}
                  onChange={e => setIncForm({ ...incForm, group: e.target.value as any })}
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="high_severity">{isFa ? '🔴 حوادث با شدت بالا (High Severity)' : '🔴 High Severity'}</option>
                  <option value="recordable">{isFa ? '🟡 حوادث و رویدادهای قابل ثبت (Recordable)' : '🟡 Recordable Incidents'}</option>
                  <option value="proactive">{isFa ? '🟢 رویدادهای پیشگیرانه (Proactive HSE)' : '🟢 Proactive HSE'}</option>
                </select>
              </div>

              {/* Persian Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'عنوان فارسی نوع حادثه' : 'Persian Title'}
                </label>
                <input
                  type="text"
                  required
                  value={incForm.titleFa}
                  onChange={e => setIncForm({ ...incForm, titleFa: e.target.value })}
                  placeholder="مثال: نشت مواد شیمیایی"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* English Title */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'عنوان انگلیسی / استاندارد' : 'English Title'}
                </label>
                <input
                  type="text"
                  value={incForm.titleEn}
                  onChange={e => setIncForm({ ...incForm, titleEn: e.target.value })}
                  placeholder="e.g. Chemical Spill"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'کد / نماد اختصاری' : 'Category Code'}
                </label>
                <input
                  type="text"
                  value={incForm.code}
                  onChange={e => setIncForm({ ...incForm, code: e.target.value })}
                  placeholder="e.g. SPILL / ENV"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono uppercase outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-end">
              {/* Description */}
              <div className="flex-1 w-full">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                  {isFa ? 'توضیحات و مصادیق شمول' : 'Description & Scope'}
                </label>
                <input
                  type="text"
                  value={incForm.descriptionFa}
                  onChange={e => setIncForm({ ...incForm, descriptionFa: e.target.value })}
                  placeholder="توضیحات مختصر در مورد شرایط و دامنه شمول این حادثه..."
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editingIncTypeId ? (isFa ? 'ذخیره تغییرات' : 'Update') : (isFa ? 'افزودن به لیست' : 'Add Category')}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-100/70 p-2 rounded-2xl">
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-0.5">
              <button
                onClick={() => setIncTypeFilter('all')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer shrink-0 ${
                  incTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isFa ? 'همه موارد' : 'All Categories'} ({incidentTypes.length})
              </button>
              <button
                onClick={() => setIncTypeFilter('high_severity')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer shrink-0 ${
                  incTypeFilter === 'high_severity' ? 'bg-red-600 text-white shadow-xs' : 'text-red-700 hover:bg-red-100/60'
                }`}
              >
                🔴 {isFa ? 'شدت بالا' : 'High Severity'} ({incidentTypes.filter(i => i.group === 'high_severity').length})
              </button>
              <button
                onClick={() => setIncTypeFilter('recordable')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer shrink-0 ${
                  incTypeFilter === 'recordable' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-800 hover:bg-amber-100/60'
                }`}
              >
                🟡 {isFa ? 'قابل ثبت' : 'Recordable'} ({incidentTypes.filter(i => i.group === 'recordable').length})
              </button>
              <button
                onClick={() => setIncTypeFilter('proactive')}
                className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition cursor-pointer shrink-0 ${
                  incTypeFilter === 'proactive' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-800 hover:bg-emerald-100/60'
                }`}
              >
                🟢 {isFa ? 'پیشگیرانه' : 'Proactive'} ({incidentTypes.filter(i => i.group === 'proactive').length})
              </button>
            </div>

            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={incTypeSearch}
                onChange={e => setIncTypeSearch(e.target.value)}
                placeholder={isFa ? 'جستجو در انواع حوادث...' : 'Search incident types...'}
                className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cards Grid List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incidentTypes.filter(item => {
              const matchesFilter = incTypeFilter === 'all' || item.group === incTypeFilter;
              const matchesSearch = !incTypeSearch.trim() || 
                item.titleFa.toLowerCase().includes(incTypeSearch.toLowerCase()) ||
                item.titleEn.toLowerCase().includes(incTypeSearch.toLowerCase()) ||
                (item.code && item.code.toLowerCase().includes(incTypeSearch.toLowerCase())) ||
                (item.descriptionFa && item.descriptionFa.toLowerCase().includes(incTypeSearch.toLowerCase()));
              return matchesFilter && matchesSearch;
            }).length === 0 ? (
              <div className="col-span-full bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-400 font-bold text-xs">
                {isFa ? 'هیچ نوع حادثه‌ای با مشخصات جستجو شده یافت نشد.' : 'No incident categories found.'}
              </div>
            ) : (
              incidentTypes.filter(item => {
                const matchesFilter = incTypeFilter === 'all' || item.group === incTypeFilter;
                const matchesSearch = !incTypeSearch.trim() || 
                  item.titleFa.toLowerCase().includes(incTypeSearch.toLowerCase()) ||
                  item.titleEn.toLowerCase().includes(incTypeSearch.toLowerCase()) ||
                  (item.code && item.code.toLowerCase().includes(incTypeSearch.toLowerCase())) ||
                  (item.descriptionFa && item.descriptionFa.toLowerCase().includes(incTypeSearch.toLowerCase()));
                return matchesFilter && matchesSearch;
              }).map(item => {
                const isHigh = item.group === 'high_severity';
                const isRec = item.group === 'recordable';

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 relative group transition hover:shadow-md ${
                      isHigh 
                        ? 'border-red-200 hover:border-red-400 bg-gradient-to-b from-red-50/20 to-white' 
                        : isRec 
                        ? 'border-blue-200 hover:border-blue-400 bg-gradient-to-b from-amber-50/20 to-white'
                        : 'border-emerald-200 hover:border-emerald-400 bg-gradient-to-b from-emerald-50/20 to-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                            isHigh 
                              ? 'bg-red-100 text-red-800 border-red-200' 
                              : isRec 
                              ? 'bg-amber-100 text-amber-800 border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }`}>
                            {isHigh 
                              ? (isFa ? '🔴 حوادث با شدت بالا' : '🔴 High Severity')
                              : isRec 
                              ? (isFa ? '🟡 رویداد قابل ثبت' : '🟡 Recordable')
                              : (isFa ? '🟢 رویداد پیشگیرانه' : '🟢 Proactive HSE')}
                          </span>

                          {item.code && (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                              {item.code}
                            </span>
                          )}
                        </div>

                        <h5 className="font-extrabold text-slate-900 text-sm mt-1">{item.titleFa}</h5>
                        <p className="text-[11px] text-slate-400 font-mono">{item.titleEn}</p>
                      </div>
                    </div>

                    {item.descriptionFa && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">
                        {item.descriptionFa}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleEditIncType(item)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                        title={isFa ? 'ویرایش' : 'Edit'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isFa ? 'ویرایش' : 'Edit'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteIncType(item.id, item.titleFa)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                        title={isFa ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isFa ? 'حذف' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- TAB 3: PPE EQUIPMENT DEFINITION & MASTER DATA --- */}
      {activeTab === 'ppe_equipment' && (
        <div className="space-y-6">
          {/* Top Bar with Search & Add */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={ppeSearch}
                onChange={e => setPpeSearch(e.target.value)}
                placeholder={isFa ? 'جستجو در نام تجهیز، کد کالا یا دسته‌بندی...' : 'Search PPE equipment name, code or category...'}
                className="w-full pr-9 pl-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button
              onClick={handleOpenNewEquipmentModal}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'تعریف و اضافه کردن تجهیز PPE جدید' : 'Add New PPE Equipment'}</span>
            </button>
          </div>

          {/* Table / Cards List of Equipment */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
            <div className="overflow-x-auto">
              <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 text-slate-700 dark:text-slate-200 font-extrabold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">{isFa ? 'کد اختصاصی' : 'Code'}</th>
                    <th className="p-3">{isFa ? 'نام تجهیز حفاظت فردی' : 'PPE Equipment Name'}</th>
                    <th className="p-3">{isFa ? 'دسته‌بندی تخصصی' : 'Category'}</th>
                    <th className="p-3">{isFa ? 'استاندارد ایمنی' : 'Safety Standard'}</th>
                    <th className="p-3">{isFa ? 'موجودی انبار' : 'Stock'}</th>
                    <th className="p-3 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPpeItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        {isFa ? 'هیچ تجهیز حفاظت فردی یافت نشد.' : 'No PPE equipment found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPpeItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 dark:bg-slate-800/50/80 transition">
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-100">{item.code}</td>
                        <td className="p-3">
                          <div className="font-extrabold text-slate-900">{item.nameFa}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{item.nameEn}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[11px] font-bold">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">{item.oshaStandard}</td>
                        <td className="p-3 font-mono">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                            item.availableStock <= item.reorderLevel 
                              ? 'bg-amber-100 text-amber-800 border border-blue-200' 
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {item.availableStock} {isFa ? 'عدد' : 'pcs'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditEquipmentModal(item)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1"
                              title={isFa ? 'ویرایش مشخصات تجهیز' : 'Edit Equipment'}
                            >
                              <Pencil className="w-3 h-3" />
                              {isFa ? 'ویرایش' : 'Edit'}
                            </button>
                            <button
                              onClick={() => handleDeleteEquipment(item.id, item.nameFa)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1"
                              title={isFa ? 'حذف از کاتالوگ' : 'Delete'}
                            >
                              <Trash2 className="w-3 h-3" />
                              {isFa ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table></div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL FOR ADDING / EDITING PPE EQUIPMENT --- */}
      {showEquipmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>
                  {editingEquipmentItem 
                    ? (isFa ? 'ویرایش مشخصات تجهیز حفاظت فردی' : 'Edit PPE Equipment') 
                    : (isFa ? 'تعریف و ثبت نام تجهیز حفاظت فردی جدید' : 'Add New PPE Equipment')}
                </span>
              </h4>
              <button
                onClick={() => setShowEquipmentModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نام فارسی تجهیز' : 'Persian Equipment Name'}</label>
                <input
                  type="text"
                  required
                  value={equipmentForm.nameFa}
                  onChange={e => {
                    const newFa = e.target.value;
                    setEquipmentForm(prev => ({
                      ...prev,
                      nameFa: newFa,
                      nameEn: translatePpeNameToEn(newFa)
                    }));
                  }}
                  placeholder="مثال: کلاه ایمنی صنعتی کلاس E"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نام انگلیسی تجهیز (ترجمه خودکار)' : 'English Equipment Name'}</label>
                <input
                  type="text"
                  value={equipmentForm.nameEn}
                  onChange={e => setEquipmentForm({ ...equipmentForm, nameEn: e.target.value })}
                  placeholder="Industrial Hard Hat Class E"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'کد / شناسه اختصاصی کالا' : 'Equipment Code'}</label>
                  <input
                    type="text"
                    required
                    value={equipmentForm.code}
                    onChange={e => setEquipmentForm({ ...equipmentForm, code: e.target.value })}
                    placeholder="PPE-HD-001"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'دسته‌بندی تجهیز' : 'PPE Category'}</label>
                  <select
                    value={equipmentForm.category}
                    onChange={e => setEquipmentForm({ ...equipmentForm, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    {ppeCategories.map(cat => (
                      <option key={cat.id} value={cat.nameEn ? `${cat.nameEn} (${cat.oshaCode || 'OSHA'})` : cat.nameFa}>
                        {cat.nameFa} ({cat.nameEn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'استاندارد ایمنی (ANSI / NIOSH / ISIRI)' : 'Safety Standard'}</label>
                <input
                  type="text"
                  value={equipmentForm.oshaStandard}
                  onChange={e => setEquipmentForm({ ...equipmentForm, oshaStandard: e.target.value })}
                  placeholder="ANSI/ISEA Z89.1 / ISIRI 4998"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'موجودی کل' : 'Total Stock'}</label>
                  <input
                    type="number"
                    min={0}
                    value={equipmentForm.totalStock}
                    onChange={e => setEquipmentForm({ ...equipmentForm, totalStock: Number(e.target.value) })}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-center focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'نقطه سفارش' : 'Reorder Level'}</label>
                  <input
                    type="number"
                    min={0}
                    value={equipmentForm.reorderLevel}
                    onChange={e => setEquipmentForm({ ...equipmentForm, reorderLevel: Number(e.target.value) })}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-center focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">{isFa ? 'عمر مفید (ماه)' : 'Lifespan (M)'}</label>
                  <input
                    type="number"
                    min={1}
                    value={equipmentForm.lifespanMonths}
                    onChange={e => setEquipmentForm({ ...equipmentForm, lifespanMonths: Number(e.target.value) })}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-center focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEquipmentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  {editingEquipmentItem ? (isFa ? 'ذخیره تغییرات تجهیز' : 'Save Changes') : (isFa ? 'افزودن به کاتالوگ تجهیزات' : 'Add to Catalog')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm">{isFa ? 'تایید حذف' : 'Confirm Delete'}</h4>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">{deleteConfirm.title}</p>
              {deleteConfirm.description && (
                <p className="text-[11px] text-slate-500">{deleteConfirm.description}</p>
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
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                {isFa ? 'حذف قطعی' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
