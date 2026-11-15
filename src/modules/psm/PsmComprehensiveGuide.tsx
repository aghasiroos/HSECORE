import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  Search,
  CheckCircle2,
  ArrowLeft,
  ArrowUp,
  Compass,
  Layers,
  ShieldCheck,
  ClipboardCheck,
  AlertTriangle,
  GitBranch,
  FolderGit2,
  ShieldAlert,
  UserCheck,
  BarChart3,
  Award,
  Bot,
  FileCheck2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play,
  Info,
  CheckSquare,
  Square,
  Building2,
  Filter,
  HelpCircle,
} from 'lucide-react';
import { PsmSubTabKey } from './PsmManagementModule';
import { PsmDeepLinkAction } from './psmGuidedEngine';
import {
  PSM_SPECIALIZED_SUBSYSTEMS,
  PSM_STAGE_GATES,
  PSM_CAPA_STAGES,
  PSM_MATURITY_LEVELS,
} from './psmStandardsCatalog';

interface PsmComprehensiveGuideProps {
  activeProject: any;
  projectData: {
    assets: any[];
    assessments: any[];
    gaps: any[];
    wbsTasks: any[];
    documents: any[];
    capaItems: any[];
    studies: any[];
    maturityRecords: any[];
    stageGates: any[];
  };
  onNavigateSubTab: (subTab: PsmSubTabKey) => void;
  onExecuteDeepLink?: (deepLink: PsmDeepLinkAction) => void;
  onOpenCreateProjectModal?: () => void;
}

export interface GuideSubTopic {
  id: string;
  stepLabel: string;
  titleFa: string;
  titleEn: string;
  statusBadge: 'ACTIVE' | 'PENDING_IMPLEMENTATION';
  targetSubTab: PsmSubTabKey;
  targetButtonLabelFa: string;
  deepLinkAction?: PsmDeepLinkAction;
  summaryFa: string;
  requiredInputsFa?: string[];
  stepsFa: string[];
  systemRuleOrNoteFa?: string;
  afterActionFa?: string;
}

export interface GuideSection {
  id: string;
  sectionNumber: number;
  stepBadgeFa: string;
  titleFa: string;
  titleEn: string;
  relatedMainZoneFa: string;
  relatedGateKey?: string;
  icon: any;
  overviewFa: string;
  primarySubTab: PsmSubTabKey;
  primaryButtonLabelFa: string;
  subTopics: GuideSubTopic[];
}

const GUIDE_READ_STORAGE_KEY = 'hse_psm_comprehensive_guide_read_v1';

