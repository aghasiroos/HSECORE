import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Info, 
  CheckSquare, 
  Square, 
  Search, 
  Check, 
  ShieldCheck, 
  UserCheck, 
  Lock, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  LayoutDashboard,
  SunMedium,
  Activity,
  BarChart3,
  Flame,
  Leaf,
  Stethoscope,
  FileCheck,
  ClipboardCheck,
  CheckCheck,
  AlertTriangle,
  HardHat,
  Zap,
  GraduationCap,
  FileWarning,
  FileText,
  Users,
  Network,
  Palette,
  Database,
  Bell,
  Globe,
  Shield,
  Workflow,
  Building2,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Filter,
  AlertCircle,
  RefreshCw,
  Layers,
  Truck,
  Droplets,
  Gauge,
  HeartPulse,
  Recycle,
  Inbox,
  FolderOpen,
  Minus
} from 'lucide-react';
import { 
  UserProfile, 
  PermissionGroup, 
  PermissionActions, 
  HierarchicalActionKey, 
  HierarchicalPermissionNode, 
  UserPermissions 
} from '../../types';
import { 
  PERMISSION_MODULES_REGISTRY, 
  HIERARCHICAL_ACTION_LABELS,
  HIERARCHICAL_PERMISSION_NODES,
  STANDARD_ROLE_PRESETS,
  RolePresetInfo,
  createPermissionsSet, 
  createRolePresetPermissions,
  getEffectiveUserPermissions,
  validatePermissionDependencies,
  getDefaultPermissionsForRole
} from '../../utils/authHelper';

interface PermissionsMatrixTabProps {
  users: UserProfile[];
  currentUser: UserProfile;
  selectedUser: UserProfile | null;
  isFa: boolean;
  onSelectUser: (user: UserProfile) => void;
  onUpdateUserPermissions: (userId: string, permissions: UserPermissions | Record<string, any>) => void;
  onDeleteUser?: (id: string, name: string) => void;
}

const ACTION_COLUMNS: HierarchicalActionKey[] = [
  'view',
  'details',
  'create',
  'edit',
  'delete',
  'approve',
  'reject',
  'sign',
  'refer',
  'export',
  'print',
  'import',
  'emergency',
  'configure'
];

