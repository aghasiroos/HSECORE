/**
 * Core Types for HSE Dashboard Applications
 */

// --- Heat Stress Monitor Types ---
export interface HeatRecord {
  id: string;
  ts: string; // ISO string
  tempC: number;
  hum: number;
  hi: number;
  hiDisplay: string;
  offChart: boolean;
  cat: 'Normal' | 'Caution' | 'ExtremeCaution' | 'Danger' | 'ExtremeDanger' | 'StopWork';
  subLevel: 'Danger1' | 'Danger2' | null;
  loc: string;
  lat: number;
  lon: number;
  source: string;
  condition: string;
  persianDate: string;
  accuracy: number | null;
  wind?: number;
  windDir?: number;
  feels?: number;
  cloud?: number;
  pressure?: number;
  visibility?: string;
  uv?: number;
  wbgt?: number;
  wbgtShade?: number;
  wbgtIsEstimated?: boolean;
  wbgtMethod?: 'ISO_7243_OUTDOOR_SOLAR_ESTIMATE' | 'ISO_7243_SHADED_PSYCHROMETRIC_ESTIMATE';
  wbgtNoteFa?: string;
  wbgtNoteEn?: string;
  globeTemp?: number;
  solarRadiation?: number;
  isDay?: boolean;
  dewPoint?: number;
  wetBulb?: number;
  observedAt?: string;
  fetchedAt?: string;
  isStale?: boolean;
  aqi?: number;
  pm25?: number;
  pm10?: number;
  co?: number;
  so2?: number;
  no2?: number;
  o3?: number;
  elevation?: number;
  rainProb?: number;
  rainAmount?: number;
  dayLength?: string;
  sunrise?: string;
  sunset?: string;
  code?: number;
  supervisor?: string;
  department?: string;
  provider?: string;
  cached?: boolean;
  hourlyForecast?: HourlyForecastItem[];
  dailyForecast?: DailyForecastItem[];
}

export interface HourlyForecastItem {
  time: string;
  tempC: number;
  feelsC?: number;
  hum: number;
  windSpeed: number;
  windDir?: number;
  precipProb?: number;
  uvIndex?: number;
  isDay?: boolean;
  cloudCover?: number;
  symbol?: string;
  symbolPhrase?: string;
}

export interface DailyForecastItem {
  date: string;
  maxTempC: number;
  minTempC: number;
  maxFeelsC?: number;
  precipAccum?: number;
  precipProb?: number;
  maxWindSpeed?: number;
  uvIndex?: number;
  sunrise?: string;
  sunset?: string;
  symbol?: string;
  symbolPhrase?: string;
}

export interface WeatherInfo {
  tempC: number;
  hum: number;
  feels: number;
  wind: number;
  windDir: number;
  cloud: number;
  pressure: number;
  visibility: string;
  code: number;
  sunrise: string;
  sunset: string;
  uv: number;
  updated: string; // Time string
  provider?: string;
  source?: string;
  cached?: boolean;
  observedAt?: string;
  fetchedAt?: string;
  isStale?: boolean;
  wbgt?: number;
  wbgtShade?: number;
  wbgtIsEstimated?: boolean;
  wbgtMethod?: 'ISO_7243_OUTDOOR_SOLAR_ESTIMATE' | 'ISO_7243_SHADED_PSYCHROMETRIC_ESTIMATE';
  wbgtNoteFa?: string;
  wbgtNoteEn?: string;
  globeTemp?: number;
  solarRadiation?: number;
  isDay?: boolean;
  dewPoint?: number;
  wetBulb?: number;
  hi?: number;
  hiDisplay?: string;
  offChart?: boolean;
  cat?: 'Normal' | 'Caution' | 'ExtremeCaution' | 'Danger' | 'ExtremeDanger' | 'StopWork';
  subLevel?: 'Danger1' | 'Danger2' | null;
  aqi?: number;
  pm25?: number;
  pm10?: number;
  co?: number;
  so2?: number;
  no2?: number;
  o3?: number;
  elevation?: number;
  rainProb?: number;
  rainAmount?: number;
  dayLength?: string;
  hourlyForecast?: HourlyForecastItem[];
  dailyForecast?: DailyForecastItem[];
}

export interface HeatSettings {
  lat: number | null;
  lon: number | null;
  cityLabel: string | null;
  gpsAccuracy: number | null;
  lang: 'en' | 'fa';
  theme: 'dark' | 'light';
  refreshMinutes: number;
  companyName: string;
}

// --- HSE-MS (TRIR & Warnings) Types ---
export interface TrirRecord {
  id: string;
  year: number;
  month: string;
  attendance: number;
  mission: number;
  contractor: number;
  incidents: number;
  notes?: string;
}

export interface WarningRecord {
  id: string;
  day: number;
  month: string;
  year: number;
  number: string;
  site: string;
  name: string;
  unit: string;
  unitId?: string;
  type: 'فردی' | 'واحدی';
  reason: string;
  personnelCode?: string;
  nationalCode?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  supervisor?: string;
  location?: string;
  costCenter?: string;
  fullOrgPath?: string;
  repetitionText?: string;
  issuerName?: string;
  noticeText?: string;
}

export interface TrirSeriesPoint extends TrirRecord {
  E: number; // total attendance + mission
  totalHours: number; // E + contractor
  monthlyTRIR: number;
  rollingTRIR: number;
  monthsInWindow: number;
  label: string;
}

// --- Enterprise User Management & RBAC System ---

export type UserRole =
  | 'Administrator'
  | 'User'
  | 'HSE Manager'
  | 'Safety Officer'
  | 'Contractor'
  | 'Visitor'
  | 'Guest'
  | 'SafetyInspector'
  | 'MedicalStaff'
  | 'Nutritionist'
  | 'کارشناس تغذیه'
  | 'ExecutiveManager'
  | 'MaintenanceManager'
  | 'ProjectManager'
  | 'Auditor'
  | (string & {});

export type UserStatus =
  | 'Active'
  | 'Inactive'
  | 'Suspended'
  | 'Locked'
  | 'Pending Approval'
  | 'Expired';

export type PermissionGroup = string;

