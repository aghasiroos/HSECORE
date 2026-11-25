/**
 * Client-side API Client for Relational Database
 * Provides RESTful communication with backend /api/v1 endpoints with
 * intelligent request deduplication and in-memory caching to eliminate redundant re-fetches.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  count?: number;
  removedCount?: number;
  error?: any;
  code?: string;
  conflict?: ConflictDetails | null;
}

export interface ConflictDetails {
  serverVersion?: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
  currentRecord?: any;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  conflict?: ConflictDetails | null;
  requiresConfirmation?: boolean;
  blockers?: any[];
  existingRecord?: any;
  details?: any;

  constructor(
    message: string,
    opts: {
      status?: number;
      code?: string;
      conflict?: ConflictDetails | null;
      requiresConfirmation?: boolean;
      blockers?: any[];
      existingRecord?: any;
      details?: any;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? 500;
    this.code = opts.code;
    this.conflict = opts.conflict ?? null;
    this.requiresConfirmation = opts.requiresConfirmation;
    this.blockers = opts.blockers;
    this.existingRecord = opts.existingRecord;
    this.details = opts.details;
  }
}

export function isConflictError(err: any): err is ApiError {
  return Boolean(
    err &&
      (err.status === 409 ||
        err.code === 'VERSION_CONFLICT' ||
        (err.conflict && typeof err.conflict === 'object'))
  );
}

export function extractApiError(
  status: number,
  json: any,
  fallbackMessage: string
): ApiError {
  const errObj = json?.error && typeof json.error === 'object' ? json.error : null;
  const msg =
    (typeof json?.error === 'string' && json.error) ||
    errObj?.message ||
    json?.message ||
    fallbackMessage;
  const code =
    json?.code ||
    errObj?.code ||
    (status === 409 ? 'VERSION_CONFLICT' : undefined);
  const conflict =
    json?.conflict ||
    errObj?.conflict ||
    (status === 409 && json?.existingRecord
      ? {
          serverVersion: json.existingRecord?.version,
          updatedAt: json.existingRecord?.updatedAt,
          updatedBy: json.existingRecord?.updatedBy,
          currentRecord: json.existingRecord,
        }
      : null);

  return new ApiError(msg, {
    status,
    code,
    conflict,
    requiresConfirmation: Boolean(json?.requiresConfirmation || errObj?.requiresConfirmation),
    blockers: json?.blockers || errObj?.blockers,
    existingRecord: json?.existingRecord,
    details: errObj?.details ?? json?.details,
  });
}

async function fetchJsonStrict<T = any>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackErrMsg: string
): Promise<T> {
  const res = await authFetch(input, init);
  const parsed = await parseJsonSafely<any>(res);
  if (!parsed.ok || parsed.data?.success === false) {
    throw extractApiError(
      parsed.status,
      parsed.data,
      parsed.error || fallbackErrMsg
    );
  }
  return parsed.data as T;
}

// In-flight request deduplicator and short-lived TTL cache
const inFlightPromises = new Map<string, Promise<any>>();
const queryCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL_MS = 15000;
const MAX_CACHE_ENTRIES = 350;

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of queryCache.entries()) {
    if (now >= entry.expiry) {
      queryCache.delete(key);
    }
  }
  if (queryCache.size > MAX_CACHE_ENTRIES) {
    const keysToDelete = Array.from(queryCache.keys()).slice(0, 50);
    keysToDelete.forEach(k => queryCache.delete(k));
  }
}

function getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs = CACHE_TTL_MS): Promise<T> {
  const cached = queryCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return Promise.resolve(cached.data);
  }

  const existing = inFlightPromises.get(key);
  if (existing) {
    return existing;
  }

  const promise = fetcher()
    .then((result) => {
      if (queryCache.size >= MAX_CACHE_ENTRIES) {
        pruneCache();
      }
      queryCache.set(key, { data: result, expiry: Date.now() + ttlMs });
      return result;
    })
    .finally(() => {
      inFlightPromises.delete(key);
    });

  inFlightPromises.set(key, promise);
  return promise;
}

// In-memory authentication token with sessionStorage backup for tab reload continuity (zero operational data)
let inMemoryAuthToken: string | null = null;

export function setAuthToken(token: string | null): void {
  const changed = inMemoryAuthToken !== token;
  inMemoryAuthToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem('hse_auth_token', token);
      } else {
        sessionStorage.removeItem('hse_auth_token');
      }
      if (changed) {
        window.dispatchEvent(new CustomEvent('hse_auth_state_changed', { detail: { authenticated: Boolean(token) } }));
      }
    }
  } catch {}
}

export function getAuthToken(): string | null {
  if (!inMemoryAuthToken && typeof window !== 'undefined') {
    try {
      inMemoryAuthToken = sessionStorage.getItem('hse_auth_token');
    } catch {}
  }
  return inMemoryAuthToken;
}

export function getActiveClientUserHeaderPayload(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem('hse_current_user');
    if (!raw) return {};
    const u = JSON.parse(raw);
    if (!u || typeof u !== 'object') return {};
    const result: Record<string, string> = {};
    if (u.id) result['X-HSE-User-Id'] = encodeURIComponent(String(u.id));
    if (u.username) result['X-HSE-Username'] = encodeURIComponent(String(u.username));
    if (u.role) result['X-HSE-User-Role'] = encodeURIComponent(String(u.role));
    if (u.personnelNumber || u.personnelCode) {
      result['X-HSE-Personnel-Code'] = encodeURIComponent(String(u.personnelNumber || u.personnelCode));
    }
    if (u.fullName) result['X-HSE-User-Name'] = encodeURIComponent(String(u.fullName));
    if (u.jobTitle) result['X-HSE-User-JobTitle'] = encodeURIComponent(String(u.jobTitle));
    return result;
  } catch {
    return {};
  }
}

export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const userHeaders = getActiveClientUserHeaderPayload();
  for (const [k, v] of Object.entries(userHeaders)) {
    if (!headers.has(k)) {
      headers.set(k, v);
    }
  }
  const method = (init?.method || 'GET').toUpperCase();
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const startTime = Date.now();

  const fetchPromise = fetch(input, {
    ...init,
    credentials: 'include', // Automatically carries HttpOnly Secure SameSite cookies
    headers,
  });

  if (
    typeof window !== 'undefined' &&
    method !== 'GET' &&
    method !== 'HEAD' &&
    method !== 'OPTIONS' &&
    !urlStr.includes('/audit-logs') &&
    !urlStr.includes('/audit')
  ) {
    let parsedBody: any = null;
    if (typeof init?.body === 'string') {
      try {
        parsedBody = JSON.parse(init.body);
      } catch {}
    }
    fetchPromise
      .then((res) => {
        window.dispatchEvent(
          new CustomEvent('hse_api_mutation_completed', {
            detail: {
              method,
              url: urlStr,
              status: res.status,
              ok: res.ok,
              durationMs: Date.now() - startTime,
              requestBody: parsedBody,
            },
          })
        );
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent('hse_api_mutation_completed', {
            detail: {
              method,
              url: urlStr,
              status: 0,
              ok: false,
              durationMs: Date.now() - startTime,
              requestBody: parsedBody,
            },
          })
        );
      });
  }

  return fetchPromise;
}

/**
 * Safely parse JSON from Response, gracefully handling HTML error pages (e.g. 502/504 Nginx, 404 HTML)
 * to prevent SyntaxError: Unexpected token '<', "<html> <h"... is not valid JSON
 */
export async function parseJsonSafely<T = any>(res: Response): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';

  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return { ok: res.ok, status, data: undefined };
    }

    // Detect HTML response (e.g. 502 Bad Gateway / 404 HTML / 500 error page from reverse proxy)
    if (text.trim().startsWith('<') || (contentType && contentType.includes('text/html'))) {
      const errorMsg = status >= 500
        ? `خطای سرویس‌دهنده سرور (${status} Server Error)`
        : status === 404
        ? `اندپوینت مورد نظر یافت نشد (${status} Not Found)`
        : `پاسخ نامعتبر از سرور (کد وضعیت: ${status})`;
      return { ok: false, status, error: errorMsg };
    }

    const data = JSON.parse(text) as T;
    return { ok: res.ok, status, data };
  } catch {
    return {
      ok: false,
      status,
      error: `پاسخ دریافت شده از سرور ساختار معتبر JSON ندارد (کد وضعیت: ${status})`,
    };
  }
}

export async function safeFetchJson<T = ApiResponse>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await authFetch(input, init);
    const parsed = await parseJsonSafely<T>(res);
    if (parsed.ok && parsed.data !== undefined) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

function invalidateCacheKeys(...prefixes: string[]) {
  if (prefixes.length === 0 || prefixes.some((p) => !p || p === '*' || p === 'all')) {
    queryCache.clear();
    return;
  }
  for (const key of Array.from(queryCache.keys())) {
    if (prefixes.some((p) => key === p || key.startsWith(`${p}:`) || key.startsWith(p))) {
      queryCache.delete(key);
    }
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خطا در خواندن فایل انتخابی'));
    reader.readAsDataURL(file);
  });
}

async function sendDocumentWithJsonFallback(
  url: string,
  formData: FormData,
  defaultErrMsg: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  invalidateCacheKeys('documents');
  let firstErrMsg = defaultErrMsg;

  const attachedFile = formData.get('file');
  if (attachedFile instanceof File && attachedFile.name && !formData.get('originalFileName')) {
    formData.set('originalFileName', attachedFile.name);
  }

  try {
    const res = await authFetch(url, {
      method: 'POST',
      body: formData,
    });
    const parsed = await parseJsonSafely<any>(res);
    invalidateCacheKeys('documents');
    if (parsed.ok && parsed.data?.success) {
      return { success: true, data: parsed.data.data };
    }
    firstErrMsg =
      parsed.data?.error?.message || parsed.data?.message || parsed.error || defaultErrMsg;
    // If server returned a definitive business validation/permission error (not a missing-file or proxy/multipart issue), return immediately
    if (
      res.status === 401 ||
      res.status === 403 ||
      (res.status === 422 && !firstErrMsg.includes('فایل'))
    ) {
      return { success: false, error: firstErrMsg };
    }
  } catch (err: any) {
    firstErrMsg = err?.message || defaultErrMsg;
  }

  // Fallback: send as JSON base64 payload if multipart upload was blocked or stripped by proxy
  try {
    const fileEntry = formData.get('file');
    if (typeof File !== 'undefined' && fileEntry instanceof File) {
      const jsonBody: Record<string, any> = {};
      formData.forEach((val, key) => {
        if (key !== 'file') jsonBody[key] = val;
      });
      jsonBody.fileData = await fileToBase64(fileEntry);
      jsonBody.originalFileName = fileEntry.name;
      jsonBody.mimeType = fileEntry.type || 'application/pdf';

      const fallbackRes = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonBody),
      });
      const fallbackParsed = await parseJsonSafely<any>(fallbackRes);
      invalidateCacheKeys('documents');
      if (fallbackParsed.ok && fallbackParsed.data?.success) {
        return { success: true, data: fallbackParsed.data.data };
      }
      firstErrMsg =
        fallbackParsed.data?.error?.message ||
        fallbackParsed.data?.message ||
        fallbackParsed.error ||
        firstErrMsg;
    }
  } catch {
    // Keep original error message
  }

  return { success: false, error: firstErrMsg };
}

