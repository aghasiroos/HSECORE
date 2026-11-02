import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { pool, db } from '../../src/db/index.ts';
import * as schema from '../../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { logger } from '../core/logger.ts';
import { broadcastDataMutation } from '../core/socket.ts';
import { selectScheduledBackupsForRetention } from './backup-retention.ts';
import { resolveBackupRestorePath } from './backup-restore-path.ts';

export type BackupTag = 'manual' | 'scheduled' | 'pre_restore_safety' | 'pre_update';

export interface BackupFileEntry {
  fileName: string;
  relativePath: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string;
  contentBase64: string;
}

export interface BackupManifest {
  backupId: string;
  fileName: string;
  tag: BackupTag;
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

export interface VerificationReport {
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

export interface TestRestoreTableComparison {
  tableName: string;
  backupRows: number;
  sandboxRestoredRows: number;
  liveRows: number;
  status: 'OK' | 'MISMATCH' | 'ERROR';
  error?: string;
}

export interface TestRestoreReport {
  backupId: string;
  testedAt: string;
  persianDate: string;
  durationMs: number;
  operator: string;
  success: boolean;
  isolatedMode: 'POSTGRESQL_TEMP_SANDBOX_ROLLBACK';
  verificationReport: VerificationReport;
  tablesTested: number;
  totalBackupRows: number;
  totalSandboxRestoredRows: number;
  foreignKeysChecked: number;
  foreignKeyViolations: number;
  sequencesChecked: number;
  filesTested: number;
  filesBytesTested: number;
  tableComparison: TestRestoreTableComparison[];
  fileComparison: Array<{
    fileName: string;
    sizeBytes: number;
    sha256Match: boolean;
  }>;
  errors: string[];
}

export interface RestoreExecutionReport {
  backupId: string;
  restoredAt: string;
  persianDate: string;
  durationMs: number;
  mode: 'clean' | 'merge';
  operator: string;
  success: boolean;
  safetyBackupId: string;
  tablesRestored: number;
  rowsRestored: number;
  sequencesReset: number;
  filesRestored: number;
  preRestoreTestReport: TestRestoreReport;
  errors: string[];
}

export interface BackupScheduleConfig {
  enabled: boolean;
  frequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  target: 'server' | 'browser';
  retentionCount: number;
  notifyAdminOnBackup: boolean;
  encryptBackups: boolean;
  lastScheduledRunAt?: string;
  nextScheduledRunAt?: string;
}

const SENSITIVE_SETTINGS_MASK_KEYS = new Set([
  'smtp_password',
  'ldap_bind_password',
  'webhook_secret',
]);

export function getBackupDirectory(): string {
  const dir = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

export function getUploadsDirectory(): string {
  const dir = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function formatPersianDateTime(date = new Date()): string {
  try {
    return `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString('fa-IR')}`;
  } catch {
    return date.toISOString();
  }
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sanitizeBackupId(rawId: string): string {
  const cleaned = path.basename(String(rawId || '').trim()).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleaned || cleaned.includes('..')) {
    throw new Error('شناسه نسخه پشتیبان نامعتبر است.');
  }
  return cleaned.replace(/\.(hsebackup\.json\.gz|meta\.json|sha256|json|sql)$/i, '');
}

function getEncryptionKey(): Buffer {
  const secret =
    process.env.BACKUP_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'hsecore-default-enterprise-backup-key-2026';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptBuffer(plain: Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const header = Buffer.from('HSEENC01', 'ascii'); // 8 bytes magic header
  return Buffer.concat([header, iv, tag, enc]);
}

function decryptBufferIfNeeded(buf: Buffer): Buffer {
  if (buf.length >= 36 && buf.subarray(0, 8).toString('ascii') === 'HSEENC01') {
    const key = getEncryptionKey();
    const iv = buf.subarray(8, 20);
    const tag = buf.subarray(20, 36);
    const enc = buf.subarray(36);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }
  return buf;
}

/**
 * Discovers all base tables in public schema and returns them in topological order
 * (parents before children) based on PostgreSQL foreign key constraints.
 */
export async function getTopologicalTables(): Promise<{
  tables: string[];
  primaryKeys: Record<string, string>;
  foreignKeys: Array<{
    childTable: string;
    childColumn: string;
    parentTable: string;
    parentColumn: string;
  }>;
}> {
  const tablesRes = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const allTables: string[] = tablesRes.rows.map((r) => r.table_name);

  const pkRes = await pool.query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY';
  `);
  const primaryKeys: Record<string, string> = {};
  for (const r of pkRes.rows) {
    primaryKeys[r.table_name] = r.column_name;
  }

  const fkRes = await pool.query(`
    SELECT
      tc.table_name AS child_table,
      kcu.column_name AS child_column,
      ccu.table_name AS parent_table,
      ccu.column_name AS parent_column
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `);

  const foreignKeys = fkRes.rows.map((r) => ({
    childTable: r.child_table,
    childColumn: r.child_column,
    parentTable: r.parent_table,
    parentColumn: r.parent_column,
  }));

  // Topological sort (Kahn's algorithm)
  const deps = new Map<string, Set<string>>();
  for (const t of allTables) {
    deps.set(t, new Set());
  }
  for (const fk of foreignKeys) {
    if (fk.childTable !== fk.parentTable && deps.has(fk.childTable) && deps.has(fk.parentTable)) {
      deps.get(fk.childTable)!.add(fk.parentTable);
    }
  }

  const sorted: string[] = [];
  const visited = new Set<string>();

  let progress = true;
  while (sorted.length < allTables.length && progress) {
    progress = false;
    for (const t of allTables) {
      if (visited.has(t)) continue;
      const parentSet = deps.get(t)!;
      const allParentsVisited = Array.from(parentSet).every((p) => visited.has(p));
      if (allParentsVisited) {
        visited.add(t);
        sorted.push(t);
        progress = true;
      }
    }
  }

  // Append any remaining in case of cyclic FKs
  for (const t of allTables) {
    if (!visited.has(t)) {
      sorted.push(t);
    }
  }

  return { tables: sorted, primaryKeys, foreignKeys };
}

/**
 * Collects all physical files in uploads directory with SHA-256 and Base64 content
 */
function collectUploadedFiles(): BackupFileEntry[] {
  const uploadsDir = getUploadsDirectory();
  const entries: BackupFileEntry[] = [];

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    const list = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of list) {
      if (item.name.startsWith('.')) continue; // skip hidden staging files
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
      } else if (item.isFile()) {
        const buf = fs.readFileSync(fullPath);
        const stat = fs.statSync(fullPath);
        const relPath = path.relative(uploadsDir, fullPath).replace(/\\/g, '/');
        entries.push({
          fileName: item.name,
          relativePath: relPath,
          sizeBytes: buf.length,
          sha256: sha256Hex(buf),
          modifiedAt: stat.mtime.toISOString(),
          contentBase64: buf.toString('base64'),
        });
      }
    }
  }

  walk(uploadsDir);
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

/**
 * Checks available disk space in backup directory
 */
export function getStorageDiskInfo(): {
  backupDir: string;
  uploadsDir: string;
  writable: boolean;
  freeBytes: number;
  totalBytes: number;
  usedByBackupsBytes: number;
  usedByUploadsBytes: number;
  backupsCount: number;
} {
  const backupDir = getBackupDirectory();
  const uploadsDir = getUploadsDirectory();

  let writable = false;
  try {
    const testFile = path.join(backupDir, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    writable = true;
  } catch {
    writable = false;
  }

  let freeBytes = 0;
  let totalBytes = 0;
  try {
    if (typeof fs.statfsSync === 'function') {
      const statfs = fs.statfsSync(backupDir);
      freeBytes = Number(statfs.bavail) * Number(statfs.bsize);
      totalBytes = Number(statfs.blocks) * Number(statfs.bsize);
    }
  } catch {
    // Fallback if statfs not available
  }

  let usedByBackupsBytes = 0;
  let backupsCount = 0;
  try {
    const files = fs.readdirSync(backupDir);
    for (const f of files) {
      const fp = path.join(backupDir, f);
      const st = fs.statSync(fp);
      if (st.isFile()) {
        usedByBackupsBytes += st.size;
        if (f.endsWith('.hsebackup.json.gz')) backupsCount++;
      }
    }
  } catch {}

  let usedByUploadsBytes = 0;
  try {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      if (f.startsWith('.')) continue;
      const fp = path.join(uploadsDir, f);
      const st = fs.statSync(fp);
      if (st.isFile()) usedByUploadsBytes += st.size;
    }
  } catch {}

  return {
    backupDir,
    uploadsDir,
    writable,
    freeBytes,
    totalBytes,
    usedByBackupsBytes,
    usedByUploadsBytes,
    backupsCount,
  };
}

/**
 * Module-to-tables mapping for selective backups
 */
const MODULE_TABLES_MAP: Record<string, string[]> = {
  org_structure: ['org_companies', 'org_sites', 'org_departments', 'org_units', 'org_positions'],
  personnel: ['personnel', 'user_personnel_assignments'],
  users_security: ['users', 'notifications'],
  medical_exams: [
    'periodic_medical_exams',
    'lab_results',
    'audiometry_records',
    'spirometry_records',
    'optometry_records',
    'medical_test_catalog',
    'medical_reference_rules',
    'medical_exam_sessions',
    'medical_test_results',
    'occupational_disease_diagnoses',
    'medical_referrals',
  ],
  work_permits: ['work_permits', 'permit_number_counters', 'permit_signatures', 'risk_assessments'],
  incidents_trir: ['incidents', 'trir_monthly_records', 'non_conformances'],
  safety_warnings: [
    'safety_warnings',
    'hse_trainings',
    'training_attendances',
    'ppe_issuances',
    'fire_equipment',
    'safety_templates',
    'safety_inspections',
    'environmental_logs',
    'five_s_audits',
  ],
  workflows_bpmn: [
    'bpmn_processes',
    'bpmn_instances',
    'workflows',
    'workflow_instances',
    'workflow_steps',
    'workflow_history',
    'workflow_signatures',
    'automation_rules',
    'automation_events_outbox',
    'automation_execution_logs',
  ],
  files_documents: ['system_files', 'system_releases'],
  system_settings: ['system_settings'],
  audit_logs: ['audit_logs'],
};

async function saveSystemSettingQuiet(key: string, value: any): Promise<void> {
  try {
    await db
      .insert(schema.systemSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: { value, updatedAt: new Date() },
      });
  } catch (e) {
    logger.warn(`Failed to save setting ${key}`, e);
  }
}

async function getSystemSettingQuiet<T = any>(key: string, fallback: T): Promise<T> {
  try {
    const rows = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key));
    if (rows.length > 0 && rows[0].value !== null && rows[0].value !== undefined) {
      return rows[0].value as T;
    }
  } catch {}
  return fallback;
}

async function writeAuditLogEntry(
  username: string,
  action: string,
  entityType: string,
  entityId: string,
  details: any
): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      action,
      entityType,
      entityId,
      newValue: {
        username,
        timestamp: new Date().toISOString(),
        ...details,
      },
      ipAddress: '127.0.0.1',
    });
  } catch (e) {
    logger.warn('Failed to write backup audit log entry:', e);
  }
}

/**
 * Lists all server-stored backups sorted newest first
 */
export function listServerBackups(): BackupManifest[] {
  const backupDir = getBackupDirectory();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.meta.json'));
  const manifests: BackupManifest[] = [];

  for (const metaFile of files) {
    try {
      const fullPath = path.join(backupDir, metaFile);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = JSON.parse(raw) as BackupManifest;
      const archivePath = path.join(backupDir, `${parsed.backupId}.hsebackup.json.gz`);
      if (fs.existsSync(archivePath)) {
        const st = fs.statSync(archivePath);
        parsed.archiveSizeBytes = st.size;
        parsed.storagePath = archivePath;
        manifests.push(parsed);
      }
    } catch (e) {
      logger.warn(`Failed to parse backup metadata file ${metaFile}:`, e);
    }
  }

  return manifests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Returns comprehensive live status of DB, storage, backups, and last test/verification reports
 */
export async function getBackupSystemOverview() {
  const { tables, primaryKeys, foreignKeys } = await getTopologicalTables();
  const tableCounts: Record<string, number> = {};
  let totalDbRows = 0;

  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*)::int AS c FROM "public"."${t}"`);
    const count = res.rows[0]?.c || 0;
    tableCounts[t] = count;
    totalDbRows += count;
  }

  const uploadedFiles = collectUploadedFiles();
  const diskInfo = getStorageDiskInfo();
  const serverBackups = listServerBackups();

  const [lastBackupTime, lastVerificationReport, lastTestRestoreReport, scheduleConfig, backupHistory] =
    await Promise.all([
      getSystemSettingQuiet<string>('hse_last_backup_time', serverBackups[0]?.persianDate || '—'),
      getSystemSettingQuiet<VerificationReport | null>('hse_last_verification_report', null),
      getSystemSettingQuiet<TestRestoreReport | null>('hse_last_test_restore_report', null),
      getSystemSettingQuiet<BackupScheduleConfig>('hse_backup_schedule_config', {
        enabled: true,
        frequency: 'weekly',
        target: 'server',
        retentionCount: 10,
        notifyAdminOnBackup: true,
        encryptBackups: false,
      }),
      getSystemSettingQuiet<any[]>('hse_backup_history_v2', []),
    ]);

  return {
    database: {
      status: 'UP',
      totalTables: tables.length,
      totalRows: totalDbRows,
      tableCounts,
      foreignKeysCount: foreignKeys.length,
      primaryKeysCount: Object.keys(primaryKeys).length,
    },
    files: {
      uploadsCount: uploadedFiles.length,
      uploadsTotalBytes: uploadedFiles.reduce((acc, f) => acc + f.sizeBytes, 0),
      filesList: uploadedFiles.map((f) => ({
        fileName: f.fileName,
        relativePath: f.relativePath,
        sizeBytes: f.sizeBytes,
        sha256: f.sha256,
        modifiedAt: f.modifiedAt,
      })),
    },
    storage: diskInfo,
    backups: serverBackups,
    lastBackupTime,
    lastVerificationReport,
    lastTestRestoreReport,
    scheduleConfig,
    backupHistory: Array.isArray(backupHistory)
      ? backupHistory.filter((h: any) => !['bh-1', 'bh-2', 'bh-3'].includes(h?.id))
      : [],
  };
}

/**
 * Creates a complete, verified server-side backup archive (.hsebackup.json.gz)
 */
export async function createFullBackup(options: {
  tag?: BackupTag;
  operator: { username: string; fullName?: string; role?: string };
  isSelective?: boolean;
  selectedModules?: Record<string, boolean>;
  encrypt?: boolean;
}): Promise<{
  manifest: BackupManifest;
  verification: VerificationReport;
  archivePath: string;
}> {
  const tag: BackupTag = options.tag || 'manual';
  const isSelective = Boolean(options.isSelective);
  const encrypt = Boolean(options.encrypt);

  const disk = getStorageDiskInfo();
  if (!disk.writable) {
    throw new Error(`مسیر ذخیره‌سازی پشتیبان (${disk.backupDir}) قابل نوشتن نیست. مجوزهای دایرکتوری را بررسی کنید.`);
  }
  if (disk.freeBytes > 0 && disk.freeBytes < 20 * 1024 * 1024) {
    throw new Error('فضای خالی دیسک سرور کمتر از ۲۰ مگابایت است. عملیات پشتیبان‌گیری متوقف شد.');
  }

  const now = new Date();
  const timestampSlug = now.toISOString().replace(/[:.]/g, '-');
  const backupId = `hse_${tag}_${timestampSlug}`;
  const backupDir = disk.backupDir;

  const { tables: allTopologicalTables, primaryKeys, foreignKeys } = await getTopologicalTables();

  let targetTables = allTopologicalTables;
  const activeModules: string[] = [];
  if (isSelective && options.selectedModules) {
    const allowedSet = new Set<string>();
    for (const [modKey, enabled] of Object.entries(options.selectedModules)) {
      if (enabled && MODULE_TABLES_MAP[modKey]) {
        activeModules.push(modKey);
        for (const t of MODULE_TABLES_MAP[modKey]) {
          allowedSet.add(t);
        }
      }
    }
    if (allowedSet.size > 0) {
      targetTables = allTopologicalTables.filter((t) => allowedSet.has(t));
    }
  }

  // Read all tables inside a single consistent transaction
  const client = await pool.connect();
  const tablesData: Record<string, any[]> = {};
  const tableRowCounts: Record<string, number> = {};
  const schemaColumns: Record<string, Array<{ columnName: string; dataType: string; isNullable: string }>> = {};
  let totalRows = 0;

  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    for (const row of colsRes.rows) {
      if (!schemaColumns[row.table_name]) schemaColumns[row.table_name] = [];
      schemaColumns[row.table_name].push({
        columnName: row.column_name,
        dataType: row.data_type,
        isNullable: row.is_nullable,
      });
    }

    for (const tableName of targetTables) {
      const pk = primaryKeys[tableName];
      const orderClause = pk ? `ORDER BY "${pk}" ASC` : '';
      const res = await client.query(`SELECT * FROM "public"."${tableName}" ${orderClause}`);
      tablesData[tableName] = res.rows;
      tableRowCounts[tableName] = res.rows.length;
      totalRows += res.rows.length;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  // Collect uploaded physical files
  const filesData =
    !isSelective || !options.selectedModules || options.selectedModules.files_documents !== false
      ? collectUploadedFiles()
      : [];
  const filesTotalBytes = filesData.reduce((sum, f) => sum + f.sizeBytes, 0);

  // Compute cryptographic SHA-256 over canonical payload (tables + files)
  const payloadCanonical = JSON.stringify({
    tables: tablesData,
    files: filesData.map((f) => ({
      relativePath: f.relativePath,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
      contentBase64: f.contentBase64,
    })),
  });
  const payloadSha256 = sha256Hex(payloadCanonical);

  const manifest: BackupManifest = {
    backupId,
    fileName: `${backupId}.hsebackup.json.gz`,
    tag,
    createdAt: now.toISOString(),
    persianDate: formatPersianDateTime(now),
    appVersion: process.env.APP_VERSION || '0.2.8',
    schemaVersion: 'pg16-v2.5',
    createdBy: {
      username: options.operator.username || 'system',
      fullName: options.operator.fullName || options.operator.username || 'System',
      role: options.operator.role || 'ADMIN',
    },
    isSelective,
    selectedModules: isSelective ? activeModules : ['ALL'],
    tableCount: targetTables.length,
    totalRows,
    tableRowCounts,
    filesCount: filesData.length,
    filesTotalBytes,
    payloadSha256,
    encrypted: encrypt,
    verified: false,
  };

  const fullArchiveObject = {
    manifest,
    schemaMetadata: {
      topologicalOrder: targetTables,
      primaryKeys,
      foreignKeys,
      columns: schemaColumns,
    },
    tables: tablesData,
    files: filesData,
  };

  const rawJsonBuffer = Buffer.from(JSON.stringify(fullArchiveObject), 'utf8');
  const compressedBuffer = zlib.gzipSync(rawJsonBuffer, { level: 6 });
  const finalArchiveBuffer = encrypt ? encryptBuffer(compressedBuffer) : compressedBuffer;
  const archiveSha256 = sha256Hex(finalArchiveBuffer);

  manifest.archiveSha256 = archiveSha256;
  manifest.archiveSizeBytes = finalArchiveBuffer.length;

  const archivePath = path.join(backupDir, `${backupId}.hsebackup.json.gz`);
  const tmpArchivePath = `${archivePath}.tmp.${ process.pid }`;
  const shaPath = path.join(backupDir, `${backupId}.sha256`);
  const metaPath = path.join(backupDir, `${backupId}.meta.json`);

  // Write atomically via temp file
  fs.writeFileSync(tmpArchivePath, finalArchiveBuffer, { mode: 0o600 });
  fs.renameSync(tmpArchivePath, archivePath);
  fs.writeFileSync(shaPath, `${archiveSha256}  ${manifest.fileName}\n`, { mode: 0o600 });
  fs.writeFileSync(metaPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });

  // Mandatory Immediate Post-Backup Verification
  const verification = await verifyBackup(backupId);
  if (!verification.valid) {
    throw new Error(
      `نسخه پشتیبان ایجاد شد اما اعتبارسنجی SHA-256 یا ساختار آن ناموفق بود: ${verification.errors.join(' | ')}`
    );
  }

  manifest.verified = true;
  manifest.lastVerifiedAt = verification.verifiedAt;
  manifest.storagePath = archivePath;
  fs.writeFileSync(metaPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });

  // Update system settings & history
  await saveSystemSettingQuiet('hse_last_backup_time', manifest.persianDate);
  await appendBackupHistory({
    id: backupId,
    ts: manifest.persianDate,
    type: 'Backup',
    format: isSelective ? 'JSON (Selective)' : 'Full Archive (DB+Files)',
    size: `${(finalArchiveBuffer.length / 1024).toFixed(1)} KB`,
    recordCount: totalRows,
    filesCount: filesData.length,
    sha256: archiveSha256.slice(0, 16) + '...',
    status: 'Success',
    operator: manifest.createdBy.fullName || manifest.createdBy.username,
  });

  await writeAuditLogEntry(
    manifest.createdBy.username,
    `تهیه و اعتبارسنجی نسخه پشتیبان (${tag}) - ${targetTables.length} جدول، ${totalRows} رکورد، ${filesData.length} فایل`,
    'SYSTEM_BACKUP',
    backupId,
    {
      tag,
      tableCount: targetTables.length,
      totalRows,
      filesCount: filesData.length,
      archiveSizeBytes: finalArchiveBuffer.length,
      archiveSha256,
      payloadSha256,
      verified: true,
    }
  );

  if (tag === 'scheduled') {
    await enforceBackupRetentionPolicy();
  }

  return { manifest, verification, archivePath };
}

/**
 * Generates a PostgreSQL-16 compatible SQL dump (.sql) with real column formatting and sequence resets
 */
export async function generateSqlDumpString(options: {
  operator: { username: string; fullName?: string; role?: string };
  isSelective?: boolean;
  selectedModules?: Record<string, boolean>;
}): Promise<{ sql: string; totalRows: number; tablesExported: number; sha256: string }> {
  const { tables: allTopologicalTables, primaryKeys } = await getTopologicalTables();
  let targetTables = allTopologicalTables;

  if (options.isSelective && options.selectedModules) {
    const allowedSet = new Set<string>();
    for (const [modKey, enabled] of Object.entries(options.selectedModules)) {
      if (enabled && MODULE_TABLES_MAP[modKey]) {
        for (const t of MODULE_TABLES_MAP[modKey]) allowedSet.add(t);
      }
    }
    if (allowedSet.size > 0) {
      targetTables = allTopologicalTables.filter((t) => allowedSet.has(t));
    }
  }

  const now = new Date();
  const persianNow = formatPersianDateTime(now);
  let totalRows = 0;

  const lines: string[] = [];
  lines.push(`-- ============================================================================`);
  lines.push(`-- HSECORE Enterprise PostgreSQL 16 Data Dump`);
  lines.push(`-- Generated At: ${now.toISOString()} (${persianNow})`);
  lines.push(`-- Operator: ${options.operator.fullName || options.operator.username} (${options.operator.role || 'ADMIN'})`);
  lines.push(`-- Tables Covered: ${targetTables.length}`);
  lines.push(`-- ============================================================================`);
  lines.push(`SET statement_timeout = 0;`);
  lines.push(`SET lock_timeout = 0;`);
  lines.push(`SET client_encoding = 'UTF8';`);
  lines.push(`SET standard_conforming_strings = on;`);
  lines.push(`BEGIN;`);
  lines.push(``);

  for (const tableName of targetTables) {
    const pk = primaryKeys[tableName];
    const orderClause = pk ? `ORDER BY "${pk}" ASC` : '';
    const res = await pool.query(`SELECT * FROM "public"."${tableName}" ${orderClause}`);
    lines.push(`-- Table: public.${tableName} (${res.rows.length} rows)`);

    if (res.rows.length > 0) {
      totalRows += res.rows.length;
      const payloadJson = JSON.stringify(res.rows).replace(/'/g, "''");
      const conflictClause = pk ? `ON CONFLICT ("${pk}") DO NOTHING` : '';
      lines.push(
        `INSERT INTO "public"."${tableName}" SELECT * FROM jsonb_populate_recordset(null::"public"."${tableName}", '${payloadJson}'::jsonb) ${conflictClause};`
      );
      if (pk === 'id') {
        lines.push(
          `SELECT setval(pg_get_serial_sequence('"public"."${tableName}"', 'id'), COALESCE((SELECT MAX("id") FROM "public"."${tableName}"), 1), true);`
        );
      }
    }
    lines.push(``);
  }

  lines.push(`COMMIT;`);
  const bodyContent = lines.join('\n');
  const digest = sha256Hex(bodyContent);
  const finalSql = `${bodyContent}\n-- SHA256_CHECKSUM: ${digest}\n-- PostgreSQL database dump complete\n`;

  return {
    sql: finalSql,
    totalRows,
    tablesExported: targetTables.length,
    sha256: digest,
  };
}

/**
 * Loads and parses a backup archive from disk by backupId or from an uploaded raw Buffer/Object
 */
export function loadBackupArchive(backupIdOrInput: string | Buffer | Record<string, any>): {
  archiveObj: any;
  archiveSizeBytes: number;
  computedArchiveSha256: string;
  expectedArchiveSha256: string;
  archiveExists: boolean;
} {
  if (typeof backupIdOrInput === 'string') {
    const cleanId = sanitizeBackupId(backupIdOrInput);
    const backupDir = getBackupDirectory();
    const archivePath = path.join(backupDir, `${cleanId}.hsebackup.json.gz`);
    const shaPath = path.join(backupDir, `${cleanId}.sha256`);
    const metaPath = path.join(backupDir, `${cleanId}.meta.json`);

    if (!fs.existsSync(archivePath)) {
      return {
        archiveObj: null,
        archiveSizeBytes: 0,
        computedArchiveSha256: '',
        expectedArchiveSha256: '',
        archiveExists: false,
      };
    }

    const rawFileBuf = fs.readFileSync(archivePath);
    const computedArchiveSha256 = sha256Hex(rawFileBuf);
    let expectedArchiveSha256 = computedArchiveSha256;

    if (fs.existsSync(shaPath)) {
      const shaContent = fs.readFileSync(shaPath, 'utf8').trim();
      expectedArchiveSha256 = shaContent.split(/\s+/)[0] || '';
    } else if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta.archiveSha256) expectedArchiveSha256 = meta.archiveSha256;
      } catch {}
    }

