import { 
  ComplexPersonnel, 
  getComplexPersonnelList, 
  normalizeNationalCode, 
  isValidNationalCodeFormat, 
  findPersonnelByNationalCode 
} from '../../../utils/personnelHelper';
import { 
  normalizeForMatching, 
  normalizeDigits as normalizeDigitsUtil 
} from '../../../utils/textNormalization';

/**
 * Normalizes Persian/Arabic text by delegating to central robust textNormalization engine.
 */
export function normalizePersianString(str: string): string {
  if (!str) return '';
  return normalizeForMatching(str);
}

/**
 * Normalizes digits (Persian/Arabic to English numbers) via central engine.
 */
export function normalizeDigits(str: string): string {
  if (!str) return '';
  return normalizeDigitsUtil(str, true);
}

/**
 * Calculates Levenshtein Distance for fuzzy similarity comparison
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  const n = a.length;
  const m = b.length;

  if (n === 0) return m;
  if (m === 0) return n;

  for (let i = 0; i <= n; i++) matrix[i] = [i];
  for (let j = 0; j <= m; j++) matrix[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[n][m];
}

export function calculateStringSimilarity(str1: string, str2: string): number {
  const norm1 = normalizePersianString(str1);
  const norm2 = normalizePersianString(str2);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 100;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 100;

  const distance = calculateLevenshteinDistance(norm1, norm2);
  const similarity = Math.max(0, 100 - (distance / maxLen) * 100);
  return Math.round(similarity);
}

export interface MatchPersonnelResult {
  matchedPersonnel: ComplexPersonnel | null;
  matchMethod: 'national_code' | 'code' | 'normalized_name' | 'fuzzy' | 'unmatched';
  confidenceScore: number; // 0 to 100
  needsAdminReview: boolean;
  notes?: string;
  warning?: 'کد ملی نامعتبر' | 'کد ملی تکراری در فایل' | 'پرسنل یافت نشد' | string;
  statusText: string;
  normalizedNationalCode: string;
}

/**
 * STRICT Personnel Matching Logic:
 * Rule 1: National Code is the SINGLE primary key for automatic matching.
 * Rule 2: Digits are converted to English, spaces & special chars stripped.
 * Rule 3: Name and Surname are used ONLY for display purposes (not matching).
 * Rule 4: If not matched, status is set to «پرسنل یافت نشد».
 * Rule 5: Duplicate or invalid National Codes are flagged with warnings.
 */
export function matchPersonnelRecord(
  rawNationalCode: string,
  rawName?: string,
  personnelList?: ComplexPersonnel[],
  seenNationalCodesInFile?: Set<string>
): MatchPersonnelResult {
  const list = personnelList || getComplexPersonnelList();
  const normNatCode = normalizeNationalCode(rawNationalCode);
  const isValidNatCode = isValidNationalCodeFormat(normNatCode);
  const isDuplicateInFile = Boolean(seenNationalCodesInFile && normNatCode && seenNationalCodesInFile.has(normNatCode));

  // 1. Check National Code validity
  if (!normNatCode || !isValidNatCode) {
    const matched = normNatCode ? list.find(p => normalizeNationalCode(p.nationalCode) === normNatCode) : null;
    if (matched) {
      return {
        matchedPersonnel: matched,
        matchMethod: 'national_code',
        confidenceScore: 100,
        needsAdminReview: false,
        notes: 'تطبیق بر اساس کد ملی',
        warning: 'کد ملی نامعتبر',
        statusText: 'کد ملی نامعتبر',
        normalizedNationalCode: normNatCode
      };
    }
    return {
      matchedPersonnel: null,
      matchMethod: 'unmatched',
      confidenceScore: 0,
      needsAdminReview: true,
      notes: 'کد ملی نامعتبر یا خالی است',
      warning: 'کد ملی نامعتبر',
      statusText: 'کد ملی نامعتبر',
      normalizedNationalCode: normNatCode
    };
  }

  // 2. Strict National Code Matching
  const matched = list.find(p => {
    const pNatCode = normalizeNationalCode(p.nationalCode || p.id || p.effectiveCode);
    return pNatCode === normNatCode;
  });

  if (matched) {
    if (seenNationalCodesInFile) {
      seenNationalCodesInFile.add(normNatCode);
    }

    return {
      matchedPersonnel: matched,
      matchMethod: 'national_code',
      confidenceScore: 100,
      needsAdminReview: isDuplicateInFile,
      notes: isDuplicateInFile ? 'کد ملی تکراری در فایل' : 'تطبیق قطعی با کد ملی',
      warning: isDuplicateInFile ? 'کد ملی تکراری در فایل' : undefined,
      statusText: isDuplicateInFile ? 'کد ملی تکراری در فایل' : 'تطبیق یافته (کد ملی)',
      normalizedNationalCode: normNatCode
    };
  }

  // 3. Unmatched: DO NOT match by name or fallback to anyone else!
  if (seenNationalCodesInFile && normNatCode) {
    seenNationalCodesInFile.add(normNatCode);
  }

  return {
    matchedPersonnel: null,
    matchMethod: 'unmatched',
    confidenceScore: 0,
    needsAdminReview: true,
    notes: 'پرسنلی با این کد ملی در سامانه یافت نشد',
    warning: isDuplicateInFile ? 'کد ملی تکراری در فایل' : 'پرسنل یافت نشد',
    statusText: 'پرسنل یافت نشد',
    normalizedNationalCode: normNatCode
  };
}
