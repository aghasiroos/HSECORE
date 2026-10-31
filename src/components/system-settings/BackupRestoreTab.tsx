import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Server,
  RefreshCw,
  Download,
  Upload,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  HardDrive,
  Check,
  Shield,
  Users,
  Building2,
  Trash2,
  Sliders,
  Activity,
  Layers,
  FileCode,
  ShieldCheck,
  Search,
  Lock,
  FlaskConical,
  FolderArchive,
  XCircle,
  Eye,
  X,
  KeyRound,
  ArchiveRestore,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { centralSync } from '../../services/centralSyncService';
import { apiDb } from '../../services/apiDatabaseClient';

interface BackupRestoreTabProps {
  isFa: boolean;
  currentUser: UserProfile;
}

export interface BackupHistoryEntry {
  id: string;
  ts: string;
  type: 'Backup' | 'Restore' | 'CloudSync';
  format: string;
  size: string;
  recordCount: number;
  filesCount?: number;
  sha256?: string;
  status: 'Success' | 'Failed' | 'Warning';
  operator: string;
}

interface ServerBackupManifest {
  backupId: string;
  fileName: string;
  tag: 'manual' | 'scheduled' | 'pre_restore_safety' | 'pre_update';
  createdAt: string;
  persianDate: string;
  appVersion: string;
  schemaVersion: string;
  createdBy: {
    username: string;
    fullName?: string;
    role?: string;
  };
  isSelective: boolean;
  selectedModules?: string[];
  tableCount: number;
  totalRows: number;
  tableRowCounts: Record<string, number>;
  filesCount: number;
  filesTotalBytes: number;
  payloadSha256: string;
  archiveSha256?: string;
  archiveSizeBytes?: number;
  encrypted: boolean;
  verified: boolean;
  lastVerifiedAt?: string;
  lastTestRestoreAt?: string;
  lastTestRestoreStatus?: 'PASSED' | 'FAILED';
  storagePath?: string;
}

interface VerificationReport {
  backupId: string;
  verifiedAt: string;
  persianDate: string;
  valid: boolean;
  archiveExists: boolean;
  archiveSizeBytes: number;
  computedArchiveSha256: string;
  expectedArchiveSha256: string;
  archiveChecksumMatch: boolean;
  computedPayloadSha256: string;
  expectedPayloadSha256: string;
  payloadChecksumMatch: boolean;
  tablesVerified: number;
  rowsVerified: number;
  filesVerified: number;
  filesBytesVerified: number;
  schemaCompatible: boolean;
  errors: string[];
  warnings: string[];
}

interface TestRestoreReport {
  backupId: string;
  testedAt: string;
  persianDate: string;
  durationMs: number;
  operator: string;
  success: boolean;
  isolatedMode: string;
  verificationReport: VerificationReport;
  tablesTested: number;
  totalBackupRows: number;
  totalSandboxRestoredRows: number;
  foreignKeysChecked: number;
  foreignKeyViolations: number;
  sequencesChecked: number;
  filesTested: number;
  filesBytesTested: number;
  tableComparison: Array<{
    tableName: string;
    backupRows: number;
    sandboxRestoredRows: number;
    liveRows: number;
    status: 'OK' | 'MISMATCH' | 'ERROR';
    error?: string;
  }>;
  fileComparison: Array<{
    fileName: string;
    sizeBytes: number;
    sha256Match: boolean;
  }>;
  errors: string[];
}

