import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Wifi,
  WifiOff,
  Menu,
  ArrowLeft,
  X,
  ChevronDown,
  Settings,
  AlertCircle,
  CheckCircle2,
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
  nameFa: 'هوش مصنوعی HSECORE',
  title: 'موتور یکپارچه تحلیل برخط ماژول‌های بهداشت، ایمنی و محیط زیست',
  description:
    'تمامی داده‌های ماژول‌های سامانه، پرونده ۳۶۰ درجه پرسنل، حوادث، مجوزهای کار (PTW) و استانداردها را تحلیل و به پرسش‌های تخصصی و عمومی پاسخ می‌دهد.',
};

const CONTEXT_OPTIONS = [
  {
    value: 'auto',
    label: 'خودکار (ضد OOM)',
    shortLabel: 'خودکار',
    desc: 'تنظیم هوشمند طول کانتکست بر اساس RAM آزاد سرور و اندازه مدل جهت پیشگیری کامل از خطای OOM',
  },
  {
    value: '2048',
    label: '۲۰۴۸ توکن (سبک و ایمن)',
    shortLabel: '2K ایمن',
    desc: 'کمترین مصرف حافظه RAM؛ مناسب برای پرسش‌های سریع و سرورهای با منابع محدود',
  },
  {
    value: '4096',
    label: '۴۰۹۶ توکن (استاندارد)',
    shortLabel: '4K استاندارد',
    desc: 'تعادل بهینه بین دقت تحلیل چندماژولی و مصرف حافظه کانتینر هوش مصنوعی',
  },
  {
    value: '8192',
    label: '۸۱۹۲ توکن (تحلیل عمیق)',
    shortLabel: '8K بلند',
    desc: 'مناسب برای تحلیل گزارش‌های طولانی و چند ماژول هم‌زمان (نیازمند RAM کافی)',
  },
];

export interface AiAssistantAppProps {
  currentUser?: UserProfile | null;
  language?: 'fa' | 'en';
  onOpenGlobalMenu?: () => void;
  onNavigate?: (tab: string, subItem?: string) => void;
}

type ActiveSheetType = 'none' | 'model' | 'context' | 'modules';

let messageSequence = 0;
function createMessageId(prefix = 'msg'): string {
  messageSequence = (messageSequence + 1) % 100000;
  return `${prefix}-${Date.now()}-${messageSequence}`;
}

function toEmptyChatSession(raw: { id: string; title: string; createdAt: string }): ChatSession {
  return {
    id: raw.id,
    title: raw.title,
    createdAt: raw.createdAt,
    messages: [],
  };
}