    const decryptedBuf = decryptBufferIfNeeded(rawFileBuf);
    const decompressedBuf =
      decryptedBuf[0] === 0x1f && decryptedBuf[1] === 0x8b
        ? zlib.gunzipSync(decryptedBuf)
        : decryptedBuf;
    const archiveObj = JSON.parse(decompressedBuf.toString('utf8'));

    return {
      archiveObj,
      archiveSizeBytes: rawFileBuf.length,
      computedArchiveSha256,
      expectedArchiveSha256,
      archiveExists: true,
    };
  } else if (Buffer.isBuffer(backupIdOrInput)) {
    const computedArchiveSha256 = sha256Hex(backupIdOrInput);
    const decryptedBuf = decryptBufferIfNeeded(backupIdOrInput);
    const decompressedBuf =
      decryptedBuf[0] === 0x1f && decryptedBuf[1] === 0x8b
        ? zlib.gunzipSync(decryptedBuf)
        : decryptedBuf;
    const textContent = decompressedBuf.toString('utf8').trim();
    const archiveObj = textContent.startsWith('{')
      ? JSON.parse(textContent)
      : parseSqlDumpToArchiveObj(textContent, computedArchiveSha256);
    return {
      archiveObj,
      archiveSizeBytes: backupIdOrInput.length,
      computedArchiveSha256,
      expectedArchiveSha256: archiveObj?.manifest?.archiveSha256 || computedArchiveSha256,
      archiveExists: true,
    };
  } else {
    // Direct JSON object uploaded from client
    const rawStr = JSON.stringify(backupIdOrInput);
    const computedArchiveSha256 = sha256Hex(rawStr);
    return {
      archiveObj: backupIdOrInput,
      archiveSizeBytes: Buffer.byteLength(rawStr, 'utf8'),
      computedArchiveSha256,
      expectedArchiveSha256: backupIdOrInput?.manifest?.archiveSha256 || computedArchiveSha256,
      archiveExists: true,
    };
  }
}

