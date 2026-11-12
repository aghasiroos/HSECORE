import { useState, useEffect, useMemo, useCallback } from 'react';
import { Department, UserProfile, PtwQualificationData, PtwValidityDuration, PtwQualificationStatus } from '../types';
import { OrgNode, SEED_ORG_NODES, getRawMemorySystemUsers, getCurrentUser, isUserAdmin } from './authHelper';
import { apiDb } from '../services/apiDatabaseClient';
import { getOrgUnitsStructure } from './orgHelper';
import {
  normalizeForMatching,
  normalizeDigits,
  cleanPersonnelCode,
  compareByPersonnelCodeAsc,
  sortPersonnelByCodeAsc
} from './textNormalization';
export { cleanPersonnelCode, compareByPersonnelCodeAsc, sortPersonnelByCodeAsc };
import moment from 'moment-jalaali';

// Pure in-memory runtime caches (Zero Browser Storage / Zero localStorage)
let inMemoryOrgNodesCache: OrgNode[] = [];
let inMemoryPersonnelCache: ComplexPersonnel[] = [];
let inMemoryDepartmentsCache: Department[] = [];

// O(1) Hash Map Indices for Instant Personnel Lookups across 10,000+ employees
let personnelByCodeMap = new Map<string, ComplexPersonnel>();
let personnelByNationalIdMap = new Map<string, ComplexPersonnel>();
let personnelByIdMap = new Map<string, ComplexPersonnel>();
let personnelByNormalizedNameMap = new Map<string, ComplexPersonnel>();

// Background synchronization flags
let isSyncingPersonnel = false;
let hasSyncedPersonnel = false;
let isSyncingOrgNodes = false;
let hasSyncedOrgNodes = false;

export interface ComplexPersonnel {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  personnelCode: string;
  effectiveCode?: string;
  employeeCode?: string;
  unit?: string;
  subUnit?: string;
  section?: string;
  management?: string;
  department: string;
  position: string;
  jobTitle?: string;
  workplace?: string;
  phone?: string;
  mobile?: string;
  nationalId?: string;
  nationalCode: string;
  birthDate?: string;
  age?: number;
  education?: string;
  maritalStatus?: string;
  childrenCount?: string;
  gender?: string;
  militaryStatus?: string;
  notes?: string;
  profilePhoto?: string;
  signatureImage?: string;
  supervisor?: string;
  orgNodeId?: string;
  status?: 'active' | 'inactive';
  ptwQualification?: PtwQualificationData;
}

export type PersonnelMember = ComplexPersonnel;

export interface PersonnelOrgDetails {
  unit: string;
  subUnit: string;
  department: string;
  supervisor: string;
  location: string;
  costCenter: string;
  fullOrgPath: string;
  orgNodeId?: string;
  jobTitle?: string;
}

/**
 * Purges any legacy personnel or organization structure keys from browser storage
 * to strictly enforce 100% database-authoritative storage.
 */
export function purgeLegacyBrowserCache(): void {
  if (typeof window === 'undefined') return;
  const legacyKeys = [
    'hse_personnel_v3',
    'hse_org_nodes',
    'hse_extracted_departments',
    'hse_unit_structure_v1',
    'hse_org_jobs',
    'hse_incident_types_config',
    'hse_ppe_categories',
    'hse_ppe_items'
  ];
  try {
    legacyKeys.forEach(k => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  } catch {
    // Ignore storage access errors
  }
}

function normalizeLookupKey(str?: string): string {
  return normalizeForMatching(str);
}

/**
 * Normalizes a national code to standard English digits without spaces or dashes
 */
export function normalizeNationalCode(code?: string): string {
  return normalizeDigits(code, true);
}

/**
 * Validates Iranian National Code format (8 to 10 digits)
 */
export function isValidNationalCodeFormat(code?: string): boolean {
  const norm = normalizeNationalCode(code);
  return norm.length >= 8 && norm.length <= 10;
}

/**
 * Rebuilds O(1) lookup indices whenever inMemoryPersonnelCache changes
 */
function rebuildPersonnelIndices(list: ComplexPersonnel[]) {
  personnelByCodeMap.clear();
  personnelByNationalIdMap.clear();
  personnelByIdMap.clear();
  personnelByNormalizedNameMap.clear();

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.id) personnelByIdMap.set(String(p.id).trim(), p);
    if (p.personnelCode) {
      personnelByCodeMap.set(String(p.personnelCode).trim(), p);
      personnelByCodeMap.set(normalizeLookupKey(p.personnelCode), p);
    }
    if (p.effectiveCode) {
      personnelByCodeMap.set(String(p.effectiveCode).trim(), p);
      personnelByCodeMap.set(normalizeLookupKey(p.effectiveCode), p);
    }
    const nat = p.nationalCode || p.nationalId;
    if (nat) {
      personnelByNationalIdMap.set(String(nat).trim(), p);
      personnelByNationalIdMap.set(normalizeNationalCode(nat), p);
    }
    if (p.fullName) {
      personnelByNormalizedNameMap.set(normalizeLookupKey(p.fullName), p);
    }
  }
}

/**
 * Maps a raw record from complex personnel management or database to unified ComplexPersonnel
 */
