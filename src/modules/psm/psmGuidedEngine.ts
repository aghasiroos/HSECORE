/**
 * موتور راهبر هوشمند استقرار PSM (Guided PSM Implementation & Management Engine)
 * ویژه مجتمع پتروشیمی رجال — منطبق بر سه اصل بنیادین:
 * ۱. اصل اول: کاربر نداند چه کاری باید انجام دهد؛ سیستم باید به او بگوید (Next Best Action Engine)
 * ۲. اصل دوم: کاربر نداند کار را از کجا انجام دهد؛ سیستم باید او را مستقیماً به همان فرم هدایت کند (Direct Context-Aware Form Launcher)
 * ۳. اصل سوم: مدیر نداند پروژه کجا متوقف شده است؛ داشبورد باید علت توقف و تصمیم موردنیاز را نشان دهد (Executive Stoppage & Decision Engine)
 */

import {
  CCPS_20_ELEMENTS,
  OSHA_14_CLAUSES,
  PSM_SPECIALIZED_SUBSYSTEMS,
} from './psmStandardsCatalog';
import type { PsmSubTabKey } from './PsmManagementModule';

export type SimpleStageStatus =
  | 'NOT_STARTED'       // شروع نشده
  | 'IN_PROGRESS'       // در حال انجام
  | 'ACTION_REQUIRED'   // نیازمند اقدام
  | 'PENDING_APPROVAL'  // در انتظار تأیید
  | 'STOPPED'           // متوقف‌شده
  | 'COMPLETED';        // تکمیل‌شده

export const SIMPLE_STAGE_STATUS_META: Record<
  SimpleStageStatus,
  { labelFa: string; badgeClass: string; borderClass: string; dotClass: string }
> = {
  NOT_STARTED: {
    labelFa: 'شروع نشده',
    badgeClass: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    borderClass: 'border-slate-200 dark:border-slate-800',
    dotClass: 'bg-slate-400',
  },
  IN_PROGRESS: {
    labelFa: 'در حال انجام',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30',
    borderClass: 'border-sky-500/40',
    dotClass: 'bg-sky-500',
  },
  ACTION_REQUIRED: {
    labelFa: 'نیازمند اقدام',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30',
    borderClass: 'border-blue-500/40',
    dotClass: 'bg-blue-500 animate-pulse',
  },
  PENDING_APPROVAL: {
    labelFa: 'در انتظار تأیید',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30',
    borderClass: 'border-indigo-500/40',
    dotClass: 'bg-indigo-500 animate-pulse',
  },
  STOPPED: {
    labelFa: 'متوقف‌شده',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30',
    borderClass: 'border-rose-500/50',
    dotClass: 'bg-rose-500 animate-ping',
  },
  COMPLETED: {
    labelFa: 'تکمیل‌شده',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-500',
  },
};

/**
 * زمینه هدایت مستقیم کاربر به فرم مقصد به همراه پیش‌پر کردن خودکار فیلدها (اصل دوم)
 */
export interface PsmDeepLinkAction {
  targetSubTab: PsmSubTabKey;
  actionType:
    | 'OPEN_CREATE_PROJECT'
    | 'OPEN_EDIT_PROJECT'
    | 'OPEN_ASSESSMENT_FORM'
    | 'OPEN_GAP_FORM'
    | 'CONVERT_GAP_TO_PLAN'
    | 'EXTEND_GAP_DEADLINE'
    | 'OPEN_WBS_FORM'
    | 'UPDATE_WBS_PROGRESS'
    | 'OPEN_DOCUMENT_FORM'
    | 'APPROVE_DOCUMENT'
    | 'REVISE_DOCUMENT'
    | 'OPEN_CAPA_FORM'
    | 'TRANSITION_CAPA'
    | 'OPEN_STUDY_FORM'
    | 'OPEN_MATURITY_FORM'
    | 'OPEN_GATE_EVALUATION'
    | 'OPEN_GATE_DECISION'
    | 'OPEN_HANDOVER_FORM';
  buttonLabelFa: string;
  contextTitleFa: string;
  contextHintFa: string;
  prefillData?: {
    recordId?: number | string;
    standardType?: 'CCPS_RBPS' | 'OSHA_1910_119';
    elementCode?: string;
    oshaClauseCode?: string;
    subsystemType?: string;
    unitName?: string;
    responsiblePersonName?: string;
    dueDate?: string;
    gateKey?: string;
    title?: string;
    description?: string;
    requiredEvidence?: string;
    riskLevel?: string;
  };
  returnToTab?: PsmSubTabKey;
}

/**
 * خروجی موتور هوشمند پیشنهاد اقدام بعدی (Next Best Action - اصل اول)
 */
export interface NextBestActionItem {
  id: string;
  stageNumber: number;
  stageTitleFa: string;
  titleFa: string;
  reasonFa: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  priorityLabelFa: string;
  responsiblePersonFa: string;
  unitNameFa: string;
  dueDateFa: string;
  requiredDocumentsFa: string[];
  prerequisitesMet: boolean;
  prerequisitesSummaryFa: string;
  impactOnProjectFa: string;
  targetAudience: 'EXPERT' | 'MANAGER' | 'BOTH';
  deepLink: PsmDeepLinkAction;
}

/**
 * مدل هر یک از ۷ مرحله اصلی مسیر استقرار PSM (بند ۳)
 */
export interface PsmImplementationStage {
  stageNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  key: string;
  titleFa: string;
  subtitleFa: string;
  plainDescriptionFa: string;
  linkedGateKey: 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';
  status: SimpleStageStatus;
  statusLabelFa: string;
  realProgressPct: number;
  paperProgressPct: number;
  completedActionsCount: number;
  remainingActionsCount: number;
  responsiblePersonFa: string;
  plannedDueDateFa: string;
  blockersAndStopReasonsFa: string[];
  requiredEvidenceFa: string[];
  nextRecommendedAction: NextBestActionItem | null;
  primarySubTab: PsmSubTabKey;
}

/**
 * مدل تشخیص توقف پروژه و تصمیم‌های مدیریتی موردنیاز (اصل سوم)
 */
export interface ProjectStoppageDiagnosis {
  isProjectStopped: boolean;
  overallHealthStatus: 'STOPPED' | 'AT_RISK' | 'AWAITING_DECISION' | 'ON_TRACK' | 'COMPLETED';
  overallHealthTitleFa: string;
  stoppedAtStageTitleFa: string | null;
  stoppedAtGateKey: string | null;
  stopDurationDays: number;
  stopReasonsFa: string[];
  criticalBlockers: Array<{
    id: string;
    titleFa: string;
    causeFa: string;
    responsiblePersonFa: string;
    unitNameFa: string;
    stoppedDays: number;
    requiredDecisionFa: string;
    deepLink: PsmDeepLinkAction;
  }>;
  pendingManagerDecisions: Array<{
    id: string;
    gateOrModuleKey: string;
    decisionTitleFa: string;
    whyNeededFa: string;
    responsibleApproverFa: string;
    waitingDays: number;
    evidenceReady: boolean;
    blockingCriteriaFa: string[];
    deepLink: PsmDeepLinkAction;
  }>;
}

/**
 * دسته‌بندی ۸گانه کارتابل واحد کاربران «کارهای من» (بند ۶)
 */
export type UnifiedTaskCategoryKey =
  | 'NEW_TASKS'             // وظایف جدید
  | 'IN_PROGRESS'           // وظایف در حال انجام
  | 'DOCS_NEEDING_COMPLETION' // مدارک نیازمند تکمیل
  | 'SUBMITTED_FOR_APPROVAL'  // موارد ارسال‌شده برای تأیید
  | 'RETURNED_FOR_REWORK'   // موارد برگشت‌خورده
  | 'DUE_SOON'              // وظایف نزدیک به سررسید
  | 'OVERDUE'               // وظایف معوق
  | 'DECISIONS_REQUIRED';   // تصمیم‌های موردنیاز

export interface UnifiedActionCardItem {
  id: string;
  recordCode: string;
  category: UnifiedTaskCategoryKey;
  categoryLabelFa: string;
  titleFa: string;
  plainExplanationFa: string;
  projectNameFa: string;
  unitNameFa: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priorityLabelFa: string;
  responsiblePersonFa: string;
  dueDateFa: string;
  isOverdue: boolean;
  delayDays: number;
  statusLabelFa: string;
  requiredEvidenceFa: string;
  sourceDataBadgeFa?: string;
  isAssignedToCurrentUser: boolean;
  deepLink: PsmDeepLinkAction;
}

/**
 * اعلان هوشمند و بدون تکرار (بند ۱۱)
 */
export type PsmSmartNotificationType =
  | 'TASK_ASSIGNED'      // تخصیص وظیفه
  | 'DUE_SOON'           // نزدیک شدن موعد
  | 'OVERDUE_DELAY'      // تأخیر
  | 'DOCUMENT_RETURNED'  // برگشت مدرک
  | 'APPROVAL_REQUESTED' // درخواست تأیید
  | 'GATE_STOPPED'       // توقف Gate
  | 'BLOCKER_RESOLVED'   // رفع مانع
  | 'STAGE_COMPLETED';   // تکمیل مرحله

export interface PsmSmartNotification {
  id: string;
  type: PsmSmartNotificationType;
  typeLabelFa: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
  titleFa: string;
  messageFa: string;
  responsibleFa: string;
  dueDateFa?: string;
  deepLink: PsmDeepLinkAction;
}

/**
 * راهنمای درون‌برنامه‌ای ساده‌سازی مفاهیم تخصصی PSM (بند ۸)
 */
export interface PsmPlainLanguageGuideItem {
  key: string;
  code: string;
  shortTitleFa: string;
  englishTerm: string;
  whatIsItFa: string;           // ۱. این موضوع چیست؟
  whyNeededFa: string;          // ۲. چرا باید انجام شود؟
  whoIsResponsibleFa: string;   // ۳. چه کسی مسئول است؟
  requiredInputsFa: string[];   // ۴. چه اطلاعاتی لازم دارد؟
  expectedOutputsFa: string[];  // ۵. چه خروجی‌ای باید تولید شود؟
  whatHappensNextFa: string;    // ۶. بعد از آن چه کاری باید انجام شود؟
  advancedReferenceFa: string;  // توضیحات تخصصی تکمیلی (اختیاری)
  relatedSubTab: PsmSubTabKey;
}

