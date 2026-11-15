import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Compass,
  Filter,
  Play,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { PsmSubTabKey } from './PsmManagementModule';
import {
  UnifiedTaskCategoryKey,
  PsmDeepLinkAction,
  computeUnifiedActionCenterItems,
} from './psmGuidedEngine';

interface PsmPersonalWorkspaceProps {
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
    stageGates?: any[];
  };
  onNavigateSubTab: (subTab: PsmSubTabKey) => void;
  onExecuteDeepLink?: (deepLink: PsmDeepLinkAction) => void;
  onRefresh: () => void;
  onRequestCreateGap?: () => void;
  onRequestCreateDoc?: () => void;
}

const ACTION_CENTER_CATEGORIES: Array<{
  key: 'ALL' | UnifiedTaskCategoryKey;
  label: string;
  shortDesc: string;
  colorClass: string;
  activeClass: string;
}> = [
  {
    key: 'ALL',
    label: 'همه کارها',
    shortDesc: 'تمامی اقدامات باز، مدارک و تصمیم‌ها',
    colorClass: 'text-slate-700 dark:text-slate-200',
    activeClass: 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white',
  },
  {
    key: 'NEW_TASKS',
    label: 'وظایف جدید',
    shortDesc: 'شکاف‌ها و فعالیت‌های تازه ابلاغ‌شده',
    colorClass: 'text-sky-600 dark:text-sky-400',
    activeClass: 'bg-sky-600 text-white',
  },
  {
    key: 'IN_PROGRESS',
    label: 'در حال انجام',
    shortDesc: 'فعالیت‌های WBS و اقدامات اصلاحی جاری',
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    activeClass: 'bg-indigo-600 text-white',
  },
  {
    key: 'DOCS_NEEDING_COMPLETION',
    label: 'مدارک نیازمند تکمیل',
    shortDesc: 'اسناد فاقد شواهد کافی یا پیش‌نویس',
    colorClass: 'text-teal-600 dark:text-teal-400',
    activeClass: 'bg-teal-600 text-white',
  },
  {
    key: 'SUBMITTED_FOR_APPROVAL',
    label: 'ارسال‌شده برای تأیید',
    shortDesc: 'مدارک و شواهد در صف بررسی و صحه‌گذاری',
    colorClass: 'text-blue-600 dark:text-blue-400',
    activeClass: 'bg-blue-600 text-white',
  },
  {
    key: 'RETURNED_FOR_REWORK',
    label: 'موارد برگشت‌خورده',
    shortDesc: 'اسناد یا دروازه‌های ردشده نیازمند اصلاح',
    colorClass: 'text-rose-600 dark:text-rose-400',
    activeClass: 'bg-rose-600 text-white',
  },
  {
    key: 'DUE_SOON',
    label: 'نزدیک به سررسید',
    shortDesc: 'مهلت کمتر از ۷ روز کاری آینده',
    colorClass: 'text-blue-600 dark:text-blue-400',
    activeClass: 'bg-blue-500 text-white',
  },
  {
    key: 'OVERDUE',
    label: 'وظایف معوق',
    shortDesc: 'گذشته از سررسید مصوب نیازمند اقدام فوری',
    colorClass: 'text-red-600 dark:text-red-400',
    activeClass: 'bg-red-600 text-white',
  },
  {
    key: 'DECISIONS_REQUIRED',
    label: 'تصمیم‌های موردنیاز',
    shortDesc: 'تأیید مدارک، صحه‌گذاری CAPA و دروازه‌ها',
    colorClass: 'text-purple-600 dark:text-purple-400',
    activeClass: 'bg-purple-600 text-white',
  },
];