function normalizeRawPersonnelRecord(p: any, idx: number): ComplexPersonnel {
  const firstName = p.firstName || (p.fullName ? String(p.fullName).split(' ')[0] : '') || '';
  const lastName = p.lastName || (p.fullName ? String(p.fullName).split(' ').slice(1).join(' ') : '') || '';
  const fullName =
    firstName && lastName
      ? `${firstName} ${lastName}`.trim()
      : p.fullName || firstName || lastName || 'بدون نام';
  const unit = p.unit || p.department || 'نامشخص';
  const subUnit = p.subUnit || '';
  const jobTitle = p.jobTitle || p.position || 'کارشناس';
  const nationalCode = p.nationalCode || p.nationalId || '';
  const personnelCode = p.extraData?.hasNoPersonnelCode ? '' : cleanPersonnelCode(p.personnelCode ?? p.effectiveCode);

  const rawStatus = String(p.status || p.extraData?.status || 'active').trim().toLowerCase();
  const normalizedStatus: 'active' | 'inactive' =
    rawStatus === 'inactive' || rawStatus === 'disabled' || rawStatus === 'deleted' || rawStatus === 'غیرفعال'
      ? 'inactive'
      : 'active';

  return {
    id: String(p.id || `emp-${idx + 1}`),
    firstName,
    lastName,
    fullName,
    personnelCode,
    effectiveCode: personnelCode,
    unit,
    subUnit,
    department: unit,
    position: jobTitle,
    jobTitle,
    workplace: p.workplace || '',
    phone: p.phone || '',
    nationalId: nationalCode,
    nationalCode,
    birthDate: p.birthDate || '',
    age: typeof p.age === 'number' ? p.age : 30,
    education: p.education || '',
    maritalStatus: p.maritalStatus || '',
    childrenCount: p.childrenCount || '0',
    gender: p.gender || 'مرد',
    militaryStatus: p.militaryStatus || 'پایان خدمت',
    notes: p.notes || '',
    profilePhoto: p.profilePhoto || p.extraData?.profilePhoto || undefined,
    signatureImage: p.signatureImage || p.digitalSignature || p.extraData?.signatureImage || undefined,
    supervisor: p.supervisor || p.extraData?.supervisor || undefined,
    status: normalizedStatus,
    ptwQualification: p.ptwQualification || p.extraData?.ptwQualification || undefined
  };
}

/**
 * Exact standard error message for unauthorized PTW actions
 */
export const PTW_UNAUTHORIZED_ERROR_MESSAGE =
  'کاربر غیرمجاز است؛ دوره آموزشی صدور پروانه کار را با موفقیت نگذرانده یا صلاحیت گواهینامه، نوع پروانه یا مسئولیت امضای وی معتبر نیست.';

/**
 * Calculates Jalali expiration date based on Jalali issue date and validity duration (6m, 1y, 3y, 5y)
 */
export function calculatePtwExpiryDate(issueDate: string, duration?: PtwValidityDuration | string): string {
  if (!issueDate || !duration) return '';
  try {
    const cleanDate = normalizeDigits(String(issueDate).trim()).replace(/-/g, '/');
    const m = moment(cleanDate, 'jYYYY/jMM/jDD');
    if (!m.isValid()) return '';

    if (duration === '6m') m.add(6, 'jMonth');
    else if (duration === '1y') m.add(1, 'jYear');
    else if (duration === '3y') m.add(3, 'jYear');
    else if (duration === '5y') m.add(5, 'jYear');

    return m.format('jYYYY/jMM/jDD');
  } catch {
    return '';
  }
}

/**
 * Automatically evaluates the qualification status based on course progress, results, and expiration dates.
 * Returns: 'valid' | 'expired' | 'unqualified' | 'incomplete'
 */
export function evaluatePtwQualificationStatus(
  q?: Partial<PtwQualificationData> | null
): PtwQualificationStatus {
  if (!q) return 'unqualified';

  // 1. Course status check
  if (q.courseStatus !== 'passed') {
    return 'unqualified';
  }

  // 2. Course result check
  if (q.courseResult !== 'success') {
    return 'unqualified';
  }

  // 3. Issue date and validity check
  if (!q.issueDate || !q.validityDuration) {
    return 'incomplete';
  }

  const expiry = q.expiryDate || calculatePtwExpiryDate(q.issueDate, q.validityDuration);
  if (!expiry) {
    return 'incomplete';
  }

  // Check if expired
  try {
    const cleanExpiry = normalizeDigits(String(expiry).trim()).replace(/-/g, '/');
    const expM = moment(cleanExpiry, 'jYYYY/jMM/jDD');
    if (!expM.isValid()) return 'incomplete';

    const todayStr = moment().format('jYYYY/jMM/jDD');
    const todayM = moment(todayStr, 'jYYYY/jMM/jDD');

    if (expM.isBefore(todayM, 'day')) {
      return 'expired';
    }

    return 'valid';
  } catch {
    return 'incomplete';
  }
}

/**
 * Checks whether a personnel or user profile is fully authorized for a specific PTW category and role
 */
