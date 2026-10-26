import React, { useState, useMemo, useEffect } from 'react';
import {
  SlidersHorizontal,
  X,
  Users,
  UserCheck,
  Shield,
  Building,
  Clock,
  Settings,
  Code2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Layers,
  Activity,
  ArrowRight,
  Sliders,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  GitFork,
  ArrowUpRight,
  RotateCcw,
  Search,
  MoveUp,
  MoveDown,
  User,
  UserPlus,
  Filter,
  Sparkles,
  CheckSquare,
  Square,
  HelpCircle,
  FileSpreadsheet,
  Workflow,
  Tag,
  Share2,
  ArrowUpDown
} from 'lucide-react';
import { WorkflowStep, WorkflowApprover, AssigneeType, ApprovalLogic } from '../types';
import {
  getAllSystemUsers,
  getActiveApproverUsers,
  getRolesWithActiveCount,
  getDepartmentsWithActiveCount
} from '../utils/approverHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  language: 'fa' | 'en';
  selectedElement: any | null;
  selectedTaskStep: WorkflowStep | null;
  onUpdateStep: (updatedStep: WorkflowStep) => void;
  onUpdateElementLabel: (elementId: string, newLabel: string) => void;
  onOpenApproverModal: (step: WorkflowStep) => void;
  onOpenApproverMatrix: () => void;
  processName: string;
  setProcessName: (name: string) => void;
  moduleType: string;
  setModuleType: (type: string) => void;
  allSteps: WorkflowStep[];
  propertiesPanelMountRef: React.RefObject<HTMLDivElement>;
}

