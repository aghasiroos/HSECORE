import { WorkflowApprover, WorkflowStep, AssigneeType, ApprovalLogic } from '../types';
import { getStoredOrgNodes, getComplexPersonnelList } from '../../../utils/personnelHelper';
import { getOrgUnitsStructure, getJobTitles } from '../../../utils/orgHelper';
import { getSystemUsers } from '../../../utils/authHelper';
import { apiDb } from '../../../services/apiDatabaseClient';
import { normalizeForMatching } from '../../../utils/textNormalization';

export interface DynamicOrgDepartment {
  id: string;
  name: string;
  code: string;
  manager: string;
  activeCount: number;
}

export interface DynamicOrgRole {
  id: string;
  titleFa: string;
  descFa: string;
  activeCount: number;
}

// Fallback empty standard arrays for backwards compatibility
export const STANDARD_ROLES: DynamicOrgRole[] = [];
export const STANDARD_DEPARTMENTS: DynamicOrgDepartment[] = [];

// No default mock personnel - system starts clean
export const DEFAULT_APPROVER_PERSONNEL: WorkflowApprover[] = [];

// List of mock usernames to purge from legacy storage
const MOCK_USERNAMES = [
  'a.rezaei',
  'm.hamzeh',
  'b.alavi',
  'h.bagheri',
  'f.hoseini',
  'k.naseri',
  's.sayadi',
  'j.morovati',
  'm.taheri',
  'supervisor',
  'operator',
  'manager',
  'auditor'
];

/**
 * Loads all users from پایگاه داده in-memory state. Cleans up legacy mock entries.
 */
export function getAllSystemUsers(): WorkflowApprover[] {
  const users = getSystemUsers();
  const storedUsers: WorkflowApprover[] = users
    .filter((u: any) => !MOCK_USERNAMES.includes(u.username))
    .map((u: any) => ({
      id: u.id || `user-${u.username || Math.random().toString(36).substring(2, 7)}`,
      username: u.username || '',
      fullName: u.fullName || u.name || u.username,
      jobTitle: u.jobTitle || '',
      department: u.department || (u.departmentIds?.length ? u.departmentIds[0] : 'واحد HSE'),
      role: u.role || 'User',
      accountStatus: u.accountStatus || (u.status === 'inactive' ? 'Inactive' : 'Active'),
      personnelNumber: u.personnelNumber || u.personnelCode || ''
    }));

  const userMap = new Map<string, WorkflowApprover>();
  DEFAULT_APPROVER_PERSONNEL.forEach(u => userMap.set(u.id || u.username, u));
  storedUsers.forEach(u => userMap.set(u.id || u.username, u));

  return Array.from(userMap.values());
}

/**
 * Saves or updates a system approver/user into پایگاه داده
 */
export function saveSystemApprover(user: WorkflowApprover): WorkflowApprover[] {
  try {
    apiDb.saveUser(user as any).catch(console.error);
    return getAllSystemUsers();
  } catch (e) {
    console.error('Failed to save system approver', e);
    return getAllSystemUsers();
  }
}

/**
 * Deletes a system approver/user from پایگاه داده
 */
export function deleteSystemApprover(userId: string): WorkflowApprover[] {
  try {
    apiDb.deleteUser(userId).catch(console.error);
    const current = getAllSystemUsers();
    return current.filter(u => u.id !== userId && u.username !== userId);
  } catch (e) {
    console.error('Failed to delete system approver', e);
    return getAllSystemUsers();
  }
}

/**
 * Clears all approvers/users from storage
 */
export function clearAllSystemApprovers(): WorkflowApprover[] {
  return [];
}

/**
 * Returns strictly Active users eligible for assignment.
 */
export function getActiveApproverUsers(): WorkflowApprover[] {
  return getAllSystemUsers().filter(u => u.accountStatus === 'Active');
}

