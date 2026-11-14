import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { 
  KeyRound, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Languages, 
  Lock, 
  AlertTriangle, 
  RefreshCw, 
  Sun, 
  Moon, 
  Activity,
  ArrowRight,
  ArrowLeft,
  Leaf
} from 'lucide-react';
import { addAuditLog } from '../utils/authHelper';
import { apiDb } from '../services/apiDatabaseClient';
import { HseLogo } from './HseLogo';
import { HseCoreBrandText } from './common/HseCoreBrandText';
import { useSystemBranding, getLoginScreenBranding } from '../utils/systemBrandingHelper';
import { resumeAudioContext } from '../utils/notificationAudio';
import { HseThemeToggleButton } from '../motion';
import cleanIndustrialBg from '../assets/images/hsecore_clean_industrial_bg_1794484527057.jpg';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  language: 'en' | 'fa';
  setLanguage: (lang: 'en' | 'fa') => void;
  themeMode?: 'dark' | 'light';
  setThemeMode?: (mode: 'dark' | 'light', origin?: { x: number; y: number }) => void;
}

export default function LoginScreen({
  onLoginSuccess,
  language,
  setLanguage,
  themeMode = 'light',
  setThemeMode
}: LoginScreenProps) {
  const isFa = language === 'fa';
  const isLight = themeMode === 'light';
  const { branding } = useSystemBranding();
  const loginBranding = getLoginScreenBranding(branding);
  const isCustomLogin = loginBranding.isCustom;
  const removePadding = loginBranding.removePadding ?? true;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Password reset & Password change states
  const [forgotMode, setForgotMode] = useState(false);
  const [forceChangeMode, setForceChangeMode] = useState(false);
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate remembered username if available
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('hse_remembered_username');
      if (remembered) {
        setUsername(remembered);
        setRememberMe(true);
      }
    } catch {
      // Ignore storage access errors
    }

    // Silently unlock audio context on initial user interaction so emergency sirens play seamlessly
    const unlockAudio = () => {
      resumeAudioContext().catch(() => {});
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resumeAudioContext().catch(() => {});
    setErrorMsg('');
    setInfoMsg('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password.trim()) {
      setErrorMsg(isFa ? 'لطفاً نام کاربری و رمز عبور را وارد کنید.' : 'Please enter username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Authenticate with secure Backend API (Database + Bcrypt + JWT + HttpOnly Cookie)
      const result = await apiDb.login({ username: trimmedUsername, password });

      if (!result.success || !result.token || !result.user) {
        setIsSubmitting(false);
        setErrorMsg(result.error || (isFa ? 'نام کاربری یا رمز عبور اشتباه است.' : 'Incorrect username or password.'));
        addAuditLog(trimmedUsername, 'ورود ناموفق (Server-Side Auth Failed)', result.error || 'اطلاعات ورود نادرست');
        return;
      }

      // Persist or clear remembered username
      try {
        if (rememberMe) {
          localStorage.setItem('hse_remembered_username', trimmedUsername);
        } else {
          localStorage.removeItem('hse_remembered_username');
        }
      } catch {
        // Ignore storage errors
      }

      const { user } = result;

      // 2. Handle force password change policy
      if (user.forcePasswordChange) {
        setIsSubmitting(false);
        setInfoMsg(
          isFa
            ? 'سرپرست سیستم شما را ملزم به تغییر رمز عبور در اولین ورود کرده است.'
            : 'Administrator requires you to change your password on first login.'
        );
        setResetUser(user);
        setForceChangeMode(true);
        return;
      }

      // 3. Success callback
      onLoginSuccess(user);
    } catch (error: any) {
      setIsSubmitting(false);
      setErrorMsg(isFa ? 'خطا در برقراری ارتباط با سرور احراز هویت.' : 'Authentication server connection error.');
      addAuditLog(trimmedUsername, 'خطای اتصال به سرور احراز هویت', error.message || 'Connection Error');
    }
  };

  const handleForcePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!resetUser) return;

    if (newPassword.length < 6) {
      setErrorMsg(isFa ? 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' : 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(isFa ? 'رمزهای وارد شده همخوانی ندارند.' : 'Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiDb.changePassword(password, newPassword);
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMsg(res.error || (isFa ? 'خطا در تغییر رمز عبور.' : 'Failed to change password.'));
        return;
      }

      addAuditLog(resetUser.username, 'تغییر رمز عبور اجباری سرور (Forced Password Change)', 'موفقیت‌آمیز');
      setForceChangeMode(false);
      setResetUser(null);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setInfoMsg(
        isFa
          ? 'رمز عبور شما با موفقیت تغییر یافت. لطفاً با رمز جدید وارد شوید.'
          : 'Password changed successfully. Please log in with your new password.'
      );
    } catch {
      setIsSubmitting(false);
      setErrorMsg(isFa ? 'خطا در برقراری ارتباط با سرور.' : 'Server connection error.');
    }
  };

  const handleForgotPasswordRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const trimmed = username.trim();
    if (!trimmed) {
      setErrorMsg(isFa ? 'لطفاً نام کاربری خود را وارد کنید.' : 'Please enter your username.');
      return;
    }

    setInfoMsg(
      isFa
        ? 'درخواست بازنشانی رمز عبور ثبت شد. لطفاً جهت دریافت اطلاعات ورود با مدیر سیستم تماس بگیرید.'
        : 'Password reset request submitted. Please contact your system administrator to obtain access.'
    );

    addAuditLog(trimmed, 'درخواست فراموشی رمز عبور (Forgot Password request)', 'ثبت درخواست مدیر');
    setForgotMode(false);
  };

  const primarySubtitle = isFa
    ? 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست'
    : (branding.subTitleEn || 'The Core of HSE Management');

  const hsePillars = [
    {
      id: 'health',
      icon: Activity,
      iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/35 shadow-sm shadow-rose-950/40',
      staggerClass: 'login-stagger-2',
      title: isFa ? 'بهداشت و سلامت شغلی (Health)' : 'Occupational Health & Hygiene',
      desc: isFa
        ? 'پایش ادواری سلامت پرسنل، پرونده پزشکی و ارزیابی عوامل زیان‌آور محیط کار'
        : 'Periodic medical checkups, health dossiers & workplace exposure tracking'
    },
    {
      id: 'safety',
      icon: ShieldCheck,
      iconBg: 'bg-sky-500/25 text-sky-300 border-sky-400/40 shadow-sm shadow-sky-950/40',
      staggerClass: 'login-stagger-3',
      title: isFa ? 'ایمنی صنعتی و ارزیابی ریسک (Safety)' : 'Industrial Safety & Risk Control',
      desc: isFa
        ? 'صدور و نظارت بر پروانه‌های کار (PTW)، ثبت حوادث و ممیزی‌های تخصصی ایمنی'
        : 'Work permits (PTW), incident reporting & comprehensive risk assessments'
    },
    {
      id: 'environment',
      icon: Leaf,
      iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/35 shadow-sm shadow-emerald-950/40',
      staggerClass: 'login-stagger-4',
      title: isFa ? 'حفاظت محیط زیست و پایداری (Environment)' : 'Environmental Stewardship',
      desc: isFa
        ? 'مدیریت پسماندهای صنعتی، پایش آلاینده‌ها و استقرار استانداردهای زیست‌محیطی'
        : 'Industrial waste management, emissions monitoring & sustainability compliance'
    }
  ];

  return (
    <div
      dir={isFa ? 'rtl' : 'ltr'}
      className={`min-h-screen w-full max-w-full overflow-x-hidden relative flex flex-col justify-between selection:bg-sky-600 selection:text-white transition-colors duration-300 ${
        isLight ? 'bg-[#082f5e] text-slate-900' : 'bg-[#05152b] text-slate-100'
      }`}
    >
      {/* ── Industrial Petrochemical & Animated Curved Wave Backdrop ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Base Twilight Industrial Gradient */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            isLight
              ? 'bg-gradient-to-b from-[#072a57] via-[#0c3c74] to-[#082c56]'
              : 'bg-gradient-to-b from-[#041226] via-[#071f3d] to-[#041326]'
          }`}
        />

        {/* Pure Industrial Petrochemical Background (Clean, Zero Ghost UI/Text) */}
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500 ${
            isLight ? 'opacity-90' : 'opacity-65'
          }`}
          style={{
            backgroundImage: `url(${cleanIndustrialBg})`
          }}
        />
        <div
          className={`absolute inset-0 ${
            isLight
              ? 'bg-gradient-to-b from-[#062147]/30 via-[#07264e]/25 to-[#061e3e]/50'
              : 'bg-gradient-to-b from-[#030e1e]/55 via-[#061830]/50 to-[#030e1e]/75'
          }`}
        />

        {/* Animated Slow Curved Blue & Emerald Waves (GPU Compositor-Only) */}
        <svg
          className="absolute -top-16 -right-24 w-[65vw] max-w-[920px] h-auto opacity-85 login-wave-slow"
          viewBox="0 0 800 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M820 0H320C210 110 140 240 60 420C210 380 450 260 820 190V0Z"
            fill="url(#topBlueWave)"
          />
          <path
            d="M820 60C620 40 460 110 350 240C480 185 650 155 820 180V60Z"
            fill="url(#topEmeraldRibbon)"
          />
          <defs>
            <linearGradient id="topBlueWave" x1="60" y1="0" x2="820" y2="420" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0ea5e9" stopOpacity="0.22" />
              <stop offset="1" stopColor="#0369a1" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="topEmeraldRibbon" x1="350" y1="60" x2="820" y2="240" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10b981" stopOpacity="0.55" />
              <stop offset="1" stopColor="#059669" stopOpacity="0.18" />
            </linearGradient>
          </defs>
        </svg>

        <svg
          className="absolute -bottom-10 inset-x-0 w-full h-[220px] sm:h-[280px] object-cover login-wave-reverse"
          viewBox="0 0 1440 320"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M0 192C220 265 440 295 720 250C1000 205 1240 120 1440 165V320H0V192Z"
            fill="url(#bottomDeepWave)"
          />
          <path
            d="M0 140C160 220 340 275 560 278C360 298 160 268 0 215V140Z"
            fill="url(#bottomLeftEmerald)"
          />
          <path
            d="M1440 95C1260 105 1110 175 960 265C1140 215 1300 185 1440 190V95Z"
            fill="url(#bottomRightEmerald)"
          />
          <defs>
            <linearGradient id="bottomDeepWave" x1="0" y1="120" x2="1440" y2="320" gradientUnits="userSpaceOnUse">
              <stop stopColor="#082f5e" stopOpacity="0.92" />
              <stop offset="0.5" stopColor="#0c3c73" stopOpacity="0.95" />
              <stop offset="1" stopColor="#07264d" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="bottomLeftEmerald" x1="0" y1="140" x2="560" y2="290" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10b981" stopOpacity="0.75" />
              <stop offset="1" stopColor="#0ea5e9" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="bottomRightEmerald" x1="960" y1="95" x2="1440" y2="265" gradientUnits="userSpaceOnUse">
              <stop stopColor="#059669" stopOpacity="0.2" />
              <stop offset="1" stopColor="#10b981" stopOpacity="0.65" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ── Top Utility Bar: Title with Emerald Bar on Right, Theme & Language Pills on Left ── */}
      <header className="relative z-20 w-full px-4 sm:px-8 lg:px-12 pt-3.5 sm:pt-5 pb-2 flex items-center justify-between gap-3 sm:gap-4 login-stagger-1">
        {/* Right Corner (in RTL): Organization Title with Vertical Emerald Accent */}
        <div className="flex items-center gap-2.5 min-w-0 order-1 rtl:order-1 ltr:order-2">
          <span className="w-0.5 h-4 bg-emerald-400 rounded-full shrink-0 shadow-xs shadow-emerald-400/60" aria-hidden="true" />
          <span
            className="text-xs sm:text-sm font-medium text-white/95 truncate drop-shadow-xs"
            title={
              isFa
                ? (branding.organizationNameFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)')
                : (branding.organizationNameEn || 'HSECORE — The Core of HSE Management')
            }
          >
            {isFa
              ? (branding.organizationNameFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)')
              : (branding.organizationNameEn || 'HSECORE — The Core of HSE Management')}
          </span>
        </div>

        {/* Left Corner (in RTL): Action Icons (Language switch & Theme toggle) */}
        <div className="flex items-center gap-2.5 shrink-0 order-2 rtl:order-2 ltr:order-1">
          <button
            type="button"
            onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
            title={language === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
            aria-label={language === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
            id="login-language-toggle-btn"
            className="group h-9 px-3.5 rounded-full bg-slate-900/45 hover:bg-slate-900/70 backdrop-blur-md border border-white/20 hover:border-sky-400/60 text-white transition-all duration-200 cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0"
          >
            <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-300 transition-transform duration-200 group-hover:scale-110 shrink-0" />
            <span>{isFa ? 'EN' : 'فارسی'}</span>
          </button>

          {setThemeMode && (
            <HseThemeToggleButton
              themeMode={themeMode}
              onToggle={(origin) => setThemeMode(isLight ? 'dark' : 'light', origin)}
              isFa={isFa}
              variant="login"
              id="login-theme-toggle-btn"
            />
          )}
        </div>
      </header>

      {/* ── Main Content Viewport ── */}
      <main className="relative z-10 w-full max-w-[1100px] mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-5 flex-1 flex items-center justify-center">
        <div className="login-card-enter login-theme-surface w-full grid grid-cols-1 lg:grid-cols-12 rounded-2xl sm:rounded-[28px] overflow-hidden bg-white dark:bg-[#0f172a] border border-white/40 dark:border-slate-700/80 shadow-[0_25px_70px_-15px_rgba(3,12,28,0.65)] relative">
          
          {/* ══════════════ BRAND & IDENTITY PANEL (Right in RTL / Left in LTR) ══════════════ */}
          <div
            className="lg:col-span-5 p-5 sm:p-7 lg:p-9 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-[#06182e] via-[#092240] to-[#061529] text-white"
          >
            {/* Subtle Petrochemical Refinery Ambient Overlay inside Brand Panel */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
              style={{
                backgroundImage: `url(${cleanIndustrialBg})`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#06182e]/88 via-[#08203e]/78 to-[#061529]/92 pointer-events-none" />

            {/* Curved Emerald-Green Diagonal Ribbon along the seam (Desktop) */}
            <svg
              className={`hidden lg:block absolute top-0 bottom-0 h-full w-12 pointer-events-none z-20 ${
                isFa ? '-left-1' : '-right-1 scale-x-[-1]'
              }`}
              viewBox="0 0 60 800"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M0 0H28C54 240 46 530 16 800H0V0Z"
                fill="url(#panelDividerRibbon)"
              />
              <path
                d="M0 0H12C38 250 30 540 4 800H0V0Z"
                fill="#ffffff"
                className="dark:fill-[#0f172a] transition-colors duration-300"
              />
              <defs>
                <linearGradient id="panelDividerRibbon" x1="25" y1="0" x2="25" y2="800" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981" />
                  <stop offset="0.55" stopColor="#059669" />
                  <stop offset="1" stopColor="#0284c7" />
                </linearGradient>
              </defs>
            </svg>

            <div className="relative z-10 space-y-4 sm:space-y-5">
              {/* Primary HSECORE Wordmark & Official Subtitle Centered */}
              <div className="flex flex-col items-center text-center space-y-2 sm:space-y-2.5 pt-0.5 sm:pt-1 login-logo-enter">
                {isCustomLogin ? (
                  <div className="relative p-1 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-300 shadow-lg shadow-emerald-950/50 shrink-0">
                    <div
                      className={`w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center overflow-hidden ${
                        removePadding ? 'p-0' : 'p-0.5'
                      }`}
                    >
                      <HseLogo
                        size="xl"
                        target="login"
                        showShadow={false}
                        className="w-full h-full rounded-full overflow-hidden"
                      />
                    </div>
                  </div>
                ) : null}

                {loginBranding.showHseCoreTitle !== false && (
                  <div className="min-w-0 flex flex-col items-center">
                    <h1 className="leading-none select-none drop-shadow-md" dir="ltr">
                      <HseCoreBrandText size="xl" themeAdapt={false} />
                    </h1>
                  </div>
                )}

                {/* Subtitle Directly Underneath HSECORE Name */}
                <div className="w-full pt-0.5 space-y-1.5">
                  <p className="text-xs sm:text-[15px] font-medium text-emerald-400 tracking-normal leading-snug">
                    {primarySubtitle}
                  </p>
                  <p className="text-[11.5px] text-slate-200/90 font-light leading-relaxed max-w-md lg:max-w-xs mx-auto hidden sm:block">
                    {isFa
                      ? 'پلتفرم یکپارچه سازمانی جهت مدیریت هوشمند ایمنی صنعتی با قابلیت‌های پیشرفته و استانداردهای جهانی'
                      : 'Enterprise platform for smart industrial safety management with advanced capabilities and global standards.'}
                  </p>
                </div>
              </div>

              {/* Three HSE Operational Pillars with Staggered Entrance & Responsive Tablet/Desktop Layout */}
              <div className="hidden sm:grid sm:grid-cols-3 lg:flex lg:flex-col gap-2.5 lg:gap-3 pt-1 lg:pt-2">
                {hsePillars.map((pillar) => {
                  const IconComponent = pillar.icon;
                  return (
                    <div
                      key={pillar.id}
                      className={`group login-pillar-card ${pillar.staggerClass} flex sm:flex-col lg:flex-row items-center sm:items-start lg:items-center gap-3 lg:gap-3.5 p-3 lg:p-3.5 rounded-2xl bg-[#0c2647]/75 hover:bg-[#103059]/90 backdrop-blur-md border border-sky-300/15 hover:border-emerald-400/35 shadow-sm`}
                    >
                      <div
                        className={`w-9 h-9 lg:w-10 lg:h-10 rounded-full border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${pillar.iconBg}`}
                      >
                        <IconComponent className="w-4 h-4 lg:w-4.5 lg:h-4.5" />
                      </div>
                      <div className="min-w-0 flex-1 text-start">
                        <h2 className="text-xs lg:text-[13px] font-medium text-white leading-snug">
                          {pillar.title}
                        </h2>
                        <p className="text-[10.5px] lg:text-[11px] text-slate-300/85 font-light leading-relaxed mt-0.5">
                          {pillar.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Compliance & Security Footer inside Brand Panel */}
            <div className="relative z-10 pt-3.5 lg:pt-4 mt-3.5 lg:mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300/90 login-stagger-5">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{isFa ? 'احراز هویت امن سازمانی' : 'Secure Enterprise Auth'}</span>
              </span>
              <span className="text-slate-200 font-mono text-[11px] tracking-wide" dir="ltr">
                ISO 45001 • ISO 14001
              </span>
            </div>
          </div>

          {/* ══════════════ AUTHENTICATION FORM PANEL (Left in RTL / Right in LTR) ══════════════ */}
          <div className="login-theme-surface lg:col-span-7 p-5 sm:p-8 md:p-10 lg:px-14 lg:py-11 flex flex-col justify-center bg-white dark:bg-[#0f172a] relative z-10">
            <div className="max-w-md w-full mx-auto space-y-4 sm:space-y-5">
              
              {/* Top Welcome Heading */}
              <div className="flex flex-col items-center text-center space-y-2 login-logo-enter">
                <div className="text-[44px] sm:text-[56px] md:text-[64px] lg:text-[72px] leading-tight font-bold text-black dark:text-white tracking-tight mb-1 transition-colors duration-300">
                  {isFa ? 'خوش آمدید' : 'Welcome'}
                </div>
                <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 font-light leading-relaxed">
                  {forgotMode
                    ? (isFa
                        ? 'نام کاربری خود را جهت ثبت درخواست بازنشانی رمز عبور وارد نمایید.'
                        : 'Enter your registered username to request a password reset.')
                    : forceChangeMode
                      ? (isFa
                          ? 'جهت حفظ امنیت حساب کاربری، لطفاً رمز عبور جدیدی تعیین نمایید.'
                          : 'For security compliance, please set a new password to continue.')
                      : (isFa
                          ? 'لطفاً نام کاربری و رمز عبور سازمانی خود را جهت ورود به سامانه وارد کنید.'
                          : 'Enter your organizational credentials to access the HSECORE portal.')}
                </p>
              </div>

              {/* Error & Info Feedback Banners */}
              {errorMsg && (
                <div
                  role="alert"
                  className="login-alert-error p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-2xl text-xs font-medium flex items-start gap-2.5 shadow-xs"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div
                  role="status"
                  className="login-alert-status p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-sky-800 dark:text-sky-300 rounded-2xl text-xs font-medium flex items-start gap-2.5 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                  <span className="leading-relaxed">{infoMsg}</span>
                </div>
              )}

              {/* ── 1. Standard Sign-In Form ── */}
              {!forgotMode && !forceChangeMode ? (
                <form onSubmit={handleLogin} className="space-y-4 sm:space-y-4.5" noValidate>
                  {/* Username Input */}
                  <div className="group space-y-1.5 login-stagger-2">
                    <label
                      htmlFor="login-username-input"
                      className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 group-focus-within:text-sky-700 dark:group-focus-within:text-sky-400 transition-colors duration-200 block text-start"
                    >
                      {isFa ? 'نام کاربری' : 'Username'}
                    </label>
                    <div className="relative">
                      <span
                        className={`absolute inset-y-0 flex items-center text-slate-400 dark:text-slate-500 group-focus-within:text-sky-600 dark:group-focus-within:text-sky-400 transition-colors duration-200 pointer-events-none ${
                          isFa ? 'right-0 pr-3.5' : 'left-0 pl-3.5'
                        }`}
                      >
                        <User className="w-4.5 h-4.5 transition-transform duration-200 group-focus-within:scale-110" />
                      </span>
                      <input
                        id="login-username-input"
                        type="text"
                        required
                        autoComplete="username"
                        placeholder={isFa ? 'نام کاربری خود را وارد کنید (مثلاً: admin)' : 'Enter your username (e.g. admin)'}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`login-input-field w-full h-11 sm:h-12 bg-slate-50/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
                          isFa ? 'pr-11 pl-4 text-right' : 'pl-11 pr-4 text-left'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="group space-y-1.5 login-stagger-3">
                    <label
                      htmlFor="login-password-input"
                      className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 group-focus-within:text-sky-700 dark:group-focus-within:text-sky-400 transition-colors duration-200 block text-start"
                    >
                      {isFa ? 'رمز عبور' : 'Password'}
                    </label>
                    <div className="relative">
                      <span
                        className={`absolute inset-y-0 flex items-center text-slate-400 dark:text-slate-500 group-focus-within:text-sky-600 dark:group-focus-within:text-sky-400 transition-colors duration-200 pointer-events-none ${
                          isFa ? 'right-0 pr-3.5' : 'left-0 pl-3.5'
                        }`}
                      >
                        <Lock className="w-4.5 h-4.5 transition-transform duration-200 group-focus-within:scale-110" />
                      </span>
                      <input
                        id="login-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder={isFa ? 'رمز عبور خود را وارد کنید' : 'Enter your password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`login-input-field w-full h-11 sm:h-12 bg-slate-50/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none focus:bg-white dark:focus:bg-slate-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
                          isFa ? 'pr-11 pl-11 text-right' : 'pl-11 pr-11 text-left'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? (isFa ? 'مخفی‌سازی رمز عبور' : 'Hide password') : (isFa ? 'نمایش رمز عبور' : 'Show password')}
                        aria-label={showPassword ? (isFa ? 'مخفی‌سازی رمز عبور' : 'Hide password') : (isFa ? 'نمایش رمز عبور' : 'Show password')}
                        className={`absolute inset-y-0 flex items-center text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors duration-200 cursor-pointer ${
                          isFa ? 'left-0 pl-3.5' : 'right-0 pr-3.5'
                        }`}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4.5 h-4.5 transition-transform duration-200 hover:scale-110" />
                        ) : (
                          <Eye className="w-4.5 h-4.5 transition-transform duration-200 hover:scale-110" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password Row */}
                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5 login-stagger-4">
                    <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none transition-colors">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-transform duration-150 active:scale-90"
                      />
                      <span>{isFa ? 'مرا به خاطر بسپار' : 'Remember me'}</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setInfoMsg('');
                        setForgotMode(true);
                      }}
                      className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 hover:underline font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isFa ? 'فراموشی رمز عبور؟' : 'Forgot password?'}
                    </button>
                  </div>

                  {/* Primary Submit Button (Emerald-to-Blue Gradient Matching Reference Design) */}
                  <div className="pt-1 login-stagger-5">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group login-submit-btn w-full h-12 px-5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-600 disabled:opacity-65 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl shadow-lg shadow-emerald-600/25 cursor-pointer flex items-center justify-center gap-2.5 whitespace-nowrap"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>{isFa ? 'در حال احراز هویت و ورود...' : 'Signing in...'}</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:rotate-12" />
                          <span>{isFa ? 'ورود به سامانه HSECORE' : 'Sign In to HSECORE'}</span>
                          {isFa ? (
                            <ArrowLeft className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-1" />
                          ) : (
                            <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : forgotMode ? (
                /* ── 2. Password Recovery Form ── */
                <form onSubmit={handleForgotPasswordRequest} className="space-y-5 animate-fade-in">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-700 dark:text-slate-300 text-xs leading-relaxed text-start">
                    {isFa
                      ? 'نام کاربری ثبت‌شده خود را وارد کنید تا درخواست بازنشانی رمز عبور در کارتابل مدیر سیستم ثبت گردد.'
                      : 'Enter your registered username to log a password recovery request with the system administrator.'}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="recovery-username-input"
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block text-start"
                    >
                      {isFa ? 'نام کاربری' : 'Username'}
                    </label>
                    <div className="relative group">
                      <span
                        className={`absolute inset-y-0 flex items-center text-slate-400 group-focus-within:text-sky-600 transition-colors pointer-events-none ${
                          isFa ? 'right-0 pr-3.5' : 'left-0 pl-3.5'
                        }`}
                      >
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        id="recovery-username-input"
                        type="text"
                        required
                        placeholder={isFa ? 'مثال: admin' : 'e.g. admin'}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`login-input-field w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none placeholder:text-slate-400 ${
                          isFa ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <button
                      type="submit"
                      className="login-submit-btn flex-1 h-11 px-4 bg-gradient-to-l from-emerald-500 to-sky-600 text-white font-medium text-xs sm:text-sm rounded-xl shadow-md shadow-sky-600/20 cursor-pointer whitespace-nowrap"
                    >
                      {isFa ? 'ثبت درخواست بازنشانی' : 'Submit Recovery Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setForgotMode(false);
                      }}
                      className="h-11 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isFa ? 'بازگشت به صفحه ورود' : 'Back to Login'}
                    </button>
                  </div>
                </form>
              ) : (
                /* ── 3. Force Password Change Form ── */
                <form onSubmit={handleForcePasswordChangeSubmit} className="space-y-4 animate-fade-in">
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-xs leading-relaxed text-start">
                    {isFa
                      ? 'تعیین رمز عبور جدید الزامی است. لطفاً یک رمز عبور امن با حداقل ۶ کاراکتر انتخاب نمایید.'
                      : 'Setting a new password is required. Please choose a strong password with at least 6 characters.'}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="new-password-input"
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block text-start"
                    >
                      {isFa ? 'رمز عبور جدید' : 'New Password'}
                    </label>
                    <div className="relative">
                      <input
                        id="new-password-input"
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={isFa ? 'حداقل ۶ کاراکتر' : 'Minimum 6 characters'}
                        className={`login-input-field w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none placeholder:text-slate-400 ${
                          isFa ? 'pr-4 pl-10 text-right' : 'pl-4 pr-10 text-left'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className={`absolute inset-y-0 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer ${
                          isFa ? 'left-0 pl-3.5' : 'right-0 pr-3.5'
                        }`}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="confirm-password-input"
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block text-start"
                    >
                      {isFa ? 'تکرار رمز عبور جدید' : 'Confirm New Password'}
                    </label>
                    <input
                      id="confirm-password-input"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={isFa ? 'تکرار دقیق رمز عبور جدید' : 'Re-enter new password'}
                      className={`login-input-field w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 px-4 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none placeholder:text-slate-400 ${
                        isFa ? 'text-right' : 'text-left'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="login-submit-btn w-full h-11 sm:h-12 mt-2 bg-gradient-to-l from-emerald-500 to-sky-600 disabled:opacity-65 text-white font-medium text-sm rounded-xl shadow-md shadow-sky-600/20 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{isFa ? 'ذخیره رمز جدید و ادامه' : 'Save Password & Continue'}</span>
                  </button>
                </form>
              )}

              {/* Compact Mobile-Only HSE Pillars Summary */}
              <div className="sm:hidden pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center login-stagger-5">
                {hsePillars.map((pillar) => {
                  const IconComponent = pillar.icon;
                  return (
                    <div
                      key={pillar.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col items-center gap-1.5"
                    >
                      <IconComponent className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                        {pillar.id === 'health'
                          ? (isFa ? 'بهداشت شغلی' : 'Health')
                          : pillar.id === 'safety'
                            ? (isFa ? 'ایمنی صنعتی' : 'Safety')
                            : (isFa ? 'محیط زیست' : 'Environment')}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* ── Page Footer with Subtle Flanking Lines ── */}
      <footer className="relative z-20 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-center gap-4 text-center text-[11px] sm:text-xs text-white/85 leading-relaxed login-stagger-5">
        <span className="hidden sm:block h-px flex-1 bg-gradient-to-r from-transparent to-white/25" aria-hidden="true" />
        <span>
          {isFa
            ? 'کلیه حقوق مادی و معنوی سامانه متعلق به آقا مصطفی سیروس، کارشناس ارشد بهداشت، ایمنی و محیط زیست (HSE) می‌باشد.'
            : 'All rights reserved © Agha Mostafa Sirous, Senior Occupational Health, Safety & Environment (HSE) Expert.'}
        </span>
        <span className="hidden sm:block h-px flex-1 bg-gradient-to-l from-transparent to-white/25" aria-hidden="true" />
      </footer>
    </div>
  );
}
