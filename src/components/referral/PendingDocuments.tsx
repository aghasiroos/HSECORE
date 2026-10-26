import React, { useState, useEffect, useMemo } from 'react';
import {
  Inbox,
  Clock,
  CheckCircle2,
  PenTool,
  Search,
  Send,
  GitCommit,
  History,
  Lock,
  FileText,
  RefreshCw,
  ShieldAlert,
  XCircle,
  UserCheck,
  Filter
} from 'lucide-react';
import {
  DocumentReferral,
  ReferralAssignee,
  ReferralActionType,
  UserProfile
} from '../../types';
import {
  getDocumentReferrals,
  fetchDocumentReferralsFromServer,
  isGlobalAdminUser,
  isAssigneeMatchingUser,
  isReferralSender,
  canUserActOnAssignee,
  filterReferralsForUser,
  cancelDocumentReferral
} from '../../utils/referralHelper';
import { getComplexPersonnelList, ComplexPersonnel } from '../../utils/personnelHelper';
import { ActionReferralModal } from './ActionReferralModal';
import { DocumentWorkflowTrackerModal } from './DocumentWorkflowTrackerModal';
import { CartablePdfViewerModal } from './CartablePdfViewerModal';

interface PendingDocumentsProps {
  currentUser: UserProfile;
  isFa?: boolean;
  onNavigateToDocument?: (docType: string, docId: string) => void;
}

