import { get, set, del } from 'idb-keyval';
import { WarningRecord } from '../types';

export const WARNING_STORAGE_KEY = 'warning_records';

/**
 * Safely writes to localStorage with automatic quota exceeded handling
 * and recovery routines to prevent application crashes or unhandled console errors.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    const isQuotaError = 
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'));

    if (isQuotaError) {
      // Attempt to prune non-critical disposable caches from localStorage
      try {
        // 1. Prune large audit logs
        const rawLogs = localStorage.getItem('hse_audit_logs');
        if (rawLogs) {
          try {
            const parsedLogs = JSON.parse(rawLogs);
            if (Array.isArray(parsedLogs) && parsedLogs.length > 20) {
              localStorage.setItem('hse_audit_logs', JSON.stringify(parsedLogs.slice(-20)));
            }
          } catch {
            localStorage.removeItem('hse_audit_logs');
          }
        }

        // 2. Prune backup histories
        const rawHistory = localStorage.getItem('hse_backup_history');
        if (rawHistory) {
          try {
            const parsed = JSON.parse(rawHistory);
            if (Array.isArray(parsed) && parsed.length > 2) {
              localStorage.setItem('hse_backup_history', JSON.stringify(parsed.slice(-2)));
            }
          } catch {
            localStorage.removeItem('hse_backup_history');
          }
        }

        // 3. Prune old notifications
        const rawNotifs = localStorage.getItem('hse_notifications');
        if (rawNotifs) {
          try {
            const parsed = JSON.parse(rawNotifs);
            if (Array.isArray(parsed) && parsed.length > 20) {
              localStorage.setItem('hse_notifications', JSON.stringify(parsed.slice(-20)));
            }
          } catch {
            localStorage.removeItem('hse_notifications');
          }
        }

        // Retry saving after pruning
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }
}

/**
 * Safely reads from localStorage without throwing
 */
export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely removes a key from localStorage
 */
export function safeLocalStorageRemove(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Gracefully ignore
  }
}

/**
 * Robustly deduplicates warning records.
 * Identifies duplicates by:
 * 1. Matching record IDs
 * 2. Matching official notice serial numbers (e.g., HSE/w/001)
 * 3. Matching recipient + date + violation reason + unit (identical infraction logged multiple times)
 *
 * When duplicates are detected, richer field metadata (such as phone, personnelCode,
 * department, supervisor, jobTitle, repetitionText) is safely merged into the preserved record.
 */
export function deduplicateWarningRecords(records: any[]): { clean: WarningRecord[]; removedCount: number; duplicatesFound: boolean } {
  if (!Array.isArray(records) || records.length === 0) {
    return { clean: [], removedCount: 0, duplicatesFound: false };
  }

  const seenIds = new Map<string, number>(); // id -> index in clean array
  const seenNumbers = new Map<string, number>(); // normalized number -> index in clean array
  const seenSignatures = new Map<string, number>(); // recipient+date+reason+unit -> index in clean array

  const clean: WarningRecord[] = [];
  let removedCount = 0;

  for (const raw of records) {
    if (!raw || typeof raw !== 'object') {
      removedCount++;
      continue;
    }

    const id = String(raw.id || '').trim();
    // Ignore legacy seed IDs entirely
    if (id.startsWith('wr-seed-') || /^w([1-9]|[1-4][0-9]|50)$/.test(id)) {
      removedCount++;
      continue;
    }

    const name = String(raw.name || raw.personnelName || '').trim();
    const reason = String(raw.reason || '').trim();
    const unit = String(raw.unit || '').trim();
    const number = String(raw.number || raw.warningNumber || '').trim();
    const year = Number(raw.year) || 1404;
    const month = String(raw.month || 'فروردین').trim();
    const day = Number(raw.day) || 1;
    const code = String(raw.personnelCode || raw.nationalCode || '').trim();

    // Skip empty dummy/ghost records with neither name nor reason nor valid number
    if (!name && !reason && (!number || number === 'HSE/w/000')) {
      removedCount++;
      continue;
    }

    const normNumber = number.toLowerCase().replace(/\s+/g, '');
    const normName = name.toLowerCase().replace(/\s+/g, '');
    const normReason = reason.toLowerCase().replace(/\s+/g, '');
    const normUnit = unit.toLowerCase().replace(/\s+/g, '');
    const normDate = `${year}-${month}-${day}`;

    // Infraction signature
    const signature = `${code || normName}:::${normDate}:::${normUnit}:::${normReason}`;

    // Check if this record matches an existing record
    let targetIndex = -1;

    if (id && seenIds.has(id)) {
      targetIndex = seenIds.get(id)!;
    } else if (normNumber && normNumber !== 'hse/w/' && normNumber !== 'hse/w/000' && seenNumbers.has(normNumber)) {
      targetIndex = seenNumbers.get(normNumber)!;
    } else if ((normName || code) && normReason && seenSignatures.has(signature)) {
      targetIndex = seenSignatures.get(signature)!;
    }

    if (targetIndex >= 0) {
      // Duplicate found: Merge any missing info into the existing record
      removedCount++;
      const existing = clean[targetIndex];
      clean[targetIndex] = {
        ...existing,
        personnelCode: existing.personnelCode || raw.personnelCode || '',
        nationalCode: existing.nationalCode || raw.nationalCode || '',
        phone: existing.phone || raw.phone || '',
        jobTitle: existing.jobTitle || raw.jobTitle || '',
        department: existing.department || raw.department || '',
        supervisor: existing.supervisor || raw.supervisor || '',
        location: existing.location || raw.location || '',
        costCenter: existing.costCenter || raw.costCenter || '',
        fullOrgPath: existing.fullOrgPath || raw.fullOrgPath || '',
        repetitionText: existing.repetitionText || raw.repetitionText || '',
        reason: existing.reason.length >= (raw.reason || '').length ? existing.reason : (raw.reason || '')
      };
      continue;
    }

    // New unique record
    const currentIndex = clean.length;
    const cleanRecord: WarningRecord = {
      id: id || `wr_${Date.now()}_${currentIndex}`,
      day,
      month,
      year,
      number: number || `HSE/w/${String(currentIndex + 1).padStart(3, '0')}`,
      site: String(raw.site || ''),
      name: name || 'کارمند',
      unit: unit || '',
      type: (raw.type === 'واحدی' ? 'واحدی' : 'فردی') as 'فردی' | 'واحدی',
      reason,
      personnelCode: raw.personnelCode || '',
      nationalCode: raw.nationalCode || '',
      phone: raw.phone || '',
      jobTitle: raw.jobTitle || '',
      department: raw.department || '',
      supervisor: raw.supervisor || '',
      location: raw.location || '',
      costCenter: raw.costCenter || '',
      fullOrgPath: raw.fullOrgPath || '',
      repetitionText: raw.repetitionText || ''
    };

    if (id) seenIds.set(id, currentIndex);
    if (normNumber && normNumber !== 'hse/w/' && normNumber !== 'hse/w/000') seenNumbers.set(normNumber, currentIndex);
    if ((normName || code) && normReason) seenSignatures.set(signature, currentIndex);

    clean.push(cleanRecord);
  }

  return {
    clean,
    removedCount,
    duplicatesFound: removedCount > 0
  };
}

