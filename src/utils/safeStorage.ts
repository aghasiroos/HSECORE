import { apiDb } from '../services/apiDatabaseClient';
import { WarningRecord } from '../types';

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
 * Asynchronously save warning records directly to PostgreSQL central database via apiDb,
 * ensuring real-time multi-user consistency without browser storage.
 */
export async function saveWarningsToStorage(warns: WarningRecord[]): Promise<void> {
  const sanitized = sanitizeWarningRecords(warns);
  await apiDb.saveSafetyWarningsBatch(sanitized);
  inMemoryWarningsSnapshot = sanitized;
}

/**
 * In-memory session snapshot populated strictly from PostgreSQL
 */
let inMemoryWarningsSnapshot: WarningRecord[] = [];

/**
 * Asynchronously load warning records from PostgreSQL central database.
 */
export async function loadWarningsFromStorage(): Promise<WarningRecord[]> {
  const dbRows = await apiDb.getSafetyWarnings();
  const records: WarningRecord[] = Array.isArray(dbRows) ? dbRows : [];
  const { clean } = deduplicateWarningRecords(records);
  inMemoryWarningsSnapshot = clean;
  return clean;
}

/**
 * Synchronous retrieval of latest PostgreSQL warnings snapshot held in React/memory
 */
export function getWarningsSynchronously(): WarningRecord[] {
  return inMemoryWarningsSnapshot;
}

/**
 * Completely clear all stored warnings from the central database
 */
export async function clearWarningsFromStorage(): Promise<void> {
  await apiDb.clearAllSafetyWarnings();
  inMemoryWarningsSnapshot = [];
}
