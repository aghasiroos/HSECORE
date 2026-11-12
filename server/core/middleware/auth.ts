import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.ts';
import { UnauthorizedError, ForbiddenError } from '../errors.ts';
import { logger } from '../logger.ts';

export interface UserContext {
  uid: string;
  id?: number;
  email?: string;
  username?: string;
  name?: string;
  role: string;
  personnelCode?: string;
  department?: string;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

// Enterprise role permissions matrix
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['*'],
  ADMINISTRATOR: ['*'],
  HSE_MANAGER: [
    'ptw:*',
    'incidents:*',
    'health:*',
    'workflow:*',
    'audit:read',
    'personnel:read',
    'reports:*',
    'fire_equipment:*',
    'five_s:*',
    'warnings:*',
    'documents:*',
    'notifications:*',
    'orgstructure:*',
  ],
  EXECUTIVE_MANAGER: [
    'ptw:*',
    'incidents:*',
    'health:*',
    'workflow:*',
    'audit:read',
    'personnel:read',
    'reports:*',
    'fire_equipment:*',
    'five_s:*',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  EXECUTIVEMANAGER: [
    'ptw:*',
    'incidents:*',
    'health:*',
    'workflow:*',
    'audit:read',
    'personnel:read',
    'reports:*',
    'fire_equipment:*',
    'five_s:*',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  FIRE_OFFICER: [
    'fire_equipment:*',
    'ptw:read',
    'incidents:create',
    'incidents:read',
    'incidents:update',
    'workflow:action',
    'notifications:read',
    'notifications:create',
    'reports:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  PROCESS_MANAGER: [
    'workflow:*',
    'reports:*',
    'documents:*',
    'notifications:read',
  ],
  SAFETY_OFFICER: [
    'ptw:read',
    'ptw:create',
    'ptw:sign',
    'incidents:create',
    'incidents:read',
    'incidents:update',
    'workflow:action',
    'fire_equipment:read',
    'fire_equipment:update',
    'warnings:*',
    'reports:read',
    'documents:read',
    'documents:create',
    'documents:update',
    'notifications:read',
    'notifications:create',
  ],
  SAFETY_INSPECTOR: [
    'ptw:read',
    'ptw:create',
    'ptw:sign',
    'incidents:create',
    'incidents:read',
    'incidents:update',
    'workflow:action',
    'fire_equipment:read',
    'fire_equipment:update',
    'warnings:*',
    'reports:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  SAFETYINSPECTOR: [
    'ptw:read',
    'ptw:create',
    'ptw:sign',
    'incidents:create',
    'incidents:read',
    'incidents:update',
    'workflow:action',
    'fire_equipment:read',
    'fire_equipment:update',
    'warnings:*',
    'reports:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  DOCTOR_OCCUPATIONAL: [
    'health:*',
    'personnel:read',
    'workflow:action',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  MEDICAL_STAFF: [
    'health:*',
    'personnel:read',
    'workflow:action',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  MEDICALSTAFF: [
    'health:*',
    'personnel:read',
    'workflow:action',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  NUTRITIONIST: [
    'health:*',
    'personnel:read',
    'reports:read',
    'workflow:action',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  NUTRITION_EXPERT: [
    'health:*',
    'personnel:read',
    'reports:read',
    'workflow:action',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  WORKER: [
    'ptw:read',
    'incidents:create',
    'health:read_own',
    'notifications:read',
    'documents:read',
  ],
  CONTRACTOR: [
    'ptw:read',
    'ptw:create',
    'incidents:create',
    'notifications:read',
    'documents:read',
  ],
  AUDITOR: [
    'ptw:read',
    'audit:read',
    'incidents:read',
    'reports:read',
    'notifications:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  PROJECT_MANAGER: [
    'ptw:*',
    'incidents:read',
    'reports:*',
    'notifications:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  PROJECTMANAGER: [
    'ptw:*',
    'incidents:read',
    'reports:*',
    'notifications:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  MAINTENANCE_MANAGER: [
    'ptw:*',
    'fire_equipment:*',
    'safety_equipment:*',
    'reports:read',
    'notifications:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  MAINTENANCEMANAGER: [
    'ptw:*',
    'fire_equipment:*',
    'safety_equipment:*',
    'reports:read',
    'notifications:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  SUPERVISOR: [
    'ptw:read',
    'ptw:create',
    'incidents:create',
    'incidents:read',
    'warnings:read',
    'reports:read',
    'notifications:read',
    'documents:read',
    'documents:create',
    'documents:update',
  ],
  VISITOR: [
    'notifications:read',
    'documents:read',
  ],
  GUEST: [
    'notifications:read',
  ],
  USER: [
    'dashboard:view',
    'ptw:read',
    'incidents:create',
    'notifications:read',
    'documents:read',
  ],
  // Custom roles must receive only explicitly configured permissions.
  // An unknown/custom role must never inherit broad module access by default.
  CUSTOM_ROLE: [],
};

/**
 * Normalizes any role input (Persian, English, custom) to canonical uppercase key.
 */
export function normalizeRoleToCanonical(roleInput?: string): string {
  if (!roleInput || typeof roleInput !== 'string') return 'USER';
  const trimmed = roleInput.trim();
  const cleaned = trimmed.toUpperCase().replace(/\s+|_/g, '');

  // Direct matches
  if (ROLE_PERMISSIONS[cleaned]) return cleaned;

  // Persian & alias mappings
  if (cleaned.includes('مدیرارشد') || cleaned.includes('مدیرسیستم') || cleaned.includes('مدیرسامانه') || cleaned.includes('مدیرکل') || cleaned === 'ADMIN' || cleaned === 'ADMINISTRATOR' || cleaned === 'SUPERADMIN') {
    return 'ADMINISTRATOR';
  }
  if (cleaned.includes('HSE') || cleaned.includes('مدیرایمنی')) {
    return 'HSE_MANAGER';
  }
  if (cleaned.includes('آتشنشان') || cleaned.includes('آتش‌نشان') || cleaned.includes('FIRE')) {
    return 'FIRE_OFFICER';
  }
  if (cleaned.includes('فرآیند') || cleaned.includes('PROCESS')) {
    return 'PROCESS_MANAGER';
  }
  if (cleaned.includes('ایمنی') || cleaned.includes('بازرس') || cleaned.includes('SAFETY') || cleaned.includes('INSPECTOR')) {
    return 'SAFETY_OFFICER';
  }
  if (cleaned.includes('بهداشت') || cleaned.includes('پزشک') || cleaned.includes('درمان') || cleaned.includes('طبکار') || cleaned.includes('DOCTOR') || cleaned.includes('MEDICAL') || cleaned.includes('HEALTH')) {
    return 'DOCTOR_OCCUPATIONAL';
  }
  if (cleaned.includes('پیمانکار') || cleaned.includes('CONTRACTOR')) {
    return 'CONTRACTOR';
  }
  if (cleaned.includes('اجرایی') || cleaned.includes('مجتمع') || cleaned.includes('DIRECTOR') || cleaned.includes('EXECUTIVE')) {
    return 'EXECUTIVE_MANAGER';
  }
  if (cleaned.includes('ممیز') || cleaned.includes('AUDIT')) {
    return 'AUDITOR';
  }
  if (cleaned.includes('پروژه') || cleaned.includes('PROJECT')) {
    return 'PROJECT_MANAGER';
  }
  if (cleaned.includes('سرپرست') || cleaned.includes('مسئولواحد') || cleaned.includes('SUPERVISOR') || cleaned.includes('UNIT')) {
    return 'SUPERVISOR';
  }
  if (cleaned.includes('کارگر') || cleaned.includes('پرسنل') || cleaned.includes('WORKER') || cleaned.includes('STAFF')) {
    return 'WORKER';
  }
  if (cleaned.includes('اختصاصی') || cleaned.includes('CUSTOM') || (cleaned && cleaned !== 'USER' && cleaned !== 'کاربر' && cleaned !== 'STANDARDUSER')) {
    return 'CUSTOM_ROLE';
  }

  return cleaned || 'USER';
}

/**
 * Checks whether user has a specific permission, safely handling:
 * - String arrays (e.g. ['ptw:*', 'incidents:create'])
 * - Object permissions (e.g. { 'Permit To Work': { create: true } })
 * - Role-based permissions matrix fallback
 */
export function checkUserHasPermission(user: UserContext | undefined, permission: string): boolean {
  if (!user) return false;
  const canonicalRole = normalizeRoleToCanonical(user.role);
  if (canonicalRole === 'ADMINISTRATOR' || canonicalRole === 'ADMIN') return true;

  // Support: 'ptw:create', 'ptw.issuance:sign', 'ptw.sign', 'fire_dept.fleet.create'
  let reqModule: string;
  let reqAction: string;

  if (permission.includes(':')) {
    const parts = permission.split(':');
    reqModule = parts[0];
    reqAction = parts[1] || 'view';
  } else if (permission.includes('.')) {
    const lastDotIdx = permission.lastIndexOf('.');
    reqModule = permission.substring(0, lastDotIdx);
    reqAction = permission.substring(lastDotIdx + 1);
  } else {
    reqModule = permission;
    reqAction = 'view';
  }

  // 1. If user.permissions is an Array
  if (Array.isArray(user.permissions)) {
    const list = user.permissions.map(String);
    if (list.includes('*')) return true;
    if (list.includes(permission)) return true;
    if (list.includes(`${reqModule}:${reqAction}`)) return true;
    if (list.includes(`${reqModule}:*`)) return true;
    if (list.some(p => p.endsWith(':*') && permission.startsWith(p.replace(':*', '')))) return true;
  }

  // 2. If user.permissions is an Object (UserPermissions matrix from UI / DB)
  if (user.permissions && typeof user.permissions === 'object' && !Array.isArray(user.permissions)) {
    const permsObj = user.permissions as Record<string, any>;
    if (permsObj['all'] === true || permsObj['*'] === true) return true;

    // 2.1 Direct match on exact reqModule
    if (permsObj[reqModule] && typeof permsObj[reqModule] === 'object') {
      const nodeActions = permsObj[reqModule];
      if (nodeActions['all'] === true) return true;
      if (nodeActions[reqAction] === true) return true;
      if (reqAction === 'read' && nodeActions['view'] === true) return true;
      if (reqAction === 'view' && nodeActions['read'] === true) return true;
      if (reqAction === 'details' && nodeActions['view'] === true) return true;
      if (reqAction === 'update' && nodeActions['edit'] === true) return true;
      if (reqAction === 'edit' && nodeActions['update'] === true) return true;
      if (reqAction === 'sign' && (nodeActions['approve'] === true || nodeActions['sign'] === true)) return true;
      if (reqAction === 'reject' && (nodeActions['approve'] === true || nodeActions['reject'] === true)) return true;
      if (reqAction === 'refer' && (nodeActions['approve'] === true || nodeActions['refer'] === true)) return true;
      if (reqAction === '*' && (nodeActions['view'] === true || nodeActions['create'] === true)) return true;
      if (nodeActions[reqAction] === false) return false;
    }

    // 2.2 Check by matching normalized module keys and legacy aliases
    const cleanReqMod = reqModule.toLowerCase().replace(/\s+|_/g, '');
    let explicitlyDenied = false;
    for (const [modKey, actions] of Object.entries(permsObj)) {
      const cleanModKey = modKey.toLowerCase().replace(/\s+|_/g, '');
      const isPendingDocsKey = cleanModKey.includes('pendingdocument');
      const matches =
        cleanModKey === cleanReqMod ||
        cleanModKey.startsWith(cleanReqMod + '.') ||
        cleanReqMod.startsWith(cleanModKey + '.') ||
        (cleanReqMod.includes('ptw') && (cleanModKey.includes('permit') || cleanModKey.includes('ptw'))) ||
        (cleanReqMod.includes('incident') && cleanModKey.includes('incident')) ||
        (cleanReqMod.includes('health') && (cleanModKey.includes('health') || cleanModKey.includes('medical'))) ||
        (cleanReqMod.includes('warning') && (cleanModKey.includes('warning') || cleanModKey.includes('employee'))) ||
        (cleanReqMod.includes('report') && (cleanModKey.includes('report') || cleanModKey.includes('trir'))) ||
        (cleanReqMod.includes('document') && !cleanReqMod.includes('pending') && !isPendingDocsKey && (cleanModKey.includes('document') || cleanModKey.includes('مستند'))) ||
        (cleanReqMod.includes('notification') && (cleanModKey.includes('notification') || cleanModKey.includes('اعلان') || cleanModKey.includes('alert'))) ||
        (cleanReqMod.includes('orgstructure') && (cleanModKey.includes('orgstructure') || cleanModKey.includes('organization') || cleanModKey.includes('ساختار')));

      if (matches && typeof actions === 'object' && actions !== null) {
        if (actions['all'] === true) return true;
        if (reqAction === '*' && (actions['view'] === true || actions['create'] === true || actions['edit'] === true || actions['all'] === true)) return true;
        if (actions[reqAction] === true) return true;
        if (reqAction === 'read' && actions['view'] === true) return true;
        if (reqAction === 'view' && actions['read'] === true) return true;
        if (reqAction === 'details' && actions['view'] === true) return true;
        if (reqAction === 'update' && actions['edit'] === true) return true;
        if (reqAction === 'edit' && actions['update'] === true) return true;
        if (reqAction === 'create' && actions['create'] === true) return true;
        if (reqAction === 'delete' && actions['delete'] === true) return true;
        if (reqAction === 'sign' && (actions['sign'] === true || actions['approve'] === true)) return true;
        if (reqAction === 'reject' && (actions['reject'] === true || actions['approve'] === true)) return true;
        if (reqAction === 'refer' && (actions['refer'] === true || actions['approve'] === true)) return true;
        if (reqAction === 'emergency' && actions['emergency'] === true) return true;
        if (reqAction === 'configure' && actions['configure'] === true) return true;

        if (reqAction === 'read' && actions['view'] === false) explicitlyDenied = true;
        if (reqAction === 'update' && actions['edit'] === false) explicitlyDenied = true;
        if (typeof actions[reqAction] === 'boolean' && actions[reqAction] === false) explicitlyDenied = true;
      }
    }
    if (explicitlyDenied) return false;
  }

  // 3. Fallback to canonical role matrix
  const rolePerms = ROLE_PERMISSIONS[canonicalRole] || [];
  if (rolePerms.includes('*')) return true;
  if (rolePerms.includes(permission)) return true;
  if (rolePerms.includes(`${reqModule}:${reqAction}`)) return true;
  if (rolePerms.includes(`${reqModule}:*`)) return true;
  if (rolePerms.some(p => p.endsWith(':*') && permission.startsWith(p.replace(':*', '')))) return true;

  return false;
}

const liveUserPermsCache = new Map<string, { role: string; permissions: any; expiresAt: number }>();

async function resolveLiveUserContext(user: UserContext): Promise<UserContext> {
  if (!user.uid) return user;
  const cached = liveUserPermsCache.get(user.uid);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...user, role: cached.role || user.role, permissions: cached.permissions ?? user.permissions };
  }
  try {
    const { db, schema } = await import('../db.ts');
    const { eq } = await import('drizzle-orm');
    const [dbUser] = await db
      .select({ role: schema.users.role, permissions: schema.users.permissions })
      .from(schema.users)
      .where(eq(schema.users.uid, user.uid))
      .limit(1);
    if (dbUser) {
      liveUserPermsCache.set(user.uid, {
        role: dbUser.role || user.role,
        permissions: dbUser.permissions,
        expiresAt: Date.now() + 15000,
      });
      return {
        ...user,
        role: dbUser.role || user.role,
        permissions: (dbUser.permissions as any) ?? user.permissions,
      };
    }
  } catch {
    // Fallback to token user context
  }
  return user;
}

/**
 * Strictly checks whether a user is the System Manager or Main Application Admin
 * (مدیر سامانه و ادمین اصلی برنامه) who is allowed global visibility across all cartables.
 */
export function isGlobalAdminUser(user?: UserContext | any | null): boolean {
  if (!user) return false;
  const rawRole = String(user.role || '').trim();
  const upperRole = rawRole.toUpperCase().replace(/\s+|_/g, '');

  // Global administrator status is role-based only. A username or UID is not
  // an authorization credential and must never grant elevated privileges.
  if (
    upperRole === 'ADMIN' ||
    upperRole === 'ADMINISTRATOR' ||
    upperRole === 'SUPERADMIN' ||
    rawRole.includes('مدیر سامانه') ||
    rawRole.includes('مدیر سیستم') ||
    rawRole.includes('مدیر ارشد') ||
    rawRole.includes('ادمین اصلی') ||
    rawRole.includes('مدیر کل')
  ) {
    return true;
  }
  return false;
}

export async function authenticateToken(req: Request): Promise<UserContext | null> {
  // 1. First priority: Check HttpOnly cookie hse_auth_token
  let token = (req as any).cookies?.hse_auth_token;

  // 2. Second priority: Check Authorization Bearer header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1]?.trim();
    }
  }

  // 3. Third priority: Check query parameter token (for SSE EventSource or direct streams)
  if (!token && typeof req.query?.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return null;
  }

  // Strictly verify application server-signed JWT
  try {
    const decoded = jwt.verify(token, config.security.jwtSecret) as any;
    if (decoded && decoded.uid) {
      const rawRole = (decoded.role || 'USER').toUpperCase();
      const canonicalRole = normalizeRoleToCanonical(decoded.role);
      const perms = decoded.permissions || ROLE_PERMISSIONS[canonicalRole] || ROLE_PERMISSIONS[rawRole] || ['user:read'];
      return {
        uid: decoded.uid,
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        name: decoded.name || decoded.fullName || decoded.username || decoded.email,
        role: decoded.role || 'USER',
        personnelCode: decoded.personnelCode || decoded.personnelNumber,
        department: decoded.department,
        permissions: perms,
      };
    }
  } catch (jwtErr: any) {
    if (jwtErr.name === 'TokenExpiredError') {
      logger.debug('JWT token expired', { tokenSnippet: token.substring(0, 10) });
    } else {
      logger.debug('JWT verification failed', { error: jwtErr.message });
    }
  }

  // Strictly return null if signature is invalid - NO spoofable header fallback
  return null;
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateToken(req);
    if (user) {
      req.user = user;
    }
    next();
  } catch (error) {
    logger.warn('Optional auth parsing error', { error: String(error) });
    next();
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authenticateToken(req);
    if (!user) {
      return next(new UnauthorizedError('برای دسترسی به این بخش لطفاً ابتدا وارد سامانه شوید (توکن نامعتبر یا منقضی است).'));
    }
    req.user = user;
    next();
  } catch (error) {
    next(new UnauthorizedError('توکن دسترسی نامعتبر است یا منقضی شده است.'));
  }
}

export function requireRole(...allowedRoles: string[]) {
  const normalizedAllowed = allowedRoles.map(r => r.toUpperCase().replace(/\s+|_/g, ''));
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('احراز هویت الزامی است.'));
    }
    const rawRole = (req.user.role || 'USER').toUpperCase().replace(/\s+|_/g, '');
    const canonicalRole = normalizeRoleToCanonical(req.user.role);

