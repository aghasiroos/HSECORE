import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, schema, withTransaction } from '../../core/db.ts';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../core/errors.ts';
import { UserContext } from '../../core/middleware/auth.ts';
import {
  DEFAULT_SCAFFOLD_CHECKLIST_SETTINGS,
  evaluateScaffoldChecklist,
  resolveChecklistAnswer,
  resolveChecklistVerdict,
  SCAFFOLD_INSPECTION_REASONS,
  SCAFFOLD_TAG_META,
  SCAFFOLD_TYPES,
  SCAFFOLD_WORKFLOW_STEPS,
  ScaffoldChecklistAnswer,
  ScaffoldChecklistResponseItem,
  ScaffoldChecklistSettings,
  ScaffoldInspectionReason,
  ScaffoldPhotoItem,
  ScaffoldSignaturesMeta,
  ScaffoldTagStatus,
  ScaffoldWorkflowStatus,
  STANDARD_SCAFFOLD_CHECKLIST_ITEMS,
} from '../../../shared/scaffolding/constants.ts';
import {
  formatJalaliString,
  getCurrentShamsiYear,
  getShamsiToday,
  gregorianToJalali,
} from '../../../src/utils/jalaliDate.ts';

const VALID_TAGS: ScaffoldTagStatus[] = ['GREEN', 'YELLOW', 'RED'];
const VALID_REASONS = new Set<string>(SCAFFOLD_INSPECTION_REASONS.map(r => r.value));
const VALID_ANSWERS = new Set<string>(['YES', 'NO', 'NA']);
const VALID_VERDICTS = new Set<string>(['PASS', 'FAIL', 'NA']);
const CHECKLIST_SETTINGS_KEY = 'scaffolding_checklist_settings';
const MAX_PHOTOS_PER_STAGE = 8;
const MAX_DATA_URL_LENGTH = 4_800_000; // ~3.5MB base64 image

function getTehranNowJalaliAndTime(): { jalaliDate: string; timeStr: string } {
  const now = new Date();
  const jalaliDate = getShamsiToday();
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  return { jalaliDate, timeStr };
}

function getJalaliPlusDays(days: number): string {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const j = gregorianToJalali(target.getFullYear(), target.getMonth() + 1, target.getDate());
  return formatJalaliString(j.jy, j.jm, j.jd);
}

function sanitizeOptionalString(val: unknown, maxLen = 500): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function sanitizeRequiredString(val: unknown, fieldLabelFa: string, maxLen = 500): string {
  const s = sanitizeOptionalString(val, maxLen);
  if (!s) {
    throw new ValidationError(`تکمیل فیلد «${fieldLabelFa}» الزامی است.`);
  }
  return s;
}

function isSafeImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_DATA_URL_LENGTH) return false;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return true;
  }
  if (/^\/(api\/v1\/files|api\/files|assets)\/[A-Za-z0-9._\-\/]+$/i.test(trimmed)) {
    return true;
  }
  return false;
}

