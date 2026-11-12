/**
 * HSECORE AI Smart Slash (`/`) Module Search, Typo-Tolerant Matcher & Metadata Enricher
 *
 * Implements:
 * - Real-time `/` command parsing (supports `/`, `/query`, `/ALL`, and inline `/query`)
 * - Persian & English normalization (Yeh/Kaf unification, ZWNJ removal, digit normalization)
 * - Typo tolerance (common HSE spelling variations + bounded Levenshtein edit distance)
 * - Alias & synonym matching across all HSECORE modules, submodules, and tabs
 * - Relevance scoring, deduplication, and hierarchical parent/submodule path resolution
 */

import { normalizeForMatching } from './textNormalization.ts';

export interface SlashModuleCatalogItem {
  moduleId: string;
  moduleNameFa: string;
  moduleNameEn?: string;
  mainModuleNameFa?: string;
  subModuleNameFa?: string;
  groupId?: string;
  groupTitleFa?: string;
  iconName?: string;
  accessPath?: string;
  routePath?: string;
  aliases?: string[];
  connected: boolean;
  tools?: string[];
  notes?: string;
  parentModuleId?: string;
  level?: number;
  internal?: boolean;
  isSpecialAllCommand?: boolean;
  isAllCommand?: boolean;
  isSelected?: boolean;
  matchScore?: number;
  matchTier?: 'all_command' | 'exact' | 'prefix' | 'contains' | 'fuzzy';
}

export type RankedSlashModuleItem = SlashModuleCatalogItem;

export interface ParsedSlashCommand {
  /** Whether the slash autocomplete dropdown should be visible */
  isActive: boolean;
  /** Trimmed query typed after `/` */
  query: string;
  /** Raw query typed after `/` */
  rawQuery: string;
  /** Normalized query for matching */
  normalizedQuery: string;
  /** True when the user explicitly typed `/ALL` (case-insensitive) */
  isExplicitAll: boolean;
  /** Start index of the `/...` token in the input string */
  tokenStart: number;
  /** End index of the `/...` token in the input string */
  tokenEnd: number;
}

/**
 * Common Persian & English typo corrections and synonym expansions for module search
 */
const MODULE_SEARCH_TYPO_SYNONYMS: Array<[RegExp, string]> = [
  [/پراونه|پروانهه|پروان|پرميت|پرميط|پرمیت|مجوز کار|مجوزهای کار/g, 'پروانه کار ptw permit'],
  [/معاينات|معاینت|معاينه|معاینه|طبکار|طب کار/g, 'معاینات ادواری طب کار health'],
  [/ادوراي|ادورای|ادوري|ادوری/g, 'ادواری periodic'],
  [/اديومتري|ادیومتری|شنوايي|شنوایی/g, 'شنوایی سنجی معاینات طب کار'],
  [/اسپيرومتري|اسپیرومتری|تنفس|ریه/g, 'اسپیرومتری معاینات طب کار'],
  [/اپتومتري|اپتومتری|بينايي|بینایی/g, 'بینایی سنجی معاینات طب کار'],
  [/اتش نشاني|آتش نشاني|اتشنشانی|آتشنشانی|انش نشانی|اطفا|اطفاء|حريق|حریق/g, 'آتش نشانی fire'],
  [/كپسول|کپسول|خاموش كننده|خاموش کننده/g, 'کپسول اطفاء حریق fire extinguisher'],
  [/هيدرانت|هایدرانت|هیدرانت/g, 'هایدرانت آتش نشانی hydrant'],
  [/گازياب|گازیاب|گازسنج|دتكتور|دتکتور/g, 'گازیاب دتکتور gas detector'],
  [/اراستگي|آراستگي|اراستگی|پنج اس|5s|۵s/g, 'ساماندهی آراستگی 5s'],
  [/حوادس|حادتثه|حادثه|سوانح|سانحه|شبه حادثه/g, 'حوادث ناهنجاری incidents'],
  [/ريسك|ریسک|مخاطره|مخاطرات|خطرات|jsa|fmea|hazid/g, 'ارزیابی ریسک risk jsa'],
  [/تجهيزات حفاظت فردي|حفاظت فردی|لباس کار|کفش ایمنی|کلاه ایمنی/g, 'تجهیزات حفاظت فردی ppe'],
  [/اموزش|آموزش|دوره ها|گواهینامه|شایستگی/g, 'آموزش training'],
  [/پرنسل|پرسنل|کارکنان|سوابق پرسنلی|پرونده پرسنل/g, 'پرونده پرسنل personnel'],
  [/عدم انطباق|نان کانفورمنس|اقدام اصلاحی|capa/g, 'عدم انطباق capa non-conformances'],
  [/محيط زيست|محیط زیست|پسماند|زباله|پساب|فاضلاب|الاینده|آلاینده/g, 'محیط زیست پسماند پساب environment'],
  [/استرس گرمايي|استرس گرمایی|تنش حرارتی|گرمازدگی|wbgt|دما و رطوبت/g, 'استرس گرمایی heat wbgt'],
  [/فرايند|فرآیند|گردش کار|کارتابل|ارجاع|bpmn/g, 'فرآیند کارتابل process workflows'],
  [/دستورالعمل|مستندات|مدارک|آیین نامه|سرتیفیکیت/g, 'دستورالعمل مستندات documents'],
  [/اخطار|تخلف|تخلفات|انضباطی/g, 'اخطارها warnings'],
  [/شاخص|نرخ حادثه|ضریب تکرار|trir|ltifr|داشبورد/g, 'داشبورد شاخص گزارش trir dashboard reports'],
  [/بهداري|بهداری|کلینیک|اورژانس|تغذيه|تغذیه|رژیم|bmi/g, 'بهداری تغذیه سلامت clinic nutrition bmi'],
  [/كاربران|کاربران|دسترسی|نقش ها|rbac/g, 'مدیریت کاربران دسترسی user-mgmt'],
  [/تنظيمات|تنظیمات|پشتیبان گیری|بکاپ|ساختار سازمانی/g, 'تنظیمات سامانه ساختار سازمانی system'],
  [/اعلان|هشدار|نوتیفیکیشن/g, 'مدیریت هشدار اعلان notifications'],
];

