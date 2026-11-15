import * as XLSX from 'xlsx';
import { apiDb } from '../../../services/apiDatabaseClient';
import {
  AnyRiskAssessment,
  RiskLevel,
  RiskMatrixConfig,
  MatrixThresholdBand,
} from '../types';

export const RISK_MATRIX_CONFIG_SETTING_KEY = 'hse_risk_matrix_config_v1';

export const DEFAULT_RISK_MATRIX_CONFIG: RiskMatrixConfig = {
  id: 'default-5x5',
  nameFa: 'ماتریس استاندارد ارزیابی ریسک سازمان (۵×۵)',
  standardRef: 'ISO 45001 / ISO 31000 — قابل تنظیم توسط سازمان',
  probabilityScale: [
    { value: 1, labelFa: 'بسیار بعید (Rare)', labelEn: 'Rare', descriptionFa: 'به‌ندرت در طول عمر مجتمع (< 1 بار در 10 سال)' },
    { value: 2, labelFa: 'بعید (Unlikely)', labelEn: 'Unlikely', descriptionFa: 'ممکن است رخ دهد ولی غیرمعمول است (1 بار در 5 سال)' },
    { value: 3, labelFa: 'محتمل (Possible)', labelEn: 'Possible', descriptionFa: 'سابقه وقوع در صنعت یا مجتمع وجود دارد (سالانه)' },
    { value: 4, labelFa: 'احتمال بالا (Likely)', labelEn: 'Likely', descriptionFa: 'به‌طور دوره‌ای قابل پیش‌بینی است (فصلی/ماهانه)' },
    { value: 5, labelFa: 'تقریباً قطعی (Almost Certain)', labelEn: 'Almost Certain', descriptionFa: 'در شرایط فعلی مکرراً رخ می‌دهد' },
  ],
  severityScale: [
    { value: 1, labelFa: 'ناچیز (Insignificant)', labelEn: 'Insignificant', descriptionFa: 'بدون جراحت یا کمک‌های اولیه جزئی / توقف < 1 ساعت' },
    { value: 2, labelFa: 'خفیف (Minor)', labelEn: 'Minor', descriptionFa: 'آسیب نیازمند درمان پزشکی سرپایی / خسارت محدود' },
    { value: 3, labelFa: 'متوسط (Moderate)', labelEn: 'Moderate', descriptionFa: 'حادثه منجر به اتلاف روز کاری (LTI) / آلودگی کنترل‌شده' },
    { value: 4, labelFa: 'شدید (Major)', labelEn: 'Major', descriptionFa: 'ازکارافتادگی دائم یا جراحت شدید / خسارت عمده تجهیز' },
    { value: 5, labelFa: 'فاجعه‌بار (Catastrophic)', labelEn: 'Catastrophic', descriptionFa: 'فوت یا جراحات متعدد / آتش‌سوزی و انفجار گسترده' },
  ],
  thresholds: [
    {
      level: 'LOW',
      minScore: 1,
      maxScore: 4,
      labelFa: 'پایین (قابل قبول)',
      labelEn: 'Low',
      colorHex: '#10b981',
      acceptabilityFa: 'قابل قبول — ادامه کار با پایش روتین و کنترل‌های جاری',
      requiredActionFa: 'حفظ دستورالعمل‌های ایمنی موجود و پایش دوره‌ای',
    },
    {
      level: 'MEDIUM',
      minScore: 5,
      maxScore: 9,
      labelFa: 'متوسط (کنترل مشروط / ALARP)',
      labelEn: 'Medium',
      colorHex: '#f59e0b',
      acceptabilityFa: 'قابل تحمل مشروط — نیازمند کاهش ریسک تا سطح ALARP',
      requiredActionFa: 'تعریف اقدام کنترلی با مسئول و زمان‌بندی مشخص',
    },
    {
      level: 'HIGH',
      minScore: 10,
      maxScore: 14,
      labelFa: 'بالا (نامطلوب)',
      labelEn: 'High',
      colorHex: '#f97316',
      acceptabilityFa: 'نامطلوب — نیاز به تایید مدیر واحد/HSE پیش از اجرا',
      requiredActionFa: 'اجرای فوری کنترل‌های مهندسی/اداری و ثبت پرونده CAPA',
    },
    {
      level: 'CRITICAL',
      minScore: 15,
      maxScore: 25,
      labelFa: 'بحرانی (غیرقابل قبول)',
      labelEn: 'Critical',
      colorHex: '#ef4444',
      acceptabilityFa: 'غیرقابل قبول — توقف فوری فعالیت تا کاهش ریسک',
      requiredActionFa: 'توقف کار، حذف/جایگزینی یا سد مهندسی قطعی و تایید مدیر ارشد',
    },
  ],
};