function parseSqlDumpToArchiveObj(sqlText: string, computedSha: string): any {
  const tables: Record<string, any[]> = {};
  const regex =
    /INSERT\s+INTO\s+"public"\."([a-zA-Z0-9_]+)"[\s\S]*?jsonb_populate_recordset\(\s*null::"public"\."[a-zA-Z0-9_]+"\s*,\s*'([\s\S]*?)'::jsonb\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(sqlText)) !== null) {
    const tableName = match[1];
    const jsonRaw = match[2].replace(/''/g, "'");
    try {
      const rows = JSON.parse(jsonRaw);
      if (Array.isArray(rows)) {
        tables[tableName] = (tables[tableName] || []).concat(rows);
      }
    } catch {}
  }

  let expectedSha = computedSha;
  const shaMatch = sqlText.match(/--\s*SHA256_CHECKSUM:\s*([a-fA-F0-9]{64})/);
  if (shaMatch) {
    const bodyBeforeChecksum = sqlText.split(/\n--\s*SHA256_CHECKSUM:/)[0];
    const bodyHash = sha256Hex(bodyBeforeChecksum);
    if (bodyHash.toLowerCase() !== shaMatch[1].toLowerCase()) {
      expectedSha = shaMatch[1]; // Triggers checksum mismatch error in verifyBackup
    }
  }

  return {
    manifest: {
      backupId: `sql_upload_${Date.now()}`,
      createdAt: new Date().toISOString(),
      persianDate: formatPersianDateTime(),
      archiveSha256: expectedSha,
      payloadSha256: '',
    },
    tables,
    files: [],
  };
}

