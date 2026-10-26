import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Eye,
  Printer,
  Info,
  AlertCircle,
  AlertTriangle,
  Check,
  LayoutTemplate,
  Lock,
  Layers,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Copy
} from 'lucide-react';
import {
  useSystemBranding,
  SystemBrandingConfig,
  DEFAULT_FORMAL_HEADER_CONFIG,
  DEFAULT_SIDEBAR_NAV_CONFIG,
  DEFAULT_LOGIN_SCREEN_CONFIG,
  getFormalHeaderBranding,
  getSidebarNavBranding,
  getLoginScreenBranding,
  trimImageMargins
} from '../utils/systemBrandingHelper';
import { FormalReportHeader } from './common/FormalReportHeader';
import { HseLogo } from './HseLogo';
import { HseCoreBrandText } from './common/HseCoreBrandText';
import { addAuditLog } from '../utils/authHelper';
import { UserProfile } from '../types';

interface SystemLogoManagementProps {
  currentUser: UserProfile;
  isFa?: boolean;
}

type SectionTarget = 'header' | 'sidebar' | 'login' | 'global';

export const SystemLogoManagement: React.FC<SystemLogoManagementProps> = ({
  currentUser,
  isFa = true
}) => {
  const { branding, updateBranding, resetBranding } = useSystemBranding();
  
  // Staged / Pending form data that is previewed in real-time before user confirmation
  const [formData, setFormData] = useState<SystemBrandingConfig>(() => ({ ...branding }));
  const [activeTab, setActiveTab] = useState<SectionTarget>('header');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<'apply_changes' | 'reset_default'>('apply_changes');
  const [isApplying, setIsApplying] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when external update occurs
  useEffect(() => {
    setFormData({ ...branding });
  }, [branding]);

  // Check if there are unapplied / pending changes staged (deep compare)
  const hasPendingChanges = JSON.stringify(formData) !== JSON.stringify(branding);

  /**
   * Compress & convert image file to high-efficiency optimized Base64
   * (Resizes down to max 400x400 to prevent any localStorage or memory bloat)
   */
  const processImageFile = (file: File, target: SectionTarget) => {
    if (!file.type.startsWith('image/')) {
      setFeedbackMsg({
        type: 'error',
        text: isFa ? 'فایل انتخاب‌شده باید یک تصویر معتبر (PNG, JPG, SVG, WebP) باشد.' : 'Selected file must be a valid image.'
      });
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setFeedbackMsg({
        type: 'error',
        text: isFa ? 'حجم فایل لوگو نباید بیشتر از ۸ مگابایت باشد.' : 'Logo file size must be less than 8MB.'
      });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;

      // If SVG, no canvas compression needed
      if (file.type === 'image/svg+xml') {
        applyProcessedImage(rawDataUrl, target);
        setIsUploading(false);
        return;
      }

      // If PNG/JPG/WebP, compress via Canvas to ~350px for optimum crispness and lightweight storage (<40KB)
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Automatically crop/trim uniform solid or transparent margins around logo
          const trimmedCanvas = trimImageMargins(canvas);
          const optimizedDataUrl = trimmedCanvas.toDataURL('image/png', 0.92);
          applyProcessedImage(optimizedDataUrl, target);
        } else {
          applyProcessedImage(rawDataUrl, target);
        }
        setIsUploading(false);
      };

      img.onerror = () => {
        setIsUploading(false);
        setFeedbackMsg({
          type: 'error',
          text: isFa ? 'خطا در بارگذاری تصویر. لطفا فایل دیگری را امتحان فرمایید.' : 'Failed to parse image file.'
        });
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      setIsUploading(false);
      setFeedbackMsg({
        type: 'error',
        text: isFa ? 'خطا در خواندن فایل از حافظه.' : 'Failed to read file.'
      });
    };

    reader.readAsDataURL(file);
  };

  const applyProcessedImage = (dataUrl: string, target: SectionTarget) => {
    setFormData(prev => {
      if (target === 'header') {
        return {
          ...prev,
          formalHeader: {
            ...prev.formalHeader,
            useCustom: true,
            useGlobal: false,
            logoUrl: dataUrl
          }
        };
      } else if (target === 'sidebar') {
        return {
          ...prev,
          sidebarNav: {
            ...prev.sidebarNav,
            useCustom: true,
            useGlobal: false,
            logoUrl: dataUrl
          }
        };
      } else if (target === 'login') {
        return {
          ...prev,
          loginScreen: {
            ...prev.loginScreen,
            useCustom: true,
            useGlobal: false,
            logoUrl: dataUrl
          }
        };
      } else {
        // Global
        return {
          ...prev,
          logoUrl: dataUrl,
          logoType: 'custom'
        };
      }
    });

    setFeedbackMsg({
      type: 'info',
      text: isFa 
        ? 'تصویر با موفقیت در پیش‌نمایش بارگذاری شد. جهت ذخیره دائم، روی دکمه «تأیید و اعمال نهایی» کلیک فرمایید.' 
        : 'Image loaded in staging. Click "Confirm & Apply" to save changes permanently.'
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0], activeTab);
    }
  };

  /**
   * Trims whitespace and uniform margins from currently loaded image
   */
  const handleTrimCurrentImage = (target: SectionTarget) => {
    let targetUrl: string | null = null;
    if (target === 'login') {
      targetUrl = formData.loginScreen?.logoUrl || formData.logoUrl;
    } else if (target === 'sidebar') {
      targetUrl = formData.sidebarNav?.logoUrl || formData.logoUrl;
    } else if (target === 'header') {
      targetUrl = formData.formalHeader?.logoUrl || formData.logoUrl;
    } else {
      targetUrl = formData.logoUrl;
    }

    if (!targetUrl) return;

    setIsUploading(true);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const trimmed = trimImageMargins(canvas);
        const newUrl = trimmed.toDataURL('image/png', 0.92);
        applyProcessedImage(newUrl, target);
        setFeedbackMsg({
          type: 'success',
          text: isFa ? 'حاشیه‌های سفید تصویر با موفقیت حذف و تا مرز کادر تنظیم شد.' : 'White margins trimmed successfully.'
        });
      }
      setIsUploading(false);
    };
    img.onerror = () => {
      setIsUploading(false);
    };
    img.src = targetUrl;
  };

  // Execute Confirmed Apply (saves to server, memory, storage, and dispatches events)
  const handleExecuteConfirmedApply = async (directFormData?: SystemBrandingConfig) => {
    const dataToSave = directFormData || formData;
    setIsApplying(true);
    setFeedbackMsg(null);

    try {
      if (confirmModalType === 'reset_default') {
        const resetRes = await resetBranding(currentUser.fullName || currentUser.username);
        setFormData(resetRes);
        addAuditLog(currentUser.username, 'بازنشانی و بازگشت کلیه لوگوهای سامانه به نشان استاندارد HSE', 'موفقیت‌آمیز');
        setFeedbackMsg({
          type: 'success',
          text: isFa 
            ? '✓ کلیه لوگوها و آرم‌های سامانه به نشان استاندارد رسمی HSE بازنشانی و اعمال شدند.' 
            : 'Reset to default HSE logo confirmed and applied.'
        });
      } else {
        const savedRes = await updateBranding(dataToSave, currentUser.fullName || currentUser.username);
        setFormData(savedRes);
        addAuditLog(
          currentUser.username, 
          'تأیید و اعمال نهایی تنظیمات لوگوی اختصاصی (سربرگ رسمی، سایدبار، ناوبری، صفحه ورود)', 
          'موفقیت‌آمیز'
        );
        setFeedbackMsg({
          type: 'success',
          text: isFa 
            ? '✓ تغییرات لوگو با موفقیت در پایگاه داده تأیید و ذخیره گردید و در سربرگ رسمی، سایدبار، ناوبری و صفحه ورود اعمال شد.' 
            : '✓ Logo changes successfully saved and applied to formal header, sidebar, navigation, and login screen.'
        });
      }
      setIsConfirmModalOpen(false);
    } catch (err) {
      console.error('Failed to apply branding changes:', err);
      setFeedbackMsg({
        type: 'error',
        text: isFa ? 'خطا در ذخیره و اعمال تغییرات در پایگاه داده سامانه.' : 'Error applying branding changes.'
      });
    } finally {
      setIsApplying(false);
    }
  };

  // Revert staged changes back to currently active database configuration
  const handleDiscardStaged = () => {
    setFormData({ ...branding });
    setFeedbackMsg({
      type: 'info',
      text: isFa ? 'تغییرات تأییدنشده لغو شدند و تنظیمات فعال فعلی بازیابی گردید.' : 'Pending staged changes discarded.'
    });
  };

  // Propagate active global logo to all three sections
  const handlePropagateGlobalToAll = () => {
    const globalLogo = formData.logoUrl;
    setFormData(prev => ({
      ...prev,
      formalHeader: {
        ...prev.formalHeader,
        useCustom: Boolean(globalLogo),
        useGlobal: true,
        logoUrl: globalLogo
      },
      sidebarNav: {
        ...prev.sidebarNav,
        useCustom: Boolean(globalLogo),
        useGlobal: true,
        logoUrl: globalLogo
      },
      loginScreen: {
        ...prev.loginScreen,
        useCustom: Boolean(globalLogo),
        useGlobal: true,
        logoUrl: globalLogo
      }
    }));
    setFeedbackMsg({
      type: 'info',
      text: isFa 
        ? 'لوگوی جامع برای سربرگ، سایدبار و صفحه ورود تنظیم شد. جهت نهایی‌سازی، دکمه «تأیید و اعمال نهایی» را بفشارید.' 
        : 'Global logo propagated to all sections. Click "Confirm & Apply" to publish.'
    });
  };

  // Get active logo status for tabs
  const getTabStatus = (target: SectionTarget) => {
    if (target === 'header') {
      const conf = formData.formalHeader || DEFAULT_FORMAL_HEADER_CONFIG;
      if (conf.useGlobal) return formData.logoUrl ? 'لوگوی جامع' : 'نشان HSE';
      return conf.useCustom && conf.logoUrl ? 'لوگوی اختصاصی' : 'نشان HSE';
    } else if (target === 'sidebar') {
      const conf = formData.sidebarNav || DEFAULT_SIDEBAR_NAV_CONFIG;
      if (conf.useGlobal) return formData.logoUrl ? 'لوگوی جامع' : 'نشان HSE';
      return conf.useCustom && conf.logoUrl ? 'لوگوی اختصاصی' : 'نشان HSE';
    } else if (target === 'login') {
      const conf = formData.loginScreen || DEFAULT_LOGIN_SCREEN_CONFIG;
      if (conf.useGlobal) return formData.logoUrl ? 'لوگوی جامع' : 'نشان HSE';
      return conf.useCustom && conf.logoUrl ? 'لوگوی اختصاصی' : 'نشان HSE';
    } else {
      return formData.logoUrl ? 'دارای آرم جامع' : 'نشان پیش‌فرض';
    }
  };

  // Resolve current active target values
  const currentHeader = formData.formalHeader || DEFAULT_FORMAL_HEADER_CONFIG;
  const currentSidebar = formData.sidebarNav || DEFAULT_SIDEBAR_NAV_CONFIG;
  const currentLogin = formData.loginScreen || DEFAULT_LOGIN_SCREEN_CONFIG;

  const resolvedHeader = getFormalHeaderBranding(formData);
  const resolvedSidebar = getSidebarNavBranding(formData);
  const resolvedLogin = getLoginScreenBranding(formData);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/30 shrink-0">
              <LayoutTemplate className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                  {isFa ? 'مدیریت و سفارشی‌سازی مستقل آرم و لوگوی سامانه' : 'System Independent Logo Customization'}
                </h2>
                {hasPendingChanges && (
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{isFa ? 'تغییرات معلق (نیاز به تأیید و اعمال نهایی)' : 'Unsaved Changes'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-bold mt-1">
                {isFa 
                  ? 'شخصی‌سازی مستقل آرم برای سربرگ رسمی و پروانه‌ها، سایدبار و ناوبری، و صفحه ورود به همراه پیش‌نمایش بی‌درنگ.'
                  : 'Customize separate branding for Official Header, Sidebar & Nav, and Login Screen with real-time live preview.'}
              </p>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
            {hasPendingChanges && (
              <button
                type="button"
                onClick={handleDiscardStaged}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isFa ? 'انصراف از تغییرات' : 'Discard'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setConfirmModalType('reset_default');
                setIsConfirmModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-xs font-black transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-rose-500" />
              <span>{isFa ? 'بازنشانی به پیش‌فرض کارخانه' : 'Reset All to Defaults'}</span>
            </button>

            <button
              type="button"
              disabled={isApplying}
              onClick={() => handleExecuteConfirmedApply()}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                hasPendingChanges 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-500/25 scale-[1.02]' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/15'
              }`}
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isFa ? 'در حال ثبت و انتشار در سامانه...' : 'Saving to System...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isFa ? 'تأیید و اعمال نهایی در سراسر سامانه' : 'Confirm & Apply All'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMsg && (
          <div className={`p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between border transition-all ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : feedbackMsg.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                : feedbackMsg.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800'
          }`}>
            <div className="flex items-center gap-2.5">
              {feedbackMsg.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
              {feedbackMsg.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />}
              {feedbackMsg.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />}
              {feedbackMsg.type === 'info' && <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />}
              <span>{feedbackMsg.text}</span>
            </div>
            <button 
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-black cursor-pointer px-2"
              title={isFa ? 'بستن پیام' : 'Close'}
            >
              ✕
            </button>
          </div>
        )}

        {/* Section Target Navigation Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('header')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeTab === 'header'
                ? 'bg-amber-500/10 border-amber-500 text-amber-950 dark:text-amber-100 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Printer className={`w-4 h-4 ${activeTab === 'header' ? 'text-amber-600 dark:text-amber-400' : ''}`} />
                <span className="font-black text-xs sm:text-sm">
                  {isFa ? '۱. سربرگ رسمی و پروانه‌ها' : '1. Official Header'}
                </span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'header' 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {getTabStatus('header')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {isFa ? 'چاپ فرم‌ها، چک‌لیست‌ها و گزارش‌های A4/A5' : 'Permits, audit checklists & PDF reports'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sidebar')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeTab === 'sidebar'
                ? 'bg-sky-500/10 border-sky-500 text-sky-950 dark:text-sky-100 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Layers className={`w-4 h-4 ${activeTab === 'sidebar' ? 'text-sky-600 dark:text-sky-400' : ''}`} />
                <span className="font-black text-xs sm:text-sm">
                  {isFa ? '۲. سایدبار و ناوبری سامانه' : '2. Sidebar & Navigation'}
                </span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'sidebar' 
                  ? 'bg-sky-500 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {getTabStatus('sidebar')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {isFa ? 'منوی ناوبری اصلی، هدر بالا و آیکون شناور' : 'Sidebar header, top navigation & icons'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeTab === 'login'
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Lock className={`w-4 h-4 ${activeTab === 'login' ? 'text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span className="font-black text-xs sm:text-sm">
                  {isFa ? '۳. صفحه ورود (Login)' : '3. Login Screen'}
                </span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'login' 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {getTabStatus('login')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {isFa ? 'آرم مرکزی، عنوان مجتمع و برندینگ ورود' : 'Center emblem, portal title & credentials'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeTab === 'global'
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-4 h-4 ${activeTab === 'global' ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                <span className="font-black text-xs sm:text-sm">
                  {isFa ? '۴. لوگوی جامع و اشتراکی' : '4. Master Global Brand'}
                </span>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                activeTab === 'global' 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {getTabStatus('global')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {isFa ? 'اعمال همزمان به تمامی بخش‌ها با ۱ کلیک' : 'Universal brand & one-click propagation'}
            </p>
          </button>
        </div>
      </div>

      {/* Hidden File Input for uploading */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processImageFile(e.target.files[0], activeTab);
          }
        }}
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
      />

      {/* ===================== TAB 1: FORMAL HEADER ===================== */}
      {activeTab === 'header' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-amber-500" />
                  <span>{isFa ? 'تنظیمات آرم سربرگ رسمی و چاپی' : 'Official Header Settings'}</span>
                </h3>
              </div>

              {/* Source Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 block">
                  {isFa ? 'منبع نمایش لوگو در سربرگ‌های رسمی:' : 'Logo Source for Header:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        formalHeader: {
                          ...prev.formalHeader,
                          useCustom: false,
                          useGlobal: false
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      !currentHeader.useCustom && !currentHeader.useGlobal
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'نشان رسمی HSE' : 'HSE Default'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        formalHeader: {
                          ...prev.formalHeader,
                          useCustom: Boolean(prev.logoUrl),
                          useGlobal: true
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      currentHeader.useGlobal
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'ارث‌بری از لوگوی جامع' : 'Use Global'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        formalHeader: {
                          ...prev.formalHeader,
                          useCustom: true,
                          useGlobal: false
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      currentHeader.useCustom && !currentHeader.useGlobal
                        ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'آرم اختصاصی مجزا' : 'Custom Dedicated'}
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                  isDragOver 
                    ? 'border-amber-500 bg-amber-500/10 scale-[0.99]' 
                    : 'border-slate-300 dark:border-slate-700 hover:border-amber-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                      {isFa ? 'کلیک یا رهاسازی تصویر برای سربرگ رسمی' : 'Click or drop logo for Formal Header'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      PNG (شفاف)، JPG، SVG (حداکثر ۸ مگابایت)
                    </span>
                  </div>
                </div>
              </div>

              {/* Clear / Reset this section's logo button */}
              {currentHeader.logoUrl && !currentHeader.useGlobal && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      formalHeader: {
                        ...prev.formalHeader,
                        logoUrl: null,
                        useCustom: false
                      }
                    }));
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isFa ? 'حذف لوگوی اختصاصی سربرگ (بازگشت به نشان HSE)' : 'Remove Header Custom Logo'}</span>
                </button>
              )}

              {/* Alignment & Aspect Ratio */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-1">
                    {isFa ? 'موقعیت در کادر سربرگ:' : 'Position:'}
                  </label>
                  <select
                    value={currentHeader.logoPosition}
                    onChange={(e) => {
                      const pos = e.target.value as 'right' | 'center' | 'left';
                      setFormData(prev => ({
                        ...prev,
                        formalHeader: { ...prev.formalHeader, logoPosition: pos }
                      }));
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold"
                  >
                    <option value="right">{isFa ? 'سمت راست (استاندارد فارسی)' : 'Right'}</option>
                    <option value="center">{isFa ? 'وسط سربرگ' : 'Center'}</option>
                    <option value="left">{isFa ? 'سمت چپ (استاندارد لاتین)' : 'Left'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-1">
                    {isFa ? 'تناسب تصویر (Fit):' : 'Aspect Ratio:'}
                  </label>
                  <select
                    value={currentHeader.aspectRatioMode}
                    onChange={(e) => {
                      const mode = e.target.value as 'contain' | 'cover' | 'natural';
                      setFormData(prev => ({
                        ...prev,
                        formalHeader: { ...prev.formalHeader, aspectRatioMode: mode }
                      }));
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold"
                  >
                    <option value="contain">{isFa ? 'حفظ تناسب کامل (Contain)' : 'Contain'}</option>
                    <option value="cover">{isFa ? 'پر کردن کادر (Cover)' : 'Cover'}</option>
                    <option value="natural">{isFa ? 'اندازه طبیعی (Natural)' : 'Natural'}</option>
                  </select>
                </div>
              </div>

              {/* Organization Titles */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-1">
                    {isFa ? 'عنوان فارسی مجتمع / سازمان:' : 'Organization Name (Fa):'}
                  </label>
                  <input
                    type="text"
                    value={formData.organizationNameFa}
                    onChange={(e) => setFormData(prev => ({ ...prev, organizationNameFa: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold"
                    placeholder="مثال: شرکت پتروشیمی رازی"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-1">
                    {isFa ? 'عنوان انگلیسی سازمان:' : 'Organization Name (En):'}
                  </label>
                  <input
                    type="text"
                    value={formData.organizationNameEn}
                    onChange={(e) => setFormData(prev => ({ ...prev, organizationNameEn: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold"
                    placeholder="e.g. Petrochemical Complex - HSE Dept"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {isFa ? 'پیش‌نمایش زنده در سربرگ رسمی و خروجی چاپی پروانه‌های کار' : 'Live Official Report Header Preview'}
                  </span>
                </div>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                  {isFa ? 'چاپ استاندارد A4' : 'A4 Standard Print'}
                </span>
              </div>

              {/* Real FormalReportHeader component preview */}
              <div className="bg-white p-3 sm:p-5 rounded-2xl shadow-sm border border-slate-200 text-slate-900">
                <FormalReportHeader
                  docCode="HSE-PRM-2025-042"
                  docDate="۱۴۰۴/۰۱/۱۵"
                  title="پروانه انجام کارهای گرم و مرتفع (Hot & Height Work Permit)"
                  classification="محرمانه - داخلی مجتمع"
                  logoPositionOverride={resolvedHeader.position}
                  logoUrlOverride={resolvedHeader.logoUrl}
                  aspectRatioOverride={resolvedHeader.aspectRatio}
                  orgTitleFaOverride={formData.organizationNameFa}
                  orgTitleEnOverride={formData.organizationNameEn}
                />
                <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 text-center text-xs font-bold">
                  {isFa ? '«محتوای فرم، چک‌لیست‌های ایمنی، جدول نفرات و مجوز صدور پروانه در این قسمت قرار می‌گیرد»' : 'Form content and checklist fields are rendered here'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: SIDEBAR & NAVIGATION ===================== */}
      {activeTab === 'sidebar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-500" />
                  <span>{isFa ? 'تنظیمات آرم سایدبار و ناوبری' : 'Sidebar & Navigation Settings'}</span>
                </h3>
              </div>

              {/* Source Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 block">
                  {isFa ? 'منبع لوگوی سایدبار:' : 'Sidebar Logo Source:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        sidebarNav: {
                          ...prev.sidebarNav,
                          useCustom: false,
                          useGlobal: false
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      !currentSidebar.useCustom && !currentSidebar.useGlobal
                        ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'نشان رسمی HSE' : 'HSE Default'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        sidebarNav: {
                          ...prev.sidebarNav,
                          useCustom: Boolean(prev.logoUrl),
                          useGlobal: true
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      currentSidebar.useGlobal
                        ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'ارث‌بری از لوگوی جامع' : 'Use Global'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        sidebarNav: {
                          ...prev.sidebarNav,
                          useCustom: true,
                          useGlobal: false
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      currentSidebar.useCustom && !currentSidebar.useGlobal
                        ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'آرم اختصاصی مجزا' : 'Custom Dedicated'}
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                  isDragOver 
                    ? 'border-sky-500 bg-sky-500/10 scale-[0.99]' 
                    : 'border-slate-300 dark:border-slate-700 hover:border-sky-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                      {isFa ? 'کلیک یا رهاسازی تصویر برای سایدبار' : 'Click or drop logo for Sidebar'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      پیشنهاد: تصویر مربعی با زمینه شفاف PNG یا SVG
                    </span>
                  </div>
                </div>
              </div>

              {/* Clear Button */}
              {currentSidebar.logoUrl && !currentSidebar.useGlobal && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      sidebarNav: {
                        ...prev.sidebarNav,
                        logoUrl: null,
                        useCustom: false
                      }
                    }));
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isFa ? 'حذف لوگوی اختصاصی سایدبار' : 'Remove Sidebar Logo'}</span>
                </button>
              )}

              {/* Title & Display Options */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-600 dark:text-slate-300">
                    {isFa ? 'نمایش متن عنوان در کنار لوگوی سایدبار:' : 'Show Title Text in Sidebar:'}
                  </label>
                  <input
                    type="checkbox"
                    checked={currentSidebar.showTitle}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        sidebarNav: { ...prev.sidebarNav, showTitle: e.target.checked }
                      }));
                    }}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                </div>

                {currentSidebar.showTitle && (
                  <div>
                    <label className="text-xs font-black text-slate-600 dark:text-slate-300 block mb-1">
                      {isFa ? 'متن عنوان سایدبار:' : 'Sidebar Title Text:'}
                    </label>
                    <input
                      type="text"
                      value={currentSidebar.titleText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          sidebarNav: { ...prev.sidebarNav, titleText: val }
                        }));
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold"
                      placeholder="e.g. HSECORE"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-3xl p-5 border border-slate-200 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {isFa ? 'پیش‌نمایش زنده هدر سایدبار (حالت باز و حالت جمع‌شده)' : 'Live Sidebar Header Preview'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Expanded Sidebar Mockup */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <span className="text-[10px] font-black text-slate-400 block">
                    {isFa ? 'حالت باز (Expanded)' : 'Expanded State'}
                  </span>
                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2.5">
                      <HseLogo
                        size="sm"
                        overrideLogoUrl={resolvedSidebar.logoUrl}
                        forceDefault={!resolvedSidebar.isCustom}
                        showShadow={false}
                      />
                      {currentSidebar.showTitle && (
                        <h4 className="select-none flex items-center leading-none" dir="ltr">
                          <HseCoreBrandText 
                            size="sidebar"
                            titleOverride={currentSidebar.titleText}
                            themeAdapt={true}
                          />
                        </h4>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-40">
                      <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
                      <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
                    </div>
                  </div>
                </div>

                {/* Collapsed Sidebar Mockup */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <span className="text-[10px] font-black text-slate-400 block">
                    {isFa ? 'حالت جمع‌شده (Collapsed)' : 'Collapsed State'}
                  </span>
                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/40">
                    <div className="p-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <HseLogo 
                        size="sm" 
                        overrideLogoUrl={resolvedSidebar.logoUrl} 
                        forceDefault={!resolvedSidebar.isCustom}
                        showShadow={false} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: LOGIN SCREEN ===================== */}
      {activeTab === 'login' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-500" />
                  <span>{isFa ? 'تنظیمات آرم صفحه ورود به سامانه' : 'Login Screen Logo Settings'}</span>
                </h3>
              </div>

              {/* Source Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 block">
                  {isFa ? 'منبع لوگوی صفحه ورود:' : 'Login Logo Source:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        loginScreen: {
                          ...prev.loginScreen,
                          useCustom: false,
                          useGlobal: false
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      !currentLogin.useCustom && !currentLogin.useGlobal
                        ? 'bg-indigo-500 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'نشان رسمی HSE' : 'HSE Default'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        loginScreen: {
                          ...prev.loginScreen,
                          useCustom: Boolean(prev.logoUrl),
                          useGlobal: true
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      currentLogin.useGlobal
                        ? 'bg-indigo-500 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'ارث‌بری از لوگوی جامع' : 'Use Global'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        loginScreen: {
                          ...prev.loginScreen,
                          useCustom: true,
                          useGlobal: false
                        }
                      }));
                    }}
                    className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                      currentLogin.useCustom && !currentLogin.useGlobal
                        ? 'bg-indigo-500 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'آرم اختصاصی مجزا' : 'Custom Dedicated'}
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                  isDragOver 
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]' 
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                      {isFa ? 'کلیک یا رهاسازی تصویر برای صفحه ورود' : 'Click or drop logo for Login Screen'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      تصویر با رزولوشن بالا برای حلقه گرادیان صفحه ورود
                    </span>
                  </div>
                </div>
              </div>

              {/* Frame Fit Mode (Cover vs Contain) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                  {isFa ? 'نحوه انطباق با کادر دایره‌ای ورود' : 'Circular Frame Fit Mode'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        loginScreen: {
                          ...prev.loginScreen,
                          aspectRatioMode: 'cover'
                        }
                      }));
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                      (currentLogin.aspectRatioMode || 'cover') === 'cover'
                        ? 'bg-indigo-500 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'تمام کادر بدون حاشیه (Cover)' : 'Edge-to-Edge Fill'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        loginScreen: {
                          ...prev.loginScreen,
                          aspectRatioMode: 'contain'
                        }
                      }));
                    }}
                    className={`py-2 px-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                      currentLogin.aspectRatioMode === 'contain'
                        ? 'bg-indigo-500 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isFa ? 'حفظ تناسب با حاشیه امن (Contain)' : 'Contain with Margin'}
                  </button>
                </div>
              </div>

              {/* Remove Outer Margin Toggle */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    {isFa ? 'حذف حاشیه سفید دور لوگو (چسبیده به کادر)' : 'Zero Gap Margin'}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {isFa ? 'لوگو بدون فاصله خالی مستقیماً مماس بر حلقه گرادیان دایره‌ای قرار می‌گیرد' : 'Logo expands to touch the circular border with zero gap'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      loginScreen: {
                        ...prev.loginScreen,
                        removePadding: !(prev.loginScreen?.removePadding ?? true)
                      }
                    }));
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    (currentLogin.removePadding ?? true) ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      (currentLogin.removePadding ?? true) ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Trim whitespace from current image */}
              {resolvedLogin.logoUrl && (
                <button
                  type="button"
                  onClick={() => handleTrimCurrentImage('login')}
                  className="w-full py-2.5 px-3 rounded-xl border border-sky-300 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-xs font-bold hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>{isFa ? 'برش خودکار و حذف حاشیه سفید دور تصویر فعلی' : 'Auto-Trim White Margins on Current Logo'}</span>
                </button>
              )}

              {/* Clear Button */}
              {currentLogin.logoUrl && !currentLogin.useGlobal && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      loginScreen: {
                        ...prev.loginScreen,
                        logoUrl: null,
                        useCustom: false
                      }
                    }));
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isFa ? 'حذف لوگوی اختصاصی صفحه ورود' : 'Remove Login Logo'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 text-white space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black text-slate-200">
                    {isFa ? 'پیش‌نمایش زنده در پورتال احراز هویت و ورود' : 'Live Login Portal Preview'}
                  </span>
                </div>
              </div>

              {/* Realistic Login Screen Mockup */}
              <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-sky-400 via-emerald-400 to-amber-400 shadow-xl shadow-sky-500/20 shrink-0 overflow-hidden">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center shadow-inner overflow-hidden ${
                    resolvedLogin.isCustom && (currentLogin.removePadding ?? true) ? 'p-0' : 'p-1.5'
                  }`}>
                    <HseLogo 
                      size="xl" 
                      overrideLogoUrl={resolvedLogin.logoUrl} 
                      forceDefault={!resolvedLogin.isCustom}
                      overrideAspectRatio={resolvedLogin.aspectRatio}
                      target="login"
                      showShadow={false}
                      className="w-full h-full rounded-full overflow-hidden" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="leading-none select-none" dir="ltr">
                    <HseCoreBrandText 
                      size="xl"
                      themeAdapt={false}
                    />
                  </h2>
                  <p className="text-xs text-slate-400 font-bold">
                    {formData.organizationNameFa}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: GLOBAL MASTER BRAND ===================== */}
      {activeTab === 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  <span>{isFa ? 'لوگوی جامع و یکپارچه سازمانی' : 'Global Master Logo'}</span>
                </h3>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                {isFa 
                  ? 'این آرم به عنوان لوگوی مرجع کل سیستم شناخته می‌شود. هر بخشی که روی «ارث‌بری از لوگوی جامع» تنظیم شده باشد، این لوگو را نمایش خواهد داد.' 
                  : 'This acts as the master fallback logo. Any section set to "Use Global" will inherit this image.'}
              </p>

              {/* Upload Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                  isDragOver 
                    ? 'border-emerald-500 bg-emerald-500/10 scale-[0.99]' 
                    : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                      {isFa ? 'بارگذاری لوگوی جامع سیستم' : 'Upload Global Logo'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      فرمت PNG شفاف، SVG یا JPG
                    </span>
                  </div>
                </div>
              </div>

              {/* One-Click Propagate Button */}
              {formData.logoUrl && (
                <button
                  type="button"
                  onClick={handlePropagateGlobalToAll}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  <Copy className="w-4 h-4" />
                  <span>{isFa ? 'انتشار این آرم به عنوان لوگوی سربرگ، سایدبار و ورود' : 'Apply to Header, Sidebar & Login'}</span>
                </button>
              )}

              {formData.logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      logoUrl: null,
                      logoType: 'default'
                    }));
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isFa ? 'حذف لوگوی جامع (بازگشت به نشان HSE)' : 'Remove Global Logo'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-100 dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/80 flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md">
                <HseLogo size="2xl" overrideLogoUrl={formData.logoUrl} showShadow={false} />
              </div>
              <div>
                <h4 className="font-black text-base text-slate-800 dark:text-slate-100">
                  {formData.logoUrl ? (isFa ? 'لوگوی فعال جامع سامانه' : 'Active Master Logo') : (isFa ? 'نشان استاندارد پیش‌فرض HSE' : 'Default HSE Emblem')}
                </h4>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  {formData.organizationNameFa}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${
                confirmModalType === 'reset_default' 
                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              }`}>
                {confirmModalType === 'reset_default' ? <RotateCcw className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  {confirmModalType === 'reset_default' 
                    ? (isFa ? 'بازنشانی کلیه لوگوها به پیش‌فرض' : 'Reset All to Defaults') 
                    : (isFa ? 'تأیید و انتشار رسمی تغییرات لوگو' : 'Confirm & Publish Branding')}
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  {isFa ? 'اعمال دائم در پایگاه داده سامانه HSE' : 'Permanent database update'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold">
              {confirmModalType === 'reset_default'
                ? (isFa 
                    ? 'آیا از بازنشانی کلیه لوگوهای سربرگ، سایدبار و صفحه ورود به نشان استاندارد رسمی HSE اطمینان دارید؟ این عمل کلیه تصاویر اختصاصی را به حالت پیش‌فرض بازمی‌گرداند.' 
                    : 'Are you sure you want to reset all logos back to the official default HSE emblem?')
                : (isFa
                    ? 'تنظیمات و آرم‌های اختصاصی انتخاب‌شده پس از تأیید بلافاصله در سربرگ رسمی فرم‌ها، سایدبار، ناوبری و صفحه ورود اعمال خواهند شد.'
                    : 'The staged logos will be saved to the database and immediately applied to all forms, sidebar, navigation, and login screen.')}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isApplying}
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-black hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>

              <button
                type="button"
                disabled={isApplying}
                onClick={() => handleExecuteConfirmedApply()}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
                  confirmModalType === 'reset_default'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                }`}
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isFa ? 'در حال اعمال...' : 'Applying...'}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isFa ? 'تأیید قطعی و اعمال در سامانه' : 'Confirm & Apply'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