/**
 * Sanitize warning records (strip seed data, deduplicate, and ensure clean object format)
 */
export function sanitizeWarningRecords(records: any[]): WarningRecord[] {
  if (!Array.isArray(records)) return [];
  const { clean } = deduplicateWarningRecords(records);
  return clean;
}

/**
 * Asynchronously save warning records to persistent IndexedDB (no 5MB quota constraint)
 * and attempt safe mirrored write to localStorage, always ensuring data is deduplicated.
 */
export async function saveWarningsToStorage(warns: WarningRecord[]): Promise<void> {
  const sanitized = sanitizeWarningRecords(warns);

  // 1. Primary Durable Storage: IndexedDB (Virtually unlimited quota)
  try {
    await set(WARNING_STORAGE_KEY, sanitized);
  } catch {
    // Tolerated gracefully
  }

  // 2. Secondary Fast Storage: LocalStorage (Quota safe)
  try {
    safeLocalStorageSet(WARNING_STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // Data secured in IndexedDB
  }
}

/**
 * Asynchronously load warning records from IndexedDB or LocalStorage with automatic deduplication.
 */
export async function loadWarningsFromStorage(): Promise<WarningRecord[]> {
  // Try IndexedDB first
  try {
    const idbData = await get<WarningRecord[]>(WARNING_STORAGE_KEY);
    if (Array.isArray(idbData) && idbData.length > 0) {
      const { clean, removedCount } = deduplicateWarningRecords(idbData);
      if (removedCount > 0) {
        try {
          await set(WARNING_STORAGE_KEY, clean);
        } catch {}
      }
      // Sync to localStorage if quota allows
      safeLocalStorageSet(WARNING_STORAGE_KEY, JSON.stringify(clean));
      return clean;
    }
  } catch {
    // Continue to fallback
  }

  // Fallback to localStorage
  const rawLocal = safeLocalStorageGet(WARNING_STORAGE_KEY);
  if (rawLocal) {
    try {
      const parsed = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        const { clean, removedCount } = deduplicateWarningRecords(parsed);
        if (removedCount > 0) {
          safeLocalStorageSet(WARNING_STORAGE_KEY, JSON.stringify(clean));
        }
        // Persist to IndexedDB for future safety
        try {
          await set(WARNING_STORAGE_KEY, clean);
        } catch {}
        return clean;
      }
    } catch {
      // Corrupt payload handled safely
    }
  }

  return [];
}

/**
 * Synchronous initial retrieval of warnings from LocalStorage for instant render
 */
export function getWarningsSynchronously(): WarningRecord[] {
  const raw = safeLocalStorageGet(WARNING_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return sanitizeWarningRecords(parsed);
    }
  } catch {
    // Handled safely
  }
  return [];
}

/**
 * Completely clear all stored warnings from both IndexedDB and LocalStorage
 */
export async function clearWarningsFromStorage(): Promise<void> {
  try {
    await del(WARNING_STORAGE_KEY);
  } catch {
    // Ignored
  }
  try {
    localStorage.removeItem(WARNING_STORAGE_KEY);
  } catch {}
  safeLocalStorageSet(WARNING_STORAGE_KEY, JSON.stringify([]));
}
