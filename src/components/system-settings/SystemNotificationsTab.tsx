import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  Users, 
  Building2, 
  ShieldCheck, 
  ShieldAlert,
  User, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  X, 
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Smartphone,
  Layers,
  MessageSquare,
  Lock,
  Volume2,
  Radio,
  Flame,
  Info,
  Clock,
  Sparkles,
  Archive,
  Play,
  Square,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import moment from 'moment-jalaali';
import { NotificationEntry, UserProfile, Department } from '../../types';
import { apiDb } from '../../services/apiDatabaseClient';
import { addAuditLog, hasPermission, isUserAdmin } from '../../utils/authHelper';
import { syncAndGetExtractedDepartments } from '../../utils/personnelHelper';
import { AdvancedSoundSettingsPanel } from '../notifications/AdvancedSoundSettingsPanel';
import { 
  CentralNotificationService, 
  NotificationCategory, 
  NotificationPriority 
} from '../../services/notificationService';
import {
  HSE_SIREN_CATALOG,
  HseSirenType,
  previewSiren,
  stopSirenPreview,
} from '../../utils/notificationAudio';

interface SystemNotificationsTabProps {
  isFa?: boolean;
  language?: 'fa' | 'en';
  currentUser: UserProfile;
  shortcutMode?: boolean;
}

