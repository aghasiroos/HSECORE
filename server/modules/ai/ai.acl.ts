import {
  checkUserHasPermission,
  isGlobalAdminUser,
  normalizeRoleToCanonical,
  type UserContext,
} from '../../core/middleware/auth.ts';

export interface KnowledgeDocumentAccessControl {
  allowedRoles?: string[];
  requiredPermissions?: string[];
  departmentIds?: number[];
  unitIds?: number[];
  userUids?: string[];
}

export interface KnowledgeDocumentScope {
  departmentIds: number[];
  unitIds: number[];
}

/**
 * Evaluates document ACL metadata after category-level permissions have passed.
 * Documents without ACL metadata retain legacy category-based access.
 */
export function canAccessKnowledgeDocument(
  metadata: unknown,
  user: UserContext | undefined,
  scope: KnowledgeDocumentScope = { departmentIds: [], unitIds: [] },
): boolean {
  if (!user) return false;

  const rawMetadata = metadata && typeof metadata === 'object'
    ? metadata as Record<string, unknown>
    : {};
  const acl = rawMetadata.accessControl as KnowledgeDocumentAccessControl | undefined;

  // Backward compatibility: documents indexed before document ACL existed.
  if (!acl || typeof acl !== 'object') return true;
  if (isGlobalAdminUser(user)) return true;

  if (Array.isArray(acl.userUids) && acl.userUids.length > 0 &&
      !acl.userUids.includes(user.uid)) return false;

  if (Array.isArray(acl.allowedRoles) && acl.allowedRoles.length > 0) {
    const userRole = normalizeRoleToCanonical(user.role);
    const roleAllowed = acl.allowedRoles.some(role =>
      role === '*' ||
      role.toUpperCase() === String(user.role || '').toUpperCase() ||
      normalizeRoleToCanonical(role) === userRole
    );
    if (!roleAllowed) return false;
  }

  if (Array.isArray(acl.requiredPermissions) && acl.requiredPermissions.length > 0 &&
      !acl.requiredPermissions.every(permission => checkUserHasPermission(user, permission))) {
    return false;
  }

  if (Array.isArray(acl.departmentIds) && acl.departmentIds.length > 0 &&
      !acl.departmentIds.some(id => scope.departmentIds.includes(id))) return false;

  if (Array.isArray(acl.unitIds) && acl.unitIds.length > 0 &&
      !acl.unitIds.some(id => scope.unitIds.includes(id))) return false;

  return true;
}
