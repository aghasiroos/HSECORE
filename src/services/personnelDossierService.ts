import { ComplexPersonnel } from '../utils/personnelHelper';
import { 
  ComprehensivePersonnelDossier, 
  PersonnelDossierSummary,
  OccupationalRestrictionItem,
  QualificationCertificateItem,
  CareerProgressionItem,
  BbsObservationItem,
  DossierAttachmentItem
} from '../types/personnelDossierTypes';
import { WarningRecord, WorkPermit, PpeIssuanceRecord, SafetyIncidentRecord, UserProfile, AuditLogEntry } from '../types';
import { PeriodicMedicalExam, PeriodicMedicalRecord } from '../modules/health-env/types';
import { medicalExamService } from '../modules/health-env/services/medicalExamService';
import { clinicService } from '../modules/health-env/services/clinicService';
import { nutritionService } from '../modules/health-env/services/nutritionService';
import { riskAssessmentService } from '../modules/risk-assessment/services/riskAssessmentService';
import { safetyDeptService } from '../modules/safety-dept/services/safetyDeptService';
import { getPtwAudits } from '../modules/ptw-audit/services/ptwAuditService';
import { addAuditLog } from '../utils/authHelper';
import { apiDb } from './apiDatabaseClient';

const STORAGE_KEYS = {
  RESTRICTIONS: 'hse_personnel_restrictions_v1',
  QUALIFICATIONS: 'hse_personnel_qualifications_v1',
  CAREER_HISTORY: 'hse_personnel_career_history_v1',
  ATTACHMENTS: 'hse_personnel_attachments_v1',
  BBS_RECORDS: 'hse_bbs_records_v1'
};

// Initial realistic seeds for BBS observations
const SEED_BBS_OBSERVATIONS: any[] = [];

const dossierMemoryStore = new Map<string, any>();

class PersonnelDossierService {
  private getStored<T>(key: string, fallback: T): T {
    if (dossierMemoryStore.has(key)) {
      return dossierMemoryStore.get(key) as T;
    }
    apiDb.getSetting(key).then(val => {
      if (val !== null && val !== undefined) {
        dossierMemoryStore.set(key, val);
      }
    }).catch(() => {});
    return fallback;
  }

  private setStored<T>(key: string, value: T): void {
    dossierMemoryStore.set(key, value);
    apiDb.saveSetting(key, value, `Personnel Dossier Data: ${key}`).catch(console.error);
  }

  /**
   * Normalize Persian text (Arabic Kaf/Yeh, zero-width spaces, diacritics)
   */
  private normalizePersian(str?: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
      .replace(/[\u064B-\u065F]/g, '') // remove arabic diacritics
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه')
      .replace(/[\s\-_]+/g, ' ')
      .trim();
  }

