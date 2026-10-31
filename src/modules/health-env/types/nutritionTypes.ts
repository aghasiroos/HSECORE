export type NutritionBmiCategory = 
  | 'underweight' // BMI < 18.5
  | 'normal'      // 18.5 - 24.9
  | 'overweight'  // 25.0 - 29.9
  | 'obese_1'     // 30.0 - 34.9
  | 'obese_2'     // 35.0 - 39.9
  | 'obese_3';    // >= 40.0

export type DietGoal = 
  | 'weight_loss'              // کاهش وزن و چربی‌سوزی
  | 'weight_gain'              // افزایش وزن و حجم عضلانی
  | 'weight_maintenance'       // تثبیت وزن و تعادل تغذیه‌ای
  | 'fatty_liver_reversal'     // رژیم پاکسازی و بهبود کبد چرب
  | 'diabetes_control'         // کنترل قند و حساسیت به انسولین
  | 'hypertension_dash'        // رژیم کاهش فشار خون (DASH)
  | 'shift_work_optimization'  // تنظیم وعده‌ها برای شیفت‌کاران و نوبت‌کاری
  | 'general_wellness';        // ارتقای سطح سلامت عمومی و انرژی

export type FastFoodFrequency = 'never' | 'rarely' | 'weekly_1_2' | 'weekly_3_plus' | 'daily';
export type SugaryDrinksFrequency = 'never' | 'rarely' | 'weekly' | 'daily';
export type SaltIntakeLevel = 'low' | 'moderate' | 'high';
export type FatOilPreference = 'olive_liquid' | 'solid_animal' | 'fried' | 'balanced';
export type MealTimingPattern = 'regular_3_meals' | 'skips_breakfast' | 'late_night_eating' | 'shift_irregular';
export type CaffeineIntakeLevel = 'low' | 'moderate' | 'high';
export type PhysicalActivityLevel = 'sedentary' | 'light' | 'moderate' | 'heavy';
export type FattyLiverGrade = 'none' | 'grade_1' | 'grade_2' | 'grade_3';

export type ConsultationType = 
  | 'initial_assessment'    // ارزیابی و مشاوره اولیه
  | 'routine_follow_up'     // پیگیری و ارزیابی دوره‌ای
  | 'special_condition'     // شرایط خاص متابولیک و بیماری
  | 'shift_worker_consult'; // مشاوره تخصصی شیفت کاری و شب‌کاری

export type FollowUpStatus = 'pending' | 'in_progress' | 'achieved' | 'missed';
export type NutritionPriority = 'routine' | 'high_risk' | 'urgent';

export interface NutritionRecord {
  id: string;
  recordNumber: string; // e.g. NUT-14050720-1042
  visitDate: string;    // شمسی e.g. 1405/07/20
  visitTime?: string;   // e.g. 10:15
  shift?: string;       // عادی‌کار، شیفت روز، شیفت شب، نوبت‌کاری ۱۲ ساعته، اقماری

  // Personnel Info
  personnelId?: number | string;
  personnelCode: string;
  nationalCode: string;
  fullName: string;
  unit: string;
  department?: string;
  jobTitle: string;
  gender?: 'MALE' | 'FEMALE' | string;
  age?: number;
  phone?: string;

  // 1. Anthropometrics & Body Composition (تن‌سنجی)
  height: number;              // cm (قد)
  weight: number;              // kg (وزن)
  bmi: number;                 // شاخص توده بدنی
  bmiCategory: NutritionBmiCategory;
  waistCircumference?: number; // cm (دور کمر)
  hipCircumference?: number;   // cm (دور باسن)
  whr?: number;                // نسبت دور کمر به باسن (Waist-to-Hip Ratio)
  bodyFatPercentage?: number;  // درصد چربی تخمینی (%)
  systolicBp?: number;         // mmHg فشار خون سیستولیک
  diastolicBp?: number;        // mmHg فشار خون دیاستولیک

