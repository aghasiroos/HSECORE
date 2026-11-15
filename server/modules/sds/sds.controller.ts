import { Request, Response } from 'express';
import { sdsService } from './sds.service.ts';
import { ApiResponse } from '../../core/response.ts';
import { ValidationError } from '../../core/errors.ts';
import { normalizeUploadedFilename } from '../files/file.service.ts';

function extractFileBuffer(req: Request): {
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
    const base64Data = String(req.body.fileData).includes('base64,')
      ? String(req.body.fileData).split('base64,')[1]
      : String(req.body.fileData);
    return {
      fileBuffer: Buffer.from(base64Data, 'base64'),
      originalName: normalizeUploadedFilename(
        req.body.originalFileName || req.body.fileName || 'sds-document.pdf'
      ),
      mimeType: req.body.mimeType || 'application/pdf',
    };
  }
  throw new ValidationError('هیچ فایلی برای بارگذاری ارسال نشده است.');
}

function parseNumericId(raw: string, label = 'شناسه'): number {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`${label} نامعتبر است.`);
  }
  return num;
}

export class SdsController {
  async list(req: Request, res: Response) {
    const result = await sdsService.listSdsRecords({
      search: req.query.search ? String(req.query.search) : undefined,
      unitName: req.query.unitName ? String(req.query.unitName) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      casNumber: req.query.casNumber ? String(req.query.casNumber) : undefined,
      onlyNeedsRevision: req.query.onlyNeedsRevision === 'true',
      onlyMissingPdf: req.query.onlyMissingPdf === 'true',
      onlyHazardous: req.query.onlyHazardous === 'true',
    });
    return ApiResponse.success(res, result, { total: result.records.length });
  }

  async checkDuplicate(req: Request, res: Response) {
    const result = await sdsService.checkDuplicate({
      casNumber: req.query.casNumber ? String(req.query.casNumber) : undefined,
      materialNameFa: req.query.materialNameFa ? String(req.query.materialNameFa) : undefined,
      materialNameEn: req.query.materialNameEn ? String(req.query.materialNameEn) : undefined,
      excludeId: req.query.excludeId ? Number(req.query.excludeId) : undefined,
    });
    return ApiResponse.success(res, result);
  }

  async getById(req: Request, res: Response) {
    const id = parseNumericId(req.params.id, 'شناسه SDS');
    const record = await sdsService.getSdsById(id);
    return ApiResponse.success(res, record);
  }

  async create(req: Request, res: Response) {
    const created = await sdsService.createSdsRecord(req.body || {}, req);
    return ApiResponse.success(res, created, undefined, 201);
  }

  async update(req: Request, res: Response) {
    const id = parseNumericId(req.params.id, 'شناسه SDS');
    const updated = await sdsService.updateSdsRecord(id, req.body || {}, req);
    return ApiResponse.success(res, updated);
  }

  async createRevision(req: Request, res: Response) {
    const id = parseNumericId(req.params.id, 'شناسه SDS');
    const updated = await sdsService.createNewRevision(id, req.body || {}, req);
    return ApiResponse.success(res, updated, undefined, 201);
  }

  async changeStatus(req: Request, res: Response) {
    const id = parseNumericId(req.params.id, 'شناسه SDS');
    const { action, notes, needsRevision, reviewAlertMessage, revisionTriggerReason } = req.body || {};
    if (!action) {
      throw new ValidationError('نوع عملیات تغییر وضعیت مشخص نشده است.');
    }
    const updated = await sdsService.changeStatus(
      id,
      { action, notes, needsRevision, reviewAlertMessage, revisionTriggerReason },
      req
    );
    return ApiResponse.success(res, updated);
  }

  async uploadAttachment(req: Request, res: Response) {
    const id = parseNumericId(req.params.id, 'شناسه SDS');
    const { fileBuffer, originalName, mimeType } = extractFileBuffer(req);
    const { attachmentRole, title, notes, isPrimary } = req.body || {};
    const attachment = await sdsService.addAttachment(
      id,
      {
        fileBuffer,
        originalName,
        mimeType,
        attachmentRole,
        title,
        notes,
        isPrimary: isPrimary === true || isPrimary === 'true',
      },
      req
    );
    return ApiResponse.success(res, attachment, undefined, 201);
  }

  async setPrimaryAttachment(req: Request, res: Response) {
    const sdsId = parseNumericId(req.params.id, 'شناسه SDS');
    const attId = parseNumericId(req.params.attachmentId, 'شناسه پیوست');
    const updated = await sdsService.setPrimaryAttachment(sdsId, attId, req);
    return ApiResponse.success(res, updated);
  }

  async deleteAttachment(req: Request, res: Response) {
    const sdsId = parseNumericId(req.params.id, 'شناسه SDS');
    const attId = parseNumericId(req.params.attachmentId, 'شناسه پیوست');
    const updated = await sdsService.removeAttachment(sdsId, attId, req);
    return ApiResponse.success(res, updated);
  }

  async remove(req: Request, res: Response) {
    const id = parseNumericId(req.params.id, 'شناسه SDS');
    await sdsService.deleteSdsRecord(id, req);
    return ApiResponse.success(res, { message: 'برگه اطلاعات ایمنی (SDS) با موفقیت حذف شد.' });
  }
}

export const sdsController = new SdsController();
