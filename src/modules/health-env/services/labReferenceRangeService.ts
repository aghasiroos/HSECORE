import { GlobalLabReferenceRange, LabResultStatus } from '../types';

const STORAGE_KEY = 'hse_lab_reference_ranges_v1';

export const INITIAL_LAB_REFERENCES: GlobalLabReferenceRange[] = [
  {
    id: 'ref-fbs',
    testName: 'FBS (قند خون ناشتا)',
    testCode: 'LAB-FBS',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 70,
    maxRef: 100,
    criticalMin: 50,
    criticalMax: 126,
    refSource: 'دستورالعمل کشوری طب کار / WHO',
    description: 'محدوده ناشتایی طبیعی؛ بالای ۱۲۶ احتمال دیابت',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-chol',
    testName: 'Cholesterol (کلسترول کل)',
    testCode: 'LAB-CHOL',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 120,
    maxRef: 200,
    criticalMax: 240,
    refSource: 'National Cholesterol Education Program (NCEP)',
    description: 'بالای ۲۰۰ نیازمند اصلاح رژیم و پایش عروقی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-tg',
    testName: 'Triglyceride (تری‌گلیسرید)',
    testCode: 'LAB-TG',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 50,
    maxRef: 150,
    criticalMax: 200,
    refSource: 'NCEP ATP III Guidelines',
    description: 'چربی ناشتا؛ بالای ۲۰۰ ریسک کبد چرب و عروقی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-hdl',
    testName: 'HDL (کلسترول خوب)',
    testCode: 'LAB-HDL',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 40,
    maxRef: 60,
    refSource: 'AHA / NCEP',
    description: 'سطح حمایتی عروقی؛ کمتر از ۴۰ عامل خطر محسوب می‌شود',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-ldl',
    testName: 'LDL (کلسترول بد)',
    testCode: 'LAB-LDL',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 50,
    maxRef: 130,
    criticalMax: 160,
    refSource: 'AHA / NCEP',
    description: 'محدوده هدف؛ بالای ۱۶۰ نیازمند مشاوره پزشکی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-hb-male',
    testName: 'Hemoglobin (هموگلوبین - آقایان)',
    testCode: 'LAB-HB-M',
    unit: 'g/dL',
    gender: 'مرد',
    minRef: 13.5,
    maxRef: 17.5,
    criticalMin: 10.0,
    criticalMax: 19.0,
    refSource: 'استا‌ندارد طب کار و خون‌شناسی',
    description: 'سنجش آنمی و پلی‌سیتمی در شاغلین آقایان',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-hb-female',
    testName: 'Hemoglobin (هموگلوبین - بانوان)',
    testCode: 'LAB-HB-F',
    unit: 'g/dL',
    gender: 'زن',
    minRef: 12.0,
    maxRef: 15.5,
    criticalMin: 9.5,
    criticalMax: 17.5,
    refSource: 'استاندارد طب کار و خون‌شناسی',
    description: 'سنجش آنمی در شاغلین خانم',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-wbc',
    testName: 'WBC (گلبول‌های سفید)',
    testCode: 'LAB-WBC',
    unit: '/uL',
    gender: 'همه',
    minRef: 4000,
    maxRef: 11000,
    criticalMin: 2500,
    criticalMax: 18000,
    refSource: 'CBC Standard Reference',
    description: 'ارزیابی عفونت و ایمنی بدن',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-platelets',
    testName: 'Platelets (پلاکت خون)',
    testCode: 'LAB-PLT',
    unit: '/uL',
    gender: 'همه',
    minRef: 150000,
    maxRef: 450000,
    criticalMin: 80000,
    criticalMax: 600000,
    refSource: 'Hematology Occupational Guidelines',
    description: 'انعقاد خون و ایمنی شغلی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-alt',
    testName: 'ALT / SGPT (آنزیم کبد)',
    testCode: 'LAB-ALT',
    unit: 'IU/L',
    gender: 'همه',
    minRef: 7,
    maxRef: 56,
    criticalMax: 120,
    refSource: 'AASLD Hepatology Guidelines',
    description: 'مواجهه با حلال‌ها و سلامت سلول‌های کبدی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-ast',
    testName: 'AST / SGOT (آنزیم کبد)',
    testCode: 'LAB-AST',
    unit: 'IU/L',
    gender: 'همه',
    minRef: 10,
    maxRef: 40,
    criticalMax: 100,
    refSource: 'AASLD Hepatology Guidelines',
    description: 'آنزیم پارانشیم کبدی و عضله قلبی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-bun',
    testName: 'BUN (اوره‌خون)',
    testCode: 'LAB-BUN',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 7,
    maxRef: 20,
    criticalMax: 40,
    refSource: 'Renal Panel Standards',
    description: 'پایش عملکرد کلیه و دهیدراتاسیون شغلی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-cr',
    testName: 'Creatinine (کراتینین)',
    testCode: 'LAB-CR',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 0.7,
    maxRef: 1.3,
    criticalMax: 2.0,
    refSource: 'KDIGO Renal Guidelines',
    description: 'پایش دقیق فیلتراسیون کلیه و سموم صنعتی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-uric',
    testName: 'Uric Acid (اسید اوریک)',
    testCode: 'LAB-URIC',
    unit: 'mg/dL',
    gender: 'همه',
    minRef: 3.5,
    maxRef: 7.2,
    refSource: 'Rheumatology Lab Guide',
    description: 'پایش نقرس و متابولیسم سلولی',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  },
  {
    id: 'ref-tsh',
    testName: 'TSH (تیروئید)',
    testCode: 'LAB-TSH',
    unit: 'mIU/L',
    gender: 'همه',
    minRef: 0.4,
    maxRef: 4.0,
    refSource: 'Endocrine Society Guidelines',
    description: 'هورمون محرک تیروئید',
    isEditable: true,
    updatedAt: '1404/01/01',
    updatedBy: 'مدیر ارشد سیستم'
  }
];