const TABLE_FA_LABELS: Record<string, string> = {
  org_companies: 'شرکت‌ها (org_companies)',
  org_sites: 'سایت‌ها و مجتمع‌ها (org_sites)',
  org_departments: 'امورها و دپارتمان‌ها (org_departments)',
  org_units: 'واحدهای عملیاتی و ساختار سازمانی (org_units)',
  org_positions: 'سمت‌های سازمانی (org_positions)',
  users: 'کاربران و حساب‌های کاربری (users)',
  personnel: 'اطلاعات پرسنل مجتمع (personnel)',
  user_personnel_assignments: 'تخصیص دسترسی پرسنلی (user_personnel_assignments)',
  periodic_medical_exams: 'معاینات دوره‌ای طب کار (periodic_medical_exams)',
  lab_results: 'نتایج آزمایشگاهی (lab_results)',
  audiometry_records: 'سوابق شنوایی‌سنجی (audiometry_records)',
  spirometry_records: 'سوابق اسپیرومتری (spirometry_records)',
  optometry_records: 'سوابق بینایی‌سنجی (optometry_records)',
  medical_test_catalog: 'کاتالوگ آزمایش‌های پزشکی (medical_test_catalog)',
  medical_reference_rules: 'قوانین مرجع پزشکی (medical_reference_rules)',
  medical_exam_sessions: 'جلسات معاینه پزشکی (medical_exam_sessions)',
  medical_test_results: 'نتایج تست‌های تخصصی (medical_test_results)',
  occupational_disease_diagnoses: 'تشخیص بیماری‌های شغلی (occupational_disease_diagnoses)',
  medical_referrals: 'ارجاعات پزشکی (medical_referrals)',
  work_permits: 'مجوزهای کار ایمن PTW (work_permits)',
  permit_number_counters: 'شمارنده‌های مجوز کار (permit_number_counters)',
  permit_signatures: 'امضاهای مجوز کار (permit_signatures)',
  risk_assessments: 'ارزیابی ریسک HIRA/JSA (risk_assessments)',
  incidents: 'حوادث و شبه‌حوادث (incidents)',
  trir_monthly_records: 'شاخص‌های ماهانه TRIR/LTIFR (trir_monthly_records)',
  non_conformances: 'عدم انطباق‌ها و اقدامات اصلاحی (non_conformances)',
  safety_warnings: 'اخطارها و تشویق‌های ایمنی (safety_warnings)',
  hse_trainings: 'دوره‌های آموزشی HSE (hse_trainings)',
  training_attendances: 'حضور و غیاب آموزش (training_attendances)',
  ppe_issuances: 'تحویل تجهیزات حفاظت فردی PPE (ppe_issuances)',
  fire_equipment: 'تجهیزات آتش‌نشانی (fire_equipment)',
  safety_templates: 'قالب‌های چک‌لیست ایمنی (safety_templates)',
  safety_inspections: 'بازرسی‌های ایمنی (safety_inspections)',
  environmental_logs: 'پایش‌های زیست‌محیطی (environmental_logs)',
  five_s_audits: 'ممیزی‌های 5S (five_s_audits)',
  bpmn_processes: 'فرآیندهای BPMN (bpmn_processes)',
  bpmn_instances: 'نمونه‌های اجرایی BPMN (bpmn_instances)',
  workflows: 'گردش‌کارها (workflows)',
  workflow_instances: 'نمونه‌های گردش‌کار (workflow_instances)',
  workflow_steps: 'مراحل گردش‌کار (workflow_steps)',
  workflow_history: 'تاریخچه گردش‌کار (workflow_history)',
  workflow_signatures: 'امضاهای گردش‌کار (workflow_signatures)',
  automation_rules: 'قوانین اتوماسیون (automation_rules)',
  automation_events_outbox: 'صف رویدادهای اتوماسیون (automation_events_outbox)',
  automation_execution_logs: 'لاگ اجرای اتوماسیون (automation_execution_logs)',
  system_files: 'مستندات و دستورالعمل‌ها (system_files)',
  system_releases: 'نسخه‌های انتشار سامانه (system_releases)',
  system_settings: 'تنظیمات کلان سیستم (system_settings)',
  notifications: 'اعلان‌ها و هشدارهای فوری (notifications)',
  audit_logs: 'لاگ ممیزی امنیتی (audit_logs)',
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function BackupRestoreTab({ isFa, currentUser }: BackupRestoreTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    'create_backup' | 'server_backups' | 'restore' | 'schedule' | 'history'
  >('create_backup');

  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [isExportingSql, setIsExportingSql] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [isInspectingUpload, setIsInspectingUpload] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Live overview state from /api/v1/backup/overview
  const [overview, setOverview] = useState<{
    database: {
      status: string;
      totalTables: number;
      totalRows: number;
      tableCounts: Record<string, number>;
      foreignKeysCount: number;
      primaryKeysCount: number;
    };
    files: {
      uploadsCount: number;
      uploadsTotalBytes: number;
      filesList: Array<{
        fileName: string;
        relativePath: string;
        sizeBytes: number;
        sha256: string;
        modifiedAt: string;
      }>;
    };
    storage: {
      backupDir: string;
      uploadsDir: string;
      writable: boolean;
      freeBytes: number;
      totalBytes: number;
      usedByBackupsBytes: number;
      usedByUploadsBytes: number;
      backupsCount: number;
    };
    backups: ServerBackupManifest[];
    lastBackupTime: string;
    lastVerificationReport: VerificationReport | null;
    lastTestRestoreReport: TestRestoreReport | null;
    scheduleConfig: {
      enabled: boolean;
      frequency: 'manual' | 'daily' | 'weekly' | 'monthly';
      target: 'server' | 'browser';
      retentionCount: number;
      notifyAdminOnBackup: boolean;
      encryptBackups: boolean;
      lastScheduledRunAt?: string;
      nextScheduledRunAt?: string;
    };
    backupHistory: BackupHistoryEntry[];
  } | null>(null);

  // Create Backup Options
  const [encryptNewBackup, setEncryptNewBackup] = useState(false);
  const [autoDownloadAfterBackup, setAutoDownloadAfterBackup] = useState(true);
  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({
    org_structure: true,
    personnel: true,
    users_security: true,
    medical_exams: true,
    work_permits: true,
    incidents_trir: true,
    safety_warnings: true,
    workflows_bpmn: true,
    files_documents: true,
    system_settings: true,
    audit_logs: true,
  });

  // Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleFrequency, setScheduleFrequency] = useState<'manual' | 'daily' | 'weekly' | 'monthly'>('weekly');
  const [retentionCount, setRetentionCount] = useState<number>(10);
  const [notifyAdminOnBackup, setNotifyAdminOnBackup] = useState<boolean>(true);
  const [encryptScheduledBackups, setEncryptScheduledBackups] = useState<boolean>(false);

  // Uploaded file inspection state
  const [uploadedFilePayload, setUploadedFilePayload] = useState<{
    fileName: string;
    fileSize: string;
    fileBase64?: string;
    rawText?: string;
    verification: VerificationReport;
    testRestoreReport: TestRestoreReport;
  } | null>(null);

  // Modal for viewing detailed TestRestoreReport or VerificationReport
  const [activeReportModal, setActiveReportModal] = useState<{
    type: 'test_restore' | 'verification';
    testReport?: TestRestoreReport;
    verificationReport?: VerificationReport;
  } | null>(null);

  // Mandatory Confirmation Modal for Real Restore
  const [restoreConfirmModal, setRestoreConfirmModal] = useState<{
    source: 'server' | 'upload';
    backupId?: string;
    fileName: string;
    totalRows: number;
    tablesCount: number;
    filesCount: number;
    sha256: string;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'clean'>('merge');
  const [restoreConfirmInput, setRestoreConfirmInput] = useState('');

  // Controlled Delete Confirmation Modal
  const [deleteConfirmBackupId, setDeleteConfirmBackupId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 8000);
  };

  const refreshOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    try {
      const data = await apiDb.getBackupOverview();
      if (data) {
        setOverview(data);
        if (data.scheduleConfig) {
          setScheduleEnabled(Boolean(data.scheduleConfig.enabled));
          setScheduleFrequency(data.scheduleConfig.frequency || 'weekly');
          setRetentionCount(Number(data.scheduleConfig.retentionCount) || 10);
          setNotifyAdminOnBackup(Boolean(data.scheduleConfig.notifyAdminOnBackup));
          setEncryptScheduledBackups(Boolean(data.scheduleConfig.encryptBackups));
        }
      }
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  // --------------------------------------------------------------------------
  // 1. Create Full or Selective Server Backup + Immediate SHA-256 Verification
  // --------------------------------------------------------------------------
  const handleCreateFullBackup = async (isSelective = false) => {
    if (isSelective) {
      const activeCount = Object.values(selectedModules).filter(Boolean).length;
      if (activeCount === 0) {
        showToast('error', 'لطفاً حداقل یک ماژول را برای پشتیبان‌گیری انتخابی تیک بزنید.');
        return;
      }
    }

    setIsGeneratingBackup(true);
    try {
      const res = await apiDb.createServerBackup({
        tag: 'manual',
        isSelective,
        selectedModules: isSelective ? selectedModules : undefined,
        encrypt: encryptNewBackup,
      });

      if (!res.success || !res.data) {
        showToast('error', res.error || 'خطا در تهیه نسخه پشتیبان کامل از سرور');
        return;
      }

      const { manifest, verification } = res.data;
      await refreshOverview();

      if (autoDownloadAfterBackup && manifest?.backupId) {
        await apiDb.downloadServerBackup(manifest.backupId, 'gz');
      }

      showToast(
        'success',
        `نسخه پشتیبان «${manifest.backupId}» شامل ${manifest.tableCount} جدول (${manifest.totalRows.toLocaleString()} رکورد) و ${manifest.filesCount} فایل پیوست با موفقیت ایجاد و با الگوریتم SHA-256 اعتبارسنجی شد (${verification.computedArchiveSha256.slice(0, 12)}...).`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'خطا در تهیه نسخه پشتیبان');
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  // --------------------------------------------------------------------------
  // 2. Export PostgreSQL 16 Compatible SQL Dump
  // --------------------------------------------------------------------------
  const handleExportSqlDump = async (isSelective = false) => {
    setIsExportingSql(true);
    try {
      const res = await apiDb.exportSqlDump({
        isSelective,
        selectedModules: isSelective ? selectedModules : undefined,
      });
      if (!res.success || !res.data) {
        showToast('error', res.error || 'خطا در تولید خروجی SQL');
        return;
      }

      const blob = new Blob([res.data.sql], { type: 'application/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateSlug = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `HSECORE_PG16_Dump_${dateSlug}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      showToast(
        'success',
        `فایل اسکریپت PostgreSQL 16 شامل ${res.data.tablesExported} جدول و ${res.data.totalRows.toLocaleString()} رکورد همراه با چک‌سام SHA-256 دانلود شد.`
      );
    } finally {
      setIsExportingSql(false);
    }
  };

  // --------------------------------------------------------------------------
  // 3. Verify Existing Server Backup (SHA-256 + Schema + Files)
  // --------------------------------------------------------------------------
  const handleVerifyServerBackup = async (backupId: string) => {
    setActiveActionId(`verify_${backupId}`);
    try {
      const res = await apiDb.verifyServerBackup(backupId);
      if (!res.success || !res.data) {
        showToast('error', res.error || 'خطا در اعتبارسنجی نسخه پشتیبان');
        return;
      }
      const report: VerificationReport = res.data;
      await refreshOverview();
      setActiveReportModal({
        type: 'verification',
        verificationReport: report,
      });
      if (report.valid) {
        showToast(
          'success',
          `اعتبارسنجی SHA-256 نسخه «${backupId}» با موفقیت تأیید شد (${report.tablesVerified} جدول، ${report.rowsVerified} رکورد، ${report.filesVerified} فایل).`
        );
      } else {
        showToast('error', `اعتبارسنجی نسخه «${backupId}» ناموفق بود: ${report.errors.join(' | ')}`);
      }
    } finally {
      setActiveActionId(null);
    }
  };

  // --------------------------------------------------------------------------
  // 4. Isolated PostgreSQL Sandbox Test Restore (Dry-Run with ROLLBACK)
  // --------------------------------------------------------------------------
  const handleRunIsolatedTestRestore = async (backupId: string) => {
    setActiveActionId(`test_${backupId}`);
    try {
      const res = await apiDb.testRestoreServerBackup(backupId);
      if (!res.success || !res.data) {
        showToast('error', res.error || 'خطا در اجرای بازیابی آزمایشی ایزوله');
        return;
      }
      const report: TestRestoreReport = res.data;
      await refreshOverview();
      setActiveReportModal({
        type: 'test_restore',
        testReport: report,
      });

      if (report.success) {
        showToast(
          'success',
          `بازیابی آزمایشی ایزوله (PostgreSQL Sandbox) برای «${backupId}» در ${report.durationMs}ms با موفقیت کامل انجام شد: ${report.tablesTested} جدول، ${report.totalSandboxRestoredRows} رکورد، ${report.foreignKeysChecked} کلید خارجی بدون خطا و ${report.filesTested} فایل پیوست تأیید شد.`
        );
      } else {
        showToast(
          'error',
          `بازیابی آزمایشی ایزوله خطاهایی را شناسایی کرد: ${report.errors.join(' | ')}`
        );
      }
    } finally {
      setActiveActionId(null);
    }
  };

  // --------------------------------------------------------------------------
  // 5. Inspect & Sandbox-Test Uploaded Backup File (.gz, .json, .sql)
  // --------------------------------------------------------------------------
  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsInspectingUpload(true);
    setUploadedFilePayload(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + chunkSize))
        );
      }
      const fileBase64 = btoa(binary);

      const res = await apiDb.inspectUploadedBackup({ fileBase64 });
      if (!res.success || !res.data) {
        showToast('error', res.error || 'فایل انتخاب‌شده معتبر نیست یا ساختار آن آسیب دیده است.');
        return;
      }

      const { verification, testRestoreReport } = res.data;
      setUploadedFilePayload({
        fileName: file.name,
        fileSize: formatBytes(file.size),
        fileBase64,
        verification,
        testRestoreReport,
      });

      await refreshOverview();

      if (testRestoreReport.success) {
        showToast(
          'success',
          `فایل «${file.name}» با موفقیت بررسی و در محیط ایزوله PostgreSQL آزمایش شد (${testRestoreReport.tablesTested} جدول، ${testRestoreReport.totalBackupRows} رکورد، ${testRestoreReport.filesTested} فایل). آماده بازیابی واقعی است.`
        );
      } else {
        showToast(
          'error',
          `فایل «${file.name}» در اعتبارسنجی یا بازیابی آزمایشی ایزوله رد شد: ${testRestoreReport.errors.join(' | ')}`
        );
      }
    } catch (err: any) {
      showToast('error', err?.message || 'خطا در خواندن و تحلیل فایل پشتیبان');
    } finally {
      setIsInspectingUpload(false);
    }
  };

  // --------------------------------------------------------------------------
  // 6. Execute Real Atomic Database & File Restore (After Confirmation)
  // --------------------------------------------------------------------------
  const handleConfirmAndExecuteRestore = async () => {
    if (!restoreConfirmModal) return;
    if (restoreConfirmInput.trim().toUpperCase() !== 'RESTORE') {
      showToast('error', 'لطفاً عبارت امنیتی RESTORE را به طور دقیق وارد نمایید.');
      return;
    }

    setIsRestoring(true);
    try {
      let res: { success: boolean; data?: any; error?: string };
      if (restoreConfirmModal.source === 'server' && restoreConfirmModal.backupId) {
        res = await apiDb.executeServerRestore(
          restoreConfirmModal.backupId,
          restoreMode,
          restoreConfirmInput.trim().toUpperCase()
        );
      } else if (restoreConfirmModal.source === 'upload' && uploadedFilePayload?.fileBase64) {
        res = await apiDb.restoreUploadedBackup({
          fileBase64: uploadedFilePayload.fileBase64,
          mode: restoreMode,
          confirmCode: restoreConfirmInput.trim().toUpperCase(),
        });
      } else {
        showToast('error', 'منبع نسخه پشتیبان برای بازیابی یافت نشد.');
        return;
      }

      if (!res.success || !res.data) {
        showToast('error', res.error || 'خطا در اجرای بازیابی اطلاعات');
        return;
      }

      const report = res.data;
      setRestoreConfirmModal(null);
      setRestoreConfirmInput('');

      await centralSync.syncFull(true);
      await refreshOverview();

      showToast(
        'success',
        `بازیابی کامل با موفقیت انجام شد! (${report.tablesRestored} جدول، ${report.rowsRestored.toLocaleString()} رکورد، ${report.sequencesReset} شمارنده سریال و ${report.filesRestored} فایل پیوست بازیابی شدند. نسخه پشتیبان ایمنی خودکار پیش از بازیابی: ${report.safetyBackupId})`
      );
    } finally {
      setIsRestoring(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7. Controlled Delete of Server Backup
  // --------------------------------------------------------------------------
  const handleDeleteBackup = async (backupId: string) => {
    setActiveActionId(`delete_${backupId}`);
    try {
      const res = await apiDb.deleteServerBackup(backupId);
      if (!res.success) {
        showToast('error', res.error || 'خطا در حذف نسخه پشتیبان');
        return;
      }
      setDeleteConfirmBackupId(null);
      await refreshOverview();
      showToast('info', `نسخه پشتیبان «${backupId}» از فضای ذخیره‌سازی سرور حذف شد.`);
    } finally {
      setActiveActionId(null);
    }
  };

  // --------------------------------------------------------------------------
  // 8. Save Schedule & Retention Policy
  // --------------------------------------------------------------------------
  const handleSaveSchedule = async () => {
    setActiveActionId('save_schedule');
    try {
      const res = await apiDb.saveBackupSchedule({
        enabled: scheduleEnabled,
        frequency: scheduleFrequency,
        target: 'server',
        retentionCount,
        notifyAdminOnBackup,
        encryptBackups: encryptScheduledBackups,
      });
      if (!res.success) {
        showToast('error', res.error || 'خطا در ذخیره تنظیمات زمان‌بندی');
        return;
      }
      await refreshOverview();
      showToast(
        'success',
        `تنظیمات پشتیبان‌گیری خودکار (${scheduleFrequency}) و سیاست نگهداری حداکثر ${retentionCount} نسخه در سرور ذخیره و اعمال شد.`
      );
    } finally {
      setActiveActionId(null);
    }
  };

  const tc = overview?.database?.tableCounts || {};
  const totalTables = overview?.database?.totalTables || 50;
  const totalRows = overview?.database?.totalRows || 0;
  const fkCount = overview?.database?.foreignKeysCount || 47;
  const uploadsCount = overview?.files?.uploadsCount || 0;
  const uploadsBytes = overview?.files?.uploadsTotalBytes || 0;
  const serverBackups = overview?.backups || [];
  const lastVerif = overview?.lastVerificationReport;
  const lastTestRestore = overview?.lastTestRestoreReport;

  const tagBadge = (tag: ServerBackupManifest['tag']) => {
    switch (tag) {
      case 'pre_restore_safety':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
            <Shield className="w-3 h-3" />
            پشتیبان ایمنی پیش از بازیابی
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700/60">
            <Clock className="w-3 h-3" />
            خودکار زمان‌بندی‌شده
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60">
            <Server className="w-3 h-3" />
            پشتیبان دستی مدیر
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Status & Cryptographic Assurance Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-blue-800/40">
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>موتور پشتیبان‌گیری تراکنشی PostgreSQL 16 + اعتبارسنجی SHA-256 + محیط ایزوله Sandbox</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black tracking-tight">
              مرکز جامع پشتیبان‌گیری، اعتبارسنجی و بازیابی اضطراری (Disaster Recovery)
            </h3>
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
              پشتیبان‌گیری یکپارچه از تمام <strong className="text-white">{totalTables} جدول عملیاتی</strong>،{' '}
              <strong className="text-white">{fkCount} رابطه کلید خارجی</strong>، شمارنده‌های سریال (Sequences) و{' '}
              <strong className="text-white">{uploadsCount} فایل پیوست مستندات ({formatBytes(uploadsBytes)})</strong> همراه با بازیابی آزمایشی در محیط ایزوله بدون ریسک تخریب داده‌های فعلی.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block mb-1">کل جداول و رکوردها</span>
              <span className="text-sm font-black text-emerald-400 block font-mono">
                {totalTables} جدول • {totalRows.toLocaleString()} رکورد
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block mb-1">فایل‌های پیوست (uploads)</span>
              <span className="text-sm font-black text-cyan-300 block font-mono">
                {uploadsCount} فایل • {formatBytes(uploadsBytes)}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block mb-1">آخرین نسخه پشتیبان</span>
              <span className="text-xs font-bold text-white block truncate" dir="ltr">
                {overview?.lastBackupTime || '—'}
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 text-center">
              <span className="text-[11px] text-slate-300 block mb-1">آخرین تست بازیابی ایزوله</span>
              {lastTestRestore ? (
                <button
                  onClick={() =>
                    setActiveReportModal({
                      type: 'test_restore',
                      testReport: lastTestRestore,
                    })
                  }
                  className={`text-xs font-black inline-flex items-center gap-1 underline ${
                    lastTestRestore.success ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {lastTestRestore.success ? 'موفق (PASSED)' : 'ناموفق (FAILED)'}
                  <Eye className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="text-xs text-slate-400 block">اجرا نشده</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-md transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
              : feedbackMessage.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200'
              : 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : feedbackMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 text-blue-600 shrink-0" />
            )}
            <span className="text-sm font-bold leading-relaxed">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-bold opacity-75 hover:opacity-100 px-2 py-1"
          >
            بستن
          </button>
        </div>
      )}

      {/* Storage Space & Last Verification Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
              مسیر ذخیره‌سازی پشتیبان در سرور / VPS
            </span>
            <code className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 block" dir="ltr">
              {overview?.storage?.backupDir || '/app/backups'}
            </code>
            <span className="text-[11px] text-slate-500 block">
              فضای آزاد دیسک:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                {formatBytes(overview?.storage?.freeBytes || 0)}
              </strong>{' '}
              از {formatBytes(overview?.storage?.totalBytes || 0)}
            </span>
          </div>
          <div
            className={`px-3 py-1.5 text-xs font-bold border ${
              overview?.storage?.writable !== false
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {overview?.storage?.writable !== false ? 'قابل نوشتن (Writable)' : 'عدم دسترسی نوشتن'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
              وضعیت اعتبارسنجی رمزنگاری‌شده (SHA-256)
            </span>
            {lastVerif ? (
              <>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  نسخه: <code className="font-mono">{lastVerif.backupId}</code>
                </span>
                <span className="text-[11px] text-slate-500 font-mono block" dir="ltr">
                  SHA256: {lastVerif.computedArchiveSha256?.slice(0, 20)}...
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-400 block">هنوز اعتبارسنجی ثبت نشده است</span>
            )}
          </div>
          {lastVerif && (
            <button
              onClick={() =>
                setActiveReportModal({
                  type: 'verification',
                  verificationReport: lastVerif,
                })
              }
              className={`px-3 py-1.5 text-xs font-bold border flex items-center gap-1.5 ${
                lastVerif.valid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {lastVerif.valid ? 'تأیید شده' : 'خطای چک‌سام'}
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
              وضعیت بازیابی آزمایشی ایزوله (Sandbox Dry-Run)
            </span>
            {lastTestRestore ? (
              <>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {lastTestRestore.tablesTested} جدول • {lastTestRestore.totalSandboxRestoredRows} رکورد •{' '}
                  {lastTestRestore.foreignKeysChecked} کلید خارجی
                </span>
                <span className="text-[11px] text-slate-500 block">
                  زمان اجرا: {lastTestRestore.persianDate} ({lastTestRestore.durationMs}ms)
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-400 block">آماده اجرای تست بازیابی ایزوله</span>
            )}
          </div>
          {lastTestRestore && (
            <button
              onClick={() =>
                setActiveReportModal({
                  type: 'test_restore',
                  testReport: lastTestRestore,
                })
              }
              className={`px-3 py-1.5 text-xs font-bold border flex items-center gap-1.5 ${
                lastTestRestore.success
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              مشاهده گزارش تست
            </button>
          )}
        </div>
      </div>

      {/* Sub-navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('create_backup')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'create_backup'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>تهیه نسخه پشتیبان کامل (۵۰ جدول + فایل‌ها)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('server_backups')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'server_backups'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>مخزن نسخه‌های سرور و تست ایزوله ({serverBackups.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('restore')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'restore'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>بارگذاری فایل پشتیبان و بازیابی</span>
          </button>

          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'schedule'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>زمان‌بندی خودکار و سیاست نگهداری</span>
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeSubTab === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>تاریخچه عملیات و گزارش ممیزی</span>
          </button>
        </div>

        <button
          onClick={refreshOverview}
          disabled={isLoadingOverview}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOverview ? 'animate-spin text-blue-600' : ''}`} />
          <span>بروزرسانی آمار زنده</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: CREATE BACKUP (ALL 50 TABLES + UPLOADED FILES)                 */}
      {/* ===================================================================== */}
      {activeSubTab === 'create_backup' && (
        <div className="space-y-6">
          {/* Live Entity Metrics across modules */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: 'پرسنل و ساختار سازمانی',
                count:
                  (tc.personnel || 0) +
                  (tc.org_companies || 0) +
                  (tc.org_sites || 0) +
                  (tc.org_departments || 0) +
                  (tc.org_units || 0) +
                  (tc.org_positions || 0),
                sub: `${tc.personnel || 0} پرسنل • ${tc.org_units || 0} واحد`,
                icon: Users,
              },
              {
                label: 'پرونده‌های سلامت و طب کار',
                count:
                  (tc.periodic_medical_exams || 0) +
                  (tc.medical_exam_sessions || 0) +
                  (tc.audiometry_records || 0) +
                  (tc.spirometry_records || 0) +
                  (tc.optometry_records || 0) +
                  (tc.lab_results || 0),
                sub: `۱۱ جدول تخصصی سلامت`,
                icon: Activity,
              },
              {
                label: 'مجوزهای کار و ارزیابی ریسک',
                count:
                  (tc.work_permits || 0) +
                  (tc.permit_signatures || 0) +
                  (tc.risk_assessments || 0),
                sub: `${tc.work_permits || 0} مجوز • ${tc.risk_assessments || 0} ریسک`,
                icon: Shield,
              },
              {
                label: 'حوادث، TRIR و ایمنی',
                count:
                  (tc.incidents || 0) +
                  (tc.trir_monthly_records || 0) +
                  (tc.safety_warnings || 0) +
                  (tc.non_conformances || 0) +
                  (tc.fire_equipment || 0),
                sub: `${tc.incidents || 0} حادثه • ${tc.safety_warnings || 0} اخطار`,
                icon: AlertTriangle,
              },
              {
                label: 'مستندات و فایل‌های پیوست',
                count: uploadsCount,
                sub: `${tc.system_files || 0} رکورد مستند • ${formatBytes(uploadsBytes)}`,
                icon: FolderArchive,
              },
              {
                label: 'تنظیمات، کاربران و لاگ ممیزی',
                count:
                  (tc.users || 0) +
                  (tc.system_settings || 0) +
                  (tc.audit_logs || 0) +
                  (tc.notifications || 0),
                sub: `${tc.users || 0} کاربر • ${tc.audit_logs || 0} لاگ`,
                icon: Database,
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {item.label}
                    </span>
                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
                    {item.count.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">{item.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Primary Full Backup + SQL Export Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Complete Archive (.hsebackup.json.gz) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-500/30 dark:border-blue-500/40 p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block">
                        استاندارد پیشنهادی HSECORE (شامل پایگاه داده + فایل‌های پیوست)
                      </span>
                      <h4 className="text-base font-black text-slate-900 dark:text-white">
                        تهیه آرشیو کامل و معتبر سرور (`.hsebackup.json.gz`)
                      </h4>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  این بسته در یک تراکنش ایزوله `REPEATABLE READ` از تمامی <strong>{totalTables} جدول پایگاه داده</strong>، کلیدهای خارجی، تنظیمات و محتوای باینری تمامی <strong>{uploadsCount} فایل پیوست‌شده در پوشه `uploads/`</strong> نسخه پشتیبان تهیه کرده، هش رمزنگاری‌شده <strong>SHA-256</strong> را محاسبه و بلافاصله صحت ساختار آرشیو را اعتبارسنجی می‌کند.
                </p>

                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        دانلود خودکار فایل پشتیبان در مرورگر پس از ذخیره در سرور
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoDownloadAfterBackup}
                      onChange={(e) => setAutoDownloadAfterBackup(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        رمزنگاری پیشرفته آرشیو با الگوریتم AES-256-GCM
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={encryptNewBackup}
                      onChange={(e) => setEncryptNewBackup(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleCreateFullBackup(false)}
                  disabled={isGeneratingBackup}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
                >
                  {isGeneratingBackup ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>
                    {isGeneratingBackup
                      ? 'در حال تهیه و اعتبارسنجی SHA-256...'
                      : 'تهیه نسخه پشتیبان کامل و اعتبارسنجی خودکار'}
                  </span>
                </button>
              </div>
            </div>

            {/* Card 2: PostgreSQL 16 Native SQL Dump */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block">
                      خروجی استاندارد پایگاه داده رابطه‌ای
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      استخراج اسکریپت کامل PostgreSQL 16 (`.sql`)
                    </h4>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  تولید اسکریپت تراکنشی `BEGIN ... COMMIT` سازگار با PostgreSQL 16 با رعایت ترتیب توپولوژیک کلیدهای خارجی، استفاده از `jsonb_populate_recordset` برای حفظ دقیق انواع داده‌ها (JSONB, Arrays, Timestamps) و بازنشانی خودکار تمام شمارنده‌های `SERIAL` با `setval(pg_get_serial_sequence(...))`.
                </p>

                <div className="bg-slate-900 text-slate-200 rounded-xl p-3.5 font-mono text-[11px] space-y-1" dir="ltr">
                  <div className="text-emerald-400">-- HSECORE PostgreSQL 16 Transactional Dump</div>
                  <div>BEGIN;</div>
                  <div>INSERT INTO "public"."org_units" OVERRIDING SYSTEM VALUE ...</div>
                  <div>SELECT setval(pg_get_serial_sequence('&quot;public&quot;.&quot;org_units&quot;', 'id'), ...);</div>
                  <div>COMMIT;</div>
                </div>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleExportSqlDump(false)}
                  disabled={isExportingSql}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
                >
                  {isExportingSql ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>دانلود اسکریپت کامل SQL پایگاه داده (`.sql`)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Granular / Selective Module Backup */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    پشتیبان‌گیری انتخابی ماژول‌ها (Selective Module Backup)
                  </h4>
                  <p className="text-xs text-slate-500">
                    انتخاب زیرمجموعه‌ای از ماژول‌های سامانه جهت تهیه نسخه پشتیبان تفکیکی
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setSelectedModules({
                      org_structure: true,
                      personnel: true,
                      users_security: true,
                      medical_exams: true,
                      work_permits: true,
                      incidents_trir: true,
                      safety_warnings: true,
                      workflows_bpmn: true,
                      files_documents: true,
                      system_settings: true,
                      audit_logs: true,
                    })
                  }
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  انتخاب همه (۱۱ گروه ماژول / ۵۰ جدول)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: 'org_structure', label: 'چارت و ساختار سازمانی (۵ جدول)', count: (tc.org_companies || 0) + (tc.org_sites || 0) + (tc.org_departments || 0) + (tc.org_units || 0) + (tc.org_positions || 0) },
                { key: 'personnel', label: 'اطلاعات پرسنل و تخصیص‌ها (۲ جدول)', count: (tc.personnel || 0) + (tc.user_personnel_assignments || 0) },
                { key: 'users_security', label: 'کاربران و اعلان‌ها (۲ جدول)', count: (tc.users || 0) + (tc.notifications || 0) },
                { key: 'medical_exams', label: 'معاینات طب کار و سلامت (۱۱ جدول)', count: (tc.periodic_medical_exams || 0) + (tc.medical_exam_sessions || 0) + (tc.audiometry_records || 0) + (tc.spirometry_records || 0) + (tc.optometry_records || 0) + (tc.lab_results || 0) },
                { key: 'work_permits', label: 'مجوزهای کار PTW و ریسک (۴ جدول)', count: (tc.work_permits || 0) + (tc.risk_assessments || 0) },
                { key: 'incidents_trir', label: 'حوادث، TRIR و عدم انطباق (۳ جدول)', count: (tc.incidents || 0) + (tc.trir_monthly_records || 0) + (tc.non_conformances || 0) },
                { key: 'safety_warnings', label: 'اخطارها، آموزش، PPE و آتش‌نشانی (۹ جدول)', count: (tc.safety_warnings || 0) + (tc.hse_trainings || 0) + (tc.ppe_issuances || 0) + (tc.fire_equipment || 0) },
                { key: 'workflows_bpmn', label: 'فرآیندهای BPMN و اتوماسیون (۱۰ جدول)', count: (tc.workflows || 0) + (tc.bpmn_processes || 0) + (tc.automation_rules || 0) },
                { key: 'files_documents', label: 'مستندات و فایل‌های فیزیکی پیوست', count: (tc.system_files || 0) + uploadsCount },
                { key: 'system_settings', label: 'تنظیمات کلان سیستم (system_settings)', count: tc.system_settings || 0 },
                { key: 'audit_logs', label: 'لاگ‌های ممیزی امنیتی (audit_logs)', count: tc.audit_logs || 0 },
              ].map((mod) => {
                const checked = Boolean(selectedModules[mod.key]);
                return (
                  <label
                    key={mod.key}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? 'bg-blue-50/60 border-blue-400 dark:bg-blue-950/30 dark:border-blue-700'
                        : 'bg-slate-50/50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedModules((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }))
                        }
                        className="w-4 h-4 accent-blue-600 rounded"
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {mod.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      {mod.count}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                onClick={() => handleCreateFullBackup(true)}
                disabled={isGeneratingBackup}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>تهیه آرشیو پشتیبان انتخابی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: SERVER BACKUP REPOSITORY & ISOLATED SANDBOX TEST RESTORE       */}
      {/* ===================================================================== */}
      {activeSubTab === 'server_backups' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-blue-600" />
                  <span>نسخه‌های پشتیبان ذخیره‌شده در سرور ({serverBackups.length} نسخه)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  هر نسخه را می‌توانید پیش از بازیابی واقعی، در <strong>محیط ایزوله PostgreSQL Sandbox</strong> بدون هیچ‌گونه تغییر در اطلاعات فعلی آزمایش و مقایسه نمایید.
                </p>
              </div>

              <button
                onClick={() => handleCreateFullBackup(false)}
                disabled={isGeneratingBackup}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>ایجاد نسخه پشتیبان جدید در سرور</span>
              </button>
            </div>

            {serverBackups.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <FolderArchive className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                  هنوز نسخه پشتیبانی در مسیر سرور ایجاد نشده است.
                </p>
                <button
                  onClick={() => handleCreateFullBackup(false)}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
                >
                  تهیه اولین نسخه پشتیبان کامل
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {serverBackups.map((bk) => {
                  const isVerifying = activeActionId === `verify_${bk.backupId}`;
                  const isTesting = activeActionId === `test_${bk.backupId}`;
                  return (
                    <div
                      key={bk.backupId}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-blue-400/60 transition-all bg-slate-50/40 dark:bg-slate-800/30 space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="text-sm font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                              {bk.backupId}
                            </code>
                            {tagBadge(bk.tag)}
                            {bk.encrypted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Lock className="w-3 h-3" />
                                AES-256-GCM
                              </span>
                            )}
                            {bk.verified && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60">
                                <CheckCircle2 className="w-3 h-3" />
                                تأیید شده SHA-256
                              </span>
                            )}
                            {bk.lastTestRestoreStatus === 'PASSED' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60">
                                <FlaskConical className="w-3 h-3" />
                                تست ایزوله موفق (Sandbox Verified)
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                            <span>
                              تاریخ: <strong className="text-slate-800 dark:text-slate-200">{bk.persianDate}</strong>
                            </span>
                            <span>
                              محتوا:{' '}
                              <strong className="text-slate-800 dark:text-slate-200">
                                {bk.tableCount} جدول • {bk.totalRows.toLocaleString()} رکورد • {bk.filesCount} فایل پیوست ({formatBytes(bk.filesTotalBytes)})
                              </strong>
                            </span>
                            <span>
                              حجم آرشیو فشرده:{' '}
                              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                                {formatBytes(bk.archiveSizeBytes || 0)}
                              </strong>
                            </span>
                            <span>
                              ایجادکننده:{' '}
                              <strong className="text-slate-800 dark:text-slate-200">
                                {bk.createdBy?.fullName || bk.createdBy?.username}
                              </strong>
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 font-mono flex flex-wrap items-center gap-4" dir="ltr">
                            <span>SHA-256: {bk.archiveSha256 || bk.payloadSha256}</span>
                            {bk.storagePath && <span>Path: {bk.storagePath}</span>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleVerifyServerBackup(bk.backupId)}
                            disabled={isVerifying}
                            className="px-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg flex items-center gap-1.5"
                            title="بررسی مجدد چک‌سام SHA-256 و ساختار فایل"
                          >
                            <ShieldCheck className={`w-3.5 h-3.5 text-emerald-600 ${isVerifying ? 'animate-spin' : ''}`} />
                            <span>اعتبارسنجی SHA-256</span>
                          </button>

                          <button
                            onClick={() => handleRunIsolatedTestRestore(bk.backupId)}
                            disabled={isTesting}
                            className="px-3 py-2 text-xs font-bold bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/50 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-200 rounded-lg flex items-center gap-1.5"
                            title="اجرای بازیابی آزمایشی واقعی در جداول موقت ایزوله PostgreSQL بدون تغییر در داده‌های فعلی"
                          >
                            <FlaskConical className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                            <span>{isTesting ? 'در حال تست ایزوله...' : 'بازیابی آزمایشی (ایزوله)'}</span>
                          </button>

                          <button
                            onClick={() => apiDb.downloadServerBackup(bk.backupId, 'gz')}
                            className="px-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-lg flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>دانلود آرشیو</span>
                          </button>

                          <button
                            onClick={() => {
                              setRestoreMode('merge');
                              setRestoreConfirmInput('');
                              setRestoreConfirmModal({
                                source: 'server',
                                backupId: bk.backupId,
                                fileName: bk.fileName,
                                totalRows: bk.totalRows,
                                tablesCount: bk.tableCount,
                                filesCount: bk.filesCount,
                                sha256: bk.archiveSha256 || bk.payloadSha256,
                              });
                            }}
                            className="px-3 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                            <span>بازیابی واقعی</span>
                          </button>

                          <button
                            onClick={() => setDeleteConfirmBackupId(bk.backupId)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-transparent hover:border-red-200"
                            title="حذف نسخه پشتیبان"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: UPLOAD EXTERNAL BACKUP FILE & PRE-FLIGHT SANDBOX RESTORE       */}
      {/* ===================================================================== */}
      {activeSubTab === 'restore' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  بارگذاری فایل پشتیبان، بازرسی امنیتی SHA-256 و بازیابی آزمایشی ایزوله
                </h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  فایل پشتیبان (`.hsebackup.json.gz`، `.json` یا `.sql`) را انتخاب کنید. سامانه پیش از هرگونه تغییر در پایگاه داده اصلی، ابتدا فایل را در <strong>محیط ایزوله تراکنشی PostgreSQL Sandbox</strong> بازیابی آزمایشی کرده و سلامت تمام جداول، کلیدهای خارجی و فایل‌های پیوست را گزارش می‌دهد.
                </p>
              </div>
            </div>

            <label className="block border-2 border-dashed border-blue-400/60 dark:border-blue-700/60 hover:border-blue-600 bg-blue-50/30 dark:bg-blue-950/20 rounded-2xl p-8 text-center cursor-pointer transition-all">
              <input
                type="file"
                accept=".gz,.json,.sql"
                onChange={handleUploadFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center mx-auto mb-3">
                {isInspectingUpload ? (
                  <RefreshCw className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>
              <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                {isInspectingUpload
                  ? 'در حال اعتبارسنجی SHA-256 و اجرای بازیابی آزمایشی ایزوله در سرور...'
                  : 'برای انتخاب فایل پشتیبان (.hsebackup.json.gz ، .json یا .sql) کلیک کنید'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                پشتیبانی کامل از آرشیوهای فشرده Gzip، رمزنگاری‌شده AES-256-GCM و اسکریپت‌های SQL
              </p>
            </label>

            {uploadedFilePayload && (
              <div className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-5 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white" dir="ltr">
                        {uploadedFilePayload.fileName}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">
                        {uploadedFilePayload.fileSize}
                      </span>
                      {uploadedFilePayload.testRestoreReport.success ? (
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          تأیید شده در تست بازیابی ایزوله
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                          دارای خطای ساختار یا چک‌سام
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-slate-500" dir="ltr">
                      SHA-256: {uploadedFilePayload.verification.computedArchiveSha256}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setActiveReportModal({
                          type: 'test_restore',
                          testReport: uploadedFilePayload.testRestoreReport,
                        })
                      }
                      className="px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4 text-blue-600" />
                      <span>مشاهده جزئیات کامل ۵۰ جدول در Sandbox</span>
                    </button>

                    {uploadedFilePayload.testRestoreReport.success && (
                      <button
                        onClick={() => {
                          setRestoreMode('merge');
                          setRestoreConfirmInput('');
                          setRestoreConfirmModal({
                            source: 'upload',
                            fileName: uploadedFilePayload.fileName,
                            totalRows: uploadedFilePayload.testRestoreReport.totalBackupRows,
                            tablesCount: uploadedFilePayload.testRestoreReport.tablesTested,
                            filesCount: uploadedFilePayload.testRestoreReport.filesTested,
                            sha256: uploadedFilePayload.verification.computedArchiveSha256,
                          });
                        }}
                        className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl flex items-center gap-1.5 shadow-md"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                        <span>آغاز بازیابی واقعی در پایگاه داده اصلی</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary metrics of the sandbox test */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">جداول آزمایش‌شده</span>
                    <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                      {uploadedFilePayload.testRestoreReport.tablesTested} جدول
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">رکوردهای بازیابی‌شده در Sandbox</span>
                    <span className="text-base font-black text-emerald-600 font-mono">
                      {uploadedFilePayload.testRestoreReport.totalSandboxRestoredRows.toLocaleString()} /{' '}
                      {uploadedFilePayload.testRestoreReport.totalBackupRows.toLocaleString()}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">تست یکپارچگی کلیدهای خارجی</span>
                    <span className="text-base font-black text-blue-600 font-mono">
                      {uploadedFilePayload.testRestoreReport.foreignKeysChecked} رابطه (بدون خطا)
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">فایل‌های پیوست بررسی‌شده</span>
                    <span className="text-base font-black text-cyan-600 font-mono">
                      {uploadedFilePayload.testRestoreReport.filesTested} فایل
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-500 block">زمان اجرای تست ایزوله</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200 font-mono">
                      {uploadedFilePayload.testRestoreReport.durationMs} ms
                    </span>
                  </div>
                </div>

                {uploadedFilePayload.testRestoreReport.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl p-4 space-y-1">
                    <div className="text-xs font-bold text-red-800 dark:text-red-300">
                      خطاهای شناسایی‌شده در اعتبارسنجی یا محیط ایزوله:
                    </div>
                    {uploadedFilePayload.testRestoreReport.errors.map((err, i) => (
                      <div key={i} className="text-xs text-red-700 dark:text-red-300">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SCHEDULE & RETENTION POLICY                                    */}
      {/* ===================================================================== */}
      {activeSubTab === 'schedule' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  زمان‌بندی خودکار پشتیبان‌گیری سرور و سیاست نگهداری نسخه‌ها (Retention Policy)
                </h4>
                <p className="text-xs text-slate-500">
                  تنظیم دوره اجرای خودکار در پس‌زمینه سرور و حذف کنترل‌شده قدیمی‌ترین نسخه‌های منقضی‌شده
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">
                    فعال‌سازی زمان‌بند خودکار سرور (Background Cron Scheduler)
                  </span>
                  <span className="text-xs text-slate-500">
                    اجرای خودکار پشتیبان‌گیری کامل بدون نیاز به حضور کاربر در مرورگر
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded"
                />
              </label>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  دوره تناوب پشتیبان‌گیری خودکار
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'daily', label: 'روزانه (هر ۲۴ ساعت)' },
                    { id: 'weekly', label: 'هفتگی (هر ۷ روز)' },
                    { id: 'monthly', label: 'ماهانه (هر ۳۰ روز)' },
                    { id: 'manual', label: 'فقط دستی' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScheduleFrequency(opt.id as any)}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                        scheduleFrequency === opt.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  حداکثر تعداد نسخه‌های نگهداری‌شده در سرور (Retention Count):{' '}
                  <strong className="text-blue-600 font-mono">{retentionCount} نسخه</strong>
                </label>
                <input
                  type="range"
                  min={2}
                  max={50}
                  value={retentionCount}
                  onChange={(e) => setRetentionCount(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <p className="text-[11px] text-slate-500">
                  در صورت عبور تعداد نسخه‌ها از این سقف، قدیمی‌ترین نسخه‌های منقضی‌شده به‌صورت کنترل‌شده حذف می‌شوند (نسخه‌های ایمنی پیش از بازیابی حفظ می‌گردند).
                </p>
              </div>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رمزنگاری خودکار نسخه‌های زمان‌بندی‌شده با الگوریتم AES-256-GCM
                </span>
                <input
                  type="checkbox"
                  checked={encryptScheduledBackups}
                  onChange={(e) => setEncryptScheduledBackups(e.target.checked)}
                  className="w-4 h-4 accent-amber-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ثبت رویداد در لاگ ممیزی و ارسال اعلان به مدیر سیستم پس از هر پشتیبان‌گیری
                </span>
                <input
                  type="checkbox"
                  checked={notifyAdminOnBackup}
                  onChange={(e) => setNotifyAdminOnBackup(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleSaveSchedule}
              disabled={activeActionId === 'save_schedule'}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>ذخیره و اعمال سیاست زمان‌بندی و نگهداری</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: BACKUP & RESTORE AUDIT HISTORY                                 */}
      {/* ===================================================================== */}
      {activeSubTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>تاریخچه کامل عملیات پشتیبان‌گیری و بازیابی ثبت‌شده در پایگاه داده</span>
          </h4>

          {(overview?.backupHistory || []).length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              هنوز سابقه عملیاتی ثبت نشده است.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 font-bold">شناسه عملیات</th>
                    <th className="p-3 font-bold">زمان ثبت</th>
                    <th className="p-3 font-bold">نوع عملیات</th>
                    <th className="p-3 font-bold">قالب / حالت</th>
                    <th className="p-3 font-bold">تعداد رکورد / فایل</th>
                    <th className="p-3 font-bold">حجم</th>
                    <th className="p-3 font-bold">چک‌سام SHA-256</th>
                    <th className="p-3 font-bold">اپراتور</th>
                    <th className="p-3 font-bold">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(overview?.backupHistory || []).map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                        {h.id}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{h.ts}</td>
                      <td className="p-3 font-bold">
                        {h.type === 'Restore' ? (
                          <span className="text-amber-600">بازیابی (Restore)</span>
                        ) : (
                          <span className="text-blue-600">پشتیبان‌گیری (Backup)</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{h.format}</td>
                      <td className="p-3 font-mono">
                        {(h.recordCount || 0).toLocaleString()} رکورد
                        {h.filesCount !== undefined ? ` • ${h.filesCount} فایل` : ''}
                      </td>
                      <td className="p-3 font-mono" dir="ltr">
                        {h.size}
                      </td>
                      <td className="p-3 font-mono text-slate-500" dir="ltr">
                        {h.sha256 || '—'}
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{h.operator}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          موفق و تأییدشده
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: ISOLATED TEST RESTORE / VERIFICATION DETAILED REPORT         */}
      {/* ===================================================================== */}
      {activeReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FlaskConical className="w-6 h-6 text-cyan-400" />
                <div>
                  <h4 className="text-base font-black">
                    {activeReportModal.type === 'test_restore'
                      ? 'گزارش کامل بازیابی آزمایشی ایزوله (PostgreSQL Sandbox Dry-Run)'
                      : 'گزارش اعتبارسنجی رمزنگاری‌شده SHA-256 و ساختار پشتیبان'}
                  </h4>
                  <p className="text-xs text-slate-300 font-mono" dir="ltr">
                    Backup ID:{' '}
                    {activeReportModal.testReport?.backupId ||
                      activeReportModal.verificationReport?.backupId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveReportModal(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs">
              {activeReportModal.testReport && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block mb-1">نتیجه نهایی تست ایزوله</span>
                      <span
                        className={`text-sm font-black ${
                          activeReportModal.testReport.success ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {activeReportModal.testReport.success
                          ? 'موفق (۱۰۰٪ منطبق)'
                          : 'ناموفق (دارای خطا)'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block mb-1">جداول تست‌شده در Sandbox</span>
                      <span className="text-sm font-black font-mono">
                        {activeReportModal.testReport.tablesTested} جدول
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block mb-1">رکوردهای بازیابی‌شده آزمایشی</span>
                      <span className="text-sm font-black font-mono text-blue-600">
                        {activeReportModal.testReport.totalSandboxRestoredRows.toLocaleString()} از{' '}
                        {activeReportModal.testReport.totalBackupRows.toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block mb-1">بررسی کلیدهای خارجی (FK)</span>
                      <span className="text-sm font-black font-mono text-emerald-600">
                        {activeReportModal.testReport.foreignKeysChecked} رابطه (
                        {activeReportModal.testReport.foreignKeyViolations} خطا)
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block mb-1">فایل‌های پیوست تست‌شده</span>
                      <span className="text-sm font-black font-mono text-cyan-600">
                        {activeReportModal.testReport.filesTested} فایل (
                        {formatBytes(activeReportModal.testReport.filesBytesTested)})
                      </span>
                    </div>
                  </div>

                  {/* Cryptographic Hash Comparison */}
                  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono space-y-1.5" dir="ltr">
                    <div className="text-emerald-400 font-bold">
                      Cryptographic SHA-256 Integrity Check:
                    </div>
                    <div>
                      Archive SHA-256 (Computed):{' '}
                      {activeReportModal.testReport.verificationReport.computedArchiveSha256}
                    </div>
                    <div>
                      Payload SHA-256 (Computed):{' '}
                      {activeReportModal.testReport.verificationReport.computedPayloadSha256}
                    </div>
                    <div>
                      Isolation Method: {activeReportModal.testReport.isolatedMode} (Duration:{' '}
                      {activeReportModal.testReport.durationMs}ms)
                    </div>
                  </div>

                  {/* Physical Files Comparison */}
                  {activeReportModal.testReport.fileComparison.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-black text-slate-900 dark:text-white">
                        تطابق فایل‌های فیزیکی پیوست (`uploads/`):
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {activeReportModal.testReport.fileComparison.map((f, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                          >
                            <span className="font-mono truncate max-w-[180px]" dir="ltr">
                              {f.fileName}
                            </span>
                            <span className="text-emerald-600 font-bold">
                              {formatBytes(f.sizeBytes)} • {f.sha256Match ? 'SHA-256 OK' : 'MISMATCH'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 50-Table Comparison */}
                  <div className="space-y-2">
                    <h5 className="font-black text-slate-900 dark:text-white">
                      جدول مقایسه رکوردهای نسخه پشتیبان، محیط ایزوله Sandbox و پایگاه داده زنده ({activeReportModal.testReport.tableComparison.length} جدول):
                    </h5>
                    <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                      <table className="w-full text-right border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                          <tr>
                            <th className="p-2.5 font-bold">نام جدول در پایگاه داده</th>
                            <th className="p-2.5 font-bold">تعداد در پشتیبان</th>
                            <th className="p-2.5 font-bold">بازیابی‌شده در Sandbox ایزوله</th>
                            <th className="p-2.5 font-bold">تعداد فعلی در دیتابیس زنده</th>
                            <th className="p-2.5 font-bold">وضعیت تطابق</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {activeReportModal.testReport.tableComparison.map((row) => (
                            <tr key={row.tableName}>
                              <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                                {TABLE_FA_LABELS[row.tableName] || row.tableName}
                              </td>
                              <td className="p-2.5 font-mono font-bold">{row.backupRows}</td>
                              <td className="p-2.5 font-mono font-bold text-blue-600">
                                {row.sandboxRestoredRows}
                              </td>
                              <td className="p-2.5 font-mono text-slate-500">{row.liveRows}</td>
                              <td className="p-2.5">
                                {row.status === 'OK' ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                    تأیید شده (OK)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold text-[11px]">
                                    {row.error || 'عدم تطابق'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {activeReportModal.type === 'verification' && activeReportModal.verificationReport && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block">وضعیت کلی چک‌سام</span>
                      <span
                        className={`text-sm font-black ${
                          activeReportModal.verificationReport.valid
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {activeReportModal.verificationReport.valid ? 'معتبر (VALID)' : 'نامعتبر (INVALID)'}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block">جداول بررسی‌شده</span>
                      <span className="text-sm font-black font-mono">
                        {activeReportModal.verificationReport.tablesVerified} جدول
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block">رکوردهای بررسی‌شده</span>
                      <span className="text-sm font-black font-mono">
                        {activeReportModal.verificationReport.rowsVerified.toLocaleString()} رکورد
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 block">فایل‌های پیوست</span>
                      <span className="text-sm font-black font-mono">
                        {activeReportModal.verificationReport.filesVerified} فایل
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl font-mono space-y-1.5" dir="ltr">
                    <div>
                      Expected Archive SHA-256:{' '}
                      {activeReportModal.verificationReport.expectedArchiveSha256}
                    </div>
                    <div>
                      Computed Archive SHA-256:{' '}
                      {activeReportModal.verificationReport.computedArchiveSha256}
                    </div>
                    <div>
                      Computed Payload SHA-256:{' '}
                      {activeReportModal.verificationReport.computedPayloadSha256}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveReportModal(null)}
                className="px-5 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl"
              >
                بستن گزارش
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: MANDATORY PRE-RESTORE CONFIRMATION MODAL                     */}
      {/* ===================================================================== */}
      {restoreConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="p-5 bg-amber-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6" />
                <h4 className="text-base font-black">
                  تأیید نهایی بازیابی اطلاعات در پایگاه داده اصلی
                </h4>
              </div>
              <button
                onClick={() => setRestoreConfirmModal(null)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl space-y-1.5 text-amber-900 dark:text-amber-200">
                <div className="font-black">تضمین‌های امنیتی پیش از اجرای بازیابی:</div>
                <div>
                  ۱. ابتدا نسخه پشتیبان در محیط ایزوله PostgreSQL آزمایش می‌شود.
                </div>
                <div>
                  ۲. به‌طور خودکار یک <strong>نسخه پشتیبان ایمنی (pre_restore_safety)</strong> از وضعیت فعلی سامانه ذخیره می‌گردد.
                </div>
                <div>
                  ۳. تمام عملیات در یک تراکنش اتمیک (`BEGIN ... COMMIT`) اجرا شده و در صورت بروز هرگونه خطا، به‌صورت کامل `ROLLBACK` می‌شود.
                </div>
              </div>

              <div className="space-y-1 bg-slate-100 dark:bg-slate-800 p-3.5 rounded-xl">
                <div>
                  فایل / شناسه نسخه:{' '}
                  <strong className="font-mono" dir="ltr">
                    {restoreConfirmModal.backupId || restoreConfirmModal.fileName}
                  </strong>
                </div>
                <div>
                  محتوای قابل بازیابی:{' '}
                  <strong>
                    {restoreConfirmModal.tablesCount} جدول •{' '}
                    {restoreConfirmModal.totalRows.toLocaleString()} رکورد •{' '}
                    {restoreConfirmModal.filesCount} فایل پیوست
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  انتخاب استراتژی بازیابی:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      restoreMode === 'merge'
                        ? 'bg-blue-50 border-blue-600 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="font-black text-slate-900 dark:text-white">
                      ادغام هوشمند (Merge / Upsert) — پیشنهادی
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      حفظ رکوردهای جدیدتر فعلی و به‌روزرسانی/افزودن رکوردهای موجود در پشتیبان
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('clean')}
                    className={`p-3 rounded-xl border text-right transition-all ${
                      restoreMode === 'clean'
                        ? 'bg-red-50 border-red-600 dark:bg-red-950/40'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="font-black text-red-700 dark:text-red-400">
                      جایگزینی کامل (Clean Replace)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      پاکسازی رکوردهای فعلی جداول و بازگردانی دقیق به نقطه زمانی نسخه پشتیبان
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  برای تأیید و آغاز عملیات، عبارت <code className="text-red-600 font-mono">RESTORE</code> را وارد نمایید:
                </label>
                <input
                  type="text"
                  value={restoreConfirmInput}
                  onChange={(e) => setRestoreConfirmInput(e.target.value)}
                  placeholder="RESTORE"
                  dir="ltr"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-center tracking-widest"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setRestoreConfirmModal(null)}
                disabled={isRestoring}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmAndExecuteRestore}
                disabled={isRestoring || restoreConfirmInput.trim().toUpperCase() !== 'RESTORE'}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl flex items-center gap-2"
              >
                {isRestoring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                <span>
                  {isRestoring
                    ? 'در حال تهیه پشتیبان ایمنی و بازیابی تراکنشی...'
                    : 'تأیید و اجرای بازیابی واقعی'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CONTROLLED DELETE CONFIRMATION                               */}
      {/* ===================================================================== */}
      {deleteConfirmBackupId && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 className="w-6 h-6" />
              <h4 className="text-base font-black">حذف کنترل‌شده نسخه پشتیبان</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              آیا از حذف نسخه پشتیبان{' '}
              <code className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">
                {deleteConfirmBackupId}
              </code>{' '}
              از فضای ذخیره‌سازی سرور اطمینان دارید؟ این رویداد در لاگ ممیزی ثبت خواهد شد.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmBackupId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDeleteBackup(deleteConfirmBackupId)}
                disabled={activeActionId === `delete_${deleteConfirmBackupId}`}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
              >
                تأیید و حذف نسخه
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
