import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, LayoutDashboard
} from 'lucide-react';
import { OperationalSafetyInspection, SafetyChecklistTypeTemplate } from './types';
import { safetyDeptService } from './services/safetyDeptService';
import SafetyOverviewDashboard from './components/SafetyOverviewDashboard';
import OperationalChecklistsView from './components/OperationalChecklistsView';
import { SubViewTransition } from '../../motion';

interface Props {
  isFa?: boolean;
  currentUser?: any;
}

export default function SafetyUnitModule({ isFa = true, currentUser }: Props) {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [inspections, setInspections] = useState<OperationalSafetyInspection[]>([]);
  const [templates, setTemplates] = useState<SafetyChecklistTypeTemplate[]>([]);
  const [selectedAuditForView, setSelectedAuditForView] = useState<OperationalSafetyInspection | null>(null);
  const [reinspectAuditForTrigger, setReinspectAuditForTrigger] = useState<OperationalSafetyInspection | null>(null);
  const [scheduleFilterForChecklists, setScheduleFilterForChecklists] = useState<string>('ALL');

  // Load data & handle cross-module subtab navigation
  useEffect(() => {
    const refreshData = () => {
      setInspections(safetyDeptService.getAllInspections());
      setTemplates(safetyDeptService.getAllTemplates());
    };

    const handleSubTabNav = (ev: Event) => {
      const detail = (ev as CustomEvent<{ moduleKey?: string; subTabKey?: string }>).detail;
      if (detail?.moduleKey === 'safety-unit' && detail.subTabKey) {
        setActiveTab(detail.subTabKey);
      }
    };

    refreshData();
    window.addEventListener('hse_safety_inspections_updated', refreshData);
    window.addEventListener('hse_safety_templates_updated', refreshData);
    window.addEventListener('hse-navigate-subtab', handleSubTabNav as EventListener);

    return () => {
      window.removeEventListener('hse_safety_inspections_updated', refreshData);
      window.removeEventListener('hse_safety_templates_updated', refreshData);
      window.removeEventListener('hse-navigate-subtab', handleSubTabNav as EventListener);
    };
  }, []);

  const handleSaveInspection = (inspectionData: Partial<OperationalSafetyInspection>) => {
    safetyDeptService.saveInspection(inspectionData, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
  };

  const handleDeleteInspection = (id: string) => {
    safetyDeptService.deleteInspection(id, currentUser?.fullName || currentUser?.username || 'کارشناس ایمنی');
  };

  const handleNewInspectionFromDashboard = (_templateId?: string) => {
    setSelectedAuditForView(null);
    setReinspectAuditForTrigger(null);
    setScheduleFilterForChecklists('ALL');
    setActiveTab('checklists'); // Redirect to checklists
  };

  const handleViewInspectionFromDashboard = (inspection: OperationalSafetyInspection) => {
    setSelectedAuditForView(inspection);
    setReinspectAuditForTrigger(null);
    setActiveTab('checklists');
  };

  const handleReinspectFromDashboard = (inspection: OperationalSafetyInspection) => {
    setSelectedAuditForView(null);
    setReinspectAuditForTrigger(inspection);
    setScheduleFilterForChecklists('ALL');
    setActiveTab('checklists');
  };

  const handleNavigateToChecklistsWithFilter = (scheduleStatus?: string) => {
    setSelectedAuditForView(null);
    setReinspectAuditForTrigger(null);
    setScheduleFilterForChecklists(scheduleStatus || 'ALL');
    setActiveTab('checklists');
  };

  const subMenuItems = [
    { key: 'dashboard', titleFa: 'داشبورد واحد ایمنی', titleEn: 'Overview Dashboard', icon: LayoutDashboard },
    { key: 'checklists', titleFa: 'سوابق و اجرای بازرسی', titleEn: 'Execution & History', icon: CheckSquare },
  ];

  return (
    <div className="space-y-6" id="safety-unit-root">
      {/* Sub-Header & Navigation Tabs */}
      <div className="bg-white dark:bg-slate-800 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
          {subMenuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  if (item.key === 'dashboard') {
                    setSelectedAuditForView(null);
                    setReinspectAuditForTrigger(null);
                  }
                }}
                className={`hse-motion-tab flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-bold'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{isFa ? item.titleFa : item.titleEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main View Render */}
      <SubViewTransition viewKey={activeTab} isFa={isFa}>
        {activeTab === 'dashboard' ? (
          <SafetyOverviewDashboard
            inspections={inspections}
            templates={templates}
            onNewInspection={handleNewInspectionFromDashboard}
            onViewInspection={handleViewInspectionFromDashboard}
            onReinspectInspection={handleReinspectFromDashboard}
            onNavigateToChecklists={handleNavigateToChecklistsWithFilter}
            isFa={isFa}
          />
        ) : (
          <OperationalChecklistsView
            inspections={inspections}
            templates={templates}
            selectedTemplateId={undefined}
            initialScheduleStatus={scheduleFilterForChecklists}
            selectedAudit={selectedAuditForView}
            initialReinspectAudit={reinspectAuditForTrigger}
            onSaveInspection={handleSaveInspection}
            onDeleteInspection={handleDeleteInspection}
            currentUser={currentUser}
            isFa={isFa}
          />
        )}
      </SubViewTransition>
    </div>
  );
}
