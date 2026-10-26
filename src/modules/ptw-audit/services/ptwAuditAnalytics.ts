import { PtwAuditRecord, PermitType, PtwHistoricalYearStat } from '../types';

export type RoleType = 
  | 'areaResponsible' 
  | 'seniorShiftSupervisor' 
  | 'workPerformer' 
  | 'safetyUnitSigner';

export interface DefectPersonStat {
  rank: number;
  personName: string;
  role: RoleType;
  roleTitleFa: string;
  totalAuditsCount: number;
  defectiveAuditsCount: number;
  totalDefectsSum: number;
  defectPercentage: number; // (defectiveAuditsCount / totalAuditsCount) * 100
  complianceRate: number; // 100 - defectPercentage
  criticalCount: number;
  auditIds: string[];
}

export interface DefectCategoryItem {
  id: string;
  titleFa: string;
  category: string;
  defectCount: number;
  percentage: number;
  sampleRemarks: string[];
  associatedPermitsCount: number;
  permitIds?: string[];
}

export interface PermitTypeDistribution {
  permitTypeKey: string;
  titleFa: string;
  totalCount: number;
  defectiveCount: number;
  cleanCount: number;
  totalDefectsSum: number;
  defectRate: number; // Percentage
  avgComplianceScore: number;
  color: string;
}

export interface YearlyTrendStat {
  year: string; // e.g. "1401", "1402", "1403", "1404", "1405"
  totalAudits: number;
  defectiveAudits: number;
  cleanAudits: number;
  defectRate: number; // Percentage of audits with defects
  avgComplianceScore: number;
  totalDefectsSum: number;
  hotPermitCount: number;
  coldPermitCount: number;
  confinedSpaceCount: number;
  attachedPermitCount: number;
  isManualEntry?: boolean; // آیا آمار سال گذشته دستی است
  source?: 'system' | 'manual'; // منبع داده: محاسبه سیستمی ممیزی‌ها یا ثبت دستی سنوات قبل
  notes?: string;
}

export interface MonthlyTrendStat {
  monthName: string;
  monthIndex: number;
  totalAudits: number;
  defectiveAudits: number;
  defectRate: number;
  complianceRate: number;
}

export interface UnitDefectStat {
  unitName: string;
  totalAudits: number;
  defectiveAudits: number;
  totalDefects: number;
  defectRate: number;
  avgScore: number;
}

export interface DashboardFilterState {
  year: string; // 'ALL' | '1405' | '1404' | '1403' ...
  dateRange: string; // 'ALL' | '1M' | '3M' | '6M' | '1Y'
  unitName: string; // 'ALL' | specific unit
  permitType: string; // 'ALL' | 'HOT' | 'COLD' | 'CONFINED_SPACE' | 'ATTACHED'
  roleType: string; // 'ALL' | 'areaResponsible' | 'seniorShiftSupervisor' | 'workPerformer' | 'safetyUnitSigner'
  searchQuery: string;
}

export const MONTH_NAMES_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export function extractJalaliYear(dateStr?: string): string {
  if (!dateStr) {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(new Date());
    } catch {
      return '1404';
    }
  }
  const parts = dateStr.trim().split('/');
  if (parts.length >= 1 && parts[0].length === 4) {
    return parts[0];
  }
  return '1404';
}

export function extractJalaliMonth(dateStr?: string): number {
  if (!dateStr) return 1;
  const parts = dateStr.trim().split('/');
  if (parts.length >= 2) {
    const m = parseInt(parts[1], 10);
    return !isNaN(m) && m >= 1 && m <= 12 ? m : 1;
  }
  return 1;
}

// Calculate total defects of an audit including 30 inspection items and missed hazards/PPE/precautions
export function getAuditTotalDefects(audit: PtwAuditRecord): number {
  if (audit.defectsCount !== undefined && audit.defectsCount !== null) {
    return audit.defectsCount;
  }
  const qDefects = audit.inspectionItems?.filter(i => i.status === 'O' || i.status === 'DEFECT').length || 0;
  const missedHaz = audit.environmentalHazards?.filter(h => h.missed).length || 0;
  const missedPpe = audit.requiredPpe?.filter(p => p.missed).length || 0;
  const missedPrec = audit.precautionsTaken?.filter(p => p.missed).length || 0;
  return qDefects + missedHaz + missedPpe + missedPrec;
}

