import moment from 'moment-jalaali';
import {
  AuditLogEntry,
  AuditLogChange,
  ActionType,
  ActorType,
  AuditCategory,
  AuditSeverity,
  UserProfile,
} from '../types';

// ============================================================================
// 1. CENTRALIZED DICTIONARIES (Zero Duplication)
// ============================================================================

export const MODULE_NAMES_FA: Record<string, string> = {
  dashboard: 'داشبورد جامع مدیریتی',
  heat: 'پایش استرس گرمایی (WBGT)',
  'hse-ms': 'پایش نرخ رویدادها (TRIR)',
  trir: 'پایش نرخ رویدادها (TRIR)',
  'safety-unit': 'واحد ایمنی صنعتی',
  'fire-dept': 'واحد آتش‌نشانی و ناوگان',
  'fire_design': 'طراحی و جانمایی حفاظت حریق',
  'fire-design': 'طراحی و جانمایی حفاظت حریق',
  psm: 'مدیریت استقرار ایمنی فرایند (PSM)',
  'health-env': 'واحد بهداشت و محیط زیست',
  health: 'واحد بهداشت و طب کار',
  'medical-exams': 'معاینات ادواری طب کار',
  permit: 'پروانه کار ایمن (PTW)',
  'work-permits': 'پروانه کار ایمن (PTW)',
  ptw: 'پروانه کار ایمن (PTW)',
  'ptw-audit': 'ممیزی پروانه کار',
  incidents: 'گزارشات حوادث و ناهنجاری‌ها',
  'non-conformances': 'مدیریت عدم انطباق‌ها (CAPA)',
  ppe: 'تجهیزات حفاظت فردی (PPE)',
  risk: 'ارزیابی ریسک هوشمند',
  'personnel-history': 'سوابق جامع پرسنل ۳۶۰°',
  personnel: 'اطلاعات پرسنل مجتمع',
  training: 'مدیریت و آمار آموزش',
  warnings: 'ثبت و مدیریت اخطارها',
  reports: 'گزارشات و آمار تحلیلی',
  documents: 'دستورالعمل‌ها و مستندات',
  sds: 'برگه اطلاعات ایمنی مواد شیمیایی (SDS)',
  files: 'مدیریت فایل‌ها و مستندات',
  'pending-documents': 'کارتابل اسناد در انتظار امضا',
  referrals: 'کارتابل ارجاعات و مکاتبات',
  system: 'تنظیمات سیستم و پایگاه داده',
  settings: 'تنظیمات سیستم و پایگاه داده',
  organization: 'ساختار و چارت سازمانی',
  'process-management': 'مدیریت فرآیندها (BPMN)',
  bpmn: 'مدیریت فرآیندها (BPMN)',
  workflows: 'گردش کار و تاییدیه‌ها',
  'user-mgmt': 'مدیریت کاربران و دسترسی‌ها (RBAC)',
  users: 'مدیریت کاربران و دسترسی‌ها (RBAC)',
  auth: 'احراز هویت و امنیت نشست',
  profile: 'شناسنامه و پروفایل کاربری',
  notifications: 'مرکز اعلان‌ها و هشدارهای HSE',
  webhooks: 'وب‌هوک‌ها و یکپارچه‌سازی API',
  backup: 'پشتیبان‌گیری و بازیابی دیتابیس',
  ai_assistant: 'دستیار هوشمند HSECORE',
  hse: 'مدیریت کلان HSE',
};

export const SYSTEM_SUBTABS_FA: Record<string, string> = {
  org_structure: 'ساختار سازمانی',
  personnel: 'اطلاعات پرسنل مجتمع',
  users: 'مدیریت کاربران و دسترسی‌ها',
  notifications: 'ارسال هشدار فوری HSE و اعلان‌ها',
  audit: 'لاگ عملیات و ممیزی',
  ui_config: 'شخصی‌سازی رابط کاربری',
  integration: 'مدیریت API و وب‌هوک‌ها',
  backup: 'پشتیبان‌گیری و بازیابی دیتابیس',
};

export const FIELD_LABELS_FA: Record<string, string> = {
  fullName: 'نام و نام خانوادگی',
  firstName: 'نام',
  lastName: 'نام خانوادگی',
  fatherName: 'نام پدر',
  username: 'نام کاربری',
  personnelCode: 'کد پرسنلی',
  personnelNumber: 'شماره پرسنلی',
  nationalCode: 'کد ملی',
  nationalId: 'کد ملی',
  role: 'نقش سازمانی',
  accountStatus: 'وضعیت حساب',
  status: 'وضعیت',
  jobTitle: 'سمت شغلی',
  unit: 'واحد سازمانی',
  unitName: 'نام واحد',
  department: 'دپارتمان / بخش',
  phone: 'تلفن تماس',
  phoneNumber: 'شماره همراه',
  mobile: 'تلفن همراه',
  email: 'پست الکترونیک',
  title: 'عنوان',
  titleFa: 'عنوان فارسی',
  titleEn: 'عنوان انگلیسی',
  description: 'شرح و توضیحات',
  reason: 'علت / دلیل',
  location: 'موقعیت / محل',
  riskLevel: 'سطح ریسک',
  severity: 'شدت',
  probability: 'احتمال',
  permitNumber: 'شماره پروانه کار',
  permitType: 'نوع پروانه کار',
  validFrom: 'اعتبار از تاریخ',
  validTo: 'اعتبار تا تاریخ',
  contractorName: 'نام پیمانکار',
  enabled: 'وضعیت نمایش/فعال‌سازی',
  groupId: 'گروه منو',
  category: 'دسته‌بندی',
  dueDate: 'مهلت اقدام',
  assignedTo: 'مسئول پیگیری',
  assignedToName: 'نام مسئول پیگیری',
  correctiveAction: 'اقدام اصلاحی',
  preventiveAction: 'اقدام پیشگیرانه',
  rootCause: 'علت ریشه‌ای',
  attendance: 'نفرساعت حضور',
  mission: 'نفرساعت ماموریت',
  contractor: 'نفرساعت پیمانکار',
  incidents: 'تعداد حوادث',
  examYear: 'سال معاینه',
  doctorVerdict: 'نظر نهایی پزشک طب کار',
  sessionTimeoutMinutes: 'مهلت عدم فعالیت نشست (دقیقه)',
  personnelAccessScope: 'محدوده دسترسی پرسنلی',
};

