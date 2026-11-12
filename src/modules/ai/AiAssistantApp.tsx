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
  ArrowUp,
  X,
  ChevronDown,
  Settings,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  ThermometerSun,
  Activity,
  PieChart,
  ShieldCheck,
  Flame,
  HeartPulse,
  FileCheck2,
  ClipboardCheck,
  ShieldAlert,
  HardHat,
  AlertOctagon,
  AlertTriangle,
  Users,
  GraduationCap,
  FileText,
  Inbox,
  ClipboardList,
  Workflow,
  Bell,
  UserCog,
  User,
  Stethoscope,
  Leaf,
  CornerDownLeft,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { authFetch } from '../../services/apiDatabaseClient';
import {
  parseSlashQueryFromInput,
  stripSlashTokenFromInput,
  searchAndRankModules,
  SlashModuleCatalogItem,
  RankedSlashModuleItem,
} from '../../utils/aiModuleSlashSearch';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolsUsed?: string[];
  citations?: string[];
  durationMs?: number;
  model?: string;
  completed?: boolean;
  incompleteReason?: string;
  originalPrompt?: string;
  streaming?: boolean;
}

function isClientMessageIncomplete(content: string): boolean {
  const trimmed = String(content || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('⏹') || trimmed.startsWith('خطا در')) return false;
  if (/(\*{1,3}|#{1,4})\s*[\u0600-\u06FFa-zA-Z0-9]{0,6}$/.test(trimmed)) return true;
  const lastLine = trimmed.split('\n').pop()?.trim() || '';
  const boldCount = (lastLine.match(/\*\*/g) || []).length;
  if (boldCount % 2 === 1 && lastLine.length < 45) return true;
  if (/([:،؛\-–—(«]|(?:\s+(?:و|یا|در|به|از|که|برای|با|بر|تا|چون|زیرا|شامل|مانند|عبارتند از)))$/u.test(trimmed)) {
    return true;
  }
  return false;
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

const AI_SELECTED_MODEL_STORAGE_KEY = 'hsecore_ai_selected_model';
const HSECORE_ANALYTICAL_ENGINE_ID = 'hsecore-analytical-engine';
const HSECORE_ANALYTICAL_ENGINE_LABEL = 'موتور تحلیلی سریع HSECORE (مستقل و بدون LLM)';
const HSECORE_ANALYTICAL_ENGINE_SHORT_LABEL = 'موتور تحلیلی سریع HSECORE';

interface InstalledModelItem {
  name: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface AiRuntimeCache {
  userKey: string;
  sessions: ChatSession[];
  activeSessionId: string;
  selectedModel: string;
  selectedContext: string;
  selectedModules: string[];
  installedModels: InstalledModelItem[];
  isLoading: boolean;
  activeStreamingSessionId: string;
  migrated: boolean;
  autoCreated: boolean;
  activeAbortController: AbortController | null;
}

const aiRuntimeCache: AiRuntimeCache = {
  userKey: '',
  sessions: [],
  activeSessionId: '',
  selectedModel: '',
  selectedContext: 'auto',
  selectedModules: [],
  installedModels: [],
  isLoading: false,
  activeStreamingSessionId: '',
  migrated: false,
  autoCreated: false,
  activeAbortController: null,
};

const aiRuntimeListeners = new Set<() => void>();
function notifyAiRuntimeListeners() {
  aiRuntimeListeners.forEach(listener => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

function getStoredSelectedModel(): string {
  try {
    return localStorage.getItem(AI_SELECTED_MODEL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function setStoredSelectedModel(model: string) {
  try {
    if (model) {
      localStorage.setItem(AI_SELECTED_MODEL_STORAGE_KEY, model);
    }
  } catch {
    // ignore storage errors
  }
}

function ensureRuntimeCacheForUser(userKey: string) {
  if (aiRuntimeCache.userKey !== userKey) {
    aiRuntimeCache.userKey = userKey;
    aiRuntimeCache.sessions = [];
    aiRuntimeCache.activeSessionId = '';
    aiRuntimeCache.selectedModel = getStoredSelectedModel();
    aiRuntimeCache.selectedContext = 'auto';
    aiRuntimeCache.selectedModules = [];
    aiRuntimeCache.installedModels = [];
    aiRuntimeCache.isLoading = false;
    aiRuntimeCache.activeStreamingSessionId = '';
    aiRuntimeCache.migrated = false;
    aiRuntimeCache.autoCreated = false;
    aiRuntimeCache.activeAbortController = null;
  }
}

export default function AiAssistantApp({
  currentUser,
  onOpenGlobalMenu,
  onNavigate,
}: AiAssistantAppProps) {
  const userKey = String(
    (currentUser as any)?.uid || currentUser?.id || currentUser?.username || 'default'
  );
  ensureRuntimeCacheForUser(userKey);

  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoadingState] = useState<boolean>(() => aiRuntimeCache.isLoading);
  const [installedModels, setInstalledModelsState] = useState<InstalledModelItem[]>(
    () => aiRuntimeCache.installedModels
  );
  const [selectedModel, setSelectedModelState] = useState<string>(
    () => aiRuntimeCache.selectedModel || getStoredSelectedModel()
  );
  const [selectedContext, setSelectedContextState] = useState<string>(
    () => aiRuntimeCache.selectedContext || 'auto'
  );
  const [allowTools, setAllowTools] = useState<boolean>(() => getAiAllowToolsSetting());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheetType>('none');
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(
    () => aiRuntimeCache.sessions.length === 0
  );
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [sessions, setSessionsState] = useState<ChatSession[]>(() => aiRuntimeCache.sessions);
  const [activeSessionId, setActiveSessionIdState] = useState<string>(
    () => aiRuntimeCache.activeSessionId
  );
  const [searchSessionQuery, setSearchSessionQuery] = useState<string>('');
  const [moduleSearchQuery, setModuleSearchQuery] = useState<string>('');
  const [moduleCatalog, setModuleCatalog] = useState<SlashModuleCatalogItem[]>([]);
  const [selectedModules, setSelectedModulesState] = useState<string[]>(
    () => aiRuntimeCache.selectedModules
  );
  const [showSlashModulePicker, setShowSlashModulePicker] = useState(false);
  const [slashActiveIndex, setSlashActiveIndex] = useState<number>(0);
  const [slashDismissedForInput, setSlashDismissedForInput] = useState<string | null>(null);
  const [debouncedSlashQuery, setDebouncedSlashQuery] = useState<string>('');
  const slashDropdownListRef = useRef<HTMLDivElement>(null);

  const setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>> = updater => {
    const next = typeof updater === 'function' ? updater(aiRuntimeCache.sessions) : updater;
    aiRuntimeCache.sessions = next;
    setSessionsState(next);
    notifyAiRuntimeListeners();
  };

  const setActiveSessionId: React.Dispatch<React.SetStateAction<string>> = updater => {
    const next =
      typeof updater === 'function' ? updater(aiRuntimeCache.activeSessionId) : updater;
    aiRuntimeCache.activeSessionId = next;
    try {
      if (next) sessionStorage.setItem(`hsecore_ai_active_session_${userKey}`, next);
    } catch {
      // ignore storage errors
    }
    setActiveSessionIdState(next);
    notifyAiRuntimeListeners();
  };

  const setSelectedModel: React.Dispatch<React.SetStateAction<string>> = updater => {
    const next = typeof updater === 'function' ? updater(aiRuntimeCache.selectedModel) : updater;
    aiRuntimeCache.selectedModel = next;
    if (next) setStoredSelectedModel(next);
    setSelectedModelState(next);
    notifyAiRuntimeListeners();
  };

  const setSelectedContext: React.Dispatch<React.SetStateAction<string>> = updater => {
    const next =
      typeof updater === 'function' ? updater(aiRuntimeCache.selectedContext) : updater;
    aiRuntimeCache.selectedContext = next;
    setSelectedContextState(next);
    notifyAiRuntimeListeners();
  };

  const setSelectedModules: React.Dispatch<React.SetStateAction<string[]>> = updater => {
    const next =
      typeof updater === 'function' ? updater(aiRuntimeCache.selectedModules) : updater;
    aiRuntimeCache.selectedModules = next;
    setSelectedModulesState(next);
    notifyAiRuntimeListeners();
  };

  const setInstalledModels: React.Dispatch<React.SetStateAction<InstalledModelItem[]>> = updater => {
    const next =
      typeof updater === 'function' ? updater(aiRuntimeCache.installedModels) : updater;
    aiRuntimeCache.installedModels = next;
    setInstalledModelsState(next);
    notifyAiRuntimeListeners();
  };

  const setIsLoading: React.Dispatch<React.SetStateAction<boolean>> = updater => {
    const next = typeof updater === 'function' ? updater(aiRuntimeCache.isLoading) : updater;
    aiRuntimeCache.isLoading = next;
    setIsLoadingState(next);
    notifyAiRuntimeListeners();
  };

  useEffect(() => {
    ensureRuntimeCacheForUser(userKey);
    const syncFromRuntime = () => {
      setSessionsState(aiRuntimeCache.sessions);
      setActiveSessionIdState(aiRuntimeCache.activeSessionId);
      setSelectedModelState(aiRuntimeCache.selectedModel);
      setSelectedContextState(aiRuntimeCache.selectedContext);
      setSelectedModulesState(aiRuntimeCache.selectedModules);
      setInstalledModelsState(aiRuntimeCache.installedModels);
      setIsLoadingState(aiRuntimeCache.isLoading);
    };
    aiRuntimeListeners.add(syncFromRuntime);
    syncFromRuntime();
    return () => {
      aiRuntimeListeners.delete(syncFromRuntime);
    };
  }, [userKey]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deletingRef = useRef(false);

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
    if (aiRuntimeCache.sessions.length === 0) {
      setSessionsLoading(true);
    }
    setSessionsError(null);
    try {
      const res = await authFetch('/api/v1/ai/sessions');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'خطا در دریافت گفتگوها');

      let rawList: Array<{ id: string; title: string; createdAt: string }> = data.data || [];

      if (!aiRuntimeCache.migrated) {
        aiRuntimeCache.migrated = true;
        try {
          const raw = localStorage.getItem('hsecore_ai_sessions');
          if (raw) {
            const localSessions = JSON.parse(raw);
            if (Array.isArray(localSessions) && localSessions.length > 0) {
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

              localStorage.removeItem('hsecore_ai_sessions');
              rawList = data2.data;
            }
          }
        } catch {
          // best-effort
        }
      }

      if (rawList.length === 0 && !aiRuntimeCache.autoCreated) {
        aiRuntimeCache.autoCreated = true;
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
          rawList = [createData.data];
        }
      } else if (rawList.length > 0) {
        aiRuntimeCache.autoCreated = true;
      }

      const existingById = new Map(aiRuntimeCache.sessions.map(s => [s.id, s]));
      const mergedList: ChatSession[] = rawList.map(raw => {
        const existing = existingById.get(raw.id);
        return {
          id: raw.id,
          title:
            existing?.title && existing.title !== 'گفت‌وگوی جدید' && raw.title === 'گفت‌وگوی جدید'
              ? existing.title
              : raw.title,
          createdAt: raw.createdAt,
          messages: existing?.messages || [],
        };
      });

      // Preserve any in-memory session that is currently streaming
      for (const existing of aiRuntimeCache.sessions) {
        if (!mergedList.some(item => item.id === existing.id) && existing.messages.length > 0) {
          mergedList.unshift(existing);
        }
      }

      setSessions(mergedList);

      let storedActiveId = '';
      try {
        storedActiveId = sessionStorage.getItem(`hsecore_ai_active_session_${userKey}`) || '';
      } catch {
        // ignore
      }
      const preferredId = aiRuntimeCache.activeSessionId || storedActiveId;
      const resolvedActiveId =
        preferredId && mergedList.some(s => s.id === preferredId)
          ? preferredId
          : mergedList[0]?.id || '';

      setActiveSessionId(resolvedActiveId);
      if (
        resolvedActiveId &&
        !(aiRuntimeCache.isLoading && aiRuntimeCache.activeStreamingSessionId === resolvedActiveId)
      ) {
        await loadMessagesForSession(resolvedActiveId);
      }
    } catch (err: any) {
      setSessionsError(err?.message || 'خطا در بارگذاری گفتگوها');
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadMessagesForSession = async (sessionId: string) => {
    if (!sessionId) return;
    // Never overwrite a session while it is actively streaming a response
    if (aiRuntimeCache.isLoading && aiRuntimeCache.activeStreamingSessionId === sessionId) {
      return;
    }
    try {
      const res = await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !Array.isArray(data.data)) {
        throw new Error(data.message || `دریافت پیام‌های گفتگو ناموفق بود (HTTP ${res.status})`);
      }
      const msgs: ChatMessage[] = data.data.map((m: any, idx: number, arr: any[]) => {
        const isAssistant = m.role === 'assistant';
        const contentStr = String(m.content || '');
        const structurallyCut = isAssistant && isClientMessageIncomplete(contentStr);
        let prevUserPrompt = '';
        if (isAssistant) {
          for (let i = idx - 1; i >= 0; i--) {
            if (arr[i]?.role === 'user' && arr[i]?.content) {
              prevUserPrompt = String(arr[i].content);
              break;
            }
          }
        }
        return {
          id: m.id,
          role: isAssistant ? 'assistant' : 'user',
          content: contentStr,
          timestamp: m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
            : '',
          toolsUsed: m.toolsUsed,
          citations: m.citations,
          durationMs: m.durationMs,
          model: m.model,
          completed: isAssistant ? !structurallyCut : true,
          incompleteReason: structurallyCut
            ? 'این پاسخ در میانه جمله متوقف شده است. می‌توانید ادامه آن را تولید کنید.'
            : undefined,
          originalPrompt: prevUserPrompt || undefined,
        };
      });
      setSessions(prev =>
        prev.map(s => {
          if (s.id !== sessionId) return s;
          if (aiRuntimeCache.isLoading && aiRuntimeCache.activeStreamingSessionId === sessionId) {
            return s;
          }
          return { ...s, messages: msgs };
        })
      );
    } catch (err: any) {
      setSessionsError(err?.message || 'خواندن سابقه گفتگو از پایگاه داده ناموفق بود.');
    }
  };

  const refreshInstalledModels = async () => {
    try {
      const [modelsResponse, statusResponse] = await Promise.all([
        authFetch('/api/v1/ai/models'),
        authFetch('/api/v1/ai/status').catch(() => null),
      ]);
      if (!modelsResponse.ok) throw new Error(`HTTP ${modelsResponse.status}`);
      const data = await modelsResponse.json();
      const statusData = statusResponse && statusResponse.ok ? await statusResponse.json().catch(() => null) : null;
      const serverDefaultModel = String(statusData?.data?.defaultChatModel || '').trim();

      const models: InstalledModelItem[] = Array.isArray(data?.data)
        ? data.data.filter(
            (model: any) =>
              String(model?.details?.family || '').toLowerCase() !== 'bert' &&
              !/embed|embedding|bge-m3|nomic-embed|mxbai-embed/i.test(String(model?.name || ''))
          )
        : [];
      setInstalledModels(models);

      const matchModelName = (candidate?: string): string => {
        const clean = String(candidate || '').trim().toLowerCase();
        if (!clean) return '';
        if (clean === HSECORE_ANALYTICAL_ENGINE_ID) return HSECORE_ANALYTICAL_ENGINE_ID;
        const found = models.find(
          (m: any) =>
            typeof m?.name === 'string' &&
            (m.name.toLowerCase() === clean ||
              m.name.toLowerCase() === `${clean}:latest` ||
              `${m.name.toLowerCase()}:latest` === clean)
        );
        return found ? found.name : '';
      };

      setSelectedModel(current => {
        const kept =
          matchModelName(current) ||
          matchModelName(aiRuntimeCache.selectedModel) ||
          matchModelName(getStoredSelectedModel()) ||
          matchModelName(serverDefaultModel) ||
          models[0]?.name ||
          HSECORE_ANALYTICAL_ENGINE_ID;
        return kept;
      });
    } catch {
      // Preserve previously known models on transient network error
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
      if (!aiRuntimeCache.isLoading) {
        void refreshInstalledModels();
      }
    }, 45000);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('hse_ui_config_updated', onModuleConfigUpdated);
      window.removeEventListener('health_env_config_updated', onModuleConfigUpdated);
      window.removeEventListener('fire_dept_config_updated', onModuleConfigUpdated);
      window.removeEventListener('safety_dept_config_updated', onModuleConfigUpdated);
    };
  }, []);

  useEffect(() => {
    if (
      activeSessionId &&
      !(aiRuntimeCache.isLoading && aiRuntimeCache.activeStreamingSessionId === activeSessionId)
    ) {
      loadMessagesForSession(activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
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

  const renderModuleIcon = (iconName?: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'BarChart3':
        return <BarChart3 className={className} />;
      case 'ThermometerSun':
        return <ThermometerSun className={className} />;
      case 'Activity':
        return <Activity className={className} />;
      case 'PieChart':
        return <PieChart className={className} />;
      case 'ShieldCheck':
        return <ShieldCheck className={className} />;
      case 'Flame':
        return <Flame className={className} />;
      case 'HeartPulse':
        return <HeartPulse className={className} />;
      case 'FileCheck2':
        return <FileCheck2 className={className} />;
      case 'ClipboardCheck':
        return <ClipboardCheck className={className} />;
      case 'ShieldAlert':
        return <ShieldAlert className={className} />;
      case 'HardHat':
        return <HardHat className={className} />;
      case 'AlertOctagon':
        return <AlertOctagon className={className} />;
      case 'AlertTriangle':
        return <AlertTriangle className={className} />;
      case 'Users':
        return <Users className={className} />;
      case 'GraduationCap':
        return <GraduationCap className={className} />;
      case 'FileText':
        return <FileText className={className} />;
      case 'Inbox':
        return <Inbox className={className} />;
      case 'ClipboardList':
        return <ClipboardList className={className} />;
      case 'Workflow':
        return <Workflow className={className} />;
      case 'Bell':
        return <Bell className={className} />;
      case 'UserCog':
        return <UserCog className={className} />;
      case 'User':
        return <User className={className} />;
      case 'Stethoscope':
        return <Stethoscope className={className} />;
      case 'Leaf':
        return <Leaf className={className} />;
      case 'Bot':
        return <Bot className={className} />;
      case 'Settings':
        return <Settings className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  const parsedSlash = useMemo(() => parseSlashQueryFromInput(inputMessage), [inputMessage]);

  useEffect(() => {
    if (!parsedSlash.isActive) {
      setDebouncedSlashQuery('');
      return;
    }
    if (!parsedSlash.query) {
      setDebouncedSlashQuery('');
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSlashQuery(parsedSlash.query);
    }, 45);
    return () => window.clearTimeout(timer);
  }, [parsedSlash.isActive, parsedSlash.query]);

  const slashSearchResults = useMemo<RankedSlashModuleItem[]>(() => {
    if (!parsedSlash.isActive) return [];
    return searchAndRankModules(moduleCatalog, debouncedSlashQuery, {
      selectedModuleIds: selectedModules,
      onlyConnected: false,
    });
  }, [moduleCatalog, parsedSlash.isActive, debouncedSlashQuery, selectedModules]);

  const isSlashAutocompleteOpen =
    showSlashModulePicker &&
    parsedSlash.isActive &&
    slashDismissedForInput !== inputMessage;

  useEffect(() => {
    setSlashActiveIndex(0);
  }, [debouncedSlashQuery, parsedSlash.isActive]);

  useEffect(() => {
    if (!isSlashAutocompleteOpen || !slashDropdownListRef.current) return;
    const activeEl = slashDropdownListRef.current.querySelector(
      `[data-slash-index="${slashActiveIndex}"]`
    ) as HTMLElement | null;
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [slashActiveIndex, isSlashAutocompleteOpen]);

  const handleSelectSlashModule = (item: RankedSlashModuleItem) => {
    if (!item.connected && !item.isAllCommand) return;
    if (item.isAllCommand || item.moduleId === 'all') {
      setSelectedModules(current => (current.includes('all') ? [] : ['all']));
    } else {
      setSelectedModules(current => {
        const exists = current.includes(item.moduleId);
        return exists
          ? current.filter(id => id !== item.moduleId)
          : [...current.filter(id => id !== 'all'), item.moduleId];
      });
    }
    const nextInput = stripSlashTokenFromInput(inputMessage, parsedSlash);
    setInputMessage(nextInput);
    setShowSlashModulePicker(false);
    setSlashDismissedForInput(null);
    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const getSelectedModuleScope = (explicitModules?: string[]): string[] => {
    const baseModules = explicitModules ?? selectedModules;
    const scope = new Set(baseModules);
    for (const selectedId of baseModules) {
      let parentId = moduleCatalog.find(item => item.moduleId === selectedId)?.parentModuleId;
      let depth = 0;
      while (parentId && depth < 8) {
        const parentItem = moduleCatalog.find(item => item.moduleId === parentId);
        if (parentItem?.connected) {
          scope.add(parentId);
        }
        parentId = parentItem?.parentModuleId;
        depth++;
      }
    }
    return Array.from(scope);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend !== undefined ? textToSend : inputMessage).trim();
    if (isLoading) return;

    let effectiveSelectedModules = [...selectedModules];
    let text = rawText;

    // Support direct '/ALL' or '/نام ماژول' submission
    if (rawText.toUpperCase() === '/ALL') {
      effectiveSelectedModules = ['all'];
      setSelectedModules(['all']);
    } else if (rawText.startsWith('/') && rawText.length > 1 && rawText !== '/') {
      const directSlashParsed = parseSlashQueryFromInput(rawText);
      if (directSlashParsed.isActive && directSlashParsed.query) {
        const directMatches = searchAndRankModules(moduleCatalog, directSlashParsed.query, {
          selectedModuleIds: effectiveSelectedModules,
          onlyConnected: true,
        });
        const bestMatch = directMatches.find(m => !m.isAllCommand);
        if (
          bestMatch &&
          (bestMatch.matchTier === 'exact' || bestMatch.matchTier === 'prefix')
        ) {
          if (!effectiveSelectedModules.includes(bestMatch.moduleId)) {
            effectiveSelectedModules = [
              ...effectiveSelectedModules.filter(id => id !== 'all'),
              bestMatch.moduleId,
            ];
            setSelectedModules(effectiveSelectedModules);
          }
          const remainder = stripSlashTokenFromInput(rawText, directSlashParsed);
          text =
            remainder ||
            `تحلیل جامع ساختار، زیرماژول‌ها و داده‌های ماژول ${bestMatch.moduleNameFa}`;
        }
      }
    }

    // Allow sending when modules are selected via Chips even if message input is empty
    if (!text && effectiveSelectedModules.length > 0) {
      if (effectiveSelectedModules.includes('all')) {
        text = 'تحلیل جامع و یکپارچه تمام ماژول‌ها و زیرماژول‌های فعال سامانه (/ALL)';
      } else {
        const moduleTitles = effectiveSelectedModules.map(id => {
          const found = moduleCatalog.find(item => item.moduleId === id);
          if (!found) return id;
          return found.subModuleNameFa
            ? `${found.mainModuleNameFa} (${found.subModuleNameFa})`
            : found.moduleNameFa;
        });
        text = `تحلیل جامع ساختار، زیرماژول‌ها و داده‌های ${moduleTitles.length > 1 ? 'ماژول‌های' : 'ماژول'} ${moduleTitles.join(' و ')}`;
      }
    }

    if (!text) return;

    if (installedModels.length === 0 && !selectedModel) {
      setActiveSheet('model');
      setSessionsError('هیچ مدل زبانی برای پاسخگویی هوش مصنوعی نصب نشده است. لطفاً از بخش مدیریت هوش مصنوعی یک مدل نصب فرمایید.');
      return;
    }

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
    setSlashDismissedForInput(null);
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

    const assistantId = createMessageId('msg-a');
    const timestamp = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const streamingMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp,
      model: selectedModel,
      streaming: true,
      completed: undefined,
      originalPrompt: text,
    };

    aiRuntimeCache.activeStreamingSessionId = sessionId;
    setIsLoading(true);
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...updatedMessages, streamingMessage] } : s
      )
    );

    let partialAssistantText = '';
    const partialAssistantId = assistantId;
    let partialResponseModel = selectedModel;
    let partialDurationMs: number | undefined;
    let responseToolsUsed: string[] = [];
    let responseCitations: string[] = [];
    let serverHistorySaved = false;
    let responseCompleted = true;
    let responseIncompleteReason: string | undefined;
    let rafHandle: number | null = null;

    const flushStreamingTextToState = (latestText: string) => {
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === assistantId ? { ...m, content: latestText, streaming: true } : m
                ),
              }
            : s
        )
      );
    };

    const scheduleStreamingFlush = (latestText: string) => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        flushStreamingTextToState(latestText);
        return;
      }
      if (rafHandle !== null) return;
      rafHandle = window.requestAnimationFrame(() => {
        rafHandle = null;
        flushStreamingTextToState(partialAssistantText);
      });
    };

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
      aiRuntimeCache.activeAbortController = requestController;
      const res = await authFetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          message: text,
          sessionId,
          messageId: assistantId,
          assistantId: 'GENERAL_HSE',
          history: historyPayload,
          model: selectedModel,
          selectedModules: getSelectedModuleScope(effectiveSelectedModules),
          allowTools: getAiAllowToolsSetting(),
          stream: true,
          num_ctx: parsedContextTokens,
          contextTokens: parsedContextTokens,
        }),
        signal: requestController.signal,
      });
      if (!res.ok || !res.body) {
        const failure = await res.json().catch(() => ({}));
        if (failure?.historySaved === true) serverHistorySaved = true;
        throw new Error(failure.message || `خطای سرور هوش مصنوعی: HTTP ${res.status}`);
      }

      let assistantText = '';
      let responseModel = selectedModel;
      let durationMs: number | undefined;
      let receivedDoneSignal = false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let streamError = '';
      let streamAborted = false;
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
          scheduleStreamingFlush(assistantText);
        }
        if (payload.done === true) {
          receivedDoneSignal = true;
          if (payload.completed === false) {
            responseCompleted = false;
            responseIncompleteReason =
              payload.incompleteReason ||
              'پاسخ به سقف توکن رسید و پیش از تکمیل کامل متوقف شد.';
          }
        }
        if (payload.incomplete === true || payload.completed === false) {
          responseCompleted = false;
          if (payload.incompleteReason) {
            responseIncompleteReason = payload.incompleteReason;
          }
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
        if (payload.historySaved === false && !payload.error) {
          setSessionsError('پاسخ تولید شد اما ذخیره سمت سرور ناموفق بود؛ لطفاً پایگاه داده را بررسی کنید.');
        }
        if (payload.aborted === true) streamAborted = true;
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

      if (rafHandle !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }

      if (streamAborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      if (streamError) throw new Error(streamError);
      if (!assistantText.trim()) throw new Error('پاسخی از موتور هوش مصنوعی دریافت نشد.');

      const finalIsComplete =
        receivedDoneSignal && responseCompleted && !isClientMessageIncomplete(assistantText);
      const finalIncompleteReason = !finalIsComplete
        ? responseIncompleteReason ||
          'پاسخ در میانه جمله متوقف شد. برای تکمیل ادامه متن، دکمه «ادامه تولید پاسخ از محل توقف» را انتخاب کنید.'
        : undefined;

      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: assistantText,
                        streaming: false,
                        completed: finalIsComplete,
                        incompleteReason: finalIncompleteReason,
                        originalPrompt: text,
                        toolsUsed: responseToolsUsed,
                        citations: responseCitations,
                        durationMs,
                        model: responseModel,
                      }
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
              id: assistantId,
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
      if (rafHandle !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      const nowTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
      const isAborted =
        requestError?.name === 'AbortError' ||
        String(requestError?.message || '').toLowerCase().includes('aborted');
      const hasPartial = Boolean(partialAssistantText.trim() && partialAssistantId);

      const finalFallbackText = hasPartial
        ? partialAssistantText
        : isAborted
          ? '⏹ پردازش درخواست توسط کاربر متوقف گردید.'
          : requestError?.message || 'خطا در ارتباط با سرور هوش مصنوعی سامانه. لطفاً اتصال شبکه را بررسی فرمایید.';

      const finalAssistantMsg: ChatMessage = {
        id: hasPartial ? partialAssistantId : createMessageId('msg-err'),
        role: 'assistant',
        content: finalFallbackText,
        timestamp: nowTime,
        model: partialResponseModel,
        durationMs: partialDurationMs,
        toolsUsed: responseToolsUsed.length > 0 ? responseToolsUsed : undefined,
        citations: responseCitations.length > 0 ? responseCitations : undefined,
        streaming: false,
        completed: hasPartial ? false : undefined,
        incompleteReason: hasPartial
          ? isAborted
            ? 'تولید پاسخ توسط کاربر متوقف شد. در صورت تمایل می‌توانید ادامه پاسخ را از همین نقطه تولید کنید.'
            : requestError?.message || 'ارتباط استریم پیش از پایان کامل قطع شد. می‌توانید ادامه پاسخ را از محل توقف دریافت کنید.'
          : undefined,
        originalPrompt: text,
      };

      setSessions(prev =>
        prev.map(s => {
          if (s.id !== sessionId) return s;
          const baseMessages = s.messages.filter(m => m.id !== partialAssistantId);
          return {
            ...s,
            messages: [...baseMessages, finalAssistantMsg],
          };
        })
      );

      // Persist the partial/aborted/error reply if the server hasn't already saved it,
      // so switching modules and returning never wipes the assistant bubble!
      if (!serverHistorySaved) {
        try {
          await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: finalAssistantMsg.id,
              role: 'assistant',
              content: finalFallbackText,
              toolsUsed: responseToolsUsed,
              citations: responseCitations,
              durationMs: partialDurationMs,
              model: partialResponseModel,
            }),
          });
        } catch {
          // keep local message visible
        }
      }
    } finally {
      aiRuntimeCache.activeAbortController = null;
      aiRuntimeCache.activeStreamingSessionId = '';
      setIsLoading(false);
    }
  };

  const handleContinueGeneration = async (targetMsg: ChatMessage) => {
    if (isLoading || !activeSession) return;
    const sessionId = activeSession.id;
    const existingText = String(targetMsg.content || '');
    if (!existingText.trim()) return;

    // Find original user prompt preceding this assistant message
    const msgs = activeSession.messages || [];
    const targetIdx = msgs.findIndex(m => m.id === targetMsg.id);
    let promptToContinue = targetMsg.originalPrompt || '';
    if (!promptToContinue && targetIdx > 0) {
      for (let i = targetIdx - 1; i >= 0; i--) {
        if (msgs[i].role === 'user' && msgs[i].content.trim()) {
          promptToContinue = msgs[i].content.trim();
          break;
        }
      }
    }
    if (!promptToContinue) {
      promptToContinue = 'ادامه تحلیل تخصصی و تکمیل بخش‌های باقی‌مانده پاسخ';
    }

    aiRuntimeCache.activeStreamingSessionId = sessionId;
    setIsLoading(true);
    setSessions(prev =>
      prev.map(s =>
        s.id === sessionId
          ? {
              ...s,
              messages: s.messages.map(m =>
                m.id === targetMsg.id
                  ? { ...m, streaming: true, incompleteReason: undefined }
                  : m
              ),
            }
          : s
      )
    );

    let appendedText = '';
    let combinedText = existingText;
    let responseModel = targetMsg.model || selectedModel;
    let durationMs = targetMsg.durationMs;
    let responseCompleted = true;
    let responseIncompleteReason: string | undefined;
    let receivedDoneSignal = false;
    let serverHistorySaved = false;

    try {
      const historyPayload = (targetIdx > 0 ? msgs.slice(0, targetIdx) : msgs)
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));
      const parsedContextTokens = selectedContext === 'auto' ? undefined : Number(selectedContext);
      const requestController = new AbortController();
      aiRuntimeCache.activeAbortController = requestController;

      const res = await authFetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          message: promptToContinue,
          continueFromText: existingText,
          messageId: targetMsg.id,
          sessionId,
          assistantId: 'GENERAL_HSE',
          history: historyPayload,
          model: selectedModel,
          selectedModules: getSelectedModuleScope(selectedModules),
          allowTools: getAiAllowToolsSetting(),
          stream: true,
          num_ctx: parsedContextTokens,
          contextTokens: parsedContextTokens,
        }),
        signal: requestController.signal,
      });

      if (!res.ok || !res.body) {
        const failure = await res.json().catch(() => ({}));
        throw new Error(failure.message || `خطای سرور در ادامه تولید پاسخ: HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let streamError = '';
      let streamAborted = false;

      const joinContinuation = (base: string, addition: string): string => {
        if (!addition) return base;
        const needsSpace =
          !base.endsWith(' ') &&
          !base.endsWith('\n') &&
          !addition.startsWith(' ') &&
          !addition.startsWith('\n') &&
          !/(\*{1,3}|[\u0600-\u06FF])$/.test(base.slice(-2));
        return `${base}${needsSpace ? ' ' : ''}${addition}`;
      };

      const applyEvent = (line: string) => {
        if (!line.startsWith('data:')) return;
        let payload: any;
        try {
          payload = JSON.parse(line.slice(5).trim());
        } catch {
          return;
        }
        if (payload.token) {
          appendedText += payload.token;
          combinedText = joinContinuation(existingText, appendedText);
          setSessions(prev =>
            prev.map(s =>
              s.id === sessionId
                ? {
                    ...s,
                    messages: s.messages.map(m =>
                      m.id === targetMsg.id ? { ...m, content: combinedText, streaming: true } : m
                    ),
                  }
                : s
            )
          );
        }
        if (payload.done === true) {
          receivedDoneSignal = true;
          if (payload.completed === false) {
            responseCompleted = false;
            responseIncompleteReason = payload.incompleteReason;
          }
        }
        if (payload.completed === false || payload.incomplete === true) {
          responseCompleted = false;
          if (payload.incompleteReason) responseIncompleteReason = payload.incompleteReason;
        }
        if (payload.model) responseModel = payload.model;
        if (payload.durationMs) durationMs = (targetMsg.durationMs || 0) + Number(payload.durationMs);
        if (payload.historySaved === true) serverHistorySaved = true;
        if (payload.aborted === true) streamAborted = true;
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

      if (streamAborted) {
        throw new DOMException('The user aborted a request.', 'AbortError');
      }
      if (streamError) throw new Error(streamError);

      const finalIsComplete =
        receivedDoneSignal && responseCompleted && !isClientMessageIncomplete(combinedText);

      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === targetMsg.id
                    ? {
                        ...m,
                        content: combinedText,
                        streaming: false,
                        completed: finalIsComplete,
                        incompleteReason: finalIsComplete
                          ? undefined
                          : responseIncompleteReason ||
                            'بخش دیگری از پاسخ باقی مانده است؛ می‌توانید مجدداً ادامه تولید را بزنید.',
                        model: responseModel,
                        durationMs,
                      }
                    : m
                ),
              }
            : s
        )
      );

      if (!serverHistorySaved) {
        await authFetch(`/api/v1/ai/sessions/${sessionId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: targetMsg.id,
            role: 'assistant',
            content: combinedText,
            toolsUsed: targetMsg.toolsUsed,
            citations: targetMsg.citations,
            durationMs,
            model: responseModel,
          }),
        }).catch(() => null);
      }
    } catch (err: any) {
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === targetMsg.id
                    ? {
                        ...m,
                        content: combinedText,
                        streaming: false,
                        completed: false,
                        incompleteReason:
                          err?.name === 'AbortError'
                            ? 'ادامه تولید پاسخ توسط کاربر متوقف شد.'
                            : err?.message || 'خطا در ادامه تولید پاسخ؛ می‌توانید مجدداً تلاش کنید.',
                      }
                    : m
                ),
              }
            : s
        )
      );
    } finally {
      aiRuntimeCache.activeAbortController = null;
      aiRuntimeCache.activeStreamingSessionId = '';
      setIsLoading(false);
    }
  };

  const handleStopGeneration = () => {
    const targetSessionId = aiRuntimeCache.activeStreamingSessionId || activeSessionId;
    aiRuntimeCache.activeAbortController?.abort();
    void authFetch('/api/v1/ai/chat/abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: targetSessionId }),
    }).catch(() => null);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashAutocompleteOpen) {
      if (e.key === 'ArrowDown' && slashSearchResults.length > 0) {
        e.preventDefault();
        setSlashActiveIndex(prev => (prev + 1) % slashSearchResults.length);
        return;
      }
      if (e.key === 'ArrowUp' && slashSearchResults.length > 0) {
        e.preventDefault();
        setSlashActiveIndex(
          prev => (prev - 1 + slashSearchResults.length) % slashSearchResults.length
        );
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && slashSearchResults.length > 0) {
        e.preventDefault();
        const targetItem = slashSearchResults[slashActiveIndex] || slashSearchResults[0];
        if (targetItem) {
          handleSelectSlashModule(targetItem);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashModulePicker(false);
        setSlashDismissedForInput(inputMessage);
        return;
      }
    }

    if (e.key === 'Backspace' && !inputMessage && selectedModules.length > 0) {
      setSelectedModules(current => current.slice(0, -1));
      return;
    }

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
    if (!moduleSearchQuery.trim()) return moduleCatalog;
    return searchAndRankModules(moduleCatalog, moduleSearchQuery, {
      selectedModuleIds: selectedModules,
      includeAllCommand: false,
      onlyConnected: false,
    });
  }, [moduleCatalog, moduleSearchQuery, selectedModules]);

  const activeContextOption =
    CONTEXT_OPTIONS.find(c => c.value === selectedContext) || CONTEXT_OPTIONS[0];

  const isWaitingForFirstToken =
    isLoading &&
    (!activeSession?.messages.length ||
      activeSession.messages[activeSession.messages.length - 1]?.role === 'user' ||
      activeSession.messages[activeSession.messages.length - 1]?.content === '');

  return (
    <div
      className="relative flex flex-1 h-full max-h-full min-h-0 w-full bg-[#F8FAFC] dark:bg-slate-950 sm:rounded-3xl sm:border border-slate-200/80 dark:border-slate-800/80 sm:shadow-sm overflow-hidden select-text"
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
        className={`w-[82vw] max-w-[310px] md:w-72 lg:w-80 h-full min-h-0 overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800 flex flex-col transition-transform duration-300 z-50 ${
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

      {/* ── Main Chat Column (Fixed Header + Scrollable Messages + Fixed Bottom Composer) ── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 relative">
        {/* ۱. هدر ثابت و سبک (Fixed & Lightweight Header) */}
        <header className="shrink-0 h-14 sm:h-16 px-3 sm:px-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2 z-20">
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
                        : 'bg-amber-400'
                    }`}
                  />
                  <span className="truncate">
                    {installedModels.length > 0 && selectedModel
                      ? `مدل فعال: ${selectedModel}`
                      : 'مدل گفت‌وگو انتخاب نشده است'}
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
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4 sm:py-6 space-y-5 custom-scrollbar">
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
                        : msg.completed === false
                          ? 'bg-white dark:bg-slate-900 border border-amber-300/90 dark:border-amber-700/80 text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-sm'
                          : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content}
                      {!isUser && msg.streaming && (
                        <span
                          className="inline-block w-2 h-4 ms-1 align-middle bg-[#5B4BFF] animate-pulse rounded-xs"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Incomplete Warning & Seamless Continue Generation Button */}
                    {!isUser && msg.completed === false && !msg.streaming && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/80 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            {msg.incompleteReason ||
                              'پاسخ پیش از پایان کامل متوقف شد.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleContinueGeneration(msg)}
                          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-[#5B4BFF] hover:bg-[#4A3AE8] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>ادامه تولید پاسخ از محل توقف</span>
                        </button>
                      </div>
                    )}

                    {/* Timestamp, Status badge, Model tag & Copy action */}
                    <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{msg.timestamp}</span>
                        {!isUser && msg.model && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                            {msg.model}
                          </span>
                        )}
                        {!isUser && msg.streaming && (
                          <span className="px-1.5 py-0.5 rounded bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#ACA2FF] font-bold">
                            در حال تولید...
                          </span>
                        )}
                        {!isUser && !msg.streaming && msg.completed === false && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-bold">
                            ناتمام
                          </span>
                        )}
                        {!isUser && !msg.streaming && msg.completed === true && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold">
                            تکمیل‌شده
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

        {/* ۳. ناحیه ورودی پیام در پایین (Fixed Bottom Message Composer) */}
        <div className="shrink-0 z-20 px-3 sm:px-6 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#F8FAFC] via-[#F8FAFC]/95 to-transparent dark:from-slate-950 dark:via-slate-950/95">
          <div className="max-w-3xl mx-auto">
            {/* Smart Slash Command Autocomplete Dropdown ('/') */}
            {isSlashAutocompleteOpen && (
              <div
                dir="rtl"
                role="listbox"
                aria-label="فهرست هوشمند ماژول‌های سامانه"
                className="mb-2.5 rounded-2xl border border-[#5B4BFF]/35 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md p-2.5 sm:p-3 shadow-xl shadow-slate-900/10 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                {/* Autocomplete Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#ACA2FF] flex items-center justify-center text-xs font-black shrink-0">
                      /
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                        {parsedSlash.query
                          ? `جست‌وجوی هوشمند ماژول: «${parsedSlash.query}»`
                          : 'انتخاب هوشمند ماژول‌ها و زیرماژول‌های فعال سامانه'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {slashSearchResults.filter(item => !item.isAllCommand).length} مورد
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/70 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                      <span>↑↓ پیمایش</span>
                      <span>•</span>
                      <span>Enter انتخاب</span>
                      <span>•</span>
                      <span>Esc بستن</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSlashModulePicker(false);
                        setSlashDismissedForInput(inputMessage);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="بستن فهرست (Esc)"
                      aria-label="بستن فهرست"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Results List */}
                <div
                  ref={slashDropdownListRef}
                  className="max-h-64 overflow-y-auto custom-scrollbar space-y-1 pl-0.5"
                >
                  {slashSearchResults.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-2">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        ماژول یا زیرماژولی متناسب با عبارت «{parsedSlash.query}» یافت نشد.
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        می‌توانید نام فارسی، نام انگلیسی (مانند permit، fire، health) یا کلیدواژه مرتبط را وارد کنید.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setInputMessage('/');
                          setDebouncedSlashQuery('');
                          textareaRef.current?.focus();
                        }}
                        className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#ACA2FF] hover:bg-[#5B4BFF]/20 transition cursor-pointer"
                      >
                        نمایش تمام ماژول‌های مجاز (/)
                      </button>
                    </div>
                  ) : (
                    slashSearchResults.map((item, idx) => {
                      const isHighlighted = idx === slashActiveIndex;
                      const isSelected = Boolean(item.isSelected);
                      const isSubmodule = Boolean(item.subModuleNameFa);

                      return (
                        <button
                          key={item.moduleId}
                          type="button"
                          role="option"
                          aria-selected={isHighlighted}
                          data-slash-index={idx}
                          disabled={!item.connected && !item.isAllCommand}
                          onMouseEnter={() => setSlashActiveIndex(idx)}
                          onClick={() => handleSelectSlashModule(item)}
                          className={`w-full min-h-[52px] text-right px-3 py-2 rounded-xl transition flex items-center justify-between gap-2.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed border ${
                            item.isAllCommand
                              ? isHighlighted || isSelected
                                ? 'bg-[#5B4BFF]/15 border-[#5B4BFF] text-[#5B4BFF] dark:text-[#B8B0FF]'
                                : 'bg-[#5B4BFF]/5 border-[#5B4BFF]/25 text-[#5B4BFF] dark:text-[#ACA2FF] hover:bg-[#5B4BFF]/10'
                              : isHighlighted
                                ? 'bg-slate-100/90 dark:bg-slate-800/90 border-[#5B4BFF]/50 text-slate-900 dark:text-slate-100'
                                : isSelected
                                  ? 'bg-[#5B4BFF]/10 border-[#5B4BFF]/40 text-slate-900 dark:text-slate-100'
                                  : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {/* Right side: Icon + Module/Submodule Name + Access Path */}
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                item.isAllCommand || isSelected
                                  ? 'bg-[#5B4BFF] text-white shadow-sm shadow-[#5B4BFF]/25'
                                  : 'bg-slate-100 dark:bg-slate-800 text-[#5B4BFF] dark:text-[#ACA2FF]'
                              }`}
                            >
                              {renderModuleIcon(item.iconName, 'w-4 h-4')}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              {/* 1. Module Name & 2. Submodule Name (if applicable) */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                                  {item.isAllCommand
                                    ? '/ALL — تحلیل جامع تمام ماژول‌ها و زیرماژول‌های سامانه'
                                    : item.mainModuleNameFa || item.moduleNameFa}
                                </span>
                                {isSubmodule && !item.isAllCommand && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#5B4BFF]/10 text-[#5B4BFF] dark:bg-[#5B4BFF]/20 dark:text-[#B8B0FF]">
                                    <span>زیرماژول:</span>
                                    <span>{item.subModuleNameFa}</span>
                                  </span>
                                )}
                                {!item.isAllCommand && item.moduleNameEn && (
                                  <span
                                    dir="ltr"
                                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                  >
                                    /{item.moduleId}
                                  </span>
                                )}
                              </div>

                              {/* 4. Access Path (مسیر دسترسی ماژول) */}
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="truncate">
                                  مسیر دسترسی: {item.accessPath}
                                </span>
                                {item.routePath && !item.isAllCommand && (
                                  <span
                                    dir="ltr"
                                    className="text-[10px] font-mono text-slate-400 dark:text-slate-500"
                                  >
                                    ({item.routePath})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Left side: 5. Selection Status (وضعیت انتخاب) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg bg-[#5B4BFF] text-white">
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>انتخاب‌شده</span>
                              </span>
                            ) : item.connected ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                <span>{isHighlighted ? 'انتخاب (Enter)' : 'قابل انتخاب'}</span>
                                {isHighlighted && <CornerDownLeft className="w-3 h-3" />}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                                غیرفعال
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Main Rounded Input Card */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-900/5 focus-within:border-[#5B4BFF] focus-within:ring-2 focus-within:ring-[#5B4BFF]/20 transition-all p-2 sm:p-3">
              {/* Selected Module Scope Chips */}
              {selectedModules.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 mb-1 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">
                      ماژول‌های انتخاب‌شده برای تحلیل:
                    </span>
                    {selectedModules.map(id => {
                      const catalogItem = moduleCatalog.find(item => item.moduleId === id);
                      const chipLabel =
                        id === 'all'
                          ? 'همه ماژول‌ها (/ALL)'
                          : catalogItem
                            ? catalogItem.subModuleNameFa
                              ? `${catalogItem.mainModuleNameFa} ◂ ${catalogItem.subModuleNameFa}`
                              : catalogItem.moduleNameFa
                            : id;
                      const chipAccessPath =
                        id === 'all'
                          ? 'تمامی ماژول‌ها و زیرماژول‌های فعال سامانه'
                          : catalogItem?.accessPath || chipLabel;

                      return (
                        <span
                          key={id}
                          title={`مسیر دسترسی: ${chipAccessPath}`}
                          className="min-h-[28px] text-[11px] font-bold rounded-xl px-2.5 py-1 bg-[#5B4BFF]/10 text-[#5B4BFF] dark:bg-[#5B4BFF]/20 dark:text-[#ACA2FF] border border-[#5B4BFF]/25 flex items-center gap-1.5 transition"
                        >
                          {renderModuleIcon(
                            id === 'all' ? 'Sparkles' : catalogItem?.iconName,
                            'w-3.5 h-3.5 shrink-0'
                          )}
                          <span>{chipLabel}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedModules(current => current.filter(item => item !== id))
                            }
                            className="p-0.5 rounded-md hover:bg-[#5B4BFF]/20 text-[#5B4BFF] dark:text-[#ACA2FF] transition cursor-pointer"
                            title={`حذف ماژول ${chipLabel}`}
                            aria-label={`حذف ماژول ${chipLabel}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  {selectedModules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedModules([])}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-600 px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                    >
                      حذف همه ({selectedModules.length})
                    </button>
                  )}
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
                    const slashState = parseSlashQueryFromInput(value, e.target.selectionStart ?? value.length);
                    setShowSlashModulePicker(slashState.isActive);
                    if (slashDismissedForInput && slashDismissedForInput !== value) {
                      setSlashDismissedForInput(null);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={
                    selectedModules.length > 0
                      ? 'سوال تحلیلی خود را درباره ماژول انتخاب‌شده بنویسید یا مستقیم ارسال کنید (برای افزودن ماژول دیگر / بزنید)...'
                      : 'پیام خود را بنویسید یا برای جست‌وجوی هوشمند ماژول‌ها کاراکتر / را تایپ کنید...'
                  }
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
                      disabled={
                        (!inputMessage.trim() && selectedModules.length === 0) || sessionsLoading
                      }
                      className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-[#5B4BFF] hover:bg-[#4A3AE8] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white flex items-center justify-center shadow-md shadow-[#5B4BFF]/25 disabled:shadow-none transition-all active:scale-95 disabled:cursor-not-allowed cursor-pointer"
                      title="ارسال پیام"
                      aria-label="ارسال پیام"
                    >
                      <ArrowUp className="w-5 h-5 stroke-[2.5]" />
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
                    title="انتخاب موتور تحلیلی یا مدل هوش مصنوعی"
                  >
                    <Bot className="w-4 h-4 text-[#5B4BFF] shrink-0" />
                    <span className="max-w-[135px] sm:max-w-[210px] truncate">
                      {selectedModel === HSECORE_ANALYTICAL_ENGINE_ID
                        ? HSECORE_ANALYTICAL_ENGINE_SHORT_LABEL
                        : selectedModel || installedModels[0]?.name || HSECORE_ANALYTICAL_ENGINE_SHORT_LABEL}
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
                      {activeSheet === 'model' && 'انتخاب آگاهانه بین موتور تحلیلی سریع HSECORE و مدل‌های مستقل Ollama'}
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
                  <div className="space-y-4">
                    {/* Section A: Independent HSECORE Fast Analytical Engine (No LLM) */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-1">
                        موتور هوشمند مستقل سامانه (پاسخ آنی و بدون نیاز به LLM)
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedModel(HSECORE_ANALYTICAL_ENGINE_ID);
                          setActiveSheet('none');
                        }}
                        className={`w-full min-h-[60px] p-3.5 rounded-2xl border text-right flex items-center justify-between gap-3 transition cursor-pointer ${
                          selectedModel === HSECORE_ANALYTICAL_ENGINE_ID
                            ? 'bg-emerald-500/10 border-emerald-500 text-slate-900 dark:text-white'
                            : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedModel === HSECORE_ANALYTICAL_ENGINE_ID
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-emerald-600 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <Database className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-black truncate">
                              {HSECORE_ANALYTICAL_ENGINE_LABEL}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              پاسخ فوری زیر ۱۰۰ms • تحلیل ساختاریافته و قطعی داده‌های برخط بدون درگیر کردن Ollama
                            </p>
                          </div>
                        </div>
                        {selectedModel === HSECORE_ANALYTICAL_ENGINE_ID && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        )}
                      </button>
                    </div>

                    {/* Section B: Installed Ollama Generative LLM Models (Strictly Independent) */}
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 px-1">
                        مدل‌های هوش مصنوعی مولد (Ollama LLM — مستقل و بدون سوییچ خودکار)
                      </p>
                      {installedModels.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center space-y-2.5">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            هیچ مدل زبانی (LLM) در موتور Ollama نصب نشده است
                          </p>
                          <button
                            type="button"
                            onClick={handleNavigateToAiSettings}
                            className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#5B4BFF] hover:bg-[#4A3AE8] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                          >
                            <Settings className="w-4 h-4" />
                            <span>نصب مدل هوش مصنوعی از مدیریت AI</span>
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

                          <div className="pt-1">
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
                    </div>
                  </div>
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
