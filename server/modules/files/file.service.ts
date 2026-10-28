import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, schema } from '../../core/db.ts';
import { config } from '../../core/config.ts';
import { NotFoundError, ValidationError, ForbiddenError } from '../../core/errors.ts';
import { logger } from '../../core/logger.ts';
import { auditService } from '../audit/audit.service.ts';

export type HseDocumentCategory =
  | 'ORG_PROCEDURES'
  | 'EQUIPMENT_CERTIFICATES'
  | 'ORG_FORMS_CHECKLISTS'
  | 'OTHER_HSE_DOCS';

export interface DocumentVersionDTO {
  fileId: string;
  version: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploaderRole?: string;
  createdAt: string;
  changeNote?: string;
  issueDate?: string;
  expiryDate?: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface HseDocumentDTO {
  id: number;
  documentId: string; // Logical entityId grouping versions
  fileId: string; // Current version fileId
  title: string;
  documentNumber: string;
  category: HseDocumentCategory;
  unitId?: number | string | null;
  unitName: string;
  issueDate: string;
  expiryDate: string;
  description: string;
  status: 'ACTIVE' | 'ARCHIVED';
  version: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploaderRole?: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  previewUrl: string;
  versions: DocumentVersionDTO[];
}

export interface SystemFileDTO {
  id: number;
  fileId: string;
  entityType: string;
  entityId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  fileSize: number;
  filePath: string;
  fileUrl?: string;
  uploadedBy?: string;
  uploaderRole?: string;
  version: number;
  isPublic: boolean;
  metadata?: any;
  createdAt: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'text/plain',
  'text/csv',
]);

const DOCUMENT_ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const VALID_DOCUMENT_CATEGORIES = new Set<HseDocumentCategory>([
  'ORG_PROCEDURES',
  'EQUIPMENT_CERTIFICATES',
  'ORG_FORMS_CHECKLISTS',
  'OTHER_HSE_DOCS',
]);

const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25MB strict limit for HSE documents

const inMemoryFiles: SystemFileDTO[] = [];

// Ensure upload directory exists
if (!fs.existsSync(config.security.uploadDir)) {
  try {
    fs.mkdirSync(config.security.uploadDir, { recursive: true });
  } catch (e) {
    logger.warn('Could not create upload directory', e);
  }
}

/**
 * Inspects actual binary magic bytes of a file buffer to verify its true file type
 * and prevent spoofed extensions or malicious uploads.
 */
export function verifyActualFileSignature(buffer: Buffer): {
  valid: boolean;
  detectedMime?: string;
  safeExtension?: string;
} {
  if (!buffer || buffer.length < 4) {
    return { valid: false };
  }

  // 1. PDF: "%PDF-" (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { valid: true, detectedMime: 'application/pdf', safeExtension: '.pdf' };
  }

  // 2. JPEG / JPG: FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { valid: true, detectedMime: 'image/jpeg', safeExtension: '.jpg' };
  }

  // 3. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png', safeExtension: '.png' };
  }

  // 4. WEBP: "RIFF" (0..3) and "WEBP" (8..11)
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { valid: true, detectedMime: 'image/webp', safeExtension: '.webp' };
  }

  return { valid: false };
}