  // 2. Dietary Habits Assessment (ارزیابی عادات غذایی)
  waterIntakeLiters?: number;          // مصرف آب روزانه (لیتر)
  fruitVeggieServings?: number;        // سهم مصرف میوه و سبزیجات روزانه
  fastFoodFrequency: FastFoodFrequency;
  sugaryDrinksFrequency: SugaryDrinksFrequency;
  saltIntake: SaltIntakeLevel;
  fatOilPreference: FatOilPreference;
  mealTimingPattern: MealTimingPattern;
  caffeineIntake: CaffeineIntakeLevel;
  physicalActivityLevel: PhysicalActivityLevel;
  dietaryHabitNotes?: string;

  // 3. Health Biomarkers & Metabolic Conditions (شاخص‌های متابولیک و آزمایشگاهی)
  fbs?: number;                // قند خون ناشتا (mg/dL)
  cholesterol?: number;        // کلسترول تام (mg/dL)
  triglycerides?: number;      // تری‌گلیسرید (mg/dL)
  hdl?: number;                // HDL (mg/dL)
  ldl?: number;                // LDL (mg/dL)
  fattyLiverGrade: FattyLiverGrade;
  uricAcid?: number;           // اسید اوریک (mg/dL)
  underlyingConditions: string[]; // ['دیابت', 'فشار خون', 'کبد چرب', 'نقرس', 'دیس‌لیپیدمی', 'سندرم متابولیک', ...]

  // 4. Nutrition Care Plan & Recommendations (برنامه و توصیه‌های تغذیه‌ای)
  dietGoal: DietGoal;
  targetWeight?: number;       // وزن هدف (kg)
  dailyCalorieTarget?: number; // کالری هدف روزانه (kcal)
  dietPlanSummary: string;     // الگوی رژیم پیشنهادی
  recommendations: string[];   // توصیه‌های کاربردی متناسب با شیفت و کار
  supplements?: string;        // مکمل‌های تغذیه‌ای پیشنهادی (ویتامین D، مولتی‌ویتامین و ...)

  // 5. Consultation & Follow-up (مشاوره و پیگیری)
  consultationType: ConsultationType;
  consultantName: string;      // نام کارشناس مشاور تغذیه
  consultationNotes: string;   // شرح جلسه و بررسی روند پیشرفت
  followUpStatus: FollowUpStatus;
  nextFollowUpDate?: string;   // تاریخ مراجعه بعدی (شمسی)
  priority: NutritionPriority; // روتین، پرخطر، اورژانسی

  // System Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface NutritionStatistics {
  totalRecords: number;
  totalUniquePersonnel: number;
  bmiDistribution: {
    underweight: number;
    normal: number;
    overweight: number;
    obese: number; // sum of obese_1, obese_2, obese_3
  };
  fattyLiverDistribution: {
    none: number;
    grade_1: number;
    grade_2: number;
    grade_3: number;
  };
  priorityDistribution: {
    routine: number;
    high_risk: number;
    urgent: number;
  };
  activeFollowUpsCount: number;
  highRiskCount: number;
  topGoals: { goal: DietGoal; count: number }[];
  unitBreakdown: { unit: string; count: number }[];
}

export interface NutritionFilterState {
  searchQuery: string;
  unit: string;
  bmiCategory: string;
  dietGoal: string;
  priority: string;
  followUpStatus: string;
  fattyLiverGrade: string;
  dateFrom: string;
  dateTo: string;
}

