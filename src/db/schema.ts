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
  assessmentCode: text('assessment_code'),
  activityTitle: text('activity_title').notNull(),
  unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
  siteName: text('site_name'),
  unitName: text('unit_name'),
  areaLocation: text('area_location'),
  assessorName: text('assessor_name'),
  assessmentDate: text('assessment_date'),
  methodology: text('methodology').default('JSA').notNull(), // JSA, FMEA, FTA, HHA, WHAT_IF, BOWTIE, MATRIX, JOB_ACTIVITY
  hazardDescription: text('hazard_description').notNull(),
  consequences: text('consequences'),
  existingControls: text('existing_controls'),
  severity: integer('severity').default(1).notNull(),
  probability: integer('probability').default(1).notNull(),
  initialRiskScore: integer('initial_risk_score').notNull(),
  initialRiskLevel: text('initial_risk_level').notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  proposedControls: text('proposed_controls'),
  residualSeverity: integer('residual_severity'),
  residualProbability: integer('residual_probability'),
  residualRiskScore: integer('residual_risk_score'),
  residualRiskLevel: text('residual_risk_level'),
  responsiblePerson: text('responsible_person'),
  deadline: text('deadline'),
  status: text('status').default('DRAFT').notNull(), // DRAFT, UNDER_REVIEW, APPROVED, ARCHIVED
  workflowStage: text('workflow_stage').default('INITIAL_INFO'),
  payload: jsonb('payload').$type<Record<string, any>>().default({}),
  controlActions: jsonb('control_actions').$type<any[]>().default([]),
  reviewHistory: jsonb('review_history').$type<any[]>().default([]),
  linkedRefs: jsonb('linked_refs').$type<Record<string, any>>().default({}),
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
  extraData: jsonb('extra_data'),
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

// ==========================================
// 17. PSM Implementation & Maturity Management System (پتروشیمی رجال)
// Based on CCPS RBPS (4 Pillars, 20 Elements) & OSHA 29 CFR 1910.119 (14 Elements)
// ==========================================
export const psmProjects = pgTable(
  'psm_projects',
  {
    id: serial('id').primaryKey(),
    projectCode: text('project_code').notNull().unique(),
    title: text('title').notNull(),
    scopeDescription: text('scope_description').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    projectManagerId: integer('project_manager_id').references(() => personnel.id, { onDelete: 'set null' }),
    projectManagerName: text('project_manager_name').notNull(),
    projectSponsorId: integer('project_sponsor_id').references(() => personnel.id, { onDelete: 'set null' }),
    projectSponsorName: text('project_sponsor_name').notNull(),
    teamMembers: jsonb('team_members').default([]).notNull(),
    coveredUnits: jsonb('covered_units').default([]).notNull(),
    coveredAreas: jsonb('covered_areas').default([]).notNull(),
    quantitativeGoals: jsonb('quantitative_goals').default([]).notNull(),
    qualitativeGoals: jsonb('qualitative_goals').default([]).notNull(),
    budgetAllocated: doublePrecision('budget_allocated').default(0).notNull(),
    budgetSpent: doublePrecision('budget_spent').default(0).notNull(),
    resourcesSummary: text('resources_summary'),
    milestones: jsonb('milestones').default([]).notNull(),
    overallStatus: text('overall_status').default('INITIATION').notNull(),
    overallProgress: doublePrecision('overall_progress').default(0).notNull(),
    handoverData: jsonb('handover_data').default({}).notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_projects_code').on(table.projectCode),
    index('idx_psm_projects_status').on(table.overallStatus),
  ]
);

