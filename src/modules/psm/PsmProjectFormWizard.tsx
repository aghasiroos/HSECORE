import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Users,
  Building2,
  Target,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Save,
  Sparkles,
  FileCheck,
  ShieldCheck,
  UserCheck,
  Briefcase,
  Layers,
  CheckSquare,
  Square,
  X,
  Edit3,
  Award,
  RefreshCw,
  FolderTree,
  Clock,
  DollarSign,
} from 'lucide-react';
import PersianDatePicker from '../../components/common/PersianDatePicker';
import {
  formatJalaliString,
  parseDateString,
  getCurrentJalaliDate,
  gregorianToJalaliStr,
} from '../../utils/jalaliDate';

export interface PersonnelRecord {
  id: number | string;
  personnelCode: string;
  nationalCode?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string;
  unitName: string;
  departmentName?: string;
  unitId?: number | string | null;
  status?: string;
}

export interface TeamMemberItem {
  personnelId: number | string;
  personnelCode: string;
  fullName: string;
  jobTitle: string;
  unitName: string;
  psmRole: string;
}

export interface CoveredUnitItem {
  unitId: string;
  code: string;
  name: string;
  departmentName?: string;
  siteName?: string;
  companyName?: string;
  hierarchyPath: string;
  isPrimary: boolean;
  riskClass?: string;
}

export interface QuantitativeObjectiveItem {
  id: string;
  code: string;
  title: string;
  targetValue: number;
  unit: string;
  baselineValue: number;
  currentValue: number;
  expectedFinalValue: number;
  dueDate: string;
  responsiblePersonId: number | string | null;
  responsiblePersonName: string;
  isCustom?: boolean;
}

export interface QualitativeObjectiveItem {
  id: string;
  code: string;
  title: string;
  description?: string;
  isCustom?: boolean;
}

export interface ProjectMilestoneItem {
  id: string;
  orderIndex: number;
  title: string;
  description: string;
  plannedDate: string;
  responsiblePersonId: number | string | null;
  responsiblePersonName: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
  progressPct: number;
  verificationEvidence: string;
  isCustom?: boolean;
}

export interface PsmProjectFormPayload {
  id?: number;
  projectCode: string;
  code: string;
  title: string;
  name: string;
  scopeDescription: string;
  scope: string;
  startDate: string;
  endDate: string;
  projectManagerId: number | null;
  projectManagerName: string;
  projectSponsorId: number | null;
  projectSponsorName: string;
  sponsorName: string;
  coveredUnits: CoveredUnitItem[];
  teamMembers: TeamMemberItem[];
  quantitativeGoals: QuantitativeObjectiveItem[];
  qualitativeGoals: QualitativeObjectiveItem[];
  milestones: ProjectMilestoneItem[];
  budgetAllocated: number;
  allocatedBudget: number;
  budgetSpent: number;
  spentBudget: number;
  resourcesSummary: string;
  overallStatus: string;
  status: string;
  isDraft: boolean;
}

interface PsmProjectFormWizardProps {
  mode: 'create' | 'edit';
  initialData?: any;
  centralOrg: {
    companies?: any[];
    sites?: any[];
    departments?: any[];
    units?: any[];
    orgNodes?: any[];
    personnel?: any[];
  };
  onSubmit: (payload: PsmProjectFormPayload) => Promise<void>;
  onCancel?: () => void;
  isInline?: boolean;
}

export const SUGGESTED_QUANTITATIVE_OBJECTIVES: Omit<QuantitativeObjectiveItem, 'dueDate' | 'responsiblePersonId' | 'responsiblePersonName'>[] = [
  {
    id: 'QO-01',
    code: 'PSM-QO-01',
    title: 'تکمیل ۱۰۰ درصد ارزیابی اولیه PSM',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 0,
    currentValue: 0,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-02',
    code: 'PSM-QO-02',
    title: 'شناسایی و ثبت ۱۰۰ درصد شکاف‌های موجود',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 0,
    currentValue: 0,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-03',
    code: 'PSM-QO-03',
    title: 'تکمیل بانک اطلاعات ایمنی فرایند (PSI)',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 25,
    currentValue: 25,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-04',
    code: 'PSM-QO-04',
    title: 'انجام مطالعات شناسایی خطرات و ارزیابی ریسک (PHA)',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 20,
    currentValue: 20,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-05',
    code: 'PSM-QO-05',
    title: 'تکمیل مطالعات HAZOP',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 30,
    currentValue: 30,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-06',
    code: 'PSM-QO-06',
    title: 'تعیین تکلیف ۱۰۰ درصد توصیه‌های بحرانی HAZOP',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 15,
    currentValue: 15,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-07',
    code: 'PSM-QO-07',
    title: 'تکمیل مدارک و دستورالعمل‌های عملیاتی (SOP)',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 40,
    currentValue: 40,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-08',
    code: 'PSM-QO-08',
    title: 'تکمیل برنامه مدیریت یکپارچگی مکانیکی (MI)',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 20,
    currentValue: 20,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-09',
    code: 'PSM-QO-09',
    title: 'تکمیل فرایند مدیریت تغییرات (MOC)',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 35,
    currentValue: 35,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-10',
    code: 'PSM-QO-10',
    title: 'اجرای بررسی آمادگی پیش از راه‌اندازی (PSSR)',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 10,
    currentValue: 10,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-11',
    code: 'PSM-QO-11',
    title: 'آموزش و ارزیابی شایستگی کارکنان مشمول',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 30,
    currentValue: 30,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-12',
    code: 'PSM-QO-12',
    title: 'انجام ممیزی انطباق PSM',
    targetValue: 100,
    unit: 'درصد (%)',
    baselineValue: 0,
    currentValue: 0,
    expectedFinalValue: 100,
  },
  {
    id: 'QO-13',
    code: 'PSM-QO-13',
    title: 'دستیابی به سطح بلوغ هدف تعیین‌شده برای PSM',
    targetValue: 4,
    unit: 'سطح بلوغ (از ۵)',
    baselineValue: 2,
    currentValue: 2,
    expectedFinalValue: 4,
  },
];

export const SUGGESTED_QUALITATIVE_OBJECTIVES: QualitativeObjectiveItem[] = [
  {
    id: 'QL-01',
    code: 'PSM-QL-01',
    title: 'استقرار نظام یکپارچه مدیریت ایمنی فرایند',
    description: 'پیاده‌سازی ساختارمند ۲۰ عنصر CCPS RBPS در واحدهای فرایندی و یوتیلیتی مجتمع',
  },
  {
    id: 'QL-02',
    code: 'PSM-QL-02',
    title: 'ایجاد فرهنگ ایمنی فرایند در سطح مجتمع',
    description: 'نهادینه‌سازی ارزش‌های ایمنی فرایند، درک آسیب‌پذیری و گزارش‌دهی پیشگیرانه حوادث شبه‌حادثه',
  },
  {
    id: 'QL-03',
    code: 'PSM-QL-03',
    title: 'ارتقای مشارکت کارکنان و مدیران',
    description: 'مشارکت فعال نوبت‌کاران، مهندسان فرایند و مدیران ارشد در کمیته‌ها و کارگروه‌های تخصصی PSM',
  },
  {
    id: 'QL-04',
    code: 'PSM-QL-04',
    title: 'ایجاد نظام مدیریت دانش فرایندی',
    description: 'مستندسازی یکپارچه دانش فنی، نقشه‌های P&ID به‌روز، شیمی فرایند و تاریخچه تغییرات ایمنی',
  },
  {
    id: 'QL-05',
    code: 'PSM-QL-05',
    title: 'بهبود انضباط عملیاتی',
    description: 'اجرای دقیق عملیات در محدوده پنجره‌های عملیاتی ایمن (IOW) و رعایت کامل دستورالعمل‌های بهره‌برداری',
  },
  {
    id: 'QL-06',
    code: 'PSM-QL-06',
    title: 'بهبود مدیریت تغییرات',
    description: 'کنترل ریسک تمامی تغییرات فنی، تجهیزاتی، عملیاتی و سازمانی پیش از اعمال در واحدها',
  },
  {
    id: 'QL-07',
    code: 'PSM-QL-07',
    title: 'ارتقای قابلیت اطمینان تجهیزات بحرانی',
    description: 'کاهش توقفات اضطراری و حفظ یکپارچگی مکانیکی تجهیزات بحرانی ایمنی (SCE)',
  },
  {
    id: 'QL-08',
    code: 'PSM-QL-08',
    title: 'ایجاد نظام پایش و ارزیابی اثربخشی کنترل‌های ریسک',
    description: 'پایش مستمر شاخص‌های پیشرو (Leading) و پسرو (Lagging) و سلامت لایه‌های حفاظتی (LOPA/SIS)',
  },
  {
    id: 'QL-09',
    code: 'PSM-QL-09',
    title: 'ایجاد سازوکار بهبود مستمر در عناصر PSM',
    description: 'بازنگری مدیریت دوره‌ای، ممیزی انطباق و درس‌آموزی مستمر از رخدادهای صنعت پتروشیمی',
  },
];

