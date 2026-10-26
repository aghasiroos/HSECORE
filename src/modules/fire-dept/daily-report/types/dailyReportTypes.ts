export type ShiftType = 'DAY' | 'NIGHT' | 'ROTATING';
export type ReportStatus = 'DRAFT' | 'FINALIZED';
export type EquipmentOperationalStatus = 'سالم / نرمال' | 'دارای نقص' | 'در حال سرویس' | 'خارج از مدار' | 'تست شده';
export type VehicleOperationalStatus = 'آماده به کار (OK)' | 'دارای نقص جزئی' | 'در حال تعمیر' | 'خارج از سرویس';

export interface DailyReportVehicleItem {
  status: VehicleOperationalStatus | string;
  description?: string;
  vehicleId?: string;
  vehicleCode?: string;
  vehicleName?: string;
  plateNumber?: string;
  vehicleType?: string;
}

export type VehiclesStatusMap = Record<string, DailyReportVehicleItem | { status: VehicleOperationalStatus; description?: string }>;

export interface GasLeakRecord {
  id: string;
  gasType: string;
  amountPpm: number;
  windDirection: string;
  leakLocations: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  actionsTaken?: string;
}

export interface ShiftOfficerSign {
  name: string;
  personnelCode: string;
  time?: string;
  signed: boolean;
  notes?: string;
}

export interface ConfinedSpaceLogItem {
  id: string;
  permitNumber?: string;
  location: string;             // نام مخزن، برج یا فضای بسته
  entryPurpose: string;         // علت ورود (بازرسی، تمیزکاری، تعمیرات، جوشکاری)
  workerCount: number;          // تعداد نفرات داخل
  holeWatchName: string;        // نام دیده‌بان / مراقب ورودی
  ventilationType: 'طبیعی' | 'دمنده مکانیکی (Blower)' | 'مکش موضعی (Extraction)';
  gasTestPassed: boolean;       // گازسنجی اولیه تایید شده
  oxygenPercent?: number;       // O2 (۱۹.۵ - ۲۳.۵)
  lelPercent?: number;          // LEL (زیر ۱۰٪)
  toxicGasPpm?: number;         // H2S / CO (زیر حد مجاز)
  scbaEquipped: boolean;        // مجهز به دستگاه تنفسی / کپسول فرار
  tripodHarness: boolean;       // مجهز به سه‌پایه نجات، هارنس و طناب
  light24v: boolean;            // روشنایی ضدانفجار ۲۴ ولت
  entryTime?: string;
  exitTime?: string;
  status: 'در حال کار' | 'پایان یافته' | 'متوقف شده';
  notes?: string;
}

export interface ConfinedSpaceSection {
  totalPermitsCount: number;         // کل پروانه‌های فضای بسته
  activeSpacesCount: number;         // فضاهای بسته فعال
  standbyOfficersCount: number;      // دیده‌بانان و پرسنل مراقب
  blowerFansInUse: number;           // فن‌ها و دمنده‌های در حال کار
  rescueTripodsInUse: number;        // سه‌پایه‌های نجات مستقر
  continuousGasMonitoring: boolean;  // پایش مداوم گاز در حین کار
  airSupplyTrolleyInUse: boolean;    // ترولی هوارسان در مدار
  records: ConfinedSpaceLogItem[];   // ثبت ردیف‌های اختصاصی فضاهای بسته
}

export interface DynamicReportCustomItem {
  id: string;
  tabId: string;                     // 'general' | 'permits' | 'valves' | 'extinguishers' | 'vehicles' | 'gas_detectors' | 'faults_standby' | 'leaks_tasks'
  categoryFa: string;                // عنوان رسته / گروه
  nameFa: string;                    // نام آیتم
  nameEn?: string;
  itemType: 'status' | 'number' | 'text' | 'boolean';
  statusValue?: EquipmentOperationalStatus | string;
  numericValue?: number;
  textValue?: string;
  unit?: string;                     // مثلاً 'عدد', 'kg', 'ppm', 'مورد'
  notes?: string;
}

