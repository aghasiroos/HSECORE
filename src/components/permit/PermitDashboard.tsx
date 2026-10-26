import React, { useState } from 'react';
import {
  Flame,
  Snowflake,
  Shovel,
  Box,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Pause,
  FileText
} from 'lucide-react';
import { WorkPermit, PermitCategory, PermitWorkflowStatus, UserProfile, InspectionCycle } from '../../types';
import { PermitDataGrid } from './PermitDataGrid';
import { PermitDetailDrawer } from './PermitDetailDrawer';
import { PermitReInspectionModal } from './PermitReInspectionModal';
import { PermitMasterPrintModal } from './PermitMasterPrintModal';
import { PermitFormMain } from './PermitFormMain';
import { PermitFormSupplementary } from './PermitFormSupplementary';
import { PermitAuditModal } from './PermitAuditModal';
import { CreateReferralModal } from '../referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from '../referral/DocumentWorkflowTrackerModal';

interface PermitDashboardProps {
  permits: WorkPermit[];
  isFa: boolean;
  currentUser: UserProfile;
  onUpdatePermit: (updatedPermit: WorkPermit, actionMessage?: string) => void;
  onNewPermitClick: (category?: PermitCategory) => void;
  onDeletePermit: (permitId: string) => void;
  onOpenFieldManager?: () => void;
}

