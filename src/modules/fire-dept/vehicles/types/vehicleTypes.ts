export type VehicleStatus = 'آماده به کار' | 'آماده به کار با محدودیت' | 'در تعمیرات' | 'خارج از سرویس';

export type VehicleOverallReadiness = 
  | 'عالی' 
  | 'قابل قبول' 
  | 'نیازمند اقدام' 
  | 'بحرانی' 
  | 'تأیید آماده‌به‌کار کامل' 
  | 'مشروط با نواقص جزئی' 
  | 'عدم تأیید و توقف عملیات';

export type InspectionType = 
  | 'روزانه'
  | 'هفتگی'
  | 'ماهانه'
  | 'فصلی'
  | 'شش‌ماهه'
  | 'سالانه'
  | 'قبل از عملیات'
  | 'بعد از عملیات'
  | 'بازرسی ویژه';

export type ChecklistItemResultType = 
  | 'مطابق'
  | 'نامنطبق'
  | 'نیازمند تعمیر'
  | 'موجود نیست'
  | 'قابل استفاده نیست'
  | 'نیازمند آزمون'
  | 'خارج از سرویس'
  | 'N/A';

export type DefectSeverity = 
  | 'بحرانی' 
  | 'بالا' 
  | 'متوسط' 
  | 'جزئی'
  | 'بحرانی (Critical)' 
  | 'متوسط (Major)' 
  | 'جزئی (Minor)';

export type DefectPriority = 
  | 'فوری (اضطراری)' 
  | 'فوری (۲۴ ساعت)' 
  | 'بالا' 
  | 'متوسط' 
  | 'عادی' 
  | 'کم';

export type VehicleDocumentCategory = 
  | 'manual'       // دفترچه فنی و راهنمای اپراتوری
  | 'insurance'    // بیمه‌نامه شخص ثالث و بدنه
  | 'ownership'    // اسناد مالکیت و شناسنامه خودرو
  | 'license'      // مجوزهای بهره‌برداری و معاینه فنی
  | 'technical'    // نقشه‌ها و نقشه‌های برق و هیدرولیک
  | 'other';       // سایر اسناد

export interface VehicleDocument {
  id: string;
  vehicleId?: string;
  title: string;
  category?: VehicleDocumentCategory;
  fileType: string; // 'PDF' | 'PNG' | 'JPG' | 'JPEG'
  fileName?: string;
  uploadDate: string;
  size?: string;
  fileData?: string; // base64 / data URL
  docNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export interface VehicleCertificate {
  id: string;
  vehicleId: string;
  testType: string;
  equipment: string;
  testDate: string;
  result: 'مطلوب (Pass)' | 'نامطلوب (Fail)' | 'مشروط' | string;
  testValue: string;
  allowedLimit: string;
  certificateNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  certificateFile?: string;
}

export type VehicleTestCertificate = VehicleCertificate;

export interface VehicleMaintenanceRecord {
  id: string;
  vehicleId: string;
  vehicleCode?: string;
  date: string;
  mileage?: number;
  repairType: 'پیشگیرانه (PM)' | 'اصلاحی (CM)' | 'اورژانسی / اضطراری' | 'اورهال اساسی' | 'تعویض روغن و سرویس دوره‌ای' | string;
  failureDescription: string;
  replacedParts?: string[];
  rootCause?: string;
  mechanic?: string;
  mechanicName?: string;
  cost?: number;
  downtimeDurationHours?: number;
  backToServiceDate?: string;
  docs?: string[];
  status: 'در حال انجام' | 'پایان یافته' | 'تکمیل شده';
}

export interface VehicleCorrectiveAction {
  rootCause: string;
  immediateAction: string;
  correctiveActionPlan: string;
  responsible: string;
  startDate: string;
  dueDate: string;
  completionDate?: string;
  proofDoc?: string;
  hseApproval: boolean;
  approvedBy?: string;
  approvalDate?: string;
  finalStatus: 'در انتظار اقدام' | 'در دست اجرا' | 'تکمیل شده و تایید شده' | 'رد شده';
}

export interface VehicleDefectRecord {
  id: string;
  code?: string;
  vehicleId: string;
  vehicleCode: string;
  inspectionId?: string;
  item?: string;
  itemTitle?: string;
  category: string;
  description: string;
  severity: DefectSeverity;
  priority: DefectPriority;
  photo?: string;
  reportedDate?: string;
  reportedBy?: string;
  responsiblePerson: string;
  dueDate: string;
  status: 'باز' | 'در حال اقدام' | 'انجام شد (در انتظار تایید)' | 'بسته شده';
  createdDate?: string;
  rootCauseAnalysis?: string;
  immediateAction?: string;
  capaPlan?: string;
  hseSignOff?: boolean;
  correctiveAction?: VehicleCorrectiveAction;
}

export interface VehicleChecklistItemResult {
  id: string;
  category: string;
  itemTitle: string;
  result: ChecklistItemResultType;
  description?: string;
  measuredValue?: string;
  allowedLimit?: string;
  photo?: string;
  file?: string;
  date: string;
  time: string;
  inspector: string;
  standardRefId?: string;
  defectGeneratedId?: string;
}

export interface VehicleInspectionRecord {
  id: string;
  vehicleId: string;
  vehicleCode: string;
  inspectionType: InspectionType | string;
  date: string;
  time?: string;
  inspector?: string;
  inspectorName?: string;
  inspectorCode?: string;
  supervisorName?: string;
  supervisorCode?: string;
  hseManagerName?: string;
  hseManagerCode?: string;
  shift: string;
  mileageAtInspection: number;
  complianceScore: number;
  overallState: VehicleOverallReadiness;
  items?: VehicleChecklistItemResult[];
  notes?: string;
  signatureVerified?: boolean;
  station?: string;
}

export interface VehicleStandard {
  id: string;
  title: string;
  code: string;
  reference?: string;
  organization?: string;
  version?: string;
  revisionYear?: string;
  requirement?: string;
  description?: string;
  scope?: string;
  allowedLimit?: string;
  testMethod?: string;
  inspectionInterval?: string;
  requiredDocs?: string;
  linkedCategories?: string[];
}

export interface FireVehicle {
  id: string;
  code: string;
  plateNumber: string;
  vehicleType: string;
  brandModel: string;
  buildYear?: string;
  year?: string | number;
  country?: string;
  chassisNumber?: string;
  engineNumber?: string;
  vin?: string;
  waterTankCapacity?: number;
  foamTankCapacity?: number;
  foamType?: string;
  pumpCapacityPressure?: string;
  pumpModel?: string;
  monitorModel?: string;
  ladderHeight?: string | number;
  driveType?: string;
  fuelType?: string;
  mileage: number;
  currentMileage?: number;
  location?: string;
  fireStation: string;
  responsiblePerson?: string;
  assignedDriver?: string;
  commissionDate?: string;
  lastServiceDate?: string;
  lastInspectionDate?: string;
  nextInspectionDue?: string;
  status: VehicleStatus;
  complianceScore: number;
  overallReadiness: VehicleOverallReadiness;
  standardsCompliance?: any;
  image?: string;
  documents?: VehicleDocument[];
  certificates?: VehicleCertificate[];
  testCertificates?: VehicleCertificate[];
  maintenanceHistory?: VehicleMaintenanceRecord[];
  inspectionHistory?: VehicleInspectionRecord[];
  defects?: VehicleDefectRecord[];
}
