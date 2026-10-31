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
  ShieldAlert,
  AlertTriangle,
  Sliders,
  Activity,
  Heart,
  Leaf,
  CheckSquare,
  BookOpen,
  BarChart2,
  HelpCircle,
  Clock,
  Cpu,
  Database,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Zap,
  Info
} from 'lucide-react';
import { UserProfile } from '../../types';

export interface AIAssistant {
  id: string;
  name: string;
  nameFa: string;
  title: string;
  description: string;
  associatedModule: string;
  tools: string[];
  icon: any;
  color: string;
  bgLight: string;
  promptSuggestions: string[];
}

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
  assistantId: string;
  createdAt: string;
  messages: ChatMessage[];
}

const ASSISTANTS: AIAssistant[] = [
  {
    id: 'PTW_SHERPA',
    name: 'PTW & SHERPA',
    nameFa: 'پروانه‌های کار و ایمنی فرآیند',
    title: 'متخصص صدور پروانه‌های کار گرم، سرد، فضای بسته و SHERPA',
    description: 'تحلیل همزمانی پروانه‌های کار (Clash)، کنترل تدابیر ایمنی و پیشگیری از خطای انسانی.',
    associatedModule: 'ptw',
    tools: ['ptw_summary'],
    icon: ShieldAlert,
    color: 'text-amber-600 dark:text-amber-400',
    bgLight: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    promptSuggestions: [
      'وضعیت پروانه‌های کار فعال در کارگاه را گزارش کن.',
      'آیا تداخلی بین کارهای گرم و فضای بسته امروز وجود دارد؟',
      'الزامات ایمنی ورود به مخازن هیدروکربوری بر اساس OSHA چیست؟',
    ],
  },
  {
    id: 'INCIDENT_ANALYSIS',
    name: 'Incident RCA & CAPA',
    nameFa: 'تحلیل حوادث و اقدامات اصلاحی',
    title: 'متخصص ریشه‌یابی رویدادها (RCA)، شبه‌حوادث و تدوین CAPA',
    description: 'تجزیه و تحلیل حوادث شغلی با متد ۵ چرا، اقدامات اصلاحی و درس‌آموزی از حوادث.',
    associatedModule: 'incidents',
    tools: ['incidents_summary'],
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bgLight: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    promptSuggestions: [
      'خلاصه حوادث و شبه‌حوادث ثبت‌شده در ماه اخیر چیست؟',
      'برای حادثه سقوط از ارتفاع، یک تحلیل علت ریشه‌ای ۵ چرا پیشنهاد بده.',
      'چند روز کاری به دلیل حوادث شغلی از دست رفته است؟',
    ],
  },
  {
    id: 'RISK_ASSESSMENT',
    name: 'Risk & Hazard Assessment',
    nameFa: 'ارزیابی ریسک و مخاطرات شغلی',
    title: 'متخصص شناسایی خطرات (HAZID)، ارزیابی ریسک و JSA',
    description: 'محاسبه سطوح ریسک در ماتریس ۵×۵ و اعمال سلسله‌مراتب تدابیر کنترلی.',
    associatedModule: 'risks',
    tools: ['risk_assessment_summary'],
    icon: Sliders,
    color: 'text-orange-600 dark:text-orange-400',
    bgLight: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    promptSuggestions: [
      'چند مورد ریسک در وضعیت بحرانی و بالا در سامانه ثبت شده است؟',
      'یک کاربرگ JSA برای عملیات جوشکاری در فضای محصور تدوین کن.',
      'اقدامات کنترلی برتر برای مهار خطرات ناشی از گاز H2S چیست؟',
    ],
  },
  {
    id: 'OCCUPATIONAL_HEALTH',
    name: 'Occupational Health',
    nameFa: 'سلامت شغلی و طب کار',
    title: 'متخصص بهداشت حرفه‌ای، معاینات ادواری و بیماری‌های شغلی',
    description: 'تحلیل صلاحیت و تناسب شغلی (Fit/Unfit)، آلاینده‌های زیان‌آور و پرونده سلامت.',
    associatedModule: 'health',
    tools: ['health_medical_summary'],
    icon: Activity,
    color: 'text-teal-600 dark:text-teal-400',
    bgLight: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800',
    promptSuggestions: [
      'آمار تناسب شغلی (Fit, Conditional, Unfit) در آخرین معاینات چگونه است؟',
      'پروتکل مراقبت در مواجهه با سر و صدای بالاتر از ۸۵ دسی‌بل چیست؟',
      'شاخص‌های ارزیابی اسپیرومتری در محیط‌های دارای گرد و غبار سیلیس را توضیح بده.',
    ],
  },
  {
    id: 'NUTRITION_LIFESTYLE',
    name: 'Nutrition & Chronic Conditions',
    nameFa: 'کارشناس تغذیه و بیماران پرخطر',
    title: 'متخصص ارزیابی BMI، چاقی، فشار خون، دیابت و رژیم‌درمانی سازمانی',
    description: 'شناسایی و پایش هوشمند کارکنان دارای اضافه‌وزن، چاقی درجات ۱ تا ۳، فشار و قند خون بالا.',
    associatedModule: 'nutrition',
    tools: ['nutrition_high_risk_summary', 'health_medical_summary'],
    icon: Heart,
    color: 'text-rose-600 dark:text-rose-400',
    bgLight: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
    promptSuggestions: [
      'آمار پرسنل دارای اضافه‌وزن و چاقی درجات مختلف در سامانه چیست؟',
      'چه تعداد از کارکنان دارای فشار خون و قند خون غیرطبیعی شناسایی شده‌اند؟',
      'یک رژیم غذایی سالم برای پرسنل شیفت شب در واحدهای صنعتی پیشنهاد بده.',
    ],
  },
  {
    id: 'ENVIRONMENT_WASTE',
    name: 'Environmental Management',
    nameFa: 'مدیریت و پایش محیط زیست',
    title: 'متخصص پایش پساب، هوا، پسماندهای ویژه و استانداردهای ISO 14001',
    description: 'کنترل آلاینده‌های محیط زیست، تفکیک پسماند و تطابق با الزامات سازمان محیط زیست.',
    associatedModule: 'environment',
    tools: [],
    icon: Leaf,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    promptSuggestions: [
      'حدود مجاز آلاینده‌های پساب صنعتی بر اساس ضوابط سازمان حفاظت محیط زیست چیست؟',
      'روش‌های اصولی نگهداری و امحای لجن‌های هیدروکربوری کدامند؟',
      'الزامات ممیزی سیستم مدیریت زیست‌محیطی ISO 14001:2015 را مرور کن.',
    ],
  },
  {
    id: 'INSPECTION_5S',
    name: '5S & Workplace Inspection',
    nameFa: 'نظام آراستگی ۵S و بازرسی‌ها',
    title: 'متخصص ممیزی نظام آراستگی، چک‌لیست‌های دوره‌ای و عدم انطباق‌ها',
    description: 'پایش اصول ساماندهی، نظم، پاکیزگی و ردیابی عدم انطباق‌های کارگاهی.',
    associatedModule: '5s',
    tools: ['five_s_inspections_summary'],
    icon: CheckSquare,
    color: 'text-blue-600 dark:text-blue-400',
    bgLight: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    promptSuggestions: [
      'چند ممیزی ۵S و بازرسی ایمنی در سامانه ثبت شده است؟',
      'چک‌لیست ممیزی ۵S برای انبار قطعات یدکی پتروشیمی را ارائه کن.',
      'روش استاندارد برچسب‌گذاری قرمز (Red Tag) در تفکیک اقلام غیرضروری چیست؟',
    ],
  },
  {
    id: 'TRAINING_COMPLIANCE',
    name: 'Training & Competency',
    nameFa: 'آموزش‌های ایمنی و شایستگی',
    title: 'متخصص ماتریس صلاحیت HSE، دوره‌های ایمنی و اثربخشی آموزش',
    description: 'تحلیل نیازسنجی آموزشی، سرانه ساعات آموزش و دوره‌های الزام‌آور قانونی.',
    associatedModule: 'training',
    tools: [],
    icon: BookOpen,
    color: 'text-purple-600 dark:text-purple-400',
    bgLight: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
    promptSuggestions: [
      'دوره‌های آموزشی بدو استخدام الزامی برای کارگران فنی چیست؟',
      'مدل کرک‌پاتریک برای ارزیابی اثربخشی دوره‌های HSE را تشریح کن.',
      'سرانه استاندارد ساعات آموزش سالیانه HSE در صنایع پرخطر چقدر است؟',
    ],
  },
  {
    id: 'MANAGEMENT_ANALYTICS',
    name: 'Executive Analytics',
    nameFa: 'داشبورد هوشمند مدیریت و KPI',
    title: 'متخصص تحلیل عملکرد کلان، شاخص‌های TRIR و گزارش‌های مدیریتی',
    description: 'تحلیل شاخص‌های ضریب تکرار حادثه، ساعات کارکرد و ارائه راهکارهای استراتژیک.',
    associatedModule: 'dashboard',
    tools: ['kpi_management_summary', 'incidents_summary', 'ptw_summary'],
    icon: BarChart2,
    color: 'text-sky-600 dark:text-sky-400',
    bgLight: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
    promptSuggestions: [
      'وضعیت کلی شاخص‌های کلیدی عملکرد HSE سازمان را تحلیل کن.',
      'آخرین نرخ TRIR و ساعات کارکرد ثبت‌شده را گزارش کن.',
      'مهم‌ترین نقاط آسیب‌پذیر ایمنی سازمان در حال حاضر کجاست؟',
    ],
  },
  {
    id: 'GENERAL_HSE',
    name: 'General HSE Consultant',
    nameFa: 'مشاور جامع HSE و مراجع قانونی',
    title: 'دستیار عمومی و پاسخگوی کلیه سوالات ایمنی، بهداشت و محیط زیست',
    description: 'پاسخگویی علمی به استانداردهای ملی وزارت کار، بهداشت و مراجع بین‌المللی.',
    associatedModule: 'all',
    tools: [],
    icon: HelpCircle,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800',
    promptSuggestions: [
      'وظایف قانونی مسئول ایمنی کارگاه طبق آیین‌نامه حفاظت فنی وزارت کار چیست؟',
      'روش صحیح انتخاب تجهیزات حفاظت فردی برای کار با مواد شیمیایی خورنده چیست؟',
      'استاندارد روشنایی محیط کار در واحدهای اداری و کارگاهی چقدر است؟',
    ],
  },
];

