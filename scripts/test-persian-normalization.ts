import {
  normalizePersianArabicText,
  normalizeForMatching,
  cleanPersianValue,
  normalizeDigits,
  cleanExcelCellValue,
  fuzzyMatchPersian,
  matchPersonnelNames,
  sortRecordsByYearAndMonth
} from '../src/utils/textNormalization';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('--- Starting Persian/Arabic Excel Normalization Tests ---');

// Test 1: ی = ي = ى
console.log('\n[Test Group 1: Yeh Variants (ی / ي / ى)]');
const yehPersian = 'علی';
const yehArabic = 'علي';
const yehMaksura = 'على';
assert(
  normalizeForMatching(yehPersian) === normalizeForMatching(yehArabic) &&
  normalizeForMatching(yehPersian) === normalizeForMatching(yehMaksura),
  `Yeh unification: "${yehPersian}" == "${yehArabic}" == "${yehMaksura}" -> "${normalizeForMatching(yehPersian)}"`
);

// Test 2: ک = ك
console.log('\n[Test Group 2: Kaf Variants (ک / ك)]');
const kafPersian = 'کریمی';
const kafArabic = 'كريمي';
assert(
  normalizeForMatching(kafPersian) === normalizeForMatching(kafArabic),
  `Kaf unification: "${kafPersian}" == "${kafArabic}" -> "${normalizeForMatching(kafPersian)}"`
);

// Test 3: Mixed Persian and Arabic text & Alef / Heh variants
console.log('\n[Test Group 3: Mixed Persian/Arabic & Alef/Heh/Hamza]');
const mixedArabic = 'إدارة الصيانة والتأهيل الـشاملة';
const mixedPersian = 'اداره الصیانه والتاهیل الشامله';
assert(
  normalizeForMatching(mixedArabic) === normalizeForMatching(mixedPersian),
  `Mixed Persian/Arabic match: "${mixedArabic}" == "${mixedPersian}" -> "${normalizeForMatching(mixedArabic)}"`
);

const alefMadda = 'آرش';
const alefBare = 'ارش';
const alefHamza = 'أرش';
assert(
  normalizeForMatching(alefMadda) === normalizeForMatching(alefBare) &&
  normalizeForMatching(alefBare) === normalizeForMatching(alefHamza),
  `Alef normalization: "${alefMadda}" == "${alefBare}" == "${alefHamza}" -> "${normalizeForMatching(alefMadda)}"`
);

// Test 4: Unusual whitespaces (NBSP \u00A0, thin space \u2009, ZWSP \u200B, tabs, BOM \uFEFF)
console.log('\n[Test Group 4: Unusual Whitespaces & Spaces]');
const strangeSpaces = '\uFEFF  محمد\u00A0\u00A0رضا \u200B  حسینی\t\t\n ';
const normalName = 'محمد رضا حسینی';
assert(
  normalizeForMatching(strangeSpaces) === normalizeForMatching(normalName),
  `Whitespace cleanup: stripped BOM, NBSP, ZWSP, tabs -> "${normalizeForMatching(strangeSpaces)}"`
);

// Test 5: Nim-faseleh (ZWNJ \u200C) and Tatweel (ـ)
console.log('\n[Test Group 5: Nim-faseleh (ZWNJ) & Tatweel]');
const zwnjName = 'محمد\u200Cرضا';
const spaceName = 'محمد رضا';
const joinedName = 'محمدرضا';
const tatweelName = 'مـحـمـد رضـا';
assert(
  matchPersonnelNames('محمد‌رضا', 'کریمی', 'محمدرضا', 'کریمی'),
  `ZWNJ loose matching: "محمد‌رضا" matches "محمدرضا"`
);
assert(
  normalizeForMatching(tatweelName) === normalizeForMatching(spaceName),
  `Tatweel removal: "${tatweelName}" matches "${spaceName}"`
);

// Test 6: Numbers (Persian, Arabic, and English digits)
console.log('\n[Test Group 6: Number and Code Normalization]');
const engDigits = '1234567890';
const faDigits = '۱۲۳۴۵۶۷۸۹۰';
const arDigits = '١٢٣٤٥٦٧٨٩٠';
assert(
  normalizeDigits(faDigits) === engDigits && normalizeDigits(arDigits) === engDigits,
  `Digits conversion: FA="${faDigits}", AR="${arDigits}" -> "${engDigits}"`
);

const natCodeRaw = ' ۱۲۳-۴۵۶-۷۸۹۰ ';
assert(
  normalizeDigits(natCodeRaw, true) === '1234567890',
  `National Code cleanup: "${natCodeRaw}" -> "1234567890"`
);

