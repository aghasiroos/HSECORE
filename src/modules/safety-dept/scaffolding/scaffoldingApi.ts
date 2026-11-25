import { authFetch, extractApiError } from '../../../services/apiDatabaseClient';
import {
  ScaffoldBootstrapData,
  ScaffoldDetailData,
  ScaffoldInspectionRecord,
  ScaffoldKpis,
  ScaffoldManagementReportData,
  ScaffoldPermissionsMatrix,
  ScaffoldRecord,
  ScaffoldTagStatus,
} from './types';

const BASE = '/api/v1/scaffolding';

async function parseApiJson<T>(res: Response, fallbackMsg: string): Promise<T> {
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw extractApiError(res.status, null, fallbackMsg);
  }
  if (!res.ok || json?.success === false) {
    throw extractApiError(res.status, json, fallbackMsg);
  }
  return json.data as T;
}

export interface ScaffoldFilterParams {
  search?: string;
  unit?: string;
  contractor?: string;
  inspector?: string;
  tagStatus?: string;
  workflowStatus?: string;
  permitNumber?: string;
}

function buildQuery(filters?: ScaffoldFilterParams): string {
  if (!filters) return '';
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v && v !== 'ALL' && String(v).trim()) {
      qs.set(k, String(v).trim());
    }
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const scaffoldingApi = {
  async getBootstrap(): Promise<ScaffoldBootstrapData> {
    const res = await authFetch(`${BASE}/bootstrap`);
    return parseApiJson<ScaffoldBootstrapData>(res, 'خطا در دریافت اطلاعات پایه ماژول داربست‌بندی');
  },

  async list(filters?: ScaffoldFilterParams): Promise<{
    items: ScaffoldRecord[];
    kpis: ScaffoldKpis;
    filterOptions: { units: string[]; contractors: string[]; inspectors: string[] };
    permissions: ScaffoldPermissionsMatrix;
  }> {
    const res = await authFetch(`${BASE}${buildQuery(filters)}`);
    return parseApiJson(res, 'خطا در دریافت فهرست داربست‌ها');
  },

  async getDetail(id: number): Promise<ScaffoldDetailData> {
    const res = await authFetch(`${BASE}/${id}`);
    return parseApiJson<ScaffoldDetailData>(res, 'خطا در دریافت جزئیات داربست');
  },

  async create(payload: Record<string, any>): Promise<ScaffoldRecord> {
    const res = await authFetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<ScaffoldRecord>(res, 'خطا در ثبت داربست جدید');
  },

  async update(id: number, payload: Record<string, any>): Promise<ScaffoldRecord> {
    const res = await authFetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<ScaffoldRecord>(res, 'خطا در ویرایش اطلاعات داربست');
  },

  async completeInstallation(
    id: number,
    payload: { installationCompletedDate?: string; afterPhotos?: any[] }
  ): Promise<ScaffoldRecord> {
    const res = await authFetch(`${BASE}/${id}/complete-installation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<ScaffoldRecord>(res, 'خطا در ثبت تکمیل نصب داربست');
  },

  async recordInspection(
    scaffoldId: number,
    payload: Record<string, any>
  ): Promise<{ scaffold: ScaffoldRecord; inspection: ScaffoldInspectionRecord; evaluation: any }> {
    const res = await authFetch(`${BASE}/${scaffoldId}/inspections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson(res, 'خطا در ثبت بازرسی و چک‌لیست داربست');
  },

  async approve(
    scaffoldId: number,
    payload: { comment?: string; issueGreenTag?: boolean; tagValidUntil?: string }
  ): Promise<ScaffoldRecord> {
    const res = await authFetch(`${BASE}/${scaffoldId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson<ScaffoldRecord>(res, 'خطا در تأیید نهایی داربست');
  },

  async changeTag(
    scaffoldId: number,
    payload: { newTag: ScaffoldTagStatus; reason: string; validUntil?: string }
  ): Promise<{ scaffold: ScaffoldRecord; historyEntry: any }> {
    const res = await authFetch(`${BASE}/${scaffoldId}/tag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseApiJson(res, 'خطا در تغییر وضعیت تگ رنگی داربست');
  },

  async delete(id: number): Promise<{ id: number; scaffoldCode: string }> {
    const res = await authFetch(`${BASE}/${id}`, { method: 'DELETE' });
    return parseApiJson(res, 'خطا در حذف رکورد داربست');
  },

  async getManagementReport(filters?: ScaffoldFilterParams): Promise<ScaffoldManagementReportData> {
    const res = await authFetch(`${BASE}/reports/summary${buildQuery(filters)}`);
    return parseApiJson<ScaffoldManagementReportData>(res, 'خطا در دریافت گزارش مدیریتی داربست‌ها');
  },
};
