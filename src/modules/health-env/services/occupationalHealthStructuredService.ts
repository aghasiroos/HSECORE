import { 
  MedicalTestCatalogItem, 
  MedicalItemCategory, 
  MedicalTestResultRecord, 
  StructuredOccupationalExamSession, 
  DynamicReferenceRule, 
  MedicalResultStatus,
  StructuredExamType,
  OccupationalFitnessDecision
} from '../types';
import { getComplexPersonnelList } from '../../../utils/personnelHelper';
import { addAuditLog } from '../../../utils/authHelper';
import { apiDb, getAuthToken } from '../../../services/apiDatabaseClient';

const INITIAL_MEDICAL_ITEMS_CATALOG: MedicalTestCatalogItem[] = [];

const STORAGE_KEYS = {
  CATALOG: 'hse_occ_health_catalog_v2',
  REFERENCES: 'hse_occ_health_references_v2',
  EXAM_SESSIONS: 'hse_occ_exam_sessions_v2',
  TEST_RESULTS: 'hse_occ_test_results_v2'
};

// Built-in Dynamic Reference Rules (Specific by Gender & Age)
const INITIAL_REFERENCE_RULES: DynamicReferenceRule[] = [
  // FBS
  {
    id: 'ref_fbs_general',
    testCode: 'FBS',
    testName: 'FBS (قند خون ناشتا)',
    gender: 'همه',
    refLow: 70,
    refHigh: 100,
    criticalLow: 50,
    criticalHigh: 250,
    unit: 'mg/dL',
    refSource: 'ADA Standards 2024',
    description: 'قند خون ناشتای نرمال در بزرگسالان',
    updatedAt: '1404/01/15'
  },
  // Hemoglobin - Male vs Female
  {
    id: 'ref_hb_male',
    testCode: 'HB',
    testName: 'Hb (هموگلوبین آقایان)',
    gender: 'مرد',
    refLow: 13.5,
    refHigh: 17.5,
    criticalLow: 8.0,
    criticalHigh: 20.0,
    unit: 'g/dL',
    refSource: 'WHO Anemia Criteria',
    description: 'محدوده استاندارد هموگلوبین برای آقایان',
    updatedAt: '1404/01/15'
  },
  {
    id: 'ref_hb_female',
    testCode: 'HB',
    testName: 'Hb (هموگلوبین بانوان)',
    gender: 'زن',
    refLow: 12.0,
    refHigh: 15.5,
    criticalLow: 7.5,
    criticalHigh: 18.0,
    unit: 'g/dL',
    refSource: 'WHO Anemia Criteria',
    description: 'محدوده استاندارد هموگلوبین برای بانوان',
    updatedAt: '1404/01/15'
  },
  // Blood Pressure Systolic
  {
    id: 'ref_bp_sys',
    testCode: 'BP_SYS',
    testName: 'فشار خون سیستولیک',
    gender: 'همه',
    refLow: 90,
    refHigh: 120,
    criticalLow: 80,
    criticalHigh: 160,
    unit: 'mmHg',
    refSource: 'AHA 2024',
    description: 'فشار سیستولیک بهینه',
    updatedAt: '1404/01/15'
  },
  // Blood Pressure Diastolic
  {
    id: 'ref_bp_dia',
    testCode: 'BP_DIA',
    testName: 'فشار خون دیاستولیک',
    gender: 'همه',
    refLow: 60,
    refHigh: 80,
    criticalLow: 50,
    criticalHigh: 100,
    unit: 'mmHg',
    refSource: 'AHA 2024',
    description: 'فشار دیاستولیک بهینه',
    updatedAt: '1404/01/15'
  },
  // BMI
  {
    id: 'ref_bmi',
    testCode: 'BMI',
    testName: 'شاخص توده بدنی (BMI)',
    gender: 'همه',
    refLow: 18.5,
    refHigh: 24.9,
    criticalLow: 18.5,
    criticalHigh: 35.0,
    unit: 'kg/m²',
    refSource: 'استاندارد جهانی WHO (کم‌وزن: <18.5 | نرمال: 18.5-24.9 | اضافه وزن: 25-29.9 | چاق: 30-34.9 | چاقی مفرط: >35)',
    description: 'محدوده بهینه و نرمال وزن. فرمول محاسبه: وزن(kg) / قد²(m). طبقات: کم‌وزن (<18.5)، نرمال (18.5-24.9)، اضافه وزن (25-29.9)، چاق (30-34.9)، چاقی مفرط (>35)',
    updatedAt: '1404/01/15'
  },
  // Blood Lead (BLL)
  {
    id: 'ref_lead',
    testCode: 'LEAD_BLOOD',
    testName: 'سرب خون (BLL)',
    gender: 'همه',
    refLow: 0,
    refHigh: 10.0,
    criticalHigh: 20.0,
    unit: 'µg/dL',
    refSource: 'ACGIH BEI Standard',
    description: 'حد مجاز مواجهه شغلی با سرب',
    updatedAt: '1404/01/15'
  },
  // Cholesterol
  {
    id: 'ref_chol',
    testCode: 'CHOLESTEROL',
    testName: 'کلسترول تام',
    gender: 'همه',
    refLow: 120,
    refHigh: 200,
    criticalHigh: 280,
    unit: 'mg/dL',
    refSource: 'NCEP ATP III',
    description: 'سطح مطلوب کلسترول خون',
    updatedAt: '1404/01/15'
  },
  // Triglyceride
  {
    id: 'ref_tg',
    testCode: 'TRIGLYCERIDE',
    testName: 'تری‌گلیسیرید',
    gender: 'همه',
    refLow: 50,
    refHigh: 150,
    criticalHigh: 500,
    unit: 'mg/dL',
    refSource: 'NCEP ATP III',
    description: 'سطح مطلوب تری‌گلیسیرید',
    updatedAt: '1404/01/15'
  },
  // FEV1/FVC
  {
    id: 'ref_fev1_fvc',
    testCode: 'FEV1_FVC',
    testName: 'نسبت FEV1/FVC اسپیرومتری',
    gender: 'همه',
    refLow: 70.0,
    refHigh: 100.0,
    criticalLow: 60.0,
    unit: '%',
    refSource: 'GOLD / ATS',
    description: 'شاخص سلامت راه هوایی',
    updatedAt: '1404/01/15'
  },
  // Audiometry 4000Hz
  {
    id: 'ref_audio_4000',
    testCode: 'AUDIO_R_4000',
    testName: 'ادیومتری 4000Hz',
    gender: 'همه',
    refLow: 0,
    refHigh: 25.0,
    criticalHigh: 55.0,
    unit: 'dB',
    refSource: 'OSHA / NIOSH',
    description: 'آستانه شنوایی در فرکانس حساس به نویز',
    updatedAt: '1404/01/15'
  }
];