// Filter audits according to dashboard state
export function filterAuditsForDashboard(
  audits: PtwAuditRecord[],
  filters: DashboardFilterState
): PtwAuditRecord[] {
  return audits.filter(audit => {
    // 1. Year Filter
    if (filters.year !== 'ALL') {
      const auditYear = extractJalaliYear(audit.auditDate);
      if (auditYear !== filters.year) return false;
    }

    // 2. Unit Filter
    if (filters.unitName !== 'ALL') {
      if (audit.unitName !== filters.unitName) return false;
    }

    // 3. Permit Type Filter
    if (filters.permitType !== 'ALL') {
      if (filters.permitType === 'HOT' && audit.permitType !== 'HOT') return false;
      if (filters.permitType === 'COLD' && audit.permitType !== 'COLD') return false;
      if (filters.permitType === 'CONFINED_SPACE') {
        const isConfined = audit.permitType === 'CONFINED_SPACE' || audit.attachedPermitType === 'ConfinedSpace';
        if (!isConfined) return false;
      }
      if (filters.permitType === 'ATTACHED') {
        const hasAttached = audit.hasAttachedPermit || (audit.attachedPermitType && audit.attachedPermitType !== 'NONE');
        if (!hasAttached) return false;
      }
    }

    // 4. Role presence filter
    if (filters.roleType !== 'ALL') {
      if (filters.roleType === 'areaResponsible' && !audit.signers?.areaResponsibleName?.trim()) return false;
      if (filters.roleType === 'seniorShiftSupervisor' && !audit.signers?.seniorShiftSupervisorName?.trim()) return false;
      if (filters.roleType === 'workPerformer' && !audit.signers?.workPerformerName?.trim()) return false;
      if (filters.roleType === 'safetyUnitSigner' && !audit.signers?.safetyUnitSignerName?.trim() && !audit.hseAuditor?.auditorName?.trim()) return false;
    }

    // 5. Search query filter
    if (filters.searchQuery?.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const match = 
        audit.permitNumber?.toLowerCase().includes(q) ||
        audit.unitName?.toLowerCase().includes(q) ||
        audit.subUnitName?.toLowerCase().includes(q) ||
        audit.workDescription?.toLowerCase().includes(q) ||
        audit.signers?.areaResponsibleName?.toLowerCase().includes(q) ||
        audit.signers?.seniorShiftSupervisorName?.toLowerCase().includes(q) ||
        audit.signers?.workPerformerName?.toLowerCase().includes(q) ||
        audit.signers?.safetyUnitSignerName?.toLowerCase().includes(q) ||
        audit.hseAuditor?.auditorName?.toLowerCase().includes(q) ||
        audit.defectsAndNonConformances?.toLowerCase().includes(q);

      if (!match) return false;
    }

    return true;
  });
}