export class FileService {
  async saveFile(params: {
    entityType: string;
    entityId: string;
    originalName: string;
    mimeType: string;
    fileBuffer: Buffer;
    uploadedBy?: string;
    uploaderRole?: string;
    version?: number;
    isPublic?: boolean;
    metadata?: any;
  }): Promise<SystemFileDTO> {
    if (!params.fileBuffer || params.fileBuffer.length === 0) {
      throw new ValidationError('فایل ارسالی خالی یا نامعتبر است.');
    }

    // 1. Size Validation
    const maxAllowedBytes =
      params.entityType === 'DOCUMENT'
        ? MAX_DOCUMENT_SIZE_BYTES
        : config.security.maxUploadSizeBytes;

    if (params.fileBuffer.length > maxAllowedBytes) {
      const maxMb = Math.round(maxAllowedBytes / (1024 * 1024));
      throw new ValidationError(
        `حجم فایل نباید بیشتر از ${maxMb} مگابایت باشد. حجم فعلی: ${(
          params.fileBuffer.length /
          (1024 * 1024)
        ).toFixed(2)} مگابایت`
      );
    }

    let resolvedMime = params.mimeType;
    let safeExt = path.extname(params.originalName).toLowerCase() || '.bin';

    // 2. Strict Magic-Byte Signature Verification for Documents & Images
    if (
      params.entityType === 'DOCUMENT' ||
      DOCUMENT_ALLOWED_MIMES.has(params.mimeType) ||
      ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(safeExt)
    ) {
      const sig = verifyActualFileSignature(params.fileBuffer);
      if (!sig.valid || !sig.detectedMime || !sig.safeExtension) {
        throw new ValidationError(
          'نوع واقعی فایل (امضای باینری) معتبر نیست. تنها فایل‌های استاندارد و واقعی با فرمت PDF، JPG، PNG و WEBP مجاز هستند.'
        );
      }
      resolvedMime = sig.detectedMime;
      safeExt = sig.safeExtension;
    } else if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
      throw new ValidationError(
        `فرمت فایل '${params.mimeType}' مجاز نیست. فرمت‌های مجاز: PDF, PNG, JPG, WEBP`
      );
    }

    // 3. Safe unique file naming to prevent collisions and path traversal
    const fileId = uuidv4();
    const storedName = `${fileId}${safeExt}`;
    const safeTargetPath = path.join(config.security.uploadDir, storedName);

    // Prevent directory traversal
    const normalizedTarget = path.normalize(safeTargetPath);
    if (!normalizedTarget.startsWith(path.normalize(config.security.uploadDir))) {
      throw new ForbiddenError('مسیر فایل نامعتبر است (Path Traversal Detected).');
    }

