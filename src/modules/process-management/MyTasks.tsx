import React, { useEffect, useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  Flame,
  HeartPulse,
  GraduationCap,
  ClipboardCheck,
  Layers,
  Search,
  Filter,
  RefreshCw,
  X,
  Send,
  CornerUpLeft,
  XCircle,
  UserCheck,
  FileText,
  MessageSquare,
  History,
  CheckSquare,
  AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { WorkflowTask } from './types';
import { getCurrentUser } from '../../utils/authHelper';
import { getActiveClientUserHeaderPayload, getAuthToken } from '../../services/apiDatabaseClient';
import { CartablePdfViewerModal } from '../../components/referral/CartablePdfViewerModal';
import { DocumentReferral } from '../../types';

interface Props {
  language: 'fa' | 'en';
  onRefreshStats?: () => void;
}

const priorityMeta: Record<string, { fa: string; en: string; badge: string }> = {
  critical: { fa: 'بحرانی (Critical)', en: 'Critical', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40' },
  high: { fa: 'فوری / بالا', en: 'High', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40' },
  medium: { fa: 'متوسط', en: 'Medium', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40' },
  low: { fa: 'عادی / کم', en: 'Low', badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' }
};

export default function MyTasks({ language, onRefreshStats }: Props) {
  const isFa = language === 'fa';
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected task for interactive drawer/modal
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [instanceDetails, setInstanceDetails] = useState<any | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(false);
  const [pdfReferral, setPdfReferral] = useState<DocumentReferral | null>(null);

  // Action form state
  const [actionComments, setActionComments] = useState('');
  const [digitalSignConfirmed, setDigitalSignConfirmed] = useState(true);
  const [delegateUser, setDelegateUser] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const buildRequestHeaders = () => {
    const headers: Record<string, string> = { ...getActiveClientUserHeaderPayload() };
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/v1/process-management/tasks', {
        headers: buildRequestHeaders()
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setTasks(res.data.data);
      }
    } catch (e) {
      console.error(e);
      toast.error(isFa ? 'خطا در بارگذاری کارتابل وظایف' : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const handleRemoteMutation = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('task') || entity.includes('workflow') || entity.includes('process')) {
        fetchTasks();
      }
    };

    window.addEventListener('hse_tasks_updated', fetchTasks);
    window.addEventListener('hse_process_management_updated', fetchTasks);
    window.addEventListener('app_data_mutated', handleRemoteMutation);
    window.addEventListener('hse_data_mutated', handleRemoteMutation);

    return () => {
      window.removeEventListener('hse_tasks_updated', fetchTasks);
      window.removeEventListener('hse_process_management_updated', fetchTasks);
      window.removeEventListener('app_data_mutated', handleRemoteMutation);
      window.removeEventListener('hse_data_mutated', handleRemoteMutation);
    };
  }, []);

  const openTaskActionModal = async (task: WorkflowTask) => {
    setSelectedTask(task);
    setActionComments('');
    setDigitalSignConfirmed(true);
    setDelegateUser('');

    try {
      setLoadingInstance(true);
      const res = await axios.get(`/api/v1/process-management/instances/${task.instanceId}`, {
        headers: buildRequestHeaders()
      });
      if (res.data.success) {
        setInstanceDetails(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingInstance(false);
    }
  };

  const openTaskPdfViewer = (task: WorkflowTask) => {
    const p: DocumentReferral = {
      id: task.id,
      documentType: 'OTHER_DOC',
      documentId: task.instanceId,
      documentNumber: `TASK-${task.id.toUpperCase()}`,
      documentTitle: `${task.title} (${task.workflowName})`,
      senderId: task.assignee || 'system',
      senderName: task.assignee || 'مدیر فرآیند و گردش‌کار',
      senderRole: task.assignedRole,
      workflowMode: 'SEQUENTIAL',
      overallStatus: task.status === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      priority: (task.priority?.toUpperCase() as any) || 'MEDIUM',
      version: 'Rev 1.0',
      notes: `فرآیند سازمانی: ${task.workflowName} | گام جاری: ${task.stepTitleFa || task.stepTitleEn}`,
      deadline: new Date(new Date(task.creationTime).getTime() + 48 * 3600 * 1000).toLocaleDateString('fa-IR'),
      isLocked: task.status === 'COMPLETED',
      createdDate: task.creationTime,
      createdDatePersian: new Date(task.creationTime).toLocaleDateString('fa-IR'),
      updatedDate: new Date().toISOString(),
      assignees: [
        {
          id: 'asg-1',
          userId: task.assignee || 'current',
          userName: task.assignedRole || 'مسئول بررسی',
          actionType: 'APPROVE_AND_SIGN',
          status: task.status === 'COMPLETED' ? 'APPROVED' : 'PENDING',
          isCurrentActive: true,
          order: 1
        }
      ],
      historyLogs: []
    };
    setPdfReferral(p);
  };

  const handleExecuteTaskAction = async (action: 'APPROVE' | 'REJECT' | 'RETURN' | 'DELEGATE' | 'COMMENT') => {
    if (!selectedTask) return;

    if (action === 'REJECT' && !actionComments.trim()) {
      toast.error(isFa ? 'لطفاً دلیل رد درخواست را در یادداشت وارد نمایید.' : 'Please provide rejection reasons.');
      return;
    }

    if (!digitalSignConfirmed && (action === 'APPROVE' || action === 'REJECT')) {
      toast.error(isFa ? 'لطفاً تایید امضای دیجیتال را علامت بزنید.' : 'Please confirm your digital signature.');
      return;
    }

    try {
      setIsProcessing(true);
      const user = getCurrentUser();
      const res = await axios.post(`/api/v1/process-management/tasks/${selectedTask.id}/action`, {
        action,
        actor: user?.username || 'current_user',
        actorName: user?.fullName || user?.username || 'کاربر مسئول HSE',
        comments: actionComments || (action === 'APPROVE' ? 'مورد تایید و انطباق کامل با ضوابط ایمنی است.' : ''),
        delegateTo: delegateUser || undefined,
        variables: {
          lastAction: action,
          actionTimestamp: new Date().toISOString()
        }
      }, {
        headers: buildRequestHeaders()
      });

      if (res.data.success) {
        const actionLabelsFa = {
          APPROVE: 'تایید و ارسال به مرحله بعد انجام شد.',
          REJECT: 'درخواست با موفقیت رد و پرونده مختومه گردید.',
          RETURN: 'درخواست جهت اصلاح به مرحله قبل عودت داده شد.',
          DELEGATE: 'وظیفه به کاربر مشخص شده ارجاع گردید.',
          COMMENT: 'یادداشت کارشناسی ثبت گردید.'
        };
        toast.success(isFa ? actionLabelsFa[action] : `Task ${action.toLowerCase()} completed.`);
        setSelectedTask(null);
        setInstanceDetails(null);
        fetchTasks();
        onRefreshStats?.();
      }
    } catch (error) {
      toast.error(isFa ? 'خطا در پردازش وظیفه' : 'Error processing task');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesStatus = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      t.title.toLowerCase().includes(q) ||
      t.workflowName.toLowerCase().includes(q) ||
      t.stepTitleFa.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q);
    return matchesStatus && matchesPriority && matchesSearch;
  });

  const pendingCount = tasks.filter(t => t.status === 'PENDING').length;
  const criticalCount = tasks.filter(t => (t.priority === 'critical' || t.priority === 'high') && t.status === 'PENDING').length;

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-amber-500" />
            {isFa ? 'کارتابل هوشمند وظایف و تاییدات گردش‌کار (Tasklist)' : 'Smart Tasklist & Workflow Approvals'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isFa
              ? 'ارجاعات، تاییدیه‌ها و اقدامات ایمنی منتظر اقدام شما یا واحد سازمانی مربوطه'
              : 'Assigned workflow items, action requests, approvals, and inspections awaiting your review'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
              <AlertTriangle className="w-3.5 h-3.5" />
              {criticalCount} {isFa ? 'مورد فوری / بحرانی' : 'Urgent items'}
            </span>
          )}

          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isFa ? 'جستجو در وظایف...' : 'Search tasks...'}
              className="pr-9 pl-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 w-52 sm:w-60"
            />
          </div>

          <button
            onClick={fetchTasks}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            title={isFa ? 'بروزرسانی کارتابل' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'pending', labelFa: 'منتظر اقدام', labelEn: 'Pending', count: pendingCount },
            { id: 'all', labelFa: 'همه وظایف', labelEn: 'All Tasks', count: tasks.length },
            { id: 'completed', labelFa: 'تکمیل شده‌ها', labelEn: 'Completed', count: tasks.filter(t => t.status === 'COMPLETED').length },
            { id: 'rejected', labelFa: 'رد شده‌ها', labelEn: 'Rejected', count: tasks.filter(t => t.status === 'REJECTED').length },
            { id: 'returned', labelFa: 'عودت داده شده', labelEn: 'Returned', count: tasks.filter(t => t.status === 'RETURNED').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>{isFa ? tab.labelFa : tab.labelEn}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">{isFa ? 'اولویت:' : 'Priority:'}</span>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="all">{isFa ? 'همه اولویت‌ها' : 'All'}</option>
            <option value="critical">{isFa ? 'بحرانی' : 'Critical'}</option>
            <option value="high">{isFa ? 'بالا' : 'High'}</option>
            <option value="medium">{isFa ? 'متوسط' : 'Medium'}</option>
            <option value="low">{isFa ? 'کم' : 'Low'}</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500 mb-3"></div>
            <p className="text-xs text-slate-400">{isFa ? 'در حال بارگذاری کارتابل...' : 'Loading tasklist...'}</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500/60 mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'هیچ کار منتظری در این بخش وجود ندارد.' : 'No pending tasks in this view.'}
            </p>
            <p className="text-xs text-slate-400">
              {isFa ? 'همه ارجاعات و گردش‌کارهای مربوطه بررسی و تکمیل شده‌اند.' : 'All assigned tasks have been resolved.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filteredTasks.map(task => {
              const pMeta = priorityMeta[task.priority] || priorityMeta.medium;
              const isPending = task.status === 'PENDING';

              return (
                <div
                  key={task.id}
                  onClick={() => openTaskActionModal(task)}
                  className={`cursor-pointer group bg-white dark:bg-slate-800 rounded-2xl p-4.5 border transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isPending
                      ? 'border-slate-200/90 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600'
                      : 'border-slate-100 dark:border-slate-800/60 opacity-80'
                  }`}
                >
                  {/* Left content */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isPending ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {task.id}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${pMeta.badge}`}>
                          {isFa ? pMeta.fa : pMeta.en}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {task.department || 'واحد HSE'}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {task.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{isFa ? 'فرآیند:' : 'Workflow:'} <strong className="text-slate-700 dark:text-slate-200">{task.workflowName}</strong></span>
                        <span>•</span>
                        <span>{isFa ? 'گام فعلی:' : 'Current Step:'} <strong className="text-blue-600 dark:text-blue-400">{isFa ? task.stepTitleFa : task.stepTitleEn}</strong></span>
                        <span>•</span>
                        <span>{isFa ? 'نقش مسئول:' : 'Role:'} <strong className="text-slate-700 dark:text-slate-200">{task.assignedRole}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Right actions & deadline */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-700/60">
                    <div className="text-right rtl:text-right ltr:text-left text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>
                        {new Date(task.creationTime).toLocaleDateString(isFa ? 'fa-IR' : 'en-US')}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTaskPdfViewer(task);
                        }}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title={isFa ? 'مشاهده سند و فرم فرآیند به صورت PDF (فقط مشاهده)' : 'View Task as PDF'}
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{isFa ? 'مشاهده سند (PDF)' : 'View PDF'}</span>
                      </button>

                      {isPending ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskActionModal(task);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>{isFa ? 'بررسی و تایید' : 'Review & Action'}</span>
                        </button>
                      ) : (
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {task.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Task Approval Drawer / Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      {isFa ? 'ایستگاه تصمیم‌گیری و تایید گردش‌کار' : 'Workflow Approval & Action Gate'}
                    </h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {selectedTask.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{selectedTask.workflowName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openTaskPdfViewer(selectedTask)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title={isFa ? 'مشاهده فرم به صورت PDF (فقط مشاهده)' : 'View as PDF'}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{isFa ? 'مشاهده سند (PDF)' : 'View PDF'}</span>
                </button>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 text-xs">
              {/* Task info summary card */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                <div className="flex justify-between items-start">
                  <span className="text-slate-500">{isFa ? 'موضوع:' : 'Subject:'}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-left rtl:text-right max-w-[70%]">
                    {selectedTask.title}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 text-[11px]">
                  <div>
                    <span className="text-slate-400">{isFa ? 'گام جاری:' : 'Step:'}</span>{' '}
                    <strong className="text-blue-600 dark:text-blue-400">{isFa ? selectedTask.stepTitleFa : selectedTask.stepTitleEn}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">{isFa ? 'نقش تعیین‌شده:' : 'Role:'}</span>{' '}
                    <strong className="text-slate-700 dark:text-slate-200">{selectedTask.assignedRole}</strong>
                  </div>
                </div>
              </div>

              {/* Submitted Variables & Data */}
              {selectedTask.variables && Object.keys(selectedTask.variables).length > 0 && (
                <div>
                  <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    {isFa ? 'اطلاعات و متغیرهای ثبت شده در فرآیند' : 'Process Variables & Details'}
                  </h5>
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-200/70 dark:border-slate-700/50 space-y-1.5">
                    {Object.entries(selectedTask.variables).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="font-mono text-slate-400">{key}:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action comment box */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'نظریه و یادداشت کارشناسی (توضیحات تایید یا علت رد/عودت)' : 'Decision Notes & Comments'}
                </label>
                <textarea
                  rows={3}
                  value={actionComments}
                  onChange={(e) => setActionComments(e.target.value)}
                  placeholder={isFa ? 'توضیحات تخصصی، الزامات کنترلی پیوست یا دلایل تصمیم‌گیری...' : 'Enter your comments...'}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* Digital Signature Confirmation Checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={digitalSignConfirmed}
                  onChange={(e) => setDigitalSignConfirmed(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[11px] font-bold text-blue-900 dark:text-blue-300">
                  {isFa
                    ? 'صحت اطلاعات فوق را تایید نموده و این تصمیم با هویت و امضای دیجیتال بنده در سامانه HSE ثبت می‌گردد.'
                    : 'I verify the accuracy and confirm this action with my digital signature.'}
                </span>
              </label>

              {/* History trail preview */}
              {instanceDetails?.instance?.history && (
                <div className="pt-2">
                  <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-slate-400" />
                    {isFa ? 'تاریخچه اقدامات قبلی در این گردش‌کار' : 'Audit Trail & Previous Steps'}
                  </h5>
                  <div className="space-y-2">
                    {instanceDetails.instance.history.map((hist: any, i: number) => (
                      <div key={i} className="flex items-start gap-2.5 text-[11px] p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">
                          {hist.action}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <strong>{hist.actorName || hist.actor}</strong>
                            <span>{new Date(hist.timestamp).toLocaleTimeString(isFa ? 'fa-IR' : 'en-US')}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 mt-0.5">{hist.comments || hist.stepTitleFa}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Toolbar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExecuteTaskAction('RETURN')}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  title={isFa ? 'عودت به گام قبل جهت اصلاح' : 'Return for Correction'}
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  <span>{isFa ? 'عودت جهت اصلاح' : 'Return'}</span>
                </button>

                <button
                  onClick={() => handleExecuteTaskAction('REJECT')}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  title={isFa ? 'رد کامل و ابطال گردش‌کار' : 'Reject & Close'}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{isFa ? 'رد درخواست' : 'Reject'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                >
                  {isFa ? 'بستن' : 'Close'}
                </button>

                <button
                  onClick={() => handleExecuteTaskAction('APPROVE')}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isFa ? 'در حال ثبت...' : 'Processing...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isFa ? 'تایید و ارسال به گام بعد' : 'Approve & Advance'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF View Modal (View Only) */}
      {pdfReferral && (
        <CartablePdfViewerModal
          referral={pdfReferral}
          isFa={isFa}
          onClose={() => setPdfReferral(null)}
        />
      )}
    </div>
  );
}
