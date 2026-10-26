import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AuditLogEntry, AuditCategory, AuditSeverity } from '../types';
import {
  Search,
  Download,
  Activity,
  Clock,
  ShieldCheck,
  X,
  FileSpreadsheet,
  Eye,
  User,
  Cpu,
  Box,
  AlertCircle,
  Database,
  RefreshCw,
  Filter,
  RotateCcw,
  ArrowLeft,
  Navigation,
  MousePointerClick,
  Edit3,
  FileJson,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Layers,
  GitCompare,
  Route,
  Radio,
  PauseCircle,
  PlayCircle,
  Terminal,
  Lock,
} from 'lucide-react';
import moment from 'moment-jalaali';
import { printService } from '../services/printService';
import { getSystemBrandingConfig } from '../utils/systemBrandingHelper';
import { apiDb } from '../services/apiDatabaseClient';
import { getAuditLogs, addAuditLog, getCurrentUser } from '../utils/authHelper';
import { mergeAndDeduplicateAuditLogs } from '../utils/auditEngine';
import { downloadCsvFile } from '../utils/fileHelpers';
import { VirtualizedDataTable, VirtualizedColumn } from './common/virtualized/VirtualizedDataTable';

interface GlobalAuditLogSystemProps {
  isFa: boolean;
}

type ViewMode = 'table' | 'journey' | 'diffs';
type TimeRangeFilter = 'ALL' | '1H' | 'TODAY' | '7D' | '30D';

const ACTION_META: Record<
  string,
  { labelFa: string; labelEn: string; badgeClass: string }