// 1. Compute Top 10 Defective Personnel for a specific role
export function computeTopDefectivePersonnel(
  audits: PtwAuditRecord[],
  roleKey: RoleType
): DefectPersonStat[] {
  const map = new Map<string, {
    totalAudits: number;
    defectiveAudits: number;
    totalDefectsSum: number;
    criticalCount: number;
    auditIds: string[];
  }>();

  const getRoleName = (a: PtwAuditRecord): string => {
    switch (roleKey) {
      case 'areaResponsible':
        return a.signers?.areaResponsibleName?.trim() || '';
      case 'seniorShiftSupervisor':
        return a.signers?.seniorShiftSupervisorName?.trim() || '';
      case 'workPerformer':
        return a.signers?.workPerformerName?.trim() || '';
      case 'safetyUnitSigner':
        return a.signers?.safetyUnitSignerName?.trim() || a.hseAuditor?.auditorName?.trim() || '';
    }
  };

  const getRoleTitleFa = (): string => {
    switch (roleKey) {
      case 'areaResponsible': return 'مسئول محوطه';
      case 'seniorShiftSupervisor': return 'کشیک ارشد مجتمع';
      case 'workPerformer': return 'مجری کار';
      case 'safetyUnitSigner': return 'نماینده واحد ایمنی (HSE)';
    }
  };

  audits.forEach(audit => {
    const rawName = getRoleName(audit);
    if (!rawName) return;

    // Clean up title suffixes if needed for consistent grouping
    const cleanName = rawName.replace(/[\(\[\{].*?[\)\]\}]/g, '').trim() || rawName;

    const defectsInAudit = getAuditTotalDefects(audit);
    const hasDefect = defectsInAudit > 0;
    const isCritical = audit.status === 'CRITICAL_NC';

    const existing = map.get(cleanName) || {
      totalAudits: 0,
      defectiveAudits: 0,
      totalDefectsSum: 0,
      criticalCount: 0,
      auditIds: []
    };

    existing.totalAudits += 1;
    if (hasDefect) {
      existing.defectiveAudits += 1;
      existing.totalDefectsSum += defectsInAudit;
    }
    if (isCritical) {
      existing.criticalCount += 1;
    }
    existing.auditIds.push(audit.id);

    map.set(cleanName, existing);
  });

  const list: DefectPersonStat[] = [];

  map.forEach((val, name) => {
    const defectPct = val.totalAudits > 0 
      ? Number(((val.defectiveAudits / val.totalAudits) * 100).toFixed(1))
      : 0;

    list.push({
      rank: 0,
      personName: name,
      role: roleKey,
      roleTitleFa: getRoleTitleFa(),
      totalAuditsCount: val.totalAudits,
      defectiveAuditsCount: val.defectiveAudits,
      totalDefectsSum: val.totalDefectsSum,
      defectPercentage: defectPct,
      complianceRate: Number((100 - defectPct).toFixed(1)),
      criticalCount: val.criticalCount,
      auditIds: val.auditIds
    });
  });

  // Sort primarily by total defects sum (descending), then by defective audits count, then by total audits
  list.sort((a, b) => {
    if (b.totalDefectsSum !== a.totalDefectsSum) {
      return b.totalDefectsSum - a.totalDefectsSum;
    }
    if (b.defectiveAuditsCount !== a.defectiveAuditsCount) {
      return b.defectiveAuditsCount - a.defectiveAuditsCount;
    }
    return b.totalAuditsCount - a.totalAuditsCount;
  });

  // Assign ranks
  return list.slice(0, 10).map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));
}

// 2. Compute Environmental Hazards Defects (فقط اقلام انتخاب‌شده یا ثبت‌شده دستی توسط کاربر)
export function computeHazardDefectStats(audits: PtwAuditRecord[]): DefectCategoryItem[] {
  const hazardDefectMap = new Map<string, {
    titleFa: string;
    category: string;
    count: number;
    remarks: string[];
    permitIds: Set<string>;
  }>();

  const addHazardDefect = (key: string, titleFa: string, cat: string, remark: string, permitId: string) => {
    const existing = hazardDefectMap.get(key) || {
      titleFa,
      category: cat,
      count: 0,
      remarks: [],
      permitIds: new Set()
    };
    existing.count += 1;
    if (remark && existing.remarks.length < 3) existing.remarks.push(remark);
    existing.permitIds.add(permitId);
    hazardDefectMap.set(key, existing);
  };

  audits.forEach(a => {
    // فقط اقلام خطرناک محیطی که کاربر به صورت دستی به عنوان عدم انطباق (الزامیِ قید نشده) ثبت کرده است
    a.environmentalHazards?.forEach(h => {
      if (h.missed) {
        const itemLabel = h.labelFa?.trim() || 'شرایط خطرناک نامشخص';
        addHazardDefect(
          `haz_missed_${h.id || itemLabel}`,
          `عدم انتخاب شرط خطرناک الزامی «${itemLabel}» در پروانه کار`,
          'شرایط خطرناک الزامی انتخاب‌نشده',
          `پروانه ${a.permitNumber}: خطر الزامی ${itemLabel} انتخاب نشده بود`,
          a.id
        );
      }
    });
  });

  // اگر هیچ موردی توسط کاربر ثبت نشده باشد، کارت‌ها در حالت اولیه کاملاً خالی خواهند بود
  if (hazardDefectMap.size === 0) {
    return [];
  }

  const list: DefectCategoryItem[] = [];
  let totalHazDefects = 0;
  hazardDefectMap.forEach(v => { totalHazDefects += v.count; });

  hazardDefectMap.forEach((val, key) => {
    list.push({
      id: key,
      titleFa: val.titleFa,
      category: val.category,
      defectCount: val.count,
      percentage: totalHazDefects > 0 ? Number(((val.count / totalHazDefects) * 100).toFixed(1)) : 0,
      sampleRemarks: val.remarks,
      associatedPermitsCount: val.permitIds.size,
      permitIds: Array.from(val.permitIds)
    });
  });

  return list.sort((a, b) => b.defectCount - a.defectCount);
}