export async function saveBackupScheduleConfig(
  config: Partial<BackupScheduleConfig>,
  operatorUsername = 'system'
): Promise<BackupScheduleConfig> {
  const existing = await getSystemSettingQuiet<BackupScheduleConfig>('hse_backup_schedule_config', {
    enabled: true,
    frequency: 'weekly',
    target: 'server',
    retentionCount: 10,
    notifyAdminOnBackup: true,
    encryptBackups: false,
  });

  const merged: BackupScheduleConfig = {
    ...existing,
    ...config,
    retentionCount: Math.max(2, Math.min(100, Number(config.retentionCount ?? existing.retentionCount) || 10)),
  };

  await saveSystemSettingQuiet('hse_backup_schedule_config', merged);
  await enforceBackupRetentionPolicy();
  await writeAuditLogEntry(
    operatorUsername,
    `به‌روزرسانی سیاست زمان‌بندی و نگهداری نسخه‌های پشتیبان (${merged.frequency} - نگهداری: ${merged.retentionCount} نسخه)`,
    'SYSTEM_BACKUP_SCHEDULE',
    'hse_backup_schedule_config',
    merged
  );
  return merged;
}

/**
 * Normalizes legacy client-exported JSON formats ({ schemaManifest, database }) into standard archive structure
 */
