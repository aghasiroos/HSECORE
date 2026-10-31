import assert from 'node:assert/strict';
import { canAccessKnowledgeDocument } from '../server/modules/ai/ai.acl.ts';
import type { UserContext } from '../server/core/middleware/auth.ts';

const user: UserContext = {
  uid: 'user-42',
  role: 'SAFETY_OFFICER',
  permissions: ['ptw:read', 'safety:read'],
};

const scope = { departmentIds: [10], unitIds: [101] };
let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('PASS', name);
}

test('legacy document remains governed by category permission', () => {
  assert.equal(canAccessKnowledgeDocument({}, user, scope), true);
});

test('missing authenticated user is denied', () => {
  assert.equal(canAccessKnowledgeDocument({ accessControl: {} }, undefined, scope), false);
});

test('explicit role allow-list grants matching role', () => {
  assert.equal(canAccessKnowledgeDocument({ accessControl: { allowedRoles: ['SAFETY_OFFICER'] } }, user, scope), true);
});

test('explicit role allow-list denies different role', () => {
  assert.equal(canAccessKnowledgeDocument({ accessControl: { allowedRoles: ['DOCTOR_OCCUPATIONAL'] } }, user, scope), false);
});

test('unknown custom roles do not match via shared fallback role', () => {
  const customUser = { ...user, role: 'CUSTOM_ROLE_ALPHA' };
  assert.equal(canAccessKnowledgeDocument({ accessControl: { allowedRoles: ['CUSTOM_ROLE_BETA'] } }, customUser, scope), false);
});

test('required permissions are enforced', () => {
  assert.equal(canAccessKnowledgeDocument({ accessControl: { requiredPermissions: ['ptw:read'] } }, user, scope), true);
  assert.equal(canAccessKnowledgeDocument({ accessControl: { requiredPermissions: ['health:read'] } }, user, scope), false);
});

test('department restriction is enforced', () => {
  assert.equal(canAccessKnowledgeDocument({ accessControl: { departmentIds: [10] } }, user, scope), true);
  assert.equal(canAccessKnowledgeDocument({ accessControl: { departmentIds: [20] } }, user, scope), false);
});

test('unit restriction is enforced', () => {
  assert.equal(canAccessKnowledgeDocument({ accessControl: { unitIds: [101] } }, user, scope), true);
  assert.equal(canAccessKnowledgeDocument({ accessControl: { unitIds: [202] } }, user, scope), false);
});

test('user UID restriction is enforced', () => {
  assert.equal(canAccessKnowledgeDocument({ accessControl: { userUids: ['user-42'] } }, user, scope), true);
  assert.equal(canAccessKnowledgeDocument({ accessControl: { userUids: ['user-99'] } }, user, scope), false);
});

test('all configured restrictions must pass', () => {
  assert.equal(canAccessKnowledgeDocument({
    accessControl: { allowedRoles: ['SAFETY_OFFICER'], requiredPermissions: ['ptw:read'], departmentIds: [10], unitIds: [101] },
  }, user, scope), true);
  assert.equal(canAccessKnowledgeDocument({
    accessControl: { allowedRoles: ['SAFETY_OFFICER'], requiredPermissions: ['ptw:read'], departmentIds: [10], unitIds: [202] },
  }, user, scope), false);
});

test('global administrator bypasses document ACL restrictions', () => {
  const admin: UserContext = { uid: 'admin-1', username: 'admin', role: 'ADMIN' };
  assert.equal(canAccessKnowledgeDocument({
    accessControl: { allowedRoles: ['DOCTOR_OCCUPATIONAL'], departmentIds: [999], unitIds: [999] },
  }, admin, { departmentIds: [], unitIds: [] }), true);
});

console.log('AI document ACL tests: ' + passed + '/11 passed');