export const PSM_PLAIN_LANGUAGE_GUIDES: PsmPlainLanguageGuideItem[] = [
  {
    key: 'PSI',
    code: 'CCPS-06 / OSHA-02',
    shortTitleFa: 'اطلاعات پایه و فنی ایمنی فرایند (PSI)',
    englishTerm: 'Process Safety Information (PSI)',
    whatIsItFa:
      'شناسنامه فنی و ایمنی کامل واحد فرایندی شامل خطرات مواد شیمیایی (SDS)، نقشه‌های فرایندی به‌روز (P&ID)، حدود ایمن دما و فشار (SOL) و مشخصات طراحی تجهیزات است.',
    whyNeededFa:
      'بدون داشتن نقشه‌های دقیق و شناخت خواص مواد خطرناک، انجام هیچ مطالعه ریسک (HAZOP)، تغییر فنی (MOC) یا بازرسی فنی معتبر ممکن نیست.',
    whoIsResponsibleFa:
      'مهندسی فرایند، مهندسی عمومی و کارشناس HSE واحد (با نظارت رئیس مهندسی فرایند).',
    requiredInputsFa: [
      'برگه‌های اطلاعات ایمنی مواد شیمیایی (SDS/MSDS)',
      'نقشه‌های P&ID و PFD واحد و تغییرات اعمال‌شده در سایت (As-Built)',
      'کتابچه طراحی و حدود مجاز عملیاتی تجهیزات و شیرهای اطمینان (PSV)',
    ],
    expectedOutputsFa: [
      'پرونده مصوب اطلاعات ایمنی فرایند (PSI Dossier) در بانک مدارک',
      'جدول حدود ایمن عملیاتی (Safe Operating Limits) و پیامد انحراف',
      'فهرست تجهیزات بحرانی ایمنی (SCE) ثبت‌شده در سامانه',
    ],
    whatHappensNextFa:
      'پس از تکمیل و صحه‌گذاری پرونده PSI، پیش‌نیاز آغاز مطالعات شناسایی خطر و ارزیابی ریسک (PHA / HAZOP) فراهم می‌شود.',
    advancedReferenceFa:
      'مطابق بند 29 CFR 1910.119(d) استاندارد OSHA و عنصر ۶ چارچوب CCPS RBPS، اطلاعات PSI باید در سه بخش «مخاطرات مواد شیمیایی»، «فناوری فرایند» و «تجهیزات فرایندی (منطبق بر RAGAGEP)» پیش از اجرای PHA تکمیل و در دسترس کارکنان باشد.',
    relatedSubTab: 'documents',
  },
  {
    key: 'PHA',
    code: 'CCPS-07 / OSHA-03',
    shortTitleFa: 'شناسایی خطرات و ارزیابی ریسک فرایند (PHA)',
    englishTerm: 'Process Hazard Analysis (PHA)',
    whatIsItFa:
      'بررسی ساختاریافته و تیمی واحد فرایندی برای پیدا کردن نقاطی که ممکن است منجر به نشت مواد خطرناک، آتش‌سوزی، انفجار یا توقف فاجعه‌بار شوند.',
    whyNeededFa:
      'تا خطرات پنهان فرایند و کافی بودن لایه‌های حفاظتی (آلارم‌ها، شیرهای اطمینان، سیستم ESD) قبل از وقوع حادثه واقعی شناسایی و اصلاح شوند.',
    whoIsResponsibleFa:
      'تیم چندتخصصی به رهبری تسهیل‌گر ارشد PHA/HAZOP و با حضور الزامی مهندس فرایند، بهره‌بردار باتجربه، بازرس فنی، ابزاردقیق و کارشناس ایمنی.',
    requiredInputsFa: [
      'پرونده کامل و به‌روز اطلاعات ایمنی فرایند (PSI) و نقشه‌های P&ID',
      'سوابق حوادث و شبه‌حوادث قبلی واحد در ماژول حوادث HSECORE',
      'فهرست تغییرات انجام‌شده (MOC) از آخرین بازنگری',
    ],
    expectedOutputsFa: [
      'گزارش رسمی مطالعه PHA و فهرست سناریوهای پرریسک',
      'فهرست توصیه‌های اصلاحی با تعیین مسئول و مهلت در گردش کار CAPA',
    ],
    whatHappensNextFa:
      'توصیه‌های استخراج‌شده از PHA با یک کلیک به پرونده اقدام اصلاحی (CAPA) و بسته کاری WBS تبدیل شده و تا زمان اجرا و تأیید اثربخشی پیگیری می‌شوند.',
    advancedReferenceFa:
      'بر اساس بند 1910.119(e) استاندارد OSHA، مطالعات PHA باید حداقل هر ۵ سال یک‌بار بازنگری (Revalidate) شوند و کلیه یافته‌ها دارای جدول زمان‌بندی مصوب و شواهد بستن باشند.',
    relatedSubTab: 'studies',
  },
  {
    key: 'HAZOP',
    code: 'CCPS-07 / HAZOP',
    shortTitleFa: 'مطالعه نظام‌مند انحرافات فرایندی (HAZOP)',
    englishTerm: 'Hazard and Operability Study (HAZOP)',
    whatIsItFa:
      'رایج‌ترین و دقیق‌ترین روش اجرای PHA که در آن نقشه‌های P&ID به بخش‌های کوچک (Node) تقسیم شده و انحرافاتی مثل «فشار بیشتر»، «دبی کمتر» یا «دمای بالا» بررسی می‌شوند.',
    whyNeededFa:
      'برای اطمینان از اینکه در برابر هر انحراف خطرناک در راکتورها، برج‌ها، کمپرسورها و مخازن، حفاظ مستقل و قابل اعتماد وجود دارد.',
    whoIsResponsibleFa:
      'سرپرست مهندسی فرایند، تسهیل‌گر HAZOP و سرپرست بهره‌برداری واحد مربوطه.',
    requiredInputsFa: [
      'نقشه‌های P&ID تقسیم‌بندی‌شده به گره‌های مطالعاتی (Nodes)',
      'علت و معلول سیستم‌های توقف اضطراری (Cause & Effect Matrix)',
    ],
    expectedOutputsFa: [
      'کاربرگ‌های تکمیل‌شده HAZOP به تفکیک Node',
      'توصیه‌های اصلاحی اولویت‌بندی‌شده بر اساس شدت ریسک',
    ],
    whatHappensNextFa:
      'گره‌های دارای ریسک بالا وارد مطالعه لایه‌های حفاظتی (LOPA) می‌شوند و توصیه‌های اجرایی به کارتابل CAPA ارجاع می‌گردند.',
    advancedReferenceFa:
      'مبتنی بر استاندارد IEC 61882 و راهنمای CCPS؛ هر انحراف با ترکیب کلیدواژه راهنما (More, Less, No, Reverse) و پارامتر فرایندی (Flow, Pressure, Temperature, Level) تحلیل می‌شود.',
    relatedSubTab: 'studies',
  },
  {
    key: 'MOC',
    code: 'CCPS-13 / OSHA-10',
    shortTitleFa: 'مدیریت تغییرات فنی و سازمانی (MOC)',
    englishTerm: 'Management of Change (MOC)',
    whatIsItFa:
      'فرآیند بررسی و اخذ مجوز ایمنی قبل از ایجاد هرگونه تغییر در تجهیزات، مواد شیمیایی، برنامه کنترلی DCS، رویه‌های عملیاتی یا ساختار نفرات کلیدی (به‌جز تعویض قطعه عین‌به‌عین).',
    whyNeededFa:
      'بخش بزرگی از حوادث بزرگ صنایع پتروشیمی ناشی از تغییرات کوچکی بوده‌اند که بدون بررسی اثرات جانبی ایمنی اعمال شده‌اند.',
    whoIsResponsibleFa:
      'درخواست‌کننده تغییر (بهره‌برداری/مهندسی/تعمیرات)، کمیته بررسی فنی MOC و مدیر واحد/HSE.',
    requiredInputsFa: [
      'شرح فنی تغییر و علت نیاز به آن (موقت یا دائم)',
      'بررسی اثر تغییر بر ایمنی فرایند، نقشه‌های P&ID و دستورالعمل‌های عملیاتی',
    ],
    expectedOutputsFa: [
      'فرم مصوب MOC قبل از اجرای تغییر',
      'به‌روزرسانی نقشه‌های PSI و دستورالعمل SOP مرتبط و آموزش نفرات شیفت',
    ],
    whatHappensNextFa:
      'قبل از راه‌اندازی تجهیز یا بخش تغییریافته، باید بررسی ایمنی پیش از راه‌اندازی (PSSR) انجام شود.',
    advancedReferenceFa:
      'مطابق بند 1910.119(l) استاندارد OSHA، تغییرات موقت (مانند Jumper یا Bypass موقت) نیز مشمول MOC بوده و باید دارای تاریخ انقضای مشخص و بازگشت به وضعیت نرمال باشند.',
    relatedSubTab: 'studies',
  },
  {
    key: 'PSSR',
    code: 'CCPS-14 / OSHA-07',
    shortTitleFa: 'بررسی ایمنی پیش از راه‌اندازی (PSSR)',
    englishTerm: 'Pre-Startup Safety Review (PSSR)',
    whatIsItFa:
      'چک‌لیست و ممیزی نهایی ایمنی در سایت، درست قبل از تزریق مواد هیدروکربنی و شیمیایی به یک واحد جدید، واحد اورهال‌شده یا تجهیز تغییریافته در MOC.',
    whyNeededFa:
      'تا مطمئن شویم ساخت و نصب دقیقاً طبق طراحی انجام شده، دستورالعمل‌ها آماده است، اپراتورها آموزش دیده‌اند و هیچ نقص بحرانی بازی روی تجهیز باقی نمانده است.',
    whoIsResponsibleFa:
      'رئیس واحد بهره‌برداری، رئیس بازرسی فنی، رئیس تعمیرات و رئیس HSE.',
    requiredInputsFa: [
      'پرونده تغییر (MOC) یا صورتجلسه پایان تعمیرات',
      'وضعیت بسته شدن توصیه‌های الزامی پیش از راه‌اندازی (Pre-Startup Punch List)',
    ],
    expectedOutputsFa: [
      'گواهی امضاشده مجوز راه‌اندازی ایمن (PSSR Sign-Off Certificate)',
    ],
    whatHappensNextFa:
      'صدور مجوز ورود مواد به فرایند و آغاز بهره‌برداری نرمال تحت پایش پارامترهای عملیاتی.',
    advancedReferenceFa:
      'الزام مستقیم بند 1910.119(i) استاندارد OSHA و عنصر ۱۴ چارچوب CCPS RBPS (Operational Readiness).',
    relatedSubTab: 'studies',
  },
  {
    key: 'MI',
    code: 'CCPS-10 / OSHA-08',
    shortTitleFa: 'مدیریت یکپارچگی مکانیکی تجهیزات بحرانی (MI)',
    englishTerm: 'Mechanical Integrity (MI)',
    whatIsItFa:
      'برنامه منظم بازرسی فنی، تست دوره‌ای و نگهداری پیشگیرانه تجهیزات حیاتی (مخازن تحت فشار، خطوط لوله، شیرهای اطمینان PSV، سیستم‌های اعلام و اطفاء و اینترلاک‌های ایمنی SIS).',
    whyNeededFa:
      'برای جلوگیری از خوردگی، نشتی، ترکیدگی خطوط و اطمینان از اینکه شیر اطمینان یا سیستم توقف اضطراری در لحظه حادثه بدون خطا عمل می‌کند.',
    whoIsResponsibleFa:
      'واحد بازرسی فنی و خوردگی، مدیریت تعمیرات و نگهداری (نت) و ابزاردقیق.',
    requiredInputsFa: [
      'فهرست تجهیزات بحرانی ایمنی (SCE Register) در بخش دارایی‌های پروژه',
      'استانداردهای بازرسی و تست (API 510/570/653 و IEC 61511)',
    ],
    expectedOutputsFa: [
      'برنامه و گزارش‌های بازرسی مبتنی بر ریسک (RBI) و تست کالیبراسیون PSV/SIS',
      'پرونده رفع نواقص تجهیزات بحرانی در CAPA',
    ],
    whatHappensNextFa:
      'ثبت گواهی سلامت تجهیزات در بانک مدارک PSM و اتصال نواقص بحرانی به گردش کار CAPA.',
    advancedReferenceFa:
      'مطابق بند 1910.119(j) استاندارد OSHA، هرگونه نقص در تجهیزات بحرانی باید قبل از ادامه بهره‌برداری اصلاح شود یا اقدامات جبرانی مهندسی مصوب برای کارکرد موقت ایمن مستقر گردد.',
    relatedSubTab: 'studies',
  },
  {
    key: 'SOP',
    code: 'CCPS-08 / OSHA-04',
    shortTitleFa: 'دستورالعمل‌های استاندارد عملیاتی (SOP)',
    englishTerm: 'Standard Operating Procedures (SOP)',
    whatIsItFa:
      'راهنمای گام‌به‌گام و مکتوب برای اپراتورها شامل راه‌اندازی، عملیات نرمال، توقف عادی، توقف اضطراری (ESD) و راه‌اندازی پس از تعمیرات.',
    whyNeededFa:
      'تا تمام نوبت‌کاران به یک روش استاندارد و ایمن کار کنند و در شرایط اضطراری دچار خطای انسانی نشوند.',
    whoIsResponsibleFa:
      'رئیس بهره‌برداری واحد، مهندس فرایند و سرپرستان نوبت‌کاری.',
    requiredInputsFa: [
      'حدود ایمن عملیاتی (SOL) از پرونده PSI',
      'تجربیات عملیاتی نوبت‌کاران و توصیه‌های مطالعات HAZOP',
    ],
    expectedOutputsFa: [
      'دستورالعمل‌های عملیاتی مصوب در بانک اسناد PSM',
      'گواهی بازنگری و تصدیق سالانه صحت دستورالعمل‌ها',
    ],
    whatHappensNextFa:
      'اجرای دوره‌های آموزشی و سنجش مهارت اپراتورها بر مبنای دستورالعمل‌های مصوب.',
    advancedReferenceFa:
      'بند 1910.119(f) استاندارد OSHA تصدیق سالانه (Annual Certification) به‌روز و دقیق بودن دستورالعمل‌های عملیاتی را الزامی می‌داند.',
    relatedSubTab: 'documents',
  },
  {
    key: 'CAPA',
    code: 'CCPS-19 / CAPA-8',
    shortTitleFa: 'گردش کار ۸ مرحله‌ای اقدامات اصلاحی و پیشگیرانه (CAPA)',
    englishTerm: '8-Stage Corrective & Preventive Action (CAPA)',
    whatIsItFa:
      'مسیر رسمی پیگیری هر نقص یا توصیه ایمنی از لحظه شناسایی تا ریشه‌یابی، اجرا، بارگذاری شواهد، بررسی مستقل اثربخشی و بستن نهایی پرونده.',
    whyNeededFa:
      'تا هیچ نقص ایمنی صرفاً روی کاغذ بسته نشود و قبل از بستن، یک نفر مستقل از مجری، اثربخش بودن اقدام را در سایت تأیید کند.',
    whoIsResponsibleFa:
      'مجری اقدام (مسئول واحد مربوطه) + بازبین فنی + ارزیاب مستقل اثربخشی (HSE/PSM).',
    requiredInputsFa: [
      'نقص استخراج‌شده از تحلیل شکاف (Gap)، مطالعه HAZOP یا ممیزی',
      'تحلیل علت ریشه‌ای و شرح اقدام اصلاحی و پیشگیرانه',
    ],
    expectedOutputsFa: [
      'شواهد اجرایی مستند + گزارش تأیید اثربخشی توسط فرد مستقل',
    ],
    whatHappensNextFa:
      'با بسته شدن پرونده‌های CAPA بحرانی، مانع عبور از دروازه کنترلی G5 و تحویل نهایی پروژه برطرف می‌شود.',
    advancedReferenceFa:
      'موتور حاکمیت HSECORE در سمت سرور مانع از بستن CAPA بدون ثبت شواهد و مانع از تأیید اثربخشی توسط خود شخص مجری می‌شود.',
    relatedSubTab: 'capa',
  },
  {
    key: 'STAGE_GATE',
    code: 'G1 – G6',
    shortTitleFa: 'دروازه‌های ۶گانه کنترل مراحل مدیریتی (Stage Gate)',
    englishTerm: 'Stage-Gate Governance (G1 to G6)',
    whatIsItFa:
      'شش ایستگاه کنترلی رسمی (G1 تا G6) که در پایان هر فاز، تکمیل بودن مدارک، شواهد و رفع نواقص بحرانی را قبل از صدور مجوز ورود به فاز بعدی بررسی می‌کند.',
    whyNeededFa:
      'برای جلوگیری از پیشرفت صوری و کاغذی پروژه؛ هیچ مرحله‌ای بدون شواهد واقعی و تأیید مدیر مجاز تکمیل‌شده اعلام نمی‌شود.',
    whoIsResponsibleFa:
      'آماده‌سازی توسط مدیر پروژه PSM و تصویب نهایی توسط حامی پروژه / کمیته راهبری.',
    requiredInputsFa: [
      'تکمیل چک‌لیست الزامات خروجی هر دروازه',
      'بسته شدن یا تعیین تکلیف شکاف‌ها و مدارک مرتبط با آن دروازه',
    ],
    expectedOutputsFa: [
      'مصوبه رسمی عبور از دروازه G1 تا G6 در کارتابل حاکمیت',
    ],
    whatHappensNextFa:
      'پس از تصویب هر دروازه، مرحله بعدی در «مسیر استقرار PSM» فعال می‌شود و در صورت تغییر در مدارک مصوب قبلی، دروازه به‌طور خودکار برای بازبینی مجدد بازگشایی می‌گردد.',
    advancedReferenceFa:
      'شامل ۶ دروازه: G1 (تأیید دامنه و ارزیابی اولیه)، G2 (تأیید تحلیل شکاف)، G3 (تصویب برنامه اجرایی و منابع)، G4 (تأیید خروجی‌ها و مدارک)، G5 (تأیید اثربخشی اقدامات) و G6 (تصویب نهایی و تحویل پروژه).',
    relatedSubTab: 'stage-gates',
  },
];

/**
 * محاسبه تفکیک «پیشرفت واقعی استقرار (مبتنی بر شواهد و تأیید)» از «پیشرفت کاغذی و ثبت فرم‌ها» (بند ۱۷-۷)
 */
export function computeRealVsPaperProgress(
  activeProject: any,
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  },
  stageGates?: any[]
) {
  if (!activeProject) {
    return {
      realProgressPct: 0,
      paperProgressPct: 0,
      gapBetweenPaperAndRealPct: 0,
      explanationFa: 'هنوز پروژه‌ای تعریف نشده است.',
    };
  }

  // Paper progress: counts drafts, registered assessments, registered gaps, created WBS, draft docs, registered CAPAs
  const charterPaper = activeProject.isDraft ? 50 : 100;
  const assessedCount = projectData.assessments.length;
  const assessmentPaper = Math.min(100, Math.round((assessedCount / 20) * 100));
  const gapsPaper = projectData.gaps.length > 0 ? 100 : assessedCount >= 5 ? 50 : 0;
  const wbsPaper = projectData.wbsTasks.length > 0 ? 100 : 0;
  const docsPaper = Math.min(100, Math.round((projectData.documents.length / 6) * 100));
  const capaPaper =
    projectData.capaItems.length > 0
      ? Math.round(
          (projectData.capaItems.filter((c) => c.stage !== 'REGISTERED').length /
            projectData.capaItems.length) *
            100
        )
      : 0;

  const paperProgressPct = Math.min(
    100,
    Math.round(
      charterPaper * 0.15 +
        assessmentPaper * 0.2 +
        gapsPaper * 0.15 +
        wbsPaper * 0.15 +
        docsPaper * 0.2 +
        capaPaper * 0.15
    )
  );

  // Real verified progress: strictly requires finalized charter, in-scope verified assessments, assigned/converted gaps, actual WBS completion, APPROVED documents with evidence, EFFECTIVENESS_VERIFIED / CLOSED CAPA, and APPROVED Stage Gates
  const charterReal =
    !activeProject.isDraft &&
    activeProject.projectManagerName &&
    activeProject.sponsorName &&
    Array.isArray(activeProject.coveredUnits) &&
    activeProject.coveredUnits.length > 0
      ? 100
      : 25;

  const verifiedAssessments = projectData.assessments.filter(
    (a) =>
      a.assessorName &&
      (a.isInScope !== false || (a.outOfScopeJustification && a.outOfScopeApprovedBy))
  ).length;
  const assessmentReal = Math.min(100, Math.round((verifiedAssessments / 20) * 100));

  const validAssignedGaps = projectData.gaps.filter(
    (g) => g.responsiblePersonName && g.proposedDueDate && g.riskLevel
  ).length;
  const gapsReal =
    projectData.gaps.length > 0
      ? Math.round((validAssignedGaps / projectData.gaps.length) * 100)
      : verifiedAssessments >= 20
      ? 100
      : 0;

  const wbsReal =
    projectData.wbsTasks.length > 0
      ? Math.round(
          projectData.wbsTasks.reduce((acc, t) => acc + Number(t.actualProgress || 0), 0) /
            projectData.wbsTasks.length
        )
      : 0;

  const approvedDocsWithEvidence = projectData.documents.filter(
    (d) =>
      d.status === 'APPROVED' &&
      ((d.evidenceSummary && String(d.evidenceSummary).trim().length >= 10) ||
        d.fileId ||
        d.fileUrl)
  ).length;
  const docsReal =
    projectData.documents.length > 0
      ? Math.min(100, Math.round((approvedDocsWithEvidence / Math.max(4, projectData.documents.length)) * 100))
      : 0;

  const verifiedCapaCount = projectData.capaItems.filter(
    (c) =>
      (c.stage === 'CLOSED' || c.stage === 'EFFECTIVENESS_VERIFIED') &&
      c.effectivenessVerifierName &&
      c.effectivenessVerifierName !== c.responsiblePersonName
  ).length;
  const capaReal =
    projectData.capaItems.length > 0
      ? Math.round((verifiedCapaCount / projectData.capaItems.length) * 100)
      : 0;

  const approvedGatesCount = Array.isArray(stageGates)
    ? stageGates.filter((g) => g.status === 'APPROVED').length
    : 0;
  const gatesReal = Math.round((approvedGatesCount / 6) * 100);

  const realProgressPct = Math.min(
    100,
    Math.round(
      charterReal * 0.12 +
        assessmentReal * 0.18 +
        gapsReal * 0.14 +
        wbsReal * 0.16 +
        docsReal * 0.16 +
        capaReal * 0.14 +
        gatesReal * 0.1
    )
  );

  const gapBetweenPaperAndRealPct = Math.max(0, paperProgressPct - realProgressPct);

  let explanationFa = 'پیشرفت واقعی و مستندسازی هم‌راستا هستند.';
  if (gapBetweenPaperAndRealPct >= 20) {
    explanationFa =
      'توجه مدیریتی: بخشی از فرم‌ها و مدارک به‌صورت پیش‌نویس ثبت شده‌اند اما هنوز فاقد شواهد اجرایی معتبر، تأیید نهایی یا صحه‌گذاری اثربخشی هستند.';
  } else if (gapBetweenPaperAndRealPct >= 8) {
    explanationFa =
      'تعدادی از مدارک یا اقدامات ثبت‌شده در انتظار تکمیل شواهد و تأیید نهایی برای احتساب در پیشرفت واقعی استقرار هستند.';
  }

  return {
    realProgressPct,
    paperProgressPct,
    gapBetweenPaperAndRealPct,
    explanationFa,
  };
}

/**
 * محاسبه وضعیت ۷ مرحله اصلی استقرار PSM، موانع، مدارک لازم و اقدام بعدی هر مرحله (بند ۳ و ۵)
 */
