import { StandardReference } from './types.ts';

export interface LiftingStandardDefinition {
  standardCode: string;
  titleFa: string;
  titleEn: string;
  edition: string;
  category: 'ASME' | 'INTERNAL';
  activeClauses: Record<string, string>;
  engineeringFactors: Record<string, number | boolean | string>;
  notes: string;
}

export const DEFAULT_LIFTING_STANDARDS: LiftingStandardDefinition[] = [
  {
    standardCode: 'ASME_P30_1',
    titleFa: 'برنامه‌ریزی عملیات جابه‌جایی و باربرداری مهندسی (Standard vs Critical Lift)',
    titleEn: 'Planning for Load Handling Activities',
    edition: '2024',
    category: 'ASME',
    activeClauses: {
      'Ch. 2': 'Load Handling Plan Categories (Standard vs Engineered / Critical)',
      'Sec. 2-2.2': 'Center of Gravity, Load Weight & Dynamic Allowance Verification',
      'Sec. 2-3.4': 'Multi-Crane / Tandem Lift Derating (75% Capacity Limit)',
      'Sec. 2-4': 'Blind Lift Communication, Dedicated Signaler & Obstruction Control',
    },
    engineeringFactors: {
      standardMaxCraneUtilizationPct: 85,
      criticalLiftThresholdPct: 75,
      tandemMaxCraneUtilizationPct: 75,
      defaultDynamicFactor: 1.1,
      minWindSpeedLimitMs: 13.8,
    },
    notes: 'مرجع اصلی دسته‌بندی باربرداری استاندارد/بحرانی، همزمانی Tandem و کنترل نقاط کور Blind Lift',
  },
  {
    standardCode: 'ASME_B30_20',
    titleFa: 'ادوات زیر قلاب شامل Spreader Beam و Lifting Beam (بازرسی و بهره‌برداری)',
    titleEn: 'Below-the-Hook Lifting Devices',
    edition: '2021',
    category: 'ASME',
    activeClauses: {
      'Sec. 20-1.2': 'Rated Load Marking & Identification Tag',
      'Sec. 20-1.3': 'Frequent and Periodic Inspection Requirements',
    },
    engineeringFactors: {
      periodicInspectionMonths: 12,
    },
    notes: 'الزامات ساخت، پلاک ظرفیت، تست بار و بازرسی تیرهای ترازکننده و شاهین‌های باربرداری',
  },
  {
    standardCode: 'ASME_B30_5',
    titleFa: 'جرثقیل‌های متحرک و لکوموتیوی (Mobile & Locomotive Cranes)',
    titleEn: 'Mobile and Locomotive Cranes',
    edition: '2021',
    category: 'ASME',
    activeClauses: {
      'Sec. 5-1.1': 'Load Ratings & Real Load Chart Verification (Radius × Boom Length)',
      'Sec. 5-2.1': 'Periodic & Frequent Crane Inspections',
      'Sec. 5-3.2': 'Outrigger Support, Levelness, Ground Bearing & Wind Restrictions',
    },
    engineeringFactors: {
      maxOutriggerLevelToleranceDeg: 1.0,
      maxUtilizationStandardPct: 85,
    },
    notes: 'استخراج اجباری ظرفیت فقط از Load Chart واقعی سازنده؛ ممنوعیت حدس ظرفیت بر اساس نام مدل',
  },
  {
    standardCode: 'ASME_B30_9',
    titleFa: 'اسلینگ‌ها (سیم‌بکسلی، زنجیری و تسمه‌ای) و اثر زاویه اسلینگ',
    titleEn: 'Slings (Wire Rope, Alloy Chain, Synthetic Webbing)',
    edition: '2021',
    category: 'ASME',
    activeClauses: {
      'Sec. 9-2.5': 'Design Factor (5:1 Wire Rope, 4:1 Alloy Chain, 5:1 Webbing)',
      'Sec. 9-2.9': 'Sling Angle Factor & 3-Leg Effective Rule on 4-Leg Rigid Lifts',
      'Sec. 9-1.7': 'Minimum Recommended Sling Horizontal Angle (≥ 45°, Absolute Min 30°)',
    },
    engineeringFactors: {
      recommendedMinAngleDeg: 45,
      absoluteMinAngleDeg: 30,
      wireRopeSafetyFactor: 5,
      chainSafetyFactor: 4,
      webbingSafetyFactor: 5,
    },
    notes: 'کنترل زاویه اسلینگ و قاعده تحمل بار روی ۳ شاخه مؤثر در بارهای صلب ۴ نقطه‌ای',
  },
  {
    standardCode: 'ASME_B30_10',
    titleFa: 'قلاب‌های باربرداری (Hooks) و ضامن ایمنی (Safety Latch)',
    titleEn: 'Hooks',
    edition: '2019',
    category: 'ASME',
    activeClauses: {
      'Sec. 10-1.10': 'Hook Latch Requirement & Throat Opening Distortion Limit (5%)',
      'Sec. 10-1.2': 'Side Loading & Tip Loading Prohibitions',
    },
    engineeringFactors: {
      maxThroatOpeningIncreasePct: 5,
    },
    notes: 'کنترل سلامت شیطانک قلاب، تغییر شکل دهانه قلاب و عدم اعمال بار جانبی',
  },
  {
    standardCode: 'ASME_B30_16',
    titleFa: 'بالابرهای سقفی و جرثقیل‌های زنجیری/برقی (Overhead Underhung Hoists)',
    titleEn: 'Overhead Underhung and Stationary Hoists',
    edition: '2022',
    category: 'ASME',
    activeClauses: {
      'Sec. 16-1.2': 'Rated Load & Upper/Lower Limit Switches',
      'Sec. 16-2': 'Frequent/Periodic Brake & Chain Inspection',
    },
    engineeringFactors: {
      proofTestMultiplier: 1.25,
    },
    notes: 'پوشش بالابرها و هویست‌های سقفی کارگاهی و پروسس مجتمع',
  },
  {
    standardCode: 'ASME_B30_26',
    titleFa: 'سخت‌افزارهای ریگری (شگل، آیبولت، مهارکش و مسترلینک)',
    titleEn: 'Rigging Hardware (Shackles, Eyebolts, Turnbuckles, Links)',
    edition: '2020',
    category: 'ASME',
    activeClauses: {
      'Sec. 26-1.4': 'Shackle WLL, Pin Engagement & Angular Derating (>5° / 45° / 90°)',
      'Sec. 26-2.4': 'Eyebolt Angular Reduction',
    },
    engineeringFactors: {
      angularDerating45DegFactor: 0.7,
      angularDerating90DegFactor: 0.5,
    },
    notes: 'کاهش ظرفیت شگل در بارگذاری زاویه‌ای و کنترل تطابق پین اصلی',
  },
  {
    standardCode: 'ASME_B30_30',
    titleFa: 'طناب‌ها و سیم‌بکسل‌های فولادی و الیافی (Ropes)',
    titleEn: 'Ropes (Wire Rope & Synthetic Fiber Rope)',
    edition: '2019',
    category: 'ASME',
    activeClauses: {
      'Sec. 30-1.7': 'D/d Bending Ratio Efficiency & Termination Efficiency',
      'Sec. 30-2': 'Broken Wire & Abrasion Rejection Criteria',
    },
    engineeringFactors: {
      minSheaveDdRatio: 16,
    },
    notes: 'بازرسی سلامت سیم‌بکسل و ضریب کارایی نسبت خمش D/d',
  },
];

export function makeStandardRef(
  code: string,
  clause: string,
  descriptionFa: string,
  overrides?: Record<string, { edition?: string; factors?: Record<string, any> }>
): StandardReference {
  const def = DEFAULT_LIFTING_STANDARDS.find((s) => s.standardCode === code);
  const edition = overrides?.[code]?.edition || def?.edition || 'Current';
  return {
    standardCode: code.replace(/_/g, ' ').replace('P30 1', 'P30.1').replace('BTH 1', 'BTH-1').replace('B30 ', 'B30.'),
    edition,
    clause,
    descriptionFa,
    descriptionEn: def?.titleEn,
  };
}