export type HighRiskCategoryType = 
  | 'all'
  | 'bmi_overweight'  // اضافه‌وزن (BMI 25 - 29.9)
  | 'bmi_obese_1'     // چاقی درجه ۱ (BMI 30 - 34.9)
  | 'bmi_obese_2'     // چاقی درجه ۲ (BMI 35 - 39.9)
  | 'bmi_obese_3'     // چاقی درجه ۳ / مفرط (BMI >= 40)
  | 'bmi_obese'       // چاقی عمومی (BMI >= 30)
  | 'hypertension'    // فشار خون بالا (سیستولیک/دیاستولیک غیرطبیعی)
  | 'hyperglycemia'   // قند خون بالا (ناشتا FBS، تصادفی BS، و HbA1c)
  | 'fatty_liver'     // کبد چرب گرید ۲ و ۳
  | 'clinical_urgent' // سطح اولویت بالینی فوری / پرخطر
  | 'followup_due'    // موعد پیگیری فرارسیده یا معوق
  | 'needs_review';   // نتایج فاقد اطلاعات معتبر یا واحد نامشخص (نیازمند بررسی)

export interface HighRiskCategoryMatch {
  category: 
    | 'bmi_overweight'
    | 'bmi_obese_1'
    | 'bmi_obese_2'
    | 'bmi_obese_3'
    | 'bmi_obese'
    | 'hypertension'
    | 'hyperglycemia'
    | 'fatty_liver'
    | 'clinical_urgent'
    | 'followup_due'
    | 'needs_review';
  categoryLabelFa: string;
  severity: 'critical' | 'high' | 'moderate';
  detailsFa: string;
  valueBadge?: string;
  subType?: string;
}

export interface HighRiskPersonnelProfile {
  id: string; // Unique key e.g. `hr-${personnelCode}`
  personnelCode: string;
  nationalCode: string;
  fullName: string;
  unit: string;
  department?: string;
  jobTitle: string;
  phone?: string;
  gender?: string;
  age?: number;

  // Matched Risk Categories from exact criteria
  riskCategories: HighRiskCategoryMatch[];
  primaryRiskCategory: HighRiskCategoryType;
  overallPriority: 'urgent' | 'high_risk' | 'routine';

  // Latest Anthropometric Data (from Periodic Exams or Nutrition Dossier)
  height?: number;
  weight?: number;
  bmi: number;
  bmiCategory: NutritionBmiCategory;
  waistCircumference?: number;
  whr?: number;

  // Latest Clinical & Metabolic Data (from Periodic Exams, Lab, or Nutrition Dossier)
  fattyLiverGrade: FattyLiverGrade;
  fattyLiverDetails?: string;
  systolicBp?: number;
  diastolicBp?: number;
  bpMeasurementDate?: string;
  bloodPressureStage?: 'normal' | 'prehypertension' | 'stage_1' | 'stage_2' | 'crisis';
  fbs?: number;
  randomBs?: number;
  hba1c?: number;
  bloodSugarTestType?: 'FBS' | 'BS' | 'HbA1c';
  bloodSugarValue?: number;
  bloodSugarUnit?: string;
  bloodSugarMeasurementDate?: string;
  bloodSugarStage?: 'normal' | 'prediabetes' | 'diabetes';
  cholesterol?: number;
  triglycerides?: number;
  underlyingConditions: string[];
  hasIndeterminateLabResults?: boolean;
  indeterminateLabDetails?: string;

  // Periodic Exam Reference & Full History
  lastExamDate?: string;
  lastExamYear?: number;
  bmiMeasurementDate?: string;
  examFitnessStatus?: string;
  examDoctorVerdict?: string;
  examRecommendations?: string;
  hasPeriodicExamRecord: boolean;
  allExamsHistory?: any[]; // All historical periodic exams for this personnel

  // Nutrition Consultation Reference
  nutritionRecordId?: string;
  hasNutritionRecord: boolean;
  dietGoal?: DietGoal;
  dailyCalorieTarget?: number;
  dietPlanSummary?: string;
  recommendations: string[];
  supplements?: string;
  consultationType?: ConsultationType;
  consultantName?: string;
  consultationNotes?: string;
  lastFollowUpDate?: string;
  lastFollowUpNotes?: string;
  followUpStatus: FollowUpStatus;
  nextFollowUpDate?: string;
  isFollowUpOverdue: boolean;
  daysUntilFollowUp?: number;

  updatedAt: string;
}