export const apiDb = {
  // Cache utility for explicit invalidation
  invalidateCache(...prefixes: string[]) {
    invalidateCacheKeys(...prefixes);
  },

  // --------------------------------------------------------------------------
  // Personnel
  // --------------------------------------------------------------------------
  async getPersonnel(): Promise<any[]> {
    return getCachedOrFetch('personnel:list', async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        '/api/v1/personnel',
        undefined,
        'خطا در دریافت لیست پرسنل از پایگاه داده'
      );
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async getPersonnelById(identifier: string): Promise<any | null> {
    return getCachedOrFetch(`personnel:${identifier}`, async () => {
      const res = await authFetch(`/api/v1/personnel/${encodeURIComponent(identifier)}`);
      if (res.status === 404) return null;
      const parsed = await parseJsonSafely<ApiResponse>(res);
      if (!parsed.ok || parsed.data?.success === false) {
        throw extractApiError(parsed.status, parsed.data, parsed.error || 'خطا در دریافت اطلاعات پرسنل');
      }
      return parsed.data?.data || null;
    });
  },

  async savePersonnel(data: any): Promise<any> {
    invalidateCacheKeys('personnel', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/personnel',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'خطا در ذخیره‌سازی اطلاعات پرسنل'
    );
    invalidateCacheKeys('personnel', 'sync:full', 'dashboard');
    return json.data;
  },

  async batchSavePersonnel(records: any[]): Promise<boolean> {
    if (!Array.isArray(records) || records.length === 0) {
      return true;
    }
    invalidateCacheKeys('personnel', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/personnel/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      },
      'خطا در ثبت گروهی پرسنل در پایگاه داده'
    );
    invalidateCacheKeys('personnel', 'sync:full', 'dashboard');
    return true;
  },

  async deletePersonnel(id: string, deleteUser = false): Promise<boolean> {
    invalidateCacheKeys('personnel', 'users', 'sync:full', 'dashboard');
    const res = await authFetch(`/api/v1/personnel/${encodeURIComponent(id)}?deleteUser=${deleteUser}`, {
      method: 'DELETE',
    });
    const parsed = await parseJsonSafely<ApiResponse>(res);
    if (!parsed.ok || parsed.data?.success === false) {
      throw extractApiError(parsed.status, parsed.data, parsed.error || 'خطا در حذف پرسنل از پایگاه داده');
    }
    invalidateCacheKeys('personnel', 'users', 'sync:full', 'dashboard');
    return true;
  },

  // --------------------------------------------------------------------------
  // Occupational Health & Medical Exams
  // --------------------------------------------------------------------------
  async getMedicalExams(year?: number): Promise<any[]> {
    return getCachedOrFetch(`medical-exams:${year || 'all'}`, async () => {
      const url = year ? `/api/v1/medical-exams?year=${year}` : '/api/v1/medical-exams';
      const json = await fetchJsonStrict<ApiResponse>(url, undefined, 'خطا در دریافت سوابق معاینات طب کار');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async getMedicalExamDetails(examId: number): Promise<any | null> {
    return getCachedOrFetch(`medical-exam-details:${examId}`, async () => {
      const res = await authFetch(`/api/v1/medical-exams/${examId}`);
      if (res.status === 404) return null;
      const parsed = await parseJsonSafely<ApiResponse>(res);
      if (!parsed.ok || parsed.data?.success === false) {
        throw extractApiError(parsed.status, parsed.data, parsed.error || 'خطا در دریافت جزئیات معاینه');
      }
      return parsed.data?.data || null;
    });
  },

  async getPersonnelMedicalHistory(identifier: string): Promise<{ personnel: any; history: any[] }> {
    return getCachedOrFetch(`medical-history:${identifier}`, async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        `/api/v1/medical-exams/history/${encodeURIComponent(identifier)}`,
        undefined,
        'خطا در دریافت تاریخچه طب کار پرسنل'
      );
      return json.data || { personnel: null, history: [] };
    });
  },

  async saveMedicalExam(examPayload: any): Promise<any> {
    invalidateCacheKeys('medical-exam', 'medical-history', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/medical-exams',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examPayload),
      },
      'خطا در ذخیره معاینه طب کار در پایگاه داده'
    );
    invalidateCacheKeys('medical-exam', 'medical-history', 'sync:full', 'dashboard');
    return json.data;
  },

  async batchImportMedicalExams(records: any[]): Promise<boolean> {
    invalidateCacheKeys('medical-exam', 'medical-history', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/medical-exams/batch-import',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      },
      'خطا در ورود گروهی معاینات طب کار'
    );
    invalidateCacheKeys('medical-exam', 'medical-history', 'sync:full', 'dashboard');
    return true;
  },

  // --------------------------------------------------------------------------
  // Work Permits (PTW)
  // --------------------------------------------------------------------------
  async getWorkPermits(status?: string): Promise<any[]> {
    return getCachedOrFetch(`permits:${status || 'all'}`, async () => {
      const url = status ? `/api/v1/work-permits?status=${encodeURIComponent(status)}` : '/api/v1/work-permits';
      const json = await fetchJsonStrict<ApiResponse>(url, undefined, 'خطا در دریافت فهرست پروانه‌های کار');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async saveWorkPermit(permit: any): Promise<any> {
    invalidateCacheKeys('permits', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/work-permits',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permit),
      },
      'خطا در ذخیره‌سازی پروانه کار در پایگاه داده'
    );
    invalidateCacheKeys('permits', 'sync:full', 'dashboard');
    return json.data;
  },

  async deleteWorkPermit(idOrNumber: string | number): Promise<boolean> {
    invalidateCacheKeys('permits', 'sync:full', 'dashboard');
    const encoded = encodeURIComponent(String(idOrNumber));
    const res = await authFetch(`/api/v1/work-permits/${encoded}`, {
      method: 'DELETE',
    });
    const parsed = await parseJsonSafely<ApiResponse>(res);
    invalidateCacheKeys('permits', 'sync:full', 'dashboard');
    if (!parsed.ok || parsed.data?.success === false) {
      throw extractApiError(parsed.status, parsed.data, parsed.error || 'خطا در حذف پروانه کار');
    }
    return true;
  },

  async signWorkPermit(permitId: number, signature: any): Promise<any> {
    invalidateCacheKeys('permits', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/work-permits/${permitId}/signatures`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signature),
      },
      'خطا در ثبت امضای دیجیتال پروانه کار'
    );
    invalidateCacheKeys('permits', 'sync:full', 'dashboard');
    return json.data;
  },

  // --------------------------------------------------------------------------
  // TRIR & Incidents
  // --------------------------------------------------------------------------
  async getTrirRecords(): Promise<any[]> {
    return getCachedOrFetch('trir:list', async () => {
      const json = await fetchJsonStrict<ApiResponse>('/api/v1/trir', undefined, 'خطا در دریافت آمار TRIR');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async saveTrirRecord(data: any): Promise<any> {
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/trir',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'خطا در ذخیره رکورد TRIR در پایگاه داده'
    );
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    return json.data;
  },

  async saveTrirBatch(records: any[]): Promise<any[]> {
    if (!Array.isArray(records)) return [];
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/trir/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      },
      'خطا در ذخیره گروهی رکوردهای TRIR'
    );
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    return Array.isArray(json.data) ? json.data : [];
  },

  async deleteTrirRecord(id: string | number, year?: number, month?: string): Promise<boolean> {
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    let url = `/api/v1/trir/${encodeURIComponent(String(id))}`;
    if (year && month) {
      url += `?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(String(month))}`;
    }
    await fetchJsonStrict<ApiResponse>(url, { method: 'DELETE' }, 'خطا در حذف رکورد TRIR');
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    return true;
  },

  async clearAllTrirRecords(): Promise<boolean> {
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>('/api/v1/trir', { method: 'DELETE' }, 'خطا در پاکسازی آمار TRIR');
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    return true;
  },

  async deduplicateTrirRecords(): Promise<number> {
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/trir/deduplicate',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      'خطا در حذف رکوردهای تکراری TRIR'
    );
    invalidateCacheKeys('trir', 'sync:full', 'dashboard');
    return json.removedCount || 0;
  },

  async getIncidents(): Promise<any[]> {
    return getCachedOrFetch('incidents:list', async () => {
      const json = await fetchJsonStrict<ApiResponse>('/api/v1/incidents', undefined, 'خطا در دریافت حوادث');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async getNextIncidentNumber(eventDate?: string, formType?: 'RHS-F68' | 'RHS-F28'): Promise<string> {
    const params = new URLSearchParams();
    if (eventDate) params.set('eventDate', eventDate);
    if (formType) params.set('formType', formType);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/next-number${qs}`,
      undefined,
      'خطا در دریافت کد گزارش بعدی'
    );
    return json?.data?.reportNumber || '';
  },

  async saveIncident(incident: any): Promise<any> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/incidents',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      },
      'خطا در ذخیره گزارش حادثه در پایگاه داده'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    return json.data;
  },

  async updateIncident(idOrNumber: string | number, incident: any): Promise<any> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(idOrNumber))}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      },
      'خطا در بروزرسانی گزارش در پایگاه داده'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    return json.data;
  },

  async triageIncidentWorkflow(idOrNumber: string | number, payload: any): Promise<any> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(idOrNumber))}/workflow/triage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ثبت بررسی اولیه واحد HSE'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    return json.data;
  },

  async investigateIncidentWorkflow(idOrNumber: string | number, payload: any): Promise<any> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(idOrNumber))}/workflow/investigate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ثبت بررسی کارشناس HSE و ارزیابی ریسک'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    return json.data;
  },

  async finalApproveIncidentWorkflow(idOrNumber: string | number, payload: any): Promise<any> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(idOrNumber))}/workflow/final-approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ثبت جمع‌بندی نهایی رئیس HSE'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    return json.data;
  },

  async saveIncidentRhsF34(idOrNumber: string | number, payload: any): Promise<any> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard', 'non_conformances');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(idOrNumber))}/rhs-f34`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ذخیره فرم تجزیه و تحلیل حادثه (RHS-F34)'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard', 'non_conformances');
    return json.data;
  },

  async reviewIncidentRhsF34(idOrNumber: string | number, payload: any): Promise<any> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard', 'non_conformances');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(idOrNumber))}/rhs-f34/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ثبت نتیجه بررسی رئیس HSE برای فرم RHS-F34'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard', 'non_conformances');
    return json.data;
  },

  async updateIncidentRhsF34NonConformance(idOrNumber: string | number, payload: any): Promise<any> {
    invalidateCacheKeys('incidents', 'non_conformances', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(idOrNumber))}/rhs-f34/non-conformance`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در بروزرسانی عدم انطباق تأخیر تحلیل حادثه'
    );
    invalidateCacheKeys('incidents', 'non_conformances', 'sync:full', 'dashboard');
    return json.data;
  },

  async uploadEntityFile(entityType: string, entityId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('originalFileName', file.name);
    const res = await authFetch('/api/v1/files/upload', {
      method: 'POST',
      body: formData,
    });
    const parsed = await parseJsonSafely<any>(res);
    if (!parsed.ok || !parsed.data?.success) {
      throw extractApiError(
        res.status,
        parsed.data,
        parsed.data?.error?.message || parsed.data?.message || 'خطا در بارگذاری فایل پیوست'
      );
    }
    return parsed.data.data;
  },

  async getEntityFiles(entityType: string, entityId: string): Promise<any[]> {
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/files/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
      undefined,
      'خطا در دریافت فایل‌های پیوست'
    );
    return Array.isArray(json.data) ? json.data : [];
  },

  async deleteIncident(id: string | number): Promise<boolean> {
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/incidents/${encodeURIComponent(String(id))}`,
      { method: 'DELETE' },
      'خطا در حذف گزارش حادثه'
    );
    invalidateCacheKeys('incidents', 'sync:full', 'dashboard');
    return true;
  },

  // --------------------------------------------------------------------------
  // Safety Warnings
  // --------------------------------------------------------------------------
  async getSafetyWarnings(): Promise<any[]> {
    return getCachedOrFetch('warnings:list', async () => {
      const json = await fetchJsonStrict<ApiResponse>('/api/v1/warnings', undefined, 'خطا در دریافت اخطارهای ایمنی');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async saveSafetyWarning(warning: any): Promise<any> {
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/warnings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warning),
      },
      'خطا در ذخیره اخطار ایمنی در پایگاه داده'
    );
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    return json.data;
  },

  async saveSafetyWarningsBatch(warnings: any[]): Promise<any[]> {
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/warnings/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warnings),
      },
      'خطا در ذخیره گروهی اخطارهای ایمنی'
    );
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    return Array.isArray(json.data) ? json.data : [];
  },

  async deleteSafetyWarning(id: string | number): Promise<boolean> {
    invalidateCacheKeys('warnings', 'warnings:list', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/warnings/${encodeURIComponent(String(id))}`,
      { method: 'DELETE' },
      'خطا در حذف اخطار ایمنی'
    );
    invalidateCacheKeys('warnings', 'warnings:list', 'sync:full', 'dashboard');
    return true;
  },

  async deduplicateSafetyWarnings(): Promise<number> {
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/warnings/deduplicate',
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      'خطا در پالایش تکراری اخطارها'
    );
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    return json.removedCount || 0;
  },

  async clearAllSafetyWarnings(): Promise<boolean> {
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>('/api/v1/warnings', { method: 'DELETE' }, 'خطا در پاکسازی اخطارها');
    invalidateCacheKeys('warnings', 'sync:full', 'dashboard');
    return true;
  },

  // --------------------------------------------------------------------------
  // Fire Equipment & 5S Audits
  // --------------------------------------------------------------------------
  async getFireEquipment(): Promise<any[]> {
    return getCachedOrFetch('fire-equipment:list', async () => {
      const json = await fetchJsonStrict<ApiResponse>('/api/v1/fire-equipment', undefined, 'خطا در دریافت تجهیزات آتش‌نشانی');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async saveFireEquipment(item: any): Promise<any> {
    invalidateCacheKeys('fire-equipment', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/fire-equipment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      },
      'خطا در ذخیره تجهیز در پایگاه داده'
    );
    invalidateCacheKeys('fire-equipment', 'sync:full', 'dashboard');
    return json.data;
  },

  async deleteFireEquipment(id: string | number): Promise<boolean> {
    invalidateCacheKeys('fire-equipment', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/fire-equipment/${encodeURIComponent(String(id))}`,
      { method: 'DELETE' },
      'خطا در حذف تجهیز آتش‌نشانی'
    );
    invalidateCacheKeys('fire-equipment', 'sync:full', 'dashboard');
    return true;
  },

  async getFiveSAudits(): Promise<any[]> {
    return getCachedOrFetch('five-s:list', async () => {
      const json = await fetchJsonStrict<ApiResponse>('/api/v1/five-s', undefined, 'خطا در دریافت ممیزی‌های 5S');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async saveFiveSAudit(audit: any): Promise<any> {
    invalidateCacheKeys('five-s', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/five-s',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audit),
      },
      'خطا در ذخیره ممیزی 5S'
    );
    invalidateCacheKeys('five-s', 'sync:full', 'dashboard');
    return json.data;
  },

  // --------------------------------------------------------------------------
  // Central Sync & Full Database State
  // --------------------------------------------------------------------------
  async getFullSyncSnapshot(): Promise<{ timestamp: string; status: string; data: Record<string, any> }> {
    return getCachedOrFetch('sync:full', async () => {
      return await fetchJsonStrict<{ timestamp: string; status: string; data: Record<string, any> }>(
        '/api/v1/sync/full',
        undefined,
        'خطا در همگام‌سازی کامل با پایگاه داده مرکزی'
      );
    }, 4000);
  },

  async checkSyncHealth(): Promise<boolean> {
    try {
      const res = await authFetch('/api/v1/sync/health');
      const parsed = await parseJsonSafely<any>(res);
      if (!parsed.ok || !parsed.data) return false;
      return Boolean(parsed.data.success && parsed.data.status === 'connected');
    } catch {
      return false;
    }
  },

  async getMissedSyncEvents(
    sinceSeq: number,
    serverInstanceId?: string
  ): Promise<{ events: any[]; latestSeq: number; resyncRequired: boolean; serverInstanceId?: string }> {
    const params = new URLSearchParams({ sinceSeq: String(sinceSeq) });
    if (serverInstanceId) {
      params.set('serverInstanceId', serverInstanceId);
    }
    const json = await fetchJsonStrict<any>(
      `/api/v1/sync/events/catchup?${params.toString()}`,
      undefined,
      'خطا در بازیابی رویدادهای همگام‌سازی'
    );
    const payload = json.data || json;
    return {
      events: Array.isArray(payload.events) ? payload.events : [],
      latestSeq: Number(payload.latestSeq || 0),
      resyncRequired: Boolean(payload.resyncRequired),
      serverInstanceId: typeof payload.serverInstanceId === 'string' ? payload.serverInstanceId : undefined,
    };
  },

  async pushEntity(entityType: string, data: any): Promise<any> {
    invalidateCacheKeys(entityType, `${entityType}s`, 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<any>(
      '/api/v1/sync/push',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, data }),
      },
      `خطا در ارسال اطلاعات (${entityType}) به پایگاه داده`
    );
    invalidateCacheKeys(entityType, `${entityType}s`, 'sync:full', 'dashboard');
    return json.data;
  },

  // --------------------------------------------------------------------------
  // Users Management
  // --------------------------------------------------------------------------
  async getUsers(): Promise<any[]> {
    return getCachedOrFetch('users:list', async () => {
      const json = await fetchJsonStrict<ApiResponse>('/api/v1/users', undefined, 'خطا در دریافت لیست کاربران');
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async saveUser(user: any): Promise<any> {
    invalidateCacheKeys('users', 'sync:full');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/users',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      },
      'خطا در ذخیره اطلاعات کاربر در پایگاه داده'
    );
    invalidateCacheKeys('users', 'sync:full');
    return json.data;
  },

  async deleteUser(uid: string): Promise<boolean> {
    invalidateCacheKeys('users', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/users/${encodeURIComponent(uid)}`,
      { method: 'DELETE' },
      'خطا در حذف حساب کاربری'
    );
    invalidateCacheKeys('users', 'sync:full');
    return true;
  },

  async getCurrentUserFromServer(): Promise<any | null> {
    try {
      const res = await authFetch('/api/v1/auth/me');
      if (!res.ok) return null;
      const parsed = await parseJsonSafely<ApiResponse>(res);
      return parsed.data?.data || null;
    } catch {
      return null;
    }
  },

  async getUserPersonnelAssignments(uid: string): Promise<any> {
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/users/${encodeURIComponent(uid)}/personnel-assignments`,
      undefined,
      'خطا در دریافت تخصیص پرسنل کاربر'
    );
    return json.data || null;
  },

  async updateUserPersonnelAssignments(
    uid: string,
    payload: { scope: 'ALL' | 'ASSIGNED'; personnelIds: Array<string | number> }
  ): Promise<any> {
    invalidateCacheKeys('users', 'personnel', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/users/${encodeURIComponent(uid)}/personnel-assignments`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در بروزرسانی اشخاص مرتبط کاربر'
    );
    invalidateCacheKeys('users', 'personnel', 'sync:full', 'dashboard');
    return json.data;
  },

  // --------------------------------------------------------------------------
  // Notifications
  // --------------------------------------------------------------------------
  async getNotifications(params?: { category?: string; priority?: string; sourceModule?: string; unreadOnly?: boolean; clientSessionId?: string }): Promise<any[]> {
    if (!getAuthToken()) return [];
    return getCachedOrFetch('notifications:list', async () => {
      let url = '/api/v1/notifications';
      if (params) {
        const q = new URLSearchParams();
        if (params.category) q.set('category', params.category);
        if (params.priority) q.set('priority', params.priority);
        if (params.sourceModule) q.set('sourceModule', params.sourceModule);
        if (params.unreadOnly) q.set('unreadOnly', 'true');
        if (params.clientSessionId) q.set('clientSessionId', params.clientSessionId);
        const qs = q.toString();
        if (qs) url += `?${qs}`;
      }
      const json = await fetchJsonStrict<ApiResponse>(
        url,
        undefined,
        'خطا در دریافت اعلان‌ها از پایگاه داده'
      );
      return json.data || [];
    }, 2000);
  },

  async saveNotification(notif: any): Promise<any> {
    invalidateCacheKeys('notifications', 'sync:full');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/notifications',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notif),
      },
      'خطا در ثبت و ذخیره اعلان در پایگاه داده'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return json.data;
  },

  async markNotificationRead(id: string, clientSessionId?: string): Promise<boolean> {
    invalidateCacheKeys('notifications', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/notifications/${encodeURIComponent(id)}/read`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSessionId }),
      },
      'خطا در ثبت وضعیت مطالعه اعلان'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return true;
  },

  async markAllNotificationsRead(): Promise<boolean> {
    invalidateCacheKeys('notifications', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/notifications/read',
      { method: 'POST' },
      'خطا در ثبت وضعیت مطالعه همه اعلان‌ها'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return true;
  },

  async acknowledgeNotification(
    id: string,
    note?: string,
    acknowledgmentSource?: string,
    clientSessionId?: string
  ): Promise<boolean> {
    invalidateCacheKeys('notifications', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/notifications/${encodeURIComponent(id)}/acknowledge`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
          acknowledgmentSource: acknowledgmentSource || 'in_app_modal',
          clientSessionId,
        }),
      },
      'خطا در ثبت تاییدیه دریافت هشدار در پایگاه داده'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return true;
  },

  async getNotificationPreferences(): Promise<any> {
    if (!getAuthToken()) return null;
    return getCachedOrFetch('notifications:preferences', async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        '/api/v1/notifications/preferences',
        undefined,
        'خطا در خواندن تنظیمات اعلان‌ها از پایگاه داده'
      );
      return json.data;
    }, 10000);
  },

  async saveNotificationPreferences(prefs: any): Promise<any> {
    invalidateCacheKeys('notifications:preferences');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/notifications/preferences',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      },
      'خطا در ذخیره تنظیمات اعلان‌ها در پایگاه داده'
    );
    invalidateCacheKeys('notifications:preferences');
    return json.data;
  },

  async uploadCustomSiren(
    audioData: string,
    fileName?: string,
    fileSize?: number
  ): Promise<{ success: boolean; audioUrl: string } | null> {
    invalidateCacheKeys('notifications:preferences', 'sync:full');
    const json = await fetchJsonStrict<any>(
      '/api/v1/notifications/custom-siren',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioData, fileName, fileSize }),
      },
      'خطا در آپلود فایل صوتی آژیر اختصاصی'
    );
    invalidateCacheKeys('notifications:preferences', 'sync:full');
    return json.data || json;
  },

  async deleteCustomSiren(): Promise<boolean> {
    invalidateCacheKeys('notifications:preferences', 'sync:full');
    await fetchJsonStrict<any>(
      '/api/v1/notifications/custom-siren',
      { method: 'DELETE' },
      'خطا در حذف فایل صوتی آژیر اختصاصی'
    );
    invalidateCacheKeys('notifications:preferences', 'sync:full');
    return true;
  },

  async getPublicActiveEmergencyAlerts(sinceIso?: string, clientSessionId?: string): Promise<any[]> {
    try {
      const q = new URLSearchParams();
      if (sinceIso) q.set('since', sinceIso);
      if (clientSessionId) q.set('clientSessionId', clientSessionId);
      const qs = q.toString();
      const url = qs
        ? `/api/v1/notifications/public/active?${qs}`
        : '/api/v1/notifications/public/active';
      const res = await fetch(url);
      if (!res.ok) return [];
      const json: ApiResponse = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async acknowledgePublicEmergency(
    notifId: string,
    clientSessionId?: string,
    note?: string,
    acknowledgmentSource?: string
  ): Promise<boolean> {
    invalidateCacheKeys('notifications', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/notifications/public/acknowledge',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifId,
          clientSessionId,
          note,
          acknowledgmentSource: acknowledgmentSource || 'login_screen',
        }),
      },
      'خطا در ثبت تاییدیه هشدار اضطراری عمومی'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return true;
  },

  async getVapidPublicKey(): Promise<string | null> {
    try {
      const res = await fetch('/api/v1/notifications/public/vapid-public-key');
      if (!res.ok) return null;
      const json: any = await res.json();
      return json?.data?.publicKey || json?.publicKey || null;
    } catch {
      return null;
    }
  },

  async subscribeWebPush(payload: {
    subscription: any;
    userId?: string;
    username?: string;
    userName?: string;
    role?: string;
    jobTitle?: string;
    departmentIds?: string[];
    departmentName?: string;
    deviceType?: 'desktop' | 'laptop' | 'mobile' | 'tablet';
    deviceName?: string;
    browserName?: string;
    osName?: string;
    clientSessionId?: string;
  }): Promise<any> {
    const json = await fetchJsonStrict<any>(
      '/api/v1/notifications/public/push-subscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ثبت اشتراک Push مرورگر در پایگاه داده'
    );
    return json?.data || true;
  },

  async unsubscribeWebPush(endpoint: string): Promise<boolean> {
    await fetchJsonStrict<any>(
      '/api/v1/notifications/public/push-unsubscribe',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      },
      'خطا در لغو اشتراک Push مرورگر'
    );
    return true;
  },

  async getPushSubscriptions(all?: boolean): Promise<any[]> {
    if (!getAuthToken()) return [];
    const url = all
      ? '/api/v1/notifications/push-subscriptions?all=true'
      : '/api/v1/notifications/push-subscriptions';
    const json = await fetchJsonStrict<any>(
      url,
      undefined,
      'خطا در دریافت لیست دستگاه‌های Push'
    );
    return json?.data || [];
  },

  async deletePushSubscription(idOrEndpoint: string): Promise<boolean> {
    await fetchJsonStrict<any>(
      `/api/v1/notifications/push-subscriptions/${encodeURIComponent(idOrEndpoint)}`,
      { method: 'DELETE' },
      'خطا در حذف دستگاه Push از پایگاه داده'
    );
    return true;
  },

  async confirmNotificationViewed(
    notifId: string,
    source: 'browser_push_click' | 'in_app_popup' | 'alert_details_view',
    userId?: string,
    userName?: string,
    deviceType?: string
  ): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await fetch('/api/v1/notifications/public/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifId,
          source,
          userId,
          userName,
          deviceType,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getNotificationById(id: string): Promise<any | null> {
    if (!getAuthToken()) return null;
    const json = await fetchJsonStrict<any>(
      `/api/v1/notifications/${encodeURIComponent(id)}`,
      undefined,
      'خطا در دریافت جزئیات اعلان'
    );
    return json?.data || null;
  },

  async triggerTestAlert(payload?: any): Promise<any> {
    invalidateCacheKeys('notifications', 'sync:full');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/notifications/test-alert',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      },
      'خطا در ارسال هشدار آزمایشی'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return json.data;
  },

  async deleteNotification(id: string): Promise<boolean> {
    invalidateCacheKeys('notifications', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/notifications/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      'خطا در حذف اعلان از پایگاه داده'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return true;
  },

  async clearAllNotifications(): Promise<boolean> {
    invalidateCacheKeys('notifications', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/notifications',
      { method: 'DELETE' },
      'خطا در پاک‌سازی اعلان‌ها در پایگاه داده'
    );
    invalidateCacheKeys('notifications', 'sync:full');
    return true;
  },

  // --------------------------------------------------------------------------
  // System Settings, User Preferences & Atomic Collections
  // --------------------------------------------------------------------------
  async getSettings(): Promise<Record<string, any>> {
    return getCachedOrFetch('settings:all', async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        '/api/v1/settings',
        undefined,
        'خطا در دریافت تنظیمات سیستم از پایگاه داده'
      );
      return json.data || {};
    });
  },

  async getSystemSettings(): Promise<Record<string, any>> {
    return this.getSettings();
  },

  async getSetting(key: string): Promise<any> {
    return getCachedOrFetch(`settings:${key}`, async () => {
      const json = await fetchJsonStrict<any>(
        `/api/v1/settings/${encodeURIComponent(key)}`,
        undefined,
        `خطا در خواندن تنظیمات (${key})`
      );
      return json.value !== undefined ? json.value : json.data;
    });
  },

  async getSettingWithMeta(key: string): Promise<{ key: string; value: any; version: number; updatedAt?: string; updatedBy?: string }> {
    return getCachedOrFetch(`settings-meta:${key}`, async () => {
      const json = await fetchJsonStrict<any>(
        `/api/v1/settings/${encodeURIComponent(key)}`,
        undefined,
        `خطا در خواندن متادیتای تنظیمات (${key})`
      );
      return {
        key: json.key || key,
        value: json.value !== undefined ? json.value : json.data,
        version: Number(json.version ?? 0),
        updatedAt: json.updatedAt,
        updatedBy: json.updatedBy,
      };
    });
  },

  async saveSetting(
    key: string,
    value: any,
    description?: string,
    expectedVersion?: number
  ): Promise<boolean> {
    invalidateCacheKeys(`settings:${key}`, `settings-meta:${key}`, 'settings:all', 'sync:full', 'dashboard');
    await fetchJsonStrict<any>(
      `/api/v1/settings/${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          description,
          ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        }),
      },
      `خطا در ذخیره تنظیمات (${key}) در پایگاه داده`
    );
    invalidateCacheKeys(`settings:${key}`, `settings-meta:${key}`, 'settings:all', 'sync:full', 'dashboard');
    return true;
  },

  async saveSettingWithMeta(
    key: string,
    value: any,
    description?: string,
    expectedVersion?: number
  ): Promise<{ key: string; value: any; version: number; updatedAt?: string }> {
    invalidateCacheKeys(`settings:${key}`, `settings-meta:${key}`, 'settings:all', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<any>(
      `/api/v1/settings/${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value,
          description,
          ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        }),
      },
      `خطا در ذخیره تنظیمات (${key}) در پایگاه داده`
    );
    invalidateCacheKeys(`settings:${key}`, `settings-meta:${key}`, 'settings:all', 'sync:full', 'dashboard');
    return {
      key: json.key || key,
      value: json.value !== undefined ? json.value : value,
      version: Number(json.version ?? 1),
      updatedAt: json.updatedAt,
    };
  },

  async saveSystemSetting(
    key: string,
    value: any,
    description?: string,
    expectedVersion?: number
  ): Promise<boolean> {
    return this.saveSetting(key, value, description, expectedVersion);
  },

  userPreferences: {
    getCached<T = any>(prefKey: string): T | null {
      const entry = queryCache.get(`user-prefs:${prefKey}`);
      if (entry && Date.now() < entry.expiry) {
        return (entry.data?.value ?? null) as T | null;
      }
      const allEntry = queryCache.get('user-prefs:all');
      if (allEntry && Date.now() < allEntry.expiry) {
        const val = allEntry.data?.data?.[prefKey];
        return (val !== undefined ? val : null) as T | null;
      }
      return null;
    },

    async getAll(): Promise<{ data: Record<string, any>; versions: Record<string, number> }> {
      return getCachedOrFetch('user-prefs:all', async () => {
        const json = await fetchJsonStrict<any>(
          '/api/v1/user-preferences',
          undefined,
          'خطا در دریافت تنظیمات کاربری از پایگاه داده'
        );
        return {
          data: json.data || {},
          versions: json.versions || {},
        };
      }, 10000);
    },

    async get<T = any>(prefKey: string): Promise<{ prefKey: string; value: T | null; version: number; updatedAt?: string | null }> {
      return getCachedOrFetch(`user-prefs:${prefKey}`, async () => {
        const json = await fetchJsonStrict<any>(
          `/api/v1/user-preferences/${encodeURIComponent(prefKey)}`,
          undefined,
          `خطا در خواندن تنظیمات کاربر (${prefKey})`
        );
        return {
          prefKey: json.prefKey || prefKey,
          value: (json.value ?? null) as T | null,
          version: Number(json.version ?? 0),
          updatedAt: json.updatedAt ?? null,
        };
      }, 10000);
    },

    async set<T = any>(
      prefKey: string,
      value: T,
      expectedVersion?: number
    ): Promise<{ prefKey: string; value: T; version: number; updatedAt?: string }> {
      invalidateCacheKeys(`user-prefs:${prefKey}`, 'user-prefs:all');
      const json = await fetchJsonStrict<any>(
        `/api/v1/user-preferences/${encodeURIComponent(prefKey)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value,
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
          }),
        },
        `خطا در ذخیره تنظیمات کاربر (${prefKey})`
      );
      invalidateCacheKeys(`user-prefs:${prefKey}`, 'user-prefs:all');
      const result = {
        prefKey: json.prefKey || prefKey,
        value: json.value as T,
        version: Number(json.version ?? 1),
        updatedAt: json.updatedAt,
      };
      queryCache.set(`user-prefs:${prefKey}`, { data: result, expiry: Date.now() + 10000 });
      return result;
    },

    async delete(prefKey: string): Promise<boolean> {
      invalidateCacheKeys(`user-prefs:${prefKey}`, 'user-prefs:all');
      await fetchJsonStrict<any>(
        `/api/v1/user-preferences/${encodeURIComponent(prefKey)}`,
        { method: 'DELETE' },
        `خطا در حذف تنظیمات کاربر (${prefKey})`
      );
      invalidateCacheKeys(`user-prefs:${prefKey}`, 'user-prefs:all');
      return true;
    },
  },

  collection: {
    async getAll<T = any>(collectionKey: string): Promise<T[]> {
      const res = await apiDb.collection.getWithMeta<T>(collectionKey);
      return res.items;
    },

    async getWithMeta<T = any>(collectionKey: string): Promise<{ items: T[]; version: number; updatedAt?: string | null }> {
      return getCachedOrFetch(`collection:${collectionKey}`, async () => {
        const json = await fetchJsonStrict<any>(
          `/api/v1/collection/${encodeURIComponent(collectionKey)}`,
          undefined,
          `خطا در خواندن مجموعه (${collectionKey}) از پایگاه داده`
        );
        return {
          items: Array.isArray(json.items) ? json.items : [],
          version: Number(json.version ?? 0),
          updatedAt: json.updatedAt ?? null,
        };
      }, 6000);
    },

    async upsertItem<T = any>(
      collectionKey: string,
      item: T,
      opts?: { expectedVersion?: number; position?: 'start' | 'end' }
    ): Promise<{ item: T; version: number }> {
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      const json = await fetchJsonStrict<any>(
        `/api/v1/collection/${encodeURIComponent(collectionKey)}/item`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item,
            ...(opts?.expectedVersion !== undefined ? { expectedVersion: opts.expectedVersion } : {}),
            ...(opts?.position ? { position: opts.position } : {}),
          }),
        },
        `خطا در ثبت رکورد در مجموعه (${collectionKey})`
      );
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      return { item: json.item as T, version: Number(json.version ?? 1) };
    },

    async updateItem<T = any>(
      collectionKey: string,
      itemId: string,
      item: Partial<T>,
      expectedVersion?: number
    ): Promise<{ item: T; version: number }> {
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      const json = await fetchJsonStrict<any>(
        `/api/v1/collection/${encodeURIComponent(collectionKey)}/item/${encodeURIComponent(itemId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item,
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
          }),
        },
        `خطا در بروزرسانی رکورد (${itemId}) در مجموعه (${collectionKey})`
      );
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      return { item: json.item as T, version: Number(json.version ?? 1) };
    },

    async deleteItem(
      collectionKey: string,
      itemId: string,
      expectedVersion?: number
    ): Promise<{ deletedId: string; version: number }> {
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      const qs = expectedVersion !== undefined ? `?expectedVersion=${encodeURIComponent(String(expectedVersion))}` : '';
      const json = await fetchJsonStrict<any>(
        `/api/v1/collection/${encodeURIComponent(collectionKey)}/item/${encodeURIComponent(itemId)}${qs}`,
        { method: 'DELETE' },
        `خطا در حذف رکورد (${itemId}) از مجموعه (${collectionKey})`
      );
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      return { deletedId: json.deletedId || itemId, version: Number(json.version ?? 1) };
    },

    async batch<T = any>(
      collectionKey: string,
      items: T[],
      mode: 'merge' | 'replace' = 'merge',
      expectedVersion?: number
    ): Promise<{ items: T[]; version: number }> {
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      const json = await fetchJsonStrict<any>(
        `/api/v1/collection/${encodeURIComponent(collectionKey)}/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            mode,
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
          }),
        },
        `خطا در ذخیره‌سازی گروهی مجموعه (${collectionKey})`
      );
      invalidateCacheKeys(`collection:${collectionKey}`, `settings:${collectionKey}`, 'settings:all', 'sync:full', 'dashboard');
      return {
        items: Array.isArray(json.items) ? json.items : [],
        version: Number(json.version ?? 1),
      };
    },
  },

  // --------------------------------------------------------------------------
  // Document Referrals & Digital Signatures (Database Authoritative)
  // --------------------------------------------------------------------------
  async getReferrals(): Promise<any[]> {
    let userScope = 'default';
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('hse_current_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          userScope = String(parsed?.id || parsed?.username || 'default');
        }
      } catch {}
    }
    return getCachedOrFetch(`referrals:list:${userScope}`, async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        '/api/v1/referrals',
        undefined,
        'خطا در دریافت ارجاعات اسناد'
      );
      return Array.isArray(json.data) ? json.data : [];
    }, 3000);
  },

  async saveReferrals(referrals: any[] | any): Promise<boolean> {
    invalidateCacheKeys('referrals', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/referrals',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(referrals),
      },
      'خطا در ذخیره ارجاعات در پایگاه داده'
    );
    invalidateCacheKeys('referrals', 'sync:full');
    return true;
  },

  async executeReferralAction(referralId: string, actionData: any): Promise<any> {
    invalidateCacheKeys('referrals', 'sync:full');
    const json = await fetchJsonStrict<any>(
      `/api/v1/referrals/${encodeURIComponent(referralId)}/action`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData),
      },
      'خطا در اجرای عملیات گردش کار'
    );
    invalidateCacheKeys('referrals', 'sync:full');
    return json;
  },

  async deleteSetting(key: string): Promise<boolean> {
    invalidateCacheKeys(`settings:${key}`, `settings-meta:${key}`, 'settings:all', 'sync:full', 'dashboard');
    await fetchJsonStrict<any>(
      `/api/v1/settings/${encodeURIComponent(key)}`,
      { method: 'DELETE' },
      `خطا در حذف تنظیمات (${key})`
    );
    invalidateCacheKeys(`settings:${key}`, `settings-meta:${key}`, 'settings:all', 'sync:full', 'dashboard');
    return true;
  },

  async deleteSystemSetting(key: string): Promise<boolean> {
    return this.deleteSetting(key);
  },

  // --------------------------------------------------------------------------
  // PPE (Personal Protective Equipment) Persistence
  // --------------------------------------------------------------------------
  async getPpeItems(): Promise<any[]> {
    const items = await this.getSetting('hse_ppe_items');
    return Array.isArray(items) ? items : [];
  },

  async savePpeItems(items: any[]): Promise<boolean> {
    return this.saveSetting('hse_ppe_items', items);
  },

  async getPpeIssuance(): Promise<any[]> {
    const list = await this.getSetting('hse_ppe_issuance');
    return Array.isArray(list) ? list : [];
  },

  async savePpeIssuance(records: any[]): Promise<boolean> {
    return this.saveSetting('hse_ppe_issuance', records);
  },

  async getPpeCategories(): Promise<any[]> {
    const cats = await this.getSetting('hse_ppe_categories');
    return Array.isArray(cats) ? cats : [];
  },

  async savePpeCategories(categories: any[]): Promise<boolean> {
    return this.saveSetting('hse_ppe_categories', categories);
  },

  // --------------------------------------------------------------------------
  // Training Management Persistence
  // --------------------------------------------------------------------------
  async getTrainingCourses(): Promise<any[]> {
    const courses = await this.getSetting('hse_training_courses_v2');
    return Array.isArray(courses) ? courses : [];
  },

  async saveTrainingCourses(courses: any[]): Promise<boolean> {
    return this.saveSetting('hse_training_courses_v2', courses);
  },

  async getTrainingNeeds(): Promise<any[]> {
    const needs = await this.getSetting('hse_training_needs');
    return Array.isArray(needs) ? needs : [];
  },

  async saveTrainingNeeds(needs: any[]): Promise<boolean> {
    return this.saveSetting('hse_training_needs', needs);
  },

  async getTrainingContractors(): Promise<any[]> {
    const contractors = await this.getSetting('hse_training_contractors');
    return Array.isArray(contractors) ? contractors : [];
  },

  async saveTrainingContractors(contractors: any[]): Promise<boolean> {
    return this.saveSetting('hse_training_contractors', contractors);
  },

  async getContractorTrainingData(): Promise<{
    records: any[];
    companies: any[];
    auditHistory: any[];
    syncedContractors: any[];
  }> {
    const json = await fetchJsonStrict<{
      success: boolean;
      data: {
        records: any[];
        companies: any[];
        auditHistory: any[];
        syncedContractors: any[];
      };
    }>(
      '/api/v1/training/contractor-records',
      { method: 'GET' },
      'خطا در دریافت سوابق آموزش شرکت‌ها و پیمانکاران'
    );
    return {
      records: Array.isArray(json?.data?.records) ? json.data.records : [],
      companies: Array.isArray(json?.data?.companies) ? json.data.companies : [],
      auditHistory: Array.isArray(json?.data?.auditHistory) ? json.data.auditHistory : [],
      syncedContractors: Array.isArray(json?.data?.syncedContractors) ? json.data.syncedContractors : [],
    };
  },

  async createContractorTrainingRecord(payload: {
    companyName: string;
    personnelFullName: string;
    jobTitle: string;
    trainingHours: number;
    trainingDate: string;
    courseTitle?: string;
    notes?: string;
  }): Promise<any> {
    const json = await fetchJsonStrict<{ success: boolean; data: any }>(
      '/api/v1/training/contractor-records',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ثبت سابقه آموزشی پرسنل پیمانکار'
    );
    this.invalidateCache('settings');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_training_updated', { detail: { action: 'contractor_create' } }));
    }
    return json.data;
  },

  async updateContractorTrainingRecord(
    recordId: string,
    payload: {
      companyName: string;
      personnelFullName: string;
      jobTitle: string;
      trainingHours: number;
      trainingDate: string;
      courseTitle?: string;
      notes?: string;
    }
  ): Promise<any> {
    const json = await fetchJsonStrict<{ success: boolean; data: any }>(
      `/api/v1/training/contractor-records/${encodeURIComponent(recordId)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در ویرایش سابقه آموزشی پرسنل پیمانکار'
    );
    this.invalidateCache('settings');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_training_updated', { detail: { action: 'contractor_update' } }));
    }
    return json.data;
  },

  async deleteContractorTrainingRecord(recordId: string): Promise<any> {
    const json = await fetchJsonStrict<{ success: boolean; data: any }>(
      `/api/v1/training/contractor-records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE' },
      'خطا در حذف سابقه آموزشی پرسنل پیمانکار'
    );
    this.invalidateCache('settings');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_training_updated', { detail: { action: 'contractor_delete' } }));
    }
    return json.data;
  },

  async getTrainingCalendarEvents(): Promise<any[]> {
    const events = await this.getSetting('hse_training_calendar_events');
    return Array.isArray(events) ? events : [];
  },

  async saveTrainingCalendarEvents(events: any[]): Promise<boolean> {
    return this.saveSetting('hse_training_calendar_events', events);
  },

  async getTrainingCourseDefs(): Promise<any[]> {
    const defs = await this.getSetting('hse_training_course_defs');
    return Array.isArray(defs) ? defs : [];
  },

  async saveTrainingCourseDefs(defs: any[]): Promise<boolean> {
    return this.saveSetting('hse_training_course_defs', defs);
  },

  async getTrainingBulkAssignments(): Promise<any[]> {
    try {
      const json = await fetchJsonStrict<{ success: boolean; data: any[] }>(
        '/api/v1/training/bulk-assignments',
        { method: 'GET' },
        'خطا در دریافت سوابق تخصیص گروهی آموزش'
      );
      return Array.isArray(json?.data) ? json.data : [];
    } catch {
      const fallback = await this.getSetting('hse_training_bulk_assignments');
      return Array.isArray(fallback) ? fallback : [];
    }
  },

  async bulkAssignTrainingByJobTitle(payload: any): Promise<any> {
    const json = await fetchJsonStrict<{ success: boolean; data: any }>(
      '/api/v1/training/bulk-assign',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در تخصیص گروهی دوره‌های آموزشی'
    );
    this.invalidateCache('settings');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_training_updated', { detail: { action: 'bulk_assign' } }));
    }
    return json.data;
  },

  async completeTrainingAssignment(recordId: string, date?: string): Promise<any> {
    const json = await fetchJsonStrict<{ success: boolean; data: any }>(
      `/api/v1/training/records/${encodeURIComponent(recordId)}/complete`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      },
      'خطا در ثبت اتمام دوره آموزشی'
    );
    this.invalidateCache('settings');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_training_updated', { detail: { action: 'complete', recordId } }));
    }
    return json.data;
  },

  // --------------------------------------------------------------------------
  // Fire Department & Fleet Operations Persistence
  // --------------------------------------------------------------------------
  async getFireDailyReports(): Promise<any[]> {
    const reports = await this.getSetting('hse_fire_daily_reports_v1');
    return Array.isArray(reports) ? reports : [];
  },

  async saveFireDailyReports(reports: any[]): Promise<boolean> {
    return this.saveSetting('hse_fire_daily_reports_v1', reports);
  },

  async getFireVehicles(): Promise<any[]> {
    const vehicles = await this.getSetting('hse_fire_vehicles_v1');
    return Array.isArray(vehicles) ? vehicles : [];
  },

  async saveFireVehicles(vehicles: any[]): Promise<boolean> {
    return this.saveSetting('hse_fire_vehicles_v1', vehicles);
  },

  async getFireVehicleStandards(): Promise<any[]> {
    const standards = await this.getSetting('hse_fire_vehicle_standards_v1');
    return Array.isArray(standards) ? standards : [];
  },

  async saveFireVehicleStandards(standards: any[]): Promise<boolean> {
    return this.saveSetting('hse_fire_vehicle_standards_v1', standards);
  },

  // --------------------------------------------------------------------------
  // PTW Audit Persistence
  // --------------------------------------------------------------------------
  async getPtwAuditRecords(): Promise<any[]> {
    const records = await this.collection.getAll('hse_ptw_audit_records_v2');
    return Array.isArray(records) ? records : [];
  },

  async savePtwAuditRecords(records: any[]): Promise<boolean> {
    await this.collection.batch('hse_ptw_audit_records_v2', records, 'replace');
    return true;
  },

  // --------------------------------------------------------------------------
  // 5S Audit & Inspections Persistence
  // --------------------------------------------------------------------------
  async getFiveSInspections(): Promise<any[]> {
    const inspections = await this.getSetting('hse_5s_inspections_v3');
    return Array.isArray(inspections) ? inspections : [];
  },

  async saveFiveSInspections(inspections: any[]): Promise<boolean> {
    return this.saveSetting('hse_5s_inspections_v3', inspections);
  },

  async getFiveSNonConformances(): Promise<any[]> {
    const ncs = await this.getSetting('hse_5s_nc_v3');
    return Array.isArray(ncs) ? ncs : [];
  },

  async saveFiveSNonConformances(ncs: any[]): Promise<boolean> {
    return this.saveSetting('hse_5s_nc_v3', ncs);
  },

  async getFiveSSchedules(): Promise<any[]> {
    const schedules = await this.getSetting('hse_5s_schedules_v3');
    return Array.isArray(schedules) ? schedules : [];
  },

  async saveFiveSSchedules(schedules: any[]): Promise<boolean> {
    return this.saveSetting('hse_5s_schedules_v3', schedules);
  },

  // --------------------------------------------------------------------------
  // Clinic & Dispensary (بهداری و مراجعات سرپایی طب کار)
  // --------------------------------------------------------------------------
  async getClinicVisits(): Promise<any[]> {
    const visits = await this.getSetting('hse_clinic_visits_v1');
    return Array.isArray(visits) ? visits : [];
  },

  async saveClinicVisits(visits: any[]): Promise<boolean> {
    return this.saveSetting('hse_clinic_visits_v1', visits);
  },

  // --------------------------------------------------------------------------
  // Nutrition Specialist (کارشناس تغذیه)
  // --------------------------------------------------------------------------
  async getNutritionRecords(): Promise<any[]> {
    const records = await this.getSetting('hse_nutrition_records_v1');
    return Array.isArray(records) ? records : [];
  },

  async saveNutritionRecords(records: any[]): Promise<boolean> {
    return this.saveSetting('hse_nutrition_records_v1', records);
  },

  // --------------------------------------------------------------------------
  // Organizational Structure Nodes
  // --------------------------------------------------------------------------
  async getOrgNodes(): Promise<any[]> {
    if (!getAuthToken()) return [];
    return getCachedOrFetch('organization:nodes', async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        '/api/v1/organization/nodes',
        undefined,
        'خطا در دریافت گره‌های ساختار سازمانی'
      );
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async getOrganizations(): Promise<any[]> {
    return this.getOrgNodes();
  },

  async saveOrgNodes(nodes: any[]): Promise<boolean> {
    if (!getAuthToken()) throw new ApiError('نشست کاربری معتبر نیست', { status: 401 });
    invalidateCacheKeys('organization:nodes', 'sync:full');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/organization/nodes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodes),
      },
      'خطا در ذخیره ساختار سازمانی'
    );
    invalidateCacheKeys('organization:nodes', 'sync:full');
    return true;
  },

  // --------------------------------------------------------------------------
  // Environmental & Safety Submodule Persistence (Atomic Collection Storage)
  // --------------------------------------------------------------------------
  async getEnvironmentalLogs(): Promise<any[]> {
    return this.collection.getAll('environmental_logs');
  },

  async createEnvironmentalLog(data: any): Promise<boolean> {
    await this.collection.upsertItem('environmental_logs', data, { position: 'start' });
    return true;
  },

  async updateEnvironmentalLog(id: string, data: any): Promise<boolean> {
    await this.collection.updateItem('environmental_logs', id, data);
    return true;
  },

  async deleteEnvironmentalLog(id: string): Promise<boolean> {
    await this.collection.deleteItem('environmental_logs', id);
    return true;
  },

  // --------------------------------------------------------------------------
  // Occupational Health Structured Persistence
  // --------------------------------------------------------------------------
  async getMedicalTestCatalog(): Promise<any[]> {
    const cat = await this.getSetting('medical_items_catalog');
    return Array.isArray(cat) ? cat : [];
  },

  async getMedicalReferenceRules(): Promise<any[]> {
    const rules = await this.getSetting('medical_reference_rules');
    return Array.isArray(rules) ? rules : [];
  },

  async getMedicalExamSessions(): Promise<any[]> {
    const sessions = await this.getSetting('medical_exam_sessions');
    return Array.isArray(sessions) ? sessions : [];
  },

  async getMedicalTestResults(): Promise<any[]> {
    const results = await this.getSetting('medical_test_results');
    return Array.isArray(results) ? results : [];
  },

  // --------------------------------------------------------------------------
  // Risk Assessments & Safety Inspections
  // --------------------------------------------------------------------------
  async getRiskAssessments(): Promise<any[]> {
    return getCachedOrFetch('risk-assessments:all', async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        '/api/v1/risk-assessments',
        undefined,
        'خطا در دریافت ارزیابی‌های ریسک'
      );
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async saveRiskAssessment(data: any): Promise<any> {
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    const numericId = Number(data?.dbId || data?.id);
    const isExisting = Number.isInteger(numericId) && numericId > 0;
    const url = isExisting ? `/api/v1/risk-assessments/${numericId}` : '/api/v1/risk-assessments';
    const json = await fetchJsonStrict<ApiResponse>(
      url,
      {
        method: isExisting ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'خطا در ذخیره‌سازی ارزیابی ریسک'
    );
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    return json.data;
  },

  async updateRiskAssessment(id: string | number, data: any): Promise<any> {
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/risk-assessments/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'خطا در بروزرسانی ارزیابی ریسک'
    );
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    return json.data;
  },

  async transitionRiskWorkflow(id: string | number, payload: { status?: string; workflowStage?: string; notes?: string; approverName?: string; expectedVersion?: number; version?: number }): Promise<any> {
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/risk-assessments/${id}/workflow`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      'خطا در تغییر وضعیت گردش کار ارزیابی ریسک'
    );
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    return json.data;
  },

  async deleteRiskAssessment(id: string | number): Promise<boolean> {
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/risk-assessments/${id}`,
      { method: 'DELETE' },
      'خطا در حذف ارزیابی ریسک'
    );
    invalidateCacheKeys('risk-assessments', 'sync:full', 'dashboard');
    return true;
  },

  async getSafetyInspections(): Promise<any[]> {
    const insp = await this.getSetting('safety_inspections');
    return Array.isArray(insp) ? insp : [];
  },

  async saveSafetyInspection(data: any): Promise<boolean> {
    const list = await this.getSafetyInspections();
    const idx = list.findIndex((i: any) => i.id === data.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list.unshift(data);
    }
    return this.saveSetting('safety_inspections', list);
  },

  async getSafetyTemplates(): Promise<any[]> {
    const temps = await this.getSetting('safety_templates');
    return Array.isArray(temps) ? temps : [];
  },

  async saveSafetyTemplate(data: any): Promise<boolean> {
    const list = await this.getSafetyTemplates();
    const idx = list.findIndex((t: any) => t.id === data.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list.unshift(data);
    }
    return this.saveSetting('safety_templates', list);
  },

  async deleteSafetyInspection(id: string): Promise<boolean> {
    const list = await this.getSafetyInspections();
    const filtered = list.filter((i: any) => i.id !== id);
    return this.saveSetting('safety_inspections', filtered);
  },

  async deleteSafetyTemplate(id: string): Promise<boolean> {
    const list = await this.getSafetyTemplates();
    const filtered = list.filter((t: any) => t.id !== id);
    return this.saveSetting('safety_templates', filtered);
  },

  async saveAllSafetyTemplates(templates: any[]): Promise<boolean> {
    return this.saveSetting('safety_templates', templates);
  },

  // --------------------------------------------------------------------------
  // Health & Environment Operational Checklists Persistence
  // --------------------------------------------------------------------------
  async getHealthEnvInspections(): Promise<any[]> {
    const insp = await this.getSetting('hse_health_env_inspections_v1');
    return Array.isArray(insp) ? insp : [];
  },

  async saveHealthEnvInspection(data: any): Promise<boolean> {
    const list = await this.getHealthEnvInspections();
    const idx = list.findIndex((i: any) => i.id === data.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list.unshift(data);
    }
    return this.saveSetting('hse_health_env_inspections_v1', list);
  },

  async deleteHealthEnvInspection(id: string): Promise<boolean> {
    const list = await this.getHealthEnvInspections();
    const filtered = list.filter((i: any) => i.id !== id);
    return this.saveSetting('hse_health_env_inspections_v1', filtered);
  },

  async getHealthEnvTemplates(): Promise<any[]> {
    const temps = await this.getSetting('hse_health_env_templates_v1');
    return Array.isArray(temps) ? temps : [];
  },

  async saveHealthEnvTemplate(data: any): Promise<boolean> {
    const list = await this.getHealthEnvTemplates();
    const idx = list.findIndex((t: any) => t.id === data.id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data };
    } else {
      list.unshift(data);
    }
    return this.saveSetting('hse_health_env_templates_v1', list);
  },

  async deleteHealthEnvTemplate(id: string): Promise<boolean> {
    const list = await this.getHealthEnvTemplates();
    const filtered = list.filter((t: any) => t.id !== id);
    return this.saveSetting('hse_health_env_templates_v1', filtered);
  },

  async saveAllHealthEnvTemplates(templates: any[]): Promise<boolean> {
    return this.saveSetting('hse_health_env_templates_v1', templates);
  },

  // --------------------------------------------------------------------------
  // Audit Logs
  // --------------------------------------------------------------------------
  async getAuditLogs(limit: number = 500): Promise<any[]> {
    return getCachedOrFetch(`audit-logs:${limit}`, async () => {
      try {
        const res = await authFetch(`/api/v1/audit-logs?limit=${limit}`);
        if (!res.ok) return [];
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    }, 1500);
  },

  async getAuditLogsPaged(params: {
    page?: number;
    limit?: number;
    search?: string;
    module?: string;
    actionType?: string;
    result?: string;
    user?: string;
    from?: string;
    to?: string;
  } = {}): Promise<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search?.trim()) qs.set('search', params.search.trim());
    if (params.module && params.module !== 'ALL') qs.set('module', params.module);
    if (params.actionType && params.actionType !== 'ALL') qs.set('actionType', params.actionType);
    if (params.result && params.result !== 'ALL') qs.set('result', params.result);
    if (params.user && params.user !== 'ALL') qs.set('user', params.user);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    try {
      const res = await authFetch(`/api/v1/audit-logs?${qs.toString()}`);
      if (!res.ok) {
        return { data: [], pagination: { page: 1, limit: params.limit || 50, total: 0, totalPages: 1 } };
      }
      const json: any = await res.json();
      return {
        data: json.data || [],
        pagination: json.pagination || {
          page: params.page || 1,
          limit: params.limit || 50,
          total: (json.data || []).length,
          totalPages: 1,
        },
      };
    } catch {
      return { data: [], pagination: { page: 1, limit: params.limit || 50, total: 0, totalPages: 1 } };
    }
  },

  async logAudit(entry: any): Promise<boolean> {
    try {
      invalidateCacheKeys('audit-logs', 'sync:full');
      const res = await authFetch('/api/v1/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Server-Side Authentication
  // --------------------------------------------------------------------------
  async login(credentials: { username: string; password: string }): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
    try {
      const res = await authFetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const parsed = await parseJsonSafely<any>(res);
      if (!parsed.ok || !parsed.data || !parsed.data.success) {
        const errorMsg = parsed.data?.error?.message || parsed.data?.message || parsed.error || 'نام کاربری یا کلمه عبور نادرست است';
        return { success: false, error: errorMsg };
      }
      setAuthToken(parsed.data.data?.token || null);
      return { success: true, token: parsed.data.data?.token, user: parsed.data.data?.user };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در ارتباط با سرور' };
    }
  },

  async getCurrentUser(): Promise<any | null> {
    try {
      const res = await authFetch('/api/v1/auth/me');
      if (!res.ok) return null;
      const parsed = await parseJsonSafely<any>(res);
      return parsed.data?.success ? parsed.data.data : null;
    } catch {
      return null;
    }
  },

  async updateMySessionTimeout(payload: {
    sessionAlwaysActive: boolean;
    sessionTimeoutMinutes: number;
  }): Promise<{
    success: boolean;
    data?: {
      sessionTimeoutMinutes: number;
      sessionAlwaysActive: boolean;
      sessionPolicy?: {
        alwaysActiveAllowed: boolean;
        maxSessionTimeoutMinutes?: number | null;
        enforcedByAdmin?: boolean;
      };
      updatedDate?: string;
    };
    error?: string;
  }> {
    try {
      const res = await authFetch('/api/v1/auth/me/session-timeout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const parsed = await parseJsonSafely<any>(res);
      if (!parsed.ok || !parsed.data || !parsed.data.success) {
        const errorMsg =
          parsed.data?.error?.message ||
          parsed.data?.message ||
          parsed.error ||
          'خطا در ذخیره تنظیمات خروج خودکار';
        return { success: false, error: errorMsg };
      }
      return { success: true, data: parsed.data.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await authFetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const parsed = await parseJsonSafely<any>(res);
      if (!parsed.ok || !parsed.data || !parsed.data.success) {
        const errorMsg = parsed.data?.error?.message || parsed.data?.message || parsed.error || 'خطا در تغییر رمز عبور';
        return { success: false, error: errorMsg };
      }
      return { success: true, message: parsed.data.data?.message || 'رمز عبور با موفقیت بروزرسانی شد' };
    } catch (err: any) {
      return { success: false, error: err.message || 'خطا در ارتباط با سرور' };
    }
  },

  async logout(): Promise<void> {
    setAuthToken(null);
    try {
      await authFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Best effort logout audit on server
    } finally {
      queryCache.clear();
      try {
        sessionStorage.removeItem('hse_auth_token');
        sessionStorage.removeItem('hse_current_user');
      } catch {}
    }
  },

  // --------------------------------------------------------------------------
  // Non-Conformance Management & CAPA (Database Authoritative)
  // --------------------------------------------------------------------------
  async getNonConformances(filters?: { sourceModule?: string; status?: string; riskLevel?: string; assignedTo?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (filters?.sourceModule) query.append('sourceModule', filters.sourceModule);
    if (filters?.status) query.append('status', filters.status);
    if (filters?.riskLevel) query.append('riskLevel', filters.riskLevel);
    if (filters?.assignedTo) query.append('assignedTo', filters.assignedTo);
    const qs = query.toString();
    const cacheKey = `non-conformances:${qs || 'all'}`;

    return getCachedOrFetch(cacheKey, async () => {
      const json = await fetchJsonStrict<ApiResponse>(
        `/api/v1/non-conformances${qs ? `?${qs}` : ''}`,
        undefined,
        'خطا در دریافت فهرست عدم‌انطباق‌ها'
      );
      return Array.isArray(json.data) ? json.data : [];
    });
  },

  async getNonConformanceById(id: string | number): Promise<any | null> {
    return getCachedOrFetch(`non-conformance:${id}`, async () => {
      const res = await authFetch(`/api/v1/non-conformances/${encodeURIComponent(String(id))}`);
      if (res.status === 404) return null;
      const parsed = await parseJsonSafely<ApiResponse>(res);
      if (!parsed.ok || parsed.data?.success === false) {
        throw extractApiError(parsed.status, parsed.data, parsed.error || 'خطا در دریافت عدم انطباق');
      }
      return parsed.data?.data || null;
    });
  },

  async createNonConformance(data: any): Promise<any> {
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      '/api/v1/non-conformances',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'خطا در ثبت عدم انطباق در پایگاه داده'
    );
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    return json.data;
  },

  async updateNonConformance(id: string | number, data: any): Promise<any> {
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    const json = await fetchJsonStrict<ApiResponse>(
      `/api/v1/non-conformances/${encodeURIComponent(String(id))}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
      'خطا در بروزرسانی عدم انطباق'
    );
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    return json.data;
  },

  async deleteNonConformance(id: string | number): Promise<boolean> {
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      `/api/v1/non-conformances/${encodeURIComponent(String(id))}`,
      { method: 'DELETE' },
      'خطا در حذف عدم انطباق'
    );
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    return true;
  },

  async deleteBatchNonConformances(ids: Array<string | number>): Promise<boolean> {
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    await fetchJsonStrict<ApiResponse>(
      '/api/v1/non-conformances/batch-delete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      },
      'خطا در حذف گروهی عدم انطباق‌ها'
    );
    invalidateCacheKeys('non-conformances', 'sync:full', 'dashboard');
    return true;
  },

  // --------------------------------------------------------------------------
  // Instructions & Documents Management (Server-Side Persistent Storage)
  // --------------------------------------------------------------------------
  async getDocuments(filters?: {
    search?: string;
    category?: string;
    unitName?: string;
    status?: string;
  }): Promise<any[]> {
    const query = new URLSearchParams();
    if (filters?.search) query.append('search', filters.search);
    if (filters?.category && filters.category !== 'ALL') query.append('category', filters.category);
    if (filters?.unitName && filters.unitName !== 'ALL') query.append('unitName', filters.unitName);
    if (filters?.status && filters.status !== 'ALL') query.append('status', filters.status);
    const qs = query.toString();
    const cacheKey = `documents:${qs || 'all'}`;

    return getCachedOrFetch(cacheKey, async () => {
      try {
        const res = await authFetch(`/api/v1/files/documents${qs ? `?${qs}` : ''}`);
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async createDocument(formData: FormData): Promise<{ success: boolean; data?: any; error?: string }> {
    return sendDocumentWithJsonFallback(
      '/api/v1/files/documents',
      formData,
      'خطا در ثبت و بارگذاری مستند'
    );
  },

  async updateDocument(
    documentId: string,
    payload: {
      title?: string;
      documentNumber?: string;
      category?: string;
      unitId?: number | string | null;
      unitName?: string;
      issueDate?: string;
      expiryDate?: string;
      description?: string;
      tabMetadata?: Record<string, any>;
      status?: 'ACTIVE' | 'ARCHIVED';
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      invalidateCacheKeys('documents');
      const res = await authFetch(`/api/v1/files/documents/${encodeURIComponent(documentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const parsed = await parseJsonSafely<any>(res);
      invalidateCacheKeys('documents');
      if (!parsed.ok || !parsed.data?.success) {
        const errMsg = parsed.data?.error?.message || parsed.data?.message || parsed.error || 'خطا در بروزرسانی اطلاعات مستند';
        return { success: false, error: errMsg };
      }
      return { success: true, data: parsed.data.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async replaceDocumentFile(
    documentId: string,
    formData: FormData
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    return sendDocumentWithJsonFallback(
      `/api/v1/files/documents/${encodeURIComponent(documentId)}/replace`,
      formData,
      'خطا در جایگزینی فایل و ثبت نسخه جدید'
    );
  },

  async addDocumentAttachment(
    documentId: string,
    formData: FormData
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    return sendDocumentWithJsonFallback(
      `/api/v1/files/documents/${encodeURIComponent(documentId)}/attachments`,
      formData,
      'خطا در بارگذاری فایل پیوست مستند'
    );
  },

  async deleteDocumentAttachment(
    documentId: string,
    fileId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      invalidateCacheKeys('documents');
      const res = await authFetch(
        `/api/v1/files/documents/${encodeURIComponent(documentId)}/attachments/${encodeURIComponent(fileId)}`,
        { method: 'DELETE' }
      );
      const parsed = await parseJsonSafely<any>(res);
      invalidateCacheKeys('documents');
      if (!parsed.ok || !parsed.data?.success) {
        const errMsg =
          parsed.data?.error?.message ||
          parsed.data?.message ||
          parsed.error ||
          'خطا در حذف فایل پیوست';
        return { success: false, error: errMsg };
      }
      return { success: true, data: parsed.data.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      invalidateCacheKeys('documents');
      const res = await authFetch(`/api/v1/files/documents/${encodeURIComponent(documentId)}`, {
        method: 'DELETE',
      });
      const parsed = await parseJsonSafely<any>(res);
      invalidateCacheKeys('documents');
      if (!parsed.ok || !parsed.data?.success) {
        const errMsg = parsed.data?.error?.message || parsed.data?.message || parsed.error || 'خطا در حذف مستند';
        return { success: false, error: errMsg };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async fetchFileBlobUrl(fileId: string, mimeType?: string): Promise<string | null> {
    try {
      const res = await authFetch(`/api/v1/files/${encodeURIComponent(fileId)}/preview`);
      if (!res.ok) return null;
      const rawBlob = await res.blob();
      const typedBlob = mimeType ? new Blob([rawBlob], { type: mimeType }) : rawBlob;
      return URL.createObjectURL(typedBlob);
    } catch {
      return null;
    }
  },

  async fetchPdfPageImageUrl(fileId: string, page = 1): Promise<{ url: string; totalPages: number } | null> {
    try {
      const res = await authFetch(`/api/v1/files/${encodeURIComponent(fileId)}/render-page?page=${page}&v=3`);
      if (!res.ok) return null;
      const totalPagesHeader = res.headers.get('X-Total-Pages');
      const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : 1;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return { url, totalPages };
    } catch {
      return null;
    }
  },

  async downloadFileById(fileId: string, fileName: string): Promise<boolean> {
    try {
      const res = await authFetch(`/api/v1/files/${encodeURIComponent(fileId)}/download`);
      if (!res.ok) return false;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Enterprise Backup, SHA-256 Verification, Sandbox Test Restore & Real Restore
  // --------------------------------------------------------------------------
  async getBackupOverview(): Promise<any | null> {
    try {
      const res = await authFetch('/api/v1/backup/overview');
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch {
      return null;
    }
  },

  async createServerBackup(options?: {
    tag?: 'manual' | 'scheduled' | 'pre_restore_safety' | 'pre_update';
    isSelective?: boolean;
    selectedModules?: Record<string, boolean>;
    encrypt?: boolean;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch('/api/v1/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در تهیه نسخه پشتیبان' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async exportSqlDump(options?: {
    isSelective?: boolean;
    selectedModules?: Record<string, boolean>;
  }): Promise<{ success: boolean; data?: { sql: string; totalRows: number; tablesExported: number; sha256: string }; error?: string }> {
    try {
      const res = await authFetch('/api/v1/backup/export-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در تولید خروجی SQL' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async downloadServerBackup(backupId: string, format: 'gz' | 'json' = 'gz'): Promise<boolean> {
    try {
      const res = await authFetch(
        `/api/v1/backup/${encodeURIComponent(backupId)}/download?format=${format}`
      );
      if (!res.ok) return false;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'json' ? `${backupId}.hsebackup.json` : `${backupId}.hsebackup.json.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch {
      return false;
    }
  },

  async verifyServerBackup(backupId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch(`/api/v1/backup/${encodeURIComponent(backupId)}/verify`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در اعتبارسنجی نسخه پشتیبان' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async testRestoreServerBackup(backupId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch(`/api/v1/backup/${encodeURIComponent(backupId)}/test-restore`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در اجرای بازیابی آزمایشی ایزوله' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async executeServerRestore(
    backupId: string,
    mode: 'clean' | 'merge',
    confirmCode: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      invalidateCacheKeys('sync:full');
      const res = await authFetch(`/api/v1/backup/${encodeURIComponent(backupId)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, confirmCode }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در اجرای بازیابی' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async inspectUploadedBackup(payload: {
    fileBase64?: string;
    rawText?: string;
    jsonObject?: any;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch('/api/v1/backup/upload-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'فایل پشتیبان نامعتبر است' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async restoreUploadedBackup(payload: {
    fileBase64?: string;
    rawText?: string;
    jsonObject?: any;
    mode: 'clean' | 'merge';
    confirmCode: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      invalidateCacheKeys('sync:full');
      const res = await authFetch('/api/v1/backup/upload-restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در بازیابی از فایل بارگذاری‌شده' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async deleteServerBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await authFetch(`/api/v1/backup/${encodeURIComponent(backupId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در حذف نسخه پشتیبان' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async saveBackupSchedule(config: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch('/api/v1/backup/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در ذخیره زمان‌بندی پشتیبان‌گیری' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  // --------------------------------------------------------------------------
  // Organizational Structure Module Integrated Backup, Restore & Rollback
  // --------------------------------------------------------------------------
  async getOrgBackupOverview(): Promise<any | null> {
    try {
      const res = await authFetch('/api/v1/organization/backup/overview');
      if (!res.ok) return null;
      const json = await res.json();
      return json.data || null;
    } catch {
      return null;
    }
  },

  async createOrgBackup(
    selectedSubTabs?: Array<'org_hierarchy' | 'units_jobs' | 'incident_types' | 'ppe_equipment'>
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch('/api/v1/organization/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedSubTabs }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در تهیه نسخه پشتیبان ساختار سازمانی' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async getOrgSnapshotById(backupId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch(
        `/api/v1/organization/backup/snapshot/${encodeURIComponent(backupId)}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'نسخه پشتیبان یافت نشد' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async inspectOrgBackup(payload: {
    backupId?: string;
    backupPackage?: any;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await authFetch('/api/v1/organization/backup/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'فایل پشتیبان نامعتبر است', data: json.data };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async restoreOrgBackup(payload: {
    backupId?: string;
    backupPackage?: any;
    selectedSubTabs: Array<'org_hierarchy' | 'units_jobs' | 'incident_types' | 'ppe_equipment'>;
    mode: 'safe_merge' | 'full_replace';
    confirmed: boolean;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      invalidateCacheKeys('settings', 'org_nodes', 'sync:full');
      const res = await authFetch('/api/v1/organization/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      invalidateCacheKeys('settings', 'org_nodes', 'sync:full');
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در بازیابی اطلاعات ساختار سازمانی' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

  async rollbackOrgBackup(backupId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      invalidateCacheKeys('settings', 'org_nodes', 'sync:full');
      const res = await authFetch(
        `/api/v1/organization/backup/rollback/${encodeURIComponent(backupId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      const json = await res.json();
      invalidateCacheKeys('settings', 'org_nodes', 'sync:full');
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'خطا در بازگردانی وضعیت قبلی' };
      }
      return { success: true, data: json.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
  },

};

export const apiDatabaseClient = apiDb;
export default apiDb;