class OccupationalHealthStructuredService {
  private catalog: MedicalTestCatalogItem[] = [];
  private referenceRules: DynamicReferenceRule[] = [];
  private examSessions: StructuredOccupationalExamSession[] = [];
  private testResults: MedicalTestResultRecord[] = [];
  private isReloading = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('app_data_mutated', () => this.reloadFromServer());
      window.addEventListener('hse_auth_state_changed', () => this.reloadFromServer());
    }
    this.reloadFromServer();
  }

  public reloadFromStorage = () => {
    void this.reloadFromServer();
  };

  public async reloadFromServer() {
    if (this.isReloading) return;
    if (!getAuthToken()) {
      if (this.referenceRules.length === 0) {
        this.referenceRules = [...INITIAL_REFERENCE_RULES];
      }
      return;
    }
    this.isReloading = true;
    try {
      const [catalogs, rules, sessions, results] = await Promise.all([
        apiDb.getMedicalTestCatalog(),
        apiDb.getMedicalReferenceRules(),
        apiDb.getMedicalExamSessions(),
        apiDb.getMedicalTestResults(),
      ]);

      if (Array.isArray(catalogs) && catalogs.length > 0) {
        this.catalog = catalogs;
      } else if (this.catalog.length === 0) {
        this.catalog = [...INITIAL_MEDICAL_ITEMS_CATALOG];
      }

      if (Array.isArray(rules) && rules.length > 0) {
        this.referenceRules = rules;
      } else if (this.referenceRules.length === 0) {
        this.referenceRules = [...INITIAL_REFERENCE_RULES];
      }

      if (Array.isArray(sessions)) {
        this.examSessions = sessions;
      }

      if (Array.isArray(results)) {
        this.testResults = results;
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hse_occ_health_updated'));
      }
    } catch (e: any) {
      if (e?.status !== 401 && e?.status !== 403) {
        console.error('Failed to reload OccHealthService from server:', e);
      }
    } finally {
      this.isReloading = false;
    }
  }

  private initData() {
    this.catalog = [...INITIAL_MEDICAL_ITEMS_CATALOG];
    this.referenceRules = [...INITIAL_REFERENCE_RULES];
    this.examSessions = [];
    this.testResults = [];
    void this.reloadFromServer();
  }

  public saveData() {
    try {
      // Authoritatively persist to PostgreSQL central database
      apiDb.saveSystemSetting(STORAGE_KEYS.CATALOG, this.catalog).catch(console.error);
      apiDb.saveSystemSetting(STORAGE_KEYS.REFERENCES, this.referenceRules).catch(console.error);
      apiDb.saveSystemSetting(STORAGE_KEYS.EXAM_SESSIONS, this.examSessions).catch(console.error);
      apiDb.saveSystemSetting(STORAGE_KEYS.TEST_RESULTS, this.testResults).catch(console.error);
    } catch (_) {}
  }

  private notifyChanges(detail: any = {}) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_medical_data_updated', { detail }));
      window.dispatchEvent(new CustomEvent('hse_occ_health_data_updated', { detail }));
      window.dispatchEvent(new CustomEvent('hse_health_env_updated', { detail }));
    }
  }

  // ================= CATALOG MANAGEMENT =================
  public getCatalog(): MedicalTestCatalogItem[] {
    return [...this.catalog].sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
  }

  public getCatalogByCategory(category: MedicalItemCategory): MedicalTestCatalogItem[] {
    return this.catalog.filter(item => item.category === category).sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99));
  }

  public getItemByCode(code: string): MedicalTestCatalogItem | undefined {
    return this.catalog.find(i => i.code.toUpperCase() === code.toUpperCase());
  }

  public addCatalogItem(item: Omit<MedicalTestCatalogItem, 'id'>, currentUser?: any): MedicalTestCatalogItem {
    const newItem: MedicalTestCatalogItem = {
      ...item,
      id: `custom_item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      isCustom: true
    };
    this.catalog.push(newItem);
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `افزودن آیتم آزمایشی جدید «${newItem.name}» (کد: ${newItem.code}) به کاتالوگ طب کار`,
      'مدیریت کاتالوگ طب کار'
    );
    this.notifyChanges({ action: 'catalog_item_added', item: newItem });
    return newItem;
  }

  public updateCatalogItem(id: string, updates: Partial<MedicalTestCatalogItem>, currentUser?: any): boolean {
    const idx = this.catalog.findIndex(i => i.id === id);
    if (idx === -1) return false;
    const oldName = this.catalog[idx].name;
    this.catalog[idx] = { ...this.catalog[idx], ...updates };
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `ویرایش مشخصات آیتم «${this.catalog[idx].name || oldName}» در کاتالوگ طب کار`,
      'مدیریت کاتالوگ طب کار'
    );
    this.notifyChanges({ action: 'catalog_item_updated', id });
    return true;
  }

  public deleteCatalogItem(id: string, currentUser?: any): boolean {
    const idx = this.catalog.findIndex(i => i.id === id);
    if (idx === -1) return false;
    const deletedItem = this.catalog[idx];
    this.catalog.splice(idx, 1);
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `حذف آیتم «${deletedItem.name}» (کد: ${deletedItem.code}) از کاتالوگ طب کار`,
      'مدیریت کاتالوگ طب کار'
    );
    this.notifyChanges({ action: 'catalog_item_deleted', id, code: deletedItem.code });
    return true;
  }

  public resetCatalogToStandard(currentUser?: any): void {
    this.catalog = [...INITIAL_MEDICAL_ITEMS_CATALOG];
    this.referenceRules = [...INITIAL_REFERENCE_RULES];
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      'بازنشانی کامل کاتالوگ آیتم‌های طب کار و قوانین مرجع به نسخه استاندارد و مصوب قانونی',
      'مدیریت کاتالوگ طب کار'
    );
    this.notifyChanges({ action: 'catalog_reset_to_standard' });
  }

  // ================= REFERENCE RANGE ENGINE =================
  public getReferenceRules(): DynamicReferenceRule[] {
    return [...this.referenceRules];
  }

  public addReferenceRule(rule: Omit<DynamicReferenceRule, 'id' | 'updatedAt'> & { updatedAt?: string }, currentUser?: any): DynamicReferenceRule {
    const newRule: DynamicReferenceRule = {
      ...rule,
      id: `ref_rule_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      updatedAt: rule.updatedAt || new Date().toLocaleDateString('fa-IR')
    };
    this.referenceRules.push(newRule);
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `افزودن قانون مرجع پویا برای آزمون «${newRule.testName}» (${newRule.gender})`,
      'مدیریت قوانین مرجع طب کار'
    );
    this.notifyChanges({ action: 'reference_rule_added', rule: newRule });
    return newRule;
  }

  public updateReferenceRule(id: string, updates: Partial<DynamicReferenceRule>, currentUser?: any): boolean {
    const idx = this.referenceRules.findIndex(r => r.id === id);
    if (idx === -1) return false;
    this.referenceRules[idx] = { 
      ...this.referenceRules[idx], 
      ...updates,
      updatedAt: new Date().toLocaleDateString('fa-IR')
    };
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `ویرایش قانون مرجع پویا «${this.referenceRules[idx].testName}»`,
      'مدیریت قوانین مرجع طب کار'
    );
    this.notifyChanges({ action: 'reference_rule_updated', id });
    return true;
  }

  public deleteReferenceRule(id: string, currentUser?: any): boolean {
    const idx = this.referenceRules.findIndex(r => r.id === id);
    if (idx === -1) return false;
    const deletedRule = this.referenceRules[idx];
    this.referenceRules.splice(idx, 1);
    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `حذف قانون مرجع آزمون «${deletedRule.testName}» (${deletedRule.gender})`,
      'مدیریت قوانین مرجع طب کار'
    );
    this.notifyChanges({ action: 'reference_rule_deleted', id });
    return true;
  }

  public findReferenceForTest(
    testCode: string, 
    gender: 'مرد' | 'زن' = 'مرد', 
    age?: number
  ): { refLow?: number; refHigh?: number; criticalLow?: number; criticalHigh?: number; unit?: string; refSource?: string } {
    const matchedRule = this.referenceRules.find(r => {
      if (r.testCode.toUpperCase() !== testCode.toUpperCase()) return false;
      if (r.gender !== 'همه' && r.gender !== gender) return false;
      if (age !== undefined) {
        if (r.minAge !== undefined && age < r.minAge) return false;
        if (r.maxAge !== undefined && age > r.maxAge) return false;
      }
      return true;
    });

    if (matchedRule) {
      return {
        refLow: matchedRule.refLow,
        refHigh: matchedRule.refHigh,
        criticalLow: matchedRule.criticalLow,
        criticalHigh: matchedRule.criticalHigh,
        unit: matchedRule.unit,
        refSource: matchedRule.refSource
      };
    }

    // Fallback to item definition default
    const catalogItem = this.getItemByCode(testCode);
    return {
      refLow: catalogItem?.defaultRefLow,
      refHigh: catalogItem?.defaultRefHigh,
      criticalLow: catalogItem?.criticalLow,
      criticalHigh: catalogItem?.criticalHigh,
      unit: catalogItem?.defaultUnit,
      refSource: catalogItem?.refSource || 'استاندارد ملی طب کار'
    };
  }

  public evaluateNumericResult(
    value: number,
    testCode: string,
    gender: 'مرد' | 'زن' = 'مرد',
    age?: number
  ): { status: MedicalResultStatus; refLow?: number; refHigh?: number; refSource?: string } {
    const ref = this.findReferenceForTest(testCode, gender, age);

    if (ref.criticalHigh !== undefined && value >= ref.criticalHigh) {
      return { status: 'Critical', ...ref };
    }
    if (ref.criticalLow !== undefined && value <= ref.criticalLow) {
      return { status: 'Critical', ...ref };
    }
    if (ref.refHigh !== undefined && value > ref.refHigh) {
      return { status: 'High', ...ref };
    }
    if (ref.refLow !== undefined && value < ref.refLow) {
      return { status: 'Low', ...ref };
    }
    if (ref.refLow !== undefined || ref.refHigh !== undefined) {
      return { status: 'Normal', ...ref };
    }

    return { status: 'Normal', ...ref };
  }

  public calculateBmi(heightCm: number, weightKg: number): number | undefined {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return undefined;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return Math.round(bmi * 10) / 10;
  }

  // ================= EXAM SESSIONS & RESULTS =================
  public getExamSessions(personnelCode?: string): StructuredOccupationalExamSession[] {
    if (!personnelCode) return [...this.examSessions].sort((a, b) => b.examYear - a.examYear);
    return this.examSessions
      .filter(s => s.personnelCode === personnelCode || (s.nationalCode && s.nationalCode === personnelCode))
      .sort((a, b) => b.examYear - a.examYear);
  }

  public getAllExamSessions(): StructuredOccupationalExamSession[] {
    return [...this.examSessions].sort((a, b) => b.examYear - a.examYear);
  }

  public getAllResults(): MedicalTestResultRecord[] {
    return [...this.testResults];
  }

  public getAvailableExamYears(): number[] {
    const years = new Set<number>();
    this.examSessions.forEach(s => {
      if (s.examYear) years.add(Number(s.examYear));
    });
    this.testResults.forEach(r => {
      if (r.examYear) years.add(Number(r.examYear));
    });
    return Array.from(years).sort((a, b) => b - a);
  }

  public deleteSessionsByIds(examIds: string[]): { deletedSessions: number; deletedResults: number } {
    if (!examIds || examIds.length === 0) return { deletedSessions: 0, deletedResults: 0 };
    const idSet = new Set(examIds);
    const initialSessionsCount = this.examSessions.length;
    const initialResultsCount = this.testResults.length;

    this.examSessions = this.examSessions.filter(s => !idSet.has(s.id));
    this.testResults = this.testResults.filter(r => !idSet.has(r.examId));

    const deletedSessions = initialSessionsCount - this.examSessions.length;
    const deletedResults = initialResultsCount - this.testResults.length;

    this.saveData();
    this.notifyChanges({ action: 'sessions_deleted', deletedSessions, deletedResults });

    return { deletedSessions, deletedResults };
  }

  public deleteSessionsByYear(year: number): { deletedSessions: number; deletedResults: number } {
    const targetYear = Number(year);
    const initialSessionsCount = this.examSessions.length;
    const initialResultsCount = this.testResults.length;

    this.examSessions = this.examSessions.filter(s => Number(s.examYear) !== targetYear);
    this.testResults = this.testResults.filter(r => Number(r.examYear) !== targetYear);

    const deletedSessions = initialSessionsCount - this.examSessions.length;
    const deletedResults = initialResultsCount - this.testResults.length;

    this.saveData();
    this.notifyChanges({ action: 'sessions_deleted_by_year', year: targetYear, deletedSessions, deletedResults });

    return { deletedSessions, deletedResults };
  }

  public getSessionById(id: string): StructuredOccupationalExamSession | undefined {
    return this.examSessions.find(s => s.id === id);
  }

  public getResultsForSession(examId: string): MedicalTestResultRecord[] {
    return this.testResults.filter(r => r.examId === examId);
  }

  public getResultsForEmployee(personnelCode: string, examYear?: number): MedicalTestResultRecord[] {
    return this.testResults.filter(r => {
      const matchCode = r.personnelCode === personnelCode || (r.nationalCode && r.nationalCode === personnelCode);
      if (!matchCode) return false;
      if (examYear !== undefined && Number(r.examYear) !== Number(examYear)) return false;
      return true;
    });
  }

  /**
   * Save or Update a complete structured examination session and all its independent item results.
   */
  public saveCompleteExamSession(
    sessionData: Omit<StructuredOccupationalExamSession, 'id' | 'createdAt'> & { id?: string },
    results: Array<Omit<MedicalTestResultRecord, 'id' | 'examId' | 'createdAt'> & { id?: string }>,
    currentUser?: any
  ): { success: boolean; examId: string; examYear?: number; savedResultsCount: number } {
    const examId = sessionData.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const nowTimestamp = new Date().toLocaleDateString('fa-IR');
    const adminUser = currentUser?.fullName || currentUser?.username || 'کاربر سامانه';

    // Calculate Abnormal and Critical counts
    let abnormalCount = 0;
    let criticalCount = 0;

    const preparedResults: MedicalTestResultRecord[] = results.map(r => {
      if (r.status === 'Critical') criticalCount++;
      else if (r.status === 'High' || r.status === 'Low' || r.status === 'Abnormal') abnormalCount++;

      return {
        ...r,
        id: r.id || `res_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        examId,
        recordId: sessionData.recordId,
        personnelCode: sessionData.personnelCode,
        personnelName: sessionData.personnelName,
        nationalCode: sessionData.nationalCode,
        examYear: sessionData.examYear,
        examDate: sessionData.examDate,
        examType: sessionData.examType,
        createdAt: (r as any).createdAt || nowTimestamp,
        createdBy: r.createdBy || adminUser,
        updatedAt: nowTimestamp,
        updatedBy: adminUser
      };
    });

    const fullSession: StructuredOccupationalExamSession = {
      ...sessionData,
      id: examId,
      resultsCount: preparedResults.length,
      abnormalCount,
      criticalCount,
      createdAt: sessionData.id ? (this.getSessionById(sessionData.id)?.createdAt || nowTimestamp) : nowTimestamp,
      createdBy: sessionData.id ? (this.getSessionById(sessionData.id)?.createdBy || adminUser) : adminUser,
      updatedAt: nowTimestamp,
      updatedBy: adminUser
    };

    // Remove old results for this session if updating
    this.testResults = this.testResults.filter(r => r.examId !== examId);
    this.testResults.push(...preparedResults);

    // Save session
    const existingIdx = this.examSessions.findIndex(s => s.id === examId);
    if (existingIdx >= 0) {
      this.examSessions[existingIdx] = fullSession;
    } else {
      this.examSessions.push(fullSession);
    }

    this.saveData();

    addAuditLog(
      currentUser?.username || 'admin',
      `ثبت و ذخیره پرونده معاینات طب کار ساختاریافته سال ${sessionData.examYear} برای «${sessionData.personnelName}» (کد: ${sessionData.personnelCode}) شامل ${preparedResults.length} نتیجه آیتم`,
      'ثبت معاینات طب کار ساختاریافته'
    );

    this.notifyChanges({
      action: 'structured_exam_saved',
      examId,
      personnelCode: sessionData.personnelCode,
      examYear: sessionData.examYear
    });

    return {
      success: true,
      examId,
      examYear: Number(sessionData.examYear),
      savedResultsCount: preparedResults.length
    };
  }

  // ================= MULTI-YEAR TREND COMPARISON =================
  /**
   * Retrieves all multi-year historical records for a specific employee and test code/item,
   * returning clean structured data ready for tables and Recharts.
   */
  public getMultiYearTrendForTest(
    personnelCode: string,
    testCodeOrName: string
  ): Array<{
    year: number;
    date: string;
    examType: string;
    valueDisplay: string;
    valueNumeric?: number;
    valueText?: string;
    unit?: string;
    refRangeDisplay: string;
    refLow?: number;
    refHigh?: number;
    status: MedicalResultStatus;
    doctorNotes?: string;
    doctor?: string;
  }> {
    const employeeResults = this.testResults.filter(r => {
      const matchCode = r.personnelCode === personnelCode || (r.nationalCode && r.nationalCode === personnelCode);
      if (!matchCode) return false;
      const matchTest = r.itemCode.toUpperCase() === testCodeOrName.toUpperCase() || 
                        r.itemName.toLowerCase() === testCodeOrName.toLowerCase();
      return matchTest;
    });

    return employeeResults
      .sort((a, b) => Number(a.examYear) - Number(b.examYear))
      .map(r => {
        let refDisplay = '-';
        if (r.refLow !== undefined && r.refHigh !== undefined) {
          refDisplay = `${r.refLow} – ${r.refHigh} ${r.unit || ''}`.trim();
        } else if (r.refText) {
          refDisplay = r.refText;
        }

        let valDisplay = '-';
        if (r.valueNumeric !== undefined) {
          valDisplay = `${r.valueNumeric} ${r.unit || ''}`.trim();
        } else if (r.valueText) {
          valDisplay = r.valueText;
        } else if (r.valueBoolean !== undefined) {
          valDisplay = r.valueBoolean ? 'دارد' : 'ندارد';
        }

        return {
          year: Number(r.examYear),
          date: r.examDate,
          examType: r.examType,
          valueDisplay: valDisplay,
          valueNumeric: r.valueNumeric,
          valueText: r.valueText,
          unit: r.unit,
          refRangeDisplay: refDisplay,
          refLow: r.refLow,
          refHigh: r.refHigh,
          status: r.status,
          doctorNotes: r.doctorNotes
        };
      });
  }

  /**
   * Retrieves list of all recorded tests for an employee across all their years.
   */
  public getDistinctTestsForEmployee(personnelCode: string): Array<{ code: string; name: string; category: MedicalItemCategory; count: number; dataType: string }> {
    const results = this.getResultsForEmployee(personnelCode);
    const map = new Map<string, { code: string; name: string; category: MedicalItemCategory; count: number; dataType: string }>();

    results.forEach(r => {
      const key = r.itemCode.toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          code: r.itemCode,
          name: r.itemName,
          category: r.category,
          count: 1,
          dataType: r.dataType
        });
      } else {
        const entry = map.get(key)!;
        entry.count++;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }
}

export const occupationalHealthStructuredService = new OccupationalHealthStructuredService();