  /**
   * Helper matching personnel by Code, National Code, or Name
   */
  private matchPersonnel(
    personnel: ComplexPersonnel, 
    codeField?: string | number, 
    nameField?: string,
    extraIdentifiers?: (string | number | undefined | null)[]
  ): boolean {
    const rawPCode = (personnel.personnelCode || personnel.effectiveCode || '').toString().trim();
    const rawNatCode = (personnel.nationalCode || '').toString().trim();
    const pCodeNorm = this.normalizePersian(rawPCode);
    const natCodeNorm = this.normalizePersian(rawNatCode);
    
    // Numeric variants (without leading zeros or non-digits)
    const pCodeDigits = rawPCode.replace(/\D/g, '');
    const natCodeDigits = rawNatCode.replace(/\D/g, '');

    const firstNameNorm = this.normalizePersian(personnel.firstName);
    const lastNameNorm = this.normalizePersian(personnel.lastName);
    const fullNameNorm = this.normalizePersian(personnel.fullName || `${personnel.firstName || ''} ${personnel.lastName || ''}`);

    const cNorm = this.normalizePersian(codeField?.toString());
    const nNorm = this.normalizePersian(nameField);

    // 1. Direct Code / National Code matches
    if (cNorm) {
      if (pCodeNorm && (cNorm === pCodeNorm || cNorm.includes(pCodeNorm) || pCodeNorm.includes(cNorm))) return true;
      if (natCodeNorm && (cNorm === natCodeNorm || cNorm.includes(natCodeNorm) || natCodeNorm.includes(cNorm))) return true;
      const cDigits = cNorm.replace(/\D/g, '');
      if (cDigits) {
        if (pCodeDigits && (cDigits === pCodeDigits || (pCodeDigits.length >= 3 && cDigits.endsWith(pCodeDigits)))) return true;
        if (natCodeDigits && (cDigits === natCodeDigits || (natCodeDigits.length >= 8 && cDigits.endsWith(natCodeDigits)))) return true;
      }
    }

    // 2. Name matches
    if (nNorm) {
      if (fullNameNorm && (nNorm === fullNameNorm || nNorm.includes(fullNameNorm) || fullNameNorm.includes(nNorm))) return true;
      if (firstNameNorm && lastNameNorm && nNorm.includes(firstNameNorm) && nNorm.includes(lastNameNorm)) return true;
      if (lastNameNorm && lastNameNorm.length >= 3 && nNorm.includes(lastNameNorm)) return true;
      if (pCodeNorm && pCodeNorm.length >= 3 && nNorm.includes(pCodeNorm)) return true;
      if (natCodeNorm && natCodeNorm.length >= 5 && nNorm.includes(natCodeNorm)) return true;
    }

    // 3. Extra identifiers (e.g. username, userId, national code in other fields)
    if (extraIdentifiers && extraIdentifiers.length > 0) {
      for (const extra of extraIdentifiers) {
        if (!extra) continue;
        const extraNorm = this.normalizePersian(extra.toString());
        if (pCodeNorm && extraNorm === pCodeNorm) return true;
        if (natCodeNorm && extraNorm === natCodeNorm) return true;
        if (fullNameNorm && (extraNorm === fullNameNorm || extraNorm.includes(fullNameNorm))) return true;
      }
    }

    return false;
  }