// 3. Compute PPE Defects (فقط اقلام انتخاب‌شده یا ثبت‌شده دستی توسط کاربر)
export function computePpeDefectStats(audits: PtwAuditRecord[]): DefectCategoryItem[] {
  const ppeDefectMap = new Map<string, {
    titleFa: string;
    category: string;
    count: number;
    remarks: string[];
    permitIds: Set<string>;
  }>();

  const addPpeDefect = (key: string, titleFa: string, cat: string, remark: string, permitId: string) => {
    const existing = ppeDefectMap.get(key) || {
      titleFa,
      category: cat,
      count: 0,
      remarks: [],
      permitIds: new Set()
    };
    existing.count += 1;
    if (remark && existing.remarks.length < 3) existing.remarks.push(remark);
    existing.permitIds.add(permitId);
    ppeDefectMap.set(key, existing);
  };

  audits.forEach(a => {
    // فقط اقلام تجهیزات حفاظت فردی (PPE) که کاربر به عنوان عدم انطباق (الزامیِ قید نشده) ثبت کرده است
    a.requiredPpe?.forEach(p => {
      if (p.missed) {
        const itemLabel = p.labelFa?.trim() || 'تجهیز حفاظت فردی نامشخص';
        addPpeDefect(
          `ppe_missed_${p.id || itemLabel}`,
          `عدم انتخاب و درج وسیله حفاظت فردی الزامی «${itemLabel}» در پروانه کار`,
          p.groupFa || 'تجهیزات PPE الزامی انتخاب‌نشده',
          `پروانه ${a.permitNumber}: تجهیز الزامی ${itemLabel} در پروانه انتخاب نشده بود`,
          a.id
        );
      }
    });
  });

  // در صورتی که کاربری موردی ثبت نکرده باشد، کارت کاملاً خالی است
  if (ppeDefectMap.size === 0) {
    return [];
  }

  const list: DefectCategoryItem[] = [];
  let totalPpeDefects = 0;
  ppeDefectMap.forEach(v => { totalPpeDefects += v.count; });

  ppeDefectMap.forEach((val, key) => {
    list.push({
      id: key,
      titleFa: val.titleFa,
      category: val.category,
      defectCount: val.count,
      percentage: totalPpeDefects > 0 ? Number(((val.count / totalPpeDefects) * 100).toFixed(1)) : 0,
      sampleRemarks: val.remarks,
      associatedPermitsCount: val.permitIds.size,
      permitIds: Array.from(val.permitIds)
    });
  });

  return list.sort((a, b) => b.defectCount - a.defectCount);
}