    // Sanitize original filename
    const cleanOriginalName = path
      .basename(params.originalName || `document${safeExt}`)
      .replace(/[\x00-\x1f\x80-\x9f/?<>\\:*|"]/g, '_');

    // Write file to disk
    fs.writeFileSync(safeTargetPath, params.fileBuffer);

    const versionNumber = params.version && params.version > 0 ? params.version : 1;

    const record: SystemFileDTO = {
      id: inMemoryFiles.length + 1,
      fileId,
      entityType: params.entityType,
      entityId: params.entityId,
      originalName: cleanOriginalName,
      storedName,
      mimeType: resolvedMime,
      fileSize: params.fileBuffer.length,
      filePath: safeTargetPath,
      fileUrl: `/api/v1/files/${fileId}/download`,
      uploadedBy: params.uploadedBy || 'کاربر سیستم',
      uploaderRole: params.uploaderRole,
      version: versionNumber,
      isPublic: params.isPublic || false,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString(),
    };

    try {
      const [inserted] = await db
        .insert(schema.systemFiles)
        .values({
          fileId: record.fileId,
          entityType: record.entityType,
          entityId: record.entityId,
          originalName: record.originalName,
          storedName: record.storedName,
          mimeType: record.mimeType,
          fileSize: record.fileSize,
          filePath: record.filePath,
          fileUrl: record.fileUrl,
          uploadedBy: record.uploadedBy,
          uploaderRole: record.uploaderRole,
          version: record.version,
          isPublic: record.isPublic,
          metadata: record.metadata,
        })
        .returning();

      if (inserted) {
        record.id = inserted.id;
        record.createdAt = inserted.createdAt.toISOString();
      }
    } catch (e) {
      logger.warn('System file database insert warning, keeping in fallback store', e);
    }

    inMemoryFiles.unshift(record);

    await auditService.log({
      action: 'UPLOAD_FILE',
      module: params.entityType === 'DOCUMENT' ? 'DOCUMENTS' : 'FILES',
      entityType: params.entityType,
      entityId: params.entityId,
      newValue: {
        fileId,
        originalName: record.originalName,
        mimeType: record.mimeType,
        size: record.fileSize,
        version: record.version,
      },
    });

    return record;
  }

  async getFileById(fileId: string): Promise<{ file: SystemFileDTO; stream: fs.ReadStream }> {
    let fileMeta: SystemFileDTO | undefined = inMemoryFiles.find((f) => f.fileId === fileId);

    try {
      const [dbFile] = await db
        .select()
        .from(schema.systemFiles)
        .where(and(eq(schema.systemFiles.fileId, fileId), isNull(schema.systemFiles.deletedAt)));

      if (dbFile) {
        fileMeta = {
          id: dbFile.id,
          fileId: dbFile.fileId,
          entityType: dbFile.entityType,
          entityId: dbFile.entityId,
          originalName: dbFile.originalName,
          storedName: dbFile.storedName,
          mimeType: dbFile.mimeType,
          fileSize: dbFile.fileSize,
          filePath: dbFile.filePath,
          fileUrl: dbFile.fileUrl || undefined,
          uploadedBy: dbFile.uploadedBy || undefined,
          uploaderRole: dbFile.uploaderRole || undefined,
          version: dbFile.version,
          isPublic: dbFile.isPublic,
          metadata: dbFile.metadata,
          createdAt: dbFile.createdAt.toISOString(),
        };
      }
    } catch (e) {
      // Fallback
    }

    if (!fileMeta) {
      throw new NotFoundError('فایل درخواستی در سامانه پیدا نشد.');
    }

    if (!fs.existsSync(fileMeta.filePath)) {
      throw new NotFoundError('محتوای فیزیکی فایل بر روی سرور موجود نیست.');
    }

    return {
      file: fileMeta,
      stream: fs.createReadStream(fileMeta.filePath),
    };
  }

  async renderPdfPageToPng(fileId: string, pageNumber = 1): Promise<{ buffer: Buffer; totalPages: number }> {
    const { file } = await this.getFileById(fileId);
    if (file.mimeType !== 'application/pdf') {
      throw new ValidationError('فایل انتخابی در قالب PDF نمی‌باشد.');
    }

    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    // Get total pages via pdfinfo or Ghostscript
    let totalPages = 1;
    try {
      const { stdout } = await execFileAsync('pdfinfo', [file.filePath]);
      const match = stdout.match(/Pages:\s+(\d+)/i);
      if (match && match[1]) {
        totalPages = parseInt(match[1], 10);
      }
    } catch {
      // Fallback 1: Ghostscript page count query
      try {
        const { stdout } = await execFileAsync('gs', [
          '-q',
          '-dNOSAFER',
          '-dNODISPLAY',
          '-c',
          `(${file.filePath.replace(/\\/g, '/')}) (r) file runpdfbegin pdfpagecount = quit`,
        ]);
        const count = parseInt(stdout.trim(), 10);
        if (!isNaN(count) && count > 0) {
          totalPages = count;
        }
      } catch {
        // Fallback 2: Regex scanning of PDF structure
        try {
          const content = fs.readFileSync(file.filePath, 'latin1');
          const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
          if (pageMatches && pageMatches.length > 0) {
            totalPages = pageMatches.length;
          }
        } catch {}
      }
    }

    const safePage = Math.max(1, Math.min(pageNumber, totalPages));
    const tmpPrefix = path.join('/tmp', `pdf_render_${fileId}_${Date.now()}`);

    try {
      let generatedPath = `${tmpPrefix}.png`;
      let rendered = false;

      // Strategy 1: Ghostscript (native on Linux, fast, high fidelity 150 DPI)
      try {
        await execFileAsync('gs', [
          '-dQUIET',
          '-dBATCH',
          '-dNOPAUSE',
          '-dNOSAFER',
          '-sDEVICE=png16m',
          `-dFirstPage=${safePage}`,
          `-dLastPage=${safePage}`,
          '-r150',
          `-sOutputFile=${generatedPath}`,
          file.filePath,
        ]);
        if (fs.existsSync(generatedPath) && fs.statSync(generatedPath).size > 0) {
          rendered = true;
        }
      } catch (gsErr: any) {
        logger.warn('Ghostscript rendering attempt failed, trying fallback', { error: gsErr?.message });
      }

      // Strategy 2: pdftoppm (if available in environment)
      if (!rendered) {
        try {
          await execFileAsync('pdftoppm', [
            '-png',
            '-r', '150',
            '-f', String(safePage),
            '-l', String(safePage),
            file.filePath,
            tmpPrefix,
          ]);

          const expectedFile1 = `${tmpPrefix}-${safePage}.png`;
          const expectedFile2 = `${tmpPrefix}-${String(safePage).padStart(2, '0')}.png`;
          const expectedFile3 = `${tmpPrefix}-${String(safePage).padStart(3, '0')}.png`;

          if (fs.existsSync(expectedFile1)) { generatedPath = expectedFile1; rendered = true; }
          else if (fs.existsSync(expectedFile2)) { generatedPath = expectedFile2; rendered = true; }
          else if (fs.existsSync(expectedFile3)) { generatedPath = expectedFile3; rendered = true; }
          else {
            const tmpDir = '/tmp';
            const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(path.basename(tmpPrefix)) && f.endsWith('.png'));
            if (files.length > 0) {
              generatedPath = path.join(tmpDir, files[0]);
              rendered = true;
            }
          }
        } catch (ppmErr: any) {
          logger.warn('pdftoppm rendering attempt failed, trying ImageMagick', { error: ppmErr?.message });
        }
      }

      // Strategy 3: ImageMagick convert
      if (!rendered) {
        try {
          await execFileAsync('convert', [
            '-density', '150',
            `${file.filePath}[${safePage - 1}]`,
            '-quality', '90',
            generatedPath,
          ]);
          if (fs.existsSync(generatedPath) && fs.statSync(generatedPath).size > 0) {
            rendered = true;
          }
        } catch (convErr: any) {
          logger.warn('ImageMagick convert rendering attempt failed', { error: convErr?.message });
        }
      }

      if (!rendered || !fs.existsSync(generatedPath)) {
        throw new Error('فایل تصویری رندر شده PDF تولید نشد.');
      }

      const pngBuffer = fs.readFileSync(generatedPath);
      try {
        fs.unlinkSync(generatedPath);
      } catch {}

      return { buffer: pngBuffer, totalPages };
    } catch (err: any) {
      logger.error('Error rendering PDF page', { fileId, error: err?.message });
      throw new Error(`خطا در پردازش تصویر صفحه PDF: ${err?.message || 'نامشخص'}`);
    }
  }