  /**
   * Build complete 360-degree dossier for a given personnel
   */
  public async buildDossier(personnel: ComplexPersonnel): Promise<ComprehensivePersonnelDossier> {
    const pCode = (personnel.personnelCode || personnel.effectiveCode || '').toString().trim();
    const natCode = (personnel.nationalCode || '').toString().trim();

    // Fetch all related master datasets from database backend in parallel
    const [
      rawUsers,
      rawWarnings,
      rawPermits,
      rawPpe,
      rawIncidents,
      rawCourses,
      rawTrainingNeeds,
      rawNonConformances,
      rawReferrals,
      rawFiveSInspections,
      rawFiveSAudits,
      rawHealthEnvInspections,
      rawSafetyInspections,
      rawRiskAssessments,
      rawPtwAudits,
      rawMedicalTestResults,
      rawBbs,
      rawRestrictions,
      rawQualifications,
      rawCareer,
      rawAttachments,
      rawLogs
    ] = await Promise.all([
      apiDb.getUsers().catch(() => []),
      apiDb.getSafetyWarnings().catch(() => []),
      apiDb.getWorkPermits().catch(() => []),
      apiDb.getPpeIssuance().catch(() => []),
      apiDb.getIncidents().catch(() => []),
      apiDb.getTrainingCourses().catch(() => []),
      apiDb.getTrainingNeeds().catch(() => []),
      apiDb.getNonConformances().catch(() => []),
      apiDb.getReferrals().catch(() => []),
      apiDb.getFiveSInspections().catch(() => []),
      apiDb.getFiveSAudits().catch(() => []),
      apiDb.getHealthEnvInspections().catch(() => []),
      apiDb.getSafetyInspections().catch(() => []),
      apiDb.getRiskAssessments().catch(() => []),
      apiDb.getPtwAuditRecords().catch(() => []),
      apiDb.getMedicalTestResults().catch(() => []),
      apiDb.getSetting(STORAGE_KEYS.BBS_RECORDS).then(v => Array.isArray(v) ? v : []),
      apiDb.getSetting(STORAGE_KEYS.RESTRICTIONS).then(v => Array.isArray(v) ? v : []),
      apiDb.getSetting(STORAGE_KEYS.QUALIFICATIONS).then(v => Array.isArray(v) ? v : []),
      apiDb.getSetting(STORAGE_KEYS.CAREER_HISTORY).then(v => Array.isArray(v) ? v : []),
      apiDb.getSetting(STORAGE_KEYS.ATTACHMENTS).then(v => Array.isArray(v) ? v : []),
      apiDb.getAuditLogs().catch(() => [])
    ]);

    // 1. User Account
    const matchedUser = (rawUsers as UserProfile[]).find(u => 
      this.matchPersonnel(personnel, u.personnelNumber, u.fullName, [u.username, u.email, (u as any).nationalId])
    ) || null;

    const userExtraIds = matchedUser ? [matchedUser.username, matchedUser.id, matchedUser.email] : [];

    // 2. Disciplinary Warnings
    const warnings = (rawWarnings as WarningRecord[]).filter(w => 
      this.matchPersonnel(personnel, (w as any).personnelCode, w.name, [(w as any).nationalCode])
    );

    // 3. Work Permits (PTW)
    const allPermitsMap = new Map<string, WorkPermit>();
    (rawPermits as WorkPermit[]).forEach(p => {
      if (p.id) allPermitsMap.set(p.id, p);
    });
    const workPermits = Array.from(allPermitsMap.values()).filter(p => {
      const resp: any = p.responsibles || {};
      const desc = (p.description || '').toLowerCase();
      const loc = (p.location || '').toLowerCase();

      const matchedResp = 
        this.matchPersonnel(personnel, '', resp.jobExecutor) ||
        this.matchPersonnel(personnel, '', resp.unitSupervisor) ||
        this.matchPersonnel(personnel, '', resp.registeredBy) ||
        this.matchPersonnel(personnel, '', resp.safetyUnit) ||
        this.matchPersonnel(personnel, '', (p as any).gasTester) ||
        this.matchPersonnel(personnel, '', (p as any).applicantName);

      if (matchedResp) return true;
      if (pCode && (desc.includes(pCode.toLowerCase()) || loc.includes(pCode.toLowerCase()))) return true;
      if (personnel.lastName && desc.includes(personnel.lastName.toLowerCase())) return true;
      return false;
    });

    // 4. PTW Audits
    let ptwAudits: any[] = [];
    try {
      const allLocalAudits = getPtwAudits();
      const combinedAudits = [...(rawPtwAudits as any[] || []), ...allLocalAudits];
      const auditMap = new Map<string, any>();
      combinedAudits.forEach(a => {
        if (a && a.id) auditMap.set(a.id, a);
      });
      ptwAudits = Array.from(auditMap.values()).filter(a => 
        this.matchPersonnel(personnel, (a as any).auditorPersonnelCode, a.signers?.workPerformerName || a.signers?.safetyUnitSignerName) ||
        this.matchPersonnel(personnel, '', a.signers?.areaResponsibleName) ||
        this.matchPersonnel(personnel, '', a.signers?.seniorShiftSupervisorName) ||
        this.matchPersonnel(personnel, (a as any).inspectorCode, (a as any).inspectorName)
      );
    } catch {
      ptwAudits = [];
    }

    // 5. PPE Issuance
    const ppeIssuances = (rawPpe as PpeIssuanceRecord[]).filter(p => 
      this.matchPersonnel(personnel, p.personnelCode, p.personnelName, [(p as any).nationalCode])
    );

    // 6. Safety Incidents & Anomalies
    const incidentMap = new Map<string, SafetyIncidentRecord>();
    (rawIncidents as SafetyIncidentRecord[]).forEach(i => {
      if (i.id) incidentMap.set(i.id, i);
    });
    const incidents = Array.from(incidentMap.values()).filter(inc => {
      if (this.matchPersonnel(personnel, inc.reporterPersonnelCode, inc.reporterName)) return true;
      if (this.matchPersonnel(personnel, (inc as any).injuredPersonCode, (inc as any).injuredPersonName)) return true;
      if (inc.capaList && Array.isArray(inc.capaList)) {
        if (inc.capaList.some(c => this.matchPersonnel(personnel, '', c.responsiblePerson))) return true;
      }
      return false;
    });

    // 7. Training Courses & Needs
    const trainingCourses = (rawCourses as any[]).filter(t => 
      this.matchPersonnel(personnel, t.personnelCode, `${t.firstName || ''} ${t.lastName || ''}`, [t.nationalCode, t.personnelName])
    );
    const trainingNeeds = (rawTrainingNeeds as any[]).filter(tn => 
      this.matchPersonnel(personnel, tn.personnelCode, tn.personnelName, [tn.nationalCode])
    );

    // 8. Occupational Health & Periodic Exams & Lab Tests
    let medicalExams: PeriodicMedicalExam[] = [];
    let medicalRecord: PeriodicMedicalRecord | null = null;
    let clinicVisits: any[] = [];
    let nutritionRecords: any[] = [];
    let medicalTestResults: any[] = [];

    try {
      const allExams = medicalExamService.getAllExams();
      medicalExams = allExams.filter(e => 
        this.matchPersonnel(personnel, e.employeeCode, (e as any).employeeName, [(e as any).nationalCode])
      );
      const allRecords = medicalExamService.getAllRecords();
      medicalRecord = allRecords.find(r => 
        this.matchPersonnel(personnel, r.employeeCode, r.fullName, [r.nationalCode])
      ) || null;

      // Filter structured medical test results
      if (rawMedicalTestResults && Array.isArray(rawMedicalTestResults)) {
        medicalTestResults = rawMedicalTestResults.filter(tr => 
          this.matchPersonnel(personnel, tr.personnelCode, tr.personnelName, [tr.nationalCode])
        );
      }

      // Integrated Dispensary & Clinic visits from database
      if (pCode || natCode) {
        clinicVisits = await clinicService.getPersonnelHistory(pCode || natCode);
        nutritionRecords = await nutritionService.getPersonnelHistory(pCode || natCode);
      }
    } catch {
      // fallback
    }

    // 9. Risk Assessments (JSA, FMEA, FTA, HHA)
    let riskAssessments: any[] = [];
    try {
      const allAssessments = (rawRiskAssessments as any[]).length > 0 
        ? rawRiskAssessments 
        : await riskAssessmentService.getAssessments().catch(() => []);
      
      riskAssessments = allAssessments.filter(a => {
        if (this.matchPersonnel(personnel, '', a.assessorName)) return true;
        if (this.matchPersonnel(personnel, '', a.hseEngineerName)) return true;
        if (this.matchPersonnel(personnel, '', a.approverName)) return true;
        if (a.teamMembers && Array.isArray(a.teamMembers)) {
          if (a.teamMembers.some((m: string) => this.matchPersonnel(personnel, '', m))) return true;
        }
        if (a.method === 'JSA' && (a as any).steps) {
          if ((a as any).steps.some((s: any) => this.matchPersonnel(personnel, '', s.actionOwner))) return true;
        }
        return false;
      });
    } catch {
      riskAssessments = [];
    }

    // 10. Operational Safety Inspections
    let safetyInspections: any[] = [];
    try {
      const allInsps = (rawSafetyInspections as any[]).length > 0 
        ? rawSafetyInspections 
        : safetyDeptService.getAllInspections();
      
      safetyInspections = allInsps.filter(i => 
        this.matchPersonnel(personnel, '', i.inspectorName) ||
        this.matchPersonnel(personnel, '', (i as any).supervisorName) ||
        this.matchPersonnel(personnel, (i as any).inspectorCode, '')
      );
    } catch {
      safetyInspections = [];
    }

    // 11. Health & Environmental Inspections
    const healthEnvInspections = (rawHealthEnvInspections as any[]).filter(hei => 
      this.matchPersonnel(personnel, (hei as any).inspectorCode, hei.inspectorName, [hei.auditorName, hei.responsibleName])
    );

    // 12. 5S Inspections & Audits
    const combined5S = [
      ...(rawFiveSInspections as any[] || []),
      ...(rawFiveSAudits as any[] || [])
    ];
    const fiveSMap = new Map<string, any>();
    combined5S.forEach(item => {
      if (item && item.id) fiveSMap.set(item.id.toString(), item);
    });
    const fiveSInspections = Array.from(fiveSMap.values()).filter(fi => 
      this.matchPersonnel(personnel, (fi as any).inspectorCode, fi.inspectorName || fi.auditorName, [(fi as any).responsiblePerson])
    );

    // 13. System CAPA & Non-Conformances
    const nonConformances = (rawNonConformances as any[]).filter(nc => 
      this.matchPersonnel(personnel, (nc as any).assignedToCode, nc.assignedTo || nc.responsiblePerson, [
        nc.reportedBy, 
        (nc as any).reporterName,
        ...userExtraIds
      ])
    );

    // 14. Document Referrals & Digital Signatures
    const referrals = (rawReferrals as any[]).filter(ref => 
      this.matchPersonnel(personnel, (ref as any).receiverCode, ref.receiverName, [
        ref.senderName,
        (ref as any).senderCode,
        ref.receiverId,
        ref.senderId,
        ...userExtraIds
      ])
    );

    // 15. BBS Observations
    const bbsObservations = (rawBbs as BbsObservationItem[]).filter(b => 
      this.matchPersonnel(personnel, b.personnelCode, b.personnelName) ||
      this.matchPersonnel(personnel, '', b.observerName)
    );

    // 16. Occupational Restrictions
    const occupationalRestrictions = (rawRestrictions as OccupationalRestrictionItem[]).filter(r => 
      this.matchPersonnel(personnel, r.personnelCode, '', [(r as any).nationalCode])
    );

    // 17. Qualifications & Special Licenses
    const qualifications = (rawQualifications as QualificationCertificateItem[]).filter(q => 
      this.matchPersonnel(personnel, q.personnelCode, '', [(q as any).nationalCode])
    );

    // 18. Career Progression History
    const careerHistory = (rawCareer as CareerProgressionItem[]).filter(c => 
      this.matchPersonnel(personnel, c.personnelCode, '', [(c as any).nationalCode])
    );

    // 19. Attachments
    const attachments = (rawAttachments as DossierAttachmentItem[]).filter(a => 
      this.matchPersonnel(personnel, a.personnelCode, '', [(a as any).nationalCode])
    );

    // 20. Audit Logs
    const auditLogs = (rawLogs as AuditLogEntry[]).filter(l => {
      if (matchedUser && l.username === matchedUser.username) return true;
      const act = (l.action || '').toLowerCase();
      const desc = (l.description || '').toLowerCase();
      if (pCode && (act.includes(pCode.toLowerCase()) || desc.includes(pCode.toLowerCase()))) return true;
      if (personnel.lastName && (act.includes(personnel.lastName.toLowerCase()) || desc.includes(personnel.lastName.toLowerCase()))) return true;
      return false;
    });

    // 21. Compute Comprehensive KPI Summary
    const totalTrainingHours = trainingCourses.reduce((sum, item) => sum + (Number(item.hours) || 0), 0);
    const activePermitsCount = workPermits.filter(p => 
      p.status === 'Approved' || p.status === 'Issued' || p.status === 'Active' || p.status === 'Extended'
    ).length;
    const activeRestrictionsCount = occupationalRestrictions.filter(r => r.status === 'ACTIVE').length;
    const validCertificatesCount = qualifications.filter(q => q.isValid).length;

    // Safety Score Calculation
    let penalty = 0;
    warnings.forEach(() => { penalty += 10; });
    incidents.forEach(i => {
      if (i.category === 'Incident') penalty += 15;
      else penalty += 5;
    });
    nonConformances.forEach(nc => {
      if (nc.status === 'Open' || nc.status === 'In_Progress') penalty += 4;
    });
    const safetyScore = Math.max(20, Math.min(100, 100 - penalty));

    // Determine Medical Fitness Status
    let fitnessStatus: PersonnelDossierSummary['fitnessStatus'] = 'UNKNOWN';
    let fitnessStatusFa = 'نامشخص (معاینه ثبت نشده)';
    if (medicalExams.length > 0) {
      const latestExam = [...medicalExams].sort((a, b) => (b.examYear || 0) - (a.examYear || 0))[0];
      const verdict = (latestExam.status || (latestExam as any).doctorVerdict || '').toUpperCase();
      if (verdict.includes('FIT') && !verdict.includes('UNFIT')) {
        fitnessStatus = 'FIT';
        fitnessStatusFa = 'مناسب و بلامانع جهت کار';
      } else if (verdict.includes('CONDITIONAL') || activeRestrictionsCount > 0) {
        fitnessStatus = 'CONDITIONAL';
        fitnessStatusFa = 'مشروط با محدودیت شغلی';
      } else if (verdict.includes('UNFIT')) {
        fitnessStatus = 'UNFIT';
        fitnessStatusFa = 'نامناسب (عدم انطباق پزشکی)';
      } else {
        fitnessStatus = 'UNDER_REVIEW';
        fitnessStatusFa = 'در حال بررسی و تکمیل آزمایشات';
      }
    } else if (activeRestrictionsCount > 0) {
      fitnessStatus = 'CONDITIONAL';
      fitnessStatusFa = 'دارای محدودیت شغلی فعال';
    }

    const latestExam = medicalExams.length > 0 
      ? [...medicalExams].sort((a, b) => (b.examYear || 0) - (a.examYear || 0))[0]
      : null;

    const incidentCapaCount = incidents.reduce((acc, curr) => acc + (curr.capaList?.filter(c => c.status !== 'Closed').length || 0), 0);
    const openSystemCapaCount = nonConformances.filter(nc => nc.status === 'Open' || nc.status === 'In_Progress' || nc.status === 'Overdue').length;
    const totalCapaCount = nonConformances.length + incidents.reduce((acc, curr) => acc + (curr.capaList?.length || 0), 0);

    const summary: PersonnelDossierSummary = {
      safetyScore,
      fitnessStatus,
      fitnessStatusFa,
      totalTrainingHours,
      completedCoursesCount: trainingCourses.length,
      activePermitsCount,
      totalPermitsCount: workPermits.length,
      activeRestrictionsCount,
      validCertificatesCount,
      totalIncidentsCount: incidents.length,
      totalWarningsCount: warnings.length,
      openCapaCount: incidentCapaCount + openSystemCapaCount,
      totalCapaCount,
      totalReferralsCount: referrals.length,
      totalInspectionsCount: safetyInspections.length + healthEnvInspections.length + fiveSInspections.length + ptwAudits.length,
      clinicVisitsCount: clinicVisits.length,
      lastMedicalExamDate: latestExam ? latestExam.examDate || `${latestExam.examYear}/01/01` : undefined,
      cleanRecordDays: incidents.length === 0 ? 365 : 45
    };

    return {
      personnel,
      userAccount: matchedUser,
      summary,
      careerHistory,
      trainingCourses,
      trainingNeeds,
      safetyInductions: trainingCourses.filter(t => (t.courseTitle || '').includes('ایمنی') || (t.courseTitle || '').includes('HSE')),
      medicalExams,
      medicalRecord,
      medicalTestResults,
      clinicVisits,
      nutritionRecords,
      occupationalRestrictions,
      incidents,
      bbsObservations,
      riskAssessments,
      workPermits,
      ptwAudits,
      safetyInspections,
      healthEnvInspections,
      fiveSInspections,
      nonConformances,
      referrals,
      warnings,
      ppeIssuances,
      qualifications,
      attachments,
      auditLogs
    };
  }

