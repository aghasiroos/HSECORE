import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle,
  Settings,
  LayoutDashboard,
  Cpu,
  ShieldAlert,
  FileText,
  Globe,
  Users,
  Building2,
  Trash2,
  Thermometer,
  AlertOctagon,
  GraduationCap,
  BarChart3,
  UserSearch,
  Flame,
  Leaf,
  HardHat,
  AlertCircle,
  ChevronsUp,
  ChevronsDown,
  Filter,
  Sliders,
  ToggleLeft,
  ToggleRight,
  HeartPulse,
  Stethoscope,
  Wind,
  Recycle,
  Droplets,
  CheckSquare,
  Truck,
  ShieldCheck,
  Activity,
  Eye,
  EyeOff,
  Search,
  Layers,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  FolderKanban,
  ListFilter,
  Image as ImageIcon,
  Gauge,
  ClipboardCheck,
  BrainCircuit,
  AlertTriangle,
  UserCheck,
  Inbox,
  Workflow,
  Settings2,
  UserCog,
  User as UserIcon,
  Bell,
  Zap,
  Bot
} from 'lucide-react';
import { UserProfile } from '../types';
import UserManagement from './UserManagement';
import PersonnelManagement from './PersonnelManagement';
import OrganizationMgmt from './OrganizationMgmt';
import { SystemLogoManagement } from './SystemLogoManagement';
import ApiManagementTab from './system-settings/ApiManagementTab';
import BackupRestoreTab from './system-settings/BackupRestoreTab';
import AiManagementTab from './system-settings/AiManagementTab';
import { GlobalAuditLogSystem } from './GlobalAuditLogSystem';
import { SystemNotificationsTab } from './system-settings/SystemNotificationsTab';
import { hasPermission, isUserAdmin } from '../utils/authHelper';




import {
  getMergedUiConfig,
  saveUiConfig,
  resetUiConfig,
  SystemModuleConfig,
  SYSTEM_MODULE_GROUPS,
  getMergedHealthEnvConfig,
  saveHealthEnvConfig,
  resetHealthEnvConfig,
  HealthEnvSubItemConfig,
  getMergedFireDeptConfig,
  saveFireDeptConfig,
  resetFireDeptConfig,
  FireDeptSubItemConfig
} from '../config/modulesConfig';
import { CategoryIcon } from '../modules/fire-dept/config/categoryIcons';

interface SystemSettingsProps {
  language: 'en' | 'fa';
  currentUser: UserProfile;
  onUserUpdateTrigger?: () => void;
}

interface BackupHistoryEntry {
  id: string;
  ts: string;
  type: 'Backup' | 'Restore';
  format: 'JSON' | 'Standard SQL' | 'Generic SQL';
  size: string;
  status: 'Success' | 'Failed';
  operator: string;
}


