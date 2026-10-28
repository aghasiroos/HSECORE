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
  error?: string;
}

// In-flight request deduplicator and short-lived TTL cache (3.5 seconds)
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


// In-memory authentication token with sessionStorage backup for tab persistence across page reloads
let inMemoryAuthToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryAuthToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem('hse_auth_token', token);
      } else {
        sessionStorage.removeItem('hse_auth_token');
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
    const raw = sessionStorage.getItem('hse_current_user') || localStorage.getItem('hse_current_user');
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
      try {
        const res = await authFetch('/api/v1/personnel');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async getPersonnelById(identifier: string): Promise<any | null> {
    return getCachedOrFetch(`personnel:${identifier}`, async () => {
      try {
        const res = await authFetch(`/api/v1/personnel/${encodeURIComponent(identifier)}`);
        if (!res.ok) return null;
        const json: ApiResponse = await res.json();
        return json.data || null;
      } catch {
        return null;
      }
    });
  },

  async savePersonnel(data: any): Promise<any> {
    try {
      invalidateCacheKeys('personnel', 'sync:full');
      const res = await authFetch('/api/v1/personnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch (e) {
      console.error('Failed to save personnel:', e);
      return null;
    }
  },

  async batchSavePersonnel(records: any[]): Promise<boolean> {
    if (!Array.isArray(records) || records.length === 0) {
      return true;
    }
    try {
      invalidateCacheKeys('personnel', 'sync:full');
      const res = await authFetch('/api/v1/personnel/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deletePersonnel(id: string, deleteUser = false): Promise<boolean> {
    try {
      invalidateCacheKeys('personnel', 'users', 'sync:full');
      let res = await authFetch(`/api/v1/personnel/${encodeURIComponent(id)}?deleteUser=${deleteUser}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status === 404) {
        res = await authFetch(`/api/database/personnel/${encodeURIComponent(id)}?deleteUser=${deleteUser}`, {
          method: 'DELETE',
        });
      }
      if (res.ok) {
        invalidateCacheKeys('personnel', 'users', 'sync:full');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete personnel:', e);
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Occupational Health & Medical Exams
  // --------------------------------------------------------------------------
  async getMedicalExams(year?: number): Promise<any[]> {
    return getCachedOrFetch(`medical-exams:${year || 'all'}`, async () => {
      try {
        const url = year ? `/api/v1/medical-exams?year=${year}` : '/api/v1/medical-exams';
        const res = await authFetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async getMedicalExamDetails(examId: number): Promise<any | null> {
    return getCachedOrFetch(`medical-exam-details:${examId}`, async () => {
      try {
        const res = await authFetch(`/api/v1/medical-exams/${examId}`);
        if (!res.ok) return null;
        const json: ApiResponse = await res.json();
        return json.data || null;
      } catch {
        return null;
      }
    });
  },

  async getPersonnelMedicalHistory(identifier: string): Promise<{ personnel: any; history: any[] }> {
    return getCachedOrFetch(`medical-history:${identifier}`, async () => {
      try {
        const res = await authFetch(`/api/v1/medical-exams/history/${encodeURIComponent(identifier)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        return json.data || { personnel: null, history: [] };
      } catch {
        return { personnel: null, history: [] };
      }
    });
  },

  async saveMedicalExam(examPayload: any): Promise<any> {
    try {
      invalidateCacheKeys('medical-exam', 'medical-history', 'sync:full');
      const res = await authFetch('/api/v1/medical-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examPayload),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch (e) {
      console.error('Failed to save medical exam to database:', e);
      return null;
    }
  },

  async batchImportMedicalExams(records: any[]): Promise<boolean> {
    try {
      invalidateCacheKeys('medical-exam', 'medical-history', 'sync:full');
      const res = await authFetch('/api/v1/medical-exams/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Work Permits (PTW)
  // --------------------------------------------------------------------------
  async getWorkPermits(status?: string): Promise<any[]> {
    return getCachedOrFetch(`permits:${status || 'all'}`, async () => {
      try {
        const url = status ? `/api/v1/work-permits?status=${encodeURIComponent(status)}` : '/api/v1/work-permits';
        const res = await authFetch(url);
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async saveWorkPermit(permit: any): Promise<any> {
    try {
      invalidateCacheKeys('permits', 'sync:full');
      const res = await authFetch('/api/v1/work-permits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permit),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  async deleteWorkPermit(idOrNumber: string | number): Promise<boolean> {
    try {
      invalidateCacheKeys('permits', 'sync:full');
      const encoded = encodeURIComponent(String(idOrNumber));
      const res = await authFetch(`/api/v1/work-permits/${encoded}`, {
        method: 'DELETE',
      });
      let ok = res.ok;
      if (!ok) {
        const res2 = await authFetch(`/api/v1/permits/${encoded}`, {
          method: 'DELETE',
        });
        ok = res2.ok;
      }
      invalidateCacheKeys('permits', 'sync:full');
      return ok;
    } catch (e) {
      console.error('Failed to delete work permit:', e);
      invalidateCacheKeys('permits', 'sync:full');
      return false;
    }
  },

  async signWorkPermit(permitId: number, signature: any): Promise<any> {
    try {
      invalidateCacheKeys('permits', 'sync:full');
      const res = await authFetch(`/api/v1/work-permits/${permitId}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signature),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // TRIR & Incidents
  // --------------------------------------------------------------------------
  async getTrirRecords(): Promise<any[]> {
    return getCachedOrFetch('trir:list', async () => {
      const json = await safeFetchJson<ApiResponse>('/api/v1/trir');
      return Array.isArray(json?.data) ? json.data : [];
    });
  },

  async saveTrirRecord(data: any): Promise<any> {
    try {
      invalidateCacheKeys('trir', 'sync:full');
      const json = await safeFetchJson<ApiResponse>('/api/v1/trir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return json?.data || data;
    } catch {
      return data;
    }
  },

  async saveTrirBatch(records: any[]): Promise<any[]> {
    if (!Array.isArray(records)) return [];
    try {
      invalidateCacheKeys('trir', 'sync:full');
      const json = await safeFetchJson<ApiResponse>('/api/v1/trir/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records),
      });
      return Array.isArray(json?.data) ? json.data : records;
    } catch {
      return records;
    }
  },

  async deleteTrirRecord(id: string | number, year?: number, month?: string): Promise<boolean> {
    try {
      invalidateCacheKeys('trir', 'sync:full');
      // Purge any legacy browser storage keys
      try {
        localStorage.removeItem('hse_trir_records_backup');
        localStorage.removeItem('hse_trir_records_v3');
        localStorage.removeItem('trir_records');
      } catch (_) {}

      let url = `/api/v1/trir/${encodeURIComponent(String(id))}`;
      if (year && month) {
        url += `?year=${encodeURIComponent(String(year))}&month=${encodeURIComponent(String(month))}`;
      }
      const res = await authFetch(url, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async clearAllTrirRecords(): Promise<boolean> {
    try {
      invalidateCacheKeys('trir', 'sync:full');
      try {
        localStorage.removeItem('hse_trir_records_backup');
        localStorage.removeItem('hse_trir_records_v3');
        localStorage.removeItem('trir_records');
      } catch (_) {}

      const res = await authFetch('/api/v1/trir', {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async deduplicateTrirRecords(): Promise<number> {
    try {
      invalidateCacheKeys('trir', 'sync:full');
      const res = await authFetch('/api/v1/trir/deduplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json: ApiResponse = await res.json();
      return json.removedCount || 0;
    } catch {
      return 0;
    }
  },

  async getIncidents(): Promise<any[]> {
    return getCachedOrFetch('incidents:list', async () => {
      try {
        const res = await authFetch('/api/v1/incidents');
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async saveIncident(incident: any): Promise<any> {
    try {
      invalidateCacheKeys('incidents', 'sync:full');
      const res = await authFetch('/api/v1/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incident),
      });
      invalidateCacheKeys('incidents', 'sync:full');
      const json: ApiResponse = await res.json();
      return json.data;
    } catch {
      invalidateCacheKeys('incidents', 'sync:full');
      return null;
    }
  },

  async deleteIncident(id: string | number): Promise<boolean> {
    try {
      invalidateCacheKeys('incidents', 'sync:full');
      try {
        const saved = localStorage.getItem('hse_safety_incidents');
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const filtered = list.filter((i: any) => String(i.id) !== String(id) && String(i.reportNumber) !== String(id) && String(i.incidentNumber) !== String(id));
            localStorage.setItem('hse_safety_incidents', JSON.stringify(filtered));
          }
        }
      } catch (_) {}
      const res = await authFetch(`/api/v1/incidents/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      });
      invalidateCacheKeys('incidents', 'sync:full');
      return res.ok;
    } catch {
      invalidateCacheKeys('incidents', 'sync:full');
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Safety Warnings
  // --------------------------------------------------------------------------
  async getSafetyWarnings(): Promise<any[]> {
    return getCachedOrFetch('warnings:list', async () => {
      try {
        const res = await authFetch('/api/v1/warnings');
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async saveSafetyWarning(warning: any): Promise<any> {
    try {
      invalidateCacheKeys('warnings', 'sync:full');
      const res = await authFetch('/api/v1/warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warning),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  async saveSafetyWarningsBatch(warnings: any[]): Promise<any[]> {
    try {
      invalidateCacheKeys('warnings', 'sync:full');
      const res = await authFetch('/api/v1/warnings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warnings),
      });
      const json: ApiResponse = await res.json();
      return json.data || [];
    } catch {
      return [];
    }
  },

  async deleteSafetyWarning(id: string | number): Promise<boolean> {
    try {
      invalidateCacheKeys('warnings', 'warnings:list', 'sync:full');
      try {
        const saved = localStorage.getItem('warning_records');
        if (saved) {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const filtered = list.filter((w: any) => String(w.id) !== String(id) && String(w.number) !== String(id));
            localStorage.setItem('warning_records', JSON.stringify(filtered));
          }
        }
      } catch (_) {}
      const res = await authFetch(`/api/v1/warnings/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      });
      invalidateCacheKeys('warnings', 'warnings:list', 'sync:full');
      const json: ApiResponse = await res.json();
      return json.success || false;
    } catch {
      invalidateCacheKeys('warnings', 'warnings:list', 'sync:full');
      return false;
    }
  },

  async deduplicateSafetyWarnings(): Promise<number> {
    try {
      invalidateCacheKeys('warnings', 'sync:full');
      const res = await authFetch('/api/v1/warnings/deduplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json: ApiResponse = await res.json();
      return json.removedCount || 0;
    } catch {
      return 0;
    }
  },

  async clearAllSafetyWarnings(): Promise<boolean> {
    try {
      invalidateCacheKeys('warnings', 'sync:full');
      const res = await authFetch('/api/v1/warnings', {
        method: 'DELETE',
      });
      const json: ApiResponse = await res.json();
      return json.success || false;
    } catch {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Fire Equipment & 5S Audits
  // --------------------------------------------------------------------------
  async getFireEquipment(): Promise<any[]> {
    return getCachedOrFetch('fire-equipment:list', async () => {
      try {
        const res = await authFetch('/api/v1/fire-equipment');
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async saveFireEquipment(item: any): Promise<any> {
    try {
      invalidateCacheKeys('fire-equipment', 'sync:full');
      const res = await authFetch('/api/v1/fire-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  async deleteFireEquipment(id: string | number): Promise<boolean> {
    try {
      invalidateCacheKeys('fire-equipment', 'sync:full');
      const res = await authFetch(`/api/v1/fire-equipment/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      });
      const json: ApiResponse = await res.json();
      return json.success;
    } catch {
      return false;
    }
  },

  async getFiveSAudits(): Promise<any[]> {
    return getCachedOrFetch('five-s:list', async () => {
      try {
        const res = await authFetch('/api/v1/five-s');
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async saveFiveSAudit(audit: any): Promise<any> {
    try {
      invalidateCacheKeys('five-s', 'sync:full');
      const res = await authFetch('/api/v1/five-s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(audit),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // Central Sync & Full Database State
  // --------------------------------------------------------------------------
  async getFullSyncSnapshot(): Promise<{ timestamp: string; status: string; data: Record<string, any> } | null> {
    return getCachedOrFetch('sync:full', async () => {
      try {
        const res = await authFetch('/api/v1/sync/full');
        const parsed = await parseJsonSafely<any>(res);
        if (!parsed.ok || !parsed.data) return null;
        return parsed.data.success ? parsed.data : null;
      } catch {
        return null;
      }
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

  async pushEntity(entityType: string, data: any): Promise<any> {
    try {
      invalidateCacheKeys(entityType, `${entityType}s`, 'sync:full');
      const res = await authFetch('/api/v1/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, data }),
      });
      const parsed = await parseJsonSafely<any>(res);
      return parsed.data?.data || null;
    } catch (e) {
      console.error(`Failed to push entity ${entityType} to central DB:`, e);
      return null;
    }
  },

  // --------------------------------------------------------------------------
  // Users Management
  // --------------------------------------------------------------------------
  async getUsers(): Promise<any[]> {
    return getCachedOrFetch('users:list', async () => {
      try {
        const res = await authFetch('/api/v1/users');
        const parsed = await parseJsonSafely<ApiResponse>(res);
        if (!parsed.ok || !parsed.data) return [];
        return parsed.data.data || [];
      } catch {
        return [];
      }
    });
  },

  async saveUser(user: any): Promise<any> {
    try {
      invalidateCacheKeys('users', 'sync:full');
      const res = await authFetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      const parsed = await parseJsonSafely<ApiResponse>(res);
      return parsed.data?.data || null;
    } catch (e) {
      console.error('Failed to save user in central DB:', e);
      return null;
    }
  },

  async deleteUser(uid: string): Promise<boolean> {
    try {
      invalidateCacheKeys('users', 'sync:full');
      const res = await authFetch(`/api/v1/users/${encodeURIComponent(uid)}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getCurrentUserFromServer(): Promise<any | null> {
    try {
      const res = await authFetch('/api/v1/auth/me');
      const parsed = await parseJsonSafely<ApiResponse>(res);
      return parsed.data?.data || null;
    } catch {
      return null;
    }
  },

  async getUserPersonnelAssignments(uid: string): Promise<any> {
    try {
      const res = await authFetch(`/api/v1/users/${encodeURIComponent(uid)}/personnel-assignments`);
      const parsed = await parseJsonSafely<ApiResponse>(res);
      return parsed.data?.data || null;
    } catch (e) {
      console.error('Failed to fetch user personnel assignments:', e);
      return null;
    }
  },

  async updateUserPersonnelAssignments(
    uid: string,
    payload: { scope: 'ALL' | 'ASSIGNED'; personnelIds: Array<string | number> }
  ): Promise<any> {
    try {
      invalidateCacheKeys('users', 'personnel', 'sync:full');
      const res = await authFetch(`/api/v1/users/${encodeURIComponent(uid)}/personnel-assignments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const parsed = await parseJsonSafely<ApiResponse>(res);
      if (!res.ok || !parsed.data?.success) {
        const errMsg =
          (parsed.data as any)?.error?.message ||
          (parsed.data as any)?.error ||
          (parsed.data as any)?.message ||
          'خطا در بروزرسانی اشخاص مرتبط کاربر';
        throw new Error(errMsg);
      }
      invalidateCacheKeys('users', 'personnel', 'sync:full');
      return parsed.data.data;
    } catch (e) {
      console.error('Failed to update user personnel assignments:', e);
      throw e;
    }
  },

  // --------------------------------------------------------------------------
  // Notifications
  // --------------------------------------------------------------------------
  async getNotifications(params?: { category?: string; priority?: string; sourceModule?: string; unreadOnly?: boolean }): Promise<any[]> {
    return getCachedOrFetch('notifications:list', async () => {
      try {
        let url = '/api/v1/notifications';
        if (params) {
          const q = new URLSearchParams();
          if (params.category) q.set('category', params.category);
          if (params.priority) q.set('priority', params.priority);
          if (params.sourceModule) q.set('sourceModule', params.sourceModule);
          if (params.unreadOnly) q.set('unreadOnly', 'true');
          url += `?${q.toString()}`;
        }
        const res = await authFetch(url);
        if (!res.ok) return [];
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    }, 2000);
  },

  async saveNotification(notif: any): Promise<any> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await authFetch('/api/v1/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notif),
      });
      const json: ApiResponse = await res.json();
      invalidateCacheKeys('notifications', 'sync:full');
      return json.data;
    } catch (e) {
      console.error('Failed to persist notification:', e);
      return null;
    }
  },

  async markNotificationRead(id: string): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await authFetch(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
      });
      invalidateCacheKeys('notifications', 'sync:full');
      return res.ok;
    } catch (e) {
      console.error('Failed to mark notification read:', e);
      return false;
    }
  },

  async markAllNotificationsRead(): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await authFetch('/api/v1/notifications/read', {
        method: 'POST',
      });
      invalidateCacheKeys('notifications', 'sync:full');
      return res.ok;
    } catch (e) {
      console.error('Failed to mark all notifications read:', e);
      return false;
    }
  },

  async acknowledgeNotification(id: string, note?: string): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await authFetch(`/api/v1/notifications/${encodeURIComponent(id)}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      invalidateCacheKeys('notifications', 'sync:full');
      return res.ok;
    } catch (e) {
      console.error('Failed to acknowledge notification:', e);
      return false;
    }
  },

  async getNotificationPreferences(): Promise<any> {
    return getCachedOrFetch('notifications:preferences', async () => {
      try {
        const res = await authFetch('/api/v1/notifications/preferences');
        if (!res.ok) return null;
        const json: ApiResponse = await res.json();
        return json.data;
      } catch {
        return null;
      }
    }, 10000);
  },

  async saveNotificationPreferences(prefs: any): Promise<any> {
    try {
      invalidateCacheKeys('notifications:preferences');
      const res = await authFetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      const json: ApiResponse = await res.json();
      invalidateCacheKeys('notifications:preferences');
      return json.data;
    } catch (e) {
      console.error('Failed to save notification preferences:', e);
      return null;
    }
  },

  async uploadCustomSiren(
    audioData: string,
    fileName?: string,
    fileSize?: number
  ): Promise<{ success: boolean; audioUrl: string } | null> {
    try {
      invalidateCacheKeys('notifications:preferences', 'sync:full');
      const res = await authFetch('/api/v1/notifications/custom-siren', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioData, fileName, fileSize }),
      });
      if (!res.ok) return null;
      const json: ApiResponse = await res.json();
      invalidateCacheKeys('notifications:preferences', 'sync:full');
      return json.data || json;
    } catch (e) {
      console.error('Failed to upload custom siren:', e);
      return null;
    }
  },

  async deleteCustomSiren(): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications:preferences', 'sync:full');
      const res = await authFetch('/api/v1/notifications/custom-siren', { method: 'DELETE' });
      invalidateCacheKeys('notifications:preferences', 'sync:full');
      return res.ok;
    } catch {
      return false;
    }
  },

  async getPublicActiveEmergencyAlerts(): Promise<any[]> {
    try {
      const res = await fetch('/api/v1/notifications/public/active');
      if (!res.ok) return [];
      const json: ApiResponse = await res.json();
      return json.data || [];
    } catch (e) {
      console.warn('Failed to fetch public emergency alerts:', e);
      return [];
    }
  },

  async acknowledgePublicEmergency(notifId: string, clientSessionId?: string, note?: string): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await fetch('/api/v1/notifications/public/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifId, clientSessionId, note }),
      });
      invalidateCacheKeys('notifications', 'sync:full');
      return res.ok;
    } catch (e) {
      console.error('Failed to acknowledge public emergency:', e);
      return false;
    }
  },

  async triggerTestAlert(payload?: any): Promise<any> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await authFetch('/api/v1/notifications/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
      });
      const json: ApiResponse = await res.json();
      invalidateCacheKeys('notifications', 'sync:full');
      return json.data;
    } catch (e) {
      console.error('Failed to trigger test alert:', e);
      return null;
    }
  },

  async deleteNotification(id: string): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await authFetch(`/api/v1/notifications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      invalidateCacheKeys('notifications', 'sync:full');
      return res.ok;
    } catch (e) {
      console.error('Failed to delete notification:', e);
      invalidateCacheKeys('notifications', 'sync:full');
      return false;
    }
  },

  async clearAllNotifications(): Promise<boolean> {
    try {
      invalidateCacheKeys('notifications', 'sync:full');
      const res = await authFetch('/api/v1/notifications', {
        method: 'DELETE',
      });
      invalidateCacheKeys('notifications', 'sync:full');
      return res.ok;
    } catch (e) {
      console.error('Failed to clear notifications:', e);
      invalidateCacheKeys('notifications', 'sync:full');
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // System Settings & Aliases
  // --------------------------------------------------------------------------
  async getSettings(): Promise<Record<string, any>> {
    return getCachedOrFetch('settings:all', async () => {
      try {
        const res = await authFetch('/api/v1/settings');
        if (!res.ok) return {};
        const json: ApiResponse = await res.json();
        return json.data || {};
      } catch {
        return {};
      }
    });
  },

  async getSystemSettings(): Promise<Record<string, any>> {
    return this.getSettings();
  },

  async getSetting(key: string): Promise<any> {
    return getCachedOrFetch(`settings:${key}`, async () => {
      try {
        const res = await authFetch(`/api/v1/settings/${encodeURIComponent(key)}`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.value !== undefined ? json.value : json.data;
      } catch {
        return null;
      }
    });
  },

  async saveSetting(key: string, value: any, description?: string): Promise<boolean> {
    try {
      invalidateCacheKeys(`settings:${key}`, 'settings:all', 'sync:full');
      const res = await authFetch(`/api/v1/settings/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, description }),
      });
      invalidateCacheKeys(`settings:${key}`, 'settings:all', 'sync:full');
      return res.ok;
    } catch {
      return false;
    }
  },

  async saveSystemSetting(key: string, value: any, description?: string): Promise<boolean> {
    return this.saveSetting(key, value, description);
  },

  // --------------------------------------------------------------------------
  // Document Referrals & Digital Signatures (Database Authoritative)
  // --------------------------------------------------------------------------
  async getReferrals(): Promise<any[]> {
    let userScope = 'default';
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('hse_current_user') || localStorage.getItem('hse_current_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          userScope = String(parsed?.id || parsed?.username || 'default');
        }
      } catch {}
    }
    return getCachedOrFetch(`referrals:list:${userScope}`, async () => {
      try {
        const res = await authFetch('/api/v1/referrals');
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    }, 3000);
  },

  async saveReferrals(referrals: any[] | any): Promise<boolean> {
    try {
      invalidateCacheKeys('referrals', 'sync:full');
      const res = await authFetch('/api/v1/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(referrals),
      });
      invalidateCacheKeys('referrals', 'sync:full');
      return res.ok;
    } catch {
      return false;
    }
  },

  async executeReferralAction(referralId: string, actionData: any): Promise<any> {
    try {
      invalidateCacheKeys('referrals', 'sync:full');
      const res = await authFetch(`/api/v1/referrals/${encodeURIComponent(referralId)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(actionData),
      });
      invalidateCacheKeys('referrals', 'sync:full');
      const json = await res.json().catch(() => null);
      if (res.ok) {
        return json;
      }
      return json || { success: false, message: 'خطا در اجرای عملیات گردش کار' };
    } catch {
      return null;
    }
  },

  async deleteSetting(key: string): Promise<boolean> {
    try {
      invalidateCacheKeys(`settings:${key}`, 'settings:all', 'sync:full');
      const res = await authFetch(`/api/v1/settings/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      invalidateCacheKeys(`settings:${key}`, 'settings:all', 'sync:full');
      return res.ok;
    } catch {
      return false;
    }
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
    const records = await this.getSetting('hse_ptw_audit_records_v2');
    return Array.isArray(records) ? records : [];
  },

  async savePtwAuditRecords(records: any[]): Promise<boolean> {
    return this.saveSetting('hse_ptw_audit_records_v2', records);
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
      try {
        const res = await authFetch('/api/v1/organization/nodes');
        if (!res.ok) return [];
        const json: ApiResponse = await res.json();
        return Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async getOrganizations(): Promise<any[]> {
    return this.getOrgNodes();
  },

  async saveOrgNodes(nodes: any[]): Promise<boolean> {
    if (!getAuthToken()) return false;
    try {
      invalidateCacheKeys('organization:nodes');
      const res = await authFetch('/api/v1/organization/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodes),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // --------------------------------------------------------------------------
  // Environmental & Safety Submodule Persistence
  // --------------------------------------------------------------------------
  async getEnvironmentalLogs(): Promise<any[]> {
    const logs = await this.getSetting('environmental_logs');
    return Array.isArray(logs) ? logs : [];
  },

  async createEnvironmentalLog(data: any): Promise<boolean> {
    const logs = await this.getEnvironmentalLogs();
    logs.unshift(data);
    return this.saveSetting('environmental_logs', logs);
  },

  async updateEnvironmentalLog(id: string, data: any): Promise<boolean> {
    const logs = await this.getEnvironmentalLogs();
    const idx = logs.findIndex((l: any) => l.id === id);
    if (idx !== -1) {
      logs[idx] = { ...logs[idx], ...data };
      return this.saveSetting('environmental_logs', logs);
    }
    return false;
  },

  async deleteEnvironmentalLog(id: string): Promise<boolean> {
    const logs = await this.getEnvironmentalLogs();
    const filtered = logs.filter((l: any) => l.id !== id);
    return this.saveSetting('environmental_logs', filtered);
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
      try {
        const res = await authFetch('/api/v1/risk-assessments');
        if (!res.ok) return [];
        const json: ApiResponse = await res.json();
        return json.data || [];
      } catch {
        return [];
      }
    });
  },

  async saveRiskAssessment(data: any): Promise<any> {
    try {
      invalidateCacheKeys('risk-assessments', 'sync:full');
      const res = await authFetch('/api/v1/risk-assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json: ApiResponse = await res.json();
      return json.data;
    } catch {
      return null;
    }
  },

  async deleteRiskAssessment(id: string | number): Promise<boolean> {
    try {
      invalidateCacheKeys('risk-assessments', 'sync:full');
      const res = await authFetch(`/api/v1/risk-assessments/${id}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch {
      return false;
    }
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
      // Purge any legacy or user-scoped keys from browser storage to ensure zero residual operational data
      try {
        sessionStorage.removeItem('hse_auth_token');
        sessionStorage.removeItem('hse_current_user');
        sessionStorage.removeItem('hse_active_tab');
        localStorage.removeItem('hse_auth_token');
        localStorage.removeItem('hse_current_user');
        localStorage.removeItem('hse_remember_user');
        localStorage.removeItem('hse_users');
        localStorage.removeItem('hse_active_tab');
        localStorage.removeItem('hse_document_referrals_v1');
        localStorage.removeItem('hse_integration_config');
        localStorage.removeItem('hse_system_api_tokens');
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
      try {
        const res = await authFetch(`/api/v1/non-conformances${qs ? `?${qs}` : ''}`);
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.data) ? json.data : [];
      } catch {
        return [];
      }
    });
  },

  async getNonConformanceById(id: string | number): Promise<any | null> {
    return getCachedOrFetch(`non-conformance:${id}`, async () => {
      try {
        const res = await authFetch(`/api/v1/non-conformances/${encodeURIComponent(String(id))}`);
        if (!res.ok) return null;
        const json = await res.json();
        return json.data || null;
      } catch {
        return null;
      }
    });
  },

  async createNonConformance(data: any): Promise<any> {
    try {
      invalidateCacheKeys('non-conformances', 'sync:full');
      const res = await authFetch('/api/v1/non-conformances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      invalidateCacheKeys('non-conformances', 'sync:full');
      return json.data || null;
    } catch {
      return null;
    }
  },

  async updateNonConformance(id: string | number, data: any): Promise<any> {
    try {
      invalidateCacheKeys('non-conformances', 'sync:full');
      const res = await authFetch(`/api/v1/non-conformances/${encodeURIComponent(String(id))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      invalidateCacheKeys('non-conformances', 'sync:full');
      return json.data || null;
    } catch {
      return null;
    }
  },

  async deleteNonConformance(id: string | number): Promise<boolean> {
    try {
      invalidateCacheKeys('non-conformances', 'sync:full');
      const res = await authFetch(`/api/v1/non-conformances/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
      });
      invalidateCacheKeys('non-conformances', 'sync:full');
      return res.ok;
    } catch {
      return false;
    }
  },

  async deleteBatchNonConformances(ids: Array<string | number>): Promise<boolean> {
    try {
      invalidateCacheKeys('non-conformances', 'sync:full');
      const res = await authFetch('/api/v1/non-conformances/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      invalidateCacheKeys('non-conformances', 'sync:full');
      return res.ok;
    } catch {
      return false;
    }
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
    try {
      invalidateCacheKeys('documents');
      const res = await authFetch('/api/v1/files/documents', {
        method: 'POST',
        body: formData,
      });
      const parsed = await parseJsonSafely<any>(res);
      invalidateCacheKeys('documents');
      if (!parsed.ok || !parsed.data?.success) {
        const errMsg = parsed.data?.error?.message || parsed.data?.message || parsed.error || 'خطا در ثبت و بارگذاری مستند';
        return { success: false, error: errMsg };
      }
      return { success: true, data: parsed.data.data };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطا در ارتباط با سرور' };
    }
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
    try {
      invalidateCacheKeys('documents');
      const res = await authFetch(`/api/v1/files/documents/${encodeURIComponent(documentId)}/replace`, {
        method: 'POST',
        body: formData,
      });
      const parsed = await parseJsonSafely<any>(res);
      invalidateCacheKeys('documents');
      if (!parsed.ok || !parsed.data?.success) {
        const errMsg = parsed.data?.error?.message || parsed.data?.message || parsed.error || 'خطا در جایگزینی فایل و ثبت نسخه جدید';
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
      const res = await authFetch(`/api/v1/files/${encodeURIComponent(fileId)}/render-page?page=${page}`);
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

};

export const apiDatabaseClient = apiDb;
export default apiDb;