export const PSM_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'sec-1-overview',
    sectionNumber: 1,
    stepBadgeFa: 'بخش اول',
    titleFa: 'آشنایی با ساختار ماژول PSM و راهبر هوشمند',
    titleEn: 'Module Architecture & Guided PSM Navigator',
    relatedMainZoneFa: 'نمای کلان ماژول (۵ تب عملیاتی + تب راهنمای جامع)',
    icon: Compass,
    overviewFa:
      'پس از ورود به ماژول مدیریت استقرار ایمنی فرایند (PSM)، در نوار بالایی صفحه ۵ تب (ناحیه) عملیاتی اصلی به همراه تب مستقل «راهنمای جامع» در اختیار شما قرار دارد. این ساختار به گونه‌ای طراحی شده است که کارشناسان و مدیران بدون سردرگمی، از مرحله تعریف پروژه تا تحویل نهایی هدایت شوند.',
    primarySubTab: 'command-center',
    primaryButtonLabelFa: 'ورود به مسیر استقرار PSM (راهبر هوشمند)',
    subTopics: [
      {
        id: 'sec-1-tabs',
        stepLabel: '۱-۱',
        titleFa: 'معرفی ۵ تب اصلی عملیاتی و کاربرد هر تب',
        titleEn: '5 Core Functional Zones',
        statusBadge: 'ACTIVE',
        targetSubTab: 'command-center',
        targetButtonLabelFa: 'ورود به تب راهبر و کارهای من',
        summaryFa:
          'تمامی ۱۵ زیرماژول تخصصی استقرار PSM در ۵ ناحیه اصلی دسته‌بندی شده‌اند تا هر نقش سازمانی به سرعت به ابزارهای مرتبط با وظایف خود دسترسی داشته باشد:',
        stepsFa: [
          '۱. راهبر و کارهای من (Guided Hub & My Tasks): قطب‌نمای هوشمند شما که در هر لحظه مشخص می‌کند در چه مرحله‌ای قرار دارید، اقدام بعدی چیست و کارتابل شخصی شما شامل چه مواردی است.',
          '۲. فرماندهی و پایش مدیران (Command & Governance): داشبورد مدیریتی، دروازه‌های کنترلی شش‌گانه (G1 تا G6) و ابزارهای سنجش مدل بلوغ ۵ سطحی سیستم.',
          '۳. برنامه‌ریزی و دارایی‌ها (Scope & Planning): تعریف پروژه و منشور، ثبت تجهیزات بحرانی ایمنی (SCE) و تدوین برنامه زمان‌بندی و ساختار شکست کار (WBS / Gantt).',
          '۴. ارزیابی و انطباق (Assessment & Gaps): ارزیابی ۲۰ عنصر CCPS RBPS و ۱۴ الزام OSHA 1910.119، ماتریس تطبیق N:M، تحلیل شکاف (Gap Analysis) و انجام مطالعات تخصصی فنی (HAZOP, LOPA, MOC, PSSR, MI و...).',
          '۵. اسناد، اقدام و تحویل (Execution & Closeout): بانک مدارک و کنترل نسخه، گردش کار ۸ مرحله‌ای اقدامات اصلاحی و پیشگیرانه (CAPA)، هوش مصنوعی محلی، گزارش ممیزی (Audit Trail) و تحویل نهایی پروژه.',
        ],
        systemRuleOrNoteFa:
          'توصیه کاربردی: کارشناسان برای انجام فعالیت‌های روزمره کار خود را از تب «راهبر و کارهای من» آغاز کنند و مدیران برای بررسی پیشرفت، کنترل گلوگاه‌ها و تصمیم‌گیری‌ها از تب «فرماندهی و پایش مدیران» استفاده نمایند.',
      },
      {
        id: 'sec-1-smart-guide',
        stepLabel: '۱-۲',
        titleFa: 'راهبر هوشمند، قابلیت پیشنهاد گام بعدی و تفکیک وظایف کاربران و مدیران',
        titleEn: 'Next Best Action Engine & Role Responsibilities',
        statusBadge: 'ACTIVE',
        targetSubTab: 'command-center',
        targetButtonLabelFa: 'ورود به راهبر هوشمند و گام بعدی',
        summaryFa:
          'در هر مرحله اگر نمی‌دانید اقدام بعدی چیست، کافی است وارد تب اول یعنی «راهبر و کارهای من ← مسیر استقرار PSM» شوید و در کارت «گام بعدی پیشنهادی سیستم» روی دکمه «شروع انجام این کار» کلیک کنید.',
        requiredInputsFa: [
          'کارشناسان فرایند، ایمنی و تعمیرات: تکمیل ارزیابی‌ها، ثبت تجهیزات SCE، تدوین اسناد و بستن اقدامات CAPA از طریق کارتابل «کارهای من».',
          'مدیر پروژه استقرار PSM: تعریف منشور پروژه، راهبری برنامه WBS/Gantt، آماده‌سازی شواهد دروازه‌های G1 تا G6 و پیگیری رفع موانع.',
          'رئیس HSE و مدیر مجتمع (Sponsor): پایش داشبورد مدیریتی، بررسی شاخص‌های EVM، تصویب دروازه‌های کنترلی G1 تا G6 و امضای تحویل نهایی.',
        ],
        stepsFa: [
          'موتور هوشمند سامانه به صورت برخط وضعیت پروژه، دروازه‌های کنترلی، ارزیابی‌ها، شکاف‌ها، برنامه WBS، مدارک و CAPAها را تحلیل می‌کند.',
          'اولویت اول پروژه در قالب کارت «گام بعدی پیشنهادی سیستم (Next Best Action)» به همراه علت اهمیت، مسئول، مهلت و مدرک موردنیاز نمایش داده می‌شود.',
          'با کلیک روی دکمه اقدام، سیستم به صورت خودکار وارد زیرتب و فرم مربوطه شده و اطلاعات پایه (پروژه، واحد، عنصر استاندارد و مسئول) را در فرم پیش‌پر (Pre-fill) می‌کند.',
        ],
        afterActionFa:
          'پس از تکمیل فرم، با بنر بازگشت سریع در بالای صفحه می‌توانید با یک کلیک به «مسیر استقرار PSM» یا «کارهای من» بازگردید.',
      },
    ],
  },
  {
    id: 'sec-2-project-assets',
    sectionNumber: 2,
    stepBadgeFa: 'بخش دوم (گام اول)',
    titleFa: 'تعریف پروژه، ثبت تجهیزات مشمول و دروازه G1',
    titleEn: 'Project Charter, SCE Assets & Gate G1',
    relatedMainZoneFa: 'تب ۳: برنامه‌ریزی و دارایی‌ها',
    relatedGateKey: 'G1',
    icon: Layers,
    overviewFa:
      'برای شروع فرایند استقرار PSM، ابتدا باید منشور پروژه، مرزهای فنی و سازمانی، تیم پروژه، واحدهای عملیاتی مشمول و تجهیزات بحرانی ایمنی (SCE) را در تب «برنامه‌ریزی و دارایی‌ها» تعریف کنید.',
    primarySubTab: 'project',
    primaryButtonLabelFa: 'ورود به مدیریت پروژه و دامنه',
    subTopics: [
      {
        id: 'sec-2-project-wizard',
        stepLabel: '۲-۱',
        titleFa: 'زیرتب «مدیریت پروژه و دامنه» (Project) و تشریح ۶ مرحله منشور پروژه',
        titleEn: '6-Stage Project Charter Wizard',
        statusBadge: 'ACTIVE',
        targetSubTab: 'project',
        targetButtonLabelFa: 'ورود به مدیریت پروژه و دامنه',
        deepLinkAction: {
          targetSubTab: 'project',
          actionType: 'OPEN_CREATE_PROJECT',
          buttonLabelFa: 'باز کردن ویزارد تعریف پروژه جدید',
          contextTitleFa: 'هدایت از راهنمای جامع: تعریف منشور پروژه جدید استقرار PSM',
          contextHintFa: 'هدایت مستقیم از راهنمای جامع به ویزارد ۶ مرحله‌ای تعریف منشور پروژه استقرار PSM',
        },
        summaryFa:
          'وارد تب اصلی «برنامه‌ریزی و دارایی‌ها» و زیرتب «مدیریت پروژه و دامنه» شوید و روی دکمه «+ تعریف پروژه جدید استقرار PSM» کلیک کنید تا راهنمای مرحله‌ای (Wizard) شش‌مرحله‌ای باز شود:',
        requiredInputsFa: [
          'کد و عنوان رسمی پروژه، تاریخ شروع و پایان شمسی و شرح دامنه شمول (Project Scope)',
          'مدیر پروژه، حامی ارشد (Sponsor) و اعضای تیم پروژه از فهرست پرسنل مرکزی',
          'واحدهای عملیاتی مشمول (با تعیین واحد اصلی Primary Unit)',
          'اهداف کمی (Quantitative Goals) و اهداف کیفی (Qualitative Goals)',
          'بودجه مصوب و هزینه‌کرد (به ریال) و خلاصه منابع',
          'نقاط عطف کلیدی (Milestones) با تاریخ هدف شمسی',
        ],
        stepsFa: [
          'مرحله ۱ (اطلاعات پایه): عنوان پروژه، تاریخ شروع و پایان به تقویم شمسی و شرح محدوده شمول پروژه را وارد کنید.',
          'مرحله ۲ (ارکان و تیم پروژه): مدیر پروژه، حامی ارشد (Sponsor) و اعضای تیم را مستقیماً از فهرست مرکزی پرسنل انتخاب کنید.',
          'مرحله ۳ (واحدهای مشمول): واحدهای عملیاتی و فرایندی مجتمع (مانند واحد پلیمریزاسیون، یوتیلیتی و مخازن ذخیره) را انتخاب کرده و واحد اصلی پروژه را مشخص کنید.',
          'مرحله ۴ (اهداف کمی و کیفی): شاخص‌های هدف پروژه را ثبت کنید؛ برای مثال افزایش امتیاز انطباق به بیش از ۸۵ درصد یا رفع ۱۰۰ درصد شکاف‌های بحرانی.',
          'مرحله ۵ (منابع و بودجه): بودجه مصوب (به ریال) و منابع موردنیاز پروژه را وارد کنید.',
          'مرحله ۶ (نقاط عطف - Milestones): نقاط کنترل و بازرسی کلیدی پروژه و تاریخ هدف هر یک را به تقویم شمسی ثبت کرده و پروژه را نهایی کنید.',
        ],
        systemRuleOrNoteFa:
          'نتیجه سیستمی: پس از ثبت پروژه، شش دروازه کنترلی (G1 تا G6) به صورت خودکار در پایگاه داده برای آن ایجاد می‌شوند.',
        afterActionFa:
          'پس از تعریف منشور پروژه، به زیرتب «ساختار سازمانی و تجهیزات» بروید تا تجهیزات بحرانی واحدهای انتخاب‌شده را ثبت کنید.',
      },
      {
        id: 'sec-2-org-assets',
        stepLabel: '۲-۲',
        titleFa: 'زیرتب «ساختار سازمانی و تجهیزات» (Org-Assets) و ثبت SCE / PSI',
        titleEn: 'Safety-Critical Equipment (SCE) & PSI Status',
        statusBadge: 'ACTIVE',
        targetSubTab: 'org-assets',
        targetButtonLabelFa: 'ورود به ساختار سازمانی و تجهیزات',
        summaryFa:
          'در این زیرتب، اتصال زنده به ساختار سازمانی مرکزی (شرکت، سایت، امور، واحدهای عملیاتی و پرسنل) برقرار است و تجهیزات بحرانی ایمنی (Safety-Critical Equipment - SCE) واحدهای مشمول ثبت می‌شوند.',
        requiredInputsFa: [
          'واحد فرایندی و ناحیه عملیاتی (Operational Zone)',
          'تگ تجهیز (Tag No. مانند R-201A یا TK-104) و نام تجهیز',
          'نوع تجهیز: راکتور (REACTOR)، مخزن تحت فشار (PRESSURE_VESSEL)، مخزن ذخیره (STORAGE_TANK)، کمپرسور (COMPRESSOR)، برج تقطیر (COLUMN)، حلقه ایمنی (SIS_LOOP) یا شیر اطمینان (RELIEF_VALVE)',
          'مواد شیمیایی خطرناک مرتبط (مانند پروپیلن، هگزان، کاتالیست و...)',
          'مسئول مستقیم تجهیز (از بانک پرسنل مرکزی) و سطح بحران ایمنی (CRITICAL, HIGH, MEDIUM)',
          'وضعیت تکمیل بسته اطلاعات ایمنی فرایند (PSI Completed)',
        ],
        stepsFa: [
          '۱. وارد تب «برنامه‌ریزی و دارایی‌ها» و سپس زیرتب «ساختار سازمانی و تجهیزات» شوید.',
          '۲. روی دکمه «+ ثبت تجهیز / ناحیه عملیاتی جدید» کلیک کنید.',
          '۳. مشخصات تجهیز، تگ، نوع تجهیز، مواد شیمیایی خطرناک و مسئول تجهیز را وارد کنید.',
          '۴. در صورت تکمیل نقشه‌های P&ID و برگه‌های اطلاعات ایمنی مواد (SDS)، گزینه «بسته اطلاعات ایمنی فرایند (PSI) کامل است» را علامت‌گذاری کنید.',
        ],
        afterActionFa:
          'پس از ثبت منشور پروژه، تجهیزات بحرانی و تکمیل ارزیابی اولیه، دروازه کنترلی G1 را در زیرتب «دروازه‌های کنترلی (G1–G6)» بررسی و تصویب کنید.',
      },
      {
        id: 'sec-2-gate-g1',
        stepLabel: '۲-۳',
        titleFa: 'تشریح دروازه کنترلی اول (G1: تصویب منشور، دامنه شمول و ارزیابی پایه)',
        titleEn: 'Stage-Gate G1 Governance Criteria',
        statusBadge: 'ACTIVE',
        targetSubTab: 'stage-gates',
        targetButtonLabelFa: 'ورود به دروازه‌های کنترلی (G1–G6)',
        summaryFa:
          'دروازه G1 اولین نقطه کنترل رسمی حاکمیت پروژه است که تضمین می‌کند مرزهای پروژه، تیم اجرایی، تجهیزات مشمول و ارزیابی پایه بدون نقص تعریف شده‌اند.',
        stepsFa: [
          'وارد تب «فرماندهی و پایش مدیران ← موتور حاکمیت و دروازه‌های کنترلی (G1–G6)» شوید.',
          'چک‌لیست چهارگانه G1 (تعیین دامنه شمول، تکمیل ارزیابی پایه ۲۰ عنصر CCPS و ۱۴ بند OSHA، ثبت توجیه فنی موارد خارج از دامنه و امضای منشور تیم) را بررسی کنید.',
          'شواهد الزامی (سند منشور پروژه و گزارش ارزیابی اولیه) را ثبت کرده و با تعیین مسئول آماده‌سازی و مقام تصویب‌کننده، دروازه G1 را به وضعیت APPROVED تغییر دهید.',
        ],
      },
    ],
  },
  {
    id: 'sec-3-assessment-gap',
    sectionNumber: 3,
    stepBadgeFa: 'بخش سوم (گام دوم)',
    titleFa: 'ارزیابی اولیه، ماتریس تطبیق و تحلیل شکاف (Gap Analysis)',
    titleEn: 'Initial Assessment, N:M Traceability Matrix & Gap RPN',
    relatedMainZoneFa: 'تب ۴: ارزیابی و انطباق',
    relatedGateKey: 'G2',
    icon: ClipboardCheck,
    overviewFa:
      'در این مرحله باید وضعیت موجود مجتمع را در مقایسه با ۲۰ عنصر استاندارد CCPS RBPS و ۱۴ الزام قانونی OSHA 29 CFR 1910.119 ارزیابی کنید تا شکاف‌ها استخراج و بر اساس عدد اولویت ریسک (RPN) رتبه‌بندی شوند.',
    primarySubTab: 'assessment',
    primaryButtonLabelFa: 'ورود به ارزیابی اولیه و ماتریس تطبیق',
    subTopics: [
      {
        id: 'sec-3-assessment',
        stepLabel: '۳-۱',
        titleFa: 'زیرتب «ارزیابی اولیه و ماتریس تطبیق» (Assessment) — ۲۰ عنصر CCPS، ۱۴ بند OSHA و ماتریس N:M',
        titleEn: '20 CCPS Elements, 14 OSHA Clauses & N:M Matrix',
        statusBadge: 'ACTIVE',
        targetSubTab: 'assessment',
        targetButtonLabelFa: 'ورود به ارزیابی اولیه و ماتریس تطبیق',
        deepLinkAction: {
          targetSubTab: 'assessment',
          actionType: 'OPEN_ASSESSMENT_FORM',
          buttonLabelFa: 'باز کردن فرم ثبت ارزیابی عنصر PSM',
          contextTitleFa: 'هدایت از راهنمای جامع: ثبت ارزیابی اولیه عناصر CCPS و OSHA',
          contextHintFa: 'هدایت مستقیم از راهنمای جامع به فرم ثبت ارزیابی فنی عناصر CCPS و OSHA',
          prefillData: { standardType: 'CCPS_RBPS', elementCode: 'CCPS-01' },
        },
        summaryFa:
          'در زیرتب «ارزیابی اولیه و ماتریس تطبیق» سه نمای تخصصی وجود دارد: ۱) ۲۰ عنصر CCPS RBPS در ۴ رکن اصلی، ۲) ۱۴ الزام OSHA 29 CFR 1910.119، و ۳) ماتریس تطبیق چندبه‌چند (N:M Traceability Matrix) با تفکیک ارتباط مستقیم (DIRECT) و غیرمستقیم (INDIRECT).',
        requiredInputsFa: [
          'مرجع استاندارد (CCPS RBPS یا OSHA 1910.119)، کد عنصر و واحد عملیاتی',
          'وضعیت انطباق (COMPLIANT منطبق، PARTIAL انطباق نسبی، NON_COMPLIANT عدم انطباق)',
          'امتیاز وضعیت فعلی (۰ تا ۱۰۰) و امتیاز مطلوب هدف (پیش‌فرض ۸۵)',
          'سطح بلوغ فعلی عنصر (از ۱ تا ۵) و وزن عنصر',
          'نقاط قوت، مدارک موجود، مدارک کسری و شواهد مشاهدات میدانی',
          'نقاط ضعف و شرح دقیق شکاف (مبنای تولید خودکار رکورد Gap)',
          'در صورت خارج از دامنه بودن (Out-of-Scope): توجیه فنی مستند (حداقل ۱۵ کاراکتر) + نام مقام تأییدکننده',
        ],
        stepsFa: [
          '۱. وارد تب «ارزیابی و انطباق» و زیرتب «ارزیابی اولیه و ماتریس تطبیق» شوید.',
          '۲. روی کارت هر عنصر دکمه «+ ثبت ارزیابی عنصر» (یا دکمه ثبت ارزیابی در نوار بالا) را بزنید.',
          '۳. امتیاز فعلی، امتیاز هدف، سطح بلوغ، نقاط قوت و نقاط ضعف/شرح شکاف را وارد و ذخیره کنید.',
          '۴. تبصره خارج از محدوده شمول: اگر عنصری در یک واحد عملیاتی موضوعیت ندارد، تیک «خارج از دامنه شمول (Out-of-Scope)» را بزنید و توجیه فنی مستند (حداقل ۱۵ کاراکتر) و نام مقام تأییدکننده را ثبت کنید.',
        ],
        systemRuleOrNoteFa:
          'قابلیت هوشمند سیستم: هر عنصری که خارج از دامنه نباشد و امتیاز فعلی آن کمتر از امتیاز هدف (۸۵) باشد، بلافاصله پس از ذخیره ارزیابی، به صورت خودکار یک رکورد شکاف (Gap) در زیرتب «تحلیل شکاف» ایجاد می‌کند.',
      },
      {
        id: 'sec-3-gap-analysis',
        stepLabel: '۳-۲',
        titleFa: 'زیرتب «تحلیل شکاف (Gap Analysis)»، محاسبه خودکار RPN و تشریح سطوح ریسک',
        titleEn: 'Gap Analysis, RPN Calculation & Risk Tiers',
        statusBadge: 'ACTIVE',
        targetSubTab: 'gap-analysis',
        targetButtonLabelFa: 'ورود به تحلیل شکاف (Gap Analysis)',
        summaryFa:
          'در این بخش شکاف‌های استخراج‌شده از مرحله ارزیابی به صورت خودکار نمایش داده می‌شوند و امکان ثبت شکاف جدید به صورت دستی نیز از طریق دکمه «+ ثبت شکاف (Gap) جدید» فراهم است.',
        requiredInputsFa: [
          'شدت پیامد (Severity): از ۱ تا ۵',
          'احتمال وقوع (Likelihood): از ۱ تا ۵',
          'ضریب اهمیت و بحرانی بودن فرایند (Criticality Weight): از ۱ تا ۵',
          'اقدام اصلاحی پیشنهادی، بودجه برآوردی (ریال)، مسئول اجرا و مهلت انجام به تقویم شمسی',
        ],
        stepsFa: [
          '۱. وارد زیرتب «تحلیل شکاف (Gap Analysis)» شوید.',
          '۲. برای هر شکاف سه شاخص شدت (۱ تا ۵)، احتمال (۱ تا ۵) و ضریب بحران فرایندی (۱ تا ۵) را تعیین کنید.',
          '۳. سیستم عدد اولویت ریسک را با فرمول RPN = شدت × احتمال × ضریب بحران (حداکثر ۱۲۵) محاسبه کرده و سطح ریسک را در ۴ طبقه تعیین می‌کند: بحرانی (CRITICAL: RPN ≥ 40)، بالا (HIGH: 20 ≤ RPN < 40)، متوسط (MEDIUM: 10 ≤ RPN < 20) و پایین (LOW: RPN < 10).',
          '۴. برای شکاف‌های بحرانی و پرخطر، اقدام اصلاحی پیشنهادی، بودجه برآوردی، مسئول اجرا و مهلت شمسی را ثبت کنید.',
        ],
        afterActionFa:
          'پس از تکمیل ارزیابی اولیه و تحلیل شکاف‌ها، به زیرتب «دروازه‌های کنترلی (G1–G6)» مراجعه کرده و دروازه G2 با عنوان «تأیید تحلیل شکاف و فهرست نواقص» را تصویب کنید.',
      },
    ],
  },
  {
    id: 'sec-4-wbs-gantt',
    sectionNumber: 4,
    stepBadgeFa: 'بخش چهارم (گام سوم)',
    titleFa: 'برنامه‌ریزی اجرایی، ساختار شکست کار (WBS)، مسیر بحرانی و گانت',
    titleEn: 'WBS Work Packages, Critical Path & Gantt Schedule',
    relatedMainZoneFa: 'تب ۳: برنامه‌ریزی و دارایی‌ها',
    relatedGateKey: 'G3',
    icon: GitBranch,
    overviewFa:
      'پس از شناسایی و اولویت‌بندی شکاف‌ها، باید آن‌ها را به بسته‌های کاری قابل اجرا در قالب ساختار شکست کار (WBS) و برنامه زمان‌بندی گانت تبدیل کنید.',
    primarySubTab: 'wbs-gantt',
    primaryButtonLabelFa: 'ورود به برنامه اجرایی، WBS و گانت',
    subTopics: [
      {
        id: 'sec-4-wbs-definition',
        stepLabel: '۴-۱',
        titleFa: 'تعریف فعالیت‌های WBS، مسیر بحرانی، ثبت پیشرفت واقعی و نمودار گانت',
        titleEn: 'Defining WBS Tasks, Critical Path & Gantt Tracking',
        statusBadge: 'ACTIVE',
        targetSubTab: 'wbs-gantt',
        targetButtonLabelFa: 'ورود به برنامه اجرایی، WBS و گانت',
        summaryFa:
          'در زیرتب «برنامه اجرایی، WBS و گانت» کلیه فعالیت‌های اجرایی پروژه به همراه وزن، مسئول، منابع، پیش‌نیازها و وضعیت مسیر بحرانی مدیریت می‌شوند.',
        requiredInputsFa: [
          'کد WBS (مانند 1.2.1)، عنوان فعالیت، فاز استقرار و عنصر مرتبط CCPS',
          'واحد عملیاتی، مسئول اجرا، منابع موردنیاز و وزن فعالیت (Weight)',
          'تاریخ شروع و پایان برنامه‌ریزی‌شده به تقویم شمسی',
          'علامت‌گذاری گزینه «مسیر بحرانی (Critical Path)» برای فعالیت‌های تعیین‌کننده زمان کل پروژه',
          'درصد پیشرفت واقعی (Actual %) و وضعیت فعالیت در طول اجرای پروژه',
        ],
        stepsFa: [
          '۱. وارد تب «برنامه‌ریزی و دارایی‌ها» و سپس زیرتب «برنامه اجرایی، WBS و گانت» شوید.',
          '۲. روی دکمه «+ افزودن فعالیت جدید WBS» کلیک کنید و اطلاعات کد WBS، عنوان، عنصر CCPS، واحد، مسئول، وزن و تاریخ‌های شروع و پایان شمسی را ثبت کنید.',
          '۳. در صورت قرار گرفتن فعالیت در مسیر بحرانی پروژه، گزینه «مسیر بحرانی (Critical Path)» را فعال کنید.',
          '۴. در طول اجرای پروژه، از همین صفحه درصد پیشرفت واقعی (Actual %) هر بسته کاری را به‌روزرسانی کنید و از طریق نمای «نمودار گانت (Gantt Chart)» وضعیت زمان‌بندی و میزان انحراف از برنامه (Schedule Variance) را بررسی نمایید.',
        ],
        afterActionFa:
          'عبور از دروازه سوم (G3): پس از ثبت و تکمیل بسته‌های کاری WBS، به زیرتب «دروازه‌های کنترلی (Stage-Gates)» مراجعه کرده و دروازه G3 با عنوان «تصویب برنامه اجرایی، WBS و منابع» را تصویب کنید.',
      },
    ],
  },
  {
    id: 'sec-5-studies',
    sectionNumber: 5,
    stepBadgeFa: 'بخش پنجم (گام چهارم - الف)',
    titleFa: 'مطالعات تخصصی PSM (معرفی کامل ۱۴ زیرماژول تخصصی)',
    titleEn: '14 Specialized PSM Engineering Subsystems',
    relatedMainZoneFa: 'تب ۴: ارزیابی و انطباق ← ۱۴ زیرماژول تخصصی PSM',
    relatedGateKey: 'G4',
    icon: Layers,
    overviewFa:
      'این بخش هسته فنی و مهندسی استقرار سیستم مدیریت ایمنی فرایند (PSM) در مجتمع است. در زیرتب «۱۴ زیرماژول تخصصی PSM» (Studies)، تمام ۱۴ حوزه فنی مطابق استانداردهای CCPS و OSHA پیاده‌سازی شده‌اند و پرونده‌های فنی هر حوزه ثبت و رهگیری می‌شوند.',
    primarySubTab: 'studies',
    primaryButtonLabelFa: 'ورود به ۱۴ زیرماژول تخصصی PSM',
    subTopics: [
      {
        id: 'sec-5-how-to-use',
        stepLabel: '۵-۱',
        titleFa: 'نحوه کار با فرم «ثبت پرونده / مطالعه تخصصی جدید» در ۱۴ زیرماژول',
        titleEn: 'How to Register & Track Specialized PSM Studies',
        statusBadge: 'ACTIVE',
        targetSubTab: 'studies',
        targetButtonLabelFa: 'ورود به بخش ۱۴ زیرماژول تخصصی PSM',
        summaryFa:
          'در بالای زیرتب «۱۴ زیرماژول تخصصی PSM»، نوار انتخاب ۱۴ حوزه فنی قرار دارد. با انتخاب هر حوزه و کلیک روی دکمه «+ ثبت پرونده / مطالعه تخصصی جدید»، فرم ثبت اطلاعات مهندسی همان حوزه باز می‌شود.',
        requiredInputsFa: [
          'حوزه تخصصی (از میان ۱۴ زیرماژول)، کد مطالعه، عنوان پرونده و واحد فرایندی',
          'تجهیز بحرانی مرتبط (متصل به بانک تجهیزات SCE ثبت‌شده در گام اول)',
          'سناریوی خطر و شرح فنی مطالعه / تغییر / بازرسی',
          'سطح ریسک اولیه (Initial Risk) و سطح ریسک باقی‌مانده (Residual Risk)',
          'لایه‌های مستقل حفاظتی (IPL) و کنترل‌های مهندسی/عملیاتی موجود',
          'توصیه‌ها و الزامات فنی، مسئول پیگیری و تاریخ بازنگری بعدی به تقویم شمسی',
        ],
        stepsFa: [
          '۱. وارد تب «ارزیابی و انطباق» و زیرتب «۱۴ زیرماژول تخصصی PSM» شوید.',
          '۲. از نوار بالایی، زیرماژول تخصصی موردنظر (مثلاً PSI, PHA, HAZOP, LOPA, MOC, PSSR, MI, SOP, ERP و...) را انتخاب کنید.',
          '۳. روی دکمه «+ ثبت پرونده / مطالعه تخصصی جدید» کلیک کنید و اطلاعات تجهیز مرتبط، سناریوی خطر، ریسک اولیه/باقی‌مانده، لایه‌های حفاظتی IPL و توصیه‌های فنی را ثبت نمایید.',
          '۴. وضعیت پیشرفت و تصویب هر مطالعه را تا نهایی‌سازی کامل پیگیری کنید.',
        ],
      },
    ],
  },
  {
    id: 'sec-6-documents',
    sectionNumber: 6,
    stepBadgeFa: 'بخش ششم (گام چهارم - ب)',
    titleFa: 'مدیریت اسناد، شواهد فنی و کنترل نسخه (Documents)',
    titleEn: 'PSM Document Bank, 4-Stage Approval & Version Control',
    relatedMainZoneFa: 'تب ۵: اسناد، اقدام و تحویل ← بانک اسناد و شواهد PSM',
    relatedGateKey: 'G4',
    icon: FolderGit2,
    overviewFa:
      'در زیرتب «بانک اسناد و شواهد PSM»، کلیه مدارک، روش‌های اجرایی، دستورالعمل‌ها، چک‌لیست‌ها و گزارش‌های ممیزی همراه با چرخه چهارمرحله‌ای گردش و تأیید و آرشیو خودکار نسخه‌ها مدیریت می‌شوند.',
    primarySubTab: 'documents',
    primaryButtonLabelFa: 'ورود به بانک اسناد و شواهد PSM',
    subTopics: [
      {
        id: 'sec-6-doc-workflow',
        stepLabel: '۶-۱',
        titleFa: 'نحوه ثبت مدارک، گردش تأیید ۴ مرحله‌ای و مدیریت نسخه‌ها',
        titleEn: 'Document Registration, 4-Stage Workflow & Revision History',
        statusBadge: 'ACTIVE',
        targetSubTab: 'documents',
        targetButtonLabelFa: 'ورود به بانک اسناد و شواهد PSM',
        summaryFa:
          'هر سند در بانک اسناد PSM دارای شناسه یکتا، عنصر استاندارد مرتبط (CCPS/OSHA)، واحد مشمول، شماره نسخه و چرخه رسمی بررسی و تصویب است.',
        requiredInputsFa: [
          'کد سند، عنوان مدرک، نوع مدرک (روش اجرایی، دستورالعمل SOP، چک‌لیست، گزارش فنی، نقشه P&ID)',
          'عنصر استاندارد مرتبط (CCPS / OSHA) و واحد عملیاتی',
          'شماره ویرایش/نسخه (Revision)، تهیه‌کننده، بازبین فنی و مقام تصویب‌کننده',
          'تاریخ صدور و تاریخ اعتبار/بازنگری بعدی به تقویم شمسی و خلاصه شواهد پیوست',
        ],
        stepsFa: [
          '۱. وارد تب «اسناد، اقدام و تحویل» و زیرتب «بانک اسناد و شواهد PSM» شوید.',
          '۲. از طریق دکمه «+ ثبت مدرک / سند جدید PSM»، مشخصات سند، عنصر مرتبط و مسئولان تهیه و بررسی را ثبت کنید.',
          '۳. چرخه چهارمرحله‌ای گردش و تأیید سند را از طریق دکمه‌های ردیف سند پیگیری کنید: ۱) پیش‌نویس (DRAFT) ← ۲) در انتظار بررسی (UNDER_REVIEW) ← ۳) مصوب (APPROVED) ← ۴) ابلاغ و جاری‌شده (EFFECTIVE).',
          '۴. برای ثبت ویرایش اصلاح‌شده، روی دکمه «+ نسخه جدید» کلیک کنید؛ نسخه قبلی به صورت خودکار در «تاریخچه نسخه‌ها (Revision History)» آرشیو می‌شود.',
        ],
        systemRuleOrNoteFa:
          'قانون سیستمی پیشرفت واقعی: اسناد در وضعیت پیش‌نویس (DRAFT) یا بدون شواهد مصوب، صرفاً پیشرفت کاغذی محسوب شده و تا زمان رسیدن به وضعیت APPROVED / EFFECTIVE در پیشرفت واقعی و عبور از دروازه G4 لحاظ نمی‌شوند.',
      },
    ],
  },
  {
    id: 'sec-7-capa',
    sectionNumber: 7,
    stepBadgeFa: 'بخش هفتم (گام چهارم - ج)',
    titleFa: 'مدیریت اقدامات اصلاحی و پیشگیرانه (CAPA) و صحه‌گذاری اثربخشی',
    titleEn: '8-Stage CAPA Workflow & Independent Effectiveness Verification',
    relatedMainZoneFa: 'تب ۵: اسناد، اقدام و تحویل ← گردش کار ۸ مرحله‌ای CAPA',
    relatedGateKey: 'G5',
    icon: ShieldAlert,
    overviewFa:
      'در زیرتب «گردش کار ۸ مرحله‌ای CAPA»، برای هر شکاف یا عدم انطباق شناسایی‌شده یک پرونده اقدام اصلاحی/پیشگیرانه تشکیل می‌شود و تا زمان صحه‌گذاری مستقل اثربخشی پیگیری می‌گردد.',
    primarySubTab: 'capa',
    primaryButtonLabelFa: 'ورود به گردش کار ۸ مرحله‌ای CAPA',
    subTopics: [
      {
        id: 'sec-7-capa-stages',
        stepLabel: '۷-۱',
        titleFa: 'نحوه ثبت CAPA، تحلیل علت ریشه‌ای (RCA) و تشریح ۸ مرحله گردش کار',
        titleEn: 'CAPA Registration, RCA & 8-Stage Gate Rules',
        statusBadge: 'ACTIVE',
        targetSubTab: 'capa',
        targetButtonLabelFa: 'ورود به گردش کار ۸ مرحله‌ای CAPA',
        summaryFa:
          'هر اقدام اصلاحی به شکاف یا مطالعه منشأ خود متصل است و باید ۸ مرحله کنترل‌شده را تا بسته شدن نهایی طی کند.',
        requiredInputsFa: [
          'عنوان اقدام، کد پرونده و شکاف یا عدم انطباق مرتبط',
          'تحلیل علت ریشه‌ای (Root Cause Analysis - RCA)',
          'شرح دقیق اقدام اصلاحی یا پیشگیرانه، سطح ریسک و واحد عملیاتی',
          'مسئول اجرا، مهلت انجام به تقویم شمسی و معیار صحه‌گذاری اثربخشی اقدام',
          'شواهد و مستندات تکمیل اقدام + نام ارزیاب مستقل صحه‌گذاری اثربخشی',
        ],
        stepsFa: [
          'مرحله ۱ — شناسایی شکاف / ثبت نقص (REGISTERED): ثبت شرح دقیق نقص، منبع کشف، واحد و عنصر استاندارد مرتبط.',
          'مرحله ۲ — تحلیل علت ریشه‌ای و ارزیابی ریسک (RISK_ASSESSED / RCA): تعیین شدت، احتمال، سطح ریسک و ریشه‌یابی فنی علت بروز عدم انطباق.',
          'مرحله ۳ — تعریف اقدام و تخصیص مسئول (ASSIGNED): تعیین شرح اقدام اصلاحی/پیشگیرانه، مسئول اجرا، منابع و مهلت شمسی.',
          'مرحله ۴ — اجرای اقدام اصلاحی (ACTION_IN_PROGRESS): پیاده‌سازی عملیاتی اقدام در واحد مربوطه.',
          'مرحله ۵ — ثبت شواهد و مستندات تکمیل (EVIDENCE_SUBMITTED): بارگذاری و ثبت شواهد عینی اجرای اقدام.',
          'مرحله ۶ — بررسی فنی کفایت شواهد (UNDER_REVIEW): بررسی کفایت فنی اقدام و مستندات توسط بازبین فنی.',
          'مرحله ۷ — صحه‌گذاری مستقل اثربخشی (EFFECTIVENESS_VERIFIED): ممیزی و تأیید اثربخشی اقدام در عمل توسط فردی متمایز از مجری اقدام.',
          'مرحله ۸ — بسته شدن نهایی (CLOSED): بستن نهایی پرونده صرفاً پس از تأیید مستقل اثربخشی.',
        ],
        systemRuleOrNoteFa:
          'قانون مهم سیستم: هیچ اقدام اصلاحی یا پیشگیرانه‌ای بدون ثبت و تأیید نتیجه «صحه‌گذاری اثربخشی (Effectiveness Verification)» به عنوان پیشرفت واقعی و اقدام تکمیل‌شده محاسبه نمی‌شود.',
        afterActionFa:
          'عبور از دروازه‌های چهارم و پنجم (G4 و G5): پس از تکمیل مطالعات تخصصی و تصویب مدارک فنی، دروازه G4 را تصویب کنید؛ و پس از اجرای اقدامات CAPA و تأیید اثربخشی آن‌ها، دروازه G5 را در زیرتب «دروازه‌های کنترلی (Stage-Gates)» تصویب نمایید.',
      },
    ],
  },
  {
    id: 'sec-8-workspace',
    sectionNumber: 8,
    stepBadgeFa: 'بخش هشتم (گام پنجم - الف)',
    titleFa: 'راهبری هوشمند و کارتابل عملیاتی «کارهای من»',
    titleEn: 'Guided 7-Stage Roadmap & 8-Category Personal Action Center',
    relatedMainZoneFa: 'تب ۱: راهبر و کارهای من',
    icon: UserCheck,
    overviewFa:
      'در طول اجرای مراحل مختلف پروژه، تب اول («راهبر و کارهای من») مرکز کار روزمره کارشناسان و مسئولان واحدها است که شامل دو زیرتب «مسیر استقرار PSM» و «کارهای من (کارتابل عملیاتی)» می‌باشد.',
    primarySubTab: 'my-workspace',
    primaryButtonLabelFa: 'ورود به کارتابل عملیاتی «کارهای من»',
    subTopics: [
      {
        id: 'sec-8-roadmap',
        stepLabel: '۸-۱',
        titleFa: 'زیرتب «مسیر استقرار PSM (راهبر هوشمند)» و نقشه راه هفت‌مرحله‌ای',
        titleEn: '7-Stage Guided Implementation Roadmap',
        statusBadge: 'ACTIVE',
        targetSubTab: 'command-center',
        targetButtonLabelFa: 'ورود به مسیر استقرار PSM',
        summaryFa:
          'این بخش نقشه راه ۷ مرحله‌ای کل چرخه عمر استقرار را به همراه مقایسه «پیشرفت واقعی» در برابر «پیشرفت کاغذی» نمایش می‌دهد.',
        stepsFa: [
          'نمایش نقشه راه ۷ مرحله‌ای پروژه (از گام ۱: تعریف پروژه و دامنه تا گام ۷: تحویل نهایی و نگهداشت) با وضعیت هر مرحله (تکمیل‌شده، در حال انجام، متوقف، در انتظار).',
          'نمایش کارت «گام بعدی پیشنهادی سیستم» که اولویت اول پروژه را مشخص کرده و با یک کلیک کاربر را به فرم مربوطه هدایت می‌کند.',
          'ارائه بخش «راهنمای ساده مفاهیم تخصصی ایمنی فرایند» در پایین صفحه که مفاهیمی مانند HAZOP, MOC, PSSR, MI, PSI و CAPA را با ۶ پرسش کلیدی به زبان ساده توضیح می‌دهد.',
        ],
      },
      {
        id: 'sec-8-my-workspace',
        stepLabel: '۸-۲',
        titleFa: 'زیرتب «کارهای من (کارتابل عملیاتی)» و تشریح ۸ دسته‌بندی استاندارد',
        titleEn: 'My Workspace — 8 Standard Task Categories',
        statusBadge: 'ACTIVE',
        targetSubTab: 'my-workspace',
        targetButtonLabelFa: 'ورود به کارتابل «کارهای من»',
        summaryFa:
          'این بخش تمام وظایف، شکاف‌ها، فعالیت‌های WBS، مدارک و تصمیم‌های باز پروژه را در ۸ دسته‌بندی استاندارد متمرکز می‌کند:',
        stepsFa: [
          '۱. وظایف جدید (NEW_TASKS): شکاف‌ها و فعالیت‌های تازه ابلاغ‌شده که هنوز شروع نشده‌اند.',
          '۲. در حال انجام (IN_PROGRESS): فعالیت‌های WBS و اقدامات اصلاحی جاری.',
          '۳. مدارک نیازمند تکمیل (DOCS_NEEDING_COMPLETION): اسناد پیش‌نویس یا فاقد شواهد فنی کافی.',
          '۴. ارسال‌شده برای تأیید (SUBMITTED_FOR_APPROVAL): مدارک و شواهدی که در صف بررسی و صحه‌گذاری هستند.',
          '۵. موارد برگشت‌خورده (RETURNED_FOR_REWORK): اسناد یا دروازه‌های ردشده که نیازمند اصلاح و بازنگری هستند.',
          '۶. نزدیک به سررسید (DUE_SOON): وظایفی که مهلت انجام آن‌ها کمتر از ۷ روز کاری آینده است.',
          '۷. وظایف معوق (OVERDUE): فعالیت‌ها، شکاف‌ها یا CAPAهای گذشته از سررسید مصوب که نیازمند اقدام فوری هستند.',
          '۸. تصمیم‌های موردنیاز (DECISIONS_REQUIRED): تأیید مدارک، صحه‌گذاری CAPA و تصویب دروازه‌های کنترلی G1 تا G6.',
        ],
        systemRuleOrNoteFa:
          'با فعال کردن دکمه «فقط کارهای مرتبط با من»، هر کارشناس صرفاً وظایف مربوط به خود را مشاهده می‌کند و با کلیک روی دکمه اجرای هر کارت، مستقیماً به فرم مربوط به همان فعالیت هدایت می‌شود.',
      },
    ],
  },
  {
    id: 'sec-9-dashboard',
    sectionNumber: 9,
    stepBadgeFa: 'بخش نهم (گام پنجم - ب)',
    titleFa: 'داشبورد کنترل و پایش مدیران (Executive Dashboard & EVM)',
    titleEn: 'Executive Governance Dashboard, CCPS Matrix, EVM & Predictive Alerts',
    relatedMainZoneFa: 'تب ۲: فرماندهی و پایش مدیران ← داشبورد کنترل و پایش مدیران',
    icon: BarChart3,
    overviewFa:
      'زیرتب «داشبورد کنترل و پایش مدیران» به طور ویژه برای مدیر پروژه، رئیس HSE و مدیر مجتمع طراحی شده است تا در یک نگاه وضعیت واقعی پیشرفت، گلوگاه‌ها، انحرافات زمانی/بودجه‌ای و ریسک‌های بحرانی را رصد کنند.',
    primarySubTab: 'dashboard',
    primaryButtonLabelFa: 'ورود به داشبورد کنترل و پایش مدیران',
    subTopics: [
      {
        id: 'sec-9-views',
        stepLabel: '۹-۱',
        titleFa: 'تشریح ۴ نمای تخصصی داشبورد مدیریتی و شاخص‌های SPI / CPI',
        titleEn: '4 Executive Dashboard Views & Earned Value Management (EVM)',
        statusBadge: 'ACTIVE',
        targetSubTab: 'dashboard',
        targetButtonLabelFa: 'ورود به داشبورد کنترل و پایش مدیران',
        summaryFa:
          'در بالای داشبورد مدیریتی امکان فیلتر بر اساس واحد عملیاتی و سوئیچ بین ۴ نمای تحلیلی فراهم است:',
        stepsFa: [
          '۱. نمای کلی و حاکمیت (Overview & Governance): شناسایی و تحلیل هوشمند علل توقف پروژه (Stoppage Diagnosis Radar)، تفکیک «پیشرفت واقعی» از «پیشرفت کاغذی/ثبت‌شده» و نمایش درصد پیشرفت به تفکیک واحدهای عملیاتی.',
          '۲. ماتریس ۲۰ عنصر CCPS و ۱۴ الزام OSHA (Elements Matrix): نمایش درصد پیشرفت، امتیاز انطباق و تعداد شکاف‌های باز هر یک از ۲۰ عنصر CCPS در ۴ رکن اصلی و ۱۴ بند OSHA.',
          '۳. مدیریت ارزش کسب‌شده (Earned Value Management - EVM): محاسبه زنده شاخص عملکرد زمان‌بندی (SPI = EV / PV)، شاخص عملکرد هزینه (CPI = EV / AC)، ارزش برنامه‌ریزی‌شده (PV)، ارزش کسب‌شده (EV) و تحلیل واریانس‌های زمانی و هزینه‌ای پروژه.',
          '۴. هشدارهای پیش‌بینانه (Predictive Alerts): شناسایی خودکار گلوگاه‌های اجرایی، تأخیرهای احتمالی فعالیت‌های مسیر بحرانی، مدارک منقضی‌شده و ریسک‌های بحرانی باز.',
        ],
        systemRuleOrNoteFa:
          'کاربرد مدیریتی: مدیر پروژه برای کنترل انحراف زمان‌بندی (SPI) و گلوگاه‌های WBS، رئیس HSE برای رصد شکاف‌های بحرانی و انطباق ۲۰ عنصر، و مدیر مجتمع برای اتخاذ تصمیم‌های رفع توقف و تخصیص بودجه (CPI) از این داشبورد استفاده می‌کنند.',
      },
    ],
  },
  {
    id: 'sec-10-maturity',
    sectionNumber: 10,
    stepBadgeFa: 'بخش دهم (گام ششم - الف)',
    titleFa: 'ممیزی و مدل بلوغ پنج‌سطحی ایمنی فرایند (Maturity Model)',
    titleEn: '5-Level PSM Maturity Model & 5 Assessment Dimensions',
    relatedMainZoneFa: 'تب ۲: فرماندهی و پایش مدیران ← مدل بلوغ ۵ سطحی PSM',
    icon: Award,
    overviewFa:
      'پس از تکمیل اقدامات اجرایی، مطالعات تخصصی و مدارک موردنیاز، نوبت به ارزیابی سطح بلوغ سیستم در زیرتب «مدل بلوغ ۵ سطحی PSM» و پایش شاخص‌های پیشرو و پسرو (API RP 754) می‌رسد.',
    primarySubTab: 'maturity',
    primaryButtonLabelFa: 'ورود به مدل بلوغ ۵ سطحی PSM',
    subTopics: [
      {
        id: 'sec-10-dimensions',
        stepLabel: '۱۰-۱',
        titleFa: 'تشریح ۵ سطح بلوغ، ۵ بُعد ارزیابی و نحوه ثبت دوره ممیزی بلوغ',
        titleEn: '5 Maturity Levels & 5 Assessment Dimensions',
        statusBadge: 'ACTIVE',
        targetSubTab: 'maturity',
        targetButtonLabelFa: 'ورود به مدل بلوغ ۵ سطحی PSM',
        summaryFa:
          'در این زیرتب، بلوغ سیستم مستقل از درصد پیشرفت کاغذی پروژه و بر اساس ۵ بُعد عملکردی برای هر عنصر سنجیده می‌شود:',
        requiredInputsFa: [
          'عنوان دوره ممیزی، عنصر مورد ارزیابی، واحد عملیاتی، نام سرارزیاب و تاریخ شمسی',
          'بُعد اول — طراحی و تدوین مدارک (Design): وضعیت تدوین، تکمیل و تصویب مستندات',
          'بُعد دوم — استقرار و پیاده‌سازی میدانی (Implementation): میزان پیاده‌سازی الزامات در واحدهای عملیاتی',
          'بُعد سوم — اجرا در عملیات روزمره (Operation): میزان اجرای مستمر الزامات PSM در فعالیت‌های روزانه شیفت‌ها',
          'بُعد چهارم — پایش، ممیزی و شاخص‌های عملکردی (Monitoring & KPIs): وضعیت پایش مستمر و شاخص‌های پیشرو/پسرو',
          'بُعد پنجم — بهبود مستمر و یادگیری سازمانی (Continuous Improvement): اقدامات بهبود، درس‌آموخته‌ها و یادگیری سازمانی',
        ],
        stepsFa: [
          '۱. وارد تب «فرماندهی و پایش مدیران» و سپس زیرتب «مدل بلوغ ۵ سطحی PSM» شوید.',
          '۲. روی دکمه «+ ثبت دوره ممیزی بلوغ جدید» کلیک کنید و امتیاز هر یک از ۵ بُعد (طراحی، استقرار، عملیات روزمره، پایش و بهبود مستمر) را ثبت نمایید.',
          '۳. سیستم به صورت خودکار سطح بلوغ نهایی مجتمع را در یکی از ۵ سطح استاندارد محاسبه و روی نمودار نمایش می‌دهد: سطح ۱ (اولیه و واکنشی - Initial)، سطح ۲ (در حال شکل‌گیری - Developing)، سطح ۳ (تعریف‌شده و مستقر - Defined)، سطح ۴ (مدیریت‌شده کمی - Managed) و سطح ۵ (بهینه‌شده و فرهنگ پایدار - Optimizing).',
        ],
        systemRuleOrNoteFa:
          'شرط عبور به تحویل نهایی: برای تصویب دروازه ششم (G6) و تحویل رسمی سیستم، احراز حداقل «سطح بلوغ ۳ (تعریف‌شده / Defined)» الزامی است.',
      },
    ],
  },
  {
    id: 'sec-11-ai-audit',
    sectionNumber: 11,
    stepBadgeFa: 'بخش یازدهم (گام ششم - ب)',
    titleFa: 'هوش مصنوعی محلی PSM و گزارش سوابق ممیزی (Audit Trail)',
    titleEn: 'Local AI Diagnostic Engine & Immutable Audit Trail',
    relatedMainZoneFa: 'تب ۵: اسناد، اقدام و تحویل ← هوش مصنوعی محلی و Audit Log',
    icon: Bot,
    overviewFa:
      'در زیرتب «هوش مصنوعی محلی و Audit Log»، موتور تحلیلگر هوشمند محلی بدون وابستگی به اینترنت، داده‌های واقعی ثبت‌شده در پروژه را ممیزی کرده و در کنار آن، تاریخچه تغییرناپذیر تمام اقدامات کاربران نگهداری می‌شود.',
    primarySubTab: 'ai-audit',
    primaryButtonLabelFa: 'ورود به هوش مصنوعی محلی و Audit Log',
    subTopics: [
      {
        id: 'sec-11-ai-and-logs',
        stepLabel: '۱۱-۱',
        titleFa: 'قابلیت‌های تحلیلگر هوشمند محلی و ردیابی کامل فعالیت کاربران (Audit Trail)',
        titleEn: 'Hidden Gap Detection, Unit Risk Analysis & Audit Logs',
        statusBadge: 'ACTIVE',
        targetSubTab: 'ai-audit',
        targetButtonLabelFa: 'ورود به هوش مصنوعی محلی و گزارش ممیزی',
        summaryFa:
          'این بخش دو ابزار نظارتی و تحلیلی مهم را در یک صفحه در اختیار تیم پروژه و ممیزان قرار می‌دهد:',
        stepsFa: [
          '۱. شناسایی نقاط ضعف و شکاف‌های پنهان: تشخیص عناصری که ارزیابی شده‌اند اما برنامه WBS، سند مصوب یا اقدام CAPA متناظر ندارند.',
          '۲. تحلیل وضعیت واحدهای عملیاتی دارای ریسک بالاتر: رتبه‌بندی واحدها بر اساس تجمع شکاف‌های بحرانی، تأخیرهای اجرایی و نواقص تجهیزات SCE.',
          '۳. ارائه پیشنهادهای اصلاحی هوشمند: تولید فهرست اولویت‌بندی‌شده اقدامات پیشنهادی برای ارتقای سطح بلوغ و آمادگی عبور از دروازه‌ها به همراه قابلیت چاپ گزارش رسمی.',
          '۴. گزارش سوابق ممیزی (Audit Trail): ثبت خودکار و تغییرناپذیر تمام اقدامات کاربران (ایجاد، ویرایش، تصویب دروازه، تغییر نسخه سند، بستن CAPA) به همراه نام کاربر، تاریخ و ساعت دقیق جهت ردیابی کامل ممیزی.',
        ],
      },
    ],
  },
  {
    id: 'sec-12-handover',
    sectionNumber: 12,
    stepBadgeFa: 'بخش دوازدهم (گام ششم - ج)',
    titleFa: 'تحویل نهایی پروژه، دروازه ششم (G6) و ورود به فاز نگهداشت مستمر',
    titleEn: 'Final Project Handover, Gate G6 & Operational Sustainment',
    relatedMainZoneFa: 'تب ۵: اسناد، اقدام و تحویل ← تحویل نهایی و نگهداشت',
    relatedGateKey: 'G6',
    icon: FileCheck2,
    overviewFa:
      'در آخرین مرحله از چرخه استقرار، سیستم به صورت خودکار و برخط وضعیت آمادگی پروژه برای تحویل نهایی را بررسی می‌کند و پس از تصویب دروازه G6 و ثبت امضاهای رسمی، پروژه وارد فاز «سیستم فعال و مستقر (ACTIVE_SYSTEM)» و نگهداشت مستمر می‌شود.',
    primarySubTab: 'handover',
    primaryButtonLabelFa: 'ورود به تحویل نهایی و نگهداشت',
    subTopics: [
      {
        id: 'sec-12-handover-steps',
        stepLabel: '۱۲-۱',
        titleFa: 'چک‌لیست آمادگی تحویل، تصویب دروازه G6 و امضای ارکان مجتمع',
        titleEn: 'Live Handover Readiness Checklist, Gate G6 & Executive Sign-off',
        statusBadge: 'ACTIVE',
        targetSubTab: 'handover',
        targetButtonLabelFa: 'ورود به تحویل نهایی و نگهداشت',
        summaryFa:
          'در زیرتب «تحویل نهایی و نگهداشت»، تمام پیش‌نیازهای فنی و حاکمیتی به صورت زنده از داده‌های پایگاه داده کنترل می‌شوند:',
        requiredInputsFa: [
          'بسته شدن ۱۰۰٪ شکاف‌های بحرانی (Critical Gaps)',
          'تصویب و تکمیل اسناد و مدارک موردنیاز در بانک اسناد PSM',
          'صحه‌گذاری مستقل اثربخشی اقدامات اصلاحی و پیشگیرانه (CAPA)',
          'دستیابی به سطح بلوغ هدف تعیین‌شده (حداقل سطح ۳: Defined)',
          'تصویب تمامی دروازه‌های کنترلی G1 تا G6',
          'ثبت تأییدیه رسمی مدیر پروژه، مدیر HSE و مدیر مجتمع و برنامه نگهداشت دوره‌ای',
        ],
        stepsFa: [
          '۱. وارد تب «اسناد، اقدام و تحویل» و سپس زیرتب «تحویل نهایی و نگهداشت» شوید.',
          '۲. وضعیت برخط چک‌لیست آمادگی تحویل (بسته شدن شکاف‌های بحرانی، تصویب اسناد، صحه‌گذاری CAPAها و احراز سطح بلوغ هدف) را بررسی کنید.',
          '۳. پس از سبز شدن پیش‌نیازها، وارد زیرتب «دروازه‌های کنترلی (Stage-Gates)» شوید و دروازه ششم (G6: تصویب نهایی و تحویل پروژه استقرار PSM) را تصویب کنید.',
          '۴. در صفحه «تحویل نهایی و نگهداشت»، تأییدیه رسمی مدیر پروژه، مدیر HSE و مدیر مجتمع را ثبت نمایید.',
        ],
        systemRuleOrNoteFa:
          'نتیجه نهایی: پس از تکمیل و تأیید مراحل فوق، وضعیت پروژه به «سیستم فعال و مستقر (ACTIVE_SYSTEM)» تغییر یافته و پروژه وارد مرحله نگهداشت، ممیزی ادواری و بهبود مستمر خواهد شد.',
      },
    ],
  },
];