export function computeSevenStagesRoadmap(
  activeProject: any,
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  },
  stageGates: any[] = []
): PsmImplementationStage[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  const pmName = activeProject?.projectManagerName || 'مدیر پروژه PSM';
  const sponsorName = activeProject?.sponsorName || activeProject?.projectSponsorName || 'حامی ارشد پروژه';
  const defaultUnit =
    (Array.isArray(activeProject?.coveredUnits) &&
      (typeof activeProject.coveredUnits[0] === 'string'
        ? activeProject.coveredUnits[0]
        : activeProject.coveredUnits[0]?.name)) ||
    'واحد پلیمریزاسیون';

  const findGate = (key: string) => stageGates.find((g) => g.gateKey === key) || null;
  const g1 = findGate('G1');
  const g2 = findGate('G2');
  const g3 = findGate('G3');
  const g4 = findGate('G4');
  const g5 = findGate('G5');
  const g6 = findGate('G6');

  // -------------------------------------------------------------------------
  // STAGE 1: تعریف پروژه و تشکیل تیم
  // -------------------------------------------------------------------------
  const hasProject = Boolean(activeProject);
  const isDraftProject = Boolean(activeProject?.isDraft || activeProject?.overallStatus === 'DRAFT');
  const hasPmAndSponsor = Boolean(
    activeProject?.projectManagerName &&
      activeProject?.projectManagerName !== 'در انتظار انتخاب مدیر پروژه' &&
      (activeProject?.sponsorName || activeProject?.projectSponsorName)
  );
  const teamCount = Array.isArray(activeProject?.teamMembers) ? activeProject.teamMembers.length : 0;
  const unitsCount = Array.isArray(activeProject?.coveredUnits) ? activeProject.coveredUnits.length : 0;
  const milestonesCount = Array.isArray(activeProject?.milestones) ? activeProject.milestones.length : 0;
  const assetsCount = projectData.assets.length;

  const s1Checks = [
    hasProject,
    !isDraftProject,
    hasPmAndSponsor,
    teamCount > 0,
    unitsCount > 0,
    milestonesCount > 0,
  ];
  const s1Done = s1Checks.filter(Boolean).length;
  const s1Total = s1Checks.length;
  const s1RealPct = Math.round((s1Done / s1Total) * 100);
  const s1Blockers: string[] = [];
  if (!hasProject) s1Blockers.push('هنوز پروژه استقرار PSM در سامانه تعریف نشده است.');
  if (hasProject && isDraftProject) s1Blockers.push('منشور پروژه در وضعیت «پیش‌نویس» قرار دارد و ثبت نهایی نشده است.');
  if (hasProject && !hasPmAndSponsor) s1Blockers.push('مدیر پروژه یا حامی ارشد پروژه (Sponsor) مشخص نشده است.');
  if (hasProject && unitsCount === 0) s1Blockers.push('واحدهای عملیاتی مشمول پروژه انتخاب نشده‌اند.');
  if (hasProject && teamCount === 0) s1Blockers.push('اعضای تیم چندتخصصی استقرار PSM انتخاب نشده‌اند.');

  let s1Status: SimpleStageStatus = 'NOT_STARTED';
  if (!hasProject) s1Status = 'ACTION_REQUIRED';
  else if (isDraftProject || !hasPmAndSponsor || unitsCount === 0) s1Status = 'ACTION_REQUIRED';
  else if (s1RealPct === 100) s1Status = 'COMPLETED';
  else s1Status = 'IN_PROGRESS';

  const s1NextAction: NextBestActionItem | null = !hasProject
    ? {
        id: 'nba-s1-create-project',
        stageNumber: 1,
        stageTitleFa: '۱. تعریف پروژه و تشکیل تیم',
        titleFa: 'تعریف منشور پروژه استقرار PSM و انتخاب تیم و واحدهای مشمول',
        reasonFa: 'برای شروع استقرار ایمنی فرایند در مجتمع پتروشیمی رجال، ابتدا باید پروژه، مدیر، حامی، اعضای تیم و واحدهای مشمول ثبت شوند.',
        priority: 'CRITICAL',
        priorityLabelFa: 'فوری / نقطه شروع',
        responsiblePersonFa: 'مدیر HSE / مدیر پروژه استقرار PSM',
        unitNameFa: 'کل مجتمع پتروشیمی رجال',
        dueDateFa: todayStr,
        requiredDocumentsFa: ['منشور پروژه استقرار PSM', 'فهرست واحدهای عملیاتی مشمول و اعضای تیم'],
        prerequisitesMet: true,
        prerequisitesSummaryFa: 'آماده شروع بلافاصله (متصل به بانک پرسنلی و ساختار سازمانی مرکزی)',
        impactOnProjectFa: 'راه‌اندازی خودکار ۶ دروازه کنترلی (G1–G6) و ساختار شکست کار (WBS)',
        targetAudience: 'BOTH',
        deepLink: {
          targetSubTab: 'project',
          actionType: 'OPEN_CREATE_PROJECT',
          buttonLabelFa: 'شروع گام‌به‌گام تعریف پروژه',
          contextTitleFa: 'راهنمای گام‌به‌گام تعریف پروژه استقرار PSM',
          contextHintFa: 'اطلاعات پرسنل و واحدهای سازمانی به‌طور خودکار از بانک مرکزی بارگذاری شده‌اند.',
        },
      }
    : s1RealPct < 100
    ? {
        id: 'nba-s1-complete-charter',
        stageNumber: 1,
        stageTitleFa: '۱. تعریف پروژه و تشکیل تیم',
        titleFa: isDraftProject
          ? 'تکمیل و ثبت نهایی پیش‌نویس منشور پروژه استقرار PSM'
          : 'تکمیل اعضای تیم استقرار و واحدهای مشمول در منشور پروژه',
        reasonFa: s1Blockers[0] || 'برخی اطلاعات پایه منشور پروژه نیازمند تکمیل هستند.',
        priority: 'HIGH',
        priorityLabelFa: 'اولویت بالا',
        responsiblePersonFa: pmName,
        unitNameFa: defaultUnit,
        dueDateFa: activeProject?.startDate || todayStr,
        requiredDocumentsFa: ['منشور مصوب پروژه', 'احکام اعضای تیم استقرار PSM'],
        prerequisitesMet: true,
        prerequisitesSummaryFa: 'پیش‌نویس اولیه موجود است',
        impactOnProjectFa: 'تکمیل مرحله اول و باز شدن مسیر ارزیابی وضعیت موجود',
        targetAudience: 'BOTH',
        deepLink: {
          targetSubTab: 'project',
          actionType: 'OPEN_EDIT_PROJECT',
          buttonLabelFa: 'تکمیل و ثبت نهایی منشور پروژه',
          contextTitleFa: 'تکمیل منشور و تیم پروژه استقرار PSM',
          contextHintFa: 'موارد ناقص منشور را بررسی و دکمه ثبت نهایی پروژه را کلیک کنید.',
        },
      }
    : assetsCount === 0
    ? {
        id: 'nba-s1-register-assets',
        stageNumber: 1,
        stageTitleFa: '۱. تعریف پروژه و تشکیل تیم',
        titleFa: 'ثبت تجهیزات بحرانی ایمنی (SCE) در واحدهای مشمول پروژه',
        reasonFa: 'منشور پروژه تکمیل شده است؛ ثبت تجهیزات کلیدی فرایندی (راکتور، مخزن، کمپرسور) دقت ارزیابی و MI را افزایش می‌دهد.',
        priority: 'MEDIUM',
        priorityLabelFa: 'پیشنهاد تکمیلی',
        responsiblePersonFa: pmName,
        unitNameFa: defaultUnit,
        dueDateFa: activeProject?.endDate || todayStr,
        requiredDocumentsFa: ['فهرست تجهیزات بحرانی ایمنی (SCE Register)'],
        prerequisitesMet: true,
        prerequisitesSummaryFa: 'منشور پروژه مصوب است',
        impactOnProjectFa: 'تکمیل شناسنامه دارایی‌های مشمول PSM',
        targetAudience: 'EXPERT',
        deepLink: {
          targetSubTab: 'org-assets',
          actionType: 'OPEN_EDIT_PROJECT',
          buttonLabelFa: 'ثبت تجهیزات بحرانی واحدها',
          contextTitleFa: 'ثبت تجهیزات بحرانی ایمنی (SCE)',
          contextHintFa: 'تگ و مشخصات تجهیز فرایندی را برای اتصال به PSI و MI وارد کنید.',
          prefillData: {
            unitName: defaultUnit,
            responsiblePersonName: pmName,
          },
        },
      }
    : null;

  // -------------------------------------------------------------------------
  // STAGE 2: ارزیابی وضعیت موجود (۲۰ عنصر CCPS و ۱۴ الزام OSHA)
  // -------------------------------------------------------------------------
  const ccpsAssessedCodes = new Set(
    projectData.assessments
      .filter((a) => (a.framework || a.standardType || 'CCPS_RBPS') === 'CCPS_RBPS')
      .map((a) => a.elementCode)
  );
  const oshaAssessedCodes = new Set(
    projectData.assessments
      .filter((a) => (a.framework || a.standardType) === 'OSHA_1910_119')
      .map((a) => a.elementCode)
  );
  const missingCcpsElements = CCPS_20_ELEMENTS.filter((el) => !ccpsAssessedCodes.has(el.code));
  const missingOshaClauses = OSHA_14_CLAUSES.filter((cl) => !oshaAssessedCodes.has(cl.code));

  const totalAssessmentTargets = 20; // Primary 20 CCPS elements baseline
  const completedAssessmentsCount = Math.min(20, ccpsAssessedCodes.size);
  const remainingAssessmentsCount = Math.max(0, totalAssessmentTargets - completedAssessmentsCount);
  const s2RealPct = hasProject ? Math.round((completedAssessmentsCount / totalAssessmentTargets) * 100) : 0;

  const unverifiedOutOfScopeAssessments = projectData.assessments.filter(
    (a) =>
      (a.complianceStatus === 'OUT_OF_SCOPE' || a.isInScope === false) &&
      (!a.outOfScopeApprovedBy || String(a.outOfScopeJustification || '').length < 15)
  );

  const s2Blockers: string[] = [];
  if (hasProject && completedAssessmentsCount === 0) {
    s2Blockers.push('ارزیابی اولیه وضعیت موجود (Baseline Assessment) برای عناصر ۲۰گانه CCPS هنوز آغاز نشده است.');
  } else if (hasProject && remainingAssessmentsCount > 0) {
    s2Blockers.push(
      `${remainingAssessmentsCount} عنصر از ۲۰ عنصر CCPS RBPS هنوز ارزیابی نشده‌اند (اولین مورد: ${missingCcpsElements[0]?.code} - ${missingCcpsElements[0]?.titleFa}).`
    );
  }
  if (unverifiedOutOfScopeAssessments.length > 0) {
    s2Blockers.push(
      `${unverifiedOutOfScopeAssessments.length} عنصر خارج از دامنه فاقد توجیه فنی معتبر یا تأییدیه مقام مجاز است.`
    );
  }

  let s2Status: SimpleStageStatus = 'NOT_STARTED';
  if (!hasProject || s1RealPct < 60) {
    s2Status = 'NOT_STARTED';
  } else if (unverifiedOutOfScopeAssessments.length > 0) {
    s2Status = 'STOPPED';
  } else if (completedAssessmentsCount === 0) {
    s2Status = 'ACTION_REQUIRED';
  } else if (completedAssessmentsCount < 20) {
    s2Status = 'IN_PROGRESS';
  } else if (g1 && g1.status !== 'APPROVED') {
    s2Status = 'PENDING_APPROVAL';
  } else {
    s2Status = 'COMPLETED';
  }

  const nextMissingCcps = missingCcpsElements[0] || CCPS_20_ELEMENTS[0];
  const s2NextAction: NextBestActionItem | null =
    hasProject && s1RealPct >= 60 && completedAssessmentsCount < 20
      ? {
          id: `nba-s2-assess-${nextMissingCcps.code}`,
          stageNumber: 2,
          stageTitleFa: '۲. ارزیابی وضعیت موجود',
          titleFa:
            completedAssessmentsCount === 0
              ? `شروع ارزیابی اولیه وضعیت موجود با عنصر اول (${nextMissingCcps.code}: ${nextMissingCcps.titleFa})`
              : `ثبت ارزیابی عنصر ${nextMissingCcps.code} (${nextMissingCcps.titleFa}) — ${remainingAssessmentsCount} عنصر باقی‌مانده`,
          reasonFa: `پروژه تعریف شده است. برای شناسایی خودکار نواقص و عبور از دروازه G1، وضعیت موجود عناصر ۲۰گانه CCPS باید ارزیابی شود.`,
          priority: completedAssessmentsCount === 0 ? 'CRITICAL' : 'HIGH',
          priorityLabelFa: completedAssessmentsCount === 0 ? 'اقدام فوری مرحله جاری' : 'اولویت بالا',
          responsiblePersonFa: pmName,
          unitNameFa: defaultUnit,
          dueDateFa: activeProject?.endDate || todayStr,
          requiredDocumentsFa: nextMissingCcps.requiredDocTemplates,
          prerequisitesMet: s1RealPct >= 60,
          prerequisitesSummaryFa: 'منشور پروژه و واحدهای مشمول تعریف شده‌اند',
          impactOnProjectFa: 'استخراج خودکار شکاف‌های انطباق (Gap) و آماده‌سازی دروازه کنترلی G1',
          targetAudience: 'EXPERT',
          deepLink: {
            targetSubTab: 'assessment',
            actionType: 'OPEN_ASSESSMENT_FORM',
            buttonLabelFa: `شروع ارزیابی ${nextMissingCcps.code}`,
            contextTitleFa: `ثبت ارزیابی عنصر ${nextMissingCcps.code}: ${nextMissingCcps.titleFa}`,
            contextHintFa: `معیار ارزیابی: ${nextMissingCcps.defaultCriteriaFa}`,
            prefillData: {
              standardType: 'CCPS_RBPS',
              elementCode: nextMissingCcps.code,
              unitName: defaultUnit,
              responsiblePersonName: pmName,
              requiredEvidence: nextMissingCcps.requiredDocTemplates.join('، '),
            },
          },
        }
      : hasProject && completedAssessmentsCount >= 1 && g1 && g1.status !== 'APPROVED'
      ? {
          id: 'nba-s2-approve-g1',
          stageNumber: 2,
          stageTitleFa: '۲. ارزیابی وضعیت موجود',
          titleFa: 'بررسی و تصویب دروازه کنترلی اول (G1: تأیید دامنه و ارزیابی اولیه)',
          reasonFa: 'ارزیابی اولیه وضعیت موجود انجام شده است و دروازه G1 آماده بررسی و تأیید مدیریت جهت ورود رسمی به مرحله تحلیل شکاف است.',
          priority: 'HIGH',
          priorityLabelFa: 'نیازمند تصمیم مدیریت',
          responsiblePersonFa: g1.approverName || sponsorName,
          unitNameFa: defaultUnit,
          dueDateFa: todayStr,
          requiredDocumentsFa: ['گزارش ارزیابی اولیه وضعیت موجود', 'منشور مصوب پروژه'],
          prerequisitesMet: true,
          prerequisitesSummaryFa: 'ارزیابی‌های اولیه در پایگاه داده ثبت شده‌اند',
          impactOnProjectFa: 'عبور رسمی از دروازه G1 و قفل شدن خط مبنای ارزیابی',
          targetAudience: 'MANAGER',
          deepLink: {
            targetSubTab: 'stage-gates',
            actionType: 'OPEN_GATE_DECISION',
            buttonLabelFa: 'بررسی و تصویب دروازه G1',
            contextTitleFa: 'تصمیم‌گیری مدیریتی دروازه کنترلی G1',
            contextHintFa: 'چک‌لیست معیارهای خروجی G1 را بررسی و تصمیم رسمی را ثبت نمایید.',
            prefillData: {
              gateKey: 'G1',
              responsiblePersonName: g1.approverName || sponsorName,
            },
          },
        }
      : null;

  // -------------------------------------------------------------------------
  // STAGE 3: شناسایی نواقص و تعیین اولویت‌ها (Gap Analysis)
  // -------------------------------------------------------------------------
  const nonCompliantAssessments = projectData.assessments.filter(
    (a) => a.isInScope !== false && Number(a.complianceScore ?? a.currentScore ?? 0) < 85
  );
  const totalGaps = projectData.gaps.length;
  const unassignedGaps = projectData.gaps.filter(
    (g) => !g.responsiblePersonName || !g.proposedDueDate || !g.riskLevel
  );
  const unlinkedGaps = projectData.gaps.filter(
    (g) => g.status !== 'CLOSED' && !g.isOutOfScope && !g.linkedWbsId && !g.linkedCapaId
  );
  const criticalOpenGaps = projectData.gaps.filter(
    (g) => g.riskLevel === 'CRITICAL' && g.status !== 'CLOSED' && !g.isOutOfScope
  );
  const overdueGaps = projectData.gaps.filter(
    (g) => g.status !== 'CLOSED' && !g.isOutOfScope && g.proposedDueDate && String(g.proposedDueDate) < todayStr
  );

  const s3CompletedCount = Math.max(0, totalGaps - unassignedGaps.length);
  const s3RemainingCount =
    totalGaps === 0 && nonCompliantAssessments.length > 0
      ? nonCompliantAssessments.length
      : unassignedGaps.length;

  const s3RealPct =
    totalGaps > 0
      ? Math.round(((totalGaps - unassignedGaps.length) / totalGaps) * 100)
      : completedAssessmentsCount >= 20 && nonCompliantAssessments.length === 0
      ? 100
      : 0;

  const s3Blockers: string[] = [];
  if (nonCompliantAssessments.length > 0 && totalGaps === 0) {
    s3Blockers.push(
      `${nonCompliantAssessments.length} عدم انطباق در ارزیابی اولیه شناسایی شده اما هنوز به فهرست شکاف‌ها (Gap Analysis) استخراج نشده‌اند.`
    );
  }
  if (unassignedGaps.length > 0) {
    s3Blockers.push(
      `${unassignedGaps.length} شکاف شناسایی‌شده فاقد مسئول مستقیم، سطح ریسک یا مهلت انجام هستند.`
    );
  }
  if (overdueGaps.length > 0) {
    s3Blockers.push(`${overdueGaps.length} شکاف از مهلت تعیین‌شده عبور کرده و معوق شده‌اند.`);
  }

  let s3Status: SimpleStageStatus = 'NOT_STARTED';
  if (completedAssessmentsCount === 0) {
    s3Status = 'NOT_STARTED';
  } else if (unassignedGaps.length > 0 || overdueGaps.length > 0) {
    s3Status = 'STOPPED';
  } else if (totalGaps === 0 && nonCompliantAssessments.length > 0) {
    s3Status = 'ACTION_REQUIRED';
  } else if (g2 && g2.status !== 'APPROVED' && totalGaps > 0) {
    s3Status = 'PENDING_APPROVAL';
  } else if (totalGaps > 0 && unassignedGaps.length === 0) {
    s3Status = 'COMPLETED';
  } else {
    s3Status = 'IN_PROGRESS';
  }

  const s3NextAction: NextBestActionItem | null =
    completedAssessmentsCount > 0 && totalGaps === 0 && nonCompliantAssessments.length > 0
      ? {
          id: 'nba-s3-extract-gaps',
          stageNumber: 3,
          stageTitleFa: '۳. شناسایی نواقص و تعیین اولویت‌ها',
          titleFa: `استخراج خودکار ${nonCompliantAssessments.length} شکاف انطباق از نتایج ارزیابی اولیه`,
          reasonFa: 'ارزیابی اولیه ثبت شده است. اکنون باید نواقص شناسایی‌شده استخراج شوند و برای هر نقص مسئول، سطح ریسک و مهلت تعیین گردد.',
          priority: 'CRITICAL',
          priorityLabelFa: 'فوری',
          responsiblePersonFa: pmName,
          unitNameFa: defaultUnit,
          dueDateFa: todayStr,
          requiredDocumentsFa: ['جدول تحلیل شکاف (Gap Analysis Register)'],
          prerequisitesMet: completedAssessmentsCount > 0,
          prerequisitesSummaryFa: `${completedAssessmentsCount} ارزیابی اولیه در سیستم ثبت شده است`,
          impactOnProjectFa: 'ایجاد فهرست نواقص اولویت‌بندی‌شده برای تدوین برنامه اجرایی',
          targetAudience: 'EXPERT',
          deepLink: {
            targetSubTab: 'gap-analysis',
            actionType: 'OPEN_GAP_FORM',
            buttonLabelFa: 'مشاهده و استخراج شکاف‌ها',
            contextTitleFa: 'تحلیل شکاف و تعیین مسئول و مهلت نواقص',
            contextHintFa: 'با کلیک روی «استخراج خودکار شکاف‌ها»، کلیه عدم‌انطباق‌های ارزیابی به فهرست شکاف‌ها اضافه می‌شوند.',
          },
        }
      : unassignedGaps.length > 0
      ? {
          id: `nba-s3-assign-gap-${unassignedGaps[0].id}`,
          stageNumber: 3,
          stageTitleFa: '۳. شناسایی نواقص و تعیین اولویت‌ها',
          titleFa: `تعیین مسئول و مهلت برای شکاف «${unassignedGaps[0].title}»`,
          reasonFa: `${unassignedGaps.length} شکاف شناسایی‌شده فاقد مسئول یا مهلت هستند که مانع از تصویب دروازه G2 می‌شوند.`,
          priority: 'CRITICAL',
          priorityLabelFa: 'رفع مانع توقف G2',
          responsiblePersonFa: pmName,
          unitNameFa: unassignedGaps[0].unitName || defaultUnit,
          dueDateFa: todayStr,
          requiredDocumentsFa: [unassignedGaps[0].requiredDocument || 'گزارش تحلیل شکاف'],
          prerequisitesMet: true,
          prerequisitesSummaryFa: 'شکاف در سیستم ثبت شده است',
          impactOnProjectFa: 'رفع مانع دروازه کنترلی G2',
          targetAudience: 'BOTH',
          deepLink: {
            targetSubTab: 'gap-analysis',
            actionType: 'OPEN_GAP_FORM',
            buttonLabelFa: 'تعیین مسئول و مهلت شکاف',
            contextTitleFa: `تکمیل مشخصات شکاف ${unassignedGaps[0].gapCode || ''}`,
            contextHintFa: 'مسئول مستقیم، سطح ریسک و مهلت انجام را برای این شکاف مشخص کنید.',
            prefillData: {
              recordId: unassignedGaps[0].id,
              unitName: unassignedGaps[0].unitName || defaultUnit,
              elementCode: unassignedGaps[0].ccpsElementCode || 'CCPS-06',
              title: unassignedGaps[0].title,
            },
          },
        }
      : totalGaps > 0 && g2 && g2.status !== 'APPROVED'
      ? {
          id: 'nba-s3-approve-g2',
          stageNumber: 3,
          stageTitleFa: '۳. شناسایی نواقص و تعیین اولویت‌ها',
          titleFa: 'بررسی و تصویب گزارش تحلیل شکاف در دروازه کنترلی G2',
          reasonFa: `تمامی ${totalGaps} شکاف دارای مسئول، مهلت و سطح ریسک هستند. اکنون مدیر/کمیته باید دروازه G2 را تصویب کند.`,
          priority: 'HIGH',
          priorityLabelFa: 'نیازمند تصمیم مدیریت',
          responsiblePersonFa: g2.approverName || sponsorName,
          unitNameFa: defaultUnit,
          dueDateFa: todayStr,
          requiredDocumentsFa: ['گزارش تحلیل شکاف مصوب', 'ماتریس اولویت‌بندی ریسک نواقص'],
          prerequisitesMet: unassignedGaps.length === 0,
          prerequisitesSummaryFa: 'کلیه شکاف‌ها دارای مسئول و مهلت معتبر هستند',
          impactOnProjectFa: 'تصویب دروازه G2 و صدور مجوز تصویب برنامه اجرایی (G3)',
          targetAudience: 'MANAGER',
          deepLink: {
            targetSubTab: 'stage-gates',
            actionType: 'OPEN_GATE_DECISION',
            buttonLabelFa: 'بررسی و تصویب دروازه G2',
            contextTitleFa: 'تصویب دروازه کنترلی G2 (تحلیل شکاف)',
            contextHintFa: 'معیارهای دروازه G2 احراز شده‌اند؛ تصمیم نهایی مدیریت را ثبت کنید.',
            prefillData: {
              gateKey: 'G2',
            },
          },
        }
      : null;

  // -------------------------------------------------------------------------
  // STAGE 4: تدوین برنامه اجرایی (WBS، زمان‌بندی و منابع — G3)
  // -------------------------------------------------------------------------
  const totalWbs = projectData.wbsTasks.length;
  const completedWbsCount = projectData.wbsTasks.filter(
    (t) => Number(t.actualProgress || 0) >= 100 || t.status === 'COMPLETED'
  ).length;
  const remainingWbsCount = Math.max(0, totalWbs - completedWbsCount);
  const invalidWbsTasks = projectData.wbsTasks.filter(
    (t) => !t.ownerName || !t.plannedStart || !t.plannedEnd
  );
  const delayedWbsTasks = projectData.wbsTasks.filter(
    (t) => (Number(t.delayDays || 0) > 0 || (t.plannedEnd && String(t.plannedEnd) < todayStr)) && Number(t.actualProgress || 0) < 100
  );
  const unmappedCriticalGaps = projectData.gaps.filter(
    (g) => g.riskLevel === 'CRITICAL' && g.status === 'OPEN' && !g.linkedWbsId && !g.linkedCapaId
  );

  const s4RealPct =
    totalWbs > 0
      ? Math.round(
          projectData.wbsTasks.reduce((acc, t) => acc + Number(t.actualProgress || 0), 0) / totalWbs
        )
      : 0;

  const s4Blockers: string[] = [];
  if (totalWbs === 0 && totalGaps > 0) {
    s4Blockers.push('هیچ بسته کاری در ساختار شکست کار (WBS) برای رفع شکاف‌ها تعریف نشده است.');
  }
  if (unmappedCriticalGaps.length > 0) {
    s4Blockers.push(
      `${unmappedCriticalGaps.length} شکاف بحرانی هنوز به بسته کاری WBS یا پرونده اقدام اصلاحی CAPA تبدیل نشده‌اند.`
    );
  }
  if (invalidWbsTasks.length > 0) {
    s4Blockers.push(
      `${invalidWbsTasks.length} فعالیت اجرایی در برنامه WBS فاقد مسئول یا تاریخ شروع/پایان هستند.`
    );
  }
  if (delayedWbsTasks.length > 0) {
    s4Blockers.push(`${delayedWbsTasks.length} فعالیت در برنامه زمان‌بندی دارای تأخیر هستند.`);
  }

  let s4Status: SimpleStageStatus = 'NOT_STARTED';
  if (!hasProject || (totalGaps === 0 && totalWbs === 0)) {
    s4Status = 'NOT_STARTED';
  } else if (unmappedCriticalGaps.length > 0 || invalidWbsTasks.length > 0) {
    s4Status = 'STOPPED';
  } else if (totalWbs === 0) {
    s4Status = 'ACTION_REQUIRED';
  } else if (g3 && g3.status !== 'APPROVED') {
    s4Status = 'PENDING_APPROVAL';
  } else if (s4RealPct >= 100) {
    s4Status = 'COMPLETED';
  } else {
    s4Status = 'IN_PROGRESS';
  }

  const targetGapForConvert = unmappedCriticalGaps[0] || unlinkedGaps[0];
  const s4NextAction: NextBestActionItem | null = targetGapForConvert
    ? {
        id: `nba-s4-convert-gap-${targetGapForConvert.id}`,
        stageNumber: 4,
        stageTitleFa: '۴. تدوین برنامه اجرایی',
        titleFa: `تبدیل شکاف «${targetGapForConvert.title}» به برنامه اجرایی WBS و پرونده CAPA`,
        reasonFa: `${unmappedCriticalGaps.length > 0 ? `${unmappedCriticalGaps.length} شکاف بحرانی` : `${unlinkedGaps.length} شکاف باز`} هنوز وارد برنامه زمان‌بندی WBS و گردش کار CAPA نشده است.`,
        priority: targetGapForConvert.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        priorityLabelFa: targetGapForConvert.riskLevel === 'CRITICAL' ? 'مانع بحرانی دروازه G3' : 'اولویت بالا',
        responsiblePersonFa: targetGapForConvert.responsiblePersonName || pmName,
        unitNameFa: targetGapForConvert.unitName || defaultUnit,
        dueDateFa: targetGapForConvert.proposedDueDate || todayStr,
        requiredDocumentsFa: [targetGapForConvert.requiredDocument || 'برنامه اجرایی WBS و گانت'],
        prerequisitesMet: true,
        prerequisitesSummaryFa: 'شکاف در مرحله تحلیل شکاف ثبت و اولویت‌بندی شده است',
        impactOnProjectFa: 'ایجاد خودکار بسته کاری در WBS و پرونده اقدام اصلاحی در CAPA',
        targetAudience: 'EXPERT',
        deepLink: {
          targetSubTab: 'gap-analysis',
          actionType: 'CONVERT_GAP_TO_PLAN',
          buttonLabelFa: 'تبدیل مستقیم به فعالیت WBS و CAPA',
          contextTitleFa: `تبدیل شکاف ${targetGapForConvert.gapCode} به برنامه اجرایی`,
          contextHintFa: 'با یک کلیک روی دکمه «تبدیل به WBS + CAPA» در کارت شکاف، فعالیت اجرایی و پرونده اقدام اصلاحی ساخته می‌شوند.',
          prefillData: {
            recordId: targetGapForConvert.id,
            title: targetGapForConvert.title,
            unitName: targetGapForConvert.unitName,
            responsiblePersonName: targetGapForConvert.responsiblePersonName,
            dueDate: targetGapForConvert.proposedDueDate,
          },
        },
      }
    : totalWbs > 0 && g3 && g3.status !== 'APPROVED'
    ? {
        id: 'nba-s4-approve-g3',
        stageNumber: 4,
        stageTitleFa: '۴. تدوین برنامه اجرایی',
        titleFa: 'بررسی و تصویب برنامه اجرایی پروژه و منابع در دروازه G3',
        reasonFa: 'ساختار شکست کار (WBS)، مسئولیت‌ها و بودجه تعریف شده‌اند و در انتظار تصویب مدیریت در دروازه G3 هستند.',
        priority: 'HIGH',
        priorityLabelFa: 'نیازمند تصمیم مدیریت',
        responsiblePersonFa: g3.approverName || sponsorName,
        unitNameFa: defaultUnit,
        dueDateFa: todayStr,
        requiredDocumentsFa: ['ساختار شکست کار (WBS) و نمودار گانت', 'برآورد بودجه و تخصیص منابع'],
        prerequisitesMet: unmappedCriticalGaps.length === 0 && invalidWbsTasks.length === 0,
        prerequisitesSummaryFa: 'کلیه شکاف‌های بحرانی به برنامه WBS متصل شده‌اند',
        impactOnProjectFa: 'تصویب خط مبنای برنامه زمان‌بندی و عبور از دروازه G3',
        targetAudience: 'MANAGER',
        deepLink: {
          targetSubTab: 'stage-gates',
          actionType: 'OPEN_GATE_DECISION',
          buttonLabelFa: 'بررسی و تصویب دروازه G3',
          contextTitleFa: 'تصویب برنامه اجرایی و منابع (Gate 3)',
          contextHintFa: 'معیارهای دروازه G3 را بررسی و مصوبه برنامه اجرایی را ثبت کنید.',
          prefillData: {
            gateKey: 'G3',
          },
        },
      }
    : null;

  // -------------------------------------------------------------------------
  // STAGE 5: تکمیل مدارک و اجرای اقدامات (بانک اسناد و ۱۴ زیرماژول تخصصی — G4)
  // -------------------------------------------------------------------------
  const totalDocs = projectData.documents.length;
  const approvedDocsCount = projectData.documents.filter((d) => d.status === 'APPROVED').length;
  const pendingDocs = projectData.documents.filter((d) => d.status !== 'APPROVED');
  const docsMissingEvidence = projectData.documents.filter(
    (d) =>
      d.status !== 'APPROVED' &&
      (!d.evidenceSummary || String(d.evidenceSummary).trim().length < 10) &&
      !d.fileId &&
      !d.fileUrl
  );
  const totalStudies = projectData.studies.length;

  const targetDocsBenchmark = Math.max(4, totalDocs);
  const s5RealPct =
    totalDocs > 0 ? Math.min(100, Math.round((approvedDocsCount / targetDocsBenchmark) * 100)) : 0;

  const s5Blockers: string[] = [];
  if (totalDocs === 0 && hasProject) {
    s5Blockers.push('هنوز هیچ مدرک فنی یا روش اجرایی در بانک مدارک PSM ثبت نشده است.');
  }
  if (docsMissingEvidence.length > 0) {
    s5Blockers.push(
      `${docsMissingEvidence.length} مدرک ثبت‌شده فاقد خلاصه شواهد اجرایی یا فایل پیوست هستند و امکان تأیید نهایی ندارند.`
    );
  }
  if (pendingDocs.length > 0 && docsMissingEvidence.length === 0) {
    s5Blockers.push(`${pendingDocs.length} مدرک تکمیل‌شده در انتظار بررسی و تأیید نهایی هستند.`);
  }

  let s5Status: SimpleStageStatus = 'NOT_STARTED';
  if (!hasProject || (totalDocs === 0 && totalStudies === 0 && totalWbs === 0)) {
    s5Status = 'NOT_STARTED';
  } else if (docsMissingEvidence.length > 0) {
    s5Status = 'ACTION_REQUIRED';
  } else if (pendingDocs.length > 0) {
    s5Status = 'PENDING_APPROVAL';
  } else if (totalDocs === 0) {
    s5Status = 'ACTION_REQUIRED';
  } else if (approvedDocsCount === totalDocs && totalDocs >= 1 && (!g4 || g4.status === 'APPROVED')) {
    s5Status = 'COMPLETED';
  } else {
    s5Status = 'IN_PROGRESS';
  }

  const firstPendingDoc = docsMissingEvidence[0] || pendingDocs[0];
  const s5NextAction: NextBestActionItem | null =
    hasProject && totalDocs === 0
      ? {
          id: 'nba-s5-create-first-doc',
          stageNumber: 5,
          stageTitleFa: '۵. تکمیل مدارک و اجرای اقدامات',
          titleFa: 'ثبت و بارگذاری مدارک کلیدی ایمنی فرایند (PSI / MOC / MI / SOP) در بانک مدارک',
          reasonFa: 'برای استقرار واقعی عناصر PSM و عبور از دروازه G4، مدارک و شواهد فنی واحدها باید در بانک مدارک ثبت و تأیید شوند.',
          priority: 'HIGH',
          priorityLabelFa: 'الزامی برای دروازه G4',
          responsiblePersonFa: pmName,
          unitNameFa: defaultUnit,
          dueDateFa: activeProject?.endDate || todayStr,
          requiredDocumentsFa: [
            'پرونده اطلاعات ایمنی فرایند (PSI Dossier)',
            'روش اجرایی مدیریت تغییر (MOC)',
            'برنامه یکپارچگی مکانیکی تجهیزات (MI)',
          ],
          prerequisitesMet: true,
          prerequisitesSummaryFa: 'برنامه پروژه فعال است',
          impactOnProjectFa: 'تکمیل بانک اسناد PSM و احراز معیارهای دروازه کنترلی G4',
          targetAudience: 'EXPERT',
          deepLink: {
            targetSubTab: 'documents',
            actionType: 'OPEN_DOCUMENT_FORM',
            buttonLabelFa: 'ثبت اولین مدرک و شواهد فنی',
            contextTitleFa: 'ثبت مدرک و شواهد اجرایی در بانک اسناد PSM',
            contextHintFa: 'اطلاعات مدرک و خلاصه شواهد اجرایی را وارد نمایید تا آماده تأیید شود.',
            prefillData: {
              elementCode: 'CCPS-06',
              oshaClauseCode: 'OSHA-02',
              unitName: defaultUnit,
              responsiblePersonName: pmName,
              title: `پرونده اطلاعات ایمنی فرایند (PSI) — ${defaultUnit}`,
            },
          },
        }
      : firstPendingDoc
      ? {
          id: `nba-s5-doc-${firstPendingDoc.id}`,
          stageNumber: 5,
          stageTitleFa: '۵. تکمیل مدارک و اجرای اقدامات',
          titleFa:
            docsMissingEvidence.some((d) => d.id === firstPendingDoc.id)
              ? `تکمیل شواهد اجرایی مدرک «${firstPendingDoc.title}» (${firstPendingDoc.docCode})`
              : `بررسی و تأیید نهایی مدرک «${firstPendingDoc.title}» (${firstPendingDoc.docCode})`,
          reasonFa:
            docsMissingEvidence.some((d) => d.id === firstPendingDoc.id)
              ? `مدرک ${firstPendingDoc.docCode} در وضعیت پیش‌نویس بوده و فاقد شواهد اجرایی کافی است. بدون ثبت شواهد، تأیید آن در سرور قفل است.`
              : `${pendingDocs.length} مدرک از مدارک موردنیاز عناصر PSM شواهد کامل دارند و منتظر تأیید نهایی هستند.`,
          priority: 'HIGH',
          priorityLabelFa: docsMissingEvidence.some((d) => d.id === firstPendingDoc.id)
            ? 'نیازمند تکمیل شواهد'
            : 'در انتظار تأیید',
          responsiblePersonFa:
            docsMissingEvidence.some((d) => d.id === firstPendingDoc.id)
              ? firstPendingDoc.authorName || pmName
              : firstPendingDoc.approverName || sponsorName,
          unitNameFa: firstPendingDoc.unitName || defaultUnit,
          dueDateFa: firstPendingDoc.validityExpiryDate || todayStr,
          requiredDocumentsFa: [firstPendingDoc.title],
          prerequisitesMet: true,
          prerequisitesSummaryFa: 'مدرک در بانک اسناد ثبت شده است',
          impactOnProjectFa: 'تأیید مدرک و باز شدن مسیر دروازه کنترلی G4',
          targetAudience: docsMissingEvidence.some((d) => d.id === firstPendingDoc.id)
            ? 'EXPERT'
            : 'MANAGER',
          deepLink: {
            targetSubTab: 'documents',
            actionType: docsMissingEvidence.some((d) => d.id === firstPendingDoc.id)
              ? 'REVISE_DOCUMENT'
              : 'APPROVE_DOCUMENT',
            buttonLabelFa: docsMissingEvidence.some((d) => d.id === firstPendingDoc.id)
              ? 'تکمیل شواهد این مدرک'
              : 'بررسی و تأیید نهایی مدرک',
            contextTitleFa: `تکمیل و تأیید مدرک ${firstPendingDoc.docCode}`,
            contextHintFa: 'شواهد اجرایی مدرک را ثبت یا تأیید نهایی نمایید.',
            prefillData: {
              recordId: firstPendingDoc.id,
              elementCode: firstPendingDoc.ccpsElementCode,
              unitName: firstPendingDoc.unitName,
              title: firstPendingDoc.title,
            },
          },
        }
      : null;

  // -------------------------------------------------------------------------
  // STAGE 6: پایش پیشرفت و رفع نواقص (گردش کار ۸ مرحله‌ای CAPA — G5)
  // -------------------------------------------------------------------------
  const totalCapa = projectData.capaItems.length;
  const closedCapaCount = projectData.capaItems.filter(
    (c) => c.stage === 'CLOSED' || c.stage === 'EFFECTIVENESS_VERIFIED'
  ).length;
  const openCapaItems = projectData.capaItems.filter((c) => c.stage !== 'CLOSED');
  const criticalOpenCapa = openCapaItems.filter(
    (c) => c.riskLevel === 'CRITICAL' || Number(c.riskSeverity || 0) >= 4
  );
  const overdueCapa = openCapaItems.filter((c) => c.dueDate && String(c.dueDate) < todayStr);

  const s6RealPct =
    totalCapa > 0 ? Math.round((closedCapaCount / totalCapa) * 100) : 0;

  const s6Blockers: string[] = [];
  if (criticalOpenCapa.length > 0) {
    s6Blockers.push(
      `${criticalOpenCapa.length} پرونده اقدام اصلاحی بحرانی (Critical CAPA) هنوز بسته و صحه‌گذاری نشده‌اند.`
    );
  }
  if (overdueCapa.length > 0) {
    s6Blockers.push(`${overdueCapa.length} اقدام اصلاحی (CAPA) از مهلت مقرر عبور کرده‌اند.`);
  }

  let s6Status: SimpleStageStatus = 'NOT_STARTED';
  if (totalCapa === 0 && totalWbs === 0) {
    s6Status = 'NOT_STARTED';
  } else if (overdueCapa.length > 0 || criticalOpenCapa.length > 0) {
    s6Status = 'ACTION_REQUIRED';
  } else if (openCapaItems.some((c) => c.stage === 'UNDER_REVIEW' || c.stage === 'EVIDENCE_SUBMITTED')) {
    s6Status = 'PENDING_APPROVAL';
  } else if (totalCapa > 0 && openCapaItems.length === 0) {
    s6Status = 'COMPLETED';
  } else {
    s6Status = 'IN_PROGRESS';
  }

  const targetCapa = criticalOpenCapa[0] || overdueCapa[0] || openCapaItems[0];
  const s6NextAction: NextBestActionItem | null = targetCapa
    ? {
        id: `nba-s6-capa-${targetCapa.id}`,
        stageNumber: 6,
        stageTitleFa: '۶. پایش پیشرفت و رفع نواقص',
        titleFa: `پیگیری و پیشبرد مرحله اقدام اصلاحی «${targetCapa.title}» (${targetCapa.capaCode})`,
        reasonFa: `این پرونده در مرحله «${targetCapa.stage}» قرار دارد و برای رفع نقص واحد ${targetCapa.unitName || defaultUnit} و عبور از دروازه G5 نیازمند تکمیل اقدام و صحه‌گذاری اثربخشی است.`,
        priority:
          targetCapa.riskLevel === 'CRITICAL' || Number(targetCapa.riskSeverity || 0) >= 4
            ? 'CRITICAL'
            : 'HIGH',
        priorityLabelFa:
          targetCapa.riskLevel === 'CRITICAL' ? 'نقص بحرانی باز' : 'اقدام اصلاحی فعال',
        responsiblePersonFa: targetCapa.responsiblePersonName || pmName,
        unitNameFa: targetCapa.unitName || defaultUnit,
        dueDateFa: targetCapa.dueDate || todayStr,
        requiredDocumentsFa: ['شواهد اجرای اقدام اصلاحی', 'گزارش صحه‌گذاری اثربخشی مستقل'],
        prerequisitesMet: true,
        prerequisitesSummaryFa: 'پرونده CAPA ثبت و به مسئول مربوطه ارجاع شده است',
        impactOnProjectFa: 'بستن نقص فرایندی و باز شدن دروازه کنترلی G5',
        targetAudience:
          targetCapa.stage === 'EVIDENCE_SUBMITTED' || targetCapa.stage === 'UNDER_REVIEW'
            ? 'MANAGER'
            : 'EXPERT',
        deepLink: {
          targetSubTab: 'capa',
          actionType: 'TRANSITION_CAPA',
          buttonLabelFa: 'ورود مستقیم به فرم اقدام CAPA',
          contextTitleFa: `پیشبرد مرحله پرونده ${targetCapa.capaCode}`,
          contextHintFa: 'علت ریشه‌ای، شواهد اقدام و تأیید اثربخشی را در مودال گردش کار ۸ مرحله‌ای ثبت کنید.',
          prefillData: {
            recordId: targetCapa.id,
            title: targetCapa.title,
            unitName: targetCapa.unitName,
            responsiblePersonName: targetCapa.responsiblePersonName,
            dueDate: targetCapa.dueDate,
          },
        },
      }
    : null;

  // -------------------------------------------------------------------------
  // STAGE 7: ارزیابی اثربخشی و تأیید نهایی (مدل بلوغ ۵ سطحی و تحویل پروژه — G6)
  // -------------------------------------------------------------------------
  const latestMaturity = projectData.maturityRecords[0] || null;
  const maturityScore = Number(latestMaturity?.overallMaturityScore || 0);
  const isHandedOver =
    activeProject?.overallStatus === 'COMPLETED' ||
    activeProject?.overallStatus === 'ACTIVE_SYSTEM' ||
    g6?.status === 'APPROVED';

  const s7Checks = [
    Boolean(latestMaturity),
    maturityScore >= 3.0,
    criticalOpenGaps.length === 0 && criticalOpenCapa.length === 0,
    isHandedOver,
  ];
  const s7Done = s7Checks.filter(Boolean).length;
  const s7RealPct = isHandedOver ? 100 : Math.round((s7Done / s7Checks.length) * 100);

  const s7Blockers: string[] = [];
  if (!latestMaturity) {
    s7Blockers.push('ارزیابی مدل بلوغ ۵ سطحی PSM هنوز انجام و ثبت نشده است.');
  } else if (maturityScore < 3.0) {
    s7Blockers.push(`امتیاز بلوغ فعلی (${maturityScore} از ۵) کمتر از حداقل نصاب تحویل نهایی (۳.۰۰) است.`);
  }
  if (criticalOpenGaps.length > 0 || criticalOpenCapa.length > 0) {
    s7Blockers.push(
      `وجود ${criticalOpenGaps.length} شکاف بحرانی باز و ${criticalOpenCapa.length} اقدام اصلاحی بحرانی باز مانع از تحویل نهایی پروژه در دروازه G6 است.`
    );
  }

  let s7Status: SimpleStageStatus = 'NOT_STARTED';
  if (isHandedOver) {
    s7Status = 'COMPLETED';
  } else if (!latestMaturity && s5RealPct < 50) {
    s7Status = 'NOT_STARTED';
  } else if (criticalOpenGaps.length > 0 || criticalOpenCapa.length > 0) {
    s7Status = 'STOPPED';
  } else if (!latestMaturity || maturityScore < 3.0) {
    s7Status = 'ACTION_REQUIRED';
  } else {
    s7Status = 'PENDING_APPROVAL';
  }

  const s7NextAction: NextBestActionItem | null = isHandedOver
    ? null
    : !latestMaturity || maturityScore < 3.0
    ? {
        id: 'nba-s7-maturity',
        stageNumber: 7,
        stageTitleFa: '۷. ارزیابی اثربخشی و تأیید نهایی',
        titleFa: 'ثبت ارزیابی مدل بلوغ ۵ سطحی PSM برای سنجش اثربخشی استقرار',
        reasonFa: 'برای صدور مجوز تحویل نهایی پروژه (Gate 6)، ارزیابی مستقل بلوغ ۲۰ عنصر در ۴ بعد طراحی، اجرا، فرهنگ و پایداری الزامی است.',
        priority: 'MEDIUM',
        priorityLabelFa: 'پیش‌نیاز تحویل نهایی (G6)',
        responsiblePersonFa: pmName,
        unitNameFa: 'کل مجتمع پتروشیمی رجال',
        dueDateFa: activeProject?.endDate || todayStr,
        requiredDocumentsFa: ['کارنامه ارزیابی بلوغ ۵ سطحی PSM'],
        prerequisitesMet: completedAssessmentsCount > 0,
        prerequisitesSummaryFa: 'ارزیابی اولیه و اقدامات اجرایی در جریان است',
        impactOnProjectFa: 'احراز نصاب بلوغ سطح ۳+ برای دروازه نهایی G6',
        targetAudience: 'EXPERT',
        deepLink: {
          targetSubTab: 'maturity',
          actionType: 'OPEN_MATURITY_FORM',
          buttonLabelFa: 'ورود به فرم ارزیابی بلوغ ۵ سطحی',
          contextTitleFa: 'ارزیابی مدل بلوغ ۵ سطحی ایمنی فرایند',
          contextHintFa: 'امتیاز ابعاد چهارگانه عناصر را تنظیم و ارزیابی بلوغ را ثبت نمایید.',
          prefillData: {
            responsiblePersonName: pmName,
            unitName: 'کل مجتمع',
          },
        },
      }
    : {
        id: 'nba-s7-handover',
        stageNumber: 7,
        stageTitleFa: '۷. ارزیابی اثربخشی و تأیید نهایی',
        titleFa: 'بررسی نهایی و تصویب تحویل رسمی پروژه استقرار PSM (دروازه G6)',
        reasonFa: 'مدل بلوغ و کنترل‌های اجرایی تکمیل شده‌اند؛ پروژه آماده تصویب نهایی و انتقال به چرخه بهره‌برداری پایدار است.',
        priority: 'HIGH',
        priorityLabelFa: 'تصمیم نهایی مدیریت ارشد',
        responsiblePersonFa: sponsorName,
        unitNameFa: 'کل مجتمع پتروشیمی رجال',
        dueDateFa: activeProject?.endDate || todayStr,
        requiredDocumentsFa: ['گزارش ممیزی نهایی PSM', 'گواهی تحویل نهایی پروژه (Gate 6)'],
        prerequisitesMet: criticalOpenGaps.length === 0 && criticalOpenCapa.length === 0,
        prerequisitesSummaryFa: 'فاقد نقص بحرانی باز و دارای امتیاز بلوغ کافی',
        impactOnProjectFa: 'تحویل رسمی و تکمیل ۱۰۰٪ پروژه استقرار PSM',
        targetAudience: 'MANAGER',
        deepLink: {
          targetSubTab: 'handover',
          actionType: 'OPEN_HANDOVER_FORM',
          buttonLabelFa: 'ورود به فرم تصویب و تحویل نهایی',
          contextTitleFa: 'تأیید نهایی و تحویل پروژه استقرار PSM',
          contextHintFa: 'شماره گزارش ممیزی نهایی را ثبت و تحویل پروژه را تصویب کنید.',
        },
      };

  return [
    {
      stageNumber: 1,
      key: 'STAGE_1_CHARTER',
      titleFa: '۱. تعریف پروژه و تشکیل تیم',
      subtitleFa: 'منشور پروژه، مدیر و حامی، اعضای تیم، واحدهای مشمول و نقاط عطف',
      plainDescriptionFa:
        'تعیین مشخصات پایه پروژه، انتخاب مدیر و حامی از بانک پرسنلی، انتخاب واحدهای عملیاتی مشمول و ثبت تجهیزات بحرانی.',
      linkedGateKey: 'G1',
      status: s1Status,
      statusLabelFa: SIMPLE_STAGE_STATUS_META[s1Status].labelFa,
      realProgressPct: s1RealPct,
      paperProgressPct: hasProject ? (isDraftProject ? 60 : 100) : 0,
      completedActionsCount: s1Done,
      remainingActionsCount: Math.max(0, s1Total - s1Done),
      responsiblePersonFa: pmName,
      plannedDueDateFa: activeProject?.startDate || todayStr,
      blockersAndStopReasonsFa: s1Blockers,
      requiredEvidenceFa: ['منشور مصوب پروژه استقرار PSM', 'ماتریس تیم استقرار و واحدهای مشمول'],
      nextRecommendedAction: s1NextAction,
      primarySubTab: 'project',
    },
    {
      stageNumber: 2,
      key: 'STAGE_2_ASSESSMENT',
      titleFa: '۲. ارزیابی وضعیت موجود',
      subtitleFa: 'ممیزی خط مبنا بر اساس ۲۰ عنصر CCPS RBPS و ۱۴ الزام OSHA',
      plainDescriptionFa:
        'بررسی وضعیت فعلی هر یک از ۲۰ عنصر ایمنی فرایند در واحدهای مجتمع و ثبت امتیاز انطباق و شواهد موجود.',
      linkedGateKey: 'G1',
      status: s2Status,
      statusLabelFa: SIMPLE_STAGE_STATUS_META[s2Status].labelFa,
      realProgressPct: s2RealPct,
      paperProgressPct: Math.min(100, Math.round((projectData.assessments.length / 20) * 100)),
      completedActionsCount: completedAssessmentsCount,
      remainingActionsCount: remainingAssessmentsCount,
      responsiblePersonFa: pmName,
      plannedDueDateFa: activeProject?.endDate || todayStr,
      blockersAndStopReasonsFa: s2Blockers,
      requiredEvidenceFa: ['کاربرگ‌های ارزیابی اولیه ۲۰ عنصر CCPS', 'مصوبه دروازه کنترلی G1'],
      nextRecommendedAction: s2NextAction,
      primarySubTab: 'assessment',
    },
    {
      stageNumber: 3,
      key: 'STAGE_3_GAPS',
      titleFa: '۳. شناسایی نواقص و تعیین اولویت‌ها',
      subtitleFa: 'تحلیل شکاف (Gap Analysis)، تعیین سطح ریسک، مسئول و مهلت رفع هر نقص',
      plainDescriptionFa:
        'تبدیل عدم‌انطباق‌های مرحله ارزیابی به فهرست شکاف‌های مشخص با تعیین مسئول مستقیم، مهلت و اولویت ریسک.',
      linkedGateKey: 'G2',
      status: s3Status,
      statusLabelFa: SIMPLE_STAGE_STATUS_META[s3Status].labelFa,
      realProgressPct: s3RealPct,
      paperProgressPct: totalGaps > 0 ? 100 : 0,
      completedActionsCount: s3CompletedCount,
      remainingActionsCount: s3RemainingCount,
      responsiblePersonFa: pmName,
      plannedDueDateFa: activeProject?.endDate || todayStr,
      blockersAndStopReasonsFa: s3Blockers,
      requiredEvidenceFa: ['گزارش تحلیل شکاف (Gap Register)', 'مصوبه دروازه کنترلی G2'],
      nextRecommendedAction: s3NextAction,
      primarySubTab: 'gap-analysis',
    },
    {
      stageNumber: 4,
      key: 'STAGE_4_PLANNING',
      titleFa: '۴. تدوین برنامه اجرایی',
      subtitleFa: 'ساختار شکست کار (WBS)، نمودار گانت، تخصیص منابع و بودجه',
      plainDescriptionFa:
        'تبدیل شکاف‌های شناسایی‌شده به بسته‌های کاری زمان‌بندی‌شده در WBS با مشخص بودن مجری، پیش‌نیازها و بودجه.',
      linkedGateKey: 'G3',
      status: s4Status,
      statusLabelFa: SIMPLE_STAGE_STATUS_META[s4Status].labelFa,
      realProgressPct: s4RealPct,
      paperProgressPct: totalWbs > 0 ? 100 : 0,
      completedActionsCount: completedWbsCount,
      remainingActionsCount: remainingWbsCount || unmappedCriticalGaps.length,
      responsiblePersonFa: pmName,
      plannedDueDateFa: activeProject?.endDate || todayStr,
      blockersAndStopReasonsFa: s4Blockers,
      requiredEvidenceFa: ['برنامه زمان‌بندی WBS و مسیر بحرانی', 'مصوبه دروازه کنترلی G3'],
      nextRecommendedAction: s4NextAction,
      primarySubTab: 'wbs-gantt',
    },
    {
      stageNumber: 5,
      key: 'STAGE_5_DOCUMENTS',
      titleFa: '۵. تکمیل مدارک و اجرای اقدامات',
      subtitleFa: 'بانک اسناد فنی (PSI/SOP/MOC/MI/PSSR) و مطالعات تخصصی (PHA/HAZOP)',
      plainDescriptionFa:
        'تدوین، بارگذاری شواهد اجرایی و تصویب مدارک فنی و اجرای مطالعات تخصصی ایمنی فرایند در واحدهای عملیاتی.',
      linkedGateKey: 'G4',
      status: s5Status,
      statusLabelFa: SIMPLE_STAGE_STATUS_META[s5Status].labelFa,
      realProgressPct: s5RealPct,
      paperProgressPct: totalDocs > 0 ? Math.min(100, totalDocs * 25) : 0,
      completedActionsCount: approvedDocsCount + totalStudies,
      remainingActionsCount: pendingDocs.length + (totalDocs === 0 ? 4 : 0),
      responsiblePersonFa: pmName,
      plannedDueDateFa: activeProject?.endDate || todayStr,
      blockersAndStopReasonsFa: s5Blockers,
      requiredEvidenceFa: ['مدارک مصوب دارای شواهد اجرایی در بانک اسناد', 'گزارش مطالعات PHA/HAZOP و مصوبه G4'],
      nextRecommendedAction: s5NextAction,
      primarySubTab: 'documents',
    },
    {
      stageNumber: 6,
      key: 'STAGE_6_MONITORING_CAPA',
      titleFa: '۶. پایش پیشرفت و رفع نواقص',
      subtitleFa: 'گردش کار ۸ مرحله‌ای اقدامات اصلاحی (CAPA) و پایش انحرافات زمانی',
      plainDescriptionFa:
        'اجرای اقدامات اصلاحی و پیشگیرانه در واحدها، ثبت شواهد رفع نقص و صحه‌گذاری اثربخشی توسط بازبین مستقل.',
      linkedGateKey: 'G5',
      status: s6Status,
      statusLabelFa: SIMPLE_STAGE_STATUS_META[s6Status].labelFa,
      realProgressPct: s6RealPct,
      paperProgressPct: totalCapa > 0 ? 80 : 0,
      completedActionsCount: closedCapaCount,
      remainingActionsCount: openCapaItems.length,
      responsiblePersonFa: pmName,
      plannedDueDateFa: activeProject?.endDate || todayStr,
      blockersAndStopReasonsFa: s6Blockers,
      requiredEvidenceFa: ['پرونده‌های CAPA بسته‌شده با صحه‌گذاری مستقل', 'مصوبه دروازه کنترلی G5'],
      nextRecommendedAction: s6NextAction,
      primarySubTab: 'capa',
    },
    {
      stageNumber: 7,
      key: 'STAGE_7_EFFECTIVENESS_HANDOVER',
      titleFa: '۷. ارزیابی اثربخشی و تأیید نهایی',
      subtitleFa: 'ممیزی مدل بلوغ ۵ سطحی، تأیید نهایی مدیریت و تحویل سیستم فعال PSM',
      plainDescriptionFa:
        'سنجش سطح بلوغ واقعی استقرار در ۴ رکن CCPS، تأیید اثربخشی کنترل‌ها و تحویل رسمی سیستم به بهره‌برداری.',
      linkedGateKey: 'G6',
      status: s7Status,
      statusLabelFa: SIMPLE_STAGE_STATUS_META[s7Status].labelFa,
      realProgressPct: s7RealPct,
      paperProgressPct: latestMaturity ? 85 : 0,
      completedActionsCount: s7Done,
      remainingActionsCount: Math.max(0, s7Checks.length - s7Done),
      responsiblePersonFa: sponsorName,
      plannedDueDateFa: activeProject?.endDate || todayStr,
      blockersAndStopReasonsFa: s7Blockers,
      requiredEvidenceFa: ['گزارش ارزیابی بلوغ ۵ سطحی (حداقل سطح ۳)', 'صورتجلسه و گواهی تحویل نهایی (Gate 6)'],
      nextRecommendedAction: s7NextAction,
      primarySubTab: 'handover',
    },
  ];
}

