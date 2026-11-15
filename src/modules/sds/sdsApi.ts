import { authFetch } from '../../services/apiDatabaseClient';
import type { SdsAttachmentItem, SdsDashboardStats, SdsRecordItem } from './types';

export interface SdsListResponse {
  records: SdsRecordItem[];
  stats: SdsDashboardStats;
}

export interface DuplicateCheckResult {
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
}

async function parseApiJson<T>(res: Response, fallbackMsg: string): Promise<T> {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.success === false) {
    const errMsg =
      payload?.error?.message ||
      (typeof payload?.error === 'string' ? payload.error : '') ||
      payload?.message ||
      `${fallbackMsg} (${res.status})`;
    throw new Error(errMsg);
  }
  return payload.data as T;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خطا در خواندن فایل انتخابی'));
    reader.readAsDataURL(file);
  });
}

export const sdsApi = {
  async list(filters?: {
    search?: string;
    unitName?: string;
    status?: string;
    casNumber?: string;
    onlyNeedsRevision?: boolean;
    onlyMissingPdf?: boolean;
    onlyHazardous?: boolean;
  }): Promise<SdsListResponse> {
    const query = new URLSearchParams();
    if (filters?.search) query.append('search', filters.search);
    if (filters?.unitName && filters.unitName !== 'ALL') query.append('unitName', filters.unitName);
    if (filters?.status && filters.status !== 'ALL') query.append('status', filters.status);
    if (filters?.casNumber) query.append('casNumber', filters.casNumber);
    if (filters?.onlyNeedsRevision) query.append('onlyNeedsRevision', 'true');
    if (filters?.onlyMissingPdf) query.append('onlyMissingPdf', 'true');
    if (filters?.onlyHazardous) query.append('onlyHazardous', 'true');

    const qs = query.toString();
    const res = await authFetch(`/api/v1/sds${qs ? `?${qs}` : ''}`);
    return parseApiJson<SdsListResponse>(res, 'خطا در دریافت لیست SDSها');
  },

  async checkDuplicate(params: {
    casNumber?: string;
    materialNameFa?: string;
    materialNameEn?: string;
    excludeId?: number;
  }): Promise<DuplicateCheckResult> {
    const query = new URLSearchParams();
    if (params.casNumber) query.append('casNumber', params.casNumber);
    if (params.materialNameFa) query.append('materialNameFa', params.materialNameFa);
    if (params.materialNameEn) query.append('materialNameEn', params.materialNameEn);
    if (params.excludeId) query.append('excludeId', String(params.excludeId));
    const res = await authFetch(`/api/v1/sds/check-duplicate?${query.toString()}`);
    return parseApiJson<DuplicateCheckResult>(res, 'خطا در بررسی تکراری بودن ماده');
  },

  async getById(id: number): Promise<SdsRecordItem> {
    const res = await authFetch(`/api/v1/sds/${id}`);
    return parseApiJson<SdsRecordItem>(res, 'خطا در دریافت اطلاعات کامل SDS');
  },

  async create(payload: any): Promise<SdsRecordItem> {
    const res = await authFetch('/api/v1/sds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<SdsRecordItem>(res, 'خطا در ثبت برگه SDS جدید');
  },

  async update(id: number, payload: any): Promise<SdsRecordItem> {
    const res = await authFetch(`/api/v1/sds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<SdsRecordItem>(res, 'خطا در بروزرسانی اطلاعات SDS');
  },

  async createRevision(
    id: number,
    payload: { changeSummary?: string; triggerReason?: string; lastRevisionDate?: string }
  ): Promise<SdsRecordItem> {
    const res = await authFetch(`/api/v1/sds/${id}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<SdsRecordItem>(res, 'خطا در ایجاد بازنگری جدید SDS');
  },

  async changeStatus(
    id: number,
    payload: {
      action: 'SUBMIT_REVIEW' | 'APPROVE' | 'PUBLISH' | 'MARK_OBSOLETE' | 'FLAG_REVISION' | 'RETURN_DRAFT';
      notes?: string;
      needsRevision?: boolean;
      reviewAlertMessage?: string;
      revisionTriggerReason?: string;
    }
  ): Promise<SdsRecordItem> {
    const res = await authFetch(`/api/v1/sds/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<SdsRecordItem>(res, 'خطا در تغییر وضعیت چرخه حیات SDS');
  },

  async uploadAttachment(
    sdsId: number,
    params: {
      file: File;
      attachmentRole: string;
      title?: string;
      notes?: string;
      isPrimary?: boolean;
    }
  ): Promise<SdsAttachmentItem> {
    const fd = new FormData();
    fd.append('file', params.file);
    fd.append('originalFileName', params.file.name);
    fd.append('attachmentRole', params.attachmentRole);
    fd.append('title', params.title || params.file.name);
    if (params.notes) fd.append('notes', params.notes);
    fd.append('isPrimary', params.isPrimary ? 'true' : 'false');

    const res = await authFetch(`/api/v1/sds/${sdsId}/attachments`, {
      method: 'POST',
      body: fd,
    });

    if (res.status === 400 || res.status === 415) {
      // Fallback to JSON base64 if multipart proxy interferes
      const cloneErr = await res.clone().json().catch(() => null);
      const errText = String(cloneErr?.error?.message || cloneErr?.error || '');
      if (!errText || errText.includes('فایلی برای بارگذاری')) {
        const base64 = await fileToBase64(params.file);
        const fallbackRes = await authFetch(`/api/v1/sds/${sdsId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64,
            originalFileName: params.file.name,
            mimeType: params.file.type || 'application/pdf',
            attachmentRole: params.attachmentRole,
            title: params.title || params.file.name,
            notes: params.notes || '',
            isPrimary: Boolean(params.isPrimary),
          }),
        });
        return parseApiJson<SdsAttachmentItem>(fallbackRes, 'خطا در بارگذاری فایل پیوست');
      }
    }

    return parseApiJson<SdsAttachmentItem>(res, 'خطا در بارگذاری فایل پیوست');
  },

  async setPrimaryAttachment(sdsId: number, attachmentId: number): Promise<SdsRecordItem> {
    const res = await authFetch(`/api/v1/sds/${sdsId}/attachments/${attachmentId}/primary`, {
      method: 'PATCH',
    });
    return parseApiJson<SdsRecordItem>(res, 'خطا در تعیین فایل اصلی SDS');
  },

  async deleteAttachment(sdsId: number, attachmentId: number): Promise<SdsRecordItem> {
    const res = await authFetch(`/api/v1/sds/${sdsId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    return parseApiJson<SdsRecordItem>(res, 'خطا در حذف فایل پیوست');
  },

  async remove(id: number): Promise<void> {
    const res = await authFetch(`/api/v1/sds/${id}`, {
      method: 'DELETE',
    });
    await parseApiJson<any>(res, 'خطا در حذف برگه SDS');
  },
};