export const psmProcessAssets = pgTable(
  'psm_process_assets',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id').references(() => psmProjects.id, { onDelete: 'cascade' }),
    companyName: text('company_name').default('مجتمع پتروشیمی رجال').notNull(),
    siteName: text('site_name'),
    processUnitId: integer('process_unit_id'),
    processUnitName: text('process_unit_name').notNull(),
    operationalArea: text('operational_area').notNull(),
    equipmentTag: text('equipment_tag').notNull(),
    equipmentName: text('equipment_name').notNull(),
    equipmentClass: text('equipment_class').default('REACTOR').notNull(),
    safetyCriticality: text('safety_criticality').default('HIGH').notNull(),
    hazardousSubstances: text('hazardous_substances'),
    designParameters: text('design_parameters'),
    responsiblePersonId: integer('responsible_person_id').references(() => personnel.id, { onDelete: 'set null' }),
    responsiblePersonName: text('responsible_person_name').notNull(),
    responsibleRole: text('responsible_role'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_assets_project').on(table.projectId),
    index('idx_psm_assets_unit').on(table.processUnitName),
    index('idx_psm_assets_tag').on(table.equipmentTag),
  ]
);

export const psmAssessments = pgTable(
  'psm_assessments',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    framework: text('framework').notNull(), // CCPS_RBPS | OSHA_1910_119 | NATIONAL_REJAL
    elementCode: text('element_code').notNull(),
    elementTitleFa: text('element_title_fa').notNull(),
    elementTitleEn: text('element_title_en').notNull(),
    pillar: text('pillar'),
    unitName: text('unit_name').default('کل مجتمع').notNull(),
    evaluationCriteria: text('evaluation_criteria').notNull(),
    isInScope: boolean('is_in_scope').default(true).notNull(),
    outOfScopeJustification: text('out_of_scope_justification'),
    outOfScopeApprovedBy: text('out_of_scope_approved_by'),
    outOfScopeApprovedAt: timestamp('out_of_scope_approved_at'),
    currentStatusDesc: text('current_status_desc').notNull(),
    evidenceList: jsonb('evidence_list').default([]).notNull(),
    assessorId: integer('assessor_id').references(() => personnel.id, { onDelete: 'set null' }),
    assessorName: text('assessor_name').notNull(),
    assessmentDate: text('assessment_date').notNull(),
    strengths: text('strengths'),
    deficiencies: text('deficiencies'),
    complianceScore: doublePrecision('compliance_score').default(0).notNull(),
    complianceStatus: text('compliance_status').default('PARTIAL').notNull(), // COMPLIANT | PARTIAL | NON_COMPLIANT | OUT_OF_SCOPE
    actionPriority: text('action_priority').default('HIGH').notNull(), // CRITICAL | HIGH | MEDIUM | LOW
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_assessments_project').on(table.projectId),
    index('idx_psm_assessments_element').on(table.framework, table.elementCode),
  ]
);

export const psmGaps = pgTable(
  'psm_gaps',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    assessmentId: integer('assessment_id').references(() => psmAssessments.id, { onDelete: 'set null' }),
    gapCode: text('gap_code').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    standardReference: text('standard_reference').notNull(),
    ccpsElementCode: text('ccps_element_code'),
    oshaClauseCodes: jsonb('osha_clause_codes').default([]).notNull(),
    unitName: text('unit_name').notNull(),
    riskLevel: text('risk_level').default('HIGH').notNull(), // CRITICAL | HIGH | MEDIUM | LOW
    requiredDocument: text('required_document'),
    responsiblePersonId: integer('responsible_person_id').references(() => personnel.id, { onDelete: 'set null' }),
    responsiblePersonName: text('responsible_person_name').notNull(),
    proposedDueDate: text('proposed_due_date').notNull(),
    isOutOfScope: boolean('is_out_of_scope').default(false).notNull(),
    technicalJustification: text('technical_justification'),
    justificationApprovedBy: text('justification_approved_by'),
    justificationApprovedAt: timestamp('justification_approved_at'),
    status: text('status').default('OPEN').notNull(), // OPEN | CONVERTED_TO_WBS | IN_CAPA | CLOSED | OUT_OF_SCOPE_PENDING | OUT_OF_SCOPE_APPROVED
    linkedWbsId: integer('linked_wbs_id'),
    linkedCapaId: integer('linked_capa_id'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_gaps_project').on(table.projectId),
    index('idx_psm_gaps_status').on(table.status),
    index('idx_psm_gaps_risk').on(table.riskLevel),
  ]
);