export const SUMMARY_ROADMAP_ROWS = [
  {
    step: 'گام اول',
    activityFa: 'تعریف پروژه، منشور ۶ مرحله‌ای و ثبت تجهیزات بحرانی مشمول (SCE / PSI)',
    gate: 'G1',
    zoneFa: 'تب ۳: برنامه‌ریزی و دارایی‌ها',
    targetSubTab: 'project' as PsmSubTabKey,
  },
  {
    step: 'گام دوم',
    activityFa: 'ارزیابی اولیه (20 CCPS / 14 OSHA)، ماتریس تطبیق N:M و تحلیل شکاف (RPN)',
    gate: 'G2',
    zoneFa: 'تب ۴: ارزیابی و انطباق',
    targetSubTab: 'assessment' as PsmSubTabKey,
  },
  {
    step: 'گام سوم',
    activityFa: 'برنامه‌ریزی اجرایی، تدوین بسته‌های کاری WBS، مسیر بحرانی و نمودار گانت',
    gate: 'G3',
    zoneFa: 'تب ۳: برنامه‌ریزی و دارایی‌ها',
    targetSubTab: 'wbs-gantt' as PsmSubTabKey,
  },
  {
    step: 'گام چهارم',
    activityFa: 'تکمیل ۱۴ زیرماژول مطالعات تخصصی، تصویب بانک اسناد و بستن ۸ مرحله‌ای CAPA',
    gate: 'G4 و G5',
    zoneFa: 'تب‌های ۴ و ۵',
    targetSubTab: 'studies' as PsmSubTabKey,
  },
  {
    step: 'گام پنجم',
    activityFa: 'پایش مستمر کارتابل ۸ دسته‌ای «کارهای من» و داشبورد مدیریتی (EVM / هشدارها)',
    gate: 'پایش مستمر',
    zoneFa: 'تب‌های ۱ و ۲',
    targetSubTab: 'dashboard' as PsmSubTabKey,
  },
  {
    step: 'گام ششم',
    activityFa: 'ممیزی مدل بلوغ ۵ سطحی، تحلیل هوش مصنوعی محلی و تحویل نهایی سیستم',
    gate: 'G6',
    zoneFa: 'تب‌های ۲ و ۵',
    targetSubTab: 'handover' as PsmSubTabKey,
  },
];

