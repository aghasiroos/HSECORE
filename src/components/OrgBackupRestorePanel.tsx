import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderTree,
  Building2,
  Briefcase,
  FileCheck2,
  RotateCcw,
  History,
  Check,
  X,
  Eye,
  Lock,
  UserCheck,
  Layers,
  ArchiveRestore,
} from 'lucide-react';
import { apiDb } from '../services/apiDatabaseClient';

export type OrgSubTabKey = 'org_hierarchy' | 'units_jobs' | 'incident_types' | 'ppe_equipment';

interface OrgBackupRestorePanelProps {
  isFa: boolean;
  canManageOrg: boolean;
  onDataRestored: () => Promise<void> | void;
}

const SUBTAB_META: Record<
  OrgSubTabKey,
  {
    titleFa: string;
    descriptionFa: string;
    icon: React.ComponentType<{ className?: string }>;
    badgeColor: string;
  }
> = {
  org_hierarchy: {
    titleFa: '۱. ساختار و چارت سازمانی (گره‌ها، روابط والد-فرزند و مسئولان واحدها)',
    descriptionFa:
      'شامل چارت درختی مجتمع، کدهای یکتا، ارتباطات بین واحدها، مدیران/سرپرستان متصل به پرسنل و جداول رابطه‌ای',
    icon: FolderTree,
    badgeColor: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
  },
  units_jobs: {
    titleFa: '۲. واحدها، زیرمجموعه‌ها و عناوین شغلی عملیاتی',
    descriptionFa:
      'شامل ساختار واحدهای عملیاتی، بخش‌های تابعه، سمت‌های شغلی اختصاصی و بانک مشاغل مجتمع',
    icon: Building2,
    badgeColor: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300',
  },
  incident_types: {
    titleFa: '۳. دسته‌بندی انواع حوادث و شبه‌حوادث HSE',
    descriptionFa: 'شامل کدهای استاندارد، گروه‌بندی شدت و تعاریف انواع رخدادهای ایمنی',
    icon: AlertTriangle,
    badgeColor: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
  },
  ppe_equipment: {
    titleFa: '۴. دسته‌بندی OSHA و فهرست تجهیزات حفاظت فردی (PPE)',
    descriptionFa: 'شامل گروه‌های استاندارد حفاظت فردی و کاتالوگ تجهیزات ایمنی مجتمع',
    icon: ShieldCheck,
    badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  },
};

