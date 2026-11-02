import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Settings,
  Building,
  Search,
  Save,
  UserPlus,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Clock,
  ShieldAlert,
  Info,
  Timer,
  PenTool,
  Upload,
  Trash2,
  CheckCircle2,
  Award,
  FileCheck2,
  Flame,
  Snowflake,
  HardHat,
  Radio,
  Zap
} from 'lucide-react';
import moment from 'moment-jalaali';
import {
  UserProfile,
  UserRole,
  UserStatus,
  PermissionGroup,
  PermissionActions,
  Department,
  PtwQualificationData,
  PtwCourseStatus,
  PtwCourseResult,
  PtwValidityDuration,
  PtwQualificationStatus
} from '../types';
import { createPermissionsSet, addAuditLog, setSystemUsers, getDefaultPermissionsForRole, isUserAdmin, setCurrentUser as setCurrentUserInAuth } from '../utils/authHelper';
import {
  findPersonnelByCode,
  syncAndGetExtractedDepartments,
  processSignatureImageFile,
  getPersonnelSignature,
  getComplexPersonnelList,
  setInMemoryPersonnelList,
  calculatePtwExpiryDate,
  evaluatePtwQualificationStatus
} from '../utils/personnelHelper';
import { apiDb } from '../services/apiDatabaseClient';
import { getJobTitles } from '../utils/orgHelper';
import CentralPersonnelSelector from './CentralPersonnelSelector';
import { SitePersonnelTab } from './users/SitePersonnelTab';
import { PermissionsMatrixTab } from './users/PermissionsMatrixTab';
import { UserPersonnelAssignmentSection, UserPersonnelAssignmentModal } from './users/UserPersonnelAssignmentSection';

const PREDEFINED_ROLES = [
  'User',
  'Administrator',
  'HSE Manager',
  'Safety Officer',
  'SafetyInspector',
  'MedicalStaff',
  'Contractor',
  'ExecutiveManager',
  'Auditor'
];

interface UserManagementProps {
  currentUser: UserProfile;
  language: 'en' | 'fa';
  onUserUpdateTrigger?: () => void;
}

