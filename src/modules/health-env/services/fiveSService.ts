import { 
  FiveSInspection, 
  FiveSChecklistItem, 
  FiveSNonConformance, 
  FiveSCorrectiveAction, 
  FiveSSchedule, 
  FiveSUnitRanking, 
  FiveSPillarDef, 
  FiveSPillarKey,
  FiveSItemStatus,
  FiveSPhoto
} from '../types';
import { addAuditLog } from '../../../utils/authHelper';
import { calculateNextInspectionDate, normalizeInspectionType } from '../../../utils/inspectionScheduleHelper';
import { apiDb } from '../../../services/apiDatabaseClient';
import { getShamsiToday } from '../../../utils/jalaliDate';

const STORAGE_KEYS = {
  INSPECTIONS: 'hse_5s_inspections_v3',
  NON_CONFORMANCES: 'hse_5s_nc_v3',
  SCHEDULES: 'hse_5s_schedules_v3'
};

export const FIVE_S_PILLARS: FiveSPillarDef[] = [
  {
    key: 'seiri',
    number: 1,
    titleFa: 'ساماندهی و تفکیک',
    titleEn: 'Seiri (Sort)',
    persianName: 'تفکیک و پاک‌سازی اقلام غیرضروری',
    description: 'تشخیص اقلام ضروری از غیرضروری و حذف موارد زائد از محیط کار',
    color: 'from-blue-600 to-indigo-700'
  },
  {
    key: 'seiton',
    number: 2,
    titleFa: 'نظم و چیدمان',
    titleEn: 'Seiton (Set in Order)',
    persianName: 'ترتیب و جانمایی استاندارد',
    description: 'استقرار هر چیز در جای مناسب خود با دسترسی آسان و نشانه‌گذاری واضح',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    key: 'seiso',
    number: 3,
    titleFa: 'پاکیزه‌سازی و شستشو',
    titleEn: 'Seiso (Shine)',
    persianName: 'پاکیزگی محیط و تجهیزات',
    description: 'تمیزکاری همه‌جانبه، بازرسی تجهیزات حین نظافت و شناسایی منابع آلودگی',
    color: 'from-emerald-500 to-teal-600'
  },
  {
    key: 'seiketsu',
    number: 4,
    titleFa: 'استانداردسازی و تثبیت',
    titleEn: 'Seiketsu (Standardize)',
    persianName: 'تدوین استانداردها و علائم',
    description: 'تعریف شفاف دستورالعمل‌ها، چک‌لیست‌ها و تابلوهای استاندارد برای تداوم ۳ اصل نخست',
    color: 'from-purple-500 to-indigo-600'
  },
  {
    key: 'shitsuke',
    number: 5,
    titleFa: 'انضباط و فرهنگ‌سازی',
    titleEn: 'Shitsuke (Sustain)',
    persianName: 'انضباط‌مندی و تعهد خودجوش',
    description: 'آموزش مستمر، تعهد کاری، ممیزی‌های دوره‌ای و حفظ همیشگی فرهنگ 5S',
    color: 'from-rose-500 to-pink-600'
  }
];

