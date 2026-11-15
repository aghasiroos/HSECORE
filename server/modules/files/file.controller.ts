import { Request, Response } from 'express';
import { fileService, HseDocumentCategory, normalizeUploadedFilename } from './file.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { ValidationError } from '../../core/errors.ts';
import { broadcastDataMutation } from '../../core/socket.ts';

function extractFileFromRequest(req: Request): {
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
} {
  if (req.file) {
    return {
      fileBuffer: req.file.buffer,
      originalName: normalizeUploadedFilename(req.body?.originalFileName || req.file.originalname),
      mimeType: req.file.mimetype,
    };
  }
  if (req.body && req.body.fileData) {
    const base64Data = req.body.fileData.includes('base64,')
      ? req.body.fileData.split('base64,')[1]
      : req.body.fileData;
    return {
      fileBuffer: Buffer.from(base64Data, 'base64'),
      originalName: normalizeUploadedFilename(
        req.body.originalFileName || req.body.fileName || 'document.pdf'
      ),
      mimeType: req.body.mimeType || 'application/pdf',
    };
  }
  throw new ValidationError('هیچ فایلی برای بارگذاری ارسال نشده است.');
}

export class FileController {
  async uploadFile(req: Request, res: Response) {
    const { fileBuffer, originalName, mimeType } = extractFileFromRequest(req);
    const { entityType, entityId, isPublic, metadata } = req.body;

    if (!entityType || !entityId) {
      throw new ValidationError(
        'مشخص کردن نوع موجودیت (entityType) و شناسه موجودیت (entityId) الزامی است.'
      );
    }

    const saved = await fileService.saveFile({
      entityType,
      entityId,
      originalName,
      mimeType,
      fileBuffer,
      uploadedBy: req.user?.name || (req.headers['x-user-name'] as string) || 'کاربر سیستم',
      uploaderRole: req.user?.role,
      isPublic: isPublic === 'true' || isPublic === true,
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
    });

    return ApiResponse.success(res, saved, undefined, 201);
  }

