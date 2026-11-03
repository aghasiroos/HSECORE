import { db, schema } from '../../core/db.ts';
import { inArray } from 'drizzle-orm';
import { checkUserHasPermission, isGlobalAdminUser, type UserContext } from '../../core/middleware/auth.ts';

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
}

const TOOL_ACCESS: Record<string, { permission?: string; adminOnly?: boolean; explicitPermission?: boolean }> = {
  heat_weather_summary: {},
  ptw_summary: { permission: 'ptw:read' },
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
};

const DEFAULT_MODULES: ModuleDefinition[] = [
  { id: 'dashboard', titleFa: 'داشبورد جامع مدیریتی', titleEn: 'Unified Executive Dashboard', tools: ['kpi_management_summary'], permission: 'reports:read' },
  { id: 'heat', titleFa: 'پایش استرس گرمایی', titleEn: 'Thermal Heat Stress Monitor', tools: ['heat_weather_summary'] },
  { id: 'hse-ms', titleFa: 'پایش نرخ رویدادها (TRIR)', titleEn: 'TRIR Incident Rate', tools: ['kpi_management_summary'], permission: 'reports:read' },
  { id: 'reports', titleFa: 'گزارشات و تحلیل‌های آماری', titleEn: 'Statistical Reports & BI', tools: ['kpi_management_summary'], permission: 'reports:read' },
  { id: 'ai-assistant', titleFa: 'هوش مصنوعی HSECORE', titleEn: 'HSECORE AI Assistant' },
  { id: 'safety-unit', titleFa: 'واحد ایمنی و بازرسی‌ها', titleEn: 'Safety Operations Department', tools: ['five_s_inspections_summary', 'non_conformances_summary'] },
  { id: 'fire-dept', titleFa: 'واحد آتش‌نشانی و امداد', titleEn: 'Fire Department & Emergency', tools: ['fire_safety_summary'], permission: 'fire:read' },
  { id: 'health-env', titleFa: 'واحد بهداشت و محیط زیست', titleEn: 'Health & Environment Department', tools: ['health_medical_summary', 'nutrition_high_risk_summary', 'environment_summary'] },
  { id: 'permit', titleFa: 'پروانه کار ایمن (PTW)', titleEn: 'Permit to Work (PTW)', tools: ['ptw_summary'], permission: 'ptw:read' },
  { id: 'ptw-audit', titleFa: 'ممیزی پروانه‌های کار (PTW Audit)', titleEn: 'Permit to Work Audit System', tools: ['ptw_summary'], permission: 'ptw:read' },
  { id: 'risk', titleFa: 'ارزیابی ریسک هوشمند (AI JSA)', titleEn: 'AI Risk Assessment (JSA/FMEA)', tools: ['risk_assessment_summary'], permission: 'risks:read' },
  { id: 'ppe', titleFa: 'تجهیزات حفاظت فردی (PPE)', titleEn: 'PPE Matrix Management', tools: ['ppe_summary'], permission: 'ppe:read' },
  { id: 'incidents', titleFa: 'گزارشات ناهنجاری و حوادث', titleEn: 'Safety Incidents & Anomalies', tools: ['incidents_summary'], permission: 'incidents:read' },
  { id: 'warnings', titleFa: 'ثبت و پیگیری اخطارها', titleEn: 'Personnel Written Warnings', tools: ['warnings_anomalies_summary'], permission: 'warnings:read' },
  { id: 'personnel-history', titleFa: 'پرونده جامع ۳۶۰ درجه پرسنل', titleEn: 'Personnel 360 History Dossier', tools: ['personnel_org_summary'], permission: 'personnel:read', adminOnly: true },
  { id: 'training', titleFa: 'مدیریت و تقویم آموزش', titleEn: 'Training Management & Calendar', tools: ['training_summary'], permission: 'training:read' },
  { id: 'documents', titleFa: 'دستورالعمل‌ها و مستندات', titleEn: 'Instructions & Documents', rag: true },
  { id: 'pending-documents', titleFa: 'کارتابل و اسناد در انتظار اقدام', titleEn: 'Documents Awaiting Action', tools: ['workflow_referrals_summary'], permission: 'workflows:read' },
  { id: 'non-conformances', titleFa: 'مدیریت عدم انطباق‌ها (CAPA)', titleEn: 'Non-Conformities & CAPA', tools: ['non_conformances_summary'], permission: 'audit:read' },
  { id: 'process-management', titleFa: 'مدیریت فرآیندها (BPMN)', titleEn: 'Process Management', tools: ['workflow_referrals_summary'], permission: 'workflows:read' },
  { id: 'notifications', titleFa: 'مدیریت هشدار و اعلان‌ها', titleEn: 'Alerts & Notifications Management', tools: ['notifications_summary'], permission: 'notifications:read' },
  { id: 'user-mgmt', titleFa: 'مدیریت کاربران و دسترسی‌ها', titleEn: 'User Management & RBAC', tools: ['users_roles_summary'], adminOnly: true },
  { id: 'system', titleFa: 'تنظیمات و ساختار سازمانی', titleEn: 'System Settings & Architecture', tools: ['settings_backup_summary'], adminOnly: true },
  { id: 'profile', titleFa: 'شناسنامه و تنظیمات کاربری', titleEn: 'My Personal Profile & Security' },
];

