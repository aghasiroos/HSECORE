import React, { useState, useMemo, useEffect } from 'react';
import {
  Send,
  X,
  UserPlus,
  Trash2,
  Info,
  Users,
  UserCheck,
  Search,
  ArrowUp,
  ArrowDown,
  FileText,
  PenTool,
  CheckCircle2
} from 'lucide-react';
import {
  DocumentReferral,
  DocumentSourceType,
  ReferralActionType,
  ReferralWorkflowMode,
  UserProfile
} from '../../types';
import { getComplexPersonnelList, searchMasterPersonnel, ComplexPersonnel, getPersonnelSignature } from '../../utils/personnelHelper';
import { getSystemUsers, ensureUserAndPersonnelInSync } from '../../utils/authHelper';
import { createDocumentReferral, getPermitDefaultAssignees } from '../../utils/referralHelper';
import { CartablePdfViewerModal } from './CartablePdfViewerModal';
import moment from 'moment-jalaali';

interface CreateReferralModalProps {
  documentType: DocumentSourceType;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  currentUser?: UserProfile | null;
  isFa?: boolean;
  sourcePermit?: any;
  initialPermit?: any;
  permitSignatures?: any;
  initialAssignees?: AssigneeItem[];
  onClose: () => void;
  onSuccess?: (referral: DocumentReferral) => void;
}

interface AssigneeItem {
  id: string;
  source: 'USERS' | 'PERSONNEL';
  personId: string;
  fullName: string;
  jobTitle: string;
  department: string;
  personnelCode: string;
  actionType: ReferralActionType;
  instructions: string;
  deadline?: string;
  approvalTime?: string;
}

