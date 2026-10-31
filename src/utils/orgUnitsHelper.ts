import { useState, useEffect, useCallback } from 'react';
import { OrgNode } from './authHelper';
import { syncAndGetExtractedDepartments, getStoredOrgNodes, fetchStoredOrgNodes } from './personnelHelper';
import { getUnits, getOrgUnitsStructure, fetchAllOrgConfigFromDb } from './orgHelper';
import { Department } from '../types';
import { normalizePersianArabicText } from './textNormalization';

export interface UnifiedOrgUnit {
  id: string;
  name: string;
  nameEn?: string;
  code: string;
  type: 'Company' | 'Site' | 'Plant' | 'Area' | 'Department' | 'Section' | 'Team' | 'Unit';
  parentId?: string | null;
  parentName?: string;
  fullPath?: string;
  manager?: string;
  managerPersonnelCode?: string | null;
  managerPersonnelId?: number | null;
  managerJobTitle?: string | null;
  managerNationalCode?: string | null;
  headcount?: number;
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  location?: string;
  status: 'active' | 'inactive' | 'commissioning';
}

/**
 * Normalizes Persian/Arabic characters and whitespace for accurate deduplication
 */
function normalizeText(str?: string): string {
  return normalizePersianArabicText(str);
}

/**
 * Fetches and merges all organizational units/departments from:
 * 1. Central Database Organizational Structure Nodes (in-memory cache via getStoredOrgNodes)
 * 2. Extracted Subordinate Departments (via syncAndGetExtractedDepartments)
 * 3. Operational Units & Sub-Units Structure (via getUnits / getOrgUnitsStructure)
 *
 * Strictly Zero Browser Storage (no localStorage).
 */
export function getUnifiedOrgUnits(): UnifiedOrgUnit[] {
  const unitMap = new Map<string, UnifiedOrgUnit>();

  // 1. Load from Organizational Hierarchy Nodes (in-memory DB cache)
  const rawNodes: OrgNode[] = getStoredOrgNodes();
  const nodeById = new Map<string, OrgNode>();
  rawNodes.forEach(n => nodeById.set(n.id, n));

  rawNodes.forEach(node => {
    if (node.status === 'inactive') return;
    const cleanName = normalizeText(node.name);
    if (!cleanName) return;

    const parentNode = node.parentId ? nodeById.get(node.parentId) : undefined;
    const trimmedName = node.name.trim();

    unitMap.set(cleanName, {
      id: node.id,
      name: trimmedName,
      nameEn: node.nameEn,
      code: node.code || `ORG-${node.id}`,
      type: node.type,
      parentId: node.parentId,
      parentName: parentNode?.name,
      fullPath: parentNode?.name ? `${parentNode.name.trim()} / ${trimmedName}` : trimmedName,
      manager: node.manager,
      managerPersonnelCode: node.managerPersonnelCode,
      managerPersonnelId: node.managerPersonnelId,
      managerJobTitle: node.managerJobTitle,
      managerNationalCode: node.managerNationalCode,
      headcount: node.headcount || 0,
      location: node.location,
      status: node.status || 'active',
      riskLevel: inferRiskLevel(cleanName)
    });
  });

  // 2. Load from Extracted Subordinate Departments (in-memory DB cache)
  try {
    const extractedDepts: Department[] = syncAndGetExtractedDepartments();
    extractedDepts.forEach((dept, idx) => {
      const cleanName = normalizeText(dept.name);
      if (!cleanName) return;

      if (unitMap.has(cleanName)) {
        const existing = unitMap.get(cleanName)!;
        if (!existing.manager || existing.manager.includes('تعیین نشده')) {
          existing.manager = dept.manager;
        }
        if (dept.employeeCount && dept.employeeCount > (existing.headcount || 0)) {
          existing.headcount = dept.employeeCount;
        }
        if (dept.riskLevel) {
          existing.riskLevel = dept.riskLevel;
        }
      } else {
        unitMap.set(cleanName, {
          id: dept.id || `dept-ext-${idx + 1}`,
          name: dept.name.trim(),
          code: `DEPT-${100 + idx}`,
          type: 'Department',
          manager: dept.manager,
          headcount: dept.employeeCount || 0,
          riskLevel: dept.riskLevel || inferRiskLevel(cleanName),
          status: 'active'
        });
      }
    });
  } catch (e) {
    console.error('Error merging extracted departments:', e);
  }

  // 3. Load from Operational Units Structure (in-memory DB cache)
  try {
    const simpleUnits = getUnits();
    const struct = getOrgUnitsStructure();
    simpleUnits.forEach((uName, idx) => {
      const cleanName = normalizeText(uName);
      if (!cleanName) return;
      if (!unitMap.has(cleanName)) {
        unitMap.set(cleanName, {
          id: `unit-std-${idx + 1}`,
          name: uName.trim(),
          code: `UNIT-${200 + idx}`,
          type: 'Unit',
          headcount: 0,
          riskLevel: inferRiskLevel(cleanName),
          status: 'active'
        });
      }
    });

    // Also include operational sub-units
    Object.keys(struct || {}).forEach(parentUnit => {
      const subs = Object.keys(struct[parentUnit]?.subUnits || {});
      subs.forEach((subName, sIdx) => {
        const cleanSub = normalizeText(subName);
        const trimmedSub = subName.trim();
        if (cleanSub && !unitMap.has(cleanSub)) {
          unitMap.set(cleanSub, {
            id: `subunit-${sIdx + 1}-${cleanSub}`,
            name: trimmedSub,
            code: `SEC-${300 + sIdx}`,
            type: 'Section',
            parentName: parentUnit,
            fullPath: `${parentUnit.trim()} / ${trimmedSub}`,
            headcount: 0,
            riskLevel: inferRiskLevel(cleanSub),
            status: 'active'
          });
        }
      });
    });
  } catch {}

  const result = Array.from(unitMap.values());
  const typeWeight: Record<string, number> = {
    Plant: 1,
    Department: 2,
    Area: 3,
    Section: 4,
    Unit: 5,
    Site: 6,
    Team: 7,
    Company: 8
  };

  result.sort((a, b) => {
    const wA = typeWeight[a.type] || 99;
    const wB = typeWeight[b.type] || 99;
    if (wA !== wB) return wA - wB;
    return a.name.localeCompare(b.name, 'fa');
  });

  return result;
}