function sanitizePhotos(raw: unknown, stage: 'BEFORE' | 'AFTER' | 'DEFECT', actorName: string): ScaffoldPhotoItem[] {
  if (!Array.isArray(raw)) return [];
  const clean: ScaffoldPhotoItem[] = [];
  for (const item of raw.slice(0, MAX_PHOTOS_PER_STAGE)) {
    if (!item || typeof item !== 'object') continue;
    const url = (item as any).url;
    if (!isSafeImageUrl(url)) continue;
    clean.push({
      id: sanitizeOptionalString((item as any).id, 80) || `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: url.trim(),
      fileName: sanitizeOptionalString((item as any).fileName, 160) || 'scaffold-photo.jpg',
      caption: sanitizeOptionalString((item as any).caption, 250) || undefined,
      stage,
      uploadedAt: sanitizeOptionalString((item as any).uploadedAt, 60) || new Date().toISOString(),
      uploadedBy: sanitizeOptionalString((item as any).uploadedBy, 120) || actorName,
    });
  }
  return clean;
}

function sanitizeChecklistItems(
  raw: unknown,
  allowNaOption = false
): ScaffoldChecklistResponseItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ValidationError('چک‌لیست ایمنی نصب داربست نمی‌تواند خالی باشد.');
  }
  const templateByCode = new Map(STANDARD_SCAFFOLD_CHECKLIST_ITEMS.map(i => [i.code, i]));
  const result: ScaffoldChecklistResponseItem[] = [];

  for (let idx = 0; idx < raw.length; idx++) {
    const entry = raw[idx];
    if (!entry || typeof entry !== 'object') continue;
    const code = sanitizeOptionalString((entry as any).code, 40) || `SCF-C${String(idx + 1).padStart(2, '0')}`;
    const tpl = templateByCode.get(code);
    const safeAnswer: 'YES' | 'NO' = tpl
      ? tpl.safeAnswer
      : (String((entry as any).safeAnswer || '').toUpperCase().trim() === 'NO' ? 'NO' : 'YES');

    const rawAnswerStr = String((entry as any).answer || '').toUpperCase().trim();
    const rawVerdictStr = String((entry as any).verdict || '').toUpperCase().trim();

    let answer: ScaffoldChecklistAnswer | null = null;
    if (VALID_ANSWERS.has(rawAnswerStr)) {
      answer = rawAnswerStr as ScaffoldChecklistAnswer;
    } else if (VALID_VERDICTS.has(rawVerdictStr)) {
      answer = resolveChecklistAnswer({
        verdict: rawVerdictStr as 'PASS' | 'FAIL' | 'NA',
        safeAnswer,
      });
    }

    const label = tpl?.titleFa || sanitizeOptionalString((entry as any).titleFa, 240) || code;
    const displayOrder = tpl ? tpl.orderIndex : idx + 1;

    if (!answer) {
      throw new ValidationError(
        `پاسخ بند ${displayOrder} («${label}») مشخص نشده است. لطفاً یکی از گزینه‌های بله یا خیر${allowNaOption ? ' یا نامرتبط' : ''} را انتخاب کنید.`
      );
    }

    if (answer === 'NA' && !allowNaOption) {
      throw new ValidationError(
        `گزینه «نامرتبط» برای بند ${displayOrder} در تنظیمات چک‌لیست غیرفعال است. در صورت نیاز ابتدا آن را در تنظیمات چک‌لیست فعال کنید.`
      );
    }

    const verdict = resolveChecklistVerdict(answer, safeAnswer)!;
    const comment = sanitizeOptionalString((entry as any).comment, 1000) || undefined;
    const correctiveAction = sanitizeOptionalString((entry as any).correctiveAction, 1000) || undefined;

    // Enforce mandatory explanation or corrective action whenever an item is answered unsafely
    if (verdict === 'FAIL' && !comment && !correctiveAction) {
      throw new ValidationError(
        `برای بند ${displayOrder} («${label}») به دلیل ثبت وضعیت ناایمن، درج توضیحات یا اقدام اصلاحی الزامی است.`
      );
    }

    const defectPhotoRaw = (entry as any).defectPhoto;
    const defectPhoto = defectPhotoRaw && isSafeImageUrl(defectPhotoRaw) ? defectPhotoRaw.trim() : undefined;

    result.push({
      code,
      orderIndex: displayOrder,
      categoryFa: tpl ? tpl.categoryFa : (sanitizeOptionalString((entry as any).categoryFa, 120) || 'موارد تکمیلی'),
      titleFa: tpl ? tpl.titleFa : sanitizeRequiredString((entry as any).titleFa, `عنوان بند ${idx + 1}`, 240),
      requirementFa: tpl ? tpl.requirementFa : (sanitizeOptionalString((entry as any).requirementFa, 500) || undefined),
      standardRef: tpl ? tpl.standardRef : (sanitizeOptionalString((entry as any).standardRef, 80) || 'HSECORE-CUSTOM'),
      // Standard critical flags and safe polarity cannot be downgraded by client payloads
      isCritical: tpl ? tpl.isCritical : Boolean((entry as any).isCritical),
      safeAnswer,
      isCustom: !tpl,
      answer,
      verdict,
      comment,
      defectPhoto,
      correctiveAction,
      responsiblePerson: sanitizeOptionalString((entry as any).responsiblePerson, 160) || undefined,
      dueDate: sanitizeOptionalString((entry as any).dueDate, 40) || undefined,
      resolved: verdict === 'FAIL' ? Boolean((entry as any).resolved) : false,
    });
  }

  // Ensure all 23 mandatory standard items are present without omission or merging
  const presentCodes = new Set(result.map(r => r.code));
  const missingStandard = STANDARD_SCAFFOLD_CHECKLIST_ITEMS.filter(i => !presentCodes.has(i.code));
  if (missingStandard.length > 0) {
    throw new ValidationError(
      `چک‌لیست ۲۳‌بندی ایمنی نصب داربست ناقص است؛ بندهای الزامی تکمیل نشده‌اند (${missingStandard.map(m => m.code).join(', ')}).`
    );
  }

  return result.sort((a, b) => a.orderIndex - b.orderIndex);
}

function sanitizeSignaturesMeta(
  raw: unknown,
  defaults: {
    inspectorName: string;
    inspectorPersonnelCode?: string | null;
    unitSupervisorName?: string | null;
    signedAt: string;
  }
): ScaffoldSignaturesMeta {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const inspectorName = sanitizeOptionalString(src.inspectorName, 160) || defaults.inspectorName;
  const inspectorPersonnelCode =
    sanitizeOptionalString(src.inspectorPersonnelCode, 60) || defaults.inspectorPersonnelCode || undefined;
  const unitSupervisorName =
    sanitizeOptionalString(src.unitSupervisorName, 160) || defaults.unitSupervisorName || undefined;
  const unitSupervisorPersonnelCode = sanitizeOptionalString(src.unitSupervisorPersonnelCode, 60) || undefined;

  return {
    inspectorName,
    inspectorPersonnelCode,
    inspectorSignedAt: sanitizeOptionalString(src.inspectorSignedAt, 60) || defaults.signedAt,
    unitSupervisorName,
    unitSupervisorPersonnelCode,
    unitSupervisorSignedAt:
      sanitizeOptionalString(src.unitSupervisorSignedAt, 60) || (unitSupervisorName ? defaults.signedAt : undefined),
  };
}

function parsePositiveIntOrNull(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export interface ScaffoldListFilters {
  search?: string;
  unit?: string;
  contractor?: string;
  inspector?: string;
  tagStatus?: string;
  workflowStatus?: string;
  permitNumber?: string;
}

class ScaffoldingService {
  /**
   * Generate a unique auto-incrementing scaffold code per Jalali year: SCF-1405-0001
   */
  async generateNextScaffoldCode(txDb: typeof db = db): Promise<string> {
    const year = getCurrentShamsiYear();
    const prefix = `SCF-${year}-`;
    const rows = await txDb
      .select({ scaffoldCode: schema.scaffolds.scaffoldCode })
      .from(schema.scaffolds)
      .where(ilike(schema.scaffolds.scaffoldCode, `${prefix}%`));

    let maxSeq = 0;
    for (const r of rows) {
      const m = String(r.scaffoldCode || '').match(/(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }

  /**
   * Read persisted scaffolding checklist settings from PostgreSQL `system_settings`.
   */
  async getChecklistSettings(): Promise<ScaffoldChecklistSettings> {
    try {
      const [row] = await db
        .select({ value: schema.systemSettings.value })
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, CHECKLIST_SETTINGS_KEY))
        .limit(1);
      const val = row?.value && typeof row.value === 'object' ? (row.value as Record<string, any>) : null;
      return {
        allowNaOption: Boolean(val?.allowNaOption),
      };
    } catch {
      return { ...DEFAULT_SCAFFOLD_CHECKLIST_SETTINGS };
    }
  }

  /**
   * Persist scaffolding checklist settings in PostgreSQL `system_settings`.
   */
  async updateChecklistSettings(
    payload: Record<string, any>,
    actor: UserContext
  ): Promise<ScaffoldChecklistSettings> {
    const nextSettings: ScaffoldChecklistSettings = {
      allowNaOption: Boolean(payload.allowNaOption),
    };
    const updatedBy = actor.name || actor.username || actor.uid || 'system';
    await db
      .insert(schema.systemSettings)
      .values({
        key: CHECKLIST_SETTINGS_KEY,
        value: nextSettings as any,
        updatedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: {
          value: nextSettings as any,
          updatedBy,
          updatedAt: new Date(),
        },
      });
    return nextSettings;
  }

  /**
   * Bootstrap context from live PostgreSQL tables:
   * - Real PTW permits (`work_permits`)
   * - Organizational units (`org_units` merged with `system_settings.hse_unit_structure_v1`)
   * - Personnel (`personnel`)
   * - Contractors (aggregated from `scaffolds`, `work_permits`, `org_companies`)
   * - Persisted checklist settings (`system_settings`)
   */
  async getBootstrapContext() {
    const [permitsRaw, orgUnitsRaw, orgDeptsRaw, orgSettingsRaw, personnelRaw, existingScaffoldsRaw] =
      await Promise.all([
        db
          .select({
            id: schema.workPermits.id,
            permitNumber: schema.workPermits.permitNumber,
            permitType: schema.workPermits.permitType,
            title: schema.workPermits.title,
            location: schema.workPermits.location,
            contractorName: schema.workPermits.contractorName,
            equipmentList: schema.workPermits.equipmentList,
            description: schema.workPermits.description,
            status: schema.workPermits.status,
            unitId: schema.workPermits.unitId,
            formData: schema.workPermits.formData,
          })
          .from(schema.workPermits)
          .orderBy(desc(schema.workPermits.id))
          .limit(300),
        db
          .select({
            id: schema.orgUnits.id,
            name: schema.orgUnits.name,
            code: schema.orgUnits.code,
          })
          .from(schema.orgUnits)
          .orderBy(schema.orgUnits.name),
        db
          .select({
            id: schema.orgDepartments.id,
            name: schema.orgDepartments.name,
            code: schema.orgDepartments.code,
          })
          .from(schema.orgDepartments)
          .orderBy(schema.orgDepartments.name)
          .catch(() => []),
        db
          .select({ key: schema.systemSettings.key, value: schema.systemSettings.value })
          .from(schema.systemSettings)
          .where(inArray(schema.systemSettings.key, ['hse_unit_structure_v1', 'org_nodes'])),
        db
          .select({
            id: schema.personnel.id,
            personnelCode: schema.personnel.personnelCode,
            firstName: schema.personnel.firstName,
            lastName: schema.personnel.lastName,
            jobTitle: schema.personnel.jobTitle,
            employmentType: schema.personnel.employmentType,
            extraData: schema.personnel.extraData,
          })
          .from(schema.personnel)
          .where(eq(schema.personnel.status, 'ACTIVE'))
          .orderBy(schema.personnel.lastName, schema.personnel.firstName)
          .limit(500),
        db
          .select({
            contractorName: schema.scaffolds.contractorName,
            requestingUnit: schema.scaffolds.requestingUnit,
            inspectorName: schema.scaffolds.inspectorName,
          })
          .from(schema.scaffolds),
      ]);

    // Build merged org units list without duplicates
    const unitMap = new Map<string, { id: number | null; name: string; code?: string | null; area?: string | null }>();
    for (const u of orgUnitsRaw) {
      if (u.name?.trim()) {
        unitMap.set(u.name.trim(), { id: u.id, name: u.name.trim(), code: u.code });
      }
    }
    for (const d of orgDeptsRaw) {
      const name = String(d.name || '').trim();
      if (name && !unitMap.has(name)) {
        unitMap.set(name, { id: null, name, code: d.code || null });
      }
    }

    // Parse hierarchical & map structures from system_settings (hse_unit_structure_v1 & org_nodes)
    const extractUnits = (node: any, parentArea?: string) => {
      if (!node) return;
      if (typeof node === 'string') {
        const label = node.trim();
        if (label && !unitMap.has(label)) {
          unitMap.set(label, { id: null, name: label, code: null, area: parentArea || null });
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(item => extractUnits(item, parentArea));
        return;
      }
      if (typeof node === 'object') {
        const label = String(node.name || node.title || node.unitName || node.department || '').trim();
        if (label && !unitMap.has(label)) {
          unitMap.set(label, { id: null, name: label, code: node.code || null, area: parentArea || null });
        }
        const hasKnownShape = Boolean(
          label ||
            Array.isArray(node.units) ||
            Array.isArray(node.children) ||
            Array.isArray(node.departments) ||
            Array.isArray(node.subUnits) ||
            Array.isArray(node.areas)
        );
        if (Array.isArray(node.units)) extractUnits(node.units, label || parentArea);
        if (Array.isArray(node.children)) extractUnits(node.children, label || parentArea);
        if (Array.isArray(node.departments)) extractUnits(node.departments, label || parentArea);
        if (Array.isArray(node.subUnits)) extractUnits(node.subUnits, label || parentArea);
        if (Array.isArray(node.areas)) extractUnits(node.areas, label || parentArea);

        // Handle dictionary map format: { "Unit A": ["SubUnit 1", "SubUnit 2"], ... }
        if (!hasKnownShape) {
          for (const [k, v] of Object.entries(node)) {
            const keyName = k.trim();
            if (keyName && !unitMap.has(keyName)) {
              unitMap.set(keyName, { id: null, name: keyName, code: null, area: parentArea || null });
            }
            if (Array.isArray(v) || (v && typeof v === 'object')) {
              extractUnits(v, keyName || parentArea);
            }
          }
        }
      }
    };
    for (const row of orgSettingsRaw) {
      if (row?.value) extractUnits(row.value);
    }

    const orgUnitById = new Map<number, string>();
    for (const u of orgUnitsRaw) {
      orgUnitById.set(u.id, u.name);
    }

    const permits = permitsRaw.map(p => {
      const fd = (p.formData && typeof p.formData === 'object' ? p.formData : {}) as Record<string, any>;
      const unitName =
        (p.unitId ? orgUnitById.get(p.unitId) : null) ||
        fd.unitName ||
        fd.unit ||
        fd.requestingUnit ||
        fd.department ||
        '';
      const equipmentName =
        p.equipmentList ||
        fd.equipmentTag ||
        fd.equipmentName ||
        fd.equipment ||
        '';
      return {
        id: p.id,
        permitNumber: p.permitNumber,
        permitType: p.permitType,
        title: p.title || fd.workDescription || fd.title || '',
        location: p.location || fd.location || fd.area || '',
        areaName: fd.area || fd.areaName || '',
        unitId: p.unitId,
        unitName: String(unitName || '').trim(),
        equipmentName: String(equipmentName || '').trim(),
        contractorName: p.contractorName || fd.contractorName || fd.contractor || '',
        description: p.description || fd.workDescription || fd.description || p.title || '',
        status: p.status,
      };
    });

    const personnelList = personnelRaw.map(pr => {
      const extra = (pr.extraData && typeof pr.extraData === 'object' ? pr.extraData : {}) as Record<string, any>;
      const fullName = `${pr.firstName || ''} ${pr.lastName || ''}`.trim();
      return {
        id: pr.id,
        personnelCode: pr.personnelCode,
        fullName,
        jobTitle: pr.jobTitle || null,
        departmentName: extra.departmentName || extra.department || null,
        contractorName: extra.contractorName || extra.contractor || extra.companyName || null,
        employmentType: pr.employmentType || null,
      };
    });

    // Aggregate contractor names from real database sources
    const contractorSet = new Set<string>();
    for (const p of permits) {
      if (p.contractorName?.trim()) contractorSet.add(p.contractorName.trim());
    }
    for (const s of existingScaffoldsRaw) {
      if (s.contractorName?.trim()) contractorSet.add(s.contractorName.trim());
    }
    for (const pr of personnelList) {
      if (pr.contractorName && String(pr.contractorName).trim()) {
        contractorSet.add(String(pr.contractorName).trim());
      }
    }
    try {
      const companyRows = await db
        .select({ name: schema.orgCompanies.name })
        .from(schema.orgCompanies)
        .limit(200);
      for (const c of companyRows) {
        if (c.name?.trim()) contractorSet.add(c.name.trim());
      }
    } catch {
      // Optional table
    }

    const [nextScaffoldCode, checklistSettings] = await Promise.all([
      this.generateNextScaffoldCode(),
      this.getChecklistSettings(),
    ]);

    return {
      nextScaffoldCode,
      todayJalali: getShamsiToday(),
      defaultNextDueDate: getJalaliPlusDays(7),
      permits,
      orgUnits: Array.from(unitMap.values()),
      personnelList,
      contractors: Array.from(contractorSet).sort((a, b) => a.localeCompare(b, 'fa')),
      checklistTemplate: STANDARD_SCAFFOLD_CHECKLIST_ITEMS,
      checklistSettings,
      scaffoldTypes: SCAFFOLD_TYPES,
      inspectionReasons: SCAFFOLD_INSPECTION_REASONS,
      workflowSteps: SCAFFOLD_WORKFLOW_STEPS,
      tagMeta: SCAFFOLD_TAG_META,
    };
  }

  /**
   * List scaffolds with full filtering and live dashboard KPI metrics computed from PostgreSQL.
   */
  async listScaffolds(filters: ScaffoldListFilters = {}) {
    const conditions = [];

    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.scaffolds.scaffoldCode, q),
          ilike(schema.scaffolds.requestingUnit, q),
          ilike(schema.scaffolds.installationLocation, q),
          ilike(schema.scaffolds.areaName, q),
          ilike(schema.scaffolds.unitName, q),
          ilike(schema.scaffolds.equipmentName, q),
          ilike(schema.scaffolds.contractorName, q),
          ilike(schema.scaffolds.inspectorName, q),
          ilike(schema.scaffolds.permitNumber, q),
          ilike(schema.scaffolds.workRequestNumber, q),
          ilike(schema.scaffolds.activityDescription, q)
        )
      );
    }

    if (filters.unit?.trim() && filters.unit !== 'ALL') {
      conditions.push(
        or(
          eq(schema.scaffolds.requestingUnit, filters.unit.trim()),
          eq(schema.scaffolds.unitName, filters.unit.trim())
        )
      );
    }

    if (filters.contractor?.trim() && filters.contractor !== 'ALL') {
      conditions.push(ilike(schema.scaffolds.contractorName, `%${filters.contractor.trim()}%`));
    }

    if (filters.inspector?.trim() && filters.inspector !== 'ALL') {
      conditions.push(ilike(schema.scaffolds.inspectorName, `%${filters.inspector.trim()}%`));
    }

    if (filters.tagStatus?.trim() && filters.tagStatus !== 'ALL') {
      conditions.push(eq(schema.scaffolds.tagStatus, filters.tagStatus.trim().toUpperCase()));
    }

    if (filters.workflowStatus?.trim() && filters.workflowStatus !== 'ALL') {
      if (filters.workflowStatus === 'PENDING_INSPECTION') {
        conditions.push(
          inArray(schema.scaffolds.workflowStatus, ['INSTALLATION_REQUESTED', 'INSTALLATION_COMPLETED'])
        );
      } else if (filters.workflowStatus === 'OPEN_DEFECTS') {
        conditions.push(eq(schema.scaffolds.hasOpenDefects, true));
      } else {
        conditions.push(eq(schema.scaffolds.workflowStatus, filters.workflowStatus.trim()));
      }
    }

    if (filters.permitNumber?.trim()) {
      conditions.push(ilike(schema.scaffolds.permitNumber, `%${filters.permitNumber.trim()}%`));
    }

    const [items, allScaffoldsForKpi, totalInspectionsRow] = await Promise.all([
      db
        .select()
        .from(schema.scaffolds)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(schema.scaffolds.createdAt)),
      db
        .select({
          id: schema.scaffolds.id,
          tagStatus: schema.scaffolds.tagStatus,
          workflowStatus: schema.scaffolds.workflowStatus,
          hasOpenDefects: schema.scaffolds.hasOpenDefects,
          hasCriticalDefect: schema.scaffolds.hasCriticalDefect,
          openDefectsCount: schema.scaffolds.openDefectsCount,
          requestingUnit: schema.scaffolds.requestingUnit,
          contractorName: schema.scaffolds.contractorName,
          inspectorName: schema.scaffolds.inspectorName,
        })
        .from(schema.scaffolds),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(schema.scaffoldInspections),
    ]);

    const totalScaffolds = allScaffoldsForKpi.length;
    const greenTagCount = allScaffoldsForKpi.filter(s => s.tagStatus === 'GREEN').length;
    const yellowTagCount = allScaffoldsForKpi.filter(s => s.tagStatus === 'YELLOW').length;
    const redTagCount = allScaffoldsForKpi.filter(s => s.tagStatus === 'RED').length;
    const pendingInspectionCount = allScaffoldsForKpi.filter(s =>
      s.workflowStatus === 'INSTALLATION_REQUESTED' || s.workflowStatus === 'INSTALLATION_COMPLETED'
    ).length;
    const openDefectsScaffoldsCount = allScaffoldsForKpi.filter(s => s.hasOpenDefects).length;
    const openDefectsTotalItems = allScaffoldsForKpi.reduce((sum, s) => sum + (s.openDefectsCount || 0), 0);
    const criticalDefectsScaffoldsCount = allScaffoldsForKpi.filter(s => s.hasCriticalDefect).length;
    const totalInspectionsPerformed = Number(totalInspectionsRow[0]?.count || 0);

    const filterOptions = {
      units: Array.from(new Set(allScaffoldsForKpi.map(s => s.requestingUnit).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'fa')
      ),
      contractors: Array.from(new Set(allScaffoldsForKpi.map(s => s.contractorName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'fa')
      ),
      inspectors: Array.from(new Set(allScaffoldsForKpi.map(s => s.inspectorName).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'fa')
      ),
    };

    return {
      items,
      kpis: {
        totalScaffolds,
        greenTagCount,
        yellowTagCount,
        redTagCount,
        pendingInspectionCount,
        openDefectsScaffoldsCount,
        openDefectsTotalItems,
        criticalDefectsScaffoldsCount,
        totalInspectionsPerformed,
      },
      filterOptions,
    };
  }

  /**
   * Fetch full detail of a single scaffold including linked PTW, Work Request,
   * complete chronological inspections history, and immutable tag status audit trail.
   */
  async getScaffoldDetail(id: number) {
    const [scaffold] = await db
      .select()
      .from(schema.scaffolds)
      .where(eq(schema.scaffolds.id, id))
      .limit(1);

    if (!scaffold) {
      throw new NotFoundError('داربست مورد نظر');
    }

    const [inspections, tagHistory, linkedPermit] = await Promise.all([
      db
        .select()
        .from(schema.scaffoldInspections)
        .where(eq(schema.scaffoldInspections.scaffoldId, id))
        .orderBy(desc(schema.scaffoldInspections.createdAt), desc(schema.scaffoldInspections.id)),
      db
        .select()
        .from(schema.scaffoldTagHistory)
        .where(eq(schema.scaffoldTagHistory.scaffoldId, id))
        .orderBy(desc(schema.scaffoldTagHistory.createdAt), desc(schema.scaffoldTagHistory.id)),
      scaffold.permitId
        ? db
            .select({
              id: schema.workPermits.id,
              permitNumber: schema.workPermits.permitNumber,
              permitType: schema.workPermits.permitType,
              title: schema.workPermits.title,
              location: schema.workPermits.location,
              contractorName: schema.workPermits.contractorName,
              status: schema.workPermits.status,
              validFrom: schema.workPermits.validFrom,
              validTo: schema.workPermits.validTo,
            })
            .from(schema.workPermits)
            .where(eq(schema.workPermits.id, scaffold.permitId))
            .limit(1)
            .then(r => r[0] || null)
        : Promise.resolve(null),
    ]);

    return {
      scaffold,
      inspections,
      tagHistory,
      linkedPermit,
    };
  }

  /**
   * Resolve and validate real FK references (PTW, Work Request, Org Unit, HSE Inspector Personnel).
   */
  private async resolveExternalLinks(payload: Record<string, any>) {
    let permitId = parsePositiveIntOrNull(payload.permitId);
    let permitNumber = sanitizeOptionalString(payload.permitNumber, 80);

    if (permitId) {
      const [ptw] = await db
        .select({ id: schema.workPermits.id, permitNumber: schema.workPermits.permitNumber })
        .from(schema.workPermits)
        .where(eq(schema.workPermits.id, permitId))
        .limit(1);
      if (!ptw) {
        throw new ValidationError('پروانه کار (PTW) انتخاب‌شده در پایگاه داده یافت نشد.');
      }
      permitNumber = ptw.permitNumber;
    } else if (permitNumber) {
      const [ptwByNo] = await db
        .select({ id: schema.workPermits.id, permitNumber: schema.workPermits.permitNumber })
        .from(schema.workPermits)
        .where(eq(schema.workPermits.permitNumber, permitNumber))
        .limit(1);
      if (ptwByNo) {
        permitId = ptwByNo.id;
        permitNumber = ptwByNo.permitNumber;
      }
    }

    const workRequestId = null;
    const workRequestNumber = sanitizeOptionalString(payload.workRequestNumber, 80);

    let orgUnitId = parsePositiveIntOrNull(payload.orgUnitId);
    if (orgUnitId) {
      const [unit] = await db
        .select({ id: schema.orgUnits.id })
        .from(schema.orgUnits)
        .where(eq(schema.orgUnits.id, orgUnitId))
        .limit(1);
      if (!unit) orgUnitId = null;
    }

    let inspectorPersonnelId = parsePositiveIntOrNull(payload.inspectorPersonnelId);
    let inspectorPersonnelCode = sanitizeOptionalString(payload.inspectorPersonnelCode, 60);
    let inspectorName = sanitizeOptionalString(payload.inspectorName, 160);

    if (inspectorPersonnelId) {
      const [person] = await db
        .select({
          id: schema.personnel.id,
          personnelCode: schema.personnel.personnelCode,
          firstName: schema.personnel.firstName,
          lastName: schema.personnel.lastName,
        })
        .from(schema.personnel)
        .where(eq(schema.personnel.id, inspectorPersonnelId))
        .limit(1);
      if (person) {
        inspectorPersonnelCode = person.personnelCode;
        inspectorName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
      } else {
        inspectorPersonnelId = null;
      }
    } else if (inspectorPersonnelCode) {
      const [personByCode] = await db
        .select({
          id: schema.personnel.id,
          personnelCode: schema.personnel.personnelCode,
          firstName: schema.personnel.firstName,
          lastName: schema.personnel.lastName,
        })
        .from(schema.personnel)
        .where(eq(schema.personnel.personnelCode, inspectorPersonnelCode))
        .limit(1);
      if (personByCode) {
        inspectorPersonnelId = personByCode.id;
        inspectorName = inspectorName || `${personByCode.firstName || ''} ${personByCode.lastName || ''}`.trim();
      }
    }

    if (!inspectorName) {
      throw new ValidationError('انتخاب نام بازرس HSE از بانک اطلاعات پرسنلی الزامی است.');
    }

    return {
      permitId,
      permitNumber,
      workRequestId,
      workRequestNumber,
      orgUnitId,
      inspectorPersonnelId,
      inspectorPersonnelCode,
      inspectorName,
    };
  }

  /**
   * Register a new scaffold (always starts with RED tag unless accompanied by a verified initial 23-item checklist
   * and authorized HSE approval). If `initialInspection.checklistItems` is provided, creates the scaffold and its
   * first inspection record (`INSP-01`) atomically inside a single PostgreSQL transaction.
   */
  async createScaffold(
    payload: Record<string, any>,
    actor: UserContext,
    actorPerms: { canApprove: boolean; canChangeTag: boolean } = { canApprove: false, canChangeTag: false }
  ) {
    const requestDate = sanitizeRequiredString(payload.requestDate || getShamsiToday(), 'تاریخ درخواست نصب', 40);
    const requestingUnit = sanitizeRequiredString(payload.requestingUnit, 'واحد درخواست‌کننده', 160);
    const installationLocation = sanitizeRequiredString(payload.installationLocation, 'محل نصب داربست', 240);
    const activityDescription = sanitizeRequiredString(payload.activityDescription, 'شرح فعالیت و علت نصب داربست', 1500);
    const contractorName = sanitizeRequiredString(payload.contractorName, 'نام پیمانکار', 200);
    const erectorSupervisorName = sanitizeRequiredString(payload.erectorSupervisorName, 'نام مسئول نصب داربست', 160);
    const scaffoldType = sanitizeRequiredString(payload.scaffoldType, 'نوع داربست', 80);

    const heightMeters = Number(payload.heightMeters);
    if (!Number.isFinite(heightMeters) || heightMeters <= 0 || heightMeters > 200) {
      throw new ValidationError('ارتفاع داربست باید عددی معتبر و بزرگ‌تر از صفر (حداکثر ۲۰۰ متر) باشد.');
    }

    // Validate optional initial 23-item safety checklist before opening transaction
    const rawInitialInsp =
      payload.initialInspection && typeof payload.initialInspection === 'object'
        ? (payload.initialInspection as Record<string, any>)
        : null;
    const hasInitialChecklist = Boolean(
      rawInitialInsp && Array.isArray(rawInitialInsp.checklistItems) && rawInitialInsp.checklistItems.length > 0
    );

    let initialChecklistItems: ScaffoldChecklistResponseItem[] = [];
    let initialEvaluation: ReturnType<typeof evaluateScaffoldChecklist> | null = null;
    if (hasInitialChecklist) {
      const checklistSettings = await this.getChecklistSettings();
      initialChecklistItems = sanitizeChecklistItems(rawInitialInsp!.checklistItems, checklistSettings.allowNaOption);
      initialEvaluation = evaluateScaffoldChecklist(initialChecklistItems);
    }

    const links = await this.resolveExternalLinks(payload);
    const actorName = actor.name || actor.username || 'کاربر سامانه';
    const { jalaliDate, timeStr } = getTehranNowJalaliAndTime();
    const shortTime = timeStr.slice(0, 5);
    const signedAtStamp = `${jalaliDate} - ${shortTime}`;

    const installationCompletedDate =
      sanitizeOptionalString(payload.installationCompletedDate, 40) || (hasInitialChecklist ? jalaliDate : null);
    const baseWorkflowStatus: ScaffoldWorkflowStatus = installationCompletedDate
      ? 'INSTALLATION_COMPLETED'
      : 'INSTALLATION_REQUESTED';

    const beforePhotos = sanitizePhotos(payload.beforePhotos, 'BEFORE', actorName);
    const afterPhotos = sanitizePhotos(payload.afterPhotos, 'AFTER', actorName);

    return await withTransaction(async (tx) => {
      let scaffoldCode = await this.generateNextScaffoldCode(tx);

      // Protect against concurrent creation collisions
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [created] = await tx
            .insert(schema.scaffolds)
            .values({
              scaffoldCode,
              requestDate,
              requestingUnit,
              orgUnitId: links.orgUnitId,
              installationLocation,
              areaName: sanitizeOptionalString(payload.areaName, 160),
              unitName: sanitizeOptionalString(payload.unitName, 160) || requestingUnit,
              equipmentName: sanitizeOptionalString(payload.equipmentName, 200),
              activityDescription,
              permitId: links.permitId,
              permitNumber: links.permitNumber,
              workRequestId: links.workRequestId,
              workRequestNumber: links.workRequestNumber,
              contractorName,
              erectorSupervisorName,
              inspectorPersonnelId: links.inspectorPersonnelId,
              inspectorPersonnelCode: links.inspectorPersonnelCode,
              inspectorName: links.inspectorName,
              installationCompletedDate,
              heightMeters,
              scaffoldType,
              notes: sanitizeOptionalString(payload.notes, 2000),
              beforePhotos,
              afterPhotos,
              workflowStatus: baseWorkflowStatus,
              tagStatus: 'RED',
              tagIssuedAt: new Date(),
              tagIssuedBy: actorName,
              createdByUid: actor.uid,
              createdByName: actorName,
            })
            .returning();

          if (!hasInitialChecklist || !initialEvaluation) {
            await tx.insert(schema.scaffoldTagHistory).values({
              scaffoldId: created.id,
              previousTag: 'NONE',
              newTag: 'RED',
              previousWorkflowStatus: null,
              newWorkflowStatus: baseWorkflowStatus,
              reason: installationCompletedDate
                ? 'ثبت اولیه داربست (نصب تکمیل‌شده — در انتظار بازرسی HSE و تأیید نهایی)'
                : 'ثبت درخواست نصب داربست جدید — پیش از بازرسی و تأیید HSE استفاده ممنوع است',
              changedByUid: actor.uid,
              changedByName: actorName,
              changedByRole: actor.role,
              changedDateJalali: jalaliDate,
              changedTime: timeStr,
            });
            return created;
          }

          // Record initial 23-item safety checklist atomically as INSP-01
          const inspectionDate = sanitizeOptionalString(rawInitialInsp!.inspectionDate, 40) || jalaliDate;
          const inspectionTime = sanitizeOptionalString(rawInitialInsp!.inspectionTime, 20) || shortTime;
          const nextDueDate = sanitizeOptionalString(rawInitialInsp!.nextDueDate, 40) || getJalaliPlusDays(7);
          const inspectionNumber = `${created.scaffoldCode}-INSP-01`;
          const maxLoadVal =
            rawInitialInsp!.maxLoadCapacityKg !== undefined &&
            rawInitialInsp!.maxLoadCapacityKg !== null &&
            rawInitialInsp!.maxLoadCapacityKg !== ''
              ? Number(rawInitialInsp!.maxLoadCapacityKg)
              : null;

          const inspectorSig = sanitizeOptionalString(rawInitialInsp!.inspectorSignature, 160) || links.inspectorName;
          const unitSupervisorSig = sanitizeOptionalString(rawInitialInsp!.unitSupervisorSignature, 160);
          const signaturesMeta = sanitizeSignaturesMeta(rawInitialInsp!.signaturesMeta, {
            inspectorName: inspectorSig,
            inspectorPersonnelCode: links.inspectorPersonnelCode,
            unitSupervisorName: unitSupervisorSig,
            signedAt: signedAtStamp,
          });

          const [inspection] = await tx
            .insert(schema.scaffoldInspections)
            .values({
              scaffoldId: created.id,
              inspectionNumber,
              inspectionReason: 'INITIAL_POST_INSTALL',
              inspectionDate,
              inspectionTime,
              nextDueDate,
              inspectorPersonnelId: links.inspectorPersonnelId,
              inspectorPersonnelCode: links.inspectorPersonnelCode,
              inspectorName: links.inspectorName,
              inspectorUid: actor.uid,
              checklistItems: initialChecklistItems,
              totalItems: initialEvaluation.totalItems,
              passedCount: initialEvaluation.passedCount,
              failedCount: initialEvaluation.failedCount,
              naCount: initialEvaluation.naCount,
              criticalDefectCount: initialEvaluation.criticalDefectCount,
              complianceScore: initialEvaluation.complianceScore,
              overallResult: initialEvaluation.overallResult,
              recommendedTag: initialEvaluation.recommendedTag,
              summaryNotes: sanitizeOptionalString(rawInitialInsp!.summaryNotes, 2000),
              weatherCondition: sanitizeOptionalString(rawInitialInsp!.weatherCondition, 120),
              maxLoadCapacityKg: Number.isFinite(maxLoadVal) ? maxLoadVal : null,
              inspectorSignature: inspectorSig,
              unitSupervisorSignature: unitSupervisorSig,
              supervisorSignature: null,
              signaturesMeta,
            })
            .returning();

          let nextWorkflowStatus: ScaffoldWorkflowStatus = 'CHECKLIST_COMPLETED';
          let nextTagStatus: ScaffoldTagStatus = 'RED';
          let approvedBy: string | null = null;
          let approvedByUid: string | null = null;
          let approvedAt: Date | null = null;
          let approvalComment: string | null = null;
          let tagValidUntil: string | null = null;
          let tagChangeReason = `ثبت داربست و تکمیل چک‌لیست ایمنی نصب (${inspectionNumber}) — در انتظار تأیید نهایی بازرس مجاز HSE`;

          if (initialEvaluation.criticalDefectCount > 0) {
            nextWorkflowStatus = 'DEFECTS_REVIEW';
            nextTagStatus = 'RED';
            tagChangeReason = `ثبت ${initialEvaluation.criticalDefectCount} نقص بحرانی در چک‌لیست اولیه (${inspectionNumber}) — اعمال تگ قرمز و ممنوعیت استفاده`;
          } else if (initialEvaluation.openDefectsCount > 0) {
            nextWorkflowStatus = 'DEFECTS_REVIEW';
            nextTagStatus = 'YELLOW';
            tagChangeReason = `ثبت ${initialEvaluation.openDefectsCount} نقص غیربحرانی در چک‌لیست اولیه (${inspectionNumber}) — اعمال تگ زرد تا رفع نواقص`;
          } else if (
            Boolean(rawInitialInsp!.approveAndIssueGreenTag) &&
            actorPerms.canApprove &&
            actorPerms.canChangeTag
          ) {
            nextWorkflowStatus = 'AUTHORIZED_FOR_USE';
            nextTagStatus = 'GREEN';
            approvedBy = actorName;
            approvedByUid = actor.uid;
            approvedAt = new Date();
            approvalComment =
              sanitizeOptionalString(rawInitialInsp!.summaryNotes, 1000) ||
              'تأیید نهایی هم‌زمان با ثبت چک‌لیست ۲۳‌بندی بدون نقص';
            tagValidUntil = nextDueDate;
            tagChangeReason = `ثبت داربست و تأیید کامل چک‌لیست ایمنی (${inspectionNumber} — انطباق ${initialEvaluation.complianceScore}٪) و صدور تگ سبز`;
          }

          const [finalScaffold] = await tx
            .update(schema.scaffolds)
            .set({
              latestInspectionId: inspection.id,
              latestInspectionDate: inspectionDate,
              nextInspectionDueDate: nextDueDate,
              inspectionsCount: 1,
              hasOpenDefects: initialEvaluation.openDefectsCount > 0,
              hasCriticalDefect: initialEvaluation.criticalDefectCount > 0,
              openDefectsCount: initialEvaluation.openDefectsCount,
              criticalDefectsCount: initialEvaluation.criticalDefectCount,
              workflowStatus: nextWorkflowStatus,
              tagStatus: nextTagStatus,
              tagIssuedAt: new Date(),
              tagValidUntil,
              tagIssuedBy: actorName,
              approvedBy,
              approvedByUid,
              approvedAt,
              approvalComment,
              updatedAt: new Date(),
            })
            .where(eq(schema.scaffolds.id, created.id))
            .returning();

          await tx.insert(schema.scaffoldTagHistory).values({
            scaffoldId: created.id,
            inspectionId: inspection.id,
            previousTag: 'NONE',
            newTag: nextTagStatus,
            previousWorkflowStatus: null,
            newWorkflowStatus: nextWorkflowStatus,
            reason: tagChangeReason,
            validUntil: nextTagStatus === 'GREEN' ? tagValidUntil : null,
            changedByUid: actor.uid,
            changedByName: actorName,
            changedByRole: actor.role,
            changedDateJalali: jalaliDate,
            changedTime: timeStr,
          });

          return finalScaffold;
        } catch (err: any) {
          if (err?.code === '23505' && attempt < 2) {
            scaffoldCode = `${scaffoldCode}-${Math.floor(Math.random() * 90 + 10)}`;
            continue;
          }
          throw err;
        }
      }
      throw new ConflictError('تولید کد یکتای داربست با خطا مواجه شد؛ لطفاً مجدداً تلاش کنید.');
    });
  }

  /**
   * Update scaffold registration metadata.
   * Strictly ignores any client attempt to tamper with tagStatus, workflowStatus, approval, or defect flags.
   */
  async updateScaffold(id: number, payload: Record<string, any>, actor: UserContext) {
    const [existing] = await db
      .select()
      .from(schema.scaffolds)
      .where(eq(schema.scaffolds.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('داربست مورد نظر');
    }

    const requestDate = sanitizeRequiredString(payload.requestDate ?? existing.requestDate, 'تاریخ درخواست نصب', 40);
    const requestingUnit = sanitizeRequiredString(payload.requestingUnit ?? existing.requestingUnit, 'واحد درخواست‌کننده', 160);
    const installationLocation = sanitizeRequiredString(payload.installationLocation ?? existing.installationLocation, 'محل نصب داربست', 240);
    const activityDescription = sanitizeRequiredString(payload.activityDescription ?? existing.activityDescription, 'شرح فعالیت و علت نصب داربست', 1500);
    const contractorName = sanitizeRequiredString(payload.contractorName ?? existing.contractorName, 'نام پیمانکار', 200);
    const erectorSupervisorName = sanitizeRequiredString(payload.erectorSupervisorName ?? existing.erectorSupervisorName, 'نام مسئول نصب داربست', 160);
    const scaffoldType = sanitizeRequiredString(payload.scaffoldType ?? existing.scaffoldType, 'نوع داربست', 80);

    const heightMeters = Number(payload.heightMeters ?? existing.heightMeters);
    if (!Number.isFinite(heightMeters) || heightMeters <= 0 || heightMeters > 200) {
      throw new ValidationError('ارتفاع داربست باید عددی معتبر و بزرگ‌تر از صفر (حداکثر ۲۰۰ متر) باشد.');
    }

    const links = await this.resolveExternalLinks({
      permitId: payload.permitId !== undefined ? payload.permitId : existing.permitId,
      permitNumber: payload.permitNumber !== undefined ? payload.permitNumber : existing.permitNumber,
      workRequestNumber: payload.workRequestNumber !== undefined ? payload.workRequestNumber : existing.workRequestNumber,
      orgUnitId: payload.orgUnitId !== undefined ? payload.orgUnitId : existing.orgUnitId,
      inspectorPersonnelId: payload.inspectorPersonnelId !== undefined ? payload.inspectorPersonnelId : existing.inspectorPersonnelId,
      inspectorPersonnelCode: payload.inspectorPersonnelCode !== undefined ? payload.inspectorPersonnelCode : existing.inspectorPersonnelCode,
      inspectorName: payload.inspectorName !== undefined ? payload.inspectorName : existing.inspectorName,
    });

    const actorName = actor.name || actor.username || 'کاربر سامانه';
    const installationCompletedDate =
      payload.installationCompletedDate !== undefined
        ? sanitizeOptionalString(payload.installationCompletedDate, 40)
        : existing.installationCompletedDate;

    const beforePhotos =
      payload.beforePhotos !== undefined
        ? sanitizePhotos(payload.beforePhotos, 'BEFORE', actorName)
        : (existing.beforePhotos as any[]);
    const afterPhotos =
      payload.afterPhotos !== undefined
        ? sanitizePhotos(payload.afterPhotos, 'AFTER', actorName)
        : (existing.afterPhotos as any[]);

    // Advance from INSTALLATION_REQUESTED -> INSTALLATION_COMPLETED automatically if completion date was filled
    const nextWorkflowStatus =
      existing.workflowStatus === 'INSTALLATION_REQUESTED' && installationCompletedDate
        ? 'INSTALLATION_COMPLETED'
        : existing.workflowStatus;

    const [updated] = await db
      .update(schema.scaffolds)
      .set({
        requestDate,
        requestingUnit,
        orgUnitId: links.orgUnitId,
        installationLocation,
        areaName: payload.areaName !== undefined ? sanitizeOptionalString(payload.areaName, 160) : existing.areaName,
        unitName: payload.unitName !== undefined ? sanitizeOptionalString(payload.unitName, 160) : existing.unitName,
        equipmentName: payload.equipmentName !== undefined ? sanitizeOptionalString(payload.equipmentName, 200) : existing.equipmentName,
        activityDescription,
        permitId: links.permitId,
        permitNumber: links.permitNumber,
        workRequestId: links.workRequestId,
        workRequestNumber: links.workRequestNumber,
        contractorName,
        erectorSupervisorName,
        inspectorPersonnelId: links.inspectorPersonnelId,
        inspectorPersonnelCode: links.inspectorPersonnelCode,
        inspectorName: links.inspectorName,
        installationCompletedDate,
        heightMeters,
        scaffoldType,
        notes: payload.notes !== undefined ? sanitizeOptionalString(payload.notes, 2000) : existing.notes,
        beforePhotos,
        afterPhotos,
        workflowStatus: nextWorkflowStatus,
        version: (existing.version || 1) + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.scaffolds.id, id))
      .returning();

    return { previous: existing, updated };
  }

  /**
   * Mark scaffold installation as completed (stage 1 -> stage 2).
   */
  async completeInstallation(id: number, payload: Record<string, any>, actor: UserContext) {
    const [existing] = await db
      .select()
      .from(schema.scaffolds)
      .where(eq(schema.scaffolds.id, id))
      .limit(1);
    if (!existing) {
      throw new NotFoundError('داربست مورد نظر');
    }

    const actorName = actor.name || actor.username || 'کاربر سامانه';
    const completedDate = sanitizeOptionalString(payload.installationCompletedDate, 40) || getShamsiToday();
    const afterPhotos =
      payload.afterPhotos !== undefined
        ? sanitizePhotos(payload.afterPhotos, 'AFTER', actorName)
        : (existing.afterPhotos as any[]);

    const nextWorkflowStatus =
      existing.workflowStatus === 'INSTALLATION_REQUESTED' ? 'INSTALLATION_COMPLETED' : existing.workflowStatus;

    const [updated] = await db
      .update(schema.scaffolds)
      .set({
        installationCompletedDate: completedDate,
        afterPhotos,
        workflowStatus: nextWorkflowStatus,
        version: (existing.version || 1) + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.scaffolds.id, id))
      .returning();

    return { previous: existing, updated };
  }

  /**
   * Record a new initial, periodic, or event-triggered inspection (preserves all historical inspections).
   * Enforces critical defect safety rules automatically.
   */
  async recordInspection(
    scaffoldId: number,
    payload: Record<string, any>,
    actor: UserContext,
    actorPerms: { canApprove: boolean; canChangeTag: boolean }
  ) {
    const [existing] = await db
      .select()
      .from(schema.scaffolds)
      .where(eq(schema.scaffolds.id, scaffoldId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('داربست مورد نظر');
    }

    const reasonRaw = String(payload.inspectionReason || 'INITIAL_POST_INSTALL').trim();
    if (!VALID_REASONS.has(reasonRaw)) {
      throw new ValidationError('علت بازرسی انتخاب‌شده معتبر نیست.');
    }
    const inspectionReason = reasonRaw as ScaffoldInspectionReason;

    const checklistSettings = await this.getChecklistSettings();
    const checklistItems = sanitizeChecklistItems(payload.checklistItems, checklistSettings.allowNaOption);
    const evaluation = evaluateScaffoldChecklist(checklistItems);

    const { jalaliDate, timeStr } = getTehranNowJalaliAndTime();
    const inspectionDate = sanitizeOptionalString(payload.inspectionDate, 40) || jalaliDate;
    const inspectionTime = sanitizeOptionalString(payload.inspectionTime, 20) || timeStr.slice(0, 5);
    const nextDueDate = sanitizeOptionalString(payload.nextDueDate, 40) || getJalaliPlusDays(7);
    const signedAtStamp = `${inspectionDate} - ${inspectionTime}`;

    // Resolve inspector identity
    let inspectorPersonnelId = parsePositiveIntOrNull(payload.inspectorPersonnelId) ?? existing.inspectorPersonnelId;
    let inspectorPersonnelCode =
      sanitizeOptionalString(payload.inspectorPersonnelCode, 60) ?? existing.inspectorPersonnelCode;
    let inspectorName =
      sanitizeOptionalString(payload.inspectorName, 160) ||
      existing.inspectorName ||
      actor.name ||
      actor.username ||
      'بازرس HSE';

    if (inspectorPersonnelId) {
      const [person] = await db
        .select({
          id: schema.personnel.id,
          personnelCode: schema.personnel.personnelCode,
          firstName: schema.personnel.firstName,
          lastName: schema.personnel.lastName,
        })
        .from(schema.personnel)
        .where(eq(schema.personnel.id, inspectorPersonnelId))
        .limit(1);
      if (person) {
        inspectorPersonnelCode = person.personnelCode;
        inspectorName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
      }
    }

    const maxLoadCapacityKg =
      payload.maxLoadCapacityKg !== undefined && payload.maxLoadCapacityKg !== null && payload.maxLoadCapacityKg !== ''
        ? Number(payload.maxLoadCapacityKg)
        : null;

    const actorName = actor.name || actor.username || inspectorName;
    const inspectorSig = sanitizeOptionalString(payload.inspectorSignature, 160) || inspectorName;
    const unitSupervisorSig = sanitizeOptionalString(payload.unitSupervisorSignature, 160);
    const signaturesMeta = sanitizeSignaturesMeta(payload.signaturesMeta, {
      inspectorName: inspectorSig,
      inspectorPersonnelCode,
      unitSupervisorName: unitSupervisorSig,
      signedAt: signedAtStamp,
    });

    return await withTransaction(async (tx) => {
      const nextCount = (existing.inspectionsCount || 0) + 1;
      const inspectionNumber = `${existing.scaffoldCode}-INSP-${String(nextCount).padStart(2, '0')}`;

      const [inspection] = await tx
        .insert(schema.scaffoldInspections)
        .values({
          scaffoldId,
          inspectionNumber,
          inspectionReason,
          inspectionDate,
          inspectionTime,
          nextDueDate,
          inspectorPersonnelId,
          inspectorPersonnelCode,
          inspectorName,
          inspectorUid: actor.uid,
          checklistItems,
          totalItems: evaluation.totalItems,
          passedCount: evaluation.passedCount,
          failedCount: evaluation.failedCount,
          naCount: evaluation.naCount,
          criticalDefectCount: evaluation.criticalDefectCount,
          complianceScore: evaluation.complianceScore,
          overallResult: evaluation.overallResult,
          recommendedTag: evaluation.recommendedTag,
          summaryNotes: sanitizeOptionalString(payload.summaryNotes, 2000),
          weatherCondition: sanitizeOptionalString(payload.weatherCondition, 120),
          maxLoadCapacityKg: Number.isFinite(maxLoadCapacityKg) ? maxLoadCapacityKg : null,
          inspectorSignature: inspectorSig,
          unitSupervisorSignature: unitSupervisorSig,
          supervisorSignature: null,
          signaturesMeta,
        })
        .returning();

      const previousTag = (existing.tagStatus || 'RED') as ScaffoldTagStatus;
      const previousWorkflow = existing.workflowStatus;

      let nextWorkflowStatus: ScaffoldWorkflowStatus;
      let nextTagStatus: ScaffoldTagStatus = previousTag;
      let tagChangeReason: string | null = null;
      let approvedBy = existing.approvedBy;
      let approvedByUid = existing.approvedByUid;
      let approvedAt = existing.approvedAt;
      let approvalComment = existing.approvalComment;
      let tagValidUntil = existing.tagValidUntil;
      let tagIssuedAt = existing.tagIssuedAt;
      let tagIssuedBy = existing.tagIssuedBy;

      if (evaluation.criticalDefectCount > 0) {
        // Hard safety block: critical defect forces RED tag and revokes any previous approval
        nextWorkflowStatus = 'DEFECTS_REVIEW';
        nextTagStatus = 'RED';
        approvedBy = null;
        approvedByUid = null;
        approvedAt = null;
        approvalComment = null;
        tagValidUntil = null;
        tagIssuedAt = new Date();
        tagIssuedBy = actorName;
        tagChangeReason = `ثبت ${evaluation.criticalDefectCount} نقص بحرانی در بازرسی ${inspectionNumber} — تعلیق فوری و اعمال تگ قرمز (غیرمجاز)`;
      } else if (evaluation.openDefectsCount > 0) {
        // Non-critical open defects block GREEN tag -> set YELLOW & revoke approval
        nextWorkflowStatus = 'DEFECTS_REVIEW';
        nextTagStatus = 'YELLOW';
        approvedBy = null;
        approvedByUid = null;
        approvedAt = null;
        approvalComment = null;
        tagValidUntil = null;
        tagIssuedAt = new Date();
        tagIssuedBy = actorName;
        tagChangeReason = `ثبت ${evaluation.openDefectsCount} نقص باز در بازرسی ${inspectionNumber} — اعمال تگ زرد و ممنوعیت استفاده تا رفع نواقص و بازرسی مجدد`;
      } else {
        // Zero open defects!
        const wantsAutoApprove = Boolean(payload.approveAndIssueGreenTag);
        if (wantsAutoApprove && actorPerms.canApprove && actorPerms.canChangeTag) {
          nextWorkflowStatus = 'AUTHORIZED_FOR_USE';
          nextTagStatus = 'GREEN';
          approvedBy = actorName;
          approvedByUid = actor.uid;
          approvedAt = new Date();
          approvalComment = sanitizeOptionalString(payload.summaryNotes, 1000) || 'تأیید نهایی پس از تکمیل موفق چک‌لیست استاندارد داربست';
          tagValidUntil = nextDueDate;
          tagIssuedAt = new Date();
          tagIssuedBy = actorName;
          tagChangeReason = `تأیید کامل چک‌لیست در بازرسی ${inspectionNumber} (انطباق ${evaluation.complianceScore}٪) و صدور تگ سبز`;
        } else {
          nextWorkflowStatus = 'CHECKLIST_COMPLETED';
          // Keep non-green tag until formally approved (if it was RED, move to YELLOW awaiting approval or keep RED)
          if (previousTag === 'GREEN') {
            // Periodic re-inspection passed with 0 defects on an already GREEN scaffold -> refresh validity if authorized
            if (actorPerms.canApprove && actorPerms.canChangeTag) {
              nextWorkflowStatus = 'AUTHORIZED_FOR_USE';
              nextTagStatus = 'GREEN';
              approvedBy = actorName;
              approvedByUid = actor.uid;
              approvedAt = new Date();
              tagValidUntil = nextDueDate;
              tagIssuedAt = new Date();
              tagIssuedBy = actorName;
              tagChangeReason = `تمدید اعتبار تگ سبز پس از بازرسی مجدد ${inspectionNumber} بدون نقص`;
            } else {
              nextTagStatus = 'YELLOW';
              approvedBy = null;
              approvedByUid = null;
              approvedAt = null;
              tagChangeReason = `تکمیل بازرسی ${inspectionNumber} — در انتظار تأیید نهایی بازرس مجاز HSE`;
            }
          }
        }
      }

      const [updatedScaffold] = await tx
        .update(schema.scaffolds)
        .set({
          installationCompletedDate: existing.installationCompletedDate || inspectionDate,
          latestInspectionId: inspection.id,
          latestInspectionDate: inspectionDate,
          nextInspectionDueDate: nextDueDate,
          inspectionsCount: nextCount,
          hasOpenDefects: evaluation.openDefectsCount > 0,
          hasCriticalDefect: evaluation.criticalDefectCount > 0,
          openDefectsCount: evaluation.openDefectsCount,
          criticalDefectsCount: evaluation.criticalDefectCount,
          workflowStatus: nextWorkflowStatus,
          tagStatus: nextTagStatus,
          tagIssuedAt,
          tagValidUntil,
          tagIssuedBy,
          approvedBy,
          approvedByUid,
          approvedAt,
          approvalComment,
          version: (existing.version || 1) + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.scaffolds.id, scaffoldId))
        .returning();

      if (tagChangeReason && (nextTagStatus !== previousTag || nextWorkflowStatus !== previousWorkflow)) {
        await tx.insert(schema.scaffoldTagHistory).values({
          scaffoldId,
          inspectionId: inspection.id,
          previousTag,
          newTag: nextTagStatus,
          previousWorkflowStatus: previousWorkflow,
          newWorkflowStatus: nextWorkflowStatus,
          reason: tagChangeReason,
          validUntil: nextTagStatus === 'GREEN' ? tagValidUntil : null,
          changedByUid: actor.uid,
          changedByName: actorName,
          changedByRole: actor.role,
          changedDateJalali: jalaliDate,
          changedTime: timeStr,
        });
      }

      return {
        scaffold: updatedScaffold,
        inspection,
        evaluation,
      };
    });
  }

  /**
   * Final HSE Inspector Approval (Stage 6 -> optionally Stage 7/8 with GREEN tag).
   * STRICTLY BLOCKED if no inspection recorded, OR if any critical/open defects exist.
   */
  async approveScaffold(
    scaffoldId: number,
    payload: Record<string, any>,
    actor: UserContext,
    canIssueTag: boolean
  ) {
    const [existing] = await db
      .select()
      .from(schema.scaffolds)
      .where(eq(schema.scaffolds.id, scaffoldId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('داربست مورد نظر');
    }

    if (!existing.latestInspectionId || (existing.inspectionsCount || 0) === 0) {
      throw new AppError(
        'پیش از تأیید نهایی، ثبت حداقل یک بازرسی کامل با چک‌لیست استاندارد داربست الزامی است.',
        422,
        'INSPECTION_REQUIRED'
      );
    }

    if (existing.hasCriticalDefect || (existing.criticalDefectsCount || 0) > 0) {
      throw new AppError(
        `داربست دارای ${existing.criticalDefectsCount || 1} نقص بحرانی باز است؛ تأیید نهایی و صدور مجوز استفاده اکیداً ممنوع است.`,
        422,
        'CRITICAL_DEFECT_BLOCKER',
        { criticalDefectsCount: existing.criticalDefectsCount }
      );
    }

    if (existing.hasOpenDefects || (existing.openDefectsCount || 0) > 0) {
      throw new AppError(
        `تعداد ${existing.openDefectsCount || 1} نقص باز در آخرین چک‌لیست وجود دارد؛ تا زمان رفع نواقص و ثبت بازرسی مجدد، تأیید نهایی مجاز نیست.`,
        422,
        'OPEN_DEFECTS_BLOCKER',
        { openDefectsCount: existing.openDefectsCount }
      );
    }

    const issueGreenTag = payload.issueGreenTag !== false && canIssueTag;
    const validUntil = sanitizeOptionalString(payload.tagValidUntil, 40) || existing.nextInspectionDueDate || getJalaliPlusDays(7);
    const comment = sanitizeOptionalString(payload.comment, 1000) || 'تأیید نهایی بازرس مجاز HSE بر اساس انطباق کامل چک‌لیست';
    const actorName = actor.name || actor.username || 'بازرس HSE';
    const { jalaliDate, timeStr } = getTehranNowJalaliAndTime();

    return await withTransaction(async (tx) => {
      const previousTag = (existing.tagStatus || 'RED') as ScaffoldTagStatus;
      const previousWorkflow = existing.workflowStatus;
      const nextTag: ScaffoldTagStatus = issueGreenTag ? 'GREEN' : previousTag;
      const nextWorkflow: ScaffoldWorkflowStatus = issueGreenTag ? 'AUTHORIZED_FOR_USE' : 'APPROVED_BY_INSPECTOR';

      const [updated] = await tx
        .update(schema.scaffolds)
        .set({
          approvedBy: actorName,
          approvedByUid: actor.uid,
          approvedAt: new Date(),
          approvalComment: comment,
          workflowStatus: nextWorkflow,
          tagStatus: nextTag,
          tagIssuedAt: issueGreenTag ? new Date() : existing.tagIssuedAt,
          tagValidUntil: issueGreenTag ? validUntil : existing.tagValidUntil,
          tagIssuedBy: issueGreenTag ? actorName : existing.tagIssuedBy,
          version: (existing.version || 1) + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.scaffolds.id, scaffoldId))
        .returning();

      await tx.insert(schema.scaffoldTagHistory).values({
        scaffoldId,
        inspectionId: existing.latestInspectionId,
        previousTag,
        newTag: nextTag,
        previousWorkflowStatus: previousWorkflow,
        newWorkflowStatus: nextWorkflow,
        reason: issueGreenTag
          ? `تأیید نهایی بازرس HSE و صدور تگ سبز (مجاز به استفاده): ${comment}`
          : `تأیید نهایی بازرس HSE (در انتظار صدور تگ): ${comment}`,
        validUntil: issueGreenTag ? validUntil : null,
        changedByUid: actor.uid,
        changedByName: actorName,
        changedByRole: actor.role,
        changedDateJalali: jalaliDate,
        changedTime: timeStr,
      });

      return { previous: existing, updated };
    });
  }

  /**
   * Explicitly change scaffold color tag (GREEN | YELLOW | RED) with mandatory reason & immutable audit history.
   * STRICTLY blocks issuing GREEN tag if critical/open defects exist or scaffold is not inspected/approved.
   */
  async changeTagStatus(scaffoldId: number, payload: Record<string, any>, actor: UserContext) {
    const [existing] = await db
      .select()
      .from(schema.scaffolds)
      .where(eq(schema.scaffolds.id, scaffoldId))
      .limit(1);

    if (!existing) {
      throw new NotFoundError('داربست مورد نظر');
    }

    const newTagRaw = String(payload.newTag || '').toUpperCase().trim() as ScaffoldTagStatus;
    if (!VALID_TAGS.includes(newTagRaw)) {
      throw new ValidationError('وضعیت تگ باید یکی از مقادیر GREEN (سبز)، YELLOW (زرد) یا RED (قرمز) باشد.');
    }

    const reason = sanitizeRequiredString(payload.reason, 'علت تغییر وضعیت تگ', 1000);
    const actorName = actor.name || actor.username || 'بازرس HSE';
    const { jalaliDate, timeStr } = getTehranNowJalaliAndTime();

    if (newTagRaw === 'GREEN') {
      if (!existing.latestInspectionId || (existing.inspectionsCount || 0) === 0) {
        throw new AppError(
          'صدور تگ سبز بدون ثبت بازرسی و تکمیل چک‌لیست استاندارد داربست ممنوع است.',
          422,
          'INSPECTION_REQUIRED'
        );
      }
      if (existing.hasCriticalDefect || (existing.criticalDefectsCount || 0) > 0) {
        throw new AppError(
          'به علت وجود نقص بحرانی باز، صدور تگ سبز و مجاز کردن استفاده از داربست اکیداً ممنوع است.',
          422,
          'CRITICAL_DEFECT_BLOCKER',
          { criticalDefectsCount: existing.criticalDefectsCount }
        );
      }
      if (existing.hasOpenDefects || (existing.openDefectsCount || 0) > 0) {
        throw new AppError(
          'به علت وجود نواقص باز در آخرین بازرسی، صدور تگ سبز مجاز نیست. ابتدا نواقص را رفع و بازرسی مجدد ثبت نمایید.',
          422,
          'OPEN_DEFECTS_BLOCKER',
          { openDefectsCount: existing.openDefectsCount }
        );
      }
      const isApproved =
        Boolean(existing.approvedAt) ||
        existing.workflowStatus === 'APPROVED_BY_INSPECTOR' ||
        existing.workflowStatus === 'TAG_ISSUED' ||
        existing.workflowStatus === 'AUTHORIZED_FOR_USE';
      if (!isApproved) {
        throw new AppError(
          'پیش از صدور تگ سبز، تأیید نهایی بازرس مجاز HSE بر روی داربست الزامی است.',
          422,
          'APPROVAL_REQUIRED'
        );
      }
    }

    const validUntil =
      newTagRaw === 'GREEN'
        ? sanitizeOptionalString(payload.validUntil, 40) || existing.nextInspectionDueDate || getJalaliPlusDays(7)
        : null;

    const previousTag = (existing.tagStatus || 'RED') as ScaffoldTagStatus;
    const previousWorkflow = existing.workflowStatus;

    let nextWorkflow: ScaffoldWorkflowStatus;
    if (newTagRaw === 'GREEN') {
      nextWorkflow = 'AUTHORIZED_FOR_USE';
    } else if (newTagRaw === 'YELLOW') {
      nextWorkflow = 'DEFECTS_REVIEW';
    } else {
      nextWorkflow = 'DEFECTS_REVIEW';
    }

    const revokeApproval = newTagRaw !== 'GREEN';

    return await withTransaction(async (tx) => {
      const [updated] = await tx
        .update(schema.scaffolds)
        .set({
          tagStatus: newTagRaw,
          tagIssuedAt: new Date(),
          tagValidUntil: validUntil,
          tagIssuedBy: actorName,
          workflowStatus: nextWorkflow,
          approvedBy: revokeApproval ? null : existing.approvedBy,
          approvedByUid: revokeApproval ? null : existing.approvedByUid,
          approvedAt: revokeApproval ? null : existing.approvedAt,
          version: (existing.version || 1) + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.scaffolds.id, scaffoldId))
        .returning();

      const [historyEntry] = await tx
        .insert(schema.scaffoldTagHistory)
        .values({
          scaffoldId,
          inspectionId: existing.latestInspectionId,
          previousTag,
          newTag: newTagRaw,
          previousWorkflowStatus: previousWorkflow,
          newWorkflowStatus: nextWorkflow,
          reason,
          validUntil,
          changedByUid: actor.uid,
          changedByName: actorName,
          changedByRole: actor.role,
          changedDateJalali: jalaliDate,
          changedTime: timeStr,
        })
        .returning();

      return { previous: existing, updated, historyEntry };
    });
  }

  /**
   * Delete scaffold (cascade deletes its inspections and tag history).
   */
  async deleteScaffold(id: number) {
    const [existing] = await db
      .select()
      .from(schema.scaffolds)
      .where(eq(schema.scaffolds.id, id))
      .limit(1);
    if (!existing) {
      throw new NotFoundError('داربست مورد نظر');
    }
    await db.delete(schema.scaffolds).where(eq(schema.scaffolds.id, id));
    return existing;
  }

  /**
   * Management summary report data (grouped by unit, contractor, tag color).
   */
  async getManagementReport(filters: ScaffoldListFilters = {}) {
    const { items, kpis } = await this.listScaffolds(filters);
    const byUnitMap = new Map<string, { unit: string; total: number; green: number; yellow: number; red: number; openDefects: number }>();
    const byContractorMap = new Map<string, { contractor: string; total: number; green: number; yellow: number; red: number; openDefects: number }>();

    for (const s of items) {
      const unitKey = s.requestingUnit || 'نامشخص';
      const u = byUnitMap.get(unitKey) || { unit: unitKey, total: 0, green: 0, yellow: 0, red: 0, openDefects: 0 };
      u.total += 1;
      if (s.tagStatus === 'GREEN') u.green += 1;
      else if (s.tagStatus === 'YELLOW') u.yellow += 1;
      else u.red += 1;
      if (s.hasOpenDefects) u.openDefects += 1;
      byUnitMap.set(unitKey, u);

      const contKey = s.contractorName || 'نامشخص';
      const c = byContractorMap.get(contKey) || { contractor: contKey, total: 0, green: 0, yellow: 0, red: 0, openDefects: 0 };
      c.total += 1;
      if (s.tagStatus === 'GREEN') c.green += 1;
      else if (s.tagStatus === 'YELLOW') c.yellow += 1;
      else c.red += 1;
      if (s.hasOpenDefects) c.openDefects += 1;
      byContractorMap.set(contKey, c);
    }

    return {
      generatedAtJalali: getShamsiToday(),
      kpis,
      byUnit: Array.from(byUnitMap.values()),
      byContractor: Array.from(byContractorMap.values()),
      items,
    };
  }
}

export const scaffoldingService = new ScaffoldingService();
