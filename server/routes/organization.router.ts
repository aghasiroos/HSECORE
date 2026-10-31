import { Router, Request } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pool, db } from '../../src/db/index.ts';
import {
  systemSettings,
  personnel,
  auditLogs,
} from '../../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger } from '../core/logger.ts';
import { requireAuth, requireRole } from '../core/middleware/auth.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { getBackupDirectory } from '../services/backup.service.ts';

export const organizationRouter = Router();

export type OrgSubTabKey = 'org_hierarchy' | 'units_jobs' | 'incident_types' | 'ppe_equipment';

export interface OrgBackupMetadata {
  backupId: string;
  schemaFormat: 'HSE_ORG_BACKUP_V2';
  schemaVersion: '2.0.0';
  appVersion: string;
  createdAt: string;
  persianDate: string;
  tag: 'manual' | 'pre_restore_safety' | 'auto_snapshot';
  createdBy: {
    username: string;
    fullName: string;
    role: string;
  };
  includedSubTabs: OrgSubTabKey[];
  counts: {
    orgNodes: number;
    managersLinked: number;
    operationalUnits: number;
    operationalSubUnits: number;
    jobTitles: number;
    incidentTypes: number;
    ppeCategories: number;
    ppeItems: number;
    relationalCompanies: number;
    relationalSites: number;
    relationalDepartments: number;
    relationalUnits: number;
    relationalPositions: number;
  };
  payloadSha256: string;
}

function normalizeFaText(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function formatPersianNow(date = new Date()): string {
  try {
    return `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString('fa-IR')}`;
  } catch {
    return date.toISOString();
  }
}

function sha256Hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function extractOperator(req: Request) {
  return {
    username: req.user?.username || 'admin',
    fullName: req.user?.name || req.user?.username || 'مدیر سیستم',
    role: req.user?.role || 'ADMIN',
  };
}

async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
  if (rows.length > 0 && rows[0].value !== null && rows[0].value !== undefined) {
    return rows[0].value as T;
  }
  return fallback;
}

async function saveSettingValue(key: string, value: any): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

async function logOrgAudit(
  username: string,
  action: string,
  entityId: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action,
      entityType: 'ORG_STRUCTURE_BACKUP_RESTORE',
      entityId,
      newValue: {
        username,
        timestamp: new Date().toISOString(),
        ...details,
      },
      ipAddress: '127.0.0.1',
    });
  } catch (e) {
    logger.warn('Failed to write org backup audit log:', e);
  }
}

/**
 * Topologically sorts OrgNodes so parents always precede children,
 * breaks any circular parentId loops, and deduplicates nodes by id / code / (parentId + name).
 */
