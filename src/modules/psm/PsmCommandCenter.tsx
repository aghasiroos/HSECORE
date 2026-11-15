import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Compass,
  Database,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  FolderGit2,
  GitBranch,
  HelpCircle,
  Info,
  Layers,
  ListChecks,
  Lock,
  Network,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { PsmSubTabKey } from './PsmManagementModule';
import {
  computeSevenStagesRoadmap,
  computeNextBestActions,
  computeProjectStoppageDiagnosis,
  computeRealVsPaperProgress,
  computeSmartPsmNotifications,
  PSM_PLAIN_LANGUAGE_GUIDES,
  SIMPLE_STAGE_STATUS_META,
  PsmDeepLinkAction,
  PsmPlainLanguageGuideItem,
} from './psmGuidedEngine';

interface PsmCommandCenterProps {
  currentUser: UserProfile | null;
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
  };
  stageGates: any[];
  centralOrg: {
    companies: any[];
    sites: any[];
    departments: any[];
    units: any[];
    positions: any[];
    personnel: any[];
    linkedModulesSummary: Record<string, number>;
  };
  permissions: { canWrite: boolean; canApprove: boolean };
  onExecuteDeepLink: (deepLink: PsmDeepLinkAction) => void;
  onNavigateSubTab: (subTab: PsmSubTabKey) => void;
  onRefresh: () => void;
}