export function isPersonnelPtwAuthorized(
  personnelOrUser: any,
  options?: {
    permitCategory?: string;
    roleKey?: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit' | string;
    allowExemptAdmins?: boolean;
  }
): { isAuthorized: boolean; reason?: string } {
  if (!personnelOrUser) {
    return { isAuthorized: false, reason: PTW_UNAUTHORIZED_ERROR_MESSAGE };
  }

  // Extract qualification data from personnel, user, profileData, or extraData
  const q: PtwQualificationData | undefined =
    personnelOrUser.ptwQualification ||
    personnelOrUser.profileData?.ptwQualification ||
    personnelOrUser.extraData?.ptwQualification;

  if (!q) {
    return { isAuthorized: false, reason: PTW_UNAUTHORIZED_ERROR_MESSAGE };
  }

  // Evaluate current status dynamically (to catch real-time expirations immediately)
  const currentStatus = evaluatePtwQualificationStatus(q);
  if (currentStatus !== 'valid') {
    return { isAuthorized: false, reason: PTW_UNAUTHORIZED_ERROR_MESSAGE };
  }

  // If roleKey is specified, check responsibility authorization
  if (options?.roleKey) {
    const rKey = options.roleKey as 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit';
    const isRoleAuth = q.responsibilities && Boolean(q.responsibilities[rKey]);
    if (!isRoleAuth) {
      return { isAuthorized: false, reason: PTW_UNAUTHORIZED_ERROR_MESSAGE };
    }
  }

  // If permitCategory is specified, check permit category authorization
  if (options?.permitCategory) {
    const rawCat = String(options.permitCategory).trim().toLowerCase();
    
    // Check main permits: Hot / Cold
    if (rawCat === 'hot' || rawCat.includes('گرم')) {
      if (!q.mainPermits?.hot) {
        return { isAuthorized: false, reason: PTW_UNAUTHORIZED_ERROR_MESSAGE };
      }
    } else if (rawCat === 'cold' || rawCat.includes('سرد')) {
      if (!q.mainPermits?.cold) {
        return { isAuthorized: false, reason: PTW_UNAUTHORIZED_ERROR_MESSAGE };
      }
    } else {
      // Check supplementary permits
      const supp = q.supplementaryPermits || ({} as any);
      let suppAllowed = false;

      if (rawCat.includes('excavation') || rawCat.includes('حفاری')) {
        suppAllowed = Boolean(supp.excavation);
      } else if (rawCat.includes('confined') || rawCat.includes('بسته')) {
        suppAllowed = Boolean(supp.confinedSpace);
      } else if (rawCat.includes('vehicle') || rawCat.includes('crane') || rawCat.includes('جرثقیل') || rawCat.includes('خودرو')) {
        suppAllowed = Boolean(supp.vehicleCrane);
      } else if (rawCat.includes('process') || rawCat.includes('mechanical') || rawCat.includes('فرایندی') || rawCat.includes('مکانیکی')) {
        suppAllowed = Boolean(supp.processIsolation);
      } else if (rawCat.includes('electrical') || rawCat.includes('برق') || rawCat.includes('الکتریک')) {
        suppAllowed = Boolean(supp.electricalIsolation);
      } else if (rawCat.includes('radiation') || rawCat.includes('پرتو')) {
        suppAllowed = Boolean(supp.radiation);
      } else if (rawCat.includes('height') || rawCat.includes('ارتفاع')) {
        suppAllowed = Boolean(supp.workingAtHeight ?? true);
      } else if (rawCat.includes('lift') || rawCat.includes('لیفت')) {
        suppAllowed = Boolean(supp.lifting ?? true);
      } else {
        // Fallback for general main permit category
        suppAllowed = Boolean(q.mainPermits?.hot || q.mainPermits?.cold);
      }

      if (!suppAllowed) {
        return { isAuthorized: false, reason: PTW_UNAUTHORIZED_ERROR_MESSAGE };
      }
    }
  }

  return { isAuthorized: true };
}

/**
 * Filter list of personnel returning only those who have valid PTW qualifications for the given criteria
 */
export function filterQualifiedPtwPersonnel(
  list: ComplexPersonnel[],
  options?: {
    permitCategory?: string;
    roleKey?: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit' | string;
  }
): ComplexPersonnel[] {
  if (!Array.isArray(list)) return [];
  return list.filter(p => isPersonnelPtwAuthorized(p, options).isAuthorized);
}

/**
 * Updates the in-memory personnel cache from raw records and rebuilds indices.
 * Strictly zero browser storage (no localStorage / sessionStorage).
 */
export function setInMemoryPersonnelList(rawList: any[]): ComplexPersonnel[] {
  purgeLegacyBrowserCache();
  const normalized = sortPersonnelByCodeAsc(
    (Array.isArray(rawList) ? rawList : []).map((p, idx) => normalizeRawPersonnelRecord(p, idx))
  );
  inMemoryPersonnelCache = normalized;
  hasSyncedPersonnel = true;
  rebuildPersonnelIndices(normalized);
  return normalized;
}

/**
 * Saves and synchronizes the master personnel list to the central database and in-memory cache.
 */
export function setComplexPersonnelList(rawList: any[]): ComplexPersonnel[] {
  const normalized = setInMemoryPersonnelList(rawList);
  apiDb.batchSavePersonnel(normalized).catch(console.error);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: normalized }));
    window.dispatchEvent(new Event('app_data_mutated'));
  }
  return normalized;
}

/**
 * Removes a personnel record from the in-memory cache and indices immediately.
 */
export function removePersonnelFromMemory(identifier: string): void {
  if (!identifier) return;
  const cleanId = String(identifier).trim();
  const normId = normalizeLookupKey(cleanId);
  inMemoryPersonnelCache = inMemoryPersonnelCache.filter(
    p =>
      String(p.id).trim() !== cleanId &&
      String(p.personnelCode).trim() !== cleanId &&
      normalizeLookupKey(p.personnelCode) !== normId &&
      String(p.nationalCode || '').trim() !== cleanId
  );
  rebuildPersonnelIndices(inMemoryPersonnelCache);
}