function normalizeParsedBackupObject(rawObj: any): {
  manifest: Partial<BackupManifest>;
  tables: Record<string, any[]>;
  files: BackupFileEntry[];
  hasCanonicalPayloadHash: boolean;
} {
  if (rawObj && rawObj.manifest && rawObj.tables && typeof rawObj.tables === 'object') {
    return {
      manifest: rawObj.manifest,
      tables: rawObj.tables,
      files: Array.isArray(rawObj.files) ? rawObj.files : [],
      hasCanonicalPayloadHash: Boolean(rawObj.manifest.payloadSha256),
    };
  }

  // Legacy format support ({ schemaManifest, database })
  const dbSection = rawObj?.database || rawObj || {};
  const legacyMap: Record<string, string> = {
    personnel: 'personnel',
    medical_exams: 'periodic_medical_exams',
    work_permits: 'work_permits',
    incidents: 'incidents',
    trir_records: 'trir_monthly_records',
    safety_warnings: 'safety_warnings',
    users: 'users',
    audit_logs: 'audit_logs',
  };

  const normalizedTables: Record<string, any[]> = {};
  for (const [k, val] of Object.entries(dbSection)) {
    const targetTable = legacyMap[k] || k;
    if (Array.isArray(val)) {
      normalizedTables[targetTable] = val;
    }
  }

  return {
    manifest: {
      backupId: rawObj?.schemaManifest?.id || `uploaded_${Date.now()}`,
      createdAt: rawObj?.schemaManifest?.timestampIso || new Date().toISOString(),
      persianDate: rawObj?.schemaManifest?.persianDate || formatPersianDateTime(),
      payloadSha256: '',
    },
    tables: normalizedTables,
    files: Array.isArray(rawObj?.files) ? rawObj.files : [],
    hasCanonicalPayloadHash: false,
  };
}

/**
 * Cryptographically and structurally verifies a backup archive
 */
export async function verifyBackup(
  backupIdOrInput: string | Buffer | Record<string, any>
): Promise<VerificationReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = new Date();
  const persianDate = formatPersianDateTime(now);

  let loaded: ReturnType<typeof loadBackupArchive>;
  try {
    loaded = loadBackupArchive(backupIdOrInput);
  } catch (err: any) {
    const failedReport: VerificationReport = {
      backupId: typeof backupIdOrInput === 'string' ? backupIdOrInput : 'uploaded_file',
      verifiedAt: now.toISOString(),
      persianDate,
      valid: false,
      archiveExists: false,
      archiveSizeBytes: 0,
      computedArchiveSha256: '',
      expectedArchiveSha256: '',
      archiveChecksumMatch: false,
      computedPayloadSha256: '',
      expectedPayloadSha256: '',
      payloadChecksumMatch: false,
      tablesVerified: 0,
      rowsVerified: 0,
      filesVerified: 0,
      filesBytesVerified: 0,
      schemaCompatible: false,
      errors: [`خطا در بازگشایی یا خواندن ساختار فایل پشتیبان: ${err?.message || String(err)}`],
      warnings: [],
    };
    return failedReport;
  }

  if (!loaded.archiveExists || !loaded.archiveObj) {
    return {
      backupId: typeof backupIdOrInput === 'string' ? backupIdOrInput : 'uploaded_file',
      verifiedAt: now.toISOString(),
      persianDate,
      valid: false,
      archiveExists: false,
      archiveSizeBytes: 0,
      computedArchiveSha256: '',
      expectedArchiveSha256: '',
      archiveChecksumMatch: false,
      computedPayloadSha256: '',
      expectedPayloadSha256: '',
      payloadChecksumMatch: false,
      tablesVerified: 0,
      rowsVerified: 0,
      filesVerified: 0,
      filesBytesVerified: 0,
      schemaCompatible: false,
      errors: ['فایل نسخه پشتیبان در مسیر ذخیره‌سازی یافت نشد یا خالی است.'],
      warnings: [],
    };
  }

  const { manifest, tables, files, hasCanonicalPayloadHash } = normalizeParsedBackupObject(
    loaded.archiveObj
  );
  const backupId = manifest.backupId || (typeof backupIdOrInput === 'string' ? backupIdOrInput : 'uploaded');

  const archiveChecksumMatch =
    !loaded.expectedArchiveSha256 ||
    loaded.computedArchiveSha256.toLowerCase() === loaded.expectedArchiveSha256.toLowerCase();

  if (!archiveChecksumMatch) {
    errors.push(
      `عدم تطابق هش SHA-256 فایل آرشیو (مقدار مورد انتظار: ${loaded.expectedArchiveSha256.slice(0, 16)}...، محاسبه‌شده: ${loaded.computedArchiveSha256.slice(0, 16)}...).`
    );
  }

  const canonicalPayload = JSON.stringify({
    tables,
    files: files.map((f) => ({
      relativePath: f.relativePath,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
      contentBase64: f.contentBase64,
    })),
  });
  const computedPayloadSha256 = sha256Hex(canonicalPayload);
  const expectedPayloadSha256 = manifest.payloadSha256 || computedPayloadSha256;
  const payloadChecksumMatch =
    !hasCanonicalPayloadHash ||
    computedPayloadSha256.toLowerCase() === expectedPayloadSha256.toLowerCase();

  if (!payloadChecksumMatch) {
    errors.push('عدم تطابق هش رمزنگاری‌شده SHA-256 محتوای درونی جداول و فایل‌ها (احتمال دستکاری یا خرابی فایل).');
  }

  // Verify tables against live database schema
  const { tables: liveTables } = await getTopologicalTables();
  const liveTableSet = new Set(liveTables);

  let tablesVerified = 0;
  let rowsVerified = 0;
  let schemaCompatible = true;

  for (const [tableName, rows] of Object.entries(tables)) {
    if (!liveTableSet.has(tableName)) {
      warnings.push(`جدول "${tableName}" در اسکیمای فعلی پایگاه داده وجود ندارد و نادیده گرفته می‌شود.`);
      continue;
    }
    if (!Array.isArray(rows)) {
      errors.push(`ساختار داده‌های جدول "${tableName}" آرایه‌ای معتبر نیست.`);
      schemaCompatible = false;
      continue;
    }
    if (
      manifest.tableRowCounts &&
      manifest.tableRowCounts[tableName] !== undefined &&
      manifest.tableRowCounts[tableName] !== rows.length
    ) {
      errors.push(
        `تعداد رکوردهای جدول "${tableName}" (${rows.length}) با مانیفست پشتیبان (${manifest.tableRowCounts[tableName]}) همخوانی ندارد.`
      );
    }
    tablesVerified++;
    rowsVerified += rows.length;
  }

  if (tablesVerified === 0) {
    errors.push('هیچ جدول معتبری در فایل نسخه پشتیبان یافت نشد.');
    schemaCompatible = false;
  }

  // Verify embedded files
  let filesVerified = 0;
  let filesBytesVerified = 0;
  for (const fileEntry of files) {
    try {
      const buf = Buffer.from(fileEntry.contentBase64 || '', 'base64');
      const fileHash = sha256Hex(buf);
      if (fileEntry.sha256 && fileHash !== fileEntry.sha256) {
        errors.push(`عدم تطابق هش SHA-256 فایل پیوست "${fileEntry.relativePath}".`);
      } else if (fileEntry.sizeBytes !== undefined && buf.length !== fileEntry.sizeBytes) {
        errors.push(`اندازه فایل پیوست "${fileEntry.relativePath}" (${buf.length}) با مقدار ثبت‌شده (${fileEntry.sizeBytes}) مغایرت دارد.`);
      } else {
        filesVerified++;
        filesBytesVerified += buf.length;
      }
    } catch (e: any) {
      errors.push(`خطا در رمزگشایی فایل پیوست "${fileEntry.relativePath}": ${e?.message}`);
    }
  }

  const valid =
    errors.length === 0 &&
    archiveChecksumMatch &&
    payloadChecksumMatch &&
    schemaCompatible &&
    tablesVerified > 0;

  const report: VerificationReport = {
    backupId,
    verifiedAt: now.toISOString(),
    persianDate,
    valid,
    archiveExists: true,
    archiveSizeBytes: loaded.archiveSizeBytes,
    computedArchiveSha256: loaded.computedArchiveSha256,
    expectedArchiveSha256: loaded.expectedArchiveSha256,
    archiveChecksumMatch,
    computedPayloadSha256,
    expectedPayloadSha256,
    payloadChecksumMatch,
    tablesVerified,
    rowsVerified,
    filesVerified,
    filesBytesVerified,
    schemaCompatible,
    errors,
    warnings,
  };

  await saveSystemSettingQuiet('hse_last_verification_report', report);
  return report;
}