export function PsmPersonalWorkspace({
  currentUser,
  activeProject,
  projectData,
  onNavigateSubTab,
  onExecuteDeepLink,
  onRefresh,
}: PsmPersonalWorkspaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | UnifiedTaskCategoryKey>('ALL');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(false);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const userName = currentUser?.fullName || currentUser?.username || 'کاربر سامانه';
  const userRole = currentUser?.role || 'کارشناس استقرار PSM';

  const stageGates = projectData.stageGates || [];

  const allActionItems = useMemo(() => {
    return computeUnifiedActionCenterItems(currentUser, activeProject, projectData, stageGates);
  }, [currentUser, activeProject, projectData, stageGates]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    ACTION_CENTER_CATEGORIES.forEach((c) => {
      if (c.key !== 'ALL') counts[c.key] = 0;
    });

    for (const item of allActionItems) {
      if (onlyMyTasks && !item.isAssignedToCurrentUser) {
        continue;
      }
      counts.ALL = (counts.ALL || 0) + 1;
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [allActionItems, onlyMyTasks]);

  const filteredItems = useMemo(() => {
    return allActionItems.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false;
      if (onlyMyTasks && !item.isAssignedToCurrentUser) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${item.recordCode} ${item.titleFa} ${item.plainExplanationFa} ${item.unitNameFa} ${item.responsiblePersonFa} ${item.categoryLabelFa}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allActionItems, selectedCategory, priorityFilter, onlyMyTasks, searchQuery]);

  const handleRunDeepLink = (deepLink: PsmDeepLinkAction) => {
    if (onExecuteDeepLink) {
      onExecuteDeepLink(deepLink);
    } else {
      onNavigateSubTab(deepLink.targetSubTab);
    }
  };

  return (
    <div className="space-y-5 text-right font-sans" dir="rtl">
      {/* Header Profile & Guided Specialist Strip */}
      <div className="bg-gradient-to-r from-blue-500/10 via-white to-teal-500/10 dark:from-blue-950/25 dark:via-slate-900 dark:to-teal-950/25 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  کارتابل یکپارچه «کارهای من» — {userName}
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300">
                  {userRole}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300">
                  محیط عملیاتی و وظیفه‌محور (۸ دسته‌بندی استاندارد)
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                پروژه فعال:{' '}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {activeProject ? `${activeProject.code} — ${activeProject.name}` : 'پروژه‌ای انتخاب نشده است'}
                </span>{' '}
                — تمامی وظایف، مدارک نیازمند تکمیل، موارد برگشت‌خورده و تصمیم‌های منتظر اقدام در این کارتابل متمرکز شده‌اند.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateSubTab('command-center')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-800 dark:text-blue-300 text-xs font-black transition cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>مسیر استقرار PSM و راهنمای مفاهیم</span>
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="بروزرسانی کارتابل"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 8 Category Selector Cards (بخش ۶ پرامپت: ۸ دسته اجباری کارتابل «کارهای من») */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2.5">
        {ACTION_CENTER_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          const count = categoryCounts[cat.key] || 0;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategory(cat.key)}
              className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? `${cat.activeClass} border-transparent shadow-sm`
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-[11px] font-black leading-tight ${
                    isSelected ? 'text-current' : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {cat.label}
                </span>
                <span
                  className={`font-mono text-sm font-black px-1.5 py-0.5 rounded-md ${
                    isSelected
                      ? 'bg-black/20 text-white'
                      : count > 0
                      ? 'bg-slate-100 dark:bg-slate-800 ' + cat.colorClass
                      : 'text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </div>
              <p
                className={`text-[10px] mt-1.5 line-clamp-1 ${
                  isSelected ? 'opacity-90' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {cat.shortDesc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="جستجوی کد، عنوان کار، واحد یا مسئول..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setOnlyMyTasks(false)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  !onlyMyTasks
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                کل کارهای باز پروژه ({allActionItems.length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyMyTasks(true)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  onlyMyTasks
                    ? 'bg-blue-600 text-white font-black shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                فقط کارهای مرتبط با من
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 flex items-center gap-1 ml-1">
              <Filter className="w-3.5 h-3.5" />
              اولویت:
            </span>
            {(
              [
                { id: 'ALL', label: 'همه' },
                { id: 'CRITICAL', label: 'بحرانی' },
                { id: 'HIGH', label: 'فوری' },
                { id: 'MEDIUM', label: 'متوسط' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriorityFilter(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  priorityFilter === p.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Items List */}
        {filteredItems.length === 0 ? (
          <div className="p-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2.5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
              هیچ موردی در این دسته‌بندی یافت نشد
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              تمامی اقدامات این بخش تکمیل شده‌اند یا فیلتر جستجو نتیجه‌ای ندارد. برای مشاهده سایر کارها، دسته «همه کارها» را انتخاب کنید.
            </p>
            {selectedCategory !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setPriorityFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                نمایش همه کارهای پروژه
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredItems.map((item) => {
              const priorityBadge =
                item.priority === 'CRITICAL'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
                  : item.priority === 'HIGH'
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                  : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                    item.category === 'OVERDUE' || item.category === 'RETURNED_FOR_REWORK'
                      ? 'border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/15'
                      : item.category === 'DECISIONS_REQUIRED'
                      ? 'border-purple-500/40 bg-purple-500/5 dark:bg-purple-950/15'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-500/40'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          {item.recordCode}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-300">
                          {item.categoryLabelFa}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${priorityBadge}`}>
                        {item.priorityLabelFa}
                      </span>
                    </div>

                    <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-snug">
                      {item.titleFa}
                    </h5>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.plainExplanationFa}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">واحد مشمول: </span>
                        {item.unitNameFa}
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">مسئول اقدام: </span>
                        {item.responsiblePersonFa}
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">مهلت: </span>
                        <span className="font-mono">{item.dueDateFa}</span>
                      </div>
                      <div>
                        <span
                          className={`font-bold ${
                            item.isOverdue
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {item.statusLabelFa}
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="font-black text-teal-700 dark:text-teal-400">مدرک / خروجی موردنیاز: </span>
                      {item.requiredEvidenceFa}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 truncate">
                      {item.deepLink.contextHintFa}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRunDeepLink(item.deepLink)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 hover:text-white dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 text-white text-xs font-black transition shrink-0 cursor-pointer shadow-2xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{item.deepLink.buttonLabelFa || 'انجام این کار'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