export const psmWbsTasks = pgTable(
  'psm_wbs_tasks',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    gapId: integer('gap_id').references(() => psmGaps.id, { onDelete: 'set null' }),
    wbsCode: text('wbs_code').notNull(),
    parentId: integer('parent_id'),
    title: text('title').notNull(),
    elementCode: text('element_code'),
    unitName: text('unit_name'),
    ownerName: text('owner_name').notNull(),
    executorName: text('executor_name').notNull(),
    plannedStart: text('planned_start').notNull(),
    plannedEnd: text('planned_end').notNull(),
    actualStart: text('actual_start'),
    actualEnd: text('actual_end'),
    plannedProgress: doublePrecision('planned_progress').default(0).notNull(),
    actualProgress: doublePrecision('actual_progress').default(0).notNull(),
    weight: doublePrecision('weight').default(1).notNull(),
    dependencies: jsonb('dependencies').default([]).notNull(),
    allocatedBudget: doublePrecision('allocated_budget').default(0).notNull(),
    actualCost: doublePrecision('actual_cost').default(0).notNull(),
    resources: text('resources'),
    isMilestone: boolean('is_milestone').default(false).notNull(),
    isCritical: boolean('is_critical').default(false).notNull(),
    delayDays: integer('delay_days').default(0).notNull(),
    scheduleVariancePct: doublePrecision('schedule_variance_pct').default(0).notNull(),
    status: text('status').default('NOT_STARTED').notNull(), // NOT_STARTED | IN_PROGRESS | DELAYED | COMPLETED | BLOCKED
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_wbs_project').on(table.projectId),
    index('idx_psm_wbs_code').on(table.wbsCode),
  ]
);

export const psmDocuments = pgTable(
  'psm_documents',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    docCode: text('doc_code').notNull().unique(),
    title: text('title').notNull(),
    docType: text('doc_type').default('PROCEDURE').notNull(),
    ccpsElementCode: text('ccps_element_code').notNull(),
    oshaClauseCode: text('osha_clause_code'),
    unitName: text('unit_name'),
    equipmentTag: text('equipment_tag'),
    linkedStudyId: integer('linked_study_id'),
    linkedCapaId: integer('linked_capa_id'),
    version: text('version').default('1.0').notNull(),
    revisionNumber: integer('revision_number').default(1).notNull(),
    authorName: text('author_name').notNull(),
    reviewerName: text('reviewer_name').notNull(),
    approverName: text('approver_name').notNull(),
    issueDate: text('issue_date'),
    validityExpiryDate: text('validity_expiry_date'),
    reviewCycleMonths: integer('review_cycle_months').default(24).notNull(),
    status: text('status').default('DRAFT').notNull(), // DRAFT | UNDER_REVIEW | APPROVED | EXPIRED | SUPERSEDED | REJECTED
    fileId: text('file_id'),
    fileUrl: text('file_url'),
    fileName: text('file_name'),
    evidenceSummary: text('evidence_summary'),
    evidenceAttachments: jsonb('evidence_attachments').default([]).notNull(),
    changeHistory: jsonb('change_history').default([]).notNull(),
    approvedAt: timestamp('approved_at'),
    approvedBy: text('approved_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_docs_project').on(table.projectId),
    index('idx_psm_docs_element').on(table.ccpsElementCode),
    index('idx_psm_docs_status').on(table.status),
  ]
);

