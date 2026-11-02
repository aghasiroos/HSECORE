import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ==========================================
// 1. Users, Roles & Authentication
// ==========================================
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull(), // Unique user identifier (UUID or system user ID)
    username: text('username'),
    email: text('email').notNull(),
    fullName: text('full_name'),
    personnelNumber: text('personnel_number'),
    nationalId: text('national_id'),
    phoneNumber: text('phone_number'),
    jobTitle: text('job_title'),
    role: text('role').default('User').notNull(),
    accountStatus: text('account_status').default('Active').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    personnelAccessScope: text('personnel_access_scope').default('ASSIGNED').notNull(), // 'ALL' | 'ASSIGNED'
    permissions: jsonb('permissions'),
    profileData: jsonb('profile_data'),
    passwordHash: text('password_hash'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_uid_idx').on(table.uid),
  ]
);

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  notifId: text('notif_id').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type').default('in-app').notNull(), // popup, in-app, alert, REFERRAL, etc.
  targetType: text('target_type').default('all'), // all, roles, departments, user, single
  targetValues: jsonb('target_values'),
  sender: text('sender'),
  readBy: jsonb('read_by'),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  priority: text('priority').default('medium').notNull(), // low, medium, high, critical
  category: text('category').default('info').notNull(), // info, success, warning, error, critical_hse
  sourceModule: text('source_module').default('system'), // ptw, heat, incidents, fire-dept, safety-unit, health-env, training, risk, ppe, workflow, system
  actionUrl: text('action_url'), // Link to screen/record e.g. '#permit?id=PTW-101'
  recordId: text('record_id'),
  requiresAck: boolean('requires_ack').default(false).notNull(),
  acknowledgedBy: jsonb('acknowledged_by'), // array of { userId, userName, timestamp, comment }
  metadata: jsonb('metadata'), // structured payload
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 2. Organizational Hierarchy
// ==========================================
export const orgCompanies = pgTable('org_companies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orgSites = pgTable('org_sites', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').references(() => orgCompanies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orgDepartments = pgTable('org_departments', {
  id: serial('id').primaryKey(),
  siteId: integer('site_id').references(() => orgSites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orgUnits = pgTable('org_units', {
  id: serial('id').primaryKey(),
  departmentId: integer('department_id').references(() => orgDepartments.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const orgPositions = pgTable('org_positions', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  code: text('code'),
  riskLevel: text('risk_level').default('LOW'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 3. Personnel Management (Master Records)
// ==========================================
export const personnel = pgTable(
  'personnel',
  {
    id: serial('id').primaryKey(),
    personnelCode: text('personnel_code').notNull(),
    nationalCode: text('national_code').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    fatherName: text('father_name'),
    gender: text('gender').default('MALE'),
    birthDate: text('birth_date'),
    hireDate: text('hire_date'),
    companyId: integer('company_id').references(() => orgCompanies.id, { onDelete: 'set null' }),
    siteId: integer('site_id').references(() => orgSites.id, { onDelete: 'set null' }),
    departmentId: integer('department_id').references(() => orgDepartments.id, { onDelete: 'set null' }),
    unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
    positionId: integer('position_id').references(() => orgPositions.id, { onDelete: 'set null' }),
    jobTitle: text('job_title'),
    shiftType: text('shift_type').default('DAY'),
    employmentType: text('employment_type').default('OFFICIAL'),
    mobile: text('mobile'),
    bloodGroup: text('blood_group'),
    status: text('status').default('ACTIVE').notNull(),
    extraData: jsonb('extra_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('personnel_code_idx').on(table.personnelCode),
    uniqueIndex('personnel_national_code_idx').on(table.nationalCode),
  ]
);

export const userPersonnelAssignments = pgTable(
  'user_personnel_assignments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    userUid: text('user_uid').notNull(),
    personnelId: integer('personnel_id')
      .references(() => personnel.id, { onDelete: 'cascade' })
      .notNull(),
    personnelCode: text('personnel_code').notNull(),
    assignedBy: text('assigned_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_personnel_assignment_unique_idx').on(table.userId, table.personnelId),
  ]
);

// ==========================================
// 4. Occupational Health & Medical Exams
// Structured by: personnel_id + exam_year
// ==========================================
export const periodicMedicalExams = pgTable(
  'periodic_medical_exams',
  {
    id: serial('id').primaryKey(),
    personnelId: integer('personnel_id')
      .references(() => personnel.id, { onDelete: 'cascade' })
      .notNull(),
    personnelCode: text('personnel_code').notNull(),
    nationalCode: text('national_code').notNull(),
    examYear: integer('exam_year').notNull(),
    examDate: text('exam_date'),
    examType: text('exam_type').default('PERIODIC'), // PERIODIC, PRE_EMPLOYMENT, RETURN_TO_WORK, SPECIAL
    height: doublePrecision('height'),
    weight: doublePrecision('weight'),
    bmi: doublePrecision('bmi'),
    systolicBp: integer('systolic_bp'),
    diastolicBp: integer('diastolic_bp'),
    pulseRate: integer('pulse_rate'),
    respiratoryRate: integer('respiratory_rate'),
    doctorVerdict: text('doctor_verdict').default('FIT'), // FIT, CONDITIONAL_FIT, UNFIT, PENDING
    restrictions: text('restrictions'),
    fitnessStatus: text('fitness_status'),
    clinicalNotes: text('clinical_notes'),
    nextExamDate: text('next_exam_date'),
    examCenter: text('exam_center'),
    examiningDoctor: text('examining_doctor'),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('medical_exam_personnel_year_idx').on(table.personnelId, table.examYear),
  ]
);

export const labResults = pgTable('lab_results', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => periodicMedicalExams.id, { onDelete: 'cascade' })
    .notNull(),
  testCode: text('test_code').notNull(),
  testName: text('test_name').notNull(),
  category: text('category').default('BIOCHEMISTRY'), // CBC, BIOCHEMISTRY, URINE, TOXICOLOGY, SEROLOGY
  numericValue: doublePrecision('numeric_value'),
  textValue: text('text_value'),
  unit: text('unit'),
  refMin: doublePrecision('ref_min'),
  refMax: doublePrecision('ref_max'),
  isAbnormal: boolean('is_abnormal').default(false).notNull(),
  clinicalSignificance: text('clinical_significance'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const audiometryRecords = pgTable('audiometry_records', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => periodicMedicalExams.id, { onDelete: 'cascade' })
    .notNull(),
  earSide: text('ear_side').notNull(), // RIGHT, LEFT
  freq250: doublePrecision('freq_250'),
  freq500: doublePrecision('freq_500'),
  freq1000: doublePrecision('freq_1000'),
  freq2000: doublePrecision('freq_2000'),
  freq3000: doublePrecision('freq_3000'),
  freq4000: doublePrecision('freq_4000'),
  freq6000: doublePrecision('freq_6000'),
  freq8000: doublePrecision('freq_8000'),
  hearingLossType: text('hearing_loss_type'), // NORMAL, CONDUCTIVE, SENSORINEURAL, MIXED
  hearingThresholdAvg: doublePrecision('hearing_threshold_avg'),
  noiseInducedHearingLoss: boolean('noise_induced_hearing_loss').default(false),
  diagnosis: text('diagnosis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const spirometryRecords = pgTable('spirometry_records', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => periodicMedicalExams.id, { onDelete: 'cascade' })
    .notNull(),
  fvcLiters: doublePrecision('fvc_liters'),
  fvcPercent: doublePrecision('fvc_percent'),
  fev1Liters: doublePrecision('fev1_liters'),
  fev1Percent: doublePrecision('fev1_percent'),
  fev1FvcRatio: doublePrecision('fev1_fvc_ratio'),
  pef: doublePrecision('pef'),
  spirometryPattern: text('spirometry_pattern'), // NORMAL, OBSTRUCTIVE, RESTRICTIVE, MIXED
  severity: text('severity'), // MILD, MODERATE, SEVERE
  interpretation: text('interpretation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const optometryRecords = pgTable('optometry_records', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => periodicMedicalExams.id, { onDelete: 'cascade' })
    .notNull(),
  visionRightUncorrected: text('vision_right_uncorrected'),
  visionLeftUncorrected: text('vision_left_uncorrected'),
  visionRightCorrected: text('vision_right_corrected'),
  visionLeftCorrected: text('vision_left_corrected'),
  colorBlindness: boolean('color_blindness').default(false),
  visualField: text('visual_field'),
  refractiveError: text('refractive_error'),
  intraocularPressureRight: doublePrecision('intraocular_pressure_right'),
  intraocularPressureLeft: doublePrecision('intraocular_pressure_left'),
  findings: text('findings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const medicalTestCatalog = pgTable('medical_test_catalog', {
  id: serial('id').primaryKey(),
  itemCode: text('item_code').notNull().unique(),
  titleFa: text('title_fa').notNull(),
  titleEn: text('title_en').notNull(),
  category: text('category').notNull(),
  unit: text('unit'),
  defaultReferenceRange: text('default_reference_range'),
  resultType: text('result_type').notNull().default('NUMERIC'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const medicalReferenceRules = pgTable('medical_reference_rules', {
  id: serial('id').primaryKey(),
  testCode: text('test_code').notNull(),
  gender: text('gender'),
  minAge: integer('min_age'),
  maxAge: integer('max_age'),
  minValue: doublePrecision('min_value'),
  maxValue: doublePrecision('max_value'),
  exactMatch: text('exact_match'),
  statusIfMatch: text('status_if_match').notNull(),
  priority: integer('priority').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const medicalExamSessions = pgTable('medical_exam_sessions', {
  id: serial('id').primaryKey(),
  examIdStr: text('exam_id_str').notNull().unique(),
  personnelId: text('personnel_id').notNull(),
  examYear: integer('exam_year').notNull(),
  date: text('date').notNull(),
  medicalCenter: text('medical_center'),
  doctor: text('doctor'),
  examType: text('exam_type').notNull(),
  fitnessDecision: text('fitness_decision'),
  nextFollowUp: text('next_follow_up'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const medicalTestResults = pgTable('medical_test_results', {
  id: serial('id').primaryKey(),
  resultIdStr: text('result_id_str').notNull().unique(),
  examIdStr: text('exam_id_str').notNull().references(() => medicalExamSessions.examIdStr, { onDelete: 'cascade' }),
  testCode: text('test_code').notNull(),
  measuredValue: doublePrecision('measured_value'),
  measuredString: text('measured_string'),
  status: text('status').notNull(),
  doctorComment: text('doctor_comment'),
  testDate: text('test_date'),
  labName: text('lab_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const occupationalDiseaseDiagnoses = pgTable('occupational_disease_diagnoses', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => periodicMedicalExams.id, { onDelete: 'cascade' })
    .notNull(),
  groupNumber: integer('group_number').notNull(), // 1 to 14 standard groups
  groupName: text('group_name').notNull(),
  diseaseName: text('disease_name').notNull(),
  icd10Code: text('icd10_code'),
  severity: text('severity').default('MILD'), // MILD, MODERATE, SEVERE
  isWorkRelated: boolean('is_work_related').default(true),
  isConfirmed: boolean('is_confirmed').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const medicalReferrals = pgTable('medical_referrals', {
  id: serial('id').primaryKey(),
  examId: integer('exam_id')
    .references(() => periodicMedicalExams.id, { onDelete: 'cascade' })
    .notNull(),
  specialistType: text('specialist_type').notNull(),
  reason: text('reason').notNull(),
  urgency: text('urgency').default('ROUTINE'), // ROUTINE, URGENT, EMERGENCY
  referralDate: text('referral_date'),
  followUpDate: text('follow_up_date'),
  outcome: text('outcome'),
  status: text('status').default('PENDING'), // PENDING, COMPLETED, CANCELLED
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 5. Work Permits (PTW - Permit To Work)
// ==========================================
export const workPermits = pgTable('work_permits', {
  id: serial('id').primaryKey(),
  permitNumber: text('permit_number').notNull().unique(),
  permitType: text('permit_type').notNull(), // HOT, COLD, CONFINED_SPACE, EXCAVATION, ELECTRICAL, RADIATION
  title: text('title').notNull(),
  companyId: integer('company_id').references(() => orgCompanies.id, { onDelete: 'set null' }),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  location: text('location').notNull(),
  description: text('description'),
  hazards: jsonb('hazards'),
  precautions: jsonb('precautions'),
  status: text('status').default('DRAFT').notNull(), // DRAFT, PENDING_APPROVAL, APPROVED, ISSUED, SUSPENDED, CLOSED, CANCELLED
  validFrom: text('valid_from').notNull(),
  validTo: text('valid_to').notNull(),
  issuerId: integer('issuer_id').references(() => personnel.id, { onDelete: 'set null' }),
  acceptorId: integer('acceptor_id').references(() => personnel.id, { onDelete: 'set null' }),
  contractorName: text('contractor_name'),
  workerCount: integer('worker_count').default(1),
  equipmentList: text('equipment_list'),
  parentPermitNumber: text('parent_permit_number'),
  permitCategory: text('permit_category'),
  sequenceNumber: integer('sequence_number'),
  jalaliYear: integer('jalali_year'),
  formData: jsonb('form_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const permitNumberCounters = pgTable('permit_number_counters', {
  id: serial('id').primaryKey(),
  jalaliYear: integer('jalali_year').notNull(),
  permitTypeCode: text('permit_type_code').notNull(),
  parentPermitNumber: text('parent_permit_number').default('').notNull(),
  lastSequence: integer('last_sequence').default(0).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const permitSignatures = pgTable('permit_signatures', {
  id: serial('id').primaryKey(),
  permitId: integer('permit_id')
    .references(() => workPermits.id, { onDelete: 'cascade' })
    .notNull(),
  roleName: text('role_name').notNull(),
  signerName: text('signer_name').notNull(),
  signerPersonnelCode: text('signer_personnel_code'),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
  action: text('action').notNull(), // APPROVED, REJECTED, EXTENDED, CLOSED
  digitalSignature: text('digital_signature'),
  comments: text('comments'),
});

// ==========================================
// 6. Risk Assessment & Safety Hazards
// ==========================================
export const riskAssessments = pgTable('risk_assessments', {
  id: serial('id').primaryKey(),
  activityTitle: text('activity_title').notNull(),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  methodology: text('methodology').default('JSA').notNull(), // JSA, FMEA, HAZOP, WHAT_IF
  hazardDescription: text('hazard_description').notNull(),
  consequences: text('consequences'),
  existingControls: text('existing_controls'),
  severity: integer('severity').default(1).notNull(),
  probability: integer('probability').default(1).notNull(),
  initialRiskScore: integer('initial_risk_score').notNull(),
  initialRiskLevel: text('initial_risk_level').notNull(), // LOW, MEDIUM, HIGH, EXTREME
  proposedControls: text('proposed_controls'),
  residualSeverity: integer('residual_severity'),
  residualProbability: integer('residual_probability'),
  residualRiskScore: integer('residual_risk_score'),
  residualRiskLevel: text('residual_risk_level'),
  responsiblePerson: text('responsible_person'),
  deadline: text('deadline'),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// 7. Incident Reporting & TRIR Records
// ==========================================
export const incidents = pgTable('incidents', {
  id: serial('id').primaryKey(),
  incidentNumber: text('incident_number').unique(),
  incidentDate: text('incident_date').notNull(),
  incidentTime: text('incident_time'),
  incidentType: text('incident_type').notNull(), // LTI, FAC, MTC, NEAR_MISS, PROPERTY_DAMAGE, ENVIRONMENTAL
  severity: text('severity').default('MINOR'),
  location: text('location').notNull(),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  involvedPersonnelId: integer('involved_personnel_id').references(() => personnel.id, { onDelete: 'set null' }),
  personnelName: text('personnel_name'),
  description: text('description').notNull(),
  immediateCauses: text('immediate_causes'),
  rootCauses: text('root_causes'),
  correctiveActions: text('corrective_actions'),
  lostWorkDays: integer('lost_work_days').default(0),
  financialLoss: doublePrecision('financial_loss').default(0),
  status: text('status').default('REPORTED').notNull(), // REPORTED, UNDER_INVESTIGATION, CLOSED
  investigator: text('investigator'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trirMonthlyRecords = pgTable('trir_monthly_records', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull(),
  month: text('month').notNull(),
  monthIndex: integer('month_index').notNull(),
  incidents: integer('incidents').default(0).notNull(),
  attendanceHours: doublePrecision('attendance_hours').default(0).notNull(),
  missionHours: doublePrecision('mission_hours').default(0).notNull(),
  contractorHours: doublePrecision('contractor_hours').default(0).notNull(),
  totalHours: doublePrecision('total_hours').default(0).notNull(),
  monthlyTrir: doublePrecision('monthly_trir').default(0).notNull(),
  rollingTrir: doublePrecision('rolling_trir').default(0).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// 8. Warnings, Disciplinary & Safety Compliance
// ==========================================
export const safetyWarnings = pgTable('safety_warnings', {
  id: serial('id').primaryKey(),
  personnelId: integer('personnel_id').references(() => personnel.id, { onDelete: 'set null' }),
  personnelName: text('personnel_name').notNull(),
  nationalCode: text('national_code'),
  personnelCode: text('personnel_code'),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  warningDate: text('warning_date').notNull(),
  warningLevel: text('warning_level').default('VERBAL').notNull(), // VERBAL, WRITTEN_1, WRITTEN_2, SUSPENSION
  category: text('category').default('PPE_VIOLATION'),
  reason: text('reason').notNull(),
  actionTaken: text('action_taken'),
  issuedBy: text('issued_by').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  number: text('number'),
  name: text('name'),
  site: text('site'),
  unit: text('unit'),
  type: text('type'),
  day: integer('day'),
  month: text('month'),
  year: integer('year'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 9. HSE Training & PPE Management
// ==========================================
export const hseTrainings = pgTable('hse_trainings', {
  id: serial('id').primaryKey(),
  courseTitle: text('course_title').notNull(),
  courseCategory: text('course_category').default('GENERAL_SAFETY'),
  instructor: text('instructor'),
  durationHours: integer('duration_hours').default(4).notNull(),
  validityMonths: integer('validity_months').default(12).notNull(),
  targetPositions: jsonb('target_positions'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const trainingAttendances = pgTable('training_attendances', {
  id: serial('id').primaryKey(),
  trainingId: integer('training_id')
    .references(() => hseTrainings.id, { onDelete: 'cascade' })
    .notNull(),
  personnelId: integer('personnel_id')
    .references(() => personnel.id, { onDelete: 'cascade' })
    .notNull(),
  sessionDate: text('session_date').notNull(),
  score: doublePrecision('score'),
  passed: boolean('passed').default(true).notNull(),
  certificateNumber: text('certificate_number'),
  expiryDate: text('expiry_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ppeIssuances = pgTable('ppe_issuances', {
  id: serial('id').primaryKey(),
  personnelId: integer('personnel_id')
    .references(() => personnel.id, { onDelete: 'cascade' })
    .notNull(),
  itemCategory: text('item_category').notNull(), // HELMET, GOGGLES, BOOTS, GLOVES, HARNESS, RESPIRATOR
  itemName: text('item_name').notNull(),
  standardCode: text('standard_code'),
  quantity: integer('quantity').default(1).notNull(),
  issueDate: text('issue_date').notNull(),
  expiryDate: text('expiry_date'),
  status: text('status').default('ACTIVE').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 10. Fire Department & Equipment
// ==========================================
export const fireEquipment = pgTable('fire_equipment', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  equipmentType: text('equipment_type').notNull(), // EXTINGUISHER_CO2, EXTINGUISHER_POWDER, EXTINGUISHER_FOAM, FIRE_HOSE, HYDRANT, SMOKE_DETECTOR
  location: text('location').notNull(),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  capacity: text('capacity'),
  manufacturingYear: integer('manufacturing_year'),
  lastInspectionDate: text('last_inspection_date'),
  nextInspectionDue: text('next_inspection_due'),
  hydrostaticTestDue: text('hydrostatic_test_due'),
  status: text('status').default('SERVICEABLE').notNull(), // SERVICEABLE, NEEDS_RECHARGE, DEFECTIVE, OUT_OF_SERVICE
  pressureStatus: text('pressure_status').default('NORMAL'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const safetyTemplates = pgTable('safety_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  defaultItems: jsonb('default_items').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const safetyInspections = pgTable('safety_inspections', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  templateId: text('template_id').references(() => safetyTemplates.id, { onDelete: 'set null' }),
  inspectionType: text('inspection_type').notNull(),
  inspectionDate: text('inspection_date').notNull(),
  inspectorName: text('inspector_name').notNull(),
  equipmentCode: text('equipment_code'),
  equipmentName: text('equipment_name'),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  status: text('status').notNull(),
  checklistData: jsonb('checklist_data').notNull(),
  findings: text('findings'),
  actionItems: jsonb('action_items'),
  nextInspectionDate: text('next_inspection_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==========================================
// 11. Environment & 5S Audits
// ==========================================
export const environmentalLogs = pgTable('environmental_logs', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // WASTE, WASTEWATER, AIR_EMISSIONS, NOISE, SOIL, MONITORING, NON_CONFORMANCE
  sourceUnitId: integer('source_unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  logDate: text('log_date').notNull(),
  parameterName: text('parameter_name'),
  measuredValue: doublePrecision('measured_value'),
  unit: text('unit'),
  standardLimit: doublePrecision('standard_limit'),
  isCompliant: boolean('is_compliant').default(true).notNull(),
  disposalMethod: text('disposal_method'),
  destination: text('destination'),
  notes: text('notes'),
  extraData: jsonb('extra_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fiveSAudits = pgTable('five_s_audits', {
  id: serial('id').primaryKey(),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'cascade' }).notNull(),
  auditDate: text('audit_date').notNull(),
  auditorName: text('auditor_name').notNull(),
  seiriScore: doublePrecision('seiri_score').default(0).notNull(),
  seitonScore: doublePrecision('seiton_score').default(0).notNull(),
  seisoScore: doublePrecision('seiso_score').default(0).notNull(),
  seiketsuScore: doublePrecision('seiketsu_score').default(0).notNull(),
  shitsukeScore: doublePrecision('shitsuke_score').default(0).notNull(),
  totalScore: doublePrecision('total_score').default(0).notNull(),
  actionItems: jsonb('action_items'),
  findings: text('findings'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 12. BPMN Workflow & Processes
// ==========================================
export const bpmnProcesses = pgTable('bpmn_processes', {
  id: serial('id').primaryKey(),
  processKey: text('process_key').notNull(),
  name: text('name').notNull(),
  category: text('category').default('HSE_GENERAL'),
  version: integer('version').default(1).notNull(),
  xmlContent: text('xml_content').notNull(),
  status: text('status').default('PUBLISHED').notNull(), // DRAFT, PUBLISHED, ARCHIVED
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const bpmnInstances = pgTable('bpmn_instances', {
  id: serial('id').primaryKey(),
  processId: integer('process_id')
    .references(() => bpmnProcesses.id, { onDelete: 'cascade' })
    .notNull(),
  instanceNumber: text('instance_number').unique(),
  status: text('status').default('RUNNING').notNull(), // RUNNING, COMPLETED, SUSPENDED, TERMINATED
  currentNodeId: text('current_node_id'),
  currentNodeName: text('current_node_name'),
  initiatorId: integer('initiator_id').references(() => users.id, { onDelete: 'set null' }),
  variables: jsonb('variables'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// ==========================================
// 13. System Settings & Audit Logs
// ==========================================
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  userUid: text('user_uid'),
  personnelCode: text('personnel_code'),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, SIGN, EXPORT, LOGIN, APPROVE, REJECT
  module: text('module').default('SYSTEM').notNull(), // PTW, INCIDENTS, HEALTH, PERSONNEL, WORKFLOW, etc.
  entityType: text('entity_type').notNull(), // MEDICAL_EXAM, PERMIT, INCIDENT, PERSONNEL, USER, etc.
  entityId: text('entity_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  result: text('result').default('SUCCESS').notNull(), // SUCCESS, FAILED, WARNING
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// 14. Universal Workflow & Approval Engine
// ==========================================
export const workflows = pgTable('workflows', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(), // e.g. 'PTW_APPROVAL', 'INCIDENT_INVESTIGATION', 'MEDICAL_CLEARANCE'
  name: text('name').notNull(),
  description: text('description'),
  entityType: text('entity_type').notNull(), // WORK_PERMIT, INCIDENT, MEDICAL_EXAM, SAFETY_WARNING, 5S_AUDIT
  isSequential: boolean('is_sequential').default(true).notNull(),
  autoLockOnComplete: boolean('auto_lock_on_complete').default(true).notNull(),
  defaultSteps: jsonb('default_steps'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowInstances = pgTable('workflow_instances', {
  id: serial('id').primaryKey(),
  workflowKey: text('workflow_key').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  entityNumber: text('entity_number'),
  title: text('title').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, IN_PROGRESS, APPROVED, REJECTED, RETURNED, SIGNED, CANCELLED
  currentStepOrder: integer('current_step_order').default(1).notNull(),
  priority: text('priority').default('NORMAL').notNull(), // LOW, NORMAL, HIGH, CRITICAL
  requesterId: integer('requester_id').references(() => users.id, { onDelete: 'set null' }),
  requesterName: text('requester_name'),
  requesterPersonnelCode: text('requester_personnel_code'),
  isLocked: boolean('is_locked').default(false).notNull(),
  version: integer('version').default(1).notNull(),
  deadline: timestamp('deadline'),
  metadata: jsonb('metadata'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workflowSteps = pgTable('workflow_steps', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').references(() => workflowInstances.id, { onDelete: 'cascade' }).notNull(),
  stepOrder: integer('step_order').notNull(),
  stepName: text('step_name').notNull(),
  stepType: text('step_type').default('APPROVE').notNull(), // REVIEW, APPROVE, SIGN, APPROVE_SIGN, NOTIFY
  assignedRole: text('assigned_role'),
  assignedDepartment: text('assigned_department'),
  assignedUserId: integer('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
  assignedPersonnelCode: text('assigned_personnel_code'),
  status: text('status').default('PENDING').notNull(), // PENDING, IN_PROGRESS, APPROVED, REJECTED, RETURNED, SKIPPED
  deadline: timestamp('deadline'),
  completedAt: timestamp('completed_at'),
  completedBy: text('completed_by'),
  completedByRole: text('completed_by_role'),
  comment: text('comment'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflowHistory = pgTable('workflow_history', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').references(() => workflowInstances.id, { onDelete: 'cascade' }).notNull(),
  stepId: integer('step_id').references(() => workflowSteps.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // SUBMIT, REVIEW, APPROVE, REJECT, SIGN, APPROVE_SIGN, RETURN, REASSIGN, CANCEL
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role'),
  actorDepartment: text('actor_department'),
  actorPersonnelCode: text('actor_personnel_code'),
  comment: text('comment'),
  signatureHash: text('signature_hash'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workflowSignatures = pgTable('workflow_signatures', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id').references(() => workflowInstances.id, { onDelete: 'cascade' }).notNull(),
  stepId: integer('step_id').references(() => workflowSteps.id, { onDelete: 'set null' }),
  signerName: text('signer_name').notNull(),
  signerRole: text('signer_role').notNull(),
  signerPersonnelCode: text('signer_personnel_code'),
  signerDepartment: text('signer_department'),
  signatureType: text('signature_type').default('ELECTRONIC').notNull(), // ELECTRONIC, DIGITAL_CERTIFICATE, DRAWN
  signatureData: text('signature_data'), // Base64 signature image or hash
  verificationCode: text('verification_code').notNull(),
  ipAddress: text('ip_address'),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
});

// ==========================================
// 15. Central File Management
// ==========================================
export const systemFiles = pgTable('system_files', {
  id: serial('id').primaryKey(),
  fileId: text('file_id').notNull().unique(), // UUID
  entityType: text('entity_type').notNull(), // PTW, INCIDENT, MEDICAL_EXAM, AUDIT, DOCUMENT, USER_AVATAR
  entityId: text('entity_id').notNull(),
  originalName: text('original_name').notNull(),
  storedName: text('stored_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  filePath: text('file_path').notNull(),
  fileUrl: text('file_url'),
  uploadedBy: text('uploaded_by'),
  uploaderRole: text('uploader_role'),
  version: integer('version').default(1).notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  metadata: jsonb('metadata'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==========================================
// Relations
// ==========================================
export const personnelRelations = relations(personnel, ({ one, many }) => ({
  company: one(orgCompanies, {
    fields: [personnel.companyId],
    references: [orgCompanies.id],
  }),
  site: one(orgSites, {
    fields: [personnel.siteId],
    references: [orgSites.id],
  }),
  department: one(orgDepartments, {
    fields: [personnel.departmentId],
    references: [orgDepartments.id],
  }),
  unit: one(orgUnits, {
    fields: [personnel.unitId],
    references: [orgUnits.id],
  }),
  position: one(orgPositions, {
    fields: [personnel.positionId],
    references: [orgPositions.id],
  }),
  medicalExams: many(periodicMedicalExams),
  warnings: many(safetyWarnings),
  trainingAttendances: many(trainingAttendances),
  ppeIssuances: many(ppeIssuances),
}));

export const periodicMedicalExamsRelations = relations(periodicMedicalExams, ({ one, many }) => ({
  personnel: one(personnel, {
    fields: [periodicMedicalExams.personnelId],
    references: [personnel.id],
  }),
  labResults: many(labResults),
  audiometryRecords: many(audiometryRecords),
  spirometryRecords: many(spirometryRecords),
  optometryRecords: many(optometryRecords),
  diseaseDiagnoses: many(occupationalDiseaseDiagnoses),
  referrals: many(medicalReferrals),
}));

export const systemReleases = pgTable('system_releases', {
  id: serial('id').primaryKey(),
  version: text('version').notNull(),
  buildId: text('build_id').notNull(),
  releaseId: text('release_id').notNull().unique(),
  status: text('status').default('SUCCESS').notNull(), // SUCCESS, FAILED, ROLLBACK
  gitCommit: text('git_commit'),
  environment: text('environment').default('production'),
  createdBy: text('created_by'),
  deployedAt: timestamp('deployed_at').defaultNow().notNull(),
});

export const nonConformances = pgTable('non_conformances', {
  id: serial('id').primaryKey(),
  trackingCode: text('tracking_code').notNull().unique(),
  title: text('title').notNull(),
  sourceModule: text('source_module').notNull(), // safety_inspection, ptw, incident, audit, 5s, health_env, fire_dept, general
  sourceRecordId: text('source_record_id'),
  sourceTitle: text('source_title'),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  unitName: text('unit_name'),
  riskLevel: text('risk_level').notNull().default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL
  category: text('category').default('ایمنی و بهداشت'),
  description: text('description').notNull(),
  evidence: text('evidence'),
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  preventiveAction: text('preventive_action'),
  assignedTo: text('assigned_to'),
  assignedToName: text('assigned_to_name'),
  dueDate: text('due_date'),
  completionDate: text('completion_date'),
  status: text('status').notNull().default('REGISTERED'), // REGISTERED, UNDER_EVALUATION, CAPA_DEFINED, IN_PROGRESS, EFFECTIVENESS_REVIEW, CLOSED, REOPENED
  effectivenessVerified: boolean('effectiveness_verified').default(false).notNull(),
  effectivenessNotes: text('effectiveness_notes'),
  workflowHistory: jsonb('workflow_history').default([]),
  stageSignatures: jsonb('stage_signatures').default({}),
  currentStageAssignee: jsonb('current_stage_assignee'),
  cancellationInfo: jsonb('cancellation_info'),
  activeReferralId: text('active_referral_id'),
  attachments: jsonb('attachments').default([]),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workPermitsRelations = relations(workPermits, ({ many }) => ({
  signatures: many(permitSignatures),
}));

// ==========================================
// 14. Internal Automation Engine & Outbox Queue
// ==========================================
export const automationRules = pgTable(
  'automation_rules',
  {
    id: serial('id').primaryKey(),
    ruleCode: text('rule_code').notNull().unique(),
    nameFa: text('name_fa').notNull(),
    nameEn: text('name_en').notNull(),
    descriptionFa: text('description_fa'),
    descriptionEn: text('description_en'),
    eventType: text('event_type').notNull(), // 'incident.reported', 'warning.issued', 'permit.status_adjusted', 'heat_stress.level_change', etc.
    sourceModule: text('source_module').default('all').notNull(),
    priority: integer('priority').default(10).notNull(), // Lower number = higher priority
    isActive: boolean('is_active').default(true).notNull(),
    conditions: jsonb('conditions').notNull(), // Array of condition rules: [{ field, operator, value }]
    actions: jsonb('actions').notNull(), // Array of actions: [{ type: 'notification' | 'cartable_task' | 'escalation' | 'webhook', config: {...} }]
    executionCount: integer('execution_count').default(0).notNull(),
    lastTriggeredAt: timestamp('last_triggered_at'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_automation_rules_event').on(table.eventType),
    index('idx_automation_rules_active').on(table.isActive),
  ]
);

export const automationEventsOutbox = pgTable(
  'automation_events_outbox',
  {
    id: serial('id').primaryKey(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    sourceModule: text('source_module').notNull().default('system'),
    correlationKey: text('correlation_key'),
    idempotencyKey: text('idempotency_key').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').default('PENDING').notNull(), // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER'
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(5).notNull(),
    nextRetryAt: timestamp('next_retry_at').defaultNow().notNull(),
    lockedAt: timestamp('locked_at'),
    lockedBy: text('locked_by'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (table) => [
    uniqueIndex('idx_outbox_idempotency').on(table.idempotencyKey),
    index('idx_outbox_status_retry').on(table.status, table.nextRetryAt),
    index('idx_outbox_event_type').on(table.eventType),
  ]
);

export const automationExecutionLogs = pgTable(
  'automation_execution_logs',
  {
    id: serial('id').primaryKey(),
    logId: text('log_id').notNull(),
    eventId: text('event_id').notNull(),
    ruleId: integer('rule_id'),
    ruleCode: text('rule_code').notNull(),
    eventType: text('event_type').notNull(),
    correlationKey: text('correlation_key'),
    status: text('status').notNull(), // 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED'
    conditionMatched: boolean('condition_matched').default(true).notNull(),
    conditionDetails: jsonb('condition_details'),
    actionsExecuted: jsonb('actions_executed'),
    durationMs: integer('duration_ms').default(0).notNull(),
    errorMessage: text('error_message'),
    actor: text('actor').default('system'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_exec_logs_event').on(table.eventId),
    index('idx_exec_logs_rule').on(table.ruleCode),
    index('idx_exec_logs_status').on(table.status),
    index('idx_exec_logs_created').on(table.createdAt),
  ]
);

// ==========================================
// 15. Local AI Knowledge Base & RAG Engine
// ==========================================
export const aiKnowledgeDocs = pgTable(
  'ai_knowledge_docs',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    docType: text('doc_type').default('REGULATION').notNull(), // 'PDF' | 'DOCX' | 'TXT' | 'INSTRUCTION' | 'REGULATION'
    category: text('category').default('GENERAL').notNull(), // 'PTW' | 'HEALTH' | 'ENVIRONMENT' | 'SAFETY' | 'GENERAL'
    content: text('content').notNull(),
    summary: text('summary'),
    fileSize: integer('file_size').default(0).notNull(),
    chunkCount: integer('chunk_count').default(0).notNull(),
    status: text('status').default('INDEXED').notNull(), // 'PENDING' | 'INDEXED' | 'FAILED'
    uploadedBy: text('uploaded_by'),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_docs_category').on(table.category),
    index('idx_ai_docs_status').on(table.status),
    index('idx_ai_docs_created').on(table.createdAt),
  ]
);

export const aiKnowledgeChunks = pgTable(
  'ai_knowledge_chunks',
  {
    id: serial('id').primaryKey(),
    docId: integer('doc_id').references(() => aiKnowledgeDocs.id, { onDelete: 'cascade' }).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    chunkText: text('chunk_text').notNull(),
    tokenCount: integer('token_count').default(0).notNull(),
    embedding: jsonb('embedding'), // Dense vector representation (array of floats from BGE-M3)
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_chunks_doc').on(table.docId),
    index('idx_ai_chunks_index').on(table.docId, table.chunkIndex),
  ]
);

export const aiChatSessions = pgTable(
  'ai_chat_sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id'),
    userUid: text('user_uid'),
    title: text('title').notNull(),
    assistantId: text('assistant_id').default('GENERAL_HSE').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_sessions_user').on(table.userId),
    index('idx_ai_sessions_created').on(table.createdAt),
  ]
);

export const aiChatMessages = pgTable(
  'ai_chat_messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id').references(() => aiChatSessions.id, { onDelete: 'cascade' }).notNull(),
    role: text('role').notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    toolsUsed: jsonb('tools_used'),
    citations: jsonb('citations'),
    durationMs: integer('duration_ms'),
    model: text('model'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_msgs_session').on(table.sessionId),
    index('idx_ai_msgs_created').on(table.createdAt),
  ]
);


// ==========================================
// 16. AI Provider Registry & Model Assignments (Phase 3b)
// ==========================================
export const aiProviders = pgTable(
  'ai_providers',
  {
    id: text('id').primaryKey(), // e.g. ollama
    kind: text('kind').notNull(), // ollama | lmstudio | openai_compatible | custom
    name: text('name').notNull(),
    nameFa: text('name_fa').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    baseUrl: text('base_url'),
    capabilities: jsonb('capabilities').default([]).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_providers_kind').on(table.kind),
    index('idx_ai_providers_default').on(table.isDefault),
  ]
);

export const aiProviderConfigs = pgTable(
  'ai_provider_configs',
  {
    id: serial('id').primaryKey(),
    providerId: text('provider_id')
      .references(() => aiProviders.id, { onDelete: 'cascade' })
      .notNull(),
    configKey: text('config_key').notNull(),
    configValue: text('config_value'),
    isSecret: boolean('is_secret').default(false).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_provider_configs_provider').on(table.providerId),
  ]
);

export const aiModels = pgTable(
  'ai_models',
  {
    id: serial('id').primaryKey(),
    providerId: text('provider_id')
      .references(() => aiProviders.id, { onDelete: 'cascade' })
      .notNull(),
    modelRef: text('model_ref').notNull(),
    displayName: text('display_name'),
    sizeBytes: integer('size_bytes'),
    status: text('status').default('known').notNull(), // known | installed | error
    metadata: jsonb('metadata').default({}).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_models_provider').on(table.providerId),
    index('idx_ai_models_ref').on(table.modelRef),
  ]
);

export const aiModelAssignments = pgTable(
  'ai_model_assignments',
  {
    id: serial('id').primaryKey(),
    serviceKey: text('service_key').notNull(), // GENERAL_HSE, PTW_SHERPA, ...
    providerId: text('provider_id').references(() => aiProviders.id, { onDelete: 'set null' }),
    modelRef: text('model_ref'),
    fallbackProviderId: text('fallback_provider_id'),
    fallbackModelRef: text('fallback_model_ref'),
    contextLimit: integer('context_limit'),
    enabled: boolean('enabled').default(true).notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_assignments_service').on(table.serviceKey),
  ]
);

export const aiServiceSettings = pgTable(
  'ai_service_settings',
  {
    id: serial('id').primaryKey(),
    settingKey: text('setting_key').notNull(),
    settingValue: text('setting_value'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_service_settings_key').on(table.settingKey),
  ]
);

export const aiDeploymentJobs = pgTable(
  'ai_deployment_jobs',
  {
    id: text('id').primaryKey(),
    jobType: text('job_type').notNull(), // pull | delete | install_engine | ...
    providerId: text('provider_id'),
    targetRef: text('target_ref'),
    status: text('status').default('pending').notNull(), // pending | running | success | failed | cancelled
    progress: integer('progress').default(0).notNull(),
    message: text('message'),
    errorMessage: text('error_message'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_ai_jobs_status').on(table.status),
    index('idx_ai_jobs_created').on(table.createdAt),
  ]
);