function UiConfigPanel({ language, currentUser }: { language: 'en' | 'fa', currentUser: UserProfile }) {
  const isFa = language === 'fa';
  const [activeTab, setActiveTab] = useState<'branding' | 'main' | 'health-env' | 'fire-dept'>('branding');

  // --- 1. Main System Modules State ---
  const [modules, setModules] = useState<SystemModuleConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  // --- 2. Health & Env Sub-menus State ---
  const [healthEnvItems, setHealthEnvItems] = useState<HealthEnvSubItemConfig[]>([]);
  const [searchHealthEnv, setSearchHealthEnv] = useState('');
  const [selectedHealthEnvGroup, setSelectedHealthEnvGroup] = useState<string>('ALL');

  // --- 3. Fire Dept Sub-menus State ---
  const [fireDeptItems, setFireDeptItems] = useState<FireDeptSubItemConfig[]>([]);
  const [searchFireDept, setSearchFireDept] = useState('');
  const [selectedFireDeptType, setSelectedFireDeptType] = useState<string>('ALL');

  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [saveMessageText, setSaveMessageText] = useState('');

  // Delete / Reset confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    setModules(getMergedUiConfig());
    setHealthEnvItems(getMergedHealthEnvConfig());
    setFireDeptItems(getMergedFireDeptConfig());
  }, []);

  // Listen to external UI config updates
  useEffect(() => {
    const handleSync = () => {
      setModules(getMergedUiConfig());
    };
    window.addEventListener('hse_ui_config_updated', handleSync);
    return () => window.removeEventListener('hse_ui_config_updated', handleSync);
  }, []);

  // --- Helpers for Main Modules ---
  const getModuleIcon = (key: string) => {
    switch (key) {
      case 'dashboard': return LayoutDashboard;
      case 'heat': return Thermometer;
      case 'hse-ms': return Gauge;
      case 'reports': return BarChart3;
      case 'safety-unit': return ShieldCheck;
      case 'fire-dept': return Flame;
      case 'health-env': return Leaf;
      case 'permit': return FileText;
      case 'ptw-audit': return ClipboardCheck;
      case 'risk': return BrainCircuit;
      case 'ppe': return HardHat;
      case 'incidents': return AlertOctagon;
      case 'warnings': return AlertTriangle;
      case 'personnel-history': return UserCheck;
      case 'training': return GraduationCap;
      case 'pending-documents': return Inbox;
      case 'process-management': return Workflow;
      case 'notifications': return Bell;
      case 'user-mgmt': return UserCog;
      case 'system': return Settings2;
      case 'profile': return UserIcon;
      default: return Layers;
    }
  };

  const getGroupMeta = (groupId?: string) => {
    return SYSTEM_MODULE_GROUPS.find(g => g.id === groupId) || SYSTEM_MODULE_GROUPS[0];
  };

  const handleMoveModuleToGroup = (moduleIndex: number, newGroupId: string) => {
    const newItems = [...modules];
    if (newItems[moduleIndex]) {
      const oldGroupId = newItems[moduleIndex].groupId || 'dashboards';
      newItems[moduleIndex] = {
        ...newItems[moduleIndex],
        groupId: newGroupId
      };
      setModules(newItems);
      const targetGroup = SYSTEM_MODULE_GROUPS.find(g => g.id === newGroupId);
      setSaveMessageText(
        isFa 
          ? `ماژول به گروه «${targetGroup?.titleFa || newGroupId}» منتقل شد.` 
          : `Module moved to "${targetGroup?.titleEn || newGroupId}".`
      );
      setShowSaveMessage(true);
      setTimeout(() => setShowSaveMessage(false), 2500);
    }
  };

  const handleMoveModule = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const newItems = [...modules];
    if (direction === 'up' && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    } else if (direction === 'down' && index < newItems.length - 1) {
      [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
    } else if (direction === 'top' && index > 0) {
      const [item] = newItems.splice(index, 1);
      newItems.unshift(item);
    } else if (direction === 'bottom' && index < newItems.length - 1) {
      const [item] = newItems.splice(index, 1);
      newItems.push(item);
    }
    setModules(newItems);
  };

  const handleToggleModuleEnabled = (index: number) => {
    const newItems = [...modules];
    newItems[index].enabled = !(newItems[index].enabled ?? true);
    setModules(newItems);
  };

  const handleUpdateModuleName = (index: number, lang: 'fa' | 'en', val: string) => {
    const newItems = [...modules];
    if (lang === 'fa') newItems[index].titleFa = val;
    else newItems[index].titleEn = val;
    setModules(newItems);
  };

  const handleSaveModules = () => {
    saveUiConfig(modules);
    setSaveMessageText(isFa ? 'چیدمان و گروه‌بندی ماژول‌های سراسری با موفقیت ذخیره شد.' : 'Main modules layout and grouping saved.');
    setShowSaveMessage(true);
    setTimeout(() => {
      setShowSaveMessage(false);
    }, 2000);
  };

  const handleResetModules = () => {
    setDeleteConfirm({
      title: isFa ? 'آیا از بازنشانی چیدمان و گروه‌بندی تمام ماژول‌های سراسری به حالت پیش‌فرض اطمینان دارید؟' : 'Reset all main module layouts and groupings to factory defaults?',
      description: isFa ? 'تنظیمات سفارشی ترتیب، گروه‌بندی و نمایش ماژول‌های اصلی به حالت پیش‌فرض بازخواهند گشت.' : 'All custom order, grouping, and visibility settings for main modules will be restored.',
      onConfirm: () => {
        resetUiConfig();
        setModules(getMergedUiConfig());
        setDeleteConfirm(null);
      }
    });
  };

  // --- Helpers for Health & Env Sub-menus ---
  const getHealthEnvIcon = (key: string) => {
    switch (key) {
      case 'periodic-exams': return Stethoscope;
      case 'non-periodic-exams': return Activity;
      case 'env-dashboard': return LayoutDashboard;
      case 'env-monitoring': return Wind;
      case 'waste-management': return Recycle;
      case 'wastewater': return Droplets;
      case 'air-water-soil': return Globe;
      case 'five-s': return CheckSquare;
      case 'env-reports': return BarChart3;
      default: return HeartPulse;
    }
  };

  const handleMoveHealthEnv = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const newItems = [...healthEnvItems];
    if (direction === 'up' && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    } else if (direction === 'down' && index < newItems.length - 1) {
      [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
    } else if (direction === 'top' && index > 0) {
      const [item] = newItems.splice(index, 1);
      newItems.unshift(item);
    } else if (direction === 'bottom' && index < newItems.length - 1) {
      const [item] = newItems.splice(index, 1);
      newItems.push(item);
    }
    setHealthEnvItems(newItems);
  };

  const handleToggleHealthEnvEnabled = (index: number) => {
    const newItems = [...healthEnvItems];
    newItems[index].enabled = !(newItems[index].enabled ?? true);
    setHealthEnvItems(newItems);
  };

  const handleUpdateHealthEnvName = (index: number, lang: 'fa' | 'en', val: string) => {
    const newItems = [...healthEnvItems];
    if (lang === 'fa') newItems[index].titleFa = val;
    else newItems[index].titleEn = val;
    setHealthEnvItems(newItems);
  };

  const handleSaveHealthEnv = () => {
    saveHealthEnvConfig(healthEnvItems);
    setSaveMessageText(isFa ? 'چیدمان زیرمنوهای بهداشت و محیط‌زیست با موفقیت ذخیره شد.' : 'Health & Environment sub-menus layout saved.');
    setShowSaveMessage(true);
    setTimeout(() => {
      setShowSaveMessage(false);
    }, 2500);
  };

  const handleResetHealthEnv = () => {
    setDeleteConfirm({
      title: isFa ? 'آیا از بازنشانی منوهای بهداشت و محیط‌زیست به حالت پیش‌فرض اطمینان دارید؟' : 'Reset Health & Environment sub-menus to defaults?',
      description: isFa ? 'چیدمان، نام‌ها و وضعیت نمایش تب‌های بهداشت و محیط‌زیست به حالت اولیه بازمی‌گردد.' : 'All custom order and visibility settings for health & environment will be reset.',
      onConfirm: () => {
        resetHealthEnvConfig();
        setHealthEnvItems(getMergedHealthEnvConfig());
        setDeleteConfirm(null);
      }
    });
  };

  // --- Helpers for Fire Dept Sub-menus ---
  const handleMoveFireDept = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const newItems = [...fireDeptItems];
    if (direction === 'up' && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    } else if (direction === 'down' && index < newItems.length - 1) {
      [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
    } else if (direction === 'top' && index > 0) {
      const [item] = newItems.splice(index, 1);
      newItems.unshift(item);
    } else if (direction === 'bottom' && index < newItems.length - 1) {
      const [item] = newItems.splice(index, 1);
      newItems.push(item);
    }
    setFireDeptItems(newItems);
  };

  const handleToggleFireDeptEnabled = (index: number) => {
    const newItems = [...fireDeptItems];
    newItems[index].enabled = !(newItems[index].enabled ?? true);
    setFireDeptItems(newItems);
  };

  const handleUpdateFireDeptName = (index: number, lang: 'fa' | 'en', val: string) => {
    const newItems = [...fireDeptItems];
    if (lang === 'fa') newItems[index].titleFa = val;
    else newItems[index].titleEn = val;
    setFireDeptItems(newItems);
  };

  const handleSaveFireDept = () => {
    saveFireDeptConfig(fireDeptItems);
    setSaveMessageText(isFa ? 'چیدمان زیرمنوهای واحد آتش‌نشانی با موفقیت ذخیره شد.' : 'Fire Department sub-menus layout saved.');
    setShowSaveMessage(true);
    setTimeout(() => {
      setShowSaveMessage(false);
    }, 2500);
  };

  const handleResetFireDept = () => {
    setDeleteConfirm({
      title: isFa ? 'آیا از بازنشانی زیرمنوهای آتش‌نشانی به حالت پیش‌فرض اطمینان دارید؟' : 'Reset Fire Department sub-menus to defaults?',
      description: isFa ? 'چیدمان و نمایش فرم‌های ۸ گانه بازرسی و خودروها به حالت پیش‌فرض برمی‌گردد.' : 'All custom order and visibility settings for fire department will be reset.',
      onConfirm: () => {
        resetFireDeptConfig();
        setFireDeptItems(getMergedFireDeptConfig());
        setDeleteConfirm(null);
      }
    });
  };

  // Filtered lists
  const filteredModules = modules.filter(m => {
    const matchesSearch = !searchQuery.trim() || (
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.titleFa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.descriptionFa && m.descriptionFa.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const modGroupId = m.groupId || 'dashboards';
    const matchesGroup = selectedGroupId === 'ALL' || modGroupId === selectedGroupId;
    return matchesSearch && matchesGroup;
  });

  const filteredHealthEnv = healthEnvItems.filter(m => {
    const matchesSearch = !searchHealthEnv.trim() || (
      m.key.toLowerCase().includes(searchHealthEnv.toLowerCase()) ||
      m.titleFa.toLowerCase().includes(searchHealthEnv.toLowerCase()) ||
      (m.titleEn && m.titleEn.toLowerCase().includes(searchHealthEnv.toLowerCase())) ||
      (m.descriptionFa && m.descriptionFa.toLowerCase().includes(searchHealthEnv.toLowerCase()))
    );
    const matchesGroup = selectedHealthEnvGroup === 'ALL' || m.group === selectedHealthEnvGroup;
    return matchesSearch && matchesGroup;
  });

  const filteredFireDept = fireDeptItems.filter(m => {
    const matchesSearch = !searchFireDept.trim() || (
      m.key.toLowerCase().includes(searchFireDept.toLowerCase()) ||
      m.titleFa.toLowerCase().includes(searchFireDept.toLowerCase()) ||
      (m.titleEn && m.titleEn.toLowerCase().includes(searchFireDept.toLowerCase())) ||
      (m.descriptionFa && m.descriptionFa.toLowerCase().includes(searchFireDept.toLowerCase()))
    );
    const matchesType = selectedFireDeptType === 'ALL' || m.type === selectedFireDeptType;
    return matchesSearch && matchesType;
  });

  const renderModuleCard = (m: SystemModuleConfig) => {
    const originalIdx = modules.findIndex(item => item.key === m.key);
    const isEnabled = m.enabled !== false;
    const ModuleIcon = getModuleIcon(m.key);
    const currentGroup = getGroupMeta(m.groupId);

    return (
      <div 
        key={m.key} 
        className={`p-4 rounded-2xl border transition-all duration-200 space-y-3.5 ${
          isEnabled 
            ? 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700' 
            : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-70'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Rank / Order Index */}
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-black text-xs text-slate-700 dark:text-slate-300 shrink-0">
              #{originalIdx + 1 < 10 ? `0${originalIdx + 1}` : originalIdx + 1}
            </div>

            {/* Reorder Buttons */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-2xs">
              <button 
                disabled={originalIdx === 0} 
                onClick={() => handleMoveModule(originalIdx, 'top')} 
                className="p-1 disabled:opacity-20 hover:text-indigo-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                title={isFa ? 'انتقال به ابتدای صف' : 'Move to Top'}
              >
                <ChevronsUp className="w-3.5 h-3.5" />
              </button>
              <button 
                disabled={originalIdx === 0} 
                onClick={() => handleMoveModule(originalIdx, 'up')} 
                className="p-1 disabled:opacity-20 hover:text-indigo-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                title={isFa ? 'یک پله به بالا' : 'Move Up'}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button 
                disabled={originalIdx === modules.length - 1} 
                onClick={() => handleMoveModule(originalIdx, 'down')} 
                className="p-1 disabled:opacity-20 hover:text-indigo-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                title={isFa ? 'یک پله به پایین' : 'Move Down'}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button 
                disabled={originalIdx === modules.length - 1} 
                onClick={() => handleMoveModule(originalIdx, 'bottom')} 
                className="p-1 disabled:opacity-20 hover:text-indigo-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                title={isFa ? 'انتقال به انتهای صف' : 'Move to Bottom'}
              >
                <ChevronsDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Icon */}
            <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
              isEnabled 
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
            }`}>
              <ModuleIcon className="w-4 h-4" />
            </div>

            {/* Module Name & Description */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                  {m.key}
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${currentGroup.bgLight} ${currentGroup.borderLight} ${currentGroup.color}`}>
                  {isFa ? currentGroup.titleFa : currentGroup.titleEn}
                </span>
              </div>
              {m.descriptionFa && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">
                  {m.descriptionFa}
                </span>
              )}
            </div>
          </div>

          {/* Group Selector & Toggle Switch */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Transfer to Group Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
                <ArrowRightLeft className="w-3 h-3 text-indigo-500 shrink-0" />
                <span>{isFa ? 'انتقال به گروه:' : 'Move to Group:'}</span>
              </span>
              <select
                value={m.groupId || 'dashboards'}
                onChange={(e) => handleMoveModuleToGroup(originalIdx, e.target.value)}
                className="text-xs font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {SYSTEM_MODULE_GROUPS.map(g => (
                  <option key={g.id} value={g.id}>
                    {isFa ? g.titleFa : g.titleEn}
                  </option>
                ))}
              </select>
            </div>

            {/* Visibility Toggle Button */}
            <button
              onClick={() => handleToggleModuleEnabled(originalIdx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs ${
                isEnabled 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 border border-emerald-300 dark:border-emerald-800' 
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 border border-slate-300 dark:border-slate-700'
              }`}
            >
              {isEnabled ? <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isEnabled ? (isFa ? 'فعال در منو' : 'Active') : (isFa ? 'مخفی در منو' : 'Hidden')}</span>
            </button>
          </div>
        </div>

        {/* Name inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 block">
              {isFa ? 'عنوان فارسی در منوی ناوبری:' : 'Persian Title in Navigation:'}
            </label>
            <input
              type="text"
              value={m.titleFa || ''}
              onChange={(e) => handleUpdateModuleName(originalIdx, 'fa', e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-right focus:bg-white dark:bg-slate-900 bg-slate-50 dark:bg-slate-800/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 block">
              {isFa ? 'عنوان انگلیسی در منوی ناوبری:' : 'English Title in Navigation:'}
            </label>
            <input
              type="text"
              value={m.titleEn || ''}
              onChange={(e) => handleUpdateModuleName(originalIdx, 'en', e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-left font-sans focus:bg-white dark:bg-slate-900 bg-slate-50 dark:bg-slate-800/40"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
      {/* Header & Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <span>{isFa ? 'شخصی‌سازی، گروه‌بندی و چیدمان منوهای سامانه' : 'System Menu Grouping & Layout Customizer'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isFa 
              ? 'امکان چیدمان، تغییر نام، فعال/غیرفعال‌سازی و انتقال ماژول‌ها بین ۵ گروه اصلی منوی برنامه.' 
              : 'Customize navigation ordering, titles, toggle visibility, and move modules between the 5 primary menu groups.'}
          </p>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('branding')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'branding'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{isFa ? 'لوگو و آرم رسمی سامانه' : 'Official Logo & Branding'}</span>
          </button>

          <button
            onClick={() => setActiveTab('main')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'main'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isFa ? 'منوی سراسری و گروه‌ها' : 'Main Menu & Groups'}</span>
          </button>

          <button
            onClick={() => setActiveTab('health-env')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'health-env'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Leaf className="w-3.5 h-3.5" />
            <span>{isFa ? 'بهداشت و محیط‌زیست' : 'Health & Env'}</span>
          </button>

          <button
            onClick={() => setActiveTab('fire-dept')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'fire-dept'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{isFa ? 'واحد آتش‌نشانی' : 'Fire Department'}</span>
          </button>
        </div>
      </div>

      {/* ======================= TAB 0: SYSTEM LOGO & BRANDING ======================= */}
      {activeTab === 'branding' && (
        <div className="animate-in fade-in duration-200">
          <SystemLogoManagement currentUser={currentUser} isFa={isFa} />
        </div>
      )}

      {/* ======================= TAB 1: MAIN SYSTEM MODULES ======================= */}
      {activeTab === 'main' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Group Overview Chips / Quick Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* All Groups Card */}
            <button
              onClick={() => setSelectedGroupId('ALL')}
              className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                selectedGroupId === 'ALL'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20 ring-2 ring-indigo-400/40'
                  : 'bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <Layers className={`w-4 h-4 ${selectedGroupId === 'ALL' ? 'text-white' : 'text-indigo-500'}`} />
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                  selectedGroupId === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {modules.length}
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xs font-black leading-tight">
                  {isFa ? 'همه گروه‌ها' : 'All Groups'}
                </div>
                <div className={`text-[10px] mt-0.5 ${selectedGroupId === 'ALL' ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {isFa ? `${modules.filter(m => m.enabled !== false).length} ماژول فعال` : `${modules.filter(m => m.enabled !== false).length} Active`}
                </div>
              </div>
            </button>

            {/* 5 Enterprise HSE Group Cards */}
            {SYSTEM_MODULE_GROUPS.map(g => {
              const groupModules = modules.filter(m => (m.groupId || 'dashboards') === g.id);
              const activeCount = groupModules.filter(m => m.enabled !== false).length;
              const isSelected = selectedGroupId === g.id;

              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(isSelected ? 'ALL' : g.id)}
                  className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-md ring-2 ring-slate-400'
                      : `${g.bgLight} ${g.borderLight} hover:opacity-90`
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      g.id === 'dashboards' ? 'bg-amber-500' :
                      g.id === 'departments' ? 'bg-red-500' :
                      g.id === 'safety' ? 'bg-blue-500' :
                      g.id === 'processes' ? 'bg-emerald-500' : 'bg-slate-500'
                    }`} />
                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-white/20 dark:bg-slate-800 text-white dark:text-slate-100' : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300'
                    }`}>
                      {groupModules.length}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className={`text-xs font-black truncate leading-tight ${isSelected ? 'text-white dark:text-slate-900' : 'text-slate-900 dark:text-slate-100'}`}>
                      {isFa ? g.titleFa : g.titleEn}
                    </div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300 dark:text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isFa ? `${activeCount} فعال` : `${activeCount} Active`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Search, View Mode & Batch Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/30 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isFa ? 'جستجو در نام یا کلید ماژول...' : 'Search modules by name or key...'}
                className="w-full pr-9 pl-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('grouped')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'grouped'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                  title={isFa ? 'نمایش بر اساس ۵ گروه اصلی' : 'Grouped by Menu Groups'}
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>{isFa ? 'نمایش گروهی' : 'Grouped'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'list'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                  title={isFa ? 'نمایش لیست یکپارچه' : 'Unified Flat List'}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>{isFa ? 'لیست پیوسته' : 'Flat List'}</span>
                </button>
              </div>

              {/* Batch Enable / Core */}
              <button
                type="button"
                onClick={() => setModules(modules.map(m => ({ ...m, enabled: true })))}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <ToggleRight className="w-3.5 h-3.5" />
                <span>{isFa ? 'فعال‌سازی همه' : 'Enable All'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const coreKeys = ['dashboard', 'system', 'profile'];
                  setModules(modules.map(m => ({ ...m, enabled: coreKeys.includes(m.key) })));
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-black rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <ToggleLeft className="w-3.5 h-3.5" />
                <span>{isFa ? 'فقط ماژول‌های پایه' : 'Core Only'}</span>
              </button>
            </div>
          </div>

          {/* ============ RENDER MODULES: GROUPED VIEW ============ */}
          {viewMode === 'grouped' ? (
            <div className="space-y-6 max-h-[620px] overflow-y-auto pr-1">
              {SYSTEM_MODULE_GROUPS.map(group => {
                if (selectedGroupId !== 'ALL' && selectedGroupId !== group.id) {
                  return null;
                }

                const groupModules = filteredModules.filter(m => (m.groupId || 'dashboards') === group.id);

                return (
                  <div 
                    key={group.id} 
                    className={`rounded-2xl border ${group.borderLight} overflow-hidden bg-slate-50/40 dark:bg-slate-900/30 p-4 space-y-3.5`}
                  >
                    {/* Group Header Banner */}
                    <div className="flex items-center justify-between border-b pb-3 border-slate-200/70 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${group.bgLight} ${group.color} border ${group.borderLight}`}>
                          <FolderKanban className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                              {isFa ? group.titleFa : group.titleEn}
                            </h4>
                            <span className="font-mono text-[11px] text-slate-400">
                              ({group.id})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {isFa ? group.titleEn : group.titleFa}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${group.bgLight} ${group.borderLight} ${group.color}`}>
                          {isFa ? `${groupModules.length} ماژول` : `${groupModules.length} Modules`}
                        </span>
                      </div>
                    </div>

                    {/* Group Modules List */}
                    {groupModules.length > 0 ? (
                      <div className="space-y-3">
                        {groupModules.map(m => renderModuleCard(m))}
                      </div>
                    ) : (
                      <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400">
                        {isFa 
                          ? 'هیچ ماژولی در این گروه قرار ندارد. از گزینه «انتقال به گروه» در سایر ماژول‌ها برای افزودن به این گروه استفاده کنید.' 
                          : 'No modules assigned to this group. Use "Move to Group" on other modules to add here.'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ============ RENDER MODULES: FLAT LIST VIEW ============ */
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {filteredModules.map(m => renderModuleCard(m))}
            </div>
          )}

          {/* Footer Save & Reset */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">
              {showSaveMessage && (
                <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-1.5 animate-pulse">
                  <CheckCircle className="w-4 h-4" />
                  <span>{saveMessageText}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={handleResetModules}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>{isFa ? 'بازنشانی پیش‌فرض' : 'Reset Defaults'}</span>
              </button>
              <button
                onClick={handleSaveModules}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isFa ? 'ذخیره و اعمال چیدمان و گروه‌ها' : 'Save & Apply Groups'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 2: HEALTH & ENVIRONMENT SUBMENUS ======================= */}
      {activeTab === 'health-env' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Banner & Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-50/70 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 p-3.5 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-300">
              <Leaf className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{isFa ? 'مدیریت و چیدمان زیرمنوهای بهداشت و محیط‌زیست (نوار کناری)' : 'Manage Health & Environment Sidebar Sub-menus'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-mono font-bold">
                {isFa ? `کل تب‌ها: ${healthEnvItems.length}` : `Total: ${healthEnvItems.length}`}
              </span>
              <span className="px-2.5 py-1 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-lg text-xs font-mono font-bold">
                {isFa ? `فعال: ${healthEnvItems.filter(m => m.enabled !== false).length}` : `Active: ${healthEnvItems.filter(m => m.enabled !== false).length}`}
              </span>
            </div>
          </div>

          {/* Search & Filter Group Chips */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchHealthEnv}
                onChange={(e) => setSearchHealthEnv(e.target.value)}
                placeholder={isFa ? 'جستجو در زیرمنوهای بهداشت و محیط‌زیست...' : 'Search health & env sub-menus...'}
                className="w-full pr-9 pl-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedHealthEnvGroup('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  selectedHealthEnvGroup === 'ALL'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isFa ? 'همه بخش‌ها' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedHealthEnvGroup('health')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  selectedHealthEnvGroup === 'health'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                <span>{isFa ? '۱. بهداشت حرفه‌ای' : 'Occupational Health'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedHealthEnvGroup('env')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  selectedHealthEnvGroup === 'env'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Wind className="w-3.5 h-3.5 text-emerald-500" />
                <span>{isFa ? '۲. محیط‌زیست' : 'Environment'}</span>
              </button>
            </div>
          </div>

          {/* Health & Env Sub-Items List */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredHealthEnv.map((item) => {
              const originalIdx = healthEnvItems.findIndex(x => x.key === item.key);
              const isEnabled = item.enabled !== false;
              const ItemIcon = getHealthEnvIcon(item.key);
              const isHealthGroup = item.group === 'health';

              return (
                <div 
                  key={item.key} 
                  className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
                    isEnabled 
                      ? 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-teal-300 dark:hover:border-teal-700' 
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-black text-xs text-slate-700 dark:text-slate-300 shrink-0">
                        #{originalIdx + 1 < 10 ? `0${originalIdx + 1}` : originalIdx + 1}
                      </div>

                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-2xs">
                        <button 
                          disabled={originalIdx === 0} 
                          onClick={() => handleMoveHealthEnv(originalIdx, 'top')} 
                          className="p-1 disabled:opacity-20 hover:text-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'انتقال به ابتدای صف' : 'Move to Top'}
                        >
                          <ChevronsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          disabled={originalIdx === 0} 
                          onClick={() => handleMoveHealthEnv(originalIdx, 'up')} 
                          className="p-1 disabled:opacity-20 hover:text-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'یک پله به بالا' : 'Move Up'}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                        <button 
                          disabled={originalIdx === healthEnvItems.length - 1} 
                          onClick={() => handleMoveHealthEnv(originalIdx, 'down')} 
                          className="p-1 disabled:opacity-20 hover:text-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'یک پله به پایین' : 'Move Down'}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          disabled={originalIdx === healthEnvItems.length - 1} 
                          onClick={() => handleMoveHealthEnv(originalIdx, 'bottom')} 
                          className="p-1 disabled:opacity-20 hover:text-teal-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'انتقال به انتهای صف' : 'Move to Bottom'}
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                        isEnabled 
                          ? isHealthGroup ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-600' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        <ItemIcon className="w-4 h-4" />
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            {item.key}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isHealthGroup 
                              ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' 
                              : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {isHealthGroup ? (isFa ? 'بهداشت حرفه‌ای' : 'Health') : (isFa ? 'محیط‌زیست' : 'Environment')}
                          </span>
                        </div>
                        {item.descriptionFa && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 hidden md:block">
                            {item.descriptionFa}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleHealthEnvEnabled(originalIdx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs ${
                        isEnabled 
                          ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 hover:bg-teal-200 border border-teal-300 dark:border-teal-800' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {isEnabled ? <Eye className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{isEnabled ? (isFa ? 'فعال در منو' : 'Active') : (isFa ? 'مخفی در منو' : 'Hidden')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">
                        {isFa ? 'عنوان فارسی در سایدبار بهداشت:' : 'Persian Title in Sidebar:'}
                      </label>
                      <input
                        type="text"
                        value={item.titleFa || ''}
                        onChange={(e) => handleUpdateHealthEnvName(originalIdx, 'fa', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-right focus:bg-white dark:bg-slate-900 bg-slate-50 dark:bg-slate-800/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">
                        {isFa ? 'عنوان انگلیسی در سایدبار:' : 'English Title in Sidebar:'}
                      </label>
                      <input
                        type="text"
                        value={item.titleEn || ''}
                        onChange={(e) => handleUpdateHealthEnvName(originalIdx, 'en', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-left font-sans focus:bg-white dark:bg-slate-900 bg-slate-50 dark:bg-slate-800/40"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Save & Reset */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">
              {showSaveMessage && (
                <span className="text-teal-600 dark:text-teal-400 font-black flex items-center gap-1.5 animate-pulse">
                  <CheckCircle className="w-4 h-4" />
                  <span>{saveMessageText}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={handleResetHealthEnv}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>{isFa ? 'بازنشانی پیش‌فرض' : 'Reset Defaults'}</span>
              </button>
              <button
                onClick={handleSaveHealthEnv}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isFa ? 'ذخیره و اعمال چیدمان بهداشت' : 'Save Health & Env Layout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: FIRE DEPARTMENT SUBMENUS ======================= */}
      {activeTab === 'fire-dept' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Banner & Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-red-50/70 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/40 p-3.5 rounded-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-red-900 dark:text-red-300">
              <Flame className="w-4 h-4 text-red-600 shrink-0" />
              <span>{isFa ? 'مدیریت و چیدمان زیرمنوهای آتش‌نشانی، ناوگان خودرویی و ۸ فرم بازرسی تجهیزات' : 'Manage Fire Department Fleet & 8 Inspection Sub-modules'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-mono font-bold">
                {isFa ? `کل فرم‌ها: ${fireDeptItems.length}` : `Total: ${fireDeptItems.length}`}
              </span>
              <span className="px-2.5 py-1 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-xs font-mono font-bold">
                {isFa ? `فعال: ${fireDeptItems.filter(m => m.enabled !== false).length}` : `Active: ${fireDeptItems.filter(m => m.enabled !== false).length}`}
              </span>
            </div>
          </div>

          {/* Search & Filter Group Chips */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFireDept}
                onChange={(e) => setSearchFireDept(e.target.value)}
                placeholder={isFa ? 'جستجو در زیرمنوهای آتش‌نشانی...' : 'Search fire dept sub-menus...'}
                className="w-full pr-9 pl-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedFireDeptType('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  selectedFireDeptType === 'ALL'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {isFa ? 'همه بخش‌ها' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedFireDeptType('general')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  selectedFireDeptType === 'general'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Truck className="w-3.5 h-3.5 text-red-500" />
                <span>{isFa ? 'داشبورد و خودروها' : 'Dashboard & Fleet'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedFireDeptType('category')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  selectedFireDeptType === 'category'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>{isFa ? '۸ فرم بازرسی تجهیزات' : '8 Inspection Forms'}</span>
              </button>
            </div>
          </div>

          {/* Fire Dept Sub-Items List */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredFireDept.map((item) => {
              const originalIdx = fireDeptItems.findIndex(x => x.key === item.key);
              const isEnabled = item.enabled !== false;
              const isGeneral = item.type === 'general';

              return (
                <div 
                  key={item.key} 
                  className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
                    isEnabled 
                      ? 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-red-300 dark:hover:border-red-700' 
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-black text-xs text-slate-700 dark:text-slate-300 shrink-0">
                        #{originalIdx + 1 < 10 ? `0${originalIdx + 1}` : originalIdx + 1}
                      </div>

                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-2xs">
                        <button 
                          disabled={originalIdx === 0} 
                          onClick={() => handleMoveFireDept(originalIdx, 'top')} 
                          className="p-1 disabled:opacity-20 hover:text-red-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'انتقال به ابتدای صف' : 'Move to Top'}
                        >
                          <ChevronsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          disabled={originalIdx === 0} 
                          onClick={() => handleMoveFireDept(originalIdx, 'up')} 
                          className="p-1 disabled:opacity-20 hover:text-red-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'یک پله به بالا' : 'Move Up'}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-px h-3.5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                        <button 
                          disabled={originalIdx === fireDeptItems.length - 1} 
                          onClick={() => handleMoveFireDept(originalIdx, 'down')} 
                          className="p-1 disabled:opacity-20 hover:text-red-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'یک پله به پایین' : 'Move Down'}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          disabled={originalIdx === fireDeptItems.length - 1} 
                          onClick={() => handleMoveFireDept(originalIdx, 'bottom')} 
                          className="p-1 disabled:opacity-20 hover:text-red-600 text-slate-600 dark:text-slate-300 cursor-pointer transition"
                          title={isFa ? 'انتقال به انتهای صف' : 'Move to Bottom'}
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                        isEnabled 
                          ? 'bg-red-50 dark:bg-red-950/40 text-red-600' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {item.key === 'dashboard' && <LayoutDashboard className="w-4 h-4" />}
                        {item.key === 'vehicles' && <Truck className="w-4 h-4" />}
                        {item.type === 'category' && <CategoryIcon category={item.key} className="w-4 h-4" />}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                            {item.key}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isGeneral 
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                              : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                          }`}>
                            {isGeneral ? (isFa ? 'عمومی و ناوگان' : 'General & Fleet') : (isFa ? 'فرم بازرسی' : 'Inspection Form')}
                          </span>
                        </div>
                        {item.descriptionFa && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 hidden md:block">
                            {item.descriptionFa}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleFireDeptEnabled(originalIdx)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs ${
                        isEnabled 
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 hover:bg-red-200 border border-red-300 dark:border-red-800' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {isEnabled ? <Eye className="w-3.5 h-3.5 text-red-600 dark:text-red-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{isEnabled ? (isFa ? 'فعال در منو' : 'Active') : (isFa ? 'مخفی در منو' : 'Hidden')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">
                        {isFa ? 'عنوان فارسی در سایدبار آتش‌نشانی:' : 'Persian Title in Sidebar:'}
                      </label>
                      <input
                        type="text"
                        value={item.titleFa || ''}
                        onChange={(e) => handleUpdateFireDeptName(originalIdx, 'fa', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-right focus:bg-white dark:bg-slate-900 bg-slate-50 dark:bg-slate-800/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block">
                        {isFa ? 'عنوان انگلیسی در سایدبار:' : 'English Title in Sidebar:'}
                      </label>
                      <input
                        type="text"
                        value={item.titleEn || ''}
                        onChange={(e) => handleUpdateFireDeptName(originalIdx, 'en', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-left font-sans focus:bg-white dark:bg-slate-900 bg-slate-50 dark:bg-slate-800/40"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Save & Reset */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 font-medium">
              {showSaveMessage && (
                <span className="text-red-600 dark:text-red-400 font-black flex items-center gap-1.5 animate-pulse">
                  <CheckCircle className="w-4 h-4" />
                  <span>{saveMessageText}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={handleResetFireDept}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>{isFa ? 'بازنشانی پیش‌فرض' : 'Reset Defaults'}</span>
              </button>
              <button
                onClick={handleSaveFireDept}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-red-600/20 cursor-pointer transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isFa ? 'ذخیره و اعمال چیدمان آتش‌نشانی' : 'Save Fire Dept Layout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE / RESET MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-100 dark:bg-red-950/40 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{isFa ? 'تایید بازنشانی' : 'Confirm Reset'}</h4>
            </div>

            <div className="space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">{deleteConfirm.title}</p>
              {deleteConfirm.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{deleteConfirm.description}</p>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={deleteConfirm.onConfirm}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                {isFa ? 'تایید و اجرا' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemSettings({ language, currentUser, onUserUpdateTrigger }: SystemSettingsProps) {
  const isFa = language === 'fa';
  const isAdmin = isUserAdmin(currentUser);

  // Granular RBAC permissions per System Settings sub-tab
  const canAccessOrgStructure = isAdmin || hasPermission(currentUser, 'Org Structure', 'view');
  const canAccessPersonnel = isAdmin || hasPermission(currentUser, 'Org Structure', 'view');
  const canAccessUsers = isAdmin || hasPermission(currentUser, 'User Management', 'view');
  const canAccessNotifications = isAdmin || hasPermission(currentUser, 'Notifications', 'view');
  const canAccessAudit = isAdmin || hasPermission(currentUser, 'Audit Logs', 'view');
  const canAccessUiConfig = isAdmin || hasPermission(currentUser, 'UI Config & Branding', 'view');
  const canAccessApi = isAdmin || hasPermission(currentUser, 'API & Webhooks', 'view');
  const canAccessBackup = isAdmin || hasPermission(currentUser, 'Database Backup', 'view');
  const canAccessAi = isAdmin || hasPermission(currentUser, 'Audit Logs', 'view');

  // Users with ONLY Notifications permission must use the dedicated Alerts & Notifications shortcut, not System Settings
  const canAccessSystemSettingsModule =
    isAdmin ||
    canAccessOrgStructure ||
    canAccessUsers ||
    canAccessAudit ||
    canAccessUiConfig ||
    canAccessApi ||
    canAccessBackup ||
    canAccessAi;

  const allowedSubTabs = React.useMemo(() => {
    const list: Array<'org_structure' | 'personnel' | 'users' | 'notifications' | 'audit' | 'ui_config' | 'integration' | 'automation' | 'backup' | 'ai'> = [];
    if (canAccessOrgStructure) list.push('org_structure');
    if (canAccessPersonnel) list.push('personnel');
    if (canAccessUsers) list.push('users');
    if (canAccessNotifications) list.push('notifications');
    if (canAccessAudit) list.push('audit');
    if (canAccessUiConfig) list.push('ui_config');
    if (canAccessApi) {
      list.push('automation');
      list.push('integration');
    }
    if (canAccessBackup) list.push('backup');
    if (canAccessAi) list.push('ai');
    return list;
  }, [
    canAccessOrgStructure,
    canAccessPersonnel,
    canAccessUsers,
    canAccessNotifications,
    canAccessAudit,
    canAccessUiConfig,
    canAccessApi,
    canAccessBackup,
    canAccessAi,
  ]);

  const [isFullscreenFormOpen, setIsFullscreenFormOpen] = useState(false);

  useEffect(() => {
    const handleToggle = (e: any) => {
      setIsFullscreenFormOpen(!!e.detail?.isOpen);
    };
    window.addEventListener('fullscreenFormToggle', handleToggle);
    return () => window.removeEventListener('fullscreenFormToggle', handleToggle);
  }, []);

  // Active section
  const [activeSubTab, setActiveSubTab] = useState<'org_structure' | 'personnel' | 'users' | 'notifications' | 'audit' | 'ui_config' | 'integration' | 'automation' | 'backup' | 'ai'>(() => {
    try {
      const saved = sessionStorage.getItem('hse_system_settings_active_subtab');
      if (saved && allowedSubTabs.includes(saved as any)) {
        sessionStorage.removeItem('hse_system_settings_active_subtab');
        return saved as any;
      }
    } catch {}
    return allowedSubTabs[0] || 'org_structure';
  });

  // Strictly enforce sub-tab permission guard on state changes
  useEffect(() => {
    if (allowedSubTabs.length > 0 && !allowedSubTabs.includes(activeSubTab)) {
      setActiveSubTab(allowedSubTabs[0]);
    }
  }, [activeSubTab, allowedSubTabs]);

  useEffect(() => {
    const handleSubTabNav = (e: any) => {
      if (e.detail?.tab === 'system' && e.detail?.subItem) {
        const target = e.detail.subItem === 'webhooks' ? 'automation' : e.detail.subItem;
        if (allowedSubTabs.includes(target)) {
          setActiveSubTab(target);
        }
      }
    };
    window.addEventListener('hse-navigate-subtab', handleSubTabNav);
    return () => window.removeEventListener('hse-navigate-subtab', handleSubTabNav);
  }, [allowedSubTabs]);

  if (!canAccessSystemSettingsModule || allowedSubTabs.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md mx-auto space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto animate-bounce" />
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{isFa ? 'عدم دسترسی به تنظیمات سیستم' : 'Access Denied'}</h3>
        <p className="text-xs text-slate-500 font-bold leading-relaxed">
          {isFa 
            ? 'این بخش حاوی داده‌های حساس مدیریتی، ساختار سازمانی و زیرساخت پایگاه داده سیستم بوده و دسترسی به آن منوط به داشتن مجوز مدیریتی مربوطه می‌باشد.'
            : 'Only authorized administrators have access to this environment.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 rtl text-right" style={{ direction: 'rtl' }}>
      
      {/* Tab Switcher Headers */}
      {!isFullscreenFormOpen && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Settings className="w-7 h-7 text-amber-500" />
              <span>{isFa ? 'تنظیمات پیشرفته سیستم و پایگاه داده' : 'Enterprise Admin & DB Hub'}</span>
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1">
              {isFa 
                ? 'پشتیبان‌گیری و بازنشانی دیتابیس اصلی، اتصال درگاه‌های پیامکی و پیکربندی مدل‌های هوش مصنوعی (Gemini)'
                : 'Backup management, SMS gateways configuration, AI engine settings.'}
            </p>
          </div>

          {/* Sub-tabs menu (Filtered strictly by user RBAC permissions) */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-wrap gap-1">
            {canAccessOrgStructure && (
              <button
                onClick={() => setActiveSubTab('org_structure')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'org_structure' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>{isFa ? 'ساختار سازمانی' : 'Org Structure'}</span>
              </button>
            )}
            {canAccessPersonnel && (
              <button
                onClick={() => setActiveSubTab('personnel')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'personnel' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{isFa ? 'اطلاعات پرسنل مجتمع' : 'Personnel Info'}</span>
              </button>
            )}
            {canAccessUsers && (
              <button
                onClick={() => setActiveSubTab('users')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'users' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{isFa ? 'مدیریت کاربران و دسترسی‌ها' : 'User Management & Permissions'}</span>
              </button>
            )}
            {canAccessNotifications && (
              <button
                onClick={() => setActiveSubTab('notifications')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'notifications' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
                id="settings-tab-notifications"
              >
                <Bell className="w-4 h-4 text-amber-500" />
                <span>{isFa ? 'ارسال هشدار فوری HSE و اعلان‌ها' : 'Instant HSE Alerts & Notifications'}</span>
              </button>
            )}
            {canAccessAudit && (
              <button
                onClick={() => setActiveSubTab('audit')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'audit' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>{isFa ? 'لاگ عملیات و ممیزی' : 'Audit Logs'}</span>
              </button>
            )}
            {canAccessUiConfig && (
              <button
                onClick={() => setActiveSubTab('ui_config')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'ui_config' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>{isFa ? 'شخصی‌سازی رابط کاربری' : 'UI Customization'}</span>
              </button>
            )}
            {canAccessApi && (
              <button
                onClick={() => setActiveSubTab('automation')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'automation' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Zap className="w-4 h-4 text-blue-500" />
                <span>{isFa ? 'وب‌هوک و اتوماسیون داخلی' : 'Webhooks & Automation'}</span>
              </button>
            )}
            {canAccessApi && (
              <button
                onClick={() => setActiveSubTab('integration')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'integration' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>{isFa ? 'مدیریت API و سرویس‌ها' : 'API & Services Management'}</span>
              </button>
            )}
            {canAccessBackup && (
              <button
                onClick={() => setActiveSubTab('backup')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'backup' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>{isFa ? 'پشتیبان‌گیری و بازیابی' : 'Backup & Restore'}</span>
              </button>
            )}
            {canAccessAi && (
              <button
                onClick={() => setActiveSubTab('ai')}
                className={`px-4 py-2 text-xs font-black rounded-lg cursor-pointer transition flex items-center gap-1.5 ${
                  activeSubTab === 'ai' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Bot className="w-4 h-4 text-indigo-500" />
                <span>{isFa ? 'مدیریت هوش مصنوعی' : 'AI Management'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* SECTION 0: AI Management UI */}
      {activeSubTab === 'ai' && canAccessAi && (
        <AiManagementTab language={language} currentUser={currentUser} />
      )}

      {/* SECTION 1: Backup & Restore UI */}
      {activeSubTab === 'backup' && canAccessBackup && (
        <BackupRestoreTab isFa={isFa} currentUser={currentUser} />
      )}

      {/* SECTION 2: API & Services Management UI */}
      {activeSubTab === 'integration' && canAccessApi && (
        <ApiManagementTab isFa={isFa} currentUser={currentUser} />
      )}

      {/* SECTION 2.5: Native Automation & Webhook UI */}
      {activeSubTab === 'automation' && canAccessApi && (
        <ApiManagementTab isFa={isFa} currentUser={currentUser} initialSubSection="webhooks" />
      )}

      {/* SECTION 3: UI Customization */}
      {activeSubTab === 'ui_config' && canAccessUiConfig && (
        <UiConfigPanel language={language} currentUser={currentUser} />
      )}
      
      {/* User Management Section */}
      {activeSubTab === 'users' && canAccessUsers && (
        <UserManagement currentUser={currentUser} language={language} onUserUpdateTrigger={onUserUpdateTrigger} />
      )}

      {/* Personnel Management Section */}
      {activeSubTab === 'personnel' && canAccessPersonnel && (
        <PersonnelManagement isFa={isFa} currentUser={currentUser} />
      )}

      {/* Organization Structure Section */}
      {activeSubTab === 'org_structure' && canAccessOrgStructure && (
        <OrganizationMgmt isFa={isFa} currentUser={currentUser} />
      )}

      {/* System Notifications Section */}
      {activeSubTab === 'notifications' && canAccessNotifications && (
        <SystemNotificationsTab isFa={isFa} currentUser={currentUser} shortcutMode={false} />
      )}

      {/* System Audit Logs Section */}
      {activeSubTab === 'audit' && canAccessAudit && (
        <GlobalAuditLogSystem isFa={isFa} />
      )}

    </div>
  );
}