export async function loadOrganizationMatrixConfig(): Promise<RiskMatrixConfig> {
  try {
    const saved = await apiDb.getSetting(RISK_MATRIX_CONFIG_SETTING_KEY);
    if (saved && Array.isArray(saved.probabilityScale) && Array.isArray(saved.severityScale) && Array.isArray(saved.thresholds)) {
      return saved as RiskMatrixConfig;
    }
  } catch {
    // fallback cleanly
  }
  return DEFAULT_RISK_MATRIX_CONFIG;
}

export async function saveOrganizationMatrixConfig(config: RiskMatrixConfig): Promise<boolean> {
  const payload: RiskMatrixConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  return apiDb.saveSetting(RISK_MATRIX_CONFIG_SETTING_KEY, payload);
}

export function evaluateMatrixScore(
  score: number,
  config: RiskMatrixConfig = DEFAULT_RISK_MATRIX_CONFIG
): MatrixThresholdBand {
  const sorted = [...config.thresholds].sort((a, b) => a.minScore - b.minScore);
  for (const band of sorted) {
    if (score >= band.minScore && score <= band.maxScore) {
      return band;
    }
  }
  if (score > (sorted[sorted.length - 1]?.maxScore || 25)) {
    return sorted[sorted.length - 1];
  }
  return sorted[0];
}

export interface MatrixCellAssessmentPoint {
  assessment: AnyRiskAssessment;
  itemLabel: string;
  probability: number;
  severity: number;
  score: number;
  level: RiskLevel;
  phase: 'INITIAL' | 'RESIDUAL';
}

export function extractMatrixPointsFromAssessments(
  assessments: AnyRiskAssessment[],
  config: RiskMatrixConfig = DEFAULT_RISK_MATRIX_CONFIG,
  phase: 'INITIAL' | 'RESIDUAL' = 'INITIAL'
): MatrixCellAssessmentPoint[] {
  const maxP = config.probabilityScale.length || 5;
  const maxS = config.severityScale.length || 5;
  const clampP = (v: number) => Math.max(1, Math.min(maxP, Math.round(v || 1)));
  const clampS = (v: number) => Math.max(1, Math.min(maxS, Math.round(v || 1)));
  const points: MatrixCellAssessmentPoint[] = [];

  for (const a of assessments) {
    if (a.method === 'JSA' && Array.isArray((a as any).steps)) {
      for (const s of (a as any).steps) {
        const p = clampP(phase === 'INITIAL' ? s.initialProbability : s.residualProbability);
        const sv = clampS(phase === 'INITIAL' ? s.initialSeverity : s.residualSeverity);
        const sc = p * sv;
        points.push({
          assessment: a,
          itemLabel: s.hazards || s.taskDescription || a.title,
          probability: p,
          severity: sv,
          score: sc,
          level: evaluateMatrixScore(sc, config).level,
          phase,
        });
      }
    } else if (a.method === 'WHAT_IF' && Array.isArray((a as any).questions)) {
      for (const q of (a as any).questions) {
        const p = clampP(phase === 'INITIAL' ? q.initialProbability : q.residualProbability);
        const sv = clampS(phase === 'INITIAL' ? q.initialSeverity : q.residualSeverity);
        const sc = p * sv;
        points.push({
          assessment: a,
          itemLabel: q.question || q.hazards || a.title,
          probability: p,
          severity: sv,
          score: sc,
          level: evaluateMatrixScore(sc, config).level,
          phase,
        });
      }
    } else if (a.method === 'JOB_ACTIVITY' && Array.isArray((a as any).hazardsList)) {
      for (const h of (a as any).hazardsList) {
        const p = clampP(phase === 'INITIAL' ? h.initialProbability : h.residualProbability);
        const sv = clampS(phase === 'INITIAL' ? h.initialSeverity : h.residualSeverity);
        const sc = p * sv;
        points.push({
          assessment: a,
          itemLabel: h.hazardTitle || a.title,
          probability: p,
          severity: sv,
          score: sc,
          level: evaluateMatrixScore(sc, config).level,
          phase,
        });
      }
    } else if (a.method === 'HHA' && Array.isArray((a as any).items)) {
      for (const item of (a as any).items) {
        const fallbackMap: Record<string, [number, number]> = {
          CRITICAL: [4, 5],
          HIGH: [3, 4],
          MEDIUM: [3, 2],
          LOW: [2, 1],
        };
        const [fp, fs] = fallbackMap[item.riskRating || 'MEDIUM'] || [2, 2];
        const p = clampP(phase === 'INITIAL' ? (item.initialProbability || fp) : (item.residualProbability || Math.max(1, fp - 1)));
        const sv = clampS(phase === 'INITIAL' ? (item.initialSeverity || fs) : (item.residualSeverity || fs));
        const sc = p * sv;
        points.push({
          assessment: a,
          itemLabel: item.agentName || item.errorType || item.jobRole || a.title,
          probability: p,
          severity: sv,
          score: sc,
          level: evaluateMatrixScore(sc, config).level,
          phase,
        });
      }
    } else if (a.method === 'FMEA' && Array.isArray((a as any).rows)) {
      for (const r of (a as any).rows) {
        const sRaw = phase === 'INITIAL' ? r.severity : (r.revisedSeverity || r.severity);
        const oRaw = phase === 'INITIAL' ? r.occurrence : (r.revisedOccurrence || r.occurrence);
        const p = clampP(Math.ceil((oRaw || 2) / 2));
        const sv = clampS(Math.ceil((sRaw || 2) / 2));
        const sc = p * sv;
        points.push({
          assessment: a,
          itemLabel: r.failureMode || r.itemFunction || a.title,
          probability: p,
          severity: sv,
          score: sc,
          level: evaluateMatrixScore(sc, config).level,
          phase,
        });
      }
    } else {
      const fallbackMap: Record<string, [number, number]> = {
        CRITICAL: [4, 5],
        HIGH: [3, 4],
        MEDIUM: [2, 3],
        LOW: [1, 2],
      };
      const targetLevel = phase === 'INITIAL' ? a.overallRiskLevel : (a.residualRiskLevel || 'LOW');
      const [p, sv] = fallbackMap[targetLevel] || [2, 2];
      const sc = p * sv;
      points.push({
        assessment: a,
        itemLabel: a.title,
        probability: clampP(p),
        severity: clampS(sv),
        score: sc,
        level: evaluateMatrixScore(sc, config).level,
        phase,
      });
    }
  }
  return points;
}

