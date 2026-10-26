/**
 * Comprehensive Persian & Arabic Unicode Text Normalization and Excel Data Processor
 * 
 * Supports full font-independent Unicode processing (NFC normalization, Yeh/Kaf unification,
 * Alef/Heh/Waw normalization, Diacritic/Harakat stripping, Tatweel removal, Space & ZWNJ/ZWSP normalization,
 * and Persian/Arabic digit conversion).
 */

export interface NormalizeOptions {
  /** Strip Arabic diacritics / Harakat (Fatha, Damma, Kasra, Shadda, Sukun, Tanwin, etc.) - default: true */
  removeDiacritics?: boolean;
  /** Unify Arabic Yeh (ي, ى) to Persian Yeh (ی) - default: true */
  unifyYeh?: boolean;
  /** Unify Arabic Kaf (ك) to Persian Kaf (ک) - default: true */
  unifyKaf?: boolean;
  /** Normalize Alef variants (أ, إ, ٱ, آ) to bare Alef (ا) - default: false for storage, true for matching */
  normalizeAlef?: boolean;
  /** Normalize Heh variants (ة, ۀ) to Heh (ه) - default: true */
  normalizeHeh?: boolean;
  /** Normalize Hamza forms (ؤ -> و, ئ -> ی) - default: false for storage, true for matching */
  normalizeHamza?: boolean;
  /** Remove Tatweel / Kashida (ـ) - default: true */
  removeTatweel?: boolean;
  /** Convert Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII (0-9) - default: false for storage, true for matching */
  convertDigits?: boolean;
  /** How to handle Zero-Width Non-Joiner (\u200C / نیم‌فاصله): 'preserve' | 'remove' | 'space' - default: 'preserve' */
  zwnjMode?: 'preserve' | 'remove' | 'space';
  /** Remove Zero-Width Space (\u200B) and directional marks (\u200E, \u200F, \uFEFF) - default: true */
  removeZeroWidth?: boolean;
  /** Collapse consecutive whitespace into single standard space - default: true */
  collapseSpaces?: boolean;
  /** Trim leading and trailing whitespace - default: true */
  trim?: boolean;
  /** Convert to lowercase for ASCII characters - default: false */
  toLowerCase?: boolean;
  /** Apply Unicode NFC normalization - default: true */
  toNFC?: boolean;
}

// Arabic diacritics regex: Harakat, Tanween, Shadda, Sukun, Quranic marks, Maddah, Dagger Alef
const DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g;