export interface FireDailyReport {
  id: string;
  reportNumber: string;
  reportDate: string; // Jalali date format: 1404/06/05
  stationName: string; // e.g. 'ایستگاه آتش‌نشانی معین - مجتمع پتروشیمی رجال'
  unitName?: string; // نام واحد سازمانی (استخراج شده از تنظیمات واحد و مشاغل)
  subUnitName?: string; // نام زیرمجموعه واحد سازمانی (استخراج خودکار پس از انتخاب واحد)
  shift: ShiftType;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  finalizedAt?: string;
  finalizedBy?: string;

  // 1. بازرسی و گزارشات (Inspections & Incidents)
  inspectionsAndIncidents: {
    hseInspectionsCount: number;
    fireInspectionsCount: number;
    humanIncidents: {
      minor: number;       // جزئی
      recordable: number;  // قابل ثبت
      severe: number;      // حاد
    };
    vehicleIncidents: {
      minor: number;       // جزئی
      recordable: number;  // قابل ثبت
      severe: number;      // حاد
    };
    fireIncidents: {
      minor: number;       // جزئی
      recordable: number;  // قابل ثبت
      severe: number;      // حاد
    };
  };

  // 2. تعداد مجوز کار صادره (Work Permits Issued) - ساختار پروانه‌های اصلی و الحاقی
  workPermitsIssued: {
    // پروانه‌های اصلی
    hotWork: number;                 // کار گرم
    coldWork: number;                // کار سرد
    totalMainPermits?: number;       // مجموع پروانه‌های اصلی

    // پروانه‌های الحاقی
    attachedPermits?: {
      excavation: number;            // ۱. حفاری
      confinedSpace: number;         // ۲. ورود به فضا بسته
      vehicleCrane: number;          // ۳. ورود خودرو / جرثقیل
      radiation: number;             // ۴. منابع پرتوزا
      electricalIsolation: number;   // ۵. جداسازی الکتریکی
      processIsolation: number;      // ۶. جداسازی فرایندی/مکانیکی/ابزار دقیق
      totalAttached?: number;        // مجموع پروانه‌های الحاقی
      // فیلدهای سازگاری در صورت وجود در رکوردهای قبلی
      workingAtHeight?: number;
      lifting?: number;
      heavyMachinery?: number;
      otherAttached?: number;
    };

    // فیلدهای سنجه و نظارت آتش‌نشانی
    confinedSpace: number;           // ورود به فضا بسته
    gasTesters: number;              // GAS Testers
    standby: number;                 // Stand by
    revokedPermits: number;          // مجوز های باطل شده
    notes?: string;

    // فیلدهای اختیاری سازگاری گذشته
    radiographyWork?: number;
    otherMainPermits?: number;
    confinedSpaceManagement?: any;
  };

  // آیتم‌های داینامیک اضافه شده به هر تب
  dynamicCustomItems?: DynamicReportCustomItem[];

  // 3. وضعیت سیستم های اطفای حریق آبی و شیرآلات (Water Fire Suppression & Valves)
  waterSuppressionAndValves: {
    delugeValves: {
      fb8001A: EquipmentOperationalStatus;
      fb8001B: EquipmentOperationalStatus;
      fb4501: EquipmentOperationalStatus;
      fb4502: EquipmentOperationalStatus;
    };
    onOffValveU20: EquipmentOperationalStatus;
    onOffValveU40: EquipmentOperationalStatus;
    railHose: EquipmentOperationalStatus;
    hydrants: EquipmentOperationalStatus;
    monitors: EquipmentOperationalStatus;
    fireBox: EquipmentOperationalStatus;
    notes?: string;
  };