function inferRiskLevel(name: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (
    name.includes('تولید') ||
    name.includes('فرآیند') ||
    name.includes('بهره‌برداری') ||
    name.includes('الفین') ||
    name.includes('پلیمر') ||
    name.includes('آتش‌نشانی') ||
    name.includes('مخازن')
  ) {
    return 'High';
  }
  if (
    name.includes('تعمیرات') ||
    name.includes('فنی') ||
    name.includes('مهندسی') ||
    name.includes('برق') ||
    name.includes('مکانیک') ||
    name.includes('تاسیسات') ||
    name.includes('HSE') ||
    name.includes('ایمنی') ||
    name.includes('آزمایشگاه')
  ) {
    return 'Medium';
  }
  return 'Low';
}

/**
 * Helper to look up a UnifiedOrgUnit by ID or Name
 */
export function resolveOrgUnit(identifier?: string, units?: UnifiedOrgUnit[]): UnifiedOrgUnit | undefined {
  if (!identifier) return undefined;
  const list = units || getUnifiedOrgUnits();
  const cleanId = normalizeText(identifier);
  return list.find(u => u.id === identifier || normalizeText(u.name) === cleanId || u.code === identifier);
}

/**
 * React Hook that provides real-time synchronized organizational units across all modules
 * directly from the central database.
 */
export function useUnifiedOrgUnits() {
  const [units, setUnits] = useState<UnifiedOrgUnit[]>(() => getUnifiedOrgUnits());

  const refresh = useCallback(async (forceDb = false) => {
    if (forceDb) {
      await Promise.all([fetchStoredOrgNodes(true), fetchAllOrgConfigFromDb(true)]);
    }
    setUnits(getUnifiedOrgUnits());
  }, []);

  useEffect(() => {
    refresh(false);

    const handleLocalUpdate = () => refresh(false);
    const handleRemoteMutation = (e?: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || e?.detail?.key || '').toLowerCase();
      if (
        entity &&
        (entity.includes('org') ||
          entity.includes('node') ||
          entity.includes('unit') ||
          entity.includes('department'))
      ) {
        refresh(true);
      }
    };

    window.addEventListener('hse_org_nodes_updated', handleLocalUpdate);
    window.addEventListener('hse_departments_updated', handleLocalUpdate);
    window.addEventListener('hse_unit_structure_updated', handleLocalUpdate);
    window.addEventListener('hse_org_jobs_updated', handleLocalUpdate);
    window.addEventListener('hse_personnel_updated', handleLocalUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteMutation);
    window.addEventListener('hse_central_data_synced', handleLocalUpdate);

    return () => {
      window.removeEventListener('hse_org_nodes_updated', handleLocalUpdate);
      window.removeEventListener('hse_departments_updated', handleLocalUpdate);
      window.removeEventListener('hse_unit_structure_updated', handleLocalUpdate);
      window.removeEventListener('hse_org_jobs_updated', handleLocalUpdate);
      window.removeEventListener('hse_personnel_updated', handleLocalUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteMutation);
      window.removeEventListener('hse_central_data_synced', handleLocalUpdate);
    };
  }, [refresh]);

  const unitNames = units.map(u => u.name);

  return {
    units,
    unitNames,
    isLoading: false,
    refresh: () => refresh(true),
    resolveUnit: (idOrName?: string) => resolveOrgUnit(idOrName, units)
  };
}