export default function OrgBackupRestorePanel({
  isFa,
  canManageOrg,
  onDataRestored,
}: OrgBackupRestorePanelProps) {
  const [overview, setOverview] = useState<{
    liveCounts: {
      orgNodes: number;
      managersLinked: number;
      operationalUnits: number;
      operationalSubUnits: number;
      jobTitles: number;
      incidentTypes: number;
      ppeCategories: number;
      ppeItems: number;
      relationalCompanies: number;
      relationalSites: number;
      relationalDepartments: number;
      relationalUnits: number;
      relationalPositions: number;
    };
    snapshots: Array<{
      backupId: string;
      schemaFormat: string;
      schemaVersion: string;
      createdAt: string;
      persianDate: string;
      tag: 'manual' | 'pre_restore_safety' | 'auto_snapshot';
      createdBy: { username: string; fullName: string; role: string };
      includedSubTabs: OrgSubTabKey[];
      counts: Record<string, number>;
      payloadSha256: string;
    }>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);

  // Selected sub-tabs for creating backup
  const [backupSubTabs, setBackupSubTabs] = useState<Record<OrgSubTabKey, boolean>>({
    org_hierarchy: true,
    units_jobs: true,
    incident_types: true,
    ppe_equipment: true,
  });

  // Inspection / Preview state before restore
  const [inspectionResult, setInspectionResult] = useState<{
    sourceLabel: string;
    backupId?: string;
    backupPackage?: any;
    report: any;
  } | null>(null);

  // Selected sub-tabs to restore from the inspected backup
  const [restoreSubTabs, setRestoreSubTabs] = useState<Record<OrgSubTabKey, boolean>>({
    org_hierarchy: true,
    units_jobs: true,
    incident_types: true,
    ppe_equipment: true,
  });

  const [restoreMode, setRestoreMode] = useState<'safe_merge' | 'full_replace'>('safe_merge');
  const [showConfirmRestoreModal, setShowConfirmRestoreModal] = useState(false);
  const [rollbackConfirmSnapshotId, setRollbackConfirmSnapshotId] = useState<string | null>(null);

  // Last operation execution report
  const [executionReport, setExecutionReport] = useState<{
    type: 'backup' | 'restore' | 'rollback';
    success: boolean;
    title: string;
    details: string[];
    safetyBackupId?: string;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiDb.getOrgBackupOverview();
      if (data) setOverview(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // --------------------------------------------------------------------------
  // 1. Create Full or Selective Org Backup & Download JSON
  // --------------------------------------------------------------------------
  const handleCreateAndDownloadBackup = async () => {
    const selected = (Object.keys(backupSubTabs) as OrgSubTabKey[]).filter(
      (k) => backupSubTabs[k]
    );
    if (selected.length === 0) {
      setExecutionReport({
        type: 'backup',
        success: false,
        title: 'هیچ زیرتبی برای پشتیبان‌گیری انتخاب نشده است',
        details: ['لطفاً حداقل یکی از زیرتب‌های ساختار سازمانی را انتخاب نمایید.'],
      });
      return;
    }

    setIsCreatingBackup(true);
    try {
      const res = await apiDb.createOrgBackup(selected);
      if (!res.success || !res.data) {
        setExecutionReport({
          type: 'backup',
          success: false,
          title: 'خطا در تهیه نسخه پشتیبان ساختار سازمانی',
          details: [res.error || 'خطای ناشناخته در ارتباط با سرور'],
        });
        return;
      }

      const pkg = res.data;
      const jsonStr = JSON.stringify(pkg, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${pkg.metadata.backupId}.orgbackup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      await loadOverview();

      setExecutionReport({
        type: 'backup',
        success: true,
        title: `نسخه پشتیبان «${pkg.metadata.backupId}» با موفقیت تهیه، امضا و دانلود شد`,
        details: [
          `زیرتب‌های پوشش‌داده‌شده: ${selected.length} زیرتب`,
          `گره‌های چارت سازمانی: ${pkg.metadata.counts.orgNodes} واحد (${pkg.metadata.counts.managersLinked} مسئول/سرپرست متصل به بانک پرسنل)`,
          `واحدهای عملیاتی و زیرمجموعه‌ها: ${pkg.metadata.counts.operationalUnits} واحد و ${pkg.metadata.counts.operationalSubUnits} زیرمجموعه (${pkg.metadata.counts.jobTitles} عنوان شغلی)`,
          `دسته‌بندی حوادث: ${pkg.metadata.counts.incidentTypes} مورد | تجهیزات PPE: ${pkg.metadata.counts.ppeCategories} دسته و ${pkg.metadata.counts.ppeItems} تجهیز`,
          `چک‌سام رمزنگاری‌شده SHA-256: ${pkg.metadata.payloadSha256}`,
        ],
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. Upload Backup File & Inspect / Preview
  // --------------------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsInspecting(true);
    setInspectionResult(null);
    try {
      const text = await file.text();
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        setExecutionReport({
          type: 'restore',
          success: false,
          title: 'خطا در خواندن فایل پشتیبان',
          details: ['فایل انتخاب‌شده یک ساختار JSON معتبر نیست یا آسیب دیده است.'],
        });
        return;
      }

      const res = await apiDb.inspectOrgBackup({ backupPackage: parsedJson });
      if (!res.success || !res.data) {
        setExecutionReport({
          type: 'restore',
          success: false,
          title: 'اعتبارسنجی فایل پشتیبان ناموفق بود',
          details: [res.error || 'ساختار فایل پشتیبان با نسخه فعلی سامانه سازگار نیست.'],
        });
        return;
      }

      const available: OrgSubTabKey[] = res.data.availableSubTabs || [];
      setRestoreSubTabs({
        org_hierarchy: available.includes('org_hierarchy'),
        units_jobs: available.includes('units_jobs'),
        incident_types: available.includes('incident_types'),
        ppe_equipment: available.includes('ppe_equipment'),
      });

      setInspectionResult({
        sourceLabel: `فایل بارگذاری‌شده: ${file.name}`,
        backupPackage: parsedJson,
        report: res.data,
      });
    } finally {
      setIsInspecting(false);
    }
  };

  // --------------------------------------------------------------------------
  // 3. Inspect a Server-Stored Snapshot for Selective/Full Restore
  // --------------------------------------------------------------------------
  const handleInspectServerSnapshot = async (backupId: string) => {
    setIsInspecting(true);
    setInspectionResult(null);
    try {
      const res = await apiDb.inspectOrgBackup({ backupId });
      if (!res.success || !res.data) {
        setExecutionReport({
          type: 'restore',
          success: false,
          title: 'خطا در بارگذاری پیش‌نمایش نسخه سرور',
          details: [res.error || 'نسخه مورد نظر یافت نشد.'],
        });
        return;
      }

      const available: OrgSubTabKey[] = res.data.availableSubTabs || [];
      setRestoreSubTabs({
        org_hierarchy: available.includes('org_hierarchy'),
        units_jobs: available.includes('units_jobs'),
        incident_types: available.includes('incident_types'),
        ppe_equipment: available.includes('ppe_equipment'),
      });

      setInspectionResult({
        sourceLabel: `نسخه ذخیره‌شده در سرور: ${backupId}`,
        backupId,
        report: res.data,
      });
    } finally {
      setIsInspecting(false);
    }
  };

  // --------------------------------------------------------------------------
  // 4. Download a Server-Stored Snapshot as JSON
  // --------------------------------------------------------------------------
  const handleDownloadServerSnapshot = async (backupId: string) => {
    const res = await apiDb.getOrgSnapshotById(backupId);
    if (!res.success || !res.data) return;
    const jsonStr = JSON.stringify(res.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${backupId}.orgbackup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // --------------------------------------------------------------------------
  // 5. Execute Verified Full or Selective Restore
  // --------------------------------------------------------------------------
  const handleExecuteRestore = async () => {
    if (!inspectionResult) return;
    const selected = (Object.keys(restoreSubTabs) as OrgSubTabKey[]).filter(
      (k) => restoreSubTabs[k] && inspectionResult.report?.availableSubTabs?.includes(k)
    );
    if (selected.length === 0) return;

    setIsRestoring(true);
    try {
      const res = await apiDb.restoreOrgBackup({
        backupId: inspectionResult.backupId,
        backupPackage: inspectionResult.backupPackage,
        selectedSubTabs: selected,
        mode: restoreMode,
        confirmed: true,
      });

      setShowConfirmRestoreModal(false);

      if (!res.success || !res.data) {
        setExecutionReport({
          type: 'restore',
          success: false,
          title: 'عملیات بازیابی متوقف و به وضعیت قبلی بازگردانی شد',
          details: [res.error || 'خطا در بازیابی اطلاعات ساختار سازمانی'],
        });
        return;
      }

      const d = res.data;
      await onDataRestored();
      await loadOverview();

      setExecutionReport({
        type: 'restore',
        success: true,
        title: 'بازیابی اطلاعات ساختار سازمانی با موفقیت کامل در دیتابیس اصلی ثبت شد',
        safetyBackupId: d.safetyBackupId,
        details: [
          `حالت بازیابی: ${
            d.mode === 'safe_merge'
              ? 'ادغام هوشمند بدون بازنویسی ناخواسته (Safe Merge)'
              : 'جایگزینی کامل زیرتب‌های انتخابی (Full Replace)'
          }`,
          `نسخه پشتیبان ایمنی خودکار قبل از بازیابی: ${d.safetyBackupId}`,
          `چارت سازمانی: ${d.orgNodesRestored} گره سازمانی و ${d.managersLinked} مسئول/سرپرست متصل به بانک پرسنل`,
          `واحدها و مشاغل عملیاتی: ${d.unitsRestored} واحد، ${d.subUnitsRestored} زیرمجموعه و ${d.jobsRestored} عنوان شغلی`,
          `دسته‌بندی حوادث: ${d.incidentTypesRestored} مورد | تجهیزات PPE: ${d.ppeCategoriesRestored} دسته و ${d.ppeItemsRestored} تجهیز`,
          `جلوگیری از ایجاد رکوردهای تکراری: ${d.duplicatesPrevented} مورد تکراری شناسایی و مهار شد`,
        ],
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // --------------------------------------------------------------------------
  // 6. Instant Rollback to Pre-Restore Safety Snapshot
  // --------------------------------------------------------------------------
  const handleExecuteRollback = async (backupId: string) => {
    setIsRollingBack(backupId);
    try {
      const res = await apiDb.rollbackOrgBackup(backupId);
      setRollbackConfirmSnapshotId(null);

      if (!res.success) {
        setExecutionReport({
          type: 'rollback',
          success: false,
          title: 'خطا در بازگردانی به نسخه قبلی',
          details: [res.error || 'خطای ارتباط با سرور'],
        });
        return;
      }

      await onDataRestored();
      await loadOverview();

      setExecutionReport({
        type: 'rollback',
        success: true,
        title: `وضعیت ساختار سازمانی با موفقیت به نسخه «${backupId}» بازگردانی شد`,
        details: [
          `تمام زیرتب‌ها، روابط بین واحدها، مسئولان واحدها و جداول رابطه‌ای دیتابیس به نقطه زمانی ${res.data?.persianDate || backupId} بازگشتند.`,
        ],
      });
    } finally {
      setIsRollingBack(null);
    }
  };

  const lc = overview?.liveCounts;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-indigo-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>پشتیبان‌گیری و بازیابی یکپارچه ساختار سازمانی (SHA-256 + ترتیب توپولوژیک)</span>
            </div>
            <h4 className="text-lg md:text-xl font-black">
              مدیریت نسخه پشتیبان، پیش‌نمایش هوشمند و بازیابی انتخابی زیرتب‌های ساختار سازمانی
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              پوشش کامل چارت درختی، واحدهای سازمانی، مسئولان و سرپرستان متصل به پرسنل، زیرمجموعه‌ها، مشاغل عملیاتی، دسته‌بندی حوادث و تجهیزات PPE همراه با همگام‌سازی خودکار جداول رابطه‌ای PostgreSQL و تهیه نسخه پشتیبان ایمنی پیش از هر بازیابی.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block">گره‌های چارت سازمانی</span>
              <span className="text-base font-black text-amber-400 font-mono">
                {lc?.orgNodes ?? 0} واحد
              </span>
              <span className="text-[10px] text-emerald-300 block">
                {lc?.managersLinked ?? 0} مسئول متصل
              </span>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block">واحدها و مشاغل عملیاتی</span>
              <span className="text-base font-black text-indigo-300 font-mono">
                {lc?.operationalUnits ?? 0} واحد
              </span>
              <span className="text-[10px] text-slate-300 block">
                {lc?.operationalSubUnits ?? 0} بخش • {lc?.jobTitles ?? 0} شغل
              </span>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block">انواع حوادث HSE</span>
              <span className="text-base font-black text-rose-300 font-mono">
                {lc?.incidentTypes ?? 0} گروه
              </span>
              <span className="text-[10px] text-slate-300 block">استاندارد ثبت حوادث</span>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block">تجهیزات حفاظت فردی</span>
              <span className="text-base font-black text-emerald-300 font-mono">
                {lc?.ppeItems ?? 0} تجهیز
              </span>
              <span className="text-[10px] text-slate-300 block">
                در {lc?.ppeCategories ?? 0} دسته OSHA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Operation Execution Report Banner */}
      {executionReport && (
        <div
          className={`p-5 rounded-2xl border-2 space-y-3 ${
            executionReport.success
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-100'
              : 'bg-rose-50/90 border-rose-300 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-100'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              {executionReport.success ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              )}
              <h5 className="text-sm font-black">{executionReport.title}</h5>
            </div>
            <button
              onClick={() => setExecutionReport(null)}
              className="p-1 rounded-lg hover:bg-black/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ul className="space-y-1 text-xs pr-6 list-disc">
            {executionReport.details.map((line, idx) => (
              <li key={idx} className="font-bold">
                {line}
              </li>
            ))}
          </ul>

          {executionReport.safetyBackupId && (
            <div className="pt-2 flex items-center justify-between border-t border-emerald-200 dark:border-emerald-800/60">
              <span className="text-xs font-bold">
                در صورت نیاز می‌توانید با یک کلیک وضعیت را به نسخه ایمنی قبل از بازیابی بازگردانید:
              </span>
              <button
                onClick={() => setRollbackConfirmSnapshotId(executionReport.safetyBackupId!)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازگردانی فوری به وضعیت قبل از بازیابی</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main 2-Column Layout: 1. Create Backup | 2. Upload, Preview & Restore */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Column 1: Create Full or Selective Backup */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    ۱. تهیه نسخه پشتیبان یکپارچه از زیرتب‌های ساختار سازمانی
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold">
                    ذخیره در سرور + دانلود فایل JSON امضاشده با چک‌سام SHA-256
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setBackupSubTabs({
                    org_hierarchy: true,
                    units_jobs: true,
                    incident_types: true,
                    ppe_equipment: true,
                  })
                }
                className="text-[11px] font-black text-blue-600 dark:text-blue-400 hover:underline"
              >
                انتخاب همه زیرتب‌ها
              </button>
            </div>

            <div className="space-y-2.5">
              {(Object.keys(SUBTAB_META) as OrgSubTabKey[]).map((key) => {
                const meta = SUBTAB_META[key];
                const Icon = meta.icon;
                const checked = backupSubTabs[key];
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? 'bg-white dark:bg-slate-900 border-amber-400 dark:border-amber-600 shadow-xs'
                        : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setBackupSubTabs((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                      className="mt-1 w-4 h-4 accent-amber-500 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                          {meta.titleFa}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {meta.descriptionFa}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={handleCreateAndDownloadBackup}
              disabled={isCreatingBackup || !canManageOrg}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isCreatingBackup ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isCreatingBackup
                  ? 'در حال استخراج روابط، محاسبه SHA-256 و ثبت نسخه پشتیبان...'
                  : 'تهیه نسخه پشتیبان کامل و دانلود فایل (.orgbackup.json)'}
              </span>
            </button>
          </div>
        </div>

        {/* Column 2: Upload & Pre-Restore Inspection / Selective Restore */}
        <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  ۲. بارگذاری فایل پشتیبان، پیش‌نمایش تطبیقی و بازیابی کامل یا انتخابی
                </h4>
                <p className="text-[11px] text-slate-500 font-bold">
                  اعتبارسنجی ساختار، کنترل روابط والد-فرزند، جلوگیری از تکرار و تهیه پشتیبان ایمن قبل از بازیابی
                </p>
              </div>
            </div>

            <label className="block border-2 border-dashed border-indigo-400/70 dark:border-indigo-700 hover:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl p-6 text-center cursor-pointer transition-all">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
                disabled={!canManageOrg}
              />
              <Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-2" />
              <div className="text-xs font-black text-slate-800 dark:text-slate-100">
                {isInspecting
                  ? 'در حال اعتبارسنجی فایل و تحلیل روابط سازمانی...'
                  : 'انتخاب فایل پشتیبان ساختار سازمانی (.orgbackup.json یا .json)'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                پیش از هرگونه تغییر، پیش‌نمایش کامل زیرتب‌ها و گزارش تطبیق نمایش داده می‌شود
              </div>
            </label>

            {/* Pre-Restore Inspection & Selective Sub-Tab Preview Card */}
            {inspectionResult && (
              <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500/40 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 block">
                      {inspectionResult.sourceLabel}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 block" dir="ltr">
                      SHA-256: {inspectionResult.report.computedSha256?.slice(0, 24)}...
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${
                      inspectionResult.report.valid
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {inspectionResult.report.valid
                      ? 'فایل معتبر و سازگار با نسخه فعلی'
                      : 'فایل نامعتبر'}
                  </span>
                </div>

                {/* Integrity Checks Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">سلسله‌مراتب والد-فرزند</span>
                    <span className="text-xs font-black text-emerald-600">تأیید شده</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">تطبیق مسئولان با پرسنل</span>
                    <span className="text-xs font-black text-blue-600 font-mono">
                      {inspectionResult.report.integrityChecks?.managersLinkedToPersonnelDb || 0} نفر
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">تکرارهای مهارشده</span>
                    <span className="text-xs font-black text-amber-600 font-mono">
                      {inspectionResult.report.integrityChecks?.duplicatesPrevented || 0} مورد
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-500 block">اصلاح والد ناموجود</span>
                    <span className="text-xs font-black text-indigo-600 font-mono">
                      {inspectionResult.report.integrityChecks?.orphanParentsHealed || 0} مورد
                    </span>
                  </div>
                </div>

                {/* Selective Sub-Tabs Checkboxes with Preview Counts */}
                <div className="space-y-2">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                    انتخاب زیرتب‌های مورد نظر جهت بازیابی (بازیابی کامل یا انتخابی):
                  </div>
                  {(Object.keys(SUBTAB_META) as OrgSubTabKey[]).map((key) => {
                    const available = inspectionResult.report.availableSubTabs?.includes(key);
                    const p = inspectionResult.report.subTabPreview?.[key];
                    const checked = Boolean(restoreSubTabs[key] && available);

                    return (
                      <label
                        key={key}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                          !available
                            ? 'opacity-40 bg-slate-100 dark:bg-slate-800 cursor-not-allowed'
                            : checked
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-400 cursor-pointer'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={!available}
                            checked={checked}
                            onChange={() =>
                              setRestoreSubTabs((prev) => ({ ...prev, [key]: !prev[key] }))
                            }
                            className="w-4 h-4 accent-indigo-600 rounded"
                          />
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {SUBTAB_META[key].titleFa}
                          </span>
                        </div>

                        {available && p && (
                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 shrink-0">
                            {key === 'org_hierarchy' && (
                              <span>
                                پشتیبان: {p.totalInBackup} | جدید: +{p.newItemsToAdd}
                              </span>
                            )}
                            {key === 'units_jobs' && (
                              <span>
                                {p.unitsInBackup} واحد (+{p.newUnitsToAdd}) • {p.jobsInBackup} شغل
                              </span>
                            )}
                            {key === 'incident_types' && (
                              <span>
                                پشتیبان: {p.totalInBackup} (+{p.newItemsToAdd} جدید)
                              </span>
                            )}
                            {key === 'ppe_equipment' && (
                              <span>
                                {p.categoriesInBackup} دسته • {p.itemsInBackup} تجهیز
                              </span>
                            )}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Restore Strategy Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('safe_merge')}
                    className={`p-2.5 rounded-xl border text-right text-xs transition ${
                      restoreMode === 'safe_merge'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <div className="font-black">۱. ادغام ایمن (Safe Merge) — پیشنهادی</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      افزودن موارد جدید و حفظ کامل داده‌های فعلی بدون بازنویسی ناخواسته یا تکرار
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('full_replace')}
                    className={`p-2.5 rounded-xl border text-right text-xs transition ${
                      restoreMode === 'full_replace'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <div className="font-black">۲. بازگردانی و جایگزینی دقیق زیرتب‌های انتخابی</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      جایگزینی زیرتب‌های تیک‌خورده با اطلاعات نسخه پشتیبان (همراه با پشتیبان ایمنی خودکار)
                    </div>
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setInspectionResult(null)}
                    className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
                  >
                    بستن پیش‌نمایش
                  </button>
                  <button
                    type="button"
                    disabled={!inspectionResult.report.valid || !canManageOrg}
                    onClick={() => setShowConfirmRestoreModal(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <ArchiveRestore className="w-4 h-4" />
                    <span>تأیید و اجرای بازیابی زیرتب‌های انتخاب‌شده</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Server Snapshots & Safety Rollback Points */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                نقاط بازیابی و نسخه‌های پشتیبان ساختار سازمانی در سرور ({overview?.snapshots?.length || 0} نسخه)
              </h4>
              <p className="text-[11px] text-slate-500">
                شامل نسخه‌های دستی و نسخه‌های ایمنی خودکار تهیه‌شده پیش از هر عملیات بازیابی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadOverview}
            className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی</span>
          </button>
        </div>

        {!overview?.snapshots || overview.snapshots.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            هنوز نسخه پشتیبانی برای ماژول ساختار سازمانی ثبت نشده است.
          </div>
        ) : (
          <div className="space-y-2.5">
            {overview.snapshots.map((snap) => (
              <div
                key={snap.backupId}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                      {snap.backupId}
                    </code>
                    {snap.tag === 'pre_restore_safety' ? (
                      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                        پشتیبان ایمنی خودکار پیش از بازیابی
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                        نسخه پشتیبان دستی
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 font-bold">
                      زمان: {snap.persianDate} | کاربر: {snap.createdBy?.fullName || snap.createdBy?.username}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-3">
                    <span>چارت سازمانی: {snap.counts?.orgNodes ?? 0} واحد</span>
                    <span>•</span>
                    <span>مسئولان واحدها: {snap.counts?.managersLinked ?? 0} نفر</span>
                    <span>•</span>
                    <span>واحدهای عملیاتی: {snap.counts?.operationalUnits ?? 0} واحد</span>
                    <span>•</span>
                    <span>مشاغل: {snap.counts?.jobTitles ?? 0} عنوان</span>
                    <span>•</span>
                    <span>تجهیزات PPE: {snap.counts?.ppeItems ?? 0} مورد</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleInspectServerSnapshot(snap.backupId)}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>پیش‌نمایش و بازیابی انتخابی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadServerSnapshot(snap.backupId)}
                    className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>دانلود JSON</span>
                  </button>

                  <button
                    type="button"
                    disabled={!canManageOrg || isRollingBack === snap.backupId}
                    onClick={() => setRollbackConfirmSnapshotId(snap.backupId)}
                    className="px-3 py-1.5 text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-800 dark:text-amber-300 rounded-lg flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>بازگردانی کامل به این نقطه</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Selective/Full Restore */}
      {showConfirmRestoreModal && inspectionResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-6 h-6" />
                <h4 className="text-base font-black">تأیید نهایی بازیابی اطلاعات ساختار سازمانی</h4>
              </div>
              <button onClick={() => setShowConfirmRestoreModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="font-bold text-slate-800 dark:text-slate-100">
                پیش از اعمال تغییرات، سامانه به‌طور خودکار یک نسخه پشتیبان ایمنی (pre_restore_safety) از وضعیت فعلی ساختار سازمانی تهیه می‌کند.
              </p>
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 space-y-1">
                <div>
                  <strong>منبع:</strong> {inspectionResult.sourceLabel}
                </div>
                <div>
                  <strong>زیرتب‌های انتخاب‌شده:</strong>{' '}
                  {(Object.keys(restoreSubTabs) as OrgSubTabKey[])
                    .filter((k) => restoreSubTabs[k])
                    .map((k) => SUBTAB_META[k].titleFa.split('(')[0])
                    .join(' ، ')}
                </div>
                <div>
                  <strong>استراتژی بازیابی:</strong>{' '}
                  {restoreMode === 'safe_merge'
                    ? 'ادغام ایمن بدون بازنویسی اطلاعات موجود و بدون ایجاد رکورد تکراری'
                    : 'جایگزینی کامل اطلاعات زیرتب‌های انتخاب‌شده'}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmRestoreModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-2"
              >
                {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>تأیید و اجرای بازیابی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Rollback */}
      {rollbackConfirmSnapshotId && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="w-6 h-6" />
              <h4 className="text-base font-black">بازگردانی به نقطه پشتیبان ایمنی</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              آیا از بازگردانی کامل تمام زیرتب‌های ساختار سازمانی به نسخه{' '}
              <code className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                {rollbackConfirmSnapshotId}
              </code>{' '}
              اطمینان دارید؟
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRollbackConfirmSnapshotId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRollback(rollbackConfirmSnapshotId)}
                disabled={Boolean(isRollingBack)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5"
              >
                {isRollingBack ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>تأیید و بازگردانی فوری</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
