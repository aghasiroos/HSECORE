import { toast } from 'react-hot-toast';
import { apiDb } from '../../../services/apiDatabaseClient';
import { 
  PtwAuditRecord, 
  PtwAuditStats,
  PtwAuditItem,
  EnvironmentalHazardItem,
  RequiredPpeItem,
  PrecautionItem,
  PtwHistoricalYearStat,
  INITIAL_30_INSPECTION_ITEMS,
  INITIAL_ENVIRONMENTAL_HAZARDS,
  INITIAL_REQUIRED_PPE,
  INITIAL_PRECAUTIONS,
  DEFAULT_DOCUMENT_CODE,
  DEFAULT_REVISION_NUMBER
} from '../types';

export const PTW_AUDIT_STORAGE_KEY = 'hse_ptw_audit_records_v2';
const LEGACY_SEED_IDS = new Set([
  'ptw-aud-1405-001',
  'ptw-aud-1405-002',
  'ptw-aud-1405-003',
  'ptw-aud-1405-004',
  'ptw-aud-1405-005',
  'ptw-aud-1405-006',
  'ptw-aud-1404-001',
  'ptw-aud-1404-002',
  'ptw-aud-1404-003',
  'ptw-aud-1403-001',
  'ptw-aud-1403-002'
]);

// In-memory cache for ultra-fast synchronous UI responses
let memoryAuditsCache: PtwAuditRecord[] | null = null;
let isInitializedFromIdb = false;

let cachedPermitsForPtwAudit: any[] = [];

let isReloadingPtwAudit = false;

/**
 * Initialize and sync audits from پایگاه داده backend and memory.
 */
export async function initPtwAuditStorage(): Promise<PtwAuditRecord[]> {
  if (isReloadingPtwAudit) return memoryAuditsCache || [];
  isReloadingPtwAudit = true;
  try {
    // 1. Authoritative check from پایگاه داده
    const [dbAudits, dbPermits] = await Promise.all([
      apiDb.getPtwAuditRecords(),
      apiDb.getWorkPermits()
    ]);

    if (Array.isArray(dbPermits)) {
      cachedPermitsForPtwAudit = dbPermits;
    }

    if (Array.isArray(dbAudits)) {
      const sanitized = dbAudits.filter(p => p && p.id && !LEGACY_SEED_IDS.has(p.id));
      memoryAuditsCache = sanitized;
      isInitializedFromIdb = true;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hse_ptw_audits_updated', { detail: sanitized }));
      }
      return sanitized;
    }
  } catch (e) {
    console.error('Error during initPtwAuditStorage:', e);
  } finally {
    isReloadingPtwAudit = false;
  }
  isInitializedFromIdb = true;
  return memoryAuditsCache || [];
}