export const PsmCommandCenter: React.FC<PsmCommandCenterProps> = ({
  currentUser,
  activeProject,
  projectData,
  stageGates,
  centralOrg,
  permissions,
  onExecuteDeepLink,
  onNavigateSubTab,
  onRefresh,
}) => {
  // تشخیص خودکار نقش کاربر برای پیشنهاد نمای پیش‌فرض (مدیر یا کارشناس)
  const isManagerRole = useMemo(() => {
    const r = String(currentUser?.role || '').toLowerCase();
    return (
      r.includes('admin') ||
      r.includes('manager') ||
      r.includes('مدیر') ||
      r.includes('رئیس') ||
      r.includes('سرپرست') ||
      permissions.canApprove
    );
  }, [currentUser?.role, permissions.canApprove]);

  const [roleViewMode, setRoleViewMode] = useState<'HYBRID' | 'MANAGER' | 'EXPERT'>('HYBRID');
  const [expandedStageNumber, setExpandedStageNumber] = useState<number | null>(null);
  const [selectedGuideItem, setSelectedGuideItem] = useState<PsmPlainLanguageGuideItem | null>(null);
  const [showAdvancedGuideDetail, setShowAdvancedGuideDetail] = useState(false);
  const [showSmartNotificationsDrawer, setShowSmartNotificationsDrawer] = useState(false);
  const [globalQuickSearch, setGlobalQuickSearch] = useState('');

  // ۱. محاسبه ۷ مرحله اصلی مسیر استقرار PSM
  const sevenStages = useMemo(
    () => computeSevenStagesRoadmap(activeProject, projectData, stageGates),
    [activeProject, projectData, stageGates]
  );

  // ۲. محاسبه پیشنهادهای اقدام بعدی (Next Best Actions - اصل اول)
  const nextBestActions = useMemo(
    () => computeNextBestActions(activeProject, projectData, stageGates),
    [activeProject, projectData, stageGates]
  );

  // ۳. محاسبه تشخیص توقف پروژه و تصمیم‌های موردنیاز مدیر (اصل سوم)
  const stoppageDiagnosis = useMemo(
    () => computeProjectStoppageDiagnosis(activeProject, projectData, stageGates),
    [activeProject, projectData, stageGates]
  );

  // ۴. محاسبه تفکیک پیشرفت واقعی استقرار از پیشرفت کاغذی
  const progressSplit = useMemo(
    () => computeRealVsPaperProgress(activeProject, projectData, stageGates),
    [activeProject, projectData, stageGates]
  );

  // ۵. اعلان‌ها و یادآوری‌های هوشمند
  const smartNotifications = useMemo(
    () => computeSmartPsmNotifications(activeProject, projectData, stageGates),
    [activeProject, projectData, stageGates]
  );

  // فیلتر اقدامات پیشنهادی بر اساس محیط انتخاب‌شده (مدیر / کارشناس / ترکیبی)
  const visibleNextActions = useMemo(() => {
    if (roleViewMode === 'MANAGER') {
      const mgr = nextBestActions.filter(
        (a) => a.targetAudience === 'MANAGER' || a.targetAudience === 'BOTH' || a.priority === 'CRITICAL'
      );
      return mgr.length > 0 ? mgr : nextBestActions;
    }
    if (roleViewMode === 'EXPERT') {
      const exp = nextBestActions.filter(
        (a) => a.targetAudience === 'EXPERT' || a.targetAudience === 'BOTH'
      );
      return exp.length > 0 ? exp : nextBestActions;
    }
    return nextBestActions;
  }, [nextBestActions, roleViewMode]);

  const primaryNextAction = visibleNextActions[0] || null;

  // مرحله جاری فعال در مسیر ۷ مرحله‌ای
  const currentActiveStage = useMemo(() => {
    return (
      sevenStages.find(
        (s) =>
          s.status === 'STOPPED' ||
          s.status === 'ACTION_REQUIRED' ||
          s.status === 'PENDING_APPROVAL' ||
          s.status === 'IN_PROGRESS'
      ) || sevenStages[0]
    );
  }, [sevenStages]);

  // جستجوی سریع سراسری در مراحل، مفاهیم، شکاف‌ها و مدارک
  const quickSearchResults = useMemo(() => {
    const q = globalQuickSearch.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{
      id: string;
      typeLabel: string;
      title: string;
      subtitle: string;
      onClick: () => void;
    }> = [];

    PSM_PLAIN_LANGUAGE_GUIDES.forEach((g) => {
      if (
        g.shortTitleFa.toLowerCase().includes(q) ||
        g.key.toLowerCase().includes(q) ||
        g.englishTerm.toLowerCase().includes(q)
      ) {
        results.push({
          id: `guide-${g.key}`,
          typeLabel: 'راهنمای مفهومی PSM',
          title: g.shortTitleFa,
          subtitle: g.whatIsItFa,
          onClick: () => {
            setSelectedGuideItem(g);
            setGlobalQuickSearch('');
          },
        });
      }
    });

    projectData.gaps.forEach((gap) => {
      if (
        String(gap.title || '').toLowerCase().includes(q) ||
        String(gap.gapCode || '').toLowerCase().includes(q)
      ) {
        results.push({
          id: `gap-${gap.id}`,
          typeLabel: 'شکاف انطباق (Gap)',
          title: `${gap.gapCode}: ${gap.title}`,
          subtitle: `واحد: ${gap.unitName} | مسئول: ${gap.responsiblePersonName || 'نامشخص'}`,
          onClick: () => {
            onExecuteDeepLink({
              targetSubTab: 'gap-analysis',
              actionType: 'CONVERT_GAP_TO_PLAN',
              buttonLabelFa: 'مشاهده شکاف',
              contextTitleFa: `شکاف ${gap.gapCode}`,
              contextHintFa: gap.title,
              prefillData: { recordId: gap.id },
            });
            setGlobalQuickSearch('');
          },
        });
      }
    });

    projectData.documents.forEach((doc) => {
      if (
        String(doc.title || '').toLowerCase().includes(q) ||
        String(doc.docCode || '').toLowerCase().includes(q)
      ) {
        results.push({
          id: `doc-${doc.id}`,
          typeLabel: 'مدرک فنی PSM',
          title: `${doc.docCode}: ${doc.title}`,
          subtitle: `وضعیت: ${doc.status} | واحد: ${doc.unitName}`,
          onClick: () => {
            onExecuteDeepLink({
              targetSubTab: 'documents',
              actionType: 'REVISE_DOCUMENT',
              buttonLabelFa: 'مشاهده مدرک',
              contextTitleFa: `مدرک ${doc.docCode}`,
              contextHintFa: doc.title,
              prefillData: { recordId: doc.id },
            });
            setGlobalQuickSearch('');
          },
        });
      }
    });

    return results.slice(0, 8);
  }, [globalQuickSearch, projectData.gaps, projectData.documents, onExecuteDeepLink]);

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      {/* =====================================================================
          HEADER BAR: عنوان «مسیر استقرار PSM (PSM Command Center)» + انتخاب محیط نقش + جستجوی سریع + اعلان‌ها
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  مسیر استقرار PSM (PSM Command Center)
                </h2>
                <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[11px] font-black">
                  راهبر هوشمند گام‌به‌گام — ویژه مجتمع پتروشیمی رجال
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                نقطه شروع و مرکز فرماندهی استقرار ایمنی فرایند؛ سیستم بر اساس وضعیت واقعی پروژه به شما می‌گوید چه کاری باید انجام شود و با یک کلیک شما را به فرم مربوطه هدایت می‌کند.
              </p>
            </div>
          </div>

          {/* نوار ابزار سمت چپ: سوئیچر محیط مدیران/کارشناسان + اعلان هوشمند + راهنمای مفاهیم */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setRoleViewMode('HYBRID')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  roleViewMode === 'HYBRID'
                    ? 'bg-blue-600 text-white font-black shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                نمای کامل راهبر
              </button>
              <button
                type="button"
                onClick={() => setRoleViewMode('MANAGER')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  roleViewMode === 'MANAGER'
                    ? 'bg-indigo-600 text-white font-black shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>محیط مدیران (تصمیم‌محور)</span>
              </button>
              <button
                type="button"
                onClick={() => setRoleViewMode('EXPERT')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  roleViewMode === 'EXPERT'
                    ? 'bg-teal-600 text-white font-black shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>محیط کارشناسان (وظیفه‌محور)</span>
              </button>
            </div>

            {/* دکمه اعلان‌ها و یادآوری‌های هوشمند */}
            <button
              type="button"
              onClick={() => setShowSmartNotificationsDrawer(!showSmartNotificationsDrawer)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <Bell className="w-4 h-4 text-blue-500" />
              <span>اعلان‌های هوشمند</span>
              {smartNotifications.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black">
                  {smartNotifications.length}
                </span>
              )}
            </button>

            {/* دکمه فرهنگ‌نامه و راهنمای ساده مفاهیم PSM */}
            <button
              type="button"
              onClick={() => setSelectedGuideItem(PSM_PLAIN_LANGUAGE_GUIDES[0])}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-black transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>راهنمای ساده مفاهیم PSM</span>
            </button>
          </div>
        </div>

        {/* نوار جستجوی سریع سراسری + خلاصه تفکیک پیشرفت واقعی از پیشرفت کاغذی */}
        <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* جستجوی سریع */}
          <div className="lg:col-span-5 relative">
            <div className="relative">
              <input
                type="text"
                value={globalQuickSearch}
                onChange={(e) => setGlobalQuickSearch(e.target.value)}
                placeholder="جستجوی سریع وظیفه، کد شکاف، مدرک فنی یا مفهوم تخصصی (مثلاً PSI، MOC، HAZOP)..."
                className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              {globalQuickSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalQuickSearch('')}
                  className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* نتایج جستجوی سریع */}
            {quickSearchResults.length > 0 && (
              <div className="absolute z-30 top-full mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 space-y-1">
                {quickSearchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={res.onClick}
                    className="w-full text-right p-2.5 rounded-xl hover:bg-blue-500/10 transition flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                          {res.typeLabel}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {res.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{res.subtitle}</p>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-blue-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* تفکیک پیشرفت واقعی استقرار از پیشرفت صرفاً کاغذی (بند ۱۷-۷) */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>پیشرفت واقعی استقرار (مبتنی بر شواهد و تأیید)</span>
                </span>
                <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                  {progressSplit.realProgressPct}٪
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${progressSplit.realProgressPct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                فقط مدارک مصوب دارای شواهد، اقدامات اثربخش و Gateهای تأییدشده
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/25 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>پیشرفت ثبت فرم‌ها و مستندسازی (کاغذی)</span>
                </span>
                <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                  {progressSplit.paperProgressPct}٪
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${progressSplit.paperProgressPct}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate" title={progressSplit.explanationFa}>
                {progressSplit.explanationFa}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          پنل کشویی اعلان‌ها و یادآوری‌های هوشمند (در صورت باز بودن)
         ===================================================================== */}
      {showSmartNotificationsDrawer && (
        <div className="bg-white dark:bg-slate-900 border-2 border-blue-500/40 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                اعلان‌ها و یادآوری‌های هوشمند بر اساس مسئولیت و وضعیت واقعی فعالیت‌ها
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowSmartNotificationsDrawer(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {smartNotifications.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">
              در حال حاضر هیچ اعلان اضطراری یا مانع باز برای پروژه ثبت نشده است.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {smartNotifications.map((notif) => {
                const badgeColors =
                  notif.severity === 'CRITICAL'
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : notif.severity === 'WARNING'
                    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                    : notif.severity === 'SUCCESS'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';

                return (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${badgeColors}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white/70 dark:bg-slate-900/70">
                          {notif.typeLabelFa}
                        </span>
                        {notif.dueDateFa && (
                          <span className="text-[10px] font-mono">موعد: {notif.dueDateFa}</span>
                        )}
                      </div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {notif.titleFa}
                      </h4>
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                        {notif.messageFa}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                      <span className="text-[11px] font-bold">مسئول: {notif.responsibleFa}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSmartNotificationsDrawer(false);
                          onExecuteDeepLink(notif.deepLink);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-black flex items-center gap-1 hover:opacity-90 transition cursor-pointer"
                      >
                        <span>{notif.deepLink.buttonLabelFa}</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          بخش دو اصل بنیادین اول و سوم در بالای مرکز فرماندهی:
          ۱. کارت اقدام بعدی پیشنهادی سیستم (Next Best Action - اصل اول و دوم)
          ۲. کارت تشخیص توقف پروژه و تصمیم موردنیاز مدیر (Stoppage & Decision Radar - اصل سوم)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* کارت اصل اول و دوم: پیشنهاد هوشمند اقدام بعدی (Next Best Action) */}
        {(roleViewMode === 'HYBRID' || roleViewMode === 'EXPERT') && (
          <div
            className={`${
              roleViewMode === 'EXPERT' ? 'lg:col-span-12' : 'lg:col-span-7'
            } bg-gradient-to-br from-blue-500/10 via-white to-teal-500/5 dark:from-blue-500/15 dark:via-slate-900 dark:to-teal-500/10 border-2 border-blue-500/40 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4`}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>راهنمای هوشمند سیستم: اقدام بعدی شما (Next Best Action)</span>
                  </span>
                  {primaryNextAction && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-black">
                      {primaryNextAction.priorityLabelFa}
                    </span>
                  )}
                </div>
                {primaryNextAction && (
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    مرحله مرتبط: {primaryNextAction.stageTitleFa}
                  </span>
                )}
              </div>

              {primaryNextAction ? (
                <>
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                      «{primaryNextAction.titleFa}»
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/80 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                      <strong className="text-blue-600 dark:text-blue-400">چرا این کار باید اکنون انجام شود؟ </strong>
                      {primaryNextAction.reasonFa}
                    </p>
                  </div>

                  {/* جزئیات مسئول، واحد، مهلت، پیش‌نیاز و مدارک موردنیاز */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                      <div className="text-[10px] text-slate-400 font-bold">شخص / نقش مسئول</div>
                      <div className="font-black text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                        {primaryNextAction.responsiblePersonFa}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                      <div className="text-[10px] text-slate-400 font-bold">واحد سازمانی</div>
                      <div className="font-black text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                        {primaryNextAction.unitNameFa}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                      <div className="text-[10px] text-slate-400 font-bold">مهلت انجام</div>
                      <div className="font-mono font-black text-blue-600 dark:text-blue-400 mt-0.5">
                        {primaryNextAction.dueDateFa}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                      <div className="text-[10px] text-slate-400 font-bold">وضعیت پیش‌نیازها</div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1 truncate">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{primaryNextAction.prerequisitesSummaryFa}</span>
                      </div>
                    </div>
                  </div>

                  {/* مدارک و شواهد موردنیاز برای این اقدام */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-bold">مدارک و اطلاعات موردنیاز:</span>
                    {primaryNextAction.requiredDocumentsFa.map((docTitle, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[11px] font-bold"
                      >
                        {docTitle}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    تمامی مراحل و اقدامات الزامی پروژه استقرار PSM تکمیل شده‌اند!
                  </h4>
                </div>
              )}
            </div>

            {/* دکمه مستقیم شروع / انجام کار (اصل دوم: هدایت مستقیم به فرم مرتبط) */}
            {primaryNextAction && (
              <div className="pt-3 border-t border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-teal-600 dark:text-teal-400">اثر بر مسیر پروژه: </span>
                  {primaryNextAction.impactOnProjectFa}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigateSubTab('my-workspace')}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    مشاهده کارتابل «کارهای من»
                  </button>
                  <button
                    type="button"
                    onClick={() => onExecuteDeepLink(primaryNextAction.deepLink)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md flex items-center gap-2 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{primaryNextAction.deepLink.buttonLabelFa}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* خلاصه وضعیت سلامت مسیر و ارجاع یکپارچه به داشبورد کنترل مدیران */}
        {(roleViewMode === 'HYBRID' || roleViewMode === 'MANAGER') && (
          <div
            className={`${
              roleViewMode === 'MANAGER' ? 'lg:col-span-12' : 'lg:col-span-5'
            } rounded-2xl border-2 p-5 shadow-xs flex flex-col justify-between space-y-4 ${
              stoppageDiagnosis.overallHealthStatus === 'STOPPED'
                ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/40'
                : stoppageDiagnosis.overallHealthStatus === 'AWAITING_DECISION'
                ? 'bg-indigo-500/5 dark:bg-indigo-950/20 border-indigo-500/40'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 ${
                    stoppageDiagnosis.overallHealthStatus === 'STOPPED'
                      ? 'bg-rose-600 text-white'
                      : stoppageDiagnosis.overallHealthStatus === 'AWAITING_DECISION'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>وضعیت سلامت مسیر و تصمیم‌های مدیریتی</span>
                </span>

                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  تصمیم منتظر: {stoppageDiagnosis.pendingManagerDecisions.length} | مانع باز: {stoppageDiagnosis.criticalBlockers.length}
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-snug">
                {stoppageDiagnosis.overallHealthTitleFa}
              </h3>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {stoppageDiagnosis.stopReasonsFa[0] ||
                  'مسیر استقرار بدون توقف بحرانی در جریان است. تحلیل کامل علل توقف، شاخص‌های EVM و تفکیک پیشرفت واقعی از کاغذی در «داشبورد کنترل و پایش مدیران» متمرکز شده است.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onNavigateSubTab('dashboard')}
                className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-blue-600 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5"
              >
                <span>ورود به داشبورد کنترل و پایش مدیران</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>

              {(stoppageDiagnosis.pendingManagerDecisions[0] ||
                stoppageDiagnosis.criticalBlockers[0]) && (
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      stoppageDiagnosis.pendingManagerDecisions[0]?.deepLink ||
                      stoppageDiagnosis.criticalBlockers[0]?.deepLink;
                    if (target) onExecuteDeepLink(target);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>اقدام فوری رفع مانع</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          بخش اصلی: نقشه راه ۷ مرحله‌ای مسیر استقرار PSM به زبان ساده (بند ۳)
         ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-500" />
              <span>مراحل ۷گانه مسیر استقرار PSM (از تعریف پروژه تا تأیید نهایی و تحویل)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              وضعیت هر مرحله، درصد پیشرفت واقعی، اقدامات تکمیل‌شده و باقی‌مانده، مسئول، موانع و دکمه اقدام مستقیم
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 font-black text-blue-700 dark:text-blue-300">
              مرحله فعال فعلی: {currentActiveStage.titleFa}
            </span>
          </div>
        </div>

        {/* نوار افقی خلاصه ۷ مرحله */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {sevenStages.map((stage) => {
            const statusMeta = SIMPLE_STAGE_STATUS_META[stage.status];
            const isCurrent = currentActiveStage.stageNumber === stage.stageNumber;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() =>
                  setExpandedStageNumber(
                    expandedStageNumber === stage.stageNumber ? null : stage.stageNumber
                  )
                }
                className={`text-right p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                  isCurrent
                    ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500/40'
                    : `bg-slate-50 dark:bg-slate-800/50 ${statusMeta.borderClass} hover:border-blue-500/50`
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      گام {stage.stageNumber} ({stage.linkedGateKey})
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full ${statusMeta.dotClass}`} />
                  </div>
                  <div className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 leading-snug">
                    {stage.titleFa.replace(/^[۰-۹]+\.\s*/, '')}
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${statusMeta.badgeClass}`}>
                      {stage.statusLabelFa}
                    </span>
                    <span className="font-mono font-black text-slate-700 dark:text-slate-200">
                      {stage.realProgressPct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        stage.status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : stage.status === 'STOPPED'
                          ? 'bg-rose-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${stage.realProgressPct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* کارت‌های تفصیلی هر یک از ۷ مرحله استقرار */}
        <div className="space-y-3.5">
          {sevenStages.map((stage) => {
            const statusMeta = SIMPLE_STAGE_STATUS_META[stage.status];
            const isExpanded =
              expandedStageNumber === stage.stageNumber ||
              (expandedStageNumber === null &&
                (stage.stageNumber === currentActiveStage.stageNumber ||
                  stage.status === 'STOPPED' ||
                  stage.status === 'ACTION_REQUIRED'));

            return (
              <div
                key={stage.key}
                className={`rounded-2xl border transition overflow-hidden ${
                  stage.stageNumber === currentActiveStage.stageNumber
                    ? 'border-blue-500/60 bg-blue-500/[0.03] dark:bg-blue-500/[0.05]'
                    : `bg-slate-50/70 dark:bg-slate-800/40 ${statusMeta.borderClass}`
                }`}
              >
                {/* هدر مرحله */}
                <div
                  onClick={() =>
                    setExpandedStageNumber(isExpanded ? -1 : stage.stageNumber)
                  }
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0 ${
                        stage.status === 'COMPLETED'
                          ? 'bg-emerald-500 text-white'
                          : stage.status === 'STOPPED'
                          ? 'bg-rose-500 text-white'
                          : stage.stageNumber === currentActiveStage.stageNumber
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {stage.stageNumber}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {stage.titleFa}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black ${statusMeta.badgeClass}`}>
                          {stage.statusLabelFa}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300">
                          نقطه کنترل: {stage.linkedGateKey}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {stage.subtitleFa}
                      </p>
                    </div>
                  </div>

                  {/* شاخص‌های عددی سریع مرحله */}
                  <div className="flex flex-wrap items-center gap-3 text-xs shrink-0">
                    <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400">پیشرفت واقعی: </span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {stage.realProgressPct}٪
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400">تکمیل‌شده: </span>
                      <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                        {stage.completedActionsCount}
                      </span>
                      <span className="text-slate-400 mx-1">|</span>
                      <span className="text-slate-400">باقی‌مانده: </span>
                      <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                        {stage.remainingActionsCount}
                      </span>
                    </div>

                    {stage.nextRecommendedAction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExecuteDeepLink(stage.nextRecommendedAction!.deepLink);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                      >
                        <span>{stage.nextRecommendedAction.deepLink.buttonLabelFa}</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* جزئیات کامل مرحله (مسئول، مهلت، موانع، مدارک لازم و اقدام پیشنهادی) */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-200/70 dark:border-slate-700/70 space-y-3.5 bg-white/60 dark:bg-slate-900/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                        <div className="text-slate-400 font-bold">مسئول مرحله و مهلت برنامه‌ریزی‌شده</div>
                        <div className="font-black text-slate-900 dark:text-white">
                          مسئول: {stage.responsiblePersonFa}
                        </div>
                        <div className="font-mono text-slate-500">
                          مهلت هدف: {stage.plannedDueDateFa}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                        <div className="text-slate-400 font-bold">مدارک و شواهد موردنیاز این مرحله</div>
                        <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                          {stage.requiredEvidenceFa.map((ev, i) => (
                            <li key={i} className="flex items-center gap-1.5">
                              <FileCheck2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                              <span>{ev}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                        <div className="text-slate-400 font-bold">موانع و مشکلات مرحله</div>
                        {stage.blockersAndStopReasonsFa.length > 0 ? (
                          <ul className="space-y-1 text-rose-600 dark:text-rose-400 font-medium">
                            {stage.blockersAndStopReasonsFa.map((blk, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{blk}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>بدون مانع باز در این مرحله</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* پیشنهاد سیستم برای این مرحله */}
                    {stage.nextRecommendedAction && (
                      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-black text-blue-800 dark:text-blue-300">
                            اقدام بعدی پیشنهادی سیستم در این مرحله: {stage.nextRecommendedAction.titleFa}
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">
                            {stage.nextRecommendedAction.reasonFa}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onExecuteDeepLink(stage.nextRecommendedAction!.deepLink)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shrink-0 flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{stage.nextRecommendedAction.deepLink.buttonLabelFa}</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          بخش ساده‌سازی مفاهیم تخصصی PSM (بند ۸: راهنمای درون‌برنامه‌ای ۶ پرسشی)
          + اتصال زنده به منابع اطلاعات مرکزی HSECORE (بند ۹)
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* راهنمای مفاهیم تخصصی PSM به زبان ساده */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-500" />
                <span>راهنمای ساده مفاهیم تخصصی ایمنی فرایند (بدون نیاز به دانش قبلی PSM)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                روی هر موضوع کلیک کنید تا ببینید چیست، چرا انجام می‌شود، مسئول آن کیست و چه خروجی‌ای دارد
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PSM_PLAIN_LANGUAGE_GUIDES.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => {
                  setSelectedGuideItem(g);
                  setShowAdvancedGuideDetail(false);
                }}
                className="text-right p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:border-teal-500/50 hover:bg-teal-500/5 transition cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-teal-600 dark:text-teal-400">
                    {g.key}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{g.code}</span>
                </div>
                <div className="text-xs font-black text-slate-900 dark:text-white line-clamp-1">
                  {g.shortTitleFa}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {g.whatIsItFa}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* دسترسی سریع به مرجع یکپارچگی ساختار سازمانی و دارایی‌های مرکزی */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span>مرجع یکپارچه ساختار سازمانی و دارایی‌های مرکزی</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تکمیل خودکار اطلاعات پرسنل، واحدها و تجهیزات بحرانی بدون ثبت تکراری
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                Zero Duplication
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              کلیه اطلاعات پرسنل ({centralOrg.personnel.length} نفر)، واحدها و امور ({centralOrg.units.length + centralOrg.departments.length} واحد) و تجهیزات بحرانی ایمنی ({projectData.assets.length} تجهیز) در تب تخصصی «ساختار سازمانی و تجهیزات» مدیریت و به تمامی فرم‌های PSM متصل می‌شوند.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onNavigateSubTab('org-assets')}
              className="w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>مدیریت ساختار سازمانی و تجهیزات فرایندی (SCE)</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          مودال راهنمای ساده مفاهیم تخصصی PSM (۶ پرسش کلیدی + جزئیات تخصصی اختیاری)
         ===================================================================== */}
      {selectedGuideItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 font-mono text-xs font-black">
                    {selectedGuideItem.key} ({selectedGuideItem.code})
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    {selectedGuideItem.englishTerm}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-1">
                  {selectedGuideItem.shortTitleFa}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGuideItem(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* تب‌های سریع تعویض مفهوم در داخل مودال */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {PSM_PLAIN_LANGUAGE_GUIDES.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => {
                    setSelectedGuideItem(g);
                    setShowAdvancedGuideDetail(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                    selectedGuideItem.key === g.key
                      ? 'bg-teal-600 text-white font-black'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {g.key}
                </button>
              ))}
            </div>

            {/* پاسخ به ۶ پرسش کلیدی به زبان ساده */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <div className="font-black text-teal-700 dark:text-teal-400">۱. این موضوع چیست؟</div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                  {selectedGuideItem.whatIsItFa}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <div className="font-black text-blue-600 dark:text-blue-400">۲. چرا باید انجام شود؟</div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                  {selectedGuideItem.whyNeededFa}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <div className="font-black text-indigo-600 dark:text-indigo-400">۳. چه کسی مسئول است؟</div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                  {selectedGuideItem.whoIsResponsibleFa}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                  <div className="font-black text-slate-900 dark:text-white">۴. چه اطلاعاتی لازم دارد؟</div>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                    {selectedGuideItem.requiredInputsFa.map((inp, i) => (
                      <li key={i}>{inp}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                  <div className="font-black text-emerald-700 dark:text-emerald-400">۵. چه خروجی‌ای باید تولید شود؟</div>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                    {selectedGuideItem.expectedOutputsFa.map((out, i) => (
                      <li key={i}>{out}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-1">
                <div className="font-black text-blue-800 dark:text-blue-300">
                  ۶. بعد از آن چه کاری باید انجام شود؟
                </div>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                  {selectedGuideItem.whatHappensNextFa}
                </p>
              </div>

              {/* بخش راهنمای تخصصی بیشتر (اختیاری) */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedGuideDetail(!showAdvancedGuideDetail)}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    {showAdvancedGuideDetail
                      ? 'بستن توضیحات تخصصی استاندارد (CCPS / OSHA)'
                      : '+ نمایش راهنمای تخصصی بیشتر (مرجع استاندارد CCPS / OSHA)'}
                  </span>
                </button>
                {showAdvancedGuideDetail && (
                  <div className="mt-2 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-200 dark:border-slate-700">
                    {selectedGuideItem.advancedReferenceFa}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedGuideItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                بستن راهنما
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetTab = selectedGuideItem.relatedSubTab;
                  setSelectedGuideItem(null);
                  onNavigateSubTab(targetTab);
                }}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <span>ورود مستقیم به فرم مرتبط ({selectedGuideItem.key})</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
