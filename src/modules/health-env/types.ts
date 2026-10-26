import { PeriodicIntervalType } from '../../utils/inspectionScheduleHelper';

export type MedicalExamStatus = 
  | 'fit'                    // مناسب کار بدون محدودیت
  | 'fit_with_limitations'   // مناسب کار با محدودیت
  | 'needs_specialist'       // نیازمند ارزیابی تخصصی
  | 'unfit'                  // نامناسب برای شغل فعلی
  | 'under_review';          // در حال بررسی

export type MedicalExamType = 
  | 'دوره‌ای سالانه'
  | 'بدو استخدام'
  | 'ادواری اختصاصی'
  | 'بازگشت به کار'
  | 'تغییر شغل'
  | 'شکایت پزشکی و ارزیابی ناهنجاری';

export type NonPeriodicReason = 
  | 'بازگشت به کار پس از مرخصی استعلاجی'
  | 'بازگشت به کار پس از حادثه شغلی'
  | 'معاینه بدو استخدام'
  | 'تغییر عنوان شغلی / پست سازمانی'
  | 'معاینه شکایت پزشکی و علائم بالینی'
  | 'بررسی مواجهه حاد با آلاینده‌های شغلی'
  | 'ارزیابی کمیسیون پزشکی';

export interface MedicalFindings {
  vision?: string;            // بینایی‌سنجی (اپتومتری)
  audiometry?: string;        // شنوایی‌سنجی (ادیومتری)
  spirometry?: string;        // عملکرد ریه (اسپیرومتری)
  ecg?: string;               // نوار قلب (الکتروکاردیوگرام)
  bloodTests?: string;        // آزمایش‌های خون و بیوشیمی
  bloodPressure?: string;     // فشار خون (سیستولیک/دیاستولیک)
  heightCm?: number;          // قد (سانتی‌متر)
  weightKg?: number;          // وزن (کیلوگرم)
  bmi?: number;               // شاخص توده بدنی
  generalConclusion?: string; // نتیجه‌گیری نهایی پزشک طب کار
}

export interface MedicalExamAttachment {
  id: string;
  examId: string;
  recordId: string;
  examYear: number;
  originalFileName: string;
  displayName: string;
  description: string;
  fileType: 'pdf' | 'jpg' | 'jpeg' | 'png' | 'other';
  mimeType: string;
  fileSize: number; // in bytes
  fileSizeFormatted: string; // e.g. "1.2 MB"
  fileData?: string; // Base64 data URL for preview and download
  filePath?: string; // Physical storage reference
  uploadedAt: string;
  uploadedBy: string;
}