/**
 * Rich metadata lookup for canonical HSECORE modules and parent groups
 */
export const MODULE_METADATA_DIRECTORY: Record<
  string,
  {
    titleEn: string;
    groupTitleFa: string;
    iconName: string;
    aliases: string[];
  }
> = {
  dashboard: {
    titleEn: 'Unified Executive Dashboard',
    groupTitleFa: 'داشبوردها و تحلیل‌های آماری',
    iconName: 'BarChart3',
    aliases: ['dashboard', 'داشبورد مدیریتی', 'داشبورد اصلی', 'آمار کلی', 'kpi', 'شاخص کلیدی'],
  },
  heat: {
    titleEn: 'Thermal Heat Stress Monitor (WBGT)',
    groupTitleFa: 'داشبوردها و تحلیل‌های آماری',
    iconName: 'ThermometerSun',
    aliases: ['heat', 'heat stress', 'wbgt', 'استرس گرمایی', 'تنش حرارتی', 'دما و رطوبت', 'هواشناسی'],
  },
  'hse-ms': {
    titleEn: 'TRIR Incident Rate Monitor',
    groupTitleFa: 'داشبوردها و تحلیل‌های آماری',
    iconName: 'Activity',
    aliases: ['trir', 'ltifr', 'hse-ms', 'نرخ رویدادها', 'ضریب تکرار حادثه', 'نفر ساعت'],
  },
  reports: {
    titleEn: 'Statistical Reports & BI Analytics',
    groupTitleFa: 'مرکز هوشمند مدیریت و تحلیل HSE',
    iconName: 'PieChart',
    aliases: ['reports', 'bi', 'analytics', 'گزارشات', 'گزارشات تحلیلی و آماری', 'گزارش آماری', 'تحلیل آماری'],
  },
  'ai-assistant': {
    titleEn: 'HSECORE AI Assistant',
    groupTitleFa: 'مرکز هوشمند مدیریت و تحلیل HSE',
    iconName: 'Sparkles',
    aliases: ['ai', 'assistant', 'هوش مصنوعی', 'دستیار هوشمند'],
  },
  'safety-unit': {
    titleEn: 'Safety Operations & Inspections Department',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'ShieldCheck',
    aliases: ['safety', 'safety-unit', 'inspection', 'واحد ایمنی', 'بازرسی ایمنی', 'چک لیست ایمنی', '5s'],
  },
  'fire-dept': {
    titleEn: 'Fire Department & Emergency Response',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Flame',
    aliases: ['fire', 'fire-dept', 'extinguisher', 'hydrant', 'آتش نشانی', 'اطفاء حریق', 'کپسول', 'هایدرانت', 'امداد'],
  },
  'health-env': {
    titleEn: 'Occupational Health & Environment Department',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'HeartPulse',
    aliases: ['health', 'environment', 'health-env', 'بهداشت و محیط زیست', 'طب کار', 'معاینات ادواری', 'پسماند', 'پساب'],
  },
  permit: {
    titleEn: 'Permit to Work (PTW)',
    groupTitleFa: 'مجوزهای کار و کنترل ریسک',
    iconName: 'FileCheck2',
    aliases: ['permit', 'ptw', 'work permit', 'پروانه کار', 'مجوز کار', 'پرمیت', 'کار گرم', 'کار سرد', 'فضای بسته', 'حفاری'],
  },
  'ptw-audit': {
    titleEn: 'Permit to Work Audit System (PTW Audit)',
    groupTitleFa: 'مجوزهای کار و کنترل ریسک',
    iconName: 'ClipboardCheck',
    aliases: ['ptw-audit', 'permit audit', 'ممیزی پروانه کار', 'ممیزی ptw', 'بازرسی مجوز کار'],
  },
  risk: {
    titleEn: 'AI Risk Assessment (JSA / FMEA / HAZID)',
    groupTitleFa: 'مجوزهای کار و کنترل ریسک',
    iconName: 'ShieldAlert',
    aliases: ['risk', 'jsa', 'fmea', 'hazid', 'ارزیابی ریسک', 'شناسایی خطرات', 'مخاطرات', 'ماتریس ریسک'],
  },
  ppe: {
    titleEn: 'Personal Protective Equipment (PPE)',
    groupTitleFa: 'مجوزهای کار و کنترل ریسک',
    iconName: 'HardHat',
    aliases: ['ppe', 'protective equipment', 'تجهیزات حفاظت فردی', 'وسایل ایمنی', 'کفش ایمنی', 'کلاه ایمنی'],
  },
  incidents: {
    titleEn: 'Safety Incidents, Near-Misses & OSHA 300',
    groupTitleFa: 'رویدادها و انضباط ایمنی',
    iconName: 'AlertOctagon',
    aliases: ['incidents', 'accident', 'near miss', 'osha 300', 'حوادث', 'حادثه', 'شبه حادثه', 'ناهنجاری', 'سانحه'],
  },
  warnings: {
    titleEn: 'Personnel Safety Warnings & Violations',
    groupTitleFa: 'رویدادها و انضباط ایمنی',
    iconName: 'AlertTriangle',
    aliases: ['warnings', 'violation', 'اخطار', 'اخطارها', 'تخلفات ایمنی', 'انضباط ایمنی'],
  },
  'personnel-history': {
    titleEn: 'Personnel 360° Comprehensive Dossier',
    groupTitleFa: 'مرکز هوشمند مدیریت و تحلیل HSE',
    iconName: 'Users',
    aliases: ['personnel', 'personnel-history', 'dossier', 'employee', 'پرونده پرسنل', 'پرونده ۳۶۰ درجه پرسنل', 'پرسنل', 'سوابق پرسنلی', '۳۶۰ درجه'],
  },
  training: {
    titleEn: 'HSE Training Management & Calendar',
    groupTitleFa: 'سرمایه انسانی و آموزش',
    iconName: 'GraduationCap',
    aliases: ['training', 'course', 'education', 'آموزش', 'تقویم آموزشی', 'دوره آموزشی', 'گواهینامه'],
  },
  documents: {
    titleEn: 'HSE Instructions, Procedures & Certificates (RAG)',
    groupTitleFa: 'کارتابل و فرآیندهای سازمانی',
    iconName: 'FileText',
    aliases: ['documents', 'procedures', 'certificates', 'مستندات', 'دستورالعمل', 'روش اجرایی', 'گواهینامه تجهیزات'],
  },
  'pending-documents': {
    titleEn: 'Inbox & Documents Awaiting Action',
    groupTitleFa: 'کارتابل و فرآیندهای سازمانی',
    iconName: 'Inbox',
    aliases: ['pending-documents', 'inbox', 'referrals', 'کارتابل', 'اسناد در انتظار اقدام', 'ارجاعات'],
  },
  'non-conformances': {
    titleEn: 'Non-Conformities & CAPA Management',
    groupTitleFa: 'کارتابل و فرآیندهای سازمانی',
    iconName: 'ClipboardList',
    aliases: ['non-conformances', 'capa', 'nc', 'عدم انطباق', 'اقدام اصلاحی', 'اقدام پیشگیرانه'],
  },
  'process-management': {
    titleEn: 'BPMN Process & Workflow Management',
    groupTitleFa: 'مدیریت و پیکربندی سامانه',
    iconName: 'Workflow',
    aliases: ['process-management', 'bpmn', 'workflow', 'مدیریت فرآیندها', 'گردش کار', 'طراحی فرآیند'],
  },
  notifications: {
    titleEn: 'Real-Time HSE Alerts & Notifications',
    groupTitleFa: 'مدیریت و پیکربندی سامانه',
    iconName: 'Bell',
    aliases: ['notifications', 'alerts', 'push', 'اعلان', 'هشدار', 'پیام اضطراری'],
  },
  'user-mgmt': {
    titleEn: 'User Management & RBAC Access Matrix',
    groupTitleFa: 'مدیریت و پیکربندی سامانه',
    iconName: 'UserCog',
    aliases: ['user-mgmt', 'users', 'rbac', 'permissions', 'مدیریت کاربران', 'دسترسی ها', 'نقش ها'],
  },
  system: {
    titleEn: 'System Settings, Org Chart & Backup',
    groupTitleFa: 'مدیریت و پیکربندی سامانه',
    iconName: 'Settings',
    aliases: ['system', 'settings', 'backup', 'تنظیمات سامانه', 'ساختار سازمانی', 'پشتیبان گیری'],
  },
  profile: {
    titleEn: 'User Profile & Security Settings',
    groupTitleFa: 'مدیریت و پیکربندی سامانه',
    iconName: 'User',
    aliases: ['profile', 'account', 'پروفایل', 'شناسنامه کاربری'],
  },
  'periodic-exams': {
    titleEn: 'Periodic Occupational Medical Examinations',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Stethoscope',
    aliases: ['periodic-exams', 'medical exams', 'occupational health', 'معاینات ادواری', 'طب کار', 'پرونده سلامت', 'آزمایشگاه طب کار'],
  },
  clinic: {
    titleEn: 'Occupational Clinic & Dispensary Visits',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'HeartPulse',
    aliases: ['clinic', 'dispensary', 'بهداری', 'مراجعات سرپایی', 'اورژانس کارگاه', 'تریاژ'],
  },
  nutrition: {
    titleEn: 'Nutrition Specialist & BMI Monitoring',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Activity',
    aliases: ['nutrition', 'bmi', 'diet', 'تغذیه', 'رژیم درمانی', 'شاخص توده بدنی', 'چاقی و اضافه وزن'],
  },
  'non-periodic-exams': {
    titleEn: 'Non-Periodic & Pre-Employment Medical Exams',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Stethoscope',
    aliases: ['non-periodic-exams', 'pre-employment', 'معاینات غیر دوره ای', 'بدو استخدام', 'بازگشت به کار'],
  },
  'waste-management': {
    titleEn: 'Environmental Waste Management (EMP)',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Leaf',
    aliases: ['waste-management', 'waste', 'emp', 'مدیریت پسماند', 'پسماند خطرناک', 'پسماند صنعتی'],
  },
  wastewater: {
    titleEn: 'Wastewater & Effluent Treatment (ETP)',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Leaf',
    aliases: ['wastewater', 'etp', 'effluent', 'مدیریت پساب', 'فاضلاب', 'تصفیه خانه'],
  },
  'env-monitoring': {
    titleEn: 'Environmental Pollutant Monitoring',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Leaf',
    aliases: ['env-monitoring', 'environmental monitoring', 'پایش محیط زیستی', 'آلاینده ها'],
  },
  'air-water-soil': {
    titleEn: 'Stack Emissions, Water & Soil Monitoring',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'Leaf',
    aliases: ['air-water-soil', 'stacks', 'پایش دودکش', 'آب و خاک'],
  },
  'five-s': {
    titleEn: '5S Workplace Organization System',
    groupTitleFa: 'دپارتمان‌های تخصصی HSE',
    iconName: 'ClipboardCheck',
    aliases: ['five-s', '5s', '۵s', 'ساماندهی 5s', 'نظام آراستگی'],
  },
};