/**
 * Asynchronously fetches the authoritative personnel list from the central database
 * and updates the in-memory cache.
 */
export async function fetchCentralPersonnelList(forceRefresh = false): Promise<ComplexPersonnel[]> {
  try {
    purgeLegacyBrowserCache();
    if (forceRefresh) {
      apiDb.invalidateCache('personnel');
    }
    const remoteList = await apiDb.getPersonnel();
    if (Array.isArray(remoteList)) {
      const updated = setInMemoryPersonnelList(remoteList);
      return updated;
    }
  } catch (e) {
    console.error('Failed to fetch personnel from central database:', e);
  }
  return inMemoryPersonnelCache;
}

/**
 * Determines whether the user has full access to all complex personnel ('ALL' scope or Admin role)
 */
export function canUserAccessAllPersonnel(user?: UserProfile | null): boolean {
  const activeUser = user !== undefined ? user : getCurrentUser();
  if (!activeUser) return false;
  if (isUserAdmin(activeUser)) return true;
  if (activeUser.canAccessAllPersonnel === true) return true;
  if (String(activeUser.personnelAccessScope || '').toUpperCase() === 'ALL') return true;
  return false;
}

/**
 * Checks whether a specific personnel record or identifier is accessible to the user
 * based on their PostgreSQL-backed assigned personnel list.
 */
export function canUserAccessPersonnelRecord(target: any, user?: UserProfile | null): boolean {
  if (!target) return false;
  const activeUser = user !== undefined ? user : getCurrentUser();
  if (!activeUser) return false;

  if (typeof target === 'object') {
    const rawSt = String(target.status || target.extraData?.status || 'active').trim().toLowerCase();
    if (rawSt === 'inactive' || rawSt === 'disabled' || rawSt === 'deleted' || rawSt === 'غیرفعال') {
      return false;
    }
  }

  if (canUserAccessAllPersonnel(activeUser)) return true;

  const assignedIds = new Set(
    (activeUser.assignedPersonnelIds || []).map(v => String(v).trim()).filter(Boolean)
  );
  const assignedCodes = new Set(
    (activeUser.assignedPersonnelCodes || []).map(v => normalizeLookupKey(String(v))).filter(Boolean)
  );
  const assignedNatCodes = new Set<string>();
  const assignedNames = new Set<string>();

  if (Array.isArray(activeUser.assignedPersonnel)) {
    for (const ap of activeUser.assignedPersonnel) {
      if (ap.id) assignedIds.add(String(ap.id).trim());
      if (ap.personnelId) assignedIds.add(String(ap.personnelId).trim());
      if (ap.personnelCode) assignedCodes.add(normalizeLookupKey(ap.personnelCode));
      if (ap.nationalCode) assignedNatCodes.add(normalizeNationalCode(ap.nationalCode));
      if (ap.fullName) assignedNames.add(normalizeLookupKey(ap.fullName));
    }
  }

  if (assignedIds.size === 0 && assignedCodes.size === 0) {
    return false;
  }

  if (typeof target === 'string' || typeof target === 'number') {
    const str = String(target).trim();
    const norm = normalizeLookupKey(str);
    const nat = normalizeNationalCode(str);
    return (
      assignedIds.has(str) ||
      assignedCodes.has(norm) ||
      (nat.length > 0 && assignedNatCodes.has(nat)) ||
      (norm.length > 2 && assignedNames.has(norm))
    );
  }

  if (typeof target === 'object') {
    const candidateIds = [target.id, target.personnelId, target.personnel_id, target.involvedPersonnelId]
      .filter(v => v !== undefined && v !== null && v !== '')
      .map(v => String(v).trim());
    for (const cid of candidateIds) {
      if (assignedIds.has(cid)) return true;
    }

    const candidateCodes = [
      target.personnelCode,
      target.personnel_code,
      target.personnelNumber,
      target.personnel_number,
      target.effectiveCode,
      target.requesterCode,
      target.acceptorCode,
      target.supervisorCode,
      target.assignedTo,
      target.formData?.requesterCode,
      target.formData?.acceptorCode,
      target.formData?.personnelCode
    ]
      .filter(Boolean)
      .map(v => normalizeLookupKey(String(v)));
    for (const ccode of candidateCodes) {
      if (ccode && (assignedCodes.has(ccode) || assignedIds.has(ccode))) return true;
    }

    const candidateNats = [
      target.nationalCode,
      target.national_code,
      target.nationalId,
      target.national_id
    ]
      .filter(Boolean)
      .map(v => normalizeNationalCode(String(v)));
    for (const cnat of candidateNats) {
      if (cnat && (assignedNatCodes.has(cnat) || assignedCodes.has(cnat))) return true;
    }

    const candidateNames = [
      target.fullName,
      target.full_name,
      target.personnelName,
      target.personnel_name,
      target.assignedToName,
      target.requesterName,
      target.name
    ]
      .filter(Boolean)
      .map(v => normalizeLookupKey(String(v)));
    for (const cname of candidateNames) {
      if (cname && assignedNames.has(cname)) return true;
    }
  }

  return false;
}

