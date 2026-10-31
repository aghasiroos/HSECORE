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
  Scale,
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

const COMPREHENSIVE_LEGAL_ASSISTANT = {
  id: 'GENERAL_HSE',
  nameFa: 'مشاور جامع HSE و مراجع قانونی',
  title: 'مرجع تخصصی قوانین کار، آیین‌نامه‌های شورای عالی حفاظت فنی، وزارت بهداشت و پایش یکپارچه ماژول‌ها',
  description:
    'پاسخگویی مستند به فصل چهارم قانون کار، آیین‌نامه‌های حفاظت فنی، حدود مجاز مواجهه شغلی (OEL)، استانداردهای ISO 45001 / ISO 14001 / OSHA و استخراج برخط داده‌های تمامی ماژول‌های سامانه HSECORE.',
  promptSuggestions: [
    'از ماژول شاخص استرس گرمایی دمای هوا، رطوبت و شاخص WBGT فعلی را به همراه الزامات قانونی گزارش کن.',
    'وظایف قانونی کارفرما و مسئول ایمنی طبق فصل چهارم قانون کار و آیین‌نامه شورای عالی حفاظت فنی چیست؟',
    'وضعیت پروانه‌های کار فعال، حوادث ثبت‌شده و اخطارهای ایمنی در سامانه چگونه است؟',
    'الزامات قانونی معاینات ادواری طب کار (ماده ۹۲ قانون کار) و آمار تناسب شغلی پرسنل در سامانه چیست؟',
  ],
};

interface AiAssistantAppProps {
  currentUser?: UserProfile | null;
  language?: 'fa' | 'en';
}

