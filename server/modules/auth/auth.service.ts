import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { desc, eq, and, isNull, sql, or } from 'drizzle-orm';
import moment from 'moment-jalaali';
import { db, schema } from '../../core/db.ts';
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError } from '../../core/errors.ts';
import { auditService } from '../audit/audit.service.ts';
import { ROLE_PERMISSIONS, normalizeRoleToCanonical } from '../../core/middleware/auth.ts';
import { config } from '../../core/config.ts';
import { logger } from '../../core/logger.ts';
import { personnelAccessService, isAdminRole } from '../../core/personnelAccess.service.ts';
import { normalizePersianArabicText, normalizeDigits as sharedNormalizeDigits } from '../../../src/utils/textNormalization.ts';
import { toPersianDigits as sharedToPersianDigits } from '../../../src/utils/jalaliDate.ts';

/**
 * Checks whether an access expiration date (Jalali, Gregorian ISO, or timestamp) has expired.
 */
export function checkIsAccessExpired(accessExpiresAt: string | null | undefined): boolean {
  if (!accessExpiresAt || typeof accessExpiresAt !== 'string') return false;
  const val = accessExpiresAt.trim();
  if (!val || val.toLowerCase() === 'permanent' || val === 'دائمی' || val === 'نامحدود') return false;

  const clean = normalizeDigits(val);
  // Match Jalali format: YYYY/MM/DD or YYYY-MM-DD
  const jMatch = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (jMatch) {
    const jYear = parseInt(jMatch[1], 10);
    if (jYear >= 1300 && jYear <= 1600) {
      const m = moment(clean, ['jYYYY/jMM/jDD', 'jYYYY-jMM-jDD', 'jYYYY/jM/jD', 'jYYYY-jM-jD']);
      if (m.isValid()) {
        return m.endOf('day').isBefore(moment());
      }
    }
  }

  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return d.getTime() < Date.now();
  }

  return false;
}

/**
 * Standard password hashing using bcrypt with cost factor 12.
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new ValidationError('کلمه عبور باید حداقل ۶ کاراکتر باشد.');
  }
  return bcrypt.hashSync(password, 12);
}

/**
 * Strictly verifies password against bcrypt hash.
 * Never accepts plaintext passwords as valid hashes.
 * Disallows any bypass for specific usernames or passwords.
 */