/**
 * Maps internal parent IDs to their canonical user-facing parent module ID
 */
const INTERNAL_PARENT_TO_CANONICAL: Record<string, string> = {
  ptw: 'permit',
  health: 'health-env',
  environment: 'health-env',
  fire: 'fire-dept',
  five_s: 'safety-unit',
  risks: 'risk',
  personnel: 'personnel-history',
  workflows: 'process-management',
};

/**
 * Normalizes query with Persian/Arabic unification + HSE typo & synonym expansion
 */
export function normalizeModuleSearchText(input: string): string {
  const base = normalizeForMatching(input);
  if (!base) return '';
  let expanded = base;
  for (const [pattern, replacement] of MODULE_SEARCH_TYPO_SYNONYMS) {
    if (pattern.test(base)) {
      expanded += ' ' + normalizeForMatching(replacement);
    }
  }
  return expanded.trim();
}

/**
 * Bounded Levenshtein edit distance for typo-tolerant word matching
 */
export function computeEditDistance(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDist) return maxDist + 1;

  const dp: number[] = Array.from({ length: lenB + 1 }, (_, i) => i);
  for (let i = 1; i <= lenA; i++) {
    let prev = dp[0];
    dp[0] = i;
    let minInRow = dp[0];
    for (let j = 1; j <= lenB; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,      // deletion
        dp[j - 1] + 1,  // insertion
        prev + cost     // substitution
      );
      prev = temp;
      if (dp[j] < minInRow) minInRow = dp[j];
    }
    if (minInRow > maxDist) return maxDist + 1;
  }
  return dp[lenB];
}

