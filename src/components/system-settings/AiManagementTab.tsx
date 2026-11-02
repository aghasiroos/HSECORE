import React, { useState, useEffect } from 'react';
import {
  Bot,
  Cpu,
  Database,
  Server,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  Download,
  Trash2,
  Sliders,
  ShieldCheck,
  Activity,
  HardDrive
} from 'lucide-react';
import { UserProfile } from '../../types';
import { authFetch } from '../../services/apiDatabaseClient';
import { AI_ALLOW_TOOLS_STORAGE_KEY, getAiAllowToolsSetting } from '../../modules/ai/AiAssistantApp';

interface AiManagementTabProps {
  language?: 'fa' | 'en';
  currentUser?: UserProfile | null;
}

export default function AiManagementTab({ language = 'fa', currentUser }: AiManagementTabProps) {
  const isFa = language === 'fa';
  const [loading, setLoading] = useState<boolean>(true);
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [installedModels, setInstalledModels] = useState<any[]>([]);
  const [auditData, setAuditData] = useState<any>(null);
  const [pullModelName, setPullModelName] = useState<string>('qwen2.5:1.5b');
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [allowTools, setAllowTools] = useState<boolean>(getAiAllowToolsSetting);

  const handleToggleAllowTools = () => {
    const next = !allowTools;
    setAllowTools(next);
    try {
      localStorage.setItem(AI_ALLOW_TOOLS_STORAGE_KEY, String(next));
    } catch {}
  };

  // RAG Knowledge Base States
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [showAddDocModal, setShowAddDocModal] = useState<boolean>(false);
  const [newDocTitle, setNewDocTitle] = useState<string>('');
  const [newDocCategory, setNewDocCategory] = useState<string>('GENERAL');
  const [newDocSummary, setNewDocSummary] = useState<string>('');
  const [newDocContent, setNewDocContent] = useState<string>('');
  const [isIndexingDoc, setIsIndexingDoc] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, modelsRes, auditRes, docsRes] = await Promise.all([
        authFetch('/api/v1/ai/status').then(r => r.json()).catch(() => null),
        authFetch('/api/v1/ai/models').then(r => r.json()).catch(() => null),
        authFetch('/api/v1/ai/audit?limit=20').then(r => r.json()).catch(() => null),
        authFetch('/api/v1/ai/knowledge').then(r => r.json()).catch(() => null),
      ]);

      if (statusRes?.success) setEngineStatus(statusRes.data);
      if (modelsRes?.success) setInstalledModels(modelsRes.data || []);
      if (auditRes?.success) setAuditData(auditRes.data);
      if (docsRes?.success) setKnowledgeDocs(docsRes.data || []);
    } catch (err) {
      console.error('Failed to load AI management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim() || isIndexingDoc) return;
    setIsIndexingDoc(true);
    setActionMessage(null);
    try {
      const res = await authFetch('/api/v1/ai/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newDocTitle.trim(),
          category: newDocCategory,
          summary: newDocSummary.trim(),
          content: newDocContent.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: data.message || 'سند با موفقیت نمایه شد.', type: 'success' });
        setNewDocTitle('');
        setNewDocSummary('');
        setNewDocContent('');
        setShowAddDocModal(false);
        fetchData();
      } else {
        setActionMessage({ text: data.message || data.error?.message || 'خطا در ثبت سند.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'خطا در ارتباط با سرور.', type: 'error' });
    } finally {
      setIsIndexingDoc(false);
    }
  };

  // Modal confirmation states (avoiding window.confirm in iframe sandbox)
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<number | null>(null);
  const [confirmDeleteModelName, setConfirmDeleteModelName] = useState<string | null>(null);

  const handleDeleteDoc = async (id: number) => {
    try {
      const res = await authFetch(`/api/v1/ai/knowledge/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: data.message || 'سند با موفقیت حذف شد.', type: 'success' });
        fetchData();
      } else {
        setActionMessage({ text: data.message || data.error?.message || 'خطا در حذف سند.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'خطا در ارتباط با سرور.', type: 'error' });
    } finally {
      setConfirmDeleteDocId(null);
    }
  };

  const handleSearchKnowledge = async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    try {
      const res = await authFetch('/api/v1/ai/knowledge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim(), topK: 3 }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data || []);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePullModel = async () => {
    if (!pullModelName.trim() || isPulling) return;
    setIsPulling(true);
    setActionMessage(null);
    try {
      const res = await authFetch('/api/v1/ai/models/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName: pullModelName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: data.message || `مدل ${pullModelName} با موفقیت بارگیری شد.`, type: 'success' });
        fetchData();
      } else {
        setActionMessage({ text: data.message || data.error?.message || 'خطا در بارگیری مدل.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'خطا در برقراری ارتباط با سرور.', type: 'error' });
    } finally {
      setIsPulling(false);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    try {
      const res = await authFetch(`/api/v1/ai/models/${encodeURIComponent(modelName)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage({ text: data.message || `مدل ${modelName} با موفقیت حذف شد.`, type: 'success' });
        fetchData();
      } else {
        setActionMessage({ text: data.message || data.error?.message || 'خطا در حذف مدل.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'خطا در ارتباط با سرور.', type: 'error' });
    } finally {
      setConfirmDeleteModelName(null);
    }
  };

  const isOnline = engineStatus?.isAvailable === true;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-200 dark:border-indigo-800">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                مدیریت و پایش هوش مصنوعی محلی (HSECORE Local AI)
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isOnline
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                {isOnline ? 'موتور آنلاین و آماده' : 'موتور در حال آماده‌سازی'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              موتور آفلاین استنتاج زبان طبیعی (Ollama Engine) ایزوله‌شده در شبکه داخلی داکر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={handleToggleAllowTools}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
              allowTools
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title="اتصال خودکار به داده‌های زنده تمامی ماژول‌های سامانه جهت پاسخ مستند"
          >
            <Database className="w-3.5 h-3.5" />
            <span>جستجو در تمام ماژول‌ها: {allowTools ? 'فعال' : 'غیرفعال'}</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>پایش مجدد وضعیت</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          actionMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
            : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300'
        }`}>
          {actionMessage.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Engine Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>آدرس کانتینر داخلی</span>
            <Server className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-black font-mono text-slate-800 dark:text-slate-100 truncate">
            {engineStatus?.engineUrl || 'http://hse-ai-engine:11434'}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>زمان پاسخگویی (Latency):</span>
            <span className="font-mono font-bold text-indigo-600">{engineStatus?.latencyMs ? `${engineStatus.latencyMs}ms` : '---'}</span>
          </div>
        </div>

        {/* Card 2: Resource Limits */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>سقف تخصیص سخت‌افزاری</span>
            <Cpu className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-sm font-black text-slate-800 dark:text-slate-100">
            ۴ هسته CPU / ۴ گیگابایت RAM
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>حفظ تعادل هاست:</span>
            <span className="text-emerald-600 font-bold">حفاظت ضد OOM فعال</span>
          </div>
        </div>

        {/* Card 3: Concurrency Queue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>صف درخواست‌های هوش مصنوعی</span>
            <Layers className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>همزمان: {engineStatus?.queue?.activeRequests ?? 0}</span>
            <span className="text-slate-400 font-normal">|</span>
            <span className="text-indigo-600">در انتظار: {engineStatus?.queue?.queuedRequests ?? 0}</span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>مجموع پردازش‌شده:</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{engineStatus?.queue?.totalProcessed ?? 0}</span>
          </div>
        </div>

        {/* Card 4: Persistent Volume */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>والیوم ذخیره‌سازی مدل‌ها</span>
            <HardDrive className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-sm font-black text-slate-800 dark:text-slate-100 font-mono">
            hse_ai_models
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>ماندگاری پس از آپدیت:</span>
            <span className="text-emerald-600 font-bold">۱۰۰٪ تضمین‌شده</span>
          </div>
        </div>
      </div>

      {/* Models Inventory & Pull Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>فهرست مدل‌های زبانی مستقر در حافظه پایدار</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              مدل‌های کوانتایز شده سبک GGUF جهت پاسخ‌گویی آفلاین بدون خروج داده‌ها از سرور
            </p>
          </div>

          {/* Pull Model Form */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={pullModelName}
              onChange={e => setPullModelName(e.target.value)}
              placeholder="مثال: qwen2.5:1.5b"
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 w-44"
            />
            <button
              onClick={handlePullModel}
              disabled={isPulling}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Download className={`w-3.5 h-3.5 ${isPulling ? 'animate-bounce' : ''}`} />
              <span>{isPulling ? 'در حال بارگیری...' : 'بارگیری مدل'}</span>
            </button>
          </div>
        </div>

        {/* Models List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                <th className="py-2.5 px-3">نام مدل و تگ</th>
                <th className="py-2.5 px-3">حجم دیسک</th>
                <th className="py-2.5 px-3">کوانتایزیشن</th>
                <th className="py-2.5 px-3">وضعیت</th>
                <th className="py-2.5 px-3 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {installedModels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    مدلی در حافظه پایدار کانتینر شناسایی نشد یا سرویس در حال راه‌اندازی است.
                  </td>
                </tr>
              ) : (
                installedModels.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-100">
                      {m.name || m.model}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {m.size ? `${(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : '---'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {m.details?.quantization_level || 'Q4_K_M'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        مستقر در سرور
                      </span>
                    </td>
                    <td className="py-3 px-3 text-left">
                      {confirmDeleteModelName === (m.name || m.model) ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleDeleteModel(m.name || m.model)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                          >
                            تایید
                          </button>
                          <button
                            onClick={() => setConfirmDeleteModelName(null)}
                            className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold transition cursor-pointer"
                          >
                            انصراف
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteModelName(m.name || m.model)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-md transition cursor-pointer"
                          title="حذف مدل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Usage & Audit Log Summary */}
      {auditData?.analytics && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Activity className="w-4 h-4 text-indigo-500" />
            <span>آمار مصرف و تعامل با دستیاران تخصصی</span>
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400">تعداد درخواست‌ها</div>
              <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1">
                {auditData.analytics.totalRequests}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400">میانگین زمان پردازش</div>
              <div className="text-base font-black text-indigo-600 mt-1 font-mono">
                {auditData.analytics.avgDurationMs}ms
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400">کاراکترهای پرسش</div>
              <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1 font-mono">
                {auditData.analytics.totalPromptChars}
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-400">کاراکترهای پاسخ</div>
              <div className="text-base font-black text-slate-800 dark:text-slate-100 mt-1 font-mono">
                {auditData.analytics.totalResponseChars}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RAG Knowledge Base Management Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              <span>پایگاه دانش اسناد و RAG معنایی سازمانی</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              اسناد، دستورالعمل‌های HSE، آیین‌نامه‌ها و استانداردهای بارگذاری‌شده که دستیاران هوش مصنوعی با استناد به آن‌ها پاسخ می‌دهند.
            </p>
          </div>

          <button
            onClick={() => setShowAddDocModal(!showAddDocModal)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ثبت سند جدید در پایگاه دانش</span>
          </button>
        </div>

        {/* Add Document Form/Modal */}
        {showAddDocModal && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-4">
            <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">بارگذاری و نمایه‌سازی هوشمند سند در پایگاه دانش</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">عنوان سند:</label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={e => setNewDocTitle(e.target.value)}
                  placeholder="مثال: دستورالعمل صدور پروانه کار گرم و ایمنی جوشکاری"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">دسته‌بندی تخصصی:</label>
                <select
                  value={newDocCategory}
                  onChange={e => setNewDocCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="GENERAL">عمومی HSE</option>
                  <option value="PTW">پروانه‌های کار و SHERPA</option>
                  <option value="INCIDENT">حوادث و مدیریت بحران</option>
                  <option value="OCCUPATIONAL_HEALTH">بهداشت حرفه‌ای و طب کار</option>
                  <option value="ENVIRONMENT">محیط زیست و مدیریت پسماند</option>
                  <option value="5S">نظام آراستگی 5S</option>
                  <option value="STANDARDS">استانداردهای ملی و بین‌المللی</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">خلاصه کوتاه سند (اختیاری):</label>
              <input
                type="text"
                value={newDocSummary}
                onChange={e => setNewDocSummary(e.target.value)}
                placeholder="توضیح مختصر در مورد دامنه کاربرد سند"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">محتوای کامل سند (متن، چک‌لیست یا الزامات):</label>
              <textarea
                rows={5}
                value={newDocContent}
                onChange={e => setNewDocContent(e.target.value)}
                placeholder="متن کامل سند را در این قسمت وارد یا الصاق کنید..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddDocModal(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateDoc}
                disabled={isIndexingDoc}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${isIndexingDoc ? 'animate-bounce' : ''}`} />
                <span>{isIndexingDoc ? 'در حال خردسازی و نمایه‌سازی...' : 'ذخیره و قطعه‌بندی سند'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Semantic Search Tester */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              تست استعلام معنایی RAG از اسناد موجود
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="عبارت مورد جستجو در پایگاه دانش (مثال: اقدامات ایمنی جوشکاری در فضای بسته)..."
              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              onKeyDown={e => e.key === 'Enter' && handleSearchKnowledge()}
            />
            <button
              onClick={handleSearchKnowledge}
              disabled={isSearching}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>جستجو</span>
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-bold text-slate-400">نتایج بازیابی معنایی ({searchResults.length} قطعه همخوان):</div>
              <div className="grid grid-cols-1 gap-2">
                {searchResults.map((res: any, idx: number) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600">{res.docTitle || `سند #${res.docId}`}</span>
                      <span className="font-mono text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold">
                        امتیاز تطابق: {(res.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">{res.chunkText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Indexed Documents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                <th className="py-2.5 px-3">عنوان سند</th>
                <th className="py-2.5 px-3">دسته‌بندی</th>
                <th className="py-2.5 px-3">تعداد قطعات (Chunks)</th>
                <th className="py-2.5 px-3">ثبت‌کننده</th>
                <th className="py-2.5 px-3">تاریخ ثبت</th>
                <th className="py-2.5 px-3 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {knowledgeDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    هیچ سندی در پایگاه دانش ثبت نشده است. با ثبت سند جدید، دقت استنتاج دستیاران هوش مصنوعی را ارتقا دهید.
                  </td>
                </tr>
              ) : (
                knowledgeDocs.map((doc: any) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100">
                      {doc.title}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {doc.category || 'عمومی'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-indigo-600">
                      {doc.chunkCount ?? 0} قطعه
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {doc.uploadedBy || 'سیستم'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('fa-IR') : '---'}
                    </td>
                    <td className="py-3 px-3 text-left">
                      {confirmDeleteDocId === doc.id ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition cursor-pointer"
                          >
                            تایید
                          </button>
                          <button
                            onClick={() => setConfirmDeleteDocId(null)}
                            className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[10px] font-bold transition cursor-pointer"
                          >
                            انصراف
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteDocId(doc.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-md transition cursor-pointer"
                          title="حذف سند"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
