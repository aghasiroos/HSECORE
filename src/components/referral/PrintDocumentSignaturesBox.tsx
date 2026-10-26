import React, { useMemo } from 'react';
import { getReferralsForDocument } from '../../utils/referralHelper';
import { getPersonnelSignature } from '../../utils/personnelHelper';
import { DocumentSourceType } from '../../types';
import { ShieldCheck, CheckCircle2, Clock } from 'lucide-react';

interface PrintDocumentSignaturesBoxProps {
  documentType: DocumentSourceType;
  documentId: string;
  isFa?: boolean;
  title?: string;
  fallbackSignatories?: {
    roleTitle: string;
    subTitle?: string;
    defaultName?: string;
  }[];
}

/**
 * Universal Printable Official Signatures Component for A4 forms
 * Automatically pulls digital signatures, approvals and timestamps from Document Referral System,
 * or renders official placeholder signature boxes for the document.
 */
export const PrintDocumentSignaturesBox: React.FC<PrintDocumentSignaturesBoxProps> = ({
  documentType,
  documentId,
  isFa = true,
  title,
  fallbackSignatories
}) => {
  const [updateTick, setUpdateTick] = React.useState(0);

  React.useEffect(() => {
    const handleUpdate = () => setUpdateTick((t) => t + 1);
    window.addEventListener('hse_document_referrals_updated', handleUpdate);
    window.addEventListener('hse_central_data_synced', handleUpdate);
    return () => {
      window.removeEventListener('hse_document_referrals_updated', handleUpdate);
      window.removeEventListener('hse_central_data_synced', handleUpdate);
    };
  }, []);

  const referrals = useMemo(() => {
    return getReferralsForDocument(documentType, documentId);
  }, [documentType, documentId, updateTick]);

  // Find all assignees who have acted (signed, approved, or reviewed) AND the creator (index 0)
  const completedAssignees = useMemo(() => {
    const list: any[] = [];
    referrals.forEach(ref => {
      ref.assignees.forEach((a, index) => {
        if (a.status === 'SIGNED' || a.status === 'APPROVED' || a.status === 'REVIEWED' || index === 0) {
          list.push({
            ...a,
            documentVersion: ref.version || 'Rev 1.0',
            refPriority: ref.priority
          });
        }
      });
    });
    return list;
  }, [referrals]);

  const defaultFallbacks = fallbackSignatories || [
    { roleTitle: 'کارشناس / نماینده واحد', subTitle: 'کارشناس و بازرس میدانی', defaultName: 'کارشناس واحد' },
    { roleTitle: 'سرپرست / مسئول واحد', subTitle: 'مسئول هماهنگی و کنترل', defaultName: 'سرپرست واحد' },
    { roleTitle: 'رئیس مرکز HSE', subTitle: 'تصویب و تایید نهایی', defaultName: 'رئیس مرکز HSE' }
  ];

  return (
    <div className="mt-3 border-2 border-slate-800 rounded-lg overflow-hidden bg-white print:break-inside-avoid">
      {/* Box Header */}
      <div className="bg-slate-900 text-white px-3 py-1 text-[10px] font-black flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>{title || (isFa ? 'ماتریس تأییدات، امضاها و احراز اصالت الکترونیکی سند (Official Signatures & Approval Matrix)' : 'Official Signatures & Approval Matrix')}</span>
        </div>
        {completedAssignees.length > 0 && (
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2 py-0.2 rounded text-[8.5px] font-mono">
            {isFa ? '✓ امضای دیجیتال دارای شناسه رهگیری' : 'Digitally Verified'}
          </span>
        )}
      </div>

      {completedAssignees.length > 0 ? (
        <div className="p-2 bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {completedAssignees.map((asg, idx) => {
              const statusText = 
                asg.status === 'SIGNED' ? (isFa ? 'تأیید و امضا شد' : 'Signed') :
                asg.status === 'APPROVED' ? (isFa ? 'تأیید شد' : 'Approved') :
                asg.status === 'REVIEWED' ? (isFa ? 'بررسی و ثبت نظر' : 'Reviewed') :
                (isFa ? 'در انتظار اقدام' : 'Pending');

              const statusColor = 
                asg.status === 'SIGNED' ? 'text-emerald-800 bg-emerald-100 border-emerald-300' :
                asg.status === 'APPROVED' ? 'text-blue-800 bg-blue-100 border-blue-300' :
                asg.status === 'REVIEWED' ? 'text-purple-800 bg-purple-100 border-purple-300' :
                'text-amber-800 bg-amber-100 border-amber-300';

              return (
                <div key={idx} className="bg-white border border-slate-300 rounded-lg p-2 text-[9px] flex flex-col justify-between shadow-2xs space-y-1">
                  <div>
                    <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1">
                      <span className="font-black text-slate-900 truncate">{asg.userName}</span>
                      <span className={`px-1.5 py-0.2 rounded font-black text-[7.5px] border ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[8px] mt-0.5 truncate">
                      {asg.userJobTitle || asg.userRole || 'پرسنل'} {asg.department ? `(${asg.department})` : ''}
                    </div>
                  </div>

                  {/* Signature visual or badge */}
                  <div className="h-10 my-1 bg-slate-50 border border-dashed border-slate-200 rounded flex items-center justify-center overflow-hidden">
                    {(asg.signatureImage || (asg.status !== 'PENDING' && getPersonnelSignature(asg))) ? (
                      <img src={asg.signatureImage || getPersonnelSignature(asg)} alt="امضا" className="max-h-9 max-w-full object-contain" />
                    ) : (
                      <div className="text-slate-400 font-mono text-[7.5px] flex items-center gap-1">
                        {asg.status === 'PENDING' ? (
                          <>
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>{isFa ? 'منتظر اقدام' : 'Pending'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>{isFa ? 'تأیید سیستمی کاربر' : 'System Approved'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Date & Note */}
                  <div className="text-[7.5px] text-slate-500 space-y-0.5 pt-0.5 border-t border-slate-100">
                    <div className="flex items-center justify-between font-mono">
                      <span>{asg.signedAtPersian || (asg.statusDate ? new Date(asg.statusDate).toLocaleDateString('fa-IR') : '---')}</span>
                      <span className="text-slate-400">کد: {asg.personnelCode || '---'}</span>
                    </div>
                    {asg.comment && (
                      <p className="text-slate-700 italic truncate" title={asg.comment}>
                        «{asg.comment}»
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Fallback empty signature blocks for standard printout */
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-800 bg-white text-center text-[9.5px]">
          {defaultFallbacks.map((f, idx) => (
            <div key={idx} className="p-2 h-20 flex flex-col justify-between">
              <div>
                <div className="font-black text-slate-950">{f.roleTitle}</div>
                {f.subTitle && <div className="text-[8px] text-slate-500 mt-0.5">{f.subTitle}</div>}
              </div>
              <div className="border-t border-dotted border-slate-400 pt-1 text-[7.5px] text-slate-500 flex justify-between px-1">
                <span>نام: {f.defaultName || '............'}</span>
                <span>امضاء و تاریخ</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
