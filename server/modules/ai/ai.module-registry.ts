import { db, schema } from '../../core/db.ts';
import { inArray } from 'drizzle-orm';
import { checkUserHasPermission, isGlobalAdminUser, type UserContext } from '../../core/middleware/auth.ts';
import {
  HSECORE_SYSTEM_MODULES,
  HSECORE_HEALTH_ENV_OVERVIEW,
  HSECORE_DOCUMENTS_SUBITEMS,
  HSECORE_HEALTH_ENV_SUBITEMS,
  HSECORE_FIRE_DEPT_SUBITEMS,
  HSECORE_SAFETY_DEPT_SUBITEMS,
} from '../../../shared/hsecore-module-catalog.ts';

export interface AIModuleCatalogItem {
  moduleId: string;
  moduleNameFa: string;
  titleEn: string;
  parentId?: string;
  connected: boolean;
  allowed: boolean;
  tools: string[];
  assistantIds: string[];
  notes?: string;
  enabled: boolean;
  children?: AIModuleCatalogItem[];
}

interface ModuleDefinition {
  id: string;
  titleFa: string;
  titleEn: string;
  tools?: string[];
  permission?: string;
  adminOnly?: boolean;
  rag?: boolean;
  enabled?: boolean;
  explicitPermission?: boolean;
  notes?: string;
}

const TOOL_ACCESS: Record<string, { permission?: string; adminOnly?: boolean; explicitPermission?: boolean }> = {
  heat_weather_summary: {},
  ptw_summary: { permission: 'ptw:read' },
  ptw_audit_summary: { permission: 'audit:read' },
  incidents_summary: { permission: 'incidents:read' },
  health_medical_summary: { permission: 'health:read', adminOnly: true, explicitPermission: true },
  nutrition_high_risk_summary: { permission: 'health:read', adminOnly: true, explicitPermission: true },
  risk_assessment_summary: { permission: 'risks:read' },
  five_s_inspections_summary: { permission: 'five_s:read' },
  fire_safety_summary: { permission: 'fire:read' },
  warnings_anomalies_summary: { permission: 'warnings:read' },
  training_summary: { permission: 'training:read' },
  ppe_summary: { permission: 'ppe:read' },
  environment_summary: { permission: 'environment:read' },
  personnel_org_summary: { permission: 'personnel:read', adminOnly: true },
  workflow_referrals_summary: { permission: 'workflows:read' },
  kpi_management_summary: { permission: 'reports:read' },
  non_conformances_summary: { permission: 'audit:read' },
  notifications_summary: { permission: 'notifications:read' },
  users_roles_summary: { adminOnly: true },
  settings_backup_summary: { adminOnly: true },
  system_architecture_summary: { adminOnly: true },
};

const MODULE_ADAPTERS: Record<string, Partial<ModuleDefinition>> = {
  dashboard: { tools: ['kpi_management_summary'], permission: 'reports:read' },
  heat: { tools: ['heat_weather_summary'] },
  'hse-ms': { tools: ['kpi_management_summary'], permission: 'reports:read' },
  reports: { tools: ['kpi_management_summary'], permission: 'reports:read' },
  'safety-unit': { tools: ['five_s_inspections_summary', 'non_conformances_summary'] },
  'fire-dept': { tools: ['fire_safety_summary'], permission: 'fire:read' },
  'health-env': { tools: ['health_medical_summary', 'nutrition_high_risk_summary', 'environment_summary'] },
  permit: { tools: ['ptw_summary'], permission: 'ptw:read' },
  'ptw-audit': { tools: ['ptw_audit_summary'], permission: 'audit:read' },
  risk: { tools: ['risk_assessment_summary'], permission: 'risks:read' },
  ppe: { tools: ['ppe_summary'], permission: 'ppe:read' },
  incidents: { tools: ['incidents_summary'], permission: 'incidents:read' },
  warnings: { tools: ['warnings_anomalies_summary'], permission: 'warnings:read' },
  'personnel-history': { tools: ['personnel_org_summary'], permission: 'personnel:read', adminOnly: true },
  training: { tools: ['training_summary'], permission: 'training:read' },
  documents: { rag: true },
  'pending-documents': { tools: ['workflow_referrals_summary'], permission: 'workflows:read' },
  'non-conformances': { tools: ['non_conformances_summary'], permission: 'audit:read' },
  'process-management': { tools: ['workflow_referrals_summary'], permission: 'workflows:read' },
  notifications: { tools: ['notifications_summary'], permission: 'notifications:read' },
  'user-mgmt': { tools: ['users_roles_summary'], adminOnly: true },
  system: { tools: ['settings_backup_summary', 'system_architecture_summary'], adminOnly: true },
};

