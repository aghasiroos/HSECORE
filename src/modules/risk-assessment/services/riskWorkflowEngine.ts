import moment from 'moment-jalaali';
import {
  AnyRiskAssessment,
  FtaEventNode,
  RiskActionItem,
  RiskLevel,
  RiskWorkflowStage,
} from '../types';
import { nonConformanceService } from '../../../components/non-conformance/nonConformanceService';

export interface WorkflowStageMeta {
  key: RiskWorkflowStage;
  step: number;
  titleFa: string;
  titleEn: string;
  shortFa: string;
}

export const RISK_WORKFLOW_STAGES: WorkflowStageMeta[] = [
  { key: 'DRAFT_NEW', step: 1, titleFa: 'پیش‌نویس / ایجاد ارزیابی جدید', titleEn: 'Draft / New Assessment', shortFa: 'ایجاد پیش‌نویس' },
  { key: 'INITIAL_INFO', step: 2, titleFa: 'تکمیل اطلاعات اولیه و زمینه', titleEn: 'Initial Info & Context', shortFa: 'اطلاعات اولیه' },
  { key: 'HAZARD_ID', step: 3, titleFa: 'شناسایی خطرات و سناریوها', titleEn: 'Hazard Identification', shortFa: 'شناسایی خطر' },
  { key: 'RISK_ANALYSIS', step: 4, titleFa: 'تحلیل و محاسبه ریسک اولیه', titleEn: 'Initial Risk Analysis', shortFa: 'تحلیل ریسک' },
  { key: 'CONTROL_MEASURES', step: 5, titleFa: 'تعیین اقدامات کنترلی', titleEn: 'Control Measures', shortFa: 'اقدامات کنترلی' },
  { key: 'OWNER_DEADLINE', step: 6, titleFa: 'تخصیص مسئول و مهلت (CAPA)', titleEn: 'Owner & Deadline', shortFa: 'مسئول و مهلت' },
  { key: 'REVIEW_APPROVAL', step: 7, titleFa: 'بازبینی و تایید کارشناس/مدیر HSE', titleEn: 'Review & Approval', shortFa: 'بازبینی و تایید' },
  { key: 'ACTION_EXECUTION', step: 8, titleFa: 'اجرای اقدام و ثبت مستندات', titleEn: 'Action Execution & Evidence', shortFa: 'اجرا و شواهد' },
  { key: 'RESIDUAL_REEVALUATION', step: 9, titleFa: 'ارزیابی مجدد ریسک باقیمانده', titleEn: 'Residual Re-evaluation', shortFa: 'ریسک باقیمانده' },
  { key: 'EFFECTIVENESS_ARCHIVE', step: 10, titleFa: 'پایش اثربخشی و بایگانی', titleEn: 'Effectiveness & Archive', shortFa: 'اثربخشی و بایگانی' },
];

export function getTodayJalali(): string {
  return moment().format('jYYYY/jMM/jDD');
}

export function isActionOverdue(deadline?: string, status?: string): boolean {
  if (!deadline || status === 'DONE' || status === 'VERIFIED') return false;
  const normalized = deadline.trim().replace(/-/g, '/');
  if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(normalized)) return false;
  try {
    const today = moment().format('jYYYY/jMM/jDD');
    return normalized < today;
  } catch {
    return false;
  }
}

/**
 * Exact FTA Fault Tree bottom-up probability calculation preserving AND / OR / VOTING / INHIBIT gates.
 */