  async getFilesForEntity(entityType: string, entityId: string): Promise<SystemFileDTO[]> {
    try {
      const files = await db
        .select()
        .from(schema.systemFiles)
        .where(
          and(
            eq(schema.systemFiles.entityType, entityType),
            eq(schema.systemFiles.entityId, entityId),
            isNull(schema.systemFiles.deletedAt)
          )
        )
        .orderBy(desc(schema.systemFiles.version), desc(schema.systemFiles.createdAt));

      if (files.length > 0) {
        return files.map((f) => ({
          id: f.id,
          fileId: f.fileId,
          entityType: f.entityType,
          entityId: f.entityId,
          originalName: f.originalName,
          storedName: f.storedName,
          mimeType: f.mimeType,
          fileSize: f.fileSize,
          filePath: f.filePath,
          fileUrl: f.fileUrl || undefined,
          uploadedBy: f.uploadedBy || undefined,
          uploaderRole: f.uploaderRole || undefined,
          version: f.version,
          isPublic: f.isPublic,
          metadata: f.metadata,
          createdAt: f.createdAt.toISOString(),
        }));
      }
    } catch (e) {
      // Fallback
    }

    return inMemoryFiles.filter((f) => f.entityType === entityType && f.entityId === entityId);
  }

  async softDeleteFile(fileId: string, user?: string): Promise<void> {
    const memIndex = inMemoryFiles.findIndex((f) => f.fileId === fileId);
    if (memIndex !== -1) {
      inMemoryFiles.splice(memIndex, 1);
    }

    try {
      await db
        .update(schema.systemFiles)
        .set({ deletedAt: new Date() })
        .where(eq(schema.systemFiles.fileId, fileId));
    } catch (e) {
      // Fallback
    }

    await auditService.log({
      action: 'DELETE_FILE',
      module: 'FILES',
      entityType: 'FILE',
      entityId: fileId,
      details: { deletedBy: user },
    });
  }