export function sanitizeAndSortOrgNodesTopologically(
  rawNodes: any[],
  personnelList: any[]
): {
  sortedNodes: any[];
  duplicatesRemoved: number;
  orphanParentsFixed: number;
  cyclesBroken: number;
  managersResolved: number;
} {
  if (!Array.isArray(rawNodes)) {
    return {
      sortedNodes: [],
      duplicatesRemoved: 0,
      orphanParentsFixed: 0,
      cyclesBroken: 0,
      managersResolved: 0,
    };
  }

  const pByCode = new Map<string, any>();
  const pById = new Map<number, any>();
  const pByName = new Map<string, any>();
  for (const p of personnelList) {
    if (p.personnel_code || p.personnelCode) {
      pByCode.set(String(p.personnel_code || p.personnelCode).trim(), p);
    }
    if (p.id) {
      pById.set(Number(p.id), p);
    }
    const fullName = `${p.first_name || p.firstName || ''} ${p.last_name || p.lastName || ''}`.trim();
    if (fullName) {
      pByName.set(normalizeFaText(fullName), p);
    }
  }

  // Step 1: Deduplicate by ID and by (parentId + normalized name)
  const byId = new Map<string, any>();
  const seenParentAndName = new Set<string>();
  const seenCode = new Set<string>();
  let duplicatesRemoved = 0;
  let managersResolved = 0;

  for (const item of rawNodes) {
    if (!item || typeof item !== 'object') continue;
    const name = String(item.name || '').trim();
    if (!name) continue;

    const id = String(item.id || `org-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim();
    const parentKey = item.parentId ? String(item.parentId).trim() : 'ROOT';
    const nameKey = `${parentKey}:::${normalizeFaText(name)}`;

    if (byId.has(id) || seenParentAndName.has(nameKey)) {
      duplicatesRemoved++;
      continue;
    }

    let code = String(item.code || `ORG-${id.slice(-4).toUpperCase()}`).trim();
    if (seenCode.has(code.toLowerCase())) {
      code = `${code}-${byId.size + 1}`;
    }
    seenCode.add(code.toLowerCase());
    seenParentAndName.add(nameKey);

    // Resolve manager against live personnel database
    const linkedPersonnel =
      (item.managerPersonnelCode && pByCode.get(String(item.managerPersonnelCode).trim())) ||
      (item.managerPersonnelId && pById.get(Number(item.managerPersonnelId))) ||
      (item.manager && pByName.get(normalizeFaText(item.manager)));

    const cleanNode: any = {
      ...item,
      id,
      name,
      nameEn: item.nameEn ? String(item.nameEn).trim() : '',
      type: ['Company', 'Site', 'Plant', 'Area', 'Department', 'Section', 'Team'].includes(item.type)
        ? item.type
        : 'Department',
      parentId: item.parentId ? String(item.parentId).trim() : null,
      code,
      status: ['active', 'inactive', 'commissioning'].includes(item.status) ? item.status : 'active',
      headcount: Number(item.headcount) || 0,
      location: item.location ? String(item.location).trim() : '',
      costCenter: item.costCenter ? String(item.costCenter).trim() : '',
      description: item.description ? String(item.description).trim() : '',
      createdAt: item.createdAt || formatPersianNow().split(' ')[0],
    };

    if (linkedPersonnel) {
      const pFullName = `${linkedPersonnel.first_name || linkedPersonnel.firstName || ''} ${
        linkedPersonnel.last_name || linkedPersonnel.lastName || ''
      }`.trim();
      cleanNode.manager = pFullName || cleanNode.manager || '';
      cleanNode.managerPersonnelId = Number(linkedPersonnel.id);
      cleanNode.managerPersonnelCode =
        linkedPersonnel.personnel_code || linkedPersonnel.personnelCode || '';
      cleanNode.managerJobTitle =
        linkedPersonnel.job_title || linkedPersonnel.jobTitle || cleanNode.managerJobTitle || '';
      cleanNode.managerNationalCode =
        linkedPersonnel.national_code || linkedPersonnel.nationalCode || cleanNode.managerNationalCode || '';
      cleanNode.managerStatus = linkedPersonnel.status || 'ACTIVE';
      managersResolved++;
    }

    byId.set(id, cleanNode);
  }

  // Step 2: Fix orphan parentIds and break circular references
  let orphanParentsFixed = 0;
  let cyclesBroken = 0;

  for (const node of byId.values()) {
    if (node.parentId && !byId.has(node.parentId)) {
      // Try matching parent by name if parentName exists
      const fallbackParent = node.parentName
        ? Array.from(byId.values()).find(
            (cand) => cand.id !== node.id && normalizeFaText(cand.name) === normalizeFaText(node.parentName)
          )
        : undefined;
      node.parentId = fallbackParent ? fallbackParent.id : null;
      orphanParentsFixed++;
    }
  }

  // Detect and break cycles
  for (const node of byId.values()) {
    const visited = new Set<string>([node.id]);
    let curr = node;
    while (curr.parentId) {
      if (visited.has(curr.parentId)) {
        curr.parentId = null;
        cyclesBroken++;
        break;
      }
      visited.add(curr.parentId);
      const nextParent = byId.get(curr.parentId);
      if (!nextParent) break;
      curr = nextParent;
    }
  }

  // Step 3: Topological sort (parents before children)
  const sortedNodes: any[] = [];
  const emittedIds = new Set<string>();
  const allNodes = Array.from(byId.values());

  let progress = true;
  while (sortedNodes.length < allNodes.length && progress) {
    progress = false;
    for (const node of allNodes) {
      if (emittedIds.has(node.id)) continue;
      if (!node.parentId || emittedIds.has(node.parentId)) {
        emittedIds.add(node.id);
        sortedNodes.push(node);
        progress = true;
      }
    }
  }

  for (const node of allNodes) {
    if (!emittedIds.has(node.id)) {
      node.parentId = null;
      sortedNodes.push(node);
    }
  }

  return {
    sortedNodes,
    duplicatesRemoved,
    orphanParentsFixed,
    cyclesBroken,
    managersResolved,
  };
}

/**
 * Synchronizes OrgNodes, Operational Units Structure, and Job Titles into the relational PostgreSQL tables
 * (`org_companies`, `org_sites`, `org_departments`, `org_units`, `org_positions`) inside an active DB client/transaction.
 */
async function syncRelationalOrgTablesInTx(
  client: any,
  orgNodes: any[],
  orgStructure: Record<string, { jobs: string[]; subUnits: Record<string, string[]> }>,
  jobTitles: string[]
) {
  // 1. Sync org_companies
  const companies = orgNodes.filter((n) => n.type === 'Company');
  const companyDbIdByNodeId = new Map<string, number>();
  let defaultCompanyId: number | null = null;

  for (const comp of companies) {
    const code = String(comp.code || `COMP-${comp.id}`).trim();
    const res = await client.query(
      `INSERT INTO "public"."org_companies" ("name", "code", "description")
       VALUES ($1, $2, $3)
       ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description"
       RETURNING "id"`,
      [comp.name, code, comp.description || null]
    );
    const dbId = res.rows[0]?.id;
    if (dbId) {
      companyDbIdByNodeId.set(comp.id, dbId);
      if (!defaultCompanyId) defaultCompanyId = dbId;
    }
  }

  if (!defaultCompanyId) {
    const existingComp = await client.query(`SELECT "id" FROM "public"."org_companies" ORDER BY "id" ASC LIMIT 1`);
    defaultCompanyId = existingComp.rows[0]?.id || null;
  }

  // 2. Sync org_sites
  const sites = orgNodes.filter((n) => n.type === 'Site');
  const siteDbIdByNodeId = new Map<string, number>();
  let defaultSiteId: number | null = null;

  for (const site of sites) {
    const code = String(site.code || `SITE-${site.id}`).trim();
    const parentCompanyId =
      (site.parentId && companyDbIdByNodeId.get(site.parentId)) || defaultCompanyId;
    const existing = await client.query(
      `SELECT "id" FROM "public"."org_sites" WHERE "code" = $1 OR LOWER("name") = LOWER($2) LIMIT 1`,
      [code, site.name]
    );
    let dbId: number;
    if (existing.rows.length > 0) {
      dbId = existing.rows[0].id;
      await client.query(
        `UPDATE "public"."org_sites" SET "name" = $1, "code" = $2, "location" = $3, "company_id" = COALESCE($4, "company_id") WHERE "id" = $5`,
        [site.name, code, site.location || null, parentCompanyId, dbId]
      );
    } else {
      const ins = await client.query(
        `INSERT INTO "public"."org_sites" ("company_id", "name", "code", "location") VALUES ($1, $2, $3, $4) RETURNING "id"`,
        [parentCompanyId, site.name, code, site.location || null]
      );
      dbId = ins.rows[0]?.id;
    }
    if (dbId) {
      siteDbIdByNodeId.set(site.id, dbId);
      if (!defaultSiteId) defaultSiteId = dbId;
    }
  }

  if (!defaultSiteId) {
    const existingSite = await client.query(`SELECT "id" FROM "public"."org_sites" ORDER BY "id" ASC LIMIT 1`);
    defaultSiteId = existingSite.rows[0]?.id || null;
  }

  // 3. Sync org_departments (Plants, Departments, Areas)
  const depts = orgNodes.filter((n) => ['Plant', 'Department', 'Area'].includes(n.type));
  const deptDbIdByNodeId = new Map<string, number>();
  const deptDbIdByName = new Map<string, number>();
  let defaultDeptId: number | null = null;

  for (const dept of depts) {
    const code = String(dept.code || `DEPT-${dept.id}`).trim();
    const parentSiteId = (dept.parentId && siteDbIdByNodeId.get(dept.parentId)) || defaultSiteId;
    const existing = await client.query(
      `SELECT "id" FROM "public"."org_departments" WHERE "code" = $1 OR LOWER("name") = LOWER($2) LIMIT 1`,
      [code, dept.name]
    );
    let dbId: number;
    if (existing.rows.length > 0) {
      dbId = existing.rows[0].id;
      await client.query(
        `UPDATE "public"."org_departments" SET "name" = $1, "code" = $2, "site_id" = COALESCE($3, "site_id") WHERE "id" = $4`,
        [dept.name, code, parentSiteId, dbId]
      );
    } else {
      const ins = await client.query(
        `INSERT INTO "public"."org_departments" ("site_id", "name", "code") VALUES ($1, $2, $3) RETURNING "id"`,
        [parentSiteId, dept.name, code]
      );
      dbId = ins.rows[0]?.id;
    }
    if (dbId) {
      deptDbIdByNodeId.set(dept.id, dbId);
      deptDbIdByName.set(normalizeFaText(dept.name), dbId);
      if (!defaultDeptId) defaultDeptId = dbId;
    }
  }

  // Also ensure every main unit in orgStructure exists in org_departments or org_units
  for (const unitName of Object.keys(orgStructure || {})) {
    const norm = normalizeFaText(unitName);
    if (!norm || deptDbIdByName.has(norm)) continue;
    const existing = await client.query(
      `SELECT "id" FROM "public"."org_departments" WHERE LOWER("name") = LOWER($1) LIMIT 1`,
      [unitName.trim()]
    );
    if (existing.rows.length > 0) {
      deptDbIdByName.set(norm, existing.rows[0].id);
    } else {
      const code = `UNIT-${Math.abs(
        unitName.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) % 9000
      ) + 1000}`;
      const ins = await client.query(
        `INSERT INTO "public"."org_departments" ("site_id", "name", "code") VALUES ($1, $2, $3) RETURNING "id"`,
        [defaultSiteId, unitName.trim(), code]
      );
      if (ins.rows[0]?.id) {
        deptDbIdByName.set(norm, ins.rows[0].id);
      }
    }
  }

  // 4. Sync org_units (Sections, Teams, and Sub-units)
  const sections = orgNodes.filter((n) => ['Section', 'Team'].includes(n.type));
  for (const sec of sections) {
    const code = String(sec.code || `SEC-${sec.id}`).trim();
    const deptId = (sec.parentId && deptDbIdByNodeId.get(sec.parentId)) || defaultDeptId;
    const existing = await client.query(
      `SELECT "id" FROM "public"."org_units" WHERE "code" = $1 OR LOWER("name") = LOWER($2) LIMIT 1`,
      [code, sec.name]
    );
    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE "public"."org_units" SET "name" = $1, "code" = $2, "department_id" = COALESCE($3, "department_id") WHERE "id" = $4`,
        [sec.name, code, deptId, existing.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO "public"."org_units" ("department_id", "name", "code") VALUES ($1, $2, $3)`,
        [deptId, sec.name, code]
      );
    }
  }

  // 5. Sync org_positions from jobTitles and unit structure jobs
  const allPositionTitles = new Set<string>();
  for (const jt of jobTitles || []) {
    if (jt && String(jt).trim()) allPositionTitles.add(String(jt).trim());
  }
  for (const u of Object.values(orgStructure || {})) {
    for (const j of u?.jobs || []) {
      if (j && String(j).trim()) allPositionTitles.add(String(j).trim());
    }
    for (const subJobs of Object.values(u?.subUnits || {})) {
      if (Array.isArray(subJobs)) {
        for (const sj of subJobs) {
          if (sj && String(sj).trim()) allPositionTitles.add(String(sj).trim());
        }
      }
    }
  }

  for (const title of allPositionTitles) {
    const existing = await client.query(
      `SELECT "id" FROM "public"."org_positions" WHERE LOWER("title") = LOWER($1) LIMIT 1`,
      [title]
    );
    if (existing.rows.length === 0) {
      const code = `POS-${Math.abs(
        title.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0) % 9000
      ) + 1000}`;
      await client.query(
        `INSERT INTO "public"."org_positions" ("title", "code", "risk_level") VALUES ($1, $2, 'MEDIUM')`,
        [title, code]
      );
    }
  }
}

// ============================================================================
// Standard /nodes GET and POST endpoints (Preserving existing behavior + sync)
// ============================================================================
organizationRouter.get('/nodes', requireAuth, async (_req, res) => {
  try {
    const records = await db.select().from(systemSettings).where(eq(systemSettings.key, 'org_nodes'));
    if (records.length > 0 && Array.isArray(records[0].value)) {
      const nodes = records[0].value as any[];
      try {
        const pList = await db.select().from(personnel);
        const pMapByCode = new Map<string, any>();
        const pMapById = new Map<number, any>();
        for (const p of pList) {
          if (p.personnelCode) pMapByCode.set(String(p.personnelCode).trim(), p);
          if (p.id) pMapById.set(p.id, p);
        }

        let hasUpdates = false;
        const syncedNodes = nodes.map((node) => {
          const linked =
            (node.managerPersonnelCode && pMapByCode.get(String(node.managerPersonnelCode).trim())) ||
            (node.managerPersonnelId && pMapById.get(Number(node.managerPersonnelId)));
          if (linked) {
            const currentFullName = `${linked.firstName || ''} ${linked.lastName || ''}`.trim();
            const currentJobTitle = linked.jobTitle || '';
            const currentNatCode = linked.nationalCode || '';
            const currentStatus = linked.status || 'ACTIVE';

            if (
              node.manager !== currentFullName ||
              node.managerJobTitle !== currentJobTitle ||
              node.managerNationalCode !== currentNatCode ||
              node.managerStatus !== currentStatus
            ) {
              hasUpdates = true;
              return {
                ...node,
                manager: currentFullName || node.manager,
                managerJobTitle: currentJobTitle || node.managerJobTitle,
                managerNationalCode: currentNatCode || node.managerNationalCode,
                managerStatus: currentStatus,
                managerPersonnelId: linked.id,
                managerPersonnelCode: linked.personnelCode,
              };
            }
          }
          return node;
        });

        if (hasUpdates) {
          db.update(systemSettings)
            .set({ value: syncedNodes, updatedAt: new Date() })
            .where(eq(systemSettings.key, 'org_nodes'))
            .catch((e) => logger.warn('Background sync org_nodes warning:', e));
        }

        return res.json({ success: true, data: syncedNodes });
      } catch (pErr) {
        logger.warn('Cross-reference personnel with org nodes error:', pErr);
        return res.json({ success: true, data: nodes });
      }
    } else {
      res.json({ success: true, data: [] });
    }
  } catch (err) {
    logger.error('Failed to get org nodes', err);
    res.status(500).json({ success: false, message: 'Failed to fetch org nodes' });
  }
});

organizationRouter.post(
  '/nodes',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN', 'MANAGER'),
  async (req, res) => {
    try {
      const value = req.body;
      if (!Array.isArray(value)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid payload: expected an array of organization nodes.' });
      }

      const pList = await db.select().from(personnel);
      const { sortedNodes } = sanitizeAndSortOrgNodesTopologically(value, pList);

      await saveSettingValue('org_nodes', sortedNodes);

      broadcastDataMutation('organization:nodes', 'update', sortedNodes);
      broadcastDataMutation('departments', 'update', sortedNodes);
      res.json({ success: true, message: 'Saved successfully', data: sortedNodes });
    } catch (err) {
      logger.error('Failed to save org nodes', err);
      res.status(500).json({ success: false, message: 'Failed to save org nodes' });
    }
  }
);

// ============================================================================
// Integrated Organizational Structure Backup, Inspection, Restore & Rollback
// ============================================================================

async function collectCurrentOrgModuleData(selectedSubTabs?: OrgSubTabKey[]) {
  const tabs: OrgSubTabKey[] =
    Array.isArray(selectedSubTabs) && selectedSubTabs.length > 0
      ? selectedSubTabs
      : ['org_hierarchy', 'units_jobs', 'incident_types', 'ppe_equipment'];

  const [
    orgNodesRaw,
    orgStructure,
    jobTitles,
    departments,
    incidentTypes,
    ppeCategories,
    ppeItems,
    relCompaniesRes,
    relSitesRes,
    relDeptsRes,
    relUnitsRes,
    relPositionsRes,
    pList,
  ] = await Promise.all([
    getSettingValue<any[]>('org_nodes', []),
    getSettingValue<Record<string, { jobs: string[]; subUnits: Record<string, string[]> }>>(
      'hse_unit_structure_v1',
      {}
    ),
    getSettingValue<string[]>('hse_org_jobs', []),
    getSettingValue<any[]>('departments', []),
    getSettingValue<any[]>('hse_incident_types_config', []),
    getSettingValue<any[]>('hse_ppe_categories', []),
    getSettingValue<any[]>('hse_ppe_items', []),
    pool.query(`SELECT * FROM "public"."org_companies" ORDER BY "id" ASC`),
    pool.query(`SELECT * FROM "public"."org_sites" ORDER BY "id" ASC`),
    pool.query(`SELECT * FROM "public"."org_departments" ORDER BY "id" ASC`),
    pool.query(`SELECT * FROM "public"."org_units" ORDER BY "id" ASC`),
    pool.query(`SELECT * FROM "public"."org_positions" ORDER BY "id" ASC`),
    db.select().from(personnel),
  ]);

  const { sortedNodes } = sanitizeAndSortOrgNodesTopologically(orgNodesRaw, pList);

  const subUnitsCount = Object.values(orgStructure || {}).reduce(
    (acc, u: any) => acc + Object.keys(u?.subUnits || {}).length,
    0
  );
  const managersLinked = sortedNodes.filter(
    (n) => Boolean(n.manager && String(n.manager).trim()) || Boolean(n.managerPersonnelCode)
  ).length;

  const dataPayload: Record<string, any> = {};
  if (tabs.includes('org_hierarchy')) {
    dataPayload.orgHierarchy = {
      orgNodes: sortedNodes,
      relationalTables: {
        org_companies: relCompaniesRes.rows,
        org_sites: relSitesRes.rows,
        org_departments: relDeptsRes.rows,
        org_units: relUnitsRes.rows,
      },
    };
  }
  if (tabs.includes('units_jobs')) {
    dataPayload.unitsAndJobs = {
      orgStructure: orgStructure || {},
      jobTitles: Array.isArray(jobTitles) ? jobTitles : [],
      departments: Array.isArray(departments) ? departments : [],
      relationalPositions: relPositionsRes.rows,
    };
  }
  if (tabs.includes('incident_types')) {
    dataPayload.incidentTypes = Array.isArray(incidentTypes) ? incidentTypes : [];
  }
  if (tabs.includes('ppe_equipment')) {
    dataPayload.ppeEquipment = {
      ppeCategories: Array.isArray(ppeCategories) ? ppeCategories : [],
      ppeItems: Array.isArray(ppeItems) ? ppeItems : [],
    };
  }

  return {
    tabs,
    dataPayload,
    counts: {
      orgNodes: sortedNodes.length,
      managersLinked,
      operationalUnits: Object.keys(orgStructure || {}).length,
      operationalSubUnits: subUnitsCount,
      jobTitles: Array.isArray(jobTitles) ? jobTitles.length : 0,
      incidentTypes: Array.isArray(incidentTypes) ? incidentTypes.length : 0,
      ppeCategories: Array.isArray(ppeCategories) ? ppeCategories.length : 0,
      ppeItems: Array.isArray(ppeItems) ? ppeItems.length : 0,
      relationalCompanies: relCompaniesRes.rows.length,
      relationalSites: relSitesRes.rows.length,
      relationalDepartments: relDeptsRes.rows.length,
      relationalUnits: relUnitsRes.rows.length,
      relationalPositions: relPositionsRes.rows.length,
    },
  };
}

async function createOrgBackupSnapshotInternal(options: {
  operator: { username: string; fullName: string; role: string };
  tag: 'manual' | 'pre_restore_safety' | 'auto_snapshot';
  selectedSubTabs?: OrgSubTabKey[];
}) {
  const { tabs, dataPayload, counts } = await collectCurrentOrgModuleData(options.selectedSubTabs);
  const now = new Date();
  const persianDate = formatPersianNow(now);
  const backupId = `org_${options.tag}_${now.toISOString().replace(/[:.]/g, '-')}`;

  const canonicalPayloadStr = JSON.stringify(dataPayload);
  const payloadSha256 = sha256Hex(canonicalPayloadStr);

  const metadata: OrgBackupMetadata = {
    backupId,
    schemaFormat: 'HSE_ORG_BACKUP_V2',
    schemaVersion: '2.0.0',
    appVersion: process.env.APP_VERSION || '0.2.8',
    createdAt: now.toISOString(),
    persianDate,
    tag: options.tag,
    createdBy: options.operator,
    includedSubTabs: tabs,
    counts,
    payloadSha256,
  };

  const fullPackage = {
    metadata,
    data: dataPayload,
  };

  // Save snapshot on disk in backup directory
  try {
    const dir = getBackupDirectory();
    const filePath = path.join(dir, `${backupId}.orgbackup.json`);
    fs.writeFileSync(filePath, JSON.stringify(fullPackage, null, 2), { mode: 0o600 });
  } catch (e) {
    logger.warn('Failed to write org backup file to disk:', e);
  }

  // Also keep recent snapshots in system_settings (`hse_org_backups_v2`) for fast cross-browser access & rollback
  const existingSnapshots = await getSettingValue<any[]>('hse_org_backups_v2', []);
  const updatedSnapshots = [
    {
      metadata,
      data: dataPayload,
    },
    ...(Array.isArray(existingSnapshots) ? existingSnapshots : []),
  ].slice(0, 20);
  await saveSettingValue('hse_org_backups_v2', updatedSnapshots);

  return fullPackage;
}

/**
 * Normalizes any uploaded JSON (either full HSE_ORG_BACKUP_V2 package or legacy raw OrgNode[] array)
 */
function parseAndNormalizeOrgBackupInput(rawInput: any): {
  validFormat: boolean;
  checksumValid: boolean;
  computedSha256: string;
  expectedSha256: string;
  availableSubTabs: OrgSubTabKey[];
  metadata: Partial<OrgBackupMetadata>;
  data: {
    orgNodes: any[];
    orgStructure: Record<string, { jobs: string[]; subUnits: Record<string, string[]> }>;
    jobTitles: string[];
    departments: any[];
    incidentTypes: any[];
    ppeCategories: any[];
    ppeItems: any[];
  };
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawInput || typeof rawInput !== 'object') {
    return {
      validFormat: false,
      checksumValid: false,
      computedSha256: '',
      expectedSha256: '',
      availableSubTabs: [],
      metadata: {},
      data: {
        orgNodes: [],
        orgStructure: {},
        jobTitles: [],
        departments: [],
        incidentTypes: [],
        ppeCategories: [],
        ppeItems: [],
      },
      errors: ['ساختار فایل پشتیبان نامعتبر است یا فایل JSON قابل خواندن نیست.'],
      warnings: [],
    };
  }

  // Case 1: Standard HSE_ORG_BACKUP_V2 package
  if (rawInput.metadata && rawInput.data && typeof rawInput.data === 'object') {
    const canonicalStr = JSON.stringify(rawInput.data);
    const computedSha256 = sha256Hex(canonicalStr);
    const expectedSha256 = rawInput.metadata.payloadSha256 || computedSha256;
    const checksumValid = computedSha256.toLowerCase() === expectedSha256.toLowerCase();

    if (!checksumValid) {
      errors.push(
        `عدم تطابق هش رمزنگاری‌شده SHA-256 محتوای پشتیبان ساختار سازمانی (احتمال دستکاری یا خرابی فایل).`
      );
    }

    const d = rawInput.data;
    const availableSubTabs: OrgSubTabKey[] = [];
    if (d.orgHierarchy && Array.isArray(d.orgHierarchy.orgNodes)) {
      availableSubTabs.push('org_hierarchy');
    }
    if (d.unitsAndJobs && typeof d.unitsAndJobs === 'object') {
      availableSubTabs.push('units_jobs');
    }
    if (Array.isArray(d.incidentTypes)) {
      availableSubTabs.push('incident_types');
    }
    if (d.ppeEquipment && typeof d.ppeEquipment === 'object') {
      availableSubTabs.push('ppe_equipment');
    }

    if (availableSubTabs.length === 0) {
      errors.push('هیچ زیرتب معتبری در فایل پشتیبان ساختار سازمانی یافت نشد.');
    }

    return {
      validFormat: errors.length === 0,
      checksumValid,
      computedSha256,
      expectedSha256,
      availableSubTabs,
      metadata: rawInput.metadata,
      data: {
        orgNodes: Array.isArray(d.orgHierarchy?.orgNodes) ? d.orgHierarchy.orgNodes : [],
        orgStructure:
          d.unitsAndJobs?.orgStructure && typeof d.unitsAndJobs.orgStructure === 'object'
            ? d.unitsAndJobs.orgStructure
            : {},
        jobTitles: Array.isArray(d.unitsAndJobs?.jobTitles) ? d.unitsAndJobs.jobTitles : [],
        departments: Array.isArray(d.unitsAndJobs?.departments) ? d.unitsAndJobs.departments : [],
        incidentTypes: Array.isArray(d.incidentTypes) ? d.incidentTypes : [],
        ppeCategories: Array.isArray(d.ppeEquipment?.ppeCategories)
          ? d.ppeEquipment.ppeCategories
          : [],
        ppeItems: Array.isArray(d.ppeEquipment?.ppeItems) ? d.ppeEquipment.ppeItems : [],
      },
      errors,
      warnings,
    };
  }

  // Case 2: Legacy raw array of OrgNode[] (exported by old button)
  if (Array.isArray(rawInput)) {
    const computedSha256 = sha256Hex(JSON.stringify(rawInput));
    warnings.push(
      'فایل بارگذاری‌شده در قالب قدیمی (فقط چارت سازمانی بدون امضای SHA-256) است؛ اعتبارسنجی سلسله‌مراتبی و کدهای یکتا روی آن اعمال شد.'
    );
    return {
      validFormat: rawInput.length > 0,
      checksumValid: true,
      computedSha256,
      expectedSha256: computedSha256,
      availableSubTabs: ['org_hierarchy'],
      metadata: {
        backupId: `legacy_org_${Date.now()}`,
        schemaFormat: 'HSE_ORG_BACKUP_V2',
        schemaVersion: '2.0.0',
        persianDate: formatPersianNow(),
        includedSubTabs: ['org_hierarchy'],
      },
      data: {
        orgNodes: rawInput,
        orgStructure: {},
        jobTitles: [],
        departments: [],
        incidentTypes: [],
        ppeCategories: [],
        ppeItems: [],
      },
      errors: rawInput.length === 0 ? ['آرایه گره‌های سازمانی در فایل انتخاب‌شده خالی است.'] : [],
      warnings,
    };
  }

  return {
    validFormat: false,
    checksumValid: false,
    computedSha256: '',
    expectedSha256: '',
    availableSubTabs: [],
    metadata: {},
    data: {
      orgNodes: [],
      orgStructure: {},
      jobTitles: [],
      departments: [],
      incidentTypes: [],
      ppeCategories: [],
      ppeItems: [],
    },
    errors: ['قالب فایل انتخابی با ساختار پشتیبان ماژول ساختار سازمانی سازگار نیست.'],
    warnings: [],
  };
}

/**
 * GET /api/v1/organization/backup/overview
 * Returns live counts across all 4 sub-tabs, relational table counts, saved server snapshots, and audit history
 */
organizationRouter.get('/backup/overview', requireAuth, async (_req, res) => {
  try {
    const [{ counts }, savedSnapshots] = await Promise.all([
      collectCurrentOrgModuleData(),
      getSettingValue<any[]>('hse_org_backups_v2', []),
    ]);

    const snapshotSummaries = (Array.isArray(savedSnapshots) ? savedSnapshots : []).map(
      (s: any) => s.metadata
    );

    res.json({
      success: true,
      data: {
        liveCounts: counts,
        snapshots: snapshotSummaries,
      },
    });
  } catch (err: any) {
    logger.error('[OrgBackup] Overview error:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'خطا در دریافت اطلاعات پشتیبان‌گیری ساختار سازمانی',
    });
  }
});

/**
 * POST /api/v1/organization/backup/create
 * Creates a full or selective backup of the Organizational Structure module and all its sub-tabs
 */
organizationRouter.post(
  '/backup/create',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN', 'MANAGER'),
  async (req: Request, res) => {
    try {
      const operator = extractOperator(req);
      const selectedSubTabs: OrgSubTabKey[] | undefined = Array.isArray(req.body?.selectedSubTabs)
        ? req.body.selectedSubTabs
        : undefined;

      const pkg = await createOrgBackupSnapshotInternal({
        operator,
        tag: 'manual',
        selectedSubTabs,
      });

      await logOrgAudit(
        operator.username,
        `تهیه نسخه پشتیبان ماژول ساختار سازمانی (${pkg.metadata.includedSubTabs.join(', ')})`,
        pkg.metadata.backupId,
        {
          includedSubTabs: pkg.metadata.includedSubTabs,
          counts: pkg.metadata.counts,
          payloadSha256: pkg.metadata.payloadSha256,
        }
      );

      res.json({
        success: true,
        data: pkg,
      });
    } catch (err: any) {
      logger.error('[OrgBackup] Create error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'خطا در تهیه نسخه پشتیبان ساختار سازمانی',
      });
    }
  }
);

/**
 * GET /api/v1/organization/backup/snapshot/:backupId
 * Downloads a specific saved snapshot JSON package
 */
organizationRouter.get('/backup/snapshot/:backupId', requireAuth, async (req, res) => {
  try {
    const targetId = String(req.params.backupId || '').trim();
    const savedSnapshots = await getSettingValue<any[]>('hse_org_backups_v2', []);
    const found = (Array.isArray(savedSnapshots) ? savedSnapshots : []).find(
      (s: any) => s?.metadata?.backupId === targetId
    );
    if (!found) {
      return res.status(404).json({ success: false, error: 'نسخه پشتیبان مورد نظر یافت نشد.' });
    }
    res.json({ success: true, data: found });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'خطا در دریافت نسخه پشتیبان' });
  }
});

/**
 * POST /api/v1/organization/backup/inspect
 * Validates an uploaded or server-stored Org backup package and produces a detailed Pre-Restore Preview & Diff report
 */
organizationRouter.post(
  '/backup/inspect',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN', 'MANAGER'),
  async (req: Request, res) => {
    try {
      let rawPackage = req.body?.backupPackage;
      if (!rawPackage && req.body?.backupId) {
        const savedSnapshots = await getSettingValue<any[]>('hse_org_backups_v2', []);
        rawPackage = (Array.isArray(savedSnapshots) ? savedSnapshots : []).find(
          (s: any) => s?.metadata?.backupId === req.body.backupId
        );
      }

      const parsed = parseAndNormalizeOrgBackupInput(rawPackage);
      if (!parsed.validFormat) {
        return res.status(400).json({
          success: false,
          error: parsed.errors.join(' | ') || 'فایل پشتیبان نامعتبر است.',
          data: parsed,
        });
      }

      // Compare against live database to build pre-restore preview
      const [
        liveNodes,
        liveStructure,
        liveJobs,
        liveIncidentTypes,
        livePpeCategories,
        livePpeItems,
        pList,
      ] = await Promise.all([
        getSettingValue<any[]>('org_nodes', []),
        getSettingValue<Record<string, { jobs: string[]; subUnits: Record<string, string[]> }>>(
          'hse_unit_structure_v1',
          {}
        ),
        getSettingValue<string[]>('hse_org_jobs', []),
        getSettingValue<any[]>('hse_incident_types_config', []),
        getSettingValue<any[]>('hse_ppe_categories', []),
        getSettingValue<any[]>('hse_ppe_items', []),
        db.select().from(personnel),
      ]);

      const topoCheck = sanitizeAndSortOrgNodesTopologically(parsed.data.orgNodes, pList);

      // Compute diff for Sub-Tab 1: Org Hierarchy
      const liveNodeIds = new Set(liveNodes.map((n: any) => String(n.id)));
      const liveNodeNames = new Set(liveNodes.map((n: any) => normalizeFaText(n.name)));
      let newOrgNodesCount = 0;
      let existingOrgNodesCount = 0;
      for (const n of topoCheck.sortedNodes) {
        if (liveNodeIds.has(String(n.id)) || liveNodeNames.has(normalizeFaText(n.name))) {
          existingOrgNodesCount++;
        } else {
          newOrgNodesCount++;
        }
      }

      // Compute diff for Sub-Tab 2: Units & Operational Jobs
      const incomingUnits = Object.keys(parsed.data.orgStructure || {});
      const liveUnitNames = new Set(Object.keys(liveStructure || {}).map(normalizeFaText));
      let newUnitsCount = 0;
      let existingUnitsCount = 0;
      let incomingSubUnitsCount = 0;
      for (const uName of incomingUnits) {
        if (liveUnitNames.has(normalizeFaText(uName))) {
          existingUnitsCount++;
        } else {
          newUnitsCount++;
        }
        incomingSubUnitsCount += Object.keys(parsed.data.orgStructure[uName]?.subUnits || {}).length;
      }

      const liveJobsNorm = new Set((liveJobs || []).map(normalizeFaText));
      const uniqueIncomingJobs = Array.from(
        new Set((parsed.data.jobTitles || []).map((j) => String(j).trim()).filter(Boolean))
      );
      const newJobsCount = uniqueIncomingJobs.filter((j) => !liveJobsNorm.has(normalizeFaText(j))).length;

      // Compute diff for Sub-Tab 3: Incident Types
      const liveIncNorm = new Set((liveIncidentTypes || []).map((i: any) => normalizeFaText(i.titleFa)));
      const newIncTypesCount = (parsed.data.incidentTypes || []).filter(
        (i: any) => i?.titleFa && !liveIncNorm.has(normalizeFaText(i.titleFa))
      ).length;

      // Compute diff for Sub-Tab 4: PPE Categories & Items
      const livePpeCatNorm = new Set((livePpeCategories || []).map((c: any) => normalizeFaText(c.nameFa)));
      const newPpeCatCount = (parsed.data.ppeCategories || []).filter(
        (c: any) => c?.nameFa && !livePpeCatNorm.has(normalizeFaText(c.nameFa))
      ).length;

      const livePpeItemNorm = new Set((livePpeItems || []).map((i: any) => normalizeFaText(i.nameFa)));
      const newPpeItemCount = (parsed.data.ppeItems || []).filter(
        (i: any) => i?.nameFa && !livePpeItemNorm.has(normalizeFaText(i.nameFa))
      ).length;

      res.json({
        success: true,
        data: {
          valid: parsed.validFormat && parsed.checksumValid,
          checksumValid: parsed.checksumValid,
          computedSha256: parsed.computedSha256,
          expectedSha256: parsed.expectedSha256,
          metadata: parsed.metadata,
          availableSubTabs: parsed.availableSubTabs,
          warnings: parsed.warnings,
          errors: parsed.errors,
          integrityChecks: {
            topologicalOrderVerified: true,
            duplicatesPrevented: topoCheck.duplicatesRemoved,
            orphanParentsHealed: topoCheck.orphanParentsFixed,
            circularReferencesBroken: topoCheck.cyclesBroken,
            managersLinkedToPersonnelDb: topoCheck.managersResolved,
          },
          subTabPreview: {
            org_hierarchy: {
              available: parsed.availableSubTabs.includes('org_hierarchy'),
              totalInBackup: topoCheck.sortedNodes.length,
              currentInDb: liveNodes.length,
              newItemsToAdd: newOrgNodesCount,
              existingItemsToMatchOrUpdate: existingOrgNodesCount,
              managersLinked: topoCheck.managersResolved,
            },
            units_jobs: {
              available: parsed.availableSubTabs.includes('units_jobs'),
              unitsInBackup: incomingUnits.length,
              subUnitsInBackup: incomingSubUnitsCount,
              jobsInBackup: uniqueIncomingJobs.length,
              currentUnitsInDb: Object.keys(liveStructure || {}).length,
              currentJobsInDb: (liveJobs || []).length,
              newUnitsToAdd: newUnitsCount,
              existingUnitsToMerge: existingUnitsCount,
              newJobsToAdd: newJobsCount,
            },
            incident_types: {
              available: parsed.availableSubTabs.includes('incident_types'),
              totalInBackup: (parsed.data.incidentTypes || []).length,
              currentInDb: (liveIncidentTypes || []).length,
              newItemsToAdd: newIncTypesCount,
            },
            ppe_equipment: {
              available: parsed.availableSubTabs.includes('ppe_equipment'),
              categoriesInBackup: (parsed.data.ppeCategories || []).length,
              itemsInBackup: (parsed.data.ppeItems || []).length,
              currentCategoriesInDb: (livePpeCategories || []).length,
              currentItemsInDb: (livePpeItems || []).length,
              newCategoriesToAdd: newPpeCatCount,
              newItemsToAdd: newPpeItemCount,
            },
          },
        },
      });
    } catch (err: any) {
      logger.error('[OrgBackup] Inspect error:', err);
      res.status(400).json({
        success: false,
        error: err?.message || 'خطا در اعتبارسنجی فایل پشتیبان ساختار سازمانی',
      });
    }
  }
);

/**
 * POST /api/v1/organization/backup/restore
 * Executes full or selective sub-tab restore with:
 * - Pre-flight validation
 * - Automatic pre-restore safety snapshot
 * - Topological & duplicate-free merge or full replacement inside a PostgreSQL transaction
 * - Automatic rollback on any error
 */
organizationRouter.post(
  '/backup/restore',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res) => {
    const operator = extractOperator(req);
    const {
      backupId,
      backupPackage,
      selectedSubTabs,
      mode = 'safe_merge', // 'safe_merge' | 'full_replace'
      confirmed = false,
    } = req.body || {};

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'تأیید صریح کاربر برای اجرای بازیابی اطلاعات ساختار سازمانی الزامی است.',
      });
    }

    let rawPackage = backupPackage;
    if (!rawPackage && backupId) {
      const savedSnapshots = await getSettingValue<any[]>('hse_org_backups_v2', []);
      rawPackage = (Array.isArray(savedSnapshots) ? savedSnapshots : []).find(
        (s: any) => s?.metadata?.backupId === backupId
      );
    }

    const parsed = parseAndNormalizeOrgBackupInput(rawPackage);
    if (!parsed.validFormat || !parsed.checksumValid) {
      return res.status(400).json({
        success: false,
        error:
          parsed.errors.join(' | ') ||
          'اعتبارسنجی فایل پشتیبان ناموفق بود؛ عملیات بازیابی جهت حفاظت از اطلاعات متوقف شد.',
      });
    }

    const tabsToRestore: OrgSubTabKey[] = Array.isArray(selectedSubTabs)
      ? selectedSubTabs.filter((t: OrgSubTabKey) => parsed.availableSubTabs.includes(t))
      : parsed.availableSubTabs;

    if (tabsToRestore.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'هیچ زیرتب معتبری برای بازیابی انتخاب نشده است.',
      });
    }

    // Step 1: Create Mandatory Pre-Restore Safety Snapshot before touching any data
    const safetySnapshot = await createOrgBackupSnapshotInternal({
      operator,
      tag: 'pre_restore_safety',
    });

    const pList = await db.select().from(personnel);
    const client = await pool.connect();

    const restoreSummary = {
      safetyBackupId: safetySnapshot.metadata.backupId,
      mode,
      restoredSubTabs: tabsToRestore,
      orgNodesRestored: 0,
      unitsRestored: 0,
      subUnitsRestored: 0,
      jobsRestored: 0,
      incidentTypesRestored: 0,
      ppeCategoriesRestored: 0,
      ppeItemsRestored: 0,
      duplicatesPrevented: 0,
      managersLinked: 0,
    };

    try {
      await client.query('BEGIN');

      const upsertSettingTx = async (key: string, val: any) => {
        await client.query(
          `INSERT INTO "public"."system_settings" ("key", "value", "updated_at")
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = NOW()`,
          [key, JSON.stringify(val)]
        );
      };

      const getSettingTx = async <T>(key: string, fallback: T): Promise<T> => {
        const r = await client.query(
          `SELECT "value" FROM "public"."system_settings" WHERE "key" = $1 LIMIT 1`,
          [key]
        );
        return r.rows.length > 0 && r.rows[0].value !== null ? (r.rows[0].value as T) : fallback;
      };

      let finalOrgNodes = await getSettingTx<any[]>('org_nodes', []);
      let finalOrgStructure = await getSettingTx<
        Record<string, { jobs: string[]; subUnits: Record<string, string[]> }>
      >('hse_unit_structure_v1', {});
      let finalJobTitles = await getSettingTx<string[]>('hse_org_jobs', []);

      // ----------------------------------------------------------------------
      // 1. Restore Sub-Tab: org_hierarchy (with topological order & dedup)
      // ----------------------------------------------------------------------
      if (tabsToRestore.includes('org_hierarchy')) {
        const incomingNodes = parsed.data.orgNodes || [];
        if (mode === 'full_replace') {
          const topo = sanitizeAndSortOrgNodesTopologically(incomingNodes, pList);
          finalOrgNodes = topo.sortedNodes;
          restoreSummary.duplicatesPrevented += topo.duplicatesRemoved;
          restoreSummary.managersLinked = topo.managersResolved;
        } else {
          // safe_merge: Preserve existing nodes without overwriting customized fields;
          // enrich empty manager/location fields and add missing nodes in topological order
          const mergedRaw: any[] = [...finalOrgNodes];
          const existingById = new Map<string, number>();
          const existingByParentAndName = new Map<string, number>();

          finalOrgNodes.forEach((n, idx) => {
            existingById.set(String(n.id), idx);
            const pKey = n.parentId ? String(n.parentId) : 'ROOT';
            existingByParentAndName.set(`${pKey}:::${normalizeFaText(n.name)}`, idx);
          });

          for (const inc of incomingNodes) {
            if (!inc || !inc.name) continue;
            const pKey = inc.parentId ? String(inc.parentId) : 'ROOT';
            const matchIdx =
              existingById.get(String(inc.id)) ??
              existingByParentAndName.get(`${pKey}:::${normalizeFaText(inc.name)}`);

            if (matchIdx !== undefined) {
              restoreSummary.duplicatesPrevented++;
              const curr = mergedRaw[matchIdx];
              mergedRaw[matchIdx] = {
                ...inc,
                ...curr,
                // Fill only missing fields on existing record (no unwanted overwrite)
                manager: curr.manager || inc.manager || '',
                managerPersonnelId: curr.managerPersonnelId ?? inc.managerPersonnelId ?? null,
                managerPersonnelCode: curr.managerPersonnelCode || inc.managerPersonnelCode || '',
                managerJobTitle: curr.managerJobTitle || inc.managerJobTitle || '',
                managerNationalCode: curr.managerNationalCode || inc.managerNationalCode || '',
                location: curr.location || inc.location || '',
                description: curr.description || inc.description || '',
              };
            } else {
              mergedRaw.push(inc);
            }
          }

          const topo = sanitizeAndSortOrgNodesTopologically(mergedRaw, pList);
          finalOrgNodes = topo.sortedNodes;
          restoreSummary.duplicatesPrevented += topo.duplicatesRemoved;
          restoreSummary.managersLinked = topo.managersResolved;
        }

        await upsertSettingTx('org_nodes', finalOrgNodes);
        restoreSummary.orgNodesRestored = finalOrgNodes.length;
      }

      // ----------------------------------------------------------------------
      // 2. Restore Sub-Tab: units_jobs (Operational Units, Sub-Units & Jobs)
      // ----------------------------------------------------------------------
      if (tabsToRestore.includes('units_jobs')) {
        const incStruct = parsed.data.orgStructure || {};
        const incJobs = parsed.data.jobTitles || [];

        if (mode === 'full_replace') {
          const cleanStruct: Record<string, { jobs: string[]; subUnits: Record<string, string[]> }> = {};
          for (const [uName, uVal] of Object.entries(incStruct)) {
            const trimmedUnit = uName.trim();
            if (!trimmedUnit) continue;
            const jobs = Array.from(new Set((uVal?.jobs || []).map((j) => String(j).trim()).filter(Boolean)));
            const subUnits: Record<string, string[]> = {};
            for (const [sName, sJobs] of Object.entries(uVal?.subUnits || {})) {
              const trimmedSub = sName.trim();
              if (!trimmedSub) continue;
              subUnits[trimmedSub] = Array.from(
                new Set((Array.isArray(sJobs) ? sJobs : []).map((j) => String(j).trim()).filter(Boolean))
              );
            }
            cleanStruct[trimmedUnit] = { jobs, subUnits };
          }
          finalOrgStructure = cleanStruct;
          finalJobTitles = Array.from(new Set(incJobs.map((j) => String(j).trim()).filter(Boolean)));
        } else {
          // safe_merge: Merge units, sub-units, and jobs without duplicates or overwriting existing units
          const nextStruct = { ...finalOrgStructure };
          const unitKeyByNorm = new Map<string, string>();
          Object.keys(nextStruct).forEach((k) => unitKeyByNorm.set(normalizeFaText(k), k));

          for (const [incUnitName, incUnitVal] of Object.entries(incStruct)) {
            const normU = normalizeFaText(incUnitName);
            if (!normU) continue;
            const targetKey = unitKeyByNorm.get(normU) || incUnitName.trim();
            unitKeyByNorm.set(normU, targetKey);

            const existingUnit = nextStruct[targetKey] || { jobs: [], subUnits: {} };
            const existingJobsNorm = new Set((existingUnit.jobs || []).map(normalizeFaText));
            const mergedJobs = [...(existingUnit.jobs || [])];

            for (const j of incUnitVal?.jobs || []) {
              const cleanJ = String(j).trim();
              if (cleanJ && !existingJobsNorm.has(normalizeFaText(cleanJ))) {
                existingJobsNorm.add(normalizeFaText(cleanJ));
                mergedJobs.push(cleanJ);
              } else if (cleanJ) {
                restoreSummary.duplicatesPrevented++;
              }
            }

            const mergedSubs: Record<string, string[]> = { ...(existingUnit.subUnits || {}) };
            const subKeyByNorm = new Map<string, string>();
            Object.keys(mergedSubs).forEach((sk) => subKeyByNorm.set(normalizeFaText(sk), sk));

            for (const [incSubName, incSubJobs] of Object.entries(incUnitVal?.subUnits || {})) {
              const normS = normalizeFaText(incSubName);
              if (!normS) continue;
              const targetSubKey = subKeyByNorm.get(normS) || incSubName.trim();
              subKeyByNorm.set(normS, targetSubKey);

              const currSubJobs = [...(mergedSubs[targetSubKey] || [])];
              const currSubJobsNorm = new Set(currSubJobs.map(normalizeFaText));
              for (const sj of Array.isArray(incSubJobs) ? incSubJobs : []) {
                const cleanSj = String(sj).trim();
                if (cleanSj && !currSubJobsNorm.has(normalizeFaText(cleanSj))) {
                  currSubJobsNorm.add(normalizeFaText(cleanSj));
                  currSubJobs.push(cleanSj);
                } else if (cleanSj) {
                  restoreSummary.duplicatesPrevented++;
                }
              }
              mergedSubs[targetSubKey] = currSubJobs;
            }

            nextStruct[targetKey] = {
              jobs: mergedJobs,
              subUnits: mergedSubs,
            };
          }

          finalOrgStructure = nextStruct;

          // Merge master jobTitles + all unit/sub-unit jobs
          const jobSetNorm = new Set(finalJobTitles.map(normalizeFaText));
          const nextJobs = [...finalJobTitles];
          const addJobDedup = (j: string) => {
            const clean = String(j || '').trim();
            if (!clean) return;
            if (!jobSetNorm.has(normalizeFaText(clean))) {
              jobSetNorm.add(normalizeFaText(clean));
              nextJobs.push(clean);
            }
          };
          incJobs.forEach(addJobDedup);
          Object.values(finalOrgStructure).forEach((u) => {
            (u.jobs || []).forEach(addJobDedup);
            Object.values(u.subUnits || {}).forEach((sJobs) => sJobs.forEach(addJobDedup));
          });
          finalJobTitles = nextJobs;
        }

        await upsertSettingTx('hse_unit_structure_v1', finalOrgStructure);
        await upsertSettingTx('hse_org_jobs', finalJobTitles);

        restoreSummary.unitsRestored = Object.keys(finalOrgStructure).length;
        restoreSummary.subUnitsRestored = Object.values(finalOrgStructure).reduce(
          (acc, u) => acc + Object.keys(u?.subUnits || {}).length,
          0
        );
        restoreSummary.jobsRestored = finalJobTitles.length;
      }

      // ----------------------------------------------------------------------
      // 3. Restore Sub-Tab: incident_types (Deduplicated by id, code, titleFa)
      // ----------------------------------------------------------------------
      if (tabsToRestore.includes('incident_types')) {
        const incTypes = parsed.data.incidentTypes || [];
        let finalIncTypes: any[] = [];

        if (mode === 'full_replace') {
          const seen = new Set<string>();
          for (const item of incTypes) {
            if (!item?.titleFa) continue;
            const k = normalizeFaText(item.titleFa);
            if (seen.has(k)) {
              restoreSummary.duplicatesPrevented++;
              continue;
            }
            seen.add(k);
            finalIncTypes.push(item);
          }
        } else {
          const existingInc = await getSettingTx<any[]>('hse_incident_types_config', []);
          finalIncTypes = [...existingInc];
          const seenTitle = new Set(existingInc.map((i: any) => normalizeFaText(i.titleFa)));
          const seenId = new Set(existingInc.map((i: any) => String(i.id)));

          for (const item of incTypes) {
            if (!item?.titleFa) continue;
            const normT = normalizeFaText(item.titleFa);
            if (seenTitle.has(normT) || seenId.has(String(item.id))) {
              restoreSummary.duplicatesPrevented++;
              continue;
            }
            seenTitle.add(normT);
            seenId.add(String(item.id));
            finalIncTypes.push(item);
          }
        }

        await upsertSettingTx('hse_incident_types_config', finalIncTypes);
        restoreSummary.incidentTypesRestored = finalIncTypes.length;
      }

      // ----------------------------------------------------------------------
      // 4. Restore Sub-Tab: ppe_equipment (Categories & Equipment Items)
      // ----------------------------------------------------------------------
      if (tabsToRestore.includes('ppe_equipment')) {
        const incCats = parsed.data.ppeCategories || [];
        const incItems = parsed.data.ppeItems || [];

        let finalCats: any[] = [];
        let finalItems: any[] = [];

        if (mode === 'full_replace') {
          const seenCat = new Set<string>();
          for (const c of incCats) {
            if (!c?.nameFa) continue;
            const k = normalizeFaText(c.nameFa);
            if (seenCat.has(k)) {
              restoreSummary.duplicatesPrevented++;
              continue;
            }
            seenCat.add(k);
            finalCats.push(c);
          }

          const seenItem = new Set<string>();
          for (const it of incItems) {
            if (!it?.nameFa) continue;
            const k = normalizeFaText(it.nameFa);
            if (seenItem.has(k)) {
              restoreSummary.duplicatesPrevented++;
              continue;
            }
            seenItem.add(k);
            finalItems.push(it);
          }
        } else {
          const existingCats = await getSettingTx<any[]>('hse_ppe_categories', []);
          finalCats = [...existingCats];
          const seenCat = new Set(existingCats.map((c: any) => normalizeFaText(c.nameFa)));

          for (const c of incCats) {
            if (!c?.nameFa) continue;
            const k = normalizeFaText(c.nameFa);
            if (seenCat.has(k)) {
              restoreSummary.duplicatesPrevented++;
              continue;
            }
            seenCat.add(k);
            finalCats.push(c);
          }

          const existingItems = await getSettingTx<any[]>('hse_ppe_items', []);
          finalItems = [...existingItems];
          const seenItem = new Set(existingItems.map((i: any) => normalizeFaText(i.nameFa)));
          const seenCode = new Set(existingItems.map((i: any) => normalizeFaText(i.code)));

          for (const it of incItems) {
            if (!it?.nameFa) continue;
            const kName = normalizeFaText(it.nameFa);
            const kCode = normalizeFaText(it.code);
            if (seenItem.has(kName) || (kCode && seenCode.has(kCode))) {
              restoreSummary.duplicatesPrevented++;
              continue;
            }
            seenItem.add(kName);
            if (kCode) seenCode.add(kCode);
            finalItems.push(it);
          }
        }

        await upsertSettingTx('hse_ppe_categories', finalCats);
        await upsertSettingTx('hse_ppe_items', finalItems);
        restoreSummary.ppeCategoriesRestored = finalCats.length;
        restoreSummary.ppeItemsRestored = finalItems.length;
      }

      // ----------------------------------------------------------------------
      // 5. Synchronize Relational PostgreSQL Tables inside the same Transaction
      // ----------------------------------------------------------------------
      if (tabsToRestore.includes('org_hierarchy') || tabsToRestore.includes('units_jobs')) {
        await syncRelationalOrgTablesInTx(client, finalOrgNodes, finalOrgStructure, finalJobTitles);
      }

      await client.query('COMMIT');
    } catch (txErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error('[OrgBackup] Transactional restore failed and rolled back:', txErr);

      await logOrgAudit(
        operator.username,
        `خطا در بازیابی ساختار سازمانی (تراکنش به وضعیت قبلی Rollback شد)`,
        safetySnapshot.metadata.backupId,
        {
          error: txErr?.message,
          safetyBackupId: safetySnapshot.metadata.backupId,
        }
      );

      return res.status(500).json({
        success: false,
        error: `خطا در حین بازیابی اطلاعات (${txErr?.message}). تمام تغییرات به‌طور خودکار به وضعیت قبلی بازگردانی (Rollback) شد و هیچ آسیبی به اطلاعات موجود وارد نگردید.`,
        safetyBackupId: safetySnapshot.metadata.backupId,
      });
    } finally {
      client.release();
    }

    await logOrgAudit(
      operator.username,
      `بازیابی موفق ساختار سازمانی (${tabsToRestore.join(', ')}) در حالت ${mode} - پشتیبان ایمنی: ${safetySnapshot.metadata.backupId}`,
      parsed.metadata.backupId || 'uploaded_org_backup',
      restoreSummary
    );

    broadcastDataMutation('organization:nodes', 'restore', { timestamp: Date.now() });
    broadcastDataMutation('departments', 'restore', { timestamp: Date.now() });
    broadcastDataMutation('settings', 'restore', { timestamp: Date.now() });

    res.json({
      success: true,
      data: restoreSummary,
    });
  }
);

/**
 * POST /api/v1/organization/backup/rollback/:backupId
 * Immediate rollback to a pre-restore safety snapshot
 */
organizationRouter.post(
  '/backup/rollback/:backupId',
  requireAuth,
  requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res) => {
    try {
      const targetId = String(req.params.backupId || '').trim();
      const savedSnapshots = await getSettingValue<any[]>('hse_org_backups_v2', []);
      const snapshot = (Array.isArray(savedSnapshots) ? savedSnapshots : []).find(
        (s: any) => s?.metadata?.backupId === targetId
      );

      if (!snapshot) {
        return res.status(404).json({
          success: false,
          error: 'نسخه پشتیبان ایمنی مورد نظر جهت بازگردانی یافت نشد.',
        });
      }

      // Reuse transactional restore in full_replace mode for all sub-tabs in the safety snapshot
      const operator = extractOperator(req);
      const pList = await db.select().from(personnel);
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const upsertSettingTx = async (key: string, val: any) => {
          await client.query(
            `INSERT INTO "public"."system_settings" ("key", "value", "updated_at")
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = NOW()`,
            [key, JSON.stringify(val)]
          );
        };

        const d = snapshot.data || {};
        const orgNodes = Array.isArray(d.orgHierarchy?.orgNodes) ? d.orgHierarchy.orgNodes : [];
        const orgStructure = d.unitsAndJobs?.orgStructure || {};
        const jobTitles = Array.isArray(d.unitsAndJobs?.jobTitles) ? d.unitsAndJobs.jobTitles : [];
        const incidentTypes = Array.isArray(d.incidentTypes) ? d.incidentTypes : [];
        const ppeCategories = Array.isArray(d.ppeEquipment?.ppeCategories)
          ? d.ppeEquipment.ppeCategories
          : [];
        const ppeItems = Array.isArray(d.ppeEquipment?.ppeItems) ? d.ppeEquipment.ppeItems : [];

        const topo = sanitizeAndSortOrgNodesTopologically(orgNodes, pList);

        await upsertSettingTx('org_nodes', topo.sortedNodes);
        await upsertSettingTx('hse_unit_structure_v1', orgStructure);
        await upsertSettingTx('hse_org_jobs', jobTitles);
        await upsertSettingTx('hse_incident_types_config', incidentTypes);
        await upsertSettingTx('hse_ppe_categories', ppeCategories);
        await upsertSettingTx('hse_ppe_items', ppeItems);

        await syncRelationalOrgTablesInTx(client, topo.sortedNodes, orgStructure, jobTitles);

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }

      await logOrgAudit(
        operator.username,
        `بازگردانی کامل ساختار سازمانی به نسخه پشتیبان ایمنی ${targetId}`,
        targetId,
        { rolledBackTo: targetId }
      );

      broadcastDataMutation('organization:nodes', 'rollback', { backupId: targetId });
      broadcastDataMutation('settings', 'rollback', { backupId: targetId });

      res.json({
        success: true,
        data: {
          rolledBackTo: targetId,
          persianDate: snapshot.metadata?.persianDate,
        },
      });
    } catch (err: any) {
      logger.error('[OrgBackup] Rollback error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'خطا در بازگردانی وضعیت قبلی ساختار سازمانی',
      });
    }
  }
);