  // --- CRUD RESTRICTIONS ---
  public addRestriction(restriction: Omit<OccupationalRestrictionItem, 'id'>): OccupationalRestrictionItem {
    const list: OccupationalRestrictionItem[] = this.getStored(STORAGE_KEYS.RESTRICTIONS, []);
    const newItem: OccupationalRestrictionItem = {
      ...restriction,
      id: `res-${Date.now()}`
    };
    list.unshift(newItem);
    this.setStored(STORAGE_KEYS.RESTRICTIONS, list);
    return newItem;
  }

  public deleteRestriction(id: string): void {
    const list: OccupationalRestrictionItem[] = this.getStored(STORAGE_KEYS.RESTRICTIONS, []);
    this.setStored(STORAGE_KEYS.RESTRICTIONS, list.filter(r => r.id !== id));
  }

  // --- CRUD QUALIFICATIONS ---
  public addQualification(qual: Omit<QualificationCertificateItem, 'id'>): QualificationCertificateItem {
    const list: QualificationCertificateItem[] = this.getStored(STORAGE_KEYS.QUALIFICATIONS, []);
    const newItem: QualificationCertificateItem = {
      ...qual,
      id: `qual-${Date.now()}`
    };
    list.unshift(newItem);
    this.setStored(STORAGE_KEYS.QUALIFICATIONS, list);
    return newItem;
  }