export type HierarchicalActionKey =
  | 'view'
  | 'details'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'sign'
  | 'refer'
  | 'export'
  | 'print'
  | 'import'
  | 'emergency'
  | 'configure';

export interface PermissionActions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  print: boolean;
  export: boolean;
  import: boolean;
  details?: boolean;
  reject?: boolean;
  sign?: boolean;
  refer?: boolean;
  emergency?: boolean;
  configure?: boolean;
  [key: string]: boolean | undefined;
}

export type HierarchicalPermissionActions = Record<HierarchicalActionKey, boolean>;

export interface HierarchicalPermissionNode {
  id: string; // e.g. 'dashboards.executive', 'ptw.hot_cold', 'fire_dept.fleet'
  legacyId?: string; // e.g. 'Permit To Work', 'Fire Department'
  titleFa: string;
  titleEn: string;
  category: 'dashboards' | 'departments' | 'safety' | 'processes' | 'workflows' | 'system';
  categoryTitleFa: string;
  categoryTitleEn: string;
  iconName: string;
  descriptionFa: string;
  level: 1 | 2 | 3;
  parentId?: string;
  applicableActions: HierarchicalActionKey[];
  children?: HierarchicalPermissionNode[];
}

export type UserPermissions = Record<string, PermissionActions | Record<string, boolean>>;

export interface AssignedPersonnelItem {
  id: string;
  personnelId?: number;
  personnelCode: string;
  nationalCode: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  unit?: string;
  jobTitle?: string;
  status?: string;
  assignedAt?: string;
  assignedBy?: string;
}

export interface UserProfile {
  id: string;
  uid?: string;
  username: string;
  fullName: string;
  personnelNumber: string;
  nationalId: string;
  departmentIds: string[]; // Can belong to multiple departments
  jobTitle: string;
  phoneNumber: string;
  email: string;
  employmentStatus: string; // 'Full-Time' | 'Contract' | 'Part-Time' etc.
  workShift: string;        // 'Morning' | 'Evening' | 'Night' | 'Rotating'
  supervisor: string;
  emergencyContact: string;
  role: UserRole;
  accountStatus: UserStatus;
  lastLogin?: string; // ISO string
  createdDate: string;
  updatedDate: string;
  profilePhoto?: string; // base64 or placeholder url
  signatureImage?: string; // base64 PNG/JPEG sample signature for referrals and document signing
  digitalSignature?: string; // alias for stored digital signature
  
  // Security parameters
  passwordHash: string;
  failedAttempts: number;
  passwordExpiresAt: string; // ISO string
  forcePasswordChange: boolean;
  mfaEnabled: boolean;
  sessionTimeoutMinutes?: number; // Inactivity auto-logout timeout in minutes (e.g., 5, 10, 15, 30, 60)
  
  // Access Duration & Validity
  accessExpiresAt?: string | null; // Expiration timestamp or Persian date string for access validity
  accessDurationType?: 'permanent' | '1month' | '3months' | '6months' | '1year' | '2years' | 'custom';
  
  // Centralized User-to-Personnel Assignments (PostgreSQL backed)
  personnelAccessScope?: 'ALL' | 'ASSIGNED';
  canAccessAllPersonnel?: boolean;
  assignedPersonnelIds?: string[];
  assignedPersonnelCodes?: string[];
  assignedPersonnel?: AssignedPersonnelItem[];

  // PTW Training Qualification and Issuance Authorization (صلاحیت آموزشی و مجوزهای صدور پروانه کار)
  ptwQualification?: PtwQualificationData;

  // Custom Dynamic Permissions
  permissions: UserPermissions;
}

export type PtwCourseStatus = 'passed' | 'not_passed';
export type PtwCourseResult = 'success' | 'fail';
export type PtwValidityDuration = '6m' | '1y' | '3y' | '5y';
export type PtwQualificationStatus = 'valid' | 'expired' | 'unqualified' | 'incomplete';

export interface PtwQualificationData {
  courseStatus: PtwCourseStatus; // 'passed' | 'not_passed'
  courseResult?: PtwCourseResult; // 'success' | 'fail'
  certificateNumber?: string; // شماره گواهینامه
  issueDate?: string; // تاریخ صدور گواهینامه (شمسی e.g. 1403/08/15)
  validityDuration?: PtwValidityDuration; // '6m' | '1y' | '3y' | '5y'
  expiryDate?: string; // تاریخ انقضا (محاسبه خودکار شمسی)
  status: PtwQualificationStatus; // 'valid' | 'expired' | 'unqualified' | 'incomplete'
  
  // ۲. مجوز پروانه کار اصلی
  mainPermits: {
    hot: boolean;  // کار گرم
    cold: boolean; // کار سرد
  };
  
  // ۳. مسئولیت در فرایند صدور پروانه کار
  responsibilities: {
    issuer: boolean;         // صادرکننده پروانه کار
    executor: boolean;       // مجری کار
    areaSupervisor: boolean; // مسئول محوطه
    safetyUnit: boolean;     // نماینده یا مسئول HSE
  };
  
  // ۴. مجوز پروانه‌های الحاقی
  supplementaryPermits: {
    excavation: boolean;          // حفاری
    confinedSpace: boolean;       // ورود به فضای بسته
    vehicleCrane: boolean;        // ورود جرثقیل یا خودرو به محدوده عملیاتی
    processIsolation: boolean;    // جداسازی فرایندی، مکانیکی و ابزار دقیق
    electricalIsolation: boolean; // جداسازی الکتریکی
    radiation: boolean;           // منابع پرتوزا
    workingAtHeight?: boolean;    // کار در ارتفاع
    lifting?: boolean;            // عملیات لیفتینگ
  };

  updatedAt?: string;
  updatedBy?: string;
}