export const SystemNotificationsTab: React.FC<SystemNotificationsTabProps> = ({
  isFa: isFaProp,
  language = 'fa',
  currentUser,
  shortcutMode = false,
}) => {
  const isFa = isFaProp !== undefined ? isFaProp : language !== 'en';

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Sub-tab mode: default to 'urgent_alert' as requested
  const [activeTabMode, setActiveTabMode] = useState<'urgent_alert' | 'history' | 'archive' | 'sound_settings'>('urgent_alert');
  const isAdmin = isUserAdmin(currentUser);
  const canViewNotifications =
    isAdmin ||
    hasPermission(currentUser, 'Notifications', 'view') ||
    hasPermission(currentUser, 'Notifications', 'create');
  const canCreateAlert = isAdmin || hasPermission(currentUser, 'Notifications', 'create');
  const canEditAlert = isAdmin || hasPermission(currentUser, 'Notifications', 'edit') || canCreateAlert;
  const canDeleteAlert = isAdmin || hasPermission(currentUser, 'Notifications', 'delete');

  const [editingNotifId, setEditingNotifId] = useState<string | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifCategory, setNotifCategory] = useState<NotificationCategory>('critical_hse');
  const [notifPriority, setNotifPriority] = useState<NotificationPriority>('critical');
  const [notifSourceModule, setNotifSourceModule] = useState('safety');
  const [notifType, setNotifType] = useState<'in-app' | 'popup' | 'push'>('popup');
  const [notifTargetType, setNotifTargetType] = useState<'all' | 'users' | 'departments' | 'roles' | 'single'>('all');
  const [notifTargetValues, setNotifTargetValues] = useState<string[]>([]);
  const [notifImages, setNotifImages] = useState<string[]>([]);
  const [playSoundAlert, setPlaySoundAlert] = useState(true);
  const [triggerPopup, setTriggerPopup] = useState(true);
  const [requiresAck, setRequiresAck] = useState(true);
  const [notifSirenType, setNotifSirenType] = useState<HseSirenType>('siren_evacuation');
  const [previewingSirenId, setPreviewingSirenId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stop siren preview on unmount
  useEffect(() => {
    return () => {
      stopSirenPreview();
    };
  }, []);

  const handleTogglePreviewSiren = (sirenId: HseSirenType) => {
    if (previewingSirenId === sirenId) {
      stopSirenPreview();
      setPreviewingSirenId(null);
    } else {
      stopSirenPreview();
      setPreviewingSirenId(sirenId);
      previewSiren(sirenId, 4, 0.85);
      setTimeout(() => {
        setPreviewingSirenId((curr) => (curr === sirenId ? null : curr));
      }, 4000);
    }
  };

  // Confirmation Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load notifications
      const dbNotifs = await apiDb.getNotifications();
      if (Array.isArray(dbNotifs)) {
        setNotifications(dbNotifs);
      }

      // Load users & departments for recipient picker
      const dbUsers = await apiDb.getUsers();
      if (Array.isArray(dbUsers)) {
        setUsers(dbUsers);
      }
      setDepartments(syncAndGetExtractedDepartments());
    } catch (err) {
      console.error('Failed to load notifications data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleNotifUpdate = () => {
      loadData();
    };

    window.addEventListener('hse_notifications_updated', handleNotifUpdate);
    window.addEventListener('hse_departments_updated', loadData);
    window.addEventListener('app_data_mutated', handleNotifUpdate);
    window.addEventListener('hse_data_mutated', handleNotifUpdate);
    return () => {
      window.removeEventListener('hse_notifications_updated', handleNotifUpdate);
      window.removeEventListener('hse_departments_updated', loadData);
      window.removeEventListener('app_data_mutated', handleNotifUpdate);
      window.removeEventListener('hse_data_mutated', handleNotifUpdate);
    };
  }, []);

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateAlert) {
      toast.error(isFa ? 'شما مجوز ارسال یا ویرایش هشدار فوری HSE را ندارید.' : 'You do not have permission to dispatch alerts.');
      return;
    }
    if (!notifTitle.trim() || !notifBody.trim()) return;

    setIsSubmitting(true);

    try {
      if (editingNotifId) {
        const updatedNotif: NotificationEntry = {
          id: editingNotifId,
          ts: new Date().toISOString(),
          title: notifTitle.trim(),
          body: notifBody.trim(),
          type: notifType,
          targetType: notifTargetType,
          targetValues: notifTargetValues,
          sender: `${currentUser.fullName || currentUser.username} (${currentUser.jobTitle || currentUser.role})`,
          readBy: [],
          images: notifImages,
          metadata: {
            sirenType: playSoundAlert ? notifSirenType : undefined,
          } as any,
        };
        await apiDb.saveNotification(updatedNotif);
        addAuditLog(currentUser.username, `ویرایش اعلان سیستم: ${notifTitle}`, 'موفقیت‌آمیز');
        setEditingNotifId(null);
        toast.success(isFa ? 'تغییرات هشدار با موفقیت ثبت و بازنشر شد.' : 'Alert updated and re-broadcasted.');
      } else {
        // Dispatches directly through CentralNotificationService: handles audio siren, center popup, WebSocket real-time broadcast and DB storage
        await CentralNotificationService.sendNotification({
          title: notifTitle.trim(),
          body: notifBody.trim(),
          category: notifCategory,
          priority: notifPriority,
          sourceModule: notifSourceModule,
          type: notifType,
          targetType: notifTargetType,
          targetValues: notifTargetValues,
          sender: `${currentUser.fullName || currentUser.username} (${currentUser.jobTitle || currentUser.role || 'مدیریت HSE'})`,
          triggerPopup: notifType === 'popup' || triggerPopup || notifCategory === 'critical_hse' || notifPriority === 'critical',
          playSound: playSoundAlert,
          requiresAck: requiresAck || notifCategory === 'critical_hse',
          sirenType: playSoundAlert ? notifSirenType : undefined,
          metadata: {
            ...(notifImages.length > 0 ? { images: notifImages } : {}),
            sirenType: playSoundAlert ? notifSirenType : undefined,
            actionGuidelines: notifBody.trim(),
          }
        });

        addAuditLog(currentUser.username, `ارسال و مخابره هشدار فوری HSE: ${notifTitle} (${notifCategory}/${notifPriority}) با آژیر ${notifSirenType}`, 'با موفقیت ارسال شد');
        toast.success(isFa ? 'هشدار فوری HSE با موفقیت مخابره شد.' : 'Instant HSE alert broadcasted.');
      }

      window.dispatchEvent(new Event('hse_notifications_updated'));
      await loadData();
      
      // Reset form
      setNotifTitle('');
      setNotifBody('');
      setNotifTargetValues([]);
      setNotifImages([]);
    } catch (err) {
      console.error('Failed to save notification:', err);
      toast.error(isFa ? 'خطا در ثبت و ارسال اعلان' : 'Failed to save notification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditNotification = (notif: NotificationEntry) => {
    if (!canEditAlert) {
      toast.error(isFa ? 'شما مجوز ویرایش اعلان‌ها را ندارید.' : 'Permission denied.');
      return;
    }
    setActiveTabMode('urgent_alert');
    setEditingNotifId(notif.id);
    setNotifTitle(notif.title);
    setNotifBody(notif.body);
    setNotifType(notif.type);
    setNotifTargetType(notif.targetType);
    setNotifTargetValues(notif.targetValues || []);
    setNotifImages(notif.images || ((notif as any).image ? [(notif as any).image] : []));

    const formEl = document.getElementById('notification-dispatch-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingNotifId(null);
    setNotifTitle('');
    setNotifBody('');
    setNotifTargetValues([]);
    setNotifImages([]);
  };

  const handleDeleteNotification = async (id: string) => {
    if (!id) return;
    setIsLoading(true);
    try {
      const target = notifications.find(n => String(n.id) === String(id) || String((n as any).notifId) === String(id));
      await apiDb.deleteNotification(id);
      if (target && (target as any).notifId && String((target as any).notifId) !== String(id)) {
        await apiDb.deleteNotification(String((target as any).notifId));
      }
      const updated = notifications.filter(n => 
        String(n.id) !== String(id) && 
        String((n as any).notifId) !== String(id) && 
        (!target || String(n.id) !== String(target.id))
      );
      setNotifications(updated);
      try {
        localStorage.setItem('hse_notifications', JSON.stringify(updated));
      } catch (e) {}
      window.dispatchEvent(new Event('hse_notifications_updated'));
      addAuditLog(currentUser.username, `حذف اعلان با شناسه: ${id}`, 'موفقیت‌آمیز');
    } catch (err) {
      console.error('Error deleting notification:', err);
    } finally {
      setIsLoading(false);
      setDeleteConfirmId(null);
    }
  };

  const handleClearAll = async () => {
    setIsLoading(true);
    try {
      await apiDb.clearAllNotifications();
      setNotifications([]);
      try {
        localStorage.setItem('hse_notifications', JSON.stringify([]));
      } catch (e) {}
      window.dispatchEvent(new Event('hse_notifications_updated'));
      addAuditLog(currentUser.username, 'پاکسازی کامل تاریخچه اعلان‌های سیستم', 'موفقیت‌آمیز');
    } catch (err) {
      console.error('Error clearing all notifications:', err);
    } finally {
      setIsLoading(false);
      setShowClearConfirm(false);
    }
  };

  // Filtered notifications (shared between History and Archive tabs without duplication)
  const filteredNotifs = notifications.filter(n => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      n.title.toLowerCase().includes(q) || 
      n.body.toLowerCase().includes(q) || 
      (n.sender && n.sender.toLowerCase().includes(q));

    const matchType = filterType === 'ALL' || n.type === filterType;
    const notifCat = (n as any).category || 'info';
    const matchCategory = filterCategory === 'ALL' || notifCat === filterCategory;
    return matchSearch && matchType && matchCategory;
  });

  if (!canViewNotifications) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md mx-auto space-y-4" dir={isFa ? 'rtl' : 'ltr'}>
        <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto" />
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
          {isFa ? 'عدم دسترسی به مدیریت هشدارها و اعلان‌ها' : 'Access Denied'}
        </h3>
        <p className="text-xs text-slate-500 font-bold leading-relaxed">
          {isFa
            ? 'حساب کاربری شما مجوز دسترسی به ماژول مدیریت هشدارها و اعلان‌های سیستم را ندارد.'
            : 'You do not have permission to access the Alerts & Notifications Management module.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="system-notifications-tab" dir={isFa ? 'rtl' : 'ltr'}>
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-slate-50 to-blue-500/10 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-5 rounded-3xl border border-amber-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              {isFa ? 'مرکز مدیریت و مخابره اعلان‌ها و هشدارهای سیستم (Broadcast Hub)' : 'System Notifications & Broadcast Center'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
              {isFa 
                ? 'ارسال فوری هشدارهای ایمنی، دستورالعمل‌های HSE، پیام‌های پاپ‌آپ و درون‌برنامه‌ای به پرسنل مجتمع' 
                : 'Broadcast instant safety alerts, popups, and in-app directives to staff and departments.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isFa ? 'بروزرسانی' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab 1: Instant HSE Alert Dispatch */}
          <button
            type="button"
            onClick={() => setActiveTabMode('urgent_alert')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTabMode === 'urgent_alert'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25 ring-2 ring-rose-500/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{isFa ? 'ارسال هشدار فوری HSE' : 'Instant HSE Alert Dispatch'}</span>
          </button>

          {/* Tab 2: Alerts & Notifications History */}
          <button
            type="button"
            onClick={() => setActiveTabMode('history')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTabMode === 'history'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 ring-2 ring-amber-400/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>{isFa ? `تاریخچه هشدارها و اعلان‌ها (${notifications.length})` : `Alerts & Notifications History (${notifications.length})`}</span>
          </button>

          {/* Tab 3: Notifications Archive */}
          <button
            type="button"
            onClick={() => setActiveTabMode('archive')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTabMode === 'archive'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-2 ring-indigo-500/30'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>{isFa ? `آرشیو و بایگانی اعلان‌ها (${notifications.length})` : `Notifications Archive (${notifications.length})`}</span>
          </button>

          {/* Tab 4: Sound Settings (Strictly hidden in shortcutMode) */}
          {!shortcutMode && (
            <button
              type="button"
              onClick={() => setActiveTabMode('sound_settings')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                activeTabMode === 'sound_settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{isFa ? 'تنظیمات پیشرفته صدا و هشدارها' : 'Advanced Sound & Alert Settings'}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  activeTabMode === 'sound_settings'
                    ? 'bg-white/20 text-white'
                    : isAdmin
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {isAdmin ? (isFa ? 'ویژه مدیر' : 'Admin') : <Lock className="w-3 h-3" />}
              </span>
            </button>
          )}
        </div>

        {activeTabMode === 'urgent_alert' && (
          <button
            type="button"
            onClick={() => setActiveTabMode('history')}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isFa ? 'مشاهده سوابق و وضعیت دریافت' : 'View History & Delivery'}</span>
          </button>
        )}
      </div>

      {/* Mode 1: Advanced Sound Settings Panel (Only in main System Settings, never in shortcutMode) */}
      {!shortcutMode && activeTabMode === 'sound_settings' && (
        <div className="w-full pt-1 animate-in fade-in duration-200">
          <AdvancedSoundSettingsPanel
            currentUser={currentUser}
            isFa={isFa}
            isModal={false}
            onClose={() => setActiveTabMode('urgent_alert')}
          />
        </div>
      )}

      {/* Mode 2: Instant HSE Alert Dispatch Tab */}
      {activeTabMode === 'urgent_alert' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          
          {/* Main Form Column: Dispatch New HSE Alert */}
          <div className="lg:col-span-7 space-y-4" id="notification-dispatch-form">
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-xl">
                    {editingNotifId ? <Edit3 className="w-5 h-5" /> : <Flame className="w-5 h-5 animate-pulse" />}
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                      {editingNotifId 
                        ? (isFa ? 'ویرایش و بازنشر هشدار انتخاب‌شده' : 'Edit & Re-broadcast Alert') 
                        : (isFa ? 'مرکز مخابره و ارسال هشدار فوری HSE' : 'Instant HSE Alert Broadcast Console')}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                      {isFa ? 'انتشار بلادرنگ پیام با آژیر صوتی، پنجره Popup و اعلان در سراسر سامانه' : 'Real-time broadcast with siren, popup and push alerts'}
                    </p>
                  </div>
                </div>

                {editingNotifId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs font-bold text-slate-500 hover:text-rose-600 transition flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{isFa ? 'انصراف از ویرایش' : 'Cancel'}</span>
                  </button>
                )}
              </div>

              {/* Quick Hazard Presets */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isFa ? 'قالب‌های آماده هشدارهای اضطراری HSE:' : 'Emergency Alert Presets:'}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '🚨 نشت گاز کلر / تخلیه فوری', title: 'هشدار تخلیه فوری - نشت گاز سمی کلر', body: 'به دلیل افزایش غلظت گاز کلر در زون عملیاتی، کلیه پرسنل ملزم به استفاده از سیستم تنفسی و تخلیه فوری محل به سمت نقاط تجمع ایمن (Muster Points) در عمود بر جهت وزش باد میباشند.', cat: 'critical_hse', prio: 'critical', src: 'safety-unit', siren: 'siren_gas_leak' },
                    { label: '🚨 نشت گاز H2S / تخلیه فوری', title: 'هشدار تخلیه فوری - نشت گاز سمی H2S', body: 'به دلیل افزایش غلظت گاز H2S در زون عملیاتی، کلیه پرسنل ملزم به استفاده از سیستم تنفسی و تخلیه فوری محل به سمت نقاط تجمع ایمن (Muster Points) در جهت خلاف باد می‌باشند.', cat: 'critical_hse', prio: 'critical', src: 'safety-unit', siren: 'siren_gas_leak' },
                    { label: '🏃 آژیر تخلیه سراسری سایت', title: 'دستور تخلیه اضطراری و فوری مجتمع', body: 'وضعیت اضطراری سطح ۱ اعلام گردید. کلیه پرسنل و پیمانکاران بدون فوت وقت دستگاه‌ها را متوقف و به Muster Point شماره ۱ و ۲ مراجعه نمایند.', cat: 'critical_hse', prio: 'critical', src: 'safety-unit', siren: 'siren_evacuation' },
                    { label: '☀️ هشدار استرس شدید گرمایی', title: 'هشدار سطح قرمز استرس گرمایی (WBGT)', body: 'شاخص دمای تر و استرس گرمایی از حد مجاز فراتر رفته است. کلیه فعالیت‌های سنگین در فضای باز متوقف شده و پروتکل استراحت و آب‌رسانی اجباری اجرایی گردد.', cat: 'warning', prio: 'high', src: 'heat', siren: 'siren_pulsed_hazard' },
                    { label: '🦺 الزام بازرسی PPE در سایت', title: 'دستورالعمل الزامی استفاده از تجهیزات حفاظت فردی', body: 'نظارت شدید بر استفاده از کلاه، کفش ایمنی، عینک حفاظتی و مهار سقوط در سایت آغاز شده و از ادامه کار پرسنل فاقد تجهیزات استاندارد ممانعت خواهد شد.', cat: 'directive', prio: 'medium', src: 'safety-unit', siren: 'siren_standard_hse' },
                    { label: '🚒 مانور اضطراری آتش‌نشانی', title: 'اطلاعیه برگزاری مانور واکنش در شرایط اضطراری', body: 'مانور اطفاء حریق و امداد نجات ایستگاه آتش‌نشانی رأس ساعت مقرر برگزار می‌گردد. رعایت سکوت رادیویی در کانال عملیات الزامی است.', cat: 'info', prio: 'medium', src: 'fire-dept', siren: 'siren_fire_horn' },
                  ].map((preset, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => {
                        setNotifTitle(preset.title);
                        setNotifBody(preset.body);
                        setNotifCategory(preset.cat as any);
                        setNotifPriority(preset.prio as any);
                        setNotifSourceModule(preset.src);
                        if ((preset as any).siren) {
                          setNotifSirenType((preset as any).siren);
                        }
                      }}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendNotification} className="space-y-4 text-xs">
                
                {/* Alert Category & Priority Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                      {isFa ? 'دسته‌بندی هشدار:' : 'Alert Category:'}
                    </label>
                    <select
                      value={notifCategory}
                      onChange={(e) => setNotifCategory(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="critical_hse">{isFa ? '🚨 بحرانی و اضطراری HSE' : 'Critical HSE'}</option>
                      <option value="warning">{isFa ? '⚠️ هشدار و اخطار ایمنی' : 'Safety Warning'}</option>
                      <option value="directive">{isFa ? '📋 دستورالعمل و الزام عملیاتی' : 'Operational Directive'}</option>
                      <option value="info">{isFa ? 'ℹ️ اطلاع‌رسانی و آموزش' : 'General Info'}</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                      {isFa ? 'سطح اولویت (Priority):' : 'Priority Level:'}
                    </label>
                    <select
                      value={notifPriority}
                      onChange={(e) => setNotifPriority(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="critical">{isFa ? '🚨 بحرانی (آژیر صوتی + Popup)' : 'Critical (Siren + Popup)'}</option>
                      <option value="high">{isFa ? '⚡ فوری و بالا (High)' : 'High Priority'}</option>
                      <option value="medium">{isFa ? '🔹 متوسط (Medium)' : 'Medium Priority'}</option>
                      <option value="low">{isFa ? '⚪ عادی و پایین (Low)' : 'Low Priority'}</option>
                    </select>
                  </div>

                  {/* Source Module */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                      {isFa ? 'واحد یا ماژول مبدأ:' : 'Source Module:'}
                    </label>
                    <select
                      value={notifSourceModule}
                      onChange={(e) => setNotifSourceModule(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="safety-unit">{isFa ? 'واحد ایمنی و بازرسی‌ها' : 'Safety Unit'}</option>
                      <option value="fire-dept">{isFa ? 'واحد آتش‌نشانی و امداد' : 'Fire Dept'}</option>
                      <option value="health-env">{isFa ? 'بهداشت و محیط زیست' : 'Health & Env'}</option>
                      <option value="permit">{isFa ? 'پروانه کار ایمن (PTW)' : 'Permit (PTW)'}</option>
                      <option value="heat">{isFa ? 'پایش استرس گرمایی' : 'Heat Stress'}</option>
                      <option value="incidents">{isFa ? 'مدیریت رویدادها' : 'Incidents'}</option>
                      <option value="system">{isFa ? 'مدیریت ارشد HSE' : 'HSE Executive'}</option>
                    </select>
                  </div>
                </div>

                {/* Alert Title */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                    {isFa ? 'عنوان هشدار یا پیام فوری:' : 'Alert Title:'} *
                  </label>
                  <input 
                    type="text"
                    required
                    placeholder={isFa ? 'مثال: هشدار توقف کار به علت نشت گاز / استرس گرمایی' : 'Title of HSE emergency alert...'}
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition"
                  />
                </div>

                {/* Alert Content */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                    {isFa ? 'متن کامل هشدار و دستورالعمل اجرایی:' : 'Alert Content & Instructions:'} *
                  </label>
                  <textarea 
                    required
                    rows={4}
                    placeholder={isFa ? 'شرح دقیق رویداد، اقدامات حفاظتی لازم، موقعیت مکانی و الزامات ایمنی...' : 'Details of emergency actions, zones and safety instructions...'}
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition leading-relaxed"
                  />
                </div>

                {/* Delivery Medium & Target Audience */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Delivery Medium */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                      {isFa ? 'شیوه نمایش و مخابره:' : 'Delivery Medium:'}
                    </label>
                    <select
                      value={notifType}
                      onChange={(e) => setNotifType(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="popup">{isFa ? '🚨 کادر فوری بازشو (Popup Box سراسری)' : 'Immediate Modal Popup'}</option>
                      <option value="push">{isFa ? '🔔 اعلان لحظه‌ای سیستم (Push Notification)' : 'System Push Notification'}</option>
                      <option value="in-app">{isFa ? '📌 بنر درون‌برنامه‌ای (In-App Banner)' : 'In-App Banner'}</option>
                    </select>
                  </div>

                  {/* Target Audience */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                      {isFa ? 'مخاطبین هدف دریافت هشدار:' : 'Target Audience:'}
                    </label>
                    <select
                      value={notifTargetType}
                      onChange={(e) => {
                        setNotifTargetType(e.target.value as any);
                        setNotifTargetValues([]);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="all">{isFa ? '👥 تمام پرسنل و کاربران مجتمع (سراسری)' : 'All Staff (Global)'}</option>
                      <option value="departments">{isFa ? '🏢 دپارتمان‌های خاص' : 'Specific Departments'}</option>
                      <option value="roles">{isFa ? '🛡️ نقش‌های سازمانی خاص' : 'Specific Roles'}</option>
                      <option value="single">{isFa ? '👤 فرد مشخص (پرسنل منفرد)' : 'Individual Employee'}</option>
                    </select>
                  </div>
                </div>

                {/* Sub-selector for Target Values */}
                {notifTargetType === 'departments' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400 font-bold block">
                      {isFa ? 'انتخاب دپارتمان‌های مقصد:' : 'Select Target Departments:'}
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                      {departments.map((d, idx) => (
                        <label key={`${d.id || 'dept'}-${idx}`} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={notifTargetValues.includes(d.id)}
                            onChange={(e) => {
                              if (e.target.checked) setNotifTargetValues([...notifTargetValues, d.id]);
                              else setNotifTargetValues(notifTargetValues.filter(v => v !== d.id));
                            }}
                            className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                          />
                          <span className="truncate">{d?.name ? d.name.split(' (')[0] : (d?.name || '')}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {notifTargetType === 'roles' && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                    <label className="text-[11px] text-slate-600 dark:text-slate-400 font-bold block">
                      {isFa ? 'انتخاب نقش‌های سازمانی مقصد:' : 'Select Target Roles:'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['Administrator', 'HSE Manager', 'Safety Officer', 'SafetyInspector', 'MedicalStaff', 'Contractor', 'User'].map(r => (
                        <label key={r} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={notifTargetValues.includes(r)}
                            onChange={(e) => {
                              if (e.target.checked) setNotifTargetValues([...notifTargetValues, r]);
                              else setNotifTargetValues(notifTargetValues.filter(v => v !== r));
                            }}
                            className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                          />
                          <span>{r}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {notifTargetType === 'single' && (
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                      {isFa ? 'انتخاب پرسنل مورد نظر:' : 'Select Staff Member:'}
                    </label>
                    <select
                      value={notifTargetValues[0] || ''}
                      onChange={(e) => setNotifTargetValues([e.target.value])}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <option value="">{isFa ? 'انتخاب پرسنل...' : 'Select Employee...'}</option>
                      {users.map((u, idx) => (
                        <option key={`${u.id || 'u'}-${idx}`} value={u.id}>
                          {u.fullName} ({u.jobTitle || u.role}) - @{u.username}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Behavioral Alert Controls */}
                <div className="p-3.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/50 rounded-2xl space-y-2">
                  <span className="text-[11px] font-black text-rose-800 dark:text-rose-300 block">
                    {isFa ? 'رفتار هشدار و سطح واکنش سیستم:' : 'System Alert Behavior:'}
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                      <input 
                        type="checkbox"
                        checked={playSoundAlert}
                        onChange={(e) => setPlaySoundAlert(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>{isFa ? '🚨 پخش آژیر و آلارم صوتی در دستگاه گیرندگان' : 'Play Siren Alert Sound'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                      <input 
                        type="checkbox"
                        checked={triggerPopup}
                        onChange={(e) => setTriggerPopup(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>{isFa ? '🪟 باز شدن خودکار پنجره Popup در مرکز تصویر' : 'Auto Trigger Popup Window'}</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300 sm:col-span-2">
                      <input 
                        type="checkbox"
                        checked={requiresAck || notifCategory === 'critical_hse'}
                        disabled={notifCategory === 'critical_hse'}
                        onChange={(e) => setRequiresAck(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
                      />
                      <span>{isFa ? '✍️ الزام کاربر به تأیید دریافت و قطع آژیر (عدم بسته‌شدن تا زمان کلیک تایید)' : 'Require Acknowledgment & Siren Silence'}</span>
                    </label>
                  </div>
                </div>

                {/* Siren Sound Selector (Visible when playSoundAlert is enabled) */}
                {playSoundAlert && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-rose-600 animate-pulse" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                          {isFa ? 'انتخاب نوع آژیر اضطراری هنگام انتشار هشدار:' : 'Emergency Siren Selection:'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {isFa ? 'پخش پیوسته تا زمان تأیید' : 'Continuous loop until ACK'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {isFa 
                        ? 'آژیر صوتی انتخابی به‌صورت بلادرنگ در دستگاه کاربران هدف پخش شده و در پنجره پاپ‌آپ تا زمان تأیید هشدار توسط هر کاربر ادامه خواهد داشت و بلافاصله پس از تأیید مستقل همان کاربر متوقف می‌شود.'
                        : 'Selected siren will play in real-time for targeted users and loop continuously until confirmed independently by each user.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {HSE_SIREN_CATALOG.map((siren) => {
                        const isSelected = notifSirenType === siren.id;
                        const isPreviewing = previewingSirenId === siren.id;

                        return (
                          <div
                            key={siren.id}
                            onClick={() => setNotifSirenType(siren.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer relative text-right flex flex-col justify-between ${
                              isSelected
                                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="radio"
                                    name="siren_selection"
                                    checked={isSelected}
                                    onChange={() => setNotifSirenType(siren.id)}
                                    className="text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                                  />
                                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                    {siren.titleFa}
                                  </span>
                                </div>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {siren.badge}
                                </span>
                              </div>

                              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {siren.descFa}
                              </p>
                            </div>

                            <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                              <span className="text-[9px] font-mono font-bold text-slate-400">
                                {siren.frequencyPattern}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePreviewSiren(siren.id);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs ${
                                  isPreviewing
                                    ? 'bg-rose-600 text-white animate-pulse'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {isPreviewing ? (
                                  <>
                                    <Square className="w-3 h-3 fill-current" />
                                    <span>توقف تست</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>پیش‌شنوایی</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Image Attachments */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-200 block text-right">
                    {isFa ? 'پیوست تصویر یا پوستر ایمنی (اختیاری):' : 'Attached Images / Safety Posters:'}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder={isFa ? 'آدرس URL تصویر را وارد کنید و دکمه افزودن را بزنید' : 'Image URL...'}
                      id="systemNotifImageUrl"
                      className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-rose-500 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100"
                    />
                    <button 
                      type="button" 
                      onClick={() => {
                        const el = document.getElementById('systemNotifImageUrl') as HTMLInputElement;
                        if (el && el.value.trim()) {
                          setNotifImages([...notifImages, el.value.trim()]);
                          el.value = '';
                        }
                      }} 
                      className="px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition cursor-pointer"
                    >
                      {isFa ? 'افزودن' : 'Add'}
                    </button>
                  </div>

                  <div className="pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition">
                      <ImageIcon className="w-3.5 h-3.5 text-rose-600" />
                      <span>{isFa ? 'بارگذاری تصویر از کامپیوتر' : 'Upload from device'}</span>
                      <input 
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from((e.target as HTMLInputElement).files || []) as File[];
                          const promises = files.map(file => {
                            return new Promise<string>((resolve) => {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                resolve(reader.result as string);
                              };
                              reader.readAsDataURL(file as Blob);
                            });
                          });
                          Promise.all(promises).then(base64s => {
                            setNotifImages(prev => [...prev, ...base64s]);
                          });
                        }}
                      />
                    </label>
                  </div>

                  {notifImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {notifImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} alt="Attachment" className="h-16 w-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-2xs" />
                          <button 
                            type="button" 
                            onClick={() => setNotifImages(notifImages.filter((_, i) => i !== idx))} 
                            className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md cursor-pointer hover:bg-rose-700"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs sm:text-sm rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {editingNotifId 
                        ? (isFa ? 'ثبت و بازنشر تغییرات هشدار' : 'Save & Broadcast Changes') 
                        : (isFa ? 'ارسال و انتشار بلادرنگ هشدار فوری HSE' : 'Broadcast Instant HSE Alert')}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Live Alert Preview & Status Info */}
          <div className="lg:col-span-5 space-y-4">
            {/* Live Preview Card */}
            <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {isFa ? 'پیش‌نمایش زنده پنجره هشدار (Live Preview)' : 'Live Alert Preview'}
                  </h4>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {notifType.toUpperCase()}
                </span>
              </div>

              {/* Simulated Popup Box */}
              <div className="p-4 rounded-2xl border-2 border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 space-y-3 relative overflow-hidden shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                    <span className="text-xs font-black text-rose-700 dark:text-rose-400">
                      {isFa ? 'هشدار فوری HSECORE' : 'HSECORE Instant Alert'}
                    </span>
                  </div>
                  {playSoundAlert && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2.5 py-0.5 rounded-full border border-rose-300 dark:border-rose-800">
                      <Volume2 className="w-3 h-3 animate-bounce" />
                      <span>{HSE_SIREN_CATALOG.find(s => s.id === notifSirenType)?.titleFa || (isFa ? 'آژیر فعال' : 'Siren Active')}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {notifTitle || (isFa ? 'عنوان هشدار فوری HSE...' : 'Alert Title...')}
                  </h5>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {notifBody || (isFa ? 'متن و جزئیات پیام و اقدامات ایمنی در این قسمت برای کاربران نمایش داده می‌شود...' : 'Alert message and safety directives...')}
                  </p>
                </div>

                {notifImages.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto py-1">
                    {notifImages.map((img, i) => (
                      <img key={i} src={img} alt="Attachment" className="h-20 w-auto object-cover rounded-xl border border-rose-200 dark:border-rose-800" />
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>فرستنده: {currentUser.fullName || currentUser.username}</span>
                  {(requiresAck || notifCategory === 'critical_hse') && (
                    <span className="font-bold text-rose-600 dark:text-rose-400">⚠️ نیازمند تأیید دریافت توسط کاربر</span>
                  )}
                </div>
              </div>

              {/* Quick Navigation to History */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTabMode('history')}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <span>{isFa ? `مشاهده تاریخچه تمامی اعلان‌ها (${notifications.length})` : 'View All Dispatched History'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3 & 4: Shared History & Archive Tab (Zero Code Duplication - DRY) */}
      {(activeTabMode === 'history' || activeTabMode === 'archive') && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${
                  activeTabMode === 'archive'
                    ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}>
                  {activeTabMode === 'archive' ? <Archive className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100">
                    {activeTabMode === 'archive'
                      ? (isFa ? `آرشیو و بایگانی اعلان‌ها (${filteredNotifs.length})` : `Notifications Archive (${filteredNotifs.length})`)
                      : (isFa ? `تاریخچه هشدارها و اعلان‌ها (${filteredNotifs.length})` : `Alerts & Notifications History (${filteredNotifs.length})`)}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    {activeTabMode === 'archive'
                      ? (isFa ? 'مخزن مرکزی بایگانی، جستجوی پیشرفته و بازیابی سوابق اعلان‌های مخابره‌شده در سامانه' : 'Central archive repository and records of all broadcasted notifications')
                      : (isFa ? 'سوابق ارسال، وضعیت دریافت و خوانده‌شدن و مدیریت اعلان‌های مخابره‌شده' : 'Records, delivery status, and management of dispatched alerts')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canCreateAlert && (
                  <button
                    type="button"
                    onClick={() => setActiveTabMode('urgent_alert')}
                    className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{isFa ? 'ارسال هشدار فوری جدید' : 'New Instant Alert'}</span>
                  </button>
                )}

                {canDeleteAlert && notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 border border-rose-200 dark:border-rose-900/60 rounded-xl transition cursor-pointer"
                  >
                    {isFa ? 'پاکسازی کامل' : 'Clear All'}
                  </button>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                <input 
                  type="text"
                  placeholder={isFa ? 'جستجو در عنوان، متن، فرستنده یا شناسه اعلان...' : 'Search alerts by title, text, or sender...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-amber-500 rounded-xl pr-8 pl-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100"
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <option value="ALL">{isFa ? 'تمامی شیوه‌های نمایش (همه)' : 'All Mediums'}</option>
                <option value="popup">{isFa ? '🚨 کادر فوری بازشو (Popup)' : 'Popup'}</option>
                <option value="push">{isFa ? '🔔 اعلان لحظه‌ای (Push)' : 'Push'}</option>
                <option value="in-app">{isFa ? '📌 درون‌برنامه‌ای (In-App)' : 'In-App'}</option>
              </select>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <option value="ALL">{isFa ? 'همه دسته‌بندی‌های هشدار' : 'All Categories'}</option>
                <option value="critical_hse">{isFa ? '🚨 بحرانی و اضطراری HSE' : 'Critical HSE'}</option>
                <option value="warning">{isFa ? '⚠️ هشدار و اخطار ایمنی' : 'Safety Warning'}</option>
                <option value="directive">{isFa ? '📋 دستورالعمل و الزام عملیاتی' : 'Operational Directive'}</option>
                <option value="info">{isFa ? 'ℹ️ اطلاع‌رسانی و عمومی' : 'General Info'}</option>
              </select>
            </div>

            {/* Notification Cards List */}
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredNotifs.length === 0 ? (
                <div className="p-12 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30">
                  <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
                  <h5 className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {isFa ? 'هیچ اعلانی در تاریخچه یافت نشد' : 'No notifications found'}
                  </h5>
                  <p className="text-xs text-slate-400">
                    {isFa ? 'برای ارسال اولین هشدار فوری، از تب «ارسال هشدار فوری HSE» استفاده نمایید.' : 'Use the Instant HSE Alert tab to dispatch an alert.'}
                  </p>
                </div>
              ) : (
                filteredNotifs.map((notif, idx) => {
                  return (
                    <div 
                      key={`${notif.id || 'notif'}-${idx}`} 
                      className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5 hover:border-amber-500/40 transition shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between border-b border-slate-200/60 dark:border-slate-700/50 pb-2.5 gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                            notif.type === 'popup' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                            notif.type === 'push' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 
                            'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}>
                            {notif.type === 'popup' ? (isFa ? '🚨 پاپ‌آپ سراسری' : 'Popup') :
                             notif.type === 'push' ? (isFa ? '🔔 اعلان لحظه‌ای' : 'Push') : 
                             (isFa ? '📌 بنر درون‌برنامه‌ای' : 'In-App')}
                          </span>

                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-bold">
                            {moment(notif.ts).format('jYYYY/jMM/jDD HH:mm')}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                          {isFa ? `هدف: ${notif.targetType === 'all' ? 'همه پرسنل' : notif.targetType === 'departments' ? 'دپارتمان‌ها' : notif.targetType === 'roles' ? 'نقش‌ها' : 'پرسنل منفرد'}` : `Target: ${notif.targetType}`}
                        </span>
                      </div>

                      <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">{notif.title}</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notif.body}</p>

                      {notif.images && notif.images.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto py-1">
                          {notif.images.map((img, i) => (
                            <img key={i} src={img} alt="Attachment" className="h-20 w-auto object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs" />
                          ))}
                        </div>
                      )}

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-3">
                          <div>
                            <span>{isFa ? 'فرستنده: ' : 'Sender: '}</span>
                            <strong className="text-slate-700 dark:text-slate-300">{notif.sender || 'مدیر سیستم'}</strong>
                          </div>
                          {Array.isArray(notif.readBy) && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px]">
                              {isFa ? `مشاهده‌شده: ${notif.readBy.length} نفر` : `Read: ${notif.readBy.length}`}
                            </span>
                          )}
                          {((notif as any).sirenType || (notif as any).metadata?.sirenType) && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-[10px] flex items-center gap-1 border border-rose-200/60 dark:border-rose-900/40">
                              <Volume2 className="w-3 h-3 text-rose-600" />
                              <span>
                                {HSE_SIREN_CATALOG.find(s => s.id === ((notif as any).sirenType || (notif as any).metadata?.sirenType))?.titleFa || 'آژیر اختصاصی'}
                              </span>
                            </span>
                          )}
                          {Array.isArray((notif as any).acknowledgedBy) && (notif as any).acknowledgedBy.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                              {isFa ? `تأیید مستقل: ${(notif as any).acknowledgedBy.length} نفر` : `Ack: ${(notif as any).acknowledgedBy.length}`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {canEditAlert && (
                            <button 
                              type="button" 
                              onClick={() => handleEditNotification(notif)} 
                              className="px-3 py-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl font-bold transition cursor-pointer flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{isFa ? 'ویرایش و بازنشر' : 'Edit'}</span>
                            </button>
                          )}
                          {canDeleteAlert && (
                            <button 
                              type="button" 
                              onClick={() => setDeleteConfirmId(String(notif.id || (notif as any).notifId || ''))} 
                              className="px-3 py-1 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl font-bold transition cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{isFa ? 'حذف' : 'Delete'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Notification Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isFa ? 'حذف اعلان سیستم' : 'Delete Notification'}
            </h4>
            <p className="text-xs text-slate-500 font-bold leading-relaxed">
              {isFa ? 'آیا از حذف این اعلان از تاریخچه و فهرست پیام‌های کاربران اطمینان دارید؟' : 'Are you sure you want to delete this notification?'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteNotification(deleteConfirmId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                {isFa ? 'بله، حذف شود' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {isFa ? 'پاکسازی کامل تاریخچه اعلان‌ها' : 'Clear All Notifications'}
            </h4>
            <p className="text-xs text-slate-500 font-bold leading-relaxed">
              {isFa ? 'تمامی اعلان‌های ارسال‌شده به صورت کامل حذف خواهند شد. این عملیات غیرقابل بازگشت است.' : 'All dispatched notifications will be purged permanently.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                {isFa ? 'تایید و پاکسازی' : 'Confirm & Clear'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SystemNotificationsTab;
