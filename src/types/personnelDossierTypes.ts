import { ComplexPersonnel } from '../utils/personnelHelper';
import { WarningRecord, WorkPermit, PpeIssuanceRecord, SafetyIncidentRecord, UserProfile, AuditLogEntry } from '../types';
import { PeriodicMedicalExam, PeriodicMedicalRecord } from '../modules/health-env/types';
import { AnyRiskAssessment } from '../modules/risk-assessment/types';
import { OperationalSafetyInspection } from '../modules/safety-dept/types';
import { PtwAuditRecord } from '../modules/ptw-audit/types';

export interface CareerProgressionItem {
  id: string;
  personnelCode: string;
  date: string; // Shamsi e.g. 1401/04/15
  previousUnit?: string;
  newUnit: string;
  previousJobTitle?: string;
  newJobTitle: string;
  changeType: 'ESTABLISHMENT' | 'PROMOTION' | 'TRANSFER' | 'CONTRACT_RENEWAL' | 'REORGANIZATION';
  description?: string;
  approvedBy?: string;
}

export interface OccupationalRestrictionItem {
  id: string;
  personnelCode: string;
  title: string; // e.g. عدم کار در ارتفاع بالای ۲ متر
  category: 'PHYSICAL' | 'CHEMICAL' | 'ERGONOMIC' | 'PSYCHOLOGICAL' | 'SHIFT_WORK' | 'ENVIRONMENTAL';
  severity: 'TEMPORARY' | 'PERMANENT';
  startDate: string; // Shamsi
  endDate?: string;
  physicianName: string;
  medicalCenter?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  notes?: string;
  referenceExamId?: string;
}

export interface QualificationCertificateItem {
  id: string;
  personnelCode: string;
  certificateName: string; // e.g. گواهینامه رانندگی لیفتراک، داربست‌بندی صنعتی، بازرسی جوش NDT
  category: 'HEAVY_MACHINERY' | 'CRITICAL_WORKS' | 'FIRE_SAFETY' | 'FIRST_AID' | 'TECHNICAL';
  issuingAuthority: string; // e.g. سازمان فنی و حرفه‌ای، مرکز تحقیقات بهداشت و ایمنی کار
  certificateNumber: string;
  issueDate: string; // Shamsi
  expiryDate?: string;
  isValid: boolean;
  scoreOrGrade?: string;
  attachmentUrl?: string;
}

export interface BbsObservationItem {
  id: string;
  personnelCode?: string;
  personnelName: string;
  observerName: string;
  observationDate: string; // Shamsi
  unit: string;
  workArea: string;
  behaviorType: 'SAFE' | 'AT_RISK';
  category: 'PPE' | 'BODY_POSITION' | 'TOOLS_EQUIPMENT' | 'HOUSEKEEPING' | 'PROCEDURES';
  description: string;
  feedbackGiven: boolean;
  correctiveAction?: string;
}

export interface DossierAttachmentItem {
  id: string;
  personnelCode: string;
  fileName: string;
  fileType: string;
  category: 'NATIONAL_ID' | 'MEDICAL_CARD' | 'DIPLOMA' | 'CERTIFICATE' | 'CONTRACT' | 'OTHER';
  fileSize: number; // bytes
  uploadDate: string;
  uploadedBy: string;
  dataUrl?: string;
  description?: string;
}

export interface PersonnelDossierSummary {
  safetyScore: number; // 0 - 100
  fitnessStatus: 'FIT' | 'CONDITIONAL' | 'UNFIT' | 'UNDER_REVIEW' | 'UNKNOWN';
  fitnessStatusFa: string;
  totalTrainingHours: number;
  completedCoursesCount: number;
  activePermitsCount: number;
  totalPermitsCount: number;
  activeRestrictionsCount: number;
  validCertificatesCount: number;
  totalIncidentsCount: number;
  totalWarningsCount: number;
  openCapaCount: number;
  totalCapaCount: number;
  totalReferralsCount: number;
  totalInspectionsCount: number;
  clinicVisitsCount: number;
  lastMedicalExamDate?: string;
  lastSafetyInductionDate?: string;
  cleanRecordDays: number;
}

export interface ComprehensivePersonnelDossier {
  personnel: ComplexPersonnel;
  userAccount?: UserProfile | null;
  summary: PersonnelDossierSummary;
  
  // Tab-specific datasets across all system modules
  careerHistory: CareerProgressionItem[];
  trainingCourses: any[];
  trainingNeeds: any[];
  safetyInductions: any[];
  medicalExams: PeriodicMedicalExam[];
  medicalRecord?: PeriodicMedicalRecord | null;
  medicalTestResults?: any[];
  clinicVisits?: any[];
  nutritionRecords?: any[];
  occupationalRestrictions: OccupationalRestrictionItem[];
  incidents: SafetyIncidentRecord[];
  bbsObservations: BbsObservationItem[];
  riskAssessments: AnyRiskAssessment[];
  workPermits: WorkPermit[];
  ptwAudits: PtwAuditRecord[];
  safetyInspections: OperationalSafetyInspection[];
  healthEnvInspections: any[];
  fiveSInspections: any[];
  nonConformances: any[];
  referrals: any[];
  warnings: WarningRecord[];
  ppeIssuances: PpeIssuanceRecord[];
  qualifications: QualificationCertificateItem[];
  attachments: DossierAttachmentItem[];
  auditLogs: AuditLogEntry[];
}

