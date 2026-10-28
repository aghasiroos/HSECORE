import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  ExternalLink,
  Trash2,
  Search,
  Filter,
  Layers,
  FileText,
  Thermometer,
  Flame,
  AlertOctagon,
  X,
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import { AppNotification } from '../../services/notificationService';
import { useOnClickOutside } from '../../hooks/useOnClickOutside';

interface NotificationBellDropdownProps {
  language?: 'fa' | 'en';
}

export const NotificationBellDropdown: React.FC<NotificationBellDropdownProps> = ({ language = 'fa' }) => {
  const {
    currentUser,
    notifications,
    unreadCount,
    criticalAlerts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotification();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'critical' | 'workflow'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRinging, setIsRinging] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // References for tracking new notifications vs initial load
  const isInitializedRef = useRef(false);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFa = language === 'fa';

  // Function to stop ringing cleanly
  const stopRinging = useCallback(() => {
    setIsRinging(false);
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  // Function to trigger ringing for a controlled natural duration (~3.5s)
  const triggerRinging = useCallback(() => {
    // Respect prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    setIsRinging(true);
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
    }
    // Ring for ~3.5 seconds (~3 natural oscillations), then stop cleanly
    ringTimerRef.current = setTimeout(() => {
      setIsRinging(false);
      ringTimerRef.current = null;
    }, 3500);
  }, []);

  // When dropdown is opened or all notifications are read, stop animation immediately
  useEffect(() => {
    if (isOpen || unreadCount === 0) {
      stopRinging();
    }
  }, [isOpen, unreadCount, stopRinging]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (ringTimerRef.current) {
        clearTimeout(ringTimerRef.current);
      }
    };
  }, []);

  // Track notifications to trigger ringing ONLY on new incoming unread notifications
  useEffect(() => {
    if (!isInitializedRef.current) {
      if (notifications.length > 0) {
        knownNotificationIdsRef.current = new Set(notifications.map((n) => n.notifId));
        isInitializedRef.current = true;
      }
      return;
    }

    // Check if new unread items appeared since last known snapshot
    const newUnread = notifications.filter(
      (n) => !n.read && !knownNotificationIdsRef.current.has(n.notifId)
    );

    // Update known IDs
    notifications.forEach((n) => knownNotificationIdsRef.current.add(n.notifId));

    if (newUnread.length > 0 && !isOpen) {
      triggerRinging();
    }
  }, [notifications, isOpen, triggerRinging]);

  // Listen to real-time events dispatched from WebSocket / notificationService
  useEffect(() => {
    const handleNewNotification = (e: any) => {
      const notif = e.detail as AppNotification;
      if (notif && !notif.read) {
        knownNotificationIdsRef.current.add(notif.notifId);
        if (!isOpen) {
          triggerRinging();
        }
      }
    };

    window.addEventListener('hse_new_notification_received', handleNewNotification);
    return () => {
      window.removeEventListener('hse_new_notification_received', handleNewNotification);
    };
  }, [isOpen, triggerRinging]);

  // Click outside listener
  useOnClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const hasCriticalUnread = useMemo(() => {
    return criticalAlerts.some((c) => !c.read);
  }, [criticalAlerts]);

  // Filtered notifications
  const filteredList = useMemo(() => {
    let result = notifications;

    if (activeTab === 'unread') {
      result = result.filter((n) => !n.read);
    } else if (activeTab === 'critical') {
      result = result.filter((n) => n.category === 'critical_hse' || n.priority === 'critical');
    } else if (activeTab === 'workflow') {
      result = result.filter((n) => n.sourceModule === 'workflow' || n.type === 'REFERRAL' || n.type === 'APPROVAL');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || (n.sender || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [notifications, activeTab, searchQuery]);

  const handleItemClick = (notif: AppNotification) => {
    markAsRead(notif.notifId);

    // If critical or requires acknowledgment and not yet acknowledged, trigger popup
    if (notif.requiresAck && (!notif.acknowledgedBy || notif.acknowledgedBy.length === 0)) {
      window.dispatchEvent(new CustomEvent('hse_popup_alert_requested', { detail: notif }));
    }

    if (notif.actionUrl) {
      setIsOpen(false);
      if (notif.actionUrl.startsWith('#')) {
        window.location.hash = notif.actionUrl;
      } else {
        window.location.href = notif.actionUrl;
      }
    }
  };

  const getSeverityIcon = (category: string, priority: string) => {
    if (category === 'critical_hse' || priority === 'critical') {
      return <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />;
    }
    if (category === 'warning' || priority === 'high') {
      return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    if (category === 'error') {
      return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    }
    if (category === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  const getModuleLabel = (mod: string) => {
    switch (mod?.toLowerCase()) {
      case 'ptw':
        return 'پروانه کار';
      case 'heat':
        return 'استرس گرمایی';
      case 'incidents':
        return 'حوادث';
      case 'fire-dept':
        return 'آتش‌نشانی';
      case 'safety-unit':
        return 'واحد ایمنی';
      case 'health-env':
        return 'طب کار';
      case 'workflow':
        return 'کارتابل';
      default:
        return 'سامانه';
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'هم‌اکنون';
      if (diffMins < 60) return `${diffMins} دقیقه پیش`;
      if (diffHours < 24) return `${diffHours} ساعت پیش`;
      return d.toLocaleDateString('fa-IR');
    } catch {
      return '';
    }
  };

  return (
    <div className="relative z-50" ref={dropdownRef} style={{ direction: isFa ? 'rtl' : 'ltr' }}>
      {/* Top Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition relative cursor-pointer text-slate-600 dark:text-slate-400 focus:outline-none"
        title={unreadCount > 0 ? `${unreadCount} اعلان خوانده‌نشده` : 'مرکز اعلانات'}
        id="header-notif-bell"
        aria-label="اعلان‌ها و هشدارها"
      >
        <Bell
          className={`w-5 h-5 transition-transform duration-200 ${
            isRinging
              ? 'animate-bell-ring text-amber-500 dark:text-amber-400'
              : unreadCount > 0
              ? 'text-slate-700 dark:text-slate-200'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        />

        {/* Badge & Ping */}
        {unreadCount > 0 && (
          <span
            className={`absolute top-0.5 right-0.5 min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-black font-mono flex items-center justify-center text-white ring-2 ring-white dark:ring-slate-900 shadow-sm ${
              hasCriticalUnread
                ? 'bg-rose-600 animate-bounce ring-rose-400'
                : 'bg-blue-600'
            }`}
          >
            {unreadCount > 99 ? '+99' : unreadCount}
          </span>
        )}

        {/* Pulsating emergency radar circle for critical alerts */}
        {hasCriticalUnread && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 animate-ping opacity-75 pointer-events-none" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute left-0 right-auto top-full mt-2.5 w-[calc(100vw-2rem)] sm:w-96 md:w-[420px] max-w-[95vw] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2"
          style={{ minWidth: 'min(340px, calc(100vw - 2rem))' }}
        >
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <h4 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                  {isFa ? 'مرکز اعلانات و هشدارهای HSE' : 'HSE Notifications & Alerts'}
                </h4>
                {unreadCount > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold shrink-0">
                    {unreadCount} {isFa ? 'جدید' : 'new'}
                  </span>
                )}
              </div>

              {/* Action buttons on header */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Mark all as read */}
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    title={isFa ? 'علامت‌گذاری همه به عنوان خوانده‌شده' : 'Mark all as read'}
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}

                {/* Close button */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-lg transition cursor-pointer"
                  title={isFa ? 'بستن' : 'Close'}
                  aria-label={isFa ? 'بستن پنجره اعلانات' : 'Close notifications'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 text-[11px] font-bold bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1 px-2 rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                همه ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('unread')}
                className={`flex-1 py-1 px-2 rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'unread'
                    ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                خوانده‌نشده ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('critical')}
                className={`flex-1 py-1 px-2 rounded-lg transition cursor-pointer text-center ${
                  activeTab === 'critical'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                بحرانی HSE ({criticalAlerts.length})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative mt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو در متن یا فرستنده اعلان..."
                className="w-full text-[11px] py-1.5 px-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-[10px] text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* List items */}
          <div className="max-h-[380px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredList.length === 0 ? (
              <div className="py-12 px-4 text-center text-slate-400 space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center">
                  <Bell className="w-6 h-6 opacity-40 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isFa ? 'هیچ اعلانی در این دسته یافت نشد' : 'No notifications in this category'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isFa ? 'اعلانات جدید و هشدارهای مهم سیستم به محض صدور در اینجا نمایش داده می‌شوند.' : 'New notifications and alerts will appear here.'}
                </p>
              </div>
            ) : (
              filteredList.map((notif) => {
                const isCrit = notif.category === 'critical_hse' || notif.priority === 'critical';
                const isWarn = notif.category === 'warning' || notif.priority === 'high';

                return (
                  <div
                    key={notif.notifId}
                    onClick={() => handleItemClick(notif)}
                    className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 relative group ${
                      !notif.read
                        ? isCrit
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40'
                          : isWarn
                          ? 'bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50 dark:hover:bg-amber-950/30'
                          : 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-100/40 dark:hover:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Severity Icon */}
                    <div className="mt-0.5">{getSeverityIcon(notif.category, notif.priority)}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {getModuleLabel(notif.sourceModule)}
                        </span>
                        <div className="flex items-center gap-1 text-slate-400 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(notif.createdAt)}</span>
                        </div>
                      </div>

                      <h5
                        className={`text-xs leading-snug line-clamp-1 ${
                          !notif.read ? 'font-black text-slate-900 dark:text-slate-100' : 'font-bold text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {notif.title}
                      </h5>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {notif.body}
                      </p>

                      {/* Footer tags */}
                      <div className="flex items-center justify-between pt-0.5 text-[10px]">
                        {notif.requiresAck && (!notif.acknowledgedBy || notif.acknowledgedBy.length === 0) ? (
                          <span className="text-rose-600 dark:text-rose-400 font-black animate-pulse">
                            ⚠️ نیازمند تأیید شما
                          </span>
                        ) : notif.acknowledgedBy && notif.acknowledgedBy.length > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>تأیید شد</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">{notif.sender || 'سامانه HSE'}</span>
                        )}

                        {notif.actionUrl && (
                          <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5 font-bold opacity-80 group-hover:opacity-100">
                            <span>مشاهده</span>
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!notif.read && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                          isCrit ? 'bg-rose-500 ring-2 ring-rose-300' : 'bg-blue-500 ring-2 ring-blue-300'
                        }`}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
