import assert from 'node:assert/strict';
import { selectScheduledBackupsForRetention } from '../server/services/backup-retention.ts';

const backups = [
  { backupId: 'scheduled-newest', tag: 'scheduled' },
  { backupId: 'manual-new', tag: 'manual' },
  { backupId: 'scheduled-2', tag: 'scheduled' },
  { backupId: 'pre-restore', tag: 'pre_restore_safety' },
  { backupId: 'scheduled-3', tag: 'scheduled' },
  { backupId: 'manual-old', tag: 'manual' },
  { backupId: 'pre-update', tag: 'pre_update' },
];

assert.deepEqual(
  selectScheduledBackupsForRetention(backups, 2).map((item) => item.backupId),
  ['scheduled-3'],
  'only scheduled backups older than the newest retention window may be pruned',
);
assert.deepEqual(
  selectScheduledBackupsForRetention(backups, 10),
  [],
  'scheduled backups within retention and all manual/safety backups must remain',
);
assert.deepEqual(
  selectScheduledBackupsForRetention(backups, 0).map((item) => item.backupId),
  ['scheduled-3'],
  'invalid or zero retention values must preserve the existing minimum of two scheduled backups',
);

console.log('PASS: backup retention never selects manual, pre-restore, or pre-update backups.');