export function verifyPassword(plainPassword: string, storedHash: string | null | undefined): boolean {
  if (!plainPassword || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  // Strictly enforce valid bcrypt hash structure ($2a$, $2b$, or $2y$)
  if (!storedHash.startsWith('$2a$') && !storedHash.startsWith('$2b$') && !storedHash.startsWith('$2y$')) {
    return false;
  }
  try {
    return bcrypt.compareSync(plainPassword, storedHash);
  } catch {
    return false;
  }
}

/**
 * Persian / Arabic to English digit conversion helper for robust credentials matching.
 */
export function normalizeDigits(str: string): string {
  return sharedNormalizeDigits(str);
}

/**
 * English to Persian digit conversion helper for dual-direction password verification.
 */
export function toPersianDigits(str: string): string {
  return sharedToPersianDigits(str || '');
}

/**
 * Normalizes Persian and Arabic text variants (Kaf, Yeh, digits, spaces).
 */
export function normalizePersianText(str: string): string {
  return normalizePersianArabicText(str);
}

/**
 * Standard System Role Mapping with bilingual Persian & English equivalents.
 */
export const VALID_ROLES_MAP: Record<string, string> = {
  ADMIN: 'Administrator',
  ADMINISTRATOR: 'Administrator',
  مدیر: 'Administrator',
  مدیرارشد: 'Administrator',
  مدیرسیستم: 'Administrator',
  مدیرکل: 'Administrator',
  SUPERADMIN: 'Administrator',
  HSE_MANAGER: 'HSE Manager',
  HSEMANAGER: 'HSE Manager',
  مدیرHSE: 'HSE Manager',
  مدیرایمنی: 'HSE Manager',
  مدیربهداشتوایمنی: 'HSE Manager',
  EXECUTIVE_MANAGER: 'Executive Manager',
  EXECUTIVEMANAGER: 'Executive Manager',
  مدیراجرایی: 'Executive Manager',
  مدیرعملیات: 'Executive Manager',
  SAFETY_OFFICER: 'Safety Officer',
  SAFETYOFFICER: 'Safety Officer',
  افسرایمنی: 'Safety Officer',
  کارشناسایمنی: 'Safety Officer',
  مسئولایمنی: 'Safety Officer',
  سرپرستایمنی: 'Safety Officer',
  SAFETY_INSPECTOR: 'Safety Inspector',
  SAFETYINSPECTOR: 'Safety Inspector',
  بازرسایمنی: 'Safety Inspector',
  کارشناسبازرسی: 'Safety Inspector',
  DOCTOR_OCCUPATIONAL: 'Doctor / Occupational Health',
  DOCTOROCCUPATIONAL: 'Doctor / Occupational Health',
  پزشک: 'Doctor / Occupational Health',
  پزشکطبکار: 'Doctor / Occupational Health',
  طبکار: 'Doctor / Occupational Health',
  دکتر: 'Doctor / Occupational Health',
  MEDICAL_STAFF: 'Medical Staff',
  MEDICALSTAFF: 'Medical Staff',
  کادربهداشت: 'Medical Staff',
  کادردرمان: 'Medical Staff',
  پرستار: 'Medical Staff',
  بهداشتحرفهای: 'Medical Staff',
  CONTRACTOR: 'Contractor',
  CONTRACTOR_REPRESENTATIVE: 'Contractor',
  CONTRACTORREPRESENTATIVE: 'Contractor',
  پیمانکار: 'Contractor',
  نمایندهپیمانکار: 'Contractor',
  TECHNICAL_INSPECTOR: 'Technical Inspector',
  TECHNICALINSPECTOR: 'Technical Inspector',
  بازرسفنی: 'Technical Inspector',
  MAINTENANCE_MANAGER: 'Maintenance Manager',
  MAINTENANCEMANAGER: 'Maintenance Manager',
  مدیرنگهداری: 'Maintenance Manager',
  تعمیرات: 'Maintenance Manager',
  PROJECT_MANAGER: 'Project Manager',
  PROJECTMANAGER: 'Project Manager',
  مدیرپروژه: 'Project Manager',
  سرپرستکارگاه: 'Project Manager',
  AUDITOR: 'Auditor',
  ممیز: 'Auditor',
  ممیزی: 'Auditor',
  WORKER: 'Worker',
  کارگر: 'Worker',
  پرسنل: 'Worker',
  VISITOR: 'Visitor',
  بازدیدکننده: 'Visitor',
  GUEST: 'Guest',
  مهمان: 'Guest',
  USER: 'User',
  کاربر: 'User',
  کاربرمعمولی: 'User',
  SUPERVISOR: 'Supervisor',
  سرپرست: 'Supervisor',
};

/**
 * Normalize system roles while gracefully supporting custom dedicated roles (نقش‌های اختصاصی).
 * Standard roles are normalized to their canonical form.
 * Custom roles are sanitized and preserved without throwing errors.
 */
export function normalizeAndValidateRole(roleInput?: string): string {
  if (!roleInput || typeof roleInput !== 'string' || !roleInput.trim()) return 'User';
  const trimmed = roleInput.trim();
  const key = normalizePersianText(trimmed).toUpperCase().replace(/\s+|_/g, '');
  if (VALID_ROLES_MAP[key]) {
    return VALID_ROLES_MAP[key];
  }
  // Sanitize custom role (remove control characters) and preserve it cleanly
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return sanitized || 'User';
}

export interface ClientContext {
  ip: string;
  userAgent: string;
}

export class AuthService {
  /**
   * Enterprise Server-Side Authentication
   * Validates credentials against پایگاه داده, checks account status, logs audit trail,
   * issues HMAC-SHA256 signed JWT tokens.
   */
  async login(credentials: { username: string; password: string }, clientInfo: ClientContext) {
    const rawUsername = (credentials.username || '').trim();
    const normUsername = normalizeDigits(rawUsername);
    const persianNormUsername = normalizePersianText(rawUsername);
    const rawPassword = credentials.password || '';
    const normPassword = normalizeDigits(rawPassword);
    const faPassword = toPersianDigits(rawPassword);

    if (!rawUsername || !rawPassword) {
      throw new ValidationError('نام کاربری و کلمه عبور الزامی است.');
    }

    // 1. Query user from پایگاه داده by username, email, personnelNumber, OR nationalId
    const cleanRaw = rawUsername.toLowerCase().trim();
    const cleanNorm = normUsername.toLowerCase().trim();
    const cleanPersian = persianNormUsername.toLowerCase().trim();
    const cleanNoSpace = cleanPersian.replace(/\s+/g, '');

    const usersFound = await db
      .select()
      .from(schema.users)
      .where(
        and(
          isNull(schema.users.deletedAt),
          or(
            eq(sql`LOWER(${schema.users.username})`, cleanRaw),
            eq(sql`LOWER(${schema.users.username})`, cleanNorm),
            eq(sql`LOWER(${schema.users.username})`, cleanPersian),
            eq(sql`LOWER(REPLACE(REPLACE(REPLACE(COALESCE(${schema.users.username}, ''), ' ', ''), 'ي', 'ی'), 'ك', 'ک'))`, cleanNoSpace),
            eq(sql`LOWER(${schema.users.email})`, cleanRaw),
            eq(sql`LOWER(${schema.users.email})`, cleanNorm),
            eq(schema.users.personnelNumber, rawUsername),
            eq(schema.users.personnelNumber, normUsername),
            eq(schema.users.personnelNumber, persianNormUsername),
            eq(sql`REPLACE(COALESCE(${schema.users.personnelNumber}, ''), ' ', '')`, cleanNoSpace),
            eq(schema.users.nationalId, rawUsername),
            eq(schema.users.nationalId, normUsername),
            eq(schema.users.nationalId, persianNormUsername),
            eq(sql`REPLACE(COALESCE(${schema.users.nationalId}, ''), ' ', '')`, cleanNoSpace)
          )
        )
      )
      .limit(1);

    if (usersFound.length === 0) {
      try {
        await auditService.log({
          action: 'LOGIN',
          module: 'AUTH',
          entityType: 'USER',
          result: 'FAILED',
          ipAddress: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          details: { reason: 'USER_NOT_FOUND', username: rawUsername },
        });
      } catch {}
      throw new UnauthorizedError('نام کاربری یا کلمه عبور وارد شده نادرست است.');
    }

    const user = usersFound[0];

    // 2. Enforce Account Status checks
    if (user.accountStatus === 'Locked') {
      await auditService.log({
        userId: user.id,
        userUid: user.uid,
        action: 'LOGIN',
        module: 'AUTH',
        entityType: 'USER',
        entityId: user.uid,
        result: 'FAILED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { reason: 'ACCOUNT_LOCKED', username: user.username },
      });
      throw new ForbiddenError('حساب کاربری شما مسدود شده است. لطفاً با مدیر سیستم تماس بگیرید.');
    }

    if (user.accountStatus === 'Suspended' || !user.isActive) {
      await auditService.log({
        userId: user.id,
        userUid: user.uid,
        action: 'LOGIN',
        module: 'AUTH',
        entityType: 'USER',
        entityId: user.uid,
        result: 'FAILED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { reason: 'ACCOUNT_SUSPENDED', username: user.username },
      });
      throw new ForbiddenError('حساب کاربری شما تعلیق شده یا غیرفعال است.');
    }

    // Check Access Expiration Date (تاریخ انقضای دسترسی به سامانه)
    const profile = (user.profileData as Record<string, any>) || {};
    const accessExpiresAt = profile.accessExpiresAt || profile.expiresAt;
    let isAccessExpired = user.accountStatus === 'Expired';
    if (!isAccessExpired && accessExpiresAt) {
      if (checkIsAccessExpired(accessExpiresAt)) {
        isAccessExpired = true;
        await db
          .update(schema.users)
          .set({ accountStatus: 'Expired', isActive: false, updatedAt: new Date() })
          .where(eq(schema.users.id, user.id));
      }
    }

    if (isAccessExpired) {
      await auditService.log({
        userId: user.id,
        userUid: user.uid,
        action: 'LOGIN',
        module: 'AUTH',
        entityType: 'USER',
        entityId: user.uid,
        result: 'FAILED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { reason: 'ACCESS_EXPIRED', username: user.username, accessExpiresAt },
      });
      throw new ForbiddenError('مدت زمان مجاز دسترسی شما به سامانه HSE به پایان رسیده و حساب کاربری شما منقضی گردیده است. جهت تمدید با مدیر ارشد سیستم تماس بگیرید.');
    }

    // 3. Verify Password strictly with bcrypt (supporting both English and Persian digit formats)
    const passwordMatches =
      verifyPassword(rawPassword, user.passwordHash) ||
      (normPassword !== rawPassword && verifyPassword(normPassword, user.passwordHash)) ||
      (faPassword !== rawPassword && verifyPassword(faPassword, user.passwordHash));

    if (!passwordMatches) {
      await auditService.log({
        userId: user.id,
        userUid: user.uid,
        action: 'LOGIN',
        module: 'AUTH',
        entityType: 'USER',
        entityId: user.uid,
        result: 'FAILED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { reason: 'INVALID_PASSWORD', username: user.username },
      });
      throw new UnauthorizedError('نام کاربری یا کلمه عبور وارد شده نادرست است.');
    }

    // 4. Safe hash cost upgrade if stored hash is older bcrypt format
    if (!user.passwordHash?.startsWith('$2b$12$') && user.passwordHash?.startsWith('$2')) {
      try {
        const newBcryptHash = hashPassword(rawPassword);
        await db
          .update(schema.users)
          .set({
            passwordHash: newBcryptHash,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, user.id));
        logger.info('User password upgraded to standard bcrypt cost 12', { uid: user.uid });
      } catch (upgradeErr) {
        logger.warn('Failed to upgrade password hash', { error: String(upgradeErr) });
      }
    }

    // 5. Server-side Role & Permissions derivation
    const role = normalizeAndValidateRole(user.role);
    const roleKey = role.toUpperCase().replace(/\s+|_/g, '');
    const canonicalKey = normalizeRoleToCanonical(role);
    const defaultPermissions = ROLE_PERMISSIONS[canonicalKey] || ROLE_PERMISSIONS[roleKey] || ROLE_PERMISSIONS['CUSTOM_ROLE'] || ['dashboard:view', 'user:read'];
    
    // Complete granular permissions matrix returned to the frontend in the JSON response body
    const fullPermissions = (user.permissions && (typeof user.permissions === 'object' && Object.keys(user.permissions).length > 0))
      ? user.permissions
      : defaultPermissions;

    // Compact token permissions strictly formatted as a lightweight scopes array
    // Prevents exceeding Nginx proxy_buffer_size and RFC 6265 browser cookie limit (4096 bytes)
    // which caused Nginx "upstream sent too big header" and 502 Bad Gateway on VPS
    const tokenScopes: string[] = canonicalKey === 'ADMINISTRATOR' || roleKey === 'ADMIN'
      ? ['*']
      : Array.isArray(user.permissions)
      ? (user.permissions as string[]).slice(0, 30)
      : (ROLE_PERMISSIONS[canonicalKey] || ['dashboard:view', 'user:read']);

    // 6. Check for mustResetPassword flag in user profile
    const profileData = (user.profileData as Record<string, any>) || {};
    const mustResetPassword = Boolean(profileData.mustResetPassword || profileData.forcePasswordChange);

    const token = jwt.sign(
      {
        uid: user.uid,
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.fullName || user.username,
        role,
        personnelCode: user.personnelNumber,
        permissions: tokenScopes,
        mustResetPassword,
      },
      config.security.jwtSecret,
      { expiresIn: (config.security.tokenExpiry || '7d') as any }
    );

    // 7. Update user activity timestamp in پایگاه داده
    try {
      await db
        .update(schema.users)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));
    } catch (dbUpdateErr) {
      logger.warn('Failed to update user last activity timestamp', { error: String(dbUpdateErr) });
    }

    // 8. Successful login audit log (safely guarded)
    try {
      await auditService.log({
        userId: user.id,
        userUid: user.uid,
        personnelCode: user.personnelNumber || undefined,
        action: 'LOGIN',
        module: 'AUTH',
        entityType: 'USER',
        entityId: user.uid,
        result: 'SUCCESS',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { username: user.username, role, email: user.email },
      });
    } catch (auditErr) {
      logger.warn('Login audit log warning', { error: String(auditErr) });
    }

    // 9. Resolve centralized personnel access assignments from PostgreSQL
    const accessCtx = await personnelAccessService.resolveAccessContext(user);

    // 10. Sanitize user profile output (strictly omit passwordHash)
    const sanitizedUser: any = {
      id: user.uid,
      uid: user.uid,
      username: user.username,
      fullName: user.fullName || user.username,
      email: user.email,
      personnelNumber: user.personnelNumber,
      nationalId: user.nationalId,
      phoneNumber: user.phoneNumber,
      jobTitle: user.jobTitle,
      role,
      accountStatus: user.accountStatus,
      isActive: user.isActive,
      personnelAccessScope: accessCtx.scope,
      canAccessAllPersonnel: accessCtx.canAccessAll,
      assignedPersonnelIds: accessCtx.assignedPersonnel.map((p) => p.id),
      assignedPersonnelCodes: accessCtx.assignedPersonnel.map((p) => p.personnelCode),
      assignedPersonnel: accessCtx.assignedPersonnel,
      permissions: fullPermissions,
      mustResetPassword,
      forcePasswordChange: mustResetPassword,
      profileData: user.profileData,
      signatureImage: (user.profileData as any)?.signatureImage || '',
      profilePhoto: (user.profileData as any)?.profilePhoto || '',
      lastLogin: new Date().toISOString(),
      updatedDate: user.updatedAt?.toISOString(),
    };

    return {
      token,
      user: sanitizedUser,
    };
  }

  async getCurrentUser(uid: string) {
    const list = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.uid, uid), isNull(schema.users.deletedAt)))
      .limit(1);

    if (list.length === 0) {
      throw new NotFoundError('کاربر مورد نظر یافت نشد.');
    }

    const user = list[0];
    const role = normalizeAndValidateRole(user.role);
    const roleKey = role.toUpperCase().replace(/\s+|_/g, '');
    const profileData = (user.profileData as Record<string, any>) || {};

    const canonicalKey = normalizeRoleToCanonical(role);
    const defaultPermissions = ROLE_PERMISSIONS[canonicalKey] || ROLE_PERMISSIONS[roleKey] || ['user:read'];
    const permissions = (user.permissions && typeof user.permissions === 'object' && Object.keys(user.permissions).length > 0)
      ? user.permissions
      : defaultPermissions;

    const accessCtx = await personnelAccessService.resolveAccessContext(user);

    return {
      id: user.uid,
      uid: user.uid,
      username: user.username,
      fullName: user.fullName || user.username,
      email: user.email,
      personnelNumber: user.personnelNumber,
      nationalId: user.nationalId,
      phoneNumber: user.phoneNumber,
      jobTitle: user.jobTitle,
      role,
      accountStatus: user.accountStatus,
      isActive: user.isActive,
      personnelAccessScope: accessCtx.scope,
      canAccessAllPersonnel: accessCtx.canAccessAll,
      assignedPersonnelIds: accessCtx.assignedPersonnel.map((p) => p.id),
      assignedPersonnelCodes: accessCtx.assignedPersonnel.map((p) => p.personnelCode),
      assignedPersonnel: accessCtx.assignedPersonnel,
      permissions,
      mustResetPassword: Boolean(profileData.mustResetPassword),
      profileData: user.profileData,
      signatureImage: profileData.signatureImage || '',
      profilePhoto: profileData.profilePhoto || '',
      ptwQualification: profileData.ptwQualification || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async changePassword(uid: string, currentPass: string, newPass: string, clientInfo: ClientContext) {
    if (!newPass || typeof newPass !== 'string' || newPass.length < 6) {
      throw new ValidationError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
    }

    if (currentPass === newPass) {
      throw new ValidationError('رمز عبور جدید نمی‌تواند با رمز عبور فعلی یکسان باشد.');
    }

    const list = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.uid, uid), isNull(schema.users.deletedAt)))
      .limit(1);

    if (list.length === 0) {
      throw new NotFoundError('کاربر یافت نشد.');
    }

    const user = list[0];
    const matches = verifyPassword(currentPass, user.passwordHash);
    if (!matches) {
      await auditService.log({
        userId: user.id,
        userUid: user.uid,
        action: 'CHANGE_PASSWORD',
        module: 'AUTH',
        entityType: 'USER',
        entityId: user.uid,
        result: 'FAILED',
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
        details: { reason: 'CURRENT_PASSWORD_INCORRECT' },
      });
      throw new UnauthorizedError('رمز عبور فعلی وارد شده نادرست است.');
    }

    const hashed = hashPassword(newPass);
    const existingProfile = (user.profileData as Record<string, any>) || {};
    const updatedProfile = {
      ...existingProfile,
      mustResetPassword: false,
      passwordChangedAt: new Date().toISOString(),
    };

    await db
      .update(schema.users)
      .set({
        passwordHash: hashed,
        profileData: updatedProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    await auditService.log({
      userId: user.id,
      userUid: user.uid,
      action: 'CHANGE_PASSWORD',
      module: 'AUTH',
      entityType: 'USER',
      entityId: user.uid,
      result: 'SUCCESS',
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { username: user.username },
    });

    return { success: true, message: 'رمز عبور با موفقیت بروزرسانی شد.' };
  }

  /**
   * Secure administrator password reset for another user.
   * Only accessible by authorized Administrators.
   */
  async adminResetPassword(
    targetUid: string,
    newPass: string,
    actor: { uid?: string; role?: string; name?: string } | undefined,
    clientInfo: ClientContext
  ) {
    const actorRole = (actor?.role || '').toUpperCase().replace(/\s+|_/g, '');
    if (actorRole !== 'ADMIN' && actorRole !== 'ADMINISTRATOR') {
      throw new ForbiddenError('فقط مدیر ارشد سیستم مجاز به بازنشانی کلمه عبور کاربران است.');
    }

    if (!newPass || typeof newPass !== 'string' || newPass.length < 6) {
      throw new ValidationError('رمز عبور جدید باید حداقل ۶ کاراکتر باشد.');
    }

    const list = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.uid, targetUid), isNull(schema.users.deletedAt)))
      .limit(1);

    if (list.length === 0) {
      throw new NotFoundError('کاربر مورد نظر یافت نشد.');
    }

    const targetUser = list[0];
    const hashed = hashPassword(newPass);
    const existingProfile = (targetUser.profileData as Record<string, any>) || {};
    const updatedProfile = {
      ...existingProfile,
      mustResetPassword: true,
      passwordResetByAdminAt: new Date().toISOString(),
      resetBy: actor?.name || actor?.uid,
    };

    await db
      .update(schema.users)
      .set({
        passwordHash: hashed,
        profileData: updatedProfile,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, targetUser.id));

    await auditService.log({
      userId: targetUser.id,
      userUid: targetUser.uid,
      action: 'ADMIN_RESET_PASSWORD',
      module: 'AUTH',
      entityType: 'USER',
      entityId: targetUser.uid,
      result: 'SUCCESS',
      ipAddress: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      details: { targetUsername: targetUser.username, actor: actor?.name || actor?.uid },
    });

    return { success: true, message: 'کلمه عبور با موفقیت توسط مدیر بازنشانی شد و کاربر در ورود بعدی موظف به تغییر آن است.' };
  }

  async getAllUsers() {
    await personnelAccessService.ensureSchema();
    const list = await db
      .select({
        id: schema.users.id,
        uid: schema.users.uid,
        username: schema.users.username,
        email: schema.users.email,
        fullName: schema.users.fullName,
        personnelNumber: schema.users.personnelNumber,
        nationalId: schema.users.nationalId,
        phoneNumber: schema.users.phoneNumber,
        jobTitle: schema.users.jobTitle,
        role: schema.users.role,
        accountStatus: schema.users.accountStatus,
        isActive: schema.users.isActive,
        personnelAccessScope: schema.users.personnelAccessScope,
        permissions: schema.users.permissions,
        profileData: schema.users.profileData,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(isNull(schema.users.deletedAt))
      .orderBy(desc(schema.users.createdAt));

    const assignmentsMap = await personnelAccessService.getAllUsersAssignmentsMap();

    return list.map((u: any) => {
      const assignmentData = assignmentsMap.get(u.id) || {
        assignedPersonnelIds: [],
        assignedPersonnelCodes: [],
        assignedPersonnel: [],
      };
      const isUserAdmin = isAdminRole(u.role);
      const scope =
        isUserAdmin || String(u.personnelAccessScope || '').toUpperCase() === 'ALL'
          ? 'ALL'
          : 'ASSIGNED';

      let profileData = u.profileData;
      if (profileData?.notificationSettings?.criticalHseCustomAudioUrl?.startsWith('data:')) {
        profileData = {
          ...profileData,
          notificationSettings: {
            ...profileData.notificationSettings,
            criticalHseCustomAudioUrl: '/api/v1/notifications/custom-siren',
          },
        };
      }

      return {
        ...u,
        profileData,
        personnelAccessScope: scope,
        canAccessAllPersonnel: scope === 'ALL',
        assignedPersonnelIds: assignmentData.assignedPersonnelIds,
        assignedPersonnelCodes: assignmentData.assignedPersonnelCodes,
        assignedPersonnel: assignmentData.assignedPersonnel,
        signatureImage: profileData?.signatureImage || '',
        profilePhoto: profileData?.profilePhoto || '',
        ptwQualification: profileData?.ptwQualification || null,
      };
    });
  }

  /**
   * Secure User Creation & Update (Upsert)
   * Enforces server-side authorization, strict role validation, role escalation prevention,
   * safe password hashing, and server-controlled permission assignment.
   */
  async upsertUser(
    data: {
      uid?: string;
      id?: string | number;
      username?: string;
      email: string;
      fullName?: string;
      personnelNumber?: string;
      nationalId?: string;
      phoneNumber?: string;
      jobTitle?: string;
      role?: string;
      accountStatus?: string;
      isActive?: boolean;
      permissions?: any;
      profileData?: any;
      password?: string;
      mustResetPassword?: boolean;
    },
    actor?: { uid?: string; role?: string; name?: string } | string
  ) {
    // 1. Identify actor and permissions
    const actorRole = typeof actor === 'object' ? (actor?.role || '').toUpperCase().replace(/\s+|_/g, '') : (typeof actor === 'string' ? actor.toUpperCase().replace(/\s+|_/g, '') : '');
    const isActorAdmin = actorRole === 'ADMIN' || actorRole === 'ADMINISTRATOR' || actor === 'Administrator' || actorRole.includes('ADMIN');
    const actorName = typeof actor === 'object' ? (actor?.name || actor?.uid || 'system') : (actor || 'system');

    const targetUid = String(data.uid || data.id || `usr-${Date.now()}`);
    const userEmail = (data.email?.trim() || `${(data.username || 'user').trim()}@company.local`).toLowerCase();
    const cleanUsername = normalizePersianText(String(data.username || '').trim());

    // 2. Validate and normalize requested role
    const requestedRole = normalizeAndValidateRole(data.role || 'User');
    const requestedRoleKey = requestedRole.toUpperCase().replace(/\s+|_/g, '');
    const canonicalRoleKey = normalizeRoleToCanonical(requestedRole);

    // 3. Prevent unauthorized assignment or escalation of Administrator role
    if (canonicalRoleKey === 'ADMINISTRATOR' && !isActorAdmin) {
      throw new ForbiddenError('فقط مدیر ارشد سیستم (Administrator) مجاز به ایجاد یا اعطای نقش مدیریت سیستم است.');
    }

    // 4. Check for existing user record (by uid, integer ID if provided, username, or personnelNumber)
    let existingUser: any = null;
    if (data.id !== undefined && data.id !== null && String(data.id).trim() !== '') {
      const idStr = String(data.id).trim();
      if (!isNaN(Number(idStr))) {
        const byId = await db.select().from(schema.users).where(and(eq(schema.users.id, Number(idStr)), isNull(schema.users.deletedAt))).limit(1);
        if (byId.length > 0) existingUser = byId[0];
      }
      if (!existingUser) {
        const byIdAsUid = await db.select().from(schema.users).where(and(eq(schema.users.uid, idStr), isNull(schema.users.deletedAt))).limit(1);
        if (byIdAsUid.length > 0) existingUser = byIdAsUid[0];
      }
    }
    if (!existingUser && targetUid) {
      const byUid = await db.select().from(schema.users).where(and(eq(schema.users.uid, targetUid), isNull(schema.users.deletedAt))).limit(1);
      if (byUid.length > 0) existingUser = byUid[0];
      if (!existingUser && !isNaN(Number(targetUid))) {
        const byUidAsId = await db.select().from(schema.users).where(and(eq(schema.users.id, Number(targetUid)), isNull(schema.users.deletedAt))).limit(1);
        if (byUidAsId.length > 0) existingUser = byUidAsId[0];
      }
    }
    if (!existingUser && cleanUsername) {
      const byUname = await db.select().from(schema.users).where(
        and(
          isNull(schema.users.deletedAt),
          sql`LOWER(${schema.users.username}) = LOWER(${cleanUsername})`
        )
      ).limit(1);
      if (byUname.length > 0) existingUser = byUname[0];
    }
    if (!existingUser && data.personnelNumber && String(data.personnelNumber).trim() !== '') {
      const pNum = String(data.personnelNumber).trim();
      const byPNum = await db.select().from(schema.users).where(
        and(
          isNull(schema.users.deletedAt),
          eq(schema.users.personnelNumber, pNum)
        )
      ).limit(1);
      if (byPNum.length > 0) existingUser = byPNum[0];
    }

    // 5. If modifying existing Administrator, ensure actor is Administrator and not locking out the system
    if (existingUser) {
      const existingRoleKey = (existingUser.role || '').toUpperCase().replace(/\s+|_/g, '');
      const isExistingAdmin = existingRoleKey === 'ADMIN' || existingRoleKey === 'ADMINISTRATOR';

      if (isExistingAdmin && requestedRole !== 'Administrator') {
        if (!isActorAdmin) {
          throw new ForbiddenError('شما مجاز به تغییر نقش مدیر سیستم نیستید.');
        }

        // Check if this is the last active Administrator
        const activeAdmins = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              isNull(schema.users.deletedAt),
              eq(schema.users.isActive, true),
              sql`UPPER(REPLACE(REPLACE(${schema.users.role}, ' ', ''), '_', '')) IN ('ADMIN', 'ADMINISTRATOR')`
            )
          );

        if (activeAdmins.length <= 1 && activeAdmins.some(a => a.id === existingUser.id)) {
          throw new ValidationError('امکان کاهش سطح دسترسی آخرین مدیر ارشد فعال سامانه وجود ندارد.');
        }
      }
    }

    // 6. Server-side permissions assignment (supports both granular matrix objects and string arrays)
    let finalPermissions: any;
    if (data.permissions && (typeof data.permissions === 'object' || Array.isArray(data.permissions))) {
      finalPermissions = data.permissions;
    } else if (existingUser && existingUser.permissions && typeof existingUser.permissions === 'object' && Object.keys(existingUser.permissions).length > 0) {
      finalPermissions = existingUser.permissions;
    } else {
      finalPermissions = ROLE_PERMISSIONS[canonicalRoleKey] || ROLE_PERMISSIONS[requestedRoleKey] || ROLE_PERMISSIONS['CUSTOM_ROLE'] || ['dashboard:view', 'user:read'];
    }

    // 7. Password handling: normalize digits, strict bcrypt hashing, no plaintext accepted
    let finalPasswordHash = existingUser ? existingUser.passwordHash : null;
    let autoGeneratedPassword = false;
    if (data.password && typeof data.password === 'string' && data.password.trim() !== '') {
      const normPassword = normalizeDigits(data.password.trim());
      finalPasswordHash = hashPassword(normPassword);
    } else if ((data as any).passwordHash && typeof (data as any).passwordHash === 'string' && (data as any).passwordHash.trim() !== '') {
      finalPasswordHash = (data as any).passwordHash.trim();
    } else if (!existingUser) {
      // Auto-provisioned or synced user without explicit password:
      // Assign a secure initial password hash and flag for password reset
      const seed = (data.personnelNumber || data.nationalId || cleanUsername || 'hse').trim();
      const tempPass = seed.length >= 6 ? seed : `${seed}123456`;
      finalPasswordHash = hashPassword(tempPass);
      autoGeneratedPassword = true;
    }

    // 8. Profile data and mustResetPassword handling
    const existingProfile = existingUser ? ((existingUser.profileData as Record<string, any>) || {}) : {};
    const newProfile = typeof data.profileData === 'object' && data.profileData !== null ? data.profileData : {};
    const mergedProfile = {
      ...existingProfile,
      ...newProfile,
      employmentStatus: (data as any).employmentStatus !== undefined ? (data as any).employmentStatus : (newProfile.employmentStatus ?? existingProfile.employmentStatus),
      workShift: (data as any).workShift !== undefined ? (data as any).workShift : (newProfile.workShift ?? existingProfile.workShift),
      supervisor: (data as any).supervisor !== undefined ? (data as any).supervisor : (newProfile.supervisor ?? existingProfile.supervisor),
      emergencyContact: (data as any).emergencyContact !== undefined ? (data as any).emergencyContact : (newProfile.emergencyContact ?? existingProfile.emergencyContact),
      mfaEnabled: (data as any).mfaEnabled !== undefined ? Boolean((data as any).mfaEnabled) : Boolean(newProfile.mfaEnabled ?? existingProfile.mfaEnabled),
      accessExpiresAt: (data as any).accessExpiresAt !== undefined ? (data as any).accessExpiresAt : ((data.profileData as any)?.accessExpiresAt !== undefined ? (data.profileData as any)?.accessExpiresAt : existingProfile.accessExpiresAt),
      accessDurationType: (data as any).accessDurationType !== undefined ? (data as any).accessDurationType : ((data.profileData as any)?.accessDurationType !== undefined ? (data.profileData as any)?.accessDurationType : existingProfile.accessDurationType),
      departmentIds: Array.isArray((data as any).departmentIds) ? (data as any).departmentIds : (Array.isArray((data.profileData as any)?.departmentIds) ? (data.profileData as any)?.departmentIds : (existingProfile.departmentIds || [])),
      mustResetPassword: data.mustResetPassword !== undefined ? Boolean(data.mustResetPassword) : (autoGeneratedPassword ? true : Boolean(existingProfile.mustResetPassword)),
      forcePasswordChange: (data as any).forcePasswordChange !== undefined ? Boolean((data as any).forcePasswordChange) : (autoGeneratedPassword ? true : Boolean(existingProfile.forcePasswordChange)),
      sessionTimeoutMinutes: (data as any).sessionTimeoutMinutes !== undefined ? Number((data as any).sessionTimeoutMinutes) : (existingProfile.sessionTimeoutMinutes || 5),
      signatureImage: (data as any).signatureImage !== undefined ? (data as any).signatureImage : ((data.profileData as any)?.signatureImage !== undefined ? (data.profileData as any)?.signatureImage : (existingProfile.signatureImage || '')),
      profilePhoto: (data as any).profilePhoto !== undefined ? (data as any).profilePhoto : ((data.profileData as any)?.profilePhoto !== undefined ? (data.profileData as any)?.profilePhoto : (existingProfile.profilePhoto || '')),
      ptwQualification: (data as any).ptwQualification !== undefined
        ? (data as any).ptwQualification
        : ((data.profileData as any)?.ptwQualification !== undefined
            ? (data.profileData as any)?.ptwQualification
            : (existingProfile.ptwQualification || null)),
    };

    const valuesToInsert: any = {
      uid: existingUser ? existingUser.uid : targetUid,
      username: cleanUsername || (existingUser ? existingUser.username : userEmail.split('@')[0]),
      email: userEmail,
      fullName: data.fullName || (existingUser ? existingUser.fullName : ''),
      personnelNumber: data.personnelNumber !== undefined ? (data.personnelNumber || null) : (existingUser ? existingUser.personnelNumber : null),
      nationalId: data.nationalId !== undefined ? (data.nationalId || null) : (existingUser ? existingUser.nationalId : null),
      phoneNumber: data.phoneNumber !== undefined ? (data.phoneNumber || null) : (existingUser ? existingUser.phoneNumber : null),
      jobTitle: data.jobTitle !== undefined ? (data.jobTitle || null) : (existingUser ? existingUser.jobTitle : null),
      role: requestedRole,
      accountStatus: data.accountStatus || (existingUser ? existingUser.accountStatus : 'Active'),
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : (data.accountStatus ? data.accountStatus === 'Active' : true),
      permissions: finalPermissions,
      profileData: mergedProfile,
      passwordHash: finalPasswordHash,
      deletedAt: null,
      updatedAt: new Date(),
    };

    let resultUser;
    if (existingUser) {
      const res = await db
        .update(schema.users)
        .set(valuesToInsert)
        .where(eq(schema.users.id, existingUser.id))
        .returning();
      resultUser = res[0];
    } else {
      const res = await db
        .insert(schema.users)
        .values(valuesToInsert)
        .returning();
      resultUser = res[0];
    }

    if (resultUser) {
      delete (resultUser as any).passwordHash;
      (resultUser as any).signatureImage = mergedProfile.signatureImage || '';
      (resultUser as any).profilePhoto = mergedProfile.profilePhoto || '';
      (resultUser as any).ptwQualification = mergedProfile.ptwQualification || null;
    }

    // Also synchronize signatureImage, ptwQualification and core identity to schema.personnel if personnelNumber is present
    const pCode = String(data.personnelNumber || resultUser?.personnelNumber || '').trim();
    if (pCode) {
      try {
        const linkedPersonnel = await db
          .select()
          .from(schema.personnel)
          .where(eq(schema.personnel.personnelCode, pCode));
        if (linkedPersonnel.length > 0) {
          for (const p of linkedPersonnel) {
            const pExtra = (p.extraData && typeof p.extraData === 'object') ? p.extraData : {};
            await db
              .update(schema.personnel)
              .set({
                jobTitle: data.jobTitle || p.jobTitle,
                mobile: data.phoneNumber || p.mobile,
                extraData: {
                  ...pExtra,
                  signatureImage: mergedProfile.signatureImage !== undefined ? mergedProfile.signatureImage : (pExtra as any).signatureImage || '',
                  profilePhoto: mergedProfile.profilePhoto || (pExtra as any).profilePhoto || '',
                  phone: data.phoneNumber || (pExtra as any).phone || '',
                  ptwQualification: mergedProfile.ptwQualification !== undefined ? mergedProfile.ptwQualification : (pExtra as any).ptwQualification,
                },
                updatedAt: new Date(),
              })
              .where(eq(schema.personnel.id, p.id));
          }
        } else if (data.fullName && String(data.fullName).trim()) {
          const nameParts = String(data.fullName).trim().split(/\s+/);
          const firstName = nameParts[0] || String(data.fullName).trim();
          const lastName = nameParts.slice(1).join(' ') || '-';
          await db
            .insert(schema.personnel)
            .values({
              personnelCode: pCode,
              nationalCode: String(data.nationalId || pCode).trim(),
              firstName,
              lastName,
              jobTitle: data.jobTitle || 'کارشناس',
              mobile: data.phoneNumber || '',
              status: 'ACTIVE',
              extraData: {
                signatureImage: mergedProfile.signatureImage || '',
                profilePhoto: mergedProfile.profilePhoto || '',
                phone: data.phoneNumber || '',
                ptwQualification: mergedProfile.ptwQualification || null,
              },
              updatedAt: new Date(),
            })
            .onConflictDoNothing();
        }
      } catch {
        // Non-blocking sync
      }
    }

    // 10. Handle User-to-Personnel Assignment updates if provided or if newly created user
    const hasExplicitAssignmentPayload =
      (data as any).personnelAccessScope !== undefined ||
      Array.isArray((data as any).assignedPersonnelIds);

    if (hasExplicitAssignmentPayload && resultUser) {
      if (!isActorAdmin) {
        throw new ForbiddenError('فقط مدیر ارشد سامانه (Admin) مجاز به تعیین یا تغییر اشخاص مرتبط کاربر است.');
      }
      const requestedScope =
        canonicalRoleKey === 'ADMINISTRATOR'
          ? 'ALL'
          : String((data as any).personnelAccessScope || resultUser.personnelAccessScope || 'ASSIGNED').toUpperCase() === 'ALL'
          ? 'ALL'
          : 'ASSIGNED';

      const requestedPersonnelIds = Array.isArray((data as any).assignedPersonnelIds)
        ? (data as any).assignedPersonnelIds
        : (await personnelAccessService.resolveAccessContext(resultUser.id)).assignedPersonnelIds;

      await personnelAccessService.updateUserPersonnelAssignments({
        targetUserIdentifier: resultUser.id,
        scope: requestedScope,
        personnelIds: requestedPersonnelIds,
        actor:
          typeof actor === 'object'
            ? {
                uid: actor.uid,
                fullName: actor.name,
                role: actor.role || 'Administrator',
              }
            : {
                uid: String(actor || 'admin'),
                fullName: actorName,
                role: 'Administrator',
              },
        skipAdminCheck: true,
      });
    } else if (!existingUser && resultUser) {
      // For a brand-new user without explicit assignment payload:
      // If Administrator -> set scope ALL; otherwise if personnelNumber matches an active personnel record, link it automatically
      if (canonicalRoleKey === 'ADMINISTRATOR') {
        await db
          .update(schema.users)
          .set({ personnelAccessScope: 'ALL' })
          .where(eq(schema.users.id, resultUser.id));
      } else if (pCode) {
        try {
          const matchedP = await db
            .select()
            .from(schema.personnel)
            .where(eq(schema.personnel.personnelCode, pCode))
            .limit(1);
          if (matchedP.length > 0) {
            await personnelAccessService.updateUserPersonnelAssignments({
              targetUserIdentifier: resultUser.id,
              scope: 'ASSIGNED',
              personnelIds: [matchedP[0].id],
              actor: { uid: 'system', fullName: actorName, role: 'Administrator' },
              skipAdminCheck: true,
            });
          }
        } catch {
          // Non-blocking initial self-assignment
        }
      }
    }

    try {
      await auditService.log({
        action: existingUser ? 'UPDATE_USER' : 'CREATE_USER',
        module: 'USERS',
        entityType: 'USER',
        entityId: String(resultUser?.uid || targetUid),
        details: { role: requestedRole, email: userEmail, actor: actorName },
      });
    } catch (auditErr) {
      logger.warn('User upsert audit log warning', { error: String(auditErr) });
    }

    if (resultUser) {
      const updatedCtx = await personnelAccessService.resolveAccessContext(resultUser.id);
      (resultUser as any).personnelAccessScope = updatedCtx.scope;
      (resultUser as any).canAccessAllPersonnel = updatedCtx.canAccessAll;
      (resultUser as any).assignedPersonnelIds = updatedCtx.assignedPersonnel.map((p) => p.id);
      (resultUser as any).assignedPersonnelCodes = updatedCtx.assignedPersonnel.map((p) => p.personnelCode);
      (resultUser as any).assignedPersonnel = updatedCtx.assignedPersonnel;
    }

    return resultUser;
  }

  async softDeleteUser(uidIdentifier: string, actor?: { uid?: string; role?: string; name?: string } | string) {
    let actorName = 'system';
    let isActorAdmin = true;

    if (actor && typeof actor === 'object') {
      actorName = (actor as any).name || (actor as any).fullName || (actor as any).username || (actor as any).uid || 'system';
      const rawRole = ((actor as any).role || '').toUpperCase().replace(/[\s_]+/g, '');
      if (rawRole) {
        isActorAdmin = rawRole.includes('ADMIN') || rawRole.includes('SUPER') || rawRole === 'ADMINISTRATOR';
      }
    } else if (typeof actor === 'string' && actor.trim()) {
      actorName = actor;
    }

    if (!isActorAdmin) {
      throw new ForbiddenError('فقط مدیر ارشد سیستم مجاز به حذف کاربران است.');
    }

    const cleanId = String(uidIdentifier || '').trim();
    if (!cleanId) {
      throw new ValidationError('شناسه کاربر نامعتبر است.');
    }

    const isNum = !isNaN(Number(cleanId)) && Number(cleanId) > 0;
    const conditions = [
      eq(schema.users.uid, cleanId),
      eq(schema.users.username, cleanId)
    ];
    if (isNum) {
      conditions.push(eq(schema.users.id, Number(cleanId)));
    }

    const existing = await db
      .select()
      .from(schema.users)
      .where(and(or(...conditions), isNull(schema.users.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      // Check if user already exists but was previously soft-deleted (idempotent delete)
      const alreadyDeleted = await db
        .select()
        .from(schema.users)
        .where(or(...conditions))
        .limit(1);

      if (alreadyDeleted.length > 0) {
        return alreadyDeleted[0];
      }
      throw new NotFoundError('کاربر مورد نظر یافت نشد.');
    }

    const targetUser = existing[0];
    const targetRoleKey = (targetUser.role || '').toUpperCase().replace(/[\s_]+/g, '');
    if (targetRoleKey === 'ADMIN' || targetRoleKey === 'ADMINISTRATOR' || targetRoleKey === 'SUPERADMIN') {
      const activeAdmins = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          and(
            isNull(schema.users.deletedAt),
            eq(schema.users.isActive, true),
            sql`UPPER(REPLACE(REPLACE(${schema.users.role}, ' ', ''), '_', '')) IN ('ADMIN', 'ADMINISTRATOR', 'SUPERADMIN')`
          )
        );

      if (activeAdmins.length <= 1) {
        throw new ValidationError('امکان حذف آخرین مدیر ارشد فعال سامانه وجود ندارد.');
      }
    }

    await db
      .update(schema.users)
      .set({
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, targetUser.id));

    await auditService.log({
      action: 'SOFT_DELETE_USER',
      module: 'USERS',
      entityType: 'USER',
      entityId: String(targetUser.id),
      details: { actor: actorName, username: targetUser.username, uid: targetUser.uid },
    });

    return targetUser;
  }
}

export const authService = new AuthService();
