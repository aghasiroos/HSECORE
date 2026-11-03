export type EquipmentStatus = 'مطلوب' | 'نامطلوب';
export type CorrectiveActionStatus = 'باز' | 'بسته';

export type OperationalStatus =
  | 'فعال'
  | 'غیرفعال'
  | 'انتقال جهت شارژ'
  | 'انتقال جهت تست';

export type GeographicalDirection =
  | 'N – North'
  | 'NE – North East'
  | 'E – East'
  | 'SE – South East'
  | 'S – South'
  | 'SW – South West'
  | 'W – West'
  | 'NW – North West'
  | string;

export interface EquipmentLocationDetails {
  complex: string;       // مجتمع / شرکت
  unit: string;          // واحد سازمانی
  direction: string;     // جهت جغرافیایی (N, NE, E, SE, S, SW, W, NW)
  floor: string;         // طبقه (1..20, همکف, فاقد طبقه)
  exactLocation: string; // موقعیت دقیق / توضیحات تکمیلی
}

export interface OperationalStatusChangeLog {
  id: string;
  status: OperationalStatus | string;
  previousStatus?: OperationalStatus | string | null;
  changeDate: string;          // تاریخ تغییر وضعیت
  reason: string;              // علت تغییر وضعیت
  notes?: string;              // توضیحات تکمیلی
  previousLocation?: string;   // محل استقرار قبلی
  destinationLocation?: string;// محل یا مقصد جدید (در صورت انتقال)
  recordedBy: string;          // نام فرد ثبت‌کننده تغییر
  isReturnToService?: boolean; // بازگشت به محل استقرار اصلی و فعال‌سازی مجدد
  timestamp?: string;
}

export interface DefectRecord {
  id: string;
  date: string;
  description: string;
  workOrderNo?: string;
  correctiveAction?: string;
  responsiblePerson?: string;
  actionDate?: string;
  status: CorrectiveActionStatus;
  additionalNotes?: string;
}

export interface MonthlyInspection {
  month: number; // 1-12 (Farvardin to Esfand)
  date: string;
  inspectorName: string;
  status: EquipmentStatus;
  shift: string;
  defectId?: string; // Link to defect if status is bad
}

export interface BaseEquipment {
  id: string;
  code?: string;
  category: string;
  location: string;
  complex?: string;
  unit?: string;
  direction?: string;
  floor?: string;
  exactLocation?: string;
  locationDetails?: EquipmentLocationDetails;
  primaryLocation?: string;
  primaryLocationDetails?: EquipmentLocationDetails;
  operationalStatus?: OperationalStatus | string;
  isTemporaryOut?: boolean;
  currentDestination?: string;
  statusHistory?: OperationalStatusChangeLog[];
  shift?: string;
  workOrder?: string;
  inspections: MonthlyInspection[];
  defects: DefectRecord[];
}

export interface FireExtinguisher extends BaseEquipment {
  category: 'Fire Extinguisher Capsol';
  type: string;
  weight: number;
  assetCode: string;
  brand: string;
  buildYear: string;
  description?: string;
}

export interface HydrantMonitor extends BaseEquipment {
  category: 'Hydrants & Monitors';
  specializedCode: string;
  type: 'هیدرانت' | 'مانیتور' | 'هیدرانت و مانیتور';
  size: string;
}

export interface FireBox extends BaseEquipment {
  category: 'Fire Boxs';
  fireBoxNo: string;
  existingEquipment: string[]; // ولو, هوز, نازل, کابینت, ریل هوز, باکس شانه‌ای, سایر
  quantity: number;
  size: string;
}

export interface FoamPackage extends BaseEquipment {
  category: 'Foam Pakages';
  foamStationNo: string;
  existingEquipment: string[]; // هوز, نازل فوم, فوم, ارابه, سطل شن, کپسول, سایر
  description?: string;
}

export interface FM200 extends BaseEquipment {
  category: 'FM 200';
  tag: string;
  gaugeStatus: string;
  description?: string;
}

export interface ValveSprinkler extends BaseEquipment {
  category: 'دليج ولواسپرينكلرon,off ولو';
  tag: string;
  type: 'ON/OFF Valve' | 'Sprinkler' | 'Deluge Valve';
}

export interface GasDetector extends BaseEquipment {
  category: 'گازيابها';
  detectorType: string; // 'ثابت (Fixed)' | 'متحرک / پرتابل (Portable)'
  assetCode: string;
  brand: string;
  model: string;
  detectableGases: string[];
  calibrationDate: string;
  standbyStatus?: string;
}

export interface EmergencyShower extends BaseEquipment {
  category: 'دوش و چشم شوی اضطراری';
  type: 'دوش' | 'چشم‌شوی' | 'دوش و چشم‌شوی';
}

export type FireEquipment = 
  | FireExtinguisher 
  | HydrantMonitor 
  | FireBox 
  | FoamPackage 
  | FM200 
  | ValveSprinkler 
  | GasDetector 
  | EmergencyShower;