const DEFAULT_CHILDREN: Record<string, ModuleDefinition[]> = {
  'health-env': [
    { id: 'clinic', titleFa: 'بهداری و مراجعات سرپایی', titleEn: 'Clinic Visits' },
    { id: 'periodic-exams', titleFa: 'سامانه معاینات ادواری طب کار', titleEn: 'Periodic Medical Exams', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'non-periodic-exams', titleFa: 'معاینات غیر دوره‌ای', titleEn: 'Non-Periodic Exams', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'nutrition', titleFa: 'کارشناس تغذیه و رژیم‌درمانی', titleEn: 'Nutrition Specialist', tools: ['nutrition_high_risk_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'health-env-checklists', titleFa: 'چک‌لیست‌های عملیاتی بهداشت و محیط زیست', titleEn: 'Health & Environment Checklists' },
    { id: 'env-dashboard', titleFa: 'داشبورد محیط‌زیست', titleEn: 'Environment Dashboard', tools: ['environment_summary'], permission: 'environment:read' },
    { id: 'env-monitoring', titleFa: 'پایش‌های محیط‌زیستی', titleEn: 'Environmental Monitoring', tools: ['environment_summary'], permission: 'environment:read' },
    { id: 'waste-management', titleFa: 'مدیریت پسماند (EMP)', titleEn: 'Waste Management', tools: ['environment_summary'], permission: 'environment:read' },
    { id: 'wastewater', titleFa: 'مدیریت پساب (ETP)', titleEn: 'Wastewater Management', tools: ['environment_summary'], permission: 'environment:read' },
    { id: 'air-water-soil', titleFa: 'پایش دودکش، آب و خاک', titleEn: 'Stacks, Water & Soil', tools: ['environment_summary'], permission: 'environment:read' },
    { id: 'five-s', titleFa: 'ساماندهی 5S', titleEn: '5S System', tools: ['five_s_inspections_summary'], permission: 'five_s:read' },
    { id: 'env-reports', titleFa: 'گزارش‌های محیط‌زیست', titleEn: 'Environment Reports', tools: ['environment_summary'], permission: 'environment:read' },
  ],
  'fire-dept': [
    { id: 'dashboard', titleFa: 'داشبورد و وضعیت کل', titleEn: 'Overview Dashboard', tools: ['fire_safety_summary'], permission: 'fire:read' },
    { id: 'daily-report', titleFa: 'گزارش روزانه آتش‌نشانی', titleEn: 'Daily Station Report' },
    { id: 'vehicles', titleFa: 'مدیریت و بازرسی خودروها', titleEn: 'Fire Vehicles Fleet' },
  ],
  'safety-unit': [
    { id: 'dashboard', titleFa: 'داشبورد واحد ایمنی', titleEn: 'Safety Dashboard', tools: ['five_s_inspections_summary'], permission: 'five_s:read' },
    { id: 'checklists', titleFa: 'سوابق و اجرای بازرسی', titleEn: 'Inspection Checklists', tools: ['five_s_inspections_summary'], permission: 'five_s:read' },
  ],
  documents: [
    { id: 'ORG_PROCEDURES', titleFa: 'دستورالعمل‌ها و روش‌های اجرایی سازمانی', titleEn: 'Organizational Procedures', rag: true },
    { id: 'EQUIPMENT_CERTIFICATES', titleFa: 'گواهینامه‌ها و سرتیفیکیت تجهیزات', titleEn: 'Equipment Certificates', rag: true },
    { id: 'ORG_FORMS_CHECKLISTS', titleFa: 'فرم‌ها و چک‌لیست‌های سازمانی', titleEn: 'Organizational Forms & Checklists', rag: true },
    { id: 'OTHER_HSE_DOCS', titleFa: 'سایر مستندات مرتبط با HSE', titleEn: 'Other HSE Documents', rag: true },
  ],
};

const DEFAULT_GRANDCHILDREN: Record<string, ModuleDefinition[]> = {
  'health-env:periodic-exams': [
    { id: 'dashboard', titleFa: 'داشبورد معاینات ادواری', titleEn: 'Periodic Exams Dashboard', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'exams', titleFa: 'سوابق معاینات', titleEn: 'Medical Exam Records', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'lab', titleFa: 'آزمایشگاه', titleEn: 'Laboratory Results', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'bmi', titleFa: 'شاخص توده بدنی (BMI)', titleEn: 'BMI Analytics', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'annual-compare', titleFa: 'مقایسه سالانه', titleEn: 'Annual Comparison', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'import-excel', titleFa: 'ورود اطلاعات از اکسل', titleEn: 'Excel Import', permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'smart-reports', titleFa: 'گزارش‌های هوشمند', titleEn: 'Smart Reports', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'person-compare', titleFa: 'مقایسه وضعیت افراد', titleEn: 'Personnel Comparison', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'personnel-dossier', titleFa: 'پرونده سلامت پرسنل', titleEn: 'Personnel Health Dossier', tools: ['health_medical_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
  ],
  'health-env:nutrition': [
    { id: 'high-risk', titleFa: 'افراد پرخطر و پیگیری', titleEn: 'High-Risk Personnel & Follow-up', tools: ['nutrition_high_risk_summary'], permission: 'health:read', adminOnly: true, explicitPermission: true },
    { id: 'care-plans', titleFa: 'برنامه‌های مراقبتی', titleEn: 'Nutrition Care Plans', permission: 'health:read', adminOnly: true, explicitPermission: true },
  ],
  'fire-dept:vehicles': [
    { id: 'vehicle-dashboard', titleFa: 'داشبورد ناوگان', titleEn: 'Fleet Dashboard' },
    { id: 'vehicle-inspections', titleFa: 'بازرسی خودروها', titleEn: 'Vehicle Inspections' },
    { id: 'vehicle-maintenance', titleFa: 'تعمیر و نگهداری', titleEn: 'Vehicle Maintenance' },
    { id: 'vehicle-defects', titleFa: 'نواقص و عیوب', titleEn: 'Vehicle Defects' },
    { id: 'vehicle-certificates', titleFa: 'گواهینامه‌ها و مدارک', titleEn: 'Vehicle Certificates' },
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
  if (!configured) return defaults.map(item => ({ ...item }));
  const byId = new Map(defaults.map(item => [item.id, { ...item }]));
  for (const item of configured) {
    if (!item || typeof item.key !== 'string' || !item.key.trim()) continue;
    const current = byId.get(item.key);
    const next: ModuleDefinition = current ? { ...current } : {
      id: item.key,
      titleFa: String(item.titleFa || item.key),
      titleEn: String(item.titleEn || item.key),
    };
    if (typeof item.titleFa === 'string') next.titleFa = item.titleFa;
    if (typeof item.titleEn === 'string') next.titleEn = item.titleEn;
    if (typeof item.enabled === 'boolean') next.enabled = item.enabled;
    byId.set(item.key, next);
  }
  return Array.from(byId.values());
}

function toCatalogItem(definition: ModuleDefinition, user: UserContext, parentId?: string): AIModuleCatalogItem {
  const configuredTools = definition.tools || [];
  const tools = configuredTools.filter(tool => canUseTool(user, tool));
  const enabled = definition.enabled !== false;
  const allowed = enabled && canAccessDefinition(user, definition);
  const connected = allowed && (tools.length > 0 || definition.rag === true);
  const notes = !allowed
    ? 'برای مشاهده و تحلیل این بخش، مجوز دسترسی لازم را ندارید.'
    : connected
      ? (definition.rag ? 'بازیابی مستندات از مسیر RAG انجام می‌شود.' : undefined)
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
      const childItem = toCatalogItem(child, user, module.id);
      const grandchildDefaults = DEFAULT_GRANDCHILDREN[childItem.moduleId] || [];
      if (grandchildDefaults.length) {
        childItem.children = grandchildDefaults.map(grandchild => toCatalogItem(grandchild, user, childItem.moduleId));
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
      `${item.moduleNameFa}: ${item.notes || 'داده‌ای برای این بخش متصل نیست.'}`
    ),
  };
}