/**
 * موتور پیشنهاد اقدام بعدی (Next Best Action Engine — اصل اول)
 * اولویت‌بندی پیشنهادها بر اساس پیش‌نیازها، ریسک، فوریت و تأثیر بر مسیر پروژه
 */
export function computeNextBestActions(
  activeProject: any,
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  },
  stageGates: any[] = []
): NextBestActionItem[] {
  const stages = computeSevenStagesRoadmap(activeProject, projectData, stageGates);
  const actions: NextBestActionItem[] = [];

  for (const st of stages) {
    if (st.nextRecommendedAction && st.nextRecommendedAction.prerequisitesMet) {
      actions.push(st.nextRecommendedAction);
    }
  }

  // Also add specific high-value domain actions (e.g., incomplete MOC/MI/PSI docs or overdue CAPA)
  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultUnit =
    (Array.isArray(activeProject?.coveredUnits) &&
      (typeof activeProject.coveredUnits[0] === 'string'
        ? activeProject.coveredUnits[0]
        : activeProject.coveredUnits[0]?.name)) ||
    'واحد پلیمریزاسیون';

  if (activeProject) {
    // Check if MOC or MI documents are missing or incomplete
    const mocDocs = projectData.documents.filter((d) => d.ccpsElementCode === 'CCPS-13');
    const unapprovedMocDocs = mocDocs.filter((d) => d.status !== 'APPROVED');
    if (unapprovedMocDocs.length > 0) {
      actions.push({
        id: 'nba-moc-docs-incomplete',
        stageNumber: 5,
        stageTitleFa: '۵. تکمیل مدارک و اجرای اقدامات',
        titleFa: `${unapprovedMocDocs.length} مدرک از مدارک عنصر مدیریت تغییرات (MOC) هنوز تکمیل و تأیید نشده‌اند`,
        reasonFa: `مدارک عنصر مدیریت تغییرات (${unapprovedMocDocs.map((d) => d.docCode).join('، ')}) در وضعیت «${unapprovedMocDocs[0].status}» قرار دارند و برای عبور از Gate 4 نیازمند تکمیل شواهد و تأیید هستند.`,
        priority: 'HIGH',
        priorityLabelFa: 'الزام کلیدی MOC',
        responsiblePersonFa: unapprovedMocDocs[0].authorName || activeProject.projectManagerName || 'مسئول MOC',
        unitNameFa: unapprovedMocDocs[0].unitName || defaultUnit,
        dueDateFa: unapprovedMocDocs[0].validityExpiryDate || todayStr,
        requiredDocumentsFa: unapprovedMocDocs.map((d) => d.title),
        prerequisitesMet: true,
        prerequisitesSummaryFa: 'پیش‌نویس مدرک در بانک اسناد موجود است',
        impactOnProjectFa: 'تکمیل انطباق عنصر CCPS-13 (مدیریت تغییر) و رفع مانع دروازه G4',
        targetAudience: 'EXPERT',
        deepLink: {
          targetSubTab: 'documents',
          actionType: 'REVISE_DOCUMENT',
          buttonLabelFa: 'مشاهده و تکمیل مدارک MOC',
          contextTitleFa: 'تکمیل شواهد مدارک مدیریت تغییرات (MOC)',
          contextHintFa: 'شواهد اجرایی مدرک MOC را تکمیل و برای تأیید نهایی ارسال کنید.',
          prefillData: {
            recordId: unapprovedMocDocs[0].id,
            elementCode: 'CCPS-13',
            unitName: unapprovedMocDocs[0].unitName || defaultUnit,
          },
        },
      });
    }
  }

  // Sort by priority (CRITICAL -> HIGH -> MEDIUM -> NORMAL) and stageNumber
  const priorityOrder: Record<NextBestActionItem['priority'], number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    NORMAL: 4,
  };

  return actions.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.stageNumber - b.stageNumber;
  });
}

