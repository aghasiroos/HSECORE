import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Clock,
  BellRing,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Plus,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Database,
  FileText,
  Activity,
  Layers,
  Send,
  Eye,
  Check,
  X,
  RefreshCw,
  Search,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  language: 'fa' | 'en';
}

interface AutomationRule {
  id: number;
  ruleCode: string;
  nameFa: string;
  nameEn: string;
  descriptionFa?: string;
  descriptionEn?: string;
  eventType: string;
  sourceModule: string;
  priority: number;
  isActive: boolean;
  conditions: any[];
  actions: any[];
  executionCount: number;
  lastTriggeredAt?: string | null;
  createdAt?: string;
}

interface OutboxItem {
  id: number;
  eventId: string;
  eventType: string;
  sourceModule: string;
  correlationKey: string | null;
  idempotencyKey: string;
  payload: any;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string;
  lockedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface ExecutionLog {
  id: number;
  logId: string;
  eventId: string;
  ruleId?: number;
  ruleCode: string;
  eventType: string;
  correlationKey?: string | null;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED';
  conditionMatched: boolean;
  conditionDetails?: any;
  actionsExecuted?: any[];
  durationMs: number;
  errorMessage?: string | null;
  actor: string;
  createdAt: string;
}

interface QueueStats {
  counts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    total: number;
  };
  recentOutbox: OutboxItem[];
}