export default function BpmnPropertiesPanel({
  isOpen,
  onClose,
  language,
  selectedElement,
  selectedTaskStep,
  onUpdateStep,
  onUpdateElementLabel,
  onOpenApproverModal,
  onOpenApproverMatrix,
  processName,
  setProcessName,
  moduleType,
  setModuleType,
  allSteps,
  propertiesPanelMountRef
}: Props) {
  const isFa = language === 'fa';
  const [activeTab, setActiveTab] = useState<'approvers' | 'table' | 'technical'>('approvers');
  const [copiedId, setCopiedId] = useState(false);
  const [localLabel, setLocalLabel] = useState('');
  const [isWide, setIsWide] = useState(false);

  // Modern Properties Table Category Filter
  const [propertyCategory, setPropertyCategory] = useState<'ALL' | 'CORE' | 'APPROVERS' | 'SLA' | 'TOPOLOGY' | 'EXTENSIONS'>('ALL');
  const [approverSearch, setApproverSearch] = useState('');
  const [showAddApproverDropdown, setShowAddApproverDropdown] = useState(false);
  const [matrixSearch, setMatrixSearch] = useState('');
  const [copiedPropsJson, setCopiedPropsJson] = useState(false);

  // Custom Extended BPMN / Camunda Attributes
  const [customAttributes, setCustomAttributes] = useState<Array<{ key: string; value: string }>>([
    { key: 'isExecutable', value: 'true' },
    { key: 'versionTag', value: '1.0.0' },
    { key: 'candidateStarterGroups', value: 'HSE_MANAGERS' },
    { key: 'historyTimeToLive', value: '180' }
  ]);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');

  // All system personnel for quick assignment
  const [allSystemUsers, setAllSystemUsers] = useState<WorkflowApprover[]>(() => getAllSystemUsers());
  const [activeApproverUsers, setActiveApproverUsers] = useState<WorkflowApprover[]>(() => getActiveApproverUsers());
  const [systemRoles, setSystemRoles] = useState<any[]>(() => getRolesWithActiveCount());
  const [systemDepartments, setSystemDepartments] = useState<any[]>(() => getDepartmentsWithActiveCount());

  useEffect(() => {
    const refreshOrgData = () => {
      setAllSystemUsers(getAllSystemUsers());
      setActiveApproverUsers(getActiveApproverUsers());
      setSystemRoles(getRolesWithActiveCount());
      setSystemDepartments(getDepartmentsWithActiveCount());
    };

    window.addEventListener('hse_org_nodes_updated', refreshOrgData);
    window.addEventListener('hse_org_jobs_updated', refreshOrgData);
    window.addEventListener('hse_departments_updated', refreshOrgData);
    window.addEventListener('hse_unit_structure_updated', refreshOrgData);
    window.addEventListener('hse_personnel_updated', refreshOrgData);
    window.addEventListener('app_data_mutated', refreshOrgData);
    window.addEventListener('storage', refreshOrgData);

    return () => {
      window.removeEventListener('hse_org_nodes_updated', refreshOrgData);
      window.removeEventListener('hse_org_jobs_updated', refreshOrgData);
      window.removeEventListener('hse_departments_updated', refreshOrgData);
      window.removeEventListener('hse_unit_structure_updated', refreshOrgData);
      window.removeEventListener('hse_personnel_updated', refreshOrgData);
      window.removeEventListener('app_data_mutated', refreshOrgData);
      window.removeEventListener('storage', refreshOrgData);
    };
  }, []);

  // Switch to approvers tab automatically if a Task is selected
  useEffect(() => {
    if (selectedTaskStep) {
      setActiveTab('approvers');
    } else if (selectedElement) {
      setActiveTab('table');
    }
  }, [selectedTaskStep?.id, selectedElement?.id]);

  // Keep local label in sync with selection
  useEffect(() => {
    if (selectedElement) {
      setLocalLabel(selectedElement.businessObject?.name || selectedTaskStep?.titleFa || '');
    } else {
      setLocalLabel(processName);
    }
  }, [selectedElement?.id, selectedElement?.businessObject?.name, selectedTaskStep?.titleFa, processName]);

  const handleCopyId = (id: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleLabelChange = (val: string) => {
    setLocalLabel(val);
    if (selectedElement) {
      onUpdateElementLabel(selectedElement.id, val);
    } else {
      setProcessName(val);
    }
  };

  // Quick field updates for selectedTaskStep
  const handleAssigneeTypeChange = (type: AssigneeType) => {
    if (!selectedTaskStep) return;
    onUpdateStep({
      ...selectedTaskStep,
      assigneeType: type
    });
  };

  const handleRoleChange = (role: string) => {
    if (!selectedTaskStep) return;
    onUpdateStep({
      ...selectedTaskStep,
      assignedRole: role
    });
  };

  const handleDepartmentChange = (dept: string) => {
    if (!selectedTaskStep) return;
    onUpdateStep({
      ...selectedTaskStep,
      assignedDepartment: dept
    });
  };

  const handleApprovalLogicChange = (logic: ApprovalLogic) => {
    if (!selectedTaskStep) return;
    onUpdateStep({
      ...selectedTaskStep,
      approvalLogic: logic
    });
  };

  const handleSlaChange = (hours: number) => {
    if (!selectedTaskStep) return;
    onUpdateStep({
      ...selectedTaskStep,
      slaHours: Math.max(1, hours)
    });
  };

  const handleActionTypeChange = (actionType: WorkflowStep['actionType']) => {
    if (!selectedTaskStep) return;
    onUpdateStep({
      ...selectedTaskStep,
      actionType
    });
  };

  const handleRemoveUser = (userId: string) => {
    if (!selectedTaskStep) return;
    const updatedIds = (selectedTaskStep.assignedUserIds || []).filter(id => id !== userId);
    const updatedUsers = (selectedTaskStep.assignedUsers || []).filter(u => u.id !== userId);
    onUpdateStep({
      ...selectedTaskStep,
      assignedUserIds: updatedIds,
      assignedUsers: updatedUsers
    });
  };

  const handleAddUserToStep = (user: WorkflowApprover) => {
    if (!selectedTaskStep) return;
    const currentIds = selectedTaskStep.assignedUserIds || [];
    if (currentIds.includes(user.id)) return;
    const currentUsers = selectedTaskStep.assignedUsers || [];
    onUpdateStep({
      ...selectedTaskStep,
      assigneeType: 'user',
      assignedUserIds: [...currentIds, user.id],
      assignedUsers: [...currentUsers, user]
    });
    setApproverSearch('');
    setShowAddApproverDropdown(false);
  };

  const handleMoveUserOrder = (idx: number, direction: 'up' | 'down') => {
    if (!selectedTaskStep) return;
    const users = [...(selectedTaskStep.assignedUsers || [])];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= users.length) return;
    const temp = users[idx];
    users[idx] = users[targetIdx];
    users[targetIdx] = temp;
    onUpdateStep({
      ...selectedTaskStep,
      assignedUsers: users,
      assignedUserIds: users.map(u => u.id)
    });
  };

  const handleAddCustomAttr = () => {
    if (!newAttrKey.trim()) return;
    setCustomAttributes(prev => [...prev, { key: newAttrKey.trim(), value: newAttrVal.trim() }]);
    setNewAttrKey('');
    setNewAttrVal('');
  };

  const handleDeleteCustomAttr = (idx: number) => {
    setCustomAttributes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCopyPropertiesJson = () => {
    const payload = {
      elementId: selectedElement?.id || 'Process_Root',
      elementType: selectedElement?.type || 'bpmn:Process',
      label: localLabel,
      processName,
      moduleType,
      taskStep: selectedTaskStep || null,
      customAttributes
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPropsJson(true);
    setTimeout(() => setCopiedPropsJson(false), 2000);
  };

  // Element Type detection & formatting
  const elementInfo = useMemo(() => {
    if (!selectedElement) {
      return {
        typeLabel: isFa ? 'فرآیند کلی (Process)' : 'Workflow Process',
        typeKey: 'Process',
        badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        id: 'Process_Root',
        isTask: false
      };
    }
    const type = selectedElement.type || '';
    const bo = selectedElement.businessObject || {};
    const id = selectedElement.id || bo.id || '';

    if (type.includes('Task') || type === 'bpmn:UserTask') {
      return {
        typeLabel: isFa ? 'فعالیت / وظیفه (Task)' : 'Workflow Task',
        typeKey: 'Task',
        badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        id,
        isTask: true
      };
    }
    if (type.includes('Gateway')) {
      return {
        typeLabel: isFa ? 'دروازه تصمیم‌گیری (Gateway)' : 'Decision Gateway',
        typeKey: 'Gateway',
        badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        id,
        isTask: false
      };
    }
    if (type.includes('StartEvent')) {
      return {
        typeLabel: isFa ? 'رویداد آغازین (Start Event)' : 'Start Event',
        typeKey: 'StartEvent',
        badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        id,
        isTask: false
      };
    }
    if (type.includes('EndEvent')) {
      return {
        typeLabel: isFa ? 'رویداد پایانی (End Event)' : 'End Event',
        typeKey: 'EndEvent',
        badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        id,
        isTask: false
      };
    }
    if (type.includes('SequenceFlow')) {
      return {
        typeLabel: isFa ? 'جریان توالی (Sequence Flow)' : 'Sequence Flow',
        typeKey: 'SequenceFlow',
        badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
        id,
        isTask: false
      };
    }

    return {
      typeLabel: type.replace('bpmn:', ''),
      typeKey: type,
      badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
      id,
      isTask: false
    };
  }, [selectedElement, isFa]);

  if (!isOpen) return null;

  return (
    <div
      className={`transition-all duration-300 flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 shadow-xl select-none ${
        isWide ? 'w-full sm:w-[540px] lg:w-[620px]' : 'w-84 sm:w-96 lg:w-[460px]'
      }`}
      dir={isFa ? 'rtl' : 'ltr'}
    >
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between p-3 px-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
              {isFa ? 'مشخصات عنصر (Properties)' : 'Element Properties'}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${elementInfo.badgeColor}`}>
                {elementInfo.typeLabel}
              </span>
              <button
                type="button"
                onClick={() => handleCopyId(elementInfo.id)}
                className="text-[10px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5"
                title={isFa ? 'کپی شناسه' : 'Copy ID'}
              >
                <span>({elementInfo.id})</span>
                {copiedId ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsWide(!isWide)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 text-[11px] font-mono hidden md:inline-flex"
            title={isWide ? (isFa ? 'اندازه استاندارد' : 'Normal width') : (isFa ? 'عرض عریض' : 'Wide view')}
          >
            {isWide ? '⟨⟩' : '⟩⟨'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isFa ? 'بستن پنل' : 'Close panel'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Primary Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 px-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('approvers')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'approvers'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isFa ? 'تأییدکنندگان و فرآیند' : 'Approvers & HSE'}</span>
          {selectedTaskStep && ((selectedTaskStep.assignedUsers?.length ?? 0) > 0 || selectedTaskStep.assignedRole) && (
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('table')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'table'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isFa ? 'جدول ویژگی‌ها' : 'Attributes Table'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('technical')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 whitespace-nowrap ${
            activeTab === 'technical'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{isFa ? 'فنی XML' : 'BPMN XML'}</span>
        </button>
      </div>

      {/* 3. Tab Contents */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* ===================== TAB 1: APPROVERS & WORKFLOW HSE ===================== */}
        {activeTab === 'approvers' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* General Element Title & Identifier Input */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{isFa ? 'عنوان مرحله / المان:' : 'Element Label:'}</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedElement?.id || 'Root'}
                </span>
              </div>
              <input
                type="text"
                value={localLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder={isFa ? 'نام مرحله را وارد کنید...' : 'Enter step title...'}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 transition-all"
              />
            </div>

            {/* If Selected Element is a Task */}
            {selectedTaskStep ? (
              <>
                {/* Mode Selector: User | Role | Department */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{isFa ? 'شیوه تخصیص مسئول / تأییدکننده:' : 'Assignee Definition Mode:'}</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <button
                      type="button"
                      onClick={() => handleAssigneeTypeChange('user')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        selectedTaskStep.assigneeType === 'user'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isFa ? 'کاربران' : 'Users'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAssigneeTypeChange('role')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        selectedTaskStep.assigneeType === 'role'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{isFa ? 'نقش' : 'Role'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAssigneeTypeChange('department')}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        selectedTaskStep.assigneeType === 'department'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>{isFa ? 'واحد' : 'Dept'}</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Section 1: USER-BASED ASSIGNMENT */}
                {selectedTaskStep.assigneeType === 'user' && (
                  <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>{isFa ? 'کاربران تأییدکننده این مرحله' : 'Assigned Users'}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-indigo-600 text-white">
                          {selectedTaskStep.assignedUsers?.length || 0}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowAddApproverDropdown(!showAddApproverDropdown)}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>{isFa ? 'افزودن سریع' : 'Quick Add'}</span>
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={() => onOpenApproverModal(selectedTaskStep)}
                          className="text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>{isFa ? 'جستجوی پیشرفته' : 'Advanced'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Quick Add User Dropdown Menu */}
                    {showAddApproverDropdown && (
                      <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-lg space-y-2 animate-in fade-in zoom-in-95 duration-100">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            value={approverSearch}
                            onChange={(e) => setApproverSearch(e.target.value)}
                            placeholder={isFa ? 'جستجوی نام، سمت، کد پرسنلی...' : 'Search user or role...'}
                            className="w-full pr-8 pl-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                          {allSystemUsers
                            .filter(u => !(selectedTaskStep.assignedUserIds || []).includes(u.id))
                            .filter(u =>
                              u.fullName.toLowerCase().includes(approverSearch.toLowerCase()) ||
                              u.jobTitle.toLowerCase().includes(approverSearch.toLowerCase()) ||
                              u.department.toLowerCase().includes(approverSearch.toLowerCase()) ||
                              (u.personnelNumber && u.personnelNumber.includes(approverSearch))
                            )
                            .slice(0, 8)
                            .map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleAddUserToStep(u)}
                                className="w-full text-right p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs flex items-center justify-between transition-colors cursor-pointer group"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                    {u.fullName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate">
                                    {u.jobTitle} • {u.department}
                                  </div>
                                </div>
                                <Plus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Assigned Users List / Chips */}
                    {selectedTaskStep.assignedUsers && selectedTaskStep.assignedUsers.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                        {selectedTaskStep.assignedUsers.map((user, idx) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                  {user.fullName}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {user.jobTitle} • {user.department}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Move Up/Down Buttons */}
                              {selectedTaskStep.assignedUsers.length > 1 && (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveUserOrder(idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition-colors"
                                    title={isFa ? 'انتقال به بالا' : 'Move Up'}
                                  >
                                    <MoveUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveUserOrder(idx, 'down')}
                                    disabled={idx === selectedTaskStep.assignedUsers.length - 1}
                                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition-colors"
                                    title={isFa ? 'انتقال به پایین' : 'Move Down'}
                                  >
                                    <MoveDown className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveUser(user.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                title={isFa ? 'حذف کاربر' : 'Remove'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 text-center">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                          {isFa ? 'هنوز کاربری برای این مرحله تعیین نشده است.' : 'No users assigned yet.'}
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setShowAddApproverDropdown(true)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 text-xs font-bold transition-all"
                          >
                            {isFa ? 'افزودن سریع' : 'Quick Add'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenApproverModal(selectedTaskStep)}
                            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs"
                          >
                            {isFa ? 'انتخاب از جدول سیستم' : 'Select System Users'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Multi-Approver Logic Radio Selector */}
                    <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {isFa ? 'منطق تأیید چندگانه:' : 'Approval Logic:'}
                      </label>
                      <div className="grid grid-cols-3 gap-1 text-[11px]">
                        {[
                          { id: 'all', labelFa: 'اجماع (همه)', labelEn: 'All (AND)' },
                          { id: 'any', labelFa: 'اولین نفر', labelEn: 'Any (OR)' },
                          { id: 'sequential', labelFa: 'ترتیبی', labelEn: 'Sequential' }
                        ].map(logic => (
                          <button
                            key={logic.id}
                            type="button"
                            onClick={() => handleApprovalLogicChange(logic.id as ApprovalLogic)}
                            className={`p-1.5 rounded-lg border text-center font-medium transition-all ${
                              selectedTaskStep.approvalLogic === logic.id
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {isFa ? logic.labelFa : logic.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Section 2: ROLE-BASED ASSIGNMENT */}
                {selectedTaskStep.assigneeType === 'role' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{isFa ? 'انتخاب نقش سازمانی مسئول:' : 'Select Responsible Role:'}</span>
                    </label>
                    <select
                      value={selectedTaskStep.assignedRole || (systemRoles[0]?.id || '')}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                    >
                      {systemRoles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.titleFa}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {isFa
                        ? 'در این حالت وظیفه در کارتابل کلیه کاربرانی که دارای این نقش سازمانی باشند نمایش داده خواهد شد.'
                        : 'Tasks will be dispatched to all users possessing this organizational role.'}
                    </p>
                  </div>
                )}

                {/* Sub-Section 3: DEPARTMENT-BASED ASSIGNMENT */}
                {selectedTaskStep.assigneeType === 'department' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{isFa ? 'انتخاب واحد سازمانی مجری:' : 'Select Department:'}</span>
                    </label>
                    <select
                      value={selectedTaskStep.assignedDepartment || ''}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">{isFa ? '-- انتخاب واحد سازمانی --' : '-- Select Department --'}</option>
                      {systemDepartments.length === 0 && (
                        <option value="" disabled>
                          {isFa ? '⚠️ هنوز واحدی در ساختار سازمانی تعریف نشده است' : '⚠️ No units defined'}
                        </option>
                      )}
                      {systemDepartments.map(dept => (
                        <option key={dept.id} value={dept.name}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {isFa
                        ? 'فرآیند به سرپرست یا کارتابل کلیه پرسنل مستقر در این واحد ارجاع می‌گردد.'
                        : 'Action items will be routed to personnel operating under this business unit.'}
                    </p>
                  </div>
                )}

                {/* Action Type & SLA Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Action Type */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {isFa ? 'نوع اقدام مرحله:' : 'Action Type:'}
                    </label>
                    <select
                      value={selectedTaskStep.actionType || 'approval'}
                      onChange={(e) => handleActionTypeChange(e.target.value as any)}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100"
                    >
                      <option value="approval">{isFa ? 'تأییدیه سازمانی' : 'Approval'}</option>
                      <option value="inspection">{isFa ? 'بازرسی ایمنی' : 'Inspection'}</option>
                      <option value="signature">{isFa ? 'امضای دیجیتال' : 'Signature'}</option>
                      <option value="test">{isFa ? 'تست گازسنجی' : 'Gas Test'}</option>
                      <option value="form">{isFa ? 'تکمیل فرم / چک‌لیست' : 'Fill Form'}</option>
                      <option value="notification">{isFa ? 'اطلاع‌رسانی' : 'Notify'}</option>
                    </select>
                  </div>

                  {/* SLA Hours */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                      <span>{isFa ? 'مهلت اقدام (SLA):' : 'SLA Hours:'}</span>
                      <span className="font-mono text-indigo-600 font-bold">{selectedTaskStep.slaHours || 8}h</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={720}
                      value={selectedTaskStep.slaHours || 8}
                      onChange={(e) => handleSlaChange(parseInt(e.target.value) || 8)}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={() => onOpenApproverModal(selectedTaskStep)}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <Sliders className="w-4 h-4" />
                  <span>{isFa ? 'تنظیمات پیشرفته و تخصیص تأییدکنندگان' : 'Full Approver Configuration Modal'}</span>
                </button>
              </>
            ) : (
              /* Non-Task Element Selected (Gateway, Event, Flow or Process) */
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>
                    {selectedElement
                      ? (isFa ? `مشخصات المان ${elementInfo.typeLabel}` : `${elementInfo.typeLabel} Settings`)
                      : (isFa ? 'مشخصات سراسری فرآیند' : 'Global Process Settings')}
                  </span>
                </div>

                {!selectedElement ? (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-[11px] text-slate-500 font-bold block mb-1">
                        {isFa ? 'ماژول مرتبط:' : 'Module:'}
                      </label>
                      <select
                        value={moduleType}
                        onChange={(e) => setModuleType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                      >
                        <option value="ptw-management">{isFa ? 'سیستم پروانه کار (PTW)' : 'Work Permits (PTW)'}</option>
                        <option value="heat-stress">{isFa ? 'پایش استرس گرمایی' : 'Heat Stress'}</option>
                        <option value="incident-reporting">{isFa ? 'گزارش و تحلیل حوادث' : 'Incidents'}</option>
                        <option value="risk-assessment">{isFa ? 'ارزیابی ریسک FMEA/JSA' : 'Risk Assessment'}</option>
                        <option value="hse-ms">{isFa ? 'مدیریت استانداردهای HSE-MS' : 'HSE-MS Audit'}</option>
                      </select>
                    </div>

                    <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">{isFa ? 'تعداد کل گام‌های تعریف‌شده:' : 'Total Steps:'}</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{allSteps.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">{isFa ? 'گام‌های با تأییدکننده:' : 'Configured Steps:'}</span>
                        <span className="font-mono font-bold text-indigo-600">
                          {allSteps.filter(s => (s.assignedUsers?.length ?? 0) > 0 || s.assignedRole || s.assignedDepartment).length}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onOpenApproverMatrix}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-indigo-400" />
                      <span>{isFa ? 'مشاهده ماتریس کلیه تأییدکنندگان' : 'Open Approvers Matrix'}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {isFa
                      ? 'برای این نوع المان، تخصیص مستقیم تأییدکننده انسانی فعال نیست. جهت بررسی مشخصات یا شروط از زبانه «جدول ویژگی‌ها» استفاده کنید.'
                      : 'Human approver assignment applies specifically to tasks. View and edit routing rules under the Attributes Table tab.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 2: COMPREHENSIVE ATTRIBUTES & APPROVERS TABLE ===================== */}
        {activeTab === 'table' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header & Category Filter Bar */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isFa ? 'جدول مشخصات و ویژگی‌های جامع (Properties)' : 'Comprehensive Properties Grid'}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopyPropertiesJson}
                    className="p-1 px-2 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                    title={isFa ? 'کپی مشخصات به عنوان JSON' : 'Copy JSON'}
                  >
                    {copiedPropsJson ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{isFa ? (copiedPropsJson ? 'کپی شد' : 'خروجی JSON') : 'JSON'}</span>
                  </button>
                </div>
              </div>

              {/* Category Pills Navigation */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 text-[11px] font-medium">
                {[
                  { id: 'ALL', labelFa: 'همه خصیصه‌ها', labelEn: 'All' },
                  { id: 'CORE', labelFa: 'شناسنامه BPMN', labelEn: 'Core' },
                  {
                    id: 'APPROVERS',
                    labelFa: 'تأییدکنندگان گردش‌کار',
                    labelEn: 'Approvers',
                    count: selectedTaskStep ? (selectedTaskStep.assignedUsers?.length || (selectedTaskStep.assigneeType !== 'user' ? 1 : 0)) : allSteps.length
                  },
                  { id: 'SLA', labelFa: 'اقدام و SLA', labelEn: 'SLA' },
                  { id: 'TOPOLOGY', labelFa: 'مسیرها و شروط', labelEn: 'Topology' },
                  { id: 'EXTENSIONS', labelFa: 'خصیصه‌های توسعه', labelEn: 'Extensions', count: customAttributes.length }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setPropertyCategory(cat.id as any)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                      propertyCategory === cat.id
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{isFa ? cat.labelFa : cat.labelEn}</span>
                    {cat.count !== undefined && (
                      <span className={`px-1 py-0.2 rounded-full text-[9px] font-mono ${
                        propertyCategory === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ================= SECTION 1: BPMN CORE IDENTITY ================= */}
            {(propertyCategory === 'ALL' || propertyCategory === 'CORE') && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFa ? 'شناسنامه ساختاری المان BPMN' : 'BPMN Element Identity'}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{selectedElement?.id || 'Process_Root'}</span>
                </div>

                <table className="w-full text-right text-xs">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                    {/* Element ID */}
                    <tr>
                      <td className="p-2.5 text-slate-500 dark:text-slate-400 font-medium w-1/3">
                        {isFa ? 'شناسه BPMN' : 'BPMN ID'}
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedElement?.id || 'Process_Root'}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(selectedElement?.id || 'Process_Root')}
                          className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded transition-colors"
                          title={isFa ? 'کپی شناسه' : 'Copy'}
                        >
                          {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>

                    {/* Element Type */}
                    <tr>
                      <td className="p-2.5 text-slate-500 dark:text-slate-400 font-medium">
                        {isFa ? 'نوع استاندارد المان' : 'BPMN Element Type'}
                      </td>
                      <td className="p-2.5 text-slate-800 dark:text-slate-200">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${elementInfo.badgeColor}`}>
                          {elementInfo.typeLabel}
                        </span>
                      </td>
                    </tr>

                    {/* Label / Name with inline edit */}
                    <tr>
                      <td className="p-2.5 text-slate-500 dark:text-slate-400 font-medium">
                        {isFa ? 'عنوان / برچسب نمایشی' : 'Display Label'}
                      </td>
                      <td className="p-2 text-slate-800 dark:text-slate-200 font-bold">
                        <input
                          type="text"
                          value={localLabel}
                          onChange={(e) => handleLabelChange(e.target.value)}
                          placeholder={isFa ? 'عنوان مرحله یا المان را وارد کنید...' : 'Enter label...'}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                        />
                      </td>
                    </tr>

                    {/* Parent Process Name */}
                    <tr>
                      <td className="p-2.5 text-slate-500 dark:text-slate-400 font-medium">
                        {isFa ? 'فرآیند مرجع' : 'Process Workflow'}
                      </td>
                      <td className="p-2.5 text-slate-800 dark:text-slate-200 font-medium">
                        {processName}
                      </td>
                    </tr>

                    {/* Connected HSE Module */}
                    <tr>
                      <td className="p-2.5 text-slate-500 dark:text-slate-400 font-medium">
                        {isFa ? 'ماژول HSE تخصصی' : 'HSE Domain'}
                      </td>
                      <td className="p-2.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                          {moduleType === 'ptw-management' ? (isFa ? 'سیستم پروانه کار (PTW)' : 'Work Permits')
                            : moduleType === 'heat-stress' ? (isFa ? 'پایش استرس گرمایی' : 'Heat Stress')
                            : moduleType === 'incident-reporting' ? (isFa ? 'گزارش و تحلیل حوادث' : 'Incidents')
                            : moduleType === 'risk-assessment' ? (isFa ? 'ارزیابی ریسک' : 'Risk Assessment')
                            : (isFa ? 'مدیریت HSE-MS' : 'HSE-MS')}
                        </span>
                      </td>
                    </tr>

                    {/* Topology Flow Status */}
                    <tr>
                      <td className="p-2.5 text-slate-500 dark:text-slate-400 font-medium">
                        {isFa ? 'وضعیت اتصالات' : 'Connectivity'}
                      </td>
                      <td className="p-2.5 text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{selectedElement?.incoming?.length || 0} {isFa ? 'ورودی' : 'In'}</span>
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>{selectedElement?.outgoing?.length || 0} {isFa ? 'خروجی' : 'Out'}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* ================= SECTION 2: WORKFLOW APPROVERS DEFINITION & ALLOCATION ================= */}
            {(propertyCategory === 'ALL' || propertyCategory === 'APPROVERS') && (
              <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 overflow-hidden bg-white dark:bg-slate-900 shadow-xs space-y-0">
                {/* Section Header */}
                <div className="px-3.5 py-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                      {isFa ? 'تخصیص و تعریف جامع تأییدکنندگان گردش‌کار' : 'Workflow Approver Allocation & Matrix'}
                    </span>
                  </div>
                  {selectedTaskStep && (
                    <button
                      type="button"
                      onClick={() => onOpenApproverModal(selectedTaskStep)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{isFa ? 'پنجره تفصیلی' : 'Modal'}</span>
                    </button>
                  )}
                </div>

                {/* Case A: Selected element is a Task Step */}
                {selectedTaskStep ? (
                  <div className="p-3.5 space-y-3.5">
                    {/* Mode Switcher */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                        <span>{isFa ? 'شیوه تخصیص مسئولیت مرحله:' : 'Assignee Allocation Mode:'}</span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                          {selectedTaskStep.assigneeType === 'user' ? (isFa ? 'کاربران معین' : 'Users')
                            : selectedTaskStep.assigneeType === 'role' ? (isFa ? 'نقش سازمانی' : 'Role')
                            : (isFa ? 'واحد سازمانی' : 'Department')}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                        <button
                          type="button"
                          onClick={() => handleAssigneeTypeChange('user')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            selectedTaskStep.assigneeType === 'user'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{isFa ? 'کاربران' : 'Users'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAssigneeTypeChange('role')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            selectedTaskStep.assigneeType === 'role'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>{isFa ? 'نقش' : 'Role'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAssigneeTypeChange('department')}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            selectedTaskStep.assigneeType === 'department'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        >
                          <Building className="w-3.5 h-3.5" />
                          <span>{isFa ? 'واحد' : 'Dept'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Mode 1: Specific Users */}
                    {selectedTaskStep.assigneeType === 'user' && (
                      <div className="space-y-2.5">
                        {/* Inline Quick Add User Search Box */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{isFa ? 'افزودن سریع تأییدکننده به این مرحله:' : 'Quick Assign Approver:'}</span>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {allSystemUsers.length} {isFa ? 'پرسنل در سیستم' : 'Users available'}
                            </span>
                          </div>

                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                            <input
                              type="text"
                              value={approverSearch}
                              onChange={(e) => setApproverSearch(e.target.value)}
                              placeholder={isFa ? 'نام کاربر، سمت شغلی، کد پرسنلی را تایپ کنید...' : 'Search name, title, code...'}
                              className="w-full pr-8 pl-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                            />
                          </div>

                          {/* Quick selection chips from filtered list */}
                          <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 pt-1">
                            {allSystemUsers
                              .filter(u => !(selectedTaskStep.assignedUserIds || []).includes(u.id))
                              .filter(u =>
                                !approverSearch ||
                                u.fullName.toLowerCase().includes(approverSearch.toLowerCase()) ||
                                u.jobTitle.toLowerCase().includes(approverSearch.toLowerCase()) ||
                                u.department.toLowerCase().includes(approverSearch.toLowerCase()) ||
                                (u.personnelNumber && u.personnelNumber.includes(approverSearch))
                              )
                              .slice(0, 6)
                              .map(u => (
                                <div
                                  key={u.id}
                                  className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 hover:border-indigo-300 transition-colors"
                                >
                                  <div className="min-w-0 pr-1">
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                      {u.fullName} {u.personnelNumber && <span className="font-mono text-[10px] text-slate-400">({u.personnelNumber})</span>}
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {u.jobTitle} • {u.department}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddUserToStep(u)}
                                    className="px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center gap-0.5 shrink-0 transition-colors cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>{isFa ? 'تخصیص' : 'Assign'}</span>
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* List of currently assigned approvers table */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <span>{isFa ? 'لیست تأییدکنندگان تخصیص‌یافته:' : 'Assigned Approvers List:'}</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold">
                              {selectedTaskStep.assignedUsers?.length || 0} {isFa ? 'نفر' : 'users'}
                            </span>
                          </div>

                          {selectedTaskStep.assignedUsers && selectedTaskStep.assignedUsers.length > 0 ? (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/60">
                              {selectedTaskStep.assignedUsers.map((user, idx) => (
                                <div
                                  key={user.id}
                                  className="p-2 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                                        <span>{user.fullName}</span>
                                        {user.accountStatus === 'Active' ? (
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title={isFa ? 'کاربر فعال' : 'Active'} />
                                        ) : (
                                          <span className="text-[9px] px-1 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                            {isFa ? 'غیرفعال' : 'Inactive'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {user.jobTitle} • {user.department}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Move Order Up/Down for Sequential */}
                                    {selectedTaskStep.assignedUsers.length > 1 && (
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveUserOrder(idx, 'up')}
                                          disabled={idx === 0}
                                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 rounded"
                                          title={isFa ? 'انتقال به بالا (ترتیب اولویت)' : 'Move Up'}
                                        >
                                          <MoveUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveUserOrder(idx, 'down')}
                                          disabled={idx === selectedTaskStep.assignedUsers.length - 1}
                                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20 rounded"
                                          title={isFa ? 'انتقال به پایین (ترتیب اولویت)' : 'Move Down'}
                                        >
                                          <MoveDown className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveUser(user.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                      title={isFa ? 'حذف کاربر' : 'Remove'}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 rounded-lg border border-dashed border-amber-300 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20 text-center">
                              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                {isFa ? 'هیچ تأییدکننده‌ای برای این مرحله تعریف نشده است.' : 'No approvers defined yet.'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Multi-Approver Logic Cards */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>{isFa ? 'منطق تصمیم‌گیری و گردش چندگانه:' : 'Multi-Approval Decision Rule:'}</span>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {selectedTaskStep.approvalLogic === 'all' ? (isFa ? 'اجماع کامل (All)' : 'All (AND)')
                                : selectedTaskStep.approvalLogic === 'any' ? (isFa ? 'اولین نفر (Any)' : 'Any (OR)')
                                : (isFa ? 'زنجیره ترتیبی (Seq)' : 'Sequential')}
                            </span>
                          </label>

                          <div className="grid grid-cols-3 gap-1 text-[11px]">
                            {[
                              { id: 'all', labelFa: 'اجماع (همه)', labelEn: 'All (AND)', descFa: 'همه افراد باید تأیید کنند' },
                              { id: 'any', labelFa: 'اولین نفر', labelEn: 'Any (OR)', descFa: 'تأیید یک نفر کافی است' },
                              { id: 'sequential', labelFa: 'ترتیبی', labelEn: 'Sequential', descFa: 'به ترتیب ردیف کاربران' }
                            ].map(logic => (
                              <button
                                key={logic.id}
                                type="button"
                                onClick={() => handleApprovalLogicChange(logic.id as ApprovalLogic)}
                                className={`p-1.5 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                                  selectedTaskStep.approvalLogic === logic.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                                }`}
                              >
                                <div className="text-[11px] font-bold">{isFa ? logic.labelFa : logic.labelEn}</div>
                                <div className="text-[9px] opacity-75 mt-0.5">{isFa ? logic.descFa : logic.id}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mode 2: Role Based */}
                    {selectedTaskStep.assigneeType === 'role' && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-indigo-600" />
                          <span>{isFa ? 'انتخاب نقش سازمانی مسئول:' : 'Select Responsible Role:'}</span>
                        </label>
                        <select
                          value={selectedTaskStep.assignedRole || (systemRoles[0]?.id || '')}
                          onChange={(e) => handleRoleChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                        >
                          {systemRoles.map(role => (
                            <option key={role.id} value={role.id}>
                              {role.titleFa}
                            </option>
                          ))}
                        </select>
                        <div className="p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[10px] text-indigo-900 dark:text-indigo-300">
                          {systemRoles.find(r => r.id === (selectedTaskStep.assignedRole || (systemRoles[0]?.id || '')))?.descFa || 'نقش سازمانی'}
                        </div>
                      </div>
                    )}

                    {/* Mode 3: Department Based */}
                    {selectedTaskStep.assigneeType === 'department' && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                          <Building className="w-4 h-4 text-indigo-600" />
                          <span>{isFa ? 'انتخاب واحد سازمانی مجری:' : 'Select Department:'}</span>
                        </label>
                        <select
                          value={selectedTaskStep.assignedDepartment || ''}
                          onChange={(e) => handleDepartmentChange(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="">{isFa ? '-- انتخاب واحد سازمانی --' : '-- Select Department --'}</option>
                          {systemDepartments.length === 0 && (
                            <option value="" disabled>
                              {isFa ? '⚠️ هنوز واحدی در ساختار سازمانی تعریف نشده است' : '⚠️ No units defined'}
                            </option>
                          )}
                          {systemDepartments.map(dept => (
                            <option key={dept.id} value={dept.name}>
                              {dept.name} ({dept.code})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span>{isFa ? 'مدیر مسئول واحد:' : 'Department Head:'}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {systemDepartments.find(d => d.name === (selectedTaskStep.assignedDepartment || ''))?.manager || 'تعیین نشده'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Case B: Process Root or Non-Task Element - FULL WORKFLOW APPROVERS MATRIX */
                  <div className="p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        {isFa ? `ماتریس کلیه مراحل و تأییدکنندگان (${allSteps.length} گام فرآیند):` : `Process Steps & Approvers Matrix (${allSteps.length} steps):`}
                      </div>
                      <button
                        type="button"
                        onClick={onOpenApproverMatrix}
                        className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3 h-3" />
                        <span>{isFa ? 'ماتریس کشویی' : 'Full Matrix'}</span>
                      </button>
                    </div>

                    {/* Matrix search input */}
                    <div className="relative">
                      <Search className="w-3 h-3 absolute right-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={matrixSearch}
                        onChange={(e) => setMatrixSearch(e.target.value)}
                        placeholder={isFa ? 'جستجو در مراحل، عناوین، مسئولان...' : 'Filter process steps...'}
                        className="w-full pr-7 pl-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>

                    {/* Matrix Table */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                      <table className="w-full text-right text-[11px]">
                        <thead>
                          <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                            <th className="p-2 font-bold w-6 text-center">#</th>
                            <th className="p-2 font-bold">{isFa ? 'عنوان گام' : 'Step Title'}</th>
                            <th className="p-2 font-bold">{isFa ? 'تأییدکننده / مسئول' : 'Approver'}</th>
                            <th className="p-2 font-bold text-center">{isFa ? 'SLA' : 'SLA'}</th>
                            <th className="p-2 font-bold text-center w-12">{isFa ? 'اقدام' : 'Act'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                          {allSteps
                            .filter(s =>
                              !matrixSearch ||
                              s.titleFa.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                              s.id.toLowerCase().includes(matrixSearch.toLowerCase()) ||
                              (s.assignedRole && s.assignedRole.toLowerCase().includes(matrixSearch.toLowerCase())) ||
                              (s.assignedDepartment && s.assignedDepartment.toLowerCase().includes(matrixSearch.toLowerCase())) ||
                              (s.assignedUsers && s.assignedUsers.some(u => u.fullName.toLowerCase().includes(matrixSearch.toLowerCase())))
                            )
                            .map((step, idx) => (
                              <tr key={step.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors">
                                <td className="p-2 font-mono text-[10px] text-slate-400 text-center">
                                  {idx + 1}
                                </td>
                                <td className="p-2 min-w-0">
                                  <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                                    {step.titleFa}
                                  </div>
                                  <div className="text-[9px] font-mono text-slate-400 truncate">
                                    {step.id}
                                  </div>
                                </td>
                                <td className="p-2">
                                  {step.assigneeType === 'user' ? (
                                    step.assignedUsers && step.assignedUsers.length > 0 ? (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[10px]">
                                          {step.assignedUsers.map(u => u.fullName.split(' ')[0]).join('، ')}
                                        </span>
                                        <span className="text-[9px] px-1 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                                          {step.assignedUsers.length}نفر
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                        {isFa ? 'تعیین نشده' : 'None'}
                                      </span>
                                    )
                                  ) : step.assigneeType === 'role' ? (
                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                      نقش {step.assignedRole}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[100px] block">
                                      واحد {step.assignedDepartment || (isFa ? 'نامشخص' : 'Unassigned')}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2 font-mono text-[10px] text-center font-bold text-slate-700 dark:text-slate-300">
                                  {step.slaHours || 8}h
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => onOpenApproverModal(step)}
                                    className="p-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 rounded transition-colors"
                                    title={isFa ? 'تخصیص و ویرایش تأییدکنندگان این مرحله' : 'Configure Approvers'}
                                  >
                                    <Sliders className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================= SECTION 3: ACTION TYPE & SLA SPECIFICATIONS ================= */}
            {(propertyCategory === 'ALL' || propertyCategory === 'SLA') && selectedTaskStep && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFa ? 'پارامترهای اجرایی و توافق‌نامه سطح خدمت (SLA)' : 'Action Type & SLA Parameters'}</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-indigo-600">{selectedTaskStep.slaHours || 8} {isFa ? 'ساعت' : 'hrs'}</span>
                </div>

                <div className="p-3.5 space-y-3">
                  {/* Action Type Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {isFa ? 'نوع اقدام عملیاتی مرحله:' : 'Action Type:'}
                    </label>
                    <select
                      value={selectedTaskStep.actionType || 'approval'}
                      onChange={(e) => handleActionTypeChange(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      <option value="approval">{isFa ? 'تأییدیه و موافقت سازمانی (Approval)' : 'Approval'}</option>
                      <option value="inspection">{isFa ? 'بازرسی میدانی و ایمنی (Field Inspection)' : 'Inspection'}</option>
                      <option value="signature">{isFa ? 'امضای دیجیتال و تعهدنامه (Signature)' : 'Signature'}</option>
                      <option value="gas_test">{isFa ? 'تست گازسنجی و عوامل زیان‌آور (Gas Test)' : 'Gas Test'}</option>
                      <option value="form">{isFa ? 'تکمیل فرم و چک‌لیست بازرسی (Form/Checklist)' : 'Form Checklist'}</option>
                      <option value="notification">{isFa ? 'اطلاع‌رسانی و ارسال نوتیفیکیشن (Notification)' : 'Notification'}</option>
                    </select>
                  </div>

                  {/* SLA Hours Control with Quick Presets */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {isFa ? 'مهلت زمانی مجاز اقدام (SLA Limit):' : 'SLA Limit:'}
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={720}
                          value={selectedTaskStep.slaHours || 8}
                          onChange={(e) => handleSlaChange(Number(e.target.value))}
                          className="w-16 px-2 py-0.5 text-center font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-indigo-600"
                        />
                        <span className="text-[10px] text-slate-400">{isFa ? 'ساعت' : 'hrs'}</span>
                      </div>
                    </div>

                    {/* Quick SLA Pills */}
                    <div className="grid grid-cols-5 gap-1 pt-1">
                      {[2, 4, 8, 24, 48].map(h => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleSlaChange(h)}
                          className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                            (selectedTaskStep.slaHours || 8) === h
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          {h} {isFa ? 'ساعت' : 'h'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SECTION 4: FLOW TOPOLOGY & CONDITIONS ================= */}
            {(propertyCategory === 'ALL' || propertyCategory === 'TOPOLOGY') && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <GitFork className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFa ? 'اتصالات جریان و شرایط انشعاب (Flow Topology)' : 'Flow Topology & Routing'}</span>
                  </span>
                </div>

                <div className="p-3.5 space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-medium">{isFa ? 'مسیرهای ورودی (Incoming):' : 'Incoming Flows:'}</div>
                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {selectedElement?.incoming ? `${selectedElement.incoming.length} مسیر متصل` : (isFa ? 'ندارد (آغازین)' : 'None')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] text-slate-400 font-medium">{isFa ? 'مسیرهای خروجی (Outgoing):' : 'Outgoing Flows:'}</div>
                      <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {selectedElement?.outgoing ? `${selectedElement.outgoing.length} مسیر متصل` : (isFa ? 'ندارد (پایانی)' : 'None')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SECTION 5: CUSTOM EXTENDED CAMUNDA ATTRIBUTES ================= */}
            {(propertyCategory === 'ALL' || propertyCategory === 'EXTENSIONS') && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
                <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isFa ? 'خصیصه‌های توسعه‌یافته و متغیرها (BPMN Extensions)' : 'Extended Attributes'}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{customAttributes.length} {isFa ? 'ویژگی' : 'items'}</span>
                </div>

                <div className="p-3.5 space-y-2.5">
                  {/* Attributes Table */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-right text-[11px]">
                      <thead>
                        <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <th className="p-2 font-bold">{isFa ? 'کلید (Key)' : 'Key'}</th>
                          <th className="p-2 font-bold">{isFa ? 'مقدار (Value)' : 'Value'}</th>
                          <th className="p-2 font-bold w-8 text-center">{isFa ? 'حذف' : 'Del'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[10px]">
                        {customAttributes.map((attr, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-bold text-indigo-600 dark:text-indigo-400">{attr.key}</td>
                            <td className="p-2 text-slate-700 dark:text-slate-300">{attr.value}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomAttr(idx)}
                                className="text-slate-400 hover:text-rose-600"
                                title={isFa ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add New Attribute Form */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={newAttrKey}
                      onChange={(e) => setNewAttrKey(e.target.value)}
                      placeholder={isFa ? 'نام کلید (مثال: formKey)' : 'Key name...'}
                      className="w-1/2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={newAttrVal}
                      onChange={(e) => setNewAttrVal(e.target.value)}
                      placeholder={isFa ? 'مقدار...' : 'Value...'}
                      className="w-1/2 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomAttr}
                      className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer"
                      title={isFa ? 'افزودن صفت' : 'Add Attribute'}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Action Footer Buttons */}
            <div className="pt-2 flex items-center gap-2">
              {selectedTaskStep && (
                <button
                  type="button"
                  onClick={() => onOpenApproverModal(selectedTaskStep)}
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{isFa ? 'تخصیص تفصیلی تأییدکنندگان' : 'Configure Approvers'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenApproverMatrix}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isFa ? 'ماتریس فرآیند' : 'Matrix'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: TECHNICAL BPMN-JS NATIVE XML MOUNT ===================== */}
        <div className={activeTab === 'technical' ? 'block' : 'hidden'}>
          <div className="mb-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {isFa
                ? 'پنل استاندارد فنی BPMN جهت تنظیم خصیصه‌های مستقیم XML، Listenerها و فرمت‌های اجرایی Camunda:'
                : 'Native technical BPMN XML properties panel for raw Camunda execution parameters:'}
            </span>
          </div>

          {/* Mount point for bpmn-js properties provider */}
          <div
            ref={propertiesPanelMountRef}
            className="flex-1 custom-scrollbar"
            style={{ direction: 'ltr' }}
          />
        </div>
      </div>
    </div>
  );
}