/**
 * موتور تشخیص توقف پروژه و تصمیم‌های مدیریتی موردنیاز (اصل سوم)
 */
export function computeProjectStoppageDiagnosis(
  activeProject: any,
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  },
  stageGates: any[] = []
): ProjectStoppageDiagnosis {
  if (!activeProject) {
    return {
      isProjectStopped: true,
      overallHealthStatus: 'STOPPED',
      overallHealthTitleFa: 'پروژه هنوز تعریف و آغاز نشده است',
      stoppedAtStageTitleFa: 'مرحله ۱: تعریف پروژه و تشکیل تیم',
      stoppedAtGateKey: 'G1',
      stopDurationDays: 0,
      stopReasonsFa: ['منشور اولیه پروژه استقرار PSM هنوز در پایگاه داده ثبت نشده است.'],
      criticalBlockers: [
        {
          id: 'blk-no-project',
          titleFa: 'عدم تعریف منشور پروژه استقرار PSM',
          causeFa: 'برای آغاز چرخه استقرار، ابتدا باید پروژه، مدیر پروژه، حامی و واحدهای مشمول تعریف شوند.',
          responsiblePersonFa: 'مدیر HSE / مدیر پروژه',
          unitNameFa: 'کل مجتمع پتروشیمی رجال',
          stoppedDays: 1,
          requiredDecisionFa: 'تعریف و تصویب منشور اولیه پروژه استقرار PSM',
          deepLink: {
            targetSubTab: 'project',
            actionType: 'OPEN_CREATE_PROJECT',
            buttonLabelFa: 'تعریف پروژه استقرار PSM',
            contextTitleFa: 'تعریف پروژه جدید استقرار PSM',
            contextHintFa: 'گام‌های ۸گانه تعریف پروژه را تکمیل و ثبت نمایید.',
          },
        },
      ],
      pendingManagerDecisions: [],
    };
  }

  const todayMs = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const pmName = activeProject.projectManagerName || 'مدیر پروژه PSM';
  const sponsorName = activeProject.sponsorName || activeProject.projectSponsorName || 'حامی ارشد پروژه';

  const criticalBlockers: ProjectStoppageDiagnosis['criticalBlockers'] = [];
  const pendingManagerDecisions: ProjectStoppageDiagnosis['pendingManagerDecisions'] = [];
  const stopReasonsFa: string[] = [];

  // 1. Check unassigned or unmapped Gaps
  const unassignedGaps = projectData.gaps.filter(
    (g) => !g.responsiblePersonName || !g.proposedDueDate
  );
  if (unassignedGaps.length > 0) {
    const reason = `${unassignedGaps.length} فعالیت/شکاف شناسایی‌شده فاقد مسئول یا مهلت انجام هستند.`;
    stopReasonsFa.push(reason);
    criticalBlockers.push({
      id: 'blk-unassigned-gaps',
      titleFa: `${unassignedGaps.length} شکاف فاقد مسئول یا مهلت مشخص`,
      causeFa: reason,
      responsiblePersonFa: pmName,
      unitNameFa: unassignedGaps[0]?.unitName || 'کل مجتمع',
      stoppedDays: 3,
      requiredDecisionFa: 'تعیین مسئول مستقیم و مهلت الزامی برای شکاف‌های باز',
      deepLink: {
        targetSubTab: 'gap-analysis',
        actionType: 'OPEN_GAP_FORM',
        buttonLabelFa: 'تعیین مسئول و مهلت نواقص',
        contextTitleFa: 'تعیین مسئول و مهلت شکاف‌های فاقد مالک',
        contextHintFa: 'برای هر شکاف شناسایی‌شده، مسئول مستقیم و مهلت انجام تعیین کنید.',
      },
    });
  }

  // 2. Check critical open Gaps not converted to WBS/CAPA
  const unmappedCritGaps = projectData.gaps.filter(
    (g) => g.riskLevel === 'CRITICAL' && g.status === 'OPEN' && !g.linkedWbsId && !g.linkedCapaId
  );
  if (unmappedCritGaps.length > 0) {
    const reason = `${unmappedCritGaps.length} نقص بحرانی هنوز به فعالیت اجرایی در برنامه WBS یا اقدام اصلاحی CAPA تبدیل نشده‌اند.`;
    stopReasonsFa.push(reason);
    criticalBlockers.push({
      id: 'blk-unmapped-crit-gaps',
      titleFa: `${unmappedCritGaps.length} نقص بحرانی بدون برنامه اجرایی (WBS/CAPA)`,
      causeFa: reason,
      responsiblePersonFa: unmappedCritGaps[0]?.responsiblePersonName || pmName,
      unitNameFa: unmappedCritGaps[0]?.unitName || 'واحد عملیاتی',
      stoppedDays: 4,
      requiredDecisionFa: 'تبدیل فوری شکاف‌های بحرانی به بسته کاری WBS و پرونده CAPA',
      deepLink: {
        targetSubTab: 'gap-analysis',
        actionType: 'CONVERT_GAP_TO_PLAN',
        buttonLabelFa: 'تبدیل نواقص بحرانی به برنامه اجرایی',
        contextTitleFa: 'تبدیل شکاف‌های بحرانی به فعالیت WBS و CAPA',
        contextHintFa: 'روی دکمه «تبدیل به WBS + CAPA» در ردیف شکاف‌های بحرانی کلیک کنید.',
        prefillData: {
          recordId: unmappedCritGaps[0]?.id,
        },
      },
    });
  }

  // 3. Check overdue WBS activities
  const overdueWbs = projectData.wbsTasks.filter(
    (t) =>
      (Number(t.delayDays || 0) > 0 || (t.plannedEnd && String(t.plannedEnd) < todayStr)) &&
      Number(t.actualProgress || 0) < 100
  );
  if (overdueWbs.length > 0) {
    const maxDelay = Math.max(
      1,
      ...overdueWbs.map((t) => {
        if (t.delayDays) return Number(t.delayDays);
        const endMs = new Date(t.plannedEnd).getTime();
        return isNaN(endMs) ? 2 : Math.max(1, Math.ceil((todayMs - endMs) / 86400000));
      })
    );
    const reason = `${overdueWbs.length} فعالیت در برنامه اجرایی (WBS) از موعد برنامه‌ریزی‌شده عقب افتاده‌اند (حداکثر تأخیر: ${maxDelay} روز).`;
    stopReasonsFa.push(reason);
    criticalBlockers.push({
      id: 'blk-overdue-wbs',
      titleFa: `${overdueWbs.length} فعالیت اجرایی معوق در برنامه WBS`,
      causeFa: `فعالیت «${overdueWbs[0].title || overdueWbs[0].taskTitle}» و ${Math.max(0, overdueWbs.length - 1)} فعالیت دیگر دارای تأخیر زمانی هستند.`,
      responsiblePersonFa: overdueWbs[0].ownerName || overdueWbs[0].executorName || pmName,
      unitNameFa: overdueWbs[0].unitName || 'کل مجتمع',
      stoppedDays: maxDelay,
      requiredDecisionFa: 'بررسی علل تأخیر، تخصیص منابع کمکی یا بازنگری برنامه اجرایی',
      deepLink: {
        targetSubTab: 'wbs-gantt',
        actionType: 'UPDATE_WBS_PROGRESS',
        buttonLabelFa: 'بررسی فعالیت‌های معوق در WBS',
        contextTitleFa: 'رسیدگی به فعالیت‌های معوق برنامه اجرایی',
        contextHintFa: 'وضعیت پیشرفت واقعی و موانع فعالیت‌های دارای تأخیر را بررسی کنید.',
        prefillData: {
          recordId: overdueWbs[0].id,
        },
      },
    });
  }

  // 4. Check incomplete / unapproved documents
  const unapprovedDocs = projectData.documents.filter((d) => d.status !== 'APPROVED');
  if (unapprovedDocs.length > 0) {
    const reason = `${unapprovedDocs.length} مدرک فنی در بانک مدارک PSM هنوز تأیید نهایی نشده یا فاقد شواهد کافی است.`;
    stopReasonsFa.push(reason);
    pendingManagerDecisions.push({
      id: 'dec-approve-docs',
      gateOrModuleKey: 'DOCUMENTS / G4',
      decisionTitleFa: `بررسی و تعیین تکلیف ${unapprovedDocs.length} مدرک فنی در انتظار تأیید`,
      whyNeededFa: `مدارکی نظیر «${unapprovedDocs[0].title}» (${unapprovedDocs[0].docCode}) تا زمان تأیید نهایی مانع از عبور از دروازه کنترلی G4 هستند.`,
      responsibleApproverFa: unapprovedDocs[0].approverName || sponsorName,
      waitingDays: 2,
      evidenceReady: Boolean(
        (unapprovedDocs[0].evidenceSummary && String(unapprovedDocs[0].evidenceSummary).length >= 10) ||
          unapprovedDocs[0].fileId ||
          unapprovedDocs[0].fileUrl
      ),
      blockingCriteriaFa: unapprovedDocs.slice(0, 3).map((d) => `${d.docCode}: ${d.title} (${d.status})`),
      deepLink: {
        targetSubTab: 'documents',
        actionType: 'APPROVE_DOCUMENT',
        buttonLabelFa: 'بررسی و تأیید مدارک',
        contextTitleFa: 'تصمیم‌گیری و تأیید مدارک فنی PSM',
        contextHintFa: 'شواهد پیوست‌شده مدارک را بررسی و در صورت کفایت، تأیید نهایی نمایید.',
        prefillData: {
          recordId: unapprovedDocs[0].id,
        },
      },
    });
  }

  // 5. Check Stage Gates (G1-G6) status & blockers
  const activeGate =
    stageGates.find((g) => g.status !== 'APPROVED') || stageGates[stageGates.length - 1] || null;

  if (activeGate) {
    const gateBlockers: string[] = Array.isArray(activeGate.evaluation?.blockingIssues)
      ? activeGate.evaluation.blockingIssues
      : Array.isArray(activeGate.blockingIssues)
      ? activeGate.blockingIssues
      : [];

    const canPassGate = Boolean(activeGate.evaluation?.canPass ?? gateBlockers.length === 0);

    if (!canPassGate && gateBlockers.length > 0) {
      gateBlockers.forEach((b) => {
        if (!stopReasonsFa.includes(b)) stopReasonsFa.push(b);
      });
    }

    pendingManagerDecisions.push({
      id: `dec-gate-${activeGate.gateKey}`,
      gateOrModuleKey: activeGate.gateKey,
      decisionTitleFa: canPassGate
        ? `تصویب رسمی دروازه کنترلی ${activeGate.gateKey} (${activeGate.titleFa})`
        : `تعیین تکلیف موانع توقف دروازه ${activeGate.gateKey} (${activeGate.titleFa})`,
      whyNeededFa: canPassGate
        ? `کلیه معیارهای الزامی دروازه ${activeGate.gateKey} تکمیل شده‌اند و پروژه برای ورود به مرحله بعد منتظر امضای مقام تصویب‌کننده است.`
        : `پروژه در دروازه ${activeGate.gateKey} به دلیل ${gateBlockers.length} مانع کنترلی متوقف شده است.`,
      responsibleApproverFa: activeGate.approverName || sponsorName,
      waitingDays: 3,
      evidenceReady: canPassGate,
      blockingCriteriaFa:
        gateBlockers.length > 0
          ? gateBlockers
          : ['تمامی معیارهای الزامی احراز شده‌اند — آماده تصویب مدیریت'],
      deepLink: {
        targetSubTab: 'stage-gates',
        actionType: 'OPEN_GATE_DECISION',
        buttonLabelFa: canPassGate
          ? `بررسی و تصویب ${activeGate.gateKey}`
          : `مشاهده موانع و تصمیم‌گیری ${activeGate.gateKey}`,
        contextTitleFa: `مدیریت دروازه کنترلی ${activeGate.gateKey}: ${activeGate.titleFa}`,
        contextHintFa: canPassGate
          ? 'معیارها تکمیل است؛ می‌توانید مصوبه عبور از دروازه را ثبت کنید.'
          : 'موانع اعلام‌شده توسط موتور حاکمیت را بررسی و تعیین تکلیف نمایید.',
        prefillData: {
          gateKey: activeGate.gateKey,
        },
      },
    });
  }

  const maxStopDays =
    criticalBlockers.length > 0
      ? Math.max(...criticalBlockers.map((b) => b.stoppedDays))
      : pendingManagerDecisions.length > 0
      ? Math.max(...pendingManagerDecisions.map((d) => d.waitingDays))
      : 0;

  const isProjectStopped = criticalBlockers.length > 0 || (activeGate && activeGate.status === 'REJECTED');

  let overallHealthStatus: ProjectStoppageDiagnosis['overallHealthStatus'] = 'ON_TRACK';
  let overallHealthTitleFa = 'پروژه بدون مانع بحرانی در مسیر برنامه در جریان است';

  if (activeProject.overallStatus === 'COMPLETED' || activeProject.overallStatus === 'ACTIVE_SYSTEM') {
    overallHealthStatus = 'COMPLETED';
    overallHealthTitleFa = 'پروژه استقرار PSM با موفقیت تکمیل و تحویل نهایی شده است';
  } else if (isProjectStopped) {
    overallHealthStatus = 'STOPPED';
    overallHealthTitleFa = `پروژه در مرحله «${activeGate?.titleFa || 'جاری'}» متوقف شده و نیازمند رفع موانع و تصمیم مدیریت است`;
  } else if (pendingManagerDecisions.some((d) => d.evidenceReady)) {
    overallHealthStatus = 'AWAITING_DECISION';
    overallHealthTitleFa = `پروژه آماده عبور از دروازه ${activeGate?.gateKey || ''} بوده و در انتظار تصویب مدیریت است`;
  } else if (stopReasonsFa.length > 0) {
    overallHealthStatus = 'AT_RISK';
    overallHealthTitleFa = 'پروژه در جریان است اما دارای هشدارهایی است که نیازمند پیگیری هستند';
  }

  return {
    isProjectStopped,
    overallHealthStatus,
    overallHealthTitleFa,
    stoppedAtStageTitleFa: activeGate?.titleFa || null,
    stoppedAtGateKey: activeGate?.gateKey || null,
    stopDurationDays: maxStopDays,
    stopReasonsFa,
    criticalBlockers,
    pendingManagerDecisions,
  };
}