export interface Department {
  id: string;
  name: string;
  description: string;
  code: string;
  manager: string;
  employeeCount?: number;
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface OrgHierarchy {
  company: string;
  site: string;
  plant: string;
  area: string;
  section: string;
  team: string;
}

export interface AuditLogChange {
  field: string;
  fieldLabel?: string;
  oldValue: any;
  newValue: any;
}

export type ActorType = 'USER' | 'SYSTEM' | 'SCHEDULER' | 'API' | 'WORKFLOW' | 'IMPORT';
export type ActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'VIEW'
  | 'NAVIGATION'
  | 'TAB_SWITCH'
  | 'FIELD_CHANGE'
  | 'CLICK'
  | 'SEARCH'
  | 'FILTER'
  | 'MODAL_OPEN'
  | 'EXPORT'
  | 'PRINT'
  | 'IMPORT'
  | 'APPROVE'
  | 'REJECT'
  | 'SETTINGS_CHANGE'
  | 'PERMISSIONS_CHANGE'
  | 'UPLOAD'
  | 'CLIPBOARD'
  | 'SESSION'
  | 'SOFT_DELETE'
  | 'REVIEW'
  | 'ACCESS_DENIED'
  | 'OTHER';

export type AuditSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AuditCategory =
  | 'DATA_MUTATION'
  | 'FIELD_CHANGE'
  | 'NAVIGATION'
  | 'UI_INTERACTION'
  | 'SEARCH_FILTER'
  | 'EXPORT_PRINT'
  | 'AUTH_SECURITY'
  | 'SYSTEM';

export interface AuditLogEntry {
  id: string;
  ts: string; // ISO string
  tsFa: string; // Persian date and time string
  
  // Actor info
  actorType: ActorType;
  userId?: string;
  username: string;
  fullName?: string;
  userCode?: string;
  userRole?: string;
  department?: string;
  
  // Context
  ip: string;
  gps?: string;
  device: string;
  browser: string;
  viewport?: string;
  sessionId?: string;
  
  // Action info
  actionType: ActionType;
  category?: AuditCategory;
  severity?: AuditSeverity;
  action: string; // Brief summary
  module: string;
  page: string;
  subSection?: string;
  elementTarget?: string;
  recordType?: string;
  recordId?: string;
  
  // Network / Timing / Movement metrics
  httpMethod?: string;
  endpoint?: string;
  statusCode?: number;
  durationMs?: number;
  dwellTimeMs?: number;
  fromPath?: string;
  toPath?: string;
  
  // Changes
  changes?: AuditLogChange[];
  oldValue?: any;
  newValue?: any;
  reason?: string;
  description?: string;
  metadata?: Record<string, any>;
  
  // Outcome
  success: boolean;
  result: string; // e.g. "موفق", "ناموفق"
  errorMessage?: string;
  
