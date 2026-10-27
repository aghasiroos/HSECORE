import { getStoredOrgNodes, getComplexPersonnelList } from './personnelHelper';
import { apiDb } from '../services/apiDatabaseClient';
import {
  DEFAULT_INCIDENT_TYPES,
  DEFAULT_PPE_CATEGORIES,
  HseIncidentCategoryItem,
  PpeCategoryItem
} from '../components/OrganizationMgmt';
import { PpeItem } from '../types';

export const UNITS: string[] = [];

export const JOB_TITLES: string[] = [];

export interface UnitStructureDetail {
  jobs: string[];
  subUnits: Record<string, string[]>; // SubUnitName -> JobTitles[]
}

export type OrgUnitsDataMap = Record<string, UnitStructureDetail>;

// Pure in-memory runtime caches (Strictly Zero Browser Storage / Zero localStorage)
let inMemoryOrgStructureCache: OrgUnitsDataMap | null = null;
let inMemoryJobTitlesCache: string[] | null = null;
let inMemoryIncidentTypesCache: HseIncidentCategoryItem[] | null = null;
let inMemoryPpeCategoriesCache: PpeCategoryItem[] | null = null;
let inMemoryPpeItemsCache: PpeItem[] | null = null;

let isFetchingOrgConfig = false;
let hasHydratedOrgConfig = false;

function buildDefaultOrgUnitsStructure(): OrgUnitsDataMap {
  return {};
}

function normalizeStructureMap(rawObj: any): OrgUnitsDataMap {
  const normalized: OrgUnitsDataMap = {};
  if (!rawObj || typeof rawObj !== 'object') return buildDefaultOrgUnitsStructure();

  for (const key of Object.keys(rawObj)) {
    const val = rawObj[key];
    if (Array.isArray(val)) {
      const subUnitsMap: Record<string, string[]> = {};
      val.forEach((sub: string) => {
        if (typeof sub === 'string' && sub.trim()) {
          subUnitsMap[sub.trim()] = [];
        }
      });
      normalized[key] = { jobs: [], subUnits: subUnitsMap };
    } else if (val && typeof val === 'object') {
      const jobs = Array.isArray(val.jobs) ? val.jobs : [];
      const subUnits: Record<string, string[]> = {};
      if (val.subUnits && typeof val.subUnits === 'object') {
        for (const subK of Object.keys(val.subUnits)) {
          subUnits[subK] = Array.isArray(val.subUnits[subK]) ? val.subUnits[subK] : [];
        }
      }
      normalized[key] = { jobs, subUnits };
    } else {
      normalized[key] = { jobs: [], subUnits: {} };
    }
  }
  return normalized;
}

/**
 * Purges any legacy organizational structure or config keys from browser storage.
 */
export function clearLegacyOrgBrowserStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('hse_unit_structure_v1');
    localStorage.removeItem('hse_org_jobs');
    localStorage.removeItem('hse_org_units');
    localStorage.removeItem('hse_incident_types_config');
    localStorage.removeItem('hse_ppe_categories');
    localStorage.removeItem('hse_ppe_items');
    sessionStorage.removeItem('hse_unit_structure_v1');
    sessionStorage.removeItem('hse_org_jobs');
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Hydrates in-memory organizational caches directly from a settings object without extra network calls.
 */