export class LabReferenceRangeService {
  private ranges: GlobalLabReferenceRange[] = [];

  constructor() {
    this.loadRanges();
  }

  private loadRanges(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.ranges = parsed;
          return;
        }
      }
    } catch (_) {}

    this.ranges = [...INITIAL_LAB_REFERENCES];
    this.saveRanges();
  }

  public saveRanges(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ranges));
    } catch (e) {
      console.error('Error saving lab reference ranges', e);
    }
  }

  public getAllRanges(): GlobalLabReferenceRange[] {
    return [...this.ranges];
  }

  public findReferenceForTest(testName: string, gender: string = 'همه'): GlobalLabReferenceRange | null {
    if (!testName) return null;

    const clean = testName.trim().toLowerCase();
    // 1. Try matching testName or testCode
    const genderMatch = this.ranges.find(r => {
      const matchName = r.testName.toLowerCase().includes(clean) || clean.includes(r.testName.toLowerCase());
      const matchGender = r.gender === 'همه' || r.gender === gender;
      return matchName && matchGender;
    });

    if (genderMatch) return genderMatch;

    return this.ranges.find(r => r.testName.toLowerCase().includes(clean) || clean.includes(r.testName.toLowerCase())) || null;
  }

  public evaluateValueStatus(
    val: number | undefined,
    textVal: string | undefined,
    refRange: { minRef: number; maxRef: number; criticalMin?: number; criticalMax?: number } | null
  ): LabResultStatus {
    if (val === undefined || val === null || isNaN(val)) {
      if (textVal) {
        const cleanT = textVal.trim().toLowerCase();
        if (cleanT.includes('نرمال') || cleanT.includes('normal') || cleanT.includes('منفی') || cleanT.includes('negative')) {
          return 'Normal';
        }
        if (cleanT.includes('غیرنرمال') || cleanT.includes('abnormal') || cleanT.includes('مثبت') || cleanT.includes('positive')) {
          return 'Abnormal';
        }
      }
      return 'Not Evaluated';
    }

    if (!refRange) return 'Not Evaluated';

    if (refRange.criticalMax && val >= refRange.criticalMax) return 'Critical';
    if (refRange.criticalMin && val <= refRange.criticalMin) return 'Critical';

    if (val > refRange.maxRef) return 'High';
    if (val < refRange.minRef) return 'Low';

    return 'Normal';
  }

  public addOrUpdateRange(range: GlobalLabReferenceRange, user: string): void {
    const existingIndex = this.ranges.findIndex(r => r.id === range.id);
    const updatedRecord = {
      ...range,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
      updatedBy: user || 'Administrator'
    };

    if (existingIndex >= 0) {
      this.ranges[existingIndex] = updatedRecord;
    } else {
      this.ranges.push(updatedRecord);
    }

    this.saveRanges();
  }

  public deleteRange(id: string): void {
    this.ranges = this.ranges.filter(r => r.id !== id);
    this.saveRanges();
  }

  public resetToDefault(): void {
    this.ranges = [...INITIAL_LAB_REFERENCES];
    this.saveRanges();
  }
}

export const labReferenceRangeService = new LabReferenceRangeService();