  // Correlation & Integrity
  transactionId?: string;
  hash?: string; // Integrity hash of the log entry
}

export interface NotificationEntry {
  id: string;
  notifId?: string;
  ts: string; // ISO string
  createdAt?: string;
  title: string;
  body: string;
  type: 'popup' | 'in-app' | 'push' | 'popup_and_push';
  targetType: 'all' | 'departments' | 'unit_managers' | 'hse_experts' | 'users' | 'roles' | 'single';
  targetValues: string[]; // e.g. role names, user IDs, department IDs
  sender: string;
  readBy: string[]; // User IDs who have read this
  images?: string[];
  sirenType?: string;
  actionGuidelines?: string;
  metadata?: Record<string, any>;
  acknowledgedBy?: Array<{
    userId: string;
    userName?: string;
    timestamp: string;
    note?: string;
    acknowledgmentSource?: string;
  }>;
  viewedBy?: Array<{
    userId: string;
    userName?: string;
    timestamp: string;
    source: string;
    deviceType?: string;
  }>;
  deliveryReport?: {
    dispatchedAt: string;
    inAppPopupDelivered: boolean;
    webPushAttempted: boolean;
    totalTargetedDevices: number;
    pushSentCount: number;
    pushFailedCount: number;
    pushExpiredRemovedCount: number;
    deviceLogs: Array<{
      subscriptionId: string;
      userId?: string;
      userName?: string;
      deviceType?: string;
      deviceName?: string;
      endpointDomain?: string;
      status: 'delivered' | 'failed' | 'expired';
      statusCode?: number;
      errorMessage?: string;
      timestamp: string;
    }>;
  };
}

// --- Work Permit (پروانه کار) Types ---
export interface GasTestParams {
  o2: { value: number; unit: string; min: number; max: number; status: 'allowable' | 'not-allowable' };
  lel: { value: number; unit: string; max: number; status: 'allowable' | 'not-allowable' };
  h2s: { value: number; unit: string; max: number; status: 'allowable' | 'not-allowable' };
  co: { value: number; unit: string; max: number; status: 'allowable' | 'not-allowable' };
  voc?: { value: number; unit: string; max: number; status: 'allowable' | 'not-allowable' };
}

export type PermitCategory = 
  | 'Hot'                 // پروانه کار اصلی - کار گرم
  | 'Cold'                // پروانه کار اصلی - کار سرد
  | 'Excavation'          // الحاقی حفاری
  | 'ProcessMechanical'   // الحاقی جداسازی فرآیندی / مکانیکی / ایزوله دقیق
  | 'ConfinedSpace'       // الحاقی ورود به فضای بسته
  | 'ElectricalIsolation' // الحاقی جداسازی الکتریکی
  | 'Radiation'           // الحاقی منابع پرتوزا
  | 'VehicleCrane';       // الحاقی ورود جرثقیل / خودرو

export interface ExcavationDetails {
  depthMeter: number;
  soilType: 'Loose' | 'Compact' | 'Rocky' | 'Cohesive';
  cableDetectorUsed: boolean;
  shoringRequired: boolean;
  handDigRadiusMeter: number;
  undergroundUtilitiesChecked: boolean;
}

export interface ProcessIsolationDetails {
  lineTag: string;
  fluidType: string;
  pressureBar: number;
  tempC: number;
  isolationMethod: 'Spade/Blind' | 'Double Block & Bleed' | 'Single Valve Lockout';
  purgedWithN2: boolean;
  depressurized: boolean;
  lotoTagNumber: string;
}

export interface ConfinedSpaceDetails {
  spaceName: string;
  entryPurpose: string;
  ventilationMethod: 'Forced Air Blower' | 'Natural' | 'Eductor';
  standbyWatcherName: string;
  harnessLifelineChecked: boolean;
  rescuePlanAttached: boolean;
  communicationChannel: string;
  maxEntryDurationHours: number;
}

export interface ElectricalIsolationDetails {
  voltageLevel: 'Low Voltage (<1kV)' | 'High Voltage (>1kV)' | 'Medium Voltage';
  switchgearTag: string;
  substationName: string;
  fuseRemoved: boolean;
  groundedToEarth: boolean;
  zeroVoltageVerified: boolean;
  lotoLockNumber: string;
}

export interface RadiationDetails {
  isotopeType: 'Ir-192' | 'Co-60' | 'Se-75' | 'X-Ray Machine';
  activityCurie: number;
  rsoName: string; // Radiation Safety Officer
  barricadeRadiusMeter: number;
  dosimeterChecked: boolean;
  exposureTimeLimitMinutes: number;
  controlledAreaSignage: boolean;
}

export interface VehicleCraneDetails {
  vehicleType: 'Mobile Crane' | 'Heavy Truck' | 'Boom Truck' | 'Forklift' | 'Excavator';
  vehiclePlateNo: string;
  inspectionCertNo: string;
  maxCapacityTons: number;
  sparkArrestorFitted: boolean;
  outriggerPadsUsed: boolean;
  groundLoadCapacityVerified: boolean;
  driverLicenseNo: string;
}

export interface InspectionCycle {
  id: string;
  cycleNumber: number; // 1, 2, 3, etc.
  inspectedAt: string; // ISO date string
  persianDate: string; // e.g. 1403/08/15 10:30
  inspectorName: string;
  inspectorRole: string;
  findings: string;
  checklistResults: Record<string, 'بله' | 'خیر' | 'لازم نیست'>;
  gasTestResults?: {
    testTime: string;
    testerName: string;
    o2: number;
    lel: number;
    h2s: number;
    co: number;
    voc?: number;
    status: 'Approved' | 'Rejected';
    notes?: string;
  };
  safetyApproved: boolean;
  status: 'Approved' | 'Conditional' | 'Rejected';
  notes?: string;
  correctiveActionsRequired?: string;
}

export interface PermitAuditLog {
  id: string;
  user: string;
  userRole?: string;
  timestamp: string;
  persianDateTime: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  details: string;
  version: number;
}

export type PermitWorkflowStatus = 
  | 'Draft' 
  | 'Requested' 
  | 'RiskAssessment' 
  | 'HSEReview' 
  | 'Approved' 
  | 'Issued' 
  | 'Active' 
  | 'Suspended' 
  | 'Extended' 
  | 'Closed' 
  | 'Finished' 
  | 'Expired' 
  | 'Cancelled' 
  | 'Awaiting Approval';

export interface PermitSignatureTier {
  roleKey: 'issuer' | 'executor' | 'areaSupervisor' | 'safetyUnit';
  roleTitle: string;
  declarationText: string;
  name: string;
  time: string;
  date?: string;
  signatureImage?: string;
  status?: 'Approved' | 'Pending' | 'Rejected';
  signedAt?: string;
  signedByUser?: string;
  signedByRole?: string;
  persianTimestamp?: string;
  notes?: string;
  userId?: string;
  personnelCode?: string;
  userJobTitle?: string;
}

export interface PermitClosureSignTier {
  roleKey: 'executor' | 'areaSupervisor' | 'issuer';
  roleTitle: string;
  name: string;
  time: string;
  status?: 'Approved' | 'Pending';
  signatureImage?: string;
  signedAt?: string;
  signedByUser?: string;
  signedByRole?: string;
  persianTimestamp?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  userRole?: string;
  timestamp: string;
  persianDateTime: string;
  action: string;
  details: string;
  version: number;
}

export interface PermitClosureDetails {
  closedAt?: string;
  delay1From?: string;
  delay1To?: string;
  delay1Reason?: string;
  delay2From?: string;
  delay2To?: string;
  delay2Reason?: string;
  permitStatus?: 'completed' | 'suspended' | 'continued' | '';
  continuedPermitNo?: string;
  closureChecks?: Record<number, 'بله' | 'خیر' | 'لازم نیست' | ''>;
  signatures: {
    executor: PermitClosureSignTier;
    areaSupervisor: PermitClosureSignTier;
    issuer?: PermitClosureSignTier;
  };
}

export interface PermitSignatures4Tier {
  issuer: PermitSignatureTier;
  executor: PermitSignatureTier;
  areaSupervisor: PermitSignatureTier;
  safetyUnit: PermitSignatureTier;
  coordinationSigners?: any;
}

export interface WorkPermit {
  id: string;
  serialNumber: string;
  rowNumber: number;
  day: number;
  month: string;
  year: number;
  permitType: 'Hot' | 'Cold'; // legacy field kept for backward compatibility
  permitCategory: PermitCategory; // Categorization into main & supplementary
  attachedPermits: {
    confinedSpace: boolean; // فضای بسته
    confinedSpaceSerial?: string;
    excavation: boolean; // حفاری
    excavationSerial?: string;
    workingAtHeight: boolean; // کار در ارتفاع
    workingAtHeightSerial?: string;
    electrical: boolean; // برق
    electricalSerial?: string;
    lifting: boolean; // جرثقیل و عملیات لیفتینگ
    liftingSerial?: string;
    processIsolation?: boolean;
    processIsolationSerial?: string;
    radiation?: boolean;
    radiationSerial?: string;
    vehicleCrane?: boolean;
    vehicleCraneSerial?: string;
  };
  description: string;
  location: string;
  equipmentName: string;
  department?: string;
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  startHour: string;
  endHour: string;
  workShift: 'Morning' | 'Evening' | 'Night'; // صبح، عصر، شب
  gasTestRequired: 'Completed' | 'Not Required';
  gasTest?: {
    testTime: string;
    testerName: string;
    o2: number;
    lel: number;
    h2s: number;
    co: number;
    voc?: number;
    status: 'Approved' | 'Rejected';
  };
  safetyInspection: 'Approved' | 'Not Approved';
  standByHse: string; // ساعت حضور افسر HSE نگهبان
  responsibles: {
    unitSupervisor: string; // نام سرپرست واحد
    jobExecutor: string; // نام مجری کار
    safetyUnit: string; // نماینده واحد ایمنی
    registeredBy: string; // ثبت‌کننده پروانه
  };
  qualifiedPersonnel?: string; // نام افراد دارای صلاحیت مهارت فنی و سلامت فردی
  equipmentNumber?: string;
  woNumber?: string;
  maintenanceType?: 'OH' | 'PM' | 'EM' | 'Other';
  machineryRequired?: string;
  usedEquipment?: string[];
  inspections?: Record<string, 'بله' | 'خیر' | 'لازم نیست'>;
  ppeRequired?: string[];
  hazards?: string[];
  fireGasNeeds?: Record<string, 'بله' | 'خیر' | 'لازم نیست'>;

