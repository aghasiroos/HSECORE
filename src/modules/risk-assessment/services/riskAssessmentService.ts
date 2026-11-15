import {
  AnyRiskAssessment,
  RiskMethod,
  RiskLevel,
  RiskMatrixConfig,
} from '../types';
import { apiDb } from '../../../services/apiDatabaseClient';
import { DEFAULT_RISK_MATRIX_CONFIG, evaluateMatrixScore } from './riskMatrixConfig';

export const calculateRiskLevel = (
  score: number,
  method: '5x5' | 'RPN',
  matrixConfig?: RiskMatrixConfig
): RiskLevel => {
  if (method === '5x5') {
    return evaluateMatrixScore(score, matrixConfig || DEFAULT_RISK_MATRIX_CONFIG).level;
  }
  // RPN (1 - 1000)
  if (score >= 200) return 'CRITICAL';
  if (score >= 120) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  return 'LOW';
};

export interface MethodRegistryEntry {
  order: number;
  titleFa: string;
  shortFa: string;
  titleEn: string;
  color: string;
  chartColor: string;
  descFa: string;
}

export const METHOD_REGISTRY: Record<RiskMethod, MethodRegistryEntry> = {
  FMEA: {
    order: 1,
    titleFa: 'تجزیه‌وتحلیل حالات و اثرات خرابی (FMEA)',
    shortFa: 'FMEA',
    titleEn: 'Failure Modes & Effects Analysis',
    color: 'from-blue-600 to-indigo-700',
    chartColor: '#2563eb',
    descFa: 'شناسایی حالات خرابی تجهیزات و فرآیندها، محاسبه RPN اولیه و اصلاح‌شده (S×O×D)',
  },
  JSA: {
    order: 2,
    titleFa: 'تجزیه‌وتحلیل ایمنی شغلی (JSA / JHA)',
    shortFa: 'JSA / JHA',
    titleEn: 'Job Safety Analysis',
    color: 'from-sky-600 to-cyan-600',
    chartColor: '#0284c7',
    descFa: 'تفکیک گام‌به‌گام وظایف، شناسایی خطرات، سلسله‌مراتب کنترل و ریسک اولیه و باقیمانده',
  },
  FTA: {
    order: 3,
    titleFa: 'تحلیل درخت خطا (FTA)',
    shortFa: 'FTA',
    titleEn: 'Fault Tree Analysis',
    color: 'from-rose-600 to-red-600',
    chartColor: '#e11d48',
    descFa: 'مدل‌سازی سلسله‌مراتبی رویداد رأس، گیت‌های منطقی AND/OR/VOTING و محاسبه احتمال وقوع',
  },
  HHA: {
    order: 4,
    titleFa: 'خطرات بهداشتی و خطای انسانی (HHA)',
    shortFa: 'HHA + خطای انسانی',
    titleEn: 'Health Hazard & Human Factors Analysis',
    color: 'from-emerald-600 to-teal-600',
    chartColor: '#059669',
    descFa: 'ارزیابی عوامل زیان‌آور شغلی (OEL/طب کار) و تحلیل خطاهای انسانی و شرایط سازمانی (PSFs)',
  },
  WHAT_IF: {
    order: 5,
    titleFa: 'تحلیل سناریوی «چه می‌شود اگر» (What-If)',
    shortFa: 'What-If',
    titleEn: 'What-If Hazard Analysis',
    color: 'from-amber-600 to-orange-600',
    chartColor: '#d97706',
    descFa: 'طوفان فکری ساختاریافته سوالات انحراف فرآیندی، پاسخ کارشناسی و پیشنهادهای کنترلی',
  },
  BOWTIE: {
    order: 6,
    titleFa: 'تحلیل گرافیکی پاپیونی (Bow-Tie)',
    shortFa: 'Bow-Tie',
    titleEn: 'Bow-Tie Barrier Analysis',
    color: 'from-violet-600 to-purple-600',
    chartColor: '#7c3aed',
    descFa: 'ترسیم تعاملی تهدیدها، موانع پیشگیرانه، رویداد رأس، پیامدها، موانع کاهنده و عوامل تشدید',
  },
  MATRIX: {
    order: 7,
    titleFa: 'ماتریس پویا و قابل تنظیم ریسک',
    shortFa: 'ماتریس ریسک',
    titleEn: 'Configurable Risk Matrix',
    color: 'from-slate-700 to-slate-800',
    chartColor: '#475569',
    descFa: 'تنظیم سطوح شدت/احتمال، آستانه‌های پذیرش سازمان، تحلیل توزیع ریسک و خروجی اکسل/PDF',
  },
  JOB_ACTIVITY: {
    order: 8,
    titleFa: 'ارزیابی ریسک فعالیت‌ها و مشاغل',
    shortFa: 'فعالیت‌ها و مشاغل',
    titleEn: 'Activity & Job Risk Assessment',
    color: 'from-indigo-600 to-blue-700',
    chartColor: '#4f46e5',
    descFa: 'پرونده جامع ریسک‌های ایمنی، بهداشتی و محیط‌زیستی مشاغل و فعالیت‌های مستمر با تاریخچه بازنگری',
  },
};

