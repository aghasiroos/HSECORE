import { 
  PeriodicMedicalRecord, 
  PeriodicMedicalExam, 
  MedicalExamAttachment,
  MedicalExamStatus,
  MedicalExamType,
  MedicalFindings,
  StructuredLabResult,
  ImportAuditLogRecord,
  ExcelImportRowPreview,
  PdfExtractionPreview
} from '../types';
import { findPersonnelByCode, ComplexPersonnel, getComplexPersonnelList } from '../../../utils/personnelHelper';
import { addAuditLog } from '../../../utils/authHelper';
import { matchPersonnelRecord, normalizePersianString } from './personnelMatchingHelper';
import { labReferenceRangeService } from './labReferenceRangeService';
import { occupationalHealthStructuredService } from './occupationalHealthStructuredService';
import { MedicalItemCategory, MedicalResultStatus } from '../types';
import { mergeOccHealthV2Data, isOccHealthV2Exam, isOccHealthV2Record } from './healthEnvService';
import { apiDb, getAuthToken } from '../../../services/apiDatabaseClient';
import { formatFileSize } from '../../../utils/fileHelpers';
import { getCurrentShamsiTimestamp } from '../../../utils/jalaliDate';

export { getCurrentShamsiTimestamp };

const STORAGE_KEYS = {
  RECORDS: 'hse_medical_records_v4',
  EXAMS: 'hse_medical_exams_v4',
  ATTACHMENTS: 'hse_medical_attachments_v4',
  STRUCTURED_LABS: 'hse_structured_lab_results_v1',
  IMPORT_AUDITS: 'hse_medical_import_audits_v1'
};

// Helper: Format bytes to KB/MB (delegated to central fileHelpers)
export function formatBytes(bytes: number, _decimals = 1): string {
  return formatFileSize(bytes);
}

export function notifyMedicalDataChange(detail?: any) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_medical_data_updated', { detail }));
      window.dispatchEvent(new CustomEvent('hse_occ_health_data_updated', { detail }));
      window.dispatchEvent(new CustomEvent('app_data_mutated', { detail: { entity: 'medicalExams', ...detail } }));
    }
  } catch (_) {}
}