  // Specific details based on permit category
  excavationDetails?: ExcavationDetails;
  processIsolationDetails?: ProcessIsolationDetails;
  confinedSpaceDetails?: ConfinedSpaceDetails;
  electricalDetails?: ElectricalIsolationDetails;
  radiationDetails?: RadiationDetails;
  vehicleCraneDetails?: VehicleCraneDetails;

  status: PermitWorkflowStatus;
  createdDate: string;
  updatedDate: string;
  renewals: { date: string; extendedUntil: string; approvedBy: string; reason?: string }[];
  suspension?: { reason: string; date: string; suspendedBy: string; resumedDate?: string };
  closure?: { closedBy: string; date: string; handoverStatus: 'Cleaned' | 'Restored' | 'Pending'; notes?: string };
  closureDetails?: PermitClosureDetails;
  cancellation?: { reason: string; date: string; cancelledBy: string };
  signatures: { role: string; name: string; date: string; status: 'Approved' | 'Rejected' | 'Pending'; signatureImage?: string; comments?: string }[];
  signatures4Tier?: PermitSignatures4Tier;
  customFields?: Record<string, any>;
  auditLogs: PermitAuditLog[];
  inspectionCycles?: InspectionCycle[];
  currentInspectionCycle?: number;
  version: number;
  latitude?: number;
  longitude?: number;
  holidayWarningConfirmed?: boolean;
  holidayAuditTrail?: {
    isHoliday: boolean;
    holidayTitle?: string;
    dateShamsi: string;
    timeTehran: string;
    issuerName: string;
    issuerPersonnelCode: string;
    issuerVerifiedJobTitle: string;
    warningConfirmedAt: string;
    warningConfirmedBy: string;
  };
}




export interface ContractorData {
  id: string;
  name: string;
  headcount: number;
  perCapita: number;
}

export interface CourseData {
  id: string;
  name: string;
  headcount: number;
  hours: number;
}

// --- OSHA PPE (Personal Protective Equipment) Types ---
export type OshaPpeCategory = 
  | 'Head Protection (OSHA 1910.135)'
  | 'Eye & Face Protection (OSHA 1910.133)'
  | 'Respiratory Protection (OSHA 1910.134)'
  | 'Foot Protection (OSHA 1910.136)'
  | 'Hand & Arm Protection (OSHA 1910.138)'
  | 'Hearing Protection (OSHA 1910.95)'
  | 'Fall Protection (OSHA 1926.502)'
  | 'Body & High-Vis Clothing';

export interface PpeItem {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  category: OshaPpeCategory;
  oshaStandard: string; // e.g., 'ANSI Z87.1', 'ANSI Z89.1 Type II', 'NIOSH N95', 'ASTM F2413'
  totalStock: number;
  allocatedStock: number;
  availableStock: number;
  reorderLevel: number;
  unitCostToman: number;
  lifespanMonths: number;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Discontinued';
}

export interface PpeIssuanceRecord {
  id: string;
  issueCode: string;
  personnelName: string;
  personnelCode: string;
  department: string;
  jobTitle: string;
  ppeItemId: string;
  ppeItemName: string;
  category: OshaPpeCategory;
  quantity: number;
  sizeOrSpec: string;
  serialNumber?: string;
  issueDate: string; // Jalali or ISO
  expiryDate: string;
  conditionOnIssue: 'New' | 'Inspected & Cleared' | 'Refurbished';
  status: 'Active' | 'Due for Replacement' | 'Expired' | 'Damaged/Replaced' | 'Returned';
  issuerName: string;
  acknowledgedByWorker: boolean;
  notes?: string;
}

export interface PpeInspectionRecord {
  id: string;
  inspectionDate: string;
  ppeType: string;
  serialNumber: string;
  inspectorName: string;
  department: string;
  passStatus: 'Pass' | 'Fail - Repair Required' | 'Fail - Condemned';
  checklistResults: { item: string; status: 'OK' | 'Defective' | 'N/A' }[];
  remarks: string;
}

// --- OSHA Safety Anomaly & Incident Management (29 CFR 1904) ---
export type IncidentCategory = 'Unsafe Act' | 'Unsafe Condition' | 'Near Miss' | 'Incident' | 'Toxic Gas Leak';
export type OshaSeverityLevel = 'Minor / First Aid' | 'Moderate / Medical Treatment' | 'High / Restricted Work' | 'Critical / Lost Time (LTI)' | 'Fatality';
export type AnomalyTypeFa = 'عمل ناایمن' | 'شرایط ناایمن' | 'شبه حادثه' | 'حادثه' | 'نشت گازهای سمی';

export interface CapaAction {
  id: string;
  description: string;
  responsiblePerson: string;
  department: string;
  targetDate: string;
  completionDate?: string;
  status: 'Open' | 'In Progress' | 'Closed' | 'Overdue';
  verificationNotes?: string;
}

export type RhsF68RiskLevel = 'L' | 'M' | 'H' | 'E';

export type RhsF68WorkflowStage =
  | 'DRAFT'
  | 'HSE_HEAD_TRIAGE'
  | 'HSE_EXPERT_REVIEW'
  | 'ACTION_IN_PROGRESS'
  | 'HSE_FINAL_APPROVAL'
  | 'CLOSED'
  | 'RETURNED';

export interface RhsF68InvolvedPerson {
  id: string;
  personnelCode?: string;
  fullName: string;
  company?: string;
  department?: string;
  jobTitle?: string;
  isContractor?: boolean;
  roleInEvent?: string;
}

export interface RhsF68AttachmentItem {
  fileId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  fileUrl?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export interface RhsF68EventFactorCategory {
  selectedItems: string[];
  customNote?: string;
}

export interface RhsF68EventFactors {
  hazardousPosition: RhsF68EventFactorCategory;
  hazardousActions: RhsF68EventFactorCategory;
  hseRulesViolation: RhsF68EventFactorCategory;
  recklessDriving: RhsF68EventFactorCategory;
  workersPosition: RhsF68EventFactorCategory;
  standardActions: RhsF68EventFactorCategory;
  standardConditions: RhsF68EventFactorCategory;
  basicCauses: RhsF68EventFactorCategory;
}

export interface RhsF68HseUnitReview {
  inspectionStatus: 'INSPECTED' | 'NO_INSPECTION_NEEDED' | 'PENDING';
  inspectionResult?: string;
  actionRequired: boolean;
  assignedExpertCode?: string;
  assignedExpertName?: string;
  assignedExpertJobTitle?: string;
  hseHeadNotes?: string;
  hseHeadName?: string;
  hseHeadPersonnelCode?: string;
  hseHeadSignature?: string;
  hseHeadSignedDate?: string;
}

export interface RhsF68RiskAssessment {
  probability: number; // 1 to 5 (احتمال وقوع)
  severity: number;    // 1 to 5 (شدت پیامد)
  detection: number;   // 1 to 5 (قابلیت تشخیص)
  rpn: number;         // P * S * D (1 to 125)
  riskLevel: RhsF68RiskLevel; // L (1-10) | M (11-24) | H (25-49) | E (50-125)
  riskLevelFa: string;
  assessedBy?: string;
  assessedDate?: string;
}

export interface RhsF68CorrectiveFollowUp {
  correctiveActionNumber?: string;
  workOrderNumber?: string;
  letterNumber?: string;
  actionsTakenDescription?: string;
  actionDate?: string;
  dueDate?: string;
  responsibleUnit?: string;
  responsiblePerson?: string;
  responsiblePersonnelCode?: string;
  actionResults?: string;
  followUpStatus?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  expertName?: string;
  expertPersonnelCode?: string;
  expertSignature?: string;
  expertSignedDate?: string;
}

export interface RhsF68FinalConclusion {
  decision?: 'APPROVE_CLOSE' | 'RETURN_FOR_REVISION' | '';
  conclusionNotes?: string;
  finalHseHeadName?: string;
  finalHseHeadPersonnelCode?: string;
  finalHseHeadSignature?: string;
  finalApprovedDate?: string;
}

export interface RhsF68AuditEntry {
  id: string;
  timestamp: string;
  jalaliDateTime?: string;
  actorName: string;
  actorUsername?: string;
  actorRole?: string;
  actorPersonnelCode?: string;
  action: string;
  fromStage?: RhsF68WorkflowStage | string;
  toStage?: RhsF68WorkflowStage | string;
  details?: string;
  referredToName?: string;
  referredToCode?: string;
  referralNote?: string;
}

export interface RhsF68Data {
  formCode: 'RHS-F68 Rev.01';
  reportDate: string;
  companyName?: string;
  reporterJobTitle?: string;
  exactLocation?: string;
  referTargetType?: 'HSE_HEAD' | 'HSE_EXPERT';
  involvedPersonnel: RhsF68InvolvedPerson[];
  suggestions?: string;
  reporterSignature?: string;
  reporterSignedDate?: string;
  attachments: RhsF68AttachmentItem[];
  hseUnitReview: RhsF68HseUnitReview;
  eventFactors: RhsF68EventFactors;
  riskAssessment?: RhsF68RiskAssessment;
  correctiveFollowUp: RhsF68CorrectiveFollowUp;
  finalConclusion: RhsF68FinalConclusion;
  auditHistory: RhsF68AuditEntry[];
}

export interface RhsF28Data {
  formCode: 'RHS-F28 Rev.01';
  reportDate: string;
  reporterName: string;
  reporterPersonnelCode: string;
  department: string;
  observationDate: string;
  observationTime: string;
  locationSite: string;
  exactLocation?: string;
  isIncidentEvent: boolean;
  injuredPersonName: string;
  injuredPersonCode?: string;
  injuredPersonJobTitle: string;
  injuredBodyPart: string;
  description: string;
  damagesOrInjuries: string;
  actionsTaken: string;
  recommendations: string;
  otherNotes: string;
  attachments: RhsF68AttachmentItem[];
  reporterSignature?: string;
  reporterSignedDate?: string;
  hseCenterHeadNotes?: string;
  hseCenterHeadName?: string;
  hseCenterHeadPersonnelCode?: string;
  hseCenterHeadSignature?: string;
  hseCenterHeadSignedDate?: string;
  auditHistory: RhsF68AuditEntry[];
}

export interface SafetyIncidentRecord {
  id: string;
  reportNumber: string; // e.g., RHS-F68-1405-001 or RHS-F28-1405-001
  formVariant?: 'RHS-F68' | 'RHS-F28';
  category: IncidentCategory;
  categoryFa: AnomalyTypeFa;
  incidentTypeId?: string; // Links to configured HSE Incident Categories in Organization Management
  title: string;
  reportDate?: string;
  eventDate: string; // YYYY/MM/DD
  eventTime: string; // HH:mm
  locationSite: string; // e.g., 'کارخانه اصلی - واحد تولید'
  department: string;
  companyName?: string;
  exactLocation?: string;
  reporterName: string;
  reporterPersonnelCode?: string;
  reporterJobTitle?: string;
  reporterRole: string;
  