// 4. Compute Precautions Defects (فقط اقلام انتخاب‌شده یا ثبت‌شده دستی توسط کاربر)
export function computePrecautionsDefectStats(audits: PtwAuditRecord[]): DefectCategoryItem[] {
  const precDefectMap = new Map<string, {
    titleFa: string;
    category: string;
    count: number;
    remarks: string[];
    permitIds: Set<string>;
  }>();

  const addPrecDefect = (key: string, titleFa: string, cat: string, remark: string, permitId: string) => {
    const existing = precDefectMap.get(key) || {
      titleFa,
      category: cat,
      count: 0,
      remarks: [],
      permitIds: new Set()
    };
    existing.count += 1;
    if (remark && existing.remarks.length < 3) existing.remarks.push(remark);
    existing.permitIds.add(permitId);
    precDefectMap.set(key, existing);
  };

  audits.forEach(a => {
    // فقط تمهیدات و پیش‌بینی‌های ایمنی که کاربر به صورت دستی به عنوان عدم انطباق (الزامیِ قید نشده) ثبت کرده است
    a.precautionsTaken?.forEach(pr => {
      if (pr.missed) {
        const itemLabel = pr.labelFa?.trim() || 'پیش‌بینی ایمنی نامشخص';
        addPrecDefect(
          `prec_missed_${pr.id || itemLabel}`,
          `عدم انتخاب و درج پیش‌بینی الزامی «${itemLabel}» در پروانه کار`,
          'تمهیدات الزامی انتخاب‌نشده',
          `پروانه ${a.permitNumber}: تمهید الزامی ${itemLabel} در پروانه انتخاب نشده بود`,
          a.id
        );
      }
    });
  });

  // در حالت اولیه یا عدم وجود خطا، کارت کاملاً خالی می‌ماند
  if (precDefectMap.size === 0) {
    return [];
  }

  const list: DefectCategoryItem[] = [];
  let totalPrecDefects = 0;
  precDefectMap.forEach(v => { totalPrecDefects += v.count; });

  precDefectMap.forEach((val, key) => {
    list.push({
      id: key,
      titleFa: val.titleFa,
      category: val.category,
      defectCount: val.count,
      percentage: totalPrecDefects > 0 ? Number(((val.count / totalPrecDefects) * 100).toFixed(1)) : 0,
      sampleRemarks: val.remarks,
      associatedPermitsCount: val.permitIds.size,
      permitIds: Array.from(val.permitIds)
    });
  });

  return list.sort((a, b) => b.defectCount - a.defectCount);
}

// 5. Compute Permit Type Defect Distribution (توزیع خطا بر اساس نوع پروانه کار)
export function computePermitTypeDistribution(audits: PtwAuditRecord[]): PermitTypeDistribution[] {
  const typesConfig: {
    key: string;
    titleFa: string;
    matcher: (a: PtwAuditRecord) => boolean;
    color: string;
  }[] = [
    {
      key: 'HOT',
      titleFa: 'پروانه کار گرم (Hot Work)',
      matcher: (a) => a.permitType === 'HOT',
      color: '#ef4444' // red
    },
    {
      key: 'COLD',
      titleFa: 'پروانه کار سرد (Cold Work)',
      matcher: (a) => a.permitType === 'COLD' && (!a.hasAttachedPermit || a.attachedPermitType === 'NONE'),
      color: '#3b82f6' // blue
    },
    {
      key: 'CONFINED_SPACE',
      titleFa: 'ورود به فضای بسته (Confined Space)',
      matcher: (a) => a.permitType === 'CONFINED_SPACE' || a.attachedPermitType === 'ConfinedSpace',
      color: '#8b5cf6' // purple
    },
    {
      key: 'ATTACHED',
      titleFa: 'پروانه‌های کار الحاقی و تکمیلی',
      matcher: (a) => a.hasAttachedPermit || (a.attachedPermitType && a.attachedPermitType !== 'NONE' && a.attachedPermitType !== 'ConfinedSpace'),
      color: '#f59e0b' // amber
    }
  ];

  return typesConfig.map(t => {
    const matchedAudits = audits.filter(t.matcher);
    const totalCount = matchedAudits.length;
    let defectiveCount = 0;
    let totalDefectsSum = 0;
    let totalScoreSum = 0;

    matchedAudits.forEach(a => {
      const defects = getAuditTotalDefects(a);
      if (defects > 0) {
        defectiveCount++;
        totalDefectsSum += defects;
      }
      totalScoreSum += (a.complianceScore ?? 100);
    });

    const cleanCount = totalCount - defectiveCount;
    const defectRate = totalCount > 0 ? Number(((defectiveCount / totalCount) * 100).toFixed(1)) : 0;
    const avgComplianceScore = totalCount > 0 ? Number((totalScoreSum / totalCount).toFixed(1)) : 100;

    return {
      permitTypeKey: t.key,
      titleFa: t.titleFa,
      totalCount,
      defectiveCount,
      cleanCount,
      totalDefectsSum,
      defectRate,
      avgComplianceScore,
      color: t.color
    };
  });
}

