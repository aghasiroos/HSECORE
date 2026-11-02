export interface BackupRetentionCandidate {
  backupId: string;
  tag: string;
}

/**
 * Selects only scheduled backups beyond the configured newest-N retention window.
 * Manual and safety backups are deliberately excluded so automated pruning cannot
 * delete operator-created or recovery-critical restore points.
 */
export function selectScheduledBackupsForRetention<T extends BackupRetentionCandidate>(
  backups: readonly T[],
  retentionCount: number,
): T[] {
  const maxCount = Math.max(2, Number(retentionCount) || 10);
  return backups.filter((backup) => backup.tag === 'scheduled').slice(maxCount);
}
