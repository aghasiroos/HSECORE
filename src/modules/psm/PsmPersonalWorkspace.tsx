import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  FolderGit2,
  GitBranch,
  Layers,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { PsmSubTabKey } from './PsmManagementModule';

interface PsmPersonalWorkspaceProps {
  currentUser: UserProfile | null;
  activeProject: any;
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  };
  onNavigateSubTab: (subTab: PsmSubTabKey) => void;
  onRefresh: () => void;
  onRequestCreateGap?: () => void;
  onRequestCreateDoc?: () => void;
}

export function PsmPersonalWorkspace({
  currentUser,
  activeProject,
  projectData,
  onNavigateSubTab,
  onRefresh,
  onRequestCreateGap,
  onRequestCreateDoc,
}: PsmPersonalWorkspaceProps) {
  const [workspaceTab, setWorkspaceTab] = useState<'tasks' | 'documents' | 'approvals' | 'roadmap'>('tasks');
  const [searchQuery, setSearchQuery] = useState('');

  const userName = currentUser?.fullName || currentUser?.username || 'کاربر سامانه';
  const userRole = currentUser?.role || 'کارشناس PSM';

  // Match tasks & CAPA items belonging to current user (or unassigned/open if testing)
  const myCapaItems = useMemo(() => {
    return projectData.capaItems.filter((item) => {
      if (!item) return false;
      const resp = String(item.responsiblePersonName || '').trim();
      const verif = String(item.effectivenessVerifierName || '').trim();
      const isMine =
        resp.includes(userName) ||
        (currentUser?.username && resp.includes(currentUser.username)) ||
        verif.includes(userName);
      return isMine || item.stage !== 'CLOSED';
    });
  }, [projectData.capaItems, userName, currentUser?.username]);

  const myWbsTasks = useMemo(() => {
    return projectData.wbsTasks.filter((t) => {
      if (!t) return false;
      const resp = String(t.responsiblePersonName || '').trim();
      const isMine =
        resp.includes(userName) || (currentUser?.username && resp.includes(currentUser.username));
      return isMine || Number(t.actualProgress || 0) < 100;
    });
  }, [projectData.wbsTasks, userName, currentUser?.username]);

  const myDocuments = useMemo(() => {
    return projectData.documents.filter((doc) => {
      if (!doc) return false;
      const resp = String(doc.responsiblePersonName || doc.authorName || '').trim();
      const isMine =
        resp.includes(userName) || (currentUser?.username && resp.includes(currentUser.username));
      return isMine || doc.status !== 'APPROVED';
    });
  }, [projectData.documents, userName, currentUser?.username]);

  // Overdue and impending items (< 7 days)
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const overdueGaps = useMemo(() => {
    return projectData.gaps.filter(
      (g) => g.status !== 'CLOSED' && g.proposedDueDate && String(g.proposedDueDate) < todayStr
    );
  }, [projectData.gaps, todayStr]);

  const impendingWbs = useMemo(() => {
    return projectData.wbsTasks.filter((t) => {
      if (Number(t.actualProgress || 0) >= 100) return false;
      const end = String(t.plannedEnd || '');
      return end && end <= sevenDaysLater;
    });
  }, [projectData.wbsTasks, sevenDaysLater]);

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      {/* Header Profile & Quick Action Strip */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-50 to-teal-500/10 dark:from-amber-950/20 dark:via-slate-900 dark:to-teal-950/20 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  میز کار اختصاصی: {userName}
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {userRole}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                پروژه فعال:{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {activeProject ? `${activeProject.code} — ${activeProject.name}` : 'انتخاب نشده'}
                </span>
                {activeProject && (
                  <span className="mr-2 text-slate-400">
                    (پیشرفت کل: {activeProject.overallProgress || 0}٪ | سطح بلوغ:{' '}
                    {activeProject.maturityLevel || 1})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="بروزرسانی داده‌های میز کار"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateSubTab('gap-analysis')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت یا بررسی نقص (Gap)</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateSubTab('documents')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <FolderGit2 className="w-4 h-4 text-slate-500" />
              <span>بارگذاری شواهد فنی</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Primary Workload Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          onClick={() => setWorkspaceTab('tasks')}
          className={`p-4 rounded-2xl border transition cursor-pointer space-y-1 ${
            workspaceTab === 'tasks'
              ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>اقدامات CAPA فعال</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
            {myCapaItems.length}
          </div>
          <div className="text-[10px] text-slate-400">اقدام اصلاحی نیازمند پیگیری و بستن</div>
        </div>

        <div
          onClick={() => setWorkspaceTab('tasks')}
          className={`p-4 rounded-2xl border transition cursor-pointer space-y-1 ${
            workspaceTab === 'tasks'
              ? 'bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>فعالیت‌های WBS من</span>
            <GitBranch className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black font-mono text-sky-600 dark:text-sky-400">
            {myWbsTasks.length}
          </div>
          <div className="text-[10px] text-slate-400">وظیفه اجرایی در برنامه زمان‌بندی</div>
        </div>

        <div
          onClick={() => setWorkspaceTab('documents')}
          className={`p-4 rounded-2xl border transition cursor-pointer space-y-1 ${
            workspaceTab === 'documents'
              ? 'bg-teal-500/10 border-teal-500/50 ring-1 ring-teal-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>مدارک و شواهد تحت اقدام</span>
            <FileText className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-black font-mono text-teal-600 dark:text-teal-400">
            {myDocuments.length}
          </div>
          <div className="text-[10px] text-slate-400">اسناد فنی نیازمند بازنگری یا شواهد</div>
        </div>

        <div
          onClick={() => setWorkspaceTab('approvals')}
          className={`p-4 rounded-2xl border transition cursor-pointer space-y-1 ${
            workspaceTab === 'approvals'
              ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/30'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>موارد معوق / اضطراری</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            {overdueGaps.length + impendingWbs.length}
          </div>
          <div className="text-[10px] text-slate-400">شکاف‌های گذشته از موعد یا سررسید ۷ روزه</div>
        </div>
      </div>

      {/* Workspace Tabs & Filter Strip */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              type="button"
              onClick={() => setWorkspaceTab('tasks')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                workspaceTab === 'tasks'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              وظایف و اقدامات من ({myCapaItems.length + myWbsTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('documents')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                workspaceTab === 'documents'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              شواهد و مدارک من ({myDocuments.length})
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('approvals')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                workspaceTab === 'approvals'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              هشدارهای سررسید ({overdueGaps.length + impendingWbs.length})
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('roadmap')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                workspaceTab === 'roadmap'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              نقشه راه استقرار G1–G6
            </button>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="جستجو در وظایف و مدارک..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 focus:outline-none"
            />
          </div>
        </div>

        {/* Tab 1: Tasks & CAPA Items */}
        {workspaceTab === 'tasks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200">
              <span>اقدامات اصلاحی (CAPA) و فعالیت‌های WBS</span>
              <button
                type="button"
                onClick={() => onNavigateSubTab('capa')}
                className="text-amber-600 dark:text-amber-400 text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>ورود به کارتابل کامل CAPA</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {myCapaItems.length === 0 && myWbsTasks.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                  در حال حاضر اقدام بازی برای شما ثبت نشده است
                </h4>
                <p className="text-[11px] text-slate-500">
                  برای تعریف اقدام اصلاحی جدید یا تبدیل شکاف‌ها به فعالیت، از تب‌های مربوطه استفاده نمایید.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {myCapaItems.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          {item.trackingCode || `CAPA-${item.id}`}
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded ${
                            item.stage === 'CLOSED'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          مرحله {item.currentStage || item.stage || 'در جریان'}
                        </span>
                      </div>
                      <h5 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2">
                        {item.title}
                      </h5>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <div>واحد: {item.unitName || 'کل مجتمع'}</div>
                        <div>مسئول: {item.responsiblePersonName || 'تعیین نشده'}</div>
                        <div>مهلت: {item.dueDate || '—'}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        ریسک: {item.riskLevel || 'متوسط'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateSubTab('capa')}
                        className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 cursor-pointer"
                      >
                        مشاهده و تغییر مرحله ←
                      </button>
                    </div>
                  </div>
                ))}

                {myWbsTasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                          {task.wbsCode || `WBS-${task.id}`}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
                          پیشرفت: {task.actualProgress || 0}%
                        </span>
                      </div>
                      <h5 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2">
                        {task.taskTitle}
                      </h5>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <div>واحد: {task.unitName || 'عمومی'}</div>
                        <div>پایان برنامه‌ای: {task.plannedEnd || '—'}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        وضعیت: {task.status || 'در جریان'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateSubTab('wbs-gantt')}
                        className="text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 cursor-pointer"
                      >
                        مشاهده در گانت WBS ←
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Documents */}
        {workspaceTab === 'documents' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200">
              <span>مدارک و شواهد فنی PSM</span>
              <button
                type="button"
                onClick={() => onNavigateSubTab('documents')}
                className="text-teal-600 dark:text-teal-400 text-xs font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>ورود به بانک کامل مدارک</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {myDocuments.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                <FileCheck2 className="w-8 h-8 text-teal-500 mx-auto" />
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                  مدرک نیازمند بازنگری وجود ندارد
                </h4>
                <p className="text-[11px] text-slate-500">
                  برای بارگذاری شواهد یا مدارک جدید فنی، دکمه بارگذاری شواهد فنی را بزنید.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {myDocuments.slice(0, 6).map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/40 space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400">
                          {doc.documentNumber || `DOC-${doc.id}`}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          Rev {doc.revisionNumber || '00'}
                        </span>
                      </div>
                      <h5 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2">
                        {doc.title}
                      </h5>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <div>عنصر CCPS: {doc.ccpsElementCode || 'عمومی'}</div>
                        <div>واحد: {doc.unitName || 'کل مجتمع'}</div>
                        <div>وضعیت: {doc.status || 'در حال بررسی'}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {doc.expiryDate ? `انقضا: ${doc.expiryDate}` : 'بدون انقضا'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigateSubTab('documents')}
                        className="text-[11px] font-bold text-teal-600 hover:text-teal-700 dark:text-teal-400 cursor-pointer"
                      >
                        بررسی و بارگذاری ←
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Impending & Overdue Alerts */}
        {workspaceTab === 'approvals' && (
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              هشدار سررسیدها و شکاف‌های نیازمند اقدام فوری
            </h4>

            {overdueGaps.length === 0 && impendingWbs.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
                  هیچ مورد معوق یا با مهلت اضطراری وجود ندارد
                </h4>
                <p className="text-[11px] text-slate-500">
                  تمامی فعالیت‌ها و شکاف‌ها در بازه زمانی مجاز قرار دارند.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {overdueGaps.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600">
                          {g.gapCode || `GAP-${g.id}`}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white truncate">
                          {g.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        مسئول: {g.assignedPersonName || 'تعیین نشده'} | مهلت منقضی‌شده:{' '}
                        <span className="font-mono font-bold text-rose-600">{g.proposedDueDate}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateSubTab('gap-analysis')}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                      تعیین تکلیف / تمدید
                    </button>
                  </div>
                ))}

                {impendingWbs.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/30 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                          {w.wbsCode || `WBS-${w.id}`}
                        </span>
                        <span className="font-black text-slate-900 dark:text-white truncate">
                          {w.taskTitle}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        مهلت سررسید کمتر از ۷ روز: <span className="font-mono font-bold text-amber-600">{w.plannedEnd}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateSubTab('wbs-gantt')}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                      به‌روزرسانی پیشرفت
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Stage Gate Roadmap Stepper */}
        {workspaceTab === 'roadmap' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                  نقشه راه ۶ دروازه کنترلی استقرار (Stage-Gate G1–G6)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  کنترل اجباری عبور از مراحل استقرار پروژه با ممیزی معیارهای پذیرش
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSubTab('stage-gates')}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>ورود به موتور کامل Stage-Gate</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: 'G1', title: 'تأیید دامنه و ارزیابی اولیه', desc: 'تکمیل ارزیابی ۲۰ عنصر CCPS و ۱۴ بند OSHA' },
                { key: 'G2', title: 'تأیید تحلیل شکاف و نواقص', desc: 'تعیین سطح ریسک و مسئولان تمامی شکاف‌ها' },
                { key: 'G3', title: 'تصویب برنامه WBS و منابع', desc: 'برنامه اجرایی، تخصیص بودجه و گانت پروژه' },
                { key: 'G4', title: 'تأیید خروجی‌ها و اسناد PSI', desc: 'تکمیل مدارک فنی، بازنگری و صحه‌گذاری شواهد' },
                { key: 'G5', title: 'تأیید اثربخشی اقدامات CAPA', desc: 'ممیزی مستقل و صحه‌گذاری اثربخشی کنترل‌ها' },
                { key: 'G6', title: 'تصویب نهایی و تحویل سیستم', desc: 'تحویل سیستم فعال PSM به مدیریت مجتمع' },
              ].map((g, idx) => (
                <div
                  key={g.key}
                  onClick={() => onNavigateSubTab('stage-gates')}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:border-amber-500/50 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {g.key}
                    </span>
                    <span className="text-[10px] text-slate-400">گام {idx + 1} از ۶</span>
                  </div>
                  <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">{g.title}</h5>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{g.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
