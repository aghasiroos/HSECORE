import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  User,
  Users,
  Shield,
  Building,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  MoveUp,
  MoveDown,
  AlertTriangle,
  FileCheck2,
  CheckSquare,
  Square,
  Info,
  Sliders,
  Filter,
  Trash2,
  Plus
} from 'lucide-react';
import { WorkflowStep, WorkflowApprover, AssigneeType, ApprovalLogic } from '../types';
import {
  getAllSystemUsers,
  getActiveApproverUsers,
  getRolesWithActiveCount,
  getDepartmentsWithActiveCount,
  deleteSystemApprover,
  saveSystemApprover
} from '../utils/approverHelper';
import { addAuditLog } from '../../../utils/authHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  step: WorkflowStep;
  onSaveStep: (updatedStep: WorkflowStep) => void;
  language: 'fa' | 'en';
}

export default function StepApproverModal({
  isOpen,
  onClose,
  step,
  onSaveStep,
  language
}: Props) {
  const isFa = language === 'fa';

  const [titleFa, setTitleFa] = useState(step.titleFa || '');
  const [actionType, setActionType] = useState(step.actionType || 'approval');
  const [slaHours, setSlaHours] = useState(step.slaHours || 8);
  const [assigneeType, setAssigneeType] = useState<AssigneeType>(step.assigneeType || 'user');
  
  // Selected Users
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(step.assignedUserIds || []);
  const [approvalLogic, setApprovalLogic] = useState<ApprovalLogic>(step.approvalLogic || 'all');
  
  // Selected Role & Department
  const [selectedRole, setSelectedRole] = useState(step.assignedRole || 'SafetyInspector');
  const [selectedDepartment, setSelectedDepartment] = useState(step.assignedDepartment || 'مدیریت ایمنی، بهداشت و محیط زیست (HSE)');

  // Filters for user selection
  const [userSearch, setUserSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const [allUsers, setAllUsers] = useState<WorkflowApprover[]>([]);
  const [activeUsers, setActiveUsers] = useState<WorkflowApprover[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [deleteConfirmUser, setDeleteConfirmUser] = useState<WorkflowApprover | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    jobTitle: '',
    role: 'User',
    department: ''
  });

  const loadData = () => {
    const loadedAll = getAllSystemUsers();
    const dynamicRoles = getRolesWithActiveCount();
    const dynamicDepts = getDepartmentsWithActiveCount();
    
    setAllUsers(loadedAll);
    setActiveUsers(getActiveApproverUsers());
    setRoles(dynamicRoles);
    setDepartments(dynamicDepts);

    // If selected role is not set or invalid, select the first dynamic role
    setSelectedRole(prev => {
      if (prev && dynamicRoles.some(r => r.id === prev)) return prev;
      return dynamicRoles.length > 0 ? dynamicRoles[0].id : prev;
    });

    // If selected department is not set or invalid, select the first dynamic department
    setSelectedDepartment(prev => {
      if (prev && dynamicDepts.some(d => d.name === prev)) return prev;
      return dynamicDepts.length > 0 ? dynamicDepts[0].name : prev;
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }

    const handleDataChanged = () => {
      if (isOpen) {
        loadData();
      }
    };

    window.addEventListener('hse_org_nodes_updated', handleDataChanged);
    window.addEventListener('hse_org_jobs_updated', handleDataChanged);
    window.addEventListener('hse_departments_updated', handleDataChanged);
    window.addEventListener('hse_unit_structure_updated', handleDataChanged);
    window.addEventListener('hse_personnel_updated', handleDataChanged);
    window.addEventListener('app_data_mutated', handleDataChanged);
    window.addEventListener('storage', handleDataChanged);

    return () => {
      window.removeEventListener('hse_org_nodes_updated', handleDataChanged);
      window.removeEventListener('hse_org_jobs_updated', handleDataChanged);
      window.removeEventListener('hse_departments_updated', handleDataChanged);
      window.removeEventListener('hse_unit_structure_updated', handleDataChanged);
      window.removeEventListener('hse_personnel_updated', handleDataChanged);
      window.removeEventListener('app_data_mutated', handleDataChanged);
      window.removeEventListener('storage', handleDataChanged);
    };
  }, [isOpen]);

  // Filtered list of users for display
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      const matchesSearch = 
        u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.jobTitle.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.personnelNumber && u.personnelNumber.includes(userSearch));

      const matchesDept = deptFilter === 'ALL' || u.department.includes(deptFilter);
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

      return matchesSearch && matchesDept && matchesRole;
    });
  }, [allUsers, userSearch, deptFilter, roleFilter]);

  // Check if any previously assigned user is now inactive
  const inactiveAssignedUsers = useMemo(() => {
    return allUsers.filter(u => selectedUserIds.includes(u.id) && u.accountStatus !== 'Active');
  }, [allUsers, selectedUserIds]);

  if (!isOpen) return null;

  const toggleUserSelection = (userId: string, isUserActive: boolean) => {
    if (!isUserActive) {
      alert(isFa ? 'امکان تخصیص کاربران غیرفعال وجود ندارد. لطفا از کاربران فعال سیستم انتخاب نمایید.' : 'Inactive users cannot be assigned.');
      return;
    }

    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedUserIds(prev => [...prev, userId]);
    }
  };

  const handleMoveUserOrder = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= selectedUserIds.length) return;

    const newList = [...selectedUserIds];
    const temp = newList[idx];
    newList[idx] = newList[targetIdx];
    newList[targetIdx] = temp;
    setSelectedUserIds(newList);
  };

  const handleSave = () => {
    const assignedUsers: WorkflowApprover[] = selectedUserIds
      .map(id => allUsers.find(u => u.id === id))
      .filter((u): u is WorkflowApprover => Boolean(u));

    const selectedRoleObj = roles.find(r => r.id === selectedRole);

    const updated: WorkflowStep = {
      ...step,
      titleFa,
      actionType: actionType as any,
      slaHours: Number(slaHours) || 8,
      assigneeType,
      assignedRole: assigneeType === 'role' ? selectedRole : step.assignedRole,
      assignedRoleName: assigneeType === 'role' ? (selectedRoleObj?.titleFa || selectedRole) : step.assignedRoleName,
      assignedDepartment: assigneeType === 'department' ? selectedDepartment : undefined,
      assignedUserIds: assigneeType === 'user' ? selectedUserIds : [],
      assignedUsers: assigneeType === 'user' ? assignedUsers : [],
      approvalLogic: assigneeType === 'user' ? approvalLogic : 'all',
      requiresSubstitute: inactiveAssignedUsers.length > 0,
      substituteReason: inactiveAssignedUsers.length > 0 ? 'تأییدکننده غیرفعال شده است' : undefined
    };

    // Audit log entry
    addAuditLog(
      'current_user',
      `تخصیص تأییدکنندگان گام «${titleFa}» (${assigneeType})`,
      'موفقیت‌آمیز'
    );

    onSaveStep(updated);
    onClose();
  };

  const executeDeleteUser = () => {
    if (!deleteConfirmUser) return;
    deleteSystemApprover(deleteConfirmUser.id);
    
    // Also remove them from selected IDs if they were selected
    setSelectedUserIds(prev => prev.filter(id => id !== deleteConfirmUser.id));

    addAuditLog('current_user', `حذف کاربر از لیست تاییدکنندگان: ${deleteConfirmUser.fullName}`, 'موفقیت‌آمیز');
    
    setDeleteConfirmUser(null);
    loadData();
  };

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.fullName) {
      alert(isFa ? 'لطفاً نام کامل و نام کاربری را وارد کنید.' : 'Please enter full name and username.');
      return;
    }
    
    saveSystemApprover({
      id: `user-${newUser.username}`,
      username: newUser.username,
      fullName: newUser.fullName,
      jobTitle: newUser.jobTitle || '',
      role: newUser.role,
      department: newUser.department || 'واحد HSE',
      accountStatus: 'Active',
      personnelNumber: Math.floor(1000 + Math.random() * 9000).toString()
    });

    addAuditLog('current_user', `ایجاد کاربر جدید: ${newUser.fullName}`, 'موفقیت‌آمیز');
    
    setNewUser({ username: '', fullName: '', jobTitle: '', role: 'User', department: '' });
    setIsAddUserOpen(false);
    loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {isFa ? 'تنظیمات تأییدکنندگان و مسئول مرحله فرآیند' : 'Configure Step Approvers & Assignees'}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  {step.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isFa 
                  ? 'انتخاب کاربران فعال، نقش‌ها، واحدهای سازمانی و منطق تأیید چندمرحله‌ای (همه / یکی / به ترتیب)' 
                  : 'Assign active users, roles, units, and approval logic (All / Any / Sequential)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Step Meta: Title, Action Type, SLA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isFa ? 'عنوان مرحله در فرآیند:' : 'Step Title:'}
              </label>
              <input
                type="text"
                value={titleFa}
                onChange={e => setTitleFa(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                placeholder={isFa ? 'عنوان گام...' : 'Step title...'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isFa ? 'نوع اقدام مرحله:' : 'Action Type:'}
              </label>
              <select
                value={actionType}
                onChange={e => setActionType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="approval">{isFa ? 'تأییدیه و موافقت (Approval)' : 'Approval'}</option>
                <option value="inspection">{isFa ? 'بازرسی میدانی و چک‌لیست (Inspection)' : 'Field Inspection'}</option>
                <option value="signature">{isFa ? 'امضای دیجیتال و تعهد (Signature)' : 'Signature'}</option>
                <option value="form">{isFa ? 'تکمیل فرم و داده‌ها (Data Entry)' : 'Form Data'}</option>
                <option value="test">{isFa ? 'تست و گازسنجی ایمنی (Safety Test)' : 'Safety Test'}</option>
                <option value="notification">{isFa ? 'اطلاع‌رسانی (Notification)' : 'Notification'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>{isFa ? 'مهلت انجام (SLA به ساعت):' : 'SLA Target (Hours):'}</span>
              </label>
              <input
                type="number"
                min="1"
                max="720"
                value={slaHours}
                onChange={e => setSlaHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-medium font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Inactive Users Warning Banner if applicable */}
          {inactiveAssignedUsers.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold">
                  {isFa ? 'هشدار وضعیت کاربر تخصیص‌یافته:' : 'Assigned User Status Warning:'}
                </div>
                <div className="text-xs mt-1">
                  {isFa
                    ? `کاربر «${inactiveAssignedUsers.map(u => u.fullName).join('، ')}» در بخش مدیریت کاربران و دسترسی‌ها غیرفعال شده است. در صورت حفظ این کاربر، در گردش‌کار اخطار «نیازمند تعیین جانشین» صادر خواهد شد.`
                    : 'One or more assigned users are inactive. Please substitute or update assignment.'}
                </div>
              </div>
            </div>
          )}

          {/* Assignee Type Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {isFa ? 'انتخاب نحوه تخصیص مسئول تأیید (Assignee Entity):' : 'Assignee Category:'}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAssigneeType('user')}
                className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                  assigneeType === 'user'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                <span>{isFa ? 'کاربران مشخص (Users)' : 'Specific Users'}</span>
                {selectedUserIds.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-mono">
                    {selectedUserIds.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setAssigneeType('role')}
                className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                  assigneeType === 'role'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>{isFa ? 'نقش سازمانی (Role)' : 'Organizational Role'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAssigneeType('department')}
                className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-xs font-bold transition-all ${
                  assigneeType === 'department'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>{isFa ? 'واحد سازمانی (Department)' : 'Department'}</span>
              </button>
            </div>
          </div>

          {/* Mode 1: Specific Users Selection */}
          {assigneeType === 'user' && (
            <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
              
              {/* Multi-approver Logic Selection Bar */}
              {selectedUserIds.length > 1 && (
                <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      {isFa ? 'منطق بررسی و تأیید بین کاربران انتخاب‌شده:' : 'Multi-approver Evaluation Logic:'}
                    </span>
                    <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                      {selectedUserIds.length} {isFa ? 'تأییدکننده' : 'approvers'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setApprovalLogic('all')}
                      className={`p-3 rounded-lg border text-right transition-all ${
                        approvalLogic === 'all'
                          ? 'border-blue-600 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{isFa ? 'همه افراد (All / AND)' : 'All Approvers (AND)'}</span>
                        {approvalLogic === 'all' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {isFa ? 'تمامی افراد باید نظر تایید خود را ثبت کنند (اجماع کامل).' : 'Full consensus required.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setApprovalLogic('any')}
                      className={`p-3 rounded-lg border text-right transition-all ${
                        approvalLogic === 'any'
                          ? 'border-blue-600 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{isFa ? 'یکی از افراد (Any / OR)' : 'Any Approver (OR)'}</span>
                        {approvalLogic === 'any' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {isFa ? 'با اقدام و تأیید اولین نفر، مرحله بلافاصله تکمیل می‌شود.' : 'First response completes task.'}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setApprovalLogic('sequential')}
                      className={`p-3 rounded-lg border text-right transition-all ${
                        approvalLogic === 'sequential'
                          ? 'border-blue-600 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>{isFa ? 'به ترتیب (Sequential)' : 'Sequential Chain'}</span>
                        {approvalLogic === 'sequential' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {isFa ? 'به نوبت و بر اساس ترتیب چیدمان به افراد ارجاع می‌شود.' : 'Routed sequentially in order.'}
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Selected Users Sequential Ordering Strip (if sequential) */}
              {selectedUserIds.length > 1 && approvalLogic === 'sequential' && (
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <ArrowUpDown className="w-4 h-4 text-blue-600" />
                    {isFa ? 'ترتیب گردش کار مرحله (اولویت دریافت کار):' : 'Sequential Order of Approvals:'}
                  </div>
                  <div className="space-y-1.5">
                    {selectedUserIds.map((userId, idx) => {
                      const user = allUsers.find(u => u.id === userId);
                      if (!user) return null;
                      return (
                        <div
                          key={userId}
                          className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {user.fullName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              ({user.jobTitle})
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveUserOrder(idx, 'up')}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                              title={isFa ? 'حرکت به بالا' : 'Move up'}
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === selectedUserIds.length - 1}
                              onClick={() => handleMoveUserOrder(idx, 'down')}
                              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                              title={isFa ? 'حرکت به پایین' : 'Move down'}
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* User Directory Filters */}
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex-1">
                  {isFa ? 'لیست کاربران سیستم:' : 'System Users Directory:'}
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isFa ? 'افزودن کاربر جدید' : 'Add New User'}</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder={isFa ? 'جستجو بر اساس نام، کلمه کاربری یا سمت...' : 'Search by name, username, title...'}
                    className="w-full pr-9 pl-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">{isFa ? 'همه واحدهای سازمانی' : 'All Departments'}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>

                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">{isFa ? 'همه نقش‌ها و دسترسی‌ها' : 'All Roles'}</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.titleFa}</option>
                  ))}
                </select>
              </div>

              {/* Users Directory Table / Cards */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      {isFa ? 'کاربری با این مشخصات یافت نشد.' : 'No users found matching criteria.'}
                    </div>
                  ) : (
                    filteredUsers.map(user => {
                      const isSelected = selectedUserIds.includes(user.id);
                      const isActive = user.accountStatus === 'Active';

                      return (
                        <div
                          key={user.id}
                          onClick={() => toggleUserSelection(user.id, isActive)}
                          className={`flex items-center justify-between p-3 transition-colors cursor-pointer ${
                            !isActive
                              ? 'opacity-60 bg-rose-50/20 dark:bg-rose-950/10'
                              : isSelected
                              ? 'bg-blue-50/80 dark:bg-blue-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-blue-600 dark:text-blue-400">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {user.fullName}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                  @{user.username}
                                </span>
                                {user.personnelNumber && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    {user.personnelNumber}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span>{user.jobTitle}</span>
                                <span className="text-slate-300 dark:text-slate-700">•</span>
                                <span>{user.department}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                                {user.role}
                              </span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  isActive
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                }`}
                              >
                                {isActive ? (isFa ? 'فعال' : 'Active') : (isFa ? 'غیرفعال' : 'Inactive')}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmUser(user);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                              title={isFa ? 'حذف کاربر از سیستم' : 'Delete user'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Role Selection */}
          {assigneeType === 'role' && (
            <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFa 
                  ? 'وظیفه به تمام کاربران فعال دارای این نقش اختصاص یافته و هر کاربری با این نقش می‌تواند اقدام کند:' 
                  : 'Task will be assigned to all active users holding this role:'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                {roles.length === 0 ? (
                  <div className="col-span-full p-6 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    {isFa ? 'هیچ نقشی در تب واحدها و مشاغل عملیاتی یافت نشد.' : 'No roles found in Operational Jobs.'}
                  </div>
                ) : (
                  roles.map(r => {
                    const isSelected = selectedRole === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRole(r.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{r.titleFa}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold">
                            {r.activeCount} {isFa ? 'کاربر فعال' : 'active'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {r.descFa}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Mode 3: Department Selection */}
          {assigneeType === 'department' && (
            <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFa 
                  ? 'وظیفه در کارتابل واحد سازمانی مربوطه قرار گرفته و توسط مسئول یا ناظران واحد تکمیل می‌گردد:' 
                  : 'Task will be assigned to the queue of the selected department:'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                {departments.length === 0 ? (
                  <div className="col-span-full p-6 text-center text-slate-400 dark:text-slate-500 text-xs border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    {isFa ? 'هیچ واحد سازمانی در تب ساختار و چارت یا تب واحدها و مشاغل عملیاتی یافت نشد.' : 'No departments found.'}
                  </div>
                ) : (
                  departments.map(dept => {
                    const isSelected = selectedDepartment === dept.name;
                    return (
                      <div
                        key={dept.id}
                        onClick={() => setSelectedDepartment(dept.name)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{dept.name}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">
                            {dept.activeCount} {isFa ? 'عضو فعال' : 'members'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {isFa ? `مسئول واحد: ${dept.manager || 'تعیین نشده'}` : `Manager: ${dept.manager || 'N/A'}`}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {assigneeType === 'user' && (
              <span>
                {selectedUserIds.length > 0 
                  ? (isFa ? `${selectedUserIds.length} کاربر برای این مرحله انتخاب شده است.` : `${selectedUserIds.length} users assigned.`)
                  : (isFa ? 'هیچ کاربری انتخاب نشده است.' : 'No users selected.')}
              </span>
            )}
            {assigneeType === 'role' && (
              <span>{isFa ? `نقش انتخابی: ${selectedRole}` : `Selected Role: ${selectedRole}`}</span>
            )}
            {assigneeType === 'department' && (
              <span>{isFa ? `واحد انتخابی: ${selectedDepartment}` : `Selected Dept: ${selectedDepartment}`}</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-xs transition-all"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>{isFa ? 'ذخیره و انتساب تأییدکنندگان' : 'Save & Assign Approvers'}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Delete User Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-[60]" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 dark:border-slate-800 pb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'تأیید حذف کاربر از سامانه' : 'Confirm User Deletion'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
              {isFa ? (
                <span>
                  آیا از حذف کاربر <strong className="text-slate-950 bg-slate-100 px-1 py-0.5 rounded">«{deleteConfirmUser.fullName}»</strong> به طور کامل اطمینان دارید؟
                </span>
              ) : (
                <span>
                  Are you sure you want to permanently delete user <strong className="text-slate-950 bg-slate-100 px-1 py-0.5 rounded">"{deleteConfirmUser.fullName}"</strong>?
                </span>
              )}
            </p>
            
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={executeDeleteUser}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {isFa ? 'بله، حذف شود' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-[70]" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                {isFa ? 'ایجاد کاربر جدید در سیستم' : 'Create New User'}
              </h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{isFa ? 'نام و نام خانوادگی' : 'Full Name'}</label>
                <input
                  type="text"
                  value={newUser.fullName}
                  onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{isFa ? 'نام کاربری (کد پرسنلی/ایمیل)' : 'Username'}</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{isFa ? 'عنوان شغلی / سمت' : 'Job Title'}</label>
                <input
                  type="text"
                  value={newUser.jobTitle}
                  onChange={e => setNewUser({ ...newUser, jobTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{isFa ? 'نقش سیستمی' : 'Role'}</label>
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    {roles.map(r => <option key={r.id} value={r.id}>{r.titleFa}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{isFa ? 'واحد سازمانی' : 'Department'}</label>
                  <select
                    value={newUser.department}
                    onChange={e => setNewUser({ ...newUser, department: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="">{isFa ? 'انتخاب...' : 'Select...'}</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={handleCreateUser}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {isFa ? 'ذخیره کاربر' : 'Save User'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