/**
 * Centralized cross-module record filter for any array of records (exams, visits, warnings, permits, incidents, PPE, etc.)
 */
export function filterRecordsByUserPersonnelAccess<T>(records: T[], user?: UserProfile | null): T[] {
  if (!Array.isArray(records)) return [];
  const activeUser = user !== undefined ? user : getCurrentUser();
  if (canUserAccessAllPersonnel(activeUser)) return records;
  return records.filter(r => canUserAccessPersonnelRecord(r, activeUser));
}

/**
 * Returns the complete unfiltered in-memory personnel list (for Admin User Management picker)
 */
export function getUnfilteredComplexPersonnelList(): ComplexPersonnel[] {
  return getComplexPersonnelList({ bypassAccessFilter: true });
}

/**
 * Retrieves the list of personnel from the in-memory runtime cache,
 * automatically filtered by the current user's assigned personnel scope unless bypassAccessFilter is set.
 */
export function getComplexPersonnelList(options?: { bypassAccessFilter?: boolean; includeInactive?: boolean }): ComplexPersonnel[] {
  if (!hasSyncedPersonnel && !isSyncingPersonnel && typeof window !== 'undefined') {
    isSyncingPersonnel = true;
    hasSyncedPersonnel = true;
    fetchCentralPersonnelList()
      .then(list => {
        if (list.length > 0) {
          window.dispatchEvent(new CustomEvent('hse_personnel_updated', { detail: list }));
        }
      })
      .finally(() => {
        isSyncingPersonnel = false;
      });
  }

  const baseList = options?.includeInactive
    ? inMemoryPersonnelCache
    : inMemoryPersonnelCache.filter(p => p.status !== 'inactive');

  if (options?.bypassAccessFilter) {
    return baseList;
  }

  const curUser = getCurrentUser();
  if (!curUser || canUserAccessAllPersonnel(curUser)) {
    return baseList;
  }

  return baseList.filter(p => canUserAccessPersonnelRecord(p, curUser));
}

/**
 * O(1) Instant lookup of personnel by Personnel Code, National ID, ID, or Full Name
 */
export function findPersonnelFast(query?: string, options?: { bypassAccessFilter?: boolean }): ComplexPersonnel | undefined {
  if (!query) return undefined;
  if (inMemoryPersonnelCache.length === 0) {
    getComplexPersonnelList({ bypassAccessFilter: true });
  }
  const clean = String(query).trim();
  const norm = normalizeLookupKey(clean);
  const normNat = normalizeNationalCode(clean);

  const found =
    personnelByCodeMap.get(clean) ||
    personnelByCodeMap.get(norm) ||
    personnelByNationalIdMap.get(clean) ||
    (normNat ? personnelByNationalIdMap.get(normNat) : undefined) ||
    personnelByIdMap.get(clean) ||
    personnelByNormalizedNameMap.get(norm);

  if (!found) return undefined;
  if (options?.bypassAccessFilter) return found;

  const curUser = getCurrentUser();
  if (curUser && !canUserAccessAllPersonnel(curUser) && !canUserAccessPersonnelRecord(found, curUser)) {
    return undefined;
  }
  return found;
}

/**
 * Finds a personnel record by personnelCode, ID, or nationalCode
 */
export function findPersonnelByCode(code?: string): ComplexPersonnel | undefined {
  return findPersonnelFast(code);
}

/**
 * Finds a personnel record by National Code
 */
export function findPersonnelByNationalCode(nationalCode?: string): ComplexPersonnel | undefined {
  if (!nationalCode) return undefined;
  return findPersonnelFast(nationalCode);
}

/**
 * Searches the master personnel list by query, unit, and status (respecting user's assigned personnel access)
 */