const DEFAULT_MODULES: ModuleDefinition[] = HSECORE_SYSTEM_MODULES.map(module => ({
  id: module.key,
  titleFa: module.titleFa,
  titleEn: module.titleEn,
  enabled: module.enabled,
  ...(MODULE_ADAPTERS[module.key] || {}),
}));

const HEALTH_CHILD_ADAPTERS: Record<string, Partial<ModuleDefinition>> = {
  clinic: { permission: 'health:read', adminOnly: true, explicitPermission: true },
  'periodic-exams': { tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
  'non-periodic-exams': { tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
  nutrition: { tools: ['nutrition_high_risk_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
  'health-env-checklists': { permission: 'health:read', adminOnly: true, explicitPermission: true },
  'env-dashboard': { tools: ['environment_summary'], permission: 'environment:read' },
  'env-monitoring': { tools: ['environment_summary'], permission: 'environment:read' },
  'waste-management': { tools: ['environment_summary'], permission: 'environment:read' },
  wastewater: { tools: ['environment_summary'], permission: 'environment:read' },
  'air-water-soil': { tools: ['environment_summary'], permission: 'environment:read' },
  'five-s': { tools: ['five_s_inspections_summary'], permission: 'five_s:read' },
  'env-reports': { tools: ['environment_summary'], permission: 'environment:read' },
};

const FIRE_CHILD_ADAPTERS: Record<string, Partial<ModuleDefinition>> = {
  dashboard: { tools: ['fire_safety_summary'], permission: 'fire:read' },
  vehicles: {
    tools: ['fire_safety_summary'],
    notes: 'منبع فعلی فقط تعداد خودروهای ثبت‌شده را گزارش می‌کند؛ جزئیات بازرسی و تعمیرات متصل نیست.',
  },
  'Fire Extinguisher Capsol': { tools: ['fire_safety_summary'] },
  'Hydrants & Monitors': { tools: ['fire_safety_summary'] },
  'Foam Pakages': { tools: ['fire_safety_summary'] },
};

const DEFAULT_CHILDREN: Record<string, ModuleDefinition[]> = {
  risk: [
    { id: 'overview', titleFa: 'داشبورد جامع ارزیابی ریسک', titleEn: 'Risk Assessment Dashboard', tools: ['risk_assessment_summary'], permission: 'risks:read' },
    { id: 'JSA', titleFa: 'تحلیل ایمنی شغلی (JSA)', titleEn: 'Job Safety Analysis', tools: ['risk_assessment_summary'], permission: 'risks:read' },
    { id: 'FMEA', titleFa: 'تحلیل حالات خرابی و آثار آن (FMEA)', titleEn: 'Failure Mode and Effects Analysis', tools: ['risk_assessment_summary'], permission: 'risks:read' },
    { id: 'FTA', titleFa: 'تحلیل درخت خطا (FTA)', titleEn: 'Fault Tree Analysis', tools: ['risk_assessment_summary'], permission: 'risks:read' },
    { id: 'HHA', titleFa: 'تحلیل خطرات بهداشتی (HHA)', titleEn: 'Health Hazard Analysis', tools: ['risk_assessment_summary'], permission: 'risks:read' },
  ],
  permit: [
    { id: 'hot-work', titleFa: 'پروانه کار گرم', titleEn: 'Hot Work Permit', tools: ['ptw_summary'] },
    { id: 'cold-work', titleFa: 'پروانه کار سرد', titleEn: 'Cold Work Permit', tools: ['ptw_summary'] },
    { id: 'confined-space', titleFa: 'پروانه فضای بسته', titleEn: 'Confined Space Permit', tools: ['ptw_summary'] },
    { id: 'work-at-height', titleFa: 'پروانه کار در ارتفاع', titleEn: 'Work at Height Permit', tools: ['ptw_summary'] },
    { id: 'excavation', titleFa: 'پروانه حفاری و گودبرداری', titleEn: 'Excavation Permit', tools: ['ptw_summary'] },
    { id: 'electrical', titleFa: 'پروانه برق و ایزولاسیون', titleEn: 'Electrical Isolation Permit', tools: ['ptw_summary'] },
  ],
  'ptw-audit': [
    { id: 'dashboard', titleFa: 'داشبورد ممیزی پروانه کار', titleEn: 'PTW Audit Dashboard', tools: ['ptw_audit_summary'] },
    { id: 'list', titleFa: 'فهرست و سوابق ممیزی‌ها', titleEn: 'PTW Audit Records', tools: ['ptw_audit_summary'], notes: '۲۰ رکورد آخر با شماره پروانه، تاریخ، واحد و شاخص‌های ممیزی ارائه می‌شود؛ نام امضاکنندگان، شناسه پرسنلی، امضا و پیوست‌ها در خروجی AI حذف می‌شوند.' },
  ],
  'health-env': [
    {
      id: HSECORE_HEALTH_ENV_OVERVIEW.key,
      titleFa: HSECORE_HEALTH_ENV_OVERVIEW.titleFa,
      titleEn: HSECORE_HEALTH_ENV_OVERVIEW.titleEn,
      tools: ['health_medical_summary', 'nutrition_high_risk_summary', 'environment_summary', 'five_s_inspections_summary'],
      notes: 'داشبورد تجمیعی؛ فقط منابعی که برای کاربر جاری مجاز و واقعاً متصل هستند تحلیل می‌شوند.',
    },
    ...HSECORE_HEALTH_ENV_SUBITEMS.map(item => ({
    id: item.key,
    titleFa: item.titleFa,
    titleEn: item.titleEn,
    enabled: item.enabled,
    ...(HEALTH_CHILD_ADAPTERS[item.key] || {}),
  })),
  ],
  'fire-dept': HSECORE_FIRE_DEPT_SUBITEMS.map(item => ({
    id: item.key,
    titleFa: item.titleFa,
    titleEn: item.titleEn,
    enabled: item.enabled,
    ...(FIRE_CHILD_ADAPTERS[item.key] || {}),
  })),
  'safety-unit': HSECORE_SAFETY_DEPT_SUBITEMS.map(item => ({
    id: item.key,
    titleFa: item.titleFa,
    titleEn: item.titleEn,
    enabled: item.enabled,
    tools: ['five_s_inspections_summary'],
    permission: 'five_s:read',
  })),
  documents: HSECORE_DOCUMENTS_SUBITEMS.map(item => ({
    id: item.key,
    titleFa: item.titleFa,
    titleEn: item.titleEn,
    rag: true,
  })),
};

const DEFAULT_GRANDCHILDREN: Record<string, ModuleDefinition[]> = {
  'health-env:periodic-exams': [
    { id: 'dashboard', titleFa: 'داشبورد سلامت', titleEn: 'Health Dashboard', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'personnel', titleFa: 'پرونده پرسنل', titleEn: 'Personnel Dossier', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'exams', titleFa: 'معاینات ادواری', titleEn: 'Periodic Exams', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'lab', titleFa: 'آزمایشگاه', titleEn: 'Laboratory', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'bmi', titleFa: 'شاخص BMI', titleEn: 'BMI', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'reports', titleFa: 'گزارش‌های هوشمند', titleEn: 'Smart Reports', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'compare', titleFa: 'مقایسه سنواتی', titleEn: 'Annual Comparison', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'personcompare', titleFa: 'مقایسه فردی', titleEn: 'Personnel Comparison', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'import', titleFa: 'ورود اطلاعات', titleEn: 'Import Data', permission: 'health:read', adminOnly: true, explicitPermission: true },
  ],
  'health-env:nutrition': [
    { id: 'table', titleFa: 'فهرست پرونده‌ها و مراجعات', titleEn: 'Nutrition Records & Visits', permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'analytics', titleFa: 'داشبورد و تحلیل شاخص‌ها', titleEn: 'Nutrition Analytics', permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'high_risk', titleFa: 'بیماری‌های پرخطر و پیگیری', titleEn: 'High-Risk Personnel & Follow-up', tools: ['nutrition_high_risk_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
  ],
  'fire-dept:vehicles': [
    { id: 'dashboard', titleFa: 'داشبورد ناوگان', titleEn: 'Fleet Dashboard', tools: ['fire_safety_summary'], notes: 'فقط تعداد ناوگان در منبع فعلی موجود است؛ جزئیات کامل ناوگان متصل نیست.' },
    { id: 'vehicles', titleFa: 'فهرست خودروها', titleEn: 'Vehicles Directory', tools: ['fire_safety_summary'], notes: 'فقط تعداد خودروها در منبع فعلی موجود است؛ رکوردهای خودرو متصل نیست.' },
    { id: 'inspect', titleFa: 'ثبت بازرسی چک‌لیست', titleEn: 'Vehicle Inspections' },
    { id: 'defects', titleFa: 'نواقص و عیوب', titleEn: 'Vehicle Defects' },
    { id: 'standards', titleFa: 'استانداردها و الزامات', titleEn: 'Vehicle Standards' },
    { id: 'profile', titleFa: 'پروفایل خودرو', titleEn: 'Vehicle Profile' },
  ],
};

const SETTING_KEYS = new Set([
  'hse_ui_config_v3',
  'hse_health_env_ui_config',
  'hse_fire_dept_ui_config',
  'hse_safety_dept_ui_config',
]);

function parseSetting(value: unknown): any[] | null {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function canUseTool(user: UserContext, toolName: string): boolean {
  const access = TOOL_ACCESS[toolName] || {};
  const globalAdmin = isGlobalAdminUser(user);
  if (access.explicitPermission && (!access.permission || !checkUserHasPermission(user, access.permission))) return false;
  if (access.adminOnly && !globalAdmin) return false;
  if (access.permission && !access.explicitPermission && !globalAdmin && !checkUserHasPermission(user, access.permission)) return false;
  return true;
}

function canAccessDefinition(user: UserContext, definition: ModuleDefinition): boolean {
  const globalAdmin = isGlobalAdminUser(user);
  if (definition.adminOnly && !globalAdmin) return false;
  if (definition.explicitPermission && (!definition.permission || !checkUserHasPermission(user, definition.permission))) return false;
  if (definition.permission && !definition.explicitPermission && !globalAdmin && !checkUserHasPermission(user, definition.permission)) return false;
  return true;
}

function mergeConfiguredDefinitions(defaults: ModuleDefinition[], configured: any[] | null): ModuleDefinition[] {
  const byId = new Map(defaults.map(item => [item.id, { ...item }]));
  if (!configured) return Array.from(byId.values());

  const ordered: ModuleDefinition[] = [];
  const seen = new Set<string>();
  for (const item of configured) {
    if (!item || typeof item.key !== 'string' || !item.key.trim() || seen.has(item.key)) continue;
    seen.add(item.key);
    const current = byId.get(item.key);
    const next: ModuleDefinition = current ? { ...current } : {
      id: item.key,
      titleFa: String(item.titleFa || item.key),
      titleEn: String(item.titleEn || item.key),
    };
    if (typeof item.titleFa === 'string') next.titleFa = item.titleFa;
    if (typeof item.titleEn === 'string') next.titleEn = item.titleEn;
    if (typeof item.enabled === 'boolean') next.enabled = item.enabled;
    ordered.push(next);
    byId.delete(item.key);
  }
  // Match the UI merger: preserve saved order, then append newly shipped defaults.
  ordered.push(...Array.from(byId.values()));
  return ordered;
}

function toCatalogItem(definition: ModuleDefinition, user: UserContext, parentId?: string, parentAllowed = true): AIModuleCatalogItem {
  const configuredTools = definition.tools || [];
  const tools = configuredTools.filter(tool => canUseTool(user, tool));
  const enabled = definition.enabled !== false;
  const allowed = enabled && parentAllowed && canAccessDefinition(user, definition);
  const connected = allowed && (tools.length > 0 || definition.rag === true);
  const notes = !allowed
    ? 'برای مشاهده و تحلیل این بخش، مجوز دسترسی لازم را ندارید.'
    : connected
      ? (definition.rag ? 'بازیابی مستندات از مسیر RAG انجام می‌شود.' : (definition.notes || 'خلاصه‌ساز داده متصل است؛ این اتصال لزوماً همه تب‌ها، فرم‌ها و فیلدهای این ماژول را پوشش نمی‌دهد.'))
      : configuredTools.length > 0
        ? 'Adapter داده برای این بخش وجود دارد، اما مجوزهای لازم برای کاربر جاری فراهم نیست.'
        : 'در حال حاضر Adapter خواندن داده برای این بخش متصل نیست؛ مدل نباید درباره داده‌های آن حدس بزند.';
  return {
    moduleId: parentId ? `${parentId}:${definition.id}` : definition.id,
    moduleNameFa: definition.titleFa,
    titleEn: definition.titleEn,
    parentId,
    enabled,
    connected,
    allowed,
    tools,
    assistantIds: ['GENERAL_HSE'],
    notes,
  };
}

export async function getAIModuleCatalog(user?: UserContext): Promise<AIModuleCatalogItem[]> {
  if (!user) return [];
  let settings: any[] = [];
  try {
    const rows = await db.select().from(schema.systemSettings)
      .where(inArray(schema.systemSettings.key, Array.from(SETTING_KEYS)));
    settings = rows.map((row: any) => ({
      key: String(row.key),
      value: row.value,
    }));
  } catch {
    // The canonical built-in module manifest remains available if settings cannot be read.
  }
  const setting = (key: string) => settings.find(item => item.key === key)?.value;
  const modules = mergeConfiguredDefinitions(DEFAULT_MODULES, parseSetting(setting('hse_ui_config_v3')));
  const childSettings: Record<string, string> = {
    'health-env': 'hse_health_env_ui_config',
    'fire-dept': 'hse_fire_dept_ui_config',
    'safety-unit': 'hse_safety_dept_ui_config',
  };
  return modules.map(module => {
    const parent = toCatalogItem(module, user);
    const defaults = DEFAULT_CHILDREN[module.id] || [];
    const configured = childSettings[module.id] ? parseSetting(setting(childSettings[module.id])) : null;
    const children = mergeConfiguredDefinitions(defaults, configured).map(child => {
      const childItem = toCatalogItem(child, user, module.id, parent.allowed);
      const grandchildDefaults = DEFAULT_GRANDCHILDREN[childItem.moduleId] || [];
      if (grandchildDefaults.length) {
        childItem.children = grandchildDefaults.map(grandchild => toCatalogItem(grandchild, user, childItem.moduleId, childItem.allowed));
      }
      return childItem;
    });
    if (children.length) parent.children = children;
    return parent;
  });
}

export function getAIModuleToolNames(selectedModuleIds: string[], catalog: AIModuleCatalogItem[]): string[] {
  const selected = new Set(selectedModuleIds);
  const toolNames = new Set<string>();
  const visit = (item: AIModuleCatalogItem) => {
    if (selected.has(item.moduleId) && item.allowed) item.tools.forEach(tool => toolNames.add(tool));
    (item.children || []).forEach(visit);
  };
  catalog.forEach(visit);
  return Array.from(toolNames);
}

export function getSelectedModuleDescriptions(selectedModuleIds: string[], catalog: AIModuleCatalogItem[]): {
  selected: string[];
  connected: string[];
  unavailable: string[];
} {
  const selectedIds = new Set(selectedModuleIds);
  const entries: AIModuleCatalogItem[] = [];
  const visit = (item: AIModuleCatalogItem) => {
    if (selectedIds.has(item.moduleId)) entries.push(item);
    (item.children || []).forEach(visit);
  };
  catalog.forEach(visit);
  return {
    selected: entries.map(item => item.moduleNameFa),
    connected: entries.filter(item => item.allowed && item.connected).map(item => item.moduleNameFa),
    unavailable: entries.filter(item => !item.allowed || !item.connected).map(item =>
      item.moduleNameFa
    ),
  };
}
