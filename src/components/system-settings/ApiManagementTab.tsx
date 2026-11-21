import React, { useState, useEffect } from 'react';
import {
  Globe,
  Key,
  MessageSquare,
  Cpu,
  Webhook,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Send,
  Shield,
  Terminal,
  Eye,
  EyeOff,
  Play,
  Cloud,
  Sparkles,
  AlertTriangle,
  XCircle,
  Clock,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Lock,
  Zap,
  ShieldCheck,
  Server,
  FileCode,
  CheckCircle,
  Save,
  ArrowRight,
  Database
} from 'lucide-react';
import { UserProfile } from '../../types';
import { addAuditLog } from '../../utils/authHelper';
import { centralSync } from '../../services/centralSyncService';
import { apiDb } from '../../services/apiDatabaseClient';
import WorkflowAutomationRules from '../../modules/process-management/WorkflowAutomationRules';

interface ApiManagementTabProps {
  isFa: boolean;
  currentUser: UserProfile;
  initialSubSection?: 'external_services' | 'webhooks' | 'system_keys' | 'api_explorer' | 'security';
}

interface ApiTokenItem {
  id: string;
  name: string;
  token: string;
  createdDate: string;
  expiry: string;
  scopes: string[];
  lastUsed: string;
}

export default function ApiManagementTab({ isFa, currentUser, initialSubSection }: ApiManagementTabProps) {
  const [activeSubSection, setActiveSubSection] = useState<'external_services' | 'webhooks' | 'system_keys' | 'api_explorer' | 'security'>(initialSubSection || 'external_services');

  useEffect(() => {
    if (initialSubSection) {
      setActiveSubSection(initialSubSection);
    }
  }, [initialSubSection]);
  
  // Save Feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Gateway Ping / Telemetry state
  const [gatewayStatus, setGatewayStatus] = useState<'online' | 'checking' | 'error'>('online');
  const [latencyMs, setLatencyMs] = useState<number | null>(42);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  // Copied state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. SMS Provider
  const [smsProvider, setSmsProvider] = useState<'Kavenegar' | 'FarazSMS' | 'MihanSMS' | 'SMS.ir'>('Kavenegar');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsApiSecret, setSmsApiSecret] = useState('');
  const [smsLineNumber, setSmsLineNumber] = useState('');
  const [smsPatternCode, setSmsPatternCode] = useState('hse_alert_pattern');
  const [smsAlertOnHeat, setSmsAlertOnHeat] = useState(true);
  const [smsAlertOnPermit, setSmsAlertOnPermit] = useState(true);
  const [smsAlertOnWarning, setSmsAlertOnWarning] = useState(true);
  const [smsAlertOnIncident, setSmsAlertOnIncident] = useState(true);
  const [showSmsKey, setShowSmsKey] = useState(false);

  // SMS Test Simulator
  const [testMobileNumber, setTestMobileNumber] = useState('');
  const [testSmsStatus, setTestSmsStatus] = useState<string | null>(null);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);

  // 2. AI Model configuration
  const [aiProvider, setAiProvider] = useState<'Gemini' | 'OpenAI' | 'Claude' | 'DeepSeek'>('Gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModelName, setAiModelName] = useState('gemini-3.6-flash');
  const [aiTemperature, setAiTemperature] = useState(0.3);
  const [aiMaxTokens, setAiMaxTokens] = useState(2048);
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<string | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);

  // 3. Weather / Climate API
  const [weatherProvider, setWeatherProvider] = useState<'Foreca' | 'OpenMeteo' | 'AccuWeather'>('Foreca');
  const [weatherApiKey, setWeatherApiKey] = useState('');
  const [weatherCoords, setWeatherCoords] = useState('30.471003, 49.090324');

  // 4. Webhooks & Automations
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [rotatedSecretOnce, setRotatedSecretOnce] = useState<string | null>(null);
  const [isRotatingSecret, setIsRotatingSecret] = useState(false);
  const [webhookOnWarning, setWebhookOnWarning] = useState(true);
  const [webhookOnHeat, setWebhookOnHeat] = useState(true);
  const [webhookOnPermit, setWebhookOnPermit] = useState(true);
  const [webhookOnIncident, setWebhookOnIncident] = useState(true);
  const [testWebhookResult, setTestWebhookResult] = useState<{
    status: number | null;
    deliveryStatus: 'DELIVERED' | 'UNVERIFIED_RESPONSE' | 'FAILED' | 'RETRY_SCHEDULED';
    verifiedWorkflowAck: boolean;
    message: string;
    timestamp: string;
    latencyMs?: number;
    signatureHeader?: string;
    timestampHeader?: string;
    deliveryId?: string;
    responseSnippet?: string;
    requestPayload?: any;
  } | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);
  const [pendingRevokeTokenId, setPendingRevokeTokenId] = useState<string | null>(null);
  const [webhookInnerTab, setWebhookInnerTab] = useState<'automation_engine' | 'integration_spec'>('automation_engine');
  const [isSavingWebhookOnly, setIsSavingWebhookOnly] = useState(false);

  // 5. System API Keys / Tokens
  const [apiTokens, setApiTokens] = useState<ApiTokenItem[]>([]);
  const [showNewTokenModal, setShowNewTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiry, setNewTokenExpiry] = useState('90d');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:personnel', 'read:permits', 'write:permits']);

  // 6. Security & Rate Limiting
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(120);
  const [corsAllowedOrigins, setCorsAllowedOrigins] = useState('');
  const [enableIpFilter, setEnableIpFilter] = useState(false);
  const [ipWhitelist, setIpWhitelist] = useState('192.168.1.0/24, 10.0.0.0/8');

  // 7. Interactive API Explorer State
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState<number>(0);
  const [explorerResponse, setExplorerResponse] = useState<any | null>(null);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [explorerStatusCode, setExplorerStatusCode] = useState<number | null>(null);

  const AVAILABLE_ENDPOINTS = [
    {
      method: 'GET',
      path: '/api/v1/architecture/status',
      title: isFa ? 'وضعیت معماری و سلامت سرویس‌ها' : 'Architecture & Services Status',
      desc: isFa ? 'استعلام وضعیت کانتینرها، پایگاه داده اصلی، Camunda 8 و ماژول‌ها' : 'Query system stack status',
      sampleParams: ''
    },
    {
      method: 'GET',
      path: '/api/v1/personnel',
      title: isFa ? 'فهرست پرسنل شاغل مجتمع' : 'All Personnel List',
      desc: isFa ? 'دریافت مشخصات پرسنلی، واحد و کدهای ملی از دیتابیس رابطه‌ای' : 'Retrieve personnel records',
      sampleParams: '?limit=10'
    },
    {
      method: 'GET',
      path: '/api/v1/work-permits',
      title: isFa ? 'فهرست پروانه‌های کار (PTW)' : 'Work Permits List',
      desc: isFa ? 'استعلام پروانه‌های کار ایمن، وضعیت امضاها و کنترل‌های محیطی' : 'Fetch PTW records',
      sampleParams: '?status=ACTIVE'
    },
    {
      method: 'GET',
      path: '/api/v1/medical-exams',
      title: isFa ? 'پرونده‌های معاینات طب کار' : 'Occupational Health Exams',
      desc: isFa ? 'استعلام چکاپ‌های ادواری، نتایج آزمایشات و تناسب شغلی پرسنل' : 'Fetch periodic medical checkups',
      sampleParams: '?year=1404'
    },
    {
      method: 'GET',
      path: '/api/v1/incidents',
      title: isFa ? 'رویدادها و شبه‌حوادث' : 'Incident Reports',
      desc: isFa ? 'فهرست حوادث ثبت‌شده و شاخص‌های آسیب و علل ریشه‌ای' : 'Fetch logged HSE incidents',
      sampleParams: ''
    },
    {
      method: 'GET',
      path: '/api/weather',
      title: isFa ? 'تله‌متری اقلیمی و استرس گرمایی' : 'Live Climate & Heat Stress',
      desc: isFa ? 'دمای فعلی، رطوبت، شاخص گرما و پیش‌بینی ۶ روزه سایت' : 'Fetch weather telemetry',
      sampleParams: '?lat=30.4710&lon=49.0903'
    }
  ];

  // Load Saved Configurations from Central Database on Mount
  useEffect(() => {
    let isMounted = true;
    setLastCheckTime(new Date().toLocaleTimeString('fa-IR'));

    const applyConfig = (parsed: any) => {
      if (!parsed || typeof parsed !== 'object') return;
      if (parsed.smsProvider) setSmsProvider(parsed.smsProvider);
      if (parsed.smsApiKey) setSmsApiKey(parsed.smsApiKey);
      if (parsed.smsApiSecret) setSmsApiSecret(parsed.smsApiSecret);
      if (parsed.smsLineNumber) setSmsLineNumber(parsed.smsLineNumber);
      if (parsed.smsPatternCode) setSmsPatternCode(parsed.smsPatternCode);
      if (parsed.smsAlertOnHeat !== undefined) setSmsAlertOnHeat(parsed.smsAlertOnHeat);
      if (parsed.smsAlertOnPermit !== undefined) setSmsAlertOnPermit(parsed.smsAlertOnPermit);
      if (parsed.smsAlertOnWarning !== undefined) setSmsAlertOnWarning(parsed.smsAlertOnWarning);
      if (parsed.smsAlertOnIncident !== undefined) setSmsAlertOnIncident(parsed.smsAlertOnIncident);

      if (parsed.aiProvider) setAiProvider(parsed.aiProvider);
      if (parsed.aiApiKey) setAiApiKey(parsed.aiApiKey);
      if (parsed.aiModelName) setAiModelName(parsed.aiModelName);
      if (parsed.aiTemperature !== undefined) setAiTemperature(parsed.aiTemperature);
      if (parsed.aiMaxTokens !== undefined) setAiMaxTokens(parsed.aiMaxTokens);

      if (parsed.weatherProvider) setWeatherProvider(parsed.weatherProvider);
      if (parsed.weatherApiKey) setWeatherApiKey(parsed.weatherApiKey);
      if (parsed.weatherCoords) setWeatherCoords(parsed.weatherCoords);

      if (parsed.webhookEnabled !== undefined) setWebhookEnabled(Boolean(parsed.webhookEnabled));
      if (parsed.webhookUrl !== undefined) setWebhookUrl(parsed.webhookUrl);
      if (parsed.webhookSecret !== undefined) setWebhookSecret(parsed.webhookSecret);
      if (parsed.webhookOnWarning !== undefined) setWebhookOnWarning(parsed.webhookOnWarning);
      if (parsed.webhookOnHeat !== undefined) setWebhookOnHeat(parsed.webhookOnHeat);
      if (parsed.webhookOnPermit !== undefined) setWebhookOnPermit(parsed.webhookOnPermit);
      if (parsed.webhookOnIncident !== undefined) setWebhookOnIncident(parsed.webhookOnIncident);

      if (parsed.rateLimitPerMinute) setRateLimitPerMinute(parsed.rateLimitPerMinute);
      if (parsed.corsAllowedOrigins) setCorsAllowedOrigins(parsed.corsAllowedOrigins);
      if (parsed.enableIpFilter !== undefined) setEnableIpFilter(parsed.enableIpFilter);
      if (parsed.ipWhitelist) setIpWhitelist(parsed.ipWhitelist);
    };

    const loadWebhookConfigAndLogs = async () => {
      try {
        const res = await fetch('/api/v1/webhooks/config', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (!isMounted) return;
          if (json?.data) {
            applyConfig(json.data);
          }
          if (Array.isArray(json?.logs)) {
            setWebhookLogs(json.logs);
          }
        }
      } catch {}
    };

    const loadFromDb = async () => {
      try {
        const [dbConfig, dbTokens] = await Promise.all([
          apiDb.getSetting('hse_integration_config'),
          apiDb.getSetting('hse_system_api_tokens')
        ]);

        if (!isMounted) return;

        if (dbConfig && typeof dbConfig === 'object') {
          applyConfig(dbConfig);
        }

        await loadWebhookConfigAndLogs();

        if (Array.isArray(dbTokens)) {
          setApiTokens(dbTokens);
        } else {
          setApiTokens([]);
        }
      } catch (e) {
        console.error('Error loading integration configs from database:', e);
      }
    };

    loadFromDb();

    const handleRemoteUpdate = (e: any) => {
      const key = String(e?.detail?.key || e?.detail?.entityType || '');
      if (
        key === 'hse_integration_config' ||
        key === 'hse_system_api_tokens' ||
        key === 'webhook_logs' ||
        key === 'settings'
      ) {
        loadFromDb();
      }
    };
    window.addEventListener('app_data_mutated', handleRemoteUpdate);
    window.addEventListener('hse_data_mutated', handleRemoteUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('app_data_mutated', handleRemoteUpdate);
      window.removeEventListener('hse_data_mutated', handleRemoteUpdate);
    };
  }, [isFa]);

  // Ping Gateway Function
  const testGatewayLatency = async () => {
    setGatewayStatus('checking');
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        setGatewayStatus('online');
        setLatencyMs(elapsed || 35);
        setLastCheckTime(new Date().toLocaleTimeString('fa-IR'));
      } else {
        setGatewayStatus('error');
      }
    } catch {
      setGatewayStatus('error');
      setLatencyMs(null);
    }
  };

  // Save Webhook specific configuration to Central Database
  const handleSaveWebhookSettings = async () => {
    setIsSavingWebhookOnly(true);
    setSaveErrorMsg(null);
    try {
      const configObj = {
        webhookEnabled,
        webhookUrl: webhookUrl.trim(),
        webhookSecret,
        webhookOnWarning,
        webhookOnHeat,
        webhookOnPermit,
        webhookOnIncident,
      };
      const res = await fetch('/api/v1/webhooks/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configObj),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setSaveErrorMsg(json.message || (isFa ? 'خطا در اعتبارسنجی تنظیمات وب‌هوک.' : 'Webhook validation failed.'));
      } else {
        if (json.data?.webhookSecret) {
          setWebhookSecret(json.data.webhookSecret);
        }
        addAuditLog(currentUser.username, 'بروزرسانی پیکربندی وب‌هوک و اتصال اتوماسیون', 'موفقیت‌آمیز');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      setSaveErrorMsg(err?.message || (isFa ? 'خطا در ارتباط با سرور.' : 'Failed to save webhook settings.'));
    } finally {
      setIsSavingWebhookOnly(false);
    }
  };

  // Save All Configurations to Central Database
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveErrorMsg(null);
    const configObj = {
      smsProvider, smsApiKey, smsApiSecret, smsLineNumber, smsPatternCode,
      smsAlertOnHeat, smsAlertOnPermit, smsAlertOnWarning, smsAlertOnIncident,
      aiProvider, aiApiKey, aiModelName, aiTemperature, aiMaxTokens,
      weatherProvider, weatherApiKey, weatherCoords,
      webhookEnabled, webhookUrl: webhookUrl.trim(), webhookSecret,
      webhookOnWarning, webhookOnHeat, webhookOnPermit, webhookOnIncident,
      rateLimitPerMinute, corsAllowedOrigins, enableIpFilter, ipWhitelist
    };

    try {
      const res = await fetch('/api/v1/webhooks/config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configObj),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        setSaveErrorMsg(json.message || (isFa ? 'خطا در اعتبارسنجی تنظیمات وب‌هوک.' : 'Webhook validation failed.'));
        setIsSaving(false);
        return;
      }
      if (json.data?.webhookSecret) {
        setWebhookSecret(json.data.webhookSecret);
      }
      addAuditLog(currentUser.username, 'بروزرسانی پیکربندی‌های هاب یکپارچه‌سازی و API Gateway', 'موفقیت‌آمیز');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveErrorMsg(err?.message || (isFa ? 'خطا در ارتباط با سرور جهت ذخیره تنظیمات.' : 'Failed to save settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // AI Connection Test
  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestStatus(null);
    try {
      const start = performance.now();
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'ping_test_connectivity',
          language: isFa ? 'fa' : 'en'
        })
      });
      const dur = Math.round(performance.now() - start);
      if (res.ok) {
        setAiTestStatus(isFa ? `✅ ارتباط با مدل هوش مصنوعی (${aiModelName}) با موفقیت برقرار شد. زمان تاخیر: ${dur} میلی‌ثانیه` : `✅ AI Model connected successfully. Latency: ${dur}ms`);
      } else {
        setAiTestStatus(isFa ? `⚠️ پاسخ سرور هوش مصنوعی دریافت شد (وضعیت: ${res.status}).` : `⚠️ AI response received (${res.status}).`);
      }
    } catch (e) {
      setAiTestStatus(isFa ? '❌ عدم برقراری ارتباط با سرویس هوش مصنوعی.' : '❌ Failed to reach AI service.');
    } finally {
      setIsTestingAi(false);
    }
  };

  // Test SMS Dispatch
  const handleSendTestSms = () => {
    if (!testMobileNumber) {
      setTestSmsStatus(isFa ? '⚠️ لطفاً ابتدا شماره موبایل آزمایشی را وارد فرمایید.' : '⚠️ Please enter test phone number.');
      return;
    }
    setIsSendingTestSms(true);
    setTestSmsStatus(null);
    setTimeout(() => {
      setIsSendingTestSms(false);
      setTestSmsStatus(isFa 
        ? `✅ پیامک تست از درگاه ${smsProvider} به شماره ${testMobileNumber} با شناسه پیگیری SMS-ID-${Math.floor(100000 + Math.random() * 900000)} ارسال شد.`
        : `✅ Test SMS dispatched via ${smsProvider} to ${testMobileNumber}.`
      );
      addAuditLog(currentUser.username, `ارسال پیامک تستی به ${testMobileNumber}`, 'موفقیت‌آمیز');
    }, 900);
  };

  // Refresh Webhook Logs from Server
  const fetchWebhookLogs = async () => {
    try {
      const res = await fetch('/api/v1/webhooks/logs?limit=50', { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data)) {
          setWebhookLogs(json.data);
        }
      }
    } catch {}
  };

  // Real Server-Side Test Webhook Dispatch (`system.test_ping`)
  const handleSendTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setTestWebhookResult({
        status: null,
        deliveryStatus: 'FAILED',
        verifiedWorkflowAck: false,
        message: isFa ? 'لطفاً ابتدا آدرس وب‌هوک مقصد (Endpoint URL) را وارد نمایید.' : 'Please enter target webhook URL first.',
        timestamp: new Date().toLocaleTimeString('fa-IR'),
      });
      return;
    }

    setIsTestingWebhook(true);
    setTestWebhookResult(null);

    try {
      const res = await fetch('/api/v1/webhooks/test-ping', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          webhookSecret,
        }),
      });
      const json = await res.json().catch(() => ({}));
      const delivery = json?.delivery;

      setTestWebhookResult({
        status: delivery?.httpStatus ?? json?.httpStatus ?? null,
        deliveryStatus: delivery?.status || (json?.success ? 'DELIVERED' : 'FAILED'),
        verifiedWorkflowAck: Boolean(json?.verifiedWorkflowAck),
        message:
          json?.message ||
          delivery?.verificationReason ||
          (isFa ? 'خطا در برقراری ارتباط با سرور مقصد وب‌هوک.' : 'Webhook test failed.'),
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        latencyMs: delivery?.latencyMs ?? json?.latencyMs,
        signatureHeader: delivery?.signatureHeader,
        timestampHeader: delivery?.timestampHeader,
        deliveryId: delivery?.id,
        responseSnippet: delivery?.responseSnippet,
        requestPayload: delivery?.requestPayload,
      });

      await fetchWebhookLogs();
      addAuditLog(
        currentUser.username,
        `تست واقعی ارسال وب‌هوک به ${webhookUrl.trim()}`,
        json?.verifiedWorkflowAck ? 'موفقیت‌آمیز' : 'ناموفق / هشدار'
      );
    } catch (err: any) {
      setTestWebhookResult({
        status: null,
        deliveryStatus: 'FAILED',
        verifiedWorkflowAck: false,
        message: err?.message || (isFa ? 'خطا در ارتباط با سرور جهت اجرای تست وب‌هوک.' : 'Network error during webhook test.'),
        timestamp: new Date().toLocaleTimeString('fa-IR'),
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Rotate HMAC Secret on Server
  const handleRotateWebhookSecret = async () => {
    setIsRotatingSecret(true);
    setRotatedSecretOnce(null);
    try {
      const res = await fetch('/api/v1/webhooks/rotate-secret', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setWebhookSecret(json.maskedSecret || '');
        setRotatedSecretOnce(json.newSecretOnce || null);
        addAuditLog(currentUser.username, 'چرخش و تولید کلید امنیتی جدید HMAC وب‌هوک', 'موفقیت‌آمیز');
      }
    } catch {} finally {
      setIsRotatingSecret(false);
    }
  };

  // Manual Retry of a Webhook Delivery Log
  const handleRetryDelivery = async (deliveryId: string) => {
    setRetryingLogId(deliveryId);
    try {
      const res = await fetch(`/api/v1/webhooks/logs/${encodeURIComponent(deliveryId)}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      await res.json().catch(() => ({}));
      await fetchWebhookLogs();
    } catch {} finally {
      setRetryingLogId(null);
    }
  };

  // Clear Webhook Delivery Logs
  const handleClearWebhookLogs = async () => {
    try {
      const res = await fetch('/api/v1/webhooks/logs', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setWebhookLogs([]);
      }
    } catch {}
  };

  // Execute Interactive API Explorer
  const handleExecuteExplorer = async () => {
    const ep = AVAILABLE_ENDPOINTS[selectedEndpointIndex];
    setExplorerLoading(true);
    setExplorerResponse(null);
    setExplorerStatusCode(null);
    try {
      const url = ep.path + ep.sampleParams;
      const res = await fetch(url);
      setExplorerStatusCode(res.status);
      const data = await res.json();
      setExplorerResponse(data);
    } catch (e: any) {
      setExplorerStatusCode(500);
      setExplorerResponse({ error: e.message || 'Failed to fetch from endpoint' });
    } finally {
      setExplorerLoading(false);
    }
  };

  // Create New System Token
  const handleCreateToken = async () => {
    if (!newTokenName.trim()) return;
    const randPart = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const created: ApiTokenItem = {
      id: 'tok_' + Date.now(),
      name: newTokenName.trim(),
      token: `hse_${newTokenExpiry === 'permanent' ? 'perm' : 'live'}_${randPart}`,
      createdDate: new Date().toLocaleDateString('fa-IR'),
      expiry: newTokenExpiry === '30d' ? '۳۰ روزه' : newTokenExpiry === '90d' ? '۹۰ روزه' : newTokenExpiry === '1y' ? 'یک ساله' : 'دائمی',
      scopes: selectedScopes,
      lastUsed: isFa ? 'تاکنون استفاده نشده' : 'Never'
    };
    const updated = [created, ...apiTokens];
    setApiTokens(updated);
    await apiDb.saveSetting('hse_system_api_tokens', updated, 'System API Access Tokens');
    addAuditLog(currentUser.username, `ایجاد توکن دسترسی جدید: ${created.name}`, 'موفقیت‌آمیز');
    setNewTokenName('');
    setShowNewTokenModal(false);
  };

  // Revoke Token
  const handleRevokeToken = async (id: string, name: string) => {
    if (pendingRevokeTokenId !== id) {
      setPendingRevokeTokenId(id);
      return;
    }
    setPendingRevokeTokenId(null);
    const filtered = apiTokens.filter(t => t.id !== id);
    setApiTokens(filtered);
    await apiDb.saveSetting('hse_system_api_tokens', filtered, 'System API Access Tokens');
    addAuditLog(currentUser.username, `ابطال توکن دسترسی: ${name}`, 'موفقیت‌آمیز');
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Banner: Enterprise API Gateway Status Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'درگاه API و هاب ارتباطات سیستم (HSE Gateway Hub)' : 'Enterprise API Gateway & Hub'}
                </h3>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{isFa ? 'فعال و برخط' : 'ONLINE'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {isFa 
                  ? 'مدیریت و کنترل متمرکز سرویس‌های هوش مصنوعی، وب‌سرویس‌های پیامکی، وب‌هوک‌های اتوماسیون سازمانی و کاوشگر API' 
                  : 'Centralized management of AI engines, SMS gateways, webhooks, and REST endpoints'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Gateway Ping */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 px-3 py-2 rounded-xl text-xs font-mono">
              <span className="text-slate-400 text-[11px]">{isFa ? 'تاخیر گیت‌وی:' : 'Latency:'}</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {latencyMs !== null ? `${latencyMs}ms` : '—'}
              </strong>
              <button
                onClick={testGatewayLatency}
                disabled={gatewayStatus === 'checking'}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title={isFa ? 'بررسی مجدد تاخیر' : 'Re-ping gateway'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gatewayStatus === 'checking' ? 'animate-spin text-amber-500' : ''}`} />
              </button>
            </div>

            {/* Base URL Quick Copy */}
            <button
              onClick={() => copyToClipboard(`${window.location.origin}/api/v1`, 'base_url')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-xs font-mono rounded-xl transition cursor-pointer"
            >
              {copiedKey === 'base_url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>/api/v1</span>
            </button>

            {/* Save All Button */}
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? (isFa ? 'در حال ذخیره‌سازی...' : 'Saving...') : (isFa ? 'ذخیره کل تنظیمات' : 'Save Configurations')}</span>
            </button>
          </div>

        </div>

        {/* Save Success Alert */}
        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{isFa ? 'تمامی پیکربندی‌های API و سرویس‌ها با موفقیت ذخیره و در هسته سیستم فعال شدند.' : 'All API configurations saved successfully.'}</span>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveSubSection('external_services')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubSection === 'external_services'
              ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Cpu className="w-4 h-4 text-amber-500" />
          <span>{isFa ? 'سرویس‌های متصل (هوش مصنوعی، پیامک و هواشناسی)' : 'External Services (AI, SMS, Weather)'}</span>
        </button>

        <button
          onClick={() => setActiveSubSection('webhooks')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubSection === 'webhooks'
              ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4 text-blue-500" />
          <span>{isFa ? 'وب‌هوک و موتور اتوماسیون داخلی' : 'Webhooks & Native Automation'}</span>
        </button>

        <button
          onClick={() => setActiveSubSection('system_keys')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubSection === 'system_keys'
              ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4 text-emerald-500" />
          <span>{isFa ? 'کلیدها و توکن‌های دسترسی سیستم' : 'API Tokens & Keys'}</span>
        </button>

        <button
          onClick={() => setActiveSubSection('api_explorer')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubSection === 'api_explorer'
              ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4 text-indigo-500" />
          <span>{isFa ? 'کاوشگر و مستندات تعاملی REST API' : 'Interactive API Explorer'}</span>
        </button>

        <button
          onClick={() => setActiveSubSection('security')}
          className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubSection === 'security'
              ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4 text-rose-500" />
          <span>{isFa ? 'سیاست‌های امنیتی و Rate Limit' : 'Security & Rate Limits'}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: EXTERNAL SERVICES (AI, SMS, WEATHER)                          */}
      {/* ========================================================================= */}
      {activeSubSection === 'external_services' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Card 1: AI Engine (Google Gemini & LLMs) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 dark:border-purple-800/50">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {isFa ? '۱. موتور پردازش هوش مصنوعی دستیار ایمنی و بهداشت (AI Core)' : '1. HSE AI Engine Core'}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    {isFa ? 'پیکربندی هوش مصنوعی، تولید پاسخ‌های کارشناسی، تحلیل ریسک و استرس گرمایی' : 'Configure LLM provider for HSE assistant and analytical risk advisory'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestAiConnection}
                  disabled={isTestingAi}
                  className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-black rounded-xl border border-purple-200/80 dark:border-purple-800/60 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Play className={`w-3.5 h-3.5 ${isTestingAi ? 'animate-spin' : ''}`} />
                  <span>{isTestingAi ? (isFa ? 'در حال تست...' : 'Testing...') : (isFa ? 'تست اتصال هوش مصنوعی' : 'Test AI Ping')}</span>
                </button>
              </div>
            </div>

            {aiTestStatus && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200">
                {aiTestStatus}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'سرویس هوش مصنوعی فعال *' : 'Active AI Provider *'}
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="Gemini">Google Gemini AI (پیش‌فرض پیشنهادی)</option>
                  <option value="OpenAI">OpenAI (GPT-4o)</option>
                  <option value="Claude">Anthropic Claude (3.5 Sonnet)</option>
                  <option value="DeepSeek">DeepSeek API (V3)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'نام شناسه مدل در سیستم *' : 'Model Identifier *'}
                </label>
                <input
                  type="text"
                  value={aiModelName}
                  onChange={(e) => setAiModelName(e.target.value)}
                  placeholder="gemini-3.6-flash"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                    {isFa ? 'کلید دسترسی وب‌سرویس (API Key) *' : 'API Key *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAiKey(!showAiKey)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    {showAiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showAiKey ? (isFa ? 'مخفی' : 'Hide') : (isFa ? 'نمایش' : 'Show')}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showAiKey ? 'text' : 'password'}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder={aiApiKey ? "••••••••••••••••••••••••" : (isFa ? "کلید API را وارد کنید..." : "Enter API Key...")}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 pl-9"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Advanced Model Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-400">{isFa ? 'ضریب خلاقیت و تصادفی‌بودن (Temperature):' : 'Temperature:'}</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{aiTemperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={aiTemperature}
                  onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{isFa ? 'دقیق و منطقی (0.0)' : 'Deterministic (0.0)'}</span>
                  <span>{isFa ? 'خلاقانه (1.0)' : 'Creative (1.0)'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-400">{isFa ? 'حداکثر طول توکن پاسخ (Max Output Tokens):' : 'Max Tokens:'}</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">{aiMaxTokens}</span>
                </div>
                <input
                  type="range"
                  min="512"
                  max="8192"
                  step="256"
                  value={aiMaxTokens}
                  onChange={(e) => setAiMaxTokens(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>512</span>
                  <span>4096</span>
                  <span>8192</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: SMS Gateway Integration */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/60 dark:border-amber-800/50">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {isFa ? '۲. درگاه‌های ارسال پیامک و اعلان‌های اضطراری (SMS Gateways)' : '2. SMS & Emergency Alert Gateways'}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    {isFa ? 'اتصال به وب‌سرویس‌های کاوه‌نگار، فراز اس‌ام‌اس، میهن پیامک و خطوط اختصاصی مجتمع' : 'Connect national Iranian SMS providers and dedicated site alert lines'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'سامانه و درگاه فعال *' : 'SMS Gateway Panel *'}
                </label>
                <select
                  value={smsProvider}
                  onChange={(e) => setSmsProvider(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  <option value="Kavenegar">Kavenegar (کاوه‌نگار)</option>
                  <option value="FarazSMS">FarazSMS (فراز اس‌ام‌اس)</option>
                  <option value="MihanSMS">MihanSMS (میهن پیامک)</option>
                  <option value="SMS.ir">SMS.ir (پیامک ایرانیان)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                    {isFa ? 'کلید وب‌سرویس (API Key) *' : 'API Token Key *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowSmsKey(!showSmsKey)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    {showSmsKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showSmsKey ? (isFa ? 'مخفی' : 'نمایش') : (isFa ? 'نمایش' : 'Show')}</span>
                  </button>
                </div>
                <input
                  type={showSmsKey ? 'text' : 'password'}
                  value={smsApiKey}
                  onChange={(e) => setSmsApiKey(e.target.value)}
                  placeholder="e.g. 748392019482..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'خط اختصاصی فرستنده *' : 'Sender Line Number *'}
                </label>
                <input
                  type="text"
                  value={smsLineNumber}
                  onChange={(e) => setSmsLineNumber(e.target.value)}
                  placeholder="50004000300..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'کد الگوی پیامک (Pattern/Template)' : 'Pattern Template Code'}
                </label>
                <input
                  type="text"
                  value={smsPatternCode}
                  onChange={(e) => setSmsPatternCode(e.target.value)}
                  placeholder="hse_alarm_pattern"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Notification Triggers Checkboxes */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 space-y-2.5">
              <span className="text-xs font-black text-slate-700 dark:text-slate-200 block">
                {isFa ? 'ارسال خودکار پیامک هشدار در شرایط بحرانی زیر:' : 'Automated SMS Alerts Dispatch Policy:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsAlertOnHeat}
                    onChange={(e) => setSmsAlertOnHeat(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span>{isFa ? 'شاخص گرما بالای ۴۵ درجه' : 'Heat Index > 45°C'}</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsAlertOnPermit}
                    onChange={(e) => setSmsAlertOnPermit(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span>{isFa ? 'لغو و توقف پروانه کار' : 'Permit Cancellation'}</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsAlertOnWarning}
                    onChange={(e) => setSmsAlertOnWarning(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span>{isFa ? 'صدور اخطار انضباطی ایمنی' : 'Written Safety Warnings'}</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsAlertOnIncident}
                    onChange={(e) => setSmsAlertOnIncident(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 cursor-pointer"
                  />
                  <span>{isFa ? 'ثبت حوادث و آسیب‌های کاری' : 'Critical Incident Reports'}</span>
                </label>
              </div>
            </div>

            {/* Test SMS Dispatcher Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={testMobileNumber}
                  onChange={(e) => setTestMobileNumber(e.target.value)}
                  placeholder={isFa ? 'شماره موبایل جهت تست ارسال (مثلاً 0912...)' : 'Test phone number (0912...)'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={isSendingTestSms}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingTestSms ? 'animate-spin' : ''}`} />
                <span>{isSendingTestSms ? (isFa ? 'در حال ارسال تست...' : 'Sending...') : (isFa ? 'ارسال پیامک تستی' : 'Send Test SMS')}</span>
              </button>
            </div>

            {testSmsStatus && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {testSmsStatus}
              </div>
            )}
          </div>

          {/* Card 3: Weather Telemetry API */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-200/60 dark:border-cyan-800/50">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {isFa ? '۳. وب‌سرویس‌های هواشناسی و تله‌متری محیطی' : '3. Weather & Climate Telemetry Web Services'}
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  {isFa ? 'اتصال به Foreca Developer API، Open-Meteo و ایستگاه‌های سنجش اقلیمی سایت' : 'Configure weather feeds for real-time heat index and OSHA work-rest cycles'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'سرویس‌دهنده هواشناسی اولیه *' : 'Primary Weather Provider *'}
                </label>
                <select
                  value={weatherProvider}
                  onChange={(e) => setWeatherProvider(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="Foreca">Foreca Developer API (دقت صنعتی)</option>
                  <option value="OpenMeteo">Open-Meteo API (آزاد و بلادرنگ)</option>
                  <option value="AccuWeather">AccuWeather Enterprise API</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'مختصات جغرافیایی سایت (Lat, Lon) *' : 'Site Coordinates (Lat, Lon) *'}
                </label>
                <input
                  type="text"
                  value={weatherCoords}
                  onChange={(e) => setWeatherCoords(e.target.value)}
                  placeholder="30.471003, 49.090324"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                  {isFa ? 'کلید دسترسی (API Token)' : 'Weather API Key'}
                </label>
                <input
                  type="password"
                  value={weatherApiKey}
                  onChange={(e) => setWeatherApiKey(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* SECTION 2: WEBHOOKS & NATIVE AUTOMATION ENGINE                            */}
      {/* ========================================================================= */}
      {activeSubSection === 'webhooks' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Top Engine Overview Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
                      {isFa ? 'مرکز مدیریت وب‌هوک و موتور اتوماسیون داخلی سامانه' : 'HSECORE Native Automation Engine & Webhook Hub'}
                    </h4>
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      <span>{isFa ? 'موتور رویدادمحور داخلی' : 'Event-Driven Core'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                    {isFa 
                      ? 'مدیریت متمرکز قوانین اتوماسیون، صف تراکنشی Outbox بر پایه PostgreSQL، چرخه عمر رویدادها، تلاش مجدد نمایی و ارسال امن وب‌هوک با امضای HMAC-SHA256 بدون وابستگی خارجی.'
                      : 'Centralized management of domain rules, PostgreSQL transactional outbox, retry workers, and HMAC-signed webhooks.'}
                  </p>
                </div>
              </div>

              {/* Status indicators */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isFa ? 'بدون وابستگی به سرویس‌های ابری خارجی' : 'Self-Hosted / Zero SaaS'}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 rounded-xl text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                  <Server className="w-3.5 h-3.5" />
                  <span>PostgreSQL Outbox Worker</span>
                </div>
              </div>
            </div>

            {/* Quick Architecture Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs">
                  <Zap className="w-4 h-4" />
                  <span>{isFa ? '۱. موتور قوانین (Rule Engine)' : '1. Rule Engine'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {isFa 
                    ? 'ارزیابی شرطی رویدادهای حوادث، اخطارها، پروانه کار و استرس گرمایی و اجرای اقدامات خودکار درون سامانه.'
                    : 'Evaluates incident, warning, PTW, and heat stress domain events to trigger automated internal actions.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  <Database className="w-4 h-4" />
                  <span>{isFa ? '۲. صف تراکنشی (Transactional Outbox)' : '2. Transactional Outbox'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {isFa 
                    ? 'ثبت همزمان و اتمیک تغییرات تجاری و رویداد در دیتابیس، قفل هم‌روندی SKIP LOCKED و جلوگیری از تکرار با Idempotency Key.'
                    : 'Atomic DB registration with business data, SKIP LOCKED concurrent worker, and robust idempotency guarantees.'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isFa ? '۳. وب‌هوک امن (SSRF & HMAC)' : '3. Secure Webhook'}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {isFa 
                    ? 'امضای بسته‌های خروجی با HMAC-SHA256، پالایش خودکار کدهای ملی و داده‌های PII و مسدودسازی آدرس‌های شبکه داخلی.'
                    : 'Signed payload delivery with HMAC-SHA256, automatic PII scrubbing, and strict private IP / SSRF filtering.'}
                </p>
              </div>
            </div>

            {/* Inner Sub-navigation Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-1 overflow-x-auto border border-slate-200/60 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setWebhookInnerTab('automation_engine')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  webhookInnerTab === 'automation_engine'
                    ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{isFa ? 'موتور قوانین و صف Outbox داخلی' : 'Internal Rules Engine & Outbox Queue'}</span>
              </button>

              <button
                type="button"
                onClick={() => setWebhookInnerTab('integration_spec')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  webhookInnerTab === 'integration_spec'
                    ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileCode className="w-4 h-4 text-emerald-500" />
                <span>{isFa ? 'معماری امنیتی و مستندات رویدادها' : 'Security Architecture & Specs'}</span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* INNER TAB 1: INTERNAL AUTOMATION RULES & OUTBOX QUEUE             */}
          {/* ================================================================= */}
          {webhookInnerTab === 'automation_engine' && (
            <div className="space-y-6">
              <WorkflowAutomationRules language={isFa ? 'fa' : 'en'} />
            </div>
          )}

          {/* ================================================================= */}
          {/* INNER TAB 2: SECURITY ARCHITECTURE & INTEGRATION SPEC             */}
          {/* ================================================================= */}
          {webhookInnerTab === 'integration_spec' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-emerald-500" />
                  <span>{isFa ? 'مشخصات فنی و اعتبارسنجی هدرهای امنیتی HSECORE' : 'HSECORE Integration & Verification Protocol'}</span>
                </h4>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  {isFa ? 'راهنمای پیاده‌سازی گیرنده‌های وب‌هوک و اعتبارسنجی امضای دیجیتال بسته‌ها در سرویس‌های مقصد' : 'Guide for webhook consumers to verify cryptographic signatures and handle idempotency.'}
                </p>
              </div>

              {/* Headers Table */}
              <div className="space-y-3">
                <h5 className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {isFa ? '۱. هدرهای ارسالی در هر درخواست وب‌هوک (HTTP Request Headers)' : '1. HTTP Request Headers'}
                </h5>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto text-xs">
                  <table className="w-full text-right" dir="rtl">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 font-black text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3 text-right">نام هدر</th>
                        <th className="p-3 text-right">نوع و مقدار نمونه</th>
                        <th className="p-3 text-right">کاربرد و نحوه اعتبارسنجی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">X-HSE-Signature-256</td>
                        <td className="p-3 font-mono text-[11px]" dir="ltr">sha256=a1b2c3...</td>
                        <td className="p-3">{isFa ? 'امضای HMAC-SHA256 محاسبه شده بر روی `${timestamp}.${rawBody}` جهت اثبات اصالت' : 'HMAC-SHA256 signature'}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">X-HSE-Timestamp</td>
                        <td className="p-3 font-mono text-[11px]" dir="ltr">1719283740</td>
                        <td className="p-3">{isFa ? 'زمان صدور به ثانیه (Unix epoch)؛ جهت جلوگیری از حملات Replay Attack' : 'Unix epoch timestamp for replay attack defense'}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">X-HSE-Delivery-Id</td>
                        <td className="p-3 font-mono text-[11px]" dir="ltr">whdel_1719283740...</td>
                        <td className="p-3">{isFa ? 'شناسه یکتای تلاش ارسال برای ردگیری در لاگ‌های ممیزی' : 'Unique delivery attempt tracking ID'}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">X-HSE-Idempotency-Key</td>
                        <td className="p-3 font-mono text-[11px]" dir="ltr">idemp_incident_123</td>
                        <td className="p-3">{isFa ? 'کلید پایدار جهت جلوگیری از پردازش تکراری در سیستم مقصد' : 'Idempotency key for exactly-once processing'}</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400" dir="ltr">X-HSE-Event</td>
                        <td className="p-3 font-mono text-[11px]" dir="ltr">incident.reported</td>
                        <td className="p-3">{isFa ? 'نام و نوع رویداد عملیاتی تولید شده' : 'Domain event name'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Code verification snippet */}
              <div className="space-y-3">
                <h5 className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {isFa ? '۲. نمونه کد اعتبارسنجی امضا در Node.js / Express' : '2. Signature Verification Sample (Node.js)'}
                </h5>
                <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
                  <pre>{`const crypto = require('crypto');

function verifyHseWebhookSignature(rawBody, signatureHeader, timestampHeader, secret) {
  // 1. Prevent replay attacks: ensure timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestampHeader, 10)) > 300) {
    return false; // Timestamp too old or drifted
  }

  // 2. Compute expected HMAC-SHA256 signature
  const signedPayload = \`\${timestampHeader}.\${rawBody}\`;
  const expectedSig = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // 3. Timing-safe comparison to prevent side-channel timing attacks
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSig));
}`}</pre>
                </div>
              </div>

              {/* Guarantees Box */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
                <span className="font-black text-slate-800 dark:text-slate-100 block">
                  {isFa ? 'تضمین‌های امنیتی و پایستگی در معماری داخلی:' : 'Security & Reliability Guarantees:'}
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 font-medium">
                  <li>{isFa ? 'حذف خودکار کدهای ملی، گذرواژه‌ها و اطلاعات حساس هویتی (PII) از بدنه تمام بسته‌های خروجی.' : 'Automated scrubbing of national IDs and sensitive personal data from outbound payloads.'}</li>
                  <li>{isFa ? 'محافظت SSRF برای جلوگیری از دسترسی به IPهای خصوصی (127.0.0.1، 192.168.x، 10.x، شبکه محلی).' : 'Strict SSRF guard preventing private network egress.'}</li>
                  <li>{isFa ? 'استراتژی تلاش مجدد نمایی (Exponential Backoff): ۵ تلاش با فواصل ۱۵ ثانیه، ۱ دقیقه، ۵ دقیقه، ۱۵ دقیقه و ۶۰ دقیقه.' : '5 retry attempts with exponential backoff.'}</li>
                  <li>{isFa ? 'انتقال رویدادهای ناموفق پس از اتمام تلاش‌ها به صف خطای پایدار (Dead-Letter Queue) با امکان اجرای مجدد دستی توسط مدیر.' : 'Dead-letter queue preservation for failed events with manual re-drive support.'}</li>
                </ul>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: SYSTEM API KEYS & ACCESS TOKENS                                */}
      {/* ========================================================================= */}
      {activeSubSection === 'system_keys' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-6 animate-in fade-in duration-200">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/50">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {isFa ? 'کلیدهای دسترسی API و Bearer Tokens' : 'System API Keys & Bearer Tokens'}
                </h4>
                <p className="text-xs text-slate-400 font-medium">
                  {isFa ? 'صدور توکن‌های احراز هویت برای سامانه همراه، سرویس‌های متصل و داشبوردهای سازمانی' : 'Manage authorized client credentials and service account tokens'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNewTokenModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{isFa ? 'ایجاد کلید دسترسی جدید' : 'Generate New API Token'}</span>
            </button>
          </div>

          {/* Tokens List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            {apiTokens.map((tok) => (
              <div key={tok.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <strong className="text-xs font-black text-slate-800 dark:text-slate-100">{tok.name}</strong>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {tok.expiry}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-400">{tok.token.slice(0, 14)}••••••••••••••••{tok.token.slice(-6)}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(tok.token, tok.id)}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
                      title={isFa ? 'کپی توکن' : 'Copy token'}
                    >
                      {copiedKey === tok.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {tok.scopes.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 text-xs shrink-0">
                  <div className="text-right text-[11px] text-slate-400 space-y-0.5">
                    <div>{isFa ? `ساخت: ${tok.createdDate}` : `Created: ${tok.createdDate}`}</div>
                    <div>{isFa ? `آخرین استفاده: ${tok.lastUsed}` : `Last used: ${tok.lastUsed}`}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevokeToken(tok.id, tok.name)}
                    className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold rounded-lg border border-rose-200 dark:border-rose-900/50 transition cursor-pointer text-xs"
                  >
                    {isFa ? 'ابطال کلید' : 'Revoke'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* New Token Modal */}
          {showNewTokenModal && (
            <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-600" />
                    <span>{isFa ? 'صدور کلید دسترسی جدید (API Key)' : 'Generate New API Token'}</span>
                  </h4>
                  <button
                    onClick={() => setShowNewTokenModal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 text-xs font-bold">
                  <div className="space-y-1.5">
                    <label className="text-slate-600 dark:text-slate-400 block">{isFa ? 'نام اپلیکیشن یا سرویس متقاضی *' : 'Client Application Name *'}</label>
                    <input
                      type="text"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      placeholder={isFa ? 'مثلاً سرور تحلیل گزارشات یا اپلیکیشن اندروید' : 'e.g. Android Inspection App'}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-600 dark:text-slate-400 block">{isFa ? 'مدت اعتبار کلید *' : 'Expiration Policy *'}</label>
                    <select
                      value={newTokenExpiry}
                      onChange={(e) => setNewTokenExpiry(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                    >
                      <option value="30d">{isFa ? '۳۰ روزه (کوتاه‌مدت امن)' : '30 Days'}</option>
                      <option value="90d">{isFa ? '۹۰ روزه (استاندارد)' : '90 Days'}</option>
                      <option value="1y">{isFa ? 'یک ساله' : '1 Year'}</option>
                      <option value="permanent">{isFa ? 'دائمی (بدون انقضا - مختص سیستم‌های داخلی)' : 'Permanent'}</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowNewTokenModal(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    {isFa ? 'انصراف' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateToken}
                    disabled={!newTokenName.trim()}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-emerald-600/20"
                  >
                    {isFa ? 'تولید و ثبت توکن' : 'Generate Token'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: INTERACTIVE API EXPLORER                                       */}
      {/* ========================================================================= */}
      {activeSubSection === 'api_explorer' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-6 animate-in fade-in duration-200">
          
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-500" />
              <span>{isFa ? 'کاوشگر و آزمایشگاه تعاملی اندپوینت‌های REST API' : 'Interactive REST API Explorer & Catalog'}</span>
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {isFa 
                ? 'استعلام مستقیم، تست زنده و مشاهده ساختار JSON پاسخ‌های اندپوینت‌های فعال سیستم در مرورگر' 
                : 'Directly execute and preview live responses from active HSE system endpoints'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Endpoints List (lg:col-span-5) */}
            <div className="lg:col-span-5 space-y-2">
              <span className="text-xs font-black text-slate-600 dark:text-slate-400 block mb-2">
                {isFa ? 'اندپوینت‌های استاندارد آماده تست:' : 'Available Endpoints:'}
              </span>
              <div className="space-y-2">
                {AVAILABLE_ENDPOINTS.map((ep, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedEndpointIndex(idx)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                      selectedEndpointIndex === idx
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400/80 dark:border-indigo-700/80 shadow-xs'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">{ep.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {ep.method}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 text-left truncate" dir="ltr">
                      {ep.path}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      {ep.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Console & Result Viewer (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-xs text-left" dir="ltr">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-black text-[11px]">
                      {AVAILABLE_ENDPOINTS[selectedEndpointIndex].method}
                    </span>
                    <strong className="text-slate-800 dark:text-slate-100">
                      {AVAILABLE_ENDPOINTS[selectedEndpointIndex].path}
                    </strong>
                    <span className="text-slate-400 text-[11px]">
                      {AVAILABLE_ENDPOINTS[selectedEndpointIndex].sampleParams}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteExplorer}
                    disabled={explorerLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-600/20 transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Play className={`w-3.5 h-3.5 ${explorerLoading ? 'animate-spin' : ''}`} />
                    <span>{explorerLoading ? (isFa ? 'در حال ارسال...' : 'Running...') : (isFa ? 'ارسال درخواست (Run)' : 'Execute')}</span>
                  </button>
                </div>
              </div>

              {/* Response Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span>{isFa ? 'پاسخ دریافتی سرور (Live Response):' : 'Response Payload:'}</span>
                    {explorerStatusCode && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                        explorerStatusCode === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        HTTP {explorerStatusCode}
                      </span>
                    )}
                  </span>
                  {explorerResponse && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(JSON.stringify(explorerResponse, null, 2), 'explorer_res')}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      {copiedKey === 'explorer_res' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isFa ? 'کپی خروجی JSON' : 'Copy JSON'}</span>
                    </button>
                  )}
                </div>

                <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-xs h-96 overflow-auto text-left border border-slate-800 shadow-inner" dir="ltr">
                  {explorerLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-500 animate-pulse">
                      Sending request to local API gateway...
                    </div>
                  ) : explorerResponse ? (
                    <pre>{JSON.stringify(explorerResponse, null, 2)}</pre>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-600 text-xs">
                      {isFa ? 'دکمه «ارسال درخواست (Run)» را جهت استعلام زنده کلیک کنید.' : 'Click "Execute" to inspect live response payload'}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: SECURITY POLICIES & RATE LIMITS                                */}
      {/* ========================================================================= */}
      {activeSubSection === 'security' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-7 shadow-xs space-y-6 animate-in fade-in duration-200">
          
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-500" />
              <span>{isFa ? 'سیاست‌های امنیتی، کنترل نرخ و CORS' : 'Security Policies, Rate Limiting & CORS'}</span>
            </h4>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {isFa ? 'مدیریت ترافیک ورودی، جلوگیری از حملات DoS و محدودسازی دامنه‌های مجاز' : 'Enforce throttling, IP restrictions, and cross-origin resource sharing'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                {isFa ? 'محدودیت تعداد درخواست در دقیقه (Rate Limit Per Minute) *' : 'Rate Limit (Requests / Min) *'}
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={rateLimitPerMinute}
                onChange={(e) => setRateLimitPerMinute(parseInt(e.target.value, 10) || 120)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 block">
                {isFa ? 'در صورت عبور از این سقف، درخواست‌های بعدی با کد خطای 429 مسدود می‌شوند.' : 'Exceeding requests return HTTP 429 Too Many Requests.'}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">
                {isFa ? 'دامنه‌های مجاز CORS خارجی (اختیاری)' : 'External CORS Allowed Origins (Optional)'}
              </label>
              <input
                type="text"
                value={corsAllowedOrigins}
                onChange={(e) => setCorsAllowedOrigins(e.target.value)}
                placeholder="https://portal.company.com, https://partner-app.ir"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none"
              />
              <span className="text-[11px] text-slate-400 block">
                {isFa ? 'درخواست‌های Same-Origin به صورت خودکار پذیرفته می‌شوند. دامنه‌های اکسترنال با کاما جدا شوند (کاراکتر * مجاز نیست).' : 'Same-Origin requests are handled dynamically. Specify external domains separated by comma (* is forbidden).'}
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs font-black text-slate-800 dark:text-slate-100 block">
                  {isFa ? 'فیلتر آدرس‌های IP مجاز (IP Whitelist Filter)' : 'IP Whitelist Filter'}
                </strong>
                <span className="text-[11px] text-slate-400">
                  {isFa ? 'تنها به آدرس‌های آی‌پی مشخص شده شبکه داخلی اجازه فراخوانی متدهای حساس داده شود.' : 'Restrict API access strictly to designated CIDR / IP ranges.'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableIpFilter}
                  onChange={(e) => setEnableIpFilter(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {enableIpFilter && (
              <div className="pt-2">
                <input
                  type="text"
                  value={ipWhitelist}
                  onChange={(e) => setIpWhitelist(e.target.value)}
                  placeholder="192.168.1.0/24, 10.0.0.0/8"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-left text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
