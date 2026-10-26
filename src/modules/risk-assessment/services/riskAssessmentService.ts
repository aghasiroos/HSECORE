import { 
  AnyRiskAssessment, 
  RiskMethod, 
  RiskLevel, 
  JsaAssessment, 
  FmeaAssessment, 
  FtaAssessment, 
  HhaAssessment 
} from '../types';

const STORAGE_KEY = 'hse_comprehensive_risk_assessments';

export const calculateRiskLevel = (score: number, method: '5x5' | 'RPN'): RiskLevel => {
  if (method === '5x5') {
    if (score >= 15) return 'CRITICAL';
    if (score >= 10) return 'HIGH';
    if (score >= 5) return 'MEDIUM';
    return 'LOW';
  } else {
    // RPN (1 - 1000)
    if (score >= 200) return 'CRITICAL';
    if (score >= 120) return 'HIGH';
    if (score >= 60) return 'MEDIUM';
    return 'LOW';
  }
};

export const METHOD_REGISTRY: Record<string, { titleFa: string; titleEn: string; color: string; chartColor: string; descFa: string }> = {
  JSA: {
    titleFa: 'آنالیز ایمنی شغلی (JSA)',
    titleEn: 'Job Safety Analysis',
    color: 'from-blue-600 to-indigo-600',
    chartColor: '#3b82f6',
    descFa: 'تفکیک گام‌به‌گام وظایف، خطرات و تدابیر پیشگیرانه قبل از شروع کار'
  },
  FMEA: {
    titleFa: 'آنالیز حالات و اثرات خرابی (FMEA)',
    titleEn: 'Failure Modes & Effects Analysis',
    color: 'from-blue-600 to-indigo-700',
    chartColor: '#2563eb',
    descFa: 'شناسایی و اولویت‌بندی خرابی تجهیزات با شاخص RPN (شدت، وقوع، کشف)'
  },
  FTA: {
    titleFa: 'تحلیل درخت خطا (FTA)',
    titleEn: 'Fault Tree Analysis',
    color: 'from-red-500 to-rose-600',
    chartColor: '#ef4444',
    descFa: 'مدل‌سازی گرافیکی علی و معلولی رویدادهای ناگوار با گیت‌های منطقی AND/OR'
  },
  HHA: {
    titleFa: 'ارزیابی خطرات بهداشتی (HHA)',
    titleEn: 'Health Hazard Assessment',
    color: 'from-emerald-500 to-teal-600',
    chartColor: '#10b981',
    descFa: 'پایش عوامل زیان‌آور فیزیکی، شیمیایی، ارگونومی و طب کار'
  }
};

const DYNAMIC_CHART_COLORS = [
  '#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#6366f1', '#14b8a6', '#2563eb', '#8b5cf6'
];

export const getMethodMeta = (method: string) => {
  const upper = (method || 'JSA').toUpperCase();
  if (METHOD_REGISTRY[upper]) {
    return {
      methodKey: upper,
      ...METHOD_REGISTRY[upper]
    };
  }

  // Fallback / Auto-generate for any new unknown risk method
  const hash = upper.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = DYNAMIC_CHART_COLORS[hash % DYNAMIC_CHART_COLORS.length];
  
  return {
    methodKey: upper,
    titleFa: `متدولوژی ${upper}`,
    titleEn: `${upper} Methodology`,
    color: 'from-indigo-500 to-blue-600',
    chartColor: color,
    descFa: `ارزیابی و مدیریت ریسک به روش ${upper}`
  };
};

export const getDistinctMethods = (assessments: AnyRiskAssessment[]): RiskMethod[] => {
  const standardMethods: RiskMethod[] = ['JSA', 'FMEA', 'FTA', 'HHA'];
  const excluded = new Set(['BOWTIE', 'HAZOP', 'MATRIX']);
  const methodsInRecords = Array.from(
    new Set(
      assessments
        .map(a => (a.method || '').toUpperCase())
        .filter(m => Boolean(m) && !excluded.has(m))
    )
  ) as RiskMethod[];
  
  const combined = Array.from(new Set([...standardMethods, ...methodsInRecords]));
  return combined;
};

export const getRiskLevelColor = (level: RiskLevel) => {
  switch (level) {
    case 'CRITICAL':
      return {
        badge: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800 whitespace-nowrap',
        text: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-500',
        labelFa: 'بحرانی (غیرقابل قبول)',
        shortLabelFa: 'بحرانی',
        labelEn: 'Critical (Intolerable)',
        shortLabelEn: 'Critical'
      };
    case 'HIGH':
      return {
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 whitespace-nowrap',
        text: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500',
        labelFa: 'بالا (نامطلوب)',
        shortLabelFa: 'بالا',
        labelEn: 'High (Undesirable)',
        shortLabelEn: 'High'
      };
    case 'MEDIUM':
      return {
        badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800 whitespace-nowrap',
        text: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-500',
        labelFa: 'متوسط (کنترل مشروط)',
        shortLabelFa: 'متوسط',
        labelEn: 'Medium (Tolerable)',
        shortLabelEn: 'Medium'
      };
    case 'LOW':
    default:
      return {
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap',
        text: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-500',
        labelFa: 'پایین (قابل قبول)',
        shortLabelFa: 'پایین',
        labelEn: 'Low (Acceptable)',
        shortLabelEn: 'Low'
      };
  }
};

import { apiDb } from '../../../services/apiDatabaseClient';

export const INITIAL_SAMPLE_ASSESSMENTS: any[] = [];

export const riskAssessmentService = {
  async getAssessments(): Promise<AnyRiskAssessment[]> {
    const excludedMethods = new Set(['BOWTIE', 'HAZOP', 'MATRIX']);
    try {
      const data = await apiDb.getRiskAssessments();
      if (data && data.length > 0) {
        return data.filter((a: any) => !excludedMethods.has((a.method || '').toUpperCase()));
      }
    } catch (e) {
      console.error('Failed to load risk assessments from پایگاه داده', e);
    }
    return INITIAL_SAMPLE_ASSESSMENTS;
  },

  async saveAssessment(assessment: AnyRiskAssessment): Promise<AnyRiskAssessment> {
    const now = new Date().toISOString();
    const payload = {
      ...assessment,
      updatedAt: now,
      createdAt: assessment.createdAt || now
    };
    
    const result = await apiDb.saveRiskAssessment(payload);
    return result || payload;
  },

  async deleteAssessment(id: string) {
    try {
      await apiDb.deleteRiskAssessment(id);
    } catch (e) {
      console.warn('Failed to delete risk assessment from database:', e);
    }
  },

  async getAssessmentById(id: string): Promise<AnyRiskAssessment | undefined> {
    const list = await this.getAssessments();
    return list.find(a => a.id === id || (a as any).id === Number(id));
  },

  async getAssessmentsByMethod(method: RiskMethod): Promise<AnyRiskAssessment[]> {
    const list = await this.getAssessments();
    return list.filter(a => a.method === method);
  }
};