export function exportRiskRegisterToExcel(
  assessments: AnyRiskAssessment[],
  config: RiskMatrixConfig,
  filename = `HSECORE_Risk_Register_${Date.now()}.xlsx`
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Register Summary
  const registerRows = assessments.map((a, idx) => ({
    'ردیف': idx + 1,
    'کد سند': a.code,
    'عنوان ارزیابی': a.title,
    'روش ارزیابی': a.method,
    'واحد عملیاتی': a.unit,
    'محل / ناحیه': a.areaLocation,
    'ارزیاب': a.assessorName,
    'تاریخ': a.assessmentDate,
    'ریسک اولیه': a.overallRiskLevel,
    'امتیاز اولیه': a.initialRiskScore || '',
    'ریسک باقیمانده': a.residualRiskLevel || '-',
    'امتیاز باقیمانده': a.residualRiskScore || '',
    'وضعیت پرونده': a.status,
    'تعداد اقدامات کنترلی': Array.isArray(a.controlActions) ? a.controlActions.length : 0,
  }));
  const wsRegister = XLSX.utils.json_to_sheet(registerRows);
  XLSX.utils.book_append_sheet(wb, wsRegister, 'ثبت ارزیابی ریسک');

  // Sheet 2: Matrix Grid Distribution
  const points = extractMatrixPointsFromAssessments(assessments, config, 'INITIAL');
  const matrixRows: any[] = [];
  const pDesc = [...config.probabilityScale].sort((a, b) => b.value - a.value);
  const sAsc = [...config.severityScale].sort((a, b) => a.value - b.value);

  for (const p of pDesc) {
    const row: Record<string, any> = {
      'احتمال \\ شدت': `${p.value} - ${p.labelFa}`,
    };
    for (const s of sAsc) {
      const score = p.value * s.value;
      const band = evaluateMatrixScore(score, config);
      const count = points.filter(pt => pt.probability === p.value && pt.severity === s.value).length;
      row[`${s.value} - ${s.labelFa}`] = `امتیاز ${score} (${band.labelFa}) | تعداد: ${count}`;
    }
    matrixRows.push(row);
  }
  const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'ماتریس ریسک');

  // Sheet 3: Threshold Policy
  const policyRows = config.thresholds.map(t => ({
    'سطح': t.level,
    'عنوان': t.labelFa,
    'حداقل امتیاز': t.minScore,
    'حداکثر امتیاز': t.maxScore,
    'معیار پذیرش': t.acceptabilityFa,
    'اقدام الزامی': t.requiredActionFa,
  }));
  const wsPolicy = XLSX.utils.json_to_sheet(policyRows);
  XLSX.utils.book_append_sheet(wb, wsPolicy, 'سیاست آستانه ریسک');

  XLSX.writeFile(wb, filename);
}
