import { authFetch, parseJsonSafely } from '../../../services/apiDatabaseClient';
import type {
  BenchmarkSuiteReport,
  CraneLoadChartRow,
  FullPlanEvaluationResult,
  LiftingCrane,
  LiftingIntegrationContext,
  LiftingPlanRecord,
  LiftingStageGateRow,
  LiftingStandardConfig,
  RiggingEquipmentItem,
} from '../types';

const BASE = '/api/v1/lifting';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  const parsed = await parseJsonSafely<{ success?: boolean; data?: T; error?: string; blockers?: string[]; revisionBumped?: boolean }>(res);
  if (!parsed.ok || parsed.data?.success === false) {
    const errMsg = parsed.data?.error || parsed.error || 'خطای ارتباط با سرور در ماژول باربرداری';
    const err: any = new Error(errMsg);
    err.blockers = parsed.data?.blockers;
    err.status = parsed.status;
    throw err;
  }
  return (parsed.data?.data ?? parsed.data) as T;
}

export const liftingApi = {
  getBootstrap(): Promise<{
    standards: LiftingStandardConfig[];
    cranes: LiftingCrane[];
    riggingEquipment: RiggingEquipmentItem[];
    plans: LiftingPlanRecord[];
    stageGates: LiftingStageGateRow[];
    engineVersion: string;
    permissions: { canRead: boolean; canWrite: boolean; canApprove: boolean };
  }> {
    return request('/bootstrap');
  },

  getIntegrationContext(): Promise<LiftingIntegrationContext> {
    return request('/integration-context');
  },

  getStageGates(): Promise<LiftingStageGateRow[]> {
    return request('/gates');
  },

  verifyStageGate(
    gateCode: string,
    payload: { decision: 'VERIFIED' | 'FAILED' | 'PENDING'; notes?: string }
  ): Promise<LiftingStageGateRow> {
    return request(`/gates/${encodeURIComponent(gateCode)}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  runBenchmarkSuite(): Promise<BenchmarkSuiteReport> {
    return request('/engine/benchmark', { method: 'POST', body: JSON.stringify({}) });
  },

  updateStandard(code: string, payload: Partial<LiftingStandardConfig>): Promise<LiftingStandardConfig> {
    return request(`/standards/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  createCrane(payload: Partial<LiftingCrane>): Promise<LiftingCrane> {
    return request('/cranes', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateCrane(id: number, payload: Partial<LiftingCrane>): Promise<LiftingCrane> {
    return request(`/cranes/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  replaceLoadChart(craneId: number, rows: CraneLoadChartRow[]): Promise<CraneLoadChartRow[]> {
    return request(`/cranes/${craneId}/load-chart`, {
      method: 'PUT',
      body: JSON.stringify({ rows }),
    });
  },

  deleteCrane(id: number): Promise<void> {
    return request(`/cranes/${id}`, { method: 'DELETE' });
  },

  createRigging(payload: Partial<RiggingEquipmentItem>): Promise<RiggingEquipmentItem> {
    return request('/rigging', { method: 'POST', body: JSON.stringify(payload) });
  },

  updateRigging(id: number, payload: Partial<RiggingEquipmentItem>): Promise<RiggingEquipmentItem> {
    return request(`/rigging/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  deleteRigging(id: number): Promise<void> {
    return request(`/rigging/${id}`, { method: 'DELETE' });
  },

  createPlan(payload: Partial<LiftingPlanRecord>): Promise<LiftingPlanRecord> {
    return request('/plans', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updatePlan(
    id: number,
    payload: Partial<LiftingPlanRecord> & { changeReason?: string }
  ): Promise<{ plan: LiftingPlanRecord; revisionBumped: boolean }> {
    const res = await authFetch(`${BASE}/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const parsed = await parseJsonSafely<{ success?: boolean; data?: LiftingPlanRecord; revisionBumped?: boolean; error?: string }>(res);
    if (!parsed.ok || parsed.data?.success === false || !parsed.data?.data) {
      throw new Error(parsed.data?.error || parsed.error || 'خطا در ویرایش طرح باربرداری');
    }
    return {
      plan: parsed.data.data,
      revisionBumped: Boolean(parsed.data.revisionBumped),
    };
  },

  updateGovernanceChecklists(
    id: number,
    payload: {
      engineeringChecklist?: Record<string, any>;
      hseChecklist?: Record<string, any>;
      fieldConditionsVerification?: Record<string, any>;
    }
  ): Promise<LiftingPlanRecord> {
    return request(`/plans/${id}/governance`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deletePlan(id: number): Promise<void> {
    return request(`/plans/${id}`, { method: 'DELETE' });
  },

  getPlanRevisionsAndCalcs(id: number): Promise<{ revisions: any[]; calculations: any[] }> {
    return request(`/plans/${id}/revisions`);
  },

  calculatePreview(payload: Record<string, any>): Promise<FullPlanEvaluationResult> {
    return request('/calculate', { method: 'POST', body: JSON.stringify(payload) });
  },

  calculateAndSavePlan(
    id: number,
    overrides?: Record<string, any>
  ): Promise<{ calculation: FullPlanEvaluationResult; plan: LiftingPlanRecord }> {
    return request(`/plans/${id}/calculate`, {
      method: 'POST',
      body: JSON.stringify(overrides || {}),
    });
  },

  advanceWorkflow(
    planId: number,
    payload: {
      stageKey: string;
      decision: 'APPROVED' | 'REJECTED' | 'RETURNED';
      comments?: string;
      checklistState?: Record<string, boolean>;
      signerPersonnelCode?: string;
    }
  ): Promise<LiftingPlanRecord> {
    return request(`/plans/${planId}/workflow/advance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  linkOrCreateJsa(planId: number, payload: Record<string, any>): Promise<LiftingPlanRecord> {
    return request(`/plans/${planId}/link-jsa`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  linkOrCreatePtw(planId: number, payload: Record<string, any>): Promise<LiftingPlanRecord> {
    return request(`/plans/${planId}/link-ptw`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  linkOrCreateNc(planId: number, payload: Record<string, any>): Promise<LiftingPlanRecord> {
    return request(`/plans/${planId}/link-nc`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  analyzeWithAi(planId: number, question?: string): Promise<Record<string, any>> {
    return request(`/plans/${planId}/ai-analyze`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },
};
