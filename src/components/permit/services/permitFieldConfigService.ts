import { apiDb } from '../../../services/apiDatabaseClient';

export type PermitFieldType = 
  | 'text' 
  | 'number' 
  | 'textarea' 
  | 'select' 
  | 'checkbox' 
  | 'date' 
  | 'time';

export type PermitFieldScope = 'Hot' | 'Cold' | 'Both';

export type PermitFieldSection = 
  | 'general' 
  | 'environmental' 
  | 'precautions' 
  | 'equipment' 
  | 'custom';

export interface PermitCustomField {
  id: string;
  key: string;
  labelFa: string;
  labelEn?: string;
  type: PermitFieldType;
  scope: PermitFieldScope; // 'Hot', 'Cold', 'Both'
  section: PermitFieldSection;
  sectionTitleFa?: string;
  required: boolean;
  isActive: boolean;
  order: number;
  options?: string[]; // for 'select' type
  placeholder?: string;
  defaultValue?: any;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const PERMIT_FIELD_SECTIONS: { id: PermitFieldSection; titleFa: string; titleEn: string }[] = [
  { id: 'general', titleFa: 'اطلاعات عمومی و سازمانی', titleEn: 'General & Organizational' },
  { id: 'environmental', titleFa: 'شرایط محیطی، آب‌وهوا و مکانی', titleEn: 'Environmental & Site Conditions' },
  { id: 'precautions', titleFa: 'اقدامات کنترلی، احتیاطی و ایمنی', titleEn: 'Safety Precautions & Controls' },
  { id: 'equipment', titleFa: 'تجهیزات، ابزارآلات و ماشین‌آلات', titleEn: 'Equipment & Machinery' },
  { id: 'custom', titleFa: 'فیلدها و الزامات تکمیلی اختصاصی', titleEn: 'Supplementary Custom Requirements' }
];

export const DEFAULT_PERMIT_FIELDS: PermitCustomField[] = [
  // 1. Shared (Both)
  {
    id: 'f-contractor',
    key: 'contractorCompany',
    labelFa: 'شرکت پیمانکار / مجری فرعی',
    labelEn: 'Contractor Company',
    type: 'text',
    scope: 'Both',
    section: 'general',
    sectionTitleFa: 'اطلاعات عمومی و سازمانی',
    required: false,
    isActive: true,
    order: 1,
    placeholder: 'نام شرکت یا اکیپ پیمانکاری...',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-ambient-temp',
    key: 'ambientTemperature',
    labelFa: 'دمای محیط (°C)',
    labelEn: 'Ambient Temperature',
    type: 'number',
    scope: 'Both',
    section: 'environmental',
    sectionTitleFa: 'شرایط محیطی، آب‌وهوا و مکانی',
    required: false,
    isActive: true,
    order: 2,
    placeholder: 'مثلاً: ۳۴',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-wind-cond',
    key: 'windCondition',
    labelFa: 'سرعت و جهت وزش باد',
    labelEn: 'Wind Speed & Direction',
    type: 'text',
    scope: 'Both',
    section: 'environmental',
    sectionTitleFa: 'شرایط محیطی، آب‌وهوا و مکانی',
    required: false,
    isActive: true,
    order: 3,
    placeholder: 'مثلاً: آرام / ملایم ۵ نات شمال غربی',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-loto-tag',
    key: 'lotoLockTag',
    labelFa: 'شماره قفل و تگ LOTO',
    labelEn: 'LOTO Lock & Tag Number',
    type: 'text',
    scope: 'Both',
    section: 'precautions',
    sectionTitleFa: 'اقدامات کنترلی، احتیاطی و ایمنی',
    required: false,
    isActive: true,
    order: 4,
    placeholder: 'شماره تگ و جعبه قفل قفل‌گذاری...',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },

  // 2. Hot Work specific
  {
    id: 'f-fire-extinguisher',
    key: 'fireExtinguisherType',
    labelFa: 'نوع و تعداد کپسول اطفای حریق مستقر',
    labelEn: 'Fire Extinguisher Stationed',
    type: 'select',
    scope: 'Hot',
    section: 'precautions',
    sectionTitleFa: 'اقدامات کنترلی، احتیاطی و ایمنی',
    required: true,
    isActive: true,
    order: 5,
    options: [
      'کپسول پودر و گاز ۱۲ کیلوگرمی (۱ عدد)',
      'کپسول پودر و گاز ۱۲ کیلوگرمی (۲ عدد)',
      'کپسول گاز دی‌اکسید کربن CO2 ۶ کیلوگرمی',
      'کپسول چرخدار ۵۰ کیلوگرمی پودر',
      'کپسول آب و گاز و فوم مکانیکی',
      'استقرار هوزریل آب آتش‌نشانی تحت فشار'
    ],
    defaultValue: 'کپسول پودر و گاز ۱۲ کیلوگرمی (۱ عدد)',
    placeholder: 'انتخاب کپسول آتش‌نشانی...',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-fire-watch',
    key: 'fireWatchOfficer',
    labelFa: 'نام دیده‌بان آتش (Fire Watch)',
    labelEn: 'Designated Fire Watch Person',
    type: 'text',
    scope: 'Hot',
    section: 'precautions',
    sectionTitleFa: 'اقدامات کنترلی، احتیاطی و ایمنی',
    required: true,
    isActive: true,
    order: 6,
    placeholder: 'نام و کد پرسنلی نگهبان آتش...',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-flashback-arrestor',
    key: 'flashbackArrestorStatus',
    labelFa: 'وضعیت فلش‌بک ارستر شیلنگ و تورچ هوا برش',
    labelEn: 'Flashback Arrestor Inspection',
    type: 'select',
    scope: 'Hot',
    section: 'equipment',
    sectionTitleFa: 'تجهیزات، ابزارآلات و ماشین‌آلات',
    required: false,
    isActive: true,
    order: 7,
    options: [
      'تایید و متصل روی کپسول و تورچ (سالم)',
      'فاقد تجهیزات جوش و برش با گاز استیلن/اکسیژن',
      'نیاز به بازرسی و اصلاح دارد'
    ],
    defaultValue: 'تایید و متصل روی کپسول و تورچ (سالم)',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-spark-blanket',
    key: 'sparkBlanketCover',
    labelFa: 'مهار جرقه‌ها (پتوی نسوز و عایق جرقه‌گیر)',
    labelEn: 'Fire Blanket / Spark Containment',
    type: 'checkbox',
    scope: 'Hot',
    section: 'precautions',
    sectionTitleFa: 'اقدامات کنترلی، احتیاطی و ایمنی',
    required: false,
    isActive: true,
    order: 8,
    defaultValue: true,
    description: 'پوشش کامل منهول‌ها، کانال‌ها و منافذ با پتوی نسوز خیس‌شده یا ورق فلزی',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },

  // 3. Cold Work specific
  {
    id: 'f-zero-energy',
    key: 'zeroEnergyStatus',
    labelFa: 'تایید تخلیه انرژی پسماند (Zero Energy State)',
    labelEn: 'Zero Energy Verified',
    type: 'select',
    scope: 'Cold',
    section: 'precautions',
    sectionTitleFa: 'اقدامات کنترلی، احتیاطی و ایمنی',
    required: false,
    isActive: true,
    order: 9,
    options: [
      'انرژی هیدرولیکی/پنوماتیکی کاملاً تخلیه گردید',
      'سیستم بدون فشار و در حالت ایمن است',
      'عدم نیاز به تخلیه انرژی پسماند'
    ],
    defaultValue: 'سیستم بدون فشار و در حالت ایمن است',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-scaffold-tag',
    key: 'scaffoldTagStatus',
    labelFa: 'وضعیت برچسب و تایید داربست (Scaffold Green Tag)',
    labelEn: 'Scaffolding Safety Tag',
    type: 'select',
    scope: 'Cold',
    section: 'precautions',
    sectionTitleFa: 'اقدامات کنترلی، احتیاطی و ایمنی',
    required: false,
    isActive: true,
    order: 10,
    options: [
      'دارای تگ سبز معتبر بازرسی',
      'فاقد کار در ارتفاع و نیازمند داربست نیست',
      'تگ زرد (در دست تکمیل)',
      'تگ قرمز (غیرقابل استفاده)'
    ],
    defaultValue: 'فاقد کار در ارتفاع و نیازمند داربست نیست',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  },
  {
    id: 'f-drain-wash',
    key: 'drainWashStatus',
    labelFa: 'شستشو، درین و ونت خطوط مکانیکی',
    labelEn: 'Drain, Vent & Flushing Status',
    type: 'textarea',
    scope: 'Cold',
    section: 'precautions',
    sectionTitleFa: 'اقدامات کنترلی، احتیاطی و ایمنی',
    required: false,
    isActive: true,
    order: 11,
    placeholder: 'توضیحات درین و تخلیه سیالات یا گازهای محبوس...',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01'
  }
];

const SETTING_KEY = 'ptw_custom_fields_v2';
const EVENT_NAME = 'ptw_fields_updated';

let cachedFields: PermitCustomField[] = [...DEFAULT_PERMIT_FIELDS];
let isLoaded = false;

/**
 * Fetch permit field configs from database system_settings
 */
export async function fetchPermitFieldConfigs(forceRefresh = false): Promise<PermitCustomField[]> {
  if (isLoaded && !forceRefresh) {
    return cachedFields;
  }

  try {
    const remote = await apiDb.getSetting(SETTING_KEY);
    if (Array.isArray(remote) && remote.length > 0) {
      cachedFields = remote;
      isLoaded = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: cachedFields }));
      }
      return cachedFields;
    }
  } catch (err) {
    console.warn('[PermitFieldService] Failed to load custom fields from DB, using fallback:', err);
  }

  // If DB was empty, save initial defaults to DB so they become permanent
  try {
    await apiDb.saveSetting(SETTING_KEY, DEFAULT_PERMIT_FIELDS, 'Work Permit Dynamic Field Configs');
  } catch {}

  cachedFields = [...DEFAULT_PERMIT_FIELDS];
  isLoaded = true;
  return cachedFields;
}