/**
 * Returns roles dynamically and exclusively extracted from:
 * 1. "واحدها و مشاغل عملیاتی" (Operational Units & Jobs: hse_org_jobs & hse_unit_structure_v1)
 * 2. Active jobs from personnel records
 * Automatically updates whenever jobs are added or edited in the organization tabs.
 */
export function getRolesWithActiveCount(): DynamicOrgRole[] {
  const users = getActiveApproverUsers();
  const personnel = getComplexPersonnelList().filter(p => p.status !== 'inactive');

  const roleTitles = new Set<string>();

  // 1. From getJobTitles() (authoritative PostgreSQL settings)
  getJobTitles().forEach(j => {
    if (j && j.trim()) roleTitles.add(j.trim());
  });

  // 3. From Operational Units & Sub-Units structure (hse_unit_structure_v1)
  try {
    const unitStruct = getOrgUnitsStructure();
    Object.values(unitStruct).forEach(unit => {
      if (unit.jobs && Array.isArray(unit.jobs)) {
        unit.jobs.forEach(job => {
          if (job && typeof job === 'string' && job.trim()) roleTitles.add(job.trim());
        });
      }
      if (unit.subUnits && typeof unit.subUnits === 'object') {
        Object.values(unit.subUnits).forEach(subJobs => {
          if (Array.isArray(subJobs)) {
            subJobs.forEach(job => {
              if (job && typeof job === 'string' && job.trim()) roleTitles.add(job.trim());
            });
          }
        });
      }
    });
  } catch {}

  // 4. From active personnel job titles
  personnel.forEach(p => {
    if (p.jobTitle && p.jobTitle.trim()) {
      roleTitles.add(p.jobTitle.trim());
    }
  });

  const rolesList: DynamicOrgRole[] = Array.from(roleTitles).map((jobTitle, idx) => {
    const norm = jobTitle.toLowerCase().trim();
    // Count active users or active personnel having this job title/role
    const matchedUsersCount = users.filter(u => {
      const uJob = (u.jobTitle || '').toLowerCase().trim();
      const uRole = (u.role || '').toLowerCase().trim();
      return uJob === norm || uRole === norm || uJob.includes(norm);
    }).length;

    const matchedPersonnelCount = personnel.filter(p => {
      const pJob = (p.jobTitle || '').toLowerCase().trim();
      return pJob === norm || pJob.includes(norm);
    }).length;

    const activeCount = Math.max(matchedUsersCount, matchedPersonnelCount);

    return {
      id: jobTitle,
      titleFa: jobTitle,
      descFa: `شغل و نقش سازمانی تعریف‌شده در واحدها و مشاغل عملیاتی`,
      activeCount
    };
  });

  return rolesList;
}

/**
 * Returns departments dynamically and exclusively extracted from:
 * 1. "ساختار و چارت سازمانی" (Organizational Structure & Chart: hse_org_nodes)
 * 2. "واحدها و مشاغل عملیاتی" (Operational Units & Sub-Units: hse_unit_structure_v1)
 * Automatically updates whenever chart nodes or units are added, renamed, or modified.
 */