  async downloadFile(req: Request, res: Response) {
    const fileId = req.params.id;
    const { file, buffer } = await fileService.getFileBufferById(fileId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"; filename*=UTF-8''${encodeURIComponent(
        file.originalName
      )}`
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.end(buffer);
  }

  async previewFile(req: Request, res: Response) {
    const fileId = req.params.id;
    const { file, buffer } = await fileService.getFileBufferById(fileId);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"; filename*=UTF-8''${encodeURIComponent(
        file.originalName
      )}`
    );
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.end(buffer);
  }

  async renderPdfPage(req: Request, res: Response) {
    const fileId = req.params.id;
    const pageNum = parseInt(String(req.query.page || '1'), 10) || 1;
    const { buffer, totalPages } = await fileService.renderPdfPageToPng(fileId, pageNum);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Total-Pages', String(totalPages));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  async getFilesForEntity(req: Request, res: Response) {
    const { entityType, entityId } = req.params;
    const files = await fileService.getFilesForEntity(entityType, entityId);
    return ApiResponse.success(res, files, { total: files.length });
  }

  async deleteFile(req: Request, res: Response) {
    const fileId = req.params.id;
    await fileService.softDeleteFile(fileId, req.user?.name);
    return ApiResponse.success(res, { message: 'فایل با موفقیت حذف شد' });
  }

  // ==========================================================================
  // HSE Instructions & Documents Endpoints
  // ==========================================================================

  async listDocuments(req: Request, res: Response) {
    const docs = await fileService.listHseDocuments({
      search: req.query.search ? String(req.query.search) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
      unitName: req.query.unitName ? String(req.query.unitName) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
    });
    return ApiResponse.success(res, docs, { total: docs.length });
  }

  async createDocument(req: Request, res: Response) {
    const { fileBuffer, originalName, mimeType } = extractFileFromRequest(req);
    const {
      title,
      documentNumber,
      category,
      unitId,
      unitName,
      issueDate,
      expiryDate,
      description,
      tabMetadata,
    } = req.body;

    const created = await fileService.createHseDocument({
      title,
      documentNumber,
      category: (category || 'ORG_PROCEDURES') as HseDocumentCategory,
      unitId: unitId ?? null,
      unitName: unitName || 'عمومی مجتمع',
      issueDate: issueDate || '',
      expiryDate: expiryDate || '',
      description: description || '',
      tabMetadata,
      originalName,
      mimeType,
      fileBuffer,
      uploadedBy: req.user?.name || req.user?.username || 'کاربر سیستم',
      uploaderRole: req.user?.role,
    });

    broadcastDataMutation('documents', 'create', created);
    return ApiResponse.success(res, created, undefined, 201);
  }

  async replaceDocumentFile(req: Request, res: Response) {
    const documentId = req.params.documentId;
    const { fileBuffer, originalName, mimeType } = extractFileFromRequest(req);
    const {
      changeNote,
      issueDate,
      expiryDate,
      title,
      documentNumber,
      category,
      unitName,
      description,
      tabMetadata,
    } = req.body;

    const updated = await fileService.replaceHseDocumentFile({
      documentId,
      originalName,
      mimeType,
      fileBuffer,
      changeNote,
      issueDate,
      expiryDate,
      title,
      documentNumber,
      category: category as HseDocumentCategory | undefined,
      unitName,
      description,
      tabMetadata,
      uploadedBy: req.user?.name || req.user?.username || 'کاربر سیستم',
      uploaderRole: req.user?.role,
    });

    broadcastDataMutation('documents', 'replace', updated);
    return ApiResponse.success(res, updated);
  }

  async updateDocumentMetadata(req: Request, res: Response) {
    const documentId = req.params.documentId;
    const {
      title,
      documentNumber,
      category,
      unitId,
      unitName,
      issueDate,
      expiryDate,
      description,
      tabMetadata,
      status,
    } = req.body;

    const updated = await fileService.updateHseDocumentMetadata(
      documentId,
      {
        title,
        documentNumber,
        category,
        unitId,
        unitName,
        issueDate,
        expiryDate,
        description,
        tabMetadata,
        status,
      },
      req.user?.name || req.user?.username || 'کاربر سیستم'
    );

    broadcastDataMutation('documents', 'update', updated);
    return ApiResponse.success(res, updated);
  }

  async addDocumentAttachment(req: Request, res: Response) {
    const documentId = req.params.documentId;
    const { fileBuffer, originalName, mimeType } = extractFileFromRequest(req);
    const { role, title } = req.body;

    const updated = await fileService.addDocumentAttachment({
      documentId,
      fileBuffer,
      originalName,
      mimeType,
      role,
      title,
      uploadedBy: req.user?.name || req.user?.username || 'کاربر سیستم',
      uploaderRole: req.user?.role,
    });

    broadcastDataMutation('documents', 'attachment_add', updated);
    return ApiResponse.success(res, updated, undefined, 201);
  }

  async deleteDocumentAttachment(req: Request, res: Response) {
    const { documentId, fileId } = req.params;
    const updated = await fileService.deleteDocumentAttachment(
      documentId,
      fileId,
      req.user?.name || req.user?.username || 'کاربر سیستم'
    );
    broadcastDataMutation('documents', 'attachment_delete', updated);
    return ApiResponse.success(res, updated);
  }

  async deleteDocument(req: Request, res: Response) {
    const documentId = req.params.documentId;
    await fileService.deleteHseDocument(
      documentId,
      req.user?.name || req.user?.username || 'کاربر سیستم'
    );
    broadcastDataMutation('documents', 'delete', { documentId });
    return ApiResponse.success(res, { message: 'مستند با موفقیت از سامانه حذف گردید.' });
  }
}

export const fileController = new FileController();