export function searchMasterPersonnel(
  query: string,
  options?: { unit?: string; status?: 'active' | 'inactive' | 'all'; limit?: number; bypassAccessFilter?: boolean }
): ComplexPersonnel[] {
  const includeInactive = options?.status === 'all' || options?.status === 'inactive';
  const all = getComplexPersonnelList({
    bypassAccessFilter: options?.bypassAccessFilter,
    includeInactive
  });
  const cleanQuery = normalizeLookupKey(query);
  const unitFilter = options?.unit ? normalizeLookupKey(options.unit) : '';
  const limit = options?.limit || 25;

  const results: ComplexPersonnel[] = [];
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    if (options?.status === 'active' && p.status === 'inactive') continue;
    if (options?.status === 'inactive' && p.status !== 'inactive') continue;
    if (unitFilter && normalizeLookupKey(p.unit) !== unitFilter && !normalizeLookupKey(p.unit).includes(unitFilter)) {
      continue;
    }
    if (!cleanQuery) {
      results.push(p);
    } else {
      const matchName = normalizeLookupKey(p.fullName).includes(cleanQuery);
      const matchCode = normalizeLookupKey(p.personnelCode).includes(cleanQuery);
      const matchNat = normalizeNationalCode(p.nationalCode).includes(cleanQuery);
      const matchUnit = normalizeLookupKey(p.unit).includes(cleanQuery);
      const matchJob = normalizeLookupKey(p.jobTitle).includes(cleanQuery);
      if (matchName || matchCode || matchNat || matchUnit || matchJob) {
        results.push(p);
      }
    }
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * Resolves organizational metadata (unit, department, supervisor, location, cost center, full path)
 * for a given personnel record by cross-referencing the Organizational Structure Chart.
 */
export function getPersonnelOrgDetails(person?: ComplexPersonnel | null): PersonnelOrgDetails {
  if (!person) {
    return {
      unit: '—',
      subUnit: '—',
      department: '—',
      supervisor: '—',
      location: '—',
      costCenter: '—',
      fullOrgPath: ''
    };
  }

  const orgNodes = getStoredOrgNodes();
  const rawUnit = (person.unit || person.department || '').trim();
  const rawSubUnit = (person.subUnit || '').trim();

  // Match node by subUnit first, then unit
  const matchedNode =
    (rawSubUnit
      ? orgNodes.find(n => normalizeLookupKey(n.name) === normalizeLookupKey(rawSubUnit))
      : undefined) ||
    orgNodes.find(
      n =>
        normalizeLookupKey(n.name) === normalizeLookupKey(rawUnit) ||
        (rawUnit && normalizeLookupKey(n.name).includes(normalizeLookupKey(rawUnit)))
    );

  // Build full hierarchical path
  const pathParts: string[] = [];
  let curr = matchedNode;
  let guard = 0;
  while (curr && guard < 10) {
    guard++;
    pathParts.unshift(curr.name);
    curr = curr.parentId ? orgNodes.find(n => n.id === curr!.parentId) : undefined;
  }

  const parentNode = matchedNode?.parentId ? orgNodes.find(n => n.id === matchedNode.parentId) : undefined;

  return {
    unit: rawUnit || matchedNode?.name || 'واحد عمومی',
    subUnit: rawSubUnit || '—',
    department: rawSubUnit || parentNode?.name || rawUnit || '—',
    supervisor: matchedNode?.manager || parentNode?.manager || 'مدیر واحد',
    location: person.workplace || matchedNode?.location || parentNode?.location || 'سایت اصلی مجتمع',
    costCenter: matchedNode?.costCenter || parentNode?.costCenter || 'CC-1000',
    fullOrgPath: pathParts.length > 0 ? pathParts.join(' > ') : rawUnit,
    orgNodeId: matchedNode?.id
  };
}

/**
 * Retrieves the stored hierarchical Organizational Nodes from in-memory cache
 * (backed strictly by the central database).
 */
export function getStoredOrgNodes(): OrgNode[] {
  if (!hasSyncedOrgNodes && !isSyncingOrgNodes && typeof window !== 'undefined') {
    isSyncingOrgNodes = true;
    apiDb
      .getOrgNodes()
      .then(nodes => {
        if (Array.isArray(nodes)) {
          inMemoryOrgNodesCache = nodes;
          hasSyncedOrgNodes = true;
        }
      })
      .catch(() => {})
      .finally(() => {
        isSyncingOrgNodes = false;
      });
  }
  if (hasSyncedOrgNodes || inMemoryOrgNodesCache.length > 0) {
    return inMemoryOrgNodesCache;
  }
  return [];
}

/**
 * Async version: Fetches OrgNodes directly from the central database.
 */
export async function fetchStoredOrgNodes(forceRefresh = false): Promise<OrgNode[]> {
  try {
    purgeLegacyBrowserCache();
    if (forceRefresh) {
      apiDb.invalidateCache('organization:nodes', 'settings');
    }
    const remote = await apiDb.getOrgNodes();
    if (Array.isArray(remote)) {
      inMemoryOrgNodesCache = remote;
      hasSyncedOrgNodes = true;
      return remote;
    }
  } catch (e) {
    console.error('Failed to fetch org nodes from central database:', e);
  }
  return getStoredOrgNodes();
}

/**
 * Saves Organizational Nodes directly to the central database and updates in-memory cache.
 * Zero browser storage (no localStorage).
 */
export async function saveStoredOrgNodes(nodes: OrgNode[]): Promise<boolean> {
  try {
    purgeLegacyBrowserCache();
    inMemoryOrgNodesCache = Array.isArray(nodes) ? [...nodes] : [];
    hasSyncedOrgNodes = true;
    const success = await apiDb.saveOrgNodes(inMemoryOrgNodesCache);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_org_nodes_updated', { detail: inMemoryOrgNodesCache }));
    }
    return success;
  } catch (e) {
    console.error('Failed to save org nodes:', e);
    return false;
  }
}

/**
 * Automatically extracts, normalizes, and builds the list of Subordinate Departments (واحدهای تابعه)
 * from the Complex Personnel list, Organizational Structure Nodes, and Unit Structure in memory.
 */
