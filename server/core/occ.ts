import { ConflictError } from './errors.ts';

export interface VersionConflictPayload {
  serverVersion: number;
  updatedAt: string | null;
  updatedBy: string | null;
  currentRecord: any;
}

export class VersionConflictError extends ConflictError {
  public readonly conflict: VersionConflictPayload;

  constructor(
    message: string = 'این رکورد هم‌زمان توسط کاربر دیگری تغییر داده شده است. لطفاً نسخه جدید سرور را دریافت و تغییرات خود را مرور کنید.',
    conflict: VersionConflictPayload
  ) {
    super(message, { code: 'VERSION_CONFLICT', conflict });
    (this as any).code = 'VERSION_CONFLICT';
    this.conflict = conflict;
  }
}

export function extractExpectedVersion(input: any): number | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw =
    input.expectedVersion ??
    input._expectedVersion ??
    input.expected_version ??
    input._version ??
    input.version;
  if (raw === undefined || raw === null || raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export function extractExpectedUpdatedAt(input: any): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input.expectedUpdatedAt ?? input.expected_updated_at ?? input._expectedUpdatedAt;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return undefined;
}

/**
 * Verifies optimistic concurrency expectations before applying an update.
 * Throws VersionConflictError (HTTP 409) with current server snapshot when stale.
 */
export function assertVersionMatch(
  existing: any,
  expectedVersion?: number,
  expectedUpdatedAt?: string,
  sanitizer?: (row: any) => any
): void {
  if (!existing) return;

  const currentVersion = Number(existing.version ?? existing._version ?? 1);
  const currentUpdatedAtRaw = existing.updatedAt ?? existing.updated_at;
  const currentUpdatedAt =
    currentUpdatedAtRaw instanceof Date
      ? currentUpdatedAtRaw.toISOString()
      : currentUpdatedAtRaw
      ? String(currentUpdatedAtRaw)
      : null;

  const updatedBy =
    existing.updatedBy ??
    existing.updated_by ??
    existing.createdBy ??
    existing.created_by ??
    null;

  if (expectedVersion !== undefined && Number.isFinite(expectedVersion)) {
    if (expectedVersion !== currentVersion) {
      throw new VersionConflictError(
        `نسخه رکورد تغییر کرده است (نسخه درخواستی: ${expectedVersion}، نسخه فعلی سرور: ${currentVersion}). لطفاً نسخه جدید را بارگذاری کنید.`,
        {
          serverVersion: currentVersion,
          updatedAt: currentUpdatedAt,
          updatedBy,
          currentRecord: sanitizer ? sanitizer(existing) : existing,
        }
      );
    }
    return;
  }

  if (expectedUpdatedAt && currentUpdatedAt) {
    const expectedMs = Date.parse(expectedUpdatedAt);
    const currentMs = Date.parse(currentUpdatedAt);
    if (!Number.isNaN(expectedMs) && !Number.isNaN(currentMs) && currentMs > expectedMs + 5) {
      throw new VersionConflictError(
        'این رکورد پس از آخرین بارگذاری شما توسط کاربر دیگری بروزرسانی شده است.',
        {
          serverVersion: currentVersion,
          updatedAt: currentUpdatedAt,
          updatedBy,
          currentRecord: sanitizer ? sanitizer(existing) : existing,
        }
      );
    }
  }
}

export function sendConflictIfApplicable(res: any, error: any): boolean {
  if (error instanceof VersionConflictError || error?.code === 'VERSION_CONFLICT' || error?.statusCode === 409) {
    res.status(409).json({
      success: false,
      code: error?.code || 'VERSION_CONFLICT',
      error: error?.message || 'تعارض هم‌زمانی در ویرایش رکورد',
      message: error?.message || 'تعارض هم‌زمانی در ویرایش رکورد',
      conflict: error?.conflict || error?.details?.conflict || null,
    });
    return true;
  }
  return false;
}