export const ORDERED_RISK_METHODS: RiskMethod[] = [
  'FMEA',
  'JSA',
  'FTA',
  'HHA',
  'WHAT_IF',
  'BOWTIE',
  'MATRIX',
  'JOB_ACTIVITY',
];

export const getMethodMeta = (method: string) => {
  const upper = (method || 'JSA').toUpperCase() as RiskMethod;
  if (METHOD_REGISTRY[upper]) {
    return {
      methodKey: upper,
      ...METHOD_REGISTRY[upper],
    };
  }
  return {
    methodKey: upper,
    order: 99,
    titleFa: `متدولوژی ${upper}`,
    shortFa: upper,
    titleEn: `${upper} Methodology`,
    color: 'from-indigo-500 to-blue-600',
    chartColor: '#4f46e5',
    descFa: `ارزیابی و مدیریت ریسک به روش ${upper}`,
  };
};

export const getDistinctMethods = (_assessments: AnyRiskAssessment[]): RiskMethod[] => {
  return ORDERED_RISK_METHODS;
};

export const getRiskLevelColor = (level: RiskLevel | string) => {
  const norm = String(level || 'LOW').toUpperCase();
  switch (norm) {
    case 'CRITICAL':
    case 'EXTREME':
      return {
        badge: 'bg-red-50 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800 whitespace-nowrap',
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-500',
        labelFa: 'بحرانی (غیرقابل قبول)',
        shortLabelFa: 'بحرانی',
        labelEn: 'Critical (Intolerable)',
        shortLabelEn: 'Critical',
      };
    case 'HIGH':
      return {
        badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300 border border-orange-200 dark:border-orange-800 whitespace-nowrap',
        text: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-500',
        labelFa: 'بالا (نامطلوب)',
        shortLabelFa: 'بالا',
        labelEn: 'High (Undesirable)',
        shortLabelEn: 'High',
      };
    case 'MEDIUM':
      return {
        badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap',
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500',
        labelFa: 'متوسط (کنترل مشروط)',
        shortLabelFa: 'متوسط',
        labelEn: 'Medium (Tolerable)',
        shortLabelEn: 'Medium',
      };
    case 'LOW':
    default:
      return {
        badge: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap',
        text: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-500',
        labelFa: 'پایین (قابل قبول)',
        shortLabelFa: 'پایین',
        labelEn: 'Low (Acceptable)',
        shortLabelEn: 'Low',
      };
  }
};

export const getStatusBadgeMeta = (status: string, isFa: boolean) => {
  const s = String(status || 'DRAFT').toUpperCase();
  if (s === 'APPROVED' || s === 'ACTIVE') {
    return {
      label: isFa ? 'تایید نهایی' : 'Approved',
      className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    };
  }
  if (s === 'UNDER_REVIEW') {
    return {
      label: isFa ? 'در انتظار بازبینی/تایید' : 'Under Review',
      className: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    };
  }
  if (s === 'ARCHIVED') {
    return {
      label: isFa ? 'بایگانی و پایش‌شده' : 'Archived',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    };
  }
  return {
    label: isFa ? 'پیش‌نویس' : 'Draft',
    className: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
  };
};

export const riskAssessmentService = {
  async getAssessments(): Promise<AnyRiskAssessment[]> {
    try {
      const data = await apiDb.getRiskAssessments();
      if (Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      console.error('Failed to load risk assessments from database', e);
    }
    return [];
  },

  async saveAssessment(assessment: AnyRiskAssessment): Promise<AnyRiskAssessment> {
    const now = new Date().toISOString();
    const payload = {
      ...assessment,
      updatedAt: now,
      createdAt: assessment.createdAt || now,
    };
    const result = await apiDb.saveRiskAssessment(payload);
    return result || payload;
  },

  async transitionWorkflow(
    id: string | number,
    payload: { status?: string; workflowStage?: string; notes?: string; approverName?: string }
  ): Promise<AnyRiskAssessment> {
    return apiDb.transitionRiskWorkflow(id, payload);
  },

  async deleteAssessment(id: string | number): Promise<boolean> {
    return apiDb.deleteRiskAssessment(id);
  },

  async getAssessmentById(id: string): Promise<AnyRiskAssessment | undefined> {
    const list = await this.getAssessments();
    return list.find(a => String(a.id) === String(id) || String(a.dbId) === String(id));
  },

  async getAssessmentsByMethod(method: RiskMethod): Promise<AnyRiskAssessment[]> {
    const list = await this.getAssessments();
    return list.filter(a => String(a.method || '').toUpperCase() === method);
  },
};