const GATE_GUIDE_MAP: Array<{
  gateKey: string;
  stepTitleFa: string;
  shortDescFa: string;
  sectionId: string;
  targetSubTab: PsmSubTabKey;
}> = [
  {
    gateKey: 'G1',
    stepTitleFa: 'گام ۱: منشور، دامنه و دارایی‌ها',
    shortDescFa: 'تعریف پروژه، تجهیزات SCE و ارزیابی پایه',
    sectionId: 'sec-2-project-assets',
    targetSubTab: 'project',
  },
  {
    gateKey: 'G2',
    stepTitleFa: 'گام ۲: ارزیابی و تحلیل شکاف',
    shortDescFa: 'ماتریس 20 CCPS / 14 OSHA و امتیاز RPN',
    sectionId: 'sec-3-assessment-gap',
    targetSubTab: 'gap-analysis',
  },
  {
    gateKey: 'G3',
    stepTitleFa: 'گام ۳: برنامه اجرایی و گانت',
    shortDescFa: 'ساختار شکست کار (WBS) و مسیر بحرانی',
    sectionId: 'sec-4-wbs-gantt',
    targetSubTab: 'wbs-gantt',
  },
  {
    gateKey: 'G4',
    stepTitleFa: 'گام ۴: مطالعات و بانک اسناد',
    shortDescFa: '۱۴ زیرماژول فنی و چرخه ۴ مرحله‌ای اسناد',
    sectionId: 'sec-5-studies',
    targetSubTab: 'studies',
  },
  {
    gateKey: 'G5',
    stepTitleFa: 'گام ۵: اقدامات CAPA و پایش',
    shortDescFa: 'گردش کار ۸ مرحله‌ای CAPA و صحه‌گذاری',
    sectionId: 'sec-7-capa',
    targetSubTab: 'capa',
  },
  {
    gateKey: 'G6',
    stepTitleFa: 'گام ۶: ممیزی بلوغ و تحویل نهایی',
    shortDescFa: 'مدل بلوغ ۵ سطحی و امضای تحویل سیستم',
    sectionId: 'sec-12-handover',
    targetSubTab: 'handover',
  },
];