interface AiAssistantAppProps {
  currentUser?: UserProfile | null;
  language?: 'fa' | 'en';
}

export default function AiAssistantApp({ currentUser, language = 'fa' }: AiAssistantAppProps) {
  const isFa = language === 'fa';
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('GENERAL_HSE');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allowTools, setAllowTools] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
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
        title: 'گفتگوی عمومی HSE',
        assistantId: 'GENERAL_HSE',
        createdAt: new Date().toISOString(),
        messages: [],
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || 'session-default';
  });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const activeAssistant = ASSISTANTS.find(a => a.id === selectedAssistantId) || ASSISTANTS[0];

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem('hsecore_ai_sessions', JSON.stringify(sessions));
    } catch {}
  }, [sessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);

  const handleSelectAssistant = (assistantId: string) => {
    setSelectedAssistantId(assistantId);
  };

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: `گفتگو با ${activeAssistant.nameFa}`,
      assistantId: selectedAssistantId,
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
          title: 'گفتگوی جدید',
          assistantId: selectedAssistantId,
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

    // Update active session with user message
    const updatedMessages = [...(activeSession?.messages || []), userMsg];
    let sessionTitle = activeSession.title;
    if (activeSession.messages.length === 0) {
      sessionTitle = text.slice(0, 30);
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

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          assistantId: selectedAssistantId,
          history: historyPayload,
          allowTools,
        }),
      });

      const data = await res.json();

      if (data.success) {
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
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: data.message || 'پاسخی از موتور هوش مصنوعی دریافت نشد.',
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        };
        setSessions(prev =>
          prev.map(s =>
            s.id === activeSession.id ? { ...s, messages: [...updatedMessages, errorMsg] } : s
          )
        );
      }
    } catch (err: any) {
      const networkErrorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'خطا در ارتباط با سرور هوش مصنوعی سامانه. لطفاً وضعیت سرویس local ai را بررسی فرمایید.',
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

  const ActiveIcon = activeAssistant.icon;

  return (
    <div className="flex h-[calc(100vh-140px)] min-h-[550px] bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" dir="rtl">
      {/* ─── SIDEBAR: Chat Sessions & Assistants ─── */}
      <aside className={`w-80 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-20 ${sidebarOpen ? 'fixed inset-y-0 start-0 z-50 md:static' : 'hidden md:flex'}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">هوش مصنوعی HSE</h2>
              <p className="text-[10px] text-slate-400">موتور آفلاین Local LLM</p>
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

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="text-[11px] font-bold text-slate-400 px-2 py-1">تاریخچه گفتگوها</div>
          {sessions.map(s => {
            const isSelected = s.id === activeSession.id;
            return (
              <div
                key={s.id}
                onClick={() => {
                  setActiveSessionId(s.id);
                  setSelectedAssistantId(s.assistantId);
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

        {/* Local Engine Status Mini Card */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              موتور محلی: Qwen 2.5 (1.7B)
            </span>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-mono">
              CPU Safe
            </span>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CHAT AREA ─── */}
      <main className="flex-1 flex flex-col bg-white dark:bg-slate-900 min-w-0">
        {/* Assistant Carousel / Bar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {ASSISTANTS.map(ast => {
              const IconComp = ast.icon;
              const isSelected = ast.id === selectedAssistantId;
              return (
                <button
                  key={ast.id}
                  onClick={() => handleSelectAssistant(ast.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : ast.color}`} />
                  <span>{ast.nameFa}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Assistant Header Info */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-2xl border ${activeAssistant.bgLight}`}>
              <ActiveIcon className={`w-5 h-5 ${activeAssistant.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{activeAssistant.nameFa}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {activeAssistant.title}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{activeAssistant.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllowTools(!allowTools)}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                allowTools
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title="اتصال خودکار به داده‌های زنده ماژول‌ها جهت پاسخ مستند"
            >
              <Database className="w-3.5 h-3.5" />
              <span>استخراج داده‌های زنده: {allowTools ? 'فعال' : 'غیرفعال'}</span>
            </button>
          </div>
        </div>

        {/* Messages Stream Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {activeSession.messages.length === 0 ? (
            /* Welcome / Empty State with Suggestions */
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                <ActiveIcon className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  گفتگو با {activeAssistant.nameFa}
                </h4>
                <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                  {activeAssistant.description} آماده پاسخ‌گویی به استناد آمار زنده سیستم و استانداردهای OSHA، ISO و مقررات ملی.
                </p>
              </div>

              {/* Suggestions Chips */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-400">پرسش‌های پیشنهادی برای شروع:</div>
                <div className="flex flex-col gap-2 max-w-xl mx-auto">
                  {activeAssistant.promptSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sug)}
                      className="text-right p-3 bg-slate-50 hover:bg-indigo-50 dark:bg-slate-800/40 dark:hover:bg-indigo-950/30 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer flex items-center justify-between group"
                    >
                      <span>{sug}</span>
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
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
                    {isUser ? 'شما' : <Bot className="w-4 h-4" />}
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
                          منابع داده:
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
                          اسناد مرجع:
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
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl rounded-tl-xs p-4 flex items-center gap-2 text-xs text-slate-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>دستیار در حال استخراج داده‌های زنده و استنتاج پاسخ می‌باشد...</span>
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
              placeholder={`پرسش خود را از ${activeAssistant.nameFa} بپرسید... (Shift+Enter برای خط جدید)`}
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
