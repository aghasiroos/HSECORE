import React, { useState, useEffect } from 'react';
import { WorkPermit, UserProfile, PermitCategory } from '../types';
import { INITIAL_DEMO_PERMITS } from './permit/PermitTypes';
import { PermitHeaderNav } from './permit/PermitHeaderNav';
import { PermitFormMain } from './permit/PermitFormMain';
import { PermitFormSupplementary } from './permit/PermitFormSupplementary';
import { PermitDashboard } from './permit/PermitDashboard';
import { PermitMasterPrintModal } from './permit/PermitMasterPrintModal';
import { PermitFieldManagerModal } from './permit/PermitFieldManagerModal';
import { addAuditLog } from '../utils/authHelper';
import { apiDb } from '../services/apiDatabaseClient';
import { CentralNotificationService } from '../services/notificationService';
import { syncPermitReferral } from '../utils/referralHelper';
import { Trash2, ShieldAlert, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { checkIsIranHolidayClient, checkIsSeniorDutyOfficer } from '../utils/iranCalendarUtils';
import { SubViewTransition } from '../motion';

interface WorkPermitProps {
  language: 'en' | 'fa';
  currentUser: UserProfile;
}

export default function WorkPermitModule({ language, currentUser }: WorkPermitProps) {
  const isFa = language === 'fa';

  // State Management with backend persistence
  const [permits, setPermits] = useState<WorkPermit[]>([]);

  const [activeTab, setActiveTab] = useState<PermitCategory | 'dashboard'>('dashboard');
  const [deleteConfirmPermitId, setDeleteConfirmPermitId] = useState<string | null>(null);
  const [unauthorizedActionModal, setUnauthorizedActionModal] = useState<string | null>(null);
  const [printPermitModal, setPrintPermitModal] = useState<WorkPermit | null>(null);
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false);

  // Holiday & Senior Duty Hot Work selection controls
  const [holidayBlockedModalOpen, setHolidayBlockedModalOpen] = useState(false);
  const [holidayWarningModalOpen, setHolidayWarningModalOpen] = useState(false);
  const [holidayConfirmedFromPrompt, setHolidayConfirmedFromPrompt] = useState(false);
  const [currentHolidayTitle, setCurrentHolidayTitle] = useState('');
  const [currentHolidayDate, setCurrentHolidayDate] = useState('');

  const handleSelectTab = (tab: PermitCategory | 'dashboard') => {
    if (tab === 'Hot') {
      const holiday = checkIsIranHolidayClient(new Date());
      if (holiday.isHoliday) {
        setCurrentHolidayTitle(holiday.holidayTitle || 'تعطیل رسمی');
        setCurrentHolidayDate(holiday.dateShamsi);
        const isSenior = checkIsSeniorDutyOfficer(currentUser.jobTitle, null, currentUser.role);
        if (!isSenior) {
          setHolidayBlockedModalOpen(true);
          return;
        }
        setHolidayWarningModalOpen(true);
        return;
      }
    }
    setActiveTab(tab);
  };

  const handleConfirmHolidayHotWork = () => {
    setHolidayConfirmedFromPrompt(true);
    setHolidayWarningModalOpen(false);
    setActiveTab('Hot');
  };

  // Sync state
  const savePermits = (newList: WorkPermit[]) => {
    setPermits(newList);
  };

  const loadPermitsFromDb = () => {
    apiDb.getWorkPermits().then(list => {
      if (Array.isArray(list)) {
        const mapped = list.map((p: any) => {
          const form = p.formData && typeof p.formData === 'object' ? p.formData : {};
          return {
            ...form,
            ...p,
            id: String(p.id || form.id || p.permitNumber),
            serialNumber: p.permitNumber || form.serialNumber || `PTW-${p.id}`,
            signatures4Tier: form.signatures4Tier || p.signatures4Tier,
            customFields: form.customFields || p.customFields
          };
        });
        setPermits(mapped);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadPermitsFromDb();

    const handleDataMutated = (e: any) => {
      const entity = String(e?.detail?.entityType || e?.detail?.entity || '').toLowerCase();
      if (!entity || entity.includes('permit') || entity.includes('ptw')) {
        loadPermitsFromDb();
      }
    };

    window.addEventListener('hse_data_mutated', handleDataMutated);
    window.addEventListener('app_data_mutated', handleDataMutated);
    window.addEventListener('hse_permits_updated', loadPermitsFromDb);
    return () => {
      window.removeEventListener('hse_data_mutated', handleDataMutated);
      window.removeEventListener('app_data_mutated', handleDataMutated);
      window.removeEventListener('hse_permits_updated', loadPermitsFromDb);
    };
  }, []);

  const handleSaveNewPermit = async (newPermit: WorkPermit) => {
    try {
      const savedResult = await apiDb.saveWorkPermit(newPermit);
      const finalPermit: WorkPermit = savedResult && savedResult.id ? {
        ...newPermit,
        id: String(savedResult.id),
        serialNumber: savedResult.permitNumber || newPermit.serialNumber
      } : newPermit;

      const updated = [finalPermit, ...permits.filter(p => p.id !== finalPermit.id)];
      savePermits(updated);
      try {
        syncPermitReferral(finalPermit, currentUser);
      } catch (e) {
        console.warn('Sync permit referral:', e);
      }
      addAuditLog(currentUser.username, `صدور پروانه جدید ${finalPermit.serialNumber}`, 'موفقیت‌آمیز');

      // Dispatch Central Notification with Popup
      CentralNotificationService.sendNotification({
        title: `صدور پروانه کار: ${finalPermit.serialNumber}`,
        body: `پروانه کار جدید (${finalPermit.permitType || 'عملیاتی'}) توسط ${currentUser.fullName || currentUser.username} صادر گردید.`,
        category: finalPermit.permitType === 'Hot' ? 'warning' : 'info',
        priority: 'high',
        sourceModule: 'ptw',
        type: 'popup',
        triggerPopup: true,
        actionUrl: `#permit`,
        recordId: finalPermit.serialNumber,
        sender: currentUser.fullName || currentUser.username,
        playSound: true,
      }).catch(() => {});

      setActiveTab('dashboard');
    } catch (err) {
      console.error('Failed to save permit to backend:', err);
      const updated = [newPermit, ...permits];
      savePermits(updated);
      try {
        syncPermitReferral(newPermit, currentUser);
      } catch (e) {
        console.warn('Sync permit referral:', e);
      }
      addAuditLog(currentUser.username, `صدور پروانه جدید ${newPermit.serialNumber}`, 'موفقیت‌آمیز');
      setActiveTab('dashboard');
    }
  };

  const handleUpdatePermit = async (updatedPermit: WorkPermit, actionMessage?: string) => {
    try {
      await apiDb.saveWorkPermit(updatedPermit);
    } catch (e) {
      console.warn('Backend update failed, saving locally:', e);
    }
    const updatedList = permits.map(p => p.id === updatedPermit.id ? updatedPermit : p);
    savePermits(updatedList);
    try {
      syncPermitReferral(updatedPermit, currentUser);
    } catch (e) {
      console.warn('Sync permit referral on update:', e);
    }
    if (actionMessage) {
      addAuditLog(currentUser.username, `${actionMessage} - ${updatedPermit.serialNumber}`, 'موفقیت‌آمیز');
      
      // Dispatch Central Notification for permit state transition / approval / closure
      CentralNotificationService.sendNotification({
        title: `بروزرسانی وضعیت پروانه: ${updatedPermit.serialNumber}`,
        body: `${actionMessage} برای پروانه شماره ${updatedPermit.serialNumber} توسط ${currentUser.fullName || currentUser.username} ثبت گردید. (وضعیت: ${updatedPermit.status})`,
        category: updatedPermit.status === 'Cancelled' ? 'error' : updatedPermit.status === 'Approved' ? 'success' : 'info',
        priority: 'high',
        sourceModule: 'ptw',
        type: 'popup',
        triggerPopup: true,
        actionUrl: '#permit',
        recordId: updatedPermit.serialNumber,
        sender: currentUser.fullName || currentUser.username,
        playSound: true,
      }).catch(() => {});
    }
  };

  const handleDeletePermit = (permitId: string) => {
    const roleUpper = (currentUser.role || '').toUpperCase();
    const canDelete = ['ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER', 'SAFETY_OFFICER', 'EXECUTIVE_MANAGER'].includes(roleUpper) ||
                      currentUser.role === 'Administrator' || currentUser.role === 'مدیر سیستم' || currentUser.role === 'مدیر ارشد';
    if (!canDelete) {
      setUnauthorizedActionModal(permitId);
      return;
    }
    setDeleteConfirmPermitId(permitId);
  };

  const executeDelete = async () => {
    if (!deleteConfirmPermitId) return;
    const target = permits.find(p => p.id === deleteConfirmPermitId || p.serialNumber === deleteConfirmPermitId);

    // Purge permit from backend database
    try {
      if (target) {
        await apiDb.deleteWorkPermit(target.id);
        if (target.serialNumber && target.serialNumber !== target.id) {
          await apiDb.deleteWorkPermit(target.serialNumber);
        }
      } else {
        await apiDb.deleteWorkPermit(deleteConfirmPermitId);
      }
    } catch (err) {
      console.error('Failed to delete permit from backend:', err);
    }

    // Update React state and dispatch global database mutation event
    const updated = permits.filter(p => p.id !== deleteConfirmPermitId && p.serialNumber !== deleteConfirmPermitId);
    savePermits(updated);
    window.dispatchEvent(new CustomEvent('hse_data_mutated', { detail: { entityType: 'permits' } }));
    if (target) {
      addAuditLog(currentUser.username, `حذف و پاکسازی کامل پروانه ${target.serialNumber}`, 'موفقیت‌آمیز');
    }
    setDeleteConfirmPermitId(null);
  };

  const activePermitsCount = permits.filter(p => p.status === 'Active' || p.status === 'Issued').length;

  return (
    <div className="space-y-6 pb-12 font-sans" dir={isFa ? 'rtl' : 'ltr'}>
      {/* Navigation Header */}
      <PermitHeaderNav
        activeTab={activeTab}
        onSelectTab={(tab) => handleSelectTab(tab)}
        isFa={isFa}
        activePermitsCount={activePermitsCount}
        permits={permits}
        onOpenFieldManager={() => setIsFieldManagerOpen(true)}
      />

      <SubViewTransition viewKey={activeTab} isFa={isFa}>
        {/* Main Forms (Hot & Cold) */}
        {activeTab === 'Hot' && (
          <PermitFormMain
            permitType="Hot"
            currentUser={currentUser}
            isFa={isFa}
            initialHolidayWarningConfirmed={holidayConfirmedFromPrompt}
            onSave={handleSaveNewPermit}
            onCancel={() => {
              setHolidayConfirmedFromPrompt(false);
              setActiveTab('dashboard');
            }}
          />
        )}

        {activeTab === 'Cold' && (
          <PermitFormMain
            permitType="Cold"
            currentUser={currentUser}
            isFa={isFa}
            onSave={handleSaveNewPermit}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {/* Supplementary Permits (Excavation, Confined Space, Electrical, Radiation, etc.) */}
        {(['Excavation', 'ProcessMechanical', 'ConfinedSpace', 'ElectricalIsolation', 'Radiation', 'VehicleCrane'] as PermitCategory[]).includes(activeTab as PermitCategory) && (
          <PermitFormSupplementary
            category={activeTab as PermitCategory}
            currentUser={currentUser}
            isFa={isFa}
            onSave={handleSaveNewPermit}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <PermitDashboard
            permits={permits}
            isFa={isFa}
            currentUser={currentUser}
            onUpdatePermit={handleUpdatePermit}
            onNewPermitClick={(cat) => handleSelectTab(cat || 'Hot')}
            onDeletePermit={handleDeletePermit}
            onOpenFieldManager={() => setIsFieldManagerOpen(true)}
          />
        )}
      </SubViewTransition>

      {/* Master Print Modal */}
      {printPermitModal && (
        <PermitMasterPrintModal
          permit={printPermitModal}
          isFa={isFa}
          onClose={() => setPrintPermitModal(null)}
        />
      )}

      {/* Field Configuration Manager Modal */}
      {isFieldManagerOpen && (
        <PermitFieldManagerModal
          isOpen={isFieldManagerOpen}
          onClose={() => setIsFieldManagerOpen(false)}
          isFa={isFa}
          currentUser={currentUser}
        />
      )}

      {/* Delete Confirmation Modal (Standard System Pattern - Admin Only) */}
      {deleteConfirmPermitId && (() => {
        const permitToDelete = permits.find(p => p.id === deleteConfirmPermitId);
        const catTitle = (() => {
          if (!permitToDelete) return '';
          const cat = permitToDelete.permitCategory || permitToDelete.permitType;
          if (cat === 'Hot') return isFa ? 'پروانه کار گرم (Hot Work)' : 'Hot Work';
          if (cat === 'Cold') return isFa ? 'پروانه کار سرد (Cold Work)' : 'Cold Work';
          if (cat === 'ConfinedSpace') return isFa ? 'ورود به فضای بسته (Confined Space)' : 'Confined Space';
          if (cat === 'ProcessMechanical') return isFa ? 'ایزولاسیون مکانیکی / LOTO' : 'Process Isolation';
          if (cat === 'Excavation') return isFa ? 'حفاری و گودبرداری (Excavation)' : 'Excavation';
          if (cat === 'ElectricalIsolation') return isFa ? 'ایزولاسیون الکتریکی' : 'Electrical Isolation';
          if (cat === 'Radiation') return isFa ? 'پرتونگاری و رادیوگرافی (NDT)' : 'Radiation';
          if (cat === 'VehicleCrane') return isFa ? 'ورود جرثقیل و ماشین‌آلات' : 'Vehicle Crane';
          return cat;
        })();

        const statusBadge = (() => {
          const status = permitToDelete?.status;
          switch (status) {
            case 'Active':
            case 'Issued':
              return { text: isFa ? 'صادر شده / فعال' : 'Issued / Active', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' };
            case 'Draft':
              return { text: isFa ? 'پیش‌نویس' : 'Draft', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300' };
            case 'Suspended':
              return { text: isFa ? 'معلق / متوقف' : 'Suspended', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300' };
            case 'Closed':
              return { text: isFa ? 'بسته شده / خاتمه' : 'Closed', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300' };
            case 'Cancelled':
              return { text: isFa ? 'لغو شده' : 'Cancelled', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300' };
            default:
              return { text: status || '', bg: 'bg-slate-100 text-slate-700' };
          }
        })();

        return (
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right" dir={isFa ? 'rtl' : 'ltr'}>
              
              {/* Header */}
              <div className="flex items-center gap-3.5 text-rose-600 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {isFa ? 'تأیید حذف پروانه کار صادر شده' : 'Confirm Permit Deletion'}
                  </h4>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFa ? 'شماره سریال پروانه:' : 'Serial:'} {permitToDelete?.serialNumber || deleteConfirmPermitId}
                  </p>
                </div>
              </div>

              {/* Permit Information Card */}
              {permitToDelete && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px] mb-0.5">{isFa ? 'موضوع و شرح کار:' : 'Description:'}</span>
                    <p className="font-bold text-slate-900 dark:text-white leading-relaxed">
                      {permitToDelete.description || (isFa ? 'بدون شرح' : 'No description')}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">{isFa ? 'نوع پروانه:' : 'Category:'}</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200">
                        {catTitle}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">{isFa ? 'وضعیت فعلی:' : 'Status:'}</span>
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${statusBadge.bg}`}>
                        {statusBadge.text}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">{isFa ? 'محل انجام کار:' : 'Location:'}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {permitToDelete.location || '---'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] mb-0.5">{isFa ? 'تاریخ صدور:' : 'Date:'}</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {permitToDelete.year ? `${permitToDelete.year}/${permitToDelete.month}/${permitToDelete.day}` : '---'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Critical Warning Box */}
              <div className="bg-rose-50 dark:bg-rose-950/30 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black block">
                    {isFa ? 'هشدار غیرقابل بازگشت:' : 'Irreversible Action Warning:'}
                  </span>
                  <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300/90">
                    {isFa 
                      ? 'این عملیات منحصراً توسط مدیر اصلی سامانه قابل اجراست. با حذف، کلیه سوابق بازرسی، تست گازها، امضاها و ممیزی‌های این پروانه به‌طور کامل و دائم از سامانه پاک خواهند شد.' 
                      : 'This action is irreversible and restricted exclusively to the System Administrator. All records, gas tests, and signatures will be permanently erased.'}
                  </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmPermitId(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isFa ? 'تأیید و حذف قطعی پروانه' : 'Confirm Permanent Deletion'}</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Unauthorized Deletion Modal (Non-Admin Warning) */}
      {unauthorizedActionModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 text-right" dir={isFa ? 'rtl' : 'ltr'}>
            
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/60 rounded-2xl shrink-0">
                <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                  {isFa ? 'عدم دسترسی به عملیات حذف' : 'Access Restricted'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isFa ? 'مجوز انحصاری مدیر ارشد سامانه' : 'Administrator Privileges Required'}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 space-y-2 text-xs">
              <p className="font-bold text-amber-900 dark:text-amber-200 leading-relaxed">
                {isFa 
                  ? `کاربر گرامی (${currentUser.fullName || currentUser.username})، قابلیت حذف پروانه کار صادر شده منحصراً برای «مدیر اصلی سامانه (Administrator)» فعال است.` 
                  : `User (${currentUser.fullName || currentUser.username}), permit deletion is strictly reserved for the Administrator.`}
              </p>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                {isFa 
                  ? 'سایر کاربران و سطوح دسترسی اجازه حذف سوابق پروانه‌های کار را ندارند. در صورت نیاز به لغو یا اتمام پروانه، می‌توانید از بخش گردش کار (Workflow) وضعیت آن را تغییر دهید.' 
                  : 'Other users cannot delete permit records. If you need to stop or cancel a permit, update its status via the workflow section.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setUnauthorizedActionModal(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'متوجه شدم' : 'Understood'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Hot Work Holiday Confirmation Modal (Senior Duty Officer) */}
      {holidayWarningModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  تأییدیه صدور پروانه کار گرم در روز تعطیل
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  مناسبت تقویمی: {currentHolidayTitle} ({currentHolidayDate})
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800/80 text-xs leading-relaxed text-amber-950 dark:text-amber-100 font-bold">
              توجه! صدور پروانه کار گرم در روزهای تعطیل مشمول الزامات و محدودیتهای ویژه مطابق با استاندارد و دستورالعمل صدور پروانه کار در روزهای تعطیل میباشد. آیا از ضرورت و مجاز بودن صدور این پروانه اطمینان دارید؟
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">صادرکننده پروانه:</span>
                <strong className="text-slate-900 dark:text-slate-100">{currentUser.fullName || currentUser.username}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">سمت شغلی استعلام‌شده:</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-black">{currentUser.jobTitle || 'کشیک ارشد'}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setHolidayWarningModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmHolidayHotWork}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأیید و ادامه صدور</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hot Work Holiday Blocked Modal (Non-Senior Duty Officer) */}
      {holidayBlockedModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 shrink-0">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-rose-600 dark:text-rose-400 text-base">
                  محدودیت صدور پروانه کار گرم در روزهای تعطیل
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  مناسبت تقویمی: {currentHolidayTitle} ({currentHolidayDate})
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800/80 text-xs leading-relaxed text-rose-950 dark:text-rose-100 font-bold">
              شما مجاز به صدور پروانه کار گرم در روزهای تعطیل نیستید. این مجوز صرفاً برای پرسنل دارای سمت شغلی کشیک ارشد فعال است.
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">کاربر جاری:</span>
                <strong className="text-slate-900 dark:text-slate-100">{currentUser.fullName || currentUser.username}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">سمت شغلی استعلام‌شده:</span>
                <strong className="text-rose-700 dark:text-rose-400 font-black">{currentUser.jobTitle || currentUser.role || 'غیر از کشیک ارشد'}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setHolidayBlockedModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-xs font-bold transition cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
