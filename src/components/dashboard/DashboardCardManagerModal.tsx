import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  Check, 
  Plus, 
  Sliders, 
  Activity, 
  Thermometer, 
  Droplets, 
  AlertTriangle, 
  ShieldAlert, 
  BarChart3, 
  Bell, 
  Clock, 
  FileCheck,
  HeartPulse,
  Flame,
  Search,
  Sparkles,
  Layers,
  Save,
  GraduationCap,
  AlertOctagon,
  FileCheck2,
  ClipboardCheck,
  Zap
} from 'lucide-react';
import { CardLayoutItem } from '../../hooks/useDashboardMetrics';

export interface DashboardCardDefinition {
  id: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  descriptionEn: string;
  category: 'kpi' | 'chart' | 'scada' | 'action';
  categoryFa: string;
  categoryEn: string;
  iconName: string;
  defaultColSpan: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 12;
  priority: 1 | 2 | 3;
}

export const DASHBOARD_AVAILABLE_CARDS: DashboardCardDefinition[] = [
  // Priority 1 - Critical / Vital Cards
  {
    id: 'kpi-incidents',
    titleFa: 'حوادث ۱۲ ماهه رولینگ',
    titleEn: 'Rolling 12M Incidents',
    descriptionFa: 'شمارش و تحلیل درصدی تغییرات حوادث کل سایت در ۱۲ ماه گذشته',
    descriptionEn: 'Count and percentage change of all site incidents over the past 12 months',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'ShieldAlert',
    defaultColSpan: 3,
    priority: 1,
  },
  {
    id: 'card-hsi-gauge',
    titleFa: 'کارت تخصصی شاخص استرس گرمایی (گیج HSI)',
    titleEn: 'Heat Stress Index Gauge Card',
    descriptionFa: 'گیج آنالوگ و دیجیتال اقلیمی مانیتورینگ استرس گرمایی (طراحی اصیل و ثابت)',
    descriptionEn: 'Analog and digital climatic heat stress index gauge (standard preserved design)',
    category: 'scada',
    categoryFa: 'پانل‌های پایش صنعتی و اقلیمی',
    categoryEn: 'Industrial & Climatic Panels',
    iconName: 'Thermometer',
    defaultColSpan: 4,
    priority: 1,
  },
  {
    id: 'kpi-permits',
    titleFa: 'پروانه‌های کار فعال و پرخطر (PTW)',
    titleEn: 'Active Work Permits (PTW)',
    descriptionFa: 'تعداد مجوزهای کار گرم، سرد، ارتفاع و فضای بسته در حال اجرا',
    descriptionEn: 'Active hot, cold, height, and confined space permits count',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'FileCheck',
    defaultColSpan: 3,
    priority: 1,
  },
  {
    id: 'kpi-anomalies-count',
    titleFa: 'گزارشات ناهنجاری و انحرافات باز',
    titleEn: 'Open Anomalies & Deviations',
    descriptionFa: 'تعداد پرونده‌های ناهنجاری، شرایط ناایمن و شبه‌حوادث نیازمند پیگیری',
    descriptionEn: 'Active unsafe condition and anomaly reports requiring action',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'AlertOctagon',
    defaultColSpan: 3,
    priority: 1,
  },
  {
    id: 'card-incident-chart',
    titleFa: 'نمودار جامع فراوانی و روند حوادث و TRIR',
    titleEn: 'Incident Occurrences & TRIR Trend Chart',
    descriptionFa: 'نمودار تعاملی با قابلیت شخصی‌سازی نوع (سطحی، ستونی، خطی)، بازه زمانی و شاخص‌ها',
    descriptionEn: 'Interactive chart with support for Area/Bar/Line types, horizons, and metrics',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'BarChart3',
    defaultColSpan: 8,
    priority: 1,
  },

  // Priority 2 - Strategic & Analytical Units
  {
    id: 'kpi-trir-target',
    titleFa: 'حد هدف مجاز TRIR',
    titleEn: 'Target TRIR Benchmark',
    descriptionFa: 'هدف عملکردی سالانه نرخ حوادث ثبت‌شده بر اساس استانداردهای بین‌المللی',
    descriptionEn: 'Annual benchmark for recordable incident rate according to standards',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'Activity',
    defaultColSpan: 3,
    priority: 2,
  },
  {
    id: 'kpi-training-rate',
    titleFa: 'نرخ قبولی و نفر-ساعت آموزش HSE',
    titleEn: 'Training Pass Rate & Hours',
    descriptionFa: 'درصد قبولی آزمون‌های مهارتی و کل نفر-ساعت آموزش پرسنل و پیمانکاران',
    descriptionEn: 'Training examination pass rate and total training man-hours',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'GraduationCap',
    defaultColSpan: 3,
    priority: 2,
  },
  {
    id: 'kpi-ptw-audit-rate',
    titleFa: 'ضریب انطباق ممیزی پروانه کار',
    titleEn: 'PTW Audit Compliance Rate',
    descriptionFa: 'درصد انطباق میدانی مجوزهای کار صادرشده با استانداردهای ایمنی',
    descriptionEn: 'Field audit compliance percentage for issued work permits',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'FileCheck2',
    defaultColSpan: 3,
    priority: 2,
  },
  {
    id: 'kpi-safety-inspection-rate',
    titleFa: 'نرخ انطباق چک‌لیست‌های ایمنی',
    titleEn: 'Safety Checklist Pass Rate',
    descriptionFa: 'درصد سلامت و قبولی چک‌لیست‌های فنی داربست، جرثقیل، برق و ماشین‌آلات',
    descriptionEn: 'Checklist compliance rate for scaffolding, cranes, and machines',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'ClipboardCheck',
    defaultColSpan: 3,
    priority: 2,
  },
  {
    id: 'kpi-safe-hours',
    titleFa: 'مجموع کارکرد بدون حادثه',
    titleEn: 'Safe Man-Hours Worked',
    descriptionFa: 'شمارنده نفر-ساعت کارکرد ایمن پرسنل و پیمانکاران در ۱۲ ماه اخیر',
    descriptionEn: 'Cumulative safe man-hours worked by employees and contractors',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'Clock',
    defaultColSpan: 3,
    priority: 2,
  },
  {
    id: 'card-training-chart',
    titleFa: 'نمودار مدیریت آموزش و توانمندسازی HSE',
    titleEn: 'HSE Training & Competency Chart',
    descriptionFa: 'تفکیک دوره‌های ایمنی عمومی، اطفاء حریق، امداد، PTW و ارگونومی',
    descriptionEn: 'Training courses breakdown by safety, firefighting, first aid & PTW',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'GraduationCap',
    defaultColSpan: 6,
    priority: 2,
  },
  {
    id: 'card-anomalies-chart',
    titleFa: 'نمودار گزارشات ناهنجاری و رفتارهای ناایمن',
    titleEn: 'Anomalies & Unsafe Acts Chart',
    descriptionFa: 'تحلیل آماری اعمال ناایمن، تخلفات فردی PPE، نقص تجهیزات و شبه‌حوادث',
    descriptionEn: 'Breakdown of unsafe acts, PPE violations, equipment defects & near misses',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'AlertOctagon',
    defaultColSpan: 6,
    priority: 2,
  },
  {
    id: 'card-ptw-audit-chart',
    titleFa: 'نمودار ممیزی پروانه کار و پایش انطباق',
    titleEn: 'PTW Audit & Compliance Chart',
    descriptionFa: 'پایش میدانی چک‌لیست‌های مجوز کار، امضاهای مجاز و انحرافات ممیزی',
    descriptionEn: 'Field permit audits & signature compliance tracking',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'FileCheck2',
    defaultColSpan: 6,
    priority: 2,
  },
  {
    id: 'card-safety-inspection-chart',
    titleFa: 'نمودار واحد ایمنی (چک‌لیست‌ها و بازرسی‌ها)',
    titleEn: 'Safety Checklists & Inspections Chart',
    descriptionFa: 'پایش چک‌لیست‌های داربست، جرثقیل، برق، ماشین‌آلات و ترانشه',
    descriptionEn: 'Scaffolding, crane, electrical & machine checklists tracking',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'ClipboardCheck',
    defaultColSpan: 6,
    priority: 2,
  },
  {
    id: 'card-fire-dept-chart',
    titleFa: 'نمودار واحد آتش‌نشانی و تجهیزات اطفاء',
    titleEn: 'Fire Department Assets & Readiness Chart',
    descriptionFa: 'تفکیک کپسول‌های CO2، پودری، فوم، هوزریل‌ها، هایدرانت‌ها و دتکتورها',
    descriptionEn: 'Fire extinguishers, hydrants, hoses, and detectors status',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'Flame',
    defaultColSpan: 6,
    priority: 2,
  },
  {
    id: 'card-health-chart',
    titleFa: 'نمودار واحد بهداشت و نتایج معاینات طب کار',
    titleEn: 'Health Unit Periodic Medical Exams Chart',
    descriptionFa: 'نمودار توزیع سلامت شغلی: متناسب، مشروط، نامتناسب با شغل و ادیومتری/اسپیرومتری',
    descriptionEn: 'Occupational health distribution: Fit, Conditional, Unfit',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'HeartPulse',
    defaultColSpan: 6,
    priority: 2,
  },
  {
    id: 'card-ptw-chart',
    titleFa: 'نمودار تفکیک پروانه‌های کار (PTW)',
    titleEn: 'Work Permits (PTW) Distribution Chart',
    descriptionFa: 'نمودار ستونی و دایره‌ای تفکیک پروانه‌های کار گرم، سرد، ارتفاع و فضای بسته',
    descriptionEn: 'Breakdown of hot, cold, height, and confined space permits',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'FileCheck',
    defaultColSpan: 6,
    priority: 2,
  },
  {
    id: 'card-risk-matrix',
    titleFa: 'نمودار توزیع ریسک‌های ایمنی',
    titleEn: 'Safety Risk Distribution Chart',
    descriptionFa: 'تحلیل سطوح ریسک شناسایی‌شده در واحدهای عملیاتی',
    descriptionEn: 'Distribution of identified risk levels across operations',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'ShieldAlert',
    defaultColSpan: 6,
    priority: 2,
  },

  // Priority 3 - Operational & Support Cards
  {
    id: 'kpi-heat-index',
    titleFa: 'شاخص دمای حباب مرطوب (Heat Index)',
    titleEn: 'Active Heat Index',
    descriptionFa: 'نمایش مقدار لحظه‌ای شاخص استرس گرمایی به همراه رده ایمنی کارگاهی',
    descriptionEn: 'Real-time heat stress index reading with workshop safety categorization',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'Thermometer',
    defaultColSpan: 3,
    priority: 3,
  },
  {
    id: 'kpi-health-rate',
    titleFa: 'نرخ سلامت شغلی و تناسب طب کار',
    titleEn: 'Occupational Health Fitness Rate',
    descriptionFa: 'درصد تناسب کلی معاینات دوره‌ای طب کار پرسنل',
    descriptionEn: 'Overall medical fitness compliance percentage',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'HeartPulse',
    defaultColSpan: 3,
    priority: 3,
  },
  {
    id: 'kpi-warnings',
    titleFa: 'اخطارهای کتبی فعال ایمنی',
    titleEn: 'Active Written Warnings',
    descriptionFa: 'تعداد پرونده‌ها و عدم انطباق‌های باز کتبی در حال پیگیری سایت',
    descriptionEn: 'Count of active open written safety warnings and non-conformities',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'AlertTriangle',
    defaultColSpan: 3,
    priority: 3,
  },
  {
    id: 'kpi-fire-readiness',
    titleFa: 'ضریب آمادگی تجهیزات اطفای حریق',
    titleEn: 'Fire Equipment Readiness',
    descriptionFa: 'درصد کپسول‌ها و تجهیزات آتش‌نشانی آماده به کار و دارای تاییدیه بازرسی',
    descriptionEn: 'Operational fire extinguishers and equipment readiness percentage',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'Flame',
    defaultColSpan: 3,
    priority: 3,
  },
  {
    id: 'kpi-5s-score',
    titleFa: 'میانگین امتیاز نظام آراستگی (5S)',
    titleEn: '5S Housekeeping Average Score',
    descriptionFa: 'میانگین نمرات آخرین ممیزی‌های نظام آراستگی محیط کارگاهی',
    descriptionEn: 'Average score of the latest 5S workplace audits',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'Layers',
    defaultColSpan: 3,
    priority: 3,
  },
  {
    id: 'kpi-wbgt',
    titleFa: 'دمای تر محیطی (WBGT) و رطوبت',
    titleEn: 'Humidity & WBGT',
    descriptionFa: 'پایش رطوبت نسبی هوا و دمای تر گویسان بر اساس استانداردهای اقلیمی',
    descriptionEn: 'Relative air humidity and wet bulb globe temperature monitoring',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'Droplets',
    defaultColSpan: 3,
    priority: 3,
  },
  {
    id: 'kpi-risk-high',
    titleFa: 'ارزیابی‌های ریسک بحرانی و بالا',
    titleEn: 'Critical High Risk Hazards',
    descriptionFa: 'تعداد مخاطرات با سطح ریسک بحرانی و غیرقابل قبول نیازمند اقدام فوری',
    descriptionEn: 'High and critical risk hazards requiring immediate action',
    category: 'kpi',
    categoryFa: 'کارت‌های شاخص کلیدی (KPI)',
    categoryEn: 'Key Performance Indicators (KPI)',
    iconName: 'ShieldAlert',
    defaultColSpan: 3,
    priority: 3,
  },
  {
    id: 'card-warnings-trend',
    titleFa: 'نمودار وضعیت عدم انطباق‌ها و اخطارهای ایمنی',
    titleEn: 'Safety Warnings & Non-Conformities Status Chart',
    descriptionFa: 'پایش تفکیکی اخطارهای کتبی فعال، جرایم و پرونده‌های مختومه‌شده',
    descriptionEn: 'Breakdown of active written warnings, penalties, and resolved issues',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'AlertTriangle',
    defaultColSpan: 6,
    priority: 3,
  },
  {
    id: 'card-5s-trend',
    titleFa: 'نمودار نظام آراستگی (5S) و ضریب ایمنی حریق',
    titleEn: '5S Housekeeping & Fire Safety Index Chart',
    descriptionFa: 'مقایسه آماری میانگین نمرات ممیزی 5S و آمادگی تجهیزات آتش‌نشانی',
    descriptionEn: 'Comparison of workplace 5S scores and fire gear readiness rate',
    category: 'chart',
    categoryFa: 'نمودارها و تحلیل‌های روند',
    categoryEn: 'Trend Charts & Analytics',
    iconName: 'Layers',
    defaultColSpan: 6,
    priority: 3,
  },
  {
    id: 'card-notifications',
    titleFa: 'اعلان‌های بحرانی و پیام‌های اضطراری',
    titleEn: 'Critical Notifications & Alerts',
    descriptionFa: 'کنسول پایش لحظه‌ای هشدارهای بحرانی، پیام‌های سیستم و اسناد فوری',
    descriptionEn: 'Live monitoring console for critical alerts, bulletins, and actions',
    category: 'action',
    categoryFa: 'پیام‌ها و اقدامات فوری',
    categoryEn: 'Alerts & Quick Actions',
    iconName: 'Bell',
    defaultColSpan: 4,
    priority: 3,
  },
  {
    id: 'card-quick-actions',
    titleFa: 'اقدامات سریع و دسترسی به ثبت اطلاعات',
    titleEn: 'Managerial Quick Actions',
    descriptionFa: 'میان‌برهای دسترسی مستقیم به ثبت حادثه، پایش گرما، صدور اخطار و گزارش‌ها',
    descriptionEn: 'Direct shortcuts to record incidents, heat logs, issue warnings, and reports',
    category: 'action',
    categoryFa: 'پیام‌ها و اقدامات فوری',
    categoryEn: 'Alerts & Quick Actions',
    iconName: 'Sparkles',
    defaultColSpan: 8,
    priority: 3,
  },
];