/**
 * Performs a 100% real isolated Dry-Run Test Restore inside a PostgreSQL temporary table sandbox
 * that rolls back at the end, proving data & relational integrity without touching live data!
 */
export async function testRestoreBackup(
  backupIdOrInput: string | Buffer | Record<string, any>,
  operatorUsername = 'system'
): Promise<TestRestoreReport> {
  const startTime = Date.now();
  const now = new Date();
  const persianDate = formatPersianDateTime(now);

  const verificationReport = await verifyBackup(backupIdOrInput);
  if (!verificationReport.valid) {
    const failedReport: TestRestoreReport = {
      backupId: verificationReport.backupId,
      testedAt: now.toISOString(),
      persianDate,
      durationMs: Date.now() - startTime,
      operator: operatorUsername,
      success: false,
      isolatedMode: 'POSTGRESQL_TEMP_SANDBOX_ROLLBACK',
      verificationReport,
      tablesTested: 0,
      totalBackupRows: 0,
      totalSandboxRestoredRows: 0,
      foreignKeysChecked: 0,
      foreignKeyViolations: 0,
      sequencesChecked: 0,
      filesTested: 0,
      filesBytesTested: 0,
      tableComparison: [],
      fileComparison: [],
      errors: [...verificationReport.errors],
    };
    await saveSystemSettingQuiet('hse_last_test_restore_report', failedReport);
    return failedReport;
  }

  const loaded = loadBackupArchive(backupIdOrInput);
  const { manifest, tables, files } = normalizeParsedBackupObject(loaded.archiveObj);
  const { tables: topologicalTables, primaryKeys, foreignKeys } = await getTopologicalTables();

  const client = await pool.connect();
  const errors: string[] = [];
  const tableComparison: TestRestoreTableComparison[] = [];
  let totalBackupRows = 0;
  let totalSandboxRestoredRows = 0;
  let foreignKeysChecked = 0;
  let foreignKeyViolations = 0;
  let sequencesChecked = 0;

  try {
    await client.query('BEGIN');

    // 1. Create isolated temporary sandbox tables and test-restore every row
    const sandboxTablesCreated = new Set<string>();

    for (const tableName of topologicalTables) {
      if (!(tableName in tables)) continue;
      const backupRows = Array.isArray(tables[tableName]) ? tables[tableName] : [];
      totalBackupRows += backupRows.length;

      const liveCountRes = await client.query(`SELECT COUNT(*)::int AS c FROM "public"."${tableName}"`);
      const liveRows = liveCountRes.rows[0]?.c || 0;

      const sandboxTable = `sandbox_${tableName}`;
      try {
        await client.query(`SAVEPOINT sp_table`);
        await client.query(
          `CREATE TEMP TABLE "${sandboxTable}" (LIKE "public"."${tableName}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT DROP;`
        );
        sandboxTablesCreated.add(tableName);

        if (backupRows.length > 0) {
          // Insert in chunks of 2000 rows for high speed and memory efficiency
          const chunkSize = 2000;
          const pk = primaryKeys[tableName];
          const conflictClause = pk ? `ON CONFLICT ("${pk}") DO NOTHING` : '';
          for (let i = 0; i < backupRows.length; i += chunkSize) {
            const chunk = backupRows.slice(i, i + chunkSize);
            await client.query(
              `INSERT INTO "${sandboxTable}" SELECT * FROM jsonb_populate_recordset(null::"public"."${tableName}", $1::jsonb) ${conflictClause};`,
              [JSON.stringify(chunk)]
            );
          }
        }

        const sandboxCountRes = await client.query(`SELECT COUNT(*)::int AS c FROM "${sandboxTable}"`);
        const sandboxRestoredRows = sandboxCountRes.rows[0]?.c || 0;
        totalSandboxRestoredRows += sandboxRestoredRows;

        if (primaryKeys[tableName] === 'id') {
          sequencesChecked++;
        }

        await client.query(`RELEASE SAVEPOINT sp_table`);

        const status = sandboxRestoredRows === backupRows.length ? 'OK' : 'MISMATCH';
        if (status === 'MISMATCH') {
          errors.push(
            `جدول "${tableName}": تعداد رکوردهای بازیابی‌شده در محیط ایزوله (${sandboxRestoredRows}) با نسخه پشتیبان (${backupRows.length}) متفاوت است.`
          );
        }

        tableComparison.push({
          tableName,
          backupRows: backupRows.length,
          sandboxRestoredRows,
          liveRows,
          status,
        });
      } catch (tErr: any) {
        await client.query(`ROLLBACK TO SAVEPOINT sp_table`).catch(() => {});
        errors.push(`خطای اسکیما یا محدودیت در جدول "${tableName}": ${tErr?.message}`);
        tableComparison.push({
          tableName,
          backupRows: backupRows.length,
          sandboxRestoredRows: 0,
          liveRows,
          status: 'ERROR',
          error: tErr?.message,
        });
      }
    }

    // 2. Verify Foreign Key referential integrity across all sandbox tables
    for (const fk of foreignKeys) {
      if (sandboxTablesCreated.has(fk.childTable) && sandboxTablesCreated.has(fk.parentTable)) {
        foreignKeysChecked++;
        const orphanRes = await client.query(`
          SELECT COUNT(*)::int AS orphans
          FROM "sandbox_${fk.childTable}" c
          LEFT JOIN "sandbox_${fk.parentTable}" p
            ON c."${fk.childColumn}" = p."${fk.parentColumn}"
          WHERE c."${fk.childColumn}" IS NOT NULL
            AND p."${fk.parentColumn}" IS NULL;
        `);
        const orphans = orphanRes.rows[0]?.orphans || 0;
        if (orphans > 0) {
          foreignKeyViolations += orphans;
          errors.push(
            `نقض یکپارچگی کلید خارجی: ${orphans} رکورد در "${fk.childTable}.${fk.childColumn}" بدون رکورد والد در "${fk.parentTable}.${fk.parentColumn}" یافت شد.`
          );
        }
      }
    }

    // Always rollback the sandbox transaction so live database is 100% untouched
    await client.query('ROLLBACK');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    errors.push(`خطای سیستمی در تراکنش ایزوله بازیابی آزمایشی: ${err?.message}`);
  } finally {
    client.release();
  }

  // 3. Test-restore physical files in memory / temp staging
  const fileComparison: Array<{ fileName: string; sizeBytes: number; sha256Match: boolean }> = [];
  let filesBytesTested = 0;

  for (const f of files) {
    const buf = Buffer.from(f.contentBase64 || '', 'base64');
    const hashMatch = !f.sha256 || sha256Hex(buf) === f.sha256;
    if (!hashMatch) {
      errors.push(`تست بازیابی فایل "${f.relativePath}" به علت عدم تطابق SHA-256 ناموفق بود.`);
    }
    filesBytesTested += buf.length;
    fileComparison.push({
      fileName: f.relativePath || f.fileName,
      sizeBytes: buf.length,
      sha256Match: hashMatch,
    });
  }

  const success =
    errors.length === 0 &&
    verificationReport.valid &&
    foreignKeyViolations === 0 &&
    totalSandboxRestoredRows === totalBackupRows;

  const testReport: TestRestoreReport = {
    backupId: verificationReport.backupId,
    testedAt: now.toISOString(),
    persianDate,
    durationMs: Date.now() - startTime,
    operator: operatorUsername,
    success,
    isolatedMode: 'POSTGRESQL_TEMP_SANDBOX_ROLLBACK',
    verificationReport,
    tablesTested: tableComparison.length,
    totalBackupRows,
    totalSandboxRestoredRows,
    foreignKeysChecked,
    foreignKeyViolations,
    sequencesChecked,
    filesTested: fileComparison.length,
    filesBytesTested,
    tableComparison,
    fileComparison,
    errors,
  };

  // Update metadata file if server backup
  if (typeof backupIdOrInput === 'string') {
    try {
      const cleanId = sanitizeBackupId(backupIdOrInput);
      const metaPath = path.join(getBackupDirectory(), `${cleanId}.meta.json`);
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as BackupManifest;
        meta.lastTestRestoreAt = now.toISOString();
        meta.lastTestRestoreStatus = success ? 'PASSED' : 'FAILED';
        meta.verified = verificationReport.valid;
        meta.lastVerifiedAt = verificationReport.verifiedAt;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), { mode: 0o600 });
      }
    } catch {}
  }

  await saveSystemSettingQuiet('hse_last_test_restore_report', testReport);
  await writeAuditLogEntry(
    operatorUsername,
    `اجرای بازیابی آزمایشی ایزوله (Dry-Run Sandbox) برای نسخه ${verificationReport.backupId} - نتیجه: ${success ? 'موفق' : 'ناموفق'}`,
    'SYSTEM_BACKUP_TEST_RESTORE',
    verificationReport.backupId,
    {
      success,
      tablesTested: testReport.tablesTested,
      totalBackupRows,
      totalSandboxRestoredRows,
      foreignKeysChecked,
      foreignKeyViolations,
      filesTested: testReport.filesTested,
      durationMs: testReport.durationMs,
    }
  );

  return testReport;
}