  // 4. وضعیت کپسول های اطفای حریق (Fire Extinguishers)
  fireExtinguishers: {
    powderExisting: {
      kg6: number;
      kg40: number;
    };
    co2Existing: {
      kg6: number;
      kg30: number;
      kg10: number;
    };
    warehouseCharged: {
      co2: number;
      kg6: number;
      kg40: number;
    };
    warehouseUncharged: {
      co2: number;
      kg6: number;
      kg40: number;
    };
  };

  // 5. وضعیت سیستم های اطفای حریق گازی و اعلام حریق (Gaseous Suppression & Fire Alarm)
  gaseousAndAlarmSystems: {
    fm200: {
      unit51: EquipmentOperationalStatus;
      unit54: EquipmentOperationalStatus;
    };
    alarmSystems: {
      callPoints: EquipmentOperationalStatus;     // Call Point (شستی اعلام حریق)
      smokeDetectors: EquipmentOperationalStatus; // دودیاب ها
      heatDetectors: EquipmentOperationalStatus;  // حرارت یاب
      flameDetectors: EquipmentOperationalStatus; // شعله یاب
      hornsSirens: EquipmentOperationalStatus;    // آژیر ها
      mainPanel: EquipmentOperationalStatus;      // تابلو مرکزی
    };
    notes?: string;
  };

  // 6. وضعیت خودرو های آتش‌نشانی ناوگان (Fleet Vehicles)
  vehiclesStatus: VehiclesStatusMap | {
    toyotaHilux?: { status: VehicleOperationalStatus; description?: string };
    man?: { status: VehicleOperationalStatus; description?: string };
    isuzu?: { status: VehicleOperationalStatus; description?: string };
    canter1?: { status: VehicleOperationalStatus; description?: string };
    canter2?: { status: VehicleOperationalStatus; description?: string };
    hino?: { status: VehicleOperationalStatus; description?: string };
    ambulance?: { status: VehicleOperationalStatus; description?: string };
    aerialLift?: { status: VehicleOperationalStatus; description?: string };
    [key: string]: any;
  };

  // 7. وضعیت گازیاب های موجود در مجتمع (Gas Detectors)
  gasDetectorsStatus: {
    fixed: {
      unit01: EquipmentOperationalStatus;
      unit20: EquipmentOperationalStatus;
      unit21: EquipmentOperationalStatus;
      unit40: EquipmentOperationalStatus;
      utility: EquipmentOperationalStatus;
      storageTanks: EquipmentOperationalStatus; // مخازن
      gd: EquipmentOperationalStatus;           // GD
    };
    portable: {
      gasAlertBW: EquipmentOperationalStatus;
      msa: EquipmentOperationalStatus;
      cosmos: EquipmentOperationalStatus;
      crowcon: EquipmentOperationalStatus;
      crowconTriplePlus: EquipmentOperationalStatus;
    };
    notes?: string;
  };

  // 8. ایرادات سیستم اعلام حریق (Fire Alarm Faults)
  alarmSystemFaults: {
    industrialPanel: {
      fault: number;
      fire: number;
      warning: number;
      notes?: string;
    };
    nonIndustrialPanel: {
      fault: number;
      fire: number;
      warning: number;
      notes?: string;
    };
  };

  // 9. انجام بازرسی اولیه و حضور بصورت STANDBY و اسکورت (Standby & Escort)
  standbyAndEscort: {
    propyleneTankerEscorts: number; // تعداد اسکورت تانکر پروپیلن
    propaneTankerEscorts: number;    // تعداد اسکورت تانکر پروپان
    standbyHours: number;           // Standby Hot/cold Work Type (h)
  };

  // 10. نشت گازهای سمی (Gas Leaks)
  gasLeaks: GasLeakRecord[];

  // 11. شرح کار انجام شده (Description of Work Completed)
  workCompletedDescription: string;

  // 12. نواقص (Defects & Issues)
  defectsAndNeeds: string;

  // 13. امضاها و تاییدات نوبتکاران (Shift Officers Sign-offs)
  signatures: {
    dayShiftOfficer: ShiftOfficerSign;
    nightShiftOfficer: ShiftOfficerSign;
  };
}