export function hydrateOrgConfigFromSettingsObject(settings: Record<string, any>): void {
  if (!settings || typeof settings !== 'object') return;
  if (settings.hse_unit_structure_v1 && typeof settings.hse_unit_structure_v1 === 'object') {
    inMemoryOrgStructureCache = normalizeStructureMap(settings.hse_unit_structure_v1);
  } else if (!inMemoryOrgStructureCache) {
    inMemoryOrgStructureCache = buildDefaultOrgUnitsStructure();
  }
  if (Array.isArray(settings.hse_org_jobs)) {
    inMemoryJobTitlesCache = settings.hse_org_jobs;
  } else if (!inMemoryJobTitlesCache) {
    inMemoryJobTitlesCache = [];
  }
  if (Array.isArray(settings.hse_incident_types_config) && settings.hse_incident_types_config.length > 0) {
    inMemoryIncidentTypesCache = settings.hse_incident_types_config;
  } else if (!inMemoryIncidentTypesCache) {
    inMemoryIncidentTypesCache = [...DEFAULT_INCIDENT_TYPES];
  }
  if (Array.isArray(settings.hse_ppe_categories) && settings.hse_ppe_categories.length > 0) {
    inMemoryPpeCategoriesCache = settings.hse_ppe_categories;
  } else if (!inMemoryPpeCategoriesCache) {
    inMemoryPpeCategoriesCache = [...DEFAULT_PPE_CATEGORIES];
  }
  if (Array.isArray(settings.hse_ppe_items)) {
    inMemoryPpeItemsCache = settings.hse_ppe_items;
  } else if (!inMemoryPpeItemsCache) {
    inMemoryPpeItemsCache = [];
  }
  hasHydratedOrgConfig = true;
}

/**
 * Fetches all organizational configurations (Units structure, Job titles, Incident types, PPE categories & items)
 * directly from the central database and updates the in-memory runtime caches.
 */
export async function fetchAllOrgConfigFromDb(forceRefresh = false): Promise<{
  orgStructure: OrgUnitsDataMap;
  jobTitles: string[];
  incidentTypes: HseIncidentCategoryItem[];
  ppeCategories: PpeCategoryItem[];
  ppeItems: PpeItem[];
}> {
  if (forceRefresh) {
    apiDb.invalidateCache('settings');
    hasHydratedOrgConfig = false;
  }

  if (!hasHydratedOrgConfig || forceRefresh) {
    try {
      const settings = await apiDb.getSettings();
      hydrateOrgConfigFromSettingsObject(settings || {});
    } catch (err) {
      console.error('Failed to fetch org config from central database:', err);
      hydrateOrgConfigFromSettingsObject({});
    }
  }

  return {
    orgStructure: inMemoryOrgStructureCache || buildDefaultOrgUnitsStructure(),
    jobTitles: inMemoryJobTitlesCache || [],
    incidentTypes: inMemoryIncidentTypesCache || DEFAULT_INCIDENT_TYPES,
    ppeCategories: inMemoryPpeCategoriesCache || DEFAULT_PPE_CATEGORIES,
    ppeItems: inMemoryPpeItemsCache || []
  };
}

/**
 * Background hydration trigger when synchronous getters are called before initial load.
 */
function ensureOrgConfigHydrated(): void {
  if (hasHydratedOrgConfig || isFetchingOrgConfig || typeof window === 'undefined') return;

  isFetchingOrgConfig = true;
  hasHydratedOrgConfig = true;
  fetchAllOrgConfigFromDb()
    .then(() => {
      window.dispatchEvent(new Event('hse_unit_structure_updated'));
      window.dispatchEvent(new Event('hse_org_jobs_updated'));
    })
    .finally(() => {
      isFetchingOrgConfig = false;
    });
}

/**
 * Returns the full mapping of Unit -> { jobs: string[], subUnits: Record<string, string[]> }
 * Strictly from in-memory cache synchronized with the central database.
 */
export function getOrgUnitsStructure(): OrgUnitsDataMap {
  clearLegacyOrgBrowserStorage();
  if (!inMemoryOrgStructureCache) {
    inMemoryOrgStructureCache = buildDefaultOrgUnitsStructure();
    ensureOrgConfigHydrated();
  }
  return inMemoryOrgStructureCache;
}

/**
 * Saves the full Unit -> { jobs, subUnits } structure directly to the central database.
 */