  // Risk Assessment (for Unsafe Act / Unsafe Condition / Near Miss)
  riskAssessment?: {
    probability: number;  // 1 to 5 (ضریب احتمال)
    severity: number;     // 1 to 5 (ضریب شدت)
    detection: number;    // 1 to 5 (ضریب کشف / قابلیت تشخیص)
    envSeverity?: number; // legacy optional
    rpn: number;          // Calculated RPN (1 to 125)
    riskLevel?: RhsF68RiskLevel;
    riskLevelFa: string;  // 'پایین (L)' | 'متوسط (M)' | 'بالا (H)' | 'شدید / بارز (E)'
    riskLevelColor: 'green' | 'yellow' | 'orange' | 'red';
  };

  // Incident Details
  description: string;
  immediateActionTaken: string;
  
  // Severity & OSHA Recordability
  severity: OshaSeverityLevel;
  isOshaRecordable: boolean; // OSHA 300 Recordable
  lostDays: number; // Days away from work or restricted activity
  
  // Injured Person Details (if applicable)
  injuredPersonName?: string;
  injuredPersonCode?: string;
  bodyPartAffected?: 'Head' | 'Eyes' | 'Hands/Fingers' | 'Feet/Toes' | 'Back/Spine' | 'Multiple' | 'None';
  medicalTreatmentType?: 'First Aid' | 'On-Site Medical' | 'Hospitalized' | 'Emergency Surgery' | 'N/A';

