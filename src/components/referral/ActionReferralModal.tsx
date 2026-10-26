import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  PenTool,
  RotateCcw,
  Send,
  X,
  History,
  ShieldCheck,
  UserPlus,
  Eye
} from 'lucide-react';
import {
  DocumentReferral,
  ReferralAssignee,
  ReferralActionType,
  UserProfile
} from '../../types';
import { processReferralAction, canUserActOnAssignee } from '../../utils/referralHelper';
import { getComplexPersonnelList, ComplexPersonnel, getPersonnelSignature } from '../../utils/personnelHelper';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { CartablePdfViewerModal } from './CartablePdfViewerModal';

interface ActionReferralModalProps {
  referral: DocumentReferral;
  assignee: ReferralAssignee;
  currentUser: UserProfile;
  isFa?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onViewDocument?: () => void;
}

export const ActionReferralModal: React.FC<ActionReferralModalProps> = ({
  referral,
  assignee,
  currentUser,
  isFa = true,
  onClose,
  onSuccess,
  onViewDocument
}) => {
  const [personnelList, setPersonnelList] = useState<ComplexPersonnel[]>(() => getComplexPersonnelList());
  const [showPdfModal, setShowPdfModal] = useState(false);

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

  const [selectedAction, setSelectedAction] = useState<'REVIEW' | 'APPROVE' | 'REJECT' | 'SIGN' | 'APPROVE_AND_SIGN' | 'DELEGATE'>(() => {
    if (assignee.actionType === 'APPROVE_AND_SIGN') return 'APPROVE_AND_SIGN';
    if (assignee.actionType === 'SIGN') return 'SIGN';
    if (assignee.actionType === 'REJECT') return 'REJECT';
    if (assignee.actionType === 'REVIEW') return 'REVIEW';
    if (assignee.actionType === 'APPROVE') return 'APPROVE';
    return 'APPROVE';
  });

  const resolvedUserStoredSignature =
    (currentUser as any)?.digitalSignature ||
    (currentUser as any)?.signatureImage ||
    getPersonnelSignature(currentUser) ||
    getPersonnelSignature(assignee) ||
    undefined;

  const [comment, setComment] = useState('');
  const [signatureImage, setSignatureImage] = useState<string | undefined>(resolvedUserStoredSignature);
  const [showSignaturePad, setShowSignaturePad] = useState(
    assignee.actionType === 'SIGN' ||
    assignee.actionType === 'APPROVE_AND_SIGN' ||
    Boolean(resolvedUserStoredSignature)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!signatureImage && resolvedUserStoredSignature) {
      setSignatureImage(resolvedUserStoredSignature);
    }
  }, [resolvedUserStoredSignature]);

  // Delegation state
  const [delegatePersonnelId, setDelegatePersonnelId] = useState('');
  const [delegateActionType, setDelegateActionType] = useState<ReferralActionType>('REVIEW');
  const [delegateInstructions, setDelegateInstructions] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const authStatus = canUserActOnAssignee(currentUser, referral, assignee, personnelList);

  const handleActionChange = (action: 'REVIEW' | 'APPROVE' | 'REJECT' | 'SIGN' | 'APPROVE_AND_SIGN' | 'DELEGATE') => {
    setSelectedAction(action);
    setShowSignaturePad(
      action === 'SIGN' ||
      action === 'APPROVE_AND_SIGN' ||
      (action !== 'REJECT' && Boolean(resolvedUserStoredSignature || signatureImage))
    );
    setErrorMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!authStatus.allowed) {
      setErrorMessage(authStatus.reason || (isFa ? 'شما مجاز به اقدام روی این ارجاع نیستید.' : 'Unauthorized action.'));
      return;
    }

    if ((selectedAction === 'SIGN' || selectedAction === 'APPROVE_AND_SIGN') && !signatureImage) {
      setErrorMessage(isFa ? 'لطفاً امضای دیجیتال خود را در کادر مربوطه ترسیم فرمایید.' : 'Please draw your digital signature.');
      return;
    }

    if (selectedAction === 'DELEGATE' && !delegatePersonnelId) {
      setErrorMessage(isFa ? 'لطفاً شخص مورد نظر جهت ارجاع مجدد را انتخاب نمایید.' : 'Please select a recipient for delegation.');
      return;
    }

    setIsSubmitting(true);
    try {
      let delegateTo;
      if (selectedAction === 'DELEGATE') {
        const p = personnelList.find(x => x.id === delegatePersonnelId);
        delegateTo = {
          userId: p?.id || delegatePersonnelId,
          userName: p?.fullName || 'کاربر',
          userRole: p?.jobTitle || 'پرسنل',
          userJobTitle: p?.jobTitle,
          department: p?.department || p?.unit,
          personnelCode: p?.personnelCode || p?.effectiveCode,
          actionType: delegateActionType,
          instructions: delegateInstructions || comment
        };
      }

      processReferralAction({
        referralId: referral.id,
        assigneeId: assignee.id,
        action: selectedAction,
        comment,
        signatureImage,
        delegateTo,
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

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || (isFa ? 'خطا در ثبت اقدام.' : 'Action failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">
                {isFa ? 'اقدام روی سند و فرم ارجاع‌شده' : 'Execute Referral Action'}
              </h3>
              <p className="text-xs text-blue-100 mt-0.5">
                {referral.documentNumber} • {referral.documentTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Document Summary Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {isFa ? 'اطلاعات ارجاع‌دهنده:' : 'Sender Details:'}
              </span>
              <span className="font-mono text-slate-500 text-[11px]">
                {referral.createdDatePersian}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
              <div>
                فرستنده: <span className="font-bold text-slate-900 dark:text-white">{referral.senderName}</span>
              </div>
              <div>
                سمت: <span className="font-medium text-slate-800 dark:text-slate-200">{referral.senderRole || 'مدیر'}</span>
              </div>
              <div>
                مهلت انجام: <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{assignee.deadline || referral.deadline || '—'}</span>
              </div>
            </div>

            {assignee.instructions && (
              <div className="p-2 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-[11px]">
                <span className="font-bold">دستور اقدام برای شما:</span> {assignee.instructions}
              </div>
            )}

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (onViewDocument) {
                    onViewDocument();
                  } else {
                    setShowPdfModal(true);
                  }
                }}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{isFa ? 'مشاهده فرم و سند رسمی (PDF)' : 'View Document (PDF)'}</span>
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Selector Buttons */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-2">
              {isFa ? 'نوع اقدام شما روی این سند:' : 'Select Action:'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* Review */}
              <button
                type="button"
                onClick={() => handleActionChange('REVIEW')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                  selectedAction === 'REVIEW'
                    ? 'bg-blue-50 text-blue-800 border-blue-500 font-bold shadow-xs dark:bg-blue-950/50 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>{isFa ? 'بررسی و نظر کارشناسی' : 'Review & Comment'}</span>
              </button>

              {/* Approve */}
              <button
                type="button"
                onClick={() => handleActionChange('APPROVE')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                  selectedAction === 'APPROVE'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-500 font-bold shadow-xs dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{isFa ? 'تأیید' : 'Approve'}</span>
              </button>

              {/* Sign */}
              <button
                type="button"
                onClick={() => handleActionChange('SIGN')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                  selectedAction === 'SIGN'
                    ? 'bg-purple-50 text-purple-800 border-purple-500 font-bold shadow-xs dark:bg-purple-950/50 dark:text-purple-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <PenTool className="w-4 h-4 text-purple-600" />
                <span>{isFa ? 'امضای دیجیتال' : 'Sign'}</span>
              </button>

              {/* Approve & Sign */}
              <button
                type="button"
                onClick={() => handleActionChange('APPROVE_AND_SIGN')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                  selectedAction === 'APPROVE_AND_SIGN'
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-500 font-bold shadow-xs dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <PenTool className="w-4 h-4 text-indigo-600" />
                <span>{isFa ? 'تأیید و امضا' : 'Approve & Sign'}</span>
              </button>

              {/* Reject */}
              <button
                type="button"
                onClick={() => handleActionChange('REJECT')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                  selectedAction === 'REJECT'
                    ? 'bg-rose-50 text-rose-800 border-rose-500 font-bold shadow-xs dark:bg-rose-950/50 dark:text-rose-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>{isFa ? 'رد سند' : 'Reject'}</span>
              </button>

              {/* Delegate */}
              <button
                type="button"
                onClick={() => handleActionChange('DELEGATE')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                  selectedAction === 'DELEGATE'
                    ? 'bg-amber-50 text-amber-800 border-amber-500 font-bold shadow-xs dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>{isFa ? 'ارجاع مجدد' : 'Re-refer'}</span>
              </button>
            </div>
          </div>

          {/* Re-refer / Delegate subform */}
          {selectedAction === 'DELEGATE' && (
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 space-y-2.5 animate-in fade-in">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1 text-xs">
                <UserPlus className="w-3.5 h-3.5" />
                {isFa ? 'مشخصات ارجاع‌شونده جدید:' : 'New Recipient Details:'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {isFa ? 'شخص ارجاع‌شونده:' : 'Recipient:'}
                  </label>
                  <select
                    value={delegatePersonnelId}
                    onChange={e => setDelegatePersonnelId(e.target.value)}
                    className="w-full p-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="">{isFa ? '-- انتخاب از پرسنل --' : '-- Select --'}</option>
                    {personnelList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.jobTitle || 'پرسنل'} - {p.unit || p.department})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    {isFa ? 'نوع اقدام مورد انتظار:' : 'Expected Action:'}
                  </label>
                  <select
                    value={delegateActionType}
                    onChange={e => setDelegateActionType(e.target.value as ReferralActionType)}
                    className="w-full p-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="REVIEW">{isFa ? 'بررسی و اعلام نظر' : 'Review'}</option>
                    <option value="APPROVE">{isFa ? 'تأیید' : 'Approve'}</option>
                    <option value="SIGN">{isFa ? 'امضای دیجیتال' : 'Sign'}</option>
                    <option value="APPROVE_AND_SIGN">{isFa ? 'تأیید و امضا' : 'Approve & Sign'}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Digital Signature Pad (if Sign, Approve & Sign, or stored signature available) */}
          {showSignaturePad && selectedAction !== 'REJECT' && (
            <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/60 animate-in fade-in">
              <DigitalSignaturePad
                onSave={base64 => setSignatureImage(base64)}
                onClear={() => setSignatureImage(undefined)}
                initialSignature={signatureImage}
                storedSignature={resolvedUserStoredSignature}
                signerTarget={currentUser || assignee}
                isFa={isFa}
              />
            </div>
          )}

          {/* Comment / Remarks */}
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
              {isFa ? 'نظرات، توضیحات و شرایط تأیید/رد:' : 'Comments & Conditions:'}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                selectedAction === 'REJECT'
                  ? isFa
                    ? 'لطفاً علت رد سند یا عدم انطباق‌های مشاهده شده را به طور شفاف قید فرمایید...'
                    : 'Explain rejection reasons...'
                  : isFa
                  ? 'توضیحات و نظرات تکمیلی شما (در لاگ سوابق سند ثبت می‌شود)...'
                  : 'Your comments...'
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* History of Actions on this document */}
          {referral.historyLogs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px]">
                <History className="w-3.5 h-3.5 text-blue-500" />
                {isFa ? 'تاریخچه گردش کار و نظرات قبلی:' : 'Workflow History:'}
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {referral.historyLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-[10.5px]"
                  >
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {log.userName} ({log.userJobTitle || log.userRole || 'پرسنل'})
                      </span>
                      <span className="font-mono">{log.persianDateTime}</span>
                    </div>
                    <div className="mt-0.5 text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1">
                        [{log.actionTitleFa}]:
                      </span>
                      {log.comment}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition cursor-pointer"
            >
              {isFa ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2 rounded-xl font-bold text-white transition cursor-pointer shadow-md flex items-center gap-1.5 ${
                selectedAction === 'REJECT'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                  : selectedAction === 'DELEGATE'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {selectedAction === 'REJECT'
                  ? isFa ? 'ثبت رد سند' : 'Submit Rejection'
                  : selectedAction === 'DELEGATE'
                  ? isFa ? 'ثبت و ارجاع مجدد' : 'Submit Delegation'
                  : selectedAction === 'APPROVE_AND_SIGN' || selectedAction === 'SIGN'
                  ? isFa ? 'ثبت تأیید و امضا' : 'Submit & Sign'
                  : isFa ? 'ثبت تأیید سند' : 'Submit Approval'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* View-Only PDF Document Modal */}
      {showPdfModal && (
        <CartablePdfViewerModal
          referral={referral}
          isFa={isFa}
          currentUser={currentUser}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
};
