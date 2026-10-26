export type ClinicTriageLevel = 1 | 2 | 3 | 4 | 5;

export type ClinicVisitType = 
  | 'مراجعه معمول / سرپایی'
  | 'حادثه شغلی / اورژانس کارگاهی'
  | 'حادثه غیر شغلی'
  | 'مسمومیت / استنشاق گاز و مواد شیمیایی'
  | 'گرمازدگی / سرمازدگی'
  | 'تزریقات و پانسمان'
  | 'چکاپ و کنترل علائم حیاتی'
  | 'پیگیری درمان قبلی';

export type ClinicVisitOutcome = 
  | 'بهبود و بازگشت به کار'
  | 'استراحت در بهداری (تحت نظر)'
  | 'استراحت پزشکی در منزل'
  | 'ارجاع به متخصص / بیمارستان'
  | 'اعزام اورژانسی با آمبولانس به بیمارستان';

export type ClinicConsciousness = 'هوشیار (Alert)' | 'پاسخ به صدا (Voice)' | 'پاسخ به درد (Pain)' | 'بیهوش (Unresponsive)';

export interface ClinicMedicationItem {
  id: string;
  name: string;
  dosage: string;
  route: 'خوراکی' | 'عضلانی' | 'وریدی' | 'موضعی' | 'استنشاقی' | 'چشمی' | 'زیرزبانی';
  count: number;
  instructions: string;
}

export interface ClinicAmbulanceDispatch {
  dispatched: boolean;
  ambulanceCode?: string;
  driverName?: string;
  escortNurse?: string;
  dispatchTime?: string;
  destinationHospital?: string;
  handoverNotes?: string;
}

export interface ClinicVisit {
  id: string;
  visitNumber: string;               // e.g. CLN-14040716-1024
  visitDate: string;                 // Jalali e.g. 1404/07/16
  visitTime: string;                 // e.g. 09:30
  shift: 'نوبتکار روز' | 'نوبتکار شب' | 'عادی‌کار';
  visitType: ClinicVisitType;
  chiefComplaint: string;

  // Personnel Central Master Data (Linked directly without duplication)
  personnelId?: string;
  personnelCode: string;
  nationalCode: string;
  fullName: string;
  gender?: string;
  age?: number;
  unit: string;
  department?: string;
  jobTitle: string;
  phone?: string;
  bloodGroup?: string;
  underlyingConditions?: string;
  allergies?: string;

  // Triage & Vitals
  triageLevel: ClinicTriageLevel;
  systolicBp?: number;              // mmHg
  diastolicBp?: number;             // mmHg
  pulseRate?: number;               // bpm
  respiratoryRate?: number;         // /min
  temperature?: number;             // °C
  spo2?: number;                    // %
  bloodSugar?: number;              // mg/dL
  painScore?: number;               // 0-10 VAS
  consciousnessLevel?: ClinicConsciousness;

  // Physical Examination & Clinical Diagnosis
  physicalExamNotes?: string;
  affectedOrgan?: string;
  primaryDiagnosis: string;
  icdCode?: string;
  isWorkRelated: boolean;
  incidentLocation?: string;

  // Treatments & Interventions
  actionsPerformed: string[];
  actionDetails?: string;

  // Medications
  medications: ClinicMedicationItem[];

  // Disposition, Medical Rest, Referral & Dispatch
  outcome: ClinicVisitOutcome;
  observationDurationHours?: number;
  medicalRestDays?: number;
  medicalRestFrom?: string;
  medicalRestTo?: string;
  referralCenter?: string;
  ambulanceDispatch: ClinicAmbulanceDispatch;

  // Medical Staff & Notes
  attendingMedic: string;
  medicRole: 'پزشک عمومی' | 'پزشک طب کار' | 'پرستار' | 'بهیار' | 'تکنیسین فوریت‌های پزشکی (EMS)';
  notes?: string;
  status: 'COMPLETED' | 'DRAFT' | 'CANCELLED';

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface ClinicFilterState {
  searchQuery: string;
  personnelCode: string;
  unit: string;
  visitType: string;
  triageLevel: string;
  outcome: string;
  isWorkRelated: string; // 'all' | 'yes' | 'no'
  dateFrom: string;
  dateTo: string;
}

export interface ClinicStatistics {
  totalVisits: number;
  todayVisits: number;
  workRelatedCount: number;
  nonWorkRelatedCount: number;
  ambulanceDispatchCount: number;
  totalMedicalRestDays: number;
  triageCounts: Record<ClinicTriageLevel, number>;
  outcomeCounts: Record<string, number>;
  topDiagnoses: { diagnosis: string; count: number }[];
  topUnits: { unit: string; count: number }[];
}