type SubsystemCategoryFilter = 'ALL' | 'RISK_PHA' | 'OPS_MI_MOC' | 'GOV_EMERGENCY';

const SUBSYSTEM_CATEGORY_GROUPS: Record<SubsystemCategoryFilter, { labelFa: string; keys: string[] }> = {
  ALL: { labelFa: 'همه ۱۴ زیرماژول', keys: [] },
  RISK_PHA: {
    labelFa: 'شناسایی خطر و ریسک (۶ مورد)',
    keys: ['PSI', 'PHA', 'HAZOP', 'HAZID', 'LOPA', 'BOW_TIE'],
  },
  OPS_MI_MOC: {
    labelFa: 'عملیات، تغییر و یکپارچگی (۴ مورد)',
    keys: ['OPERATING_PROCEDURES', 'MI', 'MOC', 'PSSR'],
  },
  GOV_EMERGENCY: {
    labelFa: 'پیمانکاران، آموزش و حوادث (۴ مورد)',
    keys: ['CONTRACTORS', 'TRAINING', 'INCIDENT_INVESTIGATION', 'EMERGENCY_PLANNING'],
  },
};

function GuideSubTopicCard({
  subTopic,
  onNavigateSubTab,
  onDirectNavigate,
}: {
  subTopic: GuideSubTopic;
  onNavigateSubTab: (subTab: PsmSubTabKey) => void;
  onDirectNavigate: (subTab: PsmSubTabKey, deepLink?: PsmDeepLinkAction) => void;
}) {
  const hasRequiredInputs = Boolean(subTopic.requiredInputsFa && subTopic.requiredInputsFa.length > 0);

  return (
    <div className="py-5 first:pt-2 last:pb-1 space-y-4">
      {/* Sub-topic Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
              گام {subTopic.stepLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px]">{subTopic.titleEn}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {subTopic.statusBadge === 'ACTIVE' ? 'فعال در نرم‌افزار' : 'در انتظار پیاده‌سازی'}
            </span>
          </div>
          <h4 className="text-sm sm:text-[15px] font-black text-slate-900 dark:text-white leading-snug">
            {subTopic.titleFa}
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {subTopic.deepLinkAction && (
            <button
              type="button"
              onClick={() => onDirectNavigate(subTopic.targetSubTab, subTopic.deepLinkAction)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{subTopic.deepLinkAction.buttonLabelFa}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigateSubTab(subTopic.targetSubTab)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-blue-600 hover:border-blue-600 hover:text-white dark:bg-slate-800/80 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{subTopic.targetButtonLabelFa}</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Lead Summary */}
      <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
        {subTopic.summaryFa}
      </p>

      {/* Architectural 2-Column Split: Operational Timeline Steps + Required Form Inputs */}
      <div
        className={`grid grid-cols-1 ${
          hasRequiredInputs ? 'xl:grid-cols-12' : 'xl:grid-cols-1'
        } gap-5 items-start pt-1`}
      >
        {/* Operational Steps Timeline */}
        <div className={hasRequiredInputs ? 'xl:col-span-7 space-y-2.5' : 'space-y-2.5'}>
          <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>ترتیب گام‌به‌گام انجام فعالیت در نرم‌افزار:</span>
          </div>

          <ol className="relative border-r border-slate-200 dark:border-slate-700/80 mr-2.5 pr-4 space-y-2.5">
            {subTopic.stepsFa.map((stepText, idx) => (
              <li key={idx} className="relative text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">
                <span className="absolute -right-[23px] top-1 w-3.5 h-3.5 rounded-full bg-blue-50 dark:bg-slate-800 border-2 border-blue-600 dark:border-blue-400" />
                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  {stepText}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Required Form Inputs Checklist */}
        {hasRequiredInputs && (
          <div className="xl:col-span-5 p-4 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/70 pb-2">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>فیلدها و اطلاعات موردنیاز در فرم</span>
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {subTopic.requiredInputsFa?.length} مورد
              </span>
            </div>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {subTopic.requiredInputsFa?.map((inp, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0 mt-1" />
                  <span>{inp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* System Rule / Next Gate Callout */}
      {(subTopic.systemRuleOrNoteFa || subTopic.afterActionFa) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {subTopic.systemRuleOrNoteFa && (
            <div
              className={`p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200/70 dark:border-blue-900/50 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5 ${
                !subTopic.afterActionFa ? 'md:col-span-2' : ''
              }`}
            >
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{subTopic.systemRuleOrNoteFa}</p>
            </div>
          )}

          {subTopic.afterActionFa && (
            <div
              className={`p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 text-xs text-slate-800 dark:text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                !subTopic.systemRuleOrNoteFa ? 'md:col-span-2' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{subTopic.afterActionFa}</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateSubTab('stage-gates')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shrink-0 cursor-pointer whitespace-nowrap self-end sm:self-center transition-colors"
              >
                دروازه‌های کنترلی ←
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function PsmComprehensiveGuide({
  activeProject,
  projectData,
  onNavigateSubTab,
  onExecuteDeepLink,
}: PsmComprehensiveGuideProps) {
  const topRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [readingMode, setReadingMode] = useState<'ALL' | 'FOCUSED'>('ALL');
  const [focusedSectionIndex, setFocusedSectionIndex] = useState<number>(0);
  const [subsystemCategory, setSubsystemCategory] = useState<SubsystemCategoryFilter>('ALL');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    PSM_GUIDE_SECTIONS.forEach((s) => {
      initial[s.id] = true;
    });
    return initial;
  });

  // Educational reading progress (strictly separated from real project operational progress)
  const [readSectionIds, setReadSectionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(GUIDE_READ_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(GUIDE_READ_STORAGE_KEY, JSON.stringify(readSectionIds));
    } catch {
      // ignore storage errors
    }
  }, [readSectionIds]);

  const toggleReadSection = (sectionId: string) => {
    setReadSectionIds((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  const toggleExpandSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const setAllSectionsExpanded = (expanded: boolean) => {
    const next: Record<string, boolean> = {};
    PSM_GUIDE_SECTIONS.forEach((s) => {
      next[s.id] = expanded;
    });
    setExpandedSections(next);
  };

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const navigateToSection = (secId: string) => {
    const idx = PSM_GUIDE_SECTIONS.findIndex((s) => s.id === secId);
    if (readingMode === 'FOCUSED' && idx !== -1) {
      setFocusedSectionIndex(idx);
      scrollToTop();
      return;
    }
    setExpandedSections((prev) => ({ ...prev, [secId]: true }));
    setTimeout(() => {
      const el = document.getElementById(`psm-guide-${secId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Determine where the active project currently stands (Live operational stage)
  const currentProjectStageInfo = useMemo(() => {
    if (!activeProject) {
      return {
        stepNumber: 1,
        labelFa: 'گام اول: نیاز به تعریف منشور پروژه استقرار PSM',
        gateKey: 'G1',
        recommendedSectionId: 'sec-2-project-assets',
        targetSubTab: 'project' as PsmSubTabKey,
        approvedGateKeys: [] as string[],
      };
    }
    const gates = projectData.stageGates || [];
    const approvedGateKeys = gates
      .filter((g: any) => g.status === 'APPROVED')
      .map((g: any) => g.gateKey || g.key);
    const firstPendingGate = gates.find((g: any) => g.status !== 'APPROVED');
    const gateKey = firstPendingGate?.gateKey || firstPendingGate?.key || 'G6';

    const matchedGateMeta = GATE_GUIDE_MAP.find((gm) => gm.gateKey === gateKey) || GATE_GUIDE_MAP[0];

    return {
      stepNumber: GATE_GUIDE_MAP.findIndex((gm) => gm.gateKey === gateKey) + 1,
      labelFa: `${matchedGateMeta.stepTitleFa} — ${matchedGateMeta.shortDescFa}`,
      gateKey,
      recommendedSectionId: matchedGateMeta.sectionId,
      targetSubTab: matchedGateMeta.targetSubTab,
      approvedGateKeys,
    };
  }, [activeProject, projectData.stageGates]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    if (readingMode === 'FOCUSED' && !normalizedQuery) {
      const target = PSM_GUIDE_SECTIONS[focusedSectionIndex] || PSM_GUIDE_SECTIONS[0];
      return [target];
    }

    return PSM_GUIDE_SECTIONS.filter((sec) => {
      if (!normalizedQuery) return true;

      const secHaystack = [
        sec.titleFa,
        sec.titleEn,
        sec.overviewFa,
        sec.relatedMainZoneFa,
        sec.relatedGateKey || '',
        ...sec.subTopics.flatMap((st) => [
          st.titleFa,
          st.titleEn,
          st.summaryFa,
          ...(st.requiredInputsFa || []),
          ...st.stepsFa,
          st.systemRuleOrNoteFa || '',
          st.afterActionFa || '',
        ]),
      ]
        .join(' ')
        .toLowerCase();

      if (sec.id === 'sec-5-studies') {
        const subMatch = PSM_SPECIALIZED_SUBSYSTEMS.some((sub) =>
          `${sub.key} ${sub.titleFa} ${sub.titleEn} ${sub.descriptionFa} ${sub.defaultTrackingPath}`
            .toLowerCase()
            .includes(normalizedQuery)
        );
        if (subMatch) return true;
      }

      return secHaystack.includes(normalizedQuery);
    });
  }, [readingMode, focusedSectionIndex, normalizedQuery]);

  const filteredSubsystems = useMemo(() => {
    const categoryKeys = SUBSYSTEM_CATEGORY_GROUPS[subsystemCategory].keys;
    return PSM_SPECIALIZED_SUBSYSTEMS.filter((sub) => {
      if (categoryKeys.length > 0 && !categoryKeys.includes(sub.key)) return false;
      if (!normalizedQuery) return true;
      return `${sub.key} ${sub.titleFa} ${sub.titleEn} ${sub.descriptionFa} ${sub.defaultTrackingPath} ${sub.ccpsElements.join(' ')} ${sub.oshaClauses.join(' ')}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [subsystemCategory, normalizedQuery]);

  const readingProgressPct = Math.round((readSectionIds.length / PSM_GUIDE_SECTIONS.length) * 100);

  const handleDirectNavigate = (subTab: PsmSubTabKey, deepLink?: PsmDeepLinkAction) => {
    if (deepLink && onExecuteDeepLink) {
      onExecuteDeepLink(deepLink);
    } else {
      onNavigateSubTab(subTab);
    }
  };

  return (
    <div ref={topRef} className="space-y-6 text-right font-sans" dir="rtl">
      {/* =====================================================================
          ARCHITECTURAL HERO & INTERACTIVE 6-GATE ROADMAP RIBBON
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                مرجع رسمی آموزش و راهبری استقرار ایمنی فرایند
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">12 فصل عملیاتی</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">CCPS RBPS (20) / OSHA 1910.119 (14)</span>
            </div>

            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              راهنمای جامع کاربری و مسیر گام‌به‌گام استقرار PSM
            </h2>

            <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed">
              نقشه راه عملیاتی از تعریف منشور پروژه و ثبت تجهیزات بحرانی (SCE) تا ارزیابی شکاف‌ها، برنامه‌ریزی WBS، تکمیل ۱۴ زیرماژول مهندسی، صحه‌گذاری CAPA و تحویل نهایی سیستم همراه با انتقال مستقیم به فرم‌های اجرایی.
            </p>
          </div>

          {/* Dual Status Strip: Live Project Gate vs Personal Reading Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0 xl:w-[460px]">
            {/* 1. Live Operational Stage */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">وضعیت جاری پروژه فعال</span>
                <span className="font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
                  دروازه {currentProjectStageInfo.gateKey}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {currentProjectStageInfo.labelFa}
              </p>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-700/70 text-[11px]">
                <button
                  type="button"
                  onClick={() => navigateToSection(currentProjectStageInfo.recommendedSectionId)}
                  className="font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  مطالعه فصل مرتبط ↓
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateSubTab(currentProjectStageInfo.targetSubTab)}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  ورود به زیرتب اجرایی ←
                </button>
              </div>
            </div>

            {/* 2. Personal Study Progress */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">پیشرفت مطالعه راهنما</span>
                <span className="font-mono tabular-nums font-black text-emerald-600 dark:text-emerald-400">
                  {readSectionIds.length} / {PSM_GUIDE_SECTIONS.length} ({readingProgressPct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-transform duration-200 origin-right"
                  style={{ width: `${readingProgressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <span>پیگیری شخصی (مستقل از پروژه)</span>
                {readSectionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setReadSectionIds([])}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    بازنشانی
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Interactive 6-Gate Stepper Bar (G1 to G6) */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              نقشه تعاملی ۶ گام و دروازه کنترلی استقرار (با کلیک روی هر گام به فصل مربوطه منتقل شوید):
            </span>
            <span className="font-mono tabular-nums text-[11px]">G1 → G6 Stage-Gate Governance</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            {GATE_GUIDE_MAP.map((item) => {
              const isApproved = currentProjectStageInfo.approvedGateKeys.includes(item.gateKey);
              const isCurrent = currentProjectStageInfo.gateKey === item.gateKey;
              return (
                <button
                  key={item.gateKey}
                  type="button"
                  onClick={() => navigateToSection(item.sectionId)}
                  className={`p-3 rounded-xl border text-right transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isCurrent
                      ? 'bg-blue-600/10 border-blue-500/60 dark:bg-blue-950/40'
                      : isApproved
                      ? 'bg-emerald-500/5 border-emerald-500/30 hover:bg-emerald-500/10'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-mono tabular-nums text-xs font-black ${
                        isCurrent
                          ? 'text-blue-600 dark:text-blue-400'
                          : isApproved
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.gateKey}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isApproved ? 'تصویب‌شده' : isCurrent ? 'مرحله جاری' : 'در انتظار'}
                    </span>
                  </div>
                  <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                    {item.stepTitleFa}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {item.shortDescFa}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & View Mode Controls Toolbar */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو در ۱۲ فصل و ۱۴ زیرماژول (مثلاً: منشور پروژه، HAZOP، LOPA، RPN، CAPA، بلوغ، EVM)..."
              className="w-full pr-10 pl-20 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                پاک کردن
              </button>
            )}
          </div>

          {/* Segmented Mode Controls & Expand/Collapse */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setReadingMode('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  readingMode === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                نمای یکپارچه (۱۲ فصل)
              </button>
              <button
                type="button"
                onClick={() => setReadingMode('FOCUSED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  readingMode === 'FOCUSED'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                نمای مطالعه فصلی (گام‌به‌گام)
              </button>
            </div>

            {readingMode === 'ALL' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllSectionsExpanded(true)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  باز کردن همه
                </button>
                <button
                  type="button"
                  onClick={() => setAllSectionsExpanded(false)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  بستن همه
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN WORKSPACE: STICKY CHAPTER INDEX + ARCHITECTURAL CHAPTER PANELS
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sticky Chapter Index Sidebar */}
        <aside className="lg:col-span-3 lg:sticky lg:top-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>فهرست ۱۲ فصل راهنما</span>
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-400">
              {readSectionIds.length}/12
            </span>
          </div>

          <nav className="space-y-1 max-h-[62vh] overflow-y-auto pr-0.5">
            {PSM_GUIDE_SECTIONS.map((sec, idx) => {
              const isRead = readSectionIds.includes(sec.id);
              const isCurrentProjectStep = currentProjectStageInfo.recommendedSectionId === sec.id;
              const isSelectedInFocusedMode = readingMode === 'FOCUSED' && focusedSectionIndex === idx;

              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    if (readingMode === 'FOCUSED') {
                      setFocusedSectionIndex(idx);
                      scrollToTop();
                    } else {
                      navigateToSection(sec.id);
                    }
                  }}
                  className={`w-full text-right p-2.5 rounded-xl text-xs transition-colors flex items-start justify-between gap-2 cursor-pointer ${
                    isSelectedInFocusedMode || isCurrentProjectStep
                      ? 'bg-blue-600/10 text-blue-700 dark:text-blue-300 font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300 font-bold'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-mono tabular-nums text-[10px] font-black shrink-0 mt-0.5 ${
                        isRead
                          ? 'bg-emerald-600 text-white'
                          : isSelectedInFocusedMode || isCurrentProjectStep
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sec.sectionNumber}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate">{sec.titleFa}</div>
                      <div className="text-[10.5px] text-slate-400 font-normal truncate mt-0.5">
                        {sec.stepBadgeFa}
                        {sec.relatedGateKey ? ` · دروازه ${sec.relatedGateKey}` : ''}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('psm-guide-summary-table');
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="w-full text-right p-2.5 rounded-xl text-xs font-black text-teal-700 dark:text-teal-300 bg-teal-500/10 hover:bg-teal-500/15 transition-colors flex items-center justify-between gap-2 cursor-pointer mt-2"
            >
              <span>جدول جمع‌بندی و انطباق</span>
              <ShieldCheck className="w-4 h-4 shrink-0" />
            </button>
          </nav>

          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => onNavigateSubTab('command-center')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ورود به راهبر هوشمند PSM</span>
            </button>
          </div>
        </aside>

        {/* Main Content Column */}
        <div className="lg:col-span-9 space-y-5">
          {visibleSections.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
              <HelpCircle className="w-9 h-9 text-slate-400 mx-auto" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                موردی مطابق با عبارت «{searchQuery}» در راهنما یافت نشد
              </h3>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                نمایش کامل تمام فصل‌های راهنما
              </button>
            </div>
          ) : (
            visibleSections.map((sec) => {
              const SectionIcon = sec.icon;
              const isExpanded =
                readingMode === 'FOCUSED' || Boolean(expandedSections[sec.id] || normalizedQuery);
              const isRead = readSectionIds.includes(sec.id);

              return (
                <section
                  key={sec.id}
                  id={`psm-guide-${sec.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden"
                >
                  {/* Chapter Header */}
                  <div className="p-5 sm:p-6 bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div
                      onClick={() => {
                        if (readingMode === 'ALL') toggleExpandSection(sec.id);
                      }}
                      className={`flex items-start gap-3.5 flex-1 ${
                        readingMode === 'ALL' ? 'cursor-pointer' : ''
                      }`}
                    >
                      <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono tabular-nums font-black text-base shrink-0">
                        {sec.sectionNumber < 10 ? `0${sec.sectionNumber}` : sec.sectionNumber}
                      </div>

                      <div className="space-y-1">
                        {/* Unboxed Editorial Metadata Line (Zero-Pill Discipline) */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {sec.stepBadgeFa}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{sec.relatedMainZoneFa}</span>
                          {sec.relatedGateKey && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400">
                                دروازه {sec.relatedGateKey}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[11px]">{sec.titleEn}</span>
                        </div>

                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <SectionIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>{sec.titleFa}</span>
                        </h3>
                      </div>
                    </div>

                    {/* Chapter Primary Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleReadSection(sec.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isRead
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isRead ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{isRead ? 'مطالعه‌شده' : 'ثبت مطالعه'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onNavigateSubTab(sec.primarySubTab)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <span>ورود به این بخش</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>

                      {readingMode === 'ALL' && (
                        <button
                          type="button"
                          onClick={() => toggleExpandSection(sec.id)}
                          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          aria-label="باز و بسته کردن فصل"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chapter Content Body */}
                  {isExpanded && (
                    <div className="p-5 sm:p-6 space-y-5">
                      {/* Chapter Lead Overview */}
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed pb-3 border-b border-slate-200/80 dark:border-slate-800">
                        {sec.overviewFa}
                      </p>

                      {/* SubTopics Architectural Dividers (No Nested Card Boxes) */}
                      <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                        {sec.subTopics.map((st) => (
                          <GuideSubTopicCard
                            key={st.id}
                            subTopic={st}
                            onNavigateSubTab={onNavigateSubTab}
                            onDirectNavigate={handleDirectNavigate}
                          />
                        ))}
                      </div>

                      {/* Section 5 Special Interactive Catalog: All 14 Specialized PSM Subsystems */}
                      {sec.id === 'sec-5-studies' && (
                        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                <span>کاتالوگ تعاملی ۱۴ زیرماژول تخصصی مهندسی ایمنی فرایند (Studies)</span>
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                فیلتر بر اساس خانواده مهندسی و ورود مستقیم به فرم ثبت پرونده هر زیرماژول
                              </p>
                            </div>

                            {/* Category Segmented Filter */}
                            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                              {(Object.keys(SUBSYSTEM_CATEGORY_GROUPS) as SubsystemCategoryFilter[]).map(
                                (catKey) => (
                                  <button
                                    key={catKey}
                                    type="button"
                                    onClick={() => setSubsystemCategory(catKey)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                      subsystemCategory === catKey
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                  >
                                    {SUBSYSTEM_CATEGORY_GROUPS[catKey].labelFa}
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {filteredSubsystems.map((sub, idx) => (
                              <div
                                key={sub.key}
                                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-blue-500/40 transition-colors flex flex-col justify-between gap-3"
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                        <span className="font-mono tabular-nums font-black text-blue-600 dark:text-blue-400">
                                          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}. {sub.key}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span className="font-mono text-[11px]">{sub.titleEn}</span>
                                      </div>
                                      <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                                        {sub.titleFa}
                                      </h5>
                                    </div>
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                      فعال
                                    </span>
                                  </div>

                                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {sub.descriptionFa}
                                  </p>

                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      چرخه گردش کار:{' '}
                                    </span>
                                    <span>{sub.defaultTrackingPath}</span>
                                  </div>
                                </div>

                                <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                                  <span className="text-[10.5px] font-mono tabular-nums text-slate-400 truncate">
                                    {sub.ccpsElements.join(', ')} · {sub.oshaClauses.join(', ')}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onNavigateSubTab('studies')}
                                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-blue-600 hover:text-white border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                                  >
                                    <span>ورود به این بخش</span>
                                    <ArrowLeft className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Focused Mode Chapter Stepper Footer */}
                      {readingMode === 'FOCUSED' && (
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            disabled={focusedSectionIndex === 0}
                            onClick={() => {
                              setFocusedSectionIndex((i) => Math.max(0, i - 1));
                              scrollToTop();
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                          >
                            → فصل قبلی
                          </button>
                          <span className="text-xs font-mono tabular-nums text-slate-500">
                            فصل {focusedSectionIndex + 1} از {PSM_GUIDE_SECTIONS.length}
                          </span>
                          <button
                            type="button"
                            disabled={focusedSectionIndex === PSM_GUIDE_SECTIONS.length - 1}
                            onClick={() => {
                              setFocusedSectionIndex((i) =>
                                Math.min(PSM_GUIDE_SECTIONS.length - 1, i + 1)
                              );
                              scrollToTop();
                            }}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-40 cursor-pointer whitespace-nowrap"
                          >
                            فصل بعدی ←
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })
          )}

          {/* =====================================================================
              SUMMARY ROADMAP TABLE & SOFTWARE AUDIT VERIFICATION
             ===================================================================== */}
          <div
            id="psm-guide-summary-table"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <span>جدول جمع‌بندی مسیر ۶ گانه استقرار PSM و تطبیق فنی با نرم‌افزار</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  خلاصه ترتیب انجام مراحل، دروازه‌های کنترلی G1 تا G6 و دسترسی مستقیم به هر زیرماژول
                </p>
              </div>
              <button
                type="button"
                onClick={scrollToTop}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer self-start sm:self-center whitespace-nowrap shrink-0"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>بازگشت به ابتدای راهنما</span>
              </button>
            </div>

            {/* 6-Step Summary Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black">
                    <th className="py-3 px-3.5 whitespace-nowrap">مرحله</th>
                    <th className="py-3 px-3.5">فعالیت اصلی در چرخه استقرار PSM</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">تب اصلی مرتبط</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">دروازه کنترلی</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">وضعیت</th>
                    <th className="py-3 px-3.5 text-left whitespace-nowrap">دسترسی مستقیم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {SUMMARY_ROADMAP_ROWS.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3.5 font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {row.step}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                        {row.activityFa}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {row.zoneFa}
                      </td>
                      <td className="py-3 px-3.5 font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">
                        {row.gate}
                      </td>
                      <td className="py-3 px-3.5 text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                        فعال و پیاده‌سازی‌شده
                      </td>
                      <td className="py-3 px-3.5 text-left whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigateSubTab(row.targetSubTab)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>ورود به این بخش</span>
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Software Audit & Verification Notes */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>جدول تطبیق فنی محتوای راهنما با منطق واقعی نرم‌افزار (ممیزی نسخه جاری HSECORE):</span>
              </div>
              <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 list-disc list-inside leading-relaxed">
                <li>
                  <span className="font-bold">فهرست ۱۴ زیرماژول تخصصی (Studies):</span> هر ۱۴ زیرماژول (`PSI`, `PHA`, `HAZOP`, `HAZID`, `LOPA`, `BOW_TIE`, `OPERATING_PROCEDURES`, `MI`, `MOC`, `PSSR`, `CONTRACTORS`, `TRAINING`, `INCIDENT_INVESTIGATION`, `EMERGENCY_PLANNING`) در کاتالوگ استاندارد و زیرتب `studies` به صورت کامل فعال و متصل به دیتابیس هستند.
                </li>
                <li>
                  <span className="font-bold">منطق محاسبه عدد اولویت ریسک (RPN):</span> در کد نرم‌افزار از حاصل‌ضرب «شدت (۱ تا ۵) × احتمال (۱ تا ۵) × ضریب بحران فرایندی (۱ تا ۵)» تا سقف ۱۲۵ محاسبه می‌شود (CRITICAL &ge; 40، HIGH &ge; 20، MEDIUM &ge; 10، LOW &lt; 10).
                </li>
                <li>
                  <span className="font-bold">منطق تفکیک پیشرفت واقعی و کاغذی:</span> اسناد در وضعیت پیش‌نویس (`DRAFT`) و اقدامات اصلاحی (`CAPA`) که هنوز مرحله ۷ (`صحه‌گذاری مستقل اثربخشی`) را طی نکرده‌اند، صرفاً پیشرفت کاغذی محسوب شده و در پیشرفت واقعی لحاظ نمی‌گردند.
                </li>
                <li>
                  <span className="font-bold">انطباق شرایط دروازه G1 و G2:</span> در موتور حاکمیت نرم‌افزار (`PSM_STAGE_GATES`)، دروازه `G1` علاوه بر تصویب منشور و دامنه، تکمیل ارزیابی پایه ۲۰ عنصر CCPS و ۱۴ بند OSHA را نیز کنترل می‌کند و دروازه `G2` ثبت کامل شکاف‌ها، تعیین سطح ریسک، مسئول و مهلت آن‌ها را صحه‌گذاری می‌نماید.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default PsmComprehensiveGuide;
