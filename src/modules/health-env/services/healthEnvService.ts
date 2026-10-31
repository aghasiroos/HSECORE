import { 
  PeriodicMedicalRecord, 
  PeriodicMedicalExam, 
  NonPeriodicMedicalExam,
  MedicalExamAttachment,
  EnvMonitoringRecord,
  WasteRecord,
  WastewaterRecord,
  AirQualityRecord,
  WaterSoilRecord,
  EnvHealthNonConformance,
  MedicalExamStatus,
  MedicalExamType
} from '../types';
import { findPersonnelByCode, ComplexPersonnel, getComplexPersonnelList, setComplexPersonnelList } from '../../../utils/personnelHelper';
import { addAuditLog } from '../../../utils/authHelper';
import { apiDb } from '../../../services/apiDatabaseClient';
import { getCurrentShamsiYear, getCurrentShamsiTimestamp } from '../../../utils/jalaliDate';
import { formatFileSize } from '../../../utils/fileHelpers';
import { normalizeDigits } from '../../../utils/textNormalization';

export { getCurrentShamsiYear, getCurrentShamsiTimestamp };

const STORAGE_KEYS = {
  RECORDS: 'hse_medical_records_v4',
  EXAMS: 'hse_medical_exams_v4',
  NON_PERIODIC_EXAMS: 'hse_non_periodic_exams_v4',
  ATTACHMENTS: 'hse_medical_attachments_v4',
  ENV_MONITORING: 'hse_env_monitoring_v5',
  WASTE: 'hse_waste_records_v5',
  WASTEWATER: 'hse_wastewater_records_v5',
  AIR_QUALITY: 'hse_air_quality_v5',
  WATER_SOIL: 'hse_water_soil_v5',
  NON_CONFORMANCES: 'hse_env_health_nc_v5'
};

export function formatBytes(bytes: number): string {
  return formatFileSize(bytes);
}

export function extractShamsiYear(dateStr?: string | number): number | null {
  if (!dateStr) return null;
  if (typeof dateStr === 'number') {
    if (dateStr >= 1300 && dateStr <= 1500) return dateStr;
    return null;
  }
  const enDigits = normalizeDigits(String(dateStr), true);
  const match = enDigits.match(/(1[34]\d\d)/);
  if (match) {
    const y = parseInt(match[1], 10);
    if (y >= 1380 && y <= 1450) return y;
  }
  return null;
}

export function mergeOccHealthV2Data(
  occData: any,
  baseRecords: PeriodicMedicalRecord[],
  baseExams: PeriodicMedicalExam[]
): { records: PeriodicMedicalRecord[]; exams: PeriodicMedicalExam[]; rawOccExams: any[] } {
  const recordsMap = new Map<string, PeriodicMedicalRecord>();
  baseRecords.forEach(r => {
    if (r && r.id) recordsMap.set(r.id, r);
  });

  const examsMap = new Map<string, PeriodicMedicalExam>();
  baseExams.forEach(e => {
    if (e && e.id) examsMap.set(e.id, e);
  });

  const rawExams: any[] = Array.isArray(occData?.examinations) ? occData.examinations : [];
  const pMap: Record<string, any> = occData?.personnelMap && typeof occData.personnelMap === 'object' ? occData.personnelMap : {};

  rawExams.forEach((raw, idx) => {
    if (!raw) return;
    const pInfo = (raw.personnel_id && pMap[raw.personnel_id]) ? pMap[raw.personnel_id] : {};
    const pcode = String(raw.pcode || pInfo.pcode || raw.nid || pInfo.nid || raw.personnel_id || raw.id || `EMP-${idx + 1}`).trim();
    const nid = String(raw.nid || pInfo.nid || pcode).trim();
    const fname = String(raw.fname || pInfo.fname || '').trim();
    const lname = String(raw.lname || pInfo.lname || '').trim();
    const fullName = `${fname} ${lname}`.trim() || `پرسنل ${pcode}`;
    const company = String(raw.company || pInfo.company || 'عملیات').trim();
    const examYear = Number(raw.exam_year) || extractShamsiYear(raw.exam_date) || getCurrentShamsiYear();

    let existingRec = Array.from(recordsMap.values()).find(
      r =>
        String(r.employeeCode).trim().toLowerCase() === pcode.toLowerCase() ||
        (nid && String(r.nationalCode).trim().toLowerCase() === nid.toLowerCase())
    );

    if (!existingRec) {
      const recId = `med-rec-occ-${pcode}`;
      existingRec = {
        id: recId,
        employeeId: String(raw.personnel_id || pcode),
        employeeCode: pcode,
        nationalCode: nid,
        firstName: fname || fullName,
        lastName: lname,
        fullName,
        department: company,
        jobTitle: String(raw.job_title || 'پرسنل عملیاتی'),
        birthDate: '',
        age: Number(raw.age || pInfo.age) || 35,
        phone: '',
        maritalStatus: String(raw.marital || pInfo.marital || ''),
        isComplete: true,
        chronicConditions: [raw.dis_nonocc_known, raw.dis_occ_known, raw.dis_nonocc_new, raw.dis_occ_new]
          .filter(Boolean)
          .map((c, i) => ({
            id: `cc-${pcode}-${i}`,
            conditionName: String(c),
            diagnosedYear: examYear,
            treatmentStatus: 'تحت پایش'
          })),
        createdAt: String(raw.exam_date || `${examYear}/01/01`),
        updatedAt: String(raw.exam_date || `${examYear}/01/01`),
        createdBy: 'سامانه طب کار',
        updatedBy: 'سامانه طب کار'
      };
      recordsMap.set(recId, existingRec);
    }

    const duplicateExam = Array.from(examsMap.values()).find(
      e =>
        (String(e.employeeCode).trim().toLowerCase() === pcode.toLowerCase() || e.recordId === existingRec!.id) &&
        Number(e.examYear) === examYear
    );

    const opinion = String(raw.final_opinion || '').trim();
    let status: MedicalExamStatus = 'fit';
    if (opinion.includes('عدم صلاحیت') || opinion.includes('نامناسب')) {
      status = 'unfit';
    } else if (opinion.includes('مشروط') || (raw.final_conditions && String(raw.final_conditions).trim())) {
      status = 'fit_with_limitations';
    } else if (opinion.includes('ارجاع') || raw.final_followup_needed === 'بله' || raw.ref1_type) {
      status = 'needs_specialist';
    } else if (opinion.includes('بلامانع') || opinion.includes('مناسب') || opinion.includes('سالم')) {
      status = 'fit';
    } else if (opinion) {
      status = 'under_review';
    }

    const heightCm = Number(raw.height) || undefined;
    const weightKg = Number(raw.weight) || undefined;
    let bmiVal = Number(raw.bmi) || undefined;
    if (!bmiVal && heightCm && weightKg && heightCm > 0) {
      const hM = heightCm / 100;
      bmiVal = Number((weightKg / (hM * hM)).toFixed(1));
    }

    const bpSys = Number(raw.bp_sys) || undefined;
    const bpDia = Number(raw.bp_dia) || undefined;
    const bpStr = bpSys && bpDia ? `${bpSys}/${bpDia}` : undefined;

    if (!duplicateExam) {
      const examId = String(raw.exam_id || `exam-occ-${pcode}-${examYear}`);
      const mappedExam: PeriodicMedicalExam & Record<string, any> = {
        id: examId,
        recordId: existingRec.id,
        employeeCode: pcode,
        employeeName: fullName,
        department: company,
        examYear,
        examDate: String(raw.exam_date || `${examYear}/02/15`),
        examType: 'دوره‌ای سالانه',
        medicalCenter: 'مرکز تخصصی طب کار',
        doctor: String(raw.final_doctor || 'پزشک طب کار'),
        status,
        findings: {
          heightCm,
          weightKg,
          bmi: bmiVal,
          bloodPressure: bpStr,
          spirometry: raw.spiro_result ? String(raw.spiro_result) : undefined,
          audiometry: (raw.audio_r || raw.audio_l) ? `R: ${raw.audio_r || '-'} | L: ${raw.audio_l || '-'}` : undefined,
          ecg: raw.ecg ? String(raw.ecg) : undefined,
          bloodTests: raw.lab_abnormal_cats ? String(raw.lab_abnormal_cats) : undefined,
          generalConclusion: opinion || 'بلامانع'
        },
        recommendations: [raw.final_advice, raw.nutr_advice, raw.final_conditions].filter(Boolean).join(' | '),
        description: [raw.exam_notes, raw.final_risks, raw.final_followup_reason].filter(Boolean).join(' | '),
        importBatchId: raw.batch_id,
        importFileName: raw.batch_file_name,
        importSource: 'Excel',
        createdAt: String(raw.exam_date || `${examYear}/02/15`),
        updatedAt: String(raw.exam_date || `${examYear}/02/15`),
        createdBy: 'سامانه طب کار',
        updatedBy: 'سامانه طب کار',
        // Preserve clinical biomarkers & occupational exposures for direct analytics
        fbs: Number(raw.fbs) || undefined,
        chol: Number(raw.chol) || undefined,
        tg: Number(raw.tg) || undefined,
        hdl: Number(raw.hdl) || undefined,
        ldl: Number(raw.ldl) || undefined,
        ast: Number(raw.ast) || undefined,
        alt: Number(raw.alt) || undefined,
        hb: Number(raw.hb) || undefined,
        bp_sys: bpSys,
        bp_dia: bpDia,
        haz_phys: raw.haz_phys,
        haz_chem: raw.haz_chem,
        haz_bio: raw.haz_bio,
        haz_ergo: raw.haz_ergo,
        haz_psych: raw.haz_psych,
        haz_other: raw.haz_other,
        final_opinion: opinion,
        final_followup_needed: raw.final_followup_needed,
        final_followup_date: raw.final_followup_date,
        nutr_advice: raw.nutr_advice,
        dis_nonocc_new: raw.dis_nonocc_new,
        dis_nonocc_known: raw.dis_nonocc_known,
        dis_occ_new: raw.dis_occ_new,
        dis_occ_known: raw.dis_occ_known
      };
      examsMap.set(examId, mappedExam);
    }
  });

  return {
    records: Array.from(recordsMap.values()),
    exams: Array.from(examsMap.values()),
    rawOccExams: rawExams
  };
}

