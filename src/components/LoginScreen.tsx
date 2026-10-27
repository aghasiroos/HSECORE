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
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Flame,
  Leaf
} from 'lucide-react';
import { addAuditLog } from '../utils/authHelper';
import { apiDb } from '../services/apiDatabaseClient';
import { HseLogo } from './HseLogo';
import { HseCoreBrandText } from './common/HseCoreBrandText';
import { useSystemBranding, getLoginScreenBranding } from '../utils/systemBrandingHelper';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  language: 'en' | 'fa';
  setLanguage: (lang: 'en' | 'fa') => void;
  themeMode?: 'dark' | 'light';
  setThemeMode?: (mode: 'dark' | 'light') => void;
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
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      iconBg: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
      title: isFa ? 'بهداشت و سلامت شغلی (Health)' : 'Occupational Health & Hygiene',
      desc: isFa
        ? 'پایش ادواری سلامت پرسنل، پرونده پزشکی و ارزیابی عوامل زیان‌آور محیط کار'
        : 'Periodic medical checkups, health dossiers & workplace exposure tracking'
    },
    {
      id: 'safety',
      icon: Flame,
      iconBg: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
      title: isFa ? 'ایمنی صنعتی و ارزیابی ریسک (Safety)' : 'Industrial Safety & Risk Control',
      desc: isFa
        ? 'صدور و نظارت بر پروانه‌های کار (PTW)، ثبت حوادث و ممیزی‌های تخصصی ایمنی'
        : 'Work permits (PTW), incident reporting & comprehensive risk assessments'
    },
    {
      id: 'environment',
      icon: Leaf,
      iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
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
        isLight ? 'bg-[#f4f7fb] text-slate-900' : 'bg-[#090e1a] text-slate-100'
      }`}
    >
      {/* ── Subtle Architectural Background Canvas ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, ${isLight ? '#0f172a' : '#38bdf8'} 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
        <div className="absolute -top-40 -right-40 w-[32rem] h-[32rem] rounded-full bg-sky-500/10 dark:bg-sky-500/12 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-emerald-500/10 dark:bg-emerald-500/12 blur-[120px]" />
      </div>

      {/* ── Top Utility Bar: Text pinned to Top-Right corner, Icons pinned to Top-Left corner ── */}
      <header className="relative z-20 w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-2 flex items-center justify-between gap-3 sm:gap-4">
        {/* Right Corner: Organization Title Text */}
        <div className="flex items-center min-w-0 order-1 rtl:order-1 ltr:order-2">
          <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 truncate" title={isFa ? (branding.organizationNameFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)') : (branding.organizationNameEn || 'HSECORE — The Core of HSE Management')}>
            {isFa
              ? (branding.organizationNameFa || 'هسته مرکزی مدیریت ایمنی، بهداشت و محیط زیست (HSECORE)')
              : (branding.organizationNameEn || 'HSECORE — The Core of HSE Management')}
          </span>
        </div>

        {/* Left Corner: Action Icons (Theme toggle & Language switch) */}
        <div className="flex items-center gap-2 shrink-0 order-2 rtl:order-2 ltr:order-1">
          <button
            type="button"
            onClick={() => setLanguage(language === 'fa' ? 'en' : 'fa')}
            title={language === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
            aria-label={language === 'fa' ? 'Switch to English' : 'تغییر زبان به فارسی'}
            id="login-language-toggle-btn"
            className="h-8.5 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0"
          >
            <Languages className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>{isFa ? 'EN' : 'فارسی'}</span>
          </button>

          {setThemeMode && (
            <button
              type="button"
              onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
              title={isLight ? (isFa ? 'حالت تیره' : 'Dark Mode') : (isFa ? 'حالت روشن' : 'Light Mode')}
              aria-label={isLight ? (isFa ? 'حالت تیره' : 'Dark Mode') : (isFa ? 'حالت روشن' : 'Light Mode')}
              id="login-theme-toggle-btn"
              className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-sky-500/50 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer shadow-2xs flex items-center justify-center shrink-0"
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content Viewport ── */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800/90 shadow-xl shadow-slate-900/5 dark:shadow-black/40">
          
          {/* ══════════════ BRAND & IDENTITY PANEL (Right in RTL / Left in LTR) ══════════════ */}
          <div
            className={`lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-[#0c192c] via-[#0f1f36] to-[#0a1526] text-white border-b lg:border-b-0 ${
              isFa ? 'lg:border-l border-slate-800/80' : 'lg:border-r border-slate-800/80'
            }`}
          >
            {/* Subtle decorative radial lights inside dark brand panel */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              {/* Primary HSECORE Logo, Wordmark & Official Subtitle Below */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-start space-y-3.5">
                <div className="flex flex-col sm:flex-row lg:flex-row items-center gap-4">
                  {/* Official HSECORE Logo */}
                  <div className="relative p-1 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-300 shadow-lg shadow-emerald-950/50 shrink-0">
                    <div
                      className={`w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center overflow-hidden ${
                        isCustomLogin && removePadding ? 'p-0' : 'p-0.5'
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

                  {/* Brand Wordmark */}
                  {loginBranding.showHseCoreTitle !== false && (
                    <div className="min-w-0 flex flex-col items-center sm:items-start">
                      <h1 className="leading-none select-none" dir="ltr">
                        <HseCoreBrandText size="xl" themeAdapt={false} />
                      </h1>
                    </div>
                  )}
                </div>

                {/* Mandatory Subtitle Directly Underneath Logo / HSECORE Name */}
                <div className="w-full pt-1">
                  <p className="text-sm sm:text-base font-medium text-emerald-300 tracking-normal leading-snug">
                    {primarySubtitle}
                  </p>
                  <p className="text-xs text-slate-300/85 font-light leading-relaxed mt-2 hidden sm:block">
                    {isFa
                      ? 'پلتفرم یکپارچه سازمانی جهت مدیریت هوشمند ایمنی صنعتی، پایش سلامت شغلی و استانداردهای زیست‌محیطی'
                      : 'Enterprise platform for industrial safety management, occupational health monitoring, and environmental compliance.'}
                  </p>
                </div>
              </div>

              {/* Three HSE Operational Pillars (Visible on desktop & tablet, compact on mobile) */}
              <div className="hidden sm:flex flex-col gap-2.5 pt-2 border-t border-white/10">
                {hsePillars.map((pillar) => {
                  const IconComponent = pillar.icon;
                  return (
                    <div
                      key={pillar.id}
                      className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${pillar.iconBg}`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xs font-medium text-white leading-snug">
                          {pillar.title}
                        </h2>
                        <p className="text-[11px] text-slate-300/80 font-light leading-relaxed mt-0.5">
                          {pillar.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Compliance & Security Footer inside Brand Panel */}
            <div className="relative z-10 pt-5 mt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300/90">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isFa ? 'احراز هویت امن سازمانی' : 'Secure Enterprise Auth'}</span>
              </span>
              <span className="text-slate-400 font-mono text-[11px]" dir="ltr">
                ISO 45001 · ISO 14001
              </span>
            </div>
          </div>

          {/* ══════════════ AUTHENTICATION FORM PANEL (Left in RTL / Right in LTR) ══════════════ */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white dark:bg-[#111827]">
            <div className="max-w-md w-full mx-auto space-y-6">
              
              {/* Section Heading */}
              <div className="space-y-1.5 text-start">
                <h2 className="text-xl sm:text-2xl font-medium text-slate-900 dark:text-white tracking-tight">
                  {forgotMode
                    ? (isFa ? 'بازیابی رمز عبور' : 'Password Recovery')
                    : forceChangeMode
                      ? (isFa ? 'تغییر اجباری رمز عبور' : 'Update Your Password')
                      : (isFa ? 'ورود به حساب کاربری' : 'Sign In to Your Account')}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">
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
                  className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-2xl text-xs font-medium flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div
                  role="status"
                  className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-sky-800 dark:text-sky-300 rounded-2xl text-xs font-medium flex items-start gap-2.5"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                  <span className="leading-relaxed">{infoMsg}</span>
                </div>
              )}

              {/* ── 1. Standard Sign-In Form ── */}
              {!forgotMode && !forceChangeMode ? (
                <form onSubmit={handleLogin} className="space-y-5" noValidate>
                  {/* Username Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="login-username-input"
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block"
                    >
                      {isFa ? 'نام کاربری' : 'Username'}
                    </label>
                    <div className="relative">
                      <span
                        className={`absolute inset-y-0 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none ${
                          isFa ? 'right-0 pr-3.5' : 'left-0 pl-3.5'
                        }`}
                      >
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        id="login-username-input"
                        type="text"
                        required
                        autoComplete="username"
                        placeholder={isFa ? 'نام کاربری خود را وارد کنید (مثلاً: admin)' : 'Enter your username (e.g. admin)'}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none focus:border-sky-600 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
                          isFa ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="login-password-input"
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block"
                    >
                      {isFa ? 'رمز عبور' : 'Password'}
                    </label>
                    <div className="relative">
                      <span
                        className={`absolute inset-y-0 flex items-center text-slate-400 dark:text-slate-500 pointer-events-none ${
                          isFa ? 'right-0 pr-3.5' : 'left-0 pl-3.5'
                        }`}
                      >
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        id="login-password-input"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder={isFa ? 'رمز عبور خود را وارد کنید' : 'Enter your password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none focus:border-sky-600 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
                          isFa ? 'pr-10 pl-10 text-right' : 'pl-10 pr-10 text-left'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? (isFa ? 'مخفی‌سازی رمز عبور' : 'Hide password') : (isFa ? 'نمایش رمز عبور' : 'Show password')}
                        aria-label={showPassword ? (isFa ? 'مخفی‌سازی رمز عبور' : 'Hide password') : (isFa ? 'نمایش رمز عبور' : 'Show password')}
                        className={`absolute inset-y-0 flex items-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer ${
                          isFa ? 'left-0 pl-3.5' : 'right-0 pr-3.5'
                        }`}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password Row */}
                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                    <label className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
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

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 sm:h-12 px-5 bg-gradient-to-r from-sky-600 via-sky-600 to-emerald-600 hover:from-sky-700 hover:via-sky-700 hover:to-emerald-700 disabled:opacity-65 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-all duration-150 active:scale-[0.99] shadow-md shadow-sky-600/20 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>{isFa ? 'در حال احراز هویت و ورود...' : 'Signing in...'}</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4 shrink-0" />
                        <span>{isFa ? 'ورود به سامانه HSECORE' : 'Sign In to HSECORE'}</span>
                        {isFa ? (
                          <ArrowLeft className="w-4 h-4 shrink-0" />
                        ) : (
                          <ArrowRight className="w-4 h-4 shrink-0" />
                        )}
                      </>
                    )}
                  </button>
                </form>
              ) : forgotMode ? (
                /* ── 2. Password Recovery Form ── */
                <form onSubmit={handleForgotPasswordRequest} className="space-y-5">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                    {isFa
                      ? 'نام کاربری ثبت‌شده خود را وارد کنید تا درخواست بازنشانی رمز عبور در کارتابل مدیر سیستم ثبت گردد.'
                      : 'Enter your registered username to log a password recovery request with the system administrator.'}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="recovery-username-input"
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block"
                    >
                      {isFa ? 'نام کاربری' : 'Username'}
                    </label>
                    <div className="relative">
                      <span
                        className={`absolute inset-y-0 flex items-center text-slate-400 pointer-events-none ${
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
                        className={`w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none focus:border-sky-600 transition-all placeholder:text-slate-400 ${
                          isFa ? 'pr-10 pl-4 text-right' : 'pl-10 pr-4 text-left'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <button
                      type="submit"
                      className="flex-1 h-11 px-4 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-700 hover:to-emerald-700 text-white font-medium text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-sky-600/20 cursor-pointer whitespace-nowrap"
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
                <form onSubmit={handleForcePasswordChangeSubmit} className="space-y-4">
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
                    {isFa
                      ? 'تعیین رمز عبور جدید الزامی است. لطفاً یک رمز عبور امن با حداقل ۶ کاراکتر انتخاب نمایید.'
                      : 'Setting a new password is required. Please choose a strong password with at least 6 characters.'}
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="new-password-input"
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block"
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
                        className={`w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none focus:border-sky-600 transition-all placeholder:text-slate-400 ${
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
                      className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 block"
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
                      className={`w-full h-11 sm:h-12 bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 px-4 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-normal focus:outline-none focus:border-sky-600 transition-all placeholder:text-slate-400 ${
                        isFa ? 'text-right' : 'text-left'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 sm:h-12 mt-2 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-700 hover:to-emerald-700 disabled:opacity-65 text-white font-medium text-sm rounded-xl transition-all shadow-md shadow-sky-600/20 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>{isFa ? 'ذخیره رمز جدید و ادامه' : 'Save Password & Continue'}</span>
                  </button>
                </form>
              )}

              {/* Compact Mobile-Only HSE Pillars Summary */}
              <div className="sm:hidden pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-2 text-center">
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

      {/* ── Page Footer ── */}
      <footer className="relative z-20 w-full px-4 sm:px-6 lg:px-8 py-3 text-center text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        {isFa
          ? 'کلیه حقوق مادی و معنوی سامانه متعلق به آقا مصطفی سیروس، کارشناس ارشد بهداشت، ایمنی و محیط زیست (HSE) می‌باشد.'
          : 'All rights reserved © Agha Mostafa Sirous, Senior Occupational Health, Safety & Environment (HSE) Expert.'}
      </footer>
    </div>
  );
}