> = {
  CREATE: {
    labelFa: 'ایجاد / ثبت',
    labelEn: 'CREATE',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  UPDATE: {
    labelFa: 'ویرایش داده',
    labelEn: 'UPDATE',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  DELETE: {
    labelFa: 'حذف / پاکسازی',
    labelEn: 'DELETE',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  FIELD_CHANGE: {
    labelFa: 'تغییر فیلد',
    labelEn: 'FIELD EDIT',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
  },
  NAVIGATION: {
    labelFa: 'ناوبری ماژول',
    labelEn: 'NAVIGATE',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
  TAB_SWITCH: {
    labelFa: 'تغییر تب',
    labelEn: 'TAB SWITCH',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  },
  CLICK: {
    labelFa: 'کلیک کنترل',
    labelEn: 'UI CLICK',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  MODAL_OPEN: {
    labelFa: 'باز کردن فرم',
    labelEn: 'OPEN MODAL',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  },
  SEARCH: {
    labelFa: 'جستجو',
    labelEn: 'SEARCH',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  FILTER: {
    labelFa: 'اعمال فیلتر',
    labelEn: 'FILTER',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  PRINT: {
    labelFa: 'چاپ سند',
    labelEn: 'PRINT',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  },
  EXPORT: {
    labelFa: 'خروجی فایل',
    labelEn: 'EXPORT',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
  },
  IMPORT: {
    labelFa: 'درون‌ریزی',
    labelEn: 'IMPORT',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  APPROVE: {
    labelFa: 'تایید / امضا',
    labelEn: 'APPROVE',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  REJECT: {
    labelFa: 'رد / برگشت',
    labelEn: 'REJECT',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  LOGIN: {
    labelFa: 'ورود به سیستم',
    labelEn: 'LOGIN',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  LOGOUT: {
    labelFa: 'خروج از سیستم',
    labelEn: 'LOGOUT',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  PERMISSIONS_CHANGE: {
    labelFa: 'تغییر دسترسی',
    labelEn: 'RBAC CHANGE',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  SETTINGS_CHANGE: {
    labelFa: 'تغییر تنظیمات',
    labelEn: 'SETTINGS',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
  },
  CLIPBOARD: {
    labelFa: 'کپی کلیپ‌بورد',
    labelEn: 'CLIPBOARD',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  SESSION: {
    labelFa: 'وضعیت نشست',
    labelEn: 'SESSION',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

const SEVERITY_META: Record<
  AuditSeverity,
  { labelFa: string; dotClass: string; badgeClass: string }
> = {
  CRITICAL: {
    labelFa: 'بحرانی',
    dotClass: 'bg-rose-600',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  },
  HIGH: {
    labelFa: 'حساس / مهم',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
  },
  MEDIUM: {
    labelFa: 'عملیاتی',
    dotClass: 'bg-blue-500',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  LOW: {
    labelFa: 'تغییر جزئی',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  INFO: {
    labelFa: 'حرکت / مشاهده',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

const CATEGORY_META: Record<AuditCategory, { labelFa: string; labelEn: string }> = {
  DATA_MUTATION: { labelFa: 'تغییرات داده‌ای (ایجاد/ویرایش/حذف)', labelEn: 'Data Mutations' },
  FIELD_CHANGE: { labelFa: 'ویرایش مقادیر فیلدها و فرم‌ها', labelEn: 'Field Edits' },
  NAVIGATION: { labelFa: 'جابجایی و ناوبری ماژول‌ها و تب‌ها', labelEn: 'Navigation & Tabs' },
  UI_INTERACTION: { labelFa: 'کلیک دکمه‌ها و باز کردن پنجره‌ها', labelEn: 'UI Interactions' },
  SEARCH_FILTER: { labelFa: 'جستجو و اعمال فیلترها', labelEn: 'Search & Filters' },
  EXPORT_PRINT: { labelFa: 'چاپ، خروجی اکسل/PDF و کلیپ‌بورد', labelEn: 'Export & Print' },
  AUTH_SECURITY: { labelFa: 'امنیت، ورود/خروج و تغییر دسترسی‌ها', labelEn: 'Auth & Security' },
  SYSTEM: { labelFa: 'عملیات سیستمی و پس‌زمینه', labelEn: 'System Events' },
};

export const GlobalAuditLogSystem: React.FC<GlobalAuditLogSystemProps> = ({ isFa }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveStream, setIsLiveStream] = useState(true);
  const [includeMicroMovements, setIncludeMicroMovements] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Multi-dimensional filters
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [actionTypeFilter, setActionTypeFilter] = useState('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Forensic modal state
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const loadAndMergeLogs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const dbRows = await apiDb.getAuditLogs(500).catch(() => []);
      const memRows = getAuditLogs();
      const merged = mergeAndDeduplicateAuditLogs(dbRows, memRows);
      setLogs(merged);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAndMergeLogs(true);
  }, [loadAndMergeLogs]);

  useEffect(() => {
    if (!isLiveStream) return;
    const handleLogUpdate = () => {
      const memRows = getAuditLogs();
      setLogs((prev) => mergeAndDeduplicateAuditLogs(prev, memRows));
    };
    window.addEventListener('hse_audit_log_added', handleLogUpdate);
    return () => {
      window.removeEventListener('hse_audit_log_added', handleLogUpdate);
    };
  }, [isLiveStream]);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.username) {
        map.set(l.username, l.fullName ? `${l.fullName} (@${l.username})` : `@${l.username}`);
      }
    });
    return Array.from(map.entries());
  }, [logs]);

  const uniqueModules = useMemo(
    () => Array.from(new Set(logs.map((l) => l.module || 'سیستم عمومی'))).filter(Boolean),
    [logs]
  );

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const nowMs = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return logs.filter((log) => {
      // Micro-movement toggle
      if (
        !includeMicroMovements &&
        ['NAVIGATION', 'UI_INTERACTION', 'SEARCH_FILTER'].includes(log.category || '')
      ) {
        return false;
      }

      // Time range filter
      if (timeRangeFilter !== 'ALL') {
        const logTime = new Date(log.ts).getTime();
        if (timeRangeFilter === '1H' && nowMs - logTime > 3600 * 1000) return false;
        if (timeRangeFilter === 'TODAY' && logTime < startOfToday.getTime()) return false;
        if (timeRangeFilter === '7D' && nowMs - logTime > 7 * 86400 * 1000) return false;
        if (timeRangeFilter === '30D' && nowMs - logTime > 30 * 86400 * 1000) return false;
      }

      if (userFilter !== 'ALL' && log.username !== userFilter) return false;
      if (categoryFilter !== 'ALL' && log.category !== categoryFilter) return false;
      if (actionTypeFilter !== 'ALL' && log.actionType !== actionTypeFilter) return false;
      if (moduleFilter !== 'ALL' && (log.module || 'سیستم عمومی') !== moduleFilter) return false;
      if (severityFilter !== 'ALL' && log.severity !== severityFilter) return false;
      if (
        statusFilter !== 'ALL' &&
        ((statusFilter === 'SUCCESS' && !log.success) ||
          (statusFilter === 'FAIL' && log.success))
      ) {
        return false;
      }

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase();
        const inChanges =
          log.changes?.some(
            (c) =>
              String(c.field || '').toLowerCase().includes(q) ||
              String(c.fieldLabel || '').toLowerCase().includes(q) ||
              String(c.oldValue || '').toLowerCase().includes(q) ||
              String(c.newValue || '').toLowerCase().includes(q)
          ) || false;

        const matchBasic =
          log.username?.toLowerCase().includes(q) ||
          log.fullName?.toLowerCase().includes(q) ||
          log.userCode?.toLowerCase().includes(q) ||
          log.action?.toLowerCase().includes(q) ||
          log.module?.toLowerCase().includes(q) ||
          log.description?.toLowerCase().includes(q) ||
          log.recordId?.toLowerCase().includes(q) ||
          log.ip?.toLowerCase().includes(q) ||
          log.elementTarget?.toLowerCase().includes(q) ||
          inChanges;

        if (!matchBasic) return false;
      }

      return true;
    });
  }, [
    logs,
    includeMicroMovements,
    timeRangeFilter,
    userFilter,
    categoryFilter,
    actionTypeFilter,
    moduleFilter,
    severityFilter,
    statusFilter,
    searchTerm,
  ]);

  // Summary KPIs
  const stats = useMemo(() => {
    let dataMutations = 0;
    let totalFieldDiffs = 0;
    let movements = 0;
    let securityAndSensitive = 0;
    const actors = new Set<string>();

    filteredLogs.forEach((l) => {
      if (l.username) actors.add(l.username);
      if (l.changes && l.changes.length > 0) {
        totalFieldDiffs += l.changes.length;
      }
      if (l.category === 'DATA_MUTATION' || l.category === 'FIELD_CHANGE') {
        dataMutations++;
      } else if (
        l.category === 'NAVIGATION' ||
        l.category === 'UI_INTERACTION' ||
        l.category === 'SEARCH_FILTER'
      ) {
        movements++;
      }
      if (
        l.category === 'AUTH_SECURITY' ||
        l.category === 'EXPORT_PRINT' ||
        l.severity === 'CRITICAL' ||
        l.severity === 'HIGH' ||
        !l.success
      ) {
        securityAndSensitive++;
      }
    });

    return {
      total: filteredLogs.length,
      dataMutations,
      totalFieldDiffs,
      movements,
      securityAndSensitive,
      activeUsers: actors.size,
    };
  }, [filteredLogs]);

  // Flattened field-level diffs for the 'diffs' view
  const allFieldDiffRows = useMemo(() => {
    const list: Array<{
      id: string;
      log: AuditLogEntry;
      field: string;
      fieldLabel: string;
      oldValue: string;
      newValue: string;
    }> = [];
    filteredLogs.forEach((log) => {
      if (Array.isArray(log.changes) && log.changes.length > 0) {
        log.changes.forEach((ch, idx) => {
          list.push({
            id: `${log.id}-diff-${idx}`,
            log,
            field: ch.field,
            fieldLabel: ch.fieldLabel || ch.field,
            oldValue: typeof ch.oldValue === 'object' ? JSON.stringify(ch.oldValue) : String(ch.oldValue ?? '-'),
            newValue: typeof ch.newValue === 'object' ? JSON.stringify(ch.newValue) : String(ch.newValue ?? '-'),
          });
        });
      }
    });
    return list;
  }, [filteredLogs]);

  // Surrounding trail of the same user for the Forensic Inspector Modal
  const selectedUserTrail = useMemo(() => {
    if (!selectedLog) return [];
    const userLogs = logs.filter((l) => l.username === selectedLog.username);
    const idx = userLogs.findIndex((l) => l.id === selectedLog.id);
    if (idx === -1) return userLogs.slice(0, 5);
    const start = Math.max(0, idx - 2);
    const end = Math.min(userLogs.length, idx + 4);
    return userLogs.slice(start, end);
  }, [selectedLog, logs]);

  const hasActiveFilters =
    searchTerm !== '' ||
    userFilter !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    actionTypeFilter !== 'ALL' ||
    moduleFilter !== 'ALL' ||
    severityFilter !== 'ALL' ||
    timeRangeFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const resetFilters = () => {
    setSearchTerm('');
    setUserFilter('ALL');
    setCategoryFilter('ALL');
    setActionTypeFilter('ALL');
    setModuleFilter('ALL');
    setSeverityFilter('ALL');
    setTimeRangeFilter('ALL');
    setStatusFilter('ALL');
  };

  const exportToCsv = () => {
    if (filteredLogs.length === 0) return;
    const currentUser = getCurrentUser();
    addAuditLog(
      currentUser?.username || 'admin',
      `استخراج خروجی CSV/Excel از لاگ ممیزی (${filteredLogs.length} رکورد)`,
      'موفق',
      { actionType: 'EXPORT', module: 'لاگ عملیات و ممیزی' }
    );

    const headers = [
      'ID',
      'Timestamp (ISO)',
      'Persian Date',
      'Username',
      'Full Name',
      'Personnel Code',
      'Role',
      'Category',
      'Severity',
      'Action Type',
      'Module',
      'Page / Path',
      'Action Summary',
      'Changed Fields',
      'Record ID',
      'IP Address',
      'Device / Browser',
      'Duration (ms)',
      'Status',
      'Hash',
    ];

    const csvContent = [
      headers.join(','),
      ...filteredLogs.map((log) => {
        const changesSummary = (log.changes || [])
          .map((c) => `${c.fieldLabel || c.field}: [${c.oldValue} -> ${c.newValue}]`)
          .join(' | ');
        return [
          log.id,
          log.ts,
          log.tsFa || '',
          log.username || '',
          `"${(log.fullName || '').replace(/"/g, '""')}"`,
          log.userCode || '',
          `"${(log.userRole || '').replace(/"/g, '""')}"`,
          log.category || '',
          log.severity || '',
          log.actionType || 'OTHER',
          `"${(log.module || '').replace(/"/g, '""')}"`,
          `"${(log.page || '').replace(/"/g, '""')}"`,
          `"${(log.action || '').replace(/"/g, '""')}"`,
          `"${changesSummary.replace(/"/g, '""')}"`,
          log.recordId || '',
          log.ip || '',
          `"${(log.browser || '').replace(/"/g, '""')}"`,
          log.durationMs || log.dwellTimeMs || '',
          log.success ? 'SUCCESS' : 'FAILED',
          log.hash || '',
        ].join(',');
      }),
    ].join('\n');

    downloadCsvFile(`hse_forensic_audit_${moment().format('jYYYY-jMM-jDD_HH-mm')}.csv`, csvContent);
  };

  const exportToJson = () => {
    if (filteredLogs.length === 0) return;
    const currentUser = getCurrentUser();
    addAuditLog(
      currentUser?.username || 'admin',
      `استخراج خروجی JSON کالبدشکافی لاگ ممیزی (${filteredLogs.length} رکورد)`,
      'موفق',
      { actionType: 'EXPORT', module: 'لاگ عملیات و ممیزی' }
    );
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hse_forensic_audit_${moment().format('jYYYY-jMM-jDD_HH-mm')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printLogs = () => {
    const currentUser = getCurrentUser();
    addAuditLog(
      currentUser?.username || 'admin',
      `چاپ گزارش رسمی ممیزی و ریزحرکات سیستم (${filteredLogs.length} رکورد)`,
      'موفق',
      { actionType: 'PRINT', module: 'لاگ عملیات و ممیزی' }
    );

    const branding = getSystemBrandingConfig();
    const today = moment().format('jYYYY/jMM/jDD HH:mm');
    const logsToPrint = filteredLogs.slice(0, 300);

    const rowsHtml = logsToPrint
      .map((log, idx) => {
        const diffHtml =
          log.changes && log.changes.length > 0
            ? `<div style="margin-top:3px;font-size:9px;color:#1d4ed8;">${log.changes
                .slice(0, 3)
                .map((c) => `${c.fieldLabel || c.field}: ${c.oldValue} ⬅ ${c.newValue}`)
                .join(' | ')}</div>`
            : '';
        return `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 9.5px;">
        <td style="padding: 5px; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 5px; text-align: center; font-family: 'JetBrains Mono', monospace;">${log.tsFa || moment(log.ts).format('jYYYY/jMM/jDD HH:mm:ss')}</td>
        <td style="padding: 5px; font-weight: bold;">${log.fullName ? `${log.fullName} (@${log.username})` : `@${log.username}`} <div style="font-size:8.5px;color:#64748b;">${log.userRole || '-'}</div></td>
        <td style="padding: 5px; text-align: center; font-weight: bold;">${ACTION_META[log.actionType]?.labelFa || log.actionType}</td>
        <td style="padding: 5px; text-align: center;">${log.module || '-'}</td>
        <td style="padding: 5px;">${log.action || '-'}${diffHtml}</td>
        <td style="padding: 5px; text-align: center; font-family: 'JetBrains Mono', monospace;">${log.ip || '-'}</td>
        <td style="padding: 5px; text-align: center; font-weight: bold; color: ${log.success !== false ? '#059669' : '#e11d48'};">
          ${log.success !== false ? 'موفق' : 'ناموفق'}
        </td>
      </tr>
    `;
      })
      .join('');

    const html = `
      <div style="direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif;">
        <div style="border: 2px solid #0f172a; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${branding.logoUrl ? `<img src="${branding.logoUrl}" style="height: 18mm; max-width: 45mm; object-fit: contain;" alt="Logo" />` : ''}
            <div>
              <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a;">${branding.organizationNameFa || 'مدیریت بهداشت، ایمنی و محیط زیست (HSE)'}</h2>
              <p style="margin: 2px 0 0 0; font-size: 11.5px; font-weight: 700; color: #475569;">گزارش رسمی ممیزی، تغییرات فیلدها و ردگیری ریزحرکات کاربران (Forensic Audit Trail)</p>
            </div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px; font-size: 10px; line-height: 1.6; background: #f8fafc;">
            <div><strong>کد سند:</strong> <span style="font-family: 'JetBrains Mono', monospace;">HSE-FORENSIC-AUDIT</span></div>
            <div><strong>زمان استخراج:</strong> <span style="font-family: 'JetBrains Mono', monospace;">${today}</span></div>
            <div><strong>تعداد رکورد:</strong> <strong>${logsToPrint.length} از ${filteredLogs.length}</strong></div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 10px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 2px solid #0f172a; font-weight: 800;">
              <th style="padding: 7px; text-align: center; width: 32px;">#</th>
              <th style="padding: 7px; text-align: center; width: 110px;">زمان دقیق</th>
              <th style="padding: 7px; text-align: right; width: 130px;">کاربر / عامل</th>
              <th style="padding: 7px; text-align: center; width: 75px;">نوع اقدام</th>
              <th style="padding: 7px; text-align: center; width: 100px;">ماژول</th>
              <th style="padding: 7px; text-align: right;">شرح اقدام و ریزتغییرات (قبلی ⬅ جدید)</th>
              <th style="padding: 7px; text-align: center; width: 80px;">IP</th>
              <th style="padding: 7px; text-align: center; width: 55px;">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    printService.printHtml(html, {
      title: 'گزارش رسمی ممیزی و ردگیری ریزحرکات سیستم (Audit Trail)',
      orientation: 'landscape',
      pageSize: 'A4',
      documentCode: 'HSE-FORENSIC-AUDIT',
      documentDate: today,
      isFa: true,
      autoPrint: true,
    });
  };

  const getActorIcon = (type: string) => {
    switch (type) {
      case 'USER':
        return <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case 'SYSTEM':
        return <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />;
      case 'API':
        return <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
      case 'SCHEDULER':
        return <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />;
      default:
        return <User className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
    }
  };

  const getActionBadge = (actionType: string) => {
    const meta = ACTION_META[actionType] || {
      labelFa: actionType || 'سایر',
      labelEn: actionType || 'OTHER',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black border ${meta.badgeClass}`}
      >
        {isFa ? meta.labelFa : meta.labelEn}
      </span>
    );
  };

  const getSeverityBadge = (severity?: AuditSeverity) => {
    const sev = SEVERITY_META[severity || 'INFO'] || SEVERITY_META.INFO;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${sev.badgeClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${sev.dotClass}`} />
        <span>{sev.labelFa}</span>
      </span>
    );
  };

  const auditColumns = useMemo<VirtualizedColumn<AuditLogEntry>[]>(
    () => [
      {
        key: 'time',
        header: isFa ? 'زمان دقیق' : 'Timestamp',
        width: 135,
        render: (log) => (
          <div className="tabular-nums">
            <div className="text-xs font-black text-slate-800 dark:text-slate-200 font-mono">
              {log.tsFa || moment(log.ts).format('jYYYY/jMM/jDD HH:mm:ss')}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {moment(log.ts).format('HH:mm:ss.SSS')}
            </div>
          </div>
        ),
      },
      {
        key: 'actor',
        header: isFa ? 'کاربر / عامل' : 'Actor',
        width: 155,
        render: (log) => (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {getActorIcon(log.actorType || 'USER')}
              <span className="text-xs text-slate-900 dark:text-slate-100 font-black truncate">
                {log.fullName || log.username || 'System'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 truncate">
              <span className="font-mono">@{log.username}</span>
              {log.userRole && (
                <>
                  <span>•</span>
                  <span className="truncate">{log.userRole}</span>
                </>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'actionType',
        header: isFa ? 'نوع و اهمیت' : 'Action & Severity',
        width: 125,
        render: (log) => (
          <div className="flex flex-col items-start gap-1">
            {getActionBadge(log.actionType || 'OTHER')}
            {getSeverityBadge(log.severity)}
          </div>
        ),
      },
      {
        key: 'module',
        header: isFa ? 'ماژول و مسیر' : 'Module & Path',
        width: 155,
        render: (log) => (
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
              {log.module || 'سیستم عمومی'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
              {log.subSection || log.page || '-'}
              {log.recordId ? ` [${log.recordId}]` : ''}
            </div>
          </div>
        ),
      },
      {
        key: 'description',
        header: isFa ? 'شرح اقدام و ریزتغییرات (قبلی ⬅ جدید)' : 'Action & Field Diffs',
        width: 340,
        render: (log) => {
          const firstChange = log.changes && log.changes.length > 0 ? log.changes[0] : null;
          return (
            <div className="min-w-0 py-0.5">
              <div
                className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                title={log.action}
              >
                {log.action}
              </div>
              {firstChange ? (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2 py-0.5 max-w-full overflow-hidden">
                  <span className="font-bold text-slate-600 dark:text-slate-300 shrink-0">
                    {firstChange.fieldLabel || firstChange.field}:
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 line-through truncate max-w-[90px] font-mono">
                    {String(firstChange.oldValue ?? '-')}
                  </span>
                  <ArrowLeft className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate max-w-[110px] font-mono">
                    {String(firstChange.newValue ?? '-')}
                  </span>
                  {log.changes && log.changes.length > 1 && (
                    <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded font-bold shrink-0">
                      +{log.changes.length - 1}
                    </span>
                  )}
                </div>
              ) : log.elementTarget || log.endpoint ? (
                <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                  {log.httpMethod ? `${log.httpMethod} ${log.endpoint}` : log.elementTarget}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'telemetry',
        header: isFa ? 'وضعیت / زمان' : 'Status / Timing',
        width: 105,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (log) => (
          <div className="flex flex-col items-center gap-1">
            {log.success !== false ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                {isFa ? 'موفق' : 'Success'}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {isFa ? 'ناموفق' : 'Failed'}
              </span>
            )}
            {(log.durationMs !== undefined || log.dwellTimeMs !== undefined) && (
              <span className="text-[9px] font-mono text-slate-400 tabular-nums">
                {log.durationMs !== undefined
                  ? `${log.durationMs}ms`
                  : `${Math.round((log.dwellTimeMs || 0) / 1000)}s حضور`}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'details',
        header: isFa ? 'کالبدشکافی' : 'Inspect',
        width: 75,
        headerClassName: 'text-center',
        className: 'text-center',
        render: (log) => (
          <button
            type="button"
            onClick={() => {
              setSelectedLog(log);
              setShowRawJson(false);
            }}
            className="px-2.5 py-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition cursor-pointer inline-flex items-center gap-1 text-[11px] font-black border border-indigo-100 dark:border-indigo-900/50"
            title={isFa ? 'مشاهده جزئیات کالبدشکافی و تغییرات' : 'Inspect Forensic Details'}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        ),
      },
    ],
    [isFa]
  );

  return (
    <div className="space-y-4" data-audit-ignore="true">
      {/* 1. KPI TELEMETRY STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'کل رخدادهای ثبت‌شده' : 'Total Logged Events'}
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              {stats.total.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {isFa ? `از مجموع ${logs.length} رکورد در حافظه/DB` : `Of ${logs.length} total`}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'تغییرات داده‌ای و فرم‌ها' : 'Data & Field Mutations'}
            </div>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono tabular-nums mt-1">
              {stats.dataMutations.toLocaleString()}
            </div>
            <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-bold mt-0.5">
              {isFa ? `${stats.totalFieldDiffs} فیلد تغییر یافته (Before/After)` : `${stats.totalFieldDiffs} fields diffed`}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <GitCompare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'ریزحرکات و ناوبری کاربر' : 'User Micro-Movements'}
            </div>
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono tabular-nums mt-1">
              {stats.movements.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {isFa ? 'جابجایی ماژول، تب، کلیک و جستجو' : 'Tabs, clicks & searches'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Route className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'رخدادهای حساس و امنیتی' : 'Security & Sensitive'}
            </div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-1">
              {stats.securityAndSensitive.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {isFa ? 'حذف، مجوزها، ورود/خروج و خروجی‌ها' : 'Auth, RBAC, Delete & Exports'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {isFa ? 'کاربران فعال در لاگ' : 'Active Logged Actors'}
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
              {stats.activeUsers}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isLiveStream ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              <span>{isLiveStream ? (isFa ? 'ثبت زنده لحظه‌ای فعال' : 'Live Capture ON') : (isFa ? 'پایش زنده متوقف' : 'Paused')}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTROL BAR, VIEW MODE SWITCHER & FILTERS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        {/* Top Row: Title, View Switcher, Live Controls & Exports */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 dark:bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900 dark:text-white">
                  {isFa
                    ? 'مرکز جامع لاگ عملیاتی، ممیزی و ردگیری ریزحرکات کاربران'
                    : 'Forensic Operational Audit & User Micro-Activity Center'}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md">
                  {isFa ? 'حساسیت بالا (Micro-Tracking)' : 'Micro-Audit Active'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {isFa
                  ? 'ثبت خودکار کوچک‌ترین تغییرات مقادیر (قبل و بعد)، جابجایی بین تب‌ها و ماژول‌ها، کلیک‌ها، جستجوها و تراکنش‌های دیتابیس'
                  : 'Automatic capture of field-level diffs, module/tab navigation, UI interactions, searches, and API transactions'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* View Mode Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isFa ? 'جدول جامع لاگ' : 'Audit Table'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('journey')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'journey'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Route className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isFa ? 'مسیر حرکت کاربر (Timeline)' : 'User Journey'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('diffs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'diffs'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {isFa
                    ? `ریزتغییرات فیلدها (${allFieldDiffRows.length})`
                    : `Field Diffs (${allFieldDiffRows.length})`}
                </span>
              </button>
            </div>

            {/* Live Stream Toggle */}
            <button
              type="button"
              onClick={() => setIsLiveStream((p) => !p)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                isLiveStream
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
              title={isFa ? 'دریافت لحظه‌ای رویدادها بدون نیاز به رفرش' : 'Real-time stream'}
            >
              {isLiveStream ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
              <span>{isLiveStream ? (isFa ? 'زنده' : 'Live') : (isFa ? 'متوقف' : 'Paused')}</span>
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => loadAndMergeLogs(true)}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title={isFa ? 'بروزرسانی از پایگاه داده' : 'Refresh from DB'}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Exports */}
            <button
              type="button"
              onClick={exportToCsv}
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition border border-emerald-200 dark:border-emerald-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isFa ? 'Excel / CSV' : 'CSV'}</span>
            </button>
            <button
              type="button"
              onClick={exportToJson}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition border border-indigo-200 dark:border-indigo-800 cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={printLogs}
              className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isFa ? 'چاپ رسمی / PDF' : 'Print / PDF'}</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* Search Input */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={
                isFa
                  ? 'جستجو در کاربر، نام فیلد، مقدار قبلی/جدید، عملیات، IP، شناسه...'
                  : 'Search user, field, old/new value, action, IP...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-3 pr-9 text-xs font-bold focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 transition"
            />
          </div>

          {/* User Filter */}
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-bold focus:border-indigo-500 transition"
          >
            <option value="ALL">{isFa ? 'همه کاربران سامانه' : 'All Users'}</option>
            {uniqueUsers.map(([uname, label]) => (
              <option key={uname} value={uname}>
                {label}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-bold focus:border-indigo-500 transition"
          >
            <option value="ALL">{isFa ? 'همه دسته‌های عملیاتی' : 'All Categories'}</option>
            {(Object.keys(CATEGORY_META) as AuditCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {isFa ? CATEGORY_META[cat].labelFa : CATEGORY_META[cat].labelEn}
              </option>
            ))}
          </select>

          {/* Action Type Filter */}
          <select
            value={actionTypeFilter}
            onChange={(e) => setActionTypeFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-bold focus:border-indigo-500 transition"
          >
            <option value="ALL">{isFa ? 'همه انواع اقدام' : 'All Action Types'}</option>
            {Object.entries(ACTION_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {isFa ? `${meta.labelFa} (${key})` : meta.labelEn}
              </option>
            ))}
          </select>

          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-bold focus:border-indigo-500 transition"
          >
            <option value="ALL">{isFa ? 'همه ماژول‌ها و بخش‌ها' : 'All Modules'}</option>
            {uniqueModules.map((mod) => (
              <option key={mod} value={mod}>
                {mod}
              </option>
            ))}
          </select>

          {/* Time Range Filter */}
          <select
            value={timeRangeFilter}
            onChange={(e) => setTimeRangeFilter(e.target.value as TimeRangeFilter)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-2.5 text-xs font-bold focus:border-indigo-500 transition"
          >
            <option value="ALL">{isFa ? 'همه بازه‌های زمانی' : 'All Time'}</option>
            <option value="1H">{isFa ? '۱ ساعت گذشته' : 'Last 1 Hour'}</option>
            <option value="TODAY">{isFa ? 'امروز' : 'Today'}</option>
            <option value="7D">{isFa ? '۷ روز گذشته' : 'Last 7 Days'}</option>
            <option value="30D">{isFa ? '۳۰ روز گذشته' : 'Last 30 Days'}</option>
          </select>
        </div>

        {/* Secondary Filter Bar: Severity Chips, Micro-Movements Toggle & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 ml-1">
              {isFa ? 'سطح اهمیت:' : 'Severity:'}
            </span>
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const).map((sev) => {
              const active = severityFilter === sev;
              const label =
                sev === 'ALL'
                  ? isFa
                    ? 'همه سطوح'
                    : 'All'
                  : SEVERITY_META[sev].labelFa;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}

            <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2 text-[11px] font-bold"
            >
              <option value="ALL">{isFa ? 'وضعیت: همه' : 'Status: All'}</option>
              <option value="SUCCESS">{isFa ? 'فقط موفق' : 'Success Only'}</option>
              <option value="FAIL">{isFa ? 'فقط ناموفق / خطا' : 'Failed Only'}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={includeMicroMovements}
                onChange={(e) => setIncludeMicroMovements(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                {isFa
                  ? 'نمایش ریزحرکات، کلیک‌ها و جابجایی تب‌ها'
                  : 'Include UI clicks & tab movements'}
              </span>
            </label>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-black flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isFa ? 'پاکسازی فیلترها' : 'Reset Filters'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. VIEW MODE 1: FORENSIC LOG TABLE */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <VirtualizedDataTable
            data={filteredLogs}
            columns={auditColumns}
            height={620}
            isFa={isFa}
            emptyMessage={
              isFa
                ? 'هیچ رخداد یا لاگی با فیلترهای انتخابی یافت نشد'
                : 'No audit logs match the selected filters'
            }
          />
        </div>
      )}

      {/* 4. VIEW MODE 2: USER JOURNEY & MOVEMENT TIMELINE */}
      {viewMode === 'journey' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Route className="w-4 h-4 text-emerald-600" />
                <span>
                  {isFa
                    ? 'خط زمانی گام‌به‌گام مسیر حرکت و تعاملات کاربر در سامانه'
                    : 'Step-by-Step User Movement & Interaction Timeline'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isFa
                  ? 'مشاهده ترتیب زمانی دقیق ورود به ماژول‌ها، مدت توقف، کلیک‌ها و فیلدهای ویرایش‌شده توسط کاربر'
                  : 'Chronological replay of module switches, dwell time, clicks, and field edits'}
              </p>
            </div>
            <div className="text-xs font-bold text-slate-500">
              {isFa
                ? `نمایش ${Math.min(filteredLogs.length, 150)} گام اخیر`
                : `Showing latest ${Math.min(filteredLogs.length, 150)} steps`}
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto pr-2 space-y-2.5">
            {filteredLogs.slice(0, 150).map((log, idx) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="group relative flex items-start gap-3.5 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50/40 dark:bg-slate-800/20 hover:bg-white dark:hover:bg-slate-800/60 transition cursor-pointer"
              >
                {/* Step Number & Timeline Connector */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-mono text-[11px] font-black flex items-center justify-center shadow-2xs">
                    {idx + 1}
                  </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {getActionBadge(log.actionType)}
                      {getSeverityBadge(log.severity)}
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {log.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 tabular-nums">
                      <span>{log.tsFa || moment(log.ts).format('jYYYY/jMM/jDD HH:mm:ss')}</span>
                      {log.dwellTimeMs !== undefined && log.dwellTimeMs > 0 && (
                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-md font-bold">
                          {isFa
                            ? `مدت حضور قبلی: ${Math.round(log.dwellTimeMs / 1000)} ثانیه`
                            : `Dwell: ${Math.round(log.dwellTimeMs / 1000)}s`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      👤 {log.fullName ? `${log.fullName} (@${log.username})` : `@${log.username}`}
                    </span>
                    <span>•</span>
                    <span>
                      📂 {isFa ? 'ماژول:' : 'Module:'} <strong>{log.module}</strong>
                    </span>
                    {log.fromPath && log.toPath && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400">
                          {log.fromPath} ⬅ {log.toPath}
                        </span>
                      </>
                    )}
                    {log.elementTarget && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-slate-500">🎯 {log.elementTarget}</span>
                      </>
                    )}
                  </div>

                  {/* Inline Field Changes if any */}
                  {log.changes && log.changes.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2">
                      {log.changes.map((ch, cIdx) => (
                        <div
                          key={cIdx}
                          className="inline-flex items-center gap-1.5 text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1"
                        >
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {ch.fieldLabel || ch.field}:
                          </span>
                          <span className="text-rose-600 line-through font-mono">
                            {String(ch.oldValue ?? '-')}
                          </span>
                          <ArrowLeft className="w-3 h-3 text-slate-400" />
                          <span className="text-emerald-600 font-bold font-mono">
                            {String(ch.newValue ?? '-')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. VIEW MODE 3: DEDICATED FIELD-LEVEL DIFF MATRIX */}
      {viewMode === 'diffs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-blue-600" />
                <span>
                  {isFa
                    ? 'ماتریس کالبدشکافی تغییرات فیلدها (مقدار قبلی در برابر مقدار جدید)'
                    : 'Field-Level Before vs. After Diff Matrix'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isFa
                  ? 'تمامی تغییرات ثبت‌شده روی تک‌تک فیلدهای فرم‌ها، جداول و تنظیمات سامانه به تفکیک مقدار قبل و بعد'
                  : 'Every individual field modification across forms and database records'}
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black font-mono">
              {allFieldDiffRows.length} {isFa ? 'تغییر فیلد' : 'Field Changes'}
            </span>
          </div>

          <div className="max-h-[580px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 font-black text-slate-600 dark:text-slate-300 w-36">
                    {isFa ? 'زمان' : 'Time'}
                  </th>
                  <th className="p-3 font-black text-slate-600 dark:text-slate-300 w-40">
                    {isFa ? 'کاربر' : 'User'}
                  </th>
                  <th className="p-3 font-black text-slate-600 dark:text-slate-300 w-40">
                    {isFa ? 'ماژول / فرم' : 'Module'}
                  </th>
                  <th className="p-3 font-black text-slate-600 dark:text-slate-300 w-44">
                    {isFa ? 'نام فیلد تغییریافته' : 'Field Name'}
                  </th>
                  <th className="p-3 font-black text-rose-700 dark:text-rose-400">
                    {isFa ? 'مقدار قبلی (Before)' : 'Old Value'}
                  </th>
                  <th className="p-3 font-black text-emerald-700 dark:text-emerald-400">
                    {isFa ? 'مقدار جدید (After)' : 'New Value'}
                  </th>
                  <th className="p-3 font-black text-slate-600 dark:text-slate-300 w-20 text-center">
                    {isFa ? 'جزئیات' : 'Inspect'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allFieldDiffRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 font-bold">
                      {isFa
                        ? 'هیچ تغییر مقدار فیلدی در بازه و فیلتر فعلی ثبت نشده است.'
                        : 'No field-level changes found for current filters.'}
                    </td>
                  </tr>
                ) : (
                  allFieldDiffRows.slice(0, 300).map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                        {row.log.tsFa || moment(row.log.ts).format('jYYYY/jMM/jDD HH:mm:ss')}
                      </td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                        {row.log.fullName || `@${row.log.username}`}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-medium">
                        {row.log.module}
                      </td>
                      <td className="p-3">
                        <div className="font-black text-slate-800 dark:text-slate-200">
                          {row.fieldLabel}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{row.field}</div>
                      </td>
                      <td className="p-3 bg-rose-50/30 dark:bg-rose-950/15 text-rose-700 dark:text-rose-300 font-mono text-[11px] break-all max-w-xs">
                        {row.oldValue}
                      </td>
                      <td className="p-3 bg-emerald-50/30 dark:bg-emerald-950/15 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px] break-all max-w-xs">
                        {row.newValue}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(row.log)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. FORENSIC AUDIT LOG INSPECTOR MODAL */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-[99999] flex items-center justify-center p-4"
          data-audit-ignore="true"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                      {isFa ? 'کالبدشکافی کامل رخداد و ممیزی سیستم' : 'Forensic Event Inspector'}
                    </h3>
                    {getActionBadge(selectedLog.actionType)}
                    {getSeverityBadge(selectedLog.severity)}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    ID: {selectedLog.id} | Session: {selectedLog.sessionId || 'N/A'} | Hash:{' '}
                    {selectedLog.hash || 'VERIFIED'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawJson((p) => !p)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>{showRawJson ? (isFa ? 'نمای ساختاریافته' : 'Structured View') : 'JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {selectedLog.success === false && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-200">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-xs mb-1">
                      {isFa ? 'عملیات ناموفق / خطای ثبت‌شده' : 'Operation Failed'}
                    </h4>
                    <p className="text-xs">
                      {selectedLog.errorMessage || selectedLog.result || 'خطای سیستمی یا عدم مجوز'}
                    </p>
                  </div>
                </div>
              )}

              {showRawJson ? (
                <pre
                  dir="ltr"
                  className="p-4 bg-slate-950 text-emerald-400 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800"
                >
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              ) : (
                <>
                  {/* Action Banner */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-400">
                      {isFa ? 'شرح کامل اقدام ثبت‌شده:' : 'Recorded Action Summary:'}
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {selectedLog.action}
                    </div>
                    {selectedLog.description && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                        {selectedLog.description}
                      </div>
                    )}
                  </div>

                  {/* Metadata Grid: Actor + Context/Telemetry */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Actor Card */}
                    <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 bg-white dark:bg-slate-900">
                      <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                        <User className="w-4 h-4 text-emerald-600" />
                        <span>{isFa ? 'مشخصات کاربر و نشست (Actor & Session)' : 'Actor & Session'}</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div className="text-slate-500">{isFa ? 'نام و نام خانوادگی:' : 'Full Name:'}</div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {selectedLog.fullName || selectedLog.username}
                        </div>

                        <div className="text-slate-500">{isFa ? 'نام کاربری / کد پرسنلی:' : 'Username / Code:'}</div>
                        <div className="font-bold font-mono text-slate-800 dark:text-slate-200">
                          @{selectedLog.username} {selectedLog.userCode ? `(${selectedLog.userCode})` : ''}
                        </div>

                        <div className="text-slate-500">{isFa ? 'نقش سازمانی:' : 'Role:'}</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedLog.userRole || '-'}
                        </div>

                        <div className="text-slate-500">{isFa ? 'آدرس IP:' : 'IP Address:'}</div>
                        <div className="font-bold font-mono text-slate-800 dark:text-slate-200">
                          {selectedLog.ip || 'Local'}
                        </div>

                        <div className="text-slate-500">{isFa ? 'مرورگر و سیستم‌عامل:' : 'Browser / OS:'}</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {selectedLog.browser} ({selectedLog.device})
                        </div>

                        <div className="text-slate-500">{isFa ? 'شناسه نشست (Session):' : 'Session ID:'}</div>
                        <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {selectedLog.sessionId || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Technical & Movement Context Card */}
                    <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 bg-white dark:bg-slate-900">
                      <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        <span>
                          {isFa
                            ? 'اطلاعات فنی، مسیر و زمان‌بندی (Telemetry)'
                            : 'Technical & Movement Context'}
                        </span>
                      </h4>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div className="text-slate-500">{isFa ? 'زمان دقیق (شمسی):' : 'Persian Time:'}</div>
                        <div className="font-bold font-mono text-slate-900 dark:text-slate-100">
                          {selectedLog.tsFa || moment(selectedLog.ts).format('jYYYY/jMM/jDD HH:mm:ss')}
                        </div>

                        <div className="text-slate-500">{isFa ? 'زمان (UTC ISO):' : 'ISO Timestamp:'}</div>
                        <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {selectedLog.ts}
                        </div>

                        <div className="text-slate-500">{isFa ? 'ماژول و صفحه:' : 'Module / Page:'}</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {selectedLog.module} ({selectedLog.page})
                        </div>

                        <div className="text-slate-500">{isFa ? 'عنصر هدف / اندپوینت:' : 'Target / Endpoint:'}</div>
                        <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                          {selectedLog.endpoint
                            ? `${selectedLog.httpMethod || 'POST'} ${selectedLog.endpoint}`
                            : selectedLog.elementTarget || selectedLog.recordId || '-'}
                        </div>

                        <div className="text-slate-500">{isFa ? 'زمان پاسخ / حضور:' : 'Latency / Dwell:'}</div>
                        <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {selectedLog.durationMs !== undefined
                            ? `${selectedLog.durationMs} ms (HTTP ${selectedLog.statusCode || 200})`
                            : selectedLog.dwellTimeMs !== undefined
                            ? `${Math.round(selectedLog.dwellTimeMs / 1000)} ثانیه حضور در صفحه قبلی`
                            : '-'}
                        </div>

                        <div className="text-slate-500">{isFa ? 'شناسه رکورد هدف:' : 'Record ID:'}</div>
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {selectedLog.recordId || '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Field Changes Table (Before vs After) */}
                  {selectedLog.changes && selectedLog.changes.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="font-black text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <GitCompare className="w-4 h-4 text-blue-600" />
                        <span>
                          {isFa
                            ? `جدول مقایسه دقیق مقادیر تغییریافته (${selectedLog.changes.length} فیلد)`
                            : `Field-Level Changes (${selectedLog.changes.length})`}
                        </span>
                      </h4>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800">
                            <tr>
                              <th className="p-3 font-black text-slate-700 dark:text-slate-300 w-1/4">
                                {isFa ? 'نام فیلد' : 'Field'}
                              </th>
                              <th className="p-3 font-black text-rose-700 dark:text-rose-400 w-3/8 border-r border-slate-200 dark:border-slate-700">
                                {isFa ? 'مقدار قبلی (Before)' : 'Old Value'}
                              </th>
                              <th className="p-3 font-black text-emerald-700 dark:text-emerald-400 w-3/8 border-r border-slate-200 dark:border-slate-700">
                                {isFa ? 'مقدار جدید (After)' : 'New Value'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {selectedLog.changes.map((change, idx) => (
                              <tr key={idx} className="bg-white dark:bg-slate-900">
                                <td className="p-3">
                                  <div className="font-black text-slate-800 dark:text-slate-200">
                                    {change.fieldLabel || change.field}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {change.field}
                                  </div>
                                </td>
                                <td className="p-3 text-rose-700 dark:text-rose-300 bg-rose-50/30 dark:bg-rose-950/20 border-r border-slate-100 dark:border-slate-800 break-words font-mono text-[11px]">
                                  {typeof change.oldValue === 'object'
                                    ? JSON.stringify(change.oldValue)
                                    : String(change.oldValue ?? '-')}
                                </td>
                                <td className="p-3 text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20 border-r border-slate-100 dark:border-slate-800 break-words font-mono font-bold text-[11px]">
                                  {typeof change.newValue === 'object'
                                    ? JSON.stringify(change.newValue)
                                    : String(change.newValue ?? '-')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* User's Surrounding Movement Chain */}
                  {selectedUserTrail.length > 1 && (
                    <div className="space-y-2">
                      <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Route className="w-4 h-4 text-emerald-600" />
                        <span>
                          {isFa
                            ? `زنجیره حرکات مرتبط کاربر (@${selectedLog.username}) قبل و بعد از این رخداد`
                            : `Surrounding Activity Chain for @${selectedLog.username}`}
                        </span>
                      </h4>
                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                        {selectedUserTrail.map((item) => {
                          const isCurrent = item.id === selectedLog.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedLog(item)}
                              className={`p-2.5 px-3.5 flex items-center justify-between text-xs cursor-pointer transition ${
                                isCurrent
                                  ? 'bg-indigo-50/80 dark:bg-indigo-950/40 font-black'
                                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {getActionBadge(item.actionType)}
                                <span className="truncate text-slate-800 dark:text-slate-200">
                                  {item.action}
                                </span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 text-[9px] bg-indigo-600 text-white rounded font-bold">
                                    {isFa ? 'رخداد فعلی' : 'Current'}
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[10px] text-slate-400 shrink-0 mr-2">
                                {item.tsFa || moment(item.ts).format('HH:mm:ss')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cryptographic Integrity Footer */}
                  <div className="p-3 bg-slate-950 text-slate-300 rounded-xl flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono border border-slate-800">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Forensic Integrity Hash:</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedLog.hash || 'SHA-VERIFIED'}
                      </span>
                    </div>
                    {selectedLog.transactionId && (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Transaction ID:</span>
                        <span className="text-indigo-400">{selectedLog.transactionId}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