  public deleteQualification(id: string): void {
    const list: QualificationCertificateItem[] = this.getStored(STORAGE_KEYS.QUALIFICATIONS, []);
    this.setStored(STORAGE_KEYS.QUALIFICATIONS, list.filter(q => q.id !== id));
  }

  // --- CRUD CAREER PROGRESSION ---
  public addCareerItem(item: Omit<CareerProgressionItem, 'id'>): CareerProgressionItem {
    const list: CareerProgressionItem[] = this.getStored(STORAGE_KEYS.CAREER_HISTORY, []);
    const newItem: CareerProgressionItem = {
      ...item,
      id: `car-${Date.now()}`
    };
    list.unshift(newItem);
    this.setStored(STORAGE_KEYS.CAREER_HISTORY, list);
    return newItem;
  }

  // --- CRUD ATTACHMENTS ---
  public addAttachment(attachment: Omit<DossierAttachmentItem, 'id'>): DossierAttachmentItem {
    const list: DossierAttachmentItem[] = this.getStored(STORAGE_KEYS.ATTACHMENTS, []);
    const newItem: DossierAttachmentItem = {
      ...attachment,
      id: `att-${Date.now()}`
    };
    list.unshift(newItem);
    this.setStored(STORAGE_KEYS.ATTACHMENTS, list);
    return newItem;
  }