export const PendingDocuments: React.FC<PendingDocumentsProps> = ({
  currentUser,
  isFa = true
}) => {
  const isGlobalAdmin = useMemo(() => isGlobalAdminUser(currentUser), [currentUser]);

  const [referrals, setReferrals] = useState<DocumentReferral[]>(() => getDocumentReferrals());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my_pending' | 'my_completed' | 'sent_by_me' | 'all_archive'>('my_pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [adminSelectedAssigneeFilter, setAdminSelectedAssigneeFilter] = useState<string>('ALL');

  const [personnelList, setPersonnelList] = useState<ComplexPersonnel[]>(() => getComplexPersonnelList());

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

  // Ensure non-admins cannot stay on all_archive tab
  useEffect(() => {
    if (!isGlobalAdmin && activeTab === 'all_archive') {
      setActiveTab('my_pending');
    }
  }, [isGlobalAdmin, activeTab]);

  // Modals
  const [selectedActionItem, setSelectedActionItem] = useState<{
    referral: DocumentReferral;
    assignee: ReferralAssignee;
  } | null>(null);

  const [selectedTrackerReferral, setSelectedTrackerReferral] = useState<DocumentReferral | null>(null);
  const [selectedPdfReferral, setSelectedPdfReferral] = useState<DocumentReferral | null>(null);

  // Sync with database backend and local storage updates whenever currentUser changes
  useEffect(() => {
    fetchDocumentReferralsFromServer().then(list => {
      if (Array.isArray(list)) setReferrals(list);
    }).catch(() => {});

    const handleUpdate = () => {
      setReferrals(getDocumentReferrals());
    };
    window.addEventListener('hse_document_referrals_updated', handleUpdate);
    window.addEventListener('hse_central_data_synced', handleUpdate);
    return () => {
      window.removeEventListener('hse_document_referrals_updated', handleUpdate);
      window.removeEventListener('hse_central_data_synced', handleUpdate);
    };
  }, [currentUser?.id, currentUser?.username, currentUser?.role]);

  const refreshList = async () => {
    setIsRefreshing(true);
    try {
      const updated = await fetchDocumentReferralsFromServer();
      if (Array.isArray(updated)) setReferrals(updated);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Strictly filter referrals visible to current user
  const visibleReferrals = useMemo(
    () => filterReferralsForUser(referrals, currentUser, personnelList),
    [referrals, currentUser, personnelList]
  );

  // 1. Items currently awaiting MY action/signature in my active turn
  const myPendingItems = useMemo(() => {
    const list: { referral: DocumentReferral; assignee: ReferralAssignee }[] = [];
    visibleReferrals.forEach(ref => {
      if (ref.isLocked || ref.overallStatus === 'COMPLETED' || (ref.overallStatus as string) === 'CANCELLED') {
        return;
      }
      ref.assignees.forEach(a => {
        if (isAssigneeMatchingUser(a, currentUser, personnelList) && a.status === 'PENDING') {
          if (ref.workflowMode === 'SEQUENTIAL' && !a.isCurrentActive) {
            return;
          }
          list.push({ referral: ref, assignee: a });
        }
      });
    });
    return list;
  }, [visibleReferrals, currentUser, personnelList]);

  // 2. All items assigned to ME (completed/signed by me, or queued for later stage)
  const myAssignedHistoryItems = useMemo(() => {
    const list: { referral: DocumentReferral; assignee: ReferralAssignee }[] = [];
    visibleReferrals.forEach(ref => {
      ref.assignees.forEach(a => {
        if (isAssigneeMatchingUser(a, currentUser, personnelList)) {
          const isCurrentlyActionable =
            a.status === 'PENDING' &&
            !ref.isLocked &&
            ref.overallStatus !== 'COMPLETED' &&
            (ref.workflowMode === 'PARALLEL' || a.isCurrentActive);
          if (!isCurrentlyActionable) {
            list.push({ referral: ref, assignee: a });
          }
        }
      });
    });
    return list;
  }, [visibleReferrals, currentUser, personnelList]);

  // 3. Referrals sent/initiated by ME
  const sentByMeReferrals = useMemo(() => {
    return visibleReferrals.filter(r => isReferralSender(r, currentUser));
  }, [visibleReferrals, currentUser]);

  // Unique assignee names for Admin Cartable Filter
  const allAssigneeNamesForAdmin = useMemo(() => {
    if (!isGlobalAdmin) return [];
    const names = new Set<string>();
    referrals.forEach(r => {
      (r.assignees || []).forEach(a => {
        if (a.userName && a.userName.trim()) {
          names.add(a.userName.trim());
        }
      });
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [referrals, isGlobalAdmin]);

  const handleWithdrawReferral = (referral: DocumentReferral) => {
    try {
      cancelDocumentReferral({
        referralId: referral.id,
        reason: 'انصراف و لغو گردش کار ارجاع توسط فرستنده/مدیر سامانه',
        currentUser: {
          id: currentUser.id || currentUser.username,
          username: currentUser.username,
          personnelNumber: currentUser.personnelNumber,
          fullName: currentUser.fullName || currentUser.username,
          role: currentUser.role,
          jobTitle: currentUser.jobTitle,
          department: currentUser.departmentIds?.[0]
        }
      });
      refreshList();
    } catch (err: any) {
      console.error(err);
    }
  };

  // Priority color meta
  const priorityMeta = {
    LOW: { fa: 'عادی', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    MEDIUM: { fa: 'متوسط', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
    HIGH: { fa: 'فوری / بالا', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
    CRITICAL: { fa: 'بحرانی (آنی)', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300' }
  };

  const actionMeta: Record<ReferralActionType, { fa: string; color: string }> = {
    REVIEW: { fa: 'بررسی و نظر', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    APPROVE: { fa: 'تأیید', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    REJECT: { fa: 'رد صلاحیت', color: 'bg-rose-50 text-rose-700 border-rose-200' },
    SIGN: { fa: 'امضای دیجیتال', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    APPROVE_AND_SIGN: { fa: 'تأیید و امضا', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI */}
      <div className="p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white rounded-3xl shadow-xl border border-blue-600/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <Inbox className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black">
                {isFa ? 'کارتابل اختصاصی اسناد و فرم‌های در انتظار اقدام و امضا' : 'Dedicated Pending Documents & Signature Inbox'}
              </h2>
              {myPendingItems.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs animate-pulse">
                  {myPendingItems.length} {isFa ? 'سند منتظر اقدام شما' : 'Pending'}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/25 text-white text-[11px] font-bold flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                {currentUser.fullName || currentUser.username}
                {isGlobalAdmin ? (isFa ? ' (دسترسی سراسری مدیر سامانه)' : ' (Global Admin)') : (isFa ? ' (کارتابل اختصاصی)' : ' (Personal Cartable)')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-2xl leading-relaxed">
              {isFa
                ? isGlobalAdmin
                  ? 'مشاهده، بررسی، تأیید، امضای دیجیتال و نظارت سراسری بر تمامی کارتابل‌ها و گردش‌کارهای اسناد در سطح سامانه'
                  : 'مشاهده، بررسی، تأیید، امضای دیجیتال و پیگیری اسناد و فرم‌هایی که مستقیماً به کارتابل اختصاصی شما ارجاع شده‌اند'
                : 'Review, approve, sign, or track organizational forms and documents referred to your dedicated cartable.'}
            </p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-2 text-xs">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/15 text-center min-w-[90px]">
            <div className="text-xl font-black font-mono">{myPendingItems.length}</div>
            <div className="text-[11px] text-blue-200 mt-0.5">{isFa ? 'منتظر اقدام من' : 'My Pending'}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/15 text-center min-w-[90px]">
            <div className="text-xl font-black font-mono">{myAssignedHistoryItems.length}</div>
            <div className="text-[11px] text-blue-200 mt-0.5">{isFa ? 'سوابق اقدام من' : 'My History'}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-2xl border border-white/15 text-center min-w-[90px]">
            <div className="text-xl font-black font-mono">{sentByMeReferrals.length}</div>
            <div className="text-[11px] text-blue-200 mt-0.5">{isFa ? 'ارجاع‌های من' : 'Sent by Me'}</div>
          </div>
          {isGlobalAdmin && (
            <div className="bg-amber-500/20 backdrop-blur-sm p-3 rounded-2xl border border-amber-400/30 text-center min-w-[90px]">
              <div className="text-xl font-black font-mono text-amber-300">{referrals.length}</div>
              <div className="text-[11px] text-amber-200 mt-0.5">{isFa ? 'کل کارتابل‌ها' : 'All System'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Sub Navigation Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('my_pending')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'my_pending'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{isFa ? 'در انتظار اقدام و امضای من' : 'My Pending Actions'}</span>
              {myPendingItems.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'my_pending' ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                  {myPendingItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('my_completed')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'my_completed'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isFa ? 'سوابق و مراحل ارجاع‌شده به من' : 'Referred to Me (History/Queued)'}</span>
              <span className="font-mono text-[11px] opacity-75">({myAssignedHistoryItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('sent_by_me')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'sent_by_me'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{isFa ? 'ارجاع‌های ارسالی من' : 'Sent by Me'}</span>
              <span className="font-mono text-[11px] opacity-75">({sentByMeReferrals.length})</span>
            </button>

            {isGlobalAdmin && (
              <button
                onClick={() => setActiveTab('all_archive')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'all_archive'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                }`}
              >
                <History className="w-4 h-4" />
                <span>{isFa ? 'کلیه کارتابل‌ها و اسناد در گردش سامانه (مدیر ارشد)' : 'All System Workflows (Admin)'}</span>
                <span className="font-mono text-[11px] opacity-75">({referrals.length})</span>
              </button>
            )}

            <button
              onClick={refreshList}
              disabled={isRefreshing}
              title={isFa ? 'بروزرسانی کارتابل از سرور مرکزی' : 'Refresh from server'}
              className="px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">{isFa ? 'بروزرسانی' : 'Refresh'}</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={isFa ? 'جستجو بر اساس شماره سند، عنوان یا فرستنده...' : 'Search document or sender...'}
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Content Tabs */}
        <div className="p-5">
          {/* TAB 1: MY PENDING ACTIONS */}
          {activeTab === 'my_pending' && (
            <div>
              {myPendingItems.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="font-black text-slate-800 dark:text-white text-base">
                    {isFa ? 'در حال حاضر هیچ سند یا فرمی در انتظار اقدام شما نیست' : 'No documents awaiting your action'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    {isFa
                      ? 'تمامی مدارک و فرم‌های ارجاع‌شده به کارتابل اختصاصی شما تأیید، امضا یا مختومه شده‌اند.'
                      : 'All documents referred to your cartable have been processed.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myPendingItems
                    .filter(item => {
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      return (
                        item.referral.documentNumber.toLowerCase().includes(term) ||
                        item.referral.documentTitle.toLowerCase().includes(term) ||
                        item.referral.senderName.toLowerCase().includes(term)
                      );
                    })
                    .map(({ referral, assignee }) => {
                      const act = actionMeta[assignee.actionType] || actionMeta.REVIEW;
                      const pri = priorityMeta[referral.priority] || priorityMeta.MEDIUM;

                      return (
                        <div
                          key={`${referral.id}-${assignee.id}`}
                          className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border-2 border-blue-200/80 dark:border-blue-900/60 shadow-xs hover:border-blue-400 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-black text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                                {referral.documentNumber}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${act.color}`}>
                                اقدام درخواستی: {act.fa}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${pri.color}`}>
                                اولویت: {pri.fa}
                              </span>
                              {referral.workflowMode === 'SEQUENTIAL' && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 text-[10px] font-bold">
                                  نوبت شما (مرحله #{assignee.order})
                                </span>
                              )}
                            </div>

                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                              {referral.documentTitle}
                            </h4>

                            <div className="flex flex-wrap items-center gap-3 text-slate-500 text-[11px]">
                              <span>
                                فرستنده: <strong className="text-slate-800 dark:text-slate-200">{referral.senderName}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                گیرنده مجاز: <strong className="text-blue-700 dark:text-blue-300">{assignee.userName}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                تاریخ ارجاع: <span className="font-mono">{referral.createdDatePersian}</span>
                              </span>
                              {assignee.deadline && (
                                <>
                                  <span>•</span>
                                  <span>
                                    مهلت اقدام: <strong className="font-mono text-amber-600 dark:text-amber-400">{assignee.deadline}</strong>
                                  </span>
                                </>
                              )}
                            </div>

                            {assignee.instructions && (
                              <div className="p-2 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/70 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs">
                                <span className="font-bold">دستور ارجاع‌دهنده:</span> {assignee.instructions}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => setSelectedPdfReferral(referral)}
                              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-blue-200 dark:border-blue-800"
                              title={isFa ? 'مشاهده فرم و سند به صورت PDF (فقط مشاهده)' : 'View Document as PDF'}
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{isFa ? 'مشاهده سند (PDF)' : 'View PDF'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedTrackerReferral(referral)}
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <GitCommit className="w-3.5 h-3.5" />
                              <span>{isFa ? 'رهگیری گردش کار' : 'Track Flow'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedActionItem({ referral, assignee })}
                              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>{isFa ? 'اقدام / امضا' : 'Take Action / Sign'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY ASSIGNED HISTORY / QUEUED STEPS */}
          {activeTab === 'my_completed' && (
            <div>
              {myAssignedHistoryItems.length === 0 ? (
                <div className="text-center py-16 space-y-2 text-slate-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs font-semibold">
                    {isFa ? 'هنوز سابقه اقدام یا مرحله در صف انتظاری برای شما ثبت نشده است.' : 'No completed or queued referral actions yet.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myAssignedHistoryItems
                    .filter(({ referral }) => {
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      return (
                        referral.documentNumber.toLowerCase().includes(term) ||
                        referral.documentTitle.toLowerCase().includes(term) ||
                        referral.senderName.toLowerCase().includes(term)
                      );
                    })
                    .map(({ referral, assignee }) => {
                      const isWaitingPreviousTurn =
                        assignee.status === 'PENDING' && referral.workflowMode === 'SEQUENTIAL' && !assignee.isCurrentActive;

                      return (
                        <div
                          key={`${referral.id}-${assignee.id}`}
                          className="p-4 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                {referral.documentNumber}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  assignee.status === 'SIGNED' || assignee.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : assignee.status === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : isWaitingPreviousTurn
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {assignee.status === 'SIGNED'
                                  ? 'تأیید و امضا شده توسط شما'
                                  : assignee.status === 'APPROVED'
                                  ? 'تأیید شده توسط شما'
                                  : assignee.status === 'REJECTED'
                                  ? 'رد شده توسط شما'
                                  : assignee.status === 'DELEGATED'
                                  ? 'ارجاع مجدد شده توسط شما'
                                  : isWaitingPreviousTurn
                                  ? `در صف نوبت (مرحله #${assignee.order} - منتظر تأیید مراحل قبل)`
                                  : 'بررسی شده'}
                              </span>
                            </div>

                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                              {referral.documentTitle}
                            </h4>

                            <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                              <span>فرستنده: <strong className="text-slate-800 dark:text-slate-200">{referral.senderName}</strong></span>
                              <span>•</span>
                              <span>جایگاه شما: <strong className="text-slate-800 dark:text-slate-200">{assignee.userJobTitle || assignee.userRole || assignee.userName}</strong></span>
                              {assignee.signedAtPersian && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-emerald-600 dark:text-emerald-400">زمان امضا: {assignee.signedAtPersian}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPdfReferral(referral)}
                              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-blue-200 dark:border-blue-800"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{isFa ? 'مشاهده سند (PDF)' : 'View PDF'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedTrackerReferral(referral)}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <GitCommit className="w-3.5 h-3.5" />
                              <span>{isFa ? 'رهگیری گردش کار' : 'View Workflow'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SENT BY ME */}
          {activeTab === 'sent_by_me' && (
            <div>
              {sentByMeReferrals.length === 0 ? (
                <div className="text-center py-16 space-y-2 text-slate-400">
                  <Send className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-xs font-semibold">{isFa ? 'شما تاکنون سندی را ارجاع نداده‌اید.' : 'No sent referrals yet.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sentByMeReferrals
                    .filter(ref => {
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      return (
                        ref.documentNumber.toLowerCase().includes(term) ||
                        ref.documentTitle.toLowerCase().includes(term)
                      );
                    })
                    .map(referral => {
                      const completedCount = referral.assignees.filter(
                        a => a.status === 'APPROVED' || a.status === 'SIGNED' || a.status === 'DELEGATED' || a.status === 'REVIEWED'
                      ).length;
                      const isComplete = referral.overallStatus === 'COMPLETED';
                      const isRejected = referral.overallStatus === 'REJECTED';
                      const activeStep = referral.assignees.find(a => a.isCurrentActive && a.status === 'PENDING');

                      return (
                        <div
                          key={referral.id}
                          className="p-4 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                                {referral.documentNumber}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isComplete
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : isRejected
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {isComplete ? 'تکمیل و امضا شده' : isRejected ? 'رد / لغو شده' : 'در جریان اقدام'}
                              </span>
                              {activeStep && !isComplete && !isRejected && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 text-[10px] font-bold">
                                  مسئول مرحله فعلی: {activeStep.userName}
                                </span>
                              )}
                              {referral.isLocked && (
                                <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                  <Lock className="w-3 h-3" /> قفل
                                </span>
                              )}
                            </div>

                            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                              {referral.documentTitle}
                            </h4>

                            <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
                              <span>
                                ارجاع به: <strong className="text-slate-800 dark:text-slate-200">{referral.assignees.map(a => a.userName).join('، ')}</strong>
                              </span>
                              <span>•</span>
                              <span>پیشرفت: <strong className="font-mono">{completedCount} از {referral.assignees.length}</strong></span>
                              <span>•</span>
                              <span className="font-mono">{referral.createdDatePersian}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {referral.overallStatus === 'IN_PROGRESS' && !referral.isLocked && (
                              <button
                                type="button"
                                onClick={() => handleWithdrawReferral(referral)}
                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title={isFa ? 'انصراف و لغو گردش کار ارجاع' : 'Withdraw Referral'}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{isFa ? 'انصراف از ارجاع' : 'Withdraw'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedPdfReferral(referral)}
                              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-blue-200 dark:border-blue-800"
                              title={isFa ? 'مشاهده سند به صورت PDF (فقط مشاهده)' : 'View Document as PDF'}
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{isFa ? 'مشاهده سند (PDF)' : 'View PDF'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedTrackerReferral(referral)}
                              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <GitCommit className="w-3.5 h-3.5" />
                              <span>{isFa ? 'مشاهده گردش کار و امضاها' : 'View Workflow'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ALL ARCHIVE (STRICTLY SYSTEM MANAGER & MAIN ADMIN ONLY) */}
          {activeTab === 'all_archive' && isGlobalAdmin && (
            <div className="space-y-4">
              {/* Admin Filter Bar by User Cartable */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold">
                  <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isFa ? 'نمای نظارتی ویژه مدیر سامانه و ادمین اصلی (مشاهده کلیه کارتابل‌ها و اسناد در گردش)' : 'Global System Admin Cartable Inspector'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">{isFa ? 'فیلتر کارتابل شخص:' : 'Filter by User:'}</span>
                  <select
                    value={adminSelectedAssigneeFilter}
                    onChange={e => setAdminSelectedAssigneeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold"
                  >
                    <option value="ALL">{isFa ? 'همه کارتابل‌ها و کاربران سامانه' : 'All Users Cartables'}</option>
                    {allAssigneeNamesForAdmin.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {referrals.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  {isFa ? 'هنوز هیچ ارجاعی در سیستم ثبت نشده است.' : 'No referrals archived.'}
                </div>
              ) : (
                referrals
                  .filter(ref => {
                    if (adminSelectedAssigneeFilter !== 'ALL') {
                      const matchesAssignee = (ref.assignees || []).some(
                        a => (a.userName || '').trim() === adminSelectedAssigneeFilter
                      );
                      if (!matchesAssignee) return false;
                    }
                    if (!searchTerm) return true;
                    const term = searchTerm.toLowerCase();
                    return (
                      ref.documentNumber.toLowerCase().includes(term) ||
                      ref.documentTitle.toLowerCase().includes(term) ||
                      ref.senderName.toLowerCase().includes(term) ||
                      ref.assignees.some(a => (a.userName || '').toLowerCase().includes(term))
                    );
                  })
                  .map(referral => {
                    const activeAssignee = referral.assignees.find(
                      a => a.status === 'PENDING' && (referral.workflowMode === 'PARALLEL' || a.isCurrentActive)
                    );
                    return (
                      <div
                        key={referral.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {referral.documentNumber}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {referral.documentTitle}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                referral.overallStatus === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : referral.overallStatus === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {referral.overallStatus === 'COMPLETED'
                                ? 'تکمیل شده'
                                : referral.overallStatus === 'REJECTED'
                                ? 'رد / لغو شده'
                                : `در انتظار اقدام: ${activeAssignee ? activeAssignee.userName : 'گیرندگان'}`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            فرستنده: <strong className="text-slate-700 dark:text-slate-300">{referral.senderName}</strong> • گیرندگان کارتابل:{' '}
                            <strong className="text-slate-700 dark:text-slate-300">
                              {referral.assignees.map(a => `${a.userName} (${a.status === 'SIGNED' || a.status === 'APPROVED' ? 'تأیید/امضا شده' : a.status === 'REJECTED' ? 'رد شده' : 'در انتظار'})`).join(' ، ')}
                            </strong>{' '}
                            • {referral.createdDatePersian}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {activeAssignee && canUserActOnAssignee(currentUser, referral, activeAssignee, personnelList).allowed && (
                            <button
                              type="button"
                              onClick={() => setSelectedActionItem({ referral, assignee: activeAssignee })}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>{isFa ? 'اقدام مدیریتی' : 'Admin Action'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedPdfReferral(referral)}
                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl font-bold hover:bg-blue-100 transition flex items-center gap-1 cursor-pointer"
                            title={isFa ? 'مشاهده سند به صورت PDF (فقط مشاهده)' : 'View Document as PDF'}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{isFa ? 'مشاهده PDF' : 'PDF'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTrackerReferral(referral)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl font-bold hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
                          >
                            <GitCommit className="w-3.5 h-3.5 text-blue-600" />
                            <span>{isFa ? 'جزییات و امضاها' : 'Details'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {selectedActionItem && (
        <ActionReferralModal
          referral={selectedActionItem.referral}
          assignee={selectedActionItem.assignee}
          currentUser={currentUser}
          isFa={isFa}
          onClose={() => setSelectedActionItem(null)}
          onSuccess={() => {
            refreshList();
            setSelectedActionItem(null);
          }}
          onViewDocument={() => {
            setSelectedPdfReferral(selectedActionItem.referral);
          }}
        />
      )}

      {/* Workflow Tracker Modal */}
      {selectedTrackerReferral && (
        <DocumentWorkflowTrackerModal
          referral={selectedTrackerReferral}
          currentUser={currentUser}
          isFa={isFa}
          onClose={() => setSelectedTrackerReferral(null)}
          onOpenActionModal={(ref, asg) => {
            setSelectedTrackerReferral(null);
            setSelectedActionItem({ referral: ref, assignee: asg });
          }}
        />
      )}

      {/* View-Only PDF Document Viewer Modal */}
      {selectedPdfReferral && (
        <CartablePdfViewerModal
          referral={selectedPdfReferral}
          isFa={isFa}
          currentUser={currentUser}
          onClose={() => setSelectedPdfReferral(null)}
          onTakeAction={(ref, asg) => {
            setSelectedPdfReferral(null);
            if (asg) {
              setSelectedActionItem({ referral: ref, assignee: asg });
            }
          }}
        />
      )}
    </div>
  );
};