export const SUGGESTED_MILESTONES: Omit<ProjectMilestoneItem, 'plannedDate' | 'responsiblePersonId' | 'responsiblePersonName'>[] = [
  {
    id: 'MS-01',
    orderIndex: 1,
    title: 'تصویب منشور و دامنه پروژه',
    description: 'تدوین و تصویب رسمی منشور پروژه، اهداف، واحدهای مشمول و بودجه توسط حامی پروژه و کمیته راهبری',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'سند منشور مصوب امضاشده و صورتجلسه کمیته راهبری PSM',
  },
  {
    id: 'MS-02',
    orderIndex: 2,
    title: 'تشکیل تیم استقرار PSM',
    description: 'صدور ابلاغ رسمی مدیر پروژه، دبیر کمیته و کارگروه‌های تخصصی چندرشته‌ای در سطح مجتمع',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'احکام انتصاب اعضا و ماتریس مسئولیت‌ها (RACI)',
  },
  {
    id: 'MS-03',
    orderIndex: 3,
    title: 'تکمیل ارزیابی اولیه و تعیین وضعیت موجود',
    description: 'ممیزی خط مبنا (Baseline Audit) بر اساس ۲۰ عنصر CCPS RBPS در تمامی واحدهای مشمول پروژه',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'چک‌لیست‌های تکمیل‌شده ارزیابی اولیه و امتیاز بلوغ پایه',
  },
  {
    id: 'MS-04',
    orderIndex: 4,
    title: 'تصویب گزارش تحلیل شکاف (Gap Analysis)',
    description: 'تحلیل ریشه‌ای عدم انطباق‌ها، اولویت‌بندی ریسک شکاف‌ها و تصویب گزارش در دروازه کنترلی G2',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'گزارش رسمی تحلیل شکاف و مصوبه کمیته راهبری',
  },
  {
    id: 'MS-05',
    orderIndex: 5,
    title: 'تصویب برنامه اجرایی و ساختار شکست کار (WBS)',
    description: 'تدوین بسته کاری (Work Packages)، زمان‌بندی تفصیلی، تخصیص منابع و تصویب دروازه G3',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'برنامه زمان‌بندی مصوب (WBS) و ماتریس تخصیص منابع',
  },
  {
    id: 'MS-06',
    orderIndex: 6,
    title: 'تکمیل بانک اطلاعات ایمنی فرایند (PSI)',
    description: 'به‌روزرسانی P&IDها، برگه‌های اطلاعات ایمنی مواد (SDS)، حدود طراحی ایمن و مدارک تجهیزات',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'بانک اطلاعاتی PSI ممیزی‌شده و نقشه‌های As-Built تاییدشده',
  },
  {
    id: 'MS-07',
    orderIndex: 7,
    title: 'تکمیل مطالعات شناسایی خطرات و ارزیابی ریسک (PHA/HAZOP)',
    description: 'بازنگری و تکمیل مطالعات HAZOP، LOPA و ثبت کامل توصیه‌های بحرانی در سامانه',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'گزارش نهایی مطالعات PHA/HAZOP و لیست توصیه‌های مصوب',
  },
  {
    id: 'MS-08',
    orderIndex: 8,
    title: 'تکمیل برنامه‌های رفع نواقص و اقدامات اصلاحی',
    description: 'اجرای اقدامات اصلاحی و پیشگیرانه (CAPA) استخراج‌شده از تحلیل شکاف و مطالعات HAZOP',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'فرم‌های بسته‌شدن CAPA و شواهد فنی اجرای تغییرات (MOC)',
  },
  {
    id: 'MS-09',
    orderIndex: 9,
    title: 'تکمیل مدارک و مستندات عناصر PSM',
    description: 'تدوین و ابلاغ روش‌های اجرایی، دستورالعمل‌های عملیاتی (SOP)، یکپارچگی مکانیکی (MI) و PSSR',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'مجموعه مستندات و رویه‌های ابلاغ‌شده در سامانه کنترل مدارک',
  },
  {
    id: 'MS-10',
    orderIndex: 10,
    title: 'اجرای ممیزی و ارزیابی انطباق',
    description: 'انجام ممیزی داخلی انطباق کامل ۲۰ عنصر PSM و ارزیابی مجدد سطح بلوغ واحدها',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'گزارش ممیزی انطباق و کارنامه ارتقای سطح بلوغ PSM',
  },
  {
    id: 'MS-11',
    orderIndex: 11,
    title: 'تأیید اثربخشی اقدامات اصلاحی',
    description: 'صحه‌گذاری میدانی اثربخشی کنترل‌های مهندسی و مدیریتی مستقرشده در واحدهای عملیاتی',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'گزارش صحه‌گذاری اثربخشی و شاخص‌های عملکردی KPI',
  },
  {
    id: 'MS-12',
    orderIndex: 12,
    title: 'عبور از دروازه‌های کنترلی پروژه (Stage Gates)',
    description: 'تکمیل مدارک و اخذ تاییدیه رسمی دروازه‌های کنترلی G1 تا G6 منطبق با استاندارد حاکمیتی',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'گواهی تایید دروازه‌های کنترلی G1 الی G6 در سامانه',
  },
  {
    id: 'MS-13',
    orderIndex: 13,
    title: 'تأیید نهایی مدیریت و تحویل پروژه',
    description: 'برگزاری جلسه اختتامیه، تایید نهایی حامی پروژه و انتقال به چرخه بهبود مستمر بهره‌برداری',
    status: 'PLANNED',
    progressPct: 0,
    verificationEvidence: 'صورتجلسه اختتامیه و گواهی تحویل نهایی پروژه استقرار PSM',
  },
];

const PSM_TEAM_ROLES = [
  'عضو کمیته راهبری PSM',
  'دبیر کمیته PSM',
  'مسئول عنصر اطلاعات ایمنی فرایند (PSI)',
  'تسهیل‌گر و سرپرست مطالعات PHA/HAZOP',
  'مسئول یکپارچگی مکانیکی و قابلیت اطمینان (MI)',
  'مسئول مدیریت تغییر و آمادگی راه‌اندازی (MOC/PSSR)',
  'نماینده عملیات و دستورالعمل‌های عملیاتی (SOP)',
  'مسئول آموزش و صلاحیت حرفه‌ای PSM',
  'بازرس و ممیز انطباق ایمنی فرایند',
  'کارشناس مهندسی فرایند و ایمنی',
];

function toShamsiSafe(val: any, fallback = ''): string {
  if (!val) return fallback;
  const s = String(val).trim();
  if (/^1[34]\d{2}\/\d{2}\/\d{2}$/.test(s)) return s;
  const formatted = gregorianToJalaliStr(s);
  if (formatted) return formatted;
  const parsed = parseDateString(s);
  if (parsed.jalali) {
    return formatJalaliString(parsed.jalali.jy, parsed.jalali.jm, parsed.jalali.jd);
  }
  return fallback;
}

function toTimestampMs(dateStr: string): number | null {
  const parsed = parseDateString(dateStr);
  if (!parsed.gregorian) return null;
  const { gy, gm, gd } = parsed.gregorian;
  return new Date(gy, gm - 1, gd).getTime();
}

function compareShamsiDates(startStr: string, endStr: string): boolean {
  const s = toTimestampMs(startStr);
  const e = toTimestampMs(endStr);
  if (s === null || e === null) return true;
  return e >= s;
}

function calculateDurationDays(startStr: string, endStr: string): number | null {
  const s = toTimestampMs(startStr);
  const e = toTimestampMs(endStr);
  if (s === null || e === null) return null;
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return diff;
}