export default function WorkflowAutomationRules({ language }: Props) {
  const isFa = language === 'fa';
  const [activeTab, setActiveTab] = useState<'rules' | 'outbox' | 'audit' | 'simulator'>('rules');

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Rule Modal & Actions state
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<{ id: number; ruleCode: string; nameFa: string } | null>(null);
  const [newRule, setNewRule] = useState({
    ruleCode: '',
    nameFa: '',
    nameEn: '',
    descriptionFa: '',
    eventType: 'incident.reported',
    sourceModule: 'all',
    priority: 5,
    conditionField: 'severity',
    conditionOperator: 'in',
    conditionValue: 'CRITICAL, MAJOR',
    actionType: 'notification',
    actionTitle: 'اعلان خودکار ایمنی',
    actionBody: 'رویداد بحرانی شناسایی شد.',
    actionTargetRole: 'HSE_MANAGER',
  });

  // Simulator state
  const [simEventType, setSimEventType] = useState('incident.reported');
  const [simSeverity, setSimSeverity] = useState('CRITICAL');
  const [simPermitType, setSimPermitType] = useState('HOT_WORK');
  const [simHeatLevel, setSimHeatLevel] = useState('DANGER');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<ExecutionLog | null>(null);

  // Fetch all rules
  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/automation/rules');
      if (res.ok) {
        const json = await res.json();
        setRules(json.data || []);
      }
    } catch {
      // Ignore network errors in local preview
    }
  }, []);

  // Fetch Outbox Queue
  const fetchOutbox = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/automation/outbox');
      if (res.ok) {
        const json = await res.json();
        setQueueStats(json.data || null);
      }
    } catch {
      // Handled
    }
  }, []);

  // Fetch Execution Audit Logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/automation/logs?limit=50');
      if (res.ok) {
        const json = await res.json();
        setExecutionLogs(json.data || []);
      }
    } catch {
      // Handled
    }
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchRules(), fetchOutbox(), fetchLogs()]);
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRules(), fetchOutbox(), fetchLogs()]).finally(() => {
      setLoading(false);
    });

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchOutbox();
      if (activeTab === 'audit') fetchLogs();
    }, 15000);

    return () => clearInterval(interval);
  }, [fetchRules, fetchOutbox, fetchLogs, activeTab]);

  // Toggle rule status
  const handleToggleRule = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/automation/rules/${id}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        toast.success(isFa ? 'وضعیت قانون تغییر یافت.' : 'Rule status updated.');
        await fetchRules();
      } else {
        toast.error(isFa ? 'خطا در تغییر وضعیت قانون.' : 'Failed to update rule.');
      }
    } catch {
      toast.error(isFa ? 'خطای شبکه.' : 'Network error.');
    }
  };

  // Retry outbox item
  const handleRetryOutbox = async (outboxId: number) => {
    try {
      const res = await fetch(`/api/v1/automation/outbox/${outboxId}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        toast.success(isFa ? 'رویداد به صف پردازش مجدد منتقل شد.' : 'Event queued for retry.');
        await fetchOutbox();
        await fetchLogs();
      }
    } catch {
      toast.error(isFa ? 'خطا در تلاش مجدد.' : 'Failed to retry.');
    }
  };

  const resetForm = () => {
    setNewRule({
      ruleCode: '',
      nameFa: '',
      nameEn: '',
      descriptionFa: '',
      eventType: 'incident.reported',
      sourceModule: 'all',
      priority: 5,
      conditionField: 'severity',
      conditionOperator: 'in',
      conditionValue: 'CRITICAL, MAJOR',
      actionType: 'notification',
      actionTitle: 'اعلان خودکار ایمنی',
      actionBody: 'رویداد بحرانی شناسایی شد.',
      actionTargetRole: 'HSE_MANAGER',
    });
  };

  const handleOpenCreateModal = () => {
    setEditingRuleId(null);
    resetForm();
    setIsNewRuleModalOpen(true);
  };

  const handleOpenEditModal = (rule: AutomationRule) => {
    setEditingRuleId(rule.id);
    const cond = Array.isArray(rule.conditions) && rule.conditions.length > 0 ? rule.conditions[0] : null;
    const act = Array.isArray(rule.actions) && rule.actions.length > 0 ? rule.actions[0] : null;
    const condVal = cond
      ? Array.isArray(cond.value)
        ? cond.value.join(', ')
        : typeof cond.value === 'object'
          ? JSON.stringify(cond.value)
          : String(cond.value ?? '')
      : '';

    setNewRule({
      ruleCode: rule.ruleCode,
      nameFa: rule.nameFa,
      nameEn: rule.nameEn || rule.nameFa,
      descriptionFa: rule.descriptionFa || '',
      eventType: rule.eventType,
      sourceModule: rule.sourceModule || 'all',
      priority: rule.priority || 5,
      conditionField: cond?.field || 'severity',
      conditionOperator: (cond?.operator as any) || 'in',
      conditionValue: condVal,
      actionType: act?.type || 'notification',
      actionTitle: act?.config?.title || act?.config?.taskTitle || 'اعلان خودکار ایمنی',
      actionBody: act?.config?.body || act?.config?.message || '',
      actionTargetRole: act?.config?.targetRole || 'HSE_MANAGER',
    });
    setIsNewRuleModalOpen(true);
  };

  // Delete rule
  const handleDeleteRule = async (ruleId: number) => {
    try {
      const res = await fetch(`/api/v1/automation/rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(isFa ? 'قانون اتوماسیون با موفقیت حذف گردید.' : 'Rule deleted successfully.');
        setDeleteConfirmRule(null);
        await fetchRules();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || (isFa ? 'خطا در حذف قانون.' : 'Failed to delete rule.'));
      }
    } catch {
      toast.error(isFa ? 'خطای شبکه در ارتباط با سرور.' : 'Network error.');
    }
  };

  // Create or Update rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.ruleCode || !newRule.nameFa) {
      toast.error(isFa ? 'لطفاً فیلدهای الزامی را پر کنید.' : 'Please fill required fields.');
      return;
    }

    try {
      const parsedValues = newRule.conditionValue
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const conditions = [
        {
          field: newRule.conditionField,
          operator: newRule.conditionOperator,
          value: newRule.conditionOperator === 'in' ? parsedValues : newRule.conditionValue,
        },
      ];

      const actions = [
        {
          type: newRule.actionType,
          config: {
            title: newRule.actionTitle,
            body: newRule.actionBody,
            targetRole: newRule.actionTargetRole,
            priority: 'high',
          },
        },
      ];

      const url = editingRuleId
        ? `/api/v1/automation/rules/${editingRuleId}`
        : '/api/v1/automation/rules';
      const method = editingRuleId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleCode: newRule.ruleCode,
          nameFa: newRule.nameFa,
          nameEn: newRule.nameEn || newRule.nameFa,
          descriptionFa: newRule.descriptionFa,
          eventType: newRule.eventType,
          sourceModule: newRule.sourceModule,
          priority: Number(newRule.priority),
          conditions,
          actions,
          isActive: true,
        }),
      });

      if (res.ok) {
        toast.success(
          isFa
            ? editingRuleId
              ? 'قانون اتوماسیون با موفقیت ویرایش و ذخیره شد.'
              : 'قانون اتوماسیون با موفقیت ایجاد شد.'
            : editingRuleId
              ? 'Rule updated successfully.'
              : 'Rule created successfully.'
        );
        setIsNewRuleModalOpen(false);
        setEditingRuleId(null);
        resetForm();
        await fetchRules();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || (isFa ? 'خطا در ثبت قانون.' : 'Failed to save rule.'));
      }
    } catch {
      toast.error(isFa ? 'خطای شبکه در ارتباط با سرور.' : 'Network error.');
    }
  };

  // Run test simulation
  const handleRunSimulation = async () => {
    setSimRunning(true);
    setSimResult(null);

    let payload: Record<string, any> = {};
    if (simEventType === 'incident.reported') {
      payload = {
        incidentNumber: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
        title: 'گزارش حادثه تستی در واحد الفین',
        severity: simSeverity,
        location: 'محیط عملیاتی واحد ۱',
      };
    } else if (simEventType === 'permit.status_adjusted') {
      payload = {
        permitNumber: `PTW-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        permitType: simPermitType,
        status: 'PENDING_APPROVAL',
      };
    } else if (simEventType === 'heat_stress.level_change') {
      payload = {
        stationId: 'STATION-01',
        level: simHeatLevel,
        wbgt: 32.5,
      };
    } else {
      payload = {
        priority: 'HIGH',
        category: 'SAFETY_CRITICAL',
      };
    }

    try {
      const res = await fetch('/api/v1/automation/test-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: simEventType,
          payload,
        }),
      });

      const data = await res.json();
      setSimResult(data);
      if (res.ok) {
        toast.success(isFa ? 'رویداد آزمایشی پردازش شد.' : 'Simulation dispatched & processed.');
        await fetchOutbox();
        await fetchLogs();
      } else {
        toast.error(data.message || 'خطا در اجرای تست.');
      }
    } catch {
      toast.error(isFa ? 'خطای شبکه در شبیه‌سازی.' : 'Network error.');
    } finally {
      setSimRunning(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-900/30">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-amber-500" />
            {isFa ? 'موتور اتوماسیون داخلی سامانه (Internal Automation Engine)' : 'HSECORE Internal Automation Engine'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isFa
              ? 'موتور رویدادمحور بومی با صف پایدار Transactional Outbox، پردازشگر پس‌زمینه و ثبت دقیق ممیزی (Audit Trail)'
              : 'Self-hosted event bus, transactional outbox queue, multi-condition rule evaluator, and audit logs'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span>{isFa ? 'بروزرسانی' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>{isFa ? 'تعریف قانون جدید' : 'New Rule'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'rules'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{isFa ? 'قوانین اتوماسیون' : 'Rules'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{rules.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('outbox')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'outbox'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>{isFa ? 'صف پایدار (Transactional Outbox)' : 'Outbox Queue'}</span>
          {queueStats && queueStats.counts.pending > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
              {queueStats.counts.pending}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{isFa ? 'سوابق ممیزی و اجرا (Audit Trail)' : 'Audit Trail'}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{executionLogs.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition ${
            activeTab === 'simulator'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Play className="w-4 h-4 text-emerald-500" />
          <span>{isFa ? 'شبیه‌ساز و تست قوانین' : 'Rule Simulator'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {/* Tab 1: Rules List */}
        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-5 rounded-2xl border transition-all ${
                  rule.isActive
                    ? 'bg-white dark:bg-slate-800 border-slate-200/90 dark:border-slate-700/80 shadow-xs'
                    : 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                      {rule.ruleCode}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      {isFa ? `اولویت: ${rule.priority}` : `P${rule.priority}`}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isFa ? `${rule.executionCount} اجرا` : `${rule.executionCount} runs`}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className="flex items-center gap-1.5 text-xs font-bold transition-colors text-slate-600 dark:text-slate-300"
                  >
                    <span className="text-[11px]">{rule.isActive ? (isFa ? 'فعال' : 'Active') : (isFa ? 'غیرفعال' : 'Disabled')}</span>
                    {rule.isActive ? (
                      <ToggleRight className="w-7 h-7 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-400" />
                    )}
                  </button>
                </div>

                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
                  {isFa ? rule.nameFa : rule.nameEn}
                </h4>

                {rule.descriptionFa && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{rule.descriptionFa}</p>
                )}

                {/* Event & Condition */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="w-full">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          {isFa ? 'رویداد و شرط:' : 'Trigger & Condition:'}
                        </span>
                        <span className="font-mono text-[10px] bg-slate-200/60 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                          {rule.eventType}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {Array.isArray(rule.conditions) && rule.conditions.length > 0 ? (
                          rule.conditions.map((c, i) => (
                            <div key={i}>
                              {c.field} {c.operator} {JSON.stringify(c.value)}
                            </div>
                          ))
                        ) : (
                          <span>{isFa ? 'همیشه اجرا شود (بدون شرط اختصاصی)' : 'Always execute'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-800 dark:text-emerald-300">
                        {isFa ? 'اقدام خودکار سامانه (Action):' : 'Automated Actions:'}
                      </span>
                      <div className="mt-1 space-y-1">
                        {Array.isArray(rule.actions) &&
                          rule.actions.map((a, i) => (
                            <div key={i} className="text-emerald-700/90 dark:text-emerald-400 text-[11px] flex items-center gap-1.5">
                              <span className="font-mono font-bold text-[10px] bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded">
                                {a.type}
                              </span>
                              <span>{a.config?.title || a.config?.taskTitle || JSON.stringify(a.config)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit & Delete Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-3 mt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(rule)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 font-bold transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isFa ? 'ویرایش' : 'Edit'}</span>
                    </button>

                    <button
                      onClick={() => setDeleteConfirmRule({ id: rule.id, ruleCode: rule.ruleCode, nameFa: rule.nameFa })}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-300 font-bold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isFa ? 'حذف' : 'Delete'}</span>
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono">
                    {rule.createdAt ? new Date(rule.createdAt).toLocaleDateString('fa-IR') : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Transactional Outbox Queue */}
        {activeTab === 'outbox' && (
          <div className="space-y-4">
            {/* Queue Counter Cards */}
            {queueStats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">{isFa ? 'در انتظار پردازش' : 'Pending'}</span>
                  <span className="text-xl font-black text-amber-500 mt-1 block font-mono">
                    {queueStats.counts.pending}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">{isFa ? 'در حال اجرا' : 'Processing'}</span>
                  <span className="text-xl font-black text-blue-500 mt-1 block font-mono">
                    {queueStats.counts.processing}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">{isFa ? 'تکمیل‌شده' : 'Completed'}</span>
                  <span className="text-xl font-black text-emerald-500 mt-1 block font-mono">
                    {queueStats.counts.completed}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">{isFa ? 'تلاش مجدد (Failed)' : 'Retry Queued'}</span>
                  <span className="text-xl font-black text-rose-500 mt-1 block font-mono">
                    {queueStats.counts.failed}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 block">{isFa ? 'صف خطا (Dead Letter)' : 'Dead Letter'}</span>
                  <span className="text-xl font-black text-purple-500 mt-1 block font-mono">
                    {queueStats.counts.deadLetter}
                  </span>
                </div>
              </div>
            )}

            {/* Outbox Table */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {isFa ? 'رویدادهای اخیر صف Outbox' : 'Recent Outbox Events'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {isFa ? 'قفل اتمیک: FOR UPDATE SKIP LOCKED' : 'Concurrency Control: Atomic lock'}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[500px] overflow-y-auto">
                {queueStats?.recentOutbox && queueStats.recentOutbox.length > 0 ? (
                  queueStats.recentOutbox.map((item) => (
                    <div key={item.id} className="p-3.5 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-750 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                              item.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : item.status === 'PROCESSING'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                : item.status === 'DEAD_LETTER'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                : item.status === 'FAILED'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {item.status}
                          </span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{item.eventType}</span>
                          <span className="text-[11px] text-slate-400 font-mono">ID: {item.id}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          <span>Idempotency: {item.idempotencyKey}</span>
                        </div>
                        {item.errorMessage && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                            Error: {item.errorMessage}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-slate-400 font-mono">
                          {isFa ? `تلاش: ${item.attempts}/${item.maxAttempts}` : `Attempts: ${item.attempts}/${item.maxAttempts}`}
                        </span>

                        {(item.status === 'FAILED' || item.status === 'DEAD_LETTER') && (
                          <button
                            onClick={() => handleRetryOutbox(item.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>{isFa ? 'تلاش مجدد' : 'Retry'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    {isFa ? 'هیچ رویدادی در صف Outbox وجود ندارد.' : 'No items in outbox queue.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Execution Audit Trail */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {isFa ? 'سوابق ممیزی اجرای قوانین موتور اتوماسیون' : 'Rule Execution Audit Trail'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {isFa ? 'ثبت کامل عامل، مدت زمان، شروط و اقدامات' : 'Full trace & timing'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[500px] overflow-y-auto">
              {executionLogs.length > 0 ? (
                executionLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="p-3.5 text-xs hover:bg-slate-50/50 dark:hover:bg-slate-750 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : log.status === 'SKIPPED'
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{log.ruleCode}</span>
                        <span className="text-[11px] text-slate-500 font-mono">({log.eventType})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        <span>Event: {log.eventId}</span>
                        {log.correlationKey && <span className="mx-2">Key: {log.correlationKey}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400 font-mono">
                      <span>{log.durationMs}ms</span>
                      <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                      <Eye className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  {isFa ? 'سابقه‌ای برای ممیزی اجرا ثبت نشده است.' : 'No audit execution logs recorded yet.'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Rule Simulator */}
        {activeTab === 'simulator' && (
          <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-5">
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-500" />
                <span>{isFa ? 'شبیه‌ساز زنده رویدادهای سامانه' : 'Live Domain Event Simulator'}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isFa
                  ? 'یک رویداد دامنه را شبیه‌سازی کنید تا ثبت آن در صف Outbox و نحوه ارزیابی قوانین و اجرای اکشن‌ها را بررسی فرمایید.'
                  : 'Dispatch a synthetic domain event to test rule evaluation and transactional outbox processing.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'نوع رویداد (Event Type)' : 'Event Type'}
                </label>
                <select
                  value={simEventType}
                  onChange={(e) => setSimEventType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-mono"
                >
                  <option value="incident.reported">incident.reported</option>
                  <option value="permit.status_adjusted">permit.status_adjusted</option>
                  <option value="heat_stress.level_change">heat_stress.level_change</option>
                  <option value="warning.issued">warning.issued</option>
                </select>
              </div>

              {simEventType === 'incident.reported' && (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {isFa ? 'شدت حادثه (Severity)' : 'Severity'}
                  </label>
                  <select
                    value={simSeverity}
                    onChange={(e) => setSimSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs"
                  >
                    <option value="CRITICAL">CRITICAL (بحرانی - محرک تصاعد SLA)</option>
                    <option value="MAJOR">MAJOR (عمده)</option>
                    <option value="MODERATE">MODERATE (متوسط)</option>
                    <option value="MINOR">MINOR (جزئی)</option>
                  </select>
                </div>
              )}

              {simEventType === 'permit.status_adjusted' && (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {isFa ? 'نوع پروانه (Permit Type)' : 'Permit Type'}
                  </label>
                  <select
                    value={simPermitType}
                    onChange={(e) => setSimPermitType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs"
                  >
                    <option value="HOT_WORK">HOT_WORK (کار گرم - ارجاع آتش‌نشانی)</option>
                    <option value="CONFINED_SPACE">CONFINED_SPACE (فضای بسته)</option>
                    <option value="COLD_WORK">COLD_WORK (کار سرد)</option>
                  </select>
                </div>
              )}

              {simEventType === 'heat_stress.level_change' && (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {isFa ? 'سطح استرس گرمایی' : 'Heat Stress Level'}
                  </label>
                  <select
                    value={simHeatLevel}
                    onChange={(e) => setSimHeatLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs"
                  >
                    <option value="DANGER">DANGER (خطرناک - هشدار فوری)</option>
                    <option value="EXTREME_DANGER">EXTREME_DANGER (بسیار خطرناک)</option>
                    <option value="CAUTION">CAUTION (احتیاط)</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <button
                onClick={handleRunSimulation}
                disabled={simRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>{simRunning ? (isFa ? 'در حال ارسال و ارزیابی...' : 'Dispatching...') : (isFa ? 'انتشار و پردازش رویداد آزمایشی' : 'Dispatch Test Event')}</span>
              </button>
            </div>

            {simResult && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                  <Check className="w-4 h-4" />
                  <span>{simResult.message}</span>
                </div>
                <pre className="text-[11px] overflow-x-auto text-slate-600 dark:text-slate-300">
                  {JSON.stringify(simResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal for Log */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                {selectedLog.ruleCode} - Execution Details
              </h4>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-bold">Status:</span> {selectedLog.status}
              </div>
              <div>
                <span className="font-bold">Event ID:</span> {selectedLog.eventId}
              </div>
              <div>
                <span className="font-bold">Duration:</span> {selectedLog.durationMs}ms
              </div>
              {selectedLog.errorMessage && (
                <div className="text-rose-500 font-bold">
                  Error: {selectedLog.errorMessage}
                </div>
              )}

              <div>
                <span className="font-bold block mb-1">Evaluations:</span>
                <pre className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(selectedLog.conditionDetails, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-bold block mb-1">Actions Executed:</span>
                <pre className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 font-mono text-[10px] overflow-x-auto">
                  {JSON.stringify(selectedLog.actionsExecuted, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Rule Modal */}
      {isNewRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRule}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {editingRuleId
                  ? isFa
                    ? 'ویرایش قانون اتوماسیون'
                    : 'Edit Automation Rule'
                  : isFa
                    ? 'تعریف قانون اتوماسیون جدید'
                    : 'Create Automation Rule'}
              </h4>
              <button
                type="button"
                onClick={() => {
                  setIsNewRuleModalOpen(false);
                  setEditingRuleId(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'کد قانون (Rule Code) *' : 'Rule Code *'}
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingRuleId)}
                  placeholder="RULE-07"
                  value={newRule.ruleCode}
                  onChange={(e) => setNewRule({ ...newRule, ruleCode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl disabled:opacity-50 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'رویداد محرک (Event Type) *' : 'Event Type *'}
                </label>
                <select
                  value={newRule.eventType}
                  onChange={(e) => setNewRule({ ...newRule, eventType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono"
                >
                  <option value="incident.reported">incident.reported</option>
                  <option value="permit.status_adjusted">permit.status_adjusted</option>
                  <option value="heat_stress.level_change">heat_stress.level_change</option>
                  <option value="warning.issued">warning.issued</option>
                  <option value="all">all (همگانی)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'عنوان قانون (فارسی) *' : 'Rule Title (FA) *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: ارجاع فوری اخطارهای بحرانی"
                  value={newRule.nameFa}
                  onChange={(e) => setNewRule({ ...newRule, nameFa: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                />
              </div>

              <div className="col-span-2">
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'توضیحات قانون' : 'Description'}
                </label>
                <textarea
                  rows={2}
                  value={newRule.descriptionFa}
                  onChange={(e) => setNewRule({ ...newRule, descriptionFa: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'فیلد شرط' : 'Condition Field'}
                </label>
                <input
                  type="text"
                  value={newRule.conditionField}
                  onChange={(e) => setNewRule({ ...newRule, conditionField: e.target.value })}
                  placeholder="severity, permitType, etc."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'عملگر شرط' : 'Operator'}
                </label>
                <select
                  value={newRule.conditionOperator}
                  onChange={(e) => setNewRule({ ...newRule, conditionOperator: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono"
                >
                  <option value="in">in (عضو لیست)</option>
                  <option value="eq">eq (برابر با)</option>
                  <option value="neq">neq (نابرابر)</option>
                  <option value="contains">contains (شامل متن)</option>
                  <option value="gt">gt (بزرگتر از)</option>
                  <option value="gte">gte (بزرگتر مساوی)</option>
                  <option value="always">always (همیشه)</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'مقادیر هدف شرط (با کاما جدا شود)' : 'Condition Value'}
                </label>
                <input
                  type="text"
                  value={newRule.conditionValue}
                  onChange={(e) => setNewRule({ ...newRule, conditionValue: e.target.value })}
                  placeholder="CRITICAL, MAJOR, FATAL"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'نوع اقدام (Action)' : 'Action Type'}
                </label>
                <select
                  value={newRule.actionType}
                  onChange={(e) => setNewRule({ ...newRule, actionType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono"
                >
                  <option value="notification">notification (اعلان سامانه)</option>
                  <option value="cartable_task">cartable_task (تسک کارتابل)</option>
                  <option value="escalation">escalation (تصاعد SLA)</option>
                  <option value="audit_log">audit_log (ثبت لاگ ممیزی)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {isFa ? 'نقش هدف (Target Role)' : 'Target Role'}
                </label>
                <select
                  value={newRule.actionTargetRole}
                  onChange={(e) => setNewRule({ ...newRule, actionTargetRole: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-mono"
                >
                  <option value="HSE_MANAGER">HSE_MANAGER</option>
                  <option value="FIRE_CHIEF">FIRE_CHIEF</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="HSE_OFFICER">HSE_OFFICER</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsNewRuleModalOpen(false);
                  setEditingRuleId(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm cursor-pointer"
              >
                {editingRuleId
                  ? isFa
                    ? 'ذخیره تغییرات قانون'
                    : 'Update Rule'
                  : isFa
                    ? 'ثبت و ذخیره قانون'
                    : 'Save Rule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Rule Confirmation Modal */}
      {deleteConfirmRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {isFa ? 'تأیید حذف قانون اتوماسیون' : 'Confirm Rule Deletion'}
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isFa
                ? `آیا از حذف قانون اتوماسیون «${deleteConfirmRule.nameFa}» (کد: ${deleteConfirmRule.ruleCode}) اطمینان دارید؟ این عملیات قابل بازگشت نیست.`
                : `Are you sure you want to delete rule "${deleteConfirmRule.nameFa}" (${deleteConfirmRule.ruleCode})?`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDeleteConfirmRule(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRule(deleteConfirmRule.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition cursor-pointer"
              >
                {isFa ? 'حذف قطعی قانون' : 'Delete Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