export default function AiAssistantApp({
  onOpenGlobalMenu,
  onNavigate,
}: AiAssistantAppProps) {
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [installedModels, setInstalledModels] = useState<Array<{ name: string; details?: { family?: string; parameter_size?: string; quantization_level?: string } }>>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedContext, setSelectedContext] = useState<string>('auto');
  const [allowTools, setAllowTools] = useState<boolean>(() => getAiAllowToolsSetting());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheetType>('none');
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [searchSessionQuery, setSearchSessionQuery] = useState<string>('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState<string>('');
  const [moduleCatalog, setModuleCatalog] = useState<
    Array<{
      moduleId: string;
      moduleNameFa: string;
      connected: boolean;
      tools?: string[];
      notes?: string;
      parentModuleId?: string;
      level?: number;
      internal?: boolean;
    }>
  >([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [showSlashModulePicker, setShowSlashModulePicker] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const migratedRef = useRef(false);
  const autoCreateOnceRef = useRef(false);
  const deletingRef = useRef(false);
  const activeRequestRef = useRef<AbortController | null>(null);

  // Monitor online/offline state
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-resize textarea height cleanly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(Math.max(el.scrollHeight, 44), 144);
    el.style.height = `${nextHeight}px`;
  }, [inputMessage]);

  // Keep bottom input visible when mobile virtual keyboard resizes viewport
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      if (document.activeElement === textareaRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleAllowTools = (nextVal: boolean) => {
    setAllowTools(nextVal);
    try {
      localStorage.setItem(AI_ALLOW_TOOLS_STORAGE_KEY, String(nextVal));
    } catch {
      // ignore storage errors
    }
  };

  const loadSessionsFromServer = async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await authFetch('/api/v1/ai/sessions');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'خطا در دریافت گفتگوها');

      let list: ChatSession[] = (data.data || []).map(toEmptyChatSession);

      if (!migratedRef.current) {
        migratedRef.current = true;
        try {
          const raw = localStorage.getItem('hsecore_ai_sessions');
          if (raw) {
            const localSessions = JSON.parse(raw);
            if (Array.isArray(localSessions) && localSessions.length > 0) {
              // Import in bounded batches. The server operation is idempotent by session/message ID,
              // so an interrupted migration can safely be retried without deleting the local source.
              for (let offset = 0; offset < localSessions.length; offset += 30) {
                const batch = localSessions.slice(offset, offset + 30);
                const importRes = await authFetch('/api/v1/ai/sessions/import-local', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessions: batch }),
                });
                const importData = await importRes.json().catch(() => ({}));
                if (!importRes.ok || !importData.success || Number(importData.data?.imported) !== batch.length) {
                  throw new Error(importData.message || 'انتقال کامل تاریخچه گفتگوها تأیید نشد.');
                }
              }

              const res2 = await authFetch('/api/v1/ai/sessions?limit=100');
              const data2 = await res2.json().catch(() => ({}));
              if (!res2.ok || !data2.success || !Array.isArray(data2.data)) {
                throw new Error('تأیید تاریخچه منتقل‌شده از پایگاه داده ناموفق بود.');
              }
              const importedById = new Map(data2.data.map((item: any) => [String(item.id), item]));
              const allSessionsVerified = localSessions.every((local: any) => {
                const remote: any = importedById.get(String(local?.id || ''));
                if (!remote) return false;
                const expectedMessages = Array.isArray(local?.messages)
                  ? local.messages.filter((message: any) =>
                      Boolean(message?.content) && (message.role === 'user' || message.role === 'assistant')
                    ).length
                  : 0;
                return Number(remote.messageCount || 0) >= Math.min(expectedMessages, 100);
              });
              if (!allSessionsVerified) {
                throw new Error('تعداد گفتگوها یا پیام‌های منتقل‌شده با تاریخچه محلی مطابقت ندارد؛ نسخه محلی حفظ شد.');
              }

              // Remove the source only after every batch and the server-side read-back are verified.
              localStorage.removeItem('hsecore_ai_sessions');
              list = data2.data.map(toEmptyChatSession);
            }
          }
        } catch {
          // best-effort
        }
      }

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
          list = [toEmptyChatSession(createData.data)];
        }
      } else if (list.length > 0) {
        autoCreateOnceRef.current = true;
      }

      setSessions(list);
      setActiveSessionId(prev => (prev && list.some(s => s.id === prev) ? prev : list[0]?.id || ''));
    } catch (err: any) {
      setSessionsError(err?.message || 'خطا در بارگذاری گفتگوها');
      // Preserve the last successfully loaded sessions during transient failures.

    } finally {
      setSessionsLoading(false);
    }
  };

  const loadMessagesForSession = async (sessionId: string) => {
    if (!sessionId) return;
    try {
      const res = await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.data)) {
        throw new Error(data.message || `دریافت پیام‌های گفتگو ناموفق بود (HTTP ${res.status})`);
      }
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
    } catch (err: any) {
      // Do not replace an existing transcript with an empty one when a fetch fails.
      setSessionsError(err?.message || 'خواندن سابقه گفتگو از پایگاه داده ناموفق بود.');
    }
  };

  const refreshInstalledModels = async () => {
    try {
      const response = await authFetch('/api/v1/ai/models');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const models = Array.isArray(data?.data)
        ? data.data.filter(
            (model: any) =>
              String(model?.details?.family || '').toLowerCase() !== 'bert' &&
              !/embed|embedding/i.test(String(model?.name || ''))
          )
        : [];
      setInstalledModels(models);
      // Never auto-select the first installed model; the user must choose explicitly.
      setSelectedModel(current =>
        models.some((model: any) => model.name === current) ? current : ''
      );
    } catch {
      setInstalledModels([]);
      setSelectedModel('');
    }
  };

  useEffect(() => {
    loadSessionsFromServer();
    void refreshInstalledModels();
    const refreshModuleCatalog = () => {
      void authFetch('/api/v1/ai/coverage')
        .then(response => response.json())
        .then(data => {
          if (data?.success && Array.isArray(data.data)) {
            const visibleModules = data.data.filter((item: any) => !item.internal);
            setModuleCatalog(visibleModules);
            setSelectedModules(current =>
              current.filter(
                id =>
                  id === 'all' ||
                  visibleModules.some((item: any) => item.moduleId === id && item.connected)
              )
            );
          }
        })
        .catch(() => setModuleCatalog([]));
    };
    refreshModuleCatalog();
    const onModuleConfigUpdated = () => refreshModuleCatalog();
    window.addEventListener('hse_ui_config_updated', onModuleConfigUpdated);
    window.addEventListener('health_env_config_updated', onModuleConfigUpdated);
    window.addEventListener('fire_dept_config_updated', onModuleConfigUpdated);
    window.addEventListener('safety_dept_config_updated', onModuleConfigUpdated);
    const refreshTimer = window.setInterval(() => {
      void refreshInstalledModels();
    }, 30000);
    return () => {
      // Keep an in-flight request alive while navigating between application modules.
      // The server persists its answer using the sessionId before completing the response.
      window.clearInterval(refreshTimer);
      window.removeEventListener('hse_ui_config_updated', onModuleConfigUpdated);
      window.removeEventListener('health_env_config_updated', onModuleConfigUpdated);
      window.removeEventListener('fire_dept_config_updated', onModuleConfigUpdated);
      window.removeEventListener('safety_dept_config_updated', onModuleConfigUpdated);
    };
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
        const newSession = toEmptyChatSession(data.data);
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setSidebarOpen(false);
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

    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id || '');
    }

    try {
      const res = await authFetch(`/api/v1/ai/sessions/${sessionId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
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

  const getSelectedModuleScope = (): string[] => {
    const scope = new Set(selectedModules);
    for (const selectedId of selectedModules) {
      let parentId = moduleCatalog.find(item => item.moduleId === selectedId)?.parentModuleId;
      let depth = 0;
      while (parentId && depth < 8) {
        scope.add(parentId);
        parentId = moduleCatalog.find(item => item.moduleId === parentId)?.parentModuleId;
        depth++;
      }
    }
    return Array.from(scope);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

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
        session = toEmptyChatSession(data.data);
        setSessions([session]);
        setActiveSessionId(session.id);
      } catch {
        return;
      }
    }

    setInputMessage('');
    setShowSlashModulePicker(false);
    setActiveSheet('none');

    const userMsg: ChatMessage = {
      id: createMessageId('msg-u'),
      role: 'user',
      content: text,
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
      const saveResponse = await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: text }),
      });
      const saveResult = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok || saveResult.success === false) {
        throw new Error(saveResult.message || `ذخیره پیام ناموفق بود (HTTP ${saveResponse.status})`);
      }
    } catch (saveError: any) {
      setSessions(prev => prev.map(s => s.id === sessionId
        ? { ...s, messages: (session.messages || []) }
        : s));
      setInputMessage(text);
      setSessionsError(saveError?.message || 'پیام در پایگاه داده ذخیره نشد؛ ارسال به هوش مصنوعی متوقف شد تا سابقه ناقص نشود.');
      return;
    }

    setIsLoading(true);
    let partialAssistantText = '';
    let partialAssistantId = '';
    let partialResponseModel = selectedModel;
    let partialDurationMs: number | undefined;
    let responseToolsUsed: string[] = [];
    let responseCitations: string[] = [];

    try {
      const historyPayload = updatedMessages
        .slice(0, -1)
        .slice(-6)
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      const parsedContextTokens = selectedContext === 'auto' ? undefined : Number(selectedContext);
      const requestController = new AbortController();
      activeRequestRef.current = requestController;
      const res = await authFetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          message: text,
          sessionId,
          assistantId: 'GENERAL_HSE',
          history: historyPayload,
          model: selectedModel,
          selectedModules: getSelectedModuleScope(),
          allowTools: getAiAllowToolsSetting(),
          stream: true,
          num_ctx: parsedContextTokens,
          contextTokens: parsedContextTokens,
        }),
        signal: requestController.signal,
      });
      if (!res.ok || !res.body) {
        const failure = await res.json().catch(() => ({}));
        throw new Error(failure.message || `خطای سرور هوش مصنوعی: HTTP ${res.status}`);
      }

      const assistantId = createMessageId('msg-a');
      partialAssistantId = assistantId;
      const timestamp = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      let assistantText = '';
      let responseModel = selectedModel;
      let durationMs: number | undefined;
      const streamingMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp,
        model: selectedModel,
      };
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId ? { ...s, messages: [...updatedMessages, streamingMessage] } : s
        )
      );

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let streamError = '';
      let serverHistorySaved = false;
      const applyEvent = (line: string) => {
        if (!line.startsWith('data:')) return;
        let payload: any;
        try {
          payload = JSON.parse(line.slice(5).trim());
        } catch {
          return;
        }
        if (payload.token) {
          assistantText += payload.token;
          partialAssistantText = assistantText;
          setSessions(prev =>
            prev.map(s =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: s.messages.map(m =>
                      m.id === assistantId ? { ...m, content: assistantText } : m
                    ),
                  }
                : s
            )
          );
        }
        if (payload.model) {
          responseModel = payload.model;
          partialResponseModel = responseModel;
        }
        if (payload.durationMs) {
          durationMs = payload.durationMs;
          partialDurationMs = durationMs;
        }
        if (Array.isArray(payload.toolsUsed)) responseToolsUsed = payload.toolsUsed;
        if (Array.isArray(payload.citations)) responseCitations = payload.citations;
        if (payload.historySaved === true) serverHistorySaved = true;
        if (payload.historySaved === false) {
          setSessionsError('پاسخ تولید شد اما ذخیره سمت سرور ناموفق بود؛ لطفاً پایگاه داده را بررسی کنید.');
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

      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === assistantId
                    ? { ...m, toolsUsed: responseToolsUsed, citations: responseCitations, durationMs, model: responseModel }
                    : m
                ),
              }
            : s
        )
      );

      if (!serverHistorySaved) {
        try {
          const saveResponse = await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant',
              content: assistantText,
              toolsUsed: responseToolsUsed,
              citations: responseCitations,
              durationMs,
              model: responseModel,
            }),
          });
          const saveResult = await saveResponse.json().catch(() => ({}));
          if (!saveResponse.ok || saveResult.success === false) {
            throw new Error(saveResult.message || 'ذخیره پاسخ هوش مصنوعی ناموفق بود.');
          }
        } catch (saveError: any) {
          setSessionsError(saveError?.message || 'پاسخ تولید شد اما ذخیره آن در تاریخچه ناموفق بود؛ لطفاً وضعیت پایگاه داده را بررسی کنید.');
        }
      }
    } catch (requestError: any) {
      const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const hasPartial = Boolean(partialAssistantText.trim() && partialAssistantId);
      const partialMessage: ChatMessage | null = hasPartial
        ? {
            id: partialAssistantId,
            role: 'assistant',
            content: partialAssistantText,
            timestamp: nowTime,
            model: partialResponseModel,
            durationMs: partialDurationMs,
            toolsUsed: responseToolsUsed.length > 0 ? responseToolsUsed : undefined,
            citations: responseCitations.length > 0 ? responseCitations : undefined,
          }
        : null;

      if (partialMessage) {
        try {
          await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              role: 'assistant',
              content: partialAssistantText,
              toolsUsed: responseToolsUsed,
              citations: responseCitations,
              durationMs: partialDurationMs,
              model: partialResponseModel,
            }),
          });
        } catch {
          // keep partial response visible
        }
      }

      const isAborted = requestError?.name === 'AbortError';
      const networkErrorMsg: ChatMessage | null = isAborted
        ? null
        : {
            id: createMessageId('msg-err'),
            role: 'assistant',
            content:
              requestError?.message ||
              'خطا در ارتباط با سرور هوش مصنوعی سامانه. لطفاً اتصال شبکه را بررسی فرمایید.',
            timestamp: nowTime,
          };

      setSessions(prev =>
        prev.map(s => {
          if (s.id !== sessionId) return s;
          const baseMessages = partialAssistantId
            ? s.messages.filter(m => m.id !== partialAssistantId)
            : s.messages;
          return {
            ...s,
            messages: [
              ...baseMessages,
              ...(partialMessage ? [partialMessage] : []),
              ...(networkErrorMsg ? [networkErrorMsg] : []),
            ],
          };
        })
      );
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

  const handleNavigateToAiSettings = () => {
    setActiveSheet('none');
    if (onNavigate) {
      onNavigate('system', 'ai');
    }
  };

  const filteredModules = useMemo(() => {
    const q = moduleSearchQuery.trim().toLowerCase();
    if (!q) return moduleCatalog;
    return moduleCatalog.filter(
      m =>
        m.moduleNameFa.toLowerCase().includes(q) ||
        m.moduleId.toLowerCase().includes(q)
    );
  }, [moduleCatalog, moduleSearchQuery]);

  const activeContextOption =
    CONTEXT_OPTIONS.find(c => c.value === selectedContext) || CONTEXT_OPTIONS[0];

  const isWaitingForFirstToken =
    isLoading &&
    (!activeSession?.messages.length ||
      activeSession.messages[activeSession.messages.length - 1]?.role === 'user' ||
      activeSession.messages[activeSession.messages.length - 1]?.content === '');

  return (
    <div
      className="relative flex h-[100dvh] sm:h-[calc(100vh-124px)] min-h-[540px] w-full bg-[#F8FAFC] dark:bg-slate-950 sm:rounded-3xl sm:border border-slate-200/80 dark:border-slate-800/80 sm:shadow-sm overflow-hidden select-text"
      dir="rtl"
    >
      {/* ── Mobile Slide-Over Backdrop for Chat History Drawer ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Chat History Sidebar (Desktop Fixed Column & Mobile Slide-Over Drawer) ── */}
      <aside
        className={`w-[82vw] max-w-[310px] md:w-72 lg:w-80 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 flex flex-col transition-transform duration-300 z-50 ${
          sidebarOpen
            ? 'fixed inset-y-0 start-0 translate-x-0 shadow-2xl md:static md:shadow-none'
            : 'hidden md:flex'
        }`}
      >
        <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#5B4BFF]/10 dark:bg-[#5B4BFF]/20 text-[#5B4BFF] flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                تاریخچه گفتگوها
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                ذخیره‌سازی پایدار در سرور
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleNewSession}
              className="min-h-[44px] min-w-[44px] px-3 bg-[#5B4BFF] hover:bg-[#4A3AE8] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-[#5B4BFF]/20 transition cursor-pointer active:scale-95"
              title="گفت‌وگوی جدید"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">جدید</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
              aria-label="بستن فهرست گفتگوها"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Sessions */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchSessionQuery}
              onChange={e => setSearchSessionQuery(e.target.value)}
              placeholder="جستجو در گفتگوها..."
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs py-2.5 pe-3 ps-10 outline-none focus:border-[#5B4BFF] focus:ring-2 focus:ring-[#5B4BFF]/20 text-slate-800 dark:text-slate-200 transition"
            />
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-1 custom-scrollbar">
          {sessionsLoading && (
            <div className="text-center text-xs text-slate-400 py-8">
              در حال بارگذاری گفتگوها...
            </div>
          )}
          {sessionsError && (
            <div className="text-center text-xs text-rose-500 py-4 px-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl">
              <p>{sessionsError}</p>
              <button
                type="button"
                onClick={loadSessionsFromServer}
                className="mt-2 min-h-[44px] px-4 text-[#5B4BFF] font-bold underline"
              >
                تلاش مجدد
              </button>
            </div>
          )}
          {!sessionsLoading &&
            !sessionsError &&
            sessions
              .filter(s => !searchSessionQuery || s.title.includes(searchSessionQuery))
              .map(session => {
                const isActive = activeSessionId === session.id;
                return (
                  <div
                    key={session.id}
                    onClick={() => {
                      setActiveSessionId(session.id);
                      setSidebarOpen(false);
                    }}
                    className={`group min-h-[48px] flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#5B4BFF]/10 dark:bg-[#5B4BFF]/20 text-[#5B4BFF] dark:text-[#9D93FF] border border-[#5B4BFF]/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent'
                    }`}
                  >
                    <MessageSquare
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-[#5B4BFF]' : 'text-slate-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{session.title}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
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
                      className="min-h-[36px] min-w-[36px] md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg text-slate-400 hover:text-rose-500 transition"
                      title="حذف گفتگو"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
        </div>

        {/* Sidebar Footer Quick Link to AI Settings */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={handleNavigateToAiSettings}
            className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:border-[#5B4BFF]/40 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#5B4BFF]" />
              <span>مدیریت مدل‌ها و منابع AI</span>
            </span>
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* ── Main Chat Column (Sticky Header + Scrollable Messages + Sticky Bottom Composer) ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full bg-[#F8FAFC] dark:bg-slate-950 relative">
        {/* ۱. هدر ثابت و سبک (Fixed & Lightweight Header) */}
        <header className="sticky top-0 z-20 shrink-0 h-14 sm:h-16 px-3 sm:px-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
          {/* Right side in RTL: Menu, Brand Logo & Title, Active Model Status */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {onOpenGlobalMenu && (
              <button
                type="button"
                onClick={onOpenGlobalMenu}
                className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                title="منوی اصلی سامانه"
                aria-label="منوی اصلی سامانه"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden min-h-[44px] min-w-[44px] rounded-xl bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 flex items-center justify-center transition cursor-pointer"
              title="تاریخچه گفتگوها"
              aria-label="تاریخچه گفتگوها"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Small HSECORE Brand Mark + Title «هوش مصنوعی» */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5B4BFF] to-[#4636E8] text-white flex items-center justify-center shadow-sm shadow-[#5B4BFF]/25 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[#5B4BFF]/10 text-[#5B4BFF] dark:bg-[#5B4BFF]/20 dark:text-[#ACA2FF]">
                    HSECORE
                  </span>
                  <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate">
                    هوش مصنوعی
                  </h1>
                </div>

                {/* Active Model Status Indicator */}
                <button
                  type="button"
                  onClick={() => setActiveSheet('model')}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-[#5B4BFF] dark:hover:text-[#9D93FF] transition truncate max-w-[180px] sm:max-w-[280px]"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      installedModels.length > 0 && selectedModel
                        ? 'bg-emerald-500 animate-pulse'
                        : 'bg-amber-500'
                    }`}
                  />
                  <span className="truncate">
                    {installedModels.length > 0 && selectedModel
                      ? `مدل فعال: ${selectedModel}`
                      : 'مدل نصب نشده'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Left side in RTL: Status Icons (Wi-Fi, Notifications, Actions) & Back/Close Button */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Wi-Fi / Connection Status */}
            <div
              className={`hidden xs:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${
                isOnline
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/70 dark:border-emerald-800/50'
                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              }`}
              title={isOnline ? 'اتصال برقرار است' : 'آفلاین'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isOnline ? 'متصل' : 'آفلاین'}</span>
            </div>

            {/* New Conversation Action */}
            <button
              type="button"
              onClick={handleNewSession}
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
              title="گفت‌وگوی جدید"
              aria-label="گفت‌وگوی جدید"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Refresh Messages */}
            <button
              type="button"
              onClick={() => {
                void refreshInstalledModels();
                if (activeSessionId) void loadMessagesForSession(activeSessionId);
              }}
              className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
              title="بروزرسانی وضعیت مدل و پیام‌ها"
              aria-label="بروزرسانی"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Export Chat */}
            {activeSession && activeSession.messages.length > 0 && (
              <button
                type="button"
                onClick={handleExportSession}
                className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                title="دریافت فایل گزارش گفتگو"
                aria-label="دریافت گزارش"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* ۲. ناحیه اصلی چت (Scrollable Chat Canvas) */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-5">
            {/* حالت خالی جذاب (Empty State when no messages exist) */}
            {(!activeSession || activeSession.messages.length === 0) && !isLoading && (
              <div className="pt-4 sm:pt-8 pb-4 text-center space-y-6 animate-in fade-in duration-300">
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-[#5B4BFF] to-[#4332E0] text-white flex items-center justify-center shadow-xl shadow-[#5B4BFF]/25">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-lg mx-auto px-2">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                      چطور می‌توانم در تحلیل HSE به شما کمک کنم؟
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {GENERAL_AI_ASSISTANT.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* فهرست پیام‌ها (Messages Feed: User on Right with Light Purple Bubble, AI on Left with White Bubble & Soft Shadow) */}
            {activeSession?.messages.map(msg => {
              const isUser = msg.role === 'user';
              if (!isUser && !msg.content && isLoading) {
                return null;
              }
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 sm:gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                    isUser ? 'justify-start' : 'justify-end flex-row-reverse'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center text-xs font-black shadow-2xs ${
                      isUser
                        ? 'bg-[#5B4BFF] text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[#5B4BFF]'
                    }`}
                  >
                    {isUser ? <span>شما</span> : <Bot className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`relative max-w-[86%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-7 transition-all ${
                      isUser
                        ? 'bg-[#ECEAFE] dark:bg-[#5B4BFF]/25 text-slate-900 dark:text-slate-100 border border-[#5B4BFF]/20 rounded-tr-xs shadow-2xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>

                    {/* Data Sources & Citations */}
                    {(msg.toolsUsed?.length || msg.citations?.length) ? (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                            <Database className="w-3.5 h-3.5 text-[#5B4BFF] shrink-0 mt-0.5" />
                            <span>منابع داده: {msg.toolsUsed.join('، ')}</span>
                          </div>
                        )}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>مراجع: {msg.citations.join('، ')}</span>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Timestamp, Model tag & Copy action */}
                    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>{msg.timestamp}</span>
                        {!isUser && msg.model && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                            {msg.model}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="min-h-[32px] min-w-[32px] -my-1 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition cursor-pointer"
                        title="کپی متن پیام"
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
              );
            })}

            {/* انیمیشن تایپ هوش مصنوعی (AI Typing Indicator) */}
            {isWaitingForFirstToken && (
              <div className="flex items-start gap-2.5 sm:gap-3 justify-end flex-row-reverse animate-in fade-in duration-200">
                <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-[#5B4BFF] flex items-center justify-center shadow-2xs">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl rounded-tl-xs px-4 py-3.5 shadow-sm flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#5B4BFF] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-[#5B4BFF]/80 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-[#5B4BFF]/60 animate-bounce" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    هوش مصنوعی در حال تحلیل و نگارش پاسخ...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>

        {/* ۳. ناحیه ورودی پیام در پایین (Sticky Bottom Message Composer) */}
        <div className="sticky bottom-0 z-20 shrink-0 px-3 sm:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent dark:from-slate-950 dark:via-slate-950/95">
          <div className="max-w-3xl mx-auto">
            {/* Quick Slash Command Inline Picker when typing '/' */}
            {showSlashModulePicker && (
              <div className="mb-2 rounded-2xl border border-[#5B4BFF]/30 bg-white dark:bg-slate-900 p-3 shadow-lg max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                    انتخاب سریع محدوده تحلیل ماژول‌ها
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSlashModulePicker(false)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModules(['all']);
                    setInputMessage('');
                    setShowSlashModulePicker(false);
                  }}
                  className="w-full min-h-[44px] text-right px-3 py-2 mb-1 rounded-xl text-xs font-bold bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#9D93FF] hover:bg-[#5B4BFF]/15 transition flex items-center justify-between"
                >
                  <span>/ALL — تحلیل یکپارچه همه ماژول‌های سامانه</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#5B4BFF] text-white">ALL</span>
                </button>
                {moduleCatalog.map(item => {
                  const hasVisibleParent = Boolean(
                    item.parentModuleId &&
                      moduleCatalog.some(parent => parent.moduleId === item.parentModuleId)
                  );
                  return (
                    <button
                      key={item.moduleId}
                      type="button"
                      disabled={!item.connected}
                      onClick={() => {
                        setSelectedModules(current => {
                          const next = current.includes(item.moduleId)
                            ? current.filter(id => id !== item.moduleId)
                            : [...current.filter(id => id !== 'all'), item.moduleId];
                          return next;
                        });
                        setInputMessage('');
                        setShowSlashModulePicker(false);
                      }}
                      className="w-full min-h-[44px] flex items-center justify-between gap-2 text-right px-3 py-2 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <span
                        style={{
                          paddingRight: hasVisibleParent
                            ? `${Math.min(item.level || 1, 4) * 12}px`
                            : '0px',
                        }}
                      >
                        {hasVisibleParent ? '↳ ' : ''}
                        {item.moduleNameFa}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.connected ? 'متصل' : 'غیرفعال'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Main Rounded Input Card */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-900/5 focus-within:border-[#5B4BFF] focus-within:ring-2 focus-within:ring-[#5B4BFF]/20 transition-all p-2 sm:p-3">
              {/* Selected Module Scope Chips */}
              {selectedModules.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400">محدوده تحلیل:</span>
                  {selectedModules.map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setSelectedModules(current => current.filter(item => item !== id))
                      }
                      className="min-h-[28px] text-[11px] font-bold rounded-xl px-2.5 py-1 bg-[#5B4BFF]/10 text-[#5B4BFF] dark:bg-[#5B4BFF]/20 dark:text-[#ACA2FF] flex items-center gap-1 hover:bg-[#5B4BFF]/20 transition cursor-pointer"
                    >
                      <span>
                        {id === 'all'
                          ? 'همه ماژول‌ها (ALL)'
                          : moduleCatalog.find(item => item.moduleId === id)?.moduleNameFa || id}
                      </span>
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}

              {/* Textarea Row */}
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={e => {
                    const value = e.target.value;
                    setInputMessage(value);
                    setShowSlashModulePicker(value.trimStart().startsWith('/'));
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="پیام یا دستور خود را بنویسید..."
                  className="flex-1 min-h-[44px] max-h-36 resize-none bg-transparent border-0 px-2.5 py-2.5 text-sm leading-relaxed outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  disabled={isLoading || sessionsLoading}
                />

                {/* Circular Purple Send / Stop Button */}
                <div className="shrink-0 pb-0.5">
                  {isLoading ? (
                    <button
                      type="button"
                      onClick={handleStopGeneration}
                      className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-600/25 transition-all active:scale-95 cursor-pointer"
                      title="توقف تولید پاسخ"
                      aria-label="توقف تولید پاسخ"
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() || sessionsLoading || !selectedModel}
                      className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-[#5B4BFF] hover:bg-[#4A3AE8] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white flex items-center justify-center shadow-md shadow-[#5B4BFF]/25 disabled:shadow-none transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer"
                      title="ارسال پیام"
                      aria-label="ارسال پیام"
                    >
                      <Send className="w-4 h-4 -rotate-90 rtl:rotate-180" />
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Bottom Action Toolbar (Model Selector, Context/Memory Settings, Module Scope) */}
              <div className="flex items-center justify-between gap-1.5 pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* 1. Model Selector Trigger (Opens Bottom Sheet on Mobile / Modal Sheet) */}
                  <button
                    type="button"
                    onClick={() => setActiveSheet('model')}
                    disabled={isLoading}
                    className="min-h-[44px] px-3 py-1.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                    title="انتخاب مدل هوش مصنوعی"
                  >
                    <Bot className="w-4 h-4 text-[#5B4BFF] shrink-0" />
                    <span className="max-w-[115px] sm:max-w-[180px] truncate">
                      {selectedModel || 'انتخاب مدل'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {/* 2. Context / Memory Anti-OOM Trigger */}
                  <button
                    type="button"
                    onClick={() => setActiveSheet('context')}
                    disabled={isLoading}
                    className="min-h-[44px] px-3 py-1.5 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                    title="تنظیمات کانتکست و حافظه (ضد OOM)"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#5B4BFF] shrink-0" />
                    <span className="truncate">کانتکست: {activeContextOption.shortLabel}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {/* 3. Module Scope Selector Trigger */}
                  <button
                    type="button"
                    onClick={() => setActiveSheet('modules')}
                    disabled={isLoading}
                    className={`min-h-[44px] px-3 py-1.5 rounded-2xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                      selectedModules.length > 0
                        ? 'bg-[#5B4BFF]/10 border-[#5B4BFF]/30 text-[#5B4BFF] dark:text-[#ACA2FF]'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/90 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200'
                    }`}
                    title="انتخاب ماژول‌های سامانه جهت تحلیل"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#5B4BFF] shrink-0" />
                    <span>
                      {selectedModules.includes('all')
                        ? 'ماژول‌ها: همه (ALL)'
                        : selectedModules.length > 0
                        ? `ماژول‌ها (${selectedModules.length})`
                        : 'ماژول‌ها'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                </div>

                {/* Quick /ALL Toggle Pill on Desktop/Tablet */}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedModules(prev => (prev.includes('all') ? [] : ['all']))
                  }
                  className={`hidden sm:inline-flex min-h-[44px] px-3 py-1.5 rounded-2xl text-xs font-black items-center gap-1 shrink-0 transition cursor-pointer ${
                    selectedModules.includes('all')
                      ? 'bg-[#5B4BFF] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                  }`}
                  title="تحلیل جامع تمامی ماژول‌های سامانه"
                >
                  <span>/ALL</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── ۴. باتم‌شیت‌های موبایل‌فرست (Bottom Sheets for Model, Context/Memory & Modules) ── */}
        {activeSheet !== 'none' && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setActiveSheet('none')}
          >
            <div
              className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[82dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag Handle Bar for Mobile Bottom Sheet */}
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

              {/* Sheet Header */}
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#5B4BFF]/10 text-[#5B4BFF] flex items-center justify-center">
                    {activeSheet === 'model' && <Bot className="w-5 h-5" />}
                    {activeSheet === 'context' && <Sliders className="w-5 h-5" />}
                    {activeSheet === 'modules' && <Layers className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      {activeSheet === 'model' && 'انتخاب مدل زبانی هوش مصنوعی'}
                      {activeSheet === 'context' && 'تنظیمات حافظه، کانتکست و ابزارها'}
                      {activeSheet === 'modules' && 'انتخاب محدوده ماژول‌های سامانه'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {activeSheet === 'model' && 'مدل‌های محلی آماده پاسخ‌گویی در موتور Ollama'}
                      {activeSheet === 'context' && 'مدیریت پویا و ایمن RAM سرور جهت جلوگیری از خطای OOM'}
                      {activeSheet === 'modules' && 'تعیین دامنه دسترسی هوش مصنوعی به داده‌های برخط'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSheet('none')}
                  className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                  aria-label="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sheet Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {/* SHEET 1: MODEL SELECTION */}
                {activeSheet === 'model' && (
                  <>
                    {installedModels.length === 0 ? (
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center space-y-3">
                        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                        <div className="space-y-1">
                          <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                            هیچ مدل گفت‌وگویی نصب نشده است
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            برای استفاده از دستیار هوشمند، ابتدا یک مدل مولد را از بخش مدیریت هوش مصنوعی نصب نمایید.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleNavigateToAiSettings}
                          className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#5B4BFF] hover:bg-[#4A3AE8] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-[#5B4BFF]/20 transition cursor-pointer"
                        >
                          <Settings className="w-4 h-4" />
                          <span>نصب مدل از مدیریت هوش مصنوعی</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {installedModels.map(model => {
                          const isSelected = selectedModel === model.name;
                          return (
                            <button
                              key={model.name}
                              type="button"
                              onClick={() => {
                                setSelectedModel(model.name);
                                setActiveSheet('none');
                              }}
                              className={`w-full min-h-[56px] p-3.5 rounded-2xl border text-right flex items-center justify-between gap-3 transition cursor-pointer ${
                                isSelected
                                  ? 'bg-[#5B4BFF]/10 border-[#5B4BFF] text-slate-900 dark:text-white'
                                  : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'bg-[#5B4BFF] text-white'
                                      : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  <Bot className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-black truncate">
                                    {model.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {model.details?.parameter_size
                                      ? `ظرفیت: ${model.details.parameter_size}`
                                      : 'مدل زبانی محلی آماده'}
                                    {model.details?.quantization_level
                                      ? ` • کوانتیزاسیون: ${model.details.quantization_level}`
                                      : ''}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-5 h-5 text-[#5B4BFF] shrink-0" />
                              )}
                            </button>
                          );
                        })}

                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleNavigateToAiSettings}
                            className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-[#5B4BFF] dark:text-[#9D93FF] hover:bg-[#5B4BFF]/5 flex items-center justify-center gap-2 transition cursor-pointer"
                          >
                            <Settings className="w-4 h-4" />
                            <span>مدیریت و نصب مدل‌های بیشتر</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* SHEET 2: CONTEXT & ANTI-OOM MEMORY SETTINGS */}
                {activeSheet === 'context' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                        طول پنجره کانتکست (Context Length)
                      </label>
                      {CONTEXT_OPTIONS.map(option => {
                        const isSelected = selectedContext === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSelectedContext(option.value);
                              setActiveSheet('none');
                            }}
                            className={`w-full min-h-[60px] p-3.5 rounded-2xl border text-right flex items-start justify-between gap-3 transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#5B4BFF]/10 border-[#5B4BFF] text-slate-900 dark:text-white'
                                : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="space-y-1">
                              <p className="text-xs font-black">{option.label}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                {option.desc}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="w-5 h-5 text-[#5B4BFF] shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Tool Execution Toggle */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                          واکشی زنده داده‌های ماژول‌ها (Tool Calling)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          اجازه دسترسی برخط به دیتابیس و ماژول‌های HSE هنگام پاسخ‌گویی
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAllowTools(!allowTools)}
                        className={`min-h-[44px] px-4 rounded-xl text-xs font-black transition cursor-pointer ${
                          allowTools
                            ? 'bg-[#5B4BFF] text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {allowTools ? 'فعال' : 'غیرفعال'}
                      </button>
                    </div>
                  </div>
                )}

                {/* SHEET 3: MODULE SCOPE PICKER */}
                {activeSheet === 'modules' && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={moduleSearchQuery}
                        onChange={e => setModuleSearchQuery(e.target.value)}
                        placeholder="جستجو در ماژول‌ها و زیرتب‌ها..."
                        className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs py-2.5 pe-3 ps-10 outline-none focus:border-[#5B4BFF] text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {/* /ALL Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedModules(prev => (prev.includes('all') ? [] : ['all']));
                        setActiveSheet('none');
                      }}
                      className={`w-full min-h-[52px] p-3.5 rounded-2xl border text-right flex items-center justify-between gap-2 transition cursor-pointer ${
                        selectedModules.includes('all')
                          ? 'bg-[#5B4BFF]/10 border-[#5B4BFF] text-[#5B4BFF] dark:text-[#ACA2FF]'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black">
                          /ALL — تحلیل جامع تمامی ماژول‌های سامانه
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          پوشش ۱۰۰٪ ماژول‌های فعال به همراه اعلام وضعیت اتصال هر بخش
                        </p>
                      </div>
                      {selectedModules.includes('all') && (
                        <CheckCircle2 className="w-5 h-5 text-[#5B4BFF] shrink-0" />
                      )}
                    </button>

                    {/* Individual Modules List */}
                    <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                      {filteredModules.map(item => {
                        const isSelected = selectedModules.includes(item.moduleId);
                        const hasVisibleParent = Boolean(
                          item.parentModuleId &&
                            moduleCatalog.some(parent => parent.moduleId === item.parentModuleId)
                        );
                        return (
                          <button
                            key={item.moduleId}
                            type="button"
                            disabled={!item.connected}
                            onClick={() => {
                              setSelectedModules(current => {
                                const next = current.includes(item.moduleId)
                                  ? current.filter(id => id !== item.moduleId)
                                  : [...current.filter(id => id !== 'all'), item.moduleId];
                                return next;
                              });
                            }}
                            className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border text-right flex items-center justify-between gap-2 text-xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              isSelected
                                ? 'bg-[#5B4BFF]/10 border-[#5B4BFF] text-[#5B4BFF] dark:text-[#ACA2FF] font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              style={{
                                paddingRight: hasVisibleParent
                                  ? `${Math.min(item.level || 1, 4) * 12}px`
                                  : '0px',
                              }}
                              className="truncate"
                            >
                              {hasVisibleParent ? '↳ ' : ''}
                              {item.moduleNameFa}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-slate-400">
                                {item.connected
                                  ? item.tools?.length
                                    ? 'ابزار داده‌خوان'
                                    : 'پایگاه دانش'
                                  : 'غیرفعال'}
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-[#5B4BFF]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedModules([])}
                        className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                      >
                        پاک‌سازی انتخاب
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSheet('none')}
                        className="flex-1 min-h-[44px] px-4 rounded-xl bg-[#5B4BFF] text-white text-xs font-bold"
                      >
                        تأیید و اعمال ({selectedModules.length || 'پیش‌فرض'})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