export class MedicalExamService {
  private records: PeriodicMedicalRecord[] = [];
  private exams: PeriodicMedicalExam[] = [];
  private attachments: MedicalExamAttachment[] = [];
  private structuredLabs: StructuredLabResult[] = [];
  private importAudits: ImportAuditLogRecord[] = [];
  private isReloading = false;
  private reloadDebounceTimer: any = null;
  private lastReloadTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      void this.reloadFromServer();
      window.addEventListener('hse_auth_state_changed', () => {
        void this.reloadFromServer();
      });
      window.addEventListener('hse_medical_data_updated', () => {
        this.debouncedReload();
      });
      window.addEventListener('hse_occ_health_data_updated', () => {
        this.debouncedReload();
      });
    }
  }

  public debouncedReload = (delayMs = 300) => {
    if (this.reloadDebounceTimer) clearTimeout(this.reloadDebounceTimer);
    this.reloadDebounceTimer = setTimeout(() => {
      this.reloadFromServer();
    }, delayMs);
  };

  public reloadFromServer = async () => {
    if (this.isReloading || !getAuthToken()) return;
    const now = Date.now();
    if (now - this.lastReloadTime < 200) return;
    this.isReloading = true;
    this.lastReloadTime = now;
    try {
      const [recs, exms, atts, labs, audits, occV2] = await Promise.all([
        apiDb.getSetting(STORAGE_KEYS.RECORDS),
        apiDb.getSetting(STORAGE_KEYS.EXAMS),
        apiDb.getSetting(STORAGE_KEYS.ATTACHMENTS),
        apiDb.getSetting(STORAGE_KEYS.STRUCTURED_LABS),
        apiDb.getSetting(STORAGE_KEYS.IMPORT_AUDITS),
        apiDb.getSetting('OCC_HEALTH_EXAMS_DATA_V2'),
      ]);
      const baseRecs = Array.isArray(recs) ? recs : [];
      const baseExms = Array.isArray(exms) ? exms : [];
      const merged = mergeOccHealthV2Data(occV2, baseRecs, baseExms);
      this.records = merged.records;
      this.exams = merged.exams;
      if (Array.isArray(atts)) this.attachments = atts;
      if (Array.isArray(labs)) this.structuredLabs = labs;

      // Reconcile import audits: prune stale V2-originated audit entries whose exams no longer exist
      const activeExamIds = new Set(this.exams.map(e => e.id));
      const rawAudits: ImportAuditLogRecord[] = Array.isArray(audits) ? audits : [];
      const cleanedAudits = rawAudits.filter(a => {
        const isV2Audit =
          a.importedBy === 'سامانه طب کار' ||
          String(a.id || '').startsWith('batch_') ||
          String(a.id || '').startsWith('audit-auto-batch_');
        if (!isV2Audit) return true;
        return Array.isArray(a.importedExamIds) && a.importedExamIds.some(id => activeExamIds.has(id));
      });
      this.importAudits = cleanedAudits;
      this.syncImportAuditsFromExams();

      // Auto-heal legacy persisted V2 shadow copies in PostgreSQL so deleted Excel files never resurface
      const hadStaleV2Exams = baseExms.some(e => isOccHealthV2Exam(e));
      const hadStaleV2Records = baseRecs.some(r => isOccHealthV2Record(r));
      const hadStaleV2Audits = cleanedAudits.length !== rawAudits.length;
      if (hadStaleV2Exams || hadStaleV2Records || hadStaleV2Audits) {
        const { persistableRecords, persistableExams, persistableAudits } = this.getPersistablePayload();
        void Promise.all([
          apiDb.saveSetting(STORAGE_KEYS.RECORDS, persistableRecords),
          apiDb.saveSetting(STORAGE_KEYS.EXAMS, persistableExams),
          apiDb.saveSetting(STORAGE_KEYS.IMPORT_AUDITS, persistableAudits),
        ]).catch(() => {});
      }
      // Readers must never dispatch mutation notifications!
    } catch (_) {
    } finally {
      this.isReloading = false;
    }
  };

  public reloadFromStorage = () => {
    void this.reloadFromServer();
  };

  private getPersistablePayload() {
    // OCC_HEALTH_EXAMS_DATA_V2 is the single source of truth for periodic-exam Excel imports.
    // Never clone V2 exams/records into hse_medical_exams_v4 / hse_medical_records_v4.
    const persistableExams = this.exams.filter(e => !isOccHealthV2Exam(e));
    const activeNonV2RecIds = new Set(persistableExams.map(e => e.recordId).filter(Boolean));
    const persistableRecords = this.records.filter(r => !isOccHealthV2Record(r) || activeNonV2RecIds.has(r.id));
    const persistableAudits = this.importAudits.filter(a => {
      const isV2Audit =
        a.importedBy === 'سامانه طب کار' ||
        String(a.id || '').startsWith('batch_') ||
        String(a.id || '').startsWith('audit-auto-batch_');
      return !isV2Audit;
    });
    return { persistableRecords, persistableExams, persistableAudits };
  }

  private saveData() {
    try {
      const { persistableRecords, persistableExams, persistableAudits } = this.getPersistablePayload();
      // Authoritatively persist non-V2 medical records to PostgreSQL central database
      apiDb.saveSetting(STORAGE_KEYS.RECORDS, persistableRecords);
      apiDb.saveSetting(STORAGE_KEYS.EXAMS, persistableExams);
      apiDb.saveSetting(STORAGE_KEYS.ATTACHMENTS, this.attachments);
      apiDb.saveSetting(STORAGE_KEYS.STRUCTURED_LABS, this.structuredLabs);
      apiDb.saveSetting(STORAGE_KEYS.IMPORT_AUDITS, persistableAudits);

      notifyMedicalDataChange();
    } catch (e) {
      console.warn('[MedicalExamService] Database write warning:', e);
    }
  }

  /**
   * Immediately reconcile in-memory state and PostgreSQL shadow records after a periodic-exam
   * Excel batch (or all Excel imports) is deleted in PeriodicMedicalExamsApp.
   */
  public async syncFromOccHealthV2Deletion(batchId: string | null): Promise<void> {
    const removedExamIds = new Set<string>();
    const remainingExams: PeriodicMedicalExam[] = [];

    this.exams.forEach(e => {
      const isTarget =
        batchId === null
          ? isOccHealthV2Exam(e)
          : isOccHealthV2Exam(e) && e.importBatchId === batchId;
      if (isTarget) {
        removedExamIds.add(e.id);
      } else {
        remainingExams.push(e);
      }
    });

    this.exams = remainingExams;
    const remainingRecIds = new Set(this.exams.map(e => e.recordId).filter(Boolean));
    const remainingCodes = new Set(this.exams.map(e => String(e.employeeCode || '').trim().toLowerCase()).filter(Boolean));
    this.records = this.records.filter(r => {
      if (!isOccHealthV2Record(r)) return true;
      const code = String(r.employeeCode || '').trim().toLowerCase();
      return remainingRecIds.has(r.id) || (code !== '' && remainingCodes.has(code));
    });

    if (removedExamIds.size > 0) {
      this.structuredLabs = this.structuredLabs.filter(
        l => !removedExamIds.has(l.examId) && (!batchId || l.importBatchId !== batchId)
      );
      try {
        occupationalHealthStructuredService.deleteSessionsByIds(Array.from(removedExamIds));
      } catch (_) {}
    }

    const activeExamIds = new Set(this.exams.map(e => e.id));
    this.importAudits = this.importAudits.filter(a => {
      if (batchId && (a.id === batchId || a.id === `audit-auto-${batchId}`)) return false;
      const isV2Audit =
        a.importedBy === 'سامانه طب کار' ||
        String(a.id || '').startsWith('batch_') ||
        String(a.id || '').startsWith('audit-auto-batch_');
      if (!isV2Audit) return true;
      if (batchId === null) return false;
      return Array.isArray(a.importedExamIds) && a.importedExamIds.some(id => activeExamIds.has(id));
    });

    const { persistableRecords, persistableExams, persistableAudits } = this.getPersistablePayload();
    try {
      await Promise.all([
        apiDb.saveSetting(STORAGE_KEYS.RECORDS, persistableRecords),
        apiDb.saveSetting(STORAGE_KEYS.EXAMS, persistableExams),
        apiDb.saveSetting(STORAGE_KEYS.STRUCTURED_LABS, this.structuredLabs),
        apiDb.saveSetting(STORAGE_KEYS.IMPORT_AUDITS, persistableAudits),
      ]);
    } catch (_) {}

    notifyMedicalDataChange({ action: 'occ_v2_excel_deleted', batchId });
  }

  /**
   * Search personnel by personnel code / national code / effective code.
   * If personnel exists in master personnel data, looks up or creates their main medical record.
   */
  public searchPersonnelAndGetRecord(personnelCode: string, currentUser?: any): {
    personnel: ComplexPersonnel | null;
    record: PeriodicMedicalRecord | null;
    exams: PeriodicMedicalExam[];
    error?: string;
  } {
    if (!personnelCode || !personnelCode.trim()) {
      return { personnel: null, record: null, exams: [], error: 'لطفاً کد پرسنلی را وارد کنید.' };
    }

    const cleanCode = personnelCode.trim();
    const personnel = findPersonnelByCode(cleanCode);

    if (!personnel) {
      return { 
        personnel: null, 
        record: null, 
        exams: [], 
        error: `پرسنلی با کد یا شناسه «${cleanCode}» در بانک اطلاعات پرسنل سامانه یافت نشد.` 
      };
    }

    // Find existing main record
    let record = this.records.find(r => 
      r.employeeCode === personnel.effectiveCode || 
      r.employeeCode === personnel.personnelCode ||
      r.nationalCode === personnel.nationalCode ||
      r.employeeId === personnel.id
    );

    // If no record exists, create the single master record for this employee
    if (!record) {
      const creator = currentUser?.fullName || currentUser?.username || 'کاربر سیستم (HSE)';
      const nowStr = getCurrentShamsiTimestamp();
      
      record = {
        id: `med-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        employeeId: personnel.id,
        employeeCode: personnel.effectiveCode || personnel.personnelCode || personnel.id,
        nationalCode: personnel.nationalCode,
        firstName: personnel.firstName,
        lastName: personnel.lastName,
        fullName: personnel.fullName,
        department: personnel.unit || 'نامشخص',
        jobTitle: personnel.jobTitle || 'پرسنل سایت',
        birthDate: personnel.birthDate,
        age: personnel.age,
        phone: personnel.phone,
        education: personnel.education,
        maritalStatus: personnel.maritalStatus,
        bloodType: 'ثبت نشده',
        isComplete: true,
        notes: personnel.notes || '',
        createdAt: nowStr,
        updatedAt: nowStr,
        createdBy: creator,
        updatedBy: creator
      };

      this.records.unshift(record);
      this.saveData();

      addAuditLog(
        currentUser?.username || 'admin',
        `ایجاد پرونده اصلی معاینات دوره‌ای برای ${record.fullName} (کد: ${record.employeeCode})`,
        'معاینات دوره‌ای - پرونده اصلی'
      );
    }

    // Get all annual exams for this record
    const exams = this.getExamsForRecord(record.id);

    return {
      personnel,
      record,
      exams
    };
  }

  /**
   * Get all main medical records in system
   */
  public getAllRecords(): PeriodicMedicalRecord[] {
    return [...this.records];
  }

  /**
   * Get all annual exams in system
   */
  public getAllExams(): PeriodicMedicalExam[] {
    return [...this.exams].map(exam => {
      const atts = this.attachments.filter(a => a.examId === exam.id);
      return {
        ...exam,
        attachmentsCount: atts.length
      };
    });
  }

  /**
   * Get all attachments
   */
  public getAllAttachments(): MedicalExamAttachment[] {
    return [...this.attachments];
  }

  /**
   * Get main record by record ID
   */
  public getRecordById(recordId: string): PeriodicMedicalRecord | null {
    return this.records.find(r => r.id === recordId) || null;
  }

  /**
   * Get all annual exams belonging to a record, sorted by year descending
   */
  public getExamsForRecord(recordId: string): PeriodicMedicalExam[] {
    const list = this.exams.filter(e => e.recordId === recordId);
    return list.map(exam => {
      const atts = this.attachments.filter(a => a.examId === exam.id);
      return {
        ...exam,
        attachmentsCount: atts.length
      };
    }).sort((a, b) => b.examYear - a.examYear);
  }

  /**
   * Add a new annual exam record.
   * Enforces strictly: ONE exam per year per employee record.
   */
  public addAnnualExam(
    recordId: string,
    examData: {
      examYear: number;
      examDate: string;
      examType: MedicalExamType;
      medicalCenter: string;
      doctor: string;
      status: MedicalExamStatus;
      findings?: MedicalFindings;
      recommendations?: string;
      description?: string;
    },
    currentUser?: any
  ): { success: boolean; exam?: PeriodicMedicalExam; error?: string } {
    const record = this.getRecordById(recordId);
    if (!record) {
      return { success: false, error: 'پرونده اصلی پرسنل یافت نشد.' };
    }

    if (!examData.examYear) {
      return { success: false, error: 'سال معاینه الزامی است.' };
    }

    if (!examData.examDate) {
      return { success: false, error: 'تاریخ انجام معاینه الزامی است.' };
    }

    // Check for duplicate year in the same record
    const existingYearExam = this.exams.find(
      e => e.recordId === recordId && Number(e.examYear) === Number(examData.examYear)
    );

    if (existingYearExam) {
      return { 
        success: false, 
        error: `سابقه معاینات دوره‌ای برای سال ${examData.examYear} قبلاً برای این پرسنل ثبت گردیده است. شما می‌توانید همان سابقه را ویرایش نمایید.` 
      };
    }

    const creator = currentUser?.fullName || currentUser?.username || 'کارشناس بهداشت و طب کار';
    const nowStr = getCurrentShamsiTimestamp();

    const newExam: PeriodicMedicalExam = {
      id: `exam-${record.employeeCode}-${examData.examYear}-${Date.now()}`,
      recordId: record.id,
      employeeCode: record.employeeCode,
      examYear: Number(examData.examYear),
      examDate: examData.examDate,
      examType: examData.examType || 'دوره‌ای سالانه',
      medicalCenter: examData.medicalCenter || 'مرکز طب کار صنعت نفت',
      doctor: examData.doctor || 'پزشک طب کار',
      status: examData.status || 'fit',
      findings: examData.findings || {},
      recommendations: examData.recommendations || '',
      description: examData.description || '',
      attachmentsCount: 0,
      createdAt: nowStr,
      updatedAt: nowStr,
      createdBy: creator,
      updatedBy: creator
    };

    this.exams.unshift(newExam);
    
    // Update record updatedAt
    record.updatedAt = nowStr;
    record.updatedBy = creator;

    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `ثبت معاینه سالانه سال ${newExam.examYear} برای ${record.fullName} (کد: ${record.employeeCode})`,
      'معاینات دوره‌ای - سابقه سالانه'
    );

    notifyMedicalDataChange({ action: 'add_exam', exam: newExam, year: newExam.examYear });

    return { success: true, exam: newExam };
  }

  /**
   * Update an existing annual exam
   */
  public updateAnnualExam(
    examId: string,
    updates: Partial<PeriodicMedicalExam>,
    currentUser?: any
  ): { success: boolean; exam?: PeriodicMedicalExam; error?: string } {
    const examIndex = this.exams.findIndex(e => e.id === examId);
    if (examIndex === -1) {
      return { success: false, error: 'سابقه معاینه یافت نشد.' };
    }

    const currentExam = this.exams[examIndex];

    // If changing examYear, ensure the target year does not collide with another record
    if (updates.examYear && Number(updates.examYear) !== Number(currentExam.examYear)) {
      const collision = this.exams.find(
        e => e.recordId === currentExam.recordId && 
             e.id !== examId && 
             Number(e.examYear) === Number(updates.examYear)
      );
      if (collision) {
        return { 
          success: false, 
          error: `سابقه سال ${updates.examYear} در پرونده این فرد از قبل موجود است.` 
        };
      }
    }

    const updater = currentUser?.fullName || currentUser?.username || 'کاربر سیستم';
    const nowStr = getCurrentShamsiTimestamp();

    const updatedExam: PeriodicMedicalExam = {
      ...currentExam,
      ...updates,
      examYear: updates.examYear ? Number(updates.examYear) : currentExam.examYear,
      updatedAt: nowStr,
      updatedBy: updater
    };

    this.exams[examIndex] = updatedExam;

    // Update main record updated date
    const record = this.getRecordById(updatedExam.recordId);
    if (record) {
      record.updatedAt = nowStr;
      record.updatedBy = updater;
    }

    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `ویرایش سابقه معاینه سال ${updatedExam.examYear} (شناسه: ${examId})`,
      'معاینات دوره‌ای - ویرایش'
    );

    notifyMedicalDataChange({ action: 'update_exam', exam: updatedExam, year: updatedExam.examYear });

    return { success: true, exam: updatedExam };
  }

  /**
   * Delete an annual exam and all its associated attachments
   */
  public deleteAnnualExam(examId: string, currentUser?: any): { success: boolean; error?: string } {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) {
      return { success: false, error: 'سابقه معاینه جهت حذف یافت نشد.' };
    }

    const deletedYear = exam.examYear;

    // Delete associated attachments
    this.attachments = this.attachments.filter(a => a.examId !== examId);
    
    // Delete exam
    this.exams = this.exams.filter(e => e.id !== examId);

    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `حذف سابقه معاینه سال ${exam.examYear} برای پرسنل با کد ${exam.employeeCode}`,
      'معاینات دوره‌ای - حذف سابقه'
    );

    notifyMedicalDataChange({ action: 'delete_exam', examId, year: deletedYear });

    return { success: true };
  }

  /**
   * Get attachments for an annual exam
   */
  public getAttachmentsForExam(examId: string): MedicalExamAttachment[] {
    return this.attachments.filter(a => a.examId === examId);
  }

  /**
   * Add attachment to an annual exam
   */
  public addAttachment(
    examId: string,
    fileData: {
      originalFileName: string;
      displayName: string;
      description?: string;
      fileType: 'pdf' | 'jpg' | 'jpeg' | 'png' | 'other';
      mimeType: string;
      fileSize: number;
      fileData?: string;
    },
    currentUser?: any
  ): { success: boolean; attachment?: MedicalExamAttachment; error?: string } {
    const exam = this.exams.find(e => e.id === examId);
    if (!exam) {
      return { success: false, error: 'معاینه مرتبط برای پیوست فایل یافت نشد.' };
    }

    if (!fileData.displayName || !fileData.displayName.trim()) {
      return { success: false, error: 'عنوان نمایشی فایل الزامی است.' };
    }

    const allowedTypes = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = (fileData.fileType || fileData.originalFileName.split('.').pop() || '').toLowerCase();
    
    if (!allowedTypes.includes(ext)) {
      return { 
        success: false, 
        error: `فرمت فایل (${ext}) مجاز نمی‌باشد. فرمت‌های مجاز عبارتند از: PDF, JPG, JPEG, PNG` 
      };
    }

    // Max 15 MB limit check
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    if (fileData.fileSize > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `حجم فایل (${formatBytes(fileData.fileSize)}) بیش از سقف مجاز (۱۵ مگابایت) است.`
      };
    }

    const uploader = currentUser?.fullName || currentUser?.username || 'کاربر بارگذار';
    const nowStr = getCurrentShamsiTimestamp();

    const newAttachment: MedicalExamAttachment = {
      id: `att-${examId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      examId: exam.id,
      recordId: exam.recordId,
      examYear: exam.examYear,
      originalFileName: fileData.originalFileName,
      displayName: fileData.displayName.trim(),
      description: (fileData.description || '').trim(),
      fileType: ext as any,
      mimeType: fileData.mimeType || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`),
      fileSize: fileData.fileSize,
      fileSizeFormatted: formatBytes(fileData.fileSize),
      fileData: fileData.fileData,
      uploadedAt: nowStr,
      uploadedBy: uploader
    };

    this.attachments.unshift(newAttachment);
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `بارگذاری فایل پیوست «${newAttachment.displayName}» برای معاینه سال ${exam.examYear}`,
      'معاینات دوره‌ای - پیوست فایل'
    );

    return { success: true, attachment: newAttachment };
  }

  /**
   * Update attachment display name and description
   */
  public updateAttachment(
    attachmentId: string,
    updates: { displayName: string; description: string },
    currentUser?: any
  ): { success: boolean; attachment?: MedicalExamAttachment; error?: string } {
    const index = this.attachments.findIndex(a => a.id === attachmentId);
    if (index === -1) {
      return { success: false, error: 'فایل پیوست یافت نشد.' };
    }

    if (!updates.displayName || !updates.displayName.trim()) {
      return { success: false, error: 'عنوان نمایشی فایل نمی‌تواند خالی باشد.' };
    }

    const current = this.attachments[index];
    const updated: MedicalExamAttachment = {
      ...current,
      displayName: updates.displayName.trim(),
      description: (updates.description || '').trim()
    };

    this.attachments[index] = updated;
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `ویرایش مشخصات فایل «${updated.displayName}» (شناسه: ${attachmentId})`,
      'معاینات دوره‌ای - ویرایش فایل'
    );

    return { success: true, attachment: updated };
  }

  /**
   * Delete an attachment
   */
  public deleteAttachment(attachmentId: string, currentUser?: any): { success: boolean; error?: string } {
    const att = this.attachments.find(a => a.id === attachmentId);
    if (!att) {
      return { success: false, error: 'فایل پیوست جهت حذف یافت نشد.' };
    }

    this.attachments = this.attachments.filter(a => a.id !== attachmentId);
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `حذف فایل پیوست «${att.displayName}» (شناسه: ${attachmentId})`,
      'معاینات دوره‌ای - حذف فایل'
    );

    return { success: true };
  }

  /**
   * Get all attachments for a specific employee across all their exam years or filtered by year
   */
  public getAttachmentsForEmployee(personnelCode: string, examYear?: number): MedicalExamAttachment[] {
    if (!personnelCode) return [];
    const normalizedCode = personnelCode.trim();

    // Find record IDs or exam IDs belonging to this employee
    const matchingRecords = this.records.filter(r => 
      r.employeeCode === normalizedCode || 
      (r as any).personnelCode === normalizedCode || 
      (r as any).nationalCode === normalizedCode
    );
    const recordIds = new Set(matchingRecords.map(r => r.id));

    const matchingExams = this.exams.filter(e => 
      e.employeeCode === normalizedCode || 
      recordIds.has(e.recordId) ||
      (e as any).personnelCode === normalizedCode
    );
    const examIds = new Set(matchingExams.map(e => e.id));

    return this.attachments.filter(att => {
      const matchExam = examIds.has(att.examId);
      const matchRecord = recordIds.has(att.recordId);
      const matchDirect = (att as any).personnelCode === normalizedCode || (att as any).employeeCode === normalizedCode;
      
      if (!matchExam && !matchRecord && !matchDirect) return false;
      if (examYear !== undefined && examYear !== null && Number(att.examYear) !== Number(examYear)) return false;
      return true;
    }).sort((a, b) => (Number(b.examYear) || 0) - (Number(a.examYear) || 0));
  }

  /**
   * Add an attachment directly for an employee for a specific year
   */
  public addAttachmentForEmployee(
    personnelCode: string,
    examYear: number,
    fileData: {
      originalFileName: string;
      displayName: string;
      description?: string;
      fileType?: 'pdf' | 'jpg' | 'jpeg' | 'png' | 'other';
      mimeType?: string;
      fileSize: number;
      fileData?: string;
    },
    currentUser?: any
  ): { success: boolean; attachment?: MedicalExamAttachment; error?: string } {
    if (!personnelCode) return { success: false, error: 'کد پرسنلی مشخص نشده است.' };
    if (!examYear) return { success: false, error: 'سال معاینه الزامی است.' };

    const personnelLookup = this.searchPersonnelAndGetRecord(personnelCode, currentUser);
    const record = personnelLookup.record;
    if (!record) {
      return { success: false, error: 'پرونده پرسنل یافت نشد.' };
    }

    // Find or ensure annual exam for that year
    let exam = this.exams.find(e => e.recordId === record.id && Number(e.examYear) === Number(examYear));
    if (!exam) {
      // Auto-create annual exam placeholder
      const addRes = this.addAnnualExam(record.id, {
        examYear: Number(examYear),
        examDate: `${examYear}/02/15`,
        examType: 'دوره‌ای سالانه',
        medicalCenter: 'مرکز طب کار صنعت نفت',
        doctor: 'پزشک طب کار',
        status: 'fit',
        description: 'ایجاد شده خودکار برای پیوست مدارک و نتایج'
      }, currentUser);
      if (addRes.success && addRes.exam) {
        exam = addRes.exam;
      } else {
        exam = this.exams.find(e => e.recordId === record.id);
      }
    }

    if (!exam) {
      return { success: false, error: 'امکان انتساب فایل به معاینه سال مورد نظر فراهم نشد.' };
    }

    return this.addAttachment(exam.id, {
      originalFileName: fileData.originalFileName,
      displayName: fileData.displayName,
      description: fileData.description,
      fileType: (fileData.fileType || (fileData.originalFileName.split('.').pop() || 'pdf').toLowerCase()) as any,
      mimeType: fileData.mimeType || 'application/pdf',
      fileSize: fileData.fileSize,
      fileData: fileData.fileData
    }, currentUser);
  }

  /**
   * Get all unique examination years dynamically from registered records.
   * Sorts numerically in ASCENDING order (e.g. 1402 -> 1403 -> 1404 -> 1405 -> 1406...)
   */
  public getAvailableExamYears(): number[] {
    const yearsSet = new Set<number>();
    this.exams.forEach(e => {
      const y = Number(e.examYear);
      if (y && y >= 1300 && y <= 1500 && y !== 1402) {
        yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).filter(y => y !== 1402).sort((a, b) => a - b);
  }

  /**
   * Get the latest recorded exam year (e.g. highest year that actually has records)
   */
  public getLatestExamYear(): number | null {
    const years = this.getAvailableExamYears();
    return years.length > 0 ? years[years.length - 1] : null;
  }

  /**
   * Get dynamic exam years summary with count and unique personnel count for each recorded year
   */
  public getExamYearsSummary(): { year: number; count: number; personnelCount: number }[] {
    const years = this.getAvailableExamYears();
    return years.map(year => {
      const yearExams = this.exams.filter(e => Number(e.examYear) === year);
      const uniquePersonnel = new Set(yearExams.map(e => e.employeeCode || e.recordId).filter(Boolean));
      return {
        year,
        count: yearExams.length,
        personnelCount: uniquePersonnel.size || yearExams.length
      };
    });
  }

  /**
   * Calculate overall health & periodic exam statistics
   */
  public getStatistics(currentYear?: number) {
    const availableYears = this.getAvailableExamYears();
    const activeYear = currentYear || this.getLatestExamYear() || 1405;
    const allPersonnel = getComplexPersonnelList();
    const totalPersonnel = allPersonnel.length;
    const totalRecords = this.records.length;
    const totalExams = this.exams.length;
    const totalAttachments = this.attachments.length;

    // Exams completed this year
    const thisYearExams = this.exams.filter(e => Number(e.examYear) === activeYear);
    const completedThisYearCount = thisYearExams.length;
    const pendingThisYearCount = Math.max(0, totalPersonnel - completedThisYearCount);
    const completionPercentage = totalPersonnel > 0 
      ? Math.round((completedThisYearCount / totalPersonnel) * 100) 
      : 0;

    // Fitness breakdown for current year
    const fitCount = thisYearExams.filter(e => e.status === 'fit').length;
    const fitWithLimitationsCount = thisYearExams.filter(e => e.status === 'fit_with_limitations').length;
    const needsSpecialistCount = thisYearExams.filter(e => e.status === 'needs_specialist').length;
    const unfitCount = thisYearExams.filter(e => e.status === 'unfit').length;
    const underReviewCount = thisYearExams.filter(e => e.status === 'under_review').length;

    // Out of reference and critical count across structured labs for current year
    const activeLabs = this.structuredLabs.filter(l => Number(l.examYear) === activeYear);
    const outOfRangeCount = activeLabs.filter(l => l.resultStatus === 'High' || l.resultStatus === 'Low' || l.resultStatus === 'Abnormal').length;
    const criticalCount = activeLabs.filter(l => l.resultStatus === 'Critical').length;

    return {
      currentYear: activeYear,
      availableYears,
      totalPersonnel,
      totalRecords,
      totalExams,
      totalAttachments,
      completedThisYearCount,
      pendingThisYearCount,
      completionPercentage,
      outOfRangeCount,
      criticalCount,
      fitnessBreakdown: {
        fit: fitCount,
        fitWithLimitations: fitWithLimitationsCount,
        needsSpecialist: needsSpecialistCount,
        unfit: unfitCount,
        underReview: underReviewCount
      }
    };
  }

  // -------------------------------------------------------------
  // STRUCTURED LAB RESULTS & MULTI-YEAR TREND METHODS
  // -------------------------------------------------------------

  public getAllStructuredLabs(): StructuredLabResult[] {
    return [...this.structuredLabs];
  }

  public getStructuredLabsForEmployee(employeeCode: string, examYear?: number): StructuredLabResult[] {
    if (!employeeCode) return [];
    const clean = employeeCode.trim();
    return this.structuredLabs.filter(l => {
      const matchEmp = l.employeeCode === clean;
      const matchYear = examYear ? Number(l.examYear) === Number(examYear) : true;
      return matchEmp && matchYear;
    });
  }

  public getMultiYearTrends(employeeCode: string): Record<string, { year: number; val: number | string; status: string }[]> {
    const labs = this.getStructuredLabsForEmployee(employeeCode);
    const trends: Record<string, { year: number; val: number | string; status: string }[]> = {};

    labs.forEach(lab => {
      if (!trends[lab.testName]) {
        trends[lab.testName] = [];
      }
      trends[lab.testName].push({
        year: lab.examYear,
        val: lab.numericValue !== undefined ? lab.numericValue : lab.textValue || '-',
        status: lab.resultStatus
      });
    });

    // Sort each test trend array by year ascending
    Object.keys(trends).forEach(t => {
      trends[t].sort((a, b) => a.year - b.year);
    });

    return trends;
  }

  public getYoYComparison(employeeCode: string, currentYear: number, previousYear: number) {
    const currentLabs = this.getStructuredLabsForEmployee(employeeCode, currentYear);
    const prevLabs = this.getStructuredLabsForEmployee(employeeCode, previousYear);

    const comparisonList: {
      testName: string;
      unit: string;
      prevVal: number | string | null;
      prevStatus: string | null;
      currVal: number | string | null;
      currStatus: string | null;
      deltaNum: number | null;
      statusChanged: boolean;
    }[] = [];

    const allTestNames = Array.from(new Set([
      ...currentLabs.map(l => l.testName),
      ...prevLabs.map(l => l.testName)
    ]));

    allTestNames.forEach(testName => {
      const curr = currentLabs.find(l => l.testName === testName);
      const prev = prevLabs.find(l => l.testName === testName);

      const currVal = curr ? (curr.numericValue !== undefined ? curr.numericValue : curr.textValue || '-') : null;
      const prevVal = prev ? (prev.numericValue !== undefined ? prev.numericValue : prev.textValue || '-') : null;

      let deltaNum: number | null = null;
      if (curr && prev && curr.numericValue !== undefined && prev.numericValue !== undefined) {
        deltaNum = parseFloat((curr.numericValue - prev.numericValue).toFixed(2));
      }

      const statusChanged = Boolean(curr && prev && curr.resultStatus !== prev.resultStatus);

      comparisonList.push({
        testName,
        unit: curr?.unit || prev?.unit || '',
        prevVal,
        prevStatus: prev?.resultStatus || null,
        currVal,
        currStatus: curr?.resultStatus || null,
        deltaNum,
        statusChanged
      });
    });

    return comparisonList;
  }

  public checkDuplicateExam(
    employeeCode: string,
    examYear: number,
    examDate: string,
    examType: string
  ): PeriodicMedicalExam | null {
    if (!employeeCode || !examYear) return null;
    const cleanCode = employeeCode.trim();

    return this.exams.find(e => {
      const sameCode = e.employeeCode === cleanCode;
      const sameYear = Number(e.examYear) === Number(examYear);
      const sameType = !examType || e.examType === examType;
      return sameCode && sameYear && sameType;
    }) || null;
  }

  /**
   * Ensure that every batch of exams or attachments has an entry in importAudits.
   * If importAudits is empty or lacks entries for existing exams, reconstruct them.
   */
  public syncImportAuditsFromExams(): void {
    if (!this.exams || this.exams.length === 0) {
      return;
    }

    const existingLogIds = new Set(this.importAudits.map(a => a.id));
    const existingFileNames = new Set(this.importAudits.map(a => `${a.fileName}_${a.examYear}`));

    // Group exams by importBatchId, or by (importFileName + examYear), or by examYear
    const groups = new Map<string, PeriodicMedicalExam[]>();

    this.exams.forEach(exam => {
      const examYear = Number(exam.examYear) || 1404;
      if (examYear === 1402) return; // Ignore legacy 1402

      let groupKey = '';
      if (exam.importBatchId) {
        groupKey = exam.importBatchId;
      } else if (exam.importFileName) {
        groupKey = `${exam.importFileName}_${examYear}`;
      } else {
        groupKey = `batch_${exam.importSource || 'Excel'}_${examYear}`;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(exam);
    });

    let modifiedNonV2 = false;

    groups.forEach((groupExams, groupKey) => {
      if (existingLogIds.has(groupKey)) return;

      const firstExam = groupExams[0];
      const examYear = Number(firstExam.examYear) || 1404;
      const fileNameKey = `${firstExam.importFileName || `معاینات_طب_کار_${examYear}.xlsx`}_${examYear}`;

      if (existingFileNames.has(fileNameKey)) return;

      const recordIds = Array.from(new Set(groupExams.map(e => e.recordId).filter(Boolean)));
      
      const newAuditLog: ImportAuditLogRecord = {
        id: groupKey.startsWith('audit-') || groupKey.startsWith('batch-') ? groupKey : `audit-auto-${groupKey}`,
        timestamp: firstExam.createdAt || getCurrentShamsiTimestamp(),
        importedBy: firstExam.createdBy || 'مدیر اصلی سامانه',
        userRole: 'مدیر سامانه',
        fileName: firstExam.importFileName || (firstExam.importSource === 'PDF' ? `کارنامه_تخصصی_طب_کار_${examYear}.pdf` : `فایل_جامع_معاینات_طب_کار_${examYear}.xlsx`),
        examYear: examYear,
        sourceType: (firstExam.importSource as any) || 'Excel',
        totalRecords: groupExams.length,
        successfulCount: groupExams.length,
        failedCount: 0,
        matchedPersonnelCount: groupExams.length,
        unmatchedPersonnelCount: 0,
        duplicateCount: 0,
        invalidResultCount: 0,
        manualReviewNeededCount: 0,
        createdRecordsSummary: groupExams.slice(0, 10).map(e => `${e.employeeCode} (سال ${examYear})`),
        updatedRecordsSummary: [],
        importedExamIds: groupExams.map(e => e.id),
        affectedRecordIds: recordIds,
        errorDetails: []
      };

      this.importAudits.push(newAuditLog);
      existingLogIds.add(newAuditLog.id);
      existingFileNames.add(fileNameKey);
      if (!groupExams.every(e => isOccHealthV2Exam(e))) {
        modifiedNonV2 = true;
      }
    });

    if (modifiedNonV2) {
      this.saveData();
    }
  }

  // -------------------------------------------------------------
  // BATCH IMPORT COMMIT & AUDIT LOG METHODS
  // -------------------------------------------------------------

  public getImportAuditLogs(): ImportAuditLogRecord[] {
    this.syncImportAuditsFromExams();
    return [...this.importAudits].sort((a, b) => {
      if (b.examYear !== a.examYear) {
        return (Number(b.examYear) || 0) - (Number(a.examYear) || 0);
      }
      return b.id.localeCompare(a.id);
    });
  }

  public addImportAuditLog(log: ImportAuditLogRecord): void {
    this.importAudits.unshift(log);
    this.saveData();
  }

  public commitExcelImportBatch(
    rows: ExcelImportRowPreview[],
    selectedExamYear: number,
    currentUser: any,
    fileName: string,
    sourceType: 'Excel' | 'HTM' = 'Excel'
  ): { success: boolean; createdCount: number; updatedCount: number; errorCount: number; auditLog: ImportAuditLogRecord } {
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    let matchedPersonnelCount = 0;
    let unmatchedPersonnelCount = 0;
    let duplicateCount = 0;
    let invalidResultCount = 0;
    let manualReviewNeededCount = 0;

    const errorDetails: { rowNumber?: number; personnelCode?: string; errorText: string }[] = [];
    const createdSummary: string[] = [];
    const updatedSummary: string[] = [];
    const importedExamIds: string[] = [];
    const affectedRecordIds: string[] = [];

    const batchAuditId = `audit-excel-${Date.now()}`;
    const creatorName = currentUser?.fullName || currentUser?.username || 'مدیر اصلی سامانه';
    const creatorRole = currentUser?.role || 'Administrator';
    const nowTimestamp = getCurrentShamsiTimestamp();

    rows.forEach((row, idx) => {
      try {
        if (row.hasErrors) {
          errorCount++;
          errorDetails.push({
            rowNumber: row.rowId || idx + 1,
            personnelCode: row.rawPersonnelCode,
            errorText: row.errors.join(' | ')
          });
          return;
        }

        if (row.matchMethod === 'unmatched') {
          unmatchedPersonnelCount++;
        } else {
          matchedPersonnelCount++;
        }

        if (row.matchMethod === 'fuzzy') {
          manualReviewNeededCount++;
        }

        const effectiveCode = (row.matchedPersonnelCode || row.rawPersonnelCode || `EMP-${Date.now().toString(36)}-${idx + 1}`).trim();
        const effectiveName = (row.matchedFullName || row.rawFullName || `پرسنل کد ${effectiveCode}`).trim();

        // Get or Create Master Medical Record
        let recRes = this.searchPersonnelAndGetRecord(effectiveCode, currentUser);
        let recordId = recRes.record?.id;

        if (!recordId) {
          const newRecId = `med-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const newRecord: PeriodicMedicalRecord = {
            id: newRecId,
            employeeId: row.matchedPersonnelId || `emp-${Date.now()}-${idx + 1}`,
            employeeCode: effectiveCode,
            nationalCode: row.rawPersonnelCode || '',
            firstName: effectiveName.split(' ')[0] || '',
            lastName: effectiveName.split(' ').slice(1).join(' ') || '',
            fullName: effectiveName,
            department: row.department || 'نامشخص',
            jobTitle: row.jobTitle || 'پرسنل',
            birthDate: '',
            age: 30,
            phone: '',
            isComplete: true,
            createdAt: nowTimestamp,
            updatedAt: nowTimestamp,
            createdBy: creatorName,
            updatedBy: creatorName
          };
          this.records.unshift(newRecord);
          recordId = newRecId;
        }

        if (recordId && !affectedRecordIds.includes(recordId)) {
          affectedRecordIds.push(recordId);
        }

        // Check duplicate
        const existingExam = this.checkDuplicateExam(effectiveCode, selectedExamYear, row.examDate, row.examType);
        
        let examId = '';
        if (existingExam) {
          duplicateCount++;
          if (row.duplicateAction === 'skip') {
            return;
          } else if (row.duplicateAction === 'overwrite') {
            // Overwrite existing exam
            existingExam.examDate = row.examDate || existingExam.examDate;
            existingExam.examType = row.examType || existingExam.examType;
            existingExam.medicalCenter = row.medicalCenter || existingExam.medicalCenter;
            existingExam.doctor = row.doctor || existingExam.doctor;
            existingExam.status = row.finalStatus || existingExam.status;
            existingExam.importBatchId = batchAuditId;
            existingExam.importFileName = fileName;
            existingExam.importSource = sourceType;
            existingExam.updatedAt = nowTimestamp;
            existingExam.updatedBy = creatorName;
            examId = existingExam.id;
            importedExamIds.push(examId);
            updatedCount++;
            updatedSummary.push(`${effectiveName} (سال ${selectedExamYear})`);
          } else {
            // Create new
            const newExamId = `exam-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            const newExam: PeriodicMedicalExam = {
              id: newExamId,
              recordId,
              employeeCode: effectiveCode,
              examYear: selectedExamYear,
              examDate: row.examDate || `${selectedExamYear}/02/15`,
              examType: row.examType || 'دوره‌ای سالانه',
              medicalCenter: row.medicalCenter || 'مرکز معاینات طب کار',
              doctor: row.doctor || 'پزشک طب کار',
              status: row.finalStatus || 'fit',
              findings: {},
              recommendations: '',
              description: `وارد شده از فایل ${sourceType}: ${fileName}`,
              importBatchId: batchAuditId,
              importFileName: fileName,
              importSource: sourceType,
              createdAt: nowTimestamp,
              updatedAt: nowTimestamp,
              createdBy: creatorName,
              updatedBy: creatorName
            };
            this.exams.unshift(newExam);
            examId = newExamId;
            importedExamIds.push(newExamId);
            createdCount++;
            createdSummary.push(`${effectiveName} (سال ${selectedExamYear})`);
          }
        } else {
          // Create new exam
          const newExamId = `exam-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          const newExam: PeriodicMedicalExam = {
            id: newExamId,
            recordId,
            employeeCode: effectiveCode,
            examYear: selectedExamYear,
            examDate: row.examDate || `${selectedExamYear}/02/15`,
            examType: row.examType || 'دوره‌ای سالانه',
            medicalCenter: row.medicalCenter || 'مرکز معاینات طب کار',
            doctor: row.doctor || 'پزشک طب کار',
            status: row.finalStatus || 'fit',
            findings: {},
            recommendations: '',
            description: `وارد شده از فایل ${sourceType}: ${fileName}`,
            importBatchId: batchAuditId,
            importFileName: fileName,
            importSource: sourceType,
            createdAt: nowTimestamp,
            updatedAt: nowTimestamp,
            createdBy: creatorName,
            updatedBy: creatorName
          };
          this.exams.unshift(newExam);
          examId = newExamId;
          importedExamIds.push(newExamId);
          createdCount++;
          createdSummary.push(`${effectiveName} (سال ${selectedExamYear})`);
        }

        // Add structured lab results for this row
        const structuredTestRecords: any[] = [];
        if (examId && row.labResults && row.labResults.length > 0) {
          // Remove existing labs for this examId if overwriting
          this.structuredLabs = this.structuredLabs.filter(l => l.examId !== examId);

          row.labResults.forEach((lab, lIdx) => {
            if (lab.status === 'High' || lab.status === 'Low' || lab.status === 'Critical') {
              invalidResultCount++;
            }
            this.structuredLabs.push({
              id: `lab-${Date.now()}-${Math.floor(Math.random() * 10000)}-${lIdx}`,
              examId,
              recordId,
              employeeCode: effectiveCode,
              employeeName: effectiveName,
              testName: lab.testName,
              testCode: lab.testCode || `LAB-${lab.testName.toUpperCase()}`,
              numericValue: lab.numericValue,
              textValue: lab.textValue,
              unit: lab.unit,
              minReference: lab.minRef || 0,
              maxReference: lab.maxRef || 100,
              refSource: 'Standard Lab / WHO',
              examYear: selectedExamYear,
              examDate: row.examDate || `${selectedExamYear}/02/15`,
              resultStatus: lab.status || 'Normal',
              importBatchId: batchAuditId,
              createdAt: nowTimestamp,
              createdBy: creatorName
            });

            // Map to 15-category itemCode and category
            const normName = normalizePersianString(lab.testName);
            let itemCode = `TEST_${lIdx + 1}`;
            let category: MedicalItemCategory = 'blood_tests';

            if (normName.includes('fbs') || normName.includes('قند') || normName.includes('گلوکز')) {
              itemCode = 'FBS';
              category = 'blood_tests';
            } else if (normName.includes('chol') || normName.includes('کلسترول')) {
              itemCode = 'CHOLESTEROL';
              category = 'blood_tests';
            } else if (normName.includes('tg') || normName.includes('تری گلیسرید') || normName.includes('تری‌گلیسرید')) {
              itemCode = 'TRIGLYCERIDE';
              category = 'blood_tests';
            } else if (normName.includes('hdl')) {
              itemCode = 'HDL';
              category = 'blood_tests';
            } else if (normName.includes('ldl')) {
              itemCode = 'LDL';
              category = 'blood_tests';
            } else if (normName.includes('hb') || normName.includes('hgb') || normName.includes('هموگلوبین')) {
              itemCode = 'HB';
              category = 'blood_tests';
            } else if (normName.includes('wbc') || normName.includes('گلبول سفید')) {
              itemCode = 'WBC';
              category = 'blood_tests';
            } else if (normName.includes('plt') || normName.includes('پلاکت')) {
              itemCode = 'PLT';
              category = 'blood_tests';
            } else if (normName.includes('alt') || normName.includes('sgpt')) {
              itemCode = 'ALT';
              category = 'blood_tests';
            } else if (normName.includes('ast') || normName.includes('sgot')) {
              itemCode = 'AST';
              category = 'blood_tests';
            } else if (normName.includes('bun') || normName.includes('اوره')) {
              itemCode = 'BUN';
              category = 'blood_tests';
            } else if (normName.includes('cr') || normName.includes('کراتینین')) {
              itemCode = 'CREATININE';
              category = 'blood_tests';
            } else if (normName.includes('سرب') || normName.includes('lead') || normName.includes('bll')) {
              itemCode = 'LEAD_BLOOD';
              category = 'occupational_exposure_tests';
            } else if (normName.includes('ادیومتری') || normName.includes('شنوایی') || normName.includes('audio')) {
              itemCode = 'AUDIO_R_4000';
              category = 'audiometry';
            } else if (normName.includes('اسپیرومتری') || normName.includes('ریه') || normName.includes('spiro')) {
              itemCode = 'FEV1_FVC';
              category = 'spirometry';
            } else if (normName.includes('بینایی') || normName.includes('اپتومتری') || normName.includes('vision')) {
              itemCode = 'VISION_R_FAR';
              category = 'optometry';
            } else if (normName.includes('فشار') || normName.includes('bp')) {
              itemCode = 'BP_SYS';
              category = 'vitals_body';
            } else if (normName.includes('bmi') || normName.includes('توده بدنی')) {
              itemCode = 'BMI';
              category = 'vitals_body';
            } else {
              itemCode = `EXCEL_ITEM_${lIdx + 1}`;
              category = 'blood_tests';
            }

            let status: MedicalResultStatus = 'Normal';
            if (lab.status === 'Critical') status = 'Critical';
            else if (lab.status === 'High') status = 'High';
            else if (lab.status === 'Low') status = 'Low';
            else if (lab.status === 'Abnormal') status = 'Abnormal';

            structuredTestRecords.push({
              itemId: `excel_${lIdx + 1}`,
              itemCode,
              itemName: lab.testName,
              category,
              dataType: lab.numericValue !== undefined ? 'numeric' : 'text',
              valueDisplay: lab.numericValue !== undefined ? `${lab.numericValue} ${lab.unit || ''}`.trim() : (lab.textValue || '-'),
              valueNumeric: lab.numericValue,
              valueText: lab.textValue,
              unit: lab.unit,
              refLow: lab.minRef,
              refHigh: lab.maxRef,
              status,
              refSource: 'Standard Lab / WHO',
              doctorNotes: '',
              createdBy: creatorName
            });
          });
        }

        // Save complete structured session to occupationalHealthStructuredService
        try {
          const fitnessDecision = (
            row.finalStatus === 'fit' ? 'مناسب برای شغل' :
            row.finalStatus === 'fit_with_limitations' ? 'مناسب مشروط' :
            row.finalStatus === 'unfit' ? 'نامناسب برای شغل' : 'نیازمند بررسی بیشتر'
          );

          occupationalHealthStructuredService.saveCompleteExamSession(
            {
              id: examId,
              recordId,
              personnelCode: effectiveCode,
              personnelName: effectiveName,
              nationalCode: row.rawPersonnelCode || '',
              gender: 'مرد',
              age: 35,
              department: row.department || 'نامشخص',
              jobTitle: row.jobTitle || 'پرسنل',
              examYear: selectedExamYear,
              examDate: row.examDate || `${selectedExamYear}/02/15`,
              examType: 'دوره‌ای',
              doctor: row.doctor || 'پزشک طب کار',
              medicalCenter: row.medicalCenter || 'مرکز معاینات طب کار',
              fitnessDecision: fitnessDecision as any,
              finalDoctorComment: `وارد شده از طریق فایل Excel: ${fileName}`,
              createdBy: creatorName
            },
            structuredTestRecords,
            currentUser
          );
        } catch (syncErr) {
          console.warn('[MedicalExamService] Structured sync notice:', syncErr);
        }
      } catch (err: any) {
        errorCount++;
        errorDetails.push({
          rowNumber: row.rowId || idx + 1,
          personnelCode: row.rawPersonnelCode,
          errorText: err?.message || 'خطا در ثبت اطلاعات رکورد'
        });
      }
    });

    this.saveData();

    // Create Audit Log
    const auditLog: ImportAuditLogRecord = {
      id: batchAuditId,
      timestamp: nowTimestamp,
      importedBy: creatorName,
      userRole: creatorRole,
      fileName,
      examYear: selectedExamYear,
      sourceType: sourceType,
      totalRecords: rows.length,
      successfulCount: createdCount + updatedCount,
      failedCount: errorCount,
      matchedPersonnelCount,
      unmatchedPersonnelCount,
      duplicateCount,
      invalidResultCount,
      manualReviewNeededCount,
      createdRecordsSummary: createdSummary.slice(0, 10),
      updatedRecordsSummary: updatedSummary.slice(0, 10),
      importedExamIds,
      affectedRecordIds,
      errorDetails
    };

    this.addImportAuditLog(auditLog);

    addAuditLog(
      currentUser?.username || 'admin',
      `Import کامل ${sourceType} طب کار - سال ${selectedExamYear} - تعداد کل: ${rows.length} (موفق: ${createdCount + updatedCount}، خطا: ${errorCount})`,
      `ورود اطلاعات طب کار از ${sourceType}`
    );

    notifyMedicalDataChange({ action: 'excel_import_complete', auditLog });

    return {
      success: errorCount < rows.length,
      createdCount,
      updatedCount,
      errorCount,
      auditLog
    };
  }

  /**
   * Delete an imported batch (Excel, HTM or PDF) and its associated exams and lab results
   */
  public deleteImportBatch(
    auditLogId: string,
    currentUser?: any
  ): { 
    success: boolean; 
    deletedExamsCount: number; 
    deletedLabsCount: number; 
    deletedAttachmentsCount: number; 
    error?: string;
    message: string;
  } {
    const log = this.importAudits.find(a => a.id === auditLogId);
    if (!log) {
      return {
        success: false,
        deletedExamsCount: 0,
        deletedLabsCount: 0,
        deletedAttachmentsCount: 0,
        error: 'شناسه سابقه فایل وارد شده در سیستم یافت نشد.',
        message: 'فایل یافت نشد'
      };
    }

    const adminName = currentUser?.fullName || currentUser?.username || 'مدیر اصلی سامانه';

    const affectedCodes = new Set<string>();
    const affectedRecordIds = new Set<string>();

    if (log.affectedRecordIds && Array.isArray(log.affectedRecordIds)) {
      log.affectedRecordIds.forEach(id => affectedRecordIds.add(id));
    }

    // 1. Identify all exams associated with this batch
    const associatedExamIds = new Set<string>();
    if (log.importedExamIds && log.importedExamIds.length > 0) {
      log.importedExamIds.forEach(id => associatedExamIds.add(id));
    }
    this.exams.forEach(e => {
      if (
        e.importBatchId === auditLogId || 
        associatedExamIds.has(e.id) ||
        (e.importFileName === log.fileName && Number(e.examYear) === Number(log.examYear))
      ) {
        associatedExamIds.add(e.id);
        if (e.employeeCode) affectedCodes.add(e.employeeCode);
        if (e.recordId) affectedRecordIds.add(e.recordId);
      }
    });

    // Also collect personnel codes from structured labs tied to this batch
    this.structuredLabs.forEach(l => {
      if (l.importBatchId === auditLogId || associatedExamIds.has(l.examId)) {
        if (l.employeeCode) affectedCodes.add(l.employeeCode);
        if (l.recordId) affectedRecordIds.add(l.recordId);
      }
    });

    const examsToDeleteCount = associatedExamIds.size;

    // 2. Delete all structured labs tied to this batch or associated exams
    const initialLabsCount = this.structuredLabs.length;
    this.structuredLabs = this.structuredLabs.filter(l => 
      l.importBatchId !== auditLogId && 
      !associatedExamIds.has(l.examId) &&
      !(affectedCodes.has(l.employeeCode) && Number(l.examYear) === Number(log.examYear) && (l.importBatchId === auditLogId || !l.importBatchId))
    );
    const deletedLabsCount = initialLabsCount - this.structuredLabs.length;

    // 3. Delete all attachments tied to these exams
    const initialAttsCount = this.attachments.length;
    this.attachments = this.attachments.filter(a => !associatedExamIds.has(a.examId));
    const deletedAttachmentsCount = initialAttsCount - this.attachments.length;

    // 4. Remove all associated exams
    this.exams = this.exams.filter(e => !associatedExamIds.has(e.id));

    // 5. Clean up master records if they have 0 remaining exams in the system
    this.records = this.records.filter(r => {
      const isAffected = affectedRecordIds.has(r.id) || affectedCodes.has(r.employeeCode);
      if (!isAffected) return true;

      const remainingExams = this.exams.filter(e => e.recordId === r.id || e.employeeCode === r.employeeCode);
      // If no exams remain from other years, completely clear this personnel medical record
      if (remainingExams.length === 0) {
        return false;
      }
      return true;
    });

    // 6. Delete from structured sessions & results
    try {
      occupationalHealthStructuredService.deleteSessionsByIds(Array.from(associatedExamIds));
    } catch (_) {}

    // 7. Remove from import audits
    this.importAudits = this.importAudits.filter(a => a.id !== auditLogId);

    // 8. Sync OCC_HEALTH_EXAMS_DATA_V2 in database (supports object schema { examinations, personnelMap, importedBatches })
    try {
      apiDb.getSetting('OCC_HEALTH_EXAMS_DATA_V2').then(v2 => {
        if (v2 && typeof v2 === 'object' && !Array.isArray(v2) && Array.isArray(v2.examinations)) {
          const remainingEx = v2.examinations.filter((x: any) =>
            !associatedExamIds.has(String(x.exam_id)) &&
            String(x.batch_id || '') !== auditLogId &&
            !affectedCodes.has(String(x.pcode || x.nid || x.personnel_id || ''))
          );
          const remainingPMap: Record<string, any> = {};
          const oldPMap = v2.personnelMap && typeof v2.personnelMap === 'object' ? v2.personnelMap : {};
          remainingEx.forEach((x: any) => {
            if (x.personnel_id && oldPMap[x.personnel_id]) {
              remainingPMap[x.personnel_id] = oldPMap[x.personnel_id];
            }
          });
          const remainingBatches = Array.isArray(v2.importedBatches)
            ? v2.importedBatches.filter((b: any) => b.id !== auditLogId && b.fileName !== log.fileName)
            : [];
          void apiDb.saveSetting('OCC_HEALTH_EXAMS_DATA_V2', {
            examinations: remainingEx,
            personnelMap: remainingPMap,
            importedBatches: remainingBatches
          });
        } else if (Array.isArray(v2)) {
          const filteredV2 = v2.filter((x: any) => !associatedExamIds.has(String(x.exam_id)) && !affectedCodes.has(String(x.personnel_code || x.personnel_id)));
          void apiDb.saveSetting('OCC_HEALTH_EXAMS_DATA_V2', filteredV2);
        }
      }).catch(() => {});
    } catch (_) {}

    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `حذف کامل فایل اکسل «${log.fileName}» (سال ${log.examYear}) - پاکسازی ${examsToDeleteCount} پرونده معاینه، اطلاعات پرسنل و ${deletedLabsCount} نتیجه آزمایشگاهی توسط ${adminName}`,
      'مدیریت طب کار - حذف فایل اکسل وارد شده'
    );

    notifyMedicalDataChange({ 
      action: 'excel_import_deleted', 
      auditLogId, 
      fileName: log.fileName,
      deletedExamsCount: examsToDeleteCount,
      deletedLabsCount,
      deletedAttachmentsCount,
      affectedCodes: Array.from(affectedCodes)
    });

    return {
      success: true,
      deletedExamsCount: examsToDeleteCount,
      deletedLabsCount,
      deletedAttachmentsCount,
      message: `فایل اکسل «${log.fileName}» با موفقیت حذف گردید و کلیه اطلاعات، ${examsToDeleteCount} رکورد معاینات پرسنل و ${deletedLabsCount} نتیجه آزمایشگاهی مرتبط با آن از سامانه پاکسازی شدند.`
    };
  }

  /**
   * Delete and purge all medical examination records, structured lab results, 
   * attachments, and audit entries for a specific examination year.
   */
  public deleteExamsByYear(year: number, currentUser?: any): {
    success: boolean;
    deletedExamsCount: number;
    deletedLabsCount: number;
    deletedAttachmentsCount: number;
    message: string;
  } {
    const targetYear = Number(year);
    const adminName = currentUser?.fullName || currentUser?.username || 'مدیر اصلی سامانه';

    const examsToDelete = this.exams.filter(e => Number(e.examYear) === targetYear);
    const examIdsToDelete = new Set(examsToDelete.map(e => e.id));
    const affectedCodes = new Set(examsToDelete.map(e => e.employeeCode).filter(Boolean));
    const affectedRecordIds = new Set(examsToDelete.map(e => e.recordId).filter(Boolean));

    const initialLabs = this.structuredLabs.length;
    this.structuredLabs = this.structuredLabs.filter(l => 
      Number(l.examYear) !== targetYear && !examIdsToDelete.has(l.examId)
    );
    const deletedLabsCount = initialLabs - this.structuredLabs.length;

    const initialAtts = this.attachments.length;
    this.attachments = this.attachments.filter(a => 
      Number(a.examYear) !== targetYear && !examIdsToDelete.has(a.examId)
    );
    const deletedAttachmentsCount = initialAtts - this.attachments.length;

    const initialExams = this.exams.length;
    this.exams = this.exams.filter(e => Number(e.examYear) !== targetYear);
    const deletedExamsCount = initialExams - this.exams.length;

    // Clean up structured sessions for this year
    try {
      occupationalHealthStructuredService.deleteSessionsByYear(targetYear);
    } catch (_) {}

    // Clean up import audits for this year
    this.importAudits = this.importAudits.filter(a => Number(a.examYear) !== targetYear);

    // Clean up master records if they have 0 remaining exams in the system
    this.records = this.records.filter(r => {
      const isAffected = affectedRecordIds.has(r.id) || (r.employeeCode && affectedCodes.has(r.employeeCode));
      if (!isAffected) return true;
      const remaining = this.exams.filter(e => e.recordId === r.id || e.employeeCode === r.employeeCode);
      return remaining.length > 0;
    });

    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `حذف و پاکسازی کامل سوابق معاینات سال ${targetYear} شامل ${deletedExamsCount} پرونده معاینه و ${deletedLabsCount} نتیجه آزمایشگاهی توسط ${adminName}`,
      'مدیریت طب کار - حذف سوابق سالانه'
    );

    notifyMedicalDataChange({
      action: 'exams_year_deleted',
      deletedYear: targetYear,
      deletedExamsCount,
      deletedLabsCount,
      deletedAttachmentsCount,
      affectedCodes: Array.from(affectedCodes)
    });

    return {
      success: true,
      deletedExamsCount,
      deletedLabsCount,
      deletedAttachmentsCount,
      message: `تمامی سوابق معاینات، آزمایشات و اطلاعات مربوط به سال ${targetYear} با موفقیت از سامانه پاکسازی شدند.`
    };
  }

  public commitPdfExtraction(
    pdfItem: PdfExtractionPreview,
    currentUser: any
  ): { success: boolean; exam?: PeriodicMedicalExam; error?: string } {
    if (!pdfItem.personnelCode) {
      return { success: false, error: 'کد پرسنلی استخراج شده معتبر نیست.' };
    }

    const creatorName = currentUser?.fullName || currentUser?.username || 'مدیر اصلی سامانه';
    const creatorRole = currentUser?.role || 'مدیر سیستم';
    const nowTimestamp = getCurrentShamsiTimestamp();
    const batchAuditId = `batch-pdf-${Date.now()}`;
    const examYearNum = Number(pdfItem.examYear) || 1405;

    // Get or Create Master Medical Record
    const recRes = this.searchPersonnelAndGetRecord(pdfItem.personnelCode, currentUser);
    const recordId = recRes.record?.id;

    if (!recordId) {
      return { success: false, error: 'پرونده اصلی پرسنل یافت نشد.' };
    }

    const newExamId = `exam-pdf-${Date.now()}`;
    const newExam: PeriodicMedicalExam = {
      id: newExamId,
      recordId,
      employeeCode: pdfItem.personnelCode,
      examYear: examYearNum,
      examDate: pdfItem.examDate || `${examYearNum}/02/15`,
      examType: pdfItem.examType || 'دوره‌ای سالانه',
      medicalCenter: pdfItem.medicalCenter || 'مرکز طب کار',
      doctor: pdfItem.doctor || 'پزشک طب کار',
      status: pdfItem.finalStatus || 'fit',
      findings: {},
      recommendations: '',
      description: `استخراج شده از سند PDF: ${pdfItem.fileName}`,
      importBatchId: batchAuditId,
      importFileName: pdfItem.fileName,
      importSource: 'PDF',
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
      createdBy: creatorName,
      updatedBy: creatorName
    };

    this.exams.unshift(newExam);

    // Save PDF attachment
    if (pdfItem.pdfBase64) {
      this.attachments.unshift({
        id: `att-pdf-${Date.now()}`,
        examId: newExamId,
        recordId,
        examYear: examYearNum,
        originalFileName: pdfItem.fileName,
        displayName: `سند نتایج طب کار PDF - سال ${examYearNum}`,
        description: 'فایل منبع PDF بارگذاری و استخراج شده',
        fileType: 'pdf',
        mimeType: 'application/pdf',
        fileSize: pdfItem.fileSize || 1024,
        fileSizeFormatted: formatBytes(pdfItem.fileSize || 1024),
        fileData: pdfItem.pdfBase64,
        uploadedAt: nowTimestamp,
        uploadedBy: creatorName
      });
    }

    // Save structured lab results
    const structuredTestRecords: any[] = [];
    if (pdfItem.labResults && pdfItem.labResults.length > 0) {
      pdfItem.labResults.forEach((lab, lIdx) => {
        this.structuredLabs.push({
          id: `lab-pdf-${Date.now()}-${Math.floor(Math.random() * 10000)}-${lIdx}`,
          examId: newExamId,
          recordId,
          employeeCode: pdfItem.personnelCode,
          employeeName: pdfItem.fullName,
          testName: lab.testName,
          testCode: `LAB-${lab.testName.toUpperCase()}`,
          numericValue: lab.numericValue,
          textValue: lab.textValue,
          unit: lab.unit,
          minReference: lab.minRef || 0,
          maxReference: lab.maxRef || 100,
          refSource: 'Standard Lab / PDF Source',
          examYear: examYearNum,
          examDate: pdfItem.examDate || `${examYearNum}/02/15`,
          resultStatus: lab.status || 'Normal',
          importBatchId: batchAuditId,
          createdAt: nowTimestamp,
          createdBy: creatorName
        });

        structuredTestRecords.push({
          itemCode: `TEST_PDF_${lIdx + 1}`,
          itemNameFa: lab.testName,
          category: 'blood_tests',
          dataType: lab.numericValue !== undefined ? 'numeric' : 'text',
          valueDisplay: lab.numericValue !== undefined ? `${lab.numericValue} ${lab.unit || ''}`.trim() : (lab.textValue || '-'),
          valueNumeric: lab.numericValue,
          valueText: lab.textValue,
          unit: lab.unit,
          refLow: lab.minRef,
          refHigh: lab.maxRef,
          status: lab.status || 'Normal',
          refSource: 'PDF Source',
          doctorNotes: '',
          createdBy: creatorName
        });
      });
    }

    // Save to occupationalHealthStructuredService
    try {
      occupationalHealthStructuredService.saveCompleteExamSession(
        {
          id: newExamId,
          recordId,
          personnelCode: pdfItem.personnelCode,
          personnelName: pdfItem.fullName,
          nationalCode: pdfItem.personnelCode,
          gender: 'مرد',
          age: 35,
          department: 'سایت عملیات',
          jobTitle: 'پرسنل',
          examYear: examYearNum,
          examDate: pdfItem.examDate || `${examYearNum}/02/15`,
          examType: 'دوره‌ای',
          doctor: pdfItem.doctor || 'پزشک طب کار',
          medicalCenter: pdfItem.medicalCenter || 'مرکز معاینات طب کار',
          fitnessDecision: (pdfItem.finalStatus === 'fit' ? 'مناسب برای شغل' : 'مناسب مشروط') as any,
          finalDoctorComment: `وارد شده از سند PDF: ${pdfItem.fileName}`,
          createdBy: creatorName
        },
        structuredTestRecords,
        currentUser
      );
    } catch (_) {}

    // Register Import Audit Log Record for PDF
    const auditLog: ImportAuditLogRecord = {
      id: batchAuditId,
      timestamp: nowTimestamp,
      importedBy: creatorName,
      userRole: creatorRole,
      fileName: pdfItem.fileName,
      examYear: examYearNum,
      sourceType: 'PDF',
      totalRecords: 1,
      successfulCount: 1,
      failedCount: 0,
      matchedPersonnelCount: 1,
      unmatchedPersonnelCount: 0,
      duplicateCount: 0,
      invalidResultCount: 0,
      manualReviewNeededCount: 0,
      createdRecordsSummary: [`${pdfItem.fullName} (سال ${examYearNum})`],
      updatedRecordsSummary: [],
      importedExamIds: [newExamId],
      affectedRecordIds: [recordId],
      errorDetails: []
    };

    this.addImportAuditLog(auditLog);
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `استخراج و ثبت موفق اطلاعات PDF طب کار برای ${pdfItem.fullName} (سال ${pdfItem.examYear})`,
      'ورود اطلاعات طب کار از PDF'
    );

    notifyMedicalDataChange({ action: 'pdf_import_complete', exam: newExam });

    return { success: true, exam: newExam };
  }
}

// Singleton Service Instance
export const medicalExamService = new MedicalExamService();