export interface PeriodicMedicalExam {
  id: string;
  recordId: string;
  employeeCode: string;
  examYear: number;           // e.g. 1404
  examDate: string;           // e.g. "1404/02/15"
  examType: MedicalExamType;
  medicalCenter: string;      // e.g. "مرکز طب کار و سلامت شغلی صنعت نفت"
  doctor: string;             // e.g. "دکتر سهرابی"
  status: MedicalExamStatus;
  findings: MedicalFindings;
  recommendations: string;
  description: string;
  attachmentsCount?: number;
  importBatchId?: string;
  importFileName?: string;
  importSource?: 'Excel' | 'PDF' | 'Manual' | 'HTM';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface NonPeriodicMedicalExam {
  id: string;
  recordId: string;
  employeeCode: string;
  employeeName: string;
  nationalCode: string;
  department: string;
  jobTitle: string;
  examDate: string;           // e.g. "1404/04/10"
  reason: NonPeriodicReason;
  examType: MedicalExamType;
  medicalCenter: string;
  doctor: string;
  status: MedicalExamStatus;
  clinicalSymptoms?: string;
  findings: MedicalFindings;
  recommendations: string;
  description: string;
  returnToWorkDate?: string;
  limitations?: string;
  attachmentsCount?: number;
  attachments?: MedicalExamAttachment[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ChronicCondition {
  id: string;
  conditionName: string;
  diagnosedYear: number;
  treatmentStatus: string;
  medications?: string;
  restrictions?: string;
}

export interface HealthRiskFactor {
  hazardType: 'صدا' | 'شیمیایی' | 'ارگونومی' | 'استرس گرمایی' | 'نوبت‌کاری' | 'پرتو' | 'سایر';
  intensity: 'پایین' | 'متوسط' | 'بالا' | 'بحرانی';
  ppeRequired: string;
  controlMeasure: string;
}

export interface PeriodicMedicalRecord {
  id: string;
  employeeId: string;         // Master ID from personnel dataset
  employeeCode: string;       // Unique code (personnel code / national code)
  nationalCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  department: string;
  jobTitle: string;
  birthDate: string;
  age: number;
  phone: string;
  education?: string;
  maritalStatus?: string;
  bloodType?: string;
  isComplete: boolean;        // آیا پرونده کامل است؟
  chronicConditions?: ChronicCondition[];
  riskFactors?: HealthRiskFactor[];
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

// -------------------------------------------------------------
// ENVIRONMENT MODULE TYPES
// -------------------------------------------------------------

export type EnvMonitoringType = 'air' | 'stacks' | 'water' | 'wastewater' | 'soil' | 'noise';
export type ComplianceStatus = 'compliant' | 'non_compliant' | 'warning' | 'under_review';

export interface EnvMonitoringRecord {
  id: string;
  monitoringType: EnvMonitoringType;
  stationOrLocation: string;
  site: string;
  department?: string;
  date: string;               // Jalali date e.g. "1404/03/15"
  parameter: string;          // e.g. "PM2.5", "BOD5", "CO", "Lead", "Noise Level"
  measuredValue: number;
  unit: string;               // e.g. "ppm", "mg/L", "µg/m³", "dBA"
  standardLimit: number;
  limitType: 'max' | 'min';   // usually 'max' (should be <= standardLimit)
  complianceStatus: ComplianceStatus;
  laboratory: string;         // e.g. "آزمایشگاه معتمد محیط زیست"
  inspector: string;
  description?: string;
  sampleId?: string;
  hasAttachment?: boolean;
  attachmentName?: string;
  createdAt: string;
  updatedAt: string;
}

export type WasteCategory = 
  | 'پسماند خطرناک (Hazardous)'
  | 'پسماند صنعتی غیرخطرناک'
  | 'پسماند قابل بازیافت'
  | 'پسماند عادی و بهداشتی'
  | 'پسماند بیولوژیک / بهداری';

export type WasteStatus = 
  | 'تولید و دپو موقت'
  | 'در حال تفکیک و بسته‌بندی'
  | 'آماده بارگیری و حمل'
  | 'تحویل پیمانکار مجاز'
  | 'امحاء نهایی در لندفیل ویژه'
  | 'بازیافت کامل';

export interface WasteRecord {
  id: string;
  code: string;               // e.g. "HW-101"
  title: string;
  category: WasteCategory;
  quantity: number;
  unit: 'تن (Ton)' | 'کیلوگرم (Kg)' | 'بشکه (Drum)' | 'متر مکعب (m³)';
  productionDate: string;
  originLocation: string;     // e.g. "واحد پلیمریزاسیون - مخزن T-201"
  department: string;
  storageMethod: string;      // e.g. "انبار مسقف پسماند ویژه با حوضچه مهار"
  disposalOrTransferMethod: string; // e.g. "زباله‌سوز صنعتی مجاز / بازیافت"
  contractor: string;         // e.g. "شرکت بازیافت و پسماند پاک‌زیست"
  manifestNo?: string;        // مانیفست سامانه جامع محیط‌زیست (EMP)
  status: WasteStatus;
  isHazardous: boolean;
  notes?: string;
  hasManifestDoc?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WastewaterRecord {
  id: string;
  samplingPoint: string;      // e.g. "خروجی تصفیه‌خانه صنعتی ETP", "حوضچه آرامش"
  date: string;
  parameter: string;          // "COD", "BOD5", "TSS", "pH", "Oil & Grease", "TDS", "Phosphate"
  measuredValue: number;
  unit: string;
  standardLimit: number;
  complianceStatus: ComplianceStatus;
  laboratory?: string;
  dischargeDestination: string; // e.g. "خلیج فارس", "شبکه آبیاری فضای سبز", "چاه جاذب"
  dailyFlowRateM3?: number;
  inspector?: string;
  notes?: string;
  createdAt: string;
}

export interface AirQualityRecord {
  id: string;
  stationName: string;
  date: string;
  lastUpdated?: string;
  aqi: number;
  aqiCategory: 'پاک' | 'سالم' | 'ناسالم برای گروه‌های حساس' | 'ناسالم' | 'بسیار ناسالم' | 'خطرناک';
  pm25: number;               // µg/m³ (limit: 35)
  pm10: number;               // µg/m³ (limit: 150)
  so2: number;                // ppb (limit: 75)
  no2: number;                // ppb (limit: 100)
  co: number;                 // ppm (limit: 9)
  voc: number;                // ppm (limit: 5)
  status: ComplianceStatus;
}

export type AirQualityStation = AirQualityRecord;

export interface WaterSoilRecord {
  id: string;
  type: 'water' | 'soil';
  location: string;
  date: string;
  parameter: string;          // e.g. "EC", "Turbidity", "Heavy Metal (Pb)", "TPH (Total Petroleum Hydrocarbons)"
  measuredValue: number;
  unit: string;
  standardLimit: number;
  complianceStatus: ComplianceStatus;
  laboratory: string;
  notes?: string;
}

// -------------------------------------------------------------
// NON-CONFORMANCE & CORRECTIVE ACTION (CAPA)
// -------------------------------------------------------------

export type NonConformanceCategory = 'بهداشت شغلی' | 'محیط زیست' | 'پسماند' | 'پساب' | 'کیفیت هوا' | 'پایش سلامت';
export type NonConformanceSeverity = 'بحرانی (Critical)' | 'بالا (High)' | 'متوسط (Medium)' | 'متوسط' | 'جزئی' | 'پایین (Low)';
export type SeverityLevel = NonConformanceSeverity;
export type NonConformanceStatus = 'باز (Open)' | 'باز (در دست پیگیری)' | 'در حال بررسی' | 'در حال اقدام اصلاحی' | 'اقدام اصلاحی تعریف‌شده' | 'انجام شده و در انتظار ممیزی' | 'بسته شده (Closed)' | 'بسته شده (مختومه)';

export interface CorrectiveAction {
  id: string;
  title: string;
  assignedTo: string;
  dueDate: string;
  progressPercent: number;    // 0 to 100
  completionDate?: string;
  actionDetails: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  verificationNotes?: string;
}

export interface EnvHealthNonConformance {
  id: string;
  trackingCode?: string;       // e.g. "NC-HE-1404-012"
  title: string;
  category: NonConformanceCategory | string;
  domain?: 'health' | 'environment';
  severity: NonConformanceSeverity | SeverityLevel;
  location?: string;
  unitOrLocation?: string;
  department?: string;
  identifiedDate?: string;
  reportedDate?: string;
  identifiedBy?: string;
  reportedBy?: string;
  description: string;
  rootCause?: string;
  correctiveAction?: string | CorrectiveAction;
  responsiblePerson?: string;
  dueDate?: string;
  status: NonConformanceStatus;
  relatedRecordId?: string;
  createdAt: string;
  updatedAt: string;
}

export type EnvNonConformance = EnvHealthNonConformance;

export interface MedicalAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  recordId?: string;
  examYear?: number;
}

// -------------------------------------------------------------
// 5S SYSTEM TYPES & INTERFACES
// -------------------------------------------------------------

export type FiveSPillarKey = 'seiri' | 'seiton' | 'seiso' | 'seiketsu' | 'shitsuke';

export interface FiveSPillarDef {
  key: FiveSPillarKey;
  number: number;
  titleFa: string;
  titleEn: string;
  persianName: string; // ساماندهی، نظم، پاکیزگی، استاندارد، انضباط
  description: string;
  color: string;
}

export type FiveSItemStatus = 
  | 'fully_compliant'    // کاملاً منطبق (100%)
  | 'compliant'          // منطبق (75%)
  | 'needs_improvement'  // نیازمند بهبود (50%)
  | 'non_compliant'      // نامنطبق (0%)
  | 'not_applicable';    // غیرقابل اعمال (NA)

export interface FiveSPhoto {
  id: string;
  title: string;
  description?: string;
  fileData: string; // Base64 data URL
  originalFileName?: string;
  fileSizeFormatted?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface FiveSChecklistItem {
  id: string;
  pillar: FiveSPillarKey;
  itemNumber: number;
  title: string;
  description: string;
  status: FiveSItemStatus;
  score: number; // 0..100
  weight: number; // default 1
  remarks?: string;
  photos: FiveSPhoto[];
  hasNonConformance?: boolean;
  nonConformanceId?: string;
  correctiveActionText?: string;
}

export interface FiveSInspection {
  id: string;
  inspectionNumber: string; // e.g. "5S-1404-001"
  date: string; // e.g. "1404/05/10"
  time?: string; // e.g. "10:30"
  department: string; // e.g. "واحد الفین", "انبار مرکزی"
  location: string; // e.g. "محوطه پمپ‌ها و تجهیزات دوار"
  inspector: string; // e.g. "مهندس رضایی"
  supervisor: string; // e.g. "مهندس عبادیکیا"
  inspectionType: 'دوره‌ای' | 'قبل از عملیات' | 'بعد از عملیات' | 'موردی / ویژه' | 'موردی' | 'ممیزی جامع' | 'ممیزی مدیریتی' | string;
  periodicInterval?: PeriodicIntervalType | string;
  nextInspectionDate?: string;
  relatedOperationId?: string;
  relatedOperationTitle?: string;
  overallNotes?: string;
  items: FiveSChecklistItem[];
  scores: {
    seiri: number;      // 0..100
    seiton: number;     // 0..100
    seiso: number;      // 0..100
    seiketsu: number;   // 0..100
    shitsuke: number;   // 0..100
    total: number;      // 0..100
  };
  generalRating: 'عالی' | 'خوب' | 'قابل قبول' | 'نیازمند بهبود' | 'ضعیف';
  status: 'draft' | 'completed' | 'approved' | 'under_review';
  nonConformancesCount: number;
  openActionsCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  inspectionHistory?: Array<{
    id: string;
    timestamp: string;
    changedBy: string;
    action: string;
    inspectionDate: string;
    newNextDueDate?: string;
    inspectionType: string;
    relatedOperationId?: string;
    notes?: string;
  }>;
}

export interface FiveSCorrectiveAction {
  id: string;
  ncId: string;
  description: string;
  responsible: string;
  startDate: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'completed' | 'verified' | 'overdue';
  progressPercent: number; // 0 to 100
  notes?: string;
  proofPhotos?: FiveSPhoto[];
  completionDate?: string;
  verifiedBy?: string;
  verificationDate?: string;
}

export interface FiveSNonConformance {
  id: string;
  trackingCode: string; // e.g. "5S-NC-1404-01"
  inspectionId?: string;
  inspectionNumber?: string;
  checklistItemId?: string;
  pillar: FiveSPillarKey;
  title: string;
  description: string;
  location: string;
  department: string;
  severity: 'بحرانی (Critical)' | 'بالا (High)' | 'متوسط (Medium)' | 'پایین (Low)';
  photo?: FiveSPhoto;
  responsiblePerson: string;
  dueDate: string;
  status: 'open' | 'in_progress' | 'completed' | 'verified_closed' | 'overdue';
  correctiveAction?: FiveSCorrectiveAction;
  identifiedDate: string;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiveSSchedule {
  id: string;
  department: string;
  location: string;
  frequency: 'هفتگی' | 'دو هفته یکبار' | 'ماهانه' | 'فصلی' | 'سالانه';
  inspector: string;
  scheduledDate: string; // e.g. "1404/06/15"
  status: 'scheduled' | 'completed' | 'overdue' | 'postponed';
  completedInspectionId?: string;
  notes?: string;
  createdAt: string;
}

export interface FiveSUnitRanking {
  rank: number;
  department: string;
  totalInspections: number;
  lastInspectionDate: string;
  averageScore: number;
  seiriScore: number;
  seitonScore: number;
  seisoScore: number;
  seiketsuScore: number;
  shitsukeScore: number;
  rating: 'عالی' | 'خوب' | 'قابل قبول' | 'نیازمند بهبود' | 'ضعیف';
  totalNCs: number;
  openNCs: number;
}

// -------------------------------------------------------------
// STRUCTURED LAB TEST & OCCUPATIONAL HEALTH AUDIT TYPES
// -------------------------------------------------------------

export type LabResultStatus = 'Normal' | 'Low' | 'High' | 'Critical' | 'Abnormal' | 'Not Evaluated';

export interface StructuredLabResult {
  id: string;
  examId: string;
  recordId: string;
  employeeCode: string;
  employeeName?: string;
  testName: string;            // e.g. "FBS", "Cholesterol", "Triglyceride", "Hb", "WBC", "ALT", "AST", "Audiometry"
  testCode: string;            // e.g. "LAB-001"
  numericValue?: number;
  textValue?: string;          // e.g. "Normal", "Negative", "Mild Hearing Loss"
  unit: string;                // e.g. "mg/dL", "g/dL", "/uL", "IU/L", "dB", "%"
  minReference: number;
  maxReference: number;
  refSource: string;           // e.g. "WHO", "OSHA", "Standard Lab", "Iranian Occupational Health"
  examYear: number;            // e.g. 1405
  examDate: string;            // e.g. "1405/02/10"
  resultStatus: LabResultStatus;
  importBatchId?: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface GlobalLabReferenceRange {
  id: string;
  testName: string;
  testCode: string;
  unit: string;
  gender: 'مرد' | 'زن' | 'همه';
  minAge?: number;
  maxAge?: number;
  minRef: number;
  maxRef: number;
  criticalMin?: number;
  criticalMax?: number;
  refSource: string;
  description?: string;
  isEditable: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface ImportAuditLogRecord {
  id: string;
  timestamp: string;
  importedBy: string;
  userRole: string;
  fileName: string;
  examYear: number;
  sourceType: 'Excel' | 'PDF' | 'Manual' | 'HTM';
  totalRecords: number;
  successfulCount: number;
  failedCount: number;
  matchedPersonnelCount: number;
  unmatchedPersonnelCount: number;
  duplicateCount: number;
  invalidResultCount: number;
  manualReviewNeededCount: number;
  createdRecordsSummary?: string[];
  updatedRecordsSummary?: string[];
  importedExamIds?: string[];
  affectedRecordIds?: string[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  errorDetails: { rowNumber?: number; personnelCode?: string; errorText: string }[];
}

export interface ExcelImportRowPreview {
  rowId: number;
  rawPersonnelCode: string;
  rawFullName: string;
  matchedPersonnelCode: string;
  matchedFullName: string;
  matchedPersonnelId: string;
  matchMethod: 'national_code' | 'code' | 'normalized_name' | 'fuzzy' | 'unmatched' | 'new_creation_requested';
  confidenceScore: number;     // 0 to 100
  department: string;
  jobTitle: string;
  examYear: number;
  examDate: string;
  examType: MedicalExamType;
  doctor: string;
  medicalCenter: string;
  labResults: {
    testName: string;
    testCode?: string;
    numericValue?: number;
    textValue?: string;
    unit: string;
    minRef?: number;
    maxRef?: number;
    status: LabResultStatus;
  }[];
  finalStatus: MedicalExamStatus;
  isDuplicate: boolean;
  duplicateAction: 'skip' | 'overwrite' | 'create_new';
  hasErrors: boolean;
  errors: string[];
  needsAdminApproval: boolean;
}

export interface PdfExtractionPreview {
  id: string;
  fileName: string;
  fileSize: number;
  personnelCode: string;
  fullName: string;
  matchedPersonnel: any | null;
  examDate: string;
  examYear: number;
  medicalCenter: string;
  doctor: string;
  examType: MedicalExamType;
  labResults: {
    testName: string;
    numericValue?: number;
    textValue?: string;
    unit: string;
    minRef?: number;
    maxRef?: number;
    status: LabResultStatus;
  }[];
  finalStatus: MedicalExamStatus;
  pdfBase64?: string;
  rawExtractedText: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
  uploadedBy: string;
}

// -------------------------------------------------------------
// STRUCTURED OCCUPATIONAL HEALTH ARCHITECTURE (15 CATEGORIES)
// -------------------------------------------------------------

export type StructuredExamType = 
  | 'بدو استخدام'
  | 'دوره‌ای'
  | 'بازگشت به کار'
  | 'تغییر شغل'
  | 'خروج از کار'
  | 'معاینه اختصاصی';

export type MedicalItemCategory = 
  | 'basic_info'                 // 1. اطلاعات پایه معاینه
  | 'vitals_body'                // 2. علائم حیاتی و اندازه‌گیری‌ها
  | 'medical_history'            // 3. شرح حال پزشکی
  | 'physical_exam'              // 4. معاینه فیزیکی
  | 'optometry'                  // 5. بینایی‌سنجی
  | 'audiometry'                 // 6. شنوایی‌سنجی
  | 'blood_tests'                // 7. آزمایش‌های خون
  | 'urinalysis'                 // 8. آزمایش ادرار
  | 'occupational_exposure_tests'// 9. آزمایش‌های اختصاصی مواجهه شغلی
  | 'spirometry'                 // 10. تست عملکرد ریه / Spirometry
  | 'cardiology'                 // 11. قلب و عروق
  | 'imaging'                    // 12. تصویربرداری
  | 'psychological'              // 13. ارزیابی روانشناختی
  | 'workplace_exposures'        // 14. مواجهه‌های شغلی
  | 'final_conclusion';          // 15. نتیجه نهایی طب کار

export type MedicalItemDataType = 
  | 'numeric'
  | 'text'
  | 'boolean'
  | 'select'
  | 'date'
  | 'file'
  | 'structured_result';

export type MedicalResultStatus = 
  | 'Normal'
  | 'Low'
  | 'High'
  | 'Critical'
  | 'Abnormal'
  | 'Pending';

export type OccupationalFitnessDecision = 
  | 'سالم'
  | 'سالم با محدودیت'
  | 'نیازمند بررسی بیشتر'
  | 'نیازمند ارجاع'
  | 'مناسب برای شغل'
  | 'مناسب مشروط'
  | 'نامناسب برای شغل'
  | 'دارای محدودیت شغلی';

export interface MedicalTestCatalogItem {
  id: string;
  code: string;
  name: string;
  category: MedicalItemCategory;
  dataType: MedicalItemDataType;
  defaultUnit?: string;
  options?: string[];
  requiresRefRange?: boolean;
  defaultRefLow?: number;
  defaultRefHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  defaultRefText?: string;
  refSource?: string;
  isCustom?: boolean;
  description?: string;
  displayOrder?: number;
}

export interface MedicalTestResultRecord {
  id: string;
  recordId: string;
  examId: string;
  personnelCode: string;
  personnelName: string;
  nationalCode?: string;
  examYear: number;
  examDate: string;
  examType: StructuredExamType;
  
  // Item Identity
  itemId: string;
  itemCode: string;
  itemName: string;
  category: MedicalItemCategory;
  dataType: MedicalItemDataType;
  
  // Values
  valueNumeric?: number;
  valueText?: string;
  valueBoolean?: boolean;
  unit?: string;
  
  // Reference Range & Validation
  refLow?: number;
  refHigh?: number;
  refCriticalLow?: number;
  refCriticalHigh?: number;
  refText?: string;
  refSource?: string;
  status: MedicalResultStatus;
  
  // Doctor & Lab Meta
  doctorNotes?: string;
  labCenter?: string;
  attachmentId?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface OccupationalExposureItem {
  id: string;
  code: string;
  name: string;
  hasExposure: boolean;
  intensity?: 'پایین' | 'متوسط' | 'بالا' | 'بحرانی';
  duration?: string;
  controlMeasures?: string;
  assessmentResult?: string;
  notes?: string;
}

export interface PhysicalExamFindingItem {
  organCode: string;
  organName: string;
  status: 'طبیعی' | 'غیرطبیعی' | 'نیازمند بررسی';
  notes?: string;
}

export interface AudiometryFrequencyData {
  frequency: 250 | 500 | 1000 | 2000 | 3000 | 4000 | 6000 | 8000;
  rightEarDb: number;
  leftEarDb: number;
}

export interface StructuredOccupationalExamSession {
  id: string;
  recordId: string;
  personnelCode: string;
  personnelName: string;
  nationalCode?: string;
  gender: 'مرد' | 'زن';
  birthDate?: string;
  age: number;
  department: string;
  jobTitle: string;
  jobRole?: string;
  workExperienceYears?: number;
  currentJobExperienceYears?: number;
  
  examType: StructuredExamType;
  examDate: string;
  examYear: number;
  doctor: string;
  medicalCenter: string;
  dossierNumber?: string;
  
  fitnessDecision: OccupationalFitnessDecision;
  medicalRecommendations?: string;
  jobModifications?: string;
  workRestrictions?: string;
  specialistReferral?: string;
  nextReviewDate?: string;
  finalDoctorComment?: string;
  
  attachmentsCount?: number;
  resultsCount?: number;
  abnormalCount?: number;
  criticalCount?: number;
  
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type ReferencePriorityLevel = 1 | 2 | 3 | 4 | 5;
// 1: مرجع اختصاصی آزمایشگاه انجام‌دهنده
// 2: مرجع تأییدشده توسط پزشک طب کار/مسئول فنی
// 3: مرجع رسمی سازمان/وزارت بهداشت
// 4: مرجع استاندارد یا راهنمای معتبر بین‌المللی
// 5: مرجع پیش‌فرض سیستم

export type ReferenceScopeType = 
  | 'laboratory_clinical'        // محدوده مرجع آزمایشگاهی (Reference Range)
  | 'occupational_exposure_limit' // حد مجاز مواجهه شغلی (OEL / TLV / PEL)
  | 'sensory_physical'           // معاینات فیزیکی، بینایی، شنوایی و تنفسی
  | 'risk_scoring';              // ارزیابی خطرسنجی و روان‌شناختی

export type ReferenceRuleStatus = 'active' | 'inactive' | 'archived';

export type ResultEvaluationStatus = 
  | 'Normal'
  | 'Low'
  | 'High'
  | 'Borderline'
  | 'Critical'
  | 'RequiresMedicalReview'
  | 'NoReference';

export interface OccupationalReferenceRule {
  id: string;
  testCode: string;
  testName: string;
  testNameEn?: string;
  category: MedicalItemCategory;
  testType: string;               // بیوشیمی، هماتولوژی، ادرار، تن‌سنجی، ادیومتری، اسپیرومتری، سم‌شناسی و...
  sampleType?: string;            // خون تام، سرم، پلاسما، ادرار، مدفوع، فیزیکی، صوتی، تنفسی و...
  unit: string;
  
  // Ranges & Thresholds
  refLow?: number;
  refHigh?: number;
  warningLow?: number;           // حد هشدار پایین (Borderline)
  warningHigh?: number;          // حد هشدار بالا (Borderline)
  criticalLow?: number;          // حد بحرانی پایین
  criticalHigh?: number;         // حد بحرانی بالا
  
  // Demographics & Conditions
  gender: 'مرد' | 'زن' | 'همه';
  minAge?: number;
  maxAge?: number;
  examType?: string;             // بدو استخدام، ادواری، بازگشت به کار یا همه
  
  // Source, Priority & Governance
  refSource: string;             // e.g. WHO 2024, ADA 2024, وزارت بهداشت, NCEP ATP III
  standardGuidelineName: string; // نام استاندارد یا گایدلاین
  version: string;               // e.g. "v2024.1"
  publicationYear?: string;      // e.g. "2024"
  validUntil?: string;           // تاریخ انقضا / اعتبار مرجع
  priorityLevel: ReferencePriorityLevel;
  labName?: string;              // آزمایشگاه طرف قرارداد (در صورت اولویت ۱)
  scopeType: ReferenceScopeType;
  status: ReferenceRuleStatus;
  
  // Annotations
  description?: string;
  clinicalNotes?: string;
  
  // Audit Trail
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface OccupationalExposureLimitRule {
  id: string;
  agentCode: string;
  agentName: string;
  agentNameEn?: string;
  agentType: 'فیزیکی' | 'شیمیایی' | 'بیولوژیکی' | 'ارگونومیک' | 'روانی';
  unit: string;                  // dB(A), lux, mg/m³, ppm, °C, ...
  measurementMethod?: string;    // e.g. ISO 9612, NIOSH 7500, OSHA ID-142
  limitValue: number;
  actionLevel?: number;          // سطح اقدام
  limitType: 'TWA' | 'STEL' | 'Ceiling' | 'Action Level' | 'PEL' | 'TLV';
  exposureDuration?: string;     // e.g. 8 ساعت روزانه، 40 ساعت هفتگی
  standardSource: string;        // وزارت بهداشت، ACGIH، OSHA، NIOSH
  standardVersion: string;
  publicationYear?: string;
  validUntil?: string;
  status: ReferenceRuleStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceSourceDefinition {
  id: string;
  name: string;
  nameEn: string;
  category: 'وزارت بهداشت' | 'استاندارد بین‌المللی' | 'آزمایشگاه طرف قرارداد' | 'راهنمای طب کار' | 'پزشک متخصص';
  authority: string;
  country: string;
  standardCode?: string;
  latestEdition: string;
  publicationYear: string;
  websiteUrl?: string;
  notes?: string;
  isVerified: boolean;
}

export interface ReferenceAuditLog {
  id: string;
  referenceId: string;
  testCode: string;
  testName: string;
  user: string;
  timestamp: string;
  actionType: 'create' | 'update' | 'version_bump' | 'deactivate' | 'reactivate';
  oldValues?: Partial<OccupationalReferenceRule>;
  newValues: Partial<OccupationalReferenceRule>;
  oldSource?: string;
  newSource?: string;
  oldVersion?: string;
  newVersion?: string;
  changeReason: string;
}

export interface MedicalResultEvaluation {
  status: ResultEvaluationStatus;
  statusFa: string;
  statusBadgeColor: string;
  appliedReference: OccupationalReferenceRule | null;
  valueNumeric?: number;
  valueText?: string;
  refLow?: number;
  refHigh?: number;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  unit?: string;
  refSource?: string;
  refVersion?: string;
  priorityLevel?: ReferencePriorityLevel;
  deviationPercent?: number;
  isOutOfBounds: boolean;
  message: string;
}

export interface DynamicReferenceRule {
  id: string;
  testCode: string;
  testName: string;
  gender: 'مرد' | 'زن' | 'همه';
  minAge?: number;
  maxAge?: number;
  refLow: number;
  refHigh: number;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  unit: string;
  refSource: string;
  standardGuidelineName?: string;
  version?: string;
  priorityLevel?: ReferencePriorityLevel;
  status?: ReferenceRuleStatus;
  description?: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// OCCUPATIONAL HEALTH ANALYTICS & INTELLIGENCE TYPES
// -------------------------------------------------------------

export type BmiCategoryType = 
  | 'underweight'      // کمبود وزن (< 18.5)
  | 'normal'           // وزن نرمال (18.5 - 24.9)
  | 'overweight'       // اضافه وزن (25 - 29.9)
  | 'obese_class_1'    // چاقی درجه ۱ (30 - 34.9)
  | 'obese_class_2'    // چاقی درجه ۲ (35 - 39.9)
  | 'obese_class_3';   // چاقی درجه ۳ (>= 40)

export interface BmiCategoryThresholds {
  underweightMax: number;   // default 18.5
  normalMax: number;        // default 24.9
  overweightMax: number;    // default 29.9
  obese1Max: number;        // default 34.9
  obese2Max: number;        // default 39.9
}

export type DiseaseCategoryKey =
  | 'cardiovascular'        // بیماری‌های قلبی ـ عروقی
  | 'hypertension'          // فشار خون
  | 'diabetes_endocrine'    // دیابت و غدد
  | 'respiratory'           // بیماری‌های تنفسی
  | 'musculoskeletal'       // بیماری‌های اسکلتی ـ عضلانی
  | 'audiology'             // بیماری‌های شنوایی
  | 'ophthalmology'         // بیماری‌های بینایی
  | 'dermatology'           // بیماری‌های پوستی
  | 'neurology'             // بیماری‌های عصبی
  | 'gastrointestinal'      // بیماری‌های گوارشی
  | 'renal'                 // بیماری‌های کلیوی
  | 'hepatic'               // بیماری‌های کبدی
  | 'psychological'         // بیماری‌های روانشناختی
  | 'other_occupational';   // سایر بیماری‌ها

export type DiseaseStatus = 'فعال' | 'مزمن' | 'تحت کنترل' | 'بهبودیافته';

export interface DiagnosedDiseaseRecord {
  id: string;
  diseaseCode: string;
  diseaseName: string;
  category: DiseaseCategoryKey;
  categoryFa: string;
  status: DiseaseStatus;
  isChronic: boolean;
  diagnosisDate: string;
  examYear: number;
  personnelCode: string;
  personnelName: string;
  nationalCode?: string;
  department: string;
  jobTitle: string;
  gender: 'مرد' | 'زن';
  age: number;
  severity: 'خفیف' | 'متوسط' | 'شدید' | 'بحرانی';
  notes?: string;
  treatmentPlan?: string;
  doctorName?: string;
}

export type HealthRiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface HealthRiskScoreWeights {
  criticalLabWeight: number;      // default: 30
  abnormalLabWeight: number;      // default: 5
  chronicDiseaseWeight: number;   // default: 25
  activeDiseaseWeight: number;    // default: 15
  obesityClass2Or3Weight: number; // default: 20
  obesityClass1Weight: number;    // default: 8
  hypertensionWeight: number;     // default: 15
  occupationalRestrictionWeight: number; // default: 15
  referralNeededWeight: number;   // default: 10
}

export interface PersonnelHealthProfile {
  personnelCode: string;
  fullName: string;
  nationalCode: string;
  gender: 'مرد' | 'زن';
  age: number;
  department: string;
  jobTitle: string;
  
  // Latest Examination Info
  hasExam: boolean;
  latestExamYear?: number;
  latestExamDate?: string;
  latestExamType?: string;
  fitnessDecision?: OccupationalFitnessDecision;
  hasOccupationalLimitation: boolean;
  needsMedicalFollowUp: boolean;
  medicalRecommendations?: string;
  
  // BMI Analysis
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  bmiCategory?: BmiCategoryType;
  bmiCategoryFa?: string;
  
  // Blood Pressure
  bpSys?: number;
  bpDia?: number;
  hasHypertension: boolean;
  bpStatusText?: string;
  
  // Diseases & Conditions
  diseases: DiagnosedDiseaseRecord[];
  hasDisease: boolean;
  hasChronicDisease: boolean;
  
  // Labs & Tests
  totalTestsCount: number;
  abnormalTestsCount: number;
  highTestsCount: number;
  lowTestsCount: number;
  criticalTestsCount: number;
  criticalTests: MedicalTestResultRecord[];
  abnormalTests: MedicalTestResultRecord[];
  
  // Medical Attention & Risk
  needsMedicalAttention: boolean;
  attentionReasons: string[];
  riskScore: number;
  riskLevel: HealthRiskLevel;
}

export interface UnitHealthAnalyticsSummary {
  department: string;
  totalPersonnel: number;
  examinedCount: number;
  unexaminedCount: number;
  coveragePercentage: number;
  highBmiCount: number;
  highBmiPercentage: number;
  diseaseCount: number;
  diseasePercentage: number;
  abnormalTestCases: number;
  abnormalTestPercentage: number;
  criticalCount: number;
  followUpCount: number;
  averageBmi: number;
  averageRiskScore: number;
}

export interface YoYHealthComparisonMatrix {
  yearA: number;
  yearB: number;
  totalExaminedA: number;
  totalExaminedB: number;
  coverageDeltaPercent: number;
  highBmiPercentA: number;
  highBmiPercentB: number;
  highBmiDeltaPercent: number;
  diseaseCountA: number;
  diseaseCountB: number;
  diseaseCountDelta: number;
  abnormalLabsA: number;
  abnormalLabsB: number;
  abnormalLabsDelta: number;
  criticalCasesA: number;
  criticalCasesB: number;
  criticalCasesDelta: number;
}

