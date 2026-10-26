import React, { useState, useMemo } from 'react';
import {
  GitCommit,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  PenTool,
  Lock,
  History,
  X,
  FileText
} from 'lucide-react';
import { DocumentReferral, ReferralAssignee, UserProfile } from '../../types';
import { getReferralsForDocument, canUserActOnAssignee } from '../../utils/referralHelper';
import { getPersonnelSignature } from '../../utils/personnelHelper';
import { CartablePdfViewerModal } from './CartablePdfViewerModal';

interface DocumentWorkflowTrackerModalProps {
  referral?: DocumentReferral;
  documentType?: string;
  documentId?: string;
  documentNumber?: string;
  documentTitle?: string;
  isOpen?: boolean;
  currentUser?: UserProfile;
  isFa?: boolean;
  onClose: () => void;
  onOpenActionModal?: (referral: DocumentReferral, assignee: ReferralAssignee) => void;
}

export const DocumentWorkflowTrackerModal: React.FC<DocumentWorkflowTrackerModalProps> = ({
  referral: propReferral,
  documentType,
  documentId,
  documentNumber,
  documentTitle,
  isOpen = true,
  currentUser,
  isFa = true,
  onClose,
  onOpenActionModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'flow' | 'history'>('flow');
  const [updateTick, setUpdateTick] = useState(0);
  const [showPdfModal, setShowPdfModal] = useState(false);

  React.useEffect(() => {
    const handleUpdate = () => setUpdateTick((t) => t + 1);
    window.addEventListener('hse_document_referrals_updated', handleUpdate);
    window.addEventListener('hse_central_data_synced', handleUpdate);
    return () => {
      window.removeEventListener('hse_document_referrals_updated', handleUpdate);
      window.removeEventListener('hse_central_data_synced', handleUpdate);
    };
  }, []);

  // Resolve referral either from props directly or by querying documentType and documentId
  const referral = useMemo(() => {
    if (documentType && documentId) {
      const list = getReferralsForDocument(documentType, documentId);
      if (list.length > 0) return list[0];
    }
    if (propReferral) {
      const updated = getReferralsForDocument(propReferral.documentType, propReferral.documentId);
      if (updated.length > 0) return updated[0];
      return propReferral;
    }
    return undefined;
  }, [propReferral, documentType, documentId, updateTick]);

  if (!isOpen) return null;

  if (!referral) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="font-black text-base text-slate-800 dark:text-slate-100">
            {isFa ? 'هنوز ارجاعی برای این سند ثبت نشده است' : 'No Referrals Found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            {isFa ? 'برای این سند هنوز گردش کار یا ارجاعی صادر نشده است. می‌توانید با دکمه «ارجاع و امضا» آن را به نفرات مربوطه ارجاع دهید.' : 'No referral flow has been created for this document yet.'}
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition cursor-pointer"
          >
            {isFa ? 'بستن پنجره' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  const statusMeta = {
    IN_PROGRESS: { fa: 'در جریان گردش کار', en: 'In Progress', bg: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300' },
    COMPLETED: { fa: 'تکمیل و مختومه (تأیید نهایی)', en: 'Completed', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300' },
    REJECTED: { fa: 'رد شده / متوقف', en: 'Rejected', bg: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300' }
  };

  const assigneeStatusMeta: Record<string, { fa: string; icon: any; color: string; bg: string }> = {
    PENDING: { fa: 'در انتظار اقدام', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300' },
    APPROVED: { fa: 'تأیید شد', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300' },
    SIGNED: { fa: 'تأیید و امضا شد', icon: PenTool, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300' },
    REJECTED: { fa: 'رد شد', icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-300' },
    DELEGATED: { fa: 'ارجاع مجدد گردید', icon: RotateCcw, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-300' }
  };

  // Find if current user is an active pending assignee
  const currentUserAssignee = referral.assignees.find(a =>
    Boolean(currentUser && canUserActOnAssignee(currentUser, referral, a).allowed)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
              <GitCommit className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg">
                  {isFa ? 'رهگیری لحظه‌ای گردش کار و امضای سند' : 'Live Workflow & Signature Tracker'}
                </h3>
                {referral.isLocked && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {isFa ? 'سند قفل و نهایی شد' : 'Locked & Signed'}
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                {referral.documentNumber} • {referral.documentTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white transition text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-blue-400/40 shadow-sm"
              title={isFa ? 'مشاهده سند رسمی به صورت PDF' : 'View PDF Document'}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isFa ? 'مشاهده سند (PDF)' : 'View PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="p-3 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">{isFa ? 'وضعیت کلی گردش:' : 'Overall Status:'}</span>
            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-black ${statusMeta[referral.overallStatus].bg}`}>
              {isFa ? statusMeta[referral.overallStatus].fa : statusMeta[referral.overallStatus].en}
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            <span>
              فرستنده: <strong className="text-slate-800 dark:text-slate-200">{referral.senderName}</strong>
            </span>
            <span>•</span>
            <span>گردش کار: <strong className="text-slate-800 dark:text-slate-200">{referral.workflowMode === 'SEQUENTIAL' ? 'ترتیبی' : 'موازی'}</strong></span>
            <span>•</span>
            <span className="font-mono">{referral.createdDatePersian}</span>
          </div>
        </div>

        {/* Sub-tabs: Flow vs History */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('flow')}
            className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'flow'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-4 h-4" />
            <span>{isFa ? 'مراحل اقدام‌کنندگان و امضاها' : 'Signatures & Stages'}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`pb-2.5 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{isFa ? `سوابق و لاگ عملیات (${referral.historyLogs.length})` : `Audit Logs (${referral.historyLogs.length})`}</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {activeSubTab === 'flow' ? (
            <div className="space-y-4">
              {/* Timeline of Assignees */}
              <div className="relative border-r-2 border-slate-200 dark:border-slate-800 mr-4 space-y-6">
                {referral.assignees.map((assignee, idx) => {
                  const meta = assigneeStatusMeta[assignee.status] || assigneeStatusMeta.PENDING;
                  const Icon = meta.icon;
                  const isCurrentTurn = referral.workflowMode === 'PARALLEL' || assignee.isCurrentActive;

                  // Check if current user is authorized to act on THIS assignee stage
                  const isMeAssignee = Boolean(
                    currentUser && canUserActOnAssignee(currentUser, referral, assignee).allowed
                  );

                  return (
                    <div key={assignee.id} className="relative pr-6 group">
                      {/* Timeline Node Icon */}
                      <span
                        className={`absolute -right-3 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-900 ${
                          assignee.status === 'APPROVED' || assignee.status === 'SIGNED'
                            ? 'border-emerald-500 text-emerald-600'
                            : assignee.status === 'REJECTED'
                            ? 'border-rose-500 text-rose-600'
                            : isCurrentTurn
                            ? 'border-amber-500 text-amber-500 animate-pulse'
                            : 'border-slate-300 text-slate-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>

                      {/* Card Content */}
                      <div className={`p-3.5 rounded-2xl border ${meta.bg} shadow-2xs space-y-2`}>
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 text-[11px]">#{idx + 1}</span>
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {assignee.userName}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ({assignee.userJobTitle || assignee.userRole || 'پرسنل'} • {assignee.department || 'واحد عملیات'})
                            </span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-bold ${meta.color} bg-white dark:bg-slate-800`}>
                            {meta.fa}
                          </span>
                        </div>

                        {/* Action Requested & Deadline */}
                        <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400 text-[11px]">
                          <span>
                            اقدام مورد انتظار:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {assignee.actionType === 'APPROVE_AND_SIGN' ? 'تأیید و امضا' :
                               assignee.actionType === 'SIGN' ? 'امضای دیجیتال' :
                               assignee.actionType === 'APPROVE' ? 'تأیید' :
                               assignee.actionType === 'REJECT' ? 'رد' : 'بررسی و اعلام نظر'}
                            </strong>
                          </span>
                          {assignee.deadline && (
                            <span>
                              مهلت:{' '}
                              <strong className="font-mono text-amber-700 dark:text-amber-400">
                                {assignee.deadline}
                              </strong>
                            </span>
                          )}
                        </div>

                        {/* Instructions */}
                        {assignee.instructions && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                            <span className="font-bold text-slate-700 dark:text-slate-300">دستور ارجاع‌دهنده:</span>{' '}
                            {assignee.instructions}
                          </div>
                        )}

                        {/* Assignee Feedback & Signature Result */}
                        {(assignee.comment || assignee.signatureImage || ((assignee.status === 'SIGNED' || assignee.status === 'APPROVED') && getPersonnelSignature(assignee))) && (
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                            {assignee.comment && (
                              <p className="text-[11px] text-slate-800 dark:text-slate-200">
                                <span className="font-bold text-blue-600 dark:text-blue-400">نظر ثبت‌شده:</span>{' '}
                                {assignee.comment}
                              </p>
                            )}

                            {(assignee.signatureImage || ((assignee.status === 'SIGNED' || assignee.status === 'APPROVED') && getPersonnelSignature(assignee))) && (
                              <div className="flex items-center gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <div className="p-1 bg-white border border-slate-300 rounded-lg">
                                  <img
                                    src={assignee.signatureImage || getPersonnelSignature(assignee)}
                                    alt="امضای ثبت‌شده"
                                    className="h-10 w-28 object-contain"
                                  />
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    امضای دیجیتال تأیید شد
                                  </div>
                                  <div className="font-mono mt-0.5">{assignee.signedAtPersian}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* If current user matches this pending assignee, show Action Button */}
                        {assignee.status === 'PENDING' && isCurrentTurn && isMeAssignee && onOpenActionModal && (
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => onOpenActionModal(referral, assignee)}
                              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <PenTool className="w-3.5 h-3.5" />
                              <span>{isFa ? 'ثبت اقدام / امضا روی این بخش' : 'Take Action / Sign'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Audit Log History */
            <div className="space-y-2">
              {referral.historyLogs.map(log => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      {log.userName} ({log.userJobTitle || log.userRole || 'پرسنل'})
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">{log.persianDateTime}</span>
                  </div>

                  <div className="text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{log.actionTitleFa}</span>
                  </div>

                  {log.comment && (
                    <p className="text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
                      {log.comment}
                    </p>
                  )}

                  {log.signatureImage && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-semibold">امضای الصاقی:</span>
                      <img
                        src={log.signatureImage}
                        alt="امضا"
                        className="h-8 w-24 object-contain bg-white border border-slate-200 rounded"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {referral.isLocked
              ? isFa ? '🔒 سند پس از تکمیل گردش کار قفل گردیده و غیرقابل ویرایش است.' : 'Document is locked.'
              : isFa ? 'گردش کار تا زمان اعلام نظر کلیه ارجاع‌شوندگان فعال باقی خواهد ماند.' : 'Workflow is active.'}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl font-bold transition cursor-pointer"
          >
            {isFa ? 'بستن' : 'Close'}
          </button>
        </div>
      </div>

      {/* Embedded View-Only PDF Document Modal */}
      {showPdfModal && (
        <CartablePdfViewerModal
          referral={referral}
          isFa={isFa}
          currentUser={currentUser}
          onClose={() => setShowPdfModal(false)}
          onTakeAction={(ref, asg) => {
            setShowPdfModal(false);
            if (onOpenActionModal && asg) {
              onOpenActionModal(ref, asg);
            }
          }}
        />
      )}
    </div>
  );
};