export const psmCapaItems = pgTable(
  'psm_capa_items',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    capaCode: text('capa_code').notNull().unique(),
    sourceType: text('source_type').default('GAP_ANALYSIS').notNull(),
    sourceRefId: text('source_ref_id'),
    ccpsElementCode: text('ccps_element_code'),
    oshaClauseCode: text('osha_clause_code'),
    unitName: text('unit_name').notNull(),
    equipmentTag: text('equipment_tag'),
    title: text('title').notNull(),
    deficiencyDescription: text('deficiency_description').notNull(),
    riskSeverity: integer('risk_severity').default(3).notNull(),
    riskLikelihood: integer('risk_likelihood').default(3).notNull(),
    riskLevel: text('risk_level').default('HIGH').notNull(), // CRITICAL | HIGH | MEDIUM | LOW
    rootCause: text('root_cause'),
    correctiveAction: text('corrective_action'),
    preventiveAction: text('preventive_action'),
    responsiblePersonName: text('responsible_person_name'),
    dueDate: text('due_date'),
    completionDate: text('completion_date'),
    evidenceDescription: text('evidence_description'),
    evidenceFiles: jsonb('evidence_files').default([]).notNull(),
    reviewerName: text('reviewer_name'),
    reviewNotes: text('review_notes'),
    reviewedAt: timestamp('reviewed_at'),
    effectivenessVerifierName: text('effectiveness_verifier_name'),
    effectivenessVerificationDate: text('effectiveness_verification_date'),
    effectivenessCriteriaMet: boolean('effectiveness_criteria_met').default(false).notNull(),
    effectivenessReport: text('effectiveness_report'),
    closedBy: text('closed_by'),
    closedAt: timestamp('closed_at'),
    stage: text('stage').default('REGISTERED').notNull(), // REGISTERED | RISK_ASSESSED | ASSIGNED | ACTION_IN_PROGRESS | EVIDENCE_SUBMITTED | UNDER_REVIEW | EFFECTIVENESS_VERIFIED | CLOSED
    workflowLogs: jsonb('workflow_logs').default([]).notNull(),
    followupPlan: text('followup_plan'),
    managementApprovalForResidual: boolean('management_approval_for_residual').default(false).notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_capa_project').on(table.projectId),
    index('idx_psm_capa_stage').on(table.stage),
    index('idx_psm_capa_risk').on(table.riskLevel),
  ]
);

export const psmSpecializedStudies = pgTable(
  'psm_specialized_studies',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    studyCode: text('study_code').notNull().unique(),
    subsystemType: text('subsystem_type').notNull(), // PSI | PHA | HAZOP | HAZID | LOPA | BOW_TIE | OPERATING_PROCEDURES | MI | MOC | PSSR | CONTRACTORS | TRAINING | INCIDENT_INVESTIGATION | EMERGENCY_PLANNING
    title: text('title').notNull(),
    unitName: text('unit_name').notNull(),
    equipmentTag: text('equipment_tag'),
    nodeOrSection: text('node_or_section'),
    ownerName: text('owner_name').notNull(),
    teamLeader: text('team_leader'),
    studyDate: text('study_date').notNull(),
    revalidationDueDate: text('revalidation_due_date'),
    status: text('status').default('IN_PROGRESS').notNull(), // PLANNED | IN_PROGRESS | UNDER_REVIEW | APPROVED | REQUIRES_ACTION | CLOSED
    technicalSummary: text('technical_summary').notNull(),
    methodologyDetails: jsonb('methodology_details').default({}).notNull(),
    recommendations: jsonb('recommendations').default([]).notNull(), // [{ id, title, riskLevel, ownerName, dueDate, status, evidence, trackingPath, linkedCapaCode }]
    evidenceSummary: text('evidence_summary'),
    trackingPath: text('tracking_path'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_studies_project').on(table.projectId),
    index('idx_psm_studies_subsystem').on(table.subsystemType),
  ]
);

