import React, { useState, useMemo } from 'react';
import moment from 'moment-jalaali';
import { 
  Search, 
  UserPlus, 
  Unlock, 
  ShieldAlert, 
  Edit2, 
  Trash2, 
  Users, 
  ShieldCheck, 
  Lock, 
  Key, 
  Download, 
  LayoutGrid, 
  Table as TableIcon, 
  UserX, 
  Phone, 
  Mail, 
  Briefcase, 
  Building, 
  Shield, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink,
  Activity,
  HeartPulse,
  Flame,
  HardHat,
  GraduationCap,
  FileWarning,
  GitBranch,
  X,
  FileCheck,
  CheckCircle,
  Award,
  Calendar,
  Timer,
  Hourglass,
  AlertTriangle,
  PenTool
} from 'lucide-react';
import { UserProfile, Department, UserRole, UserStatus } from '../../types';
import { getPersonnelSignature, evaluatePtwQualificationStatus } from '../../utils/personnelHelper';
import { downloadCsvFile } from '../../utils/fileHelpers';

interface SitePersonnelTabProps {
  users: UserProfile[];
  departments: Department[];
  currentUser: UserProfile;
  isFa: boolean;
  onOpenCreateUser: () => void;
  onOpenEditUser: (user: UserProfile) => void;
  onDeleteUser: (id: string, name: string) => void;
  onResetAttempts: (user: UserProfile) => void;
  onSelectUserForPermissions: (user: UserProfile) => void;
  onOpenManagePersonnelAssignments?: (user: UserProfile) => void;
}