// Directional marks, BOM, and zero-width spaces (excluding ZWNJ \u200C which has distinct handling)
const ZERO_WIDTH_REGEX = /[\u200B\u200D\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Non-standard whitespace characters (NBSP, En/Em spaces, Thin Space, Ideographic Space, Line breaks)
const UNUSUAL_SPACES_REGEX = /[\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\t\r\n\v\f]/g;

/**
 * Central function to normalize Persian and Arabic text according to specified options.
 */
export function normalizePersianArabicText(
  input: unknown,
  options?: NormalizeOptions
): string {
  if (input === null || input === undefined) return '';

  let str = String(input);
  if (!str) return '';

  const opts: Required<NormalizeOptions> = {
    removeDiacritics: options?.removeDiacritics ?? true,
    unifyYeh: options?.unifyYeh ?? true,
    unifyKaf: options?.unifyKaf ?? true,
    normalizeAlef: options?.normalizeAlef ?? false,
    normalizeHeh: options?.normalizeHeh ?? true,
    normalizeHamza: options?.normalizeHamza ?? false,
    removeTatweel: options?.removeTatweel ?? true,
    convertDigits: options?.convertDigits ?? false,
    zwnjMode: options?.zwnjMode ?? 'preserve',
    removeZeroWidth: options?.removeZeroWidth ?? true,
    collapseSpaces: options?.collapseSpaces ?? true,
    trim: options?.trim ?? true,
    toLowerCase: options?.toLowerCase ?? false,
    toNFC: options?.toNFC ?? true
  };

  // 1. Unicode Canonical Decomposition & Composition (NFC)
  if (opts.toNFC) {
    try {
      str = str.normalize('NFC');
    } catch {
      // Fallback if normalize not supported in rare runtimes
    }
  }

  // 2. Remove Zero-Width and control marks
  if (opts.removeZeroWidth) {
    str = str.replace(ZERO_WIDTH_REGEX, '');
  }

  // 3. Handle Zero-Width Non-Joiner (نیم‌فاصله)
  if (opts.zwnjMode === 'remove') {
    str = str.replace(/\u200C/g, '');
  } else if (opts.zwnjMode === 'space') {
    str = str.replace(/\u200C/g, ' ');
  } else {
    // Clean redundant multiple ZWNJs into single ZWNJ
    str = str.replace(/\u200C+/g, '\u200C');
  }

  // 4. Convert all non-standard spaces to standard space
  str = str.replace(UNUSUAL_SPACES_REGEX, ' ');

  // 5. Remove Tatweel / Kashida (ـ)
  if (opts.removeTatweel) {
    str = str.replace(/\u0640/g, '');
  }

  // 6. Remove Diacritics / Harakat
  if (opts.removeDiacritics) {
    str = str.replace(DIACRITICS_REGEX, '');
  }

  // 7. Unify Yeh: Arabic Yeh (ي \u064A) & Alef Maksura (ى \u0649) -> Persian Yeh (ی \u06CC)
  if (opts.unifyYeh) {
    str = str
      .replace(/\u064A/g, '\u06CC') // ي -> ی
      .replace(/\u0649/g, '\u06CC') // ى -> ی
      .replace(/\u06D2/g, '\u06CC'); // Urdu Bari Ye -> ی
  }

  // 8. Unify Kaf: Arabic Kaf (ك \u0643) -> Persian Kaf (ک \u06A9)
  if (opts.unifyKaf) {
    str = str
      .replace(/\u0643/g, '\u06A9') // ك -> ک
      .replace(/\u06AA/g, '\u06A9') // Swash Kaf -> ک
      .replace(/\u06AB/g, '\u06A9');
  }

  // 9. Normalize Alef variants: أ, إ, ٱ, آ -> ا
  if (opts.normalizeAlef) {
    str = str
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627'); // آ, أ, إ, ٱ -> ا
  }

  // 10. Normalize Heh variants: ة, ۀ -> ه
  if (opts.normalizeHeh) {
    str = str
      .replace(/\u0629/g, '\u0647') // ة -> ه
      .replace(/\u06C0/g, '\u0647'); // ۀ -> ه
  }

  // 11. Normalize Hamza variants: ؤ -> و, ئ -> ی
  if (opts.normalizeHamza) {
    str = str
      .replace(/\u0624/g, '\u0648') // ؤ -> و
      .replace(/\u0626/g, '\u06CC') // ئ -> ی
      .replace(/\u0621/g, '');      // standalone Hamza ء -> remove in loose match
  }

  // 12. Convert Persian & Arabic digits to ASCII 0-9
  if (opts.convertDigits) {
    str = str
      .replace(/[۰0٠]/g, '0')
      .replace(/[۱1١]/g, '1')
      .replace(/[۲2٢]/g, '2')
      .replace(/[۳3٣]/g, '3')
      .replace(/[۴4٤]/g, '4')
      .replace(/[۵5٥]/g, '5')
      .replace(/[۶6٦]/g, '6')
      .replace(/[۷7٧]/g, '7')
      .replace(/[۸8٨]/g, '8')
      .replace(/[۹9٩]/g, '9');
  }

  // 13. Case conversion
  if (opts.toLowerCase) {
    str = str.toLowerCase();
  }

  // 14. Collapse repeated whitespace and trim
  if (opts.collapseSpaces) {
    str = str.replace(/\s+/g, ' ');
  }

  if (opts.trim) {
    str = str.trim();
  }

  return str;
}

/**
 * Optimized text normalization for SEARCH, MATCHING, DEDUPLICATION, and LOOKUPS.
 * Maximizes matching recall across Persian/Arabic spelling variations.
 */
export function normalizeForMatching(input: unknown): string {
  if (input === null || input === undefined) return '';

  return normalizePersianArabicText(input, {
    removeDiacritics: true,
    unifyYeh: true,
    unifyKaf: true,
    normalizeAlef: true,
    normalizeHeh: true,
    normalizeHamza: true,
    removeTatweel: true,
    convertDigits: true,
    zwnjMode: 'remove', // strip ZWNJ for matching ("محمد رضا" vs "محمدرضا" vs "محمد‌رضا")
    removeZeroWidth: true,
    collapseSpaces: true,
    trim: true,
    toLowerCase: true,
    toNFC: true
  });
}

/**
 * Cleans user-entered / Excel text for PERSISTENCE & STORAGE while preserving authentic orthography:
 * - Converts Arabic Yeh/Kaf to standard Persian characters
 * - Fixes broken encoding / control chars / rogue BOM / Tatweel
 * - Cleans spaces while keeping proper Persian ZWNJ (نیم‌فاصله) intact
 */
export function cleanPersianValue(input: unknown): string {
  if (input === null || input === undefined) return '';
  if (typeof input === 'number') return String(input);

  return normalizePersianArabicText(input, {
    removeDiacritics: false,
    unifyYeh: true,
    unifyKaf: true,
    normalizeAlef: false,
    normalizeHeh: false,
    normalizeHamza: false,
    removeTatweel: true,
    convertDigits: false,
    zwnjMode: 'preserve',
    removeZeroWidth: true,
    collapseSpaces: true,
    trim: true,
    toLowerCase: false,
    toNFC: true
  });
}

/**
 * Converts Persian and Arabic digits to ASCII digits (0-9), stripping non-numeric chars if requested.
 */
export function normalizeDigits(input: unknown, numericOnly: boolean = false): string {
  if (input === null || input === undefined) return '';
  let str = String(input);
  
  str = str
    .replace(/[۰0٠]/g, '0')
    .replace(/[۱1١]/g, '1')
    .replace(/[۲2٢]/g, '2')
    .replace(/[۳3٣]/g, '3')
    .replace(/[۴4٤]/g, '4')
    .replace(/[۵5٥]/g, '5')
    .replace(/[۶6٦]/g, '6')
    .replace(/[۷7٧]/g, '7')
    .replace(/[۸8٨]/g, '8')
    .replace(/[۹9٩]/g, '9');

  if (numericOnly) {
    str = str.replace(/\D/g, '');
  }

  return str.trim();
}

/**
 * Extracts and preserves the raw cell value from Excel (.xlsx / .xls).
 * Preserves the exact original string without trimming, letter conversions, or normalization.
 */
export function cleanExcelCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return String(val);
    return String(val);
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  return String(val);
}