/**
 * Executes a real, atomic transactional restore after mandatory pre-flight test restore
 * and automatic pre-restore safety backup!
 */
export async function executeRealRestore(
  backupIdOrInput: string | Buffer | Record<string, any>,
  options: {
    mode: 'clean' | 'merge';
    operator: { username: string; fullName?: string; role?: string };
  }
): Promise<RestoreExecutionReport> {
  const startTime = Date.now();
  const now = new Date();
  const persianDate = formatPersianDateTime(now);
  const mode = options.mode || 'merge';
  const operatorName = options.operator.fullName || options.operator.username || 'system';

  // Step 1: Mandatory isolated test restore first
  const preRestoreTestReport = await testRestoreBackup(backupIdOrInput, options.operator.username);
  if (!preRestoreTestReport.success) {
    throw new Error(
      `بازیابی متوقف شد: نسخه پشتیبان در آزمون ایزوله پیش از بازیابی رد شد (${preRestoreTestReport.errors.join(' | ')})`
    );
  }

  // Step 2: Mandatory automatic pre-restore safety backup of current live state
  const safetyBackup = await createFullBackup({
    tag: 'pre_restore_safety',
    operator: options.operator,
  });

  const loaded = loadBackupArchive(backupIdOrInput);
  const { tables, files } = normalizeParsedBackupObject(loaded.archiveObj);
  const { tables: topologicalTables, primaryKeys } = await getTopologicalTables();

  const client = await pool.connect();
  let tablesRestored = 0;
  let rowsRestored = 0;
  let sequencesReset = 0;
  const errors: string[] = [];

  try {
    await client.query('BEGIN');

    if (mode === 'clean') {
      // Delete in reverse topological order (children before parents) to respect foreign keys
      const reverseTables = [...topologicalTables].reverse();
      for (const tableName of reverseTables) {
        if (tableName in tables) {
          // Protect active admin user in users table if backup has 0 users
          if (tableName === 'users' && (!Array.isArray(tables.users) || tables.users.length === 0)) {
            continue;
          }
          await client.query(`DELETE FROM "public"."${tableName}";`);
        }
      }
    }

    // Insert in forward topological order (parents before children)
    for (const tableName of topologicalTables) {
      if (!(tableName in tables)) continue;
      const rows = Array.isArray(tables[tableName]) ? tables[tableName] : [];
      const pk = primaryKeys[tableName];

      if (rows.length > 0) {
        const colsRes = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
          [tableName]
        );
        const colNames: string[] = colsRes.rows.map((r) => r.column_name);

        let conflictClause = '';
        if (pk) {
          const updateCols = colNames.filter((c) => c !== pk);
          if (mode === 'merge' && updateCols.length > 0 && tableName !== 'audit_logs') {
            const setAssignments = updateCols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');
            conflictClause = `ON CONFLICT ("${pk}") DO UPDATE SET ${setAssignments}`;
          } else {
            conflictClause = `ON CONFLICT ("${pk}") DO NOTHING`;
          }
        }

        const chunkSize = 2000;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          await client.query(
            `INSERT INTO "public"."${tableName}" SELECT * FROM jsonb_populate_recordset(null::"public"."${tableName}", $1::jsonb) ${conflictClause};`,
            [JSON.stringify(chunk)]
          );
        }
      }

      if (pk === 'id') {
        await client.query(`
          SELECT setval(
            pg_get_serial_sequence('"public"."${tableName}"', 'id'),
            COALESCE((SELECT MAX("id") FROM "public"."${tableName}"), 1),
            true
          );
        `);
        sequencesReset++;
      }

      tablesRestored++;
      rowsRestored += rows.length;
    }

    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    throw new Error(`خطا در تراکنش بازیابی پایگاه داده (تغییرات Rollback شد): ${err?.message}`);
  } finally {
    client.release();
  }

  // Step 4: Restore physical files into uploads/ atomically
  let filesRestored = 0;
  if (files.length > 0) {
    const uploadsDir = getUploadsDirectory();
    const stageDir = path.join(uploadsDir, `.restore_stage_${Date.now()}`);
    fs.mkdirSync(stageDir, { recursive: true });

    try {
      for (const f of files) {
        const archivePath = f.relativePath || f.fileName;
        const stagePath = resolveBackupRestorePath(stageDir, archivePath);
        fs.mkdirSync(path.dirname(stagePath), { recursive: true });
        const buf = Buffer.from(f.contentBase64 || '', 'base64');
        if (f.sha256 && sha256Hex(buf) !== f.sha256) {
          throw new Error(`عدم تطابق هش فایل پیوست ${archivePath}`);
        }
        fs.writeFileSync(stagePath, buf);
      }

      // Move verified staged files into live uploads directory
      for (const f of files) {
        const archivePath = f.relativePath || f.fileName;
        const stagePath = resolveBackupRestorePath(stageDir, archivePath);
        const destPath = resolveBackupRestorePath(uploadsDir, archivePath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.renameSync(stagePath, destPath);
        filesRestored++;
      }
    } finally {
      try {
        fs.rmSync(stageDir, { recursive: true, force: true });
      } catch {}
    }
  }

  const report: RestoreExecutionReport = {
    backupId: preRestoreTestReport.backupId,
    restoredAt: now.toISOString(),
    persianDate,
    durationMs: Date.now() - startTime,
    mode,
    operator: operatorName,
    success: true,
    safetyBackupId: safetyBackup.manifest.backupId,
    tablesRestored,
    rowsRestored,
    sequencesReset,
    filesRestored,
    preRestoreTestReport,
    errors,
  };

  await appendBackupHistory({
    id: `restore_${Date.now()}`,
    ts: persianDate,
    type: 'Restore',
    format: `Full Restore (${mode.toUpperCase()})`,
    size: `${(preRestoreTestReport.verificationReport.archiveSizeBytes / 1024).toFixed(1)} KB`,
    recordCount: rowsRestored,
    filesCount: filesRestored,
    sha256: preRestoreTestReport.verificationReport.computedArchiveSha256.slice(0, 16) + '...',
    status: 'Success',
    operator: operatorName,
  });

  await writeAuditLogEntry(
    options.operator.username,
    `بازیابی کامل اطلاعات سامانه از نسخه ${preRestoreTestReport.backupId} (حالت: ${mode}) - پشتیبان ایمنی: ${safetyBackup.manifest.backupId}`,
    'SYSTEM_RESTORE',
    preRestoreTestReport.backupId,
    {
      mode,
      safetyBackupId: safetyBackup.manifest.backupId,
      tablesRestored,
      rowsRestored,
      sequencesReset,
      filesRestored,
      durationMs: report.durationMs,
    }
  );

  broadcastDataMutation('system', 'restore', { backupId: report.backupId, restoredAt: report.restoredAt });
  return report;
}

