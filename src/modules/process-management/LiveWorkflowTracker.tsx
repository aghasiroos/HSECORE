import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  Search,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Flame,
  HeartPulse,
  GraduationCap,
  ClipboardCheck,
  Layers,
  User,
  ArrowRight,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { WorkflowInstance, WorkflowItem } from './types';

interface Props {
  language: 'fa' | 'en';
  highlightInstanceId?: string | null;
  onRefreshStats?: () => void;
}

export default function LiveWorkflowTracker({ language, highlightInstanceId, onRefreshStats }: Props) {
  const isFa = language === 'fa';
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [instRes, wfRes] = await Promise.all([
        axios.get('/api/v1/process-management/instances'),
        axios.get('/api/v1/process-management/workflows')
      ]);

      if (instRes.data.success && Array.isArray(instRes.data.data)) {
        setInstances(instRes.data.data);
        if (highlightInstanceId) {
          const matched = instRes.data.data.find((i: WorkflowInstance) => i.id === highlightInstanceId);
          if (matched) setSelectedInstance(matched);
        } else if (instRes.data.data.length > 0 && !selectedInstance) {
          setSelectedInstance(instRes.data.data[0]);
        }
      }

      if (wfRes.data.success && Array.isArray(wfRes.data.data)) {
        setWorkflows(wfRes.data.data);
      }
    } catch (e) {
      console.error(e);
      toast.error(isFa ? 'خطا در بارگذاری نمونه‌های در حال اجرا' : 'Error loading instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [highlightInstanceId]);

  const filteredInstances = instances.filter(i => {
    const matchesState = selectedState === 'ALL' || i.state === selectedState;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      i.id.toLowerCase().includes(q) ||
      i.title.toLowerCase().includes(q) ||
      i.workflowName.toLowerCase().includes(q) ||
      i.initiatorName.toLowerCase().includes(q);
    return matchesState && matchesSearch;
  });

  const matchedWorkflow = selectedInstance
    ? workflows.find(w => w.id === selectedInstance.workflowId)
    : null;

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-emerald-500" />
            {isFa ? 'مانیتورینگ و رهگیری زنده فرآیندهای سازمانی' : 'Live Process Instances & Execution Tracker'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isFa
              ? 'نمایش لحظه‌ای وضعیت، گلوگاه‌ها، زمان‌بندی و سیر پیشرفت تمامی پرونده‌های جاری در سایت'
              : 'Real-time workflow execution, bottlenecks, SLAs, and visual lifecycle tracking'}
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
              placeholder={isFa ? 'شناسه یا عنوان پرونده...' : 'Search instance ID or title...'}
              className="pr-9 pl-4 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 w-52 sm:w-60"
            />
          </div>

          <button
            onClick={fetchData}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            title={isFa ? 'بروزرسانی' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split Grid (List & Visual Stepper) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* Left column: Instances Directory */}
        <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm">
          {/* State Filter tabs */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 overflow-x-auto bg-slate-50/50 dark:bg-slate-900/40">
            {[
              { id: 'ALL', labelFa: 'همه', labelEn: 'All', count: instances.length },
              { id: 'ACTIVE', labelFa: 'در جریان', labelEn: 'Active', count: instances.filter(i => i.state === 'ACTIVE').length },
              { id: 'COMPLETED', labelFa: 'مختومه / تکمیل', labelEn: 'Done', count: instances.filter(i => i.state === 'COMPLETED').length },
              { id: 'REJECTED', labelFa: 'رد شده', labelEn: 'Rejected', count: instances.filter(i => i.state === 'REJECTED').length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedState(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  selectedState === tab.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <span>{isFa ? tab.labelFa : tab.labelEn}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedState === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {loading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : filteredInstances.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                {isFa ? 'هیچ موردی با این فیلتر یافت نشد.' : 'No instances found.'}
              </div>
            ) : (
              filteredInstances.map(inst => {
                const isSelected = selectedInstance?.id === inst.id;
                return (
                  <div
                    key={inst.id}
                    onClick={() => setSelectedInstance(inst)}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 border-slate-100 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {inst.id}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        inst.state === 'ACTIVE'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          : inst.state === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      }`}>
                        {inst.state === 'ACTIVE' ? (isFa ? 'در جریان' : 'Active') : inst.state === 'COMPLETED' ? (isFa ? 'تکمیل شده' : 'Completed') : (isFa ? 'رد شده' : 'Rejected')}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1 line-clamp-1">
                      {inst.title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/40">
                      <span>{inst.workflowName}</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(inst.startedAt).toLocaleTimeString(isFa ? 'fa-IR' : 'en-US')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: Interactive Visual Node Stepper & Details */}
        <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden shadow-sm p-6">
          {selectedInstance ? (
            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar pr-1">
              {/* Top Details Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 mb-6">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
                      {selectedInstance.id}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {selectedInstance.department}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(selectedInstance.startedAt).toLocaleDateString(isFa ? 'fa-IR' : 'en-US')}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
                  {selectedInstance.title}
                </h3>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/50">
                  <span>{isFa ? 'ایجادکننده:' : 'Initiator:'} <strong className="text-slate-700 dark:text-slate-200">{selectedInstance.initiatorName}</strong></span>
                  <span>•</span>
                  <span>{isFa ? 'فرآیند:' : 'Workflow:'} <strong className="text-slate-700 dark:text-slate-200">{selectedInstance.workflowName}</strong></span>
                  <span>•</span>
                  <span>{isFa ? 'اولویت:' : 'Priority:'} <strong className="text-amber-600 uppercase">{selectedInstance.priority}</strong></span>
                </div>
              </div>

              {/* Visual Flow Progression Nodes */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {isFa ? 'مسیر پیشرفت گام‌ها و گیت‌های تصمیم‌گیری' : 'Workflow Execution Stages & Gates'}
                </h4>

                <div className="relative pl-6 rtl:pl-0 rtl:pr-6 space-y-6 before:absolute before:top-3 before:bottom-3 before:right-2.5 rtl:before:right-2.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  {matchedWorkflow?.steps?.map((step, idx) => {
                    const isCompleted = idx < selectedInstance.currentStepIndex || selectedInstance.state === 'COMPLETED';
                    const isCurrent = idx === selectedInstance.currentStepIndex && selectedInstance.state === 'ACTIVE';
                    const isRejected = selectedInstance.state === 'REJECTED' && idx === selectedInstance.currentStepIndex;
                    const isFuture = idx > selectedInstance.currentStepIndex && selectedInstance.state !== 'COMPLETED';

                    return (
                      <div key={step.id || idx} className="relative flex items-start gap-4">
                        {/* Node circle */}
                        <div className={`absolute -right-6 rtl:-right-6 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all ${
                          isCompleted
                            ? 'bg-emerald-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-900/30'
                            : isCurrent
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40 animate-pulse'
                            : isRejected
                            ? 'bg-rose-500 text-white ring-4 ring-rose-100 dark:ring-rose-900/30'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 ring-4 ring-slate-100 dark:ring-slate-800'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : isRejected ? <XCircle className="w-3.5 h-3.5" /> : idx + 1}
                        </div>

                        {/* Step Card */}
                        <div className={`flex-1 p-4 rounded-xl border transition-all mr-2 rtl:mr-2 ${
                          isCurrent
                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700 shadow-xs'
                            : isCompleted
                            ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-700/60'
                            : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-60'
                        }`}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                              {isFa ? step.titleFa : step.titleEn}
                            </h5>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : isCurrent
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : isRejected
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-700'
                            }`}>
                              {isCompleted ? (isFa ? 'انجام شد' : 'Done') : isCurrent ? (isFa ? 'در حال اقدام' : 'In Progress') : isRejected ? (isFa ? 'رد گردید' : 'Rejected') : (isFa ? 'در انتظار' : 'Pending')}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{isFa ? 'نقش اقدام‌کننده:' : 'Role:'} <strong className="text-slate-700 dark:text-slate-200">{step.assignedRole}</strong></span>
                            <span>•</span>
                            <span>SLA: {step.slaHours}h</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audit Trail Timeline */}
              {selectedInstance.history && selectedInstance.history.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {isFa ? 'لاگ رویدادها و تصمیمات ثبت شده' : 'Chronological Action History'}
                  </h4>

                  <div className="space-y-2">
                    {selectedInstance.history.map((h, i) => (
                      <div key={i} className="flex items-start justify-between text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{h.actorName || h.actor}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
                              {h.action}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{h.comments || h.stepTitleFa}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(h.timestamp).toLocaleTimeString(isFa ? 'fa-IR' : 'en-US')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
              <Info className="w-12 h-12 mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-bold">{isFa ? 'لطفاً یک پرونده را از ستون کناری انتخاب کنید.' : 'Select an instance to view tracking diagram.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