// Test 7: Diacritics and Harakat
console.log('\n[Test Group 7: Diacritics and Harakat]');
const withDiacritics = 'مُحَمَّدْ عَلِيّ حُسَيْنِي';
const plainName = 'محمد علی حسینی';
assert(
  normalizeForMatching(withDiacritics) === normalizeForMatching(plainName),
  `Harakat removal: "${withDiacritics}" matches "${plainName}"`
);

// Test 8: Separation of Original Value and Normalized Value
console.log('\n[Test Group 8: Preserving Original Values vs Normalized Matching]');
const originalExcelInput = '  مُحَمَّد‌رِضا  كريميـ  ';
const cleanedForStorage = cleanPersianValue(originalExcelInput);
const normalizedForSearch = normalizeForMatching(originalExcelInput);

assert(
  cleanedForStorage.includes('کریمی') && cleanedForStorage.includes('\u200C'),
  `Storage preserves ZWNJ & exact name while standardizing Yeh/Kaf: "${cleanedForStorage}"`
);
assert(
  normalizedForSearch === 'محمدرضا کریمی',
  `Search normalization strips diacritics, ZWNJ, tatweel: "${normalizedForSearch}"`
);

// Test 9: Excel cell value cleaner & 100% preservation
console.log('\n[Test Group 9: Exact Excel Cell Value Preservation]');
assert(cleanExcelCellValue(1402) === '1402', 'Integer cell value cleanly converted');
assert(cleanExcelCellValue('  پتروشیمی بوعلی‌سینا  ') === '  پتروشیمی بوعلی‌سینا  ', 'Raw string preserved 100% with exact spaces');
assert(cleanExcelCellValue('كريمي') === 'كريمي', 'Arabic Kaf and Yeh preserved in raw cell value');
assert(cleanExcelCellValue('۱۲۳۴۵') === '۱۲۳۴۵', 'Persian digits preserved in raw cell value');
assert(cleanExcelCellValue(null) === '', 'Null cell returns empty string');

// Test 10: Full Personnel Name Matching across realistic variations
console.log('\n[Test Group 10: Complex Personnel Name & Code Matching]');
const existingPerson = {
  firstName: 'محمدرضا',
  lastName: 'کریمی پور',
  fullName: 'محمدرضا کریمی پور',
  personnelCode: '1045',
  nationalCode: '1234567890'
};

// Excel has Arabic Yeh, Kaf, ZWNJ, Tatweel, and Persian digits
const excelRecord = {
  rawFirstName: 'مُحمّد‌رضا',
  rawLastName: 'كريميـ پور',
  rawPersonnelCode: '۱۰۴۵',
  rawNationalCode: '۱۲۳۴۵۶۷۸۹۰'
};

assert(
  normalizeDigits(excelRecord.rawNationalCode, true) === existingPerson.nationalCode,
  'National code matching across Persian and ASCII digits'
);
assert(
  normalizeDigits(excelRecord.rawPersonnelCode, true) === existingPerson.personnelCode,
  'Personnel code matching across Persian and ASCII digits'
);
assert(
  matchPersonnelNames(excelRecord.rawFirstName, excelRecord.rawLastName, existingPerson.firstName, existingPerson.lastName),
  'Name matching with Arabic Yeh/Kaf, Tatweel, Harakat, and ZWNJ'
);

// Test 11: Year -> Month Chronological Sorting without modifying original values
console.log('\n[Test Group 11: Chronological Year -> Month Sorting]');
const unsortedRecords = [
  { year: 1403, month: 'شهریور' },
  { year: 1402, month: 'دی' },
  { year: 1402, month: 'فروردین' },
  { year: 1403, month: 'اردیبهشت' }
];

const sorted = sortRecordsByYearAndMonth(unsortedRecords, true);
assert(sorted[0].year === 1402 && sorted[0].month === 'فروردین', '1402 فروردین is first');
assert(sorted[1].year === 1402 && sorted[1].month === 'دی', '1402 دی is second');
assert(sorted[2].year === 1403 && sorted[2].month === 'اردیبهشت', '1403 اردیبهشت is third');
assert(sorted[3].year === 1403 && sorted[3].month === 'شهریور', '1403 شهریور is fourth');
assert(sorted[3].month === 'شهریور', 'Original month string preserved verbatim without modification');

console.log('\n🎉 ALL 11 TEST SUITES COMPLETED SUCCESSFULLY WITH 100% PASS RATE!\n');