// Auto-run background initialization on startup and listen for real-time mutations
if (typeof window !== 'undefined') {
  initPtwAuditStorage();

  const handleRemoteAuditMutation = (e: any) => {
    const entity = String(e?.detail?.key || e?.detail?.data?.key || e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
    if (entity === 'ptw_audits' || entity === PTW_AUDIT_STORAGE_KEY.toLowerCase()) {
      apiDb.getPtwAuditRecords().then(records => {
        if (Array.isArray(records)) {
          const sanitized = records.filter(p => p && p.id && !LEGACY_SEED_IDS.has(p.id));
          memoryAuditsCache = sanitized;
          window.dispatchEvent(new CustomEvent('hse_ptw_audits_updated', { detail: sanitized }));
        }
      }).catch(() => {});
    }
    if (entity === PTW_HISTORICAL_YEARS_STORAGE_KEY.toLowerCase()) {
      initHistoricalYearStorage().then((cleanList) => {
        window.dispatchEvent(new CustomEvent('hse_ptw_historical_years_updated', { detail: cleanList }));
      }).catch(() => {});
    }
    if (entity.includes('permit')) {
      apiDb.getWorkPermits().then(list => {
        if (Array.isArray(list)) cachedPermitsForPtwAudit = list;
      }).catch(() => {});
    }
  };

  const handleFullReconnect = () => {
    void initPtwAuditStorage();
    void initHistoricalYearStorage().then((cleanList) => {
      window.dispatchEvent(new CustomEvent('hse_ptw_historical_years_updated', { detail: cleanList }));
    });
  };

  window.addEventListener('app_data_mutated', handleRemoteAuditMutation);
  window.addEventListener('hse_data_mutated', handleRemoteAuditMutation);
  window.addEventListener('hse_realtime_reconnected', handleFullReconnect);
  window.addEventListener('hse_central_data_synced', handleFullReconnect);
  window.addEventListener('hse_permits_updated', () => {
    apiDb.getWorkPermits().then(list => {
      if (Array.isArray(list)) cachedPermitsForPtwAudit = list;
    }).catch(() => {});
  });
}

export function calculateAuditMetrics(
  items: PtwAuditItem[],
  environmentalHazards?: EnvironmentalHazardItem[],
  requiredPpe?: RequiredPpeItem[],
  precautionsTaken?: PrecautionItem[]
): {
  passedCount: number;
  defectsCount: number;
  questionDefectsCount: number;
  hazardsMissedCount: number;
  ppeMissedCount: number;
  precautionsMissedCount: number;
  totalMissedNcCount: number;
  naCount: number;
  complianceScore: number;
} {
  let passedCount = 0;
  let questionDefectsCount = 0;
  let naCount = 0;

  if (Array.isArray(items)) {
    items.forEach(item => {
      if (item.status === 'P' || item.status === 'PASS') passedCount++;
      else if (item.status === 'O' || item.status === 'DEFECT') questionDefectsCount++;
      else if (item.status === '-' || item.status === 'NA') naCount++;
    });
  }

  // عدم انطباق‌های شرایط خطرناک، PPE و تمهیدات (مواردی که برای کار الزامی بوده اما در پروانه کار انتخاب نشده‌اند)
  const hazardsMissedCount = Array.isArray(environmentalHazards) 
    ? environmentalHazards.filter(h => h.missed).length 
    : 0;

  const ppeMissedCount = Array.isArray(requiredPpe) 
    ? requiredPpe.filter(p => p.missed).length 
    : 0;

  const precautionsMissedCount = Array.isArray(precautionsTaken) 
    ? precautionsTaken.filter(p => p.missed).length 
    : 0;

  const totalMissedNcCount = hazardsMissedCount + ppeMissedCount + precautionsMissedCount;
  const defectsCount = questionDefectsCount + totalMissedNcCount;

  const evaluatedTotal = passedCount + defectsCount;
  const complianceScore = evaluatedTotal > 0 ? Number(((passedCount / evaluatedTotal) * 100).toFixed(1)) : 100;

  return {
    passedCount,
    defectsCount,
    questionDefectsCount,
    hazardsMissedCount,
    ppeMissedCount,
    precautionsMissedCount,
    totalMissedNcCount,
    naCount,
    complianceScore
  };
}

export function createEmptyPtwAudit(auditorName = 'نماینده واحد HSE'): PtwAuditRecord {
  const todayJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const randomSeq = Math.floor(100 + Math.random() * 900);

  return {
    id: `ptw-aud-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    documentCode: DEFAULT_DOCUMENT_CODE,
    revisionNumber: DEFAULT_REVISION_NUMBER,
    auditDate: todayJalali,
    auditTime: timeStr,
    shift: 'روزکار (DAY)',
    unitName: '',
    subUnitName: '',
    permitType: 'HOT',
    permitNumber: `HW-${todayJalali.replace(/\//g, '')}-${randomSeq}`,
    hasAttachedPermit: false,
    attachedPermitType: 'NONE',
    attachedPermitNumber: '',
    attachedPermitTitleCustom: '',
    signers: {
      areaResponsibleName: '',
      seniorShiftSupervisorName: '',
      workPerformerName: '',
      safetyUnitSignerName: ''
    },
    workDescription: '',
    inspectionItems: INITIAL_30_INSPECTION_ITEMS.map(i => ({ ...i })),
    environmentalHazards: INITIAL_ENVIRONMENTAL_HAZARDS.map(h => ({ ...h })),
    requiredPpe: INITIAL_REQUIRED_PPE.map(p => ({ ...p })),
    precautionsTaken: INITIAL_PRECAUTIONS.map(p => ({ ...p })),
    customOtherHazardsText: '',
    customOtherPpeText: '',
    customOtherPrecautionsText: '',
    auditSummaryReport: '',
    defectsAndNonConformances: '',
    attachments: [],
    hseAuditor: {
      auditorName,
      isSigned: true,
      signedAt: `${todayJalali} ${timeStr}`
    },
    status: 'DRAFT',
    complianceScore: 100,
    passedCount: 0,
    defectsCount: 0,
    naCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * تولید خودکار متن گزارش عدم انطباق‌ها و نواقص مشاهده‌شده به صورت خط به خط و شماره‌گذاری‌شده
 */
export function generateDefectSummaryReport(
  items: PtwAuditItem[],
  hazards?: EnvironmentalHazardItem[],
  ppe?: RequiredPpeItem[],
  precautions?: PrecautionItem[]
): string {
  const defectLines: string[] = [];
  let counter = 1;

  // 1. Checklist Questions (موارد نامطلوب چک‌لیست ۳۰ گانه)
  items.forEach((item) => {
    if (item.status === 'O' || item.status === 'DEFECT') {
      const remarkPart = item.remarks?.trim() ? ` (توضیحات / اقدام: ${item.remarks.trim()})` : '';
      defectLines.push(`${counter}. [بند ${item.questionNumber} چک‌لیست] ${item.questionFa}${remarkPart}`);
      counter++;
    }
  });

  // 2. Missed Environmental Hazards (عدم انطباق شرایط محیطی)
  if (hazards) {
    hazards.forEach((h) => {
      if (h.missed) {
        defectLines.push(`${counter}. [شرایط محیطی الزامی قید نشده] «${h.labelFa}» در پروانه کار مشخص نگردیده است.`);
        counter++;
      }
    });
  }

  // 3. Missed PPE (عدم انطباق تجهیزات حفاظت فردی)
  if (ppe) {
    ppe.forEach((p) => {
      if (p.missed) {
        defectLines.push(`${counter}. [تجهیزات PPE الزامی قید نشده] «${p.labelFa}» (${p.groupFa}) در پروانه ثبت نشده است.`);
        counter++;
      }
    });
  }

  // 4. Missed Precautions (عدم انطباق تمهیدات ایمنی)
  if (precautions) {
    precautions.forEach((pr) => {
      if (pr.missed) {
        defectLines.push(`${counter}. [تمهیدات ایمنی الزامی قید نشده] اقدام «${pr.labelFa}» در پروانه لحاظ نگردیده است.`);
        counter++;
      }
    });
  }

  return defectLines.join('\n');
}

// خواندن پروانه‌های کار فعال و الحاقی از ماژول پروانه کار مجتمع جهت پیشنهاد خودکار شماره‌ها
export function getActiveIssuedSupplementaryPermits(): {
  id: string;
  serialNumber: string;
  category: string;
  categoryFa: string;
  description: string;
  unit: string;
}[] {
  try {
    const permits = cachedPermitsForPtwAudit || [];
    if (!Array.isArray(permits) || permits.length === 0) return [];

    const suppPermits: {
      id: string;
      serialNumber: string;
      category: string;
      categoryFa: string;
      description: string;
      unit: string;
    }[] = [];

    permits.forEach((p: any) => {
      // 1. Direct supplementary permits
      if (['ConfinedSpace', 'Excavation', 'ProcessMechanical', 'ElectricalIsolation', 'Radiation', 'VehicleCrane'].includes(p.permitCategory)) {
        let categoryFa = 'پروانه الحاقی';
        if (p.permitCategory === 'ConfinedSpace') categoryFa = 'الحاقی فضای بسته';
        else if (p.permitCategory === 'Excavation') categoryFa = 'الحاقی حفاری';
        else if (p.permitCategory === 'ProcessMechanical') categoryFa = 'الحاقی ایزولاسیون مکانیکی/فرآیندی';
        else if (p.permitCategory === 'ElectricalIsolation') categoryFa = 'الحاقی ایزولاسیون الکتریکی';
        else if (p.permitCategory === 'Radiation') categoryFa = 'الحاقی پرتونگاری';
        else if (p.permitCategory === 'VehicleCrane') categoryFa = 'الحاقی ورود جرثقیل/خودرو';

        suppPermits.push({
          id: p.id || p.serialNumber,
          serialNumber: p.serialNumber || p.id,
          category: p.permitCategory,
          categoryFa,
          description: p.description || '',
          unit: p.unit || p.location || ''
        });
      }

      // 2. Attached permits inside main Hot/Cold permits
      if (p.attachedPermits) {
        if (p.attachedPermits.confinedSpace) {
          suppPermits.push({
            id: `${p.id}-cs`,
            serialNumber: p.attachedPermits.confinedSpaceSerial || `CS-${p.serialNumber}`,
            category: 'ConfinedSpace',
            categoryFa: 'الحاقی ورود به فضای بسته',
            description: p.description || '',
            unit: p.unit || p.location || ''
          });
        }
        if (p.attachedPermits.excavation) {
          suppPermits.push({
            id: `${p.id}-ex`,
            serialNumber: p.attachedPermits.excavationSerial || `EX-${p.serialNumber}`,
            category: 'Excavation',
            categoryFa: 'الحاقی حفاری و خاکبرداری',
            description: p.description || '',
            unit: p.unit || p.location || ''
          });
        }
        if (p.attachedPermits.electrical) {
          suppPermits.push({
            id: `${p.id}-el`,
            serialNumber: p.attachedPermits.electricalSerial || `EI-${p.serialNumber}`,
            category: 'ElectricalIsolation',
            categoryFa: 'الحاقی جداسازی الکتریکی',
            description: p.description || '',
            unit: p.unit || p.location || ''
          });
        }
        if (p.attachedPermits.processIsolation) {
          suppPermits.push({
            id: `${p.id}-pi`,
            serialNumber: p.attachedPermits.processIsolationSerial || `PI-${p.serialNumber}`,
            category: 'ProcessMechanical',
            categoryFa: 'الحاقی ایزولاسیون مکانیکی/فرآیندی',
            description: p.description || '',
            unit: p.unit || p.location || ''
          });
        }
        if (p.attachedPermits.radiation) {
          suppPermits.push({
            id: `${p.id}-rad`,
            serialNumber: p.attachedPermits.radiationSerial || `RAD-${p.serialNumber}`,
            category: 'Radiation',
            categoryFa: 'الحاقی پرتونگاری صنعتی',
            description: p.description || '',
            unit: p.unit || p.location || ''
          });
        }
        if (p.attachedPermits.workingAtHeight) {
          suppPermits.push({
            id: `${p.id}-wah`,
            serialNumber: p.attachedPermits.workingAtHeightSerial || `WAH-${p.serialNumber}`,
            category: 'WorkingAtHeight',
            categoryFa: 'الحاقی کار در ارتفاع',
            description: p.description || '',
            unit: p.unit || p.location || ''
          });
        }
      }
    });

    return suppPermits;
  } catch (e) {
    console.error('Failed to load active supplementary permits:', e);
    return [];
  }
}

export function getPtwAudits(): PtwAuditRecord[] {
  if (memoryAuditsCache !== null) {
    return memoryAuditsCache;
  }
  return [];
}

export function clearAllPtwAudits(): PtwAuditRecord[] {
  memoryAuditsCache = [];

  // Authoritative clear in PostgreSQL backend with rollback on failure
  apiDb.savePtwAuditRecords([]).catch((err) => {
    console.error('[PTW Audit] Failed to clear audits in DB:', err);
    toast.error('خطا در پاک‌سازی ممیزی‌های پروانه کار در پایگاه داده. اطلاعات بازیابی شد.');
    void initPtwAuditStorage();
  });

  window.dispatchEvent(new CustomEvent('hse_ptw_audits_updated', { detail: [] }));
  return [];
}

export function savePtwAudit(record: PtwAuditRecord): PtwAuditRecord[] {
  const current = getPtwAudits();
  const metrics = calculateAuditMetrics(
    record.inspectionItems,
    record.environmentalHazards,
    record.requiredPpe,
    record.precautionsTaken
  );
  
  const enriched: PtwAuditRecord = {
    ...record,
    passedCount: metrics.passedCount,
    defectsCount: metrics.defectsCount,
    naCount: metrics.naCount,
    complianceScore: metrics.complianceScore,
    updatedAt: new Date().toISOString()
  };

  const existingIdx = current.findIndex(a => a.id === enriched.id);
  let updatedList: PtwAuditRecord[];

  if (existingIdx !== -1) {
    updatedList = [...current];
    updatedList[existingIdx] = enriched;
  } else {
    updatedList = [enriched, ...current];
  }

  // 1. Optimistic in-memory update
  memoryAuditsCache = updatedList;

  // 2. Atomic locked persistence in PostgreSQL (prevents concurrent user overwrites)
  apiDb.collection
    .upsertItem<PtwAuditRecord>(PTW_AUDIT_STORAGE_KEY, enriched, { position: 'start' })
    .catch((err) => {
      console.error('[PTW Audit] Failed to persist audit in DB:', err);
      toast.error('خطا در ذخیره ممیزی پروانه کار در پایگاه داده مرکزی. داده‌ها از سرور بازخوانی شدند.');
      void initPtwAuditStorage();
    });

  // 3. Notify app listeners
  window.dispatchEvent(new CustomEvent('hse_ptw_audits_updated', { detail: updatedList }));

  return updatedList;
}

export function deletePtwAudit(id: string): PtwAuditRecord[] {
  const current = getPtwAudits();
  const updatedList = current.filter(a => a.id !== id);

  // 1. Optimistic in-memory update
  memoryAuditsCache = updatedList;

  // 2. Atomic locked deletion in PostgreSQL with rollback on failure
  apiDb.collection.deleteItem(PTW_AUDIT_STORAGE_KEY, id).catch((err) => {
    console.error('[PTW Audit] Failed to delete audit in DB:', err);
    toast.error('خطا در حذف ممیزی پروانه کار در پایگاه داده مرکزی. داده‌ها بازخوانی شدند.');
    void initPtwAuditStorage();
  });

  // 3. Notify app listeners
  window.dispatchEvent(new CustomEvent('hse_ptw_audits_updated', { detail: updatedList }));

  return updatedList;
}

export function computePtwAuditStats(audits: PtwAuditRecord[]): PtwAuditStats {
  const totalAudits = audits.length;
  let finalizedCount = 0;
  let draftCount = 0;
  let criticalNcCount = 0;
  let totalScoreSum = 0;
  let totalDefectsIdentified = 0;
  let hotPermitCount = 0;
  let coldPermitCount = 0;
  let attachedPermitCount = 0;
  let confinedSpacePermitCount = 0;

  audits.forEach(a => {
    if (a.status === 'FINALIZED') finalizedCount++;
    else if (a.status === 'DRAFT') draftCount++;
    else if (a.status === 'CRITICAL_NC') criticalNcCount++;

    if (a.permitType === 'HOT') hotPermitCount++;
    else if (a.permitType === 'COLD') coldPermitCount++;
    else if (a.permitType === 'CONFINED_SPACE') {
      coldPermitCount++;
      confinedSpacePermitCount++;
    }

    if (a.hasAttachedPermit || (a.attachedPermitType && a.attachedPermitType !== 'NONE')) {
      attachedPermitCount++;
      if (a.attachedPermitType === 'ConfinedSpace') {
        confinedSpacePermitCount++;
      }
    }

    const metrics = calculateAuditMetrics(
      a.inspectionItems,
      a.environmentalHazards,
      a.requiredPpe,
      a.precautionsTaken
    );
    totalScoreSum += metrics.complianceScore;
    totalDefectsIdentified += metrics.defectsCount;
  });

  const avgComplianceScore = totalAudits > 0 ? Number((totalScoreSum / totalAudits).toFixed(1)) : 100;

  return {
    totalAudits,
    finalizedCount,
    draftCount,
    criticalNcCount,
    avgComplianceScore,
    totalDefectsIdentified,
    hotPermitCount,
    coldPermitCount,
    attachedPermitCount,
    confinedSpacePermitCount
  };
}

// =========================================================================
// HISTORICAL YEARS STATS STORAGE & MANAGEMENT (آمار سنوات گذشته)
// =========================================================================

export const PTW_HISTORICAL_YEARS_STORAGE_KEY = 'hse_ptw_audit_historical_years_v1';

export const DEFAULT_HISTORICAL_YEAR_STATS: PtwHistoricalYearStat[] = [
  {
    id: 'hist-1401',
    year: '1401',
    totalAudits: 88,
    defectiveAudits: 23,
    defectRate: 26.1,
    totalDefectsSum: 51,
    avgComplianceScore: 81.5,
    hotPermitCount: 46,
    coldPermitCount: 42,
    confinedSpaceCount: 12,
    attachedPermitCount: 16,
    notes: 'سال استقرار سیستم ممیزی جامع پروانه کار و دوره‌های آموزشی اولیه',
    isManualEntry: true,
    createdAt: '1401/12/29',
    updatedAt: '1401/12/29'
  },
  {
    id: 'hist-1402',
    year: '1402',
    totalAudits: 114,
    defectiveAudits: 25,
    defectRate: 21.9,
    totalDefectsSum: 44,
    avgComplianceScore: 85.8,
    hotPermitCount: 62,
    coldPermitCount: 52,
    confinedSpaceCount: 18,
    attachedPermitCount: 24,
    notes: 'پایش سیستماتیک و اعمال الزامات سخت‌گیرانه برای تجهیزات حفاظت فردی',
    isManualEntry: true,
    createdAt: '1402/12/29',
    updatedAt: '1402/12/29'
  },
  {
    id: 'hist-1403',
    year: '1403',
    totalAudits: 142,
    defectiveAudits: 22,
    defectRate: 15.5,
    totalDefectsSum: 34,
    avgComplianceScore: 89.2,
    hotPermitCount: 78,
    coldPermitCount: 64,
    confinedSpaceCount: 22,
    attachedPermitCount: 31,
    notes: 'بهبود فرهنگ ایمنی و کاهش چشمگیر خطاهای امضاء و عدم انطباق‌های گازسنجی',
    isManualEntry: true,
    createdAt: '1403/12/29',
    updatedAt: '1403/12/29'
  }
];

let memoryHistoricalYearsCache: PtwHistoricalYearStat[] | null = null;

/**
 * Get all historical years statistics from memory or پایگاه داده.
 */
export function getHistoricalYearStats(): PtwHistoricalYearStat[] {
  if (memoryHistoricalYearsCache !== null) {
    return memoryHistoricalYearsCache;
  }

  // Fallback to defaults
  const defaultMap = new Map<string, PtwHistoricalYearStat>();
  DEFAULT_HISTORICAL_YEAR_STATS.forEach(item => {
    defaultMap.set(item.year, item);
  });
  memoryHistoricalYearsCache = Array.from(defaultMap.values());
  return memoryHistoricalYearsCache;
}

/**
 * Save historical years stats to پایگاه داده with strict deduplication by year.
 */
function saveHistoricalYearsToStorage(stats: PtwHistoricalYearStat[]) {
  const yearMap = new Map<string, PtwHistoricalYearStat>();
  stats.forEach(item => {
    if (item && item.year) {
      const yr = String(item.year).trim();
      if (yr) {
        yearMap.set(yr, {
          ...item,
          id: `hist-${yr}`,
          year: yr
        });
      }
    }
  });
  const cleanList = Array.from(yearMap.values()).sort((a, b) => a.year.localeCompare(b.year));
  memoryHistoricalYearsCache = cleanList;
  apiDb
    .saveSetting(PTW_HISTORICAL_YEARS_STORAGE_KEY, cleanList, 'PTW Historical Years Statistics')
    .catch((err) => {
      console.error('[PTW Audit] Failed to persist historical year stats:', err);
      toast.error('خطا در ذخیره آمار سنوات گذشته در پایگاه داده مرکزی.');
      void initHistoricalYearStorage().then((reloaded) => {
        window.dispatchEvent(new CustomEvent('hse_ptw_historical_years_updated', { detail: reloaded }));
      });
    });
  window.dispatchEvent(new CustomEvent('hse_ptw_historical_years_updated', { detail: cleanList }));
}

/**
 * Add or update a historical year record without losing other registered years.
 */
export function saveHistoricalYearStat(stat: PtwHistoricalYearStat, originalYear?: string): PtwHistoricalYearStat[] {
  const current = getHistoricalYearStats();
  const trimmedYear = (stat.year || '').trim();

  if (!trimmedYear) {
    return current;
  }

  const formattedStat: PtwHistoricalYearStat = {
    ...stat,
    id: `hist-${trimmedYear}`,
    year: trimmedYear,
    totalAudits: Math.max(0, Number(stat.totalAudits) || 0),
    defectiveAudits: Math.max(0, Number(stat.defectiveAudits) || 0),
    defectRate: Number(stat.defectRate) || (stat.totalAudits > 0 ? Number(((stat.defectiveAudits / stat.totalAudits) * 100).toFixed(1)) : 0),
    totalDefectsSum: Math.max(0, Number(stat.totalDefectsSum) || 0),
    avgComplianceScore: Math.min(100, Math.max(0, Number(stat.avgComplianceScore) || 0)),
    hotPermitCount: Math.max(0, Number(stat.hotPermitCount) || 0),
    coldPermitCount: Math.max(0, Number(stat.coldPermitCount) || 0),
    confinedSpaceCount: Math.max(0, Number(stat.confinedSpaceCount) || 0),
    attachedPermitCount: Math.max(0, Number(stat.attachedPermitCount) || 0),
    notes: stat.notes || '',
    isManualEntry: true,
    updatedAt: new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'short' }).format(new Date())
  };

  let updatedList: PtwHistoricalYearStat[];

  if (originalYear) {
    const origTrimmed = originalYear.trim();
    const existingIdx = current.findIndex(s => s.year === origTrimmed);
    
    if (existingIdx >= 0) {
      if (origTrimmed !== trimmedYear) {
        // If year was renamed, filter out old record and upsert new
        const filtered = current.filter((_, idx) => idx !== existingIdx);
        const conflictIdx = filtered.findIndex(s => s.year === trimmedYear);
        if (conflictIdx >= 0) {
          filtered[conflictIdx] = {
            ...filtered[conflictIdx],
            ...formattedStat,
            createdAt: filtered[conflictIdx].createdAt || formattedStat.createdAt
          };
          updatedList = filtered;
        } else {
          formattedStat.createdAt = current[existingIdx].createdAt || formattedStat.updatedAt;
          updatedList = [...filtered, formattedStat];
        }
      } else {
        // Same year, update existing
        updatedList = [...current];
        updatedList[existingIdx] = {
          ...current[existingIdx],
          ...formattedStat,
          createdAt: current[existingIdx].createdAt || formattedStat.updatedAt
        };
      }
    } else {
      // originalYear not found in list, append as new
      formattedStat.createdAt = formattedStat.updatedAt;
      updatedList = [...current.filter(s => s.year !== trimmedYear), formattedStat];
    }
  } else {
    // New Record Addition - ALWAYS PRESERVE ALL OTHER YEARS
    const existingIdx = current.findIndex(s => s.year === trimmedYear);
    if (existingIdx >= 0) {
      // User entered an existing year number in add mode -> update that year's numbers
      updatedList = [...current];
      updatedList[existingIdx] = {
        ...current[existingIdx],
        ...formattedStat,
        createdAt: current[existingIdx].createdAt || formattedStat.updatedAt
      };
    } else {
      // Brand new year -> append to existing list
      formattedStat.createdAt = formattedStat.updatedAt;
      updatedList = [...current, formattedStat];
    }
  }

  // Sort chronological ascending (e.g. 1400, 1401, 1402, 1403...)
  updatedList.sort((a, b) => a.year.localeCompare(b.year));

  saveHistoricalYearsToStorage(updatedList);
  return updatedList;
}

/**
 * Delete a historical year statistic.
 */
export function deleteHistoricalYearStat(yearOrId: string): PtwHistoricalYearStat[] {
  const current = getHistoricalYearStats();
  const updatedList = current.filter(s => s.year !== yearOrId && s.id !== yearOrId);
  saveHistoricalYearsToStorage(updatedList);
  return updatedList;
}

/**
 * Reset historical years to default sample data.
 */
export function resetHistoricalYearStatsToDefault(): PtwHistoricalYearStat[] {
  const defaults = [...DEFAULT_HISTORICAL_YEAR_STATS];
  saveHistoricalYearsToStorage(defaults);
  return defaults;
}

/**
 * Async initialization of historical years storage from پایگاه داده.
 */
export async function initHistoricalYearStorage(): Promise<PtwHistoricalYearStat[]> {
  try {
    const dbData = await apiDb.getSetting(PTW_HISTORICAL_YEARS_STORAGE_KEY);
    if (Array.isArray(dbData) && dbData.length > 0) {
      const yearMap = new Map<string, PtwHistoricalYearStat>();
      dbData.forEach(item => {
        if (item && item.year) {
          const yr = String(item.year).trim();
          if (yr) {
            yearMap.set(yr, {
              ...item,
              id: `hist-${yr}`,
              year: yr
            });
          }
        }
      });
      const cleanList = Array.from(yearMap.values()).sort((a, b) => a.year.localeCompare(b.year));
      memoryHistoricalYearsCache = cleanList;
      return cleanList;
    }
  } catch {
    // Continue
  }
  return getHistoricalYearStats();
}

// Auto-run background historical year storage initialization
if (typeof window !== 'undefined') {
  initHistoricalYearStorage().catch(() => {});
}

