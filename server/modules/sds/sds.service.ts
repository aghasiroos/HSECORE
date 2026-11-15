import { v4 as uuidv4 } from 'uuid';
import { eq, and, isNull, desc, ne, sql } from 'drizzle-orm';
import { Request } from 'express';
import { db, schema } from '../../core/db.ts';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../../core/errors.ts';
import { logger } from '../../core/logger.ts';
import { auditService } from '../audit/audit.service.ts';
import { fileService, normalizeUploadedFilename } from '../files/file.service.ts';
import { broadcastDataMutation } from '../../core/socket.ts';
import {
  SdsRecordDTO,
  SdsRevisionDTO,
  SdsAttachmentDTO,
  SdsDashboardStats,
  SdsStatus,
  SdsAttachmentRole,
  SdsGhsData,
  SdsSections16,
  normalizeCasNumber,
  normalizeMaterialName,
  createEmptySections16,
  createDefaultGhsData,
} from './sds.types.ts';

const VALID_STATUSES = new Set<SdsStatus>([
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'OBSOLETE',
]);

const VALID_ATTACHMENT_ROLES = new Set<SdsAttachmentRole>([
  'PRIMARY_SDS_PDF',
  'TECHNICAL_SPEC',
  'COA',
  'STORAGE_INSTRUCTION',
  'TRANSPORT_DOC',
  'OTHER',
]);

const MANAGER_APPROVER_ROLES = new Set([
  'ADMIN',
  'ADMINISTRATOR',
  'HSE_MANAGER',
  'PROCESS_MANAGER',
]);