export const PermitDashboard: React.FC<PermitDashboardProps> = ({
  permits,
  isFa,
  currentUser,
  onUpdatePermit,
  onNewPermitClick,
  onDeletePermit,
  onOpenFieldManager
}) => {
  // Selected permit for detail drawer & initial tab
  const [selectedPermit, setSelectedPermit] = useState<WorkPermit | null>(null);
  const [drawerTab, setDrawerTab] = useState<'details' | 'inspection' | 'audit'>('details');

  // Full form View & Edit mode states (Displaying the exact same registration form for view and edit)
  const [viewingPermit, setViewingPermit] = useState<WorkPermit | null>(null);
  const [editingPermit, setEditingPermit] = useState<WorkPermit | null>(null);

  // Modals state
  const [auditModalPermit, setAuditModalPermit] = useState<WorkPermit | null>(null);
  const [reInspectPermit, setReInspectPermit] = useState<WorkPermit | null>(null);
  const [printPermit, setPrintPermit] = useState<WorkPermit | null>(null);
  const [referralPermit, setReferralPermit] = useState<WorkPermit | null>(null);
  const [workflowTrackerPermit, setWorkflowTrackerPermit] = useState<WorkPermit | null>(null);
  const [unauthorizedEditPermitId, setUnauthorizedEditPermitId] = useState<string | null>(null);

  // Status & Category KPI metrics
  const activeCount = permits.filter(p => p.status === 'Active' || p.status === 'Issued').length;
  const draftCount = permits.filter(p => p.status === 'Draft').length;
  const pendingCount = permits.filter(p => p.status === 'Requested' || p.status === 'RiskAssessment' || p.status === 'HSEReview' || p.status === 'Approved' || p.status === 'Awaiting Approval').length;
  const suspendedCount = permits.filter(p => p.status === 'Suspended').length;
  const closedCount = permits.filter(p => p.status === 'Closed' || p.status === 'Finished').length;

  const hotCount = permits.filter(p => p.permitCategory === 'Hot').length;
  const coldCount = permits.filter(p => p.permitCategory === 'Cold').length;
  const excavationCount = permits.filter(p => p.permitCategory === 'Excavation').length;
  const confinedCount = permits.filter(p => p.permitCategory === 'ConfinedSpace').length;

  // Handle workflow status transitions
  const handleWorkflowUpdate = (
    newStatus: PermitWorkflowStatus,
    actionName: string,
    details: string,
    extraData?: Partial<WorkPermit>
  ) => {
    if (!selectedPermit) return;

    const now = new Date();
    const jalaliTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const jalaliDateStr = `${selectedPermit.year}/${selectedPermit.month}/${selectedPermit.day} ${jalaliTime}`;

    const newAudit = {
      id: `aud-${Date.now()}`,
      user: currentUser.fullName || currentUser.username,
      userRole: currentUser.role,
      timestamp: now.toISOString(),
      persianDateTime: jalaliDateStr,
      action: actionName,
      fieldName: 'status',
      oldValue: selectedPermit.status,
      newValue: newStatus,
      details,
      version: (selectedPermit.version || 1) + 1
    };

    const updated: WorkPermit = {
      ...selectedPermit,
      ...extraData,
      status: newStatus,
      updatedDate: now.toISOString(),
      version: (selectedPermit.version || 1) + 1,
      auditLogs: [...(selectedPermit.auditLogs || []), newAudit]
    };

    onUpdatePermit(updated, actionName);
    setSelectedPermit(updated);
  };

  // Handle saving a new inspection cycle
  const handleSaveInspectionCycle = (newCycle: InspectionCycle, updatedFields: Partial<WorkPermit>) => {
    const targetPermit = reInspectPermit || selectedPermit;
    if (!targetPermit) return;

    const now = new Date();
    const jalaliTime = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const jalaliDateStr = `${targetPermit.year}/${targetPermit.month}/${targetPermit.day} ${jalaliTime}`;

    const newAudit = {
      id: `aud-${Date.now()}`,
      user: newCycle.inspectorName,
      userRole: newCycle.inspectorRole,
      timestamp: now.toISOString(),
      persianDateTime: jalaliDateStr,
      action: `ثبت دوره بازرسی مجدد (دوره #${newCycle.cycleNumber})`,
      fieldName: 'inspectionCycle',
      oldValue: `دوره ${targetPermit.currentInspectionCycle || 1}`,
      newValue: `دوره ${newCycle.cycleNumber} (${newCycle.status})`,
      details: `نتیجه: ${newCycle.status === 'Approved' ? 'تأیید' : newCycle.status === 'Conditional' ? 'مشروط' : 'رد صلاحیت'}. ${newCycle.findings}`,
      version: (targetPermit.version || 1) + 1
    };

    const updated: WorkPermit = {
      ...targetPermit,
      ...updatedFields,
      updatedDate: now.toISOString(),
      version: (targetPermit.version || 1) + 1,
      auditLogs: [...(targetPermit.auditLogs || []), newAudit]
    };

    onUpdatePermit(updated, `ثبت دوره بازرسی مجدد #${newCycle.cycleNumber}`);
    if (selectedPermit?.id === updated.id) {
      setSelectedPermit(updated);
    }
    setReInspectPermit(null);
  };

  // Handle Edit Permit (Admin Only enforcement, or completing Drafts)
  const handleEditPermit = (permit: WorkPermit) => {
    if (currentUser.role !== 'Administrator' && permit.status !== 'Draft') {
      setUnauthorizedEditPermitId(permit.id);
      return;
    }
    setSelectedPermit(null);
    setEditingPermit(permit);
  };

  const handleSavePermit = (updatedPermit: WorkPermit) => {
    const isDraft = updatedPermit.status === 'Draft';
    const actionLabel = isDraft
      ? `ذخیره پیش‌نویس پروانه کار ${updatedPermit.serialNumber}`
      : (editingPermit?.status === 'Draft'
          ? `تکمیل و صدور رسمی پروانه کار ${updatedPermit.serialNumber}`
          : `ویرایش اطلاعات پروانه کار ${updatedPermit.serialNumber}`);

    onUpdatePermit(updatedPermit, actionLabel);
    if (selectedPermit && selectedPermit.id === updatedPermit.id) {
      setSelectedPermit(updatedPermit);
    }
    if (viewingPermit && viewingPermit.id === updatedPermit.id) {
      setViewingPermit(updatedPermit);
    }
    setEditingPermit(null);
  };

  // If viewing a permit, display the EXACT registered main permit form as requested:
  // "بعد از زدن روي ريف پروانه كار جهت نمايش ان ، فرم پروانه كار اصلي ثبت شده نمايش داده شود"
  if (viewingPermit) {
    const p = viewingPermit;
    const isHot = p.permitCategory === 'Hot' || (!p.permitCategory && p.permitType === 'Hot');
    const isCold = p.permitCategory === 'Cold' || (!p.permitCategory && p.permitType === 'Cold');

    if (isHot || isCold) {
      return (
        <PermitFormMain
          permitType={isHot ? 'Hot' : 'Cold'}
          currentUser={currentUser}
          isFa={isFa}
          initialPermit={p}
          mode="view"
          onSave={handleSavePermit}
          onCancel={() => setViewingPermit(null)}
        />
      );
    } else {
      return (
        <PermitFormSupplementary
          category={(p.permitCategory as PermitCategory) || 'Excavation'}
          currentUser={currentUser}
          isFa={isFa}
          initialPermit={p}
          mode="view"
          onSave={handleSavePermit}
          onCancel={() => setViewingPermit(null)}
        />
      );
    }
  }

  // If editing a permit, display the EXACT registration form as requested:
  // "براي ويرايش پروانه كار دقيقا همان فرم پروانه كاري كه در ثبت پروانه ك ميباشد نمايش داده شود"
  if (editingPermit) {
    const p = editingPermit;
    const isHot = p.permitCategory === 'Hot' || (!p.permitCategory && p.permitType === 'Hot');
    const isCold = p.permitCategory === 'Cold' || (!p.permitCategory && p.permitType === 'Cold');

    if (isHot || isCold) {
      return (
        <PermitFormMain
          permitType={isHot ? 'Hot' : 'Cold'}
          currentUser={currentUser}
          isFa={isFa}
          initialPermit={p}
          mode="edit"
          onSave={handleSavePermit}
          onCancel={() => setEditingPermit(null)}
        />
      );
    } else {
      return (
        <PermitFormSupplementary
          category={(p.permitCategory as PermitCategory) || 'Excavation'}
          currentUser={currentUser}
          isFa={isFa}
          initialPermit={p}
          mode="edit"
          onSave={handleSavePermit}
          onCancel={() => setEditingPermit(null)}
        />
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* High-Level Enterprise PTW Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3">
        {/* Active Permits */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">پروانه‌های فعال</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono">{activeCount}</div>
        </div>

        {/* Draft Permits (Pending Completion) */}
        <div className="bg-amber-50/70 dark:bg-amber-950/30 p-3.5 rounded-2xl border-2 border-amber-300/80 dark:border-amber-800/80 shadow-sm flex flex-col justify-between hover:border-amber-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1">
              پیش‌نویس‌ها
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
            </span>
            <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-2 font-mono">{draftCount}</div>
        </div>

        {/* Pending Review */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">در انتظار بررسی/تأیید</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2 font-mono">{pendingCount}</div>
        </div>

        {/* Suspended (Stop Work) */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-rose-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تعلیق شده (توقف)</span>
            <Pause className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2 font-mono">{suspendedCount}</div>
        </div>

        {/* Closed & Handed over */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-slate-400 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">بسته و تحویل شده</span>
            <CheckCircle2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-2 font-mono">{closedCount}</div>
        </div>

        {/* Hot Work */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">کار گرم</span>
            <Flame className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">{hotCount}</div>
        </div>

        {/* Cold Work */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">کار سرد</span>
            <Snowflake className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">{coldCount}</div>
        </div>

        {/* Excavation */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">حفاری</span>
            <Shovel className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">{excavationCount}</div>
        </div>

        {/* Confined Space */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">فضای بسته</span>
            <Box className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2 font-mono">{confinedCount}</div>
        </div>
      </div>

      {/* Main Professional DataGrid with Search, Multi-Filters, Export, Actions */}
      <PermitDataGrid
        permits={permits}
        currentUser={currentUser}
        isFa={isFa}
        onSelectPermit={(p, tab) => {
          if (tab === 'audit') {
            setAuditModalPermit(p);
          } else if (tab === 'inspection') {
            setSelectedPermit(p);
            setDrawerTab('inspection');
          } else {
            setViewingPermit(p);
          }
        }}
        onEditPermit={handleEditPermit}
        onUnauthorizedEdit={(id) => setUnauthorizedEditPermitId(id)}
        onOpenAuditLogs={(p) => setAuditModalPermit(p)}
        onOpenPrintModal={(p) => setPrintPermit(p)}
        onOpenReferral={(p) => setReferralPermit(p)}
        onOpenWorkflowTracker={(p) => setWorkflowTrackerPermit(p)}
        onDeletePermit={onDeletePermit}
        onNewPermit={() => onNewPermitClick('Hot')}
        onOpenFieldManager={onOpenFieldManager}
      />

      {/* Slide-over Detail Drawer (Used for inspection cycles and workflow status transitions) */}
      {selectedPermit && (
        <PermitDetailDrawer
          permit={selectedPermit}
          currentUser={currentUser}
          isFa={isFa}
          initialTab={drawerTab}
          onClose={() => setSelectedPermit(null)}
          onUpdateStatus={handleWorkflowUpdate}
          onOpenPrintModal={() => setPrintPermit(selectedPermit)}
          onOpenReferral={(p) => setReferralPermit(p)}
          onOpenWorkflowTracker={(p) => setWorkflowTrackerPermit(p)}
          onDeletePermit={onDeletePermit}
          onEditPermit={handleEditPermit}
        />
      )}

      {/* Dedicated Audit Log Modal */}
      {auditModalPermit && (
        <PermitAuditModal
          permit={auditModalPermit}
          isFa={isFa}
          onClose={() => setAuditModalPermit(null)}
        />
      )}

      {/* Unauthorized Edit Modal (Non-Admin Warning) */}
      {unauthorizedEditPermitId && (() => {
        const pTarget = permits.find(p => p.id === unauthorizedEditPermitId);
        return (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right" dir={isFa ? 'rtl' : 'ltr'}>
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-950/60 rounded-2xl shrink-0">
                  <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {isFa ? 'عدم دسترسی به عملیات ویرایش' : 'Access Restricted'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa ? 'مجوز انحصاری مدیر ارشد سامانه' : 'Administrator Privileges Required'}
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 space-y-2 text-xs">
                <p className="font-bold text-amber-900 dark:text-amber-200 leading-relaxed">
                  {isFa 
                    ? `کاربر گرامی (${currentUser.fullName || currentUser.username})، قابلیت ویرایش مشخصات پروانه کار صادر شده منحصراً برای «مدیر اصلی سامانه (Administrator)» فعال است.` 
                    : `User (${currentUser.fullName || currentUser.username}), permit editing is strictly reserved for the Administrator.`}
                </p>
                <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                  {isFa 
                    ? `شما مجاز به مشاهده اطلاعات کامل و ثبت گردش‌کارهای مجاز این پروانه${pTarget ? ` (${pTarget.serialNumber})` : ''} هستید، اما تغییر مفاد و مندرجات اصلی پروانه صادر شده فقط توسط مدیر اصلی امکان‌پذیر است.` 
                    : 'You can view details and progress workflow, but altering registered parameters requires administrator access.'}
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setUnauthorizedEditPermitId(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'متوجه شدم' : 'Understood'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Re-Inspection Cycle Modal */}
      {reInspectPermit && (
        <PermitReInspectionModal
          permit={reInspectPermit}
          currentUser={currentUser}
          isFa={isFa}
          onSaveCycle={handleSaveInspectionCycle}
          onClose={() => setReInspectPermit(null)}
        />
      )}

      {/* Official Master Print Modal */}
      {printPermit && (
        <PermitMasterPrintModal
          permit={printPermit}
          isFa={isFa}
          onClose={() => setPrintPermit(null)}
        />
      )}

      {/* Document Referral Creation Modal */}
      {referralPermit && (
        <CreateReferralModal
          currentUser={currentUser}
          documentType="PERMIT"
          documentId={referralPermit.id || ''}
          documentNumber={referralPermit.serialNumber || ''}
          documentTitle={`پروانه کار ${referralPermit.permitType || referralPermit.permitCategory || ''} - ${referralPermit.serialNumber}`}
          sourcePermit={referralPermit}
          permitSignatures={referralPermit.signatures4Tier}
          isFa={isFa}
          onClose={() => setReferralPermit(null)}
          onSuccess={() => {
            setReferralPermit(null);
          }}
        />
      )}

      {/* Document Workflow & History Tracker Modal */}
      {workflowTrackerPermit && (
        <DocumentWorkflowTrackerModal
          isOpen={Boolean(workflowTrackerPermit)}
          documentType="PERMIT"
          documentId={workflowTrackerPermit.id || ''}
          documentTitle={`گردش کار و امضاهای پروانه ${workflowTrackerPermit.serialNumber}`}
          isFa={isFa}
          onClose={() => setWorkflowTrackerPermit(null)}
        />
      )}
    </div>
  );
};