/**
 * Parses the user's input box text to detect an active `/` command and extract the search query.
 * Supports:
 * 1. Input starting with `/` (e.g. `/`, `/پروانه`, `/پروانه کار گرم`, `/ALL`, `/ptw`)
 * 2. Input containing an inline `/` command at the cursor or end of text (e.g. `بررسی وضعیت /پروانه`)
 */
export function parseSlashQueryFromInput(input: string, cursorPosition?: number): ParsedSlashCommand {
  const raw = String(input ?? '');
  if (!raw) {
    return {
      isActive: false,
      query: '',
      rawQuery: '',
      normalizedQuery: '',
      isExplicitAll: false,
      tokenStart: -1,
      tokenEnd: -1,
    };
  }

  // Case 1: Input starts with `/` (allows multi-word module queries like `/پروانه کار گرم`)
  const leadingMatch = raw.match(/^(\s*)\/([^\n]*)$/);
  if (leadingMatch) {
    const leadingSpaces = leadingMatch[1].length;
    const afterSlash = leadingMatch[2];
    const trimmedQuery = afterSlash.trim();
    const isExplicitAll = /^all$/i.test(trimmedQuery);
    return {
      isActive: true,
      query: trimmedQuery,
      rawQuery: afterSlash,
      normalizedQuery: normalizeForMatching(trimmedQuery),
      isExplicitAll,
      tokenStart: leadingSpaces,
      tokenEnd: raw.length,
    };
  }

  // Case 2: Inline `/` after whitespace near cursor or at the end of the text
  const targetEnd = typeof cursorPosition === 'number' && cursorPosition >= 0 ? cursorPosition : raw.length;
  const sliceUpToCursor = raw.slice(0, targetEnd);
  const inlineMatch = sliceUpToCursor.match(/(?:^|\s)(\/[^\s/]*)$/);
  if (inlineMatch) {
    const token = inlineMatch[1]; // starts with '/'
    const tokenStart = sliceUpToCursor.length - token.length;
    const afterSlash = token.slice(1);
    const trimmedQuery = afterSlash.trim();
    return {
      isActive: true,
      query: trimmedQuery,
      rawQuery: afterSlash,
      normalizedQuery: normalizeForMatching(trimmedQuery),
      isExplicitAll: /^all$/i.test(trimmedQuery),
      tokenStart,
      tokenEnd: targetEnd,
    };
  }

  return {
    isActive: false,
    query: '',
    rawQuery: '',
    normalizedQuery: '',
    isExplicitAll: false,
    tokenStart: -1,
    tokenEnd: -1,
  };
}