/**
 * Synchronous get for active in-memory cached fields
 */
export function getPermitFieldConfigsSync(scope?: PermitFieldScope): PermitCustomField[] {
  let list = cachedFields;
  if (!scope || scope === 'Both') {
    return list;
  }
  return list.filter(f => f.scope === 'Both' || f.scope === scope);
}

/**
 * Saves entire field configs array to database
 */
export async function savePermitFieldConfigs(fields: PermitCustomField[]): Promise<PermitCustomField[]> {
  // Normalize orders
  const normalized = fields.map((f, idx) => ({
    ...f,
    order: idx + 1,
    updatedAt: new Date().toISOString()
  }));

  cachedFields = normalized;
  isLoaded = true;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
  }

  try {
    await apiDb.saveSetting(SETTING_KEY, normalized, 'Work Permit Dynamic Field Configs');
  } catch (err) {
    console.error('[PermitFieldService] Failed to save custom fields to database:', err);
  }

  return normalized;
}

/**
 * Adds a new custom field and persists to database
 */
export async function addPermitField(
  fieldData: Omit<PermitCustomField, 'id' | 'order' | 'createdAt' | 'updatedAt'>
): Promise<PermitCustomField> {
  const current = await fetchPermitFieldConfigs();
  const id = `f-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newField: PermitCustomField = {
    ...fieldData,
    id,
    order: current.length + 1,
    createdAt: now,
    updatedAt: now
  };

  const updated = [...current, newField];
  await savePermitFieldConfigs(updated);
  return newField;
}

/**
 * Updates an existing custom field and persists to database
 */
export async function updatePermitField(
  id: string, 
  updates: Partial<PermitCustomField>
): Promise<PermitCustomField> {
  const current = await fetchPermitFieldConfigs();
  const index = current.findIndex(f => f.id === id);
  if (index === -1) {
    throw new Error(`Field with id ${id} not found`);
  }

  const updatedItem: PermitCustomField = {
    ...current[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  const updatedList = [...current];
  updatedList[index] = updatedItem;
  await savePermitFieldConfigs(updatedList);
  return updatedItem;
}

/**
 * Deletes or deactivates a custom field safely without losing historical data
 */
export async function deletePermitField(id: string, hardDelete = false): Promise<boolean> {
  const current = await fetchPermitFieldConfigs();
  if (hardDelete) {
    const filtered = current.filter(f => f.id !== id);
    await savePermitFieldConfigs(filtered);
  } else {
    // Soft delete: mark inactive
    const updated = current.map(f => f.id === id ? { ...f, isActive: false, updatedAt: new Date().toISOString() } : f);
    await savePermitFieldConfigs(updated);
  }
  return true;
}

/**
 * Reorders custom fields
 */
export async function reorderPermitFields(fields: PermitCustomField[]): Promise<PermitCustomField[]> {
  return await savePermitFieldConfigs(fields);
}

/**
 * Resets back to defaults
 */
export async function resetToDefaultFields(): Promise<PermitCustomField[]> {
  const resetList = DEFAULT_PERMIT_FIELDS.map((f, i) => ({
    ...f,
    order: i + 1,
    updatedAt: new Date().toISOString()
  }));
  return await savePermitFieldConfigs(resetList);
}

// Kick off initial fetch on module load
if (typeof window !== 'undefined') {
  fetchPermitFieldConfigs().catch(() => {});
  
  // Real-time synchronization on socket mutations
  window.addEventListener('app_data_mutated', (e: any) => {
    const detail = e.detail;
    if (detail?.source === 'settings' || detail?.data?.key === SETTING_KEY) {
      fetchPermitFieldConfigs(true).catch(() => {});
    }
  });
}