  // ==========================================================================
  // HSE Instructions & Documents Management (Backed by system_files)
  // ==========================================================================

  private buildHseDocumentsFromRows(rows: SystemFileDTO[]): HseDocumentDTO[] {
    const grouped = new Map<string, SystemFileDTO[]>();

    for (const row of rows) {
      const docKey = row.entityId || row.fileId;
      const list = grouped.get(docKey) || [];
      list.push(row);
      grouped.set(docKey, list);
    }

    const result: HseDocumentDTO[] = [];

    for (const [documentId, versionsList] of grouped.entries()) {
      // Sort versions descending (latest version first)
      versionsList.sort((a, b) => {
        if (b.version !== a.version) return b.version - a.version;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const current = versionsList[0];
      const meta = (current.metadata && typeof current.metadata === 'object') ? current.metadata : {};

      const category: HseDocumentCategory = VALID_DOCUMENT_CATEGORIES.has(meta.category)
        ? meta.category
        : 'ORG_PROCEDURES';

      const versions: DocumentVersionDTO[] = versionsList.map((v) => {
        const vMeta = (v.metadata && typeof v.metadata === 'object') ? v.metadata : {};
        return {
          fileId: v.fileId,
          version: v.version || 1,
          originalName: v.originalName,
          mimeType: v.mimeType,
          fileSize: v.fileSize,
          uploadedBy: v.uploadedBy || 'کاربر سیستم',
          uploaderRole: v.uploaderRole,
          createdAt: v.createdAt,
          changeNote: vMeta.changeNote || '',
          issueDate: vMeta.issueDate || '',
          expiryDate: vMeta.expiryDate || '',
          downloadUrl: `/api/v1/files/${v.fileId}/download`,
          previewUrl: `/api/v1/files/${v.fileId}/preview`,
        };
      });

      result.push({
        id: current.id,
        documentId,
        fileId: current.fileId,
        title: meta.title || current.originalName,
        documentNumber: meta.documentNumber || '-',
        category,
        unitId: meta.unitId ?? null,
        unitName: meta.unitName || 'عمومی مجتمع',
        issueDate: meta.issueDate || '',
        expiryDate: meta.expiryDate || '',
        description: meta.description || '',
        status: meta.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
        version: current.version || 1,
        originalName: current.originalName,
        mimeType: current.mimeType,
        fileSize: current.fileSize,
        uploadedBy: current.uploadedBy || 'کاربر سیستم',
        uploaderRole: current.uploaderRole,
        createdAt: versionsList[versionsList.length - 1].createdAt,
        updatedAt: meta.updatedAt || current.createdAt,
        downloadUrl: `/api/v1/files/${current.fileId}/download`,
        previewUrl: `/api/v1/files/${current.fileId}/preview`,
        versions,
      });
    }

    // Sort by updatedAt descending
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return result;
  }

  async listHseDocuments(filters?: {
    search?: string;
    category?: string;
    unitName?: string;
    status?: string;
  }): Promise<HseDocumentDTO[]> {
    let rawFiles: SystemFileDTO[] = [];

    try {
      const dbRows = await db
        .select()
        .from(schema.systemFiles)
        .where(
          and(
            eq(schema.systemFiles.entityType, 'DOCUMENT'),
            isNull(schema.systemFiles.deletedAt)
          )
        )
        .orderBy(desc(schema.systemFiles.version), desc(schema.systemFiles.createdAt));

      rawFiles = dbRows.map((f) => ({
        id: f.id,
        fileId: f.fileId,
        entityType: f.entityType,
        entityId: f.entityId,
        originalName: f.originalName,
        storedName: f.storedName,
        mimeType: f.mimeType,
        fileSize: f.fileSize,
        filePath: f.filePath,
        fileUrl: f.fileUrl || undefined,
        uploadedBy: f.uploadedBy || undefined,
        uploaderRole: f.uploaderRole || undefined,
        version: f.version,
        isPublic: f.isPublic,
        metadata: f.metadata,
        createdAt: f.createdAt.toISOString(),
      }));
    } catch (e) {
      logger.warn('Fallback to inMemoryFiles for listHseDocuments', e);
      rawFiles = inMemoryFiles.filter((f) => f.entityType === 'DOCUMENT');
    }

    let docs = this.buildHseDocumentsFromRows(rawFiles);

    if (filters?.status && filters.status !== 'ALL') {
      docs = docs.filter((d) => d.status === filters.status);
    }
    if (filters?.category && filters.category !== 'ALL') {
      docs = docs.filter((d) => d.category === filters.category);
    }
    if (filters?.unitName && filters.unitName !== 'ALL') {
      docs = docs.filter((d) => d.unitName === filters.unitName);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.documentNumber.toLowerCase().includes(q) ||
          d.unitName.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.originalName.toLowerCase().includes(q)
      );
    }

    return docs;
  }

  async createHseDocument(params: {
    title: string;
    documentNumber: string;
    category: HseDocumentCategory;
    unitId?: number | string | null;
    unitName: string;
    issueDate: string;
    expiryDate?: string;
    description?: string;
    originalName: string;
    mimeType: string;
    fileBuffer: Buffer;
    uploadedBy?: string;
    uploaderRole?: string;
  }): Promise<HseDocumentDTO> {
    if (!params.title || !params.title.trim()) {
      throw new ValidationError('وارد کردن عنوان مستند الزامی است.');
    }
    if (!params.documentNumber || !params.documentNumber.trim()) {
      throw new ValidationError('وارد کردن شماره مدرک الزامی است.');
    }
    if (!VALID_DOCUMENT_CATEGORIES.has(params.category)) {
      throw new ValidationError('دسته‌بندی انتخاب‌شده برای مستند معتبر نیست.');
    }

    const documentId = `DOC-${uuidv4()}`;
    const nowIso = new Date().toISOString();

    const metadata = {
      title: params.title.trim(),
      documentNumber: params.documentNumber.trim(),
      category: params.category,
      unitId: params.unitId ?? null,
      unitName: (params.unitName || 'عمومی مجتمع').trim(),
      issueDate: (params.issueDate || '').trim(),
      expiryDate: (params.expiryDate || '').trim(),
      description: (params.description || '').trim(),
      status: 'ACTIVE' as const,
      isLatest: true,
      changeNote: 'ثبت و بارگذاری نسخه اولیه مدرک',
      updatedAt: nowIso,
      updatedBy: params.uploadedBy || 'کاربر سیستم',
    };

    const savedFile = await this.saveFile({
      entityType: 'DOCUMENT',
      entityId: documentId,
      originalName: params.originalName,
      mimeType: params.mimeType,
      fileBuffer: params.fileBuffer,
      uploadedBy: params.uploadedBy,
      uploaderRole: params.uploaderRole,
      version: 1,
      isPublic: false,
      metadata,
    });

    const [doc] = this.buildHseDocumentsFromRows([savedFile]);
    return doc;
  }

  async replaceHseDocumentFile(params: {
    documentId: string;
    originalName: string;
    mimeType: string;
    fileBuffer: Buffer;
    changeNote?: string;
    issueDate?: string;
    expiryDate?: string;
    title?: string;
    documentNumber?: string;
    category?: HseDocumentCategory;
    unitName?: string;
    description?: string;
    uploadedBy?: string;
    uploaderRole?: string;
  }): Promise<HseDocumentDTO> {
    const existingFiles = await this.getFilesForEntity('DOCUMENT', params.documentId);
    if (!existingFiles || existingFiles.length === 0) {
      throw new NotFoundError('مستند مورد نظر برای جایگزینی نسخه یافت نشد.');
    }

    const latest = existingFiles[0];
    const prevMeta = (latest.metadata && typeof latest.metadata === 'object') ? latest.metadata : {};
    const nextVersion = (latest.version || 1) + 1;
    const nowIso = new Date().toISOString();

    const nextMeta = {
      ...prevMeta,
      title: params.title !== undefined ? params.title.trim() : prevMeta.title,
      documentNumber: params.documentNumber !== undefined ? params.documentNumber.trim() : prevMeta.documentNumber,
      category: params.category && VALID_DOCUMENT_CATEGORIES.has(params.category) ? params.category : prevMeta.category,
      unitName: params.unitName !== undefined ? params.unitName.trim() : prevMeta.unitName,
      issueDate: params.issueDate !== undefined ? params.issueDate.trim() : prevMeta.issueDate,
      expiryDate: params.expiryDate !== undefined ? params.expiryDate.trim() : prevMeta.expiryDate,
      description: params.description !== undefined ? params.description.trim() : prevMeta.description,
      status: prevMeta.status || 'ACTIVE',
      isLatest: true,
      changeNote: (params.changeNote || `جایگزینی و انتشار نسخه ${nextVersion}`).trim(),
      updatedAt: nowIso,
      updatedBy: params.uploadedBy || 'کاربر سیستم',
    };

    // Mark previous versions as isLatest = false in DB
    for (const prev of existingFiles) {
      const updatedPrevMeta = {
        ...(prev.metadata || {}),
        title: nextMeta.title,
        documentNumber: nextMeta.documentNumber,
        category: nextMeta.category,
        unitName: nextMeta.unitName,
        description: nextMeta.description,
        status: nextMeta.status,
        isLatest: false,
      };
      prev.metadata = updatedPrevMeta;
      try {
        await db
          .update(schema.systemFiles)
          .set({ metadata: updatedPrevMeta })
          .where(eq(schema.systemFiles.fileId, prev.fileId));
      } catch (e) {
        // Ignore fallback
      }
    }

    const newFile = await this.saveFile({
      entityType: 'DOCUMENT',
      entityId: params.documentId,
      originalName: params.originalName,
      mimeType: params.mimeType,
      fileBuffer: params.fileBuffer,
      uploadedBy: params.uploadedBy,
      uploaderRole: params.uploaderRole,
      version: nextVersion,
      isPublic: false,
      metadata: nextMeta,
    });

    await auditService.log({
      action: 'REPLACE_DOCUMENT_VERSION',
      module: 'DOCUMENTS',
      entityType: 'DOCUMENT',
      entityId: params.documentId,
      newValue: {
        version: nextVersion,
        fileId: newFile.fileId,
        originalName: newFile.originalName,
        changeNote: nextMeta.changeNote,
      },
    });

    const allFiles = await this.getFilesForEntity('DOCUMENT', params.documentId);
    const [doc] = this.buildHseDocumentsFromRows(allFiles.length > 0 ? allFiles : [newFile, ...existingFiles]);
    return doc;
  }

  async updateHseDocumentMetadata(
    documentId: string,
    updates: {
      title?: string;
      documentNumber?: string;
      category?: HseDocumentCategory;
      unitId?: number | string | null;
      unitName?: string;
      issueDate?: string;
      expiryDate?: string;
      description?: string;
      status?: 'ACTIVE' | 'ARCHIVED';
    },
    actorName?: string
  ): Promise<HseDocumentDTO> {
    const existingFiles = await this.getFilesForEntity('DOCUMENT', documentId);
    if (!existingFiles || existingFiles.length === 0) {
      throw new NotFoundError('مستند مورد نظر در پایگاه داده یافت نشد.');
    }

    if (updates.title !== undefined && !updates.title.trim()) {
      throw new ValidationError('عنوان مستند نمی‌تواند خالی باشد.');
    }
    if (updates.documentNumber !== undefined && !updates.documentNumber.trim()) {
      throw new ValidationError('شماره مدرک نمی‌تواند خالی باشد.');
    }

    const nowIso = new Date().toISOString();

    for (let i = 0; i < existingFiles.length; i++) {
      const f = existingFiles[i];
      const prevMeta = (f.metadata && typeof f.metadata === 'object') ? f.metadata : {};
      const nextMeta = {
        ...prevMeta,
        title: updates.title !== undefined ? updates.title.trim() : prevMeta.title,
        documentNumber: updates.documentNumber !== undefined ? updates.documentNumber.trim() : prevMeta.documentNumber,
        category:
          updates.category && VALID_DOCUMENT_CATEGORIES.has(updates.category)
            ? updates.category
            : prevMeta.category,
        unitId: updates.unitId !== undefined ? updates.unitId : prevMeta.unitId,
        unitName: updates.unitName !== undefined ? updates.unitName.trim() : prevMeta.unitName,
        issueDate:
          i === 0 && updates.issueDate !== undefined ? updates.issueDate.trim() : prevMeta.issueDate,
        expiryDate:
          i === 0 && updates.expiryDate !== undefined ? updates.expiryDate.trim() : prevMeta.expiryDate,
        description: updates.description !== undefined ? updates.description.trim() : prevMeta.description,
        status: updates.status !== undefined ? updates.status : prevMeta.status || 'ACTIVE',
        updatedAt: nowIso,
        updatedBy: actorName || 'کاربر سیستم',
      };

      f.metadata = nextMeta;

      try {
        await db
          .update(schema.systemFiles)
          .set({ metadata: nextMeta })
          .where(eq(schema.systemFiles.fileId, f.fileId));
      } catch (e) {
        // Fallback
      }

      const memItem = inMemoryFiles.find((m) => m.fileId === f.fileId);
      if (memItem) {
        memItem.metadata = nextMeta;
      }
    }

    await auditService.log({
      action: 'UPDATE_DOCUMENT',
      module: 'DOCUMENTS',
      entityType: 'DOCUMENT',
      entityId: documentId,
      newValue: updates,
      details: { updatedBy: actorName },
    });

    const refreshed = await this.getFilesForEntity('DOCUMENT', documentId);
    const [doc] = this.buildHseDocumentsFromRows(refreshed);
    return doc;
  }

  async deleteHseDocument(documentId: string, actorName?: string): Promise<void> {
    const existingFiles = await this.getFilesForEntity('DOCUMENT', documentId);
    if (!existingFiles || existingFiles.length === 0) {
      throw new NotFoundError('مستند مورد نظر یافت نشد.');
    }

    for (const f of existingFiles) {
      const memIndex = inMemoryFiles.findIndex((m) => m.fileId === f.fileId);
      if (memIndex !== -1) {
        inMemoryFiles.splice(memIndex, 1);
      }
    }

    try {
      await db
        .update(schema.systemFiles)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(schema.systemFiles.entityType, 'DOCUMENT'),
            eq(schema.systemFiles.entityId, documentId)
          )
        );
    } catch (e) {
      // Fallback
    }

    await auditService.log({
      action: 'DELETE_DOCUMENT',
      module: 'DOCUMENTS',
      entityType: 'DOCUMENT',
      entityId: documentId,
      details: { deletedBy: actorName, title: existingFiles[0]?.metadata?.title },
    });
  }
}

export const fileService = new FileService();