    // 1. Full system administrator override
    if (canonicalRole === 'ADMIN' || canonicalRole === 'ADMINISTRATOR' || rawRole === 'ADMIN' || rawRole === 'ADMINISTRATOR') {
      return next();
    }

    // 2. Direct or canonical role match
    if (normalizedAllowed.includes(rawRole) || normalizedAllowed.includes(canonicalRole)) {
      return next();
    }

    // 3. Dynamic permissions check for custom roles (نقش‌های اختصاصی)
    // If route requires SAFETY_OFFICER, check if user has ptw, incidents, warnings or safety permission
    const requiresSafety = normalizedAllowed.some(r => r.includes('SAFETY') || r.includes('HSE'));
    const requiresHealth = normalizedAllowed.some(r => r.includes('DOCTOR') || r.includes('MEDICAL'));
    const requiresAuditor = normalizedAllowed.some(r => r.includes('AUDIT'));

    if (requiresSafety && (
      checkUserHasPermission(req.user, 'ptw:*') ||
      checkUserHasPermission(req.user, 'ptw:create') ||
      checkUserHasPermission(req.user, 'ptw:read') ||
      checkUserHasPermission(req.user, 'incidents:*') ||
      checkUserHasPermission(req.user, 'incidents:create') ||
      checkUserHasPermission(req.user, 'incidents:read') ||
      checkUserHasPermission(req.user, 'warnings:*') ||
      checkUserHasPermission(req.user, 'safety:*')
    )) {
      return next();
    }
    if (requiresHealth && (
      checkUserHasPermission(req.user, 'health:*') ||
      checkUserHasPermission(req.user, 'health:read') ||
      checkUserHasPermission(req.user, 'health:create') ||
      checkUserHasPermission(req.user, 'medical:*')
    )) {
      return next();
    }
    if (requiresAuditor && (
      checkUserHasPermission(req.user, 'audit:read') ||
      checkUserHasPermission(req.user, 'audit:*') ||
      checkUserHasPermission(req.user, 'ptw:*')
    )) {
      return next();
    }

    // 4. Wildcard access check
    if (checkUserHasPermission(req.user, '*')) {
      return next();
    }

    return next(new ForbiddenError(`نقش کاربری شما (${req.user.role}) مجاز به دسترسی به این بخش نمی‌باشد.`));
  };
}

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError('احراز هویت الزامی است.'));
      }
      const canonicalRole = normalizeRoleToCanonical(req.user.role);
      if (canonicalRole === 'ADMIN' || canonicalRole === 'ADMINISTRATOR' || isGlobalAdminUser(req.user)) {
        return next();
      }

      if (checkUserHasPermission(req.user, permission)) {
        return next();
      }

      // Fallback: check live user permissions object from database in case compact JWT scopes omitted custom object permissions
      const liveUser = await resolveLiveUserContext(req.user);
      if (isGlobalAdminUser(liveUser) || checkUserHasPermission(liveUser, permission)) {
        req.user = liveUser;
        return next();
      }

      return next(new ForbiddenError(`مجوز امنیتی '${permission}' برای کاربر شما صادر نشده است.`));
    } catch (err) {
      return next(err);
    }
  };
}
