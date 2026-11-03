import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveBackupRestorePath } from '../server/services/backup-restore-path.ts';

const root = path.resolve('/tmp/hsecore-restore-test');

assert.equal(
  resolveBackupRestorePath(root, 'documents/report.pdf'),
  path.join(root, 'documents', 'report.pdf'),
);
assert.equal(
  resolveBackupRestorePath(root, 'legacy\\nested\\report.pdf'),
  path.join(root, 'legacy', 'nested', 'report.pdf'),
);

for (const unsafePath of [
  '../outside.txt',
  'documents/../../outside.txt',
  'documents/../../../etc/passwd',
  '/etc/passwd',
  'C:\\Windows\\win.ini',
  '\\\\server\\share\\file.txt',
  'documents/../outside.txt',
  '',
]) {
  assert.throws(
    () => resolveBackupRestorePath(root, unsafePath),
    undefined,
    `Expected path to be rejected: ${unsafePath}`,
  );
}

console.log('Backup restore path safety tests passed.');