export async function saveOrgUnitsStructure(data: OrgUnitsDataMap): Promise<boolean> {
  clearLegacyOrgBrowserStorage();
  inMemoryOrgStructureCache = normalizeStructureMap(data);
  try {
    const success = await apiDb.saveSetting('hse_unit_structure_v1', inMemoryOrgStructureCache, 'Organizational Units & Sub-Units Structure');
    return success;
  } catch (err) {
    console.error('Failed to save org units structure to central DB:', err);
    return false;
  }
}

/**
 * Case-insensitive, trimmed lookup for a Unit in the OrgUnitsDataMap
 */
export function findUnitDetail(unitName?: string, struct?: OrgUnitsDataMap): UnitStructureDetail | undefined {
  if (!unitName) return undefined;
  const map = struct || getOrgUnitsStructure();
  const clean = unitName.trim();
  if (map[clean]) return map[clean];

  const foundKey = Object.keys(map).find(k => k.trim().toLowerCase() === clean.toLowerCase());
  return foundKey ? map[foundKey] : undefined;
}

/**
 * Returns the list of main organizational units.
 * Authoritative source is the Units & Jobs Structure, supplemented by active Org Hierarchy Nodes.
 * Never revives units that were deleted by administrator.
 */
export function getUnits(): string[] {
  const struct = getOrgUnitsStructure();
  const keys = Object.keys(struct);

  const combined = new Set<string>(keys);
  try {
    const nodes = getStoredOrgNodes();
    nodes.forEach(n => {
      if (n.status !== 'inactive' && (n.type === 'Plant' || n.type === 'Department' || n.type === 'Area' || n.type === 'Unit')) {
        if (n.name && n.name.trim()) combined.add(n.name.trim());
      }
    });
  } catch {}

  return Array.from(combined);
}

/**
 * Returns the list of Sites / Complexes (محل خدمت / سایت‌ها) from the Org Hierarchy Chart & Personnel Records
 */
export function getOrgSites(): string[] {
  const sites = new Set<string>();
  try {
    const nodes = getStoredOrgNodes();
    nodes.forEach(n => {
      if (n.status !== 'inactive' && (n.type === 'Site' || n.type === 'Company')) {
        if (n.name && n.name.trim()) sites.add(n.name.trim());
      }
      if (n.location && n.location.trim()) {
        sites.add(n.location.trim());
      }
    });
  } catch {}

  try {
    const personnel = getComplexPersonnelList();
    personnel.forEach(p => {
      if (p.workplace && p.workplace.trim()) {
        sites.add(p.workplace.trim());
      }
    });
  } catch {}

  return Array.from(sites);
}

/**
 * Returns the sub-units for a given main unit (merging Units Structure + Org Hierarchy Chart children + Personnel Sub-Units)
 */
export function getSubUnitsForUnit(unitName?: string): string[] {
  if (!unitName) return [];
  const cleanUnit = unitName.trim();
  const subSet = new Set<string>();

  const unitDetail = findUnitDetail(cleanUnit);
  if (unitDetail && unitDetail.subUnits) {
    Object.keys(unitDetail.subUnits).forEach(s => subSet.add(s.trim()));
  }

  try {
    const nodes = getStoredOrgNodes();
    const matchedNode = nodes.find(n => n.name.trim().toLowerCase() === cleanUnit.toLowerCase());
    if (matchedNode) {
      const children = nodes.filter(n => n.parentId === matchedNode.id && n.status !== 'inactive');
      children.forEach(c => subSet.add(c.name.trim()));
    }
  } catch {}

  return Array.from(subSet);
}

/**
 * Returns job titles for a specific unit and/or sub-unit, or all job titles if none specified
 */
