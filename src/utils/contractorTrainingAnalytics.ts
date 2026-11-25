import {
  cleanPersianValue,
  normalizeDigits,
  normalizeForMatching,
} from './textNormalization.ts';
import { parseDateString } from './jalaliDate.ts';
import type {
  ContractorCompany,
  ContractorCompanyAggregate,
  ContractorPersonnelDetail,
  ContractorTrainingGlobalStats,
  ContractorTrainingRecord,
  LegacyContractorSummary,
} from '../types/training.ts';

/**
 * Generates a canonical deduplication key for contractor company names.
 * Unifies Arabic/Persian Yeh/Kaf, diacritics, ZWNJ, punctuation, and extra spaces
 * so typo/spacing variants map to the exact same company.
 */
export function normalizeContractorCompanyKey(name?: string | null): string {
  const base = normalizeForMatching(name || '');
  return base.replace(/[\s\-_.,،/\\()[\]«»"'‌]+/g, '');
}

/**
 * Cleans contractor company display text while preserving proper Persian orthography.
 */
export function cleanContractorDisplayName(name?: string | null): string {
  return cleanPersianValue(name || '').replace(/\s+/g, ' ').trim();
}

/**
 * Generates a canonical deduplication key for an individual trainee within a company.
 * Ensures the same individual attending multiple courses is counted ONCE in unique personnel,
 * while all course hours and records remain summed.
 */
export function normalizeContractorPersonKey(
  companyNormalizedKey: string,
  fullName?: string | null
): string {
  const cleanPerson = normalizeForMatching(fullName || '').replace(
    /[\s\-_.,،()[\]«»"'‌]+/g,
    ''
  );
  return `${companyNormalizedKey}::${cleanPerson}`;
}

/**
 * Converts a Jalali/Gregorian date string to an integer YYYYMMDD for reliable range filtering and sorting.
 */
export function toComparableJalaliNumber(dateStr?: string | null): number | null {
  if (!dateStr || !String(dateStr).trim()) return null;
  const parsed = parseDateString(dateStr);
  if (!parsed.jalali) return null;
  const { jy, jm, jd } = parsed.jalali;
  return jy * 10000 + jm * 100 + jd;
}

/**
 * Rounds numeric hours cleanly to up to 2 decimal places without floating-point artifacts.
 */
export function roundHours(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

/**
 * Safely parses positive training hours (hours/person) from raw input.
 */
export function parseTrainingHours(raw: unknown): number {
  const normalized = normalizeDigits(String(raw ?? '')).replace(/,/g, '.');
  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return roundHours(num);
}

/**
 * Computes exact per-company and global statistical aggregations from individual training records:
 * - Each record's trainingHours represents hours/person for that single attendance.
 * - Company totalHours = sum of trainingHours across all valid records for that company.
 * - Company uniquePersonnelCount = count of unique trainees (same person attending multiple courses counts once).
 * - Company averagePerCapitaHours = totalHours / uniquePersonnelCount.
 * - recordsCount and uniquePersonnelCount are tracked as separate metrics.
 */
export function computeContractorTrainingAggregates(
  records: ContractorTrainingRecord[],
  companies: ContractorCompany[] = []
): {
  companyAggregates: ContractorCompanyAggregate[];
  globalStats: ContractorTrainingGlobalStats;
} {
  const validRecords = (Array.isArray(records) ? records : []).filter(
    (r) =>
      r &&
      typeof r.companyName === 'string' &&
      r.companyName.trim().length > 0 &&
      typeof r.personnelFullName === 'string' &&
      r.personnelFullName.trim().length > 0 &&
      Number.isFinite(Number(r.trainingHours)) &&
      Number(r.trainingHours) > 0
  );

  const companyMetaByKey = new Map<string, ContractorCompany>();
  companies.forEach((c) => {
    const key = c.normalizedKey || normalizeContractorCompanyKey(c.name);
    if (key && !companyMetaByKey.has(key)) {
      companyMetaByKey.set(key, { ...c, normalizedKey: key });
    }
  });

  const groupMap = new Map<
    string,
    {
      companyId: string;
      companyName: string;
      normalizedKey: string;
      records: ContractorTrainingRecord[];
      personMap: Map<string, ContractorPersonnelDetail>;
      totalHours: number;
      lastDateNum: number;
      lastTrainingDate: string;
    }
  >();

  const globalUniquePersonKeys = new Set<string>();

  validRecords.forEach((rec) => {
    const companyKey = normalizeContractorCompanyKey(rec.companyName);
    if (!companyKey) return;

    const meta = companyMetaByKey.get(companyKey);
    const canonicalName = meta?.name || cleanContractorDisplayName(rec.companyName);
    const canonicalId = meta?.id || rec.companyId || `cmp-${companyKey}`;

    let group = groupMap.get(companyKey);
    if (!group) {
      group = {
        companyId: canonicalId,
        companyName: canonicalName,
        normalizedKey: companyKey,
        records: [],
        personMap: new Map(),
        totalHours: 0,
        lastDateNum: -1,
        lastTrainingDate: '',
      };
      groupMap.set(companyKey, group);
    }

    const hrs = roundHours(Number(rec.trainingHours));
    group.records.push(rec);
    group.totalHours = roundHours(group.totalHours + hrs);

    const dateNum = toComparableJalaliNumber(rec.trainingDate) ?? -1;
    if (dateNum > group.lastDateNum) {
      group.lastDateNum = dateNum;
      group.lastTrainingDate = rec.trainingDate || '';
    }

    const personKey = normalizeContractorPersonKey(companyKey, rec.personnelFullName);
    globalUniquePersonKeys.add(personKey);

    let person = group.personMap.get(personKey);
    if (!person) {
      person = {
        personKey,
        fullName: cleanContractorDisplayName(rec.personnelFullName),
        jobTitles: [],
        recordsCount: 0,
        totalHours: 0,
        dates: [],
        records: [],
      };
      group.personMap.set(personKey, person);
    }

    person.recordsCount += 1;
    person.totalHours = roundHours(person.totalHours + hrs);
    person.records.push(rec);

    const cleanJob = cleanContractorDisplayName(rec.jobTitle);
    if (cleanJob && !person.jobTitles.includes(cleanJob)) {
      person.jobTitles.push(cleanJob);
    }
    if (rec.trainingDate && !person.dates.includes(rec.trainingDate)) {
      person.dates.push(rec.trainingDate);
    }
  });

  const companyAggregates: ContractorCompanyAggregate[] = Array.from(groupMap.values())
    .map((g) => {
      const uniquePersonnelCount = g.personMap.size;
      const recordsCount = g.records.length;
      const totalHours = roundHours(g.totalHours);
      const averagePerCapitaHours =
        uniquePersonnelCount > 0 ? roundHours(totalHours / uniquePersonnelCount) : 0;

      const personnelDetails = Array.from(g.personMap.values())
        .map((p) => ({
          ...p,
          dates: [...p.dates].sort(
            (a, b) => (toComparableJalaliNumber(b) ?? 0) - (toComparableJalaliNumber(a) ?? 0)
          ),
          records: [...p.records].sort(
            (a, b) =>
              (toComparableJalaliNumber(b.trainingDate) ?? 0) -
              (toComparableJalaliNumber(a.trainingDate) ?? 0)
          ),
        }))
        .sort((a, b) => b.totalHours - a.totalHours);

      return {
        companyId: g.companyId,
        companyName: g.companyName,
        normalizedKey: g.normalizedKey,
        uniquePersonnelCount,
        recordsCount,
        totalHours,
        averagePerCapitaHours,
        lastTrainingDate: g.lastTrainingDate,
        personnelDetails,
        records: [...g.records].sort(
          (a, b) =>
            (toComparableJalaliNumber(b.trainingDate) ?? 0) -
            (toComparableJalaliNumber(a.trainingDate) ?? 0)
        ),
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const totalHours = roundHours(
    companyAggregates.reduce((sum, item) => sum + item.totalHours, 0)
  );
  const totalUniquePersonnel = globalUniquePersonKeys.size;
  const totalRecords = validRecords.length;
  const averagePerCapitaHours =
    totalUniquePersonnel > 0 ? roundHours(totalHours / totalUniquePersonnel) : 0;

  return {
    companyAggregates,
    globalStats: {
      totalCompanies: companyAggregates.length,
      totalUniquePersonnel,
      totalRecords,
      totalHours,
      averagePerCapitaHours,
    },
  };
}

/**
 * Synchronizes aggregated per-company metrics into the legacy `hse_training_contractors`
 * structure so TrainingDashboard, ReportsModule, and header KPIs stay 100% accurate
 * while preserving any legacy contractor entries that do not yet have individual records.
 */
export function buildSyncedLegacyContractors(
  records: ContractorTrainingRecord[],
  companies: ContractorCompany[],
  existingLegacyList: LegacyContractorSummary[] = []
): LegacyContractorSummary[] {
  const { companyAggregates } = computeContractorTrainingAggregates(records, companies);
  const coveredKeys = new Set<string>(companyAggregates.map((a) => a.normalizedKey));

  const derivedEntries: LegacyContractorSummary[] = companyAggregates.map((agg) => ({
    id: agg.companyId,
    name: agg.companyName,
    headcount: agg.uniquePersonnelCount,
    perCapita: agg.averagePerCapitaHours,
    totalHours: agg.totalHours,
    recordsCount: agg.recordsCount,
    source: 'individual_records',
  }));

  // Preserve pre-existing legacy rows only if they were manually created previously
  // and have not yet been superseded by individual records for the same company.
  const preservedLegacy = (Array.isArray(existingLegacyList) ? existingLegacyList : []).filter(
    (item) => {
      if (!item || !item.name) return false;
      if (item.source === 'individual_records') return false;
      const key = normalizeContractorCompanyKey(item.name);
      return Boolean(key) && !coveredKeys.has(key);
    }
  );

  return [...derivedEntries, ...preservedLegacy];
}
