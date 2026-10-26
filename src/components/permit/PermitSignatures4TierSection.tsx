import React, { useState } from 'react';
import { PermitSignatures4Tier, UserProfile } from '../../types';
import { PermitPersonnelAutocomplete } from './PermitPersonnelAutocomplete';
import PersianTimePicker from '../common/PersianTimePicker';
import { CheckCircle2, ShieldCheck, PenTool, AlertCircle, X, Check, Trash2, FileSignature, Lock, Send, Clock, UserCheck, Award } from 'lucide-react';
import { DigitalSignaturePad } from '../referral/DigitalSignaturePad';
import { 
  getPersonnelSignature, 
  findPersonnelFast, 
  isPersonnelPtwAuthorized, 
  evaluatePtwQualificationStatus, 
  PTW_UNAUTHORIZED_ERROR_MESSAGE 
} from '../../utils/personnelHelper';

export interface SectionValidationInfo {
  isComplete: boolean;
  missingFields: string[];
  canSignSequential: boolean;
  sequentialBlockReason?: string;
}

interface PermitSignatures4TierSectionProps {
  signatures: PermitSignatures4Tier;
  onChange: (signatures: PermitSignatures4Tier) => void;
  isReadOnly?: boolean;
  currentUser?: UserProfile;
  isFa?: boolean;
  isPrintMode?: boolean;
  permitId?: string;
  permitCategory?: string;
  sectionValidations?: Record<'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit', SectionValidationInfo>;
  onAuditAction?: (action: string, details: string) => void;
  onReferTier?: (tierKey: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit', signerName: string) => void;
}

export const DEFAULT_4TIER_SIGNATURES: PermitSignatures4Tier = {
  issuer: {
    roleKey: 'issuer',
    roleTitle: 'کشیک ارشد تولید / صادر کننده',
    declarationText: 'اینجانب شخصاً بازرسی‌های لازم را انجام داده و شرایط را مناسب می‌دانم.',
    name: '',
    time: '07:30',
    status: 'Pending'
  },
  executor: {
    roleKey: 'executor',
    roleTitle: 'مسئول انجام کار',
    declarationText: 'اینجانب با اطلاع کامل از احتیاط های لازم، پس از پایان‌کار مراتب را به مسئول محوطه اطلاع خواهم داد.',
    name: '',
    time: '07:45',
    status: 'Pending'
  },
  areaSupervisor: {
    roleKey: 'areaSupervisor',
    roleTitle: 'مسئول محوطه',
    declarationText: 'اینجانب شخصاً بازرسی‌های فوق را انجام داده و شرایط را مناسب می‌دانم.',
    name: '',
    time: '07:50',
    status: 'Pending'
  },
  safetyUnit: {
    roleKey: 'safetyUnit',
    roleTitle: 'واحد ایمنی',
    declarationText: 'کلیه بازرسی ها و موارد ایمنی انجام گردید و مورد تایید می باشد',
    name: '',
    time: '08:00',
    status: 'Pending'
  }
};

export const PermitSignatures4TierSection: React.FC<PermitSignatures4TierSectionProps> = ({
  signatures,
  onChange,
  isReadOnly = false,
  currentUser,
  isFa = true,
  isPrintMode = false,
  permitId,
  permitCategory,
  sectionValidations,
  onAuditAction,
  onReferTier
}) => {
  const current = signatures || DEFAULT_4TIER_SIGNATURES;
  const [activeSigningKey, setActiveSigningKey] = useState<'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit' | null>(null);
  const [tempSignature, setTempSignature] = useState<string>('');
  const [blockAlert, setBlockAlert] = useState<{
    tierTitle: string;
    reason: string;
    missingFields?: string[];
  } | null>(null);

  const handleUpdate = (
    tierKey: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit',
    field: 'name' | 'time' | 'status' | 'notes' | 'signatureImage',
    value: string
  ) => {
    onChange({
      ...current,
      [tierKey]: {
        ...current[tierKey],
        [field]: value
      }
    });
  };

  const tiers: Array<{
    key: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit';
    stepNumber: number;
    title: string;
    text: string;
    defaultTime: string;
  }> = [
    {
      key: 'issuer',
      stepNumber: 1,
      title: 'کشیک ارشد تولید / صادر کننده',
      text: 'اینجانب شخصاً بازرسی‌های لازم را انجام داده و شرایط را مناسب می‌دانم.',
      defaultTime: '07:30'
    },
    {
      key: 'executor',
      stepNumber: 2,
      title: 'مسئول انجام کار',
      text: 'اینجانب با اطلاع کامل از احتیاط های لازم، پس از پایان‌کار مراتب را به مسئول محوطه اطلاع خواهم داد.',
      defaultTime: '07:45'
    },
    {
      key: 'areaSupervisor',
      stepNumber: 3,
      title: 'مسئول محوطه',
      text: 'اینجانب شخصاً بازرسی‌های فوق را انجام داده و شرایط را مناسب می‌دانم.',
      defaultTime: '07:50'
    },
    {
      key: 'safetyUnit',
      stepNumber: 4,
      title: 'واحد ایمنی',
      text: 'کلیه بازرسی ها و موارد ایمنی انجام گردید و مورد تایید می باشد',
      defaultTime: '08:00'
    }
  ];

  // Role & identity check for unauthorized prevention
  const checkUserAuthorization = (
    tierKey: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit',
    assignedName: string
  ): { allowed: boolean; reason?: string } => {
    if (!currentUser) {
      return { allowed: false, reason: 'کاربر احراز هویت نشده است.' };
    }

    const cleanAssigned = (assignedName || '').trim();
    const cleanUserFull = (currentUser.fullName || '').trim();
    const cleanUsername = (currentUser.username || '').trim();
    const cleanPersonnelCode = String((currentUser as any).personnelNumber || '').trim();

    // 1. Mandatory PTW Training & Authorization Check (Independent of organizational roles)
    // Both the assigned person and current user must have valid training, unexpired certificate,
    // and authorization for this permit category & responsibility.
    if (cleanAssigned) {
      const assignedPerson = findPersonnelFast(cleanAssigned);
      if (assignedPerson) {
        const ptwCheckAssigned = isPersonnelPtwAuthorized(assignedPerson, {
          roleKey: tierKey,
          permitCategory,
          allowExemptAdmins: false
        });
        if (!ptwCheckAssigned.isAuthorized) {
          return {
            allowed: false,
            reason: ptwCheckAssigned.reason || PTW_UNAUTHORIZED_ERROR_MESSAGE
          };
        }
      }
    }

    // Check currently logged-in user executing the action
    const ptwCheckUser = isPersonnelPtwAuthorized(currentUser, {
      roleKey: tierKey,
      permitCategory,
      allowExemptAdmins: false
    });
    if (!ptwCheckUser.isAuthorized) {
      return {
        allowed: false,
        reason: ptwCheckUser.reason || PTW_UNAUTHORIZED_ERROR_MESSAGE
      };
    }

    const role = String(currentUser.role || '').trim();
    const roleLower = role.toLowerCase();
    const isAdmin =
      role === 'Administrator' ||
      role === 'Admin' ||
      role === 'SUPERADMIN' ||
      roleLower === 'administrator' ||
      roleLower === 'admin' ||
      role === 'مدیر سامانه' ||
      role === 'مدیر سیستم' ||
      role === 'مدیر ارشد' ||
      role === 'ادمین اصلی' ||
      currentUser.username?.toLowerCase() === 'admin';

    // If a specific person is designated in the box, ONLY that designated person (or System Admin with PTW) can sign
    if (cleanAssigned && !isAdmin) {
      const matchedPerson = findPersonnelFast(cleanAssigned);
      const isDirectMatch =
        cleanAssigned === cleanUserFull ||
        cleanAssigned.toLowerCase() === cleanUsername.toLowerCase() ||
        (matchedPerson &&
          ((cleanPersonnelCode &&
            (matchedPerson.personnelCode === cleanPersonnelCode ||
              matchedPerson.effectiveCode === cleanPersonnelCode)) ||
            matchedPerson.fullName.trim() === cleanUserFull));

      if (!isDirectMatch) {
        return {
          allowed: false,
          reason: `مسئول تعیین‌شده برای این جایگاه «${cleanAssigned}» می‌باشد. کاربر فعلی (${cleanUserFull || cleanUsername}) مجاز به امضای جایگاه شخص دیگر نیست.`
        };
      }
    }

    // Role-specific check for Safety Unit (HSE) when no specific person was pre-assigned
    if (tierKey === 'safetyUnit' && !cleanAssigned && !isAdmin) {
      const roleStr = `${currentUser.role || ''} ${(currentUser as any).jobTitle || ''} ${(currentUser as any).department || ''}`.toLowerCase();
      const isHseOrAuthorized =
        roleStr.includes('hse') ||
        roleStr.includes('safety') ||
        roleStr.includes('ایمنی') ||
        roleStr.includes('بهداشت') ||
        roleStr.includes('inspector') ||
        roleStr.includes('manager') ||
        roleStr.includes('supervisor');
      if (!isHseOrAuthorized) {
        return {
          allowed: false,
          reason: 'تأیید و امضای جایگاه «واحد ایمنی (HSE)» صرفاً توسط کارشناس/مسئول واحد HSE یا شخص تعیین‌شده مجاز است.'
        };
      }
    }

    return { allowed: true };
  };

  // Validate section completion, sequential workflow, and authorization before allowing signature
  const validateBeforeSignOrRefer = (
    tierKey: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit',
    isReferralOnly = false
  ): boolean => {
    const tierMeta = tiers.find(x => x.key === tierKey)!;
    const tierData = current[tierKey] || DEFAULT_4TIER_SIGNATURES[tierKey];
    const validation = sectionValidations?.[tierKey];

    // 1. Check mandatory fields of this section
    if (validation && !validation.isComplete) {
      setBlockAlert({
        tierTitle: tierMeta.title,
        reason: isReferralOnly
          ? `امکان ارجاع مرحله «${tierMeta.title}» پیش از تکمیل تمامی فیلدها و چک‌لیست‌های اجباری این بخش وجود ندارد.`
          : `امکان تأیید و امضای «${tierMeta.title}» پیش از تکمیل تمامی فیلدها و الزامات اجباری این بخش وجود ندارد.`,
        missingFields: validation.missingFields
      });
      return false;
    }

    // 2. Check sequential workflow order
    if (!isReferralOnly && validation && !validation.canSignSequential) {
      setBlockAlert({
        tierTitle: tierMeta.title,
        reason: validation.sequentialBlockReason || 'رعایت ترتیب گردش‌کار امضاهای چهارگانه الزامی است. ابتدا مراحل قبلی باید تأیید و امضا شوند.'
      });
      return false;
    }

    // 3. Require name to be entered before signing
    if (!tierData.name?.trim() && !currentUser?.fullName && !currentUser?.username) {
      setBlockAlert({
        tierTitle: tierMeta.title,
        reason: `لطفاً ابتدا نام و مشخصات «${tierMeta.title}» را در کادر مربوطه انتخاب یا وارد نمایید.`
      });
      return false;
    }

    // 4. Check user authorization when signing
    if (!isReferralOnly) {
      const authCheck = checkUserAuthorization(tierKey, tierData.name);
      if (!authCheck.allowed) {
        setBlockAlert({
          tierTitle: tierMeta.title,
          reason: authCheck.reason || 'شما مجاز به تأیید و امضای این بخش نیستید.'
        });
        return false;
      }
    }

    setBlockAlert(null);
    return true;
  };

  const getNowPersianTimestamp = () => {
    const now = new Date();
    return `${now.toLocaleDateString('fa-IR')} ${now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getNowTimeHHMM = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleSaveDrawnSignature = () => {
    if (!activeSigningKey) return;
    const tierMeta = tiers.find(x => x.key === activeSigningKey)!;
    const tierData = current[activeSigningKey] || DEFAULT_4TIER_SIGNATURES[activeSigningKey];
    const signerName = tierData.name?.trim() || currentUser?.fullName || currentUser?.username || '';
    const persianTs = getNowPersianTimestamp();
    const signTime = tierData.time || getNowTimeHHMM();

    onChange({
      ...current,
      [activeSigningKey]: {
        ...tierData,
        name: signerName,
        time: signTime,
        signatureImage: tempSignature || tierData.signatureImage,
        status: 'Approved',
        signedAt: new Date().toISOString(),
        persianTimestamp: persianTs,
        signedByUser: currentUser?.fullName || currentUser?.username || signerName,
        signedByRole: currentUser?.role || tierMeta.title
      }
    });

    onAuditAction?.(
      `تأیید و امضای دیجیتال (${tierMeta.title})`,
      `بخش «${tierMeta.title}» توسط «${signerName}» (کاربر: ${currentUser?.fullName || currentUser?.username || 'سیستم'}) در ساعت ${signTime} (${persianTs}) تأیید و امضا گردید.`
    );

    onReferTier?.(activeSigningKey, signerName);

    setActiveSigningKey(null);
    setTempSignature('');
  };

  const handleClearSignature = (tierKey: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit') => {
    const tierMeta = tiers.find(x => x.key === tierKey)!;
    const tierData = current[tierKey] || DEFAULT_4TIER_SIGNATURES[tierKey];
    const authCheck = checkUserAuthorization(tierKey, tierData.name);
    if (!authCheck.allowed) {
      setBlockAlert({
        tierTitle: tierMeta.title,
        reason: authCheck.reason || 'شما مجاز به حذف امضای این بخش نیستید.'
      });
      return;
    }

    onChange({
      ...current,
      [tierKey]: {
        ...tierData,
        signatureImage: '',
        status: 'Pending',
        signedAt: undefined,
        persianTimestamp: undefined,
        signedByUser: undefined
      }
    });

    onAuditAction?.(
      `لغو امضا (${tierMeta.title})`,
      `امضای رده «${tierMeta.title}» توسط «${currentUser?.fullName || currentUser?.username || 'کاربر'}» لغو و به وضعیت در انتظار بازگردانده شد.`
    );
  };

  if (isPrintMode) {
    return (
      <div className="w-full border-2 border-black border-collapse bg-white font-sans text-black" dir="rtl">
        <table className="w-full border-collapse text-[10.5px]">
          <tbody>
            <tr>
              {tiers.map((t, idx) => {
                const data = current[t.key] || DEFAULT_4TIER_SIGNATURES[t.key];
                const hasValue = !!data.name?.trim();
                const printSigImage = data.signatureImage || (data.status === 'Approved' && hasValue ? getPersonnelSignature(data.name) : undefined);
                const hasSig = !!printSigImage;

                return (
                  <td
                    key={t.key}
                    className={`w-1/4 p-2.5 align-top border-black ${
                      idx < 3 ? 'border-l' : ''
                    } flex-col justify-between`}
                    style={{ minHeight: '140px' }}
                  >
                    <div className="text-center leading-relaxed font-medium mb-2.5 min-h-[42px] px-1 text-[10px]">
                      {t.text}
                    </div>

                    <div className="font-black text-center text-xs mb-3 pb-1 border-b border-black">
                      {t.title}
                    </div>

                    <div className="space-y-1.5 text-[10px] mt-auto">
                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">نام و امضاء:</span>
                        <span className="font-bold truncate flex-1 text-center mr-1">
                          {hasValue ? data.name : '........................'}
                        </span>
                      </div>

                      {hasSig && (
                        <div className="h-8 flex items-center justify-center border border-dashed border-slate-300 my-0.5">
                          <img src={printSigImage} alt="امضا" className="max-h-7 max-w-full object-contain" />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="font-bold shrink-0">ساعت تایید:</span>
                        <span className="font-mono font-bold truncate flex-1 text-center mr-1">
                          {data.time || t.defaultTime}
                        </span>
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 border border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-xs" dir="rtl">
        {/* Section Header */}
        <div className="bg-[#f8fafc] dark:bg-slate-800/90 px-3 py-2 border-b border-slate-800 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 stroke-[2.2]" />
            <span className="font-bold text-[12px] text-slate-900 dark:text-white">
              تعهدات، بررسی‌های ایمنی و امضاهای مجاز چهارگانه پروانه کار (یکپارچه‌سازی ارجاع و امضا)
            </span>
          </div>
          <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
            ترتیب گردش‌کار: ۱. صادرکننده ← ۲. مسئول انجام کار ← ۳. مسئول محوطه ← ۴. واحد ایمنی (HSE)
          </span>
        </div>

        {/* Validation / Workflow Block Alert Banner */}
        {blockAlert && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-300 dark:border-rose-800 flex items-start justify-between gap-3">
            <div className="space-y-1.5 text-xs">
              <div className="font-black text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>جلوگیری از امضا / ارجاع زودهنگام ({blockAlert.tierTitle}):</span>
              </div>
              <p className="text-rose-700 dark:text-rose-300 font-medium text-[11px]">
                {blockAlert.reason}
              </p>
              {blockAlert.missingFields && blockAlert.missingFields.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10.5px] font-bold text-rose-900 dark:text-rose-200 mb-1">
                    فیلدها و الزامات ناقص این بخش که باید تکمیل شوند:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {blockAlert.missingFields.map((mf, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-[10px] font-bold"
                      >
                        • {mf}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setBlockAlert(null)}
              className="text-rose-500 hover:text-rose-700 p-1 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 4 Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 text-[11px]">
          {tiers.map((t, idx) => {
            const data = current[t.key] || DEFAULT_4TIER_SIGNATURES[t.key];
            const isSigned = !!data.signatureImage || (data.status === 'Approved' && !!data.name?.trim());
            const validation = sectionValidations?.[t.key];
            const isSectionReady = validation ? validation.isComplete : true;
            const isSequentialReady = validation ? validation.canSignSequential : true;

            return (
              <div
                key={t.key}
                className={`p-3 flex flex-col justify-between min-h-[210px] bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                  idx > 0 ? 'lg:border-r lg:border-slate-800 dark:lg:border-slate-700' : ''
                } ${
                  idx === 1 || idx === 3 ? 'md:border-r md:border-slate-800 dark:md:border-slate-700' : ''
                } ${
                  idx >= 2 ? 'border-t md:border-t-0 border-slate-800 dark:border-slate-700' : ''
                } ${
                  idx === 1 ? 'border-t md:border-t-0 border-slate-800 dark:border-slate-700' : ''
                }`}
              >
                {/* Declaration Statement Text */}
                <div className="text-center leading-relaxed text-slate-800 dark:text-slate-200 font-medium min-h-[46px] mb-2 px-1 text-[11px]">
                  {t.text}
                </div>

                {/* Role Title Box */}
                <div className="rounded-lg border border-blue-200/80 dark:border-slate-700 bg-blue-50/20 dark:bg-slate-800/60 p-1.5 flex items-center justify-center mb-2 shadow-2xs">
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                    {t.stepNumber}. {t.title}
                  </span>
                </div>

                {/* Section Readiness Mini-Indicator */}
                {validation && !isSigned && (
                  <div className={`mb-2 px-2 py-1 rounded text-[10px] border flex items-center justify-between ${
                    validation.isComplete
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-300'
                  }`}>
                    <span className="font-bold truncate">
                      {validation.isComplete ? '✓ الزامات بخش تکمیل است' : `⚠ ${validation.missingFields.length} مورد الزامی ناقص است`}
                    </span>
                    {!validation.isComplete && (
                      <button
                        type="button"
                        onClick={() => validateBeforeSignOrRefer(t.key, true)}
                        className="underline font-extrabold text-[9.5px] text-rose-700 dark:text-rose-400 shrink-0 mr-1 cursor-pointer"
                      >
                        مشاهده نواقص
                      </button>
                    )}
                  </div>
                )}

                {/* Signed Audit Metadata Badge */}
                {isSigned && (data.signedByUser || data.persianTimestamp) && (
                  <div className="mb-2 px-2 py-1 rounded bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-[9.5px] text-emerald-900 dark:text-emerald-200 space-y-0.5">
                    {data.signedByUser && (
                      <div className="flex items-center gap-1 truncate">
                        <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>ثبت‌کننده: <strong>{data.signedByUser}</strong></span>
                      </div>
                    )}
                    {data.persianTimestamp && (
                      <div className="font-mono text-[9px] text-emerald-700 dark:text-emerald-300">
                        زمان تأیید: {data.persianTimestamp}
                      </div>
                    )}
                  </div>
                )}

                {/* Inputs Section */}
                <div className="space-y-2 mt-auto">
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="shrink-0 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      نام و امضاء:
                    </span>
                    <div className="flex-1 min-w-0">
                      <PermitPersonnelAutocomplete
                        value={data.name || ''}
                        onChange={val => handleUpdate(t.key, 'name', val)}
                        placeholder="جستجو یا درج نام..."
                        disabled={isReadOnly || isSigned}
                        requiredPtwRole={t.key}
                        permitCategory={permitCategory}
                        filterPtwQualifiedOnly={true}
                        onUnauthorizedAttempt={(_p, reason) => {
                          setBlockAlert({
                            tierTitle: t.title,
                            reason
                          });
                        }}
                      />
                      {data.name?.trim() && !isSigned && (() => {
                        const p = findPersonnelFast(data.name);
                        if (!p) return null;
                        const auth = isPersonnelPtwAuthorized(p, { roleKey: t.key, permitCategory });
                        return (
                          <div className="mt-0.5 flex items-center gap-1 text-[9px]">
                            {auth.isAuthorized ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                <Award className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                <span>صلاحیت معتبر صدور پروانه</span>
                              </span>
                            ) : (
                              <span className="text-rose-700 dark:text-rose-400 font-bold flex items-center gap-0.5">
                                <AlertCircle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                <span>فاقد صلاحیت برای این جایگاه</span>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Approval Time & Signature Action Row */}
                  <div className="flex items-center justify-between gap-1 w-full pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        ساعت تایید:
                      </span>
                      <div className="w-24 shrink-0">
                        <PersianTimePicker
                          value={data.time || t.defaultTime}
                          onChange={time => handleUpdate(t.key, 'time', time)}
                          isFa={isFa}
                          size="sm"
                          disabled={isReadOnly || isSigned}
                          inputClassName="px-2 py-0.5 text-xs h-7 text-center font-bold font-mono"
                          placeholder="HH:mm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {data.signatureImage ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!validateBeforeSignOrRefer(t.key)) return;
                              setTempSignature(data.signatureImage || '');
                              setActiveSigningKey(t.key);
                            }}
                            disabled={isReadOnly}
                            className="h-6 px-1.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 rounded flex items-center gap-1 hover:bg-emerald-100 transition cursor-pointer"
                            title="مشاهده / تغییر امضا"
                          >
                            <img src={data.signatureImage} alt="امضا" className="max-h-5 max-w-[40px] object-contain" />
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold">امضا شد</span>
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => handleClearSignature(t.key)}
                              className="text-slate-400 hover:text-rose-600 p-0.5 transition cursor-pointer"
                              title="حذف امضا"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {onReferTier && !isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!validateBeforeSignOrRefer(t.key, false)) return;
                                const storedSig = getPersonnelSignature(data.name || currentUser);
                                setTempSignature(storedSig || '');
                                setActiveSigningKey(t.key);
                              }}
                              className="text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-slate-300 dark:border-slate-700 font-bold text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded transition cursor-pointer"
                              title="ارجاع این مرحله پس از تکمیل بخش"
                            >
                              <Send className="w-2.5 h-2.5 text-blue-600" />
                              <span>ارجاع</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Digital Signature Modal */}
      {activeSigningKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-white" />
                <h4 className="font-bold text-sm">
                  ثبت امضای دیجیتال: {tiers.find(x => x.key === activeSigningKey)?.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveSigningKey(null);
                  setTempSignature('');
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">نام شخص مسئول:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {current[activeSigningKey]?.name || currentUser?.fullName || currentUser?.username || 'مشخص نشده'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">کاربر ثبت‌کننده:</span>
                  <span className="font-bold text-blue-700 dark:text-blue-300">
                    {currentUser?.fullName || currentUser?.username || 'کاربر سامانه'} ({currentUser?.role || 'مسئول'})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">ساعت تایید:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                    {current[activeSigningKey]?.time || tiers.find(x => x.key === activeSigningKey)?.defaultTime}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  لطفاً امضای دیجیتال خود را در کادر زیر ترسیم نمایید:
                </label>
                <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white p-2">
                  <DigitalSignaturePad
                    onSave={sig => setTempSignature(sig)}
                    onClear={() => setTempSignature('')}
                    initialSignature={current[activeSigningKey]?.signatureImage || tempSignature}
                    storedSignature={getPersonnelSignature(current[activeSigningKey]?.name || currentUser)}
                    signerTarget={current[activeSigningKey]?.name || currentUser}
                    isFa={isFa}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSigningKey(null);
                    setTempSignature('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveDrawnSignature}
                  disabled={!tempSignature && !current[activeSigningKey]?.signatureImage}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تأیید و ذخیره امضا</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