export function getJobsForUnitAndSubUnit(unitName?: string, subUnitName?: string): string[] {
  const unitDetail = findUnitDetail(unitName);
  if (!unitDetail) return getJobTitles();

  if (subUnitName && unitDetail.subUnits) {
    const cleanSub = subUnitName.trim().toLowerCase();
    const foundSubKey = Object.keys(unitDetail.subUnits).find(k => k.trim().toLowerCase() === cleanSub);
    if (foundSubKey) {
      const subJobs = unitDetail.subUnits[foundSubKey];
      if (Array.isArray(subJobs) && subJobs.length > 0) {
        return subJobs;
      }
    }
  }

  if (Array.isArray(unitDetail.jobs) && unitDetail.jobs.length > 0) {
    return unitDetail.jobs;
  }

  const allUnitJobs = new Set<string>(unitDetail.jobs || []);
  Object.values(unitDetail.subUnits || {}).forEach(jList => {
    if (Array.isArray(jList)) jList.forEach(j => allUnitJobs.add(j));
  });

  if (allUnitJobs.size > 0) {
    return Array.from(allUnitJobs);
  }

  return getJobTitles();
}

/**
 * Returns the list of global + unit-assigned job titles from in-memory database cache.
 * Excludes resurrected deleted jobs.
 */
export function getJobTitles(): string[] {
  clearLegacyOrgBrowserStorage();
  const set = new Set<string>();

  if (!inMemoryJobTitlesCache) {
    ensureOrgConfigHydrated();
  } else {
    inMemoryJobTitlesCache.forEach(j => {
      if (j && j.trim()) set.add(j.trim());
    });
  }

  try {
    const struct = getOrgUnitsStructure();
    Object.values(struct).forEach(u => {
      (u.jobs || []).forEach(j => {
        if (j && j.trim()) set.add(j.trim());
      });
      Object.values(u.subUnits || {}).forEach(subJobs => {
        (subJobs || []).forEach(j => {
          if (j && j.trim()) set.add(j.trim());
        });
      });
    });
  } catch {}

  return Array.from(set);
}

/**
 * Saves job titles directly to the central database and updates in-memory cache.
 */
export async function saveJobTitlesToDb(jobs: string[]): Promise<boolean> {
  clearLegacyOrgBrowserStorage();
  inMemoryJobTitlesCache = Array.isArray(jobs) ? [...jobs] : [];
  try {
    const success = await apiDb.saveSetting('hse_org_jobs', inMemoryJobTitlesCache, 'Organizational Job Titles');
    return success;
  } catch (err) {
    console.error('Failed to save job titles to central DB:', err);
    return false;
  }
}

/**
 * Returns Incident Category Types from in-memory database cache.
 */
export function getStoredIncidentTypes(): HseIncidentCategoryItem[] {
  clearLegacyOrgBrowserStorage();
  if (!inMemoryIncidentTypesCache) {
    ensureOrgConfigHydrated();
    return DEFAULT_INCIDENT_TYPES;
  }
  return inMemoryIncidentTypesCache;
}

/**
 * Saves Incident Category Types directly to the central database.
 */
export function saveIncidentTypesToDb(types: HseIncidentCategoryItem[]): void {
  clearLegacyOrgBrowserStorage();
  inMemoryIncidentTypesCache = Array.isArray(types) ? [...types] : DEFAULT_INCIDENT_TYPES;
  apiDb
    .saveSetting('hse_incident_types_config', inMemoryIncidentTypesCache, 'HSE Incident Category Types Configuration')
    .catch(console.error);
}

/**
 * Returns PPE Categories from in-memory database cache.
 */
export function getStoredPpeCategories(): PpeCategoryItem[] {
  clearLegacyOrgBrowserStorage();
  if (!inMemoryPpeCategoriesCache) {
    ensureOrgConfigHydrated();
    return DEFAULT_PPE_CATEGORIES;
  }
  return inMemoryPpeCategoriesCache;
}

/**
 * Saves PPE Categories directly to the central database.
 */
export function savePpeCategoriesToDb(categories: PpeCategoryItem[]): void {
  clearLegacyOrgBrowserStorage();
  inMemoryPpeCategoriesCache = Array.isArray(categories) ? [...categories] : DEFAULT_PPE_CATEGORIES;
  apiDb.savePpeCategories(inMemoryPpeCategoriesCache).catch(console.error);
}