export const psmMaturityAssessments = pgTable(
  'psm_maturity_assessments',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    assessmentCode: text('assessment_code').notNull().unique(),
    assessmentDate: text('assessment_date').notNull(),
    assessorName: text('assessor_name').notNull(),
    unitScope: text('unit_scope').default('کل مجتمع پتروشیمی رجال').notNull(),
    overallMaturityLevel: integer('overall_maturity_level').default(1).notNull(), // 1 to 5
    overallMaturityScore: doublePrecision('overall_maturity_score').default(1).notNull(), // 1.00 to 5.00
    pillarScores: jsonb('pillar_scores').default({}).notNull(),
    elementMaturityData: jsonb('element_maturity_data').default([]).notNull(), // Array of 20 CCPS elements with independent 5-level evaluation (design, execution, culture, sustainability)
    strengthsSummary: text('strengths_summary'),
    improvementRoadmap: text('improvement_roadmap'),
    verifiedBy: text('verified_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_maturity_project').on(table.projectId),
  ]
);

export const psmStageGates = pgTable(
  'psm_stage_gates',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    gateKey: text('gate_key').notNull(), // G1 | G2 | G3 | G4 | G5 | G6
    gateNumber: integer('gate_number').notNull(), // 1 to 6
    titleFa: text('title_fa').notNull(),
    titleEn: text('title_en').notNull(),
    descriptionFa: text('description_fa').notNull(),
    entryCriteria: jsonb('entry_criteria').default([]).notNull(),
    exitCriteria: jsonb('exit_criteria').default([]).notNull(),
    mandatoryChecklist: jsonb('mandatory_checklist').default([]).notNull(),
    requiredEvidenceList: jsonb('required_evidence_list').default([]).notNull(),
    preparedByName: text('prepared_by_name').default('').notNull(),
    evaluatorName: text('evaluator_name').default('').notNull(),
    approverName: text('approver_name').default('').notNull(),
    status: text('status').default('PENDING').notNull(), // PENDING | IN_REVIEW | APPROVED | REJECTED | SUSPENDED
    decisionDate: text('decision_date'),
    meetingMinutes: text('meeting_minutes'),
    comments: text('comments'),
    blockingIssues: jsonb('blocking_issues').default([]).notNull(),
    changeHistory: jsonb('change_history').default([]).notNull(),
    approvedAt: timestamp('approved_at'),
    approvedBy: text('approved_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_stage_gates_project').on(table.projectId),
    index('idx_psm_stage_gates_key').on(table.gateKey),
    index('idx_psm_stage_gates_status').on(table.status),
  ]
);

export const psmGateDeviations = pgTable(
  'psm_gate_deviations',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => psmProjects.id, { onDelete: 'cascade' })
      .notNull(),
    gateKey: text('gate_key').notNull(),
    deviationCode: text('deviation_code').notNull().unique(),
    title: text('title').notNull(),
    requirementDescription: text('requirement_description').notNull(),
    technicalJustification: text('technical_justification').notNull(),
    riskAssessmentSummary: text('risk_assessment_summary').notNull(),
    compensatoryMeasures: text('compensatory_measures').notNull(),
    isLegalRequirement: boolean('is_legal_requirement').default(false).notNull(),
    requestedByName: text('requested_by_name').notNull(),
    approvedByName: text('approved_by_name'),
    approvalRole: text('approval_role'),
    validUntilDate: text('valid_until_date').notNull(),
    status: text('status').default('PENDING').notNull(), // PENDING | APPROVED | REJECTED | EXPIRED
    decisionNotes: text('decision_notes'),
    decidedAt: timestamp('decided_at'),
    changeHistory: jsonb('change_history').default([]).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_psm_gate_deviations_project').on(table.projectId),
    index('idx_psm_gate_deviations_gate').on(table.gateKey),
    index('idx_psm_gate_deviations_status').on(table.status),
  ]
);