interface DashboardCardManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardsLayout: CardLayoutItem[];
  onToggleCard: (cardId: string) => void;
  onResetToDefaults: () => void;
  onSelectAll: () => void;
  onSaveToDatabase?: () => void;
  onChangeColSpan?: (cardId: string, colSpan: number) => void;
  onChangeHeightPreset?: (cardId: string, preset: 'compact' | 'normal' | 'expanded') => void;
  isFa: boolean;
  isAdmin: boolean;
}

export const DashboardCardManagerModal: React.FC<DashboardCardManagerModalProps> = ({
  isOpen,
  onClose,
  cardsLayout,
  onToggleCard,
  onResetToDefaults,
  onSelectAll,
  onSaveToDatabase,
  onChangeColSpan,
  onChangeHeightPreset,
  isFa,
  isAdmin,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'kpi' | 'chart' | 'scada' | 'action'>('all');
  const [activePriority, setActivePriority] = useState<number | 'all'>('all');

  if (!isOpen) return null;

  const visibleIds = cardsLayout.filter(c => c.visible).map(c => c.id);

  const filteredCards = DASHBOARD_AVAILABLE_CARDS.filter(card => {
    const matchesSearch = 
      card.titleFa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.titleEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.descriptionFa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.descriptionEn.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCat = activeCategory === 'all' || card.category === activeCategory;
    const matchesPriority = activePriority === 'all' || card.priority === activePriority;
    return matchesSearch && matchesCat && matchesPriority;
  });

  const getCardIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldAlert': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'Thermometer': return <Thermometer className="w-5 h-5 text-blue-500" />;
      case 'Droplets': return <Droplets className="w-5 h-5 text-sky-500" />;
      case 'AlertTriangle': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'FileCheck': return <FileCheck className="w-5 h-5 text-indigo-500" />;
      case 'HeartPulse': return <HeartPulse className="w-5 h-5 text-emerald-500" />;
      case 'Clock': return <Clock className="w-5 h-5 text-teal-500" />;
      case 'Activity': return <Activity className="w-5 h-5 text-violet-500" />;
      case 'Flame': return <Flame className="w-5 h-5 text-orange-500" />;
      case 'Layers': return <Layers className="w-5 h-5 text-pink-500" />;
      case 'BarChart3': return <BarChart3 className="w-5 h-5 text-indigo-500" />;
      case 'Bell': return <Bell className="w-5 h-5 text-amber-500" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-cyan-500" />;
      case 'GraduationCap': return <GraduationCap className="w-5 h-5 text-blue-500" />;
      case 'AlertOctagon': return <AlertOctagon className="w-5 h-5 text-rose-500" />;
      case 'FileCheck2': return <FileCheck2 className="w-5 h-5 text-indigo-500" />;
      case 'ClipboardCheck': return <ClipboardCheck className="w-5 h-5 text-sky-500" />;
      default: return <Activity className="w-5 h-5 text-slate-500" />;
    }
  };

  const getPriorityBadge = (p: number) => {
    if (p === 1) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
          {isFa ? 'اولویت ۱ (حیاتی)' : 'P1 (Critical)'}
        </span>
      );
    }
    if (p === 2) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          {isFa ? 'اولویت ۲ (استراتژیک)' : 'P2 (High)'}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        {isFa ? 'اولویت ۳ (عملیاتی)' : 'P3 (Operational)'}
      </span>
    );
  };

  const visibleCount = visibleIds.length;
  const totalCount = DASHBOARD_AVAILABLE_CARDS.length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      dir={isFa ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                {isFa ? 'مدیریت و اولویت‌بندی جامع کارت‌های داشبورد' : 'Manage & Prioritize All Dashboard Cards'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isFa 
                  ? `شامل آموزش، ناهنجاری‌ها، ممیزی PTW، بهداشت، آتش‌نشانی و ایمنی (${visibleCount} از ${totalCount} کارت فعال)`
                  : `Includes Training, Anomalies, PTW Audits, Health, Fire & Safety (${visibleCount} of ${totalCount} active)`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search and Filter Tabs */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isFa ? 'right-3' : 'left-3'} pointer-events-none`} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isFa ? 'جستجو در نام، توضیحات یا اولویت کارت‌ها...' : 'Search cards...'}
                className={`w-full py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition ${isFa ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
              />
            </div>

            {/* Quick Actions: Reset & Select All (Admin Only) */}
            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="px-3 py-1.5 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isFa ? 'نمایش همه' : 'Show All'}</span>
                </button>
                <button
                  type="button"
                  onClick={onResetToDefaults}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isFa ? 'پیش‌فرض' : 'Reset'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Category & Priority Filters */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isFa ? 'همه کارت‌ها' : 'All Cards'} ({DASHBOARD_AVAILABLE_CARDS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('kpi')}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === 'kpi'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isFa ? 'شاخص‌های کلیدی (KPI)' : 'KPIs'}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('chart')}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === 'chart'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isFa ? 'نمودارها' : 'Charts'}
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('scada')}
                className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                  activeCategory === 'scada'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isFa ? 'پایش HSI' : 'SCADA'}
              </button>
            </div>

            {/* Priority Filter */}
            <div className="ms-auto flex items-center gap-1">
              <span className="text-slate-400 font-bold">{isFa ? 'فیلتر اولویت:' : 'Priority:'}</span>
              <button
                type="button"
                onClick={() => setActivePriority('all')}
                className={`px-2 py-0.5 rounded-lg font-bold ${activePriority === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
              >
                {isFa ? 'همه' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => setActivePriority(1)}
                className={`px-2 py-0.5 rounded-lg font-black ${activePriority === 1 ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-950/40 text-red-600'}`}
              >
                P1 {isFa ? 'حیاتی' : 'Critical'}
              </button>
              <button
                type="button"
                onClick={() => setActivePriority(2)}
                className={`px-2 py-0.5 rounded-lg font-black ${activePriority === 2 ? 'bg-amber-600 text-white' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'}`}
              >
                P2 {isFa ? 'مهم' : 'High'}
              </button>
            </div>
          </div>
        </div>

        {/* Cards Grid List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar bg-slate-50/50 dark:bg-slate-950/40">
          {filteredCards.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto opacity-40" />
              <p className="font-bold text-sm">{isFa ? 'کارتی با این مشخصات یافت نشد.' : 'No cards found.'}</p>
            </div>
          ) : (
            filteredCards.map(card => {
              const isVisible = visibleIds.includes(card.id);
              const cardLayout = cardsLayout.find(c => c.id === card.id);
              const currentColSpan = cardLayout?.colSpan || card.defaultColSpan || 3;
              const currentHeight = cardLayout?.customHeight || (card.category === 'kpi' ? 140 : 340);
              const heightPreset = cardLayout?.height || 'normal';

              return (
                <div
                  key={card.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                    isVisible
                      ? 'bg-white dark:bg-slate-900 border-blue-500/40 dark:border-blue-500/50 shadow-sm ring-1 ring-blue-500/20'
                      : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${
                        isVisible 
                          ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60' 
                          : 'bg-slate-200/60 dark:bg-slate-800 border border-slate-300/40 dark:border-slate-700/40'
                      }`}>
                        {getCardIcon(card.iconName)}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-sm text-slate-800 dark:text-slate-100 truncate">
                            {isFa ? card.titleFa : card.titleEn}
                          </h4>
                          {getPriorityBadge(card.priority)}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            {isFa ? card.categoryFa : card.categoryEn}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 font-medium">
                          {isFa ? card.descriptionFa : card.descriptionEn}
                        </p>
                      </div>
                    </div>

                    {/* Switch / Checkbox Control */}
                    <div className="shrink-0 flex items-center gap-3">
                      <span className={`text-xs font-black hidden sm:inline-block ${
                        isVisible ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'
                      }`}>
                        {isVisible ? (isFa ? 'فعال در داشبورد' : 'Visible') : (isFa ? 'مخفی' : 'Hidden')}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCard(card.id);
                        }}
                        className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                          isVisible ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                        aria-label={isVisible ? 'Hide Card' : 'Show Card'}
                      >
                        <span className="bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition" />
                      </button>
                    </div>
                  </div>

                  {/* Dimension Customization (شاخصی‌سازی طول و عرض کارت در مدال) */}
                  {isVisible && (
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 flex-wrap text-xs bg-slate-50/60 dark:bg-slate-950/40 p-2.5 rounded-xl">
                      {/* Width Selector */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isFa ? 'عرض کارت:' : 'Width:'}
                        </span>
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 text-xs px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/50">
                          {currentColSpan} {isFa ? 'ستون' : 'cols'} ({Math.round((currentColSpan / 12) * 100)}%)
                        </span>
                        {onChangeColSpan && (
                          <div className="flex items-center gap-1 ms-1">
                            {[3, 4, 6, 8, 12].map(span => (
                              <button
                                key={span}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onChangeColSpan(card.id, span);
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer border ${
                                  currentColSpan === span
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-1 ring-blue-500/20'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                                title={`${span} ستون (${Math.round((span / 12) * 100)}%)`}
                              >
                                {span}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Height Selector */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {isFa ? 'ارتفاع کارت:' : 'Height:'}
                        </span>
                        <span className="font-mono font-black text-slate-700 dark:text-slate-200 text-xs px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {currentHeight}px
                        </span>
                        {onChangeHeightPreset && (
                          <div className="flex items-center gap-1 ms-1">
                            {(['compact', 'normal', 'expanded'] as const).map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onChangeHeightPreset(card.id, preset);
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                                  heightPreset === preset
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {preset === 'compact' ? (isFa ? 'فشرده' : 'Compact') : preset === 'normal' ? (isFa ? 'عادی' : 'Normal') : (isFa ? 'مرتفع' : 'Expanded')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">
            {isAdmin 
              ? (isFa ? 'تنظیمات چیدمان در پایگاه داده ذخیره شده و پس از ورود مجدد حفظ می‌گردد.' : 'Layout is persistently saved in database.')
              : (isFa ? 'تنها مدیر اصلی سامانه مجاز به تغییر دائمی چیدمان کارت‌ها می‌باشد.' : 'Only Administrator can modify layout settings.')}
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && onSaveToDatabase && (
              <button
                type="button"
                onClick={onSaveToDatabase}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isFa ? 'ذخیره در سرور' : 'Save to DB'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isFa ? 'تایید و بستن' : 'Done & Close'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
