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
  assignments?: Array<{ departmentId: number | null; unitId: number | null }>;
}

/**
 * Evaluates document ACL metadata after category-level permissions have passed.
 * Documents with an empty metadata object or without an accessControl key retain
 * legacy category-based access. Malformed metadata and malformed ACL values fail closed.
 */
export function canAccessKnowledgeDocument(
  metadata: unknown,
  user: UserContext | undefined,
  scope: KnowledgeDocumentScope = { departmentIds: [], unitIds: [] },
): boolean {
  if (!user) return false;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false;

  const rawMetadata = metadata as Record<string, unknown>;
  const hasAccessControl = Object.prototype.hasOwnProperty.call(rawMetadata, 'accessControl');
  const aclValue = rawMetadata.accessControl;

  // Backward compatibility applies only when ACL metadata is truly absent.
  // A present but malformed ACL must never silently become unrestricted.
  if (!hasAccessControl) return true;
  if (!aclValue || typeof aclValue !== 'object' || Array.isArray(aclValue)) return false;
  const acl = aclValue as KnowledgeDocumentAccessControl;
  const validStringList = (value: unknown) => value === undefined || (Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length >  0));
  const validIdList = (value: unknown) => value === undefined || (Array.isArray(value) && value.every(item => Number.isInteger(item) && item > 0));
  if (!validStringList(acl.allowedRoles) || !validStringList(acl.requiredPermissions) ||
      !validStringList(acl.userUids) || !validIdList(acl.departmentIds) || !validIdList(acl.unitIds)) return false;
  if (isGlobalAdminUser(user)) return true;

  if (Array.isArray(acl.userUids) && acl.userUids.length > 0 &&
      !acl.userUids.includes(user.uid)) return false;

  if (Array.isArray(acl.allowedRoles) && acl.allowedRoles.length > 0) {
    const userRole = normalizeRoleToCanonical(user.role);
    const roleAllowed = acl.allowedRoles.some(role =>
      role === '*' ||
      role.toUpperCase() === String(user.role || '').toUpperCase() ||
      normalizeRoleToCanonical(role) !== 'CUSTOM_ROLE' && normalizeRoleToCanonical(role) === userRole
    );
    if (!roleAllowed) return false;
  }

  if (Array.isArray(acl.requiredPermissions) && acl.requiredPermissions.length > 0 &&
      !acl.requiredPermissions.every(permission => checkUserHasPermission(user, permission))) {
    return false;
  }

  const departmentRestricted = Array.isArray(acl.departmentIds) && acl.departmentIds.length > 0;
  const unitRestricted = Array.isArray(acl.unitIds) && acl.unitIds.length > 0;
  if (departmentRestricted && unitRestricted) {
    const sameAssignmentMatches = (scope.assignments || []).some(assignment =>
      assignment.departmentId !== null && assignment.unitId !== null &&
      acl.departmentIds!.includes(assignment.departmentId) &&
      acl.unitIds!.includes(assignment.unitId)
    );
    if (!sameAssignmentMatches) return false;
  } else if (departmentRestricted && !acl.departmentIds!.some(id => scope.departmentIds.includes(id))) {
    return false;
  } else if (unitRestricted && !acl.unitIds!.some(id => scope.unitIds.includes(id))) {
    return false;
  }

  return true;
}