// 6. Compute Multi-Year Trends and Annual Comparisons (روند سالانه ممیزی پروانه کار و مقایسه سال‌ها)
export function computeYearlyAuditTrends(
  audits: PtwAuditRecord[],
  historicalStats?: PtwHistoricalYearStat[]
): YearlyTrendStat[] {
  const yearsMap = new Map<string, {
    totalAudits: number;
    defectiveAudits: number;
    totalDefectsSum: number;
    totalScoreSum: number;
    hotCount: number;
    coldCount: number;
    confinedCount: number;
    attachedCount: number;
  }>();

  // 1. Process real system audits (محاسبه خودکار بر اساس ممیزی‌های واقعی ثبت‌شده در سامانه)
  audits.forEach(a => {
    const year = extractJalaliYear(a.auditDate);
    const defects = getAuditTotalDefects(a);
    const hasDefect = defects > 0;

    const existing = yearsMap.get(year) || {
      totalAudits: 0,
      defectiveAudits: 0,
      totalDefectsSum: 0,
      totalScoreSum: 0,
      hotCount: 0,
      coldCount: 0,
      confinedCount: 0,
      attachedCount: 0
    };

    existing.totalAudits += 1;
    if (hasDefect) {
      existing.defectiveAudits += 1;
      existing.totalDefectsSum += defects;
    }
    existing.totalScoreSum += (a.complianceScore ?? 100);

    if (a.permitType === 'HOT') existing.hotCount++;
    else if (a.permitType === 'COLD') existing.coldCount++;
    else if (a.permitType === 'CONFINED_SPACE') existing.confinedCount++;

    if (a.hasAttachedPermit || (a.attachedPermitType && a.attachedPermitType !== 'NONE')) {
      existing.attachedCount++;
      if (a.attachedPermitType === 'ConfinedSpace') {
        existing.confinedCount++;
      }
    }

    yearsMap.set(year, existing);
  });

  const list: YearlyTrendStat[] = [];
  const systemYears = new Set<string>();

  yearsMap.forEach((val, year) => {
    systemYears.add(year);
    const cleanAudits = Math.max(0, val.totalAudits - val.defectiveAudits);
    const defectRate = val.totalAudits > 0 
      ? Number(((val.defectiveAudits / val.totalAudits) * 100).toFixed(1)) 
      : 0;
    // میانگین امتیاز انطباق در سال جاری به صورت کاملاً خودکار از روی ممیزی‌های واقعی محاسبه می‌شود
    const avgScore = val.totalAudits > 0 
      ? Number((val.totalScoreSum / val.totalAudits).toFixed(1)) 
      : 100;

    list.push({
      year,
      totalAudits: val.totalAudits,
      defectiveAudits: val.defectiveAudits,
      cleanAudits,
      defectRate,
      avgComplianceScore: avgScore,
      totalDefectsSum: val.totalDefectsSum,
      hotPermitCount: val.hotCount,
      coldPermitCount: val.coldCount,
      confinedSpaceCount: val.confinedCount,
      attachedPermitCount: val.attachedCount,
      isManualEntry: false,
      source: 'system'
    });
  });

  // 2. Incorporate historical manual entry stats for past years
  if (Array.isArray(historicalStats)) {
    const historicalProcessed = new Set<string>();
    historicalStats.forEach(hist => {
      const yr = (hist.year || '').trim();
      if (!yr) return;
      // If this year already has real recorded audits in the system or already added from manual stats, do not add duplicate
      if (!systemYears.has(yr) && !historicalProcessed.has(yr)) {
        historicalProcessed.add(yr);
        const cleanAudits = Math.max(0, hist.totalAudits - hist.defectiveAudits);
        const defectRate = hist.defectRate !== undefined && hist.defectRate !== null
          ? Number(hist.defectRate)
          : (hist.totalAudits > 0 ? Number(((hist.defectiveAudits / hist.totalAudits) * 100).toFixed(1)) : 0);

        list.push({
          year: yr,
          totalAudits: hist.totalAudits,
          defectiveAudits: hist.defectiveAudits,
          cleanAudits,
          defectRate,
          avgComplianceScore: Number(hist.avgComplianceScore) || 0,
          totalDefectsSum: hist.totalDefectsSum,
          hotPermitCount: hist.hotPermitCount || 0,
          coldPermitCount: hist.coldPermitCount || 0,
          confinedSpaceCount: hist.confinedSpaceCount || 0,
          attachedPermitCount: hist.attachedPermitCount || 0,
          isManualEntry: true,
          source: 'manual',
          notes: hist.notes
        });
      }
    });
  }

  // If list is completely empty, fallback to current year
  if (list.length === 0) {
    const currentYear = extractJalaliYear();
    list.push({
      year: currentYear,
      totalAudits: 0,
      defectiveAudits: 0,
      cleanAudits: 0,
      defectRate: 0,
      avgComplianceScore: 100,
      totalDefectsSum: 0,
      hotPermitCount: 0,
      coldPermitCount: 0,
      confinedSpaceCount: 0,
      attachedPermitCount: 0,
      isManualEntry: false,
      source: 'system'
    });
  }

  // Sort chronological (e.g. 1401, 1402, 1403, 1404, 1405)
  return list.sort((a, b) => a.year.localeCompare(b.year));
}

