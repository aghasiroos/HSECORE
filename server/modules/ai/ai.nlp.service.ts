/**
 * HSECORE AI Persian NLP, Intent Recognition, Typo Tolerant Normalizer & Query Planner
 * Provides deep Persian morphological cleanup, spell-checking for HSE terminology,
 * intelligent intent recognition (10 distinct intent types), query planning,
 * and contextual entity extraction.
 */

export type AIUserIntentType =
  | 'INFORMATIONAL_QUERY'      // 1. پرسش اطلاعاتی عمومی یا مقرراتی
  | 'DATABASE_EXTRACTION'     // 2. استخراج اطلاعات و رکوردهای پایگاه داده
  | 'ANALYTICAL_COMPARISON'   // 3. تحلیل و مقایسه اطلاعات و روندها
  | 'MANAGEMENT_STAT_REPORT'  // 4. تهیه گزارش آماری و مدیریتی
  | 'PERSONNEL_DOSSIER'       // 5. بررسی سوابق کارکنان (۳۶۰ درجه)
  | 'MODULE_AUDIT_STATUS'     // 6. بررسی وضعیت عملکرد و انطباق ماژول‌ها
  | 'DISCREPANCY_ERROR_CHECK' // 7. شناسایی مغایرت‌ها، خطاها و ناهنجاری‌ها
  | 'HSE_KPI_PERFORMANCE'     // 8. تحلیل شاخص‌های عملکرد HSE (TRIR, LTIFR, ...)
  | 'MULTI_MODULE_SUMMARY'    // 9. درخواست اطلاعات تجمیعی از چند ماژول
  | 'SYSTEM_WIDE_ALL_SCOPE';  // 10. درخواست تحلیل کل سامانه (/ALL)

export interface ParsedUserIntent {
  rawQuery: string;
  normalizedQuery: string;
  intentType: AIUserIntentType;
  intentTitleFa: string;
  confidence: number;
  extractedEntities: {
    personnelCodes: string[];
    nationalCodes: string[];
    potentialNames: string[];
    dates: string[];
    years: number[];
    moduleHints: string[];
    isComparison: boolean;
    isStatistical: boolean;
  };
  recommendedTools: string[];
  suggestedReportFormat: 'SIMPLE' | 'ANALYTICAL' | 'STATISTICAL' | 'MANAGEMENT' | 'EXTRACTION';
}

/**
 * Common Persian & HSE typos, informal words, and transliteration correction dictionary
 */
const PERSIAN_HSE_TYPO_MAP: Array<[RegExp, string]> = [
  // Common typo & transliteration variants
  [/معاينات|معاينه/g, 'معاینات'],
  [/ادورای|ادوری|ادوارى/g, 'ادواری'],
  [/ازمایش|ازمايش|آزمايش/g, 'آزمایش'],
  [/پرسنلي|پرسنلى/g, 'پرسنلی'],
  [/پرونده ى|پرونده‌ی/g, 'پرونده'],
  [/حادتثه|حوادس|حوادثه/g, 'حادثه'],
  [/پرميت|پرميط|پروانه كار|پروانه کار ایمن/g, 'پروانه کار'],
  [/ايمن|ايمني/g, 'ایمنی'],
  [/گازسنجي|گاز سنجی/g, 'گازسنجی'],
  [/شنوایی سنجی|شنوايى سنجى|ادیومتری|اديومتري/g, 'شنوایی‌سنجی'],
  [/بینایی سنجی|بينايى سنجى|اپتومتری|اپتومتري/g, 'بینایی‌سنجی'],
  [/اسپیرومتری|اسپيرومتري|تنفس ریه/g, 'اسپیرومتری'],
  [/اتش نشانی|آتش‌نشانى|اطفا حريق|اطفاء حریق/g, 'آتش‌نشانی'],
  [/كپسول|کپسول های/g, 'کپسول'],
  [/هایدرانت|هيدرانت|شیر آتش نشانی/g, 'هیدرانت'],
  [/پسماندها|پساب ها|پسماند خطرناک/g, 'پسماند'],
  [/عدم انطباق ها|نان کانفورمنس|نان‌کانفورمنس/g, 'عدم انطباق'],
  [/استرس گرمایی|تنش حرارتی|گرمازدگی|wbgt/gi, 'استرس گرمایی'],
  [/تجهیزات حفاظت فردی|لوازم ایمنی|وسایل حفاظت فردی/g, 'تجهیزات حفاظت فردی'],
  [/شاخص حوادث|نرخ حادثه|ضریب تکرار حادثه|trir|ltifr/gi, 'شاخص TRIR'],
  [/چارت سازمانی|سلسله مراتب سازمانی|ساختار اداره/g, 'ساختار سازمانی'],
  [/تغذیه و رژیم|اضافه وزن|چاقی مفرط|شاخص bmi/gi, 'تغذیه و BMI'],
  [/فرایندها|گردش کارها|کارتابل ارجاع|bpmn/gi, 'فرآیند و کارتابل'],
];