export function syncAndGetExtractedDepartments(): Department[] {
  const personnelList = getComplexPersonnelList();
  const orgNodes = getStoredOrgNodes();
  const unitStruct = getOrgUnitsStructure();

  const unitMap = new Map<
    string,
    {
      name: string;
      headcount: number;
      managerCandidate: string;
      positions: Set<string>;
      workplaces: Set<string>;
      orgNodeMatch?: OrgNode;
    }
  >();

  // 1. First, populate from Organizational Structure Nodes (Plant, Department, Area, Section)
  orgNodes.forEach(node => {
    if (node.status === 'inactive') return;
    if (node.type === 'Plant' || node.type === 'Department' || node.type === 'Area' || node.type === 'Section') {
      const cleanName = node.name.trim();
      if (!unitMap.has(cleanName)) {
        const linkedPerson = (node.managerPersonnelCode && findPersonnelFast(node.managerPersonnelCode, { bypassAccessFilter: true })) ||
                             (node.managerPersonnelId && findPersonnelFast(String(node.managerPersonnelId), { bypassAccessFilter: true }));
        const liveManagerName = linkedPerson
          ? (linkedPerson.fullName || `${linkedPerson.firstName || ''} ${linkedPerson.lastName || ''}`.trim())
          : (node.manager || '');

        unitMap.set(cleanName, {
          name: cleanName,
          headcount: 0,
          managerCandidate: liveManagerName,
          positions: new Set<string>(),
          workplaces: new Set<string>(node.location ? [node.location] : []),
          orgNodeMatch: node
        });
      }
    }
  });

  // 2. Populate from Operational Units Structure (in-memory DB cache)
  Object.keys(unitStruct || {}).forEach(uName => {
    const cleanName = uName.trim();
    if (cleanName && !unitMap.has(cleanName)) {
      unitMap.set(cleanName, {
        name: cleanName,
        headcount: 0,
        managerCandidate: '',
        positions: new Set<string>(unitStruct[uName]?.jobs || []),
        workplaces: new Set<string>()
      });
    }
  });

  // 3. Aggregate live personnel counts, positions, and manager candidates from Personnel List
  personnelList.forEach(p => {
    const rawUnit = (p.unit || p.department || '').trim();
    if (!rawUnit || rawUnit === 'نامشخص' || rawUnit === 'تعیین نشده') return;

    // Only count towards valid existing units (do not revive deleted units)
    const entry = unitMap.get(rawUnit);
    if (!entry) return;

    entry.headcount += 1;

    const job = (p.jobTitle || p.position || '').trim();
    if (job) {
      entry.positions.add(job);
      if (
        !entry.managerCandidate &&
        (job.includes('مدیر') || job.includes('رئیس') || job.includes('سرپرست') || job.toLowerCase().includes('manager') || job.toLowerCase().includes('head'))
      ) {
        entry.managerCandidate = p.fullName;
      }
    }

    if (p.workplace && p.workplace.trim()) {
      entry.workplaces.add(p.workplace.trim());
    }
  });

  const extractedDepartments: Department[] = [];
  let idx = 1;

  unitMap.forEach(entry => {
    let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
    const n = entry.name;
    if (
      n.includes('تولید') ||
      n.includes('فرآیند') ||
      n.includes('بهره‌برداری') ||
      n.includes('الفین') ||
      n.includes('پلیمر') ||
      n.includes('آتش‌نشانی') ||
      n.includes('مخازن')
    ) {
      riskLevel = 'High';
    } else if (
      n.includes('تعمیرات') ||
      n.includes('فنی') ||
      n.includes('مهندسی') ||
      n.includes('برق') ||
      n.includes('مکانیک') ||
      n.includes('تاسیسات') ||
      n.includes('HSE') ||
      n.includes('ایمنی') ||
      n.includes('آزمایشگاه')
    ) {
      riskLevel = 'Medium';
    }

    const deptId = entry.orgNodeMatch?.id || `dept-ext-${idx}`;
    const managerName =
      entry.managerCandidate ||
      entry.orgNodeMatch?.manager ||
      (entry.headcount > 0 ? 'تعیین نشده (نیازمند انتصاب)' : 'بدون شاغل فعال');

    extractedDepartments.push({
      id: deptId,
      name: entry.name,
      description: entry.orgNodeMatch?.description || entry.name,
      code: entry.orgNodeMatch?.code || `DEP-${idx}`,
      manager: managerName,
      employeeCount: entry.headcount > 0 ? entry.headcount : entry.orgNodeMatch?.headcount || 0,
      riskLevel
    });
    idx++;
  });

  extractedDepartments.sort((a, b) => b.employeeCount - a.employeeCount);
  inMemoryDepartmentsCache = extractedDepartments;

  return extractedDepartments;
}

/**
 * Validates and processes an uploaded signature image file (strictly PNG or JPEG)
 * into an optimized Base64 Data URL ready for database storage and document signing.
 */
export function processSignatureImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const validExt = /\.(png|jpe?g)$/i.test(file.name || '');
    if (!validTypes.includes(file.type) && !validExt) {
      reject(new Error('فرمت فایل نمونه امضا باید حتماً PNG یا JPEG باشد.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خطا در خواندن فایل نمونه امضا.'));
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          const maxW = 600;
          const maxH = 260;
          let width = img.width || 400;
          let height = img.height || 160;
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.jpe?g$/i.test(file.name || '');
          if (isJpeg) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          } else {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/png'));
          }
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Resolves the stored PNG/JPEG signature sample for a user or personnel member
 * by checking direct properties, in-memory personnel cache, and system users.
 */