// ============================================================================
// 2. SESSION & CONTEXT HELPERS
// ============================================================================

let activeSessionId: string = '';

export function getActiveSessionId(): string {
  if (activeSessionId) return activeSessionId;
  try {
    if (typeof window !== 'undefined') {
      const existing = sessionStorage.getItem('hse_audit_session_id');
      if (existing) {
        activeSessionId = existing;
        return existing;
      }
      activeSessionId = `SES-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      sessionStorage.setItem('hse_audit_session_id', activeSessionId);
      return activeSessionId;
    }
  } catch {}
  activeSessionId = `SES-${Date.now().toString(36).toUpperCase()}`;
  return activeSessionId;
}

export function resolveCurrentModuleInfo(): { moduleKey: string; moduleFa: string; hashPath: string } {
  if (typeof window === 'undefined') {
    return { moduleKey: 'system', moduleFa: 'سیستم عمومی', hashPath: '#dashboard' };
  }
  const rawHash = (window.location.hash || '#dashboard').replace(/^#\/?/, '').trim();
  const baseKey = rawHash.split('?')[0].split('/')[0] || 'dashboard';
  const moduleFa = MODULE_NAMES_FA[baseKey] || baseKey || 'سیستم عمومی';
  return {
    moduleKey: baseKey,
    moduleFa,
    hashPath: `#${rawHash || 'dashboard'}`,
  };
}

export function resolveModuleFromEndpoint(endpoint: string): { moduleFa: string; recordType: string } {
  const clean = endpoint.replace(/^\/api(\/v1)?\//, '').split('?')[0];
  const segments = clean.split('/').filter(Boolean);
  const root = segments[0] || 'system';
  const second = segments[1] || '';

  if (root === 'files' && second === 'documents') {
    return { moduleFa: MODULE_NAMES_FA.documents, recordType: 'DOCUMENT' };
  }
  if (root === 'settings' && second) {
    return { moduleFa: MODULE_NAMES_FA.settings, recordType: `SETTING:${second}` };
  }
  const moduleFa = MODULE_NAMES_FA[root] || MODULE_NAMES_FA[second] || 'سیستم و پایگاه داده';
  return {
    moduleFa,
    recordType: root.toUpperCase().replace(/-/g, '_'),
  };
}

export function formatBrowserSummary(ua?: string): string {
  const raw = ua || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!raw) return 'Desktop Client';
  let browser = 'Browser';
  if (raw.includes('Edg/')) browser = 'Edge';
  else if (raw.includes('Chrome/')) browser = 'Chrome';
  else if (raw.includes('Firefox/')) browser = 'Firefox';
  else if (raw.includes('Safari/') && !raw.includes('Chrome')) browser = 'Safari';

  let os = 'OS';
  if (raw.includes('Windows')) os = 'Windows';
  else if (raw.includes('Mac OS')) os = 'macOS';
  else if (raw.includes('Android')) os = 'Android';
  else if (raw.includes('iPhone') || raw.includes('iPad')) os = 'iOS';
  else if (raw.includes('Linux')) os = 'Linux';

  return `${browser} / ${os}`;
}

// ============================================================================
// 3. GENERIC DIFF CALCULATOR (Field-Level Before vs. After)
// ============================================================================

const IGNORED_DIFF_KEYS = new Set([
  'updatedAt',
  'createdAt',
  'updatedDate',
  'createdDate',
  'passwordHash',
  'password',
  'currentPassword',
  'newPassword',
  'secret',
  'apiKey',
  'privateKey',
  'hash',
  'token',
  'refreshToken',
  'accessToken',
  '__v',
]);

function summarizeValue(val: any, keyName: string): any {
  if (val === undefined || val === null || val === '') return '-';
  const lowerKey = keyName.toLowerCase();
  if (
    lowerKey.includes('password') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('token') ||
    lowerKey.includes('apikey') ||
    lowerKey.includes('privatekey')
  ) {
    return '********';
  }
  if (typeof val === 'string') {
    if (val.startsWith('data:image/') || val.length > 500) {
      return `[داده باینری/متن طولانی (${val.length} کاراکتر)]`;
    }
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[] (خالی)';
    if (val.length <= 4 && val.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return val.join('، ');
    }
    return `[لیست شامل ${val.length} مورد]`;
  }
  if (typeof val === 'object') {
    try {
      const str = JSON.stringify(val);
      return str.length > 180 ? str.substring(0, 177) + '...' : str;
    } catch {
      return '[Object]';
    }
  }
  if (typeof val === 'boolean') {
    return val ? 'فعال / بله (true)' : 'غیرفعال / خیر (false)';
  }
  return val;
}

export function computeFieldDiffs(
  oldObj: any,
  newObj: any,
  prefix = '',
  depth = 0
): AuditLogChange[] {
  const changes: AuditLogChange[] = [];
  if (depth > 2) return changes;

  if (!oldObj && newObj && typeof newObj === 'object' && !Array.isArray(newObj)) {
    // Creation snapshot: extract top meaningful fields
    const keys = Object.keys(newObj).filter((k) => !IGNORED_DIFF_KEYS.has(k)).slice(0, 12);
    for (const key of keys) {
      const val = newObj[key];
      if (val === undefined || val === null || val === '') continue;
      const fullKey = prefix ? `${prefix}.${key}` : key;
      changes.push({
        field: fullKey,
        fieldLabel: FIELD_LABELS_FA[key] || fullKey,
        oldValue: '(ایجاد اولیه)',
        newValue: summarizeValue(val, key),
      });
    }
    return changes;
  }

  if (oldObj && typeof oldObj === 'object' && newObj && typeof newObj === 'object') {
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    for (const key of allKeys) {
      if (IGNORED_DIFF_KEYS.has(key)) continue;
      const oldVal = oldObj[key];
      const newVal = newObj[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (oldVal === newVal) continue;
      if (
        oldVal !== null &&
        newVal !== null &&
        typeof oldVal === 'object' &&
        typeof newVal === 'object' &&
        !Array.isArray(oldVal) &&
        !Array.isArray(newVal)
      ) {
        const nested = computeFieldDiffs(oldVal, newVal, fullKey, depth + 1);
        changes.push(...nested);
        continue;
      }

      const oldStr = JSON.stringify(oldVal ?? '');
      const newStr = JSON.stringify(newVal ?? '');
      if (oldStr !== newStr) {
        changes.push({
          field: fullKey,
          fieldLabel: FIELD_LABELS_FA[key] || fullKey,
          oldValue: summarizeValue(oldVal, key),
          newValue: summarizeValue(newVal, key),
        });
      }
    }
  }
  return changes.slice(0, 25);
}

// ============================================================================
// 4. AUTOMATIC CLASSIFICATION & SEVERITY INFERENCE
// ============================================================================

export function classifyAuditEvent(
  actionType: ActionType,
  actionText: string,
  success: boolean,
  changesCount = 0
): { category: AuditCategory; severity: AuditSeverity } {
  if (!success) {
    return { category: 'AUTH_SECURITY', severity: 'HIGH' };
  }

  switch (actionType) {
    case 'DELETE':
    case 'SOFT_DELETE':
      return { category: 'DATA_MUTATION', severity: 'CRITICAL' };
    case 'ACCESS_DENIED':
    case 'PERMISSIONS_CHANGE':
    case 'SETTINGS_CHANGE':
      return { category: 'AUTH_SECURITY', severity: 'HIGH' };
    case 'LOGIN':
    case 'LOGOUT':
    case 'SESSION':
      return { category: 'AUTH_SECURITY', severity: 'MEDIUM' };
    case 'CREATE':
    case 'APPROVE':
    case 'REVIEW':
    case 'REJECT':
    case 'IMPORT':
    case 'UPLOAD':
      return { category: 'DATA_MUTATION', severity: 'MEDIUM' };
    case 'UPDATE':
      return {
        category: 'DATA_MUTATION',
        severity: changesCount > 3 ? 'MEDIUM' : 'LOW',
      };
    case 'FIELD_CHANGE':
      return { category: 'FIELD_CHANGE', severity: 'LOW' };
    case 'EXPORT':
    case 'PRINT':
    case 'CLIPBOARD':
      return { category: 'EXPORT_PRINT', severity: 'MEDIUM' };
    case 'NAVIGATION':
    case 'TAB_SWITCH':
    case 'VIEW':
      return { category: 'NAVIGATION', severity: 'INFO' };
    case 'SEARCH':
    case 'FILTER':
      return { category: 'SEARCH_FILTER', severity: 'INFO' };
    case 'CLICK':
    case 'MODAL_OPEN':
      return { category: 'UI_INTERACTION', severity: 'INFO' };
    default: {
      if (actionText.includes('حذف') || actionText.includes('پاکسازی')) {
        return { category: 'DATA_MUTATION', severity: 'CRITICAL' };
      }
      if (actionText.includes('مجوز') || actionText.includes('دسترسی') || actionText.includes('رمز')) {
        return { category: 'AUTH_SECURITY', severity: 'HIGH' };
      }
      if (actionText.includes('ویرایش') || actionText.includes('ذخیره') || actionText.includes('ثبت')) {
        return { category: 'DATA_MUTATION', severity: 'MEDIUM' };
      }
      return { category: 'SYSTEM', severity: 'LOW' };
    }
  }
}

// ============================================================================
// 5. UNIFIED NORMALIZER (PostgreSQL Rows + Client Memory Entries)
// ============================================================================

export function normalizeAuditLogEntry(raw: any): AuditLogEntry {
  if (!raw || typeof raw !== 'object') {
    const now = new Date();
    return {
      id: `log-${Date.now()}`,
      ts: now.toISOString(),
      tsFa: moment(now).format('jYYYY/jMM/jDD HH:mm:ss'),
      actorType: 'SYSTEM',
      username: 'system',
      ip: '127.0.0.1',
      device: 'Desktop',
      browser: 'Browser',
      actionType: 'OTHER',
      category: 'SYSTEM',
      severity: 'INFO',
      action: 'رخداد سیستمی',
      module: 'سیستم عمومی',
      page: 'نامشخص',
      success: true,
      result: 'موفق',
    };
  }

  const details = raw.details && typeof raw.details === 'object' ? raw.details : {};
  const tsIso = raw.ts || raw.createdAt || details.ts || new Date().toISOString();
  const parsedDate = new Date(tsIso);
  const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const tsFa =
    raw.tsFa ||
    details.tsFa ||
    moment(validDate).format('jYYYY/jMM/jDD HH:mm:ss');

  const username =
    raw.username ||
    details.username ||
    details.user ||
    raw.userUid ||
    (raw.userId ? `user_${raw.userId}` : 'سیستم');

  const fullName = raw.fullName || details.fullName || details.actorName || '';
  const userCode = raw.userCode || raw.personnelCode || details.userCode || details.personnelCode || '';
  const userRole = raw.userRole || details.userRole || details.role || 'کاربر سامانه';

  const rawActionStr = String(raw.action || details.actionSummary || 'عملیات سیستم');
  const upperAction = rawActionStr.toUpperCase();
  const rawActionType: ActionType =
    raw.actionType ||
    details.actionType ||
    (['CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'REVIEW', 'ACCESS_DENIED', 'LOGIN', 'LOGOUT', 'VIEW', 'EXPORT', 'PRINT', 'IMPORT', 'APPROVE', 'REJECT', 'NAVIGATION', 'TAB_SWITCH', 'FIELD_CHANGE', 'CLICK', 'SEARCH', 'FILTER', 'MODAL_OPEN', 'SETTINGS_CHANGE', 'PERMISSIONS_CHANGE', 'UPLOAD'].includes(upperAction)
      ? (upperAction as ActionType)
      : upperAction === 'DELETE_BLOCKED' || upperAction === 'RESTORE_FAILED'
      ? 'REJECT'
      : rawActionStr.includes('حذف')
      ? 'DELETE'
      : rawActionStr.includes('ویرایش') || rawActionStr.includes('بروزرسانی') || rawActionStr.includes('تغییر')
      ? 'UPDATE'
      : rawActionStr.includes('ایجاد') || rawActionStr.includes('ثبت') || rawActionStr.includes('افزودن')
      ? 'CREATE'
      : rawActionStr.includes('تایید') || rawActionStr.includes('تأیید')
      ? 'APPROVE'
      : rawActionStr.includes('بازبینی')
      ? 'REVIEW'
      : rawActionStr.includes('رد') || rawActionStr.includes('غیرمجاز')
      ? 'REJECT'
      : rawActionStr.includes('ورود')
      ? 'LOGIN'
      : rawActionStr.includes('خروج')
      ? 'LOGOUT'
      : rawActionStr.includes('مشاهده') || rawActionStr.includes('ورود به ماژول') || rawActionStr.includes('جابجایی')
      ? 'NAVIGATION'
      : rawActionStr.includes('چاپ') || rawActionStr.includes('پرینت')
      ? 'PRINT'
      : rawActionStr.includes('خروجی') || rawActionStr.includes('دانلود')
      ? 'EXPORT'
      : 'OTHER');

  let changes: AuditLogChange[] = Array.isArray(raw.changes)
    ? raw.changes
    : Array.isArray(details.changes)
    ? details.changes
    : [];

  if (changes.length === 0 && (raw.oldValue || raw.newValue)) {
    changes = computeFieldDiffs(raw.oldValue, raw.newValue);
  }

  const rawResult = String(raw.result || details.result || 'موفق');
  const success =
    typeof raw.success === 'boolean'
      ? raw.success
      : typeof details.success === 'boolean'
      ? details.success
      : rawResult !== 'FAILED' && !rawResult.includes('ناموفق') && !rawResult.includes('خطا');

  const rawModule = raw.module || details.module || raw.entityType || 'سیستم عمومی';
  const moduleKeyNorm = String(rawModule).toLowerCase().trim();
  const moduleFa =
    MODULE_NAMES_FA[moduleKeyNorm] ||
    MODULE_NAMES_FA[moduleKeyNorm.replace(/_/g, '-')] ||
    MODULE_NAMES_FA[String(raw.entityType || '').toLowerCase()] ||
    rawModule;

  const { category, severity } = classifyAuditEvent(rawActionType, rawActionStr, success, changes.length);

  // Build readable action title if DB only stored raw action codes
  let displayAction = details.actionTitle || rawActionStr;
  if (['CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'DELETE_BLOCKED', 'REVIEW', 'APPROVE', 'ACCESS_DENIED', 'SETTINGS_CHANGE'].includes(displayAction)) {
    const verbMap: Record<string, string> = {
      CREATE: 'ایجاد رکورد در',
      UPDATE: 'ویرایش اطلاعات در',
      DELETE: 'حذف رکورد از',
      SOFT_DELETE: 'حذف نرم رکورد در',
      DELETE_BLOCKED: 'جلوگیری از حذف رکورد دارای وابستگی در',
      REVIEW: 'بازبینی مهندسی در',
      APPROVE: 'تأیید نهایی در',
      ACCESS_DENIED: 'تلاش دسترسی غیرمجاز در',
      SETTINGS_CHANGE: 'تغییر تنظیمات در',
    };
    const verb = verbMap[displayAction] || displayAction;
    displayAction = `${verb} ${moduleFa}${raw.entityId ? ` (${raw.entityId})` : ''}`;
  }

  return {
    id: String(raw.id ? (String(raw.id).startsWith('log-') ? raw.id : `db-${raw.id}`) : `log-${validDate.getTime()}`),
    ts: validDate.toISOString(),
    tsFa,
    actorType: (raw.actorType || details.actorType || 'USER') as ActorType,
    userId: String(raw.userId || raw.userUid || details.userId || ''),
    username,
    fullName,
    userCode,
    userRole,
    department: raw.department || details.department || '',
    ip: raw.ip || raw.ipAddress || details.ip || 'Client/Internal',
    device: raw.device || details.device || 'Control Room Desktop',
    browser: formatBrowserSummary(raw.browser || raw.userAgent || details.browser),
    viewport: raw.viewport || details.viewport || '',
    sessionId: raw.sessionId || details.sessionId || '',
    actionType: rawActionType,
    category: raw.category || details.category || category,
    severity: raw.severity || details.severity || severity,
    action: displayAction,
    module: moduleFa,
    page: raw.page || details.page || moduleFa,
    subSection: raw.subSection || details.subSection || '',
    elementTarget: raw.elementTarget || details.elementTarget || '',
    recordType: raw.recordType || raw.entityType || details.recordType || '',
    recordId: raw.recordId || raw.entityId || details.recordId || '',
    httpMethod: raw.httpMethod || details.httpMethod || '',
    endpoint: raw.endpoint || details.endpoint || '',
    statusCode: raw.statusCode || details.statusCode,
    durationMs: raw.durationMs || details.durationMs,
    dwellTimeMs: raw.dwellTimeMs || details.dwellTimeMs,
    fromPath: raw.fromPath || details.fromPath,
    toPath: raw.toPath || details.toPath,
    changes,
    oldValue: raw.oldValue ?? details.oldValue,
    newValue: raw.newValue ?? details.newValue,
    reason: raw.reason || details.reason || details.notes || details.reviewNotes || '',
    description: raw.description || details.description || details.reason || '',
    metadata: details,
    success,
    result: success ? (rawResult === 'SUCCESS' ? 'موفق' : rawResult) : (rawResult === 'FAILED' ? 'ناموفق' : rawResult),
    errorMessage: raw.errorMessage || details.errorMessage || '',
    transactionId: raw.transactionId || details.transactionId || '',
    hash: raw.hash || details.hash || '',
  };
}

export function mergeAndDeduplicateAuditLogs(
  dbRows: any[],
  memoryRows: AuditLogEntry[]
): AuditLogEntry[] {
  const normalizedDb = (Array.isArray(dbRows) ? dbRows : []).map(normalizeAuditLogEntry);
  const normalizedMem = (Array.isArray(memoryRows) ? memoryRows : []).map(normalizeAuditLogEntry);

  const combined = [...normalizedMem, ...normalizedDb];
  const seenSignatures = new Set<string>();
  const unique: AuditLogEntry[] = [];

  for (const item of combined) {
    // Signature based on hash or 2-second timestamp bucket + username + action + recordId
    const timeBucket = Math.floor(new Date(item.ts).getTime() / 2000);
    const sig = item.hash
      ? `hash:${item.hash}`
      : `${timeBucket}:${item.username}:${item.actionType}:${item.action}:${item.recordId || ''}`;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      unique.push(item);
    }
  }

  return unique.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

// ============================================================================
// 6. GLOBAL MICRO-ACTIVITY & INTERACTION OBSERVER (Single Instance)
// ============================================================================

let isObserverInitialized = false;
let lastModulePath = '';
let lastModuleEnteredAt = Date.now();
let lastRecordedInteractionSig = '';
let lastRecordedInteractionTime = 0;

// WeakMap to store initial field values on focus for accurate before/after diffing
const fieldInitialValues = new WeakMap<Element, string>();
const searchDebounceTimers = new WeakMap<Element, any>();

function getElementReadableLabel(el: HTMLElement): string {
  // 1. Explicit aria-label or title or data-audit-label
  const explicit =
    el.getAttribute('data-audit-label') ||
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.getAttribute('placeholder');
  if (explicit && explicit.trim()) return explicit.trim().substring(0, 70);

  // 2. Associated <label for="..."> or parent <label>
  const id = el.getAttribute('id');
  if (id && typeof document !== 'undefined') {
    const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (labelEl && labelEl.textContent?.trim()) {
      return labelEl.textContent.trim().replace(/[:*]/g, '').substring(0, 70);
    }
  }
  const parentLabel = el.closest('label');
  if (parentLabel && parentLabel.textContent?.trim()) {
    return parentLabel.textContent.trim().replace(/[:*]/g, '').substring(0, 70);
  }

  // 3. Preceding sibling label or parent container's label
  const parentContainer = el.parentElement;
  if (parentContainer) {
    const siblingLabel = parentContainer.querySelector('label, span.font-bold, div.text-xs');
    if (siblingLabel && siblingLabel !== el && siblingLabel.textContent?.trim()) {
      return siblingLabel.textContent.trim().replace(/[:*]/g, '').substring(0, 70);
    }
  }

  // 4. Inner text for buttons/tabs
  const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text) return text.substring(0, 70);

  // 5. Name attribute mapped via FIELD_LABELS_FA
  const nameAttr = el.getAttribute('name') || '';
  if (nameAttr && FIELD_LABELS_FA[nameAttr]) return FIELD_LABELS_FA[nameAttr];

  return nameAttr || id || el.tagName.toLowerCase();
}

function getElementValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'password') return '********';
    if (el.type === 'checkbox' || el.type === 'radio') {
      return el.checked ? 'انتخاب‌شده (فعال)' : 'عدم انتخاب (غیرفعال)';
    }
    if (el.type === 'file') {
      const files = el.files ? Array.from(el.files).map((f) => f.name).join(', ') : '';
      return files || '(فایل انتخاب شد)';
    }
  }
  if (el instanceof HTMLSelectElement) {
    const selectedOpt = el.options[el.selectedIndex];
    return selectedOpt ? `${selectedOpt.text} (${el.value})` : el.value;
  }
  return (el.value || '').trim();
}