function normalizeRoleKey(role?: string | null): string {
  return String(role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

export function canUserApproveOrPublishSds(user?: Request['user']): boolean {
  if (!user) return false;
  const roleKey = normalizeRoleKey(user.role);
  if (MANAGER_APPROVER_ROLES.has(roleKey)) return true;
  const perms = user.permissions || [];
  if (perms.includes('*') || perms.includes('documents:*') || perms.includes('documents:approve')) {
    return true;
  }
  return false;
}

function mergeGhsData(raw: any): SdsGhsData {
  const base = createDefaultGhsData();
  if (!raw || typeof raw !== 'object') return base;
  return {
    hazardClasses: Array.isArray(raw.hazardClasses) ? raw.hazardClasses.filter(Boolean) : [],
    pictograms: Array.isArray(raw.pictograms) ? raw.pictograms.filter(Boolean) : [],
    signalWord:
      raw.signalWord === 'DANGER' || raw.signalWord === 'WARNING' || raw.signalWord === 'NONE'
        ? raw.signalWord
        : 'NONE',
    hStatements: Array.isArray(raw.hStatements) ? raw.hStatements.filter(Boolean) : [],
    pStatements: Array.isArray(raw.pStatements) ? raw.pStatements.filter(Boolean) : [],
    exposureRoutes: Array.isArray(raw.exposureRoutes) ? raw.exposureRoutes.filter(Boolean) : [],
    healthHazardsSummary: raw.healthHazardsSummary || '',
    physicalHazardsSummary: raw.physicalHazardsSummary || '',
    environmentalHazardsSummary: raw.environmentalHazardsSummary || '',
  };
}

function mergeSections16(raw: any, fallbackIdentifier = ''): SdsSections16 {
  const base = createEmptySections16(fallbackIdentifier);
  if (!raw || typeof raw !== 'object') return base;
  const merged: any = { ...base };
  for (let i = 1; i <= 16; i++) {
    const key = `section${i}` as keyof SdsSections16;
    if (raw[key] && typeof raw[key] === 'object') {
      merged[key] = { ...(base[key] as any), ...raw[key] };
    }
  }
  if (!Array.isArray(merged.section3?.ingredients)) {
    merged.section3 = { ...(merged.section3 || {}), ingredients: [] };
  }
  return merged as SdsSections16;
}

function mapAttachmentRow(row: typeof schema.sdsAttachments.$inferSelect): SdsAttachmentDTO {
  const originalName = normalizeUploadedFilename(row.originalName);
  return {
    id: row.id,
    sdsId: row.sdsId,
    fileId: row.fileId,
    attachmentRole: (VALID_ATTACHMENT_ROLES.has(row.attachmentRole as SdsAttachmentRole)
      ? row.attachmentRole
      : 'OTHER') as SdsAttachmentRole,
    title: row.title || originalName,
    originalName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    isPrimary: Boolean(row.isPrimary),
    notes: row.notes || '',
    uploadedBy: row.uploadedBy || 'کاربر سیستم',
    uploaderRole: row.uploaderRole || undefined,
    createdAt: row.createdAt.toISOString(),
    downloadUrl: `/api/v1/files/${row.fileId}/download`,
    previewUrl: `/api/v1/files/${row.fileId}/preview`,
  };
}

function mapRevisionRow(row: typeof schema.sdsRevisions.$inferSelect): SdsRevisionDTO {
  return {
    id: row.id,
    sdsId: row.sdsId,
    revisionNumber: row.revisionNumber,
    statusAtSnapshot: (VALID_STATUSES.has(row.statusAtSnapshot as SdsStatus)
      ? row.statusAtSnapshot
      : 'DRAFT') as SdsStatus,
    changeSummary: row.changeSummary || '',
    triggerReason: row.triggerReason || '',
    snapshot: row.snapshot || {},
    createdBy: row.createdBy || 'کاربر سیستم',
    editorName: row.editorName || row.createdBy || 'کاربر سیستم',
    approverName: row.approverName || undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildSnapshotPayload(row: typeof schema.sdsRecords.$inferSelect) {
  return {
    documentNumber: row.documentNumber,
    materialNameFa: row.materialNameFa,
    materialNameEn: row.materialNameEn,
    tradeName: row.tradeName || '',
    casNumber: row.casNumber || '',
    unNumber: row.unNumber || '',
    manufacturer: row.manufacturer || '',
    supplier: row.supplier || '',
    unitName: row.unitName,
    storageLocation: row.storageLocation || '',
    physicalState: row.physicalState,
    revisionNumber: row.revisionNumber,
    preparedDate: row.preparedDate,
    lastRevisionDate: row.lastRevisionDate || '',
    revisionTriggerReason: row.revisionTriggerReason || '',
    status: row.status,
    primaryFileId: row.primaryFileId || null,
    ghsData: mergeGhsData(row.ghsData),
    sections: mergeSections16(row.sections, row.materialNameEn || row.materialNameFa),
  };
}

function mapRecordRow(
  row: typeof schema.sdsRecords.$inferSelect,
  attachments: SdsAttachmentDTO[] = [],
  revisions?: SdsRevisionDTO[]
): SdsRecordDTO {
  const activeAttachments = attachments;
  const hasPrimaryPdf =
    Boolean(row.primaryFileId) ||
    activeAttachments.some(
      (a) =>
        (a.isPrimary || a.attachmentRole === 'PRIMARY_SDS_PDF') &&
        a.mimeType === 'application/pdf'
    );

  return {
    id: row.id,
    sdsUid: row.sdsUid,
    documentNumber: row.documentNumber,
    materialNameFa: row.materialNameFa,
    materialNameEn: row.materialNameEn,
    tradeName: row.tradeName || '',
    casNumber: row.casNumber || '',
    unNumber: row.unNumber || '',
    manufacturer: row.manufacturer || '',
    supplier: row.supplier || '',
    unitId: row.unitId ?? null,
    unitName: row.unitName || 'عمومی مجتمع',
    storageLocation: row.storageLocation || '',
    physicalState: (row.physicalState || 'LIQUID') as any,
    revisionNumber: row.revisionNumber || 1,
    preparedDate: row.preparedDate,
    lastRevisionDate: row.lastRevisionDate || '',
    revisionTriggerReason: row.revisionTriggerReason || '',
    needsRevision: Boolean(row.needsRevision),
    reviewAlertMessage: row.reviewAlertMessage || '',
    status: (VALID_STATUSES.has(row.status as SdsStatus) ? row.status : 'DRAFT') as SdsStatus,
    ghsData: mergeGhsData(row.ghsData),
    sections: mergeSections16(row.sections, row.materialNameEn || row.materialNameFa),
    primaryFileId: row.primaryFileId || null,
    aiExtractionMetadata: (row.aiExtractionMetadata as any) || {},
    linkedRiskRefs: (row.linkedRiskRefs as any) || {},
    createdBy: row.createdBy || 'کاربر سیستم',
    createdByRole: row.createdByRole || '',
    updatedBy: row.updatedBy || row.createdBy || 'کاربر سیستم',
    reviewedBy: row.reviewedBy || undefined,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    approvedBy: row.approvedBy || undefined,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    publishedBy: row.publishedBy || undefined,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    obsoleteReason: row.obsoleteReason || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    attachments: activeAttachments,
    revisions,
    attachmentCount: activeAttachments.length,
    hasPrimaryPdf,
  };
}

let sdsTablesEnsured = false;

export class SdsService {
  private async ensureTablesExist(): Promise<void> {
    if (sdsTablesEnsured) return;
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sds_records (
          id SERIAL PRIMARY KEY,
          sds_uid TEXT NOT NULL UNIQUE,
          document_number TEXT NOT NULL,
          material_name_fa TEXT NOT NULL,
          material_name_en TEXT NOT NULL,
          material_name_normalized TEXT NOT NULL,
          trade_name TEXT,
          cas_number TEXT,
          cas_number_normalized TEXT,
          un_number TEXT,
          manufacturer TEXT,
          supplier TEXT,
          unit_id INTEGER,
          unit_name TEXT DEFAULT 'عمومی مجتمع' NOT NULL,
          storage_location TEXT,
          physical_state TEXT DEFAULT 'LIQUID' NOT NULL,
          revision_number INTEGER DEFAULT 1 NOT NULL,
          prepared_date TEXT NOT NULL,
          last_revision_date TEXT,
          revision_trigger_reason TEXT,
          needs_revision BOOLEAN DEFAULT FALSE NOT NULL,
          review_alert_message TEXT,
          status TEXT DEFAULT 'DRAFT' NOT NULL,
          ghs_data JSONB DEFAULT '{}'::jsonb NOT NULL,
          sections JSONB DEFAULT '{}'::jsonb NOT NULL,
          primary_file_id TEXT,
          ai_extraction_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
          linked_refs JSONB DEFAULT '{}'::jsonb NOT NULL,
          created_by TEXT,
          created_by_role TEXT,
          updated_by TEXT,
          reviewed_by TEXT,
          reviewed_at TIMESTAMP,
          approved_by TEXT,
          approved_at TIMESTAMP,
          published_by TEXT,
          published_at TIMESTAMP,
          obsolete_reason TEXT,
          deleted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sds_revisions (
          id SERIAL PRIMARY KEY,
          sds_id INTEGER NOT NULL REFERENCES sds_records(id) ON DELETE CASCADE,
          revision_number INTEGER NOT NULL,
          status_at_snapshot TEXT NOT NULL,
          change_summary TEXT,
          trigger_reason TEXT,
          snapshot JSONB NOT NULL,
          created_by TEXT,
          editor_name TEXT,
          approver_name TEXT,
          approved_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sds_attachments (
          id SERIAL PRIMARY KEY,
          sds_id INTEGER NOT NULL REFERENCES sds_records(id) ON DELETE CASCADE,
          file_id TEXT NOT NULL,
          attachment_role TEXT DEFAULT 'OTHER' NOT NULL,
          title TEXT,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          is_primary BOOLEAN DEFAULT FALSE NOT NULL,
          notes TEXT,
          uploaded_by TEXT,
          uploader_role TEXT,
          deleted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);
      sdsTablesEnsured = true;
    } catch (err) {
      logger.warn('Could not auto-verify SDS tables', err);
    }
  }

  private computeStats(records: SdsRecordDTO[]): SdsDashboardStats {
    let approvedOrPublished = 0;
    let pendingApproval = 0;
    let missingPrimaryPdf = 0;
    let needsRevision = 0;
    let hazardousCount = 0;
    let totalAttachments = 0;
    let obsoleteCount = 0;

    for (const rec of records) {
      if (rec.status === 'APPROVED' || rec.status === 'PUBLISHED') approvedOrPublished++;
      if (rec.status === 'DRAFT' || rec.status === 'UNDER_REVIEW') pendingApproval++;
      if (rec.status === 'OBSOLETE') obsoleteCount++;
      if (rec.status !== 'OBSOLETE' && !rec.hasPrimaryPdf) missingPrimaryPdf++;
      if (rec.needsRevision) needsRevision++;
      const hasHazards =
        (rec.ghsData?.pictograms?.length || 0) > 0 ||
        (rec.ghsData?.signalWord && rec.ghsData.signalWord !== 'NONE') ||
        (rec.ghsData?.hStatements?.length || 0) > 0;
      if (hasHazards) hazardousCount++;
      totalAttachments += rec.attachmentCount || 0;
    }

    return {
      total: records.length,
      approvedOrPublished,
      pendingApproval,
      missingPrimaryPdf,
      needsRevision,
      hazardousCount,
      totalAttachments,
      obsoleteCount,
    };
  }

  async checkDuplicate(params: {
    casNumber?: string;
    materialNameFa?: string;
    materialNameEn?: string;
    excludeId?: number;
  }): Promise<{
    isDuplicate: boolean;
    conflictType?: 'CAS' | 'NAME_FA' | 'NAME_EN';
    existingRecord?: {
      id: number;
      documentNumber: string;
      materialNameFa: string;
      materialNameEn: string;
      casNumber: string;
      status: string;
    };
  }> {
    await this.ensureTablesExist();
    const casNorm = normalizeCasNumber(params.casNumber);
    const nameFaNorm = normalizeMaterialName(params.materialNameFa);
    const nameEnNorm = normalizeMaterialName(params.materialNameEn);

    const conditions = [isNull(schema.sdsRecords.deletedAt)];
    if (params.excludeId) {
      conditions.push(ne(schema.sdsRecords.id, params.excludeId));
    }

    const existingRows = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(...conditions));

    for (const row of existingRows) {
      if (casNorm && row.casNumberNormalized && row.casNumberNormalized === casNorm) {
        return {
          isDuplicate: true,
          conflictType: 'CAS',
          existingRecord: {
            id: row.id,
            documentNumber: row.documentNumber,
            materialNameFa: row.materialNameFa,
            materialNameEn: row.materialNameEn,
            casNumber: row.casNumber || '',
            status: row.status,
          },
        };
      }
      const rowFaNorm = normalizeMaterialName(row.materialNameFa);
      const rowEnNorm = normalizeMaterialName(row.materialNameEn);
      if (nameFaNorm && rowFaNorm === nameFaNorm) {
        return {
          isDuplicate: true,
          conflictType: 'NAME_FA',
          existingRecord: {
            id: row.id,
            documentNumber: row.documentNumber,
            materialNameFa: row.materialNameFa,
            materialNameEn: row.materialNameEn,
            casNumber: row.casNumber || '',
            status: row.status,
          },
        };
      }
      if (nameEnNorm && rowEnNorm === nameEnNorm) {
        return {
          isDuplicate: true,
          conflictType: 'NAME_EN',
          existingRecord: {
            id: row.id,
            documentNumber: row.documentNumber,
            materialNameFa: row.materialNameFa,
            materialNameEn: row.materialNameEn,
            casNumber: row.casNumber || '',
            status: row.status,
          },
        };
      }
    }

    return { isDuplicate: false };
  }

  async listSdsRecords(filters?: {
    search?: string;
    unitName?: string;
    status?: string;
    casNumber?: string;
    onlyNeedsRevision?: boolean;
    onlyMissingPdf?: boolean;
    onlyHazardous?: boolean;
  }): Promise<{ records: SdsRecordDTO[]; stats: SdsDashboardStats }> {
    await this.ensureTablesExist();

    const rows = await db
      .select()
      .from(schema.sdsRecords)
      .where(isNull(schema.sdsRecords.deletedAt))
      .orderBy(desc(schema.sdsRecords.updatedAt));

    const attachmentRows = await db
      .select()
      .from(schema.sdsAttachments)
      .where(isNull(schema.sdsAttachments.deletedAt))
      .orderBy(desc(schema.sdsAttachments.isPrimary), desc(schema.sdsAttachments.createdAt));

    const attBySdsId = new Map<number, SdsAttachmentDTO[]>();
    for (const att of attachmentRows) {
      const list = attBySdsId.get(att.sdsId) || [];
      list.push(mapAttachmentRow(att));
      attBySdsId.set(att.sdsId, list);
    }

    const allDtos = rows.map((r) => mapRecordRow(r, attBySdsId.get(r.id) || []));
    const stats = this.computeStats(allDtos);

    let filtered = allDtos;
    if (filters?.status && filters.status !== 'ALL') {
      if (filters.status === 'APPROVED_OR_PUBLISHED') {
        filtered = filtered.filter((r) => r.status === 'APPROVED' || r.status === 'PUBLISHED');
      } else if (filters.status === 'PENDING_APPROVAL') {
        filtered = filtered.filter((r) => r.status === 'DRAFT' || r.status === 'UNDER_REVIEW');
      } else {
        filtered = filtered.filter((r) => r.status === filters.status);
      }
    }
    if (filters?.unitName && filters.unitName !== 'ALL') {
      filtered = filtered.filter((r) => r.unitName === filters.unitName);
    }
    if (filters?.casNumber && filters.casNumber.trim()) {
      const qCas = normalizeCasNumber(filters.casNumber);
      filtered = filtered.filter((r) => normalizeCasNumber(r.casNumber).includes(qCas));
    }
    if (filters?.onlyNeedsRevision) {
      filtered = filtered.filter((r) => r.needsRevision);
    }
    if (filters?.onlyMissingPdf) {
      filtered = filtered.filter((r) => r.status !== 'OBSOLETE' && !r.hasPrimaryPdf);
    }
    if (filters?.onlyHazardous) {
      filtered = filtered.filter(
        (r) =>
          (r.ghsData?.pictograms?.length || 0) > 0 ||
          (r.ghsData?.signalWord && r.ghsData.signalWord !== 'NONE')
      );
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const qNorm = normalizeMaterialName(filters.search);
      filtered = filtered.filter(
        (r) =>
          r.materialNameFa.toLowerCase().includes(q) ||
          normalizeMaterialName(r.materialNameFa).includes(qNorm) ||
          r.materialNameEn.toLowerCase().includes(q) ||
          r.tradeName.toLowerCase().includes(q) ||
          r.casNumber.toLowerCase().includes(q) ||
          r.unNumber.toLowerCase().includes(q) ||
          r.documentNumber.toLowerCase().includes(q) ||
          r.unitName.toLowerCase().includes(q) ||
          r.manufacturer.toLowerCase().includes(q)
      );
    }

    return { records: filtered, stats };
  }

  async getSdsById(id: number): Promise<SdsRecordDTO> {
    await this.ensureTablesExist();
    const [row] = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(eq(schema.sdsRecords.id, id), isNull(schema.sdsRecords.deletedAt)));

    if (!row) {
      throw new NotFoundError('برگه اطلاعات ایمنی (SDS) مورد نظر در سامانه یافت نشد.');
    }

    const attachmentRows = await db
      .select()
      .from(schema.sdsAttachments)
      .where(and(eq(schema.sdsAttachments.sdsId, id), isNull(schema.sdsAttachments.deletedAt)))
      .orderBy(desc(schema.sdsAttachments.isPrimary), desc(schema.sdsAttachments.createdAt));

    const revisionRows = await db
      .select()
      .from(schema.sdsRevisions)
      .where(eq(schema.sdsRevisions.sdsId, id))
      .orderBy(desc(schema.sdsRevisions.revisionNumber), desc(schema.sdsRevisions.createdAt));

    return mapRecordRow(
      row,
      attachmentRows.map(mapAttachmentRow),
      revisionRows.map(mapRevisionRow)
    );
  }

  async createSdsRecord(payload: any, req: Request): Promise<SdsRecordDTO> {
    await this.ensureTablesExist();

    const materialNameFa = String(payload.materialNameFa || '').trim();
    const materialNameEn = String(payload.materialNameEn || '').trim();
    if (!materialNameFa && !materialNameEn) {
      throw new ValidationError('وارد کردن حداقل نام فارسی یا انگلیسی ماده شیمیایی الزامی است.');
    }

    const finalNameFa = materialNameFa || materialNameEn;
    const finalNameEn = materialNameEn || materialNameFa;
    const casNumber = String(payload.casNumber || '').trim();
    const casNumberNormalized = normalizeCasNumber(casNumber);
    const materialNameNormalized = normalizeMaterialName(finalNameEn || finalNameFa);

    const dup = await this.checkDuplicate({
      casNumber,
      materialNameFa: finalNameFa,
      materialNameEn: finalNameEn,
    });

    if (dup.isDuplicate && dup.existingRecord) {
      const reasonText =
        dup.conflictType === 'CAS'
          ? `شماره CAS «${casNumber}»`
          : dup.conflictType === 'NAME_FA'
          ? `نام ماده «${finalNameFa}»`
          : `نام انگلیسی «${finalNameEn}»`;
      throw new ConflictError(
        `امکان ثبت رکورد تکراری وجود ندارد: ${reasonText} قبلاً در مدرک شماره «${dup.existingRecord.documentNumber}» (${dup.existingRecord.materialNameFa}) ثبت شده است.`
      );
    }

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';
    const actorRole = req.user?.role || '';
    const sdsUid = `SDS-${uuidv4()}`;

    const existingCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.sdsRecords);
    const nextSeq = (existingCountRes[0]?.count || 0) + 1;
    const documentNumber =
      String(payload.documentNumber || '').trim() ||
      `SDS-RPCO-${String(nextSeq).padStart(4, '0')}`;

    const initialStatus: SdsStatus =
      payload.status === 'UNDER_REVIEW' ? 'UNDER_REVIEW' : 'DRAFT';

    const ghsData = mergeGhsData(payload.ghsData);
    const sections = mergeSections16(payload.sections, finalNameEn || finalNameFa);
    if (!sections.section1.productIdentifier) {
      sections.section1.productIdentifier = `${finalNameFa} (${finalNameEn})`;
    }

    const preparedDate = String(payload.preparedDate || '').trim() || new Date().toISOString().slice(0, 10);

    const [inserted] = await db
      .insert(schema.sdsRecords)
      .values({
        sdsUid,
        documentNumber,
        materialNameFa: finalNameFa,
        materialNameEn: finalNameEn,
        materialNameNormalized,
        tradeName: String(payload.tradeName || '').trim() || null,
        casNumber: casNumber || null,
        casNumberNormalized: casNumberNormalized || null,
        unNumber: String(payload.unNumber || '').trim() || null,
        manufacturer: String(payload.manufacturer || '').trim() || null,
        supplier: String(payload.supplier || '').trim() || null,
        unitId: payload.unitId ? Number(payload.unitId) : null,
        unitName: String(payload.unitName || 'عمومی مجتمع').trim() || 'عمومی مجتمع',
        storageLocation: String(payload.storageLocation || '').trim() || null,
        physicalState: String(payload.physicalState || 'LIQUID').trim() || 'LIQUID',
        revisionNumber: Math.max(1, Number(payload.revisionNumber) || 1),
        preparedDate,
        lastRevisionDate: String(payload.lastRevisionDate || '').trim() || preparedDate,
        revisionTriggerReason: String(payload.revisionTriggerReason || 'تدوین اولیه سند').trim(),
        needsRevision: Boolean(payload.needsRevision),
        reviewAlertMessage: String(payload.reviewAlertMessage || '').trim() || null,
        status: initialStatus,
        ghsData,
        sections,
        aiExtractionMetadata:
          payload.aiExtractionMetadata && typeof payload.aiExtractionMetadata === 'object'
            ? payload.aiExtractionMetadata
            : {},
        linkedRiskRefs:
          payload.linkedRiskRefs && typeof payload.linkedRiskRefs === 'object'
            ? payload.linkedRiskRefs
            : {},
        createdBy: actorName,
        createdByRole: actorRole,
        updatedBy: actorName,
      })
      .returning();

    // Record initial revision snapshot v1
    await db.insert(schema.sdsRevisions).values({
      sdsId: inserted.id,
      revisionNumber: inserted.revisionNumber,
      statusAtSnapshot: inserted.status,
      changeSummary: 'ایجاد و ثبت اولیه شناسنامه ایمنی ماده شیمیایی (SDS)',
      triggerReason: inserted.revisionTriggerReason || 'تدوین اولیه',
      snapshot: buildSnapshotPayload(inserted),
      createdBy: actorName,
      editorName: actorName,
    });

    await auditService.logFromRequest(req, {
      action: 'CREATE',
      module: 'SDS',
      entityType: 'SDS_RECORD',
      entityId: inserted.id,
      newValue: {
        documentNumber: inserted.documentNumber,
        materialNameFa: inserted.materialNameFa,
        materialNameEn: inserted.materialNameEn,
        casNumber: inserted.casNumber,
        unitName: inserted.unitName,
        status: inserted.status,
      },
      details: {
        actionTitle: `ثبت برگه اطلاعات ایمنی (SDS) جدید برای «${inserted.materialNameFa}»`,
        actionType: 'CREATE',
      },
    });

    const fullRecord = await this.getSdsById(inserted.id);
    broadcastDataMutation('sds', 'create', fullRecord);
    return fullRecord;
  }

  async updateSdsRecord(id: number, payload: any, req: Request): Promise<SdsRecordDTO> {
    await this.ensureTablesExist();
    const [existing] = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(eq(schema.sdsRecords.id, id), isNull(schema.sdsRecords.deletedAt)));

    if (!existing) {
      throw new NotFoundError('برگه اطلاعات ایمنی (SDS) مورد نظر یافت نشد.');
    }

    // Governance rule: APPROVED or PUBLISHED records cannot be edited directly
    if (existing.status === 'APPROVED' || existing.status === 'PUBLISHED') {
      throw new ValidationError(
        'این نسخه SDS در وضعیت «تأییدشده / منتشرشده» قرار دارد و قابل ویرایش مستقیم نیست. جهت اعمال تغییرات باید از گزینه «ایجاد بازنگری جدید» استفاده نمایید.'
      );
    }
    if (existing.status === 'OBSOLETE') {
      throw new ValidationError('برگه SDS منسوخ‌شده قابل ویرایش نیست.');
    }

    const materialNameFa =
      payload.materialNameFa !== undefined
        ? String(payload.materialNameFa).trim()
        : existing.materialNameFa;
    const materialNameEn =
      payload.materialNameEn !== undefined
        ? String(payload.materialNameEn).trim()
        : existing.materialNameEn;

    if (!materialNameFa && !materialNameEn) {
      throw new ValidationError('نام ماده شیمیایی نمی‌تواند خالی باشد.');
    }

    const finalNameFa = materialNameFa || materialNameEn;
    const finalNameEn = materialNameEn || materialNameFa;
    const casNumber =
      payload.casNumber !== undefined ? String(payload.casNumber || '').trim() : existing.casNumber || '';
    const casNumberNormalized = normalizeCasNumber(casNumber);
    const materialNameNormalized = normalizeMaterialName(finalNameEn || finalNameFa);

    const dup = await this.checkDuplicate({
      casNumber,
      materialNameFa: finalNameFa,
      materialNameEn: finalNameEn,
      excludeId: id,
    });

    if (dup.isDuplicate && dup.existingRecord) {
      throw new ConflictError(
        `مغایرت اطلاعات تکراری با مدرک «${dup.existingRecord.documentNumber}» (${dup.existingRecord.materialNameFa}).`
      );
    }

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';
    const nextGhsData =
      payload.ghsData !== undefined ? mergeGhsData(payload.ghsData) : mergeGhsData(existing.ghsData);
    const nextSections =
      payload.sections !== undefined
        ? mergeSections16(payload.sections, finalNameEn || finalNameFa)
        : mergeSections16(existing.sections, finalNameEn || finalNameFa);

    const [updated] = await db
      .update(schema.sdsRecords)
      .set({
        documentNumber:
          payload.documentNumber !== undefined
            ? String(payload.documentNumber).trim() || existing.documentNumber
            : existing.documentNumber,
        materialNameFa: finalNameFa,
        materialNameEn: finalNameEn,
        materialNameNormalized,
        tradeName:
          payload.tradeName !== undefined ? String(payload.tradeName || '').trim() || null : existing.tradeName,
        casNumber: casNumber || null,
        casNumberNormalized: casNumberNormalized || null,
        unNumber:
          payload.unNumber !== undefined ? String(payload.unNumber || '').trim() || null : existing.unNumber,
        manufacturer:
          payload.manufacturer !== undefined
            ? String(payload.manufacturer || '').trim() || null
            : existing.manufacturer,
        supplier:
          payload.supplier !== undefined ? String(payload.supplier || '').trim() || null : existing.supplier,
        unitId: payload.unitId !== undefined ? (payload.unitId ? Number(payload.unitId) : null) : existing.unitId,
        unitName:
          payload.unitName !== undefined
            ? String(payload.unitName || 'عمومی مجتمع').trim()
            : existing.unitName,
        storageLocation:
          payload.storageLocation !== undefined
            ? String(payload.storageLocation || '').trim() || null
            : existing.storageLocation,
        physicalState:
          payload.physicalState !== undefined
            ? String(payload.physicalState || 'LIQUID').trim()
            : existing.physicalState,
        preparedDate:
          payload.preparedDate !== undefined
            ? String(payload.preparedDate || existing.preparedDate).trim()
            : existing.preparedDate,
        lastRevisionDate:
          payload.lastRevisionDate !== undefined
            ? String(payload.lastRevisionDate || '').trim() || null
            : existing.lastRevisionDate,
        revisionTriggerReason:
          payload.revisionTriggerReason !== undefined
            ? String(payload.revisionTriggerReason || '').trim() || null
            : existing.revisionTriggerReason,
        needsRevision:
          payload.needsRevision !== undefined ? Boolean(payload.needsRevision) : existing.needsRevision,
        reviewAlertMessage:
          payload.reviewAlertMessage !== undefined
            ? String(payload.reviewAlertMessage || '').trim() || null
            : existing.reviewAlertMessage,
        ghsData: nextGhsData,
        sections: nextSections,
        aiExtractionMetadata:
          payload.aiExtractionMetadata !== undefined
            ? payload.aiExtractionMetadata
            : existing.aiExtractionMetadata,
        linkedRiskRefs:
          payload.linkedRiskRefs !== undefined ? payload.linkedRiskRefs : existing.linkedRiskRefs,
        updatedBy: actorName,
        updatedAt: new Date(),
      })
      .where(eq(schema.sdsRecords.id, id))
      .returning();

    // Update current draft revision snapshot so revision history stays accurate
    const [currentRev] = await db
      .select()
      .from(schema.sdsRevisions)
      .where(
        and(
          eq(schema.sdsRevisions.sdsId, id),
          eq(schema.sdsRevisions.revisionNumber, updated.revisionNumber)
        )
      )
      .limit(1);

    if (currentRev) {
      await db
        .update(schema.sdsRevisions)
        .set({
          snapshot: buildSnapshotPayload(updated),
          editorName: actorName,
          changeSummary:
            String(payload.changeSummary || '').trim() || currentRev.changeSummary || 'بروزرسانی پیش‌نویس',
        })
        .where(eq(schema.sdsRevisions.id, currentRev.id));
    }

    await auditService.logFromRequest(req, {
      action: 'UPDATE',
      module: 'SDS',
      entityType: 'SDS_RECORD',
      entityId: id,
      oldValue: {
        materialNameFa: existing.materialNameFa,
        casNumber: existing.casNumber,
        unitName: existing.unitName,
        status: existing.status,
      },
      newValue: {
        materialNameFa: updated.materialNameFa,
        casNumber: updated.casNumber,
        unitName: updated.unitName,
        status: updated.status,
      },
      details: {
        actionTitle: `ویرایش برگه اطلاعات ایمنی «${updated.materialNameFa}» (${updated.documentNumber})`,
        actionType: 'UPDATE',
      },
    });

    const fullRecord = await this.getSdsById(id);
    broadcastDataMutation('sds', 'update', fullRecord);
    return fullRecord;
  }

  async createNewRevision(
    id: number,
    params: { changeSummary?: string; triggerReason?: string; lastRevisionDate?: string },
    req: Request
  ): Promise<SdsRecordDTO> {
    await this.ensureTablesExist();
    const [existing] = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(eq(schema.sdsRecords.id, id), isNull(schema.sdsRecords.deletedAt)));

    if (!existing) {
      throw new NotFoundError('برگه اطلاعات ایمنی (SDS) مورد نظر یافت نشد.');
    }
    if (existing.status === 'OBSOLETE') {
      throw new ValidationError('امکان ایجاد بازنگری جدید روی سند منسوخ‌شده وجود ندارد.');
    }

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';
    const nextRevNum = (existing.revisionNumber || 1) + 1;
    const revDate = params.lastRevisionDate?.trim() || new Date().toISOString().slice(0, 10);
    const triggerReason =
      params.triggerReason?.trim() || 'بازنگری دوره‌ای / بروزرسانی بر اساس سند سازنده یا ضوابط HSE';
    const changeSummary =
      params.changeSummary?.trim() || `شروع بازنگری جدید (نسخه ${nextRevNum})`;

    // Ensure previous revision snapshot exists immutably before moving forward
    const existingRevRows = await db
      .select()
      .from(schema.sdsRevisions)
      .where(
        and(
          eq(schema.sdsRevisions.sdsId, id),
          eq(schema.sdsRevisions.revisionNumber, existing.revisionNumber)
        )
      );

    if (existingRevRows.length === 0) {
      await db.insert(schema.sdsRevisions).values({
        sdsId: id,
        revisionNumber: existing.revisionNumber,
        statusAtSnapshot: existing.status,
        changeSummary: 'نسخه بایگانی‌شده پیش از بازنگری جدید',
        triggerReason: existing.revisionTriggerReason || '',
        snapshot: buildSnapshotPayload(existing),
        createdBy: existing.createdBy || actorName,
        editorName: existing.updatedBy || actorName,
        approverName: existing.approvedBy || undefined,
        approvedAt: existing.approvedAt || undefined,
      });
    }

    const [updated] = await db
      .update(schema.sdsRecords)
      .set({
        revisionNumber: nextRevNum,
        lastRevisionDate: revDate,
        revisionTriggerReason: triggerReason,
        needsRevision: false,
        reviewAlertMessage: null,
        status: 'DRAFT',
        reviewedBy: null,
        reviewedAt: null,
        approvedBy: null,
        approvedAt: null,
        publishedBy: null,
        publishedAt: null,
        updatedBy: actorName,
        updatedAt: new Date(),
      })
      .where(eq(schema.sdsRecords.id, id))
      .returning();

    await db.insert(schema.sdsRevisions).values({
      sdsId: id,
      revisionNumber: nextRevNum,
      statusAtSnapshot: 'DRAFT',
      changeSummary,
      triggerReason,
      snapshot: buildSnapshotPayload(updated),
      createdBy: actorName,
      editorName: actorName,
    });

    await auditService.logFromRequest(req, {
      action: 'CREATE_REVISION',
      module: 'SDS',
      entityType: 'SDS_RECORD',
      entityId: id,
      oldValue: { revisionNumber: existing.revisionNumber, status: existing.status },
      newValue: { revisionNumber: nextRevNum, status: 'DRAFT', triggerReason },
      reason: changeSummary,
      details: {
        actionTitle: `ایجاد بازنگری جدید (نسخه ${nextRevNum}) برای SDS «${updated.materialNameFa}»`,
        actionType: 'UPDATE',
      },
    });

    const fullRecord = await this.getSdsById(id);
    broadcastDataMutation('sds', 'revision', fullRecord);
    return fullRecord;
  }

  async changeStatus(
    id: number,
    params: {
      action: 'SUBMIT_REVIEW' | 'APPROVE' | 'PUBLISH' | 'MARK_OBSOLETE' | 'FLAG_REVISION' | 'RETURN_DRAFT';
      notes?: string;
      needsRevision?: boolean;
      reviewAlertMessage?: string;
      revisionTriggerReason?: string;
    },
    req: Request
  ): Promise<SdsRecordDTO> {
    await this.ensureTablesExist();
    const [existing] = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(eq(schema.sdsRecords.id, id), isNull(schema.sdsRecords.deletedAt)));

    if (!existing) {
      throw new NotFoundError('برگه اطلاعات ایمنی (SDS) مورد نظر یافت نشد.');
    }

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';
    const isManager = canUserApproveOrPublishSds(req.user);

    if (
      ['APPROVE', 'PUBLISH', 'MARK_OBSOLETE'].includes(params.action) &&
      !isManager
    ) {
      throw new ForbiddenError('فقط مدیر HSE، مدیر فرآیند یا مدیر سیستم مجاز به تأیید، انتشار یا منسوخ کردن SDS است.');
    }

    const patch: Partial<typeof schema.sdsRecords.$inferInsert> = {
      updatedBy: actorName,
      updatedAt: new Date(),
    };

    let auditActionTitle = '';

    switch (params.action) {
      case 'SUBMIT_REVIEW':
        if (existing.status === 'OBSOLETE') {
          throw new ValidationError('برگه منسوخ‌شده قابل ارسال برای بررسی نیست.');
        }
        patch.status = 'UNDER_REVIEW';
        patch.reviewedBy = actorName;
        patch.reviewedAt = new Date();
        auditActionTitle = `ارسال SDS «${existing.materialNameFa}» جهت بررسی و تأیید`;
        break;

      case 'RETURN_DRAFT':
        patch.status = 'DRAFT';
        auditActionTitle = `بازگشت SDS «${existing.materialNameFa}» به وضعیت پیش‌نویس`;
        break;

      case 'APPROVE':
        patch.status = 'APPROVED';
        patch.approvedBy = actorName;
        patch.approvedAt = new Date();
        patch.needsRevision = false;
        patch.reviewAlertMessage = null;
        auditActionTitle = `تأیید نهایی SDS «${existing.materialNameFa}» (نسخه ${existing.revisionNumber})`;
        break;

      case 'PUBLISH':
        if (existing.status !== 'APPROVED' && existing.status !== 'PUBLISHED') {
          patch.approvedBy = existing.approvedBy || actorName;
          patch.approvedAt = existing.approvedAt || new Date();
        }
        patch.status = 'PUBLISHED';
        patch.publishedBy = actorName;
        patch.publishedAt = new Date();
        patch.needsRevision = false;
        patch.reviewAlertMessage = null;
        auditActionTitle = `انتشار رسمی SDS «${existing.materialNameFa}» (نسخه ${existing.revisionNumber})`;
        break;

      case 'MARK_OBSOLETE':
        patch.status = 'OBSOLETE';
        patch.obsoleteReason = params.notes?.trim() || 'منسوخ‌شده توسط مدیریت HSE';
        auditActionTitle = `منسوخ اعلام کردن SDS «${existing.materialNameFa}»`;
        break;

      case 'FLAG_REVISION':
        patch.needsRevision = params.needsRevision !== undefined ? Boolean(params.needsRevision) : true;
        patch.reviewAlertMessage =
          params.reviewAlertMessage?.trim() ||
          params.notes?.trim() ||
          'نیازمند بازنگری بر اساس مقررات، نسخه جدید سازنده یا دستورالعمل مصوب مجتمع';
        if (params.revisionTriggerReason?.trim()) {
          patch.revisionTriggerReason = params.revisionTriggerReason.trim();
        }
        auditActionTitle = patch.needsRevision
          ? `ثبت هشدار نیاز به بازنگری برای SDS «${existing.materialNameFa}»`
          : `رفع هشدار نیاز به بازنگری برای SDS «${existing.materialNameFa}»`;
        break;

      default:
        throw new ValidationError('عملیات تغییر وضعیت معتبر نیست.');
    }

    const [updated] = await db
      .update(schema.sdsRecords)
      .set(patch)
      .where(eq(schema.sdsRecords.id, id))
      .returning();

    // Keep revision snapshot synchronized
    const [currentRev] = await db
      .select()
      .from(schema.sdsRevisions)
      .where(
        and(
          eq(schema.sdsRevisions.sdsId, id),
          eq(schema.sdsRevisions.revisionNumber, updated.revisionNumber)
        )
      )
      .limit(1);

    if (currentRev) {
      await db
        .update(schema.sdsRevisions)
        .set({
          statusAtSnapshot: updated.status,
          approverName: updated.approvedBy || currentRev.approverName,
          approvedAt: updated.approvedAt || currentRev.approvedAt,
          snapshot: buildSnapshotPayload(updated),
        })
        .where(eq(schema.sdsRevisions.id, currentRev.id));
    }

    await auditService.logFromRequest(req, {
      action: params.action,
      module: 'SDS',
      entityType: 'SDS_RECORD',
      entityId: id,
      oldValue: { status: existing.status, needsRevision: existing.needsRevision },
      newValue: { status: updated.status, needsRevision: updated.needsRevision },
      reason: params.notes || params.reviewAlertMessage || '',
      details: {
        actionTitle: auditActionTitle,
        actionType: params.action === 'APPROVE' || params.action === 'PUBLISH' ? 'APPROVE' : 'UPDATE',
      },
    });

    const fullRecord = await this.getSdsById(id);
    broadcastDataMutation('sds', 'status', fullRecord);
    return fullRecord;
  }

  async addAttachment(
    sdsId: number,
    params: {
      fileBuffer: Buffer;
      originalName: string;
      mimeType: string;
      attachmentRole?: string;
      title?: string;
      notes?: string;
      isPrimary?: boolean;
    },
    req: Request
  ): Promise<SdsAttachmentDTO> {
    await this.ensureTablesExist();
    const [existing] = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(eq(schema.sdsRecords.id, sdsId), isNull(schema.sdsRecords.deletedAt)));

    if (!existing) {
      throw new NotFoundError('برگه اطلاعات ایمنی (SDS) مورد نظر یافت نشد.');
    }

    const role: SdsAttachmentRole = VALID_ATTACHMENT_ROLES.has(
      params.attachmentRole as SdsAttachmentRole
    )
      ? (params.attachmentRole as SdsAttachmentRole)
      : 'OTHER';

    const shouldBePrimary =
      Boolean(params.isPrimary) || role === 'PRIMARY_SDS_PDF';

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';

    // Reuse centralized FileService (strict magic-byte inspection, 25MB limit, Persian filename repair, DB + disk backup)
    const savedFile = await fileService.saveFile({
      entityType: 'DOCUMENT',
      entityId: existing.sdsUid,
      originalName: params.originalName,
      mimeType: params.mimeType,
      fileBuffer: params.fileBuffer,
      uploadedBy: actorName,
      uploaderRole: req.user?.role,
      version: existing.revisionNumber || 1,
      isPublic: false,
      metadata: {
        sdsId: existing.id,
        sdsUid: existing.sdsUid,
        documentNumber: existing.documentNumber,
        attachmentRole: role,
        title: params.title || params.originalName,
      },
    });

    if (shouldBePrimary) {
      await db
        .update(schema.sdsAttachments)
        .set({ isPrimary: false })
        .where(eq(schema.sdsAttachments.sdsId, sdsId));
    }

    const [inserted] = await db
      .insert(schema.sdsAttachments)
      .values({
        sdsId,
        fileId: savedFile.fileId,
        attachmentRole: role,
        title: params.title?.trim() || savedFile.originalName,
        originalName: savedFile.originalName,
        mimeType: savedFile.mimeType,
        fileSize: savedFile.fileSize,
        isPrimary: shouldBePrimary,
        notes: params.notes?.trim() || null,
        uploadedBy: actorName,
        uploaderRole: req.user?.role || null,
      })
      .returning();

    if (shouldBePrimary) {
      await db
        .update(schema.sdsRecords)
        .set({
          primaryFileId: savedFile.fileId,
          updatedBy: actorName,
          updatedAt: new Date(),
        })
        .where(eq(schema.sdsRecords.id, sdsId));
    }

    await auditService.logFromRequest(req, {
      action: 'UPLOAD_FILE',
      module: 'SDS',
      entityType: 'SDS_ATTACHMENT',
      entityId: `${sdsId}:${inserted.id}`,
      newValue: {
        fileId: savedFile.fileId,
        originalName: savedFile.originalName,
        attachmentRole: role,
        isPrimary: shouldBePrimary,
        fileSize: savedFile.fileSize,
      },
      details: {
        actionTitle: `بارگذاری فایل پیوست «${savedFile.originalName}» برای SDS «${existing.materialNameFa}»`,
        actionType: 'UPLOAD',
      },
    });

    const dto = mapAttachmentRow(inserted);
    broadcastDataMutation('sds', 'attachment_add', { sdsId, attachment: dto });
    return dto;
  }

  async setPrimaryAttachment(sdsId: number, attachmentId: number, req: Request): Promise<SdsRecordDTO> {
    await this.ensureTablesExist();
    const [att] = await db
      .select()
      .from(schema.sdsAttachments)
      .where(
        and(
          eq(schema.sdsAttachments.id, attachmentId),
          eq(schema.sdsAttachments.sdsId, sdsId),
          isNull(schema.sdsAttachments.deletedAt)
        )
      );

    if (!att) {
      throw new NotFoundError('فایل پیوست مورد نظر یافت نشد.');
    }

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';

    await db
      .update(schema.sdsAttachments)
      .set({ isPrimary: false })
      .where(eq(schema.sdsAttachments.sdsId, sdsId));

    await db
      .update(schema.sdsAttachments)
      .set({ isPrimary: true, attachmentRole: 'PRIMARY_SDS_PDF' })
      .where(eq(schema.sdsAttachments.id, attachmentId));

    await db
      .update(schema.sdsRecords)
      .set({
        primaryFileId: att.fileId,
        updatedBy: actorName,
        updatedAt: new Date(),
      })
      .where(eq(schema.sdsRecords.id, sdsId));

    await auditService.logFromRequest(req, {
      action: 'UPDATE',
      module: 'SDS',
      entityType: 'SDS_ATTACHMENT',
      entityId: `${sdsId}:${attachmentId}`,
      newValue: { primaryFileId: att.fileId, originalName: att.originalName },
      details: {
        actionTitle: `انتخاب فایل «${att.originalName}» به عنوان فایل اصلی SDS`,
        actionType: 'UPDATE',
      },
    });

    const fullRecord = await this.getSdsById(sdsId);
    broadcastDataMutation('sds', 'attachment_primary', fullRecord);
    return fullRecord;
  }

  async removeAttachment(sdsId: number, attachmentId: number, req: Request): Promise<SdsRecordDTO> {
    await this.ensureTablesExist();
    const [existing] = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(eq(schema.sdsRecords.id, sdsId), isNull(schema.sdsRecords.deletedAt)));

    if (!existing) {
      throw new NotFoundError('برگه اطلاعات ایمنی (SDS) مورد نظر یافت نشد.');
    }

    const [att] = await db
      .select()
      .from(schema.sdsAttachments)
      .where(
        and(
          eq(schema.sdsAttachments.id, attachmentId),
          eq(schema.sdsAttachments.sdsId, sdsId),
          isNull(schema.sdsAttachments.deletedAt)
        )
      );

    if (!att) {
      throw new NotFoundError('فایل پیوست مورد نظر یافت نشد.');
    }

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';

    // Soft-delete attachment record WITHOUT deleting parent SDS record
    await db
      .update(schema.sdsAttachments)
      .set({ deletedAt: new Date(), isPrimary: false })
      .where(eq(schema.sdsAttachments.id, attachmentId));

    // Soft-delete underlying system_files row
    await fileService.softDeleteFile(att.fileId, actorName);

    // Recompute primaryFileId if needed
    if (existing.primaryFileId === att.fileId || att.isPrimary) {
      const remaining = await db
        .select()
        .from(schema.sdsAttachments)
        .where(
          and(eq(schema.sdsAttachments.sdsId, sdsId), isNull(schema.sdsAttachments.deletedAt))
        )
        .orderBy(desc(schema.sdsAttachments.createdAt));

      const nextPrimary = remaining.find(
        (r) => r.attachmentRole === 'PRIMARY_SDS_PDF' && r.mimeType === 'application/pdf'
      );

      if (nextPrimary) {
        await db
          .update(schema.sdsAttachments)
          .set({ isPrimary: true })
          .where(eq(schema.sdsAttachments.id, nextPrimary.id));
      }

      await db
        .update(schema.sdsRecords)
        .set({
          primaryFileId: nextPrimary ? nextPrimary.fileId : null,
          updatedBy: actorName,
          updatedAt: new Date(),
        })
        .where(eq(schema.sdsRecords.id, sdsId));
    }

    await auditService.logFromRequest(req, {
      action: 'DELETE',
      module: 'SDS',
      entityType: 'SDS_ATTACHMENT',
      entityId: `${sdsId}:${attachmentId}`,
      oldValue: {
        fileId: att.fileId,
        originalName: att.originalName,
        attachmentRole: att.attachmentRole,
      },
      details: {
        actionTitle: `حذف فایل پیوست «${att.originalName}» از SDS «${existing.materialNameFa}»`,
        actionType: 'DELETE',
      },
    });

    const fullRecord = await this.getSdsById(sdsId);
    broadcastDataMutation('sds', 'attachment_delete', fullRecord);
    return fullRecord;
  }

  async deleteSdsRecord(id: number, req: Request): Promise<void> {
    await this.ensureTablesExist();
    const [existing] = await db
      .select()
      .from(schema.sdsRecords)
      .where(and(eq(schema.sdsRecords.id, id), isNull(schema.sdsRecords.deletedAt)));

    if (!existing) {
      throw new NotFoundError('برگه اطلاعات ایمنی (SDS) مورد نظر یافت نشد.');
    }

    const actorName = req.user?.name || req.user?.username || 'کاربر سیستم';

    await db
      .update(schema.sdsRecords)
      .set({ deletedAt: new Date(), updatedBy: actorName, updatedAt: new Date() })
      .where(eq(schema.sdsRecords.id, id));

    await auditService.logFromRequest(req, {
      action: 'DELETE',
      module: 'SDS',
      entityType: 'SDS_RECORD',
      entityId: id,
      oldValue: {
        documentNumber: existing.documentNumber,
        materialNameFa: existing.materialNameFa,
        casNumber: existing.casNumber,
        status: existing.status,
      },
      details: {
        actionTitle: `حذف برگه اطلاعات ایمنی «${existing.materialNameFa}» (${existing.documentNumber})`,
        actionType: 'DELETE',
      },
    });

    broadcastDataMutation('sds', 'delete', { id });
  }
}

export const sdsService = new SdsService();