export function getPersonnelSignature(target?: any): string | undefined {
  if (!target) return undefined;

  const extractSigFromUser = (u: any): string | undefined => {
    if (!u || typeof u !== 'object') return undefined;
    const sig = u.signatureImage || u.digitalSignature || u.profileData?.signatureImage || u.extraData?.signatureImage;
    return sig && typeof sig === 'string' && sig.trim().length > 10 ? sig : undefined;
  };

  if (typeof target === 'object') {
    const directSig = extractSigFromUser(target);
    if (directSig) return directSig;

    const candidates = [
      target.personnelCode,
      target.personnelNumber,
      target.effectiveCode,
      target.nationalCode,
      target.nationalId,
      target.userId,
      target.personId,
      target.id,
      target.username,
      target.userName,
      target.fullName,
      target.name
    ]
      .filter(Boolean)
      .map(c => String(c).trim());

    for (const c of candidates) {
      const found = findPersonnelFast(c);
      if (found?.signatureImage) {
        return found.signatureImage;
      }
    }

    try {
      const normCandidates = candidates.map(c => normalizeLookupKey(c)).filter(Boolean);
      const sysUsers = getRawMemorySystemUsers();
      if (Array.isArray(sysUsers)) {
        for (const u of sysUsers) {
          const uSig = extractSigFromUser(u);
          if (uSig) {
            const uKeys = [u.id, (u as any).uid, u.username, u.personnelNumber, u.nationalId, u.fullName]
              .filter(Boolean)
              .map(x => normalizeLookupKey(String(x)));
            if (normCandidates.some(nc => uKeys.includes(nc))) {
              return uSig;
            }
          }
        }
      }

      const sessionRaw = typeof window !== 'undefined' ? sessionStorage.getItem('hse_current_user') : null;
      if (sessionRaw) {
        const curUser = JSON.parse(sessionRaw);
        const curSig = extractSigFromUser(curUser);
        if (curSig) {
          const curKeys = [curUser.id, curUser.uid, curUser.username, curUser.personnelNumber, curUser.nationalId, curUser.fullName]
            .filter(Boolean)
            .map(x => normalizeLookupKey(String(x)));
          if (normCandidates.some(nc => curKeys.includes(nc))) {
            return curSig;
          }
        }
      }
    } catch {
      // ignore
    }
  } else if (typeof target === 'string' && target.trim()) {
    const clean = target.trim();
    const candidates = Array.from(
      new Set([
        clean,
        clean.split('(')[0].trim(),
        clean.split('-')[0].trim(),
        clean.split('—')[0].trim()
      ].filter(Boolean))
    );

    for (const c of candidates) {
      const found = findPersonnelFast(c);
      if (found?.signatureImage) {
        return found.signatureImage;
      }
    }

    try {
      const normCandidates = candidates.map(c => normalizeLookupKey(c)).filter(Boolean);
      const sysUsers = getRawMemorySystemUsers();
      if (Array.isArray(sysUsers)) {
        for (const u of sysUsers) {
          const uSig = extractSigFromUser(u);
          if (uSig) {
            const uKeys = [u.id, (u as any).uid, u.username, u.personnelNumber, u.nationalId, u.fullName]
              .filter(Boolean)
              .map(x => normalizeLookupKey(String(x)));
            if (normCandidates.some(nc => uKeys.includes(nc))) {
              return uSig;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

/**
 * Reactive React hook for subscribing to the centralized Master Personnel List
 * and filtering by search query, unit, or status.
 */
export function useMasterPersonnelList(
  searchTerm = '',
  options?: {
    limit?: number;
    defaultLimit?: number;
    unit?: string;
    status?: 'active' | 'inactive' | 'all';
    bypassAccessFilter?: boolean;
  }
) {
  const includeInactive = options?.status === 'all' || options?.status === 'inactive';
  const [personnelList, setPersonnelList] = useState<ComplexPersonnel[]>(() =>
    getComplexPersonnelList({
      bypassAccessFilter: options?.bypassAccessFilter,
      includeInactive
    })
  );

  const refresh = useCallback(() => {
    setPersonnelList(
      getComplexPersonnelList({
        bypassAccessFilter: options?.bypassAccessFilter,
        includeInactive
      })
    );
  }, [options?.bypassAccessFilter, includeInactive]);

  useEffect(() => {
    refresh();
    window.addEventListener('hse_personnel_updated', refresh);
    window.addEventListener('hse_user_assignments_updated', refresh);
    window.addEventListener('app_data_mutated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('hse_personnel_updated', refresh);
      window.removeEventListener('hse_user_assignments_updated', refresh);
      window.removeEventListener('app_data_mutated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const filteredPersonnel = useMemo(() => {
    const q = normalizeLookupKey(searchTerm);
    const unitFilter = options?.unit ? normalizeLookupKey(options.unit) : '';
    const maxLimit = q ? (options?.limit ?? 25) : (options?.defaultLimit ?? options?.limit ?? 20);

    const results: ComplexPersonnel[] = [];
    for (let i = 0; i < personnelList.length; i++) {
      const p = personnelList[i];
      if (options?.status === 'active' && p.status === 'inactive') continue;
      if (options?.status === 'inactive' && p.status !== 'inactive') continue;
      if (unitFilter && normalizeLookupKey(p.unit) !== unitFilter && !normalizeLookupKey(p.unit).includes(unitFilter)) {
        continue;
      }

      if (!q) {
        results.push(p);
      } else {
        const haystacks = [
          p.fullName,
          `${p.firstName || ''} ${p.lastName || ''}`,
          p.personnelCode,
          p.effectiveCode,
          p.nationalCode,
          p.unit,
          p.jobTitle,
          p.position,
          p.mobile
        ]
          .filter(Boolean)
          .map(s => normalizeLookupKey(String(s)));

        if (haystacks.some(h => h.includes(q))) {
          results.push(p);
        }
      }

      if (results.length >= maxLimit) break;
    }
    return results;
  }, [personnelList, searchTerm, options?.unit, options?.status, options?.limit, options?.defaultLimit]);

  return { personnelList, filteredPersonnel, refresh };
}