  // Root Cause Analysis (RCA)
  rootCauses?: {
    humanFactors: string[]; // e.g., 'عدم رعایت دستورالعمل', 'خستگی'
    equipmentFactors: string[]; // e.g., 'نقص تجهیزات', 'عدم حفاظ گذاری'
    environmentalFactors: string[]; // e.g., 'نور نامناسب', 'سطح لغزنده'
    systemicFactors: string[]; // e.g., 'عدم آموزش کافی', 'پایش ضعیف'
  };
  fiveWhys?: string[]; // 5 Whys analysis
  
  // Toxic Gas Leak details
  toxicGasLeak?: {
    gasType: string;
    gasAmountPpm: number;
    windSpeed: string;
    windDirection: string;
    leakLocations: string;
    leakDurationMinutes: number;
  };
  
  // CAPA
  capaList?: CapaAction[];
  
  // Supplementary Incident Analysis Form (RHS-F34)
  supplementaryFormId?: string;
  supplementaryFormStatus?: SupplementaryFormStatus;
  supplementaryForm?: IncidentSupplementaryForm;

  // RHS-F68 Rev.01 & RHS-F28 Rev.01 Structured Workflow & Form Payloads
  workflowStage?: RhsF68WorkflowStage;
  isDraft?: boolean;
  attachedFileIds?: string[];
  rhsF68?: RhsF68Data;
  rhsF28?: RhsF28Data;
  version?: number;
  updatedAt?: string;

  status: 'Submitted' | 'Under Investigation' | 'CAPA In Progress' | 'Resolved & Closed';
  attachmentsCount?: number;
  createdDate: string;
}

// --- RHS-F34 Supplementary Incident Analysis Form Types ---
export type SupplementaryFormStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_approval'
  | 'returned'
  | 'completed'
  | 'expired';

export type RhsF34WorkflowStage =
  | 'PENDING_ANALYSIS'
  | 'IN_PROGRESS'
  | 'PENDING_APPROVAL'
  | 'RETURNED'
  | 'COMPLETED';

export interface IncidentFormAuditLog {
  id: string;
  user: string;
  userCode?: string;
  role: string;
  action:
    | 'create'
    | 'update'
    | 'draft_save'
    | 'finalize'
    | 'unlock_edit'
    | 'assign'
    | 'submit_approval'
    | 'approve'
    | 'return'
    | 'auto_nc'
    | 'update_nc';
  actionFa: string;
  timestamp: string; // Persian date & time or ISO
  details?: string;
  outcome?: string;
}

export interface IncidentSupplementaryForm {
  id: string; // e.g., 'rhs-f34-104'
  incidentId: string;
  incidentReportNumber: string;

  // Header Meta (matching PDF)
  formCode: string; // 'RHS – F34'
  revision: string; // '00'
  formNumber: string; // 'RGC-HSE/1405-2'
  formDate: string; // '1405.05.28'
  distributionList: string; // 'توزیع نسخ: ۱- مدیریت امور مجتمع ۲- واحد HSE ۳- امور اداری'

  // ۱- رویداد و گزارش (General & Event Data)
  eventDateTime?: string; // legacy support
  eventDate: string; // تاریخ رویداد
  eventTime: string; // ساعت رویداد
  exactLocation: string; // محل دقیق رویداد
  reportDateTime?: string; // legacy support
  reportDate: string; // تاریخ گزارش رویداد
  reportTime: string; // ساعت گزارش رویداد
  locationOccurrence: string; // مکان بروز
  reporterNameAndRole: string; // نام و سمت گزارش دهنده
  victimOrgUnit: string; // واحد سازمانی مصدوم
  activityDuringIncident: string; // فعالیت حین حادثه
  victimCount: number | string; // تعداد مصدومین /قربانیان

  // برآورد خسارات
  estimatedLoss: string; // برآورد میزان خسارات جانی / مالی

  // ۲- شرح مختصر رویداد
  briefDescription: string; // ۲- شرح مختصر رویداد

  // ۳- داده های ماتریس شدت ( شدت ریسک )
  riskSeverityMatrix?: 'High' | 'Medium' | 'Low' | 'Minimal' | '';

  // ۴- علل مستقیم
  directCauses: string;

  // ۵- علل غیرمستقیم
  indirectCauses: string;

  // ۶- علل ریشه ای
  rootCauses: string;

  // ۷- اطلاعات مصدوم (قربانی)
  victimName: string; // نام و نام خانوادگی
  victimPersonnelCode: string; // شماره پرسنلی
  victimDepartment: string; // واحد سازمانی
  victimWorkExperience: string; // سابقه کار
  injuryType: string; // نوع آسیب
  injuredBodyPart: string; // عضو آسیب دیده
  medicalTreatment: string; // اقدام درمانی
  lostWorkDays: number | string; // تعداد روزهای تلف شده

  // ۸- اقدام اصلاحی و پیشگیرانه مورد نیاز
  capaFormNumber: string; // شماره فرم اقدام اصلاحی / پیشگیرانه (e.g., R\1405\E112\21212)
  capaRequiredActions: string; // شرح اقدام اصلاحی و پیشگیرانه مورد نیاز