export const CreateReferralModal: React.FC<CreateReferralModalProps> = ({
  documentType,
  documentId,
  documentNumber,
  documentTitle,
  currentUser,
  isFa = true,
  sourcePermit,
  initialPermit,
  permitSignatures,
  initialAssignees,
  onClose,
  onSuccess
}) => {
  const [personnelList, setPersonnelList] = useState<ComplexPersonnel[]>(() => getComplexPersonnelList());
  const systemUsers = useMemo(() => getSystemUsers(), []);

  useEffect(() => {
    const refresh = () => setPersonnelList(getComplexPersonnelList());
    window.addEventListener('hse_personnel_updated', refresh);
    window.addEventListener('app_data_mutated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('hse_personnel_updated', refresh);
      window.removeEventListener('app_data_mutated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Form State
  const [workflowMode, setWorkflowMode] = useState<ReferralWorkflowMode>('PARALLEL');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [version, setVersion] = useState('Rev 1.0');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState(() => {
    const nextDate = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    return moment(nextDate).format('jYYYY/jMM/jDD');
  });

  // Target Person Picker State
  const [pickerSource, setPickerSource] = useState<'PERSONNEL' | 'USERS'>('USERS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [selectedActionType, setSelectedActionType] = useState<ReferralActionType>('APPROVE_AND_SIGN');
  const [actionInstruction, setActionInstruction] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Assignees list - for PERMIT pre-populated with the 4 completer-defined signatories & times
  const [assignees, setAssignees] = useState<AssigneeItem[]>(() => {
    if (initialAssignees && initialAssignees.length > 0) {
      return initialAssignees;
    }
    if (documentType === 'PERMIT') {
      const p = sourcePermit || initialPermit || { id: documentId, serialNumber: documentNumber, signatures4Tier: permitSignatures };
      return getPermitDefaultAssignees(p);
    }
    return [];
  });

  // Filtered persons based on search query
  const filteredPersonnel = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return personnelList;
    return searchMasterPersonnel(q, { limit: 50 });
  }, [personnelList, searchQuery]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return systemUsers;
    return systemUsers.filter(u =>
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.jobTitle?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.personnelNumber?.toLowerCase().includes(q)
    );
  }, [systemUsers, searchQuery]);

  const handleAddAssignee = () => {
    if (!selectedPersonId) return;

    let assigneeData: AssigneeItem | null = null;

    if (pickerSource === 'PERSONNEL') {
      const p = personnelList.find(x => String(x.id) === String(selectedPersonId));
      if (!p) return;
      const pCode = (p.personnelCode || p.effectiveCode || '').trim();
      const matchedUser = systemUsers.find(u => 
        (pCode && u.personnelNumber && u.personnelNumber.trim() === pCode) ||
        (u.fullName && u.fullName.trim() === p.fullName?.trim())
      );

      assigneeData = {
        id: `asg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        source: 'PERSONNEL',
        personId: matchedUser ? matchedUser.id : String(p.id),
        fullName: p.fullName,
        jobTitle: p.jobTitle || p.position || 'پرسنل مجتمع',
        department: p.unit || p.department || 'عملیات',
        personnelCode: pCode,
        actionType: selectedActionType,
        instructions: actionInstruction,
        deadline
      };
    } else {
      const u = systemUsers.find(x => String(x.id) === String(selectedPersonId));
      if (!u) return;
      assigneeData = {
        id: `asg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        source: 'USERS',
        personId: String(u.id),
        fullName: u.fullName,
        jobTitle: u.jobTitle || u.role || 'کاربر سامانه',
        department: u.departmentIds?.[0] || 'مدیریت / HSE',
        personnelCode: u.personnelNumber || '',
        actionType: selectedActionType,
        instructions: actionInstruction,
        deadline
      };
    }

    if (assigneeData) {
      ensureUserAndPersonnelInSync({
        id: assigneeData.personId,
        fullName: assigneeData.fullName,
        personnelCode: assigneeData.personnelCode,
        jobTitle: assigneeData.jobTitle,
        department: assigneeData.department
      });
    }

    if (assignees.some(a => String(a.personId) === String(assigneeData!.personId))) {
      setFormError(isFa ? 'این شخص قبلاً به لیست ارجاعات افزوده شده است.' : 'This person has already been added.');
      return;
    }

    setFormError(null);
    setAssignees(prev => [...prev, assigneeData!]);
    setSelectedPersonId('');
    setActionInstruction('');
  };

  const handleRemoveAssignee = (id: string) => {
    setAssignees(prev => prev.filter(a => a.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    
    setAssignees(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === assignees.length - 1) return;
    
    setAssignees(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (assignees.length === 0) {
      setFormError(isFa ? 'لطفاً حداقل یک نفر اقدام‌کننده از پرسنل یا کاربران انتخاب نمایید.' : 'Please add at least one assignee.');
      return;
    }

    const sender = currentUser || systemUsers[0];
    const mappedAssignees = assignees.map((a, idx) => {
      const storedSig = getPersonnelSignature(a);
      const isSenderFirstStep =
        idx === 0 &&
        sender &&
        (a.personId === sender.id ||
          a.fullName?.trim() === sender.fullName?.trim() ||
          (a.personnelCode && sender.personnelNumber && a.personnelCode.trim() === sender.personnelNumber.trim()));
      return {
        id: a.id,
        userId: a.personId,
        userName: a.fullName,
        userRole: a.jobTitle,
        userJobTitle: a.jobTitle,
        department: a.department,
        personnelCode: a.personnelCode,
        actionType: a.actionType,
        approvalTime: a.approvalTime,
        deadline: a.deadline || deadline,
        instructions: a.instructions,
        signatureImage: (a as any).signatureImage || (isSenderFirstStep ? (storedSig || getPersonnelSignature(sender)) : undefined),
        status: ((a as any).status === 'SIGNED' || (a as any).status === 'APPROVED') ? (a as any).status : ('PENDING' as const),
        order: idx + 1
      };
    });
    const referral = createDocumentReferral(
      {
        documentType,
        documentId,
        documentNumber,
        documentTitle,
        version,
        senderId: sender?.id || sender?.username || 'user',
        senderName: sender?.fullName || sender?.username || 'کاربر سیستم',
        senderRole: sender?.role || 'کارشناس HSE',
        senderDepartment: sender?.departmentIds?.[0] || 'مدیریت / ستاد HSE',
        workflowMode,
        priority,
        notes,
        deadline,
        assignees: mappedAssignees
      },
      notes
    );

    if (onSuccess) onSuccess(referral);
    onClose();
  };

  const actionLabels: Record<ReferralActionType, { fa: string; en: string; color: string }> = {
    REVIEW: { fa: 'بررسی و اعلام نظر', en: 'Review', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    APPROVE: { fa: 'تأیید', en: 'Approve', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REJECT: { fa: 'بررسی جهت رد / عدم انطباق', en: 'Reject', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    SIGN: { fa: 'امضای دیجیتال', en: 'Sign', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    APPROVE_AND_SIGN: { fa: 'تأیید و امضا', en: 'Approve & Sign', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <span>{isFa ? 'ارجاع، تأیید و امضای اسناد (سامانه یکپارچه)' : 'Unified Document Referral & Sign'}</span>
                <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs font-mono">{version}</span>
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {documentNumber} • {documentTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-white/30 shadow-xs"
              title={isFa ? 'مشاهده سند رسمی به صورت PDF (فقط مشاهده)' : 'Preview Document as PDF'}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isFa ? 'پیش‌نمایش PDF' : 'Preview PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 font-bold flex items-center justify-between animate-in fade-in">
              <span>{formError}</span>
              <button type="button" onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Config: Mode, Priority, Deadline, Version */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
            {/* Workflow Mode */}
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isFa ? 'نوع گردش کار:' : 'Workflow Mode:'}
              </label>
              <select
                value={workflowMode}
                onChange={e => setWorkflowMode(e.target.value as ReferralWorkflowMode)}
                className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-white text-xs"
              >
                <option value="PARALLEL">{isFa ? 'موازی (همزمان)' : 'Parallel'}</option>
                <option value="SEQUENTIAL">{isFa ? 'ترتیبی (مرحله‌به‌مرحله)' : 'Sequential'}</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isFa ? 'اولویت اقدام:' : 'Priority:'}
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-white text-xs"
              >
                <option value="LOW">{isFa ? 'عادی / کم' : 'Low'}</option>
                <option value="MEDIUM">{isFa ? 'متوسط' : 'Medium'}</option>
                <option value="HIGH">{isFa ? 'فوری / بالا' : 'High'}</option>
                <option value="CRITICAL">{isFa ? 'بحرانی (آنی)' : 'Critical'}</option>
              </select>
            </div>

            {/* Deadline */}
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isFa ? 'مهلت اقدام (شمسی):' : 'Deadline:'}
              </label>
              <input
                type="text"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                placeholder="1405/06/25"
                className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white text-center text-xs"
              />
            </div>

            {/* Document Version Control */}
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {isFa ? 'کنترل نسخه سند:' : 'Document Version:'}
              </label>
              <input
                type="text"
                value={version}
                onChange={e => setVersion(e.target.value)}
                placeholder="Rev 1.0"
                className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-900 dark:text-white text-center text-xs"
              />
            </div>
          </div>

          {/* Recipient Source & Picker Section */}
          <div className="p-3.5 bg-blue-50/50 dark:bg-slate-800/60 rounded-2xl border border-blue-200/60 dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 dark:border-slate-700 pb-2.5">
              <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <UserPlus className="w-4 h-4 text-blue-600" />
                <span>{isFa ? 'انتخاب شخص ارجاع‌شونده:' : 'Select Recipient:'}</span>
              </h4>

              {/* Source Toggle: Personnel Directory vs System Users */}
              <div className="flex items-center bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => { setPickerSource('PERSONNEL'); setSelectedPersonId(''); }}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    pickerSource === 'PERSONNEL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{isFa ? 'اطلاعات پرسنل' : 'Personnel Directory'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPickerSource('USERS'); setSelectedPersonId(''); }}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    pickerSource === 'USERS'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isFa ? 'مدیریت کاربران و نقش‌ها' : 'User Management'}</span>
                </button>
              </div>
            </div>

            {/* Search Filter & Person Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Filter query */}
              <div className="sm:col-span-4 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isFa ? 'جستجوی نام، سمت، واحد...' : 'Filter name, role...'}
                  className="w-full pr-8 pl-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                />
              </div>

              {/* Personnel or User dropdown */}
              <div className="sm:col-span-5">
                <select
                  value={selectedPersonId}
                  onChange={e => setSelectedPersonId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
                >
                  <option value="">
                    {isFa
                      ? pickerSource === 'PERSONNEL'
                        ? `-- انتخاب از پرسنل (${filteredPersonnel.length} نفر) --`
                        : `-- انتخاب از کاربران (${filteredUsers.length} کاربر) --`
                      : '-- Select Person --'}
                  </option>
                  {pickerSource === 'PERSONNEL'
                    ? filteredPersonnel.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.fullName} ({p.jobTitle || 'پرسنل'} - {p.unit || p.department || 'عملیات'})
                        </option>
                      ))
                    : filteredUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.role} - {u.jobTitle || 'کاربر'})
                        </option>
                      ))}
                </select>
              </div>

              {/* Action Type */}
              <div className="sm:col-span-3">
                <select
                  value={selectedActionType}
                  onChange={e => setSelectedActionType(e.target.value as ReferralActionType)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold"
                >
                  <option value="REVIEW">{isFa ? 'بررسی و اعلام نظر' : 'Review'}</option>
                  <option value="APPROVE">{isFa ? 'تأیید' : 'Approve'}</option>
                  <option value="REJECT">{isFa ? 'رد' : 'Reject'}</option>
                  <option value="SIGN">{isFa ? 'امضای دیجیتال' : 'Sign'}</option>
                  <option value="APPROVE_AND_SIGN">{isFa ? 'تأیید و امضا' : 'Approve & Sign'}</option>
                </select>
              </div>
            </div>

            {/* Instruction for this person & Add button */}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={actionInstruction}
                onChange={e => setActionInstruction(e.target.value)}
                placeholder={isFa ? 'دستور و شرح اقدام اختصاصی (اختیاری: مثلاً لطفاً موارد عدم انطباق را بررسی و امضا فرمایید)...' : 'Specific instructions for this assignee...'}
                className="flex-1 p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs"
              />
              <button
                type="button"
                onClick={handleAddAssignee}
                disabled={!selectedPersonId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-xs"
              >
                + {isFa ? 'افزودن به ارجاعات' : 'Add Recipient'}
              </button>
            </div>
          </div>

          {/* List of Added Assignees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                {isFa ? `اشخاص ارجاع‌شونده و ترتیب گردش (${assignees.length} نفر):` : `Assigned Workflow Queue (${assignees.length}):`}
              </label>
              {workflowMode === 'SEQUENTIAL' && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                  {isFa ? 'گردش ترتیبی: اقدام‌کنندگان به ترتیب شماره از ۱ به بعد فعال می‌شوند.' : 'Sequential: Activated step by step.'}
                </span>
              )}
            </div>

            {assignees.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                {isFa ? 'هنوز شخصی جهت ارجاع انتخاب نشده است. از بخش بالا اشخاص را انتخاب و اضافه نمایید.' : 'No assignees added yet.'}
              </div>
            ) : (
              <div className="space-y-1.5">
                {assignees.map((a, idx) => {
                  const meta = actionLabels[a.actionType];
                  return (
                    <div
                      key={a.id}
                      className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Order badge with Up/Down buttons if sequential */}
                        <div className="flex items-center gap-1">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-bold flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          {workflowMode === 'SEQUENTIAL' && (
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => handleMoveUp(idx)}
                                disabled={idx === 0 || idx === 1}
                                className={`p-0.5 cursor-pointer ${
                                  idx === 0 || idx === 1
                                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-blue-600'
                                }`}
                                title="انتقال به مرحله قبل"
                              >
                                <ArrowUp className="w-2.5 h-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDown(idx)}
                                disabled={idx === 0 || idx === assignees.length - 1}
                                className={`p-0.5 cursor-pointer ${
                                  idx === 0 || idx === assignees.length - 1
                                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-blue-600'
                                }`}
                                title="انتقال به مرحله بعد"
                              >
                                <ArrowDown className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-900 dark:text-white">
                              {a.fullName}
                            </span>
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-mono">
                              {a.source === 'PERSONNEL' ? (isFa ? 'پرسنل' : 'Personnel') : (isFa ? 'کاربر سامانه' : 'System User')}
                            </span>
                            {getPersonnelSignature(a) && (
                              <span className="text-[9.5px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded-full font-bold inline-flex items-center gap-0.5">
                                <PenTool className="w-2.5 h-2.5" />
                                <span>{isFa ? 'دارای نمونه امضا' : 'Signature Ready'}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 text-[10px]">
                            {a.jobTitle} • {a.department} {a.personnelCode ? `• کد: ${a.personnelCode}` : ''}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {a.approvalTime && (
                              <span className="text-[9.5px] font-mono font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                                ساعت تایید: {a.approvalTime}
                              </span>
                            )}
                            {a.instructions && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {a.instructions}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 sm:mt-0">
                        <select
                          value={a.actionType}
                          onChange={(e) => {
                            const newType = e.target.value as ReferralActionType;
                            setAssignees(prev => prev.map(item => item.id === a.id ? { ...item, actionType: newType } : item));
                          }}
                          className={`px-2 py-1 rounded-md border text-[10px] font-bold outline-none cursor-pointer ${meta.color} bg-white dark:bg-slate-900`}
                        >
                          <option value="REVIEW">{isFa ? 'بررسی' : 'Review'}</option>
                          <option value="APPROVE">{isFa ? 'تأیید' : 'Approve'}</option>
                          <option value="REJECT">{isFa ? 'رد' : 'Reject'}</option>
                          <option value="SIGN">{isFa ? 'امضا' : 'Sign'}</option>
                          <option value="APPROVE_AND_SIGN">{isFa ? 'تأیید و امضا' : 'Approve & Sign'}</option>
                        </select>
                        
                        <button
                          type="button"
                          onClick={() => handleRemoveAssignee(a.id)}
                          className={`p-1.5 rounded-lg cursor-pointer transition ${
                            idx === 0 
                              ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                              : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400'
                          }`}
                          disabled={idx === 0}
                          title={idx === 0 ? (isFa ? 'تأییدکننده اول (ایجادکننده) قابل حذف نیست.' : 'Cannot remove creator.') : (isFa ? 'حذف شخص' : 'Remove')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* General Notes / Instructions */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {isFa ? 'توضیحات و یادداشت کلی ارجاع:' : 'General Referral Notes:'}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={isFa ? 'توضیحات کلی در خصوص این پرونده، دلایل ارجاع یا الزامات ایمنی...' : 'General referral notes...'}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
            />
          </div>

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              {isFa
                ? 'اقدامات در ممیزی سیستم (Audit Log) و کارتابل گیرندگان ثبت و اعلان ارسال می‌گردد.'
                : 'Referral actions are logged in the audit trail.'}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{isFa ? 'پیش‌نمایش سند (PDF)' : 'Preview PDF'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{isFa ? 'ثبت و ارسال ارجاع' : 'Submit Referral'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* PDF View Modal (View Only) */}
      {showPdfModal && (
        <CartablePdfViewerModal
          referral={{
            id: `preview-${documentId}`,
            documentType,
            documentId,
            documentNumber,
            documentTitle,
            senderId: currentUser?.id || currentUser?.username || 'user',
            senderName: currentUser?.fullName || currentUser?.username || 'کاربر فرستنده',
            senderRole: currentUser?.jobTitle || currentUser?.role || 'مسئول HSE',
            workflowMode,
            overallStatus: 'IN_PROGRESS',
            priority,
            version,
            notes,
            deadline,
            isLocked: false,
            createdDate: new Date().toISOString(),
            createdDatePersian: moment().format('jYYYY/jMM/jDD'),
            updatedDate: new Date().toISOString(),
            assignees: assignees.map((a, idx) => ({
              id: a.id,
              userId: a.personId,
              userName: a.fullName,
              userRole: a.jobTitle,
              userJobTitle: a.jobTitle,
              department: a.department,
              personnelCode: a.personnelCode,
              actionType: a.actionType,
              deadline: a.deadline || deadline,
              instructions: a.instructions,
              status: 'PENDING',
              isCurrentActive: workflowMode === 'PARALLEL' || idx === 0,
              order: idx + 1
            })),
            historyLogs: []
          }}
          isFa={isFa}
          currentUser={currentUser}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
};