export const DEFAULT_CHECKLIST_TEMPLATE: Array<{
  pillar: FiveSPillarKey;
  itemNumber: number;
  title: string;
  description: string;
}> = [
  // 1. SEIRI (Sort / تفکیک)
  {
    pillar: 'seiri',
    itemNumber: 1,
    title: 'حذف اقلام و ادوات غیرضروری',
    description: 'عدم وجود ابزارها، تجهیزات، کابل‌ها، کارتن‌ها و وسایل اسقاطی یا بی‌استفاده در محیط کار'
  },
  {
    pillar: 'seiri',
    itemNumber: 2,
    title: 'جداسازی و انتقال تجهیزات معیوب',
    description: 'تفکیک تجهیزات نیازمند تعمیر یا اسقاط و الصاق تگ قرمز (Red Tag) و انتقال به محل مناسب'
  },
  {
    pillar: 'seiri',
    itemNumber: 3,
    title: 'تعیین تکلیف اسناد و اقلام اضافی',
    description: 'پاک‌سازی میزها، فایل‌ها، پالت‌ها و عدم نگهداری لوازم‌التحریر یا قطعات یدکی مازاد بر مصرف روزانه'
  },
  {
    pillar: 'seiri',
    itemNumber: 4,
    title: 'کنترل مواد و حلال‌های شیمیایی',
    description: 'عدم نگهداری مواد شیمیایی، رنگ‌ها و روغن‌های مازاد در ایستگاه‌های فرآیندی'
  },
  {
    pillar: 'seiri',
    itemNumber: 5,
    title: 'وضوح اقلام مورد نیاز جاری',
    description: 'فقط اقلام و تجهیزات دارای مصرف فعال و کاربردی در محیط کاری حضور دارند'
  },

  // 2. SEITON (Set in Order / نظم)
  {
    pillar: 'seiton',
    itemNumber: 6,
    title: 'محل مشخص ابزار و تجهیزات (Shadow Board)',
    description: 'وجود محل استقرار معین و نشانه‌گذاری شده برای کلیه ابزارآلات و ادوات پرتابل'
  },
  {
    pillar: 'seiton',
    itemNumber: 7,
    title: 'جانمایی صحیح و دسترسی ارگونومیک',
    description: 'چیدمان منطقی قطعات بر اساس اولویت و توالی مصرف، با دسترسی سریع و بدون اتلاف زمان'
  },
  {
    pillar: 'seiton',
    itemNumber: 8,
    title: 'برچسب‌گذاری و تابلوهای شناسایی',
    description: 'الصاق لیبل و مشخصات واضح روی قفسه‌ها، کمدها، لوله‌ها، ولوها و مخازن'
  },
  {
    pillar: 'seiton',
    itemNumber: 9,
    title: 'کدگذاری قطعات و کابل‌ها',
    description: 'کدگذاری سیم‌کشی‌ها، شیلنگ‌های باد/آب/گاز و سیستم‌های ابزار دقیق'
  },
  {
    pillar: 'seiton',
    itemNumber: 10,
    title: 'مشخص بودن معابر و راهروهای تردد',
    description: 'خط‌کشی زرد/سفید کف سالن، مشخص بودن مسیر تردد لیفتراک، پرسنل و خروجی‌های اضطراری'
  },

  // 3. SEISO (Shine / پاکیزگی)
  {
    pillar: 'seiso',
    itemNumber: 11,
    title: 'نظافت محیط عمومی و کف سالن',
    description: 'پاکیزگی کامل کف، دیوارها، پنجره‌ها، سقف و عدم تجمع گرد و غبار یا ضایعات'
  },
  {
    pillar: 'seiso',
    itemNumber: 12,
    title: 'نظافت ماشین‌آلات و تجهیزات فرآیندی',
    description: 'پاکیزگی پمپ‌ها، کمپرسورها، الکتروموتورها، تابلوهای برق و پنل‌های مانیتورینگ'
  },
  {
    pillar: 'seiso',
    itemNumber: 13,
    title: 'عدم وجود نشتی و منابع آلودگی',
    description: 'عدم نشت روغن هیدرولیک، گریس، آب صنعتی، بخار یا مواد هیدروکربنی و مهار منشأ نشتی'
  },
  {
    pillar: 'seiso',
    itemNumber: 14,
    title: 'جمع‌آوری و تفکیک پسماند و ضایعات',
    description: 'استفاده از سطل‌های تفکیک زباله با درب بسته، تخلیه به موقع و عدم ریزش ضایعات'
  },
  {
    pillar: 'seiso',
    itemNumber: 15,
    title: 'آمادگی و نظافت تجهیزات ایمنی و اطفا',
    description: 'پاکیزگی و دسترسی بدون مانع به کپسول‌های آتش‌نشانی، جعبه‌های کمک اولیه و دوش‌های اضطراری'
  },

  // 4. SEIKETSU (Standardize / استانداردسازی)
  {
    pillar: 'seiketsu',
    itemNumber: 16,
    title: 'نصب دستورالعمل‌ها و استانداردهای 5S',
    description: 'وجود راهنماهای بصری، استانداردهای نظافت و رنگ‌بندی مصوب در تابلوهای اعلانات واحد'
  },
  {
    pillar: 'seiketsu',
    itemNumber: 17,
    title: 'علائم هشداردهنده و ایمنی استاندارد',
    description: 'نصب تابلوهای هشدار خطر، الزامات تجهیزات حفاظت فردی (PPE) و مسیرهای ایمن'
  },
  {
    pillar: 'seiketsu',
    itemNumber: 18,
    title: 'چک‌لیست‌ها و برنامه‌های زمان‌بندی نظافت',
    description: 'وجود برنامه مدون نظافت روزانه و هفتگی با امضای متصدیان مربوطه'
  },
  {
    pillar: 'seiketsu',
    itemNumber: 19,
    title: 'شفافیت مسئولیت‌ها (Zone Ownership)',
    description: 'تقسیم‌بندی محیط کار به زون‌های مشخص و الصاق نام مسئول نگهداری هر زون'
  },
  {
    pillar: 'seiketsu',
    itemNumber: 20,
    title: 'ثبت و مستندسازی منظم ممیزی‌ها',
    description: 'بایگانی گزارش‌های ممیزی 5S و پیگیری رفع نواقص به صورت مدون'
  },

  // 5. SHITSUKE (Sustain / انضباط)
  {
    pillar: 'shitsuke',
    itemNumber: 21,
    title: 'رعایت مستمر و خودجوش کارکنان',
    description: 'پایبندی خودکار پرسنل به استانداردهای 5S بدون نیاز به تذکر مداوم و حفظ نظم فردی'
  },
  {
    pillar: 'shitsuke',
    itemNumber: 22,
    title: 'آموزش‌های مداوم و جلسات جعبه‌ابزار (TBT)',
    description: 'برگزاری دوره‌های بازآموزی 5S و انتقال مفاهیم به نیروهای جدیدالورود'
  },
  {
    pillar: 'shitsuke',
    itemNumber: 23,
    title: 'مشارکت فعال در نظام پیشنهادات (Kaizen)',
    description: 'ارائه طرح‌های بهبود، خلاقیت در سازماندهی و همکاری در کایزن‌های سریع'
  },
  {
    pillar: 'shitsuke',
    itemNumber: 24,
    title: 'پیگیری و بستن اقدامات اصلاحی (CAPA)',
    description: 'سرعت عمل در برطرف کردن عدم انطباق‌های ممیزی قبل و عدم تکرار آنها'
  },
  {
    pillar: 'shitsuke',
    itemNumber: 25,
    title: 'استفاده صحیح از تجهیزات حفاظت فردی (PPE)',
    description: 'استفاده دائمی از کلاه، عینک، کفش ایمنی، ماسک و دستکش متناسب با وظایف محوله'
  }
];

