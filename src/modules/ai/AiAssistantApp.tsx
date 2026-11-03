import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  BookOpen,
  Database,
  MessageSquare,
  Download,
  Search,
  Square,
  Sliders,
  Layers,
  X,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { authFetch } from '../../services/apiDatabaseClient';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
  citations?: string[];
  durationMs?: number;
  model?: string;
  moduleScope?: string[];
}

interface AIModulePickerItem {
  moduleId: string;
  moduleNameFa: string;
  connected: boolean;
  allowed: boolean;
  enabled?: boolean;
  parentId?: string;
  notes?: string;
  children?: AIModulePickerItem[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export const AI_ALLOW_TOOLS_STORAGE_KEY = 'hsecore_ai_allow_tools';

export function getAiAllowToolsSetting(): boolean {
  try {
    const v = localStorage.getItem(AI_ALLOW_TOOLS_STORAGE_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

const GENERAL_AI_ASSISTANT = {
  id: 'GENERAL_HSE',
  nameFa: 'دستیار هوش مصنوعی',
  title: 'گفت‌وگوی عمومی و تحلیل داده‌های HSECORE',
  description: 'گفت‌وگوی عمومی با مدل محلی یا تحلیل مستند ماژول‌ها و گزارش مدیریتی با انتخاب / و /ALL.',
  promptSuggestions: [
    'مفهوم هوش مصنوعی مولد را ساده و با مثال توضیح بده.',
    'برای یادگیری یک مهارت جدید، برنامه ۳۰ روزه طراحی کن.',
    'این متن را خلاصه کن و نکات کلیدی آن را استخراج کن.',
    'برای حل یک مسئله پیچیده، مرحله‌به‌مرحله راهنمایی‌ام کن.',
  ],
};

interface AiAssistantAppProps {
  currentUser?: UserProfile | null;
  language?: 'fa' | 'en';
}

export default function AiAssistantApp({ language = 'fa' }: AiAssistantAppProps) {
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [installedModels, setInstalledModels] = useState<Array<{ name: string; details?: { family?: string } }>>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedContext, setSelectedContext] = useState<string>('auto');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [searchSessionQuery, setSearchSessionQuery] = useState<string>('');
  const [moduleCatalog, setModuleCatalog] = useState<AIModulePickerItem[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [modulePickerOpen, setModulePickerOpen] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');
  const [moduleCatalogLoading, setModuleCatalogLoading] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const migratedRef = useRef(false);
  const autoCreateOnceRef = useRef(false);
  const deletingRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  const loadSessionsFromServer = async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await authFetch('/api/v1/ai/sessions');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'خطا در دریافت گفتگوها');

      let list: ChatSession[] = (data.data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        createdAt: s.createdAt,
        messages: [],
      }));

      if (!migratedRef.current) {
        migratedRef.current = true;
        try {
          const raw = localStorage.getItem('hsecore_ai_sessions');
          if (raw) {
            const localSessions = JSON.parse(raw);
            if (Array.isArray(localSessions) && localSessions.length > 0) {
              await authFetch('/api/v1/ai/sessions/import-local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessions: localSessions }),
              });
              localStorage.removeItem('hsecore_ai_sessions');
              const res2 = await authFetch('/api/v1/ai/sessions');
              const data2 = await res2.json();
              if (data2.success && Array.isArray(data2.data)) {
                list = data2.data.map((s: any) => ({
                  id: s.id,
                  title: s.title,
                  createdAt: s.createdAt,
                  messages: [],
                }));
              }
            }
          }
        } catch {
          // best-effort
        }
      }

      // Auto-create only on first empty load of this mount — never after user deletes all sessions
      if (list.length === 0 && !autoCreateOnceRef.current) {
        autoCreateOnceRef.current = true;
        const createRes = await authFetch('/api/v1/ai/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'گفت‌وگوی جدید',
            assistantId: 'GENERAL_HSE',
          }),
        });
        const createData = await createRes.json();
        if (createData.success && createData.data) {
          list = [
            {
              id: createData.data.id,
              title: createData.data.title,
              createdAt: createData.data.createdAt,
              messages: [],
            },
          ];
        }
      } else if (list.length > 0) {
        autoCreateOnceRef.current = true;
      }

      setSessions(list);
      setActiveSessionId(prev => (prev && list.some(s => s.id === prev) ? prev : list[0]?.id || ''));
    } catch (err: any) {
      setSessionsError(err?.message || 'خطا در بارگذاری گفتگوها');
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadMessagesForSession = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const res = await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const msgs: ChatMessage[] = data.data.map((m: any) => ({
          id: m.id,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
          timestamp: m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
            : '',
          toolsUsed: m.toolsUsed,
          citations: m.citations,
          durationMs: m.durationMs,
          model: m.model,
        }));
        setSessions(prev => prev.map(s => (s.id === sessionId ? { ...s, messages: msgs } : s)));
      }
    } catch {
      // keep existing
    }
  };

  const refreshInstalledModels = async () => {
    try {
      const response = await authFetch('/api/v1/ai/models');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const models = Array.isArray(data?.data) ? data.data.filter((model: any) =>
        String(model?.details?.family || '').toLowerCase() !== 'bert' &&
        !/embed|embedding/i.test(String(model?.name || ''))
      ) : [];
      setInstalledModels(models);
      setSelectedModel(current =>
        models.some((model: any) => model.name === current) ? current : (models[0]?.name || '')
      );
    } catch {
      setInstalledModels([]);
      setSelectedModel('');
    }
  };

  useEffect(() => {
    loadSessionsFromServer();
    void (async () => {
      setModuleCatalogLoading(true);
      try {
        const response = await authFetch('/api/v1/ai/modules');
        const payload = await response.json();
        if (!response.ok || !payload?.success || !Array.isArray(payload.data)) {
          throw new Error(payload?.message || 'فهرست ماژول‌های هوش مصنوعی دریافت نشد.');
        }
        setModuleCatalog(payload.data);
      } catch {
        setModuleCatalog([]);
      } finally {
        setModuleCatalogLoading(false);
      }
    })();
    void refreshInstalledModels();
    // Runtime can be enabled or models can be installed while this module is open.
    // Refresh from the live backend inventory without requiring a page reload.
    const refreshTimer = window.setInterval(() => { void refreshInstalledModels(); }, 30000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadMessagesForSession(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  const handleExportSession = () => {
    if (!activeSession || activeSession.messages.length === 0) return;
    let report = `گزارش گفت‌وگوی هوش مصنوعی HSECORE\n`;
    report += `عنوان گفتگو: ${activeSession.title}\n`;
    report += `مدل: ${selectedModel || 'مدل محلی'}\n`;
    report += `تاریخ ثبت گزارش: ${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}\n`;
    report += `========================================================\n\n`;

    activeSession.messages.forEach((m, idx) => {
      const sender = m.role === 'user' ? 'شما' : GENERAL_AI_ASSISTANT.nameFa;
      report += `[${idx + 1}] ${sender} - ${m.timestamp}\n`;
      if (m.toolsUsed && m.toolsUsed.length > 0) {
        report += `ابزارها و منابع داده: ${m.toolsUsed.join('، ')}\n`;
      }
      if (m.citations && m.citations.length > 0) {
        report += `منابع و ارجاعات: ${m.citations.join('، ')}\n`;
      }
      report += `${m.content}\n\n--------------------------------------------------------\n\n`;
    });

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HSECORE_AI_Chat_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNewSession = async () => {
    if (deletingRef.current) return;
    try {
      const res = await authFetch('/api/v1/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'گفت‌وگوی جدید',
          assistantId: 'GENERAL_HSE',
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const newSession: ChatSession = {
          id: data.data.id,
          title: data.data.title,
          createdAt: data.data.createdAt,
          messages: [],
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (deletingRef.current) return;
    deletingRef.current = true;

    const previous = sessions;
    const filtered = previous.filter(s => s.id !== sessionId);

    // Optimistic UI: remove immediately; do NOT auto-create a replacement session
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id || '');
    }

    try {
      const res = await authFetch(`/api/v1/ai/sessions/${sessionId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        // Roll back on failure
        setSessions(previous);
        if (activeSessionId === sessionId || !filtered.length) {
          setActiveSessionId(sessionId);
        }
        setSessionsError(data.message || 'حذف گفتگو ناموفق بود.');
      }
    } catch {
      setSessions(previous);
      setActiveSessionId(prev => prev || sessionId);
      setSessionsError('خطا در ارتباط هنگام حذف گفتگو.');
    } finally {
      deletingRef.current = false;
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const flatModuleCatalog: AIModulePickerItem[] = [];
  const appendCatalogTree = (item: AIModulePickerItem) => {
    flatModuleCatalog.push(item);
    (item.children || []).forEach(appendCatalogTree);
  };
  moduleCatalog.forEach(appendCatalogTree);

  const handleComposerChange = (value: string) => {
    const slashMatch = value.match(/(?:^|\s)\/([^\s]*)$/);
    if (slashMatch) {
      const query = slashMatch[1] || '';
      if (/^all$/i.test(query)) {
        if (moduleCatalogLoading || moduleCatalog.length === 0) {
          setInputMessage(value);
          setModuleSearch('');
          setModulePickerOpen(true);
          return;
        }
        setSelectedModuleIds(flatModuleCatalog.filter(item => item.allowed).map(item => item.moduleId));
        setInputMessage(value.replace(/(?:^|\s)\/all\s*$/i, '').trimStart());
        setModulePickerOpen(false);
        setModuleSearch('');
        return;
      }
      setInputMessage(value);
      setModuleSearch(query);
      setModulePickerOpen(true);
      return;
    }
    setInputMessage(value);
    setModulePickerOpen(false);
  };

  const toggleModuleSelection = (moduleId: string) => {
    setSelectedModuleIds(current => current.includes(moduleId)
      ? current.filter(id => id !== moduleId)
      : [...current, moduleId]);
    setInputMessage(current => current.replace(/(?:^|\s)\/[^\s]*$/, '').trimEnd());
    setModulePickerOpen(true);
  };

  const clearSlashCommand = () => {
    setInputMessage(current => current.replace(/(?:^|\s)\/[^\s]*$/, '').trimEnd());
    setModulePickerOpen(false);
    setModuleSearch('');
  };

  const selectedModuleNames = selectedModuleIds
    .map(id => flatModuleCatalog.find(item => item.moduleId === id)?.moduleNameFa)
    .filter((name): name is string => Boolean(name));

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).replace(/(?:^|\s)\/[^\s]*$/, '').trim();
    if (!text || isLoading) return;

    // If user deleted all sessions, create one on first send
    let session = activeSession;
    if (!session) {
      try {
        const res = await authFetch('/api/v1/ai/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: text.slice(0, 35) || 'گفت‌وگوی جدید',
            assistantId: 'GENERAL_HSE',
          }),
        });
        const data = await res.json();
        if (!data.success || !data.data) return;
        session = {
          id: data.data.id,
          title: data.data.title,
          createdAt: data.data.createdAt,
          messages: [],
        };
        setSessions([session]);
        setActiveSessionId(session.id);
      } catch {
        return;
      }
    }

    setInputMessage('');
    setModulePickerOpen(false);
    setModuleSearch('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      moduleScope: [...selectedModuleNames],
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...(session.messages || []), userMsg];
    let sessionTitle = session.title;
    if ((session.messages || []).length === 0) {
      sessionTitle = text.slice(0, 35);
    }

    const sessionId = session.id;
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, title: sessionTitle, messages: updatedMessages } : s))
    );

    try {
      await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: text }),
      });
    } catch {
      // non-blocking
    }

    setIsLoading(true);
    let partialAssistantText = '';
    let partialAssistantId = '';
    let partialResponseModel = selectedModel;
    let partialDurationMs: number | undefined;

    try {
      const historyPayload = updatedMessages.slice(0, -1).slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const requestController = new AbortController();
      activeRequestRef.current = requestController;
      const res = await authFetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          message: text,
          assistantId: 'GENERAL_HSE',
          history: historyPayload,
          model: selectedModel,
          stream: true,
          num_ctx: selectedContext === 'auto' ? undefined : Number(selectedContext),
          contextTokens: selectedContext === 'auto' ? undefined : Number(selectedContext),
          selectedModuleIds: selectedModuleIds.length > 0 ? selectedModuleIds : undefined,
        }),
        signal: requestController.signal,
      });
      if (!res.ok || !res.body) {
        const failure = await res.json().catch(() => ({}));
        throw new Error(failure.message || `خطای سرور هوش مصنوعی: HTTP ${res.status}`);
      }

      const assistantId = `msg-${Date.now()}`;
      partialAssistantId = assistantId;
      const timestamp = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      let assistantText = '';
      let responseModel = selectedModel;
      let durationMs: number | undefined;
      const streamingMessage: ChatMessage = {
        id: assistantId, role: 'assistant', content: '', timestamp, model: selectedModel,
      };
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...updatedMessages, streamingMessage] } : s
      ));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let streamError = '';
      let responseToolsUsed: string[] = [];
      let responseCitations: string[] = [];
      const applyEvent = (line: string) => {
        if (!line.startsWith('data:')) return;
        const payload = JSON.parse(line.slice(5).trim());
        if (payload.token) {
          assistantText += payload.token;
          partialAssistantText = assistantText;
          setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: assistantText } : m),
          } : s));
        }
        if (payload.model) { responseModel = payload.model; partialResponseModel = responseModel; }
        if (payload.durationMs) { durationMs = payload.durationMs; partialDurationMs = durationMs; }
        if (Array.isArray(payload.toolsUsed)) {
          responseToolsUsed = payload.toolsUsed;
          setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, toolsUsed: responseToolsUsed } : m),
          } : s));
        }
        if (Array.isArray(payload.citations)) {
          responseCitations = payload.citations;
          setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, citations: responseCitations } : m),
          } : s));
        }
        if (payload.error) streamError = payload.error;
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() || '';
        for (const line of lines) if (line.trim()) applyEvent(line);
      }
      pending += decoder.decode();
      if (pending.trim()) applyEvent(pending.trim());
      if (streamError) throw new Error(streamError);
      if (!assistantText.trim()) throw new Error('پاسخی از موتور هوش مصنوعی دریافت نشد.');

      try {
        await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'assistant', content: assistantText, toolsUsed: responseToolsUsed, citations: responseCitations,
            durationMs, model: responseModel,
          }),
        });
      } catch {
        // non-blocking
      }
    } catch (requestError: any) {
      if (partialAssistantText.trim() && partialAssistantId) {
        const partialMessage: ChatMessage = {
          id: partialAssistantId, role: 'assistant', content: partialAssistantText,
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          model: partialResponseModel, durationMs: partialDurationMs,
          toolsUsed: responseToolsUsed, citations: responseCitations,
        };
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s, messages: [...s.messages.filter(m => m.id !== partialAssistantId), partialMessage],
        } : s));
        try {
          await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant', content: partialAssistantText, toolsUsed: responseToolsUsed, citations: responseCitations,
              durationMs: partialDurationMs, model: partialResponseModel,
            }),
          });
        } catch { /* keep the partial response visible */ }
      }
      if (requestError?.name === 'AbortError') return;
      const networkErrorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: requestError?.message || 'خطا در ارتباط با سرور هوش مصنوعی سامانه. لطفاً اتصال شبکه را بررسی فرمایید.',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s, messages: [...s.messages.filter(m => m.id !== partialAssistantId), ...(partialAssistantText.trim() ? [{
          id: partialAssistantId, role: 'assistant' as const, content: partialAssistantText,
          timestamp: networkErrorMsg.timestamp, model: partialResponseModel, durationMs: partialDurationMs,
        }] : []), networkErrorMsg],
      } : s));
    } finally {
      activeRequestRef.current = null;
      setIsLoading(false);
    }
  };

  const handleStopGeneration = () => activeRequestRef.current?.abort();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[550px] bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" dir="rtl">
      <aside className={`w-80 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-20 ${sidebarOpen ? 'fixed inset-y-0 start-0 z-50 md:static' : 'hidden md:flex'}`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">دستیار هوش مصنوعی</h2>
              <p className="text-[10px] text-slate-400">مدل‌های زبانی محلی · Ollama</p>
            </div>
          </div>
          <button
            onClick={handleNewSession}
            className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
            title="گفتگوی جدید"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchSessionQuery}
              onChange={e => setSearchSessionQuery(e.target.value)}
              placeholder="جستجو در گفتگوها..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs py-2 pe-3 ps-9 outline-none focus:ring-2 focus:ring-violet-500/30 text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {sessionsLoading && (
            <div className="text-center text-xs text-slate-400 py-6">در حال بارگذاری گفتگوها...</div>
          )}
          {sessionsError && (
            <div className="text-center text-xs text-rose-500 py-4 px-2">
              {sessionsError}
              <button onClick={loadSessionsFromServer} className="block mx-auto mt-2 text-violet-500 underline">
                تلاش مجدد
              </button>
            </div>
          )}
          {!sessionsLoading &&
            !sessionsError &&
            sessions
              .filter(s => !searchSessionQuery || s.title.includes(searchSessionQuery))
              .map(session => (
                <div
                  key={session.id}
                  onClick={() => {
                    if (activeSessionId !== session.id) setSelectedModuleIds([]);
                    setModulePickerOpen(false);
                    setActiveSessionId(session.id);
                    setSidebarOpen(false);
                  }}
                  className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                    activeSessionId === session.id
                      ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{session.title}</p>
                    <p className="text-[10px] opacity-50">
                      {session.createdAt
                        ? new Date(session.createdAt).toLocaleDateString('fa-IR')
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={e => handleDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-rose-500 transition"
                    title="حذف گفتگو"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/50">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600"
              onClick={() => setSidebarOpen(true)}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                {activeSession?.title || GENERAL_AI_ASSISTANT.nameFa}
              </h3>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {GENERAL_AI_ASSISTANT.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleExportSession}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="دریافت گزارش متنی"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => activeSessionId && loadMessagesForSession(activeSessionId)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="بازخوانی پیام‌ها"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {(!activeSession || activeSession.messages.length === 0) && !isLoading && (
            <div className="max-w-2xl mx-auto text-center space-y-5 pt-8">
              <div className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/20">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {GENERAL_AI_ASSISTANT.nameFa}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-md mx-auto">
                  {GENERAL_AI_ASSISTANT.description}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-start">
                {GENERAL_AI_ASSISTANT.promptSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(s)}
                    className="text-[11px] leading-relaxed p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 text-slate-600 dark:text-slate-300 transition text-right"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSession?.messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200'
                    : 'bg-violet-600 text-white'
                }`}
              >
                {msg.role === 'user' ? (
                  <span className="text-xs font-bold">شما</span>
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-te-sm'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-ts-sm'
                }`}
              >
                {msg.moduleScope && msg.moduleScope.length > 0 && (
                  <div className="mb-2 text-[10px] text-violet-100/90">دامنه تحلیل: {msg.moduleScope.join('، ')}</div>
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {(msg.toolsUsed?.length || msg.citations?.length) ? (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        منابع داده: {msg.toolsUsed.join('، ')}
                      </p>
                    )}
                    {msg.citations && msg.citations.length > 0 && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" />
                        مراجع: {msg.citations.join('، ')}
                      </p>
                    )}
                  </div>
                ) : null}
                <div className="mt-1.5 flex items-center gap-2 justify-between">
                  <span className="text-[10px] opacity-50">{msg.timestamp}</span>
                  <button
                    onClick={() => handleCopy(msg.content, msg.id)}
                    className="opacity-50 hover:opacity-100 transition"
                    title="کپی"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-ts-sm px-4 py-3 text-sm text-slate-400">
                در حال تولید پاسخ...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
          <div className="max-w-3xl mx-auto space-y-2">
            {installedModels.length === 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                هیچ مدل زبانیِ قابل گفت‌وگویی نصب نیست. برای شروع، یک مدل مولد را از مدیریت هوش مصنوعی نصب کنید؛ مدل‌های embedding برای چت قابل استفاده نیستند.
              </div>
            )}
            <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 shadow-sm focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all p-2.5">
              {modulePickerOpen && (
                <div className="absolute bottom-full inset-x-0 mb-2 z-30 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <Layers className="w-4 h-4 text-violet-500" />
                      انتخاب ماژول‌ها و زیرماژول‌ها
                    </div>
                    <button type="button" onClick={clearSlashCommand} className="text-[11px] text-violet-600 dark:text-violet-400">تأیید انتخاب</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                    {moduleCatalogLoading && <div className="p-3 text-xs text-slate-400">در حال دریافت فهرست واقعی ماژول‌ها...</div>}
                    {!moduleCatalogLoading && flatModuleCatalog
                      .filter(item => !moduleSearch || item.moduleNameFa.toLowerCase().includes(moduleSearch.toLowerCase()) || item.moduleId.toLowerCase().includes(moduleSearch.toLowerCase()))
                      .map(item => (
                        <label key={item.moduleId} title={item.notes || item.moduleId} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs ${item.allowed ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : 'opacity-45 cursor-not-allowed'}`}>
                          <input
                            type="checkbox"
                            checked={selectedModuleIds.includes(item.moduleId)}
                            disabled={!item.allowed}
                            onChange={() => toggleModuleSelection(item.moduleId)}
                            className="accent-violet-600"
                          />
                          <span className="flex-1 text-slate-700 dark:text-slate-200">{item.parentId ? '↳ ' : ''}{item.moduleNameFa}</span>
                          <span className={`text-[10px] ${item.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {!item.enabled ? 'غیرفعال' : !item.allowed ? 'بدون مجوز' : item.connected ? 'داده متصل' : 'بدون اتصال داده'}
                          </span>
                        </label>
                      ))}
                    {!moduleCatalogLoading && flatModuleCatalog.filter(item => !moduleSearch || item.moduleNameFa.toLowerCase().includes(moduleSearch.toLowerCase()) || item.moduleId.toLowerCase().includes(moduleSearch.toLowerCase())).length === 0 && (
                      <div className="p-3 text-xs text-slate-400">ماژولی با این عنوان پیدا نشد.</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                    <span>{selectedModuleIds.length} بخش انتخاب‌شده · برای انتخاب همه بنویسید /ALL</span>
                    <button type="button" onClick={() => setSelectedModuleIds(flatModuleCatalog.filter(item => item.allowed).map(item => item.moduleId))} className="text-violet-600 dark:text-violet-400 font-semibold">انتخاب همه مجاز</button>
                  </div>
                </div>
              )}
              <textarea
                value={inputMessage}
                onChange={e => handleComposerChange(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="پیام خود را بنویسید؛ برای انتخاب ماژول / را تایپ کنید..."
                className="w-full resize-none bg-transparent border-0 px-2 py-1 text-sm outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 max-h-40"
                disabled={isLoading || sessionsLoading}
              />
              {selectedModuleNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-1 pt-1">
                  {selectedModuleNames.map((name, index) => (
                    <span key={selectedModuleIds[index]} className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-1 text-[10px] text-violet-700 dark:text-violet-300">
                      {name}
                      <button type="button" onClick={() => setSelectedModuleIds(ids => ids.filter(id => id !== selectedModuleIds[index]))} title="حذف انتخاب"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setSelectedModuleIds([])} className="text-[10px] text-slate-400 hover:text-rose-500">پاک‌کردن انتخاب‌ها</button>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 mt-1 gap-2">
                {/* Right side in RTL (start): Professional Model & Provider Selector and Context Tuning */}
                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs text-slate-700 dark:text-slate-200 text-xs">
                    <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      disabled={isLoading || installedModels.length === 0}
                      className="bg-transparent border-0 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none cursor-pointer max-w-[170px] sm:max-w-[240px] truncate"
                      title="انتخاب مدل هوش مصنوعی"
                    >
                      {installedModels.length === 0 ? (
                        <option value="">مدل گفت‌وگو نصب نیست</option>
                      ) : (
                        installedModels.map(model => (
                          <option key={model.name} value={model.name} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                            {model.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Context Length Selector (OOM protection) */}
                  <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs text-slate-700 dark:text-slate-200 text-xs">
                    <Sliders className="w-3 h-3 text-indigo-500 shrink-0" />
                    <select
                      value={selectedContext}
                      onChange={e => setSelectedContext(e.target.value)}
                      disabled={isLoading}
                      className="bg-transparent border-0 text-[11px] font-medium text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
                      title="تنظیم طول پنجره کانتکست (Context Length) جهت کنترل مصرف RAM و پیشگیری از OOM"
                    >
                      <option value="auto">کانتکست: خودکار (ضد OOM)</option>
                      <option value="2048">کانتکست: ۲۰۴۸ (ایمن)</option>
                      <option value="4096">کانتکست: ۴۰۹۶ (استاندارد)</option>
                      <option value="8192">کانتکست: ۸۱۹۲ (بلند)</option>
                    </select>
                  </div>

                  {installedModels.length > 0 && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 hidden lg:inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      موتور هوشمند سامانه (آماده)
                    </span>
                  )}
                </div>

                {/* Left side in RTL (end): Stop / Send button */}
                <div className="flex items-center gap-2 shrink-0">
                  {isLoading ? (
                    <button
                      onClick={handleStopGeneration}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl shadow-xs transition text-xs font-medium"
                      title="توقف تولید پاسخ"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>توقف</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() || sessionsLoading || !selectedModel}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition text-xs font-semibold"
                      title="ارسال پیام"
                    >
                      <span>ارسال</span>
                      <Send className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