/**
 * Deletes a specific backup archive from server storage (with safety checks)
 */
export async function deleteServerBackup(
  backupId: string,
  operatorUsername: string
): Promise<{ deleted: boolean; backupId: string }> {
  const cleanId = sanitizeBackupId(backupId);
  const backupDir = getBackupDirectory();
  const archivePath = path.join(backupDir, `${cleanId}.hsebackup.json.gz`);
  const metaPath = path.join(backupDir, `${cleanId}.meta.json`);
  const shaPath = path.join(backupDir, `${cleanId}.sha256`);

  if (!fs.existsSync(archivePath) && !fs.existsSync(metaPath)) {
    throw new Error('نسخه پشتیبان مورد نظر یافت نشد.');
  }

  if (fs.existsSync(archivePath)) fs.unlinkSync(archivePath);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  if (fs.existsSync(shaPath)) fs.unlinkSync(shaPath);

  await writeAuditLogEntry(
    operatorUsername,
    `حذف نسخه پشتیبان ${cleanId} از فضای ذخیره‌سازی سرور`,
    'SYSTEM_BACKUP_DELETE',
    cleanId,
    { deletedBy: operatorUsername }
  );

  return { deleted: true, backupId: cleanId };
}

/**
 * Enforces retention count pruning on scheduled backups
 */
export async function enforceBackupRetentionPolicy(): Promise<{ prunedIds: string[] }> {
  const config = await getSystemSettingQuiet<BackupScheduleConfig>('hse_backup_schedule_config', {
    enabled: true,
    frequency: 'weekly',
    target: 'server',
    retentionCount: 10,
    notifyAdminOnBackup: true,
    encryptBackups: false,
  });

  const allBackups = listServerBackups();
  const toRemove = selectScheduledBackupsForRetention(allBackups, config.retentionCount);

  const prunedIds: string[] = [];
  if (toRemove.length > 0) {
    for (const item of toRemove) {
      try {
        await deleteServerBackup(item.backupId, 'SYSTEM_RETENTION_POLICY');
        prunedIds.push(item.backupId);
      } catch (e) {
        logger.warn(`Failed to prune expired backup ${item.backupId}:`, e);
      }
    }
  }

  return { prunedIds };
}

async function appendBackupHistory(entry: any): Promise<void> {
  const current = await getSystemSettingQuiet<any[]>('hse_backup_history_v2', []);
  const clean = Array.isArray(current)
    ? current.filter((h: any) => !['bh-1', 'bh-2', 'bh-3'].includes(h?.id))
    : [];
  const updated = [entry, ...clean].slice(0, 50);
  await saveSystemSettingQuiet('hse_backup_history_v2', updated);
}

// ============================================================================
// Automated Background Scheduler
// ============================================================================
let schedulerTimer: NodeJS.Timeout | null = null;

export function initBackupScheduler(): void {
  if (schedulerTimer) clearInterval(schedulerTimer);

  // Check every 30 minutes if a scheduled backup is due
  schedulerTimer = setInterval(async () => {
    try {
      const config = await getSystemSettingQuiet<BackupScheduleConfig>('hse_backup_schedule_config', {
        enabled: true,
        frequency: 'weekly',
        target: 'server',
        retentionCount: 10,
        notifyAdminOnBackup: true,
        encryptBackups: false,
      });

      if (!config.enabled || config.frequency === 'manual') return;

      const intervalMs =
        config.frequency === 'daily'
          ? 24 * 60 * 60 * 1000
          : config.frequency === 'weekly'
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

      const lastRun = config.lastScheduledRunAt ? new Date(config.lastScheduledRunAt).getTime() : 0;
      const now = Date.now();

      if (now - lastRun >= intervalMs) {
        logger.info(`[BackupScheduler] Running scheduled (${config.frequency}) full backup...`);
        await createFullBackup({
          tag: 'scheduled',
          operator: { username: 'SYSTEM_SCHEDULER', fullName: 'زمان‌بند خودکار سامانه', role: 'SYSTEM' },
          encrypt: Boolean(config.encryptBackups),
        });
        config.lastScheduledRunAt = new Date(now).toISOString();
        config.nextScheduledRunAt = new Date(now + intervalMs).toISOString();
        await saveSystemSettingQuiet('hse_backup_schedule_config', config);
      }
    } catch (err) {
      logger.error('[BackupScheduler] Scheduled backup execution error:', err);
    }
  }, 30 * 60 * 1000);
}