export function computeFtaTreeProbabilities(nodes: FtaEventNode[]): {
  nodeProbabilities: Record<string, number>;
  topEventProbability: number;
} {
  const byId = new Map<string, FtaEventNode>();
  const childrenMap = new Map<string, FtaEventNode[]>();

  for (const n of nodes) {
    byId.set(n.id, n);
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) || [];
      list.push(n);
      childrenMap.set(n.parentId, list);
    }
  }

  const memo: Record<string, number> = {};
  const visiting = new Set<string>();

  const evalNode = (nodeId: string): number => {
    if (memo[nodeId] !== undefined) return memo[nodeId];
    if (visiting.has(nodeId)) return 0; // cycle protection
    visiting.add(nodeId);

    const node = byId.get(nodeId);
    if (!node) {
      visiting.delete(nodeId);
      return 0;
    }

    const children = childrenMap.get(nodeId) || [];
    let prob = Math.max(0, Math.min(1, Number(node.probability ?? 0)));

    if (children.length > 0 && (node.type === 'TOP_EVENT' || node.type === 'INTERMEDIATE_EVENT')) {
      const childProbs = children.map(c => evalNode(c.id));
      const gate = node.gateType || 'OR';

      if (gate === 'AND' || gate === 'INHIBIT') {
        prob = childProbs.reduce((acc, p) => acc * p, 1);
      } else if (gate === 'OR') {
        prob = 1 - childProbs.reduce((acc, p) => acc * (1 - p), 1);
      } else if (gate === 'VOTING') {
        const n = childProbs.length;
        const k = Math.max(1, Math.min(n, Number(node.votingThreshold || Math.ceil(n / 2))));
        // DP probability that at least k independent inputs occur
        let dp = new Array(n + 1).fill(0);
        dp[0] = 1;
        for (const p of childProbs) {
          const next = new Array(n + 1).fill(0);
          for (let j = 0; j <= n; j++) {
            next[j] += dp[j] * (1 - p);
            if (j + 1 <= n) next[j + 1] += dp[j] * p;
          }
          dp = next;
        }
        prob = dp.slice(k).reduce((s, v) => s + v, 0);
      }
    }

    prob = Math.max(0, Math.min(1, Number(prob.toFixed(6))));
    memo[nodeId] = prob;
    visiting.delete(nodeId);
    return prob;
  };

  for (const n of nodes) {
    evalNode(n.id);
  }

  const topNode = nodes.find(n => n.type === 'TOP_EVENT') || nodes[0];
  return {
    nodeProbabilities: memo,
    topEventProbability: topNode ? (memo[topNode.id] ?? 0) : 0,
  };
}

export interface ValidationIssue {
  field: string;
  messageFa: string;
  messageEn: string;
}

