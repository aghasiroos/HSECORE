import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Lock,
  Key,
  Save,
  Camera,
  Clock,
  Building,
  CheckCircle,
  Timer,
  ShieldCheck,
  ShieldAlert,
  Infinity as InfinityIcon,
  Loader2,
  X
} from 'lucide-react';
import { UserProfile, Department } from '../types';
import { addAuditLog, setCurrentUser } from '../utils/authHelper';
import { syncAndGetExtractedDepartments } from '../utils/personnelHelper';
import { centralSync } from '../services/centralSyncService';
import { apiDb } from '../services/apiDatabaseClient';
import moment from 'moment-jalaali';

interface UserProfilePageProps {
  currentUser: UserProfile;
  language: 'en' | 'fa';
  onProfileUpdated: (updatedUser: UserProfile) => void;
}

export default function UserProfilePage({ currentUser, language, onProfileUpdated }: UserProfilePageProps) {
  const isFa = language === 'fa';

  // Fields
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phoneNumber || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [emergencyContact, setEmergencyContact] = useState(currentUser?.emergencyContact || '');
  const [avatarIndex, setAvatarIndex] = useState(parseInt(String(currentUser?.id || '0').replace(/\D/g, '')) % 5 || 0);

  // Password Change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; success: boolean } | null>(null);

  // Session Timeout (in minutes) & Always Active opt-in (strictly per-user, default false)
  const alwaysActiveAllowed = currentUser?.sessionPolicy?.alwaysActiveAllowed !== false;
  const maxAllowedMinutes =
    typeof currentUser?.sessionPolicy?.maxSessionTimeoutMinutes === 'number' &&
    currentUser.sessionPolicy.maxSessionTimeoutMinutes > 0
      ? Math.min(480, currentUser.sessionPolicy.maxSessionTimeoutMinutes)
      : 480;

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    currentUser?.sessionTimeoutMinutes || 5
  );
  const [sessionAlwaysActive, setSessionAlwaysActive] = useState<boolean>(
    Boolean(currentUser?.sessionAlwaysActive) && alwaysActiveAllowed
  );
  const [isSavingTimeout, setIsSavingTimeout] = useState(false);
  const [isTimeoutSaved, setIsTimeoutSaved] = useState(false);
  const [savedTimeoutSnapshot, setSavedTimeoutSnapshot] = useState<{
    alwaysActive: boolean;
    minutes: number;
  } | null>(null);
  const [timeoutError, setTimeoutError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSavedAlert, setIsSavedAlert] = useState(false);

  // Sync local form state whenever authoritative user profile updates (e.g. login, refresh, cross-device sync)
  useEffect(() => {
    if (typeof currentUser?.sessionTimeoutMinutes === 'number' && currentUser.sessionTimeoutMinutes > 0) {
      setSessionTimeoutMinutes(currentUser.sessionTimeoutMinutes);
    }
    setSessionAlwaysActive(
      Boolean(currentUser?.sessionAlwaysActive) && currentUser?.sessionPolicy?.alwaysActiveAllowed !== false
    );
  }, [
    currentUser?.id,
    currentUser?.sessionTimeoutMinutes,
    currentUser?.sessionAlwaysActive,
    currentUser?.sessionPolicy?.alwaysActiveAllowed,
  ]);

  useEffect(() => {
    const loadDepts = () => {
      setDepartments(syncAndGetExtractedDepartments());
    };
    loadDepts();
    window.addEventListener('hse_departments_updated', loadDepts);
    window.addEventListener('storage', loadDepts);
    return () => {
      window.removeEventListener('hse_departments_updated', loadDepts);
      window.removeEventListener('storage', loadDepts);
    };
  }, []);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const freshUser: UserProfile = {
      ...currentUser,
      phoneNumber: phoneNumber.trim(),
      email: email.trim(),
      emergencyContact: emergencyContact.trim(),
      sessionTimeoutMinutes: sessionTimeoutMinutes,
      sessionAlwaysActive: alwaysActiveAllowed ? sessionAlwaysActive : false,
      updatedDate: moment().format('jYYYY/jMM/jDD')
    };

    onProfileUpdated(freshUser);
    setCurrentUser(freshUser);
    try {
      await apiDb.saveUser(freshUser);
    } catch (err) {
      console.error('Failed to update user profile in database:', err);
    }
    addAuditLog(currentUser.username, 'بروزرسانی مشخصات تماس توسط خود کاربر', 'موفقیت‌آمیز');

    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3000);
  };

  const handleUpdateSessionTimeout = async (e: React.FormEvent) => {
    e.preventDefault();
    setTimeoutError(null);
    setIsTimeoutSaved(false);

    const effectiveAlwaysActive = alwaysActiveAllowed ? Boolean(sessionAlwaysActive) : false;
    const timeoutVal = Math.max(1, Math.min(maxAllowedMinutes, Number(sessionTimeoutMinutes) || 5));
    setSessionTimeoutMinutes(timeoutVal);

    setIsSavingTimeout(true);
    try {
      const result = await apiDb.updateMySessionTimeout({
        sessionAlwaysActive: effectiveAlwaysActive,
        sessionTimeoutMinutes: timeoutVal,
      });

      if (!result.success || !result.data) {
        setTimeoutError(
          result.error ||
            (isFa
              ? 'ذخیره تنظیمات در پایگاه داده با خطا مواجه شد.'
              : 'Failed to save session timeout settings.')
        );
        return;
      }

      const savedMinutes = result.data.sessionTimeoutMinutes;
      const savedAlwaysActive = Boolean(result.data.sessionAlwaysActive);
      const savedPolicy = result.data.sessionPolicy || currentUser.sessionPolicy;

      setSessionTimeoutMinutes(savedMinutes);
      setSessionAlwaysActive(savedAlwaysActive);

      const freshUser: UserProfile = {
        ...currentUser,
        sessionTimeoutMinutes: savedMinutes,
        sessionAlwaysActive: savedAlwaysActive,
        sessionPolicy: savedPolicy,
        updatedDate: result.data.updatedDate || moment().format('jYYYY/jMM/jDD'),
      };

      onProfileUpdated(freshUser);
      setCurrentUser(freshUser);

      addAuditLog(
        currentUser.username,
        savedAlwaysActive
          ? 'فعال‌سازی وضعیت «همیشه فعال» برای خروج خودکار عدم فعالیت نشست'
          : `تنظیم مقدار خروج خودکار به دلیل عدم فعالیت به ${savedMinutes} دقیقه`,
        'موفقیت‌آمیز'
      );

      setSavedTimeoutSnapshot({ alwaysActive: savedAlwaysActive, minutes: savedMinutes });
      setIsTimeoutSaved(true);
      setTimeout(() => setIsTimeoutSaved(false), 4000);
    } catch (err: any) {
      setTimeoutError(
        err?.message ||
          (isFa
            ? 'خطا در ارتباط با سرور هنگام ذخیره تنظیمات نشست.'
            : 'Server communication error while saving session settings.')
      );
    } finally {
      setIsSavingTimeout(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Photo = reader.result as string;
        const freshUser: UserProfile = {
          ...currentUser,
          profilePhoto: base64Photo,
          updatedDate: moment().format('jYYYY/jMM/jDD')
        };

        onProfileUpdated(freshUser);
        setCurrentUser(freshUser);
        try {
          await apiDb.saveUser(freshUser);
        } catch (err) {
          console.error('Failed to update profile photo in database:', err);
        }
        addAuditLog(currentUser.username, 'به‌روزرسانی تصویر پروفایل کاربری', 'موفقیت‌آمیز');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({
        text: isFa ? 'لطفاً تمام فیلدهای رمز عبور را پر کنید.' : 'Please fill all password fields.',
        success: false
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordMessage({
        text: isFa ? 'رمز عبور جدید نمی‌تواند مشابه رمز عبور فعلی باشد!' : 'New password cannot be the same as current password.',
        success: false
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({
        text: isFa ? 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.' : 'New password must be at least 8 characters long.',
        success: false
      });
      return;
    }

    // complexity check (contains letter and number)
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      setPasswordMessage({
        text: isFa ? 'رمز عبور جدید باید حاوی حروف و اعداد باشد.' : 'New password must contain both letters and numbers.',
        success: false
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        text: isFa ? 'تکرار رمز عبور جدید با رمز عبور مطابقت ندارد.' : 'New passwords do not match.',
        success: false
      });
      return;
    }

    // Server-side password update with Bcrypt and database
    try {
      const res = await apiDb.changePassword(currentPassword, newPassword);
      if (!res.success) {
        setPasswordMessage({
          text: res.error || (isFa ? 'رمز عبور فعلی نادرست است یا خطایی رخ داد.' : 'Failed to change password.'),
          success: false
        });
        return;
      }

      addAuditLog(currentUser.username, 'تغییر رمز عبور شخصی از طریق سرور', 'تغییر رمز عبور');

      setPasswordMessage({
        text: isFa ? 'رمز عبور شما با موفقیت در پایگاه داده سرور تغییر یافت.' : 'Password updated successfully on server.',
        success: true
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMessage({
        text: isFa ? 'خطا در برقراری ارتباط با سرور.' : 'Server connection error.',
        success: false
      });
    }
  };

  // Avatar choices
  const avatarColors = [
    'bg-amber-500/20 text-amber-500 border-blue-500/40',
    'bg-emerald-500/20 text-emerald-500 border-emerald-500/40',
    'bg-sky-500/20 text-sky-500 border-sky-500/40',
    'bg-violet-500/20 text-violet-500 border-violet-500/40',
    'bg-rose-500/20 text-rose-500 border-rose-500/40'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="personal-profile-page">
      
      {/* Column 1: Formal Dossier & Badging */}
      <div className="lg:col-span-1 bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 flex flex-col justify-between shadow-md relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/5 rounded-full blur-3xl"></div>
        
        <div className="space-y-6 relative">
          <div className="text-center space-y-3">
            <div className="relative inline-block mx-auto group/avatar">
              <div className={`w-20 h-20 rounded-2xl ${avatarColors[avatarIndex]} border flex items-center justify-center font-black text-3xl mx-auto select-none transition-all overflow-hidden`}>
                {currentUser.profilePhoto ? (
                  <img src={currentUser.profilePhoto} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUser.fullName.charAt(0)
                )}
              </div>
              <label 
                className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-slate-800 text-amber-400 hover:text-amber-300 rounded-lg border border-slate-700 hover:scale-105 transition cursor-pointer"
                title={isFa ? "تغییر تصویر پروفایل" : "Change profile picture"}
              >
                <Camera className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
              {currentUser.profilePhoto && (
                <button
                  type="button"
                  onClick={async () => {
                    const freshUser: UserProfile = { ...currentUser, profilePhoto: '' };
                    onProfileUpdated(freshUser);
                    setCurrentUser(freshUser);
                    try {
                      await apiDb.saveUser(freshUser);
                    } catch (e) {
                      console.error('Failed to clear profile photo in database:', e);
                    }
                  }}
                  className="absolute -top-1.5 -left-1.5 p-1 bg-red-500 text-white hover:bg-red-600 rounded-lg shadow opacity-0 group-hover/avatar:opacity-100 transition cursor-pointer"
                  title={isFa ? "حذف تصویر" : "Remove photo"}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div>
              <h3 className="font-extrabold text-base">{currentUser.fullName}</h3>
              <p className="text-xs text-amber-500 font-bold mt-0.5">@{currentUser.username}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-800/80 pt-5 text-xs font-bold text-slate-300">
            <h4 className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-3">
              {isFa ? 'شناسنامه رسمی پرسنل مجتمع' : 'Formal Employee dossier'}
            </h4>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                {isFa ? 'سمت سازمانی:' : 'Job Position:'}
              </span>
              <span>{currentUser.jobTitle}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                {isFa ? 'دپارتمان تابعه:' : 'Department:'}
              </span>
              <span className="truncate max-w-[150px] text-right">
                {departments.filter(d => currentUser.departmentIds?.includes(d.id)).map(d => (d.name ? d.name.split(' (')[0] : '')).filter(Boolean).join('، ') || '—'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                {isFa ? 'کد پرسنلی:' : 'Personnel ID:'}
              </span>
              <span className="font-mono text-amber-400">{currentUser.personnelNumber || '—'}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                {isFa ? 'کد ملی:' : 'National ID:'}
              </span>
              <span className="font-mono">{currentUser.nationalId || '—'}</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                {isFa ? 'نوع استخدام / شیفت:' : 'Contract / Shift:'}
              </span>
              <span>
                {currentUser.employmentStatus ? currentUser.employmentStatus.split(' (')[0] : (isFa ? 'رسمی' : 'Full-Time')}
                {' - '}
                {currentUser.workShift ? currentUser.workShift.split(' (')[0] : (isFa ? 'اداری ثابت' : 'Day Shift')}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                {isFa ? 'سرپرست مستقیم:' : 'Direct Supervisor:'}
              </span>
              <span>{currentUser.supervisor || 'مدیریت ارشد'}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-4 mt-6 text-[10px] text-slate-500 font-bold space-y-1.5">
          <div className="flex justify-between">
            <span>{isFa ? 'تاریخ ثبت‌نام:' : 'Registered Date:'}</span>
            <span className="font-mono">{currentUser.createdDate || '1404/01/15'}</span>
          </div>
          <div className="flex justify-between">
            <span>{isFa ? 'آخرین ممیزی حساب:' : 'Last Modified:'}</span>
            <span className="font-mono">{currentUser.updatedDate || '—'}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span>{isFa ? 'سطح دسترسی سیستم:' : 'System Access:'}</span>
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-md font-black border border-blue-500/20">{currentUser.role}</span>
          </div>
        </div>

      </div>

      {/* Column 2: Editable contacts */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-amber-500" />
            {isFa ? 'اطلاعات تماس و بستگان اضطراری' : 'Contact Directory Settings'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isFa ? 'این فیلدها مستقیماً توسط خود پرسنل جهت بروزرسانی پرونده کادر پزشکی قابل تغییر است.' : 'These contact parameters are self-managed for emergency response logs.'}
          </p>
        </div>

        <form onSubmit={handleUpdateContact} className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block">{isFa ? 'شماره تلفن همراه فعال:' : 'Phone Number:'}</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                <Phone className="w-4 h-4 text-slate-400" />
              </span>
              <input 
                type="text" 
                required 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 font-mono text-left focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block">{isFa ? 'نشانی ایمیل مکاتبات رسمی:' : 'Email Address:'}</label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400">
                <Mail className="w-4 h-4 text-slate-400" />
              </span>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl pr-9 pl-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 font-mono text-left focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block">{isFa ? 'مخاطب اضطراری (نام بستگان + تلفن):' : 'Emergency Contact:'}</label>
            <textarea 
              rows={3}
              value={emergencyContact} 
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder={isFa ? "همسر: مهناز حسینی - ۰۹۱۲۳۴۵۶۷۸۹" : "Wife: Mahnaz Hosseini - 0912..."}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed"
            />
          </div>

          {isSavedAlert && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-100 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{isFa ? 'مشخصات تماس شما با موفقیت ذخیره و در دیتابیس همگام شد.' : 'Contacts updated successfully.'}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isFa ? 'ذخیره فیلدهای تماس' : 'Save Contact Profile'}</span>
          </button>
        </form>

      </div>

      {/* Column 3: Change Password */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
            <Key className="w-4 h-4 text-amber-500" />
            {isFa ? 'تغییر رمز عبور حساب کاربری' : 'Security Password Update'}
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isFa ? 'رمز عبور خود را مکرراً هر ۹۰ روز تغییر دهید. رمز جدید باید ترکیبی از حروف و اعداد انگلیسی باشد.' : 'Update your credentials. We recommend complex values with at least 1 number.'}
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
          
          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block">{isFa ? 'رمز عبور فعلی:' : 'Current Password:'}</label>
            <input 
              type="password" 
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-left"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block">{isFa ? 'رمز عبور جدید:' : 'New Password:'}</label>
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-left"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-600 dark:text-slate-400 font-bold block">{isFa ? 'تکرار رمز عبور جدید:' : 'Confirm New Password:'}</label>
            <input 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold font-mono text-left"
            />
          </div>

          {passwordMessage && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${passwordMessage.success ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-red-50 text-red-800 border-red-100'}`}>
              {passwordMessage.text}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>{isFa ? 'بروزرسانی کلمه عبور ایمن' : 'Confirm Security Update'}</span>
          </button>
        </form>

      </div>

      {/* Column 4 (Full Width): Session Inactivity Timeout Configuration */}
      <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5" id="session-timeout-settings-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-3 rounded-2xl border ${
              sessionAlwaysActive && alwaysActiveAllowed
                ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-blue-500/20'
            }`}>
              {sessionAlwaysActive && alwaysActiveAllowed ? (
                <InfinityIcon className="w-5 h-5" />
              ) : (
                <Timer className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base flex flex-wrap items-center gap-2">
                <span>{isFa ? 'خروج خودکار به دلیل عدم فعالیت (Session Timeout)' : 'Automatic Session Timeout (Inactivity Logout)'}</span>
                {sessionAlwaysActive && alwaysActiveAllowed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50">
                    <InfinityIcon className="w-3.5 h-3.5" />
                    <span>{isFa ? 'همیشه فعال' : 'Always Active'}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-blue-200 dark:border-blue-700/50">
                    {sessionTimeoutMinutes} {isFa ? 'دقیقه' : 'min'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {sessionAlwaysActive && alwaysActiveAllowed
                  ? (isFa
                      ? 'وضعیت «همیشه فعال» برای حساب کاربری شما انتخاب شده است؛ خروج خودکار ناشی از عدم فعالیت غیرفعال بوده اما محدودیت‌های امنیتی نشست، انقضای توکن، خروج دستی و سیاست‌های اجباری مدیر سیستم همچنان برقرار هستند.'
                      : 'Always Active mode is selected for your account. Inactivity auto-logout is disabled, while token expiration, manual logout, and mandatory administrator security policies remain active.')
                  : (isFa
                      ? 'تنظیم مدت زمان مجاز عدم فعالیت کاربر در سامانه به دقیقه؛ در صورت عدم ارسال هیچ رویدادی (حرکت ماوس، کلیک یا صفحه‌کلید) در این بازه، نشست کاربری جهت ارتقای امنیت اطلاعات به‌طور خودکار بسته می‌شود.'
                      : 'Configure the inactivity logout window in minutes. If no user activity (mouse, click, keypress) is detected during this period, the system logs out safely.')}
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-xl border text-xs font-bold shrink-0 ${
            !alwaysActiveAllowed
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
              : sessionAlwaysActive
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300'
          }`}>
            {!alwaysActiveAllowed ? (
              <>
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span>{isFa ? 'سیاست امنیتی اجباری مدیر' : 'Admin Policy Active'}</span>
              </>
            ) : sessionAlwaysActive ? (
              <>
                <InfinityIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{isFa ? 'همیشه فعال (اختصاصی شما)' : 'Always Active (Personal)'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{isFa ? 'امنیت دسترسی فعال' : 'Security Active'}</span>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleUpdateSessionTimeout} className="space-y-4">
          {/* Always Active Personal Option */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition ${
            !alwaysActiveAllowed
              ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
              : sessionAlwaysActive
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
                : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/70'
          }`}>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {isFa ? 'همیشه فعال' : 'Always Active'}
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  sessionAlwaysActive && alwaysActiveAllowed
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300/70 dark:border-emerald-700/60'
                    : 'bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                }`}>
                  {sessionAlwaysActive && alwaysActiveAllowed
                    ? (isFa ? 'فعال' : 'Enabled')
                    : (isFa ? 'غیرفعال' : 'Disabled')}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {!alwaysActiveAllowed
                  ? (isFa
                      ? 'بر اساس سیاست امنیتی اجباری مدیر سیستم، فعال‌سازی گزینه «همیشه فعال» غیرمجاز است و خروج خودکار عدم فعالیت اعمال می‌شود.'
                      : 'Disabled by mandatory administrator security policy. Automatic inactivity timeout is enforced.')
                  : (isFa
                      ? 'در صورت فعال‌سازی، خروج خودکار ناشی از عدم فعالیت صرفاً برای حساب کاربری شما غیرفعال می‌شود و در تمامی دستگاه‌ها و مرورگرها اعمال می‌گردد. انقضای توکن، خروج دستی و سیاست‌های امنیتی سامانه همچنان معتبر هستند.'
                      : 'When enabled, inactivity auto-logout is disabled for your account only across all your devices. Token expiry, manual logout, and mandatory security policies remain enforced.')}
              </p>
            </div>

            <button
              type="button"
              dir="ltr"
              role="switch"
              aria-checked={sessionAlwaysActive && alwaysActiveAllowed}
              aria-label={isFa ? 'همیشه فعال' : 'Always Active'}
              disabled={!alwaysActiveAllowed || isSavingTimeout}
              onClick={() => {
                if (!alwaysActiveAllowed) return;
                setTimeoutError(null);
                setSessionAlwaysActive((prev) => !prev);
              }}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 self-end sm:self-center ${
                !alwaysActiveAllowed
                  ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                  : sessionAlwaysActive
                    ? 'bg-emerald-500 cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-600 cursor-pointer'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  sessionAlwaysActive && alwaysActiveAllowed
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
            
            {/* Quick Preset Buttons */}
            <div className={`md:col-span-7 space-y-2 transition-opacity ${
              sessionAlwaysActive && alwaysActiveAllowed ? 'opacity-50' : 'opacity-100'
            }`}>
              <label className="text-xs text-slate-600 dark:text-slate-300 font-bold block">
                {isFa ? 'انتخاب سریع مقادیر استاندارد (دقیقه):' : 'Quick Standard Presets (Minutes):'}
              </label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 30, 60, 120]
                  .filter((preset) => preset <= maxAllowedMinutes)
                  .map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={sessionAlwaysActive && alwaysActiveAllowed}
                    onClick={() => setSessionTimeoutMinutes(preset)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
                      sessionAlwaysActive && alwaysActiveAllowed
                        ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                        : sessionTimeoutMinutes === preset
                          ? 'bg-amber-500 text-slate-950 border-blue-500 shadow-xs cursor-pointer'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 cursor-pointer'
                    }`}
                  >
                    {preset} {isFa ? 'دقیقه' : 'min'}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input + Save Button */}
            <div className="md:col-span-5 space-y-2">
              <label className={`text-xs text-slate-600 dark:text-slate-300 font-bold block transition-opacity ${
                sessionAlwaysActive && alwaysActiveAllowed ? 'opacity-50' : 'opacity-100'
              }`}>
                {isFa
                  ? `مقدار دلخواه زمان خروج خودکار (۱ الی ${maxAllowedMinutes} دقیقه):`
                  : `Custom Timeout Value (1 - ${maxAllowedMinutes} mins):`}
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className={`relative flex-1 transition-opacity ${
                  sessionAlwaysActive && alwaysActiveAllowed ? 'opacity-50' : 'opacity-100'
                }`}>
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400">
                    <Clock className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="number"
                    min="1"
                    max={maxAllowedMinutes}
                    required={!sessionAlwaysActive}
                    disabled={sessionAlwaysActive && alwaysActiveAllowed}
                    value={sessionTimeoutMinutes}
                    onChange={(e) =>
                      setSessionTimeoutMinutes(
                        Math.max(1, Math.min(maxAllowedMinutes, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl pr-10 pl-14 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-left focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed"
                  />
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-slate-400 pointer-events-none">
                    {isFa ? 'دقیقه' : 'mins'}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingTimeout}
                  className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-950 font-black text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                >
                  {isSavingTimeout ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isFa ? 'ذخیره تنظیمات' : 'Save Settings'}</span>
                </button>
              </div>
            </div>

          </div>

          {timeoutError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-800/60 flex items-center gap-2.5 animate-fadeIn">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{timeoutError}</span>
            </div>
          )}

          {isTimeoutSaved && savedTimeoutSnapshot && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {savedTimeoutSnapshot.alwaysActive
                  ? (isFa
                      ? 'تنظیمات با موفقیت در پایگاه داده ذخیره شد. حالت «همیشه فعال» برای حساب کاربری شما اعمال گردید.'
                      : 'Settings saved to database. Always Active mode is now enabled for your account.')
                  : (isFa
                      ? `تنظیمات با موفقیت در پایگاه داده ذخیره شد. خروج خودکار سیستم بر روی ${savedTimeoutSnapshot.minutes} دقیقه عدم فعالیت اعمال گردید.`
                      : `Session timeout updated successfully to ${savedTimeoutSnapshot.minutes} minutes of inactivity.`)}
              </span>
            </div>
          )}
        </form>
      </div>

    </div>
  );
}