function mergeById<T extends { id?: string }>(primary: T[], secondary: T[]): T[] {
  const map = new Map<string, T>();
  [...(primary || []), ...(secondary || [])].forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const key = item.id || `item_${idx}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

export class HealthEnvService {
  private records: PeriodicMedicalRecord[] = [];
  private periodicExams: PeriodicMedicalExam[] = [];
  private rawOccExams: any[] = [];
  private nonPeriodicExams: NonPeriodicMedicalExam[] = [];
  private attachments: MedicalExamAttachment[] = [];
  private envMonitoring: EnvMonitoringRecord[] = [];
  private wasteRecords: WasteRecord[] = [];
  private wastewaterRecords: WastewaterRecord[] = [];
  private airQualityRecords: AirQualityRecord[] = [];
  private waterSoilRecords: WaterSoilRecord[] = [];
  private nonConformances: EnvHealthNonConformance[] = [];
  private isReloading = false;
  private kpisCache: Map<string, any> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('app_data_mutated', (e: any) => {
        const entity = String(e?.detail?.key || e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
        if (!entity || entity.includes('health') || entity.includes('env') || entity.includes('medical') || entity.includes('exam') || entity.includes('occ_health')) {
          this.kpisCache.clear();
          this.reloadFromServer();
        }
      });
      window.addEventListener('hse_medical_data_updated', () => {
        this.kpisCache.clear();
        this.reloadFromServer();
      });
    }
    this.reloadFromServer();
  }

  public async reloadFromServer() {
    if (this.isReloading) return;
    this.isReloading = true;
    this.kpisCache.clear();
    try {
      const [logs, settings] = await Promise.all([
        apiDb.getEnvironmentalLogs().catch(() => []),
        apiDb.getSystemSettings().catch(() => ({} as Record<string, any>))
      ]);

      const logWaste = Array.isArray(logs) ? logs.filter((l: any) => l.category === 'WASTE').map((l: any) => l.extraData || {}).filter((x: any) => x && x.id) : [];
      const logWastewater = Array.isArray(logs) ? logs.filter((l: any) => l.category === 'WASTEWATER').map((l: any) => l.extraData || {}).filter((x: any) => x && x.id) : [];
      const logAir = Array.isArray(logs) ? logs.filter((l: any) => l.category === 'AIR_EMISSIONS').map((l: any) => l.extraData || {}).filter((x: any) => x && x.id) : [];
      const logSoil = Array.isArray(logs) ? logs.filter((l: any) => l.category === 'SOIL').map((l: any) => l.extraData || {}).filter((x: any) => x && x.id) : [];
      const logMonitoring = Array.isArray(logs) ? logs.filter((l: any) => l.category === 'MONITORING').map((l: any) => l.extraData || {}).filter((x: any) => x && x.id) : [];
      const logNc = Array.isArray(logs) ? logs.filter((l: any) => l.category === 'NON_CONFORMANCE').map((l: any) => l.extraData || {}).filter((x: any) => x && x.id) : [];

      this.wasteRecords = mergeById(Array.isArray(settings[STORAGE_KEYS.WASTE]) ? settings[STORAGE_KEYS.WASTE] : [], logWaste);
      this.wastewaterRecords = mergeById(Array.isArray(settings[STORAGE_KEYS.WASTEWATER]) ? settings[STORAGE_KEYS.WASTEWATER] : [], logWastewater);
      this.airQualityRecords = mergeById(Array.isArray(settings[STORAGE_KEYS.AIR_QUALITY]) ? settings[STORAGE_KEYS.AIR_QUALITY] : [], logAir);
      this.waterSoilRecords = mergeById(Array.isArray(settings[STORAGE_KEYS.WATER_SOIL]) ? settings[STORAGE_KEYS.WATER_SOIL] : [], logSoil);
      this.envMonitoring = mergeById(Array.isArray(settings[STORAGE_KEYS.ENV_MONITORING]) ? settings[STORAGE_KEYS.ENV_MONITORING] : [], logMonitoring);
      this.nonConformances = mergeById(Array.isArray(settings[STORAGE_KEYS.NON_CONFORMANCES]) ? settings[STORAGE_KEYS.NON_CONFORMANCES] : [], logNc);

      const settingRecords: PeriodicMedicalRecord[] = Array.isArray(settings[STORAGE_KEYS.RECORDS]) ? settings[STORAGE_KEYS.RECORDS] : [];
      const settingExams: PeriodicMedicalExam[] = Array.isArray(settings[STORAGE_KEYS.EXAMS]) ? settings[STORAGE_KEYS.EXAMS] : [];
      const occV2Data = settings['OCC_HEALTH_EXAMS_DATA_V2'];

      const mergedMedical = mergeOccHealthV2Data(occV2Data, settingRecords, settingExams);
      this.records = mergedMedical.records;
      this.periodicExams = mergedMedical.exams;
      this.rawOccExams = mergedMedical.rawOccExams;

      if (Array.isArray(settings[STORAGE_KEYS.NON_PERIODIC_EXAMS])) {
        this.nonPeriodicExams = settings[STORAGE_KEYS.NON_PERIODIC_EXAMS];
      }
      if (Array.isArray(settings[STORAGE_KEYS.ATTACHMENTS])) {
        this.attachments = settings[STORAGE_KEYS.ATTACHMENTS];
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(this.records));
          localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(this.periodicExams));
          localStorage.setItem(STORAGE_KEYS.NON_PERIODIC_EXAMS, JSON.stringify(this.nonPeriodicExams));
        } catch (_) {}
        window.dispatchEvent(new Event('hse_health_env_updated'));
      }
    } catch (e) {
      console.error('Failed to reload HealthEnvService from server:', e);
    } finally {
      this.isReloading = false;
    }
  }

  public getRawOccExams(): any[] {
    return [...this.rawOccExams];
  }

  private loadKey = <T>(key: string, fallback: T[]): T[] => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn(`Error loading key ${key}:`, e);
    }
    return [...fallback];
  };

  public reloadFromStorage = () => {
    this.records = this.loadKey(STORAGE_KEYS.RECORDS, []);
    this.periodicExams = this.loadKey(STORAGE_KEYS.EXAMS, []);
    this.nonPeriodicExams = this.loadKey(STORAGE_KEYS.NON_PERIODIC_EXAMS, []);
    this.attachments = this.loadKey(STORAGE_KEYS.ATTACHMENTS, []);
    this.envMonitoring = this.loadKey(STORAGE_KEYS.ENV_MONITORING, []);
    this.wasteRecords = this.loadKey(STORAGE_KEYS.WASTE, []);
    this.wastewaterRecords = this.loadKey(STORAGE_KEYS.WASTEWATER, []);
    this.airQualityRecords = this.loadKey(STORAGE_KEYS.AIR_QUALITY, []);
    this.waterSoilRecords = this.loadKey(STORAGE_KEYS.WATER_SOIL, []);
    this.nonConformances = this.loadKey(STORAGE_KEYS.NON_CONFORMANCES, []);
  };

  private initData() {
    // Clean older keys from prior seed versions (v1 - v4)
    [
      'hse_medical_records_v1', 'hse_medical_records_v2', 'hse_medical_records_v3',
      'hse_medical_exams_v1', 'hse_medical_exams_v2', 'hse_medical_exams_v3',
      'hse_non_periodic_exams_v1', 'hse_non_periodic_exams_v2', 'hse_non_periodic_exams_v3',
      'hse_medical_attachments_v1', 'hse_medical_attachments_v2', 'hse_medical_attachments_v3',
      'hse_env_monitoring_v1', 'hse_env_monitoring_v2', 'hse_env_monitoring_v3', 'hse_env_monitoring_v4',
      'hse_waste_records_v1', 'hse_waste_records_v2', 'hse_waste_records_v3', 'hse_waste_records_v4',
      'hse_wastewater_records_v1', 'hse_wastewater_records_v2', 'hse_wastewater_records_v3', 'hse_wastewater_records_v4',
      'hse_air_quality_v1', 'hse_air_quality_v2', 'hse_air_quality_v3', 'hse_air_quality_v4',
      'hse_water_soil_v1', 'hse_water_soil_v2', 'hse_water_soil_v3', 'hse_water_soil_v4',
      'hse_env_health_nc_v1', 'hse_env_health_nc_v2', 'hse_env_health_nc_v3', 'hse_env_health_nc_v4'
    ].forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });

    this.records = this.loadKey(STORAGE_KEYS.RECORDS, []);
    this.periodicExams = this.loadKey(STORAGE_KEYS.EXAMS, []);
    this.nonPeriodicExams = this.loadKey(STORAGE_KEYS.NON_PERIODIC_EXAMS, []);
    this.attachments = this.loadKey(STORAGE_KEYS.ATTACHMENTS, []);
    this.envMonitoring = this.loadKey(STORAGE_KEYS.ENV_MONITORING, []);
    this.wasteRecords = this.loadKey(STORAGE_KEYS.WASTE, []);
    this.wastewaterRecords = this.loadKey(STORAGE_KEYS.WASTEWATER, []);
    this.airQualityRecords = this.loadKey(STORAGE_KEYS.AIR_QUALITY, []);
    this.waterSoilRecords = this.loadKey(STORAGE_KEYS.WATER_SOIL, []);
    this.nonConformances = this.loadKey(STORAGE_KEYS.NON_CONFORMANCES, []);

    // Purge year 1402 data
    const has1402 = this.periodicExams.some(e => Number(e.examYear) === 1402) || this.attachments.some(a => Number(a.examYear) === 1402);
    if (has1402) {
      this.periodicExams = this.periodicExams.filter(e => Number(e.examYear) !== 1402);
      this.attachments = this.attachments.filter(a => Number(a.examYear) !== 1402);
      this.records = this.records.filter(r => {
        const remaining = this.periodicExams.filter(e => e.recordId === r.id || e.employeeCode === r.employeeCode);
        return remaining.length > 0;
      });
    }

    // Purge any legacy default/mock seeded medical exams or records
    const mockExams = this.periodicExams.filter(e => 
      e.id.startsWith('exam_seed_') || 
      e.id.startsWith('seed_') || 
      e.doctor?.includes('احمدرضا سهرابی') || 
      e.medicalCenter?.includes('مرکز سلامت شغلی و طب کار صنعت نفت')
    );
    if (mockExams.length > 0) {
      const mockIds = new Set(mockExams.map(e => e.id));
      this.periodicExams = this.periodicExams.filter(e => !mockIds.has(e.id));
      this.attachments = this.attachments.filter(a => !mockIds.has(a.examId));
      this.records = this.records.filter(r => this.periodicExams.some(e => e.recordId === r.id || e.employeeCode === r.employeeCode));
    }

    this.saveAll();
    this.reloadFromServer(); // sync from PG immediately
  }

  public resetEnvironmentData() {
    this.envMonitoring = [];
    this.wasteRecords = [];
    this.wastewaterRecords = [];
    this.airQualityRecords = [];
    this.waterSoilRecords = [];
    this.nonConformances = [];
    this.saveAll();
  }

  private saveAll() {
    try {
      apiDb.saveSetting(STORAGE_KEYS.RECORDS, this.records);
      apiDb.saveSetting(STORAGE_KEYS.EXAMS, this.periodicExams);
      apiDb.saveSetting(STORAGE_KEYS.NON_PERIODIC_EXAMS, this.nonPeriodicExams);
      apiDb.saveSetting(STORAGE_KEYS.ATTACHMENTS, this.attachments);
      apiDb.saveSetting(STORAGE_KEYS.ENV_MONITORING, this.envMonitoring);
      apiDb.saveSetting(STORAGE_KEYS.WASTE, this.wasteRecords);
      apiDb.saveSetting(STORAGE_KEYS.WASTEWATER, this.wastewaterRecords);
      apiDb.saveSetting(STORAGE_KEYS.AIR_QUALITY, this.airQualityRecords);
      apiDb.saveSetting(STORAGE_KEYS.WATER_SOIL, this.waterSoilRecords);
      apiDb.saveSetting(STORAGE_KEYS.NON_CONFORMANCES, this.nonConformances);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hse_health_env_updated'));
      }
    } catch (e) {
      console.warn('Error saving HealthEnv data to پایگاه داده:', e);
    }
  }

  // ==========================================
  // 1. HEALTH RECORDS & MASTER DATA SYNC
  // ==========================================
  public getAllRecords(): PeriodicMedicalRecord[] {
    return [...this.records];
  }

  public getRecordById(id: string): PeriodicMedicalRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  public getRecordByEmployeeCode(code: string): PeriodicMedicalRecord | undefined {
    const trimmed = String(code).trim().toLowerCase();
    return this.records.find(r => 
      String(r.employeeCode).trim().toLowerCase() === trimmed || 
      String(r.nationalCode).trim().toLowerCase() === trimmed ||
      String(r.employeeId).trim().toLowerCase() === trimmed
    );
  }

  public createOrSyncRecordFromPersonnel(person: ComplexPersonnel, user = 'admin'): PeriodicMedicalRecord {
    const pCode = (person.personnelCode || person.effectiveCode || person.nationalCode || person.id || '').trim();
    const existing = this.getRecordByEmployeeCode(pCode);
    if (existing) {
      existing.fullName = person.fullName;
      existing.firstName = person.firstName;
      existing.lastName = person.lastName;
      existing.department = person.unit || person.department || 'عملیات';
      existing.jobTitle = person.jobTitle;
      existing.phone = person.phone || existing.phone;
      existing.nationalCode = person.nationalCode || existing.nationalCode;
      existing.age = person.age || existing.age;
      existing.updatedAt = getCurrentShamsiTimestamp();
      existing.updatedBy = user;
      this.saveAll();
      return existing;
    }

    const newRecord: PeriodicMedicalRecord = {
      id: `med-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      employeeId: person.id,
      employeeCode: pCode,
      nationalCode: person.nationalCode,
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: person.fullName,
      department: person.unit || person.department || '',
      jobTitle: person.jobTitle || '',
      birthDate: person.birthDate || '1370/01/01',
      age: person.age || 30,
      phone: person.phone || '',
      education: person.education || '',
      maritalStatus: person.maritalStatus || '',
      bloodType: 'O+',
      isComplete: true,
      chronicConditions: [],
      riskFactors: [],
      notes: 'پرونده سلامت الکترونیکی همگام‌سازی شده از پایگاه داده اصلی پرسنل',
      createdAt: getCurrentShamsiTimestamp(),
      updatedAt: getCurrentShamsiTimestamp(),
      createdBy: user,
      updatedBy: user
    };

    this.records.unshift(newRecord);
    this.saveAll();
    addAuditLog(user, `ایجاد پرونده الکترونیک سلامت برای پرسنل ${newRecord.fullName} (${newRecord.employeeCode})`, 'طب کار');
    return newRecord;
  }

  public updateRecord(id: string, updates: Partial<PeriodicMedicalRecord>, user = 'admin'): PeriodicMedicalRecord | null {
    const idx = this.records.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.records[idx] = {
      ...this.records[idx],
      ...updates,
      updatedAt: getCurrentShamsiTimestamp(),
      updatedBy: user
    };
    this.saveAll();
    addAuditLog(user, `ویرایش پرونده سلامت پرسنل ${this.records[idx].fullName}`, 'طب کار');
    return this.records[idx];
  }

  // ==========================================
  // COMPREHENSIVE 360° DOSSIER AGGREGATION
  // ==========================================
  public getComprehensivePersonnelDossier(identifier: string | ComplexPersonnel, user = 'admin') {
    let person: ComplexPersonnel | null = null;
    if (typeof identifier === 'object' && identifier !== null) {
      person = identifier;
    } else {
      const all = getComplexPersonnelList();
      const q = String(identifier).trim().toLowerCase();
      person = all.find(p => 
        (p.effectiveCode && p.effectiveCode.toLowerCase() === q) ||
        (p.personnelCode && p.personnelCode.toLowerCase() === q) ||
        (p.nationalCode && p.nationalCode.toLowerCase() === q) ||
        (p.id && p.id.toLowerCase() === q) ||
        (p.fullName && p.fullName.toLowerCase().includes(q))
      ) || null;
    }

    if (!person) return null;

    const pCode = (person.personnelCode || person.effectiveCode || person.nationalCode || person.id || '').trim();
    
    // 1. Sync or retrieve Master Record
    let record = this.getRecordByEmployeeCode(pCode);
    if (!record) {
      record = this.createOrSyncRecordFromPersonnel(person, user);
    }

    // Auto populate workplace hazards and risk factors based on department if missing
    if (!record.riskFactors || record.riskFactors.length === 0) {
      const dept = (person.department || person.unit || '').toLowerCase();
      if (dept.includes('عملیات') || dept.includes('بهره‌برداری') || dept.includes('تولید')) {
        record.riskFactors = [
          { hazardType: 'صدا', intensity: 'متوسط', ppeRequired: 'گوشی ایرماف و ایرپلاگ', controlMeasure: 'پایش صوت و ادیومتری سالانه' },
          { hazardType: 'شیمیایی', intensity: 'بالا', ppeRequired: 'ماسک تنفسی با فیلتر آلی ABEK', controlMeasure: 'تهویه موضعی و پایش گازهای هیدروکربوری' },
          { hazardType: 'ارگونومی', intensity: 'متوسط', ppeRequired: 'دستکش و کفش ایمنی ضدلغزش', controlMeasure: 'رعایت اصول حمل بار' }
        ];
      } else if (dept.includes('تعمیرات') || dept.includes('مکانیک') || dept.includes('برق')) {
        record.riskFactors = [
          { hazardType: 'صدا', intensity: 'بالا', ppeRequired: 'ایرپلاگ + ایرماف', controlMeasure: 'پایش صوت کمپرسورها' },
          { hazardType: 'ارگونومی', intensity: 'بالا', ppeRequired: 'کمربند حفاظتی، بالابر مکانیکی', controlMeasure: 'کاهش کارهای تکراری' },
          { hazardType: 'ارتعاش' as any, intensity: 'متوسط', ppeRequired: 'دستکش ضدلرزش', controlMeasure: 'تعویض دوره‌ای ابزارهای پنوماتیک' }
        ];
      } else if (dept.includes('آتش') || dept.includes('امداد') || dept.includes('fire')) {
        record.riskFactors = [
          { hazardType: 'استرس گرمایی', intensity: 'بحرانی', ppeRequired: 'لباس نسوز ۴ لایه + SCBA', controlMeasure: 'پایش ضربان قلب و هیدراتاسیون' },
          { hazardType: 'شیمیایی', intensity: 'بحرانی', ppeRequired: 'دستگاه تنفسی مدار بسته', controlMeasure: 'دکون فیزیولوژیک' }
        ];
      } else if (dept.includes('hse') || dept.includes('ایمنی') || dept.includes('بهداشت')) {
        record.riskFactors = [
          { hazardType: 'استرس گرمایی', intensity: 'متوسط', ppeRequired: 'کلاه لبه‌دار و عینک UV', controlMeasure: 'پایش زمان ماند در سایت عملیاتی' },
          { hazardType: 'ارگونومی', intensity: 'متوسط', ppeRequired: 'تجهیزات ارگونومیک اداری و صحرایی', controlMeasure: 'تنظیم متناوب پوزیشن کاری' }
        ];
      } else {
        record.riskFactors = [
          { hazardType: 'ارگونومی', intensity: 'متوسط', ppeRequired: 'صندلی ارگونومیک و زیرپایی', controlMeasure: 'تنظیم ایستگاه کاری و استراحت بصری' },
          { hazardType: 'استرس گرمایی', intensity: 'پایین', ppeRequired: 'لباس کار پنبه‌ای مناسب', controlMeasure: 'تهویه مطبوع استاندارد' }
        ];
      }
    }

    // 2. Fetch Periodic Medical Exams (from current service + legacy localStorage v2)
    const pExamsSet = new Map<string, PeriodicMedicalExam>();
    
    // from this.periodicExams
    this.periodicExams.forEach(e => {
      if (
        e.recordId === record?.id ||
        (e.employeeCode && (e.employeeCode === pCode || e.employeeCode === person?.nationalCode || e.employeeCode === person?.id))
      ) {
        pExamsSet.set(e.id, e);
      }
    });

    // also check legacy v2
    try {
      const v2Exams = localStorage.getItem('hse_medical_exams_v2');
      if (v2Exams) {
        const parsed = JSON.parse(v2Exams);
        if (Array.isArray(parsed)) {
          parsed.forEach((e: PeriodicMedicalExam) => {
            if (
              e.recordId === record?.id ||
              (e.employeeCode && (e.employeeCode === pCode || e.employeeCode === person?.nationalCode || e.employeeCode === person?.id))
            ) {
              pExamsSet.set(e.id, e);
            }
          });
        }
      }
    } catch {}

    let periodicExams = Array.from(pExamsSet.values()).sort((a, b) => (b.examYear || 0) - (a.examYear || 0));

    // 3. Fetch Non-Periodic Exams
    const npExams = this.nonPeriodicExams.filter(e => 
      e.recordId === record?.id ||
      e.employeeCode === pCode ||
      e.nationalCode === person?.nationalCode ||
      (e.employeeName && person?.fullName && e.employeeName.trim().toLowerCase().includes(person.fullName.trim().toLowerCase()))
    ).sort((a, b) => b.examDate.localeCompare(a.examDate));

    // 4. Fetch Attachments
    const examIds = new Set(periodicExams.map(e => e.id));
    let atts = this.attachments.filter(a => 
      a.recordId === record?.id ||
      (a.examId && examIds.has(a.examId))
    );

    // 5. Paraclinical Summary Synthesis
    const latestExam = periodicExams.length > 0 ? periodicExams[0] : undefined;
    const latestFindings = latestExam?.findings || {};

    return {
      record,
      personnel: person,
      periodicExams,
      nonPeriodicExams: npExams,
      attachments: atts,
      latestExam,
      findings: latestFindings,
      overallFitness: latestExam?.status || 'fit'
    };
  }

  // ==========================================
  // 2. PERIODIC MEDICAL EXAMS
  // ==========================================
  public getAllPeriodicExams(): PeriodicMedicalExam[] {
    return [...this.periodicExams];
  }

  public getExamsByRecordId(recordId: string): PeriodicMedicalExam[] {
    return this.periodicExams
      .filter(e => e.recordId === recordId)
      .sort((a, b) => b.examYear - a.examYear);
  }

  public getExamByYear(recordId: string, year: number): PeriodicMedicalExam | undefined {
    return this.periodicExams.find(e => e.recordId === recordId && e.examYear === year);
  }

  public savePeriodicExam(exam: Partial<PeriodicMedicalExam>, user = 'admin'): PeriodicMedicalExam {
    const existingIndex = this.periodicExams.findIndex(
      e => e.id === exam.id || (e.recordId === exam.recordId && e.examYear === exam.examYear)
    );

    const now = getCurrentShamsiTimestamp();

    if (existingIndex !== -1) {
      const updated: PeriodicMedicalExam = {
        ...this.periodicExams[existingIndex],
        ...exam,
        updatedAt: now,
        updatedBy: user
      } as PeriodicMedicalExam;

      this.periodicExams[existingIndex] = updated;
      this.saveAll();
      addAuditLog(user, `به‌روزرسانی معاینات دوره‌ای سال ${updated.examYear} برای رکورد ${updated.recordId}`, 'طب کار');
      
      // Async sync to پایگاه داده
      apiDb.saveMedicalExam({
        personnelCode: updated.employeeCode || updated.recordId,
        nationalCode: updated.employeeCode || updated.recordId,
        examYear: updated.examYear,
        examDate: updated.examDate,
        examType: updated.examType,
        doctorVerdict: updated.status,
        clinicalNotes: updated.description,
        restrictions: updated.recommendations,
        rawData: updated
      }).catch(() => {});

      return updated;
    } else {
      const newExam: PeriodicMedicalExam = {
        id: exam.id || `exam-${exam.recordId}-${exam.examYear || 1405}-${Date.now()}`,
        recordId: exam.recordId!,
        employeeCode: exam.employeeCode || '',
        examYear: exam.examYear || 1405,
        examDate: exam.examDate || '1405/01/01',
        examType: exam.examType || 'دوره‌ای سالانه',
        medicalCenter: exam.medicalCenter || 'مرکز تخصصی طب کار و سلامت شغلی',
        doctor: exam.doctor || '',
        status: exam.status || 'under_review',
        findings: exam.findings || {},
        recommendations: exam.recommendations || '',
        description: exam.description || '',
        attachmentsCount: 0,
        createdAt: now,
        updatedAt: now,
        createdBy: user,
        updatedBy: user
      };

      this.periodicExams.unshift(newExam);
      this.saveAll();
      addAuditLog(user, `ثبت معاینه دوره‌ای جدید برای سال ${newExam.examYear}`, 'طب کار');

      // Async sync to پایگاه داده
      apiDb.saveMedicalExam({
        personnelCode: newExam.employeeCode || newExam.recordId,
        nationalCode: newExam.employeeCode || newExam.recordId,
        examYear: newExam.examYear,
        examDate: newExam.examDate,
        examType: newExam.examType,
        doctorVerdict: newExam.status,
        clinicalNotes: newExam.description,
        restrictions: newExam.recommendations,
        rawData: newExam
      }).catch(() => {});

      return newExam;
    }
  }

  public deletePeriodicExam(id: string, user = 'admin'): boolean {
    const exam = this.periodicExams.find(e => e.id === id);
    if (!exam) return false;
    this.periodicExams = this.periodicExams.filter(e => e.id !== id);
    this.attachments = this.attachments.filter(a => a.examId !== id);
    this.saveAll();
    addAuditLog(user, `حذف معاینه دوره‌ای سال ${exam.examYear} پرسنل کد ${exam.employeeCode}`, 'طب کار');
    return true;
  }

  // ==========================================
  // 3. NON-PERIODIC MEDICAL EXAMS
  // ==========================================
  public getAllNonPeriodicExams(): NonPeriodicMedicalExam[] {
    return [...this.nonPeriodicExams];
  }

  public getNonPeriodicExamsByRecordId(recordId: string): NonPeriodicMedicalExam[] {
    return this.nonPeriodicExams
      .filter(e => e.recordId === recordId)
      .sort((a, b) => b.examDate.localeCompare(a.examDate));
  }

  public saveNonPeriodicExam(exam: Partial<NonPeriodicMedicalExam>, user = 'admin'): NonPeriodicMedicalExam {
    const now = getCurrentShamsiTimestamp();
    const existingIndex = this.nonPeriodicExams.findIndex(e => e.id === exam.id);

    if (existingIndex !== -1) {
      const updated: NonPeriodicMedicalExam = {
        ...this.nonPeriodicExams[existingIndex],
        ...exam,
        updatedAt: now,
        updatedBy: user
      } as NonPeriodicMedicalExam;
      this.nonPeriodicExams[existingIndex] = updated;
      this.saveAll();
      addAuditLog(user, `ویرایش معاینه غیر دوره‌ای ${updated.employeeName} (${updated.reason})`, 'معاینات غیر دوره‌ای');
      return updated;
    } else {
      const newExam: NonPeriodicMedicalExam = {
        id: `np-exam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recordId: exam.recordId || '',
        employeeCode: exam.employeeCode || '',
        employeeName: exam.employeeName || '',
        nationalCode: exam.nationalCode || '',
        department: exam.department || '',
        jobTitle: exam.jobTitle || '',
        examDate: exam.examDate || '1405/04/01',
        reason: exam.reason || 'بازگشت به کار پس از مرخصی استعلاجی',
        examType: exam.examType || 'بازگشت به کار',
        medicalCenter: exam.medicalCenter || 'بهداری مرکزی مجتمع پتروشیمی',
        doctor: exam.doctor || '',
        status: exam.status || 'fit',
        clinicalSymptoms: exam.clinicalSymptoms || '',
        findings: exam.findings || {},
        recommendations: exam.recommendations || '',
        description: exam.description || '',
        returnToWorkDate: exam.returnToWorkDate,
        limitations: exam.limitations,
        attachmentsCount: exam.attachments ? exam.attachments.length : (exam.attachmentsCount || 0),
        attachments: exam.attachments || [],
        createdAt: now,
        updatedAt: now,
        createdBy: user,
        updatedBy: user
      };
      this.nonPeriodicExams.unshift(newExam);
      this.saveAll();
      addAuditLog(user, `ثبت معاینه غیر دوره‌ای جدید برای ${newExam.employeeName} - علت: ${newExam.reason}`, 'معاینات غیر دوره‌ای');
      return newExam;
    }
  }

  public deleteNonPeriodicExam(id: string, user = 'admin'): boolean {
    const exam = this.nonPeriodicExams.find(e => e.id === id);
    if (!exam) return false;
    this.nonPeriodicExams = this.nonPeriodicExams.filter(e => e.id !== id);
    this.saveAll();
    addAuditLog(user, `حذف معاینه غیر دوره‌ای برای ${exam.employeeName}`, 'معاینات غیر دوره‌ای');
    return true;
  }

  // ==========================================
  // 4. ATTACHMENTS & MEDICAL FILES
  // ==========================================
  public getAllAttachments(): MedicalExamAttachment[] {
    return [...this.attachments];
  }

  public getAttachmentsByRecordId(recordId: string): MedicalExamAttachment[] {
    return this.attachments.filter(a => a.recordId === recordId);
  }

  public getAttachmentsByExamId(examId: string): MedicalExamAttachment[] {
    return this.attachments.filter(a => a.examId === examId);
  }

  public addAttachment(att: Partial<MedicalExamAttachment>, user = 'admin'): MedicalExamAttachment {
    const now = getCurrentShamsiTimestamp();
    const newAtt: MedicalExamAttachment = {
      id: att.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      examId: att.examId || '',
      recordId: att.recordId || '',
      examYear: att.examYear || 1405,
      originalFileName: att.originalFileName || 'document.pdf',
      displayName: att.displayName || att.originalFileName || 'مدرک پزشکی',
      description: att.description || '',
      fileType: att.fileType || 'pdf',
      mimeType: att.mimeType || 'application/pdf',
      fileSize: att.fileSize || 1024,
      fileSizeFormatted: att.fileSizeFormatted || formatBytes(att.fileSize || 1024),
      fileData: att.fileData,
      filePath: att.filePath,
      uploadedAt: now,
      uploadedBy: user
    };

    this.attachments.unshift(newAtt);
    
    // Update exam attachment count
    if (newAtt.examId) {
      const exam = this.periodicExams.find(e => e.id === newAtt.examId);
      if (exam) {
        exam.attachmentsCount = (exam.attachmentsCount || 0) + 1;
      }
    }

    this.saveAll();
    addAuditLog(user, `بارگذاری سند پزشکی "${newAtt.displayName}"`, 'مدارک پزشکی');
    return newAtt;
  }

  public deleteAttachment(id: string, user = 'admin'): boolean {
    const att = this.attachments.find(a => a.id === id);
    if (!att) return false;

    this.attachments = this.attachments.filter(a => a.id !== id);

    if (att.examId) {
      const exam = this.periodicExams.find(e => e.id === att.examId);
      if (exam && exam.attachmentsCount) {
        exam.attachmentsCount = Math.max(0, exam.attachmentsCount - 1);
      }
    }

    this.saveAll();
    addAuditLog(user, `حذف مدرک پزشکی "${att.displayName}"`, 'مدارک پزشکی');
    return true;
  }

  // ==========================================
  // 5. ENVIRONMENTAL TELEMETRY & MONITORING
  // ==========================================
  public getAllEnvMonitoring(): EnvMonitoringRecord[] {
    return [...this.envMonitoring];
  }

  public saveEnvMonitoring(record: Partial<EnvMonitoringRecord>, user = 'admin'): EnvMonitoringRecord {
    const now = getCurrentShamsiTimestamp();
    const existingIndex = this.envMonitoring.findIndex(e => e.id === record.id);

    // Auto-calculate compliance status
    let complianceStatus = record.complianceStatus || 'compliant';
    if (record.measuredValue !== undefined && record.standardLimit !== undefined) {
      if (record.limitType === 'min') {
        complianceStatus = record.measuredValue >= record.standardLimit ? 'compliant' : 'non_compliant';
      } else {
        complianceStatus = record.measuredValue <= record.standardLimit ? 'compliant' : 'non_compliant';
      }
    }

    if (existingIndex !== -1) {
      const updated: EnvMonitoringRecord = {
        ...this.envMonitoring[existingIndex],
        ...record,
        complianceStatus,
        updatedAt: now
      } as EnvMonitoringRecord;
      this.envMonitoring[existingIndex] = updated;
      this.saveAll();
      addAuditLog(user, `ویرایش رکورد پایش محیط زیست: ${updated.parameter} در ${updated.stationOrLocation}`, 'پایش محیط زیست');
      return updated;
    } else {
      const newRec: EnvMonitoringRecord = {
        id: `env-mon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        monitoringType: record.monitoringType || 'air',
        stationOrLocation: record.stationOrLocation || 'ایستگاه مرکزی',
        site: record.site || '',
        department: record.department || '',
        date: record.date || '1405/04/01',
        parameter: record.parameter || 'آلاینده',
        measuredValue: record.measuredValue || 0,
        unit: record.unit || 'ppm',
        standardLimit: record.standardLimit || 10,
        limitType: record.limitType || 'max',
        complianceStatus,
        laboratory: record.laboratory || 'آزمایشگاه معتمد محیط زیست',
        inspector: record.inspector || user,
        description: record.description || '',
        hasAttachment: record.hasAttachment || false,
        attachmentName: record.attachmentName,
        createdAt: now,
        updatedAt: now
      };
      this.envMonitoring.unshift(newRec);
      this.saveAll();
      addAuditLog(user, `ثبت پایش جدید محیط زیست: ${newRec.parameter} - وضعیت: ${complianceStatus === 'compliant' ? 'مطابق' : 'نامطابق'}`, 'پایش محیط زیست');
      return newRec;
    }
  }

  public deleteEnvMonitoring(id: string, user = 'admin'): boolean {
    const item = this.envMonitoring.find(e => e.id === id);
    if (!item) return false;
    this.envMonitoring = this.envMonitoring.filter(e => e.id !== id);
    this.saveAll();
    addAuditLog(user, `حذف پایش محیط زیست ${item.parameter}`, 'پایش محیط زیست');
    return true;
  }

  // ==========================================
  // 6. WASTE MANAGEMENT
  // ==========================================
  public getAllWasteRecords(): WasteRecord[] {
    return [...this.wasteRecords];
  }

  public saveWasteRecord(waste: Partial<WasteRecord>, user = 'admin'): WasteRecord {
    const now = getCurrentShamsiTimestamp();
    const existingIndex = this.wasteRecords.findIndex(w => w.id === waste.id);

    if (existingIndex !== -1) {
      const updated: WasteRecord = {
        ...this.wasteRecords[existingIndex],
        ...waste,
        updatedAt: now
      } as WasteRecord;
      this.wasteRecords[existingIndex] = updated;
      apiDb.getEnvironmentalLogs().then(logs => {
        const target = logs.find((l:any) => l.category === 'WASTE' && l.extraData?.id === updated.id);
        if (target) {
          apiDb.updateEnvironmentalLog(target.id, {
            parameterName: updated.title,
            measuredValue: Number(updated.quantity) || 0,
            unit: updated.unit,
            disposalMethod: updated.disposalOrTransferMethod,
            destination: updated.contractor,
            notes: updated.notes,
            extraData: updated,
          });
        }
      });
      this.saveAll();
      addAuditLog(user, `ویرایش رکورد پسماند: ${updated.code} - ${updated.title}`, 'مدیریت پسماند');
      return updated;
    } else {
      const newRec: WasteRecord = {
        id: `waste-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        code: waste.code || `W-${Math.floor(100 + Math.random() * 900)}`,
        title: waste.title || 'پسماند صنعتی',
        category: waste.category || 'پسماند قابل بازیافت',
        quantity: waste.quantity || 1,
        unit: waste.unit || 'تن (Ton)',
        productionDate: waste.productionDate || '1405/04/01',
        originLocation: waste.originLocation || '',
        department: waste.department || '',
        storageMethod: waste.storageMethod || '',
        disposalOrTransferMethod: waste.disposalOrTransferMethod || 'بازیافت',
        contractor: waste.contractor || 'شرکت بازیافت مجاز',
        manifestNo: waste.manifestNo,
        status: waste.status || 'تولید و دپو موقت',
        isHazardous: waste.isHazardous || false,
        notes: waste.notes,
        hasManifestDoc: waste.hasManifestDoc || false,
        createdAt: now,
        updatedAt: now
      };
      this.wasteRecords.unshift(newRec);
      apiDb.createEnvironmentalLog({
        category: 'WASTE',
        logDate: newRec.productionDate || new Date().toISOString(),
        parameterName: newRec.title,
        measuredValue: Number(newRec.quantity) || 0,
        unit: newRec.unit,
        disposalMethod: newRec.disposalOrTransferMethod,
        destination: newRec.contractor,
        notes: newRec.notes,
        extraData: newRec,
      });
      this.saveAll();
      addAuditLog(user, `ثبت رکورد جدید پسماند ${newRec.code} به مقدار ${newRec.quantity} ${newRec.unit}`, 'مدیریت پسماند');
      return newRec;
    }
  }

  public deleteWasteRecord(id: string, user = 'admin'): boolean {
    const item = this.wasteRecords.find(w => w.id === id);
    if (!item) return false;
    this.wasteRecords = this.wasteRecords.filter(w => w.id !== id);
    apiDb.getEnvironmentalLogs().then(logs => {
      const target = logs.find((l:any) => l.category === 'WASTE' && l.extraData?.id === id);
      if (target) apiDb.deleteEnvironmentalLog(target.id);
    });
    this.saveAll();
    addAuditLog(user, `حذف رکورد پسماند ${item.code}`, 'مدیریت پسماند');
    return true;
  }

  // ==========================================
  // 7. WASTEWATER, AIR, WATER & SOIL
  // ==========================================
  public getAllWastewater(): WastewaterRecord[] {
    return [...this.wastewaterRecords];
  }

  public saveWastewater(rec: Partial<WastewaterRecord>, user = 'admin'): WastewaterRecord {
    const existingIndex = this.wastewaterRecords.findIndex(w => w.id === rec.id);
    const complianceStatus = (rec.measuredValue || 0) <= (rec.standardLimit || 100) ? 'compliant' : 'non_compliant';

    if (existingIndex !== -1) {
      const updated = {
        ...this.wastewaterRecords[existingIndex],
        ...rec,
        complianceStatus
      } as WastewaterRecord;
      this.wastewaterRecords[existingIndex] = updated;
      this.saveAll();
      addAuditLog(user, `ویرایش رکورد پساب ${updated.parameter} در ${updated.samplingPoint}`, 'مدیریت پساب');
      return updated;
    } else {
      const newRec: WastewaterRecord = {
        id: `ww-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        samplingPoint: rec.samplingPoint || 'خروجی تصفیه‌خانه ETP',
        date: rec.date || '1405/04/01',
        parameter: rec.parameter || 'COD',
        measuredValue: rec.measuredValue || 0,
        unit: rec.unit || 'mg/L',
        standardLimit: rec.standardLimit || 100,
        complianceStatus,
        laboratory: rec.laboratory || 'آزمایشگاه ETP',
        dischargeDestination: rec.dischargeDestination || 'خلیج فارس',
        notes: rec.notes,
        createdAt: getCurrentShamsiTimestamp()
      };
      this.wastewaterRecords.unshift(newRec);
      this.saveAll();
      addAuditLog(user, `ثبت آزمایش پساب: ${newRec.parameter} = ${newRec.measuredValue} ${newRec.unit}`, 'مدیریت پساب');
      return newRec;
    }
  }

  public deleteWastewater(id: string, user = 'admin'): boolean {
    const idx = this.wastewaterRecords.findIndex(w => w.id === id);
    if (idx !== -1) {
      const removed = this.wastewaterRecords.splice(idx, 1)[0];
      this.saveAll();
      addAuditLog(user, `حذف رکورد آزمایش پساب: ${removed.parameter} (${removed.samplingPoint})`, 'مدیریت پساب');
      return true;
    }
    return false;
  }

  public getAllAirQuality(): AirQualityRecord[] {
    return [...this.airQualityRecords];
  }

  public getAllWaterSoil(): WaterSoilRecord[] {
    return [...this.waterSoilRecords];
  }

  // ==========================================
  // 8. NON-CONFORMANCES & CAPA
  // ==========================================
  public getAllNonConformances(): EnvHealthNonConformance[] {
    return [...this.nonConformances];
  }

  public saveNonConformance(nc: Partial<EnvHealthNonConformance>, user = 'admin'): EnvHealthNonConformance {
    const now = getCurrentShamsiTimestamp();
    const existingIndex = this.nonConformances.findIndex(n => n.id === nc.id || (nc.trackingCode && n.trackingCode === nc.trackingCode));

    if (existingIndex !== -1) {
      const updated = {
        ...this.nonConformances[existingIndex],
        ...nc,
        updatedAt: now
      } as EnvHealthNonConformance;
      this.nonConformances[existingIndex] = updated;
      this.saveAll();

      // Synchronize with پایگاه داده non_conformances table
      apiDb.updateNonConformance(updated.trackingCode, {
        title: updated.title,
        sourceModule: 'health_env',
        sourceRecordId: updated.id,
        category: updated.category,
        description: updated.description,
        riskLevel: updated.severity?.includes('بحرانی') ? 'CRITICAL' : updated.severity?.includes('بالا') ? 'HIGH' : updated.severity?.includes('پایین') ? 'LOW' : 'MEDIUM',
        unitName: updated.department || updated.location,
        rootCause: updated.rootCause,
        correctiveAction: updated.correctiveAction,
        status: updated.status?.includes('بسته') ? 'CLOSED' : updated.status?.includes('اصلاحی') ? 'CAPA_DEFINED' : 'IN_PROGRESS'
      }).catch(() => {});

      addAuditLog(user, `ویرایش عدم انطباق ${updated.trackingCode}: ${updated.title}`, 'عدم انطباق');
      return updated;
    } else {
      const newNc: EnvHealthNonConformance = {
        id: `nc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        trackingCode: nc.trackingCode || `NC-HE-${1405}-${Math.floor(100 + Math.random() * 900)}`,
        title: nc.title || 'عدم انطباق بهداشت و محیط زیست',
        category: nc.category || 'محیط زیست',
        domain: nc.domain || 'environment',
        severity: nc.severity || 'متوسط (Medium)',
        location: nc.location || 'سایت صنعتی',
        department: nc.department || '',
        identifiedDate: nc.identifiedDate || '1405/04/01',
        identifiedBy: nc.identifiedBy || user,
        description: nc.description || '',
        rootCause: nc.rootCause,
        status: nc.status || 'باز (Open)',
        correctiveAction: nc.correctiveAction,
        createdAt: now,
        updatedAt: now
      };
      this.nonConformances.unshift(newNc);
      this.saveAll();

      // Synchronize with پایگاه داده non_conformances table
      apiDb.createNonConformance({
        trackingCode: newNc.trackingCode,
        title: newNc.title,
        sourceModule: 'health_env',
        sourceRecordId: newNc.id,
        sourceTitle: newNc.category,
        category: newNc.category,
        description: newNc.description,
        riskLevel: newNc.severity?.includes('بحرانی') ? 'CRITICAL' : newNc.severity?.includes('بالا') ? 'HIGH' : newNc.severity?.includes('پایین') ? 'LOW' : 'MEDIUM',
        unitName: newNc.department || newNc.location,
        rootCause: newNc.rootCause,
        correctiveAction: newNc.correctiveAction,
        status: 'REGISTERED'
      }).catch(() => {});

      addAuditLog(user, `ثبت عدم انطباق جدید با کد ${newNc.trackingCode}`, 'عدم انطباق');
      return newNc;
    }
  }

  public deleteNonConformance(id: string, user = 'admin'): boolean {
    const item = this.nonConformances.find(n => n.id === id);
    if (!item) return false;
    this.nonConformances = this.nonConformances.filter(n => n.id !== id);
    this.saveAll();
    apiDb.deleteNonConformance(item.trackingCode || item.id).catch(() => {});
    addAuditLog(user, `حذف عدم انطباق ${item.trackingCode}`, 'عدم انطباق');
    return true;
  }

  // ==========================================
  // 9. DYNAMIC YEARS CALCULATION & AUTO-DISCOVERY
  // ==========================================
  /**
   * Get all unique exam years dynamically from actual periodic medical exams.
   * Sorts numerically in ASCENDING order (e.g. 1402 -> 1403 -> 1404 -> 1405 -> 1406...)
   */
  public getAvailableExamYears(): number[] {
    const yearsSet = new Set<number>();
    
    // Extract strictly from real recorded periodic exams
    this.periodicExams.forEach(e => {
      const yr = Number(e.examYear) || extractShamsiYear(e.examDate);
      if (yr && yr >= 1300 && yr <= 1500) {
        yearsSet.add(yr);
      }
    });

    // Also check localStorage for any dynamically added exams
    try {
      const localExams = localStorage.getItem(STORAGE_KEYS.EXAMS);
      if (localExams) {
        const parsed = JSON.parse(localExams);
        if (Array.isArray(parsed)) {
          parsed.forEach((e: PeriodicMedicalExam) => {
            const yr = Number(e.examYear) || extractShamsiYear(e.examDate);
            if (yr && yr >= 1300 && yr <= 1500) {
              yearsSet.add(yr);
            }
          });
        }
      }
    } catch (_) {}

    // Return numerically sorted in ASCENDING order
    return Array.from(yearsSet).sort((a, b) => a - b);
  }

  /**
   * Get the latest recorded exam year (e.g. highest year that actually has records)
   */
  public getLatestExamYear(): number {
    const years = this.getAvailableExamYears();
    if (years.length > 0) {
      return years[years.length - 1]; // Last item in ascending list is the latest
    }
    return getCurrentShamsiYear();
  }

  /**
   * Get dynamic exam years summary with count and unique personnel count for each recorded year
   */
  public getExamYearsSummary(): { year: number; count: number; personnelCount: number }[] {
    const years = this.getAvailableExamYears();
    return years.map(year => {
      const matchingExams = this.periodicExams.filter(e => 
        Number(e.examYear) === year || extractShamsiYear(e.examDate) === year
      );
      const uniquePersonnel = new Set(matchingExams.map(e => e.employeeCode || e.recordId).filter(Boolean));
      return {
        year,
        count: matchingExams.length,
        personnelCount: uniquePersonnel.size || matchingExams.length
      };
    });
  }

  public getAvailableMonitoringYears(): number[] {
    const yearsSet = new Set<number>();

    // 1. From Environmental Monitoring (CEMS, Stacks, Water, Soil, Noise)
    this.envMonitoring.forEach(m => {
      const y = extractShamsiYear(m.date);
      if (y) yearsSet.add(y);
    });

    // 2. From Waste Records
    this.wasteRecords.forEach(w => {
      const y = extractShamsiYear(w.productionDate) || extractShamsiYear(w.createdAt);
      if (y) yearsSet.add(y);
    });

    // 3. From Wastewater Records
    this.wastewaterRecords.forEach(ww => {
      const y = extractShamsiYear(ww.date) || extractShamsiYear(ww.createdAt);
      if (y) yearsSet.add(y);
    });

    // 4. From Air Quality Records
    this.airQualityRecords.forEach(a => {
      const y = extractShamsiYear(a.date) || extractShamsiYear(a.lastUpdated);
      if (y) yearsSet.add(y);
    });

    // 5. From Non-Conformances
    this.nonConformances.forEach(nc => {
      const y = extractShamsiYear(nc.identifiedDate) || extractShamsiYear(nc.createdAt);
      if (y) yearsSet.add(y);
    });

    if (yearsSet.size === 0) {
      yearsSet.add(getCurrentShamsiYear());
    }

    return Array.from(yearsSet).sort((a, b) => a - b);
  }

  public getLatestMonitoringYear(): number {
    const years = this.getAvailableMonitoringYears();
    return years.length > 0 ? years[years.length - 1] : getCurrentShamsiYear();
  }

  public getPersonnelExamYears(employeeCode: string): number[] {
    const pCode = String(employeeCode).trim().toLowerCase();
    const years = new Set<number>();
    this.periodicExams.forEach(e => {
      if (String(e.employeeCode).trim().toLowerCase() === pCode && e.examYear) {
        years.add(Number(e.examYear));
      }
    });
    return Array.from(years).sort((a, b) => a - b);
  }

  // ==========================================
  // 10. HIGH-LEVEL KPI CALCULATIONS
  // ==========================================
  public getUnifiedKpis(selectedYear?: number, selectedMonitoringYear?: number) {
    const activeExamYear = selectedYear !== undefined ? selectedYear : this.getLatestExamYear();
    const activeMonYear = selectedMonitoringYear !== undefined ? selectedMonitoringYear : this.getLatestMonitoringYear();

    const cacheKey = `kpi_${activeExamYear}_${activeMonYear}`;
    if (this.kpisCache.has(cacheKey)) {
      return this.kpisCache.get(cacheKey);
    }

    const allPersonnel = getComplexPersonnelList();
    const totalPersonnelCount = allPersonnel.length || this.records.length || 0;
    const totalHealthRecordsCount = this.records.length;
    const incompleteRecordsCount = this.records.filter(r => !r.isComplete).length;

    // Periodic Exams for selected Year
    const yearExams = this.periodicExams.filter(e => e.examYear === activeExamYear);
    const completedExamsCount = yearExams.filter(e => e.status === 'fit' || e.status === 'fit_with_limitations').length;
    const underReviewCount = yearExams.filter(e => e.status === 'under_review' || e.status === 'needs_specialist').length;
    const overdueExamsCount = Math.max(0, totalPersonnelCount - yearExams.length);
    const nonPeriodicExamsCount = this.nonPeriodicExams.length;

    const coveragePercentage = totalPersonnelCount > 0 
      ? Math.round((yearExams.length / totalPersonnelCount) * 100) 
      : 0;

    // Fitness Distribution
    const fitCount = yearExams.filter(e => e.status === 'fit').length;
    const fitWithLimitationCount = yearExams.filter(e => e.status === 'fit_with_limitations').length;
    const needsSpecialistCount = yearExams.filter(e => e.status === 'needs_specialist').length;
    const unfitCount = yearExams.filter(e => e.status === 'unfit').length;

    // Environmental KPIs (Optionally filtered for monitoring year or overall active surveillance)
    const yearMonitoring = this.envMonitoring.filter(m => {
      if (!activeMonYear) return true;
      const y = extractShamsiYear(m.date);
      return !y || y === activeMonYear;
    });

    const totalMonitoringCount = this.envMonitoring.length;
    const activeYearMonitoringCount = yearMonitoring.length;
    const compliantMonitoringCount = this.envMonitoring.filter(m => m.complianceStatus === 'compliant').length;
    const nonCompliantMonitoringCount = this.envMonitoring.filter(m => m.complianceStatus === 'non_compliant').length;
    const envComplianceRate = totalMonitoringCount > 0 
      ? Math.round((compliantMonitoringCount / totalMonitoringCount) * 100) 
      : 0;

    // Waste KPIs
    const totalWasteQty = this.wasteRecords.reduce((acc, w) => acc + (w.quantity || 0), 0);
    const hazardousWasteQty = this.wasteRecords.filter(w => w.isHazardous).reduce((acc, w) => acc + (w.quantity || 0), 0);
    const recycledWasteQty = this.wasteRecords.filter(w => w.category === 'پسماند قابل بازیافت').reduce((acc, w) => acc + (w.quantity || 0), 0);
    const wasteRecoveryRate = totalWasteQty > 0 ? Math.round((recycledWasteQty / totalWasteQty) * 100) : 0;

    // Non-Conformances & CAPA
    const totalNc = this.nonConformances.length;
    const openNc = this.nonConformances.filter(n => n.status === 'باز (Open)' || n.status === 'در حال بررسی').length;
    const inProgressCapa = this.nonConformances.filter(n => n.status === 'اقدام اصلاحی تعریف‌شده').length;
    const closedNc = this.nonConformances.filter(n => n.status === 'بسته شده (Closed)').length;
    const criticalNc = this.nonConformances.filter(n => n.severity === 'بحرانی (Critical)' && n.status !== 'بسته شده (Closed)').length;

    // Multi-year comparison summary
    const availableExamYears = this.getAvailableExamYears();
    const availableMonitoringYears = this.getAvailableMonitoringYears();

    const result = {
      activeExamYear,
      activeMonYear,
      availableExamYears,
      availableMonitoringYears,
      // Health
      totalPersonnelCount,
      totalHealthRecordsCount,
      incompleteRecordsCount,
      periodicExamsTotal: yearExams.length,
      completedExamsCount,
      underReviewCount,
      overdueExamsCount,
      nonPeriodicExamsCount,
      coveragePercentage,
      fitness: {
        fit: fitCount,
        fitWithLimitations: fitWithLimitationCount,
        needsSpecialist: needsSpecialistCount,
        unfit: unfitCount
      },
      // Environment
      totalMonitoringCount,
      activeYearMonitoringCount,
      compliantMonitoringCount,
      nonCompliantMonitoringCount,
      envComplianceRate,
      totalWasteQty: Number(totalWasteQty.toFixed(1)),
      hazardousWasteQty: Number(hazardousWasteQty.toFixed(1)),
      recycledWasteQty: Number(recycledWasteQty.toFixed(1)),
      wasteRecoveryRate,
      // CAPA
      totalNc,
      openNc,
      inProgressCapa,
      closedNc,
      criticalNc
    };

    this.kpisCache.set(cacheKey, result);
    return result;
  }
}

export const healthEnvService = new HealthEnvService();