  // تاریخ‌ها و امضا (10-day legal window anchored on RHS-F28 final approval date)
  startDate: string; // تاریخ شروع مهلت (تاریخ تأیید نهایی RHS-F28)
  endDate: string; // تاریخ پایان مهلت / اتمام (حداکثر ۱۰ روز تقویمی)
  f28FinalApprovedDate?: string; // مبدأ رسمی محاسبه مهلت (تأیید نهایی RHS-F28)
  f28ApprovedAtIso?: string;
  hseExpertName: string; // نام و نام خانوادگی کارشناس واحد HSE
  hseExpertPersonnelCode?: string;
  hseExpertSignature?: string; // امضا کارشناس
  hseExpertApproved?: boolean;

  // ارجاع و تأییدیه رئیس HSE
  workflowStage?: RhsF34WorkflowStage;
  assignedExpertCode?: string;
  assignedExpertName?: string;
  hseHeadReviewerName?: string;
  hseHeadReviewerCode?: string;
  hseHeadSignature?: string;
  hseHeadReviewNotes?: string;
  hseHeadApprovedAt?: string;

  // مستندات و پیوست‌ها
  attachments?: RhsF68AttachmentItem[];

  // وضعیت و فرآیند مهلت قانونی ۱۰ روزه
  status: SupplementaryFormStatus;
  deadlineDate: string; // تاریخ پایان مهلت ۱۰ روز تقویمی از تأیید نهایی RHS-F28
  daysRemaining: number;
  daysPassed?: number;
  isNearDeadline?: boolean;
  isExpired: boolean;

  // عدم انطباق خودکار ناشی از عبور از مهلت ۱۰ روزه
  nonConformanceId?: number | string;
  nonConformanceTrackingCode?: string;
  nonConformanceTitle?: string;
  nonConformanceStatus?: string;
  nonConformanceAssignedTo?: string;
  nonConformanceAssignedToName?: string;
  nonConformanceDueDate?: string;
  nonConformanceCorrectiveAction?: string;
  nonConformanceCreatedAt?: string;

  // سوابق تغییرات و رهگیری کامل مراحل
  auditLogs: IncidentFormAuditLog[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
}

// -------------------------------------------------------------
// Document & Form Referral and Digital Signature Types (ارجاع و امضای مدارک)
// -------------------------------------------------------------

export type ReferralActionType = 
  | 'REVIEW'          // بررسی
  | 'APPROVE'         // تأیید
  | 'REJECT'          // رد
  | 'SIGN'            // امضا
  | 'APPROVE_AND_SIGN'; // تأیید و امضا

export type ReferralStatus = 
  | 'PENDING'    // در انتظار اقدام
  | 'REVIEWED'   // بررسی شده
  | 'APPROVED'   // تأیید شده
  | 'REJECTED'   // رد شده
  | 'SIGNED'     // امضا شده
  | 'DELEGATED'; // ارجاع مجدد

export type ReferralWorkflowMode = 'SEQUENTIAL' | 'PARALLEL'; // ترتیبی یا موازی

export type DocumentSourceType = 
  | 'PERMIT'               // پروانه کار ایمن (PTW)
  | 'PTW_AUDIT'            // ممیزی پروانه کار (PTW Audit)
  | 'NON_CONFORMANCE'      // پرونده عدم انطباق و اقدامات اصلاحی (CAPA)
  | 'INCIDENT'             // گزارش رویداد و شبه‌حادثه
  | 'INCIDENT_SUPPLEMENT'  // فرم تکمیلی رویداد
  | 'AUDIT_CHECKLIST'      // چک‌لیست و ممیزی ایمنی
  | 'SAFETY_WARNING'       // اخطار کتبی ایمنی
  | 'WARNING'              // اخطار کتبی انضباطی
  | 'RISK_ASSESSMENT'      // ارزیابی ریسک
  | 'PPE_REQUEST'          // فرم تحویل تجهیزات فردی
  | 'FIRE_PERMIT'          // پروانه آتش‌نشانی
  | 'OTHER_DOC';           // سایر اسناد

export interface ReferralHistoryLog {
  id: string;
  action: 'CREATE' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'SIGN' | 'RE_REFER' | 'DELEGATE' | 'COMMENT' | 'REVISE';
  actionTitleFa: string;
  userId: string;
  userName: string;
  userRole?: string;
  userJobTitle?: string;
  department?: string;
  timestamp: string;      // ISO string
  persianDateTime: string; // e.g., 1405/06/23 11:45
  comment: string;
  signatureImage?: string; // Base64 digital signature
  statusBefore?: ReferralStatus;
  statusAfter?: ReferralStatus;
  version?: string;        // e.g. Rev 1.0, Rev 1.1
}

export interface ReferralAssignee {
  id: string;
  userId: string;
  userName: string;
  userRole?: string;
  userJobTitle?: string;
  department?: string;
  personnelCode?: string;
  actionType: ReferralActionType;
  deadline?: string;         // Jalali date or ISO
  approvalTime?: string;     // ساعت تایید هماهنگ با بخش ارجاع و امضا
  instructions?: string;     // توضیحات و دستور اقدام
  status: ReferralStatus;
  statusDate?: string;
  comment?: string;
  signatureImage?: string;   // Digital drawn/stored signature
  signedAt?: string;
  signedAtPersian?: string;
  order?: number;            // For sequential workflow (1, 2, 3...)
  isCurrentActive?: boolean; // For sequential workflow: is it currently this assignee's turn?
}

export interface DocumentReferral {
  id: string;
  documentType: DocumentSourceType;
  documentId: string;
  documentNumber: string;    // e.g. PTW-1405-001 or REGAL-1404-002
  documentTitle: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderDepartment?: string;
  workflowMode: ReferralWorkflowMode; // ترتیبی یا موازی
  assignees: ReferralAssignee[];
  overallStatus: 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  version?: string;          // کنترل نسخه e.g. Rev 1.0, Rev 1.1
  revisionReason?: string;   // علت ویرایش یا تغییر نسخه
  notes?: string;
  deadline?: string;
  isLocked: boolean; // قفل شدن نسخه تأیید/امضا شده جهت جلوگیری از ویرایش
  createdDate: string;
  createdDatePersian: string;
  updatedDate: string;
  historyLogs: ReferralHistoryLog[];
}