export const PermissionsMatrixTab: React.FC<PermissionsMatrixTabProps> = ({
  users,
  currentUser,
  selectedUser,
  isFa,
  onSelectUser,
  onUpdateUserPermissions,
  onDeleteUser
}) => {
  const [matrixSearch, setMatrixSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'OVERRIDES_ONLY' | 'ACTIVE_ONLY' | 'CONFLICTS_ONLY'>('ALL');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    dashboards: true,
    departments: true,
    safety: true,
    incidents_compliance: true,
    human_capital: true,
    workflows: true,
    system: true
  });
  const [saveToast, setSaveToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [lastAppliedPreset, setLastAppliedPreset] = useState<string | null>(null);

  const isSelectedAdmin = selectedUser?.role === 'Administrator' || selectedUser?.role === 'admin';
  const isCurrentAdmin = currentUser?.role === 'Administrator';

  // Grouped Categories (7 primary categories matching authoritative HSECORE architecture)
  const categoriesList = useMemo(() => [
    { key: 'dashboards', titleFa: 'داشبوردها و تحلیل‌های آماری', titleEn: 'Dashboards & KPI Analytics' },
    { key: 'departments', titleFa: 'دپارتمان‌های تخصصی HSE', titleEn: 'Specialized HSE Departments' },
    { key: 'safety', titleFa: 'مجوزهای کار و کنترل ریسک', titleEn: 'Safety Operations & Risk' },
    { key: 'incidents_compliance', titleFa: 'رویدادها و انضباط ایمنی', titleEn: 'Incidents & Compliance' },
    { key: 'human_capital', titleFa: 'سرمایه انسانی و آموزش', titleEn: 'Human Capital & Training' },
    { key: 'workflows', titleFa: 'کارتابل و فرآیندهای سازمانی', titleEn: 'Workflows & Digital Workplace' },
    { key: 'system', titleFa: 'مدیریت و پیکربندی سامانه', titleEn: 'System Administration & Security' }
  ], []);

  // Compute effective permissions, role preset baseline, and custom overrides
  const effectiveData = useMemo(() => {
    return getEffectiveUserPermissions(selectedUser);
  }, [selectedUser]);

  // Compute validation warnings & dependencies
  const dependencyWarnings = useMemo(() => {
    if (!selectedUser || isSelectedAdmin) return [];
    return validatePermissionDependencies(effectiveData.effectivePermissions);
  }, [selectedUser, effectiveData.effectivePermissions, isSelectedAdmin]);

  // Total applicable slots
  const totalApplicableSlots = useMemo(() => {
    return HIERARCHICAL_PERMISSION_NODES.reduce((acc, node) => acc + node.applicableActions.length, 0);
  }, []);

  const activePercentage = useMemo(() => {
    if (!totalApplicableSlots) return 0;
    return Math.min(100, Math.round((effectiveData.totalActiveCount / totalApplicableSlots) * 100));
  }, [effectiveData.totalActiveCount, totalApplicableSlots]);

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    const q = matrixSearch.toLowerCase().trim();
    const conflictNodeIds = new Set(dependencyWarnings.map(w => w.nodeId));

    return HIERARCHICAL_PERMISSION_NODES.filter(n => {
      // 1. Text search
      const matchesSearch = !q ||
        n.titleFa.toLowerCase().includes(q) ||
        n.titleEn.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        n.descriptionFa.toLowerCase().includes(q) ||
        (n.legacyId && n.legacyId.toLowerCase().includes(q));

      // 2. Category filter
      const matchesCat = categoryFilter === 'ALL' || n.category === categoryFilter;

      // 3. Scope filter
      let matchesScope = true;
      if (scopeFilter === 'OVERRIDES_ONLY') {
        matchesScope = Boolean(effectiveData.customOverrides[n.id]);
      } else if (scopeFilter === 'ACTIVE_ONLY') {
        const nodePerms = effectiveData.effectivePermissions[n.id] as Record<string, boolean> | undefined;
        matchesScope = Boolean(nodePerms && Object.values(nodePerms).some(Boolean));
      } else if (scopeFilter === 'CONFLICTS_ONLY') {
        matchesScope = conflictNodeIds.has(n.id);
      }

      return matchesSearch && matchesCat && matchesScope;
    });
  }, [matrixSearch, categoryFilter, scopeFilter, dependencyWarnings, effectiveData]);

  // Helper for node icon
  const renderNodeIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard className="w-4 h-4 text-sky-500" />;
      case 'SunMedium': return <SunMedium className="w-4 h-4 text-orange-500" />;
      case 'Activity': return <Activity className="w-4 h-4 text-rose-500" />;
      case 'BarChart3': return <BarChart3 className="w-4 h-4 text-indigo-500" />;
      case 'ShieldAlert': return <ShieldAlert className="w-4 h-4 text-amber-600" />;
      case 'ClipboardCheck': return <ClipboardCheck className="w-4 h-4 text-blue-500" />;
      case 'Flame': return <Flame className="w-4 h-4 text-rose-500" />;
      case 'Truck': return <Truck className="w-4 h-4 text-rose-600" />;
      case 'Droplets': return <Droplets className="w-4 h-4 text-cyan-500" />;
      case 'Gauge': return <Gauge className="w-4 h-4 text-amber-500" />;
      case 'HeartPulse': return <HeartPulse className="w-4 h-4 text-teal-500" />;
      case 'Stethoscope': return <Stethoscope className="w-4 h-4 text-teal-600" />;
      case 'Leaf': return <Leaf className="w-4 h-4 text-emerald-500" />;
      case 'Recycle': return <Recycle className="w-4 h-4 text-emerald-600" />;
      case 'CheckSquare': return <CheckSquare className="w-4 h-4 text-emerald-500" />;
      case 'FileCheck': return <FileCheck className="w-4 h-4 text-amber-500" />;
      case 'CheckCheck': return <CheckCheck className="w-4 h-4 text-emerald-600" />;
      case 'Zap': return <Zap className="w-4 h-4 text-purple-500" />;
      case 'HardHat': return <HardHat className="w-4 h-4 text-sky-500" />;
      case 'AlertTriangle': return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'FileWarning': return <FileWarning className="w-4 h-4 text-red-500" />;
      case 'UserCheck': return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case 'GraduationCap': return <GraduationCap className="w-4 h-4 text-teal-500" />;
      case 'Inbox': return <Inbox className="w-4 h-4 text-indigo-500" />;
      case 'FolderOpen': return <FolderOpen className="w-4 h-4 text-indigo-600" />;
      case 'Workflow': return <Workflow className="w-4 h-4 text-violet-500" />;
      case 'Bell': return <Bell className="w-4 h-4 text-amber-500" />;
      case 'Users': return <Users className="w-4 h-4 text-slate-500" />;
      case 'Network': return <Network className="w-4 h-4 text-cyan-600" />;
      case 'Palette': return <Palette className="w-4 h-4 text-pink-500" />;
      case 'Database': return <Database className="w-4 h-4 text-indigo-500" />;
      case 'ShieldCheck': return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'Globe': return <Globe className="w-4 h-4 text-sky-600" />;
      case 'Sliders': return <Sliders className="w-4 h-4 text-slate-500" />;
      default: return <Shield className="w-4 h-4 text-slate-400" />;
    }
  };

  const triggerToast = (msg: string) => {
    setSaveToast({ show: true, message: msg });
    setTimeout(() => setSaveToast({ show: false, message: '' }), 3500);
  };

  // Toggle single action on a hierarchical node
  const handleToggleAction = (nodeId: string, action: HierarchicalActionKey) => {
    if (!selectedUser) return;
    if (!isCurrentAdmin) {
      alert(isFa ? 'تنها مدیر ارشد مجاز به ویرایش دسترسی‌های کاربران است.' : 'Only Administrator is authorized to modify user permissions.');
      return;
    }
    if (isSelectedAdmin) {
      alert(isFa 
        ? 'کاربر مدیر ارشد (Administrator) به صورت پیش‌فرض دسترسی نامحدود ریشه‌ای دارد.' 
        : 'Administrator has absolute full access.');
      return;
    }

    const currentPerms: Record<string, any> = { ...(selectedUser.permissions || {}) };
    const currentVal = effectiveData.effectivePermissions[nodeId]?.[action] ?? false;
    const newVal = !currentVal;

    const nodePerms: Record<string, boolean> = {
      ...(currentPerms[nodeId] || effectiveData.rolePresetPermissions[nodeId] || {})
    };
    nodePerms[action] = newVal;
    currentPerms[nodeId] = nodePerms;

    // Sync legacy mapping if applicable
    const nodeMeta = HIERARCHICAL_PERMISSION_NODES.find(n => n.id === nodeId);
    if (nodeMeta?.legacyId) {
      const legPerms = { ...(currentPerms[nodeMeta.legacyId] || {}) };
      legPerms[action] = newVal;
      currentPerms[nodeMeta.legacyId] = legPerms;
    }

    onUpdateUserPermissions(selectedUser.id, currentPerms);
  };

  // Node Row Quick Action
  const handleNodeAction = (node: HierarchicalPermissionNode, actionType: 'all_on' | 'readonly' | 'all_off') => {
    if (!selectedUser || !isCurrentAdmin || isSelectedAdmin) return;

    const currentPerms: Record<string, any> = { ...(selectedUser.permissions || {}) };
    const nodePerms: Record<string, boolean> = { ...(currentPerms[node.id] || {}) };

    node.applicableActions.forEach(action => {
      if (actionType === 'all_on') {
        nodePerms[action] = true;
      } else if (actionType === 'readonly') {
        nodePerms[action] = action === 'view' || action === 'details' || action === 'export' || action === 'print';
      } else {
        nodePerms[action] = false;
      }
    });

    currentPerms[node.id] = nodePerms;
    if (node.legacyId) {
      const legPerms = { ...(currentPerms[node.legacyId] || {}) };
      node.applicableActions.forEach(a => {
        legPerms[a] = nodePerms[a];
      });
      currentPerms[node.legacyId] = legPerms;
    }

    onUpdateUserPermissions(selectedUser.id, currentPerms);
    triggerToast(isFa ? `مجوزهای ماژول «${node.titleFa}» به‌روزرسانی شد.` : `Updated permissions for ${node.titleEn}`);
  };

  // Category Bulk Action
  const handleCategoryAction = (catKey: string, actionType: 'all_on' | 'readonly' | 'all_off') => {
    if (!selectedUser || !isCurrentAdmin || isSelectedAdmin) return;

    const currentPerms: Record<string, any> = { ...(selectedUser.permissions || {}) };
    const targetNodes = HIERARCHICAL_PERMISSION_NODES.filter(n => n.category === catKey);

    targetNodes.forEach(node => {
      const nodePerms: Record<string, boolean> = { ...(currentPerms[node.id] || {}) };
      node.applicableActions.forEach(action => {
        if (actionType === 'all_on') {
          nodePerms[action] = true;
        } else if (actionType === 'readonly') {
          nodePerms[action] = action === 'view' || action === 'details' || action === 'export' || action === 'print';
        } else {
          nodePerms[action] = false;
        }
      });
      currentPerms[node.id] = nodePerms;
      if (node.legacyId) {
        currentPerms[node.legacyId] = { ...(currentPerms[node.legacyId] || {}), ...nodePerms };
      }
    });

    onUpdateUserPermissions(selectedUser.id, currentPerms);
    triggerToast(isFa ? 'تغییرات گروهی بخش با موفقیت اعمال شد.' : 'Category bulk action applied.');
  };

  // Column Action Toggle across all currently filtered nodes
  const handleColumnToggle = (actionKey: HierarchicalActionKey) => {
    if (!selectedUser || !isCurrentAdmin || isSelectedAdmin) return;

    const currentPerms: Record<string, any> = { ...(selectedUser.permissions || {}) };
    const applicableNodes = filteredNodes.filter(n => n.applicableActions.includes(actionKey));

    if (applicableNodes.length === 0) return;

    const allCurrentlyEnabled = applicableNodes.every(n => {
      return Boolean(effectiveData.effectivePermissions[n.id]?.[actionKey]);
    });

    const targetVal = !allCurrentlyEnabled;

    applicableNodes.forEach(n => {
      const p = { ...(currentPerms[n.id] || effectiveData.effectivePermissions[n.id] || {}) };
      p[actionKey] = targetVal;
      currentPerms[n.id] = p;
      if (n.legacyId) {
        const leg = { ...(currentPerms[n.legacyId] || {}) };
        leg[actionKey] = targetVal;
        currentPerms[n.legacyId] = leg;
      }
    });

    onUpdateUserPermissions(selectedUser.id, currentPerms);
    triggerToast(isFa 
      ? `ستون «${HIERARCHICAL_ACTION_LABELS[actionKey]?.titleFa || actionKey}» ${targetVal ? 'برای کلیه ماژول‌های فیلترشده فعال شد.' : 'غیرفعال گردید.'}`
      : `Column ${actionKey} toggled.`);
  };

  // Apply Role Preset
  const handleApplyPreset = (presetId: RolePresetInfo['id']) => {
    if (!selectedUser || !isCurrentAdmin) return;
    const presetMeta = STANDARD_ROLE_PRESETS.find(p => p.id === presetId);
    const newPerms = createRolePresetPermissions(presetId);
    onUpdateUserPermissions(selectedUser.id, newPerms);
    setLastAppliedPreset(presetId);
    triggerToast(isFa 
      ? `قالب استاندارد نقش «${presetMeta?.titleFa || presetId}» اعمال شد.` 
      : `Preset ${presetMeta?.titleEn || presetId} applied.`);
  };

  // Reset to Role Baseline (Clear all custom overrides)
  const handleResetToRoleDefaults = () => {
    if (!selectedUser || !isCurrentAdmin || isSelectedAdmin) return;
    const baseline = getDefaultPermissionsForRole(selectedUser.role);
    onUpdateUserPermissions(selectedUser.id, baseline);
    triggerToast(isFa 
      ? `کلیه دسترسی‌های اختصاصی لغو و مجوزها به قالب استاندارد نقش «${selectedUser.role}» بازنشانی شد.` 
      : 'Restored to baseline role permissions.');
  };

  // Auto-Fix Missing Dependencies
  const handleAutoFixDependencies = () => {
    if (!selectedUser || !isCurrentAdmin || isSelectedAdmin) return;
    const currentPerms: Record<string, any> = { ...(selectedUser.permissions || {}) };

    dependencyWarnings.forEach(w => {
      const nodePerms = { ...(currentPerms[w.nodeId] || effectiveData.effectivePermissions[w.nodeId] || {}) };
      nodePerms[w.suggestedAction] = true;
      currentPerms[w.nodeId] = nodePerms;

      const nodeMeta = HIERARCHICAL_PERMISSION_NODES.find(n => n.id === w.nodeId);
      if (nodeMeta?.legacyId) {
        const leg = { ...(currentPerms[nodeMeta.legacyId] || {}) };
        leg[w.suggestedAction] = true;
        currentPerms[nodeMeta.legacyId] = leg;
      }
    });

    onUpdateUserPermissions(selectedUser.id, currentPerms);
    triggerToast(isFa ? 'کلیه وابستگی‌های ناقص (مجوزهای مشاهده) به طور خودکار اصلاح و فعال شدند.' : 'Dependencies auto-fixed.');
  };

  // Expand / Collapse all
  const handleToggleExpandAll = (expand: boolean) => {
    const updated: Record<string, boolean> = {};
    categoriesList.forEach(c => {
      updated[c.key] = expand;
    });
    setExpandedCategories(updated);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Title Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <SlidersHorizontal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {isFa ? 'ماتریس سلسله‌مراتبی مجوزها و سطوح دسترسی (RBAC)' : 'Hierarchical Permissions Matrix (RBAC)'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                {isFa ? 'مبتنی بر درخت ماژول‌ها' : 'Tree Architecture'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {isFa 
                ? 'پیکربندی ریزدانه و سلسه‌مراتبی دسترسی‌ها از سطح دپارتمان تا زیرماژول‌ها، تب‌ها و عملیات مجاز. کلیه تغییرات بدون واسطه در دیتابیس مرکزی ثبت و در سرور اعمال می‌گردد.'
                : 'Configure hierarchical fine-grained permissions across all submodules, tabs and operations with server-side validation.'}
            </p>
          </div>
        </div>

        {/* Global Action Pills */}
        {selectedUser && !isSelectedAdmin && isCurrentAdmin && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const full = createPermissionsSet(true);
                onUpdateUserPermissions(selectedUser.id, full);
                triggerToast(isFa ? 'دسترسی کامل به تمامی بخش‌ها اعطا شد.' : 'Full access granted.');
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isFa ? 'دسترسی کامل' : 'Grant All'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetToRoleDefaults}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              title={isFa ? 'حذف کلیه دسترسی‌های اختصاصی و بازگشت به قالب نقش' : 'Reset to role defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isFa ? 'بازنشانی به نقش' : 'Reset to Role'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const clear = createPermissionsSet(false);
                onUpdateUserPermissions(selectedUser.id, clear);
                triggerToast(isFa ? 'کلیه دسترسی‌های کاربر لغو گردید.' : 'All permissions revoked.');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>{isFa ? 'لغو کلیه' : 'Revoke All'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. User Selector & Active Profile Overview */}
      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* User Selector Dropdown */}
          <div className="space-y-1.5 flex-1 max-w-md">
            <label className="text-xs font-black text-slate-700 dark:text-slate-200 block">
              {isFa ? 'انتخاب کاربر جهت تنظیم ماتریس دسترسی:' : 'Select User for Permissions Matrix:'}
            </label>
            <div className="relative">
              <select
                value={selectedUser?.id || ''}
                onChange={(e) => {
                  const found = users.find(u => u.id === e.target.value);
                  if (found) onSelectUser(found);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl text-xs font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
              >
                {users.map((u, idx) => (
                  <option key={`${u.id || 'user-opt'}-${idx}`} value={u.id}>
                    {u.fullName} (@{u.username}) — {u.jobTitle || u.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Profile Status Badge */}
          {selectedUser && (
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{selectedUser.fullName}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                    isSelectedAdmin 
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' 
                      : 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {selectedUser.role}
                  </span>
                  {effectiveData.hasOverrides && !isSelectedAdmin && (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                      {isFa ? 'دارای دسترسی‌های اختصاصی' : 'Custom Overrides'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {selectedUser.personnelNumber ? `کد پرسنلی: ${selectedUser.personnelNumber}` : `@${selectedUser.username}`}
                  {selectedUser.nationalId && ` | کدملی: ${selectedUser.nationalId}`}
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Permissions Counter & Progress */}
              <div className="space-y-1 text-left rtl:text-right min-w-[140px]">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span>{isFa ? 'مجوزهای فعال:' : 'Active:'}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">
                    {effectiveData.totalActiveCount} / {totalApplicableSlots} ({activePercentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${activePercentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Administrator Alert Notice */}
        {isSelectedAdmin && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 font-bold">
            <Lock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              {isFa 
                ? 'کاربر جاری با نقش «مدیر ارشد (Administrator)» دارای دسترسی ریشه‌ای و نامحدود به تمامی زیرسیستم‌ها می‌باشد. جهت اعمال محدودیت، نقش کاربر را تغییر دهید.' 
                : 'Selected user is an Administrator with unrestricted access. To restrict permissions, assign another role.'}
            </span>
          </div>
        )}

        {/* Dependency Warnings Banner */}
        {dependencyWarnings.length > 0 && !isSelectedAdmin && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <span className="font-black">
                  {isFa 
                    ? `هشدار وابستگی: تعداد ${dependencyWarnings.length} مجوز عملیاتی فعال بدون دسترسی «مشاهده» شناسایی شد!`
                    : `Dependency Warning: ${dependencyWarnings.length} operational actions enabled without View access!`}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300 block">
                  {isFa ? 'کاربر بدون دسترسی مشاهده به صفحه نمی‌تواند از عملیات ایجاد، ویرایش یا امضا استفاده نماید.' : 'Users need View access to reach the forms.'}
                </span>
              </div>
            </div>
            {isCurrentAdmin && (
              <button
                type="button"
                onClick={handleAutoFixDependencies}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black shrink-0 transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isFa ? 'اصلاح خودکار وابستگی‌ها' : 'Auto-Fix Dependencies'}</span>
              </button>
            )}
          </div>
        )}

        {/* 3. Fast Role Presets (8 Standard Roles Toolbar) */}
        {selectedUser && !isSelectedAdmin && isCurrentAdmin && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                {isFa ? 'اعمال سریع قالب‌های استاندارد نقش‌های سازمانی (Standard HSE Roles):' : 'Apply Standard HSE Role Presets:'}
              </span>
              <span className="text-[11px] text-slate-400">
                {isFa ? 'کلیک بر روی هر نقش، مجموعه مجوزهای استاندارد آن را اعمال می‌کند' : 'Click to apply standard permission set'}
              </span>
            </div>

            {/* 8 Standard Roles Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {STANDARD_ROLE_PRESETS.map((preset) => {
                const isSelected = lastAppliedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between space-y-2 text-xs shadow-2xs group ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                        : `bg-white dark:bg-slate-900 ${preset.colorScheme.border} ${preset.colorScheme.bg}`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {renderNodeIcon(preset.iconName)}
                        </div>
                        <div>
                          <div className={`font-black text-xs ${preset.colorScheme.text}`}>
                            {isFa ? preset.titleFa : preset.titleEn}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {isFa ? preset.badgeFa : preset.badgeEn}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                        {isFa ? 'اعمال' : 'Apply'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-normal">
                      {isFa ? preset.descriptionFa : preset.descriptionEn}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Save Toast Feedback */}
        {saveToast.show && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{saveToast.message}</span>
            </div>
            <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-mono">
              Database Sync: OK
            </span>
          </div>
        )}
      </div>

      {/* 4. Filter Toolbar & Legend */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
        
        {/* Row 1: Search & Scope Filter & Expand/Collapse */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder={isFa ? 'جستجوی نام ماژول، زیرماژول یا قابلیت...' : 'Search modules, submodules or operations...'}
              value={matrixSearch}
              onChange={(e) => setMatrixSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 pr-8 pl-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Scope Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setScopeFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                scopeFilter === 'ALL'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              {isFa ? 'همه قابلیت‌ها' : 'All Features'}
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('OVERRIDES_ONLY')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                scopeFilter === 'OVERRIDES_ONLY'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-50'
              }`}
            >
              {isFa ? 'فقط دسترسی‌های اختصاصی' : 'Custom Overrides Only'}
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('ACTIVE_ONLY')}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                scopeFilter === 'ACTIVE_ONLY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
              }`}
            >
              {isFa ? 'فقط فعال‌ها' : 'Active Only'}
            </button>
            {dependencyWarnings.length > 0 && (
              <button
                type="button"
                onClick={() => setScopeFilter('CONFLICTS_ONLY')}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                  scopeFilter === 'CONFLICTS_ONLY'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-50'
                }`}
              >
                {isFa ? `دارای تعارض (${dependencyWarnings.length})` : `Conflicts (${dependencyWarnings.length})`}
              </button>
            )}
          </div>

          {/* Expand/Collapse All */}
          <div className="flex items-center gap-1 text-[11px]">
            <button
              type="button"
              onClick={() => handleToggleExpandAll(true)}
              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-bold transition cursor-pointer"
            >
              {isFa ? 'باز کردن همه' : 'Expand All'}
            </button>
            <button
              type="button"
              onClick={() => handleToggleExpandAll(false)}
              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 font-bold transition cursor-pointer"
            >
              {isFa ? 'بستن همه' : 'Collapse All'}
            </button>
          </div>
        </div>

        {/* Row 2: Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 border-t border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setCategoryFilter('ALL')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition cursor-pointer ${
              categoryFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
            }`}
          >
            {isFa ? `همه بخش‌ها (${HIERARCHICAL_PERMISSION_NODES.length})` : `All (${HIERARCHICAL_PERMISSION_NODES.length})`}
          </button>
          {categoriesList.map(cat => {
            const countInCat = HIERARCHICAL_PERMISSION_NODES.filter(n => n.category === cat.key).length;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                  categoryFilter === cat.key
                    ? 'bg-indigo-600 text-white font-black shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                }`}
              >
                <span>{isFa ? cat.titleFa : cat.titleEn}</span>
                <span className="opacity-70 font-mono text-[10px] mr-1">({countInCat})</span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Visual Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60 font-medium">
          <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'راهنمای وضعیت:' : 'Legend:'}</span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span>{isFa ? 'ارث‌بری از نقش (مجاز)' : 'Inherited from Role'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-purple-500 ring-2 ring-purple-300 dark:ring-purple-800 inline-block" />
            <span>{isFa ? 'دسترسی اختصاصی کاربر (Override)' : 'Custom Override'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 inline-block" />
            <span>{isFa ? 'غیرفعال / مسدود' : 'Disabled'}</span>
          </span>
          <span className="flex items-center gap-1">
            <Minus className="w-3 h-3 text-slate-300 dark:text-slate-600" />
            <span>{isFa ? 'نامرتبط با این قابلیت' : 'Not Applicable'}</span>
          </span>
        </div>
      </div>

      {/* 5. Hierarchical Tree Matrix Tables */}
      {selectedUser ? (
        <div className="space-y-6">
          {categoriesList.map(category => {
            const nodesInCat = filteredNodes.filter(n => n.category === category.key);
            if (nodesInCat.length === 0) return null;

            const isExpanded = expandedCategories[category.key] !== false;

            // Compute active count inside this category
            const totalApplicableInCat = nodesInCat.reduce((acc, n) => acc + n.applicableActions.length, 0);
            const activeInCat = nodesInCat.reduce((acc, n) => {
              const nodePerms = effectiveData.effectivePermissions[n.id] as Record<string, boolean> | undefined;
              if (!nodePerms) return acc;
              return acc + n.applicableActions.filter(a => nodePerms[a]).length;
            }, 0);

            return (
              <div 
                key={category.key}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                {/* Category Header with Toolbar */}
                <div className="bg-slate-50 dark:bg-slate-800/80 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div 
                    onClick={() => setExpandedCategories(prev => ({ ...prev, [category.key]: !isExpanded }))}
                    className="flex items-center gap-2.5 cursor-pointer select-none"
                  >
                    <span className="text-slate-400 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      {isFa ? category.titleFa : category.titleEn}
                    </h3>
                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-md">
                      {nodesInCat.length} {isFa ? 'قابلیت' : 'Nodes'}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-md font-mono">
                      {activeInCat} / {totalApplicableInCat}
                    </span>
                  </div>

                  {/* Category Fast Batch Actions */}
                  {!isSelectedAdmin && isCurrentAdmin && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => handleCategoryAction(category.key, 'all_on')}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg font-black transition cursor-pointer"
                        title={isFa ? 'فعال‌سازی تمام دسترسی‌های این بخش' : 'Grant All in this category'}
                      >
                        {isFa ? 'تمام مجوزهای بخش' : 'All ON'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCategoryAction(category.key, 'readonly')}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 rounded-lg font-bold transition cursor-pointer"
                        title={isFa ? 'تنظیم این بخش روی فقط‌خواندنی' : 'Set category to Read-Only'}
                      >
                        {isFa ? 'فقط‌خواندنی' : 'Read-Only'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCategoryAction(category.key, 'all_off')}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg font-bold transition cursor-pointer"
                        title={isFa ? 'لغو کلیه دسترسی‌های این بخش' : 'Clear category permissions'}
                      >
                        {isFa ? 'لغو دسترسی' : 'Clear'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Permissions Grid Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 font-black">
                        <tr>
                          <th className="p-3.5 text-slate-800 dark:text-slate-100 font-black min-w-[280px]">
                            {isFa ? 'ساختار سلسله‌مراتبی ماژول‌ها و قابلیت‌ها' : 'Module Hierarchy & Scope'}
                          </th>
                          {ACTION_COLUMNS.map(action => (
                            <th key={action} className="p-2.5 text-center min-w-[65px] border-l border-slate-100 dark:border-slate-800/60">
                              <button
                                type="button"
                                onClick={() => handleColumnToggle(action)}
                                title={isFa ? `کلیک برای تغییر سراسری دسترسی ${HIERARCHICAL_ACTION_LABELS[action]?.titleFa || action} در این بخش` : `Toggle ${action}`}
                                disabled={isSelectedAdmin || !isCurrentAdmin}
                                className="group inline-flex flex-col items-center justify-center p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:cursor-default"
                              >
                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                  {HIERARCHICAL_ACTION_LABELS[action]?.titleFa || action}
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  ({action})
                                </span>
                              </button>
                            </th>
                          ))}
                          <th className="p-3 text-center min-w-[100px] text-slate-400 font-bold text-[10px]">
                            {isFa ? 'عملیات سریع' : 'Quick Actions'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {nodesInCat.map(node => {
                          const nodeEffective = (effectiveData.effectivePermissions[node.id] || {}) as Record<string, boolean>;
                          const nodeOverrides = effectiveData.customOverrides[node.id] || {};
                          const hasOverrideOnRow = Object.keys(nodeOverrides).length > 0;
                          const hasConflictOnRow = dependencyWarnings.some(w => w.nodeId === node.id);

                          return (
                            <tr 
                              key={node.id} 
                              className={`transition ${
                                hasConflictOnRow 
                                  ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50/60' 
                                  : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/30'
                              }`}
                            >
                              {/* Node Meta & Indentation */}
                              <td className="p-3.5">
                                <div className={`flex items-start gap-2.5 ${node.level === 2 ? 'pr-4' : node.level === 3 ? 'pr-8' : ''}`}>
                                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200 dark:border-slate-700">
                                    {renderNodeIcon(node.iconName)}
                                  </div>
                                  <div className="space-y-0.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-black text-slate-900 dark:text-white text-xs">
                                        {isFa ? node.titleFa : node.titleEn}
                                      </span>
                                      {node.level === 2 && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                                          زیرماژول
                                        </span>
                                      )}
                                      {hasOverrideOnRow && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                          اختصاصی
                                        </span>
                                      )}
                                      {hasConflictOnRow && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-0.5">
                                          <AlertCircle className="w-2.5 h-2.5" />
                                          تعارض
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 line-clamp-1" title={node.descriptionFa}>
                                      {node.descriptionFa}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Action Checkboxes */}
                              {ACTION_COLUMNS.map(action => {
                                const isApplicable = node.applicableActions.includes(action);

                                if (!isApplicable) {
                                  return (
                                    <td key={action} className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800/40">
                                      <span className="text-slate-300 dark:text-slate-700 font-bold select-none text-xs">
                                        —
                                      </span>
                                    </td>
                                  );
                                }

                                const isChecked = isSelectedAdmin ? true : Boolean(nodeEffective[action]);
                                const isOverride = !isSelectedAdmin && nodeOverrides[action] !== undefined;
                                const isActionDisabled = isSelectedAdmin || !isCurrentAdmin;

                                return (
                                  <td key={action} className="p-2.5 text-center border-l border-slate-100 dark:border-slate-800/40">
                                    <button
                                      type="button"
                                      disabled={isActionDisabled}
                                      onClick={() => handleToggleAction(node.id, action)}
                                      title={`${node.titleFa} -> ${HIERARCHICAL_ACTION_LABELS[action]?.titleFa || action} ${
                                        isOverride ? '(دسترسی اختصاصی کاربر)' : '(ارث‌بری از نقش)'
                                      }`}
                                      className={`mx-auto flex items-center justify-center p-1.5 rounded-lg transition ${
                                        isActionDisabled 
                                          ? 'cursor-not-allowed opacity-80' 
                                          : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer'
                                      }`}
                                    >
                                      {isChecked ? (
                                        <div className="relative">
                                          <CheckSquare 
                                            className={`w-5 h-5 ${
                                              isOverride 
                                                ? 'text-purple-600 dark:text-purple-400 fill-purple-500/20' 
                                                : 'text-emerald-600 dark:text-emerald-500 fill-emerald-500/15'
                                            }`} 
                                          />
                                          {isOverride && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500 ring-1 ring-white dark:ring-slate-900" />
                                          )}
                                        </div>
                                      ) : (
                                        <div className="relative">
                                          <Square className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
                                          {isOverride && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-1 ring-white dark:ring-slate-900" />
                                          )}
                                        </div>
                                      )}
                                    </button>
                                  </td>
                                );
                              })}

                              {/* Row Quick Preset (کامل / فقط‌خواندنی / خاموش) */}
                              <td className="p-2.5 text-center">
                                {!isSelectedAdmin && isCurrentAdmin ? (
                                  <div className="inline-flex items-center gap-1 text-[10px]">
                                    <button
                                      type="button"
                                      onClick={() => handleNodeAction(node, 'all_on')}
                                      className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold transition cursor-pointer"
                                      title={isFa ? 'اعطای کلیه مجوزهای این قابلیت' : 'Full access to this node'}
                                    >
                                      {isFa ? 'کامل' : 'All'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleNodeAction(node, 'readonly')}
                                      className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold transition cursor-pointer"
                                      title={isFa ? 'فقط مشاهده این قابلیت' : 'View only'}
                                    >
                                      {isFa ? 'دیدن' : 'View'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleNodeAction(node, 'all_off')}
                                      className="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-bold transition cursor-pointer"
                                      title={isFa ? 'غیرفعال‌سازی این قابلیت' : 'Clear node permissions'}
                                    >
                                      {isFa ? 'لغو' : 'Off'}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    {isSelectedAdmin ? (isFa ? 'کامل ریشه‌ای' : 'Root') : '-'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          {isFa ? 'لطفاً یک کاربر را از لیست بالا انتخاب کنید.' : 'Please select a user to view permissions.'}
        </div>
      )}
    </div>
  );
};