// 7. Monthly trend for a selected year
export function computeMonthlyTrendForYear(audits: PtwAuditRecord[], year: string): MonthlyTrendStat[] {
  const monthMap = new Map<number, { total: number; defective: number; scoreSum: number }>();
  for (let m = 1; m <= 12; m++) {
    monthMap.set(m, { total: 0, defective: 0, scoreSum: 0 });
  }

  audits.forEach(a => {
    const aYear = extractJalaliYear(a.auditDate);
    if (year !== 'ALL' && aYear !== year) return;

    const month = extractJalaliMonth(a.auditDate);
    const defects = getAuditTotalDefects(a);

    const mData = monthMap.get(month)!;
    mData.total += 1;
    if (defects > 0) mData.defective += 1;
    mData.scoreSum += (a.complianceScore ?? 100);
  });

  const result: MonthlyTrendStat[] = [];
  for (let m = 1; m <= 12; m++) {
    const data = monthMap.get(m)!;
    const defectRate = data.total > 0 ? Number(((data.defective / data.total) * 100).toFixed(1)) : 0;
    const complianceRate = data.total > 0 ? Number((data.scoreSum / data.total).toFixed(1)) : 100;

    result.push({
      monthIndex: m,
      monthName: MONTH_NAMES_FA[m - 1],
      totalAudits: data.total,
      defectiveAudits: data.defective,
      defectRate,
      complianceRate
    });
  }

  return result;
}

// 8. Unit Defect Rankings
export function computeUnitDefectRankings(audits: PtwAuditRecord[]): UnitDefectStat[] {
  const map = new Map<string, { total: number; defective: number; totalDefects: number; scoreSum: number }>();

  audits.forEach(a => {
    const u = a.unitName || 'نامشخص';
    const defects = getAuditTotalDefects(a);

    const existing = map.get(u) || { total: 0, defective: 0, totalDefects: 0, scoreSum: 0 };
    existing.total += 1;
    if (defects > 0) {
      existing.defective += 1;
      existing.totalDefects += defects;
    }
    existing.scoreSum += (a.complianceScore ?? 100);
    map.set(u, existing);
  });

  const list: UnitDefectStat[] = [];
  map.forEach((val, unitName) => {
    list.push({
      unitName,
      totalAudits: val.total,
      defectiveAudits: val.defective,
      totalDefects: val.totalDefects,
      defectRate: val.total > 0 ? Number(((val.defective / val.total) * 100).toFixed(1)) : 0,
      avgScore: val.total > 0 ? Number((val.scoreSum / val.total).toFixed(1)) : 100
    });
  });

  return list.sort((a, b) => b.totalDefects - a.totalDefects);
}