export function getDepartmentsWithActiveCount(): DynamicOrgDepartment[] {
  const users = getActiveApproverUsers();
  const personnel = getComplexPersonnelList().filter(p => p.status !== 'inactive');

  const deptMap = new Map<string, { id: string; name: string; code: string; manager: string }>();

  const normalizeKey = (str: string) => {
    return normalizeForMatching(str).replace(/[()]/g, '').trim();
  };

  // 1. Extract from "ساختار و چارت سازمانی" (hse_org_nodes)
  const orgNodes = getStoredOrgNodes();
  orgNodes.forEach((node, idx) => {
    if (node.name && node.name.trim()) {
      const name = node.name.trim();
      const key = normalizeKey(name);
      if (!deptMap.has(key)) {
        deptMap.set(key, {
          id: node.id || `node-${idx}`,
          name: name,
          code: node.code || `ORG-${idx + 1}`,
          manager: node.manager || ''
        });
      }
    }
  });

  // 2. Extract from "واحدها و مشاغل عملیاتی" (hse_unit_structure_v1)
  try {
    const unitStruct = getOrgUnitsStructure();
    Object.entries(unitStruct).forEach(([unitName, detail], idx) => {
      if (unitName && unitName.trim()) {
        const name = unitName.trim();
        const key = normalizeKey(name);
        if (!deptMap.has(key)) {
          deptMap.set(key, {
            id: `unit-${idx}`,
            name: name,
            code: (detail as any)?.code || `UNIT-${idx + 1}`,
            manager: (detail as any)?.manager || ''
          });
        }
      }
      if (detail && detail.subUnits && typeof detail.subUnits === 'object') {
        Object.entries(detail.subUnits).forEach(([subName, subJobs], sIdx) => {
          if (subName && subName.trim()) {
            const sName = subName.trim();
            const sKey = normalizeKey(sName);
            if (!deptMap.has(sKey)) {
              deptMap.set(sKey, {
                id: `subunit-${idx}-${sIdx}`,
                name: sName,
                code: `SUB-${idx + 1}-${sIdx + 1}`,
                manager: ''
              });
            }
          }
        });
      }
    });
  } catch {}

  // Compute active member count for each department
  const result: DynamicOrgDepartment[] = Array.from(deptMap.values()).map(dept => {
    const deptNorm = normalizeKey(dept.name);

    const userCount = users.filter(u => {
      const uDept = normalizeKey(u.department || '');
      return uDept.includes(deptNorm) || deptNorm.includes(uDept) || u.department === dept.id;
    }).length;

    const personnelCount = personnel.filter(p => {
      const pDept = normalizeKey(p.department || '');
      const pUnit = normalizeKey(p.unit || '');
      const pSec = normalizeKey(p.section || '');
      const pMgmt = normalizeKey(p.management || '');
      return pDept.includes(deptNorm) || deptNorm.includes(pDept) ||
             pUnit.includes(deptNorm) || deptNorm.includes(pUnit) ||
             pSec.includes(deptNorm) || deptNorm.includes(pSec) ||
             pMgmt.includes(deptNorm) || deptNorm.includes(pMgmt);
    }).length;

    const activeCount = Math.max(userCount, personnelCount);

    return {
      ...dept,
      activeCount
    };
  });

  return result;
}

/**
 * Synchronizes steps with BPMN Modeler elements
 */
export function extractStepsFromBpmnModeler(
  modeler: any,
  existingSteps: WorkflowStep[] = []
): WorkflowStep[] {
  if (!modeler) return existingSteps;
  try {
    const elementRegistry = modeler.get('elementRegistry');
    if (!elementRegistry) return existingSteps;

    const allElements = elementRegistry.getAll();
    const taskElements = allElements.filter((e: any) => 
      e.type && (e.type.includes('Task') || e.type === 'bpmn:UserTask' || e.type === 'bpmn:ServiceTask')
    );

    const existingMap = new Map<string, WorkflowStep>();
    existingSteps.forEach(s => existingMap.set(s.id, s));

    const updatedSteps: WorkflowStep[] = taskElements.map((elem: any, idx: number) => {
      const id = elem.id;
      const name = elem.businessObject?.name?.trim() || `مرحله ${idx + 1}`;
      const existing = existingMap.get(id);

      if (existing) {
        return {
          ...existing,
          titleFa: name,
          titleEn: existing.titleEn || `Step ${idx + 1}`
        };
      }

      // Default initial approver configuration
      return {
        id,
        titleFa: name,
        titleEn: `Step ${idx + 1}`,
        assignedRole: 'SafetyInspector',
        actionType: 'approval',
        slaHours: 8,
        assigneeType: 'role',
        assignedRoleName: 'کارشناس / بازرس ایمنی',
        approvalLogic: 'all',
        assignedUserIds: [],
        assignedUsers: []
      };
    });

    return updatedSteps;
  } catch (err) {
    console.error('Error extracting steps from BPMN modeler', err);
    return existingSteps;
  }
}