/**
 * Deep Persian NLP Normalizer:
 * Handles Arabic digits, zero-width non-joiners (نیم‌فاصله), honorifics, spelling mistakes,
 * and mixed Persian-English terms.
 */
export function advancedNormalizePersian(text: string): string {
  if (!text) return '';
  let str = String(text)
    // Convert Arabic/Persian digits to standard Latin digits for parsing
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    // Normalize Arabic character variants to standard Persian
    .replace(/[\u064A\u0649\u0626]/g, 'ی') // ي ى ئ -> ی
    .replace(/\u0643/g, 'ک') // ك -> ک
    .replace(/\u0629/g, 'ه') // ة -> ه
    .replace(/\u0624/g, 'و') // ؤ -> و
    .replace(/[\u0622\u0623\u0625]/g, 'ا') // آ أ إ -> ا
    // Clean zero-width spaces and control characters
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .toLowerCase();

  // Apply domain typo & term normalization
  for (const [pattern, replacement] of PERSIAN_HSE_TYPO_MAP) {
    str = str.replace(pattern, replacement);
  }

  // Remove repeated duplicate spaces
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Intent Classifier & Entity Extractor (Requirement 3 & 4)
 */
export function analyzeUserIntentAndEntities(rawQuery: string): ParsedUserIntent {
  const normalizedQuery = advancedNormalizePersian(rawQuery);

  // Extract Numeric Tokens (Personnel Code: 3-10 digits, National Code: 10 digits, Years: 1390-1410)
  const numericMatches = Array.from(normalizedQuery.matchAll(/\b\d{3,12}\b/g)).map(m => m[0]);
  const nationalCodes = numericMatches.filter(n => n.length === 10);
  const personnelCodes = numericMatches.filter(n => n.length >= 3 && n.length <= 8 && !nationalCodes.includes(n));
  const years = numericMatches
    .map(n => Number(n))
    .filter(y => y >= 1380 && y <= 1420);

  // Extract Dates (e.g., 1404/02/15, 1403-05-10)
  const dateMatches = Array.from(normalizedQuery.matchAll(/\b(13\d{2}|14\d{2})[/-]\d{1,2}[/-]\d{1,2}\b/g)).map(m => m[0]);

  // Extract Potential Person Name Hints
  const honorificPattern = /(?:اقا|آقا|اقای|آقای|خانم|مهندس|دکتر|پرسنل|کارگر|همکار)\s+([^\d،؛\n.,]+?)(?:\s+(?:به\s+کد|کد|کدملی|با|در|را|رو|از|\d)|$)/i;
  const nameMatch = rawQuery.match(honorificPattern);
  const potentialNames: string[] = [];
  if (nameMatch && nameMatch[1]?.trim().length >= 3) {
    potentialNames.push(nameMatch[1].trim());
  }

  // Module Hints Recognition
  const moduleHints: string[] = [];
  if (/(معاینه|معاینات|طب کار|شنوایی|ادیومتری|اسپیرومتری|اپتومتری|صلاحیت پزشکی|سلامت)/.test(normalizedQuery)) moduleHints.push('health');
  if (/(پروانه|پرمیت|ptw|کار گرم|کار سرد|فضای بسته|حفاری|ایزولاسیون|loto)/.test(normalizedQuery)) moduleHints.push('ptw');
  if (/(حادثه|حوادث|شبه حادثه|near miss|رویداد|سوانح|آسیب|صدمه)/.test(normalizedQuery)) moduleHints.push('incidents');
  if (/(ریسک|خطر|مخاطره|jsa|hazid|fmea|ماتریس)/.test(normalizedQuery)) moduleHints.push('risks');
  if (/(5s|۵s|آراستگی|اراستگی|نظم|چک لیست|بازرسی)/.test(normalizedQuery)) moduleHints.push('five_s');
  if (/(اتش نشانی|آتش‌نشانی|حریق|اطفا|کپسول|هیدرانت|فوم)/.test(normalizedQuery)) moduleHints.push('fire');
  if (/(اخطار|تخلف|عدم انطباق|ناهنجاری|انضباطی)/.test(normalizedQuery)) moduleHints.push('warnings');
  if (/(اموزش|آموزش|دوره|گواهینامه|صلاحیت|شایستگی)/.test(normalizedQuery)) moduleHints.push('training');
  if (/(حفاظت فردی|ppe|کفش|کلاه|دستکش|ماسک|عینک)/.test(normalizedQuery)) moduleHints.push('ppe');
  if (/(محیط زیست|پسماند|پساب|فاضلاب|آلاینده|دودکش)/.test(normalizedQuery)) moduleHints.push('environment');
  if (/(استرس گرمایی|wbgt|دما|گرما|رطوبت|هواشناسی)/.test(normalizedQuery)) moduleHints.push('heat');
  if (/(پرسنل|کارکنان|ساختار سازمانی|واحد|دپارتمان|کد پرسنلی)/.test(normalizedQuery)) moduleHints.push('personnel');
  if (/(فرایند|فرآیند|گردش کار|کارتابل|bpmn|ارجاع)/.test(normalizedQuery)) moduleHints.push('workflows');
  if (/(شاخص|trir|ltifr|kpi|نفر ساعت|داشبورد)/.test(normalizedQuery)) moduleHints.push('reports');

  // Intent Classification Logic
  let intentType: AIUserIntentType = 'INFORMATIONAL_QUERY';
  let intentTitleFa = 'پرسش اطلاعاتی و مقرراتی HSE';
  let confidence = 0.8;
  let suggestedFormat: 'SIMPLE' | 'ANALYTICAL' | 'STATISTICAL' | 'MANAGEMENT' | 'EXTRACTION' = 'ANALYTICAL';

  const isAllScope = /(?:^|\s)\/\s*all(?:\s|$)/i.test(rawQuery) ||
    ['کل سامانه', 'همه ماژول', 'تمام ماژول', 'گزارش کلی', 'گزارش جامع', 'تحلیل کلی', 'تحلیل جامع'].some(term => normalizedQuery.includes(term));

  const isPersonnelQuery = personnelCodes.length > 0 || nationalCodes.length > 0 || potentialNames.length > 0 ||
    /(پرونده|سوابق|اطلاعات پرسنلی|سلامت پرسنل|معاینات پرسنل|وضعیت شغلی|کد پرسنلی|کد ملی)\b/.test(normalizedQuery);

  const isComparison = /(مقایسه|تطبیق|روند|نسبت به|اختلاف|تغییرات|کاهش یا افزایش|سیر تحول)/.test(normalizedQuery);
  const isStatistical = /(آمار|تعداد|چند مورد|درصد|میانگین|مجموع|نرخ|شاخص|سهم|فراوانی|جدول آماری)/.test(normalizedQuery);
  const isManagementReport = /(گزارش مدیریتی|خلاصه مدیریتی|تحلیل کلان|گزارش عملکرد|نقاط ضعف|پیشنهادهای اصلاحی|برنامه اقدام)/.test(normalizedQuery);
  const isDiscrepancyCheck = /(مغایرت|خطا|عدم انطباق|ناهنجاری|تخلف|ناقص|بیمار پرخطر|فشار خون بالا|نامناسب|unfit|رد شده)/.test(normalizedQuery);

  if (isAllScope) {
    intentType = 'SYSTEM_WIDE_ALL_SCOPE';
    intentTitleFa = 'درخواست تحلیل مقطعی و گزارش جامع کل سامانه (/ALL)';
    suggestedFormat = 'MANAGEMENT';
    confidence = 0.98;
  } else if (isPersonnelQuery && (personnelCodes.length > 0 || nationalCodes.length > 0 || potentialNames.length > 0 || /(پرونده|سوابق|سلامت|معاینات)/.test(normalizedQuery))) {
    intentType = 'PERSONNEL_DOSSIER';
    intentTitleFa = 'بررسی و استخراج پرونده جامع ۳۶۰ درجه پرسنل';
    suggestedFormat = 'EXTRACTION';
    confidence = 0.95;
  } else if (isDiscrepancyCheck) {
    intentType = 'DISCREPANCY_ERROR_CHECK';
    intentTitleFa = 'شناسایی مغایرت‌ها، انحرافات و موارد عدم انطباق';
    suggestedFormat = 'ANALYTICAL';
    confidence = 0.9;
  } else if (isComparison) {
    intentType = 'ANALYTICAL_COMPARISON';
    intentTitleFa = 'تحلیل و مقایسه اطلاعات، روندها و دوره‌های زمانی';
    suggestedFormat = 'ANALYTICAL';
    confidence = 0.9;
  } else if (isStatistical && /(trir|ltifr|شاخص|kpi|ضریب)/.test(normalizedQuery)) {
    intentType = 'HSE_KPI_PERFORMANCE';
    intentTitleFa = 'تحلیل شاخص‌های عملکرد ایمنی و سلامت (KPI / TRIR)';
    suggestedFormat = 'STATISTICAL';
    confidence = 0.92;
  } else if (isManagementReport) {
    intentType = 'MANAGEMENT_STAT_REPORT';
    intentTitleFa = 'تهیه گزارش آماری و تحلیلی مدیریتی';
    suggestedFormat = 'MANAGEMENT';
    confidence = 0.92;
  } else if (moduleHints.length > 1) {
    intentType = 'MULTI_MODULE_SUMMARY';
    intentTitleFa = 'درخواست اطلاعات تجمیعی و تحلیل چند ماژولی';
    suggestedFormat = 'ANALYTICAL';
    confidence = 0.88;
  } else if (/(لیست|فهرست|استخراج|اطلاعات|چند نفر|ثبت شده|کارت|مشاهده)/.test(normalizedQuery)) {
    intentType = 'DATABASE_EXTRACTION';
    intentTitleFa = 'استخراج مستقیم رکوردهای عملیاتی از پایگاه داده';
    suggestedFormat = 'EXTRACTION';
    confidence = 0.88;
  } else if (/(وضعیت|چک|پایش|عملکرد|بازرسی|انطباق)/.test(normalizedQuery)) {
    intentType = 'MODULE_AUDIT_STATUS';
    intentTitleFa = 'بررسی وضعیت عملکرد و انطباق ماژول';
    suggestedFormat = 'ANALYTICAL';
    confidence = 0.85;
  }

  // Recommended Tools based on Intent & Module Hints
  const recommendedTools: string[] = [];
  if (intentType === 'SYSTEM_WIDE_ALL_SCOPE') {
    recommendedTools.push('all_modules_cross_analysis');
  } else if (intentType === 'PERSONNEL_DOSSIER') {
    recommendedTools.push('personnel_dossier');
    if (moduleHints.includes('health')) recommendedTools.push('health_medical_summary');
    if (moduleHints.includes('personnel')) recommendedTools.push('personnel_org_summary');
  } else {
    if (moduleHints.includes('heat')) recommendedTools.push('heat_weather_summary');
    if (moduleHints.includes('ptw')) recommendedTools.push('ptw_summary');
    if (moduleHints.includes('incidents')) recommendedTools.push('incidents_summary');
    if (moduleHints.includes('health')) {
      recommendedTools.push('health_medical_summary');
      recommendedTools.push('nutrition_high_risk_summary');
    }
    if (moduleHints.includes('risks')) recommendedTools.push('risk_assessment_summary');
    if (moduleHints.includes('five_s')) recommendedTools.push('five_s_inspections_summary');
    if (moduleHints.includes('fire')) recommendedTools.push('fire_safety_summary');
    if (moduleHints.includes('warnings')) recommendedTools.push('warnings_anomalies_summary');
    if (moduleHints.includes('training')) recommendedTools.push('training_summary');
    if (moduleHints.includes('ppe')) recommendedTools.push('ppe_summary');
    if (moduleHints.includes('environment')) recommendedTools.push('environment_summary');
    if (moduleHints.includes('personnel')) recommendedTools.push('personnel_org_summary');
    if (moduleHints.includes('workflows')) recommendedTools.push('workflow_referrals_summary');
    if (moduleHints.includes('reports') || isStatistical || isManagementReport) {
      recommendedTools.push('kpi_management_summary');
      recommendedTools.push('non_conformances_summary');
    }
  }

  return {
    rawQuery,
    normalizedQuery,
    intentType,
    intentTitleFa,
    confidence,
    extractedEntities: {
      personnelCodes,
      nationalCodes,
      potentialNames,
      dates: dateMatches,
      years,
      moduleHints,
      isComparison,
      isStatistical,
    },
    recommendedTools: Array.from(new Set(recommendedTools)),
    suggestedReportFormat: suggestedFormat,
  };
}