export default function UserManagement({ currentUser, language, onUserUpdateTrigger }: UserManagementProps) {
  const isFa = language === 'fa';

  // State
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'permissions'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'user';
    id: string;
    name: string;
  } | null>(null);

  // Selected User for permission editing
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<UserProfile | null>(currentUser || null);

  // Modal / Form state for Creating/Editing Users
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserUid, setEditingUserUid] = useState<string | null>(null);
  const [editingOriginalUsername, setEditingOriginalUsername] = useState<string>('');
  const [editingOriginalPersonnelNumber, setEditingOriginalPersonnelNumber] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [saveConfirmOpen, setSaveConfirmOpen] = useState<boolean>(false);
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  
  // User Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [personnelNumber, setPersonnelNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [userDeptIds, setUserDeptIds] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState('رسمی (Full-Time)');
  const [workShift, setWorkShift] = useState('اداری ثابت (Morning)');
  const [supervisor, setSupervisor] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [role, setRole] = useState<string>('User');
  const [customRoleName, setCustomRoleName] = useState<string>('');
  const [isCustomRole, setIsCustomRole] = useState<boolean>(false);
  const [accountStatus, setAccountStatus] = useState<UserStatus>('Active');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(5);
  const [accessDurationType, setAccessDurationType] = useState<'permanent' | '1month' | '3months' | '6months' | '1year' | '2years' | 'custom'>('permanent');
  const [accessExpiresAt, setAccessExpiresAt] = useState<string>('');
  const [signatureImage, setSignatureImage] = useState<string>('');
  const [signatureError, setSignatureError] = useState<string>('');
  const [personnelAccessScope, setPersonnelAccessScope] = useState<'ALL' | 'ASSIGNED'>('ASSIGNED');
  const [assignedPersonnelIds, setAssignedPersonnelIds] = useState<string[]>([]);
  const [assignmentModalUser, setAssignmentModalUser] = useState<UserProfile | null>(null);

  // Section 4: PTW Qualification and Issuance Authorization State
  const [ptwCourseStatus, setPtwCourseStatus] = useState<PtwCourseStatus>('not_passed');
  const [ptwCourseResult, setPtwCourseResult] = useState<PtwCourseResult>('fail');
  const [ptwCertificateNumber, setPtwCertificateNumber] = useState<string>('');
  const [ptwIssueDate, setPtwIssueDate] = useState<string>('');
  const [ptwValidityDuration, setPtwValidityDuration] = useState<PtwValidityDuration>('1y');
  const [ptwExpiryDate, setPtwExpiryDate] = useState<string>('');
  const [ptwMainPermits, setPtwMainPermits] = useState<{ hot: boolean; cold: boolean }>({ hot: false, cold: false });
  const [ptwResponsibilities, setPtwResponsibilities] = useState<{
    issuer: boolean;
    executor: boolean;
    areaSupervisor: boolean;
    safetyUnit: boolean;
  }>({ issuer: false, executor: false, areaSupervisor: false, safetyUnit: false });
  const [ptwSupplementaryPermits, setPtwSupplementaryPermits] = useState<{
    excavation: boolean;
    confinedSpace: boolean;
    vehicleCrane: boolean;
    processIsolation: boolean;
    electricalIsolation: boolean;
    radiation: boolean;
  }>({
    excavation: false,
    confinedSpace: false,
    vehicleCrane: false,
    processIsolation: false,
    electricalIsolation: false,
    radiation: false,
  });
  const [ptwLastUpdatedAt, setPtwLastUpdatedAt] = useState<string>('');

  const livePtwStatus = evaluatePtwQualificationStatus({
    courseStatus: ptwCourseStatus,
    courseResult: ptwCourseResult,
    issueDate: ptwIssueDate,
    validityDuration: ptwValidityDuration,
    expiryDate: ptwExpiryDate,
    mainPermits: ptwMainPermits,
    responsibilities: ptwResponsibilities,
    supplementaryPermits: ptwSupplementaryPermits,
  });

  const handlePtwIssueDateChange = (newDate: string) => {
    setPtwIssueDate(newDate);
    if (newDate && ptwValidityDuration) {
      const calcExpiry = calculatePtwExpiryDate(newDate, ptwValidityDuration);
      setPtwExpiryDate(calcExpiry);
    }
  };

  const handlePtwValidityDurationChange = (duration: PtwValidityDuration) => {
    setPtwValidityDuration(duration);
    if (ptwIssueDate) {
      const calcExpiry = calculatePtwExpiryDate(ptwIssueDate, duration);
      setPtwExpiryDate(calcExpiry);
    }
  };

  const handleSignatureFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignatureError('');
    setFormError('');
    try {
      const dataUrl = await processSignatureImageFile(file);
      setSignatureImage(dataUrl);
    } catch (err: any) {
      setSignatureError(err?.message || (isFa ? 'فرمت فایل امضا نامعتبر است. فقط PNG یا JPEG مجاز است.' : 'Invalid signature file format. Only PNG or JPEG allowed.'));
    } finally {
      e.target.value = '';
    }
  };

  const calculateExpiryFromPreset = (preset: 'permanent' | '1month' | '3months' | '6months' | '1year' | '2years' | 'custom') => {
    if (preset === 'permanent') return '';
    const now = moment();
    if (preset === '1month') return now.add(1, 'jMonth').format('jYYYY/jMM/jDD');
    if (preset === '3months') return now.add(3, 'jMonths').format('jYYYY/jMM/jDD');
    if (preset === '6months') return now.add(6, 'jMonths').format('jYYYY/jMM/jDD');
    if (preset === '1year') return now.add(1, 'jYear').format('jYYYY/jMM/jDD');
    if (preset === '2years') return now.add(2, 'jYears').format('jYYYY/jMM/jDD');
    return accessExpiresAt || now.add(1, 'jMonth').format('jYYYY/jMM/jDD');
  };

  const handleDurationTypeChange = (type: 'permanent' | '1month' | '3months' | '6months' | '1year' | '2years' | 'custom') => {
    setAccessDurationType(type);
    if (type === 'permanent') {
      setAccessExpiresAt('');
    } else {
      setAccessExpiresAt(calculateExpiryFromPreset(type));
    }
  };

  const normalizeUser = (u: any): UserProfile => {
    const userRole: UserRole = u.role || 'User';
    const userPerms = (u.permissions && Object.keys(u.permissions).length > 0)
      ? u.permissions
      : ((u.profileData?.permissions && Object.keys(u.profileData.permissions).length > 0)
          ? u.profileData.permissions
          : createPermissionsSet(userRole === 'Administrator'));

    const normalized: UserProfile & { uid?: string } = {
      id: String(u.id ?? u.uid ?? `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      uid: String(u.uid ?? u.id ?? ''),
      username: String(u.username || u.email?.split('@')[0] || 'user'),
      fullName: String(u.fullName || u.name || (isFa ? 'کاربر سامانه' : 'System User')),
      personnelNumber: String(u.personnelNumber || ''),
      nationalId: String(u.nationalId || u.nationalCode || ''),
      departmentIds: Array.isArray(u.departmentIds) ? u.departmentIds : (Array.isArray(u.profileData?.departmentIds) ? u.profileData.departmentIds : []),
      jobTitle: String(u.jobTitle || u.position || ''),
      phoneNumber: String(u.phoneNumber || u.phone || ''),
      email: String(u.email || ''),
      employmentStatus: String(u.employmentStatus || u.profileData?.employmentStatus || (isFa ? 'رسمی (Full-Time)' : 'Full-Time')),
      workShift: String(u.workShift || u.profileData?.workShift || (isFa ? 'اداری ثابت (Morning)' : 'Morning')),
      supervisor: String(u.supervisor || u.profileData?.supervisor || ''),
      emergencyContact: String(u.emergencyContact || u.profileData?.emergencyContact || ''),
      role: userRole,
      accountStatus: (u.accountStatus || 'Active') as UserStatus,
      createdDate: u.createdDate || (u.createdAt ? new Date(u.createdAt).toLocaleDateString('fa-IR') : '1404/01/01'),
      updatedDate: u.updatedDate || (u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('fa-IR') : '1404/01/01'),
      passwordHash: String(u.passwordHash || ''),
      failedAttempts: Number(u.failedAttempts) || 0,
      passwordExpiresAt: u.passwordExpiresAt || u.profileData?.passwordExpiresAt || new Date(Date.now() + 90 * 86400000).toISOString(),
      forcePasswordChange: Boolean(u.forcePasswordChange || u.profileData?.forcePasswordChange),
      mfaEnabled: Boolean(u.mfaEnabled || u.profileData?.mfaEnabled),
      sessionTimeoutMinutes: Number(u.sessionTimeoutMinutes || u.profileData?.sessionTimeoutMinutes) || 5,
      accessExpiresAt: u.accessExpiresAt || u.profileData?.accessExpiresAt || null,
      accessDurationType: u.accessDurationType || u.profileData?.accessDurationType || ((u.accessExpiresAt || u.profileData?.accessExpiresAt) ? 'custom' : 'permanent'),
      profilePhoto: u.profilePhoto || u.profileData?.profilePhoto || '',
      signatureImage: u.signatureImage || u.profileData?.signatureImage || getPersonnelSignature(u) || '',
      personnelAccessScope: (u.personnelAccessScope === 'ALL' || u.canAccessAllPersonnel || userRole === 'Administrator') ? 'ALL' : 'ASSIGNED',
      canAccessAllPersonnel: Boolean(u.canAccessAllPersonnel || u.personnelAccessScope === 'ALL' || userRole === 'Administrator'),
      assignedPersonnelIds: Array.isArray(u.assignedPersonnelIds) ? u.assignedPersonnelIds.map((id: any) => String(id)) : [],
      assignedPersonnelCodes: Array.isArray(u.assignedPersonnelCodes) ? u.assignedPersonnelCodes.map((c: any) => String(c)) : [],
      assignedPersonnel: Array.isArray(u.assignedPersonnel) ? u.assignedPersonnel : [],
      ptwQualification: u.ptwQualification || u.profileData?.ptwQualification || undefined,
      permissions: userPerms
    };
    return normalized;
  };

  // Notify parent layout (App header & SystemSettings header) to auto-hide top bars when full screen modal is open
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: isUserModalOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('fullscreenFormToggle', { detail: { isOpen: false } }));
    };
  }, [isUserModalOpen]);

  // Sync state from Backend database (Zero Browser Storage)
  const loadData = async () => {
    let loadedUsers: UserProfile[] = [];
    try {
      const dbUsers = await apiDb.getUsers();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        loadedUsers = dbUsers.map(normalizeUser);
        setUsers(loadedUsers);
        setSystemUsers(loadedUsers);
      }
    } catch (e) {
      console.error('Failed to load users from database:', e);
    }

    if (loadedUsers.length === 0 && currentUser) {
      loadedUsers = [normalizeUser(currentUser)];
      setUsers(loadedUsers);
      setSystemUsers(loadedUsers);
    }

    if (loadedUsers.length > 0) {
      setSelectedUserForPerms(prev => {
        if (!prev) return loadedUsers[0];
        const found = loadedUsers.find(
          u =>
            u.id === prev.id ||
            ((u as any).uid && (u as any).uid === prev.id) ||
            ((prev as any).uid && (u.id === (prev as any).uid || (u as any).uid === (prev as any).uid)) ||
            (u.username && prev.username && u.username.toLowerCase() === prev.username.toLowerCase())
        );
        return found || loadedUsers[0];
      });
    }

    setDepartments(syncAndGetExtractedDepartments());
  };

  useEffect(() => {
    loadData();

    const handleDeptSync = () => {
      setDepartments(syncAndGetExtractedDepartments());
    };

    const handleDataMutated = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('user')) {
        loadData();
      }
    };

    window.addEventListener('hse_departments_updated', handleDeptSync);
    window.addEventListener('hse_data_mutated', handleDataMutated);
    window.addEventListener('app_data_mutated', handleDataMutated);
    window.addEventListener('hse_users_updated', loadData);
    window.addEventListener('hse_user_assignments_updated', loadData);
    return () => {
      window.removeEventListener('hse_departments_updated', handleDeptSync);
      window.removeEventListener('hse_data_mutated', handleDataMutated);
      window.removeEventListener('app_data_mutated', handleDataMutated);
      window.removeEventListener('hse_users_updated', loadData);
      window.removeEventListener('hse_user_assignments_updated', loadData);
    };
  }, []);

  const saveUsers = (updatedUsers: UserProfile[]) => {
    setUsers(updatedUsers);
    setSystemUsers(updatedUsers);
    if (onUserUpdateTrigger) onUserUpdateTrigger();
    
    // Also update selectedUserForPerms if they were edited
    if (selectedUserForPerms) {
      const freshSelected = updatedUsers.find(u => u.id === selectedUserForPerms.id);
      if (freshSelected) {
        setSelectedUserForPerms(freshSelected);
      }
    }
    window.dispatchEvent(new CustomEvent('hse_users_updated', { detail: { users: updatedUsers } }));
  };

  // --- USER OPERATIONS ---
  const handleOpenCreateUser = () => {
    setEditingUserId(null);
    setEditingUserUid(null);
    setEditingOriginalUsername('');
    setEditingOriginalPersonnelNumber('');
    setFormError('');
    setSaveConfirmOpen(false);
    setUsername('');
    setPassword('');
    setFullName('');
    setPersonnelNumber('');
    setNationalId('');
    setUserDeptIds([]);
    setJobTitle('');
    setPhoneNumber('');
    setEmail('');
    setEmploymentStatus(isFa ? 'رسمی (Full-Time)' : 'Full-Time');
    setWorkShift(isFa ? 'اداری ثابت (Morning)' : 'Morning');
    setSupervisor('');
    setEmergencyContact('');
    setRole('User');
    setCustomRoleName('');
    setIsCustomRole(false);
    setAccountStatus('Active');
    setMfaEnabled(false);
    setForcePasswordChange(false);
    setSessionTimeoutMinutes(5);
    setAccessDurationType('permanent');
    setAccessExpiresAt('');
    setSignatureImage('');
    setSignatureError('');
    setPersonnelAccessScope('ASSIGNED');
    setAssignedPersonnelIds([]);
    setPtwCourseStatus('not_passed');
    setPtwCourseResult('fail');
    setPtwCertificateNumber('');
    setPtwIssueDate('');
    setPtwValidityDuration('1y');
    setPtwExpiryDate('');
    setPtwMainPermits({ hot: false, cold: false });
    setPtwResponsibilities({ issuer: false, executor: false, areaSupervisor: false, safetyUnit: false });
    setPtwSupplementaryPermits({
      excavation: false,
      confinedSpace: false,
      vehicleCrane: false,
      processIsolation: false,
      electricalIsolation: false,
      radiation: false,
    });
    setPtwLastUpdatedAt('');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUserId(user.id);
    setEditingUserUid((user as any).uid || user.id);
    setEditingOriginalUsername(user.username || '');
    setEditingOriginalPersonnelNumber(user.personnelNumber || '');
    setFormError('');
    setSaveConfirmOpen(false);
    setUsername(user.username);
    setPassword(''); // blank means do not change password
    setFullName(user.fullName);
    setPersonnelNumber(user.personnelNumber);
    setNationalId(user.nationalId);
    setUserDeptIds(user.departmentIds || []);
    setJobTitle(user.jobTitle);
    setPhoneNumber(user.phoneNumber);
    setEmail(user.email);
    setEmploymentStatus(user.employmentStatus);
    setWorkShift(user.workShift);
    setSupervisor(user.supervisor);
    setEmergencyContact(user.emergencyContact);
    if (PREDEFINED_ROLES.includes(user.role)) {
      setRole(user.role);
      setIsCustomRole(false);
      setCustomRoleName('');
    } else {
      setRole('custom');
      setIsCustomRole(true);
      setCustomRoleName(user.role || '');
    }
    setAccountStatus(user.accountStatus);
    setMfaEnabled(user.mfaEnabled);
    setForcePasswordChange(user.forcePasswordChange);
    setSessionTimeoutMinutes(user.sessionTimeoutMinutes || 5);
    const userExp = user.accessExpiresAt || (user as any).profileData?.accessExpiresAt || null;
    const userDur = user.accessDurationType || (user as any).profileData?.accessDurationType || (userExp ? 'custom' : 'permanent');
    setAccessDurationType(userDur);
    setAccessExpiresAt(userExp || '');
    setSignatureImage(user.signatureImage || (user as any).profileData?.signatureImage || getPersonnelSignature(user) || '');
    setSignatureError('');
    const initScope = (user.personnelAccessScope === 'ALL' || user.canAccessAllPersonnel || user.role === 'Administrator') ? 'ALL' : 'ASSIGNED';
    setPersonnelAccessScope(initScope);
    setAssignedPersonnelIds(Array.isArray(user.assignedPersonnelIds) ? user.assignedPersonnelIds.map(String) : []);
    
    // Load PTW Qualification
    const userPtw: PtwQualificationData | undefined = user.ptwQualification || (user as any).profileData?.ptwQualification;
    if (userPtw) {
      setPtwCourseStatus(userPtw.courseStatus || 'not_passed');
      setPtwCourseResult(userPtw.courseResult || 'fail');
      setPtwCertificateNumber(userPtw.certificateNumber || '');
      setPtwIssueDate(userPtw.issueDate || '');
      setPtwValidityDuration(userPtw.validityDuration || '1y');
      setPtwExpiryDate(userPtw.expiryDate || (userPtw.issueDate ? calculatePtwExpiryDate(userPtw.issueDate, userPtw.validityDuration || '1y') : ''));
      setPtwMainPermits(userPtw.mainPermits || { hot: false, cold: false });
      setPtwResponsibilities(userPtw.responsibilities || { issuer: false, executor: false, areaSupervisor: false, safetyUnit: false });
      setPtwSupplementaryPermits(userPtw.supplementaryPermits || {
        excavation: false,
        confinedSpace: false,
        vehicleCrane: false,
        processIsolation: false,
        electricalIsolation: false,
        radiation: false,
      });
      setPtwLastUpdatedAt(userPtw.updatedAt || '');
    } else {
      setPtwCourseStatus('not_passed');
      setPtwCourseResult('fail');
      setPtwCertificateNumber('');
      setPtwIssueDate('');
      setPtwValidityDuration('1y');
      setPtwExpiryDate('');
      setPtwMainPermits({ hot: false, cold: false });
      setPtwResponsibilities({ issuer: false, executor: false, areaSupervisor: false, safetyUnit: false });
      setPtwSupplementaryPermits({
        excavation: false,
        confinedSpace: false,
        vehicleCrane: false,
        processIsolation: false,
        electricalIsolation: false,
        radiation: false,
      });
      setPtwLastUpdatedAt('');
    }

    const targetUid = (user as any).uid || user.id || user.username;
    if (targetUid) {
      apiDb.getUserPersonnelAssignments(String(targetUid)).then((res) => {
        if (res) {
          setPersonnelAccessScope(res.scope === 'ALL' ? 'ALL' : 'ASSIGNED');
          if (Array.isArray(res.assignedPersonnelIds)) {
            setAssignedPersonnelIds(res.assignedPersonnelIds.map((v: any) => String(v)));
          }
        }
      }).catch(() => {});
    }
    setIsUserModalOpen(true);
  };

  const isSameEditedUserRecord = (u: UserProfile, targetId: string | null, targetUid: string | null): boolean => {
    if (!targetId && !targetUid) return false;
    const uId = String(u.id || '').trim();
    const uUid = String((u as any).uid || '').trim();
    const tId = String(targetId || '').trim();
    const tUid = String(targetUid || '').trim();
    if (uId && (uId === tId || (tUid && uId === tUid))) return true;
    if (uUid && (uUid === tId || (tUid && uUid === tUid))) return true;
    if (editingOriginalUsername && u.username && u.username.trim().toLowerCase() === editingOriginalUsername.trim().toLowerCase()) return true;
    if (editingOriginalPersonnelNumber && u.personnelNumber && u.personnelNumber.trim() === editingOriginalPersonnelNumber.trim()) return true;
    return false;
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!username.trim() || !fullName.trim()) {
      setFormError(isFa ? 'لطفاً نام و نام خانوادگی و نام کاربری را وارد نمایید.' : 'Please enter both full name and username.');
      return;
    }

    const allUsers = [...users];
    let effectiveTargetId = editingUserId;
    let effectiveTargetUid = editingUserUid;

    // If in Create mode, check if a user with this username or personnelNumber already exists:
    // If they match by personnelNumber/nationalId/username, seamlessly bind to that existing user so edits & signature saves succeed!
    if (!effectiveTargetId) {
      const existingMatch = allUsers.find(
        u =>
          u.username.trim().toLowerCase() === username.trim().toLowerCase() ||
          (personnelNumber.trim() && u.personnelNumber && u.personnelNumber.trim() === personnelNumber.trim())
      );
      if (existingMatch) {
        effectiveTargetId = existingMatch.id;
        effectiveTargetUid = (existingMatch as any).uid || existingMatch.id;
        setEditingUserId(effectiveTargetId);
        setEditingUserUid(effectiveTargetUid);
        setEditingOriginalUsername(existingMatch.username || '');
        setEditingOriginalPersonnelNumber(existingMatch.personnelNumber || '');
      }
    }

    // Check duplicate username only against genuinely DIFFERENT users
    const duplicate = allUsers.find(
      u =>
        u.username.trim().toLowerCase() === username.trim().toLowerCase() &&
        !isSameEditedUserRecord(u, effectiveTargetId, effectiveTargetUid) &&
        !(personnelNumber.trim() && u.personnelNumber && u.personnelNumber.trim() === personnelNumber.trim())
    );
    if (duplicate) {
      setFormError(
        isFa
          ? `نام کاربری «${username.trim()}» متعلق به کاربر دیگری (${duplicate.fullName}) است. لطفاً نام کاربری متفاوتی انتخاب کنید.`
          : 'This username is already registered to another user!'
      );
      return;
    }

    if (!effectiveTargetId && !password.trim()) {
      setFormError(
        isFa
          ? 'برای ایجاد حساب کاربری جدید، تعیین رمز عبور الزامی است.'
          : 'A password is required when creating a new account.'
      );
      return;
    }

    if (!effectiveTargetId && password.trim().length < 8) {
      setFormError(
        isFa
          ? 'رمز عبور اولیه باید حداقل ۸ کاراکتر باشد و شامل حروف و ارقام باشد.'
          : 'The initial password must be at least 8 characters and contain letters and numbers.'
      );
      return;
    }

    // Show user confirmation modal before saving to database
    setSaveConfirmOpen(true);
  };

  const executeSaveUser = async () => {
    setFormError('');
    setIsSavingUser(true);

    const allUsers = [...users];
    const finalRole = isCustomRole ? (customRoleName.trim() || 'User') : role;

    // Determine final expiry date and account status
    const finalAccessExpiresAt = accessDurationType === 'permanent' ? null : (accessExpiresAt.trim() || null);
    const isCustomExpired = accessDurationType !== 'permanent' && finalAccessExpiresAt && (
      moment(finalAccessExpiresAt, finalAccessExpiresAt.includes('/') ? 'jYYYY/jMM/jDD' : undefined).isBefore(moment(), 'day')
    );
    const finalAccountStatus: UserStatus = isCustomExpired ? 'Expired' : accountStatus;

    try {
      let existingIndex = -1;
      if (editingUserId || editingUserUid) {
        existingIndex = allUsers.findIndex(u => isSameEditedUserRecord(u, editingUserId, editingUserUid));
      }
      if (existingIndex === -1) {
        existingIndex = allUsers.findIndex(
          u =>
            u.username.trim().toLowerCase() === username.trim().toLowerCase() ||
            (personnelNumber.trim() && u.personnelNumber && u.personnelNumber.trim() === personnelNumber.trim())
        );
      }

      if (editingUserId || existingIndex !== -1) {
        // Edit existing user
        const existing = existingIndex !== -1 ? allUsers[existingIndex] : null;
        const resolvedId = existing?.id || editingUserId || username.trim();
        const resolvedUid = (existing as any)?.uid || editingUserUid || resolvedId;

        const currentPtwPayload: PtwQualificationData = {
          courseStatus: ptwCourseStatus,
          courseResult: ptwCourseStatus === 'passed' ? ptwCourseResult : 'fail',
          certificateNumber: ptwCertificateNumber.trim(),
          issueDate: ptwCourseStatus === 'passed' && ptwCourseResult === 'success' ? ptwIssueDate.trim() : '',
          validityDuration: ptwCourseStatus === 'passed' && ptwCourseResult === 'success' ? ptwValidityDuration : '1y',
          expiryDate: ptwCourseStatus === 'passed' && ptwCourseResult === 'success' ? ptwExpiryDate.trim() : '',
          status: livePtwStatus,
          mainPermits: ptwMainPermits,
          responsibilities: ptwResponsibilities,
          supplementaryPermits: ptwSupplementaryPermits,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.fullName || currentUser?.username || 'system'
        };

        const updatePayload = {
          id: resolvedId,
          uid: resolvedUid,
          username: username.trim(),
          fullName: fullName.trim(),
          personnelNumber: personnelNumber.trim(),
          nationalId: nationalId.trim(),
          departmentIds: userDeptIds,
          jobTitle: jobTitle.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || existing?.email || `${username.trim()}@company.local`,
          employmentStatus,
          workShift,
          supervisor: supervisor.trim(),
          emergencyContact: emergencyContact.trim(),
          role: finalRole,
          accountStatus: finalAccountStatus,
          isActive: finalAccountStatus === 'Active',
          mfaEnabled,
          forcePasswordChange,
          sessionTimeoutMinutes: Math.max(1, Math.min(480, Number(sessionTimeoutMinutes) || 5)),
          accessExpiresAt: finalAccessExpiresAt,
          accessDurationType,
          signatureImage: signatureImage || '',
          ptwQualification: currentPtwPayload,
          personnelAccessScope: finalRole === 'Administrator' ? 'ALL' : personnelAccessScope,
          assignedPersonnelIds,
          password: password.trim() ? password.trim() : undefined,
          permissions: existing?.permissions || getDefaultPermissionsForRole(finalRole)
        };

        const savedResult = await apiDb.saveUser(updatePayload);
        if (!savedResult || (!savedResult.id && !savedResult.uid)) {
          setFormError(isFa ? 'خطا در ثبت تغییرات در دیتابیس سامانه. تغییرات ذخیره نشد.' : 'Failed to update user in database.');
          setSaveConfirmOpen(false);
          setIsSavingUser(false);
          return;
        }

        const updated: UserProfile & { uid?: string } = {
          ...(existing || ({} as UserProfile)),
          id: String(savedResult.id ?? resolvedId),
          uid: String(savedResult.uid ?? resolvedUid),
          username: username.trim(),
          fullName: fullName.trim(),
          personnelNumber: personnelNumber.trim(),
          nationalId: nationalId.trim(),
          departmentIds: userDeptIds,
          jobTitle: jobTitle.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || existing?.email || `${username.trim()}@company.local`,
          employmentStatus,
          workShift,
          supervisor: supervisor.trim(),
          emergencyContact: emergencyContact.trim(),
          role: finalRole,
          accountStatus: finalAccountStatus,
          mfaEnabled,
          forcePasswordChange,
          sessionTimeoutMinutes: Math.max(1, Math.min(480, Number(sessionTimeoutMinutes) || 5)),
          accessExpiresAt: finalAccessExpiresAt,
          accessDurationType,
          signatureImage: signatureImage || '',
          ptwQualification: currentPtwPayload,
          personnelAccessScope: savedResult.personnelAccessScope === 'ALL' || finalRole === 'Administrator' ? 'ALL' : personnelAccessScope,
          canAccessAllPersonnel: Boolean(savedResult.canAccessAllPersonnel ?? (personnelAccessScope === 'ALL' || finalRole === 'Administrator')),
          assignedPersonnelIds: Array.isArray(savedResult.assignedPersonnelIds) ? savedResult.assignedPersonnelIds.map(String) : assignedPersonnelIds,
          assignedPersonnelCodes: Array.isArray(savedResult.assignedPersonnelCodes) ? savedResult.assignedPersonnelCodes.map(String) : [],
          assignedPersonnel: Array.isArray(savedResult.assignedPersonnel) ? savedResult.assignedPersonnel : [],
          updatedDate: new Date().toLocaleDateString('fa-IR'),
          passwordHash: '',
          permissions: existing?.permissions || getDefaultPermissionsForRole(finalRole)
        };

        if (existingIndex !== -1) {
          allUsers[existingIndex] = updated;
        } else {
          allUsers.push(updated);
        }

        // If the edited user is the currently logged-in user, update currentUser in session/memory immediately
        if (
          currentUser &&
          (String(currentUser.id) === String(updated.id) ||
            String(currentUser.id) === String(updated.uid) ||
            String((currentUser as any).uid || '') === String(updated.uid) ||
            currentUser.username.toLowerCase() === updated.username.toLowerCase())
        ) {
          setCurrentUserInAuth({
            ...currentUser,
            ...updated,
            id: currentUser.id
          });
        }

        addAuditLog(currentUser.username, `ویرایش مشخصات پرسنل: ${updated.username} (${updated.fullName})`, 'موفقیت‌آمیز');
      } else {
        // Create new user: ID generated and returned by database backend
        const initialPermissions = getDefaultPermissionsForRole(finalRole);
        const rawPass = password.trim() || (personnelNumber.trim().length >= 6 ? personnelNumber.trim() : `${personnelNumber.trim() || 'hse'}123456`);
        
        const currentPtwPayload: PtwQualificationData = {
          courseStatus: ptwCourseStatus,
          courseResult: ptwCourseStatus === 'passed' ? ptwCourseResult : 'fail',
          certificateNumber: ptwCertificateNumber.trim(),
          issueDate: ptwCourseStatus === 'passed' && ptwCourseResult === 'success' ? ptwIssueDate.trim() : '',
          validityDuration: ptwCourseStatus === 'passed' && ptwCourseResult === 'success' ? ptwValidityDuration : '1y',
          expiryDate: ptwCourseStatus === 'passed' && ptwCourseResult === 'success' ? ptwExpiryDate.trim() : '',
          status: livePtwStatus,
          mainPermits: ptwMainPermits,
          responsibilities: ptwResponsibilities,
          supplementaryPermits: ptwSupplementaryPermits,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser?.fullName || currentUser?.username || 'system'
        };

        const createPayload = {
          username: username.trim(),
          fullName: fullName.trim(),
          personnelNumber: personnelNumber.trim(),
          nationalId: nationalId.trim(),
          departmentIds: userDeptIds,
          jobTitle: jobTitle.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || `${username.trim()}@company.local`,
          employmentStatus,
          workShift,
          supervisor: supervisor.trim(),
          emergencyContact: emergencyContact.trim(),
          role: finalRole,
          accountStatus: finalAccountStatus,
          isActive: finalAccountStatus === 'Active',
          mfaEnabled,
          forcePasswordChange,
          sessionTimeoutMinutes: Math.max(1, Math.min(480, Number(sessionTimeoutMinutes) || 5)),
          accessExpiresAt: finalAccessExpiresAt,
          accessDurationType,
          signatureImage: signatureImage || '',
          ptwQualification: currentPtwPayload,
          personnelAccessScope: finalRole === 'Administrator' ? 'ALL' : personnelAccessScope,
          assignedPersonnelIds,
          password: rawPass,
          permissions: initialPermissions
        };

        const savedResult = await apiDb.saveUser(createPayload);
        if (!savedResult || (!savedResult.id && !savedResult.uid)) {
          setFormError(isFa ? 'خطا در ایجاد کاربر در پایگاه داده سامانه. شناسه معتبر صادر نشد.' : 'Failed to generate valid user ID from backend.');
          setSaveConfirmOpen(false);
          setIsSavingUser(false);
          return;
        }

        const newUser: UserProfile & { uid?: string } = {
          id: String(savedResult.id ?? savedResult.uid),
          uid: String(savedResult.uid ?? savedResult.id),
          username: username.trim(),
          fullName: fullName.trim(),
          personnelNumber: personnelNumber.trim(),
          nationalId: nationalId.trim(),
          departmentIds: userDeptIds,
          jobTitle: jobTitle.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim() || `${username.trim()}@company.local`,
          employmentStatus,
          workShift,
          supervisor: supervisor.trim(),
          emergencyContact: emergencyContact.trim(),
          role: finalRole,
          accountStatus: finalAccountStatus,
          createdDate: new Date().toLocaleDateString('fa-IR'),
          updatedDate: new Date().toLocaleDateString('fa-IR'),
          passwordHash: '',
          failedAttempts: 0,
          passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          forcePasswordChange,
          mfaEnabled,
          sessionTimeoutMinutes: Math.max(1, Math.min(480, Number(sessionTimeoutMinutes) || 5)),
          accessExpiresAt: finalAccessExpiresAt,
          accessDurationType,
          signatureImage: signatureImage || '',
          ptwQualification: currentPtwPayload,
          personnelAccessScope: savedResult.personnelAccessScope === 'ALL' || finalRole === 'Administrator' ? 'ALL' : personnelAccessScope,
          canAccessAllPersonnel: Boolean(savedResult.canAccessAllPersonnel ?? (personnelAccessScope === 'ALL' || finalRole === 'Administrator')),
          assignedPersonnelIds: Array.isArray(savedResult.assignedPersonnelIds) ? savedResult.assignedPersonnelIds.map(String) : assignedPersonnelIds,
          assignedPersonnelCodes: Array.isArray(savedResult.assignedPersonnelCodes) ? savedResult.assignedPersonnelCodes.map(String) : [],
          assignedPersonnel: Array.isArray(savedResult.assignedPersonnel) ? savedResult.assignedPersonnel : [],
          permissions: initialPermissions
        };
        allUsers.push(newUser);
        addAuditLog(currentUser.username, `ایجاد کاربر جدید: ${newUser.username} (${newUser.fullName})`, 'موفقیت‌آمیز', {
          actionType: 'CREATE',
          module: 'کاربران',
          page: 'مدیریت پرسنل',
          recordType: 'UserProfile',
          recordId: newUser.id,
          changes: [
            { field: 'username', oldValue: null, newValue: newUser.username },
            { field: 'role', oldValue: null, newValue: newUser.role },
            { field: 'accessExpiresAt', oldValue: null, newValue: finalAccessExpiresAt || 'دائمی' }
          ]
        });
      }

      // Sync signatureImage and personnel record to in-memory personnel list & central database
      const currentPersonnel = getComplexPersonnelList();
      const pCode = personnelNumber.trim();
      const nCode = nationalId.trim();
      if (pCode || nCode) {
        let foundInPersonnel = false;
        const updatedPersonnel = currentPersonnel.map(p => {
          if (
            (pCode && (p.personnelCode === pCode || p.effectiveCode === pCode)) ||
            (nCode && p.nationalCode === nCode)
          ) {
            foundInPersonnel = true;
            return {
              ...p,
              fullName: fullName.trim() || p.fullName,
              jobTitle: jobTitle.trim() || p.jobTitle,
              phone: phoneNumber.trim() || p.phone,
              signatureImage: signatureImage || ''
            };
          }
          return p;
        });

        if (!foundInPersonnel && pCode) {
          const nameParts = fullName.trim().split(/\s+/);
          updatedPersonnel.unshift({
            id: pCode,
            firstName: nameParts[0] || fullName.trim(),
            lastName: nameParts.slice(1).join(' ') || '',
            fullName: fullName.trim(),
            personnelCode: pCode,
            effectiveCode: pCode,
            nationalCode: nCode || pCode,
            workplace: '',
            unit: '',
            jobTitle: jobTitle.trim(),
            phone: phoneNumber.trim(),
            signatureImage: signatureImage || ''
          } as any);
        }
        setInMemoryPersonnelList(updatedPersonnel);
      }

      apiDb.invalidateCache('users', 'personnel', 'sync:full');
      saveUsers(allUsers);
      setSaveConfirmOpen(false);
      setIsUserModalOpen(false);
      setSaveSuccessMessage(
        isFa
          ? `تغییرات مشخصات و نمونه امضای پرسنل «${fullName.trim()}» با موفقیت در پایگاه داده اصلی ذخیره و اعمال شد.`
          : `Personnel changes for "${fullName.trim()}" saved successfully.`
      );
      setTimeout(() => setSaveSuccessMessage(null), 5000);
      await loadData();
      window.dispatchEvent(new Event('app_data_mutated'));
    } catch (err: any) {
      setFormError(err?.message || (isFa ? 'خطا در برقراری ارتباط با پایگاه داده سامانه' : 'Database connection error'));
      setSaveConfirmOpen(false);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (id === currentUser.id || (currentUser as any).uid === id) {
      setSaveSuccessMessage(isFa ? 'شما نمی‌توانید حساب کاربری فعال خودتان را حذف کنید!' : 'You cannot delete your own logged-in account!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      return;
    }
    setDeleteConfirm({ type: 'user', id, name });
  };

  const handleResetAttempts = (user: UserProfile) => {
    const updated = users.map(u => {
      if (u.id === user.id) {
        return { ...u, failedAttempts: 0, accountStatus: 'Active' as UserStatus };
      }
      return u;
    });
    addAuditLog(currentUser.username, `بازنشانی تعداد خطاهای ورود و بازکردن حساب قفل شده: ${user.username}`, 'موفقیت‌آمیز');
    saveUsers(updated);
    setSaveSuccessMessage(isFa ? `حساب کاربری ${user.username} با موفقیت فعال و قفل آن باز شد.` : `Account ${user.username} is now Active and unlocked.`);
    setTimeout(() => setSaveSuccessMessage(null), 4000);
    loadData();
  };

  // --- DYNAMIC PERMISSIONS GRID OPERATIONS ---
  const handleTogglePermission = async (group: PermissionGroup, action: keyof PermissionActions) => {
    if (currentUser.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر ارشد (Administrator) مجاز به ویرایش دسترسی‌های کاربران است.' : 'Only the System Administrator is authorized to modify user permissions.');
      return;
    }
    if (!selectedUserForPerms) return;
    if (selectedUserForPerms.role === 'Administrator') {
      alert(isFa 
        ? 'کاربر مدیر ارشد (Administrator) به صورت پیش‌فرض به تمام بخش‌ها دسترسی نامحدود دارد و نیازی به تغییر دستی مجوزهای آن نیست.' 
        : 'Administrator has absolute full access by default. Modifying permissions manually is not required.');
      return;
    }

    let modifiedUser: UserProfile | null = null;
    const updatedUsers = users.map(u => {
      if (u.id === selectedUserForPerms.id) {
        const uPerms = { ...u.permissions };
        uPerms[group] = {
          ...uPerms[group],
          [action]: !uPerms[group][action]
        };
        modifiedUser = { ...u, permissions: uPerms };
        return modifiedUser;
      }
      return u;
    });

    saveUsers(updatedUsers);
    if (modifiedUser) {
      apiDb.saveUser(modifiedUser).catch(console.error);
    }
    addAuditLog(currentUser.username, `تغییر دسترسی کاربر ${selectedUserForPerms.username}: ماژول ${group} -> اقدام ${action}`, 'مجوز ویرایش شد');
  };

  const handleGrantFullAccess = async () => {
    if (currentUser.role !== 'Administrator') {
      alert(isFa ? 'تنها مدیر ارشد (Administrator) مجاز به ویرایش دسترسی‌های کاربران است.' : 'Only the System Administrator is authorized to modify user permissions.');
      return;
    }
    if (!selectedUserForPerms) return;
    let modifiedUser: UserProfile | null = null;
    const updatedUsers = users.map(u => {
      if (u.id === selectedUserForPerms.id) {
        modifiedUser = { ...u, permissions: createPermissionsSet(true) };
        return modifiedUser;
      }
      return u;
    });
    saveUsers(updatedUsers);
    if (modifiedUser) {
      apiDb.saveUser(modifiedUser).catch(console.error);
    }
    addAuditLog(currentUser.username, `اعطای دسترسی کامل به کاربر: ${selectedUserForPerms.username}`, 'موفقیت‌آمیز');
  };

  const handleRevokeAllAccess = async () => {
    if (!isUserAdmin(currentUser)) {
      alert(isFa ? 'تنها مدیر ارشد (Administrator) مجاز به ویرایش دسترسی‌های کاربران است.' : 'Only the System Administrator is authorized to modify user permissions.');
      return;
    }
    if (!selectedUserForPerms) return;
    let modifiedUser: UserProfile | null = null;
    const updatedUsers = users.map(u => {
      if (u.id === selectedUserForPerms.id) {
        modifiedUser = { ...u, permissions: createPermissionsSet(false) };
        return modifiedUser;
      }
      return u;
    });
    saveUsers(updatedUsers);
    if (modifiedUser) {
      apiDb.saveUser(modifiedUser).catch(console.error);
    }
    addAuditLog(currentUser.username, `لغو کامل دسترسی‌های کاربر: ${selectedUserForPerms.username}`, 'موفقیت‌آمیز');
  };

  const handleUpdateUserPermissions = async (userId: string, newPermissions: Record<PermissionGroup, PermissionActions>) => {
    let modifiedUser: UserProfile | null = null;
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        modifiedUser = { ...u, permissions: newPermissions };
        return modifiedUser;
      }
      return u;
    });
    saveUsers(updatedUsers);
    if (modifiedUser) {
      apiDb.saveUser(modifiedUser).catch(console.error);
    }
    const targetUser = users.find(u => u.id === userId);
    addAuditLog(currentUser.username, `به‌روزرسانی ماتریس مجوزهای کاربر: ${targetUser?.username || userId}`, 'موفقیت‌آمیز');
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="user-management-system">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            {isFa ? 'مدیریت کاربران و سطوح دسترسی (RBAC)' : 'Enterprise User & Access Control Panel'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isFa 
              ? 'پیکربندی هویت‌های صنعتی، سطوح دسترسی و ماتریس مجوزهای پرسنل و کاربران سامانه' 
              : 'Configure plant personnel directories and visual permission matrices.'}
          </p>
        </div>
        
        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl">
          <button 
            onClick={() => setActiveSubTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {isFa ? 'پرسنل سایت' : 'Staff'}
          </button>
          <button 
            onClick={() => setActiveSubTab('permissions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeSubTab === 'permissions' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'}`}
          >
            {isFa ? 'ماتریس مجوزها' : 'Permissions Grid'}
          </button>
        </div>
      </div>

      {/* Save Confirmation Toast Banner */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-black">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMessage(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* --- SUBTAB: USERS --- */}
      {activeSubTab === 'users' && (
        <SitePersonnelTab
          users={users}
          departments={departments}
          currentUser={currentUser}
          isFa={isFa}
          onOpenCreateUser={handleOpenCreateUser}
          onOpenEditUser={handleOpenEditUser}
          onDeleteUser={(id, name) => setDeleteConfirm({ type: 'user', id, name })}
          onResetAttempts={handleResetAttempts}
          onSelectUserForPermissions={(user) => {
            setSelectedUserForPerms(user);
            setActiveSubTab('permissions');
          }}
          onOpenManagePersonnelAssignments={(user) => setAssignmentModalUser(user)}
        />
      )}

      {/* --- SUBTAB: PERMISSIONS MATRIX GRID --- */}
      {activeSubTab === 'permissions' && (
        <PermissionsMatrixTab
          users={users}
          currentUser={currentUser}
          selectedUser={selectedUserForPerms}
          isFa={isFa}
          onSelectUser={(user) => setSelectedUserForPerms(user)}
          onUpdateUserPermissions={handleUpdateUserPermissions}
          onDeleteUser={(id, name) => setDeleteConfirm({ type: 'user', id, name })}
        />
      )}

      {/* --- MODAL: CREATE/EDIT USER PROFILE (FULLSCREEN) --- */}
      {isUserModalOpen && createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[999999] bg-slate-50 dark:bg-slate-800/50 flex flex-col h-screen w-screen overflow-hidden m-0 p-0 border-0 rtl font-sans" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
          
          {/* Sticky Header */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-black text-lg shadow-2xs">
                +
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900">
                    {editingUserId ? (isFa ? 'ویرایش اطلاعات پرسنل (استاندارد HSE)' : 'Edit Personnel Profile') : (isFa ? 'فرم ثبت مشخصات پرسنل جدید (استاندارد HSE)' : 'Register New Employee')}
                  </h2>
                  <span className="text-xs font-black font-mono text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200">
                    {editingUserId ? `ID-${editingUserId}` : 'EMP-NEW'}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 hidden sm:block">
                  {isFa ? 'مدیریت و ثبت سوابق هویت، دسترسی، دپارتمان و شرایط کاری پرسنل مجتمع' : 'Personnel management and registration form'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 dark:text-slate-400 font-extrabold text-xs rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-800 hover:border-rose-200 transition cursor-pointer"
            >
              <span>{isFa ? 'بستن فرم' : 'Close'}</span>
              <span className="text-sm font-black">✕</span>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSaveUser} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-5xl mx-auto w-full">
              
              {/* Section 1 Banner */}
              <div className="flex items-center justify-center gap-2 p-3 bg-indigo-50/80 rounded-2xl border border-indigo-100 text-indigo-900 font-bold text-xs sm:text-sm">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span>{isFa ? '۱. اطلاعات هویت پرسنلی و دسترسی ورود به سامانه' : '1. Personnel Credentials & Identity'}</span>
              </div>

              {formError && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs sm:text-sm font-black flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormError('')}
                    className="px-2 py-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Grid 1: Identity & Credentials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs">
                <div className="sm:col-span-2 lg:col-span-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <CentralPersonnelSelector
                    label={isFa ? 'فراخوانی خودکار مشخصات از «اطلاعات پرسنل» (جستجو با کد پرسنلی، نام و نام خانوادگی یا کد ملی)' : 'Auto-fill from Central Personnel (Search by Code, Name, or National ID)'}
                    value={fullName ? `${fullName} (${personnelNumber || ''})` : ''}
                    selectedPersonnelCode={personnelNumber || ''}
                    isFa={isFa}
                    onSelect={(matched) => {
                      if (!matched) return;
                      if (matched.fullName) setFullName(matched.fullName);
                      const pCode = matched.effectiveCode || matched.personnelCode || '';
                      if (pCode) setPersonnelNumber(pCode);
                      if (matched.nationalCode) setNationalId(matched.nationalCode);
                      if (matched.jobTitle) setJobTitle(matched.jobTitle);
                      if (matched.phone) setPhoneNumber(matched.phone);
                      if (matched.supervisor) setSupervisor(matched.supervisor);
                      if (matched.signatureImage && !signatureImage) setSignatureImage(matched.signatureImage);
                      const personId = String(matched.id || pCode);
                      if (personId && !assignedPersonnelIds.includes(personId)) {
                        setAssignedPersonnelIds(prev => [...prev, personId]);
                      }
                      const pUnit = (matched.unit || matched.department || '').trim();
                      if (pUnit) {
                        const deptMatch = departments.find(d => d.name.trim() === pUnit);
                        if (deptMatch && !userDeptIds.includes(deptMatch.id)) {
                          setUserDeptIds(prev => [...prev, deptMatch.id]);
                        }
                      }
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'نام و نام خانوادگی کامل' : 'Full Name'}: *</label>
                  <input 
                    type="text" 
                    required 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={isFa ? "نام و نام خانوادگی" : "Full Name"}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 text-right transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'شماره پرسنلی' : 'Personnel No.'}: *</label>
                  <input 
                    type="text" 
                    required 
                    value={personnelNumber} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setPersonnelNumber(val);
                      const matched = findPersonnelByCode(val);
                      if (matched && val.trim() !== '') {
                        if (matched.fullName) setFullName(matched.fullName);
                        if (matched.nationalCode) setNationalId(matched.nationalCode);
                        if (matched.jobTitle) setJobTitle(matched.jobTitle);
                        if (matched.phone) setPhoneNumber(matched.phone);
                        if (matched.signatureImage && !signatureImage) setSignatureImage(matched.signatureImage);
                      }
                      const matchedUser = users.find(u => u.personnelNumber && u.personnelNumber.trim() === val.trim());
                      if (matchedUser && !editingUserId) {
                        if (!username) setUsername(matchedUser.username);
                        if (!fullName && matchedUser.fullName) setFullName(matchedUser.fullName);
                        if (!nationalId && matchedUser.nationalId) setNationalId(matchedUser.nationalId);
                        if (!jobTitle && matchedUser.jobTitle) setJobTitle(matchedUser.jobTitle);
                        if (!signatureImage && matchedUser.signatureImage) setSignatureImage(matchedUser.signatureImage);
                      }
                    }}
                    placeholder={isFa ? "مثال: 1024" : "1024"}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 text-right transition font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'کد ملی (کارت ملی)' : 'National ID'}: *</label>
                  <input 
                    type="text" 
                    required 
                    value={nationalId} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setNationalId(val);
                      const matched = findPersonnelByCode(val);
                      if (matched && val.trim().length >= 8) {
                        if (matched.fullName) setFullName(matched.fullName);
                        if (matched.effectiveCode || matched.personnelCode) setPersonnelNumber(matched.effectiveCode || matched.personnelCode);
                        if (matched.jobTitle) setJobTitle(matched.jobTitle);
                        if (matched.phone) setPhoneNumber(matched.phone);
                        if (matched.supervisor) setSupervisor(matched.supervisor);
                        if (matched.signatureImage && !signatureImage) setSignatureImage(matched.signatureImage);
                      }
                    }}
                    placeholder={isFa ? "مثال: 0012345678" : "0012345678"}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-right transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'عنوان شغل سازمانی (از ساختار سازمانی)' : 'Job Position'}: *</label>
                  <input 
                    type="text" 
                    list="user-mgmt-job-titles"
                    required 
                    value={jobTitle} 
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={isFa ? "انتخاب یا درج سمت از ساختار سازمانی..." : "Select Job Position"}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 text-right transition"
                  />
                  <datalist id="user-mgmt-job-titles">
                    {getJobTitles().map(j => (
                      <option key={j} value={j} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'نام کاربری (مستعار ورود)' : 'Username'}: *</label>
                  <input 
                    type="text" 
                    required 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 text-right transition font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">
                    {editingUserId ? (isFa ? 'رمز عبور جدید (اختیاری)' : 'New Password (optional)') : (isFa ? 'رمز عبور اولیه (الزامی)' : 'Initial Password (required)')}:
                  </label>
                  <input 
                    type="password" 
                    autoComplete={editingUserId ? "new-password" : "new-password"}
                    placeholder={isFa ? "حداقل ۸ کاراکتر، شامل حروف و ارقام" : "At least 8 characters, letters and numbers"}
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 text-right transition"
                  />
                </div>
              </div>

              {/* Section 2 Banner */}
              <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-emerald-900 font-bold text-xs sm:text-sm pt-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>{isFa ? '۲. اطلاعات تماس، سرپرستی و شرایط کاری' : '2. Contact & Employment Conditions'}</span>
              </div>

              {/* Grid 2: Contact & Work Shift */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'شماره تلفن همراه' : 'Phone No.'}: *</label>
                  <input 
                    type="text" 
                    required 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="09123456789"
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-right transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'آدرس ایمیل' : 'Email Address'}: *</label>
                  <input 
                    type="email" 
                    required 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@company.com"
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-right transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'سرپرست مستقیم' : 'Supervisor'}:</label>
                  <input 
                    type="text" 
                    value={supervisor} 
                    onChange={(e) => setSupervisor(e.target.value)}
                    placeholder={isFa ? "نام سرپرست واحد" : "Supervisor"}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 text-right transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'تماس اضطراری (بستگان)' : 'Emergency Contact'}:</label>
                  <input 
                    type="text" 
                    value={emergencyContact} 
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder={isFa ? "مثال: همسر - 0912..." : "Emergency contact"}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 text-right transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'نوع استخدام' : 'Employment Status'}:</label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer text-right"
                  >
                    <option value="رسمی (Full-Time)">{isFa ? 'رسمی (Full-Time)' : 'Full-Time'}</option>
                    <option value="قراردادی (Contract)">{isFa ? 'قراردادی (Contract)' : 'Contract'}</option>
                    <option value="پیمانکار (Third-party)">{isFa ? 'پیمانکار (Third-party)' : 'Third-party'}</option>
                    <option value="روزمزد (Part-Time)">{isFa ? 'روزمزد (Part-Time)' : 'Part-Time'}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'شیفت کاری' : 'Work Shift'}:</label>
                  <select
                    value={workShift}
                    onChange={(e) => setWorkShift(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer text-right"
                  >
                    <option value="اداری ثابت (Morning)">{isFa ? 'اداری ثابت (Morning)' : 'Morning'}</option>
                    <option value="نوبت‌کاری چرخشی (Rotating)">{isFa ? 'نوبت‌کاری چرخشی (Rotating)' : 'Rotating Shift'}</option>
                    <option value="شیفت شب (Night)">{isFa ? 'شیفت شب (Night)' : 'Night Shift'}</option>
                  </select>
                </div>
              </div>

              {/* Section 3 Banner */}
              <div className="flex items-center justify-center gap-2 p-3 bg-amber-50/80 rounded-2xl border border-blue-100 text-amber-950 font-bold text-xs sm:text-sm pt-2">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>{isFa ? '۳. سطح دسترسی سامانه، دپارتمان‌ها و تنظیمات امنیت' : '3. Role, Department Access & Security Settings'}</span>
              </div>

              {/* Grid 3: System Role & Account Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'نقش امنیتی (System Role)' : 'System Role'}:</label>
                  <select
                    value={isCustomRole ? 'custom' : role}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustomRole(true);
                      } else {
                        setIsCustomRole(false);
                        setRole(e.target.value);
                      }
                    }}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer text-right"
                  >
                    <option value="Administrator">Administrator (مدیر ارشد سیستم)</option>
                    <option value="مدیر مجتمع">{isFa ? 'مدیر مجتمع (Complex Director)' : 'Complex Director'}</option>
                    <option value="مدیر کل HSE">{isFa ? 'مدیر کل HSE (HSE General Manager)' : 'HSE General Manager'}</option>
                    <option value="مدیری/مسئول/سرپرست واحد">{isFa ? 'مدیری/مسئول/سرپرست واحد (Unit Manager / Supervisor)' : 'Unit Manager / Supervisor'}</option>
                    <option value="افسر ایمنی">{isFa ? 'افسر ایمنی (Safety Officer)' : 'Safety Officer'}</option>
                    <option value="افسر آتش‌نشان">{isFa ? 'افسر آتش‌نشان (Fire Officer)' : 'Fire Officer'}</option>
                    <option value="پزشک و بهداشت کار">{isFa ? 'پزشک و بهداشت کار (Health & Medical)' : 'Health & Medical Officer'}</option>
                    <option value="کارشناس تغذیه">{isFa ? 'کارشناس تغذیه (Nutrition Specialist)' : 'Nutrition Specialist'}</option>
                    <option value="ناظر و ممیز">{isFa ? 'ناظر و ممیز (Auditor & Inspector)' : 'Auditor & Inspector'}</option>
                    <option value="پرسنل مجتمع">{isFa ? 'پرسنل مجتمع (Complex Staff)' : 'Complex Staff'}</option>
                    <option value="Contractor">{isFa ? 'پیمانکار (Contractor)' : 'Contractor'}</option>
                    <option value="User">{isFa ? 'کاربر عادی (User)' : 'Standard User'}</option>
                    <option value="custom">★ {isFa ? 'سایر / تعریف نقش اختصاصی (Custom Role)...' : 'Custom Dedicated Role...'}</option>
                  </select>

                  {isCustomRole && (
                    <div className="mt-2 animate-in fade-in space-y-1">
                      <label className="text-[11px] text-amber-700 dark:text-amber-400 font-bold block text-right">
                        {isFa ? 'عنوان نقش اختصاصی کاربر:' : 'Custom Role Title:'}
                      </label>
                      <input
                        type="text"
                        value={customRoleName}
                        onChange={(e) => setCustomRoleName(e.target.value)}
                        placeholder={isFa ? 'عنوان نقش اختصاصی (مثلاً: سرپرست کارگاه، کارشناس محیط زیست)...' : 'Enter custom role title...'}
                        className="w-full bg-amber-50/40 dark:bg-slate-900 border border-amber-400 focus:border-amber-600 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 text-right"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">{isFa ? 'وضعیت حساب کاربری' : 'Account Status'}:</label>
                  <select
                    value={accountStatus}
                    onChange={(e) => setAccountStatus(e.target.value as UserStatus)}
                    className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-rose-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer text-right"
                  >
                    <option value="Active">{isFa ? 'فعال (Active)' : 'Active'}</option>
                    <option value="Inactive">{isFa ? 'غیرفعال (Inactive)' : 'Inactive'}</option>
                    <option value="Suspended">{isFa ? 'معلق (Suspended)' : 'Suspended'}</option>
                    <option value="Locked">{isFa ? 'قفل شده (Locked)' : 'Locked'}</option>
                    <option value="Expired">{isFa ? 'منقضی شده (Expired)' : 'Expired'}</option>
                  </select>
                </div>
              </div>

              {/* Access Validity & Expiration Duration Card */}
              <div className="p-5 bg-gradient-to-br from-amber-500/5 via-slate-50 to-amber-500/10 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-3xl border-2 border-amber-200/80 dark:border-amber-900/60 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <label className="text-xs font-black text-slate-800 dark:text-slate-100 block text-right">
                      {isFa ? 'مدت اعتبار و تاریخ انقضای دسترسی به سامانه (Access Expiration):' : 'Access Validity Duration & Expiry Date:'}
                    </label>
                  </div>
                  <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                    {accessDurationType === 'permanent' 
                      ? (isFa ? 'دسترسی دائم / بدون محدودیت زمانی' : 'Permanent Unlimited Access')
                      : (isFa ? `انقضا: ${accessExpiresAt || 'تعیین نشده'}` : `Expires: ${accessExpiresAt}`)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Duration Presets */}
                  <div className="space-y-2">
                    <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">
                      {isFa ? 'مدت زمان و بازه دسترسی:' : 'Access Duration Period:'}
                    </label>
                    <select
                      value={accessDurationType}
                      onChange={(e) => handleDurationTypeChange(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer text-right"
                    >
                      <option value="permanent">{isFa ? '∞ نامحدود و دائمی (پرسنل رسمی و بلندمدت)' : 'Permanent / Unlimited (Full-Time Staff)'}</option>
                      <option value="1month">{isFa ? '⏱ ۱ ماهه (پروژه‌ای / بازرسی فوری)' : '1 Month (Short-term Project)'}</option>
                      <option value="3months">{isFa ? '⏱ ۳ ماهه (پیمانکار فصلی / کارآموز)' : '3 Months (Seasonal Contractor)'}</option>
                      <option value="6months">{isFa ? '⏱ ۶ ماهه (قرارداد نیم‌سال)' : '6 Months (Half-year Contract)'}</option>
                      <option value="1year">{isFa ? '⏱ ۱ ساله (قرارداد سالانه)' : '1 Year (Annual Contract)'}</option>
                      <option value="2years">{isFa ? '⏱ ۲ ساله (پروژه‌های کلان سازمانی)' : '2 Years (Major Projects)'}</option>
                      <option value="custom">{isFa ? '📅 تاریخ سفارشی و دلخواه (شمسی)...' : 'Custom Expiry Date...'}</option>
                    </select>

                    {/* Fast Preset Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        { id: 'permanent', label: isFa ? '∞ دائمی' : 'Permanent' },
                        { id: '1month', label: isFa ? '۱ ماهه' : '1 Month' },
                        { id: '3months', label: isFa ? '۳ ماهه' : '3 Months' },
                        { id: '6months', label: isFa ? '۶ ماهه' : '6 Months' },
                        { id: '1year', label: isFa ? '۱ ساله' : '1 Year' },
                        { id: '2years', label: isFa ? '۲ ساله' : '2 Years' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleDurationTypeChange(item.id as any)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                            accessDurationType === item.id
                              ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exact Expiration Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right flex items-center justify-between">
                      <span>{isFa ? 'تاریخ دقیق پایان اعتبار (شمسی):' : 'Exact Expiration Date (Jalali):'}</span>
                      {accessDurationType !== 'permanent' && accessExpiresAt && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                          {isFa ? 'محاسبه خودکار' : 'Auto-calculated'}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={accessDurationType === 'permanent'}
                        placeholder={accessDurationType === 'permanent' ? (isFa ? 'نامحدود (دائمی)' : 'Unlimited (Permanent)') : '۱۴۰۵/۱۲/۲۹'}
                        value={accessDurationType === 'permanent' ? '' : accessExpiresAt}
                        onChange={(e) => {
                          setAccessExpiresAt(e.target.value);
                          setAccessDurationType('custom');
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-800/60 disabled:text-slate-400 font-mono text-right transition"
                      />
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    </div>
                    {accessDurationType !== 'permanent' && accessExpiresAt && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 text-right">
                        {isFa 
                          ? `💡 دسترسی این کاربر تا پایان روز ${accessExpiresAt} معتبر خواهد بود.` 
                          : `💡 User access will be valid until the end of ${accessExpiresAt}.`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    {isFa ? (
                      <span>
                        <strong>ضوابط امنیتی انقضا:</strong> پس از فرارسیدن تاریخ تعیین‌شده، ورود کاربر به سامانه‌های HSE مسدود گردیده و وضعیت به <strong>«منقضی شده (Expired)»</strong> تغییر می‌یابد تا زمانی که توسط مدیر ارشد تمدید گردد.
                      </span>
                    ) : (
                      <span>
                        <strong>Security Policy:</strong> After the designated date, login will be automatically blocked with status set to <strong>Expired</strong> until renewed by an Administrator.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Department Multi-Select checkboxes */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-100 block text-right">
                      {isFa ? 'دپارتمان‌های تابعه پرسنل:' : 'Belonging Departments:'}
                    </label>
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      {isFa ? `استخراج خودکار (${departments.length} دپارتمان/واحد)` : `Auto-Extracted (${departments.length})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setUserDeptIds(departments.map(d => d.id))}
                      className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer hover:underline"
                    >
                      {isFa ? 'انتخاب همه' : 'Select All'}
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setUserDeptIds([])}
                      className="text-rose-500 hover:text-rose-600 cursor-pointer hover:underline"
                    >
                      {isFa ? 'حذف همه' : 'Clear All'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 max-h-48 overflow-y-auto p-1">
                  {departments.map(d => (
                    <label key={d.id} className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-100 cursor-pointer font-bold select-none bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 transition shadow-2xs">
                      <input 
                        type="checkbox"
                        checked={userDeptIds.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) setUserDeptIds([...userDeptIds, d.id]);
                          else setUserDeptIds(userDeptIds.filter(id => id !== d.id));
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span>{d?.name ? d.name.split(' (')[0] : (d?.name || '')}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
                  {isFa ? '💡 تمامی واحدها، دپارتمان‌ها و چارت‌های جدید ایجادشده در سیستم به صورت خودکار به این بخش افزوده می‌شوند.' : '💡 All newly created units, departments, and org chart nodes are automatically included here.'}
                </p>
              </div>

              {/* Section: Related / Assigned Personnel (اشخاص مرتبط) */}
              {isUserAdmin(currentUser) && (
                <UserPersonnelAssignmentSection
                  language={language}
                  scope={personnelAccessScope}
                  onChangeScope={setPersonnelAccessScope}
                  selectedPersonnelIds={assignedPersonnelIds}
                  onChangeSelectedPersonnelIds={setAssignedPersonnelIds}
                  canGrantAllScope={isUserAdmin(currentUser)}
                  userPersonnelNumber={personnelNumber}
                  userFullName={fullName}
                  userRole={isCustomRole ? customRoleName : role}
                />
              )}

              {/* Official Personnel Signature Sample (PNG / JPEG) */}
              <div className="p-5 bg-gradient-to-br from-indigo-500/5 via-white to-emerald-500/5 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-3xl border-2 border-indigo-200/80 dark:border-indigo-900/60 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                      <PenTool className="w-4 h-4" />
                    </div>
                    <div>
                      <label className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 block text-right">
                        {isFa ? 'نمونه امضای رسمی پرسنل (فرمت PNG یا JPEG) - جهت امضا و ارجاع اسناد' : 'Official Personnel Signature Sample (PNG or JPEG)'}
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {isFa
                          ? 'این نمونه امضا در هنگام امضای مجوزهای کار (پرمیت)، ارزیابی ریسک و ارجاع اسناد کارتابل به‌صورت خودکار بارگذاری و استفاده می‌شود.'
                          : 'Automatically used when signing work permits, risk assessments, and document referrals.'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1 border ${
                    signatureImage
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}>
                    {signatureImage ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isFa ? 'نمونه امضا ثبت شده است' : 'Signature Registered'}</span>
                      </>
                    ) : (
                      <span>{isFa ? 'بدون نمونه امضا' : 'No Signature Uploaded'}</span>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Upload Control Box */}
                  <div className="md:col-span-7 space-y-2.5">
                    <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-indigo-300 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl bg-indigo-50/40 dark:bg-slate-800/40 hover:bg-indigo-50/80 dark:hover:bg-slate-800/70 transition cursor-pointer group text-center">
                      <Upload className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-1.5 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                        {signatureImage
                          ? (isFa ? 'تغییر یا جایگزینی فایل نمونه امضا (PNG / JPEG)' : 'Replace Signature Image (PNG / JPEG)')
                          : (isFa ? 'انتخاب و بارگذاری تصویر نمونه امضا (PNG / JPEG)' : 'Upload Signature Sample Image (PNG / JPEG)')}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        {isFa
                          ? 'فرمت‌های مجاز: PNG (ترجیحاً پس‌زمینه شفاف) یا JPG/JPEG • حداکثر ۵ مگابایت'
                          : 'Allowed formats: PNG (transparent preferred) or JPG/JPEG • Max 5MB'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
                        onChange={handleSignatureFileChange}
                        className="hidden"
                      />
                    </label>

                    {signatureError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                        <span>{signatureError}</span>
                      </div>
                    )}
                  </div>

                  {/* Signature Preview Box */}
                  <div className="md:col-span-5">
                    <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col items-center justify-center min-h-[128px] relative shadow-inner">
                      <span className="absolute top-2 right-2.5 text-[10px] font-bold text-slate-400">
                        {isFa ? 'پیش‌نمایش امضای دیجیتال:' : 'Signature Preview:'}
                      </span>
                      {signatureImage ? (
                        <>
                          <img
                            src={signatureImage}
                            alt="Personnel Signature Sample"
                            className="max-h-20 max-w-full object-contain my-3 mix-blend-multiply dark:mix-blend-normal"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSignatureImage('');
                              setSignatureError('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[10px] font-black transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{isFa ? 'حذف نمونه امضا' : 'Remove Signature'}</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-center py-5 text-slate-400 dark:text-slate-600">
                          <PenTool className="w-6 h-6 mx-auto mb-1 opacity-40" />
                          <p className="text-[11px] font-bold">
                            {isFa ? 'هنوز نمونه امضایی بارگذاری نشده است' : 'No signature sample uploaded yet'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Force password banner & Session Timeout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
                  <label className="text-xs text-slate-700 dark:text-slate-200 font-bold block text-right">
                    {isFa ? 'خروج خودکار به دلیل عدم فعالیت (Session Timeout) - دقیقه:' : 'Inactivity Logout Timeout (Minutes):'}
                  </label>
                  <div className="relative">
                    <input 
                      type="number"
                      min="1"
                      max="480"
                      value={sessionTimeoutMinutes}
                      onChange={(e) => setSessionTimeoutMinutes(Math.max(1, Math.min(480, parseInt(e.target.value) || 1)))}
                      className="w-full bg-slate-50/80 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 focus:bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-left transition"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-slate-400 pointer-events-none">
                      {isFa ? 'دقیقه' : 'min'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {isFa ? 'مدت زمان مجاز بدون فعالیت قبل از خروج خودکار (پیش‌فرض: ۵ دقیقه)' : 'Allowed idle time before automatic logout (default: 5 min)'}
                  </p>
                </div>

                <div className="flex items-center gap-3 p-4 bg-emerald-50/90 rounded-2xl border border-emerald-200">
                  <label className="flex items-center gap-2.5 text-xs sm:text-sm text-emerald-950 cursor-pointer font-bold select-none">
                    <input 
                      type="checkbox"
                      checked={forcePasswordChange}
                      onChange={(e) => setForcePasswordChange(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span>{isFa ? '✓ اجبار به تغییر رمز در اولین ورود' : 'Force Password change on first login'}</span>
                  </label>
                </div>
              </div>

              {/* =========================================================================================
                  SECTION 4: صلاحیت آموزشی و مجوزهای صدور پروانه کار (PTW)
                 ========================================================================================= */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-emerald-50/90 dark:from-slate-800/90 dark:via-indigo-950/40 dark:to-slate-800/90 rounded-3xl border-2 border-indigo-200/90 dark:border-indigo-800/80 shadow-xs gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-xs shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block">
                      {isFa ? '۴. صلاحیت آموزشی و مجوزهای صدور پروانه کار (PTW)' : '4. PTW Training Qualification & Authorization'}
                    </span>
                    <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-medium">
                      {isFa ? 'کنترل صلاحیت دوره‌های ایمنی، مدت اعتبار، تاریخ انقضا و سطوح مجاز امضای پروانه‌های کار گرم، سرد و الحاقی' : 'PTW Certificate validity, roles and permit issuance scopes'}
                    </span>
                  </div>
                </div>

                {/* Real-time Status Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 border shadow-2xs ${
                    livePtwStatus === 'valid'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700'
                      : livePtwStatus === 'expired'
                      ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400 dark:border-rose-700'
                      : livePtwStatus === 'incomplete'
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400 dark:border-amber-700'
                      : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400 dark:border-rose-700'
                  }`}>
                    {livePtwStatus === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                    {(livePtwStatus === 'expired' || livePtwStatus === 'unqualified') && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />}
                    {livePtwStatus === 'incomplete' && <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />}
                    <span>
                      {isFa ? (
                        livePtwStatus === 'valid' ? 'معتبر (دارای صلاحیت کامل)' :
                        livePtwStatus === 'expired' ? 'منقضی شده (فاقد مجوز امضا)' :
                        livePtwStatus === 'incomplete' ? 'نیازمند تکمیل اطلاعات' :
                        'فاقد صلاحیت صدور پروانه'
                      ) : (
                        livePtwStatus === 'valid' ? 'Valid Qualification' :
                        livePtwStatus === 'expired' ? 'Expired Certificate' :
                        livePtwStatus === 'incomplete' ? 'Incomplete Details' :
                        'Unqualified'
                      )}
                    </span>
                  </span>
                </div>
              </div>

              {/* Sub-block 1: وضعیت دوره آموزشی صدور پروانه کار */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                      {isFa ? '۱. وضعیت دوره آموزشی صدور پروانه کار و گواهینامه صلاحیت' : '1. PTW Training Course & Certificate'}
                    </span>
                  </div>
                  {ptwLastUpdatedAt && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {isFa ? `آخرین بروزرسانی: ${new Date(ptwLastUpdatedAt).toLocaleDateString('fa-IR')}` : `Updated: ${ptwLastUpdatedAt}`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status: Passed / Not Passed */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block text-right">
                      {isFa ? 'وضعیت گذراندن دوره صدور پروانه کار:' : 'PTW Course Status:'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPtwCourseStatus('passed');
                          if (ptwCourseResult !== 'success') setPtwCourseResult('success');
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                          ptwCourseStatus === 'passed'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isFa ? 'گذرانده است' : 'Passed'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPtwCourseStatus('not_passed');
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                          ptwCourseStatus === 'not_passed'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>{isFa ? 'نگذرانده است' : 'Not Passed'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Course Result: Success / Fail (Only if Passed) */}
                  <div className={`p-3.5 rounded-2xl border transition ${
                    ptwCourseStatus === 'passed'
                      ? 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                      : 'bg-slate-100/50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 opacity-60 pointer-events-none'
                  }`}>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block text-right mb-2">
                      {isFa ? 'نتیجه و وضعیت موفقیت در دوره آموزشی:' : 'Course Result:'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={ptwCourseStatus !== 'passed'}
                        onClick={() => setPtwCourseResult('success')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                          ptwCourseResult === 'success' && ptwCourseStatus === 'passed'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>✓ {isFa ? 'موفق (قبول شده)' : 'Successful'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={ptwCourseStatus !== 'passed'}
                        onClick={() => setPtwCourseResult('fail')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                          ptwCourseResult === 'fail' && ptwCourseStatus === 'passed'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>✕ {isFa ? 'ناموفق (مردود)' : 'Failed'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Certificate Details (Only enabled if passed & success) */}
                {ptwCourseStatus === 'passed' && ptwCourseResult === 'success' ? (
                  <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-slate-800/60 border border-indigo-200/80 dark:border-indigo-900/60 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Certificate Number */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block text-right">
                          {isFa ? 'شماره گواهینامه دوره:' : 'Certificate Number:'}
                        </label>
                        <input
                          type="text"
                          placeholder={isFa ? 'مثال: PTW-1403-882' : 'PTW-1403-882'}
                          value={ptwCertificateNumber}
                          onChange={(e) => setPtwCertificateNumber(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-right transition"
                        />
                      </div>

                      {/* Issue Date */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block text-right">
                          {isFa ? 'تاریخ صدور گواهینامه (شمسی): *' : 'Issue Date (Jalali): *'}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="1403/08/15"
                            value={ptwIssueDate}
                            onChange={(e) => handlePtwIssueDateChange(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-right transition"
                          />
                          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                        </div>
                      </div>

                      {/* Expiration Date (Auto-calculated) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                          <span>{isFa ? 'تاریخ انقضای گواهینامه:' : 'Expiration Date:'}</span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                            {isFa ? 'محاسبه خودکار' : 'Auto'}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            placeholder="1404/08/15"
                            value={ptwExpiryDate}
                            className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-indigo-900 dark:text-indigo-300 font-mono text-right cursor-not-allowed"
                          />
                          <Clock className="w-4 h-4 text-indigo-500 absolute left-3 top-2.5 pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {/* Validity Duration Preset Buttons (6 months, 1 year, 3 years, 5 years) */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-200 block text-right">
                        {isFa ? 'مدت اعتبار گواهینامه دوره:' : 'Validity Duration:'}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { key: '6m' as PtwValidityDuration, labelFa: '۶ ماهه', labelEn: '6 Months' },
                          { key: '1y' as PtwValidityDuration, labelFa: '۱ ساله (استاندارد)', labelEn: '1 Year (Std)' },
                          { key: '3y' as PtwValidityDuration, labelFa: '۳ ساله', labelEn: '3 Years' },
                          { key: '5y' as PtwValidityDuration, labelFa: '۵ ساله', labelEn: '5 Years' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handlePtwValidityDurationChange(item.key)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                              ptwValidityDuration === item.key
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Timer className="w-3.5 h-3.5" />
                            <span>{isFa ? item.labelFa : item.labelEn}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      {isFa
                        ? 'توجه: به دلیل عدم گذراندن موفق دوره آموزشی صدور پروانه کار، امکان ثبت گواهینامه وجود نداشته و پرسنل فاقد صلاحیت امضای هرگونه پروانه کار خواهد بود.'
                        : 'Notice: Without successful completion of the PTW training course, certificate issuance is not allowed and the person cannot sign any permits.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Sub-block 2: تعیین مجوز امضای پروانه کار اصلی */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                      {isFa ? '۲. تعیین مجوز امضای پروانه کار اصلی (Hot / Cold Permit)' : '2. Main Permit Authorization'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPtwMainPermits({ hot: true, cold: true })}
                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer hover:underline"
                    >
                      {isFa ? 'انتخاب هر دو نوع (کار گرم و سرد)' : 'Select Both'}
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setPtwMainPermits({ hot: false, cold: false })}
                      className="text-rose-500 hover:text-rose-600 cursor-pointer hover:underline"
                    >
                      {isFa ? 'لغو انتخاب' : 'Clear'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Hot Work */}
                  <label className={`flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    ptwMainPermits.hot
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                      : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={ptwMainPermits.hot}
                      onChange={(e) => setPtwMainPermits({ ...ptwMainPermits, hot: e.target.checked })}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                        <Flame className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          {isFa ? 'پروانه کار گرم (Hot Work Permit)' : 'Hot Work Permit'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {isFa ? 'عملیات جوشکاری، برشکاری، تولید حرارت و شعله باز' : 'Welding, burning, flame-producing tasks'}
                        </span>
                      </div>
                    </div>
                  </label>

                  {/* Cold Work */}
                  <label className={`flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                    ptwMainPermits.cold
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                      : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={ptwMainPermits.cold}
                      onChange={(e) => setPtwMainPermits({ ...ptwMainPermits, cold: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                        <Snowflake className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          {isFa ? 'پروانه کار سرد (Cold Work Permit)' : 'Cold Work Permit'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {isFa ? 'تعمیرات مکانیکی، پایپینگ، آچارکشی و فعالیت‌های بدون حرارت' : 'Mechanical maintenance, piping without ignition'}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Sub-block 3: تعیین مسئولیت در فرایند صدور پروانه کار */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                      {isFa ? '۳. تعیین مسئولیت و جایگاه مجاز در فرایند صدور پروانه کار (گردش‌کار ۴گانه)' : '3. Responsibilities in PTW Workflow'}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-slate-400">
                    {isFa ? 'امکان انتخاب همزمان یک یا چند جایگاه' : 'Multi-role selection allowed'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {[
                    { key: 'issuer' as const, titleFa: 'صادرکننده پروانه کار', roleKeyFa: 'کشیک ارشد تولید / صادرکننده', color: 'blue' },
                    { key: 'executor' as const, titleFa: 'مجری کار', roleKeyFa: 'مسئول انجام کار (پیمانکار/تعمیرات)', color: 'amber' },
                    { key: 'areaSupervisor' as const, titleFa: 'مسئول محوطه', roleKeyFa: 'سرپرست و ناظر محوطه عملیاتی', color: 'purple' },
                    { key: 'safetyUnit' as const, titleFa: 'نماینده یا مسئول HSE', roleKeyFa: 'افسر و کارشناس واحد ایمنی', color: 'emerald' },
                  ].map((roleItem) => (
                    <label
                      key={roleItem.key}
                      className={`flex flex-col justify-between p-3.5 rounded-2xl border transition cursor-pointer select-none min-h-[96px] ${
                        ptwResponsibilities[roleItem.key]
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {isFa ? roleItem.titleFa : roleItem.key}
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean(ptwResponsibilities[roleItem.key])}
                          onChange={(e) => setPtwResponsibilities({ ...ptwResponsibilities, [roleItem.key]: e.target.checked })}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isFa ? roleItem.roleKeyFa : roleItem.key}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sub-block 4: تعیین مجوز امضای پروانه‌های الحاقی */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                      {isFa ? '۴. تعیین مجوز امضای پروانه‌های الحاقی و تکمیلی (Supplementary Permits)' : '4. Supplementary Permits Authorization'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPtwSupplementaryPermits({
                        excavation: true,
                        confinedSpace: true,
                        vehicleCrane: true,
                        processIsolation: true,
                        electricalIsolation: true,
                        radiation: true,
                      })}
                      className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer hover:underline"
                    >
                      {isFa ? 'انتخاب همه پروانه‌ها' : 'Select All'}
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setPtwSupplementaryPermits({
                        excavation: false,
                        confinedSpace: false,
                        vehicleCrane: false,
                        processIsolation: false,
                        electricalIsolation: false,
                        radiation: false,
                      })}
                      className="text-rose-500 hover:text-rose-600 cursor-pointer hover:underline"
                    >
                      {isFa ? 'حذف همه' : 'Clear All'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {[
                    { key: 'excavation' as const, titleFa: 'حفاری (Excavation)', descFa: 'گودبرداری، حفاری و ترانشه‌برداری', icon: HardHat },
                    { key: 'confinedSpace' as const, titleFa: 'ورود به فضای بسته (Confined Space)', descFa: 'ورود به مخازن، برج‌ها، درام‌ها و کانال‌ها', icon: ShieldCheck },
                    { key: 'vehicleCrane' as const, titleFa: 'ورود جرثقیل یا خودرو به محدوده عملیاتی', descFa: 'تردد ماشین‌آلات سنگین، جرثقیل و بوم تراک', icon: HardHat },
                    { key: 'processIsolation' as const, titleFa: 'جداسازی فرایندی، مکانیکی و ابزار دقیق', descFa: 'مسدودسازی خطوط، بلیندینگ، دپِرشورایز و ایزولاسیون مکانیکی', icon: Settings },
                    { key: 'electricalIsolation' as const, titleFa: 'جداسازی الکتریکی (LOTO)', descFa: 'قفل‌گذاری و قطع ایمن برق، سوئیچ‌گیر و ترانس', icon: Zap },
                    { key: 'radiation' as const, titleFa: 'منابع پرتوزا (Radiation)', descFa: 'عملیات رادیوگرافی، تست غیرمخرب (NDT) و پرتوهای یونیزان', icon: Radio },
                  ].map((suppItem) => {
                    const isChecked = Boolean(ptwSupplementaryPermits[suppItem.key]);
                    return (
                      <label
                        key={suppItem.key}
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                          isChecked
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800'
                            : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => setPtwSupplementaryPermits({ ...ptwSupplementaryPermits, [suppItem.key]: e.target.checked })}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-black text-slate-900 dark:text-white block truncate">
                            {isFa ? suppItem.titleFa : suppItem.key}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {isFa ? suppItem.descFa : ''}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Sticky Bottom Footer */}
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 sm:px-10 py-4 flex items-center justify-between shrink-0 shadow-lg">
              <div className="text-xs text-slate-500 font-medium hidden sm:block">
                {isFa ? 'لطفاً تمامی فیلدهای ستاره‌دار (*) را با دقت تکمیل نمایید.' : 'Please complete all required fields.'}
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingUserId ? (isFa ? 'ذخیره تغییرات پرسنل' : 'Save Personnel Data') : (isFa ? 'ثبت و ایجاد پرسنل جدید' : 'Register New Employee')}</span>
                </button>
              </div>
            </div>
          </form>

          {/* User Confirmation Modal Before Saving Changes */}
          {saveConfirmOpen && (
            <div className="fixed inset-0 z-[1000000] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 rtl font-sans" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
              <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-emerald-700/60 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {editingUserId
                        ? (isFa ? 'تایید نهایی ذخیره تغییرات پرسنل' : 'Confirm Saving Personnel Changes')
                        : (isFa ? 'تایید نهایی ثبت پرسنل جدید' : 'Confirm New Personnel Registration')}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {isFa ? 'اطلاعات در پایگاه داده اصلی ذخیره و برای تمام کاربران همگام‌سازی می‌شود' : 'Data will be persisted to the central database'}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">{isFa ? 'نام و نام خانوادگی:' : 'Full Name:'}</span>
                    <span className="font-black text-slate-900 dark:text-white">{fullName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">{isFa ? 'کد پرسنلی / نام کاربری:' : 'Code / Username:'}</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{personnelNumber || '—'} ({username})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">{isFa ? 'سمت سازمانی:' : 'Job Title:'}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{jobTitle || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                    <span className="text-slate-500 font-bold">{isFa ? 'وضعیت صلاحیت صدور پروانه (PTW):' : 'PTW Qualification:'}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black border ${
                      livePtwStatus === 'valid'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : livePtwStatus === 'incomplete'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {livePtwStatus === 'valid' ? (isFa ? 'معتبر (دارای صلاحیت)' : 'Valid') :
                       livePtwStatus === 'expired' ? (isFa ? 'منقضی شده' : 'Expired') :
                       livePtwStatus === 'incomplete' ? (isFa ? 'نیازمند تکمیل' : 'Incomplete') :
                       (isFa ? 'فاقد صلاحیت' : 'Unqualified')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                    <span className="text-slate-500 font-bold">{isFa ? 'وضعیت نمونه امضا:' : 'Signature Sample:'}</span>
                    {signatureImage ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-black">
                          {isFa ? 'دارای نمونه امضا' : 'Attached'}
                        </span>
                        <img src={signatureImage} alt="Signature" className="h-8 max-w-[80px] object-contain bg-white rounded border border-slate-200 px-1" />
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-bold">{isFa ? 'بدون نمونه امضا' : 'None'}</span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                  {isFa
                    ? `آیا از ثبت و ذخیره تغییرات مشخصات «${fullName}» اطمینان دارید؟`
                    : `Are you sure you want to save changes for "${fullName}"?`}
                </p>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isSavingUser}
                    onClick={executeSaveUser}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-black rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingUser ? (isFa ? 'در حال ذخیره...' : 'Saving...') : (isFa ? 'بله، تایید و ذخیره شود' : 'Yes, Confirm & Save')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSavingUser}
                    onClick={() => setSaveConfirmOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {isFa ? 'بازگشت به فرم' : 'Back'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* --- CUSTOM CONFIRMATION MODAL --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 rtl font-sans" style={{ direction: isFa ? 'rtl' : 'ltr' }}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 border-b border-slate-100 dark:border-slate-800 pb-3">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'تایید نهایی عملیات حذف' : 'Confirm Deletion'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
              {isFa ? (
                <span>
                  آیا از حذف کاربر <strong className="text-slate-950 bg-slate-100 px-1 py-0.5 rounded">«{deleteConfirm.name}»</strong> به طور کامل اطمینان دارید؟ این عملیات غیر قابل بازگشت است.
                </span>
              ) : (
                <span>
                  Are you sure you want to permanently delete user <strong className="text-slate-950 bg-slate-100 px-1 py-0.5 rounded">"{deleteConfirm.name}"</strong>? This action cannot be undone.
                </span>
              )}
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirm.type === 'user') {
                    const updated = users.filter(u => u.id !== deleteConfirm.id);
                    addAuditLog(currentUser.username, `حذف کاربر: ${deleteConfirm.name} (ID: ${deleteConfirm.id})`, 'موفقیت‌آمیز');
                    saveUsers(updated);
                    try {
                      await apiDb.deleteUser(deleteConfirm.id);
                    } catch (e) {
                      console.error('Failed to delete user in DB:', e);
                    }
                    loadData();
                  }
                  setDeleteConfirm(null);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {isFa ? 'بله، حذف شود' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- QUICK MANAGE ASSIGNED PERSONNEL MODAL --- */}
      <UserPersonnelAssignmentModal
        isOpen={Boolean(assignmentModalUser)}
        onClose={() => setAssignmentModalUser(null)}
        targetUser={assignmentModalUser}
        language={language}
        onSaved={async () => {
          await loadData();
          window.dispatchEvent(new Event('hse_user_assignments_updated'));
        }}
      />

    </div>
  );
}
