import React, { useState, useEffect } from 'react';
import {
  Workflow,
  ClipboardList,
  PenTool,
  Activity,
  Zap,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import axios from 'axios';
import ProcessCatalog from './ProcessCatalog';
import MyTasks from './MyTasks';
import LiveWorkflowTracker from './LiveWorkflowTracker';
import WorkflowAutomationRules from './WorkflowAutomationRules';
import { ProcessStats } from './types';

const ProcessDesigner = React.lazy(() => import('./ProcessDesigner'));

interface Props {
  language: 'fa' | 'en';
}

export default function ProcessManagementModule({ language }: Props) {
  const isFa = language === 'fa';
  const [activeTab, setActiveTab] = useState<'catalog' | 'tasks' | 'tracker' | 'designer' | 'rules'>('catalog');
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [highlightInstanceId, setHighlightInstanceId] = useState<string | null>(null);
  const [stats, setStats] = useState<ProcessStats>({
    totalWorkflows: 37,
    activeInstances: 0,
    completedInstances: 0,
    rejectedInstances: 0,
    pendingTasks: 0,
    criticalTasks: 0,
    slaCompliance: 98.2,
    categories: {}
  });

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/v1/process-management/stats');
      if (res.data.success && res.data.data) {
        setStats(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStats();

    const handleRemoteMutation = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('process') || entity.includes('workflow') || entity.includes('task') || entity.includes('bpmn')) {
        fetchStats();
      }
    };

    window.addEventListener('hse_process_management_updated', fetchStats);
    window.addEventListener('hse_workflows_updated', fetchStats);
    window.addEventListener('hse_tasks_updated', fetchStats);
    window.addEventListener('app_data_mutated', handleRemoteMutation);
    window.addEventListener('hse_data_mutated', handleRemoteMutation);

    return () => {
      window.removeEventListener('hse_process_management_updated', fetchStats);
      window.removeEventListener('hse_workflows_updated', fetchStats);
      window.removeEventListener('hse_tasks_updated', fetchStats);
      window.removeEventListener('app_data_mutated', handleRemoteMutation);
      window.removeEventListener('hse_data_mutated', handleRemoteMutation);
    };
  }, []);

  const handleEditWorkflow = (id: string) => {
    setEditingWorkflowId(id);
    setActiveTab('designer');
  };

  const handleViewTracker = (instanceId?: string) => {
    if (instanceId) {
      setHighlightInstanceId(instanceId);
    }
    setActiveTab('tracker');
  };

  const handleTabChange = (tabId: any) => {
    if (tabId !== 'designer') {
      setEditingWorkflowId(null);
    }
    setActiveTab(tabId);
  };

  interface TabItem {
    id: 'catalog' | 'tasks' | 'tracker' | 'designer' | 'rules';
    icon: React.ComponentType<{ className?: string }>;
    labelFa: string;
    labelEn: string;
    badge?: number;
    badgeColor?: string;
  }

  const tabs: TabItem[] = [
    {
      id: 'catalog',
      icon: Layers,
      labelFa: 'کاتالوگ فرآیندهای HSE',
      labelEn: 'Process Directory',
      badge: stats.totalWorkflows
    },
    {
      id: 'tasks',
      icon: ClipboardList,
      labelFa: 'کارتابل هوشمند و تاییدات',
      labelEn: 'Smart Tasklist',
      badge: stats.pendingTasks,
      badgeColor: stats.criticalTasks > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
    },
    {
      id: 'tracker',
      icon: Activity,
      labelFa: 'رهگیری زنده پرونده‌ها',
      labelEn: 'Live Execution Tracker',
      badge: stats.activeInstances,
      badgeColor: 'bg-emerald-500 text-white'
    },
    {
      id: 'designer',
      icon: PenTool,
      labelFa: 'استودیو طراح فرآیند (BPMN)',
      labelEn: 'BPMN Studio'
    },
    {
      id: 'rules',
      icon: Zap,
      labelFa: 'قوانین اتوماسیون و SLA',
      labelEn: 'Automation & SLA'
    }
  ];

  return (
    <div className={`flex flex-col ${activeTab === 'designer' ? 'h-[calc(100dvh-8.5rem)] min-h-[580px]' : 'min-h-[580px] lg:h-[calc(100dvh-8.5rem)]'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-hidden lg:overflow-hidden`}>
      {/* Top System Summary KPIs Strip */}
      {activeTab !== 'designer' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'فرآیندهای استاندارد فعال' : 'Active Workflows'}
            </span>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
              {stats.totalWorkflows} {isFa ? 'ماژول' : 'Modules'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'گردش‌کارهای در جریان در سایت' : 'Running Instances'}
            </span>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
              {stats.activeInstances} {isFa ? 'پرونده' : 'Cases'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'وظایف منتظر اقدام کارتابل' : 'Pending Tasks'}
            </span>
            <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono flex items-center gap-2">
              <span>{stats.pendingTasks}</span>
              {stats.criticalTasks > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-600 font-bold">
                  {stats.criticalTasks} {isFa ? 'فوری' : 'urgent'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isFa ? 'نرخ انطباق زمانی (SLA Compliance)' : 'SLA Compliance'}
            </span>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.slaCompliance}%
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Module Navigation Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 dark:hover:text-slate-300 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>{isFa ? tab.labelFa : tab.labelEn}</span>
              {tab.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  tab.badgeColor || (isActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400')
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        {activeTab === 'catalog' && (
          <ProcessCatalog
            language={language}
            onEdit={handleEditWorkflow}
            onViewTracker={handleViewTracker}
            onRefreshStats={fetchStats}
          />
        )}
        {activeTab === 'tasks' && (
          <MyTasks
            language={language}
            onRefreshStats={fetchStats}
          />
        )}
        {activeTab === 'tracker' && (
          <LiveWorkflowTracker
            language={language}
            highlightInstanceId={highlightInstanceId}
            onRefreshStats={fetchStats}
          />
        )}
        {activeTab === 'designer' && (
          <React.Suspense fallback={
            <div className="flex items-center justify-center p-12 text-center text-xs font-bold text-slate-400">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
              {isFa ? 'در حال آماده‌سازی ویرایشگر گرافیکی BPMN...' : 'Loading BPMN Designer...'}
            </div>
          }>
            <ProcessDesigner
              language={language}
              workflowId={editingWorkflowId}
              onSaved={() => {
                fetchStats();
                handleTabChange('catalog');
              }}
            />
          </React.Suspense>
        )}
        {activeTab === 'rules' && (
          <WorkflowAutomationRules
            language={language}
          />
        )}
      </div>
    </div>
  );
}