/**
 * Removes the active `/...` token from the input text after the user selects a module chip
 */
export function stripSlashTokenFromInput(input: string, parsed: ParsedSlashCommand): string {
  if (!parsed.isActive || parsed.tokenStart < 0) return input;
  const before = input.slice(0, parsed.tokenStart);
  const after = input.slice(parsed.tokenEnd);
  return `${before}${after}`.replace(/\s+/g, ' ').trimStart();
}

/**
 * Enriches a module catalog item with mainModuleNameFa, subModuleNameFa, moduleNameEn,
 * iconName, accessPath, routePath, and search aliases.
 */
export function enrichModuleCatalogItem<T extends SlashModuleCatalogItem>(
  item: T,
  byIdMap?: Map<string, T>
): T {
  const id = String(item.moduleId || '').trim();
  const canonicalParentId = item.parentModuleId
    ? INTERNAL_PARENT_TO_CANONICAL[item.parentModuleId] || item.parentModuleId
    : undefined;
  const parentItem = canonicalParentId && byIdMap ? byIdMap.get(canonicalParentId) : undefined;

  const meta =
    MODULE_METADATA_DIRECTORY[id] ||
    (canonicalParentId ? MODULE_METADATA_DIRECTORY[canonicalParentId] : undefined);

  // Split composite titles like "پروانه کار / پروانه کار گرم" into mainModuleNameFa & subModuleNameFa
  let mainModuleNameFa = item.mainModuleNameFa || '';
  let subModuleNameFa = item.subModuleNameFa || '';

  if (item.moduleNameFa.includes(' / ')) {
    const parts = item.moduleNameFa.split(' / ').map(p => p.trim()).filter(Boolean);
    mainModuleNameFa = parentItem?.moduleNameFa || parts[0] || item.moduleNameFa;
    subModuleNameFa = parts.slice(1).join(' / ');
  } else if (parentItem && parentItem.moduleId !== id) {
    mainModuleNameFa = parentItem.moduleNameFa.split(' / ')[0].trim();
    subModuleNameFa = item.moduleNameFa;
  } else {
    mainModuleNameFa = item.moduleNameFa;
    subModuleNameFa = '';
  }

  const groupTitleFa =
    item.groupTitleFa ||
    meta?.groupTitleFa ||
    (parentItem && MODULE_METADATA_DIRECTORY[parentItem.moduleId]?.groupTitleFa) ||
    'ماژول‌های عملیاتی HSECORE';

  const iconName =
    item.iconName ||
    MODULE_METADATA_DIRECTORY[id]?.iconName ||
    meta?.iconName ||
    'Layers';

  const moduleNameEn =
    item.moduleNameEn ||
    MODULE_METADATA_DIRECTORY[id]?.titleEn ||
    id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const routePath = item.routePath || (canonicalParentId && canonicalParentId !== id ? `/${canonicalParentId}/${id}` : `/${id}`);

  const pathParts = [groupTitleFa, mainModuleNameFa];
  if (subModuleNameFa && subModuleNameFa !== mainModuleNameFa) {
    pathParts.push(subModuleNameFa);
  }
  const accessPath = item.accessPath || pathParts.filter(Boolean).join(' › ');

  const aliases = Array.from(
    new Set([
      ...(item.aliases || []),
      ...(MODULE_METADATA_DIRECTORY[id]?.aliases || []),
      ...(meta?.aliases || []),
      id,
      id.replace(/-/g, ' '),
      moduleNameEn,
      mainModuleNameFa,
      subModuleNameFa,
    ].filter(Boolean))
  );

  return {
    ...item,
    mainModuleNameFa,
    subModuleNameFa: subModuleNameFa || undefined,
    moduleNameEn,
    groupTitleFa,
    iconName,
    accessPath,
    routePath,
    aliases,
  };
}