export function validateAssessmentWorkflow(
  assessment: Partial<AnyRiskAssessment>,
  mode: 'DRAFT' | 'SUBMIT_REVIEW' | 'APPROVE' | 'ARCHIVE'
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!String(assessment.title || '').trim()) {
    issues.push({
      field: 'title',
      messageFa: 'عنوان ارزیابی ریسک الزامی است.',
      messageEn: 'Assessment title is required.',
    });
  }

  if (mode === 'DRAFT') {
    return issues;
  }

  if (!String(assessment.unit || '').trim()) {
    issues.push({
      field: 'unit',
      messageFa: 'واحد عملیاتی / سازمانی باید مشخص شود.',
      messageEn: 'Operational unit is required.',
    });
  }

  if (!String(assessment.assessorName || '').trim()) {
    issues.push({
      field: 'assessorName',
      messageFa: 'نام ارزیاب / کارشناس مسئول ثبت الزامی است.',
      messageEn: 'Assessor name is required.',
    });
  }

  if (!String(assessment.assessmentDate || '').trim()) {
    issues.push({
      field: 'assessmentDate',
      messageFa: 'تاریخ ارزیابی باید وارد شود.',
      messageEn: 'Assessment date is required.',
    });
  }

  // Enforce no orphan actions: every action must have owner & deadline
  const actions: RiskActionItem[] = Array.isArray(assessment.controlActions) ? assessment.controlActions : [];
  actions.forEach((act, idx) => {
    if (act.title?.trim() && (!act.owner?.trim() || !act.deadline?.trim())) {
      issues.push({
        field: `controlActions[${idx}]`,
        messageFa: `اقدام اصلاحی ردیف ${idx + 1} («${act.title}») فاقد مسئول یا مهلت اجرا است.`,
        messageEn: `Control action #${idx + 1} requires both owner and deadline.`,
      });
    }
    if (mode === 'ARCHIVE' && (act.status === 'DONE' || act.status === 'VERIFIED') && !act.evidenceNotes?.trim() && !act.evidenceAttachmentName?.trim()) {
      issues.push({
        field: `controlActions[${idx}].evidence`,
        messageFa: `برای بایگانی، ثبت شواهد یا توضیحات اجرا برای اقدام «${act.title}» الزامی است.`,
        messageEn: `Execution evidence is required for action "${act.title}" before archiving.`,
      });
    }
  });

  // Method-specific checks for steps/rows/items/nodes
  const method = assessment.method;
  if (method === 'JSA') {
    const steps = (assessment as any).steps || [];
    if (steps.length === 0) {
      issues.push({ field: 'steps', messageFa: 'حداقل یک مرحله کار در جدول JSA باید ثبت شود.', messageEn: 'At least one JSA step is required.' });
    }
    steps.forEach((s: any, idx: number) => {
      if (!s.taskDescription?.trim() || !s.hazards?.trim()) {
        issues.push({
          field: `steps[${idx}]`,
          messageFa: `مرحله ${idx + 1} جدول JSA دارای شرح وظیفه یا خطر خالی است.`,
          messageEn: `JSA step #${idx + 1} is missing task or hazard description.`,
        });
      }
      if ((s.initialRiskLevel === 'HIGH' || s.initialRiskLevel === 'CRITICAL') && (!s.actionOwner?.trim() || !s.actionDeadline?.trim())) {
        issues.push({
          field: `steps[${idx}].owner`,
          messageFa: `مرحله ${idx + 1} با ریسک بالا/بحرانی باید مسئول و مهلت اقدام کنترلی داشته باشد.`,
          messageEn: `High/Critical JSA step #${idx + 1} requires owner and deadline.`,
        });
      }
    });
  } else if (method === 'FMEA') {
    const rows = (assessment as any).rows || [];
    if (rows.length === 0) {
      issues.push({ field: 'rows', messageFa: 'حداقل یک حالت خرابی در جدول FMEA باید ثبت شود.', messageEn: 'At least one FMEA failure mode is required.' });
    }
    rows.forEach((r: any, idx: number) => {
      if (!r.itemFunction?.trim() || !r.failureMode?.trim()) {
        issues.push({
          field: `rows[${idx}]`,
          messageFa: `ردیف ${idx + 1} جدول FMEA فاقد کارکرد یا حالت خرابی است.`,
          messageEn: `FMEA row #${idx + 1} is missing function or failure mode.`,
        });
      }
      if ((r.rpn >= 120) && (!r.responsibility?.trim() || !r.targetDate?.trim())) {
        issues.push({
          field: `rows[${idx}].responsibility`,
          messageFa: `ردیف ${idx + 1} FMEA با RPN=${r.rpn} باید مسئول و مهلت اقدام داشته باشد.`,
          messageEn: `FMEA row #${idx + 1} with RPN >= 120 requires owner and target date.`,
        });
      }
    });
  } else if (method === 'FTA') {
    const nodes = (assessment as any).nodes || [];
    if (nodes.length < 2) {
      issues.push({ field: 'nodes', messageFa: 'درخت خطا باید حداقل شامل رویداد رأس و یک رویداد پایه/میانی باشد.', messageEn: 'Fault tree needs top event and at least one child node.' });
    }
  } else if (method === 'HHA') {
    const items = (assessment as any).items || [];
    if (items.length === 0) {
      issues.push({ field: 'items', messageFa: 'حداقل یک عامل زیان‌آور بهداشتی یا خطای انسانی در HHA ثبت کنید.', messageEn: 'At least one HHA item is required.' });
    }
  } else if (method === 'WHAT_IF') {
    const questions = (assessment as any).questions || [];
    if (questions.length === 0) {
      issues.push({ field: 'questions', messageFa: 'حداقل یک سوال «چه می‌شود اگر» در فرم ثبت کنید.', messageEn: 'At least one What-If question is required.' });
    }
  } else if (method === 'BOWTIE') {
    const bt = (assessment as any).bowtie;
    if (!bt?.hazard?.trim() || !bt?.topEvent?.trim()) {
      issues.push({ field: 'bowtie', messageFa: 'منبع خطر (Hazard) و رویداد اصلی (Top Event) در نمودار پاپیونی الزامی است.', messageEn: 'Hazard and Top Event are required in Bow-Tie.' });
    }
  } else if (method === 'JOB_ACTIVITY') {
    const hazardsList = (assessment as any).hazardsList || [];
    if (hazardsList.length === 0) {
      issues.push({ field: 'hazardsList', messageFa: 'حداقل یک خطر ایمنی/بهداشتی/محیط‌زیستی برای فعالیت/شغل ثبت کنید.', messageEn: 'At least one hazard item is required.' });
    }
  }

  return issues;
}

export interface SimilarHazardSuggestion {
  id: string;
  sourceType: 'RISK_ASSESSMENT' | 'INCIDENT' | 'INSPECTION';
  sourceCode: string;
  title: string;
  unit: string;
  hazardText: string;
  recommendedControl: string;
  riskLevel: RiskLevel;
  similarityScore: number;
}

/**
 * Advisory suggestion engine: finds matching historical hazards & controls across risk assessments, incidents, and inspections.
 * Strictly advisory — never modifies user inputs automatically.
 */