// ==========================================
// 17. Fire Suppression Systems Design & 2D Layout (NFPA 13 / NFPA 10)
// ==========================================
export const fireDesignBuildings = pgTable(
  'fire_design_buildings',
  {
    id: serial('id').primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    companyName: text('company_name').default('مجتمع پتروشیمی رجال').notNull(),
    unitId: integer('unit_id'),
    unitName: text('unit_name').notNull(),
    occupancyType: text('occupancy_type').default('INDUSTRIAL_PROCESS').notNull(),
    nfpa13Edition: text('nfpa13_edition').default('2022').notNull(),
    nfpa10Edition: text('nfpa10_edition').default('2022').notNull(),
    floorsAboveGround: integer('floors_above_ground').default(1).notNull(),
    basementFloors: integer('basement_floors').default(0).notNull(),
    structureType: text('structure_type').default('CONCRETE').notNull(),
    ceilingType: text('ceiling_type').default('FLAT_UNOBSTRUCTED').notNull(),
    storedMaterials: text('stored_materials').default('').notNull(),
    hazardNature: jsonb('hazard_nature').default([]).notNull(),
    riskLevelOverride: text('risk_level_override').default('AUTO').notNull(),
    occupantLoad: integer('occupant_load').default(0).notNull(),
    activityType: text('activity_type').default('').notNull(),
    waterSourceType: text('water_source_type'),
    waterSupply: jsonb('water_supply').default({}).notNull(),
    currentSuppressionNotes: text('current_suppression_notes'),
    status: text('status').default('DRAFT').notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    deletedAt: timestamp('deleted_at'),
    deletedBy: text('deleted_by'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_fire_design_buildings_code').on(table.code),
    index('idx_fire_design_buildings_unit').on(table.unitName),
    index('idx_fire_design_buildings_status').on(table.status),
    index('idx_fire_design_buildings_is_deleted').on(table.isDeleted),
  ]
);

export const fireDesignFloors = pgTable(
  'fire_design_floors',
  {
    id: serial('id').primaryKey(),
    buildingId: integer('building_id')
      .references(() => fireDesignBuildings.id, { onDelete: 'cascade' })
      .notNull(),
    floorCode: text('floor_code').notNull(),
    floorLabel: text('floor_label').notNull(),
    floorOrder: integer('floor_order').default(0).notNull(),
    isBasement: boolean('is_basement').default(false).notNull(),
    lengthM: doublePrecision('length_m').default(0).notNull(),
    widthM: doublePrecision('width_m').default(0).notNull(),
    ceilingHeightM: doublePrecision('ceiling_height_m').default(0).notNull(),
    areaSqm: doublePrecision('area_sqm').default(0).notNull(),
    falseCeilingHeightM: doublePrecision('false_ceiling_height_m').default(0).notNull(),
    beamDepthM: doublePrecision('beam_depth_m').default(0).notNull(),
    beamSpacingM: doublePrecision('beam_spacing_m').default(0).notNull(),
    spaces: jsonb('spaces').default([]).notNull(),
    obstacles: jsonb('obstacles').default([]).notNull(),
    floorPlanFileId: text('floor_plan_file_id'),
    floorPlanFileName: text('floor_plan_file_name'),
    floorPlanMimeType: text('floor_plan_mime_type'),
    floorPlanWidthPx: integer('floor_plan_width_px'),
    floorPlanHeightPx: integer('floor_plan_height_px'),
    scaleMetersPerPixel: doublePrecision('scale_meters_per_pixel'),
    calibrationLine: jsonb('calibration_line'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_fire_design_floors_building').on(table.buildingId),
    index('idx_fire_design_floors_order').on(table.buildingId, table.floorOrder),
  ]
);

export const fireDesignLayouts = pgTable(
  'fire_design_layouts',
  {
    id: serial('id').primaryKey(),
    buildingId: integer('building_id')
      .references(() => fireDesignBuildings.id, { onDelete: 'cascade' })
      .notNull(),
    floorId: integer('floor_id')
      .references(() => fireDesignFloors.id, { onDelete: 'cascade' })
      .notNull(),
    revision: integer('revision').default(1).notNull(),
    nfpa13Edition: text('nfpa13_edition').default('2022').notNull(),
    nfpa10Edition: text('nfpa10_edition').default('2022').notNull(),
    sprinklerConfig: jsonb('sprinkler_config').default({}).notNull(),
    extinguisherConfig: jsonb('extinguisher_config').default({}).notNull(),
    placedItems: jsonb('placed_items').default([]).notNull(),
    calculationSnapshot: jsonb('calculation_snapshot').default({}).notNull(),
    complianceSummary: jsonb('compliance_summary').default({}).notNull(),
    status: text('status').default('DRAFT').notNull(),
    calculatedBy: text('calculated_by'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at'),
    reviewNotes: text('review_notes'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_fire_design_layouts_building').on(table.buildingId),
    index('idx_fire_design_layouts_floor').on(table.floorId),
    index('idx_fire_design_layouts_status').on(table.status),
  ]
);

export const fireDesignSystems = pgTable(
  'fire_design_systems',
  {
    id: serial('id').primaryKey(),
    buildingId: integer('building_id')
      .references(() => fireDesignBuildings.id, { onDelete: 'cascade' })
      .notNull(),
    floorId: integer('floor_id').references(() => fireDesignFloors.id, { onDelete: 'cascade' }),
    systemType: text('system_type').notNull(),
    standardCode: text('standard_code').notNull(),
    standardEdition: text('standard_edition').notNull(),
    localCodeNotes: text('local_code_notes'),
    designInputs: jsonb('design_inputs').default({}).notNull(),
    calculationOutput: jsonb('calculation_output').default({}).notNull(),
    complianceStatus: text('compliance_status').default('INCOMPLETE').notNull(),
    designStage: text('design_stage').default('PRELIMINARY').notNull(),
    version: integer('version').default(1).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    updatedBy: text('updated_by'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at'),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_fire_design_systems_building').on(table.buildingId),
    index('idx_fire_design_systems_floor').on(table.floorId),
    index('idx_fire_design_systems_type').on(table.systemType),
  ]
);

export const fireDesignGapActions = pgTable(
  'fire_design_gap_actions',
  {
    id: serial('id').primaryKey(),
    buildingId: integer('building_id')
      .references(() => fireDesignBuildings.id, { onDelete: 'cascade' })
      .notNull(),
    floorId: integer('floor_id').references(() => fireDesignFloors.id, { onDelete: 'cascade' }),
    actionCode: text('action_code').notNull().unique(),
    systemType: text('system_type').notNull(),
    gapType: text('gap_type').default('DEFICIT').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    riskPriority: text('risk_priority').default('HIGH').notNull(),
    recommendedAction: text('recommended_action').notNull(),
    responsiblePerson: text('responsible_person'),
    dueDate: text('due_date'),
    status: text('status').default('OPEN').notNull(),
    resolutionNotes: text('resolution_notes'),
    createdBy: text('created_by'),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_fire_design_gap_building').on(table.buildingId),
    index('idx_fire_design_gap_status').on(table.status),
    index('idx_fire_design_gap_priority').on(table.riskPriority),
  ]
);

// ==========================================
// 20. Chemical Safety Data Sheets (SDS / GHS / ISO 11014)
// ==========================================
export const sdsRecords = pgTable(
  'sds_records',
  {
    id: serial('id').primaryKey(),
    sdsUid: text('sds_uid').notNull().unique(),
    documentNumber: text('document_number').notNull(),
    materialNameFa: text('material_name_fa').notNull(),
    materialNameEn: text('material_name_en').notNull(),
    materialNameNormalized: text('material_name_normalized').notNull(),
    tradeName: text('trade_name'),
    casNumber: text('cas_number'),
    casNumberNormalized: text('cas_number_normalized'),
    unNumber: text('un_number'),
    manufacturer: text('manufacturer'),
    supplier: text('supplier'),
    unitId: integer('unit_id').references(() => orgUnits.id, { onDelete: 'set null' }),
    unitName: text('unit_name').default('عمومی مجتمع').notNull(),
    storageLocation: text('storage_location'),
    physicalState: text('physical_state').default('LIQUID').notNull(), // GAS, LIQUID, SOLID, POWDER, MIXTURE, OTHER
    revisionNumber: integer('revision_number').default(1).notNull(),
    preparedDate: text('prepared_date').notNull(),
    lastRevisionDate: text('last_revision_date'),
    revisionTriggerReason: text('revision_trigger_reason'),
    needsRevision: boolean('needs_revision').default(false).notNull(),
    reviewAlertMessage: text('review_alert_message'),
    status: text('status').default('DRAFT').notNull(), // DRAFT, UNDER_REVIEW, APPROVED, PUBLISHED, OBSOLETE
    ghsData: jsonb('ghs_data').default({}).notNull(),
    sections: jsonb('sections').default({}).notNull(), // 16 standardized GHS/ISO 11014 sections
    primaryFileId: text('primary_file_id'),
    aiExtractionMetadata: jsonb('ai_extraction_metadata').default({}).notNull(), // Extensibility hook for future AI/OCR extraction & incompatibility checks
    linkedRiskRefs: jsonb('linked_refs').default({}).notNull(), // Future links to Risk Assessment, HAZOP, Warehouse, Emergency
    createdBy: text('created_by'),
    createdByRole: text('created_by_role'),
    updatedBy: text('updated_by'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: timestamp('reviewed_at'),
    approvedBy: text('approved_by'),
    approvedAt: timestamp('approved_at'),
    publishedBy: text('published_by'),
    publishedAt: timestamp('published_at'),
    obsoleteReason: text('obsolete_reason'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_sds_records_cas').on(table.casNumberNormalized),
    index('idx_sds_records_name_norm').on(table.materialNameNormalized),
    index('idx_sds_records_status').on(table.status),
    index('idx_sds_records_unit').on(table.unitName),
    index('idx_sds_records_deleted').on(table.deletedAt),
  ]
);

export const sdsRevisions = pgTable(
  'sds_revisions',
  {
    id: serial('id').primaryKey(),
    sdsId: integer('sds_id')
      .references(() => sdsRecords.id, { onDelete: 'cascade' })
      .notNull(),
    revisionNumber: integer('revision_number').notNull(),
    statusAtSnapshot: text('status_at_snapshot').notNull(),
    changeSummary: text('change_summary'),
    triggerReason: text('trigger_reason'),
    snapshot: jsonb('snapshot').notNull(),
    createdBy: text('created_by'),
    editorName: text('editor_name'),
    approverName: text('approver_name'),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_sds_revisions_sds').on(table.sdsId),
    index('idx_sds_revisions_num').on(table.sdsId, table.revisionNumber),
  ]
);

export const sdsAttachments = pgTable(
  'sds_attachments',
  {
    id: serial('id').primaryKey(),
    sdsId: integer('sds_id')
      .references(() => sdsRecords.id, { onDelete: 'cascade' })
      .notNull(),
    fileId: text('file_id').notNull(), // Links to system_files.file_id
    attachmentRole: text('attachment_role').default('OTHER').notNull(), // PRIMARY_SDS_PDF, TECHNICAL_SPEC, COA, STORAGE_INSTRUCTION, TRANSPORT_DOC, OTHER
    title: text('title'),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
    notes: text('notes'),
    uploadedBy: text('uploaded_by'),
    uploaderRole: text('uploader_role'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_sds_attachments_sds').on(table.sdsId),
    index('idx_sds_attachments_file').on(table.fileId),
    index('idx_sds_attachments_deleted').on(table.deletedAt),
  ]
);