/**
 * Special `/ALL` command item representing all active modules and submodules
 */
export function createSpecialAllCommandItem(isSelected = false): RankedSlashModuleItem {
  return {
    moduleId: 'all',
    moduleNameFa: '/ALL — تحلیل جامع تمام ماژول‌ها و زیرماژول‌های سامانه',
    mainModuleNameFa: 'تحلیل جامع کل سامانه (/ALL)',
    subModuleNameFa: 'تمامی ماژول‌ها، زیرماژول‌ها و تب‌های فعال',
    moduleNameEn: 'ALL System Modules & Submodules Analysis',
    groupTitleFa: 'دستور ویژه سراسری',
    iconName: 'Sparkles',
    accessPath: 'فرمان ویژه سراسری › پوشش ۱۰۰٪ ماژول‌ها و زیرماژول‌های مجاز (/ALL)',
    routePath: '/ALL',
    aliases: ['all', '/all', 'همه', 'تمام ماژول ها', 'کل سامانه', 'تحلیل جامع', 'گزارش کلی'],
    connected: true,
    tools: ['all_modules_cross_analysis'],
    level: 0,
    isSpecialAllCommand: true,
    isAllCommand: true,
    isSelected,
    matchScore: 1000,
    matchTier: 'all_command',
  };
}

/**
 * Smart search, deduplication, and relevance ranking across all HSECORE modules and submodules.
 */