class FiveSService {
  private inspections: FiveSInspection[] = [];
  private nonConformances: FiveSNonConformance[] = [];
  private schedules: FiveSSchedule[] = [];
  private isReloading = false;

  constructor() {
    this.initData();
    if (typeof window !== 'undefined') {
      const handleRemote = (e: any) => {
        const entity = String(e?.detail?.key || e?.detail?.data?.key || e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
        if (!entity || entity.includes('5s') || entity.includes('fives') || entity === 'settings') {
          this.reloadFromServer();
        }
      };
      window.addEventListener('app_data_mutated', handleRemote);
      window.addEventListener('hse_data_mutated', handleRemote);
      setTimeout(() => this.reloadFromServer(), 100);
    }
  }

  public async reloadFromServer() {
    if (this.isReloading) return;
    this.isReloading = true;
    try {
      const [dbIns, dbNc, dbSch] = await Promise.all([
        apiDb.getFiveSInspections(),
        apiDb.getFiveSNonConformances(),
        apiDb.getFiveSSchedules(),
      ]);

      let hasUpdate = false;

      if (Array.isArray(dbIns)) {
        this.inspections = dbIns;
        try { localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(dbIns)); } catch {}
        hasUpdate = true;
      }

      if (Array.isArray(dbNc)) {
        this.nonConformances = dbNc;
        try { localStorage.setItem(STORAGE_KEYS.NON_CONFORMANCES, JSON.stringify(dbNc)); } catch {}
        hasUpdate = true;
      }

      if (Array.isArray(dbSch)) {
        this.schedules = dbSch;
        try { localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(dbSch)); } catch {}
        hasUpdate = true;
      }

      if (hasUpdate && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_5s_data_updated'));
      }
    } catch (err) {
      console.warn('[5S] Failed to sync data with database:', err);
    } finally {
      this.isReloading = false;
    }
  }

  private initData() {
    // Clear older versions of 5S keys
    [
      'hse_5s_inspections_v1', 'hse_5s_inspections_v2',
      'hse_5s_nc_v1', 'hse_5s_nc_v2',
      'hse_5s_schedules_v1', 'hse_5s_schedules_v2'
    ].forEach(k => {
      try { localStorage.removeItem(k); } catch (_) {}
    });

    try {
      const ins = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
      if (ins) {
        const parsed = JSON.parse(ins);
        if (Array.isArray(parsed)) this.inspections = parsed;
      }
    } catch {
      this.inspections = [];
    }

    try {
      const nc = localStorage.getItem(STORAGE_KEYS.NON_CONFORMANCES);
      if (nc) {
        const parsed = JSON.parse(nc);
        if (Array.isArray(parsed)) this.nonConformances = parsed;
      }
    } catch {
      this.nonConformances = [];
    }

    try {
      const sch = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      if (sch) {
        const parsed = JSON.parse(sch);
        if (Array.isArray(parsed)) this.schedules = parsed;
      }
    } catch {
      this.schedules = [];
    }
  }

  public reset5SData() {
    this.inspections = [];
    this.nonConformances = [];
    this.schedules = [];
    this.saveAll();
  }

  private seedInitialData() {
    this.inspections = [];
    this.nonConformances = [];
    this.schedules = [];
  }

  private saveAll() {
    try {
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(this.inspections));
      localStorage.setItem(STORAGE_KEYS.NON_CONFORMANCES, JSON.stringify(this.nonConformances));
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(this.schedules));
    } catch (e) {
      console.error('Error saving 5S data to localStorage:', e);
    }
    apiDb.saveFiveSInspections(this.inspections).catch(console.error);
    apiDb.saveFiveSNonConformances(this.nonConformances).catch(console.error);
    apiDb.saveFiveSSchedules(this.schedules).catch(console.error);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hse_5s_data_updated'));
    }
  }

  // Create default checklist for a new inspection
  public createEmptyChecklist(): FiveSChecklistItem[] {
    return DEFAULT_CHECKLIST_TEMPLATE.map((tpl, idx) => ({
      id: `5s-item-${tpl.pillar}-${tpl.itemNumber}-${Date.now()}-${idx}`,
      pillar: tpl.pillar,
      itemNumber: tpl.itemNumber,
      title: tpl.title,
      description: tpl.description,
      status: 'fully_compliant',
      score: 100,
      weight: 1,
      remarks: '',
      photos: [],
      hasNonConformance: false
    }));
  }

  // Calculate scores for an inspection items array
  public calculateInspectionScores(items: FiveSChecklistItem[]): {
    seiri: number;
    seiton: number;
    seiso: number;
    seiketsu: number;
    shitsuke: number;
    total: number;
    generalRating: 'عالی' | 'خوب' | 'قابل قبول' | 'نیازمند بهبود' | 'ضعیف';
  } {
    const pillarScores: Record<FiveSPillarKey, { sumScore: number; count: number }> = {
      seiri: { sumScore: 0, count: 0 },
      seiton: { sumScore: 0, count: 0 },
      seiso: { sumScore: 0, count: 0 },
      seiketsu: { sumScore: 0, count: 0 },
      shitsuke: { sumScore: 0, count: 0 }
    };

    items.forEach(item => {
      let itemScore = 100;
      if (item.status === 'fully_compliant') itemScore = 100;
      else if (item.status === 'compliant') itemScore = 75;
      else if (item.status === 'needs_improvement') itemScore = 50;
      else if (item.status === 'non_compliant') itemScore = 0;
      else if (item.status === 'not_applicable') return; // skip

      if (pillarScores[item.pillar]) {
        pillarScores[item.pillar].sumScore += itemScore;
        pillarScores[item.pillar].count += 1;
      }
    });

    const calcPillar = (key: FiveSPillarKey): number => {
      const p = pillarScores[key];
      return p.count > 0 ? Math.round(p.sumScore / p.count) : 100;
    };

    const seiri = calcPillar('seiri');
    const seiton = calcPillar('seiton');
    const seiso = calcPillar('seiso');
    const seiketsu = calcPillar('seiketsu');
    const shitsuke = calcPillar('shitsuke');

    const total = Math.round((seiri + seiton + seiso + seiketsu + shitsuke) / 5);

    let generalRating: 'عالی' | 'خوب' | 'قابل قبول' | 'نیازمند بهبود' | 'ضعیف' = 'قابل قبول';
    if (total >= 90) generalRating = 'عالی';
    else if (total >= 80) generalRating = 'خوب';
    else if (total >= 70) generalRating = 'قابل قبول';
    else if (total >= 50) generalRating = 'نیازمند بهبود';
    else generalRating = 'ضعیف';

    return { seiri, seiton, seiso, seiketsu, shitsuke, total, generalRating };
  }

  // ==========================================
  // 1. INSPECTIONS CRUD
  // ==========================================
  public getAllInspections(): FiveSInspection[] {
    return [...this.inspections].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  public getInspectionById(id: string): FiveSInspection | undefined {
    return this.inspections.find(i => i.id === id);
  }

  public saveInspection(inspectionData: Partial<FiveSInspection>, user = 'کاربر سیستم'): FiveSInspection {
    const isNew = !inspectionData.id || !this.inspections.some(i => i.id === inspectionData.id);
    const now = new Date().toISOString();
    const today = getShamsiToday();

    const items = inspectionData.items && inspectionData.items.length > 0 
      ? inspectionData.items 
      : this.createEmptyChecklist();

    const calculated = this.calculateInspectionScores(items);

    // Auto calculate NCs in this inspection
    let nonConformancesCount = 0;
    let openActionsCount = 0;

    items.forEach(item => {
      if (item.status === 'non_compliant' || item.hasNonConformance) {
        nonConformancesCount++;
      }
    });

    const inspId = inspectionData.id || `5S-INSP-${Date.now()}`;
    const inspNumber = inspectionData.inspectionNumber || `5S-${today.slice(0, 4)}-${String(this.inspections.length + 1).padStart(3, '0')}`;

    const existingInspection = this.inspections.find(i => i.id === inspectionData.id);
    const inspDate = inspectionData.date || today;
    const rawType = inspectionData.inspectionType || 'دوره‌ای';
    const normType = normalizeInspectionType(rawType);

    // Calculate next inspection date based on type
    let calculatedNextDate: string | undefined = undefined;
    const periodicInterval = inspectionData.periodicInterval || 'MONTHLY';
    if (normType === 'PERIODIC') {
      calculatedNextDate = inspectionData.nextInspectionDate?.trim() || calculateNextInspectionDate(inspDate, 'PERIODIC', periodicInterval);
    } else if (normType === 'ADHOC' && inspectionData.nextInspectionDate?.trim()) {
      calculatedNextDate = inspectionData.nextInspectionDate.trim();
    } else {
      // PRE_OP and POST_OP do NOT have periodic next dates
      calculatedNextDate = undefined;
    }

    const currentHistory = existingInspection?.inspectionHistory ? [...existingInspection.inspectionHistory] : [];
    if (!isNew) {
      const isDateChanged = existingInspection && existingInspection.date !== inspDate;
      const isTypeChanged = existingInspection && existingInspection.inspectionType !== rawType;
      const isNextDateChanged = existingInspection && existingInspection.nextInspectionDate !== calculatedNextDate;

      if (isDateChanged || isTypeChanged || isNextDateChanged) {
        currentHistory.unshift({
          id: `HIST-${Date.now()}`,
          timestamp: now,
          changedBy: user,
          action: 'DATE_TYPE_UPDATE',
          inspectionDate: inspDate,
          newNextDueDate: calculatedNextDate,
          inspectionType: rawType,
          relatedOperationId: inspectionData.relatedOperationId,
          notes: isDateChanged ? `تغییر تاریخ بازرسی به ${inspDate}` : `تغییر مشخصات زمان‌بندی و نوع بازرسی`
        });
      }
    } else {
      currentHistory.push({
        id: `HIST-${Date.now()}`,
        timestamp: now,
        changedBy: user,
        action: 'INITIAL_REGISTRATION',
        inspectionDate: inspDate,
        newNextDueDate: calculatedNextDate,
        inspectionType: rawType,
        relatedOperationId: inspectionData.relatedOperationId,
        notes: `ثبت اولیه بازرسی`
      });
    }

    const inspection: FiveSInspection = {
      id: inspId,
      inspectionNumber: inspNumber,
      date: inspDate,
      time: inspectionData.time || '10:00',
      department: inspectionData.department || '',
      location: inspectionData.location || 'محوطه اصلی',
      inspector: inspectionData.inspector || user,
      supervisor: inspectionData.supervisor || '',
      inspectionType: rawType,
      periodicInterval: normType === 'PERIODIC' ? periodicInterval : undefined,
      nextInspectionDate: calculatedNextDate,
      relatedOperationId: inspectionData.relatedOperationId?.trim() || undefined,
      relatedOperationTitle: inspectionData.relatedOperationTitle?.trim() || undefined,
      overallNotes: inspectionData.overallNotes || '',
      items: items.map(it => {
        let sc = 100;
        if (it.status === 'fully_compliant') sc = 100;
        else if (it.status === 'compliant') sc = 75;
        else if (it.status === 'needs_improvement') sc = 50;
        else if (it.status === 'non_compliant') sc = 0;
        return { ...it, score: sc };
      }),
      scores: {
        seiri: calculated.seiri,
        seiton: calculated.seiton,
        seiso: calculated.seiso,
        seiketsu: calculated.seiketsu,
        shitsuke: calculated.shitsuke,
        total: calculated.total
      },
      generalRating: calculated.generalRating,
      status: inspectionData.status || 'completed',
      nonConformancesCount,
      openActionsCount,
      createdAt: inspectionData.createdAt || now,
      updatedAt: now,
      createdBy: inspectionData.createdBy || user,
      inspectionHistory: currentHistory
    };

    if (isNew) {
      this.inspections.unshift(inspection);
      addAuditLog(
        user,
        'CREATE_5S_INSPECTION',
        `ثبت بازرسی 5S شماره ${inspection.inspectionNumber} برای واحد ${inspection.department}`
      );
    } else {
      const idx = this.inspections.findIndex(i => i.id === inspection.id);
      if (idx !== -1) {
        this.inspections[idx] = inspection;
        addAuditLog(
          user,
          'UPDATE_5S_INSPECTION',
          `ویرایش بازرسی 5S شماره ${inspection.inspectionNumber}`
        );
      }
    }

    // Auto-create Non-conformances for items marked as non-compliant if enabled
    items.forEach(item => {
      if (item.status === 'non_compliant' || item.hasNonConformance) {
        const existingNc = this.nonConformances.find(n => n.inspectionId === inspection.id && n.checklistItemId === item.id);
        if (!existingNc) {
          const newNcId = `5S-NC-${Date.now()}-${item.itemNumber}`;
          const newNcCode = `5S-NC-${today.slice(0, 4)}-${String(this.nonConformances.length + 1).padStart(3, '0')}`;
          
          const newNc: FiveSNonConformance = {
            id: newNcId,
            trackingCode: newNcCode,
            inspectionId: inspection.id,
            inspectionNumber: inspection.inspectionNumber,
            checklistItemId: item.id,
            pillar: item.pillar,
            title: `عدم انطباق در ${item.title}`,
            description: item.remarks || item.description || `عدم رعایت استاندارد در آیتم شماره ${item.itemNumber}`,
            location: inspection.location,
            department: inspection.department,
            severity: 'متوسط (Medium)',
            photo: item.photos && item.photos.length > 0 ? item.photos[0] : undefined,
            responsiblePerson: inspection.supervisor,
            dueDate: today,
            status: 'open',
            identifiedDate: inspection.date,
            reportedBy: inspection.inspector,
            createdAt: now,
            updatedAt: now,
            correctiveAction: item.correctiveActionText ? {
              id: `5S-ACT-${Date.now()}-${item.itemNumber}`,
              ncId: newNcId,
              description: item.correctiveActionText,
              responsible: inspection.supervisor,
              startDate: inspection.date,
              dueDate: today,
              status: 'open',
              progressPercent: 0,
              notes: 'تعریف خودکار از فرم بازرسی'
            } : undefined
          };
          this.nonConformances.unshift(newNc);
          item.nonConformanceId = newNcId;
        }
      }
    });

    this.saveAll();
    return inspection;
  }

  public deleteInspection(id: string, user = 'کاربر سیستم'): boolean {
    const item = this.inspections.find(i => i.id === id);
    if (!item) return false;

    this.inspections = this.inspections.filter(i => i.id !== id);
    // clean connected NCs
    this.nonConformances = this.nonConformances.filter(n => n.inspectionId !== id);
    this.saveAll();

    addAuditLog(
      user,
      'DELETE_5S_INSPECTION',
      `حذف بازرسی 5S شماره ${item.inspectionNumber}`
    );
    return true;
  }

  // ==========================================
  // 2. NON-CONFORMANCES & CAPA CRUD
  // ==========================================
  public getAllNonConformances(): FiveSNonConformance[] {
    return [...this.nonConformances].sort((a, b) => (b.identifiedDate || '').localeCompare(a.identifiedDate || ''));
  }

  public getNonConformanceById(id: string): FiveSNonConformance | undefined {
    return this.nonConformances.find(n => n.id === id);
  }

  public saveNonConformance(ncData: Partial<FiveSNonConformance>, user = 'کاربر سیستم'): FiveSNonConformance {
    const isNew = !ncData.id || !this.nonConformances.some(n => n.id === ncData.id);
    const now = new Date().toISOString();
    const today = getShamsiToday();

    const nc: FiveSNonConformance = {
      id: ncData.id || `5S-NC-${Date.now()}`,
      trackingCode: ncData.trackingCode || `5S-NC-${today.slice(0, 4)}-${String(this.nonConformances.length + 1).padStart(3, '0')}`,
      inspectionId: ncData.inspectionId,
      inspectionNumber: ncData.inspectionNumber,
      checklistItemId: ncData.checklistItemId,
      pillar: ncData.pillar || 'seiri',
      title: ncData.title || 'عدم انطباق 5S',
      description: ncData.description || '',
      location: ncData.location || 'محوطه سایت',
      department: ncData.department || 'عملیات',
      severity: ncData.severity || 'متوسط (Medium)',
      photo: ncData.photo,
      responsiblePerson: ncData.responsiblePerson || 'مسئول واحد',
      dueDate: ncData.dueDate || today,
      status: ncData.status || 'open',
      correctiveAction: ncData.correctiveAction,
      identifiedDate: ncData.identifiedDate || today,
      reportedBy: ncData.reportedBy || user,
      createdAt: ncData.createdAt || now,
      updatedAt: now
    };

    if (isNew) {
      this.nonConformances.unshift(nc);
      addAuditLog(
        user,
        'CREATE_5S_NC',
        `ثبت عدم انطباق 5S با کد پیگیری ${nc.trackingCode}`
      );
    } else {
      const idx = this.nonConformances.findIndex(n => n.id === nc.id);
      if (idx !== -1) {
        this.nonConformances[idx] = nc;
        addAuditLog(
          user,
          'UPDATE_5S_NC',
          `ویرایش عدم انطباق 5S با کد ${nc.trackingCode}`
        );
      }
    }

    this.saveAll();
    return nc;
  }

  public deleteNonConformance(id: string, user = 'کاربر سیستم'): boolean {
    const item = this.nonConformances.find(n => n.id === id);
    if (!item) return false;

    this.nonConformances = this.nonConformances.filter(n => n.id !== id);
    this.saveAll();

    addAuditLog(
      user,
      'DELETE_5S_NC',
      `حذف عدم انطباق 5S با کد ${item.trackingCode}`
    );
    return true;
  }

  // ==========================================
  // 3. SCHEDULES CRUD
  // ==========================================
  public getAllSchedules(): FiveSSchedule[] {
    return [...this.schedules].sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
  }

  public saveSchedule(schData: Partial<FiveSSchedule>, user = 'کاربر سیستم'): FiveSSchedule {
    const isNew = !schData.id || !this.schedules.some(s => s.id === schData.id);
    const now = new Date().toISOString();
    const today = getShamsiToday();

    const schedule: FiveSSchedule = {
      id: schData.id || `5S-SCH-${Date.now()}`,
      department: schData.department || '',
      location: schData.location || 'کل سایت و دفاتر',
      frequency: schData.frequency || 'ماهانه',
      inspector: schData.inspector || user,
      scheduledDate: schData.scheduledDate || today,
      status: schData.status || 'scheduled',
      completedInspectionId: schData.completedInspectionId,
      notes: schData.notes || '',
      createdAt: schData.createdAt || now
    };

    if (isNew) {
      this.schedules.unshift(schedule);
    } else {
      const idx = this.schedules.findIndex(s => s.id === schedule.id);
      if (idx !== -1) this.schedules[idx] = schedule;
    }

    this.saveAll();
    return schedule;
  }

  public deleteSchedule(id: string, user = 'کاربر سیستم'): boolean {
    const item = this.schedules.find(s => s.id === id);
    if (!item) return false;
    this.schedules = this.schedules.filter(s => s.id !== id);
    this.saveAll();
    return true;
  }

  // ==========================================
  // 4. UNIT RANKINGS & BENCHMARKING
  // ==========================================
  public getUnitRankings(): FiveSUnitRanking[] {
    const deptMap: Record<string, {
      department: string;
      inspections: FiveSInspection[];
      totalNCs: number;
      openNCs: number;
    }> = {};

    this.inspections.forEach(insp => {
      const d = insp.department || 'سایر واحدها';
      if (!deptMap[d]) {
        deptMap[d] = {
          department: d,
          inspections: [],
          totalNCs: 0,
          openNCs: 0
        };
      }
      deptMap[d].inspections.push(insp);
    });

    this.nonConformances.forEach(nc => {
      const d = nc.department || 'سایر واحدها';
      if (!deptMap[d]) {
        deptMap[d] = {
          department: d,
          inspections: [],
          totalNCs: 0,
          openNCs: 0
        };
      }
      deptMap[d].totalNCs++;
      if (nc.status === 'open' || nc.status === 'in_progress') {
        deptMap[d].openNCs++;
      }
    });

    const rankings: FiveSUnitRanking[] = Object.values(deptMap).map(item => {
      const insCount = item.inspections.length;
      let sumTotal = 0, sumSeiri = 0, sumSeiton = 0, sumSeiso = 0, sumSeiketsu = 0, sumShitsuke = 0;
      let lastDate = '—';

      if (insCount > 0) {
        item.inspections.forEach(insp => {
          sumTotal += insp.scores.total || 0;
          sumSeiri += insp.scores.seiri || 0;
          sumSeiton += insp.scores.seiton || 0;
          sumSeiso += insp.scores.seiso || 0;
          sumSeiketsu += insp.scores.seiketsu || 0;
          sumShitsuke += insp.scores.shitsuke || 0;
        });
        lastDate = item.inspections[0].date;
      }

      const avgScore = insCount > 0 ? Math.round(sumTotal / insCount) : 0;
      const seiriScore = insCount > 0 ? Math.round(sumSeiri / insCount) : 0;
      const seitonScore = insCount > 0 ? Math.round(sumSeiton / insCount) : 0;
      const seisoScore = insCount > 0 ? Math.round(sumSeiso / insCount) : 0;
      const seiketsuScore = insCount > 0 ? Math.round(sumSeiketsu / insCount) : 0;
      const shitsukeScore = insCount > 0 ? Math.round(sumShitsuke / insCount) : 0;

      let rating: 'عالی' | 'خوب' | 'قابل قبول' | 'نیازمند بهبود' | 'ضعیف' = 'قابل قبول';
      if (avgScore >= 90) rating = 'عالی';
      else if (avgScore >= 80) rating = 'خوب';
      else if (avgScore >= 70) rating = 'قابل قبول';
      else if (avgScore >= 50) rating = 'نیازمند بهبود';
      else rating = 'ضعیف';

      return {
        rank: 1,
        department: item.department,
        totalInspections: insCount,
        lastInspectionDate: lastDate,
        averageScore: avgScore,
        seiriScore,
        seitonScore,
        seisoScore,
        seiketsuScore,
        shitsukeScore,
        rating,
        totalNCs: item.totalNCs,
        openNCs: item.openNCs
      };
    });

    // Sort by averageScore descending
    rankings.sort((a, b) => b.averageScore - a.averageScore);
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return rankings;
  }

  // ==========================================
  // 5. DASHBOARD & KPIS
  // ==========================================
  public getKPIs() {
    const today = getShamsiToday();
    const totalInspections = this.inspections.length;
    const completedInspections = this.inspections.filter(i => i.status === 'completed' || i.status === 'approved').length;
    const scheduledInspections = this.schedules.filter(s => s.status === 'scheduled').length;
    const overdueInspections = this.schedules.filter(s => s.status === 'scheduled' && s.scheduledDate < today).length;

    const totalScoreSum = this.inspections.reduce((sum, i) => sum + (i.scores.total || 0), 0);
    const averageScore = totalInspections > 0 ? Math.round(totalScoreSum / totalInspections) : 0;

    const totalNonConformances = this.nonConformances.length;
    const openNonConformances = this.nonConformances.filter(n => n.status === 'open' || n.status === 'in_progress').length;

    let openCorrectiveActions = 0;
    let overdueActions = 0;

    this.nonConformances.forEach(nc => {
      if (nc.correctiveAction) {
        if (nc.correctiveAction.status === 'open' || nc.correctiveAction.status === 'in_progress') {
          openCorrectiveActions++;
          if (nc.correctiveAction.dueDate && nc.correctiveAction.dueDate < today) {
            overdueActions++;
          }
        }
      }
    });

    // Calculate pillar averages
    let seiriSum = 0, seitonSum = 0, seisoSum = 0, seiketsuSum = 0, shitsukeSum = 0;
    this.inspections.forEach(i => {
      seiriSum += i.scores.seiri || 0;
      seitonSum += i.scores.seiton || 0;
      seisoSum += i.scores.seiso || 0;
      seiketsuSum += i.scores.seiketsu || 0;
      shitsukeSum += i.scores.shitsuke || 0;
    });

    const pillarScoresAvg = {
      seiri: totalInspections > 0 ? Math.round(seiriSum / totalInspections) : 0,
      seiton: totalInspections > 0 ? Math.round(seitonSum / totalInspections) : 0,
      seiso: totalInspections > 0 ? Math.round(seisoSum / totalInspections) : 0,
      seiketsu: totalInspections > 0 ? Math.round(seiketsuSum / totalInspections) : 0,
      shitsuke: totalInspections > 0 ? Math.round(shitsukeSum / totalInspections) : 0
    };

    // Score trend by inspection date
    const scoreTrend = this.inspections
      .slice(-10)
      .reverse()
      .map(i => ({
        date: i.date,
        inspectionNumber: i.inspectionNumber,
        department: i.department,
        score: i.scores.total,
        seiri: i.scores.seiri,
        seiton: i.scores.seiton,
        seiso: i.scores.seiso,
        seiketsu: i.scores.seiketsu,
        shitsuke: i.scores.shitsuke
      }));

    // NC by department
    const ncByUnitMap: Record<string, number> = {};
    this.nonConformances.forEach(nc => {
      const d = nc.department || 'نامشخص';
      ncByUnitMap[d] = (ncByUnitMap[d] || 0) + 1;
    });

    const ncByUnit = Object.entries(ncByUnitMap).map(([dept, count]) => ({
      department: dept,
      count
    }));

    // Action status counts
    const actionStatusCounts = {
      open: this.nonConformances.filter(n => n.correctiveAction && n.correctiveAction.status === 'open').length,
      inProgress: this.nonConformances.filter(n => n.correctiveAction && n.correctiveAction.status === 'in_progress').length,
      completed: this.nonConformances.filter(n => n.correctiveAction && n.correctiveAction.status === 'completed').length,
      verified: this.nonConformances.filter(n => n.correctiveAction && n.correctiveAction.status === 'verified').length,
      overdue: overdueActions
    };

    return {
      totalInspections,
      completedInspections,
      scheduledInspections,
      overdueInspections,
      averageScore,
      totalNonConformances,
      openNonConformances,
      openCorrectiveActions,
      overdueActions,
      complianceRate: averageScore,
      pillarScoresAvg,
      scoreTrend,
      ncByUnit,
      actionStatusCounts
    };
  }

  // ==========================================
  // 6. EXPORT UTILITIES
  // ==========================================
  public exportInspectionsToCSV(): string {
    const headers = [
      'شماره بازرسی',
      'تاریخ',
      'واحد/بخش',
      'محل بازرسی',
      'بازرس',
      'سرپرست واحد',
      'نوع بازرسی',
      'امتیاز تفکیک (Seiri)',
      'امتیاز نظم (Seiton)',
      'امتیاز پاکیزگی (Seiso)',
      'امتیاز استاندارد (Seiketsu)',
      'امتیاز انضباط (Shitsuke)',
      'امتیاز کل (5S)',
      'ارزیابی نهایی',
      'تعداد عدم انطباق'
    ];

    const rows = this.inspections.map(i => [
      i.inspectionNumber,
      i.date,
      `"${i.department}"`,
      `"${i.location}"`,
      `"${i.inspector}"`,
      `"${i.supervisor}"`,
      i.inspectionType,
      i.scores.seiri,
      i.scores.seiton,
      i.scores.seiso,
      i.scores.seiketsu,
      i.scores.shitsuke,
      i.scores.total,
      i.generalRating,
      i.nonConformancesCount
    ]);

    return '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  public exportRankingsToCSV(): string {
    const rankings = this.getUnitRankings();
    const headers = [
      'رتبه',
      'واحد / بخش',
      'تعداد بازرسی‌ها',
      'تاریخ آخرین بازرسی',
      'میانگین امتیاز 5S',
      'تفکیک',
      'نظم',
      'پاکیزگی',
      'استاندارد',
      'انضباط',
      'وضعیت',
      'کل عدم انطباق‌ها',
      'عدم انطباق‌های باز'
    ];

    const rows = rankings.map(r => [
      r.rank,
      `"${r.department}"`,
      r.totalInspections,
      r.lastInspectionDate,
      r.averageScore,
      r.seiriScore,
      r.seitonScore,
      r.seisoScore,
      r.seiketsuScore,
      r.shitsukeScore,
      r.rating,
      r.totalNCs,
      r.openNCs
    ]);

    return '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export const fiveSService = new FiveSService();