export const PsmProjectFormWizard: React.FC<PsmProjectFormWizardProps> = ({
  mode,
  initialData,
  centralOrg,
  onSubmit,
  onCancel,
  isInline = false,
}) => {
  const todayShamsi = useMemo(() => getCurrentJalaliDate(false), []);
  const defaultEndDateShamsi = useMemo(() => {
    const parts = todayShamsi.split('/');
    const nextYear = (Number(parts[0]) || 1404) + 1;
    return `${nextYear}/${parts[1] || '06'}/${parts[2] || '30'}`;
  }, [todayShamsi]);

  // Normalize central personnel list
  const personnelList: PersonnelRecord[] = useMemo(() => {
    const raw = centralOrg?.personnel || [];
    return raw.map((p: any) => {
      const extra = p.extraData && typeof p.extraData === 'object' ? p.extraData : {};
      const firstName = p.firstName || extra.firstName || '';
      const lastName = p.lastName || extra.lastName || '';
      const fullName =
        p.fullName ||
        `${firstName} ${lastName}`.trim() ||
        extra.fullName ||
        p.personnelCode ||
        `پرسنل #${p.id}`;
      return {
        id: p.id,
        personnelCode: String(p.personnelCode || extra.personnelCode || p.id),
        nationalCode: String(p.nationalCode || extra.nationalCode || ''),
        firstName,
        lastName,
        fullName,
        jobTitle: String(p.jobTitle || extra.jobTitle || extra.position || extra.role || ''),
        unitName: String(p.unitName || extra.unitName || extra.unit || extra.department || ''),
        departmentName: String(p.departmentName || extra.departmentName || extra.department || ''),
        unitId: p.unitId || extra.unitId || null,
        status: p.status || extra.status || 'ACTIVE',
      };
    });
  }, [centralOrg?.personnel]);

  // Normalize central organizational hierarchy for tree view strictly from real database records (zero default units/complexes)
  const orgTreeData = useMemo(() => {
    const companies = Array.isArray(centralOrg?.companies) ? [...centralOrg.companies] : [];
    const sites = Array.isArray(centralOrg?.sites) ? [...centralOrg.sites] : [];
    const departments = Array.isArray(centralOrg?.departments) ? [...centralOrg.departments] : [];
    const rawUnits = Array.isArray(centralOrg?.units) ? [...centralOrg.units] : [];
    const orgNodes = Array.isArray(centralOrg?.orgNodes) ? [...centralOrg.orgNodes] : [];

    const units: CoveredUnitItem[] = [];
    const seenUnitIds = new Set<string>();

    // 1. Units from relational org_units table (if any exist)
    rawUnits.forEach((u: any) => {
      const dept = departments.find((d: any) => Number(d.id) === Number(u.departmentId));
      const site = sites.find((s: any) => Number(s.id) === Number(dept?.siteId));
      const comp = companies.find((c: any) => Number(c.id) === Number(site?.companyId));
      const unitCode = String(u.code || `UNIT-${u.id}`);
      const uid = String(u.id || unitCode);
      if (seenUnitIds.has(uid)) return;
      seenUnitIds.add(uid);

      const pathParts = [comp?.name, site?.name, dept?.name, u.name].filter(Boolean);
      units.push({
        unitId: uid,
        code: unitCode,
        name: String(u.name || unitCode),
        departmentName: String(dept?.name || ''),
        siteName: String(site?.name || ''),
        companyName: String(comp?.name || ''),
        hierarchyPath: pathParts.join(' / '),
        isPrimary: false,
        riskClass: u.riskClass || 'HIGH',
      });
    });

    // 2. Nodes from central Tree Structure (`org_nodes` in system_settings) if user created any in System Settings
    const nodeById = new Map<string, any>();
    orgNodes.forEach((n: any) => {
      if (n && n.id) nodeById.set(String(n.id), n);
    });

    const getPathForNode = (node: any): string[] => {
      const parts: string[] = [];
      let curr = node;
      let guard = 0;
      while (curr && guard < 10) {
        guard++;
        if (curr.name) parts.unshift(String(curr.name));
        curr = curr.parentId ? nodeById.get(String(curr.parentId)) : null;
      }
      return parts;
    };

    orgNodes.forEach((n: any) => {
      if (!n || n.status === 'inactive') return;
      const uid = String(n.id);
      if (seenUnitIds.has(uid)) return;

      // Include selectable operational nodes from tree
      if (n.type === 'Plant' || n.type === 'Area' || n.type === 'Department' || n.type === 'Section' || n.type === 'Site') {
        seenUnitIds.add(uid);
        const parentNode = n.parentId ? nodeById.get(String(n.parentId)) : null;
        const pathParts = getPathForNode(n);
        units.push({
          unitId: uid,
          code: String(n.code || n.id),
          name: String(n.name),
          departmentName: String(parentNode?.name || ''),
          siteName: String(pathParts[0] || ''),
          companyName: String(pathParts[0] || ''),
          hierarchyPath: pathParts.join(' / '),
          isPrimary: false,
          riskClass: 'HIGH',
        });
      }
    });

    return { companies, sites, departments, units, orgNodes };
  }, [centralOrg]);

  // Parse initial state for Create vs Edit
  const [activeStep, setActiveStep] = useState<number>(1);
  const [projectCode, setProjectCode] = useState<string>(() => {
    if (initialData?.projectCode || initialData?.code) {
      return String(initialData.projectCode || initialData.code);
    }
    return `PSM-PRJ-1404-${String(Math.floor(100 + Math.random() * 900))}`;
  });
  const [title, setTitle] = useState<string>(() =>
    String(initialData?.title || initialData?.name || '')
  );
  const [startDate, setStartDate] = useState<string>(() =>
    toShamsiSafe(initialData?.startDateShamsi || initialData?.startDate, todayShamsi)
  );
  const [endDate, setEndDate] = useState<string>(() =>
    toShamsiSafe(initialData?.endDateShamsi || initialData?.endDate, defaultEndDateShamsi)
  );

  const [projectManagerId, setProjectManagerId] = useState<number | null>(() =>
    initialData?.projectManagerId ? Number(initialData.projectManagerId) : null
  );
  const [projectManagerName, setProjectManagerName] = useState<string>(() =>
    String(initialData?.projectManagerName || '')
  );

  const [projectSponsorId, setProjectSponsorId] = useState<number | null>(() =>
    initialData?.projectSponsorId ? Number(initialData.projectSponsorId) : null
  );
  const [projectSponsorName, setProjectSponsorName] = useState<string>(() =>
    String(initialData?.projectSponsorName || initialData?.sponsorName || '')
  );

  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>(() => {
    const raw = Array.isArray(initialData?.teamMembers) ? initialData.teamMembers : [];
    return raw.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const matched = personnelList.find((p) => p.fullName === item.trim());
        return {
          personnelId: matched?.id ?? `legacy-${idx}`,
          personnelCode: matched?.personnelCode ?? '-',
          fullName: item.trim(),
          jobTitle: matched?.jobTitle ?? 'عضو کارگروه تخصصی PSM',
          unitName: matched?.unitName ?? 'مجتمع پتروشیمی رجال',
          psmRole: PSM_TEAM_ROLES[idx % PSM_TEAM_ROLES.length],
        };
      }
      return {
        personnelId: item.personnelId ?? item.id ?? `member-${idx}`,
        personnelCode: String(item.personnelCode || '-'),
        fullName: String(item.fullName || item.name || ''),
        jobTitle: String(item.jobTitle || item.role || 'کارشناس ایمنی فرایند'),
        unitName: String(item.unitName || item.unit || 'مجتمع پتروشیمی رجال'),
        psmRole: String(item.psmRole || item.committeeRole || 'عضو کمیته راهبری PSM'),
      };
    });
  });

  const [coveredUnits, setCoveredUnits] = useState<CoveredUnitItem[]>(() => {
    const raw = Array.isArray(initialData?.coveredUnits) ? initialData.coveredUnits : [];
    const mapped = raw.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const matched = orgTreeData.units.find(
          (u) => u.name === item.trim() || u.code === item.trim()
        );
        return (
          matched
            ? { ...matched, isPrimary: idx === 0 }
            : {
                unitId: `UNIT-${idx + 1}`,
                code: `UNIT-${idx + 1}`,
                name: item.trim(),
                departmentName: '',
                siteName: '',
                companyName: '',
                hierarchyPath: item.trim(),
                isPrimary: idx === 0,
              }
        );
      }
      return {
        unitId: String(item.unitId || item.id || item.code || `UNIT-${idx + 1}`),
        code: String(item.code || `UNIT-${idx + 1}`),
        name: String(item.name || item.unitName || ''),
        departmentName: String(item.departmentName || ''),
        siteName: String(item.siteName || ''),
        companyName: String(item.companyName || ''),
        hierarchyPath: String(
          item.hierarchyPath ||
            [item.companyName, item.departmentName, item.name || item.unitName]
              .filter(Boolean)
              .join(' / ')
        ),
        isPrimary: Boolean(item.isPrimary),
        riskClass: item.riskClass || 'HIGH',
      };
    });
    if (mapped.length > 0 && !mapped.some((u) => u.isPrimary)) {
      mapped[0].isPrimary = true;
    }
    return mapped;
  });

  const [scopeDescription, setScopeDescription] = useState<string>(() =>
    String(initialData?.scopeDescription || initialData?.scope || '')
  );

  const [quantitativeGoals, setQuantitativeGoals] = useState<QuantitativeObjectiveItem[]>(() => {
    const raw = Array.isArray(initialData?.quantitativeGoals) ? initialData.quantitativeGoals : [];
    return raw.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const matched = SUGGESTED_QUANTITATIVE_OBJECTIVES.find((q) => q.title === item.trim());
        return {
          id: matched?.id || `QO-INIT-${idx}`,
          code: matched?.code || `PSM-QO-${String(idx + 1).padStart(2, '0')}`,
          title: item.trim(),
          targetValue: matched?.targetValue ?? 100,
          unit: matched?.unit ?? 'درصد (%)',
          baselineValue: matched?.baselineValue ?? 0,
          currentValue: matched?.currentValue ?? 0,
          expectedFinalValue: matched?.expectedFinalValue ?? 100,
          dueDate: defaultEndDateShamsi,
          responsiblePersonId: null,
          responsiblePersonName: initialData?.projectManagerName || '',
        };
      }
      return {
        id: String(item.id || `QO-${idx + 1}`),
        code: String(item.code || `PSM-QO-${String(idx + 1).padStart(2, '0')}`),
        title: String(item.title || item.objective || ''),
        targetValue: Number(item.targetValue ?? 100),
        unit: String(item.unit || 'درصد (%)'),
        baselineValue: Number(item.baselineValue ?? 0),
        currentValue: Number(item.currentValue ?? 0),
        expectedFinalValue: Number(item.expectedFinalValue ?? item.targetValue ?? 100),
        dueDate: toShamsiSafe(item.dueDate, defaultEndDateShamsi),
        responsiblePersonId: item.responsiblePersonId ?? null,
        responsiblePersonName: String(item.responsiblePersonName || ''),
        isCustom: Boolean(item.isCustom),
      };
    });
  });

  const [qualitativeGoals, setQualitativeGoals] = useState<QualitativeObjectiveItem[]>(() => {
    const raw = Array.isArray(initialData?.qualitativeGoals) ? initialData.qualitativeGoals : [];
    return raw.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const matched = SUGGESTED_QUALITATIVE_OBJECTIVES.find((q) => q.title === item.trim());
        return {
          id: matched?.id || `QL-INIT-${idx}`,
          code: matched?.code || `PSM-QL-${String(idx + 1).padStart(2, '0')}`,
          title: item.trim(),
          description: matched?.description || '',
        };
      }
      return {
        id: String(item.id || `QL-${idx + 1}`),
        code: String(item.code || `PSM-QL-${String(idx + 1).padStart(2, '0')}`),
        title: String(item.title || item.objective || ''),
        description: String(item.description || ''),
        isCustom: Boolean(item.isCustom),
      };
    });
  });

  const [milestones, setMilestones] = useState<ProjectMilestoneItem[]>(() => {
    const raw = Array.isArray(initialData?.milestones) ? initialData.milestones : [];
    return raw.map((item: any, idx: number) => {
      if (typeof item === 'string') {
        const matched = SUGGESTED_MILESTONES.find((m) => m.title === item.trim());
        return {
          id: matched?.id || `MS-INIT-${idx}`,
          orderIndex: idx + 1,
          title: item.trim(),
          description: matched?.description || 'نقطه عطف کلیدی پروژه استقرار مدیریت ایمنی فرایند',
          plannedDate: defaultEndDateShamsi,
          responsiblePersonId: null,
          responsiblePersonName: initialData?.projectManagerName || '',
          status: 'PLANNED',
          progressPct: 0,
          verificationEvidence: matched?.verificationEvidence || 'گزارش رسمی و مصوبه کمیته راهبری PSM',
        };
      }
      return {
        id: String(item.id || `MS-${idx + 1}`),
        orderIndex: Number(item.orderIndex ?? idx + 1),
        title: String(item.title || ''),
        description: String(item.description || ''),
        plannedDate: toShamsiSafe(item.plannedDate || item.dueDate, defaultEndDateShamsi),
        responsiblePersonId: item.responsiblePersonId ?? null,
        responsiblePersonName: String(item.responsiblePersonName || item.ownerName || ''),
        status: (item.status as any) || 'PLANNED',
        progressPct: Number(item.progressPct ?? 0),
        verificationEvidence: String(item.verificationEvidence || item.evidence || 'مستندات و صورتجلسه تایید کمیته PSM'),
        isCustom: Boolean(item.isCustom),
      };
    });
  });

  const [budgetAllocated, setBudgetAllocated] = useState<number>(() =>
    Number(initialData?.budgetAllocated ?? initialData?.allocatedBudget ?? 25000000000)
  );
  const [budgetSpent, setBudgetSpent] = useState<number>(() =>
    Number(initialData?.budgetSpent ?? initialData?.spentBudget ?? 0)
  );
  const [resourcesSummary, setResourcesSummary] = useState<string>(() =>
    String(
      initialData?.resourcesSummary ||
        'تیم چندرشته‌ای مهندسی فرایند، بهره‌برداری، نت، بازرسی فنی و HSE مجتمع پتروشیمی رجال به همراه نرم‌افزار تخصصی PHA/HAZOP و ممیزان ارشد CCPS RBPS'
    )
  );

  // Modals & Popovers State
  const [personnelModalConfig, setPersonnelModalConfig] = useState<{
    open: boolean;
    target:
      | { type: 'PM' }
      | { type: 'SPONSOR' }
      | { type: 'TEAM_MULTI' }
      | { type: 'TEAM_REPLACE'; index: number }
      | { type: 'QO_RESPONSIBLE'; id: string }
      | { type: 'MS_RESPONSIBLE'; id: string }
      | null;
  }>({ open: false, target: null });

  const [personnelSearch, setPersonnelSearch] = useState<string>('');
  const [personnelUnitFilter, setPersonnelUnitFilter] = useState<string>('ALL');

  const [orgModalOpen, setOrgModalOpen] = useState<boolean>(false);
  const [orgSearch, setOrgSearch] = useState<string>('');

  // Objectives & Milestones UI state
  const [qoSearch, setQoSearch] = useState<string>('');
  const [expandedQoId, setExpandedQoId] = useState<string | null>(null);
  const [customQoTitle, setCustomQoTitle] = useState<string>('');
  const [customQoTarget, setCustomQoTarget] = useState<number>(100);
  const [customQoUnit, setCustomQoUnit] = useState<string>('درصد (%)');

  const [qlSearch, setQlSearch] = useState<string>('');
  const [customQlTitle, setCustomQlTitle] = useState<string>('');
  const [customQlDesc, setCustomQlDesc] = useState<string>('');
  const [editingQlId, setEditingQlId] = useState<string | null>(null);

  const [msSearch, setMsSearch] = useState<string>('');
  const [expandedMsId, setExpandedMsId] = useState<string | null>(null);
  const [customMsTitle, setCustomMsTitle] = useState<string>('');
  const [customMsDesc, setCustomMsDesc] = useState<string>('');

  const [submittingMode, setSubmittingMode] = useState<'NONE' | 'DRAFT' | 'FINAL'>('NONE');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Derived Validations
  const isDateRangeValid = useMemo(
    () => compareShamsiDates(startDate, endDate),
    [startDate, endDate]
  );
  const durationDays = useMemo(
    () => calculateDurationDays(startDate, endDate),
    [startDate, endDate]
  );

  // Filtered Personnel for Modal
  const availableUnitNames = useMemo(() => {
    const set = new Set<string>();
    personnelList.forEach((p) => {
      if (p.unitName) set.add(p.unitName);
    });
    return Array.from(set);
  }, [personnelList]);

  const filteredPersonnel = useMemo(() => {
    const q = personnelSearch.trim().toLowerCase();
    return personnelList.filter((p) => {
      if (personnelUnitFilter !== 'ALL' && p.unitName !== personnelUnitFilter) {
        return false;
      }
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.personnelCode.toLowerCase().includes(q) ||
        (p.nationalCode && p.nationalCode.toLowerCase().includes(q)) ||
        p.jobTitle.toLowerCase().includes(q) ||
        p.unitName.toLowerCase().includes(q) ||
        (p.departmentName && p.departmentName.toLowerCase().includes(q))
      );
    });
  }, [personnelList, personnelSearch, personnelUnitFilter]);

  // Selected PM & Sponsor objects
  const selectedPmObj = useMemo(
    () =>
      personnelList.find((p) => Number(p.id) === Number(projectManagerId)) ||
      (projectManagerName
        ? {
            id: projectManagerId || 0,
            personnelCode: '-',
            firstName: '',
            lastName: '',
            fullName: projectManagerName,
            jobTitle: 'مدیر پروژه استقرار PSM',
            unitName: 'مجتمع پتروشیمی رجال',
          }
        : null),
    [personnelList, projectManagerId, projectManagerName]
  );

  const selectedSponsorObj = useMemo(
    () =>
      personnelList.find((p) => Number(p.id) === Number(projectSponsorId)) ||
      (projectSponsorName
        ? {
            id: projectSponsorId || 0,
            personnelCode: '-',
            firstName: '',
            lastName: '',
            fullName: projectSponsorName,
            jobTitle: 'حامی ارشد پروژه (Sponsor)',
            unitName: 'مجتمع پتروشیمی رجال',
          }
        : null),
    [personnelList, projectSponsorId, projectSponsorName]
  );

  // Personnel Selection Handlers
  const handleSelectPersonInModal = (person: PersonnelRecord) => {
    const target = personnelModalConfig.target;
    if (!target) return;

    if (target.type === 'PM') {
      setProjectManagerId(Number(person.id));
      setProjectManagerName(person.fullName);
      setPersonnelModalConfig({ open: false, target: null });
    } else if (target.type === 'SPONSOR') {
      setProjectSponsorId(Number(person.id));
      setProjectSponsorName(person.fullName);
      setPersonnelModalConfig({ open: false, target: null });
    } else if (target.type === 'TEAM_REPLACE') {
      const existsInTeam = teamMembers.some(
        (m, idx) =>
          idx !== target.index &&
          (String(m.personnelId) === String(person.id) || m.fullName === person.fullName)
      );
      if (existsInTeam) {
        setValidationError(`پرسنل «${person.fullName}» قبلاً در لیست اعضای تیم انتخاب شده است.`);
        return;
      }
      setTeamMembers((prev) =>
        prev.map((item, idx) =>
          idx === target.index
            ? {
                ...item,
                personnelId: person.id,
                personnelCode: person.personnelCode,
                fullName: person.fullName,
                jobTitle: person.jobTitle,
                unitName: person.unitName,
              }
            : item
        )
      );
      setPersonnelModalConfig({ open: false, target: null });
    } else if (target.type === 'TEAM_MULTI') {
      const exists = teamMembers.some(
        (m) => String(m.personnelId) === String(person.id) || m.fullName === person.fullName
      );
      if (exists) {
        setTeamMembers((prev) =>
          prev.filter(
            (m) => String(m.personnelId) !== String(person.id) && m.fullName !== person.fullName
          )
        );
      } else {
        setTeamMembers((prev) => [
          ...prev,
          {
            personnelId: person.id,
            personnelCode: person.personnelCode,
            fullName: person.fullName,
            jobTitle: person.jobTitle,
            unitName: person.unitName,
            psmRole: PSM_TEAM_ROLES[prev.length % PSM_TEAM_ROLES.length],
          },
        ]);
      }
    } else if (target.type === 'QO_RESPONSIBLE') {
      setQuantitativeGoals((prev) =>
        prev.map((q) =>
          q.id === target.id
            ? {
                ...q,
                responsiblePersonId: person.id,
                responsiblePersonName: `${person.fullName} (${person.jobTitle})`,
              }
            : q
        )
      );
      setPersonnelModalConfig({ open: false, target: null });
    } else if (target.type === 'MS_RESPONSIBLE') {
      setMilestones((prev) =>
        prev.map((m) =>
          m.id === target.id
            ? {
                ...m,
                responsiblePersonId: person.id,
                responsiblePersonName: `${person.fullName} (${person.jobTitle})`,
              }
            : m
        )
      );
      setPersonnelModalConfig({ open: false, target: null });
    }
  };

  // Covered Units Handlers
  const toggleCoveredUnit = (unit: CoveredUnitItem) => {
    setCoveredUnits((prev) => {
      const exists = prev.some((u) => u.unitId === unit.unitId || u.code === unit.code);
      if (exists) {
        const remaining = prev.filter((u) => u.unitId !== unit.unitId && u.code !== unit.code);
        if (remaining.length > 0 && !remaining.some((u) => u.isPrimary)) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        return remaining;
      } else {
        const isFirst = prev.length === 0;
        return [...prev, { ...unit, isPrimary: isFirst }];
      }
    });
  };

  const setPrimaryCoveredUnit = (unitId: string) => {
    setCoveredUnits((prev) =>
      prev.map((u) => ({
        ...u,
        isPrimary: u.unitId === unitId,
      }))
    );
  };

  // Quantitative Objectives Handlers
  const toggleQuantitativeGoal = (template: typeof SUGGESTED_QUANTITATIVE_OBJECTIVES[0]) => {
    setQuantitativeGoals((prev) => {
      const exists = prev.some((q) => q.code === template.code || q.title === template.title);
      if (exists) {
        return prev.filter((q) => q.code !== template.code && q.title !== template.title);
      }
      const newObj: QuantitativeObjectiveItem = {
        ...template,
        dueDate: endDate || defaultEndDateShamsi,
        responsiblePersonId: projectManagerId,
        responsiblePersonName: projectManagerName || 'مدیر پروژه PSM',
      };
      return [...prev, newObj];
    });
  };

  const selectAllSuggestedQuantitative = () => {
    setQuantitativeGoals((prev) => {
      const customOnes = prev.filter((q) => q.isCustom);
      const allSuggested: QuantitativeObjectiveItem[] = SUGGESTED_QUANTITATIVE_OBJECTIVES.map((tpl) => {
        const existing = prev.find((p) => p.code === tpl.code || p.title === tpl.title);
        if (existing) return existing;
        return {
          ...tpl,
          dueDate: endDate || defaultEndDateShamsi,
          responsiblePersonId: projectManagerId,
          responsiblePersonName: projectManagerName || 'مدیر پروژه PSM',
        };
      });
      return [...allSuggested, ...customOnes];
    });
  };

  const addCustomQuantitativeObjective = () => {
    const clean = customQoTitle.trim();
    if (!clean) return;
    if (quantitativeGoals.some((q) => q.title === clean)) {
      setValidationError('این هدف کمی قبلاً در فهرست اهداف پروژه ثبت شده است.');
      return;
    }
    const newItem: QuantitativeObjectiveItem = {
      id: `QO-CUSTOM-${Date.now()}`,
      code: `PSM-QO-C${quantitativeGoals.length + 1}`,
      title: clean,
      targetValue: Number(customQoTarget) || 100,
      unit: customQoUnit.trim() || 'درصد (%)',
      baselineValue: 0,
      currentValue: 0,
      expectedFinalValue: Number(customQoTarget) || 100,
      dueDate: endDate || defaultEndDateShamsi,
      responsiblePersonId: projectManagerId,
      responsiblePersonName: projectManagerName || 'مدیر پروژه PSM',
      isCustom: true,
    };
    setQuantitativeGoals((prev) => [...prev, newItem]);
    setCustomQoTitle('');
    setExpandedQoId(newItem.id);
  };

  const moveItem = <T,>(list: T[], index: number, direction: 'UP' | 'DOWN'): T[] => {
    const next = [...list];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return next;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    return next;
  };

  // Qualitative Objectives Handlers
  const toggleQualitativeGoal = (template: QualitativeObjectiveItem) => {
    setQualitativeGoals((prev) => {
      const exists = prev.some((q) => q.code === template.code || q.title === template.title);
      if (exists) {
        return prev.filter((q) => q.code !== template.code && q.title !== template.title);
      }
      return [...prev, { ...template }];
    });
  };

  const selectAllSuggestedQualitative = () => {
    setQualitativeGoals((prev) => {
      const customOnes = prev.filter((q) => q.isCustom);
      return [...SUGGESTED_QUALITATIVE_OBJECTIVES, ...customOnes];
    });
  };

  const addCustomQualitativeObjective = () => {
    const clean = customQlTitle.trim();
    if (!clean) return;
    if (qualitativeGoals.some((q) => q.title === clean)) {
      setValidationError('این هدف کیفی قبلاً در فهرست اهداف ثبت شده است.');
      return;
    }
    setQualitativeGoals((prev) => [
      ...prev,
      {
        id: `QL-CUSTOM-${Date.now()}`,
        code: `PSM-QL-C${prev.length + 1}`,
        title: clean,
        description: customQlDesc.trim() || 'هدف کیفی اختصاصی پروژه استقرار PSM',
        isCustom: true,
      },
    ]);
    setCustomQlTitle('');
    setCustomQlDesc('');
  };

  // Milestones Handlers
  const toggleMilestone = (template: typeof SUGGESTED_MILESTONES[0]) => {
    setMilestones((prev) => {
      const exists = prev.some((m) => m.title === template.title);
      if (exists) {
        return prev
          .filter((m) => m.title !== template.title)
          .map((m, i) => ({ ...m, orderIndex: i + 1 }));
      }
      const nextItem: ProjectMilestoneItem = {
        ...template,
        orderIndex: prev.length + 1,
        plannedDate: endDate || defaultEndDateShamsi,
        responsiblePersonId: projectManagerId,
        responsiblePersonName: projectManagerName || 'مدیر پروژه PSM',
      };
      return [...prev, nextItem];
    });
  };

  const selectAllSuggestedMilestones = () => {
    setMilestones((prev) => {
      const customOnes = prev.filter((m) => m.isCustom);
      const merged = SUGGESTED_MILESTONES.map((tpl, idx) => {
        const existing = prev.find((p) => p.title === tpl.title);
        if (existing) return { ...existing, orderIndex: idx + 1 };
        return {
          ...tpl,
          orderIndex: idx + 1,
          plannedDate: endDate || defaultEndDateShamsi,
          responsiblePersonId: projectManagerId,
          responsiblePersonName: projectManagerName || 'مدیر پروژه PSM',
        };
      });
      return [...merged, ...customOnes].map((m, idx) => ({ ...m, orderIndex: idx + 1 }));
    });
  };

  const addCustomMilestone = () => {
    const clean = customMsTitle.trim();
    if (!clean) return;
    if (milestones.some((m) => m.title === clean)) {
      setValidationError('این نقطه عطف قبلاً در فهرست نقاط عطف ثبت شده است.');
      return;
    }
    const newItem: ProjectMilestoneItem = {
      id: `MS-CUSTOM-${Date.now()}`,
      orderIndex: milestones.length + 1,
      title: clean,
      description: customMsDesc.trim() || 'نقطه عطف اختصاصی استقرار ایمنی فرایند',
      plannedDate: endDate || defaultEndDateShamsi,
      responsiblePersonId: projectManagerId,
      responsiblePersonName: projectManagerName || 'مدیر پروژه PSM',
      status: 'PLANNED',
      progressPct: 0,
      verificationEvidence: 'گزارش تایید کمیته راهبری PSM',
      isCustom: true,
    };
    setMilestones((prev) => [...prev, newItem]);
    setCustomMsTitle('');
    setCustomMsDesc('');
    setExpandedMsId(newItem.id);
  };

  // Step Readiness & Validation
  const validateBeforeSubmit = (isDraft: boolean): string | null => {
    if (!projectCode.trim()) return 'کد پروژه الزامی است.';
    if (!title.trim()) return 'عنوان پروژه الزامی است.';
    if (!isDateRangeValid) {
      return 'تاریخ پایان برنامه‌ریزی‌شده نمی‌تواند قبل از تاریخ شروع پروژه باشد.';
    }
    if (!isDraft) {
      if (!projectManagerName.trim()) {
        return 'لطفاً مدیر پروژه را از بانک اطلاعات پرسنل مجتمع انتخاب نمایید.';
      }
      if (!projectSponsorName.trim()) {
        return 'لطفاً حامی پروژه (Sponsor) را از بانک اطلاعات پرسنل مجتمع انتخاب نمایید.';
      }
      if (coveredUnits.length === 0) {
        return 'لطفاً حداقل یک واحد مشمول پروژه را از ساختار سازمانی انتخاب نمایید.';
      }
      if (!coveredUnits.some((u) => u.isPrimary)) {
        return 'لطفاً یک واحد را به‌عنوان «واحد اصلی پروژه» مشخص نمایید.';
      }
      if (quantitativeGoals.length === 0) {
        return 'لطفاً حداقل یک هدف کمی برای پایش پیشرفت پروژه انتخاب نمایید.';
      }
      if (milestones.length === 0) {
        return 'لطفاً حداقل یک نقطه عطف (Milestone) برای اتصال به برنامه زمان‌بندی انتخاب نمایید.';
      }
    }
    return null;
  };

  const handleFinalSubmit = async (isDraft: boolean) => {
    if (submittingMode !== 'NONE') return;
    setValidationError(null);
    const err = validateBeforeSubmit(isDraft);
    if (err) {
      setValidationError(err);
      return;
    }

    setSubmittingMode(isDraft ? 'DRAFT' : 'FINAL');
    try {
      const payload: PsmProjectFormPayload = {
        id: initialData?.id,
        projectCode: projectCode.trim(),
        code: projectCode.trim(),
        title: title.trim(),
        name: title.trim(),
        scopeDescription:
          scopeDescription.trim() ||
          `استقرار یکپارچه ۲۰ عنصر مدیریت ایمنی فرایند (CCPS RBPS) در ${coveredUnits
            .map((u) => u.name)
            .join('، ')}`,
        scope:
          scopeDescription.trim() ||
          `استقرار یکپارچه ۲۰ عنصر مدیریت ایمنی فرایند (CCPS RBPS) در ${coveredUnits
            .map((u) => u.name)
            .join('، ')}`,
        startDate,
        endDate,
        projectManagerId,
        projectManagerName,
        projectSponsorId,
        projectSponsorName,
        sponsorName: projectSponsorName,
        coveredUnits,
        teamMembers,
        quantitativeGoals,
        qualitativeGoals,
        milestones: milestones.map((m, idx) => ({ ...m, orderIndex: idx + 1 })),
        budgetAllocated: Number(budgetAllocated) || 0,
        allocatedBudget: Number(budgetAllocated) || 0,
        budgetSpent: Number(budgetSpent) || 0,
        spentBudget: Number(budgetSpent) || 0,
        resourcesSummary: resourcesSummary.trim(),
        overallStatus: isDraft ? 'DRAFT' : initialData?.overallStatus === 'DRAFT' ? 'ACTIVE' : initialData?.overallStatus || 'ACTIVE',
        status: isDraft ? 'DRAFT' : initialData?.status === 'DRAFT' ? 'ACTIVE' : initialData?.status || 'ACTIVE',
        isDraft,
      };
      await onSubmit(payload);
    } catch (e: any) {
      setValidationError(e?.message || 'خطا در ذخیره اطلاعات پروژه در پایگاه داده مرکزی.');
    } finally {
      setSubmittingMode('NONE');
    }
  };

  const steps = [
    {
      num: 1,
      title: 'اطلاعات پایه و تقویم شمسی',
      subtitle: 'کد، عنوان و زمان‌بندی پروژه',
      icon: Calendar,
      isComplete: Boolean(projectCode.trim() && title.trim() && isDateRangeValid),
    },
    {
      num: 2,
      title: 'مدیریت، تیم و واحدهای مشمول',
      subtitle: 'اتصال به پرسنل و ساختار سازمانی',
      icon: Users,
      isComplete: Boolean(
        projectManagerName && projectSponsorName && coveredUnits.length > 0
      ),
    },
    {
      num: 3,
      title: 'دامنه و اهداف کمی / کیفی',
      subtitle: `${quantitativeGoals.length} هدف کمی | ${qualitativeGoals.length} هدف کیفی`,
      icon: Target,
      isComplete: Boolean(quantitativeGoals.length > 0 && qualitativeGoals.length > 0),
    },
    {
      num: 4,
      title: 'نقاط عطف، بودجه و منابع',
      subtitle: `${milestones.length} نقطه عطف ساختاریافته`,
      icon: Flag,
      isComplete: Boolean(milestones.length > 0 && budgetAllocated > 0),
    },
    {
      num: 5,
      title: 'پیش‌نمایش و ثبت نهایی',
      subtitle: 'کنترل نهایی و اتصال به موتور PSM',
      icon: ShieldCheck,
      isComplete: Boolean(
        projectCode.trim() &&
          title.trim() &&
          isDateRangeValid &&
          projectManagerName &&
          coveredUnits.length > 0 &&
          quantitativeGoals.length > 0 &&
          milestones.length > 0
      ),
    },
  ];

  const completionPct = useMemo(() => {
    let score = 0;
    if (projectCode.trim() && title.trim()) score += 20;
    if (isDateRangeValid && startDate && endDate) score += 15;
    if (projectManagerName && projectSponsorName) score += 20;
    if (coveredUnits.length > 0) score += 15;
    if (quantitativeGoals.length > 0) score += 15;
    if (milestones.length > 0) score += 15;
    return score;
  }, [
    projectCode,
    title,
    isDateRangeValid,
    startDate,
    endDate,
    projectManagerName,
    projectSponsorName,
    coveredUnits.length,
    quantitativeGoals.length,
    milestones.length,
  ]);

  return (
    <div
      dir="rtl"
      className={`bg-white text-slate-900 ${
        isInline
          ? 'rounded-2xl border border-slate-200 shadow-sm'
          : 'rounded-2xl border border-slate-200 shadow-2xl'
      } overflow-hidden`}
    >
      {/* Top Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-teal-900 text-white px-6 py-5 border-b border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black tracking-tight">
                  {mode === 'edit'
                    ? 'ویرایش و بازنگری تخصصی پروژه استقرار PSM'
                    : 'فرم هوشمند ثبت و راه‌اندازی پروژه جدید PSM'}
                </h2>
                <span className="px-2.5 py-0.5 text-[11px] font-bold bg-teal-500/20 text-teal-200 border border-teal-400/30 rounded-md">
                  CCPS RBPS / HSECORE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                متصل به بانک مرکزی پرسنل مجتمع ({personnelList.length} نفر)، درخت ساختار سازمانی، تقویم شمسی یکپارچه و موتور Stage-Gate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2 min-w-[180px]">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">تکمیل منشور پروژه</span>
                <span className="font-black text-teal-300">{completionPct}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-teal-400 to-emerald-500 transition-all duration-300"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="بستن فرم"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Multi-Step Stepper Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-5 pt-4 border-t border-slate-700/80">
          {steps.map((st) => {
            const Icon = st.icon;
            const isActive = activeStep === st.num;
            return (
              <button
                key={st.num}
                type="button"
                onClick={() => {
                  setValidationError(null);
                  setActiveStep(st.num);
                }}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl text-right transition border ${
                  isActive
                    ? 'bg-teal-600/30 border-teal-400 text-white shadow-sm'
                    : st.isComplete
                    ? 'bg-slate-800/70 border-emerald-500/40 text-slate-200 hover:bg-slate-800'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:bg-slate-800/70'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                    isActive
                      ? 'bg-teal-500 text-slate-950'
                      : st.isComplete
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {st.isComplete && !isActive ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">
                    {st.num}. {st.title}
                  </div>
                  <div className="text-[10px] text-slate-300/80 truncate mt-0.5">
                    {st.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Validation Alert Banner */}
      {validationError && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setValidationError(null)}
            className="text-rose-600 hover:text-rose-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Step Content Area */}
      <div className="p-6 max-h-[72vh] overflow-y-auto space-y-6">
        {/* ============================================================
            STEP 1: BASE PROJECT INFO & SHAMSI CALENDAR
           ============================================================ */}
        {activeStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-teal-600" />
                  بخش اول: اطلاعات پایه پروژه و تقویم شمسی یکپارچه
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تعیین شناسه یکتای منشور، عنوان رسمی پروژه و بازه زمانی اجرا بر اساس تقویم شمسی استاندارد HSECORE
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTitle('استقرار جامع سیستم مدیریت ایمنی فرایند (PSM) در واحدهای عملیاتی مجتمع');
                  if (!scopeDescription) {
                    setScopeDescription(
                      'پیاده‌سازی کامل ۲۰ عنصر ایمنی فرایند بر مبنای استاندارد CCPS RBPS در واحدهای عملیاتی و فرایندی مجتمع شامل تکمیل بانک PSI، مطالعات HAZOP/LOPA، یکپارچگی مکانیکی (MI) و ممیزی انطباق.'
                    );
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                درج الگوی استاندارد پروژه استقرار
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  کد پروژه (Project Code) <span className="text-rose-600">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="PSM-PRJ-1404-001"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setProjectCode(`PSM-PRJ-1404-${String(Math.floor(100 + Math.random() * 900))}`)
                    }
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600"
                    title="تولید کد جدید"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  کد یکتای پروژه در بانک اطلاعاتی PSM و گزارش‌های ممیزی
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  عنوان رسمی پروژه <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: استقرار کامل سیستم مدیریت ایمنی فرایند (PSM) در واحدهای پلی‌پروپیلن و یوتیلیتی"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  این عنوان در منشور پروژه، دروازه‌های کنترلی G1–G6 و داشبورد مدیریت ارشد نمایش داده می‌شود.
                </p>
              </div>
            </div>

            {/* Shamsi Date Pickers */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Clock className="w-4 h-4 text-teal-600" />
                  زمان‌بندی اجرای پروژه (تقویم شمسی رسمی HSECORE)
                </div>
                {durationDays !== null && (
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                      durationDays >= 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {durationDays >= 0
                      ? `مدت زمان برنامه‌ریزی‌شده: ${durationDays} روز (${Math.max(1, Math.round(durationDays / 30))} ماه)`
                      : 'خطا: تاریخ پایان قبل از تاریخ شروع است!'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <PersianDatePicker
                    label="تاریخ شروع پروژه (شمسی) *"
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                    minYear={1395}
                    maxYear={1425}
                  />
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>فرمت استاندارد: YYYY/MM/DD شمسی</span>
                    <span className="font-mono font-bold text-slate-700">{startDate}</span>
                  </div>
                </div>

                <div>
                  <PersianDatePicker
                    label="تاریخ پایان برنامه‌ریزی‌شده (شمسی) *"
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                    minYear={1395}
                    maxYear={1425}
                  />
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>تاریخ تحویل و اختتامیه برنامه استقرار</span>
                    <span className="font-mono font-bold text-slate-700">{endDate}</span>
                  </div>
                </div>
              </div>

              {!isDateRangeValid && (
                <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  انتخاب تاریخ پایان قبل از تاریخ شروع غیرمجاز است. لطفاً تاریخ پایان را اصلاح فرمایید.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 2: CENTRAL PERSONNEL & ORGANIZATIONAL STRUCTURE
           ============================================================ */}
        {activeStep === 2 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                بخش دوم: مدیریت پروژه، اعضای تیم استقرار و واحدهای مشمول
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                انتخاب مستقیم از بانک اطلاعات مرکزی «پرسنل مجتمع» و درخت «ساختار سازمانی» با حفظ شناسه دیتابیس و سوابق تاریخی
              </p>
            </div>

            {/* Project Manager & Project Sponsor Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Project Manager */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                    مدیر پروژه (Project Manager) <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonnelSearch('');
                      setPersonnelModalConfig({ open: true, target: { type: 'PM' } });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {selectedPmObj ? 'تغییر مدیر پروژه' : 'انتخاب از پرسنل مجتمع'}
                  </button>
                </div>

                {selectedPmObj ? (
                  <div className="p-3.5 rounded-xl bg-white border border-teal-200 shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 font-black flex items-center justify-center text-sm">
                        {selectedPmObj.fullName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>{selectedPmObj.fullName}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            کد: {selectedPmObj.personnelCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {selectedPmObj.jobTitle} — <span className="text-teal-700 font-semibold">{selectedPmObj.unitName}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectManagerId(null);
                        setProjectManagerName('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="حذف مدیر پروژه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setPersonnelSearch('');
                      setPersonnelModalConfig({ open: true, target: { type: 'PM' } });
                    }}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-teal-500 bg-white text-center cursor-pointer transition"
                  >
                    <p className="text-xs font-bold text-slate-600">
                      کلیک کنید تا پنجره انتخاب هوشمند پرسنل مجتمع باز شود
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      جستجو بر اساس نام، کد پرسنلی، سمت شغلی و واحد سازمانی
                    </p>
                  </div>
                )}
              </div>

              {/* Project Sponsor */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    حامی پروژه (Project Sponsor) <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPersonnelSearch('');
                      setPersonnelModalConfig({ open: true, target: { type: 'SPONSOR' } });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {selectedSponsorObj ? 'تغییر حامی پروژه' : 'انتخاب از پرسنل مجتمع'}
                  </button>
                </div>

                {selectedSponsorObj ? (
                  <div className="p-3.5 rounded-xl bg-white border border-indigo-200 shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 font-black flex items-center justify-center text-sm">
                        {selectedSponsorObj.fullName.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>{selectedSponsorObj.fullName}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            کد: {selectedSponsorObj.personnelCode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {selectedSponsorObj.jobTitle} — <span className="text-indigo-700 font-semibold">{selectedSponsorObj.unitName}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSponsorId(null);
                        setProjectSponsorName('');
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="حذف حامی پروژه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setPersonnelSearch('');
                      setPersonnelModalConfig({ open: true, target: { type: 'SPONSOR' } });
                    }}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white text-center cursor-pointer transition"
                  >
                    <p className="text-xs font-bold text-slate-600">
                      کلیک کنید تا حامی پروژه (Sponsor) از پرسنل ارشد مجتمع انتخاب شود
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      تصویب‌کننده نهایی منشور و دروازه‌های کنترلی Stage-Gates
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Multi-Select PSM Team Members */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600" />
                    اعضای تیم استقرار PSM (Project Team Members)
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold">
                      {teamMembers.length} نفر انتخاب‌شده
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    انتخاب چندنفره (Multi-Select) از پرسنل مجتمع با جلوگیری خودکار از ثبت تکراری و قابلیت تعیین نقش تخصصی در کمیته PSM
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPersonnelSearch('');
                    setPersonnelModalConfig({ open: true, target: { type: 'TEAM_MULTI' } });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <Plus className="w-4 h-4 text-teal-400" />
                  افزودن / مدیریت اعضای تیم از پرسنل مجتمع
                </button>
              </div>

              {teamMembers.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center">
                  <p className="text-xs font-bold text-slate-600">
                    هنوز عضوی برای تیم استقرار PSM انتخاب نشده است.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    روی دکمه «افزودن / مدیریت اعضای تیم از پرسنل مجتمع» کلیک کنید.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teamMembers.map((member, index) => (
                    <div
                      key={`${member.personnelId}-${index}`}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-teal-300 transition flex flex-col justify-between gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-teal-600/10 border border-teal-600/20 text-teal-800 font-black text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <span>{member.fullName}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-mono text-[10px]">
                                کد: {member.personnelCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              {member.jobTitle} • <span className="font-semibold text-slate-800">{member.unitName}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPersonnelSearch('');
                              setPersonnelModalConfig({
                                open: true,
                                target: { type: 'TEAM_REPLACE', index },
                              });
                            }}
                            className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-teal-400 text-[11px] font-bold text-slate-700 hover:text-teal-700"
                            title="جایگزینی با فرد دیگر"
                          >
                            جایگزینی
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setTeamMembers((prev) => prev.filter((_, idx) => idx !== index))
                            }
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="حذف از تیم پروژه"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/70">
                        <span className="text-[11px] font-bold text-slate-500 shrink-0">
                          نقش در کمیته PSM:
                        </span>
                        <select
                          value={member.psmRole}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeamMembers((prev) =>
                              prev.map((m, idx) => (idx === index ? { ...m, psmRole: val } : m))
                            );
                          }}
                          className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
                        >
                          {PSM_TEAM_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Covered Units from Central Organizational Structure */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    واحدهای مشمول پروژه از ساختار سازمانی (Covered Organizational Units)
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold">
                      {coveredUnits.length} واحد انتخاب‌شده
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    نمایش درختی ساختار سازمانی، تعیین «واحد اصلی» و «واحدهای وابسته» همراه با حفظ شناسه اصلی هر واحد
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOrgSearch('');
                    setOrgModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition"
                >
                  <FolderTree className="w-4 h-4" />
                  انتخاب از نمای درختی ساختار سازمانی
                </button>
              </div>

              {coveredUnits.length === 0 ? (
                <div
                  onClick={() => setOrgModalOpen(true)}
                  className="p-6 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 hover:border-teal-500 text-center cursor-pointer transition"
                >
                  <p className="text-xs font-bold text-slate-700">
                    هیچ واحدی انتخاب نشده است. برای باز شدن درخت ساختار سازمانی مجتمع کلیک کنید.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {coveredUnits.map((unit) => (
                    <div
                      key={unit.unitId}
                      className={`p-3.5 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                        unit.isPrimary
                          ? 'bg-teal-50/70 border-teal-400 shadow-xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 ${
                            unit.isPrimary
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {unit.isPrimary ? 'واحد اصلی پروژه' : 'واحد وابسته'}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                            <span>{unit.name}</span>
                            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600">
                              {unit.code}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            سلسله‌مراتب: {unit.hierarchyPath}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!unit.isPrimary && (
                          <button
                            type="button"
                            onClick={() => setPrimaryCoveredUnit(unit.unitId)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 border border-slate-300 hover:border-teal-400 text-[11px] font-bold text-slate-700 hover:text-teal-800 transition"
                          >
                            تعیین به‌عنوان واحد اصلی
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleCoveredUnit(unit)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="حذف واحد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 3: SCOPE, QUANTITATIVE & QUALITATIVE OBJECTIVES
           ============================================================ */}
        {activeStep === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" />
                بخش سوم: دامنه کاربرد و فهرست هوشمند اهداف کمی و کیفی
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                انتخاب ساختاریافته اهداف کمی و کیفی پروژه با قابلیت تعیین مقدار هدف، مبنا، موعد تحقق شمسی، مسئول پیگیری و مرتب‌سازی
              </p>
            </div>

            {/* Project Scope Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                شرح دامنه پروژه (Project Scope Statement)
              </label>
              <textarea
                rows={3}
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="مرزهای فنی، فرایندی و سازمانی استقرار ۲۰ عنصر مدیریت ایمنی فرایند (PSM) در واحدهای مشمول..."
                className="w-full p-3.5 rounded-xl border border-slate-300 text-xs leading-relaxed text-slate-900 focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* QUANTITATIVE OBJECTIVES MANAGER */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-600" />
                    ۱. اهداف کمی پروژه (Quantitative Objectives)
                    <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-xs font-black">
                      {quantitativeGoals.length} هدف انتخاب‌شده
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    روی هر هدف در بانک پیشنهادی کلیک کنید یا با دکمه «انتخاب همه ۱۳ هدف پیشنهادی» تمام شاخص‌های استاندارد را اضافه نمایید.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllSuggestedQuantitative}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    انتخاب همه ۱۳ هدف پیشنهادی
                  </button>
                  {quantitativeGoals.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuantitativeGoals([])}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-600 text-xs font-bold"
                    >
                      پاک‌سازی همه
                    </button>
                  )}
                </div>
              </div>

              {/* Search & Suggested Catalog for Quantitative Goals */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    <input
                      type="text"
                      value={qoSearch}
                      onChange={(e) => setQoSearch(e.target.value)}
                      placeholder="جستجو در بانک ۱۳ هدف کمی استاندارد PSM (مثال: HAZOP، PSI، MI، PSSR...)"
                      className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {SUGGESTED_QUANTITATIVE_OBJECTIVES.filter(
                    (q) =>
                      !qoSearch.trim() ||
                      q.title.toLowerCase().includes(qoSearch.toLowerCase()) ||
                      q.code.toLowerCase().includes(qoSearch.toLowerCase())
                  ).map((tpl) => {
                    const isSelected = quantitativeGoals.some(
                      (g) => g.code === tpl.code || g.title === tpl.title
                    );
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => toggleQuantitativeGoal(tpl)}
                        className={`p-2.5 rounded-lg border text-right text-xs flex items-center justify-between gap-2 transition ${
                          isSelected
                            ? 'bg-teal-50 border-teal-400 text-teal-950 font-bold'
                            : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">{tpl.title}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] text-slate-600 shrink-0">
                          هدف: {tpl.targetValue} {tpl.unit}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Quantitative Objective */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={customQoTitle}
                    onChange={(e) => setCustomQoTitle(e.target.value)}
                    placeholder="عنوان هدف کمی اختصاصی جدید..."
                    className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    type="number"
                    value={customQoTarget}
                    onChange={(e) => setCustomQoTarget(Number(e.target.value))}
                    placeholder="مقدار هدف"
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={customQoUnit}
                    onChange={(e) => setCustomQoUnit(e.target.value)}
                    placeholder="واحد اندازه‌گیری"
                    className="w-28 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addCustomQuantitativeObjective}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    افزودن هدف کمی اختصاصی
                  </button>
                </div>
              </div>

              {/* Selected Quantitative Objectives List with Full Parameter Editor */}
              {quantitativeGoals.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-700">
                    فهرست اهداف کمی انتخاب‌شده (برای تنظیم مقادیر مبنا، فعلی، موعد شمسی و مسئول روی هر هدف کلیک کنید):
                  </div>
                  {quantitativeGoals.map((goal, idx) => {
                    const isExpanded = expandedQoId === goal.id;
                    return (
                      <div
                        key={goal.id}
                        className="rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden"
                      >
                        <div className="p-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-md bg-teal-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={goal.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQuantitativeGoals((prev) =>
                                  prev.map((q) => (q.id === goal.id ? { ...q, title: val } : q))
                                );
                              }}
                              className="font-bold text-xs text-slate-900 bg-transparent border-b border-transparent focus:border-teal-500 focus:bg-white px-1 py-0.5 flex-1 min-w-[200px]"
                            />
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-bold">
                              هدف: {goal.targetValue} {goal.unit}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                              موعد: {goal.dueDate}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedQoId(isExpanded ? null : goal.id)
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-teal-400 text-slate-700 font-bold flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              {isExpanded ? 'بستن جزئیات' : 'تنظیم شاخص‌ها'}
                            </button>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                setQuantitativeGoals((prev) => moveItem(prev, idx, 'UP'))
                              }
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                              title="انتقال به بالا"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === quantitativeGoals.length - 1}
                              onClick={() =>
                                setQuantitativeGoals((prev) => moveItem(prev, idx, 'DOWN'))
                              }
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                              title="انتقال به پایین"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setQuantitativeGoals((prev) =>
                                  prev.filter((q) => q.id !== goal.id)
                                )
                              }
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="حذف هدف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                مقدار هدف (Target Value)
                              </label>
                              <input
                                type="number"
                                value={goal.targetValue}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setQuantitativeGoals((prev) =>
                                    prev.map((q) =>
                                      q.id === goal.id ? { ...q, targetValue: v } : q
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                واحد اندازه‌گیری (Unit)
                              </label>
                              <input
                                type="text"
                                value={goal.unit}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setQuantitativeGoals((prev) =>
                                    prev.map((q) => (q.id === goal.id ? { ...q, unit: v } : q))
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                مقدار مبنا (Baseline)
                              </label>
                              <input
                                type="number"
                                value={goal.baselineValue}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setQuantitativeGoals((prev) =>
                                    prev.map((q) =>
                                      q.id === goal.id ? { ...q, baselineValue: v } : q
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                مقدار فعلی (Current)
                              </label>
                              <input
                                type="number"
                                value={goal.currentValue}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setQuantitativeGoals((prev) =>
                                    prev.map((q) =>
                                      q.id === goal.id ? { ...q, currentValue: v } : q
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                مقدار نهایی مورد انتظار
                              </label>
                              <input
                                type="number"
                                value={goal.expectedFinalValue}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setQuantitativeGoals((prev) =>
                                    prev.map((q) =>
                                      q.id === goal.id ? { ...q, expectedFinalValue: v } : q
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                              />
                            </div>
                            <div>
                              <PersianDatePicker
                                label="موعد تحقق (شمسی)"
                                value={goal.dueDate}
                                onChange={(val) =>
                                  setQuantitativeGoals((prev) =>
                                    prev.map((q) =>
                                      q.id === goal.id ? { ...q, dueDate: val } : q
                                    )
                                  )
                                }
                                minYear={1395}
                                maxYear={1425}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                مسئول تحقق هدف (از پرسنل مجتمع)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={goal.responsiblePersonName}
                                  readOnly
                                  placeholder="انتخاب مسئول از بانک پرسنل..."
                                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPersonnelSearch('');
                                    setPersonnelModalConfig({
                                      open: true,
                                      target: { type: 'QO_RESPONSIBLE', id: goal.id },
                                    });
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shrink-0"
                                >
                                  انتخاب پرسنل
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* QUALITATIVE OBJECTIVES MANAGER */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    ۲. اهداف کیفی پروژه (Qualitative Objectives)
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-black">
                      {qualitativeGoals.length} هدف انتخاب‌شده
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    انتخاب اهداف کلان فرهنگ ایمنی، انضباط عملیاتی و مدیریت دانش فرایندی
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllSuggestedQualitative}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    انتخاب همه ۹ هدف کیفی پیشنهادی
                  </button>
                  {qualitativeGoals.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setQualitativeGoals([])}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-600 text-xs font-bold"
                    >
                      پاک‌سازی همه
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={qlSearch}
                    onChange={(e) => setQlSearch(e.target.value)}
                    placeholder="جستجو در اهداف کیفی پیشنهادی..."
                    className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {SUGGESTED_QUALITATIVE_OBJECTIVES.filter(
                    (q) =>
                      !qlSearch.trim() ||
                      q.title.toLowerCase().includes(qlSearch.toLowerCase())
                  ).map((tpl) => {
                    const isSelected = qualitativeGoals.some(
                      (g) => g.code === tpl.code || g.title === tpl.title
                    );
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => toggleQualitativeGoal(tpl)}
                        className={`p-2.5 rounded-lg border text-right text-xs flex items-center gap-2 transition ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                            : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{tpl.title}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Qualitative Goal */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={customQlTitle}
                    onChange={(e) => setCustomQlTitle(e.target.value)}
                    placeholder="عنوان هدف کیفی اختصاصی..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    value={customQlDesc}
                    onChange={(e) => setCustomQlDesc(e.target.value)}
                    placeholder="توضیحات تکمیلی هدف کیفی..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addCustomQualitativeObjective}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    افزودن هدف کیفی اختصاصی
                  </button>
                </div>
              </div>

              {qualitativeGoals.length > 0 && (
                <div className="space-y-2">
                  {qualitativeGoals.map((goal, idx) => (
                    <div
                      key={goal.id}
                      className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                        <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        {editingQlId === goal.id ? (
                          <input
                            type="text"
                            value={goal.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setQualitativeGoals((prev) =>
                                prev.map((q) => (q.id === goal.id ? { ...q, title: val } : q))
                              );
                            }}
                            onBlur={() => setEditingQlId(null)}
                            autoFocus
                            className="flex-1 px-2 py-1 rounded border border-indigo-400 text-xs font-bold"
                          />
                        ) : (
                          <div>
                            <div className="text-xs font-bold text-slate-900">{goal.title}</div>
                            {goal.description && (
                              <div className="text-[11px] text-slate-500">{goal.description}</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingQlId(goal.id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500"
                          title="ویرایش عنوان"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            setQualitativeGoals((prev) => moveItem(prev, idx, 'UP'))
                          }
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === qualitativeGoals.length - 1}
                          onClick={() =>
                            setQualitativeGoals((prev) => moveItem(prev, idx, 'DOWN'))
                          }
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQualitativeGoals((prev) => prev.filter((q) => q.id !== goal.id))
                          }
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 4: PROJECT MILESTONES, BUDGET & RESOURCES
           ============================================================ */}
        {activeStep === 4 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Flag className="w-5 h-5 text-teal-600" />
                بخش چهارم: فهرست ساختاریافته نقاط عطف (Milestones)، بودجه و منابع
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                انتخاب نقاط عطف استقرار PSM و تنظیم تاریخ برنامه‌ریزی‌شده شمسی، مسئول تحقق، درصد پیشرفت و شواهد تأیید
              </p>
            </div>

            {/* Milestones Manager */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Flag className="w-4 h-4 text-teal-600" />
                    نقاط عطف پروژه (Project Milestones)
                    <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-xs font-black">
                      {milestones.length} نقطه عطف انتخاب‌شده
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    نقاط عطف انتخاب‌شده پس از ثبت نهایی به‌صورت خودکار در ساختار شکست کار (WBS) و برنامه زمان‌بندی پروژه ایجاد می‌شوند.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllSuggestedMilestones}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    انتخاب همه ۱۳ نقطه عطف استاندارد PSM
                  </button>
                  {milestones.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMilestones([])}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-rose-300 text-slate-600 hover:text-rose-600 text-xs font-bold"
                    >
                      پاک‌سازی همه
                    </button>
                  )}
                </div>
              </div>

              {/* Catalog of 13 Suggested Milestones */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={msSearch}
                    onChange={(e) => setMsSearch(e.target.value)}
                    placeholder="جستجو در ۱۳ نقطه عطف استاندارد استقرار PSM..."
                    className="w-full pr-9 pl-3 py-2 rounded-lg border border-slate-200 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {SUGGESTED_MILESTONES.filter(
                    (m) =>
                      !msSearch.trim() ||
                      m.title.toLowerCase().includes(msSearch.toLowerCase())
                  ).map((tpl) => {
                    const isSelected = milestones.some((m) => m.title === tpl.title);
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => toggleMilestone(tpl)}
                        className={`p-2.5 rounded-lg border text-right text-xs flex items-center justify-between gap-2 transition ${
                          isSelected
                            ? 'bg-teal-50 border-teal-400 text-teal-950 font-bold'
                            : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate">
                            {tpl.orderIndex}. {tpl.title}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Milestone */}
                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={customMsTitle}
                    onChange={(e) => setCustomMsTitle(e.target.value)}
                    placeholder="عنوان نقطه عطف اختصاصی جدید..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    value={customMsDesc}
                    onChange={(e) => setCustomMsDesc(e.target.value)}
                    placeholder="شرح و خروجی مورد انتظار نقطه عطف..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addCustomMilestone}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    افزودن نقطه عطف اختصاصی
                  </button>
                </div>
              </div>

              {/* Selected Milestones List with Full Parameter Editor */}
              {milestones.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-700">
                    نقاط عطف انتخاب‌شده (برای ویرایش تاریخ شمسی، مسئول، وضعیت، درصد پیشرفت و شواهد تأیید روی «ویرایش جزئیات» کلیک کنید):
                  </div>
                  {milestones.map((ms, idx) => {
                    const isExpanded = expandedMsId === ms.id;
                    return (
                      <div
                        key={ms.id}
                        className="rounded-xl bg-white border border-slate-200 shadow-2xs overflow-hidden"
                      >
                        <div className="p-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-6 h-6 rounded-md bg-slate-800 text-white text-xs font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-black text-slate-900 truncate">
                                {ms.title}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {ms.description}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                              تاریخ: {ms.plannedDate}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                ms.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ms.status === 'IN_PROGRESS'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ms.progressPct}%
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedMsId(isExpanded ? null : ms.id)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-teal-400 text-slate-700 font-bold flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              {isExpanded ? 'بستن' : 'ویرایش جزئیات'}
                            </button>
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() =>
                                setMilestones((prev) =>
                                  moveItem(prev, idx, 'UP').map((m, i) => ({
                                    ...m,
                                    orderIndex: i + 1,
                                  }))
                                )
                              }
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === milestones.length - 1}
                              onClick={() =>
                                setMilestones((prev) =>
                                  moveItem(prev, idx, 'DOWN').map((m, i) => ({
                                    ...m,
                                    orderIndex: i + 1,
                                  }))
                                )
                              }
                              className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setMilestones((prev) =>
                                  prev
                                    .filter((m) => m.id !== ms.id)
                                    .map((m, i) => ({ ...m, orderIndex: i + 1 }))
                                )
                              }
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                عنوان نقطه عطف
                              </label>
                              <input
                                type="text"
                                value={ms.title}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMilestones((prev) =>
                                    prev.map((m) => (m.id === ms.id ? { ...m, title: v } : m))
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold"
                              />
                            </div>

                            <div>
                              <PersianDatePicker
                                label="تاریخ برنامه‌ریزی‌شده (شمسی)"
                                value={ms.plannedDate}
                                onChange={(val) =>
                                  setMilestones((prev) =>
                                    prev.map((m) =>
                                      m.id === ms.id ? { ...m, plannedDate: val } : m
                                    )
                                  )
                                }
                                minYear={1395}
                                maxYear={1425}
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                شرح نقطه عطف
                              </label>
                              <input
                                type="text"
                                value={ms.description}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMilestones((prev) =>
                                    prev.map((m) =>
                                      m.id === ms.id ? { ...m, description: v } : m
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                مسئول تحقق (از پرسنل مجتمع)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={ms.responsiblePersonName}
                                  readOnly
                                  placeholder="انتخاب مسئول..."
                                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPersonnelSearch('');
                                    setPersonnelModalConfig({
                                      open: true,
                                      target: { type: 'MS_RESPONSIBLE', id: ms.id },
                                    });
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-teal-600 text-white font-bold shrink-0"
                                >
                                  انتخاب
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                وضعیت و درصد پیشرفت ({ms.progressPct}%)
                              </label>
                              <div className="flex items-center gap-2">
                                <select
                                  value={ms.status}
                                  onChange={(e) => {
                                    const st = e.target.value as any;
                                    setMilestones((prev) =>
                                      prev.map((m) =>
                                        m.id === ms.id
                                          ? {
                                              ...m,
                                              status: st,
                                              progressPct:
                                                st === 'COMPLETED' ? 100 : m.progressPct,
                                            }
                                          : m
                                      )
                                    );
                                  }}
                                  className="px-2 py-1.5 rounded-lg border border-slate-300 font-bold"
                                >
                                  <option value="PLANNED">برنامه‌ریزی‌شده</option>
                                  <option value="IN_PROGRESS">در حال اجرا</option>
                                  <option value="COMPLETED">تکمیل‌شده</option>
                                  <option value="DELAYED">دارای تاخیر</option>
                                </select>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={ms.progressPct}
                                  onChange={(e) => {
                                    const pct = Math.min(
                                      100,
                                      Math.max(0, Number(e.target.value) || 0)
                                    );
                                    setMilestones((prev) =>
                                      prev.map((m) =>
                                        m.id === ms.id ? { ...m, progressPct: pct } : m
                                      )
                                    );
                                  }}
                                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-300 font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                شواهد و مدارک تأیید (Verification Evidence)
                              </label>
                              <input
                                type="text"
                                value={ms.verificationEvidence}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMilestones((prev) =>
                                    prev.map((m) =>
                                      m.id === ms.id
                                        ? { ...m, verificationEvidence: v }
                                        : m
                                    )
                                  );
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Budget & Resources */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4">
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-teal-600" />
                منابع و بودجه اختصاص‌یافته پروژه
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    بودجه مصوب کل پروژه (ریال)
                  </label>
                  <input
                    type="number"
                    value={budgetAllocated}
                    onChange={(e) => setBudgetAllocated(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold"
                  />
                  <div className="text-[11px] text-teal-700 font-bold mt-1">
                    معادل: {budgetAllocated.toLocaleString('fa-IR')} ریال
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    بودجه هزینه‌شده تاکنون (ریال)
                  </label>
                  <input
                    type="number"
                    value={budgetSpent}
                    onChange={(e) => setBudgetSpent(Number(e.target.value) || 0)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono font-bold"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    معادل: {budgetSpent.toLocaleString('fa-IR')} ریال
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    منابع فنی، نرم‌افزاری و مشاوران پروژه
                  </label>
                  <textarea
                    rows={2}
                    value={resourcesSummary}
                    onChange={(e) => setResourcesSummary(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            STEP 5: PRE-SUBMIT SUMMARY & PSM ENGINE CONNECTION
           ============================================================ */}
        {activeStep === 5 && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-teal-600" />
                بخش پنجم: خلاصه مدیریتی پیش از ثبت نهایی و اتصال به موتور پروژه PSM
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                بازبینی نهایی اطلاعات منشور پیش از ثبت در پایگاه داده مرکزی و راه‌اندازی خودکار دروازه‌های کنترلی G1 تا G6
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-500">شناسه و زمان‌بندی شمسی</div>
                <div className="text-sm font-black text-slate-900">{title || 'بدون عنوان'}</div>
                <div className="text-xs font-mono font-bold text-teal-700">{projectCode}</div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span>شروع: {startDate}</span>
                  <span>پایان: {endDate}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-500">ارکان مدیریت و تیم پروژه</div>
                <div className="text-xs">
                  <span className="text-slate-500">مدیر پروژه: </span>
                  <span className="font-black text-slate-900">
                    {projectManagerName || 'انتخاب نشده'}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-500">حامی پروژه: </span>
                  <span className="font-black text-slate-900">
                    {projectSponsorName || 'انتخاب نشده'}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-teal-800">
                  <span>اعضای تیم: {teamMembers.length} نفر</span>
                  <span>واحدهای مشمول: {coveredUnits.length} واحد</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-500">اهداف، نقاط عطف و بودجه</div>
                <div className="text-xs flex items-center justify-between">
                  <span>اهداف کمی:</span>
                  <span className="font-black text-teal-700">{quantitativeGoals.length} شاخص</span>
                </div>
                <div className="text-xs flex items-center justify-between">
                  <span>اهداف کیفی:</span>
                  <span className="font-black text-indigo-700">{qualitativeGoals.length} هدف</span>
                </div>
                <div className="text-xs flex items-center justify-between">
                  <span>نقاط عطف (Milestones):</span>
                  <span className="font-black text-slate-900">{milestones.length} مورد</span>
                </div>
                <div className="pt-2 border-t border-slate-200 text-xs font-bold text-emerald-800">
                  بودجه: {budgetAllocated.toLocaleString('fa-IR')} ریال
                </div>
              </div>
            </div>

            {/* Automatic PSM Engine Connections Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-l from-teal-50 to-emerald-50 border border-teal-200 space-y-3">
              <div className="text-xs font-black text-teal-950 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-700" />
                عملیات خودکار موتور مدیریت پروژه PSM پس از ثبت نهایی:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-teal-900">
                <div className="p-3 rounded-xl bg-white/80 border border-teal-200/80">
                  <div className="font-black">۱. تشکیل دروازه‌های کنترلی G1 تا G6</div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    ایجاد خودکار ۶ دروازه کنترلی Stage-Gate با تنظیم مدیر پروژه به‌عنوان تهیه‌کننده و حامی پروژه به‌عنوان تصویب‌کننده نهایی.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 border border-teal-200/80">
                  <div className="font-black">۲. همگام‌سازی برنامه زمان‌بندی (WBS)</div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    تبدیل خودکار نقاط عطف انتخاب‌شده به بسته‌های کاری (Work Packages) در ساختار شکست کار (WBS) با تاریخ شمسی و مسئول مربوطه.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/80 border border-teal-200/80">
                  <div className="font-black">۳. اتصال به ارزیابی اولیه و داشبورد</div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    اتصال واحدهای مشمول و اهداف کمی/کیفی به تب‌های ارزیابی اولیه ۲۰ عنصر، تحلیل شکاف (Gap Analysis) و داشبورد پیشرفت.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {activeStep > 1 && (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <ChevronRight className="w-4 h-4" />
              مرحله قبل
            </button>
          )}
          {activeStep < 5 && (
            <button
              type="button"
              onClick={() => setActiveStep((prev) => Math.min(5, prev + 1))}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              مرحله بعد
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600"
            >
              انصراف
            </button>
          )}

          <button
            type="button"
            disabled={submittingMode !== 'NONE'}
            onClick={() => handleFinalSubmit(true)}
            className="px-4 py-2.5 rounded-xl border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-amber-700" />
            {submittingMode === 'DRAFT' ? 'در حال ذخیره پیش‌نویس...' : 'ذخیره پیش‌نویس (Draft)'}
          </button>

          <button
            type="button"
            disabled={submittingMode !== 'NONE'}
            onClick={() => handleFinalSubmit(false)}
            className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-2 shadow-md transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submittingMode === 'FINAL'
              ? 'در حال ثبت در پایگاه داده...'
              : mode === 'edit'
              ? 'ثبت تغییرات و به‌روزرسانی پروژه PSM'
              : 'ثبت نهایی و راه‌اندازی پروژه PSM'}
          </button>
        </div>
      </div>

      {/* ============================================================
          MODAL 1: SMART CENTRAL PERSONNEL SELECTOR
         ============================================================ */}
      {personnelModalConfig.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            dir="rtl"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-400" />
                  پنجره انتخاب هوشمند پرسنل مجتمع
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  متصل به بانک اطلاعات مرکزی «پرسنل مجتمع» ({personnelList.length} پرسنل رسمی ثبت‌شده در پایگاه داده)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPersonnelModalConfig({ open: false, target: null })}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Unit Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={personnelSearch}
                  onChange={(e) => setPersonnelSearch(e.target.value)}
                  autoFocus
                  placeholder="جستجو بر اساس نام، نام خانوادگی، کد پرسنلی، سمت شغلی یا واحد سازمانی..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
                />
              </div>
              <div>
                <select
                  value={personnelUnitFilter}
                  onChange={(e) => setPersonnelUnitFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700"
                >
                  <option value="ALL">همه واحدهای سازمانی ({personnelList.length} نفر)</option>
                  {availableUnitNames.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {filteredPersonnel.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  هیچ پرسنلی با عبارت جستجوشده یافت نشد.
                </div>
              ) : (
                filteredPersonnel.slice(0, 80).map((person) => {
                  const isTeamMulti = personnelModalConfig.target?.type === 'TEAM_MULTI';
                  const isAlreadySelected = isTeamMulti
                    ? teamMembers.some(
                        (m) =>
                          String(m.personnelId) === String(person.id) ||
                          m.fullName === person.fullName
                      )
                    : personnelModalConfig.target?.type === 'PM'
                    ? Number(projectManagerId) === Number(person.id)
                    : personnelModalConfig.target?.type === 'SPONSOR'
                    ? Number(projectSponsorId) === Number(person.id)
                    : false;

                  return (
                    <div
                      key={person.id}
                      onClick={() => handleSelectPersonInModal(person)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                        isAlreadySelected
                          ? 'bg-teal-50 border-teal-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-teal-400 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs ${
                            isAlreadySelected
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {person.fullName.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                            <span>{person.fullName}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-700">
                              کد پرسنلی: {person.personnelCode}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-slate-400" />
                              {person.jobTitle}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-teal-800">{person.unitName}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          isAlreadySelected
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-teal-600 hover:text-white'
                        }`}
                      >
                        {isTeamMulti
                          ? isAlreadySelected
                            ? 'انتخاب‌شده (حذف)'
                            : 'افزودن به تیم'
                          : 'انتخاب فرد'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {personnelModalConfig.target?.type === 'TEAM_MULTI' && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  تعداد اعضای انتخاب‌شده در تیم پروژه: {teamMembers.length} نفر
                </span>
                <button
                  type="button"
                  onClick={() => setPersonnelModalConfig({ open: false, target: null })}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black"
                >
                  تأیید و بستن پنجره
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: CENTRAL ORGANIZATIONAL STRUCTURE TREE VIEW
         ============================================================ */}
      {orgModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            dir="rtl"
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-teal-400" />
                  درخت ساختار سازمانی مجتمع (انتخاب واحدهای مشمول پروژه)
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  متصل به تب مرکزی «ساختار سازمانی» — قابلیت انتخاب هم‌زمان چند واحد و تعیین واحد اصلی
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOrgModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="جستجوی نام واحد، شرکت، معاونت یا کد واحد عملیاتی..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold"
                />
              </div>
            </div>

            {/* Tree Hierarchy View */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {orgTreeData.units.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center space-y-2">
                  <FolderTree className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-black text-slate-700">
                    هیچ واحد یا مجتمع پیش‌فرضی در ساختار درختی ثبت نشده است.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    برای انتخاب واحد از ساختار درختی، ابتدا واحدهای مورد نظر خود را در تب «تنظیمات سیستم &gt; ساختار سازمانی &gt; ساختار درختی» تعریف نمایید.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {orgTreeData.units
                    .filter((u) => {
                      const q = orgSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        u.name.toLowerCase().includes(q) ||
                        u.code.toLowerCase().includes(q) ||
                        (u.departmentName && u.departmentName.toLowerCase().includes(q)) ||
                        (u.hierarchyPath && u.hierarchyPath.toLowerCase().includes(q))
                      );
                    })
                    .map((unit) => {
                      const selectedObj = coveredUnits.find(
                        (cu) => cu.unitId === unit.unitId || cu.code === unit.code
                      );
                      const isSelected = Boolean(selectedObj);

                      return (
                        <div
                          key={unit.unitId}
                          className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-teal-50 border-teal-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div
                            onClick={() => toggleCoveredUnit(unit)}
                            className="flex items-center gap-2.5 cursor-pointer flex-1"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-teal-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                <span>{unit.name}</span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600">
                                  {unit.code}
                                </span>
                              </div>
                              {unit.hierarchyPath && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {unit.hierarchyPath}
                                </div>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => setPrimaryCoveredUnit(unit.unitId)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                                selectedObj?.isPrimary
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:border-teal-500'
                              }`}
                            >
                              {selectedObj?.isPrimary
                                ? 'واحد اصلی پروژه'
                                : 'تعیین به‌عنوان واحد اصلی'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700">
                تعداد واحدهای انتخاب‌شده: {coveredUnits.length} واحد (واحد اصلی:{' '}
                {coveredUnits.find((u) => u.isPrimary)?.name || 'تعیین نشده'})
              </div>
              <button
                type="button"
                onClick={() => setOrgModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black"
              >
                تأیید و ثبت واحدهای مشمول
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