export function initGlobalAuditObserver(
  getUserFn: () => UserProfile | null,
  recordAuditFn: (username: string, action: string, result: string, options: any) => void
): void {
  if (typeof window === 'undefined' || isObserverInitialized) return;
  isObserverInitialized = true;

  const initialMod = resolveCurrentModuleInfo();
  lastModulePath = initialMod.hashPath;
  lastModuleEnteredAt = Date.now();

  const dispatchUserEvent = (
    actionType: ActionType,
    actionTitle: string,
    extraOptions: Record<string, any> = {}
  ) => {
    const user = getUserFn();
    if (!user) return;

    // Deduplicate rapid identical events within 600ms
    const now = Date.now();
    const sig = `${actionType}:${actionTitle}:${JSON.stringify(extraOptions.changes || '')}`;
    if (sig === lastRecordedInteractionSig && now - lastRecordedInteractionTime < 600) {
      return;
    }
    lastRecordedInteractionSig = sig;
    lastRecordedInteractionTime = now;

    const modInfo = resolveCurrentModuleInfo();
    recordAuditFn(user.username, actionTitle, 'موفق', {
      actorType: 'USER',
      userId: user.uid || user.id,
      fullName: user.fullName,
      userCode: user.personnelNumber,
      userRole: user.role,
      department: Array.isArray(user.departmentIds) ? user.departmentIds[0] : '',
      sessionId: getActiveSessionId(),
      actionType,
      module: extraOptions.module || modInfo.moduleFa,
      page: extraOptions.page || modInfo.hashPath,
      ...extraOptions,
    });
  };

  // 1. Track Module & Hash Navigation + Dwell Time
  const handleNavigation = () => {
    const modInfo = resolveCurrentModuleInfo();
    if (modInfo.hashPath === lastModulePath) return;

    const now = Date.now();
    const dwellTimeMs = Math.max(0, now - lastModuleEnteredAt);
    const prevKey = lastModulePath.replace(/^#\/?/, '').split('?')[0].split('/')[0] || 'dashboard';
    const prevModuleFa = MODULE_NAMES_FA[prevKey] || prevKey;

    const fromPath = lastModulePath;
    const toPath = modInfo.hashPath;
    lastModulePath = toPath;
    lastModuleEnteredAt = now;

    dispatchUserEvent(
      'NAVIGATION',
      `جابجایی به ماژول «${modInfo.moduleFa}» (از «${prevModuleFa}»)`,
      {
        module: modInfo.moduleFa,
        page: toPath,
        fromPath,
        toPath,
        dwellTimeMs,
        description: `کاربر پس از ${Math.round(dwellTimeMs / 1000)} ثانیه حضور در بخش «${prevModuleFa}» وارد ماژول «${modInfo.moduleFa}» شد.`,
        changes: [
          {
            field: 'activeModule',
            fieldLabel: 'ماژول فعال کاربر',
            oldValue: `${prevModuleFa} (${fromPath})`,
            newValue: `${modInfo.moduleFa} (${toPath})`,
          },
        ],
      }
    );
  };

  window.addEventListener('hashchange', handleNavigation);
  window.addEventListener('popstate', handleNavigation);

  // 2. Track Custom Sub-Tab Navigation Event
  window.addEventListener('hse-navigate-subtab', (e: any) => {
    const tab = e?.detail?.tab || '';
    const subItem = e?.detail?.subItem || '';
    const subLabel = SYSTEM_SUBTABS_FA[subItem] || subItem;
    const modFa = MODULE_NAMES_FA[tab] || 'تنظیمات سیستم';
    dispatchUserEvent('TAB_SWITCH', `ورود به زیربخش «${subLabel}» در ${modFa}`, {
      module: modFa,
      subSection: subLabel,
      changes: [
        {
          field: 'subTab',
          fieldLabel: 'تب / زیربخش فعال',
          oldValue: '-',
          newValue: subLabel,
        },
      ],
    });
  });

  // 3. Track Field Focus to Capture Before-Value
  document.addEventListener(
    'focusin',
    (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('[data-audit-ignore="true"]')) return;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        fieldInitialValues.set(target, getElementValue(target));
      }
    },
    true
  );

  // 4. Track Every Input / Select / Textarea Change (Before -> After)
  document.addEventListener(
    'change',
    (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('[data-audit-ignore="true"]')) return;
      if (
        !(
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement
        )
      ) {
        return;
      }

      const oldVal = fieldInitialValues.get(target) ?? '-';
      const newVal = getElementValue(target);
      if (oldVal === newVal) return;

      fieldInitialValues.set(target, newVal);
      const label = getElementReadableLabel(target);
      const isSearchOrFilter =
        (target instanceof HTMLInputElement &&
          (target.type === 'search' ||
            label.includes('جستجو') ||
            label.toLowerCase().includes('search'))) ||
        (target instanceof HTMLSelectElement &&
          (label.includes('همه') || label.includes('فیلتر')));

      const actionType: ActionType = isSearchOrFilter
        ? target instanceof HTMLSelectElement
          ? 'FILTER'
          : 'SEARCH'
        : 'FIELD_CHANGE';

      const actionDesc = isSearchOrFilter
        ? `اعمال فیلتر / جستجو در «${label}»: ${newVal || '(پاک شد)'}`
        : `تغییر مقدار فیلد «${label}»`;

      dispatchUserEvent(actionType, actionDesc, {
        elementTarget: `${target.tagName.toLowerCase()}[${label}]`,
        changes: [
          {
            field: target.getAttribute('name') || target.getAttribute('id') || label,
            fieldLabel: label,
            oldValue: oldVal || '(خالی)',
            newValue: newVal || '(خالی)',
          },
        ],
        description: `مقدار «${label}» از «${oldVal || 'خالی'}» به «${newVal || 'خالی'}» تغییر یافت.`,
      });
    },
    true
  );

  // 5. Track Search Inputs with Debounce (when user types in search boxes without blurring)
  document.addEventListener(
    'input',
    (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || !(target instanceof HTMLInputElement)) return;
      if (target.closest('[data-audit-ignore="true"]')) return;

      const label = getElementReadableLabel(target);
      const isSearch =
        target.type === 'search' ||
        label.includes('جستجو') ||
        label.toLowerCase().includes('search');
      if (!isSearch) return;

      const prevTimer = searchDebounceTimers.get(target);
      if (prevTimer) clearTimeout(prevTimer);

      const timer = setTimeout(() => {
        const val = target.value.trim();
        if (!val) return;
        dispatchUserEvent('SEARCH', `جستجوی عبارت «${val}» در ${label}`, {
          elementTarget: label,
          changes: [
            {
              field: 'searchQuery',
              fieldLabel: label,
              oldValue: '-',
              newValue: val,
            },
          ],
        });
      }, 1200);

      searchDebounceTimers.set(target, timer);
    },
    true
  );

  // 6. Track Interactive Clicks (Buttons, Sub-tabs, Modals, Print, Export, Toggles)
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const rawTarget = e.target as HTMLElement | null;
      if (!rawTarget || rawTarget.closest('[data-audit-ignore="true"]')) return;

      const clickable = rawTarget.closest(
        'button, a, [role="tab"], [role="button"], [role="menuitem"], summary'
      ) as HTMLElement | null;
      if (!clickable || clickable.closest('[data-audit-ignore="true"]')) return;

      const label = getElementReadableLabel(clickable);
      if (!label || label.length < 2) return;

      // Avoid double-logging main sidebar module clicks that immediately trigger hashchange
      if (clickable.closest('aside') && clickable.tagName === 'BUTTON') {
        // Still log sidebar group expansions or specific actions
        const isGroupToggle = clickable.getAttribute('aria-expanded') !== null;
        if (!isGroupToggle) return;
      }

      const lower = label.toLowerCase();
      let actionType: ActionType = 'CLICK';
      let actionPrefix = 'کلیک روی دکمه / گزینه';

      if (lower.includes('چاپ') || lower.includes('پرینت') || lower.includes('print') || lower.includes('pdf')) {
        actionType = 'PRINT';
        actionPrefix = 'درخواست چاپ / خروجی سند';
      } else if (
        lower.includes('اکسل') ||
        lower.includes('excel') ||
        lower.includes('csv') ||
        lower.includes('خروجی') ||
        lower.includes('دانلود') ||
        lower.includes('پشتیبان') ||
        lower.includes('export')
      ) {
        actionType = 'EXPORT';
        actionPrefix = 'دریافت خروجی / دانلود اطلاعات';
      } else if (
        lower.includes('جدید') ||
        lower.includes('افزودن') ||
        lower.includes('ایجاد') ||
        lower.includes('مشاهده') ||
        lower.includes('جزئیات') ||
        lower.includes('ویرایش')
      ) {
        actionType = 'MODAL_OPEN';
        actionPrefix = 'باز کردن فرم / پنجره عملیاتی';
      } else if (
        clickable.getAttribute('role') === 'tab' ||
        clickable.parentElement?.className?.includes('rounded-xl')
      ) {
        actionType = 'TAB_SWITCH';
        actionPrefix = 'تغییر تب / بخش داخلی';
      }

      dispatchUserEvent(actionType, `${actionPrefix}: «${label}»`, {
        elementTarget: `${clickable.tagName.toLowerCase()}: ${label}`,
      });
    },
    true
  );

  // 7. Track Print & Clipboard Events
  window.addEventListener('beforeprint', () => {
    dispatchUserEvent('PRINT', 'باز شدن پنجره چاپ مرورگر (System Print)', {});
  });

  document.addEventListener('copy', () => {
    const selected = window.getSelection()?.toString()?.trim();
    if (selected && selected.length > 2) {
      dispatchUserEvent(
        'CLIPBOARD',
        `کپی متن در کلیپ‌بورد (${selected.length} کاراکتر)`,
        {
          description: `متن کپی شده: «${selected.substring(0, 100)}${selected.length > 100 ? '...' : ''}»`,
        }
      );
    }
  });

  // Endpoints whose server-side controllers already persist authoritative audit logs into PostgreSQL
  const SERVER_AUDITED_PREFIXES = [
    '/fire-design',
    '/risk-assessments',
    '/psm',
    '/settings',
    '/organization',
    '/auth',
    '/users',
    '/personnel',
    '/ptw',
    '/incidents',
    '/health-exams',
    '/workflows',
    '/files',
    '/sds',
    '/bpmn',
    '/hse',
    '/backup',
  ];

  // 8. Global API Data Mutation Interceptor (POST / PUT / DELETE / PATCH)
  window.addEventListener('hse_api_mutation_completed', (e: any) => {
    const detail = e?.detail;
    if (!detail) return;
    const { method, url, status, ok, durationMs, requestBody } = detail;
    const cleanUrl = String(url || '');
    if (
      cleanUrl.includes('/audit-logs') ||
      cleanUrl.includes('/audit') ||
      cleanUrl.includes('/auth/me') ||
      cleanUrl.includes('/sync/health') ||
      cleanUrl.includes('/settings/hse_heat_log') ||
      cleanUrl.includes('/weather/cache')
    ) {
      return;
    }

    const normalizedPath = cleanUrl.replace(/^\/api(\/v1)?/, '');
    const isServerAudited = SERVER_AUDITED_PREFIXES.some((prefix) =>
      normalizedPath.startsWith(prefix)
    );

    const { moduleFa, recordType } = resolveModuleFromEndpoint(cleanUrl);
    const upperMethod = String(method || 'POST').toUpperCase();

    let actionType: ActionType = 'UPDATE';
    let verbFa = 'بروزرسانی / ذخیره اطلاعات در';
    if (upperMethod === 'DELETE' || cleanUrl.includes('delete') || cleanUrl.includes('clear')) {
      actionType = 'DELETE';
      verbFa = 'حذف رکورد از';
    } else if (cleanUrl.includes('/login')) {
      actionType = 'LOGIN';
      verbFa = 'احراز هویت و ورود به';
    } else if (cleanUrl.includes('/logout')) {
      actionType = 'LOGOUT';
      verbFa = 'خروج از نشست';
    } else if (cleanUrl.includes('/settings')) {
      actionType = 'SETTINGS_CHANGE';
      verbFa = 'تغییر تنظیمات در';
    } else if (cleanUrl.includes('/personnel-assignments') || cleanUrl.includes('/users')) {
      actionType = 'PERMISSIONS_CHANGE';
      verbFa = 'تغییر کاربری / دسترسی در';
    } else if (upperMethod === 'POST' && !requestBody?.id) {
      actionType = 'CREATE';
      verbFa = 'ثبت / ایجاد اطلاعات در';
    }

    const recordId =
      requestBody?.id ||
      requestBody?.permitNumber ||
      requestBody?.trackingCode ||
      requestBody?.personnelCode ||
      requestBody?.code ||
      cleanUrl.split('?')[0].split('/').pop() ||
      '';

    const changes =
      requestBody && typeof requestBody === 'object'
        ? computeFieldDiffs(null, requestBody)
        : [];

    const user = getUserFn();
    const modInfo = resolveCurrentModuleInfo();
    recordAuditFn(
      user?.username || requestBody?.username || 'کاربر سامانه',
      `${verbFa} «${moduleFa}»${recordId && recordId !== cleanUrl.split('/').pop() ? ` [${recordId}]` : ''}`,
      ok ? 'موفق' : `ناموفق (کد ${status})`,
      {
        actorType: 'USER',
        userId: user?.uid || user?.id,
        fullName: user?.fullName,
        userCode: user?.personnelNumber,
        userRole: user?.role,
        sessionId: getActiveSessionId(),
        actionType,
        module: moduleFa,
        page: modInfo.hashPath,
        recordType,
        recordId: String(recordId || ''),
        httpMethod: upperMethod,
        endpoint: cleanUrl,
        statusCode: status,
        durationMs,
        changes,
        success: !!ok,
        skipRemotePersist: Boolean(ok && isServerAudited),
        description: `درخواست ${upperMethod} به مسیر ${cleanUrl} در مدت ${durationMs || 0} میلی‌ثانیه با کد وضعیت ${status} انجام شد.`,
      }
    );
  });
}