export function findSimilarHazardSuggestions(
  query: { title?: string; unit?: string; equipmentTag?: string; keyword?: string },
  allAssessments: AnyRiskAssessment[],
  incidents: any[] = [],
  inspections: any[] = []
): SimilarHazardSuggestion[] {
  const tokens = `${query.title || ''} ${query.unit || ''} ${query.equipmentTag || ''} ${query.keyword || ''}`
    .toLowerCase()
    .split(/[\s،,.\-_/|]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2);

  if (tokens.length === 0) return [];

  const scoreText = (haystack: string): number => {
    const lower = haystack.toLowerCase();
    let hits = 0;
    for (const tok of tokens) {
      if (lower.includes(tok)) hits += 1;
    }
    return hits;
  };

  const results: SimilarHazardSuggestion[] = [];

  for (const a of allAssessments) {
    const hay = `${a.title} ${a.unit} ${(a as any).equipmentTag || ''} ${(a as any).hazardDescription || ''} ${(a as any).jobTitle || ''}`;
    const score = scoreText(hay);
    if (score > 0) {
      results.push({
        id: `ra-${a.id}`,
        sourceType: 'RISK_ASSESSMENT',
        sourceCode: a.code,
        title: a.title,
        unit: a.unit,
        hazardText: (a as any).hazardDescription || a.title,
        recommendedControl: (a as any).proposedControls || 'کنترل‌های ثبت‌شده در پرونده قبلی را بررسی کنید',
        riskLevel: a.overallRiskLevel || 'MEDIUM',
        similarityScore: score,
      });
    }
  }

  for (const inc of incidents) {
    const hay = `${inc.description || ''} ${inc.location || ''} ${inc.immediateCauses || ''} ${inc.rootCauses || ''}`;
    const score = scoreText(hay);
    if (score > 0) {
      results.push({
        id: `inc-${inc.id || inc.incidentNumber}`,
        sourceType: 'INCIDENT',
        sourceCode: inc.incidentNumber || `INC-${inc.id}`,
        title: inc.description?.slice(0, 70) || 'سابقه حادثه',
        unit: inc.location || 'عمومی',
        hazardText: inc.immediateCauses || inc.description || '',
        recommendedControl: inc.correctiveActions || inc.rootCauses || 'بازبینی اقدامات اصلاحی حادثه',
        riskLevel: String(inc.severity || '').toUpperCase().includes('MAJOR') ? 'CRITICAL' : 'HIGH',
        similarityScore: score,
      });
    }
  }

  for (const insp of inspections) {
    const hay = `${insp.title || ''} ${insp.unitName || insp.unit || ''} ${insp.findings || insp.notes || ''}`;
    const score = scoreText(hay);
    if (score > 0) {
      results.push({
        id: `insp-${insp.id}`,
        sourceType: 'INSPECTION',
        sourceCode: insp.code || `INSP-${insp.id}`,
        title: insp.title || 'گزارش بازرسی ایمنی',
        unit: insp.unitName || insp.unit || 'عمومی',
        hazardText: insp.findings || insp.notes || insp.title || '',
        recommendedControl: insp.correctiveAction || 'رفع نقص مطابق چک‌لیست بازرسی',
        riskLevel: 'MEDIUM',
        similarityScore: score,
      });
    }
  }

  return results.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 8);
}

/**
 * Syncs eligible RiskActionItems into centralized Non-Conformance (CAPA) module.
 */
export async function syncRiskActionsToNonConformance(
  assessment: AnyRiskAssessment,
  actions: RiskActionItem[],
  actorName: string
): Promise<RiskActionItem[]> {
  const updated: RiskActionItem[] = [];
  for (const act of actions) {
    if (!act.owner?.trim() || !act.deadline?.trim() || act.nonConformanceId) {
      updated.push(act);
      continue;
    }
    try {
      const created = await nonConformanceService.create(
        {
          title: `اقدام کنترلی ریسک: ${act.title.slice(0, 110)}`,
          sourceModule: 'risk_assessment',
          sourceRecordId: String(assessment.id || assessment.code),
          sourceTitle: `${assessment.code} — ${assessment.title}`,
          unitId: assessment.unitId ?? null,
          unitName: assessment.unit,
          riskLevel: assessment.overallRiskLevel,
          category: assessment.method,
          description: `منتقل شده از ارزیابی ریسک (${assessment.method}) به کد ${assessment.code}`,
          correctiveAction: act.title,
          assignedTo: act.ownerPersonnelCode || act.owner,
          assignedToName: act.owner,
          dueDate: act.deadline,
          status: 'CAPA_DEFINED',
        },
        actorName
      );
      updated.push({
        ...act,
        nonConformanceId: created?.id,
        nonConformanceCode: created?.trackingCode,
      });
    } catch {
      updated.push(act);
    }
  }
  return updated;
}
