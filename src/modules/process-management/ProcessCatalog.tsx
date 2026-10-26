import React, { useEffect, useState } from 'react';
import {
  PlayCircle,
  Activity,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  X,
  Search,
  Clock,
  ShieldCheck,
  Flame,
  HeartPulse,
  GraduationCap,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  Layers,
  Sparkles,
  Zap,
  ArrowRight,
  Globe,
  Plus
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { WorkflowItem } from './types';
import { getCurrentUser } from '../../utils/authHelper';
import { getUnits } from '../../utils/orgHelper';

interface Props {
  language: 'fa' | 'en';
  onEdit?: (id: string) => void;
  onViewTracker?: (instanceId?: string) => void;
  onRefreshStats?: () => void;
}

const categoryIcons: Record<string, any> = {
  safety: ShieldCheck,
  fire: Flame,
  health: HeartPulse,
  environment: Globe,
  training: GraduationCap,
  audit: ClipboardCheck,
  operations: Layers
};

const categoryLabels: Record<string, { fa: string; en: string; color: string }> = {
  safety: { fa: 'ایمنی و پروانه‌ها', en: 'Safety & PTW', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40' },
  fire: { fa: 'آتش‌نشانی و امداد', en: 'Fire & Emergency', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40' },
  health: { fa: 'بهداشت و طب کار', en: 'Occupational Health', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40' },
  environment: { fa: 'محیط‌زیست، پسماند و پساب', en: 'Environment & EMP', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/40' },
  training: { fa: 'آموزش و صلاحیت', en: 'Training & Skills', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40' },
  audit: { fa: 'ممیزی، عدم انطباق و ۵S', en: 'Audit & CAPA', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40' },
  operations: { fa: 'عملیات و لجستیک', en: 'Operations', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800/40' }
};

export default function ProcessCatalog({ language, onEdit, onViewTracker, onRefreshStats }: Props) {
  const isFa = language === 'fa';
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Launch modal state
  const [launchingWf, setLaunchingWf] = useState<WorkflowItem | null>(null);
  const [launchTitle, setLaunchTitle] = useState('');
  const [launchPriority, setLaunchPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [launchDepartment, setLaunchDepartment] = useState(() => getUnits()[0] || '');
  const [launchNote, setLaunchNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview steps modal
  const [previewStepsWf, setPreviewStepsWf] = useState<WorkflowItem | null>(null);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/v1/process-management/workflows');
      if (res.data.success && Array.isArray(res.data.data)) {
        setWorkflows(res.data.data);
      }
    } catch (e) {
      console.error(e);
      toast.error(isFa ? 'خطا در دریافت لیست فرآیندها' : 'Error fetching workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleResetWorkflows = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/v1/process-management/workflows/reset');
      if (res.data.success) {
        toast.success(isFa ? 'مخزن فرآیندها با موفقیت پاکسازی شد.' : 'Workflows catalog reset successfully.');
        fetchWorkflows();
        onRefreshStats?.();
      }
    } catch (e) {
      toast.error(isFa ? 'خطا در بارگذاری مجدد فرآیندها' : 'Error resetting workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await axios.delete(`/api/v1/process-management/workflows/${id}`);
      if (res.data.success) {
        toast.success(isFa ? 'فرآیند با موفقیت حذف شد' : 'Workflow deleted successfully');
        setDeleteConfirm(null);
        fetchWorkflows();
        onRefreshStats?.();
      }
    } catch (error) {
      console.error(error);
      toast.error(isFa ? 'خطا در حذف فرآیند' : 'Error deleting workflow');
    }
  };

  const openLaunchModal = (wf: WorkflowItem) => {
    setLaunchingWf(wf);
    setLaunchTitle(`${wf.name} - ${new Date().toLocaleDateString(isFa ? 'fa-IR' : 'en-US')}`);
    setLaunchPriority('medium');
    setLaunchNote('');
  };

  const handleExecuteLaunch = async () => {
    if (!launchingWf) return;
    try {
      setIsSubmitting(true);
      const user = getCurrentUser();
      const response = await axios.post('/api/v1/process-management/start-instance', {
        workflowId: launchingWf.id,
        title: launchTitle,
        variables: {
          priority: launchPriority,
          initialComment: launchNote,
          department: launchDepartment
        },
        initiatorInfo: {
          username: user?.username || 'current_user',
          fullName: user?.fullName || user?.username || 'کاربر ارشد HSE',
          department: user?.departmentIds?.[0] || launchDepartment
        }
      });

      if (response.data.success) {
        toast.success(isFa ? 'گردش‌کار جدید با موفقیت آغاز شد و به کارتابل ارجاع گردید.' : 'Process instance started and assigned.');
        setLaunchingWf(null);
        fetchWorkflows();
        onRefreshStats?.();
        if (onViewTracker) {
          onViewTracker(response.data.data?.instance?.id);
        }
      }
    } catch (error) {
      toast.error(isFa ? 'خطا در شروع گردش‌کار' : 'Error starting workflow instance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredWorkflows = workflows.filter(w => {
    const matchesCat = selectedCategory === 'all' || w.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      w.name.toLowerCase().includes(q) ||
      w.descriptionFa?.toLowerCase().includes(q) ||
      w.module_type?.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const categories = [
    { id: 'all', labelFa: 'همه ماژول‌ها', labelEn: 'All Modules', count: workflows.length },
    { id: 'safety', labelFa: 'ایمنی و پروانه‌ها', labelEn: 'Safety & PTW', count: workflows.filter(w => w.category === 'safety').length },
    { id: 'fire', labelFa: 'آتش‌نشانی و امداد', labelEn: 'Fire Dept', count: workflows.filter(w => w.category === 'fire').length },
    { id: 'health', labelFa: 'بهداشت و طب کار', labelEn: 'Health & Medical', count: workflows.filter(w => w.category === 'health').length },
    { id: 'environment', labelFa: 'محیط‌زیست و پسماند', labelEn: 'Environment & EMP', count: workflows.filter(w => w.category === 'environment').length },
    { id: 'training', labelFa: 'آموزش HSE', labelEn: 'Training', count: workflows.filter(w => w.category === 'training').length },
    { id: 'audit', labelFa: 'ممیزی، CAPA و ۵S', labelEn: 'Audit & CAPA', count: workflows.filter(w => w.category === 'audit').length },
    { id: 'operations', labelFa: 'عملیات و لجستیک', labelEn: 'Operations', count: workflows.filter(w => w.category === 'operations').length }
  ];

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {isFa ? 'کاتالوگ جامع فرآیندها و گردش‌کارهای HSE' : 'HSE Enterprise Process Directory & Catalog'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isFa
              ? 'تمامی فرآیندهای عملیاتی سازمانی همراه با ایستگاه‌های تایید، زمان مجاز SLA، نقش‌های مسئول و موتور اجرای زنده'
              : 'End-to-end operational workflows with automated triggers, approval gates, SLAs, and live execution'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isFa ? 'جستجوی فرآیند یا ماژول...' : 'Search workflow or module...'}
              className="pr-9 pl-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 w-56 sm:w-64"
            />
          </div>

          {/* Create New Workflow */}
          <button
            onClick={() => onEdit?.('new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'ایجاد فرآیند جدید' : 'New Workflow'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchWorkflows}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            title={isFa ? 'بروزرسانی' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 custom-scrollbar">
        {categories.map(cat => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700/70 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>{isFa ? cat.labelFa : cat.labelEn}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
              }`}>
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Workflows Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-xs text-slate-400">{isFa ? 'در حال بارگذاری فرآیندهای سازمانی...' : 'Loading enterprise workflows...'}</p>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
              {isFa ? 'هیچ فرآیندی در مخزن وجود ندارد.' : 'No workflows registered.'}
            </p>
            <p className="text-xs text-slate-400 mb-4 max-w-md">
              {isFa
                ? 'قالب‌های پیش‌فرض حذف شده‌اند. می‌توانید با استفاده از طراح BPMN فرآیندهای کاری سفارشی سازمان خود را پیاده‌سازی و ذخیره کنید.'
                : 'All default templates have been removed. Use the BPMN Designer to create and save your custom organization workflows.'}
            </p>
            <button
              onClick={() => onEdit?.('new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{isFa ? 'طراحی فرآیند جدید' : 'Design New Workflow'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-6">
            {filteredWorkflows.map(wf => {
              const CatIcon = categoryIcons[wf.category] || Layers;
              const catMeta = categoryLabels[wf.category] || categoryLabels.safety;
              const activeCount = wf.activeInstancesCount || 0;

              return (
                <div
                  key={wf.id}
                  className="group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${catMeta.color}`}>
                        <CatIcon className="w-3.5 h-3.5" />
                        {isFa ? catMeta.fa : catMeta.en}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {activeCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                            <Zap className="w-3 h-3 animate-pulse" />
                            {activeCount} {isFa ? 'در جریان' : 'running'}
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                          v{wf.version || 1}.0
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                      {wf.name}
                    </h4>

                    {/* Description */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-3">
                      {isFa ? wf.descriptionFa : (wf.descriptionEn || wf.descriptionFa)}
                    </p>

                    {/* Step Flowchart Preview Pills */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 mb-4">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {isFa ? `مراحل فرآیند (${wf.steps?.length || 0} گام)` : `Steps (${wf.steps?.length || 0})`}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" />
                          SLA: {wf.slaHours || 24}h
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {wf.steps?.slice(0, 3).map((st, idx) => (
                          <div key={st.id || idx} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate flex-1">{isFa ? st.titleFa : st.titleEn}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-700/60 text-slate-500 shrink-0">
                              {st.assignedRole}
                            </span>
                          </div>
                        ))}
                        {wf.steps && wf.steps.length > 3 && (
                          <button
                            onClick={() => setPreviewStepsWf(wf)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline pt-1 block"
                          >
                            + {wf.steps.length - 3} {isFa ? 'گام دیگر (مشاهده کامل نقشه)' : 'more steps (view all)'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openLaunchModal(wf)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/10"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>{isFa ? 'شروع گردش‌کار' : 'Launch'}</span>
                    </button>

                    <button
                      onClick={() => setPreviewStepsWf(wf)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      title={isFa ? 'مشاهده شناسنامه و گام‌ها' : 'View Workflow Steps'}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onEdit?.(wf.id)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                      title={isFa ? 'ویرایش در طراح BPMN' : 'Edit in BPMN Modeler'}
                    >
                      <Edit3 className="w-4 h-4 text-sky-500" />
                    </button>

                    {deleteConfirm === wf.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(wf.id)}
                          className="px-2 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-bold"
                        >
                          {isFa ? 'حذف' : 'Del'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(wf.id)}
                        className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-colors"
                        title={isFa ? 'حذف فرآیند' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Launch Instance Modal */}
      {launchingWf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {isFa ? 'راه‌اندازی و اجرای نمونه جدید' : 'Launch New Workflow Instance'}
                  </h4>
                  <p className="text-[11px] text-slate-400">{launchingWf.name}</p>
                </div>
              </div>
              <button
                onClick={() => setLaunchingWf(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'عنوان / موضوع گردش‌کار' : 'Instance Title'}
                </label>
                <input
                  type="text"
                  value={launchTitle}
                  onChange={(e) => setLaunchTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'سطح اولویت' : 'Priority Level'}
                  </label>
                  <select
                    value={launchPriority}
                    onChange={(e: any) => setLaunchPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  >
                    <option value="low">{isFa ? 'عادی / کم' : 'Low'}</option>
                    <option value="medium">{isFa ? 'متوسط' : 'Medium'}</option>
                    <option value="high">{isFa ? 'بالا / فوری' : 'High'}</option>
                    <option value="critical">{isFa ? 'بحرانی (Critical)' : 'Critical'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isFa ? 'واحد درخواست‌کننده' : 'Department'}
                  </label>
                  <input
                    type="text"
                    list="process-catalog-units-list"
                    value={launchDepartment}
                    onChange={(e) => setLaunchDepartment(e.target.value)}
                    placeholder={isFa ? 'انتخاب یا درج واحد سازمانی...' : 'Select unit...'}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                  />
                  <datalist id="process-catalog-units-list">
                    {getUnits().map(u => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {isFa ? 'توضیحات اولیه و یادداشت راهنما' : 'Initial Comment & Notes'}
                </label>
                <textarea
                  rows={3}
                  value={launchNote}
                  onChange={(e) => setLaunchNote(e.target.value)}
                  placeholder={isFa ? 'اطلاعات تکمیلی، شماره ارجاع یا ملاحظات خاص...' : 'Additional information...'}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>

              {/* Initial step preview */}
              <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-800/30 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  {isFa
                    ? `پس از شروع، وظیفه گام اول به نقش «${launchingWf.steps?.[0]?.assignedRole || 'کارشناس HSE'}» ارجاع داده خواهد شد و زمان مجاز آن ${launchingWf.steps?.[0]?.slaHours || 4} ساعت است.`
                    : `Initial task will be assigned to role: ${launchingWf.steps?.[0]?.assignedRole || 'HSE Officer'}.`}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-2.5">
              <button
                onClick={() => setLaunchingWf(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={handleExecuteLaunch}
                disabled={isSubmitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isFa ? 'در حال ایجاد...' : 'Starting...'}</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>{isFa ? 'تایید و شروع گردش‌کار' : 'Confirm & Launch'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steps Preview Modal */}
      {previewStepsWf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {previewStepsWf.name}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isFa ? `شناسنامه گردش‌کار و مسیر تاییدات (${previewStepsWf.steps?.length || 0} گام)` : 'Workflow Steps & Lifecycle'}
                </p>
              </div>
              <button
                onClick={() => setPreviewStepsWf(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper List */}
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-3">
              {previewStepsWf.steps?.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h5 className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                        {isFa ? step.titleFa : step.titleEn}
                      </h5>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        {step.slaHours}h SLA
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{isFa ? 'نقش مسئول:' : 'Role:'} <strong className="text-slate-700 dark:text-slate-200">{step.assignedRole}</strong></span>
                      <span>•</span>
                      <span>{isFa ? 'نوع اقدام:' : 'Action:'} <strong className="text-slate-700 dark:text-slate-200">{step.actionType}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <button
                onClick={() => {
                  const wf = previewStepsWf;
                  setPreviewStepsWf(null);
                  onEdit?.(wf.id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isFa ? 'ویرایش دیاگرام BPMN' : 'Edit BPMN Diagram'}</span>
              </button>

              <button
                onClick={() => {
                  const wf = previewStepsWf;
                  setPreviewStepsWf(null);
                  openLaunchModal(wf);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <PlayCircle className="w-4 h-4" />
                <span>{isFa ? 'شروع این فرآیند' : 'Launch This Process'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
