import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Building,
  Factory,
  Layers,
  Briefcase,
  Sliders,
  Users,
  Plus,
  Trash2,
  Edit2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  FolderTree,
  RotateCcw,
  Download,
  MapPin,
  UserCheck,
  CreditCard,
  FileText,
  Check,
  X
} from 'lucide-react';
import { OrgNode, SEED_ORG_NODES, addAuditLog } from '../utils/authHelper';
import { syncAndGetExtractedDepartments } from '../utils/personnelHelper';
import { Department } from '../types';
import { getOrgUnitsStructure, saveOrgUnitsStructure, OrgUnitsDataMap } from '../utils/orgHelper';

import { apiDb } from '../services/apiDatabaseClient';

interface OrgStructureManagerProps {
  isFa: boolean;
  currentUser?: any;
  onUpdate?: () => void;
  onOpenBackupRestore?: () => void;
}

export const ORG_TYPE_LABELS = {
  Company: { fa: 'شرکت مادر / هلدینگ', en: 'Company / Holding', badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60', icon: Building2 },
  Site: { fa: 'سایت / مجتمع پتروشیمی', en: 'Site / Petrochemical Complex', badgeBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60', icon: Building },
  Plant: { fa: 'واحد / کارخانه اصلی (Plant)', en: 'Production Plant', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60', icon: Factory },
  Area: { fa: 'ناحیه عملیاتی / زون فرآیندی', en: 'Operating Area / Zone', badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-blue-200 dark:border-blue-800/60', icon: Layers },
  Department: { fa: 'دپارتمان / اداره کل', en: 'Department / Directorate', badgeBg: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/60', icon: Briefcase },
  Section: { fa: 'بخش / کارگاه / آزمایشگاه', en: 'Section / Workshop / Lab', badgeBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60', icon: Sliders },
  Team: { fa: 'تیم اجرایی / نوبت‌کار / شیفت', en: 'Team / Shift Group', badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700', icon: Users }
};

import { fetchStoredOrgNodes, saveStoredOrgNodes, findPersonnelFast } from '../utils/personnelHelper';
import CentralPersonnelSelector from './CentralPersonnelSelector';

export default function OrgStructureManager({ isFa, currentUser, onUpdate, onOpenBackupRestore }: OrgStructureManagerProps) {
  // --- STATE ---
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [isInitLoaded, setIsInitLoaded] = useState(false);

  // Dynamically resolve live manager details from Central Personnel Master Data
  const resolveManager = useCallback((node: OrgNode) => {
    const p = (node.managerPersonnelCode && findPersonnelFast(node.managerPersonnelCode)) ||
              (node.managerPersonnelId && findPersonnelFast(String(node.managerPersonnelId))) ||
              (node.manager && findPersonnelFast(node.manager));

    if (p) {
      return {
        fullName: p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || node.manager || '',
        personnelCode: p.effectiveCode || p.personnelCode || node.managerPersonnelCode || '',
        jobTitle: p.jobTitle || p.position || node.managerJobTitle || '',
        personnelId: p.id ? Number(p.id) : undefined,
        nationalCode: p.nationalCode || node.managerNationalCode || '',
        status: p.status || node.managerStatus || 'ACTIVE',
        isLinked: true
      };
    }

    return {
      fullName: node.manager || '',
      personnelCode: node.managerPersonnelCode || '',
      jobTitle: node.managerJobTitle || '',
      personnelId: node.managerPersonnelId || undefined,
      nationalCode: node.managerNationalCode || '',
      status: node.managerStatus || 'ACTIVE',
      isLinked: false
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      const nodes = await fetchStoredOrgNodes();
      if (isMounted) {
        setOrgNodes(nodes);
        setIsInitLoaded(true);
      }
    };
    load();

    const handleRemoteUpdate = async (e?: any) => {
      if (!isMounted) return;
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('org') || entity.includes('node') || entity.includes('department') || entity.includes('setting') || entity.includes('personnel')) {
        const nodes = await fetchStoredOrgNodes(true);
        if (isMounted) setOrgNodes(nodes);
      }
    };

    window.addEventListener('app_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_central_data_synced', handleRemoteUpdate);
    window.addEventListener('hse_personnel_updated', handleRemoteUpdate);
    window.addEventListener('hse_org_nodes_updated', () => {
      fetchStoredOrgNodes(false).then(nodes => {
        if (isMounted) setOrgNodes(nodes);
      });
    });

    return () => {
      isMounted = false;
      window.removeEventListener('app_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_central_data_synced', handleRemoteUpdate);
      window.removeEventListener('hse_personnel_updated', handleRemoteUpdate);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'tree' | 'grid' | 'table'>('tree');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    // Expand all initially
    const initialExpanded: Record<string, boolean> = {};
    SEED_ORG_NODES.forEach(n => { initialExpanded[n.id] = true; });
    return initialExpanded;
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<OrgNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ node: OrgNode; childCount: number } | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState<{
    name: string;
    nameEn: string;
    type: OrgNode['type'];
    parentId: string | null;
    code: string;
    manager: string;
    managerPersonnelId?: number | null;
    managerPersonnelCode?: string | null;
    managerJobTitle?: string | null;
    managerNationalCode?: string | null;
    description: string;
    location: string;
    headcount: number;
    costCenter: string;
    status: 'active' | 'inactive' | 'commissioning';
  }>({
    name: '',
    nameEn: '',
    type: 'Plant',
    parentId: null,
    code: '',
    manager: '',
    managerPersonnelId: null,
    managerPersonnelCode: '',
    managerJobTitle: '',
    managerNationalCode: '',
    description: '',
    location: '',
    headcount: 50,
    costCenter: '',
    status: 'active'
  });

  // Save to database whenever orgNodes changes
  const saveNodes = async (updated: OrgNode[]): Promise<boolean> => {
    setOrgNodes(updated);
    try {
      const ok = await saveStoredOrgNodes(updated);
      syncAndGetExtractedDepartments();
      window.dispatchEvent(new CustomEvent('hse_org_nodes_updated', { detail: { origin: 'OrgStructureManager', nodes: updated } }));
      window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { origin: 'OrgStructureManager', entity: 'org_nodes' } }));

      if (onUpdate) onUpdate();
      return ok;
    } catch (e) {
      console.error('Failed to save org nodes', e);
      return false;
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --- ACTIONS ---
  const handleOpenAddModal = (defaultParentId: string | null = null, defaultType: OrgNode['type'] = 'Plant') => {
    setEditingNode(null);
    setFormData({
      name: '',
      nameEn: '',
      type: defaultType,
      parentId: defaultParentId,
      code: `ORG-${Math.floor(100 + Math.random() * 900)}`,
      manager: '',
      managerPersonnelId: null,
      managerPersonnelCode: '',
      managerJobTitle: '',
      managerNationalCode: '',
      description: '',
      location: '',
      headcount: 25,
      costCenter: `CC-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'active'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (node: OrgNode) => {
    setEditingNode(node);
    const resolved = resolveManager(node);
    setFormData({
      name: node.name,
      nameEn: node.nameEn || '',
      type: node.type,
      parentId: node.parentId || null,
      code: node.code || '',
      manager: resolved.fullName || node.manager || '',
      managerPersonnelId: node.managerPersonnelId ?? (resolved.personnelId ? Number(resolved.personnelId) : null),
      managerPersonnelCode: node.managerPersonnelCode || resolved.personnelCode || '',
      managerJobTitle: node.managerJobTitle || resolved.jobTitle || '',
      managerNationalCode: node.managerNationalCode || resolved.nationalCode || '',
      description: node.description || '',
      location: node.location || '',
      headcount: node.headcount || 0,
      costCenter: node.costCenter || '',
      status: node.status || 'active'
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert(isFa ? 'لطفاً نام ساختار سازمانی را وارد نمایید.' : 'Please enter organization name.');
      return;
    }

    if (editingNode) {
      // Update existing
      const updated = orgNodes.map(n => {
        if (n.id === editingNode.id) {
          return {
            ...n,
            name: formData.name.trim(),
            nameEn: formData.nameEn.trim(),
            type: formData.type,
            parentId: formData.parentId || null,
            code: formData.code.trim(),
            manager: formData.manager.trim(),
            managerPersonnelId: formData.managerPersonnelId ?? null,
            managerPersonnelCode: formData.managerPersonnelCode ? formData.managerPersonnelCode.trim() : null,
            managerJobTitle: formData.managerJobTitle ? formData.managerJobTitle.trim() : null,
            managerNationalCode: formData.managerNationalCode ? formData.managerNationalCode.trim() : null,
            description: formData.description.trim(),
            location: formData.location.trim(),
            headcount: Number(formData.headcount) || 0,
            costCenter: formData.costCenter.trim(),
            status: formData.status
          };
        }
        return n;
      });
      saveNodes(updated);
      if (currentUser?.username) {
        addAuditLog(currentUser.username, `ویرایش مشخصات ساختار سازمانی: ${formData.name}`, 'موفقیت‌آمیز');
      }
      showToast(isFa ? `ساختار سازمانی «${formData.name}» با موفقیت ویرایش شد.` : `Organization structure "${formData.name}" updated successfully.`);
    } else {
      // Create new node
      const newNode: OrgNode = {
        id: 'org-' + Date.now(),
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        type: formData.type,
        parentId: formData.parentId || null,
        code: formData.code.trim(),
        manager: formData.manager.trim(),
        managerPersonnelId: formData.managerPersonnelId ?? null,
        managerPersonnelCode: formData.managerPersonnelCode ? formData.managerPersonnelCode.trim() : null,
        managerJobTitle: formData.managerJobTitle ? formData.managerJobTitle.trim() : null,
        managerNationalCode: formData.managerNationalCode ? formData.managerNationalCode.trim() : null,
        description: formData.description.trim(),
        location: formData.location.trim(),
        headcount: Number(formData.headcount) || 0,
        costCenter: formData.costCenter.trim(),
        status: formData.status,
        createdAt: new Date().toLocaleDateString('fa-IR')
      };
      const updated = [...orgNodes, newNode];
      saveNodes(updated);
      
      // Auto expand parent
      if (newNode.parentId) {
        setExpandedNodes(prev => ({ ...prev, [newNode.parentId!]: true }));
      }
      
      if (currentUser?.username) {
        addAuditLog(currentUser.username, `تعریف و ثبت ساختار سازمانی جدید: ${formData.name} (${formData.type})`, 'موفقیت‌آمیز');
      }
      showToast(isFa ? `ساختار سازمانی جدید «${formData.name}» با موفقیت ایجاد گردید.` : `New organization structure "${formData.name}" defined successfully.`);
    }

    setIsModalOpen(false);
  };

  const handleRequestDelete = (node: OrgNode) => {
    // Count direct and indirect children
    const getChildrenCount = (parentId: string): number => {
      const children = orgNodes.filter(n => n.parentId === parentId);
      return children.length + children.reduce((sum, c) => sum + getChildrenCount(c.id), 0);
    };
    const childCount = getChildrenCount(node.id);
    setDeleteConfirm({ node, childCount });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const { node } = deleteConfirm;

    // Collect all descendant nodes and ids
    const getDescendantNodes = (parentId: string): OrgNode[] => {
      const children = orgNodes.filter(n => n.parentId === parentId);
      let list = [...children];
      children.forEach(c => {
        list = list.concat(getDescendantNodes(c.id));
      });
      return list;
    };
    const nodesToRemove = [node, ...getDescendantNodes(node.id)];
    const idsToRemove = nodesToRemove.map(n => n.id);
    const namesToRemove = new Set(nodesToRemove.map(n => n.name.trim().toLowerCase()));

    const updated = orgNodes.filter(n => !idsToRemove.includes(n.id));

    // Also remove from orgStructure (Units & Jobs) if present, so it doesn't linger or reappear
    const currentStruct = getOrgUnitsStructure();
    let structChanged = false;
    const nextStruct: OrgUnitsDataMap = { ...currentStruct };
    for (const key of Object.keys(nextStruct)) {
      if (namesToRemove.has(key.trim().toLowerCase())) {
        delete nextStruct[key];
        structChanged = true;
      } else {
        const subs = nextStruct[key].subUnits || {};
        let subsChanged = false;
        const newSubs = { ...subs };
        for (const subKey of Object.keys(newSubs)) {
          if (namesToRemove.has(subKey.trim().toLowerCase())) {
            delete newSubs[subKey];
            subsChanged = true;
          }
        }
        if (subsChanged) {
          nextStruct[key] = { ...nextStruct[key], subUnits: newSubs };
          structChanged = true;
        }
      }
    }
    if (structChanged) {
      await saveOrgUnitsStructure(nextStruct);
    }

    await saveNodes(updated);
    if (currentUser?.username) {
      addAuditLog(currentUser.username, `حذف ساختار سازمانی: ${node.name} و ${idsToRemove.length - 1} زیرمجموعه`, 'موفقیت‌آمیز');
    }
    showToast(isFa ? `ساختار سازمانی «${node.name}» و زیرمجموعه‌های آن حذف شدند.` : `Organization structure "${node.name}" removed.`);
    setDeleteConfirm(null);
  };

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleExpandAll = () => {
    const all: Record<string, boolean> = {};
    orgNodes.forEach(n => { all[n.id] = true; });
    setExpandedNodes(all);
  };

  const handleCollapseAll = () => {
    setExpandedNodes({});
  };

  const handleResetToSeeds = () => {
    setShowResetConfirmModal(true);
  };

  const handleConfirmResetToSeeds = async () => {
    await apiDb.createOrgBackup();
    await saveNodes(SEED_ORG_NODES);
    setShowResetConfirmModal(false);
    showToast(isFa ? 'نسخه پشتیبان ایمنی تهیه شد و ساختار سازمانی به حالت استاندارد بازنشانی گردید.' : 'Safety backup created and organizational structure reset to defaults.');
  };

  const handleExportJson = async () => {
    const res = await apiDb.createOrgBackup(['org_hierarchy', 'units_jobs', 'incident_types', 'ppe_equipment']);
    if (res.success && res.data) {
      const jsonStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `${res.data.metadata.backupId}.orgbackup.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast(isFa ? 'نسخه پشتیبان یکپارچه ساختار سازمانی با امضای SHA-256 تهیه و دانلود شد.' : 'Signed organizational backup downloaded.');
    }
  };

  // --- FILTERED NODES ---
  const filteredNodes = useMemo(() => {
    return orgNodes.filter(node => {
      const resolved = resolveManager(node);
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        node.name.toLowerCase().includes(q) ||
        (node.nameEn && node.nameEn.toLowerCase().includes(q)) ||
        (node.code && node.code.toLowerCase().includes(q)) ||
        (node.manager && node.manager.toLowerCase().includes(q)) ||
        (resolved.fullName && resolved.fullName.toLowerCase().includes(q)) ||
        (resolved.personnelCode && resolved.personnelCode.toLowerCase().includes(q)) ||
        (resolved.jobTitle && resolved.jobTitle.toLowerCase().includes(q)) ||
        (node.location && node.location.toLowerCase().includes(q));
      
      const matchType = typeFilter === 'ALL' || node.type === typeFilter;
      const matchStatus = statusFilter === 'ALL' || (node.status || 'active') === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [orgNodes, searchQuery, typeFilter, statusFilter, resolveManager]);

  // Hierarchical tree builder
  const buildTree = (parentId: string | null = null): OrgNode[] => {
    return orgNodes.filter(n => n.parentId === parentId);
  };

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = orgNodes.length;
    const companies = orgNodes.filter(n => n.type === 'Company').length;
    const sites = orgNodes.filter(n => n.type === 'Site').length;
    const plants = orgNodes.filter(n => n.type === 'Plant').length;
    const areas = orgNodes.filter(n => n.type === 'Area').length;
    const depts = orgNodes.filter(n => n.type === 'Department').length;
    const sections = orgNodes.filter(n => n.type === 'Section').length;
    const teams = orgNodes.filter(n => n.type === 'Team').length;
    const totalHeadcount = orgNodes.reduce((sum, n) => sum + (n.headcount || 0), 0);

    return { total, companies, sites, plants, areas, depts, sections, teams, totalHeadcount };
  }, [orgNodes]);

  // Recursive Tree Node Renderer
  const renderTreeNode = (node: OrgNode, level: number = 0) => {
    const children = orgNodes.filter(n => n.parentId === node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? true;
    const typeConfig = ORG_TYPE_LABELS[node.type] || ORG_TYPE_LABELS.Plant;
    const IconComponent = typeConfig.icon;

    // Check if node matches current search / filter
    const isMatched = filteredNodes.some(n => n.id === node.id);
    const hasMatchedChild = children.some(c => filteredNodes.some(fn => fn.id === c.id));

    if (searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL') {
      if (!isMatched && !hasMatchedChild) return null;
    }

    return (
      <div key={node.id} className="relative transition-all">
        {/* Node Box */}
        <div 
          className={`group flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 mb-2.5 shadow-xs ${
            isMatched 
              ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:shadow-md' 
              : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60 opacity-80'
          }`}
          style={{ marginRight: isFa ? `${level * 24}px` : 0, marginLeft: !isFa ? `${level * 24}px` : 0 }}
        >
          {/* Left / Main info */}
          <div className="flex items-start md:items-center gap-3 flex-1">
            {/* Expand / Collapse toggle */}
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="mt-0.5 md:mt-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 hover:text-amber-800 dark:hover:bg-amber-950/50 dark:hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                title={isExpanded ? (isFa ? 'بستن زیرمجموعه‌ها' : 'Collapse') : (isFa ? 'نمایش زیرمجموعه‌ها' : 'Expand')}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className={`w-4 h-4 ${isFa ? 'rotate-180' : ''}`} />}
              </button>
            ) : (
              <div className="w-7 shrink-0 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>
            )}

            {/* Level Icon + Type Badge */}
            <div className={`p-2 rounded-xl border flex items-center justify-center shrink-0 ${typeConfig.badgeBg}`}>
              <IconComponent className="w-4 h-4" />
            </div>

            {/* Titles & Code */}
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100">
                  {node.name}
                </h4>
                {node.code && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                    #{node.code}
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeConfig.badgeBg}`}>
                  {isFa ? typeConfig.fa : typeConfig.en}
                </span>
                {node.status === 'commissioning' && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-blue-300">
                    {isFa ? 'در حال راه‌اندازی' : 'Commissioning'}
                  </span>
                )}
                {node.status === 'inactive' && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300">
                    {isFa ? 'غیرفعال' : 'Inactive'}
                  </span>
                )}
              </div>

              {node.nameEn && (
                <p className="text-[10px] text-slate-400 font-mono tracking-tight">{node.nameEn}</p>
              )}

              {/* Sub-meta details row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                {(node.manager || node.managerPersonnelCode) && (() => {
                  const resolved = resolveManager(node);
                  return (
                    <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/60">
                      <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <strong className="text-slate-800 dark:text-slate-100 font-bold">{resolved.fullName}</strong>
                      {resolved.jobTitle && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                          ({resolved.jobTitle})
                        </span>
                      )}
                      {resolved.personnelCode && (
                        <span className="font-mono text-[9px] bg-white dark:bg-slate-900 px-1.5 py-0.2 rounded text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
                          #{resolved.personnelCode}
                        </span>
                      )}
                    </span>
                  );
                })()}
                {node.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-500" />
                    <span>{node.location}</span>
                  </span>
                )}
                {node.headcount !== undefined && node.headcount > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isFa ? `ظرفیت: ${node.headcount} نفر` : `Cap: ${node.headcount}`}</span>
                  </span>
                )}
                {node.costCenter && (
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <CreditCard className="w-3 h-3 text-indigo-500" />
                    <span>{node.costCenter}</span>
                  </span>
                )}
              </div>

              {node.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 pt-0.5">
                  {node.description}
                </p>
              )}
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-1.5 mt-3 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 shrink-0 self-end md:self-center">
            {/* Quick Add Sub-node */}
            <button
              type="button"
              onClick={() => handleOpenAddModal(node.id, node.type === 'Company' ? 'Site' : node.type === 'Site' ? 'Plant' : node.type === 'Plant' ? 'Area' : node.type === 'Area' ? 'Section' : 'Team')}
              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-emerald-200 dark:border-emerald-800/60"
              title={isFa ? 'افزودن زیرمجموعه به این گره' : 'Add Child Node'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFa ? 'افزودن زیرمجموعه' : 'Add Child'}</span>
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => handleOpenEditModal(node)}
              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition cursor-pointer border border-transparent hover:border-blue-200"
              title={isFa ? 'ویرایش مشخصات ساختار' : 'Edit Node'}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => handleRequestDelete(node)}
              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer border border-transparent hover:border-rose-200"
              title={isFa ? 'حذف ساختار سازمانی' : 'Delete Node'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recursive Children Container */}
        {hasChildren && isExpanded && (
          <div className="relative border-r-2 rtl:border-r-2 rtl:border-l-0 ltr:border-l-2 ltr:border-r-0 border-blue-200 dark:border-blue-900/40 pr-2 rtl:pr-2 ltr:pl-2 pb-1 mr-4 rtl:mr-4 ltr:ml-4">
            {children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootNodes = useMemo(() => {
    return orgNodes.filter(n => !n.parentId || !orgNodes.some(parent => parent.id === n.parentId));
  }, [orgNodes]);

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* --- SECTION 1: TOP KPI CARDS --- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-slate-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50">
          <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
            {isFa ? 'کل ساختارها' : 'Total Units'}
          </span>
          <div className="text-2xl font-black text-indigo-950 dark:text-indigo-100 mt-1 font-mono">
            {metrics.total}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">{isFa ? 'گره سازمانی ثبت‌شده' : 'Registered nodes'}</span>
        </div>

        <div className="bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/40 dark:to-slate-900 p-4 rounded-2xl border border-sky-200 dark:border-sky-900/50">
          <span className="text-[10px] font-black text-sky-700 dark:text-sky-300 uppercase tracking-wider block">
            {isFa ? 'شرکت و سایت‌ها' : 'Sites & Complex'}
          </span>
          <div className="text-2xl font-black text-sky-950 dark:text-sky-100 mt-1 font-mono">
            {metrics.companies + metrics.sites}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">{isFa ? `${metrics.companies} هلدینگ + ${metrics.sites} مجتمع` : `${metrics.companies} Co + ${metrics.sites} Sites`}</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50">
          <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
            {isFa ? 'پلنت‌ها و نواحی' : 'Plants & Areas'}
          </span>
          <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-1 font-mono">
            {metrics.plants + metrics.areas}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">{isFa ? `${metrics.plants} واحد + ${metrics.areas} ناحیه` : 'Active operations'}</span>
        </div>

        <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-slate-900 p-4 rounded-2xl border border-violet-200 dark:border-violet-900/50">
          <span className="text-[10px] font-black text-violet-700 dark:text-violet-300 uppercase tracking-wider block">
            {isFa ? 'ادارات و دپارتمان‌ها' : 'Departments'}
          </span>
          <div className="text-2xl font-black text-violet-950 dark:text-violet-100 mt-1 font-mono">
            {metrics.depts}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">{isFa ? 'واحدهای ستادی و HSE' : 'HQ & Directorates'}</span>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50">
          <span className="text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
            {isFa ? 'بخش‌ها و کارگاه‌ها' : 'Sections & Teams'}
          </span>
          <div className="text-2xl font-black text-rose-950 dark:text-rose-100 mt-1 font-mono">
            {metrics.sections + metrics.teams}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">{isFa ? 'نوبت‌کاری و اپراتوری' : 'Field work teams'}</span>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-slate-900 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50">
          <span className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider block">
            {isFa ? 'ظرفیت پرسنلی' : 'Total Headcount'}
          </span>
          <div className="text-2xl font-black text-amber-950 dark:text-amber-100 mt-1 font-mono">
            {metrics.totalHeadcount.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-500 block mt-0.5">{isFa ? 'نفر ظرفیت سازمانی' : 'Authorized staff'}</span>
        </div>
      </div>

      {/* --- SECTION 2: CONTROL TOOLBAR --- */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Main Search */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 right-0 pr-3 rtl:pr-3 ltr:left-0 ltr:right-auto ltr:pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isFa ? 'جستجو در ساختار سازمانی (نام، کد شناسایی، مدیر، موقعیت مکانی)...' : 'Search organization units (Name, code, manager, location)...'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 rtl:pr-9 ltr:pl-9 ltr:pr-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-0 pl-3 rtl:left-0 rtl:pl-3 ltr:right-0 ltr:pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Level Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">{isFa ? 'همه سطوح سازمانی' : 'All Org Levels'}</option>
            <option value="Company">{isFa ? '🏢 شرکت مادر / هلدینگ' : 'Company'}</option>
            <option value="Site">{isFa ? '🏗️ سایت / مجتمع پتروشیمی' : 'Site / Complex'}</option>
            <option value="Plant">{isFa ? '🏭 واحد اصلی / پلنت (Plant)' : 'Plant'}</option>
            <option value="Area">{isFa ? '📦 ناحیه عملیاتی / زون' : 'Area / Zone'}</option>
            <option value="Department">{isFa ? '💼 دپارتمان / اداره کل' : 'Department'}</option>
            <option value="Section">{isFa ? '⚙️ بخش / کارگاه / آزمایشگاه' : 'Section'}</option>
            <option value="Team">{isFa ? '👥 تیم اجرایی / نوبت‌کار' : 'Team / Shift'}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
            <option value="active">{isFa ? '✅ فعال و در حال بهره‌برداری' : 'Active'}</option>
            <option value="commissioning">{isFa ? '⚠️ در حال راه‌اندازی' : 'Commissioning'}</option>
            <option value="inactive">{isFa ? '⛔ غیرفعال' : 'Inactive'}</option>
          </select>

          {/* View mode buttons */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'tree' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isFa ? 'نمای سلسله‌مراتب درختی' : 'Tree View'}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>{isFa ? 'نمای درختی' : 'Tree'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'grid' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isFa ? 'نمای کارتی' : 'Cards Grid'}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isFa ? 'کارت‌ها' : 'Cards'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title={isFa ? 'نمای جدولی' : 'Table View'}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isFa ? 'جدول' : 'Table'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {/* Primary Add New Org Structure Button */}
            <button
              type="button"
              onClick={() => handleOpenAddModal(null, 'Plant')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'تعریف ساختار سازمانی جدید' : 'Define New Org Structure'}</span>
            </button>

            {viewMode === 'tree' && (
              <>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>{isFa ? 'باز کردن همه شاخه‌ها' : 'Expand All'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{isFa ? 'بستن همه شاخه‌ها' : 'Collapse All'}</span>
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenBackupRestore && (
              <button
                type="button"
                onClick={onOpenBackupRestore}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                title={isFa ? 'مدیریت کامل پشتیبان‌گیری و بازیابی انتخابی زیرتب‌های ساختار سازمانی' : 'Backup & Restore Manager'}
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>{isFa ? 'مرکز پشتیبان‌گیری و بازیابی ساختار' : 'Backup & Restore'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
              title={isFa ? 'دانلود فوری فایل پشتیبان یکپارچه ساختار سازمانی (JSON)' : 'Quick Export JSON'}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFa ? 'دانلود سریع پشتیبان (JSON)' : 'Export'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetToSeeds}
              className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
              title={isFa ? 'بازنشانی به ساختار پیش‌فرض' : 'Reset to Defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFa ? 'بازنشانی' : 'Reset'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION 3: VIEW RENDERERS --- */}
      
      {/* 1. TREE VIEW */}
      {viewMode === 'tree' && (
        <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-amber-500" />
              <span>{isFa ? 'چارت و سلسله‌مراتب درختی واحدهای سازمانی' : 'Hierarchical Organizational Tree Chart'}</span>
            </h4>
            <span className="text-[11px] font-bold text-slate-400">
              {isFa ? `نمایش ${filteredNodes.length} واحد از کل ${orgNodes.length}` : `Showing ${filteredNodes.length} of ${orgNodes.length}`}
            </span>
          </div>

          {rootNodes.length > 0 ? (
            <div className="space-y-1 pt-2">
              {rootNodes.map(rootNode => renderTreeNode(rootNode, 0))}
            </div>
          ) : (
            <div className="text-center py-12 space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-bold">
                {isFa ? 'هیچ گره یا ساختار سازمانی یافت نشد.' : 'No organizational structures found.'}
              </p>
              <button
                type="button"
                onClick={() => handleOpenAddModal(null, 'Company')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'تعریف اولین گره سازمانی' : 'Define First Org Node'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. CARDS GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNodes.map(node => {
            const typeConfig = ORG_TYPE_LABELS[node.type] || ORG_TYPE_LABELS.Plant;
            const IconComponent = typeConfig.icon;
            const parent = orgNodes.find(p => p.id === node.parentId);
            const children = orgNodes.filter(c => c.parentId === node.id);

            return (
              <div 
                key={node.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 hover:border-blue-400 transition-all shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${typeConfig.badgeBg}`}>
                      <IconComponent className="w-3.5 h-3.5" />
                      <span>{isFa ? typeConfig.fa : typeConfig.en}</span>
                    </span>
                    {node.code && (
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md border">
                        #{node.code}
                      </span>
                    )}
                  </div>

                  {/* Title & Parent path */}
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      {node.name}
                    </h4>
                    {node.nameEn && (
                      <p className="text-[10px] text-slate-400 font-mono">{node.nameEn}</p>
                    )}
                    {parent && (
                      <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-1">
                        <span>{isFa ? 'والد:' : 'Parent:'}</span>
                        <strong className="text-slate-600 dark:text-slate-300">{parent.name}</strong>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                    {(node.manager || node.managerPersonnelCode) && (() => {
                      const resolved = resolveManager(node);
                      return (
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] text-slate-400 shrink-0">{isFa ? 'مسئول / مدیر:' : 'Manager:'}</span>
                          <div className="text-left font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1 truncate">
                            <span className="truncate">{resolved.fullName}</span>
                            {resolved.jobTitle && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal truncate">
                                ({resolved.jobTitle})
                              </span>
                            )}
                            {resolved.personnelCode && (
                              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 shrink-0">
                                #{resolved.personnelCode}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    {node.location && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{isFa ? 'موقعیت:' : 'Location:'}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">{node.location}</span>
                      </div>
                    )}
                    {node.headcount !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{isFa ? 'ظرفیت پرسنلی:' : 'Capacity:'}</span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{node.headcount} نفر</span>
                      </div>
                    )}
                    {node.costCenter && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{isFa ? 'مرکز هزینه:' : 'Cost Center:'}</span>
                        <span className="font-mono text-[10px] text-slate-500">{node.costCenter}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer action bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold">
                    {children.length > 0 ? (isFa ? `${children.length} زیرمجموعه` : `${children.length} children`) : (isFa ? 'بدون زیرمجموعه' : 'Leaf node')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenAddModal(node.id)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                      title={isFa ? 'افزودن زیرمجموعه' : 'Add Child'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(node)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                      title={isFa ? 'ویرایش' : 'Edit'}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRequestDelete(node)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title={isFa ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <div className="w-full overflow-x-auto custom-scrollbar"><table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-black border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">{isFa ? 'سطح سازمانی' : 'Level'}</th>
                  <th className="p-3.5">{isFa ? 'کد واحد' : 'Code'}</th>
                  <th className="p-3.5">{isFa ? 'نام ساختار سازمانی' : 'Organization Unit Name'}</th>
                  <th className="p-3.5">{isFa ? 'واحد بالادست (والد)' : 'Parent Unit'}</th>
                  <th className="p-3.5">{isFa ? 'مدیر / مسئول' : 'Manager'}</th>
                  <th className="p-3.5">{isFa ? 'موقعیت فیزیکی' : 'Location'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'ظرفیت' : 'Cap'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'وضعیت' : 'Status'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                {filteredNodes.length > 0 ? (
                  filteredNodes.map(node => {
                    const typeConfig = ORG_TYPE_LABELS[node.type] || ORG_TYPE_LABELS.Plant;
                    const IconComponent = typeConfig.icon;
                    const parent = orgNodes.find(p => p.id === node.parentId);

                    return (
                      <tr key={node.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black border ${typeConfig.badgeBg}`}>
                            <IconComponent className="w-3 h-3" />
                            <span>{isFa ? typeConfig.fa.split(' ')[0] : node.type}</span>
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-500">
                          {node.code || '—'}
                        </td>
                        <td className="p-3.5">
                          <div className="font-black text-slate-900 dark:text-slate-100">{node.name}</div>
                          {node.nameEn && <div className="text-[10px] text-slate-400 font-mono">{node.nameEn}</div>}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300 text-[11px]">
                          {parent ? parent.name : <span className="text-slate-400 italic">{isFa ? 'ریشه اصلی (Root)' : 'Root'}</span>}
                        </td>
                        <td className="p-3.5 text-slate-800 dark:text-slate-200">
                          {(() => {
                            const resolved = resolveManager(node);
                            return resolved.fullName ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold">{resolved.fullName}</span>
                                {resolved.jobTitle && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    ({resolved.jobTitle})
                                  </span>
                                )}
                                {resolved.personnelCode && (
                                  <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                                    #{resolved.personnelCode}
                                  </span>
                                )}
                              </div>
                            ) : (
                              '—'
                            );
                          })()}
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px]">
                          {node.location || '—'}
                        </td>
                        <td className="p-3.5 text-center font-mono text-emerald-600 dark:text-emerald-400">
                          {node.headcount || 0}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            node.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            node.status === 'commissioning' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {node.status === 'active' ? (isFa ? 'فعال' : 'Active') :
                             node.status === 'commissioning' ? (isFa ? 'راه‌اندازی' : 'Comm.') : (isFa ? 'غیرفعال' : 'Inactive')}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenAddModal(node.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition cursor-pointer"
                              title={isFa ? 'افزودن زیرمجموعه' : 'Add Child'}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(node)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition cursor-pointer"
                              title={isFa ? 'ویرایش' : 'Edit'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDelete(node)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title={isFa ? 'حذف' : 'Delete'}
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
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      {isFa ? 'هیچ رکوردی منطبق با فیلترها یافت نشد.' : 'No records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE / EDIT ORG STRUCTURE --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">
                    {editingNode ? (isFa ? `ویرایش ساختار سازمانی: ${editingNode.name}` : `Edit Org Structure: ${editingNode.name}`) : (isFa ? 'تعریف ساختار سازمانی جدید' : 'Define New Organization Structure')}
                  </h3>
                  <p className="text-[11px] font-bold text-blue-100">
                    {isFa ? 'ثبت و پیوند واحدهای عملیاتی، سایت‌ها، پلنت‌ها، دپارتمان‌ها و شیفت‌های مجتمع' : 'Register organizational entities, plants, areas, and teams'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Name FA */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    {isFa ? 'نام ساختار سازمانی (عنوان فارسی) *' : 'Organization Name (FA) *'}
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={isFa ? 'مثلاً: واحد فرآیندی الفین ۳، اداره HSE، ناحیه مخازن...' : 'e.g., Olefin III Plant'}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* 2. Name EN */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    {isFa ? 'نام انگلیسی / عنوان بین‌المللی' : 'Organization Title (EN)'}
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="e.g. Olefin III Production Plant"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* 3. Level / Type */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    {isFa ? 'سطح و رده ساختار سازمانی *' : 'Org Level / Classification *'}
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as OrgNode['type'] })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Company">{isFa ? '🏢 شرکت مادر / هلدینگ (Company)' : 'Company / Holding'}</option>
                    <option value="Site">{isFa ? '🏗️ سایت / مجتمع پتروشیمی (Site)' : 'Site / Petrochemical Complex'}</option>
                    <option value="Plant">{isFa ? '🏭 کارخانه / واحد اصلی (Plant)' : 'Plant / Main Production'}</option>
                    <option value="Area">{isFa ? '📦 ناحیه عملیاتی / زون فرآیندی (Area)' : 'Area / Operating Zone'}</option>
                    <option value="Department">{isFa ? '💼 دپارتمان / اداره کل ستادی (Department)' : 'Department / Directorate'}</option>
                    <option value="Section">{isFa ? '⚙️ بخش / کارگاه / آزمایشگاه (Section)' : 'Section / Workshop / Lab'}</option>
                    <option value="Team">{isFa ? '👥 تیم اجرایی / نوبت‌کار / شیفت (Team)' : 'Team / Shift Crew'}</option>
                  </select>
                </div>

                {/* 4. Parent Node Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    {isFa ? 'واحد بالادست (والد در چارت سازمانی)' : 'Parent Organization Node'}
                  </label>
                  <select
                    value={formData.parentId || ''}
                    onChange={e => setFormData({ ...formData, parentId: e.target.value ? e.target.value : null })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">{isFa ? '— ریشه اصلی سازمان (بدون والد) —' : '— Corporate Root (No Parent) —'}</option>
                    {orgNodes
                      .filter(n => !editingNode || n.id !== editingNode.id)
                      .map(n => (
                        <option key={n.id} value={n.id}>
                          [{n.type}] {n.name} {n.code ? `(#${n.code})` : ''}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 5. Code */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    {isFa ? 'کد شناسایی ساختاری (Org Code)' : 'Structural Code'}
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. PL-OLF-03"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* 6. Manager / Supervisor (Directly connected to Complex Master Personnel Data) */}
                <div className="space-y-1">
                  <CentralPersonnelSelector
                    isFa={isFa}
                    label={isFa ? 'مدیر / سرپرست / مسئول واحد' : 'Manager / Supervisor'}
                    selectedPersonnelCode={formData.managerPersonnelCode || ''}
                    value={formData.manager ? (formData.managerPersonnelCode ? `${formData.manager} (${formData.managerPersonnelCode})` : formData.manager) : ''}
                    compact={true}
                    showOrgBadges={false}
                    placeholder={isFa ? 'جستجو در پرسنل مجتمع با نام، کد پرسنلی یا سمت...' : 'Search by name, code, national ID or title...'}
                    helperText={isFa ? 'اتصال مستقیم به ماژول اطلاعات پرسنل مجتمع در پایگاه داده اصلی' : 'Direct live connection to Master Personnel in database'}
                    onSelectPersonnel={(person) => {
                      if (person) {
                        setFormData(prev => ({
                          ...prev,
                          manager: person.fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || '',
                          managerPersonnelCode: person.effectiveCode || person.personnelCode || '',
                          managerPersonnelId: person.id ? Number(person.id) : null,
                          managerJobTitle: person.jobTitle || person.position || '',
                          managerNationalCode: person.nationalCode || ''
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          manager: '',
                          managerPersonnelCode: '',
                          managerPersonnelId: null,
                          managerJobTitle: '',
                          managerNationalCode: ''
                        }));
                      }
                    }}
                  />
                  {formData.manager && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-[11px] animate-in fade-in-50">
                      <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-bold truncate">
                        <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{formData.manager}</span>
                        {formData.managerJobTitle && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal truncate">
                            ({formData.managerJobTitle})
                          </span>
                        )}
                      </div>
                      {formData.managerPersonnelCode && (
                        <span className="font-mono text-[10px] bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
                          #{formData.managerPersonnelCode}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 7. Location */}
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                    {isFa ? 'موقعیت فیزیکی / ساختمان / زون' : 'Physical Location / Zone'}
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder={isFa ? 'مثلاً: سایت شمالی، ساختمان کنترل مرکزی، اسکله ۲...' : 'e.g. North Site, Zone B'}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                {/* 8. Headcount & Cost Center */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                      {isFa ? 'ظرفیت پرسنلی' : 'Headcount'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.headcount}
                      onChange={e => setFormData({ ...formData, headcount: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-center font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                      {isFa ? 'مرکز هزینه' : 'Cost Center'}
                    </label>
                    <input
                      type="text"
                      value={formData.costCenter}
                      onChange={e => setFormData({ ...formData, costCenter: e.target.value })}
                      placeholder="CC-101"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* 9. Operational Status */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                  {isFa ? 'وضعیت عملیاتی واحد' : 'Operational Status'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'active' })}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      formData.status === 'active' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs' 
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isFa ? 'فعال و بهره‌برداری' : 'Active'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'commissioning' })}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      formData.status === 'commissioning' 
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-blue-500 text-amber-700 dark:text-amber-300 shadow-xs' 
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{isFa ? 'در حال راه‌اندازی' : 'Commissioning'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'inactive' })}
                    className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      formData.status === 'inactive' 
                        ? 'bg-slate-200 dark:bg-slate-700 border-slate-400 text-slate-900 dark:text-slate-100 shadow-xs' 
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{isFa ? 'غیرفعال / بایگانی' : 'Inactive'}</span>
                  </button>
                </div>
              </div>

              {/* 10. Description & HSE Scope */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                  {isFa ? 'شرح وظایف، مأموریت و الزامات ایمنی و HSE واحد' : 'Description & HSE Mission'}
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder={isFa ? 'شرح مختصری از فرآیندها، حیطه مسئولیت و مخاطرات کلیدی واحد...' : 'Brief description of processes and safety scopes...'}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition resize-none"
                />
              </div>

              {/* Sticky Action Footer inside Modal */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingNode ? (isFa ? 'ذخیره تغییرات ساختار' : 'Save Changes') : (isFa ? 'ثبت و تعریف ساختار سازمانی' : 'Create Org Structure')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-950/50 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                  {isFa ? 'تأیید حذف ساختار سازمانی' : 'Confirm Org Node Deletion'}
                </h4>
                <span className="text-[11px] text-slate-400">{deleteConfirm.node.name}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
              {isFa ? (
                <>
                  آیا از حذف واحد سازمانی <strong className="text-slate-900 dark:text-slate-100">«{deleteConfirm.node.name}»</strong> اطمینان دارید؟
                  {deleteConfirm.childCount > 0 && (
                    <span className="block mt-2 p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-700 dark:text-rose-300 font-extrabold text-[11px] border border-rose-200 dark:border-rose-900/50">
                      ⚠️ هشدار مهم: این ساختار دارای {deleteConfirm.childCount} زیرمجموعه تابعه است که آن‌ها نیز حذف خواهند شد.
                    </span>
                  )}
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-100">"{deleteConfirm.node.name}"</strong>?
                  {deleteConfirm.childCount > 0 && (
                    <span className="block mt-2 p-2 bg-rose-50 rounded-xl text-rose-700 font-bold text-[11px]">
                      Warning: {deleteConfirm.childCount} sub-units will also be deleted.
                    </span>
                  )}
                </>
              )}
            </p>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isFa ? 'حذف قطعی' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600 border-b border-slate-100 dark:border-slate-800 pb-3">
              <RotateCcw className="w-6 h-6" />
              <h4 className="font-black text-sm text-slate-900 dark:text-slate-100">
                {isFa ? 'تأیید بازنشانی به ساختار پیش‌فرض' : 'Confirm Reset to Defaults'}
              </h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
              {isFa
                ? 'پیش از بازنشانی، یک نسخه پشتیبان ایمنی خودکار از ساختار فعلی شما در سرور ذخیره می‌شود تا در هر زمان قابل بازگردانی باشد. آیا ادامه می‌دهید؟'
                : 'A safety backup will be created before resetting to default nodes. Proceed?'}
            </p>
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmResetToSeeds}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl"
              >
                {isFa ? 'تأیید و بازنشانی ایمن' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
