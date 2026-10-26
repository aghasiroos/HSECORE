import React, { useState } from 'react';
import { CheckCircle, ArrowRight, Pencil, ShieldCheck, FileText, Eye, Printer, Send, GitCommit, X } from 'lucide-react';
import { WorkPermit, UserProfile, PermitCategory, PermitSignatures4Tier } from '../../types';
import { useFinalSubmit } from '../../context/FinalSubmitContext';
import { DEFAULT_4TIER_SIGNATURES } from './PermitSignatures4TierSection';
import { CreateReferralModal } from '../referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from '../referral/DocumentWorkflowTrackerModal';
import { 
  SuppElectricalIsolation,
  SuppProcessMechanical,
  SuppExcavation,
  SuppRadiation,
  SuppConfinedSpace,
  SuppVehicleCrane
} from './supplementary';
import { 
  isPersonnelPtwAuthorized, 
  PTW_UNAUTHORIZED_ERROR_MESSAGE, 
  findPersonnelFast 
} from '../../utils/personnelHelper';

interface PermitFormSupplementaryProps {
  category: PermitCategory;
  currentUser: UserProfile;
  isFa: boolean;
  initialPermit?: WorkPermit;
  mode?: 'create' | 'edit' | 'view';
  onSave: (permit: WorkPermit) => void;
  onCancel: () => void;
}