export const SitePersonnelTab: React.FC<SitePersonnelTabProps> = ({
  users,
  departments,
  currentUser,
  isFa,
  onOpenCreateUser,
  onOpenEditUser,
  onDeleteUser,
  onResetAttempts,
  onSelectUserForPermissions,
  onOpenManagePersonnelAssignments
}) => {
  // Search & Filter State
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'permanent' | 'active_expiring' | 'expiring_soon' | 'expired'>('ALL');
  const [hseCategoryFilter, setHseCategoryFilter] = useState<'ALL' | 'admin' | 'safety' | 'fire' | 'health' | 'process' | 'contractor'>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  // Quick View Personnel Profile Modal/Drawer
  const [profileModalUser, setProfileModalUser] = useState<UserProfile | null>(null);

  // Helper to parse and calculate access expiration
  const getAccessExpiryInfo = (user: UserProfile) => {
    const exp = user.accessExpiresAt || (user as any).profileData?.accessExpiresAt;
    const dur = user.accessDurationType || (user as any).profileData?.accessDurationType;

    if (!exp || dur === 'permanent' || exp === 'دائمی' || exp === 'نامحدود') {
      return {
        type: 'permanent' as const,
        label: isFa ? 'دسترسی دائم' : 'Permanent',
        rawDate: exp || (isFa ? 'دائمی' : 'Permanent'),
        color: 'emerald' as const,
        isExpired: false,
        daysLeft: null
      };
    }

    // Clean Persian digits
    const clean = String(exp).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]).trim();
    let expMoment = null;
    const jMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (jMatch && parseInt(jMatch[1], 10) >= 1300 && parseInt(jMatch[1], 10) <= 1600) {
      expMoment = moment(clean, ['jYYYY/jMM/jDD', 'jYYYY-jMM-jDD', 'jYYYY/jM/jD', 'jYYYY-jM-jD']);
    } else {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        expMoment = moment(d);
      }
    }

    if (!expMoment || !expMoment.isValid()) {
      return {
        type: 'custom' as const,
        label: exp,
        rawDate: exp,
        color: 'slate' as const,
        isExpired: false,
        daysLeft: null
      };
    }

    const now = moment();
    const isPast = expMoment.clone().endOf('day').isBefore(now);
    const daysLeft = expMoment.clone().endOf('day').diff(now, 'days');

    if (isPast || user.accountStatus === 'Expired') {
      return {
        type: 'expired' as const,
        label: isFa ? `منقضی شده (${exp})` : `Expired (${exp})`,
        rawDate: exp,
        color: 'rose' as const,
        isExpired: true,
        daysLeft
      };
    } else if (daysLeft <= 7) {
      return {
        type: 'expiring_soon' as const,
        label: isFa ? `${daysLeft === 0 ? 'امروز' : `${daysLeft} روز مانده`} (${exp})` : `${daysLeft}d left (${exp})`,
        rawDate: exp,
        color: 'amber' as const,
        isExpired: false,
        daysLeft
      };
    } else {
      return {
        type: 'valid' as const,
        label: isFa ? `معتبر تا ${exp}` : `Until ${exp}`,
        rawDate: exp,
        color: 'blue' as const,
        isExpired: false,
        daysLeft
      };
    }
  };

  // Computed Metrics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter(u => u.accountStatus === 'Active').length;
    const admins = users.filter(u => u.role === 'Administrator').length;
    const locked = users.filter(u => u.accountStatus === 'Locked' || u.accountStatus === 'Suspended').length;
    const mfa = users.filter(u => u.mfaEnabled).length;
    const expiredCount = users.filter(u => getAccessExpiryInfo(u).isExpired).length;
    const expiringSoonCount = users.filter(u => getAccessExpiryInfo(u).type === 'expiring_soon').length;
    return { total, active, admins, locked, mfa, expiredCount, expiringSoonCount };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const q = userSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        (user.fullName && user.fullName.toLowerCase().includes(q)) || 
        (user.username && user.username.toLowerCase().includes(q)) || 
        (user.personnelNumber && user.personnelNumber.includes(q)) ||
        (user.nationalId && user.nationalId.includes(q)) ||
        (user.jobTitle && user.jobTitle.toLowerCase().includes(q)) ||
        (user.phoneNumber && user.phoneNumber.includes(q));

      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const matchesDept = deptFilter === 'ALL' || (user.departmentIds && user.departmentIds.includes(deptFilter));
      const matchesStatus = statusFilter === 'ALL' || user.accountStatus === statusFilter;

      // Expiry filter
      let matchesExpiry = true;
      if (expiryFilter !== 'ALL') {
        const expInfo = getAccessExpiryInfo(user);
        if (expiryFilter === 'permanent') {
          matchesExpiry = expInfo.type === 'permanent';
        } else if (expiryFilter === 'active_expiring') {
          matchesExpiry = expInfo.type === 'valid' || expInfo.type === 'expiring_soon';
        } else if (expiryFilter === 'expiring_soon') {
          matchesExpiry = expInfo.type === 'expiring_soon';
        } else if (expiryFilter === 'expired') {
          matchesExpiry = expInfo.isExpired;
        }
      }

      // HSE Category categorization
      let matchesHseCategory = true;
      if (hseCategoryFilter !== 'ALL') {
        const job = (user.jobTitle || '').toLowerCase();
        const role = (user.role || '').toLowerCase();
        if (hseCategoryFilter === 'admin') {
          matchesHseCategory = user.role === 'Administrator';
        } else if (hseCategoryFilter === 'safety') {
          matchesHseCategory = job.includes('ایمنی') || job.includes('safety') || job.includes('افسر') || job.includes('hse');
        } else if (hseCategoryFilter === 'fire') {
          matchesHseCategory = job.includes('آتش') || job.includes('fire') || job.includes('اطفاء') || job.includes('ایستگاه');
        } else if (hseCategoryFilter === 'health') {
          matchesHseCategory = job.includes('بهداشت') || job.includes('طب') || job.includes('health') || job.includes('پزشک') || job.includes('محیط');
        } else if (hseCategoryFilter === 'process') {
          matchesHseCategory = job.includes('فرآیند') || job.includes('process') || job.includes('bpmn') || job.includes('گردش') || job.includes('سیستم');
        } else if (hseCategoryFilter === 'contractor') {
          matchesHseCategory = user.employmentStatus?.includes('پیمانکار') || user.employmentStatus?.includes('Contractor') || false;
        }
      }

      return matchesSearch && matchesRole && matchesDept && matchesStatus && matchesExpiry && matchesHseCategory;
    });
  }, [users, userSearch, roleFilter, deptFilter, statusFilter, expiryFilter, hseCategoryFilter]);

  // Export Staff Directory to CSV
  const handleExportCSV = () => {
    if (users.length === 0) return;
    const headers = ['نام و نام خانوادگی', 'کد پرسنلی', 'کد ملی', 'نام کاربری', 'شغل', 'دپارتمان', 'نقش', 'وضعیت حساب', 'شماره تماس', 'ایمیل', 'شیفت کاری', 'نوع استخدام', 'آخرین ورود'];
    const rows = users.map(u => {
      const deptNames = departments.filter(d => u.departmentIds?.includes(d.id)).map(d => d.name).join(' - ');
      return [
        `"${u.fullName || ''}"`,
        `"${u.personnelNumber || ''}"`,
        `"${u.nationalId || ''}"`,
        `"${u.username || ''}"`,
        `"${u.jobTitle || ''}"`,
        `"${deptNames || ''}"`,
        `"${u.role || ''}"`,
        `"${u.accountStatus || ''}"`,
        `"${u.phoneNumber || ''}"`,
        `"${u.email || ''}"`,
        `"${u.workShift || ''}"`,
        `"${u.employmentStatus || ''}"`,
        `"${u.lastLogin || ''}"`
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadCsvFile(`HSE_Personnel_Directory_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  const getDepartmentNames = (deptIds?: string[]) => {
    if (!deptIds || deptIds.length === 0) return isFa ? 'بدون تخصیص' : 'None';
    const found = departments.filter(d => deptIds.includes(d.id));
    if (found.length === 0) return isFa ? 'واحد عمومی' : 'General Unit';
    return found.map(d => (d?.name ? d.name.split(' (')[0] : '')).filter(Boolean).join('، ');
  };

  return (
    <div className="space-y-5" id="site-personnel-tab">
      {/* 1. Executive Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Staff */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              {isFa ? 'کل پرسنل ثبت شده' : 'Total Staff'}
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
              {stats.total}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Active Staff */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              {isFa ? 'حساب‌های فعال' : 'Active Accounts'}
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.active}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Administrators */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              {isFa ? 'مدیران ارشد سیستم' : 'System Admins'}
            </span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {stats.admins}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Access Expiration Monitoring */}
        <div 
          onClick={() => setExpiryFilter(expiryFilter === 'ALL' ? 'expiring_soon' : 'ALL')}
          className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-2xs cursor-pointer transition ${
            stats.expiringSoonCount > 0 || stats.expiredCount > 0
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 hover:border-amber-500'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
              {isFa ? 'انقضا / در آستانه' : 'Expiring / Expired'}
            </span>
            <div className="text-xl font-black text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1.5">
              <span>{stats.expiringSoonCount + stats.expiredCount}</span>
              {stats.expiredCount > 0 && (
                <span className="text-[10px] text-rose-600 font-bold bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md">
                  {stats.expiredCount} {isFa ? 'منقضی' : 'exp'}
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Hourglass className="w-5 h-5" />
          </div>
        </div>

        {/* Locked / Suspended */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              {isFa ? 'قفل یا معلق' : 'Locked / Suspended'}
            </span>
            <div className={`text-xl font-black font-mono ${stats.locked > 0 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-600 dark:text-slate-400'}`}>
              {stats.locked}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.locked > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-400'}`}>
            <Lock className="w-5 h-5" />
          </div>
        </div>

        {/* MFA Enabled */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between col-span-2 sm:col-span-1 shadow-2xs">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
              {isFa ? 'احراز دومرحله‌ای (MFA)' : '2-Factor MFA'}
            </span>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {stats.mfa}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Key className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. HSE Operational Category Fast-Selector Chips */}
      <div className="bg-slate-50/80 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1 shrink-0">
          <Briefcase className="w-3.5 h-3.5 text-amber-500" />
          <span>{isFa ? 'رسته‌های عملیاتی HSE:' : 'HSE Specialty:'}</span>
        </span>
        
        <button
          onClick={() => setHseCategoryFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer text-[11px] ${
            hseCategoryFilter === 'ALL'
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-2xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {isFa ? 'تمامی رسته‌ها' : 'All Roles'}
        </button>

        <button
          onClick={() => setHseCategoryFilter('safety')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer text-[11px] flex items-center gap-1.5 ${
            hseCategoryFilter === 'safety'
              ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30'
          }`}
        >
          <HardHat className="w-3.5 h-3.5 text-amber-600" />
          <span>{isFa ? 'افسران ایمنی و PTW' : 'Safety & PTW'}</span>
        </button>

        <button
          onClick={() => setHseCategoryFilter('fire')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer text-[11px] flex items-center gap-1.5 ${
            hseCategoryFilter === 'fire'
              ? 'bg-blue-600 text-white font-black shadow-2xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-blue-500" />
          <span>{isFa ? 'آتش‌نشانی و امداد' : 'Fire & Rescue'}</span>
        </button>

        <button
          onClick={() => setHseCategoryFilter('health')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer text-[11px] flex items-center gap-1.5 ${
            hseCategoryFilter === 'health'
              ? 'bg-teal-600 text-white font-black shadow-2xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/30'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5 text-teal-500" />
          <span>{isFa ? 'طب کار و بهداشت' : 'Health & Medical'}</span>
        </button>

        <button
          onClick={() => setHseCategoryFilter('process')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer text-[11px] flex items-center gap-1.5 ${
            hseCategoryFilter === 'process'
              ? 'bg-indigo-600 text-white font-black shadow-2xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
          <span>{isFa ? 'راهبران فرآیندها (BPMN)' : 'Process Owners'}</span>
        </button>

        <button
          onClick={() => setHseCategoryFilter('admin')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer text-[11px] flex items-center gap-1.5 ${
            hseCategoryFilter === 'admin'
              ? 'bg-amber-600 text-white font-black shadow-2xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          <span>{isFa ? 'مدیران ارشد' : 'Administrators'}</span>
        </button>

        <button
          onClick={() => setHseCategoryFilter('contractor')}
          className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer text-[11px] flex items-center gap-1.5 ${
            hseCategoryFilter === 'contractor'
              ? 'bg-blue-600 text-white font-black shadow-2xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
          }`}
        >
          <Building className="w-3.5 h-3.5 text-blue-500" />
          <span>{isFa ? 'پرسنل پیمانکار' : 'Contractors'}</span>
        </button>
      </div>

      {/* 3. Advanced Multi-Filter & Search Bar */}
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main Search Input */}
          <div className="md:col-span-5 relative">
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none">
              <Search className="w-4 h-4" />
            </span>
            <input 
              type="text"
              placeholder={isFa ? 'جستجوی نام، کد پرسنلی، کد ملی، شغل، موبایل...' : 'Search by name, personnel code, job, phone...'}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 pr-9 pl-8 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 shadow-2xs"
            />
            {userSearch && (
              <button 
                onClick={() => setUserSearch('')}
                className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={isFa ? 'پاک کردن جستجو' : 'Clear search'}
              >
                ×
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="md:col-span-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">{isFa ? 'تمامی نقش‌ها' : 'All Roles'}</option>
              <option value="Administrator">{isFa ? 'مدیر سیستم (Admin)' : 'Administrator'}</option>
              <option value="User">{isFa ? 'کاربر عادی (User)' : 'User'}</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="md:col-span-2">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">{isFa ? 'تمامی دپارتمان‌ها' : 'All Departments'}</option>
              {departments.map((d, idx) => (
                <option key={`${d.id || 'dept'}-${idx}`} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">{isFa ? 'همه وضعیت‌ها' : 'All Statuses'}</option>
              <option value="Active">{isFa ? 'فعال (Active)' : 'Active'}</option>
              <option value="Inactive">{isFa ? 'غیرفعال (Inactive)' : 'Inactive'}</option>
              <option value="Suspended">{isFa ? 'معلق (Suspended)' : 'Suspended'}</option>
              <option value="Locked">{isFa ? 'قفل شده (Locked)' : 'Locked'}</option>
              <option value="Expired">{isFa ? 'منقضی شده (Expired)' : 'Expired'}</option>
            </select>
          </div>

          {/* Access Expiry Period Filter */}
          <div className="md:col-span-3">
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as any)}
              className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 px-3 py-2.5 rounded-xl text-xs font-bold text-amber-900 dark:text-amber-300 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">{isFa ? '⏱ مدت اعتبار: همه حساب‌ها' : 'All Access Durations'}</option>
              <option value="permanent">{isFa ? '∞ دسترسی نامحدود و دائمی' : 'Permanent Access'}</option>
              <option value="active_expiring">{isFa ? '📅 دارای تاریخ انقضا و مدت معین' : 'Time-Limited Access'}</option>
              <option value="expiring_soon">{isFa ? '⚠️ در آستانه انقضا (کمتر از ۷ روز)' : 'Expiring Soon (<= 7d)'}</option>
              <option value="expired">{isFa ? '⛔ دسترسی منقضی شده' : 'Expired Access'}</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Actions & View Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" />
              {isFa ? 'فیلتر سریع:' : 'Quick Filters:'}
            </span>

            <button
              onClick={() => {
                setRoleFilter('ALL');
                setStatusFilter('ALL');
                setDeptFilter('ALL');
                setExpiryFilter('ALL');
                setHseCategoryFilter('ALL');
                setUserSearch('');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                roleFilter === 'ALL' && statusFilter === 'ALL' && deptFilter === 'ALL' && expiryFilter === 'ALL' && hseCategoryFilter === 'ALL' && !userSearch
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {isFa ? 'همه پرسنل' : 'All'}
            </button>

            <button
              onClick={() => setStatusFilter('Active')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                statusFilter === 'Active' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {isFa ? 'پرسنل فعال' : 'Active'}
            </button>

            <button
              onClick={() => setExpiryFilter(expiryFilter === 'expiring_soon' ? 'ALL' : 'expiring_soon')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                expiryFilter === 'expiring_soon'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs' 
                  : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
              }`}
            >
              <Hourglass className="w-3 h-3" />
              <span>{isFa ? `در آستانه انقضا (${stats.expiringSoonCount})` : `Expiring Soon (${stats.expiringSoonCount})`}</span>
            </button>

            {stats.expiredCount > 0 && (
              <button
                onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'ALL' : 'expired')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  expiryFilter === 'expired'
                    ? 'bg-rose-600 text-white shadow-xs font-black' 
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{isFa ? `منقضی شده (${stats.expiredCount})` : `Expired (${stats.expiredCount})`}</span>
              </button>
            )}

            {stats.locked > 0 && (
              <button
                onClick={() => setStatusFilter('Locked')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  statusFilter === 'Locked' 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                }`}
              >
                {isFa ? `قفل شده (${stats.locked})` : `Locked (${stats.locked})`}
              </button>
            )}
          </div>

          {/* Action Tools & View Mode Toggle */}
          <div className="flex items-center gap-2">
            {/* Table / Card mode */}
            <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode('table')}
                title={isFa ? 'نمای جدول مشروح' : 'Table View'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <TableIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                title={isFa ? 'نمای کارت‌های پرسنلی' : 'Card View'}
                className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'cards' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFa ? 'خروجی اکسل / CSV' : 'Export'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Action Header Bar: Search Count & Add User */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-700 dark:text-slate-200">
            {isFa ? `لیست پرسنل سایت (${filteredUsers.length} از ${users.length} نفر)` : `Site Staff Directory (${filteredUsers.length} of ${users.length})`}
          </span>
          {(userSearch || roleFilter !== 'ALL' || deptFilter !== 'ALL' || statusFilter !== 'ALL' || hseCategoryFilter !== 'ALL') && (
            <button
              onClick={() => {
                setUserSearch('');
                setRoleFilter('ALL');
                setDeptFilter('ALL');
                setStatusFilter('ALL');
                setHseCategoryFilter('ALL');
              }}
              className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-[11px] cursor-pointer"
            >
              ✕ {isFa ? 'پاکسازی فیلترها' : 'Clear Filters'}
            </button>
          )}
        </div>

        {currentUser?.role === 'Administrator' && (
          <button 
            onClick={onOpenCreateUser}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isFa ? 'ثبت پرسنل جدید در سامانه' : 'Register New Personnel'}</span>
          </button>
        )}
      </div>

      {/* 5. Personnel Listing: Table View or Cards View */}
      {filteredUsers.length === 0 ? (
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center mx-auto text-slate-400">
            <UserX className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
            {isFa ? 'هیچ پرسنلی با فیلترهای مشخص شده یافت نشد' : 'No personnel found matching criteria'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isFa ? 'لطفاً عبارت جستجو را تغییر دهید یا فیلترهای نقش و دپارتمان را پاکسازی فرمایید.' : 'Try adjusting your search query or reset filter dropdowns.'}
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* Dense Industrial Table View */
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-2xs">
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 font-extrabold">
                <tr>
                  <th className="p-3.5">{isFa ? 'هویت و مشخصات پرسنلی' : 'Personnel Identity'}</th>
                  <th className="p-3.5">{isFa ? 'کد پرسنلی / ملی' : 'Personnel / National Code'}</th>
                  <th className="p-3.5">{isFa ? 'دپارتمان و واحد سازمانی' : 'Department & Unit'}</th>
                  <th className="p-3.5">{isFa ? 'اشخاص مرتبط (دسترسی داده)' : 'Related Personnel'}</th>
                  <th className="p-3.5">{isFa ? 'نقش ساختاری' : 'Role'}</th>
                  <th className="p-3.5">{isFa ? 'وضعیت حساب' : 'Status'}</th>
                  <th className="p-3.5">{isFa ? 'مدت و انقضای دسترسی' : 'Access Expiry & Period'}</th>
                  <th className="p-3.5">{isFa ? 'شیفت / نوع استخدام' : 'Shift / Employment'}</th>
                  <th className="p-3.5">{isFa ? 'آخرین ورود به سامانه' : 'Last Login'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'صلاحیت صدور پروانه (PTW)' : 'PTW Qualification'}</th>
                  <th className="p-3.5 text-center">{isFa ? 'عملیات و مدیریت دسترسی' : 'Actions & Permissions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {filteredUsers.map((user, idx) => {
                  const deptStr = getDepartmentNames(user.departmentIds);
                  const isLocked = user.accountStatus === 'Locked';
                  const isSuspended = user.accountStatus === 'Suspended';
                  const isActive = user.accountStatus === 'Active';
                  const isExpired = user.accountStatus === 'Expired';
                  const expInfo = getAccessExpiryInfo(user);

                  return (
                    <tr key={`${user.id || 'user'}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      {/* Identity & Avatar */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div 
                            onClick={() => setProfileModalUser(user)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs cursor-pointer hover:scale-105 transition ${
                              user.role === 'Administrator' 
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                            title={isFa ? 'مشاهده شناسنامه سریع پرسنل' : 'View Quick Profile'}
                          >
                            {user.fullName ? user.fullName.slice(0, 2) : 'کاربر'}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                              <button 
                                onClick={() => setProfileModalUser(user)}
                                className="hover:text-amber-600 transition text-right cursor-pointer"
                              >
                                {user.fullName || (isFa ? 'نامشخص' : 'Unknown')}
                              </button>
                              {user.mfaEnabled && (
                                <span title={isFa ? 'احراز هویت دومرحله‌ای فعال' : '2FA Enabled'} className="text-indigo-500">
                                  <Key className="w-3 h-3 inline" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <span>{user.jobTitle || (isFa ? 'سمت نامشخص' : 'No Job Title')}</span>
                              <span className="font-mono text-[10px] text-slate-400">@{user.username}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Codes */}
                      <td className="p-3.5">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {user.personnelNumber || '—'}
                          </div>
                          {user.nationalId && (
                            <div className="text-[10px] text-slate-400">
                              {user.nationalId}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Department */}
                      <td className="p-3.5">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700/60 max-w-[180px] truncate">
                          {deptStr}
                        </span>
                      </td>

                      {/* Related Personnel (اشخاص مرتبط) */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {user.personnelAccessScope === 'ALL' || user.canAccessAllPersonnel || user.role === 'Administrator' ? (
                            <button
                              type="button"
                              onClick={() => onOpenManagePersonnelAssignments ? onOpenManagePersonnelAssignments(user) : onOpenEditUser(user)}
                              title={isFa ? 'دسترسی به تمام اشخاص مجتمع (کلیک جهت مدیریت اشخاص مرتبط)' : 'All Complex Personnel'}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-[10px] font-black transition cursor-pointer"
                            >
                              <Users className="w-3 h-3" />
                              <span>{isFa ? 'همه اشخاص مجتمع' : 'All Personnel'}</span>
                            </button>
                          ) : (user.assignedPersonnel && user.assignedPersonnel.length > 0) || (user.assignedPersonnelIds && user.assignedPersonnelIds.length > 0) ? (
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => onOpenManagePersonnelAssignments ? onOpenManagePersonnelAssignments(user) : onOpenEditUser(user)}
                                title={
                                  user.assignedPersonnel && user.assignedPersonnel.length > 0
                                    ? user.assignedPersonnel.map(p => `${p.fullName} (${p.personnelCode})`).join('، ')
                                    : (isFa ? 'مدیریت اشخاص مرتبط' : 'Manage Related Personnel')
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-[10px] font-black transition cursor-pointer"
                              >
                                <Users className="w-3 h-3" />
                                <span>
                                  {isFa
                                    ? `${(user.assignedPersonnel?.length || user.assignedPersonnelIds?.length || 0).toLocaleString('fa-IR')} شخص مرتبط`
                                    : `${user.assignedPersonnel?.length || user.assignedPersonnelIds?.length || 0} Assigned`}
                                </span>
                              </button>
                              {user.assignedPersonnel && user.assignedPersonnel.length > 0 && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[170px] truncate">
                                  {user.assignedPersonnel.slice(0, 2).map(p => p.fullName).join('، ')}
                                  {user.assignedPersonnel.length > 2 ? ` +${user.assignedPersonnel.length - 2}` : ''}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenManagePersonnelAssignments ? onOpenManagePersonnelAssignments(user) : onOpenEditUser(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[10px] font-bold transition cursor-pointer"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>{isFa ? 'تعیین اشخاص مرتبط' : 'Assign Personnel'}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black ${
                          user.role === 'Administrator' 
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' 
                            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                        }`}>
                          <Shield className="w-3 h-3" />
                          <span>{user.role === 'Administrator' ? (isFa ? 'مدیر سیستم (Admin)' : 'Administrator') : (isFa ? 'کاربر عادی' : 'User')}</span>
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                          isExpired ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/40 font-black' :
                          isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' :
                          isLocked ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 animate-pulse' :
                          isSuspended ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20' :
                          'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? 'bg-rose-600' : isActive ? 'bg-emerald-500' : isLocked ? 'bg-rose-500' : 'bg-blue-500'}`} />
                          <span>
                            {isExpired ? (isFa ? 'منقضی شده' : 'Expired') :
                             isActive ? (isFa ? 'فعال' : 'Active') :
                             isLocked ? (isFa ? 'قفل شده' : 'Locked') :
                             isSuspended ? (isFa ? 'معلق' : 'Suspended') : (isFa ? 'غیرفعال' : 'Inactive')}
                          </span>
                        </span>
                      </td>

                      {/* Access Expiration & Duration */}
                      <td className="p-3.5">
                        <div className="space-y-1">
                          {expInfo.type === 'permanent' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                              <span>∞</span>
                              <span>{isFa ? 'دائمی (بدون انقضا)' : 'Permanent'}</span>
                            </span>
                          ) : expInfo.type === 'expired' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-[10px] font-black">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{expInfo.label}</span>
                            </span>
                          ) : expInfo.type === 'expiring_soon' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-black animate-pulse">
                              <Hourglass className="w-3 h-3" />
                              <span>{expInfo.label}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold">
                              <Calendar className="w-3 h-3" />
                              <span>{expInfo.label}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Shift & Employment */}
                      <td className="p-3.5">
                        <div className="space-y-0.5 text-[10px]">
                          <div className="text-slate-700 dark:text-slate-300 font-bold">
                            {user.workShift || (isFa ? 'اداری ثابت' : 'Morning')}
                          </div>
                          <div className="text-slate-400">
                            {user.employmentStatus || (isFa ? 'رسمی' : 'Full-Time')}
                          </div>
                        </div>
                      </td>

                      {/* Last Login */}
                      <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {user.lastLogin ? (
                          <div className="flex items-center gap-1 text-[10px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(user.lastLogin).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px]">{isFa ? 'ثبت ورود ندارد' : 'Never'}</span>
                        )}
                      </td>

                      {/* PTW Training & Issuance Qualification */}
                      <td className="p-3.5 text-center">
                        {(() => {
                          const ptw = user.ptwQualification || (user as any).profileData?.ptwQualification;
                          const status = evaluatePtwQualificationStatus(ptw);
                          if (status === 'valid') {
                            return (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                title={`گواهینامه: ${ptw?.certificateNumber || 'ثبت شده'} | اعتبار: ${ptw?.validityDuration || ''} | انقضا: ${ptw?.expiryDate || ''}`}
                              >
                                <Award className="w-3 h-3 text-emerald-600" />
                                <span>معتبر (تا {ptw?.expiryDate || '—'})</span>
                              </span>
                            );
                          }
                          if (status === 'expired') {
                            return (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                title={`منقضی در تاریخ ${ptw?.expiryDate || ''}`}
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>منقضی شده</span>
                              </span>
                            );
                          }
                          if (status === 'unqualified') {
                            return (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                                title="عدم موفقیت در دوره آموزشی PTW"
                              >
                                <UserX className="w-3 h-3 text-rose-600" />
                                <span>فاقد صلاحیت</span>
                              </span>
                            );
                          }
                          if (status === 'incomplete') {
                            return (
                              <span 
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                title="اطلاعات گواهینامه ناقص است"
                              >
                                <Hourglass className="w-3 h-3 text-amber-600" />
                                <span>نیازمند تکمیل</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800">
                              <span>ثبت‌نشده</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick view button */}
                          <button
                            onClick={() => setProfileModalUser(user)}
                            title={isFa ? 'شناسنامه پرسنلی و سوابق' : 'Quick Summary'}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Unlock trigger */}
                          {isLocked && currentUser?.role === 'Administrator' && (
                            <button 
                              onClick={() => onResetAttempts(user)}
                              title={isFa ? 'بازکردن قفل حساب کاربر' : 'Unlock user account'}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-lg transition cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Jump to Permissions Matrix */}
                          <button 
                            onClick={() => onSelectUserForPermissions(user)}
                            title={isFa ? 'تنظیم ماتریس مجوزهای این کاربر' : 'Configure Permissions Matrix'}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">{isFa ? 'مجوزها' : 'Perms'}</span>
                          </button>

                          {/* Manage Related Personnel */}
                          {currentUser?.role === 'Administrator' && onOpenManagePersonnelAssignments && (
                            <button
                              onClick={() => onOpenManagePersonnelAssignments(user)}
                              title={isFa ? 'مدیریت اشخاص مرتبط (سطح دسترسی داده پرسنل)' : 'Manage Assigned Personnel'}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">{isFa ? 'اشخاص مرتبط' : 'Personnel'}</span>
                            </button>
                          )}

                          {/* Edit Profile */}
                          {currentUser?.role === 'Administrator' && (
                            <button 
                              onClick={() => onOpenEditUser(user)}
                              title={isFa ? 'ویرایش مشخصات پرسنل' : 'Edit profile'}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Account */}
                          {currentUser?.role === 'Administrator' && (
                            <button 
                              onClick={() => onDeleteUser(user.id, user.fullName)}
                              title={isFa ? 'حذف حساب کاربری' : 'Delete account'}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Modern Cards Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user, idx) => {
            const deptStr = getDepartmentNames(user.departmentIds);
            const isLocked = user.accountStatus === 'Locked';
            const isActive = user.accountStatus === 'Active';
            const isExpired = user.accountStatus === 'Expired';
            const expInfo = getAccessExpiryInfo(user);

            return (
              <div 
                key={`${user.id || 'card'}-${idx}`}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-amber-500/40 transition space-y-3.5"
              >
                {/* Header Profile Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div 
                      onClick={() => setProfileModalUser(user)}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-2xs cursor-pointer hover:scale-105 transition ${
                        user.role === 'Administrator' 
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                      title={isFa ? 'مشاهده شناسنامه سریع' : 'Quick View'}
                    >
                      {user.fullName ? user.fullName.slice(0, 2) : 'کاربر'}
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <button 
                          onClick={() => setProfileModalUser(user)}
                          className="hover:text-amber-600 transition text-right cursor-pointer"
                        >
                          {user.fullName || (isFa ? 'نامشخص' : 'Unknown')}
                        </button>
                        {user.mfaEnabled && (
                          <span title={isFa ? 'MFA فعال' : '2FA Enabled'} className="text-indigo-500">
                            <Key className="w-3 h-3" />
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                        {user.jobTitle || '-'}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isExpired ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/40' :
                    isActive ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' :
                    isLocked ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 animate-pulse' :
                    'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {isExpired ? (isFa ? 'منقضی' : 'Expired') :
                     isActive ? (isFa ? 'فعال' : 'Active') : isLocked ? (isFa ? 'قفل شده' : 'Locked') : (isFa ? 'معلق' : 'Suspended')}
                  </span>
                </div>

                {/* Details Badges */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 font-bold">{isFa ? 'کد پرسنلی:' : 'Personnel ID:'}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{user.personnelNumber || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 font-bold">{isFa ? 'دپارتمان:' : 'Department:'}</span>
                    <span className="font-bold truncate max-w-[150px]">{deptStr}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 font-bold">{isFa ? 'نقش سامانه:' : 'Role:'}</span>
                    <span className="font-bold">{user.role === 'Administrator' ? (isFa ? 'مدیر ارشد' : 'Admin') : (isFa ? 'کاربر' : 'User')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 font-bold">{isFa ? 'اعتبار دسترسی:' : 'Access Validity:'}</span>
                    <span className={`font-bold text-[10px] ${
                      expInfo.type === 'expired' ? 'text-rose-600 dark:text-rose-400 font-black' :
                      expInfo.type === 'expiring_soon' ? 'text-amber-600 dark:text-amber-400 font-black' :
                      expInfo.type === 'permanent' ? 'text-emerald-600 dark:text-emerald-400' :
                      'text-blue-600 dark:text-blue-400'
                    }`}>
                      {expInfo.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 font-bold">{isFa ? 'شیفت کاری:' : 'Shift:'}</span>
                    <span className="font-bold">{user.workShift || (isFa ? 'اداری' : 'Morning')}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400 font-bold">{isFa ? 'اشخاص مرتبط:' : 'Related Personnel:'}</span>
                    <button
                      type="button"
                      onClick={() => onOpenManagePersonnelAssignments ? onOpenManagePersonnelAssignments(user) : onOpenEditUser(user)}
                      className="font-black text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {user.personnelAccessScope === 'ALL' || user.canAccessAllPersonnel || user.role === 'Administrator'
                        ? (isFa ? 'همه اشخاص مجتمع' : 'All Personnel')
                        : (user.assignedPersonnel?.length || user.assignedPersonnelIds?.length)
                        ? (isFa ? `${(user.assignedPersonnel?.length || user.assignedPersonnelIds?.length || 0).toLocaleString('fa-IR')} شخص مرتبط` : `${user.assignedPersonnel?.length || user.assignedPersonnelIds?.length || 0} Assigned`)
                        : (isFa ? 'تعیین نشده (انتخاب...)' : 'None (Assign...)')}
                    </button>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-400 font-bold">{isFa ? 'صلاحیت PTW:' : 'PTW Qualification:'}</span>
                    {(() => {
                      const ptw = user.ptwQualification || (user as any).profileData?.ptwQualification;
                      const status = evaluatePtwQualificationStatus(ptw);
                      if (status === 'valid') {
                        return (
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            <span>معتبر (تا {ptw?.expiryDate || '—'})</span>
                          </span>
                        );
                      }
                      if (status === 'expired') {
                        return (
                          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>منقضی شده</span>
                          </span>
                        );
                      }
                      if (status === 'unqualified') {
                        return (
                          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <UserX className="w-3 h-3" />
                            <span>فاقد صلاحیت</span>
                          </span>
                        );
                      }
                      if (status === 'incomplete') {
                        return (
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Hourglass className="w-3 h-3" />
                            <span>نیازمند تکمیل</span>
                          </span>
                        );
                      }
                      return <span className="text-[10px] text-slate-400">ثبت‌نشده</span>;
                    })()}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSelectUserForPermissions(user)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{isFa ? 'ماتریس دسترسی' : 'Permissions'}</span>
                    </button>
                    <button
                      onClick={() => setProfileModalUser(user)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                      title={isFa ? 'شناسنامه پرسنلی' : 'Profile'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {isLocked && currentUser?.role === 'Administrator' && (
                      <button
                        onClick={() => onResetAttempts(user)}
                        title={isFa ? 'بازکردن قفل حساب' : 'Unlock'}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-xl transition cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role === 'Administrator' && (
                      <button
                        onClick={() => onOpenEditUser(user)}
                        title={isFa ? 'ویرایش مشخصات' : 'Edit'}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-xl transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {currentUser?.role === 'Administrator' && (
                      <button
                        onClick={() => onDeleteUser(user.id, user.fullName)}
                        title={isFa ? 'حذف کاربر' : 'Delete'}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Quick Personnel 360° Summary Modal */}
      {profileModalUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black text-base border border-amber-500/30">
                  {profileModalUser.fullName ? profileModalUser.fullName.slice(0, 2) : 'HSE'}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {profileModalUser.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                    {profileModalUser.jobTitle || 'پرسنل سایت'} — <span className="font-mono">@{profileModalUser.username}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setProfileModalUser(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'کد پرسنلی' : 'Personnel ID'}</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-100">{profileModalUser.personnelNumber || '—'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'کد ملی' : 'National Code'}</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-100">{profileModalUser.nationalId || '—'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'شماره تماس' : 'Phone'}</span>
                <span className="font-mono font-black text-slate-800 dark:text-slate-100">{profileModalUser.phoneNumber || '—'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'دپارتمان تخصصی' : 'Department'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">{getDepartmentNames(profileModalUser.departmentIds)}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'شیفت کاری' : 'Shift'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{profileModalUser.workShift || 'اداری ثابت'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{isFa ? 'نوع استخدام' : 'Contract'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-100">{profileModalUser.employmentStatus || 'رسمی'}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1 col-span-2 sm:col-span-3">
                <span className="text-[10px] text-slate-400 font-bold block flex items-center justify-between">
                  <span>{isFa ? 'مدت و تاریخ انقضای دسترسی به سامانه:' : 'Access Expiration Date:'}</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">{getAccessExpiryInfo(profileModalUser).label}</span>
                </span>
                <div className="flex items-center gap-2 pt-0.5">
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    getAccessExpiryInfo(profileModalUser).isExpired 
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' 
                      : getAccessExpiryInfo(profileModalUser).type === 'expiring_soon'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}>
                    {profileModalUser.accessExpiresAt 
                      ? (isFa ? `تاریخ انقضا: ${profileModalUser.accessExpiresAt}` : `Expires: ${profileModalUser.accessExpiresAt}`)
                      : (isFa ? 'دسترسی نامحدود و دائمی' : 'Permanent Unlimited Access')}
                  </div>
                </div>
              </div>
            </div>

            {/* Official Signature Sample Display */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{isFa ? 'نمونه امضای رسمی پرسنل (PNG / JPEG):' : 'Official Signature Sample:'}</span>
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {(profileModalUser.signatureImage || getPersonnelSignature(profileModalUser))
                    ? (isFa ? 'ثبت شده و آماده استفاده خودکار در امضا و ارجاع اسناد' : 'Registered for document signing & referrals')
                    : (isFa ? 'نمونه امضا ثبت نشده است (از بخش ویرایش مشخصات بارگذاری نمایید)' : 'No signature uploaded yet')}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 min-w-[130px] h-16 flex items-center justify-center shrink-0">
                {(profileModalUser.signatureImage || getPersonnelSignature(profileModalUser)) ? (
                  <img
                    src={profileModalUser.signatureImage || getPersonnelSignature(profileModalUser)}
                    alt="Signature Sample"
                    className="max-h-12 max-w-[120px] object-contain mix-blend-multiply dark:mix-blend-normal"
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold">{isFa ? 'بدون نمونه امضا' : 'No Signature'}</span>
                )}
              </div>
            </div>

            {/* Status & HSE Capabilities */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2 text-xs">
              <span className="text-amber-900 dark:text-amber-300 font-black flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                <span>{isFa ? 'وضعیت دسترسی‌ها و انطباق فرآیندی (HSE 360°)' : 'HSE 360° Compliance & Access'}</span>
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isFa ? 'نقش سامانه:' : 'Role:'} <strong>{profileModalUser.role}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isFa ? 'احراز دومرحله‌ای:' : 'MFA:'} <strong>{profileModalUser.mfaEnabled ? (isFa ? 'فعال' : 'Active') : (isFa ? 'غیرفعال' : 'Disabled')}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isFa ? 'وضعیت حساب:' : 'Status:'} <strong>{profileModalUser.accountStatus}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{isFa ? 'انقضای رمز:' : 'Password Exp:'} <strong>{isFa ? 'معتبر' : 'Valid'}</strong></span>
                </div>
              </div>
            </div>

            {/* Related Personnel Summary inside 360 Modal */}
            <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{isFa ? 'اشخاص مرتبط کاربر (دامنه دسترسی داده‌های پرسنلی):' : 'Assigned Personnel Scope:'}</span>
                </span>
                {currentUser?.role === 'Administrator' && onOpenManagePersonnelAssignments && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetUser = profileModalUser;
                      setProfileModalUser(null);
                      onOpenManagePersonnelAssignments(targetUser);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition cursor-pointer"
                  >
                    {isFa ? 'مدیریت اشخاص مرتبط' : 'Manage Assignments'}
                  </button>
                )}
              </div>
              {profileModalUser.personnelAccessScope === 'ALL' || profileModalUser.canAccessAllPersonnel || profileModalUser.role === 'Administrator' ? (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {isFa ? '✓ دسترسی به «همه اشخاص مجتمع» در تمام ماژول‌ها فعال است.' : '✓ Access to all complex personnel is active across all modules.'}
                </p>
              ) : profileModalUser.assignedPersonnel && profileModalUser.assignedPersonnel.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {profileModalUser.assignedPersonnel.map((p) => (
                    <span
                      key={p.personnelId}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                    >
                      {p.fullName} <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">({p.personnelCode})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  {isFa ? 'هیچ شخص مرتبطی برای این کاربر ثبت نشده است.' : 'No related personnel assigned to this user.'}
                </p>
              )}
            </div>

            {/* PTW Training & Issuance Authorization Summary */}
            {(() => {
              const ptw = profileModalUser.ptwQualification || (profileModalUser as any).profileData?.ptwQualification;
              const status = evaluatePtwQualificationStatus(ptw);
              const durationMap: Record<string, string> = {
                '6m': '۶ ماه',
                '1y': '۱ سال',
                '3y': '۳ سال',
                '5y': '۵ سال'
              };

              return (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-600" />
                      <span>صلاحیت آموزشی و مجوزهای صدور پروانه کار (PTW)</span>
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      status === 'valid'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                        : status === 'expired'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300'
                        : status === 'unqualified'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300'
                        : status === 'incomplete'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-300'
                    }`}>
                      {status === 'valid' ? 'معتبر ✓' :
                       status === 'expired' ? 'منقضی شده ✕' :
                       status === 'unqualified' ? 'فاقد صلاحیت' :
                       status === 'incomplete' ? 'نیازمند تکمیل اطلاعات' : 'اطلاعات ثبت نشده'}
                    </span>
                  </div>

                  {ptw?.courseStatus === 'passed' ? (
                    <div className="space-y-2.5 text-[11px]">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 block font-bold">وضعیت دوره</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            گذرانده ({ptw.courseResult === 'success' ? 'قبول / موفق' : 'ناموفق'})
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 block font-bold">شماره گواهینامه</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                            {ptw.certificateNumber || '—'}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 block font-bold">تاریخ صدور و اعتبار</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                            {ptw.issueDate || '—'} ({durationMap[ptw.validityDuration || ''] || ptw.validityDuration || '—'})
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] text-slate-400 block font-bold">تاریخ انقضا</span>
                          <span className={`font-mono font-bold ${status === 'expired' ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {ptw.expiryDate || '—'}
                          </span>
                        </div>
                      </div>

                      {/* Authorized Roles & Permits */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400">پروانه‌های کار اصلی مجاز:</span>
                          {ptw.mainPermits?.hot && <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">کار گرم (Hot)</span>}
                          {ptw.mainPermits?.cold && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">کار سرد (Cold)</span>}
                          {!ptw.mainPermits?.hot && !ptw.mainPermits?.cold && <span className="text-slate-400 text-[10px]">فاقد مجوز پروانه اصلی</span>}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400">مسئولیت‌های مجاز در فرایند:</span>
                          {ptw.responsibilities?.issuer && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">صادرکننده پروانه</span>}
                          {ptw.responsibilities?.executor && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[10px]">مجری کار</span>}
                          {ptw.responsibilities?.areaSupervisor && <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[10px]">مسئول محوطه</span>}
                          {ptw.responsibilities?.safetyUnit && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">واحد HSE</span>}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400">پروانه‌های الحاقی مجاز:</span>
                          {ptw.supplementaryPermits?.excavation && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[9.5px]">حفاری</span>}
                          {ptw.supplementaryPermits?.confinedSpace && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[9.5px]">فضای بسته</span>}
                          {ptw.supplementaryPermits?.vehicleCrane && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[9.5px]">خودرو/جرثقیل</span>}
                          {ptw.supplementaryPermits?.processIsolation && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[9.5px]">جداسازی فرآیندی</span>}
                          {ptw.supplementaryPermits?.electricalIsolation && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[9.5px]">جداسازی الکتریکی</span>}
                          {ptw.supplementaryPermits?.radiation && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 text-[9.5px]">پرتونگاری</span>}
                        </div>

                        {ptw.lastQualificationUpdate && (
                          <div className="text-[9.5px] text-slate-400 font-mono pt-1">
                            آخرین به‌روزرسانی صلاحیت: {new Date(ptw.lastQualificationUpdate).toLocaleString('fa-IR')}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      دوره آموزشی صدور پروانه کار توسط این پرسنل گذرانده نشده است؛ مجاز به امضای پروانه‌های کار نمی‌باشد.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setProfileModalUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {isFa ? 'بستن' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUser = profileModalUser;
                  setProfileModalUser(null);
                  onOpenEditUser(targetUser);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isFa ? 'ویرایش مشخصات و اشخاص مرتبط' : 'Edit Profile & Related Personnel'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUser = profileModalUser;
                  setProfileModalUser(null);
                  onSelectUserForPermissions(targetUser);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isFa ? 'تنظیم ماتریس مجوزها' : 'Edit Permissions'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
