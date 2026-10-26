import React, { useState, useEffect } from 'react';
import { PtwAuditRecord } from './types';
import { 
  getPtwAudits, 
  savePtwAudit, 
  deletePtwAudit, 
  createEmptyPtwAudit,
  initPtwAuditStorage 
} from './services/ptwAuditService';
import PtwAuditList from './components/PtwAuditList';
import PtwAuditDashboard from './components/PtwAuditDashboard';
import PtwAuditFormModal from './components/PtwAuditFormModal';
import PtwAuditDetailModal from './components/PtwAuditDetailModal';
import PtwAuditPrintView from './components/PtwAuditPrintView';
import { UserProfile } from '../../types';
import { CreateReferralModal } from '../../components/referral/CreateReferralModal';
import { DocumentWorkflowTrackerModal } from '../../components/referral/DocumentWorkflowTrackerModal';

interface PtwAuditModuleProps {
  language?: 'fa' | 'en';
  currentUser?: UserProfile | null;
}

export default function PtwAuditModule({
  language = 'fa',
  currentUser = null
}: PtwAuditModuleProps) {
  const isFa = language === 'fa';
  const [audits, setAudits] = useState<PtwAuditRecord[]>(() => getPtwAudits());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list'>('dashboard');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAudit, setEditingAudit] = useState<PtwAuditRecord | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAuditForDetail, setSelectedAuditForDetail] = useState<PtwAuditRecord | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedAuditForPrint, setSelectedAuditForPrint] = useState<PtwAuditRecord | null>(null);

  // Referral and Workflow tracking state
  const [referralAudit, setReferralAudit] = useState<PtwAuditRecord | null>(null);
  const [workflowTrackerAudit, setWorkflowTrackerAudit] = useState<PtwAuditRecord | null>(null);

  // Sync listener and IndexedDB hydration
  useEffect(() => {
    // Hydrate from IndexedDB on mount
    initPtwAuditStorage().then((loaded) => {
      if (Array.isArray(loaded) && loaded.length > 0) {
        setAudits(loaded);
      }
    }).catch(err => {
      console.warn('Could not load PTW audits from IndexedDB:', err);
    });

    const handleUpdate = () => {
      setAudits(getPtwAudits());
    };
    window.addEventListener('hse_ptw_audits_updated', handleUpdate);
    return () => window.removeEventListener('hse_ptw_audits_updated', handleUpdate);
  }, []);

  const handleAddNew = () => {
    const auditorName = currentUser?.fullName || currentUser?.username || 'کارشناس ممیزی HSE';
    const fresh = createEmptyPtwAudit(auditorName);
    setEditingAudit(fresh);
    setIsFormModalOpen(true);
  };

  const handleEdit = (audit: PtwAuditRecord) => {
    setEditingAudit(audit);
    setIsFormModalOpen(true);
    setIsDetailModalOpen(false);
  };

  const handleViewDetail = (audit: PtwAuditRecord) => {
    setSelectedAuditForDetail(audit);
    setIsDetailModalOpen(true);
  };

  const handlePrint = (audit: PtwAuditRecord) => {
    setSelectedAuditForPrint(audit);
    setIsPrintModalOpen(true);
    setIsDetailModalOpen(false);
  };

  const handleOpenReferral = (audit: PtwAuditRecord) => {
    setReferralAudit(audit);
  };

  const handleOpenWorkflowTracker = (audit: PtwAuditRecord) => {
    setWorkflowTrackerAudit(audit);
  };

  const handleSaveAudit = (record: PtwAuditRecord) => {
    const updated = savePtwAudit(record);
    setAudits(updated);
    setIsFormModalOpen(false);
    setEditingAudit(null);
  };

  const handleDeleteAudit = (id: string) => {
    const updated = deletePtwAudit(id);
    setAudits(updated);
    if (selectedAuditForDetail?.id === id) {
      setIsDetailModalOpen(false);
      setSelectedAuditForDetail(null);
    }
  };

  return (
    <div className="w-full space-y-6" id="ptw-audit-module-root" dir="rtl">
      {/* Tab Content */}
      {activeTab === 'dashboard' ? (
        <PtwAuditDashboard
          audits={audits}
          onViewDetail={handleViewDetail}
          onPrint={handlePrint}
          onSwitchToList={() => setActiveTab('list')}
          onAddNew={handleAddNew}
          onOpenReferral={handleOpenReferral}
          onOpenWorkflowTracker={handleOpenWorkflowTracker}
          isFa={isFa}
        />
      ) : (
        <PtwAuditList
          audits={audits}
          onAddNew={handleAddNew}
          onViewDetail={handleViewDetail}
          onEdit={handleEdit}
          onPrint={handlePrint}
          onDelete={handleDeleteAudit}
          onOpenReferral={handleOpenReferral}
          onOpenWorkflowTracker={handleOpenWorkflowTracker}
          onSwitchToDashboard={() => setActiveTab('dashboard')}
          isFa={isFa}
        />
      )}

      {/* Form Modal (Create / Edit) */}
      {isFormModalOpen && editingAudit && (
        <PtwAuditFormModal
          initialData={editingAudit}
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingAudit(null);
          }}
          onSave={handleSaveAudit}
          isFa={isFa}
        />
      )}

      {/* Detail Review Modal */}
      {isDetailModalOpen && selectedAuditForDetail && (
        <PtwAuditDetailModal
          audit={selectedAuditForDetail}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedAuditForDetail(null);
          }}
          onEdit={handleEdit}
          onPrint={handlePrint}
          onDelete={handleDeleteAudit}
          onOpenReferral={handleOpenReferral}
          onOpenWorkflowTracker={handleOpenWorkflowTracker}
          isFa={isFa}
        />
      )}

      {/* Print View Modal (A4 replica) */}
      {isPrintModalOpen && selectedAuditForPrint && (
        <PtwAuditPrintView
          audit={selectedAuditForPrint}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedAuditForPrint(null);
          }}
          isFa={isFa}
        />
      )}

      {/* Create Document Referral Modal for PTW Audit */}
      {referralAudit && (
        <CreateReferralModal
          currentUser={currentUser}
          documentType="PTW_AUDIT"
          documentId={referralAudit.id || ''}
          documentNumber={referralAudit.permitNumber || referralAudit.documentCode || ''}
          documentTitle={`ممیزی پروانه کار ${referralAudit.permitNumber || ''} (${referralAudit.unitName || ''})`}
          isFa={isFa}
          onClose={() => setReferralAudit(null)}
          onSuccess={() => {
            setReferralAudit(null);
          }}
        />
      )}

      {/* Document Workflow & History Tracker Modal */}
      {workflowTrackerAudit && (
        <DocumentWorkflowTrackerModal
          isOpen={Boolean(workflowTrackerAudit)}
          documentType="PTW_AUDIT"
          documentId={workflowTrackerAudit.id || ''}
          documentNumber={workflowTrackerAudit.permitNumber || workflowTrackerAudit.documentCode || ''}
          documentTitle={`گردش کار، ارجاع و امضاهای ممیزی پروانه ${workflowTrackerAudit.permitNumber || workflowTrackerAudit.documentCode || ''}`}
          currentUser={currentUser || undefined}
          isFa={isFa}
          onClose={() => setWorkflowTrackerAudit(null)}
        />
      )}
    </div>
  );
}