export default function AiAssistantApp({ language = 'fa' }: AiAssistantAppProps) {
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allowTools, setAllowTools] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Sessions state stored in localStorage
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('hsecore_ai_sessions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'session-default',
        title: 'مشاوره جامع HSE و مراجع قانونی',
        createdAt: new Date().toISOString(),
        messages: [],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || 'session-default';
  });

  const [searchSessionQuery, setSearchSessionQuery] = useState<string>('');

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleExportSession = () => {
    if (!activeSession || activeSession.messages.length === 0) return;
    let report = `گزارش استنتاج هوش مصنوعی HSECORE AI\n`;
    report += `عنوان گفتگو: ${activeSession.title}\n`;
    report += `مرجع پاسخگویی: ${COMPREHENSIVE_LEGAL_ASSISTANT.nameFa} (${COMPREHENSIVE_LEGAL_ASSISTANT.title})\n`;
    report += `تاریخ ثبت گزارش: ${new Date().toLocaleDateString('fa-IR')} ${new Date().toLocaleTimeString('fa-IR')}\n`;
    report += `========================================================\n\n`;

    activeSession.messages.forEach((m, idx) => {
      const sender = m.role === 'user' ? 'کاربر' : COMPREHENSIVE_LEGAL_ASSISTANT.nameFa;
      report += `[${idx + 1}] ${sender} - ${m.timestamp}\n`;
      if (m.toolsUsed && m.toolsUsed.length > 0) {
        report += `منابع داده سامانه‌ای: ${m.toolsUsed.join('، ')}\n`;
      }
      if (m.citations && m.citations.length > 0) {
        report += `مراجع قانونی و اسناد مرجع: ${m.citations.join('، ')}\n`;
      }
      report += `${m.content}\n\n--------------------------------------------------------\n\n`;
    });

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `HSECORE_AI_Legal_Report_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    try {
      localStorage.setItem('hsecore_ai_sessions', JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'مشاوره جدید HSE و مراجع قانونی',
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      setSessions([
        {
          id: `session-${Date.now()}`,
          title: 'مشاوره جامع HSE و مراجع قانونی',
          createdAt: new Date().toISOString(),
          messages: [],
        },
      ]);
      return;
    }
    const filtered = sessions.filter(s => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setInputMessage('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...(activeSession?.messages || []), userMsg];
    let sessionTitle = activeSession.title;
    if (activeSession.messages.length === 0) {
      sessionTitle = text.slice(0, 35);
    }

    setSessions(prev =>
      prev.map(s => (s.id === activeSession.id ? { ...s, title: sessionTitle, messages: updatedMessages } : s))
    );

    setIsLoading(true);

    try {
      const historyPayload = updatedMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await authFetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          assistantId: 'GENERAL_HSE',
          history: historyPayload,
          allowTools,
        }),
      });

      const data = await res.json();

      if (data.success && data.reply) {
        const assistantMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          toolsUsed: data.toolsUsed,
          citations: data.citations,
          durationMs: data.durationMs,
          model: data.model,
        };

        setSessions(prev =>
          prev.map(s =>
            s.id === activeSession.id ? { ...s, messages: [...updatedMessages, assistantMsg] } : s
          )
        );
      } else {
        const errText =
          data?.message ||
          data?.error?.message ||
          (typeof data?.error === 'string' ? data.error : null) ||
          'پاسخی از موتور هوش مصنوعی دریافت نشد.';
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: errText,
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        };
        setSessions(prev =>
          prev.map(s =>
            s.id === activeSession.id ? { ...s, messages: [...updatedMessages, errorMsg] } : s
          )
        );
      }
    } catch {
      const networkErrorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'خطا در ارتباط با سرور هوش مصنوعی سامانه. لطفاً اتصال شبکه را بررسی فرمایید.',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };
      setSessions(prev =>
        prev.map(s =>
          s.id === activeSession.id ? { ...s, messages: [...updatedMessages, networkErrorMsg] } : s
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[550px] bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" dir="rtl">
      {/* ─── SIDEBAR: Chat Sessions ─── */}
      <aside className={`w-80 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-20 ${sidebarOpen ? 'fixed inset-y-0 start-0 z-50 md:static' : 'hidden md:flex'}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">هوش مصنوعی HSECORE</h2>
              <p className="text-[10px] text-slate-400">مشاور جامع HSE و مراجع قانونی</p>
            </div>
          </div>
          <button
            onClick={handleNewSession}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition cursor-pointer"
            title="گفتگوی جدید"
          >
            <Plus className="w-4 h-4" />
            <span>جدید</span>
          </button>
        </div>

        {/* Sessions Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchSessionQuery}
              onChange={e => setSearchSessionQuery(e.target.value)}
              placeholder="جستجو در گفتگوها..."
              className="w-full ps-8 pe-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="text-[11px] font-bold text-slate-400 px-2 py-1">تاریخچه گفتگوها</div>
          {sessions
            .filter(s => !searchSessionQuery || s.title.toLowerCase().includes(searchSessionQuery.toLowerCase()))
            .map(s => {
              const isSelected = s.id === activeSession.id;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setActiveSessionId(s.id);
                    setSidebarOpen(false);
                  }}
                  className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1">
                    <MessageSquare className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <button
                    onClick={e => handleDeleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded-md transition"
                    title="حذف گفتگو"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
        </div>

        {/* Legal & RAG Status Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              موتور استنتاج قوانین و ماژول‌ها
            </span>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-mono">
              RAG + DB
            </span>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CHAT AREA ─── */}
      <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-w-0">
        {/* Comprehensive Legal Consultant Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl border bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
              <Scale className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {COMPREHENSIVE_LEGAL_ASSISTANT.nameFa}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                  {COMPREHENSIVE_LEGAL_ASSISTANT.title}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {COMPREHENSIVE_LEGAL_ASSISTANT.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSession.messages.length > 0 && (
              <button
                onClick={handleExportSession}
                className="px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer border border-slate-200 dark:border-slate-700"
                title="دریافت فایل متنی گزارش گفتگو"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دریافت گزارش</span>
              </button>
            )}
            <button
              onClick={() => setAllowTools(!allowTools)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                allowTools
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title="اتصال خودکار به داده‌های زنده تمامی ماژول‌های سامانه جهت پاسخ مستند"
            >
              <Database className="w-3.5 h-3.5" />
              <span>جستجو در تمام ماژول‌ها: {allowTools ? 'فعال' : 'غیرفعال'}</span>
            </button>
          </div>
        </div>

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {activeSession.messages.length === 0 ? (
            /* Welcome / Empty State with Legal & System Suggestions */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                <Scale className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  {COMPREHENSIVE_LEGAL_ASSISTANT.nameFa}
                </h4>
                <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                  {COMPREHENSIVE_LEGAL_ASSISTANT.description}
                </p>
              </div>

              {/* Suggestions Chips */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-400">پرسش‌های پیشنهادی (قوانین و داده‌های زنده ماژول‌ها):</div>
                <div className="flex flex-col gap-2 max-w-xl mx-auto">
                  {COMPREHENSIVE_LEGAL_ASSISTANT.promptSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sug)}
                      className="text-right p-3 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/40 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center justify-between group"
                    >
                      <span>{sug}</span>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition shrink-0 ms-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Messages List */
            activeSession.messages.map(msg => {
              const isUser = msg.role === 'user';
              return (
                <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-start flex-row-reverse' : 'justify-start'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xs ${
                    isUser
                      ? 'bg-slate-800 dark:bg-slate-700'
                      : 'bg-indigo-600'
                  }`}>
                    {isUser ? 'شما' : <Scale className="w-4 h-4" />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`max-w-[85%] sm:max-w-2xl rounded-2xl p-4 text-xs leading-relaxed space-y-2.5 ${
                    isUser
                      ? 'bg-slate-800 text-white dark:bg-slate-800 dark:text-slate-100 rounded-tr-xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-xs shadow-2xs'
                  }`}>
                    <div className="whitespace-pre-wrap font-medium">{msg.content}</div>

                    {/* Citations & Tools Badges for Assistant */}
                    {!isUser && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Database className="w-3 h-3 text-indigo-500" />
                          منابع داده ماژول‌ها:
                        </span>
                        {msg.toolsUsed.map((tool, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}

                    {!isUser && msg.citations && msg.citations.length > 0 && (
                      <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-emerald-500" />
                          مراجع قانونی و اسناد:
                        </span>
                        {msg.citations.map((c, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        <span>{msg.timestamp}</span>
                        {msg.durationMs && (
                          <span className="font-mono">({msg.durationMs}ms)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="hover:text-indigo-500 p-1 rounded-md transition cursor-pointer"
                          title="کپی پیام"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-xs">
                <Scale className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl rounded-tl-xs p-4 flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>در حال بررسی مراجع قانونی و استخراج داده‌های زنده ماژول‌ها...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Box */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition">
            <textarea
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`پرسش خود را از ${COMPREHENSIVE_LEGAL_ASSISTANT.nameFa} بپرسید... (Shift+Enter برای خط جدید)`}
              rows={2}
              maxLength={3500}
              className="flex-1 bg-transparent border-0 outline-hidden resize-none text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 p-1 font-medium"
            />
            <div className="flex items-center gap-1.5 pb-1">
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                {inputMessage.length}/3500
              </span>
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-sm transition cursor-pointer shrink-0"
                title="ارسال پیام"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