/**
 * Returns PPE Catalog Items from in-memory database cache.
 */
export function getStoredPpeItems(): PpeItem[] {
  clearLegacyOrgBrowserStorage();
  if (!inMemoryPpeItemsCache) {
    ensureOrgConfigHydrated();
    return [];
  }
  return inMemoryPpeItemsCache;
}

/**
 * Saves PPE Catalog Items directly to the central database.
 */
export function savePpeItemsToDb(items: PpeItem[]): void {
  clearLegacyOrgBrowserStorage();
  inMemoryPpeItemsCache = Array.isArray(items) ? [...items] : [];
  apiDb.savePpeItems(inMemoryPpeItemsCache).catch(console.error);
}

/**
 * Auto-translates Persian PPE equipment names to standardized English equivalents.
 */
export function translatePpeNameToEn(textFa: string): string {
  if (!textFa || !textFa.trim()) return '';
  let result = textFa;

  const phraseMap: [RegExp, string][] = [
    [/کلاه\s*ایمنی/gi, 'Safety Helmet'],
    [/کلاه\s*صنعتی/gi, 'Industrial Hard Hat'],
    [/عینک\s*ایمنی/gi, 'Safety Glasses'],
    [/عینک\s*حفاظتی/gi, 'Protective Goggles'],
    [/شیلد\s*صورت/gi, 'Face Shield'],
    [/ماسک\s*تنفسی/gi, 'Respirator Mask'],
    [/ماسک\s*فیلتردار/gi, 'Filtered Respirator Mask'],
    [/کفش\s*ایمنی/gi, 'Safety Shoes'],
    [/پوتین\s*ایمنی/gi, 'Safety Boots'],
    [/دستکش\s*ایمنی/gi, 'Safety Gloves'],
    [/دستکش\s*ضد\s*برش/gi, 'Cut-Resistant Gloves'],
    [/دستکش\s*ضد\s*شیمیایی/gi, 'Chemical-Resistant Gloves'],
    [/دستکش\s*عایق\s*برق/gi, 'Electrical Insulating Gloves'],
    [/گوشی\s*ایمنی/gi, 'Ear Muffs'],
    [/صداگیر\s*ایمنی/gi, 'Ear Plugs'],
    [/هارنس\s*ایمنی/gi, 'Safety Harness'],
    [/کمربند\s*ایمنی/gi, 'Safety Belt'],
    [/لباس\s*کار/gi, 'Workwear Coverall'],
    [/جلیقه\s*شبرنگ/gi, 'High-Vis Safety Vest'],
  ];

  for (const [regex, replacement] of phraseMap) {
    if (regex.test(result)) {
      result = result.replace(regex, replacement);
    }
  }

  const wordMap: [RegExp, string][] = [
    [/صنعتی/gi, 'Industrial'],
    [/کلاس/gi, 'Class'],
    [/نوع/gi, 'Type'],
    [/مدل/gi, 'Model'],
    [/ضد\s*برق/gi, 'Electrical Insulated'],
    [/ضد\s*حرارت/gi, 'Heat Resistant'],
    [/ضد\s*اسید/gi, 'Acid Resistant'],
    [/ضد\s*ضربه/gi, 'Impact Resistant'],
    [/نسوز/gi, 'Fireproof'],
    [/چرمی/gi, 'Leather'],
    [/لاستیکی/gi, 'Rubber'],
    [/پلاستیکی/gi, 'Plastic'],
    [/فولادی/gi, 'Steel Toe'],
    [/کامپوزیت/gi, 'Composite'],
    [/فیلتر/gi, 'Filter'],
    [/شفاف/gi, 'Clear'],
    [/جوشکاری/gi, 'Welding'],
  ];

  for (const [regex, replacement] of wordMap) {
    result = result.replace(regex, replacement);
  }

  return result.trim();
}