export function searchAndRankModules(
  catalog: SlashModuleCatalogItem[],
  rawQuery: string,
  options?: {
    selectedModuleIds?: string[];
    includeAllCommand?: boolean;
    onlyConnected?: boolean;
  }
): RankedSlashModuleItem[] {
  const includeAllCommand = options?.includeAllCommand ?? true;
  const onlyConnected = options?.onlyConnected ?? false;
  const selectedSet = new Set((options?.selectedModuleIds || []).map(id => String(id).trim().toLowerCase()));
  const isAllSelected = selectedSet.has('all');

  // 1. Deduplicate by normalized moduleId and filter out internal-only aliases
  const byId = new Map<string, SlashModuleCatalogItem>();
  for (const rawItem of catalog) {
    if (!rawItem || !rawItem.moduleId || rawItem.internal) continue;
    if (onlyConnected && !rawItem.connected) continue;
    const key = String(rawItem.moduleId).trim().toLowerCase();
    if (!byId.has(key)) {
      byId.set(key, rawItem);
    }
  }

  // Enrich all items with hierarchy, English names, icons, and access paths
  const enrichedItems: RankedSlashModuleItem[] = [];
  for (const item of byId.values()) {
    const enriched = enrichModuleCatalogItem(item, byId);
    enrichedItems.push({
      ...enriched,
      isAllCommand: false,
      isSelected: isAllSelected || selectedSet.has(enriched.moduleId.toLowerCase()),
    });
  }

  const trimmedRaw = String(rawQuery || '').replace(/^\s*\/+/, '').trim();
  const normQuery = normalizeForMatching(trimmedRaw);
  const expandedQuery = normalizeModuleSearchText(trimmedRaw);

  // 2. If query is empty (user just typed `/`), return `/ALL` + all active modules in hierarchical order
  if (!normQuery) {
    const result: RankedSlashModuleItem[] = [];
    if (includeAllCommand) {
      result.push(createSpecialAllCommandItem(isAllSelected));
    }
    return [...result, ...enrichedItems];
  }

  // 3. Explicit `/ALL` command handling — never confuse with ordinary search
  const isAllQuery =
    /^all$/i.test(trimmedRaw) ||
    ['همه', 'همه ماژول ها', 'تمام ماژول ها', 'کل سامانه'].includes(normQuery);

  if (isAllQuery && includeAllCommand) {
    return [createSpecialAllCommandItem(isAllSelected), ...enrichedItems];
  }

  const queryTokens = expandedQuery.split(/\s+/).filter(Boolean);
  const rawTokens = normQuery.split(/\s+/).filter(Boolean);

  // First pass: score each item directly
  const directScores = new Map<string, number>();

  for (const item of enrichedItems) {
    const idNorm = normalizeForMatching(item.moduleId.replace(/-/g, ' '));
    const idRaw = item.moduleId.toLowerCase();
    const nameFaNorm = normalizeForMatching(item.moduleNameFa);
    const mainFaNorm = normalizeForMatching(item.mainModuleNameFa || '');
    const subFaNorm = normalizeForMatching(item.subModuleNameFa || '');
    const nameEnNorm = normalizeForMatching(item.moduleNameEn || '');
    const groupNorm = normalizeForMatching(item.groupTitleFa || '');
    const pathNorm = normalizeForMatching(item.accessPath || '');
    const aliasesNorm = (item.aliases || []).map(a => normalizeForMatching(a));

    let score = 0;

    // A. Exact Match (Highest Priority)
    if (
      idRaw === normQuery ||
      idNorm === normQuery ||
      nameFaNorm === normQuery ||
      mainFaNorm === normQuery ||
      subFaNorm === normQuery ||
      nameEnNorm === normQuery ||
      aliasesNorm.some(a => a === normQuery)
    ) {
      score += 500;
    }

    // B. Prefix / StartsWith Match
    if (
      nameFaNorm.startsWith(normQuery) ||
      mainFaNorm.startsWith(normQuery) ||
      subFaNorm.startsWith(normQuery) ||
      nameEnNorm.startsWith(normQuery) ||
      idRaw.startsWith(normQuery) ||
      idNorm.startsWith(normQuery) ||
      aliasesNorm.some(a => a.startsWith(normQuery))
    ) {
      score += 320;
    }

    // C. Word-Boundary Match in Titles or Aliases
    const searchablePrimary = `${nameFaNorm} ${mainFaNorm} ${subFaNorm} ${nameEnNorm} ${idNorm}`;
    const primaryWords = searchablePrimary.split(/\s+/).filter(Boolean);
    const allWords = `${searchablePrimary} ${aliasesNorm.join(' ')} ${groupNorm}`.split(/\s+/).filter(Boolean);

    if (primaryWords.some(w => w === normQuery || w.startsWith(normQuery))) {
      score += 220;
    } else if (allWords.some(w => w === normQuery || w.startsWith(normQuery))) {
      score += 160;
    }

    // D. Substring Match
    if (
      nameFaNorm.includes(normQuery) ||
      mainFaNorm.includes(normQuery) ||
      subFaNorm.includes(normQuery) ||
      nameEnNorm.includes(normQuery) ||
      idRaw.includes(normQuery)
    ) {
      score += 140;
    } else if (aliasesNorm.some(a => a.includes(normQuery)) || pathNorm.includes(normQuery)) {
      score += 100;
    }

    // E. Multi-Token & Expanded Synonym Match
    let matchedRawTokens = 0;
    for (const rt of rawTokens) {
      if (rt.length < 2) continue;
      if (
        searchablePrimary.includes(rt) ||
        aliasesNorm.some(a => a.includes(rt)) ||
        pathNorm.includes(rt)
      ) {
        matchedRawTokens++;
        score += 70;
      } else {
        // Typo-tolerant bounded edit distance check on words
        const maxDist = rt.length >= 5 ? 2 : rt.length >= 3 ? 1 : 0;
        if (maxDist > 0) {
          const closeWord = allWords.some(
            w => w.length >= 3 && computeEditDistance(rt, w.slice(0, rt.length + 1), maxDist) <= maxDist
          );
          if (closeWord) {
            matchedRawTokens++;
            score += 55;
          }
        }
      }
    }

    // F. Synonym expansion tokens check (when raw tokens had a typo/synonym like "پرمیت" -> "پروانه کار ptw")
    if (score === 0 && queryTokens.length > rawTokens.length) {
      const extraTokens = queryTokens.filter(t => !rawTokens.includes(t));
      for (const et of extraTokens) {
        if (et.length < 2) continue;
        if (searchablePrimary.includes(et) || aliasesNorm.some(a => a.includes(et))) {
          score += 85;
        }
      }
    }

    // G. Bonus if all raw tokens matched
    if (rawTokens.length > 1 && matchedRawTokens === rawTokens.length) {
      score += 120;
    }

    // Slight preference for top-level modules when relevance scores are close
    if (score > 0 && (!item.level || item.level === 0)) {
      score += 15;
    }

    if (score > 0) {
      directScores.set(item.moduleId, score);
    }
  }

  // Second pass: Include related submodules/tabs when their parent module matched strongly
  const scoredResults: RankedSlashModuleItem[] = [];
  for (const item of enrichedItems) {
    let score = directScores.get(item.moduleId) || 0;
    if (score === 0 && item.parentModuleId) {
      const canonicalParent = INTERNAL_PARENT_TO_CANONICAL[item.parentModuleId] || item.parentModuleId;
      const parentScore = Math.max(
        directScores.get(item.parentModuleId) || 0,
        directScores.get(canonicalParent) || 0
      );
      if (parentScore >= 140) {
        score = Math.floor(parentScore * 0.45);
      }
    }

    if (score > 0) {
      const matchTier: RankedSlashModuleItem['matchTier'] =
        score >= 500
          ? 'exact'
          : score >= 300
            ? 'prefix'
            : score >= 140
              ? 'contains'
              : 'fuzzy';
      scoredResults.push({
        ...item,
        matchScore: score,
        matchTier,
      });
    }
  }

  // Sort by matchScore descending, then level ascending, then Persian name
  scoredResults.sort((a, b) => {
    const scoreDiff = (b.matchScore || 0) - (a.matchScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const levelDiff = (a.level || 0) - (b.level || 0);
    if (levelDiff !== 0) return levelDiff;
    return a.moduleNameFa.localeCompare(b.moduleNameFa, 'fa');
  });

  // Also include `/ALL` at the top if query partially matches "all" or "همه" or "کل"
  if (
    includeAllCommand &&
    ('all'.startsWith(normQuery) || 'همه'.startsWith(normQuery) || 'کل سامانه'.startsWith(normQuery))
  ) {
    return [createSpecialAllCommandItem(isAllSelected), ...scoredResults];
  }

  return scoredResults;
}