export const PermitFormSupplementary: React.FC<PermitFormSupplementaryProps> = ({
  category,
  currentUser,
  isFa,
  initialPermit,
  mode,
  onSave,
  onCancel
}) => {
  const { confirmFinalSubmit } = useFinalSubmit();
  const [currentMode, setCurrentMode] = useState<'create' | 'edit' | 'view'>(
    mode || (initialPermit ? 'view' : 'create')
  );
  const isReadOnly = currentMode === 'view';
  const [signatures4Tier, setSignatures4Tier] = useState<PermitSignatures4Tier>(() => 
    initialPermit?.signatures4Tier || DEFAULT_4TIER_SIGNATURES
  );
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [isWorkflowTrackerOpen, setIsWorkflowTrackerOpen] = useState(false);
  const [ptwValidationError, setPtwValidationError] = useState<string | null>(null);

  const categoryTitles: Record<string, string> = {
    Excavation: 'حفاری',
    ProcessMechanical: 'جداسازی مکانیکی و فرآیندی',
    ConfinedSpace: 'ورود به فضای بسته',
    ElectricalIsolation: 'جداسازی الکتریکی',
    Radiation: 'پرتونگاری',
    VehicleCrane: 'ورود خودرو و جرثقیل'
  };

  const getDraftPermit = (): WorkPermit => {
    if (initialPermit) {
      return {
        ...initialPermit,
        signatures4Tier
      };
    }
    const prefixMap: Record<string, string> = {
      Excavation: 'EX',
      ProcessMechanical: 'PI',
      ConfinedSpace: 'CS',
      ElectricalIsolation: 'EL',
      Radiation: 'RAD',
      VehicleCrane: 'CR'
    };
    const prefix = prefixMap[category] || 'SUPP';
    return {
      id: `ptw-${Date.now()}`,
      serialNumber: initialPermit?.serialNumber || (initialPermit as any)?.permitNumber || '[تولید خودکار در زمان ثبت]',
      rowNumber: Math.floor(Math.random() * 500) + 1,
      day: new Date().getDate(),
      month: 'آبان',
      year: 1403,
      permitType: 'Cold',
      permitCategory: category,
      attachedPermits: {
        confinedSpace: category === 'ConfinedSpace',
        excavation: category === 'Excavation',
        workingAtHeight: false,
        electrical: category === 'ElectricalIsolation',
        lifting: category === 'VehicleCrane',
        processIsolation: category === 'ProcessMechanical',
        radiation: category === 'Radiation',
        vehicleCrane: category === 'VehicleCrane'
      },
      description: `پروانه الحاقی ${categoryTitles[category] || category}`,
      location: 'سایت پتروشیمی',
      equipmentName: '',
      startHour: '08:00',
      endHour: '16:00',
      workShift: 'Morning',
      gasTestRequired: 'Not Required',
      safetyInspection: 'Approved',
      standByHse: 'افسر نگهبان',
      responsibles: {
        unitSupervisor: signatures4Tier?.issuer?.name || '',
        jobExecutor: signatures4Tier?.executor?.name || '',
        safetyUnit: signatures4Tier?.safetyUnit?.name || '',
        registeredBy: currentUser.username
      },
      status: 'Active',
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      renewals: [],
      signatures: [],
      signatures4Tier: signatures4Tier,
      auditLogs: [],
      version: 1
    };
  };

  const handleSaveAsDraft = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentMode === 'view') return;

    const base = getDraftPermit();
    const isUpdatingDraft = initialPermit?.status === 'Draft';
    const draftToSave: WorkPermit = {
      ...base,
      status: 'Draft',
      updatedDate: new Date().toISOString(),
      version: (initialPermit?.version || 1) + 1,
      auditLogs: [
        ...(initialPermit?.auditLogs || []),
        {
          id: `aud-${Date.now()}`,
          user: currentUser.fullName || currentUser.username,
          userRole: currentUser.role,
          timestamp: new Date().toISOString(),
          persianDateTime: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          action: isUpdatingDraft ? 'به‌روزرسانی پیش‌نویس پروانه الحاقی' : 'ثبت به عنوان پیش‌نویس پروانه الحاقی',
          details: `پروانه الحاقی ${categoryTitles[category] || category} در وضعیت پیش‌نویس ذخیره گردید تا پس از تکمیل مجدد صادر شود.`,
          version: (initialPermit?.version || 1) + 1
        }
      ]
    };

    onSave(draftToSave);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentMode === 'view') return;
    setPtwValidationError(null);

    // Mandatory PTW Training & Qualification Check for supplementary permit signers (Requirement 5.3)
    for (const [tierKey, tierData] of Object.entries(signatures4Tier || {})) {
      if (['issuer', 'executor', 'areaSupervisor', 'safetyUnit'].includes(tierKey)) {
        const t = tierData as any;
        if (t?.name?.trim()) {
          const person = findPersonnelFast(t.name);
          if (person) {
            const check = isPersonnelPtwAuthorized(person, {
              roleKey: tierKey,
              permitCategory: category,
              allowExemptAdmins: false
            });
            if (!check.isAuthorized) {
              setPtwValidationError(check.reason || PTW_UNAUTHORIZED_ERROR_MESSAGE);
              return;
            }
          }
        }
      }
    }

    const base = getDraftPermit();
    const isCompletingDraft = initialPermit?.status === 'Draft';

    const permitToSave: WorkPermit = {
      ...base,
      status: 'Active',
      updatedDate: new Date().toISOString(),
      version: (initialPermit?.version || 1) + 1,
      auditLogs: [
        ...(initialPermit?.auditLogs || []),
        {
          id: `aud-${Date.now()}`,
          user: currentUser.fullName || currentUser.username,
          userRole: currentUser.role,
          timestamp: new Date().toISOString(),
          persianDateTime: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          action: isCompletingDraft 
            ? 'تکمیل و صدور رسمی پروانه الحاقی' 
            : (currentMode === 'edit' ? 'ویرایش پروانه کار الحاقی' : 'ثبت و صدور پروانه الحاقی'),
          details: isCompletingDraft
            ? `پیش‌نویس پروانه الحاقی ${categoryTitles[category] || category} تکمیل و رسماً صادر گردید.`
            : `پروانه الحاقی ${categoryTitles[category] || category} توسط ${currentUser.fullName || currentUser.username} ثبت و صادر شد.`,
          version: (initialPermit?.version || 1) + 1
        }
      ]
    };

    confirmFinalSubmit({
      isFa,
      onConfirm: () => {
        onSave(permitToSave);
      }
    });
  };

  const renderForm = () => {
    const commonProps = {
      signatures: signatures4Tier,
      onSignaturesChange: setSignatures4Tier,
      isReadOnly,
      permitCategory: category
    };
    switch (category) {
      case 'ElectricalIsolation':
        return <SuppElectricalIsolation {...commonProps} />;
      case 'ProcessMechanical':
        return <SuppProcessMechanical {...commonProps} />;
      case 'Excavation':
        return <SuppExcavation {...commonProps} />;
      case 'Radiation':
        return <SuppRadiation {...commonProps} />;
      case 'ConfinedSpace':
        return <SuppConfinedSpace {...commonProps} />;
      case 'VehicleCrane':
        return <SuppVehicleCrane {...commonProps} />;
      default:
        return <div>انتخاب نامعتبر</div>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
      {/* Top Controls Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{isFa ? 'بازگشت به فهرست' : 'Back to List'}</span>
          </button>

          {/* Current Mode Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 ${
              initialPermit?.status === 'Draft'
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-400 dark:border-amber-700 shadow-xs'
                : currentMode === 'view'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                  : currentMode === 'edit'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
            }`}>
              {initialPermit?.status === 'Draft' ? (
                <>
                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{isFa ? `تکمیل و صدور پیش‌نویس (${categoryTitles[category] || category})` : 'Completing Draft'}</span>
                </>
              ) : currentMode === 'view' ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{isFa ? `مشاهده پروانه الحاقی (${categoryTitles[category] || category})` : 'Viewing Supplementary Permit'}</span>
                </>
              ) : currentMode === 'edit' ? (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  <span>{isFa ? `ویرایش پروانه الحاقی (${categoryTitles[category] || category})` : 'Editing Supplementary Permit'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isFa ? `ثبت پروانه الحاقی (${categoryTitles[category] || category})` : 'New Supplementary Permit'}</span>
                </>
              )}
            </span>
            {initialPermit && (
              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {initialPermit.serialNumber}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Actions */}
          {currentMode === 'view' && (
            <>
              {(currentUser.role === 'Administrator' || initialPermit?.status === 'Draft') && (
                <button
                  type="button"
                  onClick={() => setCurrentMode('edit')}
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Pencil className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{isFa ? (initialPermit?.status === 'Draft' ? 'تکمیل و صدور پیش‌نویس' : 'ویرایش پروانه الحاقی') : 'Edit Permit'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>{isFa ? 'چاپ فرم پروانه' : 'Print Form'}</span>
              </button>

              {initialPermit && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsReferralOpen(true)}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    title={isFa ? 'ارجاع پروانه الحاقی جهت بررسی، تأیید و امضا' : 'Refer Supplementary Permit'}
                  >
                    <Send className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{isFa ? 'ارجاع و امضا' : 'Refer'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsWorkflowTrackerOpen(true)}
                    className="px-3 py-2 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    title={isFa ? 'رهگیری گردش کار و وضعیت امضاهای پروانه' : 'Track Referral Workflow'}
                  >
                    <GitCommit className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{isFa ? 'گردش کار' : 'Workflow'}</span>
                  </button>
                </>
              )}
            </>
          )}

          {/* Save as Draft Button */}
          {currentMode !== 'view' && (
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {initialPermit?.status === 'Draft' 
                  ? (isFa ? 'به‌روزرسانی پیش‌نویس' : 'Update Draft') 
                  : (isFa ? 'ثبت به عنوان پیش‌نویس' : 'Save as Draft')}
              </span>
            </button>
          )}

          {/* Submit Button in Edit/Create Mode */}
          {currentMode !== 'view' && (
            <button
              type="button"
              onClick={handleSubmit}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow flex items-center gap-2 cursor-pointer transition-colors ${
                initialPermit?.status === 'Draft'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : currentMode === 'edit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {initialPermit?.status === 'Draft'
                  ? (isFa ? `تکمیل و صدور رسمی پروانه الحاقی (${categoryTitles[category] || category})` : 'Complete & Issue Permit')
                  : currentMode === 'edit'
                    ? (isFa ? 'ذخیره تغییرات پروانه الحاقی' : 'Save Changes')
                    : (isFa ? 'ثبت و صدور پروانه الحاقی' : 'Save Permit')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Draft State Notification Banner */}
      {initialPermit?.status === 'Draft' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border-2 border-blue-400/80 dark:border-blue-700/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 rounded-xl shadow-xs shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-amber-900 dark:text-amber-200">
                  {isFa ? 'این پروانه الحاقی در حالت «پیش‌نویس» ذخیره شده است' : 'This supplementary permit is currently saved as Draft'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 border border-amber-300 dark:border-amber-600">
                  DRAFT
                </span>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300 mt-1">
                {isFa 
                  ? 'اطلاعات این پروانه الحاقی به عنوان پیش‌نویس نگهداری شده است. پس از تکمیل بخش‌های لازم، بر روی «تکمیل و صدور رسمی پروانه الحاقی» کلیک نمایید تا رسماً صادر شود.'
                  : 'This supplementary permit is saved as draft. Complete the information and click "Complete & Issue" to issue officially.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="px-3 py-1 bg-white dark:bg-slate-900 rounded-lg border border-amber-300 dark:border-amber-700 text-xs font-mono font-bold text-amber-900 dark:text-amber-200">
              {initialPermit.serialNumber}
            </span>
          </div>
        </div>
      )}

      {/* PTW Unauthorized Validation Alert Banner */}
      {ptwValidationError && (
        <div className="bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-500 rounded-2xl p-4 shadow-md flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-rose-900 dark:text-rose-100">
                خطای اعتبارسنجی صلاحیت امضا و صدور پروانه کار
              </h4>
              <p className="text-xs text-rose-800 dark:text-rose-200 mt-1 font-bold leading-relaxed">
                {ptwValidationError}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPtwValidationError(null)}
            className="text-rose-500 hover:text-rose-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="bg-slate-200 dark:bg-slate-800 p-2 md:p-6 shadow-xl text-slate-900 rounded-2xl min-h-screen flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-5xl bg-white dark:bg-slate-900 p-2 md:p-6 shadow-2xl rounded-lg flex flex-col">
          <fieldset disabled={isReadOnly} className={`w-full ${isReadOnly ? 'cursor-default' : ''}`}>
            {renderForm()}
          </fieldset>


          <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-300 dark:border-slate-700 mt-8 print:hidden">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{isFa ? 'بازگشت به فهرست' : 'Cancel'}</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Save as Draft Button */}
              {currentMode !== 'view' && (
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>
                    {initialPermit?.status === 'Draft' 
                      ? (isFa ? 'به‌روزرسانی پیش‌نویس' : 'Update Draft') 
                      : (isFa ? 'ثبت به عنوان پیش‌نویس' : 'Save as Draft')}
                  </span>
                </button>
              )}

              {currentMode !== 'view' && (
                <button
                  type="submit"
                  className={`px-6 py-2.5 rounded-xl text-white font-bold transition-colors cursor-pointer flex items-center gap-2 ${
                    initialPermit?.status === 'Draft'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : currentMode === 'edit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {initialPermit?.status === 'Draft'
                      ? (isFa ? `تکمیل و صدور رسمی پروانه الحاقی (${categoryTitles[category] || category})` : 'Complete & Issue Permit')
                      : currentMode === 'edit' 
                        ? (isFa ? 'ذخیره تغییرات پروانه الحاقی' : 'Save Changes')
                        : (isFa ? 'ثبت و صدور پروانه الحاقی' : 'Save Permit')}
                  </span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Referral & Workflow Modals for Supplementary Permits */}
      {isReferralOpen && (
        <CreateReferralModal
          currentUser={currentUser}
          documentType="PERMIT"
          documentId={initialPermit?.id || getDraftPermit().id}
          documentNumber={initialPermit?.serialNumber || getDraftPermit().serialNumber}
          documentTitle={`پروانه الحاقی ${categoryTitles[category] || category} - ${initialPermit?.serialNumber || getDraftPermit().serialNumber}`}
          initialPermit={getDraftPermit()}
          isFa={isFa}
          onClose={() => setIsReferralOpen(false)}
          onSuccess={() => setIsReferralOpen(false)}
        />
      )}

      {isWorkflowTrackerOpen && (
        <DocumentWorkflowTrackerModal
          isOpen={isWorkflowTrackerOpen}
          documentType="PERMIT"
          documentId={initialPermit?.id || ''}
          documentTitle={`گردش کار و امضاهای پروانه الحاقی ${initialPermit?.serialNumber}`}
          isFa={isFa}
          onClose={() => setIsWorkflowTrackerOpen(false)}
        />
      )}
    </div>
  );
};