/**
 * Compares two strings using normalized matching.
 * Returns true if both strings match under Persian/Arabic normalization.
 */
export function fuzzyMatchPersian(str1: unknown, str2: unknown): boolean {
  const norm1 = normalizeForMatching(str1);
  const norm2 = normalizeForMatching(str2);
  if (!norm1 && !norm2) return true;
  if (!norm1 || !norm2) return false;
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
}

/**
 * Standard Persian (Jalali) months list in chronological calendar order.
 */
export const JALALI_MONTHS_LIST = [
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
] as const;

/**
 * Returns 0-based chronological index for any Jalali month name (0 for فروردین ... 11 for اسفند).
 */
export function getJalaliMonthIndex(monthInput: unknown): number {
  if (monthInput === null || monthInput === undefined) return 0;
  if (typeof monthInput === 'number' && monthInput >= 1 && monthInput <= 12) {
    return monthInput - 1;
  }
  const str = String(monthInput).trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return num - 1;
  }
  const norm = normalizeForMatching(str);

  // 1. Exact normalized match first
  for (let i = 0; i < JALALI_MONTHS_LIST.length; i++) {
    const normMonth = normalizeForMatching(JALALI_MONTHS_LIST[i]);
    if (norm === normMonth) {
      return i;
    }
  }

  // 2. Phrase contains full month name (e.g., "فروردین ماه")
  for (let i = 0; i < JALALI_MONTHS_LIST.length; i++) {
    const normMonth = normalizeForMatching(JALALI_MONTHS_LIST[i]);
    if (norm.includes(normMonth)) {
      return i;
    }
  }

  return 0;
}

/**
 * Sorts array of records chronologically by Year -> Month while preserving original values intact.
 */
/**
 * Compares personnel names taking into account first name, last name, and full name variations.
 */
export function matchPersonnelNames(
  candidateFirst: string,
  candidateLast: string,
  targetFullOrFirst: string,
  targetLast?: string
): boolean {
  const normCandFull = normalizeForMatching(`${candidateFirst} ${candidateLast}`).replace(/\s+/g, '');
  const normTargetFull = normalizeForMatching(
    targetLast ? `${targetFullOrFirst} ${targetLast}` : targetFullOrFirst
  ).replace(/\s+/g, '');

  if (!normCandFull || !normTargetFull) return false;
  return normCandFull === normTargetFull;
}

/**
 * Sorts array of records chronologically by Year -> Month while preserving original values intact.
 */
export function sortRecordsByYearAndMonth<T extends { year?: number | string; month?: string | number }>(
  records: T[],
  ascending: boolean = true
): T[] {
  return [...records].sort((a, b) => {
    const yearA = Number(a.year) || 1404;
    const yearB = Number(b.year) || 1404;
    if (yearA !== yearB) {
      return ascending ? yearA - yearB : yearB - yearA;
    }
    const monthA = getJalaliMonthIndex(a.month);
    const monthB = getJalaliMonthIndex(b.month);
    return ascending ? monthA - monthB : monthB - monthA;
  });
}