/**
 * تجمیع‌کننده هوشمند کارتابل واحد کاربران «کارهای من» در ۸ دسته‌بندی استاندارد (بند ۶)
 */
export function computeUnifiedActionCenterItems(
  currentUser: { fullName?: string; username?: string; role?: string } | null,
  activeProject: any,
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  },
  stageGates: any[] = []
): UnifiedActionCardItem[] {
  if (!activeProject) return [];

  const items: UnifiedActionCardItem[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const projectNameFa = `${activeProject.code} — ${activeProject.name}`;
  const currentUserName = String(currentUser?.fullName || currentUser?.username || '').trim();
  const pmName = activeProject.projectManagerName || 'مدیر پروژه PSM';

  const checkIsMine = (responsibleStr?: string | null) => {
    if (!currentUserName) return true;
    const clean = String(responsibleStr || '').trim();
    if (!clean) return true;
    return (
      clean.includes(currentUserName) ||
      (currentUser?.username ? clean.includes(currentUser.username) : false)
    );
  };

  // 1. Missing Baseline Assessments -> NEW_TASKS
  const assessedCodes = new Set(projectData.assessments.map((a) => a.elementCode));
  const missingCcps = CCPS_20_ELEMENTS.filter((el) => !assessedCodes.has(el.code));
  missingCcps.slice(0, 4).forEach((el) => {
    items.push({
      id: `task-assess-${el.code}`,
      recordCode: el.code,
      category: 'NEW_TASKS',
      categoryLabelFa: 'وظایف جدید',
      titleFa: `ارزیابی اولیه وضعیت موجود عنصر «${el.titleFa}»`,
      plainExplanationFa: `بررسی میزان انطباق فعلی واحد با الزامات ${el.code} و ثبت نقاط قوت، نواقص و مدارک موجود.`,
      projectNameFa,
      unitNameFa: 'کل مجتمع پتروشیمی رجال',
      priority: el.defaultRiskWeight >= 5 ? 'HIGH' : 'MEDIUM',
      priorityLabelFa: el.defaultRiskWeight >= 5 ? 'اولویت بالا' : 'متوسط',
      responsiblePersonFa: pmName,
      dueDateFa: activeProject.endDate || todayStr,
      isOverdue: false,
      delayDays: 0,
      statusLabelFa: 'آماده شروع ارزیابی',
      requiredEvidenceFa: el.requiredDocTemplates.join('، '),
      sourceDataBadgeFa: `استاندارد مرجع: ${el.nationalAndRejalRef}`,
      isAssignedToCurrentUser: checkIsMine(pmName),
      deepLink: {
        targetSubTab: 'assessment',
        actionType: 'OPEN_ASSESSMENT_FORM',
        buttonLabelFa: 'شروع انجام کار (فرم ارزیابی)',
        contextTitleFa: `ارزیابی عنصر ${el.code}: ${el.titleFa}`,
        contextHintFa: el.defaultCriteriaFa,
        prefillData: {
          standardType: 'CCPS_RBPS',
          elementCode: el.code,
          unitName: 'کل مجتمع',
          responsiblePersonName: pmName,
          requiredEvidence: el.requiredDocTemplates.join('، '),
        },
        returnToTab: 'my-workspace',
      },
    });
  });

  // 2. Open Gaps -> NEW_TASKS / OVERDUE / DUE_SOON
  projectData.gaps.forEach((gap) => {
    if (gap.status === 'CLOSED' || gap.isOutOfScope) return;
    const due = String(gap.proposedDueDate || '');
    const isOverdue = Boolean(due && due < todayStr);
    const isDueSoon = Boolean(!isOverdue && due && due <= sevenDaysStr);
    const isUnconverted = !gap.linkedWbsId && !gap.linkedCapaId;

    let category: UnifiedTaskCategoryKey = 'NEW_TASKS';
    let categoryLabelFa = 'وظایف جدید';
    if (isOverdue) {
      category = 'OVERDUE';
      categoryLabelFa = 'وظایف معوق';
    } else if (isDueSoon) {
      category = 'DUE_SOON';
      categoryLabelFa = 'وظایف نزدیک به سررسید';
    } else if (!isUnconverted) {
      category = 'IN_PROGRESS';
      categoryLabelFa = 'وظایف در حال انجام';
    }

    const delayDays = isOverdue
      ? Math.max(1, Math.ceil((Date.now() - new Date(due).getTime()) / 86400000))
      : 0;

    items.push({
      id: `task-gap-${gap.id}`,
      recordCode: gap.gapCode || `GAP-${gap.id}`,
      category,
      categoryLabelFa,
      titleFa: isUnconverted
        ? `تبدیل شکاف «${gap.title}» به فعالیت اجرایی و اقدام اصلاحی`
        : `پیگیری رفع شکاف «${gap.title}»`,
      plainExplanationFa:
        gap.description ||
        'نقص شناسایی‌شده در تحلیل شکاف که باید به برنامه اجرایی WBS و پرونده CAPA متصل و برطرف شود.',
      projectNameFa,
      unitNameFa: gap.unitName || 'کل مجتمع',
      priority:
        gap.riskLevel === 'CRITICAL'
          ? 'CRITICAL'
          : gap.riskLevel === 'HIGH'
          ? 'HIGH'
          : 'MEDIUM',
      priorityLabelFa:
        gap.riskLevel === 'CRITICAL'
          ? 'بحرانی'
          : gap.riskLevel === 'HIGH'
          ? 'ریسک بالا'
          : 'متوسط',
      responsiblePersonFa: gap.responsiblePersonName || 'تعیین نشده (نیازمند تخصیص)',
      dueDateFa: due || 'تعیین نشده',
      isOverdue,
      delayDays,
      statusLabelFa: isOverdue
        ? `معوق (${delayDays} روز تأخیر)`
        : isUnconverted
        ? 'نیازمند تبدیل به برنامه اجرایی'
        : 'در جریان در WBS/CAPA',
      requiredEvidenceFa: gap.requiredDocument || 'مستندات رفع شکاف و شواهد انطباق',
      sourceDataBadgeFa: `عنصر مرتبط: ${gap.ccpsElementCode || 'PSM'}`,
      isAssignedToCurrentUser: checkIsMine(gap.responsiblePersonName),
      deepLink: {
        targetSubTab: 'gap-analysis',
        actionType: isOverdue ? 'EXTEND_GAP_DEADLINE' : 'CONVERT_GAP_TO_PLAN',
        buttonLabelFa: isOverdue
          ? 'تعیین تکلیف / تمدید مستند'
          : isUnconverted
          ? 'شروع انجام کار (تبدیل به WBS/CAPA)'
          : 'مشاهده و پیگیری شکاف',
        contextTitleFa: `رسیدگی به شکاف ${gap.gapCode || gap.id}`,
        contextHintFa: isUnconverted
          ? 'این شکاف را با یک کلیک به بسته کاری WBS و اقدام اصلاحی CAPA تبدیل کنید.'
          : 'وضعیت رفع شکاف را بررسی و به‌روزرسانی نمایید.',
        prefillData: {
          recordId: gap.id,
          unitName: gap.unitName,
          elementCode: gap.ccpsElementCode,
          responsiblePersonName: gap.responsiblePersonName,
          dueDate: gap.proposedDueDate,
          title: gap.title,
        },
        returnToTab: 'my-workspace',
      },
    });
  });

  // 3. WBS Tasks -> IN_PROGRESS / DUE_SOON / OVERDUE
  projectData.wbsTasks.forEach((task) => {
    const progress = Number(task.actualProgress || 0);
    if (progress >= 100 || task.status === 'COMPLETED') return;

    const due = String(task.plannedEnd || task.dueDate || '');
    const isOverdue = Boolean((task.delayDays && Number(task.delayDays) > 0) || (due && due < todayStr));
    const isDueSoon = Boolean(!isOverdue && due && due <= sevenDaysStr);

    let category: UnifiedTaskCategoryKey = progress > 0 ? 'IN_PROGRESS' : 'NEW_TASKS';
    let categoryLabelFa = progress > 0 ? 'وظایف در حال انجام' : 'وظایف جدید';
    if (isOverdue) {
      category = 'OVERDUE';
      categoryLabelFa = 'وظایف معوق';
    } else if (isDueSoon) {
      category = 'DUE_SOON';
      categoryLabelFa = 'وظایف نزدیک به سررسید';
    }

    const delayDays = isOverdue
      ? Number(task.delayDays) || Math.max(1, Math.ceil((Date.now() - new Date(due).getTime()) / 86400000))
      : 0;

    items.push({
      id: `task-wbs-${task.id}`,
      recordCode: task.wbsCode || `WBS-${task.id}`,
      category,
      categoryLabelFa,
      titleFa: task.title || task.taskTitle,
      plainExplanationFa: `بسته کاری اجرایی در واحد ${task.unitName || 'مجتمع'} (پیشرفت فعلی: ${progress}٪ در برابر برنامه: ${task.plannedProgress || 0}٪).`,
      projectNameFa,
      unitNameFa: task.unitName || 'کل مجتمع',
      priority: task.isCritical ? 'CRITICAL' : 'HIGH',
      priorityLabelFa: task.isCritical ? 'مسیر بحرانی' : 'اجرایی',
      responsiblePersonFa: task.executorName || task.ownerName || pmName,
      dueDateFa: due || '—',
      isOverdue,
      delayDays,
      statusLabelFa: isOverdue ? `دارای تأخیر (${delayDays} روز)` : `در حال انجام (${progress}٪)`,
      requiredEvidenceFa: task.resources || 'گزارش پیشرفت و مستندات تحویلی بسته کاری',
      sourceDataBadgeFa: `عنصر: ${task.elementCode || 'WBS'}`,
      isAssignedToCurrentUser: checkIsMine(task.executorName || task.ownerName),
      deepLink: {
        targetSubTab: 'wbs-gantt',
        actionType: 'UPDATE_WBS_PROGRESS',
        buttonLabelFa: 'شروع انجام کار (ثبت پیشرفت WBS)',
        contextTitleFa: `به‌روزرسانی بسته کاری ${task.wbsCode}`,
        contextHintFa: 'درصد پیشرفت واقعی و هزینه‌کرد بسته کاری را در جدول WBS ثبت کنید.',
        prefillData: {
          recordId: task.id,
          unitName: task.unitName,
          elementCode: task.elementCode,
          responsiblePersonName: task.executorName || task.ownerName,
          title: task.title || task.taskTitle,
        },
        returnToTab: 'my-workspace',
      },
    });
  });

  // 4. Documents -> DOCS_NEEDING_COMPLETION / SUBMITTED_FOR_APPROVAL / RETURNED_FOR_REWORK
  projectData.documents.forEach((doc) => {
    if (doc.status === 'APPROVED') return;

    const hasEvidence =
      (doc.evidenceSummary && String(doc.evidenceSummary).trim().length >= 10) ||
      Boolean(doc.fileId || doc.fileUrl);

    let category: UnifiedTaskCategoryKey = 'DOCS_NEEDING_COMPLETION';
    let categoryLabelFa = 'مدارک نیازمند تکمیل';

    if (doc.status === 'REJECTED' || doc.status === 'EXPIRED') {
      category = 'RETURNED_FOR_REWORK';
      categoryLabelFa = 'موارد برگشت‌خورده';
    } else if (doc.status === 'UNDER_REVIEW' && hasEvidence) {
      category = 'SUBMITTED_FOR_APPROVAL';
      categoryLabelFa = 'موارد ارسال‌شده برای تأیید';
    }

    items.push({
      id: `task-doc-${doc.id}`,
      recordCode: doc.docCode || `DOC-${doc.id}`,
      category,
      categoryLabelFa,
      titleFa:
        category === 'DOCS_NEEDING_COMPLETION'
          ? `تکمیل مستندات و شواهد فنی «${doc.title}»`
          : category === 'RETURNED_FOR_REWORK'
          ? `اصلاح و بازنگری مدرک برگشت‌خورده «${doc.title}»`
          : `بررسی و تأیید نهایی مدرک «${doc.title}»`,
      plainExplanationFa: hasEvidence
        ? `شواهد اجرایی ثبت شده است (${doc.evidenceSummary?.slice(0, 80) || doc.fileName}) و آماده بررسی و تأیید نهایی است.`
        : 'این مدرک هنوز فاقد خلاصه شواهد اجرایی یا فایل پیوست معتبر است و باید تکمیل شود.',
      projectNameFa,
      unitNameFa: doc.unitName || 'کل مجتمع',
      priority: 'HIGH',
      priorityLabelFa: 'مدرک کلیدی PSM',
      responsiblePersonFa:
        category === 'SUBMITTED_FOR_APPROVAL'
          ? doc.approverName || doc.reviewerName || pmName
          : doc.authorName || pmName,
      dueDateFa: doc.validityExpiryDate || doc.issueDate || todayStr,
      isOverdue: false,
      delayDays: 0,
      statusLabelFa:
        doc.status === 'DRAFT'
          ? 'پیش‌نویس (نیازمند شواهد)'
          : doc.status === 'UNDER_REVIEW'
          ? 'در انتظار تأیید'
          : doc.status,
      requiredEvidenceFa: 'خلاصه شواهد اجرایی مستند یا بارگذاری فایل PDF/Word مصوب',
      sourceDataBadgeFa: `${doc.ccpsElementCode || ''} ${doc.oshaClauseCode ? `| ${doc.oshaClauseCode}` : ''}`,
      isAssignedToCurrentUser: checkIsMine(
        category === 'SUBMITTED_FOR_APPROVAL' ? doc.approverName : doc.authorName
      ),
      deepLink: {
        targetSubTab: 'documents',
        actionType: category === 'SUBMITTED_FOR_APPROVAL' ? 'APPROVE_DOCUMENT' : 'REVISE_DOCUMENT',
        buttonLabelFa:
          category === 'SUBMITTED_FOR_APPROVAL'
            ? 'بررسی و تأیید مدرک'
            : 'شروع انجام کار (تکمیل مدرک)',
        contextTitleFa: `پرونده مدرک ${doc.docCode}: ${doc.title}`,
        contextHintFa:
          category === 'SUBMITTED_FOR_APPROVAL'
            ? 'شواهد مدرک را بررسی و دکمه تأیید نهایی را کلیک کنید.'
            : 'مودال ویرایش مدرک به‌صورت خودکار باز شده است؛ شواهد اجرایی را وارد و ذخیره کنید.',
        prefillData: {
          recordId: doc.id,
          elementCode: doc.ccpsElementCode,
          unitName: doc.unitName,
          title: doc.title,
        },
        returnToTab: 'my-workspace',
      },
    });
  });

  // 5. CAPA Items -> IN_PROGRESS / SUBMITTED_FOR_APPROVAL / RETURNED_FOR_REWORK / OVERDUE
  projectData.capaItems.forEach((capa) => {
    const stage = capa.stage || capa.currentStage || 'REGISTERED';
    if (stage === 'CLOSED') return;

    const due = String(capa.dueDate || '');
    const isOverdue = Boolean(due && due < todayStr);
    const isDueSoon = Boolean(!isOverdue && due && due <= sevenDaysStr);

    let category: UnifiedTaskCategoryKey = 'IN_PROGRESS';
    let categoryLabelFa = 'وظایف در حال انجام';

    if (isOverdue) {
      category = 'OVERDUE';
      categoryLabelFa = 'وظایف معوق';
    } else if (stage === 'EVIDENCE_SUBMITTED' || stage === 'UNDER_REVIEW') {
      category = 'SUBMITTED_FOR_APPROVAL';
      categoryLabelFa = 'موارد ارسال‌شده برای تأیید';
    } else if (stage === 'REGISTERED' || stage === 'ASSIGNED') {
      category = isDueSoon ? 'DUE_SOON' : 'NEW_TASKS';
      categoryLabelFa = isDueSoon ? 'وظایف نزدیک به سررسید' : 'وظایف جدید';
    }

    const delayDays = isOverdue
      ? Math.max(1, Math.ceil((Date.now() - new Date(due).getTime()) / 86400000))
      : 0;

    items.push({
      id: `task-capa-${capa.id}`,
      recordCode: capa.capaCode || `CAPA-${capa.id}`,
      category,
      categoryLabelFa,
      titleFa: `اقدام اصلاحی: ${capa.title}`,
      plainExplanationFa:
        capa.deficiencyDescription ||
        'پرونده اقدام اصلاحی و پیشگیرانه در گردش کار ۸ مرحله‌ای نیازمند ثبت علت ریشه‌ای، شواهد اجرا و تأیید اثربخشی.',
      projectNameFa,
      unitNameFa: capa.unitName || 'واحد عملیاتی',
      priority:
        capa.riskLevel === 'CRITICAL' || Number(capa.riskSeverity || 0) >= 4
          ? 'CRITICAL'
          : 'HIGH',
      priorityLabelFa:
        capa.riskLevel === 'CRITICAL' ? 'ریسک بحرانی' : 'اولویت بالا',
      responsiblePersonFa:
        stage === 'UNDER_REVIEW'
          ? capa.effectivenessVerifierName || capa.reviewerName || pmName
          : capa.responsiblePersonName || pmName,
      dueDateFa: due || '—',
      isOverdue,
      delayDays,
      statusLabelFa: `مرحله فعلی: ${stage}`,
      requiredEvidenceFa:
        stage === 'UNDER_REVIEW' || stage === 'EVIDENCE_SUBMITTED'
          ? 'گزارش صحه‌گذاری اثربخشی توسط ارزیاب مستقل'
          : 'ثبت علت ریشه‌ای، اقدام اصلاحی انجام‌شده و شواهد میدانی',
      sourceDataBadgeFa: `منبع: ${capa.sourceType || 'GAP'} | ${capa.ccpsElementCode || 'PSM'}`,
      isAssignedToCurrentUser: checkIsMine(capa.responsiblePersonName),
      deepLink: {
        targetSubTab: 'capa',
        actionType: 'TRANSITION_CAPA',
        buttonLabelFa: 'شروع انجام کار (گردش کار CAPA)',
        contextTitleFa: `پرونده اقدام اصلاحی ${capa.capaCode}`,
        contextHintFa: 'فرم تغییر مرحله CAPA با اطلاعات این رکورد باز شده است؛ اقدام خود را ثبت نمایید.',
        prefillData: {
          recordId: capa.id,
          unitName: capa.unitName,
          elementCode: capa.ccpsElementCode,
          responsiblePersonName: capa.responsiblePersonName,
          dueDate: capa.dueDate,
          title: capa.title,
        },
        returnToTab: 'my-workspace',
      },
    });
  });

  // 6. Stage Gates & Management Decisions -> DECISIONS_REQUIRED / RETURNED_FOR_REWORK
  stageGates.forEach((gate) => {
    if (gate.status === 'APPROVED') return;
    if (gate.status === 'REJECTED') {
      items.push({
        id: `task-gate-rejected-${gate.gateKey}`,
        recordCode: gate.gateKey,
        category: 'RETURNED_FOR_REWORK',
        categoryLabelFa: 'موارد برگشت‌خورده',
        titleFa: `رفع نواقص دروازه برگشت‌خورده ${gate.gateKey} (${gate.titleFa})`,
        plainExplanationFa:
          gate.comments ||
          'این دروازه کنترلی توسط مقام تصویب‌کننده جهت رفع نواقص و تکمیل شواهد برگشت داده شده است.',
        projectNameFa,
        unitNameFa: 'کل مجتمع پتروشیمی رجال',
        priority: 'CRITICAL',
        priorityLabelFa: 'برگشت‌خورده از Gate',
        responsiblePersonFa: gate.preparedByName || pmName,
        dueDateFa: todayStr,
        isOverdue: true,
        delayDays: 1,
        statusLabelFa: 'برگشت‌خورده (نیازمند اصلاح)',
        requiredEvidenceFa: (gate.requiredEvidenceList || []).join('، ') || 'رفع موانع اعلام‌شده در صورتجلسه دروازه',
        sourceDataBadgeFa: `حاکمیت Stage-Gate (${gate.gateKey})`,
        isAssignedToCurrentUser: true,
        deepLink: {
          targetSubTab: 'stage-gates',
          actionType: 'OPEN_GATE_EVALUATION',
          buttonLabelFa: 'مشاهده علت برگشت و رفع نقص',
          contextTitleFa: `بازبینی دروازه برگشت‌خورده ${gate.gateKey}`,
          contextHintFa: 'موانع و نظرات مدیر تأییدکننده را مشاهده و پس از رفع، ارزیابی مجدد را بزنید.',
          prefillData: {
            gateKey: gate.gateKey,
          },
          returnToTab: 'my-workspace',
        },
      });
    } else if (gate.status === 'IN_REVIEW' || gate.gateNumber === 1) {
      const blockers: string[] = gate.evaluation?.blockingIssues || gate.blockingIssues || [];
      items.push({
        id: `task-gate-decision-${gate.gateKey}`,
        recordCode: gate.gateKey,
        category: 'DECISIONS_REQUIRED',
        categoryLabelFa: 'تصمیم‌های موردنیاز',
        titleFa: `تصمیم‌گیری مدیریتی برای عبور از دروازه ${gate.gateKey} (${gate.titleFa})`,
        plainExplanationFa:
          blockers.length === 0
            ? 'کلیه معیارهای الزامی این دروازه احراز شده‌اند و آماده تصویب نهایی مدیریت است.'
            : `این دروازه دارای ${blockers.length} مانع کنترلی است که نیازمند بررسی و تصمیم مدیریت می‌باشد.`,
        projectNameFa,
        unitNameFa: 'کل مجتمع پتروشیمی رجال',
        priority: 'CRITICAL',
        priorityLabelFa: 'تصمیم حاکمیتی',
        responsiblePersonFa: gate.approverName || activeProject.sponsorName || 'کمیته راهبری PSM',
        dueDateFa: todayStr,
        isOverdue: false,
        delayDays: 0,
        statusLabelFa: blockers.length === 0 ? 'آماده تصویب رسمی' : `متوقف (${blockers.length} مانع)`,
        requiredEvidenceFa: (gate.requiredEvidenceList || []).join('، ') || 'چک‌لیست و شواهد دروازه کنترلی',
        sourceDataBadgeFa: `دروازه کنترلی ${gate.gateKey}`,
        isAssignedToCurrentUser: true,
        deepLink: {
          targetSubTab: 'stage-gates',
          actionType: 'OPEN_GATE_DECISION',
          buttonLabelFa: 'ورود به پنل تصمیم‌گیری Gate',
          contextTitleFa: `تصمیم‌گیری رسمی دروازه ${gate.gateKey}`,
          contextHintFa: 'معیارها و شواهد را بررسی و تصمیم رسمی (تصویب / رد / تعلیق) را ثبت نمایید.',
          prefillData: {
            gateKey: gate.gateKey,
          },
          returnToTab: 'my-workspace',
        },
      });
    }
  });

  return items;
}

/**
 * تولیدکننده اعلان‌ها و یادآوری‌های هوشمند و بدون تکرار بر اساس وضعیت واقعی پروژه (بند ۱۱)
 */
export function computeSmartPsmNotifications(
  activeProject: any,
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
  },
  stageGates: any[] = []
): PsmSmartNotification[] {
  if (!activeProject) return [];

  const notifications: PsmSmartNotification[] = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const pmName = activeProject.projectManagerName || 'مدیر پروژه PSM';

  // 1. Gate Stopped (توقف Gate)
  const activeGate = stageGates.find((g) => g.status !== 'APPROVED');
  if (activeGate) {
    const blockers: string[] = activeGate.evaluation?.blockingIssues || activeGate.blockingIssues || [];
    if (blockers.length > 0) {
      notifications.push({
        id: `notif-gate-stop-${activeGate.gateKey}`,
        type: 'GATE_STOPPED',
        typeLabelFa: 'توقف Gate',
        severity: 'CRITICAL',
        titleFa: `توقف دروازه کنترلی ${activeGate.gateKey} (${activeGate.titleFa})`,
        messageFa: blockers[0],
        responsibleFa: activeGate.preparedByName || pmName,
        dueDateFa: todayStr,
        deepLink: {
          targetSubTab: 'stage-gates',
          actionType: 'OPEN_GATE_EVALUATION',
          buttonLabelFa: 'مشاهده و رفع مانع دروازه',
          contextTitleFa: `رفع مانع دروازه ${activeGate.gateKey}`,
          contextHintFa: blockers.join(' | '),
          prefillData: { gateKey: activeGate.gateKey },
        },
      });
    } else {
      // Blocker Resolved / Approval Requested
      notifications.push({
        id: `notif-gate-ready-${activeGate.gateKey}`,
        type: 'BLOCKER_RESOLVED',
        typeLabelFa: 'رفع مانع و آماده تأیید',
        severity: 'SUCCESS',
        titleFa: `رفع موانع دروازه ${activeGate.gateKey} — آماده تصویب مدیریت`,
        messageFa: `کلیه معیارهای الزامی ${activeGate.titleFa} تکمیل شده‌اند و آماده ثبت تصمیم نهایی است.`,
        responsibleFa: activeGate.approverName || 'حامی پروژه',
        dueDateFa: todayStr,
        deepLink: {
          targetSubTab: 'stage-gates',
          actionType: 'OPEN_GATE_DECISION',
          buttonLabelFa: 'ثبت تصمیم دروازه',
          contextTitleFa: `تصویب دروازه ${activeGate.gateKey}`,
          contextHintFa: 'کلیه پیش‌نیازها احراز شده‌اند.',
          prefillData: { gateKey: activeGate.gateKey },
        },
      });
    }
  }

  // 2. Overdue Delay (تأخیر)
  const overdueGaps = projectData.gaps.filter(
    (g) => g.status !== 'CLOSED' && !g.isOutOfScope && g.proposedDueDate && String(g.proposedDueDate) < todayStr
  );
  if (overdueGaps.length > 0) {
    notifications.push({
      id: 'notif-overdue-gaps',
      type: 'OVERDUE_DELAY',
      typeLabelFa: 'تأخیر سررسید',
      severity: 'CRITICAL',
      titleFa: `${overdueGaps.length} شکاف انطباق از مهلت مقرر عبور کرده‌اند`,
      messageFa: `شکاف «${overdueGaps[0].title}» (${overdueGaps[0].gapCode}) نیازمند اقدام فوری یا تمدید مستند با توجیه فنی است.`,
      responsibleFa: overdueGaps[0].responsiblePersonName || pmName,
      dueDateFa: overdueGaps[0].proposedDueDate,
      deepLink: {
        targetSubTab: 'gap-analysis',
        actionType: 'EXTEND_GAP_DEADLINE',
        buttonLabelFa: 'رسیدگی به تأخیر شکاف',
        contextTitleFa: `تعیین تکلیف شکاف معوق ${overdueGaps[0].gapCode}`,
        contextHintFa: 'شکاف را به اقدام اجرایی تبدیل کنید یا با ثبت توجیه فنی مهلت آن را تمدید نمایید.',
        prefillData: { recordId: overdueGaps[0].id },
      },
    });
  }

  // 3. Due Soon (نزدیک شدن موعد)
  const dueSoonWbs = projectData.wbsTasks.filter(
    (t) =>
      Number(t.actualProgress || 0) < 100 &&
      t.plannedEnd &&
      String(t.plannedEnd) >= todayStr &&
      String(t.plannedEnd) <= sevenDaysStr
  );
  if (dueSoonWbs.length > 0) {
    notifications.push({
      id: 'notif-duesoon-wbs',
      type: 'DUE_SOON',
      typeLabelFa: 'نزدیک شدن موعد',
      severity: 'WARNING',
      titleFa: `نزدیک شدن سررسید ${dueSoonWbs.length} بسته کاری در برنامه WBS`,
      messageFa: `فعالیت «${dueSoonWbs[0].title || dueSoonWbs[0].taskTitle}» تا تاریخ ${dueSoonWbs[0].plannedEnd} موعد تحویل دارد.`,
      responsibleFa: dueSoonWbs[0].executorName || dueSoonWbs[0].ownerName || pmName,
      dueDateFa: dueSoonWbs[0].plannedEnd,
      deepLink: {
        targetSubTab: 'wbs-gantt',
        actionType: 'UPDATE_WBS_PROGRESS',
        buttonLabelFa: 'به‌روزرسانی پیشرفت فعالیت',
        contextTitleFa: `ثبت پیشرفت فعالیت ${dueSoonWbs[0].wbsCode}`,
        contextHintFa: 'درصد پیشرفت واقعی بسته کاری را پیش از سررسید ثبت نمایید.',
        prefillData: { recordId: dueSoonWbs[0].id },
      },
    });
  }

  // 4. Document Returned / Needs Evidence (برگشت مدرک / کسری شواهد)
  const returnedOrIncompleteDocs = projectData.documents.filter((d) => d.status !== 'APPROVED');
  if (returnedOrIncompleteDocs.length > 0) {
    const doc = returnedOrIncompleteDocs[0];
    notifications.push({
      id: `notif-doc-${doc.id}`,
      type: doc.status === 'UNDER_REVIEW' ? 'APPROVAL_REQUESTED' : 'DOCUMENT_RETURNED',
      typeLabelFa: doc.status === 'UNDER_REVIEW' ? 'درخواست تأیید مدرک' : 'مدرک نیازمند تکمیل شواهد',
      severity: 'WARNING',
      titleFa:
        doc.status === 'UNDER_REVIEW'
          ? `درخواست تأیید نهایی مدرک «${doc.title}» (${doc.docCode})`
          : `کسری شواهد اجرایی در مدرک «${doc.title}» (${doc.docCode})`,
      messageFa:
        doc.status === 'UNDER_REVIEW'
          ? `نسخه جدید مدرک ثبت شده و در انتظار بررسی و تأیید مقام مجاز (${doc.approverName || pmName}) است.`
          : 'مدرک در وضعیت پیش‌نویس قرار دارد؛ برای امکان تأیید نهایی باید خلاصه شواهد اجرایی یا فایل پیوست ثبت شود.',
      responsibleFa: doc.status === 'UNDER_REVIEW' ? doc.approverName || pmName : doc.authorName || pmName,
      dueDateFa: doc.validityExpiryDate || todayStr,
      deepLink: {
        targetSubTab: 'documents',
        actionType: doc.status === 'UNDER_REVIEW' ? 'APPROVE_DOCUMENT' : 'REVISE_DOCUMENT',
        buttonLabelFa: doc.status === 'UNDER_REVIEW' ? 'بررسی و تأیید مدرک' : 'تکمیل شواهد مدرک',
        contextTitleFa: `مدرک ${doc.docCode}: ${doc.title}`,
        contextHintFa: 'در جدول بانک مدارک، شواهد مدرک را تکمیل یا تأیید نمایید.',
        prefillData: { recordId: doc.id },
      },
    });
  }

  // 5. Task Assigned (تخصیص وظیفه در CAPA)
  const activeCapas = projectData.capaItems.filter((c) => c.stage !== 'CLOSED');
  if (activeCapas.length > 0) {
    const c = activeCapas[0];
    notifications.push({
      id: `notif-capa-${c.id}`,
      type: 'TASK_ASSIGNED',
      typeLabelFa: 'تخصیص وظیفه CAPA',
      severity: 'INFO',
      titleFa: `${activeCapas.length} پرونده اقدام اصلاحی (CAPA) فعال در کارتابل`,
      messageFa: `پرونده «${c.title}» (${c.capaCode}) در مرحله ${c.stage} به ${c.responsiblePersonName || pmName} تخصیص یافته است.`,
      responsibleFa: c.responsiblePersonName || pmName,
      dueDateFa: c.dueDate || todayStr,
      deepLink: {
        targetSubTab: 'capa',
        actionType: 'TRANSITION_CAPA',
        buttonLabelFa: 'انجام اقدام در CAPA',
        contextTitleFa: `پیگیری پرونده ${c.capaCode}`,
        contextHintFa: 'مرحله بعدی اقدام اصلاحی و شواهد را ثبت نمایید.',
        prefillData: { recordId: c.id },
      },
    });
  }

  // 6. Stage Completed (تکمیل مرحله)
  const approvedGates = stageGates.filter((g) => g.status === 'APPROVED');
  if (approvedGates.length > 0) {
    const lastApproved = approvedGates[approvedGates.length - 1];
    notifications.push({
      id: `notif-stage-done-${lastApproved.gateKey}`,
      type: 'STAGE_COMPLETED',
      typeLabelFa: 'تکمیل مرحله',
      severity: 'SUCCESS',
      titleFa: `تصویب و تکمیل موفقیت‌آمیز دروازه ${lastApproved.gateKey}`,
      messageFa: `${lastApproved.titleFa} با تأیید ${lastApproved.approverName || 'مقام مجاز'} به پایان رسید.`,
      responsibleFa: lastApproved.approverName || pmName,
      deepLink: {
        targetSubTab: 'stage-gates',
        actionType: 'OPEN_GATE_EVALUATION',
        buttonLabelFa: 'مشاهده گواهی تصویب',
        contextTitleFa: `سابقه تصویب دروازه ${lastApproved.gateKey}`,
        contextHintFa: 'جزئیات مصوبه و معیارهای تأییدشده دروازه قابل مشاهده است.',
        prefillData: { gateKey: lastApproved.gateKey },
      },
    });
  }

  return notifications;
}