  public deleteAttachment(id: string): void {
    const list: DossierAttachmentItem[] = this.getStored(STORAGE_KEYS.ATTACHMENTS, []);
    this.setStored(STORAGE_KEYS.ATTACHMENTS, list.filter(a => a.id !== id));
  }

  // --- LOG AUDIT ---
  public logDossierAccess(personnel: ComplexPersonnel, user: any, action: 'VIEW' | 'PRINT' | 'EXPORT_PDF' | 'UPDATE'): void {
    try {
      const username = user?.username || 'کاربر جاری سیستم';
      const pName = personnel.fullName || `${personnel.firstName} ${personnel.lastName}`;
      const pCode = personnel.personnelCode || personnel.effectiveCode;
      
      let actionLabel = 'مشاهده پرونده جامع ۳۶۰ درجه پرسنل';
      if (action === 'PRINT') actionLabel = 'چاپ رسمی پرونده جامع پرسنل';
      if (action === 'EXPORT_PDF') actionLabel = 'خروجی PDF پرونده جامع پرسنل';
      if (action === 'UPDATE') actionLabel = 'بروزرسانی اطلاعات پرونده پرسنل';

      addAuditLog(
        username,
        `${actionLabel} (${pName} - کد ${pCode})`,
        'عملیات موفق',
        {
          module: 'Employees',
          page: 'سوابق و پرونده ۳۶۰ درجه',
          userRole: user?.role || 'User',
          description: `دسترسی و استعلام سوابق پرونده پرسنلی برای ${pName}`
        }
      );
    } catch (e) {
      console.warn('Could not log dossier access:', e);
    }
  }
}

export const personnelDossierService = new PersonnelDossierService();
